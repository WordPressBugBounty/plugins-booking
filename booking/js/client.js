// == Submit Booking Data ==============================================================================================

// Check fields at form and then send request
function mybooking_submit( submit_form , bk_type, wpdev_active_locale){

    var target_elm = jQuery( ".booking_form_div" ).trigger( "booking_form_submit_click", [bk_type, submit_form, wpdev_active_locale] );     // FixIn: 8.8.3.13.
    if  (
            ( jQuery( target_elm ).find( 'input[name="booking_form_show_summary"]' ).length > 0 )
         && ( 'pause_submit' === jQuery( target_elm ).find( 'input[name="booking_form_show_summary"]' ).val() )
        )
    {
        return false;
    }

    // FixIn: 8.4.0.2.
    var is_error = wpbc_check_errors_in_booking_form( bk_type );
    if ( is_error ) { return false; }

    // Show message if no selected days in Calendar(s)
    if (document.getElementById('date_booking' + bk_type).value == '')  {

        var arr_of_selected_additional_calendars = wpbc_get_arr_of_selected_additional_calendars( bk_type );            // FixIn: 8.5.2.26.

        if ( arr_of_selected_additional_calendars.length == 0 ) {
            wpbc_front_end__show_message__error_under_element( '#booking_form_div' + bk_type + ' .bk_calendar_frame', _wpbc.get_message( 'message_check_no_selected_dates' ), 3000 );
            return;
        }
    }

    var count = submit_form.elements.length;
    var formdata = '';
    var inp_value;
    var element;
    var el_type;


    // FixIn: 6.1.1.3.
    if( typeof( wpbc_is_this_time_selection_not_available ) == 'function' ) {

        if ( document.getElementById('date_booking' + bk_type).value == '' )  {         // Primary calendar not selected.

            if ( document.getElementById('additional_calendars' + bk_type ) != null ) { // Checking additional calendars.

                var id_additional_str = document.getElementById('additional_calendars' + bk_type).value; //Loop have to be here based on , sign
                var id_additional_arr = id_additional_str.split(',');
                var is_times_dates_ok = false;
                for ( var ia=0;ia<id_additional_arr.length;ia++ ) {
                    if (
                            ( document.getElementById('date_booking' + id_additional_arr[ia] ).value != '' )
                         && ( ! wpbc_is_this_time_selection_not_available( id_additional_arr[ia], submit_form.elements ) )
                       ){
                        is_times_dates_ok = true;
                    }
                }
                if ( ! is_times_dates_ok ) return;
            }
        } else {                                                                        //Primary calendar selected.
            if ( wpbc_is_this_time_selection_not_available( bk_type, submit_form.elements ) )
                return;
        }
    }



    // Serialize form here
    for ( var i = 0; i < count; i++ ){  // FixIn: 9.1.5.1.
        element = submit_form.elements[i];

        if ( jQuery( element ).closest( '.booking_form_garbage' ).length ) {
            continue;       // Skip elements from garbage                                           // FixIn: 7.1.2.14.
        }

        if (
               ( element.type !== 'button' )
            && ( element.type !== 'hidden' )
            && ( element.name !== ( 'date_booking' + bk_type ) )
            // && ( jQuery( element ).is( ':visible' ) )                                            //FixIn: 7.2.1.12.2 // Its prevent of saving hints,  and some other hidden element
        ) {           // Skip buttons and hidden element - type                                     // FixIn: 7.2.1.12.


            // Get Element Value
            if ( element.type == 'checkbox' ){

                if (element.value == '') {
                    inp_value = element.checked;
                } else {
                    if (element.checked) inp_value = element.value;
                    else inp_value = '';
                }

            } else if ( element.type == 'radio' ) {

                if (element.checked) {
                    inp_value = element.value;
                } else {
                        // Check  if this radio required,  and if it does not check,  then show warning, otherwise if it is not required or some other option checked skip this loop
                        // We need to  check  it here, because radio have the several  options with  same name and type, and otherwise we will save several options with  selected and empty values.
                    if (                                                        // FixIn: 7.0.1.62.
                           ( element.className.indexOf('wpdev-validates-as-required') !== -1 )
                        && ( jQuery( element ).is( ':visible' ) )                                            //FixIn: 7.2.1.12.2 // Its prevent of saving hints,  and some other hidden element
                        && ( ! jQuery(':radio[name="'+element.name+'"]', submit_form).is(":checked") ) ) {
                        wpbc_front_end__show_message__warning( element, _wpbc.get_message( 'message_check_required_for_radio_box' ) );   		// FixIn: 8.5.1.3.
                        return;
                    }
                    continue;
                }
            } else {
                inp_value = element.value;
            }

            var inp_title_value = '';

            var input_element_type = ('input' === jQuery( element )[0].tagName.toString().toLowerCase())
                                      ? jQuery( jQuery( element )[0] ).prop( "type" ).toLowerCase()
                                      : jQuery( element )[0].tagName.toLowerCase();

            switch ( input_element_type ) {
                case 'text':
                    inp_title_value = inp_value;
                    break;
                case 'email':
                    inp_title_value = inp_value;
                    break;
                case 'select':
                    inp_title_value = jQuery( element ).find( "option:selected" ).text();
                    break;
                case 'radio':
                    if ( jQuery( element ).is( ':checked' ) ) {
                        var label_element = jQuery( element ).parents( '.wpdev-list-item' ).find( '.wpdev-list-item-label' );
                        if ( label_element.length ) {
                            inp_title_value = label_element.html();
                        }
                    }
                    break;
                case 'checkbox':
                    if ( jQuery( element ).is( ':checked' ) ) {
                        var label_element = jQuery( element ).parents( '.wpdev-list-item' ).find( '.wpdev-list-item-label' );
                        if ( label_element.length ) {
                            inp_title_value = label_element.html();
                        }
                    }
                    break;
                default:
                    inp_title_value = inp_value;
            }


            // Get value in selectbox of multiple selection
            if ( (element.type == 'selectbox-multiple') || (element.type == 'select-multiple') ){
                inp_value = jQuery('[name="'+element.name+'"]').val() ;
                if (( inp_value == null ) || (inp_value.toString() == '' ))
                    inp_value='';
            }

            // Make validation  only  for visible elements
            if ( jQuery( element ).is( ':visible' ) ) {                                             //FixIn: 7.2.1.12.2


                // Recheck for max num. available visitors selection
                if ( typeof (wpbc__is_less_than_required__of_max_available_slots__bl) == 'function' ){
                    if ( wpbc__is_less_than_required__of_max_available_slots__bl( bk_type, element ) ){
                        return;
                    }
                }


                // Phone validation
                /*if ( element.name == ('phone'+bk_type) ) {
                    // we validate a phone number of 10 digits with no comma, no spaces, no punctuation and there will be no + sign in front the number - See more at: http://www.w3resource.com/javascript/form/phone-no-validation.php#sthash.U9FHwcdW.dpuf
                    var reg =  /^\d{10}$/;
                    var message_verif_phone = "Please enter correctly phone number";
                    if ( inp_value != '' )
                        if(reg.test(inp_value) == false) {wpbc_front_end__show_message__warning( element , message_verif_phone );return;}
                }*/

                // Validation Check --- Requred fields
                if ( element.className.indexOf('wpdev-validates-as-required') !== -1 ){
                    if  ((element.type =='checkbox') && ( element.checked === false)) {
                        if ( ! jQuery(':checkbox[name="'+element.name+'"]', submit_form).is(":checked") ) {
                            wpbc_front_end__show_message__warning( element , _wpbc.get_message( 'message_check_required_for_check_box' ) );   		// FixIn: 8.5.1.3.
                            return;
                        }
                    }
                    if  (element.type =='radio') {
                        if ( ! jQuery(':radio[name="'+element.name+'"]', submit_form).is(":checked") ) {
                            wpbc_front_end__show_message__warning( element , _wpbc.get_message( 'message_check_required_for_radio_box' ) );   		// FixIn: 8.5.1.3.
                            return;
                        }
                    }

                    if (  (element.type != 'checkbox') && (element.type != 'radio') && ( '' === wpbc_trim( inp_value ) )  ){       //FixIn: 8.8.1.3   //FixIn:7.0.1.39       // FixIn: 8.7.11.12.
                        wpbc_front_end__show_message__warning( element , _wpbc.get_message( 'message_check_required' ) );   		// FixIn: 8.5.1.3.
                        return;
                    }
                }

                // Validation Check --- Email correct filling field
                if ( element.className.indexOf('wpdev-validates-as-email') !== -1 ){
                    inp_value = inp_value.replace(/^\s+|\s+$/gm,'');                // Trim  white space //FixIn: 5.4.5
                    var reg = /^([A-Za-z0-9_\-\.\+])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,})$/;
                    if ( inp_value != '' )
                        if(reg.test(inp_value) == false) {
                            wpbc_front_end__show_message__warning( element , _wpbc.get_message( 'message_check_email' ) );   		// FixIn: 8.5.1.3.
                            return;
                        }
                }

                // Validation Check --- Same Email Field
                if ( ( element.className.indexOf('wpdev-validates-as-email') !== -1 ) && ( element.className.indexOf('same_as_') !== -1 ) ) {

                    // Get  the name of Primary Email field from the "same_as_NAME" class
                    var primary_email_name = element.className.match(/same_as_([^\s])+/gi);
                    if (primary_email_name != null) { // We found
                        primary_email_name = primary_email_name[0].substr(8);

                        // Recehck if such primary email field exist in the booking form
                        if (jQuery('[name="' + primary_email_name + bk_type + '"]').length > 0) {

                            // Recheck the values of the both emails, if they do  not equla show warning
                            if ( jQuery('[name="' + primary_email_name + bk_type + '"]').val() !== inp_value ) {
                                wpbc_front_end__show_message__warning( element , _wpbc.get_message( 'message_check_same_email' )  );   		// FixIn: 8.5.1.3.
                                return;
                            }
                        }
                    }
                    // Skip one loop for the email veryfication field
                    continue;                                                                                           // FixIn: 8.1.2.15.
                }

            }

            // Get Form Data
            if ( element.name !== ('captcha_input' + bk_type) ) {
                if (formdata !=='') formdata +=  '~';                                                // next field element

                el_type = element.type;
                if ( element.className.indexOf('wpdev-validates-as-email') !== -1 )  el_type='email';
                if ( element.className.indexOf('wpdev-validates-as-coupon') !== -1 ) el_type='coupon';

                inp_value = inp_value + '';
                inp_value = inp_value.replace(new RegExp("\\^",'g'), '&#94;'); // replace registered characters
                inp_value = inp_value.replace(new RegExp("~",'g'), '&#126;'); // replace registered characters

                inp_value = inp_value.replace(/"/g, '&#34;'); // replace double quot
                inp_value = inp_value.replace(/'/g, '&#39;'); // replace single quot

                if ( 'select-one' == el_type ){
                    el_type = 'selectbox-one';
                }
                if ( 'select-multiple' == el_type ){
                    el_type = 'selectbox-multiple';
                }

                formdata += el_type + '^' + element.name + '^' + inp_value ;  // element attr

                var clean_field_name = element.name;
                clean_field_name = clean_field_name.replaceAll( /\[\]/gi, '' );
                clean_field_name = clean_field_name.substr( 0, (clean_field_name.length - bk_type.toString().length) );
                formdata += '~' + el_type + '^' + clean_field_name + '_val' + bk_type + '^' + inp_title_value;
            }
        }

    }  // End Fields Loop


    // TODO: here was function  for 'Check if visitor finish  dates selection.


    // Cpatch  verify
    var captcha = document.getElementById('wpdev_captcha_challenge_' + bk_type);

    //Disable Submit button
    if (captcha != null)  form_submit_send( bk_type, formdata, captcha.value, document.getElementById('captcha_input' + bk_type).value ,wpdev_active_locale);
    else                  form_submit_send( bk_type, formdata, '',            '' ,                                                      wpdev_active_locale);
    return;
}


