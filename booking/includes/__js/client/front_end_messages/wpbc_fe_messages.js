/**
 * =====================================================================================================================
 *	includes/__js/front_end_messages/wpbc_fe_messages.js
 * =====================================================================================================================
 */

// ---------------------------------------------------------------------------------------------------------------------
// Show Messages at Front-Edn side
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Extract a safe plain-text message from a recognized JSON AJAX error response.
 *
 * Only documented message properties are accepted. Callers must still render the returned value in text mode so an
 * upstream response cannot inject markup into the public booking page.
 *
 * @param {jqXHR|null} jq_xhr jQuery XHR object, when available.
 * @return {string} Bounded server message, or an empty string when the response is not recognized.
 */
function wpbc_front_end__get_safe_ajax_error_message( jq_xhr ) {
	if (
		! jq_xhr
		|| ! jq_xhr.responseJSON
		|| 'object' !== typeof jq_xhr.responseJSON
		|| Array.isArray( jq_xhr.responseJSON )
	) {
		return '';
	}

	var response_json      = jq_xhr.responseJSON;
	var message_candidates = [];

	if ( 'string' === typeof response_json.message ) {
		message_candidates.push( response_json.message );
	}
	if (
		response_json.data
		&& 'object' === typeof response_json.data
		&& ! Array.isArray( response_json.data )
		&& 'string' === typeof response_json.data.message
	) {
		message_candidates.push( response_json.data.message );
	}

	for ( var candidate_index = 0; candidate_index < message_candidates.length; candidate_index++ ) {
		var server_message = message_candidates[ candidate_index ].trim();
		if ( server_message ) {
			return server_message.slice( 0, 1000 );
		}
	}

	return '';
}

/**
 * Build a public-safe AJAX failure message with optional HTTP 409 cache troubleshooting guidance.
 *
 * @param {jqXHR|null} jq_xhr                    jQuery XHR object, when available.
 * @param {string}     fallback_message          Localized fallback shown when no safe server message exists.
 * @param {string}     http_conflict_cache_hint  Optional localized cache guidance for HTTP 409 responses.
 * @return {string} Plain-text message including the HTTP status when available.
 */
function wpbc_front_end__get_ajax_error_message( jq_xhr, fallback_message, http_conflict_cache_hint ) {
	var http_status         = jq_xhr && jq_xhr.status ? parseInt( jq_xhr.status, 10 ) : 0;
	var safe_server_message = wpbc_front_end__get_safe_ajax_error_message( jq_xhr );
	var error_message       = safe_server_message || String( fallback_message || '' ).trim();

	if ( 409 === http_status && http_conflict_cache_hint ) {
		error_message += ( error_message ? ' ' : '' ) + String( http_conflict_cache_hint ).trim();
	}
	if ( http_status ) {
		error_message += ' (' + http_status + ')';
	}

	return error_message;
}

/**
 * Log an unexpected AJAX response for browser-console diagnostics.
 *
 * The response is intentionally kept out of frontend notices because it can contain a complete HTML error or login page.
 * Logging it here preserves the server payload and request context for support troubleshooting.
 *
 * @param {string}      ajax_action   WordPress AJAX action that produced the unexpected response.
 * @param {*}           response_data Raw response payload returned by the server.
 * @param {jqXHR|null}  jq_xhr        jQuery XHR object, when available.
 * @param {string}      text_status   jQuery request status or success state.
 * @param {string|Error} error_thrown Error description or exception reported by jQuery.
 * @return {void}
 */
