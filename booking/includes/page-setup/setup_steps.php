<?php /**
 * @version 1.0
 * @description Steps Structure for Setup Wizard Page
 * @category    Setup Class
 * @author wpdevelop
 *
 * @web-site http://oplugins.com/
 * @email info@oplugins.com
 *
 * @modified 2024-09-06
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly

// =====================================================================================================================
// ==  Steps STRUCTURE  ==
// =====================================================================================================================

/**
 * Get Steps structure for Setup Wizard Page
 *
 * @return array[]
 */
function wpbc_setup_wizard_page__get_steps_arr() {

	$step_default_params = array(
									'show_section_left'  => false,
									'show_section_right' => false,
									'is_done'            => false,
									'do_action'          => 'none',
									'prior'              => '',
									'next'               => ''
								);
	$steps_arr = array();

	// Step #1
	$step_name = 'welcome';
	$steps_arr[ $step_name ] = $step_default_params;
	$steps_arr[ $step_name ]['do_action'] = 'save_and_continue__welcome';
	$steps_arr[ $step_name ]['next']   = 'general_info';

	// Step #2
	$step_name = 'general_info';
	$steps_arr[ $step_name ] = $step_default_params;
	$steps_arr[ $step_name ]['do_action'] = 'save_and_continue__general_info';
	//$steps_arr[ $step_name ]['prior']  = 'bookings_types';
	$steps_arr[ $step_name ]['next']   = 'bookings_types';

	// Step #3
	$step_name = 'bookings_types';
	$steps_arr[ $step_name ] = $step_default_params;
	$steps_arr[ $step_name ]['do_action'] = 'save_and_continue__bookings_types';
	$steps_arr[ $step_name ]['prior']  = 'general_info';
	$steps_arr[ $step_name ]['next']   = 'calendar_days_selection';


	// Step #4
	$step_name = 'calendar_days_selection';
	$steps_arr[ $step_name ] = $step_default_params;
	//$steps_arr[ $step_name ]['show_section_left']  = true;
	$steps_arr[ $step_name ]['show_section_right'] = true;
	$steps_arr[ $step_name ]['do_action'] 	= 'save_and_continue__calendar_days_selection';
	$steps_arr[ $step_name ]['prior'] 	= 'general_info';
	$steps_arr[ $step_name ]['next'] 	= 'calendar_skin';

	// Step #5
	$step_name = 'calendar_skin';
	$steps_arr[ $step_name ] = $step_default_params;
	$steps_arr[ $step_name ]['show_section_left']  = true;
	$steps_arr[ $step_name ]['show_section_right'] = true;
	$steps_arr[ $step_name ]['do_action'] 	= 'save_and_continue__calendar_skin';
	$steps_arr[ $step_name ]['prior'] 	= 'calendar_days_selection';
	$steps_arr[ $step_name ]['next'] 	= 'welcome';

	return $steps_arr;
}


/**
 * Get Steps Count  -> 9
 *
 * @return int
 */
function wpbc_setup_wizard_page__get_total_steps_count(){

	$steps_arr = wpbc_setup_wizard_page__db__get_steps_is_done();

    return count($steps_arr);
}


/**
 * Actual Step Number  -> 2
 *
 * @return int
 */
function wpbc_setup_wizard_page__get_active_step_num() {

	$steps_arr = wpbc_setup_wizard_page__db__get_steps_is_done();
	$active_step   = 0;
	foreach ( $steps_arr as $step ) {

		if ( ! empty( $step ) ) {
			$active_step++;
		}
	}
	return $active_step;
}


/**
 * Actual Step Number  -> 'general_info'        or      'calendar_days_selection'
 *
 * @return int
 */
function wpbc_setup_wizard_page__get_active_step_name() {

	$steps_arr = wpbc_setup_wizard_page__db__get_steps_is_done();

	$first_step_name = '';
	foreach ( $steps_arr as $step_name => $step ) {

		$first_step_name =  (empty($first_step_name)) ? $step_name : $first_step_name;

		if ( empty( $step ) ) {
			return $step_name;
		}
	}
	return $first_step_name;
}


/**
 * Get % Progress for Setup Steps   -> 30
 * @return int
 */
function wpbc_setup_wizard_page__get_progess_value() {

	$progess_value = ( (wpbc_setup_wizard_page__get_active_step_num()-0) * 100 ) / wpbc_setup_wizard_page__get_total_steps_count();
	$progess_value = intval( $progess_value );

	return $progess_value;
}


// =====================================================================================================================
// ==  Content for UI  ==
// =====================================================================================================================

/**
 * Black Button at  Top Right Side in WPBC plugin menu  ( except Wizard page )
 *
 * Show Continue Setup Wizard Button
 * @return void
 */
