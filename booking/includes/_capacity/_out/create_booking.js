"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// ==  A j a x    A d d    N e w    B o o k i n g  ==
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Submit new booking
 *
 * @param params   =     {
                                'resource_id'        : resource_id,
                                'dates_ddmmyy_csv'   : document.getElementById( 'date_booking' + resource_id ).value,
                                'formdata'           : formdata,
                                'booking_hash'       : my_booking_hash,
                                'custom_form'        : my_booking_form,

                                'captcha_chalange'   : captcha_chalange,
                                'captcha_user_input' : user_captcha,

                                'is_emails_send'     : is_send_emeils,
                                'active_locale'      : wpdev_active_locale
						}
 *
 */
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
function wpbc_ajx_booking__create(params) {
  console.groupCollapsed('WPBC_AJX_BOOKING__CREATE');
  console.groupCollapsed('== Before Ajax Send ==');
  console.log(params);
  console.groupEnd();
  params = wpbc_captcha__simple__maybe_remove_in_ajx_params(params);

  // Trigger hook  before sending request  to  create the booking.
  jQuery('body').trigger('wpbc_before_booking_create', [params['resource_id'], params]);

  // Start Ajax.
  jQuery.post(wpbc_url_ajax, {
    action: 'WPBC_AJX_BOOKING__CREATE',
    wpbc_ajx_user_id: _wpbc.get_secure_param('user_id'),
    nonce: _wpbc.get_secure_param('nonce'),
    wpbc_ajx_locale: _wpbc.get_secure_param('locale'),
    calendar_request_params: params
    /**
     *  Usually  params = { 'resource_id'        : resource_id,
     *						'dates_ddmmyy_csv'   : document.getElementById( 'date_booking' + resource_id ).value,
     *						'formdata'           : formdata,
     *						'booking_hash'       : my_booking_hash,
     *						'custom_form'        : my_booking_form,
     *
     *						'captcha_chalange'   : captcha_chalange,
     *						'user_captcha'       : user_captcha,
     *
     *						'is_emails_send'     : is_send_emeils,
     *						'active_locale'      : wpdev_active_locale
     *				}
     */
  },
  /**
   * S u c c e s s
   *
   * @param response_data		-	its object returned from  Ajax - class-live-searcg.php
   * @param textStatus		-	'success'
   * @param jqXHR				-	Object
   */
  function (response_data, textStatus, jqXHR) {
    console.log(' == Response WPBC_AJX_BOOKING__CREATE == ');
    for (var obj_key in response_data) {
      console.groupCollapsed('==' + obj_key + '==');
      console.log(' : ' + obj_key + ' : ', response_data[obj_key]);
      console.groupEnd();
    }
    console.groupEnd();

    // <editor-fold     defaultstate="collapsed"     desc=" = Error Message! Server response with String.  ->  E_X_I_T  "  >
    // -------------------------------------------------------------------------------------------------
    // This section execute,  when server response with  String instead of Object -- Usually  it's because of mistake in code !
    // -------------------------------------------------------------------------------------------------
    if (_typeof(response_data) !== 'object' || response_data === null) {
      var calendar_id = wpbc_get_resource_id__from_ajx_post_data_url(this.data);
      var jq_node = '#booking_form' + calendar_id;
      if ('' == response_data) {
        response_data = '<strong>' + 'Error! Server respond with empty string!' + '</strong> ';
      }
      // Show Message
      wpbc_front_end__show_message(response_data, {
        'type': 'error',
        'show_here': {
          'jq_node': jq_node,
          'where': 'after'
        },
        'is_append': true,
        'style': 'text-align:left;',
        'delay': 0
      });
      // Enable Submit | Hide spin loader
      wpbc_booking_form__on_response__ui_elements_enable(calendar_id);
      return;
    }
    // </editor-fold>

    // <editor-fold     defaultstate="collapsed"     desc="  ==  This section execute,  when we have KNOWN errors from Booking Calendar.  ->  E_X_I_T  "  >
    // -------------------------------------------------------------------------------------------------
    // This section execute,  when we have KNOWN errors from Booking Calendar
    // -------------------------------------------------------------------------------------------------

    if ('ok' != response_data['ajx_data']['status']) {
      switch (response_data['ajx_data']['status_error']) {
        case 'captcha_simple_wrong':
          wpbc_captcha__simple__update({
            'resource_id': response_data['resource_id'],
            'url': response_data['ajx_data']['captcha__simple']['url'],
            'challenge': response_data['ajx_data']['captcha__simple']['challenge'],
            'message': response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />")
          });
          break;
        case 'resource_id_incorrect':
          // Show Error Message - incorrect  booking resource ID during submit of booking.
          var message_id = wpbc_front_end__show_message(response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />"), {
            'type': 'undefined' !== typeof response_data['ajx_data']['ajx_after_action_message_status'] ? response_data['ajx_data']['ajx_after_action_message_status'] : 'warning',
            'delay': 0,
            'show_here': {
              'where': 'after',
              'jq_node': '#booking_form' + params['resource_id']
            }
          });
          break;
        case 'booking_can_not_save':
          // We can not save booking, because dates are booked or can not save in same booking resource all the dates
          var message_id = wpbc_front_end__show_message(response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />"), {
            'type': 'undefined' !== typeof response_data['ajx_data']['ajx_after_action_message_status'] ? response_data['ajx_data']['ajx_after_action_message_status'] : 'warning',
            'delay': 0,
            'show_here': {
              'where': 'after',
              'jq_node': '#booking_form' + params['resource_id']
            }
          });

          // Enable Submit | Hide spin loader
          wpbc_booking_form__on_response__ui_elements_enable(response_data['resource_id']);
          break;
        default:
          // <editor-fold     defaultstate="collapsed"                        desc=" = For debug only ? --  Show Message under the form = "  >
          // --------------------------------------------------------------------------------------------------------------------------------
          if ('undefined' !== typeof response_data['ajx_data']['ajx_after_action_message'] && '' != response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />")) {
            var calendar_id = wpbc_get_resource_id__from_ajx_post_data_url(this.data);
            var jq_node = '#booking_form' + calendar_id;
            var ajx_after_booking_message = response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />");
            console.log(ajx_after_booking_message);

            /**
             * // Show Message
            	var ajx_after_action_message_id = wpbc_front_end__show_message( ajx_after_booking_message,
            								{
            									'type' : ('undefined' !== typeof (response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ]))
            											? response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ] : 'info',
            									'delay'    : 10000,
            									'show_here': {
            													'jq_node': jq_node,
            													'where'  : 'after'
            												 }
            								} );
             */
          }
        // </editor-fold>
      }

      // -------------------------------------------------------------------------------------------------
      // Reactivate calendar again ?
      // -------------------------------------------------------------------------------------------------
      // Enable Submit | Hide spin loader
      wpbc_booking_form__on_response__ui_elements_enable(response_data['resource_id']);

      // Unselect  dates
      wpbc_calendar__unselect_all_dates(response_data['resource_id']);

      // 'resource_id'    => $params['resource_id'],
      // 'booking_hash'   => $booking_hash,
      // 'request_uri'    => $_SERVER['REQUEST_URI'],                                            // Is it the same as window.location.href or
      // 'custom_form'    => $params['custom_form'],                                             // Optional.
      // 'aggregate_resource_id_str' => implode( ',', $params['aggregate_resource_id_arr'] )     // Optional. Resource ID   from  aggregate parameter in shortcode.

      // Load new data in calendar.
      wpbc_calendar__load_data__ajx({
        'resource_id': response_data['resource_id'] // It's from response ...AJX_BOOKING__CREATE of initial sent resource_id
        ,
        'booking_hash': response_data['ajx_cleaned_params']['booking_hash'] // ?? we can not use it,  because HASH chnaged in any  case!
        ,
        'request_uri': response_data['ajx_cleaned_params']['request_uri'],
        'custom_form': response_data['ajx_cleaned_params']['custom_form']
        // Aggregate booking resources,  if any ?
        ,
        'aggregate_resource_id_str': _wpbc.booking__get_param_value(response_data['resource_id'], 'aggregate_resource_id_arr').join(',')
      });
      // Exit
      return;
    }

    // </editor-fold>

    /*
    	// Show Calendar
    	wpbc_calendar__loading__stop( response_data[ 'resource_id' ] );
    
    	// -------------------------------------------------------------------------------------------------
    	// Bookings - Dates
    	_wpbc.bookings_in_calendar__set_dates(  response_data[ 'resource_id' ], response_data[ 'ajx_data' ]['dates']  );
    
    	// Bookings - Child or only single booking resource in dates
    	_wpbc.booking__set_param_value( response_data[ 'resource_id' ], 'resources_id_arr__in_dates', response_data[ 'ajx_data' ][ 'resources_id_arr__in_dates' ] );
    	// -------------------------------------------------------------------------------------------------
    
    	// Update calendar
    	wpbc_calendar__update_look( response_data[ 'resource_id' ] );
    */

    // Hide spin loader
    wpbc_booking_form__spin_loader__hide(response_data['resource_id']);

    // Hide booking form
    wpbc_booking_form__animated__hide(response_data['resource_id']);

    // Show Confirmation | Payment section
    wpbc_show_thank_you_message_after_booking(response_data);
    setTimeout(function () {
      wpbc_do_scroll('#wpbc_scroll_point_' + response_data['resource_id'], 10);
    }, 500);
  }).fail(
  // <editor-fold     defaultstate="collapsed"                        desc=" = This section execute,  when  NONCE field was not passed or some error happened at  server! = "  >
  function (jqXHR, textStatus, errorThrown) {
    if (window.console && window.console.log) {
      console.log('Ajax_Error', jqXHR, textStatus, errorThrown);
    }

    // -------------------------------------------------------------------------------------------------
    // This section execute,  when  NONCE field was not passed or some error happened at  server!
    // -------------------------------------------------------------------------------------------------

    // Get Content of Error Message
    var error_message = '<strong>' + 'Error!' + '</strong> ' + errorThrown;
    if (jqXHR.status) {
      error_message += ' (<b>' + jqXHR.status + '</b>)';
      if (403 == jqXHR.status) {
        error_message += '<br> Probably nonce for this page has been expired. Please <a href="javascript:void(0)" onclick="javascript:location.reload();">reload the page</a>.';
        error_message += '<br> Otherwise, please check this <a style="font-weight: 600;" href="https://wpbookingcalendar.com/faq/request-do-not-pass-security-check/?after_update=10.1.1">troubleshooting instruction</a>.<br>';
      }
    }
    if (jqXHR.responseText) {
      // Escape tags in Error message
      error_message += '<br><strong>Response</strong><div style="padding: 0 10px;margin: 0 0 10px;border-radius:3px; box-shadow:0px 0px 1px #a3a3a3;">' + jqXHR.responseText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") + '</div>';
    }
    error_message = error_message.replace(/\n/g, "<br />");
    var calendar_id = wpbc_get_resource_id__from_ajx_post_data_url(this.data);
    var jq_node = '#booking_form' + calendar_id;

    // Show Message
    wpbc_front_end__show_message(error_message, {
      'type': 'error',
      'show_here': {
        'jq_node': jq_node,
        'where': 'after'
      },
      'is_append': true,
      'style': 'text-align:left;',
      'delay': 0
    });
    // Enable Submit | Hide spin loader
    wpbc_booking_form__on_response__ui_elements_enable(calendar_id);
  }
  // </editor-fold>
  )
  // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
  ; // End Ajax

  return true;
}

