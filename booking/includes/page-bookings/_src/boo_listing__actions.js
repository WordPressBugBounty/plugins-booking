/**
 * Booking Actions in Booking Listing.
 *
 * @version     1.0
 * @package     Booking Calendar
 * @author      wpdevelop
 *
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 * @modified    2025-04-08
 */

/**
 * Check if we can open modal.
 *
 * @param html_id      ID of modal window, e.g.: '#wpbc_modal__payment_status_edit__section'
 *
 * @returns {boolean}
 */
function wpbc_is_modal_accessible( html_id ) {
	if ( 'function' !== typeof (jQuery( html_id ).wpbc_my_modal) ) {
		alert( 'Warning! wpbc_my_modal module has not found. Please, recheck about any conflicts by deactivating other plugins.' );
		return false;
	}
	return true;
}


// ---------------------------------------------------------------------------------------------------------------------
// == Actions, while cliking on option dropdown ==
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Open Add/Edit Booking modal from Booking Listing row values.
 *
 * @param {string|number} booking_id Booking ID.
 * @param {string|number} resource_id Resource ID.
 * @param {string} booking_hash Booking hash.
 * @param {string} booking_form Custom booking form name.
 * @returns {boolean|undefined}
 */
function wpbc_boo_listing__click__add_booking_modal_from_row( booking_id, resource_id, booking_hash, booking_form ){

	if ( ! booking_hash ) {
		return false;
	}

	return wpbc_boo_listing__click__add_booking_modal( {
		mode         : 'edit',
		booking_id   : booking_id || '',
		resource_id  : resource_id || '',
		booking_hash : booking_hash || '',
		booking_form : booking_form || ''
	} );
}

/**
 * Insert AJAX-rendered Add/Edit Booking HTML and run its inline lifecycle scripts once.
 *
 * @param {Object} $body Modal body jQuery object.
 * @param {string} html Rendered component HTML.
 */
function wpbc_boo_listing__set_add_booking_modal_body_html( $body, html ){

	var $html    = jQuery( '<div />' ).append( jQuery.parseHTML( html || '', document, true ) );
	var $scripts = $html.find( 'script' ).remove();

	$body.html( $html.contents() );

	$scripts.each( function(){
		var type = ( jQuery( this ).attr( 'type' ) || '' ).toLowerCase();
		var src  = jQuery( this ).attr( 'src' );
		var code = this.text || this.textContent || this.innerHTML || '';

		if ( type && ! /^(text|application)\/(x-)?javascript$/.test( type ) ) {
			return;
		}

		if ( src ) {
			jQuery.ajax( {
				url      : src,
				dataType : 'script',
				cache    : true,
				async    : false
			} );
			return;
		}

		if ( code ) {
			jQuery.globalEval( code );
		}
	} );
}

/**
 * Get modal loading spinner HTML.
 *
 * @returns {string}
 */
function wpbc_boo_listing__get_add_booking_modal_loading_html(){
	return '<div class="wpbc_spins_loading_container">'
		+ '<div class="wpbc_booking_form_spin_loader">'
		+ '<div class="wpbc_spins_loader_wrapper">'
		+ '<div class="wpbc_spin_loader_one_new"></div>'
		+ '</div>'
		+ '</div>'
		+ '<span>Loading...</span>'
		+ '</div>';
}

/**
 * Normalize time option values for comparison.
 *
 * @param {string} value Time or time-range value.
 * @returns {string}
 */
function wpbc_boo_listing__normalize_time_value( value ){
	return String( value || '' ).replace( /\s+/g, '' ).toLowerCase();
}

/**
 * Parse "HH:MM - HH:MM" selected time into start/end values.
 *
 * @param {string} selected_time Time range.
 * @returns {{start_time:string,end_time:string}}
 */
function wpbc_boo_listing__parse_selected_time_range( selected_time ){

	var time_parts = String( selected_time || '' ).split( ' - ' );

	return {
		start_time: jQuery.trim( time_parts[0] || '' ),
		end_time: jQuery.trim( time_parts[1] || '' )
	};
}

/**
 * Get booking form time fields that can conflict with a timeline override.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @returns {Object} jQuery collection.
 */
function wpbc_boo_listing__get_add_booking_modal_time_fields( $form, resource_id ){

	var selector = [
		'select[name="rangetime' + resource_id + '"]',
		'select[name="rangetime' + resource_id + '[]"]',
		'select[name="starttime' + resource_id + '"]',
		'select[name="starttime' + resource_id + '[]"]',
		'select[name="endtime' + resource_id + '"]',
		'select[name="endtime' + resource_id + '[]"]',
		'select[name="durationtime' + resource_id + '"]',
		'select[name="durationtime' + resource_id + '[]"]',
		'input[name="starttime' + resource_id + '"]',
		'input[name="endtime' + resource_id + '"]'
	].join( ', ' );

	return $form.find( selector ).filter( function(){
		var $field = jQuery( this );

		if ( $field.closest( '.wpbc_add_booking_modal__selected_time_fields' ).length ) {
			return false;
		}

		if ( 'input' === this.tagName.toLowerCase() && 'hidden' === String( $field.attr( 'type' ) || '' ).toLowerCase() ) {
			return false;
		}

		return true;
	} );
}

/**
 * Select matching option in a time select without forcing disabled choices.
 *
 * @param {Object} $select Select element.
 * @param {Array} expected_values Acceptable values.
 * @returns {boolean}
 */
function wpbc_boo_listing__select_time_option( $select, expected_values ){

	var did_select = false;
	var normalized_expected = [];

	jQuery.each( expected_values, function( index, value ){
		normalized_expected.push( wpbc_boo_listing__normalize_time_value( value ) );
	} );

	$select.find( 'option' ).each( function(){
		var $option = jQuery( this );
		var option_value = wpbc_boo_listing__normalize_time_value( $option.val() );

		if ( -1 === jQuery.inArray( option_value, normalized_expected ) || $option.prop( 'disabled' ) ) {
			return true;
		}

		if ( $select.prop( 'multiple' ) ) {
			$option.prop( 'selected', true );
		} else {
			$select.val( $option.val() );
		}

		$select.trigger( 'change' );
		did_select = true;
		return false;
	} );

	return did_select;
}

