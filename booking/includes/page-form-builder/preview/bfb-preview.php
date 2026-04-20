<?php
/**
 * Booking Form Builder - Preview Service (Option A).
 *
 * - Creates and manages a single private "Booking Form Preview" page.
 * - Handles AJAX to store a temporary snapshot of the current BFB structure.
 * - Builds a secure preview URL for that page and injects the real booking shortcode.
 * - Optionally exposes a filter hook to let BFB override form structure from snapshot.
 *
 * @package Booking Calendar
 * @subpackage Form Builder
 *
 * @author  wpdevelop
 * @version 1.0.0
 * @since   10.14.0
 * @file:   ../includes/page-form-builder/preview/bfb-preview.php
 */

/**
	== Preview pipeline ==
		When click on update Preview, the client sends AJAX:
			action = WPBC_AJX_BFB_SAVE_FORM_CONFIG
			status = preview
			structure = JSON.stringify( builder_structure )
			settings = JSON.stringify( form_settings ) (options + css_vars)
			and then either:
				Advanced Mode text (if chosen / auto+dirty), OR
				Builder export by calling WPBC_BFB_Exporter.export_all(structure, export_options) and sending:
					advanced_form
					content_form (from fields_data)
		Server stores it temporarily in a transient via create_preview_session():
			structure
			advanced_form
			content_form
		Then it returns a secure URL, and the iframe loads that page.
	On the preview page request, your service injects the booking shortcode and applies filters:
			wpbc_bfb_get_form_structure
			wpbc_bfb_get_form_advanced_form
			wpbc_bfb_get_form_content_form
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Service for handling BFB preview page and snapshots.
 */
class WPBC_BFB_Preview_Service {

	/**
	 * Singleton instance.
	 *
	 * @var WPBC_BFB_Preview_Service|null
	 */
	protected static $instance = null;

	/**
	 * Currently active preview data for this request (if any).
	 *
	 * @var array|null
	 */
	protected $current_preview_data = null;

	/**
	 * Get singleton instance.
	 *
	 * @return WPBC_BFB_Preview_Service
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Constructor (private, use get_instance()).
	 */
	private function __construct() {

		// Ensure preview page exists (lazy).
		add_action( 'init', array( $this, 'ensure_preview_page_exists' ), 20 );

		// Re-apply template after switching theme.
		add_action( 'after_switch_theme', array( $this, 'ensure_preview_page_template' ), 20 );

		// Inject preview content into preview page.
		add_filter( 'the_content', array( $this, 'filter_the_content_for_preview' ) );

		// Optionally hide preview page from Pages list in admin.
		// add_action( 'pre_get_posts', array( $this, 'hide_preview_page_in_admin_list' ) );

		// Enqueue JS/CSS on Builder admin page.
		add_action( 'wpbc_enqueue_js_files_on_page_done', array( $this, 'enqueue_js_files' ) );

		// Hide admin bar in preview iframe only.
		add_action( 'after_setup_theme', array( $this, 'maybe_hide_admin_bar_for_preview' ) );

		add_filter( 'wp_robots', array( $this, 'add_noindex_to_preview_page' ), 99 );
	}

	/**
	 * Ensure that the preview page exists and is stored in options.
	 *
	 * This runs on 'init' and can also be called manually.
	 *
	 * @return int|false Page ID on success, false on failure.
	 */
	public function ensure_preview_page_exists() {

		$option_key = $this->get_page_option_key();
		$page_id    = (int) get_option( $option_key );

		if ( $page_id > 0 ) {

			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			if ( is_admin() && ( defined( 'DOING_AJAX' ) ) && ( DOING_AJAX ) && ( isset( $_POST['action'] ) ) && ( 'WPBC_AJX_BFB_SAVE_FORM_CONFIG' === $_POST['action'] ) ) {
				// Probably  saving preview before making this preview, so  we can  check  about ensure preview page.
			} else {
				return false;
			}

			$page = get_post( $page_id );

			if ( $page instanceof WP_Post && 'page' === $page->post_type ) {

				// Ensure it uses full-width template (if available).
				$this->ensure_preview_page_template();

				return $page_id;
			}

			delete_option( $option_key );
		}

		$page_id = $this->create_preview_page();

		if ( $page_id > 0 ) {
			update_option( $option_key, $page_id );

			// Set full-width template right after creation.
			$this->ensure_preview_page_template();

			return $page_id;
		}

		return false;
	}

