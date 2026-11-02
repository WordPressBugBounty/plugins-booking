"use strict";

/**
 *   Ajax   ----------------------------------------------------------------------------------------------------- */
//var is_this_action = false;
/**
 * Send Ajax action request,  like approving or cancellation
 *
 * @param action_param
 */
function wpbc_ajx_booking_ajax_action_request(action_param = {}) {
  var action_i18n = window.wpbc_booking_actions_i18n || {};
  console.groupCollapsed('WPBC_AJX_BOOKING_ACTIONS');
  console.log(' == Ajax Actions :: Params == ', action_param);
  //is_this_action = true;

  wpbc_admin_show_message_processing('');
  wpbc_booking_listing_reload_button__spin_start();

  // Get redefined Locale,  if action on single booking !
  if (undefined != action_param['booking_id'] && !Array.isArray(action_param['booking_id'])) {
    // Not array

    action_param['locale'] = wpbc_get_selected_locale(action_param['booking_id'], wpbc_ajx_booking_listing.get_secure_param('locale'));
  }
  var action_post_params = {
    action: 'WPBC_AJX_BOOKING_ACTIONS',
    nonce: wpbc_ajx_booking_listing.get_secure_param('nonce'),
    wpbc_ajx_user_id: undefined == action_param['user_id'] ? wpbc_ajx_booking_listing.get_secure_param('user_id') : action_param['user_id'],
    wpbc_ajx_locale: undefined == action_param['locale'] ? wpbc_ajx_booking_listing.get_secure_param('locale') : action_param['locale'],
    action_params: action_param
  };

  // It's required for CSV export - getting the same list  of bookings
  if (typeof action_param.search_params !== 'undefined') {
    action_post_params['search_params'] = action_param.search_params;
    delete action_post_params.action_params.search_params;
  }
  wpbc_ajx_booking_action_dispatch_start(action_param);

  // Start Ajax
  jQuery.post(wpbc_url_ajax, action_post_params,
  /**
   * S u c c e s s
   *
   * @param response_data		-	its object returned from  Ajax - class-live-searcg.php
   * @param textStatus		-	'success'
   * @param jqXHR				-	Object
   */
  function (response_data, textStatus, jqXHR) {
    var response_params = response_data && 'object' === typeof response_data['ajx_after_action_result_all_params_arr'] ? response_data['ajx_after_action_result_all_params_arr'] : null;
    var is_action_success;
    var action_message;
    console.log(' == Ajax Actions :: Response WPBC_AJX_BOOKING_ACTIONS == ', response_data);
    console.groupEnd();

    // Probably Error
    if (typeof response_data !== 'object' || response_data === null || 'string' !== typeof response_data['ajx_after_action_message'] || 'undefined' === typeof response_data['ajx_after_action_result'] || !response_params) {
      wpbc_booking_listing_reload_button__spin_pause();
      action_message = '<strong>' + (action_i18n.error_label || '') + '</strong> ' + (action_i18n.invalid_response || '');
      wpbc_admin_show_message(action_message, 'error', 10000);
      wpbc_ajx_booking_action_dispatch_complete(action_param, false, action_message);
      if (action_param['ui_clicked_element_id']) {
        wpbc_button__remove_spin(action_param['ui_clicked_element_id']);
      }
      return;
    }
    wpbc_booking_listing_reload_button__spin_pause();
    is_action_success = '1' == response_data['ajx_after_action_result'];
    action_message = response_data['ajx_after_action_message'];
    wpbc_admin_show_message(action_message.replace(/\n/g, "<br />"), is_action_success ? 'success' : 'error', 'undefined' === typeof response_params['after_action_result_delay'] ? 10000 : response_params['after_action_result_delay']);
    wpbc_ajx_booking_action_dispatch_complete(action_param, is_action_success, action_message);

    // Success response
    if (is_action_success) {
      var is_reload_ajax_listing = true;

      // After Google Calendar import show imported bookings and reload the page for toolbar parameters update
      if (response_params['new_listing_params'] && 'object' === typeof response_params['new_listing_params']) {
        wpbc_ajx_booking_send_search_request_with_params(response_params['new_listing_params']);
        var closed_timer = setTimeout(function () {
          if (wpbc_booking_listing_reload_button__is_spin()) {
            if (undefined != response_params['new_listing_params']['reload_url_params']) {
              document.location.href = response_params['new_listing_params']['reload_url_params'];
            } else {
              document.location.reload();
            }
          }
        }, 2000);
        is_reload_ajax_listing = false;
      }

      // Start download exported CSV file
      if (undefined != response_params['export_csv_url']) {
        wpbc_ajx_booking__export_csv_url__download(response_params['export_csv_url']);
        is_reload_ajax_listing = false;
      }
      if (is_reload_ajax_listing && jQuery('.wpbc__list__table').length) {
        wpbc_ajx_booking__actual_listing__show(); //	Sending Ajax Request	-	with parameters that  we early  defined in "wpbc_ajx_booking_listing" Obj.
      }
    }

    // Remove spin icon from  button and Enable this button.
    wpbc_button__remove_spin(response_data['ajx_cleaned_params'] && response_data['ajx_cleaned_params']['ui_clicked_element_id'] ? response_data['ajx_cleaned_params']['ui_clicked_element_id'] : action_param['ui_clicked_element_id']);

    // Hide modals
    wpbc_popup_modals__hide();
    jQuery('#ajax_respond').html(response_data); // For ability to show response, add such DIV element to page
  }).fail(function (jqXHR, textStatus, errorThrown) {
    if (window.console && window.console.log) {
      console.log('Ajax_Error', jqXHR, textStatus, errorThrown);
    }
    wpbc_booking_listing_reload_button__spin_pause();
    jQuery('.wpbc_ajx_under_toolbar_row').hide(); // FixIn: 9.6.1.5.
    var error_message = '<strong>' + (action_i18n.error_label || '') + '</strong> ' + (errorThrown || action_i18n.request_failed || '');
    if (jqXHR.responseJSON && jqXHR.responseJSON.data && jqXHR.responseJSON.data.message) {
      error_message = String(jqXHR.responseJSON.data.message);
    }
    error_message = error_message.replace(/\n/g, "<br />");
    wpbc_admin_show_message(error_message, 'error', 10000);
    wpbc_ajx_booking_action_dispatch_complete(action_param, false, error_message);
    if (action_param['ui_clicked_element_id']) {
      wpbc_button__remove_spin(action_param['ui_clicked_element_id']);
    }
  })
  // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
  ; // End Ajax
}

/**
 * Notify Inspector and other hosts when a canonical booking action starts.
 *
 * The event deliberately contains only the stable booking identifier and
 * action name. Hosts may retain that identity across their own view teardown,
 * but authorization and persistence remain owned by the canonical request.
 *
 * @param {Object} action_param Submitted booking action parameters.
 * @return {void}
 */
function wpbc_ajx_booking_action_dispatch_start(action_param) {
  if ('function' !== typeof window.CustomEvent) {
    return;
  }
  window.dispatchEvent(new window.CustomEvent('wpbc:booking-action:start', {
    detail: {
      booking_id: action_param.booking_id || 0,
      action: action_param.booking_action || ''
    }
  }));
}

/**
 * Convert one canonical Booking Action message to plain text for host UIs.
 *
 * The page-level notice retains its established limited HTML presentation.
 * Host components receive text only, so response markup is never copied into
 * another presentation boundary.
 *
 * @param {string} action_message Canonical Booking Action result message.
 * @return {string} Normalized plain-text message.
 */
