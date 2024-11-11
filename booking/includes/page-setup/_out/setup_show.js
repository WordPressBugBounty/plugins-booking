"use strict";

/**
 * Parameters usually  defined in   Ajax Response or Front-End 	for  == _wpbc_settings.get_all_params__setup_wizard():
 *
 * In 	Front-End side as  JavaScript 		::		wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'optional_other_settings', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );
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
// Example 2:  wpbc_ajx__setup_wizard_page__send_request_with_params( {  'current_step': 'optional_other_settings', 'do_action': 'none', 'ui_clicked_element_id': 'btn__toolbar__buttons_prior'  } );

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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX3Nob3cuanMiLCJuYW1lcyI6WyJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyIsInBhcmFtc19hcnIiLCJfd3BiY19zZXR0aW5ncyIsInNldF9wYXJhbXNfYXJyX19zZXR1cF93aXphcmQiLCJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCIsIndwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCIsIndwIiwidGVtcGxhdGUiLCJqUXVlcnkiLCJnZXRfcGFyYW1fX290aGVyIiwiaHRtbCIsImdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQiLCJwYXJlbnQiLCJoaWRlIiwid3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlIiwid3BiY19zY3JvbGxfdG8iLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19oaWRlX2NvbnRlbnQiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfcGx1Z2luX21lbnVfcHJvZ3Jlc3MiLCJwbHVnaW5fbWVudV9fc2V0dXBfcHJvZ3Jlc3NfX2h0bWwiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19nZXRfc3RlcHNfY291bnQiLCJzdGVwcyIsInN0ZXBzX2NvdW50IiwiXyIsImVhY2giLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X2FjdHVhbF9zdGVwX251bWJlciIsInN0ZXBzX2ZpbmlzaGVkIiwiaXNfZG9uZSIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMiLCJzdGVwc19pc19kb25lX2FyciIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQiLCJzdGF0dXMiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19kZWZpbmVfdWlfaG9va3MiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsInBhcmVudF9jc3NfY2xhc3MiLCJvbiIsImV2ZW50Iiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbiIsImluZGV4Iiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrIiwiaGFzQ2xhc3MiLCJyZW1vdmVDbGFzcyIsImFkZENsYXNzIiwiZG9jdW1lbnQiLCJyZWFkeSIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSIsIm1lc3NhZ2UiLCJwYXJhbXMiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJwYXJhbXNfZGVmYXVsdCIsInVuaXF1ZV9kaXZfaWQiLCJEYXRlIiwiZ2V0VGltZSIsImFsZXJ0X2NsYXNzIiwiYXBwZW5kIiwicGFyc2VJbnQiLCJjbG9zZWRfdGltZXIiLCJzZXRUaW1lb3V0IiwiZmFkZU91dCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9faXNfc3BpbiJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAvX3NyYy9zZXR1cF9zaG93LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIFBhcmFtZXRlcnMgdXN1YWxseSAgZGVmaW5lZCBpbiAgIEFqYXggUmVzcG9uc2Ugb3IgRnJvbnQtRW5kIFx0Zm9yICA9PSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCk6XHJcbiAqXHJcbiAqIEluIFx0RnJvbnQtRW5kIHNpZGUgYXMgIEphdmFTY3JpcHQgXHRcdDo6XHRcdHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fc2VuZF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7ICAnY3VycmVudF9zdGVwJzogJ29wdGlvbmFsX290aGVyX3NldHRpbmdzJywgJ2RvX2FjdGlvbic6ICdub25lJywgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6ICdidG5fX3Rvb2xiYXJfX2J1dHRvbnNfcHJpb3InICB9ICk7XHJcbiAqXHJcbiAqIEFmdGVyIEFqYXggcmVzcG9uc2UgaW4gc2V0dXBfYWpheC5qcyAgYXMgOjpcdFx0X3dwYmNfc2V0dGluZ3Muc2V0X3BhcmFtc19hcnJfX3NldHVwX3dpemFyZCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09ICBTZXQgUmVxdWVzdCAgZm9yICBBamF4ICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBSZXF1ZXN0IFx0YWZ0ZXIgXHRVcGRhdGluZyBSZXF1ZXN0IFBhcmFtZXRlcnNcclxuICpcclxuICogQHBhcmFtIHBhcmFtc19hcnJcclxuICpcclxuICogXHRcdEV4YW1wbGUgMTpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuICogXHRcdEV4YW1wbGUgMjpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2N1cnJlbnRfc3RlcCc6ICd7e2RhdGEuc3RlcHNbIGRhdGEuY3VycmVudF9zdGVwIF0ucHJpb3J9fScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkb19hY3Rpb24nOiAnbm9uZScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnYnRuX190b29sYmFyX19idXR0b25zX3ByaW9yJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBQYXJhbXMgQXJyYXkgXHR0byBcdFJlcXVlc3RcclxuXHRfd3BiY19zZXR0aW5ncy5zZXRfcGFyYW1zX2Fycl9fc2V0dXBfd2l6YXJkKCBwYXJhbXNfYXJyICk7XHJcblxyXG5cdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHJcblx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3QoKTtcclxufVxyXG4vLyBFeGFtcGxlIDE6ICB3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAgJ3BhZ2VfbnVtJzogcGFnZV9udW1iZXIgIH0gKTtcclxuLy8gRXhhbXBsZSAyOiAgd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsgICdjdXJyZW50X3N0ZXAnOiAnb3B0aW9uYWxfb3RoZXJfc2V0dGluZ3MnLCAnZG9fYWN0aW9uJzogJ25vbmUnLCAndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogJ2J0bl9fdG9vbGJhcl9fYnV0dG9uc19wcmlvcicgIH0gKTtcclxuXHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gU2hvdyAvIEhpZGUgIENvbnRlbnQgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8qKlxyXG4gKiBTaG93IE1haW4gQ29udGVudFx0Li4uXHRfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgIFx0LVx0bXVzdCAgYmUgZGVmaW5lZCFcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCgpIHtcclxuXHJcblx0dmFyIHdwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCA9IHdwLnRlbXBsYXRlKCAnd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50JyApO1xyXG5cclxuXHRqUXVlcnkoIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSApLmh0bWwoICAgd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50KCBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgKSAgICk7XHJcblxyXG5cdC8vIEhpZGUgJ1Byb2Nlc3NpbmcnIE5vdGljZVxyXG5cdGpRdWVyeSggJy53cGJjX3Byb2Nlc3Npbmcud3BiY19zcGluJykucGFyZW50KCkucGFyZW50KCkucGFyZW50KCkucGFyZW50KCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKS5oaWRlKCk7XHJcblxyXG5cdC8vdmFyIGhlYWRlcl9tZW51X3RleHQgPSAnIFN0ZXAgJyArIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9hY3R1YWxfc3RlcF9udW1iZXIoKSArICcgLyAnICsgd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X3N0ZXBzX2NvdW50KCk7XHJcblx0Ly9qUXVlcnkoICcud3BiY19oZWFkZXJfbWVudV90YWJzIC5uYXYtdGFiLWFjdGl2ZSAubmF2LXRhYi10ZXh0JykuaHRtbCggaGVhZGVyX21lbnVfdGV4dCApO1xyXG5cdC8vXHJcblx0Ly9qUXVlcnkoICcud3BiY19uYXZpZ2F0aW9uX21lbnVfbGVmdF9pdGVtICcgKS5yZW1vdmVDbGFzcyggJ3dwYmNfYWN0aXZlJyApO1xyXG5cdC8valF1ZXJ5KCAnIycgKyBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX3NldHVwX3dpemFyZCggJ2N1cnJlbnRfc3RlcCcgKSApLmFkZENsYXNzKCAnd3BiY19hY3RpdmUnICk7XHJcblxyXG5cdC8vIFJlY2hlY2sgRnVsbCBTY3JlZW4gIG1vZGUsICBieSAgcmVtb3ZpbmcgdG9wIHRhYlxyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG5cclxuXHQvLyBTY3JvbGwgdG8gdG9wXHJcblx0d3BiY19zY3JvbGxfdG8oICAnLndwYmNfcGFnZV90b3BfX2hlYWRlcl90YWJzJyApO1xyXG59XHJcblxyXG4vKipcclxuICogSGlkZSBNYWluIENvbnRlbnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2hpZGVfY29udGVudCgpe1xyXG5cclxuXHRqUXVlcnkoIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSApLmh0bWwoICAnJyApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFVwZGF0ZSBQbHVnaW4gIG1lbnUgcHJvZ3Jlc3MgICAtPiBQcm9ncmVzcyBsaW5lIGF0ICBcIkxlZnQgTWFpbiBNZW51XCJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9wbHVnaW5fbWVudV9wcm9ncmVzcyggcGx1Z2luX21lbnVfX3NldHVwX3Byb2dyZXNzX19odG1sICl7XHJcblx0aWYgKCAndW5kZWZpbmVkJyAhPSB0eXBlb2YgKHBsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzc19faHRtbCkgKXtcclxuXHRcdGpRdWVyeSggJy5zZXR1cF93aXphcmRfcGFnZV9jb250YWluZXInICkucGFyZW50KCkuaHRtbCggcGx1Z2luX21lbnVfX3NldHVwX3Byb2dyZXNzX19odG1sICk7XHJcblx0fVxyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gIFN0ZXBzIE51bWJlciBGdW5jdGlvbnMgPT1cclxuLy8gXHRcdFx0XHRcdEdldHMgZGF0YSBpbiAgIFx0XHRcdF93cGJjX3NldHRpbmdzLmdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQoKS5zdGVwc1xyXG4vLyBcdFx0XHRcdFx0d2hpY2ggIGRlZmluZWQgaW4gICBcdHNldHVwX2FqYXgucGhwICAgICBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRBamF4XHJcbi8vIFx0XHRcdFx0XHRhcyBcdFx0XHRcdFx0XHQkZGF0YV9hcnIgWydzdGVwcyddID0gIG5ldyBXUEJDX1NFVFVQX1dJWkFSRF9TVEVQUygpOyAgJHRoaXMtPmdldF9zdGVwc19hcnIoKTsgIFx0XHRcdGZyb20gXHRcdHNldHVwX3N0ZXBzLnBocFx0XHRzdHJ1Y3R1cmUuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X3N0ZXBzX2NvdW50KCkge1xyXG5cclxuXHR2YXIgcGFyYW1zX2FyciA9IF93cGJjX3NldHRpbmdzLmdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQoKS5zdGVwc1xyXG5cdHZhciBzdGVwc19jb3VudCA9IDBcclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRzdGVwc19jb3VudCsrO1xyXG5cdH0gKTtcclxuXHRyZXR1cm4gc3RlcHNfY291bnQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9hY3R1YWxfc3RlcF9udW1iZXIoKSB7XHJcblxyXG5cdHZhciBwYXJhbXNfYXJyID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpLnN0ZXBzXHJcblx0dmFyIHN0ZXBzX2ZpbmlzaGVkID0gMVxyXG5cdF8uZWFjaCggcGFyYW1zX2FyciwgZnVuY3Rpb24gKCBwX3ZhbCwgcF9rZXksIHBfZGF0YSApIHtcclxuXHRcdGlmICggcF92YWwuaXNfZG9uZSApe1xyXG5cdFx0XHRzdGVwc19maW5pc2hlZCsrO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHRyZXR1cm4gc3RlcHNfZmluaXNoZWQ7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMoIHN0ZXBzX2lzX2RvbmVfYXJyICl7XHJcblxyXG5cdHZhciBwYXJhbXNfYXJyID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpLnN0ZXBzXHJcblxyXG5cdF8uZWFjaCggc3RlcHNfaXNfZG9uZV9hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRpZiAoIFwidW5kZWZpbmVkXCIgIT09IHR5cGVvZiAoIHBhcmFtc19hcnJbIHBfa2V5IF0gKSApIHtcclxuXHRcdFx0cGFyYW1zX2FyclsgcF9rZXkgXS5pc19kb25lID0gKHRydWUgPT09IHN0ZXBzX2lzX2RvbmVfYXJyWyBwX2tleSBdKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBwYXJhbXNfYXJyO1xyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQoKXtcclxuXHJcblx0dmFyIHBhcmFtc19hcnIgPSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkuc3RlcHNcclxuXHR2YXIgc3RhdHVzID0gdHJ1ZTtcclxuXHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0aWYgKCAhIHBfdmFsLmlzX2RvbmUgKXtcclxuXHRcdFx0c3RhdHVzID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHRyZXR1cm4gc3RhdHVzO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIERlZmluZSBVSSBob29rcyBmb3IgZWxlbWVudHMsIGFmdGVyIHNob3dpbmcgaW4gQWpheC5cclxuICpcclxuICogQmVjYXVzZSBlYWNoICB0aW1lLCAgd2hlbiAgd2Ugc2hvdyBjb250ZW50IGluIEFqYXgsIGFsbCBIb29rcyBuZWVkcyByZS1kZWZpbmVkLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZGVmaW5lX3VpX2hvb2tzKCl7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gVG9vbHRpcHNcclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiggd3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMgKSApIHtcclxuXHRcdHZhciBwYXJlbnRfY3NzX2NsYXNzID0gIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSAgKyAnICdcclxuXHRcdHdwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCBwYXJlbnRfY3NzX2NsYXNzICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIENoYW5nZSBSYWRpbyBDb250YWluZXJzXHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfcmFkaW9fY2hvaWNlX2lucHV0JyApLm9uKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblxyXG5cdFx0d3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbiggdGhpcyApO1xyXG5cclxuXHRcdC8vd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsgICAncGFnZV9pdGVtc19jb3VudCc6IGpRdWVyeSggdGhpcyApLnZhbCgpLCAgICdwYWdlX251bSc6IDEgICB9ICk7XHJcblx0fSApO1xyXG5cclxuXHRqUXVlcnkoICcud3BiY191aV9yYWRpb19jaG9pY2VfaW5wdXQnICkuZWFjaChmdW5jdGlvbiAoaW5kZXggKXtcclxuXHRcdHdwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9zZWxlY3Rpb24oIHRoaXMgKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gRGVmaW5lIGFiaWxpdHkgdG8gY2xpY2sgb24gUmFkaW8gQ29udGFpbmVycyAobm90IG9ubHkgcmFkaW8tYnV0dG9ucylcclxuXHRqUXVlcnkoICcud3BiY191aV9yYWRpb19jb250YWluZXInICkub24oICdjbGljaycsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cdFx0d3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrKCB0aGlzICk7XHJcblx0fSApO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcbn1cclxuXHJcblxyXG4vL1RPRE86IG1heWJlIHJlbG9jYXRlIHRoaXMgZnVuY3Rpb25zIGluIG90aGVyIHV0aWxzIGpzIGZpbGUgP1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEZ1bGwgU2NyZWVuICAtICBzdXBwb3J0IGZ1bmN0aW9ucyAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIEZ1bGwgIHNjcmVlbiBtb2RlLCAgYnkgIHJlbW92aW5nIHRvcCB0YWJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpe1xyXG5cdGlmICggalF1ZXJ5KCAnYm9keScgKS5oYXNDbGFzcyggJ3dwYmNfYWRtaW5fZnVsbF9zY3JlZW4nICkgKSB7XHJcblx0XHRqUXVlcnkoICdodG1sJyApLnJlbW92ZUNsYXNzKCAnd3AtdG9vbGJhcicgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCcgKS5hZGRDbGFzcyggJ3dwLXRvb2xiYXInICk7XHJcblx0fVxyXG59XHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkge1xyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG59ICk7XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSAgTSBlIHMgcyBhIGcgZSAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2hvdyBtZXNzYWdlIGluIGNvbnRlbnRcclxuICpcclxuICogQHBhcmFtIG1lc3NhZ2VcdFx0XHRcdE1lc3NhZ2UgSFRNTFxyXG4gKiBAcGFyYW0gcGFyYW1zID0ge1xyXG4gKiAgICAgICAgICAgICAgICAgICBbJ3R5cGUnXVx0XHRcdFx0J3dhcm5pbmcnIHwgJ2luZm8nIHwgJ2Vycm9yJyB8ICdzdWNjZXNzJ1x0XHRkZWZhdWx0OiAnd2FybmluZydcclxuICogICAgICAgICAgICAgICAgICAgWydjb250YWluZXInXVx0XHRcdCcud3BiY19hanhfY3N0bV9fc2VjdGlvbl9sZWZ0J1x0XHRkZWZhdWx0OiBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX290aGVyKCAnY29udGFpbmVyX19tYWluX2NvbnRlbnQnKVxyXG4gKiAgICAgICAgICAgICAgICAgICBbJ2lzX2FwcGVuZCddXHRcdFx0dHJ1ZSB8IGZhbHNlXHRcdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxyXG4gKlx0XHRcdFx0ICAgfVxyXG4gKiBFeGFtcGxlOlxyXG4gKiBcdFx0XHR2YXIgaHRtbF9pZCA9IHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSggJ1lvdSBjYW4gdGVzdCBkYXlzIHNlbGVjdGlvbiBpbiBjYWxlbmRhcicsICdpbmZvJywgJy53cGJjX2FqeF9jc3RtX19zZWN0aW9uX2xlZnQnLCB0cnVlICk7XHJcbiAqXHJcbiAqXHJcbiAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHBhcmFtcyA9IHt9ICl7XHJcblxyXG5cdHZhciBwYXJhbXNfZGVmYXVsdCA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHQnY29udGFpbmVyJzogX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19vdGhlciggJ2NvbnRhaW5lcl9fbWFpbl9jb250ZW50JyksXHJcblx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHJcblx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdH07XHJcblx0Xy5lYWNoKCBwYXJhbXMsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKXtcclxuXHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcF92YWw7XHJcblx0fSApO1xyXG5cdHBhcmFtcyA9IHBhcmFtc19kZWZhdWx0O1xyXG5cclxuICAgIHZhciB1bmlxdWVfZGl2X2lkID0gbmV3IERhdGUoKTtcclxuICAgIHVuaXF1ZV9kaXZfaWQgPSAnd3BiY19ub3RpY2VfJyArIHVuaXF1ZV9kaXZfaWQuZ2V0VGltZSgpO1xyXG5cclxuXHR2YXIgYWxlcnRfY2xhc3MgPSAnbm90aWNlICc7XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnZXJyb3InICl7XHJcblx0XHRhbGVydF9jbGFzcyArPSAnbm90aWNlLWVycm9yICc7XHJcblx0XHRtZXNzYWdlID0gJzxpIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAwLjVlbTtjb2xvcjogI2Q2MzYzODtcIiBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JlcG9ydF9nbWFpbGVycm9ycmVkXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICd3YXJuaW5nJyApe1xyXG5cdFx0YWxlcnRfY2xhc3MgKz0gJ25vdGljZS13YXJuaW5nICc7XHJcblx0XHRtZXNzYWdlID0gJzxpIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAwLjVlbTtjb2xvcjogI2U5YWEwNDtcIiBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3dhcm5pbmdcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ2luZm8nICl7XHJcblx0XHRhbGVydF9jbGFzcyArPSAnbm90aWNlLWluZm8gJztcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnc3VjY2VzcycgKXtcclxuXHRcdGFsZXJ0X2NsYXNzICs9ICdub3RpY2UtaW5mbyBhbGVydC1zdWNjZXNzIHVwZGF0ZWQgJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgc3R5bGU9XCJtYXJnaW4tcmlnaHQ6IDAuNWVtO2NvbG9yOiAjNjRhYTQ1O1wiIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fZG9uZV9vdXRsaW5lXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHJcblx0bWVzc2FnZSA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjLXNldHRpbmdzLW5vdGljZSAnICsgYWxlcnRfY2xhc3MgKyAnXCIgc3R5bGU9XCInICsgcGFyYW1zWyAnc3R5bGUnIF0gKyAnXCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JztcclxuXHJcblx0aWYgKCBwYXJhbXNbJ2lzX2FwcGVuZCddICl7XHJcblx0XHRqUXVlcnkoIHBhcmFtc1snY29udGFpbmVyJ10gKS5hcHBlbmQoIG1lc3NhZ2UgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCBwYXJhbXNbJ2NvbnRhaW5lciddICkuaHRtbCggbWVzc2FnZSApO1xyXG5cdH1cclxuXHJcblx0cGFyYW1zWydkZWxheSddID0gcGFyc2VJbnQoIHBhcmFtc1snZGVsYXknXSApO1xyXG5cdGlmICggcGFyYW1zWydkZWxheSddID4gMCApe1xyXG5cclxuXHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRqUXVlcnkoICcjJyArIHVuaXF1ZV9kaXZfaWQgKS5mYWRlT3V0KCAxNTAwICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBwYXJhbXNbICdkZWxheScgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICk7XHJcblx0fVxyXG5cdHJldHVybiB1bmlxdWVfZGl2X2lkO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09ICBTdXBwb3J0IEZ1bmN0aW9ucyAtIFNwaW4gSWNvbiBpbiBUb3AgQmFyIE1lbnUgLT4gJyAgSW5pdGlhbCBTZXR1cCcgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBTdGFydFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCl7XHJcblx0cmV0dXJuIGZhbHNlOyAvLyBDdXJyZW50bHkgIGRpc2FibGVkLCAgbWF5YmUgYWN0aXZhdGUgaXQgZm9yIHNvbWUgb3RoZXIgZWxlbWVudC5cclxuXHRqUXVlcnkoICcjd3BiY19pbml0aWFsX3NldHVwX3RvcF9tZW51X2l0ZW0gLm1lbnVfaWNvbi53cGJjX3NwaW4nKS5yZW1vdmVDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogU3BpbiBidXR0b24gaW4gRmlsdGVyIHRvb2xiYXIgIC0gIFBhdXNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKXtcclxuXHRqUXVlcnkoICcjd3BiY19pbml0aWFsX3NldHVwX3RvcF9tZW51X2l0ZW0gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuYWRkQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBpcyBTcGlubmluZyA/XHJcbiAqXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19pc19zcGluKCl7XHJcbiAgICBpZiAoIGpRdWVyeSggJyN3cGJjX2luaXRpYWxfc2V0dXBfdG9wX21lbnVfaXRlbSAubWVudV9pY29uLndwYmNfc3BpbicgKS5oYXNDbGFzcyggJ3dwYmNfYW5pbWF0aW9uX3BhdXNlJyApICl7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxufVxyXG4iXSwibWFw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
