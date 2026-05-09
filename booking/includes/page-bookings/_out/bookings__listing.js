"use strict";

jQuery('body').on({
  'touchmove': function (e) {
    jQuery('.timespartly').each(function (index) {
      var td_el = jQuery(this).get(0);
      if (undefined != td_el._tippy) {
        var instance = td_el._tippy;
        instance.hide();
      }
    });
  }
});

/**
 * Request Object
 * Here we can  define Search parameters and Update it later,  when  some parameter was changed
 *
 */
var wpbc_ajx_booking_listing = function (obj, $) {
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
    sort: "booking_id",
    sort_type: "DESC",
    page_num: 1,
    page_items_count: 10,
    create_date: "",
    keyword: "",
    source: ""
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
}(wpbc_ajx_booking_listing || {}, jQuery);

/**
 *   Ajax  ------------------------------------------------------------------------------------------------------ */

/**
 * Send Ajax search request
 * for searching specific Keyword and other params
 */
function wpbc_ajx_booking_ajax_search_request() {
  console.groupCollapsed('AJX_BOOKING_LISTING');
  console.log(' == Before Ajax Send - search_get_all_params() == ', wpbc_ajx_booking_listing.search_get_all_params());
  wpbc_booking_listing_reload_button__spin_start();
  wpbc_booking_listing_reload__message_show();

  /*
  //FixIn: forVideo
  if ( ! is_this_action ){
  	//wpbc_ajx_booking__actual_listing__hide();
  	jQuery( wpbc_ajx_booking_listing.get_other_param( 'listing_container' ) ).html(
  		'<div style="width:100%;text-align: center;" id="wpbc_loading_section"><span class="wpbc_icn_autorenew wpbc_spin"></span></div>'
  		+ jQuery( wpbc_ajx_booking_listing.get_other_param( 'listing_container' ) ).html()
  	);
  	if ( 'function' === typeof (jQuery( '#wpbc_loading_section' ).wpbc_my_modal) ){			// FixIn: 9.0.1.5.
  		jQuery( '#wpbc_loading_section' ).wpbc_my_modal( 'show' );
  	} else {
  		alert( 'Warning! Booking Calendar. Its seems that  you have deactivated loading of Bootstrap JS files at Booking Settings General page in Advanced section.' )
  	}
  }
  is_this_action = false;
  */
  // Start Ajax
  jQuery.post(wpbc_url_ajax, {
    action: 'WPBC_AJX_BOOKING_LISTING',
    wpbc_ajx_user_id: wpbc_ajx_booking_listing.get_secure_param('user_id'),
    nonce: wpbc_ajx_booking_listing.get_secure_param('nonce'),
    wpbc_ajx_locale: wpbc_ajx_booking_listing.get_secure_param('locale'),
    search_params: wpbc_ajx_booking_listing.search_get_all_params()
  },
  /**
   * S u c c e s s
   *
   * @param response_data		-	its object returned from  Ajax - class-live-searcg.php
   * @param textStatus		-	'success'
   * @param jqXHR				-	Object
   */
  function (response_data, textStatus, jqXHR) {
    //FixIn: forVideo
    //jQuery( '#wpbc_loading_section' ).wpbc_my_modal( 'hide' );

    try {
      console.log(' == Response WPBC_AJX_BOOKING_LISTING == ', response_data);
      console.groupEnd();
      // Probably Error
      if (typeof response_data !== 'object' || response_data === null) {
        jQuery('.wpbc_ajx_under_toolbar_row').hide(); // FixIn: 9.6.1.5.
        wpbc_booking_listing_reload_button__spin_pause();
        wpbc_booking_listing_reload__message_hide();
        jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html('<div class="wpbc-settings-notice notice-warning" style="text-align:left">' + response_data + '</div>');
        return;
      }

      // Reload page, after filter toolbar was reseted
      if (undefined != response_data['ajx_cleaned_params'] && 'reset_done' === response_data['ajx_cleaned_params']['ui_reset']) {
        wpbc_booking_listing_reload__message_hide();
        window.location.href = response_data['ajx_cleaned_params']['ui_reset_url'];
        // location.reload();
        return;
      }

      // Show listing
      if (response_data['ajx_count'] > 0) {
        wpbc_ajx_booking_show_listing(response_data['ajx_items'], response_data['ajx_search_params'], response_data['ajx_booking_resources']);
        wpbc_pagination_echo(wpbc_ajx_booking_listing.get_other_param('pagination_container'), wpbc_ajx_booking_listing.get_other_param('pagination_container_header'), wpbc_ajx_booking_listing.get_other_param('pagination_container_footer'), {
          'page_active': response_data['ajx_search_params']['page_num'],
          'pages_count': Math.ceil(response_data['ajx_count'] / response_data['ajx_search_params']['page_items_count']),
          'page_items_count': response_data['ajx_search_params']['page_items_count'],
          'sort_type': response_data['ajx_search_params']['sort_type'],
          'total_count': response_data['ajx_count']
        });
        wpbc_ajx_booking_define_ui_hooks(); // Redefine Hooks, because we show new DOM elements
      } else {
        wpbc_ajx_booking__actual_listing__hide();
        jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html('<div class="wpbc-settings-notice0 notice-warning0" style="text-align:center;font-size: 15px;margin: 2em 0;">' + '<p><strong>No results found for current filter options...</strong></p>' + '<p><strong><a  href="javascript:void(0)" ' + ' onclick="javascript:wpbc_ajx_booking_send_search_request_with_params( {' + ' \'ui_reset\': \'make_reset\', ' + ' \'page_num\': 1 ' + '} );">Reset filters</a> to show all bookings.</strong></p>' + '</div>');
      }

      // Update new booking count
      if (undefined !== response_data['ajx_new_bookings_count']) {
        var ajx_new_bookings_count = parseInt(response_data['ajx_new_bookings_count']);
        if (ajx_new_bookings_count > 0) {
          jQuery('.wpbc_badge_count').show();
        }
        jQuery('.bk-update-count').html(ajx_new_bookings_count);
      }
      wpbc_booking_listing_reload_button__spin_pause();
      wpbc_booking_listing_reload__message_hide();
      jQuery('#ajax_respond').html(response_data); // For ability to show response, add such DIV element to page
    } finally {
      wpbc_booking_listing_reload_button__spin_pause();
      wpbc_booking_listing_reload__message_hide();
    }
  }).fail(function (jqXHR, textStatus, errorThrown) {
    if (window.console && window.console.log) {
      console.log('Ajax_Error', jqXHR, textStatus, errorThrown);
    }
    jQuery('.wpbc_ajx_under_toolbar_row').hide(); // FixIn: 9.6.1.5.
    wpbc_booking_listing_reload_button__spin_pause();
    wpbc_booking_listing_reload__message_hide();
    var error_message = '<strong>' + 'Error!' + '</strong> ' + errorThrown;
    if (jqXHR.responseText) {
      error_message += jqXHR.responseText;
    }
    error_message = error_message.replace(/\n/g, "<br />");
    wpbc_ajx_booking_show_message(error_message);
  })
  // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
  ; // End Ajax
}

/**
 *   Views  ----------------------------------------------------------------------------------------------------- */

/**
 * Show Listing Table 		and define gMail checkbox hooks
 *
 * @param json_items_arr		- JSON object with Items
 * @param json_search_params	- JSON object with Search
 */
function wpbc_ajx_booking_show_listing(json_items_arr, json_search_params, json_booking_resources) {
  wpbc_ajx_define_templates__resource_manipulation(json_items_arr, json_search_params, json_booking_resources);

  //console.log( 'json_items_arr' , json_items_arr, json_search_params );
  jQuery('.wpbc_ajx_under_toolbar_row').css("display", "flex"); // FixIn: 9.6.1.5.
  var list_header_tpl = wp.template('wpbc_ajx_booking_list_header');
  var list_footer_tpl = wp.template('wpbc_ajx_booking_list_footer');
  var list_row_tpl = wp.template('wpbc_ajx_booking_list_row');

  // Header.
  jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html(list_header_tpl());
  // Send to template all request params: jQuery( wpbc_ajx_booking_listing.get_other_param( 'listing_container' ) ).html( list_header_tpl(wpbc_ajx_booking_listing.search_get_all_params()) );
  // Body.
  jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).append('<div class="wpbc_selectable_body"></div>');
  // Footer.
  jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).append(list_footer_tpl());

  // R o w s
  console.groupCollapsed('LISTING_ROWS'); // LISTING_ROWS
  _.each(json_items_arr, function (p_val, p_key, p_data) {
    if ('undefined' !== typeof json_search_params['keyword']) {
      // Parameter for marking keyword with different color in a list
      p_val['__search_request_keyword__'] = json_search_params['keyword'];
    } else {
      p_val['__search_request_keyword__'] = '';
    }
    p_val['booking_resources'] = json_booking_resources;
    jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container') + ' .wpbc_selectable_body').append(list_row_tpl(p_val));
  });
  console.groupEnd(); // LISTING_ROWS

  wpbc_define_gmail_checkbox_selection(jQuery); // Redefine Hooks for clicking at Checkboxes
}

/**
 * Define template for changing booking resources &  update it each time,  when  listing updating, useful  for showing actual  booking resources.
 *
 * @param json_items_arr		- JSON object with Items
 * @param json_search_params	- JSON object with Search
 * @param json_booking_resources	- JSON object with Resources
 */
function wpbc_ajx_define_templates__resource_manipulation(json_items_arr, json_search_params, json_booking_resources) {
  // -------------------------------------------------------------------------------------------------------------
  // New. 2025-04-21.
  // -------------------------------------------------------------------------------------------------------------
  // Change booking resource in Modal.
  var modal__change_booking_resource = wp.template('wpbc_ajx__modal__change_booking_resource');
  jQuery('#section_in_in_modal__change_booking_resource').html(modal__change_booking_resource({
    'ajx_search_params': json_search_params,
    'ajx_booking_resources': json_booking_resources
  }));

  // Duplicate booking into another resource in Modal. New. 2025-04-21.
  var modal__duplicate_booking_to_other_resource = wp.template('wpbc_ajx__modal__duplicate_booking_to_other_resource');
  jQuery('#section_in_in_modal__duplicate_booking_to_other_resource').html(modal__duplicate_booking_to_other_resource({
    'ajx_search_params': json_search_params,
    'ajx_booking_resources': json_booking_resources
  }));
  // -------------------------------------------------------------------------------------------------------------
}

/**
 * Show just message instead of listing and hide pagination
 */
function wpbc_ajx_booking_show_message(message) {
  wpbc_ajx_booking__actual_listing__hide();
  jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html('<div class="wpbc-settings-notice notice-warning" style="text-align:left">' + message + '</div>');
}

/**
 *   H o o k s  -  its Action/Times when need to re-Render Views  ----------------------------------------------- */

/**
 * Send Ajax Search Request after Updating search request parameters
 *
 * @param params_arr
 */
function wpbc_ajx_booking_send_search_request_with_params(params_arr) {
  // Define different Search  parameters for request
  _.each(params_arr, function (p_val, p_key, p_data) {
    //console.log( 'Request for: ', p_key, p_val );
    wpbc_ajx_booking_listing.search_set_param(p_key, p_val);
  });

  // Send Ajax Request
  wpbc_ajx_booking_ajax_search_request();
}

/**
 * Search request for "Page Number"
 * @param page_number	int
 */
function wpbc_ajx_booking_pagination_click(page_number) {
  wpbc_ajx_booking_send_search_request_with_params({
    'page_num': page_number
  });
}

/**
 *   Keyword Searching  ----------------------------------------------------------------------------------------- */

/**
 * Search request for "Keyword", also set current page to  1
 *
 * @param element_id	-	HTML ID  of element,  where was entered keyword
 */
