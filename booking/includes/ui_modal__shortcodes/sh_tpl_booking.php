<?php
/**
 * @version 1.0
 * @package Booking Calendar Shortcodes Config
 * @subpackage Shortcodes Content - Booking Calendar Form e.g.:		[booking resource_id=1 nummonths=3 options='{calendar months_num_in_row=3 width=100% cell_height=50px}']
 * @category Shortcodes
 *
 * @author wpdevelop
 * @link https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2024-01-21
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly			// FixIn: 9.9.0.15.

// =====================================================================================================================
//  Left Navigation Panel
// =====================================================================================================================

/**
 * Left Vertical Navigation panel
 * @return void
 */
function wpbc_shortcode_config__navigation_panel(){

	$wpbm_version         = wpbc_get_wpbm_version();
	$wpbm_minimum_version = '2.1';

	// If lower than 2,  than  show warning
	if ( version_compare( $wpbm_version, $wpbm_minimum_version, '<') ) {
		$is_bm_exist = false;
	} else {
		$is_bm_exist = true;
	}

	?>
	<div class="wpbc_settings_navigation_column wpbc_shortcode_config_navigation_column">
		<div id="wpbc_shortcode_config__nav_tab__booking" class="wpbc_settings_navigation_item wpbc_settings_navigation_item_active">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_booking', 'booking' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'Booking Form with Calendar', 'booking' ) ?></span>
			</a>
		</div>
		<div id="wpbc_shortcode_config__nav_tab__bookingcalendar" class="wpbc_settings_navigation_item wpbc_navigation_sub_item">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_bookingcalendar', 'bookingcalendar' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'Availability Calendar / Days Not Selectable', 'booking' ); ?></span>
			</a>
		</div>
		<?php if ( wpbc_is_11_5_features_enabled() ) : ?>
			<div id="wpbc_shortcode_config__nav_tab__booking_appointment" class="wpbc_settings_navigation_item wpbc_navigation_top_border">
				<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_booking_appointment', 'booking_appointment' );" href="javascript:void(0);">
					<span><?php esc_html_e( 'Appointment Booking', 'booking' ); ?></span>
				</a>
			</div>
			<div id="wpbc_shortcode_config__nav_tab__booking_resource_selector" class="wpbc_settings_navigation_item wpbc_navigation_sub_item">
				<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_booking_resource_selector', 'booking_resource_selector' );" href="javascript:void(0);">
					<span><?php esc_html_e( 'Booking Resource Selector', 'booking' ); ?></span>
				</a>
			</div>
		<?php endif; ?>
		<div id="wpbc_shortcode_config__nav_tab__bookingselect" class="wpbc_settings_navigation_item wpbc_dismiss__booking_select <?php  echo ( ! class_exists( 'wpdev_bk_personal' ) ) ? ' wpbc_settings_navigation_item_disabled ' : '';  ?>">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_bookingselect', 'bookingselect' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'Resource Selection', 'booking' ); ?></span><?php
					echo ( ! class_exists( 'wpdev_bk_personal' ) ) ? '<span class="wpbc_pro_label">Pro</span>' : '';
				?>
			</a>
		</div>
		<div id="wpbc_shortcode_config__nav_tab__bookingform" class="wpbc_settings_navigation_item wpbc_dismiss__booking_form_only <?php  echo ( ! class_exists( 'wpdev_bk_biz_l' ) ) ? ' wpbc_settings_navigation_item_disabled ' : '';  ?>">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_bookingform', 'bookingform' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'Only Form', 'booking' ) ?></span><?php
					if ( ! class_exists( 'wpdev_bk_personal' ) ){
						echo '<span class="wpbc_pro_label">Pro</span>';
					} else{
						echo ( ! class_exists( 'wpdev_bk_biz_l' ) ) ? '<span class="wpbc_pro_label">BL</span>' : '';
					}
				?>
			</a>
		</div>
		<div id="wpbc_shortcode_config__nav_tab__bookingtimeline" class="wpbc_settings_navigation_item wpbc_navigation_top_border">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_bookingtimeline', 'bookingtimeline' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'TimeLine', 'booking' ); ?></span>
			</a>
		</div>
		<div id="wpbc_shortcode_config__nav_tab__bookingsearch" class="wpbc_settings_navigation_item wpbc_dismiss__booking_search <?php  echo ( ! class_exists( 'wpdev_bk_biz_l' ) ) ? ' wpbc_settings_navigation_item_disabled ' : '';  ?>">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_bookingsearch', 'bookingsearch' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'Search Availability', 'booking' ) ?></span><?php
					if ( ! class_exists( 'wpdev_bk_personal' ) ){
						echo '<span class="wpbc_pro_label">Pro</span>';
					} else{
						echo ( ! class_exists( 'wpdev_bk_biz_l' ) ) ? '<span class="wpbc_pro_label">BL</span>' : '';
					}
				?>
			</a>
		</div>
		<div id="wpbc_shortcode_config__nav_tab__bookingother" class="wpbc_settings_navigation_item">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_bookingother', 'bookingother' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'Other', 'booking' ); ?></span><?php
					//echo ( ! class_exists( 'wpdev_bk_personal' ) ) ? '<span class="wpbc_pro_label">Pro</span>' : '';
				?>
			</a>
		</div>
		<?php if ( $is_bm_exist ) { ?>
		<div id="wpbc_shortcode_config__nav_tab__booking_import_ics" class="wpbc_settings_navigation_item wpbc_navigation_top_border">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_booking_import_ics', 'booking_import_ics' );" href="javascript:void(0);">
				<span><?php esc_html_e( 'Import Events (.ics feed)', 'booking' ) ?></span>
			</a>
		</div>
		<div id="wpbc_shortcode_config__nav_tab__booking_listing_ics" class="wpbc_settings_navigation_item wpbc_navigation_sub_item">
			<a onclick="javascript:wpbc_shortcode_config_click_show_section(this,'#wpbc_sc_container__shortcode_booking_listing_ics' , 'booking_listing_ics');" href="javascript:void(0);">
				<span><?php esc_html_e( 'Show .ics Listing of Events', 'booking' ); ?></span>
			</a>
		</div>
		<?php } ?>
	</div>
	<?php
}


// =====================================================================================================================
//  Shortcode [booking ... ]
// =====================================================================================================================

/**
 * Content of PopUp - for shortcode [booking ...]
 *
 * @return void
 */
function wpbc_shortcode_config__content__booking() {

	$shortcode_name = 'booking';

	?><div id="wpbc_sc_container__shortcode_<?php echo esc_attr( $shortcode_name ); ?>" class="wpbc_sc_container__shortcode wpbc_sc_container__shortcode_<?php echo esc_attr( $shortcode_name ); ?> wpbc_sc_container__shortcode_is_active"><?php

		wpbc_shortcode_config__booking__top_tabs();

		// 'General'  --------------------------------------------------------------------------------------------------
		?><div class="wpbc_sc_container__shortcode_section wpbc_sc_container__shortcode_section__general">
			<table class="form-table"><tbody><?php

				// Booking Resource
				wpbc_shortcode_config_fields__select_resource( $shortcode_name . '_wpbc_resource_id', $shortcode_name );

				// Custom form
				wpbc_shortcode_config_fields__select_custom_form( $shortcode_name . '_wpbc_custom_form', $shortcode_name );

				// Number of Months
				wpbc_shortcode_config_fields__select_nummonths( $shortcode_name . '_wpbc_nummonths', $shortcode_name );

				// Calendar Size
				wpbc_shortcode_config_fields__calendar_size( $shortcode_name . '_wpbc_size', $shortcode_name );

				// Open booking form in popup.
				wpbc_shortcode_config_fields__booking_popup( $shortcode_name . '_wpbc_popup', $shortcode_name );

			?></tbody></table>
		</div><?php

		// 'Conditional Days Selection' --------------------------------------------------------------------------------
		?><div class="wpbc_sc_container__shortcode_section wpbc_sc_container__shortcode_section__conditions"><?php

			wpbc_shortcode_config_fields__dates_conditions_toolbar();						// TOOLBAR

			?><div class="wpbc_sc_container__shortcode_subsection wpbc_sc_container__shortcode_subsection__weekdays_conditions">
				<?php
					wpbc_shortcode_config_fields__weekdays_conditions( $shortcode_name . 'wpbc_select_day_weekday', $shortcode_name );
				?>
			</div><?php

			?><div class="wpbc_sc_container__shortcode_subsection wpbc_sc_container__shortcode_subsection__seasons_conditions">
				<?php
					wpbc_shortcode_config_fields__season_conditions( $shortcode_name . 'wpbc_select_day_season', $shortcode_name );
				?>
			</div><?php

			?><div class="wpbc_sc_container__shortcode_subsection wpbc_sc_container__shortcode_subsection__startseason_conditions">
				<?php
					wpbc_shortcode_config_fields__season_start_day_conditions( $shortcode_name . 'wpbc_start_day_season', $shortcode_name )
				?>
			</div><?php

			?><div class="wpbc_sc_container__shortcode_subsection wpbc_sc_container__shortcode_subsection__dates_conditions">
				<?php
					wpbc_shortcode_config_fields__fordate_conditions( $shortcode_name . 'wpbc_select_day_fordate', $shortcode_name );
				?>
			</div><?php

		?></div><?php

		// 'AGGREGATE' -------------------------------------------------------------------------------------------------
		?><div class="wpbc_sc_container__shortcode_section wpbc_sc_container__shortcode_section__aggregate"><?php

				wpbc_shortcode_config_fields__aggregate( $shortcode_name . '_wpbc_aggregate', $shortcode_name );

		?></div><?php

		// 'START MONTH' -----------------------------------------------------------------------------------------------
		?><div class="wpbc_sc_container__shortcode_section wpbc_sc_container__shortcode_section__other"><?php
			?><table class="form-table"><tbody><?php

				wpbc_shortcode_config_fields__calendar_dates_start( $shortcode_name . '_wpbc_calendar_dates_start', $shortcode_name );

				wpbc_shortcode_config_fields__calendar_dates_end( $shortcode_name . '_wpbc_calendar_dates_end', $shortcode_name );

				wpbc_shortcode_config_fields__start_month( $shortcode_name . '_wpbc_startmonth', $shortcode_name );

			?></tbody></table><?php
		?></div><?php



		?>
		<div class="wpbc_shortcode_config_content_toolbar__next_prior">
			<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config_content_toolbar__next_prior(this,'prior');" class="button">
				<span class="in-button-text">&lsaquo;</span>
			</a>
			<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config_content_toolbar__next_prior(this,'next');" class="button">
				<span class="in-button-text">&rsaquo;</span>
			</a>
		</div>
		<?php

	?></div><?php

	wpbc_clear_div();
}


	/**
	 * Top Tabs for shortcode [booking ...]
	 * @return void
	 */
	function wpbc_shortcode_config__booking__top_tabs(){

		$shortcode_name = 'booking';

		wpbc_bs_toolbar_tabs_html_container_start();

			$js = "jQuery(this).parents( '.wpbc_sc_container__shortcode' ).find( '.nav-tab' ).removeClass('nav-tab-active');"
				. "jQuery(this).addClass('nav-tab-active');"
				. "jQuery('.nav-tab i.icon-white').removeClass('icon-white');"
				. "jQuery('.nav-tab-active i').addClass('icon-white');"
				. "jQuery('.wpbc_sc_container__shortcode_" . $shortcode_name . " .wpbc_sc_container__shortcode_section').hide();";

			wpbc_bs_display_tab(   array(
							'title'         => __('Booking Calendar Form', 'booking')
							// , 'hint' => array( 'title' => __('Manage bookings' ,'booking') , 'position' => 'top' )
							, 'onclick'     =>  $js . "jQuery('.wpbc_sc_container__shortcode_" . $shortcode_name . " .wpbc_sc_container__shortcode_section__general').show();"
							, 'font_icon'   => 'wpbc-bi-calendar3-range'
							, 'default'     => true
			) );
			wpbc_bs_display_tab(   array(
							'title'         => __('Conditional Days Selection', 'booking')
							// , 'hint' => array( 'title' => __('Manage bookings' ,'booking') , 'position' => 'top' )
							, 'onclick'     =>  $js . "jQuery('.wpbc_sc_container__shortcode_" . $shortcode_name . " .wpbc_sc_container__shortcode_section__conditions').show();"
							, 'font_icon'   => 'wpbc-bi-calendar2-week'
							, 'default'     => false
							, 'css_classes' => 'wpbc_dismiss__conditional_days'
			) );
			wpbc_bs_display_tab(   array(
							'title'         => __('Aggregate', 'booking')
							// , 'hint' => array( 'title' => __('Manage bookings' ,'booking') , 'position' => 'top' )
							, 'onclick'     =>  $js . "jQuery('.wpbc_sc_container__shortcode_" . $shortcode_name . " .wpbc_sc_container__shortcode_section__aggregate').show();"
							, 'font_icon'   => 'wpbc-bi-calendar2-plus'
							, 'default'     => false
							, 'css_classes' => 'wpbc_dismiss__booking_param_aggregate'
			) );
			wpbc_bs_display_tab(   array(
							'title'         => __('Advanced', 'booking')
							// , 'hint' => array( 'title' => __('Manage bookings' ,'booking') , 'position' => 'top' )
							, 'onclick'     =>  $js . "jQuery('.wpbc_sc_container__shortcode_" . $shortcode_name . " .wpbc_sc_container__shortcode_section__other').show();"
							, 'font_icon'   => 'wpbc_icn_tune'
							, 'default'     => false

			) );

		wpbc_bs_toolbar_tabs_html_container_end();
	}



