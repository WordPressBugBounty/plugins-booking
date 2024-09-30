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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX2FqYXguanMiLCJuYW1lcyI6WyJfdHlwZW9mIiwib2JqIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJjb25zdHJ1Y3RvciIsInByb3RvdHlwZSIsIndwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fc2VuZF9yZXF1ZXN0IiwiY29uc29sZSIsImdyb3VwQ29sbGFwc2VkIiwibG9nIiwiX3dwYmNfc2V0dGluZ3MiLCJnZXRfYWxsX3BhcmFtc19fc2V0dXBfd2l6YXJkIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0IiwialF1ZXJ5IiwicG9zdCIsIndwYmNfdXJsX2FqYXgiLCJhY3Rpb24iLCJ3cGJjX2FqeF91c2VyX2lkIiwiZ2V0X3BhcmFtX19zZWN1cmUiLCJub25jZSIsIndwYmNfYWp4X2xvY2FsZSIsImFsbF9hanhfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9faGlkZV9jb250ZW50Iiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fc2hvd19tZXNzYWdlIiwidW5kZWZpbmVkIiwibG9jYXRpb24iLCJyZWxvYWQiLCJzZXRfcGFyYW1zX2Fycl9fc2V0dXBfd2l6YXJkIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fdXBkYXRlX3N0ZXBzX3N0YXR1cyIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQiLCJ3aW5kb3ciLCJocmVmIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fdXBkYXRlX3BsdWdpbl9tZW51X3Byb2dyZXNzIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fc2hvd19jb250ZW50Iiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9fZGVmaW5lX3VpX2hvb2tzIiwicmVwbGFjZSIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwid3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlIiwid3BiY19idXR0b25fX3JlbW92ZV9zcGluIiwiaHRtbCIsImZhaWwiLCJlcnJvclRocm93biIsImVycm9yX21lc3NhZ2UiLCJzdGF0dXMiLCJyZXNwb25zZVRleHQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwL19zcmMvc2V0dXBfYWpheC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEFqYXggPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdCgpe1xyXG5cclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ1dQQkNfQUpYX1NFVFVQX1dJWkFSRF9QQUdFJyApOyBjb25zb2xlLmxvZyggJyA9PSBCZWZvcmUgQWpheCBTZW5kIC0gc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgPT0gJyAsIF93cGJjX3NldHRpbmdzLmdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQoKSApO1xyXG5cclxuXHQvLyBJdCBjYW4gc3RhcnQgJ2ljb24gc3Bpbm5pbmcnIG9uIHRvcCBtZW51IGJhciBhdCAnYWN0aXZlIG1lbnUgaXRlbScuXHJcblx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG5cdC8vIFN0YXJ0IEFqYXhcclxuXHRqUXVlcnkucG9zdCggd3BiY191cmxfYWpheCxcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9TRVRVUF9XSVpBUkRfUEFHRScsXHJcblx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19zZWN1cmUoICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdG5vbmNlICAgICAgICAgICA6IF93cGJjX3NldHRpbmdzLmdldF9wYXJhbV9fc2VjdXJlKCAnbm9uY2UnICksXHJcblx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19zZWN1cmUoICdsb2NhbGUnICksXHJcblxyXG5cdFx0XHRcdGFsbF9hanhfcGFyYW1zICA6IF93cGJjX3NldHRpbmdzLmdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQoKVxyXG5cdFx0XHR9LFxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogUyB1IGMgYyBlIHMgc1xyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjZy5waHBcclxuXHRcdFx0ICogQHBhcmFtIHRleHRTdGF0dXNcdFx0LVx0J3N1Y2Nlc3MnXHJcblx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiAoIHJlc3BvbnNlX2RhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkge1xyXG5cclxuY29uc29sZS5sb2coICcgPT0gUmVzcG9uc2UgV1BCQ19BSlhfU0VUVVBfV0laQVJEX1BBR0UgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRpZiAoICh0eXBlb2YgcmVzcG9uc2VfZGF0YSAhPT0gJ29iamVjdCcpIHx8IChyZXNwb25zZV9kYXRhID09PSBudWxsKSApe1xyXG5cclxuXHRcdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2hpZGVfY29udGVudCgpO1xyXG5cdFx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhICk7XHJcblxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdC8vIFJlc2V0IERvbmUgLSBSZWxvYWQgcGFnZSwgYWZ0ZXIgZmlsdGVyIHRvb2xiYXIgaGFzIGJlZW4gcmVzZXRcclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0aWYgKCAgKCB1bmRlZmluZWQgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXSApICYmICggJ3Jlc2V0X2RvbmUnID09PSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAnZG9fYWN0aW9uJyBdICkgICl7XHJcblx0XHRcdFx0XHRsb2NhdGlvbi5yZWxvYWQoKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIERlZmluZSBGcm9udC1FbmQgc2lkZSBKUyB2YXJzIGZyb20gIEFqYXhcclxuXHRcdFx0XHRfd3BiY19zZXR0aW5ncy5zZXRfcGFyYW1zX2Fycl9fc2V0dXBfd2l6YXJkKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0gKTtcclxuXHJcblx0XHRcdFx0Ly8gVXBkYXRlIE1lbnUgc3RhdHVzZXM6IFRvcCBCbGFjayBVSSBhbmQgaW4gTGVmdCBNYWluIG1lbnVcclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfc3RlcHNfc3RhdHVzKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bJ3N0ZXBzX2lzX2RvbmUnXSApO1xyXG5cclxuXHRcdFx0XHRpZiAoIHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2lzX2FsbF9zdGVwc19jb21wbGV0ZWQoKSApIHtcclxuXHRcdFx0XHRcdGlmICh1bmRlZmluZWQgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAncmVkaXJlY3RfdXJsJyBdKXtcclxuXHRcdFx0XHRcdFx0d2luZG93LmxvY2F0aW9uLmhyZWYgPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdyZWRpcmVjdF91cmwnIF07XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0XHQvLyAtPiBQcm9ncmVzcyBsaW5lIGF0ICBcIkxlZnQgTWFpbiBNZW51XCJcclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX191cGRhdGVfcGx1Z2luX21lbnVfcHJvZ3Jlc3MoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsncGx1Z2luX21lbnVfX3NldHVwX3Byb2dyZXNzJ10gKTtcclxuXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdC8vIFNob3cgTWFpbiBDb250ZW50XHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCgpO1xyXG5cclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0Ly8gUmVkZWZpbmUgSG9va3MsIGJlY2F1c2Ugd2Ugc2hvdyBuZXcgRE9NIGVsZW1lbnRzXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2RlZmluZV91aV9ob29rcygpO1xyXG5cclxuXHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VzXHJcblx0XHRcdFx0aWYgKCAnJyAhPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApICl7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAoICcxJyA9PSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX3Jlc3VsdCcgXSApID8gJ3N1Y2Nlc3MnIDogJ2Vycm9yJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gSXQgY2FuIFNUT1AgJ2ljb24gc3Bpbm5pbmcnIG9uIHRvcCBtZW51IGJhciBhdCAnYWN0aXZlIG1lbnUgaXRlbSdcclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX3JlbG9hZF9idXR0b25fX3NwaW5fcGF1c2UoKTtcclxuXHJcblx0XHRcdFx0Ly8gUmVtb3ZlIHNwaW4gZnJvbSBcImJ1dHRvbiB3aXRoIGljb25cIiwgdGhhdCB3YXMgY2xpY2tlZCBhbmQgRW5hYmxlIHRoaXMgYnV0dG9uLlxyXG5cdFx0XHRcdHdwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiggcmVzcG9uc2VfZGF0YVsgJ2FqeF9jbGVhbmVkX3BhcmFtcycgXVsgJ3VpX2NsaWNrZWRfZWxlbWVudF9pZCcgXSApXHJcblxyXG5cdFx0XHRcdGpRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdH1cclxuXHRcdCAgKS5mYWlsKCBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHsgICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdBamF4X0Vycm9yJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7IH1cclxuXHJcblx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0aWYgKCBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAoPGI+JyArIGpxWEhSLnN0YXR1cyArICc8L2I+KSc7XHJcblx0XHRcdFx0XHRpZiAoNDAzID09IGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgUHJvYmFibHkgbm9uY2UgZm9yIHRoaXMgcGFnZSBoYXMgYmVlbiBleHBpcmVkLiBQbGVhc2UgPGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIG9uY2xpY2s9XCJqYXZhc2NyaXB0OmxvY2F0aW9uLnJlbG9hZCgpO1wiPnJlbG9hZCB0aGUgcGFnZTwvYT4uJztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBqcVhIUi5yZXNwb25zZVRleHQgKXtcclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAnICsganFYSFIucmVzcG9uc2VUZXh0O1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0Ly8gSGlkZSBDb250ZW50XHJcblx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9faGlkZV9jb250ZW50KCk7XHJcblxyXG5cdFx0XHRcdC8vIFNob3cgRXJyb3IgTWVzc2FnZVxyXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSggZXJyb3JfbWVzc2FnZSApO1xyXG5cdFx0ICB9KVxyXG5cdFx0ICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0ICA7ICAvLyBFbmQgQWpheFxyXG5cclxufVxyXG4iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBQ1o7QUFDQTtBQUNBO0FBQUEsU0FBQUEsUUFBQUMsR0FBQSxzQ0FBQUQsT0FBQSx3QkFBQUUsTUFBQSx1QkFBQUEsTUFBQSxDQUFBQyxRQUFBLGFBQUFGLEdBQUEsa0JBQUFBLEdBQUEsZ0JBQUFBLEdBQUEsV0FBQUEsR0FBQSx5QkFBQUMsTUFBQSxJQUFBRCxHQUFBLENBQUFHLFdBQUEsS0FBQUYsTUFBQSxJQUFBRCxHQUFBLEtBQUFDLE1BQUEsQ0FBQUcsU0FBQSxxQkFBQUosR0FBQSxLQUFBRCxPQUFBLENBQUFDLEdBQUE7QUFFQSxTQUFTSyx5Q0FBeUNBLENBQUEsRUFBRTtFQUVwREMsT0FBTyxDQUFDQyxjQUFjLENBQUUsNEJBQTZCLENBQUM7RUFBRUQsT0FBTyxDQUFDRSxHQUFHLENBQUUsb0RBQW9ELEVBQUdDLGNBQWMsQ0FBQ0MsNEJBQTRCLENBQUMsQ0FBRSxDQUFDOztFQUUxSztFQUNBQyxnREFBZ0QsQ0FBQyxDQUFDOztFQUVsRDtFQUNBQyxNQUFNLENBQUNDLElBQUksQ0FBRUMsYUFBYSxFQUN4QjtJQUNDQyxNQUFNLEVBQVksNEJBQTRCO0lBQzlDQyxnQkFBZ0IsRUFBRVAsY0FBYyxDQUFDUSxpQkFBaUIsQ0FBRSxTQUFVLENBQUM7SUFDL0RDLEtBQUssRUFBYVQsY0FBYyxDQUFDUSxpQkFBaUIs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
