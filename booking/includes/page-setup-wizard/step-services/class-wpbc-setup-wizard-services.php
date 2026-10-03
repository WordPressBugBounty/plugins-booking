<?php
/**
 * Appointment Service draft integration for the modular Setup Wizard Services step.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read and validate Service proposals for the progressive save boundary.
 *
 * Existing Appointment Services remain the read-only source for initial
 * suggestions. When none are available, the activation-owned starter records
 * provide familiar defaults. The resulting DTO deliberately excludes owner,
 * Provider, form, and database metadata; those domains are configured and
 * authorized by the Services save handler and later wizard steps.
 */
final class WPBC_Setup_Wizard_Services {

	const MAX_SERVICES           = 20;
	const MAX_DESCRIPTION_LENGTH = 2000;
	const MAX_PICTURE_URL_LENGTH = 2048;
	const MAX_MINUTES            = 1440;
	const MAX_BASE_COST          = 1000;

	/**
	 * Return the template context for the Services step.
	 *
	 * @param array<string,mixed> $step_values Validated values for this step.
	 *
	 * @return array<string,mixed> Presentation-only Service editor context.
	 */
	public function get_context( array $step_values ) {
		$pricing_available = $this->is_pricing_available();
		$currency_symbol   = '$';

		if ( $pricing_available && function_exists( 'wpbc_get_currency_symbol' ) ) {
			$currency_symbol = html_entity_decode(
				wp_strip_all_tags( (string) wpbc_get_currency_symbol() ),
				ENT_QUOTES,
				get_bloginfo( 'charset' )
			);
		}

		return array(
			'values'               => $step_values,
			'services'             => isset( $step_values['services'] ) && is_array( $step_values['services'] ) ? $step_values['services'] : array(),
			'inactive_service_ids' => isset( $step_values['inactive_service_ids'] ) && is_array( $step_values['inactive_service_ids'] ) ? $step_values['inactive_service_ids'] : array(),
			'pricing_available'    => $pricing_available,
			'currency_symbol'      => sanitize_text_field( $currency_symbol ),
			'max_services'         => self::MAX_SERVICES,
		);
	}

	/**
	 * Validate canonical Service IDs explicitly staged to move to Draft.
	 *
	 * This dedicated transport prevents an omitted proposal from being interpreted
	 * as a lifecycle mutation. Ownership and current canonical state are checked
	 * again by the progressive save handler before any status change is written.
	 *
	 * @param mixed $raw_service_ids JSON transport string or stored array.
	 *
	 * @return int[]|WP_Error Normalized unique positive Service IDs or an error.
	 */
	public function validate_inactive_service_ids( $raw_service_ids ) {
		if ( is_string( $raw_service_ids ) ) {
			if ( strlen( $raw_service_ids ) > 2000 ) {
				return new WP_Error( 'wpbc_setup_wizard_inactive_services_too_large', __( 'The Services selected for Draft are invalid.', 'booking' ) );
			}

			$raw_service_ids = json_decode( $raw_service_ids, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_inactive_services_invalid_json', __( 'The Services selected for Draft are invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_service_ids ) || count( $raw_service_ids ) > self::MAX_SERVICES ) {
			return new WP_Error( 'wpbc_setup_wizard_inactive_services_invalid', __( 'The Services selected for Draft are invalid.', 'booking' ) );
		}

		$normalized_ids = array();
		foreach ( array_values( $raw_service_ids ) as $raw_service_id ) {
			if ( ! is_scalar( $raw_service_id ) || ! preg_match( '/^[0-9]+$/', (string) $raw_service_id ) ) {
				return new WP_Error( 'wpbc_setup_wizard_inactive_service_id_invalid', __( 'A Service selected for Draft is invalid.', 'booking' ) );
			}

			$service_id = absint( $raw_service_id );
			if ( ! $service_id || in_array( $service_id, $normalized_ids, true ) ) {
				return new WP_Error( 'wpbc_setup_wizard_inactive_service_id_duplicate', __( 'Each Service can be moved to Draft only once.', 'booking' ) );
			}

			$normalized_ids[] = $service_id;
		}

		return $normalized_ids;
	}

