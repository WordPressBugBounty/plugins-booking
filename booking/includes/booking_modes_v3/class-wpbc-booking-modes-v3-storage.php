<?php
/**
 * Owner-scoped Booking Modes V3 persistence.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Preserve the released booking_admin_mode user option without write-on-read.
 */
final class WPBC_Booking_Modes_V3_Storage {

	const OPTION_NAME = 'booking_admin_mode';

	/** @var WPBC_Booking_Modes_V3_Storage|null */
	private static $instance = null;

	/** @var array<int,string> */
	private $selected_modes = array();

	/** @var int */
	private $read_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Return the shared persistence instance.
	 *
	 * @return WPBC_Booking_Modes_V3_Storage Storage instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Resolve the effective Booking Calendar owner for this request.
	 *
	 * @return int Owner user ID, or zero when signed out.
	 */
	public function get_owner_user_id() {
		$context       = WPBC_Booking_Modes_V3_Context::get_instance()->get_context();
		$owner_user_id = isset( $context['owner_user_id'] ) ? absint( $context['owner_user_id'] ) : 0;

		/**
		 * Filter the owner used by released Booking Modes persistence.
		 *
		 * @param int   $owner_user_id Effective Booking Calendar owner.
		 * @param array $context       Cached request context.
		 */
		$owner_user_id = apply_filters( 'wpbc_booking_modes_owner_user_id', $owner_user_id, $context );

		return is_scalar( $owner_user_id ) ? absint( $owner_user_id ) : 0;
	}

	/**
	 * Read one owner's selected mode, defaulting to Classic without writing.
	 *
	 * @param int $owner_user_id Optional explicit owner; zero uses context.
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
		$stored_mode_id  = get_user_option( self::OPTION_NAME, $owner_user_id );
		$stored_mode_id  = is_scalar( $stored_mode_id ) ? sanitize_key( (string) $stored_mode_id ) : '';
		$allowed_mode_ids = wpbc_booking_modes_get_allowed_mode_ids();
		$selected_mode_id = in_array( $stored_mode_id, $allowed_mode_ids, true ) ? $stored_mode_id : 'classic';
		$this->selected_modes[ $owner_user_id ] = $selected_mode_id;

		return $selected_mode_id;
	}

	/**
	 * Save an explicit selection after an external authorization boundary.
	 *
	 * @param string $mode_id       Requested mode ID.
	 * @param int    $owner_user_id Optional explicit owner; zero uses context.
	 *
	 * @return bool|WP_Error True on success, otherwise a validation/storage error.
	 */
	public function set_selected_mode_id( $mode_id, $owner_user_id = 0 ) {
		$mode_id                 = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
		$current_owner_user_id   = $this->get_owner_user_id();
		$requested_owner_user_id = absint( $owner_user_id );
		$owner_user_id           = $requested_owner_user_id > 0 ? $requested_owner_user_id : $current_owner_user_id;

		if ( $owner_user_id <= 0 || $owner_user_id !== $current_owner_user_id ) {
			return new WP_Error( 'wpbc_booking_mode_owner_mismatch', __( 'The administration mode can be saved only for the active Booking Calendar owner.', 'booking' ) );
		}
		if ( ! in_array( $mode_id, wpbc_booking_modes_get_allowed_mode_ids(), true ) ) {
			return new WP_Error( 'wpbc_booking_mode_invalid', __( 'The selected Booking Calendar administration mode is not available.', 'booking' ) );
		}

		$is_updated = update_user_option( $owner_user_id, self::OPTION_NAME, $mode_id );
		if ( false === $is_updated ) {
			$stored_mode_id = get_user_option( self::OPTION_NAME, $owner_user_id );
			$stored_mode_id = is_scalar( $stored_mode_id ) ? sanitize_key( (string) $stored_mode_id ) : '';
			if ( $mode_id !== $stored_mode_id ) {
				return new WP_Error( 'wpbc_booking_mode_not_saved', __( 'The Booking Calendar administration mode could not be saved.', 'booking' ) );
			}
		}

		$this->selected_modes[ $owner_user_id ] = $mode_id;
		return true;
	}

	/**
	 * Return user-option reads performed in this request.
	 *
	 * @return int Read count.
	 */
	public function get_read_count() {
		return $this->read_count;
	}
}