function wpbc_front_end__log_unexpected_ajax_response( ajax_action, response_data, jq_xhr, text_status, error_thrown ) {
	if ( ! window.console || 'function' !== typeof window.console.error ) {
		return;
	}

	try {
		var content_type       = '';
		var response_text      = 'string' === typeof response_data ? response_data : '';
		var response_length    = response_text.length;
		var response_format    = response_text ? 'text' : 'empty';
		var http_status        = jq_xhr && jq_xhr.status ? parseInt( jq_xhr.status, 10 ) : 0;
		var diagnostic_action  = String( ajax_action || 'AJAX' ).replace( /^WPBC_AJX_/, '' ).replace( /[^A-Za-z0-9]+/g, '-' ).toUpperCase();
		var diagnostic_code    = 'WPBC-' + diagnostic_action + '-' + ( http_status || 'NETWORK' );
		var response_headers   = {};
		if ( jq_xhr && 'function' === typeof jq_xhr.getResponseHeader ) {
			content_type = jq_xhr.getResponseHeader( 'content-type' ) || '';
			response_headers = {
				'server'           : jq_xhr.getResponseHeader( 'server' ) || '',
				'cf_ray'           : jq_xhr.getResponseHeader( 'cf-ray' ) || '',
				'x_cache'          : jq_xhr.getResponseHeader( 'x-cache' ) || '',
				'x_cache_status'   : jq_xhr.getResponseHeader( 'x-cache-status' ) || '',
				'x_litespeed_cache': jq_xhr.getResponseHeader( 'x-litespeed-cache' ) || '',
				'x_request_id'     : jq_xhr.getResponseHeader( 'x-request-id' ) || ''
			};
		}
		if ( jq_xhr && jq_xhr.responseJSON && 'object' === typeof jq_xhr.responseJSON ) {
			response_format = 'json';
			try {
				response_length = JSON.stringify( jq_xhr.responseJSON ).length;
			} catch ( response_json_error ) {
				response_length = 0;
			}
		} else if ( -1 !== content_type.toLowerCase().indexOf( 'html' ) || /^\s*(?:<!doctype|<html)/i.test( response_text ) ) {
			response_format = 'html';
		}

		window.console.error( '[WPBC][AJAX-UNEXPECTED-RESPONSE] ' + ajax_action, {
			'action'          : ajax_action,
			'diagnostic_code' : diagnostic_code,
			'http_status'     : http_status,
			'http_status_text': jq_xhr && jq_xhr.statusText ? jq_xhr.statusText : '',
			'text_status'     : text_status || '',
			'error'           : error_thrown || '',
			'content_type'    : content_type,
			'response_format' : response_format,
			'response_length' : response_length,
			'server_message'  : wpbc_front_end__get_safe_ajax_error_message( jq_xhr ),
			'response_headers': response_headers,
			'response'        : response_data
		} );
	} catch ( logging_error ) {
		// Console diagnostics must never interrupt frontend error recovery.
	}
}

/**
 * Show message in content
 *
 * @param message				Message HTML
 * @param params = {
 *								'type'     : 'warning',							// 'error' | 'warning' | 'info' | 'success'
 *								'show_here' : {
 *													'jq_node' : '',				// any jQuery node definition
 *													'where'   : 'inside'		// 'inside' | 'before' | 'after' | 'right' | 'left'
 *											  },
 *								'is_append': true,								// Apply  only if 	'where'   : 'inside'
 *								'style'    : 'text-align:left;',				// styles, if needed
 *							    'css_class': '',								// For example can  be: 'wpbc_fe_message_alt'
 *								'delay'    : 0,									// how many microsecond to  show,  if 0  then  show forever
 *								'if_visible_not_show': false					// if true,  then do not show message,  if previos message was not hided (not apply if 'where'   : 'inside' )
 *				};
 * Examples:
 * 			var html_id = wpbc_front_end__show_message( 'You can test days selection in calendar', {} );
 *
 *			var notice_message_id = wpbc_front_end__show_message( _wpbc.get_message( 'message_check_required' ), { 'type': 'warning', 'delay': 10000, 'if_visible_not_show': true,
 *																  'show_here': {'where': 'right', 'jq_node': el,} } );
 *
 *			wpbc_front_end__show_message( response_data[ 'ajx_data' ][ 'ajx_after_action_message' ].replace( /\n/g, "<br />" ),
 *											{   'type'     : ( 'undefined' !== typeof( response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ] ) )
 *															  ? response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ] : 'info',
 *												'show_here': {'jq_node': jq_node, 'where': 'after'},
 *												'css_class':'wpbc_fe_message_alt',
 *												'delay'    : 10000
 *											} );
 *
 *
 * @returns string  - HTML ID		or 0 if not showing during this time.
 */