function wpbc_after_wpbc_page_top__header_tabs__wizard_button() {

	if ( ! wpbc_is_setup_wizard_page() ){

		if ( wpbc_setup_wizard_page__db__is_all_steps_completed() ) {
			return false;
		}

		?><style tye="text/css">
			@media screen and (max-width: 782px) {
				.ui_element.wpbc_page_top__wizard_button {
					top: 49px !important;
				}
			}
			.wpbc_admin_full_screen .wpbc_page_top__wizard_button {
				display: none;
			}
			.wpbc_page_top__wizard_button {
				width: auto;
				position: fixed;
				z-index: 90000;
				box-shadow: 0 0 10px #c1c1c1;
				border-radius: 9px;
				background: transparent;
				right: 20px;
				top: 40px;
			}

			.ui_element.wpbc_page_top__wizard_button .wpbc_page_top__wizard_button_content,
			.ui_element.wpbc_page_top__wizard_button .wpbc_page_top__wizard_button_content:hover {
				border-radius: 5px;
				border: none;
				background: #535353; /* #6c9e00 #0b9300;*/
				box-shadow: 0 0 10px #dbdbdb;
				text-shadow: none;
				color: #fff;
				font-weight: 600;
				padding: 8px 10px 8px 15px;
				display: flex;
				flex-flow: row nowrap;
				justify-content: flex-start;
				align-items: center;
			}
		</style>
		<div style="min-width: 240px;top: 35px;font-size: 15px;" class="ui_element wpbc_page_top__wizard_button">
			<div class="wpbc_ui_control wpbc_page_top__wizard_button_content">
				<div class="in-button-text"
					 style="width: 100%;margin: 0;display: flex;flex-flow: row nowrap;justify-content: flex-start;align-items: center;">
					<div class="setup_wizard_page_container"
						 style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;color: #fff;overflow: visible;flex: 1 1 auto;">
						<div class="name_item" style="margin-top: 0;white-space: nowrap;padding: 0;margin-right: 20px;">
							<i style="margin-right: 4px;" class="menu_icon icon-1x wpbc_icn_donut_large wpbc_icn_adjust0"></i>
							<?php _e( 'Finish Setup', 'booking' ); ?>
						</div>
						<div
							style="margin:2px 0px 0 9px;font-size: 9px;background: #3e3e3e;height: auto;border-radius: 5px;padding: 0px 7px 0px;margin-left: auto;"
							class="wpbc_badge_count name_item update-plugins">
							<span class="update-count"
								  style="white-space: nowrap;word-wrap: normal;"><?php echo wpbc_setup_wizard_page__get_active_step_num() . ' / ' . wpbc_setup_wizard_page__get_total_steps_count(); ?></span>
						</div>

						<div class="progress_line_container"
							 style="width: 100%;border: 0px solid #757575;height: 3px;border-radius: 6px;margin: 7px 0 0 0;overflow: hidden;background: #202020;">
							<div class="progress_line"
								 style="font-size: 6px;font-weight: 600;border-radius: 6px;word-wrap: normal;white-space: nowrap;background: #8ECE01;width: <?php echo wpbc_setup_wizard_page__get_progess_value(); ?>%;height: 3px;"></div>
						</div>
					</div>
					<a <?php  // onclick="javascript:jQuery( '.wpbc_page_top__wizard_button').remove();" href="javascript:void(0);"  ?>
					   href="<?php echo esc_url( wpbc_get_setup_wizard_page_url() ); ?>"
					   class="button button-primary"
					   style="margin-left: auto;font-size: 11px;min-height: 10px;margin-left: 25px;">Continue</a></div>
			</div>
		</div><?php
	}
}
add_action('wpbc_after_wpbc_page_top__header_tabs','wpbc_after_wpbc_page_top__header_tabs__wizard_button',10,3);


// =====================================================================================================================
// ==  "Setup" with Progress Bar  ==
// =====================================================================================================================

/**
 * Main Left Menu Title - "Setup" with Progress Bar
 *
 * @return false|string
 */
function wpbc_get_plugin_menu_title__setup_progress(){


	ob_start();

	?><div class="setup_wizard_page_container" style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;color: #fff;margin: 0 -5px 0 0;overflow: visible;">
		<div class="name_item" style="margin-top: 0;white-space: nowrap;padding: 0 0 0 0;"><?php
			_e( 'Setup', 'booking' );
		?></div>
		<div style="margin:3px 0px 0 0;margin-left: auto;font-size: 9px;background: #2271b1;height: 15px;" class="wpbc_badge_count name_item update-plugins">
			<span class="update-count" style="white-space: nowrap;word-wrap: normal;"><?php
				echo wpbc_setup_wizard_page__get_active_step_num() . ' / ' . wpbc_setup_wizard_page__get_total_steps_count();
			?></span>
		</div>
		<div class="progress_line_container" style="width: 100%;border: 0px solid #757575;height: 3px;border-radius: 6px;margin: 7px 0 -3px -3px;overflow: hidden;background: #555;">
			<div class="progress_line" style="font-size: 6px;font-weight: 600;word-wrap: normal;border-radius: 6px;white-space: nowrap;background: #8ECE01;width: <?php
				echo wpbc_setup_wizard_page__get_progess_value(); ?>%;height: 3px;"></div>
		</div>
	</div><?php

	return ob_get_clean();
}


