<?php
/**
 * Independent Booking Resource update service for the catalog inspector.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and update one authorized Resource without legacy editor services.
 */
final class WPBC_Catalog_Booking_Resource_Updater {

	/**
	 * Independent Resource read repository.
	 *
	 * @var WPBC_Catalog_Booking_Resources_Repository
	 */
	private $repository;

	/**
	 * Inspector schema used only for current allow-lists.
	 *
	 * @var WPBC_Catalog_Booking_Resource_Inspector_Schema
	 */
	private $schema;

	/**
	 * Cross-edition content store.
	 *
	 * @var WPBC_Catalog_Booking_Resource_Content_Store
	 */
	private $content_store;

	/**
	 * Independent availability storage adapter.
	 *
	 * @var WPBC_Catalog_Booking_Resource_Availability
	 */
	private $availability;

	/**
	 * Initialize independent collaborators.
	 *
	 * @param WPBC_Catalog_Booking_Resources_Repository|null       $repository    Optional read repository.
	 * @param WPBC_Catalog_Booking_Resource_Inspector_Schema|null $schema        Optional schema service.
	 * @param WPBC_Catalog_Booking_Resource_Content_Store|null       $content_store Optional content store.
	 * @param WPBC_Catalog_Booking_Resource_Availability|null        $availability  Optional availability adapter.
	 */
	public function __construct( $repository = null, $schema = null, $content_store = null, $availability = null ) {
		$this->repository    = $repository instanceof WPBC_Catalog_Booking_Resources_Repository ? $repository : new WPBC_Catalog_Booking_Resources_Repository();
		$this->schema        = $schema instanceof WPBC_Catalog_Booking_Resource_Inspector_Schema ? $schema : new WPBC_Catalog_Booking_Resource_Inspector_Schema();
		$this->content_store = $content_store instanceof WPBC_Catalog_Booking_Resource_Content_Store ? $content_store : new WPBC_Catalog_Booking_Resource_Content_Store();
		$this->availability  = $availability instanceof WPBC_Catalog_Booking_Resource_Availability ? $availability : new WPBC_Catalog_Booking_Resource_Availability();
	}

	/**
	 * Validate and persist one complete inspector submission.
	 *
	 * @param int   $resource_id     Requested Booking Resource ID.
	 * @param mixed $submitted_fields Untrusted decoded field map.
	 *
	 * @return array<string,mixed>|WP_Error Refreshed Resource or a safe error.
	 */
	public function update( $resource_id, $submitted_fields ) {
		$resource = $this->repository->get_resource( absint( $resource_id ) );
		if ( is_wp_error( $resource ) ) {
			return $resource;
		}
		if ( null === $resource ) {
			return new WP_Error( 'wpbc_catalog_resource_update_not_found', __( 'The Booking Resource was not found or is not available to this account.', 'booking' ) );
		}
		if ( ! is_array( $submitted_fields ) ) {
			return new WP_Error( 'wpbc_catalog_resource_update_invalid', __( 'The Booking Resource update request is invalid.', 'booking' ) );
		}
		$publishing_shortcodes            = $this->repository->get_publishing_shortcodes( array( absint( $resource['id'] ) ) );
		$resource['publishing_shortcode'] = isset( $publishing_shortcodes[ absint( $resource['id'] ) ] )
			? $publishing_shortcodes[ absint( $resource['id'] ) ]
			: '[booking resource_id=' . absint( $resource['id'] ) . ']';

		$validated = $this->validate_fields( $resource, $submitted_fields );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$settings_result = $this->save_settings( $resource, $validated );
		if ( is_wp_error( $settings_result ) ) {
			return $settings_result;
		}
		$content_result = $this->content_store->save(
			absint( $resource['id'] ),
			$validated['title'],
			$validated['description'],
			$validated['picture_url']
		);
		if ( is_wp_error( $content_result ) ) {
			$this->restore_settings( $resource, $settings_result );

			return $content_result;
		}

		if ( function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_booking_resource_cache' );
		}
		do_action( 'wpbc_catalog_booking_resource_updated', absint( $resource['id'] ), $validated );

		$updated_resource = $this->repository->get_resource( absint( $resource['id'] ) );

		return is_array( $updated_resource ) ? $updated_resource : $resource;
	}

