<?php
/**
 * Hybrid++ Bootstrap: collect packs, localize schemas, print pack templates.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.0
 * @modified    2025-08-29
 * @version     1.0
 */

// ---------------------------------------------------------------------------------------------------------------------
// == File  bfb-bootstrap.php == Time point: 2025-08-29 12:25
// ---------------------------------------------------------------------------------------------------------------------
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


class WPBC_BFB_Bootstrap {

	/**
	 * Guard flag.
	 *
	 * @var bool
	 */
	protected static $packs_collected = false;

	/**
	 * Guard flag.
	 *
	 * @var bool
	 */
	protected static $templates_printed = false;

	/**
	 * Packs keyed by type.
	 *
	 * @var array
	 */
	protected static $packs_by_type = array();


	/**
	 * Init all hooks for the current request.
	 *
	 * @return void
	 */
	public static function init() {

		// 1) Enqueue BFB scripts, after enqueued basic WPBC scripts (EXTERNAL HOOK).  Localize schemas, etc...
		add_action( 'wpbc_enqueue_js_files', array( __CLASS__, 'on_admin_enqueue__js_files' ), 50 );

		// 2) Enqueue BFB CSS, after basic WPBC scripts are enqueued  (EXTERNAL HOOK).
		add_action( 'wpbc_enqueue_css_files', array( __CLASS__, 'on_admin_enqueue__css_files' ), 50 );

		// 3) Primary: print templates at the end of the page using custom footer hook. The hook passes the slug; we only print when it equals our builder slug.
		add_action( 'wpbc_hook_settings_page_footer', array( __CLASS__, 'on_settings_page_footer' ), 10, 1 );

		// 4) Fallback printer (for the URL path) so templates still print if the custom footer hook isn’t fired.
		add_action( 'admin_print_footer_scripts', array( __CLASS__, 'fallback_print_on_admin_footer' ), 20 );
	}


