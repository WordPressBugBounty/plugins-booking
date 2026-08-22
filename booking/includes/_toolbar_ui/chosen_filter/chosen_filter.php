<?php
/**
 * Reusable Chosen select component for Booking Calendar administration pages.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Enqueue the reusable Chosen filter assets.
 *
 * The function is public so future administration pages can load the component
 * without depending on the Booking Listing page. Repeated calls are safe because
 * WordPress de-duplicates registered handles.
 *
 * @return void
 */
function wpbc_ui_chosen_filter_enqueue_assets() {
	$asset_url = trailingslashit( plugins_url( '', __FILE__ ) );

	wp_enqueue_style(
		'wpbc-ui-chosen-filter',
		$asset_url . '_out/chosen_filter.css',
		array( 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
	wp_enqueue_script(
		'wpbc-ui-chosen-filter',
		$asset_url . '_out/chosen_filter.js',
		array( 'jquery', 'wpbc-chosen' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => WPBC_JS_IN_FOOTER )
	);
}

/**
 * Load Chosen filter assets on Booking Calendar's booking administration page.
 *
 * Providers use the component in commercial editions and Appointment Services
 * use it in every edition as released 11.5 functionality.
 *
 * @param string $where_to_load Booking Calendar asset context.
 *
 * @return void
 */
function wpbc_ui_chosen_filter_enqueue_booking_page_assets( $where_to_load ) {
	if (
		! is_admin()
		|| ! in_array( $where_to_load, array( 'admin', 'both' ), true )
		|| ! function_exists( 'wpbc_is_bookings_page' )
		|| ! wpbc_is_bookings_page()
	) {
		return;
	}

	wpbc_ui_chosen_filter_enqueue_assets();
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_ui_chosen_filter_enqueue_booking_page_assets', 49 );
add_action( 'wpbc_enqueue_css_files', 'wpbc_ui_chosen_filter_enqueue_booking_page_assets', 49 );

/**
 * Normalize one or many selected values for a Chosen select renderer.
 *
 * @param mixed $selected_values Scalar or array supplied by a saved request.
 * @param bool  $is_multiple     Whether the rendered select accepts many values.
 *
 * @return mixed Array for a multiple select, or the original scalar for a single select.
 */
function wpbc_ui_chosen_filter_normalize_selected_values( $selected_values, $is_multiple ) {
	if ( ! $is_multiple ) {
		return is_array( $selected_values ) ? reset( $selected_values ) : $selected_values;
	}

	if ( null === $selected_values || '' === $selected_values ) {
		return array();
	}

	return is_array( $selected_values ) ? array_values( $selected_values ) : array( $selected_values );
}

/**
 * Return a reusable searchable Chosen filter.
 *
 * This component owns presentation and generic selection behavior only. Callers
 * remain responsible for loading authorized options and interpreting the value.
 * When `listing_param` is provided, the Booking Listing adapter reads the data
 * attributes and submits the selected value through its existing AJAX pipeline.
 *
 * @param array<string,mixed> $arguments {
 *     Component arguments.
 *
 *     @type string               $id                    Required HTML identifier.
 *     @type string               $name                  Select name. Defaults to `id`.
 *     @type array<mixed>         $options               Options accepted by `wpbc_flex_select()`.
 *     @type mixed                $selected_values       Current selected scalar or values.
 *     @type bool                 $multiple              Whether several values may be selected.
 *     @type string               $placeholder           Empty selection label.
 *     @type string               $clear_label           Accessible clear-button label.
 *     @type string               $no_results_text       Message shown when searching has no matches.
 *     @type bool                 $disabled              Whether the select is disabled.
 *     @type string               $container_class       Additional wrapper classes.
 *     @type array<string,string> $attributes            Additional select attributes.
 *     @type string               $listing_param         Optional Booking Listing request key.
 *     @type string               $listing_value_type    `integer`, `integer_array`, `digit_or_csd_array`, or `string`.
 *     @type mixed                $empty_request_value   Request value used when the selection is empty.
 *     @type array<mixed>         $clear_selected_values Values selected in the UI by the clear button.
 *     @type array<mixed>         $exclusive_values      Values that cannot coexist with other choices.
 *     @type string               $exclusive_message     Optional warning after resolving an exclusive choice.
 * }
 *
 * @return string Component HTML, or an empty string when the identifier is invalid.
 */
function wpbc_ui_chosen_filter_get_html( $arguments ) {
	$defaults = array(
		'id'                    => '',
		'name'                  => '',
		'options'               => array(),
		'selected_values'       => array(),
		'multiple'              => true,
		'placeholder'           => '',
		'clear_label'           => __( 'Clear selection', 'booking' ),
		'no_results_text'       => __( 'No results matched', 'booking' ),
		'disabled'              => false,
		'container_class'       => '',
		'attributes'            => array(),
		'listing_param'         => '',
		'listing_value_type'    => 'string',
		'empty_request_value'   => '',
		'clear_selected_values' => array(),
		'exclusive_values'      => array(),
		'exclusive_message'     => '',
	);
	$arguments = wp_parse_args( $arguments, $defaults );
	$element_id = sanitize_key( $arguments['id'] );
	if ( '' === $element_id ) {
		return '';
	}

	$is_multiple   = ! empty( $arguments['multiple'] );
	$element_name  = '' !== $arguments['name'] ? sanitize_key( $arguments['name'] ) : $element_id;
	$selected      = wpbc_ui_chosen_filter_normalize_selected_values( $arguments['selected_values'], $is_multiple );
	$select_attrs  = is_array( $arguments['attributes'] ) ? $arguments['attributes'] : array();
	$select_attrs['data-wpbc-chosen-filter']          = '1';
	$select_attrs['data-wpbc-chosen-no-results-text'] = sanitize_text_field( $arguments['no_results_text'] );
	$select_attrs['data-wpbc-chosen-clear-values']    = wp_json_encode( array_values( (array) $arguments['clear_selected_values'] ) );
	$select_attrs['data-wpbc-chosen-exclusive-values'] = wp_json_encode( array_values( (array) $arguments['exclusive_values'] ) );
	if ( '' !== $arguments['exclusive_message'] ) {
		$select_attrs['data-wpbc-chosen-exclusive-message'] = sanitize_text_field( $arguments['exclusive_message'] );
	}
	if ( '' !== $arguments['listing_param'] ) {
		$select_attrs['data-wpbc-listing-filter-param']       = sanitize_key( $arguments['listing_param'] );
		$select_attrs['data-wpbc-listing-filter-value-type']  = sanitize_key( $arguments['listing_value_type'] );
		$select_attrs['data-wpbc-listing-filter-empty-value'] = wp_json_encode( $arguments['empty_request_value'] );
	}

	$additional_container_classes = preg_split( '/\s+/', trim( (string) $arguments['container_class'] ) );
	$additional_container_classes = is_array( $additional_container_classes )
		? array_filter( array_map( 'sanitize_html_class', $additional_container_classes ) )
		: array();
	$container_classes            = array_merge(
		array(
			'wpbc_ui_el',
			'wpbc_ui_el__choosen',
			'wpbc_ui_el__choosen_' . $element_id,
		),
		$additional_container_classes
	);
	$select_attrs['data-placeholder'] = sanitize_text_field( $arguments['placeholder'] );
	if ( ! isset( $select_attrs['aria-label'] ) ) {
		$select_attrs['aria-label'] = sanitize_text_field( $arguments['placeholder'] );
	}

	ob_start();
	?>
	<div class="<?php echo esc_attr( implode( ' ', $container_classes ) ); ?>" data-wpbc-chosen-filter-container="<?php echo esc_attr( $element_id ); ?>">
		<?php
		wpbc_flex_select(
			array(
				'id'               => $element_id,
				'name'             => $element_name,
				'label'            => '',
				'class'            => 'chzn-select wpbc_ui_el__choosen_select',
				'multiple'         => $is_multiple,
				'attr'             => $select_attrs,
				'disabled'         => ! empty( $arguments['disabled'] ),
				'disabled_options' => array(),
				'options'          => is_array( $arguments['options'] ) ? $arguments['options'] : array(),
				'value'            => $selected,
				'style'            => 'display:none;',
			)
		);
		?>
		<div class="wpbc_ui_el__choosen_reset_buttons">
			<input type="hidden" name="blank_field__this_field_only_for_formatting_buttons" value="">
			<button type="button"
				class="wpbc_ui_el__choosen_reset_button tooltip_top"
				data-wpbc-chosen-clear="<?php echo esc_attr( $element_id ); ?>"
				data-original-title="<?php echo esc_attr( $arguments['clear_label'] ); ?>"
				aria-label="<?php echo esc_attr( $arguments['clear_label'] ); ?>"
			>
				<i class="wpbc_icn_close" aria-hidden="true"></i>
			</button>
		</div>
	</div>
	<?php

	return ob_get_clean();
}