// Gathering params for sending Ajax request and then send it
function form_submit_send( bk_type, formdata, captcha_chalange, user_captcha ,wpdev_active_locale){

    var my_booking_form = '';
    if ( document.getElementById( 'booking_form_type' + bk_type ) != undefined ){
        my_booking_form = document.getElementById( 'booking_form_type' + bk_type ).value;
    }

    var my_booking_hash = '';
    if ( _wpbc.get_other_param( 'this_page_booking_hash' ) != '' ){
        my_booking_hash = _wpbc.get_other_param( 'this_page_booking_hash' );
    }

    var is_send_emeils = 1;
    if ( jQuery('#is_send_email_for_pending').length ) {
        is_send_emeils = jQuery( '#is_send_email_for_pending' ).is( ':checked' );       // FixIn: 8.7.9.5.
        if ( false === is_send_emeils ) { is_send_emeils = 0; }
        else                            { is_send_emeils = 1; }
    }

    if ( document.getElementById( 'date_booking' + bk_type ).value != '' ){        // FixIn: 6.1.1.3.
        send_ajax_submit( bk_type, formdata, captcha_chalange, user_captcha, is_send_emeils, my_booking_hash, my_booking_form, wpdev_active_locale ); // Ajax sending request
    } else {
        jQuery( '#booking_form_div' + bk_type ).hide();
        jQuery( '#submiting' + bk_type ).hide();
    }

    var formdata_additional_arr;
    var formdata_additional;
    var my_form_field;
    var id_additional;
    var id_additional_str;
    var id_additional_arr;
    if ( document.getElementById( 'additional_calendars' + bk_type ) != null ){

        id_additional_str = document.getElementById('additional_calendars' + bk_type).value;                            //Loop have to be here based on , sign
        id_additional_arr = id_additional_str.split(',');
        //FixIn: 10.9.4.1.
        for ( var ia = 0; ia < id_additional_arr.length; ia++ ) {
            id_additional_arr[ia] = parseInt( id_additional_arr[ia] );
        }
        if ( ! jQuery( '#booking_form_div' + bk_type ).is( ':visible' ) ) {
            wpbc_booking_form__spin_loader__show( bk_type );                                                            // Show Spinner
        }

        for ( var ia = 0; ia < id_additional_arr.length; ia++ ){
            //FixIn: 10.9.4.1.
            if ( id_additional_arr[ia] <=0 ) {
                continue;
            }


            formdata_additional_arr = formdata;
            formdata_additional = '';
            id_additional = id_additional_arr[ia];


            formdata_additional_arr = formdata_additional_arr.split('~');
            for (var j=0;j<formdata_additional_arr.length;j++) {
                my_form_field = formdata_additional_arr[j].split('^');
                if (formdata_additional !=='') formdata_additional +=  '~';

                if (my_form_field[1].substr( (my_form_field[1].length -2),2)=='[]')
                  my_form_field[1] = my_form_field[1].substr(0, (my_form_field[1].length - (''+bk_type).length ) - 2 ) + id_additional + '[]';
                else
                  my_form_field[1] = my_form_field[1].substr(0, (my_form_field[1].length - (''+bk_type).length ) ) + id_additional ;


                formdata_additional += my_form_field[0] + '^' + my_form_field[1] + '^' + my_form_field[2];
            }

            if ( jQuery('#gateway_payment_forms' + bk_type).length > 0 ) {         // If Payment form  for main  booking resources is showing then append payment form  for additional  calendars.
                jQuery('#gateway_payment_forms' + bk_type).after('<div id="gateway_payment_forms'+id_additional+'"></div>');
                jQuery('#gateway_payment_forms' + bk_type).after('<div id="ajax_respond_insert'+id_additional+'" style="display:none;"></div>');
            }
            // FixIn: 8.5.2.17.
            send_ajax_submit( id_additional ,formdata_additional,captcha_chalange,user_captcha,is_send_emeils,my_booking_hash,my_booking_form ,wpdev_active_locale  );  // Submit
        }
    }
}