	/**
	 * Enqueue JS files and Localize them.
	 *
	 * @param sring $where_to_load - parameter from root JS loader script. Value can be: 'both', 'client', 'admin'. In this method can be ignore,  because we check  via self::is_builder_by_request().
	 *
	 * @return void
	 */
	public static function on_admin_enqueue__js_files( $where_to_load ) {

		if ( ! self::is_builder_by_request() ) {
			// Might still reach the page via the custom footer hook path; in that case we'll only print templates there.
			return;
		}
		$in_footer   = true;
		$core_handle = apply_filters( 'wpbc_bfb_inspector_script_handle', 'wpbc-bfb' );

		// --- Vendor ---
		wp_enqueue_script( 'wpbc-sortable', wpbc_plugin_url( '/vendors/sortablejs/Sortable.min.js' ), array( 'wpbc_all' ), WP_BK_VERSION_NUM, $in_footer );

		// --- Color picker (Coloris) ---   Load BEFORE core BFB scripts so the Inspector can detect window.Coloris during first render.
		wp_enqueue_style( 'coloris', wpbc_plugin_url( '/vendors/coloris/dist/coloris.min.css' ), array(), WP_BK_VERSION_NUM );
		wp_enqueue_script( 'coloris', wpbc_plugin_url( '/vendors/coloris/dist/coloris.min.js' ), array(), WP_BK_VERSION_NUM, $in_footer );


		// -- Admin WP Templates Helper (for modals etc..).
		wp_enqueue_script( 'wpbc-bfb-templates', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/bfb-templates.js' ), array( 'wp-util' ), WP_BK_VERSION_NUM, $in_footer );

		// --- Support Functions ---
		wp_enqueue_script( 'wpbc-bfb_support_functions', wpbc_plugin_url( '/includes/page-form-builder/_src/support_functions.js' ), array(), WP_BK_VERSION_NUM, $in_footer );

		// --- All Core BFB Scripts ---
		wp_enqueue_script( $core_handle, wpbc_plugin_url( '/_dist/bfb/_out/wpbc_bfb.js' ), array( 'wpbc-bfb_support_functions', 'wpbc-sortable', 'wp-util', 'wpbc-bfb-templates', 'coloris' ), WP_BK_VERSION_NUM, $in_footer );

		// 2) --- Time Utils ---
		wp_enqueue_script( 'wpbc-bfb-time-utils', wpbc_plugin_url( '/includes/page-form-builder/_out/bfb-time-utils.js' ), array( $core_handle ), WP_BK_VERSION_NUM, $in_footer );

		// 3) --- Field packs (they can now safely reference wpbc_bfb_inspector_factory_slots/value_from)
		do_action( 'wpbc_enqueue_js_field_pack', WPBC_BFB_BUILDER_PAGE_SLUG );

		// 5) --- Builder ---
		wp_enqueue_script( 'wpbc-bfb_builder', wpbc_plugin_url( '/includes/page-form-builder/_out/bfb-builder.js' ), array( $core_handle ), WP_BK_VERSION_NUM, $in_footer );

		// -------------------------------------------------------------------------------------------------------------
		// == Self attached modules here ==  - (AFTER builder, because it auto-attaches via wpbc_bfb_api.ready) ---
		// -------------------------------------------------------------------------------------------------------------
		// --- Modals, such as page deleteing etc..
		wp_enqueue_script( 'wpbc-bfb_modal__form_templates', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/modal__form_templates.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb_modal_page_delete', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/modal_page_delete.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb_modal_item_delete', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/modal_item_delete.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb_modal__form_add_new', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/modal__form_add_new.js' ), array( 'wpbc-bfb_builder', 'wpbc-bfb_modal__form_templates' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb_modal__form_save_as', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/modal__form_save_as.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb_modal__form_open', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/modal__form_open.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb_modal__apply_template', wpbc_plugin_url( '/includes/page-form-builder/admin-page-tpl/_out/modal__form_apply_template.js' ), array( 'wpbc-bfb_builder', 'wpbc-bfb_modal__form_templates' ), WP_BK_VERSION_NUM, $in_footer );

		// Form Settings.
		// // FixIn: 2026-01-24 wp_enqueue_script( 'wpbc-bfb-so', wpbc_plugin_url( '/includes/page-form-builder/settings-options/_out/bfb-so.js' ), array( 'jquery', 'wp-util', 'wpbc-save-load-option' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb-form_settings', wpbc_plugin_url( '/includes/page-form-builder/form-settings/_out/settings.js' ), array( 'jquery', 'wp-util', 'wpbc-save-load-option' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb-global_save_behavior', wpbc_plugin_url( '/includes/page-form-builder/form-settings/_out/global_save_behavior.js' ), array( 'wpbc-bfb-form_settings' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb-form_settings_effects', wpbc_plugin_url( '/includes/page-form-builder/form-settings/_out/settings_effects.js' ), array( 'wpbc-bfb-form_settings' ), WP_BK_VERSION_NUM, $in_footer );
		// wp_localize_script( 'wpbc-bfb-form_settings', 'wpbc_bfb_settings_vars', array( 'plugin_url' => wpbc_plugin_url( '' ), ) );

		// Form Details.
		wp_enqueue_script( 'wpbc-bfb-form_details_ui', wpbc_plugin_url( '/includes/page-form-builder/form-details/_out/current-form-details-ui.js' ), array( 'wpbc-bfb-form_settings' ), WP_BK_VERSION_NUM, $in_footer );
		wp_enqueue_script( 'wpbc-bfb-form_details_save_delete', wpbc_plugin_url( '/includes/page-form-builder/form-details/_out/current-form-details-save_delete.js' ), array( 'wpbc-bfb-form_settings' ), WP_BK_VERSION_NUM, $in_footer );



		wp_enqueue_script( 'wpbc-bfb-top-tabs', wpbc_plugin_url( '/includes/page-form-builder/ui-parts/_out/bfb-top-tabs.js' ), array(), WP_BK_VERSION_NUM, true );

		// --- Ajax for Save / Load ---
		wp_enqueue_script( 'wpbc-bfb_save_load_ajax', wpbc_plugin_url( '/includes/page-form-builder/ajax/_out/bfb-ajax.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );

		// --- Exporter ---
		wp_enqueue_script( 'wpbc-bfb_exporter', wpbc_plugin_url( '/includes/page-form-builder/_out/export/builder-exporter.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );
		if ( WPBC_BFB_DEBUG ) {
			wp_enqueue_script( 'wpbc-bfb_debug_ui', wpbc_plugin_url( '/includes/page-form-builder/_out/export/debug-ui.js' ), array( 'wpbc-bfb_exporter' ), WP_BK_VERSION_NUM, $in_footer );
		}


		// -- Templates (optional tools) --
		wp_enqueue_script( 'wpbc-bfb_form_templates', wpbc_plugin_url( '/includes/page-form-builder/_out/form_templates.js' ), array( 'wpbc-bfb_builder' ), WP_BK_VERSION_NUM, $in_footer );

		// --- Right Tabs ---
		wp_enqueue_script( 'wpbc-bfb_rightbar_tabs', wpbc_plugin_url( '/includes/page-form-builder/_out/bfb-rightbar-tabs.js' ), array( $core_handle ), WP_BK_VERSION_NUM, $in_footer );

		// Enqueue phase: collect & localize schemas if we're on the Builder screen (by URL fallback).
		self::collect_packs_once();
		self::localize_schemas_to_inspector();

		//wpbc_load_js__required_for_modals();
		wpbc_load_js__required_for_media_upload();


		// Loaded JavaScript files for this settings page.
		do_action( 'wpbc_enqueue_js_files_on_page_done', WPBC_BFB_BUILDER_PAGE_SLUG );
	}


	/**
	 * Enqueue CSS files.
	 *
	 * @param sring $where_to_load - parameter from root JS loader script. Value can be: 'both', 'client', 'admin'. In this method can be ignore,  because we check  via self::is_builder_by_request().
	 *
	 * @return void
	 */
	public static function on_admin_enqueue__css_files() {

		if ( ! self::is_builder_by_request() ) {
			// Might still reach the page via the custom footer hook path; in that case we'll only print templates there.
			return;
		}

		wp_enqueue_style( 'wpbc-ajx__builder_booking_form_page', wpbc_plugin_url( '/includes/page-form-builder/_out/builder-form-page.css' ), array(), WP_BK_VERSION_NUM );

		// CSS.
		wpbc_enqueue_styles__front_end();
		wpbc_enqueue_styles__calendar();
	}


	/**
	 * Custom footer hook — primary place to print pack templates.
	 *
	 * @param string $page Page slug passed by the hook (expected: 'wpbc-ajx_booking_builder_booking_form',  e.g. - WPBC_BFB_BUILDER_PAGE_SLUG ).
	 * @return void
	 */
	public static function on_settings_page_footer( $page ) {

		if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
			return;
		}

		// Optional. Doucle ensure packs & schemas ready even if enqueue path didn’t run.
		self::collect_packs_once();
		self::localize_schemas_to_inspector();

		self::print_pack_templates_once( $page );
	}


	/**
	 * Fallback printer (for the URL path) so templates still print if the custom footer hook isn’t fired.
	 *
	 * @return void
	 */
	public static function fallback_print_on_admin_footer() {

		if ( self::$templates_printed ) {
			return;
		}
		if ( ! self::is_builder_by_request() ) {
			return;
		}
		// Ensure packs & localization are ready.
		self::collect_packs_once();
		self::localize_schemas_to_inspector();

		// Print pack templates once.
		self::print_pack_templates_once( WPBC_BFB_BUILDER_PAGE_SLUG );
	}


	// -- PROTECTED --

	/**
	 * Collect packs via filter (only once).
	 *
	 * @return void
	 */
	protected static function collect_packs_once() {
		if ( self::$packs_collected ) {
			return;
		}
		$packs_raw             = apply_filters( 'wpbc_bfb_register_field_packs', array() );
		$packs_raw             = is_array( $packs_raw ) ? $packs_raw : array();
		self::$packs_by_type   = WPBC_BFB_Schemas_Util::merge_packs( $packs_raw );
		self::$packs_collected = true;
	}

	/**
	 * Localize schemas to the inspector script handle.
	 *
	 * @return void
	 */
	protected static function localize_schemas_to_inspector() {

		$handle = apply_filters( 'wpbc_bfb_inspector_script_handle', 'wpbc-bfb' );

		// If the handle isn't registered yet, try again later in the same request (once).
		if ( ! wp_script_is( $handle, 'registered' ) && ! wp_script_is( $handle, 'enqueued' ) ) {
			// As a last resort, hook wp_print_scripts for this page load so we don't miss it.
			add_action( 'admin_print_scripts', function () use ( $handle ) {
				if ( wp_script_is( $handle, 'registered' ) || wp_script_is( $handle, 'enqueued' ) ) {
					WPBC_BFB_Bootstrap::do_localize( $handle );
				}
			}, 100 );
			return;
		}

		self::do_localize( $handle );
	}

	/**
	 * Perform the actual localization.
	 *
	 * @param string $handle
	 * @return void
	 */
	protected static function do_localize( $handle ) {
		$js_payload = WPBC_BFB_Schemas_Util::extract_schemas_for_js( self::$packs_by_type );
		wp_localize_script( $handle, 'WPBC_BFB_Schemas', $js_payload );
	}

	/**
	 * Print templates for all collected packs (only once).
	 *
	 * @param string $page
	 * @return void
	 */
	protected static function print_pack_templates_once( $page ) {

		if ( self::$templates_printed ) {
			return;
		}
		foreach ( self::$packs_by_type as $pack ) {
			if ( isset( $pack['templates_printer'] ) && is_callable( $pack['templates_printer'] ) ) {
				call_user_func( $pack['templates_printer'], $page );
			}
		}
		self::$templates_printed = true;
	}

	/**
	 * Request-based detection of the Builder settings tab:    page=wpbc-settings&tab=builder_booking_form
	 *
	 * @return bool
	 */
	protected static function is_builder_by_request() {

		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';   // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$tab  = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';     // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing

		return ( 'wpbc-settings' === $page && 'builder_booking_form' === $tab );
	}
}
