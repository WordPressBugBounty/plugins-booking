<?php
/**
 * Independent reviewed inline updates for the template-driven Resource catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build, preview, and apply row-specific drafts without legacy editor services.
 *
 * Browser drafts are never trusted as complete Resource records. Every preview
 * and apply rebuilds its plan from current authorized repository values, and a
 * signed review binds the normalized replacements to those current values.
 */
final class WPBC_Catalog_Booking_Resources_Inline_Editor {

	/** Maximum number of visible rows accepted from one catalog page. */
	const MAX_ROWS = 100;

	/** Maximum bytes accepted for one submitted scalar field. */
	const MAX_FIELD_BYTES = 10000;

	/** @var WPBC_Catalog_Booking_Resources_Repository Independent read repository. */
	private $repository;

	/** @var WPBC_Catalog_Booking_Resource_Inspector_Schema Current field allow-lists. */
	private $schema;

	/** @var WPBC_Catalog_Booking_Resource_Updater Independent validated updater. */
	private $updater;

	/** @var WPBC_Catalog_Booking_Resources_Inline_Fields Domain field provider. */
	private $inline_fields;

	/**
	 * Initialize independent collaborators.
	 *
	 * @param WPBC_Catalog_Booking_Resources_Repository|null       $repository Optional repository for tests.
	 * @param WPBC_Catalog_Booking_Resource_Inspector_Schema|null $schema     Optional schema service for tests.
	 * @param WPBC_Catalog_Booking_Resource_Updater|null          $updater    Optional updater for tests.
	 * @param WPBC_Catalog_Booking_Resources_Inline_Fields|null   $inline_fields Optional field provider for tests.
	 */
	public function __construct( $repository = null, $schema = null, $updater = null, $inline_fields = null ) {
		$this->repository = $repository instanceof WPBC_Catalog_Booking_Resources_Repository ? $repository : new WPBC_Catalog_Booking_Resources_Repository();
		$this->schema     = $schema instanceof WPBC_Catalog_Booking_Resource_Inspector_Schema ? $schema : new WPBC_Catalog_Booking_Resource_Inspector_Schema();
		$this->updater    = $updater instanceof WPBC_Catalog_Booking_Resource_Updater ? $updater : new WPBC_Catalog_Booking_Resource_Updater();
		$this->inline_fields = $inline_fields instanceof WPBC_Catalog_Booking_Resources_Inline_Fields ? $inline_fields : new WPBC_Catalog_Booking_Resources_Inline_Fields( $this->schema );
	}

	/**
	 * Return row-specific controls for the requested visible Resources.
	 *
	 * @param array<int,mixed> $resource_ids Requested Resource IDs in catalog order.
	 * @return array<string,mixed>|WP_Error Client-safe schema or validation error.
	 */
	public function get_schema( $resource_ids ) {
		$resources = $this->get_authorized_resources( $resource_ids );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}

		$rows = array();
		foreach ( $resources as $resource ) {
			$rows[] = $this->build_row_schema( $resource );
		}

