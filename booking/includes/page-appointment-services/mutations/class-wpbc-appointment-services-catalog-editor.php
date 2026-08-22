<?php
/**
 * Reviewed inline and bulk mutation service for the Appointment Services catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Apply allow-listed Service changes only after a signed, current-state review.
 *
 * Service SQL, edition checks, ownership, and validation remain in the Service
 * domain. The shared catalog supplies selection mechanics only.
 */
final class WPBC_Appointment_Services_Catalog_Editor {

	/** Maximum number of rows accepted by one catalog editing request. */
	const MAX_ROWS = 100;

	/** Maximum lifetime of a signed review in seconds. */
	const REVIEW_LIFETIME = 600;

	/** @var object Service-domain repository. */
	private $repository;

	/** @var WPBC_Appointment_Services_Catalog_Inline_Fields Domain field provider. */
	private $inline_fields;

	/**
	 * Construct the editor with an optional repository for runtime tests.
	 *
	 * @param object|null                                         $repository    Service repository exposing find() and save().
	 * @param WPBC_Appointment_Services_Catalog_Inline_Fields|null $inline_fields Optional field provider for tests.
	 */
	public function __construct( $repository = null, $inline_fields = null ) {
		$this->repository = is_object( $repository ) ? $repository : wpbc_appointment_services_get_data_provider();
		$this->inline_fields = $inline_fields instanceof WPBC_Appointment_Services_Catalog_Inline_Fields ? $inline_fields : new WPBC_Appointment_Services_Catalog_Inline_Fields();
	}

	/**
	 * Return authorized row-specific controls for the visible Services.
	 *
	 * The browser receives only executable-free field metadata. Current edition,
	 * ownership, and field restrictions are recalculated again during preview
	 * and apply, so this presentation contract is never treated as authority.
	 *
	 * @param mixed $service_ids Visible Service identifiers in catalog order.
	 *
	 * @return array<string,mixed>|WP_Error Browser-safe schema or validation error.
	 */
	public function get_inline_schema( $service_ids ) {
		$services = $this->load_services( $service_ids );
		if ( is_wp_error( $services ) ) {
			return $services;
		}

		$rows = array();
		foreach ( $services as $service ) {
			$rows[] = array(
				'service_id' => absint( $service['service_id'] ),
				'title'      => sanitize_text_field( (string) $service['title'] ),
				'fields'     => $this->get_inline_fields( $service ),
			);
		}

		return array(
			'maximum_rows' => self::MAX_ROWS,
			'rows'         => $rows,
		);
	}

	/**
	 * Return the safe bulk-field intersection for an authorized selection.
	 *
	 * Booking Form choices are owner-scoped. They are removed when a selection
	 * spans owners even if a future permission allows those rows to be selected
	 * together. All other returned fields are domain-safe for every loaded row.
	 *
	 * @param mixed $service_ids Selected Service identifiers.
	 *
	 * @return array<string,mixed>|WP_Error Browser-safe bulk contract or error.
	 */
	public function get_bulk_contract( $service_ids ) {
		$services = $this->load_services( $service_ids );
		if ( is_wp_error( $services ) ) {
			return $services;
		}

		return array(
			'fields'  => $this->get_bulk_fields_for_services( $services ),
			'message' => __( 'Only fields that are safe for every selected Service are available.', 'booking' ),
		);
	}

	/**
	 * Return browser-safe definitions for fields shared by selected Services.
	 *
	 * @return array<int,array<string,mixed>> Allow-listed bulk field definitions.
	 */
	public function get_bulk_fields() {
		return $this->inline_fields->get_bulk_fields( array() );
	}

