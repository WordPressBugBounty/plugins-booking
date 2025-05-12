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

//TODO: delete
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19hY3Rpb25zLmpzIiwibmFtZXMiOlsiX3R5cGVvZiIsIm8iLCJTeW1ib2wiLCJpdGVyYXRvciIsImNvbnN0cnVjdG9yIiwicHJvdG90eXBlIiwid3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0IiwiYWN0aW9uX3BhcmFtIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwibG9nIiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyIsIndwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQiLCJBcnJheSIsImlzQXJyYXkiLCJ3cGJjX2dldF9zZWxlY3RlZF9sb2NhbGUiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCJnZXRfc2VjdXJlX3BhcmFtIiwiYWN0aW9uX3Bvc3RfcGFyYW1zIiwiYWN0aW9uIiwibm9uY2UiLCJ3cGJjX2FqeF91c2VyX2lkIiwid3BiY19hanhfbG9jYWxlIiwiYWN0aW9uX3BhcmFtcyIsInNlYXJjaF9wYXJhbXMiLCJqUXVlcnkiLCJwb3N0Iiwid3BiY191cmxfYWpheCIsInJlc3BvbnNlX2RhdGEiLCJ0ZXh0U3RhdHVzIiwianFYSFIiLCJncm91cEVuZCIsImhpZGUiLCJnZXRfb3RoZXJfcGFyYW0iLCJodG1sIiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwicmVwbGFjZSIsImlzX3JlbG9hZF9hamF4X2xpc3RpbmciLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMiLCJjbG9zZWRfdGltZXIiLCJzZXRUaW1lb3V0Iiwid3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9faXNfc3BpbiIsImRvY3VtZW50IiwibG9jYXRpb24iLCJocmVmIiwicmVsb2FkIiwid3BiY19hanhfYm9va2luZ19fZXhwb3J0X2Nzdl91cmxfX2Rvd25sb2FkIiwid3BiY19hanhfYm9va2luZ19fYWN0dWFsX2xpc3RpbmdfX3Nob3ciLCJ3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4iLCJ3cGJjX3BvcHVwX21vZGFsc19faGlkZSIsImZhaWwiLCJlcnJvclRocm93biIsIndpbmRvdyIsImVycm9yX21lc3NhZ2UiLCJyZXNwb25zZVRleHQiLCJ3cGJjX2FqeF9ib29raW5nX3Nob3dfbWVzc2FnZSIsIndwYmNfbXlfbW9kYWwiLCJ3cGJjX2FqeF9jbGlja19vbl9kYXRlc19zaG9ydCIsInNob3ciLCJ3cGJjX2FqeF9jbGlja19vbl9kYXRlc193aWRlIiwid3BiY19hanhfY2xpY2tfb25fZGF0ZXNfdG9nZ2xlIiwidGhpc19kYXRlIiwicGFyZW50cyIsImZpbmQiLCJ0b2dnbGUiLCJ3cGJjX2FqeF9ib29raW5nX191aV9kZWZpbmVfX2xvY2FsZSIsImVhY2giLCJpbmRleCIsInNlbGVjdGlvbiIsImF0dHIiLCJwcm9wIiwiaGFzQ2xhc3MiLCJib29raW5nX2xvY2FsZV9idXR0b24iLCJhZGRDbGFzcyIsIndwYmNfdGlwcHkiLCJnZXQiLCJfdGlwcHkiLCJzZXRDb250ZW50Iiwid3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19yZW1hcmsiLCJ0ZXh0X3ZhbCIsInZhbCIsInJlbWFya19idXR0b24iLCJzZXRQcm9wcyIsImFsbG93SFRNTCIsImNvbnRlbnQiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fcmVtYXJrIiwianFfYnV0dG9uIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fY2hhbmdlX3Jlc291cmNlIiwiYm9va2luZ19pZCIsInJlc291cmNlX2lkIiwidHJpZ2dlciIsImNiciIsImRldGFjaCIsImFwcGVuZFRvIiwiaXMiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19jaGFuZ2VfcmVzb3VyY2UiLCJ0aGlzX2VsIiwiYm9va2luZ19hY3Rpb24iLCJlbF9pZCIsIndwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24iLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zaG93X19kdXBsaWNhdGVfYm9va2luZyIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX2R1cGxpY2F0ZV9ib29raW5nIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fc2V0X3BheW1lbnRfc3RhdHVzIiwialNlbGVjdCIsInNlbGVjdGVkX3BheV9zdGF0dXMiLCJpc05hTiIsInBhcnNlRmxvYXQiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19zZXRfcGF5bWVudF9zdGF0dXMiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fc2V0X3BheW1lbnRfc3RhdHVzIiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2F2ZV9fc2V0X2Jvb2tpbmdfY29zdCIsIndwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19zZXRfYm9va2luZ19jb3N0Iiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX3NlbmRfcGF5bWVudF9yZXF1ZXN0Iiwid3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXIiLCJ3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fZXhwb3J0X2NzdiIsInBhcmFtcyIsInNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyIiwid3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkIiwiam9pbiIsInNlYXJjaF9nZXRfYWxsX3BhcmFtcyIsImV4cG9ydF9jc3ZfdXJsIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fc3JjL2Jvb2tpbmdzX19hY3Rpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqICAgQWpheCAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcbi8vdmFyIGlzX3RoaXNfYWN0aW9uID0gZmFsc2U7XHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggYWN0aW9uIHJlcXVlc3QsICBsaWtlIGFwcHJvdmluZyBvciBjYW5jZWxsYXRpb25cclxuICpcclxuICogQHBhcmFtIGFjdGlvbl9wYXJhbVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCBhY3Rpb25fcGFyYW0gPSB7fSApe1xyXG5cclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ1dQQkNfQUpYX0JPT0tJTkdfQUNUSU9OUycgKTsgY29uc29sZS5sb2coICcgPT0gQWpheCBBY3Rpb25zIDo6IFBhcmFtcyA9PSAnLCBhY3Rpb25fcGFyYW0gKTtcclxuLy9pc190aGlzX2FjdGlvbiA9IHRydWU7XHJcblxyXG5cdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlX3Byb2Nlc3NpbmcoICcnICk7XHJcblxyXG5cdHdwYmNfYm9va2luZ19saXN0aW5nX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKTtcclxuXHJcblx0Ly8gR2V0IHJlZGVmaW5lZCBMb2NhbGUsICBpZiBhY3Rpb24gb24gc2luZ2xlIGJvb2tpbmcgIVxyXG5cdGlmICggICggdW5kZWZpbmVkICE9IGFjdGlvbl9wYXJhbVsgJ2Jvb2tpbmdfaWQnIF0gKSAmJiAoICEgQXJyYXkuaXNBcnJheSggYWN0aW9uX3BhcmFtWyAnYm9va2luZ19pZCcgXSApICkgKXtcdFx0XHRcdC8vIE5vdCBhcnJheVxyXG5cclxuXHRcdGFjdGlvbl9wYXJhbVsgJ2xvY2FsZScgXSA9IHdwYmNfZ2V0X3NlbGVjdGVkX2xvY2FsZSggYWN0aW9uX3BhcmFtWyAnYm9va2luZ19pZCcgXSwgd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICkgKTtcclxuXHR9XHJcblxyXG5cdHZhciBhY3Rpb25fcG9zdF9wYXJhbXMgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHRhY3Rpb24gICAgICAgICAgOiAnV1BCQ19BSlhfQk9PS0lOR19BQ1RJT05TJyxcclxuXHRcdFx0XHRcdFx0XHRcdG5vbmNlICAgICAgICAgICA6IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAnbm9uY2UnICksXHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2FqeF91c2VyX2lkOiAoICggdW5kZWZpbmVkID09IGFjdGlvbl9wYXJhbVsgJ3VzZXJfaWQnIF0gKSA/IHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfc2VjdXJlX3BhcmFtKCAndXNlcl9pZCcgKSA6IGFjdGlvbl9wYXJhbVsgJ3VzZXJfaWQnIF0gKSxcclxuXHRcdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2xvY2FsZTogICggKCB1bmRlZmluZWQgPT0gYWN0aW9uX3BhcmFtWyAnbG9jYWxlJyBdICkgID8gd3BiY19hanhfYm9va2luZ19saXN0aW5nLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICkgIDogYWN0aW9uX3BhcmFtWyAnbG9jYWxlJyBdICksXHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0YWN0aW9uX3BhcmFtc1x0OiBhY3Rpb25fcGFyYW1cclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvLyBJdCdzIHJlcXVpcmVkIGZvciBDU1YgZXhwb3J0IC0gZ2V0dGluZyB0aGUgc2FtZSBsaXN0ICBvZiBib29raW5nc1xyXG5cdGlmICggdHlwZW9mIGFjdGlvbl9wYXJhbS5zZWFyY2hfcGFyYW1zICE9PSAndW5kZWZpbmVkJyApe1xyXG5cdFx0YWN0aW9uX3Bvc3RfcGFyYW1zWyAnc2VhcmNoX3BhcmFtcycgXSA9IGFjdGlvbl9wYXJhbS5zZWFyY2hfcGFyYW1zO1xyXG5cdFx0ZGVsZXRlIGFjdGlvbl9wb3N0X3BhcmFtcy5hY3Rpb25fcGFyYW1zLnNlYXJjaF9wYXJhbXM7XHJcblx0fVxyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXggLFxyXG5cclxuXHRcdFx0XHRhY3Rpb25fcG9zdF9wYXJhbXMgLFxyXG5cclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjZy5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcblxyXG5jb25zb2xlLmxvZyggJyA9PSBBamF4IEFjdGlvbnMgOjogUmVzcG9uc2UgV1BCQ19BSlhfQk9PS0lOR19BQ1RJT05TID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHRcdFx0XHRcdC8vIFByb2JhYmx5IEVycm9yXHJcblx0XHRcdFx0XHRpZiAoICh0eXBlb2YgcmVzcG9uc2VfZGF0YSAhPT0gJ29iamVjdCcpIHx8IChyZXNwb25zZV9kYXRhID09PSBudWxsKSApe1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcud3BiY19hanhfdW5kZXJfdG9vbGJhcl9yb3cnICkuaGlkZSgpO1x0IFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdFx0XHRcdFx0XHRqUXVlcnkoIHdwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZy5nZXRfb3RoZXJfcGFyYW0oICdsaXN0aW5nX2NvbnRhaW5lcicgKSApLmh0bWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPGRpdiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlIG5vdGljZS13YXJuaW5nXCIgc3R5bGU9XCJ0ZXh0LWFsaWduOmxlZnRcIj4nICtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSArXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpO1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAoICcxJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHQnIF0gKSA/ICdzdWNjZXNzJyA6ICdlcnJvcidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAoICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZihyZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICdhZnRlcl9hY3Rpb25fcmVzdWx0X2RlbGF5JyBdKSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDogcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9kZWxheScgXSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0XHRcdC8vIFN1Y2Nlc3MgcmVzcG9uc2VcclxuXHRcdFx0XHRcdGlmICggJzEnID09IHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdCcgXSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGlzX3JlbG9hZF9hamF4X2xpc3RpbmcgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gQWZ0ZXIgR29vZ2xlIENhbGVuZGFyIGltcG9ydCBzaG93IGltcG9ydGVkIGJvb2tpbmdzIGFuZCByZWxvYWQgdGhlIHBhZ2UgZm9yIHRvb2xiYXIgcGFyYW1ldGVycyB1cGRhdGVcclxuXHRcdFx0XHRcdFx0aWYgKCBmYWxzZSAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnbmV3X2xpc3RpbmdfcGFyYW1zJyBdICl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnbmV3X2xpc3RpbmdfcGFyYW1zJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdGlmICggd3BiY19ib29raW5nX2xpc3RpbmdfcmVsb2FkX2J1dHRvbl9faXNfc3BpbigpICl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKCB1bmRlZmluZWQgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnbmV3X2xpc3RpbmdfcGFyYW1zJyBdWyAncmVsb2FkX3VybF9wYXJhbXMnIF0gKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRvY3VtZW50LmxvY2F0aW9uLmhyZWYgPSByZXNwb25zZV9kYXRhWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHRfYWxsX3BhcmFtc19hcnInIF1bICduZXdfbGlzdGluZ19wYXJhbXMnIF1bICdyZWxvYWRfdXJsX3BhcmFtcycgXTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZG9jdW1lbnQubG9jYXRpb24ucmVsb2FkKCk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgMjAwMCApO1xyXG5cdFx0XHRcdFx0XHRcdGlzX3JlbG9hZF9hamF4X2xpc3RpbmcgPSBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Ly8gU3RhcnQgZG93bmxvYWQgZXhwb3J0ZWQgQ1NWIGZpbGVcclxuXHRcdFx0XHRcdFx0aWYgKCB1bmRlZmluZWQgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9hZnRlcl9hY3Rpb25fcmVzdWx0X2FsbF9wYXJhbXNfYXJyJyBdWyAnZXhwb3J0X2Nzdl91cmwnIF0gKXtcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX19leHBvcnRfY3N2X3VybF9fZG93bmxvYWQoIHJlc3BvbnNlX2RhdGFbICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdF9hbGxfcGFyYW1zX2FycicgXVsgJ2V4cG9ydF9jc3ZfdXJsJyBdICk7XHJcblx0XHRcdFx0XHRcdFx0aXNfcmVsb2FkX2FqYXhfbGlzdGluZyA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIGlzX3JlbG9hZF9hamF4X2xpc3RpbmcgKXtcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2FqeF9ib29raW5nX19hY3R1YWxfbGlzdGluZ19fc2hvdygpO1x0Ly9cdFNlbmRpbmcgQWpheCBSZXF1ZXN0XHQtXHR3aXRoIHBhcmFtZXRlcnMgdGhhdCAgd2UgZWFybHkgIGRlZmluZWQgaW4gXCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcIiBPYmouXHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVtb3ZlIHNwaW4gaWNvbiBmcm9tICBidXR0b24gYW5kIEVuYWJsZSB0aGlzIGJ1dHRvbi5cclxuXHRcdFx0XHRcdHdwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiggcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSApXHJcblxyXG5cdFx0XHRcdFx0Ly8gSGlkZSBtb2RhbHNcclxuXHRcdFx0XHRcdHdwYmNfcG9wdXBfbW9kYWxzX19oaWRlKCk7XHJcblxyXG5cdFx0XHRcdFx0alF1ZXJ5KCAnI2FqYXhfcmVzcG9uZCcgKS5odG1sKCByZXNwb25zZV9kYXRhICk7XHRcdC8vIEZvciBhYmlsaXR5IHRvIHNob3cgcmVzcG9uc2UsIGFkZCBzdWNoIERJViBlbGVtZW50IHRvIHBhZ2VcclxuXHRcdFx0XHR9XHJcblx0XHRcdCAgKS5mYWlsKCBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHsgICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdBamF4X0Vycm9yJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7IH1cclxuXHRcdFx0XHRcdGpRdWVyeSggJy53cGJjX2FqeF91bmRlcl90b29sYmFyX3JvdycgKS5oaWRlKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjYuMS41LlxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9IGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICk7XHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIEhpZGUgYWxsIG9wZW4gbW9kYWwgcG9wdXBzIHdpbmRvd3NcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfcG9wdXBfbW9kYWxzX19oaWRlKCl7XHJcblxyXG5cdC8vIEhpZGUgbW9kYWxzXHJcblx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKGpRdWVyeSggJy53cGJjX3BvcHVwX21vZGFsJyApLndwYmNfbXlfbW9kYWwpICl7XHJcblx0XHRqUXVlcnkoICcud3BiY19wb3B1cF9tb2RhbCcgKS53cGJjX215X21vZGFsKCAnaGlkZScgKTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBEYXRlcyAgU2hvcnQgPC0+IFdpZGUgICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3Nob3J0KCl7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfc21hbGwsLmJvb2tpbmdfZGF0ZXNfZnVsbCcgKS5oaWRlKCk7XHJcblx0alF1ZXJ5KCAnI2Jvb2tpbmdfZGF0ZXNfZnVsbCwuYm9va2luZ19kYXRlc19zbWFsbCcgKS5zaG93KCk7XHJcblx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7J3VpX3Vzcl9fZGF0ZXNfc2hvcnRfd2lkZSc6ICdzaG9ydCd9ICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3dpZGUoKXtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19mdWxsLC5ib29raW5nX2RhdGVzX3NtYWxsJyApLmhpZGUoKTtcclxuXHRqUXVlcnkoICcjYm9va2luZ19kYXRlc19zbWFsbCwuYm9va2luZ19kYXRlc19mdWxsJyApLnNob3coKTtcclxuXHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsndWlfdXNyX19kYXRlc19zaG9ydF93aWRlJzogJ3dpZGUnfSApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9jbGlja19vbl9kYXRlc190b2dnbGUodGhpc19kYXRlKXtcclxuXHJcblx0alF1ZXJ5KCB0aGlzX2RhdGUgKS5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19zbWFsbCcgKS50b2dnbGUoKTtcclxuXHRqUXVlcnkoIHRoaXNfZGF0ZSApLnBhcmVudHMoICcud3BiY19jb2xfZGF0ZXMnICkuZmluZCggJy5ib29raW5nX2RhdGVzX2Z1bGwnICkudG9nZ2xlKCk7XHJcblxyXG5cdC8qXHJcblx0dmFyIHZpc2libGVfc2VjdGlvbiA9IGpRdWVyeSggdGhpc19kYXRlICkucGFyZW50cyggJy5ib29raW5nX2RhdGVzX2V4cGFuZF9zZWN0aW9uJyApO1xyXG5cdHZpc2libGVfc2VjdGlvbi5oaWRlKCk7XHJcblx0aWYgKCB2aXNpYmxlX3NlY3Rpb24uaGFzQ2xhc3MoICdib29raW5nX2RhdGVzX2Z1bGwnICkgKXtcclxuXHRcdHZpc2libGVfc2VjdGlvbi5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19zbWFsbCcgKS5zaG93KCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHZpc2libGVfc2VjdGlvbi5wYXJlbnRzKCAnLndwYmNfY29sX2RhdGVzJyApLmZpbmQoICcuYm9va2luZ19kYXRlc19mdWxsJyApLnNob3coKTtcclxuXHR9Ki9cclxuXHRjb25zb2xlLmxvZyggJ3dwYmNfYWp4X2NsaWNrX29uX2RhdGVzX3RvZ2dsZScsIHRoaXNfZGF0ZSApO1xyXG59XHJcblxyXG4vKipcclxuICogICBMb2NhbGUgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBcdFNlbGVjdCBvcHRpb25zIGluIHNlbGVjdCBib3hlcyBiYXNlZCBvbiBhdHRyaWJ1dGUgXCJ2YWx1ZV9vZl9zZWxlY3RlZF9vcHRpb25cIiBhbmQgUkVEIGNvbG9yIGFuZCBoaW50IGZvciBMT0NBTEUgYnV0dG9uICAgLS0gIEl0J3MgY2FsbGVkIGZyb20gXHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpICBcdGVhY2ggIHRpbWUgYWZ0ZXIgTGlzdGluZyBsb2FkaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19sb2NhbGUoKXtcclxuXHJcblx0alF1ZXJ5KCAnLndwYmNfX2xpc3RfX3RhYmxlIHNlbGVjdCcgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblxyXG5cdFx0dmFyIHNlbGVjdGlvbiA9IGpRdWVyeSggdGhpcyApLmF0dHIoIFwidmFsdWVfb2Zfc2VsZWN0ZWRfb3B0aW9uXCIgKTtcdFx0XHQvLyBEZWZpbmUgc2VsZWN0ZWQgc2VsZWN0IGJveGVzXHJcblxyXG5cdFx0aWYgKCB1bmRlZmluZWQgIT09IHNlbGVjdGlvbiApe1xyXG5cdFx0XHRqUXVlcnkoIHRoaXMgKS5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiJyArIHNlbGVjdGlvbiArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xyXG5cclxuXHRcdFx0aWYgKCAoJycgIT0gc2VsZWN0aW9uKSAmJiAoalF1ZXJ5KCB0aGlzICkuaGFzQ2xhc3MoICdzZXRfYm9va2luZ19sb2NhbGVfc2VsZWN0Ym94JyApKSApe1x0XHRcdFx0XHRcdFx0XHQvLyBMb2NhbGVcclxuXHJcblx0XHRcdFx0dmFyIGJvb2tpbmdfbG9jYWxlX2J1dHRvbiA9IGpRdWVyeSggdGhpcyApLnBhcmVudHMoICcudWlfZWxlbWVudF9sb2NhbGUnICkuZmluZCggJy5zZXRfYm9va2luZ19sb2NhbGVfYnV0dG9uJyApXHJcblxyXG5cdFx0XHRcdC8vYm9va2luZ19sb2NhbGVfYnV0dG9uLmNzcyggJ2NvbG9yJywgJyNkYjQ4MDAnICk7XHRcdC8vIFNldCBidXR0b24gIHJlZFxyXG5cdFx0XHRcdGJvb2tpbmdfbG9jYWxlX2J1dHRvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHQvLyBTZXQgYnV0dG9uICByZWRcclxuXHRcdFx0XHQgaWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YoIHdwYmNfdGlwcHkgKSApe1xyXG5cdFx0XHRcdFx0Ym9va2luZ19sb2NhbGVfYnV0dG9uLmdldCgwKS5fdGlwcHkuc2V0Q29udGVudCggc2VsZWN0aW9uICk7XHJcblx0XHRcdFx0IH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqICAgUmVtYXJrICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogRGVmaW5lIGNvbnRlbnQgb2YgcmVtYXJrIFwiYm9va2luZyBub3RlXCIgYnV0dG9uIGFuZCB0ZXh0YXJlYS4gIC0tIEl0J3MgY2FsbGVkIGZyb20gXHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rcygpICBcdGVhY2ggIHRpbWUgYWZ0ZXIgTGlzdGluZyBsb2FkaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfZGVmaW5lX19yZW1hcmsoKXtcclxuXHJcblx0alF1ZXJ5KCAnLndwYmNfX2xpc3RfX3RhYmxlIC51aV9yZW1hcmtfc2VjdGlvbiB0ZXh0YXJlYScgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICl7XHJcblx0XHR2YXIgdGV4dF92YWwgPSBqUXVlcnkoIHRoaXMgKS52YWwoKTtcclxuXHRcdGlmICggKHVuZGVmaW5lZCAhPT0gdGV4dF92YWwpICYmICgnJyAhPSB0ZXh0X3ZhbCkgKXtcclxuXHJcblx0XHRcdHZhciByZW1hcmtfYnV0dG9uID0galF1ZXJ5KCB0aGlzICkucGFyZW50cyggJy51aV9ncm91cCcgKS5maW5kKCAnLnNldF9ib29raW5nX25vdGVfYnV0dG9uJyApO1xyXG5cclxuXHRcdFx0aWYgKCByZW1hcmtfYnV0dG9uLmxlbmd0aCA+IDAgKXtcclxuXHJcblx0XHRcdFx0cmVtYXJrX2J1dHRvbi5hZGRDbGFzcyggJ3dwYmNfdWlfcmVkJyApO1x0XHQvLyBTZXQgYnV0dG9uICByZWRcclxuXHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdFx0XHRcdC8vcmVtYXJrX2J1dHRvbi5nZXQoIDAgKS5fdGlwcHkuYWxsb3dIVE1MID0gdHJ1ZTtcclxuXHRcdFx0XHRcdC8vcmVtYXJrX2J1dHRvbi5nZXQoIDAgKS5fdGlwcHkuc2V0Q29udGVudCggdGV4dF92YWwucmVwbGFjZSgvW1xcblxccl0vZywgJzxicj4nKSApO1xyXG5cclxuXHRcdFx0XHRcdHJlbWFya19idXR0b24uZ2V0KCAwICkuX3RpcHB5LnNldFByb3BzKCB7XHJcblx0XHRcdFx0XHRcdGFsbG93SFRNTDogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0Y29udGVudCAgOiB0ZXh0X3ZhbC5yZXBsYWNlKCAvW1xcblxccl0vZywgJzxicj4nIClcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBY3Rpb25zICx3aGVuIHdlIGNsaWNrIG9uIFwiUmVtYXJrXCIgYnV0dG9uLlxyXG4gKlxyXG4gKiBAcGFyYW0ganFfYnV0dG9uICAtXHR0aGlzIGpRdWVyeSBidXR0b24gIG9iamVjdFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX3JlbWFyaygganFfYnV0dG9uICl7XHJcblxyXG5cdGpxX2J1dHRvbi5wYXJlbnRzKCcudWlfZ3JvdXAnKS5maW5kKCcudWlfcmVtYXJrX3NlY3Rpb24nKS50b2dnbGUoKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIENoYW5nZSBib29raW5nIHJlc291cmNlICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfc2hvd19fY2hhbmdlX3Jlc291cmNlKCBib29raW5nX2lkLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBEZWZpbmUgSUQgb2YgYm9va2luZyB0byBoaWRkZW4gaW5wdXRcclxuXHRqUXVlcnkoICcjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNlbGVjdCBib29raW5nIHJlc291cmNlICB0aGF0IGJlbG9uZyB0byAgYm9va2luZ1xyXG5cdGpRdWVyeSggJyNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fcmVzb3VyY2Vfc2VsZWN0JyApLnZhbCggcmVzb3VyY2VfaWQgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdHZhciBjYnI7XHJcblxyXG5cdC8vIEdldCBSZXNvdXJjZSBzZWN0aW9uXHJcblx0Y2JyID0galF1ZXJ5KCBcIiNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvblwiICkuZGV0YWNoKCk7XHJcblxyXG5cdC8vIEFwcGVuZCBpdCB0byBib29raW5nIFJPV1xyXG5cdGNici5hcHBlbmRUbyggalF1ZXJ5KCBcIiN1aV9fY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKSApO1xyXG5cdGNiciA9IG51bGw7XHJcblxyXG5cdC8vIEhpZGUgc2VjdGlvbnMgb2YgXCJDaGFuZ2UgYm9va2luZyByZXNvdXJjZVwiIGluIGFsbCBvdGhlciBib29raW5ncyBST1dzXHJcblx0Ly9qUXVlcnkoIFwiLnVpX19jaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nXCIgKS5oaWRlKCk7XHJcblx0aWYgKCAhIGpRdWVyeSggXCIjdWlfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkuaXMoJzp2aXNpYmxlJykgKXtcclxuXHRcdGpRdWVyeSggXCIudWlfX3VuZGVyX2FjdGlvbnNfcm93X19zZWN0aW9uX2luX2Jvb2tpbmdcIiApLmhpZGUoKTtcclxuXHR9XHJcblxyXG5cdC8vIFNob3cgb25seSBcImNoYW5nZSBib29raW5nIHJlc291cmNlXCIgc2VjdGlvbiAgZm9yIGN1cnJlbnQgYm9va2luZ1xyXG5cdGpRdWVyeSggXCIjdWlfX2NoYW5nZV9ib29raW5nX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkudG9nZ2xlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX2NoYW5nZV9yZXNvdXJjZSggdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGpRdWVyeSggJyNjaGFuZ2VfYm9va2luZ19yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RlZF9yZXNvdXJjZV9pZCcgOiBqUXVlcnkoICcjY2hhbmdlX2Jvb2tpbmdfcmVzb3VyY2VfX3Jlc291cmNlX3NlbGVjdCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZFxyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBEdXBsaWNhdGUgYm9va2luZyBpbiBvdGhlciByZXNvdXJjZSAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX2R1cGxpY2F0ZV9ib29raW5nKCBib29raW5nX2lkLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBEZWZpbmUgSUQgb2YgYm9va2luZyB0byBoaWRkZW4gaW5wdXRcclxuXHRqUXVlcnkoICcjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX2Jvb2tpbmdfaWQnICkudmFsKCBib29raW5nX2lkICk7XHJcblxyXG5cdC8vIFNlbGVjdCBib29raW5nIHJlc291cmNlICB0aGF0IGJlbG9uZyB0byAgYm9va2luZ1xyXG5cdGpRdWVyeSggJyNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fcmVzb3VyY2Vfc2VsZWN0JyApLnZhbCggcmVzb3VyY2VfaWQgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdHZhciBjYnI7XHJcblxyXG5cdC8vIEdldCBSZXNvdXJjZSBzZWN0aW9uXHJcblx0Y2JyID0galF1ZXJ5KCBcIiNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvblwiICkuZGV0YWNoKCk7XHJcblxyXG5cdC8vIEFwcGVuZCBpdCB0byBib29raW5nIFJPV1xyXG5cdGNici5hcHBlbmRUbyggalF1ZXJ5KCBcIiN1aV9fZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKSApO1xyXG5cdGNiciA9IG51bGw7XHJcblxyXG5cdC8vIEhpZGUgc2VjdGlvbnMgb2YgXCJEdXBsaWNhdGUgYm9va2luZ1wiIGluIGFsbCBvdGhlciBib29raW5ncyBST1dzXHJcblx0aWYgKCAhIGpRdWVyeSggXCIjdWlfX2R1cGxpY2F0ZV9ib29raW5nX3RvX290aGVyX3Jlc291cmNlX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkuaXMoJzp2aXNpYmxlJykgKXtcclxuXHRcdGpRdWVyeSggXCIudWlfX3VuZGVyX2FjdGlvbnNfcm93X19zZWN0aW9uX2luX2Jvb2tpbmdcIiApLmhpZGUoKTtcclxuXHR9XHJcblxyXG5cdC8vIFNob3cgb25seSBcIkR1cGxpY2F0ZSBib29raW5nXCIgc2VjdGlvbiAgZm9yIGN1cnJlbnQgYm9va2luZyBST1dcclxuXHRqUXVlcnkoIFwiI3VpX19kdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fc2VjdGlvbl9pbl9ib29raW5nX1wiICsgYm9va2luZ19pZCApLnRvZ2dsZSgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19zYXZlX19kdXBsaWNhdGVfYm9va2luZyggdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGpRdWVyeSggJyNkdXBsaWNhdGVfYm9va2luZ190b19vdGhlcl9yZXNvdXJjZV9fYm9va2luZ19pZCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RlZF9yZXNvdXJjZV9pZCcgOiBqUXVlcnkoICcjZHVwbGljYXRlX2Jvb2tpbmdfdG9fb3RoZXJfcmVzb3VyY2VfX3Jlc291cmNlX3NlbGVjdCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZFxyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBDaGFuZ2UgcGF5bWVudCBzdGF0dXMgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3Nob3dfX3NldF9wYXltZW50X3N0YXR1cyggYm9va2luZ19pZCApe1xyXG5cclxuXHR2YXIgalNlbGVjdCA9IGpRdWVyeSggJyN1aV9fc2V0X3BheW1lbnRfc3RhdHVzX19zZWN0aW9uX2luX2Jvb2tpbmdfJyArIGJvb2tpbmdfaWQgKS5maW5kKCAnc2VsZWN0JyApXHJcblxyXG5cdHZhciBzZWxlY3RlZF9wYXlfc3RhdHVzID0galNlbGVjdC5hdHRyKCBcImFqeC1zZWxlY3RlZC12YWx1ZVwiICk7XHJcblxyXG5cdC8vIElzIGl0IGZsb2F0IC0gdGhlbiAgaXQncyB1bmtub3duXHJcblx0aWYgKCAhaXNOYU4oIHBhcnNlRmxvYXQoIHNlbGVjdGVkX3BheV9zdGF0dXMgKSApICl7XHJcblx0XHRqU2VsZWN0LmZpbmQoICdvcHRpb25bdmFsdWU9XCIxXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcdFx0XHRcdFx0XHRcdFx0Ly8gVW5rbm93biAgdmFsdWUgaXMgJzEnIGluIHNlbGVjdCBib3hcclxuXHR9IGVsc2Uge1xyXG5cdFx0alNlbGVjdC5maW5kKCAnb3B0aW9uW3ZhbHVlPVwiJyArIHNlbGVjdGVkX3BheV9zdGF0dXMgKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcdFx0Ly8gT3RoZXJ3aXNlIGtub3duIHBheW1lbnQgc3RhdHVzXHJcblx0fVxyXG5cclxuXHQvLyBIaWRlIHNlY3Rpb25zIG9mIFwiQ2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VcIiBpbiBhbGwgb3RoZXIgYm9va2luZ3MgUk9Xc1xyXG5cdGlmICggISBqUXVlcnkoIFwiI3VpX19zZXRfcGF5bWVudF9zdGF0dXNfX3NlY3Rpb25faW5fYm9va2luZ19cIiArIGJvb2tpbmdfaWQgKS5pcygnOnZpc2libGUnKSApe1xyXG5cdFx0alF1ZXJ5KCBcIi51aV9fdW5kZXJfYWN0aW9uc19yb3dfX3NlY3Rpb25faW5fYm9va2luZ1wiICkuaGlkZSgpO1xyXG5cdH1cclxuXHJcblx0Ly8gU2hvdyBvbmx5IFwiY2hhbmdlIGJvb2tpbmcgcmVzb3VyY2VcIiBzZWN0aW9uICBmb3IgY3VycmVudCBib29raW5nXHJcblx0alF1ZXJ5KCBcIiN1aV9fc2V0X3BheW1lbnRfc3RhdHVzX19zZWN0aW9uX2luX2Jvb2tpbmdfXCIgKyBib29raW5nX2lkICkudG9nZ2xlKCk7XHJcbn1cclxuXHJcbi8vVE9ETzogZGVsZXRlXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9wYXltZW50X3N0YXR1cyggYm9va2luZ19pZCwgdGhpc19lbCwgYm9va2luZ19hY3Rpb24sIGVsX2lkICl7XHJcblxyXG5cdHdwYmNfYWp4X2Jvb2tpbmdfYWpheF9hY3Rpb25fcmVxdWVzdCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfYWN0aW9uJyAgICAgICA6IGJvb2tpbmdfYWN0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfaWQnICAgICAgICAgICA6IGJvb2tpbmdfaWQsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0ZWRfcGF5bWVudF9zdGF0dXMnIDogalF1ZXJ5KCAnI3VpX2J0bl9zZXRfcGF5bWVudF9zdGF0dXMnICsgYm9va2luZ19pZCApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6IGVsX2lkICsgJ19zYXZlJ1xyXG5cdH0gKTtcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG5cclxuXHRqUXVlcnkoICcjJyArIGVsX2lkICsgJ19jYW5jZWwnKS5oaWRlKCk7XHJcblx0Ly93cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCBqUXVlcnkoICcjJyArIGVsX2lkICsgJ19jYW5jZWwnKS5nZXQoMCkgKTtcclxuXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX2Nsb3NlX19zZXRfcGF5bWVudF9zdGF0dXMoKXtcclxuXHQvLyBIaWRlIGFsbCBjaGFuZ2UgIHBheW1lbnQgc3RhdHVzIGZvciBib29raW5nXHJcblx0alF1ZXJ5KFwiLnVpX19zZXRfcGF5bWVudF9zdGF0dXNfX3NlY3Rpb25faW5fYm9va2luZ1wiKS5oaWRlKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBDaGFuZ2UgYm9va2luZyBjb3N0ICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X2Jvb2tpbmdfX3VpX2NsaWNrX3NhdmVfX3NldF9ib29raW5nX2Nvc3QoIGJvb2tpbmdfaWQsIHRoaXNfZWwsIGJvb2tpbmdfYWN0aW9uLCBlbF9pZCApe1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgOiBib29raW5nX2FjdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBib29raW5nX2lkLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Jvb2tpbmdfY29zdCcgXHRcdCAgIDogalF1ZXJ5KCAnI3VpX2J0bl9zZXRfYm9va2luZ19jb3N0JyArIGJvb2tpbmdfaWQgKyAnX2Nvc3QnKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiBlbF9pZCArICdfc2F2ZSdcclxuXHR9ICk7XHJcblxyXG5cdHdwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24oIHRoaXNfZWwgKTtcclxuXHJcblx0alF1ZXJ5KCAnIycgKyBlbF9pZCArICdfY2FuY2VsJykuaGlkZSgpO1xyXG5cdC8vd3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggalF1ZXJ5KCAnIycgKyBlbF9pZCArICdfY2FuY2VsJykuZ2V0KDApICk7XHJcblxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19jbG9zZV9fc2V0X2Jvb2tpbmdfY29zdCgpe1xyXG5cdC8vIEhpZGUgYWxsIGNoYW5nZSAgcGF5bWVudCBzdGF0dXMgZm9yIGJvb2tpbmdcclxuXHRqUXVlcnkoXCIudWlfX3NldF9ib29raW5nX2Nvc3RfX3NlY3Rpb25faW5fYm9va2luZ1wiKS5oaWRlKCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogICBTZW5kIFBheW1lbnQgcmVxdWVzdCAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fc2VuZF9wYXltZW50X3JlcXVlc3QoKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogJ3NlbmRfcGF5bWVudF9yZXF1ZXN0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2lkJyAgICAgICAgICAgOiBqUXVlcnkoICcjd3BiY19tb2RhbF9fcGF5bWVudF9yZXF1ZXN0X19ib29raW5nX2lkJykudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncmVhc29uX29mX2FjdGlvbicgXHQgICA6IGpRdWVyeSggJyN3cGJjX21vZGFsX19wYXltZW50X3JlcXVlc3RfX3JlYXNvbl9vZl9hY3Rpb24nKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnd3BiY19tb2RhbF9fcGF5bWVudF9yZXF1ZXN0X19idXR0b25fc2VuZCdcclxuXHR9ICk7XHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX3BheW1lbnRfcmVxdWVzdF9fYnV0dG9uX3NlbmQnICkuZ2V0KCAwICkgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEltcG9ydCBHb29nbGUgQ2FsZW5kYXIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuZnVuY3Rpb24gd3BiY19hanhfYm9va2luZ19fdWlfY2xpY2tfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXIoKXtcclxuXHJcblx0d3BiY19hanhfYm9va2luZ19hamF4X2FjdGlvbl9yZXF1ZXN0KCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19hY3Rpb24nICAgICAgIDogJ2ltcG9ydF9nb29nbGVfY2FsZW5kYXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6ICd3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19idXR0b25fc2VuZCdcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX2Zyb20nIDogXHRcdFx0XHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c19mcm9tIG9wdGlvbjpzZWxlY3RlZCcpLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX2Zyb21fb2Zmc2V0JyA6IFx0XHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c19mcm9tX29mZnNldCcgKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX2V2ZW50c19mcm9tX29mZnNldF90eXBlJyA6IFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfZnJvbV9vZmZzZXRfdHlwZSBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWwnIDogXHRcdFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWwgb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0JyA6IFx0XHRqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjYm9va2luZ19nY2FsX2V2ZW50c191bnRpbF9vZmZzZXQnICkudmFsKClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgJ2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0X3R5cGUnIDogalF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI2Jvb2tpbmdfZ2NhbF9ldmVudHNfdW50aWxfb2Zmc2V0X3R5cGUgb3B0aW9uOnNlbGVjdGVkJykudmFsKClcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsICdib29raW5nX2djYWxfZXZlbnRzX21heCcgOiBcdGpRdWVyeSggJyN3cGJjX21vZGFsX19pbXBvcnRfZ29vZ2xlX2NhbGVuZGFyX19zZWN0aW9uICNib29raW5nX2djYWxfZXZlbnRzX21heCcgKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAnYm9va2luZ19nY2FsX3Jlc291cmNlJyA6IFx0alF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2ltcG9ydF9nb29nbGVfY2FsZW5kYXJfX3NlY3Rpb24gI3dwYmNfYm9va2luZ19yZXNvdXJjZSBvcHRpb246c2VsZWN0ZWQnKS52YWwoKVxyXG5cdH0gKTtcclxuXHR3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKCBqUXVlcnkoICcjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fc2VjdGlvbiAjd3BiY19tb2RhbF9faW1wb3J0X2dvb2dsZV9jYWxlbmRhcl9fYnV0dG9uX3NlbmQnICkuZ2V0KCAwICkgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiAgIEV4cG9ydCBib29raW5ncyB0byBDU1YgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX191aV9jbGlja19fZXhwb3J0X2NzdiggcGFyYW1zICl7XHJcblxyXG5cdHZhciBzZWxlY3RlZF9ib29raW5nX2lkX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpO1xyXG5cclxuXHR3cGJjX2FqeF9ib29raW5nX2FqYXhfYWN0aW9uX3JlcXVlc3QoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdib29raW5nX2FjdGlvbicgICAgICAgIDogcGFyYW1zWyAnYm9va2luZ19hY3Rpb24nIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfY2xpY2tlZF9lbGVtZW50X2lkJyA6IHBhcmFtc1sgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZXhwb3J0X3R5cGUnICAgICAgICAgICA6IHBhcmFtc1sgJ2V4cG9ydF90eXBlJyBdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Nzdl9leHBvcnRfc2VwYXJhdG9yJyAgOiBwYXJhbXNbICdjc3ZfZXhwb3J0X3NlcGFyYXRvcicgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3ZfZXhwb3J0X3NraXBfZmllbGRzJzogcGFyYW1zWyAnY3N2X2V4cG9ydF9za2lwX2ZpZWxkcycgXSxcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnYm9va2luZ19pZCdcdDogc2VsZWN0ZWRfYm9va2luZ19pZF9hcnIuam9pbignLCcpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3NlYXJjaF9wYXJhbXMnIDogd3BiY19hanhfYm9va2luZ19saXN0aW5nLnNlYXJjaF9nZXRfYWxsX3BhcmFtcygpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHR2YXIgdGhpc19lbCA9IGpRdWVyeSggJyMnICsgcGFyYW1zWyAndWlfY2xpY2tlZF9lbGVtZW50X2lkJyBdICkuZ2V0KCAwIClcclxuXHJcblx0d3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbiggdGhpc19lbCApO1xyXG59XHJcblxyXG4vKipcclxuICogT3BlbiBVUkwgaW4gbmV3IHRhYiAtIG1haW5seSAgaXQncyB1c2VkIGZvciBvcGVuIENTViBsaW5rICBmb3IgZG93bmxvYWRlZCBleHBvcnRlZCBib29raW5ncyBhcyBDU1ZcclxuICpcclxuICogQHBhcmFtIGV4cG9ydF9jc3ZfdXJsXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX19leHBvcnRfY3N2X3VybF9fZG93bmxvYWQoIGV4cG9ydF9jc3ZfdXJsICl7XHJcblxyXG5cdC8vdmFyIHNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyID0gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCk7XHJcblxyXG5cdGRvY3VtZW50LmxvY2F0aW9uLmhyZWYgPSBleHBvcnRfY3N2X3VybDsvLyArICcmc2VsZWN0ZWRfaWQ9JyArIHNlbGVjdGVkX2Jvb2tpbmdfaWRfYXJyLmpvaW4oJywnKTtcclxuXHJcblx0Ly8gSXQncyBvcGVuIGFkZGl0aW9uYWwgZGlhbG9nIGZvciBhc2tpbmcgb3BlbmluZyB1bHIgaW4gbmV3IHRhYlxyXG5cdC8vIHdpbmRvdy5vcGVuKCBleHBvcnRfY3N2X3VybCwgJ19ibGFuaycpLmZvY3VzKCk7XHJcbn0iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBRVo7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUpBLFNBQUFBLFFBQUFDLENBQUEsc0NBQUFELE9BQUEsd0JBQUFFLE1BQUEsdUJBQUFBLE1BQUEsQ0FBQUMsUUFBQSxhQUFBRixDQUFBLGtCQUFBQSxDQUFBLGdCQUFBQSxDQUFBLFdBQUFBLENBQUEseUJBQUFDLE1BQUEsSUFBQUQsQ0FBQSxDQUFBRyxXQUFBLEtBQUFGLE1BQUEsSUFBQUQsQ0FBQSxLQUFBQyxNQUFBLENBQUFHLFNBQUEscUJBQUFKLENBQUEsS0FBQUQsT0FBQSxDQUFBQyxDQUFBO0FBS0EsU0FBU0ssb0NBQW9DQSxDQUFBLEVBQXFCO0VBQUEsSUFBbkJDLFlBQVksR0FBQUMsU0FBQSxDQUFBQyxNQUFBLFFBQUFELFNBQUEsUUFBQUUsU0FBQSxHQUFBRixTQUFBLE1BQUcsQ0FBQyxDQUFDO0VBRWhFRyxPQUFPLENBQUNDLGNBQWMsQ0FBRSwwQkFBMkIsQ0FBQztFQUFFRCxPQUFPLENBQUNFLEdBQUcsQ0FBRSxnQ0FBZ0MsRUFBRU4sWUFBYSxDQUFDO0VBQ25IOztFQUVDTyxrQ0FBa0MsQ0FBRSxFQUFHLENBQUM7RUFFeENDLDhDQUE4QyxDQUFDLENBQUM7O0VBRWhEO0VBQ0EsSUFBUUwsU0FBUyxJQUFJSCxZQUFZLENBQUUsWUFBWSxDQUFFLElBQVEsQ0FBRVMsS0FBSyxDQUFDQyxPQUFPLENBQUVWLFlBQVksQ0FBRSxZQUFZLENBQUcsQ0FBRyxFQUFFO0lBQUs7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
