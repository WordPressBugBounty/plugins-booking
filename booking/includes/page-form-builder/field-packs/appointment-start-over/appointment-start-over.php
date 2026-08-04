<?php
/**
 * WPBC BFB Pack: Appointment Start Over button.
 *
 * The exported control is declarative. The public Appointment controller owns
 * its behavior and restarts only the closest [booking_appointment] instance.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the Appointment Start Over field schema and Inspector controls.
 *
 * @param array $packs Registered Builder field packs.
 *
 * @return array Updated field packs.
 */
function wpbc_bfb_register_field_packs__appointment_start_over( $packs ) {
	$packs['appointment_start_over'] = array(
		'kind'      => 'field',
		'type'      => 'appointment_start_over',
		'label'     => __( 'Start Over Button', 'booking' ),
		'icon'      => 'wpbc-bi-arrow-counterclockwise',
		'usage_key' => 'appointment_start_over',
		'schema'    => array(
			'props' => array(
				'label'          => array( 'type' => 'string', 'default' => __( 'Start over', 'booking' ) ),
				'cssclass_extra' => array( 'type' => 'string', 'default' => '' ),
				'html_id'        => array( 'type' => 'string', 'default' => '' ),
				'help'           => array( 'type' => 'string', 'default' => '' ),
			),
		),
		'inspector_ui' => array(
			'title'          => __( 'Start Over Button', 'booking' ),
			'description'    => __( 'Return the customer to the first available step of the Appointment selector.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Basic', 'booking' ),
					'open'     => true,
					'controls' => array(
						array( 'type' => 'text', 'key' => 'label', 'label' => __( 'Label', 'booking' ) ),
						array(
							'type'  => 'textarea',
							'key'   => 'help',
							'label' => __( 'Help text', 'booking' ),
							'rows'  => 3,
						),
					),
				),
				array(
					'key'      => 'appearance',
					'label'    => __( 'Advanced', 'booking' ),
					'controls' => array(
						array( 'type' => 'text', 'key' => 'cssclass_extra', 'label' => __( 'Extra CSS classes', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'html_id', 'label' => __( 'HTML ID', 'booking' ) ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__appointment_start_over' );

/**
 * Enqueue the Appointment Start Over renderer and exporters in Form Builder.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__appointment_start_over_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_appointment_start_over',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/appointment-start-over/_out/appointment-start-over.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__appointment_start_over_js', 10, 1 );

/**
 * Add the Appointment Start Over item to the navigation palette.
 *
 * @param string $group    Palette group.
 * @param string $position Position inside the group.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__appointment_start_over( $group, $position ) {
	if ( 'navigation' !== $group || 'top' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="appointment_start_over"
		data-type="appointment_start_over"
		data-usage_key="appointment_start_over"
		data-label="<?php echo esc_attr( __( 'Start over', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc-bi-arrow-counterclockwise"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Start Over', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type"><?php echo esc_html__( 'Appointment', 'booking' ); ?></span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__appointment_start_over', 10, 2 );
