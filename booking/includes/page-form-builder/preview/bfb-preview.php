<?php
/**
 * Booking Form Builder - Preview Service (Option A).
 *
 * - Creates and manages a single private "Booking Form Preview" page.
 * - Can render a sanitized unsaved snapshot directly in an authenticated admin request.
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
	On the preview page request, the service injects the booking shortcode and
	uses the authenticated transient snapshot as the source resolver and loader
	result for that exact resource, form name, and preview status. Compatibility
	filters for structure, advanced form, and content form remain available.
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
	 * Whether the request-scoped Booking Calendar option filter is active.
	 *
	 * @var bool
	 */
	protected $preview_option_filter_registered = false;

	/**
	 * Register request-scoped source filters for a page or inline preview.
	 *
	 * @return void
	 */
	private function register_preview_source_filters() {
		$this->register_preview_option_filter();
		add_filter( 'wpbc_bfb_get_form_structure', array( $this, 'filter_form_structure_for_preview' ), 10, 2 );
		add_filter( 'wpbc_bfb_get_form_advanced_form', array( $this, 'filter_form_advanced_form_for_preview' ), 10, 2 );
		add_filter( 'wpbc_bfb_get_form_content_form', array( $this, 'filter_form_content_form_for_preview' ), 10, 2 );
		add_filter( 'wpbc_fe_form_source_resolution', array( $this, 'filter_form_source_resolution_for_preview' ), 10, 2 );
		add_filter( 'wpbc_bfb_form_loader_from_builder', array( $this, 'filter_form_pair_for_preview' ), 100, 2 );
		add_filter( 'wpbc_booking_appointment_form_status', array( $this, 'filter_appointment_form_status_for_preview' ), 10, 4 );
		add_filter( 'wpbc_booking_form__should_collect_inline_scripts', array( $this, 'filter_inline_script_collection_for_preview' ), 10, 4 );
	}

	/**
	 * Remove request-scoped source filters after synchronous preview rendering.
	 *
	 * @return void
	 */
	private function remove_preview_source_filters() {
		remove_filter( 'wpbc_bfb_get_form_structure', array( $this, 'filter_form_structure_for_preview' ), 10 );
		remove_filter( 'wpbc_bfb_get_form_advanced_form', array( $this, 'filter_form_advanced_form_for_preview' ), 10 );
		remove_filter( 'wpbc_bfb_get_form_content_form', array( $this, 'filter_form_content_form_for_preview' ), 10 );
		remove_filter( 'wpbc_fe_form_source_resolution', array( $this, 'filter_form_source_resolution_for_preview' ), 10 );
		remove_filter( 'wpbc_bfb_form_loader_from_builder', array( $this, 'filter_form_pair_for_preview' ), 100 );
		remove_filter( 'wpbc_booking_appointment_form_status', array( $this, 'filter_appointment_form_status_for_preview' ), 10 );
		remove_filter( 'wpbc_booking_form__should_collect_inline_scripts', array( $this, 'filter_inline_script_collection_for_preview' ), 10 );
	}

	/**
	 * Prevent legacy page-level callbacks from escaping an inline preview render.
	 *
	 * Inline previews discard renderer scripts and initialize the returned form
	 * with a JSON-safe bootstrap contract. Queuing the logged-in-user autofill
	 * callback on the parent administration page can therefore target a preview
	 * form that has already been replaced. Full-page signed previews keep the
	 * normal front-end behavior.
	 *
	 * @since 11.9.0
	 *
	 * @param bool   $should_collect      Whether the renderer should collect legacy inline scripts.
	 * @param int    $resource_id         Booking resource ID used by the rendered form.
	 * @param string $custom_booking_form Booking form slug requested by the renderer.
	 * @param string $form_status         Normalized renderer status.
	 *
	 * @return bool False for request-local inline previews; otherwise the prior decision.
	 */
	public function filter_inline_script_collection_for_preview( $should_collect, $resource_id, $custom_booking_form, $form_status ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if ( 'inline_preview' === ( isset( $this->current_preview_data['scope'] ) ? $this->current_preview_data['scope'] : '' ) ) {
			return false;
		}

		return (bool) $should_collect;
	}

	/**
	 * Remove the request-scoped Booking Calendar option override filter.
	 *
	 * Front-end preview requests intentionally keep this filter for the complete
	 * request because assets are resolved before the preview shortcode. Inline
	 * administration previews have a narrower lifetime and must restore canonical
	 * options immediately after their synchronous render completes.
	 *
	 * @return void
	 */
	private function remove_preview_option_filter() {
		if ( ! $this->preview_option_filter_registered ) {
			return;
		}

		remove_bk_filter( 'wpdev_bk_get_option', array( $this, 'filter_option_for_preview' ) );
		$this->preview_option_filter_registered = false;
	}

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

		/*
		 * Calendar skins and front-end JavaScript variables are resolved while
		 * assets are enqueued, before `the_content` renders the preview shortcode.
		 * Activate a validated transient override early enough for those consumers.
		 */
		add_action( 'wp_enqueue_scripts', array( $this, 'activate_preview_option_overrides' ), 1 );

		add_filter( 'wp_robots', array( $this, 'add_noindex_to_preview_page' ), 99 );
	}

	/**
	 * Activate allow-listed preview option overrides for the current front-end request.
	 *
	 * The method is intentionally read-only. It accepts only the authenticated,
	 * user-bound transient loaded by `get_preview_data_from_request()` and never
	 * changes canonical Booking Calendar options.
	 *
	 * @return void
	 */
	public function activate_preview_option_overrides() {
		$preview_data = $this->get_preview_data_from_request();
		if ( empty( $preview_data['option_overrides'] ) ) {
			return;
		}

		$this->register_preview_option_filter();
	}

	/**
	 * Register the internal Booking Calendar option filter once per request.
	 *
	 * @return void
	 */
	private function register_preview_option_filter() {
		if ( $this->preview_option_filter_registered || empty( $this->current_preview_data['option_overrides'] ) ) {
			return;
		}

		add_bk_filter( 'wpdev_bk_get_option', array( $this, 'filter_option_for_preview' ) );
		$this->preview_option_filter_registered = true;
	}

	/**
	 * Return one validated transient option override during preview rendering.
	 *
	 * @param mixed  $value   Current option value.
	 * @param string $option  Booking Calendar option name.
	 * @param mixed  $default Caller-provided default value.
	 *
	 * @return mixed Preview override or the unchanged option value.
	 */
	public function filter_option_for_preview( $value, $option, $default = null ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		$option = is_scalar( $option ) ? sanitize_key( (string) $option ) : '';

		if (
			! empty( $this->current_preview_data['option_overrides'] )
			&& array_key_exists( $option, $this->current_preview_data['option_overrides'] )
		) {
			return $this->current_preview_data['option_overrides'][ $option ];
		}

		return $value;
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

		if ( ! $this->is_main_query_page() ) {
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
	 * Check the main query directly without calling a conditional query tag too early.
	 *
	 * @return bool
	 */
	protected function is_main_query_page() {
		return isset( $GLOBALS['wp_query'] )
			&& ( $GLOBALS['wp_query'] instanceof WP_Query )
			&& $GLOBALS['wp_query']->is_page();
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
		if (
			isset( $_GET['wpbc_bfb_preview'] )
			&& is_scalar( $_GET['wpbc_bfb_preview'] )
			&& '' !== (string) wp_unslash( $_GET['wpbc_bfb_preview'] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		) {
			return true;
		}

		// Fallback for places where query vars are already set.
		$is_preview = get_query_var( 'wpbc_bfb_preview' );

		return is_scalar( $is_preview ) && ! empty( $is_preview );
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
			WP_BK_VERSION_NUM,
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
		$is_preview     = get_query_var( 'wpbc_bfb_preview' );
		$is_preview     = is_scalar( $is_preview ) ? (string) $is_preview : '';
		$is_preview_get = isset( $_GET['wpbc_bfb_preview'] ) && is_scalar( $_GET['wpbc_bfb_preview'] )
			? (string) wp_unslash( $_GET['wpbc_bfb_preview'] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: '';

		if ( empty( $is_preview ) && empty( $is_preview_get ) ) {
			return null;
		}

		$token_raw   = get_query_var( 'wpbc_bfb_preview_token' );
		$form_id_raw = get_query_var( 'wpbc_bfb_preview_form_id' );
		$token       = is_scalar( $token_raw ) ? sanitize_text_field( wp_unslash( (string) $token_raw ) ) : '';
		$form_id     = is_scalar( $form_id_raw ) ? absint( $form_id_raw ) : 0;

		if ( empty( $token ) ) {
			$token = isset( $_GET['wpbc_bfb_preview_token'] ) && is_scalar( $_GET['wpbc_bfb_preview_token'] )
				? sanitize_text_field( wp_unslash( (string) $_GET['wpbc_bfb_preview_token'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				: '';
		}

		if ( empty( $form_id ) ) {
			$form_id = isset( $_GET['wpbc_bfb_preview_form_id'] ) && is_scalar( $_GET['wpbc_bfb_preview_form_id'] )
				? absint( wp_unslash( $_GET['wpbc_bfb_preview_form_id'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				: 0;
		}

		$nonce = isset( $_GET['nonce'] ) && is_scalar( $_GET['nonce'] )
			? sanitize_text_field( wp_unslash( (string) $_GET['nonce'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: '';

		return $this->load_preview_data( $token, $form_id, $nonce );
	}

	/**
	 * Enqueue the reusable administration inline-preview renderer.
	 *
	 * Settings and setup pages may call this before replacing an authorized
	 * server-rendered booking form without duplicating Datepick cleanup or WPBC
	 * bootstrap ordering logic.
	 *
	 * @return void
	 */
	public function enqueue_inline_preview_assets() {
		if ( ! is_admin() ) {
			return;
		}

		wp_enqueue_script(
			'wpbc-bfb-inline-preview',
			wpbc_plugin_url( '/includes/page-form-builder/preview/_out/bfb-inline-preview.js' ),
			array( 'jquery', 'wpbc-main-client' ),
			WP_BK_VERSION_NUM,
			true
		);
	}

	/**
	 * Activate an Appointment preview from its signed configuration return URL.
	 *
	 * The Appointment AJAX endpoint receives this URL only inside its HMAC-signed
	 * configuration. This method additionally verifies the preview nonce, current
	 * user, capability, transient scope, and expiry before registering temporary
	 * source filters. A normal public Appointment request therefore cannot opt in
	 * to an administrator's unsaved preview snapshot.
	 *
	 * @param mixed $preview_url Signed Appointment configuration return URL.
	 *
	 * @return bool True when an authenticated Appointment preview was activated.
	 */
	public function activate_appointment_preview_from_url( $preview_url ) {
		if ( ! is_scalar( $preview_url ) || '' === trim( (string) $preview_url ) ) {
			return false;
		}

		$query_string = wp_parse_url( (string) $preview_url, PHP_URL_QUERY );
		if ( ! is_string( $query_string ) || '' === $query_string ) {
			return false;
		}

		$query_args = array();
		wp_parse_str( $query_string, $query_args );
		$is_preview = isset( $query_args['wpbc_bfb_preview'] ) && is_scalar( $query_args['wpbc_bfb_preview'] )
			? sanitize_text_field( (string) $query_args['wpbc_bfb_preview'] )
			: '';
		$token = isset( $query_args['wpbc_bfb_preview_token'] ) && is_scalar( $query_args['wpbc_bfb_preview_token'] )
			? sanitize_key( (string) $query_args['wpbc_bfb_preview_token'] )
			: '';
		$form_id = isset( $query_args['wpbc_bfb_preview_form_id'] ) && is_scalar( $query_args['wpbc_bfb_preview_form_id'] )
			? absint( $query_args['wpbc_bfb_preview_form_id'] )
			: 0;
		$nonce = isset( $query_args['nonce'] ) && is_scalar( $query_args['nonce'] )
			? sanitize_text_field( (string) $query_args['nonce'] )
			: '';

		if ( '1' !== $is_preview || null === $this->load_preview_data( $token, $form_id, $nonce ) ) {
			return false;
		}

		if ( 'appointment' !== $this->get_current_preview_render_mode() ) {
			$this->current_preview_data = null;

			return false;
		}

		$this->register_preview_source_filters();

		return true;
	}

	/**
	 * Load and validate one user-bound preview transient.
	 *
	 * @param string $token   Random preview token.
	 * @param int    $form_id Preview resource ID encoded into the transient key.
	 * @param string $nonce   Nonce bound to the preview token.
	 *
	 * @return array|null Normalized preview data or null when validation fails.
	 */
	private function load_preview_data( $token, $form_id, $nonce ) {
		$token   = is_scalar( $token ) ? sanitize_key( (string) $token ) : '';
		$form_id = is_scalar( $form_id ) ? absint( $form_id ) : 0;
		$nonce   = is_scalar( $nonce ) ? sanitize_text_field( (string) $nonce ) : '';

		if (
			'' === $token
			|| $form_id <= 0
			|| ! is_user_logged_in()
			|| ! current_user_can( $this->get_manage_cap() )
			|| ! wp_verify_nonce( $nonce, 'wpbc_bfb_preview_' . $token )
		) {
			return null;
		}

		$user_id = get_current_user_id();
		if ( $user_id <= 0 ) {
			return null;
		}

		$data         = get_transient( $this->get_transient_key( $user_id, $token, $form_id ) );
		$data         = $this->normalize_preview_data( $data );
		$current_time = time();

		if (
			null === $data
			|| $user_id !== $data['user_id']
			|| $form_id !== $data['form_id']
			|| $form_id !== $data['resource_id']
			|| 'preview' !== $data['scope']
			|| $data['time'] <= 0
			|| $data['time'] > ( $current_time + MINUTE_IN_SECONDS )
			|| $data['time'] < ( $current_time - ( 10 * MINUTE_IN_SECONDS ) )
		) {
			return null;
		}

		$has_structure = ! empty( $data['structure'] ) && is_array( $data['structure'] );
		$has_advanced  = ! empty( $data['advanced_form'] ) || ! empty( $data['content_form'] );
		if ( ! $has_structure && ! $has_advanced ) {
			return null;
		}

		$this->current_preview_data = $data;

		return $this->current_preview_data;
	}

	/**
	 * Normalize and validate a preview transient before any array offsets are read.
	 *
	 * Object-cache implementations and third-party code can return unexpected
	 * values for a transient. Keeping this normalization at the shared read
	 * boundary prevents malformed values from producing warnings or reaching the
	 * booking-form renderer.
	 *
	 * @param mixed $preview_data Raw transient value.
	 *
	 * @return array|null Normalized preview snapshot, or null for an invalid shape.
	 */
	private function normalize_preview_data( $preview_data ) {

		if ( ! is_array( $preview_data ) ) {
			return null;
		}

		$user_id = isset( $preview_data['user_id'] ) && is_scalar( $preview_data['user_id'] )
			? absint( $preview_data['user_id'] )
			: 0;
		$form_id = isset( $preview_data['form_id'] ) && is_scalar( $preview_data['form_id'] )
			? absint( $preview_data['form_id'] )
			: 0;
		$resource_id = isset( $preview_data['resource_id'] ) && is_scalar( $preview_data['resource_id'] )
			? absint( $preview_data['resource_id'] )
			: $form_id;
		$form_name   = isset( $preview_data['form_name'] ) && is_scalar( $preview_data['form_name'] )
			? sanitize_text_field( (string) $preview_data['form_name'] )
			: 'standard';
		$scope = isset( $preview_data['scope'] ) && is_scalar( $preview_data['scope'] )
			? sanitize_key( (string) $preview_data['scope'] )
			: '';
		$render_mode = isset( $preview_data['render_mode'] ) && is_scalar( $preview_data['render_mode'] )
			? sanitize_key( (string) $preview_data['render_mode'] )
			: 'booking';
		$render_mode = 'appointment' === $render_mode ? 'appointment' : 'booking';

		if ( $user_id <= 0 || $form_id <= 0 || $resource_id <= 0 ) {
			return null;
		}

		return array(
			'user_id'                   => $user_id,
			'form_id'                   => $form_id,
			'resource_id'               => $resource_id,
			'form_name'                 => '' === $form_name ? 'standard' : $form_name,
			'scope'                     => $scope,
			'render_mode'               => $render_mode,
			'structure'                 => isset( $preview_data['structure'] ) && is_array( $preview_data['structure'] )
				? $preview_data['structure']
				: array(),
			'time'                      => isset( $preview_data['time'] ) && is_scalar( $preview_data['time'] )
				? absint( $preview_data['time'] )
				: 0,
			'advanced_form'             => isset( $preview_data['advanced_form'] ) && is_scalar( $preview_data['advanced_form'] )
				? (string) $preview_data['advanced_form']
				: '',
			'content_form'              => isset( $preview_data['content_form'] ) && is_scalar( $preview_data['content_form'] )
				? (string) $preview_data['content_form']
				: '',
			'settings_json'             => isset( $preview_data['settings_json'] ) && is_scalar( $preview_data['settings_json'] )
				? (string) $preview_data['settings_json']
				: '',
			'form_style'                 => isset( $preview_data['form_style'] ) && is_array( $preview_data['form_style'] )
				? $preview_data['form_style']
				: array(),
			'option_overrides'           => isset( $preview_data['option_overrides'] ) && is_array( $preview_data['option_overrides'] )
				? $this->sanitize_preview_option_overrides( $preview_data['option_overrides'] )
				: array(),
			'calendar_parameters'        => isset( $preview_data['calendar_parameters'] ) && is_array( $preview_data['calendar_parameters'] )
				? $this->sanitize_preview_calendar_parameters( $preview_data['calendar_parameters'] )
				: array(),
			'calendar_request_overrides' => isset( $preview_data['calendar_request_overrides'] ) && is_array( $preview_data['calendar_request_overrides'] )
				? $this->sanitize_preview_calendar_request_overrides( $preview_data['calendar_request_overrides'] )
				: array(),
		);
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

		if ( ! $this->is_main_query_page() ) {
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

		$this->register_preview_source_filters();

		$resource_id = $this->get_current_preview_resource_id();
		if ( $resource_id <= 0 ) {
			$resource_id = WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id();
		}

		$form_name = isset( $preview_data['form_name'] ) ? sanitize_text_field( wp_unslash( $preview_data['form_name'] ) ) : 'standard';
		if ( '' === $form_name ) {
			$form_name = 'standard';
		}

		if ( 'appointment' === $this->get_current_preview_render_mode() ) {
			$shortcode = '[booking_appointment form_type="' . esc_attr( $form_name ) . '"]';
			$preview_html = do_shortcode( $shortcode );
		} else {
			$preview_html = WPBC_FE_Render::render_booking_form(
				array(
					'resource_id'               => $resource_id,
					'cal_count'                 => 1,
					'is_echo'                   => 0,
					'custom_booking_form'       => $form_name,
					'form_status'               => 'preview',
					'calendar_request_overrides' => $this->get_current_preview_calendar_request_overrides(),
				)
			);
		}

		$this->remove_preview_source_filters();

		return $this->filter_wrapped_html_for_preview_form_style( $preview_html, array(), $resource_id, $form_name );
	}

	/**
	 * Make the authenticated transient snapshot the source for this preview.
	 *
	 * The preview must not depend on a saved `preview` database row. The returned
	 * loader arguments include a server-owned marker that the paired loader
	 * filter recognizes during this request only.
	 *
	 * @param array $resolution Existing database or missing-source resolution.
	 * @param array $request    Front-end form source request.
	 *
	 * @return array Preview resolution or the unchanged result when it is unrelated.
	 */
	public function filter_form_source_resolution_for_preview( $resolution, $request ) {

		if ( ! $this->is_current_preview_request( $request ) ) {
			return $resolution;
		}

		$resolution = is_array( $resolution ) ? $resolution : array();

		$fallback_chain = isset( $resolution['fallback_chain'] ) && is_array( $resolution['fallback_chain'] )
			? $resolution['fallback_chain']
			: array();

		$request_resource_id = isset( $request['resource_id'] ) ? absint( $request['resource_id'] ) : 0;
		$loader_resource_id  = 'appointment' === $this->get_current_preview_render_mode()
			? $request_resource_id
			: $this->get_current_preview_resource_id();

		return array(
			'engine'                  => 'bfb_db',
			'apply_after_load_filter' => true,
			'bfb_loader_args'         => array(
				'form_slug'            => $this->get_current_preview_form_name(),
				'status'               => 'preview',
				'resource_id'          => $loader_resource_id,
				'wpbc_preview_snapshot' => 1,
			),
			'fallback_chain'          => $fallback_chain,
		);
	}

	/**
	 * Return the transient form pair instead of a saved Form Builder row.
	 *
	 * @param array $form_pair   Pair already returned by the Form Builder loader.
	 * @param array $loader_args Normalized Form Builder loader arguments.
	 *
	 * @return array Selected preview snapshot or the unchanged pair.
	 */
	public function filter_form_pair_for_preview( $form_pair, $loader_args ) {

		if ( ! is_array( $loader_args ) || empty( $loader_args['wpbc_preview_snapshot'] ) ) {
			return $form_pair;
		}

		$request = array(
			'resource_id' => isset( $loader_args['resource_id'] ) ? $loader_args['resource_id'] : 0,
			'form_slug'   => isset( $loader_args['form_slug'] ) ? $loader_args['form_slug'] : '',
			'form_status' => isset( $loader_args['status'] ) ? $loader_args['status'] : '',
		);

		if ( ! $this->is_current_preview_request( $request ) ) {
			return $form_pair;
		}

		return array(
			'form'          => isset( $this->current_preview_data['advanced_form'] ) ? (string) $this->current_preview_data['advanced_form'] : '',
			'content'       => isset( $this->current_preview_data['content_form'] ) ? (string) $this->current_preview_data['content_form'] : '',
			'settings_json' => isset( $this->current_preview_data['settings_json'] ) ? (string) $this->current_preview_data['settings_json'] : '',
		);
	}

	/**
	 * Check whether a renderer or loader request belongs to this preview snapshot.
	 *
	 * @param array $request Source resolver or loader request values.
	 *
	 * @return bool True only for the exact preview resource, form, and status.
	 */
	private function is_current_preview_request( $request ) {

		if ( empty( $this->current_preview_data ) || ! is_array( $request ) ) {
			return false;
		}

		$request_resource_id = isset( $request['resource_id'] ) ? absint( $request['resource_id'] ) : 0;
		$request_form_name   = isset( $request['form_slug'] ) ? sanitize_text_field( (string) $request['form_slug'] ) : '';
		$request_status      = isset( $request['form_status'] ) ? sanitize_key( (string) $request['form_status'] ) : '';

		$resource_matches = 'appointment' === $this->get_current_preview_render_mode()
			? $request_resource_id > 0
			: $request_resource_id === $this->get_current_preview_resource_id();

		return $resource_matches
			&& $request_form_name === $this->get_current_preview_form_name()
			&& 'preview' === $request_status;
	}

	/**
	 * Switch the selected Appointment form to the authenticated preview source.
	 *
	 * @param string              $form_status Existing form status.
	 * @param string              $form_slug   Resolved Appointment form slug.
	 * @param int                 $provider_id Selected Provider resource ID.
	 * @param array<string,mixed> $config      Signed Appointment configuration.
	 *
	 * @return string Preview only for the active snapshot and exact form slug.
	 */
	public function filter_appointment_form_status_for_preview( $form_status, $form_slug, $provider_id, $config ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		if (
			'appointment' !== $this->get_current_preview_render_mode()
			|| absint( $provider_id ) <= 0
			|| sanitize_text_field( (string) $form_slug ) !== $this->get_current_preview_form_name()
		) {
			return $form_status;
		}

		return 'preview';
	}

	/**
	 * Return the resource/calendar ID scoped to the active preview snapshot.
	 *
	 * Older transients stored this context only under `form_id`; retain that
	 * fallback until all ten-minute preview sessions have naturally expired.
	 *
	 * @return int Preview resource ID.
	 */
	private function get_current_preview_resource_id() {

		if ( isset( $this->current_preview_data['resource_id'] ) ) {
			return absint( $this->current_preview_data['resource_id'] );
		}

		return isset( $this->current_preview_data['form_id'] ) ? absint( $this->current_preview_data['form_id'] ) : 0;
	}

	/**
	 * Return the normalized form name scoped to the active preview snapshot.
	 *
	 * @return string Preview form name.
	 */
	private function get_current_preview_form_name() {

		$form_name = isset( $this->current_preview_data['form_name'] )
			? sanitize_text_field( (string) $this->current_preview_data['form_name'] )
			: 'standard';

		return '' === $form_name ? 'standard' : $form_name;
	}

	/**
	 * Return the allow-listed renderer used by the active preview snapshot.
	 *
	 * @return string Either booking or appointment.
	 */
	private function get_current_preview_render_mode() {
		$render_mode = isset( $this->current_preview_data['render_mode'] )
			? sanitize_key( (string) $this->current_preview_data['render_mode'] )
			: 'booking';

		return 'appointment' === $render_mode ? 'appointment' : 'booking';
	}

	/**
	 * Return calendar-load overrides scoped to the active preview snapshot.
	 *
	 * Appointment rendering happens in a later signed AJAX request, so the
	 * renderer needs a public, read-only accessor rather than direct access to
	 * transient internals. Values were allow-list sanitized at the transient
	 * boundary and are sanitized again here for defense in depth.
	 *
	 * @return array<string,int|string> Safe calendar-load request overrides.
	 */
	public function get_current_preview_calendar_request_overrides() {
		$calendar_request_overrides = isset( $this->current_preview_data['calendar_request_overrides'] )
			? $this->current_preview_data['calendar_request_overrides']
			: array();

		return $this->sanitize_preview_calendar_request_overrides( $calendar_request_overrides );
	}

	/**
	 * Sanitize booking-form source before it enters a preview transient.
	 *
	 * Preview markup is intentionally rendered as booking-form markup rather than
	 * escaped as plain text. Therefore the shared preview service, rather than
	 * each caller, must enforce the established Form Builder KSES policy. An
	 * unavailable sanitizer fails closed for non-empty markup.
	 *
	 * @param mixed $form_source Raw advanced-form or content-form source.
	 *
	 * @return string|null Sanitized source, or null when it cannot be sanitized.
	 */
	private function sanitize_preview_form_source( $form_source ) {

		if ( ! is_scalar( $form_source ) ) {
			return '';
		}

		$form_source = (string) $form_source;
		if ( '' === $form_source ) {
			return '';
		}

		if ( ! function_exists( 'wpbc_bfb_sanitize_form_text' ) ) {
			return null;
		}

		return (string) wpbc_bfb_sanitize_form_text( $form_source );
	}

	/**
	 * Normalize Form Builder structure at the shared preview write boundary.
	 *
	 * @param mixed $structure Candidate decoded Form Builder structure.
	 *
	 * @return array|null Sanitized structure, or null when normalization fails.
	 */
	private function sanitize_preview_structure( $structure ) {

		$structure = is_array( $structure ) ? $structure : array();
		$structure = apply_filters( 'wpbc_bfb_sanitize_structure_before_save', $structure );

		return is_array( $structure ) ? $structure : null;
	}

	/**
	 * Normalize optional Form Style values for a preview snapshot.
	 *
	 * @param mixed $form_style Candidate Form Style overrides.
	 *
	 * @return array|null Sanitized style values, or null when required helpers are unavailable.
	 */
	private function sanitize_preview_form_style( $form_style ) {

		if ( ! is_array( $form_style ) || empty( $form_style ) ) {
			return array();
		}

		$scalar_style = array();
		foreach ( $form_style as $style_key => $style_value ) {
			if ( is_scalar( $style_value ) ) {
				$scalar_style[ $style_key ] = (string) $style_value;
			}
		}

		if ( empty( $scalar_style ) ) {
			return array();
		}

		if (
			! function_exists( 'wpbc_bfb_settings__sanitize_form_style' )
			|| ! function_exists( 'wpbc_bfb_settings__get_custom_form_style_options' )
			|| ! function_exists( 'wpbc_bfb_settings__get_form_accent_options' )
		) {
			return null;
		}

		$style_name = isset( $scalar_style['booking_form_style'] )
			? $scalar_style['booking_form_style']
			: '';

		return array_merge(
			array(
				'booking_form_style' => wpbc_bfb_settings__sanitize_form_style( $style_name ),
			),
			wpbc_bfb_settings__get_custom_form_style_options( $scalar_style ),
			wpbc_bfb_settings__get_form_accent_options( $scalar_style )
		);
	}

	/**
	 * Normalize the global options supported by transient previews.
	 *
	 * Calendar skin values must match the current server-side skin registry.
	 * Appearance and Date Selection modules share this narrow allow-list. Unknown
	 * keys are discarded so callers cannot turn the preview transient into a
	 * generic option override channel.
	 *
	 * @param mixed $option_overrides Candidate preview option overrides.
	 *
	 * @return array<string,string> Sanitized allow-listed overrides.
	 */
	private function sanitize_preview_option_overrides( $option_overrides ) {
		if ( ! is_array( $option_overrides ) ) {
			return array();
		}

		$sanitized   = array();
		$toggle_keys = array(
			'booking_timeslot_picker',
			'booking_range_selection_time_is_active',
			'booking_change_over_days_triangles',
			'booking_last_checkout_day_available',
			'booking_recurrent_time',
			'booking_is_show_legend',
			'booking_legend_is_show_numbers',
			'booking_legend_is_vertical',
			'booking_legend_is_show_item_available',
			'booking_legend_is_show_item_pending',
			'booking_legend_is_show_item_approved',
			'booking_legend_is_show_item_partially',
			'booking_legend_is_show_item_unavailable',
		);
		foreach ( $toggle_keys as $toggle_key ) {
			if ( isset( $option_overrides[ $toggle_key ] ) && is_scalar( $option_overrides[ $toggle_key ] ) && in_array( (string) $option_overrides[ $toggle_key ], array( 'On', 'Off' ), true ) ) {
				$sanitized[ $toggle_key ] = (string) $option_overrides[ $toggle_key ];
			}
		}

		$choice_keys = array(
			'booking_type_of_day_selections' => array( 'single', 'multiple', 'range' ),
			'booking_range_selection_type'   => array( 'dynamic', 'fixed' ),
		);
		foreach ( $choice_keys as $choice_key => $allowed_choices ) {
			if ( isset( $option_overrides[ $choice_key ] ) && is_scalar( $option_overrides[ $choice_key ] ) ) {
				$choice = sanitize_key( (string) $option_overrides[ $choice_key ] );
				if ( in_array( $choice, $allowed_choices, true ) ) {
					$sanitized[ $choice_key ] = $choice;
				}
			}
		}

		$bounded_integer_keys = array(
			'booking_range_selection_days_count'             => array( 1, 180 ),
			'booking_range_selection_days_count_dynamic'     => array( 1, 1095 ),
			'booking_range_selection_days_max_count_dynamic' => array( 1, 1095 ),
		);
		foreach ( $bounded_integer_keys as $integer_key => $bounds ) {
			if ( isset( $option_overrides[ $integer_key ] ) && is_scalar( $option_overrides[ $integer_key ] ) && preg_match( '/^\d+$/', (string) $option_overrides[ $integer_key ] ) ) {
				$integer_value = (int) $option_overrides[ $integer_key ];
				if ( $integer_value >= $bounds[0] && $integer_value <= $bounds[1] ) {
					$sanitized[ $integer_key ] = (string) $integer_value;
				}
			}
		}

		foreach ( array( 'booking_range_start_day', 'booking_range_start_day_dynamic' ) as $weekday_key ) {
			if ( isset( $option_overrides[ $weekday_key ] ) ) {
				$weekdays = $this->sanitize_preview_integer_list( $option_overrides[ $weekday_key ], -1, 6, array( -1 ) );
				$sanitized[ $weekday_key ] = implode( ',', $weekdays );
			}
		}

		if ( isset( $option_overrides['booking_range_selection_days_specific_num_dynamic'] ) ) {
			$specific_days = $this->sanitize_preview_integer_list( $option_overrides['booking_range_selection_days_specific_num_dynamic'], 1, 1095, array() );
			$sanitized['booking_range_selection_days_specific_num_dynamic'] = implode( ',', $specific_days );
		}

		foreach ( array( 'booking_range_selection_start_time', 'booking_range_selection_end_time' ) as $time_key ) {
			if ( isset( $option_overrides[ $time_key ] ) && is_scalar( $option_overrides[ $time_key ] ) && preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', (string) $option_overrides[ $time_key ] ) ) {
				$sanitized[ $time_key ] = (string) $option_overrides[ $time_key ];
			}
		}

		foreach ( array( 'available', 'pending', 'approved', 'partially', 'unavailable' ) as $legend_item ) {
			$text_key = 'booking_legend_text_for_item_' . $legend_item;
			if ( isset( $option_overrides[ $text_key ] ) && is_scalar( $option_overrides[ $text_key ] ) ) {
				$legend_text = sanitize_text_field( (string) $option_overrides[ $text_key ] );
				$sanitized[ $text_key ] = function_exists( 'mb_substr' ) ? mb_substr( $legend_text, 0, 255 ) : substr( $legend_text, 0, 255 );
			}
		}

		if ( array_key_exists( 'booking_skin', $option_overrides ) && is_scalar( $option_overrides['booking_skin'] ) ) {
			$calendar_skin = $this->sanitize_preview_calendar_skin( (string) $option_overrides['booking_skin'] );
			if ( '' !== $calendar_skin ) {
				$sanitized['booking_skin'] = $calendar_skin;
			}
		}

		return $sanitized;
	}

	/**
	 * Normalize Date Selection values used by the explicit browser bootstrap.
	 *
	 * @param mixed $calendar_parameters Candidate calendar parameters.
	 *
	 * @return array<string,mixed> Sanitized allow-listed parameters.
	 */
	private function sanitize_preview_calendar_parameters( $calendar_parameters ) {
		if ( ! is_array( $calendar_parameters ) ) {
			return array();
		}

		$sanitized = array();
		if ( array_key_exists( 'is_enabled_change_over', $calendar_parameters ) ) {
			$is_enabled_change_over = $this->sanitize_preview_boolean( $calendar_parameters['is_enabled_change_over'] );
			if ( null !== $is_enabled_change_over ) {
				$sanitized['is_enabled_change_over'] = $is_enabled_change_over;
			}
		}
		if ( isset( $calendar_parameters['days_select_mode'] ) && is_scalar( $calendar_parameters['days_select_mode'] ) ) {
			$days_select_mode = sanitize_key( (string) $calendar_parameters['days_select_mode'] );
			if ( in_array( $days_select_mode, array( 'single', 'multiple', 'range' ), true ) ) {
				$sanitized['days_select_mode'] = $days_select_mode;
			}
		}

		$integer_keys = array(
			'fixed__days_num'   => array( 0, 180 ),
			'dynamic__days_min' => array( 0, 1095 ),
			'dynamic__days_max' => array( 0, 1095 ),
		);
		foreach ( $integer_keys as $integer_key => $bounds ) {
			if ( isset( $calendar_parameters[ $integer_key ] ) && is_scalar( $calendar_parameters[ $integer_key ] ) && preg_match( '/^\d+$/', (string) $calendar_parameters[ $integer_key ] ) ) {
				$integer_value = (int) $calendar_parameters[ $integer_key ];
				if ( $integer_value >= $bounds[0] && $integer_value <= $bounds[1] ) {
					$sanitized[ $integer_key ] = $integer_value;
				}
			}
		}

		$list_keys = array(
			'fixed__week_days__start'   => array( -1, 6, array( -1 ) ),
			'dynamic__days_specific'    => array( 1, 1095, array() ),
			'dynamic__week_days__start' => array( -1, 6, array( -1 ) ),
		);
		foreach ( $list_keys as $list_key => $bounds ) {
			if ( array_key_exists( $list_key, $calendar_parameters ) ) {
				$sanitized[ $list_key ] = $this->sanitize_preview_integer_list( $calendar_parameters[ $list_key ], $bounds[0], $bounds[1], $bounds[2] );
			}
		}

		if ( isset( $calendar_parameters['booking_recurrent_time'] ) && in_array( (string) $calendar_parameters['booking_recurrent_time'], array( 'On', 'Off' ), true ) ) {
			$sanitized['booking_recurrent_time'] = (string) $calendar_parameters['booking_recurrent_time'];
		}

		return $sanitized;
	}

	/**
	 * Normalize Date Selection values forwarded to calendar-load requests.
	 *
	 * @param mixed $request_overrides Candidate request overrides.
	 *
	 * @return array<string,int|string> Sanitized allow-listed request values.
	 */
	private function sanitize_preview_calendar_request_overrides( $request_overrides ) {
		if ( ! is_array( $request_overrides ) ) {
			return array();
		}

		$sanitized = array();
		foreach ( array( 'wpbc_settings_calendar_preview', 'wpbc_setup_wizard_date_selection_preview' ) as $marker_key ) {
			if (
				isset( $request_overrides[ $marker_key ] )
				&& is_scalar( $request_overrides[ $marker_key ] )
				&& '1' === (string) $request_overrides[ $marker_key ]
			) {
				$sanitized[ $marker_key ] = 1;
			}
		}
		if ( isset( $request_overrides['wpbc_setup_wizard_date_selection_preview_nonce'] ) && is_scalar( $request_overrides['wpbc_setup_wizard_date_selection_preview_nonce'] ) ) {
			$sanitized['wpbc_setup_wizard_date_selection_preview_nonce'] = sanitize_text_field( (string) $request_overrides['wpbc_setup_wizard_date_selection_preview_nonce'] );
		}

		$toggle_keys = array(
			'wpbc_settings_calendar_preview_changeover',
			'wpbc_settings_calendar_preview_triangles',
			'wpbc_settings_calendar_preview_recurrent_time',
			'wpbc_settings_calendar_preview_last_checkout',
			'wpbc_settings_calendar_preview_show_legend',
			'wpbc_settings_calendar_preview_legend_show_numbers',
			'wpbc_settings_calendar_preview_legend_vertical',
		);
		foreach ( array( 'available', 'pending', 'approved', 'partially', 'unavailable' ) as $legend_item ) {
			$toggle_keys[] = 'wpbc_settings_calendar_preview_legend_show_' . $legend_item;
		}
		foreach ( $toggle_keys as $toggle_key ) {
			if ( isset( $request_overrides[ $toggle_key ] ) && is_scalar( $request_overrides[ $toggle_key ] ) && in_array( (string) $request_overrides[ $toggle_key ], array( 'On', 'Off' ), true ) ) {
				$sanitized[ $toggle_key ] = (string) $request_overrides[ $toggle_key ];
			}
		}

		foreach ( array( 'available', 'pending', 'approved', 'partially', 'unavailable' ) as $legend_item ) {
			$text_key = 'wpbc_settings_calendar_preview_legend_text_' . $legend_item;
			if ( isset( $request_overrides[ $text_key ] ) && is_scalar( $request_overrides[ $text_key ] ) ) {
				$legend_text = sanitize_text_field( (string) $request_overrides[ $text_key ] );
				$sanitized[ $text_key ] = function_exists( 'mb_substr' ) ? mb_substr( $legend_text, 0, 255 ) : substr( $legend_text, 0, 255 );
			}
		}

		return $sanitized;
	}

	/**
	 * Normalize one preview boolean without treating malformed containers as true.
	 *
	 * Preview context normally originates from a server-owned mapper, but the
	 * shared transient boundary validates it again so future callers cannot turn
	 * arrays or arbitrary strings into enabled behavior through PHP casting.
	 *
	 * @param mixed $raw_value Candidate boolean value.
	 *
	 * @return bool|null Normalized boolean, or null when the value is invalid.
	 */
	private function sanitize_preview_boolean( $raw_value ) {
		if ( true === $raw_value || 1 === $raw_value || '1' === $raw_value || 'On' === $raw_value ) {
			return true;
		}

		if ( false === $raw_value || 0 === $raw_value || '0' === $raw_value || 'Off' === $raw_value ) {
			return false;
		}

		return null;
	}

	/**
	 * Normalize a scalar or array of integers against explicit bounds.
	 *
	 * @param mixed $raw_list Candidate array or comma-separated list.
	 * @param int   $minimum  Inclusive lower bound.
	 * @param int   $maximum  Inclusive upper bound.
	 * @param int[] $fallback Fallback list when no values remain.
	 *
	 * @return int[] Unique normalized integers.
	 */
	private function sanitize_preview_integer_list( $raw_list, $minimum, $maximum, array $fallback ) {
		$raw_values = is_array( $raw_list ) ? $raw_list : explode( ',', is_scalar( $raw_list ) ? (string) $raw_list : '' );
		$integers   = array();
		foreach ( $raw_values as $raw_value ) {
			if ( ! is_scalar( $raw_value ) || ! preg_match( '/^-?\d+$/', trim( (string) $raw_value ) ) ) {
				continue;
			}
			$integer_value = (int) $raw_value;
			if ( $integer_value >= $minimum && $integer_value <= $maximum ) {
				$integers[] = $integer_value;
			}
		}

		return empty( $integers ) ? $fallback : array_values( array_unique( $integers ) );
	}

	/**
	 * Validate one relative calendar skin path against the live skin registry.
	 *
	 * @param string $calendar_skin Candidate relative path or registered URL.
	 *
	 * @return string Valid relative skin path, or an empty string.
	 */
	private function sanitize_preview_calendar_skin( $calendar_skin ) {
		if ( ! function_exists( 'wpbc_get_calendar_skin_options' ) ) {
			return '';
		}

		$calendar_skin = $this->normalize_preview_calendar_skin( $calendar_skin );
		foreach ( wpbc_get_calendar_skin_options() as $registered_skin => $registered_label ) {
			if ( is_array( $registered_label ) && ! empty( $registered_label['optgroup'] ) ) {
				continue;
			}

			if ( $calendar_skin === $this->normalize_preview_calendar_skin( $registered_skin ) ) {
				return $calendar_skin;
			}
		}

		return '';
	}

	/**
	 * Convert a registered skin URL or filesystem path to canonical relative form.
	 *
	 * @param mixed $calendar_skin Calendar skin path or URL.
	 *
	 * @return string Normalized relative path.
	 */
	private function normalize_preview_calendar_skin( $calendar_skin ) {
		$calendar_skin = is_scalar( $calendar_skin ) ? sanitize_text_field( (string) $calendar_skin ) : '';
		$replace       = array( WPBC_PLUGIN_DIR, WPBC_PLUGIN_URL );
		$upload_dir    = wp_upload_dir();

		if ( ! empty( $upload_dir['basedir'] ) ) {
			$replace[] = $upload_dir['basedir'];
		}
		if ( ! empty( $upload_dir['baseurl'] ) ) {
			$replace[] = $upload_dir['baseurl'];
		}

		return str_replace( $replace, '', $calendar_skin );
	}

	public function filter_form_advanced_form_for_preview( $advanced_form, $form_id ) {

		if ( empty( $this->current_preview_data ) ) {
			return $advanced_form;
		}

		if ( 'appointment' !== $this->get_current_preview_render_mode() && (int) $form_id !== (int) $this->current_preview_data['form_id'] ) {
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

		if ( 'appointment' !== $this->get_current_preview_render_mode() && (int) $form_id !== (int) $this->current_preview_data['form_id'] ) {
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

		if ( 'appointment' !== $this->get_current_preview_render_mode() && (int) $form_id !== (int) $this->current_preview_data['form_id'] ) {
			return $structure;
		}

		if ( empty( $this->current_preview_data['structure'] ) || ! is_array( $this->current_preview_data['structure'] ) ) {
			return $structure;
		}

		return $this->current_preview_data['structure'];
	}

	/**
	 * Apply unsaved global Form Style values to the preview iframe only.
	 *
	 * @param string $wrapped_html             Wrapped booking form HTML.
	 * @param array  $bfb_settings             BFB settings.
	 * @param int    $resource_id              Booking resource ID.
	 * @param string $custom_booking_form_name Form slug.
	 * @return string
	 */
	public function filter_wrapped_html_for_preview_form_style( $wrapped_html, $bfb_settings, $resource_id, $custom_booking_form_name ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed

		$preview_style = $this->get_preview_form_style();
		if ( empty( $preview_style ) ) {
			return $wrapped_html;
		}

		$style  = isset( $preview_style['booking_form_style'] ) ? wpbc_bfb_settings__sanitize_form_style( $preview_style['booking_form_style'] ) : wpbc_bfb_settings__get_default_form_style();
		$preset = wpbc_bfb_settings__get_form_style_preset( $style );

		$wrapped_html = $this->remove_classes_from_first_form_wrapper(
			$wrapped_html,
			array(
				'wpbc_theme_dark_1',
				'wpbc_bfb_form_appearance_custom',
			)
		);
		$wrapped_html = $this->remove_classes_from_first_tag_with_classes(
			$wrapped_html,
			array( 'wpbc_bfb_form' ),
			array(
				'wpbc_theme_dark_1',
				'wpbc_bfb_form_appearance_custom',
			)
		);

		$theme_class = isset( $preset['theme_class'] ) ? sanitize_html_class( (string) $preset['theme_class'] ) : '';
		if ( '' !== $theme_class ) {
			$wrapped_html = WPBC_FE_Form_Style_Injector::add_class_to_first_tag_with_classes( $wrapped_html, array( 'wpbc_container', 'wpbc_form' ), $theme_class );
		}

		$css_vars = wpbc_bfb_settings__get_form_style_css_vars( $style, $preview_style );
		if ( ! empty( $css_vars ) ) {
			$wrapped_html = WPBC_FE_Form_Style_Injector::inject_css_vars_into_form_wrapper( $wrapped_html, $css_vars );
			$wrapped_html = WPBC_FE_Form_Style_Injector::inject_css_vars_into_bfb_root( $wrapped_html, $css_vars );
		}

		if ( wpbc_bfb_settings__is_custom_form_style( $style ) ) {
			$wrapped_html = WPBC_FE_Form_Style_Injector::add_class_to_first_tag_with_classes( $wrapped_html, array( 'wpbc_container', 'wpbc_form' ), 'wpbc_bfb_form_appearance_custom' );
			$wrapped_html = WPBC_FE_Form_Style_Injector::add_class_to_first_tag_with_classes( $wrapped_html, array( 'wpbc_bfb_form' ), 'wpbc_bfb_form_appearance_custom' );
		}

		return $wrapped_html;
	}

	/**
	 * Get sanitized preview Form Style override from the current transient data.
	 *
	 * @return array
	 */
	protected function get_preview_form_style() {

		if ( empty( $this->current_preview_data['form_style'] ) || ! is_array( $this->current_preview_data['form_style'] ) ) {
			return array();
		}

		$style = isset( $this->current_preview_data['form_style']['booking_form_style'] ) ? $this->current_preview_data['form_style']['booking_form_style'] : '';
		$style = wpbc_bfb_settings__sanitize_form_style( $style );

		$custom_options = wpbc_bfb_settings__get_custom_form_style_options( $this->current_preview_data['form_style'] );
		$accent_options = wpbc_bfb_settings__get_form_accent_options( $this->current_preview_data['form_style'] );

		return array_merge(
			array(
				'booking_form_style' => $style,
			),
			$custom_options,
			$accent_options
		);
	}

	/**
	 * Remove classes from the first outer booking form wrapper.
	 *
	 * @param string $html        HTML.
	 * @param array  $class_names Class names to remove.
	 * @return string
	 */
	protected function remove_classes_from_first_form_wrapper( $html, $class_names ) {

		return $this->remove_classes_from_first_tag_with_classes( $html, array( 'wpbc_container', 'wpbc_form' ), $class_names );
	}

	/**
	 * Remove classes from the first tag that has all required classes.
	 *
	 * @param string $html             HTML.
	 * @param array  $required_classes Required classes.
	 * @param array  $class_names      Class names to remove.
	 * @return string
	 */
	protected function remove_classes_from_first_tag_with_classes( $html, $required_classes, $class_names ) {

		$html        = (string) $html;
		$required_classes = is_array( $required_classes ) ? $required_classes : array();
		$class_names = is_array( $class_names ) ? $class_names : array();
		$remove_map  = array();
		$required_map = array();

		foreach ( $required_classes as $class_name ) {
			$class_name = sanitize_html_class( (string) $class_name );
			if ( '' !== $class_name ) {
				$required_map[ $class_name ] = true;
			}
		}

		foreach ( $class_names as $class_name ) {
			$class_name = sanitize_html_class( (string) $class_name );
			if ( '' !== $class_name ) {
				$remove_map[ $class_name ] = true;
			}
		}

		if ( empty( $remove_map ) || empty( $required_map ) ) {
			return $html;
		}

		$done = false;
		$out  = preg_replace_callback(
			'/<div\b[^>]*\bclass\s*=\s*(["\'])(.*?)\1[^>]*>/i',
			function ( $matches ) use ( &$done, $remove_map, $required_map ) {

				$tag = $matches[0];
				if ( $done ) {
					return $tag;
				}

				$quote   = $matches[1];
				$classes = preg_split( '/\s+/', trim( (string) $matches[2] ) );
				$classes = is_array( $classes ) ? $classes : array();

				foreach ( $required_map as $required_class => $unused ) {
					if ( ! in_array( $required_class, $classes, true ) ) {
						return $tag;
					}
				}

				$filtered = array();
				foreach ( $classes as $class_name ) {
					if ( '' === $class_name || isset( $remove_map[ $class_name ] ) ) {
						continue;
					}
					$filtered[] = $class_name;
				}

				$done = true;

				return preg_replace( '/\bclass\s*=\s*(["\'])(.*?)\1/i', 'class=' . $quote . esc_attr( implode( ' ', $filtered ) ) . $quote, $tag, 1 );
			},
			$html
		);

		return ( null === $out ) ? $html : $out;
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

	/**
	 * Render one inline preview and return its data-only browser bootstrap.
	 *
	 * This is the reusable response boundary for authenticated administration
	 * screens. The HTML is rendered by the normal front-end renderer, while all
	 * script elements are removed. The browser receives only JSON-safe values and
	 * initializes the form through known Booking Calendar functions; response
	 * JavaScript is never evaluated.
	 *
	 * The caller must resolve templates from a server-owned allow-list and must
	 * perform its own capability and nonce checks before returning this payload.
	 *
	 * @param int    $preview_form_id Preview resource/calendar ID.
	 * @param array  $structure       Decoded BFB structure.
	 * @param string $form_name       Form slug rendered by the booking form.
	 * @param string $advanced_form   Exported booking form source.
	 * @param string $content_form    Exported booking-data content source.
	 * @param array  $form_style      Optional unsaved Form Style settings.
	 * @param array  $preview_context Optional server-owned renderer and option context.
	 *
	 * @return array<string,mixed>|false Inline HTML and bootstrap data, or false on failure.
	 */
	public function render_inline_preview_payload( $preview_form_id, $structure, $form_name = 'standard', $advanced_form = '', $content_form = '', $form_style = array(), $preview_context = array() ) {
		$preview_form_id = is_scalar( $preview_form_id ) ? absint( $preview_form_id ) : 0;
		$preview_form_id = $preview_form_id > 0 ? $preview_form_id : 1;
		$form_name       = is_scalar( $form_name ) ? sanitize_key( (string) $form_name ) : '';
		$form_name       = '' === $form_name ? 'standard' : $form_name;
		$preview_html     = $this->render_inline_preview(
			$preview_form_id,
			$structure,
			$form_name,
			$advanced_form,
			$content_form,
			$form_style,
			$preview_context
		);

		if ( ! is_string( $preview_html ) || '' === trim( $preview_html ) ) {
			return false;
		}

		return array(
			'html'      => $this->remove_script_elements( $preview_html ),
			'bootstrap' => $this->get_inline_preview_bootstrap_data( $preview_form_id, $form_name, $preview_context ),
		);
	}

	/**
	 * Remove executable elements from renderer HTML before an AJAX response.
	 *
	 * The normal front-end renderer can return a legacy inline calendar bootstrap
	 * during AJAX requests. Inline previews use the structured bootstrap returned
	 * beside the HTML, so no script element is needed or permitted in this path.
	 *
	 * @param string $preview_html Server-rendered preview HTML.
	 *
	 * @return string Preview HTML without script elements.
	 */
	private function remove_script_elements( $preview_html ) {
		$preview_html = is_string( $preview_html ) ? $preview_html : '';
		$preview_html = preg_replace( '#<script\b[^>]*>.*?</script\s*>#is', '', $preview_html );

		return is_string( $preview_html ) ? $preview_html : '';
	}

	/**
	 * Build the explicit JSON-safe bootstrap contract for an inline form.
	 *
	 * @param int                 $preview_form_id Positive booking resource ID.
	 * @param string              $form_name       Validated Form Builder slug.
	 * @param array<string,mixed> $preview_context Optional server-owned calendar context.
	 *
	 * @return array<string,mixed> Allow-listed Booking Calendar initialization data.
	 */
	private function get_inline_preview_bootstrap_data( $preview_form_id, $form_name, array $preview_context = array() ) {
		$days_selection          = $this->get_inline_preview_days_selection();
		$balancer_max_threads    = absint( get_bk_option( 'booking_load_balancer_max_threads' ) );
		$balancer_max_threads    = $balancer_max_threads > 0 ? $balancer_max_threads : 1;
		$is_enabled_change_over = function_exists( 'wpbc_is_booking_used_check_in_out_time' )
			? (bool) wpbc_is_booking_used_check_in_out_time( false, $preview_form_id )
			: false;
		$range_guidance_default = function_exists( 'wpbc_frontend_messages__is_enabled' )
			? wpbc_frontend_messages__is_enabled( 'message_range_selection_click_last_date' )
			: true;
		$range_guidance_enabled = (bool) apply_filters(
			'wpbc_calendar_range_selection_guidance_is_enabled',
			$range_guidance_default,
			$preview_form_id,
			array(
				'resource_id' => $preview_form_id,
				'custom_form' => $form_name,
			)
		);
		$request_uri = '';

		if ( isset( $_SERVER['REQUEST_URI'] ) && is_scalar( $_SERVER['REQUEST_URI'] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			$request_uri = esc_url_raw( wp_unslash( (string) $_SERVER['REQUEST_URI'] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		}

		$calendar_parameters = array(
			'is_enabled_change_over'            => $is_enabled_change_over,
			'calendar_scroll_to'                 => false,
			'calendar_dates_start'               => '',
			'calendar_dates_end'                 => '',
			'booking_max_monthes_in_calendar'    => (string) get_bk_option( 'booking_max_monthes_in_calendar' ),
			'booking_start_day_weeek'            => (string) get_bk_option( 'booking_start_day_weeek' ),
			'calendar_number_of_months'          => '1',
			'days_select_mode'                   => (string) $days_selection['days_select_mode'],
			'fixed__days_num'                    => (int) $days_selection['fixed__days_num'],
			'fixed__week_days__start'            => $this->normalize_inline_preview_integer_list( $days_selection['fixed__week_days__start'], array( -1 ) ),
			'dynamic__days_min'                  => (int) $days_selection['dynamic__days_min'],
			'dynamic__days_max'                  => (int) $days_selection['dynamic__days_max'],
			'dynamic__days_specific'             => $this->normalize_inline_preview_integer_list( $days_selection['dynamic__days_specific'], array() ),
			'dynamic__week_days__start'          => $this->normalize_inline_preview_integer_list( $days_selection['dynamic__week_days__start'], array( -1 ) ),
			'range_selection_guidance_is_enabled' => $range_guidance_enabled,
			'booking_date_format'                => (string) get_bk_option( 'booking_date_format' ),
			'booking_time_format'                => (string) get_bk_option( 'booking_time_format' ),
		);

		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$calendar_parameters['is_parent_resource'] = function_exists( 'wpbc_get_child_resources_number' ) && wpbc_get_child_resources_number( $preview_form_id ) ? 1 : 0;
			$calendar_parameters['booking_capacity_field'] = function_exists( 'wpbc_get__booking_capacity_field__name' ) ? (string) wpbc_get__booking_capacity_field__name() : '';
			$calendar_parameters['booking_is_dissbale_booking_for_different_sub_resources'] = (string) get_bk_option( 'booking_is_dissbale_booking_for_different_sub_resources' );
		}

		if ( class_exists( 'wpdev_bk_biz_s' ) ) {
			$calendar_parameters['booking_recurrent_time'] = (string) get_bk_option( 'booking_recurrent_time' );
		}

		$preview_calendar_parameters = isset( $preview_context['calendar_parameters'] )
			? $this->sanitize_preview_calendar_parameters( $preview_context['calendar_parameters'] )
			: array();
		$calendar_parameters         = array_replace( $calendar_parameters, $preview_calendar_parameters );
		$is_enabled_change_over      = isset( $calendar_parameters['is_enabled_change_over'] )
			? (bool) $calendar_parameters['is_enabled_change_over']
			: $is_enabled_change_over;
		$calendar_request_overrides  = isset( $preview_context['calendar_request_overrides'] )
			? $this->sanitize_preview_calendar_request_overrides( $preview_context['calendar_request_overrides'] )
			: array();

		return array(
			'balancer_max_threads'          => $balancer_max_threads,
			'is_enabled_change_over'        => $is_enabled_change_over,
			'classic_booking_context_token' => '',
			'calendar_parameters'           => $calendar_parameters,
			'secure_parameters'             => array(
				'nonce'   => wp_create_nonce( 'wpbc_calendar_load_ajx_wpbcnonce' ),
				'user_id' => function_exists( 'wpbc_get_current_user_id' ) ? (string) wpbc_get_current_user_id() : (string) get_current_user_id(),
				'locale'  => (string) get_user_locale(),
			),
			'calendar_request'              => array_merge(
				array(
				'resource_id'                  => $preview_form_id,
				'booking_hash'                 => '',
				'request_uri'                  => $request_uri,
				'custom_form'                  => $form_name,
				'aggregate_resource_id_str'    => '',
				'aggregate_type'               => 'all',
				'skip_general_availability'    => 0,
				'classic_booking_context_token' => '',
				),
				$calendar_request_overrides
			),
		);
	}

	/**
	 * Return normalized day-selection options for the inline calendar contract.
	 *
	 * @return array<string,mixed> Day-selection values.
	 */
	private function get_inline_preview_days_selection() {
		$defaults = array(
			'days_select_mode'          => 'multiple',
			'fixed__days_num'           => 0,
			'fixed__week_days__start'   => '-1',
			'dynamic__days_min'         => 0,
			'dynamic__days_max'         => 0,
			'dynamic__days_specific'    => '',
			'dynamic__week_days__start' => '-1',
		);
		$days_selection = function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' )
			? wpbc__calendar__js_params__get_days_selection_arr()
			: array();

		return wp_parse_args( is_array( $days_selection ) ? $days_selection : array(), $defaults );
	}

	/**
	 * Convert a stored comma list into bounded JSON-safe integers.
	 *
	 * @param mixed $raw_list Candidate array or comma-separated list.
	 * @param array $fallback Fallback list when no integers are present.
	 *
	 * @return int[] Normalized integers.
	 */
	private function normalize_inline_preview_integer_list( $raw_list, array $fallback ) {
		$raw_values = is_array( $raw_list ) ? $raw_list : explode( ',', (string) $raw_list );
		$integers   = array();

		foreach ( $raw_values as $raw_value ) {
			if ( ! is_scalar( $raw_value ) || ! preg_match( '/^-?\d+$/', trim( (string) $raw_value ) ) ) {
				continue;
			}

			$integers[] = (int) $raw_value;
		}

		return empty( $integers ) ? $fallback : array_values( array_unique( $integers ) );
	}

	/**
	 * Render one unsaved Form Builder snapshot directly in the current request.
	 *
	 * This is the synchronous counterpart to {@see create_preview_session()} for
	 * administration screens that already load the Booking Calendar front-end
	 * assets. It uses the same source, markup, option, and Form Style filters but
	 * creates no transient, page, post, or saved Form Builder record. All filters
	 * and request-scoped state are removed before returning.
	 *
	 * The caller must resolve template definitions from a server-owned allow-list
	 * before invoking this method. Raw request values must never be passed here.
	 *
	 * @param int    $preview_form_id Preview resource/calendar ID.
	 * @param array  $structure       Decoded BFB structure.
	 * @param string $form_name       Form slug rendered by the booking form.
	 * @param string $advanced_form   Exported booking form source.
	 * @param string $content_form    Exported booking-data content source.
	 * @param array  $form_style      Optional unsaved Form Style settings.
	 * @param array  $preview_context Optional server-owned renderer and option context.
	 *
	 * @return string|false Rendered booking form HTML, or false when validation or rendering fails.
	 */
	public function render_inline_preview( $preview_form_id, $structure, $form_name = 'standard', $advanced_form = '', $content_form = '', $form_style = array(), $preview_context = array() ) {

		if ( ! class_exists( 'WPBC_FE_Render' ) || null !== $this->current_preview_data ) {
			return false;
		}

		$preview_form_id = is_scalar( $preview_form_id ) ? absint( $preview_form_id ) : 0;
		$preview_form_id = $preview_form_id > 0 ? $preview_form_id : 1;
		$structure       = $this->sanitize_preview_structure( $structure );
		$form_name       = is_scalar( $form_name ) ? sanitize_text_field( (string) $form_name ) : '';
		$advanced_form   = $this->sanitize_preview_form_source( $advanced_form );
		$content_form    = $this->sanitize_preview_form_source( $content_form );
		$form_style      = $this->sanitize_preview_form_style( $form_style );
		$preview_context = is_array( $preview_context ) ? $preview_context : array();
		$render_mode     = isset( $preview_context['render_mode'] )
			&& is_scalar( $preview_context['render_mode'] )
			&& 'appointment' === sanitize_key( (string) $preview_context['render_mode'] )
			? 'appointment'
			: 'booking';
		$option_overrides           = isset( $preview_context['option_overrides'] )
			? $this->sanitize_preview_option_overrides( $preview_context['option_overrides'] )
			: array();
		$calendar_parameters        = isset( $preview_context['calendar_parameters'] )
			? $this->sanitize_preview_calendar_parameters( $preview_context['calendar_parameters'] )
			: array();
		$calendar_request_overrides = isset( $preview_context['calendar_request_overrides'] )
			? $this->sanitize_preview_calendar_request_overrides( $preview_context['calendar_request_overrides'] )
			: array();

		if (
			null === $structure
			|| null === $advanced_form
			|| null === $content_form
			|| null === $form_style
		) {
			return false;
		}

		$form_name = '' === $form_name ? 'standard' : $form_name;
		$this->current_preview_data = array(
			'form_id'                    => $preview_form_id,
			'resource_id'                => $preview_form_id,
			'form_name'                  => $form_name,
			'scope'                      => 'inline_preview',
			'render_mode'                => $render_mode,
			'structure'                  => $structure,
			'advanced_form'              => $advanced_form,
			'content_form'               => $content_form,
			'form_style'                 => $form_style,
			'option_overrides'           => $option_overrides,
			'calendar_parameters'        => $calendar_parameters,
			'calendar_request_overrides' => $calendar_request_overrides,
		);

		$this->register_preview_source_filters();

		try {
			$preview_html = WPBC_FE_Render::render_booking_form(
				array(
					'resource_id'               => $preview_form_id,
					'cal_count'                 => 1,
					'is_echo'                   => 0,
					'custom_booking_form'       => $form_name,
					'form_status'               => 'preview',
					'calendar_request_overrides' => $calendar_request_overrides,
				)
			);
			$preview_html = is_string( $preview_html ) ? $preview_html : '';

			return $this->filter_wrapped_html_for_preview_form_style( $preview_html, array(), $preview_form_id, $form_name );
		} finally {
			$this->remove_preview_source_filters();
			$this->remove_preview_option_filter();
			$this->current_preview_data = null;
		}
	}

	// FixIn: 2026-01-03 14:31.
	/**
	 * Create a preview session: store transient snapshot and return preview URL + token.
	 *
	 * @param int    $preview_form_id Preview resource/calendar ID.
	 * @param int    $user_id         Current user ID.
	 * @param array  $structure       Decoded BFB structure.
	 * @param string $form_name       Form slug rendered by the booking shortcode.
	 * @param string $advanced_form   Exported booking form source.
	 * @param string $content_form    Exported booking-data content source.
	 * @param array  $form_style      Optional unsaved Form Style settings.
	 * @param array  $preview_context Optional server-owned renderer and option context.
	 *
	 * @return array|false Preview URL and token, or false on failure.
	 */
	public function create_preview_session( $preview_form_id, $user_id, $structure, $form_name = 'standard', $advanced_form = '', $content_form = '', $form_style = array(), $preview_context = array() ) {

		$preview_form_id       = is_scalar( $preview_form_id ) ? absint( $preview_form_id ) : 0;
		$user_id               = is_scalar( $user_id ) ? absint( $user_id ) : 0;
		$authenticated_user_id = get_current_user_id();

		if ( $preview_form_id <= 0 ) {
			$preview_form_id = 1;
		}
		if ( $authenticated_user_id <= 0 || $user_id !== $authenticated_user_id ) {
			return false;
		}
		$user_id = $authenticated_user_id;

		$structure       = $this->sanitize_preview_structure( $structure );
		$form_name       = is_scalar( $form_name ) ? sanitize_text_field( (string) $form_name ) : '';
		$advanced_form   = $this->sanitize_preview_form_source( $advanced_form );
		$content_form    = $this->sanitize_preview_form_source( $content_form );
		$form_style      = $this->sanitize_preview_form_style( $form_style );
		$preview_context = is_array( $preview_context ) ? $preview_context : array();
		$render_mode      = isset( $preview_context['render_mode'] )
			&& is_scalar( $preview_context['render_mode'] )
			&& 'appointment' === sanitize_key( (string) $preview_context['render_mode'] )
			? 'appointment'
			: 'booking';
		$option_overrides           = isset( $preview_context['option_overrides'] )
			? $this->sanitize_preview_option_overrides( $preview_context['option_overrides'] )
			: array();
		$calendar_parameters        = isset( $preview_context['calendar_parameters'] )
			? $this->sanitize_preview_calendar_parameters( $preview_context['calendar_parameters'] )
			: array();
		$calendar_request_overrides = isset( $preview_context['calendar_request_overrides'] )
			? $this->sanitize_preview_calendar_request_overrides( $preview_context['calendar_request_overrides'] )
			: array();

		if (
			null === $structure
			|| null === $advanced_form
			|| null === $content_form
			|| null === $form_style
		) {
			return false;
		}

		if ( '' === $form_name ) {
			$form_name = 'standard';
		}

		$page_id = $this->get_preview_page_id();
		if ( ! $page_id ) {
			return false;
		}

		$token = sanitize_key( wp_generate_password( 24, false, false ) );
		if ( '' === $token ) {
			return false;
		}

		$transient_key = $this->get_transient_key( $user_id, $token, $preview_form_id );

		$payload = array(
			'user_id'                    => $user_id,
			// Keep form_id for the existing URL/transient and booking-submit contract.
			'form_id'                    => $preview_form_id,
			'resource_id'                => $preview_form_id,
			'form_name'                  => $form_name,
			'scope'                      => 'preview',
			'render_mode'                => $render_mode,
			'structure'                  => $structure,
			'time'                       => time(),
			'advanced_form'              => $advanced_form,
			'content_form'               => $content_form,
			'form_style'                 => $form_style,
			'option_overrides'           => $option_overrides,
			'calendar_parameters'        => $calendar_parameters,
			'calendar_request_overrides' => $calendar_request_overrides,
		);

		if ( ! set_transient( $transient_key, $payload, 10 * MINUTE_IN_SECONDS ) ) {
			return false;
		}

		$preview_url = add_query_arg( array(
				'wpbc_bfb_preview'         => 1,
				'wpbc_bfb_preview_token'   => rawurlencode( $token ),
				'wpbc_bfb_preview_form_id' => $preview_form_id,
				'nonce'                    => wp_create_nonce( 'wpbc_bfb_preview_' . $token ),
			), get_permalink( $page_id ) );

		return array(
			'preview_url' => esc_url_raw( $preview_url ),
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
