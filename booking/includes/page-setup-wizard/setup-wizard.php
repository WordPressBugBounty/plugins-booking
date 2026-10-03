<?php
/**
 * Production bootstrap for the Booking Calendar Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! is_admin() ) {
	return;
}

require_once __DIR__ . '/class-wpbc-setup-wizard-access.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-environment-policy.php';
require_once __DIR__ . '/first-run-launcher/class-wpbc-setup-wizard-first-install-state.php';
require_once __DIR__ . '/first-run-launcher/class-wpbc-setup-wizard-first-install-activation.php';
require_once __DIR__ . '/interface-wpbc-setup-wizard-step-module.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-customer-journey-policy.php';
require_once __DIR__ . '/step-date-time-formats/class-wpbc-setup-wizard-date-time-formats.php';
require_once __DIR__ . '/step-date-time-formats/class-wpbc-setup-wizard-date-time-formats-ajax.php';
require_once __DIR__ . '/step-date-time-formats/class-wpbc-setup-wizard-date-time-formats-module.php';
require_once __DIR__ . '/step-date-selection/class-wpbc-setup-wizard-date-selection.php';
require_once __DIR__ . '/step-date-selection/class-wpbc-setup-wizard-date-selection-module.php';
require_once __DIR__ . '/step-days-off/class-wpbc-setup-wizard-days-off.php';
require_once __DIR__ . '/step-days-off/class-wpbc-setup-wizard-days-off-ajax.php';
require_once __DIR__ . '/step-days-off/class-wpbc-setup-wizard-days-off-module.php';
require_once __DIR__ . '/step-services/class-wpbc-setup-wizard-services.php';
require_once __DIR__ . '/step-services/class-wpbc-setup-wizard-services-module.php';
require_once __DIR__ . '/step-booking-resources/class-wpbc-setup-wizard-booking-resources.php';
require_once __DIR__ . '/step-booking-resources/class-wpbc-setup-wizard-booking-resources-module.php';
require_once __DIR__ . '/step-start-end-times/class-wpbc-setup-wizard-start-end-times.php';
require_once __DIR__ . '/step-start-end-times/class-wpbc-setup-wizard-start-end-times-module.php';
require_once __DIR__ . '/step-start-duration-times/class-wpbc-setup-wizard-start-duration-times.php';
require_once __DIR__ . '/step-start-duration-times/class-wpbc-setup-wizard-start-duration-times-module.php';
require_once __DIR__ . '/step-fixed-time-slots/class-wpbc-setup-wizard-fixed-time-slots.php';
require_once __DIR__ . '/step-fixed-time-slots/class-wpbc-setup-wizard-fixed-time-slots-module.php';
require_once __DIR__ . '/step-working-hours/class-wpbc-setup-wizard-working-hours.php';
require_once __DIR__ . '/step-working-hours/class-wpbc-setup-wizard-working-hours-module.php';
require_once __DIR__ . '/step-booking-form-template/class-wpbc-setup-wizard-booking-form-templates.php';
require_once __DIR__ . '/step-booking-form-template/class-wpbc-setup-wizard-booking-form-time-options.php';
require_once __DIR__ . '/step-booking-form-template/class-wpbc-setup-wizard-booking-form-preview.php';
require_once __DIR__ . '/step-booking-form-template/class-wpbc-setup-wizard-booking-form-preview-ajax.php';
require_once __DIR__ . '/step-booking-form-template/class-wpbc-setup-wizard-booking-form-template-module.php';
require_once __DIR__ . '/step-appearance/class-wpbc-setup-wizard-appearance.php';
require_once __DIR__ . '/step-appearance/class-wpbc-setup-wizard-appearance-module.php';
require_once __DIR__ . '/step-publish-integration/class-wpbc-setup-wizard-publish-integration.php';
require_once __DIR__ . '/step-publish-integration/class-wpbc-setup-wizard-publish-integration-module.php';
require_once __DIR__ . '/step-review-setup/class-wpbc-setup-wizard-review-setup.php';
require_once __DIR__ . '/step-review-setup/class-wpbc-setup-wizard-review-setup-module.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-step-module-registry.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-step-registry.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-settings-hints.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-templates.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-step-data.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-draft-validator.php';
require_once __DIR__ . '/interface-wpbc-setup-wizard-checkpoint-store.php';
require_once __DIR__ . '/interface-wpbc-setup-wizard-email-state-store.php';
require_once __DIR__ . '/interface-wpbc-setup-wizard-step-save-handler.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-step-save-registry.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-checkpoint-only-save-handler.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-metadata-save-handler.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-customer-journey-save-handler.php';
require_once __DIR__ . '/step-date-time-formats/class-wpbc-setup-wizard-date-time-formats-save-handler.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-booking-mode-save-handler.php';
require_once __DIR__ . '/step-date-selection/class-wpbc-setup-wizard-date-selection-save-handler.php';
require_once __DIR__ . '/step-services/class-wpbc-setup-wizard-services-save-handler.php';
require_once __DIR__ . '/step-booking-resources/class-wpbc-setup-wizard-booking-resources-save-handler.php';
require_once __DIR__ . '/step-start-end-times/class-wpbc-setup-wizard-start-end-times-save-handler.php';
require_once __DIR__ . '/step-start-duration-times/class-wpbc-setup-wizard-start-duration-times-save-handler.php';
require_once __DIR__ . '/step-fixed-time-slots/class-wpbc-setup-wizard-fixed-time-slots-save-handler.php';
require_once __DIR__ . '/step-working-hours/class-wpbc-setup-wizard-working-hours-save-handler.php';
require_once __DIR__ . '/step-days-off/class-wpbc-setup-wizard-days-off-save-handler.php';
require_once __DIR__ . '/step-booking-form-template/class-wpbc-setup-wizard-booking-form-template-save-handler.php';
require_once __DIR__ . '/step-appearance/class-wpbc-setup-wizard-appearance-save-handler.php';
require_once __DIR__ . '/step-publish-integration/class-wpbc-setup-wizard-publish-integration-save-handler.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-operation-lock.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-draft-store.php';
require_once __DIR__ . '/booking-pages/class-wpbc-setup-wizard-booking-pages.php';
require_once __DIR__ . '/first-run-launcher/class-wpbc-setup-wizard-first-run-launcher.php';
require_once __DIR__ . '/step-review-setup/class-wpbc-setup-wizard-summary-email.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-progressive-save-coordinator.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-progressive-save-factory.php';
require_once __DIR__ . '/ajax/class-wpbc-setup-wizard-ajax.php';
require_once __DIR__ . '/setup-overview/class-wpbc-setup-wizard-setup-overview.php';
require_once __DIR__ . '/setup-overview/class-wpbc-setup-wizard-setup-overview-actions.php';
require_once __DIR__ . '/class-wpbc-setup-wizard-page.php';
WPBC_Setup_Wizard_Ajax::register();
WPBC_Setup_Wizard_Date_Time_Formats_Ajax::register();
WPBC_Setup_Wizard_Days_Off_Ajax::register();
WPBC_Setup_Wizard_Booking_Form_Preview_Ajax::register();
WPBC_Setup_Wizard_Setup_Overview_Actions::register();
WPBC_Setup_Wizard_Booking_Pages::register();
WPBC_Setup_Wizard_First_Run_Launcher::register();
WPBC_Setup_Wizard_First_Install_Activation::register();
add_action( 'admin_init', 'wpbc_setup_wizard_redirect_legacy_settings_action', 1 );
add_action( '_admin_menu', 'wpbc_setup_wizard_register_menu_controller', 20 );
add_action( 'wpbc_menu_created', 'wpbc_setup_wizard_attach_page_controller', 10, 1 );

/**
 * Redirect the released Settings reset bookmark to the canonical Setup Wizard.
 *
 * Older links used the Settings renderer as an intermediate redirect. Keeping
 * that compatibility at the Setup Wizard routing boundary prevents ordinary
 * Settings requests from inspecting or acting on wizard parameters.
 *
 * @return void
 */
