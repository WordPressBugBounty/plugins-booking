<?php
/**
 * First-install state and activation-intent contracts for Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__, 2 ) . '/_functions/class-wpbc-environment-policy.php';

/**
 * Own immutable first-install markers and versioned activation redirect intent.
 *
 * Genuine-install detection runs before activation creates tables and options.
 * This class converts that request-scoped result into a small transient payload
 * which the following administration request can route without re-detecting an
 * already-mutated installation.
 */
final class WPBC_Setup_Wizard_First_Install_State {

	/** Current activation redirect payload version. */
	const REDIRECT_SCHEMA_VERSION = 2;

	/** Schema version for updater-to-runtime navigation handoff records. */
	const UPDATE_CONTEXT_SCHEMA_VERSION = 1;

	/** Setup Wizard-owned transient containing the structured activation intent. */
	const ACTIVATION_INTENT_TRANSIENT = '_booking_setup_wizard_activation_redirect_intent';

	/** Lifetime of immediate activation navigation state, matching the released redirect contract. */
	const ACTIVATION_INTENT_TTL = 30;

	/** Lifetime of a manual-update redirect waiting for the initiating administrator. */
	const MANUAL_UPDATE_INTENT_TTL = 3600;

	/** Maximum age of an updater-to-runtime handoff record. */
	const UPDATE_CONTEXT_TTL = 3600;

	/** Redirect destination for a genuine first installation. */
	const DESTINATION_SETUP_WIZARD = 'setup_wizard';

	/** Legacy first-install destination accepted during the 11.9 development transition. */
	const DESTINATION_BOOKING_LISTING = 'booking_listing_setup_prompt';

	/** Redirect destination for an update or reactivation. */
	const DESTINATION_WHATS_NEW = 'whats_new';

	/** Persistent option carrying updater context across replaced plugin files. */
	const UPDATE_CONTEXT_OPTION = 'booking_update_navigation_context';

	/** Interactive single-plugin update source. */
	const UPDATE_SOURCE_MANUAL = 'manual_single_plugin_update';

	/** Automatic, command-line, or otherwise non-interactive update source. */
	const UPDATE_SOURCE_SUPPRESSED = 'non_interactive_update';

	/**
	 * Check the activation-owned persistent genuine-install marker.
	 *
	 * @return bool True only for a site initialized by the genuine first-install path.
	 */
	public static function is_initial_install_site() {
		return 'On' === get_bk_option( 'booking_setup_wizard_initial_install' );
	}

	/**
	 * Build the transient redirect intent before activation mutates install state.
	 *
	 * @param bool     $is_initial_install Whether activation began from an empty installation.
	 * @param string   $plugin_version     Booking Calendar version being activated.
	 * @param string   $source             Request source used for diagnostics and routing.
	 * @param int|null $user_id            WordPress user who should receive the redirect. Defaults to the current user.
	 *
	 * @return array{schema_version:int,destination:string,plugin_version:string,source:string,user_id:int} Redirect intent.
	 */
	public static function create_activation_redirect_intent( $is_initial_install, $plugin_version, $source = 'activation', $user_id = null ) {
		if ( null === $user_id ) {
			$user_id = function_exists( 'get_current_user_id' ) ? get_current_user_id() : 0;
		}

		return array(
			'schema_version' => self::REDIRECT_SCHEMA_VERSION,
			'destination'    => $is_initial_install ? self::DESTINATION_SETUP_WIZARD : self::DESTINATION_WHATS_NEW,
			'plugin_version' => sanitize_text_field( (string) $plugin_version ),
			'source'         => sanitize_key( (string) $source ),
			'user_id'        => absint( $user_id ),
		);
	}

	/**
	 * Determine whether a transient contains the current first-install intent.
	 *
	 * Boolean values created by earlier Booking Calendar versions deliberately
	 * return false so the released What's New redirect remains their safe fallback.
	 *
	 * @param mixed $redirect_intent Stored activation redirect transient.
	 *
	 * @return bool True for a current, explicit first-install redirect intent.
	 */
	public static function is_first_install_redirect_intent( $redirect_intent ) {
		if ( ! is_array( $redirect_intent ) ) {
			return false;
		}

		$schema_version = absint( isset( $redirect_intent['schema_version'] ) ? $redirect_intent['schema_version'] : 0 );
		$destination    = isset( $redirect_intent['destination'] ) ? $redirect_intent['destination'] : '';

		return (
			self::REDIRECT_SCHEMA_VERSION === $schema_version
			&& self::DESTINATION_SETUP_WIZARD === $destination
		) || (
			1 === $schema_version
			&& self::DESTINATION_BOOKING_LISTING === $destination
		);
	}