// =====================================================================================================================
//  Fields
// =====================================================================================================================

	/**
	 * Shortcode Field:  Select-box - "Booking Resource"
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__select_resource( $id , $group_key ){

			if ( class_exists( 'wpdev_bk_personal' ) ){

				WPBC_Settings_API::field_select_row_static( $id
															, array(
																	  'type'              => 'select'
																	, 'title'             => __( 'Booking resource', 'booking')
																	, 'description'       => __( 'Select booking resource', 'booking' )
																	, 'description_tag'   => 'span'
																	, 'label'             => ''
																	, 'multiple'          => false
																	, 'group'             => $group_key
																	, 'tr_class'          => $group_key . '_standard_section'
																	, 'class'             => ''
																	, 'css'               => 'margin-right:10px;'
																	, 'only_field'        => false
																	, 'attr'              => array()
																	, 'value'             => ''
																	, 'options'           => wpbc_get_all_booking_resources_list()
															) );
			}

	}

	/**
	 * Shortcode Field:  Select-box - "Custom Booking Form"
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__select_custom_form( $id , $group_key ){

			WPBC_FE_Custom_Form_Helper::wpbc_bfb__custom_booking_forms_list__selectbox_html__sh_modal(
				array(
					'name'        => $id,
					'title'       => __( 'Booking Form', 'booking' ),
					'description' => __( 'Select custom booking form', 'booking' ),
					'group'       => $group_key,
				)
			);
	}

	/**
	 * Shortcode Field:  Select-box - "Calendar Months Number"
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__select_nummonths( $id , $group_key ){

		WPBC_Settings_API::field_select_row_static(   $id
													, array(
															  'type'              => 'select'
															, 'title'             => __('Visible months', 'booking')
															, 'description'       => __('Select number of month to show for calendar.' ,'booking')
															, 'description_tag'   => 'span'
															, 'label'             => ''
															, 'multiple'          => false
															, 'group'             => $group_key
															, 'tr_class'          => $group_key . '_standard_section'
															, 'class'             => ''
															, 'css'               => 'margin-right:10px;'
															, 'only_field'        => false
															, 'attr'              => array()
															, 'value'             => get_bk_option( 'booking_client_cal_count' )
															, 'options'           => array_combine( range( 1, 12 ), range( 1, 12 ) )
														)
						);
	}

	/**
	 * Shortcode Fields:  OPTION - "Define Calendar Size"
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__calendar_size( $id , $group_key ){

			// ---------------------------------------------------------------------------------------------------------
			WPBC_Settings_API::field_checkbox_row_static( $id . '_enabled'
														, array(
																  'type'              => 'checkbox'
																, 'title'             => __('Setup Size & Structure', 'booking')
																, 'description'       => __('Configure Calendar Size and Structure', 'booking')
																, 'description_tag'   => 'span'
																, 'label'             => ''
																, 'class'             => ''
																, 'css'               => ''
																, 'tr_class'          => ''
																, 'attr'              => array()
																, 'group'             => $group_key
																, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed'
																, 'only_field'        => !true
																, 'is_new_line'       => false
																, 'value'             => false
															)
					);

			WPBC_Settings_API::field_select_row_static(   $id . '_months_num_in_row'
														, array(
																  'type'              => 'select'
																, 'title'             => __('Number of months in a row', 'booking')
																, 'description'       => __('Select the number of months to show in one row on a wide screen.' ,'booking')
																, 'description_tag'   => 'span'
																, 'label'             => ''
																, 'multiple'          => false
																, 'group'             => $group_key
																, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed ' . $id . '_wpbc_sc_calendar_size'
																, 'class'             => ''
																, 'css'               => 'margin-right:10px;'
																, 'only_field'        => false
																, 'attr'              => array()
																, 'value'             => get_bk_option( 'booking_client_cal_count' )
																, 'options'           => array_combine( range( 1, 6 ), range( 1, 6 ) )
															)
							);

				?><tr valign="top"  class="<?php echo esc_attr( $group_key . '_standard_section' ); ?> wpbc_sub_settings_grayed <?php echo esc_attr( $id ); ?>_wpbc_sc_calendar_size">
					<th scope="row" style="vertical-align: middle;">
						<label for="wpbc_booking_width" class="wpbc-form-text"><?php esc_html_e('Calendar width:', 'booking'); ?></label>
					</th>
					<td class=""><fieldset><?php

						WPBC_Settings_API::field_text_row_static( $id . '_calendar_width'
															, array(
																	  'type'              => 'text'
																	, 'placeholder'       => '100'
																	, 'class'             => ''
																	, 'css'               => 'width:5em;'
																	, 'only_field'        => true
																	, 'attr'              => array()
																	, 'value'             => '100'
																)
											);
						WPBC_Settings_API::field_select_row_static(  $id . '_calendar_width_px_pr'
																	, array(
																			  'type'              => 'select'
																			, 'multiple'          => false
																			, 'class'             => ''
																			, 'css'               => 'width:4em;'
																			, 'only_field'        => true
																			, 'attr'              => array()
																			, 'value'             => '%'
																			, 'options'           => array( 'px' => 'px', '%'  => '%' )
																		)
										);
						?><span class="description"> <?php esc_html_e('Set width of calendar' ,'booking'); ?></span></fieldset></td>
				</tr><?php

				?><tr valign="top" class="<?php echo esc_attr( $group_key . '_standard_section' ); ?> wpbc_sub_settings_grayed <?php echo esc_attr( $id ); ?>_wpbc_sc_calendar_size">
					<th scope="row" style="vertical-align: middle;"><label for="wpbc_booking_cell_height" class="wpbc-form-text"><?php esc_html_e('Calendar cell height:', 'booking'); ?></label></th>
					<td class="">
						<fieldset><?php

							WPBC_Settings_API::field_text_row_static( $id . '_calendar_cell_height'
															, array(
																	  'type'              => 'text'
																	, 'placeholder'       => '50'
																	, 'class'             => ''
																	, 'css'               => 'width:5em;'
																	, 'only_field'        => true
																	, 'attr'              => array()
																	, 'value'             => '50'
																)
											);
							WPBC_Settings_API::field_select_row_static(  $id . '_calendar_cell_height_px_pr'
																	, array(
																			  'type'              => 'select'
																			, 'multiple'          => false
																			, 'class'             => ''
																			, 'css'               => 'width:4em;'
																			, 'only_field'        => true
																			, 'attr'              => array()
																			, 'value'             => '%'
																			, 'options'           => array( 'px' => 'px' )
																		)
										);
							?><span class="description"> <?php esc_html_e('Set cell height for calendar' ,'booking'); ?></span>
						</fieldset>
					</td>
				</tr><?php

	}

	/**
	 * Shortcode Fields: Open booking form in popup.
	 *
	 * @param string $id        Field ID prefix.
	 * @param string $group_key Shortcode group key.
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__booking_popup( $id, $group_key ) {

		WPBC_Settings_API::field_checkbox_row_static( $id . '_enabled'
													, array(
															  'type'              => 'checkbox'
															, 'title'             => __( 'Open in popup', 'booking' )
															, 'description'       => __( 'Show a button that opens the booking form in a popup window.', 'booking' )
															, 'description_tag'   => 'span'
															, 'label'             => ''
															, 'class'             => ''
															, 'css'               => ''
															, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed'
															, 'attr'              => array()
															, 'group'             => $group_key
															, 'only_field'        => false
															, 'is_new_line'       => false
															, 'value'             => false
														)
					);

		WPBC_Settings_API::field_text_row_static( $id . '_button_title'
												, array(
														  'type'              => 'text'
														, 'title'             => __( 'Button title', 'booking' )
														, 'description'       => __( 'Text on the button that opens the booking form popup.', 'booking' )
														, 'description_tag'   => 'span'
														, 'placeholder'       => __( 'Book now', 'booking' )
														, 'class'             => ''
														, 'css'               => ''
														, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed ' . $id . '_wpbc_sc_booking_popup'
														, 'attr'              => array()
														, 'group'             => $group_key
														, 'only_field'        => false
														, 'value'             => __( 'Book now', 'booking' )
													)
					);

		WPBC_Settings_API::field_text_row_static( $id . '_title'
												, array(
														  'type'              => 'text'
														, 'title'             => __( 'Popup title', 'booking' )
														, 'description'       => __( 'Title displayed in the popup header.', 'booking' )
														, 'description_tag'   => 'span'
														, 'placeholder'       => __( 'Booking Form', 'booking' )
														, 'class'             => ''
														, 'css'               => ''
														, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed ' . $id . '_wpbc_sc_booking_popup'
														, 'attr'              => array()
														, 'group'             => $group_key
														, 'only_field'        => false
														, 'value'             => __( 'Booking Form', 'booking' )
													)
					);

		WPBC_Settings_API::field_text_row_static( $id . '_button_class'
												, array(
														  'type'              => 'text'
														, 'title'             => __( 'Button CSS class', 'booking' )
														, 'description'       => __( 'CSS class for the popup button.', 'booking' )
														, 'description_tag'   => 'span'
														, 'placeholder'       => 'wp-element-button'
														, 'class'             => ''
														, 'css'               => ''
														, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed ' . $id . '_wpbc_sc_booking_popup'
														, 'attr'              => array()
														, 'group'             => $group_key
														, 'only_field'        => false
														, 'value'             => 'wp-element-button'
													)
					);

		WPBC_Settings_API::field_text_row_static( $id . '_modal_class'
												, array(
														  'type'              => 'text'
														, 'title'             => __( 'Popup CSS class', 'booking' )
														, 'description'       => __( 'Optional CSS class for the popup modal.', 'booking' )
														, 'description_tag'   => 'span'
														, 'placeholder'       => ''
														, 'class'             => ''
														, 'css'               => ''
														, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed ' . $id . '_wpbc_sc_booking_popup'
														, 'attr'              => array()
														, 'group'             => $group_key
														, 'only_field'        => false
														, 'value'             => ''
													)
					);

		WPBC_Settings_API::field_select_row_static( $id . '_size'
													, array(
															  'type'              => 'select'
															, 'title'             => __( 'Popup size', 'booking' )
															, 'description'       => __( 'Select the popup window size.', 'booking' )
															, 'description_tag'   => 'span'
															, 'label'             => ''
															, 'multiple'          => false
															, 'group'             => $group_key
															, 'tr_class'          => $group_key . '_standard_section wpbc_sub_settings_grayed ' . $id . '_wpbc_sc_booking_popup'
															, 'class'             => ''
															, 'css'               => 'margin-right:10px;'
															, 'only_field'        => false
															, 'attr'              => array()
															, 'value'             => 'lg'
															, 'options'           => array(
																'lg'      => __( 'Large', 'booking' ),
																'default' => __( 'Default', 'booking' ),
																'sm'      => __( 'Small', 'booking' ),
															)
														)
						);
	}

	/**
	 * Shortcode Fields:  Start Month
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__start_month( $id , $group_key ){

			////////////////////////////////////////////////////////////////////
			// Start Month
			////////////////////////////////////////////////////////////////////
			?><tr valign="top" class="<?php echo esc_attr( $group_key . '_standard_section' ); ?>">
				<th scope="row" style="vertical-align: middle;"><label for="<?php echo esc_attr( $id ); ?>_active" class="wpbc-form-text"><?php esc_html_e('Start month:', 'booking'); ?></label></th>
				<td class=""><fieldset><?php

					WPBC_Settings_API::field_checkbox_row_static( $id . '_active'
																, array(
																		  'type'              => 'checkbox'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'class'             => ''
																		, 'css'               => ''
																		, 'tr_class'          => ''
																		, 'attr'              => array()
																		, 'group'             => $group_key
																		, 'only_field'        => true
																		, 'is_new_line'       => false
																		, 'value'             => false
																	)
							);

					WPBC_Settings_API::field_select_row_static(  $id . '_year'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:5em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => gmdate( 'Y' )
																		, 'options'           => array_combine( range( ( gmdate('Y') - 1 ), ( gmdate('Y') + 10 ) ), range( ( gmdate('Y') - 1 ), ( gmdate('Y') + 10 ) )  )
																	)
									);
					?><span class="description" style="font-weight:600;flex:0;margin: 3px 0.5em 0.5em 0;"> / </span><?php

					WPBC_Settings_API::field_select_row_static(  $id . '_month'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:4em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => gmdate('n')
																		, 'options'           => array_combine( range( 1, 12 ), range( 1, 12 ) )
																	)
									);

					?><span class="description"> <?php esc_html_e('Select start month of calendar' ,'booking'); ?></span></fieldset></td>
			</tr><?php

	}


	/**
	 * Shortcode Fields:  Start Dates
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__calendar_dates_start( $id , $group_key ){

			?><tr valign="top" class="<?php echo esc_attr( $group_key . '_standard_section' ); ?>">
				<th scope="row" style="vertical-align: middle;"><label for="<?php echo esc_attr( $id ); ?>_active" class="wpbc-form-text"><?php
						esc_html_e('Start dates', 'booking'); ?></label></th>
				<td class=""><fieldset><?php

					WPBC_Settings_API::field_checkbox_row_static( $id . '_active'
																, array(
																		  'type'              => 'checkbox'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'class'             => ''
																		, 'css'               => ''
																		, 'tr_class'          => ''
																		, 'attr'              => array()
																		, 'group'             => $group_key
																		, 'only_field'        => true
																		, 'is_new_line'       => false
																		, 'value'             => false
																	)
							);

					WPBC_Settings_API::field_select_row_static(  $id . '_year'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:5em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => gmdate( 'Y' )
																		, 'options'           => array_combine( range( ( gmdate('Y') - 1 ), ( gmdate('Y') + 10 ) ), range( ( gmdate('Y') - 1 ), ( gmdate('Y') + 10 ) )  )
																	)
									);

					?><span class="description" style="font-weight:600;flex:0;margin: 3px 0.5em 0.5em 0;"> / </span><?php

					WPBC_Settings_API::field_select_row_static(  $id . '_month'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:4em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => gmdate('m')
																		, 'options'           => array_combine(
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 12 ) ),
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 12 ) )
																								)
																	)
									);


					?><span class="description" style="font-weight:600;flex:0;margin: 3px 0.5em 0.5em 0;"> / </span><?php

					WPBC_Settings_API::field_select_row_static(  $id . '_date'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:4em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => gmdate('d')
																		, 'options'           => array_combine(
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 31 ) ),
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 31 ) )
																								)

																	)
									);

					?><span class="description"> <?php esc_html_e('Earliest date visible/selectable in the calendar.' ,'booking'); ?></span></fieldset></td>
			</tr><?php
	}


	/**
	 * Shortcode Fields:  End  Dates
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__calendar_dates_end( $id , $group_key ){

			?><tr valign="top" class="<?php echo esc_attr( $group_key . '_standard_section' ); ?>">
				<th scope="row" style="vertical-align: middle;"><label for="<?php echo esc_attr( $id ); ?>_active" class="wpbc-form-text"><?php
						esc_html_e('End dates', 'booking'); ?></label></th>
				<td class=""><fieldset><?php

					WPBC_Settings_API::field_checkbox_row_static( $id . '_active'
																, array(
																		  'type'              => 'checkbox'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'class'             => ''
																		, 'css'               => ''
																		, 'tr_class'          => ''
																		, 'attr'              => array()
																		, 'group'             => $group_key
																		, 'only_field'        => true
																		, 'is_new_line'       => false
																		, 'value'             => false
																	)
							);

					WPBC_Settings_API::field_select_row_static(  $id . '_year'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:5em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => intval( gmdate( 'Y' ) ) + 2
																		, 'options'           => array_combine( range( ( gmdate('Y') - 1 ), ( gmdate('Y') + 10 ) ), range( ( gmdate('Y') - 1 ), ( gmdate('Y') + 10 ) )  )
																	)
									);

					?><span class="description" style="font-weight:600;flex:0;margin: 3px 0.5em 0.5em 0;"> / </span><?php

					WPBC_Settings_API::field_select_row_static(  $id . '_month'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:4em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => gmdate('m')
																		, 'options'           => array_combine(
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 12 ) ),
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 12 ) )
																								)

																	)
									);


					?><span class="description" style="font-weight:600;flex:0;margin: 3px 0.5em 0.5em 0;"> / </span><?php

					WPBC_Settings_API::field_select_row_static(  $id . '_date'
																, array(
																		  'type'              => 'select'
																		, 'title'             => ''
																		, 'description'       => ''
																		, 'description_tag'   => 'span'
																		, 'label'             => ''
																		, 'multiple'          => false
																		, 'group'             => $group_key
																		, 'class'             => ''
																		, 'css'               => 'width:4em;'
																		, 'only_field'        => true
																		, 'attr'              => array()
																		, 'value'             => gmdate('d')
																		, 'options'           => array_combine(
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 31 ) ),
																									array_map( function ( $v ) { return str_pad( $v, 2, '0', STR_PAD_LEFT ); }, range( 1, 31 ) )
																								)

																	)
									);

					?><span class="description"> <?php esc_html_e('Latest date visible/selectable in the calendar.' ,'booking'); ?></span></fieldset></td>
			</tr><?php
	}



	/**
	 * Shortcode Fields:  AGGREGATE
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__aggregate( $id , $group_key ){

			//--------------------------------------------------------------------------------------------------------------
			// 'Upgrade to Pro' widget
			//--------------------------------------------------------------------------------------------------------------
			$upgrade_content_arr = wpbc_get_upgrade_widget( array(
									'id'                 => 'widget_wpbc_dismiss__booking_param_aggregate',
									'dismiss_css_class'  => '.wpbc_dismiss__booking_param_aggregate',
									'blured_in_versions' => array( 'free' ),
									'feature_link'       => array( 'title' => 'feature', 'relative_url' => 'overview/#booking-resources' ),
									'upgrade_link'       => array( 'title' => 'Upgrade to Pro', 'relative_url' => 'features/#bk_news_section' ),
									'versions'           => 'paid versions',
									'css'                => 'transform: translate(0) translateY(180px);'
								) );
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			echo $upgrade_content_arr['content'];

			//--------------------------------------------------------------------------------------------------------------
			// Real Content
			//--------------------------------------------------------------------------------------------------------------

			$resources_list = array();
			if ( class_exists( 'wpdev_bk_personal' ) ){
				$resources_list_orig = wpbc_get_all_booking_resources_list();

				$resources_list[0] = array( 'title' => __('None', 'booking' ), 'attr' => array ( 'class' => 'wpbc_single_resource', 'style' => 'border-bottom:1px dashed #ddd;') );
				foreach ($resources_list_orig as $res_id => $res_val) {
					$resources_list[$res_id] = $res_val;
				}
			}

			?>
			<div class="clear"></div>
			<div class="wpbc-settings-notice0 notice-info notice-header" style="font-size: 15px;font-weight: 600;margin: 15px 0 15px 15px;">
				<label for="<?php echo esc_attr($id); ?>"><?php esc_html_e( 'Aggregate booking dates from other resources', 'booking' ); ?></label>
			</div>

			<div class="wpbc_shortcode_config__rules_container wpbc_dismiss__booking_param_aggregate <?php echo esc_attr( $upgrade_content_arr['maybe_blur_css_class'] ); ?>">
				<div class="wpbc_shortcode_config__rules__params_section 		wpbc_aggregate">

						<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
							<div class="ui_container ui_container_mini">
								<div class="ui_group">
									<div class="ui_element wpdevelop"><?php

										WPBC_Settings_API::field_select_row_static(  $id //.  '__aggregate'
																					, array(
																							  'type'              => 'select'
																							, 'title'             => __('Aggregate booking dates from other resources', 'booking')
																							, 'description'       => ''//__( 'Select booking resources, for getting booking dates from them and set such dates as unavailable in destination calendar.', 'booking' )
																							, 'description_tag'   => 'span'
																							, 'label'             => ''
																							, 'multiple'          => true
																							, 'group'             => $group_key
																							, 'tr_class'          => ''//$group_key . '_advanced_section'
																							, 'class'             => 'wpbc_ui_control wpbc_ui_select'
																							, 'css'               => 'margin-right:10px;height:20em;min-width:15em;'
																							, 'only_field'        => true
																							, 'attr'              => array()
																							, 'value'             => '0'
																							, 'options'           => $resources_list
																						)
														);



									?></div>
								</div>
							</div>
						</div>
						<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
							<div class="ui_container ui_container_mini 		ui_container_weekdays">
								<div class="ui_group  	ui_group_weekdays_checkboxes">
									<div class="ui_element"><?php

										WPBC_Settings_API::field_checkbox_row_static( $id . '__bookings_only'
																			, array(
																					  'type'              => 'checkbox'
																					, 'title'             => ''
																					, 'description'       => ''
																					, 'description_tag'   => 'span'
																					, 'label'             => __( 'Aggregate only bookings', 'booking' )
																					, 'class'             => ''
																					, 'css'               => ''
																					, 'tr_class'          => ''
																					, 'attr'              => array()
																					, 'group'             => $group_key
																					, 'only_field'        => true
																					, 'is_new_line'       => false
																					, 'value'             => false		//// FixIn: 10.0.0.6.
																				)
																		);
									?></div>
								</div>
							</div>
						</div>
				</div>
				<div class="wpbc_shortcode_config__rules__help_section" style="margin-top: 8px;">
					<div class="wpbc-settings-notice notice-info notice-list">
						<ol>
							<li>
								<?php esc_html_e( "Show dates as booked in the current calendar if such dates are unavailable in one of the selected resources.", 'booking' ); ?>
							</li>
							<li>
								<?php
								echo esc_html__( 'To set this up, select one or multiple booking resources in the multi-select box.', 'booking' )
											. '<br>'
											. esc_html__( 'Hold down the Ctrl button to make multiple selections.', 'booking' );

								echo ' <strong>' . esc_html__( 'Code Example', 'booking' ) . ': </strong>'
												. '<code>[booking resource_id=1 aggregate=\'3;5;9\']</code>';
								?>

							</li>

							<li>
								<?php
								 /* translators: 1: ... */
								 echo wp_kses_post( sprintf( __( 'Enable %1$sAggregate only bookings%2$s option to  aggregate only bookings without including unavailable dates from the %3$s page.', 'booking' )
											 , '<strong>', '</strong>'
											, '<strong>Booking > Availability > Days Availability</strong>'
								 ) );
								?>

								<?php
								 echo ' <strong>' . esc_html__( 'Code Example', 'booking' ) . ': </strong>'
								 			, '<code>[booking resource_id=1 aggregate=\'3;5;9\' options=\'{aggregate type=bookings_only}\']</code>';

								?>
							</li>
							<li>
								<?php
								/* translators: 1: ... */
								echo wp_kses_post( sprintf(	__( 'Check the FAQ for details on %1$sshortcode configuration%2$s, especially this %3$soption%4$s.' , 'booking' )
										, '<a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/" target="_blank">', '</a>'
										, '<strong><a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/#booking-options-start-day-condition" target="_blank">', '</a></strong>' ) );
								?>
							</li>
						</ol>
					</div>
				</div>
			</div><?php


	}



	// -----------------------------------------------------------------------------------------------------------------


	function wpbc_shortcode_config_fields__dates_conditions_toolbar(){

		?><div class="clear"></div><?php
		?><div class="wpdevelop wpdvlp-nav-tabs-container wpbc_shortcode_config_fields__dates_conditions_toolbar"><?php

			$js = "jQuery(this).parents( '.wpbc_shortcode_config_fields__dates_conditions_toolbar' ).find( '.nav-tab' ).removeClass('wpdevelop-submenu-tab-selected');
				   jQuery(this).addClass('wpdevelop-submenu-tab-selected');
				   jQuery('.nav-tab i.icon-white').removeClass('icon-white');
				   jQuery('.nav-tab-active i').addClass('icon-white');
				   jQuery(this).parents('.wpbc_sc_container__shortcode_section').find('.wpbc_sc_container__shortcode_subsection').hide();
				   jQuery(this).parents('.wpbc_sc_container__shortcode_section')";

		  	wpbc_bs_toolbar_sub_html_container_start();

				?><a class="nav-tab wpdevelop-submenu-tab tooltip_top wpdevelop-submenu-tab-selected wpbc_dismiss__conditional_days"
				     onclick="javascript:<?php
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo $js; ?>.find('.wpbc_sc_container__shortcode_subsection__weekdays_conditions').show();"	href="javascript:void(0)"
				   ><span class="nav-tab-text"><i class="menu_icon icon-1x wpbc-bi-calendar2-week"></i>&nbsp;&nbsp;<?php
						esc_html_e( 'Weekdays Conditions', 'booking' );
					?></span></a><?php

				?><a class="nav-tab wpdevelop-submenu-tab tooltip_top wpbc_dismiss__conditional_days"
				     onclick="javascript:<?php
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo $js; ?>.find('.wpbc_sc_container__shortcode_subsection__seasons_conditions').show();"	href="javascript:void(0)"
				   ><span class="nav-tab-text"><i class="menu_icon icon-1x wpbc-bi-calendar2-month"></i>&nbsp;&nbsp;<?php
						esc_html_e( 'Seasons Conditions', 'booking' );
					?></span></a><?php

				?><a class="nav-tab wpdevelop-submenu-tab tooltip_top wpbc_dismiss__conditional_days"
				     onclick="javascript:<?php
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo $js; ?>.find('.wpbc_sc_container__shortcode_subsection__startseason_conditions').show();"	href="javascript:void(0)"
				   ><span class="nav-tab-text"><i class="menu_icon icon-1x wpbc-bi-calendar2-day"></i>&nbsp;&nbsp;<?php
						esc_html_e( 'Start selection at Seasons', 'booking' );
					?></span></a><?php

				?><a class="nav-tab wpdevelop-submenu-tab tooltip_top wpbc_dismiss__conditional_days"
				     onclick="javascript:<?php
	// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo $js; ?>.find('.wpbc_sc_container__shortcode_subsection__dates_conditions').show();"	href="javascript:void(0)"
				   ><span class="nav-tab-text"><i class="menu_icon icon-1x wpbc-bi-calendar2-date"></i>&nbsp;&nbsp;<?php
						esc_html_e( 'Dates selection Conditions', 'booking' );
					?></span></a><?php

 		wpbc_bs_toolbar_sub_html_container_end();

		?>
		</div><?php
	}


	/**
	 * Week Days - Condition fields for 'option' parameter.
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__weekdays_conditions( $id , $group_key ){

		//--------------------------------------------------------------------------------------------------------------
		// 'Upgrade to Pro' widget
		//--------------------------------------------------------------------------------------------------------------
		$upgrade_content_arr = wpbc_get_upgrade_widget( array(
								'id'                 => $id . '_' . 'conditional_days_weekdays',
								'dismiss_css_class'  => '.wpbc_dismiss__conditional_days',
								'blured_in_versions' => array( 'free', 'ps', 'bs' ),
								'feature_link'       => array( 'title' => 'feature', 'relative_url' => 'overview/#advanced-days-selection' ),
								'upgrade_link'       => array( 'title' => 'Upgrade to Pro', 'relative_url' => 'features/#bk_news_section' ),
								'versions'           => 'Business Medium / Large, MultiUser versions',
								'css'                => 'transform: translate(0) translateY(120px);'
							) );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $upgrade_content_arr['content'];

		//--------------------------------------------------------------------------------------------------------------
		// Conditions for Weekdays selection
		//--------------------------------------------------------------------------------------------------------------
		?><div class="wpbc_shortcode_config__rules_container wpbc_dismiss__conditional_days <?php echo esc_attr( $upgrade_content_arr['maybe_blur_css_class'] ); ?>">

			<div class="wpbc_shortcode_config__rules__params_section 		wpbc_select_day_weekday">

				<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
					<div class="ui_container ui_container_mini 		ui_container_weekdays">
						<?php

							$week_days_arr = array(
												  1 => __( 'Mo', 'booking' )
												, 2 => __( 'Tu', 'booking' )
												, 3 => __( 'We', 'booking' )
												, 4 => __( 'Th', 'booking' )
												, 5 => __( 'Fr', 'booking' )
												, 6 => __( 'Sa', 'booking' )
												, 0 => __( 'Su', 'booking' )
											);
							foreach ( $week_days_arr as $weekday_key => $weekday_title ) {

								?><div class="ui_group  	ui_group_weekdays_checkboxes"><?php

									?><div class="ui_element"><?php

										WPBC_Settings_API::field_checkbox_row_static( $id . '__weekday_' . $weekday_key
																			, array(
																					  'type'              => 'checkbox'
																					, 'title'             => ''
																					, 'description'       => ''
																					, 'description_tag'   => 'span'
																					, 'label'             => $weekday_title
																					, 'class'             => ''
																					, 'css'               => ''
																					, 'tr_class'          => ''
																					, 'attr'              => array()
																					, 'group'             => $group_key
																					, 'only_field'        => true
																					, 'is_new_line'       => false
																					, 'value'             => false
																				)
															);

									?></div>
									<div class="ui_element"><?php

										$placeholder = '';
										switch ( $weekday_key ) {
											case 0: $placeholder = '1-7'; break;
											case 1: $placeholder = '5,7'; break;
											case 2: $placeholder = '3,4'; break;
											case 3: $placeholder = '5'; break;
											case 4: $placeholder = '4'; break;
											case 5: $placeholder = '3'; break;
											case 6: $placeholder = '2-7'; break;
										}

										WPBC_Settings_API::field_text_row_static(   $id . '__days_number_' . $weekday_key
																			, array(
																				  'type'              => 'text'
																				, 'placeholder'       => $placeholder
																				, 'class'             => 'wpbc_dates_conditions_value_weekday'
																				, 'css'               => ''
																				, 'only_field'        => true
																				, 'attr'              => array()
																				, 'value'             => ''
																			)
											);

									?></div>
									<div class="ui_element"><?php
										?><div class="wpbc_ui_control" style="line-height: 2;"><?php esc_html_e('days to select' ,'booking'); ?></div><?php
									?></div><?php

								?></div><?php
							}

					?>
					</div>
				</div>

				<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
					<div class="ui_container ui_container_mini">
						<div class="ui_group"><?php

							?><div class="ui_element">
								<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__select_day_weekday__add('<?php echo esc_attr( $id ); ?>');" class="button button-primary"><?php esc_html_e( 'Set Rule', 'booking' ); ?></a>
							</div><?php
							?><div class="ui_element">
								<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__select_day_weekday__reset('<?php echo esc_attr( $id ); ?>');"
								   class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger" ><?php esc_html_e('Reset','booking'); ?></a>
							</div><?php

						?>
						</div>
					</div>
				</div>

			</div>

			<div class="wpbc_shortcode_config__rules__help_section">
				<div class="wpbc-settings-notice notice-info notice-header">
					<span><?php esc_html_e( 'Specify the number of days to select when starting the selection on a specific weekday.', 'booking' ); ?></span>
				</div>
				<div class="wpbc-settings-notice notice-info notice-list">
					<ol>
						<li>
							<?php esc_html_e( "For example, a visitor can choose to book only 5 or 7 days starting on Monday, or any number from 2 to 7 days starting on Saturday, and so forth. To configure this, check the 'Monday' box and set the number of days to select as '5,7'. Then, check the 'Saturday' box and set the number of days to select as '2-7'. Finally, click the 'Set Rule' button.", 'booking' ); ?>
						</li>
						<li>
							<?php
							echo '<strong>' . esc_html__( 'Code Example', 'booking' ) . ': </strong>'
											. '<code>{select-day condition="weekday" for="1" value="5,7"},{select-day condition="weekday" for="6" value="2-7"}</code>';
							?>
						</li>
						<li>
							<?php
							/* translators: 1: ... */
							echo wp_kses_post( sprintf(	__( 'Check the FAQ for details on %1$sshortcode configuration%2$s, especially this %3$soption%4$s.' , 'booking' )
									, '<a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/" target="_blank">', '</a>'
									, '<strong><a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/#booking-options-condition" target="_blank">', '</a></strong>' ) );
							?>
						</li>
						<li>
							<?php
							 /* translators: 1: ... */
							 echo wp_kses_post( sprintf( __( 'Explore %1$sJavaScript customization%2$s for advanced different day selection in different calendars.', 'booking' )
										, '<a href="https://wpbookingcalendar.com/faq/advanced-javascript-for-the-booking-shortcodes/" target="_blank">','</a>') );
							?>
						</li>
					</ol>
				</div>
				<textarea id="<?php echo esc_attr( $id ); ?>_textarea" name="<?php echo esc_attr( $id ); ?>_textarea" style="width:100%;margin-top:15px;"></textarea>
			</div>
		</div><?php

	}


	/**
	 * Season Days  Selection - Condition fields for 'option' parameter.
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__season_conditions( $id, $group_key ) {

		//--------------------------------------------------------------------------------------------------------------
		// 'Upgrade to Pro' widget
		//--------------------------------------------------------------------------------------------------------------
		$upgrade_content_arr = wpbc_get_upgrade_widget( array(
								'id'                 => $id . '_' . 'conditional_days_seasons',
								'dismiss_css_class'  => '.wpbc_dismiss__conditional_days',
								'blured_in_versions' => array( 'free', 'ps', 'bs' ),
								'feature_link'       => array( 'title' => 'feature', 'relative_url' => 'overview/#advanced-days-selection' ),
								'upgrade_link'       => array( 'title' => 'Upgrade to Pro', 'relative_url' => 'features/#bk_news_section' ),
								'versions'           => 'Business Medium / Large, MultiUser versions',
								'css'                => 'transform: translate(0) translateY(120px);'
							) );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $upgrade_content_arr['content'];

		//--------------------------------------------------------------------------------------------------------------
		// Conditions for Seasons days selection
		//--------------------------------------------------------------------------------------------------------------

		$options = wpbc_shortcode_config_fields__get_options_for_seasons();

		?><div class="wpbc_shortcode_config__rules_container wpbc_dismiss__conditional_days  <?php echo esc_attr( $upgrade_content_arr['maybe_blur_css_class'] ); ?>">
				<div class="wpbc_shortcode_config__rules__params_section 		wpbc_select_day_season">

					<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
						<div class="ui_container ui_container_mini">
							<div class="ui_group">

								<div class="ui_element">
									<div class="wpbc_ui_control" style="line-height: 2;">
										<span><?php esc_html_e('In season' ,'booking'); ?></span>
									</div>
								</div>

								<div class="ui_element wpdevelop"><?php
									WPBC_Settings_API::field_select_row_static( $id . '__season_filter_name'
																						, array(
																								  'type'              => 'select'
																								, 'title'             => ''
																								, 'label'             => ''
																								, 'disabled'          => false
																								, 'disabled_options'  => array()
																								, 'multiple'          => false
																								, 'description'       => ''
																								, 'description_tag'   => 'span'
																								, 'group'             => $group_key
																								, 'tr_class'          => ''
																								, 'class'             => 'wpbc_ui_control wpbc_ui_select'
																								, 'css'               => 'max-width: Min(14em, 100%);flex: 0 1 auto;width: 14em;border-radius:3px 0 0 3px;'
																								, 'only_field'        => true
																								, 'attr'              => array()
																								, 'value'             => '0'
																								, 'options'           => $options
																							)
																				);
									?><a href="<?php echo esc_url( wpbc_get_availability_url() . '' ); ?>"
										 title="<?php echo esc_attr( __( 'Add new season', 'booking' ) ); ?>"
									   class="wpbc_ui_control wpbc_ui_button tooltip_top" ><i class="menu_icon icon-1x wpbc_icn_add _circle_outline"></i></a><?php
								?></div>

							</div>
						</div>

						<div class="ui_container ui_container_mini">
							<div class="ui_group">

								<div class="ui_element">
									<div class="wpbc_ui_control " style="line-height: 2;"><?php esc_html_e('allow to select' ,'booking'); ?></div>
								</div>

								<div class="ui_element"><?php
										WPBC_Settings_API::field_text_row_static(   $id . '__days_number'
																			, array(
																				  'type'              => 'text'
																				, 'placeholder'       => '5 ' . __( 'or', 'booking' ) . ' 1-7 ' . __( 'or', 'booking' ) . ' 1,5,7'
																				, 'class'             => 'wpbc_ui_control wpbc_ui_text'
																				, 'css'               => 'width:9em;border-radius:3px;'
																				, 'only_field'        => true
																				, 'attr'              => array()
																				, 'value'             => ''
																			)
											);
								?></div>

								<div class="ui_element">
									<div class="wpbc_ui_control" style="line-height: 2;"><?php esc_html_e('days' ,'booking'); ?></div>
								</div>
							</div>
						</div>

						<div class="ui_container ui_container_mini">
							<div class="ui_group">

								<div class="ui_element">
									<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__select_day_season__add('<?php echo esc_attr( $id ); ?>');"
											   class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_primary" ><?php esc_html_e('Add Rule','booking'); ?></a>
								</div>
								<div class="ui_element">
									<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__select_day_season__reset('<?php echo esc_attr( $id ); ?>');"
											   class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger" ><?php esc_html_e('Reset','booking'); ?></a>
								</div>
							</div>
						</div>

					</div>
				</div>
				<div class="wpbc_shortcode_config__rules__help_section">
					<div class="wpbc-settings-notice notice-info notice-header">
						<span><?php esc_html_e( 'Specify the number of days to select when starting the selection in a specific season.', 'booking' ); ?></span>
					</div>
					<div class="wpbc-settings-notice notice-info notice-list">
						<ol>
							<li>
								<?php esc_html_e( "For example, a visitor can choose to book any number from 7 to 14 days or 21 days starting on 'High season', or any number from 2 to 5 days starting on 'Low season', and so forth. To configure this, select the 'High season' option in the dropdown menu and set the number of days to select as '7-14,21'. Click the 'Add Rule' button. Next, select the 'Low season' option in the dropdown menu and set the number of days to select as '2-5'. Click the 'Add Rule' button again.", 'booking' ); ?>
							</li>
							<li>
								<?php
								echo '<strong>' . esc_html__( 'Code Example', 'booking' ) . ': </strong>'
												. '<code>{select-day condition="season" for="High season" value="7-14,21"},{select-day condition="season" for="Low season" value="2-5"}</code>';
								?>
							</li>
							<li>
								<?php
								/* translators: 1: ... */
								echo wp_kses_post( sprintf(	__( 'Check the FAQ for details on %1$sshortcode configuration%2$s, especially this %3$soption%4$s.' , 'booking' )
										, '<a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/" target="_blank">', '</a>'
										, '<strong><a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/#booking-options-condition-seasons" target="_blank">', '</a></strong>' ) );
								?>
							</li>
							<li>
								<?php
								 /* translators: 1: ... */
								 echo wp_kses_post( sprintf( __( 'Explore %1$sJavaScript customization%2$s for advanced different day selection in different calendars.', 'booking' )
											, '<a href="https://wpbookingcalendar.com/faq/advanced-javascript-for-the-booking-shortcodes/" target="_blank">','</a>') );
								?>
							</li>
						</ol>
					</div>
					<textarea id="<?php echo esc_attr( $id ); ?>_textarea" name="<?php echo esc_attr( $id ); ?>_textarea" style="width:100%;margin:10px 0;"></textarea>
				</div>
		</div><?php

	}


		/**
		 * Get Season Filters options  - for selectbox in PopUp shortcode config
		 *
		 * @return array|array[]
		 */
		function wpbc_shortcode_config_fields__get_options_for_seasons(){

			if (function_exists('wpbc_sf_cache')) {
				// -----------------------------------------------------------------------------------------------------------------
				// Get Season Filters data:
				// -----------------------------------------------------------------------------------------------------------------
				$wpbc_sf_cache = wpbc_sf_cache();
				/**
				 * $wpbc_sf_cache->get_data() = [
				 * 1 => [
				 * booking_filter_id = "1"
				 * title = "Weekend"
				 * filter = "a:4:{s:8:"weekdays";a:7..."
				 * users = "1"
				 * id = "1"
				 */
				$season_filter_arr = $wpbc_sf_cache->get_data();
			} else {
				$season_filter_arr = array();
			}
			// $wpbc_br_cache = wpbc_br_cache();
			/*
				$wpbc_br_cache->get_resources() = [
													 1 = [
														  booking_type_id = "1"
														  title = "Standard"
														  users = "1"
														  import = null
														  export = "/ics/wpbm.ics"
														  cost = "25"
														  default_form = "standard"
														  prioritet = "1"
														  parent = "0"
														  visitors = "2"
														  id = "1"
														  count = {int} 5
													 7 = [...
			 */
			$current_user_id  = wpbc_get_current_user_id();

			$options = array(
				0 => array(
					'title' => ' - ' . __( 'Please Select', 'booking' ) . ' - ',
					'attr'  => array( 'style' => 'color:#999;font-weight: 400;' )
				)
			);
			foreach ( $season_filter_arr as $filter_id => $filter_arr ) {

				$options[ $filter_arr['id'] ] = $filter_arr;

				// MultiUser functionality  for regular  users showing season filters.
				if ( ( class_exists( 'wpdev_bk_multiuser' ) ) && ( ! empty( $filter_arr['users'] ) ) ) {

					// Is current user suer booking admin  and if this user was simulated log in
					$season_user_id = intval( $filter_arr['users'] );
					$is_user_super_admin = apply_bk_filter( 'is_user_super_admin', $season_user_id );

					if ( ( ! $is_user_super_admin ) && ( $current_user_id != $season_user_id ) ) {
						$options[ $filter_arr['id'] ]['attr'] = array( 'style' => 'color:#a43232;font-weight: 400;font-style: italic;' );
						$user_name = get_userdata( $season_user_id );
						$user_name = $user_name->display_name;
						$options[ $filter_arr['id'] ]['title'] .= ' &nbsp; (' . __( 'Regular User', 'booking' ) . ': ' . $user_name . ')';
					}
				}
			}

			return $options;

		}


	/**
	 * Season Days  Start Day - Condition fields for 'option' parameter.
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__season_start_day_conditions( $id, $group_key ) {

		//--------------------------------------------------------------------------------------------------------------
		// 'Upgrade to Pro' widget
		//--------------------------------------------------------------------------------------------------------------
		$upgrade_content_arr = wpbc_get_upgrade_widget( array(
								'id'                 => $id . '_' . 'conditional_days_startday',
								'dismiss_css_class'  => '.wpbc_dismiss__conditional_days',
								'blured_in_versions' => array( 'free', 'ps', 'bs' ),
								'feature_link'       => array( 'title' => 'feature', 'relative_url' => 'overview/#advanced-days-selection' ),
								'upgrade_link'       => array( 'title' => 'Upgrade to Pro', 'relative_url' => 'features/#bk_news_section' ),
								'versions'           => 'Business Medium / Large, MultiUser versions',
								'css'                => 'transform: translate(0) translateY(120px);'
							) );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $upgrade_content_arr['content'];

		//--------------------------------------------------------------------------------------------------------------
		// Conditions for Seasons days  START selection
		//--------------------------------------------------------------------------------------------------------------

		$options = wpbc_shortcode_config_fields__get_options_for_seasons();

		?><div class="wpbc_shortcode_config__rules_container wpbc_dismiss__conditional_days  <?php echo esc_attr( $upgrade_content_arr['maybe_blur_css_class'] ); ?>">
			<div class="wpbc_shortcode_config__rules__params_section 		wpbc_start_day_season">

					<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
						<div class="ui_container ui_container_mini">
							<div class="ui_group">
								<div class="ui_element">
									<div class="wpbc_ui_control" style="line-height: 2;">
										<span><?php esc_html_e('In season' ,'booking'); ?></span>
									</div>
								</div>
								<div class="ui_element wpdevelop"><?php

									WPBC_Settings_API::field_select_row_static( $id .  '__season_filter_name'
																				, array(
																						  'type'              => 'select'
																						, 'title'             => ''
																						, 'label'             => ''
																						, 'disabled'          => false
																						, 'disabled_options'  => array()
																						, 'multiple'          => false
																						, 'description'       => ''
																						, 'description_tag'   => 'span'
																						, 'group'             => $group_key
																						, 'tr_class'          => ''
																						, 'class'             => 'wpbc_ui_control wpbc_ui_select'
																						, 'css'               => 'max-width: Min(14em, 100%);flex: 0 1 auto;width: 14em;border-radius:3px 0 0 3px;'
																						, 'only_field'        => true
																						, 'attr'              => array()
																						, 'value'             => '0'
																						, 'options'           => $options
																					)
																		);

									?><a href="<?php echo esc_url( wpbc_get_availability_url() . '' ); ?>"
										 title="<?php echo esc_attr( __( 'Add new season', 'booking' ) ); ?>"
									   class="wpbc_ui_control wpbc_ui_button tooltip_top" ><i class="menu_icon icon-1x wpbc_icn_add _circle_outline"></i></a><?php

								?></div>
							</div>
						</div>
					</div>
					<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
						<div class="ui_container ui_container_mini 		ui_container_weekdays">
							 <div class="ui_group">
								 <div class="ui_element">
									 <div class="wpbc_ui_control " style="line-height: 2;"><?php
										 esc_html_e('allow to start days selection only for these weekdays' ,'booking');
									 ?></div>
								 </div>
							 </div>
							<div class="ui_group  	ui_group_weekdays_checkboxes"><?php

									$week_days_arr = array(
														  1 => __( 'Mo', 'booking' )
														, 2 => __( 'Tu', 'booking' )
														, 3 => __( 'We', 'booking' )
														, 4 => __( 'Th', 'booking' )
														, 5 => __( 'Fr', 'booking' )
														, 6 => __( 'Sa', 'booking' )
														, 0 => __( 'Su', 'booking' )
													);
									foreach ( $week_days_arr as $weekday_key => $weekday_title ) {

										?><div class="ui_element"><?php

											WPBC_Settings_API::field_checkbox_row_static( $id . '__weekday_' . $weekday_key
																				, array(
																						  'type'              => 'checkbox'
																						, 'title'             => ''
																						, 'description'       => ''
																						, 'description_tag'   => 'span'
																						, 'label'             => $weekday_title
																						, 'class'             => ''
																						, 'css'               => ''
																						, 'tr_class'          => ''
																						, 'attr'              => array()
																						, 'group'             => $group_key
																						, 'only_field'        => true
																						, 'is_new_line'       => false
																						, 'value'             => false
																					)
											);
										?></div><?php

									}

							?></div>
						</div>
					</div>
					<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
						<div class="ui_container ui_container_mini">
							<div class="ui_group"><?php

								?><div class="ui_element">
									<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__start_day_season__add('<?php echo esc_attr( $id ); ?>');"
									   class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_primary" ><?php esc_html_e('Add Rule','booking'); ?></a>
								</div><?php
								?><div class="ui_element">
									<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__start_day_season__reset('<?php echo esc_attr( $id ); ?>');"
									   class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger" ><?php esc_html_e('Reset','booking'); ?></a>
								</div><?php

							?>
							</div>
						</div>
					</div>
			</div>
			<div class="wpbc_shortcode_config__rules__help_section">
				<div class="wpbc-settings-notice notice-info notice-header">
					<span><?php esc_html_e( 'Specify the weekdays as start days for selection when starting the selection in a specific season.', 'booking' ); ?></span>
				</div>
				<div class="wpbc-settings-notice notice-info notice-list">
					<ol>
						<li>
							<?php esc_html_e( "For example, a visitor can starting days selection only on 'Sunday' or 'Friday' if select days on 'Low season'. To configure this, select the 'Low season' option in the dropdown menu and enable 'Sunday' and 'Friday' boxes. Click the 'Add Rule' button.", 'booking' ); ?>
						</li>
						<li>
							<?php
							echo '<strong>' . esc_html__( 'Code Example', 'booking' ) . ': </strong>'
											. '<code>{start-day condition="season" for="Low season" value="0,5"}</code>';
							?>
						</li>
						<li>
							<?php
							/* translators: 1: ... */
							echo wp_kses_post( sprintf(	__( 'Check the FAQ for details on %1$sshortcode configuration%2$s, especially this %3$soption%4$s.' , 'booking' )
									, '<a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/" target="_blank">', '</a>'
									, '<strong><a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/#booking-options-start-day-condition" target="_blank">', '</a></strong>' ) );
							?>
						</li>
						<li>
							<?php
							 /* translators: 1: ... */
							 echo wp_kses_post( sprintf( __( 'Explore %1$sJavaScript customization%2$s for advanced different day selection in different calendars.', 'booking' )
										, '<a href="https://wpbookingcalendar.com/faq/advanced-javascript-for-the-booking-shortcodes/" target="_blank">','</a>') );
							?>
						</li>
					</ol>
				</div>
				<textarea id="<?php echo esc_attr( $id ); ?>_textarea" name="<?php echo esc_attr( $id ); ?>_textarea" style="width:100%;margin:10px 0;"></textarea>
			</div>
		</div><?php

	}



	/**
	 * Dates Condition  - Set Number of Days to Select, if start selection on specific date '2024-02-14'
	 *
	 * Config dialog for Booking Calendar shortcode
	 *
	 * @param $id
	 * @param $group_key
	 *
	 * @return void
	 */
	function wpbc_shortcode_config_fields__fordate_conditions( $id, $group_key ) {

		//--------------------------------------------------------------------------------------------------------------
		// 'Upgrade to Pro' widget
		//--------------------------------------------------------------------------------------------------------------
		$upgrade_content_arr = wpbc_get_upgrade_widget( array(
								'id'                 => $id . '_' . 'conditional_days_fordate',
								'dismiss_css_class'  => '.wpbc_dismiss__conditional_days',
								'blured_in_versions' => array( 'free', 'ps', 'bs' ),
								'feature_link'       => array( 'title' => 'feature', 'relative_url' => 'overview/#advanced-days-selection' ),
								'upgrade_link'       => array( 'title' => 'Upgrade to Pro', 'relative_url' => 'features/#bk_news_section' ),
								'versions'           => 'Business Medium / Large, MultiUser versions',
								'css'                => 'transform: translate(0) translateY(120px);'
							) );
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo $upgrade_content_arr['content'];

		//--------------------------------------------------------------------------------------------------------------
		// Conditions for DATE selection
		//--------------------------------------------------------------------------------------------------------------

		?><div class="wpbc_shortcode_config__rules_container wpbc_dismiss__conditional_days  <?php echo esc_attr( $upgrade_content_arr['maybe_blur_css_class'] ); ?>">
			<div class="wpbc_shortcode_config__rules__params_section 		wpbc_select_fordate">

				<div class="wpbc_ajx_toolbar wpbc_no_background wpbc_buttons_row">
					<div class="ui_container ui_container_mini">
						<div class="ui_group">

							<div class="ui_element">
								<div class="wpbc_ui_control" style="line-height: 2;">
									<span><?php esc_html_e('For date' ,'booking'); ?></span>
								</div>
							</div>

							<div class="ui_element wpdevelop"><?php
									WPBC_Settings_API::field_text_row_static(   $id . '__date'
																		, array(
																			  'type'              => 'text'
																			, 'placeholder'       => '2024-02-14'
																			, 'class'             => 'wpbc_ui_control wpbc_ui_text'
																			, 'css'               => 'width:9em;border-radius:3px;'
																			, 'only_field'        => true
																			, 'attr'              => array()
																			, 'value'             => ''
																		)
										);
							?></div>

						</div>
					</div>

					<div class="ui_container ui_container_mini">
						<div class="ui_group">

							<div class="ui_element">
								<div class="wpbc_ui_control " style="line-height: 2;"><?php esc_html_e('allow to select' ,'booking'); ?></div>
							</div>

							<div class="ui_element"><?php
									WPBC_Settings_API::field_text_row_static(   $id . '__days_number'
																		, array(
																			  'type'              => 'text'
																			, 'placeholder'       => '5 ' . __( 'or', 'booking' ) . ' 1-7 ' . __( 'or', 'booking' ) . ' 1,5,7'
																			, 'class'             => 'wpbc_ui_control wpbc_ui_text'
																			, 'css'               => 'width:9em;border-radius:3px;'
																			, 'only_field'        => true
																			, 'attr'              => array()
																			, 'value'             => ''
																		)
										);
							?></div>

							<div class="ui_element">
								<div class="wpbc_ui_control" style="line-height: 2;"><?php esc_html_e('days' ,'booking'); ?></div>
							</div>
						</div>
					</div>

					<div class="ui_container ui_container_mini">
						<div class="ui_group">

							<div class="ui_element">
								<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__select_day_fordate__add('<?php echo esc_attr( $id ); ?>');"
										   class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_primary" ><?php esc_html_e('Add Rule','booking'); ?></a>
							</div>
							<div class="ui_element">
								<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config__select_day_fordate__reset('<?php echo esc_attr( $id ); ?>');"
										   class="wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger" ><?php esc_html_e('Reset','booking'); ?></a>
							</div>
						</div>
					</div>

				</div>
			</div>
			<div class="wpbc_shortcode_config__rules__help_section">
				<div class="wpbc-settings-notice notice-info notice-header">
					<span><?php esc_html_e( 'Specify the number of days to select when starting the selection on a specific date.', 'booking' ); ?></span>
				</div>
				<div class="wpbc-settings-notice notice-info notice-list">
					<ol>
						<li>
							<?php esc_html_e( "For example, a visitor can choose to book 7 or 14 days or 21 days starting on '2027-02-15'. To configure this, enter date in format 'YYYY-MM-DD' such as '2027-02-15' and set the number of days to select as '7,14,21'. Click the 'Add Rule' button.", 'booking' ); ?>
						</li>
						<li>
							<?php
							echo '<strong>' . esc_html__( 'Code Example', 'booking' ) . ': </strong>'
											. '<code>{select-day condition="date" for="2027-02-15" value="7,14,21"}</code>';
							?>
						</li>
						<li>
							<?php
							/* translators: 1: ... */
							echo wp_kses_post( sprintf(	__( 'Check the FAQ for details on %1$sshortcode configuration%2$s, especially this %3$soption%4$s.' , 'booking' )
									, '<a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/" target="_blank">', '</a>'
									, '<strong><a href="https://wpbookingcalendar.com/faq/shortcode-booking-form/#aggregate" target="_blank">', '</a></strong>' ) );
							?>
						</li>
						<li>
							<?php
							 /* translators: 1: ... */
							 echo wp_kses_post( sprintf( __( 'Explore %1$sJavaScript customization%2$s for advanced different day selection in different calendars.', 'booking' )
										, '<a href="https://wpbookingcalendar.com/faq/advanced-javascript-for-the-booking-shortcodes/" target="_blank">','</a>') );
							?>
						</li>
					</ol>
				</div>
				<textarea id="<?php echo esc_attr( $id ); ?>_textarea" name="<?php echo esc_attr( $id ); ?>_textarea" style="width:100%;margin:10px 0;"></textarea>
			</div>
		</div><?php

	}


