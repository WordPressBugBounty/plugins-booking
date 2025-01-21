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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19hY3Rpb25zLmpzIiwibmFtZXMiOlsiX3R5cGVvZiIsIm9iaiIsIlN5bWJvbCIsIml0ZXJhdG9yIiwiY29uc3RydWN0b3IiLCJwcm90b3R5cGUiLCJ3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QiLCJhY3Rpb25fcGFyYW0iLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJjb25zb2xlIiwiZ3JvdXBDb2xsYXBzZWQiLCJsb2ciLCJ3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0IiwiQXJyYXkiLCJpc0FycmF5Iiwid3BiY19nZXRfc2VsZWN0ZWRfbG9jYWxlIiwid3BiY19hanhfYm9va2luZ19saXN0aW5nIiwiZ2V0X3NlY3VyZV9wYXJhbSIsImFjdGlvbl9wb3N0X3BhcmFtcyIsImFjdGlvbiIsIm5vbmNlIiwid3BiY19hanhfdXNlcl9pZCIsIndwYmNfYWp4X2xvY2FsZSIsImFjdGlvbl9wYXJhbXMiLCJzZWFyY2hfcGFyYW1zIiwialF1ZXJ5IiwicG9zdCIsIndwYmNfdXJsX2FqYXgiLCJyZXNwb25zZV9kYXRhIiwidGV4dFN0YXR1cyIsImpxWEhSIiwiZ3JvdXBFbmQiLCJoaWRlIiwiZ2V0X290aGVyX3BhcmFtIiwiaHRtbCIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsInJlcGxhY2UiLCJpc19yZWxvYWRfYWpheF9saXN0aW5nIiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwiY2xvc2VkX3RpbWVyIiwic2V0VGltZW91dCIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX2lzX3NwaW4iLCJkb2N1bWVudCIsImxvY2F0aW9uIiwiaHJlZiIsInJlbG9hZCIsIndwYmNfYWp4X2Jvb2tpbmdfX2V4cG9ydF9jc3ZfdXJsX19kb3dubG9hZCIsIndwYmNfYWp4X2Jvb2tpbmdfX2FjdHVhbF9saXN0aW5nX19zaG93Iiwid3BiY19idXR0b25fX3JlbW92ZV9zcGluIiwid3BiY19wb3B1cF9tb2RhbHNfX2hpZGUiLCJmYWlsIiwiZXJyb3JUaHJvd24iLCJ3aW5kb3ciLCJlcnJvcl9tZXNzYWdlIiwicmVzcG9uc2VUZXh0Iiwid3BiY19hanhfYm9va2luZ19zaG93X21lc3NhZ2UiLCJ3cGJjX215X21vZGFsIiwid3BiY19hanhfY2xpY2tfb25fZGF0ZXNfc2hvcnQiLCJzaG93Iiwid3BiY19hanhfY2xpY2tfb25fZGF0ZXNfd2lkZSIsIndwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3RvZ2dsZSIsInRoaXNfZGF0ZSIsInBhcmVudHMiLCJmaW5kIiwidG9nZ2xlIiwid3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUiLCJlYWNoIiwiaW5kZXgiLCJzZWxlY3Rpb24iLCJhdHRyIiwicHJvcCIsImhhc0NsYXNzIiwiYm9va2luZ19sb2NhbGVfYnV0dG9uIiwiYWRkQ2xhc3MiLCJ3cGJjX3RpcHB5IiwiZ2V0IiwiX3RpcHB5Iiwic2V0Q29udGVudCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fcmVtYXJrIiwidGV4dF92YWwiLCJ2YWwiLCJyZW1hcmtfYnV0dG9uIiwic2V0UHJvcHMiLCJhbGxvd0hUTUwiLCJjb250ZW50Iiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX3JlbWFyayIsImpxX2J1dHRvbiIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX2NoYW5nZV9yZXNvdXJjZSIsImJvb2tpbmdfaWQiLCJyZXNvdXJjZV9pZCIsInRyaWdnZXIiLCJjYnIiLCJkZXRhY2giLCJhcHBlbmRUbyIsImlzIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fY2hhbmdlX3Jlc291cmNlIiwidGhpc19lbCIsImJvb2tpbmdfYWN0aW9uIiwiZWxfaWQiLCJ3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX2NoYW5nZV9yZXNvdXJjZSIsImNicmNlIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fZHVwbGljYXRlX2Jvb2tpbmciLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19kdXBsaWNhdGVfYm9va2luZyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19kdXBsaWNhdGVfYm9va2luZyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX3NldF9wYXltZW50X3N0YXR1cyIsImpTZWxlY3QiLCJzZWxlY3RlZF9wYXlfc3RhdHVzIiwiaXNOYU4iLCJwYXJzZUZsb2F0Iiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fc2V0X3BheW1lbnRfc3RhdHVzIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX3NldF9wYXltZW50X3N0YXR1cyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9ib29raW5nX2Nvc3QiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fc2V0X2Jvb2tpbmdfY29zdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19zZW5kX3BheW1lbnRfcmVxdWVzdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2V4cG9ydF9jc3YiLCJwYXJhbXMiLCJzZWxlY3RlZF9ib29raW5nX2lkX2FyciIsIndwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCIsImpvaW4iLCJzZWFyY2hfZ2V0X2FsbF9wYXJhbXMiLCJleHBvcnRfY3N2X3VybCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtYm9va2luZ3MvX3NyYy9ib29raW5nc19fYWN0aW9ucy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiAgIEFqYXggICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG4vL3ZhciBpc190aGlzX2FjdGlvbiA9IGZhbHNlO1xyXG4vKipcclxuICogU2VuZCBBamF4IGFjdGlvbiByZXF1ZXN0LCAgbGlrZSBhcHByb3Zpbmcgb3IgY2FuY2VsbGF0aW9uXHJcbiAqXHJcbiAqIEBwYXJhbSBhY3Rpb25fcGFyYW1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCggYWN0aW9uX3BhcmFtID0ge30gKXtcclxuXHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9CT09LSU5HX0FDVElPTlMnICk7IGNvbnNvbGUubG9nKCAnID09IEFqYXggQWN0aW9ucyA6OiBQYXJhbXMgPT0gJywgYWN0aW9uX3BhcmFtICk7XHJcbi8vaXNfdGhpc19hY3Rpb24gPSB0cnVlO1xyXG5cclxuXHR3cGJjX2Jvb2tpbmdfbGlzdGluZ19yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG5cdC8vIEdldCByZWRlZmluZWQgTG9jYWxlLCAgaWYgYWN0aW9uIG9uIHNpbmdsZSBib29raW5nICFcclxuXHRpZiAoICAoIHVuZGVmaW5lZCAhPSBhY3Rpb25fcGFyYW1bICdib29raW5nX2lkJyBdICkgJiYgKCAhIEFycmF5LmlzQXJyYXkoIGFjdGlvbl9wYXJhbVsgJ2Jvb2tpbmdfaWQnIF0gKSApICl7XHRcdFx0XHQvLyBOb3QgYXJyYXlcclxuXHJcblx0XHRhY3Rpb25fcGFyYW1bICdsb2NhbGUnIF0gPSB3cGJjX2dldF9zZWxlY3RlZF9sb2NhbGUoIGFjdGlvbl9wYXJhbVsgJ2Jvb2tpbmdfaWQnIF0sIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApICk7XHJcblx0fVxyXG5cclxuXHR2YXIgYWN0aW9uX3Bvc3RfcGFyYW1zID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0JPT0tJTkdfQUNUSU9OUycsXHJcblx0XHRcdFx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogKCAoIHVuZGVmaW5lZCA9PSBhY3Rpb25fcGFyYW1bICd1c2VyX2lkJyBdICkgPyB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICkgOiBhY3Rpb25fcGFyYW1bICd1c2VyX2lkJyBdICksXHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGU6ICAoICggdW5kZWZpbmVkID09IGFjdGlvbl9wYXJhbVsgJ2xvY2FsZScgXSApICA/IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApICA6IGFjdGlvbl9wYXJhbVsgJ2xvY2FsZScgXSApLFxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdGFjdGlvbl9wYXJhbXNcdDogYWN0aW9uX3BhcmFtXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0Ly8gSXQncyByZXF1aXJlZCBmb3IgQ1NWIGV4cG9ydCAtIGdldHRpbmcgdGhlIHNhbWUgbGlzdCAgb2YgYm9va2luZ3NcclxuXHRpZiAoIHR5cGVvZiBhY3Rpb25fcGFyYW0uc2VhcmNoX3BhcmFtcyAhPT0gJ3VuZGVmaW5lZCcgKXtcclxuXHRcdGFjdGlvbl9wb3N0X3BhcmFtc1sgJ3NlYXJjaF9wYXJhbXMnIF0gPSBhY3Rpb25fcGFyYW0uc2VhcmNoX3BhcmFtcztcclxuXHRcdGRlbGV0ZSBhY3Rpb25fcG9zdF9wYXJhbXMuYWN0aW9uX3BhcmFtcy5zZWFyY2hfcGFyYW1zO1xyXG5cdH1cclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4ICxcclxuXHJcblx0XHRcdFx0YWN0aW9uX3Bvc3RfcGFyYW1zICxcclxuXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogUyB1IGMgYyBlIHMgc1xyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0ICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcdFx0LVx0aXRzIG9iamVjdCByZXR1cm5lZCBmcm9tICBBamF4IC0gY2xhc3MtbGl2ZS1zZWFyY2cucGhwXHJcblx0XHRcdFx0ICogQHBhcmFtIHRleHRTdGF0dXNcdFx0LVx0J3N1Y2Nlc3MnXHJcblx0XHRcdFx0ICogQHBhcmFtIGpxWEhSXHRcdFx0XHQtXHRPYmplY3RcclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRmdW5jdGlvbiAoIHJlc3BvbnNlX2RhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkge1xyXG5cclxuY29uc29sZS5sb2coICcgPT0gQWpheCBBY3Rpb25zIDo6IFJlc3BvbnNlIFdQQkNfQUpYX0JPT0tJTkdfQUNUSU9OUyA9PSAnLCByZXNwb25zZV9kYXRhICk7IGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblx0XHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfYWp4X3VuZGVyX3Rvb2xiYXJfcm93JyApLmhpZGUoKTtcdCBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCB3cGJjX2FqeF9ib29raW5nX2xpc3RpbmcuZ2V0X290aGVyX3BhcmFtKCAnbGlzdGluZ19jb250YWluZXInICkgKS5odG1sKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzxkaXYgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSBub3RpY2Utd2FybmluZ1wiIHN0eWxlPVwidGV4dC1hbGlnbjpsZWZ0XCI+JyArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlc3BvbnNlX2RhdGEgK1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0JzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgKCAnMScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0JyBdICkgPyAnc3VjY2VzcycgOiAnZXJyb3InXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgKCAoICd1bmRlZmluZWQnID09PSB0eXBlb2YocmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9kZWxheScgXSkgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdD8gMTAwMDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ6IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ2FmdGVyX2FjdGlvbl9yZXN1bHRfZGVsYXknIF0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0XHQvLyBTdWNjZXNzIHJlc3BvbnNlXHJcblx0XHRcdFx0XHRpZiAoICcxJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHQnIF0gKXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBpc19yZWxvYWRfYWpheF9saXN0aW5nID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIEFmdGVyIEdvb2dsZSBDYWxlbmRhciBpbXBvcnQgc2hvdyBpbXBvcnRlZCBib29raW5ncyBhbmQgcmVsb2FkIHRoZSBwYWdlIGZvciB0b29sYmFyIHBhcmFtZXRlcnMgdXBkYXRlXHJcblx0XHRcdFx0XHRcdGlmICggZmFsc2UgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ25ld19saXN0aW5nX3BhcmFtcycgXSApe1xyXG5cclxuXHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ25ld19saXN0aW5nX3BhcmFtcycgXSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoIHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmICggdW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ25ld19saXN0aW5nX3BhcmFtcycgXVsgJ3JlbG9hZF91cmxfcGFyYW1zJyBdICl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkb2N1bWVudC5sb2NhdGlvbi5ocmVmID0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnbmV3X2xpc3RpbmdfcGFyYW1zJyBdWyAncmVsb2FkX3VybF9wYXJhbXMnIF07XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRvY3VtZW50LmxvY2F0aW9uLnJlbG9hZCgpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIDIwMDAgKTtcclxuXHRcdFx0XHRcdFx0XHRpc19yZWxvYWRfYWpheF9saXN0aW5nID0gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIFN0YXJ0IGRvd25sb2FkIGV4cG9ydGVkIENTViBmaWxlXHJcblx0XHRcdFx0XHRcdGlmICggdW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ2V4cG9ydF9jc3ZfdXJsJyBdICl7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19fZXhwb3J0X2Nzdl91cmxfX2Rvd25sb2FkKCByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICdleHBvcnRfY3N2X3VybCcgXSApO1xyXG5cdFx0XHRcdFx0XHRcdGlzX3JlbG9hZF9hamF4X2xpc3RpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCBpc19yZWxvYWRfYWpheF9saXN0aW5nICl7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3coKTtcdC8vXHRTZW5kaW5nIEFqYXggUmVxdWVzdFx0LVx0d2l0aCBwYXJhbWV0ZXJzIHRoYXQgIHdlIGVhcmx5ICBkZWZpbmVkIGluIFwid3BiY19hanhfYm9va2luZ19saXN0aW5nXCIgT2JqLlxyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFJlbW92ZSBzcGluIGljb24gZnJvbSAgYnV0dG9uIGFuZCBFbmFibGUgdGhpcyBidXR0b24uXHJcblx0XHRcdFx0XHR3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oIHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0gKVxyXG5cclxuXHRcdFx0XHRcdC8vIEhpZGUgbW9kYWxzXHJcblx0XHRcdFx0XHR3cGJjX3BvcHVwX21vZGFsc19faGlkZSgpO1xyXG5cclxuXHRcdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS42LjEuNS5cclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5yZXNwb25zZVRleHQgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSBqcVhIUi5yZXNwb25zZVRleHQ7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSggZXJyb3JfbWVzc2FnZSApO1xyXG5cdFx0XHQgIH0pXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG59XHJcblxyXG5cclxuXHJcbi8qKlxyXG4gKiBIaWRlIGFsbCBvcGVuIG1vZGFsIHBvcHVwcyB3aW5kb3dzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3BvcHVwX21vZGFsc19faGlkZSgpe1xyXG5cclxuXHQvLyBIaWRlIG1vZGFsc1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIChqUXVlcnkoICcud3BiY19wb3B1cF9tb2RhbCcgKS53cGJjX215X21vZGFsKSApe1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfcG9wdXBfbW9kYWwnICkud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgRGF0ZXMgIFNob3J0IDwtPiBXaWRlICAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9jbGlja19vbl9kYXRlc19zaG9ydCgpe1xyXG5cdGpRdWVyeSggJyNib29raW5nX2RhdGVzX3NtYWxsLC5ib29raW5nX2RhdGVzX2Z1bGwnICkuaGlkZSgpO1xyXG5cdGpRdWVyeSggJyNib29raW5nX2RhdGVzX2Z1bGwsLmJvb2tpbmdfZGF0ZXNfc21hbGwnICkuc2hvdygpO1xyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggeyd1aV91c3JfX2RhdGVzX3Nob3J0X3dpZGUnOiAnc2hvcnQnfSApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9jbGlja19vbl9kYXRlc193aWRlKCl7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfZnVsbCwuYm9va2luZ19kYXRlc19zbWFsbCcgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfc21hbGwsLmJvb2tpbmdfZGF0ZXNfZnVsbCcgKS5zaG93KCk7XHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7J3VpX3Vzcl9fZGF0ZXNfc2hvcnRfd2lkZSc6ICd3aWRlJ30gKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfY2xpY2tfb25fZGF0ZXNfdG9nZ2xlKHRoaXNfZGF0ZSl7XHJcblxyXG5cdGpRdWVyeSggdGhpc19kYXRlICkucGFyZW50cyggJy53cGJjX2NvbF9kYXRlcycgKS5maW5kKCAnLmJvb2tpbmdfZGF0ZXNfc21hbGwnICkudG9nZ2xlKCk7XHJcblx0alF1ZXJ5KCB0aGlzX2RhdGUgKS5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19mdWxsJyApLnRvZ2dsZSgpO1xyXG5cclxuXHQvKlxyXG5cdHZhciB2aXNpYmxlX3NlY3Rpb24gPSBqUXVlcnkoIHRoaXNfZGF0ZSApLnBhcmVudHMoICcuYm9va2luZ19kYXRlc19leHBhbmRfc2VjdGlvbicgKTtcclxuXHR2aXNpYmxlX3NlY3Rpb24uaGlkZSgpO1xyXG5cdGlmICggdmlzaWJsZV9zZWN0aW9uLmhhc0NsYXNzKCAnYm9va2luZ19kYXRlc19mdWxsJyApICl7XHJcblx0XHR2aXNpYmxlX3NlY3Rpb24ucGFyZW50cyggJy53cGJjX2NvbF9kYXRlcycgKS5maW5kKCAnLmJvb2tpbmdfZGF0ZXNfc21hbGwnICkuc2hvdygpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR2aXNpYmxlX3NlY3Rpb24ucGFyZW50cyggJy53cGJjX2NvbF9kYXRlcycgKS5maW5kKCAnLmJvb2tpbmdfZGF0ZXNfZnVsbCcgKS5zaG93KCk7XHJcblx0fSovXHJcblx0Y29uc29sZS5sb2coICd3cGJjX2FqeF9jbGlja19vbl9kYXRlc190b2dnbGUnLCB0aGlzX2RhdGUgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqICAgTG9jYWxlICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogXHRTZWxlY3Qgb3B0aW9ucyBpbiBzZWxlY3QgYm94ZXMgYmFzZWQgb24gYXR0cmlidXRlIFwidmFsdWVfb2Zfc2VsZWN0ZWRfb3B0aW9uXCIgYW5kIFJFRCBjb2xvciBhbmQgaGludCBmb3IgTE9DQUxFIGJ1dHRvbiAgIC0tICBJdCdzIGNhbGxlZCBmcm9tIFx0d3BiY19hanhfYm9va2luZ19kZWZpbmVfdWlfaG9va3MoKSAgXHRlYWNoICB0aW1lIGFmdGVyIExpc3RpbmcgbG9hZGluZy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2RlZmluZV9fbG9jYWxlKCl7XHJcblxyXG5cdGpRdWVyeSggJy53cGJjX2xpc3RpbmdfY29udGFpbmVyIHNlbGVjdCcgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblxyXG5cdFx0dmFyIHNlbGVjdGlvbiA9IGpRdWVyeSggdGhpcyApLmF0dHIoIFwidmFsdWVfb2Zfc2VsZWN0ZWRfb3B0aW9uXCIgKTtcdFx0XHQvLyBEZWZpbmUgc2VsZWN0ZWQgc2VsZWN0IGJveGVzXHJcblxyXG5cdFx0aWYgKCB1bmRlZmluZWQgIT09IHNlbGVjdGlvbiApe1xyXG5cdFx0XHRqUXVlcnkoIHRoaXMgKS5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiJyArIHNlbGVjdGlvbiArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xyXG5cclxuXHRcdFx0aWYgKCAoJycgIT0gc2VsZWN0aW9uKSAmJiAoalF1ZXJ5KCB0aGlzICkuaGFzQ2xhc3MoICdzZXRfYm9va2luZ19sb2NhbGVfc2VsZWN0Ym94JyApKSApe1x0XHRcdFx0XHRcdFx0XHQvLyBMb2NhbGVcclxuXHJcblx0XHRcdFx0dmFyIGJvb2tpbmdfbG9jYWxlX2J1dHRvbiA9IGpRdWVyeSggdGhpcyApLnBhcmVudHMoICcudWlfZWxlbWVudF9sb2NhbGUnICkuZmluZCggJy5zZXRfYm9va2luZ19sb2NhbGVfYnV0dG9uJyApXHJcblxyXG5cdFx0XHRcdC8vYm9va2luZ19sb2NhbGVfYnV0dG9uLmNzcyggJ2NvbG9yJywgJyNkYjQ4MDAnICk7XHRcdC8vIFNldCBidXR0b24gIHJlZFxyXG5cdFx0XHRcdGJvb2tpbmdfbG9jYWxlX2J1dHRvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHQvLyBTZXQgYnV0dG9uICByZWRcclxuXHRcdFx0XHQgaWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YoIHdwYmNfdGlwcHkgKSApe1xyXG5cdFx0XHRcdFx0Ym9va2luZ19sb2NhbGVfYnV0dG9uLmdldCgwKS5fdGlwcHkuc2V0Q29udGVudCggc2VsZWN0aW9uICk7XHJcblx0XHRcdFx0IH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqICAgUmVtYXJrICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogRGVmaW5lIGNvbnRlbnQgb2YgcmVtYXJrIFwiYm9va2luZyBub3RlXCIgYnV0dG9uIGFuZCB0ZXh0YXJlYS4gIC0tIEl0J3MgY2FsbGVkIGZyb20gXHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpICBcdGVhY2ggIHRpbWUgYWZ0ZXIgTGlzdGluZyBsb2FkaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19yZW1hcmsoKXtcclxuXHJcblx0alF1ZXJ5KCAnLndwYmNfbGlzdGluZ19jb250YWluZXIgLnVpX3JlbWFya19zZWN0aW9uIHRleHRhcmVhJyApLmVhY2goIGZ1bmN0aW9uICggaW5kZXggKXtcclxuXHRcdHZhciB0ZXh0X3ZhbCA9IGpRdWVyeSggdGhpcyApLnZhbCgpO1xyXG5cdFx0aWYgKCAodW5kZWZpbmVkICE9PSB0ZXh0X3ZhbCkgJiYgKCcnICE9IHRleHRfdmFsKSApe1xyXG5cclxuXHRcdFx0dmFyIHJlbWFya19idXR0b24gPSBqUXVlcnkoIHRoaXMgKS5wYXJlbnRzKCAnLnVpX2dyb3VwJyApLmZpbmQoICcuc2V0X2Jvb2tpbmdfbm90ZV9idXR0b24nICk7XHJcblxyXG5cdFx0XHRpZiAoIHJlbWFya19idXR0b24ubGVuZ3RoID4gMCApe1xyXG5cclxuXHRcdFx0XHRyZW1hcmtfYnV0dG9uLmFkZENsYXNzKCAnd3BiY191aV9yZWQnICk7XHRcdC8vIFNldCBidXR0b24gIHJlZFxyXG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX3RpcHB5KSApe1xyXG5cdFx0XHRcdFx0Ly9yZW1hcmtfYnV0dG9uLmdldCggMCApLl90aXBweS5hbGxvd0hUTUwgPSB0cnVlO1xyXG5cdFx0XHRcdFx0Ly9yZW1hcmtfYnV0dG9uLmdldCggMCApLl90aXBweS5zZXRDb250ZW50KCB0ZXh0X3ZhbC5yZXBsYWNlKC9bXFxuXFxyXS9nLCAnPGJyPicpICk7XHJcblxyXG5cdFx0XHRcdFx0cmVtYXJrX2J1dHRvbi5nZXQoIDAgKS5fdGlwcHkuc2V0UHJvcHMoIHtcclxuXHRcdFx0XHRcdFx0YWxsb3dIVE1MOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRjb250ZW50ICA6IHRleHRfdmFsLnJlcGxhY2UoIC9bXFxuXFxyXS9nLCAnPGJyPicgKVxyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFjdGlvbnMgLHdoZW4gd2UgY2xpY2sgb24gXCJSZW1hcmtcIiBidXR0b24uXHJcbiAqXHJcbiAqIEBwYXJhbSBqcV9idXR0b24gIC1cdHRoaXMgalF1ZXJ5IGJ1dHRvbiAgb2JqZWN0XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fcmVtYXJrKCBqcV9idXR0b24gKXtcclxuXHJcblx0anFfYnV0dG9uLnBhcmVudHMoJy51aV9ncm91cCcpLmZpbmQoJy51aV9yZW1hcmtfc2VjdGlvbicpLnRvZ2dsZSgpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgQ2hhbmdlIGJvb2tpbmcgcmVzb3VyY2UgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zaG93X19jaGFuZ2VfcmVzb3VyY2UoIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIERlZmluZSBJRCBvZiBib29raW5nIHRvIGhpZGRlbiBpbnB1dFxyXG5cdGpRdWVyeSggJyNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2VsZWN0IGJvb2tpbmcgcmVzb3VyY2UgIHRoYXQgYmVsb25nIHRvICBib29raW5nXHJcblx0alF1ZXJ5KCAnI2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19yZXNvdXJjZV9zZWxlY3QnICkudmFsKCByZXNvdXJjZV9pZCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0dmFyIGNicjtcclxuXHJcblx0Ly8gR2V0IFJlc291cmNlIHNlY3Rpb25cclxuXHRjYnIgPSBqUXVlcnkoIFwiI2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uXCIgKS5kZXRhY2goKTtcclxuXHJcblx0Ly8gQXBwZW5kIGl0IHRvIGJvb2tpbmcgUk9XXHJcblx0Y2JyLmFwcGVuZFRvKCBqUXVlcnkoIFwiI3VpX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApICk7XHJcblx0Y2JyID0gbnVsbDtcclxuXHJcblx0Ly8gSGlkZSBzZWN0aW9ucyBvZiBcIkNoYW5nZSBib29raW5nIHJlc291cmNlXCIgaW4gYWxsIG90aGVyIGJvb2tpbmdzIFJPV3NcclxuXHQvL2pRdWVyeSggXCIudWlfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdcIiApLmhpZGUoKTtcclxuXHRpZiAoICEgalF1ZXJ5KCBcIiN1aV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKS5pcygnOnZpc2libGUnKSApe1xyXG5cdFx0alF1ZXJ5KCBcIi51aV9fdW5kZXJfYWN0aW9uc19yb3dfX3NlY3Rpb25faW5fYm9va2luZ1wiICkuaGlkZSgpO1xyXG5cdH1cclxuXHJcblx0Ly8gU2hvdyBvbmx5IFwiY2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VcIiBzZWN0aW9uICBmb3IgY3VycmVudCBib29raW5nXHJcblx0alF1ZXJ5KCBcIiN1aV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKS50b2dnbGUoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fY2hhbmdlX3Jlc291cmNlKCB0aGlzX2VsLCBib29raW5nX2FjdGlvbiwgZWxfaWQgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogYm9va2luZ19hY3Rpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCcgICAgICAgICAgIDogalF1ZXJ5KCAnI2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19ib29raW5nX2lkJyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdGVkX3Jlc291cmNlX2lkJyA6IGpRdWVyeSggJyNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fcmVzb3VyY2Vfc2VsZWN0JyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6IGVsX2lkXHJcblx0fSApO1xyXG5cclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCB0aGlzX2VsICk7XHJcblxyXG5cdC8vIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19jaGFuZ2VfcmVzb3VyY2UoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX2NoYW5nZV9yZXNvdXJjZSgpe1xyXG5cclxuXHR2YXIgY2JyY2U7XHJcblxyXG5cdC8vIEdldCBSZXNvdXJjZSBzZWN0aW9uXHJcblx0Y2JyY2UgPSBqUXVlcnkoXCIjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25cIikuZGV0YWNoKCk7XHJcblxyXG5cdC8vIEFwcGVuZCBpdCB0byBoaWRkZW4gSFRNTCB0ZW1wbGF0ZSBzZWN0aW9uICBhdCAgdGhlIGJvdHRvbSAgb2YgdGhlIHBhZ2VcclxuXHRjYnJjZS5hcHBlbmRUbyhqUXVlcnkoXCIjd3BiY19oaWRkZW5fdGVtcGxhdGVfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlXCIpKTtcclxuXHRjYnJjZSA9IG51bGw7XHJcblxyXG5cdC8vIEhpZGUgYWxsIGNoYW5nZSBib29raW5nIHJlc291cmNlcyBzZWN0aW9uc1xyXG5cdGpRdWVyeShcIi51aV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ1wiKS5oaWRlKCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiAgIER1cGxpY2F0ZSBib29raW5nIGluIG90aGVyIHJlc291cmNlICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fZHVwbGljYXRlX2Jvb2tpbmcoIGJvb2tpbmdfaWQsIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIERlZmluZSBJRCBvZiBib29raW5nIHRvIGhpZGRlbiBpbnB1dFxyXG5cdGpRdWVyeSggJyNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoIGJvb2tpbmdfaWQgKTtcclxuXHJcblx0Ly8gU2VsZWN0IGJvb2tpbmcgcmVzb3VyY2UgIHRoYXQgYmVsb25nIHRvICBib29raW5nXHJcblx0alF1ZXJ5KCAnI2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19yZXNvdXJjZV9zZWxlY3QnICkudmFsKCByZXNvdXJjZV9pZCApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0dmFyIGNicjtcclxuXHJcblx0Ly8gR2V0IFJlc291cmNlIHNlY3Rpb25cclxuXHRjYnIgPSBqUXVlcnkoIFwiI2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uXCIgKS5kZXRhY2goKTtcclxuXHJcblx0Ly8gQXBwZW5kIGl0IHRvIGJvb2tpbmcgUk9XXHJcblx0Y2JyLmFwcGVuZFRvKCBqUXVlcnkoIFwiI3VpX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApICk7XHJcblx0Y2JyID0gbnVsbDtcclxuXHJcblx0Ly8gSGlkZSBzZWN0aW9ucyBvZiBcIkR1cGxpY2F0ZSBib29raW5nXCIgaW4gYWxsIG90aGVyIGJvb2tpbmdzIFJPV3NcclxuXHRpZiAoICEgalF1ZXJ5KCBcIiN1aV9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKS5pcygnOnZpc2libGUnKSApe1xyXG5cdFx0alF1ZXJ5KCBcIi51aV9fdW5kZXJfYWN0aW9uc19yb3dfX3NlY3Rpb25faW5fYm9va2luZ1wiICkuaGlkZSgpO1xyXG5cdH1cclxuXHJcblx0Ly8gU2hvdyBvbmx5IFwiRHVwbGljYXRlIGJvb2tpbmdcIiBzZWN0aW9uICBmb3IgY3VycmVudCBib29raW5nIFJPV1xyXG5cdGpRdWVyeSggXCIjdWlfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkudG9nZ2xlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX2R1cGxpY2F0ZV9ib29raW5nKCB0aGlzX2VsLCBib29raW5nX2FjdGlvbiwgZWxfaWQgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogYm9va2luZ19hY3Rpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCcgICAgICAgICAgIDogalF1ZXJ5KCAnI2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19ib29raW5nX2lkJyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdGVkX3Jlc291cmNlX2lkJyA6IGpRdWVyeSggJyNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fcmVzb3VyY2Vfc2VsZWN0JyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6IGVsX2lkXHJcblx0fSApO1xyXG5cclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCB0aGlzX2VsICk7XHJcblxyXG5cdC8vIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19jaGFuZ2VfcmVzb3VyY2UoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX2R1cGxpY2F0ZV9ib29raW5nKCl7XHJcblxyXG5cdHZhciBjYnJjZTtcclxuXHJcblx0Ly8gR2V0IFJlc291cmNlIHNlY3Rpb25cclxuXHRjYnJjZSA9IGpRdWVyeShcIiNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvblwiKS5kZXRhY2goKTtcclxuXHJcblx0Ly8gQXBwZW5kIGl0IHRvIGhpZGRlbiBIVE1MIHRlbXBsYXRlIHNlY3Rpb24gIGF0ICB0aGUgYm90dG9tICBvZiB0aGUgcGFnZVxyXG5cdGNicmNlLmFwcGVuZFRvKGpRdWVyeShcIiN3cGJjX2hpZGRlbl90ZW1wbGF0ZV9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VcIikpO1xyXG5cdGNicmNlID0gbnVsbDtcclxuXHJcblx0Ly8gSGlkZSBhbGwgY2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VzIHNlY3Rpb25zXHJcblx0alF1ZXJ5KFwiLnVpX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nXCIpLmhpZGUoKTtcclxufVxyXG5cclxuLyoqXHJcbiAqICAgQ2hhbmdlIHBheW1lbnQgc3RhdHVzICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zaG93X19zZXRfcGF5bWVudF9zdGF0dXMoIGJvb2tpbmdfaWQgKXtcclxuXHJcblx0dmFyIGpTZWxlY3QgPSBqUXVlcnkoICcjdWlfX3NldF9wYXltZW50X3N0YXR1c19fc2VjdGlvbl9pbl9ib29raW5nXycgKyBib29raW5nX2lkICkuZmluZCggJ3NlbGVjdCcgKVxyXG5cclxuXHR2YXIgc2VsZWN0ZWRfcGF5X3N0YXR1cyA9IGpTZWxlY3QuYXR0ciggXCJhangtc2VsZWN0ZWQtdmFsdWVcIiApO1xyXG5cclxuXHQvLyBJcyBpdCBmbG9hdCAtIHRoZW4gIGl0J3MgdW5rbm93blxyXG5cdGlmICggIWlzTmFOKCBwYXJzZUZsb2F0KCBzZWxlY3RlZF9wYXlfc3RhdHVzICkgKSApe1xyXG5cdFx0alNlbGVjdC5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiMVwiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHRcdFx0XHRcdFx0XHRcdC8vIFVua25vd24gIHZhbHVlIGlzICcxJyBpbiBzZWxlY3QgYm94XHJcblx0fSBlbHNlIHtcclxuXHRcdGpTZWxlY3QuZmluZCggJ29wdGlvblt2YWx1ZT1cIicgKyBzZWxlY3RlZF9wYXlfc3RhdHVzICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XHRcdC8vIE90aGVyd2lzZSBrbm93biBwYXltZW50IHN0YXR1c1xyXG5cdH1cclxuXHJcblx0Ly8gSGlkZSBzZWN0aW9ucyBvZiBcIkNoYW5nZSBib29raW5nIHJlc291cmNlXCIgaW4gYWxsIG90aGVyIGJvb2tpbmdzIFJPV3NcclxuXHRpZiAoICEgalF1ZXJ5KCBcIiN1aV9fc2V0X3BheW1lbnRfc3RhdHVzX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkuaXMoJzp2aXNpYmxlJykgKXtcclxuXHRcdGpRdWVyeSggXCIudWlfX3VuZGVyX2FjdGlvbnNfcm93X19zZWN0aW9uX2luX2Jvb2tpbmdcIiApLmhpZGUoKTtcclxuXHR9XHJcblxyXG5cdC8vIFNob3cgb25seSBcImNoYW5nZSBib29raW5nIHJlc291cmNlXCIgc2VjdGlvbiAgZm9yIGN1cnJlbnQgYm9va2luZ1xyXG5cdGpRdWVyeSggXCIjdWlfX3NldF9wYXltZW50X3N0YXR1c19fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApLnRvZ2dsZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19zZXRfcGF5bWVudF9zdGF0dXMoIGJvb2tpbmdfaWQsIHRoaXNfZWwsIGJvb2tpbmdfYWN0aW9uLCBlbF9pZCApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiBib29raW5nX2FjdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBib29raW5nX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdGVkX3BheW1lbnRfc3RhdHVzJyA6IGpRdWVyeSggJyN1aV9idG5fc2V0X3BheW1lbnRfc3RhdHVzJyArIGJvb2tpbmdfaWQgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZCArICdfc2F2ZSdcclxuXHR9ICk7XHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxuXHJcblx0alF1ZXJ5KCAnIycgKyBlbF9pZCArICdfY2FuY2VsJykuaGlkZSgpO1xyXG5cdC8vd3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggalF1ZXJ5KCAnIycgKyBlbF9pZCArICdfY2FuY2VsJykuZ2V0KDApICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fc2V0X3BheW1lbnRfc3RhdHVzKCl7XHJcblx0Ly8gSGlkZSBhbGwgY2hhbmdlICBwYXltZW50IHN0YXR1cyBmb3IgYm9va2luZ1xyXG5cdGpRdWVyeShcIi51aV9fc2V0X3BheW1lbnRfc3RhdHVzX19zZWN0aW9uX2luX2Jvb2tpbmdcIikuaGlkZSgpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgQ2hhbmdlIGJvb2tpbmcgY29zdCAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19zZXRfYm9va2luZ19jb3N0KCBib29raW5nX2lkLCB0aGlzX2VsLCBib29raW5nX2FjdGlvbiwgZWxfaWQgKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogYm9va2luZ19hY3Rpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCcgICAgICAgICAgIDogYm9va2luZ19pZCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2Nvc3QnIFx0XHQgICA6IGpRdWVyeSggJyN1aV9idG5fc2V0X2Jvb2tpbmdfY29zdCcgKyBib29raW5nX2lkICsgJ19jb3N0JykudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogZWxfaWQgKyAnX3NhdmUnXHJcblx0fSApO1xyXG5cclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCB0aGlzX2VsICk7XHJcblxyXG5cdGpRdWVyeSggJyMnICsgZWxfaWQgKyAnX2NhbmNlbCcpLmhpZGUoKTtcclxuXHQvL3dwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIGpRdWVyeSggJyMnICsgZWxfaWQgKyAnX2NhbmNlbCcpLmdldCgwKSApO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfY2xvc2VfX3NldF9ib29raW5nX2Nvc3QoKXtcclxuXHQvLyBIaWRlIGFsbCBjaGFuZ2UgIHBheW1lbnQgc3RhdHVzIGZvciBib29raW5nXHJcblx0alF1ZXJ5KFwiLnVpX19zZXRfYm9va2luZ19jb3N0X19zZWN0aW9uX2luX2Jvb2tpbmdcIikuaGlkZSgpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqICAgU2VuZCBQYXltZW50IHJlcXVlc3QgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX3NlbmRfcGF5bWVudF9yZXF1ZXN0KCl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6ICdzZW5kX3BheW1lbnRfcmVxdWVzdCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCcgICAgICAgICAgIDogalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfcmVxdWVzdF9fYm9va2luZ19pZCcpLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3JlYXNvbl9vZl9hY3Rpb24nIFx0ICAgOiBqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9yZXF1ZXN0X19yZWFzb25fb2ZfYWN0aW9uJykudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogJ3dwYmNfbW9kYWxfX3BheW1lbnRfcmVxdWVzdF9fYnV0dG9uX3NlbmQnXHJcblx0fSApO1xyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3JlcXVlc3RfX2J1dHRvbl9zZW5kJyApLmdldCggMCApICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBJbXBvcnQgR29vZ2xlIENhbGVuZGFyICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyKCl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6ICdpbXBvcnRfZ29vZ2xlX2NhbGVuZGFyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fYnV0dG9uX3NlbmQnXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19mcm9tJyA6IFx0XHRcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbSBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19mcm9tX29mZnNldCcgOiBcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbV9vZmZzZXQnICkudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbV9vZmZzZXRfdHlwZScgOiBcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX2Zyb21fb2Zmc2V0X3R5cGUgb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX3VudGlsJyA6IFx0XHRcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX3VudGlsIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX3VudGlsX29mZnNldCcgOiBcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0JyApLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX3VudGlsX29mZnNldF90eXBlJyA6IGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX3VudGlsX29mZnNldF90eXBlIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19tYXgnIDogXHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c19tYXgnICkudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9yZXNvdXJjZScgOiBcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICN3cGJjX2Jvb2tpbmdfcmVzb3VyY2Ugb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHR9ICk7XHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX2J1dHRvbl9zZW5kJyApLmdldCggMCApICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBFeHBvcnQgYm9va2luZ3MgdG8gQ1NWICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2V4cG9ydF9jc3YoIHBhcmFtcyApe1xyXG5cclxuXHR2YXIgc2VsZWN0ZWRfYm9va2luZ19pZF9hcnIgPSB3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQoKTtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgICA6IHBhcmFtc1sgJ2Jvb2tpbmdfYWN0aW9uJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgOiBwYXJhbXNbICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0sXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2V4cG9ydF90eXBlJyAgICAgICAgICAgOiBwYXJhbXNbICdleHBvcnRfdHlwZScgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3ZfZXhwb3J0X3NlcGFyYXRvcicgIDogcGFyYW1zWyAnY3N2X2V4cG9ydF9zZXBhcmF0b3InIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY3N2X2V4cG9ydF9za2lwX2ZpZWxkcyc6IHBhcmFtc1sgJ2Nzdl9leHBvcnRfc2tpcF9maWVsZHMnIF0sXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnXHQ6IHNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyLmpvaW4oJywnKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWFyY2hfcGFyYW1zJyA6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5zZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHJcblx0dmFyIHRoaXNfZWwgPSBqUXVlcnkoICcjJyArIHBhcmFtc1sgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSApLmdldCggMCApXHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gVVJMIGluIG5ldyB0YWIgLSBtYWlubHkgIGl0J3MgdXNlZCBmb3Igb3BlbiBDU1YgbGluayAgZm9yIGRvd25sb2FkZWQgZXhwb3J0ZWQgYm9va2luZ3MgYXMgQ1NWXHJcbiAqXHJcbiAqIEBwYXJhbSBleHBvcnRfY3N2X3VybFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fZXhwb3J0X2Nzdl91cmxfX2Rvd25sb2FkKCBleHBvcnRfY3N2X3VybCApe1xyXG5cclxuXHQvL3ZhciBzZWxlY3RlZF9ib29raW5nX2lkX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpO1xyXG5cclxuXHRkb2N1bWVudC5sb2NhdGlvbi5ocmVmID0gZXhwb3J0X2Nzdl91cmw7Ly8gKyAnJnNlbGVjdGVkX2lkPScgKyBzZWxlY3RlZF9ib29raW5nX2lkX2Fyci5qb2luKCcsJyk7XHJcblxyXG5cdC8vIEl0J3Mgb3BlbiBhZGRpdGlvbmFsIGRpYWxvZyBmb3IgYXNraW5nIG9wZW5pbmcgdWxyIGluIG5ldyB0YWJcclxuXHQvLyB3aW5kb3cub3BlbiggZXhwb3J0X2Nzdl91cmwsICdfYmxhbmsnKS5mb2N1cygpO1xyXG59Il0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUVaO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFKQSxTQUFBQSxRQUFBQyxHQUFBLHNDQUFBRCxPQUFBLHdCQUFBRSxNQUFBLHVCQUFBQSxNQUFBLENBQUFDLFFBQUEsYUFBQUYsR0FBQSxrQkFBQUEsR0FBQSxnQkFBQUEsR0FBQSxXQUFBQSxHQUFBLHlCQUFBQyxNQUFBLElBQUFELEdBQUEsQ0FBQUcsV0FBQSxLQUFBRixNQUFBLElBQUFELEdBQUEsS0FBQUMsTUFBQSxDQUFBRyxTQUFBLHFCQUFBSixHQUFBLEtBQUFELE9BQUEsQ0FBQUMsR0FBQTtBQUtBLFNBQVNLLG9DQUFvQ0EsQ0FBQSxFQUFxQjtFQUFBLElBQW5CQyxZQUFZLEdBQUFDLFNBQUEsQ0FBQUMsTUFBQSxRQUFBRCxTQUFBLFFBQUFFLFNBQUEsR0FBQUYsU0FBQSxN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