	/**
	 * Determine whether a transient requests the current What's New page.
	 *
	 * Version 1 payloads are accepted so a request that crosses a package update
	 * remains compatible with the earlier 11.9 development contract.
	 *
	 * @param mixed $redirect_intent Stored activation redirect transient.
	 *
	 * @return bool True for a supported What's New redirect intent.
	 */
	public static function is_whats_new_redirect_intent( $redirect_intent ) {
		if ( ! is_array( $redirect_intent ) ) {
			return false;
		}

		$schema_version = absint( isset( $redirect_intent['schema_version'] ) ? $redirect_intent['schema_version'] : 0 );
		$destination    = isset( $redirect_intent['destination'] ) ? $redirect_intent['destination'] : '';

		return in_array( $schema_version, array( 1, self::REDIRECT_SCHEMA_VERSION ), true )
			&& self::DESTINATION_WHATS_NEW === $destination;
	}

	/**
	 * Check whether a redirect intent belongs to the current administrator.
	 *
	 * Older payloads and command-line payloads do not contain a positive user ID,
	 * so they retain the released site-scoped behavior.
	 *
	 * @param mixed $redirect_intent Stored activation redirect transient.
	 *
	 * @return bool True when the current request may consume the intent.
	 */
	public static function is_redirect_intent_for_current_user( $redirect_intent ) {
		if ( ! is_array( $redirect_intent ) ) {
			return false;
		}

		$intent_user_id  = absint( isset( $redirect_intent['user_id'] ) ? $redirect_intent['user_id'] : 0 );
		$current_user_id = function_exists( 'get_current_user_id' ) ? get_current_user_id() : 0;

		return 0 === $intent_user_id || $intent_user_id === absint( $current_user_id );
	}

	/**
	 * Persist the completed updater request context for the newly installed package.
	 *
	 * WordPress continues executing the previously loaded PHP after replacing a
	 * plugin. The installed file header is therefore used as the target version,
	 * allowing the next request to run the new activation code and decide whether
	 * navigation is appropriate without confusing an automatic update with a
	 * manual Update now action.
	 *
	 * @param string $plugin_file    Absolute path to the plugin's main file.
	 * @param string $loaded_version Version of the PHP code loaded for the updater request.
	 *
	 * @return bool True when a newer package context was stored.
	 */
	public static function record_completed_plugin_update( $plugin_file, $loaded_version ) {
		$plugin_file      = (string) $plugin_file;
		$loaded_version   = sanitize_text_field( (string) $loaded_version );
		$installed_header = is_readable( $plugin_file ) && function_exists( 'get_file_data' )
			? get_file_data( $plugin_file, array( 'version' => 'Version' ), 'plugin' )
			: array();
		$installed_version = isset( $installed_header['version'] )
			? sanitize_text_field( (string) $installed_header['version'] )
			: '';

		if ( '' === $installed_version || '' === $loaded_version || version_compare( $installed_version, $loaded_version, '<=' ) ) {
			return false;
		}

		$contexts = get_bk_option( self::UPDATE_CONTEXT_OPTION );
		$contexts = is_array( $contexts ) ? $contexts : array();
		$context_key = self::get_update_context_key( $plugin_file );
		$contexts[ $context_key ] = array(
			'schema_version' => self::UPDATE_CONTEXT_SCHEMA_VERSION,
			'target_version' => $installed_version,
			'source'         => self::is_manual_single_plugin_update_request( $plugin_file )
				? self::UPDATE_SOURCE_MANUAL
				: self::UPDATE_SOURCE_SUPPRESSED,
			'user_id'        => function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0,
			'recorded_at'    => time(),
		);

		update_bk_option( self::UPDATE_CONTEXT_OPTION, $contexts );

		return true;
	}

	/**
	 * Read a valid updater context for one package and target version.
	 *
	 * @param string $plugin_file    Absolute path to the plugin's main file.
	 * @param string $plugin_version Version now loaded from the installed package.
	 *
	 * @return array|false Valid context, or false for an external/stale replacement.
	 */
	public static function get_plugin_update_context( $plugin_file, $plugin_version ) {
		$contexts    = get_bk_option( self::UPDATE_CONTEXT_OPTION );
		$context_key = self::get_update_context_key( $plugin_file );
		$context     = is_array( $contexts ) && isset( $contexts[ $context_key ] ) && is_array( $contexts[ $context_key ] )
			? $contexts[ $context_key ]
			: array();
		$recorded_at = absint( isset( $context['recorded_at'] ) ? $context['recorded_at'] : 0 );
		$current_time = time();

		if (
			self::UPDATE_CONTEXT_SCHEMA_VERSION !== absint( isset( $context['schema_version'] ) ? $context['schema_version'] : 0 )
			|| sanitize_text_field( (string) $plugin_version ) !== ( isset( $context['target_version'] ) ? $context['target_version'] : '' )
			|| 0 === $recorded_at
			|| $recorded_at > ( $current_time + 300 )
			|| $recorded_at < ( $current_time - self::UPDATE_CONTEXT_TTL )
			|| ! in_array(
				isset( $context['source'] ) ? $context['source'] : '',
				array( self::UPDATE_SOURCE_MANUAL, self::UPDATE_SOURCE_SUPPRESSED ),
				true
			)
		) {
			return false;
		}

		return $context;
	}