// =====================================================================================================================
//  Shared fields for modern workflow shortcodes.
// =====================================================================================================================

/**
 * Return Booking Resources in the established shortcode-popup option format.
 *
 * Personal and higher editions already expose the hierarchy-aware resource
 * list used by the legacy shortcode controls. The fallback keeps the default
 * resource selectable in editions where that list is intentionally empty.
 *
 * @param bool   $include_empty Whether to prepend an empty automatic choice.
 * @param string $empty_title   Label for the empty choice.
 *
 * @return array<int|string,array<string,mixed>|string> Booking Resource options.
 */
function wpbc_shortcode_config__workflow_resource_options( $include_empty = false, $empty_title = '' ) {
	$options = array();
	if ( $include_empty ) {
		$options[''] = array(
			'title' => $empty_title ? $empty_title : __( 'No preselection', 'booking' ),
			'attr'  => array( 'class' => 'wpbc_single_resource' ),
		);
	}

	$resource_options = function_exists( 'wpbc_get_all_booking_resources_list' )
		? (array) wpbc_get_all_booking_resources_list()
		: array();
	if ( empty( $resource_options ) && function_exists( 'wpbc_booking_resource_selector_get_catalog' ) ) {
		foreach ( (array) wpbc_booking_resource_selector_get_catalog( array() ) as $resource_id => $resource ) {
			$resource_options[ absint( $resource_id ) ] = array(
				'title' => ! empty( $resource['title'] ) ? $resource['title'] : sprintf( __( 'Booking Resource #%d', 'booking' ), absint( $resource_id ) ),
				'attr'  => array( 'class' => 'wpbc_single_resource' ),
			);
		}
	}
	if ( empty( $resource_options ) && function_exists( 'wpbc_appointment_services_get_provider_options' ) ) {
		foreach ( (array) wpbc_appointment_services_get_provider_options() as $resource_id => $resource_title ) {
			$resource_options[ absint( $resource_id ) ] = array(
				'title' => $resource_title,
				'attr'  => array( 'class' => 'wpbc_single_resource' ),
			);
		}
	}

	return $options + $resource_options;
}

