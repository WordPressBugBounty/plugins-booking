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


class WPBC_SETUP_WIZARD_STEPS {

	private $steps_arr = array();

	/**
	 * Whether the setup bar render hook has already been registered.
	 *
	 * This class is also used as a setup-state helper in AJAX and routing code, so multiple instances can exist during
	 * one request. Only one of them should render the floating setup bar.
	 *
	 * @var bool
	 */
	private static $is_top_bar_hook_registered = false;

	/**
	 * Whether the setup bar has already been printed in the current request.
	 *
	 * @var bool
	 */
	private static $is_top_bar_rendered = false;

	public function __construct() {

		if ( WPBC()->is_wp_inited() || did_action( 'init' ) ) {
			$this->init_steps_data();
		} else {
			add_action( 'init', array( $this, 'init_steps_data' ) );
		}

		if ( ! self::$is_top_bar_hook_registered ) {
			add_action( 'wpbc_after_wpbc_page_top__header_tabs', array( $this, 'show_top_right_wizard_button' ), 10, 3 );
			self::$is_top_bar_hook_registered = true;
		}

	}


	/**
	 * Define Steps Data Structure  -  Init
	 *
	 * @return void
	 */
	public function init_steps_data(){

		$step_default_params = array(
										'show_section_left'  => false,
										'show_section_right' => false,
										'is_done'            => false,
										'do_action'          => 'none',
										'prior'              => '',
										'next'               => '',
										'prior_title' 		 => __( 'Go Back', 'booking' ),
										'next_title' 		 => __( 'Save and Continue', 'booking' )
									);
		$steps_arr = array();

		if ( function_exists( 'wpbc_setup_wizard__get_intro_route' ) ) {
			$route = wpbc_setup_wizard__get_intro_route();
		} else {
			$route = array( 'welcome' );
			if ( ! wpbc_is_this_demo() ) {
				$route[] = 'general_info';
			}
			$route[] = 'date_time_formats';
			$route[] = 'bookings_types';
		}
		$route = array_merge( $route, wpbc_setup_wizard__get_profile_route() );

		foreach ( $route as $step_index => $step_name ) {
			$steps_arr[ $step_name ]              = $step_default_params;
			$steps_arr[ $step_name ]['do_action'] = 'save_and_continue__' . $step_name;
			$steps_arr[ $step_name ]['prior']     = ( 0 === $step_index ) ? '' : $route[ $step_index - 1 ];
			$steps_arr[ $step_name ]['next']      = isset( $route[ $step_index + 1 ] ) ? $route[ $step_index + 1 ] : 'welcome';

			if ( function_exists( 'wpbc_setup_wizard__get_step_route_metadata' ) ) {
				$steps_arr[ $step_name ] = array_merge(
					$steps_arr[ $step_name ],
					wpbc_setup_wizard__get_step_route_metadata( $step_name )
				);
			}
		}

		foreach ( array( 'date_selection', 'working_time', 'time_slots_availability', 'date_availability', 'form_structure', 'color_theme', 'wizard_publish' ) as $continue_step_name ) {
			if ( isset( $steps_arr[ $continue_step_name ] ) ) {
				$steps_arr[ $continue_step_name ]['next_title'] = __( 'Continue', 'booking' );
			}
		}

		$this->steps_arr = $steps_arr;
	}

	/**
	 * Get Steps Data Structure
	 * @return array
	 */
	public function get_steps_arr(){
	    return $this->steps_arr;
	}


	// =================================================================================================================
	// ==  Steps STRUCTURE  ==
	// =================================================================================================================

