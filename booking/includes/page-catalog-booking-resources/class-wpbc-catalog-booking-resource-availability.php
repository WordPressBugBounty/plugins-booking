<?php
/**
 * Independent availability adapter for the template-driven Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read, validate, and save availability fields without legacy catalog services.
 *
 * The adapter owns only the two settings that are safe to edit in the Resource
 * inspector. It preserves season filters and every unrelated Search
 * Availability option when updating their canonical storage records.
 */
final class WPBC_Catalog_Booking_Resource_Availability {

	/**
	 * Return presentation definitions for the Availability and search group.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<int,array<string,mixed>> Inspector field definitions.
	 */
	public function get_field_definitions( $resource ) {
		$resource_id          = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
		$owner_user_id        = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$resource_type        = isset( $resource['resource_type'] ) ? sanitize_key( (string) $resource['resource_type'] ) : 'single';
		$can_manage_days      = current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_availability' ) );
		$can_manage_search    = current_user_can( wpbc_catalog_booking_resources_get_manage_capability() );
		$previous_active_user = $this->set_owner_environment( $resource_id );
		$availability         = $this->get_season_availability( $resource_id );
		$fields               = array();

		if ( class_exists( 'wpdev_bk_biz_l' ) && function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
			$is_child   = 'child' === $resource_type;
			$searchable = $this->get_searchable_status( $resource_id, $is_child );
			$search_url = $this->get_searchable_resources_url( $resource_id );
			$fields[]   = array(
				'key'           => 'searchable_status',
				'label'         => __( 'Search Availability results', 'booking' ),
				'type'          => $is_child || ! $can_manage_search ? 'readonly' : 'select',
				'value'         => $searchable,
				'display_value' => 'on' === $searchable ? __( 'Searchable', 'booking' ) : __( 'Hidden from search results', 'booking' ),
				'editable'      => ! $is_child && $can_manage_search,
				'options'       => array(
					array( 'value' => 'on', 'label' => __( 'Searchable', 'booking' ) ),
					array( 'value' => 'off', 'label' => __( 'Hidden from search results', 'booking' ) ),
				),
				'help'          => $is_child
					? __( 'Child resources stay hidden because Search Availability returns their top-level parent resource.', 'booking' )
					: __( 'Choose whether this Booking Resource can appear in Search Availability results.', 'booking' ),
				'link_url'      => $search_url,
				'link_label'    => $search_url ? __( 'Manage search presentation and filters', 'booking' ) : '',
			);
		} else {
			$fields[] = array(
				'key'           => 'searchable_status',
				'label'         => __( 'Search Availability results', 'booking' ),
				'type'          => 'readonly',
				'value'         => '',
				'display_value' => __( 'Not available in this version', 'booking' ),
				'editable'      => false,
				'help'          => __( 'Control whether this Booking Resource appears in Search Availability results.', 'booking' ),
			);
		}

		if ( class_exists( 'wpdev_bk_biz_m' ) && function_exists( 'wpbc_get_resource_meta' ) && function_exists( 'wpbc_save_resource_meta' ) ) {
			$availability_mode = 'Off' === $availability['general'] ? 'unavailable' : 'available';
			$season_url        = $can_manage_days ? $this->get_season_availability_url( $resource_id ) : '';
			$active_rules      = $this->count_active_season_rules( $availability );
			$fields[]          = array(
				'key'           => 'availability_mode',
				'label'         => __( 'Default day availability', 'booking' ),
				'type'          => $can_manage_days ? 'select' : 'readonly',
				'value'         => $availability_mode,
				'display_value' => 'available' === $availability_mode ? __( 'Available', 'booking' ) : __( 'Unavailable', 'booking' ),
				'editable'      => $can_manage_days,
				'options'       => array(
					array( 'value' => 'available', 'label' => __( 'Available', 'booking' ) ),
					array( 'value' => 'unavailable', 'label' => __( 'Unavailable', 'booking' ) ),
				),
				'help'          => __( 'Active season rules invert this default only on the dates matched by those rules.', 'booking' ),
				'link_url'      => $season_url,
				'link_label'    => $season_url ? __( 'Manage season availability', 'booking' ) : '',
			);
			$fields[]          = array(
				'key'           => 'active_season_rules',
				'label'         => __( 'Active season rules', 'booking' ),
				'type'          => 'readonly',
				'value'         => (string) $active_rules,
				/* translators: %s: Number of active season availability rules. */
				'display_value' => sprintf( _n( '%s rule', '%s rules', $active_rules, 'booking' ), number_format_i18n( $active_rules ) ),
				'editable'      => false,
				'link_url'      => $season_url,
				'link_label'    => $season_url ? __( 'Review season rules', 'booking' ) : '',
			);
		} else {
			$fields[] = array(
				'key'           => 'availability_mode',
				'label'         => __( 'Season availability', 'booking' ),
				'type'          => 'readonly',
				'value'         => '',
				'display_value' => __( 'Not available in this version', 'booking' ),
				'editable'      => false,
				'help'          => __( 'Set a default availability state and apply seasonal availability rules.', 'booking' ),
			);
		}

		$manual_url = $can_manage_days ? $this->get_manual_availability_url( $resource_id ) : '';
		$fields[]   = array(
			'key'           => 'manual_date_availability',
			'label'         => __( 'Manual date availability', 'booking' ),
			'type'          => 'readonly',
			'value'         => __( 'Per-date overrides', 'booking' ),
			'display_value' => __( 'Per-date overrides', 'booking' ),
			'editable'      => false,
			'help'          => __( 'Use the availability calendar to mark individual dates available or unavailable.', 'booking' ),
			'link_url'      => $manual_url,
			'link_label'    => $manual_url ? __( 'Manage dates', 'booking' ) : '',
		);

		$global_url = $can_manage_days && $this->can_edit_owner_settings( $owner_user_id ) && function_exists( 'wpbc_get_general_availability_url' )
			? esc_url_raw( wpbc_get_general_availability_url( true, false ) )
			: '';
		$fields[]   = array(
			'key'           => 'booking_window_start',
			'label'         => __( 'Earliest bookable day', 'booking' ),
			'type'          => 'readonly',
			'value'         => sanitize_text_field( (string) get_bk_option( 'booking_unavailable_days_num_from_today' ) ),
			'display_value' => $this->format_booking_window_start(),
			'editable'      => false,
			'help'          => __( 'This is a global Booking Calendar rule shared by every Booking Resource.', 'booking' ),
			'link_url'      => $global_url,
			'link_label'    => $global_url ? __( 'Change global booking window', 'booking' ) : '',
		);
		$fields[]   = array(
			'key'           => 'booking_window_horizon',
			'label'         => __( 'Booking horizon', 'booking' ),
			'type'          => 'readonly',
			'value'         => class_exists( 'wpdev_bk_biz_m' ) ? (string) get_bk_option( 'booking_available_days_num_from_today' ) : '',
			'display_value' => class_exists( 'wpdev_bk_biz_m' ) ? $this->format_booking_window_horizon() : __( 'Not available in this version', 'booking' ),
			'editable'      => false,
			'help'          => __( 'This is a global Booking Calendar rule shared by every Booking Resource.', 'booking' ),
			'link_url'      => class_exists( 'wpdev_bk_biz_m' ) ? $global_url : '',
			'link_label'    => class_exists( 'wpdev_bk_biz_m' ) && $global_url ? __( 'Change global booking window', 'booking' ) : '',
		);

		$this->restore_owner_environment( $previous_active_user, $resource_id );

		return $fields;
	}