	/**
	 * Build a non-mutating signed review for inline or bulk Service changes.
	 *
	 * @param string $mode    Either inline or bulk.
	 * @param mixed  $ids     Selected Service identifiers.
	 * @param mixed  $changes Inline changes keyed by ID, or shared bulk fields.
	 *
	 * @return array<string,mixed>|WP_Error Review rows and signed token, or error.
	 */
	public function preview( $mode, $ids, $changes ) {
		$mode = in_array( $mode, array( 'inline', 'bulk' ), true ) ? $mode : '';
		$ids  = $this->normalize_ids( $ids );
		if ( '' === $mode || is_wp_error( $ids ) ) {
			return new WP_Error( 'wpbc_service_invalid_selection', __( 'Select between 1 and 100 Services.', 'booking' ) );
		}
		if ( ! is_object( $this->repository ) || ! method_exists( $this->repository, 'find' ) || ! method_exists( $this->repository, 'save' ) ) {
			return wpbc_appointment_services_storage_error();
		}

		$current_services = $this->load_services( $ids );
		if ( is_wp_error( $current_services ) ) {
			return $current_services;
		}
		$services_by_id = array();
		foreach ( $current_services as $current_service ) {
			$services_by_id[ absint( $current_service['service_id'] ) ] = $current_service;
		}
		$bulk_allowed = 'bulk' === $mode ? wp_list_pluck( $this->get_bulk_fields_for_services( $current_services ), 'key' ) : null;

		$changes = is_array( $changes ) ? $changes : array();
		$plan    = array(
			'version'    => 1,
			'mode'       => $mode,
			'site_id'    => get_current_blog_id(),
			'user_id'    => get_current_user_id(),
			'expires_at' => time() + self::REVIEW_LIFETIME,
			'services'   => array(),
		);
		$rows    = array();
		foreach ( $ids as $service_id ) {
			$current = isset( $services_by_id[ $service_id ] ) ? $services_by_id[ $service_id ] : null;
			if ( ! is_array( $current ) ) { return new WP_Error( 'service_not_found', __( 'Service not found.', 'booking' ) ); }
			$requested = 'bulk' === $mode ? $changes : ( isset( $changes[ $service_id ] ) && is_array( $changes[ $service_id ] ) ? $changes[ $service_id ] : array() );
			$validated = $this->validate_changes( $requested, 'inline' === $mode, $current, $bulk_allowed );
			if ( is_wp_error( $validated ) ) { return $validated; }
			$row_changes = $this->build_row_changes( $current, $validated );
			if ( empty( $row_changes ) ) { continue; }
			$plan['services'][] = array(
				'id'       => $service_id,
				'changes'  => $validated,
				'snapshot' => $this->snapshot_hash( $current ),
			);
			$rows[] = array( 'id' => $service_id, 'title' => sanitize_text_field( $current['title'] ), 'changes' => $row_changes );
		}
		if ( empty( $rows ) ) {
			return new WP_Error( 'wpbc_service_no_changes', __( 'No Service changes require review.', 'booking' ) );
		}

		$review_rows = array();
		foreach ( $rows as $row ) {
			$review_rows[] = array(
				'id'     => absint( $row['id'] ),
				'title'  => (string) $row['title'],
				'fields' => array_values( $row['changes'] ),
				'notes'  => array(),
			);
		}

		return array( 'rows' => $rows, 'review' => array( 'rows' => $review_rows ), 'token' => $this->sign_plan( $plan ), 'plan' => $plan );
	}

