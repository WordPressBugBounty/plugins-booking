<?php
/**
 * Reusable Free-edition Booking Resource upgrade controls.
 *
 * The Booking Resources catalog and Timeline use this Resource-domain renderer
 * so the upgrade message, destination, accessibility contract, and dialog stay
 * identical across both administration pages.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render the shared Free-edition Booking Resource upgrade button.
 *
 * The catalog browser adapter opens the dialog for existing catalog controls.
 * Other administration pages may opt into the established modal data API so
 * they can reuse this control without adding page-specific JavaScript.
 *
 * @param bool $use_superscript Whether to render the Pro marker in a sup element.
 * @param bool $use_modal_data_api Whether to add the declarative modal trigger attributes.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_render_upgrade_button( $use_superscript = false, $use_modal_data_api = false ) {
	if ( class_exists( 'wpdev_bk_personal' ) ) {
		return;
	}
	?>
	<button
		type="button"
		class="button button-primary tooltip_bottom wpbc_catalog_booking_resources__upgrade_button"
		data-wpbc-catalog-booking-resource-upgrade
		data-wpbc-catalog-booking-resource-upgrade-url="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>"
		<?php if ( $use_modal_data_api ) : ?>
			data-toggle="wpbc_my_modal"
			data-target="#wpbc_catalog_booking_resources__upgrade_modal"
		<?php endif; ?>
		aria-haspopup="dialog"
		aria-controls="wpbc_catalog_booking_resources__upgrade_modal"
		data-original-title="<?php esc_attr_e( 'Adding more Booking Resources is available in paid versions.', 'booking' ); ?>"
		title="<?php esc_attr_e( 'Adding more Booking Resources is available in paid versions.', 'booking' ); ?>"
	>
		<span class="wpbc-bi-plus-lg" aria-hidden="true"></span>
		<?php if ( $use_superscript ) : ?>
			<?php esc_html_e( 'Add Booking Resource', 'booking' ); ?>
			<sup><?php esc_html_e( '(Pro)', 'booking' ); ?></sup>
		<?php else : ?>
			<?php esc_html_e( 'Add Booking Resource (Pro)', 'booking' ); ?>
		<?php endif; ?>
	</button>
	<?php
}

/**
 * Render the Free-edition explanation shown by the Pro-only add control.
 *
 * The modal is informational only. It never calls a mutation endpoint in the
 * Free edition and keeps the existing single default Resource available.
 *
 * @return void
 */
function wpbc_catalog_booking_resources_render_free_upgrade_modal() {
	if ( class_exists( 'wpdev_bk_personal' ) ) {
		return;
	}
	?>
	<div class="wpdevelop">
		<div
			id="wpbc_catalog_booking_resources__upgrade_modal"
			class="modal wpbc_popup_modal wpbc_catalog_booking_resources__upgrade_modal"
			tabindex="-1"
			role="dialog"
			aria-hidden="true"
			aria-labelledby="wpbc_catalog_booking_resources__upgrade_modal_title"
			aria-describedby="wpbc_catalog_booking_resources__upgrade_modal_description"
		>
			<div class="modal-dialog">
				<div class="modal-content">
					<div class="modal-header">
						<button type="button" class="close" data-dismiss="modal" aria-label="<?php esc_attr_e( 'Close', 'booking' ); ?>"><span aria-hidden="true">&times;</span></button>
						<h4 id="wpbc_catalog_booking_resources__upgrade_modal_title" class="modal-title"><?php esc_html_e( 'Add more Booking Resources with Pro', 'booking' ); ?></h4>
					</div>
					<div class="modal-body">
						<p id="wpbc_catalog_booking_resources__upgrade_modal_description"><?php esc_html_e( 'Creating additional Booking Resources is available in paid versions of Booking Calendar. Each Resource can have its own calendar and availability.', 'booking' ); ?></p>
						<p><?php esc_html_e( 'Your default Resource remains ready to customize in the Free version.', 'booking' ); ?></p>
					</div>
					<div class="modal-footer">
						<button type="button" class="button button-secondary" data-dismiss="modal"><?php esc_html_e( 'Close', 'booking' ); ?></button>
						<a class="button button-primary" href="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>" target="_blank" rel="noopener noreferrer">
							<?php esc_html_e( 'Compare Pro versions', 'booking' ); ?>
							<span class="screen-reader-text"> <?php esc_html_e( '(opens in a new tab)', 'booking' ); ?></span>
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
	<?php
}
