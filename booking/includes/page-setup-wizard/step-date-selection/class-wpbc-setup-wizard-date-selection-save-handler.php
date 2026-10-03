<?php
/**
 * Progressive save handler for Setup Wizard Date Selection.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist the wizard-owned Date Selection settings through canonical options.
 *
 * The handler owns only the options represented by the Date Selection step. It
 * repeats field and journey validation at the mutation boundary, observes the
 * established edition split from Calendar settings, verifies the normalized
 * canonical read model, and restores exact before-images after a failed write.
 */
final class WPBC_Setup_Wizard_Date_Selection_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var WPBC_Setup_Wizard_Date_Selection */
	private $date_selection;

	/** @var WPBC_Setup_Wizard_Date_Selection_Module */
	private $date_selection_module;

	/**
	 * Build the canonical writer around the Date Selection domain contract.
	 *
	 * @param WPBC_Setup_Wizard_Date_Selection|null $date_selection Optional domain service for testing.
	 */
	public function __construct( $date_selection = null ) {
		$this->date_selection = $date_selection instanceof WPBC_Setup_Wizard_Date_Selection
			? $date_selection
			: new WPBC_Setup_Wizard_Date_Selection();
		$this->date_selection_module = new WPBC_Setup_Wizard_Date_Selection_Module( $this->date_selection );
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step identifier.
	 */
	public function get_step_id() {
		return 'date_selection';
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
	 * Revalidate, save, and verify canonical Date Selection options.
	 *
	 * @param array<string,mixed> $validated_fields Validated current-step fields.
	 * @param array<string,mixed> $checkpoint       Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or bounded error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $operation_context );

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			return new WP_Error( 'wpbc_setup_wizard_date_selection_forbidden', __( 'You are not allowed to change Booking Calendar Date Selection settings.', 'booking' ) );
		}

		$journey_id = $this->get_customer_journey_id( $checkpoint );
		if ( '' === $journey_id ) {
			return new WP_Error( 'wpbc_setup_wizard_date_selection_journey_missing', __( 'Choose and save a Customer Journey before saving Date Selection.', 'booking' ) );
		}

		$validated_fields = $this->revalidate_fields( $validated_fields, $journey_id );
		if ( is_wp_error( $validated_fields ) ) {
			return $validated_fields;
		}

		$previous_day_mode = (string) get_bk_option( 'booking_type_of_day_selections' );
		$canonical_values  = $this->get_writable_canonical_values( $validated_fields, $journey_id, $previous_day_mode );
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

			if ( $before_images[ $option_name ]['exists'] && (string) $before_value === (string) $canonical_value ) {
				continue;
			}

			$attempted[] = $option_name;
			update_bk_option( $option_name, $canonical_value );
			if ( (string) $canonical_value !== (string) get_bk_option( $option_name, $missing_marker ) ) {
				return $this->create_failed_save_error( $attempted, $before_images, $missing_marker );
			}

			$updated_ids[] = $option_name;
		}

		$verified_values = $this->get_writable_canonical_values( $this->date_selection->get_initial_values(), $journey_id, $previous_day_mode );
		if ( $canonical_values !== $verified_values ) {
			return $this->create_failed_save_error( $attempted, $before_images, $missing_marker );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => empty( $updated_ids )
				? __( 'Date Selection settings already matched this setup.', 'booking' )
				: __( 'Date Selection settings saved.', 'booking' ),
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $canonical_values ) ),
			'created_ids'               => array(),
			'updated_ids'               => $updated_ids,
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Revalidate the complete Date Selection contract at apply time.
	 *
	 * @param array<string,mixed> $submitted_fields Submitted normalized fields.
	 * @param string              $journey_id       Validated Customer Journey ID.
	 *
	 * @return array<string,mixed>|WP_Error Revalidated values or error.
	 */
	private function revalidate_fields( array $submitted_fields, $journey_id ) {
		$required_fields  = $this->date_selection_module->get_required_fields();
		$validated_fields = array();

		foreach ( $this->date_selection_module->get_field_names() as $field_id ) {
			if ( ! array_key_exists( $field_id, $submitted_fields ) ) {
				return new WP_Error( 'wpbc_setup_wizard_date_selection_field_missing', __( 'Date Selection settings are incomplete. Reload this step and try again.', 'booking' ) );
			}

			$field_value = $this->date_selection_module->validate_field(
				$field_id,
				$submitted_fields[ $field_id ],
				in_array( $field_id, $required_fields, true )
			);
			if ( is_wp_error( $field_value ) ) {
				return $field_value;
			}

			$validated_fields[ $field_id ] = $field_value;
		}

		$validated_fields = $this->date_selection_module->validate_values( $validated_fields );
		if ( is_wp_error( $validated_fields ) ) {
			return $validated_fields;
		}

		return $this->date_selection_module->validate_values_with_context(
			$validated_fields,
			array(
				'customer_journey' => array(
					'customer_journey' => $journey_id,
				),
			)
		);
	}

	/**
	 * Return only canonical options writable by the current edition.
	 *
	 * Free and Personal editions retain the same free-option boundary as the
	 * Calendar settings page. A newly selected two-click range also records its
	 * dynamic subtype so a later edition upgrade preserves the intended mode.
	 *
	 * @param array<string,mixed> $field_values      Date Selection values.
	 * @param string              $journey_id        Validated Customer Journey ID.
	 * @param string              $previous_day_mode Day mode captured before this operation.
	 *
	 * @return array<string,string> Edition-supported canonical option values.
	 */
	private function get_writable_canonical_values( array $field_values, $journey_id, $previous_day_mode ) {
		$canonical_values = $this->date_selection->get_canonical_option_values( $field_values, $journey_id );
		$free_option_names = array(
			'booking_type_of_day_selections',
			'booking_recurrent_time',
			'booking_is_show_legend',
			'booking_legend_is_show_numbers',
			'booking_legend_is_vertical',
		);

		foreach ( $this->date_selection->get_legend_items() as $legend_item ) {
			$legend_id           = $legend_item['id'];
			$free_option_names[] = 'booking_legend_is_show_item_' . $legend_id;
			$free_option_names[] = 'booking_legend_text_for_item_' . $legend_id;
		}

		if ( $this->date_selection->supports_advanced_range_rules() ) {
			return $canonical_values;
		}

		$writable_values = array_intersect_key( $canonical_values, array_fill_keys( $free_option_names, true ) );
		if (
			'range' === $canonical_values['booking_type_of_day_selections']
			&& 'range' !== (string) $previous_day_mode
		) {
			$writable_values['booking_range_selection_type'] = 'dynamic';
		}

		return $writable_values;
	}

	/**
	 * Read the previously saved Customer Journey from the checkpoint.
	 *
	 * @param array<string,mixed> $checkpoint Current normalized checkpoint.
	 *
	 * @return string Sanitized journey ID or an empty string.
	 */
	private function get_customer_journey_id( array $checkpoint ) {
		$journey_value = isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? $checkpoint['values']['customer_journey']['customer_journey']
			: '';

		return is_scalar( $journey_value ) ? sanitize_key( (string) $journey_value ) : '';
	}

	/**
	 * Restore attempted writes and return one controlled persistence error.
	 *
	 * @param string[]                         $attempted      Attempted option names.
	 * @param array<string,array<string,mixed>> $before_images Exact option before-images.
	 * @param string                           $missing_marker Unique missing-value marker.
	 *
	 * @return WP_Error Controlled save failure.
	 */
	private function create_failed_save_error( array $attempted, array $before_images, $missing_marker ) {
		$compensated = $this->restore_before_images( $attempted, $before_images, $missing_marker );

		return new WP_Error(
			'wpbc_setup_wizard_date_selection_not_saved',
			$compensated
				? __( 'Booking Calendar could not save Date Selection settings. Previous values were restored.', 'booking' )
				: __( 'Booking Calendar could not save Date Selection settings, and some previous values could not be restored. Review Calendar settings before continuing.', 'booking' )
		);
	}

	/**
	 * Restore attempted option writes from exact before-images.
	 *
	 * @param string[]                         $attempted      Attempted option names in write order.
	 * @param array<string,array<string,mixed>> $before_images Exact option before-images.
	 * @param string                           $missing_marker Unique missing-value marker.
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
	 * Date Selection does not complete the route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