	/**
	 * Return canonical active Service IDs currently authorized for this owner.
	 *
	 * The save handler uses this read-only allow-list to prove that an explicit
	 * Draft request originated from the Services presented by this wizard session.
	 *
	 * @return int[] Owner-authorized active Service IDs.
	 */
	public function get_authorized_active_service_ids() {
		$service_ids = array();

		foreach ( $this->get_existing_service_rows() as $service_row ) {
			$service_row = is_object( $service_row ) ? get_object_vars( $service_row ) : (array) $service_row;
			$service_id  = isset( $service_row['service_id'] ) ? absint( $service_row['service_id'] ) : 0;
			if ( $service_id ) {
				$service_ids[] = $service_id;
			}
		}

		return array_values( array_unique( $service_ids ) );
	}

	/**
	 * Load owner-authorized canonical Services or safe activation defaults.
	 *
	 * The repository read is bounded and never persists data. Starter records
	 * are used only when no active canonical Service can be read. They remain
	 * proposals until the user chooses Create services & continue, which invokes
	 * the progressive canonical save boundary.
	 *
	 * @return array<int,array<string,mixed>> Service proposal DTOs.
	 */
	public function get_initial_services() {
		$service_rows = $this->get_existing_service_rows();

		if ( empty( $service_rows ) ) {
			$service_rows = $this->get_starter_service_rows();
		}

		$service_drafts = array();
		foreach ( array_slice( $service_rows, 0, self::MAX_SERVICES ) as $service_index => $service_row ) {
			$service_drafts[] = $this->create_service_draft( $service_row, $service_index );
		}

		return $service_drafts;
	}

	/**
	 * Validate the complete Service proposal collection from one draft field.
	 *
	 * @param mixed $raw_services     JSON transport string or stored array.
	 * @param bool  $require_complete Whether every Service must have a title.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Normalized proposals or an error.
	 */
	public function validate_services( $raw_services, $require_complete ) {
		if ( is_string( $raw_services ) ) {
			if ( strlen( $raw_services ) > 100000 ) {
				return new WP_Error( 'wpbc_setup_wizard_services_too_large', __( 'The Service draft is too large.', 'booking' ) );
			}

			$raw_services = json_decode( $raw_services, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_services_invalid_json', __( 'The Service draft is invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_services ) ) {
			return new WP_Error( 'wpbc_setup_wizard_services_invalid', __( 'Enter valid Service details.', 'booking' ) );
		}

		if ( $require_complete && empty( $raw_services ) ) {
			return new WP_Error( 'wpbc_setup_wizard_services_required', __( 'Add at least one Service.', 'booking' ) );
		}

		if ( count( $raw_services ) > self::MAX_SERVICES ) {
			return new WP_Error(
				'wpbc_setup_wizard_services_limit',
				/* translators: %d: Maximum number of Service drafts. */
				sprintf( __( 'Add no more than %d Services in this setup draft.', 'booking' ), self::MAX_SERVICES )
			);
		}

		$normalized_services = array();
		$used_draft_ids      = array();
		foreach ( array_values( $raw_services ) as $service_index => $raw_service ) {
			$normalized_service = $this->validate_service( $raw_service, $service_index, $require_complete );
			if ( is_wp_error( $normalized_service ) ) {
				return $normalized_service;
			}

			if ( isset( $used_draft_ids[ $normalized_service['draft_id'] ] ) ) {
				return new WP_Error( 'wpbc_setup_wizard_service_duplicate_key', __( 'Each Service draft must have a unique identifier.', 'booking' ) );
			}

			$used_draft_ids[ $normalized_service['draft_id'] ] = true;
			$normalized_services[]                             = $normalized_service;
		}

		return $normalized_services;
	}

