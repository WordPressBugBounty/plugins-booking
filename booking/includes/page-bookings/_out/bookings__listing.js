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
var wpbc_booking_listing_inspector_adapter = null;
var wpbc_booking_listing_inspector_refresh_generation = 0;

/**
 * Restore the current Listing selection after canonical rows are replaced.
 *
 * @param {Array<number>} booking_ids Selected booking identifiers captured before refresh.
 * @return {void}
 */
function wpbc_booking_listing_restore_selected_rows(booking_ids) {
  booking_ids.forEach(function (booking_id) {
    var row = document.getElementById('row_id_' + Number(booking_id));
    var checkbox = row ? row.querySelector('.check-column input[type="checkbox"]') : null;
    if (checkbox) {
      jQuery(checkbox).prop('checked', true).trigger('change');
    }
  });
}

/**
 * Reload Booking Listing through its canonical search request after an
 * Inspector save completes in this host.
 *
 * @param {CustomEvent} event Booking Inspector save-completion event.
 * @return {void}
 */
function wpbc_booking_listing_inspector_handle_saved(event) {
  var event_detail = event && event.detail ? event.detail : {};
  var refresh_generation = Number(event_detail.refresh_generation || 0);
  var selected_booking_ids = 'function' === typeof wpbc_get_selected_row_id ? wpbc_get_selected_row_id() : [];
  if ('booking_listing' !== event_detail.source) {
    return;
  }
  if (refresh_generation && refresh_generation <= wpbc_booking_listing_inspector_refresh_generation) {
    return;
  }
  wpbc_booking_listing_inspector_refresh_generation = refresh_generation || wpbc_booking_listing_inspector_refresh_generation + 1;
  wpbc_ajx_booking_ajax_search_request({
    preserve_selection_ids: selected_booking_ids
  });
}

/**
 * Initialize the Booking Listing facade over the reusable booking-domain Inspector.
 *
 * Listing owns only its originating action and focus lifecycle. Authorization,
 * DTO loading, templates, field resolution, notes, and activity remain in the
 * Booking Inspector domain.
 *
 * @return {void}
 */
function wpbc_booking_listing_inspector_initialize() {
  var listing_root = document.querySelector('.wpbc__wrap__booking_listing');
  var shell_host = document.querySelector('[data-wpbc-booking-inspector-booking-listing-host]');
  if (!listing_root || !shell_host || 'undefined' === typeof wpbc_booking_listing_inspector_config || !window.wpbc_booking_inspector_hosts || 'function' !== typeof window.wpbc_booking_inspector_hosts.create_booking_listing) {
    return;
  }
  if (!wpbc_booking_listing_inspector_adapter) {
    wpbc_booking_listing_inspector_adapter = window.wpbc_booking_inspector_hosts.create_booking_listing(listing_root, shell_host, wpbc_booking_listing_inspector_config);
  }
  if (!listing_root.wpbc_booking_inspector_save_refresh_bound) {
    listing_root.addEventListener('wpbc:booking-inspector:saved', wpbc_booking_listing_inspector_handle_saved);
    listing_root.wpbc_booking_inspector_save_refresh_bound = true;
  }
}
jQuery(document).ready(wpbc_booking_listing_inspector_initialize);

/**
 *   Ajax  ------------------------------------------------------------------------------------------------------ */

/**
 * Send the canonical Booking Listing search request.
 *
 * Serial generations prevent a slower obsolete response from replacing newer
 * host state. Inspector refreshes may also preserve the current row selection.
 *
 * @param {Object} request_options Optional host-refresh behavior.
 * @return {jqXHR} Abortable canonical Listing request.
 */
