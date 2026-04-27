<?php
/**
 * Front-end date hints for Booking Calendar Free.
 *
 * This small layer supports lightweight date-selection hints without loading the
 * Business Medium cost-calculation pipeline. Business Medium and higher keep
 * using their existing implementation.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// FixIn: 10.15.6.2.

/**
 * Free date hints runtime.
 */
class WPBC_Free_Date_Hints {

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	public static function init() {

		add_bk_filter( 'wpbc_update_bookingform_content__after_load', array( __CLASS__, 'replace_hints_in_form' ) );
		add_filter( 'wpbc_booking_form_content__after_load', array( __CLASS__, 'replace_hints_in_form' ), 10, 3 );

		add_bk_action( 'wpdev_ajax_show_cost', array( __CLASS__, 'ajax_show_hints' ) );

		add_action( 'wpbc_enqueue_js_files', array( __CLASS__, 'enqueue_js' ), 10, 1 );
	}

	/**
	 * Is this Free implementation active?
	 *
	 * @return bool
	 */
	private static function is_active() {

		return ! class_exists( 'wpdev_bk_biz_m' );
	}

	/**
	 * Hint definitions supported by this Free module.
	 *
	 * Add future date/time hint shortcodes here.
	 *
	 * @return array
	 */
	private static function get_hint_definitions() {

		return array(
			'check_in_date_hint' => array(
				'default' => '...',
			),
			'check_out_date_hint' => array(
				'default' => '...',
			),
			'selected_dates_hint' => array(
				'default' => '...',
			),
			'days_number_hint' => array(
				'default' => '0',
			),
			'start_time_hint' => array(
				'default' => '...',
			),
			'end_time_hint' => array(
				'default' => '...',
			),
		);
	}

	/**
	 * Enqueue front-end JS.
	 *
	 * @param string $where_to_load Loading context.
	 *
	 * @return void
	 */
	public static function enqueue_js( $where_to_load ) {

		if ( ! self::is_active() ) {
			return;
		}

		if ( ! in_array( $where_to_load, array( 'client', 'both' ), true ) ) {
			return;
		}

		wp_enqueue_script(
			'wpbc-free-date-hints',
			wpbc_plugin_url( '/js/wpbc-free-date-hints.js' ),
			array( 'jquery', 'wpbc_capacity' ),
			WP_BK_VERSION_NUM,
			array( 'in_footer' => WPBC_JS_IN_FOOTER )
		);
	}

	/**
	 * Replace supported hint shortcodes in booking form markup.
	 *
	 * @param string $form_content Booking form markup.
	 * @param int    $resource_id  Booking resource ID.
	 * @param string $form_slug    Booking form slug.
	 *
	 * @return string
	 */
	public static function replace_hints_in_form( $form_content, $resource_id = 1, $form_slug = 'standard' ) {

		if ( ! self::is_active() ) {
			return $form_content;
		}

		$resource_id = (int) $resource_id;

		foreach ( self::get_hint_definitions() as $hint_name => $hint_params ) {
			$form_content = self::replace_single_hint_shortcode(
				$form_content,
				array(
					'shortcode'  => '[' . $hint_name . ']',
					'span_class' => $hint_name . '_tip' . $resource_id,
					'span_value' => $hint_params['default'],
					'input_name' => $hint_name . $resource_id,
					'input_data' => $hint_params['default'],
				)
			);
		}

		return $form_content;
	}

	/**
	 * Replace one hint shortcode, preserving support for repeated usage.
	 *
	 * The first occurrence receives a stable ID and hidden input; additional
	 * occurrences receive the same class, matching the Pro hint convention.
	 *
	 * @param string $form_content Booking form markup.
	 * @param array  $params       Replacement params.
	 *
	 * @return string
	 */
	private static function replace_single_hint_shortcode( $form_content, $params ) {

		$shortcode = str_replace( array( '[', ']' ), '', $params['shortcode'] );
		$pattern   = '/\[' . preg_quote( $shortcode, '/' ) . '\]/';

		$first_html = '<span class="wpbc_field_hint wpbc_free_date_hint" id="' . esc_attr( $params['span_class'] ) . '">' . esc_html( $params['span_value'] ) . '</span>' .
			'<input class="wpbc_field_hint wpbc_free_date_hint" id="' . esc_attr( $params['input_name'] ) . '" name="' . esc_attr( $params['input_name'] ) . '" value="' . esc_attr( $params['input_data'] ) . '" style="display:none;" type="text" />';

		$form_content = preg_replace( $pattern, $first_html, $form_content, 1 );

		$other_html = '<span class="wpbc_field_hint wpbc_free_date_hint ' . esc_attr( $params['span_class'] ) . '">' . esc_html( $params['span_value'] ) . '</span>';

		return str_replace( '[' . $shortcode . ']', $other_html, $form_content );
	}