function wpbc_front_end__show_message( message, params = {} ){

	var params_default = {
								'type'     : 'warning',							// 'error' | 'warning' | 'info' | 'success'
								'show_here' : {
													'jq_node' : '',				// any jQuery node definition
													'where'   : 'inside'		// 'inside' | 'before' | 'after' | 'right' | 'left'
											  },
								'is_append': true,								// Apply  only if 	'where'   : 'inside'
								'style'    : 'text-align:left;',				// styles, if needed
							    'css_class': '',								// For example can  be: 'wpbc_fe_message_alt'
								'delay'    : 0,									// how many microsecond to  show,  if 0  then  show forever
								'if_visible_not_show': false,					// if true,  then do not show message,  if previos message was not hided (not apply if 'where'   : 'inside' )
								'is_scroll': true,								// is scroll  to  this element
								'content_mode': 'html'							// 'html' for trusted legacy content | 'text' for editable/user content
						};
	for ( var p_key in params ){
		params_default[ p_key ] = params[ p_key ];
	}
	params = params_default;

	if ( 'text' === params[ 'content_mode' ] ) {
		message = jQuery( '<div>' ).text( null === message || 'undefined' === typeof message ? '' : String( message ) ).html().replace( /\n/g, '<br />' );
	}

    var unique_div_id = new Date();
    unique_div_id = 'wpbc_notice_' + unique_div_id.getTime();

	params['css_class'] += ' wpbc_fe_message';
	if ( params['type'] == 'error' ){
		params['css_class'] += ' wpbc_fe_message_error';
		message = '<i class="menu_icon icon-1x wpbc_icn_report_gmailerrorred"></i>' + message;
	}
	if ( params['type'] == 'warning' ){
		params['css_class'] += ' wpbc_fe_message_warning';
		message = '<i class="menu_icon icon-1x wpbc_icn_warning"></i>' + message;
	}
	if ( params['type'] == 'info' ){
		params['css_class'] += ' wpbc_fe_message_info';
	}
	if ( params['type'] == 'success' ){
		params['css_class'] += ' wpbc_fe_message_success';
		message = '<i class="menu_icon icon-1x wpbc_icn_done_outline"></i>' + message;
	}

	var scroll_to_element = '<div id="' + unique_div_id + '_scroll" style="display:none;"></div>';
	message = '<div id="' + unique_div_id + '" class="wpbc_front_end__message ' + params['css_class'] + '" style="' + params[ 'style' ] + '">' + message + '</div>';


	var jq_el_message = false;
	var is_show_message = true;

	if ( 'inside' === params[ 'show_here' ][ 'where' ] ){

		if ( params[ 'is_append' ] ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).append( scroll_to_element );
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).append( message );
		} else {
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).html( scroll_to_element + message );
		}

	} else if ( 'before' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).siblings( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( message );
		}

	} else if ( 'after' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).nextAll( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );		// We need to  set  here before(for handy scroll)
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).after( message );
		}

	} else if ( 'right' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).nextAll( '.wpbc_front_end__message_container_right' ).find( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );		// We need to  set  here before(for handy scroll)
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).after( '<div class="wpbc_front_end__message_container_right">' + message + '</div>' );
		}
	} else if ( 'left' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).siblings( '.wpbc_front_end__message_container_left' ).find( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );		// We need to  set  here before(for handy scroll)
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( '<div class="wpbc_front_end__message_container_left">' + message + '</div>' );
		}
	}

	if (   ( is_show_message )  &&  ( parseInt( params[ 'delay' ] ) > 0 )   ){
		var closed_timer = setTimeout( function (){
													jQuery( '#' + unique_div_id ).fadeOut( 1500 );
										} , parseInt( params[ 'delay' ] )   );

		var closed_timer2 = setTimeout( function (){
														jQuery( '#' + unique_div_id ).trigger( 'hide' );
										}, ( parseInt( params[ 'delay' ] ) + 1501 ) );
	}

	// Check  if showed message in some hidden parent section and show it. But it must  be lower than '.wpbc_container'
	var parent_els = jQuery( '#' + unique_div_id ).parents().map( function (){
		if ( (!jQuery( this ).is( 'visible' )) && (jQuery( '.wpbc_container' ).has( this )) ){
			jQuery( this ).show();
		}
	} );

	if ( params[ 'is_scroll' ] ){
		wpbc_do_scroll( '#' + unique_div_id + '_scroll' );
	}

	return unique_div_id;
}


	/**
	 * Error message. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__error( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'right',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Error message UNDER element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__error_under_element( jq_node, message, message_delay, content_mode ){

		if ( 'undefined' === typeof (message_delay) ){
			message_delay = 0
		}
		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : message_delay,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'after',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Error message UNDER element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__error_above_element( jq_node, message, message_delay, content_mode ){

		if ( 'undefined' === typeof (message_delay) ){
			message_delay = 10000
		}
		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : message_delay,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'before',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Warning message. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__warning( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'right',
																							'jq_node': jq_node
																						   }
																}
														);
		wpbc_highlight_error_on_form_field( jq_node );
		return notice_message_id;
	}


	/**
	 * Warning message UNDER element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__warning_under_element( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'after',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Warning message ABOVE element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__warning_above_element( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'before',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}

	/**
	 * Highlight Error in specific field
	 *
	 * @param jq_node					string or jQuery element,  where scroll  to
	 */
	function wpbc_highlight_error_on_form_field( jq_node ){

		if ( !jQuery( jq_node ).length ){
			return;
		}
		if ( ! jQuery( jq_node ).is( ':input' ) ){
			// Situation with  checkboxes or radio  buttons
			var jq_node_arr = jQuery( jq_node ).find( ':input' );
			if ( !jq_node_arr.length ){
				return
			}
			jq_node = jq_node_arr.get( 0 );
		}
		var params = {};
		params[ 'delay' ] = 10000;

		if ( !jQuery( jq_node ).hasClass( 'wpbc_form_field_error' ) ){

			jQuery( jq_node ).addClass( 'wpbc_form_field_error' )

			if ( parseInt( params[ 'delay' ] ) > 0 ){
				var closed_timer = setTimeout( function (){
															 jQuery( jq_node ).removeClass( 'wpbc_form_field_error' );
														  }
											   , parseInt( params[ 'delay' ] )
									);

			}
		}
	}

