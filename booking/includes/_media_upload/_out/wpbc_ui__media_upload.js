"use strict";

/**
 * @file: ../includes/_media_upload/_src/wpbc_ui__media_upload.js
 *
 * == How to Use ?  ==
 *
 * 1. Load JS:
 *
 * function wpbc_register_js__media_upload( $hook ) {
 *      if ( wpbc_can_i_load_on_this_page__media_upload() ) {
 *          wpbc_load_js__required_for_media_upload();
 *      }
 * }
 * add_action( 'admin_enqueue_scripts', 'wpbc_register_js__media_upload'  );
 *
 *
 * 2. Inside the page use html element with  this class:  "wpbc_media_upload_button"
 *
 * <a   href="javascript:void(0)"
 *      class="wpbc_media_upload_button"
 *      data-modal_title="<?php echo esc_attr( __( 'Select Image', 'booking' ) ); ?>"
 *      data-btn_title="<?php echo esc_attr( __( 'Select Image', 'booking' ) ); ?>"
 *      data-url_field="MY_URL_FIELD"
 *                                      ><i class="menu_icon icon-1x wpbc_icn_tune"></i></a>
 *
 *   3. 'data-url_field' attribute define TEXT field,  where will be inserted URL of selected image
 *      'data-modal_title'  - Header title in popup
 *      'data-btn_title'    - Button title in popup
 *
 *   4. If you need to  update URL  somewhere else at  the page,  use this j JavaScript hook:
 *
 * <script type="text/javascript">
 *  jQuery(document).ready(function(){
 *    jQuery( '#MY_URL_FIELD').on( 'wpbc_media_upload_url_set', function(){
 *        jQuery( '#MY_URL_FIELD').parents( '.wpbc_extra__excerpt_img' ).find( '.ui_group__thumbnail
 * .wpbc_media_upload_button' ).html( '<img src="' + jQuery( '#MY_URL_FIELD').val() + '" class="search_thumbnail_img"
 * />' );
 *    });
 *  });
 * </script>
 *
 */

