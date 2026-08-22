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
    var is_valid_response = typeof response_data === 'object' && response_data !== null && !Array.isArray(response_data) && Object.prototype.hasOwnProperty.call(response_data, 'resource_id') && typeof response_data['ajx_data'] === 'object' && response_data['ajx_data'] !== null && !Array.isArray(response_data['ajx_data']) && typeof response_data['ajx_data']['status'] === 'string';
    if (!is_valid_response) {
      var calendar_id = wpbc_get_resource_id__from_ajx_post_data_url(this.data);
      var jq_node = '#booking_form' + calendar_id;
      var response_error_message = _wpbc.get_message('message_unexpected_server_response') || 'The server returned an unexpected response. Please reload the page and try again.';
      wpbc_front_end__log_unexpected_ajax_response('WPBC_AJX_BOOKING__CREATE', response_data, jqXHR, textStatus, 'Invalid response structure');
      wpbc_front_end__show_message(response_error_message, {
        'type': 'error',
        'show_here': {
          'jq_node': jq_node,
          'where': 'after'
        },
        'is_append': true,
        'style': 'text-align:left;',
        'content_mode': 'text',
        'delay': 0
      });
      wpbc_booking_form__on_response__ui_elements_enable(calendar_id);
      return;
    }
    console.log(' == Response WPBC_AJX_BOOKING__CREATE == ');
    for (var obj_key in response_data) {
      console.groupCollapsed('==' + obj_key + '==');
      console.log(' : ' + obj_key + ' : ', response_data[obj_key]);
      console.groupEnd();
    }
    console.groupEnd();

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
            'message': response_data['ajx_data']['ajx_after_action_message']
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
            wpbc_front_end__show_message(ajx_after_booking_message, {
              'type': 'undefined' !== typeof response_data['ajx_data']['ajx_after_action_message_status'] ? response_data['ajx_data']['ajx_after_action_message_status'] : 'warning',
              'delay': 0,
              'show_here': {
                'jq_node': jq_node,
                'where': 'after'
              }
            });
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

    // Trigger hook after a booking was created or updated successfully.
    jQuery('body').trigger('wpbc_booking_form_submit_success', [response_data['resource_id'], response_data, params]);
    setTimeout(function () {
      wpbc_do_scroll('#wpbc_scroll_point_' + response_data['resource_id'], 10);
    }, 500);
  }).fail(
  // <editor-fold     defaultstate="collapsed"                        desc=" = This section execute,  when  NONCE field was not passed or some error happened at  server! = "  >
  function (jqXHR, textStatus, errorThrown) {
    wpbc_front_end__log_unexpected_ajax_response('WPBC_AJX_BOOKING__CREATE', jqXHR.responseText || '', jqXHR, textStatus, errorThrown);

    // -------------------------------------------------------------------------------------------------
    // This section execute,  when  NONCE field was not passed or some error happened at  server!
    // -------------------------------------------------------------------------------------------------

    var error_message = _wpbc.get_message('message_unexpected_server_response') || 'The server returned an unexpected response. Please reload the page and try again.';
    if (jqXHR.status) {
      error_message += ' (' + parseInt(jqXHR.status, 10) + ')';
    }
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
      'content_mode': 'text',
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
  var message_id = wpbc_front_end__show_message__warning('#captcha_input' + params['resource_id'] + ' + img', params['message'], 'text');

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
  var $form_container = jQuery('#booking_form_div' + resource_id);
  var loader_text = 'Saving';
  if ('undefined' !== typeof _wpbc && _wpbc.get_message) {
    loader_text = _wpbc.get_message('message_booking_saving') || loader_text;
  }
  var loader_html = '<div id="wpbc_booking_form_spin_loader' + resource_id + '" class="wpbc_booking_form_spin_loader wpbc_booking_form_submit_overlay" aria-live="polite" aria-hidden="false">' + '<div class="wpbc_spins_loading_container">' + '<div class="wpbc_booking_form_spin_loader"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_spin_loader_one_new"></div></div></div>' + '<span>' + loader_text + '...</span>' + '</div>' + '</div>';

  // Remove any previous inline loader before adding the submit overlay.
  jQuery('#wpbc_booking_form_spin_loader' + resource_id).remove();
  if ($form_container.length && $form_container.is(':visible')) {
    $form_container.addClass('wpbc_booking_form_is_submitting');
    $form_container.prepend(loader_html);
    return;
  }

  // Fallback for any unexpected legacy markup without #booking_form_div{resource_id}.
  jQuery('#booking_form' + resource_id).after('<div id="wpbc_booking_form_spin_loader' + resource_id + '" class="wpbc_booking_form_spin_loader" style="position: relative;"><div class="wpbc_spins_loader_wrapper"><div class="wpbc_spin_loader_one_new"></div></div></div>');
}

/**
 * Remove / Hide booking form  Spin Loader
 * @param resource_id
 */
function wpbc_booking_form__spin_loader__hide(resource_id) {
  // Remove Spin Loader
  jQuery('#wpbc_booking_form_spin_loader' + resource_id).remove();
  jQuery('#booking_form_div' + resource_id).removeClass('wpbc_booking_form_is_submitting');
}

/**
 * Hide booking form wth animation
 *
 * @param resource_id
 */
function wpbc_booking_form__animated__hide(resource_id) {
  jQuery('#booking_form' + resource_id).hide();
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
function wpbc__spin_loader__mini__show(parent_html_id, params = {}) {
  var params_default = {
    'color': '#0071ce',
    'show_here': {
      'jq_node': '',
      // any jQuery node definition
      'where': 'after' // 'inside' | 'before' | 'after' | 'right' | 'left'
    },
    'style': 'position: relative;min-height: 2.8rem;',
    'class': 'wpbc_one_spin_loader_mini 0wpbc_spin_loader_one_new'
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
  confirm_content += `<div id="wpbc_scroll_point_${resource_id}"></div>`;
  confirm_content += `  <div class="wpbc_after_booking_thank_you_section">`;
  confirm_content += `    <div class="wpbc_ty__message ${ty_message_hide}">${response_data['ajx_confirmation']['ty_message']}</div>`;
  confirm_content += `    <div class="wpbc_ty__container">`;
  if ('' !== response_data['ajx_confirmation']['ty_message_booking_id']) {
    confirm_content += `      <div class="wpbc_ty__header">${response_data['ajx_confirmation']['ty_message_booking_id']}</div>`;
  }
  confirm_content += `      <div class="wpbc_ty__content">`;
  confirm_content += `        <div class="wpbc_ty__content_text wpbc_ty__payment_description ${ty_payment_payment_description_hide}">${response_data['ajx_confirmation']['ty_payment_payment_description'].replace(/\\n/g, '')}</div>`;
  if ('' !== response_data['ajx_confirmation']['ty_customer_details']) {
    confirm_content += `      	<div class="wpbc_ty__content_text wpbc_cols_2">${response_data['ajx_confirmation']['ty_customer_details']}</div>`;
  }
  if ('' !== response_data['ajx_confirmation']['ty_booking_details']) {
    confirm_content += `      	<div class="wpbc_ty__content_text wpbc_cols_2">${response_data['ajx_confirmation']['ty_booking_details']}</div>`;
  }
  confirm_content += `        <div class="wpbc_ty__content_text wpbc_ty__content_costs ${ty_booking_costs_hide}">${response_data['ajx_confirmation']['ty_booking_costs']}</div>`;
  confirm_content += `        <div class="wpbc_ty__content_text wpbc_ty__content_gateways ${ty_payment_gateways_hide}">${response_data['ajx_confirmation']['ty_payment_gateways'].replace(/\\n/g, '').replace(/ajax_script/gi, 'script')}</div>`;
  confirm_content += `      </div>`;
  confirm_content += `    </div>`;
  confirm_content += `</div>`;
  jQuery('#booking_form' + resource_id).after(confirm_content);

  //FixIn: 10.0.0.30		// event name			// Resource ID	-	'1'
  jQuery('body').trigger('wpbc_booking_created', [resource_id, response_data]);
  // To catch this event: jQuery( 'body' ).on('wpbc_booking_created', function( event, resource_id, params ) { console.log( event, resource_id, params ); } );
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX2NhcGFjaXR5L19vdXQvY3JlYXRlX2Jvb2tpbmcuanMiLCJuYW1lcyI6WyJ3cGJjX2FqeF9ib29raW5nX19jcmVhdGUiLCJwYXJhbXMiLCJjb25zb2xlIiwiZ3JvdXBDb2xsYXBzZWQiLCJsb2ciLCJncm91cEVuZCIsIndwYmNfY2FwdGNoYV9fc2ltcGxlX19tYXliZV9yZW1vdmVfaW5fYWp4X3BhcmFtcyIsImpRdWVyeSIsInRyaWdnZXIiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJfd3BiYyIsImdldF9zZWN1cmVfcGFyYW0iLCJub25jZSIsIndwYmNfYWp4X2xvY2FsZSIsImNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImlzX3ZhbGlkX3Jlc3BvbnNlIiwiQXJyYXkiLCJpc0FycmF5IiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiY2FsZW5kYXJfaWQiLCJ3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCIsImRhdGEiLCJqcV9ub2RlIiwicmVzcG9uc2VfZXJyb3JfbWVzc2FnZSIsImdldF9tZXNzYWdlIiwid3BiY19mcm9udF9lbmRfX2xvZ191bmV4cGVjdGVkX2FqYXhfcmVzcG9uc2UiLCJ3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlIiwid3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUiLCJvYmpfa2V5Iiwid3BiY19jYXB0Y2hhX19zaW1wbGVfX3VwZGF0ZSIsIm1lc3NhZ2VfaWQiLCJyZXBsYWNlIiwiYWp4X2FmdGVyX2Jvb2tpbmdfbWVzc2FnZSIsIndwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyIsIndwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4IiwiYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlIiwiam9pbiIsIndwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9faGlkZSIsIndwYmNfYm9va2luZ19mb3JtX19hbmltYXRlZF9faGlkZSIsIndwYmNfc2hvd190aGFua195b3VfbWVzc2FnZV9hZnRlcl9ib29raW5nIiwic2V0VGltZW91dCIsIndwYmNfZG9fc2Nyb2xsIiwiZmFpbCIsImVycm9yVGhyb3duIiwicmVzcG9uc2VUZXh0IiwiZXJyb3JfbWVzc2FnZSIsInN0YXR1cyIsInBhcnNlSW50IiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsInZhbHVlIiwic3JjIiwid3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyIsImZhZGVPdXQiLCJmYWRlSW4iLCJhbmltYXRlIiwib3BhY2l0eSIsIndwYmNfY2FwdGNoYV9fc2ltcGxlX19pc19leGlzdF9pbl9mb3JtIiwicmVzb3VyY2VfaWQiLCJsZW5ndGgiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fb25fc3VibWl0X191aV9lbGVtZW50c19kaXNhYmxlIiwid3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19kaXNhYmxlIiwid3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19zaG93Iiwid3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19lbmFibGUiLCJwcm9wIiwid3BiY19ib29raW5nX2Zvcm1fX3RoaXNfYnV0dG9uX19kaXNhYmxlIiwiX3RoaXMiLCIkZm9ybV9jb250YWluZXIiLCJsb2FkZXJfdGV4dCIsImxvYWRlcl9odG1sIiwicmVtb3ZlIiwiaXMiLCJhZGRDbGFzcyIsInByZXBlbmQiLCJhZnRlciIsInJlbW92ZUNsYXNzIiwiaGlkZSIsIndwYmNfX3NwaW5fbG9hZGVyX19taWNyb19fc2hvd19faW5zaWRlIiwiaWQiLCJqcV9ub2RlX3doZXJlX2luc2VydCIsIndwYmNfX3NwaW5fbG9hZGVyX19taW5pX19zaG93Iiwid3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19oaWRlIiwid3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUiLCJwYXJlbnRfaHRtbF9pZCIsInBhcmFtc19kZWZhdWx0IiwicF9rZXkiLCJzcGlubmVyX2h0bWwiLCJodG1sIiwid2luZG93IiwibG9jYXRpb24iLCJocmVmIiwiY29uZmlybV9jb250ZW50IiwidHlfbWVzc2FnZV9oaWRlIiwidHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uX2hpZGUiLCJ0eV9ib29raW5nX2Nvc3RzX2hpZGUiLCJ0eV9wYXltZW50X2dhdGV3YXlzX2hpZGUiXSwic291cmNlcyI6WyJpbmNsdWRlcy9fY2FwYWNpdHkvX3NyYy9jcmVhdGVfYm9va2luZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSAgQSBqIGEgeCAgICBBIGQgZCAgICBOIGUgdyAgICBCIG8gbyBrIGkgbiBnICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG4vKipcclxuICogU3VibWl0IG5ldyBib29raW5nXHJcbiAqXHJcbiAqIEBwYXJhbSBwYXJhbXMgICA9ICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3Jlc291cmNlX2lkJyAgICAgICAgOiByZXNvdXJjZV9pZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZGF0ZXNfZGRtbXl5X2NzdicgICA6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2Zvcm1kYXRhJyAgICAgICAgICAgOiBmb3JtZGF0YSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnYm9va2luZ19oYXNoJyAgICAgICA6IG15X2Jvb2tpbmdfaGFzaCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY3VzdG9tX2Zvcm0nICAgICAgICA6IG15X2Jvb2tpbmdfZm9ybSxcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NhcHRjaGFfY2hhbGFuZ2UnICAgOiBjYXB0Y2hhX2NoYWxhbmdlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjYXB0Y2hhX3VzZXJfaW5wdXQnIDogdXNlcl9jYXB0Y2hhLFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnaXNfZW1haWxzX3NlbmQnICAgICA6IGlzX3NlbmRfZW1laWxzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdhY3RpdmVfbG9jYWxlJyAgICAgIDogd3BkZXZfYWN0aXZlX2xvY2FsZVxyXG5cdFx0XHRcdFx0XHR9XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19jcmVhdGUoIHBhcmFtcyApe1xyXG5cclxuXHRjb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfQk9PS0lOR19fQ1JFQVRFJyApO1xyXG5cdGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICc9PSBCZWZvcmUgQWpheCBTZW5kID09JyApO1xyXG5cdGNvbnNvbGUubG9nKCBwYXJhbXMgKTtcclxuXHRjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdHBhcmFtcyA9IHdwYmNfY2FwdGNoYV9fc2ltcGxlX19tYXliZV9yZW1vdmVfaW5fYWp4X3BhcmFtcyggcGFyYW1zICk7XHJcblxyXG5cdC8vIFRyaWdnZXIgaG9vayAgYmVmb3JlIHNlbmRpbmcgcmVxdWVzdCAgdG8gIGNyZWF0ZSB0aGUgYm9va2luZy5cclxuXHRqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2JlZm9yZV9ib29raW5nX2NyZWF0ZScsIFsgcGFyYW1zWydyZXNvdXJjZV9pZCddLCBwYXJhbXMgXSApO1xyXG5cclxuXHQvLyBTdGFydCBBamF4LlxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0e1xyXG5cdFx0XHRhY3Rpb24gICAgICAgICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfX0NSRUFURScsXHJcblx0XHRcdHdwYmNfYWp4X3VzZXJfaWQgICAgICAgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAndXNlcl9pZCcgKSxcclxuXHRcdFx0bm9uY2UgICAgICAgICAgICAgICAgICA6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0d3BiY19hanhfbG9jYWxlICAgICAgICA6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICksXHJcblx0XHRcdGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zOiBwYXJhbXMsXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiAgVXN1YWxseSAgcGFyYW1zID0geyAncmVzb3VyY2VfaWQnICAgICAgICA6IHJlc291cmNlX2lkLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdkYXRlc19kZG1teXlfY3N2JyAgIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWx1ZSxcclxuXHRcdFx0ICpcdFx0XHRcdFx0XHQnZm9ybWRhdGEnICAgICAgICAgICA6IGZvcm1kYXRhLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdib29raW5nX2hhc2gnICAgICAgIDogbXlfYm9va2luZ19oYXNoLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdjdXN0b21fZm9ybScgICAgICAgIDogbXlfYm9va2luZ19mb3JtLFxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdjYXB0Y2hhX2NoYWxhbmdlJyAgIDogY2FwdGNoYV9jaGFsYW5nZSxcclxuXHRcdFx0ICpcdFx0XHRcdFx0XHQndXNlcl9jYXB0Y2hhJyAgICAgICA6IHVzZXJfY2FwdGNoYSxcclxuXHRcdFx0ICpcclxuXHRcdFx0ICpcdFx0XHRcdFx0XHQnaXNfZW1haWxzX3NlbmQnICAgICA6IGlzX3NlbmRfZW1laWxzLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdhY3RpdmVfbG9jYWxlJyAgICAgIDogd3BkZXZfYWN0aXZlX2xvY2FsZVxyXG5cdFx0XHQgKlx0XHRcdFx0fVxyXG5cdFx0XHQgKi9cclxuXHRcdH0sXHJcblxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcblx0XHRcdFx0XHR2YXIgaXNfdmFsaWRfcmVzcG9uc2UgPSAoXG5cdFx0XHRcdFx0XHRcdCh0eXBlb2YgcmVzcG9uc2VfZGF0YSA9PT0gJ29iamVjdCcpXG5cdFx0XHRcdFx0XHQgJiYgKHJlc3BvbnNlX2RhdGEgIT09IG51bGwpXG5cdFx0XHRcdFx0XHQgJiYgKCEgQXJyYXkuaXNBcnJheSggcmVzcG9uc2VfZGF0YSApKVxuXHRcdFx0XHRcdFx0ICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcmVzcG9uc2VfZGF0YSwgJ3Jlc291cmNlX2lkJyApXG5cdFx0XHRcdFx0XHQgJiYgKHR5cGVvZiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0gPT09ICdvYmplY3QnKVxuXHRcdFx0XHRcdFx0ICYmIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0gIT09IG51bGwpXG5cdFx0XHRcdFx0XHQgJiYgKCEgQXJyYXkuaXNBcnJheSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdICkpXG5cdFx0XHRcdFx0XHQgJiYgKHR5cGVvZiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdzdGF0dXMnIF0gPT09ICdzdHJpbmcnKVxuXHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRpZiAoICEgaXNfdmFsaWRfcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0XHR2YXIgY2FsZW5kYXJfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XG5cdFx0XHRcdFx0XHR2YXIganFfbm9kZSA9ICcjYm9va2luZ19mb3JtJyArIGNhbGVuZGFyX2lkO1xuXHRcdFx0XHRcdFx0dmFyIHJlc3BvbnNlX2Vycm9yX21lc3NhZ2UgPSBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfdW5leHBlY3RlZF9zZXJ2ZXJfcmVzcG9uc2UnICkgfHwgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5leHBlY3RlZCByZXNwb25zZS4gUGxlYXNlIHJlbG9hZCB0aGUgcGFnZSBhbmQgdHJ5IGFnYWluLic7XG5cblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19sb2dfdW5leHBlY3RlZF9hamF4X3Jlc3BvbnNlKCAnV1BCQ19BSlhfQk9PS0lOR19fQ1JFQVRFJywgcmVzcG9uc2VfZGF0YSwganFYSFIsIHRleHRTdGF0dXMsICdJbnZhbGlkIHJlc3BvbnNlIHN0cnVjdHVyZScgKTtcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2Vycm9yX21lc3NhZ2UsIHsgJ3R5cGUnICAgICAgICA6ICdlcnJvcicsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCcgICA6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnOiAndGV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgOiAwXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggY2FsZW5kYXJfaWQgKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0JPT0tJTkdfX0NSRUFURSA9PSAnICk7XG5mb3IgKCB2YXIgb2JqX2tleSBpbiByZXNwb25zZV9kYXRhICl7XG5cdGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICc9PScgKyBvYmpfa2V5ICsgJz09JyApO1xyXG5cdGNvbnNvbGUubG9nKCAnIDogJyArIG9ial9rZXkgKyAnIDogJywgcmVzcG9uc2VfZGF0YVsgb2JqX2tleSBdICk7XHJcblx0Y29uc29sZS5ncm91cEVuZCgpO1xyXG59XHJcbmNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblxyXG5cdFx0XHRcdFx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgZGVzYz1cIiAgPT0gIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiB3ZSBoYXZlIEtOT1dOIGVycm9ycyBmcm9tIEJvb2tpbmcgQ2FsZW5kYXIuICAtPiAgRV9YX0lfVCAgXCIgID5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiB3ZSBoYXZlIEtOT1dOIGVycm9ycyBmcm9tIEJvb2tpbmcgQ2FsZW5kYXJcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRcdFx0XHRpZiAoICdvaycgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnc3RhdHVzJyBdICkge1xyXG5cclxuXHRcdFx0XHRcdFx0c3dpdGNoICggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnc3RhdHVzX2Vycm9yJyBdICl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2NhcHRjaGFfc2ltcGxlX3dyb25nJzpcclxuXHRcdFx0XHRcdFx0XHRcdHdwYmNfY2FwdGNoYV9fc2ltcGxlX191cGRhdGUoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnOiByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VybCcgICAgICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnY2FwdGNoYV9fc2ltcGxlJyBdWyAndXJsJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjaGFsbGVuZ2UnICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2NhcHRjaGFfX3NpbXBsZScgXVsgJ2NoYWxsZW5nZScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J21lc3NhZ2UnICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNhc2UgJ3Jlc291cmNlX2lkX2luY29ycmVjdCc6XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBTaG93IEVycm9yIE1lc3NhZ2UgLSBpbmNvcnJlY3QgIGJvb2tpbmcgcmVzb3VyY2UgSUQgZHVyaW5nIHN1Ym1pdCBvZiBib29raW5nLlxyXG5cdFx0XHRcdFx0XHRcdFx0dmFyIG1lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnIDogKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0pKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsgJ3doZXJlJzogJ2FmdGVyJywgJ2pxX25vZGUnOiAnI2Jvb2tpbmdfZm9ybScgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2Jvb2tpbmdfY2FuX25vdF9zYXZlJzpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFdlIGNhbiBub3Qgc2F2ZSBib29raW5nLCBiZWNhdXNlIGRhdGVzIGFyZSBib29rZWQgb3IgY2FuIG5vdCBzYXZlIGluIHNhbWUgYm9va2luZyByZXNvdXJjZSBhbGwgdGhlIGRhdGVzXHJcblx0XHRcdFx0XHRcdFx0XHR2YXIgbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgOiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSkpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeyAnd2hlcmUnOiAnYWZ0ZXInLCAnanFfbm9kZSc6ICcjYm9va2luZ19mb3JtJyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gRW5hYmxlIFN1Ym1pdCB8IEhpZGUgc3BpbiBsb2FkZXJcclxuXHRcdFx0XHRcdFx0XHRcdHdwYmNfYm9va2luZ19mb3JtX19vbl9yZXNwb25zZV9fdWlfZWxlbWVudHNfZW5hYmxlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcclxuXHJcblxyXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2M9XCIgPSBGb3IgZGVidWcgb25seSA/IC0tICBTaG93IE1lc3NhZ2UgdW5kZXIgdGhlIGZvcm0gPSBcIiAgPlxyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXSkgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHQgJiYgKCAnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICkgKVxyXG5cdFx0XHRcdFx0XHRcdFx0KXtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBjYWxlbmRhcl9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCB0aGlzLmRhdGEgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGpxX25vZGUgPSAnI2Jvb2tpbmdfZm9ybScgKyBjYWxlbmRhcl9pZDtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBhanhfYWZ0ZXJfYm9va2luZ19tZXNzYWdlID0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZyggYWp4X2FmdGVyX2Jvb2tpbmdfbWVzc2FnZSApO1xuXHRcdFx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggYWp4X2FmdGVyX2Jvb2tpbmdfbWVzc2FnZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgOiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSkpXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdIDogJ3dhcm5pbmcnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYWZ0ZXInXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IH1cblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdFx0Ly8gUmVhY3RpdmF0ZSBjYWxlbmRhciBhZ2FpbiA/XHJcblx0XHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdFx0Ly8gRW5hYmxlIFN1Ym1pdCB8IEhpZGUgc3BpbiBsb2FkZXJcclxuXHRcdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gVW5zZWxlY3QgIGRhdGVzXHJcblx0XHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyAncmVzb3VyY2VfaWQnICAgID0+ICRwYXJhbXNbJ3Jlc291cmNlX2lkJ10sXHJcblx0XHRcdFx0XHRcdC8vICdib29raW5nX2hhc2gnICAgPT4gJGJvb2tpbmdfaGFzaCxcclxuXHRcdFx0XHRcdFx0Ly8gJ3JlcXVlc3RfdXJpJyAgICA9PiAkX1NFUlZFUlsnUkVRVUVTVF9VUkknXSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElzIGl0IHRoZSBzYW1lIGFzIHdpbmRvdy5sb2NhdGlvbi5ocmVmIG9yXHJcblx0XHRcdFx0XHRcdC8vICdjdXN0b21fZm9ybScgICAgPT4gJHBhcmFtc1snY3VzdG9tX2Zvcm0nXSwgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPcHRpb25hbC5cclxuXHRcdFx0XHRcdFx0Ly8gJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHInID0+IGltcGxvZGUoICcsJywgJHBhcmFtc1snYWdncmVnYXRlX3Jlc291cmNlX2lkX2FyciddICkgICAgIC8vIE9wdGlvbmFsLiBSZXNvdXJjZSBJRCAgIGZyb20gIGFnZ3JlZ2F0ZSBwYXJhbWV0ZXIgaW4gc2hvcnRjb2RlLlxyXG5cclxuXHRcdFx0XHRcdFx0Ly8gTG9hZCBuZXcgZGF0YSBpbiBjYWxlbmRhci5cclxuXHRcdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3Jlc291cmNlX2lkJyA6IHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXVx0XHRcdFx0XHRcdFx0Ly8gSXQncyBmcm9tIHJlc3BvbnNlIC4uLkFKWF9CT09LSU5HX19DUkVBVEUgb2YgaW5pdGlhbCBzZW50IHJlc291cmNlX2lkXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2hhc2gnOiByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWydib29raW5nX2hhc2gnXSBcdC8vID8/IHdlIGNhbiBub3QgdXNlIGl0LCAgYmVjYXVzZSBIQVNIIGNobmFnZWQgaW4gYW55ICBjYXNlIVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAncmVxdWVzdF91cmknIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsncmVxdWVzdF91cmknXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnY3VzdG9tX2Zvcm0nIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsnY3VzdG9tX2Zvcm0nXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEFnZ3JlZ2F0ZSBib29raW5nIHJlc291cmNlcywgIGlmIGFueSA/XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfc3RyJyA6IF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicgKS5qb2luKCcsJylcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHQvLyBFeGl0XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cclxuXHJcbi8qXHJcblx0Ly8gU2hvdyBDYWxlbmRhclxyXG5cdHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQm9va2luZ3MgLSBEYXRlc1xyXG5cdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoICByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsnZGF0ZXMnXSAgKTtcclxuXHJcblx0Ly8gQm9va2luZ3MgLSBDaGlsZCBvciBvbmx5IHNpbmdsZSBib29raW5nIHJlc291cmNlIGluIGRhdGVzXHJcblx0X3dwYmMuYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyBdICk7XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvLyBVcGRhdGUgY2FsZW5kYXJcclxuXHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcbiovXHJcblxyXG5cdFx0XHRcdFx0Ly8gSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBIaWRlIGJvb2tpbmcgZm9ybVxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX2FuaW1hdGVkX19oaWRlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBTaG93IENvbmZpcm1hdGlvbiB8IFBheW1lbnQgc2VjdGlvblxyXG5cdFx0XHRcdFx0d3BiY19zaG93X3RoYW5rX3lvdV9tZXNzYWdlX2FmdGVyX2Jvb2tpbmcoIHJlc3BvbnNlX2RhdGEgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBUcmlnZ2VyIGhvb2sgYWZ0ZXIgYSBib29raW5nIHdhcyBjcmVhdGVkIG9yIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5LlxyXG5cdFx0XHRcdFx0alF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19ib29raW5nX2Zvcm1fc3VibWl0X3N1Y2Nlc3MnLCBbIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgcmVzcG9uc2VfZGF0YSwgcGFyYW1zIF0gKTtcclxuXHJcblx0XHRcdFx0XHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0d3BiY19kb19zY3JvbGwoICcjd3BiY19zY3JvbGxfcG9pbnRfJyArIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgMTAgKTtcclxuXHRcdFx0XHRcdH0sIDUwMCApO1xyXG5cclxuXHJcblxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoXHJcblx0XHRcdFx0ICAvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICAgICAgICAgICAgICAgICAgICAgZGVzYz1cIiA9IFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiAgTk9OQ0UgZmllbGQgd2FzIG5vdCBwYXNzZWQgb3Igc29tZSBlcnJvciBoYXBwZW5lZCBhdCAgc2VydmVyISA9IFwiICA+XHJcblx0XHRcdFx0ICBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHtcblx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fbG9nX3VuZXhwZWN0ZWRfYWpheF9yZXNwb25zZSggJ1dQQkNfQUpYX0JPT0tJTkdfX0NSRUFURScsIGpxWEhSLnJlc3BvbnNlVGV4dCB8fCAnJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7XG5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiAgTk9OQ0UgZmllbGQgd2FzIG5vdCBwYXNzZWQgb3Igc29tZSBlcnJvciBoYXBwZW5lZCBhdCAgc2VydmVyIVxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX3VuZXhwZWN0ZWRfc2VydmVyX3Jlc3BvbnNlJyApIHx8ICdUaGUgc2VydmVyIHJldHVybmVkIGFuIHVuZXhwZWN0ZWQgcmVzcG9uc2UuIFBsZWFzZSByZWxvYWQgdGhlIHBhZ2UgYW5kIHRyeSBhZ2Fpbi4nO1xuXHRcdFx0XHRcdGlmICgganFYSFIuc3RhdHVzICl7XG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKCcgKyBwYXJzZUludCgganFYSFIuc3RhdHVzLCAxMCApICsgJyknO1xuXHRcdFx0XHRcdH1cblxyXG5cdFx0XHRcdFx0dmFyIGNhbGVuZGFyX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0dmFyIGpxX25vZGUgPSAnI2Jvb2tpbmdfZm9ybScgKyBjYWxlbmRhcl9pZDtcclxuXHJcblx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgLCB7ICd0eXBlJyAgICAgICAgOiAnZXJyb3InLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgIDogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnICAgOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJzogJ3RleHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgIDogMFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdC8vIEVuYWJsZSBTdWJtaXQgfCBIaWRlIHNwaW4gbG9hZGVyXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggY2FsZW5kYXJfaWQgKTtcclxuXHRcdFx0ICBcdCB9XHJcblx0XHRcdFx0IC8vIDwvZWRpdG9yLWZvbGQ+XHJcblx0XHRcdCAgKVxyXG5cdCAgICAgICAgICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHRcdCAgLy8gLmFsd2F5cyggZnVuY3Rpb24gKCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ2Fsd2F5cyBmaW5pc2hlZCcsIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICk7IH0gICAgIH0pXHJcblx0XHRcdCAgOyAgLy8gRW5kIEFqYXhcclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcblxyXG5cdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiICA9PSAgQ0FQVENIQSA9PSAgXCIgID5cclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlIGltYWdlIGluIGNhcHRjaGEgYW5kIHNob3cgd2FybmluZyBtZXNzYWdlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcGFyYW1zXHJcblx0ICpcclxuXHQgKiBFeGFtcGxlIG9mICdwYXJhbXMnIDoge1xyXG5cdCAqXHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnOiByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sXHJcblx0ICpcdFx0XHRcdFx0XHRcdCd1cmwnICAgICAgICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2NhcHRjaGFfX3NpbXBsZScgXVsgJ3VybCcgXSxcclxuXHQgKlx0XHRcdFx0XHRcdFx0J2NoYWxsZW5nZScgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnY2FwdGNoYV9fc2ltcGxlJyBdWyAnY2hhbGxlbmdlJyBdLFxyXG5cdCAqXHRcdFx0XHRcdFx0XHQnbWVzc2FnZScgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHQgKlx0XHRcdFx0XHRcdH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhcHRjaGFfX3NpbXBsZV9fdXBkYXRlKCBwYXJhbXMgKXtcclxuXHJcblx0XHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2NhcHRjaGFfaW5wdXQnICsgcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gKS52YWx1ZSA9ICcnO1xyXG5cdFx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjYXB0Y2hhX2ltZycgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApLnNyYyA9IHBhcmFtc1sgJ3VybCcgXTtcclxuXHRcdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BkZXZfY2FwdGNoYV9jaGFsbGVuZ2VfJyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkudmFsdWUgPSBwYXJhbXNbICdjaGFsbGVuZ2UnIF07XHJcblxyXG5cdFx0Ly8gU2hvdyB3YXJuaW5nIFx0XHRBZnRlciBDQVBUQ0hBIEltZ1xyXG5cdHZhciBtZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICsgJyArIGltZycsIHBhcmFtc1sgJ21lc3NhZ2UnIF0sICd0ZXh0JyApO1xuXHJcblx0XHQvLyBBbmltYXRlXHJcblx0XHRqUXVlcnkoICcjJyArIG1lc3NhZ2VfaWQgKyAnLCAnICsgJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkuZmFkZU91dCggMzUwICkuZmFkZUluKCAzMDAgKS5mYWRlT3V0KCAzNTAgKS5mYWRlSW4oIDQwMCApLmFuaW1hdGUoIHtvcGFjaXR5OiAxfSwgNDAwMCApO1xyXG5cdFx0Ly8gRm9jdXMgdGV4dCAgZmllbGRcclxuXHRcdGpRdWVyeSggJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkudHJpZ2dlciggJ2ZvY3VzJyApOyAgICBcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOC43LjExLjEyLlxyXG5cclxuXHJcblx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogSWYgdGhlIGNhcHRjaGEgZWxlbWVudHMgbm90IGV4aXN0ICBpbiB0aGUgYm9va2luZyBmb3JtLCAgdGhlbiAgcmVtb3ZlIHBhcmFtZXRlcnMgcmVsYXRpdmUgY2FwdGNoYVxyXG5cdCAqIEBwYXJhbSBwYXJhbXNcclxuXHQgKiBAcmV0dXJucyBvYmpcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhcHRjaGFfX3NpbXBsZV9fbWF5YmVfcmVtb3ZlX2luX2FqeF9wYXJhbXMoIHBhcmFtcyApe1xyXG5cclxuXHRcdGlmICggISB3cGJjX2NhcHRjaGFfX3NpbXBsZV9faXNfZXhpc3RfaW5fZm9ybSggcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gKSApe1xyXG5cdFx0XHRkZWxldGUgcGFyYW1zWyAnY2FwdGNoYV9jaGFsYW5nZScgXTtcclxuXHRcdFx0ZGVsZXRlIHBhcmFtc1sgJ2NhcHRjaGFfdXNlcl9pbnB1dCcgXTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBwYXJhbXM7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgaWYgQ0FQVENIQSBleGlzdCBpbiB0aGUgYm9va2luZyBmb3JtXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYXB0Y2hhX19zaW1wbGVfX2lzX2V4aXN0X2luX2Zvcm0oIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0cmV0dXJuIChcclxuXHRcdFx0XHRcdFx0KDAgIT09IGpRdWVyeSggJyN3cGRldl9jYXB0Y2hhX2NoYWxsZW5nZV8nICsgcmVzb3VyY2VfaWQgKS5sZW5ndGgpXHJcblx0XHRcdFx0XHQgfHwgKDAgIT09IGpRdWVyeSggJyNjYXB0Y2hhX2lucHV0JyArIHJlc291cmNlX2lkICkubGVuZ3RoKVxyXG5cdFx0XHRcdCk7XHJcblx0fVxyXG5cclxuXHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cclxuXHJcblx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2M9XCIgID09ICBTZW5kIEJ1dHRvbiB8IEZvcm0gU3BpbiBMb2FkZXIgID09ICBcIiAgPlxyXG5cclxuXHQvKipcclxuXHQgKiBEaXNhYmxlIFNlbmQgYnV0dG9uICB8ICBTaG93IFNwaW4gTG9hZGVyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fb25fc3VibWl0X191aV9lbGVtZW50c19kaXNhYmxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdC8vIERpc2FibGUgU3VibWl0XHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2Rpc2FibGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gU2hvdyBTcGluIGxvYWRlciBpbiBib29raW5nIGZvcm1cclxuXHRcdHdwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9fc2hvdyggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVuYWJsZSBTZW5kIGJ1dHRvbiAgfCAgIEhpZGUgU3BpbiBMb2FkZXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19vbl9yZXNwb25zZV9fdWlfZWxlbWVudHNfZW5hYmxlKHJlc291cmNlX2lkKXtcclxuXHJcblx0XHQvLyBFbmFibGUgU3VibWl0XHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2VuYWJsZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyBIaWRlIFNwaW4gbG9hZGVyIGluIGJvb2tpbmcgZm9ybVxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVuYWJsZSBTdWJtaXQgYnV0dG9uXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19lbmFibGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHQvLyBBY3RpdmF0ZSBTZW5kIGJ1dHRvblxyXG5cdFx0XHRqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCArICcgaW5wdXRbdHlwZT1idXR0b25dJyApLnByb3AoIFwiZGlzYWJsZWRcIiwgZmFsc2UgKTtcclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGJ1dHRvbicgKS5wcm9wKCBcImRpc2FibGVkXCIsIGZhbHNlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXNhYmxlIFN1Ym1pdCBidXR0b24gIGFuZCBzaG93ICBzcGluXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19zZW5kX2J1dHRvbl9fZGlzYWJsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdC8vIERpc2FibGUgU2VuZCBidXR0b25cclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGlucHV0W3R5cGU9YnV0dG9uXScgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGJ1dHRvbicgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERpc2FibGUgJ1RoaXMnIGJ1dHRvblxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBfdGhpc1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fdGhpc19idXR0b25fX2Rpc2FibGUoIF90aGlzICl7XHJcblxyXG5cdFx0XHQvLyBEaXNhYmxlIFNlbmQgYnV0dG9uXHJcblx0XHRcdGpRdWVyeSggX3RoaXMgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgYm9va2luZyBmb3JtICBTcGluIExvYWRlclxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9fc2hvdyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdHZhciAkZm9ybV9jb250YWluZXIgPSBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR2YXIgbG9hZGVyX3RleHQgICAgID0gJ1NhdmluZyc7XHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyAmJiBfd3BiYy5nZXRfbWVzc2FnZSApIHtcclxuXHRcdFx0XHRsb2FkZXJfdGV4dCA9IF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9ib29raW5nX3NhdmluZycgKSB8fCBsb2FkZXJfdGV4dDtcblx0XHRcdH1cclxuXHRcdFx0dmFyIGxvYWRlcl9odG1sICAgICA9ICc8ZGl2IGlkPVwid3BiY19ib29raW5nX2Zvcm1fc3Bpbl9sb2FkZXInICsgcmVzb3VyY2VfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlciB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXRfb3ZlcmxheVwiIGFyaWEtbGl2ZT1cInBvbGl0ZVwiIGFyaWEtaGlkZGVuPVwiZmFsc2VcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkaW5nX2NvbnRhaW5lclwiPidcclxuXHRcdFx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlclwiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIndwYmNfc3Bpbl9sb2FkZXJfb25lX25ld1wiPjwvZGl2PjwvZGl2PjwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuPicgKyBsb2FkZXJfdGV4dCArICcuLi48L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+JztcclxuXHJcblx0XHRcdC8vIFJlbW92ZSBhbnkgcHJldmlvdXMgaW5saW5lIGxvYWRlciBiZWZvcmUgYWRkaW5nIHRoZSBzdWJtaXQgb3ZlcmxheS5cclxuXHRcdFx0alF1ZXJ5KCAnI3dwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyJyArIHJlc291cmNlX2lkICkucmVtb3ZlKCk7XHJcblxyXG5cdFx0XHRpZiAoICRmb3JtX2NvbnRhaW5lci5sZW5ndGggJiYgJGZvcm1fY29udGFpbmVyLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHRcdFx0JGZvcm1fY29udGFpbmVyLmFkZENsYXNzKCAnd3BiY19ib29raW5nX2Zvcm1faXNfc3VibWl0dGluZycgKTtcclxuXHRcdFx0XHQkZm9ybV9jb250YWluZXIucHJlcGVuZCggbG9hZGVyX2h0bWwgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZhbGxiYWNrIGZvciBhbnkgdW5leHBlY3RlZCBsZWdhY3kgbWFya3VwIHdpdGhvdXQgI2Jvb2tpbmdfZm9ybV9kaXZ7cmVzb3VyY2VfaWR9LlxyXG5cdFx0XHRqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkuYWZ0ZXIoXHJcblx0XHRcdFx0JzxkaXYgaWQ9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlcicgKyByZXNvdXJjZV9pZCArICdcIiBjbGFzcz1cIndwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyXCIgc3R5bGU9XCJwb3NpdGlvbjogcmVsYXRpdmU7XCI+PGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXJcIj48ZGl2IGNsYXNzPVwid3BiY19zcGluX2xvYWRlcl9vbmVfbmV3XCI+PC9kaXY+PC9kaXY+PC9kaXY+J1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIC8gSGlkZSBib29raW5nIGZvcm0gIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8gUmVtb3ZlIFNwaW4gTG9hZGVyXHJcblx0XHRcdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlcicgKyByZXNvdXJjZV9pZCApLnJlbW92ZSgpO1xyXG5cdFx0XHRqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19ib29raW5nX2Zvcm1faXNfc3VibWl0dGluZycgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIaWRlIGJvb2tpbmcgZm9ybSB3dGggYW5pbWF0aW9uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19hbmltYXRlZF9faGlkZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5oaWRlKCk7XHJcblx0XHR9XHJcblx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHJcblxyXG5cdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiICA9PSAgTWluaSBTcGluIExvYWRlciAgPT0gIFwiICA+XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHBhcmVudF9odG1sX2lkXHJcblx0XHQgKi9cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgbWljcm8gU3BpbiBMb2FkZXJcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gaWRcdFx0XHRcdFx0XHRJRCBvZiBMb2FkZXIsICBmb3IgbGF0ZXIgIGhpZGUgaXQgYnkgIHVzaW5nIFx0XHR3cGJjX19zcGluX2xvYWRlcl9fbWljcm9fX2hpZGUoIGlkICkgT1Igd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUoIGlkIClcclxuXHRcdCAqIEBwYXJhbSBqcV9ub2RlX3doZXJlX2luc2VydFx0XHRzdWNoIGFzICcjZXN0aW1hdGVfYm9va2luZ19uaWdodF9jb3N0X2hpbnQxMCcgICBPUiAgJy5lc3RpbWF0ZV9ib29raW5nX25pZ2h0X2Nvc3RfaGludDEwJ1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX19zcGluX2xvYWRlcl9fbWljcm9fX3Nob3dfX2luc2lkZSggaWQgLCBqcV9ub2RlX3doZXJlX2luc2VydCApe1xyXG5cclxuXHRcdFx0XHR3cGJjX19zcGluX2xvYWRlcl9fbWluaV9fc2hvdyggaWQsIHtcclxuXHRcdFx0XHRcdCdjb2xvcicgIDogJyM0NDQnLFxyXG5cdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHtcclxuXHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnaW5zaWRlJyxcclxuXHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlX3doZXJlX2luc2VydFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdCdzdHlsZScgICAgOiAncG9zaXRpb246IHJlbGF0aXZlO2Rpc3BsYXk6IGlubGluZS1mbGV4O2ZsZXgtZmxvdzogY29sdW1uIG5vd3JhcDtqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjthbGlnbi1pdGVtczogY2VudGVyO21hcmdpbjogN3B4IDEycHg7JyxcclxuXHRcdFx0XHRcdCdjbGFzcycgICAgOiAnd3BiY19vbmVfc3Bpbl9sb2FkZXJfbWljcm8nXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIHNwaW5uZXJcclxuXHRcdCAqIEBwYXJhbSBpZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX19zcGluX2xvYWRlcl9fbWljcm9fX2hpZGUoIGlkICl7XHJcblx0XHQgICAgd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUoIGlkICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hvdyBtaW5pIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcGFyZW50X2h0bWxfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX3Nob3coIHBhcmVudF9odG1sX2lkICwgcGFyYW1zID0ge30gKXtcclxuXHJcblx0XHRcdHZhciBwYXJhbXNfZGVmYXVsdCA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2NvbG9yJyAgICA6ICcjMDA3MWNlJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6ICcnLFx0XHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJ1x0XHRcdFx0Ly8gJ2luc2lkZScgfCAnYmVmb3JlJyB8ICdhZnRlcicgfCAncmlnaHQnIHwgJ2xlZnQnXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAncG9zaXRpb246IHJlbGF0aXZlO21pbi1oZWlnaHQ6IDIuOHJlbTsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnY2xhc3MnICAgIDogJ3dwYmNfb25lX3NwaW5fbG9hZGVyX21pbmkgMHdwYmNfc3Bpbl9sb2FkZXJfb25lX25ldydcclxuXHRcdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdGZvciAoIHZhciBwX2tleSBpbiBwYXJhbXMgKXtcclxuXHRcdFx0XHRwYXJhbXNfZGVmYXVsdFsgcF9rZXkgXSA9IHBhcmFtc1sgcF9rZXkgXTtcclxuXHRcdFx0fVxyXG5cdFx0XHRwYXJhbXMgPSBwYXJhbXNfZGVmYXVsdDtcclxuXHJcblx0XHRcdGlmICggKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHBhcmFtc1snY29sb3InXSkpICYmICgnJyAhPSBwYXJhbXNbJ2NvbG9yJ10pICl7XHJcblx0XHRcdFx0cGFyYW1zWydjb2xvciddID0gJ2JvcmRlci1jb2xvcjonICsgcGFyYW1zWydjb2xvciddICsgJzsnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgc3Bpbm5lcl9odG1sID0gJzxkaXYgaWQ9XCJ3cGJjX21pbmlfc3Bpbl9sb2FkZXInICsgcGFyZW50X2h0bWxfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlclwiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ3N0eWxlJyBdICsgJ1wiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIicgKyBwYXJhbXNbICdjbGFzcycgXSArICdcIiBzdHlsZT1cIicgKyBwYXJhbXNbICdjb2xvcicgXSArICdcIj48L2Rpdj48L2Rpdj48L2Rpdj4nO1xyXG5cclxuXHRcdFx0aWYgKCAnJyA9PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICl7XHJcblx0XHRcdFx0cGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSA9ICcjJyArIHBhcmVudF9odG1sX2lkO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTaG93IFNwaW4gTG9hZGVyXHJcblx0XHRcdGlmICggJ2FmdGVyJyA9PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cdFx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFmdGVyKCBzcGlubmVyX2h0bWwgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5odG1sKCBzcGlubmVyX2h0bWwgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIC8gSGlkZSBtaW5pIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcGFyZW50X2h0bWxfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUoIHBhcmVudF9odG1sX2lkICl7XHJcblxyXG5cdFx0XHQvLyBSZW1vdmUgU3BpbiBMb2FkZXJcclxuXHRcdFx0alF1ZXJ5KCAnI3dwYmNfbWluaV9zcGluX2xvYWRlcicgKyBwYXJlbnRfaHRtbF9pZCApLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cclxuXHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cclxuLy9UT0RPOiB3aGF0ICBhYm91dCBzaG93aW5nIG9ubHkgIFRoYW5rIHlvdS4gbWVzc2FnZSB3aXRob3V0IHBheW1lbnQgZm9ybXMuXHJcbi8qKlxyXG4gKiBTaG93ICdUaGFuayB5b3UnLiBtZXNzYWdlIGFuZCBwYXltZW50IGZvcm1zXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3Nob3dfdGhhbmtfeW91X21lc3NhZ2VfYWZ0ZXJfYm9va2luZyggcmVzcG9uc2VfZGF0YSApe1xyXG5cclxuXHRpZiAoXHJcbiBcdFx0ICAgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfaXNfcmVkaXJlY3QnIF0pKVxyXG5cdFx0JiYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfdXJsJyBdKSlcclxuXHRcdCYmICgncGFnZScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9pc19yZWRpcmVjdCcgXSlcclxuXHRcdCYmICgnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3VybCcgXSlcclxuXHQpe1xyXG5cdFx0alF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19ib29raW5nX2NyZWF0ZWQnLCBbIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSAsIHJlc3BvbnNlX2RhdGEgXSApO1x0XHRcdC8vIEZpeEluOiAxMC4wLjAuMzAuXHJcblx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfdXJsJyBdO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyIHJlc291cmNlX2lkID0gcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdXHJcblx0dmFyIGNvbmZpcm1fY29udGVudCA9Jyc7XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdID0gJyc7XHJcblx0fVxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb24nIF0gKSApe1xyXG5cdFx0IFx0XHRcdCAgXHRcdFx0IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uJyBdID0gJyc7XHJcblx0fVxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0gKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0gPSAnJztcclxuXHR9XHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfZ2F0ZXdheXMnIF0gKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X2dhdGV3YXlzJyBdID0gJyc7XHJcblx0fVxyXG5cdHZhciB0eV9tZXNzYWdlX2hpZGUgXHRcdFx0XHRcdFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdKSA/ICd3cGJjX3R5X2hpZGUnIDogJyc7XHJcblx0dmFyIHR5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbl9oaWRlIFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb24nIF0ucmVwbGFjZSggL1xcXFxuL2csICcnICkpID8gJ3dwYmNfdHlfaGlkZScgOiAnJztcclxuXHR2YXIgdHlfYm9va2luZ19jb3N0c19oaWRlIFx0XHRcdFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0pID8gJ3dwYmNfdHlfaGlkZScgOiAnJztcclxuXHR2YXIgdHlfcGF5bWVudF9nYXRld2F5c19oaWRlIFx0XHRcdD0gKCcnID09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9nYXRld2F5cycgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKSkgPyAnd3BiY190eV9oaWRlJyA6ICcnO1xyXG5cclxuXHRpZiAoICd3cGJjX3R5X2hpZGUnICE9IHR5X3BheW1lbnRfZ2F0ZXdheXNfaGlkZSApe1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdHlfX2NvbnRlbnRfdGV4dC53cGJjX3R5X19jb250ZW50X2dhdGV3YXlzJyApLmh0bWwoICcnICk7XHQvLyBSZXNldCAgYWxsICBvdGhlciBwb3NzaWJsZSBnYXRld2F5cyBiZWZvcmUgc2hvd2luZyBuZXcgb25lLlxyXG5cdH1cclxuXHJcblx0Y29uZmlybV9jb250ZW50ICs9IGA8ZGl2IGlkPVwid3BiY19zY3JvbGxfcG9pbnRfJHtyZXNvdXJjZV9pZH1cIj48L2Rpdj5gO1xyXG5cdGNvbmZpcm1fY29udGVudCArPSBgICA8ZGl2IGNsYXNzPVwid3BiY19hZnRlcl9ib29raW5nX3RoYW5rX3lvdV9zZWN0aW9uXCI+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICA8ZGl2IGNsYXNzPVwid3BiY190eV9fbWVzc2FnZSAke3R5X21lc3NhZ2VfaGlkZX1cIj4ke3Jlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfbWVzc2FnZScgXX08L2Rpdj5gO1xyXG4gICAgY29uZmlybV9jb250ZW50ICs9IGAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRhaW5lclwiPmA7XHJcblx0aWYgKCAnJyAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlX2Jvb2tpbmdfaWQnIF0gKXtcclxuXHRcdGNvbmZpcm1fY29udGVudCArPSBgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2hlYWRlclwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlX2Jvb2tpbmdfaWQnIF19PC9kaXY+YDtcclxuXHR9XHJcbiAgICBjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50XCI+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX3R5X19wYXltZW50X2Rlc2NyaXB0aW9uICR7dHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uX2hpZGV9XCI+JHtyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbicgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKX08L2Rpdj5gO1xyXG5cdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfY3VzdG9tZXJfZGV0YWlscycgXSApe1xyXG5cdFx0Y29uZmlybV9jb250ZW50ICs9IGAgICAgICBcdDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50X3RleHQgd3BiY19jb2xzXzJcIj4ke3Jlc3BvbnNlX2RhdGFbJ2FqeF9jb25maXJtYXRpb24nXVsndHlfY3VzdG9tZXJfZGV0YWlscyddfTwvZGl2PmA7XHJcblx0fVxyXG5cdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfYm9va2luZ19kZXRhaWxzJyBdICl7XHJcblx0XHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgIFx0PGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX2NvbHNfMlwiPiR7cmVzcG9uc2VfZGF0YVsnYWp4X2NvbmZpcm1hdGlvbiddWyd0eV9ib29raW5nX2RldGFpbHMnXX08L2Rpdj5gO1xyXG5cdH1cclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX3R5X19jb250ZW50X2Nvc3RzICR7dHlfYm9va2luZ19jb3N0c19oaWRlfVwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9ib29raW5nX2Nvc3RzJyBdfTwvZGl2PmA7XHJcblx0Y29uZmlybV9jb250ZW50ICs9IGAgICAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50X3RleHQgd3BiY190eV9fY29udGVudF9nYXRld2F5cyAke3R5X3BheW1lbnRfZ2F0ZXdheXNfaGlkZX1cIj4ke3Jlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9nYXRld2F5cycgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKS5yZXBsYWNlKCAvYWpheF9zY3JpcHQvZ2ksICdzY3JpcHQnICl9PC9kaXY+YDtcclxuICAgIGNvbmZpcm1fY29udGVudCArPSBgICAgICAgPC9kaXY+YDtcclxuICAgIGNvbmZpcm1fY29udGVudCArPSBgICAgIDwvZGl2PmA7XHJcblx0Y29uZmlybV9jb250ZW50ICs9IGA8L2Rpdj5gO1xyXG5cclxuIFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLmFmdGVyKCBjb25maXJtX2NvbnRlbnQgKTtcclxuXHJcblxyXG5cdC8vRml4SW46IDEwLjAuMC4zMFx0XHQvLyBldmVudCBuYW1lXHRcdFx0Ly8gUmVzb3VyY2UgSURcdC1cdCcxJ1xyXG5cdGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggJ3dwYmNfYm9va2luZ19jcmVhdGVkJywgWyByZXNvdXJjZV9pZCAsIHJlc3BvbnNlX2RhdGEgXSApO1xyXG5cdC8vIFRvIGNhdGNoIHRoaXMgZXZlbnQ6IGpRdWVyeSggJ2JvZHknICkub24oJ3dwYmNfYm9va2luZ19jcmVhdGVkJywgZnVuY3Rpb24oIGV2ZW50LCByZXNvdXJjZV9pZCwgcGFyYW1zICkgeyBjb25zb2xlLmxvZyggZXZlbnQsIHJlc291cmNlX2lkLCBwYXJhbXMg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QztFQUM1RCxJQUFLLEVBQUUsS0FBS2xGLGFBQWEsQ0FBRSxrQkFBa0IsQ0FBRSxDQUFFLHVCQUF1QixDQUFFLEVBQUU7SUFDM0VrRixlQUFlLElBQUksc0NBQXNDbEYsYUFBYSxDQUFFLGtCQUFrQixDQUFFLENBQUUsdUJBQXVCLENBQUUsUUFBUTtFQUNoSTtFQUNHa0YsZUFBZSxJQUFJLHNDQUFzQztFQUM1REEsZUFBZSxJQUFJLDBFQUEwRUUsbUNBQW1DLEtBQUtwRixhQUFhLENBQUUsa0JBQWtCLENBQUUsQ0FBRSxnQ0FBZ0MsQ0FBRSxDQUFDc0IsT0FBTyxDQUFFLE1BQU0sRUFBRSxFQUFHLENBQUMsUUFBUTtFQUMxTyxJQUFLLEVBQUUsS0FBS3RCLGFBQWEsQ0FBRSxrQkFBa0IsQ0FBRSxDQUFFLHFCQUFxQixDQUFFLEVBQUU7SUFDekVrRixlQUFlLElBQUkseURBQXlEbEYsYUFBYSxDQUFDLGtCQUFrQixDQUFDLENBQUMscUJBQXFCLENBQUMsUUFBUTtFQUM3STtFQUNBLElBQUssRUFBRSxLQUFLQSxhQUFhLENBQUUsa0JBQWtCLENBQUUsQ0FBRSxvQkFBb0IsQ0FBRSxFQUFFO0lBQ3hFa0YsZUFBZSxJQUFJLHlEQUF5RGxGLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLG9CQUFvQixDQUFDLFFBQVE7RUFDNUk7RUFDQWtGLGVBQWUsSUFBSSxvRUFBb0VHLHFCQUFxQixLQUFLckYsYUFBYSxDQUFFLGtCQUFrQixDQUFFLENBQUUsa0JBQWtCLENBQUUsUUFBUTtFQUNsTGtGLGVBQWUsSUFBSSx1RUFBdUVJLHdCQUF3QixLQUFLdEYsYUFBYSxDQUFFLGtCQUFrQixDQUFFLENBQUUscUJBQXFCLENBQUUsQ0FBQ3NCLE9BQU8sQ0FBRSxNQUFNLEVBQUUsRUFBRyxDQUFDLENBQUNBLE9BQU8sQ0FBRSxlQUFlLEVBQUUsUUFBUyxDQUFDLFFBQVE7RUFDblA0RCxlQUFlLElBQUksY0FBYztFQUNqQ0EsZUFBZSxJQUFJLFlBQVk7RUFDbENBLGVBQWUsSUFBSSxRQUFRO0VBRTFCN0YsTUFBTSxDQUFFLGVBQWUsR0FBRzRELFdBQVksQ0FBQyxDQUFDZ0IsS0FBSyxDQUFFaUIsZUFBZ0IsQ0FBQzs7RUFHakU7RUFDQTdGLE1BQU0sQ0FBRSxNQUFPLENBQUMsQ0FBQ0MsT0FBTyxDQUFFLHNCQUFzQixFQUFFLENBQUUyRCxXQUFXLEVBQUdqRCxhQUFhLENBQUcsQ0FBQztFQUNuRjtBQUNEIiwiaWdub3JlTGlzdCI6W119