	public function add_noindex_to_preview_page( $robots ) {

		if ( ! is_page() ) {
			return $robots;
		}

		$page_id = (int) get_queried_object_id();
		if ( $page_id !== (int) $this->get_preview_page_id() ) {
			return $robots;
		}

		$robots['noindex']   = true;
		$robots['nofollow']  = true;
		$robots['noarchive'] = true;

		return $robots;
	}

	/**
	 * Resolve capability used for preview / Builder access.
	 *
	 * Uses wpbc_bfb_get_manage_cap() when available, falls back to manage_options.
	 *
	 * @return string
	 */
	protected function get_manage_cap() {
		if ( function_exists( 'wpbc_bfb_get_manage_cap' ) ) {
			return wpbc_bfb_get_manage_cap();
		}

		return 'manage_options';
	}

	/**
	 * Check if current request is a BFB preview request.
	 *
	 * @return bool
	 */
	protected function is_preview_request() {

		// Quick GET check (works before main query is parsed).
		if ( isset( $_GET['wpbc_bfb_preview'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return true;
		}

		// Fallback for places where query vars are already set.
		$is_preview = get_query_var( 'wpbc_bfb_preview' );

		return ! empty( $is_preview );
	}

	/**
	 * Hide admin toolbar on front-end preview requests.
	 *
	 * This affects ONLY the preview page loaded in the iframe.
	 */
	public function maybe_hide_admin_bar_for_preview() {

		// Do not affect wp-admin.
		if ( is_admin() ) {
			return;
		}

		if ( ! $this->is_preview_request() ) {
			return;
		}

		$cap = $this->get_manage_cap();

		// Optionally limit to users who can see this preview anyway.
		if ( ! is_user_logged_in() || ! current_user_can( $cap ) ) {
			return;
		}

		// Disable admin bar for this request only.
		show_admin_bar( false );
	}

	public function enqueue_js_files() {
		if ( ! is_admin() ) {
			return;
		}
		// BFB preview script on the Builder admin page.
		wp_enqueue_script(
			'wpbc-bfb-preview',
			wpbc_plugin_url( '/includes/page-form-builder/preview/_out/bfb-preview.js' ),
			array( 'wpbc-bfb_builder' ),
			'1.0.0',
			true
		);
		wp_enqueue_style(
			'wpbc-bfb-preview-mode',
			wpbc_plugin_url( '/includes/page-form-builder/preview/_out/bfb-preview.css' ),
			array(),
			WP_BK_VERSION_NUM
		);
	}

	/**
	 * Return the option key where preview page ID is stored.
	 *
	 * @return string
	 */
	protected function get_page_option_key() {
		return 'wpbc_bfb_preview_page_id';
	}

	/**
	 * Create the private "Booking Form Preview" page.
	 *
	 * @return int|false Page ID on success, false on failure.
	 */
	protected function create_preview_page() {

		$page_id = wpbc_bfb_activation__create_preview_page_raw();
		return $page_id;
	}

	/**
	 * Get the preview page ID (ensures it exists).
	 *
	 * @return int|false
	 */
	public function get_preview_page_id() {
		$option_key = $this->get_page_option_key();
		$page_id    = (int) get_option( $option_key );

		if ( $page_id > 0 ) {
			return $page_id;
		}

		return $this->ensure_preview_page_exists();
	}


	/**
	 * Build transient key for storing preview snapshot.
	 *
	 * @param int    $user_id Current user ID.
	 * @param string $token   Random token.
	 * @param int    $form_id Booking form ID.
	 *
	 * @return string
	 */
	protected function get_transient_key( $user_id, $token, $form_id ) {

		$user_id = (int) $user_id;
		$form_id = (int) $form_id;

		return 'wpbc_bfb_preview_' . $user_id . '_' . $form_id . '_' . sanitize_key( $token );
	}

	/**
	 * Try to load preview data from current request (front-end).
	 *
	 * @return array|null
	 */
	protected function get_preview_data_from_request() {

		if ( null !== $this->current_preview_data ) {
			return $this->current_preview_data;
		}

		// Check query flag.
		$is_preview = get_query_var( 'wpbc_bfb_preview' );

		if ( empty( $is_preview ) && ! isset( $_GET['wpbc_bfb_preview'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return null;
		}

		$cap = $this->get_manage_cap();

		if ( ! is_user_logged_in() || ! current_user_can( $cap ) ) {
			return null;
		}

		$token   = get_query_var( 'wpbc_bfb_preview_token' );
		$form_id = absint( get_query_var( 'wpbc_bfb_preview_form_id' ) );

		if ( empty( $token ) ) {
			$token = isset( $_GET['wpbc_bfb_preview_token'] ) ? sanitize_text_field( wp_unslash( $_GET['wpbc_bfb_preview_token'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}

		if ( empty( $form_id ) ) {
			$form_id = isset( $_GET['wpbc_bfb_preview_form_id'] ) ? absint( wp_unslash( $_GET['wpbc_bfb_preview_form_id'] ) ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}

		$nonce = isset( $_GET['nonce'] ) ? sanitize_text_field( wp_unslash( $_GET['nonce'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( empty( $token ) || empty( $form_id ) ) {
			return null;
		}

		if ( ! wp_verify_nonce( $nonce, 'wpbc_bfb_preview_' . $token ) ) {
			return null;
		}

		$user_id = wpbc_get_current_user_id();

		if ( $user_id <= 0 ) {
			return null;
		}

		$transient_key = $this->get_transient_key( $user_id, $token, $form_id );
		$data          = get_transient( $transient_key );

		if ( empty( $data ) ) {
			return null;
		}

		$has_structure = ( ! empty( $data['structure'] ) && is_array( $data['structure'] ) );
		$has_advanced  = ( ! empty( $data['advanced_form'] ) || ! empty( $data['content_form'] ) );

		if ( ! $has_structure && ! $has_advanced ) {
			return null;
		}


		$this->current_preview_data = $data;

		return $this->current_preview_data;
	}

	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Ensure preview page uses a "full width" template (if the current theme provides one).
	 *
	 * WordPress stores selected templates in post meta: _wp_page_template. :contentReference[oaicite:1]{index=1}
	 *
	 * Developers can hard-force a template via:
	 * apply_filters( 'wpbc_bfb_preview_page_template', $template, $page_id )
	 *
	 * - Classic theme template value: 'templates/full-width.php'
	 * - Block theme template value:   'page-no-title' (template slug)
	 *
	 * @return void
	 */
	public function ensure_preview_page_template() {

		$page_id = (int) $this->get_preview_page_id();
		if ( $page_id <= 0 ) {
			return;
		}

		// If already set and valid, do nothing (fast path).
		$current = (string) get_post_meta( $page_id, '_wp_page_template', true );
		if ( $this->is_preview_template_value_valid( $current ) ) {
			return;
		}

		$template = $this->detect_full_width_template_value();

		/**
		 * Force/override template for preview page.
		 *
		 * Return values:
		 * - '' or 'default' => keep theme default
		 * - classic: 'templates/full-width.php'
		 * - block:   'page-no-title' (slug)
		 */
		$template = apply_filters( 'wpbc_bfb_preview_page_template', $template, $page_id );

		$template = (string) $template;
		$template = trim( $template );

		if ( '' === $template || 'default' === $template ) {
			// Use default template.
			delete_post_meta( $page_id, '_wp_page_template' );

			return;
		}

		// Store chosen template.
		update_post_meta( $page_id, '_wp_page_template', $template );
	}

	/**
	 * Validate existing _wp_page_template meta value for classic themes.
	 * For block themes we can’t reliably "locate" the template file here, so we accept non-empty values.
	 *
	 * @param string $template_value Existing _wp_page_template meta value.
	 *
	 * @return bool
	 */
	protected function is_preview_template_value_valid( $template_value ) {

		$template_value = (string) $template_value;
		$template_value = trim( $template_value );

		if ( '' === $template_value || 'default' === $template_value ) {
			return false;
		}

		// Classic themes: validate that file exists in theme.
		if ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() ) {
			return true;
		}

		$located = locate_template( array( $template_value ), false, false );

		return ( ! empty( $located ) );
	}

	/**
	 * Detect a full-width template value for current theme.
	 *
	 * @return string Template value for _wp_page_template, or '' if none found.
	 */
	protected function detect_full_width_template_value() {

		// Block themes: try to find a block template slug.
		if ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() && function_exists( 'get_block_templates' ) ) {
			$slug = $this->detect_block_theme_full_width_slug();
			if ( '' !== $slug ) {
				return $slug;
			}
		}

		// Classic themes: try registered page templates first.
		$file = $this->detect_classic_theme_full_width_file();
		if ( '' !== $file ) {
			return $file;
		}

		return '';
	}

	/**
	 * Try to detect a "full width" template slug in block themes.
	 *
	 * @return string
	 */
	protected function detect_block_theme_full_width_slug() {

		$best_slug  = '';
		$best_score = 0;

		$templates = get_block_templates( array(
				'post_type' => 'page',
			), 'wp_template' );

		if ( empty( $templates ) || ! is_array( $templates ) ) {
			return '';
		}

		foreach ( $templates as $tpl ) {

			$title = '';
			$slug  = '';

			if ( is_object( $tpl ) ) {
				$title = isset( $tpl->title ) ? (string) $tpl->title : '';
				$slug  = isset( $tpl->slug ) ? (string) $tpl->slug : '';
			}

			$score = $this->score_full_width_candidate( $title . ' ' . $slug );

			if ( $score > $best_score && '' !== $slug ) {
				$best_score = $score;
				$best_slug  = $slug;
			}
		}

		return ( $best_score >= 60 ) ? $best_slug : '';
	}

	/**
	 * Try to detect a "full width" template file in classic themes.
	 *
	 * @return string
	 */
	protected function detect_classic_theme_full_width_file() {

		$theme     = wp_get_theme();
		$templates = $theme->get_page_templates( null, 'page' ); // array( 'Name' => 'file.php' ).

		$best_file  = '';
		$best_score = 0;

		if ( ! empty( $templates ) && is_array( $templates ) ) {
			foreach ( $templates as $name => $file ) {
				$score = $this->score_full_width_candidate( $name . ' ' . $file );
				if ( $score > $best_score && ! empty( $file ) ) {
					$best_score = $score;
					$best_file  = (string) $file;
				}
			}
		}

		// Accept strong match from registered templates.
		if ( $best_score >= 60 && '' !== $best_file ) {
			$located = locate_template( array( $best_file ), false, false );
			if ( ! empty( $located ) ) {
				return $best_file;
			}
		}

		// Fallback: common filenames (theme-dependent).
		$candidates = array(
			'page-templates/full-width.php',
			'page-templates/fullwidth.php',
			'templates/full-width.php',
			'templates/fullwidth.php',
			'full-width.php',
			'fullwidth.php',
			'page-no-sidebar.php',
			'page-nosidebar.php',
		);

		foreach ( $candidates as $candidate ) {
			$located = locate_template( array( $candidate ), false, false );
			if ( ! empty( $located ) ) {
				return $candidate;
			}
		}

		return '';
	}

	/**
	 * Score a candidate (template name/slug/file) as "full width".
	 *
	 * @param string $haystack Text to score.
	 *
	 * @return int
	 */
	protected function score_full_width_candidate( $haystack ) {

		$h = strtolower( (string) $haystack );
		$s = 0;

		if ( false !== strpos( $h, 'full' ) && false !== strpos( $h, 'width' ) ) {
			$s += 100;
		}
		if ( false !== strpos( $h, 'no' ) && false !== strpos( $h, 'sidebar' ) ) {
			$s += 95;
		}
		// My theme exception for local test  server.
		if ( ( isset( $_SERVER['HTTP_HOST'] ) && ( 'beta' === sanitize_key( wp_unslash( $_SERVER['HTTP_HOST'] ) ) ) ) && ( false !== strpos( $h, 'no-title' ) ) ) {
			$s += 61;
		}
		if ( false !== strpos( $h, 'wide' ) ) {
			$s += 60;
		}
		if ( false !== strpos( $h, 'canvas' ) || false !== strpos( $h, 'blank' ) ) {
			$s += 40;
		}
		if ( false !== strpos( $h, 'elementor' ) && false !== strpos( $h, 'full' ) ) {
			$s += 30;
		}

		return $s;
	}
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Filter "the_content" to inject the real booking form into the preview page.
	 *
	 * Note:
	 * - This is where we run the actual booking shortcode.
	 * - The theme (classic or block) wraps this content as usual.
	 *
	 * @param string $content Original page content.
	 *
	 * @return string
	 */
	public function filter_the_content_for_preview( $content ) {

		if ( ! is_page() ) {
			return $content;
		}

		$page_id        = get_the_ID();
		$preview_page_id = $this->get_preview_page_id();

		if ( $preview_page_id <= 0 || (int) $page_id !== (int) $preview_page_id ) {
			return $content;
		}

		$preview_data = $this->get_preview_data_from_request();

		if ( empty( $preview_data ) ) {
			// No active preview snapshot, show a simple message.
			return '<p>' . esc_html__( 'This is a booking form preview page. Please refresh the preview from the Builder.', 'booking' ) . '</p>';
		}

		// Safety: disable caching for this request.
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound
		if ( ! defined( 'DONOTCACHEPAGE' ) ) { define( 'DONOTCACHEPAGE', true ); }

		nocache_headers();

		// Store preview data for this request so other hooks can access it.
		$this->current_preview_data = $preview_data;

		// Optional: expose a filter so BFB structure loader can override structure per preview.
		// Your wpbc_bfb_get_form_structure() can apply this filter when resolving structure.
		add_filter( 'wpbc_bfb_get_form_structure', array( $this, 'filter_form_structure_for_preview' ), 10, 2 );
		add_filter( 'wpbc_bfb_get_form_advanced_form', array( $this, 'filter_form_advanced_form_for_preview' ), 10, 2 );
		add_filter( 'wpbc_bfb_get_form_content_form',  array( $this, 'filter_form_content_form_for_preview' ), 10, 2 );

		$resource_id = WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id();

		$form_name = isset( $preview_data['form_name'] ) ? sanitize_text_field( wp_unslash( $preview_data['form_name'] ) ) : 'standard';
		if ( '' === $form_name ) {
			$form_name = 'standard';
		}

		$shortcode = '[booking resource_id="' . esc_attr( $resource_id ) . '" form_type="' . esc_attr( $form_name ) . '" form_status="preview"]';

		return do_shortcode( $shortcode );
	}

	public function filter_form_advanced_form_for_preview( $advanced_form, $form_id ) {

		if ( empty( $this->current_preview_data ) ) {
			return $advanced_form;
		}

		if ( (int) $form_id !== (int) $this->current_preview_data['form_id'] ) {
			return $advanced_form;
		}

		if ( isset( $this->current_preview_data['advanced_form'] ) ) {
			return (string) $this->current_preview_data['advanced_form'];
		}

		return $advanced_form;
	}

	public function filter_form_content_form_for_preview( $content_form, $form_id ) {

		if ( empty( $this->current_preview_data ) ) {
			return $content_form;
		}

		if ( (int) $form_id !== (int) $this->current_preview_data['form_id'] ) {
			return $content_form;
		}

		if ( isset( $this->current_preview_data['content_form'] ) ) {
			return (string) $this->current_preview_data['content_form'];
		}

		return $content_form;
	}

	/**
	 * Filter that allows BFB structure loader to receive snapshot for preview.
	 *
	 * Usage example in your loader:
	 *   $structure = apply_filters( 'wpbc_bfb_get_form_structure', $structure, $form_id );
	 *
	 * @param array $structure Default structure loaded from DB.
	 * @param int   $form_id   Booking form ID.
	 *
	 * @return array
	 */
	public function filter_form_structure_for_preview( $structure, $form_id ) {

		if ( empty( $this->current_preview_data ) ) {
			return $structure;
		}

		if ( (int) $form_id !== (int) $this->current_preview_data['form_id'] ) {
			return $structure;
		}

		if ( empty( $this->current_preview_data['structure'] ) || ! is_array( $this->current_preview_data['structure'] ) ) {
			return $structure;
		}

		return $this->current_preview_data['structure'];
	}

	/**
	 * Hide the preview page from the Pages list in admin.
	 *
	 * @param WP_Query $query Main query.
	 */
	public function hide_preview_page_in_admin_list( $query ) {

		if ( ! is_admin() || ! $query->is_main_query() ) {
			return;
		}

		global $pagenow;

		if ( 'edit.php' !== $pagenow ) {
			return;
		}

		$post_type = $query->get( 'post_type' );

		if ( 'page' !== $post_type && '' !== $post_type ) {
			return;
		}

		$page_id = $this->get_preview_page_id();

		if ( $page_id <= 0 ) {
			return;
		}

		$not_in   = (array) $query->get( 'post__not_in' );
		$not_in[] = (int) $page_id;

		$query->set( 'post__not_in', $not_in );
	}

	// FixIn: 2026-01-03 14:31.
	/**
	 * Create a preview session: store transient snapshot and return preview URL + token.
	 *
	 * @param int   $preview_form_id     Preview form/resource ID.
	 * @param int   $user_id             Current user ID.
	 * @param array $structure           Decoded BFB structure.
	 *
	 * @return array|false { preview_url, token } or false on failure.
	 */
	public function create_preview_session( $preview_form_id, $user_id, $structure, $form_name = 'standard', $advanced_form = '', $content_form = '' ) {


		$preview_form_id     = (int) $preview_form_id;
		$user_id             = (int) $user_id;
		$structure           = ( is_array( $structure ) ? $structure : array() );
		$form_name = sanitize_text_field( (string) $form_name );
		if ( '' === $form_name ) {
			$form_name = 'standard';
		}
		if ( $preview_form_id <= 0 ) {
			$preview_form_id = 1;
		}
		if ( $user_id <= 0 ) {
			return false;
		}

		$page_id = $this->get_preview_page_id();
		if ( ! $page_id ) {
			return false;
		}

		$token         = wp_generate_password( 12, false, false );
		$transient_key = $this->get_transient_key( $user_id, $token, $preview_form_id );

		$payload = array(
			'user_id'   => $user_id,
			// Keep key name as-is (your preview reader expects ['form_id']).
			// This is a *preview context resource/calendar id* (used for shortcode type="...").
			'form_id'   => $preview_form_id,
			'form_name' => $form_name,
			'scope'     => 'preview',
			'structure' => $structure,
			'time'      => time(),
			'advanced_form'   => (string) $advanced_form,
			'content_form'    => (string) $content_form,
		);

		set_transient( $transient_key, $payload, 10 * MINUTE_IN_SECONDS );

		$preview_url = add_query_arg( array(
				'wpbc_bfb_preview'         => 1,
				'wpbc_bfb_preview_token'   => rawurlencode( $token ),
				'wpbc_bfb_preview_form_id' => $preview_form_id,
				'nonce'                    => wp_create_nonce( 'wpbc_bfb_preview_' . $token ),
			), get_permalink( $page_id ) );

		return array(
			'preview_url' => $preview_url,
			'token'       => $token,
		);
	}

}


/**
 * Render BFB Preview Panel in the Builder admin page.
 *
 * @param int $form_id Current booking form / resource ID.
 */
function wpbc_bfb_render_preview_panel( $form_id = 1 ) {

	$form_id = absint( $form_id );
	if ( $form_id <= 0 ) {
		$form_id = 1;
	}

	$preview_nonce = wp_create_nonce( 'wpbc_bfb_preview' );
	?>
	<div id="wpbc_bfb__preview_panel"
		class="wpbc_bfb__preview_panel"
		data-wpbc-bfb-preview-root="1"
		data-form-id="<?php echo esc_attr( $form_id ); ?>"
		data-preview-nonce="<?php echo esc_attr( $preview_nonce ); ?>">

		<div class="wpbc_bfb__preview_panel__toolbar">
			<h1 class="wpbc_settings_page_header_title wpbc_bfb_ui__elements_show_in_preview">
				<?php esc_html_e( 'Booking Form Preview', 'booking' ); ?>
			</h1>
			<span class="description">
				<?php esc_html_e( 'The preview shows the live booking form inside your site theme.', 'booking' ); ?>
			</span>
			<style type="text/css">
				html[data-wpbc-bfb-live-source="advanced"] .warning_description {
					display: block;
				}
				.warning_description {
					display: none;
					width: 700px;
					color: #900;
					width: 630px;
					color: #44270d;
					text-align: center;
					font-size: 14px;
					line-height: 2;
					background: #fff;
					padding: 10px;
					padding: 0.75em 2em;
					margin: 20px auto 0;
					border-radius: 8px;
					border: 2px solid #b97131;
				}
				.warning_description .wpbc_bfb__live_status__advanced {
					font-weight: 550;
					display: inline !important;
				}
			</style>
			<div class="warning_description">
			<?php
			/* translators: 1: <strong>, 2: </strong>, 3: <a ...>, 4: </a>, 5: <a ...>, 6: </a> */
			printf( __( '%1$sNote!%2$s This preview is generated from %3$sAdvanced (manual)%4$s, which is not synced with the Form Builder. To sync it, enable the corresponding checkbox %5$shere%6$s.', 'booking' ),  // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				'<strong>',
				'</strong>',
				'<a class="wpbc_bfb__live_status__advanced" href="javascript:void(0);" onclick="javascript:WPBC_BFB_Preview.show_advanced_tab({});">',
				'</a>',
				'<a href="javascript:void(0);" onclick="javascript:WPBC_BFB_Preview.show_advanced_tab({});">',
				'</a>'
			);
			?>
			</div>
		</div>

		<div class="wpbc_bfb__preview_panel__frame_wrapper">
			<div class="wpbc_bfb__preview_loader" data-wpbc-bfb-preview-loader="1" aria-hidden="true">
				<?php
				wpbc_bfb_spins_loading_container_mini();
				?>
			</div>

			<iframe
				id="wpbc_bfb__preview_iframe"
				class="wpbc_bfb__preview_iframe"
				data-wpbc-bfb-preview-iframe="1"
				src="about:blank"
				title="<?php esc_attr_e( 'Booking form preview', 'booking' ); ?>"
				loading="lazy"
				referrerpolicy="no-referrer-when-downgrade">
			</iframe>
		</div>
	</div>
	<?php
}

/**
 * Show Loader Spin.
 *
 * @return void
 */
function wpbc_bfb_spins_loading_container() {
	?>
	<div class="wpbc_spins_loading_container">
		<div class="wpbc_booking_form_spin_loader">
			<div class="wpbc_spins_loader_wrapper">
				<div class="wpbc_spin_loader_one_new"></div>
			</div>
		</div>
		<span><?php echo esc_html__( 'Loading', 'booking' ); ?> ...</span>
	</div>
	<?php
}


/**
 * Show Mini Loader Spin.
 *
 * @return void
 */
function wpbc_bfb_spins_loading_container_mini() {
	?>
	<div class="wpbc_spins_loading_container wpbc_bfb_spins_loading_container">
		<div class="wpbc_booking_form_spin_loader">
			<div class="wpbc_spins_loader_wrapper">
				<div class="wpbc_one_spin_loader_mini2"></div>
			</div>
		</div>
		<span><?php esc_html_e( 'Loading', 'booking' ); ?>...</span>
	</div>
	<?php
}