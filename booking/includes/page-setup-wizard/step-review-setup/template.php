<?php
/**
 * Final Setup Wizard draft-review page.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$draft        = $template_context['draft'];
$step_data    = $template_context['step_data'];
$journey      = isset( $step_data['journey'] ) && is_array( $step_data['journey'] ) ? $step_data['journey'] : array();
$groups       = isset( $step_data['groups'] ) && is_array( $step_data['groups'] ) ? $step_data['groups'] : array();
$is_completed = 'completed' === $draft['status'];
$step_count   = isset( $journey['journey'] ) && is_array( $journey['journey'] ) ? count( $journey['journey'] ) : 0;
$email_state  = isset( $step_data['email_state'] ) && is_array( $step_data['email_state'] ) ? $step_data['email_state'] : array();
$email_error  = isset( $step_data['email_error'] ) && is_scalar( $step_data['email_error'] ) ? (string) $step_data['email_error'] : '';
?>
<section class="wpbc_setup_wizard__step-content wpbc_setup_wizard__review" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'Review your setup', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Review the settings saved during this setup before you finish.', 'booking' ); ?></p>
	</header>

	<form id="wpbc-setup-wizard-step-form" novalidate>
		<div class="wpbc_setup_wizard__review-plan">
			<?php foreach ( $groups as $group ) : ?>
				<section class="wpbc_setup_wizard__review-group" aria-labelledby="wpbc-setup-review-group-<?php echo esc_attr( $group['id'] ); ?>">
					<h2 id="wpbc-setup-review-group-<?php echo esc_attr( $group['id'] ); ?>"><?php echo esc_html( $group['label'] ); ?></h2>
					<?php if ( 'booking_experience' === $group['id'] ) : ?>
						<article class="wpbc_setup_wizard__review-journey" data-wpbc-review-step="customer_journey">
							<div class="wpbc_setup_wizard__review-journey-summary">
								<span class="wpbc_setup_wizard__review-eyebrow"><?php esc_html_e( 'Your selected journey', 'booking' ); ?></span>
								<h3><?php echo isset( $journey['title'] ) ? esc_html( $journey['title'] ) : esc_html__( 'Customer journey', 'booking' ); ?></h3>
								<p><?php echo isset( $journey['description'] ) ? esc_html( $journey['description'] ) : ''; ?></p>
								<button type="button" class="button button-link wpbc_setup_wizard__review-edit wpbc_setup_wizard__review-edit--journey" data-wpbc-setup-wizard-edit-step="customer_journey">
									<?php esc_html_e( 'Edit', 'booking' ); ?>
									<span class="screen-reader-text"> <?php esc_html_e( 'customer journey', 'booking' ); ?></span>
								</button>
							</div>

							<?php if ( 0 < $step_count ) : ?>
								<div
									class="wpbc_setup_wizard__journey wpbc_setup_wizard__review-journey-visual wpbc_setup_wizard__journey--<?php echo esc_attr( (string) $step_count ); ?>"
									data-wpbc-customer-journey-id="<?php echo isset( $journey['id'] ) ? esc_attr( $journey['id'] ) : ''; ?>"
									aria-hidden="true"
								>
									<?php foreach ( $journey['journey'] as $step_index => $step_label ) : ?>
										<?php
										$preview_type    = isset( $journey['preview_types'][ $step_index ] ) ? $journey['preview_types'][ $step_index ] : 'details';
										$hero_icon_class = 'property' === $preview_type ? 'wpbc_icn_home' : 'wpbc_icn_content_cut';
										?>
										<span class="wpbc_setup_wizard__journey-step wpbc_setup_wizard__journey-step--<?php echo esc_attr( $preview_type ); ?>">
											<strong class="wpbc_setup_wizard__journey-step-title"><?php echo esc_html( $step_label ); ?></strong>
											<span class="wpbc_setup_wizard__journey-preview">
												<span class="wpbc_setup_wizard__preview-hero">
													<i class="menu_icon icon-1x <?php echo esc_attr( $hero_icon_class ); ?>" aria-hidden="true"></i>
													<span class="wpbc_setup_wizard__preview-lines"><span></span><span></span></span>
												</span>
												<span class="wpbc_setup_wizard__preview-people">
													<?php for ( $person_index = 0; $person_index < 3; $person_index++ ) : ?>
														<span><i class="menu_icon icon-1x wpbc_icn_person" aria-hidden="true"></i><span class="wpbc_setup_wizard__preview-bar"></span></span>
													<?php endfor; ?>
												</span>
												<span class="wpbc_setup_wizard__preview-calendar">
													<?php for ( $calendar_index = 0; $calendar_index < 28; $calendar_index++ ) : ?>
														<span></span>
													<?php endfor; ?>
												</span>
												<span class="wpbc_setup_wizard__preview-options">
													<?php for ( $option_index = 0; $option_index < 3; $option_index++ ) : ?>
														<span><i></i><span class="wpbc_setup_wizard__preview-bar"></span></span>
													<?php endfor; ?>
												</span>
												<span class="wpbc_setup_wizard__preview-fields">
													<span><i class="menu_icon icon-1x wpbc_icn_person" aria-hidden="true"></i><span class="wpbc_setup_wizard__preview-bar"></span></span>
													<span><i class="menu_icon icon-1x wpbc_icn_mail_outline" aria-hidden="true"></i><span class="wpbc_setup_wizard__preview-bar"></span></span>
												</span>
											</span>
										</span>
										<?php if ( $step_index < $step_count - 1 ) : ?>
											<span class="wpbc_setup_wizard__journey-arrow"><i class="menu_icon icon-1x wpbc_icn_arrow_forward" aria-hidden="true"></i></span>
										<?php endif; ?>
									<?php endforeach; ?>
								</div>
							<?php endif; ?>

							<div class="wpbc_setup_wizard__review-best-for">
								<strong><?php esc_html_e( 'Best for:', 'booking' ); ?></strong>
								<p><?php echo isset( $journey['best_for'] ) ? esc_html( $journey['best_for'] ) : ''; ?></p>
							</div>
						</article>
					<?php endif; ?>
					<dl>
						<?php foreach ( $group['rows'] as $row ) : ?>
							<div class="wpbc_setup_wizard__review-row" data-wpbc-review-step="<?php echo esc_attr( $row['step_id'] ); ?>">
								<dt><?php echo esc_html( $row['label'] ); ?></dt>
								<dd>
									<strong class="wpbc_setup_wizard__review-row-summary"><?php echo esc_html( $row['summary'] ); ?></strong>
									<?php if ( ! empty( $row['details'] ) ) : ?>
										<div class="wpbc_setup_wizard__review-details">
											<?php foreach ( $row['details'] as $detail ) : ?>
												<div class="wpbc_setup_wizard__review-detail">
													<span><?php echo esc_html( $detail['label'] ); ?></span>
													<?php if ( ! empty( $detail['url'] ) ) : ?>
														<strong>
															<a href="<?php echo esc_url( $detail['url'] ); ?>" target="_blank" rel="noopener noreferrer">
																<?php echo esc_html( $detail['value'] ); ?>
																<span class="screen-reader-text"> <?php esc_html_e( '(opens in a new tab)', 'booking' ); ?></span>
															</a>
														</strong>
													<?php else : ?>
														<strong><?php echo esc_html( $detail['value'] ); ?></strong>
													<?php endif; ?>
												</div>
											<?php endforeach; ?>
										</div>
									<?php endif; ?>
									<?php if ( ! empty( $row['items'] ) ) : ?>
										<details class="wpbc_setup_wizard__review-items">
											<summary>
												<?php echo esc_html( $row['items_label'] ); ?>
												<span aria-hidden="true"><?php echo esc_html( '(' . count( $row['items'] ) . ')' ); ?></span>
											</summary>
											<ul>
												<?php foreach ( $row['items'] as $item ) : ?>
													<li><strong><?php echo esc_html( $item['label'] ); ?></strong><span><?php echo esc_html( $item['value'] ); ?></span></li>
												<?php endforeach; ?>
											</ul>
										</details>
									<?php endif; ?>
								</dd>
								<dd class="wpbc_setup_wizard__review-row-action">
									<button type="button" class="button button-link wpbc_setup_wizard__review-edit" data-wpbc-setup-wizard-edit-step="<?php echo esc_attr( $row['step_id'] ); ?>">
										<?php esc_html_e( 'Edit', 'booking' ); ?>
										<span class="screen-reader-text"> <?php echo esc_html( $row['label'] ); ?></span>
									</button>
								</dd>
							</div>
						<?php endforeach; ?>
					</dl>
				</section>
			<?php endforeach; ?>

			<?php if ( 'failed' === ( isset( $email_state['status'] ) ? $email_state['status'] : '' ) || '' !== $email_error ) : ?>
				<p class="wpbc_setup_wizard__message wpbc_setup_wizard__message--warning wpbc_setup_wizard__review-status" role="status">
					<i class="menu_icon icon-1x wpbc_icn_warning_amber" aria-hidden="true"></i>
					<span><?php esc_html_e( 'Your setup is ready to review, but the optional setup-details feedback failed. Reload this page to retry.', 'booking' ); ?></span>
				</p>
			<?php endif; ?>

			<?php if ( $is_completed ) : ?>
				<p class="wpbc_setup_wizard__message wpbc_setup_wizard__message--info wpbc_setup_wizard__review-status" role="status">
					<i class="menu_icon icon-1x wpbc_icn_check_circle" aria-hidden="true"></i>
					<span><?php esc_html_e( 'This Setup Wizard route was revalidated and completed. Settings and publishing changes saved on earlier steps remain active.', 'booking' ); ?></span>
				</p>
			<?php endif; ?>
		</div>
	</form>
</section>