		return array(
			'maximum_rows' => self::MAX_ROWS,
			'rows'         => $rows,
		);
	}

	/**
	 * Build a signed, non-mutating review of row-specific drafts.
	 *
	 * @param array<int,mixed> $raw_rows Untrusted row draft envelopes.
	 * @return array<string,mixed>|WP_Error Review contract or validation error.
	 */
	public function preview( $raw_rows ) {
		$plan = $this->build_plan( $raw_rows );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}
		$review_rows = array();
		foreach ( $plan['client_changes'] as $change ) {
			$review_fields = array();
			foreach ( $change['fields'] as $field ) {
				$review_fields[] = array(
					'key'    => isset( $field['key'] ) ? sanitize_key( $field['key'] ) : '',
					'label'  => (string) $field['label'],
					'before' => (string) $field['old'],
					'after'  => (string) $field['new'],
				);
			}
			$review_rows[] = array(
				'id'     => absint( $change['resource_id'] ),
				'title'  => (string) $change['title'],
				'fields' => $review_fields,
				'notes'  => array(),
			);
		}

		return array(
			'changes'      => $plan['client_changes'],
			'review'       => array( 'rows' => $review_rows ),
			'review_token' => $this->create_review_token( $plan ),
		);
	}

	/**
	 * Apply a reviewed plan after rebuilding and revalidating current values.
	 *
	 * Completed rows are compensated in reverse order when a later update fails.
	 *
	 * @param array<int,mixed> $raw_rows     Untrusted row draft envelopes.
	 * @param string           $review_token Token returned by preview().
	 * @return array<string,mixed>|WP_Error Apply result or safe error.
	 */
	public function apply( $raw_rows, $review_token ) {
		$plan = $this->build_plan( $raw_rows, true );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}
		$expected_token = $this->create_review_token( $plan );
		if ( '' === $review_token || ! hash_equals( $expected_token, $review_token ) ) {
			return new WP_Error( 'wpbc_catalog_inline_review_stale', __( 'One or more Booking Resources changed after the review. Review the inline changes again before applying them.', 'booking' ) );
		}
		if ( empty( $plan['rows'] ) ) {
			return new WP_Error( 'wpbc_catalog_inline_no_changes', __( 'The inline editor does not contain any changes.', 'booking' ) );
		}

		$saved_rows = array();
		foreach ( $plan['rows'] as $row_plan ) {
			$updated = $this->updater->update( absint( $row_plan['resource_id'] ), $row_plan['new_fields'] );
			if ( is_wp_error( $updated ) ) {
				$rollback_errors = $this->rollback( $saved_rows );
				if ( ! empty( $rollback_errors ) ) {
					return new WP_Error( 'wpbc_catalog_inline_rollback_failed', __( 'The inline update stopped, and one or more completed changes could not be restored. Reload the catalog and verify the affected Booking Resources.', 'booking' ) );
				}

				return $updated;
			}
			$saved_rows[] = array(
				'resource_id' => absint( $row_plan['resource_id'] ),
				'fields'      => $row_plan['old_fields'],
			);
		}

		$updated_ids = array_values( array_map( 'absint', wp_list_pluck( $saved_rows, 'resource_id' ) ) );
		do_action( 'wpbc_catalog_booking_resources_inline_updated', $updated_ids );

		return array(
			'updated_ids'   => $updated_ids,
			'updated_count' => count( $updated_ids ),
		);
	}

	/**
	 * Build a current-value-bound plan from submitted row drafts.
	 *
	 * @param array<int,mixed> $raw_rows         Untrusted row envelopes.
	 * @param bool             $allow_no_changes Whether apply may compare an empty rebuilt plan.
	 * @return array<string,mixed>|WP_Error Normalized plan or validation error.
	 */
	private function build_plan( $raw_rows, $allow_no_changes = false ) {
		$requested_rows = $this->normalize_requested_rows( $raw_rows );
		if ( is_wp_error( $requested_rows ) ) {
			return $requested_rows;
		}
		$resources = $this->get_authorized_resources( wp_list_pluck( $requested_rows, 'resource_id' ) );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		$resources_by_id = array();
		foreach ( $resources as $resource ) {
			$resources_by_id[ absint( $resource['id'] ) ] = $resource;
		}

		$plan_rows      = array();
		$client_changes = array();
		foreach ( $requested_rows as $requested_row ) {
			$resource_id = absint( $requested_row['resource_id'] );
			$resource    = isset( $resources_by_id[ $resource_id ] ) ? $resources_by_id[ $resource_id ] : null;
			if ( null === $resource ) {
				return new WP_Error( 'wpbc_catalog_inline_resource_unavailable', __( 'One of the Booking Resources is no longer available to this account.', 'booking' ) );
			}

			$row_schema    = $this->build_row_schema( $resource );
			$fields_by_key = array();
			foreach ( $row_schema['fields'] as $field ) {
				$fields_by_key[ $field['key'] ] = $field;
			}

			$old_fields    = $this->get_complete_fields( $resource );
			$new_fields    = $old_fields;
			$field_changes = array();
			$has_changes   = false;
			foreach ( $requested_row['fields'] as $field_key => $submitted_value ) {
				if ( ! isset( $fields_by_key[ $field_key ] ) ) {
					return new WP_Error( 'wpbc_catalog_inline_field_unsupported', __( 'One of the inline fields is no longer available for this Booking Resource.', 'booking' ) );
				}
				$field          = $fields_by_key[ $field_key ];
				$normalized     = $this->normalize_field_value( $submitted_value, $field );
				$current_value  = (string) $field['value'];
				if ( is_wp_error( $normalized ) ) {
					return $normalized;
				}
				if ( (string) $normalized === $current_value ) {
					continue;
				}
				$new_fields[ $field_key ] = $normalized;
				$has_changes = true;
				$field_changes[] = array(
					'key' => $field_key,
					'label' => $field['label'],
					'old' => $this->format_value( $current_value, $field ),
					'new' => $this->format_value( $normalized, $field ),
				);
			}

			if ( ! $has_changes ) {
				continue;
			}
			$plan_rows[] = array(
				'resource_id' => absint( $resource['id'] ),
				'old_fields'  => $old_fields,
				'new_fields'  => $new_fields,
			);
			$client_changes[] = array(
				'resource_id' => absint( $resource['id'] ),
				'title'       => (string) $resource['title'],
				'fields'      => $field_changes,
			);
		}

		if ( empty( $plan_rows ) && ! $allow_no_changes ) {
			return new WP_Error( 'wpbc_catalog_inline_no_changes', __( 'The inline editor does not contain any changes.', 'booking' ) );
		}

		return array(
			'rows'           => $plan_rows,
			'client_changes' => $client_changes,
		);
	}

	/**
	 * Normalize bounded row envelopes while rejecting duplicates and objects.
	 *
	 * @param array<int,mixed> $raw_rows Untrusted row envelopes.
	 * @return array<int,array<string,mixed>>|WP_Error Normalized rows or error.
	 */
	private function normalize_requested_rows( $raw_rows ) {
		if ( ! is_array( $raw_rows ) || empty( $raw_rows ) || count( $raw_rows ) > self::MAX_ROWS ) {
			return new WP_Error( 'wpbc_catalog_inline_rows_invalid', __( 'The inline Booking Resource changes are invalid.', 'booking' ) );
		}
		$normalized_rows = array();
		$seen_ids        = array();
		foreach ( $raw_rows as $raw_row ) {
			if ( ! is_array( $raw_row ) || empty( $raw_row['resource_id'] ) || empty( $raw_row['fields'] ) || ! is_array( $raw_row['fields'] ) ) {
				return new WP_Error( 'wpbc_catalog_inline_row_invalid', __( 'One of the inline Booking Resource rows is invalid.', 'booking' ) );
			}
			$resource_id = absint( $raw_row['resource_id'] );
			if ( ! $resource_id || isset( $seen_ids[ $resource_id ] ) || count( $raw_row['fields'] ) > 5 ) {
				return new WP_Error( 'wpbc_catalog_inline_row_invalid', __( 'One of the inline Booking Resource rows is invalid.', 'booking' ) );
			}
			$normalized_fields = array();
			foreach ( $raw_row['fields'] as $field_key => $field_value ) {
				$field_key = sanitize_key( $field_key );
				if ( '' === $field_key || ! is_scalar( $field_value ) || strlen( (string) $field_value ) > self::MAX_FIELD_BYTES ) {
					return new WP_Error( 'wpbc_catalog_inline_value_invalid', __( 'One of the inline Booking Resource values is invalid.', 'booking' ) );
				}
				$normalized_fields[ $field_key ] = (string) $field_value;
			}
			$seen_ids[ $resource_id ] = true;
			$normalized_rows[] = array( 'resource_id' => $resource_id, 'fields' => $normalized_fields );
		}

		return $normalized_rows;
	}

	/**
	 * Load unique authorized Resources while preserving requested order.
	 *
	 * @param array<int,mixed> $resource_ids Requested IDs.
	 * @return array<int,array<string,mixed>>|WP_Error Resources or validation error.
	 */
	private function get_authorized_resources( $resource_ids ) {
		$normalized_ids = array();
		foreach ( is_array( $resource_ids ) ? $resource_ids : array() as $resource_id ) {
			$resource_id = absint( $resource_id );
			if ( $resource_id ) {
				$normalized_ids[ $resource_id ] = $resource_id;
			}
		}
		$normalized_ids = array_values( $normalized_ids );
		if ( empty( $normalized_ids ) || count( $normalized_ids ) > self::MAX_ROWS ) {
			return new WP_Error( 'wpbc_catalog_inline_selection_invalid', __( 'The inline Booking Resource selection is invalid.', 'booking' ) );
		}
		$resources = array();
		foreach ( $normalized_ids as $resource_id ) {
			$resource = $this->repository->get_resource( $resource_id );
			if ( is_wp_error( $resource ) ) {
				return $resource;
			}
			if ( null === $resource ) {
				return new WP_Error( 'wpbc_catalog_inline_resource_unavailable', __( 'One of the Booking Resources is no longer available to this account.', 'booking' ) );
			}
			$resources[] = $resource;
		}
		$shortcodes = $this->repository->get_publishing_shortcodes( $normalized_ids );
		foreach ( $resources as $resource_index => $resource ) {
			$resources[ $resource_index ] = $this->prepare_resource( $resource, $shortcodes );
		}

		return $resources;
	}

	/**
	 * Attach persisted values that are intentionally absent from list records.
	 *
	 * Inline updates submit a complete updater snapshot. Loading the current
	 * publishing shortcode here prevents an unrelated inline title, cost, or
	 * priority change from replacing a customized shortcode with its fallback.
	 *
	 * @param array<string,mixed> $resource   Authorized Resource record.
	 * @param array<int,string>   $shortcodes Persisted shortcodes keyed by Resource ID.
	 * @return array<string,mixed> Resource with its persisted shortcode.
	 */
	private function prepare_resource( $resource, $shortcodes ) {
		$resource_id = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;

		$resource['publishing_shortcode'] = isset( $shortcodes[ $resource_id ] )
			? (string) $shortcodes[ $resource_id ]
			: '[booking resource_id=' . $resource_id . ']';

		return $resource;
	}

	/**
	 * Build executable-free inline controls from the independent inspector schema.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 * @return array<string,mixed> Client-safe row schema.
	 */
	private function build_row_schema( $resource ) {
		return array(
			'resource_id' => absint( $resource['id'] ),
			'title'       => (string) $resource['title'],
			'fields'      => $this->inline_fields->get_inline_fields( $resource ),
		);
	}

	/**
	 * Return the complete validated-updater submission for one Resource.
	 *
	 * Partial inline drafts are merged into this snapshot before persistence so
	 * fields outside the current table view retain their canonical values.
	 *
	 * @param array<string,mixed> $resource Current authorized Resource.
	 * @return array<string,mixed> Complete editable field map.
	 */
	private function get_complete_fields( $resource ) {
		$fields      = array(
			'title'       => isset( $resource['title'] ) ? (string) $resource['title'] : '',
			'description' => isset( $resource['description'] ) ? (string) $resource['description'] : '',
			'picture_url' => isset( $resource['picture_url'] ) ? (string) $resource['picture_url'] : '',
		);
		$edit_schema = $this->schema->get_edit_schema( $resource );
		foreach ( ! is_wp_error( $edit_schema ) && isset( $edit_schema['sections'] ) ? $edit_schema['sections'] : array() as $section ) {
			foreach ( isset( $section['fields'] ) ? (array) $section['fields'] : array() as $field ) {
				$field_key = isset( $field['key'] ) ? sanitize_key( $field['key'] ) : '';
				if ( '' !== $field_key && ! empty( $field['editable'] ) && array_key_exists( 'value', $field ) && is_scalar( $field['value'] ) ) {
					$fields[ $field_key ] = (string) $field['value'];
				}
			}
		}

		return $fields;
	}

	/**
	 * Normalize a draft using the server-authoritative field definition.
	 *
	 * @param string              $submitted_value Submitted scalar value.
	 * @param array<string,mixed> $field           Current field definition.
	 * @return string|WP_Error Normalized value or validation error.
	 */
	private function normalize_field_value( $submitted_value, $field ) {
		$field_key = $field['key'];
		if ( 'title' === $field_key ) {
			$submitted_value = sanitize_text_field( $submitted_value );
			if ( '' === $submitted_value || $this->get_text_length( $submitted_value ) > 200 ) {
				return new WP_Error( 'wpbc_catalog_inline_title_invalid', __( 'Enter a valid Booking Resource title.', 'booking' ) );
			}
			return $submitted_value;
		}
		if ( 'description' === $field_key ) {
			$submitted_value = wp_kses_post( $submitted_value );
			return $this->get_text_length( $submitted_value ) <= 2000 ? $submitted_value : new WP_Error( 'wpbc_catalog_inline_description_invalid', __( 'The Booking Resource description is too long.', 'booking' ) );
		}
		if ( 'select' === $field['type'] ) {
			$allowed_values = array_map( 'strval', wp_list_pluck( $field['options'], 'value' ) );
			return in_array( (string) $submitted_value, $allowed_values, true ) ? (string) $submitted_value : new WP_Error( 'wpbc_catalog_inline_option_invalid', __( 'Select an available value for this Booking Resource.', 'booking' ) );
		}
		if ( 'number' === $field['type'] ) {
			$submitted_value = str_replace( ',', '.', trim( (string) $submitted_value ) );
			if ( '' === $submitted_value || ! is_numeric( $submitted_value ) || ! is_finite( (float) $submitted_value ) ) {
				return new WP_Error( 'wpbc_catalog_inline_number_invalid', __( 'Enter a valid number for this Booking Resource.', 'booking' ) );
			}
			if ( isset( $field['min'] ) && (float) $submitted_value < (float) $field['min'] ) {
				return new WP_Error( 'wpbc_catalog_inline_number_invalid', __( 'Enter a valid number for this Booking Resource.', 'booking' ) );
			}
			if ( 'priority' === $field_key && ! preg_match( '/^\d+$/', $submitted_value ) ) {
				return new WP_Error( 'wpbc_catalog_inline_priority_invalid', __( 'Priority must be a non-negative whole number.', 'booking' ) );
			}
			return 'priority' === $field_key ? (string) absint( $submitted_value ) : (string) (float) $submitted_value;
		}

		return sanitize_text_field( $submitted_value );
	}

	/**
	 * Format a review value with its field affixes or select label.
	 *
	 * @param string              $field_value Normalized value.
	 * @param array<string,mixed> $field       Field definition.
	 * @return string Human-readable plain value.
	 */
	private function format_value( $field_value, $field ) {
		foreach ( isset( $field['options'] ) ? (array) $field['options'] : array() as $option ) {
			if ( (string) $option['value'] === (string) $field_value ) {
				return (string) $option['label'];
			}
		}
		$prefix = isset( $field['prefix'] ) ? (string) $field['prefix'] : '';
		$suffix = isset( $field['suffix'] ) && '' !== (string) $field['suffix'] ? ' ' . (string) $field['suffix'] : '';

		return trim( $prefix . wp_strip_all_tags( wpbc_lang( (string) $field_value ) ) . $suffix );
	}

	/**
	 * Sign current old values and normalized replacements for this user.
	 *
	 * @param array<string,mixed> $plan Current inline plan.
	 * @return string Review token.
	 */
	private function create_review_token( $plan ) {
		return wp_hash(
			wp_json_encode(
				array(
					'user_id' => get_current_user_id(),
					'rows'    => isset( $plan['rows'] ) ? $plan['rows'] : array(),
				)
			),
			'nonce'
		);
	}

	/**
	 * Restore completed Resources in reverse order after a later failure.
	 *
	 * @param array<int,array<string,mixed>> $saved_rows Completed rows.
	 * @return array<int,string> Rollback errors.
	 */
	private function rollback( $saved_rows ) {
		$errors = array();
		foreach ( array_reverse( $saved_rows ) as $saved_row ) {
			$restored = $this->updater->update( absint( $saved_row['resource_id'] ), $saved_row['fields'] );
			if ( is_wp_error( $restored ) ) {
				$errors[] = $restored->get_error_message();
			}
		}

		return $errors;
	}

	/**
	 * Return string length without requiring the multibyte extension.
	 *
	 * @param string $text Text to measure.
	 * @return int Character or byte length.
	 */
	private function get_text_length( $text ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( (string) $text ) : strlen( (string) $text );
	}
}
