<?php
/**
 * Booking Rescheduling mutation service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Project one reviewed allocation into canonical rows and persist it atomically.
 */
final class WPBC_Booking_Rescheduling_Mutation_Service {

	/** @var WPBC_Booking_Date_Editor_Mutation_Repository Shared canonical row-replacement repository. */
	private $mutation_repository;

	/**
	 * Construct the mutation service.
	 *
	 * @param WPBC_Booking_Date_Editor_Mutation_Repository|null $mutation_repository Optional shared persistence primitive.
	 */
	public function __construct( $mutation_repository = null ) {
		$this->mutation_repository = $mutation_repository ? $mutation_repository : new WPBC_Booking_Date_Editor_Mutation_Repository();
	}

	/**
	 * Persist the exact server-derived primary Resource and allocation rows.
	 *
	 * Form values, the saved form selection, notes, status, cost, payment state,
	 * hashes, and notification intent remain unchanged. A cross-Resource move
	 * rewrites only the Resource suffix in encoded form field identifiers so the
	 * canonical booking record remains readable under its new primary Resource.
	 *
	 * @param array<string,mixed> $context Fresh apply-time context held under the availability guard.
	 *
	 * @return array<string,mixed>|WP_Error Persistence and canonical row result.
	 */
	public function apply( $context ) {
		$booking       = $context['booking'];
		$schedule      = $context['schedule'];
		$where_to_save = $context['resolution']['where_to_save'];
		$primary_resource_id = absint( $where_to_save['main__resource_id'] );
		$canonical_rows = $this->build_canonical_rows( $context, $primary_resource_id );
		if ( is_wp_error( $canonical_rows ) ) {
			return $canonical_rows;
		}

		if ( $this->matches_saved_state( $context, $primary_resource_id ) ) {
			return array(
				'changed'             => false,
				'modification_date'   => isset( $booking['modification_date'] ) ? (string) $booking['modification_date'] : '',
				'primary_resource_id' => $primary_resource_id,
				'canonical_rows'      => $canonical_rows,
			);
		}

		$write_result = $this->mutation_repository->replace_booking_dates(
			absint( $booking['booking_id'] ),
			isset( $booking['modification_date'] ) ? (string) $booking['modification_date'] : '',
			$this->build_sort_date( $schedule ),
			$canonical_rows,
			$primary_resource_id
		);
		if ( is_wp_error( $write_result ) ) {
			return $write_result;
		}

		return array_merge(
			$write_result,
			array(
				'primary_resource_id' => $primary_resource_id,
			)
		);
	}

	/**
	 * Build exact established 00/01/02 booking-date rows.
	 *
	 * @param array<string,mixed> $context             Fresh apply context.
	 * @param int                 $primary_resource_id Server-derived primary Resource.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Canonical rows or safe error.
	 */
	private function build_canonical_rows( $context, $primary_resource_id ) {
		$schedule      = $context['schedule'];
		$where_to_save = $context['resolution']['where_to_save'];
		$quantity      = absint( $context['resolution']['quantity'] );
		$approved      = isset( $context['date_rows'][0]['approved'] ) && ! empty( $context['date_rows'][0]['approved'] ) ? 1 : 0;
		$resources_in_dates = isset( $where_to_save['resources_in_dates'] ) && is_array( $where_to_save['resources_in_dates'] )
			? $where_to_save['resources_in_dates']
			: array();
		$dates = array_keys( $resources_in_dates );
		if ( $dates !== $schedule['selected_dates'] || ! $quantity ) {
			return $this->get_storage_error();
		}

		$rows = array();
		foreach ( $dates as $date_index => $booking_date ) {
			$date_resources = array_values( array_filter( array_map( 'absint', (array) $resources_in_dates[ $booking_date ] ) ) );
			if ( count( $date_resources ) < $quantity ) {
				return $this->get_storage_error();
			}
			for ( $quantity_index = 0; $quantity_index < $quantity; $quantity_index++ ) {
				$effective_resource_id = $date_resources[ $quantity_index ];
				foreach ( $this->get_date_boundaries( $schedule, $date_index, count( $dates ) ) as $boundary ) {
					$rows[] = array(
						'booking_date' => $booking_date . ' ' . $boundary,
						'approved'     => $approved,
						'type_id'      => $effective_resource_id === $primary_resource_id ? null : $effective_resource_id,
					);
				}
			}
		}

		return $rows;
	}

	/**
	 * Build canonical storage boundaries for one selected date.
	 *
	 * @param array<string,mixed> $schedule   Canonical schedule.
	 * @param int                 $date_index Zero-based date index.
	 * @param int                 $date_count Selected date count.
	 *
	 * @return array<int,string> One or two `HH:MM:SS` boundaries.
	 */
	private function get_date_boundaries( $schedule, $date_index, $date_count ) {
		if ( 'full_day' === $schedule['time_application'] ) {
			return array( '00:00:00' );
		}
		$start = $schedule['start_time'] . ':01';
		$end   = $schedule['end_time'] . ':02';
		if ( 'per_date' === $schedule['time_application'] || 1 === $date_count ) {
			return array( $start, $end );
		}
		if ( 0 === $date_index ) {
			return array( $start );
		}
		if ( $date_count - 1 === $date_index ) {
			return array( $end );
		}

		return array( '00:00:00' );
	}

	/**
	 * Determine whether the signed proposal is already saved canonically.
	 *
	 * @param array<string,mixed> $context             Fresh apply context.
	 * @param int                 $primary_resource_id Proposed primary Resource.
	 *
	 * @return bool True when no write is required.
	 */
	private function matches_saved_state( $context, $primary_resource_id ) {
		if ( absint( $context['booking']['booking_type'] ) !== absint( $primary_resource_id ) ) {
			return false;
		}
		$saved    = $context['shape']['saved'];
		$schedule = $context['schedule'];
		foreach ( array( 'selected_dates', 'time_application', 'start_time', 'end_time' ) as $key ) {
			if ( ! array_key_exists( $key, $saved ) || $saved[ $key ] !== $schedule[ $key ] ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Build the derived booking sort boundary.
	 *
	 * @param array<string,mixed> $schedule Canonical schedule.
	 *
	 * @return string SQL datetime.
	 */
	private function build_sort_date( $schedule ) {
		$first_date = reset( $schedule['selected_dates'] );
		$first_time = 'full_day' === $schedule['time_application'] ? '00:00:00' : $schedule['start_time'] . ':01';

		return $first_date . ' ' . $first_time;
	}

	/** @return WP_Error Safe storage projection error. */
	private function get_storage_error() {
		return new WP_Error( 'wpbc_booking_rescheduling_storage_invalid', __( 'The reviewed schedule could not be converted to canonical booking rows.', 'booking' ), array( 'status' => 409 ) );
	}
}
