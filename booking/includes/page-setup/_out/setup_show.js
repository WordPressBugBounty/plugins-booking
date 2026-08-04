"use strict";

/**
 * Parameters usually  defined in   Ajax Response or Front-End 	for  == _wpbc_settings.get_all_params__setup_wizard():
 *
 * In 	Front-End side as  JavaScript 		::		wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'date_availability', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );
 *
 * After Ajax response in setup_ajax.js  as ::		_wpbc_settings.set_params_arr__setup_wizard( response_data[ 'ajx_data' ] );
 *
 */

// =====================================================================================================================
// ==  Set Request  for  Ajax  ==
// =====================================================================================================================
/**
 * Send Ajax Request 	after 	Updating Request Parameters
 *
 * @param params_arr
 *
 * 		Example 1:
 *
 * 			wpbc_ajx__setup_wizard_page__send_request_with_params( {
 *											'page_num': page_number
 *										} );
 * 		Example 2:
 *
 * 			wpbc_ajx__setup_wizard_page__send_request_with_params( {
 *											'current_step': '{{data.steps[ data.current_step ].prior}}',
 *											'do_action': 'none',
 *											'ui_clicked_element_id': 'btn__toolbar__buttons_prior'
 *										} );
 *
 */
function wpbc_ajx__setup_wizard_page__send_request_with_params(params_arr) {
  // Define Params Array 	to 	Request
  _wpbc_settings.set_params_arr__setup_wizard(params_arr);

  // Send Ajax Request
  wpbc_ajx__setup_wizard_page__send_request();
}
// Example 1:  wpbc_ajx__setup_wizard_page__send_request_with_params( {  'page_num': page_number  } );
// Example 2:  wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'date_availability', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );

// =====================================================================================================================
// == Show / Hide  Content ==
// =====================================================================================================================
/**
 * Show Main Content	...	_wpbc_settings.get_all_params__setup_wizard()  	-	must  be defined!
 */
function wpbc_setup_wizard_page__show_content() {
  var wpbc_template__stp_wiz__main_content = wp.template('wpbc_template__stp_wiz__main_content');
  jQuery(_wpbc_settings.get_param__other('container__main_content')).html(wpbc_template__stp_wiz__main_content(_wpbc_settings.get_all_params__setup_wizard()));

  // Hide 'Processing' Notice
  jQuery('.wpbc_processing.wpbc_spin').parent().parent().parent().parent('[id^="wpbc_notice_"]').hide();

  //var header_menu_text = ' Step ' + wpbc_setup_wizard_page__get_actual_step_number() + ' / ' + wpbc_setup_wizard_page__get_steps_count();
  //jQuery( '.wpbc_header_menu_tabs .nav-tab-active .nav-tab-text').html( header_menu_text );
  //
  //jQuery( '.wpbc_navigation_menu_left_item ' ).removeClass( 'wpbc_active' );
  //jQuery( '#' + _wpbc_settings.get_param__setup_wizard( 'current_step' ) ).addClass( 'wpbc_active' );

  // Recheck Full Screen  mode,  by  removing top tab
  wpbc_check_full_screen_mode();

  // Scroll to top
  // wpbc_scroll_to(  '.wpbc_page_top__header_tabs' );
  wpbc_scroll_to('.wpbc__container_place__steps_for_timeline');
}

/**
 * Hide Main Content
 */
function wpbc_setup_wizard_page__hide_content() {
  jQuery(_wpbc_settings.get_param__other('container__main_content')).html('');
}

/**
 * Update Plugin  menu progress   -> Progress line at  "Left Main Menu"
 */
