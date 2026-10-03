<?php
/**
 * Native administration page for the production Setup Wizard shell.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render the resumable wizard or its completed native administration overview.
 */
final class WPBC_Setup_Wizard_Page extends WPBC_Page_Structure {

	/** @var string Safe Review-summary email error retained for this request. */
	private $review_email_error = '';

	/** @var array<string,mixed>|null Request-local normalized checkpoint cache. */
	private $current_checkpoint = null;

	/** @var array<string,mixed>|null Request-local completed overview cache. */
	private $setup_overview_context = null;

	/**
	 * Attach page-scoped assets and body classes.
	 */
	public function __construct() {
		parent::__construct();

		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_filter( 'admin_body_class', array( $this, 'add_body_class' ) );
	}

	/**
	 * Return the canonical menu slug for this page.
	 *
	 * @return string Canonical Setup Wizard menu slug.
	 */
	public function in_page() {
		return 'wpbc-setup';
	}

	/**
	 * Define either the resumable full-screen wizard or completed native overview.
	 *
	 * @return array<string,array<string,mixed>> Native page tab definition.
	 */
	public function tabs() {
		if ( $this->is_completed_checkpoint() ) {
			return array(
				'overview' => array(
					'is_force_full_screen'              => false,
					'is_force_normal_screen'             => true,
					'is_default_full_screen'             => false,
					'left_navigation__default_view_mode' => '',
					'left_navigation__force_view_mode'   => '',
					'is_show_top_path'                   => true,
					'is_show_top_navigation'             => false,
					'top_path_title'                     => __( 'Setup overview', 'booking' ),
					'title'                              => __( 'Setup overview', 'booking' ),
					'page_title'                         => __( 'Setup overview', 'booking' ),
					'page_description'                   => __( 'Review your booking settings and choose what to do next.', 'booking' ),
					'hint'                               => __( 'Review your completed Booking Calendar setup.', 'booking' ),
					'font_icon'                          => 'wpbc-bi-list-check',
					'default'                            => true,
					'disabled'                           => false,
					'hided'                              => false,
					'subtabs'                            => array(),
					'content'                            => 'content',
				),
			);
		}

		return array(
			'wizard' => array(
				'is_force_full_screen'              => true,
				'left_navigation__default_view_mode' => 'none',
				'left_navigation__force_view_mode'   => 'none',
				'is_show_top_path'                   => false,
				'is_show_top_navigation'             => false,
				'title'                              => __( 'Setup Wizard', 'booking' ),
				'page_title'                         => false,
				'default'                            => true,
				'disabled'                           => false,
				'hided'                              => false,
				'subtabs'                            => array(),
				'content'                            => 'content',
			),
		);
	}

	/**
	 * Add a body class only for the authorized Setup Wizard request.
	 *
	 * @param string $classes Space-delimited administration body classes.
	 *
	 * @return string Updated body classes.
	 */
	public function add_body_class( $classes ) {
		if ( self::is_current_request() && WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			$classes .= $this->is_completed_checkpoint() ? ' wpbc_setup_overview_page' : ' wpbc_setup_wizard_page';
		}

		return $classes;
	}