	/**
	 * Remove one package's updater handoff after activation has completed.
	 *
	 * @param string $plugin_file Absolute path to the plugin's main file.
	 *
	 * @return void
	 */
	public static function clear_plugin_update_context( $plugin_file ) {
		$contexts = get_bk_option( self::UPDATE_CONTEXT_OPTION );
		if ( ! is_array( $contexts ) ) {
			return;
		}

		$context_key = self::get_update_context_key( $plugin_file );
		unset( $contexts[ $context_key ] );

		if ( empty( $contexts ) ) {
			delete_bk_option( self::UPDATE_CONTEXT_OPTION );
			return;
		}

		update_bk_option( self::UPDATE_CONTEXT_OPTION, $contexts );
	}

	/**
	 * Detect WordPress's interactive, single-plugin Update now request shapes.
	 *
	 * AJAX `update-plugin` and the legacy `update.php?action=upgrade-plugin`
	 * request are intentionally accepted. Cron, WP-CLI, and Network Admin updater
	 * requests are excluded so they cannot take over later navigation. WordPress
	 * sends queued Plugins-screen bulk updates through the same `update-plugin`
	 * request shape, so those remain interactive administrator updates.
	 *
	 * @param string $plugin_file Absolute path to the plugin's main file.
	 *
	 * @return bool True only for an interactive update of this exact plugin.
	 */
	public static function is_manual_single_plugin_update_request( $plugin_file ) {
		if (
			( defined( 'WP_CLI' ) && WP_CLI )
			|| ( function_exists( 'wp_doing_cron' ) && wp_doing_cron() )
			|| is_network_admin()
		) {
			return false;
		}

		$expected_plugin = function_exists( 'plugin_basename' ) ? plugin_basename( $plugin_file ) : basename( $plugin_file );

		if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Core verifies the updater nonce before this post-install filter runs.
			$request_action = isset( $_POST['action'] ) && is_scalar( $_POST['action'] ) ? sanitize_key( wp_unslash( $_POST['action'] ) ) : '';
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Read-only request classification after the authorized core update.
			$request_plugin = isset( $_POST['plugin'] ) && is_scalar( $_POST['plugin'] ) ? sanitize_text_field( wp_unslash( $_POST['plugin'] ) ) : '';

			return 'update-plugin' === $request_action
				&& $expected_plugin === ( function_exists( 'plugin_basename' ) ? plugin_basename( $request_plugin ) : $request_plugin );
		}

		global $pagenow;
		if ( 'update.php' !== $pagenow ) {
			return false;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Core verifies the updater nonce before this post-install filter runs.
		$request_action = isset( $_GET['action'] ) && is_scalar( $_GET['action'] ) ? sanitize_key( wp_unslash( $_GET['action'] ) ) : '';
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only request classification after the authorized core update.
		$request_plugin = isset( $_GET['plugin'] ) && is_scalar( $_GET['plugin'] ) ? sanitize_text_field( wp_unslash( $_GET['plugin'] ) ) : '';

		return 'upgrade-plugin' === $request_action
			&& $expected_plugin === ( function_exists( 'plugin_basename' ) ? plugin_basename( $request_plugin ) : $request_plugin );
	}

	/**
	 * Build an option key that keeps Free and paid package handoffs independent.
	 *
	 * @param string $plugin_file Absolute path to the plugin's main file.
	 *
	 * @return string Stable non-sensitive package key.
	 */
	private static function get_update_context_key( $plugin_file ) {
		$plugin_basename = function_exists( 'plugin_basename' ) ? plugin_basename( $plugin_file ) : basename( $plugin_file );

		return md5( strtolower( (string) $plugin_basename ) );
	}

	/**
	 * Check environments where automatic onboarding must never take over navigation.
	 *
	 * Manual access to Setup Wizard remains governed by its normal access and
	 * environment policies. This restriction applies only to automatic activation
	 * redirects and the one-time Booking Listing invitation.
	 *
	 * @return bool True when automatic onboarding must remain suppressed.
	 */
	public static function is_automatic_onboarding_restricted() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only activation context detection.
		$is_bulk_activation = isset( $_GET['activate-multi'] );

		return ! WPBC_Environment_Policy::allows_automatic_setup_onboarding()
			|| is_network_admin()
			|| $is_bulk_activation
			|| defined( 'IFRAME_REQUEST' );
	}
}
