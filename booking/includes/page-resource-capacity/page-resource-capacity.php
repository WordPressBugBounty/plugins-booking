<?php
/**
 * Booking resource capacity settings page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/page-resource-capacity/class-wpbc-settings-api-capacity.php';

/**
 * Check whether the Resource Capacity page is active.
 *
 * @return bool
 */
function wpbc_resource_capacity__is_page() {

	if ( ! is_admin() ) {
		return false;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_REQUEST['page'] ) ? sanitize_key( wp_unslash( $_REQUEST['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';

	return ( 'wpbc-resources' === $page && 'capacity' === $tab );
}

/**
 * Redirect old dashboard links that target the removed General Settings capacity section.
 *
 * @return void
 */
function wpbc_resource_capacity__redirect_legacy_settings_url() {

	if ( ! is_admin() ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$scroll_to_section = isset( $_GET['scroll_to_section'] ) ? sanitize_key( wp_unslash( $_GET['scroll_to_section'] ) ) : '';

	if ( 'wpbc-settings' !== $page || 'wpbc_general_settings_capacity_tab' !== $scroll_to_section ) {
		return;
	}

	wp_safe_redirect( wpbc_get_resource_capacity_url() );
	exit;
}
add_action( 'admin_init', 'wpbc_resource_capacity__redirect_legacy_settings_url', 1 );

/**
 * Manage capability for Capacity Rules.
 *
 * @return string
 */
function wpbc_resource_capacity__get_manage_cap() {

	$min_user_role = get_bk_option( 'booking_user_role_settings' );
	$capability    = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);

	return isset( $capability[ $min_user_role ] ) ? $capability[ $min_user_role ] : 'manage_options';
}

/**
 * Check if current user can manage Capacity Rules.
 *
 * @return bool
 */
function wpbc_resource_capacity__user_can_manage() {

	return wpbc_is_mu_user_can_be_here( 'only_super_admin' ) && current_user_can( wpbc_resource_capacity__get_manage_cap() );
}

/**
 * Block direct page rendering when the user does not have Capacity Rules access.
 *
 * @param bool   $is_show_this_page Whether page should be shown.
 * @param string $page_tag          Page tag.
 * @param string $active_page_tab   Active tab.
 * @param string $active_page_subtab Active subtab.
 *
 * @return bool
 */
function wpbc_resource_capacity__check_showing_page( $is_show_this_page, $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'wpbc-resources' === $page_tag ) && ( 'capacity' === $active_page_tab ) && ! wpbc_resource_capacity__user_can_manage() ) {
		return false;
	}

	return $is_show_this_page;
}
add_filter( 'wpbc_before_showing_settings_page_is_show_page', 'wpbc_resource_capacity__check_showing_page', 20, 4 );

/**
 * Enqueue CSS for Capacity Rules.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_resource_capacity_enqueue_css_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_resource_capacity__is_page() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-resource-capacity-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/page_resource_capacity.css',
		array( 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_resource_capacity_enqueue_css_files', 66 );

/**
 * Enqueue JS for Capacity Rules.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_resource_capacity_enqueue_js_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_resource_capacity__is_page() ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-resource-capacity-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/page_resource_capacity.js',
		array( 'jquery', 'wpbc_all' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);

	wp_localize_script(
		'wpbc-resource-capacity-page',
		'wpbc_resource_capacity_page',
		array(
			'i18n' => array(
				'auto_cancel_warning' => __( 'Warning!!! After you approved the specific booking(s), all your pending bookings of the same booking resource as an approved booking for the dates, which are intersect with dates of approved booking, will be automatically canceled!', 'booking' ),
				'always_available_warning' => __( 'Warning! You allow unlimited number of bookings per same dates, its can be a reason of double bookings on the same date. Do you really want to do this?', 'booking' ),
			),
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_resource_capacity_enqueue_js_files', 66 );

/**
 * Capacity Rules tab on the Resources page.
 */
class WPBC_Page_Resource_Capacity extends WPBC_Page_Structure {

	/**
	 * Settings API instance.
	 *
	 * @var WPBC_Settings_API_Capacity|false
	 */
	private $settings_api = false;

	/**
	 * Whether settings were saved during this request.
	 *
	 * @var bool
	 */
	private $is_updated = false;

	/**
	 * Menu slug.
	 *
	 * @return string
	 */
	public function in_page() {

		if ( ! wpbc_resource_capacity__user_can_manage() ) {
			return (string) wp_rand( 100000, 1000000 );
		}

		return 'wpbc-resources';
	}

	/**
	 * Register tab.
	 *
	 * @return array
	 */
	public function tabs() {

		return array(
			'capacity' => array(
				'is_show_top_path'                   => true,
				'left_navigation__default_view_mode' => 'compact',
				'title'                              => __( 'Capacity Rules', 'booking' ),
				'hint'                               => __( 'Manage booking capacity, pending-day availability, and related resource rules.', 'booking' ),
				'page_title'                         => __( 'Capacity Rules', 'booking' ),
				'link'                               => '',
				'position'                           => '',
				'css_classes'                        => 'wpbc_top_tab__resource_capacity',
				'icon'                               => '',
				'font_icon'                          => 'wpbc_icn_filter_none',
				'font_icon_right'                    => 'wpbc-bi-question-circle',
				'default'                            => false,
				'disabled'                           => false,
				'hided'                              => false,
				'subtabs'                            => array(),
				'folder_style'                       => 'order:15;',
			),
		);
	}

	/**
	 * Get Settings API class.
	 *
	 * @return WPBC_Settings_API_Capacity
	 */
	public function settings_api() {

		if ( false === $this->settings_api ) {
			$this->settings_api = new WPBC_Settings_API_Capacity();
		}

		return $this->settings_api;
	}

	/**
	 * Save settings.
	 *
	 * @return void
	 */
	public function maybe_update() {

		$form_name = 'wpbc_resource_capacity_form';

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST[ 'is_form_sbmitted_' . $form_name ] ) ) {
			return;
		}

		check_admin_referer( 'wpbc_settings_page_' . $form_name );

		if ( ! wpbc_resource_capacity__user_can_manage() ) {
			return;
		}

		$validated_fields = $this->settings_api()->validate_post();

		foreach ( $validated_fields as $field_name => $field_value ) {
			if ( false !== strpos( $field_name, '__promote_upgrade' ) ) {
				unset( $validated_fields[ $field_name ] );
			}
		}

		$this->settings_api()->save_to_db( $validated_fields );
		$this->is_updated = true;
	}

	/**
	 * Page content.
	 *
	 * @return false|void
	 */
	public function content() {

		do_action( 'wpbc_hook_settings_page_header', 'resource_capacity' );

		if ( ! wpbc_resource_capacity__user_can_manage() ) {
			return false;
		}

		if ( function_exists( 'wpbc_js_for_bookings_page' ) ) {
			wpbc_js_for_bookings_page();
		}

		if ( $this->is_updated ) {
			wpbc_show_changes_saved_message();
		}

		$submit_form_name = 'wpbc_resource_capacity_form';
		?>
		<div class="wpbc_resource_capacity_page wpdevelop">
			<span class="metabox-holder">
				<form name="<?php echo esc_attr( $submit_form_name ); ?>" id="<?php echo esc_attr( $submit_form_name ); ?>" action="" method="post" autocomplete="off">
					<?php wp_nonce_field( 'wpbc_settings_page_' . $submit_form_name ); ?>
					<input type="hidden" name="is_form_sbmitted_<?php echo esc_attr( $submit_form_name ); ?>" id="is_form_sbmitted_<?php echo esc_attr( $submit_form_name ); ?>" value="1" />

					<div class="wpbc_settings_row wpbc_settings_row_full_width">
						<?php
						wpbc_open_meta_box_section(
							'wpbc_resource_capacity_rules',
							__( 'Capacity Rules', 'booking' ),
							array(
								'is_section_visible_after_load' => true,
								'is_show_minimize'              => false,
							)
						);
						$this->settings_api()->show( 'capacity' );
						wpbc_close_meta_box_section();

						if ( ! class_exists( 'wpdev_bk_personal' ) ) {
							$wpbc_metabox_id = 'wpbc_resource_capacity_upgrade';

							wpbc_open_meta_box_section(
								$wpbc_metabox_id,
								__( 'Booking Quantity Control - Set limits for the number of bookings per day or time slot.', 'booking' ),
								array(
									'is_section_visible_after_load' => true,
									'is_show_minimize'              => false,
								)
							);
							$this->settings_api()->show( 'capacity_upgrade' );
							wpbc_close_meta_box_section();
						}
						?>
					</div>

					<input type="submit" value="<?php esc_attr_e( 'Save Changes', 'booking' ); ?>" class="button button-primary wpbc_submit_button" />
				</form>
			</span>
		</div>
		<?php

		do_action( 'wpbc_hook_settings_page_footer', 'resource_capacity' );
	}
}
add_action( 'wpbc_menu_created', array( new WPBC_Page_Resource_Capacity(), '__construct' ) );