/**
 * Return the automatic, standard, and published Booking Form choices.
 *
 * The empty option is important for both workflow shortcodes: it preserves
 * their automatic Service/Resource form resolution instead of silently
 * forcing the Standard form merely by opening the popup.
 *
 * @return array<string,array<string,mixed>> Booking Form options keyed by public form slug.
 */
function wpbc_shortcode_config__workflow_form_options() {
	$options = array(
		''         => array( 'title' => __( 'Automatic (Service or Resource default)', 'booking' ), 'attr' => array() ),
		'standard' => array( 'title' => __( 'Standard', 'booking' ), 'attr' => array() ),
	);

	if ( ! class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
		return $options;
	}

	$is_allowed = apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
	if ( ! $is_allowed && 'On' !== get_bk_option( 'booking_is_custom_forms_for_regular_users' ) ) {
		return $options;
	}

	$owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();
	$custom_forms  = WPBC_FE_Custom_Form_Helper::get_custom_booking_forms_list(
		array(
			'include_standard' => false,
			'owner_user_id'    => $owner_user_id,
			'statuses'         => array( 'published' ),
			'list_mode'        => 'auto',
		)
	);
	if ( empty( $custom_forms ) ) {
		return $options;
	}

	$options['wpbc_workflow_forms_start'] = array(
		'optgroup' => true,
		'close'    => false,
		'title'    => '&nbsp;' . __( 'Custom Forms', 'booking' ),
	);
	foreach ( $custom_forms as $form_key => $custom_form ) {
		$form_slug = ! empty( $custom_form['name'] ) ? (string) $custom_form['name'] : (string) $form_key;
		if ( '' === $form_slug ) {
			continue;
		}
		$options[ $form_slug ] = array(
			'title' => ! empty( $custom_form['title'] ) ? wpbc_lang( $custom_form['title'] ) : wpbc_lang( $form_slug ),
			'attr'  => array(),
		);
	}
	$options['wpbc_workflow_forms_end'] = array( 'optgroup' => true, 'close' => true );

	return $options;
}

