<?php
/**
 * Booking Inspector saved-cost projection.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Project saved financial state without recalculating or mutating a booking.
 */
final class WPBC_Booking_Inspector_Cost_Projection {

	/**
	 * Return the edition-supported saved cost and payment summary.
	 *
	 * @param array<string,mixed> $booking Authorized internal booking row.
	 *
	 * @return array<string,mixed> JSON-safe saved financial summary.
	 */
	public function project( $booking ) {
		$is_supported = ! empty( $booking['supports_costs'] ) && class_exists( 'wpdev_bk_biz_s' );
		if ( ! $is_supported ) {
			return array( 'supported' => false );
		}

		$resource_id   = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$has_saved_cost = array_key_exists( 'cost', $booking )
			&& null !== $booking['cost']
			&& '' !== trim( (string) $booking['cost'] )
			&& is_numeric( $booking['cost'] );
		$saved_cost     = $has_saved_cost ? (float) $booking['cost'] : null;
		$formatted      = '';
		if ( $has_saved_cost ) {
			$formatted = function_exists( 'wpbc_get_cost_with_currency_for_user' )
				? wpbc_get_cost_with_currency_for_user( $saved_cost, $resource_id )
				: number_format_i18n( $saved_cost, 2 );
			$formatted = html_entity_decode( wp_strip_all_tags( (string) $formatted ), ENT_QUOTES, 'UTF-8' );
		}
		$payment_status = isset( $booking['pay_status'] ) ? trim( (string) $booking['pay_status'] ) : '';
		$payment_label  = function_exists( 'wpdev_bk_get_payment_status_simple' )
			? wpdev_bk_get_payment_status_simple( $payment_status )
			: ( '' === $payment_status || is_numeric( $payment_status ) ? __( 'Unknown', 'booking' ) : $payment_status );
		$is_paid = function_exists( 'wpbc_is_payment_status_ok' ) && wpbc_is_payment_status_ok( $payment_status );
		$payment_options = array();
		$known_payment_status = false;
		$status_titles   = function_exists( 'get_payment_status_titles' ) ? (array) get_payment_status_titles() : array();
		foreach ( $status_titles as $status_label => $status_key ) {
			$status_key = sanitize_text_field( (string) $status_key );
			if ( '' === $status_key ) {
				continue;
			}
			$payment_options[] = array(
				'value' => $status_key,
				'label' => sanitize_text_field( wp_strip_all_tags( (string) $status_label ) ),
			);
			$known_payment_status = $known_payment_status || $payment_status === $status_key;
		}
		if ( ! $known_payment_status ) {
			array_unshift(
				$payment_options,
				array(
					'value' => sanitize_text_field( $payment_status ),
					'label' => sanitize_text_field( wp_strip_all_tags( (string) $payment_label ) ),
				)
			);
		}

		return array(
			'supported'            => true,
			'has_saved_cost'       => $has_saved_cost,
			'saved_cost'           => $has_saved_cost ? (string) $saved_cost : '',
			'saved_cost_formatted' => sanitize_text_field( $formatted ),
			'payment'              => array(
				'state'   => $is_paid ? 'paid' : 'not_paid',
				'value'   => sanitize_text_field( $payment_status ),
				'label'   => sanitize_text_field( wp_strip_all_tags( (string) $payment_label ) ),
				'options' => $payment_options,
			),
		);
	}
}