function wpbc_ajx_booking_send_search_request_for_keyword(element_id) {
  // We need to Reset page_num to 1 with each new search, because we can be at page #4,  but after  new search  we can  have totally  only  1 page
  wpbc_ajx_booking_send_search_request_with_params({
    'keyword': jQuery(element_id).val(),
    'page_num': 1
  });
}

/**
 * Send search request after few seconds (usually after 1,5 sec)
 * Closure function. Its useful,  for do  not send too many Ajax requests, when someone make fast typing.
 */
var wpbc_ajx_booking_searching_after_few_seconds = function () {
  var closed_timer = 0;
  return function (element_id, timer_delay) {
    // Get default value of "timer_delay",  if parameter was not passed into the function.
    timer_delay = typeof timer_delay !== 'undefined' ? timer_delay : 1500;
    clearTimeout(closed_timer); // Clear previous timer

    // Start new Timer
    closed_timer = setTimeout(wpbc_ajx_booking_send_search_request_for_keyword.bind(null, element_id), timer_delay);
  };
}();

/**
 *   Define Dynamic Hooks  (like pagination click, which renew each time with new listing showing)  ------------- */

/**
 * Define HTML ui Hooks: on KeyUp | Change | -> Sort Order & Number Items / Page
 * We are hcnaged it each  time, when showing new listing, because DOM elements chnaged
 */
function wpbc_ajx_booking_define_ui_hooks() {
  if ('function' === typeof wpbc_define_tippy_tooltips) {
    wpbc_define_tippy_tooltips('.wpbc__list__table ');
  }
  wpbc_ajx_booking__ui_define__locale();
  wpbc_ajx_booking__ui_define__remark();
  wpbc_boo_listing__init_hook__sort_by();

  // Items Per Page.
  jQuery('.wpbc_items_per_page').on('change', function (event) {
    wpbc_ajx_booking_send_search_request_with_params({
      'page_items_count': jQuery(this).val(),
      'page_num': 1
    });
  });

  // Sorting.
  jQuery('.wpbc_items_sort_type').on('change', function (event) {
    wpbc_ajx_booking_send_search_request_with_params({
      'sort_type': jQuery(this).val()
    });
  });
}

/**
 *   Show / Hide Listing  --------------------------------------------------------------------------------------- */

/**
 *  Show Listing Table 	- 	Sending Ajax Request	-	with parameters that  we early  defined in "wpbc_ajx_booking_listing" Obj.
 */
function wpbc_ajx_booking__actual_listing__show() {
  wpbc_ajx_booking_ajax_search_request(); // Send Ajax Request	-	with parameters that  we early  defined in "wpbc_ajx_booking_listing" Obj.
}

/**
 * Hide Listing Table ( and Pagination )
 */
function wpbc_ajx_booking__actual_listing__hide() {
  jQuery('.wpbc_ajx_under_toolbar_row').hide(); // FixIn: 9.6.1.5.
  jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html('');
  jQuery(wpbc_ajx_booking_listing.get_other_param('pagination_container')).html('');
}

/**
 *   Support functions for Content Template data  --------------------------------------------------------------- */

/**
 * Highlight strings,
 * by inserting <span class="fieldvalue name fieldsearchvalue">...</span> html  elements into the string.
 * @param {string} booking_details 	- Source string
 * @param {string} booking_keyword	- Keyword to highlight
 * @returns {string}
 */
function wpbc_get_highlighted_search_keyword(booking_details, booking_keyword) {
  booking_keyword = booking_keyword.trim().toLowerCase();
  if (0 == booking_keyword.length) {
    return booking_details;
  }

  // Highlight substring withing HTML tags in "Content of booking fields data" -- e.g. starting from  >  and ending with <
  let keywordRegex = new RegExp(`fieldvalue[^<>]*>([^<]*${booking_keyword}[^<]*)`, 'gim');

  //let matches = [...booking_details.toLowerCase().matchAll( keywordRegex )];
  let matches = booking_details.toLowerCase().matchAll(keywordRegex);
  matches = Array.from(matches);
  let strings_arr = [];
  let pos_previous = 0;
  let search_pos_start;
  let search_pos_end;
  for (const match of matches) {
    search_pos_start = match.index + match[0].toLowerCase().indexOf('>', 0) + 1;
    strings_arr.push(booking_details.substr(pos_previous, search_pos_start - pos_previous));
    search_pos_end = booking_details.toLowerCase().indexOf('<', search_pos_start);
    strings_arr.push('<span class="fieldvalue name fieldsearchvalue">' + booking_details.substr(search_pos_start, search_pos_end - search_pos_start) + '</span>');
    pos_previous = search_pos_end;
  }
  strings_arr.push(booking_details.substr(pos_previous, booking_details.length - pos_previous));
  return strings_arr.join('');
}

/**
 * Convert special HTML characters   from:	 &amp; 	-> 	&
 *
 * @param text
 * @returns {*}
 */
function wpbc_decode_HTML_entities(text) {
  var textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
}

/**
 * Convert TO special HTML characters   from:	 & 	-> 	&amp;
 *
 * @param text
 * @returns {*}
 */
function wpbc_encode_HTML_entities(text) {
  var textArea = document.createElement('textarea');
  textArea.innerText = text;
  return textArea.innerHTML;
}

/**
 *   Support Functions - Spin Icon in Buttons  ------------------------------------------------------------------ */

/**
 * Spin button in Filter toolbar  -  Start
 */
function wpbc_booking_listing_reload_button__spin_start() {
  jQuery('#wpbc_booking_listing_reload_button .menu_icon.wpbc_spin').removeClass('wpbc_animation_pause');
}

/**
 * Spin button in Filter toolbar  -  Pause
 */
function wpbc_booking_listing_reload_button__spin_pause() {
  jQuery('#wpbc_booking_listing_reload_button .menu_icon.wpbc_spin').addClass('wpbc_animation_pause');
}

/**
 * Show visible feedback while Booking Listing is loading.
 */
function wpbc_booking_listing_reload__message_show() {
  var ajax_working = document.getElementById('ajax_working');
  if (!ajax_working) {
    return;
  }
  wpbc_booking_listing_reload__message_hide();
  var listing_container = '';
  if ('undefined' !== typeof wpbc_ajx_booking_listing && 'function' === typeof wpbc_ajx_booking_listing.get_other_param) {
    listing_container = wpbc_ajx_booking_listing.get_other_param('listing_container');
  }
  if (listing_container && jQuery(listing_container).find('.wpbc_spins_loading_container').length) {
    return;
  }
  var unique_div_id = 'wpbc_notice_' + new Date().getTime();
  jQuery(ajax_working).append('<div id="' + unique_div_id + '" class="wpbc_booking_listing_reload_notice" style="opacity: 1;">' + '<div id="wpbc_alert_message" class="wpbc_alert_message">' + '<div class="wpbc_inner_message notice notice-info "> ' + '<a class="close" href="javascript:void(0)" onclick="javascript:jQuery(this).parent().hide();">&times;</a> ' + '<span class="wpdevelop wpbc_booking_listing_reload_processing">' + '<span class="wpbc_icn_rotate_right wpbc_spin wpbc_ajax_icon wpbc_processing wpbc_icn_autorenew" aria-hidden="true"></span>' + '</span> Loading bookings...' + '</div>' + '</div>' + '</div>');
}

/**
 * Hide Booking Listing loading feedback.
 */
function wpbc_booking_listing_reload__message_hide() {
  jQuery('.wpbc_booking_listing_reload_notice').remove();
  jQuery('.wpbc_booking_listing_reload_processing').closest('[id^="wpbc_notice_"], .wpbc_inner_message').remove();
}

/**
 * Spin button in Filter toolbar  -  is Spinning ?
 *
 * @returns {boolean}
 */
