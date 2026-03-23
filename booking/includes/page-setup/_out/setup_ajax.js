"use strict";

// =====================================================================================================================
// == Ajax ==
// =====================================================================================================================
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
    if (typeof response_data !== 'object' || response_data === null) {
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

    // -------------------------------------------------------------------------------------------------
    // Auto  redirect  to  new BFB builder - templates section.
    // -------------------------------------------------------------------------------------------------
    if (undefined != response_data['ajx_cleaned_params'] && 'auto_open_template' === response_data['ajx_cleaned_params']['do_action']) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX2FqYXguanMiLCJuYW1lcyI6WyJ3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdCIsImNvbnNvbGUiLCJncm91cENvbGxhcHNlZCIsImxvZyIsIl93cGJjX3NldHRpbmdzIiwiZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9zdGFydCIsIndwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fZG9fcmVxdWVzdF9jbGVhbiIsImpRdWVyeSIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwid3BiY19hanhfdXNlcl9pZCIsImdldF9wYXJhbV9fc2VjdXJlIiwibm9uY2UiLCJ3cGJjX2FqeF9sb2NhbGUiLCJhbGxfYWp4X3BhcmFtcyIsInJlc3BvbnNlX2RhdGEiLCJ0ZXh0U3RhdHVzIiwianFYSFIiLCJncm91cEVuZCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2hpZGVfY29udGVudCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfbWVzc2FnZSIsInVuZGVmaW5lZCIsImxvY2F0aW9uIiwicmVsb2FkIiwic2V0X3BhcmFtc19hcnJfX3NldHVwX3dpemFyZCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMiLCJ3cGJjX3NldHVwX3dpemFyZF9wYWdlX19pc19hbGxfc3RlcHNfY29tcGxldGVkIiwid2luZG93IiwiaHJlZiIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9wbHVnaW5fbWVudV9wcm9ncmVzcyIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3Nob3dfY29udGVudCIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2RlZmluZV91aV9ob29rcyIsInJlcGxhY2UiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsIndwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfcmVsb2FkX2J1dHRvbl9fc3Bpbl9wYXVzZSIsIndwYmNfYnV0dG9uX19yZW1vdmVfc3BpbiIsImh0bWwiLCJmYWlsIiwiZXJyb3JUaHJvd24iLCJlcnJvcl9tZXNzYWdlIiwic3RhdHVzIiwicmVzcG9uc2VUZXh0Iiwic2V0X3BhcmFtX19zZXR1cF93aXphcmQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwL19zcmMvc2V0dXBfYWpheC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEFqYXggPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX3NlbmRfcmVxdWVzdCgpe1xyXG5cclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ1dQQkNfQUpYX1NFVFVQX1dJWkFSRF9QQUdFJyApOyBjb25zb2xlLmxvZyggJyA9PSBCZWZvcmUgQWpheCBTZW5kIC0gc2VhcmNoX2dldF9hbGxfcGFyYW1zKCkgPT0gJyAsIF93cGJjX3NldHRpbmdzLmdldF9hbGxfcGFyYW1zX19zZXR1cF93aXphcmQoKSApO1xyXG5cclxuXHQvLyBJdCBjYW4gc3RhcnQgJ2ljb24gc3Bpbm5pbmcnIG9uIHRvcCBtZW51IGJhciBhdCAnYWN0aXZlIG1lbnUgaXRlbScuXHJcblx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3N0YXJ0KCk7XHJcblxyXG5cdC8vIENsZWFyIHNvbWUgcGFyYW1ldGVycywgd2hpY2ggY2FuIG1ha2UgaXNzdWUgd2l0aCBibG9ja2luZyByZXF1ZXN0cy5cclxuXHR3cGJjX2FqeF9fc2V0dXBfd2l6YXJkX3BhZ2VfX2RvX3JlcXVlc3RfY2xlYW4oKTtcclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHR7XHJcblx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX1NFVFVQX1dJWkFSRF9QQUdFJyxcclxuXHRcdFx0XHR3cGJjX2FqeF91c2VyX2lkOiBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX3NlY3VyZSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19zZWN1cmUoICdub25jZScgKSxcclxuXHRcdFx0XHR3cGJjX2FqeF9sb2NhbGUgOiBfd3BiY19zZXR0aW5ncy5nZXRfcGFyYW1fX3NlY3VyZSggJ2xvY2FsZScgKSxcclxuXHJcblx0XHRcdFx0YWxsX2FqeF9wYXJhbXMgIDogX3dwYmNfc2V0dGluZ3MuZ2V0X2FsbF9wYXJhbXNfX3NldHVwX3dpemFyZCgpXHJcblx0XHRcdH0sXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNnLnBocFxyXG5cdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0ICogQHBhcmFtIGpxWEhSXHRcdFx0XHQtXHRPYmplY3RcclxuXHRcdFx0ICovXHJcblx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcblxyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9TRVRVUF9XSVpBUkRfUEFHRSA9PSAnLCByZXNwb25zZV9kYXRhICk7IGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdC8vIFByb2JhYmx5IEVycm9yXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblxyXG5cdFx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9faGlkZV9jb250ZW50KCk7XHJcblx0XHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGEgKTtcclxuXHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0Ly8gUmVzZXQgRG9uZSAtIFJlbG9hZCBwYWdlLCBhZnRlciBmaWx0ZXIgdG9vbGJhciBoYXMgYmVlbiByZXNldFxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRpZiAoICAoIHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdICkgJiYgKCAncmVzZXRfZG9uZScgPT09IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICdkb19hY3Rpb24nIF0gKSAgKXtcclxuXHRcdFx0XHRcdGxvY2F0aW9uLnJlbG9hZCgpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRGVmaW5lIEZyb250LUVuZCBzaWRlIEpTIHZhcnMgZnJvbSAgQWpheFxyXG5cdFx0XHRcdF93cGJjX3NldHRpbmdzLnNldF9wYXJhbXNfYXJyX19zZXR1cF93aXphcmQoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXSApO1xyXG5cclxuXHRcdFx0XHQvLyBVcGRhdGUgTWVudSBzdGF0dXNlczogVG9wIEJsYWNrIFVJIGFuZCBpbiBMZWZ0IE1haW4gbWVudVxyXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX3VwZGF0ZV9zdGVwc19zdGF0dXMoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsnc3RlcHNfaXNfZG9uZSddICk7XHJcblxyXG5cdFx0XHRcdGlmICggd3BiY19zZXR1cF93aXphcmRfcGFnZV9faXNfYWxsX3N0ZXBzX2NvbXBsZXRlZCgpICkge1xyXG5cdFx0XHRcdFx0aWYgKHVuZGVmaW5lZCAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdyZWRpcmVjdF91cmwnIF0pe1xyXG5cdFx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3JlZGlyZWN0X3VybCcgXTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdC8vIEF1dG8gIHJlZGlyZWN0ICB0byAgbmV3IEJGQiBidWlsZGVyIC0gdGVtcGxhdGVzIHNlY3Rpb24uXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdGlmICggICggdW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF0gKSAmJiAoICdhdXRvX29wZW5fdGVtcGxhdGUnID09PSByZXNwb25zZV9kYXRhWyAnYWp4X2NsZWFuZWRfcGFyYW1zJyBdWyAnZG9fYWN0aW9uJyBdICkgICl7XHJcblx0XHRcdFx0XHRpZiAodW5kZWZpbmVkICE9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3JlZGlyZWN0X3VybCcgXSl7XHJcblx0XHRcdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAncmVkaXJlY3RfdXJsJyBdO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdFx0Ly8gLT4gUHJvZ3Jlc3MgbGluZSBhdCAgXCJMZWZ0IE1haW4gTWVudVwiXHJcblx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9fdXBkYXRlX3BsdWdpbl9tZW51X3Byb2dyZXNzKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bJ3BsdWdpbl9tZW51X19zZXR1cF9wcm9ncmVzcyddICk7XHJcblxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHQvLyBTaG93IE1haW4gQ29udGVudFxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X2NvbnRlbnQoKTtcclxuXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdC8vIFJlZGVmaW5lIEhvb2tzLCBiZWNhdXNlIHdlIHNob3cgbmV3IERPTSBlbGVtZW50c1xyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19kZWZpbmVfdWlfaG9va3MoKTtcclxuXHJcblx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlc1xyXG5cdFx0XHRcdGlmICggJycgIT09IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSApe1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgKCAnMScgPT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9yZXN1bHQnIF0gKSA/ICdzdWNjZXNzJyA6ICdlcnJvcidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEl0IGNhbiBTVE9QICdpY29uIHNwaW5uaW5nJyBvbiB0b3AgbWVudSBiYXIgYXQgJ2FjdGl2ZSBtZW51IGl0ZW0nXHJcblx0XHRcdFx0d3BiY19zZXR1cF93aXphcmRfcGFnZV9yZWxvYWRfYnV0dG9uX19zcGluX3BhdXNlKCk7XHJcblxyXG5cdFx0XHRcdC8vIFJlbW92ZSBzcGluIGZyb20gXCJidXR0b24gd2l0aCBpY29uXCIsIHRoYXQgd2FzIGNsaWNrZWQgYW5kIEVuYWJsZSB0aGlzIGJ1dHRvbi5cclxuXHRcdFx0XHR3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4oIHJlc3BvbnNlX2RhdGFbICdhanhfY2xlYW5lZF9wYXJhbXMnIF1bICd1aV9jbGlja2VkX2VsZW1lbnRfaWQnIF0gKVxyXG5cclxuXHRcdFx0XHRqUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHR9XHJcblx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblxyXG5cdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdGlmICgganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKDxiPicgKyBqcVhIUi5zdGF0dXMgKyAnPC9iPiknO1xyXG5cdFx0XHRcdFx0aWYgKDQwMyA9PSBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnIFByb2JhYmx5IG5vbmNlIGZvciB0aGlzIHBhZ2UgaGFzIGJlZW4gZXhwaXJlZC4gUGxlYXNlIDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDpsb2NhdGlvbi5yZWxvYWQoKTtcIj5yZWxvYWQgdGhlIHBhZ2U8L2E+Lic7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgJyArIGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdC8vIEhpZGUgQ29udGVudFxyXG5cdFx0XHRcdHdwYmNfc2V0dXBfd2l6YXJkX3BhZ2VfX2hpZGVfY29udGVudCgpO1xyXG5cclxuXHRcdFx0XHQvLyBTaG93IEVycm9yIE1lc3NhZ2VcclxuXHRcdFx0XHR3cGJjX3NldHVwX3dpemFyZF9wYWdlX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgKTtcclxuXHRcdCAgfSlcclxuXHRcdCAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdCAgOyAgLy8gRW5kIEFqYXhcclxuXHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2xlYW4gc29tZSBwYXJhbWV0ZXJzLCAgZG9lcyBub3QgcmVxdWlyZWQgZm9yIHJlcXVlc3RcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWp4X19zZXR1cF93aXphcmRfcGFnZV9fZG9fcmVxdWVzdF9jbGVhbigpIHtcclxuXHQvLyBXZSBkb25vdCByZXF1aXJlIHRoZSAnY2FsZW5kYXJfZm9yY2VfbG9hZCcgcGFyYW1ldGVyICB3aXRoICBhbGwgaHRtbCBhbmQgc2NyaXB0cyAgY29udGVudCBhdCAgc2VydmVyIHNpZGUuIFRoaXMgY29udGVudCBnZW5lcmF0ZWQgYXQgc2VydmVyIHNpZGUuXHJcblx0Ly8gSXQgaXMgYWxzbyBjYW4gYmUgdGhlIHJlYXNvbiBvZiBibG9ja2luZyByZXF1ZXN0LCBiZWNhdXNlIG9mIHNjcmlwdCB0YWdzLlxyXG5cdF93cGJjX3NldHRpbmdzLnNldF9wYXJhbV9fc2V0dXBfd2l6YXJkKCdjYWxlbmRhcl9mb3JjZV9sb2FkJywgJycpO1xyXG59Il0sIm1hcHBpbmdzIjoiQUFBQSxZQUFZOztBQUNaO0FBQ0E7QUFDQTtBQUVBLFNBQVNBLHlDQUF5Q0EsQ0FBQSxFQUFFO0VBRXBEQyxPQUFPLENBQUNDLGNBQWMsQ0FBRSw0QkFBNkIsQ0FBQztFQUFFRCxPQUFPLENBQUNFLEdBQUcsQ0FBRSxvREFBb0QsRUFBR0MsY0FBYyxDQUFDQyw0QkFBNEIsQ0FBQyxDQUFFLENBQUM7O0VBRTFLO0VBQ0FDLGdEQUFnRCxDQUFDLENBQUM7O0VBRWxEO0VBQ0FD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
