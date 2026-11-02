<?php
/**
 * Page controller and shell composition for the isolated Timeline route.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the new Timeline as a hidden source tab under the Bookings page.
 */
final class WPBC_Page_Timeline extends WPBC_Page_Structure {

	/**
	 * Return the existing Booking Calendar root page slug.
	 *
	 * @return string Parent page slug.
	 */
	public function in_page() {
		return 'wpbc';
	}

	/**
	 * Define the isolated Timeline tab without replacing the legacy route.
	 *
	 * @return array<string,array<string,mixed>> Timeline tab declaration.
	 */
	public function tabs() {
		return array(
			'timeline' => array(
				'navigation_shell_context' => WPBC_Admin_Navigation_Policy::CONTEXT_WORKSPACE,
				'page_content_layout'       => WPBC_Admin_Shell_Layout_Policy::LAYOUT_FLUSH,
				'is_show_top_path'          => true,
				'is_show_top_navigation'    => true,
				'is_show_page_heading'      => false,
				'top_path'                 => array( 'root_title' => false ),
				'top_path_title'           => __( 'Timeline', 'booking' ),
				'title'                    => __( 'Timeline', 'booking' ),
				'hint'                     => __( 'View bookings by Resource and date.', 'booking' ),
				'page_title'               => false,
				'page_description'         => false,
				'font_icon'                => 'wpbc_icn_rotate_90 wpbc_icn_align_vertical_bottom',
				'default'                  => false,
				'disabled'                 => false,
				'hided'                    => true,
				'subtabs'                  => array(),
			),
		);
	}

	/**
	 * Render the JavaScript mount and accessible no-script fallback.
	 *
	 * The shell receives only presenter-owned JSON-safe data. No booking query,
	 * Resource query, state change, or legacy Timeline renderer runs here.
	 *
	 * @return void
	 */
	public function content() {
		do_action( 'wpbc_hook_booking_page_header', 'timeline' );
		?>
		<div class="wpbc_timeline_page" data-wpbc-timeline-page="1">
			<h1 class="screen-reader-text"><?php esc_html_e( 'Booking Calendar Timeline', 'booking' ); ?></h1>
			<div
				id="wpbc_timeline"
				class="wpbc_timeline__mount"
				data-wpbc-timeline-mount="wpbc_timeline"
				aria-busy="true"
			>
				<div
					class="wpbc_timeline__state wpbc_timeline__state--loading"
					data-wpbc-timeline-initial-loading="1"
					role="status"
					aria-live="polite"
				>
					<div class="wpbc_spins_loading_container">
						<div class="wpbc_booking_form_spin_loader" aria-hidden="true">
							<div class="wpbc_spins_loader_wrapper">
								<div class="wpbc_one_spin_loader_mini2"></div>
							</div>
						</div>
						<span><?php esc_html_e( 'Loading Timeline', 'booking' ); ?></span>
					</div>
				</div>
			</div>
			<div class="screen-reader-text" data-wpbc-timeline-status role="status" aria-live="polite" aria-atomic="true"></div>
			<noscript>
				<div class="notice notice-error inline">
					<p><?php esc_html_e( 'JavaScript is required to display the Timeline.', 'booking' ); ?></p>
				</div>
			</noscript>
		</div>
		<?php
	}
}

/**
 * Attach the Timeline controller after the Booking Calendar menu is created.
 *
 * @param string $menu_tag Menu slug currently being registered.
 *
 * @return void
 */
function wpbc_timeline_attach_page_controller( $menu_tag ) {
	if ( 'wpbc' !== $menu_tag ) {
		return;
	}

	new WPBC_Page_Timeline();
}
