// FixIn: 8.7.11.10.
(function ( $ ){

	/**
	 * Normalize native time options for the visual time-picker presentation.
	 *
	 * Empty values are select-box placeholders rather than bookable choices, so
	 * they must not become visual picker cards. If the native select currently
	 * points to a placeholder or a disabled option, select the first enabled real
	 * time to match the browser behavior of a picker-mode form exported without a
	 * placeholder.
	 *
	 * @param {Array<Object>} option_records Native option records.
	 * @return {Array<Object>} Normalized non-placeholder option records with at
	 *                         most one enabled selection.
	 */
	function wpbc_timeselector_normalize_options( option_records ) {

		var normalized_options = [];
		var selected_option_index = -1;

		$.each( Array.isArray( option_records ) ? option_records : [], function ( index, option_record ) {
			var option_value = ( 'undefined' === typeof option_record.value || null === option_record.value ) ? '' : option_record.value;

			if ( '' === String( option_value ).trim() ) {
				return;
			}

			normalized_options.push( {
				title   : ( 'undefined' === typeof option_record.title || null === option_record.title ) ? '' : option_record.title,
				value   : option_value,
				disabled: !! option_record.disabled,
				selected: !! option_record.selected
			} );

			if (
				-1 === selected_option_index
				&& ! option_record.disabled
				&& option_record.selected
			) {
				selected_option_index = normalized_options.length - 1;
			}
		} );

		if ( -1 === selected_option_index ) {
			$.each( normalized_options, function ( index, option_record ) {
				if ( ! option_record.disabled ) {
					selected_option_index = index;
					return false;
				}
			} );
		}

		$.each( normalized_options, function ( index, option_record ) {
			option_record.selected = index === selected_option_index;
		} );

		return normalized_options;
	}

	$.fn.extend( {

		wpbc_timeselector: function (){

			var times_options = [];

			this.each( function (){

				var el = $( this );
				var native_selected_option = el.find( 'option:selected' ).first();
				var native_selected_value = native_selected_option.length ? String( native_selected_option.val() ) : '';
				var automatic_selection_value = el.attr( 'data-wpbc-time-picker-auto-value' );
				var has_explicit_native_selection = (
					native_selected_option.length
					&& ! native_selected_option.is( ':disabled' )
					&& '' !== native_selected_value.trim()
					&& automatic_selection_value !== native_selected_value
				);

				// On new days click we are searching for old time items,  and remove them from this booking form
				if ( el.parent().find( '.wpbc_times_selector' ).length ) {
					el.parent().find( '.wpbc_times_selector' ).remove();
				}

				el.find( 'option' ).each( function ( ind ){

					times_options.push( {
										  title   : jQuery( this ).text()
										, value   : jQuery( this ).val()
										, disabled: jQuery( this ).is( ':disabled' )
										, selected: jQuery( this ).is( ':selected' )
										} );

				} );

				times_options = wpbc_timeselector_normalize_options( times_options );

				$.each( times_options, function ( index, option_record ) {
					if ( option_record.selected ) {
						var selected_time_value = String( option_record.value );

						el.val( selected_time_value );
						if ( has_explicit_native_selection ) {
							el.removeAttr( 'data-wpbc-time-picker-auto-value' );
						} else {
							el.attr( 'data-wpbc-time-picker-auto-value', selected_time_value );
						}
						return false;
					}
				} );

				var times_options_element = $.fn.wpbc_timeselector.format( times_options );

				el.after( times_options_element );

				el.next('.wpbc_times_selector').find('div').not('.wpbc_time_picker_disabled').on( "click", function() {

					// Get data value of clicked DIV time-slot
					var selected_value = jQuery( this ).attr( 'data-value' );

					// Remove previos selected class
					jQuery( this ).parent( '.wpbc_times_selector' ).find( '.wpbc_time_selected' ).removeClass( 'wpbc_time_selected' );
					// Set  time item with  selected Class
					jQuery( this ).addClass('wpbc_time_selected');

					el.find( 'option' ).prop( 'selected', false );
					// Match the literal value without interpreting it as selector syntax.
					el.find( 'option' ).filter( function (){
						return selected_value === jQuery( this ).val();
					} ).prop( 'selected', true );
					el.removeAttr( 'data-wpbc-time-picker-auto-value' );

					el.trigger( 'change' );
				});

				// Execute a function when the user presses a key (13 - Enter) on the keyboard. (FixIn: EAA)
				el.next( '.wpbc_times_selector' ).find( 'div' ).not( '.wpbc_time_picker_disabled' ).on( "keypress", function (event) {
					if ( 13 === event.which ) {
						event.preventDefault();
						console.log( jQuery( this ) );
						jQuery( this ).trigger( 'click' );
					}
				} );

				el.hide();

				times_options = [];
			} );

			return this;				// Chain
		}
	} );

	/**
	 * Build the visual time-slot selector from native option data.
	 *
	 * Values and labels can originate in saved form configuration or modified
	 * DOM state. Creating elements and assigning text/attributes separately
	 * prevents either value from becoming executable markup.
	 *
	 * @param {Array<Object>} el_arr Time-slot option records.
	 * @return {jQuery} Detached, safely populated time-slot selector.
	 */
	$.fn.wpbc_timeselector.format = function ( el_arr ) {

		var times_selector = jQuery( document.createElement( 'div' ) ).addClass( 'wpbc_times_selector' );
		var has_available_times = false;
		var normalized_options = wpbc_timeselector_normalize_options( el_arr );

		$.each( normalized_options, function (index, el_item){

			if ( !el_item.disabled ){
				var time_option_value = ( 'undefined' === typeof el_item.value || null === el_item.value ) ? '' : el_item.value;
				var time_option_title = ( 'undefined' === typeof el_item.title || null === el_item.title ) ? '' : el_item.title;
				var time_option = jQuery( document.createElement( 'div' ) )
					.attr( 'data-value', String( time_option_value ) )
					.attr( 'tabindex', '0' )
					.text( String( time_option_title ) );

				if ( el_item.selected ){
					time_option.addClass( 'wpbc_time_selected' );
				}

				times_selector.append( time_option );
				has_available_times = true;
			} else {
				// Uncomment row bellow to Show booked time slots as unavailable RED slots		// FixIn: 9.9.0.2.
				// Add a disabled element through the same DOM construction path when this feature is enabled.
			}

		} );

		if ( ! has_available_times ){
			times_selector.append(
				jQuery( document.createElement( 'span' ) )
					.addClass( 'wpbc_no_time_pickers' )
					.text( 'No available times' )
			);
		}

		return times_selector;
	};


})( jQuery );