// <editor-fold     defaultstate="collapsed"                        desc="  ==  CAPTCHA ==  "  >

/**
 * Update image in captcha and show warning message
 *
 * @param params
 *
 * Example of 'params' : {
 *							'resource_id': response_data[ 'resource_id' ],
 *							'url'        : response_data[ 'ajx_data' ][ 'captcha__simple' ][ 'url' ],
 *							'challenge'  : response_data[ 'ajx_data' ][ 'captcha__simple' ][ 'challenge' ],
 *							'message'    : response_data[ 'ajx_data' ][ 'ajx_after_action_message' ].replace( /\n/g, "<br />" )
 *						}
 */
function wpbc_captcha__simple__update(params) {
  document.getElementById('captcha_input' + params['resource_id']).value = '';
  document.getElementById('captcha_img' + params['resource_id']).src = params['url'];
  document.getElementById('wpdev_captcha_challenge_' + params['resource_id']).value = params['challenge'];

  // Show warning 		After CAPTCHA Img
  var message_id = wpbc_front_end__show_message__warning('#captcha_input' + params['resource_id'] + ' + img', params['message']);

  // Animate
  jQuery('#' + message_id + ', ' + '#captcha_input' + params['resource_id']).fadeOut(350).fadeIn(300).fadeOut(350).fadeIn(400).animate({
    opacity: 1
  }, 4000);
  // Focus text  field
  jQuery('#captcha_input' + params['resource_id']).trigger('focus'); // FixIn: 8.7.11.12.

  // Enable Submit | Hide spin loader
  wpbc_booking_form__on_response__ui_elements_enable(params['resource_id']);
}

/**
 * If the captcha elements not exist  in the booking form,  then  remove parameters relative captcha
 * @param params
 * @returns obj
 */
function wpbc_captcha__simple__maybe_remove_in_ajx_params(params) {
  if (!wpbc_captcha__simple__is_exist_in_form(params['resource_id'])) {
    delete params['captcha_chalange'];
    delete params['captcha_user_input'];
  }
  return params;
}

/**
 * Check if CAPTCHA exist in the booking form
 * @param resource_id
 * @returns {boolean}
 */
function wpbc_captcha__simple__is_exist_in_form(resource_id) {
  return 0 !== jQuery('#wpdev_captcha_challenge_' + resource_id).length || 0 !== jQuery('#captcha_input' + resource_id).length;
}

// </editor-fold>

// <editor-fold     defaultstate="collapsed"                        desc="  ==  Send Button | Form Spin Loader  ==  "  >

/**
 * Disable Send button  |  Show Spin Loader
 *
 * @param resource_id
 */
function wpbc_booking_form__on_submit__ui_elements_disable(resource_id) {
  // Disable Submit
  wpbc_booking_form__send_button__disable(resource_id);

  // Show Spin loader in booking form
  wpbc_booking_form__spin_loader__show(resource_id);
}

/**
 * Enable Send button  |   Hide Spin Loader
 *
 * @param resource_id
 */
function wpbc_booking_form__on_response__ui_elements_enable(resource_id) {
  // Enable Submit
  wpbc_booking_form__send_button__enable(resource_id);

  // Hide Spin loader in booking form
  wpbc_booking_form__spin_loader__hide(resource_id);
}

/**
 * Enable Submit button
 * @param resource_id
 */
function wpbc_booking_form__send_button__enable(resource_id) {
  // Activate Send button
  jQuery('#booking_form_div' + resource_id + ' input[type=button]').prop("disabled", false);
  jQuery('#booking_form_div' + resource_id + ' button').prop("disabled", false);
}

/**
 * Disable Submit button  and show  spin
 *
 * @param resource_id
 */
function wpbc_booking_form__send_button__disable(resource_id) {
  // Disable Send button
  jQuery('#booking_form_div' + resource_id + ' input[type=button]').prop("disabled", true);
  jQuery('#booking_form_div' + resource_id + ' button').prop("disabled", true);
}

/**
 * Disable 'This' button
 *
 * @param _this
 */
function wpbc_booking_form__this_button__disable(_this) {
  // Disable Send button
  jQuery(_this).prop("disabled", true);
}

/**
 * Show booking form  Spin Loader
 * @param resource_id
 */
function wpbc_booking_form__spin_loader__show(resource_id) {
  // Show Spin Loader
  jQuery('#booking_form' + resource_id).after('<div id="wpbc_booking_form_spin_loader' + resource_id + '" class="wpbc_booking_form_spin_loader" style="position: relative;"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_spins_loader_mini"></div></div></div>');
}

/**
 * Remove / Hide booking form  Spin Loader
 * @param resource_id
 */
function wpbc_booking_form__spin_loader__hide(resource_id) {
  // Remove Spin Loader
  jQuery('#wpbc_booking_form_spin_loader' + resource_id).remove();
}

/**
 * Hide booking form wth animation
 *
 * @param resource_id
 */
function wpbc_booking_form__animated__hide(resource_id) {
  // jQuery( '#booking_form' + resource_id ).slideUp(  1000
  // 												, function (){
  //
  // 														// if ( document.getElementById( 'gateway_payment_forms' + response_data[ 'resource_id' ] ) != null ){
  // 														// 	wpbc_do_scroll( '#submiting' + resource_id );
  // 														// } else
  // 														if ( jQuery( '#booking_form' + resource_id ).parent().find( '.submiting_content' ).length > 0 ){
  // 															//wpbc_do_scroll( '#booking_form' + resource_id + ' + .submiting_content' );
  //
  // 															 var hideTimeout = setTimeout(function () {
  // 																				  wpbc_do_scroll( jQuery( '#booking_form' + resource_id ).parent().find( '.submiting_content' ).get( 0 ) );
  // 																				}, 100);
  //
  // 														}
  // 												  }
  // 										);

  jQuery('#booking_form' + resource_id).hide();

  // var hideTimeout = setTimeout( function (){
  //
  // 	if ( jQuery( '#booking_form' + resource_id ).parent().find( '.submiting_content' ).length > 0 ){
  // 		var random_id = Math.floor( (Math.random() * 10000) + 1 );
  // 		jQuery( '#booking_form' + resource_id ).parent().before( '<div id="scroll_to' + random_id + '"></div>' );
  // 		console.log( jQuery( '#scroll_to' + random_id ) );
  //
  // 		wpbc_do_scroll( '#scroll_to' + random_id );
  // 		//wpbc_do_scroll( jQuery( '#booking_form' + resource_id ).parent().get( 0 ) );
  // 	}
  // }, 500 );
}
// </editor-fold>

// <editor-fold     defaultstate="collapsed"                        desc="  ==  Mini Spin Loader  ==  "  >

/**
 *
 * @param parent_html_id
 */

/**
 * Show micro Spin Loader
 *
 * @param id						ID of Loader,  for later  hide it by  using 		wpbc__spin_loader__micro__hide( id ) OR wpbc__spin_loader__mini__hide( id )
 * @param jq_node_where_insert		such as '#estimate_booking_night_cost_hint10'   OR  '.estimate_booking_night_cost_hint10'
 */
function wpbc__spin_loader__micro__show__inside(id, jq_node_where_insert) {
  wpbc__spin_loader__mini__show(id, {
    'color': '#444',
    'show_here': {
      'where': 'inside',
      'jq_node': jq_node_where_insert
    },
    'style': 'position: relative;display: inline-flex;flex-flow: column nowrap;justify-content: center;align-items: center;margin: 7px 12px;',
    'class': 'wpbc_one_spin_loader_micro'
  });
}

/**
 * Remove spinner
 * @param id
 */
function wpbc__spin_loader__micro__hide(id) {
  wpbc__spin_loader__mini__hide(id);
}

/**
 * Show mini Spin Loader
 * @param parent_html_id
 */