	/**
	 * Validate submitted values against edition and account allow-lists.
	 *
	 * @param array $resource         Authorized current Resource.
	 * @param array $submitted_fields Untrusted submitted fields.
	 *
	 * @return array<string,mixed>|WP_Error Validated complete values or error.
	 */
	private function validate_fields( $resource, $submitted_fields ) {
		$title = isset( $submitted_fields['title'] ) && is_scalar( $submitted_fields['title'] ) ? sanitize_text_field( (string) $submitted_fields['title'] ) : '';
		if ( '' === $title ) {
			return new WP_Error( 'wpbc_catalog_resource_title_required', __( 'Enter a title for this Booking Resource.', 'booking' ) );
		}
		if ( $this->get_text_length( $title ) > 200 ) {
			return new WP_Error( 'wpbc_catalog_resource_title_length', __( 'The Booking Resource title is too long.', 'booking' ) );
		}

		$description = isset( $submitted_fields['description'] ) && is_scalar( $submitted_fields['description'] ) ? wp_kses_post( (string) $submitted_fields['description'] ) : '';
		if ( $this->get_text_length( $description ) > 2000 ) {
			return new WP_Error( 'wpbc_catalog_resource_description_length', __( 'The Booking Resource description is too long.', 'booking' ) );
		}
		$picture_url = isset( $submitted_fields['picture_url'] ) && is_scalar( $submitted_fields['picture_url'] ) ? sanitize_text_field( trim( (string) $submitted_fields['picture_url'] ) ) : '';
		if ( '' !== $picture_url && '' === esc_url_raw( wpbc_lang( $picture_url ) ) ) {
			return new WP_Error( 'wpbc_catalog_resource_picture_invalid', __( 'Select a valid image for this Booking Resource.', 'booking' ) );
		}
		$current_picture_url = isset( $resource['picture_url'] ) ? esc_url_raw( wpbc_lang( (string) $resource['picture_url'] ) ) : '';
		if (
			WPBC_Catalog_Booking_Resource_Demo_Policy::is_demo()
			&& esc_url_raw( wpbc_lang( $picture_url ) ) !== $current_picture_url
		) {
			return new WP_Error( 'wpbc_catalog_resource_picture_demo', __( 'Changing the Booking Resource image is not allowed in demo versions.', 'booking' ) );
		}

		$validated = array(
			'title'          => $title,
			'description'    => $description,
			'picture_url'    => $picture_url,
			'booking_shortcode' => isset( $resource['publishing_shortcode'] ) ? (string) $resource['publishing_shortcode'] : '[booking resource_id=' . absint( $resource['id'] ) . ']',
			'default_form'   => isset( $resource['default_form'] ) ? (string) $resource['default_form'] : 'standard',
			'base_cost'      => isset( $resource['cost'] ) ? (string) $resource['cost'] : '0',
			'priority'       => isset( $resource['priority'] ) ? absint( $resource['priority'] ) : 0,
			'parent_id'      => isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0,
			'owner_user_id'  => isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0,
		);

		if ( class_exists( 'wpdev_bk_personal' ) && isset( $submitted_fields['booking_shortcode'] ) && is_scalar( $submitted_fields['booking_shortcode'] ) ) {
			$shortcode = trim( wp_strip_all_tags( (string) $submitted_fields['booking_shortcode'] ) );
			if ( ! $this->shortcode_targets_resource( $shortcode, absint( $resource['id'] ) ) ) {
				return new WP_Error( 'wpbc_catalog_resource_shortcode_invalid', __( 'Use a Booking Calendar shortcode that targets this Booking Resource.', 'booking' ) );
			}
			$validated['booking_shortcode'] = $shortcode;
		}

		if ( class_exists( 'wpdev_bk_biz_m' ) && $this->schema->can_edit_default_form() && isset( $submitted_fields['default_form'] ) && is_scalar( $submitted_fields['default_form'] ) ) {
			$default_form  = sanitize_text_field( (string) $submitted_fields['default_form'] );
			$allowed_forms = wp_list_pluck( $this->schema->get_form_options( $validated['owner_user_id'], $validated['default_form'] ), 'value' );
			if ( ! in_array( $default_form, $allowed_forms, true ) ) {
				return new WP_Error( 'wpbc_catalog_resource_form_invalid', __( 'Select an available Booking Form.', 'booking' ) );
			}
			$validated['default_form'] = $default_form;
		}

		if ( class_exists( 'wpdev_bk_biz_s' ) && isset( $submitted_fields['base_cost'] ) && is_scalar( $submitted_fields['base_cost'] ) ) {
			$base_cost = str_replace( ',', '.', trim( (string) $submitted_fields['base_cost'] ) );
			if ( '' === $base_cost ) {
				$base_cost = '0';
			}
			if ( ! is_numeric( $base_cost ) || ! is_finite( (float) $base_cost ) || (float) $base_cost < 0 ) {
				return new WP_Error( 'wpbc_catalog_resource_cost_invalid', __( 'Enter a valid non-negative base cost.', 'booking' ) );
			}
			$validated['base_cost'] = (string) (float) $base_cost;
		}

		if ( class_exists( 'wpdev_bk_biz_l' ) && isset( $submitted_fields['priority'] ) && is_scalar( $submitted_fields['priority'] ) ) {
			$priority = (string) $submitted_fields['priority'];
			if ( ! preg_match( '/^\d+$/', $priority ) ) {
				return new WP_Error( 'wpbc_catalog_resource_priority_invalid', __( 'Enter a valid non-negative priority.', 'booking' ) );
			}
			$validated['priority'] = min( 2147483647, absint( $priority ) );
		}

		if ( class_exists( 'wpdev_bk_biz_l' ) && empty( $resource['child_count'] ) && isset( $submitted_fields['parent_id'] ) && is_scalar( $submitted_fields['parent_id'] ) ) {
			$parent_value = (string) $submitted_fields['parent_id'];
			if ( ! preg_match( '/^\d+$/', $parent_value ) ) {
				return new WP_Error( 'wpbc_catalog_resource_parent_invalid', __( 'Select an available top-level parent resource.', 'booking' ) );
			}
			$parent_id       = absint( $parent_value );
			$allowed_parents = array_map( 'absint', wp_list_pluck( $this->repository->get_parent_options( $resource ), 'value' ) );
			if ( ! in_array( $parent_id, $allowed_parents, true ) ) {
				return new WP_Error( 'wpbc_catalog_resource_parent_invalid', __( 'Select an available top-level parent resource.', 'booking' ) );
			}
			$validated['parent_id'] = $parent_id;
		}

		if ( $this->schema->can_assign_owner() && isset( $submitted_fields['owner_user_id'] ) && is_scalar( $submitted_fields['owner_user_id'] ) ) {
			$owner_id      = absint( $submitted_fields['owner_user_id'] );
			$allowed_owner = array_map( 'absint', wp_list_pluck( $this->schema->get_owner_options( $validated['owner_user_id'] ), 'value' ) );
			if ( ! $owner_id || ! in_array( $owner_id, $allowed_owner, true ) ) {
				return new WP_Error( 'wpbc_catalog_resource_owner_invalid', __( 'Select an available Booking Calendar owner.', 'booking' ) );
			}
			if ( $owner_id !== $validated['owner_user_id'] ) {
				$validated['default_form'] = 'standard';
			}
			$validated['owner_user_id'] = $owner_id;
		}

		$availability_fields = $this->availability->validate_fields( $resource, $submitted_fields );
		if ( is_wp_error( $availability_fields ) ) {
			return $availability_fields;
		}
		$validated = array_merge( $validated, $availability_fields );

		return $validated;
	}