	/**
	 * Enqueue only compiled runtime assets on the matching authorized page.
	 *
	 * @return void
	 */
	public function enqueue_assets() {
		if ( ! self::is_current_request() || ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			return;
		}

		$module_url    = trailingslashit( plugins_url( '', __FILE__ ) );
		$asset_url     = $module_url . '_out/';
		$asset_version = defined( 'WP_BK_VERSION_NUM' ) ? WP_BK_VERSION_NUM : false;

		if ( $this->is_completed_checkpoint() ) {
			$overview_asset_url  = $module_url . 'setup-overview/_out/';
			$overview            = $this->get_setup_overview_context();
			$published_pages     = isset( $overview['published_pages'] ) && is_array( $overview['published_pages'] ) ? $overview['published_pages'] : array();
			$script_dependencies = array();
			if (
				! empty( $published_pages )
				&& class_exists( 'WPBC_Setup_Wizard_Booking_Pages' )
				&& WPBC_Setup_Wizard_Booking_Pages::enqueue_manual_dialog( $published_pages )
			) {
				$script_dependencies[] = WPBC_Setup_Wizard_Booking_Pages::SCRIPT_HANDLE;
			}
			wp_enqueue_style( 'wpbc-setup-overview', $overview_asset_url . 'setup-overview.css', array(), $asset_version );
			wp_enqueue_script( 'wpbc-setup-overview', $overview_asset_url . 'setup-overview.js', $script_dependencies, $asset_version, true );

			return;
		}

		$module_registry = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_registry   = new WPBC_Setup_Wizard_Step_Registry( $module_registry );
		$step_data       = new WPBC_Setup_Wizard_Step_Data( $module_registry );
		$draft_store     = new WPBC_Setup_Wizard_Draft_Store( $step_registry, new WPBC_Setup_Wizard_Draft_Validator( $step_data ) );
		$current_draft   = $this->get_current_checkpoint();

		if ( 'completed' !== $current_draft['status'] && 'review_setup' === $current_draft['current_step'] ) {
			$review_context = $step_data->get_step_context( 'review_setup', $current_draft['values'], $current_draft['step_results'] );
			$email_result   = ( new WPBC_Setup_Wizard_Summary_Email( $draft_store, new WPBC_Setup_Wizard_WordPress_Operation_Lock() ) )->maybe_send( $review_context );
			if ( is_wp_error( $email_result ) ) {
				$this->review_email_error = sanitize_text_field( $email_result->get_error_message() );
			}
			$current_draft           = $draft_store->load();
			$this->current_checkpoint = $current_draft;
		}

		wp_enqueue_style( 'wpbc-setup-wizard', $asset_url . 'setup-wizard.css', array(), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard', $asset_url . 'setup-wizard.js', array( 'jquery' ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard',
			'wpbc_setup_wizard',
			array(
				'ajax_url'             => admin_url( 'admin-ajax.php' ),
				'nonce'                => wp_create_nonce( WPBC_Setup_Wizard_Ajax::NONCE_ACTION ),
				'current_step'         => $current_draft['current_step'],
				'revision'             => (int) $current_draft['revision'],
				'action_save_continue' => WPBC_Setup_Wizard_Ajax::ACTION_SAVE_CONTINUE,
				'action_back'          => WPBC_Setup_Wizard_Ajax::ACTION_BACK,
				'action_edit'          => WPBC_Setup_Wizard_Ajax::ACTION_EDIT,
				'action_restart'       => WPBC_Setup_Wizard_Ajax::ACTION_RESTART,
				'action_skip'          => WPBC_Setup_Wizard_Ajax::ACTION_SKIP,
				'i18n'                 => array(
					'error'            => __( 'The Setup Wizard request could not be completed. Try again.', 'booking' ),
					'saved'            => __( 'Your Setup Wizard progress was saved.', 'booking' ),
					'required'         => __( 'This field is required.', 'booking' ),
					'invalid_email'    => __( 'Enter a valid booking email address.', 'booking' ),
					'validation_error' => __( 'Review the highlighted fields before continuing.', 'booking' ),
					'working'          => __( 'Processing', 'booking' ) . '...',
					'loading'          => __( 'Loading', 'booking' ) . '...',
					'completed'        => __( 'Your Setup Wizard checkpoint is complete.', 'booking' ),
				),
			)
		);

		$module_registry->enqueue_assets(
			$current_draft['current_step'],
			$module_url,
			$asset_version,
			'wpbc-setup-wizard',
			'wpbc-setup-wizard'
		);
	}

	/**
	 * Render the authorized full-screen shell and current allow-listed step.
	 *
	 * @return void
	 */
	public function content() {
		if ( ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			wp_die(
				esc_html__( 'You are not allowed to use this Setup Wizard.', 'booking' ),
				esc_html__( 'Access denied', 'booking' ),
				array( 'response' => 403 )
			);
		}

		if ( $this->is_completed_checkpoint() ) {
			$this->render_setup_overview();

			return;
		}

		$module_registry   = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_registry     = new WPBC_Setup_Wizard_Step_Registry( $module_registry );
		$step_data         = new WPBC_Setup_Wizard_Step_Data( $module_registry );
		$draft_store       = new WPBC_Setup_Wizard_Draft_Store( $step_registry, new WPBC_Setup_Wizard_Draft_Validator( $step_data ) );
		$templates         = new WPBC_Setup_Wizard_Templates( $module_registry );
		$current_draft     = $this->get_current_checkpoint();
		$current_step      = $step_registry->get_step( $current_draft['current_step'] );
		$is_review_step    = 'review_setup' === $current_draft['current_step'];
		$bookings_url      = function_exists( 'wpbc_get_bookings_url' ) ? wpbc_get_bookings_url() : admin_url( 'admin.php?page=wpbc' );
		$current_step_data = $step_data->get_step_context( $current_draft['current_step'], $current_draft['values'], $current_draft['step_results'] );
		$settings_hint     = ( new WPBC_Setup_Wizard_Settings_Hints() )->get_hint( $current_draft['current_step'] );
		if ( $is_review_step ) {
			$current_step_data['email_state'] = isset( $current_draft['email'] ) && is_array( $current_draft['email'] ) ? $current_draft['email'] : array();
			$current_step_data['email_error'] = $this->review_email_error;
		}
		$save_registry     = WPBC_Setup_Wizard_Progressive_Save_Factory::create_save_registry( $step_registry );
		$continue_label    = $save_registry->get_primary_action_label( $current_draft['current_step'], $current_draft, $current_step_data );
		$footer_note       = isset( $current_step['footer_note'] ) && is_scalar( $current_step['footer_note'] )
			? sanitize_text_field( (string) $current_step['footer_note'] )
			: '';
		if ( '' === $footer_note ) {
			$footer_note = $is_review_step
				? __( 'Finish setup revalidates the active route and completes the wizard. Settings and publishing changes saved on earlier steps remain active.', 'booking' )
				: __( 'Your changes are saved as you continue. Back only navigates and does not roll back completed steps.', 'booking' );
		}

		$template_result = $templates->render(
			'shell',
			array(
				'templates'          => $templates,
				'step_registry'      => $step_registry,
				'draft'              => $current_draft,
				'current_step'       => $current_step,
				'rail_items'         => $step_registry->get_rail_items( $current_draft['current_step'], $current_draft['values'] ),
				'rail_note'          => $step_registry->get_rail_note( $current_draft['current_step'], $current_draft['values'] ),
				'has_previous_step'  => $step_registry->has_previous_step( $current_draft['current_step'], $current_draft['values'] ),
				'can_continue'       => 'completed' !== $current_draft['status'],
				'has_step_form'      => 'welcome' !== $current_draft['current_step'],
				'continue_label'     => '' !== $continue_label ? $continue_label : __( 'Save & continue', 'booking' ),
				'show_continue_icon' => ! $is_review_step,
				'footer_note'        => $footer_note,
				'bookings_url'       => $bookings_url,
				'close_url'          => $bookings_url,
				'header_template_id' => isset( $current_step['header_template'] ) ? (string) $current_step['header_template'] : '',
				'step_template_id'   => $current_step['template'],
				'step_data'          => $current_step_data,
				'settings_hint'      => $settings_hint,
			)
		);

		if ( is_wp_error( $template_result ) ) {
			$templates->render( 'error', array( 'message' => $template_result->get_error_message() ) );
		}
	}

