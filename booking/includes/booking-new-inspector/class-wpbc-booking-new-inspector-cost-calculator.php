<?php
/**
 * Canonical read-only cost adapter for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adapts the released Booking cost filters without entering payment or save paths.
 */
final class WPBC_Booking_New_Inspector_Cost_Calculator {

	/**
	 * Calculate a canonical cost using current owner-scoped pricing configuration.
	 *
	 * The complete `$_POST` array is restored in a `finally` block because the
	 * legacy Advanced Cost filter reads `booking_form_type`. No booking ID is
	 * supplied and no payment, persistence, email, Activity, or lifecycle API is
	 * called.
	 *
	 * @param array<string,mixed> $calculation Authorized canonical calculation input.
	 * @return array<string,mixed>|WP_Error Numeric calculation result or safe error.
	 */
	public function calculate( $calculation ) {
		if ( ! class_exists( 'wpdev_bk_biz_s' ) || ! function_exists( 'wpbc_calc__booking_cost' ) || ! function_exists( 'wpbc_get_maybe_deposit_amount' ) ) {
			return $this->get_unavailable_error( 'edition_unavailable' );
		}

		$resource_id     = absint( isset( $calculation['resource_id'] ) ? $calculation['resource_id'] : 0 );
		$form_id         = isset( $calculation['form_id'] ) ? (string) $calculation['form_id'] : '';
		$form_data       = isset( $calculation['form_data'] ) ? (string) $calculation['form_data'] : '';
		$schedule        = isset( $calculation['schedule'] ) && is_array( $calculation['schedule'] ) ? $calculation['schedule'] : array();
		$selected_dates  = isset( $schedule['selected_dates'] ) && is_array( $schedule['selected_dates'] ) ? $schedule['selected_dates'] : array();
		$time_application = isset( $schedule['time_application'] ) ? (string) $schedule['time_application'] : '';
		if ( ! $resource_id || '' === $form_id || empty( $selected_dates ) ) {
			return $this->get_unavailable_error( 'calculation_contract_invalid' );
		}

		$previous_post = $_POST;
		try {
			$_POST['booking_form_type'] = $form_id;
			if ( 'per_date' === $time_application ) {
				$total_cost = $this->calculate_each_date( $resource_id, $selected_dates, $schedule, $form_data );
			} else {
				$total_cost = wpbc_calc__booking_cost(
					$this->get_cost_parameters( $resource_id, $selected_dates, $schedule, $form_data )
				);
			}
			if ( ! is_numeric( $total_cost ) ) {
				return $this->get_unavailable_error( 'canonical_calculation_failed' );
			}

			$canonical_total_cost = max( 0.0, (float) $total_cost );
			$cost_intent         = isset( $calculation['cost_intent'] ) ? (string) $calculation['cost_intent'] : 'canonical';
			$corrected_cost      = isset( $calculation['corrected_cost'] ) ? (string) $calculation['corrected_cost'] : '';
			$total_cost          = 'corrected' === $cost_intent && '' !== $corrected_cost
				? max( 0.0, (float) $corrected_cost )
				: $canonical_total_cost;
			$dates_string        = $this->get_dates_string( $selected_dates );
			$times_array         = $this->get_times_array( $schedule );
			$deposit_cost         = wpbc_get_maybe_deposit_amount(
				(float) $total_cost,
				array(
					'booking_id'            => 0,
					'service_id'            => 0,
					'resource_id'           => $resource_id,
					'str_dates__dd_mm_yyyy' => $dates_string,
					'form_data'             => $form_data,
					'times_array'           => $times_array,
				)
			);
			if ( ! is_numeric( $deposit_cost ) ) {
				return $this->get_unavailable_error( 'deposit_calculation_failed' );
			}

			$deposit_cost = min( $total_cost, max( 0.0, (float) $deposit_cost ) );

			return array(
				'canonical_total_cost' => $canonical_total_cost,
				'total_cost'           => $total_cost,
				'deposit_cost'         => $deposit_cost,
				'balance_cost'         => max( 0.0, $total_cost - $deposit_cost ),
				'cost_intent'          => 'corrected' === $cost_intent ? 'corrected' : 'canonical',
				'corrected_cost'       => 'corrected' === $cost_intent ? $corrected_cost : '',
			);
		} finally {
			$_POST = $previous_post;
		}
	}

