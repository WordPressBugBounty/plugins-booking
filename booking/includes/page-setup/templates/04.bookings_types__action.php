<?php /**
 * @version 1.0
 * @description Action  for  Template Setup pages
 * @category    Setup Action
 * @author wpdevelop
 *
 * @web-site http://oplugins.com/
 * @email info@oplugins.com
 *
 * @modified 2024-09-30
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


// -------------------------------------------------------------------------------------------------------------
// == Action - Bookings Types ==
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
 * @param array $post_data Untrusted Setup Wizard booking-type request values.
 *
 * @return array Validated booking-type configuration with safe defaults.
 */


function wpbc_template__bookings_types__action_validate_data( $post_data ){

	$escaped_data = array(
		'wpbc_swp_booking_mode'             => '',          // Can be: 'classic' | 'appointment' | 'rental'.
		'wpbc_swp_booking_types'            => '',          // Can be: 'full_days_bookings' | 'time_slots_appointments' | 'changeover_multi_dates_bookings'
		'wpbc_swp_booking_timeslot_picker'  => get_bk_option('booking_timeslot_picker'),
		'wpbc_swp_booking_appointments_type'  => 'rangetime',
		'wpbc_swp_booking_change_over_days_triangles'  => get_bk_option('booking_change_over_days_triangles')
	);

	$key = 'wpbc_swp_booking_mode';
	if ( isset( $post_data[ $key ] ) && is_scalar( $post_data[ $key ] ) && '' !== (string) $post_data[ $key ] ) {
		$booking_mode = sanitize_key( wp_unslash( $post_data[ $key ] ) );
		$allowed_mode_ids = function_exists( 'wpbc_booking_modes_get_allowed_mode_ids' )
			? wpbc_booking_modes_get_allowed_mode_ids()
			: array( 'classic' );

		if ( in_array( $booking_mode, $allowed_mode_ids, true ) ) {
			$escaped_data[ $key ] = $booking_mode;
		}
	}

	$key = 'wpbc_swp_booking_types';
	if ( isset( $post_data[ $key ] ) && is_scalar( $post_data[ $key ] ) && '' !== (string) $post_data[ $key ] ) {
		$booking_type = sanitize_key( wp_unslash( $post_data[ $key ] ) );
		if ( in_array( $booking_type, array( 'full_days_bookings', 'time_slots_appointments', 'changeover_multi_dates_bookings' ), true ) ) {
			$escaped_data[ $key ] = $booking_type;
		}
	}
	$key = 'wpbc_swp_booking_timeslot_picker';
	if ( isset( $post_data[ $key ] ) && is_scalar( $post_data[ $key ] ) && '' !== (string) $post_data[ $key ] ) {
		$timeslot_picker = sanitize_text_field( wp_unslash( $post_data[ $key ] ) );
		if ( in_array( $timeslot_picker, array( 'On', 'Off' ), true ) ) {
			$escaped_data[ $key ] = $timeslot_picker;
		}
	}
	$key = 'wpbc_swp_booking_appointments_type';
	if ( isset( $post_data[ $key ] ) && is_scalar( $post_data[ $key ] ) && '' !== (string) $post_data[ $key ] ) {
		$appointments_type = sanitize_key( wp_unslash( $post_data[ $key ] ) );
		if ( in_array( $appointments_type, array( 'rangetime', 'durationtime' ), true ) ) {
			$escaped_data[ $key ] = $appointments_type;
		}
	}
	$key = 'wpbc_swp_booking_change_over_days_triangles';
	if ( isset( $post_data[ $key ] ) && is_scalar( $post_data[ $key ] ) && '' !== (string) $post_data[ $key ] ) {
		$changeover_triangles = sanitize_text_field( wp_unslash( $post_data[ $key ] ) );
		if ( in_array( $changeover_triangles, array( 'On', 'Off' ), true ) ) {
			$escaped_data[ $key ] = $changeover_triangles;
		}
	}

	if ( 'appointment' === $escaped_data['wpbc_swp_booking_mode'] ) {
		$escaped_data['wpbc_swp_booking_types'] = 'time_slots_appointments';
		$escaped_data['wpbc_swp_booking_appointments_type'] = 'durationtime';
	} elseif (
		'rental' === $escaped_data['wpbc_swp_booking_mode']
		&& ! in_array( $escaped_data['wpbc_swp_booking_types'], array( 'full_days_bookings', 'changeover_multi_dates_bookings' ), true )
	) {
		$escaped_data['wpbc_swp_booking_types'] = 'full_days_bookings';
	}

	if ( 'changeover_multi_dates_bookings' === $escaped_data['wpbc_swp_booking_types'] && ! class_exists( 'wpdev_bk_biz_s' ) ) {
		$escaped_data['wpbc_swp_booking_types'] = 'full_days_bookings';
	}

	return $escaped_data;
}