	/**
	 * Validate submitted availability values supported by the current edition.
	 *
	 * @param array<string,mixed> $resource         Authorized Resource record.
	 * @param array<string,mixed> $submitted_fields Untrusted inspector values.
	 *
	 * @return array<string,string>|WP_Error Validated changes or safe error.
	 */
	public function validate_fields( $resource, $submitted_fields ) {
		$validated = array();
		if ( array_key_exists( 'availability_mode', $submitted_fields ) && is_scalar( $submitted_fields['availability_mode'] ) ) {
			if ( ! class_exists( 'wpdev_bk_biz_m' ) || ! current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_availability' ) ) ) {
				return new WP_Error( 'wpbc_catalog_resource_availability_forbidden', __( 'You cannot change availability for this Booking Resource.', 'booking' ) );
			}
			$availability_mode = sanitize_key( (string) $submitted_fields['availability_mode'] );
			if ( ! in_array( $availability_mode, array( 'available', 'unavailable' ), true ) ) {
				return new WP_Error( 'wpbc_catalog_resource_availability_invalid', __( 'Select a valid default availability state.', 'booking' ) );
			}
			$validated['availability_mode'] = $availability_mode;
		}

		if ( array_key_exists( 'searchable_status', $submitted_fields ) && is_scalar( $submitted_fields['searchable_status'] ) ) {
			$is_child = isset( $resource['resource_type'] ) && 'child' === (string) $resource['resource_type'];
			if ( ! class_exists( 'wpdev_bk_biz_l' ) || $is_child || ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
				return new WP_Error( 'wpbc_catalog_resource_searchability_forbidden', __( 'You cannot change Search Availability visibility for this Booking Resource.', 'booking' ) );
			}
			$searchable_status = sanitize_key( (string) $submitted_fields['searchable_status'] );
			if ( ! in_array( $searchable_status, array( 'on', 'off' ), true ) ) {
				return new WP_Error( 'wpbc_catalog_resource_searchability_invalid', __( 'Select a valid Search Availability visibility.', 'booking' ) );
			}
			$validated['searchable_status'] = $searchable_status;
		}

		return $validated;
	}