/**
 * Render one modern workflow shortcode parameter using the established settings-row controls.
 *
 * Data attributes on the control provide one serializer contract. Display-text
 * defaults are placed in the input so clearing a value intentionally generates
 * an empty attribute instead of silently restoring the frontend default.
 *
 * @param string              $shortcode_name Shortcode name without brackets.
 * @param string              $parameter_name Public shortcode parameter name.
 * @param array<string,mixed> $field          Field label, description, type, default, and validation metadata.
 *
 * @return void
 */
function wpbc_shortcode_config__workflow_field( $shortcode_name, $parameter_name, $field ) {
	$field = wp_parse_args(
		$field,
		array(
			'title'       => $parameter_name,
			'description' => '',
			'type'        => 'text',
			'value_type'  => 'text',
			'default'     => '',
			'placeholder' => '',
			'options'     => array(),
			'attr'        => array(),
			'css'         => 'width:100%;max-width:32em;',
			'class'       => '',
		)
	);

	$field_id   = $shortcode_name . '_wpbc_' . $parameter_name;
	$field_attr = array_merge(
		(array) $field['attr'],
		array(
			'data-wpbc-shortcode-parameter'  => $parameter_name,
			'data-wpbc-shortcode-default'    => is_bool( $field['default'] ) ? ( $field['default'] ? 'on' : 'off' ) : (string) $field['default'],
			'data-wpbc-shortcode-value-type' => $field['value_type'],
		)
	);
	$description = sprintf(
		/* translators: %s: Shortcode parameter name. */
		__( 'Shortcode parameter: %s', 'booking' ),
		'<code>' . esc_html( $parameter_name ) . '</code>'
	);
	if ( '' !== $field['description'] ) {
		$description .= '<br>' . $field['description'];
	}

	$common_args = array(
		'title'           => $field['title'],
		'description'     => $description,
		'description_tag' => 'span',
		'group'           => $shortcode_name,
		'tr_class'        => $shortcode_name . '_standard_section',
		'class'           => trim( 'wpbc_shortcode_config__workflow_parameter ' . $field['class'] ),
		'css'             => $field['css'],
		'only_field'      => false,
		'attr'            => $field_attr,
	);

	if ( 'checkbox' === $field['type'] ) {
		WPBC_Settings_API::field_checkbox_row_static(
			$field_id,
			array_merge(
				$common_args,
				array(
					'label' => $field['title'],
					'value' => $field['default'] ? 'On' : 'Off',
					'css'   => '',
				)
			)
		);
		return;
	}

	if ( in_array( $field['type'], array( 'select', 'multiselect' ), true ) ) {
		WPBC_Settings_API::field_select_row_static(
			$field_id,
			array_merge(
				$common_args,
				array(
					'value'    => (string) $field['default'],
					'options'  => (array) $field['options'],
					'multiple' => 'multiselect' === $field['type'],
				)
			)
		);
		return;
	}

	WPBC_Settings_API::field_text_row_static(
		$field_id,
		array_merge(
			$common_args,
			array(
				'type'        => 'number' === $field['type'] ? 'number' : 'text',
				'value'       => (string) $field['default'],
				'placeholder' => $field['placeholder'],
			)
		)
	);
}

