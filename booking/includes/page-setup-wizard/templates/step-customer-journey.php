<?php
/**
 * Phase 3 Page 5 customer-journey chooser.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized step context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data        = $template_context['step_data'];
$selected_journey = $step_data['values']['customer_journey'];
?>
<section class="wpbc_setup_wizard__step-content" aria-labelledby="wpbc-setup-wizard-step-title">
	<header class="wpbc_setup_wizard__step-heading">
		<h1 id="wpbc-setup-wizard-step-title"><?php esc_html_e( 'How should customer booking work?', 'booking' ); ?></h1>
		<p class="wpbc_setup_wizard__lead"><?php esc_html_e( 'Choose the customer journey that best matches your business. You can change this later.', 'booking' ); ?></p>
	</header>

	<form id="wpbc-setup-wizard-step-form" novalidate>
		<fieldset class="wpbc_setup_wizard__experience-fieldset" data-wpbc-setup-wizard-fields>
			<legend class="screen-reader-text"><?php esc_html_e( 'Choose a customer journey', 'booking' ); ?></legend>
			<div class="wpbc_setup_wizard__journey-groups" data-wpbc-selected-booking-mode="<?php echo esc_attr( $step_data['selected_booking_mode_id'] ); ?>">
				<?php foreach ( $step_data['journey_groups'] as $journey_group ) : ?>
					<?php
					$group_heading_id = 'wpbc-setup-wizard-journey-group-' . $journey_group['id'];
					?>
					<section
						class="wpbc_setup_wizard__journey-group<?php echo $journey_group['is_additional'] ? ' wpbc_setup_wizard__journey-group--additional' : ' wpbc_setup_wizard__journey-group--recommended'; ?>"
						aria-labelledby="<?php echo esc_attr( $group_heading_id ); ?>"
					>
						<header class="wpbc_setup_wizard__journey-group-heading">
							<h2 id="<?php echo esc_attr( $group_heading_id ); ?>"><?php echo esc_html( $journey_group['label'] ); ?></h2>
							<p><?php echo esc_html( $journey_group['description'] ); ?></p>
						</header>
						<div class="wpbc_setup_wizard__journey-option-list">
							<?php foreach ( $journey_group['journeys'] as $journey ) : ?>
								<?php
								$edition_requirement = isset( $journey['edition_requirement'] ) && is_array( $journey['edition_requirement'] )
									? $journey['edition_requirement']
									: array();
								$is_available        = ! empty( $edition_requirement['is_available'] );
								$is_selected         = $is_available && $selected_journey === $journey['id'];
								$disabled_reason     = ! empty( $edition_requirement['disabled_reason'] ) ? (string) $edition_requirement['disabled_reason'] : '';
								$step_count          = count( $journey['journey'] );
								?>
								<label
									class="wpbc_setup_wizard__experience-card wpbc_setup_wizard__journey-option-card<?php echo $journey_group['is_additional'] ? ' is-additional' : ''; ?><?php echo $is_selected ? ' is-selected' : ''; ?><?php echo $is_available ? '' : ' is-locked'; ?>"
									data-wpbc-customer-journey-branches="<?php echo esc_attr( implode( ' ', $journey['branches'] ) ); ?>"
									data-wpbc-customer-journey-priority="<?php echo $journey_group['is_additional'] ? 'additional' : 'recommended'; ?>"
									data-wpbc-customer-journey-id="<?php echo esc_attr( $journey['id'] ); ?>"
									<?php if ( ! $is_available ) : ?>aria-disabled="true" title="<?php echo esc_attr( $disabled_reason ); ?>"<?php endif; ?>
								>
									<span class="wpbc_setup_wizard__journey-option-summary">
										<span class="wpbc_setup_wizard__experience-choice">
											<input
												class="screen-reader-text"
												type="radio"
												name="customer_journey"
												value="<?php echo esc_attr( $journey['id'] ); ?>"
												<?php checked( $is_selected ); ?>
												<?php disabled( ! $is_available ); ?>
												required
												data-wpbc-setup-wizard-field
												aria-describedby="wpbc-setup-wizard-customer-journey-error"
											>
											<span class="wpbc_setup_wizard__radio-mark" aria-hidden="true"></span>
											<strong class="wpbc_setup_wizard__experience-title"><?php echo esc_html( $journey['title'] ); ?></strong>
											<?php if ( ! empty( $edition_requirement['badge_label'] ) ) : ?>
												<span class="wpbc_setup_wizard__journey-edition-badge">
													<?php echo esc_html( $edition_requirement['badge_label'] ); ?>
													<?php if ( ! $is_available ) : ?>
														<span class="screen-reader-text"><?php echo esc_html( $disabled_reason ); ?></span>
													<?php endif; ?>
												</span>
											<?php endif; ?>
										</span>
										<span class="wpbc_setup_wizard__journey-option-description"><?php echo esc_html( $journey['description'] ); ?></span>
									</span>

									<span class="wpbc_setup_wizard__journey wpbc_setup_wizard__journey--<?php echo esc_attr( (string) $step_count ); ?>" aria-hidden="true">
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
									</span>

									<span class="wpbc_setup_wizard__journey-option-best-for">
										<strong><?php esc_html_e( 'Best for:', 'booking' ); ?></strong>
										<span><?php echo esc_html( $journey['best_for'] ); ?></span>
									</span>
								</label>
							<?php endforeach; ?>
						</div>
					</section>
				<?php endforeach; ?>
			</div>
			<span class="wpbc_setup_wizard__field-error wpbc_setup_wizard__field-error--group" id="wpbc-setup-wizard-customer-journey-error" data-wpbc-setup-wizard-error-for="customer_journey"></span>
		</fieldset>
	</form>
</section>
