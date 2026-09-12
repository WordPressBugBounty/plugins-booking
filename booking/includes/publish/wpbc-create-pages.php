<?php
/**
 * @version 1.0
 * @package Booking Calendar
 * @subpackage Create pages Functions
 * @category Functions
 *
 * @author wpdevelop
 * @link https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2023-05-10
 * @file ../includes/publish/wpbc-create-pages.php
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


/**
 * Create page for Booking Calendar
 *
 * @param array $page_params  = array(
								      'post_content'   => '[bookingedit]',
								      'post_name'      => 'wpbc-booking-edit',
								      'post_title'     => esc_html__('Booking edit','booking')
								)
 *
 * @return false|int - ID of the page.
 */
function wpbc_create_page( $page_params = array() ){                                                                    // FixIn: 9.6.2.10.

	/* Live demos must never create WordPress content through Booking Calendar. */
	if ( wpbc_is_booking_form_publishing_restricted() ) {
		return false;
	}

	global $wp_rewrite;
	if ( is_null( $wp_rewrite ) ) {     // FixIn: 9.7.1.1.
		return false;
	}

    // Create post object
    $defaults = array(
      //'menu_order'     => 0,                          // The order the post should be displayed in. Default 0. If new post is a page, it sets the order in which it should appear in the tabs.
      //'pinged'         => '',                         // Space or carriage return-separated list of URLs that have been pinged. Default empty.
      //'post_author'    => get_current_user_id(),      // The user ID number of the author.  The ID of the user who added the post. Default is the current user ID.
      //'post_category'  => array(),                    // Array of category IDs. Defaults to value of the 'default_category' option.   post_category no longer exists, try wp_set_post_terms() for setting a post's categories
      //'post_date'      => [ Y-m-d H:i:s ]             // The date of the post. Default is the current time. The time post was made.
      //'post_date_gmt'  => [ Y-m-d H:i:s ]             // The time post was made, in GMT.
      //'post_excerpt'   => ''                          //The post excerpt. Default empty. For all your post excerpt needs.
      //'post_parent'    => 0,                          // Set this for the post it belongs to, if any. Default 0. Sets the parent of the new post.
      //'post_password'  => '',                         //The password to access the post. Default empty. password for post?
      //'tags_input'     => '',                         // Array of tag names, slugs, or IDs. Default empty. [ '<tag>, <tag>, <...>' ] //For tags.
      //'to_ping'        => '',                         // Space or carriage return-separated list of URLs to ping. Default empty.  Space or carriage return-separated list of URLs to ping.  Default empty.
      //'tax_input'      => '',                         // Default empty. [ array( 'taxonomy_name' => array( 'term', 'term2', 'term3' ) ) ] // support for custom taxonomies.
      'ID'             => 0,                            // The post ID. If equal to something other than 0, the post with that ID will be updated. Default 0.
	  'post_type'      => 'page',                       // The post type. Default 'post'. [ 'post' | 'page' | 'link' | 'nav_menu_item' | 'custom_post_type' ] //You may want to insert a regular post, page, link, a menu item or some custom post type
      'post_status'    => 'publish',                    // [ 'draft' | 'publish' | 'pending'| 'future' | 'private' | 'custom_registered_status' ] // The post status. Default 'draft'. Set the status of the new post.
      'comment_status' => 'closed',                     // [ 'closed' | 'open' ] // 'closed' means no comments.
      'ping_status'    => 'closed',                     // [ 'closed' | 'open' ] // 'closed' means pingbacks or trackbacks turned off
      'post_content'   => '[bookingedit]',              // The post content. Default empty. The full text of the post.
      'post_name'      => 'wpbc-booking-edit',          // sanitize_title( $post_title ), -- By default, converts accent characters to ASCII characters and further limits the output to alphanumeric characters, underscore (_) and dash (-) // The post name. Default is the sanitized post title when creating a new post. The name (slug) for your post
      'post_title'     => esc_html__('Booking edit','booking')  // The post title. Default empty. The title of your post.
    );


	$my_post   = wp_parse_args( $page_params, $defaults );


	$post_id = wp_insert_post( $my_post, true );                         // Insert the post into the database

	if ( ( ! is_wp_error( $post_id ) ) && ( ! empty( $post_id ) ) ) {

		// Success

		// $post = get_post( $post_id );
		// $post_url = get_permalink( $post_id );
		wpbc_try_assign_full_width_template( $post_id,
			array(
				'excluded_title_parts'             => array( 'wide image' ),
				'excluded_classic_template_files'  => array( 'elementor_header_footer' ),
				'force_elementor_default_template' => true,
			) );

	} else {
		$post_id = false;
	}

	return $post_id;
}


/**
 * Check whether a template label looks like a usable "Full Width" template.
 *
 * Excludes labels that contain unwanted fragments such as "wide image".
 *
 * @param string $template_label     Human-readable template label.
 * @param array  $excluded_fragments Lowercase fragments to exclude.
 *
 * @return bool
 */
function wpbc_is_full_width_template_candidate( $template_label, $excluded_fragments = array() ) {

	$template_label = strtolower( wp_strip_all_tags( (string) $template_label ) );

	if (
		( false === strpos( $template_label, 'full' ) ) ||
		( false === strpos( $template_label, 'width' ) )
	) {
		return false;
	}

	foreach ( $excluded_fragments as $excluded_fragment ) {
		$excluded_fragment = strtolower( (string) $excluded_fragment );

		if ( '' === $excluded_fragment ) {
			continue;
		}

		if ( false !== strpos( $template_label, $excluded_fragment ) ) {
			return false;
		}
	}

	return true;
}


/**
 * Attempt to assign a "Full Width" template to a page.
 *
 * Supports both classic page templates and block theme templates.
 * Can skip specific templates, such as Elementor "Elementor Full Width"
 * or templates containing "Wide Image".
 *
 * @param int   $post_id Page ID.
 * @param array $args    Optional arguments:
 *                       - excluded_title_parts             array  Fragments excluded from template labels.
 *                       - excluded_classic_template_files  array  Classic template file names to skip.
 *                       - force_elementor_default_template bool   Whether to force Elementor "Theme/Default".
 *
 * @return bool True if a template was assigned, or Elementor default was forced as fallback.
 */