	/**
	 * Read existing active Services through the canonical owner-aware provider.
	 *
	 * @return array<int,array<string,mixed>> Repository rows, or an empty array.
	 */
	private function get_existing_service_rows() {
		if (
			! function_exists( 'wpbc_appointment_services_get_manage_capability' )
			|| ! current_user_can( wpbc_appointment_services_get_manage_capability() )
			|| ! function_exists( 'wpbc_appointment_services_get_data_provider' )
		) {
			return array();
		}

		$service_provider = wpbc_appointment_services_get_data_provider();
		if ( ! is_object( $service_provider ) || ! method_exists( $service_provider, 'list_items' ) ) {
			return array();
		}

		$list_method  = method_exists( $service_provider, 'list_items_for_current_owner' )
			? 'list_items_for_current_owner'
			: 'list_items';
		$service_rows = $service_provider->{$list_method}(
			array(
				'status'     => 'active',
				'sort_by'    => 'service_id',
				'sort_order' => 'asc',
				'limit'      => self::MAX_SERVICES,
				'offset'     => 0,
			)
		);
		$owner_user_id = function_exists( 'wpbc_appointment_services_get_owner_user_id' )
			? absint( wpbc_appointment_services_get_owner_user_id() )
			: 0;
		$service_rows  = is_wp_error( $service_rows ) || ! is_array( $service_rows )
			? array()
			: array_values(
				array_filter(
					$service_rows,
					static function ( $service_row ) use ( $owner_user_id ) {
						$service_row = is_object( $service_row ) ? get_object_vars( $service_row ) : (array) $service_row;

						return isset( $service_row['owner_user_id'] ) && $owner_user_id === absint( $service_row['owner_user_id'] );
					}
				)
			);

		return array_slice( $service_rows, 0, self::MAX_SERVICES );
	}

	/**
	 * Return activation-owned starter Service records without creating them.
	 *
	 * @return array<int,array<string,mixed>> Starter records.
	 */
	private function get_starter_service_rows() {
		$provider_id = function_exists( 'wpbc_get_default_resource' ) ? absint( wpbc_get_default_resource() ) : 1;
		$provider_id = $provider_id ? $provider_id : 1;
		$form_id     = function_exists( 'wpbc_appointment_services_get_starter_booking_form_id' )
			? absint( wpbc_appointment_services_get_starter_booking_form_id() )
			: 0;

		if ( function_exists( 'wpbc_appointment_services_get_starter_services_values' ) ) {
			return (array) wpbc_appointment_services_get_starter_services_values( $provider_id, $form_id );
		}

		return array(
			array(
				'title'                 => __( 'Initial Consultation', 'booking' ),
				'description'           => __( 'A focused first meeting to understand your needs and recommend the right next step.', 'booking' ),
				'duration_minutes'      => 30,
				'buffer_before_minutes' => 0,
				'buffer_after_minutes'  => 0,
				'base_cost'             => '0.00',
				'status'                => 'active',
			),
		);
	}