	/**
	 * Apply a previously reviewed plan after current-state revalidation.
	 *
	 * Completed saves are compensated in reverse order if a later save fails.
	 *
	 * @param mixed  $plan  Review plan returned by preview().
	 * @param string $token Signed review token.
	 *
	 * @return array<string,mixed>|WP_Error Changed IDs or mutation error.
	 */
	public function apply( $plan, $token ) {
		$plan  = is_array( $plan ) ? $plan : array();
		$token = is_scalar( $token ) ? (string) $token : '';
		$mode  = isset( $plan['mode'] ) && in_array( $plan['mode'], array( 'inline', 'bulk' ), true ) ? $plan['mode'] : '';
		if ( ! $this->is_valid_plan_envelope( $plan, $token, $mode ) ) {
			return new WP_Error( 'wpbc_service_invalid_review', __( 'This Service review is invalid or has expired.', 'booking' ) );
		}
		if ( ! is_object( $this->repository ) || ! method_exists( $this->repository, 'find' ) || ! method_exists( $this->repository, 'save' ) ) {
			return wpbc_appointment_services_storage_error();
		}

		$before          = array();
		$validated_plans = array();
		foreach ( $plan['services'] as $service_plan ) {
			$service_id = isset( $service_plan['id'] ) ? absint( $service_plan['id'] ) : 0;
			$current    = $service_id ? $this->repository->find( $service_id ) : new WP_Error( 'invalid_service', __( 'The Service selection is invalid.', 'booking' ) );
			if ( is_wp_error( $current ) ) { return $current; }
			if ( empty( $service_plan['snapshot'] ) || ! hash_equals( (string) $service_plan['snapshot'], $this->snapshot_hash( $current ) ) ) {
				return new WP_Error( 'wpbc_service_stale_review', __( 'A selected Service changed after review. Review the changes again.', 'booking' ) );
			}
			$before[ $service_id ] = $current;
		}
		$bulk_allowed = 'bulk' === $mode ? wp_list_pluck( $this->get_bulk_fields_for_services( array_values( $before ) ), 'key' ) : null;
		foreach ( $plan['services'] as $service_plan ) {
			$service_id = absint( $service_plan['id'] );
			$validated_changes = $this->validate_changes(
				isset( $service_plan['changes'] ) && is_array( $service_plan['changes'] ) ? $service_plan['changes'] : array(),
				'inline' === $mode,
				$before[ $service_id ],
				$bulk_allowed
			);
			if ( is_wp_error( $validated_changes ) || empty( $validated_changes ) ) {
				return is_wp_error( $validated_changes ) ? $validated_changes : new WP_Error( 'wpbc_service_no_changes', __( 'No valid Service changes remain to apply.', 'booking' ) );
			}
			$validated_plans[ $service_id ] = $validated_changes;
		}

		$changed_ids = array();
		foreach ( $plan['services'] as $service_plan ) {
			$service_id = absint( $service_plan['id'] );
			$payload    = array_merge( $before[ $service_id ], $validated_plans[ $service_id ], array( 'service_id' => $service_id ) );
			$result     = $this->repository->save( $payload );
			if ( is_wp_error( $result ) ) {
				// A repository may fail after updating its Service row but before its Provider assignments.
				$this->repository->save( $before[ $service_id ] );
				foreach ( array_reverse( $changed_ids ) as $changed_id ) {
					$this->repository->save( $before[ $changed_id ] );
				}
				return new WP_Error( 'wpbc_service_apply_failed', __( 'The Service changes could not be completed. Previous values were restored where possible.', 'booking' ) );
			}
			$changed_ids[] = $service_id;
		}

		do_action( 'wpbc_appointment_services_catalog_updated', $changed_ids, $mode );

		return array( 'changed_ids' => $changed_ids );
	}