function wpbc_ajx_booking_ajax_search_request(request_options) {
  var options = request_options && 'object' === typeof request_options ? request_options : {};
  var preserve_selection_ids = Array.isArray(options.preserve_selection_ids) ? options.preserve_selection_ids.slice(0) : [];
  var request_generation = Number(wpbc_ajx_booking_ajax_search_request.request_generation || 0) + 1;
  var ajax_request;
  wpbc_ajx_booking_ajax_search_request.request_generation = request_generation;
  if (wpbc_ajx_booking_ajax_search_request.active_request && 'function' === typeof wpbc_ajx_booking_ajax_search_request.active_request.abort) {
    wpbc_ajx_booking_ajax_search_request.active_request.abort();
  }
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
  ajax_request = jQuery.post(wpbc_url_ajax, {
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
    if (request_generation !== wpbc_ajx_booking_ajax_search_request.request_generation) {
      return;
    }
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
        wpbc_booking_listing_restore_selected_rows(preserve_selection_ids);
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
    if ('abort' === textStatus || request_generation !== wpbc_ajx_booking_ajax_search_request.request_generation) {
      return;
    }
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
  }).always(function () {
    if (ajax_request === wpbc_ajx_booking_ajax_search_request.active_request) {
      wpbc_ajx_booking_ajax_search_request.active_request = null;
    }
  })
  // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
  ; // End Ajax
  wpbc_ajx_booking_ajax_search_request.active_request = ajax_request;
  return ajax_request;
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
  wpbc_booking_listing_inspector_initialize();
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
  if (wpbc_booking_listing_inspector_adapter) {
    wpbc_booking_listing_inspector_adapter.refresh();
  }
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19saXN0aW5nLmpzIiwibmFtZXMiOlsialF1ZXJ5Iiwib24iLCJ0b3VjaG1vdmUiLCJlIiwiZWFjaCIsImluZGV4IiwidGRfZWwiLCJnZXQiLCJ1bmRlZmluZWQiLCJfdGlwcHkiLCJpbnN0YW5jZSIsImhpZGUiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCJvYmoiLCIkIiwicF9zZWN1cmUiLCJzZWN1cml0eV9vYmoiLCJ1c2VyX2lkIiwibm9uY2UiLCJsb2NhbGUiLCJzZXRfc2VjdXJlX3BhcmFtIiwicGFyYW1fa2V5IiwicGFyYW1fdmFsIiwiZ2V0X3NlY3VyZV9wYXJhbSIsInBfbGlzdGluZyIsInNlYXJjaF9yZXF1ZXN0X29iaiIsInNvcnQiLCJzb3J0X3R5cGUiLCJwYWdlX251bSIsInBhZ2VfaXRlbXNfY291bnQiLCJjcmVhdGVfZGF0ZSIsImtleXdvcmQiLCJzb3VyY2UiLCJzZWFyY2hfc2V0X2FsbF9wYXJhbXMiLCJyZXF1ZXN0X3BhcmFtX29iaiIsInNlYXJjaF9nZXRfYWxsX3BhcmFtcyIsInNlYXJjaF9nZXRfcGFyYW0iLCJzZWFyY2hfc2V0X3BhcmFtIiwic2VhcmNoX3NldF9wYXJhbXNfYXJyIiwicGFyYW1zX2FyciIsIl8iLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwicF9vdGhlciIsIm90aGVyX29iaiIsInNldF9vdGhlcl9wYXJhbSIsImdldF9vdGhlcl9wYXJhbSIsIndwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9hZGFwdGVyIiwid3BiY19ib29raW5nX2xpc3RpbmdfaW5zcGVjdG9yX3JlZnJlc2hfZ2VuZXJhdGlvbiIsIndwYmNfYm9va2luZ19saXN0aW5nX3Jlc3RvcmVfc2VsZWN0ZWRfcm93cyIsImJvb2tpbmdfaWRzIiwiZm9yRWFjaCIsImJvb2tpbmdfaWQiLCJyb3ciLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwiTnVtYmVyIiwiY2hlY2tib3giLCJxdWVyeVNlbGVjdG9yIiwicHJvcCIsInRyaWdnZXIiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19pbnNwZWN0b3JfaGFuZGxlX3NhdmVkIiwiZXZlbnQiLCJldmVudF9kZXRhaWwiLCJkZXRhaWwiLCJyZWZyZXNoX2dlbmVyYXRpb24iLCJzZWxlY3RlZF9ib29raW5nX2lkcyIsIndwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCIsIndwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCIsInByZXNlcnZlX3NlbGVjdGlvbl9pZHMiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19pbnNwZWN0b3JfaW5pdGlhbGl6ZSIsImxpc3Rpbmdfcm9vdCIsInNoZWxsX2hvc3QiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19pbnNwZWN0b3JfY29uZmlnIiwid2luZG93Iiwid3BiY19ib29raW5nX2luc3BlY3Rvcl9ob3N0cyIsImNyZWF0ZV9ib29raW5nX2xpc3RpbmciLCJ3cGJjX2Jvb2tpbmdfaW5zcGVjdG9yX3NhdmVfcmVmcmVzaF9ib3VuZCIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZWFkeSIsInJlcXVlc3Rfb3B0aW9ucyIsIm9wdGlvbnMiLCJBcnJheSIsImlzQXJyYXkiLCJzbGljZSIsInJlcXVlc3RfZ2VuZXJhdGlvbiIsImFqYXhfcmVxdWVzdCIsImFjdGl2ZV9yZXF1ZXN0IiwiYWJvcnQiLCJjb25zb2xlIiwiZ3JvdXBDb2xsYXBzZWQiLCJsb2ciLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0Iiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX3Nob3ciLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJ3cGJjX2FqeF9sb2NhbGUiLCJzZWFyY2hfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9fbWVzc2FnZV9oaWRlIiwiaHRtbCIsImxvY2F0aW9uIiwiaHJlZiIsIndwYmNfYWp4X2Jvb2tpbmdfc2hvd19saXN0aW5nIiwid3BiY19wYWdpbmF0aW9uX2VjaG8iLCJNYXRoIiwiY2VpbCIsIndwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzIiwid3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX2hpZGUiLCJhanhfbmV3X2Jvb2tpbmdzX2NvdW50IiwicGFyc2VJbnQiLCJzaG93IiwiZmFpbCIsImVycm9yVGhyb3duIiwiZXJyb3JfbWVzc2FnZSIsInJlc3BvbnNlVGV4dCIsInJlcGxhY2UiLCJ3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSIsImFsd2F5cyIsImpzb25faXRlbXNfYXJyIiwianNvbl9zZWFyY2hfcGFyYW1zIiwianNvbl9ib29raW5nX3Jlc291cmNlcyIsIndwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbiIsImNzcyIsImxpc3RfaGVhZGVyX3RwbCIsIndwIiwidGVtcGxhdGUiLCJsaXN0X2Zvb3Rlcl90cGwiLCJsaXN0X3Jvd190cGwiLCJhcHBlbmQiLCJ3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24iLCJyZWZyZXNoIiwibW9kYWxfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlIiwibW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlIiwibWVzc2FnZSIsIndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyIsIndwYmNfYWp4X2Jvb2tpbmdfcGFnaW5hdGlvbl9jbGljayIsInBhZ2VfbnVtYmVyIiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X2Zvcl9rZXl3b3JkIiwiZWxlbWVudF9pZCIsInZhbCIsIndwYmNfYWp4X2Jvb2tpbmdfc2VhcmNoaW5nX2FmdGVyX2Zld19zZWNvbmRzIiwiY2xvc2VkX3RpbWVyIiwidGltZXJfZGVsYXkiLCJjbGVhclRpbWVvdXQiLCJzZXRUaW1lb3V0IiwiYmluZCIsIndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzIiwid3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUiLCJ3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX3JlbWFyayIsIndwYmNfYm9vX2xpc3RpbmdfX2luaXRfaG9va19fc29ydF9ieSIsIndwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93Iiwid3BiY19nZXRfaGlnaGxpZ2h0ZWRfc2VhcmNoX2tleXdvcmQiLCJib29raW5nX2RldGFpbHMiLCJib29raW5nX2tleXdvcmQiLCJ0cmltIiwidG9Mb3dlckNhc2UiLCJsZW5ndGgiLCJrZXl3b3JkUmVnZXgiLCJSZWdFeHAiLCJtYXRjaGVzIiwibWF0Y2hBbGwiLCJmcm9tIiwic3RyaW5nc19hcnIiLCJwb3NfcHJldmlvdXMiLCJzZWFyY2hfcG9zX3N0YXJ0Iiwic2VhcmNoX3Bvc19lbmQiLCJtYXRjaCIsImluZGV4T2YiLCJwdXNoIiwic3Vic3RyIiwiam9pbiIsIndwYmNfZGVjb2RlX0hUTUxfZW50aXRpZXMiLCJ0ZXh0IiwidGV4dEFyZWEiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwidmFsdWUiLCJ3cGJjX2VuY29kZV9IVE1MX2VudGl0aWVzIiwiaW5uZXJUZXh0IiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsImFqYXhfd29ya2luZyIsImxpc3RpbmdfY29udGFpbmVyIiwiZmluZCIsInVuaXF1ZV9kaXZfaWQiLCJEYXRlIiwiZ2V0VGltZSIsInJlbW92ZSIsImNsb3Nlc3QiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluIiwiaGFzQ2xhc3MiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWJvb2tpbmdzL19zcmMvYm9va2luZ3NfX2xpc3RpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5qUXVlcnkoJ2JvZHknKS5vbih7XHJcbiAgICAndG91Y2htb3ZlJzogZnVuY3Rpb24oZSkge1xyXG5cclxuXHRcdGpRdWVyeSggJy50aW1lc3BhcnRseScgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblxyXG5cdFx0XHR2YXIgdGRfZWwgPSBqUXVlcnkoIHRoaXMgKS5nZXQoIDAgKTtcclxuXHJcblx0XHRcdGlmICggKHVuZGVmaW5lZCAhPSB0ZF9lbC5fdGlwcHkpICl7XHJcblxyXG5cdFx0XHRcdHZhciBpbnN0YW5jZSA9IHRkX2VsLl90aXBweTtcclxuXHRcdFx0XHRpbnN0YW5jZS5oaWRlKCk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuLyoqXHJcbiAqIFJlcXVlc3QgT2JqZWN0XHJcbiAqIEhlcmUgd2UgY2FuICBkZWZpbmUgU2VhcmNoIHBhcmFtZXRlcnMgYW5kIFVwZGF0ZSBpdCBsYXRlciwgIHdoZW4gIHNvbWUgcGFyYW1ldGVyIHdhcyBjaGFuZ2VkXHJcbiAqXHJcbiAqL1xyXG52YXIgd3BiY19hanhfYm9va2luZ19saXN0aW5nID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cclxuXHRvYmouc2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX3NlY3VyZVsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX3NlY3VyZVsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIExpc3RpbmcgU2VhcmNoIHBhcmFtZXRlcnNcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2xpc3RpbmcgPSBvYmouc2VhcmNoX3JlcXVlc3Rfb2JqID0gb2JqLnNlYXJjaF9yZXF1ZXN0X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X2FsbF9wYXJhbXMgPSBmdW5jdGlvbiAoIHJlcXVlc3RfcGFyYW1fb2JqICkge1xyXG5cdFx0cF9saXN0aW5nID0gcmVxdWVzdF9wYXJhbV9vYmo7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfYWxsX3BhcmFtcyA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2xpc3Rpbmc7XHJcblx0fTtcclxuXHJcblx0b2JqLnNlYXJjaF9nZXRfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX2xpc3RpbmdbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdG9iai5zZWFyY2hfc2V0X3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdC8vIGlmICggQXJyYXkuaXNBcnJheSggcGFyYW1fdmFsICkgKXtcclxuXHRcdC8vIFx0cGFyYW1fdmFsID0gSlNPTi5zdHJpbmdpZnkoIHBhcmFtX3ZhbCApO1xyXG5cdFx0Ly8gfVxyXG5cdFx0cF9saXN0aW5nWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouc2VhcmNoX3NldF9wYXJhbXNfYXJyID0gZnVuY3Rpb24oIHBhcmFtc19hcnIgKXtcclxuXHRcdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0XHRcdHRoaXMuc2VhcmNoX3NldF9wYXJhbSggcF9rZXksIHBfdmFsICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gT3RoZXIgcGFyYW1ldGVycyBcdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9vdGhlciA9IG9iai5vdGhlcl9vYmogPSBvYmoub3RoZXJfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlclsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblxyXG5cdHJldHVybiBvYmo7XHJcbn0oIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG5cclxudmFyIHdwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9hZGFwdGVyID0gbnVsbDtcclxudmFyIHdwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9yZWZyZXNoX2dlbmVyYXRpb24gPSAwO1xyXG5cclxuLyoqXHJcbiAqIFJlc3RvcmUgdGhlIGN1cnJlbnQgTGlzdGluZyBzZWxlY3Rpb24gYWZ0ZXIgY2Fub25pY2FsIHJvd3MgYXJlIHJlcGxhY2VkLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0FycmF5PG51bWJlcj59IGJvb2tpbmdfaWRzIFNlbGVjdGVkIGJvb2tpbmcgaWRlbnRpZmllcnMgY2FwdHVyZWQgYmVmb3JlIHJlZnJlc2guXHJcbiAqIEByZXR1cm4ge3ZvaWR9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZXN0b3JlX3NlbGVjdGVkX3Jvd3MoIGJvb2tpbmdfaWRzICkge1xyXG5cdGJvb2tpbmdfaWRzLmZvckVhY2goIGZ1bmN0aW9uICggYm9va2luZ19pZCApIHtcclxuXHRcdHZhciByb3cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3Jvd19pZF8nICsgTnVtYmVyKCBib29raW5nX2lkICkgKTtcclxuXHRcdHZhciBjaGVja2JveCA9IHJvdyA/IHJvdy5xdWVyeVNlbGVjdG9yKCAnLmNoZWNrLWNvbHVtbiBpbnB1dFt0eXBlPVwiY2hlY2tib3hcIl0nICkgOiBudWxsO1xyXG5cclxuXHRcdGlmICggY2hlY2tib3ggKSB7XHJcblx0XHRcdGpRdWVyeSggY2hlY2tib3ggKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlbG9hZCBCb29raW5nIExpc3RpbmcgdGhyb3VnaCBpdHMgY2Fub25pY2FsIHNlYXJjaCByZXF1ZXN0IGFmdGVyIGFuXHJcbiAqIEluc3BlY3RvciBzYXZlIGNvbXBsZXRlcyBpbiB0aGlzIGhvc3QuXHJcbiAqXHJcbiAqIEBwYXJhbSB7Q3VzdG9tRXZlbnR9IGV2ZW50IEJvb2tpbmcgSW5zcGVjdG9yIHNhdmUtY29tcGxldGlvbiBldmVudC5cclxuICogQHJldHVybiB7dm9pZH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9oYW5kbGVfc2F2ZWQoIGV2ZW50ICkge1xyXG5cdHZhciBldmVudF9kZXRhaWwgPSBldmVudCAmJiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fTtcclxuXHR2YXIgcmVmcmVzaF9nZW5lcmF0aW9uID0gTnVtYmVyKCBldmVudF9kZXRhaWwucmVmcmVzaF9nZW5lcmF0aW9uIHx8IDAgKTtcclxuXHR2YXIgc2VsZWN0ZWRfYm9va2luZ19pZHMgPSAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkID8gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCkgOiBbXTtcclxuXHJcblx0aWYgKCAnYm9va2luZ19saXN0aW5nJyAhPT0gZXZlbnRfZGV0YWlsLnNvdXJjZSApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0aWYgKCByZWZyZXNoX2dlbmVyYXRpb24gJiYgcmVmcmVzaF9nZW5lcmF0aW9uIDw9IHdwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9yZWZyZXNoX2dlbmVyYXRpb24gKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cdHdwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9yZWZyZXNoX2dlbmVyYXRpb24gPSByZWZyZXNoX2dlbmVyYXRpb24gfHwgd3BiY19ib29raW5nX2xpc3RpbmdfaW5zcGVjdG9yX3JlZnJlc2hfZ2VuZXJhdGlvbiArIDE7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdCggeyBwcmVzZXJ2ZV9zZWxlY3Rpb25faWRzOiBzZWxlY3RlZF9ib29raW5nX2lkcyB9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbml0aWFsaXplIHRoZSBCb29raW5nIExpc3RpbmcgZmFjYWRlIG92ZXIgdGhlIHJldXNhYmxlIGJvb2tpbmctZG9tYWluIEluc3BlY3Rvci5cclxuICpcclxuICogTGlzdGluZyBvd25zIG9ubHkgaXRzIG9yaWdpbmF0aW5nIGFjdGlvbiBhbmQgZm9jdXMgbGlmZWN5Y2xlLiBBdXRob3JpemF0aW9uLFxyXG4gKiBEVE8gbG9hZGluZywgdGVtcGxhdGVzLCBmaWVsZCByZXNvbHV0aW9uLCBub3RlcywgYW5kIGFjdGl2aXR5IHJlbWFpbiBpbiB0aGVcclxuICogQm9va2luZyBJbnNwZWN0b3IgZG9tYWluLlxyXG4gKlxyXG4gKiBAcmV0dXJuIHt2b2lkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfaW5zcGVjdG9yX2luaXRpYWxpemUoKSB7XHJcblx0dmFyIGxpc3Rpbmdfcm9vdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19fd3JhcF9fYm9va2luZ19saXN0aW5nJyApO1xyXG5cdHZhciBzaGVsbF9ob3N0ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYm9va2luZy1pbnNwZWN0b3ItYm9va2luZy1saXN0aW5nLWhvc3RdJyApO1xyXG5cclxuXHRpZiAoXHJcblx0XHQhIGxpc3Rpbmdfcm9vdCB8fCAhIHNoZWxsX2hvc3QgfHxcclxuXHRcdCd1bmRlZmluZWQnID09PSB0eXBlb2Ygd3BiY19ib29raW5nX2xpc3RpbmdfaW5zcGVjdG9yX2NvbmZpZyB8fFxyXG5cdFx0ISB3aW5kb3cud3BiY19ib29raW5nX2luc3BlY3Rvcl9ob3N0cyB8fFxyXG5cdFx0J2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb2tpbmdfaW5zcGVjdG9yX2hvc3RzLmNyZWF0ZV9ib29raW5nX2xpc3RpbmdcclxuXHQpIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmICggISB3cGJjX2Jvb2tpbmdfbGlzdGluZ19pbnNwZWN0b3JfYWRhcHRlciApIHtcclxuXHRcdHdwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9hZGFwdGVyID0gd2luZG93LndwYmNfYm9va2luZ19pbnNwZWN0b3JfaG9zdHMuY3JlYXRlX2Jvb2tpbmdfbGlzdGluZyhcclxuXHRcdFx0bGlzdGluZ19yb290LFxyXG5cdFx0XHRzaGVsbF9ob3N0LFxyXG5cdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19pbnNwZWN0b3JfY29uZmlnXHJcblx0XHQpO1xyXG5cdH1cclxuXHRpZiAoICEgbGlzdGluZ19yb290LndwYmNfYm9va2luZ19pbnNwZWN0b3Jfc2F2ZV9yZWZyZXNoX2JvdW5kICkge1xyXG5cdFx0bGlzdGluZ19yb290LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJvb2tpbmctaW5zcGVjdG9yOnNhdmVkJywgd3BiY19ib29raW5nX2xpc3RpbmdfaW5zcGVjdG9yX2hhbmRsZV9zYXZlZCApO1xyXG5cdFx0bGlzdGluZ19yb290LndwYmNfYm9va2luZ19pbnNwZWN0b3Jfc2F2ZV9yZWZyZXNoX2JvdW5kID0gdHJ1ZTtcclxuXHR9XHJcbn1cclxuXHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggd3BiY19ib29raW5nX2xpc3RpbmdfaW5zcGVjdG9yX2luaXRpYWxpemUgKTtcclxuXHJcblxyXG4vKipcclxuICogICBBamF4ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTZW5kIHRoZSBjYW5vbmljYWwgQm9va2luZyBMaXN0aW5nIHNlYXJjaCByZXF1ZXN0LlxyXG4gKlxyXG4gKiBTZXJpYWwgZ2VuZXJhdGlvbnMgcHJldmVudCBhIHNsb3dlciBvYnNvbGV0ZSByZXNwb25zZSBmcm9tIHJlcGxhY2luZyBuZXdlclxyXG4gKiBob3N0IHN0YXRlLiBJbnNwZWN0b3IgcmVmcmVzaGVzIG1heSBhbHNvIHByZXNlcnZlIHRoZSBjdXJyZW50IHJvdyBzZWxlY3Rpb24uXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0X29wdGlvbnMgT3B0aW9uYWwgaG9zdC1yZWZyZXNoIGJlaGF2aW9yLlxyXG4gKiBAcmV0dXJuIHtqcVhIUn0gQWJvcnRhYmxlIGNhbm9uaWNhbCBMaXN0aW5nIHJlcXVlc3QuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QoIHJlcXVlc3Rfb3B0aW9ucyApe1xyXG5cdHZhciBvcHRpb25zID0gcmVxdWVzdF9vcHRpb25zICYmICdvYmplY3QnID09PSB0eXBlb2YgcmVxdWVzdF9vcHRpb25zID8gcmVxdWVzdF9vcHRpb25zIDoge307XHJcblx0dmFyIHByZXNlcnZlX3NlbGVjdGlvbl9pZHMgPSBBcnJheS5pc0FycmF5KCBvcHRpb25zLnByZXNlcnZlX3NlbGVjdGlvbl9pZHMgKSA/IG9wdGlvbnMucHJlc2VydmVfc2VsZWN0aW9uX2lkcy5zbGljZSggMCApIDogW107XHJcblx0dmFyIHJlcXVlc3RfZ2VuZXJhdGlvbiA9IE51bWJlciggd3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0LnJlcXVlc3RfZ2VuZXJhdGlvbiB8fCAwICkgKyAxO1xyXG5cdHZhciBhamF4X3JlcXVlc3Q7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdC5yZXF1ZXN0X2dlbmVyYXRpb24gPSByZXF1ZXN0X2dlbmVyYXRpb247XHJcblx0aWYgKCB3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QuYWN0aXZlX3JlcXVlc3QgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdC5hY3RpdmVfcmVxdWVzdC5hYm9ydCApIHtcclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdC5hY3RpdmVfcmVxdWVzdC5hYm9ydCgpO1xyXG5cdH1cclxuXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoJ0FKWF9CT09LSU5HX0xJU1RJTkcnKTsgY29uc29sZS5sb2coICcgPT0gQmVmb3JlIEFqYXggU2VuZCAtIHNlYXJjaF9nZXRfYWxsX3BhcmFtcygpID09ICcgLCB3cGJjX2FqeF9ib29raW5nX2xpc3Rpbmcuc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgKTtcclxuXHJcblx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpO1xyXG5cdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9fbWVzc2FnZV9zaG93KCk7XHJcblxyXG4vKlxyXG4vL0ZpeEluOiBmb3JWaWRlb1xyXG5pZiAoICEgaXNfdGhpc19hY3Rpb24gKXtcclxuXHQvL3dwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0JzxkaXYgc3R5bGU9XCJ3aWR0aDoxMDAlO3RleHQtYWxpZ246IGNlbnRlcjtcIiBpZD1cIndwYmNfbG9hZGluZ19zZWN0aW9uXCI+PHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9hdXRvcmVuZXcgd3BiY19zcGluXCI+PC9zcGFuPjwvZGl2PidcclxuXHRcdCsgalF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKClcclxuXHQpO1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIChqUXVlcnkoICcjd3BiY19sb2FkaW5nX3NlY3Rpb24nICkud3BiY19teV9tb2RhbCkgKXtcdFx0XHQvLyBGaXhJbjogOS4wLjEuNS5cclxuXHRcdGpRdWVyeSggJyN3cGJjX2xvYWRpbmdfc2VjdGlvbicgKS53cGJjX215X21vZGFsKCAnc2hvdycgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0YWxlcnQoICdXYXJuaW5nISBCb29raW5nIENhbGVuZGFyLiBJdHMgc2VlbXMgdGhhdCAgeW91IGhhdmUgZGVhY3RpdmF0ZWQgbG9hZGluZyBvZiBCb290c3RyYXAgSlMgZmlsZXMgYXQgQm9va2luZyBTZXR0aW5ncyBHZW5lcmFsIHBhZ2UgaW4gQWR2YW5jZWQgc2VjdGlvbi4nIClcclxuXHR9XHJcbn1cclxuaXNfdGhpc19hY3Rpb24gPSBmYWxzZTtcclxuKi9cclxuXHQvLyBTdGFydCBBamF4XHJcblx0YWpheF9yZXF1ZXN0ID0galF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfTElTVElORycsXHJcblx0XHRcdFx0XHR3cGJjX2FqeF91c2VyX2lkOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICksXHJcblxyXG5cdFx0XHRcdFx0c2VhcmNoX3BhcmFtc1x0OiB3cGJjX2FqeF9ib29raW5nX2xpc3Rpbmcuc2VhcmNoX2dldF9hbGxfcGFyYW1zKClcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuXHRcdFx0XHRcdGlmICggcmVxdWVzdF9nZW5lcmF0aW9uICE9PSB3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QucmVxdWVzdF9nZW5lcmF0aW9uICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcbi8vRml4SW46IGZvclZpZGVvXHJcbi8valF1ZXJ5KCAnI3dwYmNfbG9hZGluZ19zZWN0aW9uJyApLndwYmNfbXlfbW9kYWwoICdoaWRlJyApO1xyXG5cclxudHJ5IHtcclxuY29uc29sZS5sb2coICcgPT0gUmVzcG9uc2UgV1BCQ19BSlhfQk9PS0lOR19MSVNUSU5HID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHRcdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2VfaGlkZSgpO1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVsb2FkIHBhZ2UsIGFmdGVyIGZpbHRlciB0b29sYmFyIHdhcyByZXNldGVkXHJcblx0XHRcdFx0XHRpZiAoICAgICAgICggICAgIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdKVxyXG5cdFx0XHRcdFx0XHRcdCYmICggJ3Jlc2V0X2RvbmUnID09PSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAndWlfcmVzZXQnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfX21lc3NhZ2VfaGlkZSgpO1xyXG5cdFx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bJ3VpX3Jlc2V0X3VybCddO1xyXG5cdFx0XHRcdFx0XHQvLyBsb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgbGlzdGluZ1xyXG5cdFx0XHRcdFx0aWYgKCByZXNwb25zZV9kYXRhWyAnYWp4X2NvdW50JyBdID4gMCApe1xyXG5cclxuXHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X2xpc3RpbmcoIHJlc3BvbnNlX2RhdGFbICdhanhfaXRlbXMnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfc2VhcmNoX3BhcmFtcycgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9ib29raW5nX3Jlc291cmNlcycgXSApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZXN0b3JlX3NlbGVjdGVkX3Jvd3MoIHByZXNlcnZlX3NlbGVjdGlvbl9pZHMgKTtcclxuXHJcblx0XHRcdFx0XHRcdHdwYmNfcGFnaW5hdGlvbl9lY2hvKFxyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdwYWdpbmF0aW9uX2NvbnRhaW5lcicgKSxcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAncGFnaW5hdGlvbl9jb250YWluZXJfaGVhZGVyJyApLFxyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdwYWdpbmF0aW9uX2NvbnRhaW5lcl9mb290ZXInICksXHJcblx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0J3BhZ2VfYWN0aXZlJzogcmVzcG9uc2VfZGF0YVsgJ2FqeF9zZWFyY2hfcGFyYW1zJyBdWyAncGFnZV9udW0nIF0sXHJcblx0XHRcdFx0XHRcdFx0XHQncGFnZXNfY291bnQnOiBNYXRoLmNlaWwoIHJlc3BvbnNlX2RhdGFbICdhanhfY291bnQnIF0gLyByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX2l0ZW1zX2NvdW50JyBdICksXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0J3BhZ2VfaXRlbXNfY291bnQnOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdwYWdlX2l0ZW1zX2NvdW50JyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NvcnRfdHlwZScgICAgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X3NlYXJjaF9wYXJhbXMnIF1bICdzb3J0X3R5cGUnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHQndG90YWxfY291bnQnICAgICA6IHJlc3BvbnNlX2RhdGFbICdhanhfY291bnQnIF0sXHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpO1x0XHRcdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzLCBiZWNhdXNlIHdlIHNob3cgbmV3IERPTSBlbGVtZW50c1xyXG5cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19faGlkZSgpO1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZTAgbm90aWNlLXdhcm5pbmcwXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6IDE1cHg7bWFyZ2luOiAyZW0gMDtcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdCc8cD48c3Ryb25nPk5vIHJlc3VsdHMgZm91bmQgZm9yIGN1cnJlbnQgZmlsdGVyIG9wdGlvbnMuLi48L3N0cm9uZz48L3A+JyArXHJcblx0XHRcdFx0XHRcdFx0XHQnPHA+PHN0cm9uZz48YSAgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiICcgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnIG9uY2xpY2s9XCJqYXZhc2NyaXB0OndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggeycgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCcgXFwndWlfcmVzZXRcXCc6IFxcJ21ha2VfcmVzZXRcXCcsICcgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCcgXFwncGFnZV9udW1cXCc6IDEgJyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdCd9ICk7XCI+UmVzZXQgZmlsdGVyczwvYT4gdG8gc2hvdyBhbGwgYm9va2luZ3MuPC9zdHJvbmc+PC9wPicgK1xyXG5cdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gVXBkYXRlIG5ldyBib29raW5nIGNvdW50XHJcblx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9uZXdfYm9va2luZ3NfY291bnQnIF0gKXtcclxuXHRcdFx0XHRcdFx0dmFyIGFqeF9uZXdfYm9va2luZ3NfY291bnQgPSBwYXJzZUludCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9uZXdfYm9va2luZ3NfY291bnQnIF0gKVxyXG5cdFx0XHRcdFx0XHRpZiAoYWp4X25ld19ib29raW5nc19jb3VudD4wKXtcclxuXHRcdFx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19iYWRnZV9jb3VudCcgKS5zaG93KCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLmJrLXVwZGF0ZS1jb3VudCcgKS5odG1sKCBhanhfbmV3X2Jvb2tpbmdzX2NvdW50ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX2hpZGUoKTtcclxuXHJcblx0XHRcdFx0XHRqUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG59IGZpbmFsbHkge1xyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX2hpZGUoKTtcclxufVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkge1xyXG5cdFx0XHRcdFx0aWYgKCAnYWJvcnQnID09PSB0ZXh0U3RhdHVzIHx8IHJlcXVlc3RfZ2VuZXJhdGlvbiAhPT0gd3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0LnJlcXVlc3RfZ2VuZXJhdGlvbiApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdBamF4X0Vycm9yJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7IH1cclxuXHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX2hpZGUoKTtcclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5yZXNwb25zZVRleHQgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSBqcVhIUi5yZXNwb25zZVRleHQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSggZXJyb3JfbWVzc2FnZSApO1xyXG5cdFx0XHQgIH0pLmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aWYgKCBhamF4X3JlcXVlc3QgPT09IHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9zZWFyY2hfcmVxdWVzdC5hY3RpdmVfcmVxdWVzdCApIHtcclxuXHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0LmFjdGl2ZV9yZXF1ZXN0ID0gbnVsbDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0ICB9IClcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X3NlYXJjaF9yZXF1ZXN0LmFjdGl2ZV9yZXF1ZXN0ID0gYWpheF9yZXF1ZXN0O1xyXG5cdHJldHVybiBhamF4X3JlcXVlc3Q7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBWaWV3cyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTaG93IExpc3RpbmcgVGFibGUgXHRcdGFuZCBkZWZpbmUgZ01haWwgY2hlY2tib3ggaG9va3NcclxuICpcclxuICogQHBhcmFtIGpzb25faXRlbXNfYXJyXHRcdC0gSlNPTiBvYmplY3Qgd2l0aCBJdGVtc1xyXG4gKiBAcGFyYW0ganNvbl9zZWFyY2hfcGFyYW1zXHQtIEpTT04gb2JqZWN0IHdpdGggU2VhcmNoXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3Nob3dfbGlzdGluZygganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApe1xyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19pbnNwZWN0b3JfaW5pdGlhbGl6ZSgpO1xyXG5cclxuXHR3cGJjX2FqeF9kZWZpbmVfdGVtcGxhdGVzX19yZXNvdXJjZV9tYW5pcHVsYXRpb24oIGpzb25faXRlbXNfYXJyLCBqc29uX3NlYXJjaF9wYXJhbXMsIGpzb25fYm9va2luZ19yZXNvdXJjZXMgKTtcclxuXHJcbi8vY29uc29sZS5sb2coICdqc29uX2l0ZW1zX2FycicgLCBqc29uX2l0ZW1zX2FyciwganNvbl9zZWFyY2hfcGFyYW1zICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmNzcyggXCJkaXNwbGF5XCIsIFwiZmxleFwiICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHR2YXIgbGlzdF9oZWFkZXJfdHBsID0gd3AudGVtcGxhdGUoICd3cGJjX2FqeF9ib29raW5nX2xpc3RfaGVhZGVyJyApO1xyXG5cdHZhciBsaXN0X2Zvb3Rlcl90cGwgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X2Jvb2tpbmdfbGlzdF9mb290ZXInICk7XHJcblx0dmFyIGxpc3Rfcm93X3RwbCAgICA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfYm9va2luZ19saXN0X3JvdycgKTtcclxuXHJcblxyXG5cdC8vIEhlYWRlci5cclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoIGxpc3RfaGVhZGVyX3RwbCgpICk7XHJcblx0Ly8gU2VuZCB0byB0ZW1wbGF0ZSBhbGwgcmVxdWVzdCBwYXJhbXM6IGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbCggbGlzdF9oZWFkZXJfdHBsKHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSkgKTtcclxuXHQvLyBCb2R5LlxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuYXBwZW5kKCAnPGRpdiBjbGFzcz1cIndwYmNfc2VsZWN0YWJsZV9ib2R5XCI+PC9kaXY+JyApO1xyXG5cdC8vIEZvb3Rlci5cclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmFwcGVuZCggbGlzdF9mb290ZXJfdHBsKCkgKTtcclxuXHJcblx0Ly8gUiBvIHcgc1xyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnTElTVElOR19ST1dTJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBMSVNUSU5HX1JPV1NcclxuXHRfLmVhY2goIGpzb25faXRlbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YganNvbl9zZWFyY2hfcGFyYW1zWyAna2V5d29yZCcgXSApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUGFyYW1ldGVyIGZvciBtYXJraW5nIGtleXdvcmQgd2l0aCBkaWZmZXJlbnQgY29sb3IgaW4gYSBsaXN0XHJcblx0XHRcdHBfdmFsWyAnX19zZWFyY2hfcmVxdWVzdF9rZXl3b3JkX18nIF0gPSBqc29uX3NlYXJjaF9wYXJhbXNbICdrZXl3b3JkJyBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cF92YWxbICdfX3NlYXJjaF9yZXF1ZXN0X2tleXdvcmRfXycgXSA9ICcnO1xyXG5cdFx0fVxyXG5cdFx0cF92YWxbICdib29raW5nX3Jlc291cmNlcycgXSA9IGpzb25fYm9va2luZ19yZXNvdXJjZXM7XHJcblx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSArICcgLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmFwcGVuZCggbGlzdF9yb3dfdHBsKCBwX3ZhbCApICk7XHJcblx0fSApO1xyXG5jb25zb2xlLmdyb3VwRW5kKCk7IFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTElTVElOR19ST1dTXHJcblxyXG5cdHdwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiggalF1ZXJ5ICk7XHRcdFx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MgZm9yIGNsaWNraW5nIGF0IENoZWNrYm94ZXNcclxuXHRpZiAoIHdwYmNfYm9va2luZ19saXN0aW5nX2luc3BlY3Rvcl9hZGFwdGVyICkge1xyXG5cdFx0d3BiY19ib29raW5nX2xpc3RpbmdfaW5zcGVjdG9yX2FkYXB0ZXIucmVmcmVzaCgpO1xyXG5cdH1cclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIHRlbXBsYXRlIGZvciBjaGFuZ2luZyBib29raW5nIHJlc291cmNlcyAmICB1cGRhdGUgaXQgZWFjaCB0aW1lLCAgd2hlbiAgbGlzdGluZyB1cGRhdGluZywgdXNlZnVsICBmb3Igc2hvd2luZyBhY3R1YWwgIGJvb2tpbmcgcmVzb3VyY2VzLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpzb25faXRlbXNfYXJyXHRcdC0gSlNPTiBvYmplY3Qgd2l0aCBJdGVtc1xyXG5cdCAqIEBwYXJhbSBqc29uX3NlYXJjaF9wYXJhbXNcdC0gSlNPTiBvYmplY3Qgd2l0aCBTZWFyY2hcclxuXHQgKiBAcGFyYW0ganNvbl9ib29raW5nX3Jlc291cmNlc1x0LSBKU09OIG9iamVjdCB3aXRoIFJlc291cmNlc1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYWp4X2RlZmluZV90ZW1wbGF0ZXNfX3Jlc291cmNlX21hbmlwdWxhdGlvbigganNvbl9pdGVtc19hcnIsIGpzb25fc2VhcmNoX3BhcmFtcywganNvbl9ib29raW5nX3Jlc291cmNlcyApe1xyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIE5ldy4gMjAyNS0wNC0yMS5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIENoYW5nZSBib29raW5nIHJlc291cmNlIGluIE1vZGFsLlxyXG5cdFx0dmFyIG1vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZSA9IHdwLnRlbXBsYXRlKCAnd3BiY19hanhfX21vZGFsX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZScgKTtcclxuXHJcblx0XHRqUXVlcnkoICcjc2VjdGlvbl9pbl9pbl9tb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UnICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtb2RhbF9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2UoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdhanhfc2VhcmNoX3BhcmFtcycgICAgOiBqc29uX3NlYXJjaF9wYXJhbXMsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X2Jvb2tpbmdfcmVzb3VyY2VzJzoganNvbl9ib29raW5nX3Jlc291cmNlc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHJcblx0XHQvLyBEdXBsaWNhdGUgYm9va2luZyBpbnRvIGFub3RoZXIgcmVzb3VyY2UgaW4gTW9kYWwuIE5ldy4gMjAyNS0wNC0yMS5cclxuXHRcdHZhciBtb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfYWp4X19tb2RhbF9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2UnICk7XHJcblxyXG5cdFx0alF1ZXJ5KCAnI3NlY3Rpb25faW5faW5fbW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlJyApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bW9kYWxfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYWp4X3NlYXJjaF9wYXJhbXMnICAgIDoganNvbl9zZWFyY2hfcGFyYW1zLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2FqeF9ib29raW5nX3Jlc291cmNlcyc6IGpzb25fYm9va2luZ19yZXNvdXJjZXNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9IClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdH1cclxuXHJcblxyXG4vKipcclxuICogU2hvdyBqdXN0IG1lc3NhZ2UgaW5zdGVhZCBvZiBsaXN0aW5nIGFuZCBoaWRlIHBhZ2luYXRpb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlKCBtZXNzYWdlICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19oaWRlKCk7XHJcblxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2Utd2FybmluZ1wiIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEggbyBvIGsgcyAgLSAgaXRzIEFjdGlvbi9UaW1lcyB3aGVuIG5lZWQgdG8gcmUtUmVuZGVyIFZpZXdzICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBTZWFyY2ggUmVxdWVzdCBhZnRlciBVcGRhdGluZyBzZWFyY2ggcmVxdWVzdCBwYXJhbWV0ZXJzXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXNfYXJyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBkaWZmZXJlbnQgU2VhcmNoICBwYXJhbWV0ZXJzIGZvciByZXF1ZXN0XHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0Ly9jb25zb2xlLmxvZyggJ1JlcXVlc3QgZm9yOiAnLCBwX2tleSwgcF92YWwgKTtcclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfc2V0X3BhcmFtKCBwX2tleSwgcF92YWwgKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gU2VuZCBBamF4IFJlcXVlc3RcclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNlYXJjaCByZXF1ZXN0IGZvciBcIlBhZ2UgTnVtYmVyXCJcclxuICogQHBhcmFtIHBhZ2VfbnVtYmVyXHRpbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfcGFnaW5hdGlvbl9jbGljayggcGFnZV9udW1iZXIgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgS2V5d29yZCBTZWFyY2hpbmcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogU2VhcmNoIHJlcXVlc3QgZm9yIFwiS2V5d29yZFwiLCBhbHNvIHNldCBjdXJyZW50IHBhZ2UgdG8gIDFcclxuICpcclxuICogQHBhcmFtIGVsZW1lbnRfaWRcdC1cdEhUTUwgSUQgIG9mIGVsZW1lbnQsICB3aGVyZSB3YXMgZW50ZXJlZCBrZXl3b3JkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQoIGVsZW1lbnRfaWQgKSB7XHJcblxyXG5cdC8vIFdlIG5lZWQgdG8gUmVzZXQgcGFnZV9udW0gdG8gMSB3aXRoIGVhY2ggbmV3IHNlYXJjaCwgYmVjYXVzZSB3ZSBjYW4gYmUgYXQgcGFnZSAjNCwgIGJ1dCBhZnRlciAgbmV3IHNlYXJjaCAgd2UgY2FuICBoYXZlIHRvdGFsbHkgIG9ubHkgIDEgcGFnZVxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2tleXdvcmQnICA6IGpRdWVyeSggZWxlbWVudF9pZCApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogMVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBTZW5kIHNlYXJjaCByZXF1ZXN0IGFmdGVyIGZldyBzZWNvbmRzICh1c3VhbGx5IGFmdGVyIDEsNSBzZWMpXHJcblx0ICogQ2xvc3VyZSBmdW5jdGlvbi4gSXRzIHVzZWZ1bCwgIGZvciBkbyAgbm90IHNlbmQgdG9vIG1hbnkgQWpheCByZXF1ZXN0cywgd2hlbiBzb21lb25lIG1ha2UgZmFzdCB0eXBpbmcuXHJcblx0ICovXHJcblx0dmFyIHdwYmNfYWp4X2Jvb2tpbmdfc2VhcmNoaW5nX2FmdGVyX2Zld19zZWNvbmRzID0gZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lciA9IDA7XHJcblxyXG5cdFx0cmV0dXJuIGZ1bmN0aW9uICggZWxlbWVudF9pZCwgdGltZXJfZGVsYXkgKXtcclxuXHJcblx0XHRcdC8vIEdldCBkZWZhdWx0IHZhbHVlIG9mIFwidGltZXJfZGVsYXlcIiwgIGlmIHBhcmFtZXRlciB3YXMgbm90IHBhc3NlZCBpbnRvIHRoZSBmdW5jdGlvbi5cclxuXHRcdFx0dGltZXJfZGVsYXkgPSB0eXBlb2YgdGltZXJfZGVsYXkgIT09ICd1bmRlZmluZWQnID8gdGltZXJfZGVsYXkgOiAxNTAwO1xyXG5cclxuXHRcdFx0Y2xlYXJUaW1lb3V0KCBjbG9zZWRfdGltZXIgKTtcdFx0Ly8gQ2xlYXIgcHJldmlvdXMgdGltZXJcclxuXHJcblx0XHRcdC8vIFN0YXJ0IG5ldyBUaW1lclxyXG5cdFx0XHRjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCB3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3RfZm9yX2tleXdvcmQuYmluZCggIG51bGwsIGVsZW1lbnRfaWQgKSwgdGltZXJfZGVsYXkgKTtcclxuXHRcdH1cclxuXHR9KCk7XHJcblxyXG5cclxuLyoqXHJcbiAqICAgRGVmaW5lIER5bmFtaWMgSG9va3MgIChsaWtlIHBhZ2luYXRpb24gY2xpY2ssIHdoaWNoIHJlbmV3IGVhY2ggdGltZSB3aXRoIG5ldyBsaXN0aW5nIHNob3dpbmcpICAtLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSBIVE1MIHVpIEhvb2tzOiBvbiBLZXlVcCB8IENoYW5nZSB8IC0+IFNvcnQgT3JkZXIgJiBOdW1iZXIgSXRlbXMgLyBQYWdlXHJcblx0ICogV2UgYXJlIGhjbmFnZWQgaXQgZWFjaCAgdGltZSwgd2hlbiBzaG93aW5nIG5ldyBsaXN0aW5nLCBiZWNhdXNlIERPTSBlbGVtZW50cyBjaG5hZ2VkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MoKSB7XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKSApIHtcclxuXHRcdFx0d3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMoICcud3BiY19fbGlzdF9fdGFibGUgJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlKCk7XHJcblx0XHR3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX3JlbWFyaygpO1xyXG5cclxuXHRcdHdwYmNfYm9vX2xpc3RpbmdfX2luaXRfaG9va19fc29ydF9ieSgpO1xyXG5cclxuXHRcdC8vIEl0ZW1zIFBlciBQYWdlLlxyXG5cdFx0alF1ZXJ5KCAnLndwYmNfaXRlbXNfcGVyX3BhZ2UnICkub24oXHJcblx0XHRcdCdjaGFuZ2UnLFxyXG5cdFx0XHRmdW5jdGlvbiAoZXZlbnQpIHtcclxuXHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoXHJcblx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdCdwYWdlX2l0ZW1zX2NvdW50JzogalF1ZXJ5KCB0aGlzICkudmFsKCksXHJcblx0XHRcdFx0XHRcdCdwYWdlX251bScgICAgICAgIDogMVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHRcdH1cclxuXHRcdCk7XHJcblxyXG5cdFx0Ly8gU29ydGluZy5cclxuXHRcdGpRdWVyeSggJy53cGJjX2l0ZW1zX3NvcnRfdHlwZScgKS5vbihcclxuXHRcdFx0J2NoYW5nZScsXHJcblx0XHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAnc29ydF90eXBlJzogalF1ZXJ5KCB0aGlzICkudmFsKCkgfSApO1xyXG5cdFx0XHR9XHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblxyXG4vKipcclxuICogICBTaG93IC8gSGlkZSBMaXN0aW5nICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiAgU2hvdyBMaXN0aW5nIFRhYmxlIFx0LSBcdFNlbmRpbmcgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdygpe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfc2VhcmNoX3JlcXVlc3QoKTtcdFx0XHQvLyBTZW5kIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkIGluIFwid3BiY19hanhfYm9va2luZ19saXN0aW5nXCIgT2JqLlxyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBMaXN0aW5nIFRhYmxlICggYW5kIFBhZ2luYXRpb24gKVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX2hpZGUoKXtcclxuXHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICAgICkuaHRtbCggJycgKTtcclxuXHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdwYWdpbmF0aW9uX2NvbnRhaW5lcicgKSApLmh0bWwoICcnICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTdXBwb3J0IGZ1bmN0aW9ucyBmb3IgQ29udGVudCBUZW1wbGF0ZSBkYXRhICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBIaWdobGlnaHQgc3RyaW5ncyxcclxuICogYnkgaW5zZXJ0aW5nIDxzcGFuIGNsYXNzPVwiZmllbGR2YWx1ZSBuYW1lIGZpZWxkc2VhcmNodmFsdWVcIj4uLi48L3NwYW4+IGh0bWwgIGVsZW1lbnRzIGludG8gdGhlIHN0cmluZy5cclxuICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfZGV0YWlscyBcdC0gU291cmNlIHN0cmluZ1xyXG4gKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19rZXl3b3JkXHQtIEtleXdvcmQgdG8gaGlnaGxpZ2h0XHJcbiAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2dldF9oaWdobGlnaHRlZF9zZWFyY2hfa2V5d29yZCggYm9va2luZ19kZXRhaWxzLCBib29raW5nX2tleXdvcmQgKXtcclxuXHJcblx0Ym9va2luZ19rZXl3b3JkID0gYm9va2luZ19rZXl3b3JkLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdGlmICggMCA9PSBib29raW5nX2tleXdvcmQubGVuZ3RoICl7XHJcblx0XHRyZXR1cm4gYm9va2luZ19kZXRhaWxzO1xyXG5cdH1cclxuXHJcblx0Ly8gSGlnaGxpZ2h0IHN1YnN0cmluZyB3aXRoaW5nIEhUTUwgdGFncyBpbiBcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiIC0tIGUuZy4gc3RhcnRpbmcgZnJvbSAgPiAgYW5kIGVuZGluZyB3aXRoIDxcclxuXHRsZXQga2V5d29yZFJlZ2V4ID0gbmV3IFJlZ0V4cCggYGZpZWxkdmFsdWVbXjw+XSo+KFtePF0qJHtib29raW5nX2tleXdvcmR9W148XSopYCwgJ2dpbScgKTtcclxuXHJcblx0Ly9sZXQgbWF0Y2hlcyA9IFsuLi5ib29raW5nX2RldGFpbHMudG9Mb3dlckNhc2UoKS5tYXRjaEFsbCgga2V5d29yZFJlZ2V4ICldO1xyXG5cdGxldCBtYXRjaGVzID0gYm9va2luZ19kZXRhaWxzLnRvTG93ZXJDYXNlKCkubWF0Y2hBbGwoIGtleXdvcmRSZWdleCApO1xyXG5cdFx0bWF0Y2hlcyA9IEFycmF5LmZyb20oIG1hdGNoZXMgKTtcclxuXHJcblx0bGV0IHN0cmluZ3NfYXJyID0gW107XHJcblx0bGV0IHBvc19wcmV2aW91cyA9IDA7XHJcblx0bGV0IHNlYXJjaF9wb3Nfc3RhcnQ7XHJcblx0bGV0IHNlYXJjaF9wb3NfZW5kO1xyXG5cclxuXHRmb3IgKCBjb25zdCBtYXRjaCBvZiBtYXRjaGVzICl7XHJcblxyXG5cdFx0c2VhcmNoX3Bvc19zdGFydCA9IG1hdGNoLmluZGV4ICsgbWF0Y2hbIDAgXS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoICc+JywgMCApICsgMSA7XHJcblxyXG5cdFx0c3RyaW5nc19hcnIucHVzaCggYm9va2luZ19kZXRhaWxzLnN1YnN0ciggcG9zX3ByZXZpb3VzLCAoc2VhcmNoX3Bvc19zdGFydCAtIHBvc19wcmV2aW91cykgKSApO1xyXG5cclxuXHRcdHNlYXJjaF9wb3NfZW5kID0gYm9va2luZ19kZXRhaWxzLnRvTG93ZXJDYXNlKCkuaW5kZXhPZiggJzwnLCBzZWFyY2hfcG9zX3N0YXJ0ICk7XHJcblxyXG5cdFx0c3RyaW5nc19hcnIucHVzaCggJzxzcGFuIGNsYXNzPVwiZmllbGR2YWx1ZSBuYW1lIGZpZWxkc2VhcmNodmFsdWVcIj4nICsgYm9va2luZ19kZXRhaWxzLnN1YnN0ciggc2VhcmNoX3Bvc19zdGFydCwgKHNlYXJjaF9wb3NfZW5kIC0gc2VhcmNoX3Bvc19zdGFydCkgKSArICc8L3NwYW4+JyApO1xyXG5cclxuXHRcdHBvc19wcmV2aW91cyA9IHNlYXJjaF9wb3NfZW5kO1xyXG5cdH1cclxuXHJcblx0c3RyaW5nc19hcnIucHVzaCggYm9va2luZ19kZXRhaWxzLnN1YnN0ciggcG9zX3ByZXZpb3VzLCAoYm9va2luZ19kZXRhaWxzLmxlbmd0aCAtIHBvc19wcmV2aW91cykgKSApO1xyXG5cclxuXHRyZXR1cm4gc3RyaW5nc19hcnIuam9pbiggJycgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgc3BlY2lhbCBIVE1MIGNoYXJhY3RlcnMgICBmcm9tOlx0ICZhbXA7IFx0LT4gXHQmXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kZWNvZGVfSFRNTF9lbnRpdGllcyggdGV4dCApe1xyXG5cdHZhciB0ZXh0QXJlYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICd0ZXh0YXJlYScgKTtcclxuXHR0ZXh0QXJlYS5pbm5lckhUTUwgPSB0ZXh0O1xyXG5cdHJldHVybiB0ZXh0QXJlYS52YWx1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgVE8gc3BlY2lhbCBIVE1MIGNoYXJhY3RlcnMgICBmcm9tOlx0ICYgXHQtPiBcdCZhbXA7XHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHsqfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19lbmNvZGVfSFRNTF9lbnRpdGllcyh0ZXh0KSB7XHJcbiAgdmFyIHRleHRBcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcclxuICB0ZXh0QXJlYS5pbm5lclRleHQgPSB0ZXh0O1xyXG4gIHJldHVybiB0ZXh0QXJlYS5pbm5lckhUTUw7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBCdXR0b25zICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgU3RhcnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKXtcclxuXHRqUXVlcnkoICcjd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbiAubWVudV9pY29uLndwYmNfc3BpbicpLnJlbW92ZUNsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgUGF1c2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKXtcclxuXHRqUXVlcnkoICcjd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbiAubWVudV9pY29uLndwYmNfc3BpbicgKS5hZGRDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU2hvdyB2aXNpYmxlIGZlZWRiYWNrIHdoaWxlIEJvb2tpbmcgTGlzdGluZyBpcyBsb2FkaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX3Nob3coKXtcclxuXHJcblx0dmFyIGFqYXhfd29ya2luZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnYWpheF93b3JraW5nJyApO1xyXG5cclxuXHRpZiAoICEgYWpheF93b3JraW5nICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX19tZXNzYWdlX2hpZGUoKTtcclxuXHJcblx0dmFyIGxpc3RpbmdfY29udGFpbmVyID0gJyc7XHJcblx0aWYgKFxyXG5cdFx0ICAgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyApXHJcblx0XHQmJiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtIClcclxuXHQpIHtcclxuXHRcdGxpc3RpbmdfY29udGFpbmVyID0gd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApO1xyXG5cdH1cclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgbGlzdGluZ19jb250YWluZXJcclxuXHRcdCYmIGpRdWVyeSggbGlzdGluZ19jb250YWluZXIgKS5maW5kKCAnLndwYmNfc3BpbnNfbG9hZGluZ19jb250YWluZXInICkubGVuZ3RoXHJcblx0KSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR2YXIgdW5pcXVlX2Rpdl9pZCA9ICd3cGJjX25vdGljZV8nICsgKCBuZXcgRGF0ZSgpICkuZ2V0VGltZSgpO1xyXG5cclxuXHRqUXVlcnkoIGFqYXhfd29ya2luZyApLmFwcGVuZChcclxuXHRcdCc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfbm90aWNlXCIgc3R5bGU9XCJvcGFjaXR5OiAxO1wiPicgK1xyXG5cdFx0XHQnPGRpdiBpZD1cIndwYmNfYWxlcnRfbWVzc2FnZVwiIGNsYXNzPVwid3BiY19hbGVydF9tZXNzYWdlXCI+JyArXHJcblx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjX2lubmVyX21lc3NhZ2Ugbm90aWNlIG5vdGljZS1pbmZvIFwiPiAnICtcclxuXHRcdFx0XHRcdCc8YSBjbGFzcz1cImNsb3NlXCIgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIG9uY2xpY2s9XCJqYXZhc2NyaXB0OmpRdWVyeSh0aGlzKS5wYXJlbnQoKS5oaWRlKCk7XCI+JnRpbWVzOzwvYT4gJyArXHJcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJ3cGRldmVsb3Agd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX3Byb2Nlc3NpbmdcIj4nICtcclxuXHRcdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwid3BiY19pY25fcm90YXRlX3JpZ2h0IHdwYmNfc3BpbiB3cGJjX2FqYXhfaWNvbiB3cGJjX3Byb2Nlc3Npbmcgd3BiY19pY25fYXV0b3JlbmV3XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9zcGFuPicgK1xyXG5cdFx0XHRcdFx0Jzwvc3Bhbj4gTG9hZGluZyBib29raW5ncy4uLicgK1xyXG5cdFx0XHRcdCc8L2Rpdj4nICtcclxuXHRcdFx0JzwvZGl2PicgK1xyXG5cdFx0JzwvZGl2PidcclxuXHQpO1xyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBCb29raW5nIExpc3RpbmcgbG9hZGluZyBmZWVkYmFjay5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9fbWVzc2FnZV9oaWRlKCl7XHJcblx0alF1ZXJ5KCAnLndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9ub3RpY2UnICkucmVtb3ZlKCk7XHJcblx0alF1ZXJ5KCAnLndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9wcm9jZXNzaW5nJyApLmNsb3Nlc3QoICdbaWRePVwid3BiY19ub3RpY2VfXCJdLCAud3BiY19pbm5lcl9tZXNzYWdlJyApLnJlbW92ZSgpO1xyXG59XHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIGlzIFNwaW5uaW5nID9cclxuICpcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluKCl7XHJcbiAgICBpZiAoIGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uIC5tZW51X2ljb24ud3BiY19zcGluJyApLmhhc0NsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICkgKXtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59XHJcbiJdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWTs7QUFFWkEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDQyxFQUFFLENBQUM7RUFDZCxXQUFXLEVBQUUsU0FBQUMsQ0FBU0MsQ0FBQyxFQUFFO0lBRTNCSCxNQUFNLENBQUUsY0FBZSxDQUFDLENBQUNJLElBQUksQ0FBRSxVQUFXQyxLQUFLLEVBQUU7TUFFaEQsSUFBSUMsS0FBSyxHQUFHTixNQUFNLENBQUUsSUFBSyxDQUFDLENBQUNPLEdBQUcsQ0FBRSxDQUFFLENBQUM7TUFFbkMsSUFBTUMsU0FBUyxJQUFJRixLQUFLLENBQUNHLE1BQU0sRUFBRztRQUVqQyxJQUFJQyxRQUFRLEdBQUdKLEtBQUssQ0FBQ0csTUFBTTtRQUMzQkMsUUFBUSxDQUFDQyxJQUFJLENBQUMsQ0FBQztNQUNoQjtJQUNELENBQUUsQ0FBQztFQUNKO0FBQ0QsQ0FBQyxDQUFDOztBQUVGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJQyx3QkFBd0IsR0FBSSxVQUFXQyxHQUFHLEVBQUVDLENBQUMsRUFBRTtFQUVsRDtFQUNBLElBQUlDLFFBQVEsR0FBR0YsR0FBRyxDQUFDRyxZQUFZLEdBQUdILEdBQUcsQ0FBQ0csWUFBWSxJQUFJO0lBQ3hDQyxPQUFPLEVBQUUsQ0FBQztJQUNWQyxLQUFLLEVBQUksRUFBRTtJQUNYQyxNQUFNLEVBQUc7RUFDUixDQUFDO0VBRWhCTixHQUFHLENBQUNPLGdCQUFnQixHQUFHLFVBQVdDLFNBQVMsRUFBRUMsU0FBUyxFQUFHO0lBQ3hEUCxRQUFRLENBQUVNLFNBQVMsQ0FBRSxHQUFHQyxTQUFTO0VBQ2xDLENBQUM7RUFFRFQsR0FBRyxDQUFDVSxnQkFBZ0IsR0FBRyxVQUFXRixTQUFTLEVBQUc7SUFDN0MsT0FBT04sUUFBUSxDQUFFTSxTQUFTLENBQUU7RUFDN0IsQ0FBQzs7RUFHRDtFQUNBLElBQUlHLFNBQVMsR0FBR1gsR0FBRyxDQUFDWSxrQkFBa0IsR0FBR1osR0FBRyxDQUFDWSxrQkFBa0IsSUFBSTtJQUNsREMsSUFBSSxFQUFjLFlBQVk7SUFDOUJDLFNBQVMsRUFBUyxNQUFNO0lBQ3hCQyxRQUFRLEVBQVUsQ0FBQztJQUNuQkMsZ0JBQWdCLEVBQUUsRUFBRTtJQUNwQkMsV0FBVyxFQUFPLEVBQUU7SUFDcEJDLE9BQU8sRUFBVyxFQUFFO0lBQ3BCQyxNQUFNLEVBQVk7RUFDbkIsQ0FBQztFQUVqQm5CLEdBQUcsQ0FBQ29CLHFCQUFxQixHQUFHLFVBQVdDLGlCQUFpQixFQUFHO0lBQzFEVixTQUFTLEdBQUdVLGlCQUFpQjtFQUM5QixDQUFDO0VBRURyQixHQUFHLENBQUNzQixxQkFBcUIsR0FBRyxZQUFZO0lBQ3ZDLE9BQU9YLFNBQVM7RUFDakIsQ0FBQztFQUVEWCxHQUFHLENBQUN1QixnQkFBZ0IsR0FBRyxVQUFXZixTQUFTLEVBQUc7SUFDN0MsT0FBT0csU0FBUyxDQUFFSCxTQUFTLENBQUU7RUFDOUIsQ0FBQztFQUVEUixHQUFHLENBQUN3QixnQkFBZ0IsR0FBRyxVQUFXaEIsU0FBUyxFQUFFQyxTQUFTLEVBQUc7SUFDeEQ7SUFDQTtJQUNBO0lBQ0FFLFNBQVMsQ0FBRUgsU0FBUyxDQUFFLEdBQUdDLFNBQVM7RUFDbkMsQ0FBQztFQUVEVCxHQUFHLENBQUN5QixxQkFBcUIsR0FBRyxVQUFVQyxVQUFVLEVBQUU7SUFDakRDLENBQUMsQ0FBQ3BDLElBQUksQ0FBRW1DLFVBQVUsRUFBRSxVQUFXRSxLQUFLLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxFQUFFO01BQWdCO01BQ3BFLElBQUksQ0FBQ04sZ0JBQWdCLENBQUVLLEtBQUssRUFBRUQsS0FBTSxDQUFDO0lBQ3RDLENBQUUsQ0FBQztFQUNKLENBQUM7O0VBR0Q7RUFDQSxJQUFJRyxPQUFPLEdBQUcvQixHQUFHLENBQUNnQyxTQUFTLEdBQUdoQyxHQUFHLENBQUNnQyxTQUFTLElBQUksQ0FBRSxDQUFDO0VBRWxEaEMsR0FBRyxDQUFDaUMsZUFBZSxHQUFHLFVBQVd6QixTQUFTLEVBQUVDLFNBQVMsRUFBRztJQUN2RHNCLE9BQU8sQ0FBRXZCLFNBQVMsQ0FBRSxHQUFHQyxTQUFTO0VBQ2pDLENBQUM7RUFFRFQsR0FBRyxDQUFDa0MsZUFBZSxHQUFHLFVBQVcxQixTQUFTLEVBQUc7SUFDNUMsT0FBT3VCLE9BQU8sQ0FBRXZCLFNBQVMsQ0FBRTtFQUM1QixDQUFDO0VBR0QsT0FBT1IsR0FBRztBQUNYLENBQUMsQ0FBRUQsd0JBQXdCLElBQUksQ0FBQyxDQUFDLEVBQUVaLE1BQU8sQ0FBRTtBQUU1QyxJQUFJZ0Qsc0NBQXNDLEdBQUcsSUFBSTtBQUNqRCxJQUFJQyxpREFBaUQsR0FBRyxDQUFDOztBQUV6RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQywwQ0FBMENBLENBQUVDLFdBQVcsRUFBRztFQUNsRUEsV0FBVyxDQUFDQyxPQUFPLENBQUUsVUFBV0MsVUFBVSxFQUFHO0lBQzVDLElBQUlDLEdBQUcsR0FBR0MsUUFBUSxDQUFDQyxjQUFjLENBQUUsU0FBUyxHQUFHQyxNQUFNLENBQUVKLFVBQVcsQ0FBRSxDQUFDO0lBQ3JFLElBQUlLLFFBQVEsR0FBR0osR0FBRyxHQUFHQSxHQUFHLENBQUNLLGFBQWEsQ0FBRSxzQ0FBdUMsQ0FBQyxHQUFHLElBQUk7SUFFdkYsSUFBS0QsUUFBUSxFQUFHO01BQ2YxRCxNQUFNLENBQUUwRCxRQUFTLENBQUMsQ0FBQ0UsSUFBSSxDQUFFLFNBQVMsRUFBRSxJQUFLLENBQUMsQ0FBQ0MsT0FBTyxDQUFFLFFBQVMsQ0FBQztJQUMvRDtFQUNELENBQUUsQ0FBQztBQUNKOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsMkNBQTJDQSxDQUFFQyxLQUFLLEVBQUc7RUFDN0QsSUFBSUMsWUFBWSxHQUFHRCxLQUFLLElBQUlBLEtBQUssQ0FBQ0UsTUFBTSxHQUFHRixLQUFLLENBQUNFLE1BQU0sR0FBRyxDQUFDLENBQUM7RUFDNUQsSUFBSUMsa0JBQWtCLEdBQUdULE1BQU0sQ0FBRU8sWUFBWSxDQUFDRSxrQkFBa0IsSUFBSSxDQUFFLENBQUM7RUFDdkUsSUFBSUMsb0JBQW9CLEdBQUcsVUFBVSxLQUFLLE9BQU9DLHdCQUF3QixHQUFHQSx3QkFBd0IsQ0FBQyxDQUFDLEdBQUcsRUFBRTtFQUUzRyxJQUFLLGlCQUFpQixLQUFLSixZQUFZLENBQUNoQyxNQUFNLEVBQUc7SUFDaEQ7RUFDRDtFQUNBLElBQUtrQyxrQkFBa0IsSUFBSUEsa0JBQWtCLElBQUlqQixpREFBaUQsRUFBRztJQUNwRztFQUNEO0VBQ0FBLGlEQUFpRCxHQUFHaUIsa0JBQWtCLElBQUlqQixpREFBaUQsR0FBRyxDQUFDO0VBRS9Ib0Isb0NBQW9DLENBQUU7SUFBRUMsc0JBQXNCLEVBQUVIO0VBQXFCLENBQUUsQ0FBQztBQUN6Rjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTSSx5Q0FBeUNBLENBQUEsRUFBRztFQUNwRCxJQUFJQyxZQUFZLEdBQUdqQixRQUFRLENBQUNJLGFBQWEsQ0FBRSw4QkFBK0IsQ0FBQztFQUMzRSxJQUFJYyxVQUFVLEdBQUdsQixRQUFRLENBQUNJLGFBQWEsQ0FBRSxvREFBcUQsQ0FBQztFQUUvRixJQUNDLENBQUVhLFlBQVksSUFBSSxDQUFFQyxVQUFVLElBQzlCLFdBQVcsS0FBSyxPQUFPQyxxQ0FBcUMsSUFDNUQsQ0FBRUMsTUFBTSxDQUFDQyw0QkFBNEIsSUFDckMsVUFBVSxLQUFLLE9BQU9ELE1BQU0sQ0FBQ0MsNEJBQTRCLENBQUNDLHNCQUFzQixFQUMvRTtJQUNEO0VBQ0Q7RUFFQSxJQUFLLENBQUU3QixzQ0FBc0MsRUFBRztJQUMvQ0Esc0NBQXNDLEdBQUcyQixNQUFNLENBQUNDLDRCQUE0QixDQUFDQyxzQkFBc0IsQ0FDbEdMLFlBQVksRUFDWkMsVUFBVSxFQUNWQyxxQ0FDRCxDQUFDO0VBQ0Y7RUFDQSxJQUFLLENBQUVGLFlBQVksQ0FBQ00seUNBQXlDLEVBQUc7SUFDL0ROLFlBQVksQ0FBQ08sZ0JBQWdCLENBQUUsOEJBQThCLEVBQUVqQiwyQ0FBNEMsQ0FBQztJQUM1R1UsWUFBWSxDQUFDTSx5Q0FBeUMsR0FBRyxJQUFJO0VBQzlEO0FBQ0Q7QUFFQTlFLE1BQU0sQ0FBRXVELFFBQVMsQ0FBQyxDQUFDeUIsS0FBSyxDQUFFVCx5Q0FBMEMsQ0FBQzs7QUFHckU7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTRixvQ0FBb0NBLENBQUVZLGVBQWUsRUFBRTtFQUMvRCxJQUFJQyxPQUFPLEdBQUdELGVBQWUsSUFBSSxRQUFRLEtBQUssT0FBT0EsZUFBZSxHQUFHQSxlQUFlLEdBQUcsQ0FBQyxDQUFDO0VBQzNGLElBQUlYLHNCQUFzQixHQUFHYSxLQUFLLENBQUNDLE9BQU8sQ0FBRUYsT0FBTyxDQUFDWixzQkFBdUIsQ0FBQyxHQUFHWSxPQUFPLENBQUNaLHNCQUFzQixDQUFDZSxLQUFLLENBQUUsQ0FBRSxDQUFDLEdBQUcsRUFBRTtFQUM3SCxJQUFJQyxrQkFBa0IsR0FBRzdCLE1BQU0sQ0FBRVksb0NBQW9DLENBQUNpQixrQkFBa0IsSUFBSSxDQUFFLENBQUMsR0FBRyxDQUFDO0VBQ25HLElBQUlDLFlBQVk7RUFFaEJsQixvQ0FBb0MsQ0FBQ2lCLGtCQUFrQixHQUFHQSxrQkFBa0I7RUFDNUUsSUFBS2pCLG9DQUFvQyxDQUFDbUIsY0FBYyxJQUFJLFVBQVUsS0FBSyxPQUFPbkIsb0NBQW9DLENBQUNtQixjQUFjLENBQUNDLEtBQUssRUFBRztJQUM3SXBCLG9DQUFvQyxDQUFDbUIsY0FBYyxDQUFDQyxLQUFLLENBQUMsQ0FBQztFQUM1RDtFQUVEQyxPQUFPLENBQUNDLGNBQWMsQ0FBQyxxQkFBcUIsQ0FBQztFQUFFRCxPQUFPLENBQUNFLEdBQUcsQ0FBRSxvREFBb0QsRUFBR2hGLHdCQUF3QixDQUFDdUIscUJBQXFCLENBQUMsQ0FBRSxDQUFDO0VBRXBLMEQsOENBQThDLENBQUMsQ0FBQztFQUNoREMseUNBQXlDLENBQUMsQ0FBQzs7RUFFNUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQztFQUNBUCxZQUFZLEdBQUd2RixNQUFNLENBQUMrRixJQUFJLENBQUVDLGFBQWEsRUFDdEM7SUFDQ0MsTUFBTSxFQUFZLDBCQUEwQjtJQUM1Q0MsZ0JBQWdCLEVBQUV0Rix3QkFBd0IsQ0FBQ1csZ0JBQWdCLENBQUUsU0FBVSxDQUFDO0lBQ3hFTCxLQUFLLEVBQWFOLHdCQUF3QixDQUFDVyxnQkFBZ0IsQ0FBRSxPQUFRLENBQUM7SUFDdEU0RSxlQUFlLEVBQUd2Rix3QkFBd0IsQ0FBQ1csZ0JBQWdCLENBQUUsUUFBUyxDQUFDO0lBRXZFNkUsYUFBYSxFQUFHeEYsd0JBQXdCLENBQUN1QixxQkFBcUIsQ0FBQztFQUNoRSxDQUFDO0VBQ0Q7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSSxVQUFXa0UsYUFBYSxFQUFFQyxVQUFVLEVBQUVDLEtBQUssRUFBRztJQUM3QyxJQUFLakIsa0JBQWtCLEtBQUtqQixvQ0FBb0MsQ0FBQ2lCLGtCQUFrQixFQUFHO01BQ3JGO0lBQ0Q7SUFDTDtJQUNBOztJQUVBLElBQUk7TUFDSkksT0FBTyxDQUFDRSxHQUFHLENBQUUsMkNBQTJDLEVBQUVTLGFBQWMsQ0FBQztNQUFFWCxPQUFPLENBQUNjLFFBQVEsQ0FBQyxDQUFDO01BQ3hGO01BQ0EsSUFBTSxPQUFPSCxhQUFhLEtBQUssUUFBUSxJQUFNQSxhQUFhLEtBQUssSUFBSyxFQUFFO1FBQ3JFckcsTUFBTSxDQUFFLDZCQUE4QixDQUFDLENBQUNXLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBYTtRQUM1RDhGLDhDQUE4QyxDQUFDLENBQUM7UUFDaERDLHlDQUF5QyxDQUFDLENBQUM7UUFDM0MxRyxNQUFNLENBQUVZLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLG1CQUFvQixDQUFFLENBQUMsQ0FBQzRELElBQUksQ0FDbkUsMkVBQTJFLEdBQzFFTixhQUFhLEdBQ2QsUUFDRixDQUFDO1FBQ1Y7TUFDRDs7TUFFQTtNQUNBLElBQWlCN0YsU0FBUyxJQUFJNkYsYUFBYSxDQUFFLG9CQUFvQixDQUFFLElBQzVELFlBQVksS0FBS0EsYUFBYSxDQUFFLG9CQUFvQixDQUFFLENBQUUsVUFBVSxDQUFHLEVBQzNFO1FBQ0FLLHlDQUF5QyxDQUFDLENBQUM7UUFDM0MvQixNQUFNLENBQUNpQyxRQUFRLENBQUNDLElBQUksR0FBR1IsYUFBYSxDQUFFLG9CQUFvQixDQUFFLENBQUMsY0FBYyxDQUFDO1FBQzVFO1FBQ0E7TUFDRDs7TUFFQTtNQUNBLElBQUtBLGFBQWEsQ0FBRSxXQUFXLENBQUUsR0FBRyxDQUFDLEVBQUU7UUFFdENTLDZCQUE2QixDQUFFVCxhQUFhLENBQUUsV0FBVyxDQUFFLEVBQUVBLGFBQWEsQ0FBRSxtQkFBbUIsQ0FBRSxFQUFFQSxhQUFhLENBQUUsdUJBQXVCLENBQUcsQ0FBQztRQUM3SW5ELDBDQUEwQyxDQUFFb0Isc0JBQXVCLENBQUM7UUFFcEV5QyxvQkFBb0IsQ0FDbkJuRyx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxzQkFBdUIsQ0FBQyxFQUNsRW5DLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLDZCQUE4QixDQUFDLEVBQ3pFbkMsd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsNkJBQThCLENBQUMsRUFDekU7VUFDQyxhQUFhLEVBQUVzRCxhQUFhLENBQUUsbUJBQW1CLENBQUUsQ0FBRSxVQUFVLENBQUU7VUFDakUsYUFBYSxFQUFFVyxJQUFJLENBQUNDLElBQUksQ0FBRVosYUFBYSxDQUFFLFdBQVcsQ0FBRSxHQUFHQSxhQUFhLENBQUUsbUJBQW1CLENBQUUsQ0FBRSxrQkFBa0IsQ0FBRyxDQUFDO1VBRXJILGtCQUFrQixFQUFFQSxhQUFhLENBQUUsbUJBQW1CLENBQUUsQ0FBRSxrQkFBa0IsQ0FBRTtVQUM5RSxXQUFXLEVBQVNBLGFBQWEsQ0FBRSxtQkFBbUIsQ0FBRSxDQUFFLFdBQVcsQ0FBRTtVQUN2RSxhQUFhLEVBQU9BLGFBQWEsQ0FBRSxXQUFXO1FBQy9DLENBQ0QsQ0FBQztRQUNEYSxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUMsQ0FBTTtNQUUxQyxDQUFDLE1BQU07UUFFTkMsc0NBQXNDLENBQUMsQ0FBQztRQUN4Q25ILE1BQU0sQ0FBRVksd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsbUJBQW9CLENBQUUsQ0FBQyxDQUFDNEQsSUFBSSxDQUM3RSw4R0FBOEcsR0FDN0csd0VBQXdFLEdBQ3hFLDJDQUEyQyxHQUMxQywwRUFBMEUsR0FDekUsaUNBQWlDLEdBQ2pDLG1CQUFtQixHQUNwQiw0REFBNEQsR0FDOUQsUUFDRCxDQUFDO01BQ0Y7O01BRUE7TUFDQSxJQUFLbkcsU0FBUyxLQUFLNkYsYUFBYSxDQUFFLHdCQUF3QixDQUFFLEVBQUU7UUFDN0QsSUFBSWUsc0JBQXNCLEdBQUdDLFFBQVEsQ0FBRWhCLGFBQWEsQ0FBRSx3QkFBd0IsQ0FBRyxDQUFDO1FBQ2xGLElBQUllLHNCQUFzQixHQUFDLENBQUMsRUFBQztVQUM1QnBILE1BQU0sQ0FBRSxtQkFBb0IsQ0FBQyxDQUFDc0gsSUFBSSxDQUFDLENBQUM7UUFDckM7UUFDQXRILE1BQU0sQ0FBRSxrQkFBbUIsQ0FBQyxDQUFDMkcsSUFBSSxDQUFFUyxzQkFBdUIsQ0FBQztNQUM1RDtNQUVBWCw4Q0FBOEMsQ0FBQyxDQUFDO01BQ2hEQyx5Q0FBeUMsQ0FBQyxDQUFDO01BRTNDMUcsTUFBTSxDQUFFLGVBQWdCLENBQUMsQ0FBQzJHLElBQUksQ0FBRU4sYUFBYyxDQUFDLENBQUMsQ0FBRTtJQUN2RCxDQUFDLFNBQVM7TUFDTEksOENBQThDLENBQUMsQ0FBQztNQUNoREMseUNBQXlDLENBQUMsQ0FBQztJQUNoRDtFQUNJLENBQ0MsQ0FBQyxDQUFDYSxJQUFJLENBQUUsVUFBV2hCLEtBQUssRUFBRUQsVUFBVSxFQUFFa0IsV0FBVyxFQUFHO0lBQ3BELElBQUssT0FBTyxLQUFLbEIsVUFBVSxJQUFJaEIsa0JBQWtCLEtBQUtqQixvQ0FBb0MsQ0FBQ2lCLGtCQUFrQixFQUFHO01BQy9HO0lBQ0Q7SUFDQSxJQUFLWCxNQUFNLENBQUNlLE9BQU8sSUFBSWYsTUFBTSxDQUFDZSxPQUFPLENBQUNFLEdBQUcsRUFBRTtNQUFFRixPQUFPLENBQUNFLEdBQUcsQ0FBRSxZQUFZLEVBQUVXLEtBQUssRUFBRUQsVUFBVSxFQUFFa0IsV0FBWSxDQUFDO0lBQUU7SUFDMUd4SCxNQUFNLENBQUUsNkJBQThCLENBQUMsQ0FBQ1csSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFjO0lBQzdEOEYsOENBQThDLENBQUMsQ0FBQztJQUNoREMseUNBQXlDLENBQUMsQ0FBQztJQUMzQyxJQUFJZSxhQUFhLEdBQUcsVUFBVSxHQUFHLFFBQVEsR0FBRyxZQUFZLEdBQUdELFdBQVc7SUFDdEUsSUFBS2pCLEtBQUssQ0FBQ21CLFlBQVksRUFBRTtNQUN4QkQsYUFBYSxJQUFJbEIsS0FBSyxDQUFDbUIsWUFBWTtJQUNwQztJQUNBRCxhQUFhLEdBQUdBLGFBQWEsQ0FBQ0UsT0FBTyxDQUFFLEtBQUssRUFBRSxRQUFTLENBQUM7SUFFeERDLDZCQUE2QixDQUFFSCxhQUFjLENBQUM7RUFDOUMsQ0FBQyxDQUFDLENBQUNJLE1BQU0sQ0FBRSxZQUFZO0lBQ3ZCLElBQUt0QyxZQUFZLEtBQUtsQixvQ0FBb0MsQ0FBQ21CLGNBQWMsRUFBRztNQUMzRW5CLG9DQUFvQyxDQUFDbUIsY0FBYyxHQUFHLElBQUk7SUFDM0Q7RUFDQSxDQUFFO0VBQ0k7RUFDTjtFQUFBLENBQ0MsQ0FBRTtFQUNQbkIsb0NBQW9DLENBQUNtQixjQUFjLEdBQUdELFlBQVk7RUFDbEUsT0FBT0EsWUFBWTtBQUNwQjs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVN1Qiw2QkFBNkJBLENBQUVnQixjQUFjLEVBQUVDLGtCQUFrQixFQUFFQyxzQkFBc0IsRUFBRTtFQUVuR3pELHlDQUF5QyxDQUFDLENBQUM7RUFFM0MwRCxnREFBZ0QsQ0FBRUgsY0FBYyxFQUFFQyxrQkFBa0IsRUFBRUMsc0JBQXVCLENBQUM7O0VBRS9HO0VBQ0NoSSxNQUFNLENBQUUsNkJBQThCLENBQUMsQ0FBQ2tJLEdBQUcsQ0FBRSxTQUFTLEVBQUUsTUFBTyxDQUFDLENBQUMsQ0FBYTtFQUM5RSxJQUFJQyxlQUFlLEdBQUdDLEVBQUUsQ0FBQ0MsUUFBUSxDQUFFLDhCQUErQixDQUFDO0VBQ25FLElBQUlDLGVBQWUsR0FBR0YsRUFBRSxDQUFDQyxRQUFRLENBQUUsOEJBQStCLENBQUM7RUFDbkUsSUFBSUUsWUFBWSxHQUFNSCxFQUFFLENBQUNDLFFBQVEsQ0FBRSwyQkFBNEIsQ0FBQzs7RUFHaEU7RUFDQXJJLE1BQU0sQ0FBRVksd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsbUJBQW9CLENBQUUsQ0FBQyxDQUFDNEQsSUFBSSxDQUFFd0IsZUFBZSxDQUFDLENBQUUsQ0FBQztFQUNuRztFQUNBO0VBQ0FuSSxNQUFNLENBQUVZLHdCQUF3QixDQUFDbUMsZUFBZSxDQUFFLG1CQUFvQixDQUFFLENBQUMsQ0FBQ3lGLE1BQU0sQ0FBRSwwQ0FBMkMsQ0FBQztFQUM5SDtFQUNBeEksTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRSxDQUFDLENBQUN5RixNQUFNLENBQUVGLGVBQWUsQ0FBQyxDQUFFLENBQUM7O0VBRXJHO0VBQ0Q1QyxPQUFPLENBQUNDLGNBQWMsQ0FBRSxjQUFlLENBQUMsQ0FBQyxDQUFvQjtFQUM1RG5ELENBQUMsQ0FBQ3BDLElBQUksQ0FBRTBILGNBQWMsRUFBRSxVQUFXckYsS0FBSyxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRTtJQUN4RCxJQUFLLFdBQVcsS0FBSyxPQUFPb0Ysa0JBQWtCLENBQUUsU0FBUyxDQUFFLEVBQUU7TUFBYztNQUMxRXRGLEtBQUssQ0FBRSw0QkFBNEIsQ0FBRSxHQUFHc0Ysa0JBQWtCLENBQUUsU0FBUyxDQUFFO0lBQ3hFLENBQUMsTUFBTTtNQUNOdEYsS0FBSyxDQUFFLDRCQUE0QixDQUFFLEdBQUcsRUFBRTtJQUMzQztJQUNBQSxLQUFLLENBQUUsbUJBQW1CLENBQUUsR0FBR3VGLHNCQUFzQjtJQUNyRGhJLE1BQU0sQ0FBRVksd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsbUJBQW9CLENBQUMsR0FBRyx3QkFBeUIsQ0FBQyxDQUFDeUYsTUFBTSxDQUFFRCxZQUFZLENBQUU5RixLQUFNLENBQUUsQ0FBQztFQUNySSxDQUFFLENBQUM7RUFDSmlELE9BQU8sQ0FBQ2MsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUEwQjs7RUFFNUNpQyxvQ0FBb0MsQ0FBRXpJLE1BQU8sQ0FBQyxDQUFDLENBQU07RUFDckQsSUFBS2dELHNDQUFzQyxFQUFHO0lBQzdDQSxzQ0FBc0MsQ0FBQzBGLE9BQU8sQ0FBQyxDQUFDO0VBQ2pEO0FBQ0Q7O0FBR0M7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQyxTQUFTVCxnREFBZ0RBLENBQUVILGNBQWMsRUFBRUMsa0JBQWtCLEVBQUVDLHNCQUFzQixFQUFFO0VBRXRIO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSVcsOEJBQThCLEdBQUdQLEVBQUUsQ0FBQ0MsUUFBUSxDQUFFLDBDQUEyQyxDQUFDO0VBRTlGckksTUFBTSxDQUFFLCtDQUFnRCxDQUFDLENBQUMyRyxJQUFJLENBQzdDZ0MsOEJBQThCLENBQUU7SUFDNUIsbUJBQW1CLEVBQU1aLGtCQUFrQjtJQUMzQyx1QkFBdUIsRUFBRUM7RUFDN0IsQ0FBRSxDQUNKLENBQUM7O0VBRWhCO0VBQ0EsSUFBSVksMENBQTBDLEdBQUdSLEVBQUUsQ0FBQ0MsUUFBUSxDQUFFLHNEQUF1RCxDQUFDO0VBRXRIckksTUFBTSxDQUFFLDJEQUE0RCxDQUFDLENBQUMyRyxJQUFJLENBQ3pEaUMsMENBQTBDLENBQUU7SUFDeEMsbUJBQW1CLEVBQU1iLGtCQUFrQjtJQUMzQyx1QkFBdUIsRUFBRUM7RUFDN0IsQ0FBRSxDQUNKLENBQUM7RUFDaEI7QUFFRDs7QUFHRDtBQUNBO0FBQ0E7QUFDQSxTQUFTSiw2QkFBNkJBLENBQUVpQixPQUFPLEVBQUU7RUFFaEQxQixzQ0FBc0MsQ0FBQyxDQUFDO0VBRXhDbkgsTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBRSxDQUFDLENBQUM0RCxJQUFJLENBQ25FLDJFQUEyRSxHQUMxRWtDLE9BQU8sR0FDUixRQUNGLENBQUM7QUFDWDs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyxnREFBZ0RBLENBQUd2RyxVQUFVLEVBQUU7RUFFdkU7RUFDQUMsQ0FBQyxDQUFDcEMsSUFBSSxDQUFFbUMsVUFBVSxFQUFFLFVBQVdFLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUc7SUFDckQ7SUFDQS9CLHdCQUF3QixDQUFDeUIsZ0JBQWdCLENBQUVLLEtBQUssRUFBRUQsS0FBTSxDQUFDO0VBQzFELENBQUMsQ0FBQzs7RUFFRjtFQUNBNEIsb0NBQW9DLENBQUMsQ0FBQztBQUN2Qzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMwRSxpQ0FBaUNBLENBQUVDLFdBQVcsRUFBRTtFQUV4REYsZ0RBQWdELENBQUU7SUFDekMsVUFBVSxFQUFFRTtFQUNiLENBQUUsQ0FBQztBQUNaOztBQUdBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLGdEQUFnREEsQ0FBRUMsVUFBVSxFQUFHO0VBRXZFO0VBQ0FKLGdEQUFnRCxDQUFFO0lBQ3hDLFNBQVMsRUFBSTlJLE1BQU0sQ0FBRWtKLFVBQVcsQ0FBQyxDQUFDQyxHQUFHLENBQUMsQ0FBQztJQUN2QyxVQUFVLEVBQUU7RUFDYixDQUFFLENBQUM7QUFDYjs7QUFFQztBQUNEO0FBQ0E7QUFDQTtBQUNDLElBQUlDLDRDQUE0QyxHQUFHLFlBQVc7RUFFN0QsSUFBSUMsWUFBWSxHQUFHLENBQUM7RUFFcEIsT0FBTyxVQUFXSCxVQUFVLEVBQUVJLFdBQVcsRUFBRTtJQUUxQztJQUNBQSxXQUFXLEdBQUcsT0FBT0EsV0FBVyxLQUFLLFdBQVcsR0FBR0EsV0FBVyxHQUFHLElBQUk7SUFFckVDLFlBQVksQ0FBRUYsWUFBYSxDQUFDLENBQUMsQ0FBRTs7SUFFL0I7SUFDQUEsWUFBWSxHQUFHRyxVQUFVLENBQUVQLGdEQUFnRCxDQUFDUSxJQUFJLENBQUcsSUFBSSxFQUFFUCxVQUFXLENBQUMsRUFBRUksV0FBWSxDQUFDO0VBQ3JILENBQUM7QUFDRixDQUFDLENBQUMsQ0FBQzs7QUFHSjtBQUNBOztBQUVDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0MsU0FBU3BDLGdDQUFnQ0EsQ0FBQSxFQUFHO0VBRTNDLElBQUssVUFBVSxLQUFLLE9BQVF3QywwQkFBMkIsRUFBRztJQUN6REEsMEJBQTBCLENBQUUscUJBQXNCLENBQUM7RUFDcEQ7RUFFQUMsbUNBQW1DLENBQUMsQ0FBQztFQUNyQ0MsbUNBQW1DLENBQUMsQ0FBQztFQUVyQ0Msb0NBQW9DLENBQUMsQ0FBQzs7RUFFdEM7RUFDQTdKLE1BQU0sQ0FBRSxzQkFBdUIsQ0FBQyxDQUFDQyxFQUFFLENBQ2xDLFFBQVEsRUFDUixVQUFVOEQsS0FBSyxFQUFFO0lBQ2hCK0UsZ0RBQWdELENBQy9DO01BQ0Msa0JBQWtCLEVBQUU5SSxNQUFNLENBQUUsSUFBSyxDQUFDLENBQUNtSixHQUFHLENBQUMsQ0FBQztNQUN4QyxVQUFVLEVBQVU7SUFDckIsQ0FDRCxDQUFDO0VBQ0YsQ0FDRCxDQUFDOztFQUVEO0VBQ0FuSixNQUFNLENBQUUsdUJBQXdCLENBQUMsQ0FBQ0MsRUFBRSxDQUNuQyxRQUFRLEVBQ1IsVUFBVThELEtBQUssRUFBRTtJQUNoQitFLGdEQUFnRCxDQUFFO01BQUUsV0FBVyxFQUFFOUksTUFBTSxDQUFFLElBQUssQ0FBQyxDQUFDbUosR0FBRyxDQUFDO0lBQUUsQ0FBRSxDQUFDO0VBQzFGLENBQ0QsQ0FBQztBQUNGOztBQUdEO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBU1csc0NBQXNDQSxDQUFBLEVBQUU7RUFFaER6RixvQ0FBb0MsQ0FBQyxDQUFDLENBQUMsQ0FBRztBQUMzQzs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTOEMsc0NBQXNDQSxDQUFBLEVBQUU7RUFDaERuSCxNQUFNLENBQUUsNkJBQThCLENBQUMsQ0FBQ1csSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFrQjtFQUNqRVgsTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxtQkFBb0IsQ0FBSyxDQUFDLENBQUM0RCxJQUFJLENBQUUsRUFBRyxDQUFDO0VBQ3ZGM0csTUFBTSxDQUFFWSx3QkFBd0IsQ0FBQ21DLGVBQWUsQ0FBRSxzQkFBdUIsQ0FBRSxDQUFDLENBQUM0RCxJQUFJLENBQUUsRUFBRyxDQUFDO0FBQ3hGOztBQUdBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTb0QsbUNBQW1DQSxDQUFFQyxlQUFlLEVBQUVDLGVBQWUsRUFBRTtFQUUvRUEsZUFBZSxHQUFHQSxlQUFlLENBQUNDLElBQUksQ0FBQyxDQUFDLENBQUNDLFdBQVcsQ0FBQyxDQUFDO0VBQ3RELElBQUssQ0FBQyxJQUFJRixlQUFlLENBQUNHLE1BQU0sRUFBRTtJQUNqQyxPQUFPSixlQUFlO0VBQ3ZCOztFQUVBO0VBQ0EsSUFBSUssWUFBWSxHQUFHLElBQUlDLE1BQU0sQ0FBRSwwQkFBMEJMLGVBQWUsUUFBUSxFQUFFLEtBQU0sQ0FBQzs7RUFFekY7RUFDQSxJQUFJTSxPQUFPLEdBQUdQLGVBQWUsQ0FBQ0csV0FBVyxDQUFDLENBQUMsQ0FBQ0ssUUFBUSxDQUFFSCxZQUFhLENBQUM7RUFDbkVFLE9BQU8sR0FBR3BGLEtBQUssQ0FBQ3NGLElBQUksQ0FBRUYsT0FBUSxDQUFDO0VBRWhDLElBQUlHLFdBQVcsR0FBRyxFQUFFO0VBQ3BCLElBQUlDLFlBQVksR0FBRyxDQUFDO0VBQ3BCLElBQUlDLGdCQUFnQjtFQUNwQixJQUFJQyxjQUFjO0VBRWxCLEtBQU0sTUFBTUMsS0FBSyxJQUFJUCxPQUFPLEVBQUU7SUFFN0JLLGdCQUFnQixHQUFHRSxLQUFLLENBQUN6SyxLQUFLLEdBQUd5SyxLQUFLLENBQUUsQ0FBQyxDQUFFLENBQUNYLFdBQVcsQ0FBQyxDQUFDLENBQUNZLE9BQU8sQ0FBRSxHQUFHLEVBQUUsQ0FBRSxDQUFDLEdBQUcsQ0FBQztJQUUvRUwsV0FBVyxDQUFDTSxJQUFJLENBQUVoQixlQUFlLENBQUNpQixNQUFNLENBQUVOLFlBQVksRUFBR0MsZ0JBQWdCLEdBQUdELFlBQWMsQ0FBRSxDQUFDO0lBRTdGRSxjQUFjLEdBQUdiLGVBQWUsQ0FBQ0csV0FBVyxDQUFDLENBQUMsQ0FBQ1ksT0FBTyxDQUFFLEdBQUcsRUFBRUgsZ0JBQWlCLENBQUM7SUFFL0VGLFdBQVcsQ0FBQ00sSUFBSSxDQUFFLGlEQUFpRCxHQUFHaEIsZUFBZSxDQUFDaUIsTUFBTSxDQUFFTCxnQkFBZ0IsRUFBR0MsY0FBYyxHQUFHRCxnQkFBa0IsQ0FBQyxHQUFHLFNBQVUsQ0FBQztJQUVuS0QsWUFBWSxHQUFHRSxjQUFjO0VBQzlCO0VBRUFILFdBQVcsQ0FBQ00sSUFBSSxDQUFFaEIsZUFBZSxDQUFDaUIsTUFBTSxDQUFFTixZQUFZLEVBQUdYLGVBQWUsQ0FBQ0ksTUFBTSxHQUFHTyxZQUFjLENBQUUsQ0FBQztFQUVuRyxPQUFPRCxXQUFXLENBQUNRLElBQUksQ0FBRSxFQUFHLENBQUM7QUFDOUI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0MseUJBQXlCQSxDQUFFQyxJQUFJLEVBQUU7RUFDekMsSUFBSUMsUUFBUSxHQUFHOUgsUUFBUSxDQUFDK0gsYUFBYSxDQUFFLFVBQVcsQ0FBQztFQUNuREQsUUFBUSxDQUFDRSxTQUFTLEdBQUdILElBQUk7RUFDekIsT0FBT0MsUUFBUSxDQUFDRyxLQUFLO0FBQ3RCOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLHlCQUF5QkEsQ0FBQ0wsSUFBSSxFQUFFO0VBQ3ZDLElBQUlDLFFBQVEsR0FBRzlILFFBQVEsQ0FBQytILGFBQWEsQ0FBQyxVQUFVLENBQUM7RUFDakRELFFBQVEsQ0FBQ0ssU0FBUyxHQUFHTixJQUFJO0VBQ3pCLE9BQU9DLFFBQVEsQ0FBQ0UsU0FBUztBQUMzQjs7QUFHQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFNBQVMxRiw4Q0FBOENBLENBQUEsRUFBRTtFQUN4RDdGLE1BQU0sQ0FBRSwwREFBMEQsQ0FBQyxDQUFDMkwsV0FBVyxDQUFFLHNCQUF1QixDQUFDO0FBQzFHOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFNBQVNsRiw4Q0FBOENBLENBQUEsRUFBRTtFQUN4RHpHLE1BQU0sQ0FBRSwwREFBMkQsQ0FBQyxDQUFDNEwsUUFBUSxDQUFFLHNCQUF1QixDQUFDO0FBQ3hHOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFNBQVM5Rix5Q0FBeUNBLENBQUEsRUFBRTtFQUVuRCxJQUFJK0YsWUFBWSxHQUFHdEksUUFBUSxDQUFDQyxjQUFjLENBQUUsY0FBZSxDQUFDO0VBRTVELElBQUssQ0FBRXFJLFlBQVksRUFBRztJQUNyQjtFQUNEO0VBRUFuRix5Q0FBeUMsQ0FBQyxDQUFDO0VBRTNDLElBQUlvRixpQkFBaUIsR0FBRyxFQUFFO0VBQzFCLElBQ00sV0FBVyxLQUFLLE9BQU9sTCx3QkFBd0IsSUFDL0MsVUFBVSxLQUFLLE9BQU9BLHdCQUF3QixDQUFDbUMsZUFBaUIsRUFDcEU7SUFDRCtJLGlCQUFpQixHQUFHbEwsd0JBQXdCLENBQUNtQyxlQUFlLENBQUUsbUJBQW9CLENBQUM7RUFDcEY7RUFFQSxJQUNJK0ksaUJBQWlCLElBQ2pCOUwsTUFBTSxDQUFFOEwsaUJBQWtCLENBQUMsQ0FBQ0MsSUFBSSxDQUFFLCtCQUFnQyxDQUFDLENBQUMzQixNQUFNLEVBQzVFO0lBQ0Q7RUFDRDtFQUVBLElBQUk0QixhQUFhLEdBQUcsY0FBYyxHQUFLLElBQUlDLElBQUksQ0FBQyxDQUFDLENBQUdDLE9BQU8sQ0FBQyxDQUFDO0VBRTdEbE0sTUFBTSxDQUFFNkwsWUFBYSxDQUFDLENBQUNyRCxNQUFNLENBQzVCLFdBQVcsR0FBR3dELGFBQWEsR0FBRyxtRUFBbUUsR0FDaEcsMERBQTBELEdBQ3pELHVEQUF1RCxHQUN0RCw0R0FBNEcsR0FDNUcsaUVBQWlFLEdBQ2hFLDRIQUE0SCxHQUM3SCw2QkFBNkIsR0FDOUIsUUFBUSxHQUNULFFBQVEsR0FDVCxRQUNELENBQUM7QUFDRjs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTdEYseUNBQXlDQSxDQUFBLEVBQUU7RUFDbkQxRyxNQUFNLENBQUUscUNBQXNDLENBQUMsQ0FBQ21NLE1BQU0sQ0FBQyxDQUFDO0VBQ3hEbk0sTUFBTSxDQUFFLHlDQUEwQyxDQUFDLENBQUNvTSxPQUFPLENBQUUsMkNBQTRDLENBQUMsQ0FBQ0QsTUFBTSxDQUFDLENBQUM7QUFDcEg7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNFLDJDQUEyQ0EsQ0FBQSxFQUFFO0VBQ2xELElBQUtyTSxNQUFNLENBQUUsMERBQTJELENBQUMsQ0FBQ3NNLFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQyxFQUFFO0lBQ2hILE9BQU8sSUFBSTtFQUNaLENBQUMsTUFBTTtJQUNOLE9BQU8sS0FBSztFQUNiO0FBQ0QiLCJpZ25vcmVMaXN0IjpbXX0=
