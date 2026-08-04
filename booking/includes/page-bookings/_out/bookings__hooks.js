"use strict";

/**
 * Define HTML ui Hooks: on KeyUp | Change | -> Sort Order & Number Items / Page
 * * We are chnaged it once, because such  elements always the same
 */
function wpbc_ajx_booking_define_ui_hooks_once() {
  //------------------------------------------------------------------------------------------------------------------
  // Booked dates
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_booking_date').on('change', function (event) {
    var changed_value = JSON.parse(jQuery('#wh_booking_date').val());
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_booking_date': changed_value,
      'page_num': 1,
      // Frontend selected elements (saving for future use, after F5)
      'ui_wh_booking_date_radio': jQuery('input[name="ui_wh_booking_date_radio"]:checked').val(),
      'ui_wh_booking_date_next': jQuery('#ui_wh_booking_date_next').val(),
      'ui_wh_booking_date_prior': jQuery('#ui_wh_booking_date_prior').val(),
      'ui_wh_booking_date_checkin': jQuery('#ui_wh_booking_date_checkin').val(),
      'ui_wh_booking_date_checkout': jQuery('#ui_wh_booking_date_checkout').val()
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Approved | Pending | All
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_approved').on('change', function (event) {
    var changed_value = jQuery('#wh_approved').val();
    changed_value = JSON.parse(changed_value);
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_approved': changed_value[0],
      'page_num': 1
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Keywords
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wpbc_search_field').on("keyup", function (event) {
    if (13 !== event.which) {
      wpbc_ajx_booking_searching_after_few_seconds('#wpbc_search_field'); // Searching after 1.5 seconds after Key Up
    } else {
      wpbc_ajx_booking_searching_after_few_seconds('#wpbc_search_field', 0); // Immediate search
    }
  });

  //------------------------------------------------------------------------------------------------------------------
  // Existing | Trash | Any
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_trash').on('change', function (event) {
    var changed_value = JSON.parse(jQuery('#wh_trash').val());
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_trash': changed_value[0],
      'page_num': 1
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // All bookings | New bookings
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_what_bookings').on('change', function (event) {
    var changed_value = JSON.parse(jQuery('#wh_what_bookings').val());
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_what_bookings': changed_value[0],
      'page_num': 1
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // "Creation Date"   of bookings
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_modification_date').on('change', function (event) {
    var changed_value = JSON.parse(jQuery('#wh_modification_date').val());
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_modification_date': changed_value,
      'page_num': 1,
      // Frontend selected elements (saving for future use, after F5)
      'ui_wh_modification_date_radio': jQuery('input[name="ui_wh_modification_date_radio"]:checked').val(),
      'ui_wh_modification_date_prior': jQuery('#ui_wh_modification_date_prior').val(),
      'ui_wh_modification_date_checkin': jQuery('#ui_wh_modification_date_checkin').val(),
      'ui_wh_modification_date_checkout': jQuery('#ui_wh_modification_date_checkout').val()
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Payment Status
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_pay_status').on('change', function (event) {
    var changed_value = JSON.parse(jQuery('#wh_pay_status').val());
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_pay_status': changed_value,
      'page_num': 1,
      // Frontend selected elements (saving for future use, after F5)
      'ui_wh_pay_status_radio': undefined === jQuery('input[name="ui_wh_pay_status_radio"]:checked').val() ? '' : jQuery('input[name="ui_wh_pay_status_radio"]:checked').val(),
      'ui_wh_pay_status_custom': jQuery('#ui_wh_pay_status_custom').val()
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Min Cost
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_cost').on('change', function (event) {
    var changed_value = jQuery('#wh_cost').val();
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_cost': changed_value,
      'page_num': 1
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Max Cost
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_cost2').on('change', function (event) {
    var changed_value = jQuery('#wh_cost2').val();
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_cost2': changed_value,
      'page_num': 1
    });
  });

  //------------------------------------------------------------------------------------------------------------------
  // Reusable Chosen listing filters, such as Booking resources/Providers and Appointment Services.
  //------------------------------------------------------------------------------------------------------------------
  jQuery('select[data-wpbc-listing-filter-param]').on('change', function () {
    var listing_filter_param = jQuery(this).attr('data-wpbc-listing-filter-param');
    var changed_value;
    var request_updates;
    if (!listing_filter_param) {
      return;
    }
    changed_value = 'function' === typeof window.wpbc_ui_chosen_filter_get_request_value ? window.wpbc_ui_chosen_filter_get_request_value(this) : jQuery(this).val();
    request_updates = {
      'page_num': 1
    };
    request_updates[listing_filter_param] = changed_value;
    wpbc_ajx_booking_send_search_request_with_params(request_updates);
  });

  //------------------------------------------------------------------------------------------------------------------
  // Sorting
  //------------------------------------------------------------------------------------------------------------------
  jQuery('#wh_sort').on('change', function (event) {
    var changed_value = jQuery('#wh_sort').val();
    changed_value = JSON.parse(changed_value);
    wpbc_ajx_booking_send_search_request_with_params({
      'wh_sort': changed_value[0]
    });
  });
}
jQuery(document).ready(function () {
  wpbc_ajx_booking_define_ui_hooks_once();
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fb3V0L2Jvb2tpbmdzX19ob29rcy5qcyIsIm5hbWVzIjpbIndwYmNfYWp4X2Jvb2tpbmdfZGVmaW5lX3VpX2hvb2tzX29uY2UiLCJqUXVlcnkiLCJvbiIsImV2ZW50IiwiY2hhbmdlZF92YWx1ZSIsIkpTT04iLCJwYXJzZSIsInZhbCIsIndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyIsIndoaWNoIiwid3BiY19hanhfYm9va2luZ19zZWFyY2hpbmdfYWZ0ZXJfZmV3X3NlY29uZHMiLCJ1bmRlZmluZWQiLCJsaXN0aW5nX2ZpbHRlcl9wYXJhbSIsImF0dHIiLCJyZXF1ZXN0X3VwZGF0ZXMiLCJ3aW5kb3ciLCJ3cGJjX3VpX2Nob3Nlbl9maWx0ZXJfZ2V0X3JlcXVlc3RfdmFsdWUiLCJkb2N1bWVudCIsInJlYWR5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1ib29raW5ncy9fc3JjL2Jvb2tpbmdzX19ob29rcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcInVzZSBzdHJpY3RcIjtcclxuXHJcbi8qKlxyXG4gKiBEZWZpbmUgSFRNTCB1aSBIb29rczogb24gS2V5VXAgfCBDaGFuZ2UgfCAtPiBTb3J0IE9yZGVyICYgTnVtYmVyIEl0ZW1zIC8gUGFnZVxyXG4gKiAqIFdlIGFyZSBjaG5hZ2VkIGl0IG9uY2UsIGJlY2F1c2Ugc3VjaCAgZWxlbWVudHMgYWx3YXlzIHRoZSBzYW1lXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rc19vbmNlKCl7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQm9va2VkIGRhdGVzXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRqUXVlcnkoICcjd2hfYm9va2luZ19kYXRlJyApLm9uKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblxyXG5cdFx0dmFyIGNoYW5nZWRfdmFsdWUgPSBKU09OLnBhcnNlKCBqUXVlcnkoICcjd2hfYm9va2luZ19kYXRlJyApLnZhbCgpICk7XHJcblxyXG5cdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aF9ib29raW5nX2RhdGUnOiBjaGFuZ2VkX3ZhbHVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRnJvbnRlbmQgc2VsZWN0ZWQgZWxlbWVudHMgKHNhdmluZyBmb3IgZnV0dXJlIHVzZSwgYWZ0ZXIgRjUpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV93aF9ib29raW5nX2RhdGVfcmFkaW8nICAgOiBqUXVlcnkoICdpbnB1dFtuYW1lPVwidWlfd2hfYm9va2luZ19kYXRlX3JhZGlvXCJdOmNoZWNrZWQnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV93aF9ib29raW5nX2RhdGVfbmV4dCcgICAgOiBqUXVlcnkoICcjdWlfd2hfYm9va2luZ19kYXRlX25leHQnICkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV93aF9ib29raW5nX2RhdGVfcHJpb3InICAgOiBqUXVlcnkoICcjdWlfd2hfYm9va2luZ19kYXRlX3ByaW9yJyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfd2hfYm9va2luZ19kYXRlX2NoZWNraW4nIDogalF1ZXJ5KCAnI3VpX3doX2Jvb2tpbmdfZGF0ZV9jaGVja2luJyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfd2hfYm9va2luZ19kYXRlX2NoZWNrb3V0JzogalF1ZXJ5KCAnI3VpX3doX2Jvb2tpbmdfZGF0ZV9jaGVja291dCcgKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdH0gKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBBcHByb3ZlZCB8IFBlbmRpbmcgfCBBbGxcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJyN3aF9hcHByb3ZlZCcgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cclxuXHRcdHZhciBjaGFuZ2VkX3ZhbHVlID0galF1ZXJ5KCAnI3doX2FwcHJvdmVkJyApLnZhbCgpO1xyXG5cclxuXHRcdGNoYW5nZWRfdmFsdWUgPSBKU09OLnBhcnNlKCBjaGFuZ2VkX3ZhbHVlICk7XHJcblxyXG5cdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aF9hcHByb3ZlZCc6IGNoYW5nZWRfdmFsdWVbIDAgXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJyAgIDogMVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdH0gKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBLZXl3b3Jkc1xyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0alF1ZXJ5KCAnI3dwYmNfc2VhcmNoX2ZpZWxkJyApLm9uKCBcImtleXVwXCIsIGZ1bmN0aW9uICggZXZlbnQgKXtcclxuXHRcdGlmICggMTMgIT09IGV2ZW50LndoaWNoICl7XHJcblx0XHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VhcmNoaW5nX2FmdGVyX2Zld19zZWNvbmRzKCAnI3dwYmNfc2VhcmNoX2ZpZWxkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2VhcmNoaW5nIGFmdGVyIDEuNSBzZWNvbmRzIGFmdGVyIEtleSBVcFxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0d3BiY19hanhfYm9va2luZ19zZWFyY2hpbmdfYWZ0ZXJfZmV3X3NlY29uZHMoICcjd3BiY19zZWFyY2hfZmllbGQnLCAwICk7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gSW1tZWRpYXRlIHNlYXJjaFxyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeGlzdGluZyB8IFRyYXNoIHwgQW55XHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRqUXVlcnkoICcjd2hfdHJhc2gnICkub24oICdjaGFuZ2UnLCBmdW5jdGlvbiggZXZlbnQgKXtcclxuXHJcblx0XHR2YXIgY2hhbmdlZF92YWx1ZSA9IEpTT04ucGFyc2UoIGpRdWVyeSggJyN3aF90cmFzaCcgKS52YWwoKSApO1xyXG5cclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hfdHJhc2gnOiBjaGFuZ2VkX3ZhbHVlWyAwIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwYWdlX251bSc6IDFcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQWxsIGJvb2tpbmdzIHwgTmV3IGJvb2tpbmdzXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRqUXVlcnkoICcjd2hfd2hhdF9ib29raW5ncycgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cclxuXHRcdHZhciBjaGFuZ2VkX3ZhbHVlID0gSlNPTi5wYXJzZSggalF1ZXJ5KCAnI3doX3doYXRfYm9va2luZ3MnICkudmFsKCkgKTtcclxuXHJcblx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doX3doYXRfYm9va2luZ3MnOiBjaGFuZ2VkX3ZhbHVlWyAwIF0sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwYWdlX251bSc6IDFcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gXCJDcmVhdGlvbiBEYXRlXCIgICBvZiBib29raW5nc1xyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0alF1ZXJ5KCAnI3doX21vZGlmaWNhdGlvbl9kYXRlJyApLm9uKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblxyXG5cdFx0dmFyIGNoYW5nZWRfdmFsdWUgPSBKU09OLnBhcnNlKCBqUXVlcnkoICcjd2hfbW9kaWZpY2F0aW9uX2RhdGUnICkudmFsKCkgKTtcclxuXHJcblx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doX21vZGlmaWNhdGlvbl9kYXRlJzogY2hhbmdlZF92YWx1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJyAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZyb250ZW5kIHNlbGVjdGVkIGVsZW1lbnRzIChzYXZpbmcgZm9yIGZ1dHVyZSB1c2UsIGFmdGVyIEY1KVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfd2hfbW9kaWZpY2F0aW9uX2RhdGVfcmFkaW8nICAgOiBqUXVlcnkoICdpbnB1dFtuYW1lPVwidWlfd2hfbW9kaWZpY2F0aW9uX2RhdGVfcmFkaW9cIl06Y2hlY2tlZCcgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX3doX21vZGlmaWNhdGlvbl9kYXRlX3ByaW9yJyAgIDogalF1ZXJ5KCAnI3VpX3doX21vZGlmaWNhdGlvbl9kYXRlX3ByaW9yJyApLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndWlfd2hfbW9kaWZpY2F0aW9uX2RhdGVfY2hlY2tpbicgOiBqUXVlcnkoICcjdWlfd2hfbW9kaWZpY2F0aW9uX2RhdGVfY2hlY2tpbicgKS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3VpX3doX21vZGlmaWNhdGlvbl9kYXRlX2NoZWNrb3V0JzogalF1ZXJ5KCAnI3VpX3doX21vZGlmaWNhdGlvbl9kYXRlX2NoZWNrb3V0JyApLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0fSApO1xyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFBheW1lbnQgU3RhdHVzXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRqUXVlcnkoICcjd2hfcGF5X3N0YXR1cycgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cclxuXHRcdHZhciBjaGFuZ2VkX3ZhbHVlID0gSlNPTi5wYXJzZSggalF1ZXJ5KCAnI3doX3BheV9zdGF0dXMnICkudmFsKCkgKTtcclxuXHJcblx0XHR3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doX3BheV9zdGF0dXMnOiBjaGFuZ2VkX3ZhbHVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQncGFnZV9udW0nICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRnJvbnRlbmQgc2VsZWN0ZWQgZWxlbWVudHMgKHNhdmluZyBmb3IgZnV0dXJlIHVzZSwgYWZ0ZXIgRjUpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV93aF9wYXlfc3RhdHVzX3JhZGlvJyA6ICggKCB1bmRlZmluZWQgPT09IGpRdWVyeSggJ2lucHV0W25hbWU9XCJ1aV93aF9wYXlfc3RhdHVzX3JhZGlvXCJdOmNoZWNrZWQnICkudmFsKCkgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0PyAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0OiBqUXVlcnkoICdpbnB1dFtuYW1lPVwidWlfd2hfcGF5X3N0YXR1c19yYWRpb1wiXTpjaGVja2VkJyApLnZhbCgpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd1aV93aF9wYXlfc3RhdHVzX2N1c3RvbSc6IGpRdWVyeSggJyN1aV93aF9wYXlfc3RhdHVzX2N1c3RvbScgKS52YWwoKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cclxuXHJcblx0fSApO1xyXG5cclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIE1pbiBDb3N0XHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRqUXVlcnkoICcjd2hfY29zdCcgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cclxuXHRcdHZhciBjaGFuZ2VkX3ZhbHVlID0galF1ZXJ5KCAnI3doX2Nvc3QnICkudmFsKCk7XHJcblxyXG5cdFx0d3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aF9jb3N0JyA6IGNoYW5nZWRfdmFsdWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdwYWdlX251bSc6IDFcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTWF4IENvc3RcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJyN3aF9jb3N0MicgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCBldmVudCApe1xyXG5cclxuXHRcdHZhciBjaGFuZ2VkX3ZhbHVlID0galF1ZXJ5KCAnI3doX2Nvc3QyJyApLnZhbCgpO1xyXG5cclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hfY29zdDInIDogY2hhbmdlZF92YWx1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3BhZ2VfbnVtJzogMVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdH0gKTtcclxuXHJcblx0Ly8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0Ly8gUmV1c2FibGUgQ2hvc2VuIGxpc3RpbmcgZmlsdGVycywgc3VjaCBhcyBCb29raW5nIHJlc291cmNlcy9Qcm92aWRlcnMgYW5kIEFwcG9pbnRtZW50IFNlcnZpY2VzLlxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHRqUXVlcnkoICdzZWxlY3RbZGF0YS13cGJjLWxpc3RpbmctZmlsdGVyLXBhcmFtXScgKS5vbiggJ2NoYW5nZScsIGZ1bmN0aW9uKCl7XG5cblx0XHR2YXIgbGlzdGluZ19maWx0ZXJfcGFyYW0gPSBqUXVlcnkoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLWxpc3RpbmctZmlsdGVyLXBhcmFtJyApO1xuXHRcdHZhciBjaGFuZ2VkX3ZhbHVlO1xuXHRcdHZhciByZXF1ZXN0X3VwZGF0ZXM7XG5cblx0XHRpZiAoICEgbGlzdGluZ19maWx0ZXJfcGFyYW0gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y2hhbmdlZF92YWx1ZSA9ICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3VpX2Nob3Nlbl9maWx0ZXJfZ2V0X3JlcXVlc3RfdmFsdWUgKVxuXHRcdFx0PyB3aW5kb3cud3BiY191aV9jaG9zZW5fZmlsdGVyX2dldF9yZXF1ZXN0X3ZhbHVlKCB0aGlzIClcblx0XHRcdDogalF1ZXJ5KCB0aGlzICkudmFsKCk7XG5cdFx0cmVxdWVzdF91cGRhdGVzID0ge1xuXHRcdFx0J3BhZ2VfbnVtJzogMVxuXHRcdH07XG5cdFx0cmVxdWVzdF91cGRhdGVzWyBsaXN0aW5nX2ZpbHRlcl9wYXJhbSBdID0gY2hhbmdlZF92YWx1ZTtcblxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyggcmVxdWVzdF91cGRhdGVzICk7XG5cdH0gKTtcblxuXG5cdC8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdC8vIFNvcnRpbmdcclxuXHQvLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSggJyN3aF9zb3J0JyApLm9uKCAnY2hhbmdlJywgZnVuY3Rpb24oIGV2ZW50ICl7XHJcblxyXG5cdFx0dmFyIGNoYW5nZWRfdmFsdWUgPSBqUXVlcnkoICcjd2hfc29ydCcgKS52YWwoKTtcclxuXHJcblx0XHRjaGFuZ2VkX3ZhbHVlID0gSlNPTi5wYXJzZSggY2hhbmdlZF92YWx1ZSApO1xyXG5cclxuXHRcdHdwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hfc29ydCc6IGNoYW5nZWRfdmFsdWVbIDAgXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdH0gKTtcclxuXHJcbn1cclxuXHJcbmpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHR3cGJjX2FqeF9ib29raW5nX2RlZmluZV91aV9ob29rc19vbmNlKCk7XHJcbn0pO1xyXG4iXSwibWFwcGluZ3MiOiJBQUFBLFlBQVk7O0FBRVo7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxxQ0FBcUNBLENBQUEsRUFBRTtFQUUvQztFQUNBO0VBQ0E7RUFDQUMsTUFBTSxDQUFFLGtCQUFtQixDQUFDLENBQUNDLEVBQUUsQ0FBRSxRQUFRLEVBQUUsVUFBVUMsS0FBSyxFQUFFO0lBRTNELElBQUlDLGFBQWEsR0FBR0MsSUFBSSxDQUFDQyxLQUFLLENBQUVMLE1BQU0sQ0FBRSxrQkFBbUIsQ0FBQyxDQUFDTSxHQUFHLENBQUMsQ0FBRSxDQUFDO0lBRXBFQyxnREFBZ0QsQ0FBRTtNQUNyQyxpQkFBaUIsRUFBRUosYUFBYTtNQUNoQyxVQUFVLEVBQVMsQ0FBQztNQUNwQjtNQUNBLDBCQUEwQixFQUFLSCxNQUFNLENBQUUsZ0RBQWlELENBQUMsQ0FBQ00sR0FBRyxDQUFDLENBQUM7TUFDL0YseUJBQXlCLEVBQU1OLE1BQU0sQ0FBRSwwQkFBMkIsQ0FBQyxDQUFDTSxHQUFHLENBQUMsQ0FBQztNQUN6RSwwQkFBMEIsRUFBS04sTUFBTSxDQUFFLDJCQUE0QixDQUFDLENBQUNNLEdBQUcsQ0FBQyxDQUFDO01BQzFFLDRCQUE0QixFQUFHTixNQUFNLENBQUUsNkJBQThCLENBQUMsQ0FBQ00sR0FBRyxDQUFDLENBQUM7TUFDNUUsNkJBQTZCLEVBQUVOLE1BQU0sQ0FBRSw4QkFBK0IsQ0FBQyxDQUFDTSxHQUFHLENBQUM7SUFDN0UsQ0FBRSxDQUFDO0VBQ2hCLENBQUUsQ0FBQzs7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
