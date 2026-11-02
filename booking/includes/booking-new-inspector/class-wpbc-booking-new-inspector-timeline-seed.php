<?php
/**
 * Signed Timeline schedule seed for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Verifies presentation-only Timeline context and projects an initial schedule.
 */
final class WPBC_Booking_New_Inspector_Timeline_Seed {

	/** @var object|null Signed Timeline handoff verifier. */
	private $handoff;

	/**
	 * Construct the seed service.
	 *
	 * @param object|null $handoff Optional object exposing verify_token().
	 */
	public function __construct( $handoff = null ) {
		$this->handoff = $handoff;
	}

	/**
	 * Resolve a verified Timeline seed or a neutral empty schedule.
	 *
	 * @param array<string,mixed> $request Validated bootstrap request.
	 * @return array<string,mixed>|WP_Error Internal seed context or a safe token error.
	 */
	public function resolve( $request ) {
		$selection_source = isset( $request['selection_source'] ) ? sanitize_key( $request['selection_source'] ) : 'empty';
		$token            = isset( $request['source_context_token'] ) ? (string) $request['source_context_token'] : '';
		if ( 'timeline' !== $selection_source ) {
			if ( '' !== $token ) {
				return $this->get_invalid_error();
			}

			return array(
				'resource_id'         => 0,
				'form_id'             => '',
				'service_id'          => 0,
				'email_intent'        => 'canonical_default',
				'source_context_token' => '',
				'schedule'            => $this->get_empty_schedule(),
			);
		}

		if ( '' === $token ) {
			return $this->get_invalid_error();
		}
		$handoff = $this->get_handoff();
		if ( ! is_object( $handoff ) || ! method_exists( $handoff, 'verify_token' ) ) {
			return $this->get_invalid_error();
		}

		$payload = $handoff->verify_token( $token, 'booking_handoff' );
		if ( is_wp_error( $payload ) || ! is_array( $payload ) ) {
			return $this->get_invalid_error();
		}

		$schedule = $this->build_schedule( $payload );
		if ( is_wp_error( $schedule ) ) {
			return $schedule;
		}

		return array(
			'resource_id'          => isset( $payload['resource_id'] ) ? absint( $payload['resource_id'] ) : 0,
			'form_id'              => isset( $payload['booking_form'] ) ? substr( sanitize_text_field( (string) $payload['booking_form'] ), 0, 191 ) : '',
			'service_id'           => isset( $payload['service_id'] ) ? absint( $payload['service_id'] ) : 0,
			'email_intent'         => isset( $payload['email_intent'] ) && in_array( $payload['email_intent'], array( 'send', 'do_not_send' ), true ) ? $payload['email_intent'] : 'canonical_default',
			'source_context_token' => $token,
			'schedule'             => $schedule,
		);
	}

	/**
	 * Lazily create the released Timeline verifier after the complete plugin loads.
	 *
	 * @return object|null Handoff verifier or null when Timeline is unavailable.
	 */
	private function get_handoff() {
		if ( null === $this->handoff && class_exists( 'WPBC_Timeline_Handoff' ) ) {
			$this->handoff = new WPBC_Timeline_Handoff();
		}

		return $this->handoff;
	}

	/**
	 * Build the exact bounded initial schedule from verified handoff instants.
	 *
	 * @param array<string,mixed> $payload Verified Timeline payload.
	 * @return array<string,mixed>|WP_Error Schedule DTO or a safe token error.
	 */
	private function build_schedule( $payload ) {
		if ( empty( $payload['resource_id'] ) || empty( $payload['start_at'] ) || empty( $payload['end_at'] ) ) {
			return $this->get_invalid_error();
		}

		try {
			$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
			$start    = ( new DateTimeImmutable( (string) $payload['start_at'] ) )->setTimezone( $timezone );
			$end      = ( new DateTimeImmutable( (string) $payload['end_at'] ) )->setTimezone( $timezone );
		} catch ( Exception $exception ) {
			return $this->get_invalid_error();
		}
		if ( $start >= $end ) {
			return $this->get_invalid_error();
		}

		$timezone_id = $timezone->getName();
		if ( ! empty( $payload['is_full_day'] ) ) {
			$dates = $this->build_date_list( $start, $end, true );
			if ( is_wp_error( $dates ) ) {
				return $this->get_invalid_error();
			}

			return array(
				'mode'             => 1 === count( $dates ) ? 'full_day' : 'date_range',
				'dates'            => $dates,
				'timezone'         => $timezone_id,
				'selection_method' => 'timeline',
				'start_time'       => null,
				'end_time'         => null,
				'time_slot'        => null,
			);
		}

		$dates = $this->build_date_list( $start, $end, false );
		if ( is_wp_error( $dates ) ) {
			return $this->get_invalid_error();
		}

		return array(
			'mode'             => 'time_range',
			'dates'            => $dates,
			'timezone'         => $timezone_id,
			'selection_method' => 'timeline',
			'start_time'       => $start->format( 'H:i' ),
			'end_time'         => $end->format( 'H:i' ),
			'time_slot'        => null,
		);
	}

	/**
	 * Enumerate the bounded site-local dates represented by one signed interval.
	 *
	 * Full-day Timeline intervals use an exclusive end midnight. Timed intervals
	 * include the end date so a cross-day selection cannot be reduced to its
	 * first date while retaining later boundary times.
	 *
	 * @param DateTimeImmutable $start         Site-local interval start.
	 * @param DateTimeImmutable $end           Site-local interval end.
	 * @param bool              $end_exclusive Whether the end date is exclusive.
	 * @return array<int,string>|WP_Error Ordered ISO dates or a safe bounds error.
	 */
	private function build_date_list( $start, $end, $end_exclusive ) {
		$dates   = array();
		$current = $start->setTime( 0, 0, 0 );
		$finish  = $end->setTime( 0, 0, 0 );
		while ( ( $end_exclusive ? $current < $finish : $current <= $finish ) && WPBC_Booking_New_Inspector_Config::MAX_DATES > count( $dates ) ) {
			$dates[] = $current->format( 'Y-m-d' );
			$current = $current->modify( '+1 day' );
		}

		if ( empty( $dates ) || ( $end_exclusive ? $current < $finish : $current <= $finish ) ) {
			return $this->get_invalid_error();
		}

		return $dates;
	}

	/**
	 * Return the neutral no-selection schedule used by direct creation.
	 *
	 * @return array<string,mixed> Empty initial schedule DTO.
	 */
	private function get_empty_schedule() {
		$timezone = function_exists( 'wp_timezone_string' ) ? wp_timezone_string() : 'UTC';

		return array(
			'mode'             => 'full_day',
			'dates'            => array(),
			'timezone'         => '' !== $timezone ? $timezone : 'UTC',
			'selection_method' => 'calendar',
			'start_time'       => null,
			'end_time'         => null,
			'time_slot'        => null,
		);
	}

	/**
	 * Return a uniform user/site/expiry/token failure.
	 *
	 * @return WP_Error Safe signed-context error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_source_context_invalid',
			__( 'This booking selection expired or is invalid. Return to Timeline and select the range again.', 'booking' ),
			array( 'status' => 403 )
		);
	}
}