// =====================================================================================================================
// ==  DB :: "Set Wizard Steps as Done"  ==
// =====================================================================================================================

/**
 * Get  all Steps from DB and from  Structure,
 *
 * 	If not saved yet to DB,  then  get  default structure
 *
 *  And if later Wizard structure  	wpbc_setup_wizard_page__get_steps_arr()		was extended,  then  system  get  such  steps as uncompleted.
 *
 * @return array|mixed
 */
function wpbc_setup_wizard_page__db__get_steps_is_done(){

	$steps_is_done = get_bk_option( 'booking_setup_wizard_page_steps_is_done' );

	if ( empty( $steps_is_done ) ) {
		// Get Default Steps  from  the Steps structure

		$steps_names = wpbc_setup_wizard_page__get_steps_arr();
		$steps_names = array_keys( $steps_names );

		$steps_values  = array_fill( 0, count( $steps_names ), false );
		$steps_is_done = array_combine( $steps_names, $steps_values );
	} else {

		// Check  if some new steps here ?
		$possible_new_steps_names = wpbc_setup_wizard_page__get_steps_arr();
		$possible_new_steps_names = array_keys( $possible_new_steps_names );
		foreach ( $possible_new_steps_names as $possible_new_steps_name ) {
			if ( ! isset( $steps_is_done[ $possible_new_steps_name ] ) ) {
				$steps_is_done[ $possible_new_steps_name ] = false;
			}
		}

	}

	return $steps_is_done;
}

/**
 * Save statuses to  all steps
 *
 * @param $steps_arr
 *
 * @return void
 */
function wpbc_setup_wizard_page__db__save_steps_is_done( $steps_arr ) {
	update_bk_option( 'booking_setup_wizard_page_steps_is_done', $steps_arr );
}

/**
 * Set specific step  as Completed
 *
 * @param $step_name
 *
 * @return void
 */
function wpbc_setup_wizard_page__db__set_step_as_completed( $step_name ){

	$steps_arr = wpbc_setup_wizard_page__db__get_steps_is_done();

	$steps_arr[ $step_name ] = true;

	wpbc_setup_wizard_page__db__save_steps_is_done( $steps_arr );
}

/**
 * Set specific step  as Uncompleted
 *
 * @param $step_name
 *
 * @return void
 */
function wpbc_setup_wizard_page__db__set_step_as_uncompleted( $step_name ){

	$steps_arr = wpbc_setup_wizard_page__db__get_steps_is_done();

	$steps_arr[ $step_name ] = false;

	wpbc_setup_wizard_page__db__save_steps_is_done( $steps_arr );
}


/**
 * Check if specific step 'Is completed' ?
 *
 * @param string $step_name
 *
 * @return bool
 */
function wpbc_setup_wizard_page__db__is_step_completed( $step_name ) {

	$steps_arr = wpbc_setup_wizard_page__db__get_steps_is_done();

	if ( empty( $steps_arr[ $step_name ] ) ) {
		return false;
	} else {
		return true;
	}
}


/**
 * Mark All Steps as Completed or Uncompleted
 *
 * @param $is_completed  bool  (default true)
 *
 * @return void
 */
function wpbc_setup_wizard_page__db__set_all_steps_as( $is_completed = true ) {

	if ( false === $is_completed ) {
		delete_bk_option( 'booking_setup_wizard_page_steps_is_done' );
	}

	$steps_names = wpbc_setup_wizard_page__db__get_steps_is_done();

	$steps_names   = array_keys( $steps_names );
	$steps_values  = array_fill( 0, count( $steps_names ), $is_completed );
	$steps_is_done = array_combine( $steps_names, $steps_values );

	// Set  all  steps as not completed
	wpbc_setup_wizard_page__db__save_steps_is_done( $steps_is_done );
}

/**
 * Check  Is  all steps Completed
 * @return bool
 */
function wpbc_setup_wizard_page__db__is_all_steps_completed(){

    $steps_arr = wpbc_setup_wizard_page__db__get_steps_is_done();

	foreach ( $steps_arr as $step_name => $steps_val ) {
		if ( empty( $steps_val ) ) {
			return false;
		}
	}
	return true;
}