/**
 * Save Setup Wizard booking form choice into the BFB standard form.
 *
 * @param string     $advanced_form Advanced booking form shortcodes.
 * @param string     $content_form  Content of booking fields data shortcodes.
 * @param array|bool $visual_form_structure Optional old Simple visual structure for BFB conversion.
 *
 * @return void
 */
function wpbc_setup__save_standard_bfb_form( $advanced_form, $content_form, $visual_form_structure = false ) {

	if ( ! function_exists( 'wpbc_bfb_save_standard_form_from_advanced_mode' ) ) {
		return;
	}

	$owner_user_id = class_exists( 'WPBC_FE_Custom_Form_Helper' )
		? WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id()
		: 0;

	wpbc_bfb_save_standard_form_from_advanced_mode(
		$advanced_form,
		$content_form,
		$owner_user_id,
		array(
			'visual_form_structure' => $visual_form_structure,
		)
	);
}

/**
 * Replace the current owner's Standard form with a bundled BFB template.
 *
 * Setup Wizard booking-type choices historically replace the Standard form.
 * This helper preserves that explicit behavior while copying the complete BFB
 * structure and settings instead of rebuilding the form from Advanced markup.
 *
 * @param string $template_key Stable bundled template key.
 *
 * @return bool True when the Standard form was saved; otherwise false.
 */
function wpbc_setup__save_standard_bfb_form_from_template( $template_key ) {

	if (
		! class_exists( 'WPBC_BFB_Form_Storage' )
		|| ! function_exists( 'wpbc_get_bfb_template_record_by_key' )
		|| ( function_exists( 'wpbc_is_table_exists' ) && ! wpbc_is_table_exists( 'booking_form_structures' ) )
	) {
		return false;
	}

	$template_record = wpbc_get_bfb_template_record_by_key( sanitize_key( (string) $template_key ) );
	if (
		empty( $template_record )
		|| ! is_array( $template_record )
		|| empty( $template_record['structure_json'] )
		|| 'bfb' !== (string) $template_record['engine']
	) {
		return false;
	}

	$owner_user_id = class_exists( 'WPBC_FE_Custom_Form_Helper' )
		? WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id()
		: 0;

	unset(
		$template_record['booking_form_id'],
		$template_record['created_at'],
		$template_record['created_by'],
		$template_record['updated_at'],
		$template_record['updated_by']
	);

	$template_record['form_slug']           = 'standard';
	$template_record['status']              = 'published';
	$template_record['scope']               = $owner_user_id ? 'user' : 'global';
	$template_record['owner_user_id']       = absint( $owner_user_id );
	$template_record['booking_resource_id'] = null;
	$template_record['is_default']          = 1;
	$template_record['title']               = __( 'Standard', 'booking' );
	$template_record['description']         = '';

	return (bool) WPBC_BFB_Form_Storage::save_form( $template_record );
}


/**
 * Disable Working Time when the selected workflow does not book times.
 *
 * Full-day and changeover workflows in Rental or Classic mode must not retain
 * a time-based availability restriction. Existing weekday intervals and
 * resource overrides are preserved so they can be reused later.
 *
 * @param array $cleaned_data Validated Setup Wizard booking-type data.
 *
 * @return void
 */
