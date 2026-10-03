<?php
/**
 * Progressive save handler for Setup Wizard Dates and times.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist the three scalar date/time choices through canonical WPBC options.
 *
 * The handler reloads, validates, writes, and verifies canonical values at the
 * operation boundary. When a later option cannot be verified, earlier writes
 * are restored from exact before-images because WordPress options do not offer
 * a transaction spanning these three independent records.
 */
final class WPBC_Setup_Wizard_Date_Time_Formats_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Date_Time_Formats */
	private $date_time_formats;

	/**
	 * Build the handler around the reusable field contract.
	 *
	 * @param WPBC_Setup_Wizard_Date_Time_Formats|null $date_time_formats Optional domain validator.
	 */
	public function __construct( $date_time_formats = null ) {
		$this->date_time_formats = $date_time_formats instanceof WPBC_Setup_Wizard_Date_Time_Formats
			? $date_time_formats
			: new WPBC_Setup_Wizard_Date_Time_Formats();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step identifier.
	 */
	public function get_step_id() {
		return 'date_time_formats';
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
	 * Revalidate and save the date format, time format, and week start.
	 *
	 * @param array<string,mixed> $validated_fields Validated current-step fields.
	 * @param array<string,mixed> $checkpoint       Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or bounded error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $checkpoint, $operation_context );

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			return new WP_Error( 'wpbc_setup_wizard_date_time_forbidden', __( 'You are not allowed to change Booking Calendar date and time settings.', 'booking' ) );
		}

		$field_option_map = array(
			'date_format'       => 'booking_date_format',
			'time_format'       => 'booking_time_format',
			'start_day_of_week' => 'booking_start_day_weeek',
		);
		$canonical_values = array();
		foreach ( $field_option_map as $field_id => $option_name ) {
			$field_value = $this->date_time_formats->validate_field(
				$field_id,
				isset( $validated_fields[ $field_id ] ) ? $validated_fields[ $field_id ] : null,
				true
			);
			if ( is_wp_error( $field_value ) ) {
				return $field_value;
			}

			$canonical_values[ $option_name ] = (string) $field_value;
		}

		$missing_marker = 'wpbc_setup_wizard_missing_' . wp_generate_uuid4();
		$before_images  = array();
		$attempted      = array();
		$updated_ids    = array();

		foreach ( $canonical_values as $option_name => $canonical_value ) {
			$before_value = get_bk_option( $option_name, $missing_marker );
			$before_images[ $option_name ] = array(
				'exists' => $missing_marker !== $before_value,
				'value'  => $before_value,
			);

			if ( $before_images[ $option_name ]['exists'] && (string) $before_value === $canonical_value ) {
				continue;
			}

			$attempted[] = $option_name;
			update_bk_option( $option_name, $canonical_value );
			if ( $canonical_value !== (string) get_bk_option( $option_name, $missing_marker ) ) {
				$compensated = $this->restore_before_images( $attempted, $before_images, $missing_marker );

				return new WP_Error(
					'wpbc_setup_wizard_date_time_not_saved',
					$compensated
						? __( 'Booking Calendar could not save the date and time settings. Previous values were restored.', 'booking' )
						: __( 'Booking Calendar could not save the date and time settings, and some previous values could not be restored. Review Date and time settings before continuing.', 'booking' )
				);
			}

			$updated_ids[] = $option_name;
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => empty( $updated_ids )
				? __( 'Date and time settings already matched this setup.', 'booking' )
				: __( 'Date and time settings saved.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $canonical_values ) ),
			'created_ids'               => array(),
			'updated_ids'               => $updated_ids,
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Restore attempted option writes from exact before-images.
	 *
	 * @param string[]                    $attempted      Attempted option names in write order.
	 * @param array<string,array<string,mixed>> $before_images Before-images keyed by option name.
	 * @param string                      $missing_marker Unique missing-value marker.
	 *
	 * @return bool True when every attempted option matches its before-image.
	 */
	private function restore_before_images( array $attempted, array $before_images, $missing_marker ) {
		$restored = true;
		foreach ( array_reverse( $attempted ) as $option_name ) {
			$before_image = $before_images[ $option_name ];
			if ( $before_image['exists'] ) {
				update_bk_option( $option_name, $before_image['value'] );
				$restored = $restored && (string) $before_image['value'] === (string) get_bk_option( $option_name, $missing_marker );
			} else {
				delete_bk_option( $option_name );
				$restored = $restored && $missing_marker === get_bk_option( $option_name, $missing_marker );
			}
		}

		return $restored;
	}

	/**
	 * Dates and times does not complete the route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
