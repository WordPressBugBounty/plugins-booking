<?php
/**
 * Booking Resource drafts for the Setup Wizard full-day route.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read existing Resources and validate browser-staged Resource proposals.
 */
final class WPBC_Setup_Wizard_Booking_Resources {

	const MAX_RESOURCE_DRAFTS    = 20;
	const MAX_EXISTING_RESOURCES = 200;
	const MAX_DESCRIPTION_LENGTH = 2000;
	const MAX_PICTURE_URL_LENGTH = 2048;

	/**
	 * Return presentation data for the Booking Resources editor.
	 *
	 * @param array<string,mixed> $step_values Validated step values.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $step_values ) {
		$currency_symbol = '$';
		if ( $this->is_pricing_available() && function_exists( 'wpbc_get_currency_symbol' ) ) {
			$currency_symbol = html_entity_decode( wp_strip_all_tags( (string) wpbc_get_currency_symbol() ), ENT_QUOTES, get_bloginfo( 'charset' ) );
		}

		return array(
			'values'                => $step_values,
			'existing_resources'    => $this->get_existing_resources(),
			'booking_resources'     => isset( $step_values['booking_resources'] ) && is_array( $step_values['booking_resources'] ) ? $step_values['booking_resources'] : array(),
			'existing_resource_updates' => isset( $step_values['existing_booking_resources'] ) && is_array( $step_values['existing_booking_resources'] ) ? $step_values['existing_booking_resources'] : array(),
			'can_create_resources'  => $this->can_create_resources(),
			'pricing_available'     => $this->is_pricing_available(),
			'media_upload_available' => ! function_exists( 'wpbc_is_this_demo' ) || ! wpbc_is_this_demo(),
			'currency_symbol'       => sanitize_text_field( $currency_symbol ),
			'max_resource_drafts'   => $this->get_maximum_resource_drafts(),
		);
	}

	/**
	 * Return the empty initial draft collection.
	 *
	 * Existing Resources are deliberately read separately and are never copied
	 * into a create payload, preventing Save & continue from duplicating them.
	 *
	 * @return array<int,array<string,mixed>> Empty proposal collection.
	 */
	public function get_initial_resource_drafts() {
		return array();
	}