/**
 * Check whether the rendered booking form already has user-facing time fields.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @returns {boolean}
 */
function wpbc_boo_listing__has_add_booking_modal_time_fields( $form, resource_id ){

	return wpbc_boo_listing__get_add_booking_modal_time_fields( $form, resource_id ).length > 0;
}

/**
 * Add visible read-only start/end time fields when the selected booking form has no time controls.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @param {string} start_time Start time in 24h format.
 * @param {string} end_time End time in 24h format.
 * @returns {boolean}
 */
function wpbc_boo_listing__ensure_add_booking_modal_selected_time_fields( $form, resource_id, start_time, end_time ){

	var $wrap = $form.find( '.wpbc_add_booking_modal__selected_time_fields' );
	var html;
	var $insert_before;

	if ( ! start_time || ! end_time ) {
		return false;
	}

	if ( ! $wrap.length ) {
		html = '<div class="wpbc_add_booking_modal__selected_time_fields" style="margin:12px 0;padding:12px;border:1px solid #dcdcde;background:#f6f7f7;border-radius:4px;">'
			+ '<div style="font-weight:600;margin-bottom:8px;">Selected timeline interval</div>'
			+ '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">'
			+ '<label style="display:flex;flex-direction:column;gap:4px;min-width:120px;">'
			+ '<span>Start time</span>'
			+ '<input type="text" class="wpbc_ui_control wpbc_ui_text" name="starttime' + resource_id + '" value="" readonly="readonly" />'
			+ '</label>'
			+ '<label style="display:flex;flex-direction:column;gap:4px;min-width:120px;">'
			+ '<span>End time</span>'
			+ '<input type="text" class="wpbc_ui_control wpbc_ui_text" name="endtime' + resource_id + '" value="" readonly="readonly" />'
			+ '</label>'
			+ '</div>'
			+ '</div>';

		$wrap = jQuery( html );
		$insert_before = $form.find( '#bk_type' + resource_id ).first();

		if ( $insert_before.length ) {
			$insert_before.before( $wrap );
		} else {
			$form.find( '#booking_form_div' + resource_id ).append( $wrap );
		}
	}

	$wrap.find( 'input[name="starttime' + resource_id + '"]' ).val( start_time ).trigger( 'input' ).trigger( 'change' );
	$wrap.find( 'input[name="endtime' + resource_id + '"]' ).val( end_time ).trigger( 'input' ).trigger( 'change' );

	return true;
}

/**
 * Add/update the explicit timeline interval override panel.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @param {Object} data Modal context.
 * @returns {boolean}
 */
function wpbc_boo_listing__ensure_add_booking_modal_time_override_panel( $form, resource_id, data ){

	var selected_time = ( data && data.selected_time ) ? data.selected_time : '';
	var parsed_time = wpbc_boo_listing__parse_selected_time_range( selected_time );
	var start_time = ( data && data.time_override_start ) ? data.time_override_start : parsed_time.start_time;
	var end_time = ( data && data.time_override_end ) ? data.time_override_end : parsed_time.end_time;
	var $modal = jQuery( '#wpbc_modal__add_booking__section' );
	var $footer_slot = $modal.find( '[data-wpbc-add-booking-time-override-footer]' ).first();
	var toggle_id = 'wpbc_modal__add_booking__time_override_enabled';
	var $wrap = $modal.find( '[data-wpbc-add-booking-time-override-panel]' ).first();
	var html;

	if ( ! start_time || ! end_time ) {
		return false;
	}

	if ( ! $wrap.length ) {
		html = '<div class="wpbc_add_booking_modal__selected_time_fields wpbc_add_booking_modal__time_override" data-wpbc-add-booking-time-override-panel="1">'
			+ '<span class="wpbc_ui__toggle wpbc_add_booking_modal__time_override_toggle">'
			+ '<input type="checkbox" id="' + toggle_id + '" value="1" class="wpbc_ui_checkbox" data-wpbc-add-booking-time-override-enabled="1" data-wpbc-booking-submit-ignore="1" checked="checked" autocomplete="off" />'
			+ '<label class="wpbc_ui__toggle_icon tooltip_top" for="' + toggle_id + '" data-original-title="Use selected timeline interval"></label>'
			+ '<label for="' + toggle_id + '" class="wpbc_ui_control_label wpbc_ui__toggle_label">Use selected timeline interval</label>'
			+ '<i class="wpbc_help_tooltip"></i>'
			+ '</span>'
			+ '<div class="wpbc_add_booking_modal__time_override_fields">'
			+ '<label><span>Start time</span><input type="text" class="wpbc_ui_control wpbc_ui_text" name="starttime' + resource_id + '" value="" readonly="readonly" data-wpbc-add-booking-time-override-field="start" /></label>'
			+ '<label><span>End time</span><input type="text" class="wpbc_ui_control wpbc_ui_text" name="endtime' + resource_id + '" value="" readonly="readonly" data-wpbc-add-booking-time-override-field="end" /></label>'
			+ '</div>'
			+ '<div class="wpbc_add_booking_modal__time_override_note">Form time fields are ignored while enabled.</div>'
			+ '</div>';

		$wrap = jQuery( html );

		if ( $footer_slot.length ) {
			$footer_slot.html( $wrap );
		} else {
			$modal.find( '.modal-footer' ).prepend( $wrap );
		}
	}

	$wrap.attr( 'data-wpbc-add-booking-time-override-source', ( data && data.time_override_source ) ? data.time_override_source : '' );
	$wrap.find( '[data-wpbc-add-booking-time-override-field="start"]' ).attr( 'name', 'starttime' + resource_id ).val( start_time ).trigger( 'input' ).trigger( 'change' );
	$wrap.find( '[data-wpbc-add-booking-time-override-field="end"]' ).attr( 'name', 'endtime' + resource_id ).val( end_time ).trigger( 'input' ).trigger( 'change' );
	$wrap.find( '[data-wpbc-add-booking-time-override-enabled]' ).prop( 'checked', ! data || ( '0' !== String( data.time_override_enabled || '1' ) ) );

	wpbc_boo_listing__apply_add_booking_modal_time_override_state( $form, resource_id );

	return true;
}

