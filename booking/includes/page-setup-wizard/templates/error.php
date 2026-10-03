<?php
/**
 * Safe Setup Wizard template error state.
 *
 * @package Booking Calendar
 * @var array<string,string> $template_context Authorized error context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="notice notice-error inline" role="alert">
	<p><?php echo esc_html( $template_context['message'] ); ?></p>
</div>
