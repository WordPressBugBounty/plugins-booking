<?php
/**
 * Independent reviewed bulk updates for the template-driven Resource catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build, preview, and apply explicit operations to authorized Resources.
 *
 * The service intersects the new inspector schemas for the selected Resources,
 * signs a server-authoritative old-to-new plan, and delegates each write to the
 * independent single-Resource updater. It never calls the legacy editor.
 */
final class WPBC_Catalog_Booking_Resources_Bulk_Editor {

	/** Maximum number of Resources accepted in one reviewed operation. */
	const MAX_SELECTION = 100;

	/** @var WPBC_Catalog_Booking_Resources_Repository Independent repository. */
	private $repository;

	/** @var WPBC_Catalog_Booking_Resource_Inspector_Schema Domain schema. */
	private $schema;

	/** @var WPBC_Catalog_Booking_Resource_Updater Independent updater. */
	private $updater;

	/** @var WPBC_Catalog_Booking_Resources_Inline_Fields Domain field provider. */
	private $inline_fields;

	/**
	 * Initialize independent collaborators.
	 *
	 * @param WPBC_Catalog_Booking_Resources_Repository|null       $repository Optional repository.
	 * @param WPBC_Catalog_Booking_Resource_Inspector_Schema|null $schema     Optional schema.
	 * @param WPBC_Catalog_Booking_Resource_Updater|null          $updater    Optional updater.
	 * @param WPBC_Catalog_Booking_Resources_Inline_Fields|null   $inline_fields Optional field provider.
	 */
	public function __construct( $repository = null, $schema = null, $updater = null, $inline_fields = null ) {
		$this->repository = $repository instanceof WPBC_Catalog_Booking_Resources_Repository ? $repository : new WPBC_Catalog_Booking_Resources_Repository();
		$this->schema     = $schema instanceof WPBC_Catalog_Booking_Resource_Inspector_Schema ? $schema : new WPBC_Catalog_Booking_Resource_Inspector_Schema();
		$this->updater    = $updater instanceof WPBC_Catalog_Booking_Resource_Updater ? $updater : new WPBC_Catalog_Booking_Resource_Updater();
		$this->inline_fields = $inline_fields instanceof WPBC_Catalog_Booking_Resources_Inline_Fields ? $inline_fields : new WPBC_Catalog_Booking_Resources_Inline_Fields( $this->schema );
	}

	/**
	 * Return the common executable-free field contract for a selection.
	 *
	 * @param array<int,mixed> $resource_ids Untrusted Resource IDs.
	 * @return array<string,mixed>|WP_Error Bulk schema or safe error.
	 */
	public function get_schema( $resource_ids ) {
		if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_edition', __( 'Bulk editing Booking Resources is available in higher Booking Calendar editions.', 'booking' ) );
		}
		$resources = $this->get_authorized_resources( $resource_ids );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		$definitions = $this->get_common_definitions( $resources );
		$sections    = $this->build_sections( $definitions, $resources );
		if ( empty( $sections ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_no_fields', __( 'The selected Booking Resources do not share any settings that can be edited together.', 'booking' ) );
		}

		return array(
			'mode'            => 'bulk_edit',
			'title'           => __( 'Edit Booking Resources', 'booking' ),
			'description'     => __( 'Only enabled changes will be applied to the selected resources.', 'booking' ),
			'selection_count' => count( $resources ),
			'resource_ids'    => array_values( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ),
			'sections'        => $sections,
		);
	}

	/**
	 * Return a signed server-authoritative change preview.
	 *
	 * @param array<int,mixed>    $resource_ids  Untrusted Resource IDs.
	 * @param array<string,mixed> $raw_operations Untrusted operation envelope.
	 * @return array<string,mixed>|WP_Error Preview or safe error.
	 */
	public function preview( $resource_ids, $raw_operations ) {
		$plan = $this->build_plan( $resource_ids, $raw_operations );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}
		$review_rows = array();
		foreach ( $plan['changes'] as $change ) {
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
		$plan['review'] = array( 'rows' => $review_rows );
		$plan['review_token'] = $this->create_review_token( $plan );

		return $plan;
	}

