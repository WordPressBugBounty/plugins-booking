"use strict";

/**
 * Request Object
 * Here we can  define Search parameters and Update it later,  when  some parameter was changed
 *
 */
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
var wpbc_ajx_customize_plugin = function (obj, $) {
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
}(wpbc_ajx_customize_plugin || {}, jQuery);
var wpbc_ajx_bookings = [];

/**
 *   Show Content  ---------------------------------------------------------------------------------------------- */

/**
 * Show Content - Calendar and UI elements
 *
 * @param ajx_data
 * @param ajx_search_params
 * @param ajx_cleaned_params
 */
function wpbc_ajx_customize_plugin__page_content__show(ajx_data, ajx_search_params, ajx_cleaned_params) {
  // Content ---------------------------------------------------------------------------------------------------------
  var template__customize_plugin_main_page_content = wp.template('wpbc_ajx_customize_plugin_main_page_content');
  jQuery(wpbc_ajx_customize_plugin.get_other_param('listing_container')).html(template__customize_plugin_main_page_content({
    'ajx_data': ajx_data,
    'ajx_search_params': ajx_search_params,
    // $_REQUEST[ 'search_params' ]
    'ajx_cleaned_params': ajx_cleaned_params
  }));
  var template__inline_calendar;
  var data_arr = {
    'ajx_data': ajx_data,
    'ajx_search_params': ajx_search_params,
    'ajx_cleaned_params': ajx_cleaned_params
  };
  switch (ajx_data['customize_steps']['current']) {
    case 'calendar_skin':
      // Calendar  --------------------------------------------------------------------------------------------
      template__inline_calendar = wp.template('wpbc_ajx_customize_plugin__inline_calendar');
      jQuery('.wpbc_ajx_cstm__section_left').html(template__inline_calendar(data_arr));

      // Calendar Skin
      var template__wiget_calendar_skin = wp.template('wpbc_ajx_widget_change_calendar_skin');
      jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(template__wiget_calendar_skin(data_arr));

      // Shortcode
      // var template__widget_plugin_shortcode = wp.template( 'wpbc_ajx_widget_plugin_shortcode' );
      // jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(	template__widget_plugin_shortcode( data_arr ) );

      // Size
      // var template__wiget_calendar_size = wp.template( 'wpbc_ajx_widget_calendar_size' );
      // jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(	template__wiget_calendar_size( data_arr ) );

      break;
    case 'calendar_size':
      // Calendar  --------------------------------------------------------------------------------------------
      template__inline_calendar = wp.template('wpbc_ajx_customize_plugin__inline_calendar');
      jQuery('.wpbc_ajx_cstm__section_left').html(template__inline_calendar(data_arr));

      // Calendar Skin
      var template__wiget_calendar_size = wp.template('wpbc_ajx_widget_calendar_size');
      jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(template__wiget_calendar_size(data_arr));

      // Shortcode
      // var template__widget_plugin_shortcode = wp.template( 'wpbc_ajx_widget_plugin_shortcode' );
      // jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(	template__widget_plugin_shortcode( data_arr ) );

      break;
    case 'calendar_dates_selection':
      // Calendar  --------------------------------------------------------------------------------------------
      template__inline_calendar = wp.template('wpbc_ajx_customize_plugin__inline_calendar');
      jQuery('.wpbc_ajx_cstm__section_left').html(template__inline_calendar(data_arr));
      jQuery('.wpbc_ajx_cstm__section_left').append('<div class="clear" style="width:100%;margin:50px 0 0;"></div>');
      var message_html_id = wpbc_ajx_customize_plugin__show_message('<strong>' + 'You can test days selection in calendar' + '</strong>', {
        'container': '.wpbc_ajx_cstm__section_left',
        // '#ajax_working',
        'style': 'margin: 6px auto;  padding: 6px 20px;z-index: 999999;',
        'type': 'info',
        'delay': 5000
      });
      wpbc_blink_element('#' + message_html_id, 3, 320);

      // Widget - Dates selection
      var template__widget_plugin_calendar_dates_selection = wp.template('wpbc_ajx_widget_calendar_dates_selection');
      jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(template__widget_plugin_calendar_dates_selection(data_arr));
      break;
    case 'calendar_weekdays_availability':
      // Scroll  to  current month
      var s_year = wpbc_ajx_customize_plugin.search_set_param('calendar__start_year', 0);
      var s_month = wpbc_ajx_customize_plugin.search_set_param('calendar__start_month', 0);

      // Calendar  --------------------------------------------------------------------------------------------
      template__inline_calendar = wp.template('wpbc_ajx_customize_plugin__inline_calendar');
      jQuery('.wpbc_ajx_cstm__section_left').html(template__inline_calendar(data_arr));

      // Widget - Weekdays Availability
      var template__widget_plugin_calendar_weekdays_availability = wp.template('wpbc_ajx_widget_calendar_weekdays_availability');
      jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(template__widget_plugin_calendar_weekdays_availability(data_arr));
      break;
    case 'calendar_additional':
      // Calendar  --------------------------------------------------------------------------------------------
      template__inline_calendar = wp.template('wpbc_ajx_customize_plugin__inline_calendar');
      jQuery('.wpbc_ajx_cstm__section_left').html(template__inline_calendar(data_arr));

      // Calendar Skin
      var template__wiget_calendar_additional = wp.template('wpbc_ajx_widget_calendar_additional');
      jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(template__wiget_calendar_additional(data_arr));

      // Shortcode
      // var template__widget_plugin_shortcode = wp.template( 'wpbc_ajx_widget_plugin_shortcode' );
      // jQuery('.wpbc_ajx_cstm__section_right .wpbc_widgets').append(	template__widget_plugin_shortcode( data_arr ) );

      break;
    default:
    //console.log( `Sorry, we are out of ${expr}.` );
  }

  // Toolbar ---------------------------------------------------------------------------------------------------------
  var template__customize_plugin_toolbar_page_content = wp.template('wpbc_ajx_customize_plugin_toolbar_page_content');
  jQuery(wpbc_ajx_customize_plugin.get_other_param('toolbar_container')).html(template__customize_plugin_toolbar_page_content({
    'ajx_data': ajx_data,
    'ajx_search_params': ajx_search_params,
    // $_REQUEST[ 'search_params' ]
    'ajx_cleaned_params': ajx_cleaned_params
  }));

  // Booking resources  ------------------------------------------------------------------------------------------
  var wpbc_ajx_select_booking_resource = wp.template('wpbc_ajx_select_booking_resource');
  jQuery('#wpbc_hidden_template__select_booking_resource').html(wpbc_ajx_select_booking_resource({
    'ajx_data': ajx_data,
    'ajx_search_params': ajx_search_params,
    'ajx_cleaned_params': ajx_cleaned_params
  }));
  /*
   * By  default hided at ../wp-content/plugins/booking/includes/page-customize/_src/customize_plugin_page.css  #wpbc_hidden_template__select_booking_resource { display: none; }
   *
   * 	We can hide  ///-	Hide resources!
   * 				 //setTimeout( function (){ jQuery( '#wpbc_hidden_template__select_booking_resource' ).html( '' ); }, 1000 );
   */

  // Other  ---------------------------------------------------------------------------------------------------------
  jQuery('.wpbc_processing.wpbc_spin').parent().parent().parent().parent('[id^="wpbc_notice_"]').hide();

  // Load calendar ---------------------------------------------------------------------------------------------------------
  wpbc_ajx_customize_plugin__calendar__show({
    'resource_id': ajx_cleaned_params.resource_id,
    'ajx_nonce_calendar': ajx_data.ajx_nonce_calendar,
    'ajx_data_arr': ajx_data,
    'ajx_cleaned_params': ajx_cleaned_params
  });

  //------------------------------------------------------------------------------------------------------------------
  /**
   * Change calendar skin view
   */
  jQuery('.wpbc_radio__set_days_customize_plugin').on('change', function (event, resource_id, inst) {
    wpbc__calendar__change_skin(jQuery(this).val());
  });

  // Re-load Tooltips
  jQuery(document).ready(function () {
    wpbc_define_tippy_tooltips(wpbc_ajx_customize_plugin.get_other_param('listing_container') + ' ');
    wpbc_define_tippy_tooltips(wpbc_ajx_customize_plugin.get_other_param('toolbar_container') + ' ');
  });
}

