"use strict";

function wpbc_flextimeline_nav(timeline_obj, nav_step) {
  jQuery(".wpbc_timeline_front_end").trigger("timeline_nav", [timeline_obj, nav_step]); // FixIn: 7.0.1.48.

  // jQuery( '#'+timeline_obj.html_client_id + ' .wpbc_tl_prev,#'+timeline_obj.html_client_id + ' .wpbc_tl_next').remove();
  // jQuery('#'+timeline_obj.html_client_id + ' .wpbc_tl_title').html( '<span class="wpbc_icn_rotate_right wpbc_spin"></span> &nbsp Loading...' );      // '<div style="height:20px;width:100%;text-align:center;margin:15px auto;">Loading ... <img style="vertical-align:middle;box-shadow:none;width:14px;" src="'+_wpbc.get_other_param( 'url_plugin' )+'/assets/img/ajax-loader.gif"><//div>'

  jQuery('#' + timeline_obj.html_client_id + ' .flex_tl_prev,#' + timeline_obj.html_client_id + ' .flex_tl_next').remove();
  jQuery('#' + timeline_obj.html_client_id + ' .flex_tl_title').html('<span class="wpbc_icn_rotate_right wpbc_spin"></span> &nbsp Loading...'); // '<div style="height:20px;width:100%;text-align:center;margin:15px auto;">Loading ... <img style="vertical-align:middle;box-shadow:none;width:14px;" src="'+_wpbc.get_other_param( 'url_plugin' )+'/assets/img/ajax-loader.gif"><//div>'

  //Deprecated: FixIn: 9.0.1.1.1
  // if ( 'function' === typeof( jQuery(".popover_click.popover_bottom" ).popover )  )       //FixIn: 7.0.1.2  - 2016-12-10
  //     jQuery('.popover_click.popover_bottom').popover( 'hide' );                      //Hide all opened popovers

  jQuery.ajax({
    url: wpbc_url_ajax,
    type: 'POST',
    success: function success(data, textStatus) {
      // Note,  here we direct show HTML to TimeLine frame
      if (textStatus == 'success') {
        jQuery('#' + timeline_obj.html_client_id + ' .wpbc_timeline_ajax_replace').html(data);
        return true;
      }
    },
    error: function error(XMLHttpRequest, textStatus, errorThrown) {
      window.status = 'Ajax Error! Status: ' + textStatus;
      alert('Ajax Error! Status: ' + XMLHttpRequest.status + ' ' + XMLHttpRequest.statusText);
    },
    // beforeSend: someFunction,
    data: {
      action: 'WPBC_FLEXTIMELINE_NAV',
      timeline_obj: timeline_obj,
      nav_step: nav_step,
      wpdev_active_locale: _wpbc.get_other_param('locale_active'),
      wpbc_nonce: document.getElementById('wpbc_nonce_' + timeline_obj.html_client_id).value
    }
  });
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29yZS90aW1lbGluZS92Mi9fb3V0L3RpbWVsaW5lX3YyLmpzIiwibmFtZXMiOlsid3BiY19mbGV4dGltZWxpbmVfbmF2IiwidGltZWxpbmVfb2JqIiwibmF2X3N0ZXAiLCJqUXVlcnkiLCJ0cmlnZ2VyIiwiaHRtbF9jbGllbnRfaWQiLCJyZW1vdmUiLCJodG1sIiwiYWpheCIsInVybCIsIndwYmNfdXJsX2FqYXgiLCJ0eXBlIiwic3VjY2VzcyIsImRhdGEiLCJ0ZXh0U3RhdHVzIiwiZXJyb3IiLCJYTUxIdHRwUmVxdWVzdCIsImVycm9yVGhyb3duIiwid2luZG93Iiwic3RhdHVzIiwiYWxlcnQiLCJzdGF0dXNUZXh0IiwiYWN0aW9uIiwid3BkZXZfYWN0aXZlX2xvY2FsZSIsIl93cGJjIiwiZ2V0X290aGVyX3BhcmFtIiwid3BiY19ub25jZSIsImRvY3VtZW50IiwiZ2V0RWxlbWVudEJ5SWQiLCJ2YWx1ZSJdLCJzb3VyY2VzIjpbImNvcmUvdGltZWxpbmUvdjIvX3NyYy90aW1lbGluZV92Mi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuZnVuY3Rpb24gd3BiY19mbGV4dGltZWxpbmVfbmF2KCB0aW1lbGluZV9vYmosIG5hdl9zdGVwICl7XHJcblxyXG4gICAgalF1ZXJ5KCBcIi53cGJjX3RpbWVsaW5lX2Zyb250X2VuZFwiICkudHJpZ2dlciggXCJ0aW1lbGluZV9uYXZcIiAsIFsgdGltZWxpbmVfb2JqLCBuYXZfc3RlcCBdICk7ICAgICAgICAvLyBGaXhJbjogNy4wLjEuNDguXHJcblxyXG4gICAgLy8galF1ZXJ5KCAnIycrdGltZWxpbmVfb2JqLmh0bWxfY2xpZW50X2lkICsgJyAud3BiY190bF9wcmV2LCMnK3RpbWVsaW5lX29iai5odG1sX2NsaWVudF9pZCArICcgLndwYmNfdGxfbmV4dCcpLnJlbW92ZSgpO1xyXG4gICAgLy8galF1ZXJ5KCcjJyt0aW1lbGluZV9vYmouaHRtbF9jbGllbnRfaWQgKyAnIC53cGJjX3RsX3RpdGxlJykuaHRtbCggJzxzcGFuIGNsYXNzPVwid3BiY19pY25fcm90YXRlX3JpZ2h0IHdwYmNfc3BpblwiPjwvc3Bhbj4gJm5ic3AgTG9hZGluZy4uLicgKTsgICAgICAvLyAnPGRpdiBzdHlsZT1cImhlaWdodDoyMHB4O3dpZHRoOjEwMCU7dGV4dC1hbGlnbjpjZW50ZXI7bWFyZ2luOjE1cHggYXV0bztcIj5Mb2FkaW5nIC4uLiA8aW1nIHN0eWxlPVwidmVydGljYWwtYWxpZ246bWlkZGxlO2JveC1zaGFkb3c6bm9uZTt3aWR0aDoxNHB4O1wiIHNyYz1cIicrX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndXJsX3BsdWdpbicgKSsnL2Fzc2V0cy9pbWcvYWpheC1sb2FkZXIuZ2lmXCI+PC8vZGl2PidcclxuXHJcbiAgICBqUXVlcnkoICcjJyt0aW1lbGluZV9vYmouaHRtbF9jbGllbnRfaWQgKyAnIC5mbGV4X3RsX3ByZXYsIycrdGltZWxpbmVfb2JqLmh0bWxfY2xpZW50X2lkICsgJyAuZmxleF90bF9uZXh0JykucmVtb3ZlKCk7XHJcbiAgICBqUXVlcnkoJyMnK3RpbWVsaW5lX29iai5odG1sX2NsaWVudF9pZCArICcgLmZsZXhfdGxfdGl0bGUnKS5odG1sKCAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluXCI+PC9zcGFuPiAmbmJzcCBMb2FkaW5nLi4uJyApOyAgICAgIC8vICc8ZGl2IHN0eWxlPVwiaGVpZ2h0OjIwcHg7d2lkdGg6MTAwJTt0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW46MTVweCBhdXRvO1wiPkxvYWRpbmcgLi4uIDxpbWcgc3R5bGU9XCJ2ZXJ0aWNhbC1hbGlnbjptaWRkbGU7Ym94LXNoYWRvdzpub25lO3dpZHRoOjE0cHg7XCIgc3JjPVwiJytfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd1cmxfcGx1Z2luJyApKycvYXNzZXRzL2ltZy9hamF4LWxvYWRlci5naWZcIj48Ly9kaXY+J1xyXG5cclxuXHJcbi8vRGVwcmVjYXRlZDogRml4SW46IDkuMC4xLjEuMVxyXG4vLyBpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiggalF1ZXJ5KFwiLnBvcG92ZXJfY2xpY2sucG9wb3Zlcl9ib3R0b21cIiApLnBvcG92ZXIgKSAgKSAgICAgICAvL0ZpeEluOiA3LjAuMS4yICAtIDIwMTYtMTItMTBcclxuLy8gICAgIGpRdWVyeSgnLnBvcG92ZXJfY2xpY2sucG9wb3Zlcl9ib3R0b20nKS5wb3BvdmVyKCAnaGlkZScgKTsgICAgICAgICAgICAgICAgICAgICAgLy9IaWRlIGFsbCBvcGVuZWQgcG9wb3ZlcnNcclxuXHJcbiAgICBqUXVlcnkuYWpheCh7XHJcbiAgICAgICAgdXJsOiB3cGJjX3VybF9hamF4LFxyXG4gICAgICAgIHR5cGU6J1BPU1QnLFxyXG4gICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cyApeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vdGUsICBoZXJlIHdlIGRpcmVjdCBzaG93IEhUTUwgdG8gVGltZUxpbmUgZnJhbWVcclxuICAgICAgICAgICAgICAgICAgICBpZiggdGV4dFN0YXR1cyA9PSAnc3VjY2VzcycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgalF1ZXJ5KCcjJyArIHRpbWVsaW5lX29iai5odG1sX2NsaWVudF9pZCArICcgLndwYmNfdGltZWxpbmVfYWpheF9yZXBsYWNlJyApLmh0bWwoIGRhdGEgKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICBlcnJvcjogIGZ1bmN0aW9uICggWE1MSHR0cFJlcXVlc3QsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duKXtcclxuICAgICAgICAgICAgICAgICAgICB3aW5kb3cuc3RhdHVzID0gJ0FqYXggRXJyb3IhIFN0YXR1czogJyArIHRleHRTdGF0dXM7XHJcbiAgICAgICAgICAgICAgICAgICAgYWxlcnQoICdBamF4IEVycm9yISBTdGF0dXM6ICcgKyBYTUxIdHRwUmVxdWVzdC5zdGF0dXMgKyAnICcgKyBYTUxIdHRwUmVxdWVzdC5zdGF0dXNUZXh0ICk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgIC8vIGJlZm9yZVNlbmQ6IHNvbWVGdW5jdGlvbixcclxuICAgICAgICBkYXRhOntcclxuICAgICAgICAgICAgICAgIGFjdGlvbjogICAgICAgICAgICAgICdXUEJDX0ZMRVhUSU1FTElORV9OQVYnLFxyXG4gICAgICAgICAgICAgICAgdGltZWxpbmVfb2JqOiAgICAgICAgdGltZWxpbmVfb2JqLFxyXG4gICAgICAgICAgICAgICAgbmF2X3N0ZXA6ICAgICAgICAgICAgbmF2X3N0ZXAsXHJcbiAgICAgICAgICAgICAgICB3cGRldl9hY3RpdmVfbG9jYWxlOiBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdsb2NhbGVfYWN0aXZlJyApLFxyXG4gICAgICAgICAgICAgICAgd3BiY19ub25jZTogICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3dwYmNfbm9uY2VfJysgdGltZWxpbmVfb2JqLmh0bWxfY2xpZW50X2lkKS52YWx1ZVxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG4iXSwibWFwcGluZ3MiOiI7O0FBQ0EsU0FBU0EscUJBQXFCQSxDQUFFQyxZQUFZLEVBQUVDLFFBQVEsRUFBRTtFQUVwREMsTUFBTSxDQUFFLDBCQUEyQixDQUFDLENBQUNDLE9BQU8sQ0FBRSxjQUFjLEVBQUcsQ0FBRUgsWUFBWSxFQUFFQyxRQUFRLENBQUcsQ0FBQyxDQUFDLENBQVE7O0VBRXBHO0VBQ0E7O0VBRUFDLE1BQU0sQ0FBRSxHQUFHLEdBQUNGLFlBQVksQ0FBQ0ksY0FBYyxHQUFHLGtCQUFrQixHQUFDSixZQUFZLENBQUNJLGNBQWMsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDQyxNQUFNLENBQUMsQ0FBQztFQUNySEgsTUFBTSxDQUFDLEdBQUcsR0FBQ0YsWUFBWSxDQUFDSSxjQUFjLEdBQUcsaUJBQWlCLENBQUMsQ0FBQ0UsSUFBSSxDQUFFLHdFQUF5RSxDQUFDLENBQUMsQ0FBTTs7RUFHdko7RUFDQTtFQUNBOztFQUVJSixNQUFNLENBQUNLLElBQUksQ0FBQztJQUNSQyxHQUFHLEVBQUVDLGFBQWE7SUFDbEJDLElBQUksRUFBQyxNQUFNO0lBQ1hDLE9BQU8sRUFBRSxTQUFBQSxRQUFXQyxJQUFJLEVBQUVDLFVBQVUsRUFBRTtNQUFrQztNQUM1RCxJQUFJQSxVQUFVLElBQUksU0FBUyxFQUFFO1FBQ3pCWCxNQUFNLENBQUMsR0FBRyxHQUFHRixZQUFZLENBQUNJLGNBQWMsR0FBRyw4QkFBK0IsQ0FBQyxDQUFDRSxJQUFJLENBQUVNLElBQUssQ0FBQztRQUN4RixPQUFPLElBQUk7TUFDZjtJQUNKLENBQUM7SUFDVEUsS0FBSyxFQUFHLFNBQUFBLE1BQVdDLGNBQWMsRUFBRUYsVUFBVSxFQUFFRyxXQUFXLEVBQUM7TUFDL0NDLE1BQU0sQ0FBQ0MsTUFBTSxHQUFHLHNCQUFzQixHQUFHTCxVQUFVO01BQ25ETSxLQUFLLENBQUUsc0JBQXNCLEdBQUdKLGNBQWMsQ0FBQ0csTUFBTSxHQUFHLEdBQUcsR0FBR0gsY0FBYyxDQUFDSyxVQUFXLENBQUM7SUFDN0YsQ0FBQztJQUNUO0lBQ0FSLElBQUksRUFBQztNQUNHUyxNQUFNLEVBQWUsdUJBQXVCO01BQzVDckIsWUFBWSxFQUFTQSxZQUFZO01BQ2pDQyxRQUFRLEVBQWFBLFFBQVE7TUFDN0JxQixtQkFBbUIsRUFBRUMsS0FBSyxDQUFDQyxlQUFlLENBQUUsZUFBZ0IsQ0FBQztNQUM3REMsVUFBVSxFQUFXQyxRQUFRLENBQUNDLGNBQWMsQ0FBQyxhQUFhLEdBQUUzQixZQUFZLENBQUNJLGNBQWMsQ0FBQyxDQUFDd0I7SUFDakc7RUFDSixDQUFDLENBQUM7QUFDTiIsImlnbm9yZUxpc3QiOltdfQ==
