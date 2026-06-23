<?php
/**
 * Front-end booking form settings helpers.
 *
 * @package Booking Calendar
 * @since   11.2.1.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! class_exists( 'WPBC_Frontend_Settings' ) ) {

	/**
	 * Shared front-end settings helper.
	 */
	class WPBC_Frontend_Settings {

		/**
		 * Is the BFB feature compiled/available in this build.
		 *
		 * @return bool
		 */
		public static function is_bfb_feature_available() {
			return ( defined( 'WPBC_NEW_FORM_BUILDER' ) && WPBC_NEW_FORM_BUILDER );
		}

		/**
		 * Is BFB enabled in settings.
		 *
		 * @param mixed $ctx Optional context for filters.
		 *
		 * @return bool
		 */
		public static function is_bfb_enabled( $ctx = null ) {

			if ( ! self::is_bfb_feature_available() ) {
				return false;
			}

			$is_enabled = ( 'On' === get_bk_option( 'booking_use_bfb_form' ) );

			/**
			 * Allow forcing enable/disable externally if needed.
			 *
			 * @param bool  $is_enabled
			 * @param mixed $ctx
			 */
			$is_enabled = (bool) apply_filters( 'wpbc_frontend_is_bfb_enabled', $is_enabled, $ctx );

			return $is_enabled;
		}
	}
}