function wpbc_setup_wizard_redirect_legacy_settings_action() {
	global $pagenow;

	if ( wp_doing_ajax() || 'admin.php' !== $pagenow ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration routing compatibility.
	$page_slug = isset( $_GET['page'] ) && is_scalar( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration routing compatibility.
	$compatibility_action = isset( $_GET['wpbc_setup_wizard'] ) && is_scalar( $_GET['wpbc_setup_wizard'] )
		? sanitize_key( wp_unslash( $_GET['wpbc_setup_wizard'] ) )
		: '';

	if ( 'wpbc-settings' !== $page_slug || 'reset' !== $compatibility_action ) {
		return;
	}

	if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
		wp_die(
			esc_html__( 'You are not allowed to use this Setup Wizard.', 'booking' ),
			esc_html__( 'Access denied', 'booking' ),
			array( 'response' => 403 )
		);
	}

	wp_safe_redirect( wpbc_get_setup_wizard_page_url() );
	exit;
}

/**
 * Register the canonical menu through the native Booking Calendar menu system.
 *
 * The object is retained for the request because its WordPress callbacks are
 * instance methods. A stable title replaces the legacy progress-title
 * generator, and the same entry remains available before and after completion.
 *
 * @return void
 */
function wpbc_setup_wizard_register_menu_controller() {
	static $menu_controller = null;

	if (
		null !== $menu_controller
		|| ! class_exists( 'WPBC_Admin_Menus' )
		|| ! WPBC_Setup_Wizard_Access::current_user_can_access()
	) {
		return;
	}

	$menu_controller = new WPBC_Admin_Menus(
		'wpbc-setup',
		array(
			'in_menu'        => 'wpbc',
			'menu_title'     => __( 'Setup Wizard', 'booking' ),
			'page_header'    => __( 'Setup Wizard', 'booking' ),
			'browser_header' => __( 'Setup Wizard', 'booking' ) . ' - ' . __( 'Booking Calendar', 'booking' ),
			'user_role'      => get_bk_option( 'booking_user_role_settings' ),
		)
	);
}

/**
 * Attach the page structure after the matching native menu has been created.
 *
 * @param string $menu_tag Booking Calendar menu slug that was just created.
 *
 * @return void
 */
function wpbc_setup_wizard_attach_page_controller( $menu_tag ) {
	static $page_controller = null;

	if ( 'wpbc-setup' !== $menu_tag || null !== $page_controller ) {
		return;
	}

	$page_controller = new WPBC_Setup_Wizard_Page();
}