function wpbc__spin_loader__mini__show(parent_html_id) {
  var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var params_default = {
    'color': '#0071ce',
    'show_here': {
      'jq_node': '',
      // any jQuery node definition
      'where': 'after' // 'inside' | 'before' | 'after' | 'right' | 'left'
    },
    'style': 'position: relative;min-height: 2.8rem;',
    'class': 'wpbc_one_spin_loader_mini 0wpbc_spins_loader_mini'
  };
  for (var p_key in params) {
    params_default[p_key] = params[p_key];
  }
  params = params_default;
  if ('undefined' !== typeof params['color'] && '' != params['color']) {
    params['color'] = 'border-color:' + params['color'] + ';';
  }
  var spinner_html = '<div id="wpbc_mini_spin_loader' + parent_html_id + '" class="wpbc_booking_form_spin_loader" style="' + params['style'] + '"><div class="wpbc_spins_loader_wrapper"><div class="' + params['class'] + '" style="' + params['color'] + '"></div></div></div>';
  if ('' == params['show_here']['jq_node']) {
    params['show_here']['jq_node'] = '#' + parent_html_id;
  }

  // Show Spin Loader
  if ('after' == params['show_here']['where']) {
    jQuery(params['show_here']['jq_node']).after(spinner_html);
  } else {
    jQuery(params['show_here']['jq_node']).html(spinner_html);
  }
}

/**
 * Remove / Hide mini Spin Loader
 * @param parent_html_id
 */
function wpbc__spin_loader__mini__hide(parent_html_id) {
  // Remove Spin Loader
  jQuery('#wpbc_mini_spin_loader' + parent_html_id).remove();
}

// </editor-fold>

//TODO: what  about showing only  Thank you. message without payment forms.
/**
 * Show 'Thank you'. message and payment forms
 *
 * @param response_data
 */
