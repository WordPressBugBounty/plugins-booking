<?php
/**
 * Booking Date Editor signed, non-mutating review service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Revalidate a Date Editor proposal and issue one short-lived signed plan.
 *
 * The service deliberately delegates bookings, availability, capacity,
 * Seasons, changeover, checkout, gap, and conflict checks to the canonical
 * save-time availability resolver. Individual selection bypasses only range
 * geometry, required range length, and permitted start-weekday rules.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Review_Service {

	/** Current signed plan schema. */
	const PLAN_VERSION = 1;

	/** Signed review lifetime in seconds. */
	const REVIEW_LIFETIME = 600;

	/** Maximum warning count returned to the browser. */
	const MAX_WARNINGS = 5;

	/** @var WPBC_Booking_Inspector_Authorization Booking authorization boundary. */
	private $authorization;

	/** @var WPBC_Booking_Date_Editor_Review_Request_Validator Review request validator. */
	private $request_validator;

	/** @var WPBC_Booking_Inspector_Date_Repository Canonical booking-date repository. */
	private $date_repository;

	/**
	 * Construct the review service with replaceable focused dependencies.
	 *
	 * @param WPBC_Booking_Inspector_Authorization|null               $authorization    Optional authorization service.
	 * @param WPBC_Booking_Date_Editor_Review_Request_Validator|null  $request_validator Optional request validator.
	 * @param WPBC_Booking_Inspector_Date_Repository|null             $date_repository  Optional date repository.
	 */
	public function __construct( $authorization = null, $request_validator = null, $date_repository = null ) {
		$this->authorization     = $authorization ? $authorization : new WPBC_Booking_Inspector_Authorization();
		$this->request_validator = $request_validator ? $request_validator : new WPBC_Booking_Date_Editor_Review_Request_Validator();
		$this->date_repository   = $date_repository ? $date_repository : new WPBC_Booking_Inspector_Date_Repository();
	}

	/**
	 * Build a signed review without mutating bookings or sending notifications.
	 *
	 * @param mixed $request_values Untrusted endpoint values.
	 *
	 * @return array<string,mixed>|WP_Error Review DTO and signed plan, or safe error.
	 */
	public function review( $request_values ) {
		$request = $this->request_validator->normalize( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}
		if ( ! $this->current_user_can_edit() ) {
			return $this->get_unauthorized_error();
		}

		$authorization_context = $this->authorization->authorize_booking( $request['booking_id'], $request['source'] );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}

		$booking     = $authorization_context['booking'];
		$resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$date_rows   = $this->date_repository->get_booking_dates( $request['booking_id'], $resource_id );
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}

		$current_fingerprint = WPBC_Booking_Date_Editor_Source_Fingerprint::build( $booking, $date_rows );
		if ( ! hash_equals( $current_fingerprint, $request['source_fingerprint'] ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_review_stale',
				__( 'The booking dates changed after the editor opened. Reload the dates and try again.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$effective_resource_ids = isset( $authorization_context['effective_resource_ids'] )
			? (array) $authorization_context['effective_resource_ids']
			: array();
		$read_service           = new WPBC_Booking_Date_Editor_Read_Service();
		$saved                  = $read_service->normalize_saved_date_rows( $date_rows, $effective_resource_ids );
		if ( empty( $saved['supported'] ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_review_unsupported',
				__( 'These saved booking dates must be edited on the Add Booking page.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$proposal          = $request['proposal'];
		$policy            = $this->get_current_selection_policy();
		$policy_validation = $this->validate_selection_policy( $proposal, $policy );
		if ( is_wp_error( $policy_validation ) ) {
			return $policy_validation;
		}

		$time_validation = $this->validate_time_application( $proposal );
		if ( is_wp_error( $time_validation ) ) {
			return $time_validation;
		}

		$appointment_snapshot = $this->get_appointment_snapshot( $request['booking_id'] );
		$appointment_check    = $this->validate_appointment_proposal( $proposal, $appointment_snapshot, $resource_id );
		if ( is_wp_error( $appointment_check ) ) {
			return $appointment_check;
		}

		$availability_result = $this->validate_canonical_availability(
			$booking,
			$date_rows,
			$proposal,
			$appointment_snapshot
		);
		if ( is_wp_error( $availability_result ) ) {
			return $availability_result;
		}

		$issued_at  = time();
		$expires_at = $issued_at + self::REVIEW_LIFETIME;
		$plan       = array(
			'version'             => self::PLAN_VERSION,
			'site_id'             => function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0,
			'user_id'             => $this->get_current_user_id(),
			'actor_user_id'       => function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0,
			'booking_id'          => absint( $request['booking_id'] ),
			'resource_id'         => $resource_id,
			'source'              => $request['source'],
			'issued_at'           => $issued_at,
			'expires_at'          => $expires_at,
			'source_fingerprint'  => $current_fingerprint,
			'rule_fingerprint'    => $this->build_context_fingerprint( 'rules', $policy ),
			'appointment_fingerprint' => $this->build_context_fingerprint( 'appointment', $appointment_snapshot ),
			'proposal'            => $proposal,
		);

		return array(
			'review'    => $this->build_review_dto( $request['booking_id'], $saved, $proposal ),
			'plan'      => $plan,
			'token'     => $this->sign_plan( $plan ),
			'expires_at' => $expires_at,
		);
	}

	/**
	 * Verify a signed plan's signature, shape, expiry, account, site, and target.
	 *
	 * Step 7 apply reuses this boundary before it performs fresh authorization,
	 * source fingerprint, rule, and availability checks under its mutation lock.
	 *
	 * @param mixed  $plan                 Untrusted plan value.
	 * @param mixed  $token                Untrusted hexadecimal signature.
	 * @param int    $expected_booking_id  Expected booking ID, or zero to omit this comparison.
	 * @param int    $expected_resource_id Expected Resource ID, or zero to omit this comparison.
	 * @param string $expected_source      Expected Inspector source, or an empty string to omit this comparison.
	 *
	 * @return true|WP_Error True when the signed envelope is valid, otherwise a safe error.
	 */
	public function verify_plan( $plan, $token, $expected_booking_id = 0, $expected_resource_id = 0, $expected_source = '' ) {
		$token = is_scalar( $token ) ? strtolower( trim( (string) $token ) ) : '';
		if ( ! is_array( $plan ) || ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
			return $this->get_invalid_plan_error();
		}

		$expected_token = $this->sign_plan( $plan );
		if ( ! hash_equals( $expected_token, $token ) ) {
			return $this->get_invalid_plan_error();
		}

		$required_keys = array(
			'version',
			'site_id',
			'user_id',
			'actor_user_id',
			'booking_id',
			'resource_id',
			'source',
			'issued_at',
			'expires_at',
			'source_fingerprint',
			'rule_fingerprint',
			'appointment_fingerprint',
			'proposal',
		);
		foreach ( $required_keys as $required_key ) {
			if ( ! array_key_exists( $required_key, $plan ) ) {
				return $this->get_invalid_plan_error();
			}
		}

		$issued_at  = absint( $plan['issued_at'] );
		$expires_at = absint( $plan['expires_at'] );
		$site_id    = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;
		$proposal   = $this->request_validator->normalize_proposal( $plan['proposal'] );
		if (
			self::PLAN_VERSION !== absint( $plan['version'] ) ||
			$site_id !== absint( $plan['site_id'] ) ||
			$this->get_current_user_id() !== absint( $plan['user_id'] ) ||
			( function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0 ) !== absint( $plan['actor_user_id'] ) ||
			! $issued_at ||
			$expires_at <= $issued_at ||
			( $expires_at - $issued_at ) > self::REVIEW_LIFETIME ||
			time() > $expires_at ||
			! WPBC_Booking_Inspector_Config::is_allowed_source( sanitize_key( (string) $plan['source'] ) ) ||
			! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['source_fingerprint'] ) ||
			! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['rule_fingerprint'] ) ||
			! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['appointment_fingerprint'] ) ||
			is_wp_error( $proposal )
		) {
			return $this->get_invalid_plan_error();
		}

		if (
			( $expected_booking_id && absint( $expected_booking_id ) !== absint( $plan['booking_id'] ) ) ||
			( $expected_resource_id && absint( $expected_resource_id ) !== absint( $plan['resource_id'] ) ) ||
			( '' !== $expected_source && sanitize_key( $expected_source ) !== sanitize_key( (string) $plan['source'] ) )
		) {
			return $this->get_invalid_plan_error();
		}

		return true;
	}

	/**
	 * Repeat every authoritative review check immediately before persistence.
	 *
	 * Callers must invoke this method while holding the canonical booking
	 * availability guard. The returned context contains only freshly loaded,
	 * authorized values and the canonical allocation result; browser calendar
	 * state is never accepted as mutation authority.
	 *
	 * @param array<string,mixed> $plan                Untrusted signed plan.
	 * @param string              $token               Untrusted plan signature.
	 * @param int                 $expected_booking_id Booking requested by the endpoint.
	 * @param string              $expected_source     Inspector host requested by the endpoint.
	 *
	 * @return array<string,mixed>|WP_Error Fresh authorized apply context or safe error.
	 */
	public function revalidate_plan_for_apply( $plan, $token, $expected_booking_id, $expected_source ) {
		$plan_check = $this->verify_plan( $plan, $token, $expected_booking_id, 0, $expected_source );
		if ( is_wp_error( $plan_check ) ) {
			return $plan_check;
		}
		if ( ! $this->current_user_can_edit() ) {
			return $this->get_unauthorized_error();
		}

		$booking_id            = absint( $plan['booking_id'] );
		$source                = sanitize_key( (string) $plan['source'] );
		$authorization_context = $this->authorization->authorize_booking( $booking_id, $source );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}

		$booking     = $authorization_context['booking'];
		$resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		if ( ! $resource_id || $resource_id !== absint( $plan['resource_id'] ) ) {
			return $this->get_invalid_plan_error();
		}

		$date_rows = $this->date_repository->get_booking_dates( $booking_id, $resource_id );
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}
		$current_source_fingerprint = WPBC_Booking_Date_Editor_Source_Fingerprint::build( $booking, $date_rows );
		if ( ! hash_equals( (string) $plan['source_fingerprint'], $current_source_fingerprint ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_apply_stale',
				__( 'The booking changed after it was reviewed. Reload the dates and review the changes again.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$effective_resource_ids = isset( $authorization_context['effective_resource_ids'] )
			? (array) $authorization_context['effective_resource_ids']
			: array();
		$saved                  = ( new WPBC_Booking_Date_Editor_Read_Service() )->normalize_saved_date_rows( $date_rows, $effective_resource_ids );
		if ( empty( $saved['supported'] ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_apply_unsupported',
				__( 'These saved booking dates must be edited on the Add Booking page.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$proposal = $this->request_validator->normalize_proposal( $plan['proposal'] );
		if ( is_wp_error( $proposal ) ) {
			return $proposal;
		}
		$policy = $this->get_current_selection_policy();
		if ( ! hash_equals( (string) $plan['rule_fingerprint'], $this->build_context_fingerprint( 'rules', $policy ) ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_apply_rules_changed',
				__( 'Booking rules changed after this review. Review the dates again.', 'booking' ),
				array( 'status' => 409 )
			);
		}
		$policy_validation = $this->validate_selection_policy( $proposal, $policy );
		if ( is_wp_error( $policy_validation ) ) {
			return $policy_validation;
		}
		$time_validation = $this->validate_time_application( $proposal );
		if ( is_wp_error( $time_validation ) ) {
			return $time_validation;
		}

		$appointment_snapshot = $this->get_appointment_snapshot( $booking_id );
		if ( ! hash_equals( (string) $plan['appointment_fingerprint'], $this->build_context_fingerprint( 'appointment', $appointment_snapshot ) ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_apply_appointment_changed',
				__( 'The Appointment settings changed after this review. Review the dates again.', 'booking' ),
				array( 'status' => 409 )
			);
		}
		$appointment_validation = $this->validate_appointment_proposal( $proposal, $appointment_snapshot, $resource_id );
		if ( is_wp_error( $appointment_validation ) ) {
			return $appointment_validation;
		}

		$where_to_save = $this->validate_canonical_availability( $booking, $date_rows, $proposal, $appointment_snapshot );
		if ( is_wp_error( $where_to_save ) ) {
			return $where_to_save;
		}

		return array(
			'booking'                    => $booking,
			'date_rows'                  => $date_rows,
			'saved'                      => $saved,
			'proposal'                   => $proposal,
			'resource_id'                => $resource_id,
			'source'                     => $source,
			'source_fingerprint'         => $current_source_fingerprint,
			'where_to_save'              => $where_to_save,
			'appointment_snapshot'       => $appointment_snapshot,
		);
	}

	/**
	 * Validate only policy-owned geometry for policy selection mode.
	 *
	 * @param array<string,mixed> $proposal Normalized proposal.
	 * @param array<string,mixed> $policy   Current canonical Resource policy.
	 *
	 * @return true|WP_Error True when policy geometry passes, or a safe error.
	 */
	private function validate_selection_policy( $proposal, $policy ) {
		if ( 'individual' === $proposal['selection_method'] ) {
			return true;
		}

		$selected_dates = $proposal['selected_dates'];
		$selected_count = count( $selected_dates );
		$mode           = $policy['days_select_mode'];
		if ( 'single' === $mode && 1 !== $selected_count ) {
			return $this->get_policy_error();
		}
		if ( 'multiple' === $mode ) {
			return true;
		}
		if ( ! $this->dates_are_consecutive( $selected_dates ) ) {
			return $this->get_policy_error();
		}

		$start_weekday = (int) gmdate( 'w', strtotime( $selected_dates[0] . ' 12:00:00 UTC' ) );
		if ( 'fixed' === $mode ) {
			if (
				absint( $policy['fixed__days_num'] ) !== $selected_count ||
				! $this->is_weekday_allowed( $start_weekday, $policy['fixed__week_days__start'] )
			) {
				return $this->get_policy_error();
			}

			return true;
		}

		$minimum_length     = max( 1, absint( $policy['dynamic__days_min'] ) );
		$configured_maximum = absint( $policy['dynamic__days_max'] );
		$maximum_length     = 0 === $configured_maximum ? 0 : max( $minimum_length, $configured_maximum );
		$specific_lengths   = $policy['dynamic__days_specific'];
		if (
			$selected_count < $minimum_length ||
			( 0 < $maximum_length && $selected_count > $maximum_length ) ||
			( ! empty( $specific_lengths ) && ! in_array( $selected_count, $specific_lengths, true ) ) ||
			! $this->is_weekday_allowed( $start_weekday, $policy['dynamic__week_days__start'] )
		) {
			return $this->get_policy_error();
		}

		return true;
	}

	/**
	 * Validate exact-minute ordering for the selected time application.
	 *
	 * @param array<string,mixed> $proposal Normalized proposal.
	 *
	 * @return true|WP_Error True when the interval is ordered, or safe error.
	 */
	private function validate_time_application( $proposal ) {
		if ( 'full_day' === $proposal['time_application'] ) {
			return true;
		}

		$start_seconds = $this->time_to_seconds( $proposal['start_time'] );
		$end_seconds   = $this->time_to_seconds( $proposal['end_time'] );
		if ( 'per_date' === $proposal['time_application'] && $end_seconds <= $start_seconds ) {
			return $this->get_time_order_error();
		}

		$first_date = reset( $proposal['selected_dates'] );
		$last_date  = end( $proposal['selected_dates'] );
		if ( 'boundary' === $proposal['time_application'] ) {
			$start = strtotime( $first_date . ' ' . $proposal['start_time'] . ':00 UTC' );
			$end   = strtotime( $last_date . ' ' . $proposal['end_time'] . ':00 UTC' );
			if ( false === $start || false === $end || $end <= $start ) {
				return $this->get_time_order_error();
			}
		}

		return true;
	}

	/**
	 * Validate Appointment duration, mode, Provider, Working Time, and buffers.
	 *
	 * @param array<string,mixed>      $proposal             Normalized proposal.
	 * @param array<string,mixed>|null $appointment_snapshot Immutable Appointment snapshot when present.
	 * @param int                      $resource_id           Authorized Resource ID.
	 *
	 * @return true|WP_Error True for a valid/non-Appointment proposal, or safe error.
	 */
	private function validate_appointment_proposal( $proposal, $appointment_snapshot, $resource_id ) {
		if ( empty( $appointment_snapshot ) ) {
			return true;
		}
		if (
			'per_date' !== $proposal['time_application'] ||
			absint( $appointment_snapshot['resource_id'] ) !== absint( $resource_id )
		) {
			return new WP_Error(
				'wpbc_booking_date_editor_appointment_mode_invalid',
				__( 'Appointment bookings require the same timed Service interval on every selected date.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$duration_minutes = ( $this->time_to_seconds( $proposal['end_time'] ) - $this->time_to_seconds( $proposal['start_time'] ) ) / 60;
		if ( absint( $appointment_snapshot['duration_minutes'] ) !== (int) $duration_minutes ) {
			return new WP_Error(
				'wpbc_booking_date_editor_appointment_duration_invalid',
				__( 'The selected Appointment interval must keep the saved Service duration.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		return true;
	}

	/**
	 * Run the canonical non-mutating save-time availability checks.
	 *
	 * @param array<string,mixed>            $booking              Authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows            Canonical saved date rows.
	 * @param array<string,mixed>            $proposal             Normalized proposal.
	 * @param array<string,mixed>|null       $appointment_snapshot Immutable Appointment snapshot when present.
	 *
	 * @return array<string,mixed>|WP_Error Canonical destination or safe error.
	 */
	private function validate_canonical_availability( $booking, $date_rows, $proposal, $appointment_snapshot ) {
		if ( ! function_exists( 'wpbc__where_to_save_booking' ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_review_unavailable',
				__( 'The proposed booking dates could not be reviewed. Reload the page and try again.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		$time_seconds = 'full_day' === $proposal['time_application']
			? array( 0, 24 * 60 * 60 )
			: array( $this->time_to_seconds( $proposal['start_time'] ), $this->time_to_seconds( $proposal['end_time'] ) );
		$where_to_save = wpbc__where_to_save_booking(
			array(
				'resource_id'                   => absint( $booking['booking_type'] ),
				'skip_booking_id'               => absint( $booking['booking_id'] ),
				'dates_only_sql_arr'            => $proposal['selected_dates'],
				'time_as_seconds_arr'           => $time_seconds,
				'how_many_items_to_book'        => $this->get_booking_quantity( $date_rows ),
				'request_uri'                   => '',
				'allow_past'                    => true,
				'is_use_booking_recurrent_time' => 'per_date' === $proposal['time_application'],
				'time_override_source'          => '',
				'as_single_resource'            => false,
				'aggregate_resource_id_arr'     => array(),
				'aggregate_type'                => 'all',
				'custom_form'                   => $this->get_custom_form_key( $booking ),
			)
		);
		if ( ! is_array( $where_to_save ) || 'ok' !== ( isset( $where_to_save['result'] ) ? $where_to_save['result'] : '' ) ) {
			$message = is_array( $where_to_save ) && isset( $where_to_save['message'] )
				? wp_strip_all_tags( (string) $where_to_save['message'] )
				: __( 'The selected dates or times are unavailable. Choose another selection and try again.', 'booking' );

			return new WP_Error( 'wpbc_booking_date_editor_dates_unavailable', $message, array( 'status' => 409 ) );
		}

		if ( ! empty( $appointment_snapshot ) && function_exists( 'wpbc_appointment_services_check_working_time' ) ) {
			$working_time_check = wpbc_appointment_services_check_working_time(
				$appointment_snapshot,
				absint( $where_to_save['main__resource_id'] ),
				array_keys( $where_to_save['resources_in_dates'] ),
				$time_seconds
			);
			if ( is_wp_error( $working_time_check ) ) {
				return $working_time_check;
			}
		}
		if ( ! empty( $appointment_snapshot ) && function_exists( 'wpbc_appointment_services_check_buffer_conflicts' ) ) {
			$buffer_check = wpbc_appointment_services_check_buffer_conflicts(
				$appointment_snapshot,
				absint( $where_to_save['main__resource_id'] ),
				array_keys( $where_to_save['resources_in_dates'] ),
				$time_seconds,
				absint( $booking['booking_id'] )
			);
			if ( is_wp_error( $buffer_check ) ) {
				return $buffer_check;
			}
		}

		return $where_to_save;
	}

	/**
	 * Return the canonical current global date-selection policy.
	 *
	 * @return array<string,mixed> Bounded policy values used by server review.
	 */
	private function get_current_selection_policy() {
		$policy = function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' )
			? wpbc__calendar__js_params__get_days_selection_arr()
			: array();
		$mode   = isset( $policy['days_select_mode'] ) ? sanitize_key( (string) $policy['days_select_mode'] ) : 'multiple';
		if ( ! in_array( $mode, array( 'single', 'multiple', 'fixed', 'dynamic' ), true ) ) {
			$mode = 'multiple';
		}

		return array(
			'days_select_mode'             => $mode,
			'fixed__days_num'              => max( 1, min( 180, isset( $policy['fixed__days_num'] ) ? absint( $policy['fixed__days_num'] ) : 1 ) ),
			'fixed__week_days__start'      => $this->normalize_integer_list( isset( $policy['fixed__week_days__start'] ) ? $policy['fixed__week_days__start'] : '-1', -1, 6 ),
			'dynamic__days_min'            => max( 1, isset( $policy['dynamic__days_min'] ) ? absint( $policy['dynamic__days_min'] ) : 1 ),
			'dynamic__days_max'            => isset( $policy['dynamic__days_max'] ) ? absint( $policy['dynamic__days_max'] ) : 0,
			'dynamic__days_specific'       => $this->normalize_integer_list( isset( $policy['dynamic__days_specific'] ) ? $policy['dynamic__days_specific'] : '', 1, 1095 ),
			'dynamic__week_days__start'    => $this->normalize_integer_list( isset( $policy['dynamic__week_days__start'] ) ? $policy['dynamic__week_days__start'] : '-1', -1, 6 ),
		);
	}

	/**
	 * Build the data-only review presentation contract.
	 *
	 * @param int                 $booking_id Authorized booking ID.
	 * @param array<string,mixed> $saved      Canonical saved projection.
	 * @param array<string,mixed> $proposal   Normalized proposed projection.
	 *
	 * @return array<string,mixed> Bounded before/after values, canonical change flags, and warnings.
	 */
	private function build_review_dto( $booking_id, $saved, $proposal ) {
		$saved_time_signature = array(
			$saved['time_application'],
			'full_day' === $saved['time_application'] ? '' : $saved['start_time'],
			'full_day' === $saved['time_application'] ? '' : $saved['end_time'],
		);
		$proposal_time_signature = array(
			$proposal['time_application'],
			'full_day' === $proposal['time_application'] ? '' : $proposal['start_time'],
			'full_day' === $proposal['time_application'] ? '' : $proposal['end_time'],
		);
		$warnings = array();
		if ( 'individual' === $proposal['selection_method'] ) {
			$warnings[] = __( 'Individual selection overrides only range length, range geometry, and permitted start weekdays. All other booking rules were checked.', 'booking' );
		}
		$warnings = array_slice( array_values( array_unique( $warnings ) ), 0, self::MAX_WARNINGS );

		return array(
			'booking_id' => absint( $booking_id ),
			'fields'     => array(
				array(
					'key'     => 'selection_method',
					'label'   => __( 'Selection method', 'booking' ),
					'before'  => $this->get_selection_method_label( $saved['selection_method'] ),
					'after'   => $this->get_selection_method_label( $proposal['selection_method'] ),
					'changed' => $saved['selection_method'] !== $proposal['selection_method'],
				),
				array(
					'key'          => 'selected_dates',
					'label'        => __( 'Selected dates', 'booking' ),
					'before'       => implode( ', ', $saved['selected_dates'] ),
					'after'        => implode( ', ', $proposal['selected_dates'] ),
					'before_parts' => $this->build_selected_date_before_parts(
						$saved['selected_dates'],
						$proposal['selected_dates']
					),
					'after_parts'  => $this->build_selected_date_after_parts(
						$saved['selected_dates'],
						$proposal['selected_dates']
					),
					'changed'      => $saved['selected_dates'] !== $proposal['selected_dates'],
				),
				array(
					'key'          => 'time_application',
					'label'        => __( 'Apply times as', 'booking' ),
					'before'       => $this->get_time_application_label( $saved ),
					'after'        => $this->get_time_application_label( $proposal ),
					'before_parts' => $this->build_time_application_before_parts( $saved, $proposal ),
					'after_parts'  => $this->build_time_application_after_parts( $saved, $proposal ),
					'changed'      => $saved_time_signature !== $proposal_time_signature,
				),
			),
			'warnings'   => $warnings,
		);
	}

	/**
	 * Build saved date parts with only removed dates marked as changed.
	 *
	 * @param array<int,string> $saved_dates    Canonical saved ISO dates.
	 * @param array<int,string> $proposed_dates Canonical proposed ISO dates.
	 *
	 * @return array<int,array<string,mixed>> Ordered text parts with change state.
	 */
	private function build_selected_date_before_parts( $saved_dates, $proposed_dates ) {
		return $this->build_selected_date_parts( $saved_dates, $proposed_dates );
	}

	/**
	 * Build proposed date parts with only newly selected dates marked as changed.
	 *
	 * The complete formatted value remains in the DTO for compatibility. These
	 * parts let the domain template emphasize individual additions without
	 * comparing or parsing presentation strings in the browser.
	 *
	 * @param array<int,string> $saved_dates    Canonical saved ISO dates.
	 * @param array<int,string> $proposed_dates Canonical proposed ISO dates.
	 *
	 * @return array<int,array<string,mixed>> Ordered text parts with change state.
	 */
	private function build_selected_date_after_parts( $saved_dates, $proposed_dates ) {
		return $this->build_selected_date_parts( $proposed_dates, $saved_dates );
	}

	/**
	 * Build ordered date parts against the dates present on the opposite side.
	 *
	 * The comparison is performed on canonical ISO dates before presentation so
	 * the browser template never needs to parse localized or joined strings.
	 *
	 * @param array<int,string> $display_dates    Dates to render on this side.
	 * @param array<int,string> $comparison_dates Dates present on the opposite side.
	 *
	 * @return array<int,array<string,mixed>> Ordered text parts with change state.
	 */
	private function build_selected_date_parts( $display_dates, $comparison_dates ) {
		$comparison_date_lookup = array_fill_keys( $comparison_dates, true );
		$date_parts             = array();

		foreach ( $display_dates as $date_index => $display_date ) {
			if ( 0 < $date_index ) {
				$date_parts[] = array(
					'role'    => 'separator',
					'text'    => ', ',
					'changed' => false,
				);
			}

			$date_parts[] = array(
				'role'    => 'date',
				'text'    => $display_date,
				'changed' => ! isset( $comparison_date_lookup[ $display_date ] ),
			);
		}

		return $date_parts;
	}

	/**
	 * Build saved time parts with exact component-level change state.
	 *
	 * @param array<string,mixed> $saved    Canonical saved time projection.
	 * @param array<string,mixed> $proposal Canonical proposed time projection.
	 *
	 * @return array<int,array<string,mixed>> Ordered translated text parts.
	 */
	private function build_time_application_before_parts( $saved, $proposal ) {
		return $this->build_time_application_parts( $saved, $proposal );
	}

	/**
	 * Build proposed time parts with exact component-level change state.
	 *
	 * Placeholder tokens are inserted after translation so translated argument
	 * order and punctuation remain intact while mode, Start, and End can still
	 * be styled independently by the domain template.
	 *
	 * @param array<string,mixed> $saved    Canonical saved time projection.
	 * @param array<string,mixed> $proposal Canonical proposed time projection.
	 *
	 * @return array<int,array<string,mixed>> Ordered translated text parts.
	 */
	private function build_time_application_after_parts( $saved, $proposal ) {
		return $this->build_time_application_parts( $proposal, $saved );
	}

	/**
	 * Build one side of the time comparison from canonical components.
	 *
	 * Placeholder tokens preserve translated argument order and punctuation while
	 * allowing the template to emphasize only the changed mode or exact boundary.
	 *
	 * @param array<string,mixed> $selection  Canonical time projection to render.
	 * @param array<string,mixed> $comparison Canonical projection on the opposite side.
	 *
	 * @return array<int,array<string,mixed>> Ordered translated text parts.
	 */
	private function build_time_application_parts( $selection, $comparison ) {
		if ( 'full_day' === $selection['time_application'] ) {
			return array(
				array(
					'role'    => 'time_application',
					'text'    => __( 'Full days', 'booking' ),
					'changed' => 'full_day' !== $comparison['time_application'],
				),
			);
		}

		$part_tokens = array(
			'{{WPBC_TIME_APPLICATION}}' => array(
				'role'    => 'time_application',
				'text'    => $this->get_time_application_mode_label( $selection['time_application'] ),
				'changed' => $comparison['time_application'] !== $selection['time_application'],
			),
			'{{WPBC_START_TIME}}'       => array(
				'role'    => 'start_time',
				'text'    => $selection['start_time'],
				'changed' => 'full_day' === $comparison['time_application'] || $comparison['start_time'] !== $selection['start_time'],
			),
			'{{WPBC_END_TIME}}'         => array(
				'role'    => 'end_time',
				'text'    => $selection['end_time'],
				'changed' => 'full_day' === $comparison['time_application'] || $comparison['end_time'] !== $selection['end_time'],
			),
		);
		$tokenized_label = sprintf(
			/* translators: 1: time application, 2: exact start time, 3: exact end time. */
			__( '%1$s: %2$s - %3$s', 'booking' ),
			'{{WPBC_TIME_APPLICATION}}',
			'{{WPBC_START_TIME}}',
			'{{WPBC_END_TIME}}'
		);
		$tokenized_parts = preg_split(
			'/(\{\{WPBC_(?:TIME_APPLICATION|START_TIME|END_TIME)\}\})/',
			$tokenized_label,
			-1,
			PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY
		);
		$time_parts = array();

		foreach ( is_array( $tokenized_parts ) ? $tokenized_parts : array() as $tokenized_part ) {
			$time_parts[] = isset( $part_tokens[ $tokenized_part ] )
				? $part_tokens[ $tokenized_part ]
				: array(
					'role'    => 'separator',
					'text'    => $tokenized_part,
					'changed' => false,
				);
		}

		return $time_parts;
	}

	/**
	 * Return a translated selection-method label.
	 *
	 * @param string $selection_method Normalized method.
	 *
	 * @return string Presentation label.
	 */
	private function get_selection_method_label( $selection_method ) {
		return 'individual' === $selection_method
			? __( 'Select dates individually', 'booking' )
			: __( 'Use current booking rules', 'booking' );
	}

	/**
	 * Return one translated time-application label with exact minutes.
	 *
	 * @param array<string,mixed> $selection Normalized saved or proposed selection.
	 *
	 * @return string Presentation label.
	 */
	private function get_time_application_label( $selection ) {
		if ( 'full_day' === $selection['time_application'] ) {
			return __( 'Full days', 'booking' );
		}

		return sprintf(
			/* translators: 1: time application, 2: exact start time, 3: exact end time. */
			__( '%1$s: %2$s - %3$s', 'booking' ),
			$this->get_time_application_mode_label( $selection['time_application'] ),
			$selection['start_time'],
			$selection['end_time']
		);
	}

	/**
	 * Return a translated timed-application mode label without its boundaries.
	 *
	 * @param string $time_application Normalized boundary or per-date mode.
	 *
	 * @return string Presentation label.
	 */
	private function get_time_application_mode_label( $time_application ) {
		return 'per_date' === $time_application
			? __( 'Use the same time slot on every selected date', 'booking' )
			: __( 'Start on the first date and end on the last date', 'booking' );
	}

	/**
	 * Resolve the saved Appointment snapshot without changing it.
	 *
	 * @param int $booking_id Authorized booking ID.
	 *
	 * @return array<string,mixed>|null Snapshot or null for non-Appointment bookings.
	 */
	private function get_appointment_snapshot( $booking_id ) {
		if ( ! function_exists( 'wpbc_appointment_services_repository' ) ) {
			return null;
		}
		$repository = wpbc_appointment_services_repository();

		return is_object( $repository ) && method_exists( $repository, 'get_appointment_snapshot' )
			? $repository->get_appointment_snapshot( absint( $booking_id ) )
			: null;
	}

	/**
	 * Calculate current capacity quantity from canonical allocated rows.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Canonical booking-date rows.
	 *
	 * @return int Positive quantity preserved by availability review.
	 */
	private function get_booking_quantity( $date_rows ) {
		$resources_by_date = array();
		foreach ( (array) $date_rows as $date_row ) {
			if ( ! is_array( $date_row ) || empty( $date_row['booking_date'] ) ) {
				continue;
			}
			$date_key    = substr( (string) $date_row['booking_date'], 0, 10 );
			$resource_id = isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
			if ( $resource_id ) {
				$resources_by_date[ $date_key ][ $resource_id ] = true;
			}
		}

		$quantity = 1;
		foreach ( $resources_by_date as $resource_ids ) {
			$quantity = max( $quantity, count( $resource_ids ) );
		}

		return $quantity;
	}

	/**
	 * Resolve the stored custom form used by canonical availability checks.
	 *
	 * @param array<string,mixed> $booking Authorized booking.
	 *
	 * @return string Bounded form key or `standard`.
	 */
	private function get_custom_form_key( $booking ) {
		$form_key = '';
		if ( class_exists( 'WPBC_Booking_Inspector_Form_Snapshot_Builder' ) ) {
			$form_key = ( new WPBC_Booking_Inspector_Form_Snapshot_Builder() )->get_stored_form_key(
				isset( $booking['form'] ) ? (string) $booking['form'] : '',
				isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0
			);
		}
		$form_key = sanitize_text_field( (string) $form_key );

		return '' === $form_key ? 'standard' : substr( $form_key, 0, 191 );
	}

	/**
	 * Determine whether ordered dates are consecutive calendar days.
	 *
	 * @param array<int,string> $selected_dates Ordered strict ISO dates.
	 *
	 * @return bool True when the dates contain no gap.
	 */
	private function dates_are_consecutive( $selected_dates ) {
		for ( $date_index = 1; $date_index < count( $selected_dates ); $date_index++ ) {
			$previous_date = DateTimeImmutable::createFromFormat( '!Y-m-d', $selected_dates[ $date_index - 1 ], new DateTimeZone( 'UTC' ) );
			$current_date  = DateTimeImmutable::createFromFormat( '!Y-m-d', $selected_dates[ $date_index ], new DateTimeZone( 'UTC' ) );
			if ( ! $previous_date || ! $current_date || 1 !== (int) $previous_date->diff( $current_date )->format( '%r%a' ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check one native weekday against its configured allow list.
	 *
	 * @param int            $weekday         Native Sunday-zero weekday.
	 * @param array<int,int> $allowed_weekdays Configured weekdays including `-1` for any.
	 *
	 * @return bool True when the weekday is permitted.
	 */
	private function is_weekday_allowed( $weekday, $allowed_weekdays ) {
		return in_array( -1, $allowed_weekdays, true ) || in_array( (int) $weekday, $allowed_weekdays, true );
	}

	/**
	 * Normalize one legacy comma-separated integer list.
	 *
	 * @param mixed $list_value Candidate list.
	 * @param int   $minimum    Lowest accepted integer.
	 * @param int   $maximum    Highest accepted integer.
	 *
	 * @return array<int,int> Ordered unique bounded integers.
	 */
	private function normalize_integer_list( $list_value, $minimum, $maximum ) {
		$list_values = is_array( $list_value ) ? $list_value : explode( ',', (string) $list_value );
		$normalized  = array();
		foreach ( $list_values as $list_entry ) {
			if ( ! is_scalar( $list_entry ) || ! preg_match( '/^-?\d+$/', trim( (string) $list_entry ) ) ) {
				continue;
			}
			$list_entry = (int) $list_entry;
			if ( $list_entry >= $minimum && $list_entry <= $maximum ) {
				$normalized[ $list_entry ] = $list_entry;
			}
		}

		return array_values( $normalized );
	}

	/**
	 * Convert a normalized exact-minute time to seconds after midnight.
	 *
	 * @param string $time_value Strict `HH:MM` value.
	 *
	 * @return int Seconds after midnight.
	 */
	private function time_to_seconds( $time_value ) {
		$time_parts = array_map( 'intval', explode( ':', (string) $time_value ) );

		return ( $time_parts[0] * 60 * 60 ) + ( $time_parts[1] * 60 );
	}

	/**
	 * Build a non-reversible fingerprint for authoritative review context.
	 *
	 * @param string $context_name Stable context namespace.
	 * @param mixed  $context      JSON-safe authoritative values.
	 *
	 * @return string Lowercase hexadecimal HMAC fingerprint.
	 */
	private function build_context_fingerprint( $context_name, $context ) {
		$context_json = wp_json_encode( $context );

		return hash_hmac(
			'sha256',
			'wpbc_booking_date_editor_' . sanitize_key( $context_name ) . ':v1:' . ( is_string( $context_json ) ? $context_json : '' ),
			wp_salt( 'nonce' )
		);
	}

	/**
	 * Sign one complete review plan.
	 *
	 * @param array<string,mixed> $plan Complete review plan.
	 *
	 * @return string Lowercase hexadecimal HMAC signature.
	 */
	private function sign_plan( $plan ) {
		$plan_json = wp_json_encode( $plan );

		return hash_hmac(
			'sha256',
			'wpbc_booking_date_editor_review:v1:' . ( is_string( $plan_json ) ? $plan_json : '' ),
			wp_salt( 'nonce' )
		);
	}

	/**
	 * Resolve the current effective user ID.
	 *
	 * @return int Current effective user ID.
	 */
	private function get_current_user_id() {
		return function_exists( 'wpbc_get_current_user_id' )
			? absint( wpbc_get_current_user_id() )
			: ( function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0 );
	}

	/**
	 * Determine whether the current user may edit bookings.
	 *
	 * @return bool True when date review is permitted.
	 */
	private function current_user_can_edit() {
		return function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( 'edit_booking', $this->get_current_user_id() );
	}

	/**
	 * Return the uniform edit-capability error.
	 *
	 * @return WP_Error Safe authorization error.
	 */
	private function get_unauthorized_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_unauthorized',
			__( 'Booking dates are unavailable for this account.', 'booking' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Return the uniform current-policy failure.
	 *
	 * @return WP_Error Safe policy error.
	 */
	private function get_policy_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_policy_invalid',
			__( 'The selected dates do not match the current booking rules. Adjust the range or select dates individually.', 'booking' ),
			array( 'status' => 409 )
		);
	}

	/**
	 * Return the uniform invalid time-order error.
	 *
	 * @return WP_Error Safe time error.
	 */
	private function get_time_order_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_time_order_invalid',
			__( 'The End time must be later than the Start time for the selected time mode.', 'booking' ),
			array( 'status' => 409 )
		);
	}

	/**
	 * Return the uniform signed-plan verification error.
	 *
	 * @return WP_Error Safe signed-plan error.
	 */
	private function get_invalid_plan_error() {
		return new WP_Error(
			'wpbc_booking_date_editor_review_token_invalid',
			__( 'The reviewed booking dates could not be verified. Review the changes again.', 'booking' ),
			array( 'status' => 409 )
		);
	}
}
