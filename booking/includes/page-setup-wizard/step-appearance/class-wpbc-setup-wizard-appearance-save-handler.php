<?php
/**
 * Progressive save handler for Setup Wizard Appearance settings.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist the validated Guided appointment appearance through canonical options.
 */
final class WPBC_Setup_Wizard_Appearance_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Appearance */
	private $appearance;

	/**
	 * Build the handler around the Appearance validator.
	 *
	 * @param WPBC_Setup_Wizard_Appearance|null $appearance Optional domain service for tests.
	 */
	public function __construct( $appearance = null ) {
		$this->appearance = $appearance instanceof WPBC_Setup_Wizard_Appearance
			? $appearance
			: new WPBC_Setup_Wizard_Appearance();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'appearance';
	}

	/**
	 * Return the ordinary scalar-setting action label.
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
	 * Revalidate, save, verify, and compensate the canonical Appearance options.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $operation_context );

		if ( ! WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_form_and_appearance_route( $this->get_customer_journey_id( $checkpoint ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_appearance_journey_invalid', __( 'Appearance cannot be saved for the selected customer journey.', 'booking' ) );
		}
		$manage_capability = function_exists( 'wpbc_bfb_get_manage_cap' ) ? wpbc_bfb_get_manage_cap() : 'manage_options';
		if ( ! current_user_can( $manage_capability ) || ! function_exists( 'get_bk_option' ) || ! function_exists( 'update_bk_option' ) || ! function_exists( 'delete_bk_option' ) ) {
			return new WP_Error( 'wpbc_setup_wizard_appearance_forbidden', __( 'You are not allowed to update Booking Calendar appearance settings.', 'booking' ) );
		}

		$configuration = $this->appearance->get_preview_configuration( $validated_fields );
		if ( is_wp_error( $configuration ) ) {
			return $configuration;
		}

		$desired_options = array_merge( $configuration['form_style'], $configuration['option_overrides'] );
		$before_options  = array();
		$missing_marker  = array( 'wpbc_setup_wizard_missing_option' => function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : uniqid( 'wpbc_', true ) );
		foreach ( array_keys( $desired_options ) as $option_name ) {
			$before_value = get_bk_option( $option_name, $missing_marker );
			$before_options[ $option_name ] = array(
				'exists' => $missing_marker !== $before_value,
				'value'  => $before_value,
			);
		}

		foreach ( $desired_options as $option_name => $option_value ) {
			update_bk_option( $option_name, $option_value );
		}

		$verified_options = array();
		foreach ( $desired_options as $option_name => $option_value ) {
			$verified_options[ $option_name ] = (string) get_bk_option( $option_name );
			if ( (string) $option_value !== $verified_options[ $option_name ] ) {
				$was_restored = $this->restore_options( $before_options, $missing_marker );
				$message      = $was_restored
					? __( 'Appearance settings could not be verified. Previous values were restored.', 'booking' )
					: __( 'Appearance settings could not be verified or restored completely. Review Booking Form and Calendar Appearance settings before continuing.', 'booking' );
				return new WP_Error( 'wpbc_setup_wizard_appearance_not_verified', $message );
			}
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => __( 'Booking Form and calendar appearance updated.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $verified_options ) ),
			'created_ids'               => array(),
			'updated_ids'               => array_keys( $verified_options ),
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Restore exact option before-images after a failed verification.
	 *
	 * @param array<string,array{exists:bool,value:mixed}> $before_options Canonical before-images.
	 * @param array<string,string>                         $missing_marker Missing-option marker.
	 *
	 * @return bool True when every previous value or missing state was restored.
	 */
	private function restore_options( array $before_options, array $missing_marker ) {
		$was_restored = true;
		foreach ( $before_options as $option_name => $before_option ) {
			if ( ! empty( $before_option['exists'] ) ) {
				update_bk_option( $option_name, $before_option['value'] );
				$was_restored = $was_restored && $before_option['value'] === get_bk_option( $option_name, $missing_marker );
			} else {
				delete_bk_option( $option_name );
				$was_restored = $was_restored && $missing_marker === get_bk_option( $option_name, $missing_marker );
			}
		}

		return $was_restored;
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
	 * Appearance is not the terminal route step.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
