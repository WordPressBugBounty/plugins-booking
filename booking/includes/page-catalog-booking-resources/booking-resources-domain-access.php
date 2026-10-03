<?php
/**
 * Booking Resources domain authorization helpers.
 *
 * @package Booking Calendar
 * @since   11.9.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'wpbc_catalog_booking_resources_get_role_capability' ) ) {
	/**
	 * Map an established Booking Calendar minimum-role option to a capability.
	 *
	 * This belongs to the Resource domain rather than its catalog page because
	 * other authorized consumers, including the Setup Wizard, create Resources
	 * without loading the catalog UI.
	 *
	 * @param string $role_option Booking Calendar option containing a minimum role.
	 *
	 * @return string WordPress capability name.
	 */
	function wpbc_catalog_booking_resources_get_role_capability( $role_option ) {
		$minimum_role = get_bk_option( sanitize_key( $role_option ) );
		$capabilities = array(
			'administrator' => 'activate_plugins',
			'editor'        => 'publish_pages',
			'author'        => 'publish_posts',
			'contributor'   => 'edit_posts',
			'subscriber'    => 'read',
		);

		return isset( $capabilities[ $minimum_role ] ) ? $capabilities[ $minimum_role ] : 'manage_options';
	}
}

if ( ! function_exists( 'wpbc_catalog_booking_resources_get_manage_capability' ) ) {
	/**
	 * Return the capability required by the canonical Resources role setting.
	 *
	 * Free installations use the Settings role because they do not expose the
	 * multi-resource role option. Paid editions use the Resources role so every
	 * Resource-domain consumer enforces the same administration boundary.
	 *
	 * @return string WordPress capability name.
	 */
	function wpbc_catalog_booking_resources_get_manage_capability() {
		$role_option = class_exists( 'wpdev_bk_personal' ) ? 'booking_user_role_resources' : 'booking_user_role_settings';
		$capability  = wpbc_catalog_booking_resources_get_role_capability( $role_option );

		/**
		 * Filter the capability required to manage Booking Resources.
		 *
		 * @param string $capability WordPress capability name.
		 */
		return (string) apply_filters( 'wpbc_catalog_booking_resources_manage_capability', $capability );
	}
}
