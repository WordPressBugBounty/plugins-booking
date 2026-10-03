<?php
/**
 * Progressive save handler for Setup Wizard Fixed Time Slots.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Save validated Form Builder-compatible fixed slots to the checkpoint.
 */
final class WPBC_Setup_Wizard_Fixed_Time_Slots_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Fixed_Time_Slots */
	private $fixed_time_slots;

	/**
	 * Build the handler around the reusable validator.
	 *
	 * @param WPBC_Setup_Wizard_Fixed_Time_Slots|null $fixed_time_slots Optional service for tests.
	 */
	public function __construct( $fixed_time_slots = null ) {
		$this->fixed_time_slots = $fixed_time_slots instanceof WPBC_Setup_Wizard_Fixed_Time_Slots
			? $fixed_time_slots
			: new WPBC_Setup_Wizard_Fixed_Time_Slots();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'fixed_time_slots';
	}

	/**
	 * Return the explicit action label.
	 *
	 * @param array<string,mixed> $checkpoint   Current checkpoint.
	 * @param array<string,mixed> $step_context Authorized presentation context.
	 *
	 * @return string Translated action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		unset( $checkpoint, $step_context );

		return __( 'Save & continue', 'booking' );
	}

	/**
	 * Revalidate and record the fixed-slot operation result.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or an error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $operation_context );

		$journey_id = isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $checkpoint['values']['customer_journey']['customer_journey'] )
			: '';
		if ( ! WPBC_Setup_Wizard_Customer_Journey_Policy::uses_fixed_time_slots_configuration( $journey_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_journey_invalid', __( 'Fixed time slots cannot be saved for the selected customer journey.', 'booking' ) );
		}

		$time_slots = isset( $validated_fields['fixed_time_slots'] ) ? $validated_fields['fixed_time_slots'] : array();
		$time_slots = $this->fixed_time_slots->validate_fixed_time_slots( $time_slots, true );
		if ( is_wp_error( $time_slots ) ) {
			return $time_slots;
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => __( 'Fixed time slots saved.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $time_slots ) ),
			'created_ids'               => array(),
			'updated_ids'               => array(),
			'warnings'                  => array(),
			'writes_canonical_settings' => false,
		);
	}

	/**
	 * Fixed slots do not complete the setup route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