/**
 * Scroll to specific element
 *
 * @param jq_node					string or jQuery element,  where scroll  to
 * @param extra_shift_offset		int shift offset from  jq_node
 */
function wpbc_do_scroll( jq_node , extra_shift_offset = 0 ){

	if ( !jQuery( jq_node ).length ){
		return;
	}
	var targetOffset = jQuery( jq_node ).offset().top;

	if ( targetOffset <= 0 ){
		if ( 0 != jQuery( jq_node ).nextAll( ':visible' ).length ){
			targetOffset = jQuery( jq_node ).nextAll( ':visible' ).first().offset().top;
		} else if ( 0 != jQuery( jq_node ).parent().nextAll( ':visible' ).length ){
			targetOffset = jQuery( jq_node ).parent().nextAll( ':visible' ).first().offset().top;
		}
	}

	if ( jQuery( '#wpadminbar' ).length > 0 ){
		targetOffset = targetOffset - 50 - 50;
	} else {
		targetOffset = targetOffset - 20 - 50;
	}
	targetOffset += extra_shift_offset;

	// Scroll only  if we did not scroll before
	if ( ! jQuery( 'html,body' ).is( ':animated' ) ){
		jQuery( 'html,body' ).animate( {scrollTop: targetOffset}, 500 );
	}
}

