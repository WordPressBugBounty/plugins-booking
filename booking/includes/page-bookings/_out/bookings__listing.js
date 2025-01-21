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

    console.log(' == Response WPBC_AJX_BOOKING_LISTING == ', response_data);
    console.groupEnd();
    // Probably Error
    if (_typeof(response_data) !== 'object' || response_data === null) {
      jQuery('.wpbc_ajx_under_toolbar_row').hide(); // FixIn: 9.6.1.5.
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
    jQuery('.wpbc_ajx_under_toolbar_row').hide(); // FixIn: 9.6.1.5.
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19saXN0aW5nLmpzIiwibmFtZXMiOlsiX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXIiLCJvIiwiYWxsb3dBcnJheUxpa2UiLCJpdCIsIlN5bWJvbCIsIml0ZXJhdG9yIiwiQXJyYXkiLCJpc0FycmF5IiwiX3Vuc3VwcG9ydGVkSXRlcmFibGVUb0FycmF5IiwibGVuZ3RoIiwiaSIsIkYiLCJzIiwibiIsImRvbmUiLCJ2YWx1ZSIsImUiLCJfZSIsImYiLCJUeXBlRXJyb3IiLCJub3JtYWxDb21wbGV0aW9uIiwiZGlkRXJyIiwiZXJyIiwiY2FsbCIsInN0ZXAiLCJuZXh0IiwiX2UyIiwibWluTGVuIiwiX2FycmF5TGlrZVRvQXJyYXkiLCJPYmplY3QiLCJwcm90b3R5cGUiLCJ0b1N0cmluZyIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJuYW1lIiwiZnJvbSIsInRlc3QiLCJhcnIiLCJsZW4iLCJhcnIyIiwiX3R5cGVvZiIsIm9iaiIsImpRdWVyeSIsIm9uIiwidG91Y2htb3ZlIiwiZWFjaCIsImluZGV4IiwidGRfZWwiLCJnZXQiLCJ1bmRlZmluZWQiLCJfdGlwcHkiLCJpbnN0YW5jZSIsImhpZGUiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCIkIiwicF9zZWN1cmUiLCJzZWN1cml0eV9vYmoiLCJ1c2VyX2lkIiwibm9uY2UiLCJsb2NhbGUiLCJzZXRfc2VjdXJlX3BhcmFtIiwicGFyYW1fa2V5IiwicGFyYW1fdmFsIiwiZ2V0X3NlY3VyZV9wYXJhbSIsInBfbGlzdGluZyIsInNlYXJjaF9yZXF1ZXN0X29iaiIsInNvcnQiLCJzb3J0X3R5cGUiLCJwYWdlX251bSIsInBhZ2VfaXRlbXNfY291bnQiLCJjcmVhdGVfZGF0ZSIsImtleXdvcmQiLCJzb3VyY2UiLCJzZWFyY2hfc2V0X2FsbF9wYXJhbXMiLCJyZXF1ZXN0X3BhcmFtX29iaiIsInNlYXJjaF9nZXRfYWxsX3BhcmFtcyIsInNlYXJjaF9nZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtIiwic2VhcmNoX3NldF9wYXJhbXNfYXJyIiwicGFyYW1zX2FyciIsIl8iLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwicF9vdGhlciIsIm90aGVyX29iaiIsInNldF9vdGhlcl9wYXJhbSIsImdldF9vdGhlcl9wYXJhbSIsIndwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJ3cGJjX2FqeF9sb2NhbGUiLCJzZWFyY2hfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwiaHRtbCIsImxvY2F0aW9uIiwicmVsb2FkIiwid3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmciLCJ3cGJjX3BhZ2luYXRpb25fZWNobyIsIk1hdGgiLCJjZWlsIiwid3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSIsImFqeF9uZXdfYm9va2luZ3NfY291bnQiLCJwYXJzZUludCIsInNob3ciLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwiZmFpbCIsImVycm9yVGhyb3duIiwid2luZG93IiwiZXJyb3JfbWVzc2FnZSIsInJlc3BvbnNlVGV4dCIsInJlcGxhY2UiLCJ3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSIsImpzb25faXRlbXNfYXJyIiwianNvbl9zZWFyY2hfcGFyYW1zIiwianNvbl9ib29raW5nX3Jlc291cmNlcyIsIndwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbiIsImNzcyIsImxpc3RfaGVhZGVyX3RwbCIsIndwIiwidGVtcGxhdGUiLCJsaXN0X3Jvd190cGwiLCJhcHBlbmQiLCJ3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24iLCJjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV90cGwiLCJkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV90cGwiLCJtZXNzYWdlIiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwid3BiY19hanhfYm9va2luZ19wYWdpbmF0aW9uX2NsaWNrIiwicGFnZV9udW1iZXIiLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQiLCJlbGVtZW50X2lkIiwidmFsIiwid3BiY19hanhfYm9va2luZ19zZWFyY2hpbmdfYWZ0ZXJfZmV3X3NlY29uZHMiLCJjbG9zZWRfdGltZXIiLCJ0aW1lcl9kZWxheSIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJiaW5kIiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJ3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX2xvY2FsZSIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrIiwiZXZlbnQiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdyIsIndwYmNfZ2V0X2hpZ2hsaWdodGVkX3NlYXJjaF9rZXl3b3JkIiwiYm9va2luZ19kZXRhaWxzIiwiYm9va2luZ19rZXl3b3JkIiwidHJpbSIsInRvTG93ZXJDYXNlIiwia2V5d29yZFJlZ2V4IiwiUmVnRXhwIiwiY29uY2F0IiwibWF0Y2hlcyIsIm1hdGNoQWxsIiwic3RyaW5nc19hcnIiLCJwb3NfcHJldmlvdXMiLCJzZWFyY2hfcG9zX3N0YXJ0Iiwic2VhcmNoX3Bvc19lbmQiLCJfaXRlcmF0b3IiLCJfc3RlcCIsIm1hdGNoIiwiaW5kZXhPZiIsInB1c2giLCJzdWJzdHIiLCJqb2luIiwid3BiY19kZWNvZGVfSFRNTF9lbnRpdGllcyIsInRleHQiLCJ0ZXh0QXJlYSIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsIndwYmNfZW5jb2RlX0hUTUxfZW50aXRpZXMiLCJpbm5lclRleHQiLCJyZW1vdmVDbGFzcyIsImFkZENsYXNzIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9faXNfc3BpbiIsImhhc0NsYXNzIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fc3JjL2Jvb2tpbmdzX19saXN0aW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxualF1ZXJ5KCdib2R5Jykub24oe1xyXG4gICAgJ3RvdWNobW92ZSc6IGZ1bmN0aW9uKGUpIHtcclxuXHJcblx0XHRqUXVlcnkoICcudGltZXNwYXJ0bHknICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApe1xyXG5cclxuXHRcdFx0dmFyIHRkX2VsID0galF1ZXJ5KCB0aGlzICkuZ2V0KCAwICk7XHJcblxyXG5cdFx0XHRpZiAoICh1bmRlZmluZWQgIT0gdGRfZWwuX3RpcHB5KSApe1xyXG5cclxuXHRcdFx0XHR2YXIgaW5zdGFuY2UgPSB0ZF9lbC5fdGlwcHk7XHJcblx0XHRcdFx0aW5zdGFuY2UuaGlkZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBSZXF1ZXN0IE9iamVjdFxyXG4gKiBIZXJlIHdlIGNhbiAgZGVmaW5lIFNlYXJjaCBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxudmFyIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyA9IChmdW5jdGlvbiAoIG9iaiwgJCkge1xyXG5cclxuXHQvLyBTZWN1cmUgcGFyYW1ldGVycyBmb3IgQWpheFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfc2VjdXJlID0gb2JqLnNlY3VyaXR5X29iaiA9IG9iai5zZWN1cml0eV9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1c2VyX2lkOiAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRub25jZSAgOiAnJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxlIDogJydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfTtcclxuXHJcblx0b2JqLnNldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9zZWN1cmVbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBMaXN0aW5nIFNlYXJjaCBwYXJhbWV0ZXJzXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9saXN0aW5nID0gb2JqLnNlYXJjaF9yZXF1ZXN0X29iaiA9IG9iai5zZWFyY2hfcmVxdWVzdF9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3J0ICAgICAgICAgICAgOiBcImJvb2tpbmdfaWRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0c29ydF90eXBlICAgICAgIDogXCJERVNDXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhZ2VfbnVtICAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhZ2VfaXRlbXNfY291bnQ6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVfZGF0ZSAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRrZXl3b3JkICAgICAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3VyY2UgICAgICAgICAgOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9hbGxfcGFyYW1zID0gZnVuY3Rpb24gKCByZXF1ZXN0X3BhcmFtX29iaiApIHtcclxuXHRcdHBfbGlzdGluZyA9IHJlcXVlc3RfcGFyYW1fb2JqO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9saXN0aW5nO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfZ2V0X3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9saXN0aW5nWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHQvLyBpZiAoIEFycmF5LmlzQXJyYXkoIHBhcmFtX3ZhbCApICl7XHJcblx0XHQvLyBcdHBhcmFtX3ZhbCA9IEpTT04uc3RyaW5naWZ5KCBwYXJhbV92YWwgKTtcclxuXHRcdC8vIH1cclxuXHRcdHBfbGlzdGluZ1sgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfcGFyYW1zX2FyciA9IGZ1bmN0aW9uKCBwYXJhbXNfYXJyICl7XHJcblx0XHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBEZWZpbmUgZGlmZmVyZW50IFNlYXJjaCAgcGFyYW1ldGVycyBmb3IgcmVxdWVzdFxyXG5cdFx0XHR0aGlzLnNlYXJjaF9zZXRfcGFyYW0oIHBfa2V5LCBwX3ZhbCApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIE90aGVyIHBhcmFtZXRlcnMgXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfb3RoZXIgPSBvYmoub3RoZXJfb2JqID0gb2JqLm90aGVyX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9vdGhlclsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXJbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG59KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcgfHwge30sIGpRdWVyeSApKTtcclxuXHJcblxyXG4vKipcclxuICogICBBamF4ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggc2VhcmNoIHJlcXVlc3RcclxuICogZm9yIHNlYXJjaGluZyBzcGVjaWZpYyBLZXl3b3JkIGFuZCBvdGhlciBwYXJhbXNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCgpe1xyXG5cclxuY29uc29sZS5ncm91cENvbGxhcHNlZCgnQUpYX0JPT0tJTkdfTElTVElORycpOyBjb25zb2xlLmxvZyggJyA9PSBCZWZvcmUgQWpheCBTZW5kIC0gc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgPT0gJyAsIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSApO1xyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG4vKlxyXG4vL0ZpeEluOiBmb3JWaWRlb1xyXG5pZiAoICEgaXNfdGhpc19hY3Rpb24gKXtcclxuXHQvL3dwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0JzxkaXYgc3R5bGU9XCJ3aWR0aDoxMDAlO3RleHQtYWxpZ246IGNlbnRlcjtcIiBpZD1cIndwYmNfbG9hZGluZ19zZWN0aW9uXCI+PHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9hdXRvcmVuZXcgd3BiY19zcGluXCI+PC9zcGFuPjwvZGl2PidcclxuXHRcdCsgalF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKClcclxuXHQpO1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIChqUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCkgKXtcdFx0XHQvLyBGaXhJbjogOS4wLjEuNS5cclxuXHRcdGpRdWVyeSggJyN3cGJjX2xvYWRpbmdfc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0YWxlcnQoICdXYXJuaW5nISBCb29raW5nIENhbGVuZGFyLiBJdHMgc2VlbXMgdGhhdCAgeW91IGhhdmUgZGVhY3RpdmF0ZWQgbG9hZGluZyBvZiBCb290c3RyYXAgSlMgZmlsZXMgYXQgQm9va2luZyBTZXR0aW5ncyBHZW5lcmFsIHBhZ2UgaW4gQWR2YW5jZWQgc2VjdGlvbi4nIClcclxuXHR9XHJcbn1cclxuaXNfdGhpc19hY3Rpb24gPSBmYWxzZTtcclxuKi9cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfTElTVElORycsXHJcblx0XHRcdFx0XHR3cGJjX2FqeF91c2VyX2lkOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICksXHJcblxyXG5cdFx0XHRcdFx0c2VhcmNoX3BhcmFtc1x0OiB3cGJjX2FqeF9ib29raW5nX2xpc3Rpbmcuc2VhcmNoX2dldF9hbGxfcGFyYW1zKClcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuLy9GaXhJbjogZm9yVmlkZW9cclxuLy9qUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblxyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9CT09LSU5HX0xJU1RJTkcgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblx0XHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdFx0XHRcdFx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVsb2FkIHBhZ2UsIGFmdGVyIGZpbHRlciB0b29sYmFyIHdhcyByZXNldGVkXHJcblx0XHRcdFx0XHRpZiAoICAgICAgICggICAgIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdKVxyXG5cdFx0XHRcdFx0XHRcdCYmICggJ3Jlc2V0X2RvbmUnID09PSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAndWlfcmVzZXQnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRsb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgbGlzdGluZ1xyXG5cdFx0XHRcdFx0aWYgKCByZXNwb25zZV9kYXRhWyAnYWp4X2NvdW50JyBdID4gMCApe1xyXG5cclxuXHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmcoIHJlc3BvbnNlX2RhdGFbICdhanhfaXRlbXMnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9ib29raW5nX3Jlc291cmNlcycgXSApO1xyXG5cclxuXHRcdFx0XHRcdFx0d3BiY19wYWdpbmF0aW9uX2VjaG8oXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyJyApLFxyXG5cdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdCdwYWdlX2FjdGl2ZSc6IHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXVsgJ3BhZ2VfbnVtJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3BhZ2VzX2NvdW50JzogTWF0aC5jZWlsKCByZXNwb25zZV9kYXRhWyAnYWp4X2NvdW50JyBdIC8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdWyAncGFnZV9pdGVtc19jb3VudCcgXSApLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdCdwYWdlX2l0ZW1zX2NvdW50JzogcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdWyAncGFnZV9pdGVtc19jb3VudCcgXSxcclxuXHRcdFx0XHRcdFx0XHRcdCdzb3J0X3R5cGUnICAgICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdWyAnc29ydF90eXBlJyBdXHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpO1x0XHRcdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzLCBiZWNhdXNlIHdlIHNob3cgbmV3IERPTSBlbGVtZW50c1xyXG5cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSgpO1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlMCBub3RpY2Utd2FybmluZzBcIiBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyO21hcmdpbi1sZWZ0Oi01MHB4O1wiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPHN0cm9uZz4nICsgJ05vIHJlc3VsdHMgZm91bmQgZm9yIGN1cnJlbnQgZmlsdGVyIG9wdGlvbnMuLi4nICsgJzwvc3Ryb25nPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyc8c3Ryb25nPicgKyAnTm8gcmVzdWx0cyBmb3VuZC4uLicgKyAnPC9zdHJvbmc+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFVwZGF0ZSBuZXcgYm9va2luZyBjb3VudFxyXG5cdFx0XHRcdFx0aWYgKCB1bmRlZmluZWQgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfbmV3X2Jvb2tpbmdzX2NvdW50JyBdICl7XHJcblx0XHRcdFx0XHRcdHZhciBhanhfbmV3X2Jvb2tpbmdzX2NvdW50ID0gcGFyc2VJbnQoIHJlc3BvbnNlX2RhdGFbICdhanhfbmV3X2Jvb2tpbmdzX2NvdW50JyBdIClcclxuXHRcdFx0XHRcdFx0aWYgKGFqeF9uZXdfYm9va2luZ3NfY291bnQ+MCl7XHJcblx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYmFkZ2VfY291bnQnICkuc2hvdygpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJy5iay11cGRhdGUtY291bnQnICkuaHRtbCggYWp4X25ld19ib29raW5nc19jb3VudCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHJcblx0XHRcdFx0XHRqUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNi4xLjUuXHJcblx0XHRcdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhJyArICc8L3N0cm9uZz4gJyArIGVycm9yVGhyb3duIDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0ganFYSFIucmVzcG9uc2VUZXh0O1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdFx0ICB9KVxyXG5cdCAgICAgICAgICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHRcdCAgLy8gLmFsd2F5cyggZnVuY3Rpb24gKCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ2Fsd2F5cyBmaW5pc2hlZCcsIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICk7IH0gICAgIH0pXHJcblx0XHRcdCAgOyAgLy8gRW5kIEFqYXhcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNob3cgTGlzdGluZyBUYWJsZSBcdFx0YW5kIGRlZmluZSBnTWFpbCBjaGVja2JveCBob29rc1xyXG4gKlxyXG4gKiBAcGFyYW0ganNvbl9pdGVtc19hcnJcdFx0LSBKU09OIG9iamVjdCB3aXRoIEl0ZW1zXHJcbiAqIEBwYXJhbSBqc29uX3NlYXJjaF9wYXJhbXNcdC0gSlNPTiBvYmplY3Qgd2l0aCBTZWFyY2hcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19saXN0aW5nKCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zLCBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzICl7XHJcblxyXG5cdHdwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbigganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApO1xyXG5cclxuLy9jb25zb2xlLmxvZyggJ2pzb25faXRlbXNfYXJyJyAsIGpzb25faXRlbXNfYXJyLCBqc29uX3NlYXJjaF9wYXJhbXMgKTtcclxuXHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuY3NzKCBcImRpc3BsYXlcIiwgXCJmbGV4XCIgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdHZhciBsaXN0X2hlYWRlcl90cGwgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2Jvb2tpbmdfbGlzdF9oZWFkZXInICk7XHJcblx0dmFyIGxpc3Rfcm93X3RwbCAgICA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYm9va2luZ19saXN0X3JvdycgKTtcclxuXHJcblxyXG5cdC8vIEhlYWRlclxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbCggbGlzdF9oZWFkZXJfdHBsKCkgKTtcclxuXHJcblx0Ly8gQm9keVxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuYXBwZW5kKCAnPGRpdiBjbGFzcz1cIndwYmNfc2VsZWN0YWJsZV9ib2R5XCI+PC9kaXY+JyApO1xyXG5cclxuXHQvLyBSIG8gdyBzXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdMSVNUSU5HX1JPV1MnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIExJU1RJTkdfUk9XU1xyXG5cdF8uZWFjaCgganNvbl9pdGVtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKXtcclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBqc29uX3NlYXJjaF9wYXJhbXNbICdrZXl3b3JkJyBdICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBQYXJhbWV0ZXIgZm9yIG1hcmtpbmcga2V5d29yZCB3aXRoIGRpZmZlcmVudCBjb2xvciBpbiBhIGxpc3RcclxuXHRcdFx0cF92YWxbICdfX3NlYXJjaF9yZXF1ZXN0X2tleXdvcmRfXycgXSA9IGpzb25fc2VhcmNoX3BhcmFtc1sgJ2tleXdvcmQnIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRwX3ZhbFsgJ19fc2VhcmNoX3JlcXVlc3Rfa2V5d29yZF9fJyBdID0gJyc7XHJcblx0XHR9XHJcblx0XHRwX3ZhbFsgJ2Jvb2tpbmdfcmVzb3VyY2VzJyBdID0ganNvbl9ib29raW5nX3Jlc291cmNlcztcclxuXHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICsgJyAud3BiY19zZWxlY3RhYmxlX2JvZHknICkuYXBwZW5kKCBsaXN0X3Jvd190cGwoIHBfdmFsICkgKTtcclxuXHR9ICk7XHJcbmNvbnNvbGUuZ3JvdXBFbmQoKTsgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBMSVNUSU5HX1JPV1NcclxuXHJcblx0d3BiY19kZWZpbmVfZ21haWxfY2hlY2tib3hfc2VsZWN0aW9uKCBqUXVlcnkgKTtcdFx0XHRcdFx0XHQvLyBSZWRlZmluZSBIb29rcyBmb3IgY2xpY2tpbmcgYXQgQ2hlY2tib3hlc1xyXG59XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdGVtcGxhdGUgZm9yIGNoYW5naW5nIGJvb2tpbmcgcmVzb3VyY2VzICYgIHVwZGF0ZSBpdCBlYWNoIHRpbWUsICB3aGVuICBsaXN0aW5nIHVwZGF0aW5nLCB1c2VmdWwgIGZvciBzaG93aW5nIGFjdHVhbCAgYm9va2luZyByZXNvdXJjZXMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ganNvbl9pdGVtc19hcnJcdFx0LSBKU09OIG9iamVjdCB3aXRoIEl0ZW1zXHJcblx0ICogQHBhcmFtIGpzb25fc2VhcmNoX3BhcmFtc1x0LSBKU09OIG9iamVjdCB3aXRoIFNlYXJjaFxyXG5cdCAqIEBwYXJhbSBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzXHQtIEpTT04gb2JqZWN0IHdpdGggUmVzb3VyY2VzXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hanhfZGVmaW5lX3RlbXBsYXRlc19fcmVzb3VyY2VfbWFuaXB1bGF0aW9uKCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zLCBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzICl7XHJcblxyXG5cdFx0Ly8gQ2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VcclxuXHRcdHZhciBjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV90cGwgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2NoYW5nZV9ib29raW5nX3Jlc291cmNlJyApO1xyXG5cclxuXHRcdGpRdWVyeSggJyN3cGJjX2hpZGRlbl90ZW1wbGF0ZV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UnICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV90cGwoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgOiBqc29uX3NlYXJjaF9wYXJhbXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2Jvb2tpbmdfcmVzb3VyY2VzJzoganNvbl9ib29raW5nX3Jlc291cmNlc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHJcblx0XHQvLyBEdXBsaWNhdGUgYm9va2luZyByZXNvdXJjZVxyXG5cdFx0dmFyIGR1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX3RwbCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UnICk7XHJcblxyXG5cdFx0alF1ZXJ5KCAnI3dwYmNfaGlkZGVuX3RlbXBsYXRlX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZScgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGR1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX3RwbCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9zZWFyY2hfcGFyYW1zJyAgICA6IGpzb25fc2VhcmNoX3BhcmFtcyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfYm9va2luZ19yZXNvdXJjZXMnOiBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdH1cclxuXHJcblxyXG4vKipcclxuICogU2hvdyBqdXN0IG1lc3NhZ2UgaW5zdGVhZCBvZiBsaXN0aW5nIGFuZCBoaWRlIHBhZ2luYXRpb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlKCBtZXNzYWdlICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2Utd2FybmluZ1wiIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEggbyBvIGsgcyAgLSAgaXRzIEFjdGlvbi9UaW1lcyB3aGVuIG5lZWQgdG8gcmUtUmVuZGVyIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBTZWFyY2ggUmVxdWVzdCBhZnRlciBVcGRhdGluZyBzZWFyY2ggcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXNfYXJyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0Ly9jb25zb2xlLmxvZyggJ1JlcXVlc3QgZm9yOiAnLCBwX2tleSwgcF92YWwgKTtcclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfc2V0X3BhcmFtKCBwX2tleSwgcF92YWwgKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gU2VuZCBBamF4IFJlcXVlc3RcclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNlYXJjaCByZXF1ZXN0IGZvciBcIlBhZ2UgTnVtYmVyXCJcclxuICogQHBhcmFtIHBhZ2VfbnVtYmVyXHRpbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfcGFnaW5hdGlvbl9jbGljayggcGFnZV9udW1iZXIgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgS2V5d29yZCBTZWFyY2hpbmcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VhcmNoIHJlcXVlc3QgZm9yIFwiS2V5d29yZFwiLCBhbHNvIHNldCBjdXJyZW50IHBhZ2UgdG8gIDFcclxuICpcclxuICogQHBhcmFtIGVsZW1lbnRfaWRcdC1cdEhUTUwgSUQgIG9mIGVsZW1lbnQsICB3aGVyZSB3YXMgZW50ZXJlZCBrZXl3b3JkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQoIGVsZW1lbnRfaWQgKSB7XHJcblxyXG5cdC8vIFdlIG5lZWQgdG8gUmVzZXQgcGFnZV9udW0gdG8gMSB3aXRoIGVhY2ggbmV3IHNlYXJjaCwgYmVjYXVzZSB3ZSBjYW4gYmUgYXQgcGFnZSAjNCwgIGJ1dCBhZnRlciAgbmV3IHNlYXJjaCAgd2UgY2FuICBoYXZlIHRvdGFsbHkgIG9ubHkgIDEgcGFnZVxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2tleXdvcmQnICA6IGpRdWVyeSggZWxlbWVudF9pZCApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogMVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBTZW5kIHNlYXJjaCByZXF1ZXN0IGFmdGVyIGZldyBzZWNvbmRzICh1c3VhbGx5IGFmdGVyIDEsNSBzZWMpXHJcblx0ICogQ2xvc3VyZSBmdW5jdGlvbi4gSXRzIHVzZWZ1bCwgIGZvciBkbyAgbm90IHNlbmQgdG9vIG1hbnkgQWpheCByZXF1ZXN0cywgd2hlbiBzb21lb25lIG1ha2UgZmFzdCB0eXBpbmcuXHJcblx0ICovXHJcblx0dmFyIHdwYmNfYWp4X2Jvb2tpbmdfc2VhcmNoaW5nX2FmdGVyX2Zld19zZWNvbmRzID0gZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lciA9IDA7XHJcblxyXG5cdFx0cmV0dXJuIGZ1bmN0aW9uICggZWxlbWVudF9pZCwgdGltZXJfZGVsYXkgKXtcclxuXHJcblx0XHRcdC8vIEdldCBkZWZhdWx0IHZhbHVlIG9mIFwidGltZXJfZGVsYXlcIiwgIGlmIHBhcmFtZXRlciB3YXMgbm90IHBhc3NlZCBpbnRvIHRoZSBmdW5jdGlvbi5cclxuXHRcdFx0dGltZXJfZGVsYXkgPSB0eXBlb2YgdGltZXJfZGVsYXkgIT09ICd1bmRlZmluZWQnID8gdGltZXJfZGVsYXkgOiAxNTAwO1xyXG5cclxuXHRcdFx0Y2xlYXJUaW1lb3V0KCBjbG9zZWRfdGltZXIgKTtcdFx0Ly8gQ2xlYXIgcHJldmlvdXMgdGltZXJcclxuXHJcblx0XHRcdC8vIFN0YXJ0IG5ldyBUaW1lclxyXG5cdFx0XHRjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQuYmluZCggIG51bGwsIGVsZW1lbnRfaWQgKSwgdGltZXJfZGVsYXkgKTtcclxuXHRcdH1cclxuXHR9KCk7XHJcblxyXG5cclxuLyoqXHJcbiAqICAgRGVmaW5lIER5bmFtaWMgSG9va3MgIChsaWtlIHBhZ2luYXRpb24gY2xpY2ssIHdoaWNoIHJlbmV3IGVhY2ggdGltZSB3aXRoIG5ldyBsaXN0aW5nIHNob3dpbmcpICAtLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogRGVmaW5lIEhUTUwgdWkgSG9va3M6IG9uIEtleVVwIHwgQ2hhbmdlIHwgLT4gU29ydCBPcmRlciAmIE51bWJlciBJdGVtcyAvIFBhZ2VcclxuICogV2UgYXJlIGhjbmFnZWQgaXQgZWFjaCAgdGltZSwgd2hlbiBzaG93aW5nIG5ldyBsaXN0aW5nLCBiZWNhdXNlIERPTSBlbGVtZW50cyBjaG5hZ2VkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpe1xyXG5cclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiggd3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMgKSApIHtcclxuXHRcdHdwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCAnLndwYmNfbGlzdGluZ19jb250YWluZXIgJyApO1xyXG5cdH1cclxuXHJcblx0d3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUoKTtcclxuXHR3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX3JlbWFyaygpO1xyXG5cclxuXHQvLyBJdGVtcyBQZXIgUGFnZVxyXG5cdGpRdWVyeSggJy53cGJjX2l0ZW1zX3Blcl9wYWdlJyApLm9uKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblxyXG5cdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9pdGVtc19jb3VudCcgIDogalF1ZXJ5KCB0aGlzICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdH0gKTtcclxuXHJcblx0Ly8gU29ydGluZ1xyXG5cdGpRdWVyeSggJy53cGJjX2l0ZW1zX3NvcnRfdHlwZScgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggeydzb3J0X3R5cGUnOiBqUXVlcnkoIHRoaXMgKS52YWwoKX0gKTtcclxuXHR9ICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTaG93IC8gSGlkZSBMaXN0aW5nICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiAgU2hvdyBMaXN0aW5nIFRhYmxlIFx0LSBcdFNlbmRpbmcgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdygpe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QoKTtcdFx0XHQvLyBTZW5kIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkIGluIFwid3BiY19hanhfYm9va2luZ19saXN0aW5nXCIgT2JqLlxyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBMaXN0aW5nIFRhYmxlICggYW5kIFBhZ2luYXRpb24gKVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX2hpZGUoKXtcclxuXHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICAgICkuaHRtbCggJycgKTtcclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdwYWdpbmF0aW9uX2NvbnRhaW5lcicgKSApLmh0bWwoICcnICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTdXBwb3J0IGZ1bmN0aW9ucyBmb3IgQ29udGVudCBUZW1wbGF0ZSBkYXRhICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBIaWdobGlnaHQgc3RyaW5ncyxcclxuICogYnkgaW5zZXJ0aW5nIDxzcGFuIGNsYXNzPVwiZmllbGR2YWx1ZSBuYW1lIGZpZWxkc2VhcmNodmFsdWVcIj4uLi48L3NwYW4+IGh0bWwgIGVsZW1lbnRzIGludG8gdGhlIHN0cmluZy5cclxuICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZGV0YWlscyBcdC0gU291cmNlIHN0cmluZ1xyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19rZXl3b3JkXHQtIEtleXdvcmQgdG8gaGlnaGxpZ2h0XHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2dldF9oaWdobGlnaHRlZF9zZWFyY2hfa2V5d29yZCggYm9va2luZ19kZXRhaWxzLCBib29raW5nX2tleXdvcmQgKXtcclxuXHJcblx0Ym9va2luZ19rZXl3b3JkID0gYm9va2luZ19rZXl3b3JkLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdGlmICggMCA9PSBib29raW5nX2tleXdvcmQubGVuZ3RoICl7XHJcblx0XHRyZXR1cm4gYm9va2luZ19kZXRhaWxzO1xyXG5cdH1cclxuXHJcblx0Ly8gSGlnaGxpZ2h0IHN1YnN0cmluZyB3aXRoaW5nIEhUTUwgdGFncyBpbiBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiIC0tIGUuZy4gc3RhcnRpbmcgZnJvbSAgPiAgYW5kIGVuZGluZyB3aXRoIDxcclxuXHRsZXQga2V5d29yZFJlZ2V4ID0gbmV3IFJlZ0V4cCggYGZpZWxkdmFsdWVbXjw+XSo+KFtePF0qJHtib29raW5nX2tleXdvcmR9W148XSopYCwgJ2dpbScgKTtcclxuXHJcblx0Ly9sZXQgbWF0Y2hlcyA9IFsuLi5ib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5tYXRjaEFsbCgga2V5d29yZFJlZ2V4ICldO1xyXG5cdGxldCBtYXRjaGVzID0gYm9va2luZ19kZXRhaWxzLnRvTG93ZXJDYXNlKCkubWF0Y2hBbGwoIGtleXdvcmRSZWdleCApO1xyXG5cdFx0bWF0Y2hlcyA9IEFycmF5LmZyb20oIG1hdGNoZXMgKTtcclxuXHJcblx0bGV0IHN0cmluZ3NfYXJyID0gW107XHJcblx0bGV0IHBvc19wcmV2aW91cyA9IDA7XHJcblx0bGV0IHNlYXJjaF9wb3Nfc3RhcnQ7XHJcblx0bGV0IHNlYXJjaF9wb3NfZW5kO1xyXG5cclxuXHRmb3IgKCBjb25zdCBtYXRjaCBvZiBtYXRjaGVzICl7XHJcblxyXG5cdFx0c2VhcmNoX3Bvc19zdGFydCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbIDAgXS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoICc+JywgMCApICsgMSA7XHJcblxyXG5cdFx0c3RyaW5nc19hcnIucHVzaCggYm9va2luZ19kZXRhaWxzLnN1YnN0ciggcG9zX3ByZXZpb3VzLCAoc2VhcmNoX3Bvc19zdGFydCAtIHBvc19wcmV2aW91cykgKSApO1xyXG5cclxuXHRcdHNlYXJjaF9wb3NfZW5kID0gYm9va2luZ19kZXRhaWxzLnRvTG93ZXJDYXNlKCkuaW5kZXhPZiggJzwnLCBzZWFyY2hfcG9zX3N0YXJ0ICk7XHJcblxyXG5cdFx0c3RyaW5nc19hcnIucHVzaCggJzxzcGFuIGNsYXNzPVwiZmllbGR2YWx1ZSBuYW1lIGZpZWxkc2VhcmNodmFsdWVcIj4nICsgYm9va2luZ19kZXRhaWxzLnN1YnN0ciggc2VhcmNoX3Bvc19zdGFydCwgKHNlYXJjaF9wb3NfZW5kIC0gc2VhcmNoX3Bvc19zdGFydCkgKSArICc8L3NwYW4+JyApO1xyXG5cclxuXHRcdHBvc19wcmV2aW91cyA9IHNlYXJjaF9wb3NfZW5kO1xyXG5cdH1cclxuXHJcblx0c3RyaW5nc19hcnIucHVzaCggYm9va2luZ19kZXRhaWxzLnN1YnN0ciggcG9zX3ByZXZpb3VzLCAoYm9va2luZ19kZXRhaWxzLmxlbmd0aCAtIHBvc19wcmV2aW91cykgKSApO1xyXG5cclxuXHRyZXR1cm4gc3RyaW5nc19hcnIuam9pbiggJycgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgc3BlY2lhbCBIVE1MIGNoYXJhY3RlcnMgICBmcm9tOlx0ICZhbXA7IFx0LT4gXHQmXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kZWNvZGVfSFRNTF9lbnRpdGllcyggdGV4dCApe1xyXG5cdHZhciB0ZXh0QXJlYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICd0ZXh0YXJlYScgKTtcclxuXHR0ZXh0QXJlYS5pbm5lckhUTUwgPSB0ZXh0O1xyXG5cdHJldHVybiB0ZXh0QXJlYS52YWx1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgVE8gc3BlY2lhbCBIVE1MIGNoYXJhY3RlcnMgICBmcm9tOlx0ICYgXHQtPiBcdCZhbXA7XHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19lbmNvZGVfSFRNTF9lbnRpdGllcyh0ZXh0KSB7XHJcbiAgdmFyIHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcclxuICB0ZXh0QXJlYS5pbm5lclRleHQgPSB0ZXh0O1xyXG4gIHJldHVybiB0ZXh0QXJlYS5pbm5lckhUTUw7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBCdXR0b25zICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgU3RhcnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKXtcclxuXHRqUXVlcnkoICcjd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbiAubWVudV9pY29uLndwYmNfc3BpbicpLnJlbW92ZUNsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgUGF1c2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKXtcclxuXHRqUXVlcnkoICcjd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbiAubWVudV9pY29uLndwYmNfc3BpbicgKS5hZGRDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIGlzIFNwaW5uaW5nID9cclxuICpcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluKCl7XHJcbiAgICBpZiAoIGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmhhc0NsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICkgKXtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59Il0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUFDLFNBQUFBLDJCQUFBQyxDQUFBLEVBQUFDLGNBQUEsUUFBQUMsRUFBQSxVQUFBQyxNQUFBLG9CQUFBSCxDQUFBLENBQUFHLE1BQUEsQ0FBQUMsUUFBQSxLQUFBSixDQUFBLHFCQUFBRSxFQUFBLFFBQUFHLEtBQUEsQ0FBQUMsT0FBQSxDQUFBTixDQUFBLE1BQUFFLEVBQUEsR0FBQUssMkJBQUEsQ0FBQVAsQ0FBQSxNQUFBQyxjQUFBLElBQUFELENBQUEsV0FBQUEsQ0FBQSxDQUFBUSxNQUFBLHFCQUFBTixFQUFBLEVBQUFGLENBQUEsR0FBQUUsRUFBQSxNQUFBTyxDQUFBLFVBQUFDLENBQUEsWUFBQUEsRUFBQSxlQUFBQyxDQUFBLEVBQUFELENBQUEsRUFBQUUsQ0FBQSxXQUFBQSxFQUFBLFFBQUFILENBQUEsSUFBQVQsQ0FB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
