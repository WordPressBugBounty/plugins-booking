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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19saXN0aW5nLmpzIiwibmFtZXMiOlsiX2NyZWF0ZUZvck9mSXRlcmF0b3JIZWxwZXIiLCJyIiwiZSIsInQiLCJTeW1ib2wiLCJpdGVyYXRvciIsIkFycmF5IiwiaXNBcnJheSIsIl91bnN1cHBvcnRlZEl0ZXJhYmxlVG9BcnJheSIsImxlbmd0aCIsIl9uIiwiRiIsInMiLCJuIiwiZG9uZSIsInZhbHVlIiwiZiIsIlR5cGVFcnJvciIsIm8iLCJhIiwidSIsImNhbGwiLCJuZXh0IiwiX2FycmF5TGlrZVRvQXJyYXkiLCJ0b1N0cmluZyIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJuYW1lIiwiZnJvbSIsInRlc3QiLCJfdHlwZW9mIiwicHJvdG90eXBlIiwialF1ZXJ5Iiwib24iLCJ0b3VjaG1vdmUiLCJlYWNoIiwiaW5kZXgiLCJ0ZF9lbCIsImdldCIsInVuZGVmaW5lZCIsIl90aXBweSIsImluc3RhbmNlIiwiaGlkZSIsIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyIsIm9iaiIsIiQiLCJwX3NlY3VyZSIsInNlY3VyaXR5X29iaiIsInVzZXJfaWQiLCJub25jZSIsImxvY2FsZSIsInNldF9zZWN1cmVfcGFyYW0iLCJwYXJhbV9rZXkiLCJwYXJhbV92YWwiLCJnZXRfc2VjdXJlX3BhcmFtIiwicF9saXN0aW5nIiwic2VhcmNoX3JlcXVlc3Rfb2JqIiwic29ydCIsInNvcnRfdHlwZSIsInBhZ2VfbnVtIiwicGFnZV9pdGVtc19jb3VudCIsImNyZWF0ZV9kYXRlIiwia2V5d29yZCIsInNvdXJjZSIsInNlYXJjaF9zZXRfYWxsX3BhcmFtcyIsInJlcXVlc3RfcGFyYW1fb2JqIiwic2VhcmNoX2dldF9hbGxfcGFyYW1zIiwic2VhcmNoX2dldF9wYXJhbSIsInNlYXJjaF9zZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtc19hcnIiLCJwYXJhbXNfYXJyIiwiXyIsInBfdmFsIiwicF9rZXkiLCJwX2RhdGEiLCJwX290aGVyIiwib3RoZXJfb2JqIiwic2V0X290aGVyX3BhcmFtIiwiZ2V0X290aGVyX3BhcmFtIiwid3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0IiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwibG9nIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwid3BiY19hanhfdXNlcl9pZCIsIndwYmNfYWp4X2xvY2FsZSIsInNlYXJjaF9wYXJhbXMiLCJyZXNwb25zZV9kYXRhIiwidGV4dFN0YXR1cyIsImpxWEhSIiwiZ3JvdXBFbmQiLCJodG1sIiwid2luZG93IiwibG9jYXRpb24iLCJocmVmIiwid3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmciLCJ3cGJjX3BhZ2luYXRpb25fZWNobyIsIk1hdGgiLCJjZWlsIiwid3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSIsImFqeF9uZXdfYm9va2luZ3NfY291bnQiLCJwYXJzZUludCIsInNob3ciLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwiZmFpbCIsImVycm9yVGhyb3duIiwiZXJyb3JfbWVzc2FnZSIsInJlc3BvbnNlVGV4dCIsInJlcGxhY2UiLCJ3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSIsImpzb25faXRlbXNfYXJyIiwianNvbl9zZWFyY2hfcGFyYW1zIiwianNvbl9ib29raW5nX3Jlc291cmNlcyIsIndwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbiIsImNzcyIsImxpc3RfaGVhZGVyX3RwbCIsIndwIiwidGVtcGxhdGUiLCJsaXN0X2Zvb3Rlcl90cGwiLCJsaXN0X3Jvd190cGwiLCJhcHBlbmQiLCJ3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24iLCJtb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UiLCJtb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UiLCJtZXNzYWdlIiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwid3BiY19hanhfYm9va2luZ19wYWdpbmF0aW9uX2NsaWNrIiwicGFnZV9udW1iZXIiLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQiLCJlbGVtZW50X2lkIiwidmFsIiwid3BiY19hanhfYm9va2luZ19zZWFyY2hpbmdfYWZ0ZXJfZmV3X3NlY29uZHMiLCJjbG9zZWRfdGltZXIiLCJ0aW1lcl9kZWxheSIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJiaW5kIiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJ3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX2xvY2FsZSIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrIiwid3BiY19ib29fbGlzdGluZ19faW5pdF9ob29rX19zb3J0X2J5IiwiZXZlbnQiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdyIsIndwYmNfZ2V0X2hpZ2hsaWdodGVkX3NlYXJjaF9rZXl3b3JkIiwiYm9va2luZ19kZXRhaWxzIiwiYm9va2luZ19rZXl3b3JkIiwidHJpbSIsInRvTG93ZXJDYXNlIiwia2V5d29yZFJlZ2V4IiwiUmVnRXhwIiwiY29uY2F0IiwibWF0Y2hlcyIsIm1hdGNoQWxsIiwic3RyaW5nc19hcnIiLCJwb3NfcHJldmlvdXMiLCJzZWFyY2hfcG9zX3N0YXJ0Iiwic2VhcmNoX3Bvc19lbmQiLCJfaXRlcmF0b3IiLCJfc3RlcCIsIm1hdGNoIiwiaW5kZXhPZiIsInB1c2giLCJzdWJzdHIiLCJlcnIiLCJqb2luIiwid3BiY19kZWNvZGVfSFRNTF9lbnRpdGllcyIsInRleHQiLCJ0ZXh0QXJlYSIsImRvY3VtZW50IiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsIndwYmNfZW5jb2RlX0hUTUxfZW50aXRpZXMiLCJpbm5lclRleHQiLCJyZW1vdmVDbGFzcyIsImFkZENsYXNzIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9faXNfc3BpbiIsImhhc0NsYXNzIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fc3JjL2Jvb2tpbmdzX19saXN0aW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxualF1ZXJ5KCdib2R5Jykub24oe1xyXG4gICAgJ3RvdWNobW92ZSc6IGZ1bmN0aW9uKGUpIHtcclxuXHJcblx0XHRqUXVlcnkoICcudGltZXNwYXJ0bHknICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApe1xyXG5cclxuXHRcdFx0dmFyIHRkX2VsID0galF1ZXJ5KCB0aGlzICkuZ2V0KCAwICk7XHJcblxyXG5cdFx0XHRpZiAoICh1bmRlZmluZWQgIT0gdGRfZWwuX3RpcHB5KSApe1xyXG5cclxuXHRcdFx0XHR2YXIgaW5zdGFuY2UgPSB0ZF9lbC5fdGlwcHk7XHJcblx0XHRcdFx0aW5zdGFuY2UuaGlkZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBSZXF1ZXN0IE9iamVjdFxyXG4gKiBIZXJlIHdlIGNhbiAgZGVmaW5lIFNlYXJjaCBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxudmFyIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyA9IChmdW5jdGlvbiAoIG9iaiwgJCkge1xyXG5cclxuXHQvLyBTZWN1cmUgcGFyYW1ldGVycyBmb3IgQWpheFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfc2VjdXJlID0gb2JqLnNlY3VyaXR5X29iaiA9IG9iai5zZWN1cml0eV9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR1c2VyX2lkOiAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRub25jZSAgOiAnJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxlIDogJydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfTtcclxuXHJcblx0b2JqLnNldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9zZWN1cmVbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBMaXN0aW5nIFNlYXJjaCBwYXJhbWV0ZXJzXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9saXN0aW5nID0gb2JqLnNlYXJjaF9yZXF1ZXN0X29iaiA9IG9iai5zZWFyY2hfcmVxdWVzdF9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3J0ICAgICAgICAgICAgOiBcImJvb2tpbmdfaWRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0c29ydF90eXBlICAgICAgIDogXCJERVNDXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhZ2VfbnVtICAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHBhZ2VfaXRlbXNfY291bnQ6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjcmVhdGVfZGF0ZSAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRrZXl3b3JkICAgICAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3VyY2UgICAgICAgICAgOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9hbGxfcGFyYW1zID0gZnVuY3Rpb24gKCByZXF1ZXN0X3BhcmFtX29iaiApIHtcclxuXHRcdHBfbGlzdGluZyA9IHJlcXVlc3RfcGFyYW1fb2JqO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9saXN0aW5nO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfZ2V0X3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9saXN0aW5nWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHQvLyBpZiAoIEFycmF5LmlzQXJyYXkoIHBhcmFtX3ZhbCApICl7XHJcblx0XHQvLyBcdHBhcmFtX3ZhbCA9IEpTT04uc3RyaW5naWZ5KCBwYXJhbV92YWwgKTtcclxuXHRcdC8vIH1cclxuXHRcdHBfbGlzdGluZ1sgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9zZXRfcGFyYW1zX2FyciA9IGZ1bmN0aW9uKCBwYXJhbXNfYXJyICl7XHJcblx0XHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBEZWZpbmUgZGlmZmVyZW50IFNlYXJjaCAgcGFyYW1ldGVycyBmb3IgcmVxdWVzdFxyXG5cdFx0XHR0aGlzLnNlYXJjaF9zZXRfcGFyYW0oIHBfa2V5LCBwX3ZhbCApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIE90aGVyIHBhcmFtZXRlcnMgXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfb3RoZXIgPSBvYmoub3RoZXJfb2JqID0gb2JqLm90aGVyX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9vdGhlclsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXJbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG59KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcgfHwge30sIGpRdWVyeSApKTtcclxuXHJcblxyXG4vKipcclxuICogICBBamF4ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggc2VhcmNoIHJlcXVlc3RcclxuICogZm9yIHNlYXJjaGluZyBzcGVjaWZpYyBLZXl3b3JkIGFuZCBvdGhlciBwYXJhbXNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCgpe1xyXG5cclxuY29uc29sZS5ncm91cENvbGxhcHNlZCgnQUpYX0JPT0tJTkdfTElTVElORycpOyBjb25zb2xlLmxvZyggJyA9PSBCZWZvcmUgQWpheCBTZW5kIC0gc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgPT0gJyAsIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSApO1xyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG4vKlxyXG4vL0ZpeEluOiBmb3JWaWRlb1xyXG5pZiAoICEgaXNfdGhpc19hY3Rpb24gKXtcclxuXHQvL3dwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0JzxkaXYgc3R5bGU9XCJ3aWR0aDoxMDAlO3RleHQtYWxpZ246IGNlbnRlcjtcIiBpZD1cIndwYmNfbG9hZGluZ19zZWN0aW9uXCI+PHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9hdXRvcmVuZXcgd3BiY19zcGluXCI+PC9zcGFuPjwvZGl2PidcclxuXHRcdCsgalF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKClcclxuXHQpO1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIChqUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCkgKXtcdFx0XHQvLyBGaXhJbjogOS4wLjEuNS5cclxuXHRcdGpRdWVyeSggJyN3cGJjX2xvYWRpbmdfc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0YWxlcnQoICdXYXJuaW5nISBCb29raW5nIENhbGVuZGFyLiBJdHMgc2VlbXMgdGhhdCAgeW91IGhhdmUgZGVhY3RpdmF0ZWQgbG9hZGluZyBvZiBCb290c3RyYXAgSlMgZmlsZXMgYXQgQm9va2luZyBTZXR0aW5ncyBHZW5lcmFsIHBhZ2UgaW4gQWR2YW5jZWQgc2VjdGlvbi4nIClcclxuXHR9XHJcbn1cclxuaXNfdGhpc19hY3Rpb24gPSBmYWxzZTtcclxuKi9cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfTElTVElORycsXHJcblx0XHRcdFx0XHR3cGJjX2FqeF91c2VyX2lkOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICksXHJcblxyXG5cdFx0XHRcdFx0c2VhcmNoX3BhcmFtc1x0OiB3cGJjX2FqeF9ib29raW5nX2xpc3Rpbmcuc2VhcmNoX2dldF9hbGxfcGFyYW1zKClcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuLy9GaXhJbjogZm9yVmlkZW9cclxuLy9qUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblxyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9CT09LSU5HX0xJU1RJTkcgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblx0XHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdFx0XHRcdFx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVsb2FkIHBhZ2UsIGFmdGVyIGZpbHRlciB0b29sYmFyIHdhcyByZXNldGVkXHJcblx0XHRcdFx0XHRpZiAoICAgICAgICggICAgIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdKVxyXG5cdFx0XHRcdFx0XHRcdCYmICggJ3Jlc2V0X2RvbmUnID09PSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAndWlfcmVzZXQnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bJ3VpX3Jlc2V0X3VybCddO1xyXG5cdFx0XHRcdFx0XHQvLyBsb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgbGlzdGluZ1xyXG5cdFx0XHRcdFx0aWYgKCByZXNwb25zZV9kYXRhWyAnYWp4X2NvdW50JyBdID4gMCApe1xyXG5cclxuXHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmcoIHJlc3BvbnNlX2RhdGFbICdhanhfaXRlbXMnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9ib29raW5nX3Jlc291cmNlcycgXSApO1xyXG5cclxuXHRcdFx0XHRcdFx0d3BiY19wYWdpbmF0aW9uX2VjaG8oXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyJyApLFxyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdwYWdpbmF0aW9uX2NvbnRhaW5lcl9oZWFkZXInICksXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ3BhZ2luYXRpb25fY29udGFpbmVyX2Zvb3RlcicgKSxcclxuXHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHQncGFnZV9hY3RpdmUnOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX251bScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdCdwYWdlc19jb3VudCc6IE1hdGguY2VpbCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb3VudCcgXSAvIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXVsgJ3BhZ2VfaXRlbXNfY291bnQnIF0gKSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHQncGFnZV9pdGVtc19jb3VudCc6IHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXVsgJ3BhZ2VfaXRlbXNfY291bnQnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHQnc29ydF90eXBlJyAgICAgICA6IHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXVsgJ3NvcnRfdHlwZScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdCd0b3RhbF9jb3VudCcgICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb3VudCcgXSxcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzKCk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MsIGJlY2F1c2Ugd2Ugc2hvdyBuZXcgRE9NIGVsZW1lbnRzXHJcblxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlMCBub3RpY2Utd2FybmluZzBcIiBzdHlsZT1cInRleHQtYWxpZ246Y2VudGVyO2ZvbnQtc2l6ZTogMTVweDttYXJnaW46IDJlbSAwO1wiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0JzxwPjxzdHJvbmc+Tm8gcmVzdWx0cyBmb3VuZCBmb3IgY3VycmVudCBmaWx0ZXIgb3B0aW9ucy4uLjwvc3Ryb25nPjwvcD4nICtcclxuXHRcdFx0XHRcdFx0XHRcdCc8cD48c3Ryb25nPjxhICBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCcgb25jbGljaz1cImphdmFzY3JpcHQ6d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0JyBcXCd1aV9yZXNldFxcJzogXFwnbWFrZV9yZXNldFxcJywgJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0JyBcXCdwYWdlX251bVxcJzogMSAnICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J30gKTtcIj5SZXNldCBmaWx0ZXJzPC9hPiB0byBzaG93IGFsbCBib29raW5ncy48L3N0cm9uZz48L3A+JyArXHJcblx0XHRcdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBVcGRhdGUgbmV3IGJvb2tpbmcgY291bnRcclxuXHRcdFx0XHRcdGlmICggdW5kZWZpbmVkICE9PSByZXNwb25zZV9kYXRhWyAnYWp4X25ld19ib29raW5nc19jb3VudCcgXSApe1xyXG5cdFx0XHRcdFx0XHR2YXIgYWp4X25ld19ib29raW5nc19jb3VudCA9IHBhcnNlSW50KCByZXNwb25zZV9kYXRhWyAnYWp4X25ld19ib29raW5nc19jb3VudCcgXSApXHJcblx0XHRcdFx0XHRcdGlmIChhanhfbmV3X2Jvb2tpbmdzX2NvdW50PjApe1xyXG5cdFx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2JhZGdlX2NvdW50JyApLnNob3coKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcuYmstdXBkYXRlLWNvdW50JyApLmh0bWwoIGFqeF9uZXdfYm9va2luZ3NfY291bnQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblxyXG5cdFx0XHRcdFx0alF1ZXJ5KCAnI2FqYXhfcmVzcG9uZCcgKS5odG1sKCByZXNwb25zZV9kYXRhICk7XHRcdC8vIEZvciBhYmlsaXR5IHRvIHNob3cgcmVzcG9uc2UsIGFkZCBzdWNoIERJViBlbGVtZW50IHRvIHBhZ2VcclxuXHRcdFx0XHR9XHJcblx0XHRcdCAgKS5mYWlsKCBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHsgICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdBamF4X0Vycm9yJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7IH1cclxuXHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9IGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICk7XHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBWaWV3cyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTaG93IExpc3RpbmcgVGFibGUgXHRcdGFuZCBkZWZpbmUgZ01haWwgY2hlY2tib3ggaG9va3NcclxuICpcclxuICogQHBhcmFtIGpzb25faXRlbXNfYXJyXHRcdC0gSlNPTiBvYmplY3Qgd2l0aCBJdGVtc1xyXG4gKiBAcGFyYW0ganNvbl9zZWFyY2hfcGFyYW1zXHQtIEpTT04gb2JqZWN0IHdpdGggU2VhcmNoXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3Nob3dfbGlzdGluZygganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApe1xyXG5cclxuXHR3cGJjX2FqeF9kZWZpbmVfdGVtcGxhdGVzX19yZXNvdXJjZV9tYW5pcHVsYXRpb24oIGpzb25faXRlbXNfYXJyLCBqc29uX3NlYXJjaF9wYXJhbXMsIGpzb25fYm9va2luZ19yZXNvdXJjZXMgKTtcclxuXHJcbi8vY29uc29sZS5sb2coICdqc29uX2l0ZW1zX2FycicgLCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmNzcyggXCJkaXNwbGF5XCIsIFwiZmxleFwiICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHR2YXIgbGlzdF9oZWFkZXJfdHBsID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9ib29raW5nX2xpc3RfaGVhZGVyJyApO1xyXG5cdHZhciBsaXN0X2Zvb3Rlcl90cGwgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2Jvb2tpbmdfbGlzdF9mb290ZXInICk7XHJcblx0dmFyIGxpc3Rfcm93X3RwbCAgICA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYm9va2luZ19saXN0X3JvdycgKTtcclxuXHJcblxyXG5cdC8vIEhlYWRlci5cclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoIGxpc3RfaGVhZGVyX3RwbCgpICk7XHJcblx0Ly8gU2VuZCB0byB0ZW1wbGF0ZSBhbGwgcmVxdWVzdCBwYXJhbXM6IGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbCggbGlzdF9oZWFkZXJfdHBsKHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSkgKTtcclxuXHQvLyBCb2R5LlxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuYXBwZW5kKCAnPGRpdiBjbGFzcz1cIndwYmNfc2VsZWN0YWJsZV9ib2R5XCI+PC9kaXY+JyApO1xyXG5cdC8vIEZvb3Rlci5cclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmFwcGVuZCggbGlzdF9mb290ZXJfdHBsKCkgKTtcclxuXHJcblx0Ly8gUiBvIHcgc1xyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnTElTVElOR19ST1dTJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBMSVNUSU5HX1JPV1NcclxuXHRfLmVhY2goIGpzb25faXRlbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YganNvbl9zZWFyY2hfcGFyYW1zWyAna2V5d29yZCcgXSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUGFyYW1ldGVyIGZvciBtYXJraW5nIGtleXdvcmQgd2l0aCBkaWZmZXJlbnQgY29sb3IgaW4gYSBsaXN0XHJcblx0XHRcdHBfdmFsWyAnX19zZWFyY2hfcmVxdWVzdF9rZXl3b3JkX18nIF0gPSBqc29uX3NlYXJjaF9wYXJhbXNbICdrZXl3b3JkJyBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cF92YWxbICdfX3NlYXJjaF9yZXF1ZXN0X2tleXdvcmRfXycgXSA9ICcnO1xyXG5cdFx0fVxyXG5cdFx0cF92YWxbICdib29raW5nX3Jlc291cmNlcycgXSA9IGpzb25fYm9va2luZ19yZXNvdXJjZXM7XHJcblx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSArICcgLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmFwcGVuZCggbGlzdF9yb3dfdHBsKCBwX3ZhbCApICk7XHJcblx0fSApO1xyXG5jb25zb2xlLmdyb3VwRW5kKCk7IFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTElTVElOR19ST1dTXHJcblxyXG5cdHdwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiggalF1ZXJ5ICk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MgZm9yIGNsaWNraW5nIGF0IENoZWNrYm94ZXNcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIHRlbXBsYXRlIGZvciBjaGFuZ2luZyBib29raW5nIHJlc291cmNlcyAmICB1cGRhdGUgaXQgZWFjaCB0aW1lLCAgd2hlbiAgbGlzdGluZyB1cGRhdGluZywgdXNlZnVsICBmb3Igc2hvd2luZyBhY3R1YWwgIGJvb2tpbmcgcmVzb3VyY2VzLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpzb25faXRlbXNfYXJyXHRcdC0gSlNPTiBvYmplY3Qgd2l0aCBJdGVtc1xyXG5cdCAqIEBwYXJhbSBqc29uX3NlYXJjaF9wYXJhbXNcdC0gSlNPTiBvYmplY3Qgd2l0aCBTZWFyY2hcclxuXHQgKiBAcGFyYW0ganNvbl9ib29raW5nX3Jlc291cmNlc1x0LSBKU09OIG9iamVjdCB3aXRoIFJlc291cmNlc1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbigganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApe1xyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIE5ldy4gMjAyNS0wNC0yMS5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIENoYW5nZSBib29raW5nIHJlc291cmNlIGluIE1vZGFsLlxyXG5cdFx0dmFyIG1vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZSA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZScgKTtcclxuXHJcblx0XHRqUXVlcnkoICcjc2VjdGlvbl9pbl9pbl9tb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UnICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgOiBqc29uX3NlYXJjaF9wYXJhbXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2Jvb2tpbmdfcmVzb3VyY2VzJzoganNvbl9ib29raW5nX3Jlc291cmNlc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHJcblx0XHQvLyBEdXBsaWNhdGUgYm9va2luZyBpbnRvIGFub3RoZXIgcmVzb3VyY2UgaW4gTW9kYWwuIE5ldy4gMjAyNS0wNC0yMS5cclxuXHRcdHZhciBtb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UnICk7XHJcblxyXG5cdFx0alF1ZXJ5KCAnI3NlY3Rpb25faW5faW5fbW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlJyApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X3NlYXJjaF9wYXJhbXMnICAgIDoganNvbl9zZWFyY2hfcGFyYW1zLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ib29raW5nX3Jlc291cmNlcyc6IGpzb25fYm9va2luZ19yZXNvdXJjZXNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9IClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdH1cclxuXHJcblxyXG4vKipcclxuICogU2hvdyBqdXN0IG1lc3NhZ2UgaW5zdGVhZCBvZiBsaXN0aW5nIGFuZCBoaWRlIHBhZ2luYXRpb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlKCBtZXNzYWdlICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2Utd2FybmluZ1wiIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEggbyBvIGsgcyAgLSAgaXRzIEFjdGlvbi9UaW1lcyB3aGVuIG5lZWQgdG8gcmUtUmVuZGVyIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBTZWFyY2ggUmVxdWVzdCBhZnRlciBVcGRhdGluZyBzZWFyY2ggcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXNfYXJyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0Ly9jb25zb2xlLmxvZyggJ1JlcXVlc3QgZm9yOiAnLCBwX2tleSwgcF92YWwgKTtcclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfc2V0X3BhcmFtKCBwX2tleSwgcF92YWwgKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gU2VuZCBBamF4IFJlcXVlc3RcclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNlYXJjaCByZXF1ZXN0IGZvciBcIlBhZ2UgTnVtYmVyXCJcclxuICogQHBhcmFtIHBhZ2VfbnVtYmVyXHRpbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfcGFnaW5hdGlvbl9jbGljayggcGFnZV9udW1iZXIgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgS2V5d29yZCBTZWFyY2hpbmcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VhcmNoIHJlcXVlc3QgZm9yIFwiS2V5d29yZFwiLCBhbHNvIHNldCBjdXJyZW50IHBhZ2UgdG8gIDFcclxuICpcclxuICogQHBhcmFtIGVsZW1lbnRfaWRcdC1cdEhUTUwgSUQgIG9mIGVsZW1lbnQsICB3aGVyZSB3YXMgZW50ZXJlZCBrZXl3b3JkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQoIGVsZW1lbnRfaWQgKSB7XHJcblxyXG5cdC8vIFdlIG5lZWQgdG8gUmVzZXQgcGFnZV9udW0gdG8gMSB3aXRoIGVhY2ggbmV3IHNlYXJjaCwgYmVjYXVzZSB3ZSBjYW4gYmUgYXQgcGFnZSAjNCwgIGJ1dCBhZnRlciAgbmV3IHNlYXJjaCAgd2UgY2FuICBoYXZlIHRvdGFsbHkgIG9ubHkgIDEgcGFnZVxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2tleXdvcmQnICA6IGpRdWVyeSggZWxlbWVudF9pZCApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogMVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBTZW5kIHNlYXJjaCByZXF1ZXN0IGFmdGVyIGZldyBzZWNvbmRzICh1c3VhbGx5IGFmdGVyIDEsNSBzZWMpXHJcblx0ICogQ2xvc3VyZSBmdW5jdGlvbi4gSXRzIHVzZWZ1bCwgIGZvciBkbyAgbm90IHNlbmQgdG9vIG1hbnkgQWpheCByZXF1ZXN0cywgd2hlbiBzb21lb25lIG1ha2UgZmFzdCB0eXBpbmcuXHJcblx0ICovXHJcblx0dmFyIHdwYmNfYWp4X2Jvb2tpbmdfc2VhcmNoaW5nX2FmdGVyX2Zld19zZWNvbmRzID0gZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lciA9IDA7XHJcblxyXG5cdFx0cmV0dXJuIGZ1bmN0aW9uICggZWxlbWVudF9pZCwgdGltZXJfZGVsYXkgKXtcclxuXHJcblx0XHRcdC8vIEdldCBkZWZhdWx0IHZhbHVlIG9mIFwidGltZXJfZGVsYXlcIiwgIGlmIHBhcmFtZXRlciB3YXMgbm90IHBhc3NlZCBpbnRvIHRoZSBmdW5jdGlvbi5cclxuXHRcdFx0dGltZXJfZGVsYXkgPSB0eXBlb2YgdGltZXJfZGVsYXkgIT09ICd1bmRlZmluZWQnID8gdGltZXJfZGVsYXkgOiAxNTAwO1xyXG5cclxuXHRcdFx0Y2xlYXJUaW1lb3V0KCBjbG9zZWRfdGltZXIgKTtcdFx0Ly8gQ2xlYXIgcHJldmlvdXMgdGltZXJcclxuXHJcblx0XHRcdC8vIFN0YXJ0IG5ldyBUaW1lclxyXG5cdFx0XHRjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQuYmluZCggIG51bGwsIGVsZW1lbnRfaWQgKSwgdGltZXJfZGVsYXkgKTtcclxuXHRcdH1cclxuXHR9KCk7XHJcblxyXG5cclxuLyoqXHJcbiAqICAgRGVmaW5lIER5bmFtaWMgSG9va3MgIChsaWtlIHBhZ2luYXRpb24gY2xpY2ssIHdoaWNoIHJlbmV3IGVhY2ggdGltZSB3aXRoIG5ldyBsaXN0aW5nIHNob3dpbmcpICAtLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSBIVE1MIHVpIEhvb2tzOiBvbiBLZXlVcCB8IENoYW5nZSB8IC0+IFNvcnQgT3JkZXIgJiBOdW1iZXIgSXRlbXMgLyBQYWdlXHJcblx0ICogV2UgYXJlIGhjbmFnZWQgaXQgZWFjaCAgdGltZSwgd2hlbiBzaG93aW5nIG5ldyBsaXN0aW5nLCBiZWNhdXNlIERPTSBlbGVtZW50cyBjaG5hZ2VkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MoKSB7XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKSApIHtcclxuXHRcdFx0d3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMoICcud3BiY19fbGlzdF9fdGFibGUgJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlKCk7XHJcblx0XHR3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX3JlbWFyaygpO1xyXG5cclxuXHRcdHdwYmNfYm9vX2xpc3RpbmdfX2luaXRfaG9va19fc29ydF9ieSgpO1xyXG5cclxuXHRcdC8vIEl0ZW1zIFBlciBQYWdlLlxyXG5cdFx0alF1ZXJ5KCAnLndwYmNfaXRlbXNfcGVyX3BhZ2UnICkub24oXHJcblx0XHRcdCdjaGFuZ2UnLFxyXG5cdFx0XHRmdW5jdGlvbiAoZXZlbnQpIHtcclxuXHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdCdwYWdlX2l0ZW1zX2NvdW50JzogalF1ZXJ5KCB0aGlzICkudmFsKCksXHJcblx0XHRcdFx0XHRcdCdwYWdlX251bScgICAgICAgIDogMVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdCk7XHJcblxyXG5cdFx0Ly8gU29ydGluZy5cclxuXHRcdGpRdWVyeSggJy53cGJjX2l0ZW1zX3NvcnRfdHlwZScgKS5vbihcclxuXHRcdFx0J2NoYW5nZScsXHJcblx0XHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAnc29ydF90eXBlJzogalF1ZXJ5KCB0aGlzICkudmFsKCkgfSApO1xyXG5cdFx0XHR9XHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblxyXG4vKipcclxuICogICBTaG93IC8gSGlkZSBMaXN0aW5nICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiAgU2hvdyBMaXN0aW5nIFRhYmxlIFx0LSBcdFNlbmRpbmcgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdygpe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QoKTtcdFx0XHQvLyBTZW5kIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkIGluIFwid3BiY19hanhfYm9va2luZ19saXN0aW5nXCIgT2JqLlxyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBMaXN0aW5nIFRhYmxlICggYW5kIFBhZ2luYXRpb24gKVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX2hpZGUoKXtcclxuXHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICAgICkuaHRtbCggJycgKTtcclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdwYWdpbmF0aW9uX2NvbnRhaW5lcicgKSApLmh0bWwoICcnICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTdXBwb3J0IGZ1bmN0aW9ucyBmb3IgQ29udGVudCBUZW1wbGF0ZSBkYXRhICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBIaWdobGlnaHQgc3RyaW5ncyxcclxuICogYnkgaW5zZXJ0aW5nIDxzcGFuIGNsYXNzPVwiZmllbGR2YWx1ZSBuYW1lIGZpZWxkc2VhcmNodmFsdWVcIj4uLi48L3NwYW4+IGh0bWwgIGVsZW1lbnRzIGludG8gdGhlIHN0cmluZy5cclxuICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZGV0YWlscyBcdC0gU291cmNlIHN0cmluZ1xyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19rZXl3b3JkXHQtIEtleXdvcmQgdG8gaGlnaGxpZ2h0XHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2dldF9oaWdobGlnaHRlZF9zZWFyY2hfa2V5d29yZCggYm9va2luZ19kZXRhaWxzLCBib29raW5nX2tleXdvcmQgKXtcclxuXHJcblx0Ym9va2luZ19rZXl3b3JkID0gYm9va2luZ19rZXl3b3JkLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdGlmICggMCA9PSBib29raW5nX2tleXdvcmQubGVuZ3RoICl7XHJcblx0XHRyZXR1cm4gYm9va2luZ19kZXRhaWxzO1xyXG5cdH1cclxuXHJcblx0Ly8gSGlnaGxpZ2h0IHN1YnN0cmluZyB3aXRoaW5nIEhUTUwgdGFncyBpbiBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiIC0tIGUuZy4gc3RhcnRpbmcgZnJvbSAgPiAgYW5kIGVuZGluZyB3aXRoIDxcclxuXHRsZXQga2V5d29yZFJlZ2V4ID0gbmV3IFJlZ0V4cCggYGZpZWxkdmFsdWVbXjw+XSo+KFtePF0qJHtib29raW5nX2tleXdvcmR9W148XSopYCwgJ2dpbScgKTtcclxuXHJcblx0Ly9sZXQgbWF0Y2hlcyA9IFsuLi5ib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5tYXRjaEFsbCgga2V5d29yZFJlZ2V4ICldO1xyXG5cdGxldCBtYXRjaGVzID0gYm9va2luZ19kZXRhaWxzLnRvTG93ZXJDYXNlKCkubWF0Y2hBbGwoIGtleXdvcmRSZWdleCApO1xyXG5cdFx0bWF0Y2hlcyA9IEFycmF5LmZyb20oIG1hdGNoZXMgKTtcclxuXHJcblx0bGV0IHN0cmluZ3NfYXJyID0gW107XHJcblx0bGV0IHBvc19wcmV2aW91cyA9IDA7XHJcblx0bGV0IHNlYXJjaF9wb3Nfc3RhcnQ7XHJcblx0bGV0IHNlYXJjaF9wb3NfZW5kO1xyXG5cclxuXHRmb3IgKCBjb25zdCBtYXRjaCBvZiBtYXRjaGVzICl7XHJcblxyXG5cdFx0c2VhcmNoX3Bvc19zdGFydCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbIDAgXS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoICc+JywgMCApICsgMSA7XHJcblxyXG5cdFx0c3RyaW5nc19hcnIucHVzaCggYm9va2luZ19kZXRhaWxzLnN1YnN0ciggcG9zX3ByZXZpb3VzLCAoc2VhcmNoX3Bvc19zdGFydCAtIHBvc19wcmV2aW91cykgKSApO1xyXG5cclxuXHRcdHNlYXJjaF9wb3NfZW5kID0gYm9va2luZ19kZXRhaWxzLnRvTG93ZXJDYXNlKCkuaW5kZXhPZiggJzwnLCBzZWFyY2hfcG9zX3N0YXJ0ICk7XHJcblxyXG5cdFx0c3RyaW5nc19hcnIucHVzaCggJzxzcGFuIGNsYXNzPVwiZmllbGR2YWx1ZSBuYW1lIGZpZWxkc2VhcmNodmFsdWVcIj4nICsgYm9va2luZ19kZXRhaWxzLnN1YnN0ciggc2VhcmNoX3Bvc19zdGFydCwgKHNlYXJjaF9wb3NfZW5kIC0gc2VhcmNoX3Bvc19zdGFydCkgKSArICc8L3NwYW4+JyApO1xyXG5cclxuXHRcdHBvc19wcmV2aW91cyA9IHNlYXJjaF9wb3NfZW5kO1xyXG5cdH1cclxuXHJcblx0c3RyaW5nc19hcnIucHVzaCggYm9va2luZ19kZXRhaWxzLnN1YnN0ciggcG9zX3ByZXZpb3VzLCAoYm9va2luZ19kZXRhaWxzLmxlbmd0aCAtIHBvc19wcmV2aW91cykgKSApO1xyXG5cclxuXHRyZXR1cm4gc3RyaW5nc19hcnIuam9pbiggJycgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgc3BlY2lhbCBIVE1MIGNoYXJhY3RlcnMgICBmcm9tOlx0ICZhbXA7IFx0LT4gXHQmXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kZWNvZGVfSFRNTF9lbnRpdGllcyggdGV4dCApe1xyXG5cdHZhciB0ZXh0QXJlYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICd0ZXh0YXJlYScgKTtcclxuXHR0ZXh0QXJlYS5pbm5lckhUTUwgPSB0ZXh0O1xyXG5cdHJldHVybiB0ZXh0QXJlYS52YWx1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgVE8gc3BlY2lhbCBIVE1MIGNoYXJhY3RlcnMgICBmcm9tOlx0ICYgXHQtPiBcdCZhbXA7XHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19lbmNvZGVfSFRNTF9lbnRpdGllcyh0ZXh0KSB7XHJcbiAgdmFyIHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcclxuICB0ZXh0QXJlYS5pbm5lclRleHQgPSB0ZXh0O1xyXG4gIHJldHVybiB0ZXh0QXJlYS5pbm5lckhUTUw7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBCdXR0b25zICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgU3RhcnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKXtcclxuXHRqUXVlcnkoICcjd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbiAubWVudV9pY29uLndwYmNfc3BpbicpLnJlbW92ZUNsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgUGF1c2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKXtcclxuXHRqUXVlcnkoICcjd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbiAubWVudV9pY29uLndwYmNfc3BpbicgKS5hZGRDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIGlzIFNwaW5uaW5nID9cclxuICpcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluKCl7XHJcbiAgICBpZiAoIGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmhhc0NsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICkgKXtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59Il0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUFDLFNBQUFBLDJCQUFBQyxDQUFBLEVBQUFDLENBQUEsUUFBQUMsQ0FBQSx5QkFBQUMsTUFBQSxJQUFBSCxDQUFBLENBQUFHLE1BQUEsQ0FBQUMsUUFBQSxLQUFBSixDQUFBLHFCQUFBRSxDQUFBLFFBQUFHLEtBQUEsQ0FBQUMsT0FBQSxDQUFBTixDQUFBLE1BQUFFLENBQUEsR0FBQUssMkJBQUEsQ0FBQVAsQ0FBQSxNQUFBQyxDQUFBLElBQUFELENBQUEsdUJBQUFBLENBQUEsQ0FBQVEsTUFBQSxJQUFBTixDQUFBLEtBQUFGLENBQUEsR0FBQUUsQ0FBQSxPQUFBTyxFQUFBLE1BQUFDLENBQUEsWUFBQUEsRUFBQSxlQUFBQyxDQUFBLEVBQUFELENBQUEsRUFBQUUsQ0FBQSxXQUFBQSxFQUFBLFdBQUFILEVBQUEsSUFBQVQsQ0FBQSxDQUFBUSxNQUFBLEtBQUFLLElBQUEsV0FBQUEsSUFBQSxNQUFBQyxLQUFBLEVBQUFkLENBQUEsQ0FBQVMsRUFBQSxVQUFBUixDQUFBLFdBQUFBLEVBQUFELENBQUEsVUFBQUEsQ0FBQSxLQUFBZSxDQUFBLEVBQUFMLENBQUEsZ0JBQUFNLFNBQUEsaUpBQUFDLENBQUEsRUFBQUMsQ0FBQSxPQUFBQyxDQUFBLGdCQUFBUixDQUFBLFdBQUFBLEVBQUEsSUFBQVQsQ0FBQSxHQUFBQSxDQUFBLENB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