/**
 * Render top tabs for one modern workflow shortcode configuration.
 *
 * @param string                                  $shortcode_name Shortcode name without brackets.
 * @param array<string,array<string,string|bool>> $tabs           Tab definitions keyed by section ID.
 *
 * @return void
 */
function wpbc_shortcode_config__workflow_tabs( $shortcode_name, $tabs ) {
	wpbc_bs_toolbar_tabs_html_container_start();

	$tab_script = "jQuery(this).parents( '.wpbc_sc_container__shortcode' ).find( '.nav-tab' ).removeClass('nav-tab-active');"
		. "jQuery(this).addClass('nav-tab-active');"
		. "jQuery('.nav-tab i.icon-white').removeClass('icon-white');"
		. "jQuery('.nav-tab-active i').addClass('icon-white');"
		. "jQuery('.wpbc_sc_container__shortcode_" . $shortcode_name . " .wpbc_sc_container__shortcode_section').hide();";

	foreach ( $tabs as $section_id => $tab ) {
		wpbc_bs_display_tab(
			array(
				'title'     => $tab['title'],
				'onclick'   => $tab_script . "jQuery('.wpbc_sc_container__shortcode_" . $shortcode_name . ' .wpbc_sc_container__shortcode_section__' . $section_id . "').show();",
				'font_icon' => $tab['icon'],
				'default'   => ! empty( $tab['default'] ),
			)
		);
	}

	wpbc_bs_toolbar_tabs_html_container_end();
}

