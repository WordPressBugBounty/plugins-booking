"use strict";

/**
 * Parameters usually  defined in   Ajax Response or Front-End 	for  == _wpbc_settings.get_all_params__setup_wizard():
 *
 * In 	Front-End side as  JavaScript 		::		wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'calendar_days_selection', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );
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
// Example 2:  wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'calendar_days_selection', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );

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
  wpbc_scroll_to('.wpbc_page_top__header_tabs');
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
// ==  Steps Number Functions  ==
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
  var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps;
  var steps_finished = 1;
  _.each(params_arr, function (p_val, p_key, p_data) {
    if (p_val.is_done) {
      steps_finished++;
    }
  });
  return steps_finished;
}
function wpbc_setup_wizard_page__update_steps_status(steps_is_done_arr) {
  var params_arr = _wpbc_settings.get_all_params__setup_wizard().steps;
  _.each(steps_is_done_arr, function (p_val, p_key, p_data) {
    params_arr[p_key].is_done = true === steps_is_done_arr[p_key];
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

  // -----------------------------------------------------------------------------------------------------------------
}

//TODO: maybe relocate this functions in other utils js file ?

// =====================================================================================================================
// == Full Screen  -  support functions   ==
// =====================================================================================================================

/**
 * Check Full  screen mode,  by  removing top tab
 */