/**
 * Enable/disable the timeline interval override and mark conflicting form fields.
 *
 * @param {Object} $form Booking form jQuery object.
 * @param {number} resource_id Booking resource ID.
 * @returns {boolean}
 */
function wpbc_boo_listing__apply_add_booking_modal_time_override_state( $form, resource_id ){

	var $modal = jQuery( '#wpbc_modal__add_booking__section' );
	var $wrap = $modal.find( '[data-wpbc-add-booking-time-override-panel]' ).first();
	var $enabled = $wrap.find( '[data-wpbc-add-booking-time-override-enabled]' ).first();
	var is_enabled = $enabled.length ? $enabled.is( ':checked' ) : false;
	var $override_fields = $wrap.find( '[data-wpbc-add-booking-time-override-field]' );
	var $form_time_fields = wpbc_boo_listing__get_add_booking_modal_time_fields( $form, resource_id );

	if ( ! $wrap.length ) {
		return false;
	}

	$wrap.toggleClass( 'is-enabled', is_enabled );
	$override_fields.attr( 'data-wpbc-booking-submit-ignore', is_enabled ? '0' : '1' );

	$form_time_fields.each( function(){
		var $field = jQuery( this );

		if ( is_enabled ) {
			if ( 'undefined' === typeof $field.attr( 'data-wpbc-add-booking-time-override-original-disabled' ) ) {
				$field.attr( 'data-wpbc-add-booking-time-override-original-disabled', $field.prop( 'disabled' ) ? '1' : '0' );
			}
			$field
				.attr( 'data-wpbc-booking-submit-ignore', '1' )
				.prop( 'disabled', true )
				.addClass( 'wpbc_add_booking_modal__time_field_overridden' );
		} else {
			$field
				.removeAttr( 'data-wpbc-booking-submit-ignore' )
				.prop( 'disabled', '1' === $field.attr( 'data-wpbc-add-booking-time-override-original-disabled' ) )
				.removeAttr( 'data-wpbc-add-booking-time-override-original-disabled' )
				.removeClass( 'wpbc_add_booking_modal__time_field_overridden' );
		}
	} );

	return is_enabled;
}

/**
 * Apply a preselected time range to the rendered Add Booking form.
 *
 * @param {number} resource_id Booking resource ID.
 * @param {string} selected_time Time range, e.g. "09:00 - 11:00".
 * @returns {boolean}
 */
function wpbc_boo_listing__apply_add_booking_modal_selected_time( resource_id, selected_time ){

	var $form = jQuery( '#booking_form' + resource_id );
	var time_parts;
	var start_time;
	var end_time;
	var did_select = false;
	var has_time_fields;

	if ( ! $form.length || ! selected_time ) {
		return false;
	}

	time_parts = wpbc_boo_listing__parse_selected_time_range( selected_time );
	start_time = time_parts.start_time;
	end_time = time_parts.end_time;
	has_time_fields = wpbc_boo_listing__has_add_booking_modal_time_fields( $form, resource_id );

	if ( ! has_time_fields ) {
		return wpbc_boo_listing__ensure_add_booking_modal_selected_time_fields( $form, resource_id, start_time, end_time );
	}

	$form.find( 'select[name="rangetime' + resource_id + '"], select[name="rangetime' + resource_id + '[]"]' ).each( function(){
		did_select = wpbc_boo_listing__select_time_option( jQuery( this ), [ selected_time ] ) || did_select;
	} );

	if ( start_time ) {
		$form.find( 'select[name="starttime' + resource_id + '"], select[name="starttime' + resource_id + '[]"]' ).each( function(){
			did_select = wpbc_boo_listing__select_time_option( jQuery( this ), [ start_time ] ) || did_select;
		} );
		if ( $form.find( 'input[name="starttime' + resource_id + '"]' ).not( '[type="hidden"]' ).val( start_time ).trigger( 'input' ).trigger( 'change' ).length ) {
			did_select = true;
		}
	}

	if ( end_time ) {
		$form.find( 'select[name="endtime' + resource_id + '"], select[name="endtime' + resource_id + '[]"]' ).each( function(){
			did_select = wpbc_boo_listing__select_time_option( jQuery( this ), [ end_time ] ) || did_select;
		} );
		if ( $form.find( 'input[name="endtime' + resource_id + '"]' ).not( '[type="hidden"]' ).val( end_time ).trigger( 'input' ).trigger( 'change' ).length ) {
			did_select = true;
		}
	}

	return did_select;
}

/**
 * Apply Add Booking modal date/time context after AJAX-rendered form lifecycle scripts run.
 *
 * @param {Object} data AJAX response data.
 */
