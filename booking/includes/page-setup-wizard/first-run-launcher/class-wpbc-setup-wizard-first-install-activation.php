<?php
/**
 * Genuine first-install activation integration for Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Route a genuine first installation directly to the Setup Wizard.
 *
 * Update and reactivation intents are intentionally ignored here so the released
 * Welcome controller can continue opening What's New. Legacy boolean transients
 * are also left to that compatibility path.
 */
final class WPBC_Setup_Wizard_First_Install_Activation {

	/** Legacy Free redirect transient shared with the released Welcome controller. */
	const LEGACY_REDIRECT_TRANSIENT = '_booking_activation_redirect';

	/** Legacy paid redirect transient written by older Pro activation callbacks. */
	const LEGACY_PRO_REDIRECT_TRANSIENT = '_booking_pro_activation_redirect';

	/**
	 * Register the first-install redirect before the released What's New handler.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'admin_init', array( __CLASS__, 'maybe_redirect_to_setup_wizard' ), 5 );
	}

	/**
	 * Consume a genuine-install intent and open the canonical Setup Wizard.
	 *
	 * Starting automatically is equivalent to choosing Start guided setup from
	 * the fallback invitation: the invitation is consumed, while no checkpoint
	 * or canonical setting is created until the first successful wizard save.
	 *
	 * @return void
	 */
	public static function maybe_redirect_to_setup_wizard() {
		if ( 'On' === get_bk_option( 'booking_activation_process' ) ) {
			return;
		}

		if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) {
			return;
		}

		$redirect_intent = get_transient( WPBC_Setup_Wizard_First_Install_State::ACTIVATION_INTENT_TRANSIENT );
		if ( ! WPBC_Setup_Wizard_First_Install_State::is_first_install_redirect_intent( $redirect_intent ) ) {
			return;
		}
		if ( ! WPBC_Setup_Wizard_First_Install_State::is_redirect_intent_for_current_user( $redirect_intent ) ) {
			return;
		}

		if ( WPBC_Setup_Wizard_First_Install_State::is_automatic_onboarding_restricted() ) {
			delete_transient( WPBC_Setup_Wizard_First_Install_State::ACTIVATION_INTENT_TRANSIENT );
			delete_transient( self::LEGACY_REDIRECT_TRANSIENT );
			delete_transient( self::LEGACY_PRO_REDIRECT_TRANSIENT );
			return;
		}

		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			return;
		}

		delete_transient( WPBC_Setup_Wizard_First_Install_State::ACTIVATION_INTENT_TRANSIENT );
		delete_transient( self::LEGACY_REDIRECT_TRANSIENT );
		delete_transient( self::LEGACY_PRO_REDIRECT_TRANSIENT );

		$redirect_for_version = get_bk_option( 'booking_activation_redirect_for_version' );
		if ( WP_BK_VERSION_NUM === $redirect_for_version ) {
			return;
		}

		update_bk_option( 'booking_activation_redirect_for_version', WP_BK_VERSION_NUM );
		update_bk_option( 'booking_setup_wizard_first_run_prompt', 'Off' );

		wp_safe_redirect( wpbc_get_setup_wizard_page_url() );
		exit;
	}

	/**
	 * Compatibility alias for the earlier 11.9 development callback name.
	 *
	 * @deprecated 11.9 Use maybe_redirect_to_setup_wizard().
	 *
	 * @return void
	 */
	public static function maybe_redirect_to_booking_listing() {
		self::maybe_redirect_to_setup_wizard();
	}
}