	/**
	 * Save validated availability fields and return an exact rollback snapshot.
	 *
	 * @param array<string,mixed>  $resource         Authorized Resource record.
	 * @param array<string,string> $validated_fields Validated availability values.
	 *
	 * @return array<string,mixed>|WP_Error Rollback snapshot or safe error.
	 */
	public function save_fields( $resource, $validated_fields ) {
		$resource_id = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
		if ( ! $resource_id || empty( $validated_fields ) ) {
			return array();
		}

		$previous_active_user = $this->set_owner_environment( $resource_id );
		$rollback             = array();
		if ( array_key_exists( 'availability_mode', $validated_fields ) ) {
			$rollback['availability'] = $this->get_season_availability( $resource_id );
			$availability             = $rollback['availability'];
			$availability['general']  = 'available' === $validated_fields['availability_mode'] ? 'On' : 'Off';
			if ( ! function_exists( 'wpbc_save_resource_meta' ) || ! wpbc_save_resource_meta( $resource_id, 'availability', $availability ) ) {
				$this->restore_owner_environment( $previous_active_user, $resource_id );

				return new WP_Error( 'wpbc_catalog_resource_availability_not_saved', __( 'The Booking Resource availability could not be saved.', 'booking' ) );
			}
		}

		if ( array_key_exists( 'searchable_status', $validated_fields ) ) {
			$rollback['search_options'] = function_exists( 'wpbc_searchable_resources__get_all_options' )
				? (array) wpbc_searchable_resources__get_all_options()
				: array();
			$saved = $this->save_searchable_status( $resource_id, $validated_fields['searchable_status'] );
			if ( is_wp_error( $saved ) ) {
				$this->restore_fields_in_owner_context( $resource_id, $rollback );
				$this->restore_owner_environment( $previous_active_user, $resource_id );

				return $saved;
			}
		}

		$this->restore_owner_environment( $previous_active_user, $resource_id );
		if ( array_key_exists( 'availability_mode', $validated_fields ) && function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_seasonfilters_cache' );
		}
		do_action( 'wpbc_catalog_booking_resource_availability_saved', $resource_id, $validated_fields );

		return $rollback;
	}

	/**
	 * Restore a snapshot after a later catalog mutation fails.
	 *
	 * @param int                 $resource_id Booking Resource ID.
	 * @param array<string,mixed> $rollback    Snapshot returned by save_fields().
	 *
	 * @return void
	 */
	public function restore_fields( $resource_id, $rollback ) {
		if ( ! $resource_id || empty( $rollback ) ) {
			return;
		}
		$previous_active_user = $this->set_owner_environment( $resource_id );
		$this->restore_fields_in_owner_context( $resource_id, $rollback );
		$this->restore_owner_environment( $previous_active_user, $resource_id );
		if ( isset( $rollback['availability'] ) && function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_seasonfilters_cache' );
		}
	}

