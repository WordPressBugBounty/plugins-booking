<?php
/**
 * Progressive save handler for Setup Wizard Working Hours.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist the default weekly Working Time schedule for routes that expose it.
 */
final class WPBC_Setup_Wizard_Working_Hours_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Working_Hours */
	private $working_hours;

	/**
	 * Build the handler around the Working Hours validator.
	 *
	 * @param WPBC_Setup_Wizard_Working_Hours|null $working_hours Optional domain service for tests.
	 */
	public function __construct( $working_hours = null ) {
		$this->working_hours = $working_hours instanceof WPBC_Setup_Wizard_Working_Hours
			? $working_hours
			: new WPBC_Setup_Wizard_Working_Hours();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'working_hours';
	}

	/**
	 * Return the explicit Working Hours action label.
	 *
	 * @param array<string,mixed> $checkpoint   Current checkpoint.
	 * @param array<string,mixed> $step_context Authorized presentation context.
	 *
	 * @return string Translated action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		unset( $checkpoint, $step_context );

		return __( 'Apply working hours & continue', 'booking' );
	}

	/**
	 * Save, verify, and compensate the canonical default weekly schedule.
	 *
	 * Resource-specific Working Time overrides are intentionally retained because
	 * the wizard owns only the default schedule exposed by this page.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $operation_context );

		if ( ! WPBC_Setup_Wizard_Customer_Journey_Policy::uses_working_hours_configuration( $this->get_customer_journey_id( $checkpoint ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_journey_invalid', __( 'Working Hours cannot be saved for the selected customer journey.', 'booking' ) );
		}
		if ( ! $this->working_hours->current_user_can_manage() ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_forbidden', __( 'You are not allowed to change global Working Hours.', 'booking' ) );
		}
		if ( ! function_exists( 'wpbc_working_time__get_settings' ) || ! function_exists( 'wpbc_working_time__update_settings' ) ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_unavailable', __( 'Working Hours storage is not available.', 'booking' ) );
		}

		$submitted_schedule = isset( $validated_fields['working_hours'] ) ? $validated_fields['working_hours'] : array();
		$submitted_schedule = $this->working_hours->validate_working_hours( $submitted_schedule, true );
		if ( is_wp_error( $submitted_schedule ) ) {
			return $submitted_schedule;
		}

		$before_settings = wpbc_working_time__get_settings();
		if ( ! is_array( $before_settings ) ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_read_failed', __( 'Current Working Hours could not be read safely.', 'booking' ) );
		}

		$next_settings                        = $before_settings;
		$next_settings['enabled']             = $submitted_schedule['enabled'];
		$next_settings['default']             = isset( $next_settings['default'] ) && is_array( $next_settings['default'] ) ? $next_settings['default'] : array();
		$next_settings['default']['weekdays'] = $submitted_schedule['weekdays'];
		$expected_settings                    = function_exists( 'wpbc_working_time__normalize_settings' )
			? wpbc_working_time__normalize_settings( $next_settings )
			: $next_settings;

		$save_result = wpbc_working_time__update_settings( $next_settings );
		if ( false === $save_result || ! $this->settings_match( $expected_settings, wpbc_working_time__get_settings() ) ) {
			wpbc_working_time__update_settings( $before_settings );
			$was_restored = $this->settings_match( $before_settings, wpbc_working_time__get_settings() );
			$message      = $was_restored
				? __( 'Working Hours could not be saved. The previous schedule was restored.', 'booking' )
				: __( 'Working Hours could not be saved or restored completely. Review General Availability before continuing.', 'booking' );

			return new WP_Error( 'wpbc_setup_wizard_working_hours_not_saved', $message );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => 'On' === $submitted_schedule['enabled']
				? __( 'Working Hours applied.', 'booking' )
				: __( 'Working Hours disabled.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $submitted_schedule ) ),
			'created_ids'               => array(),
			'updated_ids'               => array( 'booking_working_time_enabled', 'booking_working_time_rules' ),
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Compare complete normalized Working Time settings with a canonical readback.
	 *
	 * @param array<string,mixed> $expected_settings  Expected normalized settings.
	 * @param mixed               $canonical_settings Canonical readback candidate.
	 *
	 * @return bool True when the default schedule and preserved resource overrides match.
	 */
	private function settings_match( array $expected_settings, $canonical_settings ) {
		if ( ! is_array( $canonical_settings ) ) {
			return false;
		}

		$canonical_settings = function_exists( 'wpbc_working_time__normalize_settings' )
			? wpbc_working_time__normalize_settings( $canonical_settings )
			: $canonical_settings;

		return $expected_settings === $canonical_settings;
	}

	/**
	 * Read the saved Customer Journey.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return string Journey ID.
	 */
	private function get_customer_journey_id( array $checkpoint ) {
		return isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $checkpoint['values']['customer_journey']['customer_journey'] )
			: '';
	}

	/**
	 * Working Hours do not complete the route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
