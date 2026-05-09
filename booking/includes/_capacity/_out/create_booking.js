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
    if (typeof response_data !== 'object' || response_data === null) {
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

    // Trigger hook after a booking was created or updated successfully.
    jQuery('body').trigger('wpbc_booking_form_submit_success', [response_data['resource_id'], response_data, params]);
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
  var $form_container = jQuery('#booking_form_div' + resource_id);
  var loader_text = 'Saving';
  if ('undefined' !== typeof _wpbc && _wpbc.get_message) {
    loader_text = _wpbc.get_message('message_saving') || loader_text;
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX2NhcGFjaXR5L19vdXQvY3JlYXRlX2Jvb2tpbmcuanMiLCJuYW1lcyI6WyJ3cGJjX2FqeF9ib29raW5nX19jcmVhdGUiLCJwYXJhbXMiLCJjb25zb2xlIiwiZ3JvdXBDb2xsYXBzZWQiLCJsb2ciLCJncm91cEVuZCIsIndwYmNfY2FwdGNoYV9fc2ltcGxlX19tYXliZV9yZW1vdmVfaW5fYWp4X3BhcmFtcyIsImpRdWVyeSIsInRyaWdnZXIiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsImFjdGlvbiIsIndwYmNfYWp4X3VzZXJfaWQiLCJfd3BiYyIsImdldF9zZWN1cmVfcGFyYW0iLCJub25jZSIsIndwYmNfYWp4X2xvY2FsZSIsImNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsIm9ial9rZXkiLCJjYWxlbmRhcl9pZCIsIndwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsIiwiZGF0YSIsImpxX25vZGUiLCJ3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlIiwid3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUiLCJ3cGJjX2NhcHRjaGFfX3NpbXBsZV9fdXBkYXRlIiwicmVwbGFjZSIsIm1lc3NhZ2VfaWQiLCJhanhfYWZ0ZXJfYm9va2luZ19tZXNzYWdlIiwid3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzIiwid3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangiLCJib29raW5nX19nZXRfcGFyYW1fdmFsdWUiLCJqb2luIiwid3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlIiwid3BiY19ib29raW5nX2Zvcm1fX2FuaW1hdGVkX19oaWRlIiwid3BiY19zaG93X3RoYW5rX3lvdV9tZXNzYWdlX2FmdGVyX2Jvb2tpbmciLCJzZXRUaW1lb3V0Iiwid3BiY19kb19zY3JvbGwiLCJmYWlsIiwiZXJyb3JUaHJvd24iLCJ3aW5kb3ciLCJlcnJvcl9tZXNzYWdlIiwic3RhdHVzIiwicmVzcG9uc2VUZXh0IiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsInZhbHVlIiwic3JjIiwid3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyIsImZhZGVPdXQiLCJmYWRlSW4iLCJhbmltYXRlIiwib3BhY2l0eSIsIndwYmNfY2FwdGNoYV9fc2ltcGxlX19pc19leGlzdF9pbl9mb3JtIiwicmVzb3VyY2VfaWQiLCJsZW5ndGgiLCJ3cGJjX2Jvb2tpbmdfZm9ybV9fb25fc3VibWl0X191aV9lbGVtZW50c19kaXNhYmxlIiwid3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19kaXNhYmxlIiwid3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19zaG93Iiwid3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19lbmFibGUiLCJwcm9wIiwid3BiY19ib29raW5nX2Zvcm1fX3RoaXNfYnV0dG9uX19kaXNhYmxlIiwiX3RoaXMiLCIkZm9ybV9jb250YWluZXIiLCJsb2FkZXJfdGV4dCIsImdldF9tZXNzYWdlIiwibG9hZGVyX2h0bWwiLCJyZW1vdmUiLCJpcyIsImFkZENsYXNzIiwicHJlcGVuZCIsImFmdGVyIiwicmVtb3ZlQ2xhc3MiLCJoaWRlIiwid3BiY19fc3Bpbl9sb2FkZXJfX21pY3JvX19zaG93X19pbnNpZGUiLCJpZCIsImpxX25vZGVfd2hlcmVfaW5zZXJ0Iiwid3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX3Nob3ciLCJ3cGJjX19zcGluX2xvYWRlcl9fbWljcm9fX2hpZGUiLCJ3cGJjX19zcGluX2xvYWRlcl9fbWluaV9faGlkZSIsInBhcmVudF9odG1sX2lkIiwicGFyYW1zX2RlZmF1bHQiLCJwX2tleSIsInNwaW5uZXJfaHRtbCIsImh0bWwiLCJsb2NhdGlvbiIsImhyZWYiLCJjb25maXJtX2NvbnRlbnQiLCJ0eV9tZXNzYWdlX2hpZGUiLCJ0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb25faGlkZSIsInR5X2Jvb2tpbmdfY29zdHNfaGlkZSIsInR5X3BheW1lbnRfZ2F0ZXdheXNfaGlkZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19jYXBhY2l0eS9fc3JjL2NyZWF0ZV9ib29raW5nLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09ICBBIGogYSB4ICAgIEEgZCBkICAgIE4gZSB3ICAgIEIgbyBvIGsgaSBuIGcgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTdWJtaXQgbmV3IGJvb2tpbmdcclxuICpcclxuICogQHBhcmFtIHBhcmFtcyAgID0gICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAncmVzb3VyY2VfaWQnICAgICAgICA6IHJlc291cmNlX2lkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkYXRlc19kZG1teXlfY3N2JyAgIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWx1ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnZm9ybWRhdGEnICAgICAgICAgICA6IGZvcm1kYXRhLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdib29raW5nX2hhc2gnICAgICAgIDogbXlfYm9va2luZ19oYXNoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjdXN0b21fZm9ybScgICAgICAgIDogbXlfYm9va2luZ19mb3JtLFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnY2FwdGNoYV9jaGFsYW5nZScgICA6IGNhcHRjaGFfY2hhbGFuZ2UsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2NhcHRjaGFfdXNlcl9pbnB1dCcgOiB1c2VyX2NhcHRjaGEsXHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdpc19lbWFpbHNfc2VuZCcgICAgIDogaXNfc2VuZF9lbWVpbHMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2FjdGl2ZV9sb2NhbGUnICAgICAgOiB3cGRldl9hY3RpdmVfbG9jYWxlXHJcblx0XHRcdFx0XHRcdH1cclxuICpcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX2NyZWF0ZSggcGFyYW1zICl7XHJcblxyXG5cdGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9CT09LSU5HX19DUkVBVEUnICk7XHJcblx0Y29uc29sZS5ncm91cENvbGxhcHNlZCggJz09IEJlZm9yZSBBamF4IFNlbmQgPT0nICk7XHJcblx0Y29uc29sZS5sb2coIHBhcmFtcyApO1xyXG5cdGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblx0cGFyYW1zID0gd3BiY19jYXB0Y2hhX19zaW1wbGVfX21heWJlX3JlbW92ZV9pbl9hanhfcGFyYW1zKCBwYXJhbXMgKTtcclxuXHJcblx0Ly8gVHJpZ2dlciBob29rICBiZWZvcmUgc2VuZGluZyByZXF1ZXN0ICB0byAgY3JlYXRlIHRoZSBib29raW5nLlxyXG5cdGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggJ3dwYmNfYmVmb3JlX2Jvb2tpbmdfY3JlYXRlJywgWyBwYXJhbXNbJ3Jlc291cmNlX2lkJ10sIHBhcmFtcyBdICk7XHJcblxyXG5cdC8vIFN0YXJ0IEFqYXguXHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHR7XHJcblx0XHRcdGFjdGlvbiAgICAgICAgICAgICAgICAgOiAnV1BCQ19BSlhfQk9PS0lOR19fQ1JFQVRFJyxcclxuXHRcdFx0d3BiY19hanhfdXNlcl9pZCAgICAgICA6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRub25jZSAgICAgICAgICAgICAgICAgIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHR3cGJjX2FqeF9sb2NhbGUgICAgICAgIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSxcclxuXHRcdFx0Y2FsZW5kYXJfcmVxdWVzdF9wYXJhbXM6IHBhcmFtcyxcclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqICBVc3VhbGx5ICBwYXJhbXMgPSB7ICdyZXNvdXJjZV9pZCcgICAgICAgIDogcmVzb3VyY2VfaWQsXHJcblx0XHRcdCAqXHRcdFx0XHRcdFx0J2RhdGVzX2RkbW15eV9jc3YnICAgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbHVlLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdmb3JtZGF0YScgICAgICAgICAgIDogZm9ybWRhdGEsXHJcblx0XHRcdCAqXHRcdFx0XHRcdFx0J2Jvb2tpbmdfaGFzaCcgICAgICAgOiBteV9ib29raW5nX2hhc2gsXHJcblx0XHRcdCAqXHRcdFx0XHRcdFx0J2N1c3RvbV9mb3JtJyAgICAgICAgOiBteV9ib29raW5nX2Zvcm0sXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqXHRcdFx0XHRcdFx0J2NhcHRjaGFfY2hhbGFuZ2UnICAgOiBjYXB0Y2hhX2NoYWxhbmdlLFxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCd1c2VyX2NhcHRjaGEnICAgICAgIDogdXNlcl9jYXB0Y2hhLFxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKlx0XHRcdFx0XHRcdCdpc19lbWFpbHNfc2VuZCcgICAgIDogaXNfc2VuZF9lbWVpbHMsXHJcblx0XHRcdCAqXHRcdFx0XHRcdFx0J2FjdGl2ZV9sb2NhbGUnICAgICAgOiB3cGRldl9hY3RpdmVfbG9jYWxlXHJcblx0XHRcdCAqXHRcdFx0XHR9XHJcblx0XHRcdCAqL1xyXG5cdFx0fSxcclxuXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogUyB1IGMgYyBlIHMgc1xyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0ICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcdFx0LVx0aXRzIG9iamVjdCByZXR1cm5lZCBmcm9tICBBamF4IC0gY2xhc3MtbGl2ZS1zZWFyY2cucGhwXHJcblx0XHRcdFx0ICogQHBhcmFtIHRleHRTdGF0dXNcdFx0LVx0J3N1Y2Nlc3MnXHJcblx0XHRcdFx0ICogQHBhcmFtIGpxWEhSXHRcdFx0XHQtXHRPYmplY3RcclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRmdW5jdGlvbiAoIHJlc3BvbnNlX2RhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkge1xyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9CT09LSU5HX19DUkVBVEUgPT0gJyApO1xyXG5mb3IgKCB2YXIgb2JqX2tleSBpbiByZXNwb25zZV9kYXRhICl7XHJcblx0Y29uc29sZS5ncm91cENvbGxhcHNlZCggJz09JyArIG9ial9rZXkgKyAnPT0nICk7XHJcblx0Y29uc29sZS5sb2coICcgOiAnICsgb2JqX2tleSArICcgOiAnLCByZXNwb25zZV9kYXRhWyBvYmpfa2V5IF0gKTtcclxuXHRjb25zb2xlLmdyb3VwRW5kKCk7XHJcbn1cclxuY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHJcblx0XHRcdFx0XHQvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICBkZXNjPVwiID0gRXJyb3IgTWVzc2FnZSEgU2VydmVyIHJlc3BvbnNlIHdpdGggU3RyaW5nLiAgLT4gIEVfWF9JX1QgIFwiICA+XHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHQvLyBUaGlzIHNlY3Rpb24gZXhlY3V0ZSwgIHdoZW4gc2VydmVyIHJlc3BvbnNlIHdpdGggIFN0cmluZyBpbnN0ZWFkIG9mIE9iamVjdCAtLSBVc3VhbGx5ICBpdCdzIGJlY2F1c2Ugb2YgbWlzdGFrZSBpbiBjb2RlICFcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgY2FsZW5kYXJfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHRcdHZhciBqcV9ub2RlID0gJyNib29raW5nX2Zvcm0nICsgY2FsZW5kYXJfaWQ7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICcnID09IHJlc3BvbnNlX2RhdGEgKXtcclxuXHRcdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhID0gJzxzdHJvbmc+JyArICdFcnJvciEgU2VydmVyIHJlc3BvbmQgd2l0aCBlbXB0eSBzdHJpbmchJyArICc8L3N0cm9uZz4gJyA7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGEgLCB7ICd0eXBlJyAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggY2FsZW5kYXJfaWQgKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHJcblxyXG5cdFx0XHRcdFx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgZGVzYz1cIiAgPT0gIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiB3ZSBoYXZlIEtOT1dOIGVycm9ycyBmcm9tIEJvb2tpbmcgQ2FsZW5kYXIuICAtPiAgRV9YX0lfVCAgXCIgID5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiB3ZSBoYXZlIEtOT1dOIGVycm9ycyBmcm9tIEJvb2tpbmcgQ2FsZW5kYXJcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRcdFx0XHRpZiAoICdvaycgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnc3RhdHVzJyBdICkge1xyXG5cclxuXHRcdFx0XHRcdFx0c3dpdGNoICggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnc3RhdHVzX2Vycm9yJyBdICl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGNhc2UgJ2NhcHRjaGFfc2ltcGxlX3dyb25nJzpcclxuXHRcdFx0XHRcdFx0XHRcdHdwYmNfY2FwdGNoYV9fc2ltcGxlX191cGRhdGUoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVzb3VyY2VfaWQnOiByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VybCcgICAgICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnY2FwdGNoYV9fc2ltcGxlJyBdWyAndXJsJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjaGFsbGVuZ2UnICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2NhcHRjaGFfX3NpbXBsZScgXVsgJ2NoYWxsZW5nZScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbWVzc2FnZScgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjYXNlICdyZXNvdXJjZV9pZF9pbmNvcnJlY3QnOlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2hvdyBFcnJvciBNZXNzYWdlIC0gaW5jb3JyZWN0ICBib29raW5nIHJlc291cmNlIElEIGR1cmluZyBzdWJtaXQgb2YgYm9va2luZy5cclxuXHRcdFx0XHRcdFx0XHRcdHZhciBtZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyA6ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdKSlcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7ICd3aGVyZSc6ICdhZnRlcicsICdqcV9ub2RlJzogJyNib29raW5nX2Zvcm0nICsgcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRjYXNlICdib29raW5nX2Nhbl9ub3Rfc2F2ZSc6XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBXZSBjYW4gbm90IHNhdmUgYm9va2luZywgYmVjYXVzZSBkYXRlcyBhcmUgYm9va2VkIG9yIGNhbiBub3Qgc2F2ZSBpbiBzYW1lIGJvb2tpbmcgcmVzb3VyY2UgYWxsIHRoZSBkYXRlc1xyXG5cdFx0XHRcdFx0XHRcdFx0dmFyIG1lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnIDogKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0pKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsgJ3doZXJlJzogJ2FmdGVyJywgJ2pxX25vZGUnOiAnI2Jvb2tpbmdfZm9ybScgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdC8vIEVuYWJsZSBTdWJtaXQgfCBIaWRlIHNwaW4gbG9hZGVyXHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cclxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OlxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiID0gRm9yIGRlYnVnIG9ubHkgPyAtLSAgU2hvdyBNZXNzYWdlIHVuZGVyIHRoZSBmb3JtID0gXCIgID5cclxuXHRcdFx0XHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0pIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0ICYmICggJycgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApIClcclxuXHRcdFx0XHRcdFx0XHRcdCl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgY2FsZW5kYXJfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBqcV9ub2RlID0gJyNib29raW5nX2Zvcm0nICsgY2FsZW5kYXJfaWQ7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgYWp4X2FmdGVyX2Jvb2tpbmdfbWVzc2FnZSA9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCBhanhfYWZ0ZXJfYm9va2luZ19tZXNzYWdlICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHQvKipcclxuXHRcdFx0XHRcdFx0XHRcdFx0ICogLy8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0dmFyIGFqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGFqeF9hZnRlcl9ib29raW5nX21lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyA6ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdKSlcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICdpbmZvJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0XHQvLyBSZWFjdGl2YXRlIGNhbGVuZGFyIGFnYWluID9cclxuXHRcdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fcmVzcG9uc2VfX3VpX2VsZW1lbnRzX2VuYWJsZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBVbnNlbGVjdCAgZGF0ZXNcclxuXHRcdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRcdC8vICdyZXNvdXJjZV9pZCcgICAgPT4gJHBhcmFtc1sncmVzb3VyY2VfaWQnXSxcclxuXHRcdFx0XHRcdFx0Ly8gJ2Jvb2tpbmdfaGFzaCcgICA9PiAkYm9va2luZ19oYXNoLFxyXG5cdFx0XHRcdFx0XHQvLyAncmVxdWVzdF91cmknICAgID0+ICRfU0VSVkVSWydSRVFVRVNUX1VSSSddLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSXMgaXQgdGhlIHNhbWUgYXMgd2luZG93LmxvY2F0aW9uLmhyZWYgb3JcclxuXHRcdFx0XHRcdFx0Ly8gJ2N1c3RvbV9mb3JtJyAgICA9PiAkcGFyYW1zWydjdXN0b21fZm9ybSddLCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9wdGlvbmFsLlxyXG5cdFx0XHRcdFx0XHQvLyAnYWdncmVnYXRlX3Jlc291cmNlX2lkX3N0cicgPT4gaW1wbG9kZSggJywnLCAkcGFyYW1zWydhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJ10gKSAgICAgLy8gT3B0aW9uYWwuIFJlc291cmNlIElEICAgZnJvbSAgYWdncmVnYXRlIHBhcmFtZXRlciBpbiBzaG9ydGNvZGUuXHJcblxyXG5cdFx0XHRcdFx0XHQvLyBMb2FkIG5ldyBkYXRhIGluIGNhbGVuZGFyLlxyXG5cdFx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAncmVzb3VyY2VfaWQnIDogcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdXHRcdFx0XHRcdFx0XHQvLyBJdCdzIGZyb20gcmVzcG9uc2UgLi4uQUpYX0JPT0tJTkdfX0NSRUFURSBvZiBpbml0aWFsIHNlbnQgcmVzb3VyY2VfaWRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfaGFzaCc6IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bJ2Jvb2tpbmdfaGFzaCddIFx0Ly8gPz8gd2UgY2FuIG5vdCB1c2UgaXQsICBiZWNhdXNlIEhBU0ggY2huYWdlZCBpbiBhbnkgIGNhc2UhXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdyZXF1ZXN0X3VyaScgOiByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWydyZXF1ZXN0X3VyaSddXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdjdXN0b21fZm9ybScgOiByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWydjdXN0b21fZm9ybSddXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQWdncmVnYXRlIGJvb2tpbmcgcmVzb3VyY2VzLCAgaWYgYW55ID9cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9zdHInIDogX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJyApLmpvaW4oJywnKVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdC8vIEV4aXRcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIDwvZWRpdG9yLWZvbGQ+XHJcblxyXG5cclxuLypcclxuXHQvLyBTaG93IENhbGVuZGFyXHJcblx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RvcCggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBCb29raW5ncyAtIERhdGVzXHJcblx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWydkYXRlcyddICApO1xyXG5cclxuXHQvLyBCb29raW5ncyAtIENoaWxkIG9yIG9ubHkgc2luZ2xlIGJvb2tpbmcgcmVzb3VyY2UgaW4gZGF0ZXNcclxuXHRfd3BiYy5ib29raW5nX19zZXRfcGFyYW1fdmFsdWUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJywgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnIF0gKTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8vIFVwZGF0ZSBjYWxlbmRhclxyXG5cdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuKi9cclxuXHJcblx0XHRcdFx0XHQvLyBIaWRlIHNwaW4gbG9hZGVyXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX2hpZGUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEhpZGUgYm9va2luZyBmb3JtXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fYW5pbWF0ZWRfX2hpZGUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgQ29uZmlybWF0aW9uIHwgUGF5bWVudCBzZWN0aW9uXHJcblx0XHRcdFx0XHR3cGJjX3Nob3dfdGhhbmtfeW91X21lc3NhZ2VfYWZ0ZXJfYm9va2luZyggcmVzcG9uc2VfZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFRyaWdnZXIgaG9vayBhZnRlciBhIGJvb2tpbmcgd2FzIGNyZWF0ZWQgb3IgdXBkYXRlZCBzdWNjZXNzZnVsbHkuXHJcblx0XHRcdFx0XHRqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoICd3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXRfc3VjY2VzcycsIFsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCByZXNwb25zZV9kYXRhLCBwYXJhbXMgXSApO1xyXG5cclxuXHRcdFx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHR3cGJjX2RvX3Njcm9sbCggJyN3cGJjX3Njcm9sbF9wb2ludF8nICsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAxMCApO1xyXG5cdFx0XHRcdFx0fSwgNTAwICk7XHJcblxyXG5cclxuXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbChcclxuXHRcdFx0XHQgIC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiID0gVGhpcyBzZWN0aW9uIGV4ZWN1dGUsICB3aGVuICBOT05DRSBmaWVsZCB3YXMgbm90IHBhc3NlZCBvciBzb21lIGVycm9yIGhhcHBlbmVkIGF0ICBzZXJ2ZXIhID0gXCIgID5cclxuXHRcdFx0XHQgIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIFRoaXMgc2VjdGlvbiBleGVjdXRlLCAgd2hlbiAgTk9OQ0UgZmllbGQgd2FzIG5vdCBwYXNzZWQgb3Igc29tZSBlcnJvciBoYXBwZW5lZCBhdCAgc2VydmVyIVxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdFx0XHRcdC8vIEdldCBDb250ZW50IG9mIEVycm9yIE1lc3NhZ2VcclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnICg8Yj4nICsganFYSFIuc3RhdHVzICsgJzwvYj4pJztcclxuXHRcdFx0XHRcdFx0aWYgKDQwMyA9PSBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICc8YnI+IFByb2JhYmx5IG5vbmNlIGZvciB0aGlzIHBhZ2UgaGFzIGJlZW4gZXhwaXJlZC4gUGxlYXNlIDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDpsb2NhdGlvbi5yZWxvYWQoKTtcIj5yZWxvYWQgdGhlIHBhZ2U8L2E+Lic7XHJcblx0XHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnPGJyPiBPdGhlcndpc2UsIHBsZWFzZSBjaGVjayB0aGlzIDxhIHN0eWxlPVwiZm9udC13ZWlnaHQ6IDYwMDtcIiBocmVmPVwiaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vZmFxL3JlcXVlc3QtZG8tbm90LXBhc3Mtc2VjdXJpdHktY2hlY2svP2FmdGVyX3VwZGF0ZT0xMC4xLjFcIj50cm91Ymxlc2hvb3RpbmcgaW5zdHJ1Y3Rpb248L2E+Ljxicj4nXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdC8vIEVzY2FwZSB0YWdzIGluIEVycm9yIG1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnPGJyPjxzdHJvbmc+UmVzcG9uc2U8L3N0cm9uZz48ZGl2IHN0eWxlPVwicGFkZGluZzogMCAxMHB4O21hcmdpbjogMCAwIDEwcHg7Ym9yZGVyLXJhZGl1czozcHg7IGJveC1zaGFkb3c6MHB4IDBweCAxcHggI2EzYTNhMztcIj4nICsganFYSFIucmVzcG9uc2VUZXh0LnJlcGxhY2UoLyYvZywgXCImYW1wO1wiKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAucmVwbGFjZSgvPC9nLCBcIiZsdDtcIilcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgLnJlcGxhY2UoLz4vZywgXCImZ3Q7XCIpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IC5yZXBsYWNlKC9cIi9nLCBcIiZxdW90O1wiKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAucmVwbGFjZSgvJy9nLCBcIiYjMzk7XCIpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0Kyc8L2Rpdj4nO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGNhbGVuZGFyX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0dmFyIGpxX25vZGUgPSAnI2Jvb2tpbmdfZm9ybScgKyBjYWxlbmRhcl9pZDtcclxuXHJcblx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgLCB7ICd0eXBlJyAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIGNhbGVuZGFyX2lkICk7XHJcblx0XHRcdCAgXHQgfVxyXG5cdFx0XHRcdCAvLyA8L2VkaXRvci1mb2xkPlxyXG5cdFx0XHQgIClcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuXHQvLyA8ZWRpdG9yLWZvbGQgICAgIGRlZmF1bHRzdGF0ZT1cImNvbGxhcHNlZFwiICAgICAgICAgICAgICAgICAgICAgICAgZGVzYz1cIiAgPT0gIENBUFRDSEEgPT0gIFwiICA+XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZSBpbWFnZSBpbiBjYXB0Y2hhIGFuZCBzaG93IHdhcm5pbmcgbWVzc2FnZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHBhcmFtc1xyXG5cdCAqXHJcblx0ICogRXhhbXBsZSBvZiAncGFyYW1zJyA6IHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0J3Jlc291cmNlX2lkJzogcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLFxyXG5cdCAqXHRcdFx0XHRcdFx0XHQndXJsJyAgICAgICAgOiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdjYXB0Y2hhX19zaW1wbGUnIF1bICd1cmwnIF0sXHJcblx0ICpcdFx0XHRcdFx0XHRcdCdjaGFsbGVuZ2UnICA6IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2NhcHRjaGFfX3NpbXBsZScgXVsgJ2NoYWxsZW5nZScgXSxcclxuXHQgKlx0XHRcdFx0XHRcdFx0J21lc3NhZ2UnICAgIDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApXHJcblx0ICpcdFx0XHRcdFx0XHR9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYXB0Y2hhX19zaW1wbGVfX3VwZGF0ZSggcGFyYW1zICl7XHJcblxyXG5cdFx0ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkudmFsdWUgPSAnJztcclxuXHRcdGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FwdGNoYV9pbWcnICsgcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gKS5zcmMgPSBwYXJhbXNbICd1cmwnIF07XHJcblx0XHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwZGV2X2NhcHRjaGFfY2hhbGxlbmdlXycgKyBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSApLnZhbHVlID0gcGFyYW1zWyAnY2hhbGxlbmdlJyBdO1xyXG5cclxuXHRcdC8vIFNob3cgd2FybmluZyBcdFx0QWZ0ZXIgQ0FQVENIQSBJbWdcclxuXHRcdHZhciBtZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICsgJyArIGltZycsIHBhcmFtc1sgJ21lc3NhZ2UnIF0gKTtcclxuXHJcblx0XHQvLyBBbmltYXRlXHJcblx0XHRqUXVlcnkoICcjJyArIG1lc3NhZ2VfaWQgKyAnLCAnICsgJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkuZmFkZU91dCggMzUwICkuZmFkZUluKCAzMDAgKS5mYWRlT3V0KCAzNTAgKS5mYWRlSW4oIDQwMCApLmFuaW1hdGUoIHtvcGFjaXR5OiAxfSwgNDAwMCApO1xyXG5cdFx0Ly8gRm9jdXMgdGV4dCAgZmllbGRcclxuXHRcdGpRdWVyeSggJyNjYXB0Y2hhX2lucHV0JyArIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICkudHJpZ2dlciggJ2ZvY3VzJyApOyAgICBcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOC43LjExLjEyLlxyXG5cclxuXHJcblx0XHQvLyBFbmFibGUgU3VibWl0IHwgSGlkZSBzcGluIGxvYWRlclxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX29uX3Jlc3BvbnNlX191aV9lbGVtZW50c19lbmFibGUoIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogSWYgdGhlIGNhcHRjaGEgZWxlbWVudHMgbm90IGV4aXN0ICBpbiB0aGUgYm9va2luZyBmb3JtLCAgdGhlbiAgcmVtb3ZlIHBhcmFtZXRlcnMgcmVsYXRpdmUgY2FwdGNoYVxyXG5cdCAqIEBwYXJhbSBwYXJhbXNcclxuXHQgKiBAcmV0dXJucyBvYmpcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhcHRjaGFfX3NpbXBsZV9fbWF5YmVfcmVtb3ZlX2luX2FqeF9wYXJhbXMoIHBhcmFtcyApe1xyXG5cclxuXHRcdGlmICggISB3cGJjX2NhcHRjaGFfX3NpbXBsZV9faXNfZXhpc3RfaW5fZm9ybSggcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0gKSApe1xyXG5cdFx0XHRkZWxldGUgcGFyYW1zWyAnY2FwdGNoYV9jaGFsYW5nZScgXTtcclxuXHRcdFx0ZGVsZXRlIHBhcmFtc1sgJ2NhcHRjaGFfdXNlcl9pbnB1dCcgXTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBwYXJhbXM7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgaWYgQ0FQVENIQSBleGlzdCBpbiB0aGUgYm9va2luZyBmb3JtXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYXB0Y2hhX19zaW1wbGVfX2lzX2V4aXN0X2luX2Zvcm0oIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0cmV0dXJuIChcclxuXHRcdFx0XHRcdFx0KDAgIT09IGpRdWVyeSggJyN3cGRldl9jYXB0Y2hhX2NoYWxsZW5nZV8nICsgcmVzb3VyY2VfaWQgKS5sZW5ndGgpXHJcblx0XHRcdFx0XHQgfHwgKDAgIT09IGpRdWVyeSggJyNjYXB0Y2hhX2lucHV0JyArIHJlc291cmNlX2lkICkubGVuZ3RoKVxyXG5cdFx0XHRcdCk7XHJcblx0fVxyXG5cclxuXHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cclxuXHJcblx0Ly8gPGVkaXRvci1mb2xkICAgICBkZWZhdWx0c3RhdGU9XCJjb2xsYXBzZWRcIiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2M9XCIgID09ICBTZW5kIEJ1dHRvbiB8IEZvcm0gU3BpbiBMb2FkZXIgID09ICBcIiAgPlxyXG5cclxuXHQvKipcclxuXHQgKiBEaXNhYmxlIFNlbmQgYnV0dG9uICB8ICBTaG93IFNwaW4gTG9hZGVyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fb25fc3VibWl0X191aV9lbGVtZW50c19kaXNhYmxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdC8vIERpc2FibGUgU3VibWl0XHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2Rpc2FibGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gU2hvdyBTcGluIGxvYWRlciBpbiBib29raW5nIGZvcm1cclxuXHRcdHdwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9fc2hvdyggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVuYWJsZSBTZW5kIGJ1dHRvbiAgfCAgIEhpZGUgU3BpbiBMb2FkZXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19vbl9yZXNwb25zZV9fdWlfZWxlbWVudHNfZW5hYmxlKHJlc291cmNlX2lkKXtcclxuXHJcblx0XHQvLyBFbmFibGUgU3VibWl0XHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc2VuZF9idXR0b25fX2VuYWJsZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyBIaWRlIFNwaW4gbG9hZGVyIGluIGJvb2tpbmcgZm9ybVxyXG5cdFx0d3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVuYWJsZSBTdWJtaXQgYnV0dG9uXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3NlbmRfYnV0dG9uX19lbmFibGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHQvLyBBY3RpdmF0ZSBTZW5kIGJ1dHRvblxyXG5cdFx0XHRqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCArICcgaW5wdXRbdHlwZT1idXR0b25dJyApLnByb3AoIFwiZGlzYWJsZWRcIiwgZmFsc2UgKTtcclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGJ1dHRvbicgKS5wcm9wKCBcImRpc2FibGVkXCIsIGZhbHNlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEaXNhYmxlIFN1Ym1pdCBidXR0b24gIGFuZCBzaG93ICBzcGluXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19zZW5kX2J1dHRvbl9fZGlzYWJsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdC8vIERpc2FibGUgU2VuZCBidXR0b25cclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGlucHV0W3R5cGU9YnV0dG9uXScgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcclxuXHRcdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIGJ1dHRvbicgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERpc2FibGUgJ1RoaXMnIGJ1dHRvblxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBfdGhpc1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fdGhpc19idXR0b25fX2Rpc2FibGUoIF90aGlzICl7XHJcblxyXG5cdFx0XHQvLyBEaXNhYmxlIFNlbmQgYnV0dG9uXHJcblx0XHRcdGpRdWVyeSggX3RoaXMgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgYm9va2luZyBmb3JtICBTcGluIExvYWRlclxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9fc2hvdyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdHZhciAkZm9ybV9jb250YWluZXIgPSBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR2YXIgbG9hZGVyX3RleHQgICAgID0gJ1NhdmluZyc7XHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyAmJiBfd3BiYy5nZXRfbWVzc2FnZSApIHtcclxuXHRcdFx0XHRsb2FkZXJfdGV4dCA9IF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9zYXZpbmcnICkgfHwgbG9hZGVyX3RleHQ7XHJcblx0XHRcdH1cclxuXHRcdFx0dmFyIGxvYWRlcl9odG1sICAgICA9ICc8ZGl2IGlkPVwid3BiY19ib29raW5nX2Zvcm1fc3Bpbl9sb2FkZXInICsgcmVzb3VyY2VfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlciB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXRfb3ZlcmxheVwiIGFyaWEtbGl2ZT1cInBvbGl0ZVwiIGFyaWEtaGlkZGVuPVwiZmFsc2VcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkaW5nX2NvbnRhaW5lclwiPidcclxuXHRcdFx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlclwiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIndwYmNfc3Bpbl9sb2FkZXJfb25lX25ld1wiPjwvZGl2PjwvZGl2PjwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdCsgJzxzcGFuPicgKyBsb2FkZXJfdGV4dCArICcuLi48L3NwYW4+J1xyXG5cdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+JztcclxuXHJcblx0XHRcdC8vIFJlbW92ZSBhbnkgcHJldmlvdXMgaW5saW5lIGxvYWRlciBiZWZvcmUgYWRkaW5nIHRoZSBzdWJtaXQgb3ZlcmxheS5cclxuXHRcdFx0alF1ZXJ5KCAnI3dwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyJyArIHJlc291cmNlX2lkICkucmVtb3ZlKCk7XHJcblxyXG5cdFx0XHRpZiAoICRmb3JtX2NvbnRhaW5lci5sZW5ndGggJiYgJGZvcm1fY29udGFpbmVyLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHRcdFx0JGZvcm1fY29udGFpbmVyLmFkZENsYXNzKCAnd3BiY19ib29raW5nX2Zvcm1faXNfc3VibWl0dGluZycgKTtcclxuXHRcdFx0XHQkZm9ybV9jb250YWluZXIucHJlcGVuZCggbG9hZGVyX2h0bWwgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZhbGxiYWNrIGZvciBhbnkgdW5leHBlY3RlZCBsZWdhY3kgbWFya3VwIHdpdGhvdXQgI2Jvb2tpbmdfZm9ybV9kaXZ7cmVzb3VyY2VfaWR9LlxyXG5cdFx0XHRqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkuYWZ0ZXIoXHJcblx0XHRcdFx0JzxkaXYgaWQ9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlcicgKyByZXNvdXJjZV9pZCArICdcIiBjbGFzcz1cIndwYmNfYm9va2luZ19mb3JtX3NwaW5fbG9hZGVyXCIgc3R5bGU9XCJwb3NpdGlvbjogcmVsYXRpdmU7XCI+PGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXJcIj48ZGl2IGNsYXNzPVwid3BiY19zcGluX2xvYWRlcl9vbmVfbmV3XCI+PC9kaXY+PC9kaXY+PC9kaXY+J1xyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIC8gSGlkZSBib29raW5nIGZvcm0gIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX3NwaW5fbG9hZGVyX19oaWRlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0Ly8gUmVtb3ZlIFNwaW4gTG9hZGVyXHJcblx0XHRcdGpRdWVyeSggJyN3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlcicgKyByZXNvdXJjZV9pZCApLnJlbW92ZSgpO1xyXG5cdFx0XHRqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19ib29raW5nX2Zvcm1faXNfc3VibWl0dGluZycgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIaWRlIGJvb2tpbmcgZm9ybSB3dGggYW5pbWF0aW9uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19mb3JtX19hbmltYXRlZF9faGlkZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5oaWRlKCk7XHJcblx0XHR9XHJcblx0Ly8gPC9lZGl0b3ItZm9sZD5cclxuXHJcblxyXG5cdC8vIDxlZGl0b3ItZm9sZCAgICAgZGVmYXVsdHN0YXRlPVwiY29sbGFwc2VkXCIgICAgICAgICAgICAgICAgICAgICAgICBkZXNjPVwiICA9PSAgTWluaSBTcGluIExvYWRlciAgPT0gIFwiICA+XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHBhcmVudF9odG1sX2lkXHJcblx0XHQgKi9cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgbWljcm8gU3BpbiBMb2FkZXJcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gaWRcdFx0XHRcdFx0XHRJRCBvZiBMb2FkZXIsICBmb3IgbGF0ZXIgIGhpZGUgaXQgYnkgIHVzaW5nIFx0XHR3cGJjX19zcGluX2xvYWRlcl9fbWljcm9fX2hpZGUoIGlkICkgT1Igd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUoIGlkIClcclxuXHRcdCAqIEBwYXJhbSBqcV9ub2RlX3doZXJlX2luc2VydFx0XHRzdWNoIGFzICcjZXN0aW1hdGVfYm9va2luZ19uaWdodF9jb3N0X2hpbnQxMCcgICBPUiAgJy5lc3RpbWF0ZV9ib29raW5nX25pZ2h0X2Nvc3RfaGludDEwJ1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX19zcGluX2xvYWRlcl9fbWljcm9fX3Nob3dfX2luc2lkZSggaWQgLCBqcV9ub2RlX3doZXJlX2luc2VydCApe1xyXG5cclxuXHRcdFx0XHR3cGJjX19zcGluX2xvYWRlcl9fbWluaV9fc2hvdyggaWQsIHtcclxuXHRcdFx0XHRcdCdjb2xvcicgIDogJyM0NDQnLFxyXG5cdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHtcclxuXHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnaW5zaWRlJyxcclxuXHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlX3doZXJlX2luc2VydFxyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdCdzdHlsZScgICAgOiAncG9zaXRpb246IHJlbGF0aXZlO2Rpc3BsYXk6IGlubGluZS1mbGV4O2ZsZXgtZmxvdzogY29sdW1uIG5vd3JhcDtqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjthbGlnbi1pdGVtczogY2VudGVyO21hcmdpbjogN3B4IDEycHg7JyxcclxuXHRcdFx0XHRcdCdjbGFzcycgICAgOiAnd3BiY19vbmVfc3Bpbl9sb2FkZXJfbWljcm8nXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIHNwaW5uZXJcclxuXHRcdCAqIEBwYXJhbSBpZFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX19zcGluX2xvYWRlcl9fbWljcm9fX2hpZGUoIGlkICl7XHJcblx0XHQgICAgd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUoIGlkICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2hvdyBtaW5pIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcGFyZW50X2h0bWxfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX3Nob3coIHBhcmVudF9odG1sX2lkICwgcGFyYW1zID0ge30gKXtcclxuXHJcblx0XHRcdHZhciBwYXJhbXNfZGVmYXVsdCA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2NvbG9yJyAgICA6ICcjMDA3MWNlJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6ICcnLFx0XHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJ1x0XHRcdFx0Ly8gJ2luc2lkZScgfCAnYmVmb3JlJyB8ICdhZnRlcicgfCAncmlnaHQnIHwgJ2xlZnQnXHJcblx0XHRcdFx0XHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAncG9zaXRpb246IHJlbGF0aXZlO21pbi1oZWlnaHQ6IDIuOHJlbTsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnY2xhc3MnICAgIDogJ3dwYmNfb25lX3NwaW5fbG9hZGVyX21pbmkgMHdwYmNfc3Bpbl9sb2FkZXJfb25lX25ldydcclxuXHRcdFx0XHRcdFx0XHRcdH07XHJcblx0XHRcdGZvciAoIHZhciBwX2tleSBpbiBwYXJhbXMgKXtcclxuXHRcdFx0XHRwYXJhbXNfZGVmYXVsdFsgcF9rZXkgXSA9IHBhcmFtc1sgcF9rZXkgXTtcclxuXHRcdFx0fVxyXG5cdFx0XHRwYXJhbXMgPSBwYXJhbXNfZGVmYXVsdDtcclxuXHJcblx0XHRcdGlmICggKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHBhcmFtc1snY29sb3InXSkpICYmICgnJyAhPSBwYXJhbXNbJ2NvbG9yJ10pICl7XHJcblx0XHRcdFx0cGFyYW1zWydjb2xvciddID0gJ2JvcmRlci1jb2xvcjonICsgcGFyYW1zWydjb2xvciddICsgJzsnO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgc3Bpbm5lcl9odG1sID0gJzxkaXYgaWQ9XCJ3cGJjX21pbmlfc3Bpbl9sb2FkZXInICsgcGFyZW50X2h0bWxfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Jvb2tpbmdfZm9ybV9zcGluX2xvYWRlclwiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ3N0eWxlJyBdICsgJ1wiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIicgKyBwYXJhbXNbICdjbGFzcycgXSArICdcIiBzdHlsZT1cIicgKyBwYXJhbXNbICdjb2xvcicgXSArICdcIj48L2Rpdj48L2Rpdj48L2Rpdj4nO1xyXG5cclxuXHRcdFx0aWYgKCAnJyA9PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICl7XHJcblx0XHRcdFx0cGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSA9ICcjJyArIHBhcmVudF9odG1sX2lkO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTaG93IFNwaW4gTG9hZGVyXHJcblx0XHRcdGlmICggJ2FmdGVyJyA9PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cdFx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFmdGVyKCBzcGlubmVyX2h0bWwgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5odG1sKCBzcGlubmVyX2h0bWwgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUmVtb3ZlIC8gSGlkZSBtaW5pIFNwaW4gTG9hZGVyXHJcblx0XHQgKiBAcGFyYW0gcGFyZW50X2h0bWxfaWRcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19fc3Bpbl9sb2FkZXJfX21pbmlfX2hpZGUoIHBhcmVudF9odG1sX2lkICl7XHJcblxyXG5cdFx0XHQvLyBSZW1vdmUgU3BpbiBMb2FkZXJcclxuXHRcdFx0alF1ZXJ5KCAnI3dwYmNfbWluaV9zcGluX2xvYWRlcicgKyBwYXJlbnRfaHRtbF9pZCApLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cclxuXHQvLyA8L2VkaXRvci1mb2xkPlxyXG5cclxuLy9UT0RPOiB3aGF0ICBhYm91dCBzaG93aW5nIG9ubHkgIFRoYW5rIHlvdS4gbWVzc2FnZSB3aXRob3V0IHBheW1lbnQgZm9ybXMuXHJcbi8qKlxyXG4gKiBTaG93ICdUaGFuayB5b3UnLiBtZXNzYWdlIGFuZCBwYXltZW50IGZvcm1zXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3Nob3dfdGhhbmtfeW91X21lc3NhZ2VfYWZ0ZXJfYm9va2luZyggcmVzcG9uc2VfZGF0YSApe1xyXG5cclxuXHRpZiAoXHJcbiBcdFx0ICAgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfaXNfcmVkaXJlY3QnIF0pKVxyXG5cdFx0JiYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfdXJsJyBdKSlcclxuXHRcdCYmICgncGFnZScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9pc19yZWRpcmVjdCcgXSlcclxuXHRcdCYmICgnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3VybCcgXSlcclxuXHQpe1xyXG5cdFx0alF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19ib29raW5nX2NyZWF0ZWQnLCBbIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSAsIHJlc3BvbnNlX2RhdGEgXSApO1x0XHRcdC8vIEZpeEluOiAxMC4wLjAuMzAuXHJcblx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfdXJsJyBdO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyIHJlc291cmNlX2lkID0gcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdXHJcblx0dmFyIGNvbmZpcm1fY29udGVudCA9Jyc7XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdID0gJyc7XHJcblx0fVxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb24nIF0gKSApe1xyXG5cdFx0IFx0XHRcdCAgXHRcdFx0IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uJyBdID0gJyc7XHJcblx0fVxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0gKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0gPSAnJztcclxuXHR9XHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfZ2F0ZXdheXMnIF0gKSApe1xyXG5cdFx0XHRcdFx0ICBcdFx0XHQgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X2dhdGV3YXlzJyBdID0gJyc7XHJcblx0fVxyXG5cdHZhciB0eV9tZXNzYWdlX2hpZGUgXHRcdFx0XHRcdFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlJyBdKSA/ICd3cGJjX3R5X2hpZGUnIDogJyc7XHJcblx0dmFyIHR5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbl9oaWRlIFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9wYXltZW50X3BheW1lbnRfZGVzY3JpcHRpb24nIF0ucmVwbGFjZSggL1xcXFxuL2csICcnICkpID8gJ3dwYmNfdHlfaGlkZScgOiAnJztcclxuXHR2YXIgdHlfYm9va2luZ19jb3N0c19oaWRlIFx0XHRcdFx0PSAoJycgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICdwYXltZW50X2Nvc3QnIF0pID8gJ3dwYmNfdHlfaGlkZScgOiAnJztcclxuXHR2YXIgdHlfcGF5bWVudF9nYXRld2F5c19oaWRlIFx0XHRcdD0gKCcnID09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9nYXRld2F5cycgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKSkgPyAnd3BiY190eV9oaWRlJyA6ICcnO1xyXG5cclxuXHRpZiAoICd3cGJjX3R5X2hpZGUnICE9IHR5X3BheW1lbnRfZ2F0ZXdheXNfaGlkZSApe1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdHlfX2NvbnRlbnRfdGV4dC53cGJjX3R5X19jb250ZW50X2dhdGV3YXlzJyApLmh0bWwoICcnICk7XHQvLyBSZXNldCAgYWxsICBvdGhlciBwb3NzaWJsZSBnYXRld2F5cyBiZWZvcmUgc2hvd2luZyBuZXcgb25lLlxyXG5cdH1cclxuXHJcblx0Y29uZmlybV9jb250ZW50ICs9IGA8ZGl2IGlkPVwid3BiY19zY3JvbGxfcG9pbnRfJHtyZXNvdXJjZV9pZH1cIj48L2Rpdj5gO1xyXG5cdGNvbmZpcm1fY29udGVudCArPSBgICA8ZGl2IGNsYXNzPVwid3BiY19hZnRlcl9ib29raW5nX3RoYW5rX3lvdV9zZWN0aW9uXCI+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICA8ZGl2IGNsYXNzPVwid3BiY190eV9fbWVzc2FnZSAke3R5X21lc3NhZ2VfaGlkZX1cIj4ke3Jlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfbWVzc2FnZScgXX08L2Rpdj5gO1xyXG4gICAgY29uZmlybV9jb250ZW50ICs9IGAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRhaW5lclwiPmA7XHJcblx0aWYgKCAnJyAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlX2Jvb2tpbmdfaWQnIF0gKXtcclxuXHRcdGNvbmZpcm1fY29udGVudCArPSBgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2hlYWRlclwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9tZXNzYWdlX2Jvb2tpbmdfaWQnIF19PC9kaXY+YDtcclxuXHR9XHJcbiAgICBjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50XCI+YDtcclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX3R5X19wYXltZW50X2Rlc2NyaXB0aW9uICR7dHlfcGF5bWVudF9wYXltZW50X2Rlc2NyaXB0aW9uX2hpZGV9XCI+JHtyZXNwb25zZV9kYXRhWyAnYWp4X2NvbmZpcm1hdGlvbicgXVsgJ3R5X3BheW1lbnRfcGF5bWVudF9kZXNjcmlwdGlvbicgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKX08L2Rpdj5gO1xyXG5cdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfY3VzdG9tZXJfZGV0YWlscycgXSApe1xyXG5cdFx0Y29uZmlybV9jb250ZW50ICs9IGAgICAgICBcdDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50X3RleHQgd3BiY19jb2xzXzJcIj4ke3Jlc3BvbnNlX2RhdGFbJ2FqeF9jb25maXJtYXRpb24nXVsndHlfY3VzdG9tZXJfZGV0YWlscyddfTwvZGl2PmA7XHJcblx0fVxyXG5cdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfYm9va2luZ19kZXRhaWxzJyBdICl7XHJcblx0XHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgIFx0PGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX2NvbHNfMlwiPiR7cmVzcG9uc2VfZGF0YVsnYWp4X2NvbmZpcm1hdGlvbiddWyd0eV9ib29raW5nX2RldGFpbHMnXX08L2Rpdj5gO1xyXG5cdH1cclxuXHRjb25maXJtX2NvbnRlbnQgKz0gYCAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdHlfX2NvbnRlbnRfdGV4dCB3cGJjX3R5X19jb250ZW50X2Nvc3RzICR7dHlfYm9va2luZ19jb3N0c19oaWRlfVwiPiR7cmVzcG9uc2VfZGF0YVsgJ2FqeF9jb25maXJtYXRpb24nIF1bICd0eV9ib29raW5nX2Nvc3RzJyBdfTwvZGl2PmA7XHJcblx0Y29uZmlybV9jb250ZW50ICs9IGAgICAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3R5X19jb250ZW50X3RleHQgd3BiY190eV9fY29udGVudF9nYXRld2F5cyAke3R5X3BheW1lbnRfZ2F0ZXdheXNfaGlkZX1cIj4ke3Jlc3BvbnNlX2RhdGFbICdhanhfY29uZmlybWF0aW9uJyBdWyAndHlfcGF5bWVudF9nYXRld2F5cycgXS5yZXBsYWNlKCAvXFxcXG4vZywgJycgKS5yZXBsYWNlKCAvYWpheF9zY3JpcHQvZ2ksICdzY3JpcHQnICl9PC9kaXY+YDtcclxuICAgIGNvbmZpcm1fY29udGVudCArPSBgICAgICAgPC9kaXY+YDtcclxuICAgIGNvbmZpcm1fY29udGVudCArPSBgICAgIDwvZGl2PmA7XHJcblx0Y29uZmlybV9jb250ZW50ICs9IGA8L2Rpdj5gO1xyXG5cclxuIFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLmFmdGVyKCBjb25maXJtX2NvbnRlbnQgKTtcclxuXHJcblxyXG5cdC8vRml4SW46IDEwLjAuMC4zMFx0XHQvLyBldmVudCBuYW1lXHRcdFx0Ly8gUmVzb3VyY2UgSURcdC1cdCcxJ1xyXG5cdGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggJ3dwYmNfYm9va2luZ19jcmVhdGVkJywgWyByZXNvdXJjZV9pZCAsIHJlc3BvbnNlX2RhdGEgXSApO1xyXG5cdC8vIFRvIGNhdGNoIHRoaXMgZXZlbnQ6IGpRdWVyeSggJ2JvZHknICkub24oJ3dwYmNfYm9va2luZ19jcmVhdGVkJywgZnVuY3Rpb24oIGV2ZW50LCByZXNvdXJjZV9pZCwgcGFyYW1zICkgeyBjb25zb2xlLmxvZyggZXZlbnQsIHJlc291cmNlX2lkLCBwYXJhbXMgKTsgfSApO1xyXG59XHJcbiJdLCJt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