	/**
	 * Validate an allow-listed set of Service fields.
	 *
	 * @param array<string,mixed> $changes      Requested changes.
	 * @param bool                $inline_mode Whether the request is row-specific inline editing.
	 * @param array<string,mixed>   $service          Current authorized Service row.
	 * @param array<int,string>|null $allowed_override Selection-specific bulk allow-list.
	 *
	 * @return array<string,mixed>|WP_Error Valid changes or validation error.
	 */
	private function validate_changes( $changes, $inline_mode, $service, $allowed_override = null ) {
		$field_definitions = $inline_mode ? $this->get_inline_fields( $service ) : $this->get_bulk_fields();
		$allowed           = is_array( $allowed_override ) ? $allowed_override : wp_list_pluck( $field_definitions, 'key' );
		$changes           = is_array( $changes ) ? $changes : array();
		if ( array_diff( array_keys( $changes ), $allowed ) ) {
			return new WP_Error( 'wpbc_service_unsupported_field', __( 'One or more Service fields are no longer available for this operation.', 'booking' ) );
		}
		$validated = array();
		foreach ( $changes as $field_id => $raw_value ) {
			if ( ! is_scalar( $raw_value ) ) {
				return new WP_Error( 'wpbc_service_invalid_field', __( 'A Service field contains an invalid value.', 'booking' ) );
			}
			switch ( $field_id ) {
				case 'title':
					$validated[ $field_id ] = wp_html_excerpt( sanitize_text_field( $raw_value ), 200, '' );
					if ( '' === $validated[ $field_id ] ) { return new WP_Error( 'wpbc_service_title_required', __( 'Every Service must have a title.', 'booking' ) ); }
					break;
				case 'description':
					$description = sanitize_textarea_field( $raw_value );
					$description_length = function_exists( 'mb_strlen' ) ? mb_strlen( $description ) : strlen( $description );
					if ( 2000 < $description_length ) { return new WP_Error( 'wpbc_service_description_too_long', __( 'The Service description is too long.', 'booking' ) ); }
					$validated[ $field_id ] = $description;
					break;
				case 'duration_minutes':
					if ( ! $this->is_integer_value( $raw_value ) || 1 > (int) $raw_value || 1440 < (int) $raw_value ) { return new WP_Error( 'wpbc_service_invalid_duration', __( 'Enter a Service duration between 1 and 1440 minutes.', 'booking' ) ); }
					$validated[ $field_id ] = absint( $raw_value );
					break;
				case 'buffer_before_minutes':
				case 'buffer_after_minutes':
					if ( ! $this->is_integer_value( $raw_value ) || 0 > (int) $raw_value || 1440 < (int) $raw_value ) { return new WP_Error( 'wpbc_service_invalid_buffer', __( 'Enter a Service buffer between 0 and 1440 minutes.', 'booking' ) ); }
					$validated[ $field_id ] = absint( $raw_value );
					break;
				case 'base_cost':
					if ( ! wpbc_appointment_services_is_pricing_available() || ! is_numeric( $raw_value ) || 0 > (float) $raw_value || 1000 < (float) $raw_value ) { return new WP_Error( 'wpbc_service_invalid_price', __( 'Enter a Service price between 0 and 1000.', 'booking' ) ); }
					$validated[ $field_id ] = number_format( (float) $raw_value, 2, '.', '' );
					break;
				case 'booking_form_id':
					$form_id = absint( $raw_value );
					if ( ! array_key_exists( $form_id, wpbc_appointment_services_get_form_options() ) ) { return new WP_Error( 'wpbc_service_invalid_form', __( 'The selected Booking Form is unavailable.', 'booking' ) ); }
					$validated[ $field_id ] = $form_id;
					break;
				case 'status':
					$status = sanitize_key( $raw_value );
					if ( ! in_array( $status, array( 'active', 'inactive', 'archived' ), true ) ) { return new WP_Error( 'wpbc_service_invalid_status', __( 'The selected Service status is invalid.', 'booking' ) ); }
					$validated[ $field_id ] = $status;
					break;
			}
		}

		return $validated;
	}

	/**
	 * Determine whether a submitted scalar represents a whole integer.
	 *
	 * Number controls can be manipulated outside the browser, so this prevents
	 * decimal values from being silently truncated during server validation.
	 *
	 * @param mixed $raw_value Submitted field value.
	 * @return bool True when the value contains only an optional minus sign and digits.
	 */
	private function is_integer_value( $raw_value ) {
		return is_scalar( $raw_value ) && 1 === preg_match( '/^-?\d+$/', (string) $raw_value );
	}

	/**
	 * Build the current row-specific inline field definitions for one Service.
	 *
	 * @param array<string,mixed> $service Current authorized Service row.
	 *
	 * @return array<int,array<string,mixed>> Executable-free field definitions.
	 */
	private function get_inline_fields( $service ) {
		return $this->inline_fields->get_inline_fields( $service );
	}

	/**
	 * Calculate fields shared safely by a loaded Service collection.
	 *
	 * @param array<int,array<string,mixed>> $services Authorized Service rows.
	 *
	 * @return array<int,array<string,mixed>> Selection-specific field definitions.
	 */
	private function get_bulk_fields_for_services( $services ) {
		return $this->inline_fields->get_bulk_fields( $services );
	}

