"use strict";

/**
 *   Ajax   ----------------------------------------------------------------------------------------------------- */
//var is_this_action = false;
/**
 * Send Ajax action request,  like approving or cancellation
 *
 * @param action_param
 */
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function wpbc_ajx_booking_ajax_action_request() {
  var action_param = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  console.groupCollapsed('WPBC_AJX_BOOKING_ACTIONS');
  console.log(' == Ajax Actions :: Params == ', action_param);
  //is_this_action = true;

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
    console.log(' == Ajax Actions :: Response WPBC_AJX_BOOKING_ACTIONS == ', response_data);
    console.groupEnd();

    // Probably Error
    if (_typeof(response_data) !== 'object' || response_data === null) {
      jQuery('.wpbc_ajx_under_toolbar_row').hide(); // FixIn: 9.6.1.5.
      jQuery(wpbc_ajx_booking_listing.get_other_param('listing_container')).html('<div class="wpbc-settings-notice notice-warning" style="text-align:left">' + response_data + '</div>');
      return;
    }
    wpbc_booking_listing_reload_button__spin_pause();
    wpbc_admin_show_message(response_data['ajx_after_action_message'].replace(/\n/g, "<br />"), '1' == response_data['ajx_after_action_result'] ? 'success' : 'error', 'undefined' === typeof response_data['ajx_after_action_result_all_params_arr']['after_action_result_delay'] ? 10000 : response_data['ajx_after_action_result_all_params_arr']['after_action_result_delay']);

    // Success response
    if ('1' == response_data['ajx_after_action_result']) {
      var is_reload_ajax_listing = true;

      // After Google Calendar import show imported bookings and reload the page for toolbar parameters update
      if (false !== response_data['ajx_after_action_result_all_params_arr']['new_listing_params']) {
        wpbc_ajx_booking_send_search_request_with_params(response_data['ajx_after_action_result_all_params_arr']['new_listing_params']);
        var closed_timer = setTimeout(function () {
          if (wpbc_booking_listing_reload_button__is_spin()) {
            if (undefined != response_data['ajx_after_action_result_all_params_arr']['new_listing_params']['reload_url_params']) {
              document.location.href = response_data['ajx_after_action_result_all_params_arr']['new_listing_params']['reload_url_params'];
            } else {
              document.location.reload();
            }
          }
        }, 2000);
        is_reload_ajax_listing = false;
      }

      // Start download exported CSV file
      if (undefined != response_data['ajx_after_action_result_all_params_arr']['export_csv_url']) {
        wpbc_ajx_booking__export_csv_url__download(response_data['ajx_after_action_result_all_params_arr']['export_csv_url']);
        is_reload_ajax_listing = false;
      }
      if (is_reload_ajax_listing) {
        wpbc_ajx_booking__actual_listing__show(); //	Sending Ajax Request	-	with parameters that  we early  defined in "wpbc_ajx_booking_listing" Obj.
      }
    }

    // Remove spin icon from  button and Enable this button.
    wpbc_button__remove_spin(response_data['ajx_cleaned_params']['ui_clicked_element_id']);

    // Hide modals
    wpbc_popup_modals__hide();
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
  jQuery('.wpbc_listing_container select').each(function (index) {
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
  jQuery('.wpbc_listing_container .ui_remark_section textarea').each(function (index) {
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

/**
 * Actions ,when we click on "Remark" button.
 *
 * @param jq_button  -	this jQuery button  object
 */
function wpbc_ajx_booking__ui_click__remark(jq_button) {
  jq_button.parents('.ui_group').find('.ui_remark_section').toggle();
}

/**
 *   Change booking resource   ---------------------------------------------------------------------------------- */

function wpbc_ajx_booking__ui_click_show__change_resource(booking_id, resource_id) {
  // Define ID of booking to hidden input
  jQuery('#change_booking_resource__booking_id').val(booking_id);

  // Select booking resource  that belong to  booking
  jQuery('#change_booking_resource__resource_select').val(resource_id).trigger('change');
  var cbr;

  // Get Resource section
  cbr = jQuery("#change_booking_resource__section").detach();

  // Append it to booking ROW
  cbr.appendTo(jQuery("#ui__change_booking_resource__section_in_booking_" + booking_id));
  cbr = null;

  // Hide sections of "Change booking resource" in all other bookings ROWs
  //jQuery( ".ui__change_booking_resource__section_in_booking" ).hide();
  if (!jQuery("#ui__change_booking_resource__section_in_booking_" + booking_id).is(':visible')) {
    jQuery(".ui__under_actions_row__section_in_booking").hide();
  }

  // Show only "change booking resource" section  for current booking
  jQuery("#ui__change_booking_resource__section_in_booking_" + booking_id).toggle();
}
function wpbc_ajx_booking__ui_click_save__change_resource(this_el, booking_action, el_id) {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': booking_action,
    'booking_id': jQuery('#change_booking_resource__booking_id').val(),
    'selected_resource_id': jQuery('#change_booking_resource__resource_select').val(),
    'ui_clicked_element_id': el_id
  });
  wpbc_button_enable_loading_icon(this_el);

  // wpbc_ajx_booking__ui_click_close__change_resource();
}
function wpbc_ajx_booking__ui_click_close__change_resource() {
  var cbrce;

  // Get Resource section
  cbrce = jQuery("#change_booking_resource__section").detach();

  // Append it to hidden HTML template section  at  the bottom  of the page
  cbrce.appendTo(jQuery("#wpbc_hidden_template__change_booking_resource"));
  cbrce = null;

  // Hide all change booking resources sections
  jQuery(".ui__change_booking_resource__section_in_booking").hide();
}

/**
 *   Duplicate booking in other resource   ---------------------------------------------------------------------- */

function wpbc_ajx_booking__ui_click_show__duplicate_booking(booking_id, resource_id) {
  // Define ID of booking to hidden input
  jQuery('#duplicate_booking_to_other_resource__booking_id').val(booking_id);

  // Select booking resource  that belong to  booking
  jQuery('#duplicate_booking_to_other_resource__resource_select').val(resource_id).trigger('change');
  var cbr;

  // Get Resource section
  cbr = jQuery("#duplicate_booking_to_other_resource__section").detach();

  // Append it to booking ROW
  cbr.appendTo(jQuery("#ui__duplicate_booking_to_other_resource__section_in_booking_" + booking_id));
  cbr = null;

  // Hide sections of "Duplicate booking" in all other bookings ROWs
  if (!jQuery("#ui__duplicate_booking_to_other_resource__section_in_booking_" + booking_id).is(':visible')) {
    jQuery(".ui__under_actions_row__section_in_booking").hide();
  }

  // Show only "Duplicate booking" section  for current booking ROW
  jQuery("#ui__duplicate_booking_to_other_resource__section_in_booking_" + booking_id).toggle();
}
function wpbc_ajx_booking__ui_click_save__duplicate_booking(this_el, booking_action, el_id) {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': booking_action,
    'booking_id': jQuery('#duplicate_booking_to_other_resource__booking_id').val(),
    'selected_resource_id': jQuery('#duplicate_booking_to_other_resource__resource_select').val(),
    'ui_clicked_element_id': el_id
  });
  wpbc_button_enable_loading_icon(this_el);

  // wpbc_ajx_booking__ui_click_close__change_resource();
}
function wpbc_ajx_booking__ui_click_close__duplicate_booking() {
  var cbrce;

  // Get Resource section
  cbrce = jQuery("#duplicate_booking_to_other_resource__section").detach();

  // Append it to hidden HTML template section  at  the bottom  of the page
  cbrce.appendTo(jQuery("#wpbc_hidden_template__duplicate_booking_to_other_resource"));
  cbrce = null;

  // Hide all change booking resources sections
  jQuery(".ui__duplicate_booking_to_other_resource__section_in_booking").hide();
}

/**
 *   Change payment status   ------------------------------------------------------------------------------------ */

function wpbc_ajx_booking__ui_click_show__set_payment_status(booking_id) {
  var jSelect = jQuery('#ui__set_payment_status__section_in_booking_' + booking_id).find('select');
  var selected_pay_status = jSelect.attr("ajx-selected-value");

  // Is it float - then  it's unknown
  if (!isNaN(parseFloat(selected_pay_status))) {
    jSelect.find('option[value="1"]').prop('selected', true); // Unknown  value is '1' in select box
  } else {
    jSelect.find('option[value="' + selected_pay_status + '"]').prop('selected', true); // Otherwise known payment status
  }

  // Hide sections of "Change booking resource" in all other bookings ROWs
  if (!jQuery("#ui__set_payment_status__section_in_booking_" + booking_id).is(':visible')) {
    jQuery(".ui__under_actions_row__section_in_booking").hide();
  }

  // Show only "change booking resource" section  for current booking
  jQuery("#ui__set_payment_status__section_in_booking_" + booking_id).toggle();
}
function wpbc_ajx_booking__ui_click_save__set_payment_status(booking_id, this_el, booking_action, el_id) {
  wpbc_ajx_booking_ajax_action_request({
    'booking_action': booking_action,
    'booking_id': booking_id,
    'selected_payment_status': jQuery('#ui_btn_set_payment_status' + booking_id).val(),
    'ui_clicked_element_id': el_id + '_save'
  });
  wpbc_button_enable_loading_icon(this_el);
  jQuery('#' + el_id + '_cancel').hide();
  //wpbc_button_enable_loading_icon( jQuery( '#' + el_id + '_cancel').get(0) );
}
function wpbc_ajx_booking__ui_click_close__set_payment_status() {
  // Hide all change  payment status for booking
  jQuery(".ui__set_payment_status__section_in_booking").hide();
}

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19hY3Rpb25zLmpzIiwibmFtZXMiOlsiX3R5cGVvZiIsIm8iLCJTeW1ib2wiLCJpdGVyYXRvciIsImNvbnN0cnVjdG9yIiwicHJvdG90eXBlIiwid3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0IiwiYWN0aW9uX3BhcmFtIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwibG9nIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsIkFycmF5IiwiaXNBcnJheSIsIndwYmNfZ2V0X3NlbGVjdGVkX2xvY2FsZSIsIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyIsImdldF9zZWN1cmVfcGFyYW0iLCJhY3Rpb25fcG9zdF9wYXJhbXMiLCJhY3Rpb24iLCJub25jZSIsIndwYmNfYWp4X3VzZXJfaWQiLCJ3cGJjX2FqeF9sb2NhbGUiLCJhY3Rpb25fcGFyYW1zIiwic2VhcmNoX3BhcmFtcyIsImpRdWVyeSIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwiaGlkZSIsImdldF9vdGhlcl9wYXJhbSIsImh0bWwiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJyZXBsYWNlIiwiaXNfcmVsb2FkX2FqYXhfbGlzdGluZyIsIndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyIsImNsb3NlZF90aW1lciIsInNldFRpbWVvdXQiLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluIiwiZG9jdW1lbnQiLCJsb2NhdGlvbiIsImhyZWYiLCJyZWxvYWQiLCJ3cGJjX2FqeF9ib29raW5nX19leHBvcnRfY3N2X3VybF9fZG93bmxvYWQiLCJ3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdyIsIndwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiIsIndwYmNfcG9wdXBfbW9kYWxzX19oaWRlIiwiZmFpbCIsImVycm9yVGhyb3duIiwid2luZG93IiwiZXJyb3JfbWVzc2FnZSIsInJlc3BvbnNlVGV4dCIsIndwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlIiwid3BiY19teV9tb2RhbCIsIndwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3Nob3J0Iiwic2hvdyIsIndwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3dpZGUiLCJ3cGJjX2FqeF9jbGlja19vbl9kYXRlc190b2dnbGUiLCJ0aGlzX2RhdGUiLCJwYXJlbnRzIiwiZmluZCIsInRvZ2dsZSIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlIiwiZWFjaCIsImluZGV4Iiwic2VsZWN0aW9uIiwiYXR0ciIsInByb3AiLCJoYXNDbGFzcyIsImJvb2tpbmdfbG9jYWxlX2J1dHRvbiIsImFkZENsYXNzIiwid3BiY190aXBweSIsImdldCIsIl90aXBweSIsInNldENvbnRlbnQiLCJ3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX3JlbWFyayIsInRleHRfdmFsIiwidmFsIiwicmVtYXJrX2J1dHRvbiIsInNldFByb3BzIiwiYWxsb3dIVE1MIiwiY29udGVudCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19yZW1hcmsiLCJqcV9idXR0b24iLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zaG93X19jaGFuZ2VfcmVzb3VyY2UiLCJib29raW5nX2lkIiwicmVzb3VyY2VfaWQiLCJ0cmlnZ2VyIiwiY2JyIiwiZGV0YWNoIiwiYXBwZW5kVG8iLCJpcyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX2NoYW5nZV9yZXNvdXJjZSIsInRoaXNfZWwiLCJib29raW5nX2FjdGlvbiIsImVsX2lkIiwid3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19jaGFuZ2VfcmVzb3VyY2UiLCJjYnJjZSIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX2R1cGxpY2F0ZV9ib29raW5nIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fZHVwbGljYXRlX2Jvb2tpbmciLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fZHVwbGljYXRlX2Jvb2tpbmciLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zaG93X19zZXRfcGF5bWVudF9zdGF0dXMiLCJqU2VsZWN0Iiwic2VsZWN0ZWRfcGF5X3N0YXR1cyIsImlzTmFOIiwicGFyc2VGbG9hdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9wYXltZW50X3N0YXR1cyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19zZXRfcGF5bWVudF9zdGF0dXMiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19zZXRfYm9va2luZ19jb3N0Iiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX3NldF9ib29raW5nX2Nvc3QiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fc2VuZF9wYXltZW50X3JlcXVlc3QiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19faW1wb3J0X2dvb2dsZV9jYWxlbmRhciIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19leHBvcnRfY3N2IiwicGFyYW1zIiwic2VsZWN0ZWRfYm9va2luZ19pZF9hcnIiLCJ3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQiLCJqb2luIiwic2VhcmNoX2dldF9hbGxfcGFyYW1zIiwiZXhwb3J0X2Nzdl91cmwiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWJvb2tpbmdzL19zcmMvYm9va2luZ3NfX2FjdGlvbnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogICBBamF4ICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuLy92YXIgaXNfdGhpc19hY3Rpb24gPSBmYWxzZTtcclxuLyoqXHJcbiAqIFNlbmQgQWpheCBhY3Rpb24gcmVxdWVzdCwgIGxpa2UgYXBwcm92aW5nIG9yIGNhbmNlbGxhdGlvblxyXG4gKlxyXG4gKiBAcGFyYW0gYWN0aW9uX3BhcmFtXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIGFjdGlvbl9wYXJhbSA9IHt9ICl7XHJcblxyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfQk9PS0lOR19BQ1RJT05TJyApOyBjb25zb2xlLmxvZyggJyA9PSBBamF4IEFjdGlvbnMgOjogUGFyYW1zID09ICcsIGFjdGlvbl9wYXJhbSApO1xyXG4vL2lzX3RoaXNfYWN0aW9uID0gdHJ1ZTtcclxuXHJcblx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpO1xyXG5cclxuXHQvLyBHZXQgcmVkZWZpbmVkIExvY2FsZSwgIGlmIGFjdGlvbiBvbiBzaW5nbGUgYm9va2luZyAhXHJcblx0aWYgKCAgKCB1bmRlZmluZWQgIT0gYWN0aW9uX3BhcmFtWyAnYm9va2luZ19pZCcgXSApICYmICggISBBcnJheS5pc0FycmF5KCBhY3Rpb25fcGFyYW1bICdib29raW5nX2lkJyBdICkgKSApe1x0XHRcdFx0Ly8gTm90IGFycmF5XHJcblxyXG5cdFx0YWN0aW9uX3BhcmFtWyAnbG9jYWxlJyBdID0gd3BiY19nZXRfc2VsZWN0ZWRfbG9jYWxlKCBhY3Rpb25fcGFyYW1bICdib29raW5nX2lkJyBdLCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSApO1xyXG5cdH1cclxuXHJcblx0dmFyIGFjdGlvbl9wb3N0X3BhcmFtcyA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9CT09LSU5HX0FDVElPTlMnLFxyXG5cdFx0XHRcdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdHdwYmNfYWp4X3VzZXJfaWQ6ICggKCB1bmRlZmluZWQgPT0gYWN0aW9uX3BhcmFtWyAndXNlcl9pZCcgXSApID8gd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApIDogYWN0aW9uX3BhcmFtWyAndXNlcl9pZCcgXSApLFxyXG5cdFx0XHRcdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlOiAgKCAoIHVuZGVmaW5lZCA9PSBhY3Rpb25fcGFyYW1bICdsb2NhbGUnIF0gKSAgPyB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSAgOiBhY3Rpb25fcGFyYW1bICdsb2NhbGUnIF0gKSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRhY3Rpb25fcGFyYW1zXHQ6IGFjdGlvbl9wYXJhbVxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdC8vIEl0J3MgcmVxdWlyZWQgZm9yIENTViBleHBvcnQgLSBnZXR0aW5nIHRoZSBzYW1lIGxpc3QgIG9mIGJvb2tpbmdzXHJcblx0aWYgKCB0eXBlb2YgYWN0aW9uX3BhcmFtLnNlYXJjaF9wYXJhbXMgIT09ICd1bmRlZmluZWQnICl7XHJcblx0XHRhY3Rpb25fcG9zdF9wYXJhbXNbICdzZWFyY2hfcGFyYW1zJyBdID0gYWN0aW9uX3BhcmFtLnNlYXJjaF9wYXJhbXM7XHJcblx0XHRkZWxldGUgYWN0aW9uX3Bvc3RfcGFyYW1zLmFjdGlvbl9wYXJhbXMuc2VhcmNoX3BhcmFtcztcclxuXHR9XHJcblxyXG5cdC8vIFN0YXJ0IEFqYXhcclxuXHRqUXVlcnkucG9zdCggd3BiY191cmxfYWpheCAsXHJcblxyXG5cdFx0XHRcdGFjdGlvbl9wb3N0X3BhcmFtcyAsXHJcblxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuXHJcbmNvbnNvbGUubG9nKCAnID09IEFqYXggQWN0aW9ucyA6OiBSZXNwb25zZSBXUEJDX0FKWF9CT09LSU5HX0FDVElPTlMgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHQgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNi4xLjUuXHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICggJzEnID09IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdCcgXSApID8gJ3N1Y2Nlc3MnIDogJ2Vycm9yJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICggKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mKHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ2FmdGVyX2FjdGlvbl9yZXN1bHRfZGVsYXknIF0pIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0OiByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICdhZnRlcl9hY3Rpb25fcmVzdWx0X2RlbGF5JyBdIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gU3VjY2VzcyByZXNwb25zZVxyXG5cdFx0XHRcdFx0aWYgKCAnMScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0JyBdICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgaXNfcmVsb2FkX2FqYXhfbGlzdGluZyA9IHRydWU7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBBZnRlciBHb29nbGUgQ2FsZW5kYXIgaW1wb3J0IHNob3cgaW1wb3J0ZWQgYm9va2luZ3MgYW5kIHJlbG9hZCB0aGUgcGFnZSBmb3IgdG9vbGJhciBwYXJhbWV0ZXJzIHVwZGF0ZVxyXG5cdFx0XHRcdFx0XHRpZiAoIGZhbHNlICE9PSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICduZXdfbGlzdGluZ19wYXJhbXMnIF0gKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICduZXdfbGlzdGluZ19wYXJhbXMnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluKCkgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICduZXdfbGlzdGluZ19wYXJhbXMnIF1bICdyZWxvYWRfdXJsX3BhcmFtcycgXSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZG9jdW1lbnQubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ25ld19saXN0aW5nX3BhcmFtcycgXVsgJ3JlbG9hZF91cmxfcGFyYW1zJyBdO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkb2N1bWVudC5sb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAyMDAwICk7XHJcblx0XHRcdFx0XHRcdFx0aXNfcmVsb2FkX2FqYXhfbGlzdGluZyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBTdGFydCBkb3dubG9hZCBleHBvcnRlZCBDU1YgZmlsZVxyXG5cdFx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICdleHBvcnRfY3N2X3VybCcgXSApe1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2V4cG9ydF9jc3ZfdXJsX19kb3dubG9hZCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnZXhwb3J0X2Nzdl91cmwnIF0gKTtcclxuXHRcdFx0XHRcdFx0XHRpc19yZWxvYWRfYWpheF9saXN0aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmICggaXNfcmVsb2FkX2FqYXhfbGlzdGluZyApe1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93KCk7XHQvL1x0U2VuZGluZyBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZCBpbiBcIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1wiIE9iai5cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBSZW1vdmUgc3BpbiBpY29uIGZyb20gIGJ1dHRvbiBhbmQgRW5hYmxlIHRoaXMgYnV0dG9uLlxyXG5cdFx0XHRcdFx0d3BiY19idXR0b25fX3JlbW92ZV9zcGluKCByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdIClcclxuXHJcblx0XHRcdFx0XHQvLyBIaWRlIG1vZGFsc1xyXG5cdFx0XHRcdFx0d3BiY19wb3B1cF9tb2RhbHNfX2hpZGUoKTtcclxuXHJcblx0XHRcdFx0XHRqUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNi4xLjUuXHJcblx0XHRcdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhJyArICc8L3N0cm9uZz4gJyArIGVycm9yVGhyb3duIDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0ganFYSFIucmVzcG9uc2VUZXh0O1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdFx0ICB9KVxyXG5cdCAgICAgICAgICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHRcdCAgLy8gLmFsd2F5cyggZnVuY3Rpb24gKCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ2Fsd2F5cyBmaW5pc2hlZCcsIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICk7IH0gICAgIH0pXHJcblx0XHRcdCAgOyAgLy8gRW5kIEFqYXhcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogSGlkZSBhbGwgb3BlbiBtb2RhbCBwb3B1cHMgd2luZG93c1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19wb3B1cF9tb2RhbHNfX2hpZGUoKXtcclxuXHJcblx0Ly8gSGlkZSBtb2RhbHNcclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAoalF1ZXJ5KCAnLndwYmNfcG9wdXBfbW9kYWwnICkud3BiY19teV9tb2RhbCkgKXtcclxuXHRcdGpRdWVyeSggJy53cGJjX3BvcHVwX21vZGFsJyApLndwYmNfbXlfbW9kYWwoICdoaWRlJyApO1xyXG5cdH1cclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIERhdGVzICBTaG9ydCA8LT4gV2lkZSAgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfY2xpY2tfb25fZGF0ZXNfc2hvcnQoKXtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19zbWFsbCwuYm9va2luZ19kYXRlc19mdWxsJyApLmhpZGUoKTtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19mdWxsLC5ib29raW5nX2RhdGVzX3NtYWxsJyApLnNob3coKTtcclxuXHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsndWlfdXNyX19kYXRlc19zaG9ydF93aWRlJzogJ3Nob3J0J30gKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfY2xpY2tfb25fZGF0ZXNfd2lkZSgpe1xyXG5cdGpRdWVyeSggJyNib29raW5nX2RhdGVzX2Z1bGwsLmJvb2tpbmdfZGF0ZXNfc21hbGwnICkuaGlkZSgpO1xyXG5cdGpRdWVyeSggJyNib29raW5nX2RhdGVzX3NtYWxsLC5ib29raW5nX2RhdGVzX2Z1bGwnICkuc2hvdygpO1xyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggeyd1aV91c3JfX2RhdGVzX3Nob3J0X3dpZGUnOiAnd2lkZSd9ICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3RvZ2dsZSh0aGlzX2RhdGUpe1xyXG5cclxuXHRqUXVlcnkoIHRoaXNfZGF0ZSApLnBhcmVudHMoICcud3BiY19jb2xfZGF0ZXMnICkuZmluZCggJy5ib29raW5nX2RhdGVzX3NtYWxsJyApLnRvZ2dsZSgpO1xyXG5cdGpRdWVyeSggdGhpc19kYXRlICkucGFyZW50cyggJy53cGJjX2NvbF9kYXRlcycgKS5maW5kKCAnLmJvb2tpbmdfZGF0ZXNfZnVsbCcgKS50b2dnbGUoKTtcclxuXHJcblx0LypcclxuXHR2YXIgdmlzaWJsZV9zZWN0aW9uID0galF1ZXJ5KCB0aGlzX2RhdGUgKS5wYXJlbnRzKCAnLmJvb2tpbmdfZGF0ZXNfZXhwYW5kX3NlY3Rpb24nICk7XHJcblx0dmlzaWJsZV9zZWN0aW9uLmhpZGUoKTtcclxuXHRpZiAoIHZpc2libGVfc2VjdGlvbi5oYXNDbGFzcyggJ2Jvb2tpbmdfZGF0ZXNfZnVsbCcgKSApe1xyXG5cdFx0dmlzaWJsZV9zZWN0aW9uLnBhcmVudHMoICcud3BiY19jb2xfZGF0ZXMnICkuZmluZCggJy5ib29raW5nX2RhdGVzX3NtYWxsJyApLnNob3coKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dmlzaWJsZV9zZWN0aW9uLnBhcmVudHMoICcud3BiY19jb2xfZGF0ZXMnICkuZmluZCggJy5ib29raW5nX2RhdGVzX2Z1bGwnICkuc2hvdygpO1xyXG5cdH0qL1xyXG5cdGNvbnNvbGUubG9nKCAnd3BiY19hanhfY2xpY2tfb25fZGF0ZXNfdG9nZ2xlJywgdGhpc19kYXRlICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiAgIExvY2FsZSAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFx0U2VsZWN0IG9wdGlvbnMgaW4gc2VsZWN0IGJveGVzIGJhc2VkIG9uIGF0dHJpYnV0ZSBcInZhbHVlX29mX3NlbGVjdGVkX29wdGlvblwiIGFuZCBSRUQgY29sb3IgYW5kIGhpbnQgZm9yIExPQ0FMRSBidXR0b24gICAtLSAgSXQncyBjYWxsZWQgZnJvbSBcdHdwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzKCkgIFx0ZWFjaCAgdGltZSBhZnRlciBMaXN0aW5nIGxvYWRpbmcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX2xvY2FsZSgpe1xyXG5cclxuXHRqUXVlcnkoICcud3BiY19saXN0aW5nX2NvbnRhaW5lciBzZWxlY3QnICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApe1xyXG5cclxuXHRcdHZhciBzZWxlY3Rpb24gPSBqUXVlcnkoIHRoaXMgKS5hdHRyKCBcInZhbHVlX29mX3NlbGVjdGVkX29wdGlvblwiICk7XHRcdFx0Ly8gRGVmaW5lIHNlbGVjdGVkIHNlbGVjdCBib3hlc1xyXG5cclxuXHRcdGlmICggdW5kZWZpbmVkICE9PSBzZWxlY3Rpb24gKXtcclxuXHRcdFx0alF1ZXJ5KCB0aGlzICkuZmluZCggJ29wdGlvblt2YWx1ZT1cIicgKyBzZWxlY3Rpb24gKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcclxuXHJcblx0XHRcdGlmICggKCcnICE9IHNlbGVjdGlvbikgJiYgKGpRdWVyeSggdGhpcyApLmhhc0NsYXNzKCAnc2V0X2Jvb2tpbmdfbG9jYWxlX3NlbGVjdGJveCcgKSkgKXtcdFx0XHRcdFx0XHRcdFx0Ly8gTG9jYWxlXHJcblxyXG5cdFx0XHRcdHZhciBib29raW5nX2xvY2FsZV9idXR0b24gPSBqUXVlcnkoIHRoaXMgKS5wYXJlbnRzKCAnLnVpX2VsZW1lbnRfbG9jYWxlJyApLmZpbmQoICcuc2V0X2Jvb2tpbmdfbG9jYWxlX2J1dHRvbicgKVxyXG5cclxuXHRcdFx0XHQvL2Jvb2tpbmdfbG9jYWxlX2J1dHRvbi5jc3MoICdjb2xvcicsICcjZGI0ODAwJyApO1x0XHQvLyBTZXQgYnV0dG9uICByZWRcclxuXHRcdFx0XHRib29raW5nX2xvY2FsZV9idXR0b24uYWRkQ2xhc3MoICd3cGJjX3VpX3JlZCcgKTtcdFx0Ly8gU2V0IGJ1dHRvbiAgcmVkXHJcblx0XHRcdFx0IGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mKCB3cGJjX3RpcHB5ICkgKXtcclxuXHRcdFx0XHRcdGJvb2tpbmdfbG9jYWxlX2J1dHRvbi5nZXQoMCkuX3RpcHB5LnNldENvbnRlbnQoIHNlbGVjdGlvbiApO1xyXG5cdFx0XHRcdCB9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiAgIFJlbWFyayAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIERlZmluZSBjb250ZW50IG9mIHJlbWFyayBcImJvb2tpbmcgbm90ZVwiIGJ1dHRvbiBhbmQgdGV4dGFyZWEuICAtLSBJdCdzIGNhbGxlZCBmcm9tIFx0d3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MoKSAgXHRlYWNoICB0aW1lIGFmdGVyIExpc3RpbmcgbG9hZGluZy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrKCl7XHJcblxyXG5cdGpRdWVyeSggJy53cGJjX2xpc3RpbmdfY29udGFpbmVyIC51aV9yZW1hcmtfc2VjdGlvbiB0ZXh0YXJlYScgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblx0XHR2YXIgdGV4dF92YWwgPSBqUXVlcnkoIHRoaXMgKS52YWwoKTtcclxuXHRcdGlmICggKHVuZGVmaW5lZCAhPT0gdGV4dF92YWwpICYmICgnJyAhPSB0ZXh0X3ZhbCkgKXtcclxuXHJcblx0XHRcdHZhciByZW1hcmtfYnV0dG9uID0galF1ZXJ5KCB0aGlzICkucGFyZW50cyggJy51aV9ncm91cCcgKS5maW5kKCAnLnNldF9ib29raW5nX25vdGVfYnV0dG9uJyApO1xyXG5cclxuXHRcdFx0aWYgKCByZW1hcmtfYnV0dG9uLmxlbmd0aCA+IDAgKXtcclxuXHJcblx0XHRcdFx0cmVtYXJrX2J1dHRvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHQvLyBTZXQgYnV0dG9uICByZWRcclxuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdFx0XHRcdC8vcmVtYXJrX2J1dHRvbi5nZXQoIDAgKS5fdGlwcHkuYWxsb3dIVE1MID0gdHJ1ZTtcclxuXHRcdFx0XHRcdC8vcmVtYXJrX2J1dHRvbi5nZXQoIDAgKS5fdGlwcHkuc2V0Q29udGVudCggdGV4dF92YWwucmVwbGFjZSgvW1xcblxccl0vZywgJzxicj4nKSApO1xyXG5cclxuXHRcdFx0XHRcdHJlbWFya19idXR0b24uZ2V0KCAwICkuX3RpcHB5LnNldFByb3BzKCB7XHJcblx0XHRcdFx0XHRcdGFsbG93SFRNTDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y29udGVudCAgOiB0ZXh0X3ZhbC5yZXBsYWNlKCAvW1xcblxccl0vZywgJzxicj4nIClcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBY3Rpb25zICx3aGVuIHdlIGNsaWNrIG9uIFwiUmVtYXJrXCIgYnV0dG9uLlxyXG4gKlxyXG4gKiBAcGFyYW0ganFfYnV0dG9uICAtXHR0aGlzIGpRdWVyeSBidXR0b24gIG9iamVjdFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX3JlbWFyaygganFfYnV0dG9uICl7XHJcblxyXG5cdGpxX2J1dHRvbi5wYXJlbnRzKCcudWlfZ3JvdXAnKS5maW5kKCcudWlfcmVtYXJrX3NlY3Rpb24nKS50b2dnbGUoKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIENoYW5nZSBib29raW5nIHJlc291cmNlICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fY2hhbmdlX3Jlc291cmNlKCBib29raW5nX2lkLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBEZWZpbmUgSUQgb2YgYm9va2luZyB0byBoaWRkZW4gaW5wdXRcclxuXHRqUXVlcnkoICcjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNlbGVjdCBib29raW5nIHJlc291cmNlICB0aGF0IGJlbG9uZyB0byAgYm9va2luZ1xyXG5cdGpRdWVyeSggJyNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fcmVzb3VyY2Vfc2VsZWN0JyApLnZhbCggcmVzb3VyY2VfaWQgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdHZhciBjYnI7XHJcblxyXG5cdC8vIEdldCBSZXNvdXJjZSBzZWN0aW9uXHJcblx0Y2JyID0galF1ZXJ5KCBcIiNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvblwiICkuZGV0YWNoKCk7XHJcblxyXG5cdC8vIEFwcGVuZCBpdCB0byBib29raW5nIFJPV1xyXG5cdGNici5hcHBlbmRUbyggalF1ZXJ5KCBcIiN1aV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKSApO1xyXG5cdGNiciA9IG51bGw7XHJcblxyXG5cdC8vIEhpZGUgc2VjdGlvbnMgb2YgXCJDaGFuZ2UgYm9va2luZyByZXNvdXJjZVwiIGluIGFsbCBvdGhlciBib29raW5ncyBST1dzXHJcblx0Ly9qUXVlcnkoIFwiLnVpX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nXCIgKS5oaWRlKCk7XHJcblx0aWYgKCAhIGpRdWVyeSggXCIjdWlfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkuaXMoJzp2aXNpYmxlJykgKXtcclxuXHRcdGpRdWVyeSggXCIudWlfX3VuZGVyX2FjdGlvbnNfcm93X19zZWN0aW9uX2luX2Jvb2tpbmdcIiApLmhpZGUoKTtcclxuXHR9XHJcblxyXG5cdC8vIFNob3cgb25seSBcImNoYW5nZSBib29raW5nIHJlc291cmNlXCIgc2VjdGlvbiAgZm9yIGN1cnJlbnQgYm9va2luZ1xyXG5cdGpRdWVyeSggXCIjdWlfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkudG9nZ2xlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX2NoYW5nZV9yZXNvdXJjZSggdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGpRdWVyeSggJyNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RlZF9yZXNvdXJjZV9pZCcgOiBqUXVlcnkoICcjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3Jlc291cmNlX3NlbGVjdCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZFxyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHQvLyB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fY2hhbmdlX3Jlc291cmNlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19jaGFuZ2VfcmVzb3VyY2UoKXtcclxuXHJcblx0dmFyIGNicmNlO1xyXG5cclxuXHQvLyBHZXQgUmVzb3VyY2Ugc2VjdGlvblxyXG5cdGNicmNlID0galF1ZXJ5KFwiI2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uXCIpLmRldGFjaCgpO1xyXG5cclxuXHQvLyBBcHBlbmQgaXQgdG8gaGlkZGVuIEhUTUwgdGVtcGxhdGUgc2VjdGlvbiAgYXQgIHRoZSBib3R0b20gIG9mIHRoZSBwYWdlXHJcblx0Y2JyY2UuYXBwZW5kVG8oalF1ZXJ5KFwiI3dwYmNfaGlkZGVuX3RlbXBsYXRlX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZVwiKSk7XHJcblx0Y2JyY2UgPSBudWxsO1xyXG5cclxuXHQvLyBIaWRlIGFsbCBjaGFuZ2UgYm9va2luZyByZXNvdXJjZXMgc2VjdGlvbnNcclxuXHRqUXVlcnkoXCIudWlfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdcIikuaGlkZSgpO1xyXG59XHJcblxyXG4vKipcclxuICogICBEdXBsaWNhdGUgYm9va2luZyBpbiBvdGhlciByZXNvdXJjZSAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX2R1cGxpY2F0ZV9ib29raW5nKCBib29raW5nX2lkLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBEZWZpbmUgSUQgb2YgYm9va2luZyB0byBoaWRkZW4gaW5wdXRcclxuXHRqUXVlcnkoICcjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNlbGVjdCBib29raW5nIHJlc291cmNlICB0aGF0IGJlbG9uZyB0byAgYm9va2luZ1xyXG5cdGpRdWVyeSggJyNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fcmVzb3VyY2Vfc2VsZWN0JyApLnZhbCggcmVzb3VyY2VfaWQgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdHZhciBjYnI7XHJcblxyXG5cdC8vIEdldCBSZXNvdXJjZSBzZWN0aW9uXHJcblx0Y2JyID0galF1ZXJ5KCBcIiNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvblwiICkuZGV0YWNoKCk7XHJcblxyXG5cdC8vIEFwcGVuZCBpdCB0byBib29raW5nIFJPV1xyXG5cdGNici5hcHBlbmRUbyggalF1ZXJ5KCBcIiN1aV9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKSApO1xyXG5cdGNiciA9IG51bGw7XHJcblxyXG5cdC8vIEhpZGUgc2VjdGlvbnMgb2YgXCJEdXBsaWNhdGUgYm9va2luZ1wiIGluIGFsbCBvdGhlciBib29raW5ncyBST1dzXHJcblx0aWYgKCAhIGpRdWVyeSggXCIjdWlfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkuaXMoJzp2aXNpYmxlJykgKXtcclxuXHRcdGpRdWVyeSggXCIudWlfX3VuZGVyX2FjdGlvbnNfcm93X19zZWN0aW9uX2luX2Jvb2tpbmdcIiApLmhpZGUoKTtcclxuXHR9XHJcblxyXG5cdC8vIFNob3cgb25seSBcIkR1cGxpY2F0ZSBib29raW5nXCIgc2VjdGlvbiAgZm9yIGN1cnJlbnQgYm9va2luZyBST1dcclxuXHRqUXVlcnkoIFwiI3VpX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApLnRvZ2dsZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19kdXBsaWNhdGVfYm9va2luZyggdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGpRdWVyeSggJyNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RlZF9yZXNvdXJjZV9pZCcgOiBqUXVlcnkoICcjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3Jlc291cmNlX3NlbGVjdCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZFxyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHQvLyB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fY2hhbmdlX3Jlc291cmNlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19kdXBsaWNhdGVfYm9va2luZygpe1xyXG5cclxuXHR2YXIgY2JyY2U7XHJcblxyXG5cdC8vIEdldCBSZXNvdXJjZSBzZWN0aW9uXHJcblx0Y2JyY2UgPSBqUXVlcnkoXCIjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb25cIikuZGV0YWNoKCk7XHJcblxyXG5cdC8vIEFwcGVuZCBpdCB0byBoaWRkZW4gSFRNTCB0ZW1wbGF0ZSBzZWN0aW9uICBhdCAgdGhlIGJvdHRvbSAgb2YgdGhlIHBhZ2VcclxuXHRjYnJjZS5hcHBlbmRUbyhqUXVlcnkoXCIjd3BiY19oaWRkZW5fdGVtcGxhdGVfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlXCIpKTtcclxuXHRjYnJjZSA9IG51bGw7XHJcblxyXG5cdC8vIEhpZGUgYWxsIGNoYW5nZSBib29raW5nIHJlc291cmNlcyBzZWN0aW9uc1xyXG5cdGpRdWVyeShcIi51aV9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ1wiKS5oaWRlKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiAgIENoYW5nZSBwYXltZW50IHN0YXR1cyAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fc2V0X3BheW1lbnRfc3RhdHVzKCBib29raW5nX2lkICl7XHJcblxyXG5cdHZhciBqU2VsZWN0ID0galF1ZXJ5KCAnI3VpX19zZXRfcGF5bWVudF9zdGF0dXNfX3NlY3Rpb25faW5fYm9va2luZ18nICsgYm9va2luZ19pZCApLmZpbmQoICdzZWxlY3QnIClcclxuXHJcblx0dmFyIHNlbGVjdGVkX3BheV9zdGF0dXMgPSBqU2VsZWN0LmF0dHIoIFwiYWp4LXNlbGVjdGVkLXZhbHVlXCIgKTtcclxuXHJcblx0Ly8gSXMgaXQgZmxvYXQgLSB0aGVuICBpdCdzIHVua25vd25cclxuXHRpZiAoICFpc05hTiggcGFyc2VGbG9hdCggc2VsZWN0ZWRfcGF5X3N0YXR1cyApICkgKXtcclxuXHRcdGpTZWxlY3QuZmluZCggJ29wdGlvblt2YWx1ZT1cIjFcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1x0XHRcdFx0XHRcdFx0XHQvLyBVbmtub3duICB2YWx1ZSBpcyAnMScgaW4gc2VsZWN0IGJveFxyXG5cdH0gZWxzZSB7XHJcblx0XHRqU2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCInICsgc2VsZWN0ZWRfcGF5X3N0YXR1cyArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1x0XHQvLyBPdGhlcndpc2Uga25vd24gcGF5bWVudCBzdGF0dXNcclxuXHR9XHJcblxyXG5cdC8vIEhpZGUgc2VjdGlvbnMgb2YgXCJDaGFuZ2UgYm9va2luZyByZXNvdXJjZVwiIGluIGFsbCBvdGhlciBib29raW5ncyBST1dzXHJcblx0aWYgKCAhIGpRdWVyeSggXCIjdWlfX3NldF9wYXltZW50X3N0YXR1c19fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApLmlzKCc6dmlzaWJsZScpICl7XHJcblx0XHRqUXVlcnkoIFwiLnVpX191bmRlcl9hY3Rpb25zX3Jvd19fc2VjdGlvbl9pbl9ib29raW5nXCIgKS5oaWRlKCk7XHJcblx0fVxyXG5cclxuXHQvLyBTaG93IG9ubHkgXCJjaGFuZ2UgYm9va2luZyByZXNvdXJjZVwiIHNlY3Rpb24gIGZvciBjdXJyZW50IGJvb2tpbmdcclxuXHRqUXVlcnkoIFwiI3VpX19zZXRfcGF5bWVudF9zdGF0dXNfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKS50b2dnbGUoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fc2V0X3BheW1lbnRfc3RhdHVzKCBib29raW5nX2lkLCB0aGlzX2VsLCBib29raW5nX2FjdGlvbiwgZWxfaWQgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogYm9va2luZ19hY3Rpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCcgICAgICAgICAgIDogYm9va2luZ19pZCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RlZF9wYXltZW50X3N0YXR1cycgOiBqUXVlcnkoICcjdWlfYnRuX3NldF9wYXltZW50X3N0YXR1cycgKyBib29raW5nX2lkICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogZWxfaWQgKyAnX3NhdmUnXHJcblx0fSApO1xyXG5cclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCB0aGlzX2VsICk7XHJcblxyXG5cdGpRdWVyeSggJyMnICsgZWxfaWQgKyAnX2NhbmNlbCcpLmhpZGUoKTtcclxuXHQvL3dwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIGpRdWVyeSggJyMnICsgZWxfaWQgKyAnX2NhbmNlbCcpLmdldCgwKSApO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX3NldF9wYXltZW50X3N0YXR1cygpe1xyXG5cdC8vIEhpZGUgYWxsIGNoYW5nZSAgcGF5bWVudCBzdGF0dXMgZm9yIGJvb2tpbmdcclxuXHRqUXVlcnkoXCIudWlfX3NldF9wYXltZW50X3N0YXR1c19fc2VjdGlvbl9pbl9ib29raW5nXCIpLmhpZGUoKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIENoYW5nZSBib29raW5nIGNvc3QgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fc2V0X2Jvb2tpbmdfY29zdCggYm9va2luZ19pZCwgdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGJvb2tpbmdfaWQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19jb3N0JyBcdFx0ICAgOiBqUXVlcnkoICcjdWlfYnRuX3NldF9ib29raW5nX2Nvc3QnICsgYm9va2luZ19pZCArICdfY29zdCcpLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6IGVsX2lkICsgJ19zYXZlJ1xyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHRqUXVlcnkoICcjJyArIGVsX2lkICsgJ19jYW5jZWwnKS5oaWRlKCk7XHJcblx0Ly93cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCBqUXVlcnkoICcjJyArIGVsX2lkICsgJ19jYW5jZWwnKS5nZXQoMCkgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19zZXRfYm9va2luZ19jb3N0KCl7XHJcblx0Ly8gSGlkZSBhbGwgY2hhbmdlICBwYXltZW50IHN0YXR1cyBmb3IgYm9va2luZ1xyXG5cdGpRdWVyeShcIi51aV9fc2V0X2Jvb2tpbmdfY29zdF9fc2VjdGlvbl9pbl9ib29raW5nXCIpLmhpZGUoKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIFNlbmQgUGF5bWVudCByZXF1ZXN0ICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19zZW5kX3BheW1lbnRfcmVxdWVzdCgpe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiAnc2VuZF9wYXltZW50X3JlcXVlc3QnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3JlcXVlc3RfX2Jvb2tpbmdfaWQnKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdyZWFzb25fb2ZfYWN0aW9uJyBcdCAgIDogalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfcmVxdWVzdF9fcmVhc29uX29mX2FjdGlvbicpLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6ICd3cGJjX21vZGFsX19wYXltZW50X3JlcXVlc3RfX2J1dHRvbl9zZW5kJ1xyXG5cdH0gKTtcclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCBqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9yZXF1ZXN0X19idXR0b25fc2VuZCcgKS5nZXQoIDAgKSApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgSW1wb3J0IEdvb2dsZSBDYWxlbmRhciAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19faW1wb3J0X2dvb2dsZV9jYWxlbmRhcigpe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiAnaW1wb3J0X2dvb2dsZV9jYWxlbmRhcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogJ3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX2J1dHRvbl9zZW5kJ1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbScgOiBcdFx0XHRcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX2Zyb20gb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbV9vZmZzZXQnIDogXHRcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX2Zyb21fb2Zmc2V0JyApLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX2Zyb21fb2Zmc2V0X3R5cGUnIDogXHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c19mcm9tX29mZnNldF90eXBlIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c191bnRpbCcgOiBcdFx0XHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c191bnRpbCBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c191bnRpbF9vZmZzZXQnIDogXHRcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX3VudGlsX29mZnNldCcgKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c191bnRpbF9vZmZzZXRfdHlwZScgOiBqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c191bnRpbF9vZmZzZXRfdHlwZSBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfbWF4JyA6IFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfbWF4JyApLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfcmVzb3VyY2UnIDogXHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjd3BiY19ib29raW5nX3Jlc291cmNlIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblx0fSApO1xyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19idXR0b25fc2VuZCcgKS5nZXQoIDAgKSApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgRXhwb3J0IGJvb2tpbmdzIHRvIENTViAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19leHBvcnRfY3N2KCBwYXJhbXMgKXtcclxuXHJcblx0dmFyIHNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyID0gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCk7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICAgOiBwYXJhbXNbICdib29raW5nX2FjdGlvbicgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIDogcGFyYW1zWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdleHBvcnRfdHlwZScgICAgICAgICAgIDogcGFyYW1zWyAnZXhwb3J0X3R5cGUnIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY3N2X2V4cG9ydF9zZXBhcmF0b3InICA6IHBhcmFtc1sgJ2Nzdl9leHBvcnRfc2VwYXJhdG9yJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Nzdl9leHBvcnRfc2tpcF9maWVsZHMnOiBwYXJhbXNbICdjc3ZfZXhwb3J0X3NraXBfZmllbGRzJyBdLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJ1x0OiBzZWxlY3RlZF9ib29raW5nX2lkX2Fyci5qb2luKCcsJyksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2VhcmNoX3BhcmFtcycgOiB3cGJjX2FqeF9ib29raW5nX2xpc3Rpbmcuc2VhcmNoX2dldF9hbGxfcGFyYW1zKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblxyXG5cdHZhciB0aGlzX2VsID0galF1ZXJ5KCAnIycgKyBwYXJhbXNbICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0gKS5nZXQoIDAgKVxyXG5cclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCB0aGlzX2VsICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPcGVuIFVSTCBpbiBuZXcgdGFiIC0gbWFpbmx5ICBpdCdzIHVzZWQgZm9yIG9wZW4gQ1NWIGxpbmsgIGZvciBkb3dubG9hZGVkIGV4cG9ydGVkIGJvb2tpbmdzIGFzIENTVlxyXG4gKlxyXG4gKiBAcGFyYW0gZXhwb3J0X2Nzdl91cmxcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX2V4cG9ydF9jc3ZfdXJsX19kb3dubG9hZCggZXhwb3J0X2Nzdl91cmwgKXtcclxuXHJcblx0Ly92YXIgc2VsZWN0ZWRfYm9va2luZ19pZF9hcnIgPSB3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQoKTtcclxuXHJcblx0ZG9jdW1lbnQubG9jYXRpb24uaHJlZiA9IGV4cG9ydF9jc3ZfdXJsOy8vICsgJyZzZWxlY3RlZF9pZD0nICsgc2VsZWN0ZWRfYm9va2luZ19pZF9hcnIuam9pbignLCcpO1xyXG5cclxuXHQvLyBJdCdzIG9wZW4gYWRkaXRpb25hbCBkaWFsb2cgZm9yIGFza2luZyBvcGVuaW5nIHVsciBpbiBuZXcgdGFiXHJcblx0Ly8gd2luZG93Lm9wZW4oIGV4cG9ydF9jc3ZfdXJsLCAnX2JsYW5rJykuZm9jdXMoKTtcclxufSJdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWTs7QUFFWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBSkEsU0FBQUEsUUFBQUMsQ0FBQSxzQ0FBQUQsT0FBQSx3QkFBQUUsTUFBQSx1QkFBQUEsTUFBQSxDQUFBQyxRQUFBLGFBQUFGLENBQUEsa0JBQUFBLENBQUEsZ0JBQUFBLENBQUEsV0FBQUEsQ0FBQSx5QkFBQUMsTUFBQSxJQUFBRCxDQUFBLENBQUFHLFdBQUEsS0FBQUYsTUFBQSxJQUFBRCxDQUFBLEtBQUFDLE1BQUEsQ0FBQUcsU0FBQSxxQkFBQUosQ0FBQSxLQUFBRCxPQUFBLENBQUFDLENBQUE7QUFLQSxTQUFTSyxvQ0FBb0NBLENBQUEsRUFBcUI7RUFBQSxJQUFuQkMsWUFBWSxHQUFBQyxTQUFBLENBQUFDLE1BQUEsUUFBQUQsU0FBQSxRQUFBRSxTQUFBLEdBQUFGLFNBQUEsTUFB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
