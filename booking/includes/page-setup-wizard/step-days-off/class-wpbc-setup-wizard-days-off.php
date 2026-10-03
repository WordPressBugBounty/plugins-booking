<?php
/**
 * Domain service for the reusable Setup Wizard Days Off editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read and mutate canonical per-date availability for authorized Resources.
 *
 * The editor deliberately uses the same `date_status=unavailable` records as
 * Booking Calendar > Availability > Days Availability. It never introduces a
 * second option or wizard-specific copy of canonical availability.
 */
final class WPBC_Setup_Wizard_Days_Off {

	const MAX_RANGE_DAYS   = 366;
	const MAX_STAGED_DATES = 10000;

	/**
	 * Return the bounded field value staged by the Days Off editor.
	 *
	 * @return array{revision:string,unavailable_dates:array<int,string[]>} Staged canonical proposal.
	 */
	public function get_initial_staged_values() {
		$state = $this->get_state( 'all' );
		if ( is_wp_error( $state ) ) {
			return array( 'revision' => '', 'unavailable_dates' => array() );
		}

		return array(
			'revision'          => isset( $state['revision'] ) ? (string) $state['revision'] : '',
			'unavailable_dates' => isset( $state['unavailable_dates'] ) && is_array( $state['unavailable_dates'] ) ? $state['unavailable_dates'] : array(),
		);
	}

