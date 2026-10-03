<?php
/**
 * Shared later-settings breadcrumb for Setup Wizard steps.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized hint context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$settings_hint    = isset( $template_context['settings_hint'] ) && is_array( $template_context['settings_hint'] )
	? $template_context['settings_hint']
	: array();
$message          = isset( $settings_hint['message'] ) && is_scalar( $settings_hint['message'] ) ? (string) $settings_hint['message'] : '';
$links            = isset( $settings_hint['links'] ) && is_array( $settings_hint['links'] ) ? $settings_hint['links'] : array();
$renderable_links = array();

foreach ( $links as $link ) {
	$link_label = isset( $link['label'] ) && is_scalar( $link['label'] ) ? (string) $link['label'] : '';
	$link_url   = isset( $link['url'] ) && is_scalar( $link['url'] ) ? (string) $link['url'] : '';
	if ( '' !== $link_label && '' !== $link_url ) {
		$renderable_links[] = array(
			'label' => $link_label,
			'url'   => $link_url,
		);
	}
}

if ( '' !== $message && ! empty( $renderable_links ) ) :
	?>
	<aside class="wpbc_setup_wizard__settings-hint" role="note">
		<span class="wpbc_setup_wizard__settings-hint-message"><?php echo esc_html( $message ); ?> <span aria-hidden="true">&mdash;</span></span>
		<nav class="wpbc_setup_wizard__settings-hint-path" aria-label="<?php esc_attr_e( 'Where to change these settings later', 'booking' ); ?>">
			<?php foreach ( $renderable_links as $link_index => $link ) : ?>
				<?php if ( 0 < $link_index ) : ?>
					<span class="wpbc_setup_wizard__settings-hint-separator" aria-hidden="true">&rsaquo;</span>
				<?php endif; ?>
				<a href="<?php echo esc_url( $link['url'] ); ?>"><?php echo esc_html( $link['label'] ); ?></a>
			<?php endforeach; ?>
		</nav>
	</aside>
	<?php
endif;
