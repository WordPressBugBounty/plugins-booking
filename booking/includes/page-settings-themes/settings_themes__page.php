<?php
/**
 * Appearance / Theme settings page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once WPBC_PLUGIN_DIR . '/includes/_front_end/form-style-presets.php';

/**
 * Check whether the Appearance / Theme settings page is active.
 *
 * @return bool
 */
function wpbc_settings_themes__is_page() {

	if ( ! is_admin() ) {
		return false;
	}

	if ( function_exists( 'wpbc_is_settings_themes_page' ) ) {
		return wpbc_is_settings_themes_page();
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_REQUEST['page'] ) ? sanitize_key( wp_unslash( $_REQUEST['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';

	return ( 'wpbc-settings' === $page && 'themes' === $tab );
}

/**
 * Redirect legacy Color Theme URLs to the new Appearance / Theme page.
 *
 * @return void
 */
function wpbc_settings_themes__redirect_legacy_color_themes_url() {

	if ( ! is_admin() ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';

	if (
		'wpbc-settings' !== $page
		|| 'color_themes' !== $tab
	) {
		return;
	}

	$args = array();
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	foreach ( wp_unslash( $_GET ) as $key => $value ) {
		$key = sanitize_key( $key );
		if ( in_array( $key, array( 'page', 'tab' ), true ) || is_array( $value ) ) {
			continue;
		}
		$args[ $key ] = sanitize_text_field( $value );
	}

	$url = function_exists( 'wpbc_get_settings_themes_url' )
		? wpbc_get_settings_themes_url()
		: admin_url( 'admin.php?page=wpbc-settings&tab=themes' );

	wp_safe_redirect( add_query_arg( $args, $url ) );
	exit;
}
add_action( 'admin_init', 'wpbc_settings_themes__redirect_legacy_color_themes_url', 1 );

/**
 * Enqueue CSS for Appearance / Theme.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_settings_themes_enqueue_css_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_settings_themes__is_page() ) {
		return;
	}

	wp_enqueue_style(
		'wpbc-settings-themes-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/settings_themes_page.css',
		array( 'wpbc-calendar', 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_settings_themes_enqueue_css_files', 66 );

/**
 * Enqueue JS for Appearance / Theme.
 *
 * @param string $where_to_load Where assets are loaded.
 *
 * @return void
 */
function wpbc_settings_themes_enqueue_js_files( $where_to_load ) {

	if ( ( ! is_admin() ) || ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) ) {
		return;
	}

	if ( ! wpbc_settings_themes__is_page() ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-settings-themes-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/settings_themes_page.js',
		array( 'jquery', 'wpbc_all' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);

	wp_localize_script(
		'wpbc-settings-themes-page',
		'wpbc_settings_themes_page',
		array(
			'ajax_url'       => admin_url( 'admin-ajax.php' ),
			'plugin_url'     => trailingslashit( WPBC_PLUGIN_URL ),
			'nonce'          => wp_create_nonce( 'wpbc_settings_themes_ajax_nonce' ),
			'action'         => 'WPBC_AJX_SETTINGS_THEMES_SAVE',
			'preview_action' => 'WPBC_AJX_SETTINGS_THEMES_PREVIEW',
			'settings'       => wpbc_settings_themes__get_settings_response(),
			'form_style_presets' => wpbc_bfb_settings__get_form_style_presets(),
			'form_style_css_var_names' => wpbc_bfb_settings__get_form_style_css_var_names(),
			'custom_form_style_defaults' => wpbc_bfb_settings__get_default_custom_form_style_options(),
			'days_selection' => wpbc_settings_themes__get_days_selection_response(),
			'i18n'           => array(
				'saving'                     => __( 'Saving', 'booking' ),
				'saved'                      => __( 'Appearance settings updated.', 'booking' ),
				'save_failed'                => __( 'Unable to save appearance settings.', 'booking' ),
				'preview_failed'             => __( 'Unable to refresh calendar preview.', 'booking' ),
				'security_error'             => __( 'Security check failed.', 'booking' ),
				'loading'                    => __( 'Loading', 'booking' ),
				'calendar_only_theme_notice' => __( 'Preview is set to Calendar only. A matching calendar skin was selected automatically; switch Preview to Booking form to inspect the form theme.', 'booking' ),
				'form_preview_option_notice' => __( 'This option is visible in the Booking form preview. Switch Preview to Booking form to inspect it.', 'booking' ),
			),
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_settings_themes_enqueue_js_files', 66 );

/**
 * Print tooltip initializer for Appearance / Theme.
 *
 * @return void
 */
function wpbc_settings_themes_print_tooltip_js() {

	if ( ! wpbc_settings_themes__is_page() ) {
		return;
	}

	if ( function_exists( 'wpbc_bs_javascript_tooltips' ) ) {
		wpbc_bs_javascript_tooltips();
	}
}
add_action( 'admin_footer', 'wpbc_settings_themes_print_tooltip_js', 67 );

/**
 * Get day-selection settings in the same normalized shape used by calendar boot code.
 *
 * @return array
 */
function wpbc_settings_themes__get_days_selection_response() {

	$days_selection = array(
		'days_select_mode'          => 'multiple',
		'fixed__days_num'           => 0,
		'fixed__week_days__start'   => '-1',
		'dynamic__days_min'         => 0,
		'dynamic__days_max'         => 0,
		'dynamic__days_specific'    => '',
		'dynamic__week_days__start' => '-1',
	);

	if ( function_exists( 'wpbc__calendar__js_params__get_days_selection_arr' ) ) {
		$days_selection = wp_parse_args( wpbc__calendar__js_params__get_days_selection_arr(), $days_selection );
	}

	return array(
		'days_select_mode'          => (string) $days_selection['days_select_mode'],
		'fixed__days_num'           => (int) $days_selection['fixed__days_num'],
		'fixed__week_days__start'   => (string) $days_selection['fixed__week_days__start'],
		'dynamic__days_min'         => (int) $days_selection['dynamic__days_min'],
		'dynamic__days_max'         => (int) $days_selection['dynamic__days_max'],
		'dynamic__days_specific'    => (string) $days_selection['dynamic__days_specific'],
		'dynamic__week_days__start' => (string) $days_selection['dynamic__week_days__start'],
	);
}

/**
 * Get resource options.
 *
 * @return array
 */
function wpbc_settings_themes__get_resources() {

	if ( function_exists( 'wpbc_availability_general__get_resources' ) ) {
		return wpbc_availability_general__get_resources();
	}

	$resources = array();

	if ( function_exists( 'wpbc_ajx_get_sorted_booking_resources_arr' ) && function_exists( 'wpbc_ajx_get_all_booking_resources_arr' ) ) {
		$resource_rows = wpbc_ajx_get_sorted_booking_resources_arr( wpbc_ajx_get_all_booking_resources_arr() );
		foreach ( $resource_rows as $resource ) {
			$resources[] = array(
				'id'    => isset( $resource['booking_type_id'] ) ? (int) $resource['booking_type_id'] : 1,
				'title' => isset( $resource['title'] ) ? $resource['title'] : __( 'Booking resource', 'booking' ),
			);
		}
	}

	if ( empty( $resources ) ) {
		$resources[] = array(
			'id'    => function_exists( 'wpbc_get_default_resource' ) ? (int) wpbc_get_default_resource() : 1,
			'title' => __( 'Booking resource', 'booking' ),
		);
	}

	return $resources;
}

/**
 * Get capability required to manage Appearance / Theme.
 *
 * @return string
 */
function wpbc_settings_themes__get_manage_cap() {

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
 * Check if a Theme Settings upsell row is visible for current user.
 *
 * @param string $dismiss_id Dismiss ID.
 *
 * @return bool
 */
function wpbc_settings_themes__is_dismissed_visible( $dismiss_id ) {

	if ( wpbc_is_this_demo() ) {
		return true;
	}

	return ! function_exists( 'wpbc_is_dismissed_panel_visible' ) || wpbc_is_dismissed_panel_visible( $dismiss_id );
}

/**
 * Get dismiss ID for Theme Settings premium option.
 *
 * @param string $option_name Option name.
 *
 * @return string
 */
function wpbc_settings_themes__get_premium_option_dismiss_id( $option_name ) {

	return 'wpbc_is_dismissed__theme_settings__' . sanitize_key( $option_name );
}

/**
 * Render compact dismiss button for Theme Settings premium hints.
 *
 * @param string $dismiss_id Dismiss ID.
 *
 * @return void
 */
function wpbc_settings_themes__render_dismiss_button( $dismiss_id ) {

	if ( wpbc_is_this_demo() || ! function_exists( 'wpbc_is_dismissed' ) ) {
		return;
	}

	?>
	<span class="wpbc_theme_premium_dismiss">
		<?php
		wpbc_is_dismissed(
			$dismiss_id,
			array(
				'title' => '&times;',
				'hint'  => __( 'Hide this option', 'booking' ),
				'css'   => 'float:none;margin-left:4px;',
			)
		);
		?>
	</span>
	<?php
}

/**
 * Sanitize preview resource ID.
 *
 * @param int $resource_id Resource ID.
 *
 * @return int
 */
function wpbc_settings_themes__sanitize_preview_resource_id( $resource_id ) {

	$resource_id = absint( $resource_id );
	$resources   = wpbc_settings_themes__get_resources();
	$allowed     = array();

	foreach ( $resources as $resource ) {
		$allowed[] = (int) $resource['id'];
	}

	if ( in_array( $resource_id, $allowed, true ) ) {
		return $resource_id;
	}

	return ! empty( $allowed ) ? (int) $allowed[0] : 1;
}

/**
 * Sanitize preview months count.
 *
 * @param int $months_count Months count.
 *
 * @return int
 */
function wpbc_settings_themes__sanitize_preview_months_count( $months_count ) {

	$months_count = absint( $months_count );
	$allowed      = array( 1, 2, 3, 4, 6, 12 );

	return in_array( $months_count, $allowed, true ) ? $months_count : 1;
}

/**
 * Get preview resource from request or default.
 *
 * @return int
 */
function wpbc_settings_themes__get_preview_resource_id() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$resource_id = isset( $_REQUEST['resource_id'] ) ? absint( wp_unslash( $_REQUEST['resource_id'] ) ) : ( function_exists( 'wpbc_get_default_resource' ) ? (int) wpbc_get_default_resource() : 1 );

	return wpbc_settings_themes__sanitize_preview_resource_id( $resource_id );
}

/**
 * Get preview months count from request or default.
 *
 * @return int
 */
function wpbc_settings_themes__get_preview_months_count() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$months_count = isset( $_REQUEST['months_count'] ) ? absint( wp_unslash( $_REQUEST['months_count'] ) ) : 1;

	return wpbc_settings_themes__sanitize_preview_months_count( $months_count );
}

/**
 * Get preview mode options.
 *
 * @return array
 */
function wpbc_settings_themes__get_preview_mode_options() {

	return array(
		'calendar' => __( 'Calendar only', 'booking' ),
		'form'     => __( 'Booking form', 'booking' ),
	);
}

/**
 * Sanitize preview mode.
 *
 * @param string $preview_mode Preview mode.
 *
 * @return string
 */
function wpbc_settings_themes__sanitize_preview_mode( $preview_mode ) {

	$preview_mode = sanitize_key( (string) $preview_mode );

	return array_key_exists( $preview_mode, wpbc_settings_themes__get_preview_mode_options() ) ? $preview_mode : 'calendar';
}

/**
 * Get preview mode from request.
 *
 * @return string
 */
function wpbc_settings_themes__get_preview_mode() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$preview_mode = isset( $_REQUEST['preview_mode'] ) ? sanitize_key( wp_unslash( $_REQUEST['preview_mode'] ) ) : 'calendar';

	return wpbc_settings_themes__sanitize_preview_mode( $preview_mode );
}

/**
 * Get booking form options for preview.
 *
 * @return array
 */
function wpbc_settings_themes__get_booking_form_options() {

	$form_options = array(
		'standard' => __( 'Standard booking form', 'booking' ),
	);

	if ( class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
		$owner_user_id = method_exists( 'WPBC_FE_Custom_Form_Helper', 'wpbc_mu__get_current__owner_user_id' ) ? WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id() : 0;
		$forms_list    = WPBC_FE_Custom_Form_Helper::get_custom_booking_forms_list(
			array(
				'include_standard' => true,
				'owner_user_id'    => $owner_user_id,
				'statuses'         => array( 'published' ),
				'list_mode'        => 'auto',
			)
		);

		if ( is_array( $forms_list ) ) {
			foreach ( $forms_list as $form_slug => $form_data ) {
				$form_slug = sanitize_text_field( (string) $form_slug );
				if ( '' === $form_slug ) {
					continue;
				}
				$form_options[ $form_slug ] = isset( $form_data['title'] ) ? sanitize_text_field( (string) $form_data['title'] ) : $form_slug;
			}
		}
	}

	return $form_options;
}

/**
 * Sanitize custom booking form.
 *
 * @param string $custom_booking_form Custom booking form slug.
 *
 * @return string
 */
function wpbc_settings_themes__sanitize_custom_booking_form( $custom_booking_form ) {

	$custom_booking_form = sanitize_text_field( (string) $custom_booking_form );
	$form_options        = wpbc_settings_themes__get_booking_form_options();

	return array_key_exists( $custom_booking_form, $form_options ) ? $custom_booking_form : 'standard';
}

/**
 * Get custom booking form from request.
 *
 * @return string
 */
function wpbc_settings_themes__get_custom_booking_form() {

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$custom_booking_form = isset( $_REQUEST['custom_booking_form'] ) ? sanitize_text_field( wp_unslash( $_REQUEST['custom_booking_form'] ) ) : 'standard';

	return wpbc_settings_themes__sanitize_custom_booking_form( $custom_booking_form );
}

/**
 * Get form theme options.
 *
 * @return array
 */
function wpbc_settings_themes__get_form_theme_options() {

	return array(
		''                  => __( 'Light', 'booking' ),
		'wpbc_theme_dark_1' => __( 'Dark', 'booking' ),
	);
}

/**
 * Get booking form container preset options.
 *
 * @return array
 */
function wpbc_settings_themes__get_form_appearance_preset_options() {

	return array(
		'bordered' => __( 'Bordered', 'booking' ),
		'none'     => __( 'No border', 'booking' ),
		'soft'     => __( 'Soft background', 'booking' ),
		'custom'   => __( 'Custom per form', 'booking' ),
	);
}

/**
 * Get combined booking form style choices for the visual selector.
 *
 * @return array
 */
function wpbc_settings_themes__get_form_style_options() {

	return wpbc_bfb_settings__get_form_style_options();
}

/**
 * Resolve the combined visual form style value from saved settings.
 *
 * @param string $theme  Form theme option.
 * @param string $preset Form appearance preset option.
 *
 * @return string
 */
function wpbc_settings_themes__get_form_style_value( $theme, $preset ) {

	$theme  = ( 'wpbc_theme_dark_1' === (string) $theme ) ? 'dark' : 'light';
	$preset = (string) $preset;

	if ( 'custom' === $preset ) {
		return 'custom';
	}
	if ( ! in_array( $preset, array( 'bordered', 'none', 'soft' ), true ) ) {
		$preset = 'bordered';
	}

	return $theme . '_' . $preset;
}

/**
 * Map the combined visual form style value to existing saved options.
 *
 * @param string $style         Combined style value.
 * @param string $current_theme Current theme fallback.
 *
 * @return array
 */
function wpbc_settings_themes__map_form_style_to_options( $style, $current_theme = '' ) {

	$style         = sanitize_key( (string) $style );
	$current_theme = ( 'wpbc_theme_dark_1' === (string) $current_theme ) ? 'wpbc_theme_dark_1' : '';

	if ( 'custom' === $style ) {
		return array(
			'booking_form_theme'             => $current_theme,
			'booking_form_appearance_preset' => 'custom',
		);
	}

	$parts  = explode( '_', $style );
	$theme  = ( isset( $parts[0] ) && 'dark' === $parts[0] ) ? 'wpbc_theme_dark_1' : '';
	$preset = isset( $parts[1] ) ? (string) $parts[1] : 'bordered';
	$preset = in_array( $preset, array( 'bordered', 'none', 'soft' ), true ) ? $preset : 'bordered';

	return array(
		'booking_form_theme'             => $theme,
		'booking_form_appearance_preset' => $preset,
	);
}

/**
 * Get time picker skin options.
 *
 * @return array
 */
function wpbc_settings_themes__get_time_picker_skin_options() {

	$timeslot_picker_skins_options = array();
	$upload_dir                    = wp_upload_dir();

	if ( function_exists( 'wpbc_dir_list' ) ) {
		$files_in_folder = wpbc_dir_list(
			array(
				WPBC_PLUGIN_DIR . '/css/time_picker_skins/',
				$upload_dir['basedir'] . '/wpbc_time_picker_skins/',
			)
		);

		foreach ( $files_in_folder as $skin_file ) {
			$skin_file[1] = str_replace( array( WPBC_PLUGIN_DIR, WPBC_PLUGIN_URL, $upload_dir['basedir'] ), '', $skin_file[1] );
			$timeslot_picker_skins_options[ $skin_file[1] ] = $skin_file[2];
		}
	}

	if ( empty( $timeslot_picker_skins_options ) ) {
		$default_options_values = wpbc_get_default_options();
		$default_skin           = isset( $default_options_values['booking_timeslot_picker_skin'] ) ? $default_options_values['booking_timeslot_picker_skin'] : '/css/time_picker_skins/grey.css';
		$timeslot_picker_skins_options[ $default_skin ] = __( 'Default', 'booking' );
	}

	return $timeslot_picker_skins_options;
}

/**
 * Normalize calendar skin option value to a relative path.
 *
 * @param string $skin_value Calendar skin value.
 *
 * @return string
 */
function wpbc_settings_themes__normalize_calendar_skin_value( $skin_value ) {

	$skin_value = (string) $skin_value;
	$upload_dir = wp_upload_dir();
	$upload_url = ( ! empty( $upload_dir['baseurl'] ) ) ? $upload_dir['baseurl'] : '';

	return str_replace(
		array(
			WPBC_PLUGIN_URL,
			$upload_url,
		),
		'',
		$skin_value
	);
}

/**
 * Get URL for a relative calendar skin path.
 *
 * @param string $relative_skin Relative skin path.
 *
 * @return string
 */
function wpbc_settings_themes__get_calendar_skin_url( $relative_skin ) {

	$relative_skin = wpbc_settings_themes__normalize_calendar_skin_value( $relative_skin );
	$upload_dir    = wp_upload_dir();
	$upload_url    = ( ! empty( $upload_dir['baseurl'] ) ) ? $upload_dir['baseurl'] : '';

	if ( 0 === strpos( $relative_skin, '/wpbc_skins/' ) && ! empty( $upload_url ) ) {
		return $upload_url . $relative_skin;
	}

	return WPBC_PLUGIN_URL . $relative_skin;
}

/**
 * Build calendar skin options for selectbox with live-preview URL metadata.
 *
 * @return array
 */
function wpbc_settings_themes__get_calendar_skin_options_for_select() {

	$options = function_exists( 'wpbc_get_calendar_skin_options' ) ? wpbc_get_calendar_skin_options() : array();

	foreach ( $options as $option_value => $option_label ) {
		if ( is_array( $option_label ) && ! empty( $option_label['optgroup'] ) ) {
			continue;
		}

		$relative_skin = wpbc_settings_themes__normalize_calendar_skin_value( $option_value );
		$skin_url      = wpbc_settings_themes__get_calendar_skin_url( $relative_skin );

		if ( is_array( $option_label ) ) {
			$option_label['attr'] = ( isset( $option_label['attr'] ) && is_array( $option_label['attr'] ) ) ? $option_label['attr'] : array();
			$option_label['attr']['data-wpbc-calendar-skin-url'] = $skin_url;
			$options[ $relative_skin ] = $option_label;
		} else {
			$options[ $relative_skin ] = array(
				'title' => $option_label,
				'attr'  => array(
					'data-wpbc-calendar-skin-url' => $skin_url,
				),
			);
		}

		if ( $relative_skin !== $option_value ) {
			unset( $options[ $option_value ] );
		}
	}

	return $options;
}

/**
 * Get current settings prepared for JavaScript and AJAX responses.
 *
 * @return array
 */
function wpbc_settings_themes__get_settings_response() {

	$form_style        = wpbc_bfb_settings__get_current_form_style();
	$transition_values = wpbc_settings_themes__map_form_style_to_options( $form_style, '' );
	$custom_values     = wpbc_bfb_settings__get_custom_form_style_options();

	return array_merge(
		array(
			'booking_form_style'                 => $form_style,
			'booking_form_theme'                 => $transition_values['booking_form_theme'],
			'booking_form_appearance_preset'     => $transition_values['booking_form_appearance_preset'],
			'booking_form_appearance_background_color' => get_bk_option( 'booking_form_appearance_background_color' ) ? get_bk_option( 'booking_form_appearance_background_color' ) : '#ffffff',
			'booking_form_appearance_border_color' => get_bk_option( 'booking_form_appearance_border_color' ) ? get_bk_option( 'booking_form_appearance_border_color' ) : '#cccccc',
			'booking_form_appearance_border_width' => get_bk_option( 'booking_form_appearance_border_width' ) ? get_bk_option( 'booking_form_appearance_border_width' ) : '1px',
			'booking_form_appearance_border_radius' => get_bk_option( 'booking_form_appearance_border_radius' ) ? get_bk_option( 'booking_form_appearance_border_radius' ) : '2px',
			'booking_form_appearance_padding'    => get_bk_option( 'booking_form_appearance_padding' ) ? get_bk_option( 'booking_form_appearance_padding' ) : '10px 30px',
		'booking_skin'                         => wpbc_settings_themes__normalize_calendar_skin_value( get_bk_option( 'booking_skin' ) ),
		'booking_timeslot_picker_skin'         => get_bk_option( 'booking_timeslot_picker_skin' ),
		'booking_timeslot_picker'              => get_bk_option( 'booking_timeslot_picker' ),
		),
		$custom_values
	);
}

/**
 * Override option values while rendering the live Appearance / Theme preview.
 *
 * @param mixed  $value   Current filter value.
 * @param string $option  Option name.
 * @param mixed  $default Default option value.
 *
 * @return mixed
 */
function wpbc_settings_themes__preview_get_bk_option( $value, $option, $default ) {

	global $wpbc_settings_themes__preview_options;

	if (
		is_array( $wpbc_settings_themes__preview_options )
		&& array_key_exists( $option, $wpbc_settings_themes__preview_options )
	) {
		return $wpbc_settings_themes__preview_options[ $option ];
	}

	return $value;
}
add_bk_filter( 'wpdev_bk_get_option', 'wpbc_settings_themes__preview_get_bk_option' );

/**
 * Prepare option overrides for the live preview renderer.
 *
 * @param array $current_settings Current preview settings.
 *
 * @return array
 */
function wpbc_settings_themes__get_preview_option_overrides( $current_settings ) {

	$option_names = array(
		'booking_form_style',
		'booking_form_custom_background_color',
		'booking_form_custom_border_color',
		'booking_form_custom_border_width',
		'booking_form_custom_border_radius',
		'booking_form_custom_padding_vertical',
		'booking_form_custom_padding_horizontal',
		'booking_form_custom_text_color',
		'booking_form_custom_field_background_color',
		'booking_form_custom_field_text_color',
		'booking_form_custom_field_border_color',
		'booking_form_custom_button_background_color',
		'booking_form_custom_button_text_color',
		'booking_form_custom_button_border_color',
		'booking_form_custom_button_hover_background_color',
		'booking_form_custom_button_hover_text_color',
		'booking_form_custom_button_hover_border_color',
		'booking_form_custom_secondary_button_background_color',
		'booking_form_custom_secondary_button_text_color',
		'booking_form_custom_secondary_button_border_color',
		'booking_form_custom_secondary_button_hover_background_color',
		'booking_form_custom_secondary_button_hover_text_color',
		'booking_form_custom_secondary_button_hover_border_color',
		'booking_skin',
		'booking_timeslot_picker_skin',
		'booking_timeslot_picker',
	);
	$overrides    = array();

	foreach ( $option_names as $option_name ) {
		if ( array_key_exists( $option_name, $current_settings ) ) {
			$overrides[ $option_name ] = $current_settings[ $option_name ];
		}
	}

	if ( isset( $overrides['booking_form_style'] ) ) {
		$style             = wpbc_bfb_settings__sanitize_form_style( $overrides['booking_form_style'] );
		$preset            = wpbc_bfb_settings__get_form_style_preset( $style );
		$legacy_theme      = isset( $preset['theme_class'] ) ? sanitize_html_class( (string) $preset['theme_class'] ) : '';
		$legacy_container  = isset( $preset['container_style'] ) ? sanitize_key( (string) $preset['container_style'] ) : 'bordered';
		$legacy_container  = in_array( $legacy_container, array( 'bordered', 'none', 'soft', 'custom' ), true ) ? $legacy_container : 'bordered';

		$overrides['booking_form_theme']             = $legacy_theme;
		$overrides['booking_form_appearance_preset'] = $legacy_container;
	}

	return $overrides;
}

/**
 * Validate posted Appearance / Theme settings.
 *
 * @param array $post_data Raw post data.
 *
 * @return array
 */
function wpbc_settings_themes__validate_data( $post_data ) {

	$default_options_values = wpbc_get_default_options();
	$calendar_skin_options  = wpbc_settings_themes__get_calendar_skin_options_for_select();
	$time_skin_options      = wpbc_settings_themes__get_time_picker_skin_options();
	$custom_values          = wpbc_bfb_settings__get_custom_form_style_options();

	$cleaned = array_merge(
		array(
			'booking_form_style'                 => isset( $default_options_values['booking_form_style'] ) ? wpbc_bfb_settings__sanitize_form_style( $default_options_values['booking_form_style'] ) : wpbc_bfb_settings__get_default_form_style(),
		'booking_skin'                         => isset( $default_options_values['booking_skin'] ) ? $default_options_values['booking_skin'] : '',
		'booking_timeslot_picker_skin'         => isset( $default_options_values['booking_timeslot_picker_skin'] ) ? $default_options_values['booking_timeslot_picker_skin'] : '',
		'booking_timeslot_picker'              => isset( $default_options_values['booking_timeslot_picker'] ) ? $default_options_values['booking_timeslot_picker'] : 'Off',
		),
		$custom_values
	);

	if ( isset( $post_data['booking_form_style'] ) ) {
		$cleaned['booking_form_style'] = wpbc_bfb_settings__sanitize_form_style( wp_unslash( $post_data['booking_form_style'] ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	}

	$sanitize_color = function ( $value, $fallback ) {
		$value = trim( sanitize_text_field( wp_unslash( $value ) ) );
		if ( preg_match( '/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i', $value ) || 'transparent' === $value ) {
			return $value;
		}
		return $fallback;
	};
	$sanitize_length = function ( $value, $fallback ) {
		$value = trim( sanitize_text_field( wp_unslash( $value ) ) );
		if ( preg_match( '/^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i', $value ) ) {
			return $value;
		}
		return $fallback;
	};
	$sanitize_spacing = function ( $value, $fallback ) {
		$value = preg_replace( '/\s+/', ' ', trim( sanitize_text_field( wp_unslash( $value ) ) ) );
		if ( '' === $value ) {
			return $fallback;
		}
		$parts = explode( ' ', $value );
		if ( count( $parts ) < 1 || count( $parts ) > 4 ) {
			return $fallback;
		}
		foreach ( $parts as $part ) {
			if ( ! preg_match( '/^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i', $part ) ) {
				return $fallback;
			}
		}
		return implode( ' ', $parts );
	};

	if ( 'custom' === $cleaned['booking_form_style'] ) {
		if ( isset( $post_data['booking_form_custom_background_color'] ) ) {
			$cleaned['booking_form_custom_background_color'] = $sanitize_color( $post_data['booking_form_custom_background_color'], '#ffffff' );
		}
		if ( isset( $post_data['booking_form_custom_border_color'] ) ) {
			$cleaned['booking_form_custom_border_color'] = $sanitize_color( $post_data['booking_form_custom_border_color'], '#cccccc' );
		}
		if ( isset( $post_data['booking_form_custom_border_width'] ) ) {
			$cleaned['booking_form_custom_border_width'] = $sanitize_length( $post_data['booking_form_custom_border_width'], '1px' );
		}
		if ( isset( $post_data['booking_form_custom_border_radius'] ) ) {
			$cleaned['booking_form_custom_border_radius'] = $sanitize_length( $post_data['booking_form_custom_border_radius'], '2px' );
		}
		if ( isset( $post_data['booking_form_custom_padding_vertical'] ) ) {
			$cleaned['booking_form_custom_padding_vertical'] = $sanitize_length( $post_data['booking_form_custom_padding_vertical'], '10px' );
		}
		if ( isset( $post_data['booking_form_custom_padding_horizontal'] ) ) {
			$cleaned['booking_form_custom_padding_horizontal'] = $sanitize_length( $post_data['booking_form_custom_padding_horizontal'], '30px' );
		}
		if ( isset( $post_data['booking_form_custom_text_color'] ) ) {
			$cleaned['booking_form_custom_text_color'] = $sanitize_color( $post_data['booking_form_custom_text_color'], '#1d2327' );
		}
		if ( isset( $post_data['booking_form_custom_field_background_color'] ) ) {
			$cleaned['booking_form_custom_field_background_color'] = $sanitize_color( $post_data['booking_form_custom_field_background_color'], '#ffffff' );
		}
		if ( isset( $post_data['booking_form_custom_field_text_color'] ) ) {
			$cleaned['booking_form_custom_field_text_color'] = $sanitize_color( $post_data['booking_form_custom_field_text_color'], '#3c434a' );
		}
		if ( isset( $post_data['booking_form_custom_field_border_color'] ) ) {
			$cleaned['booking_form_custom_field_border_color'] = $sanitize_color( $post_data['booking_form_custom_field_border_color'], '#cccccc' );
		}
		if ( isset( $post_data['booking_form_custom_button_background_color'] ) ) {
			$cleaned['booking_form_custom_button_background_color'] = $sanitize_color( $post_data['booking_form_custom_button_background_color'], '#066aab' );
		}
		if ( isset( $post_data['booking_form_custom_button_text_color'] ) ) {
			$cleaned['booking_form_custom_button_text_color'] = $sanitize_color( $post_data['booking_form_custom_button_text_color'], '#ffffff' );
		}
		if ( isset( $post_data['booking_form_custom_button_border_color'] ) ) {
			$cleaned['booking_form_custom_button_border_color'] = $sanitize_color( $post_data['booking_form_custom_button_border_color'], '#066aab' );
		}
		if ( isset( $post_data['booking_form_custom_button_hover_background_color'] ) ) {
			$cleaned['booking_form_custom_button_hover_background_color'] = $sanitize_color( $post_data['booking_form_custom_button_hover_background_color'], '#055589' );
		}
		if ( isset( $post_data['booking_form_custom_button_hover_text_color'] ) ) {
			$cleaned['booking_form_custom_button_hover_text_color'] = $sanitize_color( $post_data['booking_form_custom_button_hover_text_color'], '#ffffff' );
		}
		if ( isset( $post_data['booking_form_custom_button_hover_border_color'] ) ) {
			$cleaned['booking_form_custom_button_hover_border_color'] = $sanitize_color( $post_data['booking_form_custom_button_hover_border_color'], '#055589' );
		}
		if ( isset( $post_data['booking_form_custom_secondary_button_background_color'] ) ) {
			$cleaned['booking_form_custom_secondary_button_background_color'] = $sanitize_color( $post_data['booking_form_custom_secondary_button_background_color'], '#fdfdfd' );
		}
		if ( isset( $post_data['booking_form_custom_secondary_button_text_color'] ) ) {
			$cleaned['booking_form_custom_secondary_button_text_color'] = $sanitize_color( $post_data['booking_form_custom_secondary_button_text_color'], '#444444' );
		}
		if ( isset( $post_data['booking_form_custom_secondary_button_border_color'] ) ) {
			$cleaned['booking_form_custom_secondary_button_border_color'] = $sanitize_color( $post_data['booking_form_custom_secondary_button_border_color'], '#eeeeee' );
		}
		if ( isset( $post_data['booking_form_custom_secondary_button_hover_background_color'] ) ) {
			$cleaned['booking_form_custom_secondary_button_hover_background_color'] = $sanitize_color( $post_data['booking_form_custom_secondary_button_hover_background_color'], '#fdfdfd' );
		}
		if ( isset( $post_data['booking_form_custom_secondary_button_hover_text_color'] ) ) {
			$cleaned['booking_form_custom_secondary_button_hover_text_color'] = $sanitize_color( $post_data['booking_form_custom_secondary_button_hover_text_color'], '#444444' );
		}
		if ( isset( $post_data['booking_form_custom_secondary_button_hover_border_color'] ) ) {
			$cleaned['booking_form_custom_secondary_button_hover_border_color'] = $sanitize_color( $post_data['booking_form_custom_secondary_button_hover_border_color'], '#4d91cd' );
		}
	}

	if ( isset( $post_data['booking_skin'] ) ) {
		$value = wpbc_settings_themes__normalize_calendar_skin_value( sanitize_text_field( wp_unslash( $post_data['booking_skin'] ) ) );
		if ( array_key_exists( $value, $calendar_skin_options ) ) {
			$cleaned['booking_skin'] = $value;
		}
	}

	if ( isset( $post_data['booking_timeslot_picker_skin'] ) ) {
		$value = sanitize_text_field( wp_unslash( $post_data['booking_timeslot_picker_skin'] ) );
		if ( array_key_exists( $value, $time_skin_options ) ) {
			$cleaned['booking_timeslot_picker_skin'] = $value;
		}
	}

	$timeslot_picker_value = isset( $post_data['booking_timeslot_picker'] ) ? sanitize_text_field( wp_unslash( $post_data['booking_timeslot_picker'] ) ) : '';

	$cleaned['booking_timeslot_picker'] = ( 'On' === $timeslot_picker_value ) ? 'On' : 'Off';

	return $cleaned;
}

/**
 * Update Appearance / Theme settings.
 *
 * @param array $cleaned_data Cleaned settings.
 *
 * @return void
 */
function wpbc_settings_themes__update_settings( $cleaned_data ) {

	update_bk_option( 'booking_form_style', $cleaned_data['booking_form_style'] );
	update_bk_option( 'booking_form_custom_background_color', $cleaned_data['booking_form_custom_background_color'] );
	update_bk_option( 'booking_form_custom_border_color', $cleaned_data['booking_form_custom_border_color'] );
	update_bk_option( 'booking_form_custom_border_width', $cleaned_data['booking_form_custom_border_width'] );
	update_bk_option( 'booking_form_custom_border_radius', $cleaned_data['booking_form_custom_border_radius'] );
	update_bk_option( 'booking_form_custom_padding_vertical', $cleaned_data['booking_form_custom_padding_vertical'] );
	update_bk_option( 'booking_form_custom_padding_horizontal', $cleaned_data['booking_form_custom_padding_horizontal'] );
	update_bk_option( 'booking_form_custom_text_color', $cleaned_data['booking_form_custom_text_color'] );
	update_bk_option( 'booking_form_custom_field_background_color', $cleaned_data['booking_form_custom_field_background_color'] );
	update_bk_option( 'booking_form_custom_field_text_color', $cleaned_data['booking_form_custom_field_text_color'] );
	update_bk_option( 'booking_form_custom_field_border_color', $cleaned_data['booking_form_custom_field_border_color'] );
	update_bk_option( 'booking_form_custom_button_background_color', $cleaned_data['booking_form_custom_button_background_color'] );
	update_bk_option( 'booking_form_custom_button_text_color', $cleaned_data['booking_form_custom_button_text_color'] );
	update_bk_option( 'booking_form_custom_button_border_color', $cleaned_data['booking_form_custom_button_border_color'] );
	update_bk_option( 'booking_form_custom_button_hover_background_color', $cleaned_data['booking_form_custom_button_hover_background_color'] );
	update_bk_option( 'booking_form_custom_button_hover_text_color', $cleaned_data['booking_form_custom_button_hover_text_color'] );
	update_bk_option( 'booking_form_custom_button_hover_border_color', $cleaned_data['booking_form_custom_button_hover_border_color'] );
	update_bk_option( 'booking_form_custom_secondary_button_background_color', $cleaned_data['booking_form_custom_secondary_button_background_color'] );
	update_bk_option( 'booking_form_custom_secondary_button_text_color', $cleaned_data['booking_form_custom_secondary_button_text_color'] );
	update_bk_option( 'booking_form_custom_secondary_button_border_color', $cleaned_data['booking_form_custom_secondary_button_border_color'] );
	update_bk_option( 'booking_form_custom_secondary_button_hover_background_color', $cleaned_data['booking_form_custom_secondary_button_hover_background_color'] );
	update_bk_option( 'booking_form_custom_secondary_button_hover_text_color', $cleaned_data['booking_form_custom_secondary_button_hover_text_color'] );
	update_bk_option( 'booking_form_custom_secondary_button_hover_border_color', $cleaned_data['booking_form_custom_secondary_button_hover_border_color'] );
	update_bk_option( 'booking_skin', $cleaned_data['booking_skin'] );
	update_bk_option( 'booking_timeslot_picker_skin', $cleaned_data['booking_timeslot_picker_skin'] );
	update_bk_option( 'booking_timeslot_picker', $cleaned_data['booking_timeslot_picker'] );
}

/**
 * Render select field.
 *
 * @param string $name     Field name.
 * @param array  $options  Options.
 * @param string $selected Selected value.
 * @param array  $args     Extra args.
 *
 * @return void
 */
function wpbc_settings_themes__render_select( $name, $options, $selected, $args = array() ) {

	$args = wp_parse_args(
		$args,
		array(
			'id'         => $name,
			'class'      => '',
			'data_attrs' => array(),
		)
	);

	$data_attrs = '';
	foreach ( $args['data_attrs'] as $attr_name => $attr_value ) {
		$data_attrs .= ' ' . esc_attr( $attr_name ) . '="' . esc_attr( $attr_value ) . '"';
	}
	?>
	<select id="<?php echo esc_attr( $args['id'] ); ?>" name="<?php echo esc_attr( $name ); ?>" class="<?php echo esc_attr( $args['class'] ); ?>"<?php echo $data_attrs; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
		<?php
		foreach ( $options as $option_value => $option_data ) :
			if ( ! is_array( $option_data ) ) {
				$option_data = array( 'title' => $option_data );
			}

			$option_data = wp_parse_args(
				$option_data,
				array(
					'title'    => '',
					'style'    => '',
					'class'    => '',
					'disabled' => false,
					'selected' => false,
					'attr'     => array(),
					'optgroup' => false,
					'close'    => false,
				)
			);

			if ( ! empty( $option_data['optgroup'] ) ) :
				if ( empty( $option_data['close'] ) ) :
					?>
					<optgroup label="<?php echo esc_attr( $option_data['title'] ); ?>">
					<?php
				else :
					?>
					</optgroup>
					<?php
				endif;
				continue;
			endif;

			$option_attrs = '';
			if ( ! empty( $option_data['attr'] ) && is_array( $option_data['attr'] ) ) {
				foreach ( $option_data['attr'] as $attr_name => $attr_value ) {
					$option_attrs .= ' ' . esc_attr( $attr_name ) . '="' . esc_attr( $attr_value ) . '"';
				}
			}
			?>
			<option
				value="<?php echo esc_attr( $option_value ); ?>"
				<?php selected( (string) $selected, (string) $option_value ); ?>
				<?php selected( ! empty( $option_data['selected'] ), true ); ?>
				<?php disabled( ! empty( $option_data['disabled'] ), true ); ?>
				<?php echo ( '' !== $option_data['class'] ) ? ' class="' . esc_attr( $option_data['class'] ) . '"' : ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<?php echo ( '' !== $option_data['style'] ) ? ' style="' . esc_attr( $option_data['style'] ) . '"' : ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				<?php echo $option_attrs; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			><?php echo wp_kses_post( html_entity_decode( (string) $option_data['title'], ENT_QUOTES, get_bloginfo( 'charset' ) ) ); ?></option>
			<?php
		endforeach;
		?>
	</select>
	<?php
}

/**
 * Render booking resource calendar preview.
 *
 * @param int   $resource_id      Resource ID.
 * @param int   $months_count     Number of months.
 * @param array $preview_settings Optional settings.
 *
 * @return void
 */
function wpbc_settings_themes__render_calendar_preview( $resource_id, $months_count, $preview_settings = array(), $preview_mode = 'calendar', $custom_booking_form = 'standard' ) {

	global $wpbc_settings_themes__preview_options;

	$resource_id              = wpbc_settings_themes__sanitize_preview_resource_id( $resource_id );
	$months_count             = wpbc_settings_themes__sanitize_preview_months_count( $months_count );
	$current_settings         = wp_parse_args( $preview_settings, wpbc_settings_themes__get_settings_response() );
	$form_style               = isset( $current_settings['booking_form_style'] ) ? wpbc_bfb_settings__sanitize_form_style( $current_settings['booking_form_style'] ) : wpbc_bfb_settings__get_default_form_style();
	$form_style_preset        = wpbc_bfb_settings__get_form_style_preset( $form_style );
	$form_theme               = isset( $form_style_preset['theme_class'] ) ? sanitize_html_class( (string) $form_style_preset['theme_class'] ) : '';
	$preview_mode             = wpbc_settings_themes__sanitize_preview_mode( $preview_mode );
	$custom_booking_form      = wpbc_settings_themes__sanitize_custom_booking_form( $custom_booking_form );
	$previous_preview_options = isset( $wpbc_settings_themes__preview_options ) ? $wpbc_settings_themes__preview_options : null;
	$wpbc_settings_themes__preview_options = wpbc_settings_themes__get_preview_option_overrides( $current_settings );
	?>
	<div class="wpbc_theme_preview <?php echo esc_attr( $form_theme ); ?> wpbc_theme_preview_mode_<?php echo esc_attr( $preview_mode ); ?>" data-wpbc-admin-calendar-preview="1" data-wpbc-theme-preview="1" data-resource-id="<?php echo esc_attr( $resource_id ); ?>" data-months-count="<?php echo esc_attr( $months_count ); ?>" data-preview-mode="<?php echo esc_attr( $preview_mode ); ?>" data-custom-booking-form="<?php echo esc_attr( $custom_booking_form ); ?>">
		<div class="wpbc_theme_real_preview" data-wpbc-theme-calendar-panel="1">
			<?php
			if ( class_exists( 'WPBC_FE_Render' ) ) {
				if ( 'form' === $preview_mode ) {
					WPBC_FE_Render::render_booking_form(
						array(
							'resource_id'         => $resource_id,
							'cal_count'           => $months_count,
							'is_echo'             => 1,
							'custom_booking_form' => $custom_booking_form,
						)
					);
				} else {
					WPBC_FE_Render::render_calendar_only(
						array(
							'resource_id' => $resource_id,
							'cal_count'   => $months_count,
							'is_echo'     => 1,
						)
					);
				}
			} elseif ( function_exists( 'wpbc__calendar__load' ) ) {
				echo wpbc__calendar__load( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
					array(
						'resource_id'                     => $resource_id,
						'aggregate_resource_id_arr'       => array(),
						'selected_dates_without_calendar' => '',
						'calendar_number_of_months'       => $months_count,
						'start_month_calendar'            => false,
						'shortcode_options'               => '',
						'custom_form'                     => $custom_booking_form,
						'skip_general_availability'       => 1,
					)
				);
			}
			?>
		</div>
	</div>
	<?php

	if ( null === $previous_preview_options ) {
		unset( $wpbc_settings_themes__preview_options );
	} else {
		$wpbc_settings_themes__preview_options = $previous_preview_options;
	}
}

/**
 * Show Appearance / Theme save button in top toolbar.
 *
 * @param string $page_tag Current page tag.
 * @param string $active_page_tab Current tab.
 * @param string $active_page_subtab Current subtab.
 *
 * @return void
 */
function wpbc_settings_themes__top_toolbar__show_save_button( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'wpbc-settings' !== $page_tag ) || ( 'themes' !== $active_page_tab ) ) {
		return;
	}

	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_themes__get_manage_cap() ) ) {
		return;
	}
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_themes__top_toolbar_group">
		<a href="javascript:void(0);"
			class="button button-primary wpbc_themes__top_btn_save"
			data-wpbc-theme-save="1"
			data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
			<i class="menu_icon icon-1x wpbc-bi-check2-circle"></i>
			<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Save Changes', 'booking' ); ?></span>
		</a>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_settings_themes__top_toolbar__show_save_button', 20, 3 );

/**
 * Block direct access for regular users in MultiUser context.
 *
 * @param bool   $is_show_this_page Whether to show page.
 * @param string $page_tag Current page.
 * @param string $active_page_tab Active tab.
 * @param string $active_page_subtab Active subtab.
 *
 * @return bool
 */
function wpbc_settings_themes__check_showing_page( $is_show_this_page, $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( ( 'wpbc-settings' === $page_tag ) && ( 'themes' === $active_page_tab ) && ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_themes__get_manage_cap() ) ) ) {
		return false;
	}

	return $is_show_this_page;
}
add_filter( 'wpbc_before_showing_settings_page_is_show_page', 'wpbc_settings_themes__check_showing_page', 20, 4 );

/**
 * Appearance / Theme tab.
 */
class WPBC_Page_Settings_Themes extends WPBC_Page_Structure {

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

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_themes__get_manage_cap() ) ) {
			return (string) wp_rand( 100000, 1000000 );
		}

		return 'wpbc-settings';
	}

	/**
	 * Register tab.
	 *
	 * @return array
	 */
	public function tabs() {

		$tabs = array();

		$tabs['themes'] = array(
			'is_show_top_path'                          => true,
			'right_vertical_sidebar__is_show'           => true,
			'right_vertical_sidebar__default_view_mode' => '',
			'right_vertical_sidebar_compact__is_show'   => true,
			'left_navigation__default_view_mode'        => 'compact',
			'top_path_title'                            => __( 'Appearance', 'booking' ) . ' / ' . __( 'Theme', 'booking' ),
			'title'                                     => __( 'Appearance', 'booking' ) . ' / ' . __( 'Theme', 'booking' ) .
														   '<span class="wpbc_new_label" style="margin-left: auto;">' . esc_html__( 'New', 'booking' ) . '</span>',
			'hint'                                      => __( 'Preview and configure the booking form theme, calendar skin, and time slot appearance.', 'booking' ),
			'page_title'                                => __( 'Appearance', 'booking' ) . ' / ' . __( 'Theme', 'booking' ),
			'link'                                      => function_exists( 'wpbc_get_settings_themes_url' ) ? wpbc_get_settings_themes_url() : admin_url( 'admin.php?page=wpbc-settings&tab=themes' ),
			'position'                                  => '',
			'css_classes'                               => 'wpbc_top_tab__themes',
			'icon'                                      => '',
			'font_icon'                                 => 'wpbc-bi-palette-fill',
			'font_icon_right'                           => '',
			'default'                                   => false,
			'disabled'                                  => false,
			'hided'                                     => false,
			'subtabs'                                   => array(),
			'folder_style'                              => 'order:94;',
		);

		return $tabs;
	}

	/**
	 * Save settings.
	 *
	 * @return void
	 */
	public function maybe_update() {

		$form_name = 'wpbc_settings_themes_form';

		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST[ 'is_form_submitted_' . $form_name ] ) ) {
			return;
		}

		check_admin_referer( 'wpbc_settings_page_' . $form_name );

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_themes__get_manage_cap() ) ) {
			return;
		}

		$cleaned_data = wpbc_settings_themes__validate_data( $_POST ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		wpbc_settings_themes__update_settings( $cleaned_data );

		$this->is_updated = true;
	}

	/**
	 * Right compact sidebar tabs.
	 *
	 * @return void
	 */
	public function right_sidebar_compact_content() {

		WPBC_UI_Sidebar_Panels::render_rightbar_tabs(
			array(
				array(
					'id'       => 'wpbc_tab_theme_settings',
					'panel_id' => 'wpbc_theme__inspector_settings',
					'title'    => __( 'Settings', 'booking' ),
					'icon'     => 'wpbc_icn_tune',
					'selected' => true,
				),
				array(
					'id'       => 'wpbc_tab_theme_notes',
					'panel_id' => 'wpbc_theme__inspector_notes',
					'title'    => __( 'Notes', 'booking' ),
					'icon'     => 'wpbc-bi-info-circle',
				),
			),
			array(
				'aria_label' => __( 'Appearance Panels', 'booking' ),
				'context'    => 'settings_themes',
				'class'      => 'wpbc_theme_rightbar_tabs',
			)
		);
	}

	/**
	 * Right sidebar panels.
	 *
	 * @return void
	 */
	public function right_sidebar_content() {
		?>
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_theme_rightbar_panels">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_theme__inspector_settings',
					'labelledby' => 'wpbc_tab_theme_settings',
					'class'      => 'wpbc_theme__inspector_settings',
				),
				array( $this, 'right_panel_settings_content' )
			);

			WPBC_UI_Sidebar_Panels::render_panel(
				array(
					'id'         => 'wpbc_theme__inspector_notes',
					'labelledby' => 'wpbc_tab_theme_notes',
					'class'      => 'wpbc_theme__inspector_notes',
					'hidden'     => true,
				),
				array( $this, 'right_panel_notes_content' )
			);
			?>
		</div>
		<?php
	}

	/**
	 * Settings panel content.
	 *
	 * @return void
	 */
	public function right_panel_settings_content() {

		$form_name             = 'wpbc_settings_themes_form';
		$current_settings      = wpbc_settings_themes__get_settings_response();
		$form_style_options    = wpbc_settings_themes__get_form_style_options();
		$calendar_skin_options = wpbc_settings_themes__get_calendar_skin_options_for_select();
		$time_skin_options     = wpbc_settings_themes__get_time_picker_skin_options();
		$current_form_style    = wpbc_bfb_settings__sanitize_form_style( $current_settings['booking_form_style'] );
		$transition_values     = wpbc_settings_themes__map_form_style_to_options( $current_form_style, '' );

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Appearance', 'booking' ) . ' / ' . __( 'Theme', 'booking' ), __( 'Visual settings for the booking form and calendar preview.', 'booking' ) );
		?>
		<form method="post" id="<?php echo esc_attr( $form_name ); ?>" class="wpbc_theme_settings_form" data-wpbc-theme-settings-form="1">
			<?php wp_nonce_field( 'wpbc_settings_page_' . $form_name ); ?>
			<input type="hidden" name="is_form_submitted_<?php echo esc_attr( $form_name ); ?>" value="1" />
			<div class="wpbc_bfb__inspector__body wpbc_theme_inspector_body">
				<?php
				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_theme_form_group',
						'group' => 'settings-theme-form',
						'title' => __( 'Form Style', 'booking' ),
						'open'  => true,
					),
					function () use ( $form_style_options, $current_form_style, $transition_values ) {
						$is_custom = ( 'custom' === (string) $current_form_style );
						$builder_url = add_query_arg(
							array(
								'page'           => 'wpbc-settings',
								'tab'            => 'builder_booking_form',
								'wpbc_bfb_panel' => 'form_settings',
								'wpbc_bfb_group' => 'settings-appearance',
								'wpbc_bfb_focus' => 'booking_form_custom_background_color',
							),
							admin_url( 'admin.php' )
						);
						?>
						<input type="hidden" id="booking_form_theme" value="<?php echo esc_attr( $transition_values['booking_form_theme'] ); ?>" />
						<input type="hidden" id="booking_form_appearance_preset" value="<?php echo esc_attr( $transition_values['booking_form_appearance_preset'] ); ?>" data-wpbc-theme-appearance-control="1" />
						<div class="wpbc_theme_choice_grid wpbc_theme_style_choice_grid">
							<?php foreach ( $form_style_options as $style_value => $style_title ) : ?>
								<label class="wpbc_theme_choice <?php echo ( (string) $current_form_style === (string) $style_value ) ? 'is-selected' : ''; ?>">
									<input type="radio" name="booking_form_style" value="<?php echo esc_attr( $style_value ); ?>" <?php checked( (string) $current_form_style, (string) $style_value ); ?> />
									<span class="wpbc_theme_choice_swatch wpbc_theme_choice_swatch_<?php echo esc_attr( sanitize_html_class( $style_value ) ); ?>"></span>
									<span class="wpbc_theme_choice_label"><?php echo esc_html( $style_title ); ?></span>
								</label>
							<?php endforeach; ?>
						</div>
						<p class="wpbc_theme_description"><?php esc_html_e( 'Used globally by all booking forms. Dark styles can also guide matching calendar and time slot skins.', 'booking' ); ?></p>
						<div class="wpbc_theme_notice" data-wpbc-theme-custom-appearance-notice="1" <?php echo $is_custom ? '' : 'style="display:none;"'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
							<p style="margin:0 0 10px 0;"><?php esc_html_e( 'Configure the global Custom style, including its container, fields, and buttons, in Forms Builder.', 'booking' ); ?></p>
							<a class="button button-secondary" href="<?php echo esc_url( $builder_url ); ?>">
								<i class="menu_icon icon-1x wpbc-bi-input-cursor-text"></i>
								<span><?php esc_html_e( 'Edit in Forms Builder', 'booking' ); ?></span>
							</a>
						</div>
						<?php
					}
				);

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_theme_calendar_group',
						'group' => 'settings-theme-calendar',
						'title' => __( 'Calendar Skin', 'booking' ),
						'open'  => true,
					),
					function () use ( $calendar_skin_options, $current_settings ) {
						?>
						<div class="wpbc_theme_field_row">
							<label class="wpbc_theme_field_label" for="booking_skin"><?php esc_html_e( 'Calendar Skin', 'booking' ); ?></label>
							<div class="wpbc_ajx_toolbar wpbc_no_borders wpbc_theme_skin_toolbar">
								<div class="ui_container">
									<div class="ui_group">
										<div class="ui_element ui_nowrap">
											<?php
											if ( function_exists( 'wpbc_flex_select' ) ) {
												wpbc_flex_select(
													array(
														'id'      => 'booking_skin',
														'name'    => 'booking_skin',
														'label'   => '',
														'class'   => 'js-wpbc-bfb-calendar-skin wpbc_radio__set_days_customize_plugin',
														'value'   => $current_settings['booking_skin'],
														'attr'    => array( 'data-wpbc-theme-calendar-skin' => '1' ),
														'options' => $calendar_skin_options,
													)
												);
											} else {
												wpbc_settings_themes__render_select(
													'booking_skin',
													$calendar_skin_options,
													$current_settings['booking_skin'],
													array(
														'id'         => 'booking_skin',
														'class'      => 'js-wpbc-bfb-calendar-skin wpbc_radio__set_days_customize_plugin',
														'data_attrs' => array( 'data-wpbc-theme-calendar-skin' => '1' ),
													)
												);
											}
											$is_apply_rotating_icon = false;
											if ( function_exists( 'wpbc_smpl_form__ui__selectbox_prior_btn' ) ) {
												wpbc_smpl_form__ui__selectbox_prior_btn( 'booking_skin', $is_apply_rotating_icon );
											}
											if ( function_exists( 'wpbc_smpl_form__ui__selectbox_next_btn' ) ) {
												wpbc_smpl_form__ui__selectbox_next_btn( 'booking_skin', $is_apply_rotating_icon );
											}
											?>
										</div>
									</div>
								</div>
							</div>
						</div>
						<?php
					}
				);

				WPBC_UI_Sidebar_Panels::render_collapsible_group(
					array(
						'id'    => 'wpbc_theme_time_slots_group',
						'group' => 'settings-theme-time-slots',
						'title' => __( 'Time Slot Appearance', 'booking' ),
						'open'  => false,
					),
					function () use ( $time_skin_options, $current_settings ) {
						?>
						<div class="wpbc_theme_field_row">
							<label class="wpbc_theme_field_label" for="booking_timeslot_picker_skin"><?php esc_html_e( 'Time Picker Skin', 'booking' ); ?></label>
							<?php
							wpbc_settings_themes__render_select(
								'booking_timeslot_picker_skin',
								$time_skin_options,
								$current_settings['booking_timeslot_picker_skin'],
								array(
									'id'         => 'booking_timeslot_picker_skin',
									'data_attrs' => array(
										'data-wpbc-theme-time-skin'       => '1',
										'data-wpbc-theme-preview-notice'  => 'form',
									),
								)
							);
							?>
						</div>
						<label class="wpbc_theme_switch wpbc_theme_switch_card">
							<input type="checkbox" name="booking_timeslot_picker" value="On" data-wpbc-theme-preview-notice="form" <?php checked( $current_settings['booking_timeslot_picker'], 'On' ); ?> />
							<span class="wpbc_theme_switch_control" aria-hidden="true"><span class="wpbc_theme_switch_knob"></span></span>
							<span class="wpbc_theme_switch_label"><?php esc_html_e( 'Show time slots as a time picker instead of a select box.', 'booking' ); ?></span>
						</label>
						<?php
					}
				);
				?>
			</div>
		</form>
		<?php
	}

	/**
	 * Notes panel content.
	 *
	 * @return void
	 */
	public function right_panel_notes_content() {

		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Notes', 'booking' ), __( 'How these appearance settings are applied.', 'booking' ) );
		?>
		<div class="wpbc_bfb__inspector__body wpbc_theme_inspector_body">
			<div class="wpbc_theme_notice">
				<strong><?php esc_html_e( 'Note', 'booking' ); ?>!</strong>
				<?php esc_html_e( 'These options apply to front-end booking calendars and forms. The preview uses the selected booking resource from the toolbar.', 'booking' ); ?>
			</div>
		</div>
		<?php
	}

	/**
	 * Show page content.
	 *
	 * @return void|false
	 */
	public function content() {

		do_action( 'wpbc_hook_settings_page_header', 'page_settings_themes' );

		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_themes__get_manage_cap() ) ) {
			return false;
		}

		if ( function_exists( 'wpbc_js_for_bookings_page' ) ) {
			wpbc_js_for_bookings_page();
		}

		if ( $this->is_updated ) {
			wpbc_show_changes_saved_message();
		}

		$resource_id  = wpbc_settings_themes__get_preview_resource_id();
		$months_count = wpbc_settings_themes__get_preview_months_count();
		$preview_mode = wpbc_settings_themes__get_preview_mode();
		$custom_booking_form = wpbc_settings_themes__get_custom_booking_form();
		$resources    = wpbc_settings_themes__get_resources();
		$form_options = wpbc_settings_themes__get_booking_form_options();
		$is_free_version = ! class_exists( 'wpdev_bk_personal' );
		?>
		<div class="wpbc_theme_page wpdevelop" data-wpbc-theme-page="1" data-wpbc-theme-resource-id="<?php echo esc_attr( $resource_id ); ?>">
			<form method="get" class="wpbc_theme_toolbar wpbc_ts_toolbar wpbc_theme_preview_controls" data-wpbc-theme-preview-toolbar="1">
				<input type="hidden" name="page" value="wpbc-settings" />
				<input type="hidden" name="tab" value="themes" />
				<div class="wpbc_ts_control wpbc_theme_control_resource">
					<label for="wpbc_theme_resource_id"><?php esc_html_e( 'Booking resource', 'booking' ); ?></label>
					<?php if ( $is_free_version ) : ?>
						<input type="hidden" id="wpbc_theme_resource_id" name="resource_id" value="<?php echo esc_attr( $resource_id ); ?>" />
						<div class="wpbc_theme_toolbar_value">
							<i class="menu_icon icon-1x wpbc-bi-calendar2-day"></i>
							<span><?php echo esc_html( ! empty( $resources[0]['title'] ) ? $resources[0]['title'] : __( 'Default booking resource', 'booking' ) ); ?></span>
						</div>
						<?php
						$resource_dismiss_id = wpbc_settings_themes__get_premium_option_dismiss_id( 'booking_resources' );
						if ( wpbc_settings_themes__is_dismissed_visible( $resource_dismiss_id ) ) :
							?>
							<div id="<?php echo esc_attr( $resource_dismiss_id ); ?>" class="wpbc_theme_upgrade_hint">
								<a class="wpbc_pro_label" href="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>" target="_blank">Pro</a>
								<?php wpbc_settings_themes__render_dismiss_button( $resource_dismiss_id ); ?>
								<span><?php esc_html_e( 'The Free version has one default booking resource. To have multiple resources, please upgrade to a premium version.', 'booking' ); ?></span>
							</div>
						<?php endif; ?>
					<?php else : ?>
						<select id="wpbc_theme_resource_id" name="resource_id">
							<?php foreach ( $resources as $resource ) : ?>
								<option value="<?php echo esc_attr( $resource['id'] ); ?>" <?php selected( $resource_id, (int) $resource['id'] ); ?>><?php echo esc_html( $resource['title'] ); ?></option>
							<?php endforeach; ?>
						</select>
					<?php endif; ?>
				</div>
				<div class="wpbc_ts_control wpbc_theme_control_months">
					<label for="wpbc_theme_months_count"><?php esc_html_e( 'Months', 'booking' ); ?></label>
					<select id="wpbc_theme_months_count" name="months_count">
						<?php foreach ( array( 1, 2, 3, 4, 6, 12 ) as $month_option ) : ?>
							<option value="<?php echo esc_attr( $month_option ); ?>" <?php selected( $months_count, $month_option ); ?>><?php echo esc_html( $month_option ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<div class="wpbc_ts_control wpbc_theme_control_preview_mode">
					<label for="wpbc_theme_preview_mode"><?php esc_html_e( 'Preview', 'booking' ); ?></label>
					<select id="wpbc_theme_preview_mode" name="preview_mode">
						<?php foreach ( wpbc_settings_themes__get_preview_mode_options() as $mode_value => $mode_title ) : ?>
							<option value="<?php echo esc_attr( $mode_value ); ?>" <?php selected( $preview_mode, $mode_value ); ?>><?php echo esc_html( $mode_title ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<div class="wpbc_ts_control wpbc_theme_control_form <?php echo ( 'form' === $preview_mode ) ? 'is-visible' : ''; ?>" data-wpbc-theme-form-control="1">
					<label for="wpbc_theme_custom_form"><?php esc_html_e( 'Booking Form', 'booking' ); ?></label>
					<select id="wpbc_theme_custom_form" name="custom_booking_form">
						<?php foreach ( $form_options as $form_value => $form_title ) : ?>
							<option value="<?php echo esc_attr( $form_value ); ?>" <?php selected( $custom_booking_form, $form_value ); ?>><?php echo esc_html( $form_title ); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
			</form>
			<?php wpbc_settings_themes__render_calendar_preview( $resource_id, $months_count, array(), $preview_mode, $custom_booking_form ); ?>
			<div class="wpbc_theme_calendar_notes" data-wpbc-theme-calendar-notes="1">
				<div class="wpbc_ts_hint wpbc_theme_hint_bar">
					<span class="wpbc_icn_info_outline"></span>
					<?php esc_html_e( 'Preview the selected appearance settings before saving them for front-end booking forms.', 'booking' ); ?>
				</div>
			</div>
		</div>
		<?php

		do_action( 'wpbc_hook_settings_page_footer', 'page_settings_themes' );
	}
}
add_action( 'wpbc_menu_created', array( new WPBC_Page_Settings_Themes(), '__construct' ) );
