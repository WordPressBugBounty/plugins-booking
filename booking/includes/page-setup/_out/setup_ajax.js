"use strict";

// =====================================================================================================================
// == Ajax ==
// =====================================================================================================================
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
function wpbc_ajx__setup_wizard_page__send_request() {
  console.groupCollapsed('WPBC_AJX_SETUP_WIZARD_PAGE');
  console.log(' == Before Ajax Send - search_get_all_params() == ', _wpbc_settings.get_all_params__setup_wizard());

  // It can start 'icon spinning' on top menu bar at 'active menu item'.
  wpbc_setup_wizard_page_reload_button__spin_start();

  // Clear some parameters, which can make issue with blocking requests.
  wpbc_ajx__setup_wizard_page__do_request_clean();

  // Start Ajax
  jQuery.post(wpbc_url_ajax, {
    action: 'WPBC_AJX_SETUP_WIZARD_PAGE',
    wpbc_ajx_user_id: _wpbc_settings.get_param__secure('user_id'),
    nonce: _wpbc_settings.get_param__secure('nonce'),
    wpbc_ajx_locale: _wpbc_settings.get_param__secure('locale'),
    all_ajx_params: _wpbc_settings.get_all_params__setup_wizard()
  },
  /**
   * S u c c e s s
   *
   * @param response_data		-	its object returned from  Ajax - class-live-searcg.php
   * @param textStatus		-	'success'
   * @param jqXHR				-	Object
   */
  function (response_data, textStatus, jqXHR) {
    console.log(' == Response WPBC_AJX_SETUP_WIZARD_PAGE == ', response_data);
    console.groupEnd();

    // -------------------------------------------------------------------------------------------------
    // Probably Error
    // -------------------------------------------------------------------------------------------------
    if (_typeof(response_data) !== 'object' || response_data === null) {
      wpbc_setup_wizard_page__hide_content();
      wpbc_setup_wizard_page__show_message(response_data);
      return;
    }

    // -------------------------------------------------------------------------------------------------
    // Reset Done - Reload page, after filter toolbar has been reset
    // -------------------------------------------------------------------------------------------------
    if (undefined != response_data['ajx_cleaned_params'] && 'reset_done' === response_data['ajx_cleaned_params']['do_action']) {
      location.reload();
      return;
    }

    // Define Front-End side JS vars from  Ajax
    _wpbc_settings.set_params_arr__setup_wizard(response_data['ajx_data']);

    // Update Menu statuses: Top Black UI and in Left Main menu
    wpbc_setup_wizard_page__update_steps_status(response_data['ajx_data']['steps_is_done']);
    if (wpbc_setup_wizard_page__is_all_steps_completed()) {
      if (undefined != response_data['ajx_data']['redirect_url']) {
        window.location.href = response_data['ajx_data']['redirect_url'];
        return;
      }
    }

    // -> Progress line at  "Left Main Menu"
    wpbc_setup_wizard_page__update_plugin_menu_progress(response_data['ajx_data']['plugin_menu__setup_progress']);

    // -------------------------------------------------------------------------------------------------
    // Show Main Content
    // -------------------------------------------------------------------------------------------------
    wpbc_setup_wizard_page__show_content();

    // -------------------------------------------------------------------------------------------------
    // Redefine Hooks, because we show new DOM elements
    // -------------------------------------------------------------------------------------------------
    wpbc_setup_wizard_page__define_ui_hooks();

    // Show Messages
    if ('' !== response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />")) {
      wpbc_admin_show_message(response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />"), '1' == response_data['ajx_data']['ajx_after_action_result'] ? 'success' : 'error', 10000);
    }

    // It can STOP 'icon spinning' on top menu bar at 'active menu item'
    wpbc_setup_wizard_page_reload_button__spin_pause();

    // Remove spin from "button with icon", that was clicked and Enable this button.
    wpbc_button__remove_spin(response_data['ajx_cleaned_params']['ui_clicked_element_id']);
    jQuery('#ajax_respond').html(response_data); // For ability to show response, add such DIV element to page
  }).fail(function (jqXHR, textStatus, errorThrown) {
    if (window.console && window.console.log) {
      console.log('Ajax_Error', jqXHR, textStatus, errorThrown);
    }
    var error_message = '<strong>' + 'Error!' + '</strong> ' + errorThrown;
    if (jqXHR.status) {
      error_message += ' (<b>' + jqXHR.status + '</b>)';
      if (403 == jqXHR.status) {
        error_message += ' Probably nonce for this page has been expired. Please <a href="javascript:void(0)" onclick="javascript:location.reload();">reload the page</a>.';
      }
    }
    if (jqXHR.responseText) {
      error_message += ' ' + jqXHR.responseText;
    }
    error_message = error_message.replace(/\n/g, "<br />");

    // Hide Content
    wpbc_setup_wizard_page__hide_content();

    // Show Error Message
    wpbc_setup_wizard_page__show_message(error_message);
  })
  // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
  ; // End Ajax
}

/**
 * Clean some parameters,  does not required for request
 */
function wpbc_ajx__setup_wizard_page__do_request_clean() {
  // We donot require the 'calendar_force_load' parameter  with  all html and scripts  content at  server side. This content generated at server side.
  // It is also can be the reason of blocking request, because of script tags.
  _wpbc_settings.set_param__setup_wizard('calendar_force_load', '');
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX2FqYXguanMiLCJuYW1lcyI6WyJfdHlwZW9mIiwib2JqIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJjb25zdHJ1Y3RvciIsInByb3RvdHlwZSIsIndwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fc2VuZF9yZXF1ZXN0IiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwibG9nIiwiX3dwYmNfc2V0dGluZ3MiLCJnZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0Iiwid3BiY19hanhfX3NldHVwX3dpemFyZF9wYWdlX19kb19yZXF1ZXN0X2NsZWFuIiwialF1ZXJ5IiwicG9zdCIsIndwYmNfdXJsX2FqYXgiLCJhY3Rpb24iLCJ3cGJjX2FqeF91c2VyX2lkIiwiZ2V0X3BhcmFtX19zZWN1cmUiLCJub25jZSIsIndwYmNfYWp4X2xvY2FsZSIsImFsbF9hanhfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9faGlkZV9jb250ZW50Iiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fc2hvd19tZXNzYWdlIiwidW5kZWZpbmVkIiwibG9jYXRpb24iLCJyZWxvYWQiLCJzZXRfcGFyYW1zX2Fycl9fc2V0dXBfd2l6YXJkIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fdXBkYXRlX3N0ZXBzX3N0YXR1cyIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQiLCJ3aW5kb3ciLCJocmVmIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fdXBkYXRlX3BsdWdpbl9tZW51X3Byb2dyZXNzIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fc2hvd19jb250ZW50Iiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fZGVmaW5lX3VpX2hvb2tzIiwicmVwbGFjZSIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwid3BiY19idXR0b25fX3JlbW92ZV9zcGluIiwiaHRtbCIsImZhaWwiLCJlcnJvclRocm93biIsImVycm9yX21lc3NhZ2UiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiLCJzZXRfcGFyYW1fX3NldHVwX3dpemFyZCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAvX3NyYy9zZXR1cF9hamF4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gQWpheCA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fc2VuZF9yZXF1ZXN0KCl7XHJcblxyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfU0VUVVBfV0laQVJEX1BBR0UnICk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBzZWFyY2hfZ2V0X2FsbF9wYXJhbXMoKSA9PSAnICwgX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpICk7XHJcblxyXG5cdC8vIEl0IGNhbiBzdGFydCAnaWNvbiBzcGlubmluZycgb24gdG9wIG1lbnUgYmFyIGF0ICdhY3RpdmUgbWVudSBpdGVtJy5cclxuXHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX3NwaW5fc3RhcnQoKTtcclxuXHJcblx0Ly8gQ2xlYXIgc29tZSBwYXJhbWV0ZXJzLCB3aGljaCBjYW4gbWFrZSBpc3N1ZSB3aXRoIGJsb2NraW5nIHJlcXVlc3RzLlxyXG5cdHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fZG9fcmVxdWVzdF9jbGVhbigpO1xyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdHtcclxuXHRcdFx0XHRhY3Rpb24gICAgICAgICAgOiAnV1BCQ19BSlhfU0VUVVBfV0laQVJEX1BBR0UnLFxyXG5cdFx0XHRcdHdwYmNfYWp4X3VzZXJfaWQ6IF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fc2VjdXJlKCAndXNlcl9pZCcgKSxcclxuXHRcdFx0XHRub25jZSAgICAgICAgICAgOiBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX3NlY3VyZSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdHdwYmNfYWp4X2xvY2FsZSA6IF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fc2VjdXJlKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRhbGxfYWp4X3BhcmFtcyAgOiBfd3BiY19zZXR0aW5ncy5nZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkKClcclxuXHRcdFx0fSxcclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcdFx0LVx0aXRzIG9iamVjdCByZXR1cm5lZCBmcm9tICBBamF4IC0gY2xhc3MtbGl2ZS1zZWFyY2cucGhwXHJcblx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHQgKi9cclxuXHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuXHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX1NFVFVQX1dJWkFSRF9QQUdFID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHJcblx0XHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19oaWRlX2NvbnRlbnQoKTtcclxuXHRcdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHQvLyBSZXNldCBEb25lIC0gUmVsb2FkIHBhZ2UsIGFmdGVyIGZpbHRlciB0b29sYmFyIGhhcyBiZWVuIHJlc2V0XHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdGlmICggICggdW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0gKSAmJiAoICdyZXNldF9kb25lJyA9PT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ2RvX2FjdGlvbicgXSApICApe1xyXG5cdFx0XHRcdFx0bG9jYXRpb24ucmVsb2FkKCk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBEZWZpbmUgRnJvbnQtRW5kIHNpZGUgSlMgdmFycyBmcm9tICBBamF4XHJcblx0XHRcdFx0X3dwYmNfc2V0dGluZ3Muc2V0X3BhcmFtc19hcnJfX3NldHVwX3dpemFyZCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdICk7XHJcblxyXG5cdFx0XHRcdC8vIFVwZGF0ZSBNZW51IHN0YXR1c2VzOiBUb3AgQmxhY2sgVUkgYW5kIGluIExlZnQgTWFpbiBtZW51XHJcblx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9fdXBkYXRlX3N0ZXBzX3N0YXR1cyggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWydzdGVwc19pc19kb25lJ10gKTtcclxuXHJcblx0XHRcdFx0aWYgKCB3cGJjX3NldHVwX3dpemFyZF9wYWdlX19pc19hbGxfc3RlcHNfY29tcGxldGVkKCkgKSB7XHJcblx0XHRcdFx0XHRpZiAodW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3JlZGlyZWN0X3VybCcgXSl7XHJcblx0XHRcdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAncmVkaXJlY3RfdXJsJyBdO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdFx0Ly8gLT4gUHJvZ3Jlc3MgbGluZSBhdCAgXCJMZWZ0IE1haW4gTWVudVwiXHJcblx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9fdXBkYXRlX3BsdWdpbl9tZW51X3Byb2dyZXNzKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bJ3BsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzcyddICk7XHJcblxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHQvLyBTaG93IE1haW4gQ29udGVudFxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X2NvbnRlbnQoKTtcclxuXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzLCBiZWNhdXNlIHdlIHNob3cgbmV3IERPTSBlbGVtZW50c1xyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19kZWZpbmVfdWlfaG9va3MoKTtcclxuXHJcblx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlc1xyXG5cdFx0XHRcdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSApe1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgKCAnMScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHQnIF0gKSA/ICdzdWNjZXNzJyA6ICdlcnJvcidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEl0IGNhbiBTVE9QICdpY29uIHNwaW5uaW5nJyBvbiB0b3AgbWVudSBiYXIgYXQgJ2FjdGl2ZSBtZW51IGl0ZW0nXHJcblx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblxyXG5cdFx0XHRcdC8vIFJlbW92ZSBzcGluIGZyb20gXCJidXR0b24gd2l0aCBpY29uXCIsIHRoYXQgd2FzIGNsaWNrZWQgYW5kIEVuYWJsZSB0aGlzIGJ1dHRvbi5cclxuXHRcdFx0XHR3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oIHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0gKVxyXG5cclxuXHRcdFx0XHRqUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHR9XHJcblx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblxyXG5cdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdGlmICgganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKDxiPicgKyBqcVhIUi5zdGF0dXMgKyAnPC9iPiknO1xyXG5cdFx0XHRcdFx0aWYgKDQwMyA9PSBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnIFByb2JhYmx5IG5vbmNlIGZvciB0aGlzIHBhZ2UgaGFzIGJlZW4gZXhwaXJlZC4gUGxlYXNlIDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDpsb2NhdGlvbi5yZWxvYWQoKTtcIj5yZWxvYWQgdGhlIHBhZ2U8L2E+Lic7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgJyArIGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdC8vIEhpZGUgQ29udGVudFxyXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2hpZGVfY29udGVudCgpO1xyXG5cclxuXHRcdFx0XHQvLyBTaG93IEVycm9yIE1lc3NhZ2VcclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdCAgfSlcclxuXHRcdCAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdCAgOyAgLy8gRW5kIEFqYXhcclxuXHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2xlYW4gc29tZSBwYXJhbWV0ZXJzLCAgZG9lcyBub3QgcmVxdWlyZWQgZm9yIHJlcXVlc3RcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fZG9fcmVxdWVzdF9jbGVhbigpIHtcclxuXHQvLyBXZSBkb25vdCByZXF1aXJlIHRoZSAnY2FsZW5kYXJfZm9yY2VfbG9hZCcgcGFyYW1ldGVyICB3aXRoICBhbGwgaHRtbCBhbmQgc2NyaXB0cyAgY29udGVudCBhdCAgc2VydmVyIHNpZGUuIFRoaXMgY29udGVudCBnZW5lcmF0ZWQgYXQgc2VydmVyIHNpZGUuXHJcblx0Ly8gSXQgaXMgYWxzbyBjYW4gYmUgdGhlIHJlYXNvbiBvZiBibG9ja2luZyByZXF1ZXN0LCBiZWNhdXNlIG9mIHNjcmlwdCB0YWdzLlxyXG5cdF93cGJjX3NldHRpbmdzLnNldF9wYXJhbV9fc2V0dXBfd2l6YXJkKCdjYWxlbmRhcl9mb3JjZV9sb2FkJywgJycpO1xyXG59Il0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUNaO0FBQ0E7QUFDQTtBQUFBLFNBQUFBLFFBQUFDLEdBQUEsc0NBQUFELE9BQUEsd0JBQUFFLE1BQUEsdUJBQUFBLE1BQUEsQ0FBQUMsUUFBQSxhQUFBRixHQUFBLGtCQUFBQSxHQUFBLGdCQUFBQSxHQUFBLFdBQUFBLEdBQUEseUJBQUFDLE1BQUEsSUFBQUQsR0FBQSxDQUFBRyxXQUFBLEtBQUFGLE1BQUEsSUFBQUQsR0FBQSxLQUFBQyxNQUFBLENBQUFHLFNBQUEscUJBQUFKLEdBQUEsS0FBQUQsT0FBQSxDQUFBQyxHQUFBO0FBRUEsU0FBU0sseUNBQXlDQSxDQUFBLEVBQUU7RUFFcERDLE9BQU8sQ0FBQ0MsY0FBYyxDQUFFLDRCQUE2QixDQUFDO0VBQUVELE9BQU8sQ0FBQ0UsR0FBRyxDQUFFLG9EQUFvRCxFQUFHQyxjQUFjLENBQUNDLDRCQUE0QixDQUFDLENBQUUsQ0FBQzs7RUFFMUs7RUFDQUMsZ0RBQWdELENBQUMsQ0FBQzs7RUFFbEQ7RUFDQUMsNkNBQTZDLENBQUMsQ0FBQzs7RUFFL0M7RUFDQUMsTUFBTSxDQUFDQyxJQUFJLENBQUVDLGFBQWEsRUFDeEI7SUFDQ0MsTUFBTSxFQUFZLDRCQUE0QjtJQUM5Q0MsZ0JBQWdCLEVBQUVSLGNBQWMsQ0FBQ1MsaUJBQWlCLENBQUUsU0FBVSxDQUFDO0lBQy9EQyxLQUFLLEVBQWFWLGNBQWMsQ0FBQ1MsaUJBQWlCLENBQUUsT0FBUSxDQUFDO0lBQzdERSxlQUFlLEVBQUdYLGNBQWMsQ0FBQ1MsaUJBQWlCLENBQUUsUUFBUyxDQUFDO0lBRTlERyxjQUFjLEVBQUlaLGNBQWMsQ0FBQ0MsNEJBQTRCLENBQUM7RUFDL0QsQ0FBQztFQUNEO0FBQ0g7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0csVUFBV1ksYUFBYSxFQUFFQyxVQUFVLEVBQUVDLEtBQUssRUFBRztJQUVqRGxCLE9BQU8s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
