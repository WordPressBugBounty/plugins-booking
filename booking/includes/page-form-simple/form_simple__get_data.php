<?php /**
 * @version 1.0
 * @package Booking Calendar
 * @category Simple Booking Form Setup
 * @author wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2024-08-16
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


/**
 * Get  - Visual -   Booking Form Structure
 *
 * @return array|false|mixed|null
 */
function wpbc_simple_form__db__get_visual_form_structure() {

	// == Custom Forms ==  Start			// Get  Custom  booking form
	if ( class_exists( 'wpdev_bk_biz_m' ) ) {
	    $form_name = wpbc_get_sanitized_custom_booking_form_name_from_url();
		if ( ( ! empty( $form_name ) ) && ( 'standard' !== $form_name ) ) {
		    $custom_booking_form = wpbc_get_custom_booking_form__for_simple_form_mode( $form_name );
			if ( ! empty( $custom_booking_form ) ) {
			    return $custom_booking_form;
		    }
	    }
    }
	// == Custom Forms ==  End

    $visual_form_structure = get_bk_option( 'booking_form_visual' );
	$visual_form_structure = maybe_unserialize( $visual_form_structure );

    if ( $visual_form_structure == false ) {
		// Get blank data
	    $visual_form_structure = wpbc_simple_form__visual__get_default_form();
    }

    return $visual_form_structure;
}


/**
 * Get  == Content of booking fields data ==    based on Visual Structure
 *
 * @param $visual_form_structure  array
 *
 * @return string
 */