var wpbc_media_file_frame;
jQuery(function ($) {
  // Delegated binding (works for dynamically rendered BFB controls).
  $(document).on('click', '.wpbc_media_upload_button', function (event) {
    wpbc_media_upload_button_clicked(this, event);
  });
});
function wpbc_media_upload_button_clicked(_this, event) {
  var j_btn = jQuery(_this);
  var is_multi_selection = false;
  // var insert_field_separator = ',';

  // Stop the anchor's default behavior
  event.preventDefault();

  // If frame exist close it
  if (wpbc_media_file_frame) {
    wpbc_media_file_frame.close();
  }

  // -----------------------------------------------------------------------------------------------------
  // Create Media Frame
  // -----------------------------------------------------------------------------------------------------
  wpbc_media_file_frame = wp.media.frames.wpbc_media_upload_file_frame = wp.media({
    // Check  here ../wp-includes/js/media-views.js
    // Set the title of the modal.
    title: j_btn.data('modal_title'),
    library: {
      //	type: ''
      // type: [ 'video', 'image' ]
      type: ['image']
    },
    button: {
      text: j_btn.data('btn_title')
    },
    multiple: is_multi_selection
    // states: [
    // 			new wp.media.controller.Library( {
    // 				/*
    // 					Add to  this libaray custom post  parameter: $_POST['query'][ $media_uploader_params['key'] ] = $media_uploader_params['value']
    // 					We are checking in functon wpbc_media_filter_posts_where media files that  only  relative to  this medi Frame opening
    // 					And filtering posts (in WHERE) relative custom path to  our files.
    // 					echo '{' . $media_uploader_params['key'] . ": '" . $media_uploader_params['value'] . "' }";
    // 				*/
    // 						library: wp.media.query(),
    // 						multiple: is_multi_selection,
    // 						title:	j_btn.data( 'modal_title' ),
    // 						priority: 15,
    // 						filterable: 'uploaded',
    // 				 		type: ['image']
    // 						// idealColumnWidth: 125
    // 				} )
    // 		]
  });

  /*
  ///////////////////////////////////////////////////////////////////////
  // Set  custom parameters for uploader	->  $_POST['wpbc_media_type'] - checking in "upload_dir",  when filter_upload_dir
  ///////////////////////////////////////////////////////////////////////
  wpbc_media_file_frame.on( 'ready', function () {
  	wpbc_media_file_frame.uploader.options.uploader.params = {
  		type: 'wpbc_media_download',
  		<?php
  		echo $media_uploader_params['key'] . ": '" . $media_uploader_params['value'] . "'";
  		?>
  	};
  } );
  */

  ///////////////////////////////////////////////////////////////////////
  // When File have selected, do this
  ///////////////////////////////////////////////////////////////////////
  wpbc_media_file_frame.on('select', function () {
    if (!is_multi_selection) {
      // Single file

      var attachment = wpbc_media_file_frame.state().get('selection').first().toJSON();

      // Put URL of file to text field.
      var $f = jQuery('#' + j_btn.data('url_field'));
      $f.val(attachment.url);
      $f.trigger('input');
      $f.trigger('change');
      $f.trigger('wpbc_media_upload_url_set');

      //j_btn.parents( '.wpbc_extra__excerpt_img' ).find( '.ui_group__thumbnail .wpbc_media_upload_button' ).html( '<img src="' + attachment.url + '" class="search_thumbnail_img" />' );
    } else {
      // Multiple files.

      var file_paths = '';
      // var csv_data_line = '';
      wpbc_media_file_frame.state().get('selection').map(function (attachment) {
        /*
        	// Request  new data
        	attachment.fetch().then(function (data) {
        		console.log(data);
        		// preloading finished after this you can use your attachment normally
        		// wp.media.attachment( attachment.id ).get('url');
        	});
        */

        attachment = attachment.toJSON();

        /*
        	if ( attachment.url ) {
        		// Insert info from selected files
        		csv_data_line = attachment.id + insert_field_separator + attachment.title  + insert_field_separator + attachment.wpbc_media_version_num  + insert_field_separator + attachment.description + insert_field_separator + attachment.url
        		file_paths = file_paths ? file_paths + "\n" + csv_data_line : csv_data_line;
        	}
        */
        file_paths = file_paths ? file_paths + "\n" + attachment.url : attachment.url;
      });
      var $f = jQuery('#' + j_btn.data('url_field'));
      $f.val(file_paths);
      $f.trigger('input');
      $f.trigger('change');
      $f.trigger('wpbc_media_upload_url_set');
    }
  });

  /*
  	// Fires when a state activates.
  	wpbc_media_file_frame.on( 'activate', function() { alert('activate'); } );
  			// Fires after the frame markup has been built, but not appended to the DOM.
  	// @see wp.media.view.Modal.attach()
  	wpbc_media_file_frame.on( 'ready', function() { alert('ready'); } );
  			// Fires when the frame's $el is appended to its DOM container.
  	// @see media.view.Modal.attach()
  	wpbc_media_file_frame.on( 'attach', function() { alert('attach'); } );
  			// Fires when the modal opens (becomes visible).
  	// @see media.view.Modal.open()
  	wpbc_media_file_frame.on( 'open', function() { alert('open'); } );
  			// Fires when the modal closes via the escape key.
  	// @see media.view.Modal.close()
  	wpbc_media_file_frame.on( 'escape', function() { alert('escape'); } );
  			// Fires when the modal closes.
  	// @see media.view.Modal.close()
  	wpbc_media_file_frame.on( 'close', function() { alert('close'); } );
  			// Fires when a user has selected attachment(s) and clicked the select button.
  	// @see media.view.MediaFrame.Post.mainInsertToolbar()
  	wpbc_media_file_frame.on( 'select', function() {
  		var selectionCollection = wpbc_media_file_frame.state().get('select');
  	} );
  			// Fires when a mode is deactivated on a region { 'menu' | title | content | toolbar | router }
  	wpbc_media_file_frame.on( 'content:deactivate', function() { alert('{region}:deactivate'); } );
  	// and a more specific event including the mode.
  	wpbc_media_file_frame.on( 'content:deactivate:{mode}', function() { alert('{region}:deactivate{mode}'); } );
  			// Fires when a region is ready for its view to be created.
  	wpbc_media_file_frame.on( 'content:create', function() { alert('{region}:create'); } );
  	// and a more specific event including the mode.
  	wpbc_media_file_frame.on( 'content:create:{mode}', function() { alert('{region}:create{mode}'); } );
  			// Fires when a region is ready for its view to be rendered.
  	wpbc_media_file_frame.on( 'content:render', function() { alert('{region}:render'); } );
  	// and a more specific event including the mode.
  	wpbc_media_file_frame.on( 'content:render:{mode}', function() { alert('{region}:render{mode}'); } );
  			// Fires when a new mode is activated (after it has been rendered) on a region.
  	wpbc_media_file_frame.on( 'content:activate', function() { alert('{region}:activate'); } );
  	// and a more specific event including the mode.
  	wpbc_media_file_frame.on( 'content:activate:{mode}', function() { alert('{region}:activate{mode}'); } );
  			// Get an object representing the current state.
  	//wpbc_media_file_frame.state();
  			// Get an object representing the previous state.
  	//wpbc_media_file_frame.lastState();
  */
  /*
  	// Debuge all events from  media Frame!
  	wpbc_media_file_frame.on( "all", function ( eventName ){
  		console.log( 'Frame Event: ' + eventName );
  	} );
  			// Debuge all events from  media Frame!
  	wp.media.model.Attachment.get( "collection" ).collection.on( "all", function ( eventName ){
  		console.log( '[Collection] Event: ' + eventName );
  	} );
  	wp.media.model.Attachment.get( "models" ).collection.on( "all", function ( eventName ){
  		console.log( '[models] Event: ' + eventName );
  	} );
  	wp.media.model.Attachment.get( "views" ).collection.on( "all", function ( eventName ){
  		console.log( '[views] Event: ' + eventName );
  	} );
  */

  // Open the modal.
  wpbc_media_file_frame.open();
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX21lZGlhX3VwbG9hZC9fb3V0L3dwYmNfdWlfX21lZGlhX3VwbG9hZC5qcyIsIm5hbWVzIjpbIndwYmNfbWVkaWFfZmlsZV9mcmFtZSIsImpRdWVyeSIsIiQiLCJkb2N1bWVudCIsIm9uIiwiZXZlbnQiLCJ3cGJjX21lZGlhX3VwbG9hZF9idXR0b25fY2xpY2tlZCIsIl90aGlzIiwial9idG4iLCJpc19tdWx0aV9zZWxlY3Rpb24iLCJwcmV2ZW50RGVmYXVsdCIsImNsb3NlIiwid3AiLCJtZWRpYSIsImZyYW1lcyIsIndwYmNfbWVkaWFfdXBsb2FkX2ZpbGVfZnJhbWUiLCJ0aXRsZSIsImRhdGEiLCJsaWJyYXJ5IiwidHlwZSIsImJ1dHRvbiIsInRleHQiLCJtdWx0aXBsZSIsImF0dGFjaG1lbnQiLCJzdGF0ZSIsImdldCIsImZpcnN0IiwidG9KU09OIiwiJGYiLCJ2YWwiLCJ1cmwiLCJ0cmlnZ2VyIiwiZmlsZV9wYXRocyIsIm1hcCIsIm9wZW4iXSwic291cmNlcyI6WyJpbmNsdWRlcy9fbWVkaWFfdXBsb2FkL19zcmMvd3BiY191aV9fbWVkaWFfdXBsb2FkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBAZmlsZTogLi4vaW5jbHVkZXMvX21lZGlhX3VwbG9hZC9fc3JjL3dwYmNfdWlfX21lZGlhX3VwbG9hZC5qc1xyXG4gKlxyXG4gKiA9PSBIb3cgdG8gVXNlID8gID09XHJcbiAqXHJcbiAqIDEuIExvYWQgSlM6XHJcbiAqXHJcbiAqIGZ1bmN0aW9uIHdwYmNfcmVnaXN0ZXJfanNfX21lZGlhX3VwbG9hZCggJGhvb2sgKSB7XHJcbiAqICAgICAgaWYgKCB3cGJjX2Nhbl9pX2xvYWRfb25fdGhpc19wYWdlX19tZWRpYV91cGxvYWQoKSApIHtcclxuICogICAgICAgICAgd3BiY19sb2FkX2pzX19yZXF1aXJlZF9mb3JfbWVkaWFfdXBsb2FkKCk7XHJcbiAqICAgICAgfVxyXG4gKiB9XHJcbiAqIGFkZF9hY3Rpb24oICdhZG1pbl9lbnF1ZXVlX3NjcmlwdHMnLCAnd3BiY19yZWdpc3Rlcl9qc19fbWVkaWFfdXBsb2FkJyAgKTtcclxuICpcclxuICpcclxuICogMi4gSW5zaWRlIHRoZSBwYWdlIHVzZSBodG1sIGVsZW1lbnQgd2l0aCAgdGhpcyBjbGFzczogIFwid3BiY19tZWRpYV91cGxvYWRfYnV0dG9uXCJcclxuICpcclxuICogPGEgICBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCJcclxuICogICAgICBjbGFzcz1cIndwYmNfbWVkaWFfdXBsb2FkX2J1dHRvblwiXHJcbiAqICAgICAgZGF0YS1tb2RhbF90aXRsZT1cIjw/cGhwIGVjaG8gZXNjX2F0dHIoIF9fKCAnU2VsZWN0IEltYWdlJywgJ2Jvb2tpbmcnICkgKTsgPz5cIlxyXG4gKiAgICAgIGRhdGEtYnRuX3RpdGxlPVwiPD9waHAgZWNobyBlc2NfYXR0ciggX18oICdTZWxlY3QgSW1hZ2UnLCAnYm9va2luZycgKSApOyA/PlwiXHJcbiAqICAgICAgZGF0YS11cmxfZmllbGQ9XCJNWV9VUkxfRklFTERcIlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPjxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fdHVuZVwiPjwvaT48L2E+XHJcbiAqXHJcbiAqICAgMy4gJ2RhdGEtdXJsX2ZpZWxkJyBhdHRyaWJ1dGUgZGVmaW5lIFRFWFQgZmllbGQsICB3aGVyZSB3aWxsIGJlIGluc2VydGVkIFVSTCBvZiBzZWxlY3RlZCBpbWFnZVxyXG4gKiAgICAgICdkYXRhLW1vZGFsX3RpdGxlJyAgLSBIZWFkZXIgdGl0bGUgaW4gcG9wdXBcclxuICogICAgICAnZGF0YS1idG5fdGl0bGUnICAgIC0gQnV0dG9uIHRpdGxlIGluIHBvcHVwXHJcbiAqXHJcbiAqICAgNC4gSWYgeW91IG5lZWQgdG8gIHVwZGF0ZSBVUkwgIHNvbWV3aGVyZSBlbHNlIGF0ICB0aGUgcGFnZSwgIHVzZSB0aGlzIGogSmF2YVNjcmlwdCBob29rOlxyXG4gKlxyXG4gKiA8c2NyaXB0IHR5cGU9XCJ0ZXh0L2phdmFzY3JpcHRcIj5cclxuICogIGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuICogICAgalF1ZXJ5KCAnI01ZX1VSTF9GSUVMRCcpLm9uKCAnd3BiY19tZWRpYV91cGxvYWRfdXJsX3NldCcsIGZ1bmN0aW9uKCl7XHJcbiAqICAgICAgICBqUXVlcnkoICcjTVlfVVJMX0ZJRUxEJykucGFyZW50cyggJy53cGJjX2V4dHJhX19leGNlcnB0X2ltZycgKS5maW5kKCAnLnVpX2dyb3VwX190aHVtYm5haWxcclxuICogLndwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbicgKS5odG1sKCAnPGltZyBzcmM9XCInICsgalF1ZXJ5KCAnI01ZX1VSTF9GSUVMRCcpLnZhbCgpICsgJ1wiIGNsYXNzPVwic2VhcmNoX3RodW1ibmFpbF9pbWdcIlxyXG4gKiAvPicgKTtcclxuICogICAgfSk7XHJcbiAqICB9KTtcclxuICogPC9zY3JpcHQ+XHJcbiAqXHJcbiAqL1xyXG5cclxudmFyIHdwYmNfbWVkaWFfZmlsZV9mcmFtZTtcclxuXHJcbmpRdWVyeSggZnVuY3Rpb24gKCAkICkge1xyXG5cclxuXHQvLyBEZWxlZ2F0ZWQgYmluZGluZyAod29ya3MgZm9yIGR5bmFtaWNhbGx5IHJlbmRlcmVkIEJGQiBjb250cm9scykuXHJcblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX21lZGlhX3VwbG9hZF9idXR0b24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0d3BiY19tZWRpYV91cGxvYWRfYnV0dG9uX2NsaWNrZWQoIHRoaXMsIGV2ZW50ICk7XHJcblx0fSApO1xyXG59ICk7XHJcblxyXG5mdW5jdGlvbiB3cGJjX21lZGlhX3VwbG9hZF9idXR0b25fY2xpY2tlZCggX3RoaXMsIGV2ZW50ICl7XHJcblxyXG5cdFx0dmFyIGpfYnRuID0galF1ZXJ5KCBfdGhpcyApO1xyXG5cdFx0dmFyIGlzX211bHRpX3NlbGVjdGlvbiA9IGZhbHNlO1xyXG5cdFx0Ly8gdmFyIGluc2VydF9maWVsZF9zZXBhcmF0b3IgPSAnLCc7XHJcblxyXG5cdFx0Ly8gU3RvcCB0aGUgYW5jaG9yJ3MgZGVmYXVsdCBiZWhhdmlvclxyXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHQvLyBJZiBmcmFtZSBleGlzdCBjbG9zZSBpdFxyXG5cdFx0aWYgKCB3cGJjX21lZGlhX2ZpbGVfZnJhbWUgKSB7XHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5jbG9zZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBDcmVhdGUgTWVkaWEgRnJhbWVcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUgPSB3cC5tZWRpYS5mcmFtZXMud3BiY19tZWRpYV91cGxvYWRfZmlsZV9mcmFtZSA9IHdwLm1lZGlhKCB7XHRcdFx0XHRcdFx0XHRcdC8vIENoZWNrICBoZXJlIC4uL3dwLWluY2x1ZGVzL2pzL21lZGlhLXZpZXdzLmpzXHJcblx0XHRcdC8vIFNldCB0aGUgdGl0bGUgb2YgdGhlIG1vZGFsLlxyXG5cdFx0XHR0aXRsZTogal9idG4uZGF0YSggJ21vZGFsX3RpdGxlJyApLFxyXG5cdFx0XHRsaWJyYXJ5OiB7XHJcblx0XHRcdFx0IC8vXHR0eXBlOiAnJ1xyXG5cdFx0XHRcdCAvLyB0eXBlOiBbICd2aWRlbycsICdpbWFnZScgXVxyXG5cdFx0XHRcdCB0eXBlOiBbICdpbWFnZScgXVxyXG5cdFx0XHR9LFxyXG5cdFx0XHRidXR0b246IHtcclxuXHRcdFx0XHR0ZXh0OiBqX2J0bi5kYXRhKCAnYnRuX3RpdGxlJyApLFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRtdWx0aXBsZTogaXNfbXVsdGlfc2VsZWN0aW9uLFxyXG5cdFx0XHQvLyBzdGF0ZXM6IFtcclxuXHRcdFx0Ly8gXHRcdFx0bmV3IHdwLm1lZGlhLmNvbnRyb2xsZXIuTGlicmFyeSgge1xyXG5cdFx0XHQvLyBcdFx0XHRcdC8qXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRBZGQgdG8gIHRoaXMgbGliYXJheSBjdXN0b20gcG9zdCAgcGFyYW1ldGVyOiAkX1BPU1RbJ3F1ZXJ5J11bICRtZWRpYV91cGxvYWRlcl9wYXJhbXNbJ2tleSddIF0gPSAkbWVkaWFfdXBsb2FkZXJfcGFyYW1zWyd2YWx1ZSddXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRXZSBhcmUgY2hlY2tpbmcgaW4gZnVuY3RvbiB3cGJjX21lZGlhX2ZpbHRlcl9wb3N0c193aGVyZSBtZWRpYSBmaWxlcyB0aGF0ICBvbmx5ICByZWxhdGl2ZSB0byAgdGhpcyBtZWRpIEZyYW1lIG9wZW5pbmdcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdEFuZCBmaWx0ZXJpbmcgcG9zdHMgKGluIFdIRVJFKSByZWxhdGl2ZSBjdXN0b20gcGF0aCB0byAgb3VyIGZpbGVzLlxyXG5cdFx0XHQvLyBcdFx0XHRcdFx0ZWNobyAneycgLiAkbWVkaWFfdXBsb2FkZXJfcGFyYW1zWydrZXknXSAuIFwiOiAnXCIgLiAkbWVkaWFfdXBsb2FkZXJfcGFyYW1zWyd2YWx1ZSddIC4gXCInIH1cIjtcclxuXHRcdFx0Ly8gXHRcdFx0XHQqL1xyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRsaWJyYXJ5OiB3cC5tZWRpYS5xdWVyeSgpLFxyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRtdWx0aXBsZTogaXNfbXVsdGlfc2VsZWN0aW9uLFxyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHR0aXRsZTpcdGpfYnRuLmRhdGEoICdtb2RhbF90aXRsZScgKSxcclxuXHRcdFx0Ly8gXHRcdFx0XHRcdFx0cHJpb3JpdHk6IDE1LFxyXG5cdFx0XHQvLyBcdFx0XHRcdFx0XHRmaWx0ZXJhYmxlOiAndXBsb2FkZWQnLFxyXG5cdFx0XHQvLyBcdFx0XHRcdCBcdFx0dHlwZTogWydpbWFnZSddXHJcblx0XHRcdC8vIFx0XHRcdFx0XHRcdC8vIGlkZWFsQ29sdW1uV2lkdGg6IDEyNVxyXG5cdFx0XHQvLyBcdFx0XHRcdH0gKVxyXG5cdFx0XHQvLyBcdFx0XVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdC8qXHJcblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG5cdFx0Ly8gU2V0ICBjdXN0b20gcGFyYW1ldGVycyBmb3IgdXBsb2FkZXJcdC0+ICAkX1BPU1RbJ3dwYmNfbWVkaWFfdHlwZSddIC0gY2hlY2tpbmcgaW4gXCJ1cGxvYWRfZGlyXCIsICB3aGVuIGZpbHRlcl91cGxvYWRfZGlyXHJcblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG5cdFx0d3BiY19tZWRpYV9maWxlX2ZyYW1lLm9uKCAncmVhZHknLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS51cGxvYWRlci5vcHRpb25zLnVwbG9hZGVyLnBhcmFtcyA9IHtcclxuXHRcdFx0XHR0eXBlOiAnd3BiY19tZWRpYV9kb3dubG9hZCcsXHJcblx0XHRcdFx0PD9waHBcclxuXHRcdFx0XHRlY2hvICRtZWRpYV91cGxvYWRlcl9wYXJhbXNbJ2tleSddIC4gXCI6ICdcIiAuICRtZWRpYV91cGxvYWRlcl9wYXJhbXNbJ3ZhbHVlJ10gLiBcIidcIjtcclxuXHRcdFx0XHQ/PlxyXG5cdFx0XHR9O1xyXG5cdFx0fSApO1xyXG5cdFx0Ki9cclxuXHJcblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG5cdFx0Ly8gV2hlbiBGaWxlIGhhdmUgc2VsZWN0ZWQsIGRvIHRoaXNcclxuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcblx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub24oICdzZWxlY3QnLCBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRpZiAoICEgaXNfbXVsdGlfc2VsZWN0aW9uICkgeyAvLyBTaW5nbGUgZmlsZVxyXG5cclxuXHRcdFx0XHR2YXIgYXR0YWNobWVudCA9IHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5zdGF0ZSgpLmdldCggJ3NlbGVjdGlvbicgKS5maXJzdCgpLnRvSlNPTigpO1xyXG5cclxuXHRcdFx0XHQvLyBQdXQgVVJMIG9mIGZpbGUgdG8gdGV4dCBmaWVsZC5cclxuXHRcdFx0XHR2YXIgJGYgPSBqUXVlcnkoICcjJyArIGpfYnRuLmRhdGEoICd1cmxfZmllbGQnICkgKTtcclxuXHRcdFx0XHQkZi52YWwoIGF0dGFjaG1lbnQudXJsICk7XHJcblx0XHRcdFx0JGYudHJpZ2dlciggJ2lucHV0JyApO1xyXG5cdFx0XHRcdCRmLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0XHRcdFx0JGYudHJpZ2dlciggJ3dwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQnICk7XHJcblxyXG5cdFx0XHRcdC8val9idG4ucGFyZW50cyggJy53cGJjX2V4dHJhX19leGNlcnB0X2ltZycgKS5maW5kKCAnLnVpX2dyb3VwX190aHVtYm5haWwgLndwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbicgKS5odG1sKCAnPGltZyBzcmM9XCInICsgYXR0YWNobWVudC51cmwgKyAnXCIgY2xhc3M9XCJzZWFyY2hfdGh1bWJuYWlsX2ltZ1wiIC8+JyApO1xyXG5cclxuXHRcdFx0fSBlbHNlIHsgLy8gTXVsdGlwbGUgZmlsZXMuXHJcblxyXG5cdFx0XHRcdHZhciBmaWxlX3BhdGhzID0gJyc7XHJcblx0XHRcdFx0Ly8gdmFyIGNzdl9kYXRhX2xpbmUgPSAnJztcclxuXHRcdFx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUuc3RhdGUoKS5nZXQoICdzZWxlY3Rpb24nICkubWFwKCBmdW5jdGlvbiAoIGF0dGFjaG1lbnQgKXtcclxuXHJcblx0XHRcdFx0XHRcdC8qXHJcblx0XHRcdFx0XHRcdFx0Ly8gUmVxdWVzdCAgbmV3IGRhdGFcclxuXHRcdFx0XHRcdFx0XHRhdHRhY2htZW50LmZldGNoKCkudGhlbihmdW5jdGlvbiAoZGF0YSkge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coZGF0YSk7XHJcblx0XHRcdFx0XHRcdFx0XHQvLyBwcmVsb2FkaW5nIGZpbmlzaGVkIGFmdGVyIHRoaXMgeW91IGNhbiB1c2UgeW91ciBhdHRhY2htZW50IG5vcm1hbGx5XHJcblx0XHRcdFx0XHRcdFx0XHQvLyB3cC5tZWRpYS5hdHRhY2htZW50KCBhdHRhY2htZW50LmlkICkuZ2V0KCd1cmwnKTtcclxuXHRcdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdFx0Ki9cclxuXHJcblx0XHRcdFx0XHRhdHRhY2htZW50ID0gYXR0YWNobWVudC50b0pTT04oKTtcclxuXHJcblx0XHRcdFx0XHRcdC8qXHJcblx0XHRcdFx0XHRcdFx0aWYgKCBhdHRhY2htZW50LnVybCApIHtcclxuXHRcdFx0XHRcdFx0XHRcdC8vIEluc2VydCBpbmZvIGZyb20gc2VsZWN0ZWQgZmlsZXNcclxuXHRcdFx0XHRcdFx0XHRcdGNzdl9kYXRhX2xpbmUgPSBhdHRhY2htZW50LmlkICsgaW5zZXJ0X2ZpZWxkX3NlcGFyYXRvciArIGF0dGFjaG1lbnQudGl0bGUgICsgaW5zZXJ0X2ZpZWxkX3NlcGFyYXRvciArIGF0dGFjaG1lbnQud3BiY19tZWRpYV92ZXJzaW9uX251bSAgKyBpbnNlcnRfZmllbGRfc2VwYXJhdG9yICsgYXR0YWNobWVudC5kZXNjcmlwdGlvbiArIGluc2VydF9maWVsZF9zZXBhcmF0b3IgKyBhdHRhY2htZW50LnVybFxyXG5cdFx0XHRcdFx0XHRcdFx0ZmlsZV9wYXRocyA9IGZpbGVfcGF0aHMgPyBmaWxlX3BhdGhzICsgXCJcXG5cIiArIGNzdl9kYXRhX2xpbmUgOiBjc3ZfZGF0YV9saW5lO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0Ki9cclxuXHRcdFx0XHRcdCBmaWxlX3BhdGhzID0gZmlsZV9wYXRocyA/IGZpbGVfcGF0aHMgKyBcIlxcblwiICsgYXR0YWNobWVudC51cmwgOiBhdHRhY2htZW50LnVybDtcclxuXHRcdFx0XHR9KTtcclxuXHJcblx0XHRcdFx0dmFyICRmID0galF1ZXJ5KCAnIycgKyBqX2J0bi5kYXRhKCAndXJsX2ZpZWxkJyApICk7XHJcblx0XHRcdFx0JGYudmFsKCBmaWxlX3BhdGhzICk7XHJcblx0XHRcdFx0JGYudHJpZ2dlciggJ2lucHV0JyApO1xyXG5cdFx0XHRcdCRmLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0XHRcdFx0JGYudHJpZ2dlciggJ3dwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHR9ICk7XHJcblxyXG5cdFx0LypcclxuXHRcdFx0Ly8gRmlyZXMgd2hlbiBhIHN0YXRlIGFjdGl2YXRlcy5cclxuXHRcdFx0d3BiY19tZWRpYV9maWxlX2ZyYW1lLm9uKCAnYWN0aXZhdGUnLCBmdW5jdGlvbigpIHsgYWxlcnQoJ2FjdGl2YXRlJyk7IH0gKTtcclxuXHJcblx0XHRcdC8vIEZpcmVzIGFmdGVyIHRoZSBmcmFtZSBtYXJrdXAgaGFzIGJlZW4gYnVpbHQsIGJ1dCBub3QgYXBwZW5kZWQgdG8gdGhlIERPTS5cclxuXHRcdFx0Ly8gQHNlZSB3cC5tZWRpYS52aWV3Lk1vZGFsLmF0dGFjaCgpXHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5vbiggJ3JlYWR5JywgZnVuY3Rpb24oKSB7IGFsZXJ0KCdyZWFkeScpOyB9ICk7XHJcblxyXG5cdFx0XHQvLyBGaXJlcyB3aGVuIHRoZSBmcmFtZSdzICRlbCBpcyBhcHBlbmRlZCB0byBpdHMgRE9NIGNvbnRhaW5lci5cclxuXHRcdFx0Ly8gQHNlZSBtZWRpYS52aWV3Lk1vZGFsLmF0dGFjaCgpXHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5vbiggJ2F0dGFjaCcsIGZ1bmN0aW9uKCkgeyBhbGVydCgnYXR0YWNoJyk7IH0gKTtcclxuXHJcblx0XHRcdC8vIEZpcmVzIHdoZW4gdGhlIG1vZGFsIG9wZW5zIChiZWNvbWVzIHZpc2libGUpLlxyXG5cdFx0XHQvLyBAc2VlIG1lZGlhLnZpZXcuTW9kYWwub3BlbigpXHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5vbiggJ29wZW4nLCBmdW5jdGlvbigpIHsgYWxlcnQoJ29wZW4nKTsgfSApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZXMgd2hlbiB0aGUgbW9kYWwgY2xvc2VzIHZpYSB0aGUgZXNjYXBlIGtleS5cclxuXHRcdFx0Ly8gQHNlZSBtZWRpYS52aWV3Lk1vZGFsLmNsb3NlKClcclxuXHRcdFx0d3BiY19tZWRpYV9maWxlX2ZyYW1lLm9uKCAnZXNjYXBlJywgZnVuY3Rpb24oKSB7IGFsZXJ0KCdlc2NhcGUnKTsgfSApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZXMgd2hlbiB0aGUgbW9kYWwgY2xvc2VzLlxyXG5cdFx0XHQvLyBAc2VlIG1lZGlhLnZpZXcuTW9kYWwuY2xvc2UoKVxyXG5cdFx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub24oICdjbG9zZScsIGZ1bmN0aW9uKCkgeyBhbGVydCgnY2xvc2UnKTsgfSApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZXMgd2hlbiBhIHVzZXIgaGFzIHNlbGVjdGVkIGF0dGFjaG1lbnQocykgYW5kIGNsaWNrZWQgdGhlIHNlbGVjdCBidXR0b24uXHJcblx0XHRcdC8vIEBzZWUgbWVkaWEudmlldy5NZWRpYUZyYW1lLlBvc3QubWFpbkluc2VydFRvb2xiYXIoKVxyXG5cdFx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub24oICdzZWxlY3QnLCBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHR2YXIgc2VsZWN0aW9uQ29sbGVjdGlvbiA9IHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5zdGF0ZSgpLmdldCgnc2VsZWN0Jyk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdC8vIEZpcmVzIHdoZW4gYSBtb2RlIGlzIGRlYWN0aXZhdGVkIG9uIGEgcmVnaW9uIHsgJ21lbnUnIHwgdGl0bGUgfCBjb250ZW50IHwgdG9vbGJhciB8IHJvdXRlciB9XHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5vbiggJ2NvbnRlbnQ6ZGVhY3RpdmF0ZScsIGZ1bmN0aW9uKCkgeyBhbGVydCgne3JlZ2lvbn06ZGVhY3RpdmF0ZScpOyB9ICk7XHJcblx0XHRcdC8vIGFuZCBhIG1vcmUgc3BlY2lmaWMgZXZlbnQgaW5jbHVkaW5nIHRoZSBtb2RlLlxyXG5cdFx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub24oICdjb250ZW50OmRlYWN0aXZhdGU6e21vZGV9JywgZnVuY3Rpb24oKSB7IGFsZXJ0KCd7cmVnaW9ufTpkZWFjdGl2YXRle21vZGV9Jyk7IH0gKTtcclxuXHJcblx0XHRcdC8vIEZpcmVzIHdoZW4gYSByZWdpb24gaXMgcmVhZHkgZm9yIGl0cyB2aWV3IHRvIGJlIGNyZWF0ZWQuXHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5vbiggJ2NvbnRlbnQ6Y3JlYXRlJywgZnVuY3Rpb24oKSB7IGFsZXJ0KCd7cmVnaW9ufTpjcmVhdGUnKTsgfSApO1xyXG5cdFx0XHQvLyBhbmQgYSBtb3JlIHNwZWNpZmljIGV2ZW50IGluY2x1ZGluZyB0aGUgbW9kZS5cclxuXHRcdFx0d3BiY19tZWRpYV9maWxlX2ZyYW1lLm9uKCAnY29udGVudDpjcmVhdGU6e21vZGV9JywgZnVuY3Rpb24oKSB7IGFsZXJ0KCd7cmVnaW9ufTpjcmVhdGV7bW9kZX0nKTsgfSApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZXMgd2hlbiBhIHJlZ2lvbiBpcyByZWFkeSBmb3IgaXRzIHZpZXcgdG8gYmUgcmVuZGVyZWQuXHJcblx0XHRcdHdwYmNfbWVkaWFfZmlsZV9mcmFtZS5vbiggJ2NvbnRlbnQ6cmVuZGVyJywgZnVuY3Rpb24oKSB7IGFsZXJ0KCd7cmVnaW9ufTpyZW5kZXInKTsgfSApO1xyXG5cdFx0XHQvLyBhbmQgYSBtb3JlIHNwZWNpZmljIGV2ZW50IGluY2x1ZGluZyB0aGUgbW9kZS5cclxuXHRcdFx0d3BiY19tZWRpYV9maWxlX2ZyYW1lLm9uKCAnY29udGVudDpyZW5kZXI6e21vZGV9JywgZnVuY3Rpb24oKSB7IGFsZXJ0KCd7cmVnaW9ufTpyZW5kZXJ7bW9kZX0nKTsgfSApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZXMgd2hlbiBhIG5ldyBtb2RlIGlzIGFjdGl2YXRlZCAoYWZ0ZXIgaXQgaGFzIGJlZW4gcmVuZGVyZWQpIG9uIGEgcmVnaW9uLlxyXG5cdFx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub24oICdjb250ZW50OmFjdGl2YXRlJywgZnVuY3Rpb24oKSB7IGFsZXJ0KCd7cmVnaW9ufTphY3RpdmF0ZScpOyB9ICk7XHJcblx0XHRcdC8vIGFuZCBhIG1vcmUgc3BlY2lmaWMgZXZlbnQgaW5jbHVkaW5nIHRoZSBtb2RlLlxyXG5cdFx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub24oICdjb250ZW50OmFjdGl2YXRlOnttb2RlfScsIGZ1bmN0aW9uKCkgeyBhbGVydCgne3JlZ2lvbn06YWN0aXZhdGV7bW9kZX0nKTsgfSApO1xyXG5cclxuXHRcdFx0Ly8gR2V0IGFuIG9iamVjdCByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgc3RhdGUuXHJcblx0XHRcdC8vd3BiY19tZWRpYV9maWxlX2ZyYW1lLnN0YXRlKCk7XHJcblxyXG5cdFx0XHQvLyBHZXQgYW4gb2JqZWN0IHJlcHJlc2VudGluZyB0aGUgcHJldmlvdXMgc3RhdGUuXHJcblx0XHRcdC8vd3BiY19tZWRpYV9maWxlX2ZyYW1lLmxhc3RTdGF0ZSgpO1xyXG5cdFx0Ki9cclxuXHRcdC8qXHJcblx0XHRcdC8vIERlYnVnZSBhbGwgZXZlbnRzIGZyb20gIG1lZGlhIEZyYW1lIVxyXG5cdFx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub24oIFwiYWxsXCIsIGZ1bmN0aW9uICggZXZlbnROYW1lICl7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coICdGcmFtZSBFdmVudDogJyArIGV2ZW50TmFtZSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBEZWJ1Z2UgYWxsIGV2ZW50cyBmcm9tICBtZWRpYSBGcmFtZSFcclxuXHRcdFx0d3AubWVkaWEubW9kZWwuQXR0YWNobWVudC5nZXQoIFwiY29sbGVjdGlvblwiICkuY29sbGVjdGlvbi5vbiggXCJhbGxcIiwgZnVuY3Rpb24gKCBldmVudE5hbWUgKXtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyggJ1tDb2xsZWN0aW9uXSBFdmVudDogJyArIGV2ZW50TmFtZSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHdwLm1lZGlhLm1vZGVsLkF0dGFjaG1lbnQuZ2V0KCBcIm1vZGVsc1wiICkuY29sbGVjdGlvbi5vbiggXCJhbGxcIiwgZnVuY3Rpb24gKCBldmVudE5hbWUgKXtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyggJ1ttb2RlbHNdIEV2ZW50OiAnICsgZXZlbnROYW1lICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0d3AubWVkaWEubW9kZWwuQXR0YWNobWVudC5nZXQoIFwidmlld3NcIiApLmNvbGxlY3Rpb24ub24oIFwiYWxsXCIsIGZ1bmN0aW9uICggZXZlbnROYW1lICl7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coICdbdmlld3NdIEV2ZW50OiAnICsgZXZlbnROYW1lICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdCovXHJcblxyXG5cdFx0Ly8gT3BlbiB0aGUgbW9kYWwuXHJcblx0XHR3cGJjX21lZGlhX2ZpbGVfZnJhbWUub3BlbigpO1xyXG5cclxufSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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