function wpbc_setup__disable_working_time_for_day_based_workflow( $cleaned_data ) {

	if ( ! is_array( $cleaned_data ) ) {
		return;
	}

	$mode_id      = isset( $cleaned_data['wpbc_swp_booking_mode'] ) ? sanitize_key( (string) $cleaned_data['wpbc_swp_booking_mode'] ) : '';
	$booking_type = isset( $cleaned_data['wpbc_swp_booking_types'] ) ? sanitize_key( (string) $cleaned_data['wpbc_swp_booking_types'] ) : '';

	if (
		! in_array( $mode_id, array( 'classic', 'rental' ), true )
		|| ! in_array( $booking_type, array( 'full_days_bookings', 'changeover_multi_dates_bookings' ), true )
	) {
		return;
	}

	if ( function_exists( 'wpbc_working_time__get_settings' ) && function_exists( 'wpbc_working_time__update_settings' ) ) {
		$working_time_settings            = wpbc_working_time__get_settings();
		$working_time_settings['enabled'] = 'Off';
		wpbc_working_time__update_settings( $working_time_settings );
		return;
	}

	$working_time_settings = maybe_unserialize( get_bk_option( 'booking_working_time_rules', array() ) );
	if ( is_array( $working_time_settings ) ) {
		$working_time_settings['enabled'] = 'Off';
		update_bk_option( 'booking_working_time_rules', $working_time_settings );
	}
	update_bk_option( 'booking_working_time_enabled', 'Off' );
}

/**
 * Apply the selected workflow's starter picture to an unconfigured Resource.
 *
 * Setup Wizard may supply a useful visual identity for Appointment Providers
 * and Rental Properties. Existing pictures, including an explicitly removed
 * picture, remain authoritative and are never overwritten.
 *
 * @param array<string,mixed> $cleaned_data Validated Setup Wizard booking-type data.
 *
 * @return true|WP_Error True when applied, already configured, or not applicable; otherwise a storage error.
 */
function wpbc_setup__assign_starter_resource_picture( $cleaned_data ) {
	if (
		! is_array( $cleaned_data )
		|| ! function_exists( 'wpbc_booking_resource_content_repository' )
		|| ! function_exists( 'wpbc_get_starter_asset_url' )
	) {
		return true;
	}

	$mode_id             = isset( $cleaned_data['wpbc_swp_booking_mode'] )
		? sanitize_key( (string) $cleaned_data['wpbc_swp_booking_mode'] )
		: '';
	$relative_image_path = '';

	if ( 'appointment' === $mode_id ) {
		$relative_image_path = 'img/resources/professional-services-demo_provider-alex-morgan.png';
	} elseif ( 'rental' === $mode_id ) {
		$relative_image_path = 'img/resources/property_a01.jpg';
	}

	if ( '' === $relative_image_path ) {
		return true;
	}

	$resource_id = function_exists( 'wpbc_get_default_resource' ) ? absint( wpbc_get_default_resource() ) : 1;
	if ( ! $resource_id ) {
		$resource_id = 1;
	}

	return wpbc_booking_resource_content_repository()->save_starter_picture_if_unconfigured(
		$resource_id,
		wpbc_get_starter_asset_url( $relative_image_path )
	);
}



/**
 *  Update "General Data" like "Email" and "Title"
 *
 * @param $cleaned_data     array(
 *		'wpbc_swp_business_name'     => '',
 *		'wpbc_swp_booking_who_setup' => '',
 *		'wpbc_swp_industry'          => '',
 *		'wpbc_swp_email'             => '',
 *		'wpbc_swp_accept_send'       => 'Off'
 *
 * )
 *
 * @return void
 */