	/**
	 * Validate a complete future unavailability proposal for authorized Resources.
	 *
	 * @param mixed $raw_staged_values JSON transport string or stored array.
	 * @param bool  $require_complete   Whether the transport field is required.
	 *
	 * @return array{revision:string,unavailable_dates:array<int,string[]>}|WP_Error Normalized proposal or error.
	 */
	public function validate_staged_values( $raw_staged_values, $require_complete ) {
		if ( is_string( $raw_staged_values ) ) {
			if ( strlen( $raw_staged_values ) > 500000 ) {
				return new WP_Error( 'wpbc_setup_wizard_days_off_payload_too_large', __( 'The Days Off selection is too large.', 'booking' ) );
			}
			$raw_staged_values = json_decode( $raw_staged_values, true );
			if ( JSON_ERROR_NONE !== json_last_error() ) {
				return new WP_Error( 'wpbc_setup_wizard_days_off_payload_invalid', __( 'The Days Off selection is invalid.', 'booking' ) );
			}
		}

		if ( ! is_array( $raw_staged_values ) || array_diff( array_keys( $raw_staged_values ), array( 'revision', 'unavailable_dates' ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_payload_invalid', __( 'The Days Off selection is invalid.', 'booking' ) );
		}
		if ( $require_complete && ( ! array_key_exists( 'revision', $raw_staged_values ) || ! array_key_exists( 'unavailable_dates', $raw_staged_values ) ) ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_payload_required', __( 'Reload Days Off and review the unavailable dates before continuing.', 'booking' ) );
		}

		$revision = isset( $raw_staged_values['revision'] ) && is_scalar( $raw_staged_values['revision'] )
			? sanitize_text_field( (string) $raw_staged_values['revision'] )
			: '';
		$raw_dates = isset( $raw_staged_values['unavailable_dates'] ) && is_array( $raw_staged_values['unavailable_dates'] )
			? $raw_staged_values['unavailable_dates']
			: array();

		if ( ! $this->current_user_can_manage() ) {
			return array( 'revision' => '', 'unavailable_dates' => array() );
		}

		$resource_ids = array_map( 'absint', wp_list_pluck( $this->get_authorized_resources(), 'id' ) );
		$submitted_ids = array_values( array_unique( array_map( 'absint', array_keys( $raw_dates ) ) ) );
		sort( $resource_ids, SORT_NUMERIC );
		sort( $submitted_ids, SORT_NUMERIC );
		if ( $resource_ids !== $submitted_ids ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_resources_changed', __( 'The available booking items changed. Reload Days Off and try again.', 'booking' ) );
		}

		$total_dates = 0;
		$today       = current_datetime()->format( 'Y-m-d' );
		$dates       = array();
		foreach ( $resource_ids as $resource_id ) {
			$resource_dates = isset( $raw_dates[ $resource_id ] ) && is_array( $raw_dates[ $resource_id ] ) ? $raw_dates[ $resource_id ] : array();
			$dates[ $resource_id ] = array();
			foreach ( $resource_dates as $raw_date ) {
				$date = $this->validate_date( $raw_date );
				if ( null === $date || $date < $today ) {
					return new WP_Error( 'wpbc_setup_wizard_days_off_date_invalid', __( 'Days Off contains a date outside the supported future calendar.', 'booking' ) );
				}
				$dates[ $resource_id ][] = $date;
			}
			$dates[ $resource_id ] = array_values( array_unique( $dates[ $resource_id ] ) );
			sort( $dates[ $resource_id ], SORT_STRING );
			$total_dates += count( $dates[ $resource_id ] );
			if ( self::MAX_STAGED_DATES < $total_dates ) {
				return new WP_Error( 'wpbc_setup_wizard_days_off_dates_limit', __( 'The Days Off selection contains too many dates.', 'booking' ) );
			}
		}

		return array(
			'revision'          => substr( $revision, 0, 128 ),
			'unavailable_dates' => $dates,
		);
	}

	/**
	 * Build presentation state using the staged proposal instead of live dates.
	 *
	 * @param mixed  $raw_staged_values Validated or transported staged values.
	 * @param string $scope             Resource scope to present.
	 *
	 * @return array<string,mixed>|WP_Error Staged editor state or error.
	 */
	public function get_staged_state( $raw_staged_values, $scope = 'all' ) {
		$state = $this->get_state( $scope );
		if ( is_wp_error( $state ) || empty( $state['can_manage'] ) ) {
			return $state;
		}

		$staged = $this->validate_staged_values( $raw_staged_values, true );
		if ( is_wp_error( $staged ) ) {
			return $state;
		}

		$resource_ids = array_map( 'absint', wp_list_pluck( $state['resources'], 'id' ) );
		$target_ids   = $this->resolve_scope_resource_ids( $scope, $resource_ids );
		if ( is_wp_error( $target_ids ) ) {
			return $target_ids;
		}
		$scoped_dates = array_intersect_key( $staged['unavailable_dates'], array_fill_keys( $target_ids, true ) );
		$scoped_resources = array_values(
			array_filter(
				$state['resources'],
				static function ( $resource ) use ( $target_ids ) {
					return in_array( absint( $resource['id'] ), $target_ids, true );
				}
			)
		);

		$all_resource_ids            = array_map( 'absint', array_keys( $staged['unavailable_dates'] ) );
		$canonical_dates             = $this->get_unavailable_dates( $all_resource_ids );
		$state['unavailable_dates'] = $scoped_dates;
		$state['date_states']       = $this->build_date_states( $target_ids, $scoped_dates );
		$state['ranges']            = $this->build_range_records( $scoped_resources, $scoped_dates, 'all' === $scope ? 'all' : (string) $scope );
		$state['revision']          = $this->get_staged_display_revision( $canonical_dates, $staged );

		return $state;
	}

	/**
	 * Replace future canonical unavailable dates at the Save boundary.
	 *
	 * @param mixed $raw_staged_values Validated or transported staged values.
	 *
	 * @return array<string,mixed>|WP_Error Refreshed canonical state or error.
	 */
	public function save_staged_values( $raw_staged_values ) {
		if ( ! $this->current_user_can_manage() ) {
			return $this->get_state( 'all' );
		}

		$staged = $this->validate_staged_values( $raw_staged_values, true );
		if ( is_wp_error( $staged ) ) {
			return $staged;
		}

		$resources    = $this->get_authorized_resources();
		$resource_ids = array_map( 'absint', wp_list_pluck( $resources, 'id' ) );
		$current_dates = $this->get_unavailable_dates( $resource_ids );
		if ( ! $this->can_apply_staged_values( $current_dates, $staged ) ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_stale_state', __( 'Date availability changed in another request. Reload Days Off, review the changes, and try again.', 'booking' ) );
		}
		if ( $this->unavailable_dates_match( $current_dates, $staged['unavailable_dates'] ) ) {
			return $this->get_state( 'all' );
		}

		$attempted = array();
		foreach ( $resource_ids as $resource_id ) {
			$remove_dates = array_values( array_diff( $current_dates[ $resource_id ], $staged['unavailable_dates'][ $resource_id ] ) );
			$add_dates    = array_values( array_diff( $staged['unavailable_dates'][ $resource_id ], $current_dates[ $resource_id ] ) );
			foreach ( array( 'available' => $remove_dates, 'unavailable' => $add_dates ) as $status => $dates ) {
				foreach ( $this->collapse_consecutive_dates( $dates ) as $range ) {
					$attempted[ $resource_id ] = true;
					if ( false === $this->write_date_range( $resource_id, $status, $range['first_date'], $range['last_date'] ) ) {
						$restored = $this->restore_complete_dates( array_keys( $attempted ), $current_dates, $staged['unavailable_dates'] );
						return new WP_Error(
							'wpbc_setup_wizard_days_off_not_saved',
							$restored
								? __( 'Days Off could not be saved. Previous date availability was restored.', 'booking' )
								: __( 'Days Off could not be saved completely. Review Days Availability before continuing.', 'booking' )
						);
					}
				}
			}
		}

		$this->invalidate_availability_cache();
		$verified = $this->get_unavailable_dates( $resource_ids );
		if ( ! $this->unavailable_dates_match( $verified, $staged['unavailable_dates'] ) ) {
			$restored = $this->restore_complete_dates( $resource_ids, $current_dates, $staged['unavailable_dates'] );
			$message  = $restored
				? __( 'Days Off could not be verified. Previous date availability was restored.', 'booking' )
				: __( 'Days Off could not be verified or restored completely. Review Days Availability before continuing.', 'booking' );
			return new WP_Error( 'wpbc_setup_wizard_days_off_not_verified', $message );
		}

		return $this->get_state( 'all' );
	}

	/**
	 * Decide whether a staged replacement is current or an idempotent replay.
	 *
	 * The second condition covers a safe retry after canonical date writes
	 * succeeded but the shared checkpoint commit did not. A stale revision is
	 * still rejected whenever the submitted dates differ from current storage.
	 *
	 * @param array<int,string[]> $current_dates Current canonical unavailable dates.
	 * @param array<string,mixed>  $staged        Validated staged proposal.
	 *
	 * @return bool True when the proposal may be applied or treated as applied.
	 */
	private function can_apply_staged_values( array $current_dates, array $staged ) {
		return hash_equals( $this->get_state_revision( $current_dates ), (string) $staged['revision'] )
			|| $this->unavailable_dates_match( $current_dates, $staged['unavailable_dates'] );
	}

	/**
	 * Refresh a staged revision only when its complete dates equal canonical state.
	 *
	 * @param array<int,string[]> $canonical_dates Current canonical unavailable dates.
	 * @param array<string,mixed>  $staged          Validated staged proposal.
	 *
	 * @return string Current revision for an applied proposal, otherwise its base revision.
	 */
	private function get_staged_display_revision( array $canonical_dates, array $staged ) {
		return $this->unavailable_dates_match( $canonical_dates, $staged['unavailable_dates'] )
			? $this->get_state_revision( $canonical_dates )
			: (string) $staged['revision'];
	}

	/**
	 * Write one inclusive date range through the canonical Availability API.
	 *
	 * @param int    $resource_id Resource ID.
	 * @param string $status      `available` or `unavailable`.
	 * @param string $first_date  First ISO date.
	 * @param string $last_date   Last ISO date.
	 *
	 * @return bool True when the canonical writer did not fail.
	 */
	private function write_date_range( $resource_id, $status, $first_date, $last_date ) {
		return false !== wpbc_availability__update_dates_status__sql(
			array(
				'resource_id'     => absint( $resource_id ),
				'prop_name'       => 'date_status',
				'prop_value'      => $status,
				'dates_selection' => $first_date . ' ~ ' . $last_date,
			)
		);
	}

	/**
	 * Restore complete future before-images after a failed staged replacement.
	 *
	 * @param int[]               $resource_ids Resource IDs to restore.
	 * @param array<int,string[]> $before_dates Original unavailable dates.
	 * @param array<int,string[]> $desired_dates Attempted unavailable dates.
	 *
	 * @return bool True when every compensation write succeeded.
	 */
	private function restore_complete_dates( array $resource_ids, array $before_dates, array $desired_dates ) {
		$restored = true;
		foreach ( $resource_ids as $resource_id ) {
			$union = array_values( array_unique( array_merge( isset( $before_dates[ $resource_id ] ) ? $before_dates[ $resource_id ] : array(), isset( $desired_dates[ $resource_id ] ) ? $desired_dates[ $resource_id ] : array() ) ) );
			foreach ( $this->collapse_consecutive_dates( $union ) as $range ) {
				$restored = $this->write_date_range( $resource_id, 'available', $range['first_date'], $range['last_date'] ) && $restored;
			}
			foreach ( $this->collapse_consecutive_dates( isset( $before_dates[ $resource_id ] ) ? $before_dates[ $resource_id ] : array() ) as $range ) {
				$restored = $this->write_date_range( $resource_id, 'unavailable', $range['first_date'], $range['last_date'] ) && $restored;
			}
		}
		$this->invalidate_availability_cache();
		if ( ! $restored ) {
			return false;
		}

		$verified_dates = $this->get_unavailable_dates( $resource_ids );
		foreach ( $resource_ids as $resource_id ) {
			$expected_dates = isset( $before_dates[ $resource_id ] ) ? $before_dates[ $resource_id ] : array();
			$actual_dates   = isset( $verified_dates[ $resource_id ] ) ? $verified_dates[ $resource_id ] : array();
			if ( $expected_dates !== $actual_dates ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Return whether the current user may manage canonical date availability.
	 *
	 * Live-demo users who can open the Setup Wizard are deliberately allowed to
	 * exercise this step. Some long-lived demo fixtures retain an older, stricter
	 * Availability role option even though their temporary user is authorized for
	 * the wizard. Normal installations continue to use the configured Availability
	 * role without any relaxation.
	 *
	 * @return bool True when the configured Availability role is satisfied.
	 */
	public function current_user_can_manage() {
		if (
			WPBC_Setup_Wizard_Environment_Policy::is_live_demo()
			&& WPBC_Setup_Wizard_Access::current_user_can_access()
		) {
			return true;
		}

		$availability_role = sanitize_key( (string) get_bk_option( 'booking_user_role_availability' ) );

		if ( '' === $availability_role ) {
			return false;
		}
		if ( function_exists( 'wpbc_is_current_user_have_this_role' ) ) {
			return (bool) wpbc_is_current_user_have_this_role( $availability_role );
		}

		$capabilities = array(
			'administrator' => 'activate_plugins',
			'editor'        => 'publish_pages',
			'author'        => 'publish_posts',
			'contributor'   => 'edit_posts',
			'subscriber'    => 'read',
		);

		return isset( $capabilities[ $availability_role ] ) && current_user_can( $capabilities[ $availability_role ] );
	}

	/**
	 * Build the data-only editor state from canonical Availability records.
	 *
	 * @param string $scope `all` or one authorized Resource ID.
	 *
	 * @return array<string,mixed>|WP_Error Authorized scoped state or a safe error.
	 */
	public function get_state( $scope = 'all' ) {
		$can_manage = $this->current_user_can_manage();
		if ( ! $can_manage ) {
			$today = current_datetime()->format( 'Y-m-d' );

			return array(
				'can_manage'          => false,
				'has_resources'       => false,
				'resources'           => array(),
				'apply_options'       => array(),
				'unavailable_dates'   => array(),
				'date_states'         => array(),
				'booking_date_states' => array(),
				'ranges'              => array(),
				'revision'            => '',
				'scope'               => '',
				'is_aggregate_scope'  => false,
				'today'               => $today,
				'default_first_date'  => $today,
				'default_last_date'   => $today,
				'first_day'           => max( 0, min( 6, (int) get_bk_option( 'booking_start_day_weeek' ) ) ),
				'max_range_days'      => self::MAX_RANGE_DAYS,
			);
		}

		$resources             = $this->get_authorized_resources();
		$resource_ids          = array_map( 'absint', wp_list_pluck( $resources, 'id' ) );
		$all_unavailable_dates = $this->get_unavailable_dates( $resource_ids );
		$today                 = current_datetime()->format( 'Y-m-d' );
		$apply_options         = array();

		if ( ! empty( $resources ) ) {
			$apply_options[] = array(
				'value' => 'all',
				'label' => __( 'All booking items', 'booking' ),
			);
		}
		if ( count( $resources ) > 1 ) {
			foreach ( $resources as $resource ) {
				$apply_options[] = array(
					'value' => (string) $resource['id'],
					'label' => $resource['label'],
				);
			}
		}

		$normalized_scope    = is_scalar( $scope ) ? sanitize_text_field( (string) $scope ) : '';
		$target_resource_ids = $this->resolve_scope_resource_ids( $normalized_scope, $resource_ids );
		if ( is_wp_error( $target_resource_ids ) ) {
			return $target_resource_ids;
		}

		$scoped_resources         = array();
		$scoped_unavailable_dates = array();
		foreach ( $resources as $resource ) {
			$resource_id = absint( $resource['id'] );
			if ( ! in_array( $resource_id, $target_resource_ids, true ) ) {
				continue;
			}
			$scoped_resources[]                         = $resource;
			$scoped_unavailable_dates[ $resource_id ] = isset( $all_unavailable_dates[ $resource_id ] ) ? $all_unavailable_dates[ $resource_id ] : array();
		}

		$single_resource_scope = 'all' === $normalized_scope ? 'all' : $normalized_scope;
		$ranges                = $this->build_range_records( $scoped_resources, $scoped_unavailable_dates, $single_resource_scope );
		$is_aggregate_scope     = 'all' === $normalized_scope && 1 < count( $target_resource_ids );

		return array(
			'can_manage'          => $can_manage,
			'has_resources'       => ! empty( $resources ),
			'resources'           => $resources,
			'apply_options'       => $apply_options,
			'unavailable_dates'   => $scoped_unavailable_dates,
			'date_states'         => $this->build_date_states( $target_resource_ids, $scoped_unavailable_dates ),
			'booking_date_states' => $this->get_booking_date_states( $target_resource_ids, $is_aggregate_scope ),
			'ranges'              => $ranges,
			'revision'            => $this->get_state_revision( $all_unavailable_dates ),
			'scope'               => $normalized_scope,
			'is_aggregate_scope'  => $is_aggregate_scope,
			'today'               => $today,
			'default_first_date'  => $today,
			'default_last_date'   => $today,
			'first_day'           => max( 0, min( 6, (int) get_bk_option( 'booking_start_day_weeek' ) ) ),
			'max_range_days'      => self::MAX_RANGE_DAYS,
		);
	}

	/**
	 * Add or remove one validated unavailable date range.
	 *
	 * A state revision prevents a stale browser from deleting dates changed by
	 * another administrator after the list was rendered. Multi-resource writes
	 * use bounded compensation because WordPress installations cannot be assumed
	 * to use a transaction-capable table engine.
	 *
	 * @param string $operation         Either `add` or `remove`.
	 * @param string $scope             `all` or one authorized Resource ID.
	 * @param string $first_date        First date in `Y-m-d` format.
	 * @param string $last_date         Last date in `Y-m-d` format.
	 * @param string $expected_revision Client state revision.
	 * @param string $view_scope        Scope that must remain visible after the write.
	 *
	 * @return array<string,mixed>|WP_Error Refreshed state or a safe error.
	 */
	public function mutate_range( $operation, $scope, $first_date, $last_date, $expected_revision, $view_scope = 'all' ) {
		if ( ! $this->current_user_can_manage() ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_forbidden', __( 'You are not allowed to change date availability.', 'booking' ) );
		}

		$operation = sanitize_key( (string) $operation );
		if ( ! in_array( $operation, array( 'add', 'remove' ), true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_operation_invalid', __( 'Choose a valid date availability action.', 'booking' ) );
		}

		$validated_range = $this->validate_range( $first_date, $last_date );
		if ( is_wp_error( $validated_range ) ) {
			return $validated_range;
		}

		$resources        = $this->get_authorized_resources();
		$resource_ids     = array_map( 'absint', wp_list_pluck( $resources, 'id' ) );
		$current_dates     = $this->get_unavailable_dates( $resource_ids );
		$current_revision  = $this->get_state_revision( $current_dates );
		$view_scope        = is_scalar( $view_scope ) ? sanitize_text_field( (string) $view_scope ) : '';
		$view_resource_ids = $this->resolve_scope_resource_ids( $view_scope, $resource_ids );
		if ( is_wp_error( $view_resource_ids ) ) {
			return $view_resource_ids;
		}

		if ( ! hash_equals( $current_revision, sanitize_text_field( (string) $expected_revision ) ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_days_off_stale_state',
				__( 'Date availability changed in another request. Review the refreshed list and try again.', 'booking' ),
				array( 'state' => $this->get_state( $view_scope ) )
			);
		}

		$target_resource_ids = $this->resolve_scope_resource_ids( $scope, $resource_ids );
		if ( is_wp_error( $target_resource_ids ) ) {
			return $target_resource_ids;
		}
		if ( empty( $target_resource_ids ) ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_resources_empty', __( 'No booking items are available for this date range.', 'booking' ) );
		}

		$dates_selection     = $validated_range['first_date'] . ' ~ ' . $validated_range['last_date'];
		$attempted_resources = array();
		$before_images       = array();
		foreach ( $target_resource_ids as $resource_id ) {
			$before_images[ $resource_id ] = $this->filter_dates_to_range(
				isset( $current_dates[ $resource_id ] ) ? $current_dates[ $resource_id ] : array(),
				$validated_range['first_date'],
				$validated_range['last_date']
			);
			$attempted_resources[] = $resource_id;
			$mutation_result = wpbc_availability__update_dates_status__sql(
				array(
					'resource_id'     => $resource_id,
					'prop_name'       => 'date_status',
					'prop_value'      => 'add' === $operation ? 'unavailable' : 'available',
					'dates_selection' => $dates_selection,
				)
			);

			if ( false === $mutation_result ) {
				$compensation_succeeded = $this->restore_before_images( $attempted_resources, $before_images, $dates_selection );

				return new WP_Error(
					'wpbc_setup_wizard_days_off_not_saved',
					$compensation_succeeded
						? __( 'The unavailable dates could not be saved. The previous date availability was restored.', 'booking' )
						: __( 'The unavailable dates could not be saved completely. Reload the page and review Days Availability before trying again.', 'booking' )
				);
			}
		}

		$this->invalidate_availability_cache();

		return $this->get_state( $view_scope );
	}

	/**
	 * Return current-user Resources without trusting a request owner identifier.
	 *
	 * @return array<int,array{id:int,label:string}> Authorized Resource records.
	 */
	private function get_authorized_resources() {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return array(
				array(
					'id'    => 1,
					'label' => __( 'Standard', 'booking' ),
				),
			);
		}

		global $wpdb;
		$table_name       = $wpdb->prefix . 'bookingtypes';
		$sql              = "SELECT booking_type_id, title FROM {$table_name} WHERE 1=1";
		$query_parameters = array();

		if ( class_exists( 'wpdev_bk_multiuser' ) ) {
			$current_user_id = function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : get_current_user_id();
			$is_super_admin  = $current_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $current_user_id );
			if ( ! $is_super_admin ) {
				$sql               .= ' AND users = %d';
				$query_parameters[] = $current_user_id;
			}
		}

		$sql .= $this->get_resource_order_by_sql();
		if ( ! empty( $query_parameters ) ) {
			$sql = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		}

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
		$database_rows = $wpdb->get_results( $sql, ARRAY_A );
		$resources     = array();
		foreach ( (array) $database_rows as $database_row ) {
			$resource_id = isset( $database_row['booking_type_id'] ) ? absint( $database_row['booking_type_id'] ) : 0;
			if ( ! $resource_id ) {
				continue;
			}
			$raw_title   = isset( $database_row['title'] ) ? (string) $database_row['title'] : '';
			$resources[] = array(
				'id'    => $resource_id,
				'label' => sanitize_text_field( function_exists( 'wpbc_lang' ) ? wpbc_lang( $raw_title ) : $raw_title ),
			);
		}

		return $resources;
	}

	/**
	 * Return an edition-safe Resource ordering clause.
	 *
	 * The Personal, Business Small, and Business Medium Resource tables do not
	 * contain the Business Large hierarchy columns. Querying those columns makes
	 * WordPress return no rows and incorrectly hides the Days Off editor. Keep the
	 * ordering aligned with the canonical Booking Listing Resource query instead.
	 *
	 * @return string Safe SQL ORDER BY clause for the active edition.
	 */
	private function get_resource_order_by_sql() {
		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			return ' ORDER BY parent ASC, prioritet ASC, title ASC, booking_type_id ASC';
		}

		return ' ORDER BY title ASC, booking_type_id ASC';
	}

	/**
	 * Read future unavailable dates for authorized Resources.
	 *
	 * @param int[] $resource_ids Authorized Resource IDs.
	 *
	 * @return array<int,string[]> Dates keyed by Resource ID.
	 */
	private function get_unavailable_dates( array $resource_ids ) {
		$normalized = array();
		foreach ( $resource_ids as $resource_id ) {
			$resource_id                = absint( $resource_id );
			$normalized[ $resource_id ] = array();
		}
		if ( empty( $resource_ids ) ) {
			return $normalized;
		}

		$dates_by_resource = wpbc_for_resources_arr__get_unavailable_dates( $resource_ids, 'CURDATE' );
		foreach ( $normalized as $resource_id => $unused_dates ) {
			$dates = isset( $dates_by_resource[ $resource_id ] ) && is_array( $dates_by_resource[ $resource_id ] )
				? array_values( array_unique( array_filter( array_map( 'sanitize_text_field', $dates_by_resource[ $resource_id ] ) ) ) )
				: array();
			sort( $dates, SORT_STRING );
			$normalized[ $resource_id ] = $dates;
		}

		return $this->normalize_unavailable_dates( $normalized );
	}

	/**
	 * Compare complete unavailable-date maps without transport-order sensitivity.
	 *
	 * JSON objects with numeric Resource IDs are enumerated in numeric order by
	 * browsers, while the canonical Resource query uses hierarchy and priority
	 * order. Both representations describe the same state, so stale-write and
	 * verification checks must compare their canonical forms rather than PHP
	 * insertion order.
	 *
	 * @param array<int,string[]> $first_dates  First unavailable-date map.
	 * @param array<int,string[]> $second_dates Second unavailable-date map.
	 *
	 * @return bool True when both maps contain the same Resource dates.
	 */
	private function unavailable_dates_match( array $first_dates, array $second_dates ) {
		return $this->normalize_unavailable_dates( $first_dates ) === $this->normalize_unavailable_dates( $second_dates );
	}

	/**
	 * Build one deterministic representation of unavailable dates.
	 *
	 * Resource IDs are ordered numerically and each Resource date list is
	 * de-duplicated and sorted. This representation is used only after Resource
	 * authorization and date validation have established the allowed content.
	 *
	 * @param array<int,string[]> $dates_by_resource Unavailable dates keyed by Resource ID.
	 *
	 * @return array<int,string[]> Canonically ordered unavailable dates.
	 */
	private function normalize_unavailable_dates( array $dates_by_resource ) {
		$normalized_dates = array();

		foreach ( $dates_by_resource as $resource_id => $resource_dates ) {
			$resource_id = absint( $resource_id );
			if ( ! $resource_id ) {
				continue;
			}

			$resource_dates = is_array( $resource_dates ) ? $resource_dates : array();
			$resource_dates = array_values( array_unique( array_map( 'sanitize_text_field', $resource_dates ) ) );
			sort( $resource_dates, SORT_STRING );
			$normalized_dates[ $resource_id ] = $resource_dates;
		}

		ksort( $normalized_dates, SORT_NUMERIC );

		return $normalized_dates;
	}

	/**
	 * Build the calendar state for one authorized Resource scope.
	 *
	 * A date is unavailable only when every Resource in the scope is closed.
	 * When only some Resources are closed, the date remains selectable and is
	 * exposed as partially available so the aggregate `all` view is truthful.
	 *
	 * @param int[]               $resource_ids     Resource IDs in the current scope.
	 * @param array<int,string[]> $dates_by_resource Unavailable dates keyed by Resource ID.
	 *
	 * @return array<string,string> State keyed by canonical `Y-m-d` date.
	 */
	private function build_date_states( array $resource_ids, array $dates_by_resource ) {
		$resource_count = count( $resource_ids );
		$date_counts    = array();

		if ( 0 === $resource_count ) {
			return array();
		}

		foreach ( $resource_ids as $resource_id ) {
			$resource_id = absint( $resource_id );
			$dates       = isset( $dates_by_resource[ $resource_id ] ) ? $dates_by_resource[ $resource_id ] : array();
			foreach ( $dates as $date ) {
				$date_counts[ $date ] = isset( $date_counts[ $date ] ) ? $date_counts[ $date ] + 1 : 1;
			}
		}

		ksort( $date_counts, SORT_STRING );
		$date_states = array();
		foreach ( $date_counts as $date => $unavailable_resource_count ) {
			$date_states[ $date ] = $resource_count === $unavailable_resource_count ? 'unavailable' : 'partially_available';
		}

		return $date_states;
	}

	/**
	 * Read future booking dates through Booking Calendar's canonical producer.
	 *
	 * A single Resource receives the same full-day and time-slot distinctions as
	 * the native Days Availability calendar. The all-Resources view deliberately
	 * exposes only a neutral aggregate marker because one booking must not imply
	 * that every authorized Resource is booked.
	 *
	 * @param int[] $resource_ids       Authorized Resource IDs in the current scope.
	 * @param bool  $is_aggregate_scope Whether more than one Resource is represented.
	 *
	 * @return array<string,string> Presentation state keyed by canonical `Y-m-d` date.
	 */
	private function get_booking_date_states( array $resource_ids, $is_aggregate_scope ) {
		if ( empty( $resource_ids ) || ! function_exists( 'wpbc__sql__get_booked_dates' ) ) {
			return array();
		}

		$resource_ids = array_values( array_filter( array_unique( array_map( 'absint', $resource_ids ) ) ) );
		if ( empty( $resource_ids ) ) {
			return array();
		}

		$booked_dates = wpbc__sql__get_booked_dates(
			array(
				'resource_id' => implode( ',', $resource_ids ),
			)
		);

		return $this->build_booking_date_states( is_array( $booked_dates ) ? $booked_dates : array(), (bool) $is_aggregate_scope );
	}

	/**
	 * Map canonical booked-date records to executable-free calendar state names.
	 *
	 * The mapping mirrors `wpbc__inline_booking_calendar__apply_css_to_days()`:
	 * `sec_0` is a full-day booking, while non-zero seconds are time-slot or
	 * changeover bookings. Any pending timed record makes that date pending.
	 *
	 * @param array<string,array<string,object|array<string,mixed>>> $booked_dates       Canonical booked dates.
	 * @param bool                                                  $is_aggregate_scope Whether multiple Resources are represented.
	 *
	 * @return array<string,string> Presentation state keyed by canonical `Y-m-d` date.
	 */
	private function build_booking_date_states( array $booked_dates, $is_aggregate_scope ) {
		$date_states = array();

		foreach ( $booked_dates as $calendar_date => $bookings_in_date ) {
			$date_parts = array_map( 'absint', explode( '-', (string) $calendar_date ) );
			if ( 3 !== count( $date_parts ) || ! checkdate( $date_parts[0], $date_parts[1], $date_parts[2] ) || ! is_array( $bookings_in_date ) || empty( $bookings_in_date ) ) {
				continue;
			}

			$iso_date = sprintf( '%04d-%02d-%02d', $date_parts[2], $date_parts[0], $date_parts[1] );
			if ( $is_aggregate_scope ) {
				$date_states[ $iso_date ] = 'resources_have_bookings';
				continue;
			}

			if ( isset( $bookings_in_date['sec_0'] ) ) {
				$full_day_booking     = $bookings_in_date['sec_0'];
				$full_day_is_approved = is_object( $full_day_booking )
					? ! empty( $full_day_booking->approved )
					: ( is_array( $full_day_booking ) && ! empty( $full_day_booking['approved'] ) );
				$date_states[ $iso_date ] = $full_day_is_approved ? 'approved_full' : 'pending_full';
				continue;
			}

			$all_bookings_approved = true;
			foreach ( $bookings_in_date as $booking_record ) {
				$is_approved = is_object( $booking_record )
					? ! empty( $booking_record->approved )
					: ( is_array( $booking_record ) && ! empty( $booking_record['approved'] ) );
				if ( ! $is_approved ) {
					$all_bookings_approved = false;
					break;
				}
			}
			$date_states[ $iso_date ] = $all_bookings_approved ? 'approved_partial' : 'pending_partial';
		}

		ksort( $date_states, SORT_STRING );

		return $date_states;
	}

	/**
	 * Convert consecutive canonical dates into compact upcoming range records.
	 *
	 * Exact ranges shared by every authorized Resource are collapsed into one
	 * `all` record. Other ranges retain their Resource scope.
	 *
	 * @param array<int,array{id:int,label:string}> $resources         Authorized Resources.
	 * @param array<int,string[]>                   $dates_by_resource Unavailable dates by Resource.
	 * @param string                                $single_scope      Scope used when one Resource is shown.
	 *
	 * @return array<int,array<string,mixed>> Range presentation records.
	 */
	private function build_range_records( array $resources, array $dates_by_resource, $single_scope = 'all' ) {
		$resource_labels = array();
		$resource_ranges = array();
		$range_counts    = array();

		foreach ( $resources as $resource ) {
			$resource_id                    = absint( $resource['id'] );
			$resource_labels[ $resource_id ] = (string) $resource['label'];
			$resource_ranges[ $resource_id ] = $this->collapse_consecutive_dates(
				isset( $dates_by_resource[ $resource_id ] ) ? $dates_by_resource[ $resource_id ] : array()
			);
			foreach ( $resource_ranges[ $resource_id ] as $range ) {
				$range_key                  = $range['first_date'] . '|' . $range['last_date'];
				$range_counts[ $range_key ] = isset( $range_counts[ $range_key ] ) ? $range_counts[ $range_key ] + 1 : 1;
			}
		}

		$records        = array();
		$resource_count = count( $resources );
		$shared_added   = array();
		foreach ( $resource_ranges as $resource_id => $ranges ) {
			foreach ( $ranges as $range ) {
				$range_key = $range['first_date'] . '|' . $range['last_date'];
				$is_shared = 1 < $resource_count && isset( $range_counts[ $range_key ] ) && $resource_count === $range_counts[ $range_key ];
				if ( $is_shared && isset( $shared_added[ $range_key ] ) ) {
					continue;
				}
				$scope       = $is_shared ? 'all' : ( 1 === $resource_count ? $single_scope : (string) $resource_id );
				$scope_label = 'all' === $scope ? __( 'All booking items', 'booking' ) : $resource_labels[ $resource_id ];
				$records[]   = $this->format_range_record( $range['first_date'], $range['last_date'], $scope, $scope_label );
				if ( $is_shared ) {
					$shared_added[ $range_key ] = true;
				}
			}
		}

		usort(
			$records,
			static function ( $first_record, $second_record ) {
				return strcmp( $first_record['first_date'] . '|' . $first_record['scope'], $second_record['first_date'] . '|' . $second_record['scope'] );
			}
		);

		return $records;
	}

	/**
	 * Collapse ordered date strings into consecutive inclusive ranges.
	 *
	 * @param string[] $dates Ordered or unordered `Y-m-d` dates.
	 *
	 * @return array<int,array{first_date:string,last_date:string}> Date ranges.
	 */
	private function collapse_consecutive_dates( array $dates ) {
		$dates = array_values( array_unique( $dates ) );
		sort( $dates, SORT_STRING );
		$ranges        = array();
		$current_first = '';
		$current_last  = '';

		foreach ( $dates as $date ) {
			if ( '' === $current_first ) {
				$current_first = $date;
				$current_last  = $date;
				continue;
			}

			$expected_next = ( new DateTimeImmutable( $current_last, new DateTimeZone( 'UTC' ) ) )->modify( '+1 day' )->format( 'Y-m-d' );
			if ( $date === $expected_next ) {
				$current_last = $date;
				continue;
			}

			$ranges[]      = array( 'first_date' => $current_first, 'last_date' => $current_last );
			$current_first = $date;
			$current_last  = $date;
		}
		if ( '' !== $current_first ) {
			$ranges[] = array( 'first_date' => $current_first, 'last_date' => $current_last );
		}

		return $ranges;
	}

	/**
	 * Format one range without exposing executable or storage data.
	 *
	 * @param string $first_date  First date.
	 * @param string $last_date   Last date.
	 * @param string $scope       Valid Resource scope.
	 * @param string $scope_label Scope label.
	 *
	 * @return array<string,mixed> Presentation record.
	 */
	private function format_range_record( $first_date, $last_date, $scope, $scope_label ) {
		$first_datetime = new DateTimeImmutable( $first_date, wp_timezone() );
		$last_datetime  = new DateTimeImmutable( $last_date, wp_timezone() );
		$day_count      = (int) $first_datetime->diff( $last_datetime )->days + 1;
		$date_format    = (string) get_bk_option( 'booking_date_format' );
		if ( '' === $date_format ) {
			$date_format = (string) get_option( 'date_format', 'M j, Y' );
		}
		$first_label = wp_date( $date_format, $first_datetime->getTimestamp(), wp_timezone() );
		$last_label  = wp_date( $date_format, $last_datetime->getTimestamp(), wp_timezone() );

		return array(
			'id'          => hash( 'sha256', $scope . '|' . $first_date . '|' . $last_date ),
			'first_date'  => $first_date,
			'last_date'   => $last_date,
			'label'       => $first_date === $last_date ? $first_label : $first_label . " \u{2013} " . $last_label,
			'day_count'   => $day_count,
			'scope'       => $scope,
			'scope_label' => sanitize_text_field( $scope_label ),
		);
	}

	/**
	 * Validate a bounded future date range.
	 *
	 * @param mixed $raw_first_date Untrusted first date.
	 * @param mixed $raw_last_date  Untrusted last date.
	 *
	 * @return array{first_date:string,last_date:string}|WP_Error Validated range.
	 */
	private function validate_range( $raw_first_date, $raw_last_date ) {
		$first_date = $this->validate_date( $raw_first_date );
		$last_date  = $this->validate_date( $raw_last_date );
		if ( null === $first_date || null === $last_date ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_date_invalid', __( 'Select a valid first and last date.', 'booking' ) );
		}

		$first_datetime = new DateTimeImmutable( $first_date, new DateTimeZone( 'UTC' ) );
		$last_datetime  = new DateTimeImmutable( $last_date, new DateTimeZone( 'UTC' ) );
		$today          = new DateTimeImmutable( current_datetime()->format( 'Y-m-d' ), new DateTimeZone( 'UTC' ) );
		if ( $first_datetime < $today || $last_datetime < $first_datetime ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_range_invalid', __( 'Choose a date range that starts today or later and ends after it starts.', 'booking' ) );
		}

		$day_count = (int) $first_datetime->diff( $last_datetime )->days + 1;
		if ( self::MAX_RANGE_DAYS < $day_count ) {
			return new WP_Error(
				'wpbc_setup_wizard_days_off_range_too_large',
				/* translators: %d: Maximum number of dates in one range. */
				sprintf( __( 'Choose no more than %d days in one unavailable range.', 'booking' ), self::MAX_RANGE_DAYS )
			);
		}

		return array( 'first_date' => $first_date, 'last_date' => $last_date );
	}

	/**
	 * Validate one exact Gregorian `Y-m-d` date.
	 *
	 * @param mixed $raw_date Untrusted date.
	 *
	 * @return string|null Valid date or null.
	 */
	private function validate_date( $raw_date ) {
		if ( ! is_scalar( $raw_date ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $raw_date ) ) {
			return null;
		}

		$date   = DateTimeImmutable::createFromFormat( '!Y-m-d', (string) $raw_date, new DateTimeZone( 'UTC' ) );
		$errors = DateTimeImmutable::getLastErrors();
		if ( false === $date || ( false !== $errors && ( 0 < $errors['warning_count'] || 0 < $errors['error_count'] ) ) ) {
			return null;
		}

		return $date->format( 'Y-m-d' ) === (string) $raw_date ? $date->format( 'Y-m-d' ) : null;
	}

	/**
	 * Resolve one scope against the current authorized Resource allow-list.
	 *
	 * @param mixed $scope        Untrusted scope.
	 * @param int[] $resource_ids Authorized Resource IDs.
	 *
	 * @return int[]|WP_Error Target Resource IDs or an error.
	 */
	private function resolve_scope_resource_ids( $scope, array $resource_ids ) {
		$scope = is_scalar( $scope ) ? sanitize_text_field( (string) $scope ) : '';
		if ( 'all' === $scope ) {
			return $resource_ids;
		}
		if ( ! preg_match( '/^\d+$/', $scope ) ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_scope_invalid', __( 'Choose a valid booking item.', 'booking' ) );
		}

		$resource_id = absint( $scope );
		if ( ! in_array( $resource_id, $resource_ids, true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_scope_forbidden', __( 'You are not allowed to change availability for that booking item.', 'booking' ) );
		}

		return array( $resource_id );
	}

	/**
	 * Return only dates from an inclusive range.
	 *
	 * @param string[] $dates      Source dates.
	 * @param string   $first_date First date.
	 * @param string   $last_date  Last date.
	 *
	 * @return string[] Filtered dates.
	 */
	private function filter_dates_to_range( array $dates, $first_date, $last_date ) {
		return array_values(
			array_filter(
				$dates,
				static function ( $date ) use ( $first_date, $last_date ) {
					return $date >= $first_date && $date <= $last_date;
				}
			)
		);
	}

	/**
	 * Restore exact unavailable before-images after a partial write failure.
	 *
	 * @param int[]                $resource_ids    Attempted Resource IDs.
	 * @param array<int,string[]>  $before_images   Prior unavailable dates.
	 * @param string               $dates_selection Complete attempted range.
	 *
	 * @return bool True when every compensating write succeeds.
	 */
	private function restore_before_images( array $resource_ids, array $before_images, $dates_selection ) {
		$compensation_succeeded = true;

		foreach ( $resource_ids as $resource_id ) {
			$clear_result = wpbc_availability__update_dates_status__sql(
				array(
					'resource_id'     => $resource_id,
					'prop_name'       => 'date_status',
					'prop_value'      => 'available',
					'dates_selection' => $dates_selection,
				)
			);
			if ( false === $clear_result ) {
				$compensation_succeeded = false;
			}
			if ( ! empty( $before_images[ $resource_id ] ) ) {
				$restore_result = wpbc_availability__update_dates_status__sql(
					array(
						'resource_id'     => $resource_id,
						'prop_name'       => 'date_status',
						'prop_value'      => 'unavailable',
						'dates_selection' => implode( ', ', $before_images[ $resource_id ] ),
					)
				);
				if ( false === $restore_result ) {
					$compensation_succeeded = false;
				}
			}
		}
		$this->invalidate_availability_cache();

		return $compensation_succeeded;
	}

	/**
	 * Build a current-user/site-bound revision for stale-write protection.
	 *
	 * @param array<int,string[]> $dates_by_resource Canonical dates.
	 *
	 * @return string Hexadecimal revision.
	 */
	private function get_state_revision( array $dates_by_resource ) {
		$context = WPBC_Setup_Wizard_Access::get_storage_context();
		$dates_by_resource = $this->normalize_unavailable_dates( $dates_by_resource );

		return hash_hmac(
			'sha256',
			wp_json_encode( array( 'context' => $context, 'dates' => $dates_by_resource ) ),
			wp_salt( 'nonce' )
		);
	}

	/**
	 * Invalidate the request-local cache after canonical Availability writes.
	 *
	 * @return void
	 */
	private function invalidate_availability_cache() {
		global $wpbc_global_cache;

		if ( isset( $wpbc_global_cache['wpbc_availability__get_dates_status__sql'] ) ) {
			unset( $wpbc_global_cache['wpbc_availability__get_dates_status__sql'] );
		}
	}
}
