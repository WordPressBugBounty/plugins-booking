<?php
/**
 * Authorization policy for the production Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve and enforce the complete Setup Wizard access boundary.
 */
final class WPBC_Setup_Wizard_Access {

	/**
	 * Determine the current settings capability configured by Booking Calendar.
	 *
	 * @return string WordPress capability required to access the Setup Wizard.
	 */
	public static function get_required_capability() {
		$minimum_role = get_bk_option( 'booking_user_role_settings' );
		$role_map     = array(
			'administrator' => 'activate_plugins',
			'editor'        => 'publish_pages',
			'author'        => 'publish_posts',
			'contributor'   => 'edit_posts',
			'subscriber'    => 'read',
		);

		return isset( $role_map[ $minimum_role ] ) ? $role_map[ $minimum_role ] : 'read';
	}

	/**
	 * Check capability, MultiUser super-administrator, and activation policies.
	 *
	 * This method is used independently by the page and every state-changing or
	 * privileged endpoint. It never trusts a client-provided site or owner ID.
	 *
	 * @return bool True when the current authenticated user may use the wizard.
	 */
	public static function current_user_can_access() {
		if ( ! is_user_logged_in() || ! current_user_can( self::get_required_capability() ) ) {
			return false;
		}

		if ( class_exists( 'wpdev_bk_multiuser' ) ) {
			$real_user_id       = get_current_user_id();
			$is_super_admin_user = apply_bk_filter( 'is_user_super_admin', $real_user_id );
			if ( ! $is_super_admin_user ) {
				return false;
			}
		}

		if ( function_exists( 'wpbc_is_mu_user_can_be_here' ) && ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Return the server-owned storage context for the current request.
	 *
	 * The real WordPress user scopes user-option storage. The effective Booking
	 * Calendar owner separates MultiUser simulated sessions, while the site ID
	 * prevents cross-site checkpoint reuse on multisite.
	 *
	 * @return array{real_user_id:int,owner_user_id:int,site_id:int} Storage context.
	 */
	public static function get_storage_context() {
		$real_user_id  = get_current_user_id();
		$owner_user_id = function_exists( 'wpbc_get_current_user_id' ) ? wpbc_get_current_user_id() : $real_user_id;

		return array(
			'real_user_id'  => absint( $real_user_id ),
			'owner_user_id' => absint( $owner_user_id ),
			'site_id'       => absint( get_current_blog_id() ),
		);
	}
}
