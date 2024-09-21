"use strict";

/**
 *   Ajax   ----------------------------------------------------------------------------------------------------- */
//var is_this_action = false;
/**
 * Send Ajax action request,  like approving or cancellation
 *
 * @param action_param
 */
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
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
      jQuery('.wpbc_ajx_under_toolbar_row').hide(); //FixIn: 9.6.1.5
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
    jQuery('.wpbc_ajx_under_toolbar_row').hide(); //FixIn: 9.6.1.5
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19hY3Rpb25zLmpzIiwibmFtZXMiOlsiX3R5cGVvZiIsIm9iaiIsIlN5bWJvbCIsIml0ZXJhdG9yIiwiY29uc3RydWN0b3IiLCJwcm90b3R5cGUiLCJ3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QiLCJhY3Rpb25fcGFyYW0iLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJjb25zb2xlIiwiZ3JvdXBDb2xsYXBzZWQiLCJsb2ciLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0IiwiQXJyYXkiLCJpc0FycmF5Iiwid3BiY19nZXRfc2VsZWN0ZWRfbG9jYWxlIiwid3BiY19hanhfYm9va2luZ19saXN0aW5nIiwiZ2V0X3NlY3VyZV9wYXJhbSIsImFjdGlvbl9wb3N0X3BhcmFtcyIsImFjdGlvbiIsIm5vbmNlIiwid3BiY19hanhfdXNlcl9pZCIsIndwYmNfYWp4X2xvY2FsZSIsImFjdGlvbl9wYXJhbXMiLCJzZWFyY2hfcGFyYW1zIiwialF1ZXJ5IiwicG9zdCIsIndwYmNfdXJsX2FqYXgiLCJyZXNwb25zZV9kYXRhIiwidGV4dFN0YXR1cyIsImpxWEhSIiwiZ3JvdXBFbmQiLCJoaWRlIiwiZ2V0X290aGVyX3BhcmFtIiwiaHRtbCIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsInJlcGxhY2UiLCJpc19yZWxvYWRfYWpheF9saXN0aW5nIiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwiY2xvc2VkX3RpbWVyIiwic2V0VGltZW91dCIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX2lzX3NwaW4iLCJkb2N1bWVudCIsImxvY2F0aW9uIiwiaHJlZiIsInJlbG9hZCIsIndwYmNfYWp4X2Jvb2tpbmdfX2V4cG9ydF9jc3ZfdXJsX19kb3dubG9hZCIsIndwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93Iiwid3BiY19idXR0b25fX3JlbW92ZV9zcGluIiwid3BiY19wb3B1cF9tb2RhbHNfX2hpZGUiLCJmYWlsIiwiZXJyb3JUaHJvd24iLCJ3aW5kb3ciLCJlcnJvcl9tZXNzYWdlIiwicmVzcG9uc2VUZXh0Iiwid3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UiLCJ3cGJjX215X21vZGFsIiwid3BiY19hanhfY2xpY2tfb25fZGF0ZXNfc2hvcnQiLCJzaG93Iiwid3BiY19hanhfY2xpY2tfb25fZGF0ZXNfd2lkZSIsIndwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3RvZ2dsZSIsInRoaXNfZGF0ZSIsInBhcmVudHMiLCJmaW5kIiwidG9nZ2xlIiwid3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUiLCJlYWNoIiwiaW5kZXgiLCJzZWxlY3Rpb24iLCJhdHRyIiwicHJvcCIsImhhc0NsYXNzIiwiYm9va2luZ19sb2NhbGVfYnV0dG9uIiwiYWRkQ2xhc3MiLCJ3cGJjX3RpcHB5IiwiZ2V0IiwiX3RpcHB5Iiwic2V0Q29udGVudCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrIiwidGV4dF92YWwiLCJ2YWwiLCJyZW1hcmtfYnV0dG9uIiwic2V0UHJvcHMiLCJhbGxvd0hUTUwiLCJjb250ZW50Iiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX3JlbWFyayIsImpxX2J1dHRvbiIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX2NoYW5nZV9yZXNvdXJjZSIsImJvb2tpbmdfaWQiLCJyZXNvdXJjZV9pZCIsInRyaWdnZXIiLCJjYnIiLCJkZXRhY2giLCJhcHBlbmRUbyIsImlzIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fY2hhbmdlX3Jlc291cmNlIiwidGhpc19lbCIsImJvb2tpbmdfYWN0aW9uIiwiZWxfaWQiLCJ3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX2NoYW5nZV9yZXNvdXJjZSIsImNicmNlIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fZHVwbGljYXRlX2Jvb2tpbmciLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19kdXBsaWNhdGVfYm9va2luZyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19kdXBsaWNhdGVfYm9va2luZyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX3NldF9wYXltZW50X3N0YXR1cyIsImpTZWxlY3QiLCJzZWxlY3RlZF9wYXlfc3RhdHVzIiwiaXNOYU4iLCJwYXJzZUZsb2F0Iiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fc2V0X3BheW1lbnRfc3RhdHVzIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX3NldF9wYXltZW50X3N0YXR1cyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9ib29raW5nX2Nvc3QiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fc2V0X2Jvb2tpbmdfY29zdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19zZW5kX3BheW1lbnRfcmVxdWVzdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2V4cG9ydF9jc3YiLCJwYXJhbXMiLCJzZWxlY3RlZF9ib29raW5nX2lkX2FyciIsIndwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCIsImpvaW4iLCJzZWFyY2hfZ2V0X2FsbF9wYXJhbXMiLCJleHBvcnRfY3N2X3VybCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtYm9va2luZ3MvX3NyYy9ib29raW5nc19fYWN0aW9ucy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiAgIEFqYXggICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG4vL3ZhciBpc190aGlzX2FjdGlvbiA9IGZhbHNlO1xyXG4vKipcclxuICogU2VuZCBBamF4IGFjdGlvbiByZXF1ZXN0LCAgbGlrZSBhcHByb3Zpbmcgb3IgY2FuY2VsbGF0aW9uXHJcbiAqXHJcbiAqIEBwYXJhbSBhY3Rpb25fcGFyYW1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCggYWN0aW9uX3BhcmFtID0ge30gKXtcclxuXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9CT09LSU5HX0FDVElPTlMnICk7IGNvbnNvbGUubG9nKCAnID09IEFqYXggQWN0aW9ucyA6OiBQYXJhbXMgPT0gJywgYWN0aW9uX3BhcmFtICk7XHJcbi8vaXNfdGhpc19hY3Rpb24gPSB0cnVlO1xyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG5cdC8vIEdldCByZWRlZmluZWQgTG9jYWxlLCAgaWYgYWN0aW9uIG9uIHNpbmdsZSBib29raW5nICFcclxuXHRpZiAoICAoIHVuZGVmaW5lZCAhPSBhY3Rpb25fcGFyYW1bICdib29raW5nX2lkJyBdICkgJiYgKCAhIEFycmF5LmlzQXJyYXkoIGFjdGlvbl9wYXJhbVsgJ2Jvb2tpbmdfaWQnIF0gKSApICl7XHRcdFx0XHQvLyBOb3QgYXJyYXlcclxuXHJcblx0XHRhY3Rpb25fcGFyYW1bICdsb2NhbGUnIF0gPSB3cGJjX2dldF9zZWxlY3RlZF9sb2NhbGUoIGFjdGlvbl9wYXJhbVsgJ2Jvb2tpbmdfaWQnIF0sIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApICk7XHJcblx0fVxyXG5cclxuXHR2YXIgYWN0aW9uX3Bvc3RfcGFyYW1zID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfQUNUSU9OUycsXHJcblx0XHRcdFx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogKCAoIHVuZGVmaW5lZCA9PSBhY3Rpb25fcGFyYW1bICd1c2VyX2lkJyBdICkgPyB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICkgOiBhY3Rpb25fcGFyYW1bICd1c2VyX2lkJyBdICksXHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGU6ICAoICggdW5kZWZpbmVkID09IGFjdGlvbl9wYXJhbVsgJ2xvY2FsZScgXSApICA/IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApICA6IGFjdGlvbl9wYXJhbVsgJ2xvY2FsZScgXSApLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbl9wYXJhbXNcdDogYWN0aW9uX3BhcmFtXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0Ly8gSXQncyByZXF1aXJlZCBmb3IgQ1NWIGV4cG9ydCAtIGdldHRpbmcgdGhlIHNhbWUgbGlzdCAgb2YgYm9va2luZ3NcclxuXHRpZiAoIHR5cGVvZiBhY3Rpb25fcGFyYW0uc2VhcmNoX3BhcmFtcyAhPT0gJ3VuZGVmaW5lZCcgKXtcclxuXHRcdGFjdGlvbl9wb3N0X3BhcmFtc1sgJ3NlYXJjaF9wYXJhbXMnIF0gPSBhY3Rpb25fcGFyYW0uc2VhcmNoX3BhcmFtcztcclxuXHRcdGRlbGV0ZSBhY3Rpb25fcG9zdF9wYXJhbXMuYWN0aW9uX3BhcmFtcy5zZWFyY2hfcGFyYW1zO1xyXG5cdH1cclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4ICxcclxuXHJcblx0XHRcdFx0YWN0aW9uX3Bvc3RfcGFyYW1zICxcclxuXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogUyB1IGMgYyBlIHMgc1xyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0ICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcdFx0LVx0aXRzIG9iamVjdCByZXR1cm5lZCBmcm9tICBBamF4IC0gY2xhc3MtbGl2ZS1zZWFyY2cucGhwXHJcblx0XHRcdFx0ICogQHBhcmFtIHRleHRTdGF0dXNcdFx0LVx0J3N1Y2Nlc3MnXHJcblx0XHRcdFx0ICogQHBhcmFtIGpxWEhSXHRcdFx0XHQtXHRPYmplY3RcclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRmdW5jdGlvbiAoIHJlc3BvbnNlX2RhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkge1xyXG5cclxuY29uc29sZS5sb2coICcgPT0gQWpheCBBY3Rpb25zIDo6IFJlc3BvbnNlIFdQQkNfQUpYX0JPT0tJTkdfQUNUSU9OUyA9PSAnLCByZXNwb25zZV9kYXRhICk7IGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblx0XHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdCBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA5LjYuMS41XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9vdGhlcl9wYXJhbSggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8ZGl2IGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2Ugbm90aWNlLXdhcm5pbmdcIiBzdHlsZT1cInRleHQtYWxpZ246bGVmdFwiPicgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICggJzEnID09IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdCcgXSApID8gJ3N1Y2Nlc3MnIDogJ2Vycm9yJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICggKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mKHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ2FmdGVyX2FjdGlvbl9yZXN1bHRfZGVsYXknIF0pIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ/IDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0OiByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICdhZnRlcl9hY3Rpb25fcmVzdWx0X2RlbGF5JyBdIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gU3VjY2VzcyByZXNwb25zZVxyXG5cdFx0XHRcdFx0aWYgKCAnMScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0JyBdICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgaXNfcmVsb2FkX2FqYXhfbGlzdGluZyA9IHRydWU7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBBZnRlciBHb29nbGUgQ2FsZW5kYXIgaW1wb3J0IHNob3cgaW1wb3J0ZWQgYm9va2luZ3MgYW5kIHJlbG9hZCB0aGUgcGFnZSBmb3IgdG9vbGJhciBwYXJhbWV0ZXJzIHVwZGF0ZVxyXG5cdFx0XHRcdFx0XHRpZiAoIGZhbHNlICE9PSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICduZXdfbGlzdGluZ19wYXJhbXMnIF0gKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICduZXdfbGlzdGluZ19wYXJhbXMnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19pc19zcGluKCkgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICduZXdfbGlzdGluZ19wYXJhbXMnIF1bICdyZWxvYWRfdXJsX3BhcmFtcycgXSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZG9jdW1lbnQubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ25ld19saXN0aW5nX3BhcmFtcycgXVsgJ3JlbG9hZF91cmxfcGFyYW1zJyBdO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkb2N1bWVudC5sb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAyMDAwICk7XHJcblx0XHRcdFx0XHRcdFx0aXNfcmVsb2FkX2FqYXhfbGlzdGluZyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBTdGFydCBkb3dubG9hZCBleHBvcnRlZCBDU1YgZmlsZVxyXG5cdFx0XHRcdFx0XHRpZiAoIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICdleHBvcnRfY3N2X3VybCcgXSApe1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2V4cG9ydF9jc3ZfdXJsX19kb3dubG9hZCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnZXhwb3J0X2Nzdl91cmwnIF0gKTtcclxuXHRcdFx0XHRcdFx0XHRpc19yZWxvYWRfYWpheF9saXN0aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmICggaXNfcmVsb2FkX2FqYXhfbGlzdGluZyApe1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93KCk7XHQvL1x0U2VuZGluZyBBamF4IFJlcXVlc3RcdC1cdHdpdGggcGFyYW1ldGVycyB0aGF0ICB3ZSBlYXJseSAgZGVmaW5lZCBpbiBcIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1wiIE9iai5cclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBSZW1vdmUgc3BpbiBpY29uIGZyb20gIGJ1dHRvbiBhbmQgRW5hYmxlIHRoaXMgYnV0dG9uLlxyXG5cdFx0XHRcdFx0d3BiY19idXR0b25fX3JlbW92ZV9zcGluKCByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdIClcclxuXHJcblx0XHRcdFx0XHQvLyBIaWRlIG1vZGFsc1xyXG5cdFx0XHRcdFx0d3BiY19wb3B1cF9tb2RhbHNfX2hpZGUoKTtcclxuXHJcblx0XHRcdFx0XHRqUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogOS42LjEuNVxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9IGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICk7XHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIEhpZGUgYWxsIG9wZW4gbW9kYWwgcG9wdXBzIHdpbmRvd3NcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfcG9wdXBfbW9kYWxzX19oaWRlKCl7XHJcblxyXG5cdC8vIEhpZGUgbW9kYWxzXHJcblx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKGpRdWVyeSggJy53cGJjX3BvcHVwX21vZGFsJyApLndwYmNfbXlfbW9kYWwpICl7XHJcblx0XHRqUXVlcnkoICcud3BiY19wb3B1cF9tb2RhbCcgKS53cGJjX215X21vZGFsKCAnaGlkZScgKTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBEYXRlcyAgU2hvcnQgPC0+IFdpZGUgICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3Nob3J0KCl7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfc21hbGwsLmJvb2tpbmdfZGF0ZXNfZnVsbCcgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfZnVsbCwuYm9va2luZ19kYXRlc19zbWFsbCcgKS5zaG93KCk7XHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7J3VpX3Vzcl9fZGF0ZXNfc2hvcnRfd2lkZSc6ICdzaG9ydCd9ICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3dpZGUoKXtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19mdWxsLC5ib29raW5nX2RhdGVzX3NtYWxsJyApLmhpZGUoKTtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19zbWFsbCwuYm9va2luZ19kYXRlc19mdWxsJyApLnNob3coKTtcclxuXHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsndWlfdXNyX19kYXRlc19zaG9ydF93aWRlJzogJ3dpZGUnfSApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9jbGlja19vbl9kYXRlc190b2dnbGUodGhpc19kYXRlKXtcclxuXHJcblx0alF1ZXJ5KCB0aGlzX2RhdGUgKS5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19zbWFsbCcgKS50b2dnbGUoKTtcclxuXHRqUXVlcnkoIHRoaXNfZGF0ZSApLnBhcmVudHMoICcud3BiY19jb2xfZGF0ZXMnICkuZmluZCggJy5ib29raW5nX2RhdGVzX2Z1bGwnICkudG9nZ2xlKCk7XHJcblxyXG5cdC8qXHJcblx0dmFyIHZpc2libGVfc2VjdGlvbiA9IGpRdWVyeSggdGhpc19kYXRlICkucGFyZW50cyggJy5ib29raW5nX2RhdGVzX2V4cGFuZF9zZWN0aW9uJyApO1xyXG5cdHZpc2libGVfc2VjdGlvbi5oaWRlKCk7XHJcblx0aWYgKCB2aXNpYmxlX3NlY3Rpb24uaGFzQ2xhc3MoICdib29raW5nX2RhdGVzX2Z1bGwnICkgKXtcclxuXHRcdHZpc2libGVfc2VjdGlvbi5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19zbWFsbCcgKS5zaG93KCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHZpc2libGVfc2VjdGlvbi5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19mdWxsJyApLnNob3coKTtcclxuXHR9Ki9cclxuXHRjb25zb2xlLmxvZyggJ3dwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3RvZ2dsZScsIHRoaXNfZGF0ZSApO1xyXG59XHJcblxyXG4vKipcclxuICogICBMb2NhbGUgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBcdFNlbGVjdCBvcHRpb25zIGluIHNlbGVjdCBib3hlcyBiYXNlZCBvbiBhdHRyaWJ1dGUgXCJ2YWx1ZV9vZl9zZWxlY3RlZF9vcHRpb25cIiBhbmQgUkVEIGNvbG9yIGFuZCBoaW50IGZvciBMT0NBTEUgYnV0dG9uICAgLS0gIEl0J3MgY2FsbGVkIGZyb20gXHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpICBcdGVhY2ggIHRpbWUgYWZ0ZXIgTGlzdGluZyBsb2FkaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUoKXtcclxuXHJcblx0alF1ZXJ5KCAnLndwYmNfbGlzdGluZ19jb250YWluZXIgc2VsZWN0JyApLmVhY2goIGZ1bmN0aW9uICggaW5kZXggKXtcclxuXHJcblx0XHR2YXIgc2VsZWN0aW9uID0galF1ZXJ5KCB0aGlzICkuYXR0ciggXCJ2YWx1ZV9vZl9zZWxlY3RlZF9vcHRpb25cIiApO1x0XHRcdC8vIERlZmluZSBzZWxlY3RlZCBzZWxlY3QgYm94ZXNcclxuXHJcblx0XHRpZiAoIHVuZGVmaW5lZCAhPT0gc2VsZWN0aW9uICl7XHJcblx0XHRcdGpRdWVyeSggdGhpcyApLmZpbmQoICdvcHRpb25bdmFsdWU9XCInICsgc2VsZWN0aW9uICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHJcblxyXG5cdFx0XHRpZiAoICgnJyAhPSBzZWxlY3Rpb24pICYmIChqUXVlcnkoIHRoaXMgKS5oYXNDbGFzcyggJ3NldF9ib29raW5nX2xvY2FsZV9zZWxlY3Rib3gnICkpICl7XHRcdFx0XHRcdFx0XHRcdC8vIExvY2FsZVxyXG5cclxuXHRcdFx0XHR2YXIgYm9va2luZ19sb2NhbGVfYnV0dG9uID0galF1ZXJ5KCB0aGlzICkucGFyZW50cyggJy51aV9lbGVtZW50X2xvY2FsZScgKS5maW5kKCAnLnNldF9ib29raW5nX2xvY2FsZV9idXR0b24nIClcclxuXHJcblx0XHRcdFx0Ly9ib29raW5nX2xvY2FsZV9idXR0b24uY3NzKCAnY29sb3InLCAnI2RiNDgwMCcgKTtcdFx0Ly8gU2V0IGJ1dHRvbiAgcmVkXHJcblx0XHRcdFx0Ym9va2luZ19sb2NhbGVfYnV0dG9uLmFkZENsYXNzKCAnd3BiY191aV9yZWQnICk7XHRcdC8vIFNldCBidXR0b24gIHJlZFxyXG5cdFx0XHRcdCBpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiggd3BiY190aXBweSApICl7XHJcblx0XHRcdFx0XHRib29raW5nX2xvY2FsZV9idXR0b24uZ2V0KDApLl90aXBweS5zZXRDb250ZW50KCBzZWxlY3Rpb24gKTtcclxuXHRcdFx0XHQgfVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogICBSZW1hcmsgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBEZWZpbmUgY29udGVudCBvZiByZW1hcmsgXCJib29raW5nIG5vdGVcIiBidXR0b24gYW5kIHRleHRhcmVhLiAgLS0gSXQncyBjYWxsZWQgZnJvbSBcdHdwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzKCkgIFx0ZWFjaCAgdGltZSBhZnRlciBMaXN0aW5nIGxvYWRpbmcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX3JlbWFyaygpe1xyXG5cclxuXHRqUXVlcnkoICcud3BiY19saXN0aW5nX2NvbnRhaW5lciAudWlfcmVtYXJrX3NlY3Rpb24gdGV4dGFyZWEnICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApe1xyXG5cdFx0dmFyIHRleHRfdmFsID0galF1ZXJ5KCB0aGlzICkudmFsKCk7XHJcblx0XHRpZiAoICh1bmRlZmluZWQgIT09IHRleHRfdmFsKSAmJiAoJycgIT0gdGV4dF92YWwpICl7XHJcblxyXG5cdFx0XHR2YXIgcmVtYXJrX2J1dHRvbiA9IGpRdWVyeSggdGhpcyApLnBhcmVudHMoICcudWlfZ3JvdXAnICkuZmluZCggJy5zZXRfYm9va2luZ19ub3RlX2J1dHRvbicgKTtcclxuXHJcblx0XHRcdGlmICggcmVtYXJrX2J1dHRvbi5sZW5ndGggPiAwICl7XHJcblxyXG5cdFx0XHRcdHJlbWFya19idXR0b24uYWRkQ2xhc3MoICd3cGJjX3VpX3JlZCcgKTtcdFx0Ly8gU2V0IGJ1dHRvbiAgcmVkXHJcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfdGlwcHkpICl7XHJcblx0XHRcdFx0XHQvL3JlbWFya19idXR0b24uZ2V0KCAwICkuX3RpcHB5LmFsbG93SFRNTCA9IHRydWU7XHJcblx0XHRcdFx0XHQvL3JlbWFya19idXR0b24uZ2V0KCAwICkuX3RpcHB5LnNldENvbnRlbnQoIHRleHRfdmFsLnJlcGxhY2UoL1tcXG5cXHJdL2csICc8YnI+JykgKTtcclxuXHJcblx0XHRcdFx0XHRyZW1hcmtfYnV0dG9uLmdldCggMCApLl90aXBweS5zZXRQcm9wcygge1xyXG5cdFx0XHRcdFx0XHRhbGxvd0hUTUw6IHRydWUsXHJcblx0XHRcdFx0XHRcdGNvbnRlbnQgIDogdGV4dF92YWwucmVwbGFjZSggL1tcXG5cXHJdL2csICc8YnI+JyApXHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogQWN0aW9ucyAsd2hlbiB3ZSBjbGljayBvbiBcIlJlbWFya1wiIGJ1dHRvbi5cclxuICpcclxuICogQHBhcmFtIGpxX2J1dHRvbiAgLVx0dGhpcyBqUXVlcnkgYnV0dG9uICBvYmplY3RcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19yZW1hcmsoIGpxX2J1dHRvbiApe1xyXG5cclxuXHRqcV9idXR0b24ucGFyZW50cygnLnVpX2dyb3VwJykuZmluZCgnLnVpX3JlbWFya19zZWN0aW9uJykudG9nZ2xlKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBDaGFuZ2UgYm9va2luZyByZXNvdXJjZSAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX2NoYW5nZV9yZXNvdXJjZSggYm9va2luZ19pZCwgcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gRGVmaW5lIElEIG9mIGJvb2tpbmcgdG8gaGlkZGVuIGlucHV0XHJcblx0alF1ZXJ5KCAnI2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBTZWxlY3QgYm9va2luZyByZXNvdXJjZSAgdGhhdCBiZWxvbmcgdG8gIGJvb2tpbmdcclxuXHRqUXVlcnkoICcjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3Jlc291cmNlX3NlbGVjdCcgKS52YWwoIHJlc291cmNlX2lkICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHR2YXIgY2JyO1xyXG5cclxuXHQvLyBHZXQgUmVzb3VyY2Ugc2VjdGlvblxyXG5cdGNiciA9IGpRdWVyeSggXCIjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25cIiApLmRldGFjaCgpO1xyXG5cclxuXHQvLyBBcHBlbmQgaXQgdG8gYm9va2luZyBST1dcclxuXHRjYnIuYXBwZW5kVG8oIGpRdWVyeSggXCIjdWlfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkgKTtcclxuXHRjYnIgPSBudWxsO1xyXG5cclxuXHQvLyBIaWRlIHNlY3Rpb25zIG9mIFwiQ2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VcIiBpbiBhbGwgb3RoZXIgYm9va2luZ3MgUk9Xc1xyXG5cdC8valF1ZXJ5KCBcIi51aV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ1wiICkuaGlkZSgpO1xyXG5cdGlmICggISBqUXVlcnkoIFwiI3VpX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApLmlzKCc6dmlzaWJsZScpICl7XHJcblx0XHRqUXVlcnkoIFwiLnVpX191bmRlcl9hY3Rpb25zX3Jvd19fc2VjdGlvbl9pbl9ib29raW5nXCIgKS5oaWRlKCk7XHJcblx0fVxyXG5cclxuXHQvLyBTaG93IG9ubHkgXCJjaGFuZ2UgYm9va2luZyByZXNvdXJjZVwiIHNlY3Rpb24gIGZvciBjdXJyZW50IGJvb2tpbmdcclxuXHRqUXVlcnkoIFwiI3VpX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApLnRvZ2dsZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19jaGFuZ2VfcmVzb3VyY2UoIHRoaXNfZWwsIGJvb2tpbmdfYWN0aW9uLCBlbF9pZCApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiBib29raW5nX2FjdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBqUXVlcnkoICcjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0ZWRfcmVzb3VyY2VfaWQnIDogalF1ZXJ5KCAnI2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19yZXNvdXJjZV9zZWxlY3QnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogZWxfaWRcclxuXHR9ICk7XHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxuXHJcblx0Ly8gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX2NoYW5nZV9yZXNvdXJjZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fY2hhbmdlX3Jlc291cmNlKCl7XHJcblxyXG5cdHZhciBjYnJjZTtcclxuXHJcblx0Ly8gR2V0IFJlc291cmNlIHNlY3Rpb25cclxuXHRjYnJjZSA9IGpRdWVyeShcIiNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvblwiKS5kZXRhY2goKTtcclxuXHJcblx0Ly8gQXBwZW5kIGl0IHRvIGhpZGRlbiBIVE1MIHRlbXBsYXRlIHNlY3Rpb24gIGF0ICB0aGUgYm90dG9tICBvZiB0aGUgcGFnZVxyXG5cdGNicmNlLmFwcGVuZFRvKGpRdWVyeShcIiN3cGJjX2hpZGRlbl90ZW1wbGF0ZV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VcIikpO1xyXG5cdGNicmNlID0gbnVsbDtcclxuXHJcblx0Ly8gSGlkZSBhbGwgY2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VzIHNlY3Rpb25zXHJcblx0alF1ZXJ5KFwiLnVpX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nXCIpLmhpZGUoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqICAgRHVwbGljYXRlIGJvb2tpbmcgaW4gb3RoZXIgcmVzb3VyY2UgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zaG93X19kdXBsaWNhdGVfYm9va2luZyggYm9va2luZ19pZCwgcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gRGVmaW5lIElEIG9mIGJvb2tpbmcgdG8gaGlkZGVuIGlucHV0XHJcblx0alF1ZXJ5KCAnI2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19ib29raW5nX2lkJyApLnZhbCggYm9va2luZ19pZCApO1xyXG5cclxuXHQvLyBTZWxlY3QgYm9va2luZyByZXNvdXJjZSAgdGhhdCBiZWxvbmcgdG8gIGJvb2tpbmdcclxuXHRqUXVlcnkoICcjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3Jlc291cmNlX3NlbGVjdCcgKS52YWwoIHJlc291cmNlX2lkICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHR2YXIgY2JyO1xyXG5cclxuXHQvLyBHZXQgUmVzb3VyY2Ugc2VjdGlvblxyXG5cdGNiciA9IGpRdWVyeSggXCIjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb25cIiApLmRldGFjaCgpO1xyXG5cclxuXHQvLyBBcHBlbmQgaXQgdG8gYm9va2luZyBST1dcclxuXHRjYnIuYXBwZW5kVG8oIGpRdWVyeSggXCIjdWlfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkgKTtcclxuXHRjYnIgPSBudWxsO1xyXG5cclxuXHQvLyBIaWRlIHNlY3Rpb25zIG9mIFwiRHVwbGljYXRlIGJvb2tpbmdcIiBpbiBhbGwgb3RoZXIgYm9va2luZ3MgUk9Xc1xyXG5cdGlmICggISBqUXVlcnkoIFwiI3VpX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApLmlzKCc6dmlzaWJsZScpICl7XHJcblx0XHRqUXVlcnkoIFwiLnVpX191bmRlcl9hY3Rpb25zX3Jvd19fc2VjdGlvbl9pbl9ib29raW5nXCIgKS5oaWRlKCk7XHJcblx0fVxyXG5cclxuXHQvLyBTaG93IG9ubHkgXCJEdXBsaWNhdGUgYm9va2luZ1wiIHNlY3Rpb24gIGZvciBjdXJyZW50IGJvb2tpbmcgUk9XXHJcblx0alF1ZXJ5KCBcIiN1aV9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKS50b2dnbGUoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fZHVwbGljYXRlX2Jvb2tpbmcoIHRoaXNfZWwsIGJvb2tpbmdfYWN0aW9uLCBlbF9pZCApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiBib29raW5nX2FjdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBqUXVlcnkoICcjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0ZWRfcmVzb3VyY2VfaWQnIDogalF1ZXJ5KCAnI2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19yZXNvdXJjZV9zZWxlY3QnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogZWxfaWRcclxuXHR9ICk7XHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxuXHJcblx0Ly8gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX2NoYW5nZV9yZXNvdXJjZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fZHVwbGljYXRlX2Jvb2tpbmcoKXtcclxuXHJcblx0dmFyIGNicmNlO1xyXG5cclxuXHQvLyBHZXQgUmVzb3VyY2Ugc2VjdGlvblxyXG5cdGNicmNlID0galF1ZXJ5KFwiI2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uXCIpLmRldGFjaCgpO1xyXG5cclxuXHQvLyBBcHBlbmQgaXQgdG8gaGlkZGVuIEhUTUwgdGVtcGxhdGUgc2VjdGlvbiAgYXQgIHRoZSBib3R0b20gIG9mIHRoZSBwYWdlXHJcblx0Y2JyY2UuYXBwZW5kVG8oalF1ZXJ5KFwiI3dwYmNfaGlkZGVuX3RlbXBsYXRlX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZVwiKSk7XHJcblx0Y2JyY2UgPSBudWxsO1xyXG5cclxuXHQvLyBIaWRlIGFsbCBjaGFuZ2UgYm9va2luZyByZXNvdXJjZXMgc2VjdGlvbnNcclxuXHRqUXVlcnkoXCIudWlfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdcIikuaGlkZSgpO1xyXG59XHJcblxyXG4vKipcclxuICogICBDaGFuZ2UgcGF5bWVudCBzdGF0dXMgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX3NldF9wYXltZW50X3N0YXR1cyggYm9va2luZ19pZCApe1xyXG5cclxuXHR2YXIgalNlbGVjdCA9IGpRdWVyeSggJyN1aV9fc2V0X3BheW1lbnRfc3RhdHVzX19zZWN0aW9uX2luX2Jvb2tpbmdfJyArIGJvb2tpbmdfaWQgKS5maW5kKCAnc2VsZWN0JyApXHJcblxyXG5cdHZhciBzZWxlY3RlZF9wYXlfc3RhdHVzID0galNlbGVjdC5hdHRyKCBcImFqeC1zZWxlY3RlZC12YWx1ZVwiICk7XHJcblxyXG5cdC8vIElzIGl0IGZsb2F0IC0gdGhlbiAgaXQncyB1bmtub3duXHJcblx0aWYgKCAhaXNOYU4oIHBhcnNlRmxvYXQoIHNlbGVjdGVkX3BheV9zdGF0dXMgKSApICl7XHJcblx0XHRqU2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCIxXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcdFx0XHRcdFx0XHRcdFx0Ly8gVW5rbm93biAgdmFsdWUgaXMgJzEnIGluIHNlbGVjdCBib3hcclxuXHR9IGVsc2Uge1xyXG5cdFx0alNlbGVjdC5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiJyArIHNlbGVjdGVkX3BheV9zdGF0dXMgKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcdFx0Ly8gT3RoZXJ3aXNlIGtub3duIHBheW1lbnQgc3RhdHVzXHJcblx0fVxyXG5cclxuXHQvLyBIaWRlIHNlY3Rpb25zIG9mIFwiQ2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VcIiBpbiBhbGwgb3RoZXIgYm9va2luZ3MgUk9Xc1xyXG5cdGlmICggISBqUXVlcnkoIFwiI3VpX19zZXRfcGF5bWVudF9zdGF0dXNfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKS5pcygnOnZpc2libGUnKSApe1xyXG5cdFx0alF1ZXJ5KCBcIi51aV9fdW5kZXJfYWN0aW9uc19yb3dfX3NlY3Rpb25faW5fYm9va2luZ1wiICkuaGlkZSgpO1xyXG5cdH1cclxuXHJcblx0Ly8gU2hvdyBvbmx5IFwiY2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VcIiBzZWN0aW9uICBmb3IgY3VycmVudCBib29raW5nXHJcblx0alF1ZXJ5KCBcIiN1aV9fc2V0X3BheW1lbnRfc3RhdHVzX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkudG9nZ2xlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9wYXltZW50X3N0YXR1cyggYm9va2luZ19pZCwgdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGJvb2tpbmdfaWQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0ZWRfcGF5bWVudF9zdGF0dXMnIDogalF1ZXJ5KCAnI3VpX2J0bl9zZXRfcGF5bWVudF9zdGF0dXMnICsgYm9va2luZ19pZCApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6IGVsX2lkICsgJ19zYXZlJ1xyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHRqUXVlcnkoICcjJyArIGVsX2lkICsgJ19jYW5jZWwnKS5oaWRlKCk7XHJcblx0Ly93cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCBqUXVlcnkoICcjJyArIGVsX2lkICsgJ19jYW5jZWwnKS5nZXQoMCkgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19zZXRfcGF5bWVudF9zdGF0dXMoKXtcclxuXHQvLyBIaWRlIGFsbCBjaGFuZ2UgIHBheW1lbnQgc3RhdHVzIGZvciBib29raW5nXHJcblx0alF1ZXJ5KFwiLnVpX19zZXRfcGF5bWVudF9zdGF0dXNfX3NlY3Rpb25faW5fYm9va2luZ1wiKS5oaWRlKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBDaGFuZ2UgYm9va2luZyBjb3N0ICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9ib29raW5nX2Nvc3QoIGJvb2tpbmdfaWQsIHRoaXNfZWwsIGJvb2tpbmdfYWN0aW9uLCBlbF9pZCApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiBib29raW5nX2FjdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBib29raW5nX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfY29zdCcgXHRcdCAgIDogalF1ZXJ5KCAnI3VpX2J0bl9zZXRfYm9va2luZ19jb3N0JyArIGJvb2tpbmdfaWQgKyAnX2Nvc3QnKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZCArICdfc2F2ZSdcclxuXHR9ICk7XHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxuXHJcblx0alF1ZXJ5KCAnIycgKyBlbF9pZCArICdfY2FuY2VsJykuaGlkZSgpO1xyXG5cdC8vd3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggalF1ZXJ5KCAnIycgKyBlbF9pZCArICdfY2FuY2VsJykuZ2V0KDApICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fc2V0X2Jvb2tpbmdfY29zdCgpe1xyXG5cdC8vIEhpZGUgYWxsIGNoYW5nZSAgcGF5bWVudCBzdGF0dXMgZm9yIGJvb2tpbmdcclxuXHRqUXVlcnkoXCIudWlfX3NldF9ib29raW5nX2Nvc3RfX3NlY3Rpb25faW5fYm9va2luZ1wiKS5oaWRlKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTZW5kIFBheW1lbnQgcmVxdWVzdCAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fc2VuZF9wYXltZW50X3JlcXVlc3QoKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogJ3NlbmRfcGF5bWVudF9yZXF1ZXN0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9yZXF1ZXN0X19ib29raW5nX2lkJykudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVhc29uX29mX2FjdGlvbicgXHQgICA6IGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3JlcXVlc3RfX3JlYXNvbl9vZl9hY3Rpb24nKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnd3BiY19tb2RhbF9fcGF5bWVudF9yZXF1ZXN0X19idXR0b25fc2VuZCdcclxuXHR9ICk7XHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfcmVxdWVzdF9fYnV0dG9uX3NlbmQnICkuZ2V0KCAwICkgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEltcG9ydCBHb29nbGUgQ2FsZW5kYXIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXIoKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogJ2ltcG9ydF9nb29nbGVfY2FsZW5kYXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6ICd3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19idXR0b25fc2VuZCdcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX2Zyb20nIDogXHRcdFx0XHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c19mcm9tIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX2Zyb21fb2Zmc2V0JyA6IFx0XHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c19mcm9tX29mZnNldCcgKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19mcm9tX29mZnNldF90eXBlJyA6IFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbV9vZmZzZXRfdHlwZSBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWwnIDogXHRcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWwgb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0JyA6IFx0XHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c191bnRpbF9vZmZzZXQnICkudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0X3R5cGUnIDogalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0X3R5cGUgb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX21heCcgOiBcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX21heCcgKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX3Jlc291cmNlJyA6IFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI3dwYmNfYm9va2luZ19yZXNvdXJjZSBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cdH0gKTtcclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCBqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fYnV0dG9uX3NlbmQnICkuZ2V0KCAwICkgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEV4cG9ydCBib29raW5ncyB0byBDU1YgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fZXhwb3J0X2NzdiggcGFyYW1zICl7XHJcblxyXG5cdHZhciBzZWxlY3RlZF9ib29raW5nX2lkX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpO1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgIDogcGFyYW1zWyAnYm9va2luZ19hY3Rpb24nIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJyA6IHBhcmFtc1sgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZXhwb3J0X3R5cGUnICAgICAgICAgICA6IHBhcmFtc1sgJ2V4cG9ydF90eXBlJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Nzdl9leHBvcnRfc2VwYXJhdG9yJyAgOiBwYXJhbXNbICdjc3ZfZXhwb3J0X3NlcGFyYXRvcicgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3ZfZXhwb3J0X3NraXBfZmllbGRzJzogcGFyYW1zWyAnY3N2X2V4cG9ydF9za2lwX2ZpZWxkcycgXSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCdcdDogc2VsZWN0ZWRfYm9va2luZ19pZF9hcnIuam9pbignLCcpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXJjaF9wYXJhbXMnIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHR2YXIgdGhpc19lbCA9IGpRdWVyeSggJyMnICsgcGFyYW1zWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdICkuZ2V0KCAwIClcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG59XHJcblxyXG4vKipcclxuICogT3BlbiBVUkwgaW4gbmV3IHRhYiAtIG1haW5seSAgaXQncyB1c2VkIGZvciBvcGVuIENTViBsaW5rICBmb3IgZG93bmxvYWRlZCBleHBvcnRlZCBib29raW5ncyBhcyBDU1ZcclxuICpcclxuICogQHBhcmFtIGV4cG9ydF9jc3ZfdXJsXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19leHBvcnRfY3N2X3VybF9fZG93bmxvYWQoIGV4cG9ydF9jc3ZfdXJsICl7XHJcblxyXG5cdC8vdmFyIHNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyID0gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCk7XHJcblxyXG5cdGRvY3VtZW50LmxvY2F0aW9uLmhyZWYgPSBleHBvcnRfY3N2X3VybDsvLyArICcmc2VsZWN0ZWRfaWQ9JyArIHNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyLmpvaW4oJywnKTtcclxuXHJcblx0Ly8gSXQncyBvcGVuIGFkZGl0aW9uYWwgZGlhbG9nIGZvciBhc2tpbmcgb3BlbmluZyB1bHIgaW4gbmV3IHRhYlxyXG5cdC8vIHdpbmRvdy5vcGVuKCBleHBvcnRfY3N2X3VybCwgJ19ibGFuaycpLmZvY3VzKCk7XHJcbn0iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBRVo7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUpBLFNBQUFBLFFBQUFDLEdBQUEsc0NBQUFELE9BQUEsd0JBQUFFLE1BQUEsdUJBQUFBLE1BQUEsQ0FBQUMsUUFBQSxhQUFBRixHQUFBLGtCQUFBQSxHQUFBLGdCQUFBQSxHQUFBLFdBQUFBLEdBQUEseUJBQUFDLE1BQUEsSUFBQUQsR0FBQSxDQUFBRyxXQUFBLEtBQUFGLE1BQUEsSUFBQUQsR0FBQSxLQUFBQyxNQUFBLENBQUFHLFNBQUEscUJBQUFKLEdBQUEsS0FBQUQsT0FBQSxDQUFBQyxHQUFBO0FBS0EsU0FBU0ssb0NBQW9DQSxDQUFBLEVBQXFCO0VBQUEsSUFBbkJDLFlBQVksR0FBQUMsU0FBQSxDQUFBQyxNQUFBLFFBQUFELFNBQUEsUUFBQUUsU0FBQSxHQUFBRixTQUFBLE1BQUcs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