function wpbc_try_assign_full_width_template( $post_id, $args = array() ) {

	if ( empty( $post_id ) || is_wp_error( $post_id ) ) {
		return false;
	}

	$post = get_post( $post_id );

	if ( ( ! $post ) || ( 'page' !== $post->post_type ) ) {
		return false;
	}

	$defaults = array(
		'excluded_title_parts'            => array( 'wide image' ),
		'excluded_classic_template_files' => array( 'elementor_header_footer' ),
		'force_elementor_default_template' => false,
	);

	$args = wp_parse_args( $args, $defaults );

	$excluded_title_parts            = array_map( 'strtolower', (array) $args['excluded_title_parts'] );
	$excluded_classic_template_files = array_map( 'strtolower', (array) $args['excluded_classic_template_files'] );

	$is_elementor_full_width_skipped = false;

	// -------------------------------------------------------------------------
	// Classic themes: scan page templates.
	// get_page_templates() returns template file names keyed by template header.
	// -------------------------------------------------------------------------
	if ( function_exists( 'get_page_templates' ) ) {

		$classic_templates = get_page_templates( $post, 'page' );

		foreach ( $classic_templates as $template_name => $template_file ) {

			if ( ! wpbc_is_full_width_template_candidate( $template_name, $excluded_title_parts ) ) {
				continue;
			}

			$template_file_lc = strtolower( (string) $template_file );

			if ( in_array( $template_file_lc, $excluded_classic_template_files, true ) ) {

				if ( 'elementor_header_footer' === $template_file_lc ) {
					$is_elementor_full_width_skipped = true;
				}

				continue;
			}

			update_post_meta( $post_id, '_wp_page_template', $template_file );

			return true;
		}
	}

	// -------------------------------------------------------------------------
	// Block themes: scan block templates for pages.
	// -------------------------------------------------------------------------
	if ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() && function_exists( 'get_block_templates' ) ) {

		$theme_slug = get_stylesheet();
		$templates  = get_block_templates(
			array(
				'post_type' => 'page',
			),
			'wp_template'
		);

		foreach ( $templates as $template ) {

			if ( empty( $template->title ) || empty( $template->slug ) ) {
				continue;
			}

			if ( $theme_slug !== $template->theme ) {
				continue;
			}

			if ( ! wpbc_is_full_width_template_candidate( $template->title, $excluded_title_parts ) ) {
				continue;
			}

			wp_update_post(
				array(
					'ID'            => $post_id,
					'page_template' => $template->slug,
				)
			);

			return true;
		}
	}

	/*
	 * If the only match we found was Elementor Full Width, optionally force
	 * Elementor's default page template instead.
	 */
	if ( $args['force_elementor_default_template'] && $is_elementor_full_width_skipped ) {
		return wpbc_set_elementor_default_page_template( $post_id );
	}

	return false;
}


/**
 * Set Elementor page layout to its default "Theme" template.
 *
 * This should be treated as a fallback for Elementor-managed pages.
 *
 * @param int $post_id Page ID.
 *
 * @return bool
 */
function wpbc_set_elementor_default_page_template( $post_id ) {

	if ( empty( $post_id ) || is_wp_error( $post_id ) ) {
		return false;
	}

	// Make sure WordPress itself does not have a forced classic template.
	delete_post_meta( $post_id, '_wp_page_template' );

	// If Elementor is not active, nothing else to do.
	if ( ( ! defined( 'ELEMENTOR_VERSION' ) ) && ( ! did_action( 'elementor/loaded' ) ) ) {
		return true;
	}

	$elementor_page_settings = get_post_meta( $post_id, '_elementor_page_settings', true );

	if ( ! is_array( $elementor_page_settings ) ) {
		$elementor_page_settings = array();
	}

	$elementor_page_settings['default_page_template'] = 'default';

	update_post_meta( $post_id, '_elementor_page_settings', $elementor_page_settings );

	return true;
}


/**
 * Is shortcode or some text  exist  in specific page
 *
 * @param string $relative_url     relative URL of the page, if we have absolute url, then get it using: wpbc_make_link_relative( 'https://...' );
 * @param string $shortcode_to_add shortcode  to  check '[booking'
 *
 * @return bool
 */