	/**
	 * Apply a reviewed plan and compensate completed rows if a later row fails.
	 *
	 * @param array<int,mixed>    $resource_ids  Untrusted Resource IDs.
	 * @param array<string,mixed> $raw_operations Untrusted operation envelope.
	 * @param string              $review_token Signed token returned by preview().
	 * @return array<string,mixed>|WP_Error Apply result or safe error.
	 */
	public function apply( $resource_ids, $raw_operations, $review_token ) {
		$plan = $this->build_plan( $resource_ids, $raw_operations, true );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}
		if ( '' === $review_token || ! hash_equals( $this->create_review_token( $plan ), $review_token ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_review_stale', __( 'One or more Booking Resources changed after the review. Review the changes again before applying them.', 'booking' ) );
		}
		if ( empty( $plan['changes'] ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_no_changes', __( 'These operations would not change any selected Booking Resource.', 'booking' ) );
		}

		$saved = array();
		foreach ( $plan['changes'] as $resource_change ) {
			$resource = $this->repository->get_resource( absint( $resource_change['resource_id'] ) );
			if ( is_wp_error( $resource ) || ! is_array( $resource ) ) {
				$this->rollback( $saved );

				return is_wp_error( $resource ) ? $resource : new WP_Error( 'wpbc_catalog_bulk_resource_missing', __( 'One of the selected Booking Resources is no longer available.', 'booking' ) );
			}
			$old_fields = $this->get_complete_fields( $resource );
			$new_fields = array_merge( $old_fields, $resource_change['new_fields'] );
			$updated    = $this->updater->update( absint( $resource['id'] ), $new_fields );
			if ( is_wp_error( $updated ) ) {
				$rollback_errors = $this->rollback( $saved );
				if ( ! empty( $rollback_errors ) ) {
					return new WP_Error( 'wpbc_catalog_bulk_rollback_failed', __( 'The bulk update stopped, and one or more completed changes could not be restored. Reload the catalog and verify the affected Booking Resources.', 'booking' ) );
				}

				return $updated;
			}
			$saved[] = array( 'resource_id' => absint( $resource['id'] ), 'fields' => $old_fields );
		}

		$updated_ids = array_values( array_map( 'absint', wp_list_pluck( $saved, 'resource_id' ) ) );
		do_action( 'wpbc_catalog_booking_resources_bulk_updated', $updated_ids, $plan['operations'] );

		return array( 'updated_ids' => $updated_ids, 'updated_count' => count( $updated_ids ) );
	}

	/**
	 * Build a normalized plan bound to current authorized values.
	 *
	 * @param array<int,mixed>    $resource_ids     Resource IDs.
	 * @param array<string,mixed> $raw_operations   Operation envelope.
	 * @param bool                $allow_no_changes Permit an empty apply-time plan for stale comparison.
	 * @return array<string,mixed>|WP_Error Plan or safe error.
	 */
	private function build_plan( $resource_ids, $raw_operations, $allow_no_changes = false ) {
		if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_edition', __( 'Bulk editing Booking Resources is available in higher Booking Calendar editions.', 'booking' ) );
		}
		$resources = $this->get_authorized_resources( $resource_ids );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		$definitions = $this->get_common_definitions( $resources );
		$operations  = $this->normalize_operations( $raw_operations, $definitions, count( $resources ) );
		if ( is_wp_error( $operations ) ) {
			return $operations;
		}
		if ( isset( $operations['owner_user_id'], $operations['default_form'] ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_owner_form_conflict', __( 'Change the resource owner and the default Booking Form in separate bulk updates so form permissions can be re-evaluated.', 'booking' ) );
		}

		$changes = array();
		foreach ( $resources as $resource_index => $resource ) {
			$change = $this->build_resource_change( $resource, $operations, $definitions, $resource_index + 1, count( $resources ) );
			if ( is_wp_error( $change ) ) {
				return $change;
			}
			if ( ! empty( $change['new_fields'] ) ) {
				$changes[] = $change;
			}
		}
		if ( empty( $changes ) && ! $allow_no_changes ) {
			return new WP_Error( 'wpbc_catalog_bulk_no_changes', __( 'These operations would not change any selected Booking Resource.', 'booking' ) );
		}

		return array(
			'schema'     => array( 'resource_ids' => array_values( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ) ),
			'operations' => $operations,
			'changes'    => $changes,
		);
	}

	/**
	 * Resolve unique IDs through the independent owner-visible repository.
	 *
	 * @param array<int,mixed> $resource_ids Resource IDs.
	 * @return array<int,array<string,mixed>>|WP_Error Resources or safe error.
	 */
	private function get_authorized_resources( $resource_ids ) {
		$ids = array();
		foreach ( is_array( $resource_ids ) ? $resource_ids : array() as $resource_id ) {
			$resource_id = absint( $resource_id );
			if ( $resource_id ) {
				$ids[ $resource_id ] = $resource_id;
			}
		}
		$ids = array_values( $ids );
		if ( empty( $ids ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_selection_small', __( 'Select at least one Booking Resource to edit.', 'booking' ) );
		}
		if ( count( $ids ) > self::MAX_SELECTION ) {
			return new WP_Error( 'wpbc_catalog_bulk_selection_large', sprintf( __( 'Select no more than %s Booking Resources in one bulk update.', 'booking' ), number_format_i18n( self::MAX_SELECTION ) ) );
		}

		$resources = array();
		foreach ( $ids as $resource_id ) {
			$resource = $this->repository->get_resource( $resource_id );
			if ( is_wp_error( $resource ) ) {
				return $resource;
			}
			if ( ! is_array( $resource ) ) {
				return new WP_Error( 'wpbc_catalog_bulk_resource_unavailable', __( 'One of the selected Booking Resources is not available to this account.', 'booking' ) );
			}
			$resources[] = $resource;
		}
		$publishing_shortcodes = $this->repository->get_publishing_shortcodes( $ids );
		foreach ( $resources as &$resource ) {
			$resource_id                      = absint( $resource['id'] );
			$resource['publishing_shortcode'] = isset( $publishing_shortcodes[ $resource_id ] )
				? $publishing_shortcodes[ $resource_id ]
				: '[booking resource_id=' . $resource_id . ']';
		}
		unset( $resource );

		return $resources;
	}

	/**
	 * Intersect editable field definitions across every selected Resource.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized Resources.
	 * @return array<string,array<string,mixed>> Common definitions.
	 */
	private function get_common_definitions( $resources ) {
		return WPBC_UI_Catalog_Inline_Field_Schema::index_fields( $this->inline_fields->get_bulk_fields( $resources ) );
	}

	/**
	 * Build ordered client-safe sections and operations.
	 *
	 * @param array<string,array<string,mixed>> $definitions Common definitions.
	 * @param array<int,array<string,mixed>>     $resources   Resources.
	 * @return array<int,array<string,mixed>> Sections.
	 */
	private function build_sections( $definitions, $resources ) {
		$sections = array(
			'pricing'            => array( 'id' => 'pricing', 'title' => __( 'Pricing', 'booking' ), 'expanded' => true, 'fields' => array() ),
			'booking_setup'       => array( 'id' => 'booking_setup', 'title' => __( 'Booking setup', 'booking' ), 'expanded' => false, 'fields' => array() ),
			'structure'           => array( 'id' => 'structure', 'title' => __( 'Structure and order', 'booking' ), 'expanded' => false, 'fields' => array() ),
			'ownership'           => array( 'id' => 'ownership', 'title' => __( 'Ownership', 'booking' ), 'expanded' => false, 'fields' => array() ),
			'availability_search' => array( 'id' => 'availability_search', 'title' => __( 'Availability and search', 'booking' ), 'expanded' => false, 'fields' => array() ),
		);
		foreach ( $definitions as $field_key => $definition ) {
			$field      = $this->build_client_field( $field_key, $definition, $resources );
			$section_id = $field['section'];
			unset( $field['section'] );
			$sections[ $section_id ]['fields'][] = $field;
		}

		return array_values( array_filter( $sections, static function ( $section ) { return ! empty( $section['fields'] ); } ) );
	}

	/**
	 * Build one client-safe bulk field.
	 *
	 * @param string                          $field_key  Field key.
	 * @param array<string,mixed>             $definition Common definition.
	 * @param array<int,array<string,mixed>>  $resources Resources.
	 * @return array<string,mixed> Client field.
	 */
	private function build_client_field( $field_key, $definition, $resources ) {
		$values = array();
		foreach ( $resources as $resource ) {
			$values[] = $this->get_field_value( $resource, $field_key );
		}
		$unique = array_values( array_unique( array_map( 'strval', $values ) ) );
		$field  = array(
			'key'             => $field_key,
			'label'           => isset( $definition['label'] ) ? wp_strip_all_tags( (string) $definition['label'] ) : $field_key,
			'type'            => isset( $definition['type'] ) && 'select' === $definition['type'] ? 'select' : 'number',
			'options'         => isset( $definition['options'] ) ? array_values( $definition['options'] ) : array(),
			'current_value'   => 1 === count( $unique ) ? $unique[0] : '',
			'current_display' => 1 === count( $unique ) ? $this->format_value( $unique[0], $definition ) : __( 'Mixed values', 'booking' ),
			'mixed'           => count( $unique ) > 1,
			'min'             => 0,
			'max'             => '',
			'step'            => 1,
			'slider_min'      => 0,
			'slider_max'      => 'base_cost' === $field_key ? 1000 : 100,
			'slider_step'     => 1,
			'prefix'          => isset( $definition['prefix'] ) ? (string) $definition['prefix'] : '',
			'suffix'          => isset( $definition['suffix'] ) ? (string) $definition['suffix'] : '',
		);
		if ( 'base_cost' === $field_key ) {
			$field['section'] = 'pricing';
			$field['operations'] = array(
				array( 'id' => 'set', 'label' => __( 'Set to', 'booking' ) ), array( 'id' => 'increase_amount', 'label' => __( 'Increase by amount', 'booking' ) ),
				array( 'id' => 'decrease_amount', 'label' => __( 'Decrease by amount', 'booking' ) ), array( 'id' => 'increase_percent', 'label' => __( 'Increase by percent', 'booking' ) ),
				array( 'id' => 'decrease_percent', 'label' => __( 'Decrease by percent', 'booking' ) ),
			);
			$field['help'] = __( 'Each resource keeps its own current price unless this setting is enabled. Decreases never produce a negative price.', 'booking' );
		} elseif ( 'default_form' === $field_key ) {
			$field['section'] = 'booking_setup';
			$field['operations'] = array( array( 'id' => 'replace', 'label' => __( 'Replace with', 'booking' ) ) );
			$field['help'] = __( 'Only Booking Forms available to every selected resource owner are listed.', 'booking' );
		} elseif ( 'priority' === $field_key ) {
			$field['section'] = 'structure';
			$field['operations'] = array( array( 'id' => 'set', 'label' => __( 'Set to', 'booking' ) ), array( 'id' => 'increase_amount', 'label' => __( 'Increase by', 'booking' ) ), array( 'id' => 'decrease_amount', 'label' => __( 'Decrease by', 'booking' ) ) );
			if ( count( $resources ) > 1 ) {
				$field['operations'] = array_merge( $field['operations'], array(
					array( 'id' => 'increase_progressively', 'label' => __( 'Increase progressively by', 'booking' ) ), array( 'id' => 'decrease_progressively', 'label' => __( 'Decrease progressively by', 'booking' ) ),
					array( 'id' => 'set_increasing_sequence', 'label' => __( 'Set increasing sequence by', 'booking' ) ), array( 'id' => 'set_decreasing_sequence', 'label' => __( 'Set decreasing sequence by', 'booking' ) ),
				) );
			}
			$field['help'] = __( 'Progressive operations adjust each current Priority. Sequence operations replace values in the selected catalog order. Priority remains a non-negative whole number.', 'booking' );
		} elseif ( 'owner_user_id' === $field_key ) {
			$field['section'] = 'ownership';
			$field['operations'] = array( array( 'id' => 'replace', 'label' => __( 'Assign to', 'booking' ) ) );
			$field['help'] = __( 'Owner reassignment is available only to the authorized Booking Calendar super administrator and only for independent resources.', 'booking' );
		} else {
			$field['section'] = 'availability_search';
			$field['operations'] = array( array( 'id' => 'replace', 'label' => __( 'Replace with', 'booking' ) ) );
			$field['help'] = 'searchable_status' === $field_key
				? __( 'Only top-level resources can appear in Search Availability results.', 'booking' )
				: __( 'This changes the default day state while preserving existing season-filter assignments.', 'booking' );
		}
		if ( isset( $definition['max'] ) && is_numeric( $definition['max'] ) ) {
			$field['max'] = (string) $definition['max'];
		}

		return $field;
	}

	/**
	 * Normalize enabled operations against the generated schema.
	 *
	 * @param array<string,mixed>              $raw_operations Untrusted operations.
	 * @param array<string,array<string,mixed>> $definitions    Common definitions.
	 * @param int                               $selection_count Selection size.
	 * @return array<string,array<string,string>>|WP_Error Normalized operations.
	 */
	private function normalize_operations( $raw_operations, $definitions, $selection_count ) {
		$normalized = array();
		foreach ( is_array( $raw_operations ) ? $raw_operations : array() as $field_key => $raw_operation ) {
			$field_key = sanitize_key( $field_key );
			if ( ! isset( $definitions[ $field_key ] ) || ! is_array( $raw_operation ) ) {
				return new WP_Error( 'wpbc_catalog_bulk_field_invalid', __( 'One of the selected bulk settings is unavailable.', 'booking' ) );
			}
			$operation = isset( $raw_operation['operation'] ) && is_scalar( $raw_operation['operation'] ) ? sanitize_key( $raw_operation['operation'] ) : '';
			$value     = isset( $raw_operation['value'] ) && is_scalar( $raw_operation['value'] ) ? trim( (string) $raw_operation['value'] ) : '';
			if ( ! in_array( $operation, $this->get_allowed_operations( $field_key, $selection_count ), true ) ) {
				return new WP_Error( 'wpbc_catalog_bulk_operation_invalid', __( 'One of the selected bulk operations is invalid.', 'booking' ) );
			}
			if ( isset( $definitions[ $field_key ]['options'] ) && ! empty( $definitions[ $field_key ]['options'] ) ) {
				if ( ! in_array( $value, array_map( 'strval', wp_list_pluck( $definitions[ $field_key ]['options'], 'value' ) ), true ) ) {
					return new WP_Error( 'wpbc_catalog_bulk_option_invalid', __( 'Select an option available to every selected Booking Resource.', 'booking' ) );
				}
			} else {
				$value = str_replace( ',', '.', $value );
				if ( '' === $value || ! is_numeric( $value ) || ! is_finite( (float) $value ) || (float) $value < 0 ) {
					return new WP_Error( 'wpbc_catalog_bulk_number_invalid', __( 'Enter a valid non-negative number for every enabled setting.', 'booking' ) );
				}
				if ( 'priority' === $field_key && ! preg_match( '/^\d+$/', $value ) ) {
					return new WP_Error( 'wpbc_catalog_bulk_priority_invalid', __( 'Priority must be a non-negative whole number.', 'booking' ) );
				}
				$value = 'priority' === $field_key ? (string) absint( $value ) : (string) (float) $value;
			}
			$normalized[ $field_key ] = array( 'operation' => $operation, 'value' => $value );
		}
		if ( empty( $normalized ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_operations_empty', __( 'Enable at least one setting to change.', 'booking' ) );
		}

		return $normalized;
	}

	/**
	 * Return allow-listed operation IDs for a field.
	 *
	 * @param string $field_key Field key.
	 * @param int    $selection_count Selection size.
	 * @return array<int,string> Operation IDs.
	 */
	private function get_allowed_operations( $field_key, $selection_count ) {
		$map = array(
			'base_cost' => array( 'set', 'increase_amount', 'decrease_amount', 'increase_percent', 'decrease_percent' ), 'priority' => array( 'set', 'increase_amount', 'decrease_amount' ),
			'default_form' => array( 'replace' ), 'owner_user_id' => array( 'replace' ), 'searchable_status' => array( 'replace' ), 'availability_mode' => array( 'replace' ),
		);
		if ( $selection_count > 1 ) {
			$map['priority'] = array_merge( $map['priority'], array( 'increase_progressively', 'decrease_progressively', 'set_increasing_sequence', 'set_decreasing_sequence' ) );
		}

		return isset( $map[ $field_key ] ) ? $map[ $field_key ] : array();
	}

	/**
	 * Compute one Resource's changed fields and display review.
	 *
	 * @param array<string,mixed>              $resource Resources.
	 * @param array<string,array<string,string>> $operations Operations.
	 * @param array<string,array<string,mixed>> $definitions Definitions.
	 * @param int                               $position Selection position.
	 * @param int                               $count Selection count.
	 * @return array<string,mixed>|WP_Error Change record.
	 */
	private function build_resource_change( $resource, $operations, $definitions, $position, $count ) {
		$new_fields = array();
		$old_fields = array();
		$fields     = array();
		foreach ( $operations as $field_key => $operation ) {
			$current = $this->get_field_value( $resource, $field_key );
			$new     = $this->calculate_value( $field_key, $current, $operation, $position, $count );
			if ( is_wp_error( $new ) ) {
				return $new;
			}
			$is_equal = in_array( $field_key, array( 'base_cost', 'priority' ), true ) ? abs( (float) $current - (float) $new ) < 0.00000001 : (string) $current === (string) $new;
			if ( $is_equal ) {
				continue;
			}
			$new_fields[ $field_key ] = $new;
			$old_fields[ $field_key ] = $current;
			$fields[] = array( 'key' => $field_key, 'label' => (string) $definitions[ $field_key ]['label'], 'old' => $this->format_value( $current, $definitions[ $field_key ] ), 'new' => $this->format_value( $new, $definitions[ $field_key ] ) );
		}
		if ( isset( $new_fields['owner_user_id'] ) && isset( $definitions['default_form'] ) ) {
			$current_form = $this->get_field_value( $resource, 'default_form' );
			if ( 'standard' !== $current_form ) {
				$new_fields['default_form'] = 'standard';
				$old_fields['default_form'] = $current_form;
				$fields[] = array(
					'key'   => 'default_form',
					'label' => (string) $definitions['default_form']['label'],
					'old'   => $this->format_value( $current_form, $definitions['default_form'] ),
					'new'   => $this->format_value( 'standard', $definitions['default_form'] ),
				);
			}
		}

		return array( 'resource_id' => absint( $resource['id'] ), 'title' => wp_strip_all_tags( wpbc_lang( (string) $resource['title'] ) ), 'old_fields' => $old_fields, 'new_fields' => $new_fields, 'fields' => $fields );
	}

	/**
	 * Calculate one target value from an allow-listed operation.
	 *
	 * @param string                     $field_key Field key.
	 * @param string                     $current Current value.
	 * @param array{operation:string,value:string} $operation Operation.
	 * @param int                        $position Selection position.
	 * @param int                        $count Selection count.
	 * @return string|WP_Error Target value.
	 */
	private function calculate_value( $field_key, $current, $operation, $position, $count ) {
		if ( in_array( $field_key, array( 'default_form', 'owner_user_id', 'searchable_status', 'availability_mode' ), true ) ) {
			return (string) $operation['value'];
		}
		$current_number = is_numeric( $current ) ? (float) $current : 0;
		$operand        = (float) $operation['value'];
		switch ( $operation['operation'] ) {
			case 'set': $target = $operand; break;
			case 'increase_amount': $target = $current_number + $operand; break;
			case 'decrease_amount': $target = max( 0, $current_number - $operand ); break;
			case 'increase_percent': $target = $current_number * ( 1 + $operand / 100 ); break;
			case 'decrease_percent': $target = max( 0, $current_number * ( 1 - $operand / 100 ) ); break;
			case 'increase_progressively': $target = $current_number + $operand * $position; break;
			case 'decrease_progressively': $target = max( 0, $current_number - $operand * $position ); break;
			case 'set_increasing_sequence': $target = $operand * $position; break;
			case 'set_decreasing_sequence': $target = $operand * ( $count - $position + 1 ); break;
			default: return new WP_Error( 'wpbc_catalog_bulk_operation_invalid', __( 'One of the selected bulk operations is invalid.', 'booking' ) );
		}
		if ( ! is_finite( $target ) || ( 'priority' === $field_key && $target > PHP_INT_MAX ) ) {
			return new WP_Error( 'wpbc_catalog_bulk_result_invalid', __( 'One of the calculated values is too large.', 'booking' ) );
		}

		return 'priority' === $field_key ? (string) max( 0, (int) round( $target ) ) : (string) round( max( 0, $target ), 8 );
	}

	/**
	 * Return one current canonical field value.
	 *
	 * @param array<string,mixed> $resource Resource.
	 * @param string              $field_key Field key.
	 * @return string Canonical value.
	 */
	private function get_field_value( $resource, $field_key ) {
		$map = array( 'base_cost' => 'cost', 'default_form' => 'default_form', 'priority' => 'priority', 'owner_user_id' => 'owner_user_id' );
		if ( isset( $map[ $field_key ], $resource[ $map[ $field_key ] ] ) ) {
			return 'default_form' === $field_key && '' === (string) $resource[ $map[ $field_key ] ] ? 'standard' : (string) $resource[ $map[ $field_key ] ];
		}
		$fields = $this->inline_fields->get_indexed_fields( $resource );

		return isset( $fields[ $field_key ]['value'] ) ? (string) $fields[ $field_key ]['value'] : '';
	}

	/**
	 * Return a complete single-updater submission for rollback and partial merge.
	 *
	 * @param array<string,mixed> $resource Resource.
	 * @return array<string,mixed> Complete fields.
	 */
	private function get_complete_fields( $resource ) {
		$fields = array(
			'title' => (string) $resource['title'], 'description' => isset( $resource['description'] ) ? (string) $resource['description'] : '', 'picture_url' => isset( $resource['picture_url'] ) ? (string) $resource['picture_url'] : '',
		);
		foreach ( $this->inline_fields->get_indexed_fields( $resource ) as $field_key => $definition ) {
			if ( ! empty( $definition['editable'] ) && array_key_exists( 'value', $definition ) ) {
				$fields[ $field_key ] = $definition['value'];
			}
		}

		return $fields;
	}

	/**
	 * Format one value using schema options and affixes.
	 *
	 * @param string              $value Value.
	 * @param array<string,mixed> $definition Field definition.
	 * @return string Plain display value.
	 */
	private function format_value( $value, $definition ) {
		foreach ( isset( $definition['options'] ) ? (array) $definition['options'] : array() as $option ) {
			if ( isset( $option['value'] ) && (string) $option['value'] === (string) $value ) {
				return isset( $option['label'] ) ? wp_strip_all_tags( (string) $option['label'] ) : (string) $value;
			}
		}
		$prefix = isset( $definition['prefix'] ) ? (string) $definition['prefix'] : '';
		$suffix = isset( $definition['suffix'] ) ? (string) $definition['suffix'] : '';

		return trim( $prefix . $value . ( '' !== $suffix ? ' ' . $suffix : '' ) );
	}

	/**
	 * Sign IDs, normalized operations, and current values.
	 *
	 * @param array<string,mixed> $plan Current plan.
	 * @return string Review signature.
	 */
	private function create_review_token( $plan ) {
		return wp_hash( wp_json_encode( array( 'schema' => $plan['schema'], 'operations' => $plan['operations'], 'changes' => $plan['changes'] ) ), 'nonce' );
	}

	/**
	 * Restore completed resources in reverse order.
	 *
	 * @param array<int,array<string,mixed>> $saved Completed saves.
	 * @return array<int,string> Rollback errors.
	 */
	private function rollback( $saved ) {
		$errors = array();
		foreach ( array_reverse( $saved ) as $saved_resource ) {
			$restored = $this->updater->update( absint( $saved_resource['resource_id'] ), $saved_resource['fields'] );
			if ( ! is_wp_error( $restored ) && isset( $saved_resource['fields']['owner_user_id'], $saved_resource['fields']['default_form'] ) ) {
				// Owner changes intentionally reset forms. A second validated pass restores the original form after the original owner is back in context.
				$restored = $this->updater->update( absint( $saved_resource['resource_id'] ), $saved_resource['fields'] );
			}
			if ( is_wp_error( $restored ) ) {
				$errors[] = $restored->get_error_message();
			}
		}

		return $errors;
	}
}