function wpbc_boo_listing__preload_add_booking_modal_selection( data ){

	data = data || {};

	var resource_id = parseInt( data.resource_id, 10 );
	var selected_date = data.selected_date || '';
	var selected_time = data.selected_time || '';
	var selected_dates_without_calendar = data.selected_dates_without_calendar || '';
	var is_time_override = !! parseInt( data.time_override_enabled || 0, 10 );
	var apply_time;

	if ( ! resource_id ) {
		return;
	}

	if ( ! is_time_override ) {
		jQuery( '#wpbc_modal__add_booking__section' ).find( '[data-wpbc-add-booking-time-override-panel]' ).remove();
	}

	if (
		   selected_date
		&& ! selected_dates_without_calendar
		&& ( 'function' === typeof wpbc_auto_select_dates_in_calendar )
	) {
		jQuery( 'body' ).off( 'wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_date' ).one( 'wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_date', function( event, loaded_resource_id ){
			if ( parseInt( loaded_resource_id, 10 ) === resource_id ) {
				wpbc_auto_select_dates_in_calendar( resource_id, selected_date, selected_date );
			}
		} );
		window.setTimeout( function(){
			wpbc_auto_select_dates_in_calendar( resource_id, selected_date, selected_date );
		}, 300 );
	}

	if ( ! selected_time ) {
		return;
	}

	apply_time = function(){
		var is_calendar_data_loaded = (
			   ! selected_date
			|| ( 'undefined' === typeof _wpbc )
			|| ( 'function' !== typeof _wpbc.bookings_in_calendar__get_for_date )
			|| ( false !== _wpbc.bookings_in_calendar__get_for_date( resource_id, selected_date ) )
		);

		if ( is_calendar_data_loaded && ( 'function' === typeof wpbc_disable_time_fields_in_booking_form ) ) {
			wpbc_disable_time_fields_in_booking_form( resource_id );
		}
		if ( is_time_override ) {
			wpbc_boo_listing__ensure_add_booking_modal_time_override_panel( jQuery( '#booking_form' + resource_id ), resource_id, data );
			return;
		}
		wpbc_boo_listing__apply_add_booking_modal_selected_time( resource_id, selected_time );
	};

	jQuery( '.booking_form_div' ).off( 'wpbc_hook_timeslots_disabled.wpbc_add_booking_modal_time' ).one( 'wpbc_hook_timeslots_disabled.wpbc_add_booking_modal_time', function( event, loaded_resource_id ){
		if ( parseInt( loaded_resource_id, 10 ) === resource_id ) {
			window.setTimeout( apply_time, 0 );
		}
	} );

	jQuery( 'body' ).off( 'wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_time' ).one( 'wpbc_calendar_ajx__loaded_data.wpbc_add_booking_modal_time', function( event, loaded_resource_id ){
		if ( parseInt( loaded_resource_id, 10 ) === resource_id ) {
			window.setTimeout( apply_time, 80 );
		}
	} );

	window.setTimeout( apply_time, 350 );
	window.setTimeout( apply_time, 1000 );
}

/**
 * Refresh modal footer controls after Add/Edit Booking context changes.
 *
 * @param {Object} $modal Modal jQuery object.
 * @param {Object} data AJAX response data.
 * @param {string} mode Current modal mode.
 */
function wpbc_boo_listing__sync_add_booking_modal_controls( $modal, data, mode ){

	data = data || {};

	$modal.attr( 'data-wpbc-add-booking-mode', mode || data.mode || 'add' );

	var $resource_control = $modal.find( '.wpbc_modal__add_booking__resource_control' );
	var $resource_select  = $modal.find( '#wpbc_modal__add_booking__resource_id' );
	var $form_select      = $modal.find( '#wpbc_modal__add_booking__booking_form' );
	var $form_edit_link   = $modal.find( '.wpbc_modal__add_booking__edit_form_link' );
	var $allow_past_control = $modal.find( '.wpbc_modal__add_booking__allow_past_control' );
	var $allow_past_toggle  = $modal.find( '[data-wpbc-add-booking-allow-past]' ).first();
	var current_mode        = mode || data.mode || 'add';

	if ( 'edit' === current_mode ) {
		$resource_control.hide();
		$allow_past_control.hide();
	} else {
		$resource_control.show();
		$allow_past_control.show();
	}

	if ( data.resource_id && $resource_select.length ) {
		$resource_select.val( String( data.resource_id ) );
	}

	if ( $form_select.length ) {
		$form_select.val( data.booking_form || 'standard' );
	}

	if ( $form_edit_link.length ) {
		wpbc_boo_listing__sync_add_booking_modal_form_edit_link( $modal );
	}

	if ( $allow_past_toggle.length ) {
		$allow_past_toggle.prop( 'checked', !! parseInt( data.allow_past || 0, 10 ) );
	}
}

/**
 * Sync Forms Builder edit link with selected custom booking form.
 *
 * @param {Object} $modal Modal jQuery object.
 */
function wpbc_boo_listing__sync_add_booking_modal_form_edit_link( $modal ){

	var $form_select    = $modal.find( '#wpbc_modal__add_booking__booking_form' );
	var $form_edit_link = $modal.find( '.wpbc_modal__add_booking__edit_form_link' );

	if ( ! $form_select.length || ! $form_edit_link.length ) {
		return;
	}

	var form_name = $form_select.val() || 'standard';
	var base_url  = $form_edit_link.attr( 'data-wpbc-add-booking-form-builder-url' ) || $form_edit_link.attr( 'href' ) || '';

	if ( ! base_url ) {
		return;
	}

	var separator = ( -1 === base_url.indexOf( '?' ) ) ? '?' : '&';
	$form_edit_link.attr( 'href', base_url + separator + 'form_name=' + encodeURIComponent( form_name ) );
}

/**
 * Init modal footer controls.
 */
