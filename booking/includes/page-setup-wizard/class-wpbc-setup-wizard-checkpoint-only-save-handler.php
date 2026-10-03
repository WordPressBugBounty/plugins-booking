<?php
/**
 * Non-domain Setup Wizard save handler used during progressive-save rollout.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Record validated progress without mutating Booking Calendar domain settings.
 *
 * Phase 2 retains this handler for later complex steps. Subsequent phases
 * replace exact registrations with domain-owned handlers one step at a time.
 * Its explicit result flag lets tests prove that shared navigation cannot
 * accidentally claim or perform a canonical write before that replacement.
 */
final class WPBC_Setup_Wizard_Checkpoint_Only_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** @var string */
	private $step_id;

	/** @var string */
	private $primary_action_label;

	/** @var bool */
	private $is_terminal;

	/**
	 * Configure one checkpoint-only step boundary.
	 *
	 * @param string $step_id                 Stable step identifier.
	 * @param string $primary_action_label     Translated primary action label.
	 * @param bool   $is_terminal              Whether this is the final route step.
	 */
	public function __construct( $step_id, $primary_action_label, $is_terminal = false ) {
		$this->step_id              = sanitize_key( (string) $step_id );
		$this->primary_action_label = sanitize_text_field( (string) $primary_action_label );
		$this->is_terminal          = (bool) $is_terminal;
	}

	/**
	 * Return the configured step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return $this->step_id;
	}

	/**
	 * Return the configured server-owned action label.
	 *
	 * @param array<string,mixed> $checkpoint   Unused current checkpoint.
	 * @param array<string,mixed> $step_context Unused presentation context.
	 *
	 * @return string Translated action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		unset( $checkpoint, $step_context );

		return $this->primary_action_label;
	}

	/**
	 * Return an explicit non-domain result for checkpoint persistence.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed> Normalized checkpoint-only result proposal.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $validated_fields, $checkpoint, $operation_context );

		return array(
			'status'                    => 'saved',
			'summary'                   => __( 'Setup Wizard progress saved.', 'booking' ),
			'canonical_fingerprint'     => '',
			'created_ids'               => array(),
			'updated_ids'               => array(),
			'warnings'                  => array(),
			'writes_canonical_settings' => false,
		);
	}

	/**
	 * Return whether this handler completes the route.
	 *
	 * @return bool True for the final checkpoint-only handler.
	 */
	public function is_terminal() {
		return $this->is_terminal;
	}
}