function wpbc_show_thank_you_message_after_booking(response_data) {
  if ('undefined' !== typeof response_data['ajx_confirmation']['ty_is_redirect'] && 'undefined' !== typeof response_data['ajx_confirmation']['ty_url'] && 'page' == response_data['ajx_confirmation']['ty_is_redirect'] && '' != response_data['ajx_confirmation']['ty_url']) {
    jQuery('body').trigger('wpbc_booking_created', [response_data['resource_id'], response_data]); // FixIn: 10.0.0.30.
    window.location.href = response_data['ajx_confirmation']['ty_url'];
    return;
  }
  var resource_id = response_data['resource_id'];
  var confirm_content = '';
  if ('undefined' === typeof response_data['ajx_confirmation']['ty_message']) {
    response_data['ajx_confirmation']['ty_message'] = '';
  }
  if ('undefined' === typeof response_data['ajx_confirmation']['ty_payment_payment_description']) {
    response_data['ajx_confirmation']['ty_payment_payment_description'] = '';
  }
  if ('undefined' === typeof response_data['ajx_confirmation']['payment_cost']) {
    response_data['ajx_confirmation']['payment_cost'] = '';
  }
  if ('undefined' === typeof response_data['ajx_confirmation']['ty_payment_gateways']) {
    response_data['ajx_confirmation']['ty_payment_gateways'] = '';
  }
  var ty_message_hide = '' == response_data['ajx_confirmation']['ty_message'] ? 'wpbc_ty_hide' : '';
  var ty_payment_payment_description_hide = '' == response_data['ajx_confirmation']['ty_payment_payment_description'].replace(/\\n/g, '') ? 'wpbc_ty_hide' : '';
  var ty_booking_costs_hide = '' == response_data['ajx_confirmation']['payment_cost'] ? 'wpbc_ty_hide' : '';
  var ty_payment_gateways_hide = '' == response_data['ajx_confirmation']['ty_payment_gateways'].replace(/\\n/g, '') ? 'wpbc_ty_hide' : '';
  if ('wpbc_ty_hide' != ty_payment_gateways_hide) {
    jQuery('.wpbc_ty__content_text.wpbc_ty__content_gateways').html(''); // Reset  all  other possible gateways before showing new one.
  }
  confirm_content += "<div id=\"wpbc_scroll_point_".concat(resource_id, "\"></div>");
  confirm_content += "  <div class=\"wpbc_after_booking_thank_you_section\">";
  confirm_content += "    <div class=\"wpbc_ty__message ".concat(ty_message_hide, "\">").concat(response_data['ajx_confirmation']['ty_message'], "</div>");
  confirm_content += "    <div class=\"wpbc_ty__container\">";
  if ('' !== response_data['ajx_confirmation']['ty_message_booking_id']) {
    confirm_content += "      <div class=\"wpbc_ty__header\">".concat(response_data['ajx_confirmation']['ty_message_booking_id'], "</div>");
  }
  confirm_content += "      <div class=\"wpbc_ty__content\">";
  confirm_content += "        <div class=\"wpbc_ty__content_text wpbc_ty__payment_description ".concat(ty_payment_payment_description_hide, "\">").concat(response_data['ajx_confirmation']['ty_payment_payment_description'].replace(/\\n/g, ''), "</div>");
  if ('' !== response_data['ajx_confirmation']['ty_customer_details']) {
    confirm_content += "      \t<div class=\"wpbc_ty__content_text wpbc_cols_2\">".concat(response_data['ajx_confirmation']['ty_customer_details'], "</div>");
  }
  if ('' !== response_data['ajx_confirmation']['ty_booking_details']) {
    confirm_content += "      \t<div class=\"wpbc_ty__content_text wpbc_cols_2\">".concat(response_data['ajx_confirmation']['ty_booking_details'], "</div>");
  }
  confirm_content += "        <div class=\"wpbc_ty__content_text wpbc_ty__content_costs ".concat(ty_booking_costs_hide, "\">").concat(response_data['ajx_confirmation']['ty_booking_costs'], "</div>");
  confirm_content += "        <div class=\"wpbc_ty__content_text wpbc_ty__content_gateways ".concat(ty_payment_gateways_hide, "\">").concat(response_data['ajx_confirmation']['ty_payment_gateways'].replace(/\\n/g, '').replace(/ajax_script/gi, 'script'), "</div>");
  confirm_content += "      </div>";
  confirm_content += "    </div>";
  confirm_content += "</div>";
  jQuery('#booking_form' + resource_id).after(confirm_content);

  //FixIn: 10.0.0.30		// event name			// Resource ID	-	'1'
  jQuery('body').trigger('wpbc_booking_created', [resource_id, response_data]);
  // To catch this event: jQuery( 'body' ).on('wpbc_booking_created', function( event, resource_id, params ) { console.log( event, resource_id, params ); } );
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX2NhcGFjaXR5L19vdXQvY3JlYXRlX2Jvb2tpbmcuanMiLCJuYW1lcyI6WyJfdHlwZW9mIiwib2JqIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJjb25zdHJ1Y3RvciIsInByb3RvdHlwZSIsIndwYmNfYWp4X2Jvb2tpbmdfX2NyZWF0ZSIsInBhcmFtcyIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsImdyb3VwRW5kIiwid3BiY19jYXB0Y2hhX19zaW1wbGVfX21heWJlX3JlbW92ZV9pbl9hanhfcGFyYW1zIiwialF1ZXJ5IiwidHJpZ2dlciIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwid3BiY19hanhfdXNlcl9pZCIsIl93cGJjIiwiZ2V0X3NlY3VyZV9wYXJhbSIsIm5vbmNlIiwid3BiY19hanhfbG9jYWxlIiwiY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMiLCJyZXNwb25zZV9kYXRhIiwidGV4dFN0YXR1cyIsImpxWEhSIiwib2JqX2tleSIsImNhbGVuZGFyX2lkIiwid3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwiLCJkYXRhIiwianFfbm9kZSIsIndwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSIsIndwYmNfY2FwdGNoYV9fc2ltcGxlX191cGRhdGUiLCJyZXBsYWNlIiwibWVzc2FnZV9pZCIsImFqeF9hZnRlcl9ib29raW5nX21lc3NhZ2UiLCJ3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMiLCJ3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCIsImJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSIsImpvaW4iLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX2hpZGUiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fYW5pbWF0ZWRfX2hpZGUiLCJ3cGJjX3Nob3dfdGhhbmtfeW91X21lc3NhZ2VfYWZ0ZXJfYm9va2luZyIsInNldFRpbWVvdXQiLCJ3cGJjX2RvX3Njcm9sbCIsImZhaWwiLCJlcnJvclRocm93biIsIndpbmRvdyIsImVycm9yX21lc3NhZ2UiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwidmFsdWUiLCJzcmMiLCJ3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nIiwiZmFkZU91dCIsImZhZGVJbiIsImFuaW1hdGUiLCJvcGFjaXR5Iiwid3BiY19jYXB0Y2hhX19zaW1wbGVfX2lzX2V4aXN0X2luX2Zvcm0iLCJyZXNvdXJjZV9pZCIsImxlbmd0aCIsIndwYmNfYm9va2luZ19mb3JtX19vbl9zdWJtaXRfX3VpX2VsZW1lbnRzX2Rpc2FibGUiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2Rpc2FibGUiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3ciLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2VuYWJsZSIsInByb3AiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fdGhpc19idXR0b25fX2Rpc2FibGUiLCJfdGhpcyIsImFmdGVyIiwicmVtb3ZlIiwiaGlkZSIsIndwYmNfX3NwaW5fbG9hZGVyX19taWNyb19fc2hvd19faW5zaWRlIiwiaWQiLCJqcV9ub2RlX3doZXJlX2luc2VydCIsIndwYmNfX3NwaW5fbG9hZGVyX19taW5pX19zaG93Iiwid3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19oaWRlIiwid3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUiLCJwYXJlbnRfaHRtbF9pZCIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsInBhcmFtc19kZWZhdWx0IiwicF9rZXkiLCJzcGlubmVyX2h0bWwiLCJodG1sIiwibG9jYXRpb24iLCJocmVmIiwiY29uZmlybV9jb250ZW50IiwidHlfbWVzc2FnZV9oaWRlIiwidHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uX2hpZGUiLCJ0eV9ib29raW5nX2Nvc3RzX2hpZGUiLCJ0eV9wYXltZW50X2dhdGV3YXlzX2hpZGUiLCJjb25jYXQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9fY2FwYWNpdHkvX3NyYy9jcmVhdGVfYm9va2luZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSAgQSBqIGEgeCAgICBBIGQgZCAgICBOIGUgdyAgICBCIG8gbyBrIGkgbiBnICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG4vKipcclxuICogU3VibWl0IG5ldyBib29raW5nXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXMgICA9ICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3Jlc291cmNlX2lkJyAgICAgICAgOiByZXNvdXJjZV9pZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZGF0ZXNfZGRtbXl5X2NzdicgICA6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Zvcm1kYXRhJyAgICAgICAgICAgOiBmb3JtZGF0YSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYm9va2luZ19oYXNoJyAgICAgICA6IG15X2Jvb2tpbmdfaGFzaCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY3VzdG9tX2Zvcm0nICAgICAgICA6IG15X2Jvb2tpbmdfZm9ybSxcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NhcHRjaGFfY2hhbGFuZ2UnICAgOiBjYXB0Y2hhX2NoYWxhbmdlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjYXB0Y2hhX3VzZXJfaW5wdXQnIDogdXNlcl9jYXB0Y2hhLFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnaXNfZW1haWxzX3NlbmQnICAgICA6IGlzX3NlbmRfZW1laWxzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhY3RpdmVfbG9jYWxlJyAgICAgIDogd3BkZXZfYWN0aXZlX2xvY2FsZVxyXG5cdFx0XHRcdFx0XHR9XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19jcmVhdGUoIHBhcmFtcyApe1xyXG5cclxuXHRjb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfQk9PS0lOR19fQ1JFQVRFJyApO1xyXG5cdGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICc9PSBCZWZvcmUgQWpheCBTZW5kID09JyApO1xyXG5cdGNvbnNvbGUubG9nKCBwYXJhbXMgKTtcclxuXHRjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdHBhcmFtcyA9IHdwYmNfY2FwdGNoYV9fc2ltcGxlX19tYXliZV9yZW1vdmVfaW5fYWp4X3BhcmFtcyggcGFyYW1zICk7XHJcblxyXG5cdC8vIFRyaWdnZXIgaG9vayAgYmVmb3JlIHNlbmRpbmcgcmVxdWVzdCAgdG8gIGNyZWF0ZSB0aGUgYm9va2luZy5cclxuXHRqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2JlZm9yZV9ib29raW5nX2NyZWF0ZScsIFsgcGFyYW1zWydyZXNvdXJjZV9pZCddLCBwYXJhbXMgXSApO1xyXG5cclxuXHQvLyBTdGFydCBBamF4LlxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0e1xyXG5cdFx0XHRhY3Rpb24gICAgICAgICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfX0NSRUFURScsXHJcblx0XHRcdHdwYmNfYWp4X3VzZXJfaWQgICAgICAgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAndXNlcl9pZCcgKSxcclxuXHRcdFx0bm9uY2UgICAgICAgICAgICAgICAgICA6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0d3BiY19hanhfbG9jYWxlICAgICAgICA6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICksXHJcblx0XHRcdGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zOiBwYXJhbXMsXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiAgVXN1YWxseSAgcGFyYW1zID0geyAncmVzb3VyY2VfaWQnICAgICAgICA6IHJlc291cmNlX2lkLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdkYXRlc19kZG1teXlfY3N2JyAgIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWx1ZSxcclxuXHRcdFx0ICpcdFx0XHRcdFx0XHQnZm9ybWRhdGEnICAgICAgICAgICA6IGZvcm1kYXRhLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdib29raW5nX2hhc2gnICAgICAgIDogbXlfYm9va2luZ19oYXNoLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdjdXN0b21fZm9ybScgICAgICAgIDogbXlfYm9va2luZ19mb3JtLFxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdjYXB0Y2hhX2NoYWxhbmdlJyAgIDogY2FwdGNoYV9jaGFsYW5nZSxcclxuXHRcdFx0ICpcdFx0XHRcdFx0XHQndXNlcl9jYXB0Y2hhJyAgICAgICA6IHVzZXJfY2FwdGNoYSxcclxuXHRcdFx0ICpcclxuXHRcdFx0ICpcdFx0XHRcdFx0XHQnaXNfZW1haWxzX3NlbmQnICAgICA6IGlzX3NlbmRfZW1laWxzLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdhY3RpdmVfbG9jYWxlJyAgICAgIDogd3BkZXZfYWN0aXZlX2xvY2FsZVxyXG5cdFx0XHQgKlx0XHRcdFx0fVxyXG5cdFx0XHQgKi9cclxuXHRcdH0sXHJcblxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuY29uc29sZS5sb2coICcgPT0gUmVzcG9uc2UgV1BCQ19BSlhfQk9PS0lOR19fQ1JFQVRFID09ICcgKTtcclxuZm9yICggdmFyIG9ial9rZXkgaW4gcmVzcG9uc2VfZGF0YSApe1xyXG5cdGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICc9PScgKyBvYmpfa2V5ICsgJz09JyApO1xyXG5cdGNvbnNvbGUubG9nKCAnIDogJyArIG9ial9rZXkgKyAnIDogJywgcmVzcG9uc2VfZGF0YVsgb2JqX2tleSBdICk7XHJcblx0Y29uc29sZS5ncm91cEVuZCgpO1xyXG59XHJcbmNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblxyXG5cdFx0XHRcdFx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgZGVzYz1cIiA9IEVycm9yIE1lc3NhZ2UhIFNlcnZlciByZXNwb25zZSB3aXRoIFN0cmluZy4gIC0+ICBFX1hfSV9UICBcIiAgPlxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0Ly8gVGhpcyBzZWN0aW9uIGV4ZWN1dGUsICB3aGVuIHNlcnZlciByZXNwb25zZSB3aXRoICBTdHJpbmcgaW5zdGVhZCBvZiBPYmplY3QgLS0gVXN1YWxseSAgaXQncyBiZWNhdXNlIG9mIG1pc3Rha2UgaW4gY29kZSAhXHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHRpZiAoICh0eXBlb2YgcmVzcG9uc2VfZGF0YSAhPT0gJ29iamVjdCcpIHx8IChyZXNwb25zZV9kYXRhID09PSBudWxsKSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGNhbGVuZGFyX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0XHR2YXIganFfbm9kZSA9ICcjYm9va2luZ19mb3JtJyArIGNhbGVuZGFyX2lkO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAnJyA9PSByZXNwb25zZV9kYXRhICl7XHJcblx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhIFNlcnZlciByZXNwb25kIHdpdGggZW1wdHkgc3RyaW5nIScgKyAnPC9zdHJvbmc+ICcgO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhICwgeyAndHlwZScgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0Ly8gRW5hYmxlIFN1Ym1pdCB8IEhpZGUgc3BpbiBsb2FkZXJcclxuXHRcdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIGNhbGVuZGFyX2lkICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdC8vIDwvZWRpdG9yLWZvbGQ+XHJcblxyXG5cclxuXHRcdFx0XHRcdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgIGRlc2M9XCIgID09ICBUaGlzIHNlY3Rpb24gZXhlY3V0ZSwgIHdoZW4gd2UgaGF2ZSBLTk9XTiBlcnJvcnMgZnJvbSBCb29raW5nIENhbGVuZGFyLiAgLT4gIEVfWF9JX1QgIFwiICA+XHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHQvLyBUaGlzIHNlY3Rpb24gZXhlY3V0ZSwgIHdoZW4gd2UgaGF2ZSBLTk9XTiBlcnJvcnMgZnJvbSBCb29raW5nIENhbGVuZGFyXHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0XHRcdFx0aWYgKCAnb2snICE9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3N0YXR1cycgXSApIHtcclxuXHJcblx0XHRcdFx0XHRcdHN3aXRjaCAoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3N0YXR1c19lcnJvcicgXSApe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjYXNlICdjYXB0Y2hhX3NpbXBsZV93cm9uZyc6XHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2NhcHRjaGFfX3NpbXBsZV9fdXBkYXRlKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX2lkJzogcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1cmwnICAgICAgICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2NhcHRjaGFfX3NpbXBsZScgXVsgJ3VybCcgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY2hhbGxlbmdlJyAgOiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdjYXB0Y2hhX19zaW1wbGUnIF1bICdjaGFsbGVuZ2UnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J21lc3NhZ2UnICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHRcdFx0Y2FzZSAncmVzb3VyY2VfaWRfaW5jb3JyZWN0JzpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFNob3cgRXJyb3IgTWVzc2FnZSAtIGluY29ycmVjdCAgYm9va2luZyByZXNvdXJjZSBJRCBkdXJpbmcgc3VibWl0IG9mIGJvb2tpbmcuXHJcblx0XHRcdFx0XHRcdFx0XHR2YXIgbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgOiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSkpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeyAnd2hlcmUnOiAnYWZ0ZXInLCAnanFfbm9kZSc6ICcjYm9va2luZ19mb3JtJyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0XHRcdFx0Y2FzZSAnYm9va2luZ19jYW5fbm90X3NhdmUnOlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gV2UgY2FuIG5vdCBzYXZlIGJvb2tpbmcsIGJlY2F1c2UgZGF0ZXMgYXJlIGJvb2tlZCBvciBjYW4gbm90IHNhdmUgaW4gc2FtZSBib29raW5nIHJlc291cmNlIGFsbCB0aGUgZGF0ZXNcclxuXHRcdFx0XHRcdFx0XHRcdHZhciBtZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyA6ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdKSlcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7ICd3aGVyZSc6ICdhZnRlcicsICdqcV9ub2RlJzogJyNib29raW5nX2Zvcm0nICsgcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHJcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDpcclxuXHJcblx0XHRcdFx0XHRcdFx0XHQvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICAgICAgICAgICAgICAgICAgICAgZGVzYz1cIiA9IEZvciBkZWJ1ZyBvbmx5ID8gLS0gIFNob3cgTWVzc2FnZSB1bmRlciB0aGUgZm9ybSA9IFwiICA+XHJcblx0XHRcdFx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdKSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdCAmJiAoICcnICE9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSApXHJcblx0XHRcdFx0XHRcdFx0XHQpe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGNhbGVuZGFyX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIganFfbm9kZSA9ICcjYm9va2luZ19mb3JtJyArIGNhbGVuZGFyX2lkO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGFqeF9hZnRlcl9ib29raW5nX21lc3NhZ2UgPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZyggYWp4X2FmdGVyX2Jvb2tpbmdfbWVzc2FnZSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0LyoqXHJcblx0XHRcdFx0XHRcdFx0XHRcdCAqIC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHZhciBhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBhanhfYWZ0ZXJfYm9va2luZ19tZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgOiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSkpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnaW5mbycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYWZ0ZXInXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCAqL1xyXG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdFx0Ly8gUmVhY3RpdmF0ZSBjYWxlbmRhciBhZ2FpbiA/XHJcblx0XHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdFx0Ly8gRW5hYmxlIFN1Ym1pdCB8IEhpZGUgc3BpbiBsb2FkZXJcclxuXHRcdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gVW5zZWxlY3QgIGRhdGVzXHJcblx0XHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyAncmVzb3VyY2VfaWQnICAgID0+ICRwYXJhbXNbJ3Jlc291cmNlX2lkJ10sXHJcblx0XHRcdFx0XHRcdC8vICdib29raW5nX2hhc2gnICAgPT4gJGJvb2tpbmdfaGFzaCxcclxuXHRcdFx0XHRcdFx0Ly8gJ3JlcXVlc3RfdXJpJyAgICA9PiAkX1NFUlZFUlsnUkVRVUVTVF9VUkknXSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElzIGl0IHRoZSBzYW1lIGFzIHdpbmRvdy5sb2NhdGlvbi5ocmVmIG9yXHJcblx0XHRcdFx0XHRcdC8vICdjdXN0b21fZm9ybScgICAgPT4gJHBhcmFtc1snY3VzdG9tX2Zvcm0nXSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPcHRpb25hbC5cclxuXHRcdFx0XHRcdFx0Ly8gJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHInID0+IGltcGxvZGUoICcsJywgJHBhcmFtc1snYWdncmVnYXRlX3Jlc291cmNlX2lkX2FyciddICkgICAgIC8vIE9wdGlvbmFsLiBSZXNvdXJjZSBJRCAgIGZyb20gIGFnZ3JlZ2F0ZSBwYXJhbWV0ZXIgaW4gc2hvcnRjb2RlLlxyXG5cclxuXHRcdFx0XHRcdFx0Ly8gTG9hZCBuZXcgZGF0YSBpbiBjYWxlbmRhci5cclxuXHRcdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3Jlc291cmNlX2lkJyA6IHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXVx0XHRcdFx0XHRcdFx0Ly8gSXQncyBmcm9tIHJlc3BvbnNlIC4uLkFKWF9CT09LSU5HX19DUkVBVEUgb2YgaW5pdGlhbCBzZW50IHJlc291cmNlX2lkXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2hhc2gnOiByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWydib29raW5nX2hhc2gnXSBcdC8vID8/IHdlIGNhbiBub3QgdXNlIGl0LCAgYmVjYXVzZSBIQVNIIGNobmFnZWQgaW4gYW55ICBjYXNlIVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAncmVxdWVzdF91cmknIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsncmVxdWVzdF91cmknXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnY3VzdG9tX2Zvcm0nIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsnY3VzdG9tX2Zvcm0nXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEFnZ3JlZ2F0ZSBib29raW5nIHJlc291cmNlcywgIGlmIGFueSA/XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfc3RyJyA6IF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicgKS5qb2luKCcsJylcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHQvLyBFeGl0XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cclxuXHJcbi8qXHJcblx0Ly8gU2hvdyBDYWxlbmRhclxyXG5cdHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQm9va2luZ3MgLSBEYXRlc1xyXG5cdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoICByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsnZGF0ZXMnXSAgKTtcclxuXHJcblx0Ly8gQm9va2luZ3MgLSBDaGlsZCBvciBvbmx5IHNpbmdsZSBib29raW5nIHJlc291cmNlIGluIGRhdGVzXHJcblx0X3dwYmMuYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyBdICk7XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvLyBVcGRhdGUgY2FsZW5kYXJcclxuXHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcbiovXHJcblxyXG5cdFx0XHRcdFx0Ly8gSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBIaWRlIGJvb2tpbmcgZm9ybVxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX2FuaW1hdGVkX19oaWRlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBTaG93IENvbmZpcm1hdGlvbiB8IFBheW1lbnQgc2VjdGlvblxyXG5cdFx0XHRcdFx0d3BiY19zaG93X3RoYW5rX3lvdV9tZXNzYWdlX2FmdGVyX2Jvb2tpbmcoIHJlc3BvbnNlX2RhdGEgKTtcclxuXHJcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0d3BiY19kb19zY3JvbGwoICcjd3BiY19zY3JvbGxfcG9pbnRfJyArIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgMTAgKTtcclxuXHRcdFx0XHRcdH0sIDUwMCApO1xyXG5cclxuXHJcblxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoXHJcblx0XHRcdFx0ICAvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICAgICAgICAgICAgICAgICAgICAgZGVzYz1cIiA9IFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiAgTk9OQ0UgZmllbGQgd2FzIG5vdCBwYXNzZWQgb3Igc29tZSBlcnJvciBoYXBwZW5lZCBhdCAgc2VydmVyISA9IFwiICA+XHJcblx0XHRcdFx0ICBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHsgICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdBamF4X0Vycm9yJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7IH1cclxuXHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHQvLyBUaGlzIHNlY3Rpb24gZXhlY3V0ZSwgIHdoZW4gIE5PTkNFIGZpZWxkIHdhcyBub3QgcGFzc2VkIG9yIHNvbWUgZXJyb3IgaGFwcGVuZWQgYXQgIHNlcnZlciFcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRcdFx0XHQvLyBHZXQgQ29udGVudCBvZiBFcnJvciBNZXNzYWdlXHJcblx0XHRcdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhJyArICc8L3N0cm9uZz4gJyArIGVycm9yVGhyb3duIDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAoPGI+JyArIGpxWEhSLnN0YXR1cyArICc8L2I+KSc7XHJcblx0XHRcdFx0XHRcdGlmICg0MDMgPT0ganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnPGJyPiBQcm9iYWJseSBub25jZSBmb3IgdGhpcyBwYWdlIGhhcyBiZWVuIGV4cGlyZWQuIFBsZWFzZSA8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgb25jbGljaz1cImphdmFzY3JpcHQ6bG9jYXRpb24ucmVsb2FkKCk7XCI+cmVsb2FkIHRoZSBwYWdlPC9hPi4nO1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJzxicj4gT3RoZXJ3aXNlLCBwbGVhc2UgY2hlY2sgdGhpcyA8YSBzdHlsZT1cImZvbnQtd2VpZ2h0OiA2MDA7XCIgaHJlZj1cImh0dHBzOi8vd3Bib29raW5nY2FsZW5kYXIuY29tL2ZhcS9yZXF1ZXN0LWRvLW5vdC1wYXNzLXNlY3VyaXR5LWNoZWNrLz9hZnRlcl91cGRhdGU9MTAuMS4xXCI+dHJvdWJsZXNob290aW5nIGluc3RydWN0aW9uPC9hPi48YnI+J1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHQvLyBFc2NhcGUgdGFncyBpbiBFcnJvciBtZXNzYWdlXHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJzxicj48c3Ryb25nPlJlc3BvbnNlPC9zdHJvbmc+PGRpdiBzdHlsZT1cInBhZGRpbmc6IDAgMTBweDttYXJnaW46IDAgMCAxMHB4O2JvcmRlci1yYWRpdXM6M3B4OyBib3gtc2hhZG93OjBweCAwcHggMXB4ICNhM2EzYTM7XCI+JyArIGpxWEhSLnJlc3BvbnNlVGV4dC5yZXBsYWNlKC8mL2csIFwiJmFtcDtcIilcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgLnJlcGxhY2UoLzwvZywgXCImbHQ7XCIpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IC5yZXBsYWNlKC8+L2csIFwiJmd0O1wiKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAucmVwbGFjZSgvXCIvZywgXCImcXVvdDtcIilcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgLnJlcGxhY2UoLycvZywgXCImIzM5O1wiKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsnPC9kaXY+JztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHZhciBjYWxlbmRhcl9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCB0aGlzLmRhdGEgKTtcclxuXHRcdFx0XHRcdHZhciBqcV9ub2RlID0gJyNib29raW5nX2Zvcm0nICsgY2FsZW5kYXJfaWQ7XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICwgeyAndHlwZScgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0Ly8gRW5hYmxlIFN1Ym1pdCB8IEhpZGUgc3BpbiBsb2FkZXJcclxuXHRcdFx0XHRcdHdwYmNfYm9va2luZ19mb3JtX19vbl9yZXNwb25zZV9fdWlfZWxlbWVudHNfZW5hYmxlKCBjYWxlbmRhcl9pZCApO1xyXG5cdFx0XHQgIFx0IH1cclxuXHRcdFx0XHQgLy8gPC9lZGl0b3ItZm9sZD5cclxuXHRcdFx0ICApXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuXHJcblx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2M9XCIgID09ICBDQVBUQ0hBID09ICBcIiAgPlxyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGUgaW1hZ2UgaW4gY2FwdGNoYSBhbmQgc2hvdyB3YXJuaW5nIG1lc3NhZ2VcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBwYXJhbXNcclxuXHQgKlxyXG5cdCAqIEV4YW1wbGUgb2YgJ3BhcmFtcycgOiB7XHJcblx0ICpcdFx0XHRcdFx0XHRcdCdyZXNvdXJjZV9pZCc6IHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSxcclxuXHQgKlx0XHRcdFx0XHRcdFx0J3VybCcgICAgICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnY2FwdGNoYV9fc2ltcGxlJyBdWyAndXJsJyBdLFxyXG5cdCAqXHRcdFx0XHRcdFx0XHQnY2hhbGxlbmdlJyAgOiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdjYXB0Y2hhX19zaW1wbGUnIF1bICdjaGFsbGVuZ2UnIF0sXHJcblx0ICpcdFx0XHRcdFx0XHRcdCdtZXNzYWdlJyAgICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKVxyXG5cdCAqXHRcdFx0XHRcdFx0fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FwdGNoYV9fc2ltcGxlX191cGRhdGUoIHBhcmFtcyApe1xyXG5cclxuXHRcdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FwdGNoYV9pbnB1dCcgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApLnZhbHVlID0gJyc7XHJcblx0XHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2NhcHRjaGFfaW1nJyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkuc3JjID0gcGFyYW1zWyAndXJsJyBdO1xyXG5cdFx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGRldl9jYXB0Y2hhX2NoYWxsZW5nZV8nICsgcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gKS52YWx1ZSA9IHBhcmFtc1sgJ2NoYWxsZW5nZScgXTtcclxuXHJcblx0XHQvLyBTaG93IHdhcm5pbmcgXHRcdEFmdGVyIENBUFRDSEEgSW1nXHJcblx0XHR2YXIgbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoICcjY2FwdGNoYV9pbnB1dCcgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSArICcgKyBpbWcnLCBwYXJhbXNbICdtZXNzYWdlJyBdICk7XHJcblxyXG5cdFx0Ly8gQW5pbWF0ZVxyXG5cdFx0alF1ZXJ5KCAnIycgKyBtZXNzYWdlX2lkICsgJywgJyArICcjY2FwdGNoYV9pbnB1dCcgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApLmZhZGVPdXQoIDM1MCApLmZhZGVJbiggMzAwICkuZmFkZU91dCggMzUwICkuZmFkZUluKCA0MDAgKS5hbmltYXRlKCB7b3BhY2l0eTogMX0sIDQwMDAgKTtcclxuXHRcdC8vIEZvY3VzIHRleHQgIGZpZWxkXHJcblx0XHRqUXVlcnkoICcjY2FwdGNoYV9pbnB1dCcgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApLnRyaWdnZXIoICdmb2N1cycgKTsgICAgXHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDguNy4xMS4xMi5cclxuXHJcblxyXG5cdFx0Ly8gRW5hYmxlIFN1Ym1pdCB8IEhpZGUgc3BpbiBsb2FkZXJcclxuXHRcdHdwYmNfYm9va2luZ19mb3JtX19vbl9yZXNwb25zZV9fdWlfZWxlbWVudHNfZW5hYmxlKCBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIElmIHRoZSBjYXB0Y2hhIGVsZW1lbnRzIG5vdCBleGlzdCAgaW4gdGhlIGJvb2tpbmcgZm9ybSwgIHRoZW4gIHJlbW92ZSBwYXJhbWV0ZXJzIHJlbGF0aXZlIGNhcHRjaGFcclxuXHQgKiBAcGFyYW0gcGFyYW1zXHJcblx0ICogQHJldHVybnMgb2JqXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYXB0Y2hhX19zaW1wbGVfX21heWJlX3JlbW92ZV9pbl9hanhfcGFyYW1zKCBwYXJhbXMgKXtcclxuXHJcblx0XHRpZiAoICEgd3BiY19jYXB0Y2hhX19zaW1wbGVfX2lzX2V4aXN0X2luX2Zvcm0oIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkgKXtcclxuXHRcdFx0ZGVsZXRlIHBhcmFtc1sgJ2NhcHRjaGFfY2hhbGFuZ2UnIF07XHJcblx0XHRcdGRlbGV0ZSBwYXJhbXNbICdjYXB0Y2hhX3VzZXJfaW5wdXQnIF07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gcGFyYW1zO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrIGlmIENBUFRDSEEgZXhpc3QgaW4gdGhlIGJvb2tpbmcgZm9ybVxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FwdGNoYV9fc2ltcGxlX19pc19leGlzdF9pbl9mb3JtKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHJldHVybiAoXHJcblx0XHRcdFx0XHRcdCgwICE9PSBqUXVlcnkoICcjd3BkZXZfY2FwdGNoYV9jaGFsbGVuZ2VfJyArIHJlc291cmNlX2lkICkubGVuZ3RoKVxyXG5cdFx0XHRcdFx0IHx8ICgwICE9PSBqUXVlcnkoICcjY2FwdGNoYV9pbnB1dCcgKyByZXNvdXJjZV9pZCApLmxlbmd0aClcclxuXHRcdFx0XHQpO1xyXG5cdH1cclxuXHJcblx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHJcblxyXG5cdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiICA9PSAgU2VuZCBCdXR0b24gfCBGb3JtIFNwaW4gTG9hZGVyICA9PSAgXCIgID5cclxuXHJcblx0LyoqXHJcblx0ICogRGlzYWJsZSBTZW5kIGJ1dHRvbiAgfCAgU2hvdyBTcGluIExvYWRlclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX29uX3N1Ym1pdF9fdWlfZWxlbWVudHNfZGlzYWJsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHQvLyBEaXNhYmxlIFN1Ym1pdFxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19kaXNhYmxlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIFNob3cgU3BpbiBsb2FkZXIgaW4gYm9va2luZyBmb3JtXHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3coIHJlc291cmNlX2lkICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBFbmFibGUgU2VuZCBidXR0b24gIHwgICBIaWRlIFNwaW4gTG9hZGVyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZShyZXNvdXJjZV9pZCl7XHJcblxyXG5cdFx0Ly8gRW5hYmxlIFN1Ym1pdFxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19lbmFibGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gSGlkZSBTcGluIGxvYWRlciBpbiBib29raW5nIGZvcm1cclxuXHRcdHdwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9faGlkZSggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbmFibGUgU3VibWl0IGJ1dHRvblxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19zZW5kX2J1dHRvbl9fZW5hYmxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8gQWN0aXZhdGUgU2VuZCBidXR0b25cclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGlucHV0W3R5cGU9YnV0dG9uXScgKS5wcm9wKCBcImRpc2FibGVkXCIsIGZhbHNlICk7XHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyBidXR0b24nICkucHJvcCggXCJkaXNhYmxlZFwiLCBmYWxzZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGlzYWJsZSBTdWJtaXQgYnV0dG9uICBhbmQgc2hvdyAgc3BpblxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2Rpc2FibGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHQvLyBEaXNhYmxlIFNlbmQgYnV0dG9uXHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyBpbnB1dFt0eXBlPWJ1dHRvbl0nICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyBidXR0b24nICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXNhYmxlICdUaGlzJyBidXR0b25cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gX3RoaXNcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3RoaXNfYnV0dG9uX19kaXNhYmxlKCBfdGhpcyApe1xyXG5cclxuXHRcdFx0Ly8gRGlzYWJsZSBTZW5kIGJ1dHRvblxyXG5cdFx0XHRqUXVlcnkoIF90aGlzICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IGJvb2tpbmcgZm9ybSAgU3BpbiBMb2FkZXJcclxuXHRcdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3coIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHQvLyBTaG93IFNwaW4gTG9hZGVyXHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5hZnRlcihcclxuXHRcdFx0XHQnPGRpdiBpZD1cIndwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyJyArIHJlc291cmNlX2lkICsgJ1wiIGNsYXNzPVwid3BiY19ib29raW5nX2Zvcm1fc3Bpbl9sb2FkZXJcIiBzdHlsZT1cInBvc2l0aW9uOiByZWxhdGl2ZTtcIj48ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkZXJfd3JhcHBlclwiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl9taW5pXCI+PC9kaXY+PC9kaXY+PC9kaXY+J1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIC8gSGlkZSBib29raW5nIGZvcm0gIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8gUmVtb3ZlIFNwaW4gTG9hZGVyXHJcblx0XHRcdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlcicgKyByZXNvdXJjZV9pZCApLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhpZGUgYm9va2luZyBmb3JtIHd0aCBhbmltYXRpb25cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX2FuaW1hdGVkX19oaWRlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnNsaWRlVXAoICAxMDAwXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgZnVuY3Rpb24gKCl7XHJcblx0XHRcdC8vXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBpZiAoIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZ2F0ZXdheV9wYXltZW50X2Zvcm1zJyArIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApICE9IG51bGwgKXtcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFx0d3BiY19kb19zY3JvbGwoICcjc3VibWl0aW5nJyArIHJlc291cmNlX2lkICk7XHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB9IGVsc2VcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnBhcmVudCgpLmZpbmQoICcuc3VibWl0aW5nX2NvbnRlbnQnICkubGVuZ3RoID4gMCApe1xyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL3dwYmNfZG9fc2Nyb2xsKCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgKyAuc3VibWl0aW5nX2NvbnRlbnQnICk7XHJcblx0XHRcdC8vXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCB2YXIgaGlkZVRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgd3BiY19kb19zY3JvbGwoIGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5wYXJlbnQoKS5maW5kKCAnLnN1Ym1pdGluZ19jb250ZW50JyApLmdldCggMCApICk7XHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LCAxMDApO1xyXG5cdFx0XHQvL1xyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLmhpZGUoKTtcclxuXHJcblx0XHRcdC8vIHZhciBoaWRlVGltZW91dCA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHQvL1xyXG5cdFx0XHQvLyBcdGlmICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnBhcmVudCgpLmZpbmQoICcuc3VibWl0aW5nX2NvbnRlbnQnICkubGVuZ3RoID4gMCApe1xyXG5cdFx0XHQvLyBcdFx0dmFyIHJhbmRvbV9pZCA9IE1hdGguZmxvb3IoIChNYXRoLnJhbmRvbSgpICogMTAwMDApICsgMSApO1xyXG5cdFx0XHQvLyBcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnBhcmVudCgpLmJlZm9yZSggJzxkaXYgaWQ9XCJzY3JvbGxfdG8nICsgcmFuZG9tX2lkICsgJ1wiPjwvZGl2PicgKTtcclxuXHRcdFx0Ly8gXHRcdGNvbnNvbGUubG9nKCBqUXVlcnkoICcjc2Nyb2xsX3RvJyArIHJhbmRvbV9pZCApICk7XHJcblx0XHRcdC8vXHJcblx0XHRcdC8vIFx0XHR3cGJjX2RvX3Njcm9sbCggJyNzY3JvbGxfdG8nICsgcmFuZG9tX2lkICk7XHJcblx0XHRcdC8vIFx0XHQvL3dwYmNfZG9fc2Nyb2xsKCBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkucGFyZW50KCkuZ2V0KCAwICkgKTtcclxuXHRcdFx0Ly8gXHR9XHJcblx0XHRcdC8vIH0sIDUwMCApO1xyXG5cdFx0fVxyXG5cdC8vIDwvZWRpdG9yLWZvbGQ+XHJcblxyXG5cclxuXHQvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICAgICAgICAgICAgICAgICAgICAgZGVzYz1cIiAgPT0gIE1pbmkgU3BpbiBMb2FkZXIgID09ICBcIiAgPlxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBwYXJlbnRfaHRtbF9pZFxyXG5cdFx0ICovXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IG1pY3JvIFNwaW4gTG9hZGVyXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIGlkXHRcdFx0XHRcdFx0SUQgb2YgTG9hZGVyLCAgZm9yIGxhdGVyICBoaWRlIGl0IGJ5ICB1c2luZyBcdFx0d3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19oaWRlKCBpZCApIE9SIHdwYmNfX3NwaW5fbG9hZGVyX19taW5pX19oaWRlKCBpZCApXHJcblx0XHQgKiBAcGFyYW0ganFfbm9kZV93aGVyZV9pbnNlcnRcdFx0c3VjaCBhcyAnI2VzdGltYXRlX2Jvb2tpbmdfbmlnaHRfY29zdF9oaW50MTAnICAgT1IgICcuZXN0aW1hdGVfYm9va2luZ19uaWdodF9jb3N0X2hpbnQxMCdcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19zaG93X19pbnNpZGUoIGlkICwganFfbm9kZV93aGVyZV9pbnNlcnQgKXtcclxuXHJcblx0XHRcdFx0d3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX3Nob3coIGlkLCB7XHJcblx0XHRcdFx0XHQnY29sb3InICA6ICcjNDQ0JyxcclxuXHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7XHJcblx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2luc2lkZScsXHJcblx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZV93aGVyZV9pbnNlcnRcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3Bvc2l0aW9uOiByZWxhdGl2ZTtkaXNwbGF5OiBpbmxpbmUtZmxleDtmbGV4LWZsb3c6IGNvbHVtbiBub3dyYXA7anVzdGlmeS1jb250ZW50OiBjZW50ZXI7YWxpZ24taXRlbXM6IGNlbnRlcjttYXJnaW46IDdweCAxMnB4OycsXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgIDogJ3dwYmNfb25lX3NwaW5fbG9hZGVyX21pY3JvJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbW92ZSBzcGlubmVyXHJcblx0XHQgKiBAcGFyYW0gaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19oaWRlKCBpZCApe1xyXG5cdFx0ICAgIHdwYmNfX3NwaW5fbG9hZGVyX19taW5pX19oaWRlKCBpZCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgbWluaSBTcGluIExvYWRlclxyXG5cdFx0ICogQHBhcmFtIHBhcmVudF9odG1sX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfX3NwaW5fbG9hZGVyX19taW5pX19zaG93KCBwYXJlbnRfaHRtbF9pZCAsIHBhcmFtcyA9IHt9ICl7XHJcblxyXG5cdFx0XHR2YXIgcGFyYW1zX2RlZmF1bHQgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCdjb2xvcicgICAgOiAnIzAwNzFjZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiAnJyxcdFx0XHRcdFx0Ly8gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcidcdFx0XHRcdC8vICdpbnNpZGUnIHwgJ2JlZm9yZScgfCAnYWZ0ZXInIHwgJ3JpZ2h0JyB8ICdsZWZ0J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3Bvc2l0aW9uOiByZWxhdGl2ZTttaW4taGVpZ2h0OiAyLjhyZW07JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2NsYXNzJyAgICA6ICd3cGJjX29uZV9zcGluX2xvYWRlcl9taW5pIDB3cGJjX3NwaW5zX2xvYWRlcl9taW5pJ1xyXG5cdFx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0Zm9yICggdmFyIHBfa2V5IGluIHBhcmFtcyApe1xyXG5cdFx0XHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcGFyYW1zWyBwX2tleSBdO1xyXG5cdFx0XHR9XHJcblx0XHRcdHBhcmFtcyA9IHBhcmFtc19kZWZhdWx0O1xyXG5cclxuXHRcdFx0aWYgKCAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocGFyYW1zWydjb2xvciddKSkgJiYgKCcnICE9IHBhcmFtc1snY29sb3InXSkgKXtcclxuXHRcdFx0XHRwYXJhbXNbJ2NvbG9yJ10gPSAnYm9yZGVyLWNvbG9yOicgKyBwYXJhbXNbJ2NvbG9yJ10gKyAnOyc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBzcGlubmVyX2h0bWwgPSAnPGRpdiBpZD1cIndwYmNfbWluaV9zcGluX2xvYWRlcicgKyBwYXJlbnRfaHRtbF9pZCArICdcIiBjbGFzcz1cIndwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyXCIgc3R5bGU9XCInICsgcGFyYW1zWyAnc3R5bGUnIF0gKyAnXCI+PGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXJcIj48ZGl2IGNsYXNzPVwiJyArIHBhcmFtc1sgJ2NsYXNzJyBdICsgJ1wiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ2NvbG9yJyBdICsgJ1wiPjwvZGl2PjwvZGl2PjwvZGl2Pic7XHJcblxyXG5cdFx0XHRpZiAoICcnID09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKXtcclxuXHRcdFx0XHRwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdID0gJyMnICsgcGFyZW50X2h0bWxfaWQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNob3cgU3BpbiBMb2FkZXJcclxuXHRcdFx0aWYgKCAnYWZ0ZXInID09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblx0XHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYWZ0ZXIoIHNwaW5uZXJfaHRtbCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmh0bWwoIHNwaW5uZXJfaHRtbCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgLyBIaWRlIG1pbmkgU3BpbiBMb2FkZXJcclxuXHRcdCAqIEBwYXJhbSBwYXJlbnRfaHRtbF9pZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX19zcGluX2xvYWRlcl9fbWluaV9faGlkZSggcGFyZW50X2h0bWxfaWQgKXtcclxuXHJcblx0XHRcdC8vIFJlbW92ZSBTcGluIExvYWRlclxyXG5cdFx0XHRqUXVlcnkoICcjd3BiY19taW5pX3NwaW5fbG9hZGVyJyArIHBhcmVudF9odG1sX2lkICkucmVtb3ZlKCk7XHJcblx0XHR9XHJcblxyXG5cdC8vIDwvZWRpdG9yLWZvbGQ+XHJcblxyXG4vL1RPRE86IHdoYXQgIGFib3V0IHNob3dpbmcgb25seSAgVGhhbmsgeW91LiBtZXNzYWdlIHdpdGhvdXQgcGF5bWVudCBmb3Jtcy5cclxuLyoqXHJcbiAqIFNob3cgJ1RoYW5rIHlvdScuIG1lc3NhZ2UgYW5kIHBheW1lbnQgZm9ybXNcclxuICpcclxuICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2hvd190aGFua195b3VfbWVzc2FnZV9hZnRlcl9ib29raW5nKCByZXNwb25zZV9kYXRhICl7XHJcblxyXG5cdGlmIChcclxuIFx0XHQgICAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9pc19yZWRpcmVjdCcgXSkpXHJcblx0XHQmJiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV91cmwnIF0pKVxyXG5cdFx0JiYgKCdwYWdlJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X2lzX3JlZGlyZWN0JyBdKVxyXG5cdFx0JiYgKCcnICE9IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfdXJsJyBdKVxyXG5cdCl7XHJcblx0XHRqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2Jvb2tpbmdfY3JlYXRlZCcsIFsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICwgcmVzcG9uc2VfZGF0YSBdICk7XHRcdFx0Ly8gRml4SW46IDEwLjAuMC4zMC5cclxuXHRcdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV91cmwnIF07XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR2YXIgcmVzb3VyY2VfaWQgPSByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF1cclxuXHR2YXIgY29uZmlybV9jb250ZW50ID0nJztcclxuXHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X21lc3NhZ2UnIF0pICl7XHJcblx0XHRcdFx0XHQgIFx0XHRcdCByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X21lc3NhZ2UnIF0gPSAnJztcclxuXHR9XHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbicgXSApICl7XHJcblx0XHQgXHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb24nIF0gPSAnJztcclxuXHR9XHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3BheW1lbnRfY29zdCcgXSApICl7XHJcblx0XHRcdFx0XHQgIFx0XHRcdCByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3BheW1lbnRfY29zdCcgXSA9ICcnO1xyXG5cdH1cclxuXHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9nYXRld2F5cycgXSApICl7XHJcblx0XHRcdFx0XHQgIFx0XHRcdCByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfZ2F0ZXdheXMnIF0gPSAnJztcclxuXHR9XHJcblx0dmFyIHR5X21lc3NhZ2VfaGlkZSBcdFx0XHRcdFx0XHQ9ICgnJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X21lc3NhZ2UnIF0pID8gJ3dwYmNfdHlfaGlkZScgOiAnJztcclxuXHR2YXIgdHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uX2hpZGUgXHQ9ICgnJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbicgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKSkgPyAnd3BiY190eV9oaWRlJyA6ICcnO1xyXG5cdHZhciB0eV9ib29raW5nX2Nvc3RzX2hpZGUgXHRcdFx0XHQ9ICgnJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3BheW1lbnRfY29zdCcgXSkgPyAnd3BiY190eV9oaWRlJyA6ICcnO1xyXG5cdHZhciB0eV9wYXltZW50X2dhdGV3YXlzX2hpZGUgXHRcdFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X2dhdGV3YXlzJyBdLnJlcGxhY2UoIC9cXFxcbi9nLCAnJyApKSA/ICd3cGJjX3R5X2hpZGUnIDogJyc7XHJcblxyXG5cdGlmICggJ3dwYmNfdHlfaGlkZScgIT0gdHlfcGF5bWVudF9nYXRld2F5c19oaWRlICl7XHJcblx0XHRqUXVlcnkoICcud3BiY190eV9fY29udGVudF90ZXh0LndwYmNfdHlfX2NvbnRlbnRfZ2F0ZXdheXMnICkuaHRtbCggJycgKTtcdC8vIFJlc2V0ICBhbGwgIG90aGVyIHBvc3NpYmxlIGdhdGV3YXlzIGJlZm9yZSBzaG93aW5nIG5ldyBvbmUuXHJcblx0fVxyXG5cclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYDxkaXYgaWQ9XCJ3cGJjX3Njcm9sbF9wb2ludF8ke3Jlc291cmNlX2lkfVwiPjwvZGl2PmA7XHJcblx0Y29uZmlybV9jb250ZW50ICs9IGAgIDxkaXYgY2xhc3M9XCJ3cGJjX2FmdGVyX2Jvb2tpbmdfdGhhbmtfeW91X3NlY3Rpb25cIj5gO1xyXG5cdGNvbmZpcm1fY29udGVudCArPSBgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19tZXNzYWdlICR7dHlfbWVzc2FnZV9oaWRlfVwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdfTwvZGl2PmA7XHJcbiAgICBjb25maXJtX2NvbnRlbnQgKz0gYCAgICA8ZGl2IGNsYXNzPVwid3BiY190eV9fY29udGFpbmVyXCI+YDtcclxuXHRpZiAoICcnICE9PSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X21lc3NhZ2VfYm9va2luZ19pZCcgXSApe1xyXG5cdFx0Y29uZmlybV9jb250ZW50ICs9IGAgICAgICA8ZGl2IGNsYXNzPVwid3BiY190eV9faGVhZGVyXCI+JHtyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X21lc3NhZ2VfYm9va2luZ19pZCcgXX08L2Rpdj5gO1xyXG5cdH1cclxuICAgIGNvbmZpcm1fY29udGVudCArPSBgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRcIj5gO1xyXG5cdGNvbmZpcm1fY29udGVudCArPSBgICAgICAgICA8ZGl2IGNsYXNzPVwid3BiY190eV9fY29udGVudF90ZXh0IHdwYmNfdHlfX3BheW1lbnRfZGVzY3JpcHRpb24gJHt0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb25faGlkZX1cIj4ke3Jlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uJyBdLnJlcGxhY2UoIC9cXFxcbi9nLCAnJyApfTwvZGl2PmA7XHJcblx0aWYgKCAnJyAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9jdXN0b21lcl9kZXRhaWxzJyBdICl7XHJcblx0XHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgIFx0PGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX2NvbHNfMlwiPiR7cmVzcG9uc2VfZGF0YVsnYWp4X2NvbmZpcm1hdGlvbiddWyd0eV9jdXN0b21lcl9kZXRhaWxzJ119PC9kaXY+YDtcclxuXHR9XHJcblx0aWYgKCAnJyAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9ib29raW5nX2RldGFpbHMnIF0gKXtcclxuXHRcdGNvbmZpcm1fY29udGVudCArPSBgICAgICAgXHQ8ZGl2IGNsYXNzPVwid3BiY190eV9fY29udGVudF90ZXh0IHdwYmNfY29sc18yXCI+JHtyZXNwb25zZV9kYXRhWydhanhfY29uZmlybWF0aW9uJ11bJ3R5X2Jvb2tpbmdfZGV0YWlscyddfTwvZGl2PmA7XHJcblx0fVxyXG5cdGNvbmZpcm1fY29udGVudCArPSBgICAgICAgICA8ZGl2IGNsYXNzPVwid3BiY190eV9fY29udGVudF90ZXh0IHdwYmNfdHlfX2NvbnRlbnRfY29zdHMgJHt0eV9ib29raW5nX2Nvc3RzX2hpZGV9XCI+JHtyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X2Jvb2tpbmdfY29zdHMnIF19PC9kaXY+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX3R5X19jb250ZW50X2dhdGV3YXlzICR7dHlfcGF5bWVudF9nYXRld2F5c19oaWRlfVwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X2dhdGV3YXlzJyBdLnJlcGxhY2UoIC9cXFxcbi9nLCAnJyApLnJlcGxhY2UoIC9hamF4X3NjcmlwdC9naSwgJ3NjcmlwdCcgKX08L2Rpdj5gO1xyXG4gICAgY29uZmlybV9jb250ZW50ICs9IGAgICAgICA8L2Rpdj5gO1xyXG4gICAgY29uZmlybV9jb250ZW50ICs9IGAgICAgPC9kaXY+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYDwvZGl2PmA7XHJcblxyXG4gXHRqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkuYWZ0ZXIoIGNvbmZpcm1fY29udGVudCApO1xyXG5cclxuXHJcblx0Ly9GaXhJbjogMTAuMC4wLjMwXHRcdC8vIGV2ZW50IG5hbWVcdFx0XHQvLyBSZXNvdXJjZSBJRFx0LVx0JzEnXHJcblx0alF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19ib29raW5nX2NyZWF0ZWQnLCBbIHJlc291cmNlX2lkICwgcmVzcG9uc2VfZGF0YSBdICk7XHJcblx0Ly8gVG8gY2F0Y2ggdGhpcyBldmVudDogalF1ZXJ5KCAnYm9keScgKS5vbignd3BiY19ib29raW5nX2NyZWF0ZWQnLCBmdW5jdGlvbiggZXZlbnQsIHJlc291cmNlX2lkLCBwYXJhbXMgKSB7IGNvbnNvbGUubG9nKCBldmVudCwgcmVzb3VyY2VfaWQsIHBhcmFtcyApOyB9ICk7XHJcbn1cclxuIl0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUVaO0FBQ0E7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFqQkEsU0FBQUEsUUFBQUMsR0FBQSxzQ0FBQUQsT0FBQSx3QkFBQUUsTUFBQSx1QkFBQUEsTUFBQSxDQUFBQyxRQUFBLGFBQUFGLEdBQUEsa0JBQUFBLEdBQUEsZ0JBQUFBLEdBQUEsV0FBQUEsR0FBQSx5QkFBQUMsTUFBQSxJQUFBRCxHQUFBLENBQUFHLFdBQUEsS0FBQUYsTUFBQSxJQUFBRCxHQUFBLEtBQUFDLE1BQUEsQ0FBQUcsU0FBQSxxQkFBQUosR0FBQSxLQUFBRCxPQUFBLENBQUFDLEdBQUE7QUFrQkEsU0FBU0ssd0JBQXdCQSxDQUFFQyxNQUFNLEVBQUU7RUFFMUNDLE9BQU8sQ0FBQ0MsY0FBYyxDQUFFLDBCQUEyQixDQUFDO0VBQ3BERCxPQUFPLENBQUNDLGNBQWMsQ0FBRSx3QkFBeUIsQ0FBQztFQUNsREQsT0FBTyxDQUFDRSxHQUFHLENBQUVILE1BQU8sQ0FBQztFQUNyQkMsT0FBTyxDQUFDRyxRQUFRLENBQUMsQ0FBQztFQUVsQkosTUFBTSxHQUFHSyxnREFBZ0QsQ0FBRUwsTUFBTyxDQUFDOztFQUVuRTtFQUNBTSxNQUFNLENBQUUsTUFBTyxDQUFDLENBQUNDLE9BQU8sQ0FBRSw0QkFBNEIsRUFBRSxDQUFFUCxNQUFNLENBQUMsYUFBYSxDQUFDLEVBQUVBLE1BQU0sQ0FBRyxDQUFDOztFQUUzRjtFQUNBTSxNQUFNLENBQUNFLElBQUksQ0FBRUMsYUFBYSxFQUN6QjtJQUNDQyxNQUFNLEVBQW1CLDBCQUEwQjtJQUNu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