function send_ajax_submit( resource_id, formdata, captcha_chalange, user_captcha, is_send_emeils, my_booking_hash, my_booking_form, wpdev_active_locale ){

    // Disable Submit | Show spin loader
    wpbc_booking_form__on_submit__ui_elements_disable( resource_id )

    var is_exit = wpbc_ajx_booking__create( {
                                'resource_id'              : resource_id,
                                'dates_ddmmyy_csv'         : document.getElementById( 'date_booking' + resource_id ).value,
                                'formdata'                 : formdata,
                                'booking_hash'             : my_booking_hash,
                                'custom_form'              : my_booking_form,
                                'aggregate_resource_id_arr': ( ( null !== _wpbc.booking__get_param_value( resource_id, 'aggregate_resource_id_arr' ))
                                                                        ? _wpbc.booking__get_param_value( resource_id, 'aggregate_resource_id_arr' ).join( ',' ) : ''),
                                'captcha_chalange'   : captcha_chalange,
                                'captcha_user_input' : user_captcha,

                                'is_emails_send'     : is_send_emeils,
                                'active_locale'      : wpdev_active_locale
                            } );
    if ( true === is_exit ){
        return;
    }
}



// Hint labels inside of input boxes.
jQuery( document ).ready(
	function () {

		jQuery( 'div.inside_hint' ).on(
			'click',
			function () {
				jQuery( this ).css( 'visibility', 'hidden' ).siblings( '.has-inside-hint' ).trigger( 'focus' );   // FixIn: 8.7.11.12.
			}
		);

		jQuery( 'input.has-inside-hint' ).on(
			'blur',
			function () {
				if ( '' === this.value ) {
					jQuery( this ).siblings( '.inside_hint' ).css( 'visibility', '' );  // FixIn: 8.7.11.12.
				}
			}
		).on(
			'focus',
			function () {
				jQuery( this ).siblings( '.inside_hint' ).css( 'visibility', 'hidden' );  // FixIn: 8.7.11.12.
			}
		);

		jQuery( '.booking_form_div input[type=button]' ).prop( "disabled", false );
	}
);


