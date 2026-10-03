<?php
/**
 * Preview-only Booking Mode selector for Setup Wizard Step 4.
 *
 * @package Booking Calendar
 * @var array<string,mixed> $template_context Authorized toolbar context.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$step_data           = isset( $template_context['step_data'] ) && is_array( $template_context['step_data'] ) ? $template_context['step_data'] : array();
$experiences         = isset( $step_data['experiences'] ) && is_array( $step_data['experiences'] ) ? $step_data['experiences'] : array();
$selected_mode_id    = isset( $step_data['values']['booking_experience'] ) ? sanitize_key( (string) $step_data['values']['booking_experience'] ) : '';
$selected_mode_title = '';
$selector_items      = array();

foreach ( $experiences as $experience ) {
	if ( ! is_array( $experience ) || empty( $experience['id'] ) || empty( $experience['toolbar_label'] ) || empty( $experience['toolbar_title'] ) ) {
		continue;
	}

	$mode_id       = sanitize_key( (string) $experience['id'] );
	$toolbar_label = sanitize_text_field( (string) $experience['toolbar_label'] );
	$toolbar_title = sanitize_text_field( (string) $experience['toolbar_title'] );
	$is_selected   = $selected_mode_id === $mode_id;
	$attributes    = array(
		'class'                                      => 'wpbc_setup_wizard__mode-toolbar-option' . ( $is_selected ? ' is-current' : '' ),
		'data-wpbc-setup-wizard-mode-toolbar-option' => $mode_id,
		'data-wpbc-setup-wizard-mode-toolbar-title'  => $toolbar_title,
		'role'                                       => 'menuitemradio',
		'aria-checked'                               => $is_selected ? 'true' : 'false',
	);

	if ( $is_selected ) {
		$selected_mode_title = $toolbar_title;
	}

	$selector_items[] = array(
		'type'  => 'link',
		'title' => $toolbar_label,
		'url'   => '#',
		'attr'  => $attributes,
	);
}

if ( empty( $selector_items ) ) {
	return;
}

if ( '' === $selected_mode_title ) {
	$selected_mode_title = (string) $selector_items[0]['attr']['data-wpbc-setup-wizard-mode-toolbar-title'];
}
?>
<div class="wpbc_setup_wizard__mode-toolbar-preview" data-wpbc-setup-wizard-mode-toolbar>
	<?php
	wpbc_ui_el__divider_vertical(
		array(
			'class' => 'wpbc_booking_modes_toolbar_divider wpbc_ui_el__vertical_line',
		)
	);
	wpbc_ui_el__dropdown_menu(
		array(
			'title_html'      => '<span class="nav-tab-text" data-wpbc-setup-wizard-mode-toolbar-label>' . esc_html( $selected_mode_title ) . '</span>',
			'has_border'      => false,
			'class'           => 'wpbc_booking_modes_toggle wpbc_setup_wizard__mode-toolbar-toggle',
			'container_class' => 'wpbc_booking_modes_selector wpbc_setup_wizard__mode-toolbar-selector',
			'attr'            => array(
				'aria-label' => __( 'Booking Calendar administration mode preview', 'booking' ),
			),
			'items'           => $selector_items,
		)
	);
	?>
	<div
		class="wpbc_setup_wizard__mode-toolbar-tooltip"
		data-wpbc-setup-wizard-mode-toolbar-tooltip
		role="status"
		aria-live="polite"
		aria-hidden="true"
	>
		<?php esc_html_e( 'You can change the Booking Mode here at any time after setup.', 'booking' ); ?>
	</div>
</div>
