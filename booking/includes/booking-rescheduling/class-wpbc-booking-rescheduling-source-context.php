<?php
/**
 * Booking Rescheduling opaque signed source context.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Issue and verify short-lived tokens bound to canonical saved booking state.
 */
final class WPBC_Booking_Rescheduling_Source_Context {

	/** Source-context lifetime in seconds. */
	const LIFETIME = 1800;

	/**
	 * Issue one opaque signed token after booking authorization.
	 *
	 * @param array<string,mixed>            $booking                Authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows              Canonical date rows.
	 * @param string                         $source                 Allow-listed host source.
	 * @param array<int,int>                 $effective_resource_ids Server-resolved Resource IDs.
	 * @param array<string,mixed>            $interaction_context    Optional server-derived interaction binding.
	 *
	 * @return string Opaque signed source token.
	 */
	public function issue( $booking, $date_rows, $source, $effective_resource_ids, $interaction_context = array() ) {
		$issued_at  = time();
		$expires_at = $issued_at + self::LIFETIME;
		$signature  = $this->sign( $booking, $date_rows, $source, $effective_resource_ids, $issued_at, $expires_at, $interaction_context );

		return 'v1.' . $issued_at . '.' . $expires_at . '.' . $signature;
	}

	/**
	 * Verify one token against freshly loaded canonical state.
	 *
	 * @param mixed                           $token                  Untrusted opaque token.
	 * @param array<string,mixed>             $booking                Fresh authorized booking.
	 * @param array<int,array<string,mixed>>  $date_rows              Fresh canonical date rows.
	 * @param string                          $source                 Current host source.
	 * @param array<int,int>                  $effective_resource_ids Fresh server-resolved Resource IDs.
	 * @param array<string,mixed>             $interaction_context    Optional reconstructed interaction binding.
	 *
	 * @return true|WP_Error True when current and unexpired, otherwise safe stale error.
	 */
	public function verify( $token, $booking, $date_rows, $source, $effective_resource_ids, $interaction_context = array() ) {
		$token = is_scalar( $token ) ? trim( (string) $token ) : '';
		if ( ! preg_match( '/^v1\.([1-9]\d*)\.([1-9]\d*)\.([a-f0-9]{64})$/', $token, $matches ) ) {
			return $this->get_stale_error();
		}

		$issued_at  = absint( $matches[1] );
		$expires_at = absint( $matches[2] );
		if ( ! $issued_at || $expires_at <= $issued_at || ( $expires_at - $issued_at ) > self::LIFETIME || time() > $expires_at ) {
			return $this->get_stale_error();
		}

		$expected = $this->sign( $booking, $date_rows, $source, $effective_resource_ids, $issued_at, $expires_at, $interaction_context );

		return hash_equals( $expected, $matches[3] ) ? true : $this->get_stale_error();
	}

	/**
	 * Sign authoritative state without serializing that state into the token.
	 *
	 * @param array<string,mixed>            $booking                Authorized booking.
	 * @param array<int,array<string,mixed>> $date_rows              Canonical date rows.
	 * @param string                         $source                 Host source.
	 * @param array<int,int>                 $effective_resource_ids Effective Resource IDs.
	 * @param int                            $issued_at              Issued Unix time.
	 * @param int                            $expires_at             Expiry Unix time.
	 * @param array<string,mixed>            $interaction_context    Optional server-derived interaction binding.
	 *
	 * @return string Lowercase hexadecimal HMAC.
	 */
	private function sign( $booking, $date_rows, $source, $effective_resource_ids, $issued_at, $expires_at, $interaction_context ) {
		$effective_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		sort( $effective_resource_ids, SORT_NUMERIC );
		$repository           = new WPBC_Booking_Rescheduling_Repository();
		$appointment_snapshot = $repository->get_appointment_snapshot( isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0 );
		$shape_context        = ( new WPBC_Booking_Rescheduling_Shape_Classifier() )->classify( $date_rows, $effective_resource_ids, $appointment_snapshot );
		$shape_id             = is_wp_error( $shape_context ) ? 'unsupported' : sanitize_key( $shape_context['shape'] );
		$resource_hierarchy   = $this->get_resource_hierarchy_snapshot( $repository, $booking, $effective_resource_ids );
		$policy_context       = function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' )
			? wpbc__calendar__js_params__get_days_selection_arr()
			: array();
		$effective_user_id    = function_exists( 'wpbc_get_current_user_id' )
			? absint( wpbc_get_current_user_id() )
			: ( function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0 );
		$payload = array(
			'version'                => 1,
			'site_id'                => function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0,
			'user_id'                => function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0,
			'effective_user_id'      => $effective_user_id,
			'source'                 => sanitize_key( $source ),
			'booking_id'             => isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0,
			'effective_resource_ids' => $effective_resource_ids,
			'resource_hierarchy'      => $resource_hierarchy,
			'quantity'                => $repository->get_booking_quantity( $date_rows ),
			'saved_shape'             => $shape_id,
			'custom_form'             => $repository->get_custom_form_key( $booking ),
			'policy'                  => $policy_context,
			'appointment'             => $appointment_snapshot,
			'edition'                 => array(
				'personal'       => class_exists( 'wpdev_bk_personal' ),
				'business_small' => class_exists( 'wpdev_bk_biz_s' ),
				'business_large' => class_exists( 'wpdev_bk_biz_l' ),
				'multiuser'      => class_exists( 'wpdev_bk_multiuser' ),
			),
			'capabilities'            => array(
				'edit_booking'            => function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( 'edit_booking', $effective_user_id ),
				'change_booking_resource' => function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( 'change_booking_resource', $effective_user_id ),
			),
			'preserved_booking_state' => array(
				'hash'           => isset( $booking['hash'] ) ? (string) $booking['hash'] : '',
				'cost'           => isset( $booking['cost'] ) ? (string) $booking['cost'] : '',
				'pay_status'     => isset( $booking['pay_status'] ) ? (string) $booking['pay_status'] : '',
				'pay_request'    => isset( $booking['pay_request'] ) ? (string) $booking['pay_request'] : '',
				'status'         => isset( $booking['status'] ) ? (string) $booking['status'] : '',
				'form'           => isset( $booking['form'] ) ? (string) $booking['form'] : '',
				'booking_options' => isset( $booking['booking_options'] ) ? (string) $booking['booking_options'] : '',
			),
			'source_fingerprint'     => WPBC_Booking_Date_Editor_Source_Fingerprint::build( $booking, $date_rows ),
			'interaction_context'    => $this->normalize_interaction_context( $interaction_context ),
			'issued_at'              => absint( $issued_at ),
			'expires_at'             => absint( $expires_at ),
		);

		return hash_hmac( 'sha256', 'wpbc_booking_rescheduling_source:v1:' . wp_json_encode( $payload ), wp_salt( 'nonce' ) );
	}

