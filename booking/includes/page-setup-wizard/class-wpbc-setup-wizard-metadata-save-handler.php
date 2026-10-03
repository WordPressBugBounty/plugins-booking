<?php
/**
 * Setup Wizard metadata-only progressive save handler.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Record one validated metadata step without changing Booking Calendar settings.
 *
 * Welcome, Business details, and Customer Journey are wizard-owned metadata.
 * They still use an explicit handler so their progressive-save boundary,
 * authorization, result summary, and future extension point are unambiguous.
 */
final class WPBC_Setup_Wizard_Metadata_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var string */
	private $step_id;

	/** @var string */
	private $summary;

	/**
	 * Configure one metadata-only step.
	 *
	 * @param string $step_id Stable step identifier.
	 * @param string $summary Translated result summary.
	 */
	public function __construct( $step_id, $summary ) {
		$this->step_id = sanitize_key( (string) $step_id );
		$this->summary = sanitize_text_field( (string) $summary );
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step identifier.
	 */
	public function get_step_id() {
		return $this->step_id;
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
	 * Recheck access and return a metadata-only result.
	 *
	 * Field validation is owned by the shared draft validator before this method
	 * runs. No canonical plugin setting belongs to these steps.
	 *
	 * @param array<string,mixed> $validated_fields Validated current-step fields.
	 * @param array<string,mixed> $checkpoint       Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Normalized result proposal or access error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $validated_fields, $checkpoint, $operation_context );

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			return new WP_Error( 'wpbc_setup_wizard_metadata_forbidden', __( 'You are not allowed to save this Setup Wizard step.', 'booking' ) );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => $this->summary,
			'canonical_fingerprint'     => '',
			'created_ids'               => array(),
			'updated_ids'               => array(),
			'warnings'                  => array(),
			'writes_canonical_settings' => false,
		);
	}

	/**
	 * Metadata steps never complete the route.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
