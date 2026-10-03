<?php
/**
 * Progressive save handler for the Setup Wizard Booking Mode page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist Booking Mode through the released owner-scoped Booking Modes API.
 */
final class WPBC_Setup_Wizard_Booking_Mode_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step identifier.
	 */
	public function get_step_id() {
		return 'booking_experience';
	}

	/**
	 * Return the scalar-settings save label.
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
	 * Revalidate and save one allowed owner-scoped Booking Mode.
	 *
	 * @param array<string,mixed> $validated_fields Validated current-step fields.
	 * @param array<string,mixed> $checkpoint       Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or bounded error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $checkpoint, $operation_context );

		if (
			! WPBC_Setup_Wizard_Access::current_user_can_access()
			|| ! function_exists( 'wpbc_booking_modes_current_user_can_switch' )
			|| ! wpbc_booking_modes_current_user_can_switch()
		) {
			return new WP_Error( 'wpbc_setup_wizard_booking_mode_forbidden', __( 'You are not allowed to change the Booking Calendar administration mode.', 'booking' ) );
		}

		if (
			! function_exists( 'wpbc_booking_modes_get_allowed_mode_ids' )
			|| ! function_exists( 'wpbc_booking_modes_get_selected_mode_id' )
			|| ! function_exists( 'wpbc_booking_modes_set_selected_mode_id' )
		) {
			return new WP_Error( 'wpbc_setup_wizard_booking_mode_unavailable', __( 'Booking Calendar administration modes are unavailable. Reload the page and try again.', 'booking' ) );
		}

		$mode_id = isset( $validated_fields['booking_experience'] ) && is_scalar( $validated_fields['booking_experience'] )
			? sanitize_key( (string) $validated_fields['booking_experience'] )
			: '';
		$allowed_mode_ids = wpbc_booking_modes_get_allowed_mode_ids();
		if ( ! is_array( $allowed_mode_ids ) || ! in_array( $mode_id, $allowed_mode_ids, true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_mode_invalid', __( 'The selected Booking Calendar administration mode is not available.', 'booking' ) );
		}

		$previous_mode_id = wpbc_booking_modes_get_selected_mode_id();
		$updated_ids      = array();
		if ( $mode_id !== $previous_mode_id ) {
			$save_result = wpbc_booking_modes_set_selected_mode_id( $mode_id );
			if ( is_wp_error( $save_result ) ) {
				return $save_result;
			}

			if ( $mode_id !== wpbc_booking_modes_get_selected_mode_id() ) {
				$restored = false;
				if ( in_array( $previous_mode_id, $allowed_mode_ids, true ) ) {
					$restore_result = wpbc_booking_modes_set_selected_mode_id( $previous_mode_id );
					$restored       = ! is_wp_error( $restore_result ) && $previous_mode_id === wpbc_booking_modes_get_selected_mode_id();
				}

				return new WP_Error(
					'wpbc_setup_wizard_booking_mode_not_saved',
					$restored
						? __( 'The Booking Calendar administration mode could not be verified after saving. The previous mode was restored.', 'booking' )
						: __( 'The Booking Calendar administration mode could not be verified after saving, and the previous mode could not be confirmed. Review Booking Mode before continuing.', 'booking' )
				);
			}

			$updated_ids[] = 'booking_admin_mode';
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => empty( $updated_ids )
				? __( 'Booking Mode already matched this setup.', 'booking' )
				: __( 'Booking Mode saved.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( array( 'booking_experience' => $mode_id ) ) ),
			'created_ids'               => array(),
			'updated_ids'               => $updated_ids,
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Booking Mode does not complete the route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
