<?php
/**
 * Progressive save handler for Setup Wizard Days Off.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Apply the complete staged Days Off proposal at one explicit save boundary.
 */
final class WPBC_Setup_Wizard_Days_Off_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Days_Off */
	private $days_off;

	/**
	 * Build the handler around the Availability domain service.
	 *
	 * @param WPBC_Setup_Wizard_Days_Off|null $days_off Optional domain service for tests.
	 */
	public function __construct( $days_off = null ) {
		$this->days_off = $days_off instanceof WPBC_Setup_Wizard_Days_Off ? $days_off : new WPBC_Setup_Wizard_Days_Off();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'days_off';
	}

	/**
	 * Return the ordinary scalar/domain action label.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 * @param array<string,mixed> $step_context Authorized context.
	 *
	 * @return string Translated label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		unset( $checkpoint, $step_context );
		return __( 'Save & continue', 'booking' );
	}

	/**
	 * Save and verify staged unavailable dates.
	 *
	 * @param array<string,mixed> $validated_fields Validated fields.
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 * @param array<string,mixed> $operation_context Operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Save result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $checkpoint, $operation_context );

		$staged = isset( $validated_fields['days_off'] ) ? $validated_fields['days_off'] : array();
		$staged = $this->days_off->validate_staged_values( $staged, true );
		if ( is_wp_error( $staged ) ) {
			return $staged;
		}

		$can_manage = $this->days_off->current_user_can_manage();
		$saved_state = $this->days_off->save_staged_values( $staged );
		if ( is_wp_error( $saved_state ) ) {
			return $saved_state;
		}

		$canonical_dates = isset( $saved_state['unavailable_dates'] ) && is_array( $saved_state['unavailable_dates'] ) ? $saved_state['unavailable_dates'] : array();
		return array(
			'status'                    => 'saved',
			'summary'                   => $can_manage ? __( 'Days Off saved.', 'booking' ) : __( 'Days Off was skipped because date availability is not editable in this environment.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $canonical_dates ) ),
			'created_ids'               => array(),
			'updated_ids'               => $can_manage ? array( 'booking_date_avalability' ) : array(),
			'warnings'                  => $can_manage ? array() : array( __( 'Date availability was not changed.', 'booking' ) ),
			'writes_canonical_settings' => $can_manage,
		);
	}

	/**
	 * Days Off is not the terminal route step.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
