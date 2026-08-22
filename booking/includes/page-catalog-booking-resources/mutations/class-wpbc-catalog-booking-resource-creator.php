<?php
/**
 * Independent Booking Resource create service for the catalog inspector.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and create a bounded batch without legacy editor or POST adapters.
 */
final class WPBC_Catalog_Booking_Resource_Creator {

	/**
	 * Inspector schema used for current limits and allow-lists.
	 *
	 * @var WPBC_Catalog_Booking_Resource_Inspector_Schema
	 */
	private $schema;

	/**
	 * Cross-edition presentation store.
	 *
	 * @var WPBC_Catalog_Booking_Resource_Content_Store
	 */
	private $content_store;

	/**
	 * Independent Resource repository used for authorized parent resolution.
	 *
	 * @var WPBC_Catalog_Booking_Resources_Repository
	 */
	private $repository;

	/**
	 * Initialize independent collaborators.
	 *
	 * @param WPBC_Catalog_Booking_Resource_Inspector_Schema|null $schema        Optional schema service.
	 * @param WPBC_Catalog_Booking_Resource_Content_Store|null    $content_store Optional content store.
	 * @param WPBC_Catalog_Booking_Resources_Repository|null      $repository    Optional Resource repository.
	 */
	public function __construct( $schema = null, $content_store = null, $repository = null ) {
		$this->schema        = $schema instanceof WPBC_Catalog_Booking_Resource_Inspector_Schema ? $schema : new WPBC_Catalog_Booking_Resource_Inspector_Schema();
		$this->content_store = $content_store instanceof WPBC_Catalog_Booking_Resource_Content_Store ? $content_store : new WPBC_Catalog_Booking_Resource_Content_Store();
		$this->repository    = $repository instanceof WPBC_Catalog_Booking_Resources_Repository ? $repository : new WPBC_Catalog_Booking_Resources_Repository();
	}

	/**
	 * Create a validated independent or child Resource batch.
	 *
	 * @param mixed $submitted_fields Untrusted decoded field map.
	 *
	 * @return array{resource_ids:array<int,int>}|WP_Error Created IDs or error.
	 */
	public function create( $submitted_fields ) {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return new WP_Error( 'wpbc_catalog_resource_create_paid_required', __( 'Additional Booking Resources are available in Pro versions.', 'booking' ) );
		}
		if ( ! is_array( $submitted_fields ) ) {
			return new WP_Error( 'wpbc_catalog_resource_create_invalid', __( 'The Booking Resource creation request is invalid.', 'booking' ) );
		}

		$validated = $this->validate_fields( $submitted_fields );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		global $wpdb;

		$created_ids = array();
		for ( $resource_index = 0; $resource_index < $validated['quantity']; $resource_index++ ) {
			$title = 1 === $validated['quantity'] ? $validated['title'] : $validated['title'] . '-' . ( $resource_index + 1 );
			$insert_values  = array( 'title' => $title );
			$insert_formats = array( '%s' );
			if ( class_exists( 'wpdev_bk_biz_s' ) ) {
				$insert_values['cost'] = $validated['base_cost'];
				$insert_formats[]      = '%s';
			}
			if ( class_exists( 'wpdev_bk_biz_m' ) && $this->schema->can_edit_default_form() ) {
				$insert_values['default_form'] = $validated['default_form'];
				$insert_formats[]              = '%s';
			}
			if ( class_exists( 'wpdev_bk_biz_l' ) ) {
				$insert_values['prioritet'] = $validated['priority'] + $resource_index;
				$insert_values['parent']    = $validated['parent_id'];
				$insert_formats[]           = '%d';
				$insert_formats[]           = '%d';
			}
			if ( class_exists( 'wpdev_bk_multiuser' ) ) {
				$insert_values['users'] = $validated['owner_user_id'];
				$insert_formats[]       = '%d';
			}

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Explicit canonical Resource creation.
			$inserted = $wpdb->insert( $wpdb->prefix . 'bookingtypes', $insert_values, $insert_formats );
			if ( 1 !== $inserted || ! $wpdb->insert_id ) {
				$this->rollback( $created_ids );

				return new WP_Error( 'wpbc_catalog_resource_create_failed', __( 'The Booking Resources could not be created.', 'booking' ) );
			}
			$resource_id   = absint( $wpdb->insert_id );
			$created_ids[] = $resource_id;
			$stored        = $this->content_store->save( $resource_id, $title, $validated['description'], $validated['picture_url'] );
			if ( is_wp_error( $stored ) ) {
				$this->rollback( $created_ids );

				return $stored;
			}
		}

		foreach ( $created_ids as $created_id ) {
			do_action( 'wpbc_resource_created', $created_id );
		}
		WPBC_Catalog_Booking_Resource_Demo_Policy::register_created_resource_ids( $created_ids );
		if ( function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_booking_resource_cache' );
		}
		do_action( 'wpbc_catalog_booking_resources_created', $created_ids, $validated );

