<?php /**
 * @version 1.0
 * @description Template   for Setup pages
 * @category    Setup Templates
 * @author wpdevelop
 *
 * @web-site http://oplugins.com/
 * @email info@oplugins.com
 *
 * @modified 2024-09-09
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


// -------------------------------------------------------------------------------------------------------------
// == Main - General Info ==
// -------------------------------------------------------------------------------------------------------------
/**
 * Template - General Info - Step 01
 *
 * 	Help Tips:
 *
 *		<script type="text/html" id="tmpl-template_name_a">
 * 			Escaped:  	 {{data.test_key}}
 * 			HTML:  		{{{data.test_key}}}
 * 			JS: 	  	<# if (true) { alert( 1 ); } #>
 * 		</script>
 *
 * 		var template__var = wp.template( 'template_name_a' );
 *
 * 		jQuery( '.content' ).html( template__var( { 'test_key' => '<strong>Data</strong>' } ) );
 *
 * @return void
 */
function wpbc_template__stp_wiz__main_section__bookings_types(){

	?><script type="text/html" id="tmpl-wpbc_template__stp_wiz__main_section__bookings_types">
	<div class="wpbc_page_main_section    wpbc_container    wpbc_form    wpbc_container_booking_form">
		<div class="wpbc__form__div wpbc_swp_section wpbc_swp_section__bookings_types">
			<div class="wpbc__row">
				<div class="wpbc__field">
					<h1 class="wpbc_swp_section_header" ><?php _e( 'Select Your Booking Type', 'booking' ); ?></h1>
					<p class="wpbc_swp_section_header_description"><?php _e('This will help customize your experience.','booking'); ?></p>
				</div>
			</div>
			<div class="wpbc__row">
				<div class="wpbc__field">

					<div class="wpbc_ui_radio_section wpbc_ui_radio_section_as_row">
						<?php /* ?>
						<div class="wpbc_ui_radio_container" data-selected="true"  >
							<div class="wpbc_ui_radio_choice">
								<input class="wpbc_ui_radio_choice_input"
									   type="radio"
									   checked="checked"
									   name="wpbc_swp_booking_types"
									     id="wpbc_swp_booking_types__full_days_bookings"
									   						  value="full_days_bookings"
								/>
								<label  for="wpbc_swp_booking_types__full_days_bookings" class="wpbc_ui_radio_choice_title"><?php _e('Full Day Bookings','booking'); ?></label>
								<p class="wpbc_ui_radio_choice_description"><?php _e('Receive and manage full dates bookings for single or multiple days. No times selection.','booking') ?></p>
							</div>
						</div>
						<div class="wpbc_ui_radio_container"  >
							<div class="wpbc_ui_radio_choice">
								<input  class="wpbc_ui_radio_choice_input"
									   type="radio"
									   name="wpbc_swp_booking_types"
									     id="wpbc_swp_booking_types__time_slots_appointments"
									   						  value="time_slots_appointments"
								/>
								<label for="wpbc_swp_booking_types__time_slots_appointments" class="wpbc_ui_radio_choice_title"><?php _e('Times Appointments','booking'); ?></label>
								<p class="wpbc_ui_radio_choice_description"><?php _e('Receive and manage bookings for chosen times on selected date(s). Time-slots selection in booking form.','booking'); ?></p>
							</div>
						</div>
						<div class="wpbc_ui_radio_container"   >
							<div class="wpbc_ui_radio_choice">
								<input 	class="wpbc_ui_radio_choice_input"
									   type="radio"
									   disabled="disabled"
									   name="wpbc_swp_booking_types"
									     id="wpbc_swp_booking_types__changeover_multi_dates_bookings"
									   						  value="changeover_multi_dates_bookings"
								/>
								<label for="wpbc_swp_booking_types__changeover_multi_dates_bookings" class="wpbc_ui_radio_choice_title"><?php _e('Changeover multi dates bookings','booking'); ?></label>
								<a tabindex="-1" href="https://wpbookingcalendar.com/features/#change-over-days" target="_blank"><strong class="wpbc_ui_radio_text_right">Pro</strong></a>
								<p class="wpbc_ui_radio_choice_description"><?php _e('Manage multidays bookings with changeover days for check in/out dates, marked with diagonal or vertical lines. Split days bookings.','booking'); ?></p>
							</div>
							<div class="wpbc_ui_radio_choice wpbc_ui_radio_footer">
								<p class="wpbc_ui_radio_choice_description"><?php printf(__('Find more information about this feature on %sthis page%s.','booking'),
									'<a tabindex="-1" href="https://wpbookingcalendar.com/features/#change-over-days" target="_blank">','</a>') ; ?></p>
							</div>
						</div>
						<?php
						*/

							$params_radio = array(
								  'id'       => 'wpbc_swp_booking_types__full_days_bookings' 				// HTML ID  of element
								, 'name'     => 'wpbc_swp_booking_types'
								, 'value'    => 						'full_days_bookings' 				// Some Value from options array that selected by default
								, 'label'    => array( 'title' => __('Full-Day Bookings','booking') )
								, 'text_description'  => __('Manage bookings for entire days, whether it\'s for a single day or multiple days. No time selection is required.','booking')
								, 'label_after_right' => ''
								, 'footer_text' 	  => ''
								, 'style'    => '' 																		// CSS of select element
								, 'class'    => '' 																		// CSS Class of select element
								, 'disabled' => false
								, 'attr'     => array() 																// Any  additional attributes, if this radio | checkbox element
								, 'legend'   => ''																		// aria-label parameter
								, 'selected' => true 																	// Selected or not
								, 'onfocus' =>  "console.log( 'ON FOCUS:',  jQuery( this ).is(':checked') , 'in element:' , jQuery( this ) );"					// JavaScript code
								, 'onchange' => "console.log( 'ON CHANGE:', jQuery( this ).val() , 'in element:' , jQuery( this ) );"							// JavaScript code
							);
							wpbc_flex_radio_container( $params_radio );

							$params_radio = array(
								  'id'       => 'wpbc_swp_booking_types__time_slots_appointments' 				// HTML ID  of element
								, 'name'     => 'wpbc_swp_booking_types'
								, 'value'    => 						'time_slots_appointments' 				// Some Value from options array that selected by default
								, 'label'    => array( 'title' => __('Time-Based Appointments','booking') )
								, 'text_description'  => __('Manage bookings for specific times on selected dates. Allow clients to choose from available time slots in the booking form.','booking')
								, 'label_after_right' => ''
								, 'footer_text' 	  => ''
								, 'style'    => '' 																		// CSS of select element
								, 'class'    => '' 																		// CSS Class of select element
								, 'disabled' => false
								, 'attr'     => array() 																// Any  additional attributes, if this radio | checkbox element
								, 'legend'   => ''																		// aria-label parameter
								, 'selected' => false 																	// Selected or not
								, 'onfocus' =>  "console.log( 'ON FOCUS:',  jQuery( this ).is(':checked') , 'in element:' , jQuery( this ) );"					// JavaScript code
								, 'onchange' => "console.log( 'ON CHANGE:', jQuery( this ).val() , 'in element:' , jQuery( this ) );"							// JavaScript code
							);
							wpbc_flex_radio_container( $params_radio );

							$params_radio = array(
								  'id'       => 'wpbc_swp_booking_types__changeover_multi_dates_bookings' 				// HTML ID  of element
								, 'name'     => 'wpbc_swp_booking_types'
								, 'value'    => 						'changeover_multi_dates_bookings' 				// Some Value from options array that selected by default
								, 'label'    => array( 'title' => __('Changeover Multi-Date Bookings','booking') )
								, 'text_description'  => __('Manage multi-day bookings with specific check-in and check-out days, clearly marked with diagonal or vertical lines. Ideal for bookings that require split days.','booking')
								, 'label_after_right' => '<a tabindex="-1" href="https://wpbookingcalendar.com/features/#change-over-days" target="_blank"><strong class="wpbc_ui_radio_text_right">Pro</strong></a>'
								, 'footer_text' 	  => sprintf(__('Find more information about this feature on %sthis page%s.','booking'), '<a tabindex="-1" href="https://wpbookingcalendar.com/features/#change-over-days" target="_blank">','</a>')
								, 'style'    => '' 																		// CSS of select element
								, 'class'    => '' 																		// CSS Class of select element
								, 'disabled' => ( ! class_exists( 'wpdev_bk_biz_s' ) )
								, 'attr'     => array() 																// Any  additional attributes, if this radio | checkbox element
								, 'legend'   => ''																		// aria-label parameter
								, 'selected' => false 																	// Selected or not
								, 'onfocus' =>  "console.log( 'ON FOCUS:',  jQuery( this ).is(':checked') , 'in element:' , jQuery( this ) );"					// JavaScript code
								, 'onchange' => "console.log( 'ON CHANGE:', jQuery( this ).val() , 'in element:' , jQuery( this ) );"							// JavaScript code
							);
							wpbc_flex_radio_container( $params_radio );

						?>
					</div>

				</div>
			</div>

		</div>
		<style type="text/css">
			.wpbc_setup_wizard_page_container .wpbc_swp_section__bookings_types {max-width: 440px}
		</style>
	</div>
	</script><?php
}

