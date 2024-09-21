"use strict";

function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
jQuery('body').on({
  'touchmove': function touchmove(e) {
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

  /*
  //FixIn: forVideo
  if ( ! is_this_action ){
  	//wpbc_ajx_booking__actual_listing__hide();
  	jQuery( wpbc_ajx_booking_listing.get_other_param( 'listing_container' ) ).html(
  		'<div style="width:100%;text-align: center;" id="wpbc_loading_section"><span class="wpbc_icn_autorenew wpbc_spin"></span></div>'
  		+ jQuery( wpbc_ajx_booking_listing.get_other_param( 'listing_container' ) ).html()
  	);
  	if ( 'function' === typeof (jQuery( '#wpbc_loading_section' ).wpbc_my_modal) ){			//FixIn: 9.0.1.5
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

    console.log(' == Response WPBC_AJX_BOOKING_LISTING == ', response_data);
    console.groupEnd();
    // Probably Error
    if (_typeof(response_data) !== 'object' || response_data === null) {
      jQuery('.wpbc_ajx_under_toolbar_row').hide(); //FixIn: 9.6.1.5
      jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html('<div class="wpbc-settings-notice notice-warning" style="text-align:left">' + response_data + '</div>');
      return;
    }

    // Reload page, after filter toolbar was reseted
    if (undefined != response_data['ajx_cleaned_params'] && 'reset_done' === response_data['ajx_cleaned_params']['ui_reset']) {
      location.reload();
      return;
    }

    // Show listing
    if (response_data['ajx_count'] > 0) {
      wpbc_ajx_booking_show_listing(response_data['ajx_items'], response_data['ajx_search_params'], response_data['ajx_booking_resources']);
      wpbc_pagination_echo(wpbc_ajx_booking_listing.get_other_param('pagination_container'), {
        'page_active': response_data['ajx_search_params']['page_num'],
        'pages_count': Math.ceil(response_data['ajx_count'] / response_data['ajx_search_params']['page_items_count']),
        'page_items_count': response_data['ajx_search_params']['page_items_count'],
        'sort_type': response_data['ajx_search_params']['sort_type']
      });
      wpbc_ajx_booking_define_ui_hooks(); // Redefine Hooks, because we show new DOM elements
    } else {
      wpbc_ajx_booking__actual_listing__hide();
      jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html('<div class="wpbc-settings-notice0 notice-warning0" style="text-align:center;margin-left:-50px;">' + '<strong>' + 'No results found for current filter options...' + '</strong>' +
      //'<strong>' + 'No results found...' + '</strong>' +
      '</div>');
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
    jQuery('#ajax_respond').html(response_data); // For ability to show response, add such DIV element to page
  }).fail(function (jqXHR, textStatus, errorThrown) {
    if (window.console && window.console.log) {
      console.log('Ajax_Error', jqXHR, textStatus, errorThrown);
    }
    jQuery('.wpbc_ajx_under_toolbar_row').hide(); //FixIn: 9.6.1.5
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
  jQuery('.wpbc_ajx_under_toolbar_row').css("display", "flex"); //FixIn: 9.6.1.5
  var list_header_tpl = wp.template('wpbc_ajx_booking_list_header');
  var list_row_tpl = wp.template('wpbc_ajx_booking_list_row');

  // Header
  jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html(list_header_tpl());

  // Body
  jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).append('<div class="wpbc_selectable_body"></div>');

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
  // Change booking resource
  var change_booking_resource_tpl = wp.template('wpbc_ajx_change_booking_resource');
  jQuery('#wpbc_hidden_template__change_booking_resource').html(change_booking_resource_tpl({
    'ajx_search_params': json_search_params,
    'ajx_booking_resources': json_booking_resources
  }));

  // Duplicate booking resource
  var duplicate_booking_to_other_resource_tpl = wp.template('wpbc_ajx_duplicate_booking_to_other_resource');
  jQuery('#wpbc_hidden_template__duplicate_booking_to_other_resource').html(duplicate_booking_to_other_resource_tpl({
    'ajx_search_params': json_search_params,
    'ajx_booking_resources': json_booking_resources
  }));
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
    wpbc_define_tippy_tooltips('.wpbc_listing_container ');
  }
  wpbc_ajx_booking__ui_define__locale();
  wpbc_ajx_booking__ui_define__remark();

  // Items Per Page
  jQuery('.wpbc_items_per_page').on('change', function (event) {
    wpbc_ajx_booking_send_search_request_with_params({
      'page_items_count': jQuery(this).val(),
      'page_num': 1
    });
  });

  // Sorting
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
  jQuery('.wpbc_ajx_under_toolbar_row').hide(); //FixIn: 9.6.1.5
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
  var keywordRegex = new RegExp("fieldvalue[^<>]*>([^<]*".concat(booking_keyword, "[^<]*)"), 'gim');

  //let matches = [...booking_details.toLowerCase().matchAll( keywordRegex )];
  var matches = booking_details.toLowerCase().matchAll(keywordRegex);
  matches = Array.from(matches);
  var strings_arr = [];
  var pos_previous = 0;
  var search_pos_start;
  var search_pos_end;
  var _iterator = _createForOfIteratorHelper(matches),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var match = _step.value;
      search_pos_start = match.index + match[0].toLowerCase().indexOf('>', 0) + 1;
      strings_arr.push(booking_details.substr(pos_previous, search_pos_start - pos_previous));
      search_pos_end = booking_details.toLowerCase().indexOf('<', search_pos_start);
      strings_arr.push('<span class="fieldvalue name fieldsearchvalue">' + booking_details.substr(search_pos_start, search_pos_end - search_pos_start) + '</span>');
      pos_previous = search_pos_end;
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19saXN0aW5nLmpzIiwibmFtZXMiOlsiX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXIiLCJvIiwiYWxsb3dBcnJheUxpa2UiLCJpdCIsIlN5bWJvbCIsIml0ZXJhdG9yIiwiQXJyYXkiLCJpc0FycmF5IiwiX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5IiwibGVuZ3RoIiwiaSIsIkYiLCJzIiwibiIsImRvbmUiLCJ2YWx1ZSIsImUiLCJfZSIsImYiLCJUeXBlRXJyb3IiLCJub3JtYWxDb21wbGV0aW9uIiwiZGlkRXJyIiwiZXJyIiwiY2FsbCIsInN0ZXAiLCJuZXh0IiwiX2UyIiwibWluTGVuIiwiX2FycmF5TGlrZVRvQXJyYXkiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJ0b1N0cmluZyIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJuYW1lIiwiZnJvbSIsInRlc3QiLCJhcnIiLCJsZW4iLCJhcnIyIiwiX3R5cGVvZiIsIm9iaiIsImpRdWVyeSIsIm9uIiwidG91Y2htb3ZlIiwiZWFjaCIsImluZGV4IiwidGRfZWwiLCJnZXQiLCJ1bmRlZmluZWQiLCJfdGlwcHkiLCJpbnN0YW5jZSIsImhpZGUiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCIkIiwicF9zZWN1cmUiLCJzZWN1cml0eV9vYmoiLCJ1c2VyX2lkIiwibm9uY2UiLCJsb2NhbGUiLCJzZXRfc2VjdXJlX3BhcmFtIiwicGFyYW1fa2V5IiwicGFyYW1fdmFsIiwiZ2V0X3NlY3VyZV9wYXJhbSIsInBfbGlzdGluZyIsInNlYXJjaF9yZXF1ZXN0X29iaiIsInNvcnQiLCJzb3J0X3R5cGUiLCJwYWdlX251bSIsInBhZ2VfaXRlbXNfY291bnQiLCJjcmVhdGVfZGF0ZSIsImtleXdvcmQiLCJzb3VyY2UiLCJzZWFyY2hfc2V0X2FsbF9wYXJhbXMiLCJyZXF1ZXN0X3BhcmFtX29iaiIsInNlYXJjaF9nZXRfYWxsX3BhcmFtcyIsInNlYXJjaF9nZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtIiwic2VhcmNoX3NldF9wYXJhbXNfYXJyIiwicGFyYW1zX2FyciIsIl8iLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwicF9vdGhlciIsIm90aGVyX29iaiIsInNldF9vdGhlcl9wYXJhbSIsImdldF9vdGhlcl9wYXJhbSIsIndwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJ3cGJjX2FqeF9sb2NhbGUiLCJzZWFyY2hfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwiaHRtbCIsImxvY2F0aW9uIiwicmVsb2FkIiwid3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmciLCJ3cGJjX3BhZ2luYXRpb25fZWNobyIsIk1hdGgiLCJjZWlsIiwid3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSIsImFqeF9uZXdfYm9va2luZ3NfY291bnQiLCJwYXJzZUludCIsInNob3ciLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwiZmFpbCIsImVycm9yVGhyb3duIiwid2luZG93IiwiZXJyb3JfbWVzc2FnZSIsInJlc3BvbnNlVGV4dCIsInJlcGxhY2UiLCJ3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSIsImpzb25faXRlbXNfYXJyIiwianNvbl9zZWFyY2hfcGFyYW1zIiwianNvbl9ib29raW5nX3Jlc291cmNlcyIsIndwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbiIsImNzcyIsImxpc3RfaGVhZGVyX3RwbCIsIndwIiwidGVtcGxhdGUiLCJsaXN0X3Jvd190cGwiLCJhcHBlbmQiLCJ3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24iLCJjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV90cGwiLCJkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV90cGwiLCJtZXNzYWdlIiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwid3BiY19hanhfYm9va2luZ19wYWdpbmF0aW9uX2NsaWNrIiwicGFnZV9udW1iZXIiLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQiLCJlbGVtZW50X2lkIiwidmFsIiwid3BiY19hanhfYm9va2luZ19zZWFyY2hpbmdfYWZ0ZXJfZmV3X3NlY29uZHMiLCJjbG9zZWRfdGltZXIiLCJ0aW1lcl9kZWxheSIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJiaW5kIiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJ3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX2xvY2FsZSIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrIiwiZXZlbnQiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdyIsIndwYmNfZ2V0X2hpZ2hsaWdodGVkX3NlYXJjaF9rZXl3b3JkIiwiYm9va2luZ19kZXRhaWxzIiwiYm9va2luZ19rZXl3b3JkIiwidHJpbSIsInRvTG93ZXJDYXNlIiwia2V5d29yZFJlZ2V4IiwiUmVnRXhwIiwiY29uY2F0IiwibWF0Y2hlcyIsIm1hdGNoQWxsIiwic3RyaW5nc19hcnIiLCJwb3NfcHJldmlvdXMiLCJzZWFyY2hfcG9zX3N0YXJ0Iiwic2VhcmNoX3Bvc19lbmQiLCJfaXRlcmF0b3IiLCJfc3RlcCIsIm1hdGNoIiwiaW5kZXhPZiIsInB1c2giLCJzdWJzdHIiLCJqb2luIiwid3BiY19kZWNvZGVfSFRNTF9lbnRpdGllcyIsInRleHQiLCJ0ZXh0QXJlYSIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsIndwYmNfZW5jb2RlX0hUTUxfZW50aXRpZXMiLCJpbm5lclRleHQiLCJyZW1vdmVDbGFzcyIsImFkZENsYXNzIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9faXNfc3BpbiIsImhhc0NsYXNzIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fc3JjL2Jvb2tpbmdzX19saXN0aW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxualF1ZXJ5KCdib2R5Jykub24oe1xyXG4gICAgJ3RvdWNobW92ZSc6IGZ1bmN0aW9uKGUpIHtcclxuXHJcblx0XHRqUXVlcnkoICcudGltZXNwYXJ0bHknICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApe1xyXG5cclxuXHRcdFx0dmFyIHRkX2VsID0galF1ZXJ5KCB0aGlzICkuZ2V0KCAwICk7XHJcblxyXG5cdFx0XHRpZiAoICh1bmRlZmluZWQgIT0gdGRfZWwuX3RpcHB5KSApe1xyXG5cclxuXHRcdFx0XHR2YXIgaW5zdGFuY2UgPSB0ZF9lbC5fdGlwcHk7XHJcblx0XHRcdFx0aW5zdGFuY2UuaGlkZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBSZXF1ZXN0IE9iamVjdFxyXG4gKiBIZXJlIHdlIGNhbiAgZGVmaW5lIFNlYXJjaCBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxudmFyIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyA9IChmdW5jdGlvbiAoIG9iaiwgJCkge1xyXG5cclxuXHQvLyBTZWN1cmUgcGFyYW1ldGVycyBmb3IgQWpheFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfc2VjdXJlID0gb2JqLnNlY3VyaXR5X29iaiA9IG9iai5zZWN1cml0eV9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1c2VyX2lkOiAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRub25jZSAgOiAnJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxlIDogJydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfTtcclxuXHJcblx0b2JqLnNldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9zZWN1cmVbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBMaXN0aW5nIFNlYXJjaCBwYXJhbWV0ZXJzXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9saXN0aW5nID0gb2JqLnNlYXJjaF9yZXF1ZXN0X29iaiA9IG9iai5zZWFyY2hfcmVxdWVzdF9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3J0ICAgICAgICAgICAgOiBcImJvb2tpbmdfaWRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0c29ydF90eXBlICAgICAgIDogXCJERVNDXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhZ2VfbnVtICAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhZ2VfaXRlbXNfY291bnQ6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVfZGF0ZSAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRrZXl3b3JkICAgICAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3VyY2UgICAgICAgICAgOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9hbGxfcGFyYW1zID0gZnVuY3Rpb24gKCByZXF1ZXN0X3BhcmFtX29iaiApIHtcclxuXHRcdHBfbGlzdGluZyA9IHJlcXVlc3RfcGFyYW1fb2JqO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9saXN0aW5nO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfZ2V0X3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9saXN0aW5nWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHQvLyBpZiAoIEFycmF5LmlzQXJyYXkoIHBhcmFtX3ZhbCApICl7XHJcblx0XHQvLyBcdHBhcmFtX3ZhbCA9IEpTT04uc3RyaW5naWZ5KCBwYXJhbV92YWwgKTtcclxuXHRcdC8vIH1cclxuXHRcdHBfbGlzdGluZ1sgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfcGFyYW1zX2FyciA9IGZ1bmN0aW9uKCBwYXJhbXNfYXJyICl7XHJcblx0XHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBEZWZpbmUgZGlmZmVyZW50IFNlYXJjaCAgcGFyYW1ldGVycyBmb3IgcmVxdWVzdFxyXG5cdFx0XHR0aGlzLnNlYXJjaF9zZXRfcGFyYW0oIHBfa2V5LCBwX3ZhbCApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIE90aGVyIHBhcmFtZXRlcnMgXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfb3RoZXIgPSBvYmoub3RoZXJfb2JqID0gb2JqLm90aGVyX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9vdGhlclsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXJbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG59KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcgfHwge30sIGpRdWVyeSApKTtcclxuXHJcblxyXG4vKipcclxuICogICBBamF4ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggc2VhcmNoIHJlcXVlc3RcclxuICogZm9yIHNlYXJjaGluZyBzcGVjaWZpYyBLZXl3b3JkIGFuZCBvdGhlciBwYXJhbXNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCgpe1xyXG5cclxuY29uc29sZS5ncm91cENvbGxhcHNlZCgnQUpYX0JPT0tJTkdfTElTVElORycpOyBjb25zb2xlLmxvZyggJyA9PSBCZWZvcmUgQWpheCBTZW5kIC0gc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgPT0gJyAsIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSApO1xyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG4vKlxyXG4vL0ZpeEluOiBmb3JWaWRlb1xyXG5pZiAoICEgaXNfdGhpc19hY3Rpb24gKXtcclxuXHQvL3dwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0JzxkaXYgc3R5bGU9XCJ3aWR0aDoxMDAlO3RleHQtYWxpZ246IGNlbnRlcjtcIiBpZD1cIndwYmNfbG9hZGluZ19zZWN0aW9uXCI+PHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9hdXRvcmVuZXcgd3BiY19zcGluXCI+PC9zcGFuPjwvZGl2PidcclxuXHRcdCsgalF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKClcclxuXHQpO1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIChqUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCkgKXtcdFx0XHQvL0ZpeEluOiA5LjAuMS41XHJcblx0XHRqUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCggJ3Nob3cnICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGFsZXJ0KCAnV2FybmluZyEgQm9va2luZyBDYWxlbmRhci4gSXRzIHNlZW1zIHRoYXQgIHlvdSBoYXZlIGRlYWN0aXZhdGVkIGxvYWRpbmcgb2YgQm9vdHN0cmFwIEpTIGZpbGVzIGF0IEJvb2tpbmcgU2V0dGluZ3MgR2VuZXJhbCBwYWdlIGluIEFkdmFuY2VkIHNlY3Rpb24uJyApXHJcblx0fVxyXG59XHJcbmlzX3RoaXNfYWN0aW9uID0gZmFsc2U7XHJcbiovXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9CT09LSU5HX0xJU1RJTkcnLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X2xvY2FsZSA6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdHNlYXJjaF9wYXJhbXNcdDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjZy5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcbi8vRml4SW46IGZvclZpZGVvXHJcbi8valF1ZXJ5KCAnI3dwYmNfbG9hZGluZ19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdoaWRlJyApO1xyXG5cclxuY29uc29sZS5sb2coICcgPT0gUmVzcG9uc2UgV1BCQ19BSlhfQk9PS0lOR19MSVNUSU5HID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA5LjYuMS41XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBSZWxvYWQgcGFnZSwgYWZ0ZXIgZmlsdGVyIHRvb2xiYXIgd2FzIHJlc2V0ZWRcclxuXHRcdFx0XHRcdGlmICggICAgICAgKCAgICAgdW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0pXHJcblx0XHRcdFx0XHRcdFx0JiYgKCAncmVzZXRfZG9uZScgPT09IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICd1aV9yZXNldCcgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdGxvY2F0aW9uLnJlbG9hZCgpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBsaXN0aW5nXHJcblx0XHRcdFx0XHRpZiAoIHJlc3BvbnNlX2RhdGFbICdhanhfY291bnQnIF0gPiAwICl7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3Nob3dfbGlzdGluZyggcmVzcG9uc2VfZGF0YVsgJ2FqeF9pdGVtcycgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdLCByZXNwb25zZV9kYXRhWyAnYWp4X2Jvb2tpbmdfcmVzb3VyY2VzJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX3BhZ2luYXRpb25fZWNobyhcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAncGFnaW5hdGlvbl9jb250YWluZXInICksXHJcblx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0J3BhZ2VfYWN0aXZlJzogcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdWyAncGFnZV9udW0nIF0sXHJcblx0XHRcdFx0XHRcdFx0XHQncGFnZXNfY291bnQnOiBNYXRoLmNlaWwoIHJlc3BvbnNlX2RhdGFbICdhanhfY291bnQnIF0gLyByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX2l0ZW1zX2NvdW50JyBdICksXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0J3BhZ2VfaXRlbXNfY291bnQnOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX2l0ZW1zX2NvdW50JyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NvcnRfdHlwZScgICAgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdzb3J0X3R5cGUnIF1cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzKCk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MsIGJlY2F1c2Ugd2Ugc2hvdyBuZXcgRE9NIGVsZW1lbnRzXHJcblxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2UwIG5vdGljZS13YXJuaW5nMFwiIHN0eWxlPVwidGV4dC1hbGlnbjpjZW50ZXI7bWFyZ2luLWxlZnQ6LTUwcHg7XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8c3Ryb25nPicgKyAnTm8gcmVzdWx0cyBmb3VuZCBmb3IgY3VycmVudCBmaWx0ZXIgb3B0aW9ucy4uLicgKyAnPC9zdHJvbmc+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vJzxzdHJvbmc+JyArICdObyByZXN1bHRzIGZvdW5kLi4uJyArICc8L3N0cm9uZz4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gVXBkYXRlIG5ldyBib29raW5nIGNvdW50XHJcblx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9uZXdfYm9va2luZ3NfY291bnQnIF0gKXtcclxuXHRcdFx0XHRcdFx0dmFyIGFqeF9uZXdfYm9va2luZ3NfY291bnQgPSBwYXJzZUludCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9uZXdfYm9va2luZ3NfY291bnQnIF0gKVxyXG5cdFx0XHRcdFx0XHRpZiAoYWp4X25ld19ib29raW5nc19jb3VudD4wKXtcclxuXHRcdFx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19iYWRnZV9jb3VudCcgKS5zaG93KCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLmJrLXVwZGF0ZS1jb3VudCcgKS5odG1sKCBhanhfbmV3X2Jvb2tpbmdzX2NvdW50ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cclxuXHRcdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA5LjYuMS41XHJcblx0XHRcdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhJyArICc8L3N0cm9uZz4gJyArIGVycm9yVGhyb3duIDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0ganFYSFIucmVzcG9uc2VUZXh0O1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdFx0ICB9KVxyXG5cdCAgICAgICAgICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHRcdCAgLy8gLmFsd2F5cyggZnVuY3Rpb24gKCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ2Fsd2F5cyBmaW5pc2hlZCcsIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICk7IH0gICAgIH0pXHJcblx0XHRcdCAgOyAgLy8gRW5kIEFqYXhcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNob3cgTGlzdGluZyBUYWJsZSBcdFx0YW5kIGRlZmluZSBnTWFpbCBjaGVja2JveCBob29rc1xyXG4gKlxyXG4gKiBAcGFyYW0ganNvbl9pdGVtc19hcnJcdFx0LSBKU09OIG9iamVjdCB3aXRoIEl0ZW1zXHJcbiAqIEBwYXJhbSBqc29uX3NlYXJjaF9wYXJhbXNcdC0gSlNPTiBvYmplY3Qgd2l0aCBTZWFyY2hcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19saXN0aW5nKCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zLCBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzICl7XHJcblxyXG5cdHdwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbigganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApO1xyXG5cclxuLy9jb25zb2xlLmxvZyggJ2pzb25faXRlbXNfYXJyJyAsIGpzb25faXRlbXNfYXJyLCBqc29uX3NlYXJjaF9wYXJhbXMgKTtcclxuXHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuY3NzKCBcImRpc3BsYXlcIiwgXCJmbGV4XCIgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDkuNi4xLjVcclxuXHR2YXIgbGlzdF9oZWFkZXJfdHBsID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9ib29raW5nX2xpc3RfaGVhZGVyJyApO1xyXG5cdHZhciBsaXN0X3Jvd190cGwgICAgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2Jvb2tpbmdfbGlzdF9yb3cnICk7XHJcblxyXG5cclxuXHQvLyBIZWFkZXJcclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoIGxpc3RfaGVhZGVyX3RwbCgpICk7XHJcblxyXG5cdC8vIEJvZHlcclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmFwcGVuZCggJzxkaXYgY2xhc3M9XCJ3cGJjX3NlbGVjdGFibGVfYm9keVwiPjwvZGl2PicgKTtcclxuXHJcblx0Ly8gUiBvIHcgc1xyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnTElTVElOR19ST1dTJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBMSVNUSU5HX1JPV1NcclxuXHRfLmVhY2goIGpzb25faXRlbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YganNvbl9zZWFyY2hfcGFyYW1zWyAna2V5d29yZCcgXSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUGFyYW1ldGVyIGZvciBtYXJraW5nIGtleXdvcmQgd2l0aCBkaWZmZXJlbnQgY29sb3IgaW4gYSBsaXN0XHJcblx0XHRcdHBfdmFsWyAnX19zZWFyY2hfcmVxdWVzdF9rZXl3b3JkX18nIF0gPSBqc29uX3NlYXJjaF9wYXJhbXNbICdrZXl3b3JkJyBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cF92YWxbICdfX3NlYXJjaF9yZXF1ZXN0X2tleXdvcmRfXycgXSA9ICcnO1xyXG5cdFx0fVxyXG5cdFx0cF92YWxbICdib29raW5nX3Jlc291cmNlcycgXSA9IGpzb25fYm9va2luZ19yZXNvdXJjZXM7XHJcblx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSArICcgLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmFwcGVuZCggbGlzdF9yb3dfdHBsKCBwX3ZhbCApICk7XHJcblx0fSApO1xyXG5jb25zb2xlLmdyb3VwRW5kKCk7IFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTElTVElOR19ST1dTXHJcblxyXG5cdHdwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiggalF1ZXJ5ICk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MgZm9yIGNsaWNraW5nIGF0IENoZWNrYm94ZXNcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIHRlbXBsYXRlIGZvciBjaGFuZ2luZyBib29raW5nIHJlc291cmNlcyAmICB1cGRhdGUgaXQgZWFjaCB0aW1lLCAgd2hlbiAgbGlzdGluZyB1cGRhdGluZywgdXNlZnVsICBmb3Igc2hvd2luZyBhY3R1YWwgIGJvb2tpbmcgcmVzb3VyY2VzLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpzb25faXRlbXNfYXJyXHRcdC0gSlNPTiBvYmplY3Qgd2l0aCBJdGVtc1xyXG5cdCAqIEBwYXJhbSBqc29uX3NlYXJjaF9wYXJhbXNcdC0gSlNPTiBvYmplY3Qgd2l0aCBTZWFyY2hcclxuXHQgKiBAcGFyYW0ganNvbl9ib29raW5nX3Jlc291cmNlc1x0LSBKU09OIG9iamVjdCB3aXRoIFJlc291cmNlc1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbigganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApe1xyXG5cclxuXHRcdC8vIENoYW5nZSBib29raW5nIHJlc291cmNlXHJcblx0XHR2YXIgY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfdHBsID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9jaGFuZ2VfYm9va2luZ19yZXNvdXJjZScgKTtcclxuXHJcblx0XHRqUXVlcnkoICcjd3BiY19oaWRkZW5fdGVtcGxhdGVfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlJyApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfdHBsKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X3NlYXJjaF9wYXJhbXMnICAgIDoganNvbl9zZWFyY2hfcGFyYW1zLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ib29raW5nX3Jlc291cmNlcyc6IGpzb25fYm9va2luZ19yZXNvdXJjZXNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9IClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0Ly8gRHVwbGljYXRlIGJvb2tpbmcgcmVzb3VyY2VcclxuXHRcdHZhciBkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV90cGwgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlJyApO1xyXG5cclxuXHRcdGpRdWVyeSggJyN3cGJjX2hpZGRlbl90ZW1wbGF0ZV9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UnICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV90cGwoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgOiBqc29uX3NlYXJjaF9wYXJhbXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2Jvb2tpbmdfcmVzb3VyY2VzJzoganNvbl9ib29raW5nX3Jlc291cmNlc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHR9XHJcblxyXG5cclxuLyoqXHJcbiAqIFNob3cganVzdCBtZXNzYWdlIGluc3RlYWQgb2YgbGlzdGluZyBhbmQgaGlkZSBwYWdpbmF0aW9uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSggbWVzc2FnZSApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSgpO1xyXG5cclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBIIG8gbyBrIHMgIC0gIGl0cyBBY3Rpb24vVGltZXMgd2hlbiBuZWVkIHRvIHJlLVJlbmRlciBWaWV3cyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggU2VhcmNoIFJlcXVlc3QgYWZ0ZXIgVXBkYXRpbmcgc2VhcmNoIHJlcXVlc3QgcGFyYW1ldGVyc1xyXG4gKlxyXG4gKiBAcGFyYW0gcGFyYW1zX2FyclxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zICggcGFyYW1zX2FyciApe1xyXG5cclxuXHQvLyBEZWZpbmUgZGlmZmVyZW50IFNlYXJjaCAgcGFyYW1ldGVycyBmb3IgcmVxdWVzdFxyXG5cdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApIHtcclxuXHRcdC8vY29uc29sZS5sb2coICdSZXF1ZXN0IGZvcjogJywgcF9rZXksIHBfdmFsICk7XHJcblx0XHR3cGJjX2FqeF9ib29raW5nX2xpc3Rpbmcuc2VhcmNoX3NldF9wYXJhbSggcF9rZXksIHBfdmFsICk7XHJcblx0fSk7XHJcblxyXG5cdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0KCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZWFyY2ggcmVxdWVzdCBmb3IgXCJQYWdlIE51bWJlclwiXHJcbiAqIEBwYXJhbSBwYWdlX251bWJlclx0aW50XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3BhZ2luYXRpb25fY2xpY2soIHBhZ2VfbnVtYmVyICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCdwYWdlX251bSc6IHBhZ2VfbnVtYmVyXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEtleXdvcmQgU2VhcmNoaW5nICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlYXJjaCByZXF1ZXN0IGZvciBcIktleXdvcmRcIiwgYWxzbyBzZXQgY3VycmVudCBwYWdlIHRvICAxXHJcbiAqXHJcbiAqIEBwYXJhbSBlbGVtZW50X2lkXHQtXHRIVE1MIElEICBvZiBlbGVtZW50LCAgd2hlcmUgd2FzIGVudGVyZWQga2V5d29yZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X2Zvcl9rZXl3b3JkKCBlbGVtZW50X2lkICkge1xyXG5cclxuXHQvLyBXZSBuZWVkIHRvIFJlc2V0IHBhZ2VfbnVtIHRvIDEgd2l0aCBlYWNoIG5ldyBzZWFyY2gsIGJlY2F1c2Ugd2UgY2FuIGJlIGF0IHBhZ2UgIzQsICBidXQgYWZ0ZXIgIG5ldyBzZWFyY2ggIHdlIGNhbiAgaGF2ZSB0b3RhbGx5ICBvbmx5ICAxIHBhZ2VcclxuXHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdrZXl3b3JkJyAgOiBqUXVlcnkoIGVsZW1lbnRfaWQgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwYWdlX251bSc6IDFcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcbn1cclxuXHJcblx0LyoqXHJcblx0ICogU2VuZCBzZWFyY2ggcmVxdWVzdCBhZnRlciBmZXcgc2Vjb25kcyAodXN1YWxseSBhZnRlciAxLDUgc2VjKVxyXG5cdCAqIENsb3N1cmUgZnVuY3Rpb24uIEl0cyB1c2VmdWwsICBmb3IgZG8gIG5vdCBzZW5kIHRvbyBtYW55IEFqYXggcmVxdWVzdHMsIHdoZW4gc29tZW9uZSBtYWtlIGZhc3QgdHlwaW5nLlxyXG5cdCAqL1xyXG5cdHZhciB3cGJjX2FqeF9ib29raW5nX3NlYXJjaGluZ19hZnRlcl9mZXdfc2Vjb25kcyA9IGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdHZhciBjbG9zZWRfdGltZXIgPSAwO1xyXG5cclxuXHRcdHJldHVybiBmdW5jdGlvbiAoIGVsZW1lbnRfaWQsIHRpbWVyX2RlbGF5ICl7XHJcblxyXG5cdFx0XHQvLyBHZXQgZGVmYXVsdCB2YWx1ZSBvZiBcInRpbWVyX2RlbGF5XCIsICBpZiBwYXJhbWV0ZXIgd2FzIG5vdCBwYXNzZWQgaW50byB0aGUgZnVuY3Rpb24uXHJcblx0XHRcdHRpbWVyX2RlbGF5ID0gdHlwZW9mIHRpbWVyX2RlbGF5ICE9PSAndW5kZWZpbmVkJyA/IHRpbWVyX2RlbGF5IDogMTUwMDtcclxuXHJcblx0XHRcdGNsZWFyVGltZW91dCggY2xvc2VkX3RpbWVyICk7XHRcdC8vIENsZWFyIHByZXZpb3VzIHRpbWVyXHJcblxyXG5cdFx0XHQvLyBTdGFydCBuZXcgVGltZXJcclxuXHRcdFx0Y2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggd3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X2Zvcl9rZXl3b3JkLmJpbmQoICBudWxsLCBlbGVtZW50X2lkICksIHRpbWVyX2RlbGF5ICk7XHJcblx0XHR9XHJcblx0fSgpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiAgIERlZmluZSBEeW5hbWljIEhvb2tzICAobGlrZSBwYWdpbmF0aW9uIGNsaWNrLCB3aGljaCByZW5ldyBlYWNoIHRpbWUgd2l0aCBuZXcgbGlzdGluZyBzaG93aW5nKSAgLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIERlZmluZSBIVE1MIHVpIEhvb2tzOiBvbiBLZXlVcCB8IENoYW5nZSB8IC0+IFNvcnQgT3JkZXIgJiBOdW1iZXIgSXRlbXMgLyBQYWdlXHJcbiAqIFdlIGFyZSBoY25hZ2VkIGl0IGVhY2ggIHRpbWUsIHdoZW4gc2hvd2luZyBuZXcgbGlzdGluZywgYmVjYXVzZSBET00gZWxlbWVudHMgY2huYWdlZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MoKXtcclxuXHJcblx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YoIHdwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICkgKSB7XHJcblx0XHR3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggJy53cGJjX2xpc3RpbmdfY29udGFpbmVyICcgKTtcclxuXHR9XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlKCk7XHJcblx0d3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19yZW1hcmsoKTtcclxuXHJcblx0Ly8gSXRlbXMgUGVyIFBhZ2VcclxuXHRqUXVlcnkoICcud3BiY19pdGVtc19wZXJfcGFnZScgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfaXRlbXNfY291bnQnICA6IGpRdWVyeSggdGhpcyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogMVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vIFNvcnRpbmdcclxuXHRqUXVlcnkoICcud3BiY19pdGVtc19zb3J0X3R5cGUnICkub24oICdjaGFuZ2UnLCBmdW5jdGlvbiggZXZlbnQgKXtcclxuXHJcblx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsnc29ydF90eXBlJzogalF1ZXJ5KCB0aGlzICkudmFsKCl9ICk7XHJcblx0fSApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgU2hvdyAvIEhpZGUgTGlzdGluZyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogIFNob3cgTGlzdGluZyBUYWJsZSBcdC0gXHRTZW5kaW5nIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkIGluIFwid3BiY19hanhfYm9va2luZ19saXN0aW5nXCIgT2JqLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3coKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0KCk7XHRcdFx0Ly8gU2VuZCBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZCBpbiBcIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1wiIE9iai5cclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgTGlzdGluZyBUYWJsZSAoIGFuZCBQYWdpbmF0aW9uIClcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCl7XHJcblx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA5LjYuMS41XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgICAgKS5odG1sKCAnJyApO1xyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyJyApICkuaHRtbCggJycgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgZnVuY3Rpb25zIGZvciBDb250ZW50IFRlbXBsYXRlIGRhdGEgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEhpZ2hsaWdodCBzdHJpbmdzLFxyXG4gKiBieSBpbnNlcnRpbmcgPHNwYW4gY2xhc3M9XCJmaWVsZHZhbHVlIG5hbWUgZmllbGRzZWFyY2h2YWx1ZVwiPi4uLjwvc3Bhbj4gaHRtbCAgZWxlbWVudHMgaW50byB0aGUgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19kZXRhaWxzIFx0LSBTb3VyY2Ugc3RyaW5nXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2tleXdvcmRcdC0gS2V5d29yZCB0byBoaWdobGlnaHRcclxuICogQHJldHVybnMge3N0cmluZ31cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X2hpZ2hsaWdodGVkX3NlYXJjaF9rZXl3b3JkKCBib29raW5nX2RldGFpbHMsIGJvb2tpbmdfa2V5d29yZCApe1xyXG5cclxuXHRib29raW5nX2tleXdvcmQgPSBib29raW5nX2tleXdvcmQudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0aWYgKCAwID09IGJvb2tpbmdfa2V5d29yZC5sZW5ndGggKXtcclxuXHRcdHJldHVybiBib29raW5nX2RldGFpbHM7XHJcblx0fVxyXG5cclxuXHQvLyBIaWdobGlnaHQgc3Vic3RyaW5nIHdpdGhpbmcgSFRNTCB0YWdzIGluIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIgLS0gZS5nLiBzdGFydGluZyBmcm9tICA+ICBhbmQgZW5kaW5nIHdpdGggPFxyXG5cdGxldCBrZXl3b3JkUmVnZXggPSBuZXcgUmVnRXhwKCBgZmllbGR2YWx1ZVtePD5dKj4oW148XSoke2Jvb2tpbmdfa2V5d29yZH1bXjxdKilgLCAnZ2ltJyApO1xyXG5cclxuXHQvL2xldCBtYXRjaGVzID0gWy4uLmJvb2tpbmdfZGV0YWlscy50b0xvd2VyQ2FzZSgpLm1hdGNoQWxsKCBrZXl3b3JkUmVnZXggKV07XHJcblx0bGV0IG1hdGNoZXMgPSBib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5tYXRjaEFsbCgga2V5d29yZFJlZ2V4ICk7XHJcblx0XHRtYXRjaGVzID0gQXJyYXkuZnJvbSggbWF0Y2hlcyApO1xyXG5cclxuXHRsZXQgc3RyaW5nc19hcnIgPSBbXTtcclxuXHRsZXQgcG9zX3ByZXZpb3VzID0gMDtcclxuXHRsZXQgc2VhcmNoX3Bvc19zdGFydDtcclxuXHRsZXQgc2VhcmNoX3Bvc19lbmQ7XHJcblxyXG5cdGZvciAoIGNvbnN0IG1hdGNoIG9mIG1hdGNoZXMgKXtcclxuXHJcblx0XHRzZWFyY2hfcG9zX3N0YXJ0ID0gbWF0Y2guaW5kZXggKyBtYXRjaFsgMCBdLnRvTG93ZXJDYXNlKCkuaW5kZXhPZiggJz4nLCAwICkgKyAxIDtcclxuXHJcblx0XHRzdHJpbmdzX2Fyci5wdXNoKCBib29raW5nX2RldGFpbHMuc3Vic3RyKCBwb3NfcHJldmlvdXMsIChzZWFyY2hfcG9zX3N0YXJ0IC0gcG9zX3ByZXZpb3VzKSApICk7XHJcblxyXG5cdFx0c2VhcmNoX3Bvc19lbmQgPSBib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5pbmRleE9mKCAnPCcsIHNlYXJjaF9wb3Nfc3RhcnQgKTtcclxuXHJcblx0XHRzdHJpbmdzX2Fyci5wdXNoKCAnPHNwYW4gY2xhc3M9XCJmaWVsZHZhbHVlIG5hbWUgZmllbGRzZWFyY2h2YWx1ZVwiPicgKyBib29raW5nX2RldGFpbHMuc3Vic3RyKCBzZWFyY2hfcG9zX3N0YXJ0LCAoc2VhcmNoX3Bvc19lbmQgLSBzZWFyY2hfcG9zX3N0YXJ0KSApICsgJzwvc3Bhbj4nICk7XHJcblxyXG5cdFx0cG9zX3ByZXZpb3VzID0gc2VhcmNoX3Bvc19lbmQ7XHJcblx0fVxyXG5cclxuXHRzdHJpbmdzX2Fyci5wdXNoKCBib29raW5nX2RldGFpbHMuc3Vic3RyKCBwb3NfcHJldmlvdXMsIChib29raW5nX2RldGFpbHMubGVuZ3RoIC0gcG9zX3ByZXZpb3VzKSApICk7XHJcblxyXG5cdHJldHVybiBzdHJpbmdzX2Fyci5qb2luKCAnJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVydCBzcGVjaWFsIEhUTUwgY2hhcmFjdGVycyAgIGZyb206XHQgJmFtcDsgXHQtPiBcdCZcclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlY29kZV9IVE1MX2VudGl0aWVzKCB0ZXh0ICl7XHJcblx0dmFyIHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3RleHRhcmVhJyApO1xyXG5cdHRleHRBcmVhLmlubmVySFRNTCA9IHRleHQ7XHJcblx0cmV0dXJuIHRleHRBcmVhLnZhbHVlO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVydCBUTyBzcGVjaWFsIEhUTUwgY2hhcmFjdGVycyAgIGZyb206XHQgJiBcdC0+IFx0JmFtcDtcclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2VuY29kZV9IVE1MX2VudGl0aWVzKHRleHQpIHtcclxuICB2YXIgdGV4dEFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xyXG4gIHRleHRBcmVhLmlubmVyVGV4dCA9IHRleHQ7XHJcbiAgcmV0dXJuIHRleHRBcmVhLmlubmVySFRNTDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIEJ1dHRvbnMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBTdGFydFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJykucmVtb3ZlQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBQYXVzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgaXMgU3Bpbm5pbmcgP1xyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKXtcclxuICAgIGlmICggalF1ZXJ5KCAnI3dwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuaGFzQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKSApe1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn0iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBQUMsU0FBQUEsMkJBQUFDLENBQUEsRUFBQUMsY0FBQSxRQUFBQyxFQUFBLFVBQUFDLE1BQUEsb0JBQUFILENBQUEsQ0FBQUcsTUFBQSxDQUFBQyxRQUFBLEtBQUFKLENBQUEscUJBQUFFLEVBQUEsUUFBQUcsS0FBQSxDQUFBQyxPQUFBLENBQUFOLENBQUEsTUFBQUUsRUFBQSxHQUFBSywyQkFBQSxDQUFBUCxDQUFBLE1BQUFDLGNBQUEsSUFBQUQsQ0FBQSxXQUFBQSxDQUFBLENBQUFRLE1BQUEscUJBQUFOLEVBQUEsRUFBQUYsQ0FBQSxHQUFBRSxFQUFBLE1BQUFPLENBQUEsVUFBQUMsQ0FBQSxZQUFBQSxFQUFBLGVBQUFDLENBQUEsRUFBQUQsQ0FBQSxFQUFBRSxDQUFBLFdBQUFBLEVBQUEsUUFBQUgsQ0FBQSxJQUFBVCxDQUFBLENBQUFRLE1B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