/**
 * Remove visual time pickers and restore native select-box placeholders.
 *
 * Only values automatically chosen by the visual picker are restored. An
 * explicit customer choice remains selected when a live settings preview is
 * switched back to Select box mode.
 *
 * @param {HTMLElement|Document|jQuery|null} context Optional preview boundary.
 * @return {void}
 */
function wpbc_hook__destroy_timeselector( context ){

	var selector = 'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]';
	var scope = context ? jQuery( context ) : jQuery( document );

	scope.find( '.wpbc_times_selector' ).remove();
	scope.find( selector ).each( function (){
		var select_element = jQuery( this );
		var current_value = select_element.val();
		var automatic_value = select_element.attr( 'data-wpbc-time-picker-auto-value' );

		current_value = ( 'undefined' === typeof current_value || null === current_value ) ? '' : String( current_value );
		if ( 'undefined' !== typeof automatic_value && automatic_value === current_value ) {
			var placeholder_option = select_element.find( 'option' ).filter( function (){
				var option_value = jQuery( this ).val();

				return 'undefined' === typeof option_value || null === option_value || '' === String( option_value ).trim();
			} ).first();

			if ( placeholder_option.length ) {
				select_element.val( placeholder_option.val() );
			}
		}

		select_element.removeAttr( 'data-wpbc-time-picker-auto-value' ).show();
	} );
}


/**
 * Initialize the visual time-slot selectors when the WPBC runtime is ready.
 *
 * The readiness check prevents a JavaScript error when a third-party optimizer
 * delays wpbc_all.js, which creates window._wpbc, beyond document ready.
 *
 * @return {boolean} True when initialization is complete or not required;
 *                   otherwise false when the WPBC runtime is not ready yet.
 */
function wpbc_hook__init_timeselector(){

	if (
		( 'object' !== typeof window._wpbc )
		|| ( 'function' !== typeof window._wpbc.get_other_param )
	) {
		return false;
	}

	if ( true !== window._wpbc.get_other_param( 'is_enabled_booking_timeslot_picker' ) ) {
		return true;
	}

	// Load after page loaded
	jQuery( 'select[name^="rangetime"]' ).wpbc_timeselector();
	jQuery( 'select[name^="starttime"]' ).wpbc_timeselector();
	jQuery( 'select[name^="endtime"]' ).wpbc_timeselector();
	jQuery( 'select[name^="durationtime"]' ).wpbc_timeselector();

	// This hook loading after each day selection																// FixIn: 8.7.11.9.
	jQuery( ".booking_form_div" ).on( 'wpbc_hook_timeslots_disabled', function ( event, bk_type, all_dates ){
		jQuery( '#booking_form_div' + bk_type + ' select[name^="rangetime"]' ).wpbc_timeselector();
		jQuery( '#booking_form_div' + bk_type + ' select[name^="starttime"]' ).wpbc_timeselector();
		jQuery( '#booking_form_div' + bk_type + ' select[name^="endtime"]' ).wpbc_timeselector();
		jQuery( '#booking_form_div' + bk_type + ' select[name^="durationtime"]' ).wpbc_timeselector();
	} );

	return true;
}


/**
 * Initialize the time selector now or after the WPBC core signals readiness.
 *
 * @return {void}
 */
function wpbc_init_timeselector_when_wpbc_ready(){

	if ( wpbc_hook__init_timeselector() ) {
		return;
	}

	var wpbc_timeselector_ready_handler = function (){
		if ( wpbc_hook__init_timeselector() ) {
			document.removeEventListener( 'wpbc-ready', wpbc_timeselector_ready_handler );
		}
	};

	document.addEventListener( 'wpbc-ready', wpbc_timeselector_ready_handler );
}


jQuery(document).ready(function(){
//	 setTimeout( function ( ) {					// Need to  have some delay  for loading of all  times in Garbage
	wpbc_init_timeselector_when_wpbc_ready();
//	}, 1000 );
});