/**
 * Show inline month view calendar              with all predefined CSS (sizes and check in/out,  times containers)
 * @param {obj} calendar_params_arr
			{
				'resource_id'       	: ajx_cleaned_params.resource_id,
				'ajx_nonce_calendar'	: ajx_data_arr.ajx_nonce_calendar,
				'ajx_data_arr'          : ajx_data_arr = { ajx_booking_resources:[],  resource_unavailable_dates:[], season_customize_plugin:{},.... }
				'ajx_cleaned_params'    : {
											calendar__days_selection_mode: "dynamic"
											calendar__timeslot_day_bg_as_available: ""
											calendar__view__cell_height: ""
											calendar__view__months_in_row: 4
											calendar__view__visible_months: 12
											calendar__view__width: "100%"

											dates_customize_plugin: "unavailable"
											dates_selection: "2023-03-14 ~ 2023-03-16"
											do_action: "set_customize_plugin"
											resource_id: 1
											ui_clicked_element_id: "wpbc_customize_plugin_apply_btn"
											ui_usr__customize_plugin_selected_toolbar: "info"
								  		 }
			}
*/
function wpbc_ajx_customize_plugin__calendar__show(calendar_params_arr) {
  // Update nonce
  jQuery('#ajx_nonce_calendar_section').html(calendar_params_arr.ajx_nonce_calendar);

  //------------------------------------------------------------------------------------------------------------------
  // Update bookings
  //------------------------------------------------------------------------------------------------------------------
  if ('undefined' == typeof wpbc_ajx_bookings[calendar_params_arr.resource_id]) {
    wpbc_ajx_bookings[calendar_params_arr.resource_id] = [];
  }
  wpbc_ajx_bookings[calendar_params_arr.resource_id] = calendar_params_arr['ajx_data_arr']['calendar_settings']['booked_dates'];

  //------------------------------------------------------------------------------------------------------------------
  // Get scrolling month  or year  in calendar  and save it to  the init parameters
  //------------------------------------------------------------------------------------------------------------------
  jQuery('body').off('wpbc__inline_booking_calendar__changed_year_month');
  jQuery('body').on('wpbc__inline_booking_calendar__changed_year_month', function (event, year, month, calendar_params_arr, datepick_this) {
    wpbc_ajx_customize_plugin.search_set_param('calendar__start_year', year);
    wpbc_ajx_customize_plugin.search_set_param('calendar__start_month', month);
  });

  //------------------------------------------------------------------------------------------------------------------
  // Define showing mouse over tooltip on unavailable dates
  //------------------------------------------------------------------------------------------------------------------
  jQuery('body').on('wpbc_datepick_inline_calendar_refresh', function (event, resource_id, inst) {
    /**
     * It's defined, when calendar REFRESHED (change months or days selection) loaded in jquery.datepick.wpbc.9.0.js :
     * 		$( 'body' ).trigger( 'wpbc_datepick_inline_calendar_refresh', ...		//FixIn: 9.4.4.13
     */

    // inst.dpDiv  it's:  <div class="datepick-inline datepick-multi" style="width: 17712px;">....</div>

    inst.dpDiv.find('.season_unavailable,.before_after_unavailable,.weekdays_unavailable').on('mouseover', function (this_event) {
      // also available these vars: 	resource_id, jCalContainer, inst
      var jCell = jQuery(this_event.currentTarget);
      wpbc_cstm__show_tooltip__for_element(jCell, calendar_params_arr['ajx_data_arr']['popover_hints']);
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  //  Define height of the calendar  cells, 	and  mouse over tooltips at  some unavailable dates
  //------------------------------------------------------------------------------------------------------------------
  jQuery('body').on('wpbc_datepick_inline_calendar_loaded', function (event, resource_id, jCalContainer, inst) {
    /**
     * It's defined, when calendar loaded in jquery.datepick.wpbc.9.0.js :
     * 		$( 'body' ).trigger( 'wpbc_datepick_inline_calendar_loaded', ...		//FixIn: 9.4.4.12
     */

    // Remove highlight day for today  date
    jQuery('.datepick-days-cell.datepick-today.datepick-days-cell-over').removeClass('datepick-days-cell-over');

    // Set height of calendar  cells if defined this option
    var stylesheet = document.getElementById('wpbc-calendar-cell-height');
    if (null !== stylesheet) {
      stylesheet.parentNode.removeChild(stylesheet);
    }
    if ('' !== calendar_params_arr.ajx_cleaned_params.calendar__view__cell_height) {
      jQuery('head').append('<style type="text/css" id="wpbc-calendar-cell-height">' + '.hasDatepick .datepick-inline .datepick-title-row th, ' + '.hasDatepick .datepick-inline .datepick-days-cell {' + 'height: ' + calendar_params_arr.ajx_cleaned_params.calendar__view__cell_height + ' !important;' + '}' + '</style>');
    }

    // Define showing mouse over tooltip on unavailable dates
    jCalContainer.find('.season_unavailable,.before_after_unavailable,.weekdays_unavailable').on('mouseover', function (this_event) {
      // also available these vars: 	resource_id, jCalContainer, inst
      var jCell = jQuery(this_event.currentTarget);
      wpbc_cstm__show_tooltip__for_element(jCell, calendar_params_arr['ajx_data_arr']['popover_hints']);
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Define months_in_row
  //------------------------------------------------------------------------------------------------------------------
  if (undefined == calendar_params_arr.ajx_cleaned_params.calendar__view__months_in_row || '' == calendar_params_arr.ajx_cleaned_params.calendar__view__months_in_row) {
    calendar_params_arr.ajx_cleaned_params.calendar__view__months_in_row = calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months;
  }

  //------------------------------------------------------------------------------------------------------------------
  // Define width of entire calendar
  //------------------------------------------------------------------------------------------------------------------
  var width = ''; // var width = 'width:100%;max-width:100%;';
  // Width																											/* FixIn: 9.7.3.4 */
  if (undefined != calendar_params_arr.ajx_cleaned_params.calendar__view__width && '' !== calendar_params_arr.ajx_cleaned_params.calendar__view__width) {
    width += 'max-width:' + calendar_params_arr.ajx_cleaned_params.calendar__view__width + ';';
    width += 'width:100%;';
  }

  //------------------------------------------------------------------------------------------------------------------
  // Add calendar container: "Calendar is loading..."  and textarea
  //------------------------------------------------------------------------------------------------------------------
  jQuery('.wpbc_ajx_cstm__calendar').html('<div class="' + ' bk_calendar_frame' + ' months_num_in_row_' + calendar_params_arr.ajx_cleaned_params.calendar__view__months_in_row + ' cal_month_num_' + calendar_params_arr.ajx_cleaned_params.calendar__view__visible_months + ' ' + calendar_params_arr.ajx_cleaned_params.calendar__timeslot_day_bg_as_available // 'wpbc_timeslot_day_bg_as_available' || ''
  + '" ' + 'style="' + width + '">' + '<div id="calendar_booking' + calendar_params_arr.resource_id + '">' + 'Calendar is loading...' + '</div>' + '</div>' + '<textarea      id="date_booking' + calendar_params_arr.resource_id + '"' + ' name="date_booking' + calendar_params_arr.resource_id + '"' + ' autocomplete="off"' + ' style="display:none;width:100%;height:10em;margin:2em 0 0;"></textarea>');

  //------------------------------------------------------------------------------------------------------------------
  // Define variables for calendar
  //------------------------------------------------------------------------------------------------------------------
  var cal_param_arr = calendar_params_arr.ajx_data_arr.calendar_settings;
  cal_param_arr['html_id'] = 'calendar_booking' + calendar_params_arr.ajx_cleaned_params.resource_id;
  cal_param_arr['text_id'] = 'date_booking' + calendar_params_arr.ajx_cleaned_params.resource_id;
  cal_param_arr['resource_id'] = calendar_params_arr.ajx_cleaned_params.resource_id;
  cal_param_arr['ajx_nonce_calendar'] = calendar_params_arr.ajx_data_arr.ajx_nonce_calendar;
  cal_param_arr['season_customize_plugin'] = calendar_params_arr.ajx_data_arr.season_customize_plugin;
  cal_param_arr['resource_unavailable_dates'] = calendar_params_arr.ajx_data_arr.resource_unavailable_dates;
  cal_param_arr['popover_hints'] = calendar_params_arr.ajx_data_arr.popover_hints; // {'season_unavailable':'...','weekdays_unavailable':'...','before_after_unavailable':'...',}

  //------------------------------------------------------------------------------------------------------------------
  // Show Calendar
  //------------------------------------------------------------------------------------------------------------------
  wpbc_show_inline_booking_calendar(cal_param_arr);

  //------------------------------------------------------------------------------------------------------------------
  // Scroll  to  specific Year and Month,  if defined in init parameters
  //------------------------------------------------------------------------------------------------------------------
  var s_year = wpbc_ajx_customize_plugin.search_get_param('calendar__start_year');
  var s_month = wpbc_ajx_customize_plugin.search_get_param('calendar__start_month');
  if (0 !== s_year && 0 !== s_month) {
    wpbc__inline_booking_calendar__change_year_month(cal_param_arr['resource_id'], s_year, s_month);
  }
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
function wpbc_cstm__prepare_tooltip__in_calendar(value, date, calendar_params_arr, datepick_this) {
  if (null == date) {
    return false;
  }
  var td_class = date.getMonth() + 1 + '-' + date.getDate() + '-' + date.getFullYear();
  var jCell = jQuery('#calendar_booking' + calendar_params_arr.resource_id + ' td.cal4date-' + td_class);
  wpbc_cstm__show_tooltip__for_element(jCell, calendar_params_arr['popover_hints']);
  return true;
}

/**
 * Define tooltip  for showing on UNAVAILABLE days (season, weekday, today_depends unavailable)
 *
 * @param jCell					jQuery of specific day cell
 * @param popover_hints		    Array with tooltip hint texts	 : {'season_unavailable':'...','weekdays_unavailable':'...','before_after_unavailable':'...',}
 */
function wpbc_cstm__show_tooltip__for_element(jCell, popover_hints) {
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
function wpbc_ajx_customize_plugin__ajax_request() {
  console.groupCollapsed('WPBC_AJX_CUSTOMIZE_PLUGIN');
  console.log(' == Before Ajax Send - search_get_all_params() == ', wpbc_ajx_customize_plugin.search_get_all_params());
  wpbc_customize_plugin_reload_button__spin_start();

  // Start Ajax
  jQuery.post(wpbc_url_ajax, {
    action: 'WPBC_AJX_CUSTOMIZE_PLUGIN',
    wpbc_ajx_user_id: wpbc_ajx_customize_plugin.get_secure_param('user_id'),
    nonce: wpbc_ajx_customize_plugin.get_secure_param('nonce'),
    wpbc_ajx_locale: wpbc_ajx_customize_plugin.get_secure_param('locale'),
    search_params: wpbc_ajx_customize_plugin.search_get_all_params()
  },
  /**
   * S u c c e s s
   *
   * @param response_data		-	its object returned from  Ajax - class-live-searcg.php
   * @param textStatus		-	'success'
   * @param jqXHR				-	Object
   */
  function (response_data, textStatus, jqXHR) {
    console.log(' == Response WPBC_AJX_CUSTOMIZE_PLUGIN == ', response_data);
    console.groupEnd();

    // Probably Error
    if (_typeof(response_data) !== 'object' || response_data === null) {
      wpbc_ajx_customize_plugin__actual_content__hide();
      wpbc_ajx_customize_plugin__show_message(response_data);
      return;
    }

    // Reload page, after filter toolbar has been reset
    if (undefined != response_data['ajx_cleaned_params'] && 'reset_done' === response_data['ajx_cleaned_params']['do_action']) {
      location.reload();
      return;
    }

    // Show listing
    wpbc_ajx_customize_plugin__page_content__show(response_data['ajx_data'], response_data['ajx_search_params'], response_data['ajx_cleaned_params']);

    //wpbc_ajx_customize_plugin__define_ui_hooks();						// Redefine Hooks, because we show new DOM elements
    if ('' != response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />")) {
      wpbc_admin_show_message(response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />"), '1' == response_data['ajx_data']['ajx_after_action_result'] ? 'success' : 'error', 10000);
    }
    wpbc_customize_plugin_reload_button__spin_pause();
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
    wpbc_ajx_customize_plugin__actual_content__hide();
    wpbc_ajx_customize_plugin__show_message(error_message);
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
function wpbc_ajx_customize_plugin__send_request_with_params(params_arr) {
  // Define different Search  parameters for request
  _.each(params_arr, function (p_val, p_key, p_data) {
    //console.log( 'Request for: ', p_key, p_val );
    wpbc_ajx_customize_plugin.search_set_param(p_key, p_val);
  });

  // Send Ajax Request
  wpbc_ajx_customize_plugin__ajax_request();
}

/**
 * Search request for "Page Number"
 * @param page_number	int
 */
function wpbc_ajx_customize_plugin__pagination_click(page_number) {
  wpbc_ajx_customize_plugin__send_request_with_params({
    'page_num': page_number
  });
}

/**
 *   Show / Hide Content  --------------------------------------------------------------------------------------- */

/**
 *  Show Listing Content 	- 	Sending Ajax Request	-	with parameters that  we early  defined
 */
function wpbc_ajx_customize_plugin__actual_content__show() {
  wpbc_ajx_customize_plugin__ajax_request(); // Send Ajax Request	-	with parameters that  we early  defined in "wpbc_ajx_booking_listing" Obj.
}

/**
 * Hide Listing Content
 */
function wpbc_ajx_customize_plugin__actual_content__hide() {
  jQuery(wpbc_ajx_customize_plugin.get_other_param('listing_container')).html('');
}

/**
 *   M e s s a g e  --------------------------------------------------------------------------------------------- */

/**
 *
 */

/**
 * Show message in content
 *
 * @param message				Message HTML
 * @param params = {
 *                   ['type']				'warning' | 'info' | 'error' | 'success'		default: 'warning'
 *                   ['container']			'.wpbc_ajx_cstm__section_left'		default: wpbc_ajx_customize_plugin.get_other_param( 'listing_container' )
 *                   ['is_append']			true | false						default: true
 *				   }
 * Example:
 * 			var html_id = wpbc_ajx_customize_plugin__show_message( 'You can test days selection in calendar', 'info', '.wpbc_ajx_cstm__section_left', true );
 *
 *
 * @returns string  - HTML ID
 */
function wpbc_ajx_customize_plugin__show_message(message) {
  var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var params_default = {
    'type': 'warning',
    'container': wpbc_ajx_customize_plugin.get_other_param('listing_container'),
    'is_append': true,
    'style': 'text-align:left;',
    'delay': 0
  };
  _.each(params, function (p_val, p_key, p_data) {
    params_default[p_key] = p_val;
  });
  params = params_default;
  var unique_div_id = new Date();
  unique_div_id = 'wpbc_notice_' + unique_div_id.getTime();
  var alert_class = 'notice ';
  if (params['type'] == 'error') {
    alert_class += 'notice-error ';
    message = '<i style="margin-right: 0.5em;color: #d63638;" class="menu_icon icon-1x wpbc_icn_report_gmailerrorred"></i>' + message;
  }
  if (params['type'] == 'warning') {
    alert_class += 'notice-warning ';
    message = '<i style="margin-right: 0.5em;color: #e9aa04;" class="menu_icon icon-1x wpbc_icn_warning"></i>' + message;
  }
  if (params['type'] == 'info') {
    alert_class += 'notice-info ';
  }
  if (params['type'] == 'success') {
    alert_class += 'notice-info alert-success updated ';
    message = '<i style="margin-right: 0.5em;color: #64aa45;" class="menu_icon icon-1x wpbc_icn_done_outline"></i>' + message;
  }
  message = '<div id="' + unique_div_id + '" class="wpbc-settings-notice ' + alert_class + '" style="' + params['style'] + '">' + message + '</div>';
  if (params['is_append']) {
    jQuery(params['container']).append(message);
  } else {
    jQuery(params['container']).html(message);
  }
  params['delay'] = parseInt(params['delay']);
  if (params['delay'] > 0) {
    var closed_timer = setTimeout(function () {
      jQuery('#' + unique_div_id).fadeOut(1500);
    }, params['delay']);
  }
  return unique_div_id;
}

/**
 *   Support Functions - Spin Icon in Buttons  ------------------------------------------------------------------ */

/**
 * Spin button in Filter toolbar  -  Start
 */
function wpbc_customize_plugin_reload_button__spin_start() {
  jQuery('#wpbc_customize_plugin_reload_button .menu_icon.wpbc_spin').removeClass('wpbc_animation_pause');
}

/**
 * Spin button in Filter toolbar  -  Pause
 */
function wpbc_customize_plugin_reload_button__spin_pause() {
  jQuery('#wpbc_customize_plugin_reload_button .menu_icon.wpbc_spin').addClass('wpbc_animation_pause');
}

/**
 * Spin button in Filter toolbar  -  is Spinning ?
 *
 * @returns {boolean}
 */
function wpbc_customize_plugin_reload_button__is_spin() {
  if (jQuery('#wpbc_customize_plugin_reload_button .menu_icon.wpbc_spin').hasClass('wpbc_animation_pause')) {
    return true;
  } else {
    return false;
  }
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1jdXN0b21pemUvX291dC9jdXN0b21pemVfcGx1Z2luX3BhZ2UuanMiLCJuYW1lcyI6WyJfdHlwZW9mIiwib2JqIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJjb25zdHJ1Y3RvciIsInByb3RvdHlwZSIsIndwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4iLCIkIiwicF9zZWN1cmUiLCJzZWN1cml0eV9vYmoiLCJ1c2VyX2lkIiwibm9uY2UiLCJsb2NhbGUiLCJzZXRfc2VjdXJlX3BhcmFtIiwicGFyYW1fa2V5IiwicGFyYW1fdmFsIiwiZ2V0X3NlY3VyZV9wYXJhbSIsInBfbGlzdGluZyIsInNlYXJjaF9yZXF1ZXN0X29iaiIsInNlYXJjaF9zZXRfYWxsX3BhcmFtcyIsInJlcXVlc3RfcGFyYW1fb2JqIiwic2VhcmNoX2dldF9hbGxfcGFyYW1zIiwic2VhcmNoX2dldF9wYXJhbSIsInNlYXJjaF9zZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtc19hcnIiLCJwYXJhbXNfYXJyIiwiXyIsImVhY2giLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwicF9vdGhlciIsIm90aGVyX29iaiIsInNldF9vdGhlcl9wYXJhbSIsImdldF9vdGhlcl9wYXJhbSIsImpRdWVyeSIsIndwYmNfYWp4X2Jvb2tpbmdzIiwid3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fcGFnZV9jb250ZW50X19zaG93IiwiYWp4X2RhdGEiLCJhanhfc2VhcmNoX3BhcmFtcyIsImFqeF9jbGVhbmVkX3BhcmFtcyIsInRlbXBsYXRlX19jdXN0b21pemVfcGx1Z2luX21haW5fcGFnZV9jb250ZW50Iiwid3AiLCJ0ZW1wbGF0ZSIsImh0bWwiLCJ0ZW1wbGF0ZV9faW5saW5lX2NhbGVuZGFyIiwiZGF0YV9hcnIiLCJ0ZW1wbGF0ZV9fd2lnZXRfY2FsZW5kYXJfc2tpbiIsImFwcGVuZCIsInRlbXBsYXRlX193aWdldF9jYWxlbmRhcl9zaXplIiwibWVzc2FnZV9odG1sX2lkIiwid3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fc2hvd19tZXNzYWdlIiwid3BiY19ibGlua19lbGVtZW50IiwidGVtcGxhdGVfX3dpZGdldF9wbHVnaW5fY2FsZW5kYXJfZGF0ZXNfc2VsZWN0aW9uIiwic195ZWFyIiwic19tb250aCIsInRlbXBsYXRlX193aWRnZXRfcGx1Z2luX2NhbGVuZGFyX3dlZWtkYXlzX2F2YWlsYWJpbGl0eSIsInRlbXBsYXRlX193aWdldF9jYWxlbmRhcl9hZGRpdGlvbmFsIiwidGVtcGxhdGVfX2N1c3RvbWl6ZV9wbHVnaW5fdG9vbGJhcl9wYWdlX2NvbnRlbnQiLCJ3cGJjX2FqeF9zZWxlY3RfYm9va2luZ19yZXNvdXJjZSIsInBhcmVudCIsImhpZGUiLCJ3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19jYWxlbmRhcl9fc2hvdyIsInJlc291cmNlX2lkIiwiYWp4X25vbmNlX2NhbGVuZGFyIiwib24iLCJldmVudCIsImluc3QiLCJ3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4iLCJ2YWwiLCJkb2N1bWVudCIsInJlYWR5Iiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJjYWxlbmRhcl9wYXJhbXNfYXJyIiwib2ZmIiwieWVhciIsIm1vbnRoIiwiZGF0ZXBpY2tfdGhpcyIsImRwRGl2IiwiZmluZCIsInRoaXNfZXZlbnQiLCJqQ2VsbCIsImN1cnJlbnRUYXJnZXQiLCJ3cGJjX2NzdG1fX3Nob3dfdG9vbHRpcF9fZm9yX2VsZW1lbnQiLCJqQ2FsQ29udGFpbmVyIiwicmVtb3ZlQ2xhc3MiLCJzdHlsZXNoZWV0IiwiZ2V0RWxlbWVudEJ5SWQiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJjYWxlbmRhcl9fdmlld19fY2VsbF9oZWlnaHQiLCJ1bmRlZmluZWQiLCJjYWxlbmRhcl9fdmlld19fbW9udGhzX2luX3JvdyIsImNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocyIsIndpZHRoIiwiY2FsZW5kYXJfX3ZpZXdfX3dpZHRoIiwiY2FsZW5kYXJfX3RpbWVzbG90X2RheV9iZ19hc19hdmFpbGFibGUiLCJjYWxfcGFyYW1fYXJyIiwiYWp4X2RhdGFfYXJyIiwiY2FsZW5kYXJfc2V0dGluZ3MiLCJzZWFzb25fY3VzdG9taXplX3BsdWdpbiIsInJlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzIiwicG9wb3Zlcl9oaW50cyIsIndwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciIsIndwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19jaGFuZ2VfeWVhcl9tb250aCIsIndwYmNfY3N0bV9fcHJlcGFyZV90b29sdGlwX19pbl9jYWxlbmRhciIsInZhbHVlIiwiZGF0ZSIsInRkX2NsYXNzIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwiZ2V0RnVsbFllYXIiLCJ0b29sdGlwX3RpbWUiLCJoYXNDbGFzcyIsImF0dHIiLCJ0ZF9lbCIsImdldCIsIl90aXBweSIsIndwYmNfdGlwcHkiLCJjb250ZW50IiwicmVmZXJlbmNlIiwicG9wb3Zlcl9jb250ZW50IiwiZ2V0QXR0cmlidXRlIiwiYWxsb3dIVE1MIiwidHJpZ2dlciIsImludGVyYWN0aXZlIiwiaGlkZU9uQ2xpY2siLCJpbnRlcmFjdGl2ZUJvcmRlciIsIm1heFdpZHRoIiwidGhlbWUiLCJwbGFjZW1lbnQiLCJkZWxheSIsImlnbm9yZUF0dHJpYnV0ZXMiLCJ0b3VjaCIsImFwcGVuZFRvIiwiYm9keSIsIndwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX2FqYXhfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIndwYmNfY3VzdG9taXplX3BsdWdpbl9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0IiwicG9zdCIsIndwYmNfdXJsX2FqYXgiLCJhY3Rpb24iLCJ3cGJjX2FqeF91c2VyX2lkIiwid3BiY19hanhfbG9jYWxlIiwic2VhcmNoX3BhcmFtcyIsInJlc3BvbnNlX2RhdGEiLCJ0ZXh0U3RhdHVzIiwianFYSFIiLCJncm91cEVuZCIsIndwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX2FjdHVhbF9jb250ZW50X19oaWRlIiwibG9jYXRpb24iLCJyZWxvYWQiLCJyZXBsYWNlIiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJ3cGJjX2N1c3RvbWl6ZV9wbHVnaW5fcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiIsImZhaWwiLCJlcnJvclRocm93biIsIndpbmRvdyIsImVycm9yX21lc3NhZ2UiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiLCJ3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMiLCJ3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19wYWdpbmF0aW9uX2NsaWNrIiwicGFnZV9udW1iZXIiLCJ3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19hY3R1YWxfY29udGVudF9fc2hvdyIsIm1lc3NhZ2UiLCJwYXJhbXMiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJwYXJhbXNfZGVmYXVsdCIsInVuaXF1ZV9kaXZfaWQiLCJEYXRlIiwiZ2V0VGltZSIsImFsZXJ0X2NsYXNzIiwicGFyc2VJbnQiLCJjbG9zZWRfdGltZXIiLCJzZXRUaW1lb3V0IiwiZmFkZU91dCIsImFkZENsYXNzIiwid3BiY19jdXN0b21pemVfcGx1Z2luX3JlbG9hZF9idXR0b25fX2lzX3NwaW4iXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWN1c3RvbWl6ZS9fc3JjL2N1c3RvbWl6ZV9wbHVnaW5fcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBSZXF1ZXN0IE9iamVjdFxyXG4gKiBIZXJlIHdlIGNhbiAgZGVmaW5lIFNlYXJjaCBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxuXHJcbnZhciB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cclxuXHRvYmouc2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX3NlY3VyZVsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX3NlY3VyZVsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIExpc3RpbmcgU2VhcmNoIHBhcmFtZXRlcnNcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2xpc3RpbmcgPSBvYmouc2VhcmNoX3JlcXVlc3Rfb2JqID0gb2JqLnNlYXJjaF9yZXF1ZXN0X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X2FsbF9wYXJhbXMgPSBmdW5jdGlvbiAoIHJlcXVlc3RfcGFyYW1fb2JqICkge1xyXG5cdFx0cF9saXN0aW5nID0gcmVxdWVzdF9wYXJhbV9vYmo7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfYWxsX3BhcmFtcyA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2xpc3Rpbmc7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX2xpc3RpbmdbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdC8vIGlmICggQXJyYXkuaXNBcnJheSggcGFyYW1fdmFsICkgKXtcclxuXHRcdC8vIFx0cGFyYW1fdmFsID0gSlNPTi5zdHJpbmdpZnkoIHBhcmFtX3ZhbCApO1xyXG5cdFx0Ly8gfVxyXG5cdFx0cF9saXN0aW5nWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9wYXJhbXNfYXJyID0gZnVuY3Rpb24oIHBhcmFtc19hcnIgKXtcclxuXHRcdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0XHRcdHRoaXMuc2VhcmNoX3NldF9wYXJhbSggcF9rZXksIHBfdmFsICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gT3RoZXIgcGFyYW1ldGVycyBcdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9vdGhlciA9IG9iai5vdGhlcl9vYmogPSBvYmoub3RoZXJfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlclsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdHJldHVybiBvYmo7XHJcbn0oIHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4gfHwge30sIGpRdWVyeSApKTtcclxuXHJcbnZhciB3cGJjX2FqeF9ib29raW5ncyA9IFtdO1xyXG5cclxuLyoqXHJcbiAqICAgU2hvdyBDb250ZW50ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2hvdyBDb250ZW50IC0gQ2FsZW5kYXIgYW5kIFVJIGVsZW1lbnRzXHJcbiAqXHJcbiAqIEBwYXJhbSBhanhfZGF0YVxyXG4gKiBAcGFyYW0gYWp4X3NlYXJjaF9wYXJhbXNcclxuICogQHBhcmFtIGFqeF9jbGVhbmVkX3BhcmFtc1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fcGFnZV9jb250ZW50X19zaG93KCBhanhfZGF0YSwgYWp4X3NlYXJjaF9wYXJhbXMgLCBhanhfY2xlYW5lZF9wYXJhbXMgKXtcclxuXHJcblx0Ly8gQ29udGVudCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgdGVtcGxhdGVfX2N1c3RvbWl6ZV9wbHVnaW5fbWFpbl9wYWdlX2NvbnRlbnQgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fbWFpbl9wYWdlX2NvbnRlbnQnICk7XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbCggdGVtcGxhdGVfX2N1c3RvbWl6ZV9wbHVnaW5fbWFpbl9wYWdlX2NvbnRlbnQoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2RhdGEnICAgICAgICAgICAgICA6IGFqeF9kYXRhLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgIDogYWp4X3NlYXJjaF9wYXJhbXMsXHRcdFx0XHRcdFx0XHRcdC8vICRfUkVRVUVTVFsgJ3NlYXJjaF9wYXJhbXMnIF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IGFqeF9jbGVhbmVkX3BhcmFtc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9ICkgKTtcclxuXHJcblx0dmFyIHRlbXBsYXRlX19pbmxpbmVfY2FsZW5kYXI7XHJcblx0dmFyIGRhdGFfYXJyID0ge1xyXG5cdFx0XHRcdFx0XHRcdCdhanhfZGF0YScgICAgICAgICAgICAgIDogYWp4X2RhdGEsXHJcblx0XHRcdFx0XHRcdFx0J2FqeF9zZWFyY2hfcGFyYW1zJyAgICAgOiBhanhfc2VhcmNoX3BhcmFtcyxcclxuXHRcdFx0XHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IGFqeF9jbGVhbmVkX3BhcmFtc1xyXG5cdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRzd2l0Y2ggKCBhanhfZGF0YVsnY3VzdG9taXplX3N0ZXBzJ11bJ2N1cnJlbnQnXSApe1xyXG5cclxuXHRcdGNhc2UgJ2NhbGVuZGFyX3NraW4nOlxyXG5cclxuXHRcdFx0Ly8gQ2FsZW5kYXIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdHRlbXBsYXRlX19pbmxpbmVfY2FsZW5kYXIgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX2lubGluZV9jYWxlbmRhcicgKTtcclxuXHRcdFx0alF1ZXJ5KCcud3BiY19hanhfY3N0bV9fc2VjdGlvbl9sZWZ0JykuaHRtbChcdHRlbXBsYXRlX19pbmxpbmVfY2FsZW5kYXIoIGRhdGFfYXJyICkgKTtcclxuXHJcblx0XHRcdC8vIENhbGVuZGFyIFNraW5cclxuXHRcdFx0dmFyIHRlbXBsYXRlX193aWdldF9jYWxlbmRhcl9za2luID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF93aWRnZXRfY2hhbmdlX2NhbGVuZGFyX3NraW4nICk7XHJcblx0XHRcdGpRdWVyeSgnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fcmlnaHQgLndwYmNfd2lkZ2V0cycpLmFwcGVuZChcdHRlbXBsYXRlX193aWdldF9jYWxlbmRhcl9za2luKCBkYXRhX2FyciApICk7XHJcblxyXG5cdFx0XHQvLyBTaG9ydGNvZGVcclxuXHRcdFx0Ly8gdmFyIHRlbXBsYXRlX193aWRnZXRfcGx1Z2luX3Nob3J0Y29kZSA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfd2lkZ2V0X3BsdWdpbl9zaG9ydGNvZGUnICk7XHJcblx0XHRcdC8vIGpRdWVyeSgnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fcmlnaHQgLndwYmNfd2lkZ2V0cycpLmFwcGVuZChcdHRlbXBsYXRlX193aWRnZXRfcGx1Z2luX3Nob3J0Y29kZSggZGF0YV9hcnIgKSApO1xyXG5cclxuXHRcdFx0Ly8gU2l6ZVxyXG5cdFx0XHQvLyB2YXIgdGVtcGxhdGVfX3dpZ2V0X2NhbGVuZGFyX3NpemUgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X3dpZGdldF9jYWxlbmRhcl9zaXplJyApO1xyXG5cdFx0XHQvLyBqUXVlcnkoJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX3JpZ2h0IC53cGJjX3dpZGdldHMnKS5hcHBlbmQoXHR0ZW1wbGF0ZV9fd2lnZXRfY2FsZW5kYXJfc2l6ZSggZGF0YV9hcnIgKSApO1xyXG5cclxuXHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0Y2FzZSAnY2FsZW5kYXJfc2l6ZSc6XHJcblxyXG5cdFx0XHQvLyBDYWxlbmRhciAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0dGVtcGxhdGVfX2lubGluZV9jYWxlbmRhciA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9faW5saW5lX2NhbGVuZGFyJyApO1xyXG5cdFx0XHRqUXVlcnkoJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX2xlZnQnKS5odG1sKFx0dGVtcGxhdGVfX2lubGluZV9jYWxlbmRhciggZGF0YV9hcnIgKSApO1xyXG5cclxuXHRcdFx0Ly8gQ2FsZW5kYXIgU2tpblxyXG5cdFx0XHR2YXIgdGVtcGxhdGVfX3dpZ2V0X2NhbGVuZGFyX3NpemUgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X3dpZGdldF9jYWxlbmRhcl9zaXplJyApO1xyXG5cdFx0XHRqUXVlcnkoJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX3JpZ2h0IC53cGJjX3dpZGdldHMnKS5hcHBlbmQoXHR0ZW1wbGF0ZV9fd2lnZXRfY2FsZW5kYXJfc2l6ZSggZGF0YV9hcnIgKSApO1xyXG5cclxuXHRcdFx0Ly8gU2hvcnRjb2RlXHJcblx0XHRcdC8vIHZhciB0ZW1wbGF0ZV9fd2lkZ2V0X3BsdWdpbl9zaG9ydGNvZGUgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X3dpZGdldF9wbHVnaW5fc2hvcnRjb2RlJyApO1xyXG5cdFx0XHQvLyBqUXVlcnkoJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX3JpZ2h0IC53cGJjX3dpZGdldHMnKS5hcHBlbmQoXHR0ZW1wbGF0ZV9fd2lkZ2V0X3BsdWdpbl9zaG9ydGNvZGUoIGRhdGFfYXJyICkgKTtcclxuXHJcblx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdGNhc2UgJ2NhbGVuZGFyX2RhdGVzX3NlbGVjdGlvbic6XHJcblxyXG5cdFx0XHQvLyBDYWxlbmRhciAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0dGVtcGxhdGVfX2lubGluZV9jYWxlbmRhciA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9faW5saW5lX2NhbGVuZGFyJyApO1xyXG5cdFx0XHRqUXVlcnkoJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX2xlZnQnKS5odG1sKFx0dGVtcGxhdGVfX2lubGluZV9jYWxlbmRhciggZGF0YV9hcnIgKSApO1xyXG5cclxuXHRcdFx0alF1ZXJ5KCcud3BiY19hanhfY3N0bV9fc2VjdGlvbl9sZWZ0JykuYXBwZW5kKCc8ZGl2IGNsYXNzPVwiY2xlYXJcIiBzdHlsZT1cIndpZHRoOjEwMCU7bWFyZ2luOjUwcHggMCAwO1wiPjwvZGl2PicpO1xyXG5cclxuXHRcdFx0dmFyIG1lc3NhZ2VfaHRtbF9pZCA9IHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPHN0cm9uZz4nICtcdCdZb3UgY2FuIHRlc3QgZGF5cyBzZWxlY3Rpb24gaW4gY2FsZW5kYXInICsgJzwvc3Ryb25nPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRhaW5lcic6ICcud3BiY19hanhfY3N0bV9fc2VjdGlvbl9sZWZ0JyxcdFx0Ly8gJyNhamF4X3dvcmtpbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ21hcmdpbjogNnB4IGF1dG87ICBwYWRkaW5nOiA2cHggMjBweDt6LWluZGV4OiA5OTk5OTk7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICdpbmZvJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDUwMDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcjJyArIG1lc3NhZ2VfaHRtbF9pZCwgMywgMzIwICk7XHJcblxyXG5cdFx0XHQvLyBXaWRnZXQgLSBEYXRlcyBzZWxlY3Rpb25cclxuXHRcdFx0IHZhciB0ZW1wbGF0ZV9fd2lkZ2V0X3BsdWdpbl9jYWxlbmRhcl9kYXRlc19zZWxlY3Rpb24gPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X3dpZGdldF9jYWxlbmRhcl9kYXRlc19zZWxlY3Rpb24nICk7XHJcblx0XHRcdCBqUXVlcnkoJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX3JpZ2h0IC53cGJjX3dpZGdldHMnKS5hcHBlbmQoXHR0ZW1wbGF0ZV9fd2lkZ2V0X3BsdWdpbl9jYWxlbmRhcl9kYXRlc19zZWxlY3Rpb24oIGRhdGFfYXJyICkgKTtcclxuXHJcblx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdGNhc2UgJ2NhbGVuZGFyX3dlZWtkYXlzX2F2YWlsYWJpbGl0eSc6XHJcblxyXG5cdFx0XHQvLyBTY3JvbGwgIHRvICBjdXJyZW50IG1vbnRoXHJcblx0XHRcdHZhciBzX3llYXIgPSB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luLnNlYXJjaF9zZXRfcGFyYW0oICdjYWxlbmRhcl9fc3RhcnRfeWVhcicsIDAgKTtcclxuXHRcdFx0dmFyIHNfbW9udGggPSB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luLnNlYXJjaF9zZXRfcGFyYW0oICdjYWxlbmRhcl9fc3RhcnRfbW9udGgnLCAwICk7XHJcblxyXG5cdFx0XHQvLyBDYWxlbmRhciAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0dGVtcGxhdGVfX2lubGluZV9jYWxlbmRhciA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9faW5saW5lX2NhbGVuZGFyJyApO1xyXG5cdFx0XHRqUXVlcnkoJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX2xlZnQnKS5odG1sKFx0dGVtcGxhdGVfX2lubGluZV9jYWxlbmRhciggZGF0YV9hcnIgKSApO1xyXG5cclxuXHRcdFx0Ly8gV2lkZ2V0IC0gV2Vla2RheXMgQXZhaWxhYmlsaXR5XHJcblx0XHRcdCB2YXIgdGVtcGxhdGVfX3dpZGdldF9wbHVnaW5fY2FsZW5kYXJfd2Vla2RheXNfYXZhaWxhYmlsaXR5ID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF93aWRnZXRfY2FsZW5kYXJfd2Vla2RheXNfYXZhaWxhYmlsaXR5JyApO1xyXG5cdFx0XHQgalF1ZXJ5KCcud3BiY19hanhfY3N0bV9fc2VjdGlvbl9yaWdodCAud3BiY193aWRnZXRzJykuYXBwZW5kKFx0dGVtcGxhdGVfX3dpZGdldF9wbHVnaW5fY2FsZW5kYXJfd2Vla2RheXNfYXZhaWxhYmlsaXR5KCBkYXRhX2FyciApICk7XHJcblxyXG5cdFx0XHRicmVhaztcclxuXHJcblx0XHRjYXNlICdjYWxlbmRhcl9hZGRpdGlvbmFsJzpcclxuXHJcblx0XHRcdC8vIENhbGVuZGFyICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHR0ZW1wbGF0ZV9faW5saW5lX2NhbGVuZGFyID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19pbmxpbmVfY2FsZW5kYXInICk7XHJcblx0XHRcdGpRdWVyeSgnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fbGVmdCcpLmh0bWwoXHR0ZW1wbGF0ZV9faW5saW5lX2NhbGVuZGFyKCBkYXRhX2FyciApICk7XHJcblxyXG5cdFx0XHQvLyBDYWxlbmRhciBTa2luXHJcblx0XHRcdHZhciB0ZW1wbGF0ZV9fd2lnZXRfY2FsZW5kYXJfYWRkaXRpb25hbCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfd2lkZ2V0X2NhbGVuZGFyX2FkZGl0aW9uYWwnICk7XHJcblx0XHRcdGpRdWVyeSgnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fcmlnaHQgLndwYmNfd2lkZ2V0cycpLmFwcGVuZChcdHRlbXBsYXRlX193aWdldF9jYWxlbmRhcl9hZGRpdGlvbmFsKCBkYXRhX2FyciApICk7XHJcblxyXG5cdFx0XHQvLyBTaG9ydGNvZGVcclxuXHRcdFx0Ly8gdmFyIHRlbXBsYXRlX193aWRnZXRfcGx1Z2luX3Nob3J0Y29kZSA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfd2lkZ2V0X3BsdWdpbl9zaG9ydGNvZGUnICk7XHJcblx0XHRcdC8vIGpRdWVyeSgnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fcmlnaHQgLndwYmNfd2lkZ2V0cycpLmFwcGVuZChcdHRlbXBsYXRlX193aWRnZXRfcGx1Z2luX3Nob3J0Y29kZSggZGF0YV9hcnIgKSApO1xyXG5cclxuXHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0ZGVmYXVsdDpcclxuXHRcdFx0Ly9jb25zb2xlLmxvZyggYFNvcnJ5LCB3ZSBhcmUgb3V0IG9mICR7ZXhwcn0uYCApO1xyXG5cdH1cclxuXHJcblx0Ly8gVG9vbGJhciAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgdGVtcGxhdGVfX2N1c3RvbWl6ZV9wbHVnaW5fdG9vbGJhcl9wYWdlX2NvbnRlbnQgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fdG9vbGJhcl9wYWdlX2NvbnRlbnQnICk7XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luLmdldF9vdGhlcl9wYXJhbSggJ3Rvb2xiYXJfY29udGFpbmVyJyApICkuaHRtbCggdGVtcGxhdGVfX2N1c3RvbWl6ZV9wbHVnaW5fdG9vbGJhcl9wYWdlX2NvbnRlbnQoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2RhdGEnICAgICAgICAgICAgICA6IGFqeF9kYXRhLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgIDogYWp4X3NlYXJjaF9wYXJhbXMsXHRcdFx0XHRcdFx0XHRcdC8vICRfUkVRVUVTVFsgJ3NlYXJjaF9wYXJhbXMnIF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IGFqeF9jbGVhbmVkX3BhcmFtc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9ICkgKTtcclxuXHJcblxyXG5cdFx0Ly8gQm9va2luZyByZXNvdXJjZXMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIHdwYmNfYWp4X3NlbGVjdF9ib29raW5nX3Jlc291cmNlID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9zZWxlY3RfYm9va2luZ19yZXNvdXJjZScgKTtcclxuXHRcdGpRdWVyeSggJyN3cGJjX2hpZGRlbl90ZW1wbGF0ZV9fc2VsZWN0X2Jvb2tpbmdfcmVzb3VyY2UnKS5odG1sKCB3cGJjX2FqeF9zZWxlY3RfYm9va2luZ19yZXNvdXJjZSgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9kYXRhJyAgICAgICAgICAgICAgOiBhanhfZGF0YSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgIDogYWp4X3NlYXJjaF9wYXJhbXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IGFqeF9jbGVhbmVkX3BhcmFtc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gXHQpICk7XHJcblx0XHQvKlxyXG5cdFx0ICogQnkgIGRlZmF1bHQgaGlkZWQgYXQgLi4vd3AtY29udGVudC9wbHVnaW5zL2Jvb2tpbmcvaW5jbHVkZXMvcGFnZS1jdXN0b21pemUvX3NyYy9jdXN0b21pemVfcGx1Z2luX3BhZ2UuY3NzICAjd3BiY19oaWRkZW5fdGVtcGxhdGVfX3NlbGVjdF9ib29raW5nX3Jlc291cmNlIHsgZGlzcGxheTogbm9uZTsgfVxyXG5cdFx0ICpcclxuXHRcdCAqIFx0V2UgY2FuIGhpZGUgIC8vLy1cdEhpZGUgcmVzb3VyY2VzIVxyXG5cdFx0ICogXHRcdFx0XHQgLy9zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXsgalF1ZXJ5KCAnI3dwYmNfaGlkZGVuX3RlbXBsYXRlX19zZWxlY3RfYm9va2luZ19yZXNvdXJjZScgKS5odG1sKCAnJyApOyB9LCAxMDAwICk7XHJcblx0XHQgKi9cclxuXHJcblxyXG5cclxuXHJcblx0Ly8gT3RoZXIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJy53cGJjX3Byb2Nlc3Npbmcud3BiY19zcGluJykucGFyZW50KCkucGFyZW50KCkucGFyZW50KCkucGFyZW50KCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKS5oaWRlKCk7XHJcblxyXG5cclxuXHQvLyBMb2FkIGNhbGVuZGFyIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX2NhbGVuZGFyX19zaG93KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnICAgICAgIDogYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ub25jZV9jYWxlbmRhcic6IGFqeF9kYXRhLmFqeF9ub25jZV9jYWxlbmRhcixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfZGF0YV9hcnInICAgICAgICAgIDogYWp4X2RhdGEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2NsZWFuZWRfcGFyYW1zJyAgICA6IGFqeF9jbGVhbmVkX3BhcmFtc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBDaGFuZ2UgY2FsZW5kYXIgc2tpbiB2aWV3XHJcblx0ICovXHJcblx0alF1ZXJ5KCAnLndwYmNfcmFkaW9fX3NldF9kYXlzX2N1c3RvbWl6ZV9wbHVnaW4nICkub24oJ2NoYW5nZScsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBpbnN0ICl7XHJcblx0XHR3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4oIGpRdWVyeSggdGhpcyApLnZhbCgpICk7XHJcblx0fSk7XHJcblxyXG5cclxuXHQvLyBSZS1sb2FkIFRvb2x0aXBzXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHRcdHdwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICsgJyAnICk7XHJcblx0XHR3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggd3BiY19hanhfY3VzdG9taXplX3BsdWdpbi5nZXRfb3RoZXJfcGFyYW0oICd0b29sYmFyX2NvbnRhaW5lcicgKSArICcgJyApO1xyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNob3cgaW5saW5lIG1vbnRoIHZpZXcgY2FsZW5kYXIgICAgICAgICAgICAgIHdpdGggYWxsIHByZWRlZmluZWQgQ1NTIChzaXplcyBhbmQgY2hlY2sgaW4vb3V0LCAgdGltZXMgY29udGFpbmVycylcclxuICogQHBhcmFtIHtvYmp9IGNhbGVuZGFyX3BhcmFtc19hcnJcclxuXHRcdFx0e1xyXG5cdFx0XHRcdCdyZXNvdXJjZV9pZCcgICAgICAgXHQ6IGFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHQnYWp4X25vbmNlX2NhbGVuZGFyJ1x0OiBhanhfZGF0YV9hcnIuYWp4X25vbmNlX2NhbGVuZGFyLFxyXG5cdFx0XHRcdCdhanhfZGF0YV9hcnInICAgICAgICAgIDogYWp4X2RhdGFfYXJyID0geyBhanhfYm9va2luZ19yZXNvdXJjZXM6W10sICByZXNvdXJjZV91bmF2YWlsYWJsZV9kYXRlczpbXSwgc2Vhc29uX2N1c3RvbWl6ZV9wbHVnaW46e30sLi4uLiB9XHJcblx0XHRcdFx0J2FqeF9jbGVhbmVkX3BhcmFtcycgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxlbmRhcl9fZGF5c19zZWxlY3Rpb25fbW9kZTogXCJkeW5hbWljXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX190aW1lc2xvdF9kYXlfYmdfYXNfYXZhaWxhYmxlOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxlbmRhcl9fdmlld19fY2VsbF9oZWlnaHQ6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNhbGVuZGFyX192aWV3X19tb250aHNfaW5fcm93OiA0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxlbmRhcl9fdmlld19fdmlzaWJsZV9tb250aHM6IDEyXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjYWxlbmRhcl9fdmlld19fd2lkdGg6IFwiMTAwJVwiXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF0ZXNfY3VzdG9taXplX3BsdWdpbjogXCJ1bmF2YWlsYWJsZVwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXRlc19zZWxlY3Rpb246IFwiMjAyMy0wMy0xNCB+IDIwMjMtMDMtMTZcIlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZG9fYWN0aW9uOiBcInNldF9jdXN0b21pemVfcGx1Z2luXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlc291cmNlX2lkOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1aV9jbGlja2VkX2VsZW1lbnRfaWQ6IFwid3BiY19jdXN0b21pemVfcGx1Z2luX2FwcGx5X2J0blwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1aV91c3JfX2N1c3RvbWl6ZV9wbHVnaW5fc2VsZWN0ZWRfdG9vbGJhcjogXCJpbmZvXCJcclxuXHRcdFx0XHRcdFx0XHRcdCAgXHRcdCB9XHJcblx0XHRcdH1cclxuKi9cclxuZnVuY3Rpb24gd3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fY2FsZW5kYXJfX3Nob3coIGNhbGVuZGFyX3BhcmFtc19hcnIgKXtcclxuXHJcblx0Ly8gVXBkYXRlIG5vbmNlXHJcblx0alF1ZXJ5KCAnI2FqeF9ub25jZV9jYWxlbmRhcl9zZWN0aW9uJyApLmh0bWwoIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X25vbmNlX2NhbGVuZGFyICk7XHJcblxyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFVwZGF0ZSBib29raW5nc1xyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PSB0eXBlb2YgKHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0pICl7IHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0gPSBbXTsgfVxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdzWyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkIF0gPSBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWyAnY2FsZW5kYXJfc2V0dGluZ3MnIF1bICdib29rZWRfZGF0ZXMnIF07XHJcblxyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gXHQvLyBHZXQgc2Nyb2xsaW5nIG1vbnRoICBvciB5ZWFyICBpbiBjYWxlbmRhciAgYW5kIHNhdmUgaXQgdG8gIHRoZSBpbml0IHBhcmFtZXRlcnNcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJ2JvZHknICkub2ZmKCAnd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2NoYW5nZWRfeWVhcl9tb250aCcgKTtcclxuXHRqUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19faW5saW5lX2Jvb2tpbmdfY2FsZW5kYXJfX2NoYW5nZWRfeWVhcl9tb250aCcsIGZ1bmN0aW9uICggZXZlbnQsIHllYXIsIG1vbnRoLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0d3BiY19hanhfY3VzdG9taXplX3BsdWdpbi5zZWFyY2hfc2V0X3BhcmFtKCAnY2FsZW5kYXJfX3N0YXJ0X3llYXInLCB5ZWFyICk7XHJcblx0XHR3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luLnNlYXJjaF9zZXRfcGFyYW0oICdjYWxlbmRhcl9fc3RhcnRfbW9udGgnLCBtb250aCApO1xyXG5cdH0gKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBEZWZpbmUgc2hvd2luZyBtb3VzZSBvdmVyIHRvb2x0aXAgb24gdW5hdmFpbGFibGUgZGF0ZXNcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2RhdGVwaWNrX2lubGluZV9jYWxlbmRhcl9yZWZyZXNoJywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIGluc3QgKXtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEl0J3MgZGVmaW5lZCwgd2hlbiBjYWxlbmRhciBSRUZSRVNIRUQgKGNoYW5nZSBtb250aHMgb3IgZGF5cyBzZWxlY3Rpb24pIGxvYWRlZCBpbiBqcXVlcnkuZGF0ZXBpY2sud3BiYy45LjAuanMgOlxyXG5cdFx0ICogXHRcdCQoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2RhdGVwaWNrX2lubGluZV9jYWxlbmRhcl9yZWZyZXNoJywgLi4uXHRcdC8vRml4SW46IDkuNC40LjEzXHJcblx0XHQgKi9cclxuXHJcblx0XHQvLyBpbnN0LmRwRGl2ICBpdCdzOiAgPGRpdiBjbGFzcz1cImRhdGVwaWNrLWlubGluZSBkYXRlcGljay1tdWx0aVwiIHN0eWxlPVwid2lkdGg6IDE3NzEycHg7XCI+Li4uLjwvZGl2PlxyXG5cclxuXHRcdGluc3QuZHBEaXYuZmluZCggJy5zZWFzb25fdW5hdmFpbGFibGUsLmJlZm9yZV9hZnRlcl91bmF2YWlsYWJsZSwud2Vla2RheXNfdW5hdmFpbGFibGUnICkub24oICdtb3VzZW92ZXInLCBmdW5jdGlvbiAoIHRoaXNfZXZlbnQgKXtcclxuXHRcdFx0Ly8gYWxzbyBhdmFpbGFibGUgdGhlc2UgdmFyczogXHRyZXNvdXJjZV9pZCwgakNhbENvbnRhaW5lciwgaW5zdFxyXG5cdFx0XHR2YXIgakNlbGwgPSBqUXVlcnkoIHRoaXNfZXZlbnQuY3VycmVudFRhcmdldCApO1xyXG5cdFx0XHR3cGJjX2NzdG1fX3Nob3dfdG9vbHRpcF9fZm9yX2VsZW1lbnQoIGpDZWxsLCBjYWxlbmRhcl9wYXJhbXNfYXJyWyAnYWp4X2RhdGFfYXJyJyBdWydwb3BvdmVyX2hpbnRzJ10gKTtcclxuXHRcdH0pO1xyXG5cclxuXHR9KTtcclxuXHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gIERlZmluZSBoZWlnaHQgb2YgdGhlIGNhbGVuZGFyICBjZWxscywgXHRhbmQgIG1vdXNlIG92ZXIgdG9vbHRpcHMgYXQgIHNvbWUgdW5hdmFpbGFibGUgZGF0ZXNcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2RhdGVwaWNrX2lubGluZV9jYWxlbmRhcl9sb2FkZWQnLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgakNhbENvbnRhaW5lciwgaW5zdCApe1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSXQncyBkZWZpbmVkLCB3aGVuIGNhbGVuZGFyIGxvYWRlZCBpbiBqcXVlcnkuZGF0ZXBpY2sud3BiYy45LjAuanMgOlxyXG5cdFx0ICogXHRcdCQoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2RhdGVwaWNrX2lubGluZV9jYWxlbmRhcl9sb2FkZWQnLCAuLi5cdFx0Ly9GaXhJbjogOS40LjQuMTJcclxuXHRcdCAqL1xyXG5cclxuXHRcdC8vIFJlbW92ZSBoaWdobGlnaHQgZGF5IGZvciB0b2RheSAgZGF0ZVxyXG5cdFx0alF1ZXJ5KCAnLmRhdGVwaWNrLWRheXMtY2VsbC5kYXRlcGljay10b2RheS5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1xyXG5cclxuXHRcdC8vIFNldCBoZWlnaHQgb2YgY2FsZW5kYXIgIGNlbGxzIGlmIGRlZmluZWQgdGhpcyBvcHRpb25cclxuXHRcdHZhciBzdHlsZXNoZWV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjLWNhbGVuZGFyLWNlbGwtaGVpZ2h0JyApO1xyXG5cdFx0aWYgKCBudWxsICE9PSBzdHlsZXNoZWV0ICl7XHJcblx0XHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAnJyAhPT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX2NlbGxfaGVpZ2h0ICl7XHJcblx0XHRcdGpRdWVyeSggJ2hlYWQnICkuYXBwZW5kKCAnPHN0eWxlIHR5cGU9XCJ0ZXh0L2Nzc1wiIGlkPVwid3BiYy1jYWxlbmRhci1jZWxsLWhlaWdodFwiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrICcuaGFzRGF0ZXBpY2sgLmRhdGVwaWNrLWlubGluZSAuZGF0ZXBpY2stdGl0bGUtcm93IHRoLCAnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnLmhhc0RhdGVwaWNrIC5kYXRlcGljay1pbmxpbmUgLmRhdGVwaWNrLWRheXMtY2VsbCB7J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KyAnaGVpZ2h0OiAnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX2NlbGxfaGVpZ2h0ICsgJyAhaW1wb3J0YW50OydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrICd9J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQrJzwvc3R5bGU+JyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIERlZmluZSBzaG93aW5nIG1vdXNlIG92ZXIgdG9vbHRpcCBvbiB1bmF2YWlsYWJsZSBkYXRlc1xyXG5cdFx0akNhbENvbnRhaW5lci5maW5kKCAnLnNlYXNvbl91bmF2YWlsYWJsZSwuYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlLC53ZWVrZGF5c191bmF2YWlsYWJsZScgKS5vbiggJ21vdXNlb3ZlcicsIGZ1bmN0aW9uICggdGhpc19ldmVudCApe1xyXG5cdFx0XHQvLyBhbHNvIGF2YWlsYWJsZSB0aGVzZSB2YXJzOiBcdHJlc291cmNlX2lkLCBqQ2FsQ29udGFpbmVyLCBpbnN0XHJcblx0XHRcdHZhciBqQ2VsbCA9IGpRdWVyeSggdGhpc19ldmVudC5jdXJyZW50VGFyZ2V0ICk7XHJcblx0XHRcdHdwYmNfY3N0bV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCggakNlbGwsIGNhbGVuZGFyX3BhcmFtc19hcnJbICdhanhfZGF0YV9hcnInIF1bJ3BvcG92ZXJfaGludHMnXSApO1xyXG5cdFx0fSk7XHJcblx0fSApO1xyXG5cclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBEZWZpbmUgbW9udGhzX2luX3Jvd1xyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0aWYgKCAgICggdW5kZWZpbmVkID09IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19tb250aHNfaW5fcm93IClcclxuXHRcdCAgICAgIHx8ICggJycgPT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX21vbnRoc19pbl9yb3cgKVxyXG5cdCl7XHJcblx0XHRjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdmlld19fbW9udGhzX2luX3JvdyA9IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRocztcclxuXHR9XHJcblx0XHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBEZWZpbmUgd2lkdGggb2YgZW50aXJlIGNhbGVuZGFyXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgd2lkdGggPSAgICcnO1x0XHRcdFx0XHQvLyB2YXIgd2lkdGggPSAnd2lkdGg6MTAwJTttYXgtd2lkdGg6MTAwJTsnO1xyXG5cdC8vIFdpZHRoXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LyogRml4SW46IDkuNy4zLjQgKi9cclxuXHRpZiAoICAgKCB1bmRlZmluZWQgIT0gY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3dpZHRoIClcclxuXHRcdCAgICAgICYmICggJycgIT09IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X193aWR0aCApXHJcblx0KXtcclxuXHRcdHdpZHRoICs9ICdtYXgtd2lkdGg6JyBcdCsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMuY2FsZW5kYXJfX3ZpZXdfX3dpZHRoICsgJzsnO1xyXG5cdFx0d2lkdGggKz0gJ3dpZHRoOjEwMCU7JztcclxuXHR9XHJcblxyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEFkZCBjYWxlbmRhciBjb250YWluZXI6IFwiQ2FsZW5kYXIgaXMgbG9hZGluZy4uLlwiICBhbmQgdGV4dGFyZWFcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJy53cGJjX2FqeF9jc3RtX19jYWxlbmRhcicgKS5odG1sKFxyXG5cclxuXHRcdCc8ZGl2IGNsYXNzPVwiJ1x0KyAnIGJrX2NhbGVuZGFyX2ZyYW1lJ1xyXG5cdFx0XHRcdFx0XHQrICcgbW9udGhzX251bV9pbl9yb3dfJyArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X19tb250aHNfaW5fcm93XHJcblx0XHRcdFx0XHRcdCsgJyBjYWxfbW9udGhfbnVtXycgXHQrIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLmNhbGVuZGFyX192aWV3X192aXNpYmxlX21vbnRoc1xyXG5cdFx0XHRcdFx0XHQrICcgJyBcdFx0XHRcdFx0KyBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5jYWxlbmRhcl9fdGltZXNsb3RfZGF5X2JnX2FzX2F2YWlsYWJsZSBcdFx0XHRcdC8vICd3cGJjX3RpbWVzbG90X2RheV9iZ19hc19hdmFpbGFibGUnIHx8ICcnXHJcblx0XHRcdFx0KyAnXCIgJ1xyXG5cdFx0XHQrICdzdHlsZT1cIicgKyB3aWR0aCArICdcIj4nXHJcblxyXG5cdFx0XHRcdCsgJzxkaXYgaWQ9XCJjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnXCI+JyArICdDYWxlbmRhciBpcyBsb2FkaW5nLi4uJyArICc8L2Rpdj4nXHJcblxyXG5cdFx0KyAnPC9kaXY+J1xyXG5cclxuXHRcdCsgJzx0ZXh0YXJlYSAgICAgIGlkPVwiZGF0ZV9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnXCInXHJcblx0XHRcdFx0XHQrICcgbmFtZT1cImRhdGVfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJ1wiJ1xyXG5cdFx0XHRcdFx0KyAnIGF1dG9jb21wbGV0ZT1cIm9mZlwiJ1xyXG5cdFx0XHRcdFx0KyAnIHN0eWxlPVwiZGlzcGxheTpub25lO3dpZHRoOjEwMCU7aGVpZ2h0OjEwZW07bWFyZ2luOjJlbSAwIDA7XCI+PC90ZXh0YXJlYT4nXHJcblx0KTtcclxuXHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRGVmaW5lIHZhcmlhYmxlcyBmb3IgY2FsZW5kYXJcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBjYWxfcGFyYW1fYXJyID0gIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLmNhbGVuZGFyX3NldHRpbmdzO1xyXG5cdGNhbF9wYXJhbV9hcnJbICdodG1sX2lkJyBdIFx0XHRcdFx0XHRcdD0gJ2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfY2xlYW5lZF9wYXJhbXMucmVzb3VyY2VfaWQ7XHJcblx0Y2FsX3BhcmFtX2FyclsgJ3RleHRfaWQnIF0gXHRcdFx0XHRcdFx0PSAnZGF0ZV9ib29raW5nJyBcdCArIGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2NsZWFuZWRfcGFyYW1zLnJlc291cmNlX2lkO1xyXG5cdGNhbF9wYXJhbV9hcnJbICdyZXNvdXJjZV9pZCcgXSBcdFx0XHRcdFx0PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9jbGVhbmVkX3BhcmFtcy5yZXNvdXJjZV9pZDtcclxuXHRjYWxfcGFyYW1fYXJyWyAnYWp4X25vbmNlX2NhbGVuZGFyJyBdIFx0XHRcdD0gY2FsZW5kYXJfcGFyYW1zX2Fyci5hanhfZGF0YV9hcnIuYWp4X25vbmNlX2NhbGVuZGFyO1xyXG5cdGNhbF9wYXJhbV9hcnJbICdzZWFzb25fY3VzdG9taXplX3BsdWdpbicgXSBcdFx0PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5zZWFzb25fY3VzdG9taXplX3BsdWdpbjtcclxuXHRjYWxfcGFyYW1fYXJyWyAncmVzb3VyY2VfdW5hdmFpbGFibGVfZGF0ZXMnIF0gXHQ9IGNhbGVuZGFyX3BhcmFtc19hcnIuYWp4X2RhdGFfYXJyLnJlc291cmNlX3VuYXZhaWxhYmxlX2RhdGVzO1xyXG5cdGNhbF9wYXJhbV9hcnJbICdwb3BvdmVyX2hpbnRzJyBdIFx0XHRcdFx0PSBjYWxlbmRhcl9wYXJhbXNfYXJyLmFqeF9kYXRhX2Fyci5wb3BvdmVyX2hpbnRzO1x0XHRcdFx0XHQvLyB7J3NlYXNvbl91bmF2YWlsYWJsZSc6Jy4uLicsJ3dlZWtkYXlzX3VuYXZhaWxhYmxlJzonLi4uJywnYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJzonLi4uJyx9XHJcblxyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNob3cgQ2FsZW5kYXJcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHdwYmNfc2hvd19pbmxpbmVfYm9va2luZ19jYWxlbmRhciggY2FsX3BhcmFtX2FyciApO1xyXG5cclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTY3JvbGwgIHRvICBzcGVjaWZpYyBZZWFyIGFuZCBNb250aCwgIGlmIGRlZmluZWQgaW4gaW5pdCBwYXJhbWV0ZXJzXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgc195ZWFyICA9IHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4uc2VhcmNoX2dldF9wYXJhbSggJ2NhbGVuZGFyX19zdGFydF95ZWFyJyApO1xyXG5cdHZhciBzX21vbnRoID0gd3BiY19hanhfY3VzdG9taXplX3BsdWdpbi5zZWFyY2hfZ2V0X3BhcmFtKCAnY2FsZW5kYXJfX3N0YXJ0X21vbnRoJyApO1xyXG5cdGlmICggKCAwICE9PSBzX3llYXIgKSAmJiAoIDAgIT09IHNfbW9udGggKSApe1xyXG5cdFx0IHdwYmNfX2lubGluZV9ib29raW5nX2NhbGVuZGFyX19jaGFuZ2VfeWVhcl9tb250aCggY2FsX3BhcmFtX2FyclsgJ3Jlc291cmNlX2lkJyBdLCBzX3llYXIsIHNfbW9udGggKVxyXG5cdH1cclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogICBUb29sdGlwcyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgc2hvd2luZyB0b29sdGlwLCAgd2hlbiAgbW91c2Ugb3ZlciBvbiAgU0VMRUNUQUJMRSAoYXZhaWxhYmxlLCBwZW5kaW5nLCBhcHByb3ZlZCwgcmVzb3VyY2UgdW5hdmFpbGFibGUpLCAgZGF5c1xyXG5cdCAqIENhbiBiZSBjYWxsZWQgZGlyZWN0bHkgIGZyb20gIGRhdGVwaWNrIGluaXQgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gdmFsdWVcclxuXHQgKiBAcGFyYW0gZGF0ZVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NzdG1fX3ByZXBhcmVfdG9vbHRpcF9faW5fY2FsZW5kYXIoIHZhbHVlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0aWYgKCBudWxsID09IGRhdGUgKXsgIHJldHVybiBmYWxzZTsgIH1cclxuXHJcblx0XHR2YXIgdGRfY2xhc3MgPSAoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1xyXG5cclxuXHRcdHZhciBqQ2VsbCA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3BhcmFtc19hcnIucmVzb3VyY2VfaWQgKyAnIHRkLmNhbDRkYXRlLScgKyB0ZF9jbGFzcyApO1xyXG5cclxuXHRcdHdwYmNfY3N0bV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCggakNlbGwsIGNhbGVuZGFyX3BhcmFtc19hcnJbICdwb3BvdmVyX2hpbnRzJyBdICk7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdG9vbHRpcCAgZm9yIHNob3dpbmcgb24gVU5BVkFJTEFCTEUgZGF5cyAoc2Vhc29uLCB3ZWVrZGF5LCB0b2RheV9kZXBlbmRzIHVuYXZhaWxhYmxlKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpDZWxsXHRcdFx0XHRcdGpRdWVyeSBvZiBzcGVjaWZpYyBkYXkgY2VsbFxyXG5cdCAqIEBwYXJhbSBwb3BvdmVyX2hpbnRzXHRcdCAgICBBcnJheSB3aXRoIHRvb2x0aXAgaGludCB0ZXh0c1x0IDogeydzZWFzb25fdW5hdmFpbGFibGUnOicuLi4nLCd3ZWVrZGF5c191bmF2YWlsYWJsZSc6Jy4uLicsJ2JlZm9yZV9hZnRlcl91bmF2YWlsYWJsZSc6Jy4uLicsfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY3N0bV9fc2hvd190b29sdGlwX19mb3JfZWxlbWVudCggakNlbGwsIHBvcG92ZXJfaGludHMgKXtcclxuXHJcblx0XHR2YXIgdG9vbHRpcF90aW1lID0gJyc7XHJcblxyXG5cdFx0aWYgKCBqQ2VsbC5oYXNDbGFzcyggJ3NlYXNvbl91bmF2YWlsYWJsZScgKSApe1xyXG5cdFx0XHR0b29sdGlwX3RpbWUgPSBwb3BvdmVyX2hpbnRzWyAnc2Vhc29uX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fSBlbHNlIGlmICggakNlbGwuaGFzQ2xhc3MoICd3ZWVrZGF5c191bmF2YWlsYWJsZScgKSApe1xyXG5cdFx0XHR0b29sdGlwX3RpbWUgPSBwb3BvdmVyX2hpbnRzWyAnd2Vla2RheXNfdW5hdmFpbGFibGUnIF07XHJcblx0XHR9IGVsc2UgaWYgKCBqQ2VsbC5oYXNDbGFzcyggJ2JlZm9yZV9hZnRlcl91bmF2YWlsYWJsZScgKSApe1xyXG5cdFx0XHR0b29sdGlwX3RpbWUgPSBwb3BvdmVyX2hpbnRzWyAnYmVmb3JlX2FmdGVyX3VuYXZhaWxhYmxlJyBdO1xyXG5cdFx0fSBlbHNlIGlmICggakNlbGwuaGFzQ2xhc3MoICdkYXRlMmFwcHJvdmUnICkgKXtcclxuXHJcblx0XHR9IGVsc2UgaWYgKCBqQ2VsbC5oYXNDbGFzcyggJ2RhdGVfYXBwcm92ZWQnICkgKXtcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdH1cclxuXHJcblx0XHRqQ2VsbC5hdHRyKCAnZGF0YS1jb250ZW50JywgdG9vbHRpcF90aW1lICk7XHJcblxyXG5cdFx0dmFyIHRkX2VsID0gakNlbGwuZ2V0KDApO1x0Ly9qUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9wYXJhbXNfYXJyLnJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKS5nZXQoMCk7XHJcblxyXG5cdFx0aWYgKCAoIHVuZGVmaW5lZCA9PSB0ZF9lbC5fdGlwcHkgKSAmJiAoICcnICE9IHRvb2x0aXBfdGltZSApICl7XHJcblxyXG5cdFx0XHRcdHdwYmNfdGlwcHkoIHRkX2VsICwge1xyXG5cdFx0XHRcdFx0Y29udGVudCggcmVmZXJlbmNlICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgcG9wb3Zlcl9jb250ZW50ID0gcmVmZXJlbmNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29udGVudCcgKTtcclxuXHJcblx0XHRcdFx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cInBvcG92ZXIgcG9wb3Zlcl90aXBweVwiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0KyAnPGRpdiBjbGFzcz1cInBvcG92ZXItY29udGVudFwiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrIHBvcG92ZXJfY29udGVudFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQrICc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0ICsgJzwvZGl2Pic7XHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0YWxsb3dIVE1MICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHR0cmlnZ2VyXHRcdFx0IDogJ21vdXNlZW50ZXIgZm9jdXMnLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmUgICAgICA6ICEgdHJ1ZSxcclxuXHRcdFx0XHRcdGhpZGVPbkNsaWNrICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmVCb3JkZXI6IDEwLFxyXG5cdFx0XHRcdFx0bWF4V2lkdGggICAgICAgICA6IDU1MCxcclxuXHRcdFx0XHRcdHRoZW1lICAgICAgICAgICAgOiAnd3BiYy10aXBweS10aW1lcycsXHJcblx0XHRcdFx0XHRwbGFjZW1lbnQgICAgICAgIDogJ3RvcCcsXHJcblx0XHRcdFx0XHRkZWxheVx0XHRcdCA6IFs0MDAsIDBdLFx0XHRcdC8vRml4SW46IDkuNC4yLjJcclxuXHRcdFx0XHRcdGlnbm9yZUF0dHJpYnV0ZXMgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dG91Y2hcdFx0XHQgOiB0cnVlLFx0XHRcdFx0Ly9bJ2hvbGQnLCA1MDBdLCAvLyA1MDBtcyBkZWxheVx0XHRcdC8vRml4SW46IDkuMi4xLjVcclxuXHRcdFx0XHRcdGFwcGVuZFRvOiAoKSA9PiBkb2N1bWVudC5ib2R5LFxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBBamF4ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggc2hvdyByZXF1ZXN0XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19hamF4X3JlcXVlc3QoKXtcclxuXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9DVVNUT01JWkVfUExVR0lOJyApOyBjb25zb2xlLmxvZyggJyA9PSBCZWZvcmUgQWpheCBTZW5kIC0gc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgPT0gJyAsIHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4uc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgKTtcclxuXHJcblx0d3BiY19jdXN0b21pemVfcGx1Z2luX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKTtcclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9DVVNUT01JWkVfUExVR0lOJyxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X3VzZXJfaWQ6IHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4uZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luLmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X2xvY2FsZSA6IHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4uZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSxcclxuXHJcblx0XHRcdFx0XHRzZWFyY2hfcGFyYW1zXHQ6IHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4uc2VhcmNoX2dldF9hbGxfcGFyYW1zKClcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuXHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0NVU1RPTUlaRV9QTFVHSU4gPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19hY3R1YWxfY29udGVudF9faGlkZSgpO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGEgKTtcclxuXHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBSZWxvYWQgcGFnZSwgYWZ0ZXIgZmlsdGVyIHRvb2xiYXIgaGFzIGJlZW4gcmVzZXRcclxuXHRcdFx0XHRcdGlmICggICAgICAgKCAgICAgdW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0pXHJcblx0XHRcdFx0XHRcdFx0JiYgKCAncmVzZXRfZG9uZScgPT09IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICdkb19hY3Rpb24nIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRsb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgbGlzdGluZ1xyXG5cdFx0XHRcdFx0d3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fcGFnZV9jb250ZW50X19zaG93KCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXSAsIHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvL3dwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX2RlZmluZV91aV9ob29rcygpO1x0XHRcdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzLCBiZWNhdXNlIHdlIHNob3cgbmV3IERPTSBlbGVtZW50c1xyXG5cdFx0XHRcdFx0aWYgKCAnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICkgKXtcclxuXHRcdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICggJzEnID09IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0JyBdICkgPyAnc3VjY2VzcycgOiAnZXJyb3InXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfY3VzdG9taXplX3BsdWdpbl9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblx0XHRcdFx0XHQvLyBSZW1vdmUgc3BpbiBpY29uIGZyb20gIGJ1dHRvbiBhbmQgRW5hYmxlIHRoaXMgYnV0dG9uLlxyXG5cdFx0XHRcdFx0d3BiY19idXR0b25fX3JlbW92ZV9zcGluKCByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdIClcclxuXHJcblx0XHRcdFx0XHRqUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnICg8Yj4nICsganFYSFIuc3RhdHVzICsgJzwvYj4pJztcclxuXHRcdFx0XHRcdFx0aWYgKDQwMyA9PSBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgUHJvYmFibHkgbm9uY2UgZm9yIHRoaXMgcGFnZSBoYXMgYmVlbiBleHBpcmVkLiBQbGVhc2UgPGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIG9uY2xpY2s9XCJqYXZhc2NyaXB0OmxvY2F0aW9uLnJlbG9hZCgpO1wiPnJlbG9hZCB0aGUgcGFnZTwvYT4uJztcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5yZXNwb25zZVRleHQgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnICcgKyBqcVhIUi5yZXNwb25zZVRleHQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19hY3R1YWxfY29udGVudF9faGlkZSgpO1xyXG5cdFx0XHRcdFx0d3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICk7XHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcblxyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEggbyBvIGsgcyAgLSAgaXRzIEFjdGlvbi9UaW1lcyB3aGVuIG5lZWQgdG8gcmUtUmVuZGVyIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBTZWFyY2ggUmVxdWVzdCBhZnRlciBVcGRhdGluZyBzZWFyY2ggcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXNfYXJyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0Ly9jb25zb2xlLmxvZyggJ1JlcXVlc3QgZm9yOiAnLCBwX2tleSwgcF92YWwgKTtcclxuXHRcdHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4uc2VhcmNoX3NldF9wYXJhbSggcF9rZXksIHBfdmFsICk7XHJcblx0fSk7XHJcblxyXG5cdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHJcblx0d3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fYWpheF9yZXF1ZXN0KCk7XHJcbn1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlYXJjaCByZXF1ZXN0IGZvciBcIlBhZ2UgTnVtYmVyXCJcclxuXHQgKiBAcGFyYW0gcGFnZV9udW1iZXJcdGludFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX3BhZ2luYXRpb25fY2xpY2soIHBhZ2VfbnVtYmVyICl7XHJcblxyXG5cdFx0d3BiY19hanhfY3VzdG9taXplX3BsdWdpbl9fc2VuZF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nOiBwYWdlX251bWJlclxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFNob3cgLyBIaWRlIENvbnRlbnQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqICBTaG93IExpc3RpbmcgQ29udGVudCBcdC0gXHRTZW5kaW5nIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19hY3R1YWxfY29udGVudF9fc2hvdygpe1xyXG5cclxuXHR3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19hamF4X3JlcXVlc3QoKTtcdFx0XHQvLyBTZW5kIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkIGluIFwid3BiY19hanhfYm9va2luZ19saXN0aW5nXCIgT2JqLlxyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBMaXN0aW5nIENvbnRlbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX2FjdHVhbF9jb250ZW50X19oaWRlKCl7XHJcblxyXG5cdGpRdWVyeSggIHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW4uZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgICkuaHRtbCggJycgKTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBNIGUgcyBzIGEgZyBlICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKlxyXG4gKi9cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIFNob3cgbWVzc2FnZSBpbiBjb250ZW50XHJcbiAqXHJcbiAqIEBwYXJhbSBtZXNzYWdlXHRcdFx0XHRNZXNzYWdlIEhUTUxcclxuICogQHBhcmFtIHBhcmFtcyA9IHtcclxuICogICAgICAgICAgICAgICAgICAgWyd0eXBlJ11cdFx0XHRcdCd3YXJuaW5nJyB8ICdpbmZvJyB8ICdlcnJvcicgfCAnc3VjY2VzcydcdFx0ZGVmYXVsdDogJ3dhcm5pbmcnXHJcbiAqICAgICAgICAgICAgICAgICAgIFsnY29udGFpbmVyJ11cdFx0XHQnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fbGVmdCdcdFx0ZGVmYXVsdDogd3BiY19hanhfY3VzdG9taXplX3BsdWdpbi5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKVxyXG4gKiAgICAgICAgICAgICAgICAgICBbJ2lzX2FwcGVuZCddXHRcdFx0dHJ1ZSB8IGZhbHNlXHRcdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxyXG4gKlx0XHRcdFx0ICAgfVxyXG4gKiBFeGFtcGxlOlxyXG4gKiBcdFx0XHR2YXIgaHRtbF9pZCA9IHdwYmNfYWp4X2N1c3RvbWl6ZV9wbHVnaW5fX3Nob3dfbWVzc2FnZSggJ1lvdSBjYW4gdGVzdCBkYXlzIHNlbGVjdGlvbiBpbiBjYWxlbmRhcicsICdpbmZvJywgJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX2xlZnQnLCB0cnVlICk7XHJcbiAqXHJcbiAqXHJcbiAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9jdXN0b21pemVfcGx1Z2luX19zaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHBhcmFtcyA9IHt9ICl7XHJcblxyXG5cdHZhciBwYXJhbXNfZGVmYXVsdCA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHQnY29udGFpbmVyJzogd3BiY19hanhfY3VzdG9taXplX3BsdWdpbi5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSxcclxuXHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRfLmVhY2goIHBhcmFtcywgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApe1xyXG5cdFx0cGFyYW1zX2RlZmF1bHRbIHBfa2V5IF0gPSBwX3ZhbDtcclxuXHR9ICk7XHJcblx0cGFyYW1zID0gcGFyYW1zX2RlZmF1bHQ7XHJcblxyXG4gICAgdmFyIHVuaXF1ZV9kaXZfaWQgPSBuZXcgRGF0ZSgpO1xyXG4gICAgdW5pcXVlX2Rpdl9pZCA9ICd3cGJjX25vdGljZV8nICsgdW5pcXVlX2Rpdl9pZC5nZXRUaW1lKCk7XHJcblxyXG5cdHZhciBhbGVydF9jbGFzcyA9ICdub3RpY2UgJztcclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdlcnJvcicgKXtcclxuXHRcdGFsZXJ0X2NsYXNzICs9ICdub3RpY2UtZXJyb3IgJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDAuNWVtO2NvbG9yOiAjZDYzNjM4O1wiIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fcmVwb3J0X2dtYWlsZXJyb3JyZWRcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ3dhcm5pbmcnICl7XHJcblx0XHRhbGVydF9jbGFzcyArPSAnbm90aWNlLXdhcm5pbmcgJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDAuNWVtO2NvbG9yOiAjZTlhYTA0O1wiIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fd2FybmluZ1wiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnaW5mbycgKXtcclxuXHRcdGFsZXJ0X2NsYXNzICs9ICdub3RpY2UtaW5mbyAnO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdzdWNjZXNzJyApe1xyXG5cdFx0YWxlcnRfY2xhc3MgKz0gJ25vdGljZS1pbmZvIGFsZXJ0LXN1Y2Nlc3MgdXBkYXRlZCAnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBzdHlsZT1cIm1hcmdpbi1yaWdodDogMC41ZW07Y29sb3I6ICM2NGFhNDU7XCIgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9kb25lX291dGxpbmVcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cclxuXHRtZXNzYWdlID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdcIiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlICcgKyBhbGVydF9jbGFzcyArICdcIiBzdHlsZT1cIicgKyBwYXJhbXNbICdzdHlsZScgXSArICdcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nO1xyXG5cclxuXHRpZiAoIHBhcmFtc1snaXNfYXBwZW5kJ10gKXtcclxuXHRcdGpRdWVyeSggcGFyYW1zWydjb250YWluZXInXSApLmFwcGVuZCggbWVzc2FnZSApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoIHBhcmFtc1snY29udGFpbmVyJ10gKS5odG1sKCBtZXNzYWdlICk7XHJcblx0fVxyXG5cclxuXHRwYXJhbXNbJ2RlbGF5J10gPSBwYXJzZUludCggcGFyYW1zWydkZWxheSddICk7XHJcblx0aWYgKCBwYXJhbXNbJ2RlbGF5J10gPiAwICl7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkuZmFkZU91dCggMTUwMCApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBwYXJhbXNbICdkZWxheScgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdW5pcXVlX2Rpdl9pZDtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBCdXR0b25zICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgU3RhcnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY3VzdG9taXplX3BsdWdpbl9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCl7XHJcblx0alF1ZXJ5KCAnI3dwYmNfY3VzdG9taXplX3BsdWdpbl9yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJykucmVtb3ZlQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBQYXVzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jdXN0b21pemVfcGx1Z2luX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKXtcclxuXHRqUXVlcnkoICcjd3BiY19jdXN0b21pemVfcGx1Z2luX3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuYWRkQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBpcyBTcGlubmluZyA/XHJcbiAqXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jdXN0b21pemVfcGx1Z2luX3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKXtcclxuICAgIGlmICggalF1ZXJ5KCAnI3dwYmNfY3VzdG9taXplX3BsdWdpbl9yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmhhc0NsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICkgKXtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59XHJcbiJdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWTs7QUFFWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBSkEsU0FBQUEsUUFBQUMsR0FBQSxzQ0FBQUQsT0FBQSx3QkFBQUUsTUFBQSx1QkFBQUEsTUFBQSxDQUFBQyxRQUFBLGFBQUFGLEdBQUEsa0JBQUFBLEdBQUEsZ0JBQUFBLEdBQUEsV0FBQUEsR0FBQSx5QkFBQUMsTUFBQSxJQUFBRCxHQUFBLENBQUFHLFdBQUEsS0FBQUYsTUFBQSxJQUFBRCxHQUFBLEtBQUFDLE1BQUEsQ0FBQUcsU0FBQSxxQkFBQUosR0FBQSxLQUFBRCxPQUFBLENBQUFDLEdBQUE7QUFNQSxJQUFJSyx5QkFBeUIsR0FBSSxVQUFXTCxHQUFHLEVBQUVNLENBQUMsRUFBRTtFQUVuRDtFQUNBLElBQUlDLFFBQVEsR0FBR1AsR0FBRyxDQUFDUSxZQUFZLEdBQUdSLEdBQUcsQ0FBQ1EsWUFBWSxJQUFJO0lBQ3hDQyxPQUFPLEVBQUUsQ0FBQztJQUNWQyxLQUFLLEVBQUksRUFBRTtJQUNYQyxNQUFNLEVBQUc7RUFDUixDQUFDO0VBRWhCWCxHQUFHLENBQUNZLGdCQUFnQixHQUFHLFVBQVdDLFNBQVMsRUFBRUMsU0FBUyxFQUFHO0lBQ3hEUCxRQUFRLENBQUVNLFNBQVMsQ0FBRSxHQUFHQyxTQUFTO0VBQ2xDLENBQUM7RUFFRGQsR0FBRyxDQUFDZSxnQkFBZ0IsR0FBRyxVQUFXRixTQUFTLEVBQUc7SUFDN0MsT0FBT04sUUFBUSxDQUFFTSxTQUFTLENBQUU7RUFDN0IsQ0FBQzs7RUFHRDtFQUNBLElBQUlH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