		return array( 'resource_ids' => $created_ids );
	}

	/**
	 * Validate create fields and active-edition allow-lists.
	 *
	 * @param array $submitted_fields Untrusted field map.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or error.
	 */
	private function validate_fields( $submitted_fields ) {
		$title = isset( $submitted_fields['title'] ) && is_scalar( $submitted_fields['title'] ) ? sanitize_text_field( (string) $submitted_fields['title'] ) : '';
		if ( '' === $title ) {
			return new WP_Error( 'wpbc_catalog_resource_create_title_required', __( 'Enter a title for the new Booking Resource.', 'booking' ) );
		}
		$maximum_quantity = $this->schema->get_maximum_quantity();
		$quantity_value   = isset( $submitted_fields['quantity'] ) && is_scalar( $submitted_fields['quantity'] ) ? (string) $submitted_fields['quantity'] : '1';
		if ( ! preg_match( '/^\d+$/', $quantity_value ) ) {
			return new WP_Error( 'wpbc_catalog_resource_create_quantity_invalid', __( 'Choose a valid resource quantity.', 'booking' ) );
		}
		$quantity = absint( $quantity_value );
		if ( $maximum_quantity < 1 || $quantity < 1 || $quantity > $maximum_quantity ) {
			return new WP_Error( 'wpbc_catalog_resource_create_limit', __( 'The Booking Resource limit for this account has been reached.', 'booking' ) );
		}
		$maximum_title_length = 1 === $quantity ? 200 : 200 - strlen( '-' . $quantity );
		if ( $this->get_text_length( $title ) > $maximum_title_length ) {
			return new WP_Error( 'wpbc_catalog_resource_create_title_length', __( 'The Booking Resource title is too long for this batch.', 'booking' ) );
		}

		$description = isset( $submitted_fields['description'] ) && is_scalar( $submitted_fields['description'] ) ? wp_kses_post( (string) $submitted_fields['description'] ) : '';
		if ( $this->get_text_length( $description ) > 2000 ) {
			return new WP_Error( 'wpbc_catalog_resource_create_description_length', __( 'The Booking Resource description is too long.', 'booking' ) );
		}
		$picture_url = isset( $submitted_fields['picture_url'] ) && is_scalar( $submitted_fields['picture_url'] ) ? sanitize_text_field( trim( (string) $submitted_fields['picture_url'] ) ) : '';
		if ( '' !== $picture_url && '' === esc_url_raw( wpbc_lang( $picture_url ) ) ) {
			return new WP_Error( 'wpbc_catalog_resource_create_picture_invalid', __( 'Select a valid image for the Booking Resources.', 'booking' ) );
		}
		if ( '' !== $picture_url && function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
			return new WP_Error( 'wpbc_catalog_resource_create_picture_demo', __( 'Changing the Booking Resource image is not allowed in demo versions.', 'booking' ) );
		}

		$creation_mode = isset( $submitted_fields['creation_mode'] ) && is_scalar( $submitted_fields['creation_mode'] ) ? sanitize_key( (string) $submitted_fields['creation_mode'] ) : 'independent';
		if ( ! in_array( $creation_mode, array( 'independent', 'children' ), true ) ) {
			return new WP_Error( 'wpbc_catalog_resource_create_mode_invalid', __( 'Choose a valid Booking Resource creation type.', 'booking' ) );
		}
		$parent_resource = null;
		$parent_id       = 0;
		if ( 'children' === $creation_mode ) {
			if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
				return new WP_Error( 'wpbc_catalog_resource_create_parent_unavailable', __( 'Child Booking Resources are not available in this version.', 'booking' ) );
			}
			$parent_id = isset( $submitted_fields['parent_id'] ) && is_scalar( $submitted_fields['parent_id'] ) ? absint( $submitted_fields['parent_id'] ) : 0;
			$parent_resource = $this->repository->get_resource( $parent_id );
			if ( is_wp_error( $parent_resource ) ) {
				return $parent_resource;
			}
			if ( ! is_array( $parent_resource ) || empty( $parent_resource['id'] ) || ! empty( $parent_resource['parent_id'] ) ) {
				return new WP_Error( 'wpbc_catalog_resource_create_parent_invalid', __( 'Select an available top-level parent resource.', 'booking' ) );
			}
		}

		$base_cost = '0';
		if ( is_array( $parent_resource ) ) {
			$base_cost = isset( $parent_resource['cost'] ) ? (string) $parent_resource['cost'] : '0';
		} elseif ( class_exists( 'wpdev_bk_biz_s' ) && isset( $submitted_fields['base_cost'] ) && is_scalar( $submitted_fields['base_cost'] ) ) {
			$base_cost = str_replace( ',', '.', trim( (string) $submitted_fields['base_cost'] ) );
			$base_cost = '' === $base_cost ? '0' : $base_cost;
			if ( ! is_numeric( $base_cost ) || ! is_finite( (float) $base_cost ) || (float) $base_cost < 0 ) {
				return new WP_Error( 'wpbc_catalog_resource_create_cost_invalid', __( 'Enter a valid non-negative base cost.', 'booking' ) );
			}
			$base_cost = (string) (float) $base_cost;
		}

		$priority = 0;
		if ( class_exists( 'wpdev_bk_biz_l' ) && isset( $submitted_fields['priority'] ) && is_scalar( $submitted_fields['priority'] ) ) {
			$priority_value = (string) $submitted_fields['priority'];
			if ( ! preg_match( '/^\d+$/', $priority_value ) ) {
				return new WP_Error( 'wpbc_catalog_resource_create_priority_invalid', __( 'Enter a valid non-negative starting priority.', 'booking' ) );
			}
			$priority = min( 2147483647 - $quantity, absint( $priority_value ) );
		}

		$owner_user_id = is_array( $parent_resource ) && isset( $parent_resource['owner_user_id'] ) ? absint( $parent_resource['owner_user_id'] ) : $this->get_current_owner_user_id();
		if ( ! is_array( $parent_resource ) && $this->schema->can_assign_owner() && isset( $submitted_fields['owner_user_id'] ) && is_scalar( $submitted_fields['owner_user_id'] ) ) {
			$owner_user_id = absint( $submitted_fields['owner_user_id'] );
			$allowed_ids   = array_map( 'absint', wp_list_pluck( $this->schema->get_owner_options( $this->get_current_owner_user_id() ), 'value' ) );
			if ( ! $owner_user_id || ! in_array( $owner_user_id, $allowed_ids, true ) ) {
				return new WP_Error( 'wpbc_catalog_resource_create_owner_invalid', __( 'Select an available Booking Calendar owner.', 'booking' ) );
			}
		}
		if ( class_exists( 'wpdev_bk_multiuser' ) && ! $owner_user_id ) {
			return new WP_Error( 'wpbc_catalog_resource_create_owner_required', __( 'A valid Booking Calendar owner is required.', 'booking' ) );
		}

		$default_form = is_array( $parent_resource ) && ! empty( $parent_resource['default_form'] ) ? sanitize_text_field( (string) $parent_resource['default_form'] ) : 'standard';
		if ( ! is_array( $parent_resource ) && class_exists( 'wpdev_bk_biz_m' ) && $this->schema->can_edit_default_form() && isset( $submitted_fields['default_form'] ) && is_scalar( $submitted_fields['default_form'] ) ) {
			$default_form  = sanitize_text_field( (string) $submitted_fields['default_form'] );
			$allowed_forms = wp_list_pluck( $this->schema->get_form_options( $owner_user_id, 'standard' ), 'value' );
			if ( ! in_array( $default_form, $allowed_forms, true ) ) {
				return new WP_Error( 'wpbc_catalog_resource_create_form_invalid', __( 'Select an available Booking Form.', 'booking' ) );
			}
		}

		return array(
			'title'         => $title,
			'description'   => $description,
			'picture_url'   => $picture_url,
			'quantity'      => $quantity,
			'creation_mode' => $creation_mode,
			'parent_id'     => $parent_id,
			'base_cost'     => $base_cost,
			'priority'      => $priority,
			'owner_user_id' => $owner_user_id,
			'default_form'  => $default_form,
		);
	}

	/**
	 * Remove only rows and options inserted by a failed request.
	 *
	 * @param array<int,int> $resource_ids Created Resource IDs.
	 *
	 * @return void
	 */
	private function rollback( $resource_ids ) {
		global $wpdb;

		foreach ( array_map( 'absint', $resource_ids ) as $resource_id ) {
			if ( ! $resource_id ) {
				continue;
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Compensates only rows inserted by this request.
			$wpdb->delete( $wpdb->prefix . 'bookingtypes', array( 'booking_type_id' => $resource_id ), array( '%d' ) );
			$this->content_store->delete( $resource_id );
		}
		if ( function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_booking_resource_cache' );
		}
	}

	/**
	 * Return the current MultiUser owner context.
	 *
	 * @return int Owner ID or zero outside MultiUser.
	 */
	private function get_current_owner_user_id() {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
			return 0;
		}
		$current_user = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();

		return is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
	}

	/**
	 * Return text length without requiring the multibyte extension.
	 *
	 * @param string $text Text to measure.
	 *
	 * @return int Character or byte length.
	 */
	private function get_text_length( $text ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( (string) $text ) : strlen( (string) $text );
	}
}
