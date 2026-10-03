<?php
/**
 * WordPress template for published booking-page cards.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-setup-wizard-booking-pages-popup">
	<div class="wpdevelop">
		<div
			id="wpbc_setup_wizard_booking_pages_popup"
			class="modal wpbc_popup_modal wpbc_setup_wizard_booking_pages_popup"
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-hidden="true"
			aria-labelledby="wpbc_setup_wizard_booking_pages_popup_title"
			aria-describedby="wpbc_setup_wizard_booking_pages_popup_description"
		>
			<div class="modal-dialog" role="document">
				<div class="modal-content">
					<button type="button" class="wpbc_setup_wizard_booking_pages_popup__close" data-wpbc-booking-pages-dismiss="1" aria-label="<?php esc_attr_e( 'Close published booking pages', 'booking' ); ?>">
						<span aria-hidden="true">&times;</span>
					</button>
					<div class="modal-body wpbc_setup_wizard_booking_pages_popup__body">
						<#
						var setup_pages = _.filter( data.booking_pages, function( booking_page ) {
							return 'setup' === booking_page.section;
						} );
						var example_pages = _.filter( data.booking_pages, function( booking_page ) {
							return 'setup' !== booking_page.section;
						} );
						#>
						<div class="wpbc_setup_wizard_booking_pages_popup__brand" aria-hidden="true">
							<?php
							// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Trusted SVG helper escapes generated attributes.
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
						<h2 id="wpbc_setup_wizard_booking_pages_popup_title"><?php esc_html_e( 'Test your booking pages', 'booking' ); ?></h2>
						<p id="wpbc_setup_wizard_booking_pages_popup_description" class="wpbc_setup_wizard_booking_pages_popup__description">{{ data.description }}</p>
						<# if ( setup_pages.length ) { #>
							<section class="wpbc_setup_wizard_booking_pages_popup__section wpbc_setup_wizard_booking_pages_popup__section--setup" aria-labelledby="wpbc_setup_wizard_booking_pages_setup_title">
								<div class="wpbc_setup_wizard_booking_pages_popup__section_heading">
									<span class="wpbc_setup_wizard_booking_pages_popup__section_badge"><?php esc_html_e( 'Configured by Setup Wizard', 'booking' ); ?></span>
									<h3 id="wpbc_setup_wizard_booking_pages_setup_title"><?php esc_html_e( 'Your configured booking page', 'booking' ); ?></h3>
									<p><?php esc_html_e( 'This page uses the customer journey and Booking Form choices saved during setup.', 'booking' ); ?></p>
								</div>
								<div class="wpbc_setup_wizard_booking_pages_popup__cards wpbc_setup_wizard_booking_pages_popup__cards--setup">
									<# _.each( setup_pages, function( booking_page ) { #>
										<article class="wpbc_setup_wizard_booking_pages_popup__card wpbc_setup_wizard_booking_pages_popup__card--setup">
											<# if ( booking_page.image_url ) { #>
												<div class="wpbc_setup_wizard_booking_pages_popup__image"><img src="{{ booking_page.image_url }}" alt="{{ booking_page.image_alt }}" loading="lazy" decoding="async"></div>
											<# } #>
											<div class="wpbc_setup_wizard_booking_pages_popup__card_content">
												<h4>{{ booking_page.page_title }}</h4>
												<p>{{ booking_page.description }}</p>
												<a class="button button-primary" href="{{ booking_page.url }}" target="_blank" rel="noopener noreferrer" data-wpbc-booking-pages-open="1">
													{{ booking_page.button_title }} <span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>
													<span class="screen-reader-text"><?php esc_html_e( '(opens in a new tab)', 'booking' ); ?></span>
												</a>
											</div>
										</article>
									<# } ); #>
								</div>
							</section>
						<# } #>
						<# if ( example_pages.length ) { #>
							<section class="wpbc_setup_wizard_booking_pages_popup__section wpbc_setup_wizard_booking_pages_popup__section--examples" aria-labelledby="wpbc_setup_wizard_booking_pages_examples_title">
								<div class="wpbc_setup_wizard_booking_pages_popup__section_heading">
									<h3 id="wpbc_setup_wizard_booking_pages_examples_title"><# if ( setup_pages.length ) { #><?php esc_html_e( 'Other booking examples', 'booking' ); ?><# } else { #><?php esc_html_e( 'Starter booking examples', 'booking' ); ?><# } #></h3>
									<p><?php esc_html_e( 'These automatically generated starter pages demonstrate other ways customers can book.', 'booking' ); ?></p>
								</div>
								<div class="wpbc_setup_wizard_booking_pages_popup__cards">
									<# _.each( example_pages, function( booking_page ) { #>
										<article class="wpbc_setup_wizard_booking_pages_popup__card">
											<# if ( booking_page.image_url ) { #>
												<div class="wpbc_setup_wizard_booking_pages_popup__image"><img src="{{ booking_page.image_url }}" alt="{{ booking_page.image_alt }}" loading="lazy" decoding="async"></div>
											<# } #>
											<div class="wpbc_setup_wizard_booking_pages_popup__card_content">
												<h4>{{ booking_page.page_title }}</h4>
												<p>{{ booking_page.description }}</p>
												<a class="button button-secondary" href="{{ booking_page.url }}" target="_blank" rel="noopener noreferrer" data-wpbc-booking-pages-open="1">
													{{ booking_page.button_title }} <span class="wpbc-bi-box-arrow-up-right" aria-hidden="true"></span>
													<span class="screen-reader-text"><?php esc_html_e( '(opens in a new tab)', 'booking' ); ?></span>
												</a>
											</div>
										</article>
									<# } ); #>
								</div>
							</section>
						<# } #>
						<div class="wpbc_setup_wizard_booking_pages_popup__notice" role="note">
							<span class="wpbc_icn_info_outline" aria-hidden="true"></span>
							<span><?php esc_html_e( 'Use test details. Booking notifications may be sent; remove test bookings from Booking Listing when you finish.', 'booking' ); ?></span>
						</div>
						<div class="wpbc_setup_wizard_booking_pages_popup__actions">
							<button type="button" class="button button-primary button-hero" data-wpbc-booking-pages-dismiss="1">{{ data.dismiss_label }}</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</script>