	/**
	 * Render the normal WordPress administration overview after completion.
	 *
	 * Canonical-backed dependencies are refreshed by Step Data before the Review
	 * presenter creates summaries. The overview therefore remains current when a
	 * setting is changed outside the wizard after completion.
	 *
	 * @return void
	 */
	private function render_setup_overview() {
		$overview          = $this->get_setup_overview_context();
		$overview_template = __DIR__ . '/setup-overview/template.php';

		if ( ! is_readable( $overview_template ) ) {
			wp_die(
				esc_html__( 'The Setup overview template is unavailable.', 'booking' ),
				esc_html__( 'Setup overview unavailable', 'booking' ),
				array( 'response' => 500 )
			);
		}

		require $overview_template;
	}

	/**
	 * Build the current completed overview once for assets and rendering.
	 *
	 * Canonical-backed values are refreshed through Step Data before the
	 * presentation service discovers authorized public booking-page cards.
	 * Sharing this request-local result prevents the enqueue and render paths
	 * from performing the same owner-scoped queries twice.
	 *
	 * @return array<string,mixed> Authorized completed overview context.
	 */
	private function get_setup_overview_context() {
		if ( is_array( $this->setup_overview_context ) ) {
			return $this->setup_overview_context;
		}

		$checkpoint      = $this->get_current_checkpoint();
		$module_registry = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_data       = new WPBC_Setup_Wizard_Step_Data( $module_registry );
		$review_context  = $step_data->get_step_context( 'review_setup', $checkpoint['values'], $checkpoint['step_results'] );

		$this->setup_overview_context = ( new WPBC_Setup_Wizard_Setup_Overview() )->get_context( $checkpoint, $review_context );

		return $this->setup_overview_context;
	}

	/**
	 * Return the owner/site-scoped checkpoint once per administration request.
	 *
	 * @return array<string,mixed> Normalized Setup Wizard checkpoint.
	 */
	private function get_current_checkpoint() {
		if ( is_array( $this->current_checkpoint ) ) {
			return $this->current_checkpoint;
		}

		$module_registry         = new WPBC_Setup_Wizard_Step_Module_Registry();
		$step_registry           = new WPBC_Setup_Wizard_Step_Registry( $module_registry );
		$step_data               = new WPBC_Setup_Wizard_Step_Data( $module_registry );
		$draft_store             = new WPBC_Setup_Wizard_Draft_Store( $step_registry, new WPBC_Setup_Wizard_Draft_Validator( $step_data ) );
		$this->current_checkpoint = $draft_store->load();

		return $this->current_checkpoint;
	}

	/**
	 * Determine whether the persisted checkpoint should render the overview.
	 *
	 * @return bool True only after the progressive setup is complete.
	 */
	private function is_completed_checkpoint() {
		$checkpoint = $this->get_current_checkpoint();

		return isset( $checkpoint['status'] ) && 'completed' === $checkpoint['status'];
	}

	/**
	 * Determine whether the current request targets this module page.
	 *
	 * @return bool True only for the canonical Setup Wizard slug.
	 */
	private static function is_current_request() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration routing.
		$page_slug = isset( $_GET['page'] ) && is_scalar( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

		return 'wpbc-setup' === $page_slug;
	}
}