function wpbc_boo_listing__init_add_booking_modal_controls(){

	jQuery( document ).off( 'change.wpbc_add_booking_modal', '#wpbc_modal__add_booking__resource_id, #wpbc_modal__add_booking__booking_form, #wpbc_modal__add_booking__allow_past' ).on(
		'change.wpbc_add_booking_modal',
		'#wpbc_modal__add_booking__resource_id, #wpbc_modal__add_booking__booking_form, #wpbc_modal__add_booking__allow_past',
		function(){
			var $modal = jQuery( '#wpbc_modal__add_booking__section' );
			var mode   = $modal.attr( 'data-wpbc-add-booking-mode' ) || 'add';

			wpbc_boo_listing__click__add_booking_modal( {
				mode         : mode,
				booking_id   : $modal.attr( 'data-wpbc-add-booking-id' ) || '',
				resource_id  : $modal.find( '#wpbc_modal__add_booking__resource_id' ).val() || '',
				booking_hash : $modal.attr( 'data-wpbc-add-booking-hash' ) || '',
				booking_form : $modal.find( '#wpbc_modal__add_booking__booking_form' ).val() || '',
				allow_past   : $modal.find( '[data-wpbc-add-booking-allow-past]' ).first().is( ':checked' ) ? 1 : 0,
				selected_date : $modal.attr( 'data-wpbc-add-booking-selected-date' ) || '',
				selected_time : $modal.attr( 'data-wpbc-add-booking-selected-time' ) || '',
				time_override_enabled : $modal.find( '[data-wpbc-add-booking-time-override-enabled]' ).first().length
					? ( $modal.find( '[data-wpbc-add-booking-time-override-enabled]' ).first().is( ':checked' ) ? 1 : 0 )
					: ( $modal.attr( 'data-wpbc-add-booking-time-override-enabled' ) || 0 ),
				time_override_source : $modal.attr( 'data-wpbc-add-booking-time-override-source' ) || '',
				time_override_start : $modal.attr( 'data-wpbc-add-booking-time-override-start' ) || '',
				time_override_end : $modal.attr( 'data-wpbc-add-booking-time-override-end' ) || ''
			} );
		}
	);

	jQuery( document ).off( 'change.wpbc_add_booking_modal_time_override', '[data-wpbc-add-booking-time-override-enabled]' ).on(
		'change.wpbc_add_booking_modal_time_override',
		'[data-wpbc-add-booking-time-override-enabled]',
		function(){
			var $modal = jQuery( '#wpbc_modal__add_booking__section' );
			var resource_id = parseInt( $modal.attr( 'data-wpbc-add-booking-resource-id' ) || 0, 10 );
			var $form = jQuery( '#booking_form' + resource_id );

			if ( resource_id && $form.length ) {
				wpbc_boo_listing__apply_add_booking_modal_time_override_state( $form, resource_id );
				$modal.attr( 'data-wpbc-add-booking-time-override-enabled', jQuery( this ).is( ':checked' ) ? '1' : '0' );
			}
		}
	);
}
jQuery( document ).ready( function(){
	wpbc_boo_listing__init_add_booking_modal_controls();
} );

/**
 * Prepare selected timeline interval before Add Booking modal submit.
 *
 * @param {number} resource_id Booking resource ID.
 * @returns {boolean}
 */
function wpbc_boo_listing__prepare_add_booking_modal_time_override( resource_id ){

	var $modal = jQuery( '#wpbc_modal__add_booking__section' );
	var $form = jQuery( '#booking_form' + resource_id );
	var $wrap = $modal.find( '[data-wpbc-add-booking-time-override-panel]' ).first();
	var $enabled = $wrap.find( '[data-wpbc-add-booking-time-override-enabled]' ).first();
	var $start;
	var $end;

	if ( ! $modal.is( ':visible' ) || ! $wrap.length || ! $enabled.is( ':checked' ) ) {
		return true;
	}

	wpbc_boo_listing__apply_add_booking_modal_time_override_state( $form, resource_id );

	$start = $wrap.find( '[data-wpbc-add-booking-time-override-field="start"]' ).first();
	$end = $wrap.find( '[data-wpbc-add-booking-time-override-field="end"]' ).first();

	if ( ! $start.val() || ! $end.val() ) {
		if ( 'function' === typeof wpbc_front_end__show_message__warning ) {
			wpbc_front_end__show_message__warning( $wrap.get( 0 ), 'Selected timeline interval is not complete.' );
		}
		return false;
	}

	$modal
		.attr( 'data-wpbc-add-booking-time-override-enabled', '1' )
		.attr( 'data-wpbc-add-booking-time-override-start', $start.val() )
		.attr( 'data-wpbc-add-booking-time-override-end', $end.val() );

	return true;
}

/**
 * Open Add/Edit Booking modal.
 *
 * @param {Object} args Modal context.
 * @returns {boolean|undefined}
 */