// FixIn: 8.4.0.2.
/**
 * Check errors in booking form  fields, and show warnings if some errors exist.
 * Check  errors,  like not selected dates or not filled requred form  fields, or not correct entering email or phone fields,  etc...
 *
 * @param bk_type  int (ID of booking resource)
 */
function wpbc_check_errors_in_booking_form( bk_type ) {

	var is_error_in_field = false;  // By default, all  is good - no error.

	var my_form = jQuery( '#booking_form' + bk_type );

    if ( my_form.length ) {

        var fields_with_errors_arr = [];

        // Pseudo-selector that get form elements <input , <textarea , <select, <button...
        my_form.find( ':input' ).each( function( index, el ) {

            // Skip some elements
            var skip_elements = [ 'hidden', 'button' ];

            if (  -1 == skip_elements.indexOf( jQuery( el ).attr( 'type' ) )  ){

				// Check Calendar Dates Selection
                if ( ( 'date_booking' + bk_type ) == jQuery( el ).attr( 'name' ) ) {

                    // Show Warning only  if the calendar visible ( we are at step with  calendar)
                    if (
                            (  ( jQuery( '#calendar_booking' + bk_type ).is( ':visible' )  ) && ( '' == jQuery( el ).val() )  )
                         && ( wpbc_get_arr_of_selected_additional_calendars( bk_type ).length == 0 )                    // FixIn: 8.5.2.26.
                    ){            // FixIn: 8.4.4.5.

                        var notice_message_id = wpbc_front_end__show_message__error_under_element( '#booking_form_div' + bk_type + ' .bk_calendar_frame', _wpbc.get_message( 'message_check_no_selected_dates' ) , 3000 );

						//wpbc_do_scroll('#calendar_booking' + bk_type);            // Scroll to the calendar    		// FixIn: 8.5.1.3.
						is_error_in_field = true;    // Error
                    }
                }

                // Check only visible elements at this step
                if ( jQuery( el ).is( ':visible' )  ){
// console.log( '|id, type, val, visible|::', jQuery( el ).attr( 'name' ), '|' + jQuery( el ).attr( 'type' ) + '|', jQuery( el ).val(), jQuery( el ).is( ':visible' ) );

					// Is Required
					if ( jQuery( el ).hasClass( 'wpdev-validates-as-required' ) ){

						// Checkboxes
						if ( 'checkbox' == jQuery( el ).attr( 'type' ) ){

                            if (
                                    ( ! jQuery( el ).is( ':checked' ))
                                 && ( ! jQuery( ':checkbox[name="' + el.name + '"]', my_form ).is( ":checked" ) )       // FixIn: 8.5.2.12.
                            ){
                                var checkbox_parent_element;

                                if ( jQuery( el ).parents( '.wpdev-form-control-wrap' ).length > 0 ){

                                    checkbox_parent_element = jQuery( el ).parents( '.wpdev-form-control-wrap' );

                                } else if ( jQuery( el ).parents( '.controls' ).length > 0 ){

                                    checkbox_parent_element = jQuery( el ).parents( '.controls' );

                                } else {

                                    checkbox_parent_element = jQuery( el );
                                }
                                var notice_message_id = wpbc_front_end__show_message__warning( checkbox_parent_element, _wpbc.get_message( 'message_check_required_for_check_box' ) );

                                fields_with_errors_arr.push( el );
								is_error_in_field = true;    // Error
							}

							// Radio boxes
						} else if ( 'radio' == jQuery( el ).attr( 'type' ) ){

							if ( !jQuery( ':radio[name="' + jQuery( el ).attr( 'name' ) + '"]', my_form ).is( ':checked' ) ){
                                var notice_message_id = wpbc_front_end__show_message__warning( jQuery( el ).parents('.wpdev-form-control-wrap'), _wpbc.get_message( 'message_check_required_for_radio_box' ) );
                                fields_with_errors_arr.push( el );
								is_error_in_field = true;    // Error
							}

							// Other elements
						} else {

							var inp_value = jQuery( el ).val();

                            if ( '' === wpbc_trim( inp_value ) ){                                                       //FixIn: 8.8.1.3        // FixIn: 8.7.11.12.

                                var notice_message_id = wpbc_front_end__show_message__warning( el, _wpbc.get_message( 'message_check_required' ) );

                                fields_with_errors_arr.push( el );
								is_error_in_field = true;    // Error
							}
						}
					}

					// Validate Email
					if ( jQuery( el ).hasClass( 'wpdev-validates-as-email' ) ){
						var inp_value = jQuery( el ).val();
						inp_value = inp_value.replace( /^\s+|\s+$/gm, '' );                // Trim  white space //FixIn: 5.4.5
						var reg = /^([A-Za-z0-9_\-\.\+])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,})$/;
						if ( (inp_value != '') && (reg.test( inp_value ) == false) ){

                            var notice_message_id = wpbc_front_end__show_message__warning( el, _wpbc.get_message( 'message_check_email' ) );
                            fields_with_errors_arr.push( el );
							is_error_in_field = true;    // Error
						}
					}

					// Validate For digit entering - for example for - Phone
					// <p>Digit Field:<br />[text* dig_field class:validate_as_digit] </p>
					// <p>Phone:<br />[text* phone class:validate_digit_8] </p>

					var classList = jQuery( el ).attr( 'class' );

					if ( classList ){

						classList = classList.split( /\s+/ );

                        jQuery.each( classList, function ( cl_index, cl_item ){

                            ////////////////////////////////////////////////////////////////////////////////////////////

                            // Validate field value as "Date"   [CSS class - 'validate_as_digit']
                            if ( 'validate_as_date' === cl_item ) {

                                // Valid values: 09-25-2018, 09/25/2018, 09-25-2018,  31-9-1918  ---   m/d/Y, m.d.Y, m-d-Y, d/m/Y, d.m.Y, d-m-Y
                                var regex = new RegExp( '^[0-3]?\\d{1}[\\/\\.\\-]+[0-3]?\\d{1}[\\/\\.\\-]+[0-2]+\\d{3}$' );       // Check for Date 09/25/2018
                                var message_verif_phone = 'This field must be valid date like this ' + '09/25/2018';
                                var inp_value = jQuery( el ).val();

                                if (  ( inp_value != '' ) && ( regex.test( inp_value ) == false )  ){
                                    wpbc_front_end__show_message__warning( el, message_verif_phone );
                                    fields_with_errors_arr.push( el );
                                    is_error_in_field = true;    // Error
                                }
                            }

                            ////////////////////////////////////////////////////////////////////////////////////////////

                            // Validate field value as "DIGIT"   [CSS class - 'validate_as_digit']
                            if ( 'validate_as_digit' === cl_item ) {

                                var regex = new RegExp( '^[0-9]+\\.?[0-9]*$' );       // Check for digits
                                var message_verif_phone = 'This field must contain only digits';
                                var inp_value = jQuery( el ).val();

                                if (  ( inp_value != '' ) && ( regex.test( inp_value ) == false )  ){
                                    wpbc_front_end__show_message__warning( el, message_verif_phone );
                                    fields_with_errors_arr.push( el );
                                    is_error_in_field = true;    // Error
                                }
                            }

                            ////////////////////////////////////////////////////////////////////////////////////////////

                            // Validate field value as "Phone" number or any other valid number wth specific number of digits [CSS class - 'validate_digit_8' || 'validate_digit_10' ]
                            var is_validate_digit = cl_item.substring( 0, 15 );

                            // Check  if class start  with 'validate_digit_'
                            if ( 'validate_digit_' === is_validate_digit ){

                                // Get  number of digit in class: validate_digit_8 => 8 or validate_digit_10 => 10
                                var digits_to_check = parseInt( cl_item.substring( 15 ) );

                                // Check  about any errors in
                                if ( !isNaN( digits_to_check ) ){

                                    var regex = new RegExp( '^\\d{' + digits_to_check + '}$' );       // We was valid it as parseInt - only integer variable - digits_to_check
                                    var message_verif_phone = 'This field must contain ' + digits_to_check + ' digits';
                                    var inp_value = jQuery( el ).val();

									if (  ( inp_value != '' ) && ( regex.test( inp_value ) == false )  ){
                                        wpbc_front_end__show_message__warning( el, message_verif_phone );
                                        fields_with_errors_arr.push( el );
                                        is_error_in_field = true;    // Error
                                    }
                                }
                            }

                            ////////////////////////////////////////////////////////////////////////////////////////////

                        });
    				}
                }
			}
        } );

        if ( fields_with_errors_arr.length > 0 ){
            jQuery( fields_with_errors_arr[ 0 ] ).trigger( 'focus' );    // FixIn: 9.3.1.9.
        }
	}

    return is_error_in_field;
}