function wpbc_check_full_screen_mode() {
  if (jQuery('body').hasClass('wpbc_admin_full_screen')) {
    jQuery('html').removeClass('wp-toolbar');
  } else {
    jQuery('html').addClass('wp-toolbar');
  }
}
jQuery(document).ready(function () {
  wpbc_check_full_screen_mode();
});

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
function wpbc_setup_wizard_page__show_message(message) {
  var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX3Nob3cuanMiLCJuYW1lcyI6WyJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyIsInBhcmFtc19hcnIiLCJfd3BiY19zZXR0aW5ncyIsInNldF9wYXJhbXNfYXJyX19zZXR1cF93aXphcmQiLCJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCIsIndwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCIsIndwIiwidGVtcGxhdGUiLCJqUXVlcnkiLCJnZXRfcGFyYW1fX290aGVyIiwiaHRtbCIsImdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQiLCJwYXJlbnQiLCJoaWRlIiwid3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlIiwid3BiY19zY3JvbGxfdG8iLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19oaWRlX2NvbnRlbnQiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfcGx1Z2luX21lbnVfcHJvZ3Jlc3MiLCJwbHVnaW5fbWVudV9fc2V0dXBfcHJvZ3Jlc3NfX2h0bWwiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19nZXRfc3RlcHNfY291bnQiLCJzdGVwcyIsInN0ZXBzX2NvdW50IiwiXyIsImVhY2giLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X2FjdHVhbF9zdGVwX251bWJlciIsInN0ZXBzX2ZpbmlzaGVkIiwiaXNfZG9uZSIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMiLCJzdGVwc19pc19kb25lX2FyciIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQiLCJzdGF0dXMiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19kZWZpbmVfdWlfaG9va3MiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsInBhcmVudF9jc3NfY2xhc3MiLCJvbiIsImV2ZW50Iiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbiIsImluZGV4Iiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrIiwiaGFzQ2xhc3MiLCJyZW1vdmVDbGFzcyIsImFkZENsYXNzIiwiZG9jdW1lbnQiLCJyZWFkeSIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSIsIm1lc3NhZ2UiLCJwYXJhbXMiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJwYXJhbXNfZGVmYXVsdCIsInVuaXF1ZV9kaXZfaWQiLCJEYXRlIiwiZ2V0VGltZSIsImFsZXJ0X2NsYXNzIiwiYXBwZW5kIiwicGFyc2VJbnQiLCJjbG9zZWRfdGltZXIiLCJzZXRUaW1lb3V0IiwiZmFkZU91dCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9faXNfc3BpbiJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAvX3NyYy9zZXR1cF9zaG93LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIFBhcmFtZXRlcnMgdXN1YWxseSAgZGVmaW5lZCBpbiAgIEFqYXggUmVzcG9uc2Ugb3IgRnJvbnQtRW5kIFx0Zm9yICA9PSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCk6XHJcbiAqXHJcbiAqIEluIFx0RnJvbnQtRW5kIHNpZGUgYXMgIEphdmFTY3JpcHQgXHRcdDo6XHRcdHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fc2VuZF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7ICAnY3VycmVudF9zdGVwJzogJ2NhbGVuZGFyX2RheXNfc2VsZWN0aW9uJywgJ2RvX2FjdGlvbic6ICdub25lJywgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6ICdidG5fX3Rvb2xiYXJfX2J1dHRvbnNfcHJpb3InICB9ICk7XHJcbiAqXHJcbiAqIEFmdGVyIEFqYXggcmVzcG9uc2UgaW4gc2V0dXBfYWpheC5qcyAgYXMgOjpcdFx0X3dwYmNfc2V0dGluZ3Muc2V0X3BhcmFtc19hcnJfX3NldHVwX3dpemFyZCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09ICBTZXQgUmVxdWVzdCAgZm9yICBBamF4ICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBSZXF1ZXN0IFx0YWZ0ZXIgXHRVcGRhdGluZyBSZXF1ZXN0IFBhcmFtZXRlcnNcclxuICpcclxuICogQHBhcmFtIHBhcmFtc19hcnJcclxuICpcclxuICogXHRcdEV4YW1wbGUgMTpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuICogXHRcdEV4YW1wbGUgMjpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2N1cnJlbnRfc3RlcCc6ICd7e2RhdGEuc3RlcHNbIGRhdGEuY3VycmVudF9zdGVwIF0ucHJpb3J9fScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkb19hY3Rpb24nOiAnbm9uZScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnYnRuX190b29sYmFyX19idXR0b25zX3ByaW9yJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBQYXJhbXMgQXJyYXkgXHR0byBcdFJlcXVlc3RcclxuXHRfd3BiY19zZXR0aW5ncy5zZXRfcGFyYW1zX2Fycl9fc2V0dXBfd2l6YXJkKCBwYXJhbXNfYXJyICk7XHJcblxyXG5cdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHJcblx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3QoKTtcclxufVxyXG4vLyBFeGFtcGxlIDE6ICB3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAgJ3BhZ2VfbnVtJzogcGFnZV9udW1iZXIgIH0gKTtcclxuLy8gRXhhbXBsZSAyOiAgd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsgICdjdXJyZW50X3N0ZXAnOiAnY2FsZW5kYXJfZGF5c19zZWxlY3Rpb24nLCAnZG9fYWN0aW9uJzogJ25vbmUnLCAndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogJ2J0bl9fdG9vbGJhcl9fYnV0dG9uc19wcmlvcicgIH0gKTtcclxuXHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gU2hvdyAvIEhpZGUgIENvbnRlbnQgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8qKlxyXG4gKiBTaG93IE1haW4gQ29udGVudFx0Li4uXHRfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgIFx0LVx0bXVzdCAgYmUgZGVmaW5lZCFcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCgpIHtcclxuXHJcblx0dmFyIHdwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCA9IHdwLnRlbXBsYXRlKCAnd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50JyApO1xyXG5cclxuXHRqUXVlcnkoIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSApLmh0bWwoICAgd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50KCBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgKSAgICk7XHJcblxyXG5cdC8vIEhpZGUgJ1Byb2Nlc3NpbmcnIE5vdGljZVxyXG5cdGpRdWVyeSggJy53cGJjX3Byb2Nlc3Npbmcud3BiY19zcGluJykucGFyZW50KCkucGFyZW50KCkucGFyZW50KCkucGFyZW50KCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKS5oaWRlKCk7XHJcblxyXG5cdC8vdmFyIGhlYWRlcl9tZW51X3RleHQgPSAnIFN0ZXAgJyArIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9hY3R1YWxfc3RlcF9udW1iZXIoKSArICcgLyAnICsgd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X3N0ZXBzX2NvdW50KCk7XHJcblx0Ly9qUXVlcnkoICcud3BiY19oZWFkZXJfbWVudV90YWJzIC5uYXYtdGFiLWFjdGl2ZSAubmF2LXRhYi10ZXh0JykuaHRtbCggaGVhZGVyX21lbnVfdGV4dCApO1xyXG5cdC8vXHJcblx0Ly9qUXVlcnkoICcud3BiY19uYXZpZ2F0aW9uX21lbnVfbGVmdF9pdGVtICcgKS5yZW1vdmVDbGFzcyggJ3dwYmNfYWN0aXZlJyApO1xyXG5cdC8valF1ZXJ5KCAnIycgKyBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX3NldHVwX3dpemFyZCggJ2N1cnJlbnRfc3RlcCcgKSApLmFkZENsYXNzKCAnd3BiY19hY3RpdmUnICk7XHJcblxyXG5cdC8vIFJlY2hlY2sgRnVsbCBTY3JlZW4gIG1vZGUsICBieSAgcmVtb3ZpbmcgdG9wIHRhYlxyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG5cclxuXHQvLyBTY3JvbGwgdG8gdG9wXHJcblx0d3BiY19zY3JvbGxfdG8oICAnLndwYmNfcGFnZV90b3BfX2hlYWRlcl90YWJzJyApO1xyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBNYWluIENvbnRlbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2hpZGVfY29udGVudCgpe1xyXG5cclxuXHRqUXVlcnkoIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSApLmh0bWwoICAnJyApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFVwZGF0ZSBQbHVnaW4gIG1lbnUgcHJvZ3Jlc3MgICAtPiBQcm9ncmVzcyBsaW5lIGF0ICBcIkxlZnQgTWFpbiBNZW51XCJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9wbHVnaW5fbWVudV9wcm9ncmVzcyggcGx1Z2luX21lbnVfX3NldHVwX3Byb2dyZXNzX19odG1sICl7XHJcblx0aWYgKCAndW5kZWZpbmVkJyAhPSB0eXBlb2YgKHBsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzc19faHRtbCkgKXtcclxuXHRcdGpRdWVyeSggJy5zZXR1cF93aXphcmRfcGFnZV9jb250YWluZXInICkucGFyZW50KCkuaHRtbCggcGx1Z2luX21lbnVfX3NldHVwX3Byb2dyZXNzX19odG1sICk7XHJcblx0fVxyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gIFN0ZXBzIE51bWJlciBGdW5jdGlvbnMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X3N0ZXBzX2NvdW50KCkge1xyXG5cclxuXHR2YXIgcGFyYW1zX2FyciA9IF93cGJjX3NldHRpbmdzLmdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQoKS5zdGVwc1xyXG5cdHZhciBzdGVwc19jb3VudCA9IDBcclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRzdGVwc19jb3VudCsrO1xyXG5cdH0gKTtcclxuXHRyZXR1cm4gc3RlcHNfY291bnQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9hY3R1YWxfc3RlcF9udW1iZXIoKSB7XHJcblxyXG5cdHZhciBwYXJhbXNfYXJyID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpLnN0ZXBzXHJcblx0dmFyIHN0ZXBzX2ZpbmlzaGVkID0gMVxyXG5cdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApIHtcclxuXHRcdGlmICggcF92YWwuaXNfZG9uZSApe1xyXG5cdFx0XHRzdGVwc19maW5pc2hlZCsrO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHRyZXR1cm4gc3RlcHNfZmluaXNoZWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMoIHN0ZXBzX2lzX2RvbmVfYXJyICl7XHJcblxyXG5cdHZhciBwYXJhbXNfYXJyID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpLnN0ZXBzXHJcblxyXG5cdF8uZWFjaCggc3RlcHNfaXNfZG9uZV9hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblxyXG5cdFx0cGFyYW1zX2FyclsgcF9rZXkgXS5pc19kb25lID0gKCB0cnVlID09PSBzdGVwc19pc19kb25lX2FyclsgcF9rZXkgXSApO1xyXG5cdH0gKTtcclxuXHJcblx0cmV0dXJuIHBhcmFtc19hcnI7XHJcblxyXG59XHJcblxyXG5cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9faXNfYWxsX3N0ZXBzX2NvbXBsZXRlZCgpe1xyXG5cclxuXHR2YXIgcGFyYW1zX2FyciA9IF93cGJjX3NldHRpbmdzLmdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQoKS5zdGVwc1xyXG5cdHZhciBzdGF0dXMgPSB0cnVlO1xyXG5cclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRpZiAoICEgcF92YWwuaXNfZG9uZSApe1xyXG5cdFx0XHRzdGF0dXMgPSBmYWxzZTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBzdGF0dXM7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogRGVmaW5lIFVJIGhvb2tzIGZvciBlbGVtZW50cywgYWZ0ZXIgc2hvd2luZyBpbiBBamF4LlxyXG4gKlxyXG4gKiBCZWNhdXNlIGVhY2ggIHRpbWUsICB3aGVuICB3ZSBzaG93IGNvbnRlbnQgaW4gQWpheCwgYWxsIEhvb2tzIG5lZWRzIHJlLWRlZmluZWQuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19kZWZpbmVfdWlfaG9va3MoKXtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBUb29sdGlwc1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mKCB3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyApICkge1xyXG5cdFx0dmFyIHBhcmVudF9jc3NfY2xhc3MgPSAgX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19vdGhlciggJ2NvbnRhaW5lcl9fbWFpbl9jb250ZW50JyApICArICcgJ1xyXG5cdFx0d3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMoIHBhcmVudF9jc3NfY2xhc3MgKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ2hhbmdlIFJhZGlvIENvbnRhaW5lcnNcclxuXHRqUXVlcnkoICcud3BiY191aV9yYWRpb19jaG9pY2VfaW5wdXQnICkub24oICdjaGFuZ2UnLCBmdW5jdGlvbiggZXZlbnQgKXtcclxuXHJcblx0XHR3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uKCB0aGlzICk7XHJcblxyXG5cdFx0Ly93cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAgICdwYWdlX2l0ZW1zX2NvdW50JzogalF1ZXJ5KCB0aGlzICkudmFsKCksICAgJ3BhZ2VfbnVtJzogMSAgIH0gKTtcclxuXHR9ICk7XHJcblxyXG5cdGpRdWVyeSggJy53cGJjX3VpX3JhZGlvX2Nob2ljZV9pbnB1dCcgKS5lYWNoKGZ1bmN0aW9uIChpbmRleCApe1xyXG5cdFx0d3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbiggdGhpcyApO1xyXG5cdH0pO1xyXG5cclxuXHQvLyBEZWZpbmUgYWJpbGl0eSB0byBjbGljayBvbiBSYWRpbyBDb250YWluZXJzIChub3Qgb25seSByYWRpby1idXR0b25zKVxyXG5cdGpRdWVyeSggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcicgKS5vbiggJ2NsaWNrJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblx0XHR3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfY2xpY2soIHRoaXMgKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxufVxyXG5cclxuXHJcbi8vVE9ETzogbWF5YmUgcmVsb2NhdGUgdGhpcyBmdW5jdGlvbnMgaW4gb3RoZXIgdXRpbHMganMgZmlsZSA/XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gRnVsbCBTY3JlZW4gIC0gIHN1cHBvcnQgZnVuY3Rpb25zICAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogQ2hlY2sgRnVsbCAgc2NyZWVuIG1vZGUsICBieSAgcmVtb3ZpbmcgdG9wIHRhYlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlKCl7XHJcblx0aWYgKCBqUXVlcnkoICdib2R5JyApLmhhc0NsYXNzKCAnd3BiY19hZG1pbl9mdWxsX3NjcmVlbicgKSApIHtcclxuXHRcdGpRdWVyeSggJ2h0bWwnICkucmVtb3ZlQ2xhc3MoICd3cC10b29sYmFyJyApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICdodG1sJyApLmFkZENsYXNzKCAnd3AtdG9vbGJhcicgKTtcclxuXHR9XHJcbn1cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7XHJcblx0d3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlKCk7XHJcbn0gKTtcclxuXHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09ICBNIGUgcyBzIGEgZyBlICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTaG93IG1lc3NhZ2UgaW4gY29udGVudFxyXG4gKlxyXG4gKiBAcGFyYW0gbWVzc2FnZVx0XHRcdFx0TWVzc2FnZSBIVE1MXHJcbiAqIEBwYXJhbSBwYXJhbXMgPSB7XHJcbiAqICAgICAgICAgICAgICAgICAgIFsndHlwZSddXHRcdFx0XHQnd2FybmluZycgfCAnaW5mbycgfCAnZXJyb3InIHwgJ3N1Y2Nlc3MnXHRcdGRlZmF1bHQ6ICd3YXJuaW5nJ1xyXG4gKiAgICAgICAgICAgICAgICAgICBbJ2NvbnRhaW5lciddXHRcdFx0Jy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX2xlZnQnXHRcdGRlZmF1bHQ6IF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcpXHJcbiAqICAgICAgICAgICAgICAgICAgIFsnaXNfYXBwZW5kJ11cdFx0XHR0cnVlIHwgZmFsc2VcdFx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlXHJcbiAqXHRcdFx0XHQgICB9XHJcbiAqIEV4YW1wbGU6XHJcbiAqIFx0XHRcdHZhciBodG1sX2lkID0gd3BiY19zZXR1cF93aXphcmRfcGFnZV9fc2hvd19tZXNzYWdlKCAnWW91IGNhbiB0ZXN0IGRheXMgc2VsZWN0aW9uIGluIGNhbGVuZGFyJywgJ2luZm8nLCAnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fbGVmdCcsIHRydWUgKTtcclxuICpcclxuICpcclxuICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSggbWVzc2FnZSwgcGFyYW1zID0ge30gKXtcclxuXHJcblx0dmFyIHBhcmFtc19kZWZhdWx0ID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdjb250YWluZXInOiBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX290aGVyKCAnY29udGFpbmVyX19tYWluX2NvbnRlbnQnKSxcclxuXHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwXHJcblx0XHRcdFx0XHRcdFx0fTtcclxuXHRfLmVhY2goIHBhcmFtcywgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApe1xyXG5cdFx0cGFyYW1zX2RlZmF1bHRbIHBfa2V5IF0gPSBwX3ZhbDtcclxuXHR9ICk7XHJcblx0cGFyYW1zID0gcGFyYW1zX2RlZmF1bHQ7XHJcblxyXG4gICAgdmFyIHVuaXF1ZV9kaXZfaWQgPSBuZXcgRGF0ZSgpO1xyXG4gICAgdW5pcXVlX2Rpdl9pZCA9ICd3cGJjX25vdGljZV8nICsgdW5pcXVlX2Rpdl9pZC5nZXRUaW1lKCk7XHJcblxyXG5cdHZhciBhbGVydF9jbGFzcyA9ICdub3RpY2UgJztcclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdlcnJvcicgKXtcclxuXHRcdGFsZXJ0X2NsYXNzICs9ICdub3RpY2UtZXJyb3IgJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDAuNWVtO2NvbG9yOiAjZDYzNjM4O1wiIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fcmVwb3J0X2dtYWlsZXJyb3JyZWRcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ3dhcm5pbmcnICl7XHJcblx0XHRhbGVydF9jbGFzcyArPSAnbm90aWNlLXdhcm5pbmcgJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDAuNWVtO2NvbG9yOiAjZTlhYTA0O1wiIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fd2FybmluZ1wiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnaW5mbycgKXtcclxuXHRcdGFsZXJ0X2NsYXNzICs9ICdub3RpY2UtaW5mbyAnO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdzdWNjZXNzJyApe1xyXG5cdFx0YWxlcnRfY2xhc3MgKz0gJ25vdGljZS1pbmZvIGFsZXJ0LXN1Y2Nlc3MgdXBkYXRlZCAnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBzdHlsZT1cIm1hcmdpbi1yaWdodDogMC41ZW07Y29sb3I6ICM2NGFhNDU7XCIgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9kb25lX291dGxpbmVcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cclxuXHRtZXNzYWdlID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdcIiBjbGFzcz1cIndwYmMtc2V0dGluZ3Mtbm90aWNlICcgKyBhbGVydF9jbGFzcyArICdcIiBzdHlsZT1cIicgKyBwYXJhbXNbICdzdHlsZScgXSArICdcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nO1xyXG5cclxuXHRpZiAoIHBhcmFtc1snaXNfYXBwZW5kJ10gKXtcclxuXHRcdGpRdWVyeSggcGFyYW1zWydjb250YWluZXInXSApLmFwcGVuZCggbWVzc2FnZSApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoIHBhcmFtc1snY29udGFpbmVyJ10gKS5odG1sKCBtZXNzYWdlICk7XHJcblx0fVxyXG5cclxuXHRwYXJhbXNbJ2RlbGF5J10gPSBwYXJzZUludCggcGFyYW1zWydkZWxheSddICk7XHJcblx0aWYgKCBwYXJhbXNbJ2RlbGF5J10gPiAwICl7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLmZhZGVPdXQoIDE1MDAgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIHBhcmFtc1sgJ2RlbGF5JyBdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKTtcclxuXHR9XHJcblx0cmV0dXJuIHVuaXF1ZV9kaXZfaWQ7XHJcbn1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIFRvcCBCYXIgTWVudSAtPiAnICBJbml0aWFsIFNldHVwJyAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIFN0YXJ0XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKXtcclxuXHRyZXR1cm4gZmFsc2U7IC8vIEN1cnJlbnRseSAgZGlzYWJsZWQsICBtYXliZSBhY3RpdmF0ZSBpdCBmb3Igc29tZSBvdGhlciBlbGVtZW50LlxyXG5cdGpRdWVyeSggJyN3cGJjX2luaXRpYWxfc2V0dXBfdG9wX21lbnVfaXRlbSAubWVudV9pY29uLndwYmNfc3BpbicpLnJlbW92ZUNsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgUGF1c2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSgpe1xyXG5cdGpRdWVyeSggJyN3cGJjX2luaXRpYWxfc2V0dXBfdG9wX21lbnVfaXRlbSAubWVudV9pY29uLndwYmNfc3BpbicgKS5hZGRDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIGlzIFNwaW5uaW5nID9cclxuICpcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX2lzX3NwaW4oKXtcclxuICAgIGlmICggalF1ZXJ5KCAnI3dwYmNfaW5pdGlhbF9zZXR1cF90b3BfbWVudV9pdGVtIC5tZW51X2ljb24ud3BiY19zcGluJyApLmhhc0NsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICkgKXtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG59XHJcbiJdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWTs7QUFFWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0EscURBQXFEQSxDQUFHQyxVQUFVLEVBQUU7RUFFNUU7RUFDQUMsY0FBYyxDQUFDQyw0QkFBNEIsQ0FBRUYsVUFBVyxDQUFDOztFQUV6RDtFQUNBRyx5Q0FBeUMsQ0FBQyxDQUFDO0FBQzVDO0FBQ0E7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyxvQ0FBb0NBLENBQUEsRUFBRztFQUUvQyxJQUFJQyxvQ0FBb0MsR0FBR0MsRUFBRSxDQUFDQyxRQUFRLENBQUUsc0NB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