function wpbc_is_shortcode_exist_in_page( $relative_url, $shortcode_to_add ) {

	if ( ! empty( $relative_url ) ) {

		$post_obj = get_page_by_path( $relative_url );

		if ( ! empty( $post_obj ) ) {
			if ( false !== strpos( $post_obj->post_content, $shortcode_to_add ) ) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Is shortcode or some text  exist  in specific page (got by  ID)
 *
 * @param string $relative_url     relative URL of the page, if we have absolute url, then get it using: wpbc_make_link_relative( 'https://...' );
 * @param string $shortcode_to_add shortcode  to  check '[booking'
 *
 * @return bool
 */
function wpbc_is_shortcode_exist_in_page_with_id( $page_id, $shortcode_to_add ) {

	// FixIn: 10.12.3.1.

	if ( ! empty( $page_id ) ) {

		$post_obj = get_post( $page_id );

		if ( ! empty( $post_obj ) ) {
			if ( false !== strpos( $post_obj->post_content, $shortcode_to_add ) ) {
				return true;
			}
		}
	}

	return false;
}


/**
 * Add shortcode, if it does not exist yet, to the page
 *
 * @param string $relative_url     relative URL of the page, if we have absolute url, then get it using: wpbc_make_link_relative( 'https://...' );
 * @param string $shortcode_to_add shortcode '[bookingedit]'
 *
 * @return bool
 */
function wpbc_add_shortcode_to_exist_page( $relative_url, $shortcode_to_add ) {

	if ( ! empty( $relative_url ) ) {

		$post_obj = get_page_by_path( $relative_url );

		if ( ! empty( $post_obj ) ) {
			if ( false === strpos( $post_obj->post_content, $shortcode_to_add ) ) {                        // No  such  shortcode in this page. So we need to Add it.

				$my_post = array(
 								  'ID'           => $post_obj->ID,
								  'post_content' => $post_obj->post_content . "\r\n" . $shortcode_to_add
							   );
				wp_update_post( $my_post );                                                                             // Update the post into the database

				return true;
			}
		}
	}

	return false;
}


// ---------------------------------------------------------------------------------------------------------------------

/**
 * Create new page or add to existing page the shortcode
 *
 * @param array $params
 *
 * @return array Success or failure response. Publishing restrictions return a
 *               failure before WordPress page lookup or mutation.
 *
 *  Example:
 *           $result_arr = wpbc_add_shortcode_into_page( array(
 *                                                      'shortcode'  => '[booking resource_id=1]',
 *                                                      'post_title' => 'Booking Form'
 *                                              ) );
 */
function wpbc_add_shortcode_into_page( $params = array() ) {
	/* Enforce the publishing policy at the canonical writer for every caller. */
	if ( wpbc_is_booking_form_publishing_restricted() ) {
		return array(
			'result'  => false,
			'message' => __( 'In the demo versions this operation is not allowed.', 'booking' ),
		);
	}

	$defaults = array(
						'page_post_name'        => '',              // 'wpbc-booking',
						'post_title'            => esc_html( __( 'Booking Form', 'booking' ) ),
						'shortcode'             => '[booking resource_id=1]',
						'check_exist_shortcode' => '[booking',                      // can be an array:  array( '[booking resource_id=1]', '[booking type=1]', '[booking]' )
						'page_id'               => 0,
						'resource_id'           => 0            // Optional
					);
	$params   = wp_parse_args( $params, $defaults );

	if ( empty( $params['page_post_name'] ) ) {
		$params['page_post_name'] = sanitize_title( $params['post_title'] );        // Get slug for the page
	}


	global $wp_rewrite;
	if ( is_null( $wp_rewrite ) ) {
		return array( 'result' => false, 'message' => 'Sorry, we are unable to insert the shortcode into the page. The reason is that wp_rewrite is not initialized.' );
	}
	// -----------------------------------------------------------------------------------------------------------------

	$params['page_id'] = intval( $params['page_id'] );
	if ( ! empty( $params['page_id'] ) ) {
		$wp_post = get_post( $params['page_id'] );
	} else {
		$wp_post = get_page_by_path( $params['page_post_name'] );
	}

	$relative_post_url = '';

	$post_title = '';
	$post_url   = '';
	if ( ! empty( $wp_post ) ) {
		$post_title = $wp_post->post_title;
		$post_url = get_permalink( $wp_post->ID );
	}

	if ( empty( $wp_post ) ) {                                                                                          // No default page.  Create it.

		$page_params = array(
			'post_title'   => $params['post_title'],
			'post_content' => $params['shortcode'],
			'post_name'    => $params['page_post_name']
		);
		$post_id = wpbc_create_page( $page_params );

		if ( ! empty( $post_id ) ) {

			$new_post = get_post( $post_id );
			if ( ! empty( $new_post ) ) {
				$post_title = $new_post->post_title;
				$post_url = get_permalink( $new_post->ID );
			}

			$relative_post_url = wpbc_make_link_relative( get_permalink(  $post_id ) );

			// Scroll to  the booking form.
			if ( ! empty( $params['resource_id'] ) ) {
				$post_url .= '#bklnk' . $params['resource_id'];
			}

			return array( 'result'       => true,
			              'relative_url' => $relative_post_url,
			              /* translators: 1: ... */
			              'message'      => __( 'A new page has been created.', 'booking' ) . ' ' . sprintf( __( 'The booking form shortcode %1$s has been embedded into the page %2$s', 'booking' )
		                                    , "<code class='wpbc_inserted_shortcode_view'>{$params['shortcode']}</code>"
							                , "<a class='wpbc_open_page_as_new_tab' href='" . esc_url( $post_url ) . "'>{$post_title}</a>"
						                    . " <a target='_blank' class='wpbc_open_page_as_new_tab tooltip_top wpbc-bi-arrow-up-right-square' href='" . esc_url( $post_url ) . "' title='" . esc_attr( __( 'Open in new window', 'booking' ) ) . "'></a>"
										)
			);
		}

	} else {
		$relative_post_url = wpbc_make_link_relative( get_permalink(  $wp_post->ID ) );                                          // Page already exist,  so we need to update the
	}

	// Check  if the shortcode in the page
	$is_shortcode_already_in_page = false;
	if ( is_array( $params['check_exist_shortcode'] ) ) {
		foreach ( $params['check_exist_shortcode'] as $check_shortcode ) {
			$is_shortcode_already_in_page = wpbc_is_shortcode_exist_in_page( $relative_post_url, $check_shortcode );
			if ( $is_shortcode_already_in_page ) {
				break;
			}
		}
	} else {
		$is_shortcode_already_in_page = wpbc_is_shortcode_exist_in_page( $relative_post_url, $params['check_exist_shortcode'] );
	}

	// Scroll to  the booking form.
	if ( ! empty( $params['resource_id'] ) ) {
		$post_url .= '#bklnk' . $params['resource_id'];
	}

	// Check  if existing page has our shortcode. We are checking for 'booking'  because it can  be '[booking]' or '[booking type=1]' ...
	if (
		   ( ! $is_shortcode_already_in_page )
		&& ( ! wpbc_is_shortcode_exist_in_page( $relative_post_url, $params['shortcode'] ) )
	) {
		$is_sh_added = wpbc_add_shortcode_to_exist_page( $relative_post_url, $params['shortcode'] );

		if ( $is_sh_added ) {
			return array( 'result'       => true,
			              'relative_url' => $relative_post_url,
			              /* translators: 1: ... */
			              'message'      => sprintf( __( 'The booking form shortcode %1$s has been embedded into the page %2$s', 'booking' )
		                                    , "<code class='wpbc_inserted_shortcode_view'>{$params['shortcode']}</code>"
							                , "<a class='wpbc_open_page_as_new_tab' href='" . esc_url( $post_url ) . "'>{$post_title}</a>"
						                    . " <a target='_blank' class='wpbc_open_page_as_new_tab tooltip_top wpbc-bi-arrow-up-right-square' href='" . esc_url( $post_url ) . "' title='" . esc_attr( __( 'Open in new window', 'booking' ) ) . "'></a>"

										)
			);

		} else {
			return array( 'result'       => false,
			              /* translators: 1: ... */
			              'message'      => sprintf( __( 'We are unable to embed the booking form shortcode %1$s into the page %2$s.', 'booking' )
		                                    , "<code class='wpbc_inserted_shortcode_view'>{$params['shortcode']}</code>"
							                , "<a class='wpbc_open_page_as_new_tab' href='" . esc_url( $post_url ) . "'>{$post_title}</a>"
						                    . " <a target='_blank' class='wpbc_open_page_as_new_tab tooltip_top wpbc-bi-arrow-up-right-square' href='" . esc_url( $post_url ) . "' title='" . esc_attr( __( 'Open in new window', 'booking' ) ) . "'></a>"
										)
			);
		}
	} else {

		return array( 'result'       => false,
		              /* translators: 1: ... */
		              'message'      => sprintf( __( 'The Booking Calendar shortcode %1$s is already present on this page %2$s.', 'booking' )
		                                    , "<code class='wpbc_inserted_shortcode_view'>{$params['shortcode']}</code>"
							                , "<a class='wpbc_open_page_as_new_tab' href='" . esc_url( $post_url ) . "'>{$post_title}</a>"
						                    . " <a target='_blank' class='wpbc_open_page_as_new_tab tooltip_top wpbc-bi-arrow-up-right-square' href='" . esc_url( $post_url ) . "' title='" . esc_attr( __( 'Open in new window', 'booking' ) ) . "'></a>"
										)
		);

	}

}


// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------


/**
 * Get starter booking form/page definitions created during plugin activation.
 *
 * @return array
 */
function wpbc_get_activation_booking_form_page_configs() {

	return array(
		'full_day_booking' => array(
			'template_key'      => 'dates_2_columns_hints_full_days', // 'dates_form_with_inline_hints',	                    // FixIn: 11.8.1.1.
			'form_slug'         => 'full_day_booking',
			'form_title'        => esc_html__( 'Full Day Booking Form', 'booking' ),
			'page_slug'         => 'booking-calendar-full-day',
			'legacy_page_slugs' => array( 'wp-booking-calendar-full-day' ),
			'page_title'        => esc_html__( 'Full Day Booking', 'booking' ),
			'button_title'      => esc_html__( 'Full day booking form', 'booking' ),
		),
		'time_slots_booking' => array(
			'template_key'      => 'time_slots_2_columns_hints',
			'form_slug'         => 'time_slots_booking',
			'form_title'        => esc_html__( 'Time Slots Booking Form', 'booking' ),
			'page_slug'         => 'booking-calendar-time-slots',
			'legacy_page_slugs' => array( 'wp-booking-calendar-time-slots' ),
			'page_title'        => esc_html__( 'Time Slots Booking', 'booking' ),
			'button_title'      => esc_html__( 'Time slots booking form', 'booking' ),
		),
		'time_appointments_booking' => array(
			'template_key' => 'time_appointments_3_steps_review_with_hints',
			'form_slug'    => 'time_appointments_booking',
			'form_title'   => esc_html__( 'Time Appointments Booking Form', 'booking' ),
			'create_page'  => false,
		),
		'appointment_services_booking' => array(
			'template_key'                          => 'appointments_services_flow',
			'form_slug'                             => 'appointment_services_booking',
			'form_title'                            => esc_html__( 'Appointment Services Booking Form', 'booking' ),
			'create_page'                           => false,
			'assign_to_default_appointment_service' => true,
		),
		'contact_form' => array(
			'template_key'      => 'contact_form_simple',
			'form_slug'         => 'contact_form',
			'form_title'        => esc_html__( 'Contact Form', 'booking' ),
			'page_slug'         => 'booking-calendar-contact',
			'legacy_page_slugs' => array( 'wp-booking-calendar-contact' ),
			'page_title'        => esc_html__( 'Contact Form', 'booking' ),
			'button_title'      => esc_html__( 'Contact form', 'booking' ),
		),
	);
}


/**
 * Get starter page definitions created during plugin activation.
 *
	 * Legacy starter pages keep using their dedicated custom booking forms. The
	 * old Time Appointments form and the dedicated Appointment Service form are
	 * form-only fixtures because the Appointment workflow has one canonical page.
 *
 * @return array Starter page definitions keyed by stable purpose.
 */
function wpbc_get_activation_booking_page_configs() {

	$page_configs = wpbc_get_activation_booking_form_page_configs();

	foreach ( $page_configs as $page_key => $page_config ) {
		if ( isset( $page_config['create_page'] ) && false === (bool) $page_config['create_page'] ) {
			unset( $page_configs[ $page_key ] );
			continue;
		}

		$form_slug = '';
		if ( isset( $page_config['form_slug'] ) ) {
			$form_slug = sanitize_text_field( (string) $page_config['form_slug'] );
		}

		if ( '' === $form_slug ) {
			unset( $page_configs[ $page_key ] );
			continue;
		}

		$shortcode = "[booking resource_id=1 form_type='{$form_slug}']";
		$page_configs[ $page_key ]['shortcode'] = $shortcode;
		$page_configs[ $page_key ]['shortcode_checks'] = array(
			$shortcode,
			'[booking resource_id=1 form_type="' . $form_slug . '"]',
		);
		$page_configs[ $page_key ]['resource_id'] = 1;
	}

	$page_configs['appointment_booking'] = array(
		'page_slug'         => 'booking-calendar-appointment',
		'legacy_page_slugs' => array( 'wpbc-appointment-booking' ),
		'page_title'        => esc_html__( 'Book an Appointment', 'booking' ),
		'button_title'      => esc_html__( 'Appointment booking form', 'booking' ),
		'shortcode'         => '[booking_appointment]',
		'shortcode_checks'  => array( '[booking_appointment]', '[booking_appointment ' ),
		'resource_id'       => 0,
	);
	$page_configs['resource_selector_booking'] = array(
		'page_slug'         => 'booking-calendar-resource-selection',
		'legacy_page_slugs' => array(),
		'page_title'        => esc_html__( 'Resource Selection', 'booking' ),
		'button_title'      => esc_html__( 'Resource selection', 'booking' ),
		'shortcode'         => '[booking_resource_selector]',
		'shortcode_checks'  => array( '[booking_resource_selector]', '[booking_resource_selector ' ),
		'resource_id'       => 0,
	);

	return $page_configs;
}


/**
 * Get the Free Booking Received page definition used during initial activation.
 *
 * The legacy slug remains lookup-only so a clean reinstall can reuse a retained
 * page without making legacy URLs canonical for new installations.
 *
 * @return array Confirmation page definition with canonical and legacy slugs.
 */
function wpbc_get_activation_confirmation_page_config() {

	return array(
		'page_slug'         => 'booking-calendar-confirmation',
		'legacy_page_slugs' => array( 'wpbc-booking-received' ),
	);
}


/**
 * Get the Personal-edition customer page definitions used during activation.
 *
 * @return array Personal page definitions keyed by stable purpose.
 */
function wpbc_get_activation_personal_page_configs() {

	return array(
		'manage_booking' => array(
			'page_slug'         => 'booking-calendar-manage-booking',
			'legacy_page_slugs' => array( 'wpbc-my-booking' ),
			'page_title'        => esc_html__( 'My Booking', 'booking' ),
			'shortcode'         => '[bookingedit]',
			'option_name'       => 'booking_url_bookings_edit_by_visitors',
		),
		'my_bookings' => array(
			'page_slug'         => 'booking-calendar-my-bookings',
			'legacy_page_slugs' => array( 'wpbc-my-bookings-listing' ),
			'page_title'        => esc_html__( 'My Bookings Listing', 'booking' ),
			'shortcode'         => '[bookingcustomerlisting]',
			'option_name'       => 'booking_url_bookings_listing_by_customer',
		),
	);
}


/**
 * Get the Business Small payment-result page definitions used during activation.
 *
 * @return array Payment-result definitions keyed by stable outcome.
 */
function wpbc_get_activation_payment_page_configs() {

	return array(
		'success' => array(
			'page_slug'          => 'booking-calendar-payment-success',
			'legacy_page_slugs'  => array( 'wpbc-booking-payment-successful' ),
			'page_title'         => esc_html__( 'Booking Payment Confirmation', 'booking' ),
			'page_content'       => esc_html__( 'Thank you for your booking. Your payment for the booking has been successfully received.', 'booking' )
				. "\r\n\r\n[booking_confirm]",
			'required_shortcode' => '[booking_confirm]',
			'default_url'        => '/successful',
			'option_names'       => array(
				'booking_stripe_v3_order_successful',
				'booking_paypal_std_co_order_successful',
				'booking_paypal_return_url',
				'booking_authorizenet_order_successful',
				'booking_sage_order_successful',
				'booking_redsys_order_successful',
				'booking_ideal_return_url',
				'booking_ipay88_return_url',
			),
		),
		'failed' => array(
			'page_slug'          => 'booking-calendar-payment-failed',
			'legacy_page_slugs'  => array( 'wpbc-booking-payment-failed' ),
			'page_title'         => esc_html__( 'Booking Payment Failed', 'booking' ),
			'page_content'       => esc_html__( 'Payment Unsuccessful. Please contact us for assistance.', 'booking' ),
			'required_shortcode' => '',
			'default_url'        => '/failed',
			'option_names'       => array(
				'booking_stripe_v3_order_failed',
				'booking_paypal_std_co_order_failed',
				'booking_paypal_cancel_return_url',
				'booking_authorizenet_order_failed',
				'booking_sage_order_failed',
				'booking_redsys_order_failed',
				'booking_ideal_cancel_return_url',
				'booking_ipay88_cancel_return_url',
			),
		),
	);
}


/**
 * Check whether an activation payment URL still contains its replaceable default.
 *
 * Missing options and the released placeholder paths may be connected to a
 * newly eligible payment page. Every other value is treated as administrator
 * configuration and must remain unchanged.
 *
 * @param mixed  $configured_url Saved payment return URL, or false when absent.
 * @param string $default_url    Released relative placeholder URL.
 *
 * @return bool True when activation may store the eligible payment page URL.
 */
function wpbc_should_update_activation_payment_url( $configured_url, $default_url ) {

	if ( false === $configured_url ) {
		return true;
	}

	return (string) $default_url === wpbc_make_link_relative( $configured_url );
}


/**
 * Find an existing activation-owned page by its canonical or legacy slug.
 *
 * Canonical slugs are checked first. Legacy aliases are used only to preserve
 * existing pages and prevent duplicates after a full plugin-data reset.
 *
 * @param string $page_slug         Canonical page slug.
 * @param array  $legacy_page_slugs Previously released page slugs.
 *
 * @return WP_Post|null Existing WordPress page, or null when no slug matches.
 */
function wpbc_get_activation_page_by_slugs( $page_slug, $legacy_page_slugs = array() ) {

	$page_slugs = array_merge( array( $page_slug ), (array) $legacy_page_slugs );
	$page_slugs = array_unique( array_filter( array_map( 'sanitize_title', $page_slugs ) ) );

	foreach ( $page_slugs as $candidate_page_slug ) {
		$wp_post = get_page_by_path( $candidate_page_slug, OBJECT, 'page' );

		if ( $wp_post instanceof WP_Post ) {
			return $wp_post;
		}
	}

	return null;
}


/**
 * Get the first published activation page matching a canonical or legacy slug.
 *
 * This read-only lookup is separate from the activation writer lookup because
 * activation must recognize retained non-published pages to avoid duplicates,
 * while public-page navigation must never advertise an inaccessible draft or
 * trashed canonical page when a published legacy page is still available.
 *
 * @param string $page_slug         Canonical activation page slug.
 * @param array  $legacy_page_slugs Previously released lookup-only slugs.
 *
 * @return WP_Post|null Published page, or null when no public match exists.
 */
function wpbc_get_published_activation_page_by_slugs( $page_slug, $legacy_page_slugs = array() ) {

	$page_slugs = array_merge( array( $page_slug ), (array) $legacy_page_slugs );
	$page_slugs = array_unique( array_filter( array_map( 'sanitize_title', $page_slugs ) ) );

	foreach ( $page_slugs as $candidate_page_slug ) {
		$wp_post = get_page_by_path( $candidate_page_slug, OBJECT, 'page' );

		if ( $wp_post instanceof WP_Post && 'publish' === $wp_post->post_status ) {
			return $wp_post;
		}
	}

	return null;
}


/**
 * Get a bundled BFB template record by template key.
 *
 * @param string $template_key Template key.
 *
 * @return array
 */
function wpbc_get_bfb_template_record_by_key( $template_key ) {

	if (
		! function_exists( 'wpbc_bfb_activation__get_templates_registry' ) ||
		! function_exists( 'wpbc_bfb_activation__normalize_template_config' )
	) {
		return array();
	}

	$template_key = sanitize_key( (string) $template_key );
	$templates    = wpbc_bfb_activation__get_templates_registry();

	if ( empty( $templates ) || ! is_array( $templates ) ) {
		return array();
	}

	foreach ( $templates as $template_config ) {

		$template_config = wpbc_bfb_activation__normalize_template_config( $template_config );

		if ( $template_key === $template_config['template_key'] ) {
			return $template_config['record'];
		}
	}

	return array();
}


/**
 * Create starter custom booking forms from bundled BFB templates.
 *
 * @return bool
 */
function wpbc_create_activation_custom_booking_forms() {

	if (
		! function_exists( 'wpbc_is_table_exists' ) ||
		! wpbc_is_table_exists( 'booking_form_structures' ) ||
		! class_exists( 'WPBC_BFB_Form_Storage' )
	) {
		return false;
	}

	$configs = wpbc_get_activation_booking_form_page_configs();
	if ( empty( $configs ) || ! is_array( $configs ) ) {
		return false;
	}

	$is_created = false;

	foreach ( $configs as $config ) {

		$form_slug = sanitize_text_field( (string) $config['form_slug'] );
		if ( '' === $form_slug ) {
			continue;
		}

		$existing_form = WPBC_BFB_Form_Storage::get_current_form_by_key( $form_slug, 0, 'published' );
		if ( ! empty( $existing_form ) ) {
			continue;
		}

		$template_record = wpbc_get_bfb_template_record_by_key( $config['template_key'] );
		if ( empty( $template_record ) ) {
			continue;
		}

		// The predefined Time Slots form must select one calendar day independently, // FixIn: 11.4.3.1
		// from the global/default Calendar Settings day-selection mode.
		if ( 'time_slots_booking' === $form_slug ) {
			$form_settings = array();
			if ( ! empty( $template_record['settings_json'] ) ) {
				$decoded_settings = json_decode( (string) $template_record['settings_json'], true );
				if ( is_array( $decoded_settings ) ) {
					$form_settings = $decoded_settings;
				}
			}

			if ( empty( $form_settings['options'] ) || ! is_array( $form_settings['options'] ) ) {
				$form_settings['options'] = array();
			}

			$form_settings['options']['booking_type_of_day_selections'] = 'single';
			$template_record['settings_json'] = function_exists( 'wpbc_form_config__encode_json' )
				? wpbc_form_config__encode_json( $form_settings )
				: wp_json_encode( $form_settings );
		}

		$template_record['form_slug']           = $form_slug;
		$template_record['status']              = 'published';
		$template_record['scope']               = 'global';
		$template_record['owner_user_id']       = 0;
		$template_record['booking_resource_id'] = null;
		$template_record['is_default']          = 0;
		$template_record['title']               = $config['form_title'];
		$template_record['picture_url']         = isset( $template_record['picture_url'] ) ? (string) $template_record['picture_url'] : '';
		if ( function_exists( 'wpbc_bfb_resolve_picture_url' ) ) {
			$template_record['picture_url'] = wpbc_bfb_resolve_picture_url( $template_record['picture_url'] );
		}

		$booking_form_id = WPBC_BFB_Form_Storage::save_form( $template_record );
		if ( ! empty( $booking_form_id ) ) {
			$is_created = true;
		}
	}

	return $is_created;
}


/**
 * Return the ordered activation-page level for a Booking Calendar edition.
 *
 * The ordering is intentionally limited to product editions. Page groups use
 * these levels to determine whether a paid activation has crossed the edition
 * boundary that first makes those pages available.
 *
 * @param string $edition_id Booking Calendar edition identifier.
 *
 * @return int Edition level, or -1 when the identifier is not supported.
 */
function wpbc_get_activation_page_edition_level( $edition_id ) {

	$edition_levels = array(
		'free'      => 0,
		'personal'  => 1,
		'biz_s'     => 2,
		'biz_m'     => 3,
		'biz_l'     => 4,
		'multiuser' => 5,
	);

	$edition_id = (string) $edition_id;

	return isset( $edition_levels[ $edition_id ] ) ? $edition_levels[ $edition_id ] : -1;
}


/**
 * Check whether a paid-edition transition newly unlocks one page group.
 *
 * This pure comparison keeps Free-to-Pro, lower-to-higher, reactivation,
 * update, and downgrade behavior deterministic and independently testable.
 *
 * @param string $previous_edition_id Previously provisioned or detected edition.
 * @param string $current_edition_id  Edition active during this activation.
 * @param string $required_edition_id First edition that owns the page group.
 *
 * @return bool True when this activation crosses the required edition boundary.
 */
function wpbc_is_activation_page_edition_transition( $previous_edition_id, $current_edition_id, $required_edition_id ) {

	$previous_edition_level = wpbc_get_activation_page_edition_level( $previous_edition_id );
	$current_edition_level  = wpbc_get_activation_page_edition_level( $current_edition_id );
	$required_edition_level = wpbc_get_activation_page_edition_level( $required_edition_id );

	if ( 0 > $previous_edition_level || 0 > $current_edition_level || 1 > $required_edition_level ) {
		return false;
	}

	return $previous_edition_level < $required_edition_level
		&& $required_edition_level <= $current_edition_level;
}


/**
 * Check whether activation-owned WordPress pages may be provisioned.
 *
 * Free-owned pages remain restricted to the immutable first-Free-install
 * decision. Paid page groups can additionally opt into the exact Pro edition
 * transition that first makes them available. The Pro activation layer owns
 * that transition state and exposes it through a narrow filter; normal Free or
 * Pro updates therefore remain fail-closed.
 *
 * @param string $required_edition_id First edition that owns the page group.
 *
 * @return bool True only during the qualifying initial activation request.
 */
function wpbc_should_create_activation_pages( $required_edition_id = 'free' ) {
	$required_edition_id    = (string) $required_edition_id;
	$required_edition_level = wpbc_get_activation_page_edition_level( $required_edition_id );

	if ( 0 > $required_edition_level ) {
		return false;
	}

	if ( function_exists( 'wpbc_is_plugin_initial_install' ) && wpbc_is_plugin_initial_install() ) {
		return true;
	}

	if ( 0 === $required_edition_level ) {
		return false;
	}

	/**
	 * Filter whether the current paid-edition activation newly owns a page group.
	 *
	 * @since 11.8.1
	 *
	 * @param bool   $should_create_pages  Fail-closed default decision.
	 * @param string $required_edition_id First edition that owns the page group.
	 */
	return (bool) apply_filters( 'wpbc_should_create_paid_edition_activation_pages', false, $required_edition_id );
}


/**
 * Build starter page content with a booking shortcode.
 *
 * @param string $shortcode Booking shortcode.
 *
 * @return string
 */
function wpbc_get_activation_booking_page_content( $shortcode ) {

	$shortcode = trim( (string) $shortcode );

	if ( WPBC_IS_PLAYGROUND ) {
		$shortcode = '<style type="text/css"> h1, h2, h3, h4, h5, h6 { font-weight: 500; font-family: var(--wp--preset--font-family--body); } </style>' . $shortcode;
	}

	return $shortcode;
}


/**
 * Create new starter pages with booking forms.
 *
 * @param array $default_options_to_add Unused. Kept for backward-compatible direct calls.
 *
 * @return void
 */
function wpbc_create_page_with_booking_form( $default_options_to_add = array() ) {                                                        // FixIn: 9.6.2.11.

	global $wp_rewrite;
	if ( is_null( $wp_rewrite ) ) {                                                                                     // FixIn: 9.7.1.1.

		// Maybe it was not init,  yet.
		if ( ! has_action( 'init', 'wpbc_create_page_with_booking_form' ) ) {
			add_action( 'init', 'wpbc_create_page_with_booking_form', 99 );                                             // <- priority  to  load it last
		}

		return false;
	}

	// -----------------------------------------------------------------------------------------------------------------

	wpbc_create_activation_custom_booking_forms();

	/**
	 * Fires after activation starter custom forms are available.
	 *
	 * Appointment Services uses this boundary to finish its pending starter
	 * Service seed with the newly created form ID.
	 *
	 * @since 11.5.0
	 */
	do_action( 'wpbc_activation_custom_booking_forms_created' );

	if ( ! wpbc_should_create_activation_pages() ) {
		return;
	}

	$configs = wpbc_get_activation_booking_page_configs();
	if ( empty( $configs ) || ! is_array( $configs ) ) {
		return;
	}

	$front_page_id = 0;

	foreach ( $configs as $config ) {

		$shortcode       = isset( $config['shortcode'] ) ? trim( (string) $config['shortcode'] ) : '';
		$shortcode_checks = isset( $config['shortcode_checks'] ) && is_array( $config['shortcode_checks'] )
			? $config['shortcode_checks']
			: array( $shortcode );
		$resource_id     = isset( $config['resource_id'] ) ? absint( $config['resource_id'] ) : 0;

		if ( '' === $shortcode ) {
			continue;
		}

		$content           = wpbc_get_activation_booking_page_content( $shortcode );
		$legacy_page_slugs = isset( $config['legacy_page_slugs'] ) ? (array) $config['legacy_page_slugs'] : array();
		$existing_page     = wpbc_get_activation_page_by_slugs( $config['page_slug'], $legacy_page_slugs );

		$result_arr = wpbc_add_shortcode_into_page(
			array(
				'page_post_name'        => $config['page_slug'],
				'page_id'               => $existing_page instanceof WP_Post ? $existing_page->ID : 0,
				'post_title'            => $config['page_title'],
				'shortcode'             => $content,
				'check_exist_shortcode' => $shortcode_checks,
				'resource_id'           => $resource_id,
			)
		);

		if ( WPBC_IS_PLAYGROUND && empty( $front_page_id ) && ! empty( $result_arr['relative_url'] ) ) {
			$wp_post = wpbc_get_activation_page_by_slugs( $config['page_slug'], $legacy_page_slugs );
			if ( ! empty( $wp_post ) ) {
				$front_page_id = $wp_post->ID;
			}
		}
	}

	if ( WPBC_IS_PLAYGROUND && ! empty( $front_page_id ) ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $front_page_id );
	}
}
add_action( 'wpbc_bfb_activation__form_structures_table__after_create', 'wpbc_create_page_with_booking_form', 20 );
add_action( 'wpbc_bfb_activation__form_structures_table__table_already_exists', 'wpbc_create_page_with_booking_form', 20 );


/**
 * Get published starter pages that contain their expected booking form shortcodes.
 *
 * @return array
 */
function wpbc_get_published_activation_booking_pages() {

	$pages   = array();
	$configs = wpbc_get_activation_booking_page_configs();

	if ( empty( $configs ) || ! is_array( $configs ) ) {
		return $pages;
	}

	foreach ( $configs as $key => $config ) {

		$legacy_page_slugs = isset( $config['legacy_page_slugs'] ) ? (array) $config['legacy_page_slugs'] : array();
		$wp_post           = wpbc_get_published_activation_page_by_slugs( $config['page_slug'], $legacy_page_slugs );
		if ( ! ( $wp_post instanceof WP_Post ) ) {
			continue;
		}

		$shortcode_checks = isset( $config['shortcode_checks'] ) && is_array( $config['shortcode_checks'] )
			? $config['shortcode_checks']
			: array();
		$is_shortcode_found = false;

		foreach ( $shortcode_checks as $shortcode_check ) {
			if ( '' === (string) $shortcode_check ) {
				continue;
			}

			if ( wpbc_is_shortcode_exist_in_page_with_id( $wp_post->ID, $shortcode_check ) ) {
				$is_shortcode_found = true;
				break;
			}
		}

		if ( ! $is_shortcode_found ) {
			continue;
		}

		$post_url = get_permalink( $wp_post->ID );
		if ( empty( $post_url ) ) {
			continue;
		}

		$pages[ $key ] = array(
			'url'          => $post_url,
			'button_title' => $config['button_title'],
			'page_title'   => $config['page_title'],
		);
	}

	return $pages;
}

// ---------------------------------------------------------------------------------------------------------------------


/**
 * Create new page and get  URL  of this page
 *
 * @param $default_options_to_add
 *
 * @return void
 */
function wpbc_create_page_thank_you( $default_options_to_add ) {                                                        // FixIn: 9.6.2.11.

	if ( ! wpbc_should_create_activation_pages() ) {
		return false;
	}

	global $wp_rewrite;
	if ( is_null( $wp_rewrite ) ) {                                                                                     // FixIn: 9.7.1.1.

		// Maybe it was not init,  yet
		if ( ! has_action( 'init', 'wpbc_create_page_thank_you' ) ) {
			add_action( 'init', 'wpbc_create_page_thank_you', 99 );                                                     // <- priority  to  load it last
		}
		return false;
	}

	// -----------------------------------------------------------------------------------------------------------------

	$thank_you_page_url = get_bk_option( 'booking_thank_you_page_URL' );

	if (   ( empty( $thank_you_page_url ) )                                                                             // If   No 'Thank you'   page in Settings, or it's set as Empty.
		|| (
				( '/thank-you' == wpbc_make_link_relative( get_bk_option( 'booking_thank_you_page_URL' ) ) )
			 && ( empty( get_page_by_path( 'thank-you' ) ) )                                                            // FixIn: 9.9.0.27.
	       )
		|| ( '/' == wpbc_make_link_relative( get_bk_option( 'booking_thank_you_page_URL' ) ) )
	){
		$confirmation_page_config = wpbc_get_activation_confirmation_page_config();
		$wp_post                  = wpbc_get_activation_page_by_slugs(
			$confirmation_page_config['page_slug'],
			$confirmation_page_config['legacy_page_slugs']
		);

		$post_url = '';

		if ( empty( $wp_post ) ) {                                                                                      // No default page.  Create it.

			$page_params = array(
				'post_title'   => esc_html( __( 'Booking Received', 'booking' ) ),
				'post_content' => esc_html( __( 'Thank you for your booking. Your booking has been successfully received.', 'booking' ) )
                                 .  "\r\n" . ' [booking_confirm]',
				'post_name'    => $confirmation_page_config['page_slug'],
			);
			$post_id = wpbc_create_page( $page_params );

			if ( ! empty( $post_id ) ) {
				$post_url = wpbc_make_link_relative( get_permalink(  $post_id ) );
			}

		} else {
			$post_url = wpbc_make_link_relative( get_permalink(  $wp_post->ID ) );                                      // Page already exist,  so we need to update the
		}

		if ( ! empty( $post_url ) ) {
			update_bk_option( 'booking_thank_you_page_URL', $post_url );
		}
	}

	// -----------------------------------------------------------------------------------------------------------------

	// Check  if existing page has our shortcode
	$relative_url = wpbc_make_link_relative( get_bk_option( 'booking_thank_you_page_URL' ) );
	$is_sh_added  = wpbc_add_shortcode_to_exist_page( $relative_url, '[booking_confirm]' );

}
add_bk_action( 'wpbc_before_activation__add_options', 'wpbc_create_page_thank_you' );



/**
 * Create pages for [bookingedit]  and [bookingcustomerlisting] shortcodes,
 *
 * if previously was not defined options
 * 'booking_url_bookings_edit_by_visitors' and 'booking_url_bookings_listing_by_customer'
 * to some pages different from homepage.
 *
 * @return void
 */
function wpbc_create_page_bookingedit(){                                                                                // FixIn: 9.6.2.10.

	if ( ! wpbc_should_create_activation_pages( 'personal' ) ) {
		return false;
	}

	global $wp_rewrite;
	if ( is_null( $wp_rewrite ) ) {     // FixIn: 9.7.1.1.
		// Maybe it was not init,  yet
		if ( ! has_action( 'init', 'wpbc_create_page_bookingedit' ) ) {
			add_action( 'init', 'wpbc_create_page_bookingedit', 99 );                                                     // <- priority  to  load it last
		}
		return false;
	}

	$page_configs = wpbc_get_activation_personal_page_configs();

	foreach ( $page_configs as $page_config ) {
		$configured_page_url = get_bk_option( $page_config['option_name'] );
		$existing_page       = wpbc_get_activation_page_by_slugs(
			$page_config['page_slug'],
			$page_config['legacy_page_slugs']
		);

		if ( site_url() === $configured_page_url && ! ( $existing_page instanceof WP_Post ) ) {
			$page_id = wpbc_create_page(
				array(
					'post_content' => $page_config['shortcode'],
					'post_name'    => $page_config['page_slug'],
					'post_title'   => $page_config['page_title'],
				)
			);

			if ( ! empty( $page_id ) ) {
				update_bk_option( $page_config['option_name'], get_permalink( $page_id ) );
			}
		} elseif (
			( site_url() === $configured_page_url || empty( $configured_page_url ) )
			&& $existing_page instanceof WP_Post
		) {
			update_bk_option( $page_config['option_name'], get_permalink( $existing_page->ID ) );
		}

		$relative_page_url = wpbc_make_link_relative( get_bk_option( $page_config['option_name'] ) );
		wpbc_add_shortcode_to_exist_page( $relative_page_url, $page_config['shortcode'] );
	}

}


function wpbc_create_page_booking_payment_status(){                                                                     // FixIn: 9.6.2.13.

	if ( ! wpbc_should_create_activation_pages( 'biz_s' ) ) {
		return false;
	}

	global $wp_rewrite;
	if ( is_null( $wp_rewrite ) ) {     // FixIn: 9.7.1.1.
		return false;
	}

	$page_configs = wpbc_get_activation_payment_page_configs();

	foreach ( $page_configs as $page_config ) {
		$existing_page = wpbc_get_activation_page_by_slugs(
			$page_config['page_slug'],
			$page_config['legacy_page_slugs']
		);

		if ( ! ( $existing_page instanceof WP_Post ) ) {
			$page_id = wpbc_create_page(
				array(
					'post_title'   => $page_config['page_title'],
					'post_content' => $page_config['page_content'],
					'post_name'    => $page_config['page_slug'],
				)
			);
			$existing_page = ! empty( $page_id ) ? get_post( $page_id ) : null;
		}

		if ( ! ( $existing_page instanceof WP_Post ) || 'publish' !== $existing_page->post_status ) {
			continue;
		}

		$page_url_relative = wpbc_make_link_relative( get_permalink( $existing_page->ID ) );
		if ( empty( $page_url_relative ) ) {
			continue;
		}

		if ( ! empty( $page_config['required_shortcode'] ) ) {
			wpbc_add_shortcode_to_exist_page( $page_url_relative, $page_config['required_shortcode'] );
		}

		foreach ( $page_config['option_names'] as $option_name ) {
			$configured_url = get_bk_option( $option_name );

			if ( wpbc_should_update_activation_payment_url( $configured_url, $page_config['default_url'] ) ) {
				update_bk_option( $option_name, $page_url_relative );
			}
		}
	}
}
