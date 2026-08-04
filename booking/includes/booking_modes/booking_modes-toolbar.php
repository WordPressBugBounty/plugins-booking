<?php
/**
 * Booking Modes toolbar selector and assets.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enqueue the mode selector client on Booking Calendar administration pages.
 *
 * @return void
 */
function wpbc_booking_modes_enqueue_toolbar_script() {

	$context = wpbc_booking_modes_get_context();

	if ( ! $context['is_wpbc_page'] || ! wpbc_booking_modes_current_user_can_switch() ) {
		return;
	}

	$script_handle = 'wpbc-booking-modes-toolbar';
	$script_url    = trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking_modes.js';

	wp_enqueue_script( $script_handle, $script_url, array( 'jquery', 'wpbc_all' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
	wp_localize_script(
		$script_handle,
		'wpbc_booking_modes_config',
		array(
			'ajax_url'   => admin_url( 'admin-ajax.php' ),
			'action'     => 'WPBC_AJX_BOOKING_MODE_SWITCH',
			'nonce'      => wp_create_nonce( 'wpbc_booking_modes_switch_nonce' ),
			'quickstart' => function_exists( 'wpbc_booking_modes_run_quickstart' )
				? array(
					'action' => 'WPBC_AJX_BOOKING_MODE_QUICKSTART',
					'nonce'  => wp_create_nonce( 'wpbc_booking_modes_quickstart_nonce' ),
				)
				: array(),
			'i18n'       => array(
				'saving'             => __( 'Switching Booking Calendar mode...', 'booking' ),
				'error'              => __( 'The administration mode could not be changed.', 'booking' ),
				'quickstart_error'   => __( 'QuickStart could not be completed.', 'booking' ),
				'quickstart_confirm' => __( 'QuickStart can create a public booking page and configure mode defaults. Continue?', 'booking' ),
				'test_page'         => __( 'Test booking page', 'booking' ),
				'switched'          => __( 'Booking Calendar mode activated.', 'booking' ),
			),
		)
	);
}
add_action( 'wpbc_load_js_on_admin_page', 'wpbc_booking_modes_enqueue_toolbar_script', 30 );

/**
 * Enqueue the scoped mode selector stylesheet on Booking Calendar pages.
 *
 * @return void
 */
function wpbc_booking_modes_enqueue_toolbar_style() {

	$context = wpbc_booking_modes_get_context();

	if ( ! $context['is_wpbc_page'] || ! wpbc_booking_modes_current_user_can_switch() ) {
		return;
	}

	wp_enqueue_style( 'wpbc-booking-modes-toolbar', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking_modes.css', array(), WP_BK_VERSION_NUM );
}
add_action( 'wpbc_load_css_on_admin_page', 'wpbc_booking_modes_enqueue_toolbar_style', 30 );

/**
 * Render the administration mode selector in the shared top toolbar.
 *
 * @param string $page_tag           Current Booking Calendar page slug.
 * @param string $active_page_tab    Current active tab slug.
 * @param string $active_page_subtab Current active subtab slug.
 *
 * @return void
 */
function wpbc_booking_modes_render_toolbar_selector( $page_tag, $active_page_tab, $active_page_subtab ) {

	unset( $page_tag, $active_page_tab, $active_page_subtab );

	if ( ! wpbc_booking_modes_current_user_can_switch() ) {
		return;
	}

	$selected_mode_id = wpbc_booking_modes_get_selected_mode_id();
	$selected_mode    = wpbc_booking_modes_get_mode( $selected_mode_id );
	$selector_items   = array();

	foreach ( wpbc_booking_modes_get_allowed_mode_ids() as $mode_id ) {
		$mode = wpbc_booking_modes_get_mode( $mode_id );

		if ( ! is_array( $mode ) ) {
			continue;
		}

		$item_attributes = array(
			'class'        => 'wpbc_booking_mode_option' . ( $selected_mode_id === $mode_id ? ' is-current' : '' ),
			'data-mode-id' => $mode_id,
		);

		if ( $selected_mode_id === $mode_id ) {
			$item_attributes['aria-current'] = 'true';
		}

		$selector_items[] = array(
			'type'  => 'link',
			'title' => $mode['label'],
			'url'   => '#',
			'attr'  => $item_attributes,
		);
	}

	if ( empty( $selector_items ) || ! is_array( $selected_mode ) ) {
		return;
	}

	wpbc_ui_el__divider_vertical( array( 'class' => 'wpbc_booking_modes_toolbar_divider wpbc_ui_el__vertical_line' ) );
	wpbc_ui_el__dropdown_menu(
		array(
			/* translators: %s: Selected Booking Calendar administration mode. */
			'title'           => sprintf( __( 'Mode: %s', 'booking' ), $selected_mode['label'] ),
			'has_border'      => false,
			'class'           => 'wpbc_booking_modes_toggle',
			'container_class' => 'wpbc_booking_modes_selector',
			'attr'            => array( 'aria-label' => __( 'Booking Calendar administration mode', 'booking' ) ),
			'items'           => $selector_items,
		)
	);
}
add_action( 'wpbc_ui_el__top_nav__content_start', 'wpbc_booking_modes_render_toolbar_selector', 5, 3 );

/**
 * Render the explicit QuickStart notice in the floating admin-message stack.
 *
 * Mode selection remains a presentation-only operation. QuickStart uses a
 * standard WordPress notice with standard buttons because it can create site
 * content. Each mode has a separate user-specific dismissal key, so dismissing
 * one prompt does not suppress the other. Live demos expose documentation only
 * and never page-editing actions.
 *
 * @param string $page_tag           Current Booking Calendar page slug.
 * @param string $active_page_tab    Current active tab slug.
 * @param string $active_page_subtab Current active subtab slug.
 *
 * @return void
 */
function wpbc_booking_modes_render_quickstart_action( $page_tag, $active_page_tab, $active_page_subtab ) {

	unset( $page_tag, $active_page_tab, $active_page_subtab );

	if ( function_exists( 'wpbc_setup_wizard_page__is_in_progress' ) && wpbc_setup_wizard_page__is_in_progress() ) {
		return;
	}

	$mode_id = wpbc_booking_modes_get_selected_mode_id();
	$mode    = wpbc_booking_modes_get_mode( $mode_id );

	if ( ! is_array( $mode ) || empty( $mode['quickstart_id'] ) || 'classic' === $mode_id ) {
		return;
	}

	$notice_id = 'wpbc_booking_modes_quickstart_notice_' . $mode_id;

	if ( function_exists( 'wpbc_is_dismissed_panel_visible' ) && ! wpbc_is_dismissed_panel_visible( $notice_id ) ) {
		return;
	}

	$notice_title = 'appointment' === $mode_id
		? __( 'Appointment QuickStart', 'booking' )
		: __( 'Rental QuickStart', 'booking' );
	$notice_text  = 'appointment' === $mode_id
		? __( 'Create or reuse the first Service, Provider assignment, suitable Booking Form, and Appointment booking page.', 'booking' )
		: __( 'Configure date ranges and changeover times, then create or reuse the first Property booking page.', 'booking' );

	if ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
		?>
		<div>
			<div class="wpbc_alert_message">
				<div id="<?php echo esc_attr( $notice_id ); ?>" class="wpbc_inner_message notice notice-info wpbc_booking_modes_quickstart_notice">
					<?php wpbc_booking_modes_render_quickstart_dismiss_button( $notice_id ); ?>
					<p><strong><?php echo esc_html( $notice_title ); ?></strong></p>
					<p><?php echo esc_html( $notice_text ); ?></p>
					<p class="wpbc_booking_modes_quickstart_actions">
						<a class="button button-secondary" href="https://wpbookingcalendar.com/faq/" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'QuickStart guide', 'booking' ); ?></a>
					</p>
				</div>
			</div>
		</div>
		<?php
		return;
	}

	if ( ! function_exists( 'wpbc_booking_modes_current_user_can_quickstart' ) || ! wpbc_booking_modes_current_user_can_quickstart() ) {
		return;
	}

	$test_url = wpbc_booking_modes_get_quickstart_test_url( $mode_id );
	?>
	<div>
		<div class="wpbc_alert_message">
			<div id="<?php echo esc_attr( $notice_id ); ?>" class="wpbc_inner_message notice notice-info wpbc_booking_modes_quickstart_notice" data-wpbc-quickstart-mode="<?php echo esc_attr( $mode_id ); ?>">
				<?php wpbc_booking_modes_render_quickstart_dismiss_button( $notice_id ); ?>
				<p><strong><?php echo esc_html( $notice_title ); ?></strong></p>
				<p><?php echo esc_html( $notice_text ); ?></p>
				<p class="wpbc_booking_modes_quickstart_actions">
					<button type="button" class="button button-primary wpbc_booking_modes_quickstart_button" data-mode-id="<?php echo esc_attr( $mode_id ); ?>">
						<?php esc_html_e( 'Run QuickStart', 'booking' ); ?>
					</button>
					<a class="button button-secondary wpbc_booking_modes_test_page<?php echo $test_url ? '' : ' is-hidden'; ?>" href="<?php echo esc_url( $test_url ? $test_url : '#' ); ?>" target="_blank" rel="noopener noreferrer">
						<?php esc_html_e( 'Test booking page', 'booking' ); ?>
					</a>
				</p>
			</div>
		</div>
	</div>
	<?php
}

/**
 * Render the existing persistent Booking Calendar dismiss control.
 *
 * The shared dismissal API saves an owner-specific user option through its
 * nonce-protected AJAX endpoint. The screen-reader label keeps the visual
 * close symbol understandable to assistive technology.
 *
 * @param string $notice_id HTML ID and persistent dismissal key.
 *
 * @return void
 */
function wpbc_booking_modes_render_quickstart_dismiss_button( $notice_id ) {

	if ( ! function_exists( 'wpbc_is_dismissed' ) ) {
		return;
	}

	wpbc_is_dismissed(
		$notice_id,
		array(
			'title'            => '<span aria-hidden="true">&times;</span><span class="screen-reader-text">' . esc_html__( 'Dismiss', 'booking' ) . '</span>',
			'hint'             => __( 'Dismiss', 'booking' ),
			'class'            => 'close',
			'is_apply_in_demo' => true,
		)
	);
}
add_action( 'wpbc_inside_ui__admin_messages', 'wpbc_booking_modes_render_quickstart_action', 10, 3 );
