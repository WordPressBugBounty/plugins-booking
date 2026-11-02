
function wpbc_flextimeline_nav( timeline_obj, nav_step ){
	var timeline_root = timeline_obj && timeline_obj.html_client_id ? document.getElementById( timeline_obj.html_client_id ) : null;
	var request_generation;
	var timeline_request;

	if ( ! timeline_root ) {
		return null;
	}
	request_generation = Number( timeline_root.wpbc_timeline_request_generation || 0 ) + 1;
	timeline_root.wpbc_timeline_request_generation = request_generation;
	if ( timeline_root.wpbc_timeline_active_request && 'function' === typeof timeline_root.wpbc_timeline_active_request.abort ) {
		timeline_root.wpbc_timeline_active_request.abort();
	}

    jQuery( ".wpbc_timeline_front_end" ).trigger( "timeline_nav" , [ timeline_obj, nav_step ] );        // FixIn: 7.0.1.48.

    // jQuery( '#'+timeline_obj.html_client_id + ' .wpbc_tl_prev,#'+timeline_obj.html_client_id + ' .wpbc_tl_next').remove();
    // jQuery('#'+timeline_obj.html_client_id + ' .wpbc_tl_title').html( '<span class="wpbc_icn_rotate_right wpbc_spin"></span> &nbsp Loading...' );      // '<div style="height:20px;width:100%;text-align:center;margin:15px auto;">Loading ... <img style="vertical-align:middle;box-shadow:none;width:14px;" src="'+_wpbc.get_other_param( 'url_plugin' )+'/assets/img/ajax-loader.gif"><//div>'

    jQuery( '#'+timeline_obj.html_client_id + ' .flex_tl_prev,#'+timeline_obj.html_client_id + ' .flex_tl_next').remove();
    jQuery('#'+timeline_obj.html_client_id + ' .flex_tl_title').html( '<span class="wpbc_icn_rotate_right wpbc_spin"></span> &nbsp Loading...' );      // '<div style="height:20px;width:100%;text-align:center;margin:15px auto;">Loading ... <img style="vertical-align:middle;box-shadow:none;width:14px;" src="'+_wpbc.get_other_param( 'url_plugin' )+'/assets/img/ajax-loader.gif"><//div>'


//Deprecated: FixIn: 9.0.1.1.1
// if ( 'function' === typeof( jQuery(".popover_click.popover_bottom" ).popover )  )       //FixIn: 7.0.1.2  - 2016-12-10
//     jQuery('.popover_click.popover_bottom').popover( 'hide' );                      //Hide all opened popovers

	timeline_request = jQuery.ajax({
        url: wpbc_url_ajax,
        type:'POST',
        success: function ( data, textStatus ){                                 // Note,  here we direct show HTML to TimeLine frame
					if ( request_generation !== timeline_root.wpbc_timeline_request_generation ) {
						return;
					}
                    if( textStatus == 'success') {
                        jQuery('#' + timeline_obj.html_client_id + ' .wpbc_timeline_ajax_replace' ).html( data );
                        return true;
                    }
                },
        error:  function ( XMLHttpRequest, textStatus, errorThrown){
					if ( 'abort' === textStatus || request_generation !== timeline_root.wpbc_timeline_request_generation ) {
						return;
					}
                    window.status = 'Ajax Error! Status: ' + textStatus;
                    alert( 'Ajax Error! Status: ' + XMLHttpRequest.status + ' ' + XMLHttpRequest.statusText );
                },
		complete: function () {
			if ( timeline_request === timeline_root.wpbc_timeline_active_request ) {
				timeline_root.wpbc_timeline_active_request = null;
			}
		},
        // beforeSend: someFunction,
        data:{
                action:              'WPBC_FLEXTIMELINE_NAV',
                timeline_obj:        timeline_obj,
                nav_step:            nav_step,
                wpdev_active_locale: _wpbc.get_other_param( 'locale_active' ),
                wpbc_nonce:          document.getElementById('wpbc_nonce_'+ timeline_obj.html_client_id).value
        }
	});
	timeline_root.wpbc_timeline_active_request = timeline_request;
	return timeline_request;
}