function wpbc_simple_form__get_form_show__as_shortcodes( $visual_form_structure = false ) {

    if ( empty( $visual_form_structure ) ) {
	    $visual_form_structure = wpbc_simple_form__db__get_visual_form_structure();
    }
    $visual_form_structure = maybe_unserialize( $visual_form_structure );


    $booking_form_show = '<div class="simple-content-form" style="text-align:left;word-wrap: break-word;">'  . "\n";

    $skip_already_exist_field_types = array( 'calendar', 'submit', 'captcha' );

    foreach ( $visual_form_structure as $key => $form_field ) {

	    $defaults   = array(
		    'type'       => 'text',
		    'name'       => 'unique_name',
		    'obligatory' => 'Off',
		    'active'     => 'On',
		    'required'   => 'Off',
		    'label'      => '',
		    'value'      => ''
	    );
	    $form_field = wp_parse_args( $form_field, $defaults );

        if (
                   ( ! in_array( $form_field['type'], $skip_already_exist_field_types  ) )
               &&  (  ( $form_field['active'] != 'Off' ) || ( $form_field['obligatory'] == 'On' )  )
        ){
            // L abel language
            $form_field['label'] = wpbc_lang( $form_field['label'] );
            if ( function_exists( 'icl_translate' ) ) {
	            $form_field['label'] = icl_translate( 'wpml_custom', 'wpbc_custom_form_field_label_' . $form_field['name'], $form_field['label'] ); // WPML
            }

            $booking_form_show .= '  <b>' . $form_field['label'] . '</b>: ' . '<f>[' . $form_field['name'] . ']</f><br/>' . "\n";
        }
    }

    $booking_form_show.='</div>';

    return $booking_form_show;
}



	/**
	 * This function    get transfer    "Booking form"        from    "Simple (free)  -->  Paid"                        Free Structure -> Shortcodes
	 *
	 * usually later it saved 	update_bk_option( 'booking_form', ... ) on $this->update()  function
	 *
	 * Get Booking form in Shortcodes - format  compatible with  premium versions
	 *
	 * @param $visual_form_structure
	 *
	 * @return string
	 */
    function wpbc_simple_form__get_booking_form__as_shortcodes( $visual_form_structure = false ) {

		// -------------------------------------------------------------------------------------------------------------
		// Get simple booking form  structure
		// -------------------------------------------------------------------------------------------------------------
	    if ( empty( $visual_form_structure ) ) {
		    $visual_form_structure = wpbc_simple_form__db__get_visual_form_structure();
	    }
        $visual_form_structure = maybe_unserialize( $visual_form_structure );


		// -------------------------------------------------------------------------------------------------------------
		// Get Booking Form   - Structure -
		// -------------------------------------------------------------------------------------------------------------
	    $booking_form_structure = get_bk_option( 'booking_form_structure_type' );
	    if ( empty( $booking_form_structure ) ) {
		    $booking_form_structure = 'vertical';
	    }

	    $html_form = '';
	    // -------------------------------------------------------------------------------------------------------------
	    // Booking Form
	    // -------------------------------------------------------------------------------------------------------------
	    $skip_already_exist_field_types = array();                                                                  // 'calendar', 'submit', 'captcha' );
	    $exist_fields_arr               = array();

	    if ( 'form_right' == $booking_form_structure ) {
		    $html_form .= '<r>'             . "\n";
		    $html_form .= '  <c>'           . "\n";
		    $html_form .= '    [calendar]'  . "\n";
		    $html_form .= '  </c>'          . "\n";
		    $html_form .= '  <c>'           . "\n";

		    $skip_already_exist_field_types[] = 'calendar';
		    $exist_fields_arr[]               = 'calendar';
	    }

	    $html_form .= '<div class="wpbc__form__div">' . "\n";

		// Fields
        foreach ( $visual_form_structure as $key => $form_field ) {
            $defaults = array(
                                'type'     => 'text'
                              , 'name'     => 'unique_name'
                              , 'obligatory' => 'Off'
                              , 'active'   => 'On'
                              , 'required' => 'Off'
                              , 'label'    => ''
                              , 'value'    => ''
            );
            $form_field = wp_parse_args( $form_field, $defaults );

	        if (
		        ( ! in_array( $form_field['type'], $skip_already_exist_field_types ) ) &&
		        ( ( $form_field['active'] != 'Off' ) || ( $form_field['obligatory'] == 'On' ) )
	        ) {

		        if ( in_array( $form_field['type'], array( 'calendar', 'captcha', 'submit' ) ) ) {
			        $exist_fields_arr[] = $form_field['type'];
		        } else {
			        $exist_fields_arr[] = $form_field['name'];
		        }

				$field_css_class = 'wpbc_r_' . $exist_fields_arr[ count( $exist_fields_arr ) - 1 ];
				$html_form .= '	<r class="' . esc_attr( $field_css_class ) . '">' . "\n";
				$html_form .= '		<c> ';

	            // -----------------------------------------------------------------------------------------------------
	            // L abel
	            // -----------------------------------------------------------------------------------------------------
	            $form_field['label'] = wpbc_lang( $form_field['label'] );
	            if ( function_exists( 'icl_translate' ) ) {                             								// WPML
		            $form_field['label'] = icl_translate( 'wpml_custom', 'wpbc_custom_form_field_label_' . $form_field['name'], $form_field['label'] );
	            }

	            if (
						( $form_field['type'] != 'checkbox' ) &&
						( $form_field['type'] != 'submit' )
	            ){
		            $html_form .= ' <l>' . $form_field['label'] .
								( ( ! empty( $form_field['label'] ) )
									            ? ( ( ( $form_field['required'] == 'On' ) ? '*' : '' ) . ':' )
									            : '' )
								. '</l><br>';
	            }

				// -----------------------------------------------------------------------------------------------------
                // Field Shortcode
				// -----------------------------------------------------------------------------------------------------

				if ( $form_field['type'] == 'calendar' ) {
					$html_form .= '[calendar]';
				}

	            if ( $form_field['type'] == 'captcha' ){
		            $html_form .= '[captcha]';
	            }

	            if ( $form_field['type'] == 'submit' ) {
		            $submit_button_title = str_replace( '"', '', html_entity_decode( esc_js( $form_field['label'] ) ) );
		            $html_form .= '[submit class:btn "' . esc_attr( $submit_button_title ) . '"]';
	            }


				if ( $form_field['type'] == 'text' )  {                      // Text
					$html_form .= '[text'
								. ( ( $form_field['required'] == 'On' ) ? '*' : '' )
								. ' '. $form_field['name']
								.']';
	            }

				if ( $form_field['type'] == 'email' ){                       // Email
					$html_form .= '[email'
								. ( ( $form_field['required'] == 'On' ) ? '*' : '' )
								. ' '. $form_field['name']
								.']';
	            }

				if ( ( $form_field['type'] == 'selectbox' ) || ( $form_field['type'] == 'select' ) ){                    // Select
					$html_form .= '[selectbox'
								. ( ( $form_field['required'] == 'On' ) ? '*' : '' )
								. ' '. $form_field['name'];

						$form_field['value'] = preg_split( '/\r\n|\r|\n/', $form_field['value'] );
						foreach ($form_field['value'] as $select_option) {

							$select_option = str_replace(array("'",'"'), '', $select_option);

							$html_form.='  "' . $select_option . '"';
						}

					$html_form .= ']';
				}

				if ( $form_field['type'] == 'textarea' ){                    // Textarea
					$html_form .= '[textarea'
								. ( ( $form_field['required'] == 'On' ) ? '*' : '' )
								. ' '. $form_field['name']
								.']';
	            }

				if ( $form_field['type'] == 'checkbox' ) {                    // Checkbox
					$html_form .= '[checkbox'
								. ( ( $form_field['required'] == 'On' ) ? '*' : '' )
								. ' '. $form_field['name'];
					$html_form .= ' use_label_element';
					$html_form .= ' "' . str_replace( array('"', "'"), '', $form_field['label'] ) .'"]';
				}

	            $html_form .= '</c>' . "\n";
				$html_form .= '	</r>' . "\n";
            }
        }
		// -------------------------------------------------------------------------------------------------------------
	    // Double recheck if these fields NOT exist.  This double rechecking for MIGRATION period started on 2024-08-17. Later it can be removed
	    // -------------------------------------------------------------------------------------------------------------
	    if ( ! in_array( 'calendar', $exist_fields_arr ) ) {
		    $html_form = '[calendar]' . "\n" . $html_form;
	    }
		// Captcha ??
	    if ( ( ! in_array( 'captcha', $exist_fields_arr ) ) && ( get_bk_option( 'booking_is_use_captcha' ) == 'On' ) ) {
			$html_form .= '	<spacer>height:10px;</spacer>' . "\n";
			$html_form .= '	<r>' . "\n";
			$html_form .= '		<c> [captcha] </c>' . "\n";
			$html_form .= '	</r>' . "\n";
		}
		// Submit ??
	    if ( ! in_array( 'submit', $exist_fields_arr ) ) {
			$submit_button_title = wpbc_simple_form__visual__get_send_button_title( $visual_form_structure );
			$submit_button_title = str_replace( '"', '', html_entity_decode( esc_js( wpbc_lang( $submit_button_title ) ), ENT_QUOTES ) );

			$html_form .= '	<r>' . "\n";
			$html_form .= '		<c> <p>[submit class:btn "' . esc_attr( $submit_button_title ) .'"]</p> </c>' . "\n";
			$html_form .= '	</r>' . "\n";
	    }
		// -------------------------------------------------------------------------------------------------------------
		// - End - This double rechecking for MIGRATION period started on 2024-08-17. Later it can be removed
		// -------------------------------------------------------------------------------------------------------------


		$html_form .= '</div>' . "\n";

		// -------------------------------------------------------------------------------------------------------------
		// ==  Booking Form  ::  Structure  ==
		// -------------------------------------------------------------------------------------------------------------
		if ( 'form_right' == $booking_form_structure ) {
			$html_form .= '	</c>' . "\n";
			$html_form .= '	</r>' . "\n";
		}


		$form_css_class_arr = array();

		// Center Form
		if ( 'form_center' == $booking_form_structure ) {
			$form_css_class_arr[] = 'wpbc_booking_form_structure';
			$form_css_class_arr[] = 'wpbc_form_center';
		}

	    $html_form = '<div class="wpbc_booking_form_simple ' . implode( ' ', $form_css_class_arr ) . '">' . "\n" .
	                    $html_form .
	               '</div>';

		// Form Width
		$form_layout_width       = get_bk_option( 'booking_form_layout_width' );
		$form_layout_width_px_pr = get_bk_option( 'booking_form_layout_width_px_pr' );
		$html_form = '<style type="text/css">.wpbc_container_booking_form .block_hints, .wpbc_booking_form_simple.wpbc_form_center .wpbc__form__div .wpbc__row.wpbc_r_calendar, .wpbc_booking_form_simple .wpbc__form__div .wpbc__row:not(.wpbc_r_calendar){max-width:' . $form_layout_width . $form_layout_width_px_pr . ';} </style>' . "\n" . $html_form;

        return $html_form;
    }



	/**
	 * Get HTML of booking form based on Visual Structure. 		This func.  for pure FREE  version - getting HTML  content of booking form.
	 * Get booking form in HTML   in Free version
	 *
	 * @param $resource_id
	 *
	 * @return array|mixed|string|string[]
	 */
    function wpbc_simple_form__get_booking_form__as_html( $resource_id = 1 ) {

	    $booking_data__parsed_fields = array();
	    $booking_data__dates         = array();
	    if ( isset( $_GET['booking_hash'] ) ) {

		    $booking_id__resource_id = wpbc_hash__get_booking_id__resource_id( $_GET['booking_hash'] );

		    if ( $booking_id__resource_id != false ) {

			    $booking_data = wpbc_search_booking_by_id( $booking_id__resource_id[0] );
			    if ( false !== $booking_data ) {
				    $booking_data__parsed_fields = $booking_data->parsed_fields;
				    $booking_data__dates         = $booking_data->dates;
			    }
		    }
	    }

        $visual_form_structure = wpbc_simple_form__db__get_visual_form_structure();

	    $booking_form_structure = get_bk_option( 'booking_form_structure_type' );
	    if ( empty( $booking_form_structure ) ) {
		    $booking_form_structure = 'vertical';
	    }


	    // -------------------------------------------------------------------------------------------------------------
	    // Booking Form
	    // -------------------------------------------------------------------------------------------------------------
	    $html_form = '';

		$skip_already_exist_field_types = array();                                                                  // 'calendar', 'submit', 'captcha' );
		$exist_fields_arr = array();

	    if ( 'form_right' == $booking_form_structure ) {
		    $html_form .= '<r>'             . "\n";
		    $html_form .= '  <c>'           . "\n";
		    $html_form .= '    [calendar]'  . "\n";
		    $html_form .= '  </c>'          . "\n";
		    $html_form .= '  <c>'           . "\n";

		    $skip_already_exist_field_types[] = 'calendar';
		    $exist_fields_arr[]               = 'calendar';
	    }
	    $html_form .= '   <div class="wpbc__form__div">' . "\n";

		// Fields
		foreach ( $visual_form_structure as $key => $form_field ) {

			$defaults   = array(
				'type'       => 'text',
				'name'       => 'unique_name',
				'obligatory' => 'Off',
				'active'     => 'On',
				'required'   => 'Off',
				'label'      => '',
				'value'      => ''
			);
			$form_field = wp_parse_args( $form_field, $defaults );

			if ( ( ! in_array( $form_field['type'], $skip_already_exist_field_types ) ) && ( ( $form_field['active'] != 'Off' ) || ( $form_field['obligatory'] == 'On' ) ) ) {

		        if ( in_array( $form_field['type'], array( 'calendar', 'captcha', 'submit' ) ) ) {
			        $exist_fields_arr[] = $form_field['type'];
		        } else {
			        $exist_fields_arr[] = $form_field['name'];
		        }

				$field_css_class = 'wpbc_r_' . $exist_fields_arr[ count( $exist_fields_arr ) - 1 ];
				$html_form .= '    <r class="' . esc_attr( $field_css_class ) . '">' . "\n";
				$html_form .= '      <c> ';

				// -----------------------------------------------------------------------------------------------------
				// L abel
				// -----------------------------------------------------------------------------------------------------
				$form_field['label'] = wpbc_lang( $form_field['label'] );
				if ( function_exists( 'icl_translate' ) ) {                                                             // WPML
					$form_field['label'] = icl_translate( 'wpml_custom', 'wpbc_custom_form_field_label_' . $form_field['name'], $form_field['label'] );
				}
				if (
					( $form_field['type'] != 'checkbox' ) &&
					( $form_field['type'] != 'submit' ) &&
					( ! empty( $form_field['label'] ) )
				) {
					$html_form .= ' <l for="'. $form_field['name'] . $resource_id . '" >' .
						              $form_field['label'] . ( ( ( $form_field['required'] == 'On' ) ? '*' : '' ) . ':' ) .
								  '</l><br>';
				}

				// -----------------------------------------------------------------------------------------------------
				// Field Shortcode
				// -----------------------------------------------------------------------------------------------------
				$html_form .= wpbc_simple_form__get_html_form_input( $form_field, $booking_data__parsed_fields, $resource_id );

				$html_form .= '</c>' . "\n";
				$html_form .= '    </r>' . "\n";
			}
		}

		// -------------------------------------------------------------------------------------------------------------
	    // Double recheck if these fields NOT exist.  This double rechecking for MIGRATION period started on 2024-08-17. Later it can be removed
	    // -------------------------------------------------------------------------------------------------------------
	    if ( ! in_array( 'calendar', $exist_fields_arr ) ) {
		    $html_form = '[calendar]' . "\n" . $html_form;
	    }
		// Captcha ??
	    if ( ( ! in_array( 'captcha', $exist_fields_arr ) ) && ( get_bk_option( 'booking_is_use_captcha' ) == 'On' ) ) {
			$html_form .= '	<spacer>height:10px;</spacer>' . "\n";
			$html_form .= '	<r>' . "\n";
			$html_form .= '		<c> [captcha] </c>' . "\n";
			$html_form .= '	</r>' . "\n";
		}
		// Submit ??
	    if ( ! in_array( 'submit', $exist_fields_arr ) ) {

			$submit_button_title = ( ! empty( $booking_data__parsed_fields ) )
									? __( 'Change your Booking', 'booking' )
									: wpbc_simple_form__visual__get_send_button_title( $visual_form_structure );

			$submit_button_title = str_replace( '"', '', html_entity_decode( esc_js( wpbc_lang( $submit_button_title ) ), ENT_QUOTES ) );

			$html_form .= '   	<r>' . "\n";
			$html_form .= '   		<c> <p>'
									. '<button class="wpbc_button_light" type="button" onclick="mybooking_submit(this.form,' . $resource_id . ',\'' . wpbc_get_maybe_reloaded_booking_locale() . '\');" >'
										. $submit_button_title
									. '</button>'
							  .'</p> </c>' . "\n";
			$html_form .= '   	</r>' . "\n";
	    }
		// -------------------------------------------------------------------------------------------------------------
		// - End - This double rechecking for MIGRATION period started on 2024-08-17. Later it can be removed
		// -------------------------------------------------------------------------------------------------------------


	    $html_form .= '   </div>' . "\n";

	    if ( 'form_right' == $booking_form_structure ) {
		    $html_form .= '  </c>' . "\n";
		    $html_form .= '</r>' . "\n";
	    }


	    // -------------------------------------------------------------------------------------------------------------
	    // ==  Booking Form  ::  Structure  ==
	    // -------------------------------------------------------------------------------------------------------------
	    $form_css_class_arr = array();

	    // Center Form
	    if ( 'form_center' == $booking_form_structure ) {
		    $form_css_class_arr[] = 'wpbc_booking_form_structure';
		    $form_css_class_arr[] = 'wpbc_form_center';
	    }
	    $html_form = '<div class="wpbc_booking_form_simple ' . implode( ' ', $form_css_class_arr ) . '">' . "\n" .
		                 $html_form .
	                 '</div>';

	    // Form Width
	    $form_layout_width       = get_bk_option( 'booking_form_layout_width' );
	    $form_layout_width_px_pr = get_bk_option( 'booking_form_layout_width_px_pr' );
	    $html_form               = '<style type="text/css">.wpbc_container_booking_form .block_hints, .wpbc_booking_form_simple.wpbc_form_center .wpbc__form__div .wpbc__row.wpbc_r_calendar,  .wpbc_booking_form_simple .wpbc__form__div .wpbc__row:not(.wpbc_r_calendar){max-width:' . $form_layout_width . $form_layout_width_px_pr . ';} </style>' . "\n" . $html_form;


	    if ( ! empty( $booking_data__dates ) ) {
		    $html_form .= wpbc_get_dates_selection_js_code( $booking_data__dates, $resource_id );                       //FixIn: 9.2.3.4
	    }

	    $admin_uri = ltrim( str_replace( get_site_url( null, '', 'admin' ), '', admin_url( 'admin.php?' ) ), '/' );
	    if ( ( strpos( $_SERVER['REQUEST_URI'], $admin_uri ) !== false ) && ( isset( $_SERVER['HTTP_REFERER'] ) ) ) {
		    $html_form .= '<input type="hidden" name="wpdev_http_referer" id="wpdev_http_referer" value="' . $_SERVER['HTTP_REFERER'] . '" />';
	    }


	    // Parse Simple HTML tags
	    $booking_form = wpbc_bf__replace_custom_html_shortcodes( $html_form );

        return $booking_form;
    }


		/**
		 * Get HTML for INPUT  based on Stuctured form field data
		 *
		 * @param $form_field	array
		 * @param $booking_data__parsed_fields	array
		 * @param $resource_id int
		 *
		 * @return string
		 */
		function wpbc_simple_form__get_html_form_input( $form_field, $booking_data__parsed_fields = array(), $resource_id = 1 ) {

			$my_form = '';

			if ( $form_field['type'] == 'text' ){
				$my_form.='   <input type="text" name="'. $form_field['name'] . $resource_id . '" id="' . $form_field['name'] . $resource_id . '" class="input-xlarge'
								. ( ( $form_field['required'] == 'On' ) ? ' wpdev-validates-as-required' : '' )
								//. ( ( strpos( $form_field['name'], 'phone' ) !== false ) ? ' validate_as_digit' : '' )
							  .'" '
							  . ( isset( $booking_data__parsed_fields[ $form_field['name'] ] )					//FixIn: 9.2.3.4
								  ? ' value="' . esc_attr( $booking_data__parsed_fields[ $form_field['name'] ] ) . '"'
								  : ''
								)
							  . '/>';
			}

			if ( $form_field['type'] == 'email' ) {
				$my_form.='   <input type="text" name="'. $form_field['name'] . $resource_id . '" id="' . $form_field['name'] . $resource_id . '" class="input-xlarge wpdev-validates-as-email'
								. ( ( $form_field['required'] == 'On' ) ? ' wpdev-validates-as-required' : '' )
								. ' wpdev-validates-as-required'        //FixIn: 7.0.1.22
							  .'" '
							  . ( isset( $booking_data__parsed_fields[ $form_field['name'] ] )					//FixIn: 9.2.3.4
								  ? ' value="' . esc_attr( $booking_data__parsed_fields[ $form_field['name'] ] ) . '"'
								  : ''
								)
							  . '/>';
			}

			if ( ( $form_field['type'] == 'selectbox' ) || ( $form_field['type'] == 'select' ) ) {

				$my_form.='   <select name="'. $form_field['name'] . $resource_id . '" id="' . $form_field['name'] . $resource_id . '" class="input-xlarge'
							. ( ( $form_field['required'] == 'On' ) ? ' wpdev-validates-as-required' : '' )
							. '" >';																			//FixIn: 8.1.1.4

						$form_field['value'] = preg_split( '/\r\n|\r|\n/', $form_field['value'] );

						foreach ($form_field['value'] as $key => $select_option) {  //FixIn: 7.0.1.21


							$select_option = wpbc_lang( $select_option );
							if ( function_exists('icl_translate') )                             // WPML
								$select_option = icl_translate( 'wpml_custom', 'wpbc_custom_form_select_value_'
																				. wpbc_get_slug_format( $form_field['name']) . '_' .$key
																				, $select_option );
																					// //FixIn: 7.0.1.21
							$select_option = str_replace(array("'",'"'), '', $select_option);

																												//FixIn:  TimeFreeGenerator
							if ( strpos( $select_option, '@@' ) !== false ) {
								$select_option_title = explode( '@@', $select_option );
								$select_option_val = esc_attr( $select_option_title[1] );
								$select_option_title = trim( $select_option_title[0] );
							} else {
								$select_option_val = esc_attr( $select_option );
								$select_option_title = trim( $select_option );

								if ( 'rangetime' == $form_field['name'] ) {
									$select_option_title = wpbc_time_slot_in_format(  $select_option_title );
								}
							}

							//FixIn: 9.2.3.4	10.0.0.52
							if (
									(
											( isset( $booking_data__parsed_fields[ $form_field['name'] ] ) )
										&&  ( $select_option_val == $booking_data__parsed_fields[ $form_field['name'] ] )
									)
								 || (
											( isset( $booking_data__parsed_fields[ $form_field['name'] . '_in_24_hour' ] ) )
										&&  ( $select_option_val == $booking_data__parsed_fields[ $form_field['name'] .'_in_24_hour' ] )
									)
							){
								$is_option_selected = ' selected="selected" ';
							} else {
								$is_option_selected = '';
							}

							$my_form .= '  <option value="' . $select_option_val . '" ' . $is_option_selected . '>' . $select_option_title . '</option>';

							// $my_form.='  <option value="' . $select_option . '">' . $select_option . '</option>';
						}

				$my_form.='     </select>';
			}

			if ( $form_field['type'] == 'checkbox' ) {

				$my_form.='    <label for="'. $form_field['name'] . $resource_id . '" class="control-label" style="display: inline-block;">';

				//FixIn: 9.2.3.4
				if (
						( isset( $booking_data__parsed_fields[ $form_field['name'] ] ) )
					 && (
							   ( $form_field['value'] == $booking_data__parsed_fields[ $form_field['name'] ] )
							|| ( $form_field['label'] == $booking_data__parsed_fields[ $form_field['name'] ] )
							|| ( strtolower( __( 'Yes', 'booking' ) ) == strtolower( $booking_data__parsed_fields[ $form_field['name'] ] ) )
						)
				){
					$is_option_selected = ' checked="checked" ';
				} else {
					$is_option_selected = '';
				}

				$my_form.='   <input type="checkbox" name="'. $form_field['name'] . $resource_id . '" id="' . $form_field['name'] . $resource_id . '" class="wpdev-checkbox '
								. ( ( $form_field['required'] == 'On' ) ? ' wpdev-validates-as-required' : '' )
								. '" style="margin:0 0.25em 3px;" value="true" '
								. ' value="' . esc_attr( $form_field['label'] ) . '" '
								. $is_option_selected
								. '/>';

				$my_form.=   '&nbsp;' . $form_field['label']
							. ( ( $form_field['required'] == 'On' ) ? '' : '' )
						  . '</label>';

			}

			if ( $form_field['type'] == 'textarea' ) {
				$my_form.='   <textarea  rows="3" name="'. $form_field['name'] . $resource_id . '" id="' . $form_field['name'] . $resource_id . '" class="input-xlarge'
							. ( ( $form_field['required'] == 'On' ) ? ' wpdev-validates-as-required' : '' )
							. '" >';																			//FixIn: 8.1.1.4

				$my_form.= ( isset( $booking_data__parsed_fields[ $form_field['name'] ] )						//FixIn: 9.2.3.4
							  ? esc_attr( $booking_data__parsed_fields[ $form_field['name'] ] )                 //FixIn: 9.7.4.3
							  : ''
							);

				$my_form.='</textarea>';
			}

			if ( $form_field['type'] == 'calendar' ) {
				$my_form .= '[calendar]';
			}

			if ( $form_field['type'] == 'captcha' ) {
				$my_form .= '[captcha]';
			}

			if ( $form_field['type'] == 'submit' ) {

				if ( ! empty( $booking_data__parsed_fields ) ) {
					$submit_button_title = __( 'Change your Booking', 'booking' );
				} else {
					$submit_button_title = $form_field['label'];
				}
				$submit_button_title = str_replace( '"', '', html_entity_decode( esc_js( $submit_button_title ) ) );

				$my_form .= '<button class="wpbc_button_light" type="button" onclick="mybooking_submit(this.form,' . $resource_id . ',\'' . wpbc_get_maybe_reloaded_booking_locale() . '\');" >' .
				                $submit_button_title .
				            '</button>' . "\n";
			}

			return $my_form;
		}


		/**
		 * Get title for the Send button
		 *
		 * @param $visual_form_structure  optional
		 *
		 * @return mixed|string
		 */
		function wpbc_simple_form__visual__get_send_button_title( $visual_form_structure ) {

			$button_title = '';
			foreach ( $visual_form_structure as $field_arr ) {
				if ( 'submit' === $field_arr['type'] ) {
					$button_title = $field_arr['label'];
				}
			}

			// If no title in form  visual  structure
			if ( empty( $button_title ) ) {
				$default_options_values = wpbc_get_default_options();
				$button_title = ( empty( get_bk_option( 'booking_send_button_title' ) ) ? $default_options_values['booking_send_button_title'] : get_bk_option( 'booking_send_button_title' ) );
			}

			return $button_title;
		}