/**
 * Render the standard previous/next controls used by shortcode popup sections.
 *
 * @return void
 */
function wpbc_shortcode_config__workflow_pager() {
	?>
	<div class="wpbc_shortcode_config_content_toolbar__next_prior">
		<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config_content_toolbar__next_prior(this,'prior');" class="button">
			<span class="in-button-text">&lsaquo;</span>
		</a>
		<a href="javascript:void(0)" onclick="javascript:wpbc_shortcode_config_content_toolbar__next_prior(this,'next');" class="button">
			<span class="in-button-text">&rsaquo;</span>
		</a>
	</div>
	<?php
}

/**
 * Render a complete parameter reference including compatibility-only aliases.
 *
 * @param array<string,string> $parameters Parameter descriptions keyed by accepted shortcode name.
 *
 * @return void
 */
function wpbc_shortcode_config__workflow_parameter_reference( $parameters ) {
	?>
	<table class="widefat striped wpbc_shortcode_config__parameter_reference">
		<thead>
			<tr>
				<th scope="col"><?php esc_html_e( 'Parameter', 'booking' ); ?></th>
				<th scope="col"><?php esc_html_e( 'Accepted value and behavior', 'booking' ); ?></th>
			</tr>
		</thead>
		<tbody>
			<?php foreach ( $parameters as $parameter_name => $description ) : ?>
				<tr>
					<th scope="row"><code><?php echo esc_html( $parameter_name ); ?></code></th>
					<td><?php echo wp_kses_post( $description ); ?></td>
				</tr>
			<?php endforeach; ?>
		</tbody>
	</table>
	<?php
}


// =====================================================================================================================
//  Shortcode [booking_appointment ...].
// =====================================================================================================================

/**
 * Get the popup field contract for the Appointment shortcode.
 *
 * The keys intentionally match the public parser-backed attribute names. The
 * compatibility aliases are reference-only so newly generated shortcodes use
 * the normalized progress_item_N_* form.
 *
 * @return array<string,array<string,mixed>> Appointment parameter fields.
 */
function wpbc_shortcode_config__booking_appointment_parameters() {
	$month_options = array_combine( range( 1, 24 ), range( 1, 24 ) );

	return array(
		'service_id' => array(
			'section' => 'general', 'title' => __( 'Preselected Service', 'booking' ), 'type' => 'number', 'value_type' => 'positive_integer', 'default' => '',
			'description' => __( 'Preselect and restrict the flow to one positive Service ID.', 'booking' ), 'attr' => array( 'min' => 1, 'step' => 1 ),
		),
		'provider_id' => array(
			'section' => 'general', 'title' => __( 'Preselected Provider', 'booking' ), 'type' => 'select', 'value_type' => 'positive_integer', 'default' => '',
			'options' => wpbc_shortcode_config__workflow_resource_options( true, __( 'No Provider preselected', 'booking' ) ),
			'description' => __( 'Preselect and restrict the flow to one Provider Booking Resource.', 'booking' ),
		),
		'services' => array(
			'section' => 'general', 'title' => __( 'Allowed Services', 'booking' ), 'value_type' => 'id_list', 'default' => '', 'placeholder' => '12,15',
			'description' => __( 'Comma-, semicolon-, or whitespace-separated positive Service IDs, retained in the requested order.', 'booking' ),
		),
		'providers' => array(
			'section' => 'general', 'title' => __( 'Allowed Providers', 'booking' ), 'type' => 'multiselect', 'value_type' => 'id_list', 'default' => '',
			'options' => wpbc_shortcode_config__workflow_resource_options(), 'css' => 'width:100%;max-width:32em;height:12em;',
			'description' => __( 'Select the Provider Booking Resources allowed in this Appointment flow. Leave every option unselected to allow all compatible Providers.', 'booking' ),
		),
		'auto_select_provider' => array(
			'section' => 'general', 'title' => __( 'Auto-select the only Provider', 'booking' ), 'type' => 'checkbox', 'value_type' => 'boolean', 'default' => false,
			'description' => __( 'Skip Provider selection only when exactly one compatible Provider exists.', 'booking' ),
		),
		'nummonths' => array(
			'section' => 'calendar', 'title' => __( 'Visible months', 'booking' ), 'type' => 'select', 'value_type' => 'positive_integer', 'default' => 1, 'options' => $month_options,
			'description' => __( 'Number of calendar months from 1 through 24.', 'booking' ),
		),
		'startmonth' => array(
			'section' => 'calendar', 'title' => __( 'Start month', 'booking' ), 'value_type' => 'month', 'default' => '', 'placeholder' => '2026-08',
			'description' => __( 'Initial calendar month in YYYY-MM, YYYY/MM, or YYYYMM format.', 'booking' ),
		),
		'calendar_dates_start' => array(
			'section' => 'calendar', 'title' => __( 'First calendar date', 'booking' ), 'value_type' => 'date', 'default' => '', 'placeholder' => '2026-08-01',
			'description' => __( 'Inclusive first displayed date in YYYY-MM-DD format.', 'booking' ),
		),
		'calendar_dates_end' => array(
			'section' => 'calendar', 'title' => __( 'Last calendar date', 'booking' ), 'value_type' => 'date', 'default' => '', 'placeholder' => '2026-12-31',
			'description' => __( 'Inclusive last displayed date in YYYY-MM-DD format.', 'booking' ),
		),
		'options' => array(
			'section' => 'calendar', 'title' => __( 'Calendar options', 'booking' ), 'value_type' => 'text', 'default' => '',
			'description' => __( 'Native Booking Calendar options string passed to the resolved calendar and form.', 'booking' ),
		),
		'form_type' => array(
			'section' => 'calendar', 'title' => __( 'Booking Form', 'booking' ), 'type' => 'select', 'value_type' => 'text', 'default' => '',
			'options' => wpbc_shortcode_config__workflow_form_options(),
			'description' => __( 'Select a published Booking Form override. Automatic uses the Service form and then the Standard form.', 'booking' ),
		),
		'allow_past' => array(
			'section' => 'calendar', 'title' => __( 'Allow past bookings', 'booking' ), 'type' => 'checkbox', 'value_type' => 'boolean', 'default' => false,
			'description' => __( 'Permit any visitor to select and submit past dates inside the signed shortcode range.', 'booking' ),
		),
		'show_progress' => array(
			'section' => 'progress', 'title' => __( 'Show progress', 'booking' ), 'type' => 'checkbox', 'value_type' => 'boolean', 'default' => true,
			'description' => __( 'Show the complete numbered Appointment progress line.', 'booking' ),
		),
		'progress_item_1_title' => array(
			'section' => 'progress', 'title' => __( 'First progress title', 'booking' ), 'default' => __( 'Service', 'booking' ),
			'description' => __( 'Title below the first progress number. Clear it to hide the title.', 'booking' ),
		),
		'progress_item_1_number' => array(
			'section' => 'progress', 'title' => __( 'First progress number', 'booking' ), 'default' => '1',
			'description' => __( 'First displayed progress number. Clear it to hide the number.', 'booking' ),
		),
		'progress_item_2_title' => array(
			'section' => 'progress', 'title' => __( 'Second progress title', 'booking' ), 'default' => __( 'Provider', 'booking' ),
			'description' => __( 'Title below the second progress number. Clear it to hide the title.', 'booking' ),
		),
		'progress_item_2_number' => array(
			'section' => 'progress', 'title' => __( 'Second progress number', 'booking' ), 'default' => '2',
			'description' => __( 'Second displayed progress number. Clear it to hide the number.', 'booking' ),
		),
		'progress_item_3_title' => array(
			'section' => 'progress', 'title' => __( 'Third progress title', 'booking' ), 'default' => __( 'Date & Details', 'booking' ),
			'description' => __( 'Title below the third progress number. Clear it to hide the title.', 'booking' ),
		),
		'progress_item_3_number' => array(
			'section' => 'progress', 'title' => __( 'Third progress number', 'booking' ), 'default' => '3',
			'description' => __( 'Third displayed progress number. Clear it to hide the number.', 'booking' ),
		),
		'screen_1_title' => array(
			'section' => 'text', 'title' => __( 'Service screen title', 'booking' ), 'default' => __( 'Choose a Service', 'booking' ),
			'description' => __( 'Heading on the Service selection screen. Clear it to hide the heading.', 'booking' ),
		),
		'screen_1_description' => array(
			'section' => 'text', 'title' => __( 'Service screen description', 'booking' ), 'default' => __( 'Select what you would like to book.', 'booking' ),
			'description' => __( 'Description on the Service selection screen. Clear it to hide the description.', 'booking' ),
		),
		'screen_2_title' => array(
			'section' => 'text', 'title' => __( 'Provider screen title', 'booking' ), 'default' => __( 'Choose a Provider', 'booking' ),
			'description' => __( 'Heading on the Provider selection screen. Clear it to hide the heading.', 'booking' ),
		),
		'screen_2_description' => array(
			'section' => 'text', 'title' => __( 'Provider screen description', 'booking' ), 'default' => __( 'Select who will provide this Service.', 'booking' ),
			'description' => __( 'Description on the Provider selection screen. Clear it to hide the description.', 'booking' ),
		),
	);
}

/**
 * Get every accepted public Appointment shortcode parameter for the reference tab.
 *
 * @return array<string,string> Parameter descriptions keyed by public attribute.
 */
function wpbc_shortcode_config__booking_appointment_parameter_reference() {
	$reference = array();
	foreach ( wpbc_shortcode_config__booking_appointment_parameters() as $parameter_name => $field ) {
		$reference[ $parameter_name ] = $field['description'];
	}

	$reference['progress_service_title'] = __( 'Compatibility alias for progress_item_1_title.', 'booking' );
	$reference['progress_service_number'] = __( 'Compatibility alias for progress_item_1_number.', 'booking' );
	$reference['progress_provider_title'] = __( 'Compatibility alias for progress_item_2_title.', 'booking' );
	$reference['progress_provider_number'] = __( 'Compatibility alias for progress_item_2_number.', 'booking' );
	$reference['progress_details_title'] = __( 'Compatibility alias for progress_item_3_title.', 'booking' );
	$reference['progress_details_number'] = __( 'Compatibility alias for progress_item_3_number.', 'booking' );

	return $reference;
}

