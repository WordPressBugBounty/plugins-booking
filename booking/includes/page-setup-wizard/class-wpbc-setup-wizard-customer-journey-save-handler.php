<?php
/**
 * Progressive save handler for Setup Wizard Customer Journey.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Save Customer Journey metadata and enforce journey-owned canonical defaults.
 *
 * Most journeys remain wizard-only metadata. First-date start and last-date end
 * is different: its explicit boundary times must not be filtered by the global
 * weekly Working Hours restriction. That restriction is disabled atomically at
 * the journey-save boundary before the route skips the Working Hours page.
 */
final class WPBC_Setup_Wizard_Customer_Journey_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Working_Hours */
	private $working_hours;

	/**
	 * Build the handler around the Working Hours authorization boundary.
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
	 * @return string Stable step identifier.
	 */
	public function get_step_id() {
		return 'customer_journey';
	}

	/**
	 * Return the ordinary progressive-save action label.
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
	 * Save the journey and disable Working Hours for the boundary-time flow.
	 *
	 * Existing default weekdays and Resource-specific overrides are preserved.
	 * A failed readback is compensated with the complete before-image so a
	 * partially written pair of canonical options is never accepted as saved.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or bounded error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $checkpoint, $operation_context );

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			return new WP_Error(
				'wpbc_setup_wizard_customer_journey_forbidden',
				__( 'You are not allowed to save this Customer Journey.', 'booking' )
			);
		}

		$journey_id = isset( $validated_fields['customer_journey'] ) && is_scalar( $validated_fields['customer_journey'] )
			? sanitize_key( (string) $validated_fields['customer_journey'] )
			: '';
		if (
			! WPBC_Setup_Wizard_Customer_Journey_Policy::is_registered_journey( $journey_id )
			|| ! WPBC_Setup_Wizard_Customer_Journey_Policy::is_journey_available( $journey_id )
		) {
			return new WP_Error( 'wpbc_setup_wizard_customer_journey_invalid', __( 'The selected Customer Journey is not available.', 'booking' ) );
		}

		if ( 'first_start_last_end' !== $journey_id ) {
			return $this->create_result( $journey_id, array(), false, __( 'Customer Journey saved for Setup Wizard recommendations.', 'booking' ) );
		}

		if ( ! $this->working_hours->current_user_can_manage() ) {
			return new WP_Error(
				'wpbc_setup_wizard_customer_journey_working_hours_forbidden',
				__( 'You are not allowed to disable global Working Hours for this Customer Journey.', 'booking' )
			);
		}
		if ( ! function_exists( 'wpbc_working_time__get_settings' ) || ! function_exists( 'wpbc_working_time__update_settings' ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_customer_journey_working_hours_unavailable',
				__( 'Working Hours storage is not available.', 'booking' )
			);
		}

		$before_settings = wpbc_working_time__get_settings();
		if ( ! is_array( $before_settings ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_customer_journey_working_hours_read_failed',
				__( 'Current Working Hours could not be read safely.', 'booking' )
			);
		}

		if ( 'Off' === ( isset( $before_settings['enabled'] ) ? $before_settings['enabled'] : '' ) ) {
			return $this->create_result(
				$journey_id,
				array(),
				false,
				__( 'Customer Journey saved. Working Hours were already disabled.', 'booking' )
			);
		}

		$next_settings            = $before_settings;
		$next_settings['enabled'] = 'Off';
		$expected_settings        = $this->normalize_settings( $next_settings );

		wpbc_working_time__update_settings( $next_settings );
		if ( ! $this->settings_match( $expected_settings, wpbc_working_time__get_settings() ) ) {
			wpbc_working_time__update_settings( $before_settings );
			$was_restored = $this->settings_match( $this->normalize_settings( $before_settings ), wpbc_working_time__get_settings() );

			return new WP_Error(
				'wpbc_setup_wizard_customer_journey_working_hours_not_saved',
				$was_restored
					? __( 'Working Hours could not be disabled. The previous settings were restored.', 'booking' )
					: __( 'Working Hours could not be disabled or restored completely. Review General Availability before continuing.', 'booking' )
			);
		}

		return $this->create_result(
			$journey_id,
			array( 'booking_working_time_enabled', 'booking_working_time_rules' ),
			true,
			__( 'Customer Journey saved and Working Hours disabled.', 'booking' )
		);
	}

	/**
	 * Normalize complete Working Time settings through the canonical helper.
	 *
	 * @param array<string,mixed> $settings Complete Working Time settings.
	 *
	 * @return array<string,mixed> Normalized settings.
	 */
	private function normalize_settings( array $settings ) {
		return function_exists( 'wpbc_working_time__normalize_settings' )
			? wpbc_working_time__normalize_settings( $settings )
			: $settings;
	}

	/**
	 * Compare complete expected settings with a canonical readback.
	 *
	 * @param array<string,mixed> $expected_settings  Expected normalized settings.
	 * @param mixed               $canonical_settings Canonical readback candidate.
	 *
	 * @return bool True when every preserved and changed setting matches.
	 */
	private function settings_match( array $expected_settings, $canonical_settings ) {
		return is_array( $canonical_settings ) && $expected_settings === $this->normalize_settings( $canonical_settings );
	}

	/**
	 * Build the normalized progressive-save result.
	 *
	 * @param string   $journey_id               Validated journey identifier.
	 * @param string[] $updated_ids              Canonical option identifiers changed by this request.
	 * @param bool     $writes_canonical_settings Whether canonical settings were written.
	 * @param string   $summary                  Translated result summary.
	 *
	 * @return array<string,mixed> Progressive-save result proposal.
	 */
	private function create_result( $journey_id, array $updated_ids, $writes_canonical_settings, $summary ) {
		$fingerprint_values = array(
			'customer_journey'      => $journey_id,
			'working_hours_enabled' => 'first_start_last_end' === $journey_id ? 'Off' : null,
		);

		return array(
			'status'                    => 'saved',
			'summary'                   => sanitize_text_field( $summary ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $fingerprint_values ) ),
			'created_ids'               => array(),
			'updated_ids'               => array_values( $updated_ids ),
			'warnings'                  => array(),
			'writes_canonical_settings' => (bool) $writes_canonical_settings,
		);
	}

	/**
	 * Customer Journey never completes the route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
