<?php
/**
 * Review-page Setup Wizard summary email.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Send one consented, retry-safe setup summary when Review Setup first opens.
 *
 * The legacy Setup Wizard sent selected onboarding values to Booking Calendar
 * after its booking-type step. The progressive wizard waits until Review Setup
 * so the message can contain the same complete, server-authorized plan shown to
 * the administrator. A compact-content fingerprint prevents duplicate sends
 * for 15 minutes, while changed content may be sent immediately.
 */
final class WPBC_Setup_Wizard_Summary_Email {

	/** Maximum Days Off records expanded in one feedback email. */
	const MAX_EXPANDED_DAYS_OFF_ITEMS = 5;

	/** Number of seconds an unchanged sent fingerprint remains suppressed. */
	const SENT_DEDUPLICATION_TTL = 1 * MINUTE_IN_SECONDS;

	/** Email address used by the released Setup Wizard feedback workflow. */
	const RECIPIENT = 'feedback_setup@wpbookingcalendar.com';

	/** Lock namespace separated from the terminal Review save operation. */
	const LOCK_STEP_ID = 'review_setup_email';

	/** @var WPBC_Setup_Wizard_Email_State_Store */
	private $email_state_store;

	/** @var WPBC_Setup_Wizard_Operation_Lock */
	private $operation_lock;

	/** @var callable|null */
	private $mail_callback;

	/**
	 * Build the sender from narrow persistence, locking, and delivery services.
	 *
	 * @param WPBC_Setup_Wizard_Email_State_Store $email_state_store Summary-email checkpoint store.
	 * @param WPBC_Setup_Wizard_Operation_Lock    $operation_lock    Context-scoped operation lock.
	 * @param callable|null                           $mail_callback     Optional test delivery callback. It receives recipient, subject, message, and headers.
	 */
	public function __construct( WPBC_Setup_Wizard_Email_State_Store $email_state_store, WPBC_Setup_Wizard_Operation_Lock $operation_lock, $mail_callback = null ) {
		$this->email_state_store = $email_state_store;
		$this->operation_lock    = $operation_lock;
		$this->mail_callback     = is_callable( $mail_callback ) ? $mail_callback : null;
	}

	/**
	 * Send the current reviewed setup once when consent and environment allow it.
	 *
	 * A `pending` checkpoint is written before `wp_mail()` is called. A concurrent
	 * request cannot repeat that operation while its lock is active. If a request
	 * stops before recording the result, a later Review opening may retry after
	 * the short operation lock expires. A `sent` fingerprint is suppressed for
	 * 15 minutes; confirmed `failed` attempts may retry on the next opening.
	 *
	 * @param array<string,mixed> $review_context Authorized context rendered by Review Setup.
	 *
	 * @return array<string,mixed>|WP_Error Current or updated checkpoint, or a safe persistence/lock error.
	 */
	public function maybe_send( array $review_context ) {
		$checkpoint = $this->email_state_store->load();
		if ( ! $this->is_requested( $checkpoint ) ) {
			return $checkpoint;
		}

		$fingerprint = $this->get_summary_fingerprint( $review_context );
		$email_state = isset( $checkpoint['email'] ) && is_array( $checkpoint['email'] ) ? $checkpoint['email'] : array();
		if ( $this->is_completed_attempt( $email_state, $fingerprint ) ) {
			return $checkpoint;
		}

		$operation_id = 'summary_email_' . substr( $fingerprint, 0, 32 );
		$lock_token   = $this->operation_lock->acquire(
			$this->email_state_store->get_lock_scope(),
			self::LOCK_STEP_ID,
			$operation_id
		);
		if ( is_wp_error( $lock_token ) ) {
			return $lock_token;
		}

		try {
			$checkpoint = $this->email_state_store->load();
			$email_state = isset( $checkpoint['email'] ) && is_array( $checkpoint['email'] ) ? $checkpoint['email'] : array();
			if ( ! $this->is_requested( $checkpoint ) || $this->is_completed_attempt( $email_state, $fingerprint ) ) {
				return $checkpoint;
			}

			$attempted_at = current_time( 'mysql', true );
			$pending      = $this->email_state_store->update_email_state(
				array(
					'requested'          => true,
					'recipient'          => self::RECIPIENT,
					'status'             => 'pending',
					'operation_id'       => $operation_id,
					'summary_fingerprint' => $fingerprint,
					'attempted_at'        => $attempted_at,
					'sent_at'             => '',
					'last_error'          => '',
				),
				isset( $checkpoint['revision'] ) ? absint( $checkpoint['revision'] ) : 0
			);
			if ( is_wp_error( $pending ) ) {
				return $pending;
			}

			try {
				$is_sent = $this->send_mail( $review_context );
			} catch ( Throwable $mail_error ) {
				$is_sent = false;
			}
			$result  = $this->email_state_store->update_email_state(
				array(
					'requested'          => true,
					'recipient'          => self::RECIPIENT,
					'status'             => $is_sent ? 'sent' : 'failed',
					'operation_id'       => $operation_id,
					'summary_fingerprint' => $fingerprint,
					'attempted_at'        => $attempted_at,
					'sent_at'             => $is_sent ? current_time( 'mysql', true ) : '',
					'last_error'          => $is_sent ? '' : __( 'WordPress could not hand the optional setup summary to the configured feedback.', 'booking' ),
				),
				isset( $pending['revision'] ) ? absint( $pending['revision'] ) : 0
			);

			return is_wp_error( $result ) ? $pending : $result;
		} finally {
			$this->operation_lock->release( $this->email_state_store->get_lock_scope(), self::LOCK_STEP_ID, $lock_token );
		}
	}

