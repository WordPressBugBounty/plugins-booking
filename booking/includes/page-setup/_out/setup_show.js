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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX3Nob3cuanMiLCJuYW1lcyI6WyJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyIsInBhcmFtc19hcnIiLCJfd3BiY19zZXR0aW5ncyIsInNldF9wYXJhbXNfYXJyX19zZXR1cF93aXphcmQiLCJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCIsIndwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCIsIndwIiwidGVtcGxhdGUiLCJqUXVlcnkiLCJnZXRfcGFyYW1fX290aGVyIiwiaHRtbCIsImdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQiLCJwYXJlbnQiLCJoaWRlIiwid3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlIiwid3BiY19zY3JvbGxfdG8iLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19oaWRlX2NvbnRlbnQiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfcGx1Z2luX21lbnVfcHJvZ3Jlc3MiLCJwbHVnaW5fbWVudV9fc2V0dXBfcHJvZ3Jlc3NfX2h0bWwiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19nZXRfc3RlcHNfY291bnQiLCJzdGVwcyIsInN0ZXBzX2NvdW50IiwiXyIsImVhY2giLCJwX3ZhbCIsInBfa2V5IiwicF9kYXRhIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X2FjdHVhbF9zdGVwX251bWJlciIsInNldHVwX3BhcmFtcyIsImN1cnJlbnRfc3RlcCIsInN0ZXBfbnVtYmVyIiwiZm91bmRfc3RlcCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMiLCJzdGVwc19pc19kb25lX2FyciIsImlzX2RvbmUiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19pc19hbGxfc3RlcHNfY29tcGxldGVkIiwic3RhdHVzIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fZGVmaW5lX3VpX2hvb2tzIiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJwYXJlbnRfY3NzX2NsYXNzIiwib24iLCJldmVudCIsIndwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9zZWxlY3Rpb24iLCJpbmRleCIsIndwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9jbGljayIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSIsIm1lc3NhZ2UiLCJwYXJhbXMiLCJwYXJhbXNfZGVmYXVsdCIsInVuaXF1ZV9kaXZfaWQiLCJEYXRlIiwiZ2V0VGltZSIsImFsZXJ0X2NsYXNzIiwiYXBwZW5kIiwicGFyc2VJbnQiLCJjbG9zZWRfdGltZXIiLCJzZXRUaW1lb3V0IiwiZmFkZU91dCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsInJlbW92ZUNsYXNzIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwiYWRkQ2xhc3MiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX2lzX3NwaW4iLCJoYXNDbGFzcyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAvX3NyYy9zZXR1cF9zaG93LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG5cclxuLyoqXHJcbiAqIFBhcmFtZXRlcnMgdXN1YWxseSAgZGVmaW5lZCBpbiAgIEFqYXggUmVzcG9uc2Ugb3IgRnJvbnQtRW5kIFx0Zm9yICA9PSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCk6XHJcbiAqXHJcbiAqIEluIFx0RnJvbnQtRW5kIHNpZGUgYXMgIEphdmFTY3JpcHQgXHRcdDo6XHRcdHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fc2VuZF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7ICAnY3VycmVudF9zdGVwJzogJ2RhdGVfYXZhaWxhYmlsaXR5JywgJ2RvX2FjdGlvbic6ICdub25lJywgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCc6ICdidG5fX3Rvb2xiYXJfX2J1dHRvbnNfcHJpb3InICB9ICk7XHJcbiAqXHJcbiAqIEFmdGVyIEFqYXggcmVzcG9uc2UgaW4gc2V0dXBfYWpheC5qcyAgYXMgOjpcdFx0X3dwYmNfc2V0dGluZ3Muc2V0X3BhcmFtc19hcnJfX3NldHVwX3dpemFyZCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09ICBTZXQgUmVxdWVzdCAgZm9yICBBamF4ICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBSZXF1ZXN0IFx0YWZ0ZXIgXHRVcGRhdGluZyBSZXF1ZXN0IFBhcmFtZXRlcnNcclxuICpcclxuICogQHBhcmFtIHBhcmFtc19hcnJcclxuICpcclxuICogXHRcdEV4YW1wbGUgMTpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogcGFnZV9udW1iZXJcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuICogXHRcdEV4YW1wbGUgMjpcclxuICpcclxuICogXHRcdFx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2N1cnJlbnRfc3RlcCc6ICd7e2RhdGEuc3RlcHNbIGRhdGEuY3VycmVudF9zdGVwIF0ucHJpb3J9fScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkb19hY3Rpb24nOiAnbm9uZScsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV9jbGlja2VkX2VsZW1lbnRfaWQnOiAnYnRuX190b29sYmFyX19idXR0b25zX3ByaW9yJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMgKCBwYXJhbXNfYXJyICl7XHJcblxyXG5cdC8vIERlZmluZSBQYXJhbXMgQXJyYXkgXHR0byBcdFJlcXVlc3RcclxuXHRfd3BiY19zZXR0aW5ncy5zZXRfcGFyYW1zX2Fycl9fc2V0dXBfd2l6YXJkKCBwYXJhbXNfYXJyICk7XHJcblxyXG5cdC8vIFNlbmQgQWpheCBSZXF1ZXN0XHJcblx0d3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3QoKTtcclxufVxyXG4vLyBFeGFtcGxlIDE6ICB3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdF93aXRoX3BhcmFtcyggeyAgJ3BhZ2VfbnVtJzogcGFnZV9udW1iZXIgIH0gKTtcclxuLy8gRXhhbXBsZSAyOiAgd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsgICdjdXJyZW50X3N0ZXAnOiAnZGF0ZV9hdmFpbGFiaWxpdHknLCAnZG9fYWN0aW9uJzogJ25vbmUnLCAndWlfY2xpY2tlZF9lbGVtZW50X2lkJzogJ2J0bl9fdG9vbGJhcl9fYnV0dG9uc19wcmlvcicgIH0gKTtcclxuXHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gU2hvdyAvIEhpZGUgIENvbnRlbnQgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8qKlxyXG4gKiBTaG93IE1haW4gQ29udGVudFx0Li4uXHRfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgIFx0LVx0bXVzdCAgYmUgZGVmaW5lZCFcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCgpIHtcclxuXHJcblx0dmFyIHdwYmNfdGVtcGxhdGVfX3N0cF93aXpfX21haW5fY29udGVudCA9IHdwLnRlbXBsYXRlKCAnd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50JyApO1xyXG5cclxuXHRqUXVlcnkoIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSApLmh0bWwoICAgd3BiY190ZW1wbGF0ZV9fc3RwX3dpel9fbWFpbl9jb250ZW50KCBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkgKSAgICk7XHJcblxyXG5cdC8vIEhpZGUgJ1Byb2Nlc3NpbmcnIE5vdGljZVxyXG5cdGpRdWVyeSggJy53cGJjX3Byb2Nlc3Npbmcud3BiY19zcGluJykucGFyZW50KCkucGFyZW50KCkucGFyZW50KCkucGFyZW50KCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKS5oaWRlKCk7XHJcblxyXG5cdC8vdmFyIGhlYWRlcl9tZW51X3RleHQgPSAnIFN0ZXAgJyArIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9hY3R1YWxfc3RlcF9udW1iZXIoKSArICcgLyAnICsgd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZ2V0X3N0ZXBzX2NvdW50KCk7XHJcblx0Ly9qUXVlcnkoICcud3BiY19oZWFkZXJfbWVudV90YWJzIC5uYXYtdGFiLWFjdGl2ZSAubmF2LXRhYi10ZXh0JykuaHRtbCggaGVhZGVyX21lbnVfdGV4dCApO1xyXG5cdC8vXHJcblx0Ly9qUXVlcnkoICcud3BiY19uYXZpZ2F0aW9uX21lbnVfbGVmdF9pdGVtICcgKS5yZW1vdmVDbGFzcyggJ3dwYmNfYWN0aXZlJyApO1xyXG5cdC8valF1ZXJ5KCAnIycgKyBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX3NldHVwX3dpemFyZCggJ2N1cnJlbnRfc3RlcCcgKSApLmFkZENsYXNzKCAnd3BiY19hY3RpdmUnICk7XHJcblxyXG5cdC8vIFJlY2hlY2sgRnVsbCBTY3JlZW4gIG1vZGUsICBieSAgcmVtb3ZpbmcgdG9wIHRhYlxyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG5cclxuXHQvLyBTY3JvbGwgdG8gdG9wXHJcblx0Ly8gd3BiY19zY3JvbGxfdG8oICAnLndwYmNfcGFnZV90b3BfX2hlYWRlcl90YWJzJyApO1xyXG5cdHdwYmNfc2Nyb2xsX3RvKCAgJy53cGJjX19jb250YWluZXJfcGxhY2VfX3N0ZXBzX2Zvcl90aW1lbGluZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgTWFpbiBDb250ZW50XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19oaWRlX2NvbnRlbnQoKXtcclxuXHJcblx0alF1ZXJ5KCBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX290aGVyKCAnY29udGFpbmVyX19tYWluX2NvbnRlbnQnICkgKS5odG1sKCAgJycgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBVcGRhdGUgUGx1Z2luICBtZW51IHByb2dyZXNzICAgLT4gUHJvZ3Jlc3MgbGluZSBhdCAgXCJMZWZ0IE1haW4gTWVudVwiXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfcGx1Z2luX21lbnVfcHJvZ3Jlc3MoIHBsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzc19faHRtbCApe1xyXG5cdGlmICggJ3VuZGVmaW5lZCcgIT0gdHlwZW9mIChwbHVnaW5fbWVudV9fc2V0dXBfcHJvZ3Jlc3NfX2h0bWwpICl7XHJcblx0XHRqUXVlcnkoICcuc2V0dXBfd2l6YXJkX3BhZ2VfY29udGFpbmVyJyApLnBhcmVudCgpLmh0bWwoIHBsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzc19faHRtbCApO1xyXG5cdH1cclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09ICBTdGVwcyBOdW1iZXIgRnVuY3Rpb25zID09XHJcbi8vIFx0XHRcdFx0XHRHZXRzIGRhdGEgaW4gICBcdFx0XHRfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkuc3RlcHNcclxuLy8gXHRcdFx0XHRcdHdoaWNoICBkZWZpbmVkIGluICAgXHRzZXR1cF9hamF4LnBocCAgICAgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0QWpheFxyXG4vLyBcdFx0XHRcdFx0YXMgXHRcdFx0XHRcdFx0JGRhdGFfYXJyIFsnc3RlcHMnXSA9ICBuZXcgV1BCQ19TRVRVUF9XSVpBUkRfU1RFUFMoKTsgICR0aGlzLT5nZXRfc3RlcHNfYXJyKCk7ICBcdFx0XHRmcm9tIFx0XHRzZXR1cF9zdGVwcy5waHBcdFx0c3RydWN0dXJlLlxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2dldF9zdGVwc19jb3VudCgpIHtcclxuXHJcblx0dmFyIHBhcmFtc19hcnIgPSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkuc3RlcHNcclxuXHR2YXIgc3RlcHNfY291bnQgPSAwXHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0c3RlcHNfY291bnQrKztcclxuXHR9ICk7XHJcblx0cmV0dXJuIHN0ZXBzX2NvdW50O1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19nZXRfYWN0dWFsX3N0ZXBfbnVtYmVyKCkge1xyXG5cclxuXHR2YXIgc2V0dXBfcGFyYW1zID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpO1xyXG5cdHZhciBwYXJhbXNfYXJyICAgPSBzZXR1cF9wYXJhbXMuc3RlcHM7XHJcblx0dmFyIGN1cnJlbnRfc3RlcCA9IHNldHVwX3BhcmFtcy5jdXJyZW50X3N0ZXA7XHJcblx0dmFyIHN0ZXBfbnVtYmVyICA9IDE7XHJcblx0dmFyIGZvdW5kX3N0ZXAgICA9IGZhbHNlO1xyXG5cclxuXHRfLmVhY2goIHBhcmFtc19hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRpZiAoIHBfa2V5ID09PSBjdXJyZW50X3N0ZXAgKSB7XHJcblx0XHRcdGZvdW5kX3N0ZXAgPSB0cnVlO1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRzdGVwX251bWJlcisrO1xyXG5cdH0gKTtcclxuXHJcblx0cmV0dXJuIGZvdW5kX3N0ZXAgPyBzdGVwX251bWJlciA6IDE7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMoIHN0ZXBzX2lzX2RvbmVfYXJyICl7XHJcblxyXG5cdHZhciBwYXJhbXNfYXJyID0gX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpLnN0ZXBzXHJcblxyXG5cdF8uZWFjaCggc3RlcHNfaXNfZG9uZV9hcnIsIGZ1bmN0aW9uICggcF92YWwsIHBfa2V5LCBwX2RhdGEgKSB7XHJcblx0XHRpZiAoIFwidW5kZWZpbmVkXCIgIT09IHR5cGVvZiAoIHBhcmFtc19hcnJbIHBfa2V5IF0gKSApIHtcclxuXHRcdFx0cGFyYW1zX2FyclsgcF9rZXkgXS5pc19kb25lID0gKHRydWUgPT09IHN0ZXBzX2lzX2RvbmVfYXJyWyBwX2tleSBdKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBwYXJhbXNfYXJyO1xyXG5cclxufVxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQoKXtcclxuXHJcblx0dmFyIHBhcmFtc19hcnIgPSBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKCkuc3RlcHNcclxuXHR2YXIgc3RhdHVzID0gdHJ1ZTtcclxuXHJcblx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICkge1xyXG5cdFx0aWYgKCAhIHBfdmFsLmlzX2RvbmUgKXtcclxuXHRcdFx0c3RhdHVzID0gZmFsc2U7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHRyZXR1cm4gc3RhdHVzO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIERlZmluZSBVSSBob29rcyBmb3IgZWxlbWVudHMsIGFmdGVyIHNob3dpbmcgaW4gQWpheC5cclxuICpcclxuICogQmVjYXVzZSBlYWNoICB0aW1lLCAgd2hlbiAgd2Ugc2hvdyBjb250ZW50IGluIEFqYXgsIGFsbCBIb29rcyBuZWVkcyByZS1kZWZpbmVkLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9fZGVmaW5lX3VpX2hvb2tzKCl7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gVG9vbHRpcHNcclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiggd3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMgKSApIHtcclxuXHRcdHZhciBwYXJlbnRfY3NzX2NsYXNzID0gIF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcgKSAgKyAnICdcclxuXHRcdHdwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCBwYXJlbnRfY3NzX2NsYXNzICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIENoYW5nZSBSYWRpbyBDb250YWluZXJzXHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfcmFkaW9fY2hvaWNlX2lucHV0JyApLm9uKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblxyXG5cdFx0d3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbiggdGhpcyApO1xyXG5cclxuXHRcdC8vd3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19zZW5kX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHsgICAncGFnZV9pdGVtc19jb3VudCc6IGpRdWVyeSggdGhpcyApLnZhbCgpLCAgICdwYWdlX251bSc6IDEgICB9ICk7XHJcblx0fSApO1xyXG5cclxuXHRqUXVlcnkoICcud3BiY191aV9yYWRpb19jaG9pY2VfaW5wdXQnICkuZWFjaChmdW5jdGlvbiAoaW5kZXggKXtcclxuXHRcdHdwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9zZWxlY3Rpb24oIHRoaXMgKTtcclxuXHR9KTtcclxuXHJcblx0Ly8gRGVmaW5lIGFiaWxpdHkgdG8gY2xpY2sgb24gUmFkaW8gQ29udGFpbmVycyAobm90IG9ubHkgcmFkaW8tYnV0dG9ucylcclxuXHRqUXVlcnkoICcud3BiY191aV9yYWRpb19jb250YWluZXInICkub24oICdjbGljaycsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cdFx0d3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrKCB0aGlzICk7XHJcblx0fSApO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcbn1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gIE0gZSBzIHMgYSBnIGUgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNob3cgbWVzc2FnZSBpbiBjb250ZW50XHJcbiAqXHJcbiAqIEBwYXJhbSBtZXNzYWdlXHRcdFx0XHRNZXNzYWdlIEhUTUxcclxuICogQHBhcmFtIHBhcmFtcyA9IHtcclxuICogICAgICAgICAgICAgICAgICAgWyd0eXBlJ11cdFx0XHRcdCd3YXJuaW5nJyB8ICdpbmZvJyB8ICdlcnJvcicgfCAnc3VjY2VzcydcdFx0ZGVmYXVsdDogJ3dhcm5pbmcnXHJcbiAqICAgICAgICAgICAgICAgICAgIFsnY29udGFpbmVyJ11cdFx0XHQnLndwYmNfYWp4X2NzdG1fX3NlY3Rpb25fbGVmdCdcdFx0ZGVmYXVsdDogX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19vdGhlciggJ2NvbnRhaW5lcl9fbWFpbl9jb250ZW50JylcclxuICogICAgICAgICAgICAgICAgICAgWydpc19hcHBlbmQnXVx0XHRcdHRydWUgfCBmYWxzZVx0XHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcclxuICpcdFx0XHRcdCAgIH1cclxuICogRXhhbXBsZTpcclxuICogXHRcdFx0dmFyIGh0bWxfaWQgPSB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X21lc3NhZ2UoICdZb3UgY2FuIHRlc3QgZGF5cyBzZWxlY3Rpb24gaW4gY2FsZW5kYXInLCAnaW5mbycsICcud3BiY19hanhfY3N0bV9fc2VjdGlvbl9sZWZ0JywgdHJ1ZSApO1xyXG4gKlxyXG4gKlxyXG4gKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCBwYXJhbXMgPSB7fSApe1xyXG5cclxuXHR2YXIgcGFyYW1zX2RlZmF1bHQgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0J2NvbnRhaW5lcic6IF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fb3RoZXIoICdjb250YWluZXJfX21haW5fY29udGVudCcpLFxyXG5cdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcclxuXHRcdFx0XHRcdFx0XHR9O1xyXG5cdF8uZWFjaCggcGFyYW1zLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHJcblx0XHRwYXJhbXNfZGVmYXVsdFsgcF9rZXkgXSA9IHBfdmFsO1xyXG5cdH0gKTtcclxuXHRwYXJhbXMgPSBwYXJhbXNfZGVmYXVsdDtcclxuXHJcbiAgICB2YXIgdW5pcXVlX2Rpdl9pZCA9IG5ldyBEYXRlKCk7XHJcbiAgICB1bmlxdWVfZGl2X2lkID0gJ3dwYmNfbm90aWNlXycgKyB1bmlxdWVfZGl2X2lkLmdldFRpbWUoKTtcclxuXHJcblx0dmFyIGFsZXJ0X2NsYXNzID0gJ25vdGljZSAnO1xyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ2Vycm9yJyApe1xyXG5cdFx0YWxlcnRfY2xhc3MgKz0gJ25vdGljZS1lcnJvciAnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBzdHlsZT1cIm1hcmdpbi1yaWdodDogMC41ZW07Y29sb3I6ICNkNjM2Mzg7XCIgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yZXBvcnRfZ21haWxlcnJvcnJlZFwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnd2FybmluZycgKXtcclxuXHRcdGFsZXJ0X2NsYXNzICs9ICdub3RpY2Utd2FybmluZyAnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBzdHlsZT1cIm1hcmdpbi1yaWdodDogMC41ZW07Y29sb3I6ICNlOWFhMDQ7XCIgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl93YXJuaW5nXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdpbmZvJyApe1xyXG5cdFx0YWxlcnRfY2xhc3MgKz0gJ25vdGljZS1pbmZvICc7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ3N1Y2Nlc3MnICl7XHJcblx0XHRhbGVydF9jbGFzcyArPSAnbm90aWNlLWluZm8gYWxlcnQtc3VjY2VzcyB1cGRhdGVkICc7XHJcblx0XHRtZXNzYWdlID0gJzxpIHN0eWxlPVwibWFyZ2luLXJpZ2h0OiAwLjVlbTtjb2xvcjogIzY0YWE0NTtcIiBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RvbmVfb3V0bGluZVwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblxyXG5cdG1lc3NhZ2UgPSAnPGRpdiBpZD1cIicgKyB1bmlxdWVfZGl2X2lkICsgJ1wiIGNsYXNzPVwid3BiYy1zZXR0aW5ncy1ub3RpY2UgJyArIGFsZXJ0X2NsYXNzICsgJ1wiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ3N0eWxlJyBdICsgJ1wiPicgKyBtZXNzYWdlICsgJzwvZGl2Pic7XHJcblxyXG5cdGlmICggcGFyYW1zWydpc19hcHBlbmQnXSApe1xyXG5cdFx0alF1ZXJ5KCBwYXJhbXNbJ2NvbnRhaW5lciddICkuYXBwZW5kKCBtZXNzYWdlICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggcGFyYW1zWydjb250YWluZXInXSApLmh0bWwoIG1lc3NhZ2UgKTtcclxuXHR9XHJcblxyXG5cdHBhcmFtc1snZGVsYXknXSA9IHBhcnNlSW50KCBwYXJhbXNbJ2RlbGF5J10gKTtcclxuXHRpZiAoIHBhcmFtc1snZGVsYXknXSA+IDAgKXtcclxuXHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkuZmFkZU91dCggMTUwMCApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgcGFyYW1zWyAnZGVsYXknIF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCApO1xyXG5cdH1cclxuXHRyZXR1cm4gdW5pcXVlX2Rpdl9pZDtcclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSAgU3VwcG9ydCBGdW5jdGlvbnMgLSBTcGluIEljb24gaW4gVG9wIEJhciBNZW51IC0+ICcgIEluaXRpYWwgU2V0dXAnICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgU3RhcnRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCgpe1xyXG5cdHJldHVybiBmYWxzZTsgLy8gQ3VycmVudGx5ICBkaXNhYmxlZCwgIG1heWJlIGFjdGl2YXRlIGl0IGZvciBzb21lIG90aGVyIGVsZW1lbnQuXHJcblx0alF1ZXJ5KCAnI3dwYmNfaW5pdGlhbF9zZXR1cF90b3BfbWVudV9pdGVtIC5tZW51X2ljb24ud3BiY19zcGluJykucmVtb3ZlQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNwaW4gYnV0dG9uIGluIEZpbHRlciB0b29sYmFyICAtICBQYXVzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCl7XHJcblx0alF1ZXJ5KCAnI3dwYmNfaW5pdGlhbF9zZXR1cF90b3BfbWVudV9pdGVtIC5tZW51X2ljb24ud3BiY19zcGluJyApLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTcGluIGJ1dHRvbiBpbiBGaWx0ZXIgdG9vbGJhciAgLSAgaXMgU3Bpbm5pbmcgP1xyXG4gKlxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9faXNfc3Bpbigpe1xyXG4gICAgaWYgKCBqUXVlcnkoICcjd3BiY19pbml0aWFsX3NldHVwX3RvcF9tZW51X2l0ZW0gLm1lbnVfaWNvbi53cGJjX3NwaW4nICkuaGFzQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKSApe1xyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fSBlbHNlIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcbn1cclxuIl0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUVaO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxxREFBcURBLENBQUdDLFVBQVUsRUFBRTtFQUU1RTtFQUNBQyxjQUFjLENBQUNDLDRCQUE0QixDQUFFRixVQUFXLENBQUM7O0VBRXpEO0VBQ0FHLHlDQUF5QyxDQUFDLENBQUM7QUFDNUM7QUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLG9DQUFvQ0EsQ0FBQSxFQUFHO0VBRS9DLElBQUlDLG9DQUFvQyxHQUFHQyxFQUFFLENBQUNDLFFBQVEsQ0FBRSxzQ0FBdUMsQ0FBQztFQUVoR0MsTUFBTSxDQUFFUCxjQUFjLENBQUNRLGdCQUFnQixDQUFFLHlCQUEwQixDQUFFLENBQUMsQ0FBQ0MsSUFBSSxDQUFJTCxvQ0FBb0MsQ0FBRUosY0FBYyxDQUFDVSw0QkFBNEIsQ0FBQyxDQUFFLENBQUksQ0FBQzs7RUFFeEs7RUFDQUgsTUFBTSxDQUFFLDRCQUE0QixDQUFDLENBQUNJLE1BQU0sQ0FBQyxDQUFDLENBQUNBLE1BQU0sQ0FBQyxDQUFDLENBQUNBLE1BQU0sQ0FBQyxDQUFDLENBQUNBLE1BQU0sQ0FBRSxzQkFBdUIsQ0FBQyxDQUFDQyxJQUFJLENBQUMsQ0FBQzs7RUFFeEc7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQTtFQUNBQywyQkFBMkIsQ0FBQyxDQUFDOztFQUU3QjtFQUNBO0VBQ0FDLGNBQWMsQ0FBRyw0Q0FBNkMsQ0FBQztBQUNoRTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyxvQ0FBb0NBLENBQUEsRUFBRTtFQUU5Q1IsTUFBTSxDQUFFUCxjQUFjLENBQUNRLGdCQUFnQixDQUFFLHlCQUEwQixDQUFFLENBQUMsQ0FBQ0MsSUFBSSxDQUFHLEVBQUcsQ0FBQztBQUNuRjs7QUFHQTtBQUNBO0FBQ0E7QUFDQSxTQUFTTyxtREFBbURBLENBQUVDLGlDQUFpQyxFQUFFO0VBQ2hHLElBQUssV0FBVyxJQUFJLE9BQVFBLGlDQUFrQyxFQUFFO0lBQy9EVixNQUFNLENBQUUsOEJBQStCLENBQUMsQ0FBQ0ksTUFBTSxDQUFDLENBQUMsQ0FBQ0YsSUFBSSxDQUFFUSxpQ0FBa0MsQ0FBQztFQUM1RjtBQUNEOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxTQUFTQyx1Q0FBdUNBLENBQUEsRUFBRztFQUVsRCxJQUFJbkIsVUFBVSxHQUFHQyxjQUFjLENBQUNVLDRCQUE0QixDQUFDLENBQUMsQ0FBQ1MsS0FBSztFQUNwRSxJQUFJQyxXQUFXLEdBQUcsQ0FBQztFQUNuQkMsQ0FBQyxDQUFDQyxJQUFJLENBQUV2QixVQUFVLEVBQUUsVUFBV3dCLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUc7SUFDckRMLFdBQVcsRUFBRTtFQUNkLENBQUUsQ0FBQztFQUNILE9BQU9BLFdBQVc7QUFDbkI7QUFFQSxTQUFTTSw4Q0FBOENBLENBQUEsRUFBRztFQUV6RCxJQUFJQyxZQUFZLEdBQUczQixjQUFjLENBQUNVLDRCQUE0QixDQUFDLENBQUM7RUFDaEUsSUFBSVgsVUFBVSxHQUFLNEIsWUFBWSxDQUFDUixLQUFLO0VBQ3JDLElBQUlTLFlBQVksR0FBR0QsWUFBWSxDQUFDQyxZQUFZO0VBQzVDLElBQUlDLFdBQVcsR0FBSSxDQUFDO0VBQ3BCLElBQUlDLFVBQVUsR0FBSyxLQUFLO0VBRXhCVCxDQUFDLENBQUNDLElBQUksQ0FBRXZCLFVBQVUsRUFBRSxVQUFXd0IsS0FBSyxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRztJQUNyRCxJQUFLRCxLQUFLLEtBQUtJLFlBQVksRUFBRztNQUM3QkUsVUFBVSxHQUFHLElBQUk7TUFDakIsT0FBTyxLQUFLO0lBQ2I7SUFDQUQsV0FBVyxFQUFFO0VBQ2QsQ0FBRSxDQUFDO0VBRUgsT0FBT0MsVUFBVSxHQUFHRCxXQUFXLEdBQUcsQ0FBQztBQUNwQztBQUVBLFNBQVNFLDJDQUEyQ0EsQ0FBRUMsaUJBQWlCLEVBQUU7RUFFeEUsSUFBSWpDLFVBQVUsR0FBR0MsY0FBYyxDQUFDVSw0QkFBNEIsQ0FBQyxDQUFDLENBQUNTLEtBQUs7RUFFcEVFLENBQUMsQ0FBQ0MsSUFBSSxDQUFFVSxpQkFBaUIsRUFBRSxVQUFXVCxLQUFLLEVBQUVDLEtBQUssRUFBRUMsTUFBTSxFQUFHO0lBQzVELElBQUssV0FBVyxLQUFLLE9BQVMxQixVQUFVLENBQUV5QixLQUFLLENBQUksRUFBRztNQUNyRHpCLFVBQVUsQ0FBRXlCLEtBQUssQ0FBRSxDQUFDUyxPQUFPLEdBQUksSUFBSSxLQUFLRCxpQkFBaUIsQ0FBRVIsS0FBSyxDQUFHO0lBQ3BFO0VBQ0QsQ0FBRSxDQUFDO0VBRUgsT0FBT3pCLFVBQVU7QUFFbEI7QUFHQSxTQUFTbUMsOENBQThDQSxDQUFBLEVBQUU7RUFFeEQsSUFBSW5DLFVBQVUsR0FBR0MsY0FBYyxDQUFDVSw0QkFBNEIsQ0FBQyxDQUFDLENBQUNTLEtBQUs7RUFDcEUsSUFBSWdCLE1BQU0sR0FBRyxJQUFJO0VBRWpCZCxDQUFDLENBQUNDLElBQUksQ0FBRXZCLFVBQVUsRUFBRSxVQUFXd0IsS0FBSyxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRztJQUNyRCxJQUFLLENBQUVGLEtBQUssQ0FBQ1UsT0FBTyxFQUFFO01BQ3JCRSxNQUFNLEdBQUcsS0FBSztJQUNmO0VBQ0QsQ0FBRSxDQUFDO0VBRUgsT0FBT0EsTUFBTTtBQUNkOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQyx1Q0FBdUNBLENBQUEsRUFBRTtFQUVqRDtFQUNBO0VBQ0EsSUFBSyxVQUFVLEtBQUssT0FBUUMsMEJBQTRCLEVBQUc7SUFDMUQsSUFBSUMsZ0JBQWdCLEdBQUl0QyxjQUFjLENBQUNRLGdCQUFnQixDQUFFLHlCQUEwQixDQUFDLEdBQUksR0FBRztJQUMzRjZCLDBCQUEwQixDQUFFQyxnQkFBaUIsQ0FBQztFQUMvQzs7RUFFQTtFQUNBO0VBQ0EvQixNQUFNLENBQUUsNkJBQThCLENBQUMsQ0FBQ2dDLEVBQUUsQ0FBRSxRQUFRLEVBQUUsVUFBVUMsS0FBSyxFQUFFO0lBRXRFQyxxQ0FBcUMsQ0FBRSxJQUFLLENBQUM7O0lBRTdDO0VBQ0QsQ0FBRSxDQUFDO0VBRUhsQyxNQUFNLENBQUUsNkJBQThCLENBQUMsQ0FBQ2UsSUFBSSxDQUFDLFVBQVVvQixLQUFLLEVBQUU7SUFDN0RELHFDQUFxQyxDQUFFLElBQUssQ0FBQztFQUM5QyxDQUFDLENBQUM7O0VBRUY7RUFDQWxDLE1BQU0sQ0FBRSwwQkFBMkIsQ0FBQyxDQUFDZ0MsRUFBRSxDQUFFLE9BQU8sRUFBRSxVQUFVQyxLQUFLLEVBQUU7SUFDbEVHLGlDQUFpQyxDQUFFLElBQUssQ0FBQztFQUMxQyxDQUFFLENBQUM7O0VBRUg7QUFHRDs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0Msb0NBQW9DQSxDQUFFQyxPQUFPLEVBQUVDLE1BQU0sR0FBRyxDQUFDLENBQUMsRUFBRTtFQUVwRSxJQUFJQyxjQUFjLEdBQUc7SUFDZCxNQUFNLEVBQU8sU0FBUztJQUN0QixXQUFXLEVBQUUvQyxjQUFjLENBQUNRLGdCQUFnQixDQUFFLHlCQUF5QixDQUFDO0lBQ3hFLFdBQVcsRUFBRSxJQUFJO0lBQ2pCLE9BQU8sRUFBTSxrQkFBa0I7SUFDL0IsT0FBTyxFQUFNO0VBQ2QsQ0FBQztFQUNQYSxDQUFDLENBQUNDLElBQUksQ0FBRXdCLE1BQU0sRUFBRSxVQUFXdkIsS0FBSyxFQUFFQyxLQUFLLEVBQUVDLE1BQU0sRUFBRTtJQUNoRHNCLGNBQWMsQ0FBRXZCLEtBQUssQ0FBRSxHQUFHRCxLQUFLO0VBQ2hDLENBQUUsQ0FBQztFQUNIdUIsTUFBTSxHQUFHQyxjQUFjO0VBRXBCLElBQUlDLGFBQWEsR0FBRyxJQUFJQyxJQUFJLENBQUMsQ0FBQztFQUM5QkQsYUFBYSxHQUFHLGNBQWMsR0FBR0EsYUFBYSxDQUFDRSxPQUFPLENBQUMsQ0FBQztFQUUzRCxJQUFJQyxXQUFXLEdBQUcsU0FBUztFQUMzQixJQUFLTCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksT0FBTyxFQUFFO0lBQy9CSyxXQUFXLElBQUksZUFBZTtJQUM5Qk4sT0FBTyxHQUFHLDZHQUE2RyxHQUFHQSxPQUFPO0VBQ2xJO0VBQ0EsSUFBS0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFNBQVMsRUFBRTtJQUNqQ0ssV0FBVyxJQUFJLGlCQUFpQjtJQUNoQ04sT0FBTyxHQUFHLGdHQUFnRyxHQUFHQSxPQUFPO0VBQ3JIO0VBQ0EsSUFBS0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLE1BQU0sRUFBRTtJQUM5QkssV0FBVyxJQUFJLGNBQWM7RUFDOUI7RUFDQSxJQUFLTCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksU0FBUyxFQUFFO0lBQ2pDSyxXQUFXLElBQUksb0NBQW9DO0lBQ25ETixPQUFPLEdBQUcscUdBQXFHLEdBQUdBLE9BQU87RUFDMUg7RUFFQUEsT0FBTyxHQUFHLFdBQVcsR0FBR0csYUFBYSxHQUFHLGdDQUFnQyxHQUFHRyxXQUFXLEdBQUcsV0FBVyxHQUFHTCxNQUFNLENBQUUsT0FBTyxDQUFFLEdBQUcsSUFBSSxHQUFHRCxPQUFPLEdBQUcsUUFBUTtFQUVwSixJQUFLQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUU7SUFDekJ2QyxNQUFNLENBQUV1QyxNQUFNLENBQUMsV0FBVyxDQUFFLENBQUMsQ0FBQ00sTUFBTSxDQUFFUCxPQUFRLENBQUM7RUFDaEQsQ0FBQyxNQUFNO0lBQ050QyxNQUFNLENBQUV1QyxNQUFNLENBQUMsV0FBVyxDQUFFLENBQUMsQ0FBQ3JDLElBQUksQ0FBRW9DLE9BQVEsQ0FBQztFQUM5QztFQUVBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUdPLFFBQVEsQ0FBRVAsTUFBTSxDQUFDLE9BQU8sQ0FBRSxDQUFDO0VBQzdDLElBQUtBLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFFekIsSUFBSVEsWUFBWSxHQUFHQyxVQUFVLENBQUUsWUFBVztNQUMvQmhELE1BQU0sQ0FBRSxHQUFHLEdBQUd5QyxhQUFjLENBQUMsQ0FBQ1EsT0FBTyxDQUFFLElBQUssQ0FBQztJQUM5QyxDQUFDLEVBQ0NWLE1BQU0sQ0FBRSxPQUFPLENBQ2pCLENBQUM7RUFDWjtFQUNBLE9BQU9FLGFBQWE7QUFDckI7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFNBQVNTLGdEQUFnREEsQ0FBQSxFQUFFO0VBQzFELE9BQU8sS0FBSyxDQUFDLENBQUM7RUFDZGxELE1BQU0sQ0FBRSx3REFBd0QsQ0FBQyxDQUFDbUQsV0FBVyxDQUFFLHNCQUF1QixDQUFDO0FBQ3hHOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLGdEQUFnREEsQ0FBQSxFQUFFO0VBQzFEcEQsTUFBTSxDQUFFLHdEQUF5RCxDQUFDLENBQUNxRCxRQUFRLENBQUUsc0JBQXVCLENBQUM7QUFDdEc7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNDLDZDQUE2Q0EsQ0FBQSxFQUFFO0VBQ3BELElBQUt0RCxNQUFNLENBQUUsd0RBQXlELENBQUMsQ0FBQ3VELFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQyxFQUFFO0lBQzlHLE9BQU8sSUFBSTtFQUNaLENBQUMsTUFBTTtJQUNOLE9BQU8sS0FBSztFQUNiO0FBQ0QiLCJpZ25vcmVMaXN0IjpbXX0=