	/**
	 * Save edition-supported table columns and shortcode metadata.
	 *
	 * @param array $resource  Current Resource snapshot.
	 * @param array $validated Validated complete values.
	 *
	 * @return array<string,mixed>|WP_Error Rollback snapshot or error.
	 */
	private function save_settings( $resource, $validated ) {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return array();
		}

		global $wpdb;

		$availability_rollback = $this->availability->save_fields( $resource, array_intersect_key( $validated, array( 'availability_mode' => true, 'searchable_status' => true ) ) );
		if ( is_wp_error( $availability_rollback ) ) {
			return $availability_rollback;
		}

		$update_values  = array();
		$update_formats = array();
		$rollback       = array( 'availability' => $availability_rollback );
		if ( class_exists( 'wpdev_bk_biz_s' ) ) {
			$update_values['cost'] = $validated['base_cost'];
			$update_formats[]      = '%s';
			$rollback['cost']      = isset( $resource['cost'] ) ? (string) $resource['cost'] : '0';
		}
		if ( class_exists( 'wpdev_bk_biz_m' ) ) {
			$update_values['default_form'] = $validated['default_form'];
			$update_formats[]              = '%s';
			$rollback['default_form']      = isset( $resource['default_form'] ) ? (string) $resource['default_form'] : 'standard';
		}
		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$update_values['prioritet'] = $validated['priority'];
			$update_formats[]           = '%d';
			$rollback['prioritet']      = isset( $resource['priority'] ) ? absint( $resource['priority'] ) : 0;
			$update_values['parent']    = $validated['parent_id'];
			$update_formats[]           = '%d';
			$rollback['parent']         = isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0;
		}
		if ( class_exists( 'wpdev_bk_multiuser' ) && $this->schema->can_assign_owner() ) {
			$update_values['users'] = $validated['owner_user_id'];
			$update_formats[]       = '%d';
			$rollback['users']      = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		}

		if ( ! empty( $update_values ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Explicit canonical Resource mutation.
			$updated = $wpdb->update( $wpdb->prefix . 'bookingtypes', $update_values, array( 'booking_type_id' => absint( $resource['id'] ) ), $update_formats, array( '%d' ) );
			if ( false === $updated ) {
				$this->availability->restore_fields( absint( $resource['id'] ), $availability_rollback );

				return new WP_Error( 'wpbc_catalog_resource_settings_not_saved', __( 'The Booking Resource settings could not be saved.', 'booking' ) );
			}
		}

		$rollback['shortcode_default'] = isset( $resource['publishing_shortcode'] ) ? (string) $resource['publishing_shortcode'] : '';
		$shortcode_saved = $this->save_shortcode( absint( $resource['id'] ), $validated['booking_shortcode'] );
		if ( is_wp_error( $shortcode_saved ) ) {
			$this->restore_settings( $resource, $rollback );

			return $shortcode_saved;
		}

		return $rollback;
	}

	/**
	 * Restore settings after a later content-storage failure.
	 *
	 * @param array $resource Current Resource snapshot.
	 * @param array $rollback Previously stored settings.
	 *
	 * @return void
	 */
	private function restore_settings( $resource, $rollback ) {
		if ( ! class_exists( 'wpdev_bk_personal' ) || ! is_array( $rollback ) ) {
			return;
		}

		global $wpdb;

		$table_values = array_intersect_key( $rollback, array( 'cost' => true, 'default_form' => true, 'parent' => true, 'prioritet' => true, 'users' => true ) );
		if ( ! empty( $table_values ) ) {
			$formats = array();
			foreach ( array_keys( $table_values ) as $column_name ) {
				$formats[] = in_array( $column_name, array( 'parent', 'prioritet', 'users' ), true ) ? '%d' : '%s';
			}
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Compensates only values changed by this request.
			$wpdb->update( $wpdb->prefix . 'bookingtypes', $table_values, array( 'booking_type_id' => absint( $resource['id'] ) ), $formats, array( '%d' ) );
		}
		if ( array_key_exists( 'shortcode_default', $rollback ) ) {
			$this->save_shortcode( absint( $resource['id'] ), (string) $rollback['shortcode_default'] );
		}
		if ( isset( $rollback['availability'] ) ) {
			$this->availability->restore_fields( absint( $resource['id'] ), $rollback['availability'] );
		}
	}

	/**
	 * Save the canonical shortcode_default metadata value.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $shortcode   Validated shortcode.
	 *
	 * @return true|WP_Error True or safe storage error.
	 */
	private function save_shortcode( $resource_id, $shortcode ) {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact canonical metadata lookup.
		$meta_id = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT meta_id FROM {$wpdb->prefix}booking_types_meta WHERE type_id = %d AND meta_key = %s ORDER BY meta_id ASC LIMIT 1",
				absint( $resource_id ),
				'shortcode_default'
			)
		);
		$stored_shortcode = maybe_serialize( $shortcode );
		if ( $meta_id ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact canonical metadata update.
			$saved = $wpdb->update( $wpdb->prefix . 'booking_types_meta', array( 'meta_value' => $stored_shortcode ), array( 'meta_id' => absint( $meta_id ) ), array( '%s' ), array( '%d' ) );
		} else {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Exact canonical metadata insert.
			$saved = $wpdb->insert( $wpdb->prefix . 'booking_types_meta', array( 'type_id' => absint( $resource_id ), 'meta_key' => 'shortcode_default', 'meta_value' => $stored_shortcode ), array( '%d', '%s', '%s' ) );
		}

		return false === $saved ? new WP_Error( 'wpbc_catalog_resource_shortcode_not_saved', __( 'The Booking Resource shortcode could not be saved.', 'booking' ) ) : true;
	}

	/**
	 * Confirm that a submitted Booking shortcode targets exactly one Resource.
	 *
	 * @param string $shortcode   Submitted shortcode.
	 * @param int    $resource_id Expected Resource ID.
	 *
	 * @return bool True for an exact Booking shortcode target.
	 */
	private function shortcode_targets_resource( $shortcode, $resource_id ) {
		$pattern = get_shortcode_regex( array( 'booking' ) );
		if ( ! preg_match( '/^\s*' . $pattern . '\s*$/s', $shortcode, $match ) ) {
			return false;
		}
		$attributes = shortcode_parse_atts( $match[3] );
		$target_id  = is_array( $attributes ) && isset( $attributes['resource_id'] )
			? absint( $attributes['resource_id'] )
			: ( is_array( $attributes ) && isset( $attributes['type'] ) ? absint( $attributes['type'] ) : 0 );

		return absint( $resource_id ) === $target_id;
	}

	/**
	 * Return a text length without requiring the multibyte extension.
	 *
	 * @param string $text Text to measure.
	 *
	 * @return int Character or byte length.
	 */
	private function get_text_length( $text ) {
		return function_exists( 'mb_strlen' ) ? mb_strlen( (string) $text ) : strlen( (string) $text );
	}
}
