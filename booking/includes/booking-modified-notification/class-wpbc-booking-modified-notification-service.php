<?php
/**
 * Booking Modified-email notification service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Dispatch one established Modified email from canonical post-save data.
 *
 * Mutation domains call this service only after a successful persistence
 * boundary. The established mailer remains authoritative for edition support,
 * the enabled state of the Modified template, MultiUser switching, shortcode
 * values, recipients, and delivery hooks.
 */
final class WPBC_Booking_Modified_Notification_Service {

	/** @var callable|null Optional canonical booking loader used by tests. */
	private $booking_loader;

	/** @var callable|null Optional Modified-email sender used by tests. */
	private $email_sender;

	/**
	 * Construct the notification service with optional test collaborators.
	 *
	 * Production callers omit both callbacks and use the released booking-data
	 * filter and `wpbc_send_email_modified()` implementation.
	 *
	 * @param callable|null $booking_loader Optional callback accepting a booking ID and returning canonical booking data.
	 * @param callable|null $email_sender   Optional callback accepting booking ID, Resource ID, and form data.
	 */
	public function __construct( $booking_loader = null, $email_sender = null ) {
		$this->booking_loader = is_callable( $booking_loader ) ? $booking_loader : null;
		$this->email_sender   = is_callable( $email_sender ) ? $email_sender : null;
	}

	/**
	 * Send the Modified email when the current operation explicitly requested it.
	 *
	 * Missing or false notification intent is deliberately fail-closed. Canonical
	 * booking data is loaded after persistence so a Resource move, changed dates,
	 * cost, payment state, notes, or form values cannot produce an email from a
	 * stale pre-save snapshot.
	 *
	 * @param int  $booking_id                 Successfully changed booking ID.
	 * @param bool $send_modified_email_intent Whether the current UI operation requested email delivery.
	 *
	 * @return bool True when the established sender reports a sent email; otherwise false.
	 */
	public function send( $booking_id, $send_modified_email_intent ) {
		$booking_id = absint( $booking_id );
		if ( ! $booking_id || true !== $send_modified_email_intent ) {
			return false;
		}

		if ( $this->booking_loader ) {
			$booking = call_user_func( $this->booking_loader, $booking_id );
		} elseif ( function_exists( 'apply_bk_filter' ) ) {
			$booking = apply_bk_filter( 'wpbc_get_booking_data', $booking_id );
		} else {
			return false;
		}

		if ( ! is_array( $booking ) ) {
			return false;
		}
		$resource_id = isset( $booking['type'] ) ? absint( $booking['type'] ) : 0;
		if ( ! $resource_id && isset( $booking['booking_type'] ) ) {
			$resource_id = absint( $booking['booking_type'] );
		}
		$form_data = isset( $booking['form'] ) && is_scalar( $booking['form'] ) ? (string) $booking['form'] : '';
		if ( ! $resource_id ) {
			return false;
		}

		if ( $this->email_sender ) {
			return (bool) call_user_func( $this->email_sender, $booking_id, $resource_id, $form_data );
		}
		if ( ! function_exists( 'wpbc_send_email_modified' ) ) {
			return false;
		}

		return (bool) wpbc_send_email_modified( $booking_id, $resource_id, $form_data );
	}
}