function wpbc_boo_listing__click__add_booking_modal( args ){

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__add_booking__section' ) ) {
		return false;
	}

	args = args || {};

	var $modal = jQuery( '#wpbc_modal__add_booking__section' );
	var $body = jQuery( '#wpbc_modal__add_booking__body' );
	var nonce = $modal.attr( 'data-wpbc-add-booking-nonce' );
	var mode = args.mode || ( args.booking_hash ? 'edit' : 'add' );
	var title = ( 'edit' === mode ) ? 'Edit booking' : 'Add booking';
	var allow_past = args.allow_past ? 1 : 0;

	if ( ! allow_past && $modal.find( '[data-wpbc-add-booking-allow-past]' ).first().is( ':checked' ) ) {
		allow_past = 1;
	}

	if ( 'edit' === mode ) {
		allow_past = 1;
	}

	$modal.attr( 'data-wpbc-add-booking-resource-id', '' );
	$modal.attr( 'data-wpbc-add-booking-hash', args.booking_hash || '' );
	$modal.attr( 'data-wpbc-add-booking-id', args.booking_id || '' );
	$modal.attr( 'data-wpbc-add-booking-mode', mode );
	$modal.attr( 'data-wpbc-add-booking-allow-past', allow_past ? '1' : '0' );
	$modal.attr( 'data-wpbc-add-booking-selected-date', args.selected_date || '' );
	$modal.attr( 'data-wpbc-add-booking-selected-time', args.selected_time || '' );
	$modal.attr( 'data-wpbc-add-booking-time-override-enabled', args.time_override_enabled ? '1' : '0' );
	$modal.attr( 'data-wpbc-add-booking-time-override-source', args.time_override_source || '' );
	$modal.attr( 'data-wpbc-add-booking-time-override-start', args.time_override_start || '' );
	$modal.attr( 'data-wpbc-add-booking-time-override-end', args.time_override_end || '' );
	if ( ! args.time_override_enabled ) {
		$modal.find( '[data-wpbc-add-booking-time-override-panel]' ).remove();
	}
	args.allow_past = allow_past;
	wpbc_boo_listing__sync_add_booking_modal_controls( $modal, args, mode );
	$modal.find( '.wpbc_modal__add_booking__title' ).text( title );
	$modal.find( '.wpbc_modal__add_booking__booking_id' ).html( args.booking_id ? ( 'ID: ' + args.booking_id ) : '' );
	$modal.find( '#wpbc_modal__add_booking__button_send' ).text( ( 'edit' === mode ) ? 'Save booking' : 'Add booking' );
	$body.html( wpbc_boo_listing__get_add_booking_modal_loading_html() );

	$modal.wpbc_my_modal( 'show' );

	jQuery.post(
		wpbc_url_ajax,
		{
			action       : 'WPBC_AJX_ADD_BOOKING_MODAL',
			nonce        : nonce,
			mode         : mode,
			booking_id   : args.booking_id || '',
			resource_id  : args.resource_id || '',
			booking_hash : args.booking_hash || '',
			booking_form : args.booking_form || '',
			allow_past   : allow_past,
			selected_dates_without_calendar : args.selected_dates_without_calendar || '',
			selected_date : args.selected_date || '',
			selected_time : args.selected_time || '',
			time_override_enabled : args.time_override_enabled ? 1 : 0,
			time_override_source : args.time_override_source || '',
			time_override_start : args.time_override_start || '',
			time_override_end : args.time_override_end || ''
		},
		function( response ){

			if ( ! response || ! response.success ) {
				var message = ( response && response.data && response.data.message ) ? response.data.message : 'Unable to load booking form.';
				$body.html( '<div class="wpbc-settings-notice notice-warning" style="text-align:left">' + message + '</div>' );
				return;
			}

			$modal.attr( 'data-wpbc-add-booking-resource-id', response.data.resource_id || '' );
			$modal.attr( 'data-wpbc-add-booking-hash', response.data.booking_hash || '' );
			$modal.attr( 'data-wpbc-add-booking-id', response.data.booking_id || '' );
			$modal.attr( 'data-wpbc-add-booking-mode', response.data.mode || mode );
			$modal.attr( 'data-wpbc-add-booking-allow-past', response.data.allow_past ? '1' : '0' );
			$modal.attr( 'data-wpbc-add-booking-selected-date', response.data.selected_date || '' );
			$modal.attr( 'data-wpbc-add-booking-selected-time', response.data.selected_time || '' );
			$modal.attr( 'data-wpbc-add-booking-time-override-enabled', response.data.time_override_enabled ? '1' : '0' );
			$modal.attr( 'data-wpbc-add-booking-time-override-source', response.data.time_override_source || '' );
			$modal.attr( 'data-wpbc-add-booking-time-override-start', response.data.time_override_start || '' );
			$modal.attr( 'data-wpbc-add-booking-time-override-end', response.data.time_override_end || '' );
			wpbc_boo_listing__sync_add_booking_modal_controls( $modal, response.data, response.data.mode || mode );
			$modal.find( '.wpbc_modal__add_booking__title' ).text( response.data.title || title );
			$modal.find( '.wpbc_modal__add_booking__booking_id' ).html( response.data.booking_id ? ( 'ID: ' + response.data.booking_id ) : '' );
			$modal.find( '#wpbc_modal__add_booking__button_send' ).text( response.data.button_title || ( ( 'edit' === mode ) ? 'Save booking' : 'Add booking' ) );
			wpbc_boo_listing__set_add_booking_modal_body_html( $body, response.data.html || '' );

			if ( 'function' === typeof wpbc_hook__init_booking_form_wizard_buttons ) {
				wpbc_hook__init_booking_form_wizard_buttons();
			}

			if ( 'undefined' !== typeof _wpbc ) {
				_wpbc.set_other_param( 'this_page_booking_hash', response.data.booking_hash || '' );
				_wpbc.set_other_param( 'this_page_allow_past', response.data.allow_past ? 1 : 0 );
			}

			if ( 'function' === typeof wpbc_bs_javascript_tooltips ) {
				wpbc_bs_javascript_tooltips();
			}
			if ( 'function' === typeof wpbc_bs_javascript_popover ) {
				wpbc_bs_javascript_popover();
			}

			wpbc_boo_listing__preload_add_booking_modal_selection( response.data );
		}
	).fail( function(){
		$body.html( '<div class="wpbc-settings-notice notice-warning" style="text-align:left">Unable to load booking form.</div>' );
	} );
}

/**
 * Reload Booking Listing after Add/Edit Booking modal saved successfully.
 */
function wpbc_boo_listing__reload_after_add_booking_modal_submit(){

	var $modal = jQuery( '#wpbc_modal__add_booking__section' );

	if ( $modal.length && ( 'function' === typeof $modal.wpbc_my_modal ) ) {
		$modal.wpbc_my_modal( 'hide' );
	}

	if (
		   ( 'function' === typeof window.wpbc_ajx_booking_send_search_request_with_params )
		&& ( 'undefined' !== typeof window.wpbc_ajx_booking_listing )
	) {
		window.wpbc_ajx_booking_send_search_request_with_params( {} );
		return;
	}

	if ( 'function' === typeof window.wpbc_ajx_booking__actual_listing__show ) {
		window.wpbc_ajx_booking__actual_listing__show();
	}
}

/**
 * Submit Add/Edit Booking modal form.
 *
 * @returns {boolean|undefined}
 */