	/**
	 * Map one canonical or starter record to the wizard Service DTO.
	 *
	 * @param mixed $service_row   Canonical or starter Service record.
	 * @param int   $service_index Zero-based presentation index.
	 *
	 * @return array<string,mixed> JSON-safe Service draft.
	 */
	private function create_service_draft( $service_row, $service_index ) {
		$normalized_service = function_exists( 'wpbc_appointment_services_normalize_item' )
			? wpbc_appointment_services_normalize_item( $service_row )
			: (array) $service_row;
		$source_service_id  = isset( $normalized_service['service_id'] ) ? absint( $normalized_service['service_id'] ) : 0;

		return array(
			'draft_id'              => $source_service_id ? 'service-' . $source_service_id : 'draft-' . ( $service_index + 1 ),
			'source_service_id'     => $source_service_id,
			'title'                 => isset( $normalized_service['title'] ) ? wp_html_excerpt( sanitize_text_field( (string) $normalized_service['title'] ), 200, '' ) : '',
			'description'           => isset( $normalized_service['description'] ) ? sanitize_textarea_field( (string) $normalized_service['description'] ) : '',
			'picture_url'           => isset( $normalized_service['picture_url'] ) ? esc_url_raw( (string) $normalized_service['picture_url'] ) : '',
			'duration_minutes'      => isset( $normalized_service['duration_minutes'] ) ? min( self::MAX_MINUTES, max( 1, absint( $normalized_service['duration_minutes'] ) ) ) : 30,
			'buffer_before_minutes' => isset( $normalized_service['buffer_before_minutes'] ) ? min( self::MAX_MINUTES, absint( $normalized_service['buffer_before_minutes'] ) ) : 0,
			'buffer_after_minutes'  => isset( $normalized_service['buffer_after_minutes'] ) ? min( self::MAX_MINUTES, absint( $normalized_service['buffer_after_minutes'] ) ) : 0,
			'base_cost'             => $this->is_pricing_available() && isset( $normalized_service['base_cost'] ) && is_numeric( $normalized_service['base_cost'] )
				? number_format( min( self::MAX_BASE_COST, max( 0, (float) $normalized_service['base_cost'] ) ), 2, '.', '' )
				: '0.00',
			'status'                => 'active',
		);
	}

	/**
	 * Validate one Service proposal and reject unregistered properties.
	 *
	 * @param mixed $raw_service      Untrusted Service value.
	 * @param int   $service_index    Zero-based Service index.
	 * @param bool  $require_complete Whether the title is required.
	 *
	 * @return array<string,mixed>|WP_Error Normalized Service or an error.
	 */
	private function validate_service( $raw_service, $service_index, $require_complete ) {
		if ( ! is_array( $raw_service ) ) {
			return new WP_Error( 'wpbc_setup_wizard_service_invalid', __( 'Enter valid Service details.', 'booking' ) );
		}

		$allowed_keys = array(
			'draft_id',
			'source_service_id',
			'title',
			'description',
			'picture_url',
			'duration_minutes',
			'buffer_before_minutes',
			'buffer_after_minutes',
			'base_cost',
			'status',
		);
		if ( array_diff( array_keys( $raw_service ), $allowed_keys ) ) {
			return new WP_Error( 'wpbc_setup_wizard_service_unknown_field', __( 'The Service draft contains an unsupported field.', 'booking' ) );
		}

		$title = isset( $raw_service['title'] ) && is_scalar( $raw_service['title'] )
			? wp_html_excerpt( sanitize_text_field( (string) $raw_service['title'] ), 200, '' )
			: '';
		if ( $require_complete && '' === trim( $title ) ) {
			return new WP_Error( 'wpbc_setup_wizard_service_title_required', __( 'Enter a title for every Service.', 'booking' ) );
		}

		$description = isset( $raw_service['description'] ) && is_scalar( $raw_service['description'] )
			? sanitize_textarea_field( (string) $raw_service['description'] )
			: '';
		if ( $this->get_text_length( $description ) > self::MAX_DESCRIPTION_LENGTH ) {
			return new WP_Error( 'wpbc_setup_wizard_service_description_too_long', __( 'Use 2000 characters or fewer for each Service description.', 'booking' ) );
		}

		$picture_url = isset( $raw_service['picture_url'] ) && is_scalar( $raw_service['picture_url'] ) ? trim( (string) $raw_service['picture_url'] ) : '';
		if ( $this->get_text_length( $picture_url ) > self::MAX_PICTURE_URL_LENGTH ) {
			return new WP_Error( 'wpbc_setup_wizard_service_picture_too_long', __( 'Choose a valid Service image.', 'booking' ) );
		}
		$sanitized_picture_url = '' === $picture_url ? '' : esc_url_raw( $picture_url );
		if ( '' !== $picture_url && '' === $sanitized_picture_url ) {
			return new WP_Error( 'wpbc_setup_wizard_service_picture_invalid', __( 'Choose a valid Service image.', 'booking' ) );
		}

		$duration_minutes = $this->validate_minutes( isset( $raw_service['duration_minutes'] ) ? $raw_service['duration_minutes'] : 30, 1, __( 'Enter a Service duration between 1 and 1440 minutes.', 'booking' ) );
		if ( is_wp_error( $duration_minutes ) ) {
			return $duration_minutes;
		}

		$buffer_before = $this->validate_minutes( isset( $raw_service['buffer_before_minutes'] ) ? $raw_service['buffer_before_minutes'] : 0, 0, __( 'Enter a buffer between 0 and 1440 minutes.', 'booking' ) );
		if ( is_wp_error( $buffer_before ) ) {
			return $buffer_before;
		}

		$buffer_after = $this->validate_minutes( isset( $raw_service['buffer_after_minutes'] ) ? $raw_service['buffer_after_minutes'] : 0, 0, __( 'Enter a buffer between 0 and 1440 minutes.', 'booking' ) );
		if ( is_wp_error( $buffer_after ) ) {
			return $buffer_after;
		}

		$base_cost = '0.00';
		if ( $this->is_pricing_available() ) {
			$raw_base_cost = isset( $raw_service['base_cost'] ) ? $raw_service['base_cost'] : 0;
			if ( ! is_scalar( $raw_base_cost ) || ! is_numeric( $raw_base_cost ) || 0 > (float) $raw_base_cost || self::MAX_BASE_COST < (float) $raw_base_cost ) {
				return new WP_Error( 'wpbc_setup_wizard_service_price_invalid', __( 'Enter a Service price between 0 and 1000.', 'booking' ) );
			}
			$base_cost = number_format( (float) $raw_base_cost, 2, '.', '' );
		}

		$draft_id = isset( $raw_service['draft_id'] ) && is_scalar( $raw_service['draft_id'] )
			? sanitize_key( (string) $raw_service['draft_id'] )
			: '';
		if ( '' === $draft_id ) {
			$draft_id = 'draft-' . ( $service_index + 1 );
		}

		return array(
			'draft_id'              => substr( $draft_id, 0, 64 ),
			'source_service_id'     => isset( $raw_service['source_service_id'] ) && is_scalar( $raw_service['source_service_id'] ) ? absint( $raw_service['source_service_id'] ) : 0,
			'title'                 => $title,
			'description'           => $description,
			'picture_url'           => $sanitized_picture_url,
			'duration_minutes'      => $duration_minutes,
			'buffer_before_minutes' => $buffer_before,
			'buffer_after_minutes'  => $buffer_after,
			'base_cost'             => $base_cost,
			'status'                => 'active',
		);
	}