	/**
	 * Normalize the only interaction fields permitted in a source-token binding.
	 *
	 * @param array<string,mixed> $interaction_context Server-derived interaction context.
	 *
	 * @return array<string,mixed> Stable executable-free token payload.
	 */
	private function normalize_interaction_context( $interaction_context ) {
		if ( ! is_array( $interaction_context ) || empty( $interaction_context ) ) {
			return array();
		}

		$immutable_interval = isset( $interaction_context['immutable_interval'] ) && is_array( $interaction_context['immutable_interval'] )
			? $interaction_context['immutable_interval']
			: array();

		return array(
			'interaction_source'       => isset( $interaction_context['interaction_source'] ) ? sanitize_key( $interaction_context['interaction_source'] ) : '',
			'saved_shape'              => isset( $interaction_context['saved_shape'] ) ? sanitize_key( $interaction_context['saved_shape'] ) : '',
			'resize_scope'             => isset( $interaction_context['resize_scope'] ) ? sanitize_key( $interaction_context['resize_scope'] ) : '',
			'movement_scope'           => isset( $interaction_context['movement_scope'] ) ? sanitize_key( $interaction_context['movement_scope'] ) : '',
			'selection_method'         => isset( $interaction_context['selection_method'] ) ? sanitize_key( $interaction_context['selection_method'] ) : '',
			'proposal_revision'        => isset( $interaction_context['proposal_revision'] ) ? absint( $interaction_context['proposal_revision'] ) : 0,
			'same_resource_available'  => ! empty( $interaction_context['same_resource_available'] ),
			'cross_resource_available' => ! empty( $interaction_context['cross_resource_available'] ),
			'immutable_interval'       => array(
				'start' => isset( $immutable_interval['start'] ) ? sanitize_text_field( (string) $immutable_interval['start'] ) : '',
				'end'   => isset( $immutable_interval['end'] ) ? sanitize_text_field( (string) $immutable_interval['end'] ) : '',
			),
		);
	}

	/**
	 * Build the canonical hierarchy snapshot that affects resize eligibility.
	 *
	 * The opaque token must become stale if an exact parent or child allocation
	 * changes hierarchy. Only server-derived identifiers and relationship flags
	 * participate; the snapshot is never returned separately.
	 *
	 * @param WPBC_Booking_Rescheduling_Repository $repository            Canonical repository.
	 * @param array<string,mixed>                  $booking               Fresh authorized booking.
	 * @param array<int,int>                       $effective_resource_ids Effective Resource IDs.
	 *
	 * @return array<int,array<string,mixed>> Ordered hierarchy snapshot.
	 */
	private function get_resource_hierarchy_snapshot( $repository, $booking, $effective_resource_ids ) {
		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		if ( ! empty( $booking['booking_type'] ) ) {
			$resource_ids[] = absint( $booking['booking_type'] );
		}
		$resource_ids = array_values( array_unique( array_filter( $resource_ids ) ) );
		sort( $resource_ids, SORT_NUMERIC );

		$hierarchy_snapshot = array();
		foreach ( $resource_ids as $resource_id ) {
			$hierarchy_context   = $repository->get_resource_hierarchy_context( $resource_id );
			$hierarchy_snapshot[] = array(
				'resource_id' => $resource_id,
				'parent_id'   => isset( $hierarchy_context['parent_id'] ) ? absint( $hierarchy_context['parent_id'] ) : 0,
				'child_count' => isset( $hierarchy_context['child_count'] ) ? absint( $hierarchy_context['child_count'] ) : 0,
				'is_parent'   => ! empty( $hierarchy_context['is_parent'] ),
				'is_child'    => ! empty( $hierarchy_context['is_child'] ),
			);
		}

		return $hierarchy_snapshot;
	}

	/**
	 * Return one data-free stale-source error.
	 *
	 * @return WP_Error Safe stale error.
	 */
	private function get_stale_error() {
		return new WP_Error(
			'wpbc_booking_rescheduling_source_stale',
			__( 'The booking changed after it was opened. Reload the booking and try again.', 'booking' ),
			array( 'status' => 409 )
		);
	}
}
