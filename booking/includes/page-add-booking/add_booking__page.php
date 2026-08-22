<?php /**
 * @version 1.0
 * @package Booking Calendar
 * @category Content of Add New Booking
 * @author wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2015-10-31
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


/**
 * Check whether the Add Booking inspector interface is enabled.
 *
 * The interface is part of 11.4.4 and is enabled by default. The filter keeps
 * a narrow emergency fallback to the legacy toolbar for integrations that
 * need additional migration time; it is not connected to the 11.5 flag.
 *
 * @return bool True when the 11.4.4 inspector interface should be used.
 */
function wpbc_add_booking_page_is_inspector_enabled() {

	return (bool) apply_filters( 'wpbc_add_booking_page_is_inspector_enabled', true );
}


/**
 * Check whether the current request is the Add Booking administrator tab.
 *
 * @return bool True on WP Booking Calendar > Add Booking with the inspector UI enabled.
 */
function wpbc_add_booking_page_is_active() {

	if ( ! is_admin() || ! wpbc_add_booking_page_is_inspector_enabled() ) {
		return false;
	}

	$page = isset( $_GET['page'] ) && ! is_array( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab  = isset( $_GET['tab'] ) && ! is_array( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	return 'wpbc' === $page && 'add-booking' === $tab;
}


/**
 * Build a safe Add Booking URL while preserving the current resource, form,
 * editing context, and calendar layout parameters.
 *
 * @param bool $allow_past Whether the resulting page should allow past dates.
 *
 * @return string Add Booking administrator URL.
 */
function wpbc_add_booking_page_get_allow_past_url( $allow_past ) {

	$url = wpbc_get_new_booking_url__base( array( 'allow_past' ) );

	// Match the legacy toolbar when returning from a payment result state.
	if ( ! empty( $_GET['is_show_payment_form'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$url = add_query_arg( 'is_show_payment_form', 'Off', $url );
	}

	if ( $allow_past ) {
		$url = add_query_arg( 'allow_past', '1', $url );
	}

	return $url;
}


/**
 * Resolve a generated page asset, with a source fallback for development.
 *
 * Release packages use `_out`. The fallback keeps the page usable immediately
 * after a source checkout and disappears automatically after asset compilation.
 *
 * @param string $file_name Asset file name without a directory.
 *
 * @return string Asset URL.
 */
function wpbc_add_booking_page_get_asset_url( $file_name ) {

	$file_name = sanitize_file_name( $file_name );
	$folder    = file_exists( __DIR__ . '/_out/' . $file_name ) ? '_out' : '_src';

	return trailingslashit( plugins_url( '', __FILE__ ) ) . $folder . '/' . $file_name;
}


/**
 * Enqueue source-built styles for the Add Booking inspector page only.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_add_booking_page_enqueue_css( $where_to_load ) {

	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_add_booking_page_is_active() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-add-booking-page',
		wpbc_add_booking_page_get_asset_url( 'add_booking_page.css' ),
		array( 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_add_booking_page_enqueue_css', 73 );


/**
 * Enqueue the inspector tab controller for the Add Booking page only.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_add_booking_page_enqueue_js( $where_to_load ) {

	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_add_booking_page_is_active() ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-add-booking-page',
		wpbc_add_booking_page_get_asset_url( 'add_booking_page.js' ),
		array( 'jquery', 'wpbc_all' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_add_booking_page_enqueue_js', 73 );


/**
	 * Show Content
 *  Update Content
 *  Define Slug
 *  Define where to show
 */
class WPBC_Page_AddNewBooking extends WPBC_Page_Structure {


	/**
	 * Published Booking Forms available to the current user.
	 *
	 * The value is loaded lazily because both the setup summary and selector use
	 * the same list during one page render.
	 *
	 * @var array<string,array<string,mixed>>|null
	 */
	private $available_booking_forms = null;


	/**
	 * Place Add Booking under the shared Bookings page.
	 *
	 * @return string Parent page slug.
	 */
	public function in_page() {
		return 'wpbc';
	}

	/**
	 * Register the page tab and its 11.4.4 inspector shell.
	 *
	 * @return array<string,array<string,mixed>> Page tab definition.
	 */
	public function tabs() {

		$is_can_add_booking = WPBC_Add_Booking_Component::current_user_can_add_booking();
		$is_inspector_ui    = wpbc_add_booking_page_is_inspector_enabled();

		$tabs                = array();
		$tabs['add-booking'] = array(
			'is_show_top_path'                   => true,                                  // true | false.  By default value is: true.
			'is_show_top_navigation'             => true,
			'left_navigation__default_view_mode' => 'min',                             // '' | 'min' | 'compact' | 'max' | 'none'.  By default value is: ''.
			'right_vertical_sidebar__is_show'           => $is_inspector_ui,
			'right_vertical_sidebar__default_view_mode' => '',
			'right_vertical_sidebar_compact__is_show'   => $is_inspector_ui,
			'page_title'                         => __( 'Add New Booking', 'booking' ),        // Header - Title.  If false, than hidden.
			'page_description'                   => __( 'Manually add new bookings from the Admin Panel.', 'booking' ), // Header - Title Description.  If false, than hidden.
			'title'                              => __( 'Add booking', 'booking' ),        // Title of TAB.
			'hint'                               => __( 'Add booking', 'booking' ),        // Hint.
			'link'                               => '',                                    // Can be skiped,  then generated link based on Page and Tab tags. Or can  be extenral link.
			'position'                           => '',                                    // Can be: 'left'  |  'right'  |  ''.
			'css_classes'                        => '',                                    // this is CSS class(es).
			'icon'                               => '',                                    // Icon - link to the real PNG img.
			'font_icon'                          => 'wpbc-bi-plus',               // CSS definition  of forn Icon.
			'default'                            => true,                                  // Is this tab activated by default or not: true || false.
			'disabled'                           => ! $is_can_add_booking,                 // Is this tab disbaled: true || false.
			'hided'                              => ! $is_can_add_booking,                 // Is this tab hided: true || false.
			'subtabs'                            => array(),
		);

		return $tabs;
	}


	/**
	 * Render the compact Settings and Help controls for the right inspector.
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content() {

		if ( ! wpbc_add_booking_page_is_inspector_enabled() ) {
			return;
		}

		$tabs = array(
			array(
				'id'       => 'wpbc_tab_add_booking_settings',
				'panel_id' => 'wpbc_add_booking__inspector_settings',
				'title'    => __( 'Settings', 'booking' ),
				'icon'     => 'wpbc_icn_tune',
				'selected' => true,
			),
			array(
				'id'       => 'wpbc_tab_add_booking_help',
				'panel_id' => 'wpbc_add_booking__inspector_help',
				'title'    => __( 'Help', 'booking' ),
				'icon'     => 'wpbc-bi-info-circle',
			),
		);
		$tabs = (array) apply_filters( 'wpbc_admin_add_booking_inspector_tabs', $tabs );

		WPBC_UI_Sidebar_Panels::render_rightbar_tabs(
			$tabs,
			array(
				'aria_label' => __( 'Add Booking Panels', 'booking' ),
				'context'    => 'add_booking',
				'class'      => 'wpbc_add_booking__rightbar_tabs',
			)
		);
	}


	/**
	 * Render the Builder-style right inspector panels.
	 *
	 * @return void
	 */
	public function right_sidebar_content() {

		if ( ! wpbc_add_booking_page_is_inspector_enabled() ) {
			return;
		}
		?>
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_add_booking__rightbar">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_add_booking__inspector_settings',
					'labelledby' => 'wpbc_tab_add_booking_settings',
					'class'      => 'wpbc_add_booking__inspector_settings',
				),
				array( $this, 'render_settings_panel' )
			);
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_add_booking__inspector_help',
					'labelledby' => 'wpbc_tab_add_booking_help',
					'class'      => 'wpbc_add_booking__inspector_help',
					'hidden'     => true,
				),
				array( $this, 'render_help_panel' )
			);
			do_action( 'wpbc_admin_add_booking_inspector_panels', $this );
			?>
		</div>
		<?php
	}


	/**
	 * Render all controls formerly shown in the Add Booking top toolbar.
	 *
	 * Native inspector markup preserves the established IDs, reload URLs, AJAX
	 * save endpoint, MultiUser visibility rules, and commercial behavior.
	 *
	 * @return void
	 */
	public function render_settings_panel() {

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Booking Settings', 'booking' ), __( 'Configure this manual Booking and its calendar view.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_add_booking__inspector_body">
			<div class="wpbc_add_booking__top_actions wpbc_bfb__inspector__section--content wpbc_ui_el__buttons_group">
				<?php if ( function_exists( 'wpbc_toolbar_btn__auto_fill' ) ) : ?>
					<?php wpbc_toolbar_btn__auto_fill( array( 'submit_after_fill' => false ) ); ?>
				<?php endif; ?>
				<?php wpbc_toolbar_btn__add_new_booking(); ?>
				<?php do_action( 'wpbc_admin_add_booking_primary_actions', $this ); ?>
			</div>
			<?php $this->render_booking_setup_summary(); ?>
			<?php
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_booking_setup_group',
					'group' => 'add-booking-setup',
					'title' => __( 'Booking setup', 'booking' ),
					'open'  => false,
				),
				array( $this, 'render_booking_setup_controls' )
			);
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_booking_date_selection_group',
					'group' => 'add-booking-date-selection',
					'title' => __( 'Date selection', 'booking' ),
					'open'  => false,
				),
				array( $this, 'render_date_selection_controls' )
			);
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_booking_tools_group',
					'group' => 'add-booking-tools',
					'title' => __( 'Booking tools', 'booking' ),
					'open'  => false,
				),
				array( $this, 'render_booking_tools_controls' )
			);
			WPBC_UI_Sidebar_Panels::render_collapsible_group(
				array(
					'id'    => 'wpbc_add_booking_calendar_view_group',
					'group' => 'add-booking-calendar-view',
					'title' => __( 'Calendar view', 'booking' ),
					'open'  => false,
				),
				array( $this, 'render_calendar_view_controls' )
			);
			do_action( 'wpbc_admin_add_booking_settings_panel', $this );
			?>
		</div>
		<?php
	}


	/**
	 * Render resource and Booking Form selectors.
	 *
	 * @return void
	 */
	public function render_booking_setup_controls() {

		$is_resource_rendered = $this->render_booking_resource_control();
		$is_form_rendered     = $this->render_booking_form_control();

		if ( ! $is_resource_rendered && ! $is_form_rendered ) {
			?><p class="wpbc_add_booking__empty_setup"><?php esc_html_e( 'This Booking uses the default Booking resource and Standard Booking Form.', 'booking' ); ?></p><?php
		}
		do_action( 'wpbc_admin_add_booking_setup_panel', $this );
	}


	/**
	 * Render a compact summary of the current manual Booking configuration.
	 *
	 * Available settings are rendered as links that expand the correct inspector
	 * group and move keyboard focus to the corresponding control.
	 *
	 * @return void
	 */
	private function render_booking_setup_summary() {

		$resource_id    = $this->get_selected_booking_resource_id();
		$resource_title = function_exists( 'wpbc_get_resource_title' ) ? wpbc_get_resource_title( $resource_id ) : '';
		$form_name      = $this->get_selected_booking_form_name( $resource_id );
		$days_mode      = $this->get_current_days_selection_mode();
		$send_emails    = 'On' !== get_bk_option( 'booking_send_emails_off_addbooking' );
		$allow_past     = isset( $_GET['allow_past'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$enabled_label  = __( 'Enabled', 'booking' );
		$disabled_label = __( 'Disabled', 'booking' );

		if ( '' === trim( (string) $resource_title ) ) {
			$resource_title = sprintf( __( 'Resource #%d', 'booking' ), $resource_id );
		}

		$form_title = 'standard' === $form_name ? __( 'Standard', 'booking' ) : wpbc_lang( $form_name );
		?>
		<div class="wpbc_add_booking__setup_summary wpbc_bfb__inspector__section--content"
			data-wpbc-add-booking-enabled-label="<?php echo esc_attr( $enabled_label ); ?>"
			data-wpbc-add-booking-disabled-label="<?php echo esc_attr( $disabled_label ); ?>"
			aria-label="<?php esc_attr_e( 'Current Booking setup', 'booking' ); ?>">
			<div class="wpbc_add_booking__setup_summary_item">
				<span class="wpbc_add_booking__setup_summary_label"><?php esc_html_e( 'Booking resource', 'booking' ); ?></span>
				<?php if ( $this->is_booking_resource_selector_available() || $this->is_booking_resource_upgrade_visible() ) : ?>
					<a href="#select_booking_resource" class="wpbc_add_booking__setup_summary_link" data-wpbc-add-booking-open-group="add-booking-setup" data-wpbc-add-booking-focus="#select_booking_resource"><?php echo esc_html( $resource_title ); ?></a>
				<?php else : ?>
					<strong><?php echo esc_html( $resource_title ); ?></strong>
				<?php endif; ?>
			</div>
			<div class="wpbc_add_booking__setup_summary_item">
				<span class="wpbc_add_booking__setup_summary_label"><?php esc_html_e( 'Booking Form', 'booking' ); ?></span>
				<?php if ( ! empty( $this->get_available_booking_forms() ) ) : ?>
					<a href="#select_booking_form" class="wpbc_add_booking__setup_summary_link" data-wpbc-add-booking-open-group="add-booking-setup" data-wpbc-add-booking-focus="#select_booking_form"><?php echo esc_html( $form_title ); ?></a>
				<?php else : ?>
					<strong><?php echo esc_html( $form_title ); ?></strong>
				<?php endif; ?>
			</div>
			<div class="wpbc_add_booking__setup_summary_item">
				<span class="wpbc_add_booking__setup_summary_label"><?php esc_html_e( 'Date selection', 'booking' ); ?></span>
				<a href="#wpbc_add_booking_date_selection_group"
					class="wpbc_add_booking__setup_summary_link"
					data-wpbc-add-booking-open-group="add-booking-date-selection"
					data-wpbc-add-booking-focus="input[name='wpbc_add_booking_days_selection_mode']:checked"
					data-wpbc-add-booking-summary="days-selection"
					aria-label="<?php esc_attr_e( 'Change date-selection behavior', 'booking' ); ?>"><?php echo esc_html( $this->get_days_selection_mode_label( $days_mode ) ); ?></a>
			</div>
			<div class="wpbc_add_booking__setup_summary_item">
				<span class="wpbc_add_booking__setup_summary_label"><?php esc_html_e( 'Email notifications', 'booking' ); ?></span>
				<a href="#wpbc_add_booking_tools_group"
					class="wpbc_add_booking__setup_summary_link"
					data-wpbc-add-booking-open-group="add-booking-tools"
					data-wpbc-add-booking-focus="#is_send_email_for_pending"
					data-wpbc-add-booking-summary="emails"
					aria-label="<?php esc_attr_e( 'Change email notification setting', 'booking' ); ?>"><?php echo esc_html( $send_emails ? $enabled_label : $disabled_label ); ?></a>
			</div>
			<div class="wpbc_add_booking__setup_summary_item">
				<span class="wpbc_add_booking__setup_summary_label"><?php esc_html_e( 'Allow booking in the past', 'booking' ); ?></span>
				<a href="#wpbc_add_booking_tools_group"
					class="wpbc_add_booking__setup_summary_link"
					data-wpbc-add-booking-open-group="add-booking-tools"
					data-wpbc-add-booking-focus="#is_allow_bookings_in_past"
					data-wpbc-add-booking-summary="allow-past"
					aria-label="<?php esc_attr_e( 'Change past-date Booking setting', 'booking' ); ?>"><?php echo esc_html( $allow_past ? $enabled_label : $disabled_label ); ?></a>
			</div>
		</div>
		<?php
	}


	/**
	 * Render the page-local date-selection override as Calendar Settings radios.
	 *
	 * The radio values are not saved and do not reload the page. Add Booking
	 * JavaScript applies them directly to the currently rendered calendar.
	 *
	 * @return void
	 */
	public function render_date_selection_controls() {

		$resource_id       = $this->get_selected_booking_resource_id();
		$days_mode         = $this->get_current_days_selection_mode();
		$range_engine_mode = $this->get_current_range_engine_mode();
		$single_label      = __( 'Single day', 'booking' );
		$multiple_label    = __( 'Multiple days', 'booking' );
		$range_label       = class_exists( 'wpdev_bk_biz_s' ) ? __( 'Range days', 'booking' ) : __( 'Range days - 2 mouse clicks', 'booking' );
		?>
		<div class="wpbc_calendar_radio_stack wpbc_add_booking__days_radio_stack"
			data-wpbc-add-booking-days-selection="1"
			data-wpbc-resource-id="<?php echo absint( $resource_id ); ?>"
			data-wpbc-range-engine-mode="<?php echo esc_attr( $range_engine_mode ); ?>">
			<label>
				<input type="radio" name="wpbc_add_booking_days_selection_mode" value="single" data-wpbc-days-selection-label="<?php echo esc_attr( $single_label ); ?>" <?php checked( 'single', $days_mode ); ?> />
				<span><?php echo esc_html( $single_label ); ?></span>
			</label>
			<label>
				<input type="radio" name="wpbc_add_booking_days_selection_mode" value="multiple" data-wpbc-days-selection-label="<?php echo esc_attr( $multiple_label ); ?>" <?php checked( 'multiple', $days_mode ); ?> />
				<span><?php echo esc_html( $multiple_label ); ?></span>
			</label>
			<label>
				<input type="radio" name="wpbc_add_booking_days_selection_mode" value="range" data-wpbc-days-selection-label="<?php echo esc_attr( $range_label ); ?>" <?php checked( 'range', $days_mode ); ?> />
				<span><?php echo esc_html( $range_label ); ?></span>
			</label>
		</div>
		<p class="inspector__help"><?php esc_html_e( 'This temporary override applies immediately to this calendar. Changing the mode clears the currently selected dates but does not reload the page or modify saved Calendar and Booking Form settings.', 'booking' ); ?></p>
		<?php
		/**
		 * Fires after the Add Booking date-selection radio controls.
		 *
		 * @param WPBC_Page_AddNewBooking $page_instance Current Add Booking page object.
		 * @param string                 $days_mode     Current normalized mode.
		 * @param int                    $resource_id   Current Booking resource ID.
		 */
		do_action( 'wpbc_admin_add_booking_date_selection_panel', $this, $days_mode, $resource_id );
	}


	/**
	 * Get the current global calendar mode normalized for the three radio choices.
	 *
	 * The selected Booking Form may apply its own mode after page initialization;
	 * the page JavaScript synchronizes the radios with that effective mode.
	 *
	 * @return string One of `single`, `multiple`, or `range`.
	 */
	private function get_current_days_selection_mode() {

		$days_selection_mode = function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' )
			? wpbc__calendar__js_params__get_days_selection_arr()
			: array( 'days_select_mode' => get_bk_option( 'booking_type_of_day_selections' ) );
		$days_selection_mode = isset( $days_selection_mode['days_select_mode'] ) ? sanitize_key( (string) $days_selection_mode['days_select_mode'] ) : 'multiple';

		if ( in_array( $days_selection_mode, array( 'fixed', 'dynamic', 'range' ), true ) ) {
			return 'range';
		}

		return in_array( $days_selection_mode, array( 'single', 'multiple' ), true ) ? $days_selection_mode : 'multiple';
	}


	/**
	 * Get the range engine that the page should use when Range days is selected.
	 *
	 * Business Small and higher retain the configured fixed/dynamic subtype.
	 * Free and Personal use their normal unrestricted dynamic range.
	 *
	 * @return string Either `fixed` or `dynamic`.
	 */
	private function get_current_range_engine_mode() {

		if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
			return 'dynamic';
		}

		$range_engine_mode = sanitize_key( (string) get_bk_option( 'booking_range_selection_type' ) );

		return in_array( $range_engine_mode, array( 'fixed', 'dynamic' ), true ) ? $range_engine_mode : 'dynamic';
	}


	/**
	 * Get the translated label for a normalized date-selection mode.
	 *
	 * @param string $days_mode Normalized date-selection mode.
	 *
	 * @return string Translated mode label.
	 */
	private function get_days_selection_mode_label( $days_mode ) {

		if ( 'single' === $days_mode ) {
			return __( 'Single day', 'booking' );
		}

		if ( 'range' === $days_mode ) {
			return class_exists( 'wpdev_bk_biz_s' ) ? __( 'Range days', 'booking' ) : __( 'Range days - 2 mouse clicks', 'booking' );
		}

		return __( 'Multiple days', 'booking' );
	}

	/**
	 * Get the Booking resource selected for the current Add Booking page.
	 *
	 * @return int Positive Booking resource ID.
	 */
	private function get_selected_booking_resource_id() {

		if ( isset( $_GET['booking_type'] ) && ! is_array( $_GET['booking_type'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$resource_id = absint( $_GET['booking_type'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( $resource_id > 0 ) {
				return $resource_id;
			}
		}

		return 1;
	}


	/**
	 * Get the Booking Form selected explicitly or inherited from the resource.
	 *
	 * @param int $resource_id Booking resource ID used to resolve its default form.
	 *
	 * @return string Sanitized Booking Form slug.
	 */
	private function get_selected_booking_form_name( $resource_id ) {

		if ( isset( $_GET['booking_form'] ) && ! is_array( $_GET['booking_form'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			$form_name = sanitize_text_field( wp_unslash( $_GET['booking_form'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			if ( '' !== $form_name ) {
				return $form_name;
			}
		}

		return WPBC_Add_Booking_Component::get_default_booking_form_for_resource( $resource_id, 'standard' );
	}


	/**
	 * Check whether the resource selector can be used in the current context.
	 *
	 * Resource changes remain disabled while editing an existing Booking.
	 *
	 * @return bool True when the commercial resource selector is available.
	 */
	private function is_booking_resource_selector_available() {

		return empty( $_GET['booking_hash'] ) && class_exists( 'wpdev_bk_personal' ) && function_exists( 'wpbc_toolbar__get_resource_options_for_selection' ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}


	/**
	 * Check whether the Free-version resource upgrade notice should be shown.
	 *
	 * The notice replaces the unavailable resource selector only while creating
	 * a new Booking. A user may dismiss it without affecting Booking behavior.
	 *
	 * @return bool True when the upgrade notice should be rendered.
	 */
	private function is_booking_resource_upgrade_visible() {

		if ( class_exists( 'wpdev_bk_personal' ) || ! empty( $_GET['booking_hash'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return false;
		}

		if ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
			return true;
		}

		return ! function_exists( 'wpbc_is_dismissed_panel_visible' ) || wpbc_is_dismissed_panel_visible( 'wpbc_add_booking_resource_upgrade' );
	}


	/**
	 * Get published Booking Forms visible to the current user.
	 *
	 * @return array<string,array<string,mixed>> Available custom Booking Forms.
	 */
	private function get_available_booking_forms() {

		if ( null !== $this->available_booking_forms ) {
			return $this->available_booking_forms;
		}

		$is_allowed = apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
		if ( ! $is_allowed && 'On' !== get_bk_option( 'booking_is_custom_forms_for_regular_users' ) ) {
			$this->available_booking_forms = array();
			return $this->available_booking_forms;
		}

		$this->available_booking_forms = WPBC_FE_Custom_Form_Helper::get_custom_booking_forms_list(
			array(
				'include_standard' => false,
				'owner_user_id'    => WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id(),
				'statuses'         => array( 'published' ),
				'list_mode'        => 'auto',
			)
		);

		if ( ! is_array( $this->available_booking_forms ) ) {
			$this->available_booking_forms = array();
		}

		return $this->available_booking_forms;
	}


	/**
	 * Render the commercial Booking resource selector as a native inspector row.
	 *
	 * The legacy resource option provider remains the source of truth for parent,
	 * child, MultiUser, and edition-specific resource visibility. Only its toolbar
	 * HTML renderer is bypassed on this page.
	 *
	 * @return bool True when a resource selector was rendered.
	 */
	private function render_booking_resource_control() {

		if ( $this->is_booking_resource_upgrade_visible() ) {
			return $this->render_booking_resource_upgrade_control();
		}

		// A resource cannot be switched while editing an existing Booking.
		if ( ! $this->is_booking_resource_selector_available() ) {
			return false;
		}

		$resource_options = wpbc_toolbar__get_resource_options_for_selection();
		if ( empty( $resource_options ) || ! is_array( $resource_options ) ) {
			return false;
		}

		$link_base = wpbc_get_new_booking_url__base( array( 'booking_type', 'booking_form', 'parent_res' ) ) . '&booking_type=';

		$this->render_inspector_select_row(
			array(
				'id'        => 'select_booking_resource',
				'name'      => 'select_booking_resource',
				'label'     => __( 'Booking resource', 'booking' ),
				'options'   => $resource_options,
				'on_change' => 'window.location.href = ' . wp_json_encode( $link_base ) . ' + this.value;',
			)
		);

		return true;
	}


	/**
	 * Render the Free-version resource explanation in place of the selector.
	 *
	 * @return bool True after the inspector control has been rendered.
	 */
	private function render_booking_resource_upgrade_control() {

		$dismiss_id = 'wpbc_add_booking_resource_upgrade';
		$is_demo    = function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo();
		?>
		<div class="inspector__row wpbc_add_booking__resource_upgrade_row" id="<?php echo esc_attr( $dismiss_id ); ?>">
			<span class="inspector__label"><?php esc_html_e( 'Booking resource', 'booking' ); ?></span>
			<div class="inspector__control" id="select_booking_resource" tabindex="-1">
				<div class="wpbc_add_booking__resource_upgrade_hint">
					<a class="wpbc_pro_label" href="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>" target="_blank" rel="noopener noreferrer">Pro</a>
					<?php if ( ! $is_demo && function_exists( 'wpbc_is_dismissed' ) ) : ?>
						<span class="wpbc_add_booking__premium_dismiss">
							<?php
							wpbc_is_dismissed(
								$dismiss_id,
								array(
									'title' => '&times;',
									'hint'  => __( 'Hide this option', 'booking' ),
									'css'   => 'float:none;',
								)
							);
							?>
						</span>
					<?php endif; ?>
					<span class="wpbc_add_booking__resource_upgrade_description"><?php esc_html_e( 'The Free version has one default booking resource. To have multiple resources, please upgrade to a premium version.', 'booking' ); ?></span>
				</div>
			</div>
		</div>
		<?php

		return true;
	}


	/**
	 * Render the available Booking Forms as a native inspector row.
	 *
	 * This follows the same MultiUser access rule and resource-default selection
	 * used by the legacy toolbar selector without mutating request data.
	 *
	 * @return bool True when a Booking Form selector was rendered.
	 */
	private function render_booking_form_control() {

		$booking_forms = $this->get_available_booking_forms();

		if ( empty( $booking_forms ) || ! is_array( $booking_forms ) ) {
			return false;
		}

		$resource_id = $this->get_selected_booking_resource_id();
		$form_name   = $this->get_selected_booking_form_name( $resource_id );

		$form_options = array(
			'standard'          => array(
				'title'    => __( 'Standard', 'booking' ),
				'selected' => 'standard' === $form_name,
			),
			'custom_forms_open' => array(
				'optgroup' => true,
				'close'    => false,
				'title'    => __( 'Custom Forms', 'booking' ),
			),
		);

		foreach ( $booking_forms as $booking_form ) {
			$booking_form_name = isset( $booking_form['name'] ) ? sanitize_text_field( (string) $booking_form['name'] ) : '';
			if ( '' === $booking_form_name ) {
				continue;
			}

			$form_options[ $booking_form_name ] = array(
				'title'    => wpbc_lang( $booking_form_name ),
				'selected' => $booking_form_name === $form_name,
			);
		}

		$form_options['custom_forms_close'] = array(
			'optgroup' => true,
			'close'    => true,
		);

		$link_base = wpbc_get_new_booking_url__base( array( 'booking_form' ) ) . '&booking_form=';

		$this->render_inspector_select_row(
			array(
				'id'        => 'select_booking_form',
				'name'      => 'select_booking_form',
				'label'     => __( 'Booking Form', 'booking' ),
				'options'   => $form_options,
				'on_change' => 'window.location.href = ' . wp_json_encode( $link_base ) . ' + this.value;',
				'after'     => function () use ( $form_name ) {
					$this->render_booking_form_edit_link( $form_name );
				},
			)
		);

		return true;
	}


	/**
	 * Render a Forms Builder link for the currently selected Booking Form.
	 *
	 * @param string $form_name Sanitized Booking Form slug.
	 *
	 * @return void
	 */
	private function render_booking_form_edit_link( $form_name ) {

		if ( ! function_exists( 'wpbc_get_settings_url' ) ) {
			return;
		}

		$base_url = add_query_arg( 'tab', 'builder_booking_form', wpbc_get_settings_url() );
		$edit_url = add_query_arg( 'form_name', $form_name, $base_url );
		?>
		<a href="<?php echo esc_url( $edit_url ); ?>"
		   class="wpbc_modal__add_booking__edit_form_link wpbc_add_booking__edit_form_link"
		   data-wpbc-add-booking-form-builder-url="<?php echo esc_url( $base_url ); ?>"
		   target="_blank"
		   rel="noopener noreferrer"
		   title="<?php esc_attr_e( 'Edit selected booking form', 'booking' ); ?>">
			<i class="menu_icon icon-1x wpbc_icn_draw" aria-hidden="true"></i>
			<span><?php esc_html_e( 'Edit form', 'booking' ); ?></span>
		</a>
		<?php
	}


	/**
	 * Render one select field using the shared Builder-style inspector markup.
	 *
	 * Option arrays may contain the Booking Calendar toolbar option keys
	 * `title`, `class`, `disabled`, `selected`, and `optgroup`.
	 * An optional `after` callback renders related controls beneath the select.
	 *
	 * @param array $args Select field arguments.
	 *
	 * @return void
	 */
	private function render_inspector_select_row( $args ) {

		$args = wp_parse_args(
			$args,
			array(
				'id'        => '',
				'name'      => '',
				'label'     => '',
				'options'   => array(),
				'value'     => null,
				'on_change' => '',
				'after'     => null,
			)
		);
		?>
		<div class="inspector__row">
			<label for="<?php echo esc_attr( $args['id'] ); ?>" class="inspector__label"><?php echo esc_html( $args['label'] ); ?></label>
			<div class="inspector__control">
				<select id="<?php echo esc_attr( $args['id'] ); ?>"
						name="<?php echo esc_attr( $args['name'] ); ?>"
						class="inspector__input"
						<?php echo '' !== $args['on_change'] ? 'onchange="' . esc_attr( $args['on_change'] ) . '"' : ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						autocomplete="off">
					<?php $this->render_inspector_select_options( $args['options'], $args['value'] ); ?>
				</select>
				<?php
				if ( is_callable( $args['after'] ) ) {
					call_user_func( $args['after'] );
				}
				?>
			</div>
		</div>
		<?php
	}


	/**
	 * Render select options and optgroups from Booking Calendar option arrays.
	 *
	 * @param array             $options        Option definitions keyed by submitted value.
	 * @param string|int|null   $selected_value Explicit selected value, or null to use each option's selected flag.
	 *
	 * @return void
	 */
	private function render_inspector_select_options( $options, $selected_value = null ) {

		foreach ( (array) $options as $option_value => $option_definition ) {
			$option_definition = is_array( $option_definition ) ? $option_definition : array( 'title' => $option_definition );

			if ( ! empty( $option_definition['optgroup'] ) ) {
				if ( ! empty( $option_definition['close'] ) ) {
					?></optgroup><?php
				} else {
					?><optgroup label="<?php echo esc_attr( isset( $option_definition['title'] ) ? $option_definition['title'] : '' ); ?>"><?php
				}
				continue;
			}

			$option_title = isset( $option_definition['title'] ) ? wp_strip_all_tags( html_entity_decode( (string) $option_definition['title'], ENT_QUOTES, get_bloginfo( 'charset' ) ) ) : '';
			$is_selected  = null === $selected_value ? ! empty( $option_definition['selected'] ) : (string) $selected_value === (string) $option_value;
			?>
			<option value="<?php echo esc_attr( $option_value ); ?>"
					class="<?php echo esc_attr( isset( $option_definition['class'] ) ? $option_definition['class'] : '' ); ?>"
					<?php selected( $is_selected ); ?>
					<?php disabled( ! empty( $option_definition['disabled'] ) ); ?>><?php echo esc_html( $option_title ); ?></option>
			<?php
		}
	}


	/**
	 * Render email and past-date controls.
	 *
	 * @return void
	 */
	public function render_booking_tools_controls() {

		$allow_past     = isset( $_GET['allow_past'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$allow_past_url = esc_url_raw( wpbc_add_booking_page_get_allow_past_url( true ) );
		$normal_url     = esc_url_raw( wpbc_add_booking_page_get_allow_past_url( false ) );
		$send_emails    = 'On' !== get_bk_option( 'booking_send_emails_off_addbooking' );
		?>
		<div class="inspector__row inspector__row--toggle">
			<div class="inspector__control">
				<?php
				wpbc_flex_toggle(
					array(
						'id'       => 'is_send_email_for_pending',
						'name'     => 'is_send_email_for_pending',
						'label'    => array( 'title' => __( 'Emails sending', 'booking' ) ),
						'value'    => 'On',
						'selected' => $send_emails,
						'legend'   => __( 'Send email notifications for this Booking', 'booking' ),
					)
				);
				?>
				<p class="inspector__help"><?php esc_html_e( 'Send the normal Booking Calendar notifications when this Booking is created.', 'booking' ); ?></p>
			</div>
		</div>
		<div class="inspector__row inspector__row--toggle">
			<div class="inspector__control">
				<?php
				wpbc_flex_toggle(
					array(
						'id'       => 'is_allow_bookings_in_past',
						'name'     => 'is_allow_bookings_in_past',
						'label'    => array( 'title' => __( 'Allow booking in the past', 'booking' ) ),
						'value'    => 'On',
						'selected' => $allow_past,
						'legend'   => __( 'Allow booking in the past', 'booking' ),
						'onchange' => 'window.location.href = this.checked ? ' . wp_json_encode( $allow_past_url ) . ' : ' . wp_json_encode( $normal_url ) . ';',
					)
				);
				?>
				<p class="inspector__help"><?php esc_html_e( 'Use this only for historical or manually entered Bookings.', 'booking' ); ?></p>
			</div>
		</div>
		<?php do_action( 'wpbc_admin_add_booking_tools_panel', $this ); ?>
		<?php
	}


	/**
	 * Render per-user calendar sizing controls and their existing AJAX actions.
	 *
	 * @return void
	 */
	public function render_calendar_view_controls() {

		$user_calendar_options = $this->get_saved_user_calendar_settings();
		$month_options         = array_combine( range( 1, 12 ), range( 1, 12 ) );
		$months_per_row        = array( 0 => __( 'All', 'booking' ) ) + $month_options;

		$this->render_inspector_select_row(
			array(
				'id'      => 'calendar_months_count',
				'name'    => 'calendar_months_count',
				'label'   => __( 'Visible months', 'booking' ),
				'options' => $month_options,
				'value'   => isset( $user_calendar_options['calendar_months_count'] ) ? absint( $user_calendar_options['calendar_months_count'] ) : 1,
			)
		);
		$this->render_inspector_select_row(
			array(
				'id'      => 'calendar_months_num_in_1_row',
				'name'    => 'calendar_months_num_in_1_row',
				'label'   => __( 'Number of months in one row', 'booking' ),
				'options' => $months_per_row,
				'value'   => isset( $user_calendar_options['calendar_months_num_in_1_row'] ) ? absint( $user_calendar_options['calendar_months_num_in_1_row'] ) : 0,
			)
		);

		$this->render_inspector_measurement_row(
			'calendar_width',
			__( 'Maximum width of calendar', 'booking' ),
			isset( $user_calendar_options['calendar_width'] ) ? $user_calendar_options['calendar_width'] : '',
			isset( $user_calendar_options['calendar_widthunits'] ) ? $user_calendar_options['calendar_widthunits'] : 'px',
			'100%'
		);
		$this->render_inspector_measurement_row(
			'calendar_cell_height',
			__( 'Calendar cell height', 'booking' ),
			isset( $user_calendar_options['calendar_cell_height'] ) ? $user_calendar_options['calendar_cell_height'] : '',
			isset( $user_calendar_options['calendar_cell_heightunits'] ) ? $user_calendar_options['calendar_cell_heightunits'] : 'px',
			'48px'
		);
		?>
		<div class="wpbc_add_booking__panel_actions">
			<button type="button"
					id="toolbar_btn__calendar_options_save"
					class="button button-primary"
					onclick="var wpbc_calendar_options = { calendar_months_count: jQuery( '#calendar_months_count' ).val(), calendar_months_num_in_1_row: jQuery( '#calendar_months_num_in_1_row' ).val(), calendar_width: jQuery( '#calendar_width' ).val(), calendar_widthunits: jQuery( '#calendar_widthunits' ).val(), calendar_cell_height: jQuery( '#calendar_cell_height' ).val(), calendar_cell_heightunits: jQuery( '#calendar_cell_heightunits' ).val() }; wpbc_save_custom_user_data( <?php echo absint( wpbc_get_current_user_id() ); ?>, 'add_booking_calendar_options', jQuery.param( wpbc_calendar_options ), 1 );"><?php esc_html_e( 'Save', 'booking' ); ?></button>
			<button type="button"
					class="button button-secondary"
					onclick="jQuery( '#calendar_months_count' ).val( '1' ); jQuery( '#calendar_months_num_in_1_row' ).val( '0' ); jQuery( '#calendar_width' ).val( '0' ); jQuery( '#calendar_widthunits' ).val( 'px' ); jQuery( '#calendar_cell_height' ).val( '0' ); jQuery( '#calendar_cell_heightunits' ).val( 'px' ); jQuery( '#toolbar_btn__calendar_options_save' ).trigger( 'click' );"><?php esc_html_e( 'Reset', 'booking' ); ?></button>
		</div>
		<?php do_action( 'wpbc_admin_add_booking_calendar_view_panel', $this, $user_calendar_options ); ?>
		<?php
	}


	/**
	 * Render a numeric calendar measurement and its unit selector.
	 *
	 * @param string     $field_id   Base HTML id and name.
	 * @param string     $label      Visible field label.
	 * @param string|int $value      Saved numeric value.
	 * @param string     $unit       Saved unit: `px` or `percent`.
	 * @param string     $placeholder Example value shown when empty.
	 *
	 * @return void
	 */
	private function render_inspector_measurement_row( $field_id, $label, $value, $unit, $placeholder ) {

		$unit = in_array( $unit, array( 'px', 'percent' ), true ) ? $unit : 'px';
		?>
		<div class="inspector__row">
			<label for="<?php echo esc_attr( $field_id ); ?>" class="inspector__label"><?php echo esc_html( $label ); ?></label>
			<div class="inspector__control inspector__control--inline">
				<input id="<?php echo esc_attr( $field_id ); ?>" name="<?php echo esc_attr( $field_id ); ?>" type="number" min="0" step="1" value="<?php echo esc_attr( $value ); ?>" placeholder="<?php echo esc_attr( $placeholder ); ?>" class="inspector__input">
				<select id="<?php echo esc_attr( $field_id . 'units' ); ?>" name="<?php echo esc_attr( $field_id . 'units' ); ?>" class="inspector__input inspector__input--unit" autocomplete="off">
					<option value="px" <?php selected( 'px', $unit ); ?>>px</option>
					<option value="percent" <?php selected( 'percent', $unit ); ?>>%</option>
				</select>
			</div>
		</div>
		<?php
	}


	/**
	 * Render contextual help in place of the legacy toolbar Help dropdown.
	 *
	 * @return void
	 */
	public function render_help_panel() {

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Add Booking Help', 'booking' ), __( 'Create a Booking directly from the WordPress Admin Panel.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_bfb__inspector__body--content wpbc_add_booking__help_body">
			<div class="wpbc_add_booking__hint">
				<span class="wpbc_icn_info_outline" aria-hidden="true"></span>
				<p><?php esc_html_e( 'Choose the Booking resource and form first. Changing either selector reloads this page so every field and calendar keeps the correct resource ID.', 'booking' ); ?></p>
			</div>
			<div class="wpbc_add_booking__help_section">
				<h4><?php esc_html_e( 'Recommended workflow', 'booking' ); ?></h4>
				<ol>
					<li><?php esc_html_e( 'Select the Booking resource and Booking Form.', 'booking' ); ?></li>
					<li><?php esc_html_e( 'Choose an available date or time and complete the customer fields.', 'booking' ); ?></li>
					<li><?php esc_html_e( 'Review email sending, then click Add booking.', 'booking' ); ?></li>
				</ol>
			</div>
			<div class="wpbc_add_booking__help_actions">
				<a class="button" href="https://wpbookingcalendar.com/faq/" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'FAQ', 'booking' ); ?></a>
				<a class="button" href="https://wpbookingcalendar.com/support/" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Support', 'booking' ); ?></a>
			</div>
			<?php do_action( 'wpbc_admin_add_booking_help_panel', $this ); ?>
		</div>
		<?php
	}


	/**
	 * Render the legacy page or the released inspector presentation.
	 *
	 * Both presentations delegate the actual Booking Form to the same reusable
	 * component, so calendar and submission behavior cannot diverge.
	 *
	 * @return void|false False when the current user cannot use the page.
	 */
	public function content() {

		do_action( 'wpbc_hook_add_booking_page_header', 'add_booking' );         // Define Notices Section and show some static messages, if needed.

		if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {
			return false;  // Check if MU user activated,  otherwise show Warning message.
		}

		if ( ! WPBC_Add_Booking_Component::current_user_can_add_booking() ) {
			return false;
		}

		if ( ! wpbc_set_default_resource_to__get() ) {
			return false;  // Define default booking resources for $_ GET and check if booking resource belong to user.
		}

		if ( wpbc_add_booking_page_is_inspector_enabled() ) {
			?>
			<div class="wpbc_add_booking_page" data-wpbc-add-booking-page="1">
				<div class="wpbc_add_booking__canvas">
					<?php
					WPBC_Add_Booking_Component::render(
						array(
							'is_toolbar_visible'            => false,
							'is_show_before_content_spacer' => false,
							'is_show_footer_email_toggle'   => false,
							'content_css_class'             => 'add_booking_page_content wpbc_add_booking__form_content',
							'content_style'                 => '',
						)
					);
					?>
				</div>
			</div>
			<?php
		} else {
			WPBC_Add_Booking_Component::render();
		}

		do_action( 'wpbc_hook_add_booking_page_footer', 'add_booking' );
	}


	/**
	 * Get Calendar Options of specific User
	 *
	 * @return array<string,mixed> Normalized calendar display options.
	 */
	public function get_saved_user_calendar_options() {

		return WPBC_Add_Booking_Component::get_saved_user_calendar_options();
	}


	/**
	 * Get raw saved calendar fields used by the Add Booking inspector.
	 *
	 * @return array<string,mixed> Raw per-user calendar settings.
	 */
	private function get_saved_user_calendar_settings() {

		return WPBC_Add_Booking_Component::get_saved_user_calendar_settings();
	}

}
add_action('wpbc_menu_created', array( new WPBC_Page_AddNewBooking() , '__construct') );    // Executed after creation of Menu

/**
 * Redirect legacy/main-menu Add Booking page to the Add Booking tab under Bookings.
 *
 * @param string $page_tag Current menu page tag.
 *
 * @return void
 */
function wpbc_add_booking_menu_page__redirect_to_add_booking_tab( $page_tag ) {

	if ( 'wpbc-new' !== $page_tag ) {
		return;
	}

	wpbc_redirect( wpbc_get_new_booking_url() );
}
add_action( 'wpbc_page_structure_show', 'wpbc_add_booking_menu_page__redirect_to_add_booking_tab', 0 );