function wpbc_ajx_booking_action_message_to_text(action_message) {
  var message_decoder = document.createElement('textarea');
  var message_text = String(action_message || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, ' ');
  message_decoder.innerHTML = message_text;
  return String(message_decoder.value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Notify Inspector and other hosts when a canonical booking action completes.
 *
 * @param {Object} action_param Submitted booking action parameters.
 * @param {boolean} is_success Whether persistence completed successfully.
 * @param {string} action_message Canonical Booking Action result message.
 * @return {void}
 */
function wpbc_ajx_booking_action_dispatch_complete(action_param, is_success, action_message) {
  if ('function' !== typeof window.CustomEvent) {
    return;
  }
  window.dispatchEvent(new window.CustomEvent('wpbc:booking-action:complete', {
    detail: {
      booking_id: action_param.booking_id || 0,
      action: action_param.booking_action || '',
      success: Boolean(is_success),
      message: wpbc_ajx_booking_action_message_to_text(action_message)
    }
  }));
}

/**
 * Hide all open modal popups windows
 */
function wpbc_popup_modals__hide() {
  // Hide modals
  if ('function' === typeof jQuery('.wpbc_popup_modal').wpbc_my_modal) {
    jQuery('.wpbc_popup_modal').wpbc_my_modal('hide');
  }
}

/**
 *   Dates  Short <-> Wide    ----------------------------------------------------------------------------------- */

function wpbc_ajx_click_on_dates_short() {
  jQuery('#booking_dates_small,.booking_dates_full').hide();
  jQuery('#booking_dates_full,.booking_dates_small').show();
  wpbc_ajx_booking_send_search_request_with_params({
    'ui_usr__dates_short_wide': 'short'
  });
}
function wpbc_ajx_click_on_dates_wide() {
  jQuery('#booking_dates_full,.booking_dates_small').hide();
  jQuery('#booking_dates_small,.booking_dates_full').show();
  wpbc_ajx_booking_send_search_request_with_params({
    'ui_usr__dates_short_wide': 'wide'
  });
}
function wpbc_ajx_click_on_dates_toggle(this_date) {
  jQuery(this_date).parents('.wpbc_col_dates').find('.booking_dates_small').toggle();
  jQuery(this_date).parents('.wpbc_col_dates').find('.booking_dates_full').toggle();

  /*
  var visible_section = jQuery( this_date ).parents( '.booking_dates_expand_section' );
  visible_section.hide();
  if ( visible_section.hasClass( 'booking_dates_full' ) ){
  	visible_section.parents( '.wpbc_col_dates' ).find( '.booking_dates_small' ).show();
  } else {
  	visible_section.parents( '.wpbc_col_dates' ).find( '.booking_dates_full' ).show();
  }*/
  console.log('wpbc_ajx_click_on_dates_toggle', this_date);
}

/**
 *   Locale   --------------------------------------------------------------------------------------------------- */

/**
 * 	Select options in select boxes based on attribute "value_of_selected_option" and RED color and hint for LOCALE button   --  It's called from 	wpbc_ajx_booking_define_ui_hooks()  	each  time after Listing loading.
 */
function wpbc_ajx_booking__ui_define__locale() {
  jQuery('.wpbc__list__table select').each(function (index) {
    var selection = jQuery(this).attr("value_of_selected_option"); // Define selected select boxes

    if (undefined !== selection) {
      jQuery(this).find('option[value="' + selection + '"]').prop('selected', true);
      if ('' != selection && jQuery(this).hasClass('set_booking_locale_selectbox')) {
        // Locale

        var booking_locale_button = jQuery(this).parents('.ui_element_locale').find('.set_booking_locale_button');

        //booking_locale_button.css( 'color', '#db4800' );		// Set button  red
        booking_locale_button.addClass('wpbc_ui_red'); // Set button  red
        if ('function' === typeof wpbc_tippy) {
          booking_locale_button.get(0)._tippy.setContent(selection);
        }
      }
    }
  });
}

/**
 *   Remark   --------------------------------------------------------------------------------------------------- */

/**
 * Define content of remark "booking note" button and textarea.  -- It's called from 	wpbc_ajx_booking_define_ui_hooks()  	each  time after Listing loading.
 */
function wpbc_ajx_booking__ui_define__remark() {
  jQuery('.wpbc__list__table .ui_remark_section textarea').each(function (index) {
    var text_val = jQuery(this).val();
    if (undefined !== text_val && '' != text_val) {
      var remark_button = jQuery(this).parents('.ui_group').find('.set_booking_note_button');
      if (remark_button.length > 0) {
        remark_button.addClass('wpbc_ui_red'); // Set button  red
        if ('function' === typeof wpbc_tippy) {
          //remark_button.get( 0 )._tippy.allowHTML = true;
          //remark_button.get( 0 )._tippy.setContent( text_val.replace(/[\n\r]/g, '<br>') );

          remark_button.get(0)._tippy.setProps({
            allowHTML: true,
            content: text_val.replace(/[\n\r]/g, '<br>')
          });
        }
      }
    }
  });
}
function wpbc_ajx_booking__ui_click_save__change_resource(this_el, booking_action, el_id) {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': booking_action,
    'booking_id': jQuery('#change_booking_resource__booking_id').val(),
    'selected_resource_id': jQuery('#change_booking_resource__resource_select').val(),
    'ui_clicked_element_id': el_id
  });
  wpbc_button_enable_loading_icon(this_el);
}
function wpbc_ajx_booking__ui_click_save__duplicate_booking(this_el, booking_action, el_id) {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': booking_action,
    'booking_id': jQuery('#duplicate_booking_to_other_resource__booking_id').val(),
    'selected_resource_id': jQuery('#duplicate_booking_to_other_resource__resource_select').val(),
    'ui_clicked_element_id': el_id
  });
  wpbc_button_enable_loading_icon(this_el);
}

//TODO: delete

/**
 *   Change booking cost   -------------------------------------------------------------------------------------- */

function wpbc_ajx_booking__ui_click_save__set_booking_cost(booking_id, this_el, booking_action, el_id) {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': booking_action,
    'booking_id': booking_id,
    'booking_cost': jQuery('#ui_btn_set_booking_cost' + booking_id + '_cost').val(),
    'ui_clicked_element_id': el_id + '_save'
  });
  wpbc_button_enable_loading_icon(this_el);
  jQuery('#' + el_id + '_cancel').hide();
  //wpbc_button_enable_loading_icon( jQuery( '#' + el_id + '_cancel').get(0) );
}
function wpbc_ajx_booking__ui_click_close__set_booking_cost() {
  // Hide all change  payment status for booking
  jQuery(".ui__set_booking_cost__section_in_booking").hide();
}

/**
 *   Send Payment request   -------------------------------------------------------------------------------------- */

function wpbc_ajx_booking__ui_click__send_payment_request() {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': 'send_payment_request',
    'booking_id': jQuery('#wpbc_modal__payment_request__booking_id').val(),
    'reason_of_action': jQuery('#wpbc_modal__payment_request__reason_of_action').val(),
    'ui_clicked_element_id': 'wpbc_modal__payment_request__button_send'
  });
  wpbc_button_enable_loading_icon(jQuery('#wpbc_modal__payment_request__button_send').get(0));
}