	/**
	 * Validate the complete staged Resource collection.
	 *
	 * @param mixed $raw_resources    JSON transport string or stored array.
	 * @param bool  $require_complete Whether staged drafts must be complete.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Normalized proposals or an error.
	 */
	public function validate_resource_drafts( $raw_resources, $require_complete ) {
		if ( is_string( $raw_resources ) ) {
			if ( 100000 < strlen( $raw_resources ) ) {
				return new WP_Error( 'wpbc_setup_wizard_resources_too_large', __( 'The Booking Resource draft is too large.', 'booking' ) );
			}
			$raw_resources = json_decode( $raw_resources, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_resources_invalid_json', __( 'The Booking Resource draft is invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_resources ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resources_invalid', __( 'Enter valid Booking Resource details.', 'booking' ) );
		}
		if ( ! $this->can_create_resources() && ! empty( $raw_resources ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resources_paid_required', __( 'Additional Booking Resources are available in Pro versions.', 'booking' ) );
		}
		if ( count( $raw_resources ) > $this->get_maximum_resource_drafts() ) {
			return new WP_Error( 'wpbc_setup_wizard_resources_limit', __( 'The Booking Resource limit for this account has been reached.', 'booking' ) );
		}

		$normalized_resources = array();
		$used_draft_ids       = array();
		foreach ( array_values( $raw_resources ) as $resource_index => $raw_resource ) {
			$normalized_resource = $this->validate_resource_draft( $raw_resource, $resource_index, $require_complete );
			if ( is_wp_error( $normalized_resource ) ) {
				return $normalized_resource;
			}
			if ( isset( $used_draft_ids[ $normalized_resource['draft_id'] ] ) ) {
				return new WP_Error( 'wpbc_setup_wizard_resource_duplicate_key', __( 'Each Booking Resource draft must have a unique identifier.', 'booking' ) );
			}
			$used_draft_ids[ $normalized_resource['draft_id'] ] = true;
			$normalized_resources[]                             = $normalized_resource;
		}

		return $normalized_resources;
	}

	/**
	 * Validate updates for existing Resources without accepting delete semantics.
	 *
	 * The browser sends only changed Resources. Each update carries a fingerprint
	 * of the authorized source values so the save handler can reject stale edits.
	 *
	 * @param mixed $raw_updates JSON transport string or stored array.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Normalized updates or an error.
	 */
	public function validate_existing_resource_updates( $raw_updates ) {
		if ( is_string( $raw_updates ) ) {
			if ( 500000 < strlen( $raw_updates ) ) {
				return new WP_Error( 'wpbc_setup_wizard_resource_updates_too_large', __( 'The Booking Resource updates are too large.', 'booking' ) );
			}
			$raw_updates = json_decode( $raw_updates, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_resource_updates_invalid_json', __( 'The Booking Resource updates are invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_updates ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_updates_invalid', __( 'Enter valid Booking Resource details.', 'booking' ) );
		}
		if ( self::MAX_EXISTING_RESOURCES < count( $raw_updates ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_updates_limit', __( 'Too many Booking Resources were submitted at once.', 'booking' ) );
		}

		$normalized_updates = array();
		$used_resource_ids  = array();
		foreach ( array_values( $raw_updates ) as $raw_update ) {
			$normalized_update = $this->validate_existing_resource_update( $raw_update );
			if ( is_wp_error( $normalized_update ) ) {
				return $normalized_update;
			}
			$resource_id = absint( $normalized_update['resource_id'] );
			if ( isset( $used_resource_ids[ $resource_id ] ) ) {
				return new WP_Error( 'wpbc_setup_wizard_resource_update_duplicate', __( 'Each existing Booking Resource may be updated only once.', 'booking' ) );
			}
			$used_resource_ids[ $resource_id ] = true;
			$normalized_updates[]              = $normalized_update;
		}

		return $normalized_updates;
	}

	/**
	 * Return existing Resources authorized for the effective wizard owner.
	 *
	 * @return array<int,array<string,mixed>> Presentation-safe Resource records.
	 */
	public function get_existing_resources() {
		if ( ! class_exists( 'WPBC_Catalog_Booking_Resources_Repository' ) ) {
			return array();
		}
		$repository  = new WPBC_Catalog_Booking_Resources_Repository();
		$resources   = array();
		$page_size   = min( 100, self::MAX_EXISTING_RESOURCES );
		$page_number = 1;

		while ( count( $resources ) < self::MAX_EXISTING_RESOURCES ) {
			$resource_page = $repository->get_resources(
				array(
					'page_number'    => $page_number,
					'items_per_page' => $page_size,
					'sort_by'        => 'id',
					'sort_order'     => 'asc',
					'search'         => '',
					'resource_type'  => 'all',
				)
			);
			if ( is_wp_error( $resource_page ) || ! is_array( $resource_page ) ) {
				return array();
			}
			if ( empty( $resource_page ) ) {
				break;
			}

			$resources = array_merge( $resources, $resource_page );
			if ( count( $resource_page ) < $page_size ) {
				break;
			}
			++$page_number;
		}
		$resources = array_slice( $resources, 0, self::MAX_EXISTING_RESOURCES );

		$storage_context = WPBC_Setup_Wizard_Access::get_storage_context();
		$owner_user_id   = absint( $storage_context['owner_user_id'] );
		$presentation    = array();
		foreach ( $resources as $resource ) {
			if ( ! is_array( $resource ) || empty( $resource['id'] ) ) {
				continue;
			}
			if ( class_exists( 'wpdev_bk_multiuser' ) && $owner_user_id !== absint( isset( $resource['owner_user_id'] ) ? $resource['owner_user_id'] : 0 ) ) {
				continue;
			}
			$editable_resource                       = $this->get_existing_resource_editable_fields( $resource );
			$editable_resource['id']                 = absint( $resource['id'] );
			$editable_resource['resource_id']        = absint( $resource['id'] );
			$editable_resource['source_fingerprint'] = $this->get_existing_resource_fingerprint( $resource );
			$presentation[]                          = $editable_resource;
		}

		return $presentation;
	}

	/**
	 * Normalize the Setup Wizard fields editable on one authorized Resource.
	 *
	 * This method is shared by presentation, stale-write detection, retry
	 * recovery, and compensation so all layers compare the same values.
	 *
	 * @param array<string,mixed> $resource Canonical authorized Resource.
	 *
	 * @return array<string,string> Editable Resource fields.
	 */
	public function get_existing_resource_editable_fields( array $resource ) {
		$base_cost = '0.00';
		if ( $this->is_pricing_available() ) {
			$raw_cost = isset( $resource['cost'] ) && is_numeric( $resource['cost'] ) ? (float) $resource['cost'] : 0.0;
			$base_cost = number_format( max( 0, $raw_cost ), 2, '.', '' );
		}

		return array(
			'title'       => sanitize_text_field( isset( $resource['title'] ) ? (string) $resource['title'] : '' ),
			'description' => sanitize_textarea_field( isset( $resource['description'] ) ? (string) $resource['description'] : '' ),
			'picture_url' => esc_url_raw( isset( $resource['picture_url'] ) ? (string) $resource['picture_url'] : '' ),
			'base_cost'   => $base_cost,
		);
	}

	/**
	 * Build a non-reversible fingerprint for editable Resource values.
	 *
	 * @param array<string,mixed> $resource Canonical authorized Resource.
	 *
	 * @return string SHA-256 fingerprint.
	 */
	public function get_existing_resource_fingerprint( array $resource ) {
		$editable_fields = $this->get_existing_resource_editable_fields( $resource );

		return $this->get_editable_resource_fields_fingerprint( $editable_fields );
	}

	/**
	 * Build a fingerprint from an already normalized editable-field map.
	 *
	 * Extra transport properties are deliberately ignored so a target update and
	 * a reloaded canonical Resource can be compared through the same contract.
	 *
	 * @param array<string,mixed> $editable_fields Normalized editable values.
	 *
	 * @return string SHA-256 fingerprint.
	 */
	public function get_editable_resource_fields_fingerprint( array $editable_fields ) {
		$fingerprint_fields = array(
			'title'       => isset( $editable_fields['title'] ) ? (string) $editable_fields['title'] : '',
			'description' => isset( $editable_fields['description'] ) ? (string) $editable_fields['description'] : '',
			'picture_url' => isset( $editable_fields['picture_url'] ) ? (string) $editable_fields['picture_url'] : '',
			'base_cost'   => isset( $editable_fields['base_cost'] ) ? (string) $editable_fields['base_cost'] : '0.00',
		);
		$encoded_fields = wp_json_encode( $fingerprint_fields );

		return hash( 'sha256', false === $encoded_fields ? '[]' : $encoded_fields );
	}

	/**
	 * Determine whether the active edition may create additional Resources.
	 *
	 * @return bool True for Personal and higher while capacity remains.
	 */
	public function can_create_resources() {
		return class_exists( 'wpdev_bk_personal' )
			&& class_exists( 'WPBC_Catalog_Booking_Resource_Inspector_Schema' )
			&& 0 < $this->get_maximum_resource_drafts();
	}

	/**
	 * Determine whether Resource cost is supported by the active edition.
	 *
	 * @return bool True for Business Small and higher.
	 */
	public function is_pricing_available() {
		return class_exists( 'wpdev_bk_biz_s' );
	}

	/**
	 * Return the bounded current-edition create limit for this wizard visit.
	 *
	 * @return int Number of proposals allowed between zero and twenty.
	 */
	public function get_maximum_resource_drafts() {
		if ( ! class_exists( 'wpdev_bk_personal' ) || ! class_exists( 'WPBC_Catalog_Booking_Resource_Inspector_Schema' ) ) {
			return 0;
		}
		$schema = new WPBC_Catalog_Booking_Resource_Inspector_Schema();

		return min( self::MAX_RESOURCE_DRAFTS, max( 0, absint( $schema->get_maximum_quantity() ) ) );
	}

	/**
	 * Validate one Resource proposal and reject unregistered properties.
	 *
	 * @param mixed $raw_resource     Untrusted Resource value.
	 * @param int   $resource_index   Zero-based proposal index.
	 * @param bool  $require_complete Whether a staged title is required.
	 *
	 * @return array<string,mixed>|WP_Error Normalized proposal or an error.
	 */
	private function validate_resource_draft( $raw_resource, $resource_index, $require_complete ) {
		if ( ! is_array( $raw_resource ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_invalid', __( 'Enter valid Booking Resource details.', 'booking' ) );
		}
		$allowed_keys = array( 'draft_id', 'title', 'description', 'picture_url', 'base_cost' );
		if ( array_diff( array_keys( $raw_resource ), $allowed_keys ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_unknown_field', __( 'The Booking Resource draft contains an unsupported field.', 'booking' ) );
		}

		if ( isset( $raw_resource['title'] ) && ! is_scalar( $raw_resource['title'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_title_invalid', __( 'Enter a valid Booking Resource name.', 'booking' ) );
		}
		$title = isset( $raw_resource['title'] ) ? sanitize_text_field( (string) $raw_resource['title'] ) : '';
		if ( $require_complete && '' === trim( $title ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_title_required', __( 'Enter a name for every new Booking Resource.', 'booking' ) );
		}
		if ( $this->get_text_length( $title ) > 200 ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_title_too_long', __( 'Use 200 characters or fewer for each Booking Resource name.', 'booking' ) );
		}

		if ( isset( $raw_resource['description'] ) && ! is_scalar( $raw_resource['description'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_description_invalid', __( 'Enter a valid Booking Resource description.', 'booking' ) );
		}
		$description = isset( $raw_resource['description'] ) ? sanitize_textarea_field( (string) $raw_resource['description'] ) : '';
		if ( $this->get_text_length( $description ) > self::MAX_DESCRIPTION_LENGTH ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_description_too_long', __( 'Use 2000 characters or fewer for each Booking Resource description.', 'booking' ) );
		}

		if ( isset( $raw_resource['picture_url'] ) && ! is_scalar( $raw_resource['picture_url'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_picture_invalid', __( 'Choose a valid Booking Resource image.', 'booking' ) );
		}
		$picture_url = isset( $raw_resource['picture_url'] ) ? trim( (string) $raw_resource['picture_url'] ) : '';
		if ( $this->get_text_length( $picture_url ) > self::MAX_PICTURE_URL_LENGTH ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_picture_too_long', __( 'Choose a valid Booking Resource image.', 'booking' ) );
		}
		$picture_url = '' === $picture_url ? '' : esc_url_raw( $picture_url );
		if ( isset( $raw_resource['picture_url'] ) && '' !== trim( (string) $raw_resource['picture_url'] ) && '' === $picture_url ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_picture_invalid', __( 'Choose a valid Booking Resource image.', 'booking' ) );
		}

		$base_cost = '0.00';
		if ( $this->is_pricing_available() ) {
			$raw_base_cost = isset( $raw_resource['base_cost'] ) ? $raw_resource['base_cost'] : 0;
			$base_cost_number = is_scalar( $raw_base_cost ) ? str_replace( ',', '.', (string) $raw_base_cost ) : '';
			if ( ! is_numeric( $base_cost_number ) || ! is_finite( (float) $base_cost_number ) || 0 > (float) $base_cost_number ) {
				return new WP_Error( 'wpbc_setup_wizard_resource_price_invalid', __( 'Enter a valid non-negative base cost.', 'booking' ) );
			}
			$base_cost = number_format( (float) $base_cost_number, 2, '.', '' );
		}

		if ( isset( $raw_resource['draft_id'] ) && ! is_scalar( $raw_resource['draft_id'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_draft_id_invalid', __( 'The Booking Resource draft identifier is invalid.', 'booking' ) );
		}
		$draft_id = isset( $raw_resource['draft_id'] ) ? sanitize_key( (string) $raw_resource['draft_id'] ) : '';
		if ( '' === $draft_id ) {
			$draft_id = 'draft-' . ( $resource_index + 1 );
		}

		return array(
			'draft_id'   => substr( $draft_id, 0, 64 ),
			'title'      => $title,
			'description' => $description,
			'picture_url' => $picture_url,
			'base_cost'   => $base_cost,
		);
	}

	/**
	 * Validate one existing Resource update and its stale-write token.
	 *
	 * @param mixed $raw_update Untrusted decoded update.
	 *
	 * @return array<string,mixed>|WP_Error Normalized update or an error.
	 */
	private function validate_existing_resource_update( $raw_update ) {
		if ( ! is_array( $raw_update ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_update_invalid', __( 'Enter valid Booking Resource details.', 'booking' ) );
		}
		$allowed_keys = array( 'resource_id', 'source_fingerprint', 'title', 'description', 'picture_url', 'base_cost' );
		if ( array_diff( array_keys( $raw_update ), $allowed_keys ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_update_unknown_field', __( 'The Booking Resource update contains an unsupported field.', 'booking' ) );
		}

		$resource_id = isset( $raw_update['resource_id'] ) && is_scalar( $raw_update['resource_id'] ) ? absint( $raw_update['resource_id'] ) : 0;
		if ( ! $resource_id ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_update_id_invalid', __( 'The Booking Resource update is invalid.', 'booking' ) );
		}
		$source_fingerprint = isset( $raw_update['source_fingerprint'] ) && is_scalar( $raw_update['source_fingerprint'] ) ? strtolower( (string) $raw_update['source_fingerprint'] ) : '';
		if ( ! preg_match( '/^[a-f0-9]{64}$/', $source_fingerprint ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_update_fingerprint_invalid', __( 'The Booking Resource update is stale. Reload the step and try again.', 'booking' ) );
		}

		$normalized_fields = $this->validate_editable_fields( $raw_update, false );
		if ( is_wp_error( $normalized_fields ) ) {
			return $normalized_fields;
		}

		return array_merge(
			array(
				'resource_id'        => $resource_id,
				'source_fingerprint' => $source_fingerprint,
			),
			$normalized_fields
		);
	}

	/**
	 * Validate the common editable Resource fields.
	 *
	 * @param array<string,mixed> $raw_fields       Untrusted fields.
	 * @param bool                $preserve_markup  Whether permitted description markup must be preserved.
	 *
	 * @return array<string,string>|WP_Error Normalized fields or an error.
	 */
	private function validate_editable_fields( array $raw_fields, $preserve_markup ) {
		if ( isset( $raw_fields['title'] ) && ! is_scalar( $raw_fields['title'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_title_invalid', __( 'Enter a valid Booking Resource name.', 'booking' ) );
		}
		$title = isset( $raw_fields['title'] ) ? sanitize_text_field( (string) $raw_fields['title'] ) : '';
		if ( '' === trim( $title ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_title_required', __( 'Enter a name for every Booking Resource.', 'booking' ) );
		}
		if ( $this->get_text_length( $title ) > 200 ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_title_too_long', __( 'Use 200 characters or fewer for each Booking Resource name.', 'booking' ) );
		}

		if ( isset( $raw_fields['description'] ) && ! is_scalar( $raw_fields['description'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_description_invalid', __( 'Enter a valid Booking Resource description.', 'booking' ) );
		}
		$raw_description = isset( $raw_fields['description'] ) ? (string) $raw_fields['description'] : '';
		$description     = $preserve_markup ? wp_kses_post( $raw_description ) : sanitize_textarea_field( $raw_description );
		if ( $this->get_text_length( $description ) > self::MAX_DESCRIPTION_LENGTH ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_description_too_long', __( 'Use 2000 characters or fewer for each Booking Resource description.', 'booking' ) );
		}

		if ( isset( $raw_fields['picture_url'] ) && ! is_scalar( $raw_fields['picture_url'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_picture_invalid', __( 'Choose a valid Booking Resource image.', 'booking' ) );
		}
		$raw_picture_url = isset( $raw_fields['picture_url'] ) ? trim( (string) $raw_fields['picture_url'] ) : '';
		if ( $this->get_text_length( $raw_picture_url ) > self::MAX_PICTURE_URL_LENGTH ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_picture_too_long', __( 'Choose a valid Booking Resource image.', 'booking' ) );
		}
		$picture_url = '' === $raw_picture_url ? '' : esc_url_raw( $raw_picture_url );
		if ( '' !== $raw_picture_url && '' === $picture_url ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_picture_invalid', __( 'Choose a valid Booking Resource image.', 'booking' ) );
		}

		$base_cost = '0.00';
		if ( $this->is_pricing_available() ) {
			$raw_base_cost  = isset( $raw_fields['base_cost'] ) ? $raw_fields['base_cost'] : 0;
			$normalized_cost = is_scalar( $raw_base_cost ) ? str_replace( ',', '.', (string) $raw_base_cost ) : '';
			if ( ! is_numeric( $normalized_cost ) || ! is_finite( (float) $normalized_cost ) || 0 > (float) $normalized_cost ) {
				return new WP_Error( 'wpbc_setup_wizard_resource_price_invalid', __( 'Enter a valid non-negative base cost.', 'booking' ) );
			}
			$base_cost = number_format( (float) $normalized_cost, 2, '.', '' );
		}

		return array(
			'title'       => $title,
			'description' => $description,
			'picture_url' => $picture_url,
			'base_cost'   => $base_cost,
		);
	}

	/**
	 * Measure text without requiring the multibyte PHP extension.
	 *
	 * @param string $text Text to measure.
	 *
	 * @return int Character or byte length.
	 */
	private function get_text_length( $text ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( (string) $text ) : strlen( (string) $text );
	}
}