	/**
	 * Normalize one bounded identifier collection without accepting partial input.
	 *
	 * @param mixed $service_ids Requested Service identifiers.
	 *
	 * @return array<int,int>|WP_Error Unique positive identifiers or error.
	 */
	private function normalize_ids( $service_ids ) {
		$raw_ids = is_array( $service_ids ) ? $service_ids : array();
		$ids     = array_values( array_unique( array_filter( array_map( 'absint', $raw_ids ) ) ) );
		if ( empty( $ids ) || self::MAX_ROWS < count( $ids ) || count( $ids ) !== count( $raw_ids ) ) {
			return new WP_Error( 'wpbc_service_invalid_selection', __( 'Select between 1 and 100 Services.', 'booking' ) );
		}

		return $ids;
	}

	/**
	 * Load an authorized bounded Service collection in request order.
	 *
	 * @param mixed $service_ids Requested Service identifiers.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Service rows or safe error.
	 */
	private function load_services( $service_ids ) {
		$service_ids = $this->normalize_ids( $service_ids );
		if ( is_wp_error( $service_ids ) ) {
			return $service_ids;
		}
		if ( ! is_object( $this->repository ) || ! method_exists( $this->repository, 'find' ) ) {
			return wpbc_appointment_services_storage_error();
		}

		$services = array();
		foreach ( $service_ids as $service_id ) {
			$service = $this->repository->find( $service_id );
			if ( is_wp_error( $service ) ) {
				return $service;
			}
			$services[] = $service;
		}

		return $services;
	}

	/**
	 * Build human-readable field differences for one review card.
	 *
	 * @param array<string,mixed> $current Current Service row.
	 * @param array<string,mixed> $changes Validated changes.
	 *
	 * @return array<int,array<string,string>> Changed field records.
	 */
	private function build_row_changes( $current, $changes ) {
		$labels = array();
		foreach ( array_merge( $this->inline_fields->get_inline_fields( $current ), $this->inline_fields->get_bulk_fields( array( $current ) ) ) as $field ) {
			$labels[ $field['key'] ] = $field['label'];
		}
		$rows   = array();
		foreach ( $changes as $field_id => $after ) {
			$before = isset( $current[ $field_id ] ) ? $current[ $field_id ] : '';
			if ( (string) $before === (string) $after || ( 'base_cost' === $field_id && (float) $before === (float) $after ) ) { continue; }
			$rows[] = array( 'key' => sanitize_key( $field_id ), 'label' => isset( $labels[ $field_id ] ) ? $labels[ $field_id ] : $field_id, 'before' => (string) $before, 'after' => (string) $after );
		}

		return $rows;
	}

	/**
	 * Hash values that must remain current between review and apply.
	 *
	 * @param array<string,mixed> $service Current repository row.
	 *
	 * @return string Current-state hash.
	 */
	private function snapshot_hash( $service ) {
		return hash( 'sha256', wp_json_encode( $service ) );
	}

	/**
	 * Sign a review plan with the current WordPress nonce salt.
	 *
	 * @param array<string,mixed> $plan Review plan.
	 *
	 * @return string Signed plan token.
	 */
	private function sign_plan( $plan ) {
		return hash_hmac( 'sha256', wp_json_encode( $plan ), wp_salt( 'nonce' ) );
	}

	/**
	 * Validate one signed review envelope against the current user and site.
	 *
	 * @param array  $plan  Submitted review plan.
	 * @param string $token Submitted review signature.
	 * @param string $mode  Normalized editing mode.
	 * @return bool True when the review is authentic, current, and bounded.
	 */
	private function is_valid_plan_envelope( $plan, $token, $mode ) {
		return '' !== $mode
			&& '' !== $token
			&& isset( $plan['version'], $plan['mode'], $plan['site_id'], $plan['user_id'], $plan['expires_at'], $plan['services'] )
			&& 1 === absint( $plan['version'] )
			&& $mode === $plan['mode']
			&& get_current_blog_id() === absint( $plan['site_id'] )
			&& get_current_user_id() === absint( $plan['user_id'] )
			&& time() <= absint( $plan['expires_at'] )
			&& is_array( $plan['services'] )
			&& ! empty( $plan['services'] )
			&& self::MAX_ROWS >= count( $plan['services'] )
			&& hash_equals( $this->sign_plan( $plan ), $token );
	}
}