	/**
	 * Calculate equal daily intervals one date at a time.
	 *
	 * @param int                 $resource_id    Authorized Resource ID.
	 * @param array<int,string>   $selected_dates Canonical ISO dates.
	 * @param array<string,mixed> $schedule       Canonical schedule.
	 * @param string              $form_data      Canonical serialized fields.
	 * @return float|WP_Error Summed cost or safe error.
	 */
	private function calculate_each_date( $resource_id, $selected_dates, $schedule, $form_data ) {
		$total_cost = 0.0;
		foreach ( $selected_dates as $selected_date ) {
			$date_cost = wpbc_calc__booking_cost(
				$this->get_cost_parameters( $resource_id, array( $selected_date ), $schedule, $form_data )
			);
			if ( ! is_numeric( $date_cost ) ) {
				return $this->get_unavailable_error( 'canonical_calculation_failed' );
			}
			$total_cost += (float) $date_cost;
		}

		return $total_cost;
	}

	/**
	 * Build the exact released calculator parameter array.
	 *
	 * @param int                 $resource_id    Authorized Resource ID.
	 * @param array<int,string>   $selected_dates Canonical ISO dates.
	 * @param array<string,mixed> $schedule       Canonical schedule.
	 * @param string              $form_data      Canonical serialized fields.
	 * @return array<string,mixed> Cost parameters.
	 */
	private function get_cost_parameters( $resource_id, $selected_dates, $schedule, $form_data ) {
		return array(
			'booking_id'            => 0,
			'service_id'            => 0,
			'resource_id'           => $resource_id,
			'str_dates__dd_mm_yyyy' => $this->get_dates_string( $selected_dates ),
			'times_array'           => $this->get_times_array( $schedule ),
			'form_data'             => $form_data,
			'is_discount_calculate' => true,
			'is_only_original_cost' => false,
		);
	}

	/**
	 * Convert canonical ISO dates to the released comma-separated format.
	 *
	 * @param array<int,string> $selected_dates Canonical ISO dates.
	 * @return string Comma-separated `DD.MM.YYYY` dates.
	 */
	private function get_dates_string( $selected_dates ) {
		$cost_dates = array();
		foreach ( $selected_dates as $selected_date ) {
			$date_parts   = explode( '-', $selected_date );
			$cost_dates[] = $date_parts[2] . '.' . $date_parts[1] . '.' . $date_parts[0];
		}

		return implode( ', ', $cost_dates );
	}

	/**
	 * Convert the normalized schedule to released start and end arrays.
	 *
	 * @param array<string,mixed> $schedule Canonical schedule.
	 * @return array<int,array<int,string>> Start and end time arrays.
	 */
	private function get_times_array( $schedule ) {
		if ( 'full_day' === $schedule['time_application'] ) {
			return array( array( '00', '00', '01' ), array( '24', '00', '02' ) );
		}

		$start_time = explode( ':', $schedule['start_time'] );
		$end_time   = explode( ':', $schedule['end_time'] );

		return array(
			array( $start_time[0], $start_time[1], '00' ),
			array( $end_time[0], $end_time[1], '00' ),
		);
	}

	/**
	 * Return a stable unsupported-pricing error.
	 *
	 * @param string $reason_code Internal reason code.
	 * @return WP_Error Safe error.
	 */
	private function get_unavailable_error( $reason_code ) {
		return new WP_Error(
			'wpbc_booking_new_inspector_cost_unavailable',
			__( 'This booking cost must be calculated on the full Add Booking page.', 'booking' ),
			array(
				'status'      => 422,
				'reason_code' => sanitize_key( $reason_code ),
			)
		);
	}
}