// FixIn: 8.6.1.15.
/**
 * Go to next  specific step in Wizard style booking form, with
 * check all required elements specific step, otherwise show warning message!
 *
 * @param el
 * @param step_num
 * @returns {boolean}
 */
function wpbc_wizard_step(el, step_num, step_from) {
	var br_id = jQuery( el ).closest( 'form' ).find( 'input[name^="bk_type"]' ).val();

	// FixIn: 8.8.1.5.
	if ( (undefined == step_from) || (step_num > step_from) ) {
		if ( 1 != step_num ) {                                                                       					// FixIn: 8.7.7.8.
			var is_error = wpbc_check_errors_in_booking_form( br_id );
			if ( is_error ) {
				return false;
			}
		}
	}

	if ( wpbc_is_some_elements_visible( br_id, [ 'rangetime', 'durationtime', 'starttime', 'endtime' ] ) ) {
		if ( wpbc_is_this_time_selection_not_available( br_id, document.getElementById( 'booking_form' + br_id ) ) ) {
			return false;
		}
	}

	if ( br_id != undefined ) {
		jQuery( "#booking_form" + br_id + " .wpbc_wizard_step" ).css( { "display": "none" } ).removeClass( 'wpbc_wizard_step_hidden' );
		jQuery( "#booking_form" + br_id + " .wpbc_wizard_step" + step_num ).css( { "display": "block" } );
		return jQuery( "#booking_form" + br_id + " .wpbc_wizard_step" + step_num );
	}
}