function wpbc_boo_listing__submit__add_booking_modal(){

	var $modal = jQuery( '#wpbc_modal__add_booking__section' );
	var $form = $modal.find( 'form.booking_form' ).first();
	var resource_id = 0;

	if ( $form.length ) {
		resource_id = parseInt( ( $form.attr( 'id' ) || '' ).replace( 'booking_form', '' ), 10 );
	}

	if ( ! resource_id ) {
		resource_id = parseInt( $modal.attr( 'data-wpbc-add-booking-resource-id' ), 10 );
	}

	if ( ! resource_id ) {
		return false;
	}

	var submit_form = $form.length ? $form.get( 0 ) : document.getElementById( 'booking_form' + resource_id );
	var locale = ( 'undefined' !== typeof _wpbc ) ? _wpbc.get_other_param( 'locale_active' ) : '';
	var submit_result;

	if ( ! wpbc_boo_listing__prepare_add_booking_modal_time_override( resource_id ) ) {
		return false;
	}

	jQuery( 'body' ).off( 'wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload' )
		.on( 'wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload', function( event, submitted_resource_id ){

			if ( parseInt( submitted_resource_id, 10 ) !== resource_id ) {
				return;
			}

			jQuery( 'body' ).off( 'wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload' );

			if ( ! jQuery( '#wpbc_modal__add_booking__section' ).is( ':visible' ) ) {
				return;
			}

			wpbc_boo_listing__reload_after_add_booking_modal_submit();
		} );

	submit_result = wpbc_booking_form_submit( submit_form, resource_id, locale );

	if ( false === submit_result ) {
		jQuery( 'body' ).off( 'wpbc_booking_form_submit_success.wpbc_add_booking_modal_reload' );
	}

	return submit_result;
}

/**
 * Change payment Cost.
 *
 * @param booking_id			- ID of booking.
 * @param cost	                - payment cost.
 */
function wpbc_boo_listing__click__set_booking_cost( booking_id, cost ) {

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__booking_cost_edit__section' ) ) {
		return false;
	}

	// Set booking cost.
	jQuery( '#wpbc_modal__booking_cost_edit__value' ).val( cost );

	// Set booking ID.
	jQuery( '#wpbc_modal__booking_cost_edit__booking_id' ).val( booking_id );

	// ID title.
	jQuery( '.wpbc_modal__booking_cost_edit__booking_id' ).html( 'ID: ' + booking_id );

	// Show Modal.
	jQuery( '#wpbc_modal__booking_cost_edit__section' ).wpbc_my_modal( 'show' );

	// Set focus to input.
	jQuery( '#wpbc_modal__booking_cost_edit__value' ).trigger( 'focus' );
}

/**
 * Change payment Status.
 *
 * @param booking_id			- ID of booking.
 * @param selected_pay_status	- payment status.
 */
function wpbc_boo_listing__click__set_payment_status( booking_id, selected_pay_status ) {

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__payment_status_edit__section' ) ) {
		return false;
	}

	var jSelect = jQuery( '#wpbc_modal__payment_status_edit__value' );

	// Select Status.
	if ( ( ! isNaN( parseFloat( selected_pay_status ) )) || ('' === selected_pay_status) ) {		// Is it float - then  it's unknown.
		jSelect.find( 'option[value="1"]' ).prop( 'selected', true );								// Unknown  value is '1' in select box.
	} else {
		jSelect.find( 'option[value="' + selected_pay_status + '"]' ).prop( 'selected', true );		// Otherwise known payment status.
	}
	// Set booking ID.
	jQuery( '#wpbc_modal__payment_status_edit__booking_id' ).val( booking_id );

	// ID title.
	jQuery( '.wpbc_modal__payment_status_edit__booking_id' ).html( 'ID: ' + booking_id );

	// Show Modal.
	jQuery( '#wpbc_modal__payment_status_edit__section' ).wpbc_my_modal( 'show' );

	// Set focus to input.
	jQuery( '#wpbc_modal__payment_status_edit__value' ).trigger( 'focus' );
}

/**
 * Send payment request
 *
 * @param booking_id
 * @param visitorbookingpayurl
 * @param cost
 * @returns {boolean}
 */
function wpbc_boo_listing__click__send_payment_request( booking_id, visitorbookingpayurl, cost ){

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__send_payment_request__section' ) ) {
		return false;
	}

	// Set booking cost.
	jQuery( '#wpbc_modal__send_payment_request__url' ).val( visitorbookingpayurl );

	// Set booking ID.
	jQuery( '#wpbc_modal__send_payment_request__booking_id' ).val( booking_id );

	// ID title.
	jQuery( '.wpbc_modal__send_payment_request__booking_id' ).html( 'ID: ' + booking_id );

	// Cost.
	jQuery( '.wpbc_modal__send_payment_request__cost' ).html( cost );

	// Show Modal.
	jQuery( '#wpbc_modal__send_payment_request__section' ).wpbc_my_modal( 'show' );

	// Set focus to input.
	jQuery( '#wpbc_modal__send_payment_request__value' ).trigger( 'focus' );

}

/**
 * Save Notes
 *
 * @param booking_id
 * @param note_text
 * @returns {boolean}
 */
function wpbc_boo_listing__click__set_booking_note( booking_id, note_text ){

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__set_booking_note__section' ) ) {
		return false;
	}

	// Set Note.
	jQuery( '#wpbc_modal__set_booking_note__value' ).val( note_text );

	// Set booking ID.
	jQuery( '#wpbc_modal__set_booking_note__booking_id' ).val( booking_id );

	// ID title.
	jQuery( '.wpbc_modal__set_booking_note__booking_id' ).html( 'ID: ' + booking_id );

	// Show Modal.
	jQuery( '#wpbc_modal__set_booking_note__section' ).wpbc_my_modal( 'show' );

	// Set focus to input. // jQuery( '#wpbc_modal__set_booking_note__value' ).trigger( 'focus' ); .
	jQuery( '#wpbc_modal__set_booking_note__value' ).scrollTop( 0 );

}

/**
 * Change Resource for Booking
 *
 * @param booking_id			- ID of booking.
 * @param resource_id           - ID of booking resource.
 */
function wpbc_boo_listing__click__change_booking_resource( booking_id, resource_id ){

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__change_booking_resource__section' ) ) {
		return false;
	}

	// Select booking resource  that belong to  booking.
	jQuery( '#wpbc_modal__change_booking_resource__resource_id' ).val( resource_id ).trigger( 'change' );

	// Set booking ID.
	jQuery( '#wpbc_modal__change_booking_resource__booking_id' ).val( booking_id );
	// ID title.
	jQuery( '.wpbc_modal__change_booking_resource__booking_id' ).html( 'ID: ' + booking_id );

	// Show Modal.
	jQuery( '#wpbc_modal__change_booking_resource__section' ).wpbc_my_modal( 'show' );

	// Set focus to input.
	jQuery( '#wpbc_modal__change_booking_resource__resource_id' ).focus();
}