function wpbc_booking_listing_reload_button__is_spin() {
  if (jQuery('#wpbc_booking_listing_reload_button .menu_icon.wpbc_spin').hasClass('wpbc_animation_pause')) {
    return true;
  } else {
    return false;
  }
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19saXN0aW5nLmpzIiwibmFtZXMiOlsialF1ZXJ5Iiwib24iLCJ0b3VjaG1vdmUiLCJlIiwiZWFjaCIsImluZGV4IiwidGRfZWwiLCJnZXQiLCJ1bmRlZmluZWQiLCJfdGlwcHkiLCJpbnN0YW5jZSIsImhpZGUiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCJvYmoiLCIkIiwicF9zZWN1cmUiLCJzZWN1cml0eV9vYmoiLCJ1c2VyX2lkIiwibm9uY2UiLCJsb2NhbGUiLCJzZXRfc2VjdXJlX3BhcmFtIiwicGFyYW1fa2V5IiwicGFyYW1fdmFsIiwiZ2V0X3NlY3VyZV9wYXJhbSIsInBfbGlzdGluZyIsInNlYXJjaF9yZXF1ZXN0X29iaiIsInNvcnQiLCJzb3J0X3R5cGUiLCJwYWdlX251bSIsInBhZ2VfaXRlbXNfY291bnQiLCJjcmVhdGVfZGF0ZSIsImtleXdvcmQiLCJzb3VyY2UiLCJzZWFyY2hfc2V0X2FsbF9wYXJhbXMiLCJyZXF1ZXN0X3BhcmFtX29iaiIsInNlYXJjaF9nZXRfYWxsX3BhcmFtcyIsInNlYXJjaF9nZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtIiwic2VhcmNoX3NldF9wYXJhbXNfYXJyIiwicGFyYW1zX2FyciIsIl8iLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwicF9vdGhlciIsIm90aGVyX29iaiIsInNldF9vdGhlcl9wYXJhbSIsImdldF9vdGhlcl9wYXJhbSIsIndwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2Vfc2hvdyIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwid3BiY19hanhfdXNlcl9pZCIsIndwYmNfYWp4X2xvY2FsZSIsInNlYXJjaF9wYXJhbXMiLCJyZXNwb25zZV9kYXRhIiwidGV4dFN0YXR1cyIsImpxWEhSIiwiZ3JvdXBFbmQiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX2hpZGUiLCJodG1sIiwid2luZG93IiwibG9jYXRpb24iLCJocmVmIiwid3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmciLCJ3cGJjX3BhZ2luYXRpb25fZWNobyIsIk1hdGgiLCJjZWlsIiwid3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSIsImFqeF9uZXdfYm9va2luZ3NfY291bnQiLCJwYXJzZUludCIsInNob3ciLCJmYWlsIiwiZXJyb3JUaHJvd24iLCJlcnJvcl9tZXNzYWdlIiwicmVzcG9uc2VUZXh0IiwicmVwbGFjZSIsIndwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlIiwianNvbl9pdGVtc19hcnIiLCJqc29uX3NlYXJjaF9wYXJhbXMiLCJqc29uX2Jvb2tpbmdfcmVzb3VyY2VzIiwid3BiY19hanhfZGVmaW5lX3RlbXBsYXRlc19fcmVzb3VyY2VfbWFuaXB1bGF0aW9uIiwiY3NzIiwibGlzdF9oZWFkZXJfdHBsIiwid3AiLCJ0ZW1wbGF0ZSIsImxpc3RfZm9vdGVyX3RwbCIsImxpc3Rfcm93X3RwbCIsImFwcGVuZCIsIndwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiIsIm1vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZSIsIm1vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZSIsIm1lc3NhZ2UiLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMiLCJ3cGJjX2FqeF9ib29raW5nX3BhZ2luYXRpb25fY2xpY2siLCJwYWdlX251bWJlciIsIndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF9mb3Jfa2V5d29yZCIsImVsZW1lbnRfaWQiLCJ2YWwiLCJ3cGJjX2FqeF9ib29raW5nX3NlYXJjaGluZ19hZnRlcl9mZXdfc2Vjb25kcyIsImNsb3NlZF90aW1lciIsInRpbWVyX2RlbGF5IiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImJpbmQiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlIiwid3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19yZW1hcmsiLCJ3cGJjX2Jvb19saXN0aW5nX19pbml0X2hvb2tfX3NvcnRfYnkiLCJldmVudCIsIndwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93Iiwid3BiY19nZXRfaGlnaGxpZ2h0ZWRfc2VhcmNoX2tleXdvcmQiLCJib29raW5nX2RldGFpbHMiLCJib29raW5nX2tleXdvcmQiLCJ0cmltIiwidG9Mb3dlckNhc2UiLCJsZW5ndGgiLCJrZXl3b3JkUmVnZXgiLCJSZWdFeHAiLCJtYXRjaGVzIiwibWF0Y2hBbGwiLCJBcnJheSIsImZyb20iLCJzdHJpbmdzX2FyciIsInBvc19wcmV2aW91cyIsInNlYXJjaF9wb3Nfc3RhcnQiLCJzZWFyY2hfcG9zX2VuZCIsIm1hdGNoIiwiaW5kZXhPZiIsInB1c2giLCJzdWJzdHIiLCJqb2luIiwid3BiY19kZWNvZGVfSFRNTF9lbnRpdGllcyIsInRleHQiLCJ0ZXh0QXJlYSIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsInZhbHVlIiwid3BiY19lbmNvZGVfSFRNTF9lbnRpdGllcyIsImlubmVyVGV4dCIsInJlbW92ZUNsYXNzIiwiYWRkQ2xhc3MiLCJhamF4X3dvcmtpbmciLCJnZXRFbGVtZW50QnlJZCIsImxpc3RpbmdfY29udGFpbmVyIiwiZmluZCIsInVuaXF1ZV9kaXZfaWQiLCJEYXRlIiwiZ2V0VGltZSIsInJlbW92ZSIsImNsb3Nlc3QiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluIiwiaGFzQ2xhc3MiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWJvb2tpbmdzL19zcmMvYm9va2luZ3NfX2xpc3RpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5qUXVlcnkoJ2JvZHknKS5vbih7XHJcbiAgICAndG91Y2htb3ZlJzogZnVuY3Rpb24oZSkge1xyXG5cclxuXHRcdGpRdWVyeSggJy50aW1lc3BhcnRseScgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblxyXG5cdFx0XHR2YXIgdGRfZWwgPSBqUXVlcnkoIHRoaXMgKS5nZXQoIDAgKTtcclxuXHJcblx0XHRcdGlmICggKHVuZGVmaW5lZCAhPSB0ZF9lbC5fdGlwcHkpICl7XHJcblxyXG5cdFx0XHRcdHZhciBpbnN0YW5jZSA9IHRkX2VsLl90aXBweTtcclxuXHRcdFx0XHRpbnN0YW5jZS5oaWRlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFJlcXVlc3QgT2JqZWN0XHJcbiAqIEhlcmUgd2UgY2FuICBkZWZpbmUgU2VhcmNoIHBhcmFtZXRlcnMgYW5kIFVwZGF0ZSBpdCBsYXRlciwgIHdoZW4gIHNvbWUgcGFyYW1ldGVyIHdhcyBjaGFuZ2VkXHJcbiAqXHJcbiAqL1xyXG52YXIgd3BiY19hanhfYm9va2luZ19saXN0aW5nID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cclxuXHRvYmouc2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX3NlY3VyZVsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX3NlY3VyZVsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIExpc3RpbmcgU2VhcmNoIHBhcmFtZXRlcnNcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2xpc3RpbmcgPSBvYmouc2VhcmNoX3JlcXVlc3Rfb2JqID0gb2JqLnNlYXJjaF9yZXF1ZXN0X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X2FsbF9wYXJhbXMgPSBmdW5jdGlvbiAoIHJlcXVlc3RfcGFyYW1fb2JqICkge1xyXG5cdFx0cF9saXN0aW5nID0gcmVxdWVzdF9wYXJhbV9vYmo7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfYWxsX3BhcmFtcyA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2xpc3Rpbmc7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX2xpc3RpbmdbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdC8vIGlmICggQXJyYXkuaXNBcnJheSggcGFyYW1fdmFsICkgKXtcclxuXHRcdC8vIFx0cGFyYW1fdmFsID0gSlNPTi5zdHJpbmdpZnkoIHBhcmFtX3ZhbCApO1xyXG5cdFx0Ly8gfVxyXG5cdFx0cF9saXN0aW5nWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9wYXJhbXNfYXJyID0gZnVuY3Rpb24oIHBhcmFtc19hcnIgKXtcclxuXHRcdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0XHRcdHRoaXMuc2VhcmNoX3NldF9wYXJhbSggcF9rZXksIHBfdmFsICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gT3RoZXIgcGFyYW1ldGVycyBcdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9vdGhlciA9IG9iai5vdGhlcl9vYmogPSBvYmoub3RoZXJfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlclsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdHJldHVybiBvYmo7XHJcbn0oIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEFqYXggIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBzZWFyY2ggcmVxdWVzdFxyXG4gKiBmb3Igc2VhcmNoaW5nIHNwZWNpZmljIEtleXdvcmQgYW5kIG90aGVyIHBhcmFtc1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0KCl7XHJcblxyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCdBSlhfQk9PS0lOR19MSVNUSU5HJyk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBzZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSA9PSAnICwgd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpICk7XHJcblxyXG5cdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKTtcclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2Vfc2hvdygpO1xyXG5cclxuLypcclxuLy9GaXhJbjogZm9yVmlkZW9cclxuaWYgKCAhIGlzX3RoaXNfYWN0aW9uICl7XHJcblx0Ly93cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSgpO1xyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdCc8ZGl2IHN0eWxlPVwid2lkdGg6MTAwJTt0ZXh0LWFsaWduOiBjZW50ZXI7XCIgaWQ9XCJ3cGJjX2xvYWRpbmdfc2VjdGlvblwiPjxzcGFuIGNsYXNzPVwid3BiY19pY25fYXV0b3JlbmV3IHdwYmNfc3BpblwiPjwvc3Bhbj48L2Rpdj4nXHJcblx0XHQrIGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbCgpXHJcblx0KTtcclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAoalF1ZXJ5KCAnI3dwYmNfbG9hZGluZ19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwpICl7XHRcdFx0Ly8gRml4SW46IDkuMC4xLjUuXHJcblx0XHRqUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGFsZXJ0KCAnV2FybmluZyEgQm9va2luZyBDYWxlbmRhci4gSXRzIHNlZW1zIHRoYXQgIHlvdSBoYXZlIGRlYWN0aXZhdGVkIGxvYWRpbmcgb2YgQm9vdHN0cmFwIEpTIGZpbGVzIGF0IEJvb2tpbmcgU2V0dGluZ3MgR2VuZXJhbCBwYWdlIGluIEFkdmFuY2VkIHNlY3Rpb24uJyApXHJcblx0fVxyXG59XHJcbmlzX3RoaXNfYWN0aW9uID0gZmFsc2U7XHJcbiovXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9CT09LSU5HX0xJU1RJTkcnLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X2xvY2FsZSA6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdHNlYXJjaF9wYXJhbXNcdDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjZy5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcbi8vRml4SW46IGZvclZpZGVvXHJcbi8valF1ZXJ5KCAnI3dwYmNfbG9hZGluZ19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdoaWRlJyApO1xyXG5cclxudHJ5IHtcclxuY29uc29sZS5sb2coICcgPT0gUmVzcG9uc2UgV1BCQ19BSlhfQk9PS0lOR19MSVNUSU5HID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHRcdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2VfaGlkZSgpO1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVsb2FkIHBhZ2UsIGFmdGVyIGZpbHRlciB0b29sYmFyIHdhcyByZXNldGVkXHJcblx0XHRcdFx0XHRpZiAoICAgICAgICggICAgIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdKVxyXG5cdFx0XHRcdFx0XHRcdCYmICggJ3Jlc2V0X2RvbmUnID09PSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAndWlfcmVzZXQnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2VfaGlkZSgpO1xyXG5cdFx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bJ3VpX3Jlc2V0X3VybCddO1xyXG5cdFx0XHRcdFx0XHQvLyBsb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgbGlzdGluZ1xyXG5cdFx0XHRcdFx0aWYgKCByZXNwb25zZV9kYXRhWyAnYWp4X2NvdW50JyBdID4gMCApe1xyXG5cclxuXHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmcoIHJlc3BvbnNlX2RhdGFbICdhanhfaXRlbXMnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9ib29raW5nX3Jlc291cmNlcycgXSApO1xyXG5cclxuXHRcdFx0XHRcdFx0d3BiY19wYWdpbmF0aW9uX2VjaG8oXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyJyApLFxyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdwYWdpbmF0aW9uX2NvbnRhaW5lcl9oZWFkZXInICksXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyX2Zvb3RlcicgKSxcclxuXHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHQncGFnZV9hY3RpdmUnOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX251bScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdCdwYWdlc19jb3VudCc6IE1hdGguY2VpbCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb3VudCcgXSAvIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXVsgJ3BhZ2VfaXRlbXNfY291bnQnIF0gKSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHQncGFnZV9pdGVtc19jb3VudCc6IHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXVsgJ3BhZ2VfaXRlbXNfY291bnQnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHQnc29ydF90eXBlJyAgICAgICA6IHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXVsgJ3NvcnRfdHlwZScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdCd0b3RhbF9jb3VudCcgICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb3VudCcgXSxcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzKCk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MsIGJlY2F1c2Ugd2Ugc2hvdyBuZXcgRE9NIGVsZW1lbnRzXHJcblxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlMCBub3RpY2Utd2FybmluZzBcIiBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyO2ZvbnQtc2l6ZTogMTVweDttYXJnaW46IDJlbSAwO1wiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0JzxwPjxzdHJvbmc+Tm8gcmVzdWx0cyBmb3VuZCBmb3IgY3VycmVudCBmaWx0ZXIgb3B0aW9ucy4uLjwvc3Ryb25nPjwvcD4nICtcclxuXHRcdFx0XHRcdFx0XHRcdCc8cD48c3Ryb25nPjxhICBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCcgb25jbGljaz1cImphdmFzY3JpcHQ6d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0JyBcXCd1aV9yZXNldFxcJzogXFwnbWFrZV9yZXNldFxcJywgJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0JyBcXCdwYWdlX251bVxcJzogMSAnICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J30gKTtcIj5SZXNldCBmaWx0ZXJzPC9hPiB0byBzaG93IGFsbCBib29raW5ncy48L3N0cm9uZz48L3A+JyArXHJcblx0XHRcdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBVcGRhdGUgbmV3IGJvb2tpbmcgY291bnRcclxuXHRcdFx0XHRcdGlmICggdW5kZWZpbmVkICE9PSByZXNwb25zZV9kYXRhWyAnYWp4X25ld19ib29raW5nc19jb3VudCcgXSApe1xyXG5cdFx0XHRcdFx0XHR2YXIgYWp4X25ld19ib29raW5nc19jb3VudCA9IHBhcnNlSW50KCByZXNwb25zZV9kYXRhWyAnYWp4X25ld19ib29raW5nc19jb3VudCcgXSApXHJcblx0XHRcdFx0XHRcdGlmIChhanhfbmV3X2Jvb2tpbmdzX2NvdW50PjApe1xyXG5cdFx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2JhZGdlX2NvdW50JyApLnNob3coKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcuYmstdXBkYXRlLWNvdW50JyApLmh0bWwoIGFqeF9uZXdfYm9va2luZ3NfY291bnQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2VfaGlkZSgpO1xyXG5cclxuXHRcdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcbn0gZmluYWxseSB7XHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2VfaGlkZSgpO1xyXG59XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHRcdFx0XHRcdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHRcdFx0XHRcdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9fbWVzc2FnZV9oaWRlKCk7XHJcblx0XHRcdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhJyArICc8L3N0cm9uZz4gJyArIGVycm9yVGhyb3duIDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0ganFYSFIucmVzcG9uc2VUZXh0O1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdFx0ICB9KVxyXG5cdCAgICAgICAgICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHRcdCAgLy8gLmFsd2F5cyggZnVuY3Rpb24gKCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ2Fsd2F5cyBmaW5pc2hlZCcsIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICk7IH0gICAgIH0pXHJcblx0XHRcdCAgOyAgLy8gRW5kIEFqYXhcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNob3cgTGlzdGluZyBUYWJsZSBcdFx0YW5kIGRlZmluZSBnTWFpbCBjaGVja2JveCBob29rc1xyXG4gKlxyXG4gKiBAcGFyYW0ganNvbl9pdGVtc19hcnJcdFx0LSBKU09OIG9iamVjdCB3aXRoIEl0ZW1zXHJcbiAqIEBwYXJhbSBqc29uX3NlYXJjaF9wYXJhbXNcdC0gSlNPTiBvYmplY3Qgd2l0aCBTZWFyY2hcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19saXN0aW5nKCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zLCBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzICl7XHJcblxyXG5cdHdwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbigganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApO1xyXG5cclxuLy9jb25zb2xlLmxvZyggJ2pzb25faXRlbXNfYXJyJyAsIGpzb25faXRlbXNfYXJyLCBqc29uX3NlYXJjaF9wYXJhbXMgKTtcclxuXHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuY3NzKCBcImRpc3BsYXlcIiwgXCJmbGV4XCIgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdHZhciBsaXN0X2hlYWRlcl90cGwgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2Jvb2tpbmdfbGlzdF9oZWFkZXInICk7XHJcblx0dmFyIGxpc3RfZm9vdGVyX3RwbCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYm9va2luZ19saXN0X2Zvb3RlcicgKTtcclxuXHR2YXIgbGlzdF9yb3dfdHBsICAgID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9ib29raW5nX2xpc3Rfcm93JyApO1xyXG5cclxuXHJcblx0Ly8gSGVhZGVyLlxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbCggbGlzdF9oZWFkZXJfdHBsKCkgKTtcclxuXHQvLyBTZW5kIHRvIHRlbXBsYXRlIGFsbCByZXF1ZXN0IHBhcmFtczogalF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKCBsaXN0X2hlYWRlcl90cGwod3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpKSApO1xyXG5cdC8vIEJvZHkuXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5hcHBlbmQoICc8ZGl2IGNsYXNzPVwid3BiY19zZWxlY3RhYmxlX2JvZHlcIj48L2Rpdj4nICk7XHJcblx0Ly8gRm9vdGVyLlxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuYXBwZW5kKCBsaXN0X2Zvb3Rlcl90cGwoKSApO1xyXG5cclxuXHQvLyBSIG8gdyBzXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdMSVNUSU5HX1JPV1MnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIExJU1RJTkdfUk9XU1xyXG5cdF8uZWFjaCgganNvbl9pdGVtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKXtcclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBqc29uX3NlYXJjaF9wYXJhbXNbICdrZXl3b3JkJyBdICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBQYXJhbWV0ZXIgZm9yIG1hcmtpbmcga2V5d29yZCB3aXRoIGRpZmZlcmVudCBjb2xvciBpbiBhIGxpc3RcclxuXHRcdFx0cF92YWxbICdfX3NlYXJjaF9yZXF1ZXN0X2tleXdvcmRfXycgXSA9IGpzb25fc2VhcmNoX3BhcmFtc1sgJ2tleXdvcmQnIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRwX3ZhbFsgJ19fc2VhcmNoX3JlcXVlc3Rfa2V5d29yZF9fJyBdID0gJyc7XHJcblx0XHR9XHJcblx0XHRwX3ZhbFsgJ2Jvb2tpbmdfcmVzb3VyY2VzJyBdID0ganNvbl9ib29raW5nX3Jlc291cmNlcztcclxuXHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICsgJyAud3BiY19zZWxlY3RhYmxlX2JvZHknICkuYXBwZW5kKCBsaXN0X3Jvd190cGwoIHBfdmFsICkgKTtcclxuXHR9ICk7XHJcbmNvbnNvbGUuZ3JvdXBFbmQoKTsgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBMSVNUSU5HX1JPV1NcclxuXHJcblx0d3BiY19kZWZpbmVfZ21haWxfY2hlY2tib3hfc2VsZWN0aW9uKCBqUXVlcnkgKTtcdFx0XHRcdFx0XHQvLyBSZWRlZmluZSBIb29rcyBmb3IgY2xpY2tpbmcgYXQgQ2hlY2tib3hlc1xyXG59XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdGVtcGxhdGUgZm9yIGNoYW5naW5nIGJvb2tpbmcgcmVzb3VyY2VzICYgIHVwZGF0ZSBpdCBlYWNoIHRpbWUsICB3aGVuICBsaXN0aW5nIHVwZGF0aW5nLCB1c2VmdWwgIGZvciBzaG93aW5nIGFjdHVhbCAgYm9va2luZyByZXNvdXJjZXMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ganNvbl9pdGVtc19hcnJcdFx0LSBKU09OIG9iamVjdCB3aXRoIEl0ZW1zXHJcblx0ICogQHBhcmFtIGpzb25fc2VhcmNoX3BhcmFtc1x0LSBKU09OIG9iamVjdCB3aXRoIFNlYXJjaFxyXG5cdCAqIEBwYXJhbSBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzXHQtIEpTT04gb2JqZWN0IHdpdGggUmVzb3VyY2VzXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hanhfZGVmaW5lX3RlbXBsYXRlc19fcmVzb3VyY2VfbWFuaXB1bGF0aW9uKCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zLCBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzICl7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gTmV3LiAyMDI1LTA0LTIxLlxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gQ2hhbmdlIGJvb2tpbmcgcmVzb3VyY2UgaW4gTW9kYWwuXHJcblx0XHR2YXIgbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9fbW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlJyApO1xyXG5cclxuXHRcdGpRdWVyeSggJyNzZWN0aW9uX2luX2luX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZScgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZSgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9zZWFyY2hfcGFyYW1zJyAgICA6IGpzb25fc2VhcmNoX3BhcmFtcyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfYm9va2luZ19yZXNvdXJjZXMnOiBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdC8vIER1cGxpY2F0ZSBib29raW5nIGludG8gYW5vdGhlciByZXNvdXJjZSBpbiBNb2RhbC4gTmV3LiAyMDI1LTA0LTIxLlxyXG5cdFx0dmFyIG1vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZSA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfX21vZGFsX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZScgKTtcclxuXHJcblx0XHRqUXVlcnkoICcjc2VjdGlvbl9pbl9pbl9tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UnICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgOiBqc29uX3NlYXJjaF9wYXJhbXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2Jvb2tpbmdfcmVzb3VyY2VzJzoganNvbl9ib29raW5nX3Jlc291cmNlc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0fVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaG93IGp1c3QgbWVzc2FnZSBpbnN0ZWFkIG9mIGxpc3RpbmcgYW5kIGhpZGUgcGFnaW5hdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UoIG1lc3NhZ2UgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX2hpZGUoKTtcclxuXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgSCBvIG8gayBzICAtICBpdHMgQWN0aW9uL1RpbWVzIHdoZW4gbmVlZCB0byByZS1SZW5kZXIgVmlld3MgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VuZCBBamF4IFNlYXJjaCBSZXF1ZXN0IGFmdGVyIFVwZGF0aW5nIHNlYXJjaCByZXF1ZXN0IHBhcmFtZXRlcnNcclxuICpcclxuICogQHBhcmFtIHBhcmFtc19hcnJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyAoIHBhcmFtc19hcnIgKXtcclxuXHJcblx0Ly8gRGVmaW5lIGRpZmZlcmVudCBTZWFyY2ggIHBhcmFtZXRlcnMgZm9yIHJlcXVlc3RcclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHQvL2NvbnNvbGUubG9nKCAnUmVxdWVzdCBmb3I6ICcsIHBfa2V5LCBwX3ZhbCApO1xyXG5cdFx0d3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9zZXRfcGFyYW0oIHBfa2V5LCBwX3ZhbCApO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBTZW5kIEFqYXggUmVxdWVzdFxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCgpO1xyXG59XHJcblxyXG4vKipcclxuICogU2VhcmNoIHJlcXVlc3QgZm9yIFwiUGFnZSBOdW1iZXJcIlxyXG4gKiBAcGFyYW0gcGFnZV9udW1iZXJcdGludFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19wYWdpbmF0aW9uX2NsaWNrKCBwYWdlX251bWJlciApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nOiBwYWdlX251bWJlclxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBLZXl3b3JkIFNlYXJjaGluZyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZWFyY2ggcmVxdWVzdCBmb3IgXCJLZXl3b3JkXCIsIGFsc28gc2V0IGN1cnJlbnQgcGFnZSB0byAgMVxyXG4gKlxyXG4gKiBAcGFyYW0gZWxlbWVudF9pZFx0LVx0SFRNTCBJRCAgb2YgZWxlbWVudCwgIHdoZXJlIHdhcyBlbnRlcmVkIGtleXdvcmRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF9mb3Jfa2V5d29yZCggZWxlbWVudF9pZCApIHtcclxuXHJcblx0Ly8gV2UgbmVlZCB0byBSZXNldCBwYWdlX251bSB0byAxIHdpdGggZWFjaCBuZXcgc2VhcmNoLCBiZWNhdXNlIHdlIGNhbiBiZSBhdCBwYWdlICM0LCAgYnV0IGFmdGVyICBuZXcgc2VhcmNoICB3ZSBjYW4gIGhhdmUgdG90YWxseSAgb25seSAgMSBwYWdlXHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQna2V5d29yZCcgIDogalF1ZXJ5KCBlbGVtZW50X2lkICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG59XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlbmQgc2VhcmNoIHJlcXVlc3QgYWZ0ZXIgZmV3IHNlY29uZHMgKHVzdWFsbHkgYWZ0ZXIgMSw1IHNlYylcclxuXHQgKiBDbG9zdXJlIGZ1bmN0aW9uLiBJdHMgdXNlZnVsLCAgZm9yIGRvICBub3Qgc2VuZCB0b28gbWFueSBBamF4IHJlcXVlc3RzLCB3aGVuIHNvbWVvbmUgbWFrZSBmYXN0IHR5cGluZy5cclxuXHQgKi9cclxuXHR2YXIgd3BiY19hanhfYm9va2luZ19zZWFyY2hpbmdfYWZ0ZXJfZmV3X3NlY29uZHMgPSBmdW5jdGlvbiAoKXtcclxuXHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyID0gMDtcclxuXHJcblx0XHRyZXR1cm4gZnVuY3Rpb24gKCBlbGVtZW50X2lkLCB0aW1lcl9kZWxheSApe1xyXG5cclxuXHRcdFx0Ly8gR2V0IGRlZmF1bHQgdmFsdWUgb2YgXCJ0aW1lcl9kZWxheVwiLCAgaWYgcGFyYW1ldGVyIHdhcyBub3QgcGFzc2VkIGludG8gdGhlIGZ1bmN0aW9uLlxyXG5cdFx0XHR0aW1lcl9kZWxheSA9IHR5cGVvZiB0aW1lcl9kZWxheSAhPT0gJ3VuZGVmaW5lZCcgPyB0aW1lcl9kZWxheSA6IDE1MDA7XHJcblxyXG5cdFx0XHRjbGVhclRpbWVvdXQoIGNsb3NlZF90aW1lciApO1x0XHQvLyBDbGVhciBwcmV2aW91cyB0aW1lclxyXG5cclxuXHRcdFx0Ly8gU3RhcnQgbmV3IFRpbWVyXHJcblx0XHRcdGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF9mb3Jfa2V5d29yZC5iaW5kKCAgbnVsbCwgZWxlbWVudF9pZCApLCB0aW1lcl9kZWxheSApO1xyXG5cdFx0fVxyXG5cdH0oKTtcclxuXHJcblxyXG4vKipcclxuICogICBEZWZpbmUgRHluYW1pYyBIb29rcyAgKGxpa2UgcGFnaW5hdGlvbiBjbGljaywgd2hpY2ggcmVuZXcgZWFjaCB0aW1lIHdpdGggbmV3IGxpc3Rpbmcgc2hvd2luZykgIC0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIEhUTUwgdWkgSG9va3M6IG9uIEtleVVwIHwgQ2hhbmdlIHwgLT4gU29ydCBPcmRlciAmIE51bWJlciBJdGVtcyAvIFBhZ2VcclxuXHQgKiBXZSBhcmUgaGNuYWdlZCBpdCBlYWNoICB0aW1lLCB3aGVuIHNob3dpbmcgbmV3IGxpc3RpbmcsIGJlY2F1c2UgRE9NIGVsZW1lbnRzIGNobmFnZWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpIHtcclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMpICkge1xyXG5cdFx0XHR3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggJy53cGJjX19saXN0X190YWJsZSAnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUoKTtcclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrKCk7XHJcblxyXG5cdFx0d3BiY19ib29fbGlzdGluZ19faW5pdF9ob29rX19zb3J0X2J5KCk7XHJcblxyXG5cdFx0Ly8gSXRlbXMgUGVyIFBhZ2UuXHJcblx0XHRqUXVlcnkoICcud3BiY19pdGVtc19wZXJfcGFnZScgKS5vbihcclxuXHRcdFx0J2NoYW5nZScsXHJcblx0XHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyhcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0J3BhZ2VfaXRlbXNfY291bnQnOiBqUXVlcnkoIHRoaXMgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0J3BhZ2VfbnVtJyAgICAgICAgOiAxXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdFx0fVxyXG5cdFx0KTtcclxuXHJcblx0XHQvLyBTb3J0aW5nLlxyXG5cdFx0alF1ZXJ5KCAnLndwYmNfaXRlbXNfc29ydF90eXBlJyApLm9uKFxyXG5cdFx0XHQnY2hhbmdlJyxcclxuXHRcdFx0ZnVuY3Rpb24gKGV2ZW50KSB7XHJcblx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7ICdzb3J0X3R5cGUnOiBqUXVlcnkoIHRoaXMgKS52YWwoKSB9ICk7XHJcblx0XHRcdH1cclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFNob3cgLyBIaWRlIExpc3RpbmcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqICBTaG93IExpc3RpbmcgVGFibGUgXHQtIFx0U2VuZGluZyBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZCBpbiBcIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1wiIE9iai5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93KCl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCgpO1x0XHRcdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIExpc3RpbmcgVGFibGUgKCBhbmQgUGFnaW5hdGlvbiApXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSgpe1xyXG5cdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNi4xLjUuXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgICAgKS5odG1sKCAnJyApO1xyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyJyApICkuaHRtbCggJycgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgZnVuY3Rpb25zIGZvciBDb250ZW50IFRlbXBsYXRlIGRhdGEgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEhpZ2hsaWdodCBzdHJpbmdzLFxyXG4gKiBieSBpbnNlcnRpbmcgPHNwYW4gY2xhc3M9XCJmaWVsZHZhbHVlIG5hbWUgZmllbGRzZWFyY2h2YWx1ZVwiPi4uLjwvc3Bhbj4gaHRtbCAgZWxlbWVudHMgaW50byB0aGUgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19kZXRhaWxzIFx0LSBTb3VyY2Ugc3RyaW5nXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2tleXdvcmRcdC0gS2V5d29yZCB0byBoaWdobGlnaHRcclxuICogQHJldHVybnMge3N0cmluZ31cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X2hpZ2hsaWdodGVkX3NlYXJjaF9rZXl3b3JkKCBib29raW5nX2RldGFpbHMsIGJvb2tpbmdfa2V5d29yZCApe1xyXG5cclxuXHRib29raW5nX2tleXdvcmQgPSBib29raW5nX2tleXdvcmQudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0aWYgKCAwID09IGJvb2tpbmdfa2V5d29yZC5sZW5ndGggKXtcclxuXHRcdHJldHVybiBib29raW5nX2RldGFpbHM7XHJcblx0fVxyXG5cclxuXHQvLyBIaWdobGlnaHQgc3Vic3RyaW5nIHdpdGhpbmcgSFRNTCB0YWdzIGluIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIgLS0gZS5nLiBzdGFydGluZyBmcm9tICA+ICBhbmQgZW5kaW5nIHdpdGggPFxyXG5cdGxldCBrZXl3b3JkUmVnZXggPSBuZXcgUmVnRXhwKCBgZmllbGR2YWx1ZVtePD5dKj4oW148XSoke2Jvb2tpbmdfa2V5d29yZH1bXjxdKilgLCAnZ2ltJyApO1xyXG5cclxuXHQvL2xldCBtYXRjaGVzID0gWy4uLmJvb2tpbmdfZGV0YWlscy50b0xvd2VyQ2FzZSgpLm1hdGNoQWxsKCBrZXl3b3JkUmVnZXggKV07XHJcblx0bGV0IG1hdGNoZXMgPSBib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5tYXRjaEFsbCgga2V5d29yZFJlZ2V4ICk7XHJcblx0XHRtYXRjaGVzID0gQXJyYXkuZnJvbSggbWF0Y2hlcyApO1xyXG5cclxuXHRsZXQgc3RyaW5nc19hcnIgPSBbXTtcclxuXHRsZXQgcG9zX3ByZXZpb3VzID0gMDtcclxuXHRsZXQgc2VhcmNoX3Bvc19zdGFydDtcclxuXHRsZXQgc2VhcmNoX3Bvc19lbmQ7XHJcblxyXG5cdGZvciAoIGNvbnN0IG1hdGNoIG9mIG1hdGNoZXMgKXtcclxuXHJcblx0XHRzZWFyY2hfcG9zX3N0YXJ0ID0gbWF0Y2guaW5kZXggKyBtYXRjaFsgMCBdLnRvTG93ZXJDYXNlKCkuaW5kZXhPZiggJz4nLCAwICkgKyAxIDtcclxuXHJcblx0XHRzdHJpbmdzX2Fyci5wdXNoKCBib29raW5nX2RldGFpbHMuc3Vic3RyKCBwb3NfcHJldmlvdXMsIChzZWFyY2hfcG9zX3N0YXJ0IC0gcG9zX3ByZXZpb3VzKSApICk7XHJcblxyXG5cdFx0c2VhcmNoX3Bvc19lbmQgPSBib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5pbmRleE9mKCAnPCcsIHNlYXJjaF9wb3Nfc3RhcnQgKTtcclxuXHJcblx0XHRzdHJpbmdzX2Fyci5wdXNoKCAnPHNwYW4gY2xhc3M9XCJmaWVsZHZhbHVlIG5hbWUgZmllbGRzZWFyY2h2YWx1ZVwiPicgKyBib29raW5nX2RldGFpbHMuc3Vic3RyKCBzZWFyY2hfcG9zX3N0YXJ0LCAoc2VhcmNoX3Bvc19lbmQgLSBzZWFyY2hfcG9zX3N0YXJ0KSApICsgJzwvc3Bhbj4nICk7XHJcblxyXG5cdFx0cG9zX3ByZXZpb3VzID0gc2VhcmNoX3Bvc19lbmQ7XHJcblx0fVxyXG5cclxuXHRzdHJpbmdzX2Fyci5wdXNoKCBib29raW5nX2RldGFpbHMuc3Vic3RyKCBwb3NfcHJldmlvdXMsIChib29raW5nX2RldGFpbHMubGVuZ3RoIC0gcG9zX3ByZXZpb3VzKSApICk7XHJcblxyXG5cdHJldHVybiBzdHJpbmdzX2Fyci5qb2luKCAnJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVydCBzcGVjaWFsIEhUTUwgY2hhcmFjdGVycyAgIGZyb206XHQgJmFtcDsgXHQtPiBcdCZcclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlY29kZV9IVE1MX2VudGl0aWVzKCB0ZXh0ICl7XHJcblx0dmFyIHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3RleHRhcmVhJyApO1xyXG5cdHRleHRBcmVhLmlubmVySFRNTCA9IHRleHQ7XHJcblx0cmV0dXJuIHRleHRBcmVhLnZhbHVlO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVydCBUTyBzcGVjaWFsIEhUTUwgY2hhcmFjdGVycyAgIGZyb206XHQgJiBcdC0+IFx0JmFtcDtcclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2VuY29kZV9IVE1MX2VudGl0aWVzKHRleHQpIHtcclxuICB2YXIgdGV4dEFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xyXG4gIHRleHRBcmVhLmlubmVyVGV4dCA9IHRleHQ7XHJcbiAgcmV0dXJuIHRleHRBcmVhLmlubmVySFRNTDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIEJ1dHRvbnMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBTdGFydFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJykucmVtb3ZlQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBQYXVzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTaG93IHZpc2libGUgZmVlZGJhY2sgd2hpbGUgQm9va2luZyBMaXN0aW5nIGlzIGxvYWRpbmcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2Vfc2hvdygpe1xyXG5cclxuXHR2YXIgYWpheF93b3JraW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdhamF4X3dvcmtpbmcnICk7XHJcblxyXG5cdGlmICggISBhamF4X3dvcmtpbmcgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2VfaGlkZSgpO1xyXG5cclxuXHR2YXIgbGlzdGluZ19jb250YWluZXIgPSAnJztcclxuXHRpZiAoXHJcblx0XHQgICAoICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd3BiY19hanhfYm9va2luZ19saXN0aW5nIClcclxuXHRcdCYmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0gKVxyXG5cdCkge1xyXG5cdFx0bGlzdGluZ19jb250YWluZXIgPSB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICk7XHJcblx0fVxyXG5cclxuXHRpZiAoXHJcblx0XHQgICBsaXN0aW5nX2NvbnRhaW5lclxyXG5cdFx0JiYgalF1ZXJ5KCBsaXN0aW5nX2NvbnRhaW5lciApLmZpbmQoICcud3BiY19zcGluc19sb2FkaW5nX2NvbnRhaW5lcicgKS5sZW5ndGhcclxuXHQpIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdHZhciB1bmlxdWVfZGl2X2lkID0gJ3dwYmNfbm90aWNlXycgKyAoIG5ldyBEYXRlKCkgKS5nZXRUaW1lKCk7XHJcblxyXG5cdGpRdWVyeSggYWpheF93b3JraW5nICkuYXBwZW5kKFxyXG5cdFx0JzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdcIiBjbGFzcz1cIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9ub3RpY2VcIiBzdHlsZT1cIm9wYWNpdHk6IDE7XCI+JyArXHJcblx0XHRcdCc8ZGl2IGlkPVwid3BiY19hbGVydF9tZXNzYWdlXCIgY2xhc3M9XCJ3cGJjX2FsZXJ0X21lc3NhZ2VcIj4nICtcclxuXHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmNfaW5uZXJfbWVzc2FnZSBub3RpY2Ugbm90aWNlLWluZm8gXCI+ICcgK1xyXG5cdFx0XHRcdFx0JzxhIGNsYXNzPVwiY2xvc2VcIiBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgb25jbGljaz1cImphdmFzY3JpcHQ6alF1ZXJ5KHRoaXMpLnBhcmVudCgpLmhpZGUoKTtcIj4mdGltZXM7PC9hPiAnICtcclxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIndwZGV2ZWxvcCB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfcHJvY2Vzc2luZ1wiPicgK1xyXG5cdFx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluIHdwYmNfYWpheF9pY29uIHdwYmNfcHJvY2Vzc2luZyB3cGJjX2ljbl9hdXRvcmVuZXdcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L3NwYW4+JyArXHJcblx0XHRcdFx0XHQnPC9zcGFuPiBMb2FkaW5nIGJvb2tpbmdzLi4uJyArXHJcblx0XHRcdFx0JzwvZGl2PicgK1xyXG5cdFx0XHQnPC9kaXY+JyArXHJcblx0XHQnPC9kaXY+J1xyXG5cdCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIEJvb2tpbmcgTGlzdGluZyBsb2FkaW5nIGZlZWRiYWNrLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX2hpZGUoKXtcclxuXHRqUXVlcnkoICcud3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX25vdGljZScgKS5yZW1vdmUoKTtcclxuXHRqUXVlcnkoICcud3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX3Byb2Nlc3NpbmcnICkuY2xvc2VzdCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0sIC53cGJjX2lubmVyX21lc3NhZ2UnICkucmVtb3ZlKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgaXMgU3Bpbm5pbmcgP1xyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKXtcclxuICAgIGlmICggalF1ZXJ5KCAnI3dwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuaGFzQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKSApe1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuIl0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUVaQSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUNDLEVBQUUsQ0FBQztFQUNkLFdBQVcsRUFBRSxTQUFBQyxDQUFTQyxDQUFDLEVBQUU7SUFFM0JILE1BQU0sQ0FBRSxjQUFlLENBQUMsQ0FBQ0ksSUFBSSxDQUFFLFVBQVdDLEtBQUssRUFBRTtNQUVoRCxJQUFJQyxLQUFLLEdBQUdOLE1BQU0sQ0FBRSxJQUFLLENBQUMsQ0FBQ08sR0FBRyxDQUFFLENBQUUsQ0FBQztNQUVuQyxJQUFNQyxTQUFTLElBQUlGLEtBQUssQ0FBQ0csTUFBTSxFQUFHO1FBRWpDLElBQUlDLFFBQVEsR0FBR0osS0FBSyxDQUFDRyxNQUFNO1FBQzNCQyxRQUFRLENBQUNDLElBQUksQ0FBQyxDQUFDO01BQ2hCO0lBQ0QsQ0FBRSxDQUFDO0VBQ0o7QUFDRCxDQUFDLENBQUM7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUlDLHdCQUF3QixHQUFJLFVBQVdDLEdBQUcsRUFBRUMsQ0FBQyxFQUFFO0VBRWxEO0VBQ0EsSUFBSUMsUUFBUSxHQUFHRixHQUFHLENBQUNHLFlBQVksR0FBR0gsR0FBRyxDQUFDRyxZQUFZLElBQUk7SUFDeENDLE9BQU8sRUFBRSxDQUFDO0lBQ1ZDLEtBQUssRUFBSSxFQUFFO0lBQ1hDLE1BQU0sRUFBRztFQUNSLENBQUM7RUFFaEJOLEdBQUcsQ0FBQ08sZ0JBQWdCLEdBQUcsVUFBV0MsU0FBUyxFQUFFQyxTQUFTLEVBQUc7SUFDeERQLFFBQVEsQ0FBRU0sU0FBUyxDQUFFLEdBQUdDLFNBQVM7RUFDbEMsQ0FBQztFQUVEVCxHQUFHLENBQUNVLGdCQUFnQixHQUFHLFVBQVdGLFNBQVMsRUFBRztJQUM3QyxPQUFPTixRQUFRLENBQUVNLFNBQVMsQ0FBRTtFQUM3QixDQUFDOztFQUdEO0VBQ0EsSUFBSUcsU0FBUyxHQUFHWCxHQUFHLENBQUNZLGtCQUFrQixHQUFHWixHQUFHLENBQUNZLGtCQUFrQixJQUFJO0lBQ2xEQyxJQUFJLEVBQWMsWUFBWTtJQUM5QkMsU0FBUyxFQUFTLE1BQU07SUFDeEJDLFFBQVEsRUFBVSxDQUFDO0lBQ25CQyxnQkFBZ0IsRUFBRSxFQUFFO0lBQ3BCQyxXQUFXLEVBQU8sRUFBRTtJQUNwQkMsT0FBTyxFQUFXLEVBQUU7SUFDcEJDLE1BQU0sRUFBWTtFQUNuQixDQUFDO0VBRWpCbkIsR0FBRyxDQUFDb0IscUJBQXFCLEdBQUcsVUFBV0MsaUJBQWlCLEVBQUc7SUFDMURWLFNBQVMsR0FBR1UsaUJBQWlCO0VBQzlCLENBQUM7RUFFRHJCLEdBQUcsQ0FBQ3NCLHFCQUFxQixHQUFHLFlBQVk7SUFDdkMsT0FBT1gsU0FBUztFQUNqQixDQUFDO0VBRURYLEdBQUcsQ0FBQ3VCLGdCQUFnQixHQUFHLFVBQVdmLFNBQVMsRUFBRztJQUM3QyxPQUFPRyxTQUFTLENBQUVILFNBQVMsQ0FBRTtFQUM5QixDQUFDO0VBRURSLEdBQUcsQ0FBQ3dCLGdCQUFnQixHQUFHLFVBQVdoQixTQUFTLEVBQUVDLFNBQVMsRUFBRztJQUN4RDtJQUNBO0lBQ0E7SUFDQUUsU0FBUyxDQUFFSCxTQUFTLENBQUUsR0FBR0MsU0FBUztFQUNuQyxDQUFDO0VBRURULEdBQUcsQ0FBQ3lCLHFCQUFxQixHQUFHLFVBQVVDLFVBQVUsRUFBRTtJQUNqREMsQ0FBQyxDQUFDcEMsSUFBSSxDQUFFbUMsVUFBVSxFQUFFLFVBQVdFLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUU7TUFBZ0I7TUFDcEUsSUFBSSxDQUFDTixnQkFBZ0IsQ0FBRUssS0FBSyxFQUFFRCxLQUFNLENBQUM7SUFDdEMsQ0FBRSxDQUFDO0VBQ0osQ0FBQzs7RUFHRDtFQUNBLElBQUlHLE9BQU8sR0FBRy9CLEdBQUcsQ0FBQ2dDLFNBQVMsR0FBR2hDLEdBQUcsQ0FBQ2dDLFNBQVMsSUFBSSxDQUFFLENBQUM7RUFFbERoQyxHQUFHLENBQUNpQyxlQUFlLEdBQUcsVUFBV3pCLFNBQVMsRUFBRUMsU0FBUyxFQUFHO0lBQ3ZEc0IsT0FBTyxDQUFFdkIsU0FBUyxDQUFFLEdBQUdDLFNBQVM7RUFDakMsQ0FBQztFQUVEVCxHQUFHLENBQUNrQyxlQUFlLEdBQUcsVUFBVzFCLFNBQVMsRUFBRztJQUM1QyxPQUFPdUIsT0FBTyxDQUFFdkIsU0FBUyxDQUFFO0VBQzVCLENBQUM7RUFHRCxPQUFPUixHQUFHO0FBQ1gsQ0FBQyxDQUFFRCx3QkFBd0IsSUFBSSxDQUFDLENBQUMsRUFBRVosTUFBTyxDQUFFOztBQUc1QztBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU2dELG9DQUFvQ0EsQ0FBQSxFQUFFO0VBRS9DQyxPQUFPLENBQUNDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQztFQUFFRCxPQUFPLENBQUNFLEdBQUcsQ0FBRSxvREFBb0QsRUFBR3ZDLHdCQUF3QixDQUFDdUIscUJBQXFCLENBQUMsQ0FBRSxDQUFDO0VBRXBLaUIsOENBQThDLENBQUMsQ0FBQztFQUNoREMseUNBQXlDLENBQUMsQ0FBQzs7RUFFNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQztFQUNBckQsTUFBTSxDQUFDc0QsSUFBSSxDQUFFQyxhQUFhLEVBQ3ZCO0lBQ0NDLE1BQU0sRUFBWSwwQkFBMEI7SUFDNUNDLGdCQUFnQixFQUFFN0Msd0JBQXdCLENBQUNXLGdCQUFnQixDQUFFLFNBQVUsQ0FBQztJQUN4RUwsS0FBSyxFQUFhTix3QkFBd0IsQ0FBQ1csZ0JBQWdCLENBQUUsT0FBUSxDQUFDO0lBQ3RFbUMsZUFBZSxFQUFHOUMsd0JBQXdCLENBQUNXLGdCQUFnQixDQUFFLFFBQVMsQ0FBQztJQUV2RW9DLGFBQWEsRUFBRy9DLHdCQUF3QixDQUFDdUIscUJBQXFCLENBQUM7RUFDaEUsQ0FBQztFQUNEO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksVUFBV3lCLGFBQWEsRUFBRUMsVUFBVSxFQUFFQyxLQUFLLEVBQUc7SUFDbEQ7SUFDQTs7SUFFQSxJQUFJO01BQ0piLE9BQU8sQ0FBQ0UsR0FBRyxDQUFFLDJDQUEyQyxFQUFFUyxhQUFjLENBQUM7TUFBRVgsT0FBTyxDQUFDYyxRQUFRLENBQUMsQ0FBQztNQUN4RjtNQUNBLElBQU0sT0FBT0gsYUFBYSxLQUFLLFFBQVEsSUFBTUEsYUFBYSxLQUFLLElBQUssRUFBRTtRQUNyRTVELE1BQU0sQ0FBRSw2QkFBOEIsQ0FBQyxDQUFDVyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQWE7UUFDNURxRCw4Q0FBOEMsQ0FBQyxDQUFDO1FBQ2hEQyx5Q0FBeUMsQ0FBQyxDQUFDO1FBQzNDakUsTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRSxDQUFDLENBQUNtQixJQUFJLENBQ25FLDJFQUEyRSxHQUMxRU4sYUFBYSxHQUNkLFFBQ0YsQ0FBQztRQUNWO01BQ0Q7O01BRUE7TUFDQSxJQUFpQnBELFNBQVMsSUFBSW9ELGFBQWEsQ0FBRSxvQkFBb0IsQ0FBRSxJQUM1RCxZQUFZLEtBQUtBLGFBQWEsQ0FBRSxvQkFBb0IsQ0FBRSxDQUFFLFVBQVUsQ0FBRyxFQUMzRTtRQUNBSyx5Q0FBeUMsQ0FBQyxDQUFDO1FBQzNDRSxNQUFNLENBQUNDLFFBQVEsQ0FBQ0MsSUFBSSxHQUFHVCxhQUFhLENBQUUsb0JBQW9CLENBQUUsQ0FBQyxjQUFjLENBQUM7UUFDNUU7UUFDQTtNQUNEOztNQUVBO01BQ0EsSUFBS0EsYUFBYSxDQUFFLFdBQVcsQ0FBRSxHQUFHLENBQUMsRUFBRTtRQUV0Q1UsNkJBQTZCLENBQUVWLGFBQWEsQ0FBRSxXQUFXLENBQUUsRUFBRUEsYUFBYSxDQUFFLG1CQUFtQixDQUFFLEVBQUVBLGFBQWEsQ0FBRSx1QkFBdUIsQ0FBRyxDQUFDO1FBRTdJVyxvQkFBb0IsQ0FDbkIzRCx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxzQkFBdUIsQ0FBQyxFQUNsRW5DLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLDZCQUE4QixDQUFDLEVBQ3pFbkMsd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsNkJBQThCLENBQUMsRUFDekU7VUFDQyxhQUFhLEVBQUVhLGFBQWEsQ0FBRSxtQkFBbUIsQ0FBRSxDQUFFLFVBQVUsQ0FBRTtVQUNqRSxhQUFhLEVBQUVZLElBQUksQ0FBQ0MsSUFBSSxDQUFFYixhQUFhLENBQUUsV0FBVyxDQUFFLEdBQUdBLGFBQWEsQ0FBRSxtQkFBbUIsQ0FBRSxDQUFFLGtCQUFrQixDQUFHLENBQUM7VUFFckgsa0JBQWtCLEVBQUVBLGFBQWEsQ0FBRSxtQkFBbUIsQ0FBRSxDQUFFLGtCQUFrQixDQUFFO1VBQzlFLFdBQVcsRUFBU0EsYUFBYSxDQUFFLG1CQUFtQixDQUFFLENBQUUsV0FBVyxDQUFFO1VBQ3ZFLGFBQWEsRUFBT0EsYUFBYSxDQUFFLFdBQVc7UUFDL0MsQ0FDRCxDQUFDO1FBQ0RjLGdDQUFnQyxDQUFDLENBQUMsQ0FBQyxDQUFNO01BRTFDLENBQUMsTUFBTTtRQUVOQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3hDM0UsTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRSxDQUFDLENBQUNtQixJQUFJLENBQzdFLDhHQUE4RyxHQUM3Ryx3RUFBd0UsR0FDeEUsMkNBQTJDLEdBQzFDLDBFQUEwRSxHQUN6RSxpQ0FBaUMsR0FDakMsbUJBQW1CLEdBQ3BCLDREQUE0RCxHQUM5RCxRQUNELENBQUM7TUFDRjs7TUFFQTtNQUNBLElBQUsxRCxTQUFTLEtBQUtvRCxhQUFhLENBQUUsd0JBQXdCLENBQUUsRUFBRTtRQUM3RCxJQUFJZ0Isc0JBQXNCLEdBQUdDLFFBQVEsQ0FBRWpCLGFBQWEsQ0FBRSx3QkFBd0IsQ0FBRyxDQUFDO1FBQ2xGLElBQUlnQixzQkFBc0IsR0FBQyxDQUFDLEVBQUM7VUFDNUI1RSxNQUFNLENBQUUsbUJBQW9CLENBQUMsQ0FBQzhFLElBQUksQ0FBQyxDQUFDO1FBQ3JDO1FBQ0E5RSxNQUFNLENBQUUsa0JBQW1CLENBQUMsQ0FBQ2tFLElBQUksQ0FBRVUsc0JBQXVCLENBQUM7TUFDNUQ7TUFFQVosOENBQThDLENBQUMsQ0FBQztNQUNoREMseUNBQXlDLENBQUMsQ0FBQztNQUUzQ2pFLE1BQU0sQ0FBRSxlQUFnQixDQUFDLENBQUNrRSxJQUFJLENBQUVOLGFBQWMsQ0FBQyxDQUFDLENBQUU7SUFDdkQsQ0FBQyxTQUFTO01BQ0xJLDhDQUE4QyxDQUFDLENBQUM7TUFDaERDLHlDQUF5QyxDQUFDLENBQUM7SUFDaEQ7RUFDSSxDQUNDLENBQUMsQ0FBQ2MsSUFBSSxDQUFFLFVBQVdqQixLQUFLLEVBQUVELFVBQVUsRUFBRW1CLFdBQVcsRUFBRztJQUFLLElBQUtiLE1BQU0sQ0FBQ2xCLE9BQU8sSUFBSWtCLE1BQU0sQ0FBQ2xCLE9BQU8sQ0FBQ0UsR0FBRyxFQUFFO01BQUVGLE9BQU8sQ0FBQ0UsR0FBRyxDQUFFLFlBQVksRUFBRVcsS0FBSyxFQUFFRCxVQUFVLEVBQUVtQixXQUFZLENBQUM7SUFBRTtJQUNuS2hGLE1BQU0sQ0FBRSw2QkFBOEIsQ0FBQyxDQUFDVyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQWM7SUFDN0RxRCw4Q0FBOEMsQ0FBQyxDQUFDO0lBQ2hEQyx5Q0FBeUMsQ0FBQyxDQUFDO0lBQzNDLElBQUlnQixhQUFhLEdBQUcsVUFBVSxHQUFHLFFBQVEsR0FBRyxZQUFZLEdBQUdELFdBQVc7SUFDdEUsSUFBS2xCLEtBQUssQ0FBQ29CLFlBQVksRUFBRTtNQUN4QkQsYUFBYSxJQUFJbkIsS0FBSyxDQUFDb0IsWUFBWTtJQUNwQztJQUNBRCxhQUFhLEdBQUdBLGFBQWEsQ0FBQ0UsT0FBTyxDQUFFLEtBQUssRUFBRSxRQUFTLENBQUM7SUFFeERDLDZCQUE2QixDQUFFSCxhQUFjLENBQUM7RUFDOUMsQ0FBQztFQUNLO0VBQ047RUFBQSxDQUNDLENBQUU7QUFDUjs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNYLDZCQUE2QkEsQ0FBRWUsY0FBYyxFQUFFQyxrQkFBa0IsRUFBRUMsc0JBQXNCLEVBQUU7RUFFbkdDLGdEQUFnRCxDQUFFSCxjQUFjLEVBQUVDLGtCQUFrQixFQUFFQyxzQkFBdUIsQ0FBQzs7RUFFL0c7RUFDQ3ZGLE1BQU0sQ0FBRSw2QkFBOEIsQ0FBQyxDQUFDeUYsR0FBRyxDQUFFLFNBQVMsRUFBRSxNQUFPLENBQUMsQ0FBQyxDQUFhO0VBQzlFLElBQUlDLGVBQWUsR0FBR0MsRUFBRSxDQUFDQyxRQUFRLENBQUUsOEJBQStCLENBQUM7RUFDbkUsSUFBSUMsZUFBZSxHQUFHRixFQUFFLENBQUNDLFFBQVEsQ0FBRSw4QkFBK0IsQ0FBQztFQUNuRSxJQUFJRSxZQUFZLEdBQU1ILEVBQUUsQ0FBQ0MsUUFBUSxDQUFFLDJCQUE0QixDQUFDOztFQUdoRTtFQUNBNUYsTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRSxDQUFDLENBQUNtQixJQUFJLENBQUV3QixlQUFlLENBQUMsQ0FBRSxDQUFDO0VBQ25HO0VBQ0E7RUFDQTFGLE1BQU0sQ0FBRVksd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsbUJBQW9CLENBQUUsQ0FBQyxDQUFDZ0QsTUFBTSxDQUFFLDBDQUEyQyxDQUFDO0VBQzlIO0VBQ0EvRixNQUFNLENBQUVZLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLG1CQUFvQixDQUFFLENBQUMsQ0FBQ2dELE1BQU0sQ0FBRUYsZUFBZSxDQUFDLENBQUUsQ0FBQzs7RUFFckc7RUFDRDVDLE9BQU8sQ0FBQ0MsY0FBYyxDQUFFLGNBQWUsQ0FBQyxDQUFDLENBQW9CO0VBQzVEVixDQUFDLENBQUNwQyxJQUFJLENBQUVpRixjQUFjLEVBQUUsVUFBVzVDLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUU7SUFDeEQsSUFBSyxXQUFXLEtBQUssT0FBTzJDLGtCQUFrQixDQUFFLFNBQVMsQ0FBRSxFQUFFO01BQWM7TUFDMUU3QyxLQUFLLENBQUUsNEJBQTRCLENBQUUsR0FBRzZDLGtCQUFrQixDQUFFLFNBQVMsQ0FBRTtJQUN4RSxDQUFDLE1BQU07TUFDTjdDLEtBQUssQ0FBRSw0QkFBNEIsQ0FBRSxHQUFHLEVBQUU7SUFDM0M7SUFDQUEsS0FBSyxDQUFFLG1CQUFtQixDQUFFLEdBQUc4QyxzQkFBc0I7SUFDckR2RixNQUFNLENBQUVZLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLG1CQUFvQixDQUFDLEdBQUcsd0JBQXlCLENBQUMsQ0FBQ2dELE1BQU0sQ0FBRUQsWUFBWSxDQUFFckQsS0FBTSxDQUFFLENBQUM7RUFDckksQ0FBRSxDQUFDO0VBQ0pRLE9BQU8sQ0FBQ2MsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUEwQjs7RUFFNUNpQyxvQ0FBb0MsQ0FBRWhHLE1BQU8sQ0FBQyxDQUFDLENBQU07QUFDdEQ7O0FBR0M7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQyxTQUFTd0YsZ0RBQWdEQSxDQUFFSCxjQUFjLEVBQUVDLGtCQUFrQixFQUFFQyxzQkFBc0IsRUFBRTtFQUV0SDtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQUlVLDhCQUE4QixHQUFHTixFQUFFLENBQUNDLFFBQVEsQ0FBRSwwQ0FBMkMsQ0FBQztFQUU5RjVGLE1BQU0sQ0FBRSwrQ0FBZ0QsQ0FBQyxDQUFDa0UsSUFBSSxDQUM3QytCLDhCQUE4QixDQUFFO0lBQzVCLG1CQUFtQixFQUFNWCxrQkFBa0I7SUFDM0MsdUJBQXVCLEVBQUVDO0VBQzdCLENBQUUsQ0FDSixDQUFDOztFQUVoQjtFQUNBLElBQUlXLDBDQUEwQyxHQUFHUCxFQUFFLENBQUNDLFFBQVEsQ0FBRSxzREFBdUQsQ0FBQztFQUV0SDVGLE1BQU0sQ0FBRSwyREFBNEQsQ0FBQyxDQUFDa0UsSUFBSSxDQUN6RGdDLDBDQUEwQyxDQUFFO0lBQ3hDLG1CQUFtQixFQUFNWixrQkFBa0I7SUFDM0MsdUJBQXVCLEVBQUVDO0VBQzdCLENBQUUsQ0FDSixDQUFDO0VBQ2hCO0FBRUQ7O0FBR0Q7QUFDQTtBQUNBO0FBQ0EsU0FBU0gsNkJBQTZCQSxDQUFFZSxPQUFPLEVBQUU7RUFFaER4QixzQ0FBc0MsQ0FBQyxDQUFDO0VBRXhDM0UsTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRSxDQUFDLENBQUNtQixJQUFJLENBQ25FLDJFQUEyRSxHQUMxRWlDLE9BQU8sR0FDUixRQUNGLENBQUM7QUFDWDs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyxnREFBZ0RBLENBQUc3RCxVQUFVLEVBQUU7RUFFdkU7RUFDQUMsQ0FBQyxDQUFDcEMsSUFBSSxDQUFFbUMsVUFBVSxFQUFFLFVBQVdFLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUc7SUFDckQ7SUFDQS9CLHdCQUF3QixDQUFDeUIsZ0JBQWdCLENBQUVLLEtBQUssRUFBRUQsS0FBTSxDQUFDO0VBQzFELENBQUMsQ0FBQzs7RUFFRjtFQUNBTyxvQ0FBb0MsQ0FBQyxDQUFDO0FBQ3ZDOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU3FELGlDQUFpQ0EsQ0FBRUMsV0FBVyxFQUFFO0VBRXhERixnREFBZ0QsQ0FBRTtJQUN6QyxVQUFVLEVBQUVFO0VBQ2IsQ0FBRSxDQUFDO0FBQ1o7O0FBR0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsZ0RBQWdEQSxDQUFFQyxVQUFVLEVBQUc7RUFFdkU7RUFDQUosZ0RBQWdELENBQUU7SUFDeEMsU0FBUyxFQUFJcEcsTUFBTSxDQUFFd0csVUFBVyxDQUFDLENBQUNDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZDLFVBQVUsRUFBRTtFQUNiLENBQUUsQ0FBQztBQUNiOztBQUVDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0MsSUFBSUMsNENBQTRDLEdBQUcsWUFBVztFQUU3RCxJQUFJQyxZQUFZLEdBQUcsQ0FBQztFQUVwQixPQUFPLFVBQVdILFVBQVUsRUFBRUksV0FBVyxFQUFFO0lBRTFDO0lBQ0FBLFdBQVcsR0FBRyxPQUFPQSxXQUFXLEtBQUssV0FBVyxHQUFHQSxXQUFXLEdBQUcsSUFBSTtJQUVyRUMsWUFBWSxDQUFFRixZQUFhLENBQUMsQ0FBQyxDQUFFOztJQUUvQjtJQUNBQSxZQUFZLEdBQUdHLFVBQVUsQ0FBRVAsZ0RBQWdELENBQUNRLElBQUksQ0FBRyxJQUFJLEVBQUVQLFVBQVcsQ0FBQyxFQUFFSSxXQUFZLENBQUM7RUFDckgsQ0FBQztBQUNGLENBQUMsQ0FBQyxDQUFDOztBQUdKO0FBQ0E7O0FBRUM7QUFDRDtBQUNBO0FBQ0E7QUFDQyxTQUFTbEMsZ0NBQWdDQSxDQUFBLEVBQUc7RUFFM0MsSUFBSyxVQUFVLEtBQUssT0FBUXNDLDBCQUEyQixFQUFHO0lBQ3pEQSwwQkFBMEIsQ0FBRSxxQkFBc0IsQ0FBQztFQUNwRDtFQUVBQyxtQ0FBbUMsQ0FBQyxDQUFDO0VBQ3JDQyxtQ0FBbUMsQ0FBQyxDQUFDO0VBRXJDQyxvQ0FBb0MsQ0FBQyxDQUFDOztFQUV0QztFQUNBbkgsTUFBTSxDQUFFLHNCQUF1QixDQUFDLENBQUNDLEVBQUUsQ0FDbEMsUUFBUSxFQUNSLFVBQVVtSCxLQUFLLEVBQUU7SUFDaEJoQixnREFBZ0QsQ0FDL0M7TUFDQyxrQkFBa0IsRUFBRXBHLE1BQU0sQ0FBRSxJQUFLLENBQUMsQ0FBQ3lHLEdBQUcsQ0FBQyxDQUFDO01BQ3hDLFVBQVUsRUFBVTtJQUNyQixDQUNELENBQUM7RUFDRixDQUNELENBQUM7O0VBRUQ7RUFDQXpHLE1BQU0sQ0FBRSx1QkFBd0IsQ0FBQyxDQUFDQyxFQUFFLENBQ25DLFFBQVEsRUFDUixVQUFVbUgsS0FBSyxFQUFFO0lBQ2hCaEIsZ0RBQWdELENBQUU7TUFBRSxXQUFXLEVBQUVwRyxNQUFNLENBQUUsSUFBSyxDQUFDLENBQUN5RyxHQUFHLENBQUM7SUFBRSxDQUFFLENBQUM7RUFDMUYsQ0FDRCxDQUFDO0FBQ0Y7O0FBR0Q7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTWSxzQ0FBc0NBLENBQUEsRUFBRTtFQUVoRHJFLG9DQUFvQyxDQUFDLENBQUMsQ0FBQyxDQUFHO0FBQzNDOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFNBQVMyQixzQ0FBc0NBLENBQUEsRUFBRTtFQUNoRDNFLE1BQU0sQ0FBRSw2QkFBOEIsQ0FBQyxDQUFDVyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQWtCO0VBQ2pFWCxNQUFNLENBQUVZLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLG1CQUFvQixDQUFLLENBQUMsQ0FBQ21CLElBQUksQ0FBRSxFQUFHLENBQUM7RUFDdkZsRSxNQUFNLENBQUVZLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLHNCQUF1QixDQUFFLENBQUMsQ0FBQ21CLElBQUksQ0FBRSxFQUFHLENBQUM7QUFDeEY7O0FBR0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNvRCxtQ0FBbUNBLENBQUVDLGVBQWUsRUFBRUMsZUFBZSxFQUFFO0VBRS9FQSxlQUFlLEdBQUdBLGVBQWUsQ0FBQ0MsSUFBSSxDQUFDLENBQUMsQ0FBQ0MsV0FBVyxDQUFDLENBQUM7RUFDdEQsSUFBSyxDQUFDLElBQUlGLGVBQWUsQ0FBQ0csTUFBTSxFQUFFO0lBQ2pDLE9BQU9KLGVBQWU7RUFDdkI7O0VBRUE7RUFDQSxJQUFJSyxZQUFZLEdBQUcsSUFBSUMsTUFBTSxDQUFFLDBCQUEwQkwsZUFBZSxRQUFRLEVBQUUsS0FBTSxDQUFDOztFQUV6RjtFQUNBLElBQUlNLE9BQU8sR0FBR1AsZUFBZSxDQUFDRyxXQUFXLENBQUMsQ0FBQyxDQUFDSyxRQUFRLENBQUVILFlBQWEsQ0FBQztFQUNuRUUsT0FBTyxHQUFHRSxLQUFLLENBQUNDLElBQUksQ0FBRUgsT0FBUSxDQUFDO0VBRWhDLElBQUlJLFdBQVcsR0FBRyxFQUFFO0VBQ3BCLElBQUlDLFlBQVksR0FBRyxDQUFDO0VBQ3BCLElBQUlDLGdCQUFnQjtFQUNwQixJQUFJQyxjQUFjO0VBRWxCLEtBQU0sTUFBTUMsS0FBSyxJQUFJUixPQUFPLEVBQUU7SUFFN0JNLGdCQUFnQixHQUFHRSxLQUFLLENBQUNqSSxLQUFLLEdBQUdpSSxLQUFLLENBQUUsQ0FBQyxDQUFFLENBQUNaLFdBQVcsQ0FBQyxDQUFDLENBQUNhLE9BQU8sQ0FBRSxHQUFHLEVBQUUsQ0FBRSxDQUFDLEdBQUcsQ0FBQztJQUUvRUwsV0FBVyxDQUFDTSxJQUFJLENBQUVqQixlQUFlLENBQUNrQixNQUFNLENBQUVOLFlBQVksRUFBR0MsZ0JBQWdCLEdBQUdELFlBQWMsQ0FBRSxDQUFDO0lBRTdGRSxjQUFjLEdBQUdkLGVBQWUsQ0FBQ0csV0FBVyxDQUFDLENBQUMsQ0FBQ2EsT0FBTyxDQUFFLEdBQUcsRUFBRUgsZ0JBQWlCLENBQUM7SUFFL0VGLFdBQVcsQ0FBQ00sSUFBSSxDQUFFLGlEQUFpRCxHQUFHakIsZUFBZSxDQUFDa0IsTUFBTSxDQUFFTCxnQkFBZ0IsRUFBR0MsY0FBYyxHQUFHRCxnQkFBa0IsQ0FBQyxHQUFHLFNBQVUsQ0FBQztJQUVuS0QsWUFBWSxHQUFHRSxjQUFjO0VBQzlCO0VBRUFILFdBQVcsQ0FBQ00sSUFBSSxDQUFFakIsZUFBZSxDQUFDa0IsTUFBTSxDQUFFTixZQUFZLEVBQUdaLGVBQWUsQ0FBQ0ksTUFBTSxHQUFHUSxZQUFjLENBQUUsQ0FBQztFQUVuRyxPQUFPRCxXQUFXLENBQUNRLElBQUksQ0FBRSxFQUFHLENBQUM7QUFDOUI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MseUJBQXlCQSxDQUFFQyxJQUFJLEVBQUU7RUFDekMsSUFBSUMsUUFBUSxHQUFHQyxRQUFRLENBQUNDLGFBQWEsQ0FBRSxVQUFXLENBQUM7RUFDbkRGLFFBQVEsQ0FBQ0csU0FBUyxHQUFHSixJQUFJO0VBQ3pCLE9BQU9DLFFBQVEsQ0FBQ0ksS0FBSztBQUN0Qjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyx5QkFBeUJBLENBQUNOLElBQUksRUFBRTtFQUN2QyxJQUFJQyxRQUFRLEdBQUdDLFFBQVEsQ0FBQ0MsYUFBYSxDQUFDLFVBQVUsQ0FBQztFQUNqREYsUUFBUSxDQUFDTSxTQUFTLEdBQUdQLElBQUk7RUFDekIsT0FBT0MsUUFBUSxDQUFDRyxTQUFTO0FBQzNCOztBQUdBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBUzVGLDhDQUE4Q0EsQ0FBQSxFQUFFO0VBQ3hEcEQsTUFBTSxDQUFFLDBEQUEwRCxDQUFDLENBQUNvSixXQUFXLENBQUUsc0JBQXVCLENBQUM7QUFDMUc7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBU3BGLDhDQUE4Q0EsQ0FBQSxFQUFFO0VBQ3hEaEUsTUFBTSxDQUFFLDBEQUEyRCxDQUFDLENBQUNxSixRQUFRLENBQUUsc0JBQXVCLENBQUM7QUFDeEc7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBU2hHLHlDQUF5Q0EsQ0FBQSxFQUFFO0VBRW5ELElBQUlpRyxZQUFZLEdBQUdSLFFBQVEsQ0FBQ1MsY0FBYyxDQUFFLGNBQWUsQ0FBQztFQUU1RCxJQUFLLENBQUVELFlBQVksRUFBRztJQUNyQjtFQUNEO0VBRUFyRix5Q0FBeUMsQ0FBQyxDQUFDO0VBRTNDLElBQUl1RixpQkFBaUIsR0FBRyxFQUFFO0VBQzFCLElBQ00sV0FBVyxLQUFLLE9BQU81SSx3QkFBd0IsSUFDL0MsVUFBVSxLQUFLLE9BQU9BLHdCQUF3QixDQUFDbUMsZUFBaUIsRUFDcEU7SUFDRHlHLGlCQUFpQixHQUFHNUksd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsbUJBQW9CLENBQUM7RUFDcEY7RUFFQSxJQUNJeUcsaUJBQWlCLElBQ2pCeEosTUFBTSxDQUFFd0osaUJBQWtCLENBQUMsQ0FBQ0MsSUFBSSxDQUFFLCtCQUFnQyxDQUFDLENBQUM5QixNQUFNLEVBQzVFO0lBQ0Q7RUFDRDtFQUVBLElBQUkrQixhQUFhLEdBQUcsY0FBYyxHQUFLLElBQUlDLElBQUksQ0FBQyxDQUFDLENBQUdDLE9BQU8sQ0FBQyxDQUFDO0VBRTdENUosTUFBTSxDQUFFc0osWUFBYSxDQUFDLENBQUN2RCxNQUFNLENBQzVCLFdBQVcsR0FBRzJELGFBQWEsR0FBRyxtRUFBbUUsR0FDaEcsMERBQTBELEdBQ3pELHVEQUF1RCxHQUN0RCw0R0FBNEcsR0FDNUcsaUVBQWlFLEdBQ2hFLDRIQUE0SCxHQUM3SCw2QkFBNkIsR0FDOUIsUUFBUSxHQUNULFFBQVEsR0FDVCxRQUNELENBQUM7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTekYseUNBQXlDQSxDQUFBLEVBQUU7RUFDbkRqRSxNQUFNLENBQUUscUNBQXNDLENBQUMsQ0FBQzZKLE1BQU0sQ0FBQyxDQUFDO0VBQ3hEN0osTUFBTSxDQUFFLHlDQUEwQyxDQUFDLENBQUM4SixPQUFPLENBQUUsMkNBQTRDLENBQUMsQ0FBQ0QsTUFBTSxDQUFDLENBQUM7QUFDcEg7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNFLDJDQUEyQ0EsQ0FBQSxFQUFFO0VBQ2xELElBQUsvSixNQUFNLENBQUUsMERBQTJELENBQUMsQ0FBQ2dLLFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQyxFQUFFO0lBQ2hILE9BQU8sSUFBSTtFQUNaLENBQUMsTUFBTTtJQUNOLE9BQU8sS0FBSztFQUNiO0FBQ0QiLCJpZ25vcmVMaXN0IjpbXX0=