	/**
	 * Format a compact email projection of the authorized Review Setup context.
	 *
	 * @param array<string,mixed> $review_context Authorized Review Setup presentation context.
	 *
	 * @return string Plain-text UTF-8 email body.
	 */
	public static function format_message( array $review_context ) {
		$lines = self::get_content_lines( $review_context );

		$plugin_version = function_exists( 'wpbc_feedback_01_get_version' )
			? wpbc_feedback_01_get_version()
			: ( defined( 'WP_BK_VERSION_NUM' ) ? WP_BK_VERSION_NUM : __( 'Unknown', 'booking' ) );

		$lines[]          = '';
		$lines[]          = sprintf( __( 'Site: %s', 'booking' ), esc_url_raw( home_url( '/' ) ) );
		$lines[]          = sprintf( __( 'Booking Calendar version: %s', 'booking' ), self::sanitize_line( $plugin_version ) );
		$lines[]          = sprintf( __( 'Generated: %s', 'booking' ), wp_date( 'Y-m-d H:i:s T' ) );
		$how_old_info_arr = function_exists( 'wpbc_get_info__about_how_old' ) ? wpbc_get_info__about_how_old() : false;
		if ( ! empty( $how_old_info_arr ) ) {
			$lines[] = sprintf(
				__( 'First booking: %1$s (%2$d days ago)', 'booking' ),
				self::sanitize_line( isset( $how_old_info_arr['date_echo'] ) ? $how_old_info_arr['date_echo'] : '' ),
				isset( $how_old_info_arr['days'] ) ? absint( $how_old_info_arr['days'] ) : 0
			);
		}

		return implode( "\n", $lines );
	}

