<?php
/**
 * Setup Wizard progressive step-save registry.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve exact step handlers without embedding domain rules in navigation.
 */
final class WPBC_Setup_Wizard_Step_Save_Registry {

	/** @var array<string,WPBC_Setup_Wizard_Step_Save_Handler> */
	private $handlers = array();

	/**
	 * Register an ordered set of unique save handlers.
	 *
	 * Invalid and duplicate handlers are ignored. Callers can then fail closed
	 * when no exact handler exists for the current step.
	 *
	 * @param WPBC_Setup_Wizard_Step_Save_Handler[] $handlers Save handlers.
	 */
	public function __construct( array $handlers = array() ) {
		foreach ( $handlers as $handler ) {
			if ( ! $handler instanceof WPBC_Setup_Wizard_Step_Save_Handler ) {
				continue;
			}

			$step_id = sanitize_key( $handler->get_step_id() );
			if ( '' === $step_id || isset( $this->handlers[ $step_id ] ) ) {
				continue;
			}

			$this->handlers[ $step_id ] = $handler;
		}
	}

	/**
	 * Return one exact registered handler.
	 *
	 * @param string $step_id Proposed step identifier.
	 *
	 * @return WPBC_Setup_Wizard_Step_Save_Handler|null Handler or null.
	 */
	public function get_handler( $step_id ) {
		$step_id = sanitize_key( is_scalar( $step_id ) ? (string) $step_id : '' );

		return isset( $this->handlers[ $step_id ] ) ? $this->handlers[ $step_id ] : null;
	}

	/**
	 * Return the server-owned action label for one step.
	 *
	 * @param string              $step_id      Stable step identifier.
	 * @param array<string,mixed> $checkpoint   Current normalized checkpoint.
	 * @param array<string,mixed> $step_context Authorized presentation context.
	 *
	 * @return string Translated action label, or an empty string when unavailable.
	 */
	public function get_primary_action_label( $step_id, array $checkpoint, array $step_context = array() ) {
		$handler = $this->get_handler( $step_id );

		return null === $handler ? '' : $handler->get_primary_action_label( $checkpoint, $step_context );
	}

	/**
	 * Normalize a handler result before checkpoint persistence.
	 *
	 * @param mixed $handler_result Domain handler result candidate.
	 *
	 * @return array<string,mixed>|WP_Error Normalized result or contract error.
	 */
	public function normalize_result( $handler_result ) {
		if ( ! is_array( $handler_result ) || 'saved' !== ( isset( $handler_result['status'] ) ? $handler_result['status'] : '' ) ) {
			return new WP_Error( 'wpbc_setup_wizard_save_result_invalid', __( 'The Setup Wizard step returned an invalid save result.', 'booking' ) );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => isset( $handler_result['summary'] ) && is_scalar( $handler_result['summary'] ) ? sanitize_text_field( (string) $handler_result['summary'] ) : '',
			'canonical_fingerprint'     => isset( $handler_result['canonical_fingerprint'] ) && is_scalar( $handler_result['canonical_fingerprint'] ) ? sanitize_text_field( (string) $handler_result['canonical_fingerprint'] ) : '',
			'created_ids'               => $this->normalize_identifiers( isset( $handler_result['created_ids'] ) ? $handler_result['created_ids'] : array() ),
			'updated_ids'               => $this->normalize_identifiers( isset( $handler_result['updated_ids'] ) ? $handler_result['updated_ids'] : array() ),
			'warnings'                  => $this->normalize_warnings( isset( $handler_result['warnings'] ) ? $handler_result['warnings'] : array() ),
			'writes_canonical_settings' => ! empty( $handler_result['writes_canonical_settings'] ),
		);
	}

	/**
	 * Normalize bounded scalar record identifiers.
	 *
	 * @param mixed $identifiers Identifier list candidate.
	 *
	 * @return array<int,int|string> Normalized identifiers.
	 */
	private function normalize_identifiers( $identifiers ) {
		$normalized_identifiers = array();

		foreach ( is_array( $identifiers ) ? array_slice( $identifiers, 0, 100 ) : array() as $identifier ) {
			if ( is_int( $identifier ) || ( is_string( $identifier ) && '' !== trim( $identifier ) ) ) {
				$normalized_identifiers[] = is_int( $identifier ) ? $identifier : sanitize_text_field( $identifier );
			}
		}

		return $normalized_identifiers;
	}

	/**
	 * Normalize bounded user-facing warning strings.
	 *
	 * @param mixed $warnings Warning list candidate.
	 *
	 * @return string[] Normalized warnings.
	 */
	private function normalize_warnings( $warnings ) {
		$normalized_warnings = array();

		foreach ( is_array( $warnings ) ? array_slice( $warnings, 0, 20 ) : array() as $warning ) {
			if ( is_scalar( $warning ) && '' !== trim( (string) $warning ) ) {
				$normalized_warnings[] = sanitize_text_field( (string) $warning );
			}
		}

		return $normalized_warnings;
	}
}

