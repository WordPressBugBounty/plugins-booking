"use strict";

// ---------------------------------------------------------------------------------------------------------------------
//  A j a x    A d d    N e w    B o o k i n g
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

  // Start Ajax
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
  jQuery('#captcha_input' + params['resource_id']).trigger('focus'); //FixIn: 8.7.11.12

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
    jQuery('body').trigger('wpbc_booking_created', [response_data['resource_id'], response_data]); //FixIn: 10.0.0.30
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX2NhcGFjaXR5L19vdXQvY3JlYXRlX2Jvb2tpbmcuanMiLCJuYW1lcyI6WyJfdHlwZW9mIiwib2JqIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJjb25zdHJ1Y3RvciIsInByb3RvdHlwZSIsIndwYmNfYWp4X2Jvb2tpbmdfX2NyZWF0ZSIsInBhcmFtcyIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsImdyb3VwRW5kIiwid3BiY19jYXB0Y2hhX19zaW1wbGVfX21heWJlX3JlbW92ZV9pbl9hanhfcGFyYW1zIiwialF1ZXJ5IiwicG9zdCIsIndwYmNfdXJsX2FqYXgiLCJhY3Rpb24iLCJ3cGJjX2FqeF91c2VyX2lkIiwiX3dwYmMiLCJnZXRfc2VjdXJlX3BhcmFtIiwibm9uY2UiLCJ3cGJjX2FqeF9sb2NhbGUiLCJjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyIsInJlc3BvbnNlX2RhdGEiLCJ0ZXh0U3RhdHVzIiwianFYSFIiLCJvYmpfa2V5IiwiY2FsZW5kYXJfaWQiLCJ3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCIsImRhdGEiLCJqcV9ub2RlIiwid3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSIsIndwYmNfYm9va2luZ19mb3JtX19vbl9yZXNwb25zZV9fdWlfZWxlbWVudHNfZW5hYmxlIiwid3BiY19jYXB0Y2hhX19zaW1wbGVfX3VwZGF0ZSIsInJlcGxhY2UiLCJtZXNzYWdlX2lkIiwiYWp4X2FmdGVyX2Jvb2tpbmdfbWVzc2FnZSIsIndwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyIsIndwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4IiwiYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlIiwiam9pbiIsIndwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9faGlkZSIsIndwYmNfYm9va2luZ19mb3JtX19hbmltYXRlZF9faGlkZSIsIndwYmNfc2hvd190aGFua195b3VfbWVzc2FnZV9hZnRlcl9ib29raW5nIiwic2V0VGltZW91dCIsIndwYmNfZG9fc2Nyb2xsIiwiZmFpbCIsImVycm9yVGhyb3duIiwid2luZG93IiwiZXJyb3JfbWVzc2FnZSIsInN0YXR1cyIsInJlc3BvbnNlVGV4dCIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJ2YWx1ZSIsInNyYyIsIndwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmciLCJmYWRlT3V0IiwiZmFkZUluIiwiYW5pbWF0ZSIsIm9wYWNpdHkiLCJ0cmlnZ2VyIiwid3BiY19jYXB0Y2hhX19zaW1wbGVfX2lzX2V4aXN0X2luX2Zvcm0iLCJyZXNvdXJjZV9pZCIsImxlbmd0aCIsIndwYmNfYm9va2luZ19mb3JtX19vbl9zdWJtaXRfX3VpX2VsZW1lbnRzX2Rpc2FibGUiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2Rpc2FibGUiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3ciLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2VuYWJsZSIsInByb3AiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fdGhpc19idXR0b25fX2Rpc2FibGUiLCJfdGhpcyIsImFmdGVyIiwicmVtb3ZlIiwiaGlkZSIsIndwYmNfX3NwaW5fbG9hZGVyX19taWNyb19fc2hvd19faW5zaWRlIiwiaWQiLCJqcV9ub2RlX3doZXJlX2luc2VydCIsIndwYmNfX3NwaW5fbG9hZGVyX19taW5pX19zaG93Iiwid3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19oaWRlIiwid3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUiLCJwYXJlbnRfaHRtbF9pZCIsImFyZ3VtZW50cyIsInVuZGVmaW5lZCIsInBhcmFtc19kZWZhdWx0IiwicF9rZXkiLCJzcGlubmVyX2h0bWwiLCJodG1sIiwibG9jYXRpb24iLCJocmVmIiwiY29uZmlybV9jb250ZW50IiwidHlfbWVzc2FnZV9oaWRlIiwidHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uX2hpZGUiLCJ0eV9ib29raW5nX2Nvc3RzX2hpZGUiLCJ0eV9wYXltZW50X2dhdGV3YXlzX2hpZGUiLCJjb25jYXQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9fY2FwYWNpdHkvX3NyYy9jcmVhdGVfYm9va2luZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyAgQSBqIGEgeCAgICBBIGQgZCAgICBOIGUgdyAgICBCIG8gbyBrIGkgbiBnXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTdWJtaXQgbmV3IGJvb2tpbmdcclxuICpcclxuICogQHBhcmFtIHBhcmFtcyAgID0gICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAncmVzb3VyY2VfaWQnICAgICAgICA6IHJlc291cmNlX2lkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkYXRlc19kZG1teXlfY3N2JyAgIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWx1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZm9ybWRhdGEnICAgICAgICAgICA6IGZvcm1kYXRhLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdib29raW5nX2hhc2gnICAgICAgIDogbXlfYm9va2luZ19oYXNoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdXN0b21fZm9ybScgICAgICAgIDogbXlfYm9va2luZ19mb3JtLFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY2FwdGNoYV9jaGFsYW5nZScgICA6IGNhcHRjaGFfY2hhbGFuZ2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NhcHRjaGFfdXNlcl9pbnB1dCcgOiB1c2VyX2NhcHRjaGEsXHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdpc19lbWFpbHNfc2VuZCcgICAgIDogaXNfc2VuZF9lbWVpbHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2FjdGl2ZV9sb2NhbGUnICAgICAgOiB3cGRldl9hY3RpdmVfbG9jYWxlXHJcblx0XHRcdFx0XHRcdH1cclxuICpcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX2NyZWF0ZSggcGFyYW1zICl7XHJcblxyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfQk9PS0lOR19fQ1JFQVRFJyApO1xyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnPT0gQmVmb3JlIEFqYXggU2VuZCA9PScgKTtcclxuY29uc29sZS5sb2coIHBhcmFtcyApO1xyXG5jb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdHBhcmFtcyA9IHdwYmNfY2FwdGNoYV9fc2ltcGxlX19tYXliZV9yZW1vdmVfaW5fYWp4X3BhcmFtcyggcGFyYW1zICk7XHJcblxyXG5cdC8vIFN0YXJ0IEFqYXhcclxuXHRqUXVlcnkucG9zdCggd3BiY191cmxfYWpheCxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRhY3Rpb24gICAgICAgICAgOiAnV1BCQ19BSlhfQk9PS0lOR19fQ1JFQVRFJyxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X3VzZXJfaWQ6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSxcclxuXHJcblx0XHRcdFx0XHRjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyA6IHBhcmFtc1xyXG5cclxuXHRcdFx0XHRcdC8qKlxyXG5cdFx0XHRcdFx0ICogIFVzdWFsbHkgIHBhcmFtcyA9IHsgJ3Jlc291cmNlX2lkJyAgICAgICAgOiByZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRcdCAqXHRcdFx0XHRcdFx0J2RhdGVzX2RkbW15eV9jc3YnICAgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbHVlLFxyXG5cdFx0XHRcdFx0ICpcdFx0XHRcdFx0XHQnZm9ybWRhdGEnICAgICAgICAgICA6IGZvcm1kYXRhLFxyXG5cdFx0XHRcdFx0ICpcdFx0XHRcdFx0XHQnYm9va2luZ19oYXNoJyAgICAgICA6IG15X2Jvb2tpbmdfaGFzaCxcclxuXHRcdFx0XHRcdCAqXHRcdFx0XHRcdFx0J2N1c3RvbV9mb3JtJyAgICAgICAgOiBteV9ib29raW5nX2Zvcm0sXHJcblx0XHRcdFx0XHQgKlxyXG5cdFx0XHRcdFx0ICpcdFx0XHRcdFx0XHQnY2FwdGNoYV9jaGFsYW5nZScgICA6IGNhcHRjaGFfY2hhbGFuZ2UsXHJcblx0XHRcdFx0XHQgKlx0XHRcdFx0XHRcdCd1c2VyX2NhcHRjaGEnICAgICAgIDogdXNlcl9jYXB0Y2hhLFxyXG5cdFx0XHRcdFx0ICpcclxuXHRcdFx0XHRcdCAqXHRcdFx0XHRcdFx0J2lzX2VtYWlsc19zZW5kJyAgICAgOiBpc19zZW5kX2VtZWlscyxcclxuXHRcdFx0XHRcdCAqXHRcdFx0XHRcdFx0J2FjdGl2ZV9sb2NhbGUnICAgICAgOiB3cGRldl9hY3RpdmVfbG9jYWxlXHJcblx0XHRcdFx0XHQgKlx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0fSxcclxuXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogUyB1IGMgYyBlIHMgc1xyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0ICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcdFx0LVx0aXRzIG9iamVjdCByZXR1cm5lZCBmcm9tICBBamF4IC0gY2xhc3MtbGl2ZS1zZWFyY2cucGhwXHJcblx0XHRcdFx0ICogQHBhcmFtIHRleHRTdGF0dXNcdFx0LVx0J3N1Y2Nlc3MnXHJcblx0XHRcdFx0ICogQHBhcmFtIGpxWEhSXHRcdFx0XHQtXHRPYmplY3RcclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRmdW5jdGlvbiAoIHJlc3BvbnNlX2RhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkge1xyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9CT09LSU5HX19DUkVBVEUgPT0gJyApO1xyXG5mb3IgKCB2YXIgb2JqX2tleSBpbiByZXNwb25zZV9kYXRhICl7XHJcblx0Y29uc29sZS5ncm91cENvbGxhcHNlZCggJz09JyArIG9ial9rZXkgKyAnPT0nICk7XHJcblx0Y29uc29sZS5sb2coICcgOiAnICsgb2JqX2tleSArICcgOiAnLCByZXNwb25zZV9kYXRhWyBvYmpfa2V5IF0gKTtcclxuXHRjb25zb2xlLmdyb3VwRW5kKCk7XHJcbn1cclxuY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHJcblx0XHRcdFx0XHQvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICBkZXNjPVwiID0gRXJyb3IgTWVzc2FnZSEgU2VydmVyIHJlc3BvbnNlIHdpdGggU3RyaW5nLiAgLT4gIEVfWF9JX1QgIFwiICA+XHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHQvLyBUaGlzIHNlY3Rpb24gZXhlY3V0ZSwgIHdoZW4gc2VydmVyIHJlc3BvbnNlIHdpdGggIFN0cmluZyBpbnN0ZWFkIG9mIE9iamVjdCAtLSBVc3VhbGx5ICBpdCdzIGJlY2F1c2Ugb2YgbWlzdGFrZSBpbiBjb2RlICFcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgY2FsZW5kYXJfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHRcdHZhciBqcV9ub2RlID0gJyNib29raW5nX2Zvcm0nICsgY2FsZW5kYXJfaWQ7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICcnID09IHJlc3BvbnNlX2RhdGEgKXtcclxuXHRcdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhID0gJzxzdHJvbmc+JyArICdFcnJvciEgU2VydmVyIHJlc3BvbmQgd2l0aCBlbXB0eSBzdHJpbmchJyArICc8L3N0cm9uZz4gJyA7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGEgLCB7ICd0eXBlJyAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggY2FsZW5kYXJfaWQgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHJcblxyXG5cdFx0XHRcdFx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgZGVzYz1cIiAgPT0gIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiB3ZSBoYXZlIEtOT1dOIGVycm9ycyBmcm9tIEJvb2tpbmcgQ2FsZW5kYXIuICAtPiAgRV9YX0lfVCAgXCIgID5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiB3ZSBoYXZlIEtOT1dOIGVycm9ycyBmcm9tIEJvb2tpbmcgQ2FsZW5kYXJcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRcdFx0XHRpZiAoICdvaycgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnc3RhdHVzJyBdICkge1xyXG5cclxuXHRcdFx0XHRcdFx0c3dpdGNoICggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnc3RhdHVzX2Vycm9yJyBdICl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2NhcHRjaGFfc2ltcGxlX3dyb25nJzpcclxuXHRcdFx0XHRcdFx0XHRcdHdwYmNfY2FwdGNoYV9fc2ltcGxlX191cGRhdGUoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnOiByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VybCcgICAgICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnY2FwdGNoYV9fc2ltcGxlJyBdWyAndXJsJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjaGFsbGVuZ2UnICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2NhcHRjaGFfX3NpbXBsZScgXVsgJ2NoYWxsZW5nZScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbWVzc2FnZScgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjYXNlICdyZXNvdXJjZV9pZF9pbmNvcnJlY3QnOlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2hvdyBFcnJvciBNZXNzYWdlIC0gaW5jb3JyZWN0ICBib29raW5nIHJlc291cmNlIElEIGR1cmluZyBzdWJtaXQgb2YgYm9va2luZy5cclxuXHRcdFx0XHRcdFx0XHRcdHZhciBtZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyA6ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdKSlcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7ICd3aGVyZSc6ICdhZnRlcicsICdqcV9ub2RlJzogJyNib29raW5nX2Zvcm0nICsgcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjYXNlICdib29raW5nX2Nhbl9ub3Rfc2F2ZSc6XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBXZSBjYW4gbm90IHNhdmUgYm9va2luZywgYmVjYXVzZSBkYXRlcyBhcmUgYm9va2VkIG9yIGNhbiBub3Qgc2F2ZSBpbiBzYW1lIGJvb2tpbmcgcmVzb3VyY2UgYWxsIHRoZSBkYXRlc1xyXG5cdFx0XHRcdFx0XHRcdFx0dmFyIG1lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnIDogKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0pKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsgJ3doZXJlJzogJ2FmdGVyJywgJ2pxX25vZGUnOiAnI2Jvb2tpbmdfZm9ybScgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdC8vIEVuYWJsZSBTdWJtaXQgfCBIaWRlIHNwaW4gbG9hZGVyXHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cclxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OlxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiID0gRm9yIGRlYnVnIG9ubHkgPyAtLSAgU2hvdyBNZXNzYWdlIHVuZGVyIHRoZSBmb3JtID0gXCIgID5cclxuXHRcdFx0XHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0pIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0ICYmICggJycgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApIClcclxuXHRcdFx0XHRcdFx0XHRcdCl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgY2FsZW5kYXJfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBqcV9ub2RlID0gJyNib29raW5nX2Zvcm0nICsgY2FsZW5kYXJfaWQ7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgYWp4X2FmdGVyX2Jvb2tpbmdfbWVzc2FnZSA9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCBhanhfYWZ0ZXJfYm9va2luZ19tZXNzYWdlICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHQvKipcclxuXHRcdFx0XHRcdFx0XHRcdFx0ICogLy8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0dmFyIGFqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGFqeF9hZnRlcl9ib29raW5nX21lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyA6ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdKSlcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICdpbmZvJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0XHQvLyBSZWFjdGl2YXRlIGNhbGVuZGFyIGFnYWluID9cclxuXHRcdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBVbnNlbGVjdCAgZGF0ZXNcclxuXHRcdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRcdC8vICdyZXNvdXJjZV9pZCcgICAgPT4gJHBhcmFtc1sncmVzb3VyY2VfaWQnXSxcclxuXHRcdFx0XHRcdFx0Ly8gJ2Jvb2tpbmdfaGFzaCcgICA9PiAkYm9va2luZ19oYXNoLFxyXG5cdFx0XHRcdFx0XHQvLyAncmVxdWVzdF91cmknICAgID0+ICRfU0VSVkVSWydSRVFVRVNUX1VSSSddLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSXMgaXQgdGhlIHNhbWUgYXMgd2luZG93LmxvY2F0aW9uLmhyZWYgb3JcclxuXHRcdFx0XHRcdFx0Ly8gJ2N1c3RvbV9mb3JtJyAgICA9PiAkcGFyYW1zWydjdXN0b21fZm9ybSddLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wdGlvbmFsLlxyXG5cdFx0XHRcdFx0XHQvLyAnYWdncmVnYXRlX3Jlc291cmNlX2lkX3N0cicgPT4gaW1wbG9kZSggJywnLCAkcGFyYW1zWydhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJ10gKSAgICAgLy8gT3B0aW9uYWwuIFJlc291cmNlIElEICAgZnJvbSAgYWdncmVnYXRlIHBhcmFtZXRlciBpbiBzaG9ydGNvZGUuXHJcblxyXG5cdFx0XHRcdFx0XHQvLyBMb2FkIG5ldyBkYXRhIGluIGNhbGVuZGFyLlxyXG5cdFx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAncmVzb3VyY2VfaWQnIDogcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdXHRcdFx0XHRcdFx0XHQvLyBJdCdzIGZyb20gcmVzcG9uc2UgLi4uQUpYX0JPT0tJTkdfX0NSRUFURSBvZiBpbml0aWFsIHNlbnQgcmVzb3VyY2VfaWRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfaGFzaCc6IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bJ2Jvb2tpbmdfaGFzaCddIFx0Ly8gPz8gd2UgY2FuIG5vdCB1c2UgaXQsICBiZWNhdXNlIEhBU0ggY2huYWdlZCBpbiBhbnkgIGNhc2UhXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdyZXF1ZXN0X3VyaScgOiByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWydyZXF1ZXN0X3VyaSddXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdjdXN0b21fZm9ybScgOiByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWydjdXN0b21fZm9ybSddXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQWdncmVnYXRlIGJvb2tpbmcgcmVzb3VyY2VzLCAgaWYgYW55ID9cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHInIDogX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJyApLmpvaW4oJywnKVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdC8vIEV4aXRcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIDwvZWRpdG9yLWZvbGQ+XHJcblxyXG5cclxuLypcclxuXHQvLyBTaG93IENhbGVuZGFyXHJcblx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RvcCggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBCb29raW5ncyAtIERhdGVzXHJcblx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWydkYXRlcyddICApO1xyXG5cclxuXHQvLyBCb29raW5ncyAtIENoaWxkIG9yIG9ubHkgc2luZ2xlIGJvb2tpbmcgcmVzb3VyY2UgaW4gZGF0ZXNcclxuXHRfd3BiYy5ib29raW5nX19zZXRfcGFyYW1fdmFsdWUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJywgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnIF0gKTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8vIFVwZGF0ZSBjYWxlbmRhclxyXG5cdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuKi9cclxuXHJcblx0XHRcdFx0XHQvLyBIaWRlIHNwaW4gbG9hZGVyXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX2hpZGUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEhpZGUgYm9va2luZyBmb3JtXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fYW5pbWF0ZWRfX2hpZGUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgQ29uZmlybWF0aW9uIHwgUGF5bWVudCBzZWN0aW9uXHJcblx0XHRcdFx0XHR3cGJjX3Nob3dfdGhhbmtfeW91X21lc3NhZ2VfYWZ0ZXJfYm9va2luZyggcmVzcG9uc2VfZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHR3cGJjX2RvX3Njcm9sbCggJyN3cGJjX3Njcm9sbF9wb2ludF8nICsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAxMCApO1xyXG5cdFx0XHRcdFx0fSwgNTAwICk7XHJcblxyXG5cclxuXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbChcclxuXHRcdFx0XHQgIC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiID0gVGhpcyBzZWN0aW9uIGV4ZWN1dGUsICB3aGVuICBOT05DRSBmaWVsZCB3YXMgbm90IHBhc3NlZCBvciBzb21lIGVycm9yIGhhcHBlbmVkIGF0ICBzZXJ2ZXIhID0gXCIgID5cclxuXHRcdFx0XHQgIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiAgTk9OQ0UgZmllbGQgd2FzIG5vdCBwYXNzZWQgb3Igc29tZSBlcnJvciBoYXBwZW5lZCBhdCAgc2VydmVyIVxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdFx0XHRcdC8vIEdldCBDb250ZW50IG9mIEVycm9yIE1lc3NhZ2VcclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnICg8Yj4nICsganFYSFIuc3RhdHVzICsgJzwvYj4pJztcclxuXHRcdFx0XHRcdFx0aWYgKDQwMyA9PSBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICc8YnI+IFByb2JhYmx5IG5vbmNlIGZvciB0aGlzIHBhZ2UgaGFzIGJlZW4gZXhwaXJlZC4gUGxlYXNlIDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDpsb2NhdGlvbi5yZWxvYWQoKTtcIj5yZWxvYWQgdGhlIHBhZ2U8L2E+Lic7XHJcblx0XHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnPGJyPiBPdGhlcndpc2UsIHBsZWFzZSBjaGVjayB0aGlzIDxhIHN0eWxlPVwiZm9udC13ZWlnaHQ6IDYwMDtcIiBocmVmPVwiaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vZmFxL3JlcXVlc3QtZG8tbm90LXBhc3Mtc2VjdXJpdHktY2hlY2svP2FmdGVyX3VwZGF0ZT0xMC4xLjFcIj50cm91Ymxlc2hvb3RpbmcgaW5zdHJ1Y3Rpb248L2E+Ljxicj4nXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdC8vIEVzY2FwZSB0YWdzIGluIEVycm9yIG1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnPGJyPjxzdHJvbmc+UmVzcG9uc2U8L3N0cm9uZz48ZGl2IHN0eWxlPVwicGFkZGluZzogMCAxMHB4O21hcmdpbjogMCAwIDEwcHg7Ym9yZGVyLXJhZGl1czozcHg7IGJveC1zaGFkb3c6MHB4IDBweCAxcHggI2EzYTNhMztcIj4nICsganFYSFIucmVzcG9uc2VUZXh0LnJlcGxhY2UoLyYvZywgXCImYW1wO1wiKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IC5yZXBsYWNlKC9cIi9nLCBcIiZxdW90O1wiKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAucmVwbGFjZSgvJy9nLCBcIiYjMzk7XCIpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Kyc8L2Rpdj4nO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGNhbGVuZGFyX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0dmFyIGpxX25vZGUgPSAnI2Jvb2tpbmdfZm9ybScgKyBjYWxlbmRhcl9pZDtcclxuXHJcblx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgLCB7ICd0eXBlJyAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIGNhbGVuZGFyX2lkICk7XHJcblx0XHRcdCAgXHQgfVxyXG5cdFx0XHRcdCAvLyA8L2VkaXRvci1mb2xkPlxyXG5cdFx0XHQgIClcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuXHQvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICAgICAgICAgICAgICAgICAgICAgZGVzYz1cIiAgPT0gIENBUFRDSEEgPT0gIFwiICA+XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZSBpbWFnZSBpbiBjYXB0Y2hhIGFuZCBzaG93IHdhcm5pbmcgbWVzc2FnZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHBhcmFtc1xyXG5cdCAqXHJcblx0ICogRXhhbXBsZSBvZiAncGFyYW1zJyA6IHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX2lkJzogcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLFxyXG5cdCAqXHRcdFx0XHRcdFx0XHQndXJsJyAgICAgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdjYXB0Y2hhX19zaW1wbGUnIF1bICd1cmwnIF0sXHJcblx0ICpcdFx0XHRcdFx0XHRcdCdjaGFsbGVuZ2UnICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2NhcHRjaGFfX3NpbXBsZScgXVsgJ2NoYWxsZW5nZScgXSxcclxuXHQgKlx0XHRcdFx0XHRcdFx0J21lc3NhZ2UnICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApXHJcblx0ICpcdFx0XHRcdFx0XHR9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYXB0Y2hhX19zaW1wbGVfX3VwZGF0ZSggcGFyYW1zICl7XHJcblxyXG5cdFx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkudmFsdWUgPSAnJztcclxuXHRcdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FwdGNoYV9pbWcnICsgcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gKS5zcmMgPSBwYXJhbXNbICd1cmwnIF07XHJcblx0XHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwZGV2X2NhcHRjaGFfY2hhbGxlbmdlXycgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApLnZhbHVlID0gcGFyYW1zWyAnY2hhbGxlbmdlJyBdO1xyXG5cclxuXHRcdC8vIFNob3cgd2FybmluZyBcdFx0QWZ0ZXIgQ0FQVENIQSBJbWdcclxuXHRcdHZhciBtZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICsgJyArIGltZycsIHBhcmFtc1sgJ21lc3NhZ2UnIF0gKTtcclxuXHJcblx0XHQvLyBBbmltYXRlXHJcblx0XHRqUXVlcnkoICcjJyArIG1lc3NhZ2VfaWQgKyAnLCAnICsgJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkuZmFkZU91dCggMzUwICkuZmFkZUluKCAzMDAgKS5mYWRlT3V0KCAzNTAgKS5mYWRlSW4oIDQwMCApLmFuaW1hdGUoIHtvcGFjaXR5OiAxfSwgNDAwMCApO1xyXG5cdFx0Ly8gRm9jdXMgdGV4dCAgZmllbGRcclxuXHRcdGpRdWVyeSggJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkudHJpZ2dlciggJ2ZvY3VzJyApOyAgICBcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA4LjcuMTEuMTJcclxuXHJcblxyXG5cdFx0Ly8gRW5hYmxlIFN1Ym1pdCB8IEhpZGUgc3BpbiBsb2FkZXJcclxuXHRcdHdwYmNfYm9va2luZ19mb3JtX19vbl9yZXNwb25zZV9fdWlfZWxlbWVudHNfZW5hYmxlKCBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIElmIHRoZSBjYXB0Y2hhIGVsZW1lbnRzIG5vdCBleGlzdCAgaW4gdGhlIGJvb2tpbmcgZm9ybSwgIHRoZW4gIHJlbW92ZSBwYXJhbWV0ZXJzIHJlbGF0aXZlIGNhcHRjaGFcclxuXHQgKiBAcGFyYW0gcGFyYW1zXHJcblx0ICogQHJldHVybnMgb2JqXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYXB0Y2hhX19zaW1wbGVfX21heWJlX3JlbW92ZV9pbl9hanhfcGFyYW1zKCBwYXJhbXMgKXtcclxuXHJcblx0XHRpZiAoICEgd3BiY19jYXB0Y2hhX19zaW1wbGVfX2lzX2V4aXN0X2luX2Zvcm0oIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkgKXtcclxuXHRcdFx0ZGVsZXRlIHBhcmFtc1sgJ2NhcHRjaGFfY2hhbGFuZ2UnIF07XHJcblx0XHRcdGRlbGV0ZSBwYXJhbXNbICdjYXB0Y2hhX3VzZXJfaW5wdXQnIF07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gcGFyYW1zO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrIGlmIENBUFRDSEEgZXhpc3QgaW4gdGhlIGJvb2tpbmcgZm9ybVxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FwdGNoYV9fc2ltcGxlX19pc19leGlzdF9pbl9mb3JtKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHJldHVybiAoXHJcblx0XHRcdFx0XHRcdCgwICE9PSBqUXVlcnkoICcjd3BkZXZfY2FwdGNoYV9jaGFsbGVuZ2VfJyArIHJlc291cmNlX2lkICkubGVuZ3RoKVxyXG5cdFx0XHRcdFx0IHx8ICgwICE9PSBqUXVlcnkoICcjY2FwdGNoYV9pbnB1dCcgKyByZXNvdXJjZV9pZCApLmxlbmd0aClcclxuXHRcdFx0XHQpO1xyXG5cdH1cclxuXHJcblx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHJcblxyXG5cdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiICA9PSAgU2VuZCBCdXR0b24gfCBGb3JtIFNwaW4gTG9hZGVyICA9PSAgXCIgID5cclxuXHJcblx0LyoqXHJcblx0ICogRGlzYWJsZSBTZW5kIGJ1dHRvbiAgfCAgU2hvdyBTcGluIExvYWRlclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX29uX3N1Ym1pdF9fdWlfZWxlbWVudHNfZGlzYWJsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHQvLyBEaXNhYmxlIFN1Ym1pdFxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19kaXNhYmxlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIFNob3cgU3BpbiBsb2FkZXIgaW4gYm9va2luZyBmb3JtXHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3coIHJlc291cmNlX2lkICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBFbmFibGUgU2VuZCBidXR0b24gIHwgICBIaWRlIFNwaW4gTG9hZGVyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZShyZXNvdXJjZV9pZCl7XHJcblxyXG5cdFx0Ly8gRW5hYmxlIFN1Ym1pdFxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19lbmFibGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gSGlkZSBTcGluIGxvYWRlciBpbiBib29raW5nIGZvcm1cclxuXHRcdHdwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9faGlkZSggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbmFibGUgU3VibWl0IGJ1dHRvblxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19zZW5kX2J1dHRvbl9fZW5hYmxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8gQWN0aXZhdGUgU2VuZCBidXR0b25cclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGlucHV0W3R5cGU9YnV0dG9uXScgKS5wcm9wKCBcImRpc2FibGVkXCIsIGZhbHNlICk7XHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyBidXR0b24nICkucHJvcCggXCJkaXNhYmxlZFwiLCBmYWxzZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGlzYWJsZSBTdWJtaXQgYnV0dG9uICBhbmQgc2hvdyAgc3BpblxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2Rpc2FibGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHQvLyBEaXNhYmxlIFNlbmQgYnV0dG9uXHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyBpbnB1dFt0eXBlPWJ1dHRvbl0nICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyBidXR0b24nICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXNhYmxlICdUaGlzJyBidXR0b25cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gX3RoaXNcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3RoaXNfYnV0dG9uX19kaXNhYmxlKCBfdGhpcyApe1xyXG5cclxuXHRcdFx0Ly8gRGlzYWJsZSBTZW5kIGJ1dHRvblxyXG5cdFx0XHRqUXVlcnkoIF90aGlzICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IGJvb2tpbmcgZm9ybSAgU3BpbiBMb2FkZXJcclxuXHRcdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3coIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHQvLyBTaG93IFNwaW4gTG9hZGVyXHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5hZnRlcihcclxuXHRcdFx0XHQnPGRpdiBpZD1cIndwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyJyArIHJlc291cmNlX2lkICsgJ1wiIGNsYXNzPVwid3BiY19ib29raW5nX2Zvcm1fc3Bpbl9sb2FkZXJcIiBzdHlsZT1cInBvc2l0aW9uOiByZWxhdGl2ZTtcIj48ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkZXJfd3JhcHBlclwiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl9taW5pXCI+PC9kaXY+PC9kaXY+PC9kaXY+J1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIC8gSGlkZSBib29raW5nIGZvcm0gIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8gUmVtb3ZlIFNwaW4gTG9hZGVyXHJcblx0XHRcdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlcicgKyByZXNvdXJjZV9pZCApLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhpZGUgYm9va2luZyBmb3JtIHd0aCBhbmltYXRpb25cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX2FuaW1hdGVkX19oaWRlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnNsaWRlVXAoICAxMDAwXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgZnVuY3Rpb24gKCl7XHJcblx0XHRcdC8vXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBpZiAoIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZ2F0ZXdheV9wYXltZW50X2Zvcm1zJyArIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApICE9IG51bGwgKXtcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFx0d3BiY19kb19zY3JvbGwoICcjc3VibWl0aW5nJyArIHJlc291cmNlX2lkICk7XHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB9IGVsc2VcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnBhcmVudCgpLmZpbmQoICcuc3VibWl0aW5nX2NvbnRlbnQnICkubGVuZ3RoID4gMCApe1xyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL3dwYmNfZG9fc2Nyb2xsKCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgKyAuc3VibWl0aW5nX2NvbnRlbnQnICk7XHJcblx0XHRcdC8vXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCB2YXIgaGlkZVRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgd3BiY19kb19zY3JvbGwoIGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5wYXJlbnQoKS5maW5kKCAnLnN1Ym1pdGluZ19jb250ZW50JyApLmdldCggMCApICk7XHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LCAxMDApO1xyXG5cdFx0XHQvL1xyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLmhpZGUoKTtcclxuXHJcblx0XHRcdC8vIHZhciBoaWRlVGltZW91dCA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHQvL1xyXG5cdFx0XHQvLyBcdGlmICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnBhcmVudCgpLmZpbmQoICcuc3VibWl0aW5nX2NvbnRlbnQnICkubGVuZ3RoID4gMCApe1xyXG5cdFx0XHQvLyBcdFx0dmFyIHJhbmRvbV9pZCA9IE1hdGguZmxvb3IoIChNYXRoLnJhbmRvbSgpICogMTAwMDApICsgMSApO1xyXG5cdFx0XHQvLyBcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLnBhcmVudCgpLmJlZm9yZSggJzxkaXYgaWQ9XCJzY3JvbGxfdG8nICsgcmFuZG9tX2lkICsgJ1wiPjwvZGl2PicgKTtcclxuXHRcdFx0Ly8gXHRcdGNvbnNvbGUubG9nKCBqUXVlcnkoICcjc2Nyb2xsX3RvJyArIHJhbmRvbV9pZCApICk7XHJcblx0XHRcdC8vXHJcblx0XHRcdC8vIFx0XHR3cGJjX2RvX3Njcm9sbCggJyNzY3JvbGxfdG8nICsgcmFuZG9tX2lkICk7XHJcblx0XHRcdC8vIFx0XHQvL3dwYmNfZG9fc2Nyb2xsKCBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkucGFyZW50KCkuZ2V0KCAwICkgKTtcclxuXHRcdFx0Ly8gXHR9XHJcblx0XHRcdC8vIH0sIDUwMCApO1xyXG5cdFx0fVxyXG5cdC8vIDwvZWRpdG9yLWZvbGQ+XHJcblxyXG5cclxuXHQvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICAgICAgICAgICAgICAgICAgICAgZGVzYz1cIiAgPT0gIE1pbmkgU3BpbiBMb2FkZXIgID09ICBcIiAgPlxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBwYXJlbnRfaHRtbF9pZFxyXG5cdFx0ICovXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IG1pY3JvIFNwaW4gTG9hZGVyXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIGlkXHRcdFx0XHRcdFx0SUQgb2YgTG9hZGVyLCAgZm9yIGxhdGVyICBoaWRlIGl0IGJ5ICB1c2luZyBcdFx0d3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19oaWRlKCBpZCApIE9SIHdwYmNfX3NwaW5fbG9hZGVyX19taW5pX19oaWRlKCBpZCApXHJcblx0XHQgKiBAcGFyYW0ganFfbm9kZV93aGVyZV9pbnNlcnRcdFx0c3VjaCBhcyAnI2VzdGltYXRlX2Jvb2tpbmdfbmlnaHRfY29zdF9oaW50MTAnICAgT1IgICcuZXN0aW1hdGVfYm9va2luZ19uaWdodF9jb3N0X2hpbnQxMCdcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19zaG93X19pbnNpZGUoIGlkICwganFfbm9kZV93aGVyZV9pbnNlcnQgKXtcclxuXHJcblx0XHRcdFx0d3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX3Nob3coIGlkLCB7XHJcblx0XHRcdFx0XHQnY29sb3InICA6ICcjNDQ0JyxcclxuXHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7XHJcblx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2luc2lkZScsXHJcblx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZV93aGVyZV9pbnNlcnRcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3Bvc2l0aW9uOiByZWxhdGl2ZTtkaXNwbGF5OiBpbmxpbmUtZmxleDtmbGV4LWZsb3c6IGNvbHVtbiBub3dyYXA7anVzdGlmeS1jb250ZW50OiBjZW50ZXI7YWxpZ24taXRlbXM6IGNlbnRlcjttYXJnaW46IDdweCAxMnB4OycsXHJcblx0XHRcdFx0XHQnY2xhc3MnICAgIDogJ3dwYmNfb25lX3NwaW5fbG9hZGVyX21pY3JvJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbW92ZSBzcGlubmVyXHJcblx0XHQgKiBAcGFyYW0gaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19oaWRlKCBpZCApe1xyXG5cdFx0ICAgIHdwYmNfX3NwaW5fbG9hZGVyX19taW5pX19oaWRlKCBpZCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgbWluaSBTcGluIExvYWRlclxyXG5cdFx0ICogQHBhcmFtIHBhcmVudF9odG1sX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfX3NwaW5fbG9hZGVyX19taW5pX19zaG93KCBwYXJlbnRfaHRtbF9pZCAsIHBhcmFtcyA9IHt9ICl7XHJcblxyXG5cdFx0XHR2YXIgcGFyYW1zX2RlZmF1bHQgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdCdjb2xvcicgICAgOiAnIzAwNzFjZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiAnJyxcdFx0XHRcdFx0Ly8gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcidcdFx0XHRcdC8vICdpbnNpZGUnIHwgJ2JlZm9yZScgfCAnYWZ0ZXInIHwgJ3JpZ2h0JyB8ICdsZWZ0J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3Bvc2l0aW9uOiByZWxhdGl2ZTttaW4taGVpZ2h0OiAyLjhyZW07JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2NsYXNzJyAgICA6ICd3cGJjX29uZV9zcGluX2xvYWRlcl9taW5pIDB3cGJjX3NwaW5zX2xvYWRlcl9taW5pJ1xyXG5cdFx0XHRcdFx0XHRcdFx0fTtcclxuXHRcdFx0Zm9yICggdmFyIHBfa2V5IGluIHBhcmFtcyApe1xyXG5cdFx0XHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcGFyYW1zWyBwX2tleSBdO1xyXG5cdFx0XHR9XHJcblx0XHRcdHBhcmFtcyA9IHBhcmFtc19kZWZhdWx0O1xyXG5cclxuXHRcdFx0aWYgKCAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocGFyYW1zWydjb2xvciddKSkgJiYgKCcnICE9IHBhcmFtc1snY29sb3InXSkgKXtcclxuXHRcdFx0XHRwYXJhbXNbJ2NvbG9yJ10gPSAnYm9yZGVyLWNvbG9yOicgKyBwYXJhbXNbJ2NvbG9yJ10gKyAnOyc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBzcGlubmVyX2h0bWwgPSAnPGRpdiBpZD1cIndwYmNfbWluaV9zcGluX2xvYWRlcicgKyBwYXJlbnRfaHRtbF9pZCArICdcIiBjbGFzcz1cIndwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyXCIgc3R5bGU9XCInICsgcGFyYW1zWyAnc3R5bGUnIF0gKyAnXCI+PGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXJcIj48ZGl2IGNsYXNzPVwiJyArIHBhcmFtc1sgJ2NsYXNzJyBdICsgJ1wiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ2NvbG9yJyBdICsgJ1wiPjwvZGl2PjwvZGl2PjwvZGl2Pic7XHJcblxyXG5cdFx0XHRpZiAoICcnID09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKXtcclxuXHRcdFx0XHRwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdID0gJyMnICsgcGFyZW50X2h0bWxfaWQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNob3cgU3BpbiBMb2FkZXJcclxuXHRcdFx0aWYgKCAnYWZ0ZXInID09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblx0XHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYWZ0ZXIoIHNwaW5uZXJfaHRtbCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmh0bWwoIHNwaW5uZXJfaHRtbCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgLyBIaWRlIG1pbmkgU3BpbiBMb2FkZXJcclxuXHRcdCAqIEBwYXJhbSBwYXJlbnRfaHRtbF9pZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX19zcGluX2xvYWRlcl9fbWluaV9faGlkZSggcGFyZW50X2h0bWxfaWQgKXtcclxuXHJcblx0XHRcdC8vIFJlbW92ZSBTcGluIExvYWRlclxyXG5cdFx0XHRqUXVlcnkoICcjd3BiY19taW5pX3NwaW5fbG9hZGVyJyArIHBhcmVudF9odG1sX2lkICkucmVtb3ZlKCk7XHJcblx0XHR9XHJcblxyXG5cdC8vIDwvZWRpdG9yLWZvbGQ+XHJcblxyXG4vL1RPRE86IHdoYXQgIGFib3V0IHNob3dpbmcgb25seSAgVGhhbmsgeW91LiBtZXNzYWdlIHdpdGhvdXQgcGF5bWVudCBmb3Jtcy5cclxuLyoqXHJcbiAqIFNob3cgJ1RoYW5rIHlvdScuIG1lc3NhZ2UgYW5kIHBheW1lbnQgZm9ybXNcclxuICpcclxuICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2hvd190aGFua195b3VfbWVzc2FnZV9hZnRlcl9ib29raW5nKCByZXNwb25zZV9kYXRhICl7XHJcblxyXG5cdGlmIChcclxuIFx0XHQgICAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9pc19yZWRpcmVjdCcgXSkpXHJcblx0XHQmJiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV91cmwnIF0pKVxyXG5cdFx0JiYgKCdwYWdlJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X2lzX3JlZGlyZWN0JyBdKVxyXG5cdFx0JiYgKCcnICE9IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfdXJsJyBdKVxyXG5cdCl7XHJcblx0XHRqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2Jvb2tpbmdfY3JlYXRlZCcsIFsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICwgcmVzcG9uc2VfZGF0YSBdICk7XHRcdFx0Ly9GaXhJbjogMTAuMC4wLjMwXHJcblx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfdXJsJyBdO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyIHJlc291cmNlX2lkID0gcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdXHJcblx0dmFyIGNvbmZpcm1fY29udGVudCA9Jyc7XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdID0gJyc7XHJcblx0fVxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb24nIF0gKSApe1xyXG5cdFx0IFx0XHRcdCAgXHRcdFx0IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uJyBdID0gJyc7XHJcblx0fVxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0gKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0gPSAnJztcclxuXHR9XHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfZ2F0ZXdheXMnIF0gKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X2dhdGV3YXlzJyBdID0gJyc7XHJcblx0fVxyXG5cdHZhciB0eV9tZXNzYWdlX2hpZGUgXHRcdFx0XHRcdFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdKSA/ICd3cGJjX3R5X2hpZGUnIDogJyc7XHJcblx0dmFyIHR5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbl9oaWRlIFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb24nIF0ucmVwbGFjZSggL1xcXFxuL2csICcnICkpID8gJ3dwYmNfdHlfaGlkZScgOiAnJztcclxuXHR2YXIgdHlfYm9va2luZ19jb3N0c19oaWRlIFx0XHRcdFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0pID8gJ3dwYmNfdHlfaGlkZScgOiAnJztcclxuXHR2YXIgdHlfcGF5bWVudF9nYXRld2F5c19oaWRlIFx0XHRcdD0gKCcnID09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9nYXRld2F5cycgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKSkgPyAnd3BiY190eV9oaWRlJyA6ICcnO1xyXG5cclxuXHRpZiAoICd3cGJjX3R5X2hpZGUnICE9IHR5X3BheW1lbnRfZ2F0ZXdheXNfaGlkZSApe1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdHlfX2NvbnRlbnRfdGV4dC53cGJjX3R5X19jb250ZW50X2dhdGV3YXlzJyApLmh0bWwoICcnICk7XHQvLyBSZXNldCAgYWxsICBvdGhlciBwb3NzaWJsZSBnYXRld2F5cyBiZWZvcmUgc2hvd2luZyBuZXcgb25lLlxyXG5cdH1cclxuXHJcblx0Y29uZmlybV9jb250ZW50ICs9IGA8ZGl2IGlkPVwid3BiY19zY3JvbGxfcG9pbnRfJHtyZXNvdXJjZV9pZH1cIj48L2Rpdj5gO1xyXG5cdGNvbmZpcm1fY29udGVudCArPSBgICA8ZGl2IGNsYXNzPVwid3BiY19hZnRlcl9ib29raW5nX3RoYW5rX3lvdV9zZWN0aW9uXCI+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICA8ZGl2IGNsYXNzPVwid3BiY190eV9fbWVzc2FnZSAke3R5X21lc3NhZ2VfaGlkZX1cIj4ke3Jlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfbWVzc2FnZScgXX08L2Rpdj5gO1xyXG4gICAgY29uZmlybV9jb250ZW50ICs9IGAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRhaW5lclwiPmA7XHJcblx0aWYgKCAnJyAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlX2Jvb2tpbmdfaWQnIF0gKXtcclxuXHRcdGNvbmZpcm1fY29udGVudCArPSBgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2hlYWRlclwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlX2Jvb2tpbmdfaWQnIF19PC9kaXY+YDtcclxuXHR9XHJcbiAgICBjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50XCI+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX3R5X19wYXltZW50X2Rlc2NyaXB0aW9uICR7dHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uX2hpZGV9XCI+JHtyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbicgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKX08L2Rpdj5gO1xyXG5cdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfY3VzdG9tZXJfZGV0YWlscycgXSApe1xyXG5cdFx0Y29uZmlybV9jb250ZW50ICs9IGAgICAgICBcdDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50X3RleHQgd3BiY19jb2xzXzJcIj4ke3Jlc3BvbnNlX2RhdGFbJ2FqeF9jb25maXJtYXRpb24nXVsndHlfY3VzdG9tZXJfZGV0YWlscyddfTwvZGl2PmA7XHJcblx0fVxyXG5cdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfYm9va2luZ19kZXRhaWxzJyBdICl7XHJcblx0XHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgIFx0PGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX2NvbHNfMlwiPiR7cmVzcG9uc2VfZGF0YVsnYWp4X2NvbmZpcm1hdGlvbiddWyd0eV9ib29raW5nX2RldGFpbHMnXX08L2Rpdj5gO1xyXG5cdH1cclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX3R5X19jb250ZW50X2Nvc3RzICR7dHlfYm9va2luZ19jb3N0c19oaWRlfVwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9ib29raW5nX2Nvc3RzJyBdfTwvZGl2PmA7XHJcblx0Y29uZmlybV9jb250ZW50ICs9IGAgICAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50X3RleHQgd3BiY190eV9fY29udGVudF9nYXRld2F5cyAke3R5X3BheW1lbnRfZ2F0ZXdheXNfaGlkZX1cIj4ke3Jlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9nYXRld2F5cycgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKS5yZXBsYWNlKCAvYWpheF9zY3JpcHQvZ2ksICdzY3JpcHQnICl9PC9kaXY+YDtcclxuICAgIGNvbmZpcm1fY29udGVudCArPSBgICAgICAgPC9kaXY+YDtcclxuICAgIGNvbmZpcm1fY29udGVudCArPSBgICAgIDwvZGl2PmA7XHJcblx0Y29uZmlybV9jb250ZW50ICs9IGA8L2Rpdj5gO1xyXG5cclxuIFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLmFmdGVyKCBjb25maXJtX2NvbnRlbnQgKTtcclxuXHJcblxyXG5cdC8vRml4SW46IDEwLjAuMC4zMFx0XHQvLyBldmVudCBuYW1lXHRcdFx0Ly8gUmVzb3VyY2UgSURcdC1cdCcxJ1xyXG5cdGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggJ3dwYmNfYm9va2luZ19jcmVhdGVkJywgWyByZXNvdXJjZV9pZCAsIHJlc3BvbnNlX2RhdGEgXSApO1xyXG5cdC8vIFRvIGNhdGNoIHRoaXMgZXZlbnQ6IGpRdWVyeSggJ2JvZHknICkub24oJ3dwYmNfYm9va2luZ19jcmVhdGVkJywgZnVuY3Rpb24oIGV2ZW50LCByZXNvdXJjZV9pZCwgcGFyYW1zICkgeyBjb25zb2xlLmxvZyggZXZlbnQsIHJlc291cmNlX2lkLCBwYXJhbXMgKTsgfSApO1xyXG59XHJc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