	/**
	 * Build stable feedback content without volatile delivery metadata.
	 *
	 * Free-text descriptions are deliberately excluded from feedback email. Long
	 * Days Off collections remain summarized by the row total instead of listing
	 * every configured date period.
	 *
	 * @param array<string,mixed> $review_context Authorized Review Setup context.
	 *
	 * @return string[] Stable plain-text content lines.
	 */
	private static function get_content_lines( array $review_context ) {
		$journey         = isset( $review_context['journey'] ) && is_array( $review_context['journey'] ) ? $review_context['journey'] : array();
		$groups          = isset( $review_context['groups'] ) && is_array( $review_context['groups'] ) ? $review_context['groups'] : array();
		$feedback_profile = isset( $review_context['feedback_profile'] ) && is_array( $review_context['feedback_profile'] ) ? $review_context['feedback_profile'] : array();
		$lines           = array(
			__( 'Booking Calendar Setup', 'booking' ),
			str_repeat( '=', 32 ),
			'',
			__( 'Selected customer journey', 'booking' ),
			'- ' . self::sanitize_line( isset( $journey['title'] ) ? $journey['title'] : __( 'Not configured', 'booking' ) ),
		);

		if ( ! empty( $feedback_profile ) ) {
			$lines[] = '';
			$lines[] = __( 'Setup feedback profile', 'booking' );
			$lines[] = str_repeat( '-', 24 );
			self::append_review_row_lines( $lines, $feedback_profile );
		}

		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}
			$lines[] = '';
			$lines[] = self::sanitize_line( isset( $group['label'] ) ? $group['label'] : __( 'Setup details', 'booking' ) );
			$lines[] = str_repeat( '-', 24 );

