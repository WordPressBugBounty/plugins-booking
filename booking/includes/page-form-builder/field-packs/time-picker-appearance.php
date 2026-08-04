<?php
/**
 * Shared global time-picker appearance controls for Booking Form Builder time fields.
 *
 * Every time-based field uses this renderer so the global display toggle and
 * skin selector stay consistent and are not duplicated across field packs.
 *
 * @package Booking Calendar
 * @since   11.4.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Check whether the current user can edit global time-picker options.
 *
 * @return bool
 */
function wpbc_bfb_time_picker__can_manage_global_options() {
	return ( ! function_exists( 'wpbc_is_mu_user_can_be_here' ) || wpbc_is_mu_user_can_be_here( 'only_super_admin' ) );
}

/**
 * Normalize a time-picker skin path or URL to the value stored in the database.
 *
 * @param string $skin_value Skin path or URL.
 *
 * @return string
 */
function wpbc_bfb_time_picker__normalize_skin_value( $skin_value ) {

	$skin_value = is_scalar( $skin_value ) ? (string) $skin_value : '';
	$replace    = array( WPBC_PLUGIN_DIR, WPBC_PLUGIN_URL );
	$upload_dir = wp_upload_dir();

	if ( ! empty( $upload_dir['basedir'] ) ) {
		$replace[] = $upload_dir['basedir'];
	}
	if ( ! empty( $upload_dir['baseurl'] ) ) {
		$replace[] = $upload_dir['baseurl'];
	}

	return str_replace( $replace, '', $skin_value );
}

/**
 * Resolve a stored time-picker skin path to its public URL.
 *
 * @param string $relative_skin Relative skin path.
 *
 * @return string
 */
function wpbc_bfb_time_picker__get_skin_url( $relative_skin ) {

	$relative_skin = wpbc_bfb_time_picker__normalize_skin_value( $relative_skin );
	$upload_dir    = wp_upload_dir();
	$upload_url    = ! empty( $upload_dir['baseurl'] ) ? $upload_dir['baseurl'] : '';

	if ( 0 === strpos( $relative_skin, '/wpbc_time_picker_skins/' ) && ! empty( $upload_url ) ) {
		return $upload_url . $relative_skin;
	}

	return WPBC_PLUGIN_URL . $relative_skin;
}

/**
 * Get time-picker skins for the shared Inspector selectbox.
 *
 * @return array
 */
function wpbc_bfb_time_picker__get_skin_options() {

	$automatic_skin = '/css/time_picker_skins/form_style.css';
	$options        = array();
	$upload_dir     = wp_upload_dir();

	if ( function_exists( 'wpbc_dir_list' ) ) {
		$skin_directories = array( WPBC_PLUGIN_DIR . '/css/time_picker_skins/' );
		if ( ! empty( $upload_dir['basedir'] ) ) {
			$skin_directories[] = $upload_dir['basedir'] . '/wpbc_time_picker_skins/';
		}

		$files = wpbc_dir_list(
			$skin_directories
		);

		foreach ( $files as $skin_file ) {
			$relative_skin = wpbc_bfb_time_picker__normalize_skin_value( $skin_file[1] );
			$options[ $relative_skin ] = array(
				'title' => $skin_file[2],
				'attr'  => array(
					'data-wpbc-time-picker-skin-url' => wpbc_bfb_time_picker__get_skin_url( $relative_skin ),
				),
			);
		}
	}

	// Keep the recommended option available even if a directory scan is filtered or unavailable.
	if ( ! isset( $options[ $automatic_skin ] ) && file_exists( WPBC_PLUGIN_DIR . $automatic_skin ) ) {
		$options[ $automatic_skin ] = array(
			'title' => __( 'Automatic — Match Booking Form', 'booking' ),
			'attr'  => array(
				'data-wpbc-time-picker-skin-url' => wpbc_bfb_time_picker__get_skin_url( $automatic_skin ),
			),
		);
	}

	if ( isset( $options[ $automatic_skin ] ) ) {
		$automatic_option          = $options[ $automatic_skin ];
		$automatic_option['title'] = __( 'Automatic — Match Booking Form', 'booking' );
		unset( $options[ $automatic_skin ] );
		$options = array_merge( array( $automatic_skin => $automatic_option ), $options );
	}

	$bundled_titles = array(
		'/css/time_picker_skins/light__24_8.css' => __( 'Light', 'booking' ),
		'/css/time_picker_skins/grey.css'        => __( 'Grey', 'booking' ),
		'/css/time_picker_skins/black.css'       => __( 'Black', 'booking' ),
		'/css/time_picker_skins/blue.css'        => __( 'Blue', 'booking' ),
		'/css/time_picker_skins/green.css'       => __( 'Green', 'booking' ),
		'/css/time_picker_skins/orange.css'      => __( 'Orange', 'booking' ),
		'/css/time_picker_skins/marine.css'      => __( 'Marine', 'booking' ),
	);
	foreach ( $bundled_titles as $skin_path => $skin_title ) {
		if ( isset( $options[ $skin_path ] ) ) {
			$options[ $skin_path ]['title'] = $skin_title;
		}
	}

	/**
	 * Filter time-picker skins displayed in Booking Form Builder time fields.
	 *
	 * @param array $options Time-picker skin options.
	 */
	return apply_filters( 'wpbc_bfb_time_picker_skin_options', $options );
}

/**
 * Render global time-picker display and skin controls in a time-field Inspector.
 *
 * @return void
 */
