"use strict";

function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19saXN0aW5nLmpzIiwibmFtZXMiOlsiX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXIiLCJyIiwiZSIsInQiLCJTeW1ib2wiLCJpdGVyYXRvciIsIkFycmF5IiwiaXNBcnJheSIsIl91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheSIsImxlbmd0aCIsIl9uIiwiRiIsInMiLCJuIiwiZG9uZSIsInZhbHVlIiwiZiIsIlR5cGVFcnJvciIsIm8iLCJhIiwidSIsImNhbGwiLCJuZXh0IiwiX2FycmF5TGlrZVRvQXJyYXkiLCJ0b1N0cmluZyIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJuYW1lIiwiZnJvbSIsInRlc3QiLCJfdHlwZW9mIiwicHJvdG90eXBlIiwialF1ZXJ5Iiwib24iLCJ0b3VjaG1vdmUiLCJlYWNoIiwiaW5kZXgiLCJ0ZF9lbCIsImdldCIsInVuZGVmaW5lZCIsIl90aXBweSIsImluc3RhbmNlIiwiaGlkZSIsIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyIsIm9iaiIsIiQiLCJwX3NlY3VyZSIsInNlY3VyaXR5X29iaiIsInVzZXJfaWQiLCJub25jZSIsImxvY2FsZSIsInNldF9zZWN1cmVfcGFyYW0iLCJwYXJhbV9rZXkiLCJwYXJhbV92YWwiLCJnZXRfc2VjdXJlX3BhcmFtIiwicF9saXN0aW5nIiwic2VhcmNoX3JlcXVlc3Rfb2JqIiwic29ydCIsInNvcnRfdHlwZSIsInBhZ2VfbnVtIiwicGFnZV9pdGVtc19jb3VudCIsImNyZWF0ZV9kYXRlIiwia2V5d29yZCIsInNvdXJjZSIsInNlYXJjaF9zZXRfYWxsX3BhcmFtcyIsInJlcXVlc3RfcGFyYW1fb2JqIiwic2VhcmNoX2dldF9hbGxfcGFyYW1zIiwic2VhcmNoX2dldF9wYXJhbSIsInNlYXJjaF9zZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtc19hcnIiLCJwYXJhbXNfYXJyIiwiXyIsInBfdmFsIiwicF9rZXkiLCJwX2RhdGEiLCJwX290aGVyIiwib3RoZXJfb2JqIiwic2V0X290aGVyX3BhcmFtIiwiZ2V0X290aGVyX3BhcmFtIiwid3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0IiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwibG9nIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwid3BiY19hanhfdXNlcl9pZCIsIndwYmNfYWp4X2xvY2FsZSIsInNlYXJjaF9wYXJhbXMiLCJyZXNwb25zZV9kYXRhIiwidGV4dFN0YXR1cyIsImpxWEhSIiwiZ3JvdXBFbmQiLCJodG1sIiwibG9jYXRpb24iLCJyZWxvYWQiLCJ3cGJjX2FqeF9ib29raW5nX3Nob3dfbGlzdGluZyIsIndwYmNfcGFnaW5hdGlvbl9lY2hvIiwiTWF0aCIsImNlaWwiLCJ3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcyIsIndwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlIiwiYWp4X25ld19ib29raW5nc19jb3VudCIsInBhcnNlSW50Iiwic2hvdyIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UiLCJmYWlsIiwiZXJyb3JUaHJvd24iLCJ3aW5kb3ciLCJlcnJvcl9tZXNzYWdlIiwicmVzcG9uc2VUZXh0IiwicmVwbGFjZSIsIndwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlIiwianNvbl9pdGVtc19hcnIiLCJqc29uX3NlYXJjaF9wYXJhbXMiLCJqc29uX2Jvb2tpbmdfcmVzb3VyY2VzIiwid3BiY19hanhfZGVmaW5lX3RlbXBsYXRlc19fcmVzb3VyY2VfbWFuaXB1bGF0aW9uIiwiY3NzIiwibGlzdF9oZWFkZXJfdHBsIiwid3AiLCJ0ZW1wbGF0ZSIsImxpc3Rfcm93X3RwbCIsImFwcGVuZCIsIndwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiIsImNoYW5nZV9ib29raW5nX3Jlc291cmNlX3RwbCIsImR1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX3RwbCIsIm1lc3NhZ2UiLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMiLCJ3cGJjX2FqeF9ib29raW5nX3BhZ2luYXRpb25fY2xpY2siLCJwYWdlX251bWJlciIsIndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF9mb3Jfa2V5d29yZCIsImVsZW1lbnRfaWQiLCJ2YWwiLCJ3cGJjX2FqeF9ib29raW5nX3NlYXJjaGluZ19hZnRlcl9mZXdfc2Vjb25kcyIsImNsb3NlZF90aW1lciIsInRpbWVyX2RlbGF5IiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImJpbmQiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlIiwid3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19yZW1hcmsiLCJldmVudCIsIndwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93Iiwid3BiY19nZXRfaGlnaGxpZ2h0ZWRfc2VhcmNoX2tleXdvcmQiLCJib29raW5nX2RldGFpbHMiLCJib29raW5nX2tleXdvcmQiLCJ0cmltIiwidG9Mb3dlckNhc2UiLCJrZXl3b3JkUmVnZXgiLCJSZWdFeHAiLCJjb25jYXQiLCJtYXRjaGVzIiwibWF0Y2hBbGwiLCJzdHJpbmdzX2FyciIsInBvc19wcmV2aW91cyIsInNlYXJjaF9wb3Nfc3RhcnQiLCJzZWFyY2hfcG9zX2VuZCIsIl9pdGVyYXRvciIsIl9zdGVwIiwibWF0Y2giLCJpbmRleE9mIiwicHVzaCIsInN1YnN0ciIsImVyciIsImpvaW4iLCJ3cGJjX2RlY29kZV9IVE1MX2VudGl0aWVzIiwidGV4dCIsInRleHRBcmVhIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwid3BiY19lbmNvZGVfSFRNTF9lbnRpdGllcyIsImlubmVyVGV4dCIsInJlbW92ZUNsYXNzIiwiYWRkQ2xhc3MiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluIiwiaGFzQ2xhc3MiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWJvb2tpbmdzL19zcmMvYm9va2luZ3NfX2xpc3RpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5qUXVlcnkoJ2JvZHknKS5vbih7XHJcbiAgICAndG91Y2htb3ZlJzogZnVuY3Rpb24oZSkge1xyXG5cclxuXHRcdGpRdWVyeSggJy50aW1lc3BhcnRseScgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblxyXG5cdFx0XHR2YXIgdGRfZWwgPSBqUXVlcnkoIHRoaXMgKS5nZXQoIDAgKTtcclxuXHJcblx0XHRcdGlmICggKHVuZGVmaW5lZCAhPSB0ZF9lbC5fdGlwcHkpICl7XHJcblxyXG5cdFx0XHRcdHZhciBpbnN0YW5jZSA9IHRkX2VsLl90aXBweTtcclxuXHRcdFx0XHRpbnN0YW5jZS5oaWRlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFJlcXVlc3QgT2JqZWN0XHJcbiAqIEhlcmUgd2UgY2FuICBkZWZpbmUgU2VhcmNoIHBhcmFtZXRlcnMgYW5kIFVwZGF0ZSBpdCBsYXRlciwgIHdoZW4gIHNvbWUgcGFyYW1ldGVyIHdhcyBjaGFuZ2VkXHJcbiAqXHJcbiAqL1xyXG52YXIgd3BiY19hanhfYm9va2luZ19saXN0aW5nID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cclxuXHRvYmouc2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX3NlY3VyZVsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX3NlY3VyZVsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIExpc3RpbmcgU2VhcmNoIHBhcmFtZXRlcnNcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2xpc3RpbmcgPSBvYmouc2VhcmNoX3JlcXVlc3Rfb2JqID0gb2JqLnNlYXJjaF9yZXF1ZXN0X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X2FsbF9wYXJhbXMgPSBmdW5jdGlvbiAoIHJlcXVlc3RfcGFyYW1fb2JqICkge1xyXG5cdFx0cF9saXN0aW5nID0gcmVxdWVzdF9wYXJhbV9vYmo7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfYWxsX3BhcmFtcyA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2xpc3Rpbmc7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX2xpc3RpbmdbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdC8vIGlmICggQXJyYXkuaXNBcnJheSggcGFyYW1fdmFsICkgKXtcclxuXHRcdC8vIFx0cGFyYW1fdmFsID0gSlNPTi5zdHJpbmdpZnkoIHBhcmFtX3ZhbCApO1xyXG5cdFx0Ly8gfVxyXG5cdFx0cF9saXN0aW5nWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9wYXJhbXNfYXJyID0gZnVuY3Rpb24oIHBhcmFtc19hcnIgKXtcclxuXHRcdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0XHRcdHRoaXMuc2VhcmNoX3NldF9wYXJhbSggcF9rZXksIHBfdmFsICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gT3RoZXIgcGFyYW1ldGVycyBcdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9vdGhlciA9IG9iai5vdGhlcl9vYmogPSBvYmoub3RoZXJfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlclsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdHJldHVybiBvYmo7XHJcbn0oIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEFqYXggIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBzZWFyY2ggcmVxdWVzdFxyXG4gKiBmb3Igc2VhcmNoaW5nIHNwZWNpZmljIEtleXdvcmQgYW5kIG90aGVyIHBhcmFtc1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0KCl7XHJcblxyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCdBSlhfQk9PS0lOR19MSVNUSU5HJyk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBzZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSA9PSAnICwgd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpICk7XHJcblxyXG5cdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKTtcclxuXHJcbi8qXHJcbi8vRml4SW46IGZvclZpZGVvXHJcbmlmICggISBpc190aGlzX2FjdGlvbiApe1xyXG5cdC8vd3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX2hpZGUoKTtcclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHQnPGRpdiBzdHlsZT1cIndpZHRoOjEwMCU7dGV4dC1hbGlnbjogY2VudGVyO1wiIGlkPVwid3BiY19sb2FkaW5nX3NlY3Rpb25cIj48c3BhbiBjbGFzcz1cIndwYmNfaWNuX2F1dG9yZW5ldyB3cGJjX3NwaW5cIj48L3NwYW4+PC9kaXY+J1xyXG5cdFx0KyBqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoKVxyXG5cdCk7XHJcblx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKGpRdWVyeSggJyN3cGJjX2xvYWRpbmdfc2VjdGlvbicgKS53cGJjX215X21vZGFsKSApe1x0XHRcdC8vIEZpeEluOiA5LjAuMS41LlxyXG5cdFx0alF1ZXJ5KCAnI3dwYmNfbG9hZGluZ19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdzaG93JyApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRhbGVydCggJ1dhcm5pbmchIEJvb2tpbmcgQ2FsZW5kYXIuIEl0cyBzZWVtcyB0aGF0ICB5b3UgaGF2ZSBkZWFjdGl2YXRlZCBsb2FkaW5nIG9mIEJvb3RzdHJhcCBKUyBmaWxlcyBhdCBCb29raW5nIFNldHRpbmdzIEdlbmVyYWwgcGFnZSBpbiBBZHZhbmNlZCBzZWN0aW9uLicgKVxyXG5cdH1cclxufVxyXG5pc190aGlzX2FjdGlvbiA9IGZhbHNlO1xyXG4qL1xyXG5cdC8vIFN0YXJ0IEFqYXhcclxuXHRqUXVlcnkucG9zdCggd3BiY191cmxfYWpheCxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRhY3Rpb24gICAgICAgICAgOiAnV1BCQ19BSlhfQk9PS0lOR19MSVNUSU5HJyxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X3VzZXJfaWQ6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAndXNlcl9pZCcgKSxcclxuXHRcdFx0XHRcdG5vbmNlICAgICAgICAgICA6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbm9uY2UnICksXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGUgOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSxcclxuXHJcblx0XHRcdFx0XHRzZWFyY2hfcGFyYW1zXHQ6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKVxyXG5cdFx0XHRcdH0sXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogUyB1IGMgYyBlIHMgc1xyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0ICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcdFx0LVx0aXRzIG9iamVjdCByZXR1cm5lZCBmcm9tICBBamF4IC0gY2xhc3MtbGl2ZS1zZWFyY2cucGhwXHJcblx0XHRcdFx0ICogQHBhcmFtIHRleHRTdGF0dXNcdFx0LVx0J3N1Y2Nlc3MnXHJcblx0XHRcdFx0ICogQHBhcmFtIGpxWEhSXHRcdFx0XHQtXHRPYmplY3RcclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRmdW5jdGlvbiAoIHJlc3BvbnNlX2RhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkge1xyXG4vL0ZpeEluOiBmb3JWaWRlb1xyXG4vL2pRdWVyeSggJyN3cGJjX2xvYWRpbmdfc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnaGlkZScgKTtcclxuXHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0JPT0tJTkdfTElTVElORyA9PSAnLCByZXNwb25zZV9kYXRhICk7IGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHRcdFx0XHRcdC8vIFByb2JhYmx5IEVycm9yXHJcblx0XHRcdFx0XHRpZiAoICh0eXBlb2YgcmVzcG9uc2VfZGF0YSAhPT0gJ29iamVjdCcpIHx8IChyZXNwb25zZV9kYXRhID09PSBudWxsKSApe1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNi4xLjUuXHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBSZWxvYWQgcGFnZSwgYWZ0ZXIgZmlsdGVyIHRvb2xiYXIgd2FzIHJlc2V0ZWRcclxuXHRcdFx0XHRcdGlmICggICAgICAgKCAgICAgdW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0pXHJcblx0XHRcdFx0XHRcdFx0JiYgKCAncmVzZXRfZG9uZScgPT09IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICd1aV9yZXNldCcgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdGxvY2F0aW9uLnJlbG9hZCgpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBsaXN0aW5nXHJcblx0XHRcdFx0XHRpZiAoIHJlc3BvbnNlX2RhdGFbICdhanhfY291bnQnIF0gPiAwICl7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3Nob3dfbGlzdGluZyggcmVzcG9uc2VfZGF0YVsgJ2FqeF9pdGVtcycgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdLCByZXNwb25zZV9kYXRhWyAnYWp4X2Jvb2tpbmdfcmVzb3VyY2VzJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX3BhZ2luYXRpb25fZWNobyhcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAncGFnaW5hdGlvbl9jb250YWluZXInICksXHJcblx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0J3BhZ2VfYWN0aXZlJzogcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdWyAncGFnZV9udW0nIF0sXHJcblx0XHRcdFx0XHRcdFx0XHQncGFnZXNfY291bnQnOiBNYXRoLmNlaWwoIHJlc3BvbnNlX2RhdGFbICdhanhfY291bnQnIF0gLyByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX2l0ZW1zX2NvdW50JyBdICksXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0J3BhZ2VfaXRlbXNfY291bnQnOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX2l0ZW1zX2NvdW50JyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NvcnRfdHlwZScgICAgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdzb3J0X3R5cGUnIF1cclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzKCk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MsIGJlY2F1c2Ugd2Ugc2hvdyBuZXcgRE9NIGVsZW1lbnRzXHJcblxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2UwIG5vdGljZS13YXJuaW5nMFwiIHN0eWxlPVwidGV4dC1hbGlnbjpjZW50ZXI7bWFyZ2luLWxlZnQ6LTUwcHg7XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8c3Ryb25nPicgKyAnTm8gcmVzdWx0cyBmb3VuZCBmb3IgY3VycmVudCBmaWx0ZXIgb3B0aW9ucy4uLicgKyAnPC9zdHJvbmc+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vJzxzdHJvbmc+JyArICdObyByZXN1bHRzIGZvdW5kLi4uJyArICc8L3N0cm9uZz4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gVXBkYXRlIG5ldyBib29raW5nIGNvdW50XHJcblx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9uZXdfYm9va2luZ3NfY291bnQnIF0gKXtcclxuXHRcdFx0XHRcdFx0dmFyIGFqeF9uZXdfYm9va2luZ3NfY291bnQgPSBwYXJzZUludCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9uZXdfYm9va2luZ3NfY291bnQnIF0gKVxyXG5cdFx0XHRcdFx0XHRpZiAoYWp4X25ld19ib29raW5nc19jb3VudD4wKXtcclxuXHRcdFx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19iYWRnZV9jb3VudCcgKS5zaG93KCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLmJrLXVwZGF0ZS1jb3VudCcgKS5odG1sKCBhanhfbmV3X2Jvb2tpbmdzX2NvdW50ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cclxuXHRcdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5yZXNwb25zZVRleHQgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSBqcVhIUi5yZXNwb25zZVRleHQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSggZXJyb3JfbWVzc2FnZSApO1xyXG5cdFx0XHQgIH0pXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgVmlld3MgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2hvdyBMaXN0aW5nIFRhYmxlIFx0XHRhbmQgZGVmaW5lIGdNYWlsIGNoZWNrYm94IGhvb2tzXHJcbiAqXHJcbiAqIEBwYXJhbSBqc29uX2l0ZW1zX2Fyclx0XHQtIEpTT04gb2JqZWN0IHdpdGggSXRlbXNcclxuICogQHBhcmFtIGpzb25fc2VhcmNoX3BhcmFtc1x0LSBKU09OIG9iamVjdCB3aXRoIFNlYXJjaFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmcoIGpzb25faXRlbXNfYXJyLCBqc29uX3NlYXJjaF9wYXJhbXMsIGpzb25fYm9va2luZ19yZXNvdXJjZXMgKXtcclxuXHJcblx0d3BiY19hanhfZGVmaW5lX3RlbXBsYXRlc19fcmVzb3VyY2VfbWFuaXB1bGF0aW9uKCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zLCBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzICk7XHJcblxyXG4vL2NvbnNvbGUubG9nKCAnanNvbl9pdGVtc19hcnInICwganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcyApO1xyXG5cdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5jc3MoIFwiZGlzcGxheVwiLCBcImZsZXhcIiApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNi4xLjUuXHJcblx0dmFyIGxpc3RfaGVhZGVyX3RwbCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYm9va2luZ19saXN0X2hlYWRlcicgKTtcclxuXHR2YXIgbGlzdF9yb3dfdHBsICAgID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9ib29raW5nX2xpc3Rfcm93JyApO1xyXG5cclxuXHJcblx0Ly8gSGVhZGVyXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKCBsaXN0X2hlYWRlcl90cGwoKSApO1xyXG5cclxuXHQvLyBCb2R5XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5hcHBlbmQoICc8ZGl2IGNsYXNzPVwid3BiY19zZWxlY3RhYmxlX2JvZHlcIj48L2Rpdj4nICk7XHJcblxyXG5cdC8vIFIgbyB3IHNcclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ0xJU1RJTkdfUk9XUycgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTElTVElOR19ST1dTXHJcblx0Xy5lYWNoKCBqc29uX2l0ZW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApe1xyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGpzb25fc2VhcmNoX3BhcmFtc1sgJ2tleXdvcmQnIF0gKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFBhcmFtZXRlciBmb3IgbWFya2luZyBrZXl3b3JkIHdpdGggZGlmZmVyZW50IGNvbG9yIGluIGEgbGlzdFxyXG5cdFx0XHRwX3ZhbFsgJ19fc2VhcmNoX3JlcXVlc3Rfa2V5d29yZF9fJyBdID0ganNvbl9zZWFyY2hfcGFyYW1zWyAna2V5d29yZCcgXTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHBfdmFsWyAnX19zZWFyY2hfcmVxdWVzdF9rZXl3b3JkX18nIF0gPSAnJztcclxuXHRcdH1cclxuXHRcdHBfdmFsWyAnYm9va2luZ19yZXNvdXJjZXMnIF0gPSBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzO1xyXG5cdFx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKyAnIC53cGJjX3NlbGVjdGFibGVfYm9keScgKS5hcHBlbmQoIGxpc3Rfcm93X3RwbCggcF92YWwgKSApO1xyXG5cdH0gKTtcclxuY29uc29sZS5ncm91cEVuZCgpOyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIExJU1RJTkdfUk9XU1xyXG5cclxuXHR3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24oIGpRdWVyeSApO1x0XHRcdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzIGZvciBjbGlja2luZyBhdCBDaGVja2JveGVzXHJcbn1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSB0ZW1wbGF0ZSBmb3IgY2hhbmdpbmcgYm9va2luZyByZXNvdXJjZXMgJiAgdXBkYXRlIGl0IGVhY2ggdGltZSwgIHdoZW4gIGxpc3RpbmcgdXBkYXRpbmcsIHVzZWZ1bCAgZm9yIHNob3dpbmcgYWN0dWFsICBib29raW5nIHJlc291cmNlcy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBqc29uX2l0ZW1zX2Fyclx0XHQtIEpTT04gb2JqZWN0IHdpdGggSXRlbXNcclxuXHQgKiBAcGFyYW0ganNvbl9zZWFyY2hfcGFyYW1zXHQtIEpTT04gb2JqZWN0IHdpdGggU2VhcmNoXHJcblx0ICogQHBhcmFtIGpzb25fYm9va2luZ19yZXNvdXJjZXNcdC0gSlNPTiBvYmplY3Qgd2l0aCBSZXNvdXJjZXNcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2FqeF9kZWZpbmVfdGVtcGxhdGVzX19yZXNvdXJjZV9tYW5pcHVsYXRpb24oIGpzb25faXRlbXNfYXJyLCBqc29uX3NlYXJjaF9wYXJhbXMsIGpzb25fYm9va2luZ19yZXNvdXJjZXMgKXtcclxuXHJcblx0XHQvLyBDaGFuZ2UgYm9va2luZyByZXNvdXJjZVxyXG5cdFx0dmFyIGNoYW5nZV9ib29raW5nX3Jlc291cmNlX3RwbCA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UnICk7XHJcblxyXG5cdFx0alF1ZXJ5KCAnI3dwYmNfaGlkZGVuX3RlbXBsYXRlX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZScgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNoYW5nZV9ib29raW5nX3Jlc291cmNlX3RwbCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9zZWFyY2hfcGFyYW1zJyAgICA6IGpzb25fc2VhcmNoX3BhcmFtcyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfYm9va2luZ19yZXNvdXJjZXMnOiBqc29uX2Jvb2tpbmdfcmVzb3VyY2VzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdC8vIER1cGxpY2F0ZSBib29raW5nIHJlc291cmNlXHJcblx0XHR2YXIgZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfdHBsID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZScgKTtcclxuXHJcblx0XHRqUXVlcnkoICcjd3BiY19oaWRkZW5fdGVtcGxhdGVfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlJyApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfdHBsKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X3NlYXJjaF9wYXJhbXMnICAgIDoganNvbl9zZWFyY2hfcGFyYW1zLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ib29raW5nX3Jlc291cmNlcyc6IGpzb25fYm9va2luZ19yZXNvdXJjZXNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9IClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0fVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaG93IGp1c3QgbWVzc2FnZSBpbnN0ZWFkIG9mIGxpc3RpbmcgYW5kIGhpZGUgcGFnaW5hdGlvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UoIG1lc3NhZ2UgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX2hpZGUoKTtcclxuXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgSCBvIG8gayBzICAtICBpdHMgQWN0aW9uL1RpbWVzIHdoZW4gbmVlZCB0byByZS1SZW5kZXIgVmlld3MgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VuZCBBamF4IFNlYXJjaCBSZXF1ZXN0IGFmdGVyIFVwZGF0aW5nIHNlYXJjaCByZXF1ZXN0IHBhcmFtZXRlcnNcclxuICpcclxuICogQHBhcmFtIHBhcmFtc19hcnJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyAoIHBhcmFtc19hcnIgKXtcclxuXHJcblx0Ly8gRGVmaW5lIGRpZmZlcmVudCBTZWFyY2ggIHBhcmFtZXRlcnMgZm9yIHJlcXVlc3RcclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHQvL2NvbnNvbGUubG9nKCAnUmVxdWVzdCBmb3I6ICcsIHBfa2V5LCBwX3ZhbCApO1xyXG5cdFx0d3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9zZXRfcGFyYW0oIHBfa2V5LCBwX3ZhbCApO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBTZW5kIEFqYXggUmVxdWVzdFxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCgpO1xyXG59XHJcblxyXG4vKipcclxuICogU2VhcmNoIHJlcXVlc3QgZm9yIFwiUGFnZSBOdW1iZXJcIlxyXG4gKiBAcGFyYW0gcGFnZV9udW1iZXJcdGludFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19wYWdpbmF0aW9uX2NsaWNrKCBwYWdlX251bWJlciApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nOiBwYWdlX251bWJlclxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBLZXl3b3JkIFNlYXJjaGluZyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZWFyY2ggcmVxdWVzdCBmb3IgXCJLZXl3b3JkXCIsIGFsc28gc2V0IGN1cnJlbnQgcGFnZSB0byAgMVxyXG4gKlxyXG4gKiBAcGFyYW0gZWxlbWVudF9pZFx0LVx0SFRNTCBJRCAgb2YgZWxlbWVudCwgIHdoZXJlIHdhcyBlbnRlcmVkIGtleXdvcmRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF9mb3Jfa2V5d29yZCggZWxlbWVudF9pZCApIHtcclxuXHJcblx0Ly8gV2UgbmVlZCB0byBSZXNldCBwYWdlX251bSB0byAxIHdpdGggZWFjaCBuZXcgc2VhcmNoLCBiZWNhdXNlIHdlIGNhbiBiZSBhdCBwYWdlICM0LCAgYnV0IGFmdGVyICBuZXcgc2VhcmNoICB3ZSBjYW4gIGhhdmUgdG90YWxseSAgb25seSAgMSBwYWdlXHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQna2V5d29yZCcgIDogalF1ZXJ5KCBlbGVtZW50X2lkICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nOiAxXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG59XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlbmQgc2VhcmNoIHJlcXVlc3QgYWZ0ZXIgZmV3IHNlY29uZHMgKHVzdWFsbHkgYWZ0ZXIgMSw1IHNlYylcclxuXHQgKiBDbG9zdXJlIGZ1bmN0aW9uLiBJdHMgdXNlZnVsLCAgZm9yIGRvICBub3Qgc2VuZCB0b28gbWFueSBBamF4IHJlcXVlc3RzLCB3aGVuIHNvbWVvbmUgbWFrZSBmYXN0IHR5cGluZy5cclxuXHQgKi9cclxuXHR2YXIgd3BiY19hanhfYm9va2luZ19zZWFyY2hpbmdfYWZ0ZXJfZmV3X3NlY29uZHMgPSBmdW5jdGlvbiAoKXtcclxuXHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyID0gMDtcclxuXHJcblx0XHRyZXR1cm4gZnVuY3Rpb24gKCBlbGVtZW50X2lkLCB0aW1lcl9kZWxheSApe1xyXG5cclxuXHRcdFx0Ly8gR2V0IGRlZmF1bHQgdmFsdWUgb2YgXCJ0aW1lcl9kZWxheVwiLCAgaWYgcGFyYW1ldGVyIHdhcyBub3QgcGFzc2VkIGludG8gdGhlIGZ1bmN0aW9uLlxyXG5cdFx0XHR0aW1lcl9kZWxheSA9IHR5cGVvZiB0aW1lcl9kZWxheSAhPT0gJ3VuZGVmaW5lZCcgPyB0aW1lcl9kZWxheSA6IDE1MDA7XHJcblxyXG5cdFx0XHRjbGVhclRpbWVvdXQoIGNsb3NlZF90aW1lciApO1x0XHQvLyBDbGVhciBwcmV2aW91cyB0aW1lclxyXG5cclxuXHRcdFx0Ly8gU3RhcnQgbmV3IFRpbWVyXHJcblx0XHRcdGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF9mb3Jfa2V5d29yZC5iaW5kKCAgbnVsbCwgZWxlbWVudF9pZCApLCB0aW1lcl9kZWxheSApO1xyXG5cdFx0fVxyXG5cdH0oKTtcclxuXHJcblxyXG4vKipcclxuICogICBEZWZpbmUgRHluYW1pYyBIb29rcyAgKGxpa2UgcGFnaW5hdGlvbiBjbGljaywgd2hpY2ggcmVuZXcgZWFjaCB0aW1lIHdpdGggbmV3IGxpc3Rpbmcgc2hvd2luZykgIC0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBEZWZpbmUgSFRNTCB1aSBIb29rczogb24gS2V5VXAgfCBDaGFuZ2UgfCAtPiBTb3J0IE9yZGVyICYgTnVtYmVyIEl0ZW1zIC8gUGFnZVxyXG4gKiBXZSBhcmUgaGNuYWdlZCBpdCBlYWNoICB0aW1lLCB3aGVuIHNob3dpbmcgbmV3IGxpc3RpbmcsIGJlY2F1c2UgRE9NIGVsZW1lbnRzIGNobmFnZWRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzKCl7XHJcblxyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mKCB3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyApICkge1xyXG5cdFx0d3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMoICcud3BiY19saXN0aW5nX2NvbnRhaW5lciAnICk7XHJcblx0fVxyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX2xvY2FsZSgpO1xyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrKCk7XHJcblxyXG5cdC8vIEl0ZW1zIFBlciBQYWdlXHJcblx0alF1ZXJ5KCAnLndwYmNfaXRlbXNfcGVyX3BhZ2UnICkub24oICdjaGFuZ2UnLCBmdW5jdGlvbiggZXZlbnQgKXtcclxuXHJcblx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwYWdlX2l0ZW1zX2NvdW50JyAgOiBqUXVlcnkoIHRoaXMgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwYWdlX251bSc6IDFcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0fSApO1xyXG5cclxuXHQvLyBTb3J0aW5nXHJcblx0alF1ZXJ5KCAnLndwYmNfaXRlbXNfc29ydF90eXBlJyApLm9uKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblxyXG5cdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7J3NvcnRfdHlwZSc6IGpRdWVyeSggdGhpcyApLnZhbCgpfSApO1xyXG5cdH0gKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFNob3cgLyBIaWRlIExpc3RpbmcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqICBTaG93IExpc3RpbmcgVGFibGUgXHQtIFx0U2VuZGluZyBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZCBpbiBcIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1wiIE9iai5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93KCl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCgpO1x0XHRcdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIExpc3RpbmcgVGFibGUgKCBhbmQgUGFnaW5hdGlvbiApXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSgpe1xyXG5cdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNi4xLjUuXHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgICAgKS5odG1sKCAnJyApO1xyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyJyApICkuaHRtbCggJycgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgZnVuY3Rpb25zIGZvciBDb250ZW50IFRlbXBsYXRlIGRhdGEgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEhpZ2hsaWdodCBzdHJpbmdzLFxyXG4gKiBieSBpbnNlcnRpbmcgPHNwYW4gY2xhc3M9XCJmaWVsZHZhbHVlIG5hbWUgZmllbGRzZWFyY2h2YWx1ZVwiPi4uLjwvc3Bhbj4gaHRtbCAgZWxlbWVudHMgaW50byB0aGUgc3RyaW5nLlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19kZXRhaWxzIFx0LSBTb3VyY2Ugc3RyaW5nXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX2tleXdvcmRcdC0gS2V5d29yZCB0byBoaWdobGlnaHRcclxuICogQHJldHVybnMge3N0cmluZ31cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X2hpZ2hsaWdodGVkX3NlYXJjaF9rZXl3b3JkKCBib29raW5nX2RldGFpbHMsIGJvb2tpbmdfa2V5d29yZCApe1xyXG5cclxuXHRib29raW5nX2tleXdvcmQgPSBib29raW5nX2tleXdvcmQudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0aWYgKCAwID09IGJvb2tpbmdfa2V5d29yZC5sZW5ndGggKXtcclxuXHRcdHJldHVybiBib29raW5nX2RldGFpbHM7XHJcblx0fVxyXG5cclxuXHQvLyBIaWdobGlnaHQgc3Vic3RyaW5nIHdpdGhpbmcgSFRNTCB0YWdzIGluIFwiQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhXCIgLS0gZS5nLiBzdGFydGluZyBmcm9tICA+ICBhbmQgZW5kaW5nIHdpdGggPFxyXG5cdGxldCBrZXl3b3JkUmVnZXggPSBuZXcgUmVnRXhwKCBgZmllbGR2YWx1ZVtePD5dKj4oW148XSoke2Jvb2tpbmdfa2V5d29yZH1bXjxdKilgLCAnZ2ltJyApO1xyXG5cclxuXHQvL2xldCBtYXRjaGVzID0gWy4uLmJvb2tpbmdfZGV0YWlscy50b0xvd2VyQ2FzZSgpLm1hdGNoQWxsKCBrZXl3b3JkUmVnZXggKV07XHJcblx0bGV0IG1hdGNoZXMgPSBib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5tYXRjaEFsbCgga2V5d29yZFJlZ2V4ICk7XHJcblx0XHRtYXRjaGVzID0gQXJyYXkuZnJvbSggbWF0Y2hlcyApO1xyXG5cclxuXHRsZXQgc3RyaW5nc19hcnIgPSBbXTtcclxuXHRsZXQgcG9zX3ByZXZpb3VzID0gMDtcclxuXHRsZXQgc2VhcmNoX3Bvc19zdGFydDtcclxuXHRsZXQgc2VhcmNoX3Bvc19lbmQ7XHJcblxyXG5cdGZvciAoIGNvbnN0IG1hdGNoIG9mIG1hdGNoZXMgKXtcclxuXHJcblx0XHRzZWFyY2hfcG9zX3N0YXJ0ID0gbWF0Y2guaW5kZXggKyBtYXRjaFsgMCBdLnRvTG93ZXJDYXNlKCkuaW5kZXhPZiggJz4nLCAwICkgKyAxIDtcclxuXHJcblx0XHRzdHJpbmdzX2Fyci5wdXNoKCBib29raW5nX2RldGFpbHMuc3Vic3RyKCBwb3NfcHJldmlvdXMsIChzZWFyY2hfcG9zX3N0YXJ0IC0gcG9zX3ByZXZpb3VzKSApICk7XHJcblxyXG5cdFx0c2VhcmNoX3Bvc19lbmQgPSBib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5pbmRleE9mKCAnPCcsIHNlYXJjaF9wb3Nfc3RhcnQgKTtcclxuXHJcblx0XHRzdHJpbmdzX2Fyci5wdXNoKCAnPHNwYW4gY2xhc3M9XCJmaWVsZHZhbHVlIG5hbWUgZmllbGRzZWFyY2h2YWx1ZVwiPicgKyBib29raW5nX2RldGFpbHMuc3Vic3RyKCBzZWFyY2hfcG9zX3N0YXJ0LCAoc2VhcmNoX3Bvc19lbmQgLSBzZWFyY2hfcG9zX3N0YXJ0KSApICsgJzwvc3Bhbj4nICk7XHJcblxyXG5cdFx0cG9zX3ByZXZpb3VzID0gc2VhcmNoX3Bvc19lbmQ7XHJcblx0fVxyXG5cclxuXHRzdHJpbmdzX2Fyci5wdXNoKCBib29raW5nX2RldGFpbHMuc3Vic3RyKCBwb3NfcHJldmlvdXMsIChib29raW5nX2RldGFpbHMubGVuZ3RoIC0gcG9zX3ByZXZpb3VzKSApICk7XHJcblxyXG5cdHJldHVybiBzdHJpbmdzX2Fyci5qb2luKCAnJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVydCBzcGVjaWFsIEhUTUwgY2hhcmFjdGVycyAgIGZyb206XHQgJmFtcDsgXHQtPiBcdCZcclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlY29kZV9IVE1MX2VudGl0aWVzKCB0ZXh0ICl7XHJcblx0dmFyIHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ3RleHRhcmVhJyApO1xyXG5cdHRleHRBcmVhLmlubmVySFRNTCA9IHRleHQ7XHJcblx0cmV0dXJuIHRleHRBcmVhLnZhbHVlO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVydCBUTyBzcGVjaWFsIEhUTUwgY2hhcmFjdGVycyAgIGZyb206XHQgJiBcdC0+IFx0JmFtcDtcclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMgeyp9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2VuY29kZV9IVE1MX2VudGl0aWVzKHRleHQpIHtcclxuICB2YXIgdGV4dEFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xyXG4gIHRleHRBcmVhLmlubmVyVGV4dCA9IHRleHQ7XHJcbiAgcmV0dXJuIHRleHRBcmVhLmlubmVySFRNTDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIEJ1dHRvbnMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBTdGFydFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJykucmVtb3ZlQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBQYXVzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgaXMgU3Bpbm5pbmcgP1xyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKXtcclxuICAgIGlmICggalF1ZXJ5KCAnI3dwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b24gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuaGFzQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKSApe1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn0iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBQUMsU0FBQUEsMkJBQUFDLENBQUEsRUFBQUMsQ0FBQSxRQUFBQyxDQUFBLHlCQUFBQyxNQUFBLElBQUFILENBQUEsQ0FBQUcsTUFBQSxDQUFBQyxRQUFBLEtBQUFKLENBQUEscUJBQUFFLENBQUEsUUFBQUcsS0FBQSxDQUFBQyxPQUFBLENBQUFOLENBQUEsTUFBQUUsQ0FBQSxHQUFBSywyQkFBQSxDQUFBUCxDQUFBLE1BQUFDLENBQUEsSUFBQUQsQ0FBQSx1QkFBQUEsQ0FBQSxDQUFBUSxNQUFBLElBQUFOLENBQUEsS0FBQUYsQ0FBQSxHQUFBRSxDQUFBLE9BQUFPLEVBQUEsTUFBQUMsQ0FBQSxZQUFBQSxFQUFBLGVBQUFDLENBQUEsRUFBQUQsQ0FBQSxFQUFBRSxDQUFBLFdBQUFBLEVBQUEsV0FBQUgsRUFBQSxJQUFBVCxDQUFBLENBQUFRLE1BQUEsS0FBQUssSUFBQSxXQUFBQSxJQUFBLE1BQUFDLEtBQUEsRUFBQWQsQ0FBQSxDQUFBUyxFQUFBLFVBQUFSLENBQUEsV0FBQUEsRUFB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QUFHLFNBQVUsQ0FBQztNQUVuS0QsWUFBWSxHQUFHRSxjQUFjO0lBQzlCO0VBQUMsU0FBQU8sR0FBQTtJQUFBTixTQUFBLENBQUE3SixDQUFBLENBQUFtSyxHQUFBO0VBQUE7SUFBQU4sU0FBQSxDQUFBL0ksQ0FBQTtFQUFBO0VBRUQySSxXQUFXLENBQUNRLElBQUksQ0FBRWpCLGVBQWUsQ0FBQ2tCLE1BQU0sQ0FBRVIsWUFBWSxFQUFHVixlQUFlLENBQUN6SSxNQUFNLEdBQUdtSixZQUFjLENBQUUsQ0FBQztFQUVuRyxPQUFPRCxXQUFXLENBQUNXLElBQUksQ0FBRSxFQUFHLENBQUM7QUFDOUI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MseUJBQXlCQSxDQUFFQyxJQUFJLEVBQUU7RUFDekMsSUFBSUMsUUFBUSxHQUFHQyxRQUFRLENBQUNDLGFBQWEsQ0FBRSxVQUFXLENBQUM7RUFDbkRGLFFBQVEsQ0FBQ0csU0FBUyxHQUFHSixJQUFJO0VBQ3pCLE9BQU9DLFFBQVEsQ0FBQzFKLEtBQUs7QUFDdEI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUzhKLHlCQUF5QkEsQ0FBQ0wsSUFBSSxFQUFFO0VBQ3ZDLElBQUlDLFFBQVEsR0FBR0MsUUFBUSxDQUFDQyxhQUFhLENBQUMsVUFBVSxDQUFDO0VBQ2pERixRQUFRLENBQUNLLFNBQVMsR0FBR04sSUFBSTtFQUN6QixPQUFPQyxRQUFRLENBQUNHLFNBQVM7QUFDM0I7O0FBR0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTekYsOENBQThDQSxDQUFBLEVBQUU7RUFDeERuRCxNQUFNLENBQUUsMERBQTBELENBQUMsQ0FBQytJLFdBQVcsQ0FBRSxzQkFBdUIsQ0FBQztBQUMxRzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTckUsOENBQThDQSxDQUFBLEVBQUU7RUFDeEQxRSxNQUFNLENBQUUsMERBQTJELENBQUMsQ0FBQ2dKLFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQztBQUN4Rzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsMkNBQTJDQSxDQUFBLEVBQUU7RUFDbEQsSUFBS2pKLE1BQU0sQ0FBRSwwREFBMkQsQ0FBQyxDQUFDa0osUUFBUSxDQUFFLHNCQUF1QixDQUFDLEVBQUU7SUFDaEgsT0FBTyxJQUFJO0VBQ1osQ0FBQyxNQUFNO0lBQ04sT0FBTyxLQUFLO0VBQ2I7QUFDRCIsImlnbm9yZUxpc3QiOltdfQ==