			foreach ( isset( $group['rows'] ) && is_array( $group['rows'] ) ? $group['rows'] : array() as $row ) {
				if ( ! is_array( $row ) ) {
					continue;
				}
				self::append_review_row_lines( $lines, $row );
			}
		}

		return $lines;
	}

	/**
	 * Append one normalized Review record to the plain-text message.
	 *
	 * @param string[]            $lines Message lines passed by reference.
	 * @param array<string,mixed> $row   Authorized Review or feedback-profile row.
	 *
	 * @return void
	 */
	private static function append_review_row_lines( array &$lines, array $row ) {
		$row_label   = self::sanitize_line( isset( $row['label'] ) ? $row['label'] : '' );
		$row_summary = self::sanitize_line( isset( $row['summary'] ) ? $row['summary'] : '' );
		$lines[]     = sprintf( '%1$s: %2$s', $row_label, $row_summary );

		foreach ( isset( $row['details'] ) && is_array( $row['details'] ) ? $row['details'] : array() as $detail ) {
			if ( is_array( $detail ) && isset( $detail['label'], $detail['value'] ) && empty( $detail['feedback_hidden'] ) && ! self::is_description_label( $detail['label'] ) ) {
				$feedback_value = isset( $detail['feedback_value'] ) ? $detail['feedback_value'] : $detail['value'];
				$lines[]        = sprintf( '  - %1$s: %2$s', self::sanitize_line( $detail['label'] ), self::sanitize_line( $feedback_value ) );
			}
		}

		$items = isset( $row['items'] ) && is_array( $row['items'] ) ? $row['items'] : array();
		if ( 'days_off' === ( isset( $row['step_id'] ) ? $row['step_id'] : '' ) && self::MAX_EXPANDED_DAYS_OFF_ITEMS < count( $items ) ) {
			return;
		}

		foreach ( $items as $item ) {
			if ( is_array( $item ) && isset( $item['label'], $item['value'] ) && empty( $item['feedback_hidden'] ) ) {
				$feedback_value = isset( $item['feedback_value'] ) ? $item['feedback_value'] : $item['value'];
				$lines[]        = sprintf( '  * %1$s: %2$s', self::sanitize_line( $item['label'] ), self::sanitize_line( $feedback_value ) );
			}
		}
	}

	/**
	 * Detect direct description fields excluded from feedback email.
	 *
	 * @param mixed $label Authorized Review detail label.
	 *
	 * @return bool True when the label identifies free-text description content.
	 */
	private static function is_description_label( $label ) {
		$label = self::sanitize_line( $label );

		return in_array(
			$label,
			array(
				self::sanitize_line( __( 'Description', 'booking' ) ),
				self::sanitize_line( __( 'Template description', 'booking' ) ),
			),
			true
		);
	}

	/**
	 * Determine whether the current checkpoint explicitly requests sharing.
	 *
	 * @param array<string,mixed> $checkpoint Current normalized checkpoint.
	 *
	 * @return bool True only for an eligible Review step with explicit consent.
	 */
	private function is_requested( array $checkpoint ) {
		if ( ! WPBC_Setup_Wizard_Environment_Policy::allows_summary_email() || 'review_setup' !== ( isset( $checkpoint['current_step'] ) ? $checkpoint['current_step'] : '' ) ) {
			return false;
		}

		$business_values = isset( $checkpoint['values']['business_details'] ) && is_array( $checkpoint['values']['business_details'] )
			? $checkpoint['values']['business_details']
			: array();

		return ! empty( $business_values['personalization_consent'] )
			&& ! empty( $business_values['booking_email'] )
			&& false !== is_email( $business_values['booking_email'] );
	}

	/**
	 * Detect a recently completed attempt for one exact compact email.
	 *
	 * @param array<string,mixed> $email_state Summary-email checkpoint metadata.
	 * @param string              $fingerprint Current Review summary fingerprint.
	 *
	 * @return bool True during the 15-minute sent-state suppression window.
	 */
	private function is_completed_attempt( array $email_state, $fingerprint ) {
		if (
			! isset( $email_state['summary_fingerprint'], $email_state['status'], $email_state['sent_at'] )
			|| ! hash_equals( (string) $email_state['summary_fingerprint'], (string) $fingerprint )
			|| 'sent' !== $email_state['status']
		) {
			return false;
		}

		$sent_timestamp    = strtotime( (string) $email_state['sent_at'] . ' UTC' );
		$current_timestamp = strtotime( current_time( 'mysql', true ) . ' UTC' );
		if ( false === $sent_timestamp || false === $current_timestamp ) {
			return false;
		}

		$sent_age = $current_timestamp - $sent_timestamp;

		return 0 <= $sent_age && self::SENT_DEDUPLICATION_TTL > $sent_age;
	}

	/**
	 * Hash the stable compact content that will be shared by feedback email.
	 *
	 * @param array<string,mixed> $review_context Authorized Review Setup context.
	 *
	 * @return string SHA-256 fingerprint.
	 */
	private function get_summary_fingerprint( array $review_context ) {
		return hash( 'sha256', wp_json_encode( self::get_content_lines( $review_context ) ) );
	}

	/**
	 * Deliver one plain-text summary through the normal WordPress mail pipeline.
	 *
	 * @param array<string,mixed> $review_context Authorized Review Setup context.
	 *
	 * @return bool True when WordPress accepted the message for delivery.
	 */
	private function send_mail( array $review_context ) {
		$is_allowed = apply_filters( 'wpbc_email_api_is_allow_send', true, 'setup_wizard_summary', array() );
		if ( ! $is_allowed ) {
			return false;
		}

		$subject = 'Booking Calendar | Setup';
		$message = self::format_message( $review_context );
		$headers = array( 'Content-Type: text/plain; charset=UTF-8' );

		if ( function_exists( 'get_option' ) && function_exists( 'wp_get_current_user' ) ) {
			$current_user = wp_get_current_user();
			$from_email   = sanitize_email( (string) get_option( 'admin_email', '' ) );
			$from_name    = is_object( $current_user ) && isset( $current_user->display_name )
				? sanitize_text_field( (string) $current_user->display_name )
				: '';

			if ( '' !== $from_email && '' !== $from_name ) {
				$headers[] = sprintf( 'From: %1$s <%2$s>', $from_name, $from_email );
			}
		}

		if ( null !== $this->mail_callback ) {
			return (bool) call_user_func( $this->mail_callback, self::RECIPIENT, $subject, $message, $headers );
		}

		$result_sent = @wp_mail( self::RECIPIENT, $subject, $message, $headers );

		return (bool) $result_sent;
	}

	/**
	 * Collapse untrusted scalar presentation text to one safe email line.
	 *
	 * @param mixed $text Scalar presentation text.
	 *
	 * @return string Sanitized single-line text.
	 */
	private static function sanitize_line( $text ) {
		return sanitize_text_field( is_scalar( $text ) ? (string) $text : '' );
	}
}
