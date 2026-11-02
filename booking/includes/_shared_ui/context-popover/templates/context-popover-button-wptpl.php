<?php
/**
 * Shared administration control-button WordPress template.
 *
 * The executable-free model accepts a stable action ID, plain-text labels,
 * one sanitized icon-class list, and disabled presentation state. Domain
 * behavior and authorization remain in the caller.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<script type="text/html" id="tmpl-wpbc-shared-ui-context-popover-button">
	<#
	var component_id = String( data.id || '' ).replace( /[^A-Za-z0-9_-]/g, '' );
	var icon_class = String( data.icon_class || '' ).replace( /[^A-Za-z0-9_\- ]/g, '' ).replace( /\s+/g, ' ' ).trim();
	var label = String( data.label || '' );
	var description = String( data.description || label );
	var is_disabled = true === data.disabled;
	#>
	<button
		type="button"
		class="wpbc_shared_ui_context_popover__control_button"
		data-wpbc-shared-ui-context-popover-button="{{ component_id }}"
		aria-label="{{ description }}"
		title="{{ description }}"
		<# if ( is_disabled ) { #>disabled aria-disabled="true"<# } #>
	>
		<# if ( icon_class ) { #><i class="{{ icon_class }}" aria-hidden="true"></i><# } #>
		<span>{{ label }}</span>
	</button>
</script>
