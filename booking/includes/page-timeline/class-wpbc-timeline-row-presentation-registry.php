<?php
/**
 * Allow-listed neutral Timeline Resource row presentations.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/interface-wpbc-timeline-row-presentation-provider.php';

/**
 * Register executable-free presentation descriptors and project only those
 * approved by their domain provider for an already-authorized Resource.
 */
final class WPBC_Timeline_Row_Presentation_Registry {

	/** @var WPBC_Timeline_Row_Presentation_Registry|null Shared request instance. */
	private static $instance = null;

	/** @var array<string,array<string,mixed>> Normalized descriptors by ID. */
	private $descriptors = array();

	/** @var array<string,WPBC_Timeline_Row_Presentation_Provider> Providers by ID. */
	private $providers = array();

	/**
	 * Return the request-scoped production registry.
	 *
	 * @return WPBC_Timeline_Row_Presentation_Registry Shared registry.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Register one server-approved descriptor and its domain availability provider.
	 *
	 * Registration accepts stable identifiers only. It never accepts template
	 * paths, callbacks, HTML, or request-selected files.
	 *
	 * @param array<string,mixed>                    $descriptor Executable-free descriptor.
	 * @param WPBC_Timeline_Row_Presentation_Provider $provider Domain availability provider.
	 *
	 * @return true|WP_Error True on success, otherwise a normalized error.
	 */
	public function register( $descriptor, $provider ) {
		$normalized_descriptor = $this->normalize_descriptor( $descriptor );

		if ( is_wp_error( $normalized_descriptor ) ) {
			return $normalized_descriptor;
		}
		if ( ! $provider instanceof WPBC_Timeline_Row_Presentation_Provider ) {
			return new WP_Error( 'wpbc_timeline_invalid_row_presentation_provider', __( 'The Timeline row presentation provider is invalid.', 'booking' ) );
		}
		if ( $normalized_descriptor['id'] !== $provider->get_presentation_id() ) {
			return new WP_Error( 'wpbc_timeline_row_presentation_provider_mismatch', __( 'The Timeline row presentation provider does not match its descriptor.', 'booking' ) );
		}
		if ( isset( $this->descriptors[ $normalized_descriptor['id'] ] ) ) {
			return new WP_Error( 'wpbc_timeline_duplicate_row_presentation', __( 'The Timeline row presentation is already registered.', 'booking' ) );
		}

		$this->descriptors[ $normalized_descriptor['id'] ] = $normalized_descriptor;
		$this->providers[ $normalized_descriptor['id'] ]   = $provider;

		return true;
	}

	/**
	 * Return one allow-listed descriptor only when both identifiers match.
	 *
	 * @param string $presentation_id Stable presentation ID.
	 * @param string $template_key    Stable template-registration key.
	 *
	 * @return array<string,mixed> Descriptor, or an empty array when rejected.
	 */
	public function get_descriptor( $presentation_id, $template_key ) {
		$presentation_id = (string) $presentation_id;
		$template_key    = (string) $template_key;

		if ( ! isset( $this->descriptors[ $presentation_id ] ) ) {
			return array();
		}
		if ( $this->descriptors[ $presentation_id ]['template_key'] !== $template_key ) {
			return array();
		}

		return $this->descriptors[ $presentation_id ];
	}

	/**
	 * Project descriptors approved for one already-authorized Resource.
	 *
	 * @param array<string,mixed> $resource Authorized internal Resource record.
	 *
	 * @return array<int,array<string,mixed>> Ordered executable-free descriptors.
	 */
	public function get_for_resource( $resource ) {
		$available_descriptors = array();

		foreach ( $this->descriptors as $presentation_id => $descriptor ) {
			if ( true === $this->providers[ $presentation_id ]->is_available_for_resource( $resource ) ) {
				$available_descriptors[] = $descriptor;
			}
		}

		return $available_descriptors;
	}

	/**
	 * Normalize one executable-free server registration.
	 *
	 * @param mixed $descriptor Candidate descriptor.
	 *
	 * @return array<string,mixed>|WP_Error Normalized descriptor or error.
	 */
	private function normalize_descriptor( $descriptor ) {
		if ( ! is_array( $descriptor ) ) {
			return new WP_Error( 'wpbc_timeline_invalid_row_presentation', __( 'The Timeline row presentation descriptor is invalid.', 'booking' ) );
		}

		$presentation_id   = isset( $descriptor['id'] ) ? (string) $descriptor['id'] : '';
		$template_key      = isset( $descriptor['template_key'] ) ? (string) $descriptor['template_key'] : '';
		$label             = isset( $descriptor['label'] ) ? sanitize_text_field( (string) $descriptor['label'] ) : '';
		$toggle_open_label  = isset( $descriptor['toggle_open_label'] ) ? sanitize_text_field( (string) $descriptor['toggle_open_label'] ) : '';
		$toggle_close_label = isset( $descriptor['toggle_close_label'] ) ? sanitize_text_field( (string) $descriptor['toggle_close_label'] ) : '';

		if ( ! preg_match( '/^[a-z][a-z0-9_]{0,63}$/', $presentation_id ) ) {
			return new WP_Error( 'wpbc_timeline_invalid_row_presentation_id', __( 'The Timeline row presentation ID is invalid.', 'booking' ) );
		}
		if ( ! preg_match( '/^[a-z][a-z0-9_]{0,63}$/', $template_key ) ) {
			return new WP_Error( 'wpbc_timeline_invalid_row_presentation_template', __( 'The Timeline row presentation template key is invalid.', 'booking' ) );
		}
		if ( '' === $label ) {
			return new WP_Error( 'wpbc_timeline_invalid_row_presentation_label', __( 'The Timeline row presentation label is required.', 'booking' ) );
		}

		return array(
			'id'                 => $presentation_id,
			'label'              => $label,
			'template_key'       => $template_key,
			'is_exclusive'       => ! empty( $descriptor['is_exclusive'] ),
			'is_read_only'       => ! empty( $descriptor['is_read_only'] ),
			'toggle_open_label'  => $toggle_open_label,
			'toggle_close_label' => $toggle_close_label,
		);
	}
}