	/**
	 * AJAX responder for Free date hints.
	 *
	 * @return void
	 */
	public static function ajax_show_hints() {

		if ( ! self::is_active() ) {
			return;
		}

		$default_resource_id = 1;
		if ( class_exists( 'WPBC_FE_Attr_Postprocessor' ) && method_exists( 'WPBC_FE_Attr_Postprocessor', 'get_default_booking_resource_id' ) ) {
			$default_resource_id = WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id();
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$resource_id = isset( $_POST['bk_type'] ) ? intval( $_POST['bk_type'] ) : $default_resource_id;

		make_bk_action( 'check_multiuser_params_for_client_side', $resource_id );

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$selected_dates = isset( $_POST['all_dates'] ) ? sanitize_text_field( wp_unslash( $_POST['all_dates'] ) ) : '';

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$form_data = isset( $_POST['form'] ) ? sanitize_text_field( wp_unslash( $_POST['form'] ) ) : '';

		$hints = self::calculate_hints( $selected_dates, $resource_id, $form_data );

		self::print_update_script( $resource_id, $hints );
	}

	/**
	 * Calculate supported hint values.
	 *
	 * @param string $selected_dates Selected dates in dd.mm.yyyy CSV/range format.
	 * @param int    $resource_id    Booking resource ID.
	 * @param string $form_data      Serialized booking form data.
	 *
	 * @return array
	 */
	private static function calculate_hints( $selected_dates, $resource_id, $form_data ) {

		$hints = array();
		foreach ( self::get_hint_definitions() as $hint_name => $hint_params ) {
			$hints[ $hint_name ] = $hint_params['default'];
		}

		$selected_dates = trim( (string) $selected_dates );
		if ( '' === $selected_dates || false !== strpos( $selected_dates, '13.01.2981' ) ) {
			return $hints;
		}

		$dates_in_diff_formats = wpbc_get_dates_in_diff_formats( $selected_dates, $resource_id, $form_data );
		if ( empty( $dates_in_diff_formats['array'] ) || ! is_array( $dates_in_diff_formats['array'] ) ) {
			return $hints;
		}

		$only_dates = array_values( array_unique( array_filter( $dates_in_diff_formats['array'] ) ) );
		if ( empty( $only_dates ) ) {
			return $hints;
		}

		$selected_dates_localized = array();
		$only_full_days           = array();

		foreach ( $only_dates as $day ) {
			$only_full_days[]           = $day . ' 00:00:00';
			$selected_dates_localized[] = wpbc_get_dates_comma_string_localized( $day . ' 00:00:00' );
		}

		$hints['check_in_date_hint']  = wpbc_get_dates_comma_string_localized( $only_full_days[0] );
		$hints['check_out_date_hint'] = wpbc_get_dates_comma_string_localized( $only_full_days[ count( $only_full_days ) - 1 ] );
		$hints['selected_dates_hint'] = implode( ', ', $selected_dates_localized );
		$hints['days_number_hint']    = (string) count( $selected_dates_localized );

		$start_time = $dates_in_diff_formats['start_time'];
		$end_time   = $dates_in_diff_formats['end_time'];

		if ( ( ! isset( $start_time[0] ) ) || ( '' === $start_time[0] ) ) {
			$start_time[0] = '00';
		}
		if ( ( ! isset( $start_time[1] ) ) || ( '' === $start_time[1] ) ) {
			$start_time[1] = '00';
		}
		if ( ( ! isset( $start_time[2] ) ) || ( '' === $start_time[2] ) ) {
			$start_time[2] = '00';
		}
		if ( ( ! isset( $end_time[0] ) ) || ( '' === $end_time[0] ) ) {
			$end_time[0] = '00';
		}
		if ( ( ! isset( $end_time[1] ) ) || ( '' === $end_time[1] ) ) {
			$end_time[1] = '00';
		}
		if ( ( ! isset( $end_time[2] ) ) || ( '' === $end_time[2] ) ) {
			$end_time[2] = '00';
		}

		$hints['start_time_hint'] = wpbc_time_localized( implode( ':', $start_time ) );
		$hints['end_time_hint']   = wpbc_time_localized( implode( ':', $end_time ) );

		return $hints;
	}

	/**
	 * Print JavaScript that applies calculated hint values.
	 *
	 * @param int   $resource_id Booking resource ID.
	 * @param array $hints       Calculated hint values.
	 *
	 * @return void
	 */
	private static function print_update_script( $resource_id, $hints ) {

		?>
		<script type="text/javascript">
			(function ( w, $ ) {
				var resourceId = <?php echo wp_json_encode( (int) $resource_id ); ?>;
				var hints = <?php echo wp_json_encode( $hints ); ?>;

				if ( w.wpbc_free_date_hints__apply ) {
					w.wpbc_free_date_hints__apply( resourceId, hints );
					return;
				}

				$.each( hints, function ( hintName, hintValue ) {
					$( '#' + hintName + '_tip' + resourceId + ',.' + hintName + '_tip' + resourceId ).html( hintValue );
					$( '#' + hintName + resourceId ).val( $( '<div />' ).html( hintValue ).text() );
				} );
			})( window, jQuery );
		</script>
		<?php
	}
}

WPBC_Free_Date_Hints::init();