/**
 *  Init Buttons in Booking form Wizard
 */
function wpbc_hook__init_booking_form_wizard_buttons() {

	// CSS classes in Wizard Next / Prior links can  be like this:  <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_1">Step 1</a>   |  <a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_2">Step 2</a> .

	jQuery( '.wpbc_wizard_step_button' ).attr(
		{
			href: 'javascript:void(0)',
		}
	);

	jQuery( '.wpbc_wizard_step_button' ).on(
		'click',
		function (event) {
			var found_steps_arr = jQuery( this ).attr( 'class' ).match( /wpbc\_wizard\_step\_([\d]+)([\s'"]+|$)/ );

			if ( (null !== found_steps_arr) && (found_steps_arr.length > 2) ) {
				var step = parseInt( found_steps_arr[1] );
				if ( step > 0 ) {
					var jq_step_element;
					// Check actual step in booking form for getting step_from number.
					var this_formsteps_arr = jQuery( this ).parents( '.wpbc_wizard_step' ).attr( 'class' ).match( /wpbc\_wizard\_step([\d]+)([\s'"]+|$)/ );
					if ( (null !== this_formsteps_arr) && (this_formsteps_arr.length > 2) ) {
						var step_from   = parseInt( this_formsteps_arr[1] );
						jq_step_element = wpbc_wizard_step( this, step, step_from );
					} else {
						jq_step_element = wpbc_wizard_step( this, step );
					}
					// Do Scroll.
					if ( false !== jq_step_element ) {
						wpbc_do_scroll( jq_step_element ); // wpbc_do_scroll( jQuery('.wpbc_wizard_step:visible') );.
					}
				}
			}
		}
	);
}

// FixIn: 10.1.3.2.
jQuery( document ).ready( function (){
    wpbc_hook__init_booking_form_wizard_buttons();
} );


// FixIn: 8.6.1.15.
/**
 * Check if at least  one element from  array  of  elements names in booking form  visible  or not.
 * Usage Example:   if ( wpbc_is_some_elements_visible( br_id, ['rangetime', 'durationtime', 'starttime', 'endtime'] ) ){ ... }
 *
 * @param bk_type
 * @param elements_names
 * @returns {boolean}
 */
function wpbc_is_some_elements_visible( bk_type, elements_names ){

    var is_some_elements_visible = false;

    var my_form = jQuery( '#booking_form' + bk_type );

    if ( my_form.length ){

        // Pseudo-selector that get form elements <input , <textarea , <select, <button...
        my_form.find( ':input' ).each( function ( index, el ){

            // Skip some elements
            var skip_elements = ['hidden', 'button'];

            if ( -1 == skip_elements.indexOf( jQuery( el ).attr( 'type' ) ) ){

                for ( var ei = 0; ei < ( elements_names.length - 1) ; ei++ ){

                    // Check Calendar Dates Selection
                    if ( (elements_names[ ei ] + bk_type) == jQuery( el ).attr( 'name' ) ){

                        if ( jQuery( el ).is( ':visible' ) ){
                            is_some_elements_visible = true;
                        }
                    }
                }
            }
        } );
    }
    return is_some_elements_visible;
}

// == Days Selections - support functions ==============================================================================

/**
 * Get first day of selection
 *
 * @param dates
 * @returns {string|*}
 */
function get_first_day_of_selection(dates) {

    // Multiple days selections
    if ( dates.indexOf( ',' ) != -1 ){
        var dates_array = dates.split( /,\s*/ );
        var length = dates_array.length;
        var element = null;
        var new_dates_array = [];

        for ( var i = 0; i < length; i++ ){

            element = dates_array[ i ].split( /\./ );

            new_dates_array[ new_dates_array.length ] = element[ 2 ] + '.' + element[ 1 ] + '.' + element[ 0 ];       //2013.12.20
        }
        new_dates_array.sort();

        element = new_dates_array[ 0 ].split( /\./ );

        return element[ 2 ] + '.' + element[ 1 ] + '.' + element[ 0 ];                    //20.12.2013
    }

    // Range days selection
    if ( dates.indexOf( ' - ' ) != -1 ){
        var start_end_date = dates.split( " - " );
        return start_end_date[ 0 ];
    }

    // Single day selection
    return dates;                                                               //20.12.2013
}

// Get last day of selection
function get_last_day_of_selection(dates) {

    // Multiple days selections
    if ( dates.indexOf(',') != -1 ){
        var dates_array =dates.split(/,\s*/);
        var length = dates_array.length;
        var element = null;
        var new_dates_array = [];

        for (var i = 0; i < length; i++) {

          element = dates_array[i].split(/\./);

          new_dates_array[new_dates_array.length] = element[2]+'.' + element[1]+'.' + element[0];       //2013.12.20
        }
        new_dates_array.sort();

        element = new_dates_array[(new_dates_array.length-1)].split(/\./);

        return element[2]+'.' + element[1]+'.' + element[0];                    //20.12.2013
    }

    // Range days selection
    if ( dates.indexOf(' - ') != -1 ){
        var start_end_date = dates.split(" - ");
        return start_end_date[(start_end_date.length-1)];
    }

    // Single day selection
    return dates;                                                               //20.12.2013
}


/**
 * Check ID of selected additional calendars
 *
 * @param int bk_type
 * @returns array
 */
function wpbc_get_arr_of_selected_additional_calendars( bk_type ){                                                      // FixIn: 8.5.2.26.

    var selected_additionl_calendars = [];

    // Checking according additional calendars
    if ( document.getElementById( 'additional_calendars' + bk_type ) != null ){

        var id_additional_str = document.getElementById( 'additional_calendars' + bk_type ).value;
        var id_additional_arr = id_additional_str.split( ',' );

        var is_all_additional_days_unselected = true;

        for ( var ia = 0; ia < id_additional_arr.length; ia++ ){
            if ( document.getElementById( 'date_booking' + id_additional_arr[ ia ] ).value != '' ){
                selected_additionl_calendars.push( id_additional_arr[ ia ] );
            }
        }
    }
    return selected_additionl_calendars;
}

// ---------------------------------------------------------------------------------------------------------------------
// Elementor Ready Widget Update.
// ---------------------------------------------------------------------------------------------------------------------
jQuery( function ($) {

	if ( window.elementorFrontend ) {

		elementorFrontend.hooks.addAction( 'frontend/element_ready/wpbc_widget_booking_form_1.default', function ($scope) {
			// Simulate DOM ready,  after  updating Elementor Widget.
			jQuery( document ).trigger( 'wpbc_elementor_ready' );
		} );

		// Catch all widget re-renders.
		// elementorFrontend.hooks.addAction( 'frontend/element_ready/global', function ($scope) {
		// 	console.log( 'Some widget was re-rendered:', $scope );
		// } );
	}
} );

// Elementor widget  reinit. So  we need to reinit all "jQuery( document ).ready( ...) " again with custom 'wpbc_elementor_ready' event.
jQuery( document ).on( 'wpbc_elementor_ready', function () {

	wpbc_hook__init_booking_form_wizard_buttons();

	if ( 'function' === typeof (wpbc_hook__init_timeselector) ) {
		wpbc_hook__init_timeselector();
	}

	if ( 'function' === typeof (wpbc_update_capacity_hint) ) {
		jQuery( '.booking_form_div' ).on( 'wpbc_booking_date_or_option_selected', function (event, resource_id) {
			wpbc_update_capacity_hint( resource_id );
		} );
	}

	// TODO:
	// <?php if ('wpbc_theme_dark_1' === get_bk_option( 'booking_form_theme' ) ){  ?>
	// 	jQuery( '.wpbc_widget_preview_booking_form .wpbc_center_preview,.wpbc_widget_preview_booking_form .wpbc_container.wpbc_container_booking_form,.wpbc_widget_preview_booking_form .wpbc_widget_content' ).addClass( 'wpbc_theme_dark_1' );
	// <?php } ?>

} );
