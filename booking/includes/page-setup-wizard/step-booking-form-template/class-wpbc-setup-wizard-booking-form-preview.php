<?php
/**
 * Reusable Setup Wizard Booking Form preview coordinator.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve server-owned templates into inline or signed URL previews.
 *
 * Authorization remains the caller's responsibility. This service validates
 * every template, usage, and target against server-owned allow-lists, performs
 * no canonical Form Builder writes, and returns only normalized preview data.
 */
final class WPBC_Setup_Wizard_Booking_Form_Preview {

	const TARGET_EMBEDDED = 'embedded';
	const TARGET_WINDOW   = 'window';

	/** @var WPBC_Setup_Wizard_Booking_Form_Templates */
	private $templates;

	/** @var WPBC_Setup_Wizard_Booking_Form_Time_Options */
	private $time_options;

	/**
	 * Build the coordinator around the current Form Builder template registry.
	 *
	 * @param WPBC_Setup_Wizard_Booking_Form_Templates|null    $templates    Optional registry adapter for testing.
	 * @param WPBC_Setup_Wizard_Booking_Form_Time_Options|null $time_options Optional time-option projector for testing.
	 */
	public function __construct( $templates = null, $time_options = null ) {
		$this->templates = $templates instanceof WPBC_Setup_Wizard_Booking_Form_Templates
			? $templates
			: new WPBC_Setup_Wizard_Booking_Form_Templates();
		$this->time_options = $time_options instanceof WPBC_Setup_Wizard_Booking_Form_Time_Options
			? $time_options
			: new WPBC_Setup_Wizard_Booking_Form_Time_Options();
	}

	/**
	 * Build an authorized inline or signed URL preview result.
	 *
	 * Direct embedded previews render in the current request. Appointment Flow
	 * and explicit new-window previews use the existing signed transient because
	 * later front-end requests must recover the unsaved template snapshot.
	 *
	 * @param mixed $raw_template_slug     Untrusted or stored template slug.
	 * @param mixed $raw_booking_form_usage Untrusted or stored usage identifier.
	 * @param mixed $raw_preview_target    Untrusted or stored preview target.
	 * @param array $preview_configuration Server-owned request-local preview configuration.
	 * @param array $booking_form_context  Server-owned Customer Journey and time proposal context.
	 *
	 * @return array<string,mixed>|WP_Error Normalized preview result or validation error.
	 */
	public function build_preview( $raw_template_slug, $raw_booking_form_usage, $raw_preview_target, array $preview_configuration = array(), array $booking_form_context = array() ) {
		$has_journey_context = array_key_exists( 'customer_journey', $booking_form_context );
		$customer_journey    = isset( $booking_form_context['customer_journey'] )
			? sanitize_key( (string) $booking_form_context['customer_journey'] )
			: '';
		$booking_form_usage = $has_journey_context
			? $this->templates->validate_booking_form_usage_for_journey( $raw_booking_form_usage, $customer_journey, true )
			: $this->templates->validate_booking_form_usage( $raw_booking_form_usage, true );
		$render_mode        = $this->templates->get_preview_render_mode(
			$raw_booking_form_usage,
			$has_journey_context ? $customer_journey : null
		);
		$preview_target     = $this->validate_preview_target( $raw_preview_target );

		foreach ( array( $booking_form_usage, $render_mode, $preview_target ) as $validated_value ) {
			if ( is_wp_error( $validated_value ) ) {
				return $validated_value;
			}
		}

		$is_inline_preview = self::TARGET_EMBEDDED === $preview_target && 'direct_booking_form' === $booking_form_usage;
		$preview_payload   = $is_inline_preview
			? $this->templates->get_inline_preview_payload( $raw_template_slug )
			: $this->templates->get_preview_payload( $raw_template_slug );
		if ( is_wp_error( $preview_payload ) ) {
			return $preview_payload;
		}

		$preview_payload = $this->time_options->apply_to_preview_payload( $preview_payload, $booking_form_context );
		if ( is_wp_error( $preview_payload ) ) {
			return $preview_payload;
		}

		if ( ! class_exists( 'WPBC_BFB_Preview_Service' ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_preview_unavailable',
				__( 'The interactive booking form preview is unavailable.', 'booking' ),
				array( 'status' => 503 )
			);
		}

		if ( $is_inline_preview ) {
			return $this->build_inline_preview( $preview_payload, $booking_form_usage, $preview_target, $render_mode, $preview_configuration );
		}

		return $this->build_url_preview( $preview_payload, $booking_form_usage, $preview_target, $render_mode, $preview_configuration );
	}

