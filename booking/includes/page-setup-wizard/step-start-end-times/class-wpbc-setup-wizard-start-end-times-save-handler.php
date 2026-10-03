<?php
/**
 * Progressive save handler for Setup Wizard Start and End Times.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Save validated Form Builder-compatible time choices to the checkpoint.
 *
 * This handler intentionally records wizard metadata only. Applying the lists
 * to `starttime` and `endtime` fields belongs to the later Booking Form step,
 * which owns the selected template and canonical form mutation.
 */
final class WPBC_Setup_Wizard_Start_End_Times_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Start_End_Times */
	private $start_end_times;

	/**
	 * Build the handler around the reusable validator.
	 *
	 * @param WPBC_Setup_Wizard_Start_End_Times|null $start_end_times Optional service for tests.
	 */
	public function __construct( $start_end_times = null ) {
		$this->start_end_times = $start_end_times instanceof WPBC_Setup_Wizard_Start_End_Times
			? $start_end_times
			: new WPBC_Setup_Wizard_Start_End_Times();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'start_end_times';
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
	 * Revalidate and record the time-choice operation result.
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
		if ( ! WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_end_configuration( $journey_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_start_end_times_journey_invalid', __( 'Start and End Times cannot be saved for the selected customer journey.', 'booking' ) );
		}

		$time_choices = isset( $validated_fields['start_end_times'] ) ? $validated_fields['start_end_times'] : array();
		$time_choices = $this->start_end_times->validate_start_end_times( $time_choices, true );
		if ( is_wp_error( $time_choices ) ) {
			return $time_choices;
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => __( 'Start and End Time choices saved.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $time_choices ) ),
			'created_ids'               => array(),
			'updated_ids'               => array(),
			'warnings'                  => array(),
			'writes_canonical_settings' => false,
		);
	}

	/**
	 * Time choices do not complete the setup route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
