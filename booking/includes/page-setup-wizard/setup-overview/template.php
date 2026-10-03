<?php
/**
 * Completed Setup Wizard overview template.
 *
 * @package Booking Calendar
 *
 * @var array<string,mixed> $overview Authorized presentation data.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$overview             = isset( $overview ) && is_array( $overview ) ? $overview : array();
$checkpoint           = isset( $overview['checkpoint'] ) && is_array( $overview['checkpoint'] ) ? $overview['checkpoint'] : array();
$groups               = isset( $overview['groups'] ) && is_array( $overview['groups'] ) ? $overview['groups'] : array();
$publishing_allowed   = ! empty( $overview['publishing_allowed'] );
$publishing_url       = isset( $overview['publishing_url'] ) ? (string) $overview['publishing_url'] : '';
$expected_revision    = isset( $checkpoint['revision'] ) ? absint( $checkpoint['revision'] ) : 0;
$admin_post_url       = isset( $overview['admin_post_url'] ) ? (string) $overview['admin_post_url'] : admin_url( 'admin-post.php' );
$notice               = isset( $overview['notice'] ) && is_array( $overview['notice'] ) ? $overview['notice'] : array();
$published_page_count = isset( $overview['published_page_count'] ) ? absint( $overview['published_page_count'] ) : 0;
$action_nonce         = wp_create_nonce( WPBC_Setup_Wizard_Setup_Overview_Actions::NONCE_ACTION );
?>

<div class="wpbc_setup_overview">
	<?php if ( ! empty( $notice['text'] ) ) : ?>
		<div class="notice notice-<?php echo esc_attr( isset( $notice['type'] ) ? sanitize_html_class( $notice['type'] ) : 'info' ); ?> is-dismissible" role="status">
			<p><?php echo esc_html( $notice['text'] ); ?></p>
		</div>
	<?php endif; ?>

	<section class="wpbc_setup_overview__actions" aria-label="<?php esc_attr_e( 'Setup actions', 'booking' ); ?>">
		<div class="wpbc_setup_overview__action">
			<form
				method="post"
				action="<?php echo esc_url( $admin_post_url ); ?>"
				data-wpbc-setup-overview-restart-form
				data-confirm-message="<?php esc_attr_e( 'Start a new setup? This restarts wizard navigation and recommendations, but it does not undo settings already saved in Booking Calendar.', 'booking' ); ?>"
			>
				<input type="hidden" name="action" value="<?php echo esc_attr( WPBC_Setup_Wizard_Setup_Overview_Actions::ACTION_RESTART ); ?>">
				<input type="hidden" name="expected_revision" value="<?php echo esc_attr( (string) $expected_revision ); ?>">
				<input type="hidden" name="<?php echo esc_attr( WPBC_Setup_Wizard_Setup_Overview_Actions::NONCE_NAME ); ?>" value="<?php echo esc_attr( $action_nonce ); ?>">
				<button type="submit" class="button button-primary button-hero wpbc_setup_overview__action_button">
					<i class="menu_icon icon-1x wpbc_icn_add" aria-hidden="true"></i>
					<span><?php esc_html_e( 'Start a new setup', 'booking' ); ?></span>
				</button>
			</form>
			<p><?php esc_html_e( 'Review the current configuration again from the first step.', 'booking' ); ?></p>
		</div>

		<div class="wpbc_setup_overview__action">
			<button
				type="button"
				class="button button-hero wpbc_setup_overview__action_button"
				data-wpbc-booking-pages-open-dialog="1"
				aria-haspopup="dialog"
				<?php disabled( 0, $published_page_count ); ?>
			>
				<i class="menu_icon icon-1x wpbc_icn_description" aria-hidden="true"></i>
				<span><?php esc_html_e( 'Test your booking pages', 'booking' ); ?></span>
			</button>
			<p>
				<?php
				if ( $published_page_count ) {
					esc_html_e( 'Open published pages and try each booking experience.', 'booking' );
				} else {
					esc_html_e( 'No validated published booking page was found.', 'booking' );
				}
				?>
			</p>
		</div>

		<div class="wpbc_setup_overview__action">
			<?php if ( $publishing_allowed && '' !== $publishing_url ) : ?>
				<a href="<?php echo esc_url( $publishing_url ); ?>" class="button button-hero wpbc_setup_overview__action_button">
					<i class="menu_icon icon-1x wpbc_icn_code" aria-hidden="true"></i>
					<span><?php esc_html_e( 'Publish or integrate', 'booking' ); ?></span>
				</a>
				<p><?php esc_html_e( 'Add your booking form to a page so customers can book.', 'booking' ); ?></p>
			<?php else : ?>
				<button type="button" class="button button-hero wpbc_setup_overview__action_button" disabled>
					<i class="menu_icon icon-1x wpbc_icn_code" aria-hidden="true"></i>
					<span><?php esc_html_e( 'Publish or integrate', 'booking' ); ?></span>
				</button>
				<p><?php esc_html_e( 'Publishing is unavailable in this temporary environment.', 'booking' ); ?></p>
			<?php endif; ?>
		</div>
	</section>

	<div class="wpbc_setup_overview__table_wrap" role="region" aria-label="<?php esc_attr_e( 'Current Booking Calendar setup', 'booking' ); ?>" tabindex="0">
		<table class="wpbc_setup_overview__table">
			<thead>
				<tr>
					<th scope="col" class="wpbc_setup_overview__number_heading"><?php echo esc_html_x( '#', 'Setup overview group number', 'booking' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Setting', 'booking' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Current choice', 'booking' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Action', 'booking' ); ?></th>
				</tr>
			</thead>
			<tbody>
				<?php foreach ( $groups as $group ) : ?>
					<?php
					$rows      = isset( $group['rows'] ) && is_array( $group['rows'] ) ? $group['rows'] : array();
					$row_count = count( $rows );
					if ( 0 === $row_count ) {
						continue;
					}
					?>
					<?php foreach ( $rows as $row_index => $row ) : ?>
						<?php
						$row          = is_array( $row ) ? $row : array();
						$action       = isset( $row['action'] ) && is_array( $row['action'] ) ? $row['action'] : array();
						$action_type  = isset( $action['type'] ) ? sanitize_key( (string) $action['type'] ) : 'none';
						$summary_type = isset( $row['summary_type'] ) ? sanitize_html_class( (string) $row['summary_type'] ) : 'default';
						?>
						<tr>
							<?php if ( 0 === $row_index ) : ?>
								<th scope="rowgroup" rowspan="<?php echo esc_attr( (string) $row_count ); ?>" class="wpbc_setup_overview__group">
									<div class="wpbc_setup_overview__group_content">
										<span class="wpbc_setup_overview__group_number" aria-hidden="true"><?php echo esc_html( (string) absint( isset( $group['number'] ) ? $group['number'] : 0 ) ); ?></span>
										<div>
											<strong><?php echo esc_html( isset( $group['title'] ) ? $group['title'] : '' ); ?></strong>
											<p><?php echo esc_html( isset( $group['description'] ) ? $group['description'] : '' ); ?></p>
										</div>
									</div>
								</th>
							<?php endif; ?>
							<th scope="row" class="wpbc_setup_overview__setting">
								<span class="wpbc_setup_overview__setting_content">
									<i class="menu_icon icon-1x <?php echo esc_attr( isset( $row['icon'] ) ? $row['icon'] : '' ); ?>" aria-hidden="true"></i>
									<span><?php echo esc_html( isset( $row['label'] ) ? $row['label'] : '' ); ?></span>
								</span>
							</th>
							<td class="wpbc_setup_overview__summary wpbc_setup_overview__summary--<?php echo esc_attr( $summary_type ); ?>">
								<?php echo esc_html( isset( $row['summary'] ) ? $row['summary'] : '' ); ?>
							</td>
							<td class="wpbc_setup_overview__row_action">
								<?php if ( 'link' === $action_type && ! empty( $action['url'] ) ) : ?>
									<a href="<?php echo esc_url( $action['url'] ); ?>"><?php echo esc_html( isset( $action['label'] ) ? $action['label'] : '' ); ?></a>
								<?php elseif ( 'wizard_step' === $action_type && ! empty( $action['step_id'] ) ) : ?>
									<form method="post" action="<?php echo esc_url( $admin_post_url ); ?>">
										<input type="hidden" name="action" value="<?php echo esc_attr( WPBC_Setup_Wizard_Setup_Overview_Actions::ACTION_REOPEN_STEP ); ?>">
										<input type="hidden" name="target_step_id" value="<?php echo esc_attr( $action['step_id'] ); ?>">
										<input type="hidden" name="expected_revision" value="<?php echo esc_attr( (string) $expected_revision ); ?>">
										<input type="hidden" name="<?php echo esc_attr( WPBC_Setup_Wizard_Setup_Overview_Actions::NONCE_NAME ); ?>" value="<?php echo esc_attr( $action_nonce ); ?>">
										<button type="submit" class="button-link"><?php echo esc_html( isset( $action['label'] ) ? $action['label'] : '' ); ?></button>
									</form>
								<?php else : ?>
									<span aria-hidden="true">&mdash;</span><span class="screen-reader-text"><?php esc_html_e( 'No action available', 'booking' ); ?></span>
								<?php endif; ?>
							</td>
						</tr>
					<?php endforeach; ?>
				<?php endforeach; ?>
			</tbody>
		</table>
	</div>
</div>

<?php
if ( $published_page_count && class_exists( 'WPBC_Setup_Wizard_Booking_Pages' ) ) {
	WPBC_Setup_Wizard_Booking_Pages::render_template();
}
?>