	/**
	 * Validate the requested presentation target against the exact allow-list.
	 *
	 * @param mixed $raw_preview_target Untrusted or stored preview target.
	 *
	 * @return string|WP_Error Normalized target or validation error.
	 */
	public function validate_preview_target( $raw_preview_target ) {
		if ( ! is_scalar( $raw_preview_target ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_preview_target_invalid',
				__( 'Choose a valid booking form preview target.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$raw_preview_target = trim( (string) $raw_preview_target );
		$preview_target     = sanitize_key( $raw_preview_target );

		if (
			$preview_target !== $raw_preview_target
			|| ! in_array( $preview_target, array( self::TARGET_EMBEDDED, self::TARGET_WINDOW ), true )
		) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_preview_target_unknown',
				__( 'Choose a valid booking form preview target.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		return $preview_target;
	}

	/**
	 * Render one request-local Direct booking form.
	 *
	 * @param array<string,mixed> $preview_payload    Validated server-owned template payload.
	 * @param string              $booking_form_usage Validated usage identifier.
	 * @param string              $preview_target     Validated target identifier.
	 * @param string              $render_mode        Validated Form Builder render mode.
	 * @param array<string,mixed> $preview_configuration Server-owned preview configuration.
	 *
	 * @return array<string,mixed>|WP_Error Normalized inline preview or error.
	 */
	private function build_inline_preview( array $preview_payload, $booking_form_usage, $preview_target, $render_mode, array $preview_configuration ) {
		$preview_configuration['render_mode'] = $render_mode;
		try {
			$inline_preview = WPBC_BFB_Preview_Service::get_instance()->render_inline_preview_payload(
				$this->get_default_resource_id(),
				$preview_payload['structure'],
				$preview_payload['form_name'],
				$preview_payload['advanced_form'],
				$preview_payload['content_form'],
				array(),
				$preview_configuration
			);
		} catch ( Throwable $preview_exception ) {
			$inline_preview = false;
		}

		if (
			! is_array( $inline_preview )
			|| empty( $inline_preview['html'] )
			|| ! is_string( $inline_preview['html'] )
			|| empty( $inline_preview['bootstrap'] )
			|| ! is_array( $inline_preview['bootstrap'] )
		) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_preview_render_failed',
				__( 'The selected booking form could not be rendered.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		return array(
			'preview_kind'       => 'inline',
			'preview_target'     => $preview_target,
			'html'               => $inline_preview['html'],
			'bootstrap'          => $inline_preview['bootstrap'],
			'template_slug'      => $preview_payload['template_slug'],
			'booking_form_usage' => $booking_form_usage,
		);
	}

	/**
	 * Create one signed short-lived preview URL.
	 *
	 * @param array<string,mixed> $preview_payload    Validated server-owned template payload.
	 * @param string              $booking_form_usage Validated usage identifier.
	 * @param string              $preview_target     Validated target identifier.
	 * @param string              $render_mode        Validated Form Builder render mode.
	 * @param array<string,mixed> $preview_configuration Server-owned preview configuration.
	 *
	 * @return array<string,mixed>|WP_Error Normalized URL preview or error.
	 */
	private function build_url_preview( array $preview_payload, $booking_form_usage, $preview_target, $render_mode, array $preview_configuration ) {
		$preview_configuration['render_mode'] = $render_mode;
		try {
			$preview = WPBC_BFB_Preview_Service::get_instance()->create_preview_session(
				$this->get_default_resource_id(),
				get_current_user_id(),
				$preview_payload['structure'],
				$preview_payload['form_name'],
				$preview_payload['advanced_form'],
				$preview_payload['content_form'],
				array(),
				$preview_configuration
			);
		} catch ( Throwable $preview_exception ) {
			$preview = false;
		}

		if ( ! is_array( $preview ) || empty( $preview['preview_url'] ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_preview_session_failed',
				__( 'The interactive booking form preview could not be created.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		return array(
			'preview_kind'       => 'url',
			'preview_target'     => $preview_target,
			'preview_url'        => esc_url_raw( $preview['preview_url'] ),
			'template_slug'      => $preview_payload['template_slug'],
			'booking_form_usage' => $booking_form_usage,
		);
	}

	/**
	 * Return the current user's default authorized booking resource.
	 *
	 * @return int Positive booking resource ID.
	 */
	private function get_default_resource_id() {
		$resource_id = class_exists( 'WPBC_FE_Attr_Postprocessor' )
			? absint( WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() )
			: 1;

		return $resource_id > 0 ? $resource_id : 1;
	}
}
