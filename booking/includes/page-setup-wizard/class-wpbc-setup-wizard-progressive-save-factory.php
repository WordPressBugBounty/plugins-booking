<?php
/**
 * Setup Wizard progressive-save collaborator factory.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build shared progressive-save services from one server-owned step registry.
 */
final class WPBC_Setup_Wizard_Progressive_Save_Factory {

	/**
	 * Register progressive handlers and checkpoint-only terminal steps.
	 *
	 * Phase 5 adds publishing as its own domain handler. The terminal review
	 * remains checkpoint-only without adding domain conditions to the coordinator.
	 *
	 * @param WPBC_Setup_Wizard_Step_Registry $step_registry Server-owned step registry.
	 *
	 * @return WPBC_Setup_Wizard_Step_Save_Registry Save-handler registry.
	 */
	public static function create_save_registry( WPBC_Setup_Wizard_Step_Registry $step_registry ) {
		$handlers = array(
			new WPBC_Setup_Wizard_Metadata_Save_Handler(
				'welcome',
				__( 'Welcome step completed.', 'booking' )
			),
			new WPBC_Setup_Wizard_Metadata_Save_Handler(
				'business_details',
				__( 'Business details saved for Setup Wizard guidance.', 'booking' )
			),
			new WPBC_Setup_Wizard_Date_Time_Formats_Save_Handler(),
			new WPBC_Setup_Wizard_Booking_Mode_Save_Handler(),
			new WPBC_Setup_Wizard_Customer_Journey_Save_Handler(),
			new WPBC_Setup_Wizard_Date_Selection_Save_Handler(),
			new WPBC_Setup_Wizard_Services_Save_Handler(),
			new WPBC_Setup_Wizard_Booking_Resources_Save_Handler(),
			new WPBC_Setup_Wizard_Start_End_Times_Save_Handler(),
			new WPBC_Setup_Wizard_Start_Duration_Times_Save_Handler(),
			new WPBC_Setup_Wizard_Fixed_Time_Slots_Save_Handler(),
			new WPBC_Setup_Wizard_Working_Hours_Save_Handler(),
			new WPBC_Setup_Wizard_Days_Off_Save_Handler(),
			new WPBC_Setup_Wizard_Booking_Form_Template_Save_Handler(),
			new WPBC_Setup_Wizard_Appearance_Save_Handler(),
			new WPBC_Setup_Wizard_Publish_Integration_Save_Handler(),
		);
		$progressive_step_ids = array( 'welcome', 'business_details', 'date_time_formats', 'booking_experience', 'customer_journey', 'date_selection', 'services', 'booking_resources', 'start_end_times', 'start_duration_times', 'fixed_time_slots', 'working_hours', 'days_off', 'booking_form_template', 'appearance', 'publish_integration' );
		foreach ( array_keys( $step_registry->get_steps() ) as $step_id ) {
			if ( in_array( $step_id, $progressive_step_ids, true ) ) {
				continue;
			}

			$is_terminal = 'review_setup' === $step_id;
			$handlers[]  = new WPBC_Setup_Wizard_Checkpoint_Only_Save_Handler(
				$step_id,
				$is_terminal ? __( 'Finish setup', 'booking' ) : __( 'Save & continue', 'booking' ),
				$is_terminal
			);
		}

		return new WPBC_Setup_Wizard_Step_Save_Registry( $handlers );
	}

	/**
	 * Build the progressive-save coordinator.
	 *
	 * @param WPBC_Setup_Wizard_Draft_Store     $checkpoint_store Checkpoint persistence.
	 * @param WPBC_Setup_Wizard_Draft_Validator $draft_validator  Step validation service.
	 * @param WPBC_Setup_Wizard_Step_Registry   $step_registry    Server-owned step registry.
	 *
	 * @return WPBC_Setup_Wizard_Progressive_Save_Coordinator Coordinator.
	 */
	public static function create_coordinator( WPBC_Setup_Wizard_Draft_Store $checkpoint_store, WPBC_Setup_Wizard_Draft_Validator $draft_validator, WPBC_Setup_Wizard_Step_Registry $step_registry ) {
		return new WPBC_Setup_Wizard_Progressive_Save_Coordinator(
			$checkpoint_store,
			$draft_validator,
			self::create_save_registry( $step_registry ),
			new WPBC_Setup_Wizard_WordPress_Operation_Lock()
		);
	}
}