function wpbc_setup_wizard_page__update_plugin_menu_progress(plugin_menu__setup_progress__html) {
  if ('undefined' != typeof plugin_menu__setup_progress__html) {
    jQuery('.setup_wizard_page_container').parent().html(plugin_menu__setup_progress__html);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// ==  Steps Number Functions ==
// 					Gets data in   			_wpbc_settings.get_all_params__setup_wizard().steps
// 					which  defined in   	setup_ajax.php     															Ajax
// 					as 						$data_arr ['steps'] =  new WPBC_SETUP_WIZARD_STEPS();  $this->get_steps_arr();  			from 		setup_steps.php		structure.
// ---------------------------------------------------------------------------------------------------------------------

function wpbc_setup_wizard_page__get_steps_count() {
  var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps;
  var steps_count = 0;
  _.each(params_arr, function (p_val, p_key, p_data) {
    steps_count++;
  });
  return steps_count;
}
function wpbc_setup_wizard_page__get_actual_step_number() {
  var setup_params = _wpbc_settings.get_all_params__setup_wizard();
  var params_arr = setup_params.steps;
  var current_step = setup_params.current_step;
  var step_number = 1;
  var found_step = false;
  _.each(params_arr, function (p_val, p_key, p_data) {
    if (p_key === current_step) {
      found_step = true;
      return false;
    }
    step_number++;
  });
  return found_step ? step_number : 1;
}
function wpbc_setup_wizard_page__update_steps_status(steps_is_done_arr) {
  var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps;
  _.each(steps_is_done_arr, function (p_val, p_key, p_data) {
    if ("undefined" !== typeof params_arr[p_key]) {
      params_arr[p_key].is_done = true === steps_is_done_arr[p_key];
    }
  });
  return params_arr;
}
function wpbc_setup_wizard_page__is_all_steps_completed() {
  var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps;
  var status = true;
  _.each(params_arr, function (p_val, p_key, p_data) {
    if (!p_val.is_done) {
      status = false;
    }
  });
  return status;
}

/**
 * Show the configuration controls belonging to the selected booking behavior.
 *
 * @return {void}
 */
function wpbc_setup_wizard_page__refresh_booking_type_details() {
  var booking_type = jQuery('[name="wpbc_swp_booking_types"]:checked').val() || '';
  var fixed_appointment_type = jQuery('[name="wpbc_swp_booking_mode"]:checked').closest('.wpbc_setup_mode_choice').attr('data-wpbc-setup-fixed-appointment-type') || '';
  var is_fixed_appointment_mode = 'durationtime' === fixed_appointment_type;
  var $canonical_times_picker = jQuery('[name="wpbc_swp_booking_timeslot_picker"]');
  var $appointment_times_picker = jQuery('[name="wpbc_swp_booking_timeslot_picker_appointment"]');
  jQuery('.wpbc_in_radio_container_selectbox').hide();
  jQuery('.wpbc_setup_appointment_mode_configuration').hide();
  if (is_fixed_appointment_mode) {
    if ($canonical_times_picker.length && $appointment_times_picker.length) {
      $appointment_times_picker.val($canonical_times_picker.val());
    }
    jQuery('.wpbc_setup_appointment_mode_configuration').show();
  } else if ('time_slots_appointments' === booking_type) {
    jQuery('.wpbc_ui_booking_timeslot_picker__get_on_off__div').show();
  } else if ('changeover_multi_dates_bookings' === booking_type) {
    jQuery('.wpbc_ui_booking_change_over__get_on_off__div').show();
  }
}

/**
 * Apply the selected presentation mode to the Step 4 behavior choices.
 *
 * The presentation mode and booking behavior are intentionally independent
 * values. This function limits the visible behaviors to valid combinations
 * without coupling mode switching to any QuickStart content mutation.
 *
 * @return {void}
 */
function wpbc_setup_wizard_page__refresh_booking_mode_choices() {
  var $mode_input = jQuery('[name="wpbc_swp_booking_mode"]:checked').first();
  var $mode_choice;
  var allowed_booking_types;
  var default_booking_type;
  var fixed_appointment_type;
  var is_fixed_appointment_mode;
  var $selected_booking_type;
  if (!$mode_input.length) {
    $mode_input = jQuery('[name="wpbc_swp_booking_mode"]').first().prop('checked', true);
  }
  $mode_choice = $mode_input.closest('.wpbc_setup_mode_choice');
  if (!$mode_choice.length) {
    wpbc_setup_wizard_page__refresh_booking_type_details();
    return;
  }
  allowed_booking_types = String($mode_choice.attr('data-wpbc-setup-booking-types') || '').split(',');
  default_booking_type = String($mode_choice.attr('data-wpbc-setup-default-booking-type') || '');
  fixed_appointment_type = String($mode_choice.attr('data-wpbc-setup-fixed-appointment-type') || '');
  is_fixed_appointment_mode = 'durationtime' === fixed_appointment_type;
  jQuery('.wpbc_setup_preferences_heading').text($mode_choice.attr('data-wpbc-setup-preference-title') || '');
  jQuery('.wpbc_setup_booking_type_choice').each(function () {
    var booking_type = String(jQuery(this).attr('data-wpbc-setup-booking-type') || '');
    jQuery(this).toggle(-1 !== jQuery.inArray(booking_type, allowed_booking_types));
  });
  $selected_booking_type = jQuery('[name="wpbc_swp_booking_types"]:checked');
  if (!$selected_booking_type.length || -1 === jQuery.inArray(String($selected_booking_type.val() || ''), allowed_booking_types) || $selected_booking_type.is(':disabled')) {
    $selected_booking_type = jQuery('[name="wpbc_swp_booking_types"][value="' + default_booking_type + '"]:not(:disabled)').first();
    if (!$selected_booking_type.length) {
      $selected_booking_type = jQuery('.wpbc_setup_booking_type_choice:visible [name="wpbc_swp_booking_types"]:not(:disabled)').first();
    }
    $selected_booking_type.prop('checked', true);
  }
  if (is_fixed_appointment_mode) {
    jQuery('[name="wpbc_swp_booking_appointments_type"][value="' + fixed_appointment_type + '"]').prop('checked', true);
  }
  jQuery('.wpbc_setup_preferences_heading_row').toggle(!is_fixed_appointment_mode);
  jQuery('.wpbc_setup_booking_type_choices').toggle(!is_fixed_appointment_mode);
  jQuery('[name="wpbc_swp_booking_mode"], [name="wpbc_swp_booking_types"]').each(function () {
    wpbc_ui_el__radio_container_selection(this);
  });
  wpbc_setup_wizard_page__refresh_booking_type_details();
}

/**
 * Define UI hooks for elements, after showing in Ajax.
 *
 * Because each  time,  when  we show content in Ajax, all Hooks needs re-defined.
 */
function wpbc_setup_wizard_page__define_ui_hooks() {
  // -----------------------------------------------------------------------------------------------------------------
  // Tooltips
  if ('function' === typeof wpbc_define_tippy_tooltips) {
    var parent_css_class = _wpbc_settings.get_param__other('container__main_content') + ' ';
    wpbc_define_tippy_tooltips(parent_css_class);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Change Radio Containers
  jQuery('.wpbc_ui_radio_choice_input').on('change', function (event) {
    wpbc_ui_el__radio_container_selection(this);

    //wpbc_ajx__setup_wizard_page__send_request_with_params( {   'page_items_count': jQuery( this ).val(),   'page_num': 1   } );
  });
  jQuery('.wpbc_ui_radio_choice_input').each(function (index) {
    wpbc_ui_el__radio_container_selection(this);
  });

  // Define ability to click on Radio Containers (not only radio-buttons)
  jQuery('.wpbc_ui_radio_container').on('click', function (event) {
    wpbc_ui_el__radio_container_click(this);
  });
  jQuery('[name="wpbc_swp_booking_mode"]').on('change', function () {
    wpbc_setup_wizard_page__refresh_booking_mode_choices();
  });
  jQuery('[name="wpbc_swp_booking_types"]').on('change', function () {
    wpbc_setup_wizard_page__refresh_booking_type_details();
  });

  // Save the Appointment-only presentation control through the historical canonical field.
  jQuery('[name="wpbc_swp_booking_timeslot_picker_appointment"]').on('change', function () {
    jQuery('[name="wpbc_swp_booking_timeslot_picker"]').val(jQuery(this).val());
  });
  wpbc_setup_wizard_page__refresh_booking_mode_choices();

  // -----------------------------------------------------------------------------------------------------------------
}

// ---------------------------------------------------------------------------------------------------------------------
// ==  M e s s a g e  ==
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Show message in content
 *
 * @param message				Message HTML
 * @param params = {
 *                   ['type']				'warning' | 'info' | 'error' | 'success'		default: 'warning'
 *                   ['container']			'.wpbc_ajx_cstm__section_left'		default: _wpbc_settings.get_param__other( 'container__main_content')
 *                   ['is_append']			true | false						default: true
 *				   }
 * Example:
 * 			var html_id = wpbc_setup_wizard_page__show_message( 'You can test days selection in calendar', 'info', '.wpbc_ajx_cstm__section_left', true );
 *
 *
 * @returns string  - HTML ID
 */
function wpbc_setup_wizard_page__show_message(message, params = {}) {
  var params_default = {
    'type': 'warning',
    'container': _wpbc_settings.get_param__other('container__main_content'),
    'is_append': true,
    'style': 'text-align:left;',
    'delay': 0
  };
  _.each(params, function (p_val, p_key, p_data) {
    params_default[p_key] = p_val;
  });
  params = params_default;
  var unique_div_id = new Date();
  unique_div_id = 'wpbc_notice_' + unique_div_id.getTime();
  var alert_class = 'notice ';
  if (params['type'] == 'error') {
    alert_class += 'notice-error ';
    message = '<i style="margin-right: 0.5em;color: #d63638;" class="menu_icon icon-1x wpbc_icn_report_gmailerrorred"></i>' + message;
  }
  if (params['type'] == 'warning') {
    alert_class += 'notice-warning ';
    message = '<i style="margin-right: 0.5em;color: #e9aa04;" class="menu_icon icon-1x wpbc_icn_warning"></i>' + message;
  }
  if (params['type'] == 'info') {
    alert_class += 'notice-info ';
  }
  if (params['type'] == 'success') {
    alert_class += 'notice-info alert-success updated ';
    message = '<i style="margin-right: 0.5em;color: #64aa45;" class="menu_icon icon-1x wpbc_icn_done_outline"></i>' + message;
  }
  message = '<div id="' + unique_div_id + '" class="wpbc-settings-notice ' + alert_class + '" style="' + params['style'] + '">' + message + '</div>';
  if (params['is_append']) {
    jQuery(params['container']).append(message);
  } else {
    jQuery(params['container']).html(message);
  }
  params['delay'] = parseInt(params['delay']);
  if (params['delay'] > 0) {
    var closed_timer = setTimeout(function () {
      jQuery('#' + unique_div_id).fadeOut(1500);
    }, params['delay']);
  }
  return unique_div_id;
}

// ---------------------------------------------------------------------------------------------------------------------
// ==  Support Functions - Spin Icon in Top Bar Menu -> '  Initial Setup'  ==
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Spin button in Filter toolbar  -  Start
 */
function wpbc_setup_wizard_page_reload_button__spin_start() {
  return false; // Currently  disabled,  maybe activate it for some other element.
  jQuery('#wpbc_initial_setup_top_menu_item .menu_icon.wpbc_spin').removeClass('wpbc_animation_pause');
}

/**
 * Spin button in Filter toolbar  -  Pause
 */
function wpbc_setup_wizard_page_reload_button__spin_pause() {
  jQuery('#wpbc_initial_setup_top_menu_item .menu_icon.wpbc_spin').addClass('wpbc_animation_pause');
}

/**
 * Spin button in Filter toolbar  -  is Spinning ?
 *
 * @returns {boolean}
 */
function wpbc_setup_wizard_page_reload_button__is_spin() {
  if (jQuery('#wpbc_initial_setup_top_menu_item .menu_icon.wpbc_spin').hasClass('wpbc_animation_pause')) {
    return true;
  } else {
    return false;
  }
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX3Nob3cuanMiLCJuYW1lcyI6WyJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyIsInBhcmFtc19hcnIiLCJfd3BiY19zZXR0aW5ncyIsInNldF9wYXJhbXNfYXJyX19zZXR1cF93aXphcmQiLCJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCIsIndwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCIsIndwIiwidGVtcGxhdGUiLCJqUXVlcnkiLCJnZXRfcGFyYW1fX290aGVyIiwiaHRtbCIsImdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQiLCJwYXJlbnQiLCJoaWRlIiwid3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlIiwid3BiY19zY3JvbGxfdG8iLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19oaWRlX2NvbnRlbnQiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfcGx1Z2luX21lbnVfcHJvZ3Jlc3MiLCJwbHVnaW5fbWVudV9fc2V0dXBfcHJvZ3Jlc3NfX2h0bWwiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19nZXRfc3RlcHNfY291bnQiLCJzdGVwcyIsInN0ZXBzX2NvdW50IiwiXyIsImVhY2giLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X2FjdHVhbF9zdGVwX251bWJlciIsInNldHVwX3BhcmFtcyIsImN1cnJlbnRfc3RlcCIsInN0ZXBfbnVtYmVyIiwiZm91bmRfc3RlcCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMiLCJzdGVwc19pc19kb25lX2FyciIsImlzX2RvbmUiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19pc19hbGxfc3RlcHNfY29tcGxldGVkIiwic3RhdHVzIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fcmVmcmVzaF9ib29raW5nX3R5cGVfZGV0YWlscyIsImJvb2tpbmdfdHlwZSIsInZhbCIsImZpeGVkX2FwcG9pbnRtZW50X3R5cGUiLCJjbG9zZXN0IiwiYXR0ciIsImlzX2ZpeGVkX2FwcG9pbnRtZW50X21vZGUiLCIkY2Fub25pY2FsX3RpbWVzX3BpY2tlciIsIiRhcHBvaW50bWVudF90aW1lc19waWNrZXIiLCJsZW5ndGgiLCJzaG93Iiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fcmVmcmVzaF9ib29raW5nX21vZGVfY2hvaWNlcyIsIiRtb2RlX2lucHV0IiwiZmlyc3QiLCIkbW9kZV9jaG9pY2UiLCJhbGxvd2VkX2Jvb2tpbmdfdHlwZXMiLCJkZWZhdWx0X2Jvb2tpbmdfdHlwZSIsIiRzZWxlY3RlZF9ib29raW5nX3R5cGUiLCJwcm9wIiwiU3RyaW5nIiwic3BsaXQiLCJ0ZXh0IiwidG9nZ2xlIiwiaW5BcnJheSIsImlzIiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbiIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2RlZmluZV91aV9ob29rcyIsIndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzIiwicGFyZW50X2Nzc19jbGFzcyIsIm9uIiwiZXZlbnQiLCJpbmRleCIsIndwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9jbGljayIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSIsIm1lc3NhZ2UiLCJwYXJhbXMiLCJwYXJhbXNfZGVmYXVsdCIsInVuaXF1ZV9kaXZfaWQiLCJEYXRlIiwiZ2V0VGltZSIsImFsZXJ0X2NsYXNzIiwiYXBwZW5kIiwicGFyc2VJbnQiLCJjbG9zZWRfdGltZXIiLCJzZXRUaW1lb3V0IiwiZmFkZU91dCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsInJlbW92ZUNsYXNzIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwiYWRkQ2xhc3MiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX2lzX3NwaW4iLCJoYXNDbGFzcyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAvX3NyYy9zZXR1cF9zaG93LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIFBhcmFtZXRlcnMgdXN1YWxseSAgZGVmaW5lZCBpbiAgIEFqYXggUmVzcG9uc2Ugb3IgRnJvbnQtRW5kIFx0Zm9yICA9PSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCk6XHJcbiAqXHJcbiAqIEluIFx0RnJvbnQtRW5kIHNpZGUgYXMgIEphdmFTY3JpcHQgXHRcdDo6XHRcdHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fc2VuZF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7ICAnY3VycmVudF9zdGVwJzogJ2RhdGVfYXZhaWxhYmlsaXR5JywgJ2RvX2FjdGlvbic6ICdub25lJywgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6ICdidG5fX3Rvb2xiYXJfX2J1dHRvbnNfcHJpb3InICB9ICk7XHJcbiAqXHJcbiAqIEFmdGVyIEFqYXggcmVzcG9uc2UgaW4gc2V0dXBfYWpheC5qcyAgYXMgOjpcdFx0X3dwYmNfc2V0dGluZ3Muc2V0X3BhcmFtc19hcnJfX3NldHVwX3dpemFyZCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09ICBTZXQgUmVxdWVzdCAgZm9yICBBamF4ICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBSZXF1ZXN0IFx0YWZ0ZXIgXHRVcGRhdGluZyBSZXF1ZXN0IFBhcmFtZXRlcnNcclxuICpcclxuICogQHBhcmFtIHBhcmFtc19hcnJcclxuICpcclxuICogXHRcdEV4YW1wbGUgMTpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuICogXHRcdEV4YW1wbGUgMjpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2N1cnJlbnRfc3RlcCc6ICd7e2RhdGEuc3RlcHNbIGRhdGEuY3VycmVudF9zdGVwIF0ucHJpb3J9fScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkb19hY3Rpb24nOiAnbm9uZScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnYnRuX190b29sYmFyX19idXR0b25zX3ByaW9yJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBQYXJhbXMgQXJyYXkgXHR0byBcdFJlcXVlc3RcclxuXHRfd3BiY19zZXR0aW5ncy5zZXRfcGFyYW1zX2Fycl9fc2V0dXBfd2l6YXJkKCBwYXJhbXNfYXJyICk7XHJcblxyXG5cdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHJcblx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3QoKTtcclxufVxyXG4vLyBFeGFtcGxlIDE6ICB3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAgJ3BhZ2VfbnVtJzogcGFnZV9udW1iZXIgIH0gKTtcclxuLy8gRXhhbXBsZSAyOiAgd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsgICdjdXJyZW50X3N0ZXAnOiAnZGF0ZV9hdmFpbGFiaWxpdHknLCAnZG9fYWN0aW9uJzogJ25vbmUnLCAndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogJ2J0bl9fdG9vbGJhcl9fYnV0dG9uc19wcmlvcicgIH0gKTtcclxuXHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gU2hvdyAvIEhpZGUgIENvbnRlbnQgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8qKlxyXG4gKiBTaG93IE1haW4gQ29udGVudFx0Li4uXHRfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgIFx0LVx0bXVzdCAgYmUgZGVmaW5lZCFcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCgpIHtcclxuXHJcblx0dmFyIHdwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCA9IHdwLnRlbXBsYXRlKCAnd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50JyApO1xyXG5cclxuXHRqUXVlcnkoIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSApLmh0bWwoICAgd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50KCBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgKSAgICk7XHJcblxyXG5cdC8vIEhpZGUgJ1Byb2Nlc3NpbmcnIE5vdGljZVxyXG5cdGpRdWVyeSggJy53cGJjX3Byb2Nlc3Npbmcud3BiY19zcGluJykucGFyZW50KCkucGFyZW50KCkucGFyZW50KCkucGFyZW50KCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKS5oaWRlKCk7XHJcblxyXG5cdC8vdmFyIGhlYWRlcl9tZW51X3RleHQgPSAnIFN0ZXAgJyArIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9hY3R1YWxfc3RlcF9udW1iZXIoKSArICcgLyAnICsgd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X3N0ZXBzX2NvdW50KCk7XHJcblx0Ly9qUXVlcnkoICcud3BiY19oZWFkZXJfbWVudV90YWJzIC5uYXYtdGFiLWFjdGl2ZSAubmF2LXRhYi10ZXh0JykuaHRtbCggaGVhZGVyX21lbnVfdGV4dCApO1xyXG5cdC8vXHJcblx0Ly9qUXVlcnkoICcud3BiY19uYXZpZ2F0aW9uX21lbnVfbGVmdF9pdGVtICcgKS5yZW1vdmVDbGFzcyggJ3dwYmNfYWN0aXZlJyApO1xyXG5cdC8valF1ZXJ5KCAnIycgKyBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX3NldHVwX3dpemFyZCggJ2N1cnJlbnRfc3RlcCcgKSApLmFkZENsYXNzKCAnd3BiY19hY3RpdmUnICk7XHJcblxyXG5cdC8vIFJlY2hlY2sgRnVsbCBTY3JlZW4gIG1vZGUsICBieSAgcmVtb3ZpbmcgdG9wIHRhYlxyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG5cclxuXHQvLyBTY3JvbGwgdG8gdG9wXHJcblx0Ly8gd3BiY19zY3JvbGxfdG8oICAnLndwYmNfcGFnZV90b3BfX2hlYWRlcl90YWJzJyApO1xyXG5cdHdwYmNfc2Nyb2xsX3RvKCAgJy53cGJjX19jb250YWluZXJfcGxhY2VfX3N0ZXBzX2Zvcl90aW1lbGluZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgTWFpbiBDb250ZW50XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19oaWRlX2NvbnRlbnQoKXtcclxuXHJcblx0alF1ZXJ5KCBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX290aGVyKCAnY29udGFpbmVyX19tYWluX2NvbnRlbnQnICkgKS5odG1sKCAgJycgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBVcGRhdGUgUGx1Z2luICBtZW51IHByb2dyZXNzICAgLT4gUHJvZ3Jlc3MgbGluZSBhdCAgXCJMZWZ0IE1haW4gTWVudVwiXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfcGx1Z2luX21lbnVfcHJvZ3Jlc3MoIHBsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzc19faHRtbCApe1xyXG5cdGlmICggJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIChwbHVnaW5fbWVudV9fc2V0dXBfcHJvZ3Jlc3NfX2h0bWwpICl7XHJcblx0XHRqUXVlcnkoICcuc2V0dXBfd2l6YXJkX3BhZ2VfY29udGFpbmVyJyApLnBhcmVudCgpLmh0bWwoIHBsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzc19faHRtbCApO1xyXG5cdH1cclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09ICBTdGVwcyBOdW1iZXIgRnVuY3Rpb25zID09XHJcbi8vIFx0XHRcdFx0XHRHZXRzIGRhdGEgaW4gICBcdFx0XHRfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkuc3RlcHNcclxuLy8gXHRcdFx0XHRcdHdoaWNoICBkZWZpbmVkIGluICAgXHRzZXR1cF9hamF4LnBocCAgICAgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0QWpheFxyXG4vLyBcdFx0XHRcdFx0YXMgXHRcdFx0XHRcdFx0JGRhdGFfYXJyIFsnc3RlcHMnXSA9ICBuZXcgV1BCQ19TRVRVUF9XSVpBUkRfU1RFUFMoKTsgICR0aGlzLT5nZXRfc3RlcHNfYXJyKCk7ICBcdFx0XHRmcm9tIFx0XHRzZXR1cF9zdGVwcy5waHBcdFx0c3RydWN0dXJlLlxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9zdGVwc19jb3VudCgpIHtcclxuXHJcblx0dmFyIHBhcmFtc19hcnIgPSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkuc3RlcHNcclxuXHR2YXIgc3RlcHNfY291bnQgPSAwXHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0c3RlcHNfY291bnQrKztcclxuXHR9ICk7XHJcblx0cmV0dXJuIHN0ZXBzX2NvdW50O1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19nZXRfYWN0dWFsX3N0ZXBfbnVtYmVyKCkge1xyXG5cclxuXHR2YXIgc2V0dXBfcGFyYW1zID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpO1xyXG5cdHZhciBwYXJhbXNfYXJyICAgPSBzZXR1cF9wYXJhbXMuc3RlcHM7XHJcblx0dmFyIGN1cnJlbnRfc3RlcCA9IHNldHVwX3BhcmFtcy5jdXJyZW50X3N0ZXA7XHJcblx0dmFyIHN0ZXBfbnVtYmVyICA9IDE7XHJcblx0dmFyIGZvdW5kX3N0ZXAgICA9IGZhbHNlO1xyXG5cclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRpZiAoIHBfa2V5ID09PSBjdXJyZW50X3N0ZXAgKSB7XHJcblx0XHRcdGZvdW5kX3N0ZXAgPSB0cnVlO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRzdGVwX251bWJlcisrO1xyXG5cdH0gKTtcclxuXHJcblx0cmV0dXJuIGZvdW5kX3N0ZXAgPyBzdGVwX251bWJlciA6IDE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMoIHN0ZXBzX2lzX2RvbmVfYXJyICl7XHJcblxyXG5cdHZhciBwYXJhbXNfYXJyID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpLnN0ZXBzXHJcblxyXG5cdF8uZWFjaCggc3RlcHNfaXNfZG9uZV9hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRpZiAoIFwidW5kZWZpbmVkXCIgIT09IHR5cGVvZiAoIHBhcmFtc19hcnJbIHBfa2V5IF0gKSApIHtcclxuXHRcdFx0cGFyYW1zX2FyclsgcF9rZXkgXS5pc19kb25lID0gKHRydWUgPT09IHN0ZXBzX2lzX2RvbmVfYXJyWyBwX2tleSBdKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBwYXJhbXNfYXJyO1xyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQoKXtcblxyXG5cdHZhciBwYXJhbXNfYXJyID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpLnN0ZXBzXHJcblx0dmFyIHN0YXR1cyA9IHRydWU7XHJcblxyXG5cdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApIHtcclxuXHRcdGlmICggISBwX3ZhbC5pc19kb25lICl7XHJcblx0XHRcdHN0YXR1cyA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0cmV0dXJuIHN0YXR1cztcclxufVxuXG4vKipcbiAqIFNob3cgdGhlIGNvbmZpZ3VyYXRpb24gY29udHJvbHMgYmVsb25naW5nIHRvIHRoZSBzZWxlY3RlZCBib29raW5nIGJlaGF2aW9yLlxuICpcbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3JlZnJlc2hfYm9va2luZ190eXBlX2RldGFpbHMoKSB7XG5cblx0dmFyIGJvb2tpbmdfdHlwZSAgICAgICAgICAgPSBqUXVlcnkoICdbbmFtZT1cIndwYmNfc3dwX2Jvb2tpbmdfdHlwZXNcIl06Y2hlY2tlZCcgKS52YWwoKSB8fCAnJztcblx0dmFyIGZpeGVkX2FwcG9pbnRtZW50X3R5cGUgPSBqUXVlcnkoICdbbmFtZT1cIndwYmNfc3dwX2Jvb2tpbmdfbW9kZVwiXTpjaGVja2VkJyApXG5cdFx0LmNsb3Nlc3QoICcud3BiY19zZXR1cF9tb2RlX2Nob2ljZScgKVxuXHRcdC5hdHRyKCAnZGF0YS13cGJjLXNldHVwLWZpeGVkLWFwcG9pbnRtZW50LXR5cGUnICkgfHwgJyc7XG5cdHZhciBpc19maXhlZF9hcHBvaW50bWVudF9tb2RlID0gJ2R1cmF0aW9udGltZScgPT09IGZpeGVkX2FwcG9pbnRtZW50X3R5cGU7XG5cdHZhciAkY2Fub25pY2FsX3RpbWVzX3BpY2tlciAgID0galF1ZXJ5KCAnW25hbWU9XCJ3cGJjX3N3cF9ib29raW5nX3RpbWVzbG90X3BpY2tlclwiXScgKTtcblx0dmFyICRhcHBvaW50bWVudF90aW1lc19waWNrZXIgPSBqUXVlcnkoICdbbmFtZT1cIndwYmNfc3dwX2Jvb2tpbmdfdGltZXNsb3RfcGlja2VyX2FwcG9pbnRtZW50XCJdJyApO1xuXG5cdGpRdWVyeSggJy53cGJjX2luX3JhZGlvX2NvbnRhaW5lcl9zZWxlY3Rib3gnICkuaGlkZSgpO1xuXHRqUXVlcnkoICcud3BiY19zZXR1cF9hcHBvaW50bWVudF9tb2RlX2NvbmZpZ3VyYXRpb24nICkuaGlkZSgpO1xuXG5cdGlmICggaXNfZml4ZWRfYXBwb2ludG1lbnRfbW9kZSApIHtcblx0XHRpZiAoICRjYW5vbmljYWxfdGltZXNfcGlja2VyLmxlbmd0aCAmJiAkYXBwb2ludG1lbnRfdGltZXNfcGlja2VyLmxlbmd0aCApIHtcblx0XHRcdCRhcHBvaW50bWVudF90aW1lc19waWNrZXIudmFsKCAkY2Fub25pY2FsX3RpbWVzX3BpY2tlci52YWwoKSApO1xuXHRcdH1cblx0XHRqUXVlcnkoICcud3BiY19zZXR1cF9hcHBvaW50bWVudF9tb2RlX2NvbmZpZ3VyYXRpb24nICkuc2hvdygpO1xuXHR9IGVsc2UgaWYgKCAndGltZV9zbG90c19hcHBvaW50bWVudHMnID09PSBib29raW5nX3R5cGUgKSB7XG5cdFx0alF1ZXJ5KCAnLndwYmNfdWlfYm9va2luZ190aW1lc2xvdF9waWNrZXJfX2dldF9vbl9vZmZfX2RpdicgKS5zaG93KCk7XG5cdH0gZWxzZSBpZiAoICdjaGFuZ2VvdmVyX211bHRpX2RhdGVzX2Jvb2tpbmdzJyA9PT0gYm9va2luZ190eXBlICkge1xuXHRcdGpRdWVyeSggJy53cGJjX3VpX2Jvb2tpbmdfY2hhbmdlX292ZXJfX2dldF9vbl9vZmZfX2RpdicgKS5zaG93KCk7XG5cdH1cbn1cblxuLyoqXG4gKiBBcHBseSB0aGUgc2VsZWN0ZWQgcHJlc2VudGF0aW9uIG1vZGUgdG8gdGhlIFN0ZXAgNCBiZWhhdmlvciBjaG9pY2VzLlxuICpcbiAqIFRoZSBwcmVzZW50YXRpb24gbW9kZSBhbmQgYm9va2luZyBiZWhhdmlvciBhcmUgaW50ZW50aW9uYWxseSBpbmRlcGVuZGVudFxuICogdmFsdWVzLiBUaGlzIGZ1bmN0aW9uIGxpbWl0cyB0aGUgdmlzaWJsZSBiZWhhdmlvcnMgdG8gdmFsaWQgY29tYmluYXRpb25zXG4gKiB3aXRob3V0IGNvdXBsaW5nIG1vZGUgc3dpdGNoaW5nIHRvIGFueSBRdWlja1N0YXJ0IGNvbnRlbnQgbXV0YXRpb24uXG4gKlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9fcmVmcmVzaF9ib29raW5nX21vZGVfY2hvaWNlcygpIHtcblxuXHR2YXIgJG1vZGVfaW5wdXQgPSBqUXVlcnkoICdbbmFtZT1cIndwYmNfc3dwX2Jvb2tpbmdfbW9kZVwiXTpjaGVja2VkJyApLmZpcnN0KCk7XG5cdHZhciAkbW9kZV9jaG9pY2U7XG5cdHZhciBhbGxvd2VkX2Jvb2tpbmdfdHlwZXM7XG5cdHZhciBkZWZhdWx0X2Jvb2tpbmdfdHlwZTtcblx0dmFyIGZpeGVkX2FwcG9pbnRtZW50X3R5cGU7XG5cdHZhciBpc19maXhlZF9hcHBvaW50bWVudF9tb2RlO1xuXHR2YXIgJHNlbGVjdGVkX2Jvb2tpbmdfdHlwZTtcblxuXHRpZiAoICEgJG1vZGVfaW5wdXQubGVuZ3RoICkge1xuXHRcdCRtb2RlX2lucHV0ID0galF1ZXJ5KCAnW25hbWU9XCJ3cGJjX3N3cF9ib29raW5nX21vZGVcIl0nICkuZmlyc3QoKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcblx0fVxuXG5cdCRtb2RlX2Nob2ljZSA9ICRtb2RlX2lucHV0LmNsb3Nlc3QoICcud3BiY19zZXR1cF9tb2RlX2Nob2ljZScgKTtcblx0aWYgKCAhICRtb2RlX2Nob2ljZS5sZW5ndGggKSB7XG5cdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9fcmVmcmVzaF9ib29raW5nX3R5cGVfZGV0YWlscygpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGFsbG93ZWRfYm9va2luZ190eXBlcyA9IFN0cmluZyggJG1vZGVfY2hvaWNlLmF0dHIoICdkYXRhLXdwYmMtc2V0dXAtYm9va2luZy10eXBlcycgKSB8fCAnJyApLnNwbGl0KCAnLCcgKTtcblx0ZGVmYXVsdF9ib29raW5nX3R5cGUgPSBTdHJpbmcoICRtb2RlX2Nob2ljZS5hdHRyKCAnZGF0YS13cGJjLXNldHVwLWRlZmF1bHQtYm9va2luZy10eXBlJyApIHx8ICcnICk7XG5cdGZpeGVkX2FwcG9pbnRtZW50X3R5cGUgPSBTdHJpbmcoICRtb2RlX2Nob2ljZS5hdHRyKCAnZGF0YS13cGJjLXNldHVwLWZpeGVkLWFwcG9pbnRtZW50LXR5cGUnICkgfHwgJycgKTtcblx0aXNfZml4ZWRfYXBwb2ludG1lbnRfbW9kZSA9ICdkdXJhdGlvbnRpbWUnID09PSBmaXhlZF9hcHBvaW50bWVudF90eXBlO1xuXG5cdGpRdWVyeSggJy53cGJjX3NldHVwX3ByZWZlcmVuY2VzX2hlYWRpbmcnICkudGV4dCggJG1vZGVfY2hvaWNlLmF0dHIoICdkYXRhLXdwYmMtc2V0dXAtcHJlZmVyZW5jZS10aXRsZScgKSB8fCAnJyApO1xuXHRqUXVlcnkoICcud3BiY19zZXR1cF9ib29raW5nX3R5cGVfY2hvaWNlJyApLmVhY2goIGZ1bmN0aW9uKCkge1xuXHRcdHZhciBib29raW5nX3R5cGUgPSBTdHJpbmcoIGpRdWVyeSggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtc2V0dXAtYm9va2luZy10eXBlJyApIHx8ICcnICk7XG5cdFx0alF1ZXJ5KCB0aGlzICkudG9nZ2xlKCAtMSAhPT0galF1ZXJ5LmluQXJyYXkoIGJvb2tpbmdfdHlwZSwgYWxsb3dlZF9ib29raW5nX3R5cGVzICkgKTtcblx0fSApO1xuXG5cdCRzZWxlY3RlZF9ib29raW5nX3R5cGUgPSBqUXVlcnkoICdbbmFtZT1cIndwYmNfc3dwX2Jvb2tpbmdfdHlwZXNcIl06Y2hlY2tlZCcgKTtcblx0aWYgKFxuXHRcdCEgJHNlbGVjdGVkX2Jvb2tpbmdfdHlwZS5sZW5ndGhcblx0XHR8fCAtMSA9PT0galF1ZXJ5LmluQXJyYXkoIFN0cmluZyggJHNlbGVjdGVkX2Jvb2tpbmdfdHlwZS52YWwoKSB8fCAnJyApLCBhbGxvd2VkX2Jvb2tpbmdfdHlwZXMgKVxuXHRcdHx8ICRzZWxlY3RlZF9ib29raW5nX3R5cGUuaXMoICc6ZGlzYWJsZWQnIClcblx0KSB7XG5cdFx0JHNlbGVjdGVkX2Jvb2tpbmdfdHlwZSA9IGpRdWVyeSggJ1tuYW1lPVwid3BiY19zd3BfYm9va2luZ190eXBlc1wiXVt2YWx1ZT1cIicgKyBkZWZhdWx0X2Jvb2tpbmdfdHlwZSArICdcIl06bm90KDpkaXNhYmxlZCknICkuZmlyc3QoKTtcblx0XHRpZiAoICEgJHNlbGVjdGVkX2Jvb2tpbmdfdHlwZS5sZW5ndGggKSB7XG5cdFx0XHQkc2VsZWN0ZWRfYm9va2luZ190eXBlID0galF1ZXJ5KCAnLndwYmNfc2V0dXBfYm9va2luZ190eXBlX2Nob2ljZTp2aXNpYmxlIFtuYW1lPVwid3BiY19zd3BfYm9va2luZ190eXBlc1wiXTpub3QoOmRpc2FibGVkKScgKS5maXJzdCgpO1xuXHRcdH1cblx0XHQkc2VsZWN0ZWRfYm9va2luZ190eXBlLnByb3AoICdjaGVja2VkJywgdHJ1ZSApO1xuXHR9XG5cblx0aWYgKCBpc19maXhlZF9hcHBvaW50bWVudF9tb2RlICkge1xuXHRcdGpRdWVyeSggJ1tuYW1lPVwid3BiY19zd3BfYm9va2luZ19hcHBvaW50bWVudHNfdHlwZVwiXVt2YWx1ZT1cIicgKyBmaXhlZF9hcHBvaW50bWVudF90eXBlICsgJ1wiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcblx0fVxuXG5cdGpRdWVyeSggJy53cGJjX3NldHVwX3ByZWZlcmVuY2VzX2hlYWRpbmdfcm93JyApLnRvZ2dsZSggISBpc19maXhlZF9hcHBvaW50bWVudF9tb2RlICk7XG5cdGpRdWVyeSggJy53cGJjX3NldHVwX2Jvb2tpbmdfdHlwZV9jaG9pY2VzJyApLnRvZ2dsZSggISBpc19maXhlZF9hcHBvaW50bWVudF9tb2RlICk7XG5cblx0alF1ZXJ5KCAnW25hbWU9XCJ3cGJjX3N3cF9ib29raW5nX21vZGVcIl0sIFtuYW1lPVwid3BiY19zd3BfYm9va2luZ190eXBlc1wiXScgKS5lYWNoKCBmdW5jdGlvbigpIHtcblx0XHR3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uKCB0aGlzICk7XG5cdH0gKTtcblxuXHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19yZWZyZXNoX2Jvb2tpbmdfdHlwZV9kZXRhaWxzKCk7XG59XG5cclxuXHJcbi8qKlxyXG4gKiBEZWZpbmUgVUkgaG9va3MgZm9yIGVsZW1lbnRzLCBhZnRlciBzaG93aW5nIGluIEFqYXguXHJcbiAqXHJcbiAqIEJlY2F1c2UgZWFjaCAgdGltZSwgIHdoZW4gIHdlIHNob3cgY29udGVudCBpbiBBamF4LCBhbGwgSG9va3MgbmVlZHMgcmUtZGVmaW5lZC5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2RlZmluZV91aV9ob29rcygpe1xuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBUb29sdGlwc1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mKCB3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyApICkge1xyXG5cdFx0dmFyIHBhcmVudF9jc3NfY2xhc3MgPSAgX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19vdGhlciggJ2NvbnRhaW5lcl9fbWFpbl9jb250ZW50JyApICArICcgJ1xyXG5cdFx0d3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMoIHBhcmVudF9jc3NfY2xhc3MgKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ2hhbmdlIFJhZGlvIENvbnRhaW5lcnNcclxuXHRqUXVlcnkoICcud3BiY191aV9yYWRpb19jaG9pY2VfaW5wdXQnICkub24oICdjaGFuZ2UnLCBmdW5jdGlvbiggZXZlbnQgKXtcclxuXHJcblx0XHR3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uKCB0aGlzICk7XHJcblxyXG5cdFx0Ly93cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAgICdwYWdlX2l0ZW1zX2NvdW50JzogalF1ZXJ5KCB0aGlzICkudmFsKCksICAgJ3BhZ2VfbnVtJzogMSAgIH0gKTtcclxuXHR9ICk7XHJcblxyXG5cdGpRdWVyeSggJy53cGJjX3VpX3JhZGlvX2Nob2ljZV9pbnB1dCcgKS5lYWNoKGZ1bmN0aW9uIChpbmRleCApe1xyXG5cdFx0d3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbiggdGhpcyApO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBEZWZpbmUgYWJpbGl0eSB0byBjbGljayBvbiBSYWRpbyBDb250YWluZXJzIChub3Qgb25seSByYWRpby1idXR0b25zKVxyXG5cdGpRdWVyeSggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5vbiggJ2NsaWNrJywgZnVuY3Rpb24oIGV2ZW50ICl7XG5cdFx0d3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrKCB0aGlzICk7XG5cdH0gKTtcblxuXHRqUXVlcnkoICdbbmFtZT1cIndwYmNfc3dwX2Jvb2tpbmdfbW9kZVwiXScgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3JlZnJlc2hfYm9va2luZ19tb2RlX2Nob2ljZXMoKTtcblx0fSApO1xuXG5cdGpRdWVyeSggJ1tuYW1lPVwid3BiY19zd3BfYm9va2luZ190eXBlc1wiXScgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3JlZnJlc2hfYm9va2luZ190eXBlX2RldGFpbHMoKTtcblx0fSApO1xuXG5cdC8vIFNhdmUgdGhlIEFwcG9pbnRtZW50LW9ubHkgcHJlc2VudGF0aW9uIGNvbnRyb2wgdGhyb3VnaCB0aGUgaGlzdG9yaWNhbCBjYW5vbmljYWwgZmllbGQuXG5cdGpRdWVyeSggJ1tuYW1lPVwid3BiY19zd3BfYm9va2luZ190aW1lc2xvdF9waWNrZXJfYXBwb2ludG1lbnRcIl0nICkub24oICdjaGFuZ2UnLCBmdW5jdGlvbigpIHtcblx0XHRqUXVlcnkoICdbbmFtZT1cIndwYmNfc3dwX2Jvb2tpbmdfdGltZXNsb3RfcGlja2VyXCJdJyApLnZhbCggalF1ZXJ5KCB0aGlzICkudmFsKCkgKTtcblx0fSApO1xuXG5cdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3JlZnJlc2hfYm9va2luZ19tb2RlX2Nob2ljZXMoKTtcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSAgTSBlIHMgcyBhIGcgZSAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2hvdyBtZXNzYWdlIGluIGNvbnRlbnRcclxuICpcclxuICogQHBhcmFtIG1lc3NhZ2VcdFx0XHRcdE1lc3NhZ2UgSFRNTFxyXG4gKiBAcGFyYW0gcGFyYW1zID0ge1xyXG4gKiAgICAgICAgICAgICAgICAgICBbJ3R5cGUnXVx0XHRcdFx0J3dhcm5pbmcnIHwgJ2luZm8nIHwgJ2Vycm9yJyB8ICdzdWNjZXNzJ1x0XHRkZWZhdWx0OiAnd2FybmluZydcclxuICogICAgICAgICAgICAgICAgICAgWydjb250YWluZXInXVx0XHRcdCcud3BiY19hanhfY3N0bV9fc2VjdGlvbl9sZWZ0J1x0XHRkZWZhdWx0OiBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX290aGVyKCAnY29udGFpbmVyX19tYWluX2NvbnRlbnQnKVxyXG4gKiAgICAgICAgICAgICAgICAgICBbJ2lzX2FwcGVuZCddXHRcdFx0dHJ1ZSB8IGZhbHNlXHRcdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxyXG4gKlx0XHRcdFx0ICAgfVxyXG4gKiBFeGFtcGxlOlxyXG4gKiBcdFx0XHR2YXIgaHRtbF9pZCA9IHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSggJ1lvdSBjYW4gdGVzdCBkYXlzIHNlbGVjdGlvbiBpbiBjYWxlbmRhcicsICdpbmZvJywgJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX2xlZnQnLCB0cnVlICk7XHJcbiAqXHJcbiAqXHJcbiAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHBhcmFtcyA9IHt9ICl7XHJcblxyXG5cdHZhciBwYXJhbXNfZGVmYXVsdCA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHQnY29udGFpbmVyJzogX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19vdGhlciggJ2NvbnRhaW5lcl9fbWFpbl9jb250ZW50JyksXHJcblx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHJcblx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0Xy5lYWNoKCBwYXJhbXMsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKXtcclxuXHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcF92YWw7XHJcblx0fSApO1xyXG5cdHBhcmFtcyA9IHBhcmFtc19kZWZhdWx0O1xyXG5cclxuICAgIHZhciB1bmlxdWVfZGl2X2lkID0gbmV3IERhdGUoKTtcclxuICAgIHVuaXF1ZV9kaXZfaWQgPSAnd3BiY19ub3RpY2VfJyArIHVuaXF1ZV9kaXZfaWQuZ2V0VGltZSgpO1xyXG5cclxuXHR2YXIgYWxlcnRfY2xhc3MgPSAnbm90aWNlICc7XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnZXJyb3InICl7XHJcblx0XHRhbGVydF9jbGFzcyArPSAnbm90aWNlLWVycm9yICc7XHJcblx0XHRtZXNzYWdlID0gJzxpIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAwLjVlbTtjb2xvcjogI2Q2MzYzODtcIiBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JlcG9ydF9nbWFpbGVycm9ycmVkXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICd3YXJuaW5nJyApe1xyXG5cdFx0YWxlcnRfY2xhc3MgKz0gJ25vdGljZS13YXJuaW5nICc7XHJcblx0XHRtZXNzYWdlID0gJzxpIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAwLjVlbTtjb2xvcjogI2U5YWEwNDtcIiBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3dhcm5pbmdcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ2luZm8nICl7XHJcblx0XHRhbGVydF9jbGFzcyArPSAnbm90aWNlLWluZm8gJztcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnc3VjY2VzcycgKXtcclxuXHRcdGFsZXJ0X2NsYXNzICs9ICdub3RpY2UtaW5mbyBhbGVydC1zdWNjZXNzIHVwZGF0ZWQgJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDAuNWVtO2NvbG9yOiAjNjRhYTQ1O1wiIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fZG9uZV9vdXRsaW5lXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHJcblx0bWVzc2FnZSA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSAnICsgYWxlcnRfY2xhc3MgKyAnXCIgc3R5bGU9XCInICsgcGFyYW1zWyAnc3R5bGUnIF0gKyAnXCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JztcclxuXHJcblx0aWYgKCBwYXJhbXNbJ2lzX2FwcGVuZCddICl7XHJcblx0XHRqUXVlcnkoIHBhcmFtc1snY29udGFpbmVyJ10gKS5hcHBlbmQoIG1lc3NhZ2UgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCBwYXJhbXNbJ2NvbnRhaW5lciddICkuaHRtbCggbWVzc2FnZSApO1xyXG5cdH1cclxuXHJcblx0cGFyYW1zWydkZWxheSddID0gcGFyc2VJbnQoIHBhcmFtc1snZGVsYXknXSApO1xyXG5cdGlmICggcGFyYW1zWydkZWxheSddID4gMCApe1xyXG5cclxuXHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRqUXVlcnkoICcjJyArIHVuaXF1ZV9kaXZfaWQgKS5mYWRlT3V0KCAxNTAwICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBwYXJhbXNbICdkZWxheScgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICk7XHJcblx0fVxyXG5cdHJldHVybiB1bmlxdWVfZGl2X2lkO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09ICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBUb3AgQmFyIE1lbnUgLT4gJyAgSW5pdGlhbCBTZXR1cCcgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBTdGFydFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCl7XHJcblx0cmV0dXJuIGZhbHNlOyAvLyBDdXJyZW50bHkgIGRpc2FibGVkLCAgbWF5YmUgYWN0aXZhdGUgaXQgZm9yIHNvbWUgb3RoZXIgZWxlbWVudC5cclxuXHRqUXVlcnkoICcjd3BiY19pbml0aWFsX3NldHVwX3RvcF9tZW51X2l0ZW0gLm1lbnVfaWNvbi53cGJjX3NwaW4nKS5yZW1vdmVDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIFBhdXNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKXtcclxuXHRqUXVlcnkoICcjd3BiY19pbml0aWFsX3NldHVwX3RvcF9tZW51X2l0ZW0gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuYWRkQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBpcyBTcGlubmluZyA/XHJcbiAqXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19pc19zcGluKCl7XHJcbiAgICBpZiAoIGpRdWVyeSggJyN3cGJjX2luaXRpYWxfc2V0dXBfdG9wX21lbnVfaXRlbSAubWVudV9pY29uLndwYmNfc3BpbicgKS5oYXNDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApICl7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG4iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBRVo7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLHFEQUFxREEsQ0FBR0MsVUFBVSxFQUFFO0VBRTVFO0VBQ0FDLGNBQWMsQ0FBQ0MsNEJBQTRCLENBQUVGLFVBQVcsQ0FBQzs7RUFFekQ7RUFDQUcseUNBQXlDLENBQUMsQ0FBQztBQUM1QztBQUNBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0Msb0NBQW9DQSxDQUFBLEVBQUc7RUFFL0MsSUFBSUMsb0NBQW9DLEdBQUdDLEVBQUUsQ0FBQ0MsUUFBUSxDQUFFLHNDQUF1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