/**
 *   Import Google Calendar  ------------------------------------------------------------------------------------ */

function wpbc_ajx_booking__ui_click__import_google_calendar() {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': 'import_google_calendar',
    'ui_clicked_element_id': 'wpbc_modal__import_google_calendar__button_send',
    'booking_gcal_events_from': jQuery('#wpbc_modal__import_google_calendar__section #booking_gcal_events_from option:selected').val(),
    'booking_gcal_events_from_offset': jQuery('#wpbc_modal__import_google_calendar__section #booking_gcal_events_from_offset').val(),
    'booking_gcal_events_from_offset_type': jQuery('#wpbc_modal__import_google_calendar__section #booking_gcal_events_from_offset_type option:selected').val(),
    'booking_gcal_events_until': jQuery('#wpbc_modal__import_google_calendar__section #booking_gcal_events_until option:selected').val(),
    'booking_gcal_events_until_offset': jQuery('#wpbc_modal__import_google_calendar__section #booking_gcal_events_until_offset').val(),
    'booking_gcal_events_until_offset_type': jQuery('#wpbc_modal__import_google_calendar__section #booking_gcal_events_until_offset_type option:selected').val(),
    'booking_gcal_events_max': jQuery('#wpbc_modal__import_google_calendar__section #booking_gcal_events_max').val(),
    'booking_gcal_resource': jQuery('#wpbc_modal__import_google_calendar__section #wpbc_booking_resource option:selected').val()
  });
  wpbc_button_enable_loading_icon(jQuery('#wpbc_modal__import_google_calendar__section #wpbc_modal__import_google_calendar__button_send').get(0));
}

/**
 *   Export bookings to CSV  ------------------------------------------------------------------------------------ */
function wpbc_ajx_booking__ui_click__export_csv(params) {
  var selected_booking_id_arr = wpbc_get_selected_row_id();
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': params['booking_action'],
    'ui_clicked_element_id': params['ui_clicked_element_id'],
    'export_type': params['export_type'],
    'csv_export_separator': params['csv_export_separator'],
    'csv_export_skip_fields': params['csv_export_skip_fields'],
    'booking_id': selected_booking_id_arr.join(','),
    'search_params': wpbc_ajx_booking_listing.search_get_all_params()
  });
  var this_el = jQuery('#' + params['ui_clicked_element_id']).get(0);
  wpbc_button_enable_loading_icon(this_el);
}

/**
 * Open URL in new tab - mainly  it's used for open CSV link  for downloaded exported bookings as CSV
 *
 * @param export_csv_url
 */
