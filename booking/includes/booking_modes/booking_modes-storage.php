<?php
/**
 * Owner-scoped Booking Mode persistence.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read and write the explicitly selected presentation mode for one owner.
 *
 * No value is created automatically. Missing, obsolete, unknown, or disallowed
 * values resolve to Classic without modifying stored user configuration.
 */
final class WPBC_Booking_Mode_Storage {

	/**
	 * Owner-scoped WordPress user option name.
	 */
	const OPTION_NAME = 'booking_admin_mode';

	/**
	 * Shared storage instance.
	 *
	 * @var WPBC_Booking_Mode_Storage|null
	 */
	private static $instance = null;

	/**
	 * Cached selected modes keyed by owner user ID.
	 *
	 * @var array
	 */
	private $selected_modes = array();

	/**
	 * Number of WordPress user-option reads in this request.
	 *
	 * @var int
	 */
	private $read_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Get the shared request instance.
	 *
	 * @return WPBC_Booking_Mode_Storage Storage instance.
	 */
	public static function get_instance() {

		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Resolve the Booking Calendar owner used for presentation persistence.
	 *
	 * @return int Positive owner user ID, or zero for a signed-out request.
	 */
	public function get_owner_user_id() {

		$context       = WPBC_Booking_Mode_Context::get_instance()->get_context();
		$owner_user_id = isset( $context['owner_user_id'] ) ? absint( $context['owner_user_id'] ) : 0;

		/**
		 * Filter the owner user ID used for Booking Mode presentation storage.
		 *
		 * @param int   $owner_user_id Booking Calendar owner user ID.
		 * @param array $context       Cached request and owner context.
		 */
		$owner_user_id = apply_filters( 'wpbc_booking_modes_owner_user_id', $owner_user_id, $context );

		return is_scalar( $owner_user_id ) ? absint( $owner_user_id ) : 0;
	}

	/**
	 * Get the selected mode for an owner, defaulting safely to Classic.
	 *
	 * The user option is read at most once for each owner during a request.
	 *
	 * @param int $owner_user_id Optional owner user ID. Zero uses current context.
	 *
	 * @return string Allowed mode identifier.
	 */
	public function get_selected_mode_id( $owner_user_id = 0 ) {

		$owner_user_id = absint( $owner_user_id );
		$owner_user_id = $owner_user_id > 0 ? $owner_user_id : $this->get_owner_user_id();

		if ( $owner_user_id <= 0 ) {
			return 'classic';
		}

		if ( isset( $this->selected_modes[ $owner_user_id ] ) ) {
			return $this->selected_modes[ $owner_user_id ];
		}

		++$this->read_count;

		$stored_mode      = get_user_option( self::OPTION_NAME, $owner_user_id );
		$stored_mode_id   = is_scalar( $stored_mode ) ? sanitize_key( (string) $stored_mode ) : '';
		$allowed_mode_ids = WPBC_Booking_Mode_Registry::get_instance()->get_allowed_mode_ids();
		$selected_mode_id = in_array( $stored_mode_id, $allowed_mode_ids, true ) ? $stored_mode_id : 'classic';

		$this->selected_modes[ $owner_user_id ] = $selected_mode_id;

		return $selected_mode_id;
	}

	/**
	 * Save an explicit mode selection for an owner.
	 *
	 * This low-level method performs data validation only. An external request
	 * handler must verify its nonce and capability before calling it.
	 *
	 * @param string $mode_id       Requested registered mode identifier.
	 * @param int    $owner_user_id Optional owner user ID. Zero uses context.
	 *
	 * @return bool|WP_Error True on success, otherwise a validation or storage error.
	 */
	public function set_selected_mode_id( $mode_id, $owner_user_id = 0 ) {

		$mode_id                 = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
		$current_owner_user_id   = $this->get_owner_user_id();
		$requested_owner_user_id = absint( $owner_user_id );
		$owner_user_id           = $requested_owner_user_id > 0 ? $requested_owner_user_id : $current_owner_user_id;

		if ( $owner_user_id <= 0 ) {
			return new WP_Error( 'wpbc_booking_mode_owner_required', __( 'A Booking Calendar owner is required to save the administration mode.', 'booking' ) );
		}

		if ( $owner_user_id !== $current_owner_user_id ) {
			return new WP_Error( 'wpbc_booking_mode_owner_mismatch', __( 'The administration mode can be saved only for the active Booking Calendar owner.', 'booking' ) );
		}

		if ( ! in_array( $mode_id, WPBC_Booking_Mode_Registry::get_instance()->get_allowed_mode_ids(), true ) ) {
			return new WP_Error( 'wpbc_booking_mode_invalid', __( 'The selected Booking Calendar administration mode is not available.', 'booking' ) );
		}

		$is_updated = update_user_option( $owner_user_id, self::OPTION_NAME, $mode_id );

		if ( false === $is_updated ) {
			$stored_mode    = get_user_option( self::OPTION_NAME, $owner_user_id );
			$stored_mode_id = is_scalar( $stored_mode ) ? sanitize_key( (string) $stored_mode ) : '';
		}

		if ( false === $is_updated && $mode_id !== $stored_mode_id ) {
			return new WP_Error( 'wpbc_booking_mode_not_saved', __( 'The Booking Calendar administration mode could not be saved.', 'booking' ) );
		}

		$this->selected_modes[ $owner_user_id ] = $mode_id;

		return true;
	}

	/**
	 * Get the number of persistence reads in this request.
	 *
	 * @return int WordPress user-option read count.
	 */
	public function get_read_count() {

		return $this->read_count;
	}
}