/**
 * Set unavailable times for booking resource and dates.
 *
 * @param booking_id    ID of booking.
 * @param resource_id   ID of booking resource.
 * @param date_start    Booking start date.
 * @param date_end      Booking end date.
 */
function wpbc_boo_listing__click__set_unavailable_times( booking_id, resource_id, date_start, date_end ){

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__set_unavailable_times__section' ) ) {
		return false;
	}

	var $modal = jQuery( '#wpbc_modal__set_unavailable_times__section' );
	var $page = $modal.find( '.wpbc_ts_page' ).first();

	if ( booking_id ) {
		jQuery( '.wpbc_modal__set_unavailable_times__booking_id' ).html( 'ID: ' + booking_id );
	} else {
		jQuery( '.wpbc_modal__set_unavailable_times__booking_id' ).html( '' );
	}

	$modal.wpbc_my_modal( 'show' );

	if ( 'function' === typeof window.wpbc_availability_timeslots_init ) {
		window.wpbc_availability_timeslots_init( $page );
	}

	if ( 'function' === typeof window.wpbc_availability_timeslots_set_context ) {
		window.wpbc_availability_timeslots_set_context(
			$page,
			{
				resource_id: resource_id,
				date_start: date_start,
				date_end: date_end
			}
		);
	}
}

/**
 * Duplicate Booking into another resource.
 *
 * @param booking_id			- ID of booking.
 * @param resource_id           - ID of booking resource.
 */
function wpbc_boo_listing__click__duplicate_booking_to_other_resource( booking_id, resource_id ){

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__duplicate_booking_to_other_resource__section' ) ) {
		return false;
	}

	// Select booking resource  that belong to  booking.
	jQuery( '#wpbc_modal__duplicate_booking_to_other_resource__resource_id' ).val( resource_id ).trigger( 'change' );

	// Set booking ID.
	jQuery( '#wpbc_modal__duplicate_booking_to_other_resource__booking_id' ).val( booking_id );
	// ID title.
	jQuery( '.wpbc_modal__duplicate_booking_to_other_resource__booking_id' ).html( 'ID: ' + booking_id );

	// Show Modal.
	jQuery( '#wpbc_modal__duplicate_booking_to_other_resource__section' ).wpbc_my_modal( 'show' );

	// Set focus to input.
	jQuery( '#wpbc_modal__duplicate_booking_to_other_resource__resource_id' ).focus();
}

/**
 * Change Locale of Booking.
 *
 * @param booking_id			- ID of booking.
 * @param resource_id           - ID of booking resource.
 */
function wpbc_boo_listing__click__set_booking_locale( booking_id, selected_locale_value ){

	if ( ! wpbc_is_modal_accessible( '#wpbc_modal__set_booking_locale__section' ) ) {
		return false;
	}

	// Select booking Locale  that belong to  booking.
	jQuery( '#wpbc_modal__set_booking_locale' ).val( selected_locale_value ).trigger( 'change' );

	// var jSelect = jQuery( '#set_booking_locale__resource_select' );
	// jSelect.find( 'option[value="' + resource_id + '"]' ).prop( 'selected', true );		// Otherwise known payment status.

	// Set booking ID.
	jQuery( '#wpbc_modal__set_booking_locale__booking_id' ).val( booking_id );
	// ID title.
	jQuery( '.wpbc_modal__set_booking_locale__booking_id' ).html( 'ID: ' + booking_id );

	// Show Modal.
	jQuery( '#wpbc_modal__set_booking_locale__section' ).wpbc_my_modal( 'show' );

	// Set focus to input.
	jQuery( '#wpbc_modal__set_booking_locale' ).focus();
}


// ---------------------------------------------------------------------------------------------------------------------
// == Filter Toolbar ==
// ---------------------------------------------------------------------------------------------------------------------
/**
 * == "Sort By" Button ==
 * This function update Title in Dropdown menu.
 * It executed, after receving Ajax response.
 * And based on parameters of this response, we get option title from dropdown list options and show it in toggle title.
 */
function wpbc_boo_listing__init_hook__sort_by() {

	var el_id = 'wh_sort';

	var parameter_value = wpbc_ajx_booking_listing.search_get_param( el_id );

	var j_option_link = jQuery( '.ul_dropdown_menu_li__' + el_id + '__' + parameter_value );
	if ( j_option_link.length ) {
		jQuery( '.ul_dropdown_menu__' + el_id + ' .ul_dropdown_menu_toggle .selected_value' ).html( j_option_link.html() );
	} else {
		jQuery( '.ul_dropdown_menu__' + el_id + ' .ul_dropdown_menu_toggle .selected_value' ).html( '---' );
	}
}

// ---------------------------------------------------------------------------------------------------------------------
// == Listing Header Table ==
// ---------------------------------------------------------------------------------------------------------------------
/**
 * == "Expand All Rows" Button ==
 */
function wpbc_boo_listing__click__expand_all_rows() {
	jQuery( '.wpbc_row_wrap' ).removeClass( 'max_height_a' );
	jQuery( '.wpbc_row_wrap .wpbc_icn_expand_less' ).show();
	jQuery( '.wpbc_row_wrap .wpbc_icn_expand_more' ).hide();
	jQuery( '.wpbc_btn_expand_colapse_all' ).toggle();
}


/**
 * == "Colpase All Rows" Button ==
 */
function wpbc_boo_listing__click__colapse_all_rows() {
	jQuery( '.wpbc_row_wrap' ).addClass( 'max_height_a' );
	jQuery( '.wpbc_row_wrap .wpbc_icn_expand_less' ).hide();
	jQuery( '.wpbc_row_wrap .wpbc_icn_expand_more' ).show();
	jQuery( '.wpbc_btn_expand_colapse_all' ).toggle();
}