/**
 * Render the [booking_appointment] configuration section in the shortcode popup.
 *
 * @return void
 */
function wpbc_shortcode_config__content__booking_appointment() {
	$shortcode_name = 'booking_appointment';
	$tabs = array(
		'general'   => array( 'title' => __( 'Service & Provider', 'booking' ), 'icon' => 'wpbc-bi-person-check', 'default' => true ),
		'calendar'  => array( 'title' => __( 'Calendar & Form', 'booking' ), 'icon' => 'wpbc-bi-calendar3', 'default' => false ),
		'progress'  => array( 'title' => __( 'Progress', 'booking' ), 'icon' => 'wpbc-bi-list-ol', 'default' => false ),
		'text'      => array( 'title' => __( 'Screen Text', 'booking' ), 'icon' => 'wpbc-bi-card-text', 'default' => false ),
		'reference' => array( 'title' => __( 'Parameters', 'booking' ), 'icon' => 'wpbc-bi-code-square', 'default' => false ),
	);
	$parameters = wpbc_shortcode_config__booking_appointment_parameters();
	?>
	<div id="wpbc_sc_container__shortcode_<?php echo esc_attr( $shortcode_name ); ?>" class="wpbc_sc_container__shortcode wpbc_sc_container__shortcode_<?php echo esc_attr( $shortcode_name ); ?>">
		<?php wpbc_shortcode_config__workflow_tabs( $shortcode_name, $tabs ); ?>
		<?php foreach ( array_keys( $tabs ) as $section_id ) : ?>
			<div class="wpbc_sc_container__shortcode_section wpbc_sc_container__shortcode_section__<?php echo esc_attr( $section_id ); ?>">
				<?php if ( 'reference' === $section_id ) : ?>
					<?php wpbc_shortcode_config__workflow_parameter_reference( wpbc_shortcode_config__booking_appointment_parameter_reference() ); ?>
				<?php else : ?>
					<table class="form-table"><tbody>
						<?php foreach ( $parameters as $parameter_name => $field ) : ?>
							<?php if ( $section_id === $field['section'] ) : ?>
								<?php wpbc_shortcode_config__workflow_field( $shortcode_name, $parameter_name, $field ); ?>
							<?php endif; ?>
						<?php endforeach; ?>
					</tbody></table>
				<?php endif; ?>
			</div>
		<?php endforeach; ?>
		<?php wpbc_shortcode_config__workflow_pager(); ?>
	</div>
	<?php
	wpbc_clear_div();
}


// =====================================================================================================================
//  Shortcode [booking_resource_selector ...].
// =====================================================================================================================

/**
 * Get the popup field contract for the Booking Resource Selector shortcode.
 *
 * Compatibility aliases remain visible in the reference tab, while newly
 * generated shortcodes use the normalized public parameter names.
 *
 * @return array<string,array<string,mixed>> Resource Selector parameter fields.
 */
function wpbc_shortcode_config__booking_resource_selector_parameters() {
	$month_options = array_combine( range( 1, 24 ), range( 1, 24 ) );

	return array(
		'resource_id' => array(
			'section' => 'general', 'title' => __( 'Preselected Booking Resource', 'booking' ), 'type' => 'select', 'value_type' => 'positive_integer', 'default' => '',
			'options' => wpbc_shortcode_config__workflow_resource_options( true, __( 'No Booking Resource preselected', 'booking' ) ),
			'description' => __( 'Check one Booking Resource by default without skipping the selection stage.', 'booking' ),
		),
		'resources' => array(
			'section' => 'general', 'title' => __( 'Allowed Booking Resources', 'booking' ), 'type' => 'multiselect', 'value_type' => 'id_list', 'default' => '',
			'options' => wpbc_shortcode_config__workflow_resource_options(), 'css' => 'width:100%;max-width:32em;height:12em;',
			'description' => __( 'Select the Booking Resources shown by this workflow. Leave every option unselected to allow all available Resources.', 'booking' ),
		),
		'aggregate' => array(
			'section' => 'general', 'title' => __( 'Aggregate Booking Resources', 'booking' ), 'type' => 'multiselect', 'value_type' => 'id_list', 'default' => '',
			'options' => wpbc_shortcode_config__workflow_resource_options(), 'css' => 'width:100%;max-width:32em;height:12em;',
			'description' => __( 'Select Booking Resources whose bookings should also block availability in the selected primary Resource.', 'booking' ),
		),
		'auto_select_resource' => array(
			'section' => 'general', 'title' => __( 'Auto-select Booking Resource', 'booking' ), 'type' => 'checkbox', 'value_type' => 'boolean', 'default' => false,
			'description' => __( 'Open the preselected Resource immediately, or skip selection when exactly one Resource is available.', 'booking' ),
		),
		'nummonths' => array(
			'section' => 'calendar', 'title' => __( 'Visible months', 'booking' ), 'type' => 'select', 'value_type' => 'positive_integer', 'default' => 1, 'options' => $month_options,
			'description' => __( 'Number of calendar months from 1 through 24.', 'booking' ),
		),
		'startmonth' => array(
			'section' => 'calendar', 'title' => __( 'Start month', 'booking' ), 'value_type' => 'month', 'default' => '', 'placeholder' => '2026-08',
			'description' => __( 'Initial calendar month in YYYY-MM, YYYY/MM, or YYYYMM format.', 'booking' ),
		),
		'calendar_dates_start' => array(
			'section' => 'calendar', 'title' => __( 'First calendar date', 'booking' ), 'value_type' => 'date', 'default' => '', 'placeholder' => '2026-08-01',
			'description' => __( 'Inclusive first displayed date in YYYY-MM-DD format.', 'booking' ),
		),
		'calendar_dates_end' => array(
			'section' => 'calendar', 'title' => __( 'Last calendar date', 'booking' ), 'value_type' => 'date', 'default' => '', 'placeholder' => '2026-12-31',
			'description' => __( 'Inclusive last displayed date in YYYY-MM-DD format.', 'booking' ),
		),
		'selected_dates' => array(
			'section' => 'calendar', 'title' => __( 'Preselected dates', 'booking' ), 'value_type' => 'text', 'default' => '', 'placeholder' => '01.08.2026',
			'description' => __( 'Native Booking Calendar preselected-date expression.', 'booking' ),
		),
		'options' => array(
			'section' => 'calendar', 'title' => __( 'Calendar options', 'booking' ), 'value_type' => 'text', 'default' => '',
			'description' => __( 'Native Booking Calendar options string passed to the selected calendar and form.', 'booking' ),
		),
		'form_type' => array(
			'section' => 'calendar', 'title' => __( 'Booking Form', 'booking' ), 'type' => 'select', 'value_type' => 'text', 'default' => '',
			'options' => wpbc_shortcode_config__workflow_form_options(),
			'description' => __( 'Select a published Booking Form override. Automatic uses the Resource form and then the Standard form.', 'booking' ),
		),
		'allow_past' => array(
			'section' => 'calendar', 'title' => __( 'Allow past bookings', 'booking' ), 'type' => 'checkbox', 'value_type' => 'boolean', 'default' => false,
			'description' => __( 'Permit any visitor to select and submit past dates inside the signed shortcode range.', 'booking' ),
		),
		'show_progress' => array(
			'section' => 'progress', 'title' => __( 'Show progress', 'booking' ), 'type' => 'checkbox', 'value_type' => 'boolean', 'default' => true,
			'description' => __( 'Show the complete two-step Resource selection progress line.', 'booking' ),
		),
		'progress_item_1_title' => array(
			'section' => 'progress', 'title' => __( 'First progress title', 'booking' ), 'default' => __( 'Resource', 'booking' ),
			'description' => __( 'Title below the first progress number. Clear it to hide the title.', 'booking' ),
		),
		'progress_item_1_number' => array(
			'section' => 'progress', 'title' => __( 'First progress number', 'booking' ), 'default' => '1',
			'description' => __( 'First displayed progress number. Clear it to hide the number.', 'booking' ),
		),
		'progress_item_2_title' => array(
			'section' => 'progress', 'title' => __( 'Second progress title', 'booking' ), 'default' => __( 'Date & Details', 'booking' ),
			'description' => __( 'Title below the second progress number. Clear it to hide the title.', 'booking' ),
		),
		'progress_item_2_number' => array(
			'section' => 'progress', 'title' => __( 'Second progress number', 'booking' ), 'default' => '2',
			'description' => __( 'Second displayed progress number. Clear it to hide the number.', 'booking' ),
		),
		'screen_1_title' => array(
			'section' => 'text', 'title' => __( 'Resource screen title', 'booking' ), 'default' => __( 'Choose a Booking Resource', 'booking' ),
			'description' => __( 'Heading on the Booking Resource selection screen. Clear it to hide the heading.', 'booking' ),
		),
		'screen_1_description' => array(
			'section' => 'text', 'title' => __( 'Resource screen description', 'booking' ), 'default' => __( 'Select what you would like to book.', 'booking' ),
			'description' => __( 'Description on the Booking Resource selection screen. Clear it to hide the description.', 'booking' ),
		),
	);
}

/**
 * Get every accepted public Resource Selector shortcode parameter for the reference tab.
 *
 * @return array<string,string> Parameter descriptions keyed by public attribute.
 */
function wpbc_shortcode_config__booking_resource_selector_parameter_reference() {
	$parameters = wpbc_shortcode_config__booking_resource_selector_parameters();
	$reference  = array();
	foreach ( $parameters as $parameter_name => $field ) {
		$reference[ $parameter_name ] = $field['description'];
	}

	$reference['type'] = __( 'Compatibility alias for resources. The resources parameter wins when both are present.', 'booking' );
	$reference['selected_resource_id'] = __( 'Compatibility fallback that checks one Resource without skipping selection. resource_id wins when both are present.', 'booking' );
	$reference['selected_type'] = __( 'Compatibility alias for selected_resource_id.', 'booking' );
	$reference['label'] = __( 'Compatibility alias for screen_1_title.', 'booking' );

	return $reference;
}

/**
 * Render the [booking_resource_selector] configuration section in the shortcode popup.
 *
 * @return void
 */
function wpbc_shortcode_config__content__booking_resource_selector() {
	$shortcode_name = 'booking_resource_selector';
	$tabs = array(
		'general'   => array( 'title' => __( 'Resource Selection', 'booking' ), 'icon' => 'wpbc-bi-card-checklist', 'default' => true ),
		'calendar'  => array( 'title' => __( 'Calendar & Form', 'booking' ), 'icon' => 'wpbc-bi-calendar3', 'default' => false ),
		'progress'  => array( 'title' => __( 'Progress', 'booking' ), 'icon' => 'wpbc-bi-list-ol', 'default' => false ),
		'text'      => array( 'title' => __( 'Screen Text', 'booking' ), 'icon' => 'wpbc-bi-card-text', 'default' => false ),
		'reference' => array( 'title' => __( 'Parameters', 'booking' ), 'icon' => 'wpbc-bi-code-square', 'default' => false ),
	);
	$parameters = wpbc_shortcode_config__booking_resource_selector_parameters();
	?>
	<div id="wpbc_sc_container__shortcode_<?php echo esc_attr( $shortcode_name ); ?>" class="wpbc_sc_container__shortcode wpbc_sc_container__shortcode_<?php echo esc_attr( $shortcode_name ); ?>">
		<?php wpbc_shortcode_config__workflow_tabs( $shortcode_name, $tabs ); ?>
		<?php foreach ( array_keys( $tabs ) as $section_id ) : ?>
			<div class="wpbc_sc_container__shortcode_section wpbc_sc_container__shortcode_section__<?php echo esc_attr( $section_id ); ?>">
				<?php if ( 'reference' === $section_id ) : ?>
					<?php wpbc_shortcode_config__workflow_parameter_reference( wpbc_shortcode_config__booking_resource_selector_parameter_reference() ); ?>
				<?php else : ?>
					<table class="form-table"><tbody>
						<?php foreach ( $parameters as $parameter_name => $field ) : ?>
							<?php if ( $section_id === $field['section'] ) : ?>
								<?php wpbc_shortcode_config__workflow_field( $shortcode_name, $parameter_name, $field ); ?>
							<?php endif; ?>
						<?php endforeach; ?>
					</tbody></table>
				<?php endif; ?>
			</div>
		<?php endforeach; ?>
		<?php wpbc_shortcode_config__workflow_pager(); ?>
	</div>
	<?php
	wpbc_clear_div();
}