	/**
	 * Actual Step Number  -> 'general_info'        or      'date_availability'
	 *
	 * @return int
	 */
	public function get_active_step_name() {

		$steps_arr = $this->db__get_steps_is_done();

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
	 * Actual Step Number  -> 2
	 *
	 * @return int
	 */
	public function get_active_step_num( $current_step = '' ) {

		if ( ! empty( $current_step ) ) {
			return $this->get_step_num_by_name( $current_step );
		}

		$steps_arr        = $this->db__get_steps_is_done();
		$total_steps      = count( $steps_arr );
		$completed_steps  = 0;

		foreach ( $steps_arr as $step ) {
			if ( ! empty( $step ) ) {
				$completed_steps++;
			}
		}

		if ( $completed_steps >= $total_steps ) {
			return $total_steps;
		}

		return min( $completed_steps + 1, $total_steps );
	}

	/**
	 * Get Step Number by step name.
	 *
	 * @param string $current_step Step name.
	 *
	 * @return int
	 */
	public function get_step_num_by_name( $current_step ) {

		$step_num = 1;

		foreach ( array_keys( $this->get_steps_arr() ) as $step_name ) {
			if ( $step_name === $current_step ) {
				return $step_num;
			}
			$step_num++;
		}

		return 1;
	}

	/**
	 * Get the last wizard step saved in the setup wizard request history.
	 *
	 * @return string
	 */
	public function get_saved_current_step_name() {

		$steps_arr    = $this->get_steps_arr();
		$current_step = $this->get_active_step_name();

		if ( function_exists( 'wpbc_setup_wizard_page__get_cleaned_params__saved_request_default' ) ) {
			$saved_request_params = wpbc_setup_wizard_page__get_cleaned_params__saved_request_default();

			if (
				is_array( $saved_request_params )
				&& ( ! empty( $saved_request_params['current_step'] ) )
				&& isset( $steps_arr[ $saved_request_params['current_step'] ] )
			) {
				$current_step = $saved_request_params['current_step'];
			}
		}

		return $current_step;
	}

	/**
	 * Get target URL for a setup step.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return string
	 */
	public function get_step_target_url( $step_name ) {

		$steps_arr = $this->get_steps_arr();

		if ( isset( $steps_arr[ $step_name ]['target_url'] ) && ( ! empty( $steps_arr[ $step_name ]['target_url'] ) ) ) {
			return $steps_arr[ $step_name ]['target_url'];
		}

		return function_exists( 'wpbc_setup_wizard__get_step_target_url' )
			? wpbc_setup_wizard__get_step_target_url( $step_name )
			: wpbc_get_setup_wizard_page_url();
	}

	/**
	 * Get Continue URL for the floating setup bar.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return string
	 */
	public function get_step_continue_url( $step_name ) {

		return function_exists( 'wpbc_setup_wizard__get_step_continue_url' )
			? wpbc_setup_wizard__get_step_continue_url( $step_name )
			: $this->get_step_target_url( $step_name );
	}

	/**
	 * Get step name from setup URL context or first incomplete setup step.
	 *
	 * @return string
	 */
	public function get_context_step_name() {

		$steps_arr    = $this->get_steps_arr();
		$current_step = $this->get_saved_current_step_name();

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( isset( $_REQUEST['wpbc_setup_step'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$request_step = sanitize_key( wp_unslash( $_REQUEST['wpbc_setup_step'] ) );
			if ( isset( $steps_arr[ $request_step ] ) ) {
				$current_step = $request_step;
				$this->db__save_current_step_name( $current_step );
				return $current_step;
			}
		}

		if ( $this->db__is_step_completed( 'bookings_types' ) && function_exists( 'wpbc_setup_wizard__detect_step_from_admin_request' ) ) {
			$detected_step = wpbc_setup_wizard__detect_step_from_admin_request();
			if ( ! empty( $detected_step ) && isset( $steps_arr[ $detected_step ] ) ) {
				$current_step = $detected_step;
				$this->db__save_current_step_name( $current_step );
				return $current_step;
			}
		}

		return $current_step;
	}

	/**
	 * Save the current setup step into the per-user wizard request state.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return bool
	 */
	public function db__save_current_step_name( $step_name ) {

		$steps_arr = $this->get_steps_arr();
		if ( empty( $step_name ) || ! isset( $steps_arr[ $step_name ] ) || ! function_exists( 'wpbc_setup_wizard_page__request_rules_structure' ) ) {
			return false;
		}

		$request_params_to_save = function_exists( 'wpbc_setup_wizard_page__get_cleaned_params__saved_request_default' )
			? wpbc_setup_wizard_page__get_cleaned_params__saved_request_default()
			: array();

		if ( ! is_array( $request_params_to_save ) || empty( $request_params_to_save ) ) {
			$request_params_to_save = function_exists( 'wpbc_setup_wizard_page__get__request_values__default' )
				? wpbc_setup_wizard_page__get__request_values__default()
				: array();
		}

		$request_params_to_save['current_step'] = $step_name;

		$user_request = new WPBC_AJX__REQUEST( array(
											   'db_option_name'          => 'booking_setup_wizard_page_request_params',
											   'user_id'                 => wpbc_get_current_user_id(),
											   'request_rules_structure' => wpbc_setup_wizard_page__request_rules_structure()
											)
					);

		return (bool) $user_request->user_request_params__db_save( $request_params_to_save );
	}

	/**
	 * Get target URL for prior setup step.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return string
	 */
	public function get_step_prior_url( $step_name ) {

		$steps_arr = $this->get_steps_arr();
		$prior     = isset( $steps_arr[ $step_name ]['prior'] ) ? $steps_arr[ $step_name ]['prior'] : '';

		return ( empty( $prior ) ) ? '' : $this->get_step_target_url( $prior );
	}

	/**
	 * Get step title for setup bar.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return string
	 */
	public function get_step_title( $step_name ) {

		$steps_arr = $this->get_steps_arr();

		if ( isset( $steps_arr[ $step_name ]['title'] ) ) {
			return $steps_arr[ $step_name ]['title'];
		}

		return function_exists( 'wpbc_setup_wizard__get_step_title' )
			? wpbc_setup_wizard__get_step_title( $step_name )
			: $step_name;
	}

	/**
	 * Get action-oriented setup step heading.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return string
	 */
	public function get_step_heading( $step_name ) {

		$steps_arr = $this->get_steps_arr();

		if ( isset( $steps_arr[ $step_name ]['heading'] ) ) {
			return $steps_arr[ $step_name ]['heading'];
		}

		return function_exists( 'wpbc_setup_wizard__get_step_heading' )
			? wpbc_setup_wizard__get_step_heading( $step_name )
			: $this->get_step_title( $step_name );
	}

	/**
	 * Get setup step description.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return string
	 */
	public function get_step_description( $step_name ) {

		$steps_arr = $this->get_steps_arr();

		if ( isset( $steps_arr[ $step_name ]['description'] ) ) {
			return $steps_arr[ $step_name ]['description'];
		}

		return function_exists( 'wpbc_setup_wizard__get_step_description' )
			? wpbc_setup_wizard__get_step_description( $step_name )
			: '';
	}

	/**
	 * Get setup step save behavior.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return string
	 */
	public function get_step_save_behavior( $step_name ) {

		$steps_arr = $this->get_steps_arr();

		if ( isset( $steps_arr[ $step_name ]['save_behavior'] ) ) {
			return $steps_arr[ $step_name ]['save_behavior'];
		}

		return function_exists( 'wpbc_setup_wizard__get_step_save_behavior' )
			? wpbc_setup_wizard__get_step_save_behavior( $step_name )
			: 'link_only';
	}

	/**
	 * Get route metadata value.
	 *
	 * @param string $step_name Step name.
	 * @param string $key       Metadata key.
	 *
	 * @return string
	 */
	public function get_step_meta_value( $step_name, $key ) {

		$steps_arr = $this->get_steps_arr();

		return ( isset( $steps_arr[ $step_name ][ $key ] ) ) ? (string) $steps_arr[ $step_name ][ $key ] : '';
	}


	/**
	 * Get Steps Count  -> 9
	 *
	 * @return int
	 */
	public function get_total_steps_count(){

		$steps_arr = $this->db__get_steps_is_done();

		return count($steps_arr);
	}


	/**
	 * Get % Progress for Setup Steps   -> 30
	 * @return int
	 */
	public function get_progess_value( $current_step = '' ) {

		$total_steps = $this->get_total_steps_count();
		if ( $total_steps <= 0 ) {
			return 0;
		}

		$progess_value = ( $this->get_active_step_num( $current_step ) * 100 ) / $total_steps;
		$progess_value = intval( $progess_value );

		return $progess_value;
	}


	// =================================================================================================================
	// ==  DB :: "Set Wizard Steps as Done"  ==
	// =================================================================================================================

	/**
	 * Get  all Steps from DB and from  Structure,
	 *
	 *    If not saved yet to DB,  then  get  default structure
	 *
	 *  And if later Wizard structure    ->init_steps_data()        was extended,  then  system  get  such  steps as uncompleted.
	 *
	 * @return array|mixed
	 */
	public function db__get_steps_is_done() {

		$steps_is_done = get_bk_option( 'booking_setup_wizard_page_steps_is_done' );
		$is_completed  = ( 'On' === get_bk_option( 'booking_setup_wizard_page_is_completed' ) );

		$active_steps_names = array_keys( $this->get_steps_arr() );
		$normalized_steps   = array();

		foreach ( $active_steps_names as $step_name ) {
			$normalized_steps[ $step_name ] = $is_completed ? true : ( ( is_array( $steps_is_done ) && isset( $steps_is_done[ $step_name ] ) ) ? (bool) $steps_is_done[ $step_name ] : false );
		}

		if ( $steps_is_done !== $normalized_steps ) {
			$this->db__save_steps_is_done( $normalized_steps );
		}

		return $normalized_steps;
	}


	/**
	 * Save statuses to  all steps
	 *
	 * @param $steps_arr
	 *
	 * @return void
	 */
	public function db__save_steps_is_done( $steps_arr ) {
		update_bk_option( 'booking_setup_wizard_page_steps_is_done', $steps_arr );
	}

	/**
	 * Set specific step  as Completed
	 *
	 * @param $step_name
	 *
	 * @return void
	 */
	public function db__set_step_as_completed( $step_name ) {

		$steps_arr = $this->db__get_steps_is_done();

		$steps_arr[ $step_name ] = true;

		$this->db__save_steps_is_done( $steps_arr );
		$this->db__set_step_as_saved( $step_name, true );

		if ( ! in_array( false, $steps_arr, true ) ) {
			update_bk_option( 'booking_setup_wizard_page_is_completed', 'On' );
		}
	}

	/**
	 * Set specific step  as Uncompleted
	 *
	 * @param $step_name
	 *
	 * @return void
	 */
	public function db__set_step_as_uncompleted( $step_name ) {

		$steps_arr = $this->db__get_steps_is_done();

		$steps_arr[ $step_name ] = false;

		delete_bk_option( 'booking_setup_wizard_page_is_completed' );

		$this->db__save_steps_is_done( $steps_arr );
	}

	/**
	 * Reset a step and all following steps in the active route.
	 *
	 * Older wizard versions could leave later steps marked as completed, which made the continue handler think setup
	 * was finished too early after Step 5.
	 *
	 * @param string $first_step_name First step to reset.
	 *
	 * @return bool
	 */
	public function db__reset_steps_from( $first_step_name ) {

		$steps_is_done  = $this->db__get_steps_is_done();
		$steps_is_saved = $this->db__get_steps_is_saved();
		$should_reset   = false;

		if ( ! array_key_exists( $first_step_name, $steps_is_done ) ) {
			return false;
		}

		foreach ( array_keys( $steps_is_done ) as $step_name ) {
			if ( $first_step_name === $step_name ) {
				$should_reset = true;
			}

			if ( $should_reset ) {
				$steps_is_done[ $step_name ] = false;
				if ( array_key_exists( $step_name, $steps_is_saved ) ) {
					$steps_is_saved[ $step_name ] = false;
				}
			}
		}

		delete_bk_option( 'booking_setup_wizard_page_is_completed' );
		$this->db__save_steps_is_done( $steps_is_done );
		$this->db__save_steps_is_saved( $steps_is_saved );

		return true;
	}

	/**
	 * Check if specific step 'Is completed' ?
	 *
	 * @param string $step_name
	 *
	 * @return bool
	 */
	public function db__is_step_completed( $step_name ) {

		$steps_arr = $this->db__get_steps_is_done();

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
	public function db__set_all_steps_as( $is_completed = true ) {

		if ( false === $is_completed ) {
			delete_bk_option( 'booking_setup_wizard_page_steps_is_done' );
			delete_bk_option( 'booking_setup_wizard_page_is_completed' );
		} else {
			update_bk_option( 'booking_setup_wizard_page_is_completed', 'On' );
		}

		$steps_names = $this->db__get_steps_is_done();

		$steps_names   = array_keys( $steps_names );
		$steps_values  = array_fill( 0, count( $steps_names ), $is_completed );
		$steps_is_done = array_combine( $steps_names, $steps_values );

		// Set  all  steps as not completed
		$this->db__save_steps_is_done( $steps_is_done );
		$this->db__save_steps_is_saved( $steps_is_done );
	}

	/**
	 * Get saved state for setup steps.
	 *
	 * @return array
	 */
	public function db__get_steps_is_saved() {

		$steps_is_saved = get_bk_option( 'booking_setup_wizard_page_steps_is_saved' );
		$is_completed   = ( 'On' === get_bk_option( 'booking_setup_wizard_page_is_completed' ) );
		$normalized     = array();

		foreach ( array_keys( $this->get_steps_arr() ) as $step_name ) {
			$normalized[ $step_name ] = $is_completed ? true : ( ( is_array( $steps_is_saved ) && isset( $steps_is_saved[ $step_name ] ) ) ? (bool) $steps_is_saved[ $step_name ] : false );
		}

		if ( $steps_is_saved !== $normalized ) {
			$this->db__save_steps_is_saved( $normalized );
		}

		return $normalized;
	}

	/**
	 * Save setup step saved states.
	 *
	 * @param array $steps_arr Saved states.
	 *
	 * @return void
	 */
	public function db__save_steps_is_saved( $steps_arr ) {
		update_bk_option( 'booking_setup_wizard_page_steps_is_saved', $steps_arr );
	}

	/**
	 * Mark a setup step as saved or unsaved.
	 *
	 * @param string $step_name Step name.
	 * @param bool   $is_saved  Saved flag.
	 *
	 * @return bool
	 */
	public function db__set_step_as_saved( $step_name, $is_saved = true ) {

		$steps_arr = $this->db__get_steps_is_saved();
		if ( ! array_key_exists( $step_name, $steps_arr ) ) {
			return false;
		}

		$steps_arr[ $step_name ] = (bool) $is_saved;
		$this->db__save_steps_is_saved( $steps_arr );

		return true;
	}

	/**
	 * Check whether a setup step has been saved.
	 *
	 * @param string $step_name Step name.
	 *
	 * @return bool
	 */
	public function db__is_step_saved( $step_name ) {

		if ( 'manual_save_required' !== $this->get_step_save_behavior( $step_name ) ) {
			return true;
		}

		$steps_arr = $this->db__get_steps_is_saved();

		return ! empty( $steps_arr[ $step_name ] );
	}

	/**
	 * Check  Is  all steps Completed
	 * @return bool
	 */
	public function db__is_all_steps_completed() {

		if ( 'On' === get_bk_option( 'booking_setup_wizard_page_is_completed' ) ) {
			return true;
		}

		$steps_arr = $this->db__get_steps_is_done();

		foreach ( $steps_arr as $step_name => $steps_val ) {
			if ( empty( $steps_val ) ) {
				return false;
			}
		}

		return true;
	}



	// =================================================================================================================
	// ==  C O N T E N T  ==
	// =================================================================================================================

	// ----------------------------------------------------------
	// ==  Left Plugin Menu  -->  "Setup" with Progress Bar  ==
	// ----------------------------------------------------------

	/**
	 * Main Left Menu Title - "Setup" with Progress Bar
	 *
	 * @return false|string
	 */
	public function get_plugin_menu_title__setup_progress( $current_step = '' ){


		$current_step_for_progress = ( ! empty( $current_step ) ) ? $current_step : $this->get_context_step_name();

		ob_start();

		?><div class="setup_wizard_page_container" style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;color: #fff;margin: 0 -5px 0 0;overflow: visible;">
			<div class="name_item" style="margin-top: 0;white-space: nowrap;padding: 0 0 0 0;"><?php esc_html_e( 'Setup', 'booking' ); ?></div>
			<div style="margin:3px 0px 0 0;margin-left: auto;font-size: 9px;background: var(--wpbc_admin-theme-color, #2271b1);height: 15px;" class="wpbc_badge_count name_item update-plugins">
				<span class="update-count" style="white-space: nowrap;word-wrap: normal;"><?php
					echo esc_html( $this->get_active_step_num( $current_step_for_progress ) . ' / ' . $this->get_total_steps_count() );
				?></span>
			</div>
			<div class="progress_line_container" style="width: 100%;border: 0px solid #757575;height: 3px;border-radius: 6px;margin: 7px 0 -3px -3px;overflow: hidden;background: #555;">
				<div class="progress_line" style="font-size: 6px;font-weight: 600;word-wrap: normal;border-radius: 6px;white-space: nowrap;background: #8ECE01;width: <?php
					echo esc_html( $this->get_progess_value( $current_step_for_progress ) ); ?>%;height: 3px;"></div>
			</div>
		</div><?php

		return ob_get_clean();
	}

	// ----------------------------------------------------------
	// ==  Content Top Wizard Button  ==
	// ----------------------------------------------------------

	/**
	 * Black Button at  Top Right Side in WPBC plugin menu  ( except Wizard page )
	 *
	 * Show Continue Setup Wizard Button
	 * @return void
	 */
	public function show_top_right_wizard_button() {

		if ( ! wpbc_is_setup_wizard_page() ){

			if (
				( ! wpbc_is_user_can_access_wizard_page() ) ||
				( $this->db__is_all_steps_completed() )
			){
				return false;
			}

			if ( self::$is_top_bar_rendered ) {
				return false;
			}
			self::$is_top_bar_rendered = true;

			$current_step                   = $this->get_context_step_name();
			$is_external_setup_flow_started = $this->db__is_step_completed( 'bookings_types' );
			$detected_page_step             = ( $is_external_setup_flow_started && function_exists( 'wpbc_setup_wizard__detect_step_from_admin_request' ) )
				? wpbc_setup_wizard__detect_step_from_admin_request()
				: '';
			$continue_url       = $this->get_step_continue_url( $current_step );
			if ( ! empty( $detected_page_step ) && isset( $this->steps_arr[ $detected_page_step ] ) ) {
				$continue_url = add_query_arg( 'wpbc_setup_from_page_step', $detected_page_step, $continue_url );
			}
			$prior_url    = $this->get_step_prior_url( $current_step );
			$step_title   = $this->get_step_title( $current_step );
			$step_heading = $this->get_step_heading( $current_step );
			$step_save_page_title = ( 'form_structure' === $current_step ) ? __( 'Form Builder', 'booking' ) : $step_title;
			$description  = $this->get_step_description( $current_step );
			$save_behavior = $this->get_step_save_behavior( $current_step );
			$target_selector = $this->get_step_meta_value( $current_step, 'target_selector' );
			$scroll_selector = $this->get_step_meta_value( $current_step, 'scroll_selector' );
			$highlight_selector = $this->get_step_meta_value( $current_step, 'highlight_selector' );
			$form_selector   = $this->get_step_meta_value( $current_step, 'form_selector' );
			$save_selector   = $this->get_step_meta_value( $current_step, 'save_selector' );
			$save_events     = $this->get_step_meta_value( $current_step, 'save_events' );
			$open_action     = $this->get_step_meta_value( $current_step, 'open_action' );
			$continue_title = ( 'complete' === $save_behavior ) ? __( 'Finish Setup', 'booking' ) : __( 'Continue', 'booking' );
			$is_step_saved       = $this->db__is_step_saved( $current_step );
			$is_continue_disabled = ( 'manual_save_required' === $save_behavior && ! $is_step_saved );
			$continue_href       = $is_continue_disabled ? '#wpbc_setup_save_required' : $continue_url;
			$mark_saved_nonce    = wp_create_nonce( 'wpbc_setup_wizard_mark_step_saved' );
			$step_target_url     = $this->get_step_target_url( $current_step );
			$skip_wizard_url     = add_query_arg( 'wpbc_setup_wizard', 'completed', wpbc_get_bookings_url() );
			$reset_wizard_url    = add_query_arg( 'wpbc_setup_wizard', 'reset', wpbc_get_setup_wizard_page_url() );
			$save_required_note  = sprintf(
				/* translators: %s: setup target page title. */
				__( 'Save changes on the %s page before continuing.', 'booking' ),
				'<a href="' . esc_url( $step_target_url ) . '">' . esc_html( $step_save_page_title ) . '</a>'
			);

			// FixIn: 10.12.1.1.
			?><style type="text/css">
				@media screen and (max-width: 782px) {
					.ui_element.wpbc_page_top__wizard_button {
						/*top: 49px !important;*/
					}
				}
				.wp-admin.wpbc_admin_full_screen .wpbc_header_news {
					display: none !important;
				}
				.wpbc_page_top__wizard_button {
					width: auto;
					min-width: 330px;
					max-width: min(420px, calc(100vw - 30px));
					position: fixed;
					z-index: 150000;
					box-shadow: 0 0 10px #c1c1c1;
					border-radius: 9px;
					background: transparent;
					right: 15px;
					top: auto !important;
					bottom: 15px !important;
				}
				.wpbc_page_top__wizard_button.wpbc_setup_wizard_bar_is_moved {
					left: var(--wpbc-setup-bar-left, auto) !important;
					top: auto !important;
					right: auto !important;
					bottom: var(--wpbc-setup-bar-bottom, auto) !important;
				}
				.wpbc_page_top__wizard_button.wpbc_setup_wizard_bar_auto_shifted {
					left: auto !important;
					top: auto !important;
					right: var(--wpbc-setup-bar-auto-right, 15px) !important;
					bottom: 15px !important;
				}
				.wpbc_page_top__wizard_button.wpbc_setup_wizard_bar_is_dragging {
					user-select: none;
				}
				.wpbc_page_top__wizard_button.wpbc_setup_wizard_bar_collapsed {
					min-width: 260px;
				}
				.wpbc_page_top__wizard_button.wpbc_setup_wizard_bar_collapsed .wpbc_setup_wizard_bar_expandable {
					display: none !important;
				}
				div .wpbc_admin_page__tab__builder_booking_form .wpbc_page_top__wizard_button {
					top: calc(var(--wpbc_ui_top_nav__wp_top_menu_height) + var(--wpbc_ui_top_nav__height) + 10px) !important;
					top: auto !important;
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
					flex-flow: column nowrap;
					justify-content: flex-start;
					align-items: stretch;
					gap: 8px;
				}
				.wpbc_setup_wizard_bar_title_row {
					display: flex;
					flex-flow: row nowrap;
					justify-content: flex-start;
					align-items: center;
					gap: 8px;
					width: 100%;
					border-bottom: 2px solid #686868;
					padding-bottom: 8px;
					margin-bottom: 10px;
				}
				.wpbc_setup_wizard_bar_title {
					flex: 1 1 auto;
					min-width: 0;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					margin-top: 0;
					padding: 0;
				}
				.wpbc_setup_wizard_bar_header_actions {
					display: flex;
					flex: 0 0 auto;
					flex-flow: row nowrap;
					align-items: center;
					gap: 2px;
					margin-left: auto;
				}
				.wpbc_setup_wizard_bar_icon_button {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					width: 24px;
					height: 24px;
					min-width: 24px;
					min-height: 24px;
					border: 0;
					border-radius: 4px;
					background: transparent;
					color: #fff;
					cursor: pointer;
					padding: 0;
					margin: 0;
				}
				.wpbc_setup_wizard_bar_icon_button:hover,
				.wpbc_setup_wizard_bar_icon_button:focus {
					background: rgba(255,255,255,0.16);
					color: #fff;
					outline: none;
					box-shadow: none;
				}
				.wpbc_setup_wizard_bar_drag_handle {
					cursor: move;
				}
				.wpbc_page_top__wizard_button_actions {
					display: flex;
					flex-flow: row nowrap;
					justify-content: flex-end;
					align-items: center;
					gap: 8px;
				}
				.wpbc_page_top__wizard_button_actions .button {
					font-size: 11px;
					min-height: 10px;
					line-height: 1.8;
					margin: 0;
				}
				.wpbc_page_top__wizard_button_actions .button.button-secondary {
					background-color: #e4e4e4;
				}
				.wpbc_page_top__wizard_button_actions .button.disabled,
				.wpbc_page_top__wizard_button_actions .button[aria-disabled="true"] {
					cursor: not-allowed;
					opacity: 0.55;
					pointer-events: auto;
				}
				.wpbc_page_top__wizard_button_links {
					display: flex;
					flex-flow: row wrap;
					justify-content: flex-start;
					align-items: center;
					gap: 1.5em;
					font-size: 10px;
					font-weight: 400;
					line-height: 1.4;
					margin-top: -2px;
				}
				.wpbc_page_top__wizard_button_links a {
					color: #e6e6e6;
					text-decoration: underline;
					text-underline-offset: 2px;
				}
				.wpbc_page_top__wizard_button_links a:hover,
				.wpbc_page_top__wizard_button_links a:focus {
					color: #fff;
				}
				.wpbc_page_top__wizard_button_links a.wpbc_setup_wizard_bar_danger_link {
					/*color: #ff9b00;*/
				}
				.wpbc_page_top__wizard_button_links a.wpbc_setup_wizard_bar_danger_link:hover,
				.wpbc_page_top__wizard_button_links a.wpbc_setup_wizard_bar_danger_link:focus {
					color: #fff;
				}
				.wpbc_page_top__wizard_button_note {
					font-size: 12px;
					font-weight: 400;
					line-height: 1.35;
					color: #fff;
					background: rgb(160, 160, 95);
					background: rgb(160, 132, 95);
					background: rgb(160, 116, 95);
					border-radius: 4px;
					padding: 10px 14px;
					margin: 8px 0 5px;
				}
				.wpbc_page_top__wizard_button_note a {
					color: #fff;
					text-decoration: underline;
					text-underline-offset: 2px;
				}
				.wpbc_page_top__wizard_button_note.wpbc_setup_wizard_bar_note_saved {
					background: #4f8f16;
				}
				.wpbc_setup_wizard_attention_pulse {
					animation: wpbc_setup_wizard_attention_pulse 0.62s ease-in-out 3;
				}
				@keyframes wpbc_setup_wizard_attention_pulse {
					0% {
						box-shadow: 0 0 0 0 rgba(255, 196, 0, 0.82);
						transform: scale(1);
					}
					50% {
						box-shadow: 0 0 0 7px rgba(255, 196, 0, 0.2);
						transform: scale(1.025);
					}
					100% {
						box-shadow: 0 0 0 0 rgba(255, 196, 0, 0);
						transform: scale(1);
					}
				}
				.wpbc_setup_wizard__target_highlight {
					outline: 2px solid #8ECE01 !important;
					outline-offset: 3px !important;
					box-shadow: 0 0 0 5px rgba(142, 206, 1, 0.16) !important;
					transition: outline-color 0.2s ease, box-shadow 0.2s ease;
				}
				@media screen and (max-width: 782px) {
					.wpbc_page_top__wizard_button {
						left: 10px !important;
						right: 10px !important;
						bottom: 10px !important;
						top: auto !important;
						min-width: 0;
						max-width: none;
					}
					.wpbc_setup_wizard_bar_drag_handle,
					.wpbc_setup_wizard_bar_reset_button {
						display: none;
					}
				}
			</style>
			<div style="top: 35px;font-size: 15px;"
				 class="ui_element wpbc_page_top__wizard_button"
				 data-wpbc-setup-step="<?php echo esc_attr( $current_step ); ?>"
				 data-wpbc-setup-save-behavior="<?php echo esc_attr( $save_behavior ); ?>"
				 data-wpbc-setup-is-saved="<?php echo esc_attr( $is_step_saved ? '1' : '0' ); ?>"
				 data-wpbc-setup-ajax-url="<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>"
				 data-wpbc-setup-mark-saved-nonce="<?php echo esc_attr( $mark_saved_nonce ); ?>"
				 data-wpbc-setup-target-selector="<?php echo esc_attr( $target_selector ); ?>"
				 data-wpbc-setup-scroll-selector="<?php echo esc_attr( $scroll_selector ); ?>"
				 data-wpbc-setup-highlight-selector="<?php echo esc_attr( $highlight_selector ); ?>"
				 data-wpbc-setup-form-selector="<?php echo esc_attr( $form_selector ); ?>"
				 data-wpbc-setup-save-selector="<?php echo esc_attr( $save_selector ); ?>"
				 data-wpbc-setup-save-events="<?php echo esc_attr( $save_events ); ?>"
				 data-wpbc-setup-open-action="<?php echo esc_attr( $open_action ); ?>">
				<div class="wpbc_ui_control wpbc_page_top__wizard_button_content">
					<div class="in-button-text"
						 style="width: 100%;margin: 0;display: flex;flex-flow: column nowrap;justify-content: flex-start;align-items: stretch;gap:8px;">
						<div class="setup_wizard_page_container"
							 style="display: flex;flex-flow: row wrap;justify-content: flex-start;align-items: center;color: #fff;overflow: visible;flex: 1 1 auto;">
							<div class="wpbc_setup_wizard_bar_title_row">
								<div class="wpbc_setup_wizard_bar_header_actions">
									<button type="button"
											style="margin: -1px 5px 0 -7px;"
											class="wpbc_setup_wizard_bar_icon_button wpbc_setup_wizard_bar_drag_handle"
											title="<?php esc_attr_e( 'Move setup bar', 'booking' ); ?>"
											aria-label="<?php esc_attr_e( 'Move setup bar', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_drag_indicator"></i>
									</button>
								</div>

								<div class="name_item wpbc_setup_wizard_bar_title">
									<i style="margin-right: 4px;" class="menu_icon icon-1x wpbc_icn_donut_large wpbc_icn_adjust0"></i> <?php echo esc_html( $step_title ); ?>
								</div>
								<div class="wpbc_setup_wizard_bar_header_actions">
									<button type="button"
											class="wpbc_setup_wizard_bar_icon_button wpbc_setup_wizard_bar_reset_button"
											title="<?php esc_attr_e( 'Reset setup bar position', 'booking' ); ?>"
											aria-label="<?php esc_attr_e( 'Reset setup bar position', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_refresh"></i>
									</button>
									<button type="button"
											class="wpbc_setup_wizard_bar_icon_button wpbc_setup_wizard_bar_toggle_button"
											title="<?php esc_attr_e( 'Collapse setup bar', 'booking' ); ?>"
											aria-label="<?php esc_attr_e( 'Collapse setup bar', 'booking' ); ?>"
											aria-expanded="true">
										<i class="menu_icon icon-1x wpbc_icn_expand_less"></i>
									</button>
								</div>
							</div>
							<div class="name_item wpbc_setup_wizard_bar_expandable" style="flex:1 1 100%;font-size:13px;font-weight:600;line-height:1.35;margin:3px 0 0;color:#f1f1f1;">
								<?php echo esc_html( $step_heading ); ?>
							</div>
							<?php if ( ! empty( $description ) ) { ?>
							<div class="name_item wpbc_setup_wizard_bar_expandable" style="flex:1 1 100%;font-size:11px;font-weight:400;line-height:1.35;margin:2px 0 0;color:#e6e6e6;">
								<?php echo esc_html( $description ); ?>
							</div>
							<?php } ?>
							<div
								style="margin:2px 0px 0 9px;font-size: 9px;background: #3e3e3e;height: auto;border-radius: 5px;padding: 0px 7px 0px;margin-left: auto;"
								class="wpbc_badge_count name_item update-plugins">
								<span class="update-count"
									  style="white-space: nowrap;word-wrap: normal;"><?php echo esc_html( $this->get_active_step_num( $current_step ) . ' / ' . $this->get_total_steps_count() ); ?></span>
							</div>

							<div class="progress_line_container"
								 style="width: 100%;border: 0px solid #757575;height: 3px;border-radius: 6px;margin: 7px 0 0 0;overflow: hidden;background: #202020;">
								<div class="progress_line"
								 style="font-size: 6px;font-weight: 600;border-radius: 6px;word-wrap: normal;white-space: nowrap;background: #8ECE01;width: <?php echo esc_attr( $this->get_progess_value( $current_step ) ); ?>%;height: 3px;"></div>
							</div>
						</div>
						<?php if ( 'manual_save_required' === $save_behavior ) { ?>
							<div class="wpbc_page_top__wizard_button_note wpbc_setup_wizard_bar_expandable<?php echo $is_step_saved ? ' wpbc_setup_wizard_bar_note_saved' : ''; ?>">
								<?php
								if ( $is_step_saved ) {
									esc_html_e( 'Changes saved. You can continue.', 'booking' );
								} else {
									echo wp_kses_post( $save_required_note );
								}
								?>
							</div>
						<?php } ?>
						<div class="wpbc_page_top__wizard_button_actions wpbc_setup_wizard_bar_expandable">
							<?php if ( ! empty( $prior_url ) ) { ?>
								<a href="<?php echo esc_url( $prior_url ); ?>" class="button button-secondary"><?php esc_html_e( 'Back', 'booking' ); ?></a>
							<?php } ?>
							<a href="<?php echo esc_url( $continue_href ); ?>"
							   class="button button-primary wpbc_setup_wizard_continue_button<?php echo $is_continue_disabled ? ' disabled' : ''; ?>"
							   data-wpbc-setup-continue-url="<?php echo esc_url( $continue_url ); ?>"
							   <?php echo $is_continue_disabled ? 'aria-disabled="true"' : ''; ?>><?php echo esc_html( $continue_title ); ?></a>
						</div>
						<div class="wpbc_page_top__wizard_button_links wpbc_setup_wizard_bar_expandable">
							<a href="<?php echo esc_url( $skip_wizard_url ); ?>"
							   title="<?php esc_attr_e( 'Exit and skip the setup wizard', 'booking' ); ?>">
								<?php esc_html_e( 'Exit and skip the setup wizard', 'booking' ); ?>
							</a>
							<a href="<?php echo esc_url( $reset_wizard_url ); ?>"
							   class="wpbc_setup_wizard_bar_danger_link"
							   title="<?php esc_attr_e( 'Start Setup from Beginning', 'booking' ); ?>">
								<?php esc_html_e( 'Reset Wizard', 'booking' ); ?>
							</a>
						</div>
					</div>
				</div>
			</div>
			<script type="text/javascript">
				jQuery( document ).ready( function() {
					var $bar = jQuery( '.wpbc_page_top__wizard_button[data-wpbc-setup-step]' ).first();
					var step = $bar.attr( 'data-wpbc-setup-step' ) || '';
					var saveBehavior = $bar.attr( 'data-wpbc-setup-save-behavior' ) || '';
					var selector = $bar.attr( 'data-wpbc-setup-target-selector' ) || '';
					var scrollSelector = $bar.attr( 'data-wpbc-setup-scroll-selector' ) || selector;
					var highlightSelector = $bar.attr( 'data-wpbc-setup-highlight-selector' ) || selector;
					var formSelector = $bar.attr( 'data-wpbc-setup-form-selector' ) || '';
					var saveSelector = $bar.attr( 'data-wpbc-setup-save-selector' ) || '';
					var saveEvents = ( $bar.attr( 'data-wpbc-setup-save-events' ) || '' ).split( ',' );
					var openAction = $bar.attr( 'data-wpbc-setup-open-action' ) || '';
					var ajaxUrl = $bar.attr( 'data-wpbc-setup-ajax-url' ) || '';
					var nonce = $bar.attr( 'data-wpbc-setup-mark-saved-nonce' ) || '';
					var $continueButton = $bar.find( '.wpbc_setup_wizard_continue_button' ).first();
					var $note = $bar.find( '.wpbc_page_top__wizard_button_note' ).first();
					var savedNote = '<?php echo esc_js( __( 'Changes saved. You can continue.', 'booking' ) ); ?>';
					var saveRequiredNote = <?php echo wp_json_encode( wp_kses_post( $save_required_note ) ); ?>;
					var $toggleButton = $bar.find( '.wpbc_setup_wizard_bar_toggle_button' ).first();
					var $toggleIcon = $toggleButton.find( 'i' ).first();
					var $resetButton = $bar.find( '.wpbc_setup_wizard_bar_reset_button' ).first();
					var $dragHandle = $bar.find( '.wpbc_setup_wizard_bar_drag_handle' ).first();
					var positionStorageKey = 'wpbc_setup_wizard_bar_position';
					var collapsedStorageKey = 'wpbc_setup_wizard_bar_collapsed';
					var collapseLabel = <?php echo wp_json_encode( __( 'Collapse setup bar', 'booking' ) ); ?>;
					var expandLabel = <?php echo wp_json_encode( __( 'Expand setup bar', 'booking' ) ); ?>;
					var $target;
					var saveClicked = false;

					function wpbcSetupWizardStorageGet( key ) {
						try {
							return window.localStorage.getItem( key );
						} catch ( _e ) {
							return null;
						}
					}

					function wpbcSetupWizardStorageSet( key, value ) {
						try {
							window.localStorage.setItem( key, value );
						} catch ( _e ) {}
					}

					function wpbcSetupWizardStorageRemove( key ) {
						try {
							window.localStorage.removeItem( key );
						} catch ( _e ) {}
					}

					function wpbcSetupWizardIsSmallViewport() {
						return window.matchMedia && window.matchMedia( '(max-width: 782px)' ).matches;
					}

					function wpbcSetupWizardClampPosition( left, bottom ) {
						var margin = 10;
						var barWidth = $bar.outerWidth() || 330;
						var barHeight = $bar.outerHeight() || 120;
						var maxLeft = Math.max( margin, jQuery( window ).width() - barWidth - margin );
						var maxBottom = Math.max( margin, jQuery( window ).height() - barHeight - margin );

						return {
							left: Math.min( Math.max( margin, left ), maxLeft ),
							bottom: Math.min( Math.max( margin, bottom ), maxBottom )
						};
					}

					function wpbcSetupWizardApplyPosition( position ) {
						var clampedPosition;
						var positionBottom;

						if ( wpbcSetupWizardIsSmallViewport() || ! position ) {
						$bar
							.removeClass( 'wpbc_setup_wizard_bar_is_moved' )
							.removeClass( 'wpbc_setup_wizard_bar_auto_shifted' )
							.css( {
								'--wpbc-setup-bar-left': '',
								'--wpbc-setup-bar-bottom': '',
								'--wpbc-setup-bar-auto-right': ''
							} );
						return;
					}

						positionBottom = parseFloat( position.bottom );
						if ( isNaN( positionBottom ) && ! isNaN( parseFloat( position.top ) ) ) {
							positionBottom = jQuery( window ).height() - parseFloat( position.top ) - ( $bar.outerHeight() || 120 );
						}

						clampedPosition = wpbcSetupWizardClampPosition( parseFloat( position.left ) || 15, isNaN( positionBottom ) ? 15 : positionBottom );
						$bar
							.addClass( 'wpbc_setup_wizard_bar_is_moved' )
							.removeClass( 'wpbc_setup_wizard_bar_auto_shifted' )
							.css( {
								'--wpbc-setup-bar-left': clampedPosition.left + 'px',
								'--wpbc-setup-bar-bottom': clampedPosition.bottom + 'px',
								'--wpbc-setup-bar-auto-right': ''
							} );
					}

					function wpbcSetupWizardGetRightSidebarOffset() {
						var viewportWidth = jQuery( window ).width();
						var viewportHeight = jQuery( window ).height();
						var $sidebar = jQuery();
						var sidebarSelectors = [
							'.wpbc_ui_el__vert_right_bar__wrapper',
							'.wpbc_ui_el__vert_right_bar',
							'.wpbc_ui_el__vert_right_bar__content',
							'.wpbc_ui_el__vert_right_bar__content .simplebar-content-wrapper'
						].join( ',' );

						jQuery( sidebarSelectors ).filter( ':visible' ).each( function() {
							var rect = this.getBoundingClientRect();

							if (
								rect.width >= 140
								&& rect.left > ( viewportWidth * 0.45 )
								&& rect.right > ( viewportWidth - 80 )
								&& rect.top < ( viewportHeight - 90 )
								&& rect.bottom > ( viewportHeight * 0.35 )
							) {
								$sidebar = jQuery( this );
								return false;
							}
						} );

						if ( ! $sidebar.length ) {
							return 0;
						}

						return Math.max( 0, viewportWidth - $sidebar[0].getBoundingClientRect().left + 15 );
					}

					function wpbcSetupWizardApplyDefaultPosition() {
						var rightOffset;
						var maxRight;
						var barWidth = $bar.outerWidth() || 330;

						if ( wpbcSetupWizardIsSmallViewport() ) {
							wpbcSetupWizardApplyPosition( null );
							return;
						}

						rightOffset = wpbcSetupWizardGetRightSidebarOffset();
						maxRight = Math.max( 15, jQuery( window ).width() - barWidth - 10 );

						if ( rightOffset > 15 ) {
							$bar
								.removeClass( 'wpbc_setup_wizard_bar_is_moved' )
								.addClass( 'wpbc_setup_wizard_bar_auto_shifted' )
								.css( {
									'--wpbc-setup-bar-left': '',
									'--wpbc-setup-bar-bottom': '',
									'--wpbc-setup-bar-auto-right': Math.min( rightOffset, maxRight ) + 'px'
								} );
							return;
						}

						wpbcSetupWizardApplyPosition( null );
					}

					function wpbcSetupWizardSavePosition( left, bottom ) {
						var clampedPosition = wpbcSetupWizardClampPosition( left, bottom );

						wpbcSetupWizardStorageSet( positionStorageKey, JSON.stringify( clampedPosition ) );
						wpbcSetupWizardApplyPosition( clampedPosition );
					}

					function wpbcSetupWizardApplySavedPosition() {
						var savedPosition = wpbcSetupWizardStorageGet( positionStorageKey );

						if ( ! savedPosition ) {
							wpbcSetupWizardApplyDefaultPosition();
							return;
						}

						try {
							wpbcSetupWizardApplyPosition( JSON.parse( savedPosition ) );
						} catch ( _e ) {
							wpbcSetupWizardStorageRemove( positionStorageKey );
							wpbcSetupWizardApplyDefaultPosition();
						}
					}

					function wpbcSetupWizardResetPosition() {
						wpbcSetupWizardStorageRemove( positionStorageKey );
						wpbcSetupWizardApplyDefaultPosition();
					}

					function wpbcSetupWizardSetCollapsed( isCollapsed ) {
						$bar.toggleClass( 'wpbc_setup_wizard_bar_collapsed', !! isCollapsed );
						$toggleButton
							.attr( 'aria-expanded', isCollapsed ? 'false' : 'true' )
							.attr( 'title', isCollapsed ? expandLabel : collapseLabel )
							.attr( 'aria-label', isCollapsed ? expandLabel : collapseLabel );
						$toggleIcon
							.toggleClass( 'wpbc_icn_expand_less', ! isCollapsed )
							.toggleClass( 'wpbc_icn_expand_more', !! isCollapsed );
						wpbcSetupWizardStorageSet( collapsedStorageKey, isCollapsed ? '1' : '0' );
						wpbcSetupWizardApplySavedPosition();
					}

					$toggleButton.on( 'click', function() {
						wpbcSetupWizardSetCollapsed( ! $bar.hasClass( 'wpbc_setup_wizard_bar_collapsed' ) );
					} );

					$resetButton.on( 'click', function() {
						wpbcSetupWizardResetPosition();
					} );

					$dragHandle.on( 'mousedown', function( event ) {
						var startX;
						var startY;
						var startLeft;
						var startBottom;
						var rect;
						var barHeight;

						if ( wpbcSetupWizardIsSmallViewport() || ( event.which && 1 !== event.which ) ) {
							return;
						}

						event.preventDefault();
						rect = $bar[0].getBoundingClientRect();
						startX = event.clientX;
						startY = event.clientY;
						startLeft = rect.left;
						barHeight = $bar.outerHeight() || rect.height || 120;
						startBottom = jQuery( window ).height() - rect.top - barHeight;
						$bar.addClass( 'wpbc_setup_wizard_bar_is_dragging' );

						jQuery( document )
							.off( '.wpbc_setup_wizard_bar_drag' )
							.on( 'mousemove.wpbc_setup_wizard_bar_drag', function( moveEvent ) {
								wpbcSetupWizardApplyPosition( {
									left: startLeft + moveEvent.clientX - startX,
									bottom: startBottom - moveEvent.clientY + startY
								} );
							} )
							.on( 'mouseup.wpbc_setup_wizard_bar_drag', function( upEvent ) {
								var movedRect = $bar[0].getBoundingClientRect();
								var movedBottom = jQuery( window ).height() - movedRect.top - ( $bar.outerHeight() || movedRect.height || 120 );

								wpbcSetupWizardSavePosition( movedRect.left, movedBottom );
								$bar.removeClass( 'wpbc_setup_wizard_bar_is_dragging' );
								jQuery( document ).off( '.wpbc_setup_wizard_bar_drag' );
							} );
					} );

					wpbcSetupWizardSetCollapsed( '1' === wpbcSetupWizardStorageGet( collapsedStorageKey ) );
					wpbcSetupWizardApplySavedPosition();
					setTimeout( wpbcSetupWizardApplySavedPosition, 400 );
					setTimeout( wpbcSetupWizardApplySavedPosition, 1000 );
					jQuery( window ).on( 'resize.wpbc_setup_wizard_bar', wpbcSetupWizardApplySavedPosition );

					function wpbcSetupWizardOpenPublishArea() {
						var isResourcesPage = -1 !== window.location.href.indexOf( 'page=wpbc-resources' );
						var publishTabSelectors = [
							'.wpdvlp-sub-tabs .nav-tab',
							'.wpdvlp-top-tabs .nav-tab',
							'.wpbc_settings_navigation_item a',
							'.wpbc_ui_el__vert_nav_item a',
							'[role="tab"]',
							'[data-tab]',
							'[data-subtab]'
						].join( ',' );
						var publishToggleSelectors = [
							'.wpbc_resource_field__switchable a',
							'.wpbc_resource_field__switchable button',
							'.wpbc_ajx_toolbar a',
							'.wpbc_ajx_toolbar button',
							'a.button',
							'button.button'
						].join( ',' );
						var publishTargetSelector = [
							'.wpbc_resources_table .ui_group__publish_btn:visible',
							'.wpbc_resource_field__switchable.wpbc_resource_field__publish:visible',
							'.wpbc_resource_field__publish:visible',
							'.wpbc_resource_publish:visible',
							'.wpbc_publish_resources:visible',
							'.wpbc_resource_shortcode:visible',
							'[data-wpbc-resource-publish]:visible',
							'#wpbc_booking_resource_table:visible'
						].join( ',' );
						var $publishTab;
						var $publishToggle;

						if ( ( 'wizard_publish' !== step && 'publish_area' !== openAction ) || ! isResourcesPage ) {
							return;
						}

						$publishTab = jQuery( publishTabSelectors ).filter( ':visible' ).filter( function() {
							var $element = jQuery( this );
							var text = $element.text() || '';
							var href = $element.attr( 'href' ) || '';
							var dataTab = $element.attr( 'data-tab' ) || '';
							var dataSubtab = $element.attr( 'data-subtab' ) || '';
							var haystack = ( text + ' ' + href + ' ' + dataTab + ' ' + dataSubtab ).toLowerCase();

							if ( $element.closest( '.wpbc_page_top__wizard_button' ).length ) {
								return false;
							}

							return (
								-1 !== haystack.indexOf( 'publish' )
								|| -1 !== haystack.indexOf( 'shortcode' )
								|| -1 !== haystack.indexOf( 'embed' )
							);
						} ).first();

						if ( $publishTab.length && ! $publishTab.hasClass( 'nav-tab-active' ) && ! $publishTab.parent().hasClass( 'active' ) ) {
							$publishTab.trigger( 'click' );
						}

						if ( ! $publishTab.length ) {
							$publishToggle = jQuery( publishToggleSelectors ).filter( ':visible' ).filter( function() {
								var $element = jQuery( this );
								var text = $element.text() || '';
								var title = $element.attr( 'title' ) || $element.attr( 'data-original-title' ) || '';
								var onclick = $element.attr( 'onclick' ) || '';
								var className = $element.attr( 'class' ) || '';
								var haystack = ( text + ' ' + title + ' ' + className ).toLowerCase();

								if ( $element.closest( '.wpbc_page_top__wizard_button' ).length ) {
									return false;
								}

								if ( -1 !== onclick.indexOf( 'wpbc_modal_dialog__show__resource_publish' ) ) {
									return false;
								}

								return (
									-1 !== haystack.indexOf( 'show publish' )
									|| -1 !== haystack.indexOf( 'publish option' )
									|| -1 !== haystack.indexOf( 'shortcode' )
									|| -1 !== haystack.indexOf( 'resource_field__publish' )
								);
							} ).first();

							if ( $publishToggle.length ) {
								$publishToggle.trigger( 'click' );
							}
						}

						setTimeout( function() {
							var $publishTarget = jQuery( publishTargetSelector ).first();

							if ( ! $publishTarget.length ) {
								$publishTarget = jQuery( selector ).filter( ':visible' ).first();
							}

							if ( ! $publishTarget.length ) {
								return;
							}

							if ( typeof wpbc_scroll_to === 'function' ) {
								wpbc_scroll_to( $publishTarget );
							} else if ( $publishTarget.offset() ) {
								jQuery( 'html, body' ).animate( { scrollTop: $publishTarget.offset().top - 80 }, 300 );
							}

							if ( typeof wpbc_blink_element === 'function' ) {
								wpbc_blink_element( $publishTarget, 3, 300 );
							}
						}, 450 );
					}

					wpbcSetupWizardOpenPublishArea();

					function wpbcSetupWizardGetFirstElement( selectors ) {
						var $element = jQuery();

						if ( ! selectors ) {
							return $element;
						}

						try {
							$element = jQuery( selectors ).filter( ':visible' ).first();
							if ( $element.length ) {
								return $element;
							}
							return jQuery( selectors ).first();
						} catch ( _e ) {
							return jQuery();
						}
					}

					function wpbcSetupWizardGetScrollableParent( $element ) {
						var $scrollParent;

						if ( ! $element || ! $element.length ) {
							return jQuery();
						}

						$scrollParent = $element.parents().filter( function() {
							var $parent = jQuery( this );
							var overflowY = $parent.css( 'overflow-y' );

							return (
								/(auto|scroll)/.test( overflowY )
								&& this.scrollHeight > Math.ceil( $parent.innerHeight() ) + 5
							);
						} ).first();

						return $scrollParent;
					}

					function wpbcSetupWizardScrollToElement( $element ) {
						var $scrollParent;
						var targetTop;

						if ( ! $element || ! $element.length || ! $element.offset() ) {
							return;
						}

						$scrollParent = wpbcSetupWizardGetScrollableParent( $element );
						if ( $scrollParent.length && ! $scrollParent.is( 'html, body' ) ) {
							targetTop = $element.offset().top - $scrollParent.offset().top + $scrollParent.scrollTop() - 40;
							$scrollParent.stop().animate( {
								scrollTop: Math.max( 0, targetTop )
							}, 350 );
							return;
						}

						if ( typeof wpbc_scroll_to === 'function' ) {
							wpbc_scroll_to( $element );
						} else {
							jQuery( 'html, body' ).stop().animate( {
								scrollTop: Math.max( 0, $element.offset().top - 90 )
							}, 350 );
						}
					}

					function wpbcSetupWizardHighlightElement( $element ) {
						if ( ! $element || ! $element.length ) {
							return;
						}

						$element.addClass( 'wpbc_setup_wizard__target_highlight' );
						if ( typeof wpbc_blink_element === 'function' ) {
							wpbc_blink_element( $element, 3, 300 );
						}
					}

					function wpbcSetupWizardPulseElement( $element ) {
						if ( ! $element || ! $element.length ) {
							return;
						}

						$element
							.removeClass( 'wpbc_setup_wizard_attention_pulse' )
							.each( function() {
								// Restart the CSS animation when the user clicks Continue repeatedly.
								void this.offsetWidth;
							} )
							.addClass( 'wpbc_setup_wizard_attention_pulse' );

						setTimeout( function() {
							$element.removeClass( 'wpbc_setup_wizard_attention_pulse' );
						}, 2100 );
					}

					function wpbcSetupWizardPulseSaveRequiredMessage() {
						if ( $bar.hasClass( 'wpbc_setup_wizard_bar_collapsed' ) ) {
							wpbcSetupWizardSetCollapsed( false );
						}

						if ( $note.length ) {
							wpbcSetupWizardPulseElement( $note );
						}

						setTimeout( function() {
							wpbcSetupWizardPulseElement( jQuery( '#ajax_working .wpbc_inner_message.notice-warning' ).last() );
						}, 50 );
					}

					function wpbcSetupWizardSetSaved() {
						$bar.attr( 'data-wpbc-setup-is-saved', '1' );
						$continueButton
							.removeClass( 'disabled' )
							.removeAttr( 'aria-disabled' )
							.attr( 'href', $continueButton.attr( 'data-wpbc-setup-continue-url' ) || '#' );
						if ( $note.length ) {
							$note
								.addClass( 'wpbc_setup_wizard_bar_note_saved' )
								.text( savedNote );
						}
					}

					function wpbcSetupWizardSetUnsaved() {
						$bar.attr( 'data-wpbc-setup-is-saved', '0' );
						$continueButton
							.addClass( 'disabled' )
							.attr( 'aria-disabled', 'true' )
							.attr( 'href', '#wpbc_setup_save_required' );
						if ( $note.length ) {
							$note
								.removeClass( 'wpbc_setup_wizard_bar_note_saved' )
								.html( saveRequiredNote );
						}
					}

					function wpbcSetupWizardMarkSaved() {
						if ( ! step || ! ajaxUrl || ! nonce ) {
							wpbcSetupWizardSetSaved();
							return;
						}

						jQuery.post( ajaxUrl, {
							action: 'WPBC_AJX_SETUP_WIZARD_MARK_STEP_SAVED',
							nonce: nonce,
							wpbc_setup_step: step
						} ).done( function( response ) {
							if ( 'string' === typeof response ) {
								try {
									response = JSON.parse( response );
								} catch ( _e ) {}
							}
							if ( response && response.success ) {
								wpbcSetupWizardSetSaved();
							}
						} );
					}

					function wpbcSetupWizardSaveStarted() {
						saveClicked = true;
					}

					function wpbcSetupWizardLooksSuccessfulResponse( response ) {
						if ( ! response ) {
							return true;
						}

						return (
							!! response.success
							|| 'success' === response.status
							|| '1' === String( response.ajx_after_action_result || '' )
							|| ( response.ajx_data && '1' === String( response.ajx_data.ajx_after_action_result || '' ) )
							|| ( response.data && response.data.setup_step_saved )
						);
					}

					function wpbcSetupWizardRegisterSavedEvent( eventName ) {
						eventName = ( eventName || '' ).replace( /^\s+|\s+$/g, '' );
						if ( ! eventName ) {
							return;
						}

						document.addEventListener( eventName, function() {
							wpbcSetupWizardSetSaved();
							wpbcSetupWizardMarkSaved();
						}, true );
					}

					if ( 'manual_save_required' === saveBehavior ) {
						window.wpbc_setup_wizard_set_current_step_saved = wpbcSetupWizardSetSaved;
						window.wpbc_setup_wizard_mark_current_step_saved = wpbcSetupWizardMarkSaved;

						document.addEventListener( 'wpbc:bfb:form:before_save_payload', function( event ) {
							if ( ! event || ! event.detail || ! event.detail.payload || ! step ) {
								return;
							}
							wpbcSetupWizardSaveStarted();
							event.detail.payload.wpbc_setup = '1';
							event.detail.payload.wpbc_setup_step = step;
						}, true );

						saveEvents.forEach( wpbcSetupWizardRegisterSavedEvent );

						if ( formSelector ) {
							jQuery( formSelector ).each( function() {
								var $form = jQuery( this );
								if ( ! $form.is( 'form' ) ) {
									return;
								}
								if ( ! $form.find( 'input[name="wpbc_setup_saved_step"]' ).length ) {
									$form.append( '<input type="hidden" name="wpbc_setup_saved_step" value="" />' );
								}
								if ( ! $form.find( 'input[name="wpbc_setup_step"]' ).length ) {
									$form.append( '<input type="hidden" name="wpbc_setup_step" value="" />' );
								}
								if ( ! $form.find( 'input[name="wpbc_setup"]' ).length ) {
									$form.append( '<input type="hidden" name="wpbc_setup" value="" />' );
								}
								$form.find( 'input[name="wpbc_setup_saved_step"]' ).val( step );
								$form.find( 'input[name="wpbc_setup_step"]' ).val( step );
								$form.find( 'input[name="wpbc_setup"]' ).val( '1' );
								$form
									.off( 'change.wpbc_setup_wizard input.wpbc_setup_wizard', ':input' )
									.on( 'change.wpbc_setup_wizard input.wpbc_setup_wizard', ':input', function() {
										if ( jQuery( this ).is( '[name="wpbc_setup_saved_step"],[name="wpbc_setup_step"],[name="wpbc_setup"],[name="form_visible_section"]' ) ) {
											return;
										}
										wpbcSetupWizardSetUnsaved();
									} );
								$form
									.off( 'submit.wpbc_setup_wizard' )
									.on( 'submit.wpbc_setup_wizard', function() {
										wpbcSetupWizardSaveStarted();
										$form.find( 'input[name="wpbc_setup_saved_step"]' ).val( step );
										$form.find( 'input[name="wpbc_setup_step"]' ).val( step );
										$form.find( 'input[name="wpbc_setup"]' ).val( '1' );
									} );
							} );
						}

						$continueButton.on( 'click', function( event ) {
							if ( '1' !== $bar.attr( 'data-wpbc-setup-is-saved' ) ) {
								event.preventDefault();
								if ( typeof wpbc_admin_show_message === 'function' ) {
									wpbc_admin_show_message( '<?php echo esc_js( __( 'Please save changes on this page before continuing setup.', 'booking' ) ); ?>', 'warning', 4000, false );
								}
								wpbcSetupWizardPulseSaveRequiredMessage();
							}
						} );

						if ( saveSelector ) {
							jQuery( document )
								.on( 'mousedown.wpbc_setup_wizard click.wpbc_setup_wizard', saveSelector, wpbcSetupWizardSaveStarted )
								.on( 'keydown.wpbc_setup_wizard', saveSelector, function( event ) {
									if ( 13 === event.which || 32 === event.which ) {
										wpbcSetupWizardSaveStarted();
									}
								} );
						}

						jQuery( document ).ajaxComplete( function( _event, xhr ) {
							var response;
							if ( ! saveClicked ) {
								return;
							}
							saveClicked = false;

							response = xhr && xhr.responseJSON ? xhr.responseJSON : null;
							if ( ! response && xhr && xhr.responseText ) {
								try {
									response = JSON.parse( xhr.responseText );
								} catch ( _e ) {}
							}
							if ( response && response.data && response.data.setup_step_saved ) {
								wpbcSetupWizardSetSaved();
							} else if ( wpbcSetupWizardLooksSuccessfulResponse( response ) ) {
								wpbcSetupWizardMarkSaved();
							}
						} );
					}

					if ( ! selector && ! scrollSelector && ! highlightSelector ) {
						return;
					}

					$target = wpbcSetupWizardGetFirstElement( highlightSelector || selector );
					if ( $target.length ) {
						wpbcSetupWizardHighlightElement( $target );
					}

					setTimeout( function() {
						var $scrollTarget = wpbcSetupWizardGetFirstElement( scrollSelector || highlightSelector || selector );
						if ( ! $scrollTarget.length ) {
							$scrollTarget = $target;
						}
						wpbcSetupWizardScrollToElement( $scrollTarget );
					}, 250 );
				} );
			</script><?php
		}
	}

}
function wpbc_init_setup_wizard(){
	$setup_steps = new WPBC_SETUP_WIZARD_STEPS();
}
// $setup_steps = new WPBC_SETUP_WIZARD_STEPS();
add_action( 'init',   'wpbc_init_setup_wizard'  );



/**
* On plugin  activation set all steps as completed in Live Demos
* @return void
*/
function wpbc_booking_activate_plugin__wizard() {
	if ( wpbc_is_this_demo() ) {
		$setup_steps  = new WPBC_SETUP_WIZARD_STEPS();
		$is_completed = true;
		$setup_steps->db__set_all_steps_as( $is_completed );
	}
}
add_bk_action( 'wpbc_other_versions_activation',  'wpbc_booking_activate_plugin__wizard'  );