	/**
	 * Restore canonical values while the correct owner context is active.
	 *
	 * @param int                 $resource_id Booking Resource ID.
	 * @param array<string,mixed> $rollback    Rollback snapshot.
	 *
	 * @return void
	 */
	private function restore_fields_in_owner_context( $resource_id, $rollback ) {
		if ( isset( $rollback['availability'] ) && function_exists( 'wpbc_save_resource_meta' ) ) {
			wpbc_save_resource_meta( $resource_id, 'availability', $rollback['availability'] );
		}
		if ( isset( $rollback['search_options'] ) && function_exists( 'wpbc_searchable_resources__save_all_options' ) ) {
			wpbc_searchable_resources__save_all_options( $rollback['search_options'] );
		}
	}

	/**
	 * Read canonical season availability while preserving every filter entry.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return array{general:string,filter:array} Normalized availability record.
	 */
	private function get_season_availability( $resource_id ) {
		$availability = array( 'general' => 'On', 'filter' => array() );
		if ( ! $resource_id || ! function_exists( 'wpbc_get_resource_meta' ) ) {
			return $availability;
		}
		$records = wpbc_get_resource_meta( $resource_id, 'availability' );
		if ( empty( $records[0]->value ) ) {
			return $availability;
		}
		$stored = maybe_unserialize( $records[0]->value );
		if ( is_array( $stored ) ) {
			$availability['general'] = isset( $stored['general'] ) && 'Off' === $stored['general'] ? 'Off' : 'On';
			$availability['filter']  = isset( $stored['filter'] ) && is_array( $stored['filter'] ) ? $stored['filter'] : array();
		}

		return $availability;
	}

	/**
	 * Count enabled season rules.
	 *
	 * @param array<string,mixed> $availability Normalized availability record.
	 *
	 * @return int Enabled rule count.
	 */
	private function count_active_season_rules( $availability ) {
		$rule_count = 0;
		foreach ( isset( $availability['filter'] ) ? (array) $availability['filter'] : array() as $filter_state ) {
			if ( 'On' === $filter_state ) {
				++$rule_count;
			}
		}

		return $rule_count;
	}

	/**
	 * Return whether one top-level Resource appears in Search Availability.
	 *
	 * @param int  $resource_id Booking Resource ID.
	 * @param bool $is_child    Whether hierarchy forces the Resource hidden.
	 *
	 * @return string `on` or `off`.
	 */
	private function get_searchable_status( $resource_id, $is_child = false ) {
		if ( $is_child || ! function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
			return 'off';
		}
		$all_options = (array) wpbc_searchable_resources__get_all_options();

		return isset( $all_options[ $resource_id ]['is_searchable'] ) && 'On' === $all_options[ $resource_id ]['is_searchable'] ? 'on' : 'off';
	}

	/**
	 * Save only one Resource's Search Availability visibility.
	 *
	 * @param int    $resource_id       Booking Resource ID.
	 * @param string $searchable_status Canonical `on` or `off` value.
	 *
	 * @return true|WP_Error True or a verified storage error.
	 */
	private function save_searchable_status( $resource_id, $searchable_status ) {
		if ( ! function_exists( 'wpbc_searchable_resources__get_all_options' ) || ! function_exists( 'wpbc_searchable_resources__save_all_options' ) ) {
			return new WP_Error( 'wpbc_catalog_resource_searchability_unavailable', __( 'Search Availability settings are unavailable.', 'booking' ) );
		}
		$all_options = (array) wpbc_searchable_resources__get_all_options();
		if ( ! isset( $all_options[ $resource_id ] ) || ! is_array( $all_options[ $resource_id ] ) ) {
			$all_options[ $resource_id ] = array();
		}
		$all_options[ $resource_id ]['is_searchable'] = 'on' === $searchable_status ? 'On' : 'Off';
		wpbc_searchable_resources__save_all_options( $all_options );

		return $searchable_status === $this->get_searchable_status( $resource_id )
			? true
			: new WP_Error( 'wpbc_catalog_resource_searchability_not_saved', __( 'Search Availability visibility could not be saved.', 'booking' ) );
	}

	/**
	 * Build a direct manual-date availability URL.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return string Authorized URL or an empty string.
	 */
	private function get_manual_availability_url( $resource_id ) {
		return function_exists( 'wpbc_get_availability_url' )
			? esc_url_raw( add_query_arg( 'resource_id', absint( $resource_id ), wpbc_get_availability_url( true, false ) ) )
			: '';
	}

