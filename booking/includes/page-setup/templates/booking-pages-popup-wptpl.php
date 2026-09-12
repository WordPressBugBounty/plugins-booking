<?php
/**
 * WordPress template for the first-install starter booking-pages prompt.
 *
 * @package Booking Calendar
 * @since   11.8.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-setup-wizard-booking-pages-popup">
	<div class="wpdevelop">
		<div
			id="wpbc_setup_wizard_booking_pages_popup"
			class="modal wpbc_popup_modal wpbc_setup_wizard_first_run_popup wpbc_setup_wizard_booking_pages_popup"
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-hidden="true"
			aria-labelledby="wpbc_setup_wizard_booking_pages_popup_title"
			aria-describedby="wpbc_setup_wizard_booking_pages_popup_description"
		>
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<button
						type="button"
						class="wpbc_setup_wizard_first_run_popup__close"
						data-wpbc-booking-pages-dismiss="1"
						aria-label="<?php esc_attr_e( 'Close starter pages', 'booking' ); ?>"
					>
						<span aria-hidden="true">&times;</span>
					</button>

					<div class="modal-body wpbc_setup_wizard_first_run_popup__body wpbc_setup_wizard_booking_pages_popup__body">
						<div class="wpbc_setup_wizard_booking_pages_popup__brand" aria-hidden="true">
							<?php
							// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted SVG helper escapes its generated attributes.
							echo wpbc_get_svg_logo_for_html(
								array(
									'svg_color'     => '#444',
									'svg_color_alt' => '#bbb',
									'opacity'       => '0.35',
									'style_default' => 'background-repeat: no-repeat; background-position: center; display: inline-block; vertical-align: middle;',
									'style_adjust'  => 'background-size: 42px auto; width: 44px; height: 44px; margin-top: 0;',
									'css_class'     => 'wpbc_setup_wizard_booking_pages_popup__brand_icon',
								)
							);
							?>
							<span class="wpbc_setup_wizard_booking_pages_popup__brand_text">
								<span class="wpbc_setup_wizard_booking_pages_popup__brand_name"><?php esc_html_e( 'Booking Calendar', 'booking' ); ?></span>
								<span class="wpbc_setup_wizard_booking_pages_popup__brand_prefix">WP</span>
							</span>
						</div>

						<h2 id="wpbc_setup_wizard_booking_pages_popup_title">
							<?php esc_html_e( 'Test your booking pages', 'booking' ); ?>
						</h2>

						<p id="wpbc_setup_wizard_booking_pages_popup_description" class="wpbc_setup_wizard_first_run_popup__description">
							<?php esc_html_e( 'Open a starter page in a new tab and try the booking experience as a visitor.', 'booking' ); ?>
						</p>

						<div class="wpbc_setup_wizard_booking_pages_popup__cards">
							<# _.each( data.booking_pages, function( booking_page ) { #>
								<article class="wpbc_setup_wizard_booking_pages_popup__card">
									<# if ( booking_page.image_url ) { #>
										<div class="wpbc_setup_wizard_booking_pages_popup__image">
											<img
												src="{{ booking_page.image_url }}"
												alt="{{ booking_page.image_alt }}"
												loading="lazy"
												decoding="async"
											>
										</div>
									<# } #>

									<div class="wpbc_setup_wizard_booking_pages_popup__card_content">
										<h3>{{ booking_page.page_title }}</h3>
										<p>{{ booking_page.description }}</p>
										<a
											class="button button-secondary"
											href="{{ booking_page.url }}"
											target="_blank"
											rel="noopener noreferrer"
											data-wpbc-booking-pages-open="1"
										>
											{{ booking_page.button_title }}
											<span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>
											<span class="screen-reader-text"><?php esc_html_e( '(opens in a new tab)', 'booking' ); ?></span>
										</a>
									</div>
								</article>
							<# } ); #>
						</div>

						<div class="wpbc_setup_wizard_first_run_popup__notice wpbc_setup_wizard_booking_pages_popup__notice" role="note">
							<span class="wpbc_icn_info_outline" aria-hidden="true"></span>
							<span><?php esc_html_e( 'Use test details. Booking notifications may be sent; remove test bookings from Booking Listing when you finish.', 'booking' ); ?></span>
						</div>

						<div class="wpbc_setup_wizard_first_run_popup__actions wpbc_setup_wizard_booking_pages_popup__actions">
							<button type="button" class="button button-primary button-hero" data-wpbc-booking-pages-dismiss="1">
								<?php esc_html_e( 'Continue to Booking Listing', 'booking' ); ?>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</script>