function wpbc_setup__update__bookings_types( $cleaned_data ){

	if ( ! empty( $cleaned_data['wpbc_swp_booking_types'] ) ) {

		// Show calendar legend by  default
		update_bk_option( 'booking_is_show_legend', 'On' );
		wpbc_setup__disable_working_time_for_day_based_workflow( $cleaned_data );

		switch ( $cleaned_data['wpbc_swp_booking_types'] ) {

		    case 'full_days_bookings':

			    if ( class_exists( 'wpdev_bk_personal' ) ) {
				    wpbc_setup__save_standard_bfb_form(
					    str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_form__template( 'hints-dev' ) ),
					    str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_data__template( 'hints-dev' ) )
				    );

					//    wpbc_setup__save_standard_bfb_form( wpbc_get__booking_form__template( '2_columns' ), wpbc_get__booking_data__template( '2_columns' ) );
			    } else {
				    // Free

				    // Structure
				    $booking_form_structure = 'form_right';                                                             // vertical  form_right  form_center
				    // $booking_form_structure = 'wizard_services_a'; // FixIn: 10.11.4.3.
				    update_bk_option( 'booking_form_structure_type' , $booking_form_structure );
				    // update_bk_option( 'booking_form_layout_max_cols' , 1 );

					// FixIn: 10.11.4.3.
				    update_bk_option( 'booking_form_layout_width', '440' );
				    update_bk_option( 'booking_form_layout_width_px_pr', 'px' );
				    update_bk_option( 'booking_form_layout_max_cols', 1 );


					// Default Form
				    $visual_form_structure = wpbc_simple_form__visual__get_default_form__without_times();

				    wpbc_setup__save_standard_bfb_form(
					    wpbc_simple_form__get_booking_form__as_shortcodes( $visual_form_structure ),
					    wpbc_simple_form__get_form_show__as_shortcodes( $visual_form_structure ),
					    $visual_form_structure
				    );
			    }

				// Full-day bookings use the two-click range by default in every edition.
				// Free/Personal apply the unrestricted range engine; Business Small+ can additionally apply its range rules.
				update_bk_option( 'booking_type_of_day_selections', 'range' );
				update_bk_option( 'booking_range_selection_type', 'dynamic' );

				if ( class_exists( 'wpdev_bk_biz_s' ) ) {
			        update_bk_option( 'booking_range_selection_days_count', '1');
			        update_bk_option( 'booking_range_selection_days_max_count_dynamic',30);
			        update_bk_option( 'booking_range_selection_days_specific_num_dynamic','');
			        update_bk_option( 'booking_range_start_day' ,           '-1' );
			        update_bk_option( 'booking_range_selection_days_count_dynamic','1');
			        update_bk_option( 'booking_range_start_day_dynamic' ,   '-1' );
				}
		        update_bk_option( 'booking_range_selection_time_is_active', 'Off');              // Changeover
				update_bk_option( 'booking_recurrent_time' , 'On');                             // Use selected times for each booking date

		        update_bk_option( 'booking_legend_is_show_item_partially', 'Off');              // Legend Item
				update_bk_option( 'booking_skin', '/css/skins/25_5__square_1.css' ); // FixIn: 10.11.4.2.
				update_bk_option( 'booking_form_theme', '' );
		        break;

		    case 'time_slots_appointments':

			    update_bk_option( 'booking_timeslot_picker', ( 'On' === $cleaned_data['wpbc_swp_booking_timeslot_picker'] ) ? 'On' : 'Off' );

				$is_appointment_flow = isset( $cleaned_data['wpbc_swp_booking_mode'] ) && 'appointment' === $cleaned_data['wpbc_swp_booking_mode'];
				$is_appointment_form_saved = $is_appointment_flow
					? wpbc_setup__save_standard_bfb_form_from_template( 'appointments_services_flow' )
					: false;

			    if ( ! $is_appointment_form_saved && class_exists( 'wpdev_bk_personal' ) ) {

					// FixIn: 10.7.1.4.
					if ( 'rangetime' === $cleaned_data['wpbc_swp_booking_appointments_type'] ){
						wpbc_setup__save_standard_bfb_form(
							str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_form__template( 'appointments30' ) ),
							str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_data__template( 'appointments30' ) )
						);
					} else{
						 // FixIn: 10.12.4.8.
						wpbc_setup__save_standard_bfb_form(
							str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_form__template( 'appointments_service_c' ) ),
							str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_data__template( 'appointments_service_c' ) )
						);
					}

			    } elseif ( ! $is_appointment_form_saved ) {
				    // Free.

				    // Structure.
					$booking_form_structure = ( 'rangetime' === $cleaned_data['wpbc_swp_booking_appointments_type'] ) ? 'wizard_2columns' : 'wizard_services_a';  // vertical  form_right  form_center.
					$booking_form_structure = 'wizard_services_a'; // FixIn: 10.11.4.3.

				    update_bk_option( 'booking_form_structure_type', $booking_form_structure );
				    update_bk_option( 'booking_form_layout_width', '100' );
				    update_bk_option( 'booking_form_layout_width_px_pr', '%' );
				    update_bk_option( 'booking_form_layout_max_cols', 2 );

					// Default Form
					if ( 'rangetime' !== $cleaned_data['wpbc_swp_booking_appointments_type'] ) {
						$visual_form_structure = wpbc_simple_form__visual__get_default_form__service_duration_a();
					} else {
						$visual_form_structure = wpbc_simple_form__visual__get_default_form__times_30min();
					}

				    wpbc_setup__save_standard_bfb_form(
					    wpbc_simple_form__get_booking_form__as_shortcodes( $visual_form_structure ),
					    wpbc_simple_form__get_form_show__as_shortcodes( $visual_form_structure ),
					    $visual_form_structure
				    );
			    }

				update_bk_option( 'booking_type_of_day_selections' , 'single' );
				update_bk_option( 'booking_range_selection_time_is_active', 'Off');              // Changeover
				update_bk_option( 'booking_recurrent_time' , 'Off');                              // Use selected times for each booking date

				update_bk_option( 'booking_legend_text_for_item_partially', __( 'Partially booked', 'booking' ) );
				update_bk_option( 'booking_legend_is_show_item_partially', 'On');              // Legend Item

				update_bk_option( 'booking_skin', '/css/skins/25_5__round_1.css' ); // FixIn: 10.11.4.2.
				update_bk_option( 'booking_form_theme', '' );
				// booking_timeslot_picker_skin

		        break;

		    case 'changeover_multi_dates_bookings':

				update_bk_option( 'booking_change_over_days_triangles', ( 'On' === $cleaned_data['wpbc_swp_booking_change_over_days_triangles'] ) ? 'On' : 'Off' );

			    if ( class_exists( 'wpdev_bk_personal' ) ) {
				    wpbc_setup__save_standard_bfb_form(
					    str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_form__template( 'wizard' ) ),
					    str_replace( array('\\n\\','\\n'), "\n", wpbc_get__predefined_booking_data__template( 'wizard' ) )
				    );
			    } else {
				    // Free

				    // Structure
				    $booking_form_structure = 'form_center';                                                            // vertical  form_right  form_center
				    update_bk_option( 'booking_form_structure_type' , $booking_form_structure );
				    update_bk_option( 'booking_form_layout_max_cols' , 1 );

					// Default Form
				    $visual_form_structure = wpbc_simple_form__visual__get_default_form__without_times();

				    wpbc_setup__save_standard_bfb_form(
					    wpbc_simple_form__get_booking_form__as_shortcodes( $visual_form_structure ),
					    wpbc_simple_form__get_form_show__as_shortcodes( $visual_form_structure ),
					    $visual_form_structure
				    );
			    }


			    update_bk_option( 'booking_type_of_day_selections' , 'range' );
		        update_bk_option( 'booking_range_selection_type', 'dynamic');
		        update_bk_option( 'booking_range_selection_days_count','2');
		        update_bk_option( 'booking_range_selection_days_max_count_dynamic',30);
		        update_bk_option( 'booking_range_selection_days_specific_num_dynamic','');
		        update_bk_option( 'booking_range_start_day' , '-1' );
		        update_bk_option( 'booking_range_selection_days_count_dynamic','2');
		        update_bk_option( 'booking_range_start_day_dynamic' , '-1' );

		        update_bk_option( 'booking_range_selection_time_is_active', 'On');              // Changeover
		        update_bk_option( 'booking_range_selection_start_time',     '14:00');
		        update_bk_option( 'booking_range_selection_end_time',       '12:00');

				update_bk_option( 'booking_recurrent_time' , 'Off');                             // Use selected times for each booking date

				update_bk_option( 'booking_legend_text_for_item_partially', __( 'Changeover', 'booking' ) );
				update_bk_option( 'booking_legend_is_show_item_partially', 'On');              // Legend Item

			    update_bk_option( 'booking_skin', '/css/skins/25_5__square_1.css' );
				update_bk_option( 'booking_form_theme', '' );

		        break;
		default:
		       // Default
		}

		wpbc_setup__assign_starter_resource_picture( $cleaned_data );

        // Update Email Data
        //update_bk_option( $email_option_name, $email_data );
	}
}
