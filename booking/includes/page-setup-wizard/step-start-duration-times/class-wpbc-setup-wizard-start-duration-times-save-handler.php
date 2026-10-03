<?php
/**
 * Progressive save handler for Setup Wizard Start Time and Duration.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Save validated Form Builder-compatible choices to the checkpoint.
 */
final class WPBC_Setup_Wizard_Start_Duration_Times_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Start_Duration_Times */
	private $start_duration_times;

	/**
	 * Build the handler around the reusable validator.
	 *
	 * @param WPBC_Setup_Wizard_Start_Duration_Times|null $start_duration_times Optional service for tests.
	 */
	public function __construct( $start_duration_times = null ) {
		$this->start_duration_times = $start_duration_times instanceof WPBC_Setup_Wizard_Start_Duration_Times
			? $start_duration_times
			: new WPBC_Setup_Wizard_Start_Duration_Times();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'start_duration_times';
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
	 * Revalidate and record the checkpoint-only proposal result.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Normalized save result or an error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $operation_context );

		$journey_id = isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $checkpoint['values']['customer_journey']['customer_journey'] )
			: '';
		if ( ! WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_duration_configuration( $journey_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_start_duration_times_journey_invalid', __( 'Start Time and Duration choices cannot be saved for the selected customer journey.', 'booking' ) );
		}

		$time_choices = isset( $validated_fields['start_duration_times'] ) ? $validated_fields['start_duration_times'] : array();
		$time_choices = $this->start_duration_times->validate_start_duration_times( $time_choices, true );
		if ( is_wp_error( $time_choices ) ) {
			return $time_choices;
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => __( 'Start time and duration choices saved for the Booking Form step.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $time_choices ) ),
			'created_ids'               => array(),
			'updated_ids'               => array(),
			'warnings'                  => array(),
			'writes_canonical_settings' => false,
		);
	}

	/**
	 * Start Time and Duration choices do not complete the setup route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