function wpbc_bfb_time_picker__print_inspector_group() {

	if ( ! wpbc_bfb_time_picker__can_manage_global_options() ) {
		return;
	}

	$is_enabled          = ( 'On' === get_bk_option( 'booking_timeslot_picker' ) );
	$current_skin        = wpbc_bfb_time_picker__normalize_skin_value( get_bk_option( 'booking_timeslot_picker_skin' ) );
	$toggle_option       = 'booking_timeslot_picker';
	$skin_option         = 'booking_timeslot_picker_skin';
	$toggle_nonce_action = 'wpbc_nonce_' . $toggle_option;
	$skin_nonce_action   = 'wpbc_nonce_' . $skin_option;
	$skin_select_id      = 'wpbc_bfb__time_field__booking_timeslot_picker_skin';

	?>
			<div class="inspector__row row__bordered wpbc_bfb__inspector_time_picker_appearance" data-wpbc-time-picker-appearance="display" style="align-items:flex-start;justify-content:space-between;">
				<div class="inspector__control" style="flex:1 1 auto;">
					<label class="inspector__label" for="wpbc_bfb__time_field__booking_timeslot_picker">
						<strong><?php esc_html_e( 'Time Picker Display', 'booking' ); ?></strong>
					</label>
					<span class="wpbc_ui__toggle" style="margin-top:6px;">
						<input id="wpbc_bfb__time_field__booking_timeslot_picker" type="checkbox" class="inspector__checkbox js-toggle-timeslot-picker" <?php checked( $is_enabled ); ?> />
						<label class="wpbc_ui__toggle_icon" for="wpbc_bfb__time_field__booking_timeslot_picker" aria-hidden="true"></label>
						<label class="wpbc_ui__toggle_label" for="wpbc_bfb__time_field__booking_timeslot_picker"><?php esc_html_e( 'Show time slots as clickable choices instead of a select box.', 'booking' ); ?></label>
					</span>
					<p class="wpbc_bfb__help" style="margin-top:6px;"><?php esc_html_e( 'This is a global option used by all compatible time fields.', 'booking' ); ?></p>
				</div>
				<a href="javascript:void(0);"
					class="button button-secondary"
					onclick="wpbc_save_option_from_element(this);"
					data-wpbc-u-save-name="<?php echo esc_attr( $toggle_option ); ?>"
					data-wpbc-u-save-nonce="<?php echo esc_attr( wp_create_nonce( $toggle_nonce_action ) ); ?>"
					data-wpbc-u-save-action="<?php echo esc_attr( $toggle_nonce_action ); ?>"
					data-wpbc-u-save-value-from="#wpbc_bfb__time_field__booking_timeslot_picker"
					data-wpbc-u-autosave-on-form-save="1"
					data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
					<?php esc_html_e( 'Save Display', 'booking' ); ?>
				</a>
			</div>

			<div class="inspector__row row__bordered js-time-picker-skin-row wpbc_bfb__inspector_time_picker_appearance" data-wpbc-time-picker-appearance="skin" style="align-items:flex-start;justify-content:space-between;<?php echo $is_enabled ? '' : 'display:none;'; ?>" <?php echo $is_enabled ? '' : 'hidden aria-hidden="true"'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
				<div class="inspector__control" style="flex:1 1 auto;">
					<label for="<?php echo esc_attr( $skin_select_id ); ?>" class="inspector__label" style="display:block;margin:0 0 6px;">
						<strong><?php esc_html_e( 'Time Slot Style', 'booking' ); ?></strong>
					</label>
					<div class="wpbc_ajx_toolbar wpbc_no_borders">
						<div class="ui_container ui_container_small0">
							<div class="ui_group">
								<div class="ui_element ui_nowrap">
									<?php
									wpbc_flex_select(
										array(
											'id'               => $skin_select_id,
											'name'             => $skin_option,
											'label'            => '',
											'class'            => 'js-wpbc-bfb-time-picker-skin',
											'value'            => $current_skin,
											'disabled'         => false,
											'disabled_options' => array(),
											'options'          => wpbc_bfb_time_picker__get_skin_options(),
										)
									);
									wpbc_smpl_form__ui__selectbox_prior_btn( $skin_select_id, false );
									wpbc_smpl_form__ui__selectbox_next_btn( $skin_select_id, false );
									?>
								</div>
							</div>
						</div>
					</div>
					<p class="wpbc_bfb__help" style="margin-top:6px;"><?php esc_html_e( 'Automatic follows the Booking Form Style and accent color. Other skins keep their own colors.', 'booking' ); ?></p>
				</div>
				<a href="javascript:void(0);"
					class="button button-primary"
					onclick="wpbc_save_option_from_element(this);"
					data-wpbc-u-save-name="<?php echo esc_attr( $skin_option ); ?>"
					data-wpbc-u-save-nonce="<?php echo esc_attr( wp_create_nonce( $skin_nonce_action ) ); ?>"
					data-wpbc-u-save-action="<?php echo esc_attr( $skin_nonce_action ); ?>"
					data-wpbc-u-save-value-from="#<?php echo esc_attr( $skin_select_id ); ?>"
					data-wpbc-u-save-callback="wpbc_bfb_time_picker_skin_control_saved"
					data-wpbc-u-autosave-on-form-save="1"
					data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
					<?php esc_html_e( 'Save Style', 'booking' ); ?>
				</a>
			</div>
	<?php
}