	/**
	 * Validate one non-negative minute value against the Service draft bound.
	 *
	 * @param mixed  $raw_value     Untrusted minute value.
	 * @param int    $minimum_value Minimum accepted value.
	 * @param string $error_message Translated error message.
	 *
	 * @return int|WP_Error Normalized minutes or an error.
	 */
	private function validate_minutes( $raw_value, $minimum_value, $error_message ) {
		if ( ! is_scalar( $raw_value ) || ! preg_match( '/^\d+$/', (string) $raw_value ) ) {
			return new WP_Error( 'wpbc_setup_wizard_service_minutes_invalid', $error_message );
		}

		$minutes = absint( $raw_value );
		if ( $minimum_value > $minutes || self::MAX_MINUTES < $minutes ) {
			return new WP_Error( 'wpbc_setup_wizard_service_minutes_invalid', $error_message );
		}

		return $minutes;
	}

	/**
	 * Determine whether the active edition exposes canonical Service pricing.
	 *
	 * @return bool True when Service pricing is available.
	 */
	private function is_pricing_available() {
		return function_exists( 'wpbc_appointment_services_is_pricing_available' )
			&& wpbc_appointment_services_is_pricing_available();
	}

	/**
	 * Measure text without requiring the multibyte PHP extension.
	 *
	 * @param string $text Text value.
	 *
	 * @return int Character or byte length.
	 */
	private function get_text_length( $text ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( $text ) : strlen( $text );
	}
}