function wpbc_ajx_booking__export_csv_url__download(export_csv_url) {
  //var selected_booking_id_arr = wpbc_get_selected_row_id();

  document.location.href = export_csv_url; // + '&selected_id=' + selected_booking_id_arr.join(',');

  // It's open additional dialog for asking opening ulr in new tab
  // window.open( export_csv_url, '_blank').focus();
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19hY3Rpb25zLmpzIiwibmFtZXMiOlsid3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0IiwiYWN0aW9uX3BhcmFtIiwiYWN0aW9uX2kxOG4iLCJ3aW5kb3ciLCJ3cGJjX2Jvb2tpbmdfYWN0aW9uc19pMThuIiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwibG9nIiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJ1bmRlZmluZWQiLCJBcnJheSIsImlzQXJyYXkiLCJ3cGJjX2dldF9zZWxlY3RlZF9sb2NhbGUiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCJnZXRfc2VjdXJlX3BhcmFtIiwiYWN0aW9uX3Bvc3RfcGFyYW1zIiwiYWN0aW9uIiwibm9uY2UiLCJ3cGJjX2FqeF91c2VyX2lkIiwid3BiY19hanhfbG9jYWxlIiwiYWN0aW9uX3BhcmFtcyIsInNlYXJjaF9wYXJhbXMiLCJ3cGJjX2FqeF9ib29raW5nX2FjdGlvbl9kaXNwYXRjaF9zdGFydCIsImpRdWVyeSIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsInJlc3BvbnNlX3BhcmFtcyIsImlzX2FjdGlvbl9zdWNjZXNzIiwiYWN0aW9uX21lc3NhZ2UiLCJncm91cEVuZCIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UiLCJlcnJvcl9sYWJlbCIsImludmFsaWRfcmVzcG9uc2UiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsIndwYmNfYWp4X2Jvb2tpbmdfYWN0aW9uX2Rpc3BhdGNoX2NvbXBsZXRlIiwid3BiY19idXR0b25fX3JlbW92ZV9zcGluIiwicmVwbGFjZSIsImlzX3JlbG9hZF9hamF4X2xpc3RpbmciLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMiLCJjbG9zZWRfdGltZXIiLCJzZXRUaW1lb3V0Iiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9faXNfc3BpbiIsImRvY3VtZW50IiwibG9jYXRpb24iLCJocmVmIiwicmVsb2FkIiwid3BiY19hanhfYm9va2luZ19fZXhwb3J0X2Nzdl91cmxfX2Rvd25sb2FkIiwibGVuZ3RoIiwid3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3ciLCJ3cGJjX3BvcHVwX21vZGFsc19faGlkZSIsImh0bWwiLCJmYWlsIiwiZXJyb3JUaHJvd24iLCJoaWRlIiwiZXJyb3JfbWVzc2FnZSIsInJlcXVlc3RfZmFpbGVkIiwicmVzcG9uc2VKU09OIiwiZGF0YSIsIm1lc3NhZ2UiLCJTdHJpbmciLCJDdXN0b21FdmVudCIsImRpc3BhdGNoRXZlbnQiLCJkZXRhaWwiLCJib29raW5nX2lkIiwiYm9va2luZ19hY3Rpb24iLCJ3cGJjX2FqeF9ib29raW5nX2FjdGlvbl9tZXNzYWdlX3RvX3RleHQiLCJtZXNzYWdlX2RlY29kZXIiLCJjcmVhdGVFbGVtZW50IiwibWVzc2FnZV90ZXh0IiwiaW5uZXJIVE1MIiwidmFsdWUiLCJ0cmltIiwiaXNfc3VjY2VzcyIsInN1Y2Nlc3MiLCJCb29sZWFuIiwid3BiY19teV9tb2RhbCIsIndwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3Nob3J0Iiwic2hvdyIsIndwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3dpZGUiLCJ3cGJjX2FqeF9jbGlja19vbl9kYXRlc190b2dnbGUiLCJ0aGlzX2RhdGUiLCJwYXJlbnRzIiwiZmluZCIsInRvZ2dsZSIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlIiwiZWFjaCIsImluZGV4Iiwic2VsZWN0aW9uIiwiYXR0ciIsInByb3AiLCJoYXNDbGFzcyIsImJvb2tpbmdfbG9jYWxlX2J1dHRvbiIsImFkZENsYXNzIiwid3BiY190aXBweSIsImdldCIsIl90aXBweSIsInNldENvbnRlbnQiLCJ3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX3JlbWFyayIsInRleHRfdmFsIiwidmFsIiwicmVtYXJrX2J1dHRvbiIsInNldFByb3BzIiwiYWxsb3dIVE1MIiwiY29udGVudCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX2NoYW5nZV9yZXNvdXJjZSIsInRoaXNfZWwiLCJlbF9pZCIsIndwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24iLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19kdXBsaWNhdGVfYm9va2luZyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9ib29raW5nX2Nvc3QiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fc2V0X2Jvb2tpbmdfY29zdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19zZW5kX3BheW1lbnRfcmVxdWVzdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2V4cG9ydF9jc3YiLCJwYXJhbXMiLCJzZWxlY3RlZF9ib29raW5nX2lkX2FyciIsIndwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCIsImpvaW4iLCJzZWFyY2hfZ2V0X2FsbF9wYXJhbXMiLCJleHBvcnRfY3N2X3VybCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtYm9va2luZ3MvX3NyYy9ib29raW5nc19fYWN0aW9ucy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiAgIEFqYXggICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG4vL3ZhciBpc190aGlzX2FjdGlvbiA9IGZhbHNlO1xyXG4vKipcclxuICogU2VuZCBBamF4IGFjdGlvbiByZXF1ZXN0LCAgbGlrZSBhcHByb3Zpbmcgb3IgY2FuY2VsbGF0aW9uXHJcbiAqXHJcbiAqIEBwYXJhbSBhY3Rpb25fcGFyYW1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCggYWN0aW9uX3BhcmFtID0ge30gKXtcclxuXHR2YXIgYWN0aW9uX2kxOG4gPSB3aW5kb3cud3BiY19ib29raW5nX2FjdGlvbnNfaTE4biB8fCB7fTtcclxuXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9CT09LSU5HX0FDVElPTlMnICk7IGNvbnNvbGUubG9nKCAnID09IEFqYXggQWN0aW9ucyA6OiBQYXJhbXMgPT0gJywgYWN0aW9uX3BhcmFtICk7XHJcbi8vaXNfdGhpc19hY3Rpb24gPSB0cnVlO1xyXG5cclxuXHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nKCAnJyApO1xyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG5cdC8vIEdldCByZWRlZmluZWQgTG9jYWxlLCAgaWYgYWN0aW9uIG9uIHNpbmdsZSBib29raW5nICFcclxuXHRpZiAoICAoIHVuZGVmaW5lZCAhPSBhY3Rpb25fcGFyYW1bICdib29raW5nX2lkJyBdICkgJiYgKCAhIEFycmF5LmlzQXJyYXkoIGFjdGlvbl9wYXJhbVsgJ2Jvb2tpbmdfaWQnIF0gKSApICl7XHRcdFx0XHQvLyBOb3QgYXJyYXlcclxuXHJcblx0XHRhY3Rpb25fcGFyYW1bICdsb2NhbGUnIF0gPSB3cGJjX2dldF9zZWxlY3RlZF9sb2NhbGUoIGFjdGlvbl9wYXJhbVsgJ2Jvb2tpbmdfaWQnIF0sIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApICk7XHJcblx0fVxyXG5cclxuXHR2YXIgYWN0aW9uX3Bvc3RfcGFyYW1zID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfQUNUSU9OUycsXHJcblx0XHRcdFx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogKCAoIHVuZGVmaW5lZCA9PSBhY3Rpb25fcGFyYW1bICd1c2VyX2lkJyBdICkgPyB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICkgOiBhY3Rpb25fcGFyYW1bICd1c2VyX2lkJyBdICksXHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGU6ICAoICggdW5kZWZpbmVkID09IGFjdGlvbl9wYXJhbVsgJ2xvY2FsZScgXSApICA/IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApICA6IGFjdGlvbl9wYXJhbVsgJ2xvY2FsZScgXSApLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbl9wYXJhbXNcdDogYWN0aW9uX3BhcmFtXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0Ly8gSXQncyByZXF1aXJlZCBmb3IgQ1NWIGV4cG9ydCAtIGdldHRpbmcgdGhlIHNhbWUgbGlzdCAgb2YgYm9va2luZ3NcclxuXHRpZiAoIHR5cGVvZiBhY3Rpb25fcGFyYW0uc2VhcmNoX3BhcmFtcyAhPT0gJ3VuZGVmaW5lZCcgKXtcclxuXHRcdGFjdGlvbl9wb3N0X3BhcmFtc1sgJ3NlYXJjaF9wYXJhbXMnIF0gPSBhY3Rpb25fcGFyYW0uc2VhcmNoX3BhcmFtcztcclxuXHRcdGRlbGV0ZSBhY3Rpb25fcG9zdF9wYXJhbXMuYWN0aW9uX3BhcmFtcy5zZWFyY2hfcGFyYW1zO1xyXG5cdH1cclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hY3Rpb25fZGlzcGF0Y2hfc3RhcnQoIGFjdGlvbl9wYXJhbSApO1xyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXggLFxyXG5cclxuXHRcdFx0XHRhY3Rpb25fcG9zdF9wYXJhbXMgLFxyXG5cclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjZy5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcblx0XHRcdFx0XHR2YXIgcmVzcG9uc2VfcGFyYW1zID0gcmVzcG9uc2VfZGF0YSAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVxyXG5cdFx0XHRcdFx0XHQ/IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVxyXG5cdFx0XHRcdFx0XHQ6IG51bGw7XHJcblx0XHRcdFx0XHR2YXIgaXNfYWN0aW9uX3N1Y2Nlc3M7XHJcblx0XHRcdFx0XHR2YXIgYWN0aW9uX21lc3NhZ2U7XHJcblxyXG5jb25zb2xlLmxvZyggJyA9PSBBamF4IEFjdGlvbnMgOjogUmVzcG9uc2UgV1BCQ19BSlhfQk9PS0lOR19BQ1RJT05TID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHRcdFx0XHRcdC8vIFByb2JhYmx5IEVycm9yXHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdCggdHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnIClcclxuXHRcdFx0XHRcdFx0fHwgKCByZXNwb25zZV9kYXRhID09PSBudWxsIClcclxuXHRcdFx0XHRcdFx0fHwgKCAnc3RyaW5nJyAhPT0gdHlwZW9mIHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0gKVxyXG5cdFx0XHRcdFx0XHR8fCAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0JyBdIClcclxuXHRcdFx0XHRcdFx0fHwgISByZXNwb25zZV9wYXJhbXNcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHRcdFx0XHRcdFx0YWN0aW9uX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgKCBhY3Rpb25faTE4bi5lcnJvcl9sYWJlbCB8fCAnJyApICsgJzwvc3Ryb25nPiAnICsgKCBhY3Rpb25faTE4bi5pbnZhbGlkX3Jlc3BvbnNlIHx8ICcnICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdGFjdGlvbl9tZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdCdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0MTAwMDBcclxuXHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19hY3Rpb25fZGlzcGF0Y2hfY29tcGxldGUoIGFjdGlvbl9wYXJhbSwgZmFsc2UsIGFjdGlvbl9tZXNzYWdlICk7XHJcblx0XHRcdFx0XHRcdGlmICggYWN0aW9uX3BhcmFtWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdICkge1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiggYWN0aW9uX3BhcmFtWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHRcdFx0XHRcdGlzX2FjdGlvbl9zdWNjZXNzID0gJzEnID09IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdCcgXTtcclxuXHRcdFx0XHRcdGFjdGlvbl9tZXNzYWdlID0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXTtcclxuXHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgYWN0aW9uX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBpc19hY3Rpb25fc3VjY2VzcyA/ICdzdWNjZXNzJyA6ICdlcnJvcidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAoICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiggcmVzcG9uc2VfcGFyYW1zWyAnYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9kZWxheScgXSApIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0OiByZXNwb25zZV9wYXJhbXNbICdhZnRlcl9hY3Rpb25fcmVzdWx0X2RlbGF5JyBdIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19hY3Rpb25fZGlzcGF0Y2hfY29tcGxldGUoIGFjdGlvbl9wYXJhbSwgaXNfYWN0aW9uX3N1Y2Nlc3MsIGFjdGlvbl9tZXNzYWdlICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gU3VjY2VzcyByZXNwb25zZVxyXG5cdFx0XHRcdFx0aWYgKCBpc19hY3Rpb25fc3VjY2VzcyApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGlzX3JlbG9hZF9hamF4X2xpc3RpbmcgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gQWZ0ZXIgR29vZ2xlIENhbGVuZGFyIGltcG9ydCBzaG93IGltcG9ydGVkIGJvb2tpbmdzIGFuZCByZWxvYWQgdGhlIHBhZ2UgZm9yIHRvb2xiYXIgcGFyYW1ldGVycyB1cGRhdGVcclxuXHRcdFx0XHRcdFx0aWYgKCByZXNwb25zZV9wYXJhbXNbICduZXdfbGlzdGluZ19wYXJhbXMnIF0gJiYgJ29iamVjdCcgPT09IHR5cGVvZiByZXNwb25zZV9wYXJhbXNbICduZXdfbGlzdGluZ19wYXJhbXMnIF0gKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCByZXNwb25zZV9wYXJhbXNbICduZXdfbGlzdGluZ19wYXJhbXMnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluKCkgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPSByZXNwb25zZV9wYXJhbXNbICduZXdfbGlzdGluZ19wYXJhbXMnIF1bICdyZWxvYWRfdXJsX3BhcmFtcycgXSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZG9jdW1lbnQubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX3BhcmFtc1sgJ25ld19saXN0aW5nX3BhcmFtcycgXVsgJ3JlbG9hZF91cmxfcGFyYW1zJyBdO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkb2N1bWVudC5sb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAyMDAwICk7XHJcblx0XHRcdFx0XHRcdFx0aXNfcmVsb2FkX2FqYXhfbGlzdGluZyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBTdGFydCBkb3dubG9hZCBleHBvcnRlZCBDU1YgZmlsZVxyXG5cdFx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPSByZXNwb25zZV9wYXJhbXNbICdleHBvcnRfY3N2X3VybCcgXSApe1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2V4cG9ydF9jc3ZfdXJsX19kb3dubG9hZCggcmVzcG9uc2VfcGFyYW1zWyAnZXhwb3J0X2Nzdl91cmwnIF0gKTtcclxuXHRcdFx0XHRcdFx0XHRpc19yZWxvYWRfYWpheF9saXN0aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmICggaXNfcmVsb2FkX2FqYXhfbGlzdGluZyAmJiBqUXVlcnkoICcud3BiY19fbGlzdF9fdGFibGUnICkubGVuZ3RoICl7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3coKTtcdC8vXHRTZW5kaW5nIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkIGluIFwid3BiY19hanhfYm9va2luZ19saXN0aW5nXCIgT2JqLlxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFJlbW92ZSBzcGluIGljb24gZnJvbSAgYnV0dG9uIGFuZCBFbmFibGUgdGhpcyBidXR0b24uXHJcblx0XHRcdFx0XHR3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oXHJcblx0XHRcdFx0XHRcdHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0gJiYgcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXVxyXG5cdFx0XHRcdFx0XHRcdD8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXVxyXG5cdFx0XHRcdFx0XHRcdDogYWN0aW9uX3BhcmFtWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdXHJcblx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0XHRcdC8vIEhpZGUgbW9kYWxzXHJcblx0XHRcdFx0XHR3cGJjX3BvcHVwX21vZGFsc19faGlkZSgpO1xyXG5cclxuXHRcdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICggYWN0aW9uX2kxOG4uZXJyb3JfbGFiZWwgfHwgJycgKSArICc8L3N0cm9uZz4gJyArICggZXJyb3JUaHJvd24gfHwgYWN0aW9uX2kxOG4ucmVxdWVzdF9mYWlsZWQgfHwgJycgKTtcclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VKU09OICYmIGpxWEhSLnJlc3BvbnNlSlNPTi5kYXRhICYmIGpxWEhSLnJlc3BvbnNlSlNPTi5kYXRhLm1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBTdHJpbmcoIGpxWEhSLnJlc3BvbnNlSlNPTi5kYXRhLm1lc3NhZ2UgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19hY3Rpb25fZGlzcGF0Y2hfY29tcGxldGUoIGFjdGlvbl9wYXJhbSwgZmFsc2UsIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdFx0XHRcdGlmICggYWN0aW9uX3BhcmFtWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdICkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oIGFjdGlvbl9wYXJhbVsgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHQgIH0pXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG59XHJcblxyXG4vKipcclxuICogTm90aWZ5IEluc3BlY3RvciBhbmQgb3RoZXIgaG9zdHMgd2hlbiBhIGNhbm9uaWNhbCBib29raW5nIGFjdGlvbiBzdGFydHMuXHJcbiAqXHJcbiAqIFRoZSBldmVudCBkZWxpYmVyYXRlbHkgY29udGFpbnMgb25seSB0aGUgc3RhYmxlIGJvb2tpbmcgaWRlbnRpZmllciBhbmRcclxuICogYWN0aW9uIG5hbWUuIEhvc3RzIG1heSByZXRhaW4gdGhhdCBpZGVudGl0eSBhY3Jvc3MgdGhlaXIgb3duIHZpZXcgdGVhcmRvd24sXHJcbiAqIGJ1dCBhdXRob3JpemF0aW9uIGFuZCBwZXJzaXN0ZW5jZSByZW1haW4gb3duZWQgYnkgdGhlIGNhbm9uaWNhbCByZXF1ZXN0LlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gYWN0aW9uX3BhcmFtIFN1Ym1pdHRlZCBib29raW5nIGFjdGlvbiBwYXJhbWV0ZXJzLlxyXG4gKiBAcmV0dXJuIHt2b2lkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19hY3Rpb25fZGlzcGF0Y2hfc3RhcnQoIGFjdGlvbl9wYXJhbSApe1xyXG5cdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0d2luZG93LmRpc3BhdGNoRXZlbnQoIG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoICd3cGJjOmJvb2tpbmctYWN0aW9uOnN0YXJ0Jywge1xyXG5cdFx0ZGV0YWlsOiB7XHJcblx0XHRcdGJvb2tpbmdfaWQ6IGFjdGlvbl9wYXJhbS5ib29raW5nX2lkIHx8IDAsXHJcblx0XHRcdGFjdGlvbjogYWN0aW9uX3BhcmFtLmJvb2tpbmdfYWN0aW9uIHx8ICcnXHJcblx0XHR9XHJcblx0fSApICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb252ZXJ0IG9uZSBjYW5vbmljYWwgQm9va2luZyBBY3Rpb24gbWVzc2FnZSB0byBwbGFpbiB0ZXh0IGZvciBob3N0IFVJcy5cclxuICpcclxuICogVGhlIHBhZ2UtbGV2ZWwgbm90aWNlIHJldGFpbnMgaXRzIGVzdGFibGlzaGVkIGxpbWl0ZWQgSFRNTCBwcmVzZW50YXRpb24uXHJcbiAqIEhvc3QgY29tcG9uZW50cyByZWNlaXZlIHRleHQgb25seSwgc28gcmVzcG9uc2UgbWFya3VwIGlzIG5ldmVyIGNvcGllZCBpbnRvXHJcbiAqIGFub3RoZXIgcHJlc2VudGF0aW9uIGJvdW5kYXJ5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYWN0aW9uX21lc3NhZ2UgQ2Fub25pY2FsIEJvb2tpbmcgQWN0aW9uIHJlc3VsdCBtZXNzYWdlLlxyXG4gKiBAcmV0dXJuIHtzdHJpbmd9IE5vcm1hbGl6ZWQgcGxhaW4tdGV4dCBtZXNzYWdlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19hY3Rpb25fbWVzc2FnZV90b190ZXh0KCBhY3Rpb25fbWVzc2FnZSApe1xyXG5cdHZhciBtZXNzYWdlX2RlY29kZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAndGV4dGFyZWEnICk7XHJcblx0dmFyIG1lc3NhZ2VfdGV4dCA9IFN0cmluZyggYWN0aW9uX21lc3NhZ2UgfHwgJycgKVxyXG5cdFx0LnJlcGxhY2UoIC88YnJcXHMqXFwvP1xccyo+L2dpLCAnXFxuJyApXHJcblx0XHQucmVwbGFjZSggLzxbXj5dKj4vZywgJyAnICk7XHJcblxyXG5cdG1lc3NhZ2VfZGVjb2Rlci5pbm5lckhUTUwgPSBtZXNzYWdlX3RleHQ7XHJcblx0cmV0dXJuIFN0cmluZyggbWVzc2FnZV9kZWNvZGVyLnZhbHVlIHx8ICcnIClcclxuXHRcdC5yZXBsYWNlKCAvXFx1MDBhMC9nLCAnICcgKVxyXG5cdFx0LnJlcGxhY2UoIC9bIFxcdF0rXFxuL2csICdcXG4nIClcclxuXHRcdC5yZXBsYWNlKCAvXFxuWyBcXHRdKy9nLCAnXFxuJyApXHJcblx0XHQucmVwbGFjZSggL1sgXFx0XXsyLH0vZywgJyAnIClcclxuXHRcdC50cmltKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOb3RpZnkgSW5zcGVjdG9yIGFuZCBvdGhlciBob3N0cyB3aGVuIGEgY2Fub25pY2FsIGJvb2tpbmcgYWN0aW9uIGNvbXBsZXRlcy5cclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IGFjdGlvbl9wYXJhbSBTdWJtaXR0ZWQgYm9va2luZyBhY3Rpb24gcGFyYW1ldGVycy5cclxuICogQHBhcmFtIHtib29sZWFufSBpc19zdWNjZXNzIFdoZXRoZXIgcGVyc2lzdGVuY2UgY29tcGxldGVkIHN1Y2Nlc3NmdWxseS5cclxuICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbl9tZXNzYWdlIENhbm9uaWNhbCBCb29raW5nIEFjdGlvbiByZXN1bHQgbWVzc2FnZS5cclxuICogQHJldHVybiB7dm9pZH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfYWN0aW9uX2Rpc3BhdGNoX2NvbXBsZXRlKCBhY3Rpb25fcGFyYW0sIGlzX3N1Y2Nlc3MsIGFjdGlvbl9tZXNzYWdlICl7XHJcblx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LkN1c3RvbUV2ZW50ICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHR3aW5kb3cuZGlzcGF0Y2hFdmVudCggbmV3IHdpbmRvdy5DdXN0b21FdmVudCggJ3dwYmM6Ym9va2luZy1hY3Rpb246Y29tcGxldGUnLCB7XHJcblx0XHRkZXRhaWw6IHtcclxuXHRcdFx0Ym9va2luZ19pZDogYWN0aW9uX3BhcmFtLmJvb2tpbmdfaWQgfHwgMCxcclxuXHRcdFx0YWN0aW9uOiBhY3Rpb25fcGFyYW0uYm9va2luZ19hY3Rpb24gfHwgJycsXHJcblx0XHRcdHN1Y2Nlc3M6IEJvb2xlYW4oIGlzX3N1Y2Nlc3MgKSxcclxuXHRcdFx0bWVzc2FnZTogd3BiY19hanhfYm9va2luZ19hY3Rpb25fbWVzc2FnZV90b190ZXh0KCBhY3Rpb25fbWVzc2FnZSApXHJcblx0XHR9XHJcblx0fSApICk7XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIEhpZGUgYWxsIG9wZW4gbW9kYWwgcG9wdXBzIHdpbmRvd3NcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfcG9wdXBfbW9kYWxzX19oaWRlKCl7XHJcblxyXG5cdC8vIEhpZGUgbW9kYWxzXHJcblx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKGpRdWVyeSggJy53cGJjX3BvcHVwX21vZGFsJyApLndwYmNfbXlfbW9kYWwpICl7XHJcblx0XHRqUXVlcnkoICcud3BiY19wb3B1cF9tb2RhbCcgKS53cGJjX215X21vZGFsKCAnaGlkZScgKTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBEYXRlcyAgU2hvcnQgPC0+IFdpZGUgICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3Nob3J0KCl7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfc21hbGwsLmJvb2tpbmdfZGF0ZXNfZnVsbCcgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfZnVsbCwuYm9va2luZ19kYXRlc19zbWFsbCcgKS5zaG93KCk7XHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7J3VpX3Vzcl9fZGF0ZXNfc2hvcnRfd2lkZSc6ICdzaG9ydCd9ICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3dpZGUoKXtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19mdWxsLC5ib29raW5nX2RhdGVzX3NtYWxsJyApLmhpZGUoKTtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19zbWFsbCwuYm9va2luZ19kYXRlc19mdWxsJyApLnNob3coKTtcclxuXHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsndWlfdXNyX19kYXRlc19zaG9ydF93aWRlJzogJ3dpZGUnfSApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9jbGlja19vbl9kYXRlc190b2dnbGUodGhpc19kYXRlKXtcclxuXHJcblx0alF1ZXJ5KCB0aGlzX2RhdGUgKS5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19zbWFsbCcgKS50b2dnbGUoKTtcclxuXHRqUXVlcnkoIHRoaXNfZGF0ZSApLnBhcmVudHMoICcud3BiY19jb2xfZGF0ZXMnICkuZmluZCggJy5ib29raW5nX2RhdGVzX2Z1bGwnICkudG9nZ2xlKCk7XHJcblxyXG5cdC8qXHJcblx0dmFyIHZpc2libGVfc2VjdGlvbiA9IGpRdWVyeSggdGhpc19kYXRlICkucGFyZW50cyggJy5ib29raW5nX2RhdGVzX2V4cGFuZF9zZWN0aW9uJyApO1xyXG5cdHZpc2libGVfc2VjdGlvbi5oaWRlKCk7XHJcblx0aWYgKCB2aXNpYmxlX3NlY3Rpb24uaGFzQ2xhc3MoICdib29raW5nX2RhdGVzX2Z1bGwnICkgKXtcclxuXHRcdHZpc2libGVfc2VjdGlvbi5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19zbWFsbCcgKS5zaG93KCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHZpc2libGVfc2VjdGlvbi5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19mdWxsJyApLnNob3coKTtcclxuXHR9Ki9cclxuXHRjb25zb2xlLmxvZyggJ3dwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3RvZ2dsZScsIHRoaXNfZGF0ZSApO1xyXG59XHJcblxyXG4vKipcclxuICogICBMb2NhbGUgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBcdFNlbGVjdCBvcHRpb25zIGluIHNlbGVjdCBib3hlcyBiYXNlZCBvbiBhdHRyaWJ1dGUgXCJ2YWx1ZV9vZl9zZWxlY3RlZF9vcHRpb25cIiBhbmQgUkVEIGNvbG9yIGFuZCBoaW50IGZvciBMT0NBTEUgYnV0dG9uICAgLS0gIEl0J3MgY2FsbGVkIGZyb20gXHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpICBcdGVhY2ggIHRpbWUgYWZ0ZXIgTGlzdGluZyBsb2FkaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUoKXtcclxuXHJcblx0alF1ZXJ5KCAnLndwYmNfX2xpc3RfX3RhYmxlIHNlbGVjdCcgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblxyXG5cdFx0dmFyIHNlbGVjdGlvbiA9IGpRdWVyeSggdGhpcyApLmF0dHIoIFwidmFsdWVfb2Zfc2VsZWN0ZWRfb3B0aW9uXCIgKTtcdFx0XHQvLyBEZWZpbmUgc2VsZWN0ZWQgc2VsZWN0IGJveGVzXHJcblxyXG5cdFx0aWYgKCB1bmRlZmluZWQgIT09IHNlbGVjdGlvbiApe1xyXG5cdFx0XHRqUXVlcnkoIHRoaXMgKS5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiJyArIHNlbGVjdGlvbiArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xyXG5cclxuXHRcdFx0aWYgKCAoJycgIT0gc2VsZWN0aW9uKSAmJiAoalF1ZXJ5KCB0aGlzICkuaGFzQ2xhc3MoICdzZXRfYm9va2luZ19sb2NhbGVfc2VsZWN0Ym94JyApKSApe1x0XHRcdFx0XHRcdFx0XHQvLyBMb2NhbGVcclxuXHJcblx0XHRcdFx0dmFyIGJvb2tpbmdfbG9jYWxlX2J1dHRvbiA9IGpRdWVyeSggdGhpcyApLnBhcmVudHMoICcudWlfZWxlbWVudF9sb2NhbGUnICkuZmluZCggJy5zZXRfYm9va2luZ19sb2NhbGVfYnV0dG9uJyApXHJcblxyXG5cdFx0XHRcdC8vYm9va2luZ19sb2NhbGVfYnV0dG9uLmNzcyggJ2NvbG9yJywgJyNkYjQ4MDAnICk7XHRcdC8vIFNldCBidXR0b24gIHJlZFxyXG5cdFx0XHRcdGJvb2tpbmdfbG9jYWxlX2J1dHRvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHQvLyBTZXQgYnV0dG9uICByZWRcclxuXHRcdFx0XHQgaWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YoIHdwYmNfdGlwcHkgKSApe1xyXG5cdFx0XHRcdFx0Ym9va2luZ19sb2NhbGVfYnV0dG9uLmdldCgwKS5fdGlwcHkuc2V0Q29udGVudCggc2VsZWN0aW9uICk7XHJcblx0XHRcdFx0IH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqICAgUmVtYXJrICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogRGVmaW5lIGNvbnRlbnQgb2YgcmVtYXJrIFwiYm9va2luZyBub3RlXCIgYnV0dG9uIGFuZCB0ZXh0YXJlYS4gIC0tIEl0J3MgY2FsbGVkIGZyb20gXHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpICBcdGVhY2ggIHRpbWUgYWZ0ZXIgTGlzdGluZyBsb2FkaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19yZW1hcmsoKXtcclxuXHJcblx0alF1ZXJ5KCAnLndwYmNfX2xpc3RfX3RhYmxlIC51aV9yZW1hcmtfc2VjdGlvbiB0ZXh0YXJlYScgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblx0XHR2YXIgdGV4dF92YWwgPSBqUXVlcnkoIHRoaXMgKS52YWwoKTtcclxuXHRcdGlmICggKHVuZGVmaW5lZCAhPT0gdGV4dF92YWwpICYmICgnJyAhPSB0ZXh0X3ZhbCkgKXtcclxuXHJcblx0XHRcdHZhciByZW1hcmtfYnV0dG9uID0galF1ZXJ5KCB0aGlzICkucGFyZW50cyggJy51aV9ncm91cCcgKS5maW5kKCAnLnNldF9ib29raW5nX25vdGVfYnV0dG9uJyApO1xyXG5cclxuXHRcdFx0aWYgKCByZW1hcmtfYnV0dG9uLmxlbmd0aCA+IDAgKXtcclxuXHJcblx0XHRcdFx0cmVtYXJrX2J1dHRvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHQvLyBTZXQgYnV0dG9uICByZWRcclxuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdFx0XHRcdC8vcmVtYXJrX2J1dHRvbi5nZXQoIDAgKS5fdGlwcHkuYWxsb3dIVE1MID0gdHJ1ZTtcclxuXHRcdFx0XHRcdC8vcmVtYXJrX2J1dHRvbi5nZXQoIDAgKS5fdGlwcHkuc2V0Q29udGVudCggdGV4dF92YWwucmVwbGFjZSgvW1xcblxccl0vZywgJzxicj4nKSApO1xyXG5cclxuXHRcdFx0XHRcdHJlbWFya19idXR0b24uZ2V0KCAwICkuX3RpcHB5LnNldFByb3BzKCB7XHJcblx0XHRcdFx0XHRcdGFsbG93SFRNTDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y29udGVudCAgOiB0ZXh0X3ZhbC5yZXBsYWNlKCAvW1xcblxccl0vZywgJzxicj4nIClcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuXHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX2NoYW5nZV9yZXNvdXJjZSggdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGpRdWVyeSggJyNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RlZF9yZXNvdXJjZV9pZCcgOiBqUXVlcnkoICcjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3Jlc291cmNlX3NlbGVjdCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZFxyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHJcbn1cclxuXHJcblxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fZHVwbGljYXRlX2Jvb2tpbmcoIHRoaXNfZWwsIGJvb2tpbmdfYWN0aW9uLCBlbF9pZCApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiBib29raW5nX2FjdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBqUXVlcnkoICcjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0ZWRfcmVzb3VyY2VfaWQnIDogalF1ZXJ5KCAnI2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19yZXNvdXJjZV9zZWxlY3QnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogZWxfaWRcclxuXHR9ICk7XHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxuXHJcblxyXG59XHJcblxyXG5cclxuXHJcbi8vVE9ETzogZGVsZXRlXHJcblxyXG5cclxuLyoqXHJcbiAqICAgQ2hhbmdlIGJvb2tpbmcgY29zdCAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19zZXRfYm9va2luZ19jb3N0KCBib29raW5nX2lkLCB0aGlzX2VsLCBib29raW5nX2FjdGlvbiwgZWxfaWQgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogYm9va2luZ19hY3Rpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCcgICAgICAgICAgIDogYm9va2luZ19pZCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2Nvc3QnIFx0XHQgICA6IGpRdWVyeSggJyN1aV9idG5fc2V0X2Jvb2tpbmdfY29zdCcgKyBib29raW5nX2lkICsgJ19jb3N0JykudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogZWxfaWQgKyAnX3NhdmUnXHJcblx0fSApO1xyXG5cclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCB0aGlzX2VsICk7XHJcblxyXG5cdGpRdWVyeSggJyMnICsgZWxfaWQgKyAnX2NhbmNlbCcpLmhpZGUoKTtcclxuXHQvL3dwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIGpRdWVyeSggJyMnICsgZWxfaWQgKyAnX2NhbmNlbCcpLmdldCgwKSApO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX3NldF9ib29raW5nX2Nvc3QoKXtcclxuXHQvLyBIaWRlIGFsbCBjaGFuZ2UgIHBheW1lbnQgc3RhdHVzIGZvciBib29raW5nXHJcblx0alF1ZXJ5KFwiLnVpX19zZXRfYm9va2luZ19jb3N0X19zZWN0aW9uX2luX2Jvb2tpbmdcIikuaGlkZSgpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgU2VuZCBQYXltZW50IHJlcXVlc3QgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX3NlbmRfcGF5bWVudF9yZXF1ZXN0KCl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6ICdzZW5kX3BheW1lbnRfcmVxdWVzdCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCcgICAgICAgICAgIDogalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfcmVxdWVzdF9fYm9va2luZ19pZCcpLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3JlYXNvbl9vZl9hY3Rpb24nIFx0ICAgOiBqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9yZXF1ZXN0X19yZWFzb25fb2ZfYWN0aW9uJykudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogJ3dwYmNfbW9kYWxfX3BheW1lbnRfcmVxdWVzdF9fYnV0dG9uX3NlbmQnXHJcblx0fSApO1xyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3JlcXVlc3RfX2J1dHRvbl9zZW5kJyApLmdldCggMCApICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBJbXBvcnQgR29vZ2xlIENhbGVuZGFyICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyKCl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6ICdpbXBvcnRfZ29vZ2xlX2NhbGVuZGFyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fYnV0dG9uX3NlbmQnXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19mcm9tJyA6IFx0XHRcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbSBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19mcm9tX29mZnNldCcgOiBcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbV9vZmZzZXQnICkudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbV9vZmZzZXRfdHlwZScgOiBcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX2Zyb21fb2Zmc2V0X3R5cGUgb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX3VudGlsJyA6IFx0XHRcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX3VudGlsIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX3VudGlsX29mZnNldCcgOiBcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0JyApLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX3VudGlsX29mZnNldF90eXBlJyA6IGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX3VudGlsX29mZnNldF90eXBlIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19tYXgnIDogXHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c19tYXgnICkudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9yZXNvdXJjZScgOiBcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICN3cGJjX2Jvb2tpbmdfcmVzb3VyY2Ugb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHR9ICk7XHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX2J1dHRvbl9zZW5kJyApLmdldCggMCApICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBFeHBvcnQgYm9va2luZ3MgdG8gQ1NWICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2V4cG9ydF9jc3YoIHBhcmFtcyApe1xyXG5cclxuXHR2YXIgc2VsZWN0ZWRfYm9va2luZ19pZF9hcnIgPSB3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQoKTtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgICA6IHBhcmFtc1sgJ2Jvb2tpbmdfYWN0aW9uJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgOiBwYXJhbXNbICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0sXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2V4cG9ydF90eXBlJyAgICAgICAgICAgOiBwYXJhbXNbICdleHBvcnRfdHlwZScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3ZfZXhwb3J0X3NlcGFyYXRvcicgIDogcGFyYW1zWyAnY3N2X2V4cG9ydF9zZXBhcmF0b3InIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY3N2X2V4cG9ydF9za2lwX2ZpZWxkcyc6IHBhcmFtc1sgJ2Nzdl9leHBvcnRfc2tpcF9maWVsZHMnIF0sXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnXHQ6IHNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyLmpvaW4oJywnKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWFyY2hfcGFyYW1zJyA6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHJcblx0dmFyIHRoaXNfZWwgPSBqUXVlcnkoICcjJyArIHBhcmFtc1sgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSApLmdldCggMCApXHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gVVJMIGluIG5ldyB0YWIgLSBtYWlubHkgIGl0J3MgdXNlZCBmb3Igb3BlbiBDU1YgbGluayAgZm9yIGRvd25sb2FkZWQgZXhwb3J0ZWQgYm9va2luZ3MgYXMgQ1NWXHJcbiAqXHJcbiAqIEBwYXJhbSBleHBvcnRfY3N2X3VybFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fZXhwb3J0X2Nzdl91cmxfX2Rvd25sb2FkKCBleHBvcnRfY3N2X3VybCApe1xyXG5cclxuXHQvL3ZhciBzZWxlY3RlZF9ib29raW5nX2lkX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpO1xyXG5cclxuXHRkb2N1bWVudC5sb2NhdGlvbi5ocmVmID0gZXhwb3J0X2Nzdl91cmw7Ly8gKyAnJnNlbGVjdGVkX2lkPScgKyBzZWxlY3RlZF9ib29raW5nX2lkX2Fyci5qb2luKCcsJyk7XHJcblxyXG5cdC8vIEl0J3Mgb3BlbiBhZGRpdGlvbmFsIGRpYWxvZyBmb3IgYXNraW5nIG9wZW5pbmcgdWxyIGluIG5ldyB0YWJcclxuXHQvLyB3aW5kb3cub3BlbiggZXhwb3J0X2Nzdl91cmwsICdfYmxhbmsnKS5mb2N1cygpO1xyXG59XHJcbiJdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWTs7QUFFWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0Esb0NBQW9DQSxDQUFFQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLEVBQUU7RUFDakUsSUFBSUMsV0FBVyxHQUFHQyxNQUFNLENBQUNDLHlCQUF5QixJQUFJLENBQUMsQ0FBQztFQUV6REMsT0FBTyxDQUFDQyxjQUFjLENBQUUsMEJBQTJCLENBQUM7RUFBRUQsT0FBTyxDQUFDRSxHQUFHLENBQUUsZ0NBQWdDLEVBQUVOLFlBQWEsQ0FBQztFQUNuSDs7RUFFQ08sa0NBQWtDLENBQUUsRUFBRyxDQUFDO0VBRXhDQyw4Q0FBOEMsQ0FBQyxDQUFDOztFQUVoRDtFQUNBLElBQVFDLFNBQVMsSUFBSVQsWUFBWSxDQUFFLFlBQVksQ0FBRSxJQUFRLENBQUVVLEtBQUssQ0FBQ0MsT0FBTyxDQUFFWCxZQUFZLENBQUUsWUFBWSxDQUFHLENBQUcsRUFBRTtJQUFLOztJQUVoSEEsWUFBWSxDQUFFLFFBQVEsQ0FBRSxHQUFHWSx3QkFBd0IsQ0FBRVosWUFBWSxDQUFFLFlBQVksQ0FBRSxFQUFFYSx3QkFBd0IsQ0FBQ0MsZ0JBQWdCLENBQUUsUUFBUyxDQUFFLENBQUM7RUFDM0k7RUFFQSxJQUFJQyxrQkFBa0IsR0FBRztJQUNsQkMsTUFBTSxFQUFZLDBCQUEwQjtJQUM1Q0MsS0FBSyxFQUFhSix3QkFBd0IsQ0FBQ0MsZ0JBQWdCLENBQUUsT0FBUSxDQUFDO0lBQ3RFSSxnQkFBZ0Is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