	/**
	 * Build a direct season-availability URL.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return string Authorized URL or an empty string.
	 */
	private function get_season_availability_url( $resource_id ) {
		return function_exists( 'wpbc_get_availability_url' )
			? esc_url_raw( add_query_arg( array( 'tab' => 'season_availability', 'edit_resource_id' => absint( $resource_id ) ), wpbc_get_availability_url( true, false ) ) )
			: '';
	}

	/**
	 * Build a direct Searchable Resources URL.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return string Authorized URL or an empty string.
	 */
	private function get_searchable_resources_url( $resource_id ) {
		return function_exists( 'wpbc_get_resources_url' )
			? esc_url_raw( add_query_arg( array( 'tab' => 'searchable_resources', 'wh_resource_id' => absint( $resource_id ) ), wpbc_get_resources_url( true, false ) ) )
			: '';
	}

	/**
	 * Format the earliest globally bookable day.
	 *
	 * @return string Human-readable booking-window start.
	 */
	private function format_booking_window_start() {
		$stored_start = sanitize_text_field( (string) get_bk_option( 'booking_unavailable_days_num_from_today' ) );
		if ( '' === $stored_start || '0' === $stored_start ) {
			return __( 'Today', 'booking' );
		}
		if ( function_exists( 'wpbc_availability_general__get_unavailable_from_today_options' ) ) {
			$options = wpbc_availability_general__get_unavailable_from_today_options();
			if ( isset( $options[ $stored_start ] ) ) {
				return wp_strip_all_tags( (string) $options[ $stored_start ] ) . ' ' . __( 'from now', 'booking' );
			}
		}
		if ( preg_match( '/^(\d+)m$/', $stored_start, $matches ) ) {
			$minutes = absint( $matches[1] );

			return sprintf( _n( '%s minute from now', '%s minutes from now', $minutes, 'booking' ), number_format_i18n( $minutes ) );
		}
		$days = absint( $stored_start );

		return sprintf( _n( '%s day from today', '%s days from today', $days, 'booking' ), number_format_i18n( $days ) );
	}

	/**
	 * Format the globally configured booking horizon.
	 *
	 * @return string Human-readable booking horizon.
	 */
	private function format_booking_window_horizon() {
		$stored_horizon = get_bk_option( 'booking_available_days_num_from_today' );
		if ( '' === (string) $stored_horizon || 0 === absint( $stored_horizon ) ) {
			return __( 'No day limit', 'booking' );
		}
		$days = absint( $stored_horizon );

		return sprintf( _n( '%s day from today', '%s days from today', $days, 'booking' ), number_format_i18n( $days ) );
	}

	/**
	 * Determine whether the current account can edit an owner's global settings.
	 *
	 * @param int $owner_user_id Resource owner user ID.
	 *
	 * @return bool True when the exact settings context is accessible.
	 */
	private function can_edit_owner_settings( $owner_user_id ) {
		if ( ! current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_settings' ) ) ) {
			return false;
		}
		if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
			return true;
		}
		$owner_user_id = absint( $owner_user_id );
		if ( $owner_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $owner_user_id ) ) {
			$owner_user_id = 0;
		}
		$current_user    = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();
		$current_user_id = is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
		if ( $current_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $current_user_id ) ) {
			$current_user_id = 0;
		}

		return $owner_user_id === $current_user_id;
	}

	/**
	 * Activate the owning MultiUser option context.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return mixed Previous active-user token.
	 */
	private function set_owner_environment( $resource_id ) {
		return function_exists( 'apply_bk_filter' )
			? apply_bk_filter( 'wpbc_mu_set_environment_for_owner_of_resource', -1, absint( $resource_id ) )
			: -1;
	}

	/**
	 * Restore the prior MultiUser option context.
	 *
	 * @param mixed $previous_active_user Previous active-user token.
	 * @param int   $resource_id          Resource ID used for the switch.
	 *
	 * @return void
	 */
	private function restore_owner_environment( $previous_active_user, $resource_id ) {
		if ( $resource_id && function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_active_user );
		}
	}
}
