<?php /**
 * @version 1.0
 * @package Booking Calendar
 * @category Reusable Add Booking component
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly.

/**
 * Reusable renderer for the Booking > Add Booking experience.
 *
 * The admin page calls this without args, so legacy $_GET driven behavior stays intact.
 * Future embedded contexts can pass explicit args, which are always preferred over $_GET.
 */
class WPBC_Add_Booking_Component {

	/**
	 * Check if current user can access the Add Booking workflow.
	 *
	 * @return bool
	 */
	public static function current_user_can_add_booking() {

		$user_role = get_bk_option( 'booking_user_role_addbooking' );
		$cap       = 'read';

		if ( class_exists( 'WPBC_Admin_Menus' ) && isset( WPBC_Admin_Menus::$capability[ $user_role ] ) ) {
			$cap = WPBC_Admin_Menus::$capability[ $user_role ];
		} elseif ( class_exists( 'WPBC_Admin_Menus' ) && isset( WPBC_Admin_Menus::$capability['subscriber'] ) ) {
			$cap = WPBC_Admin_Menus::$capability['subscriber'];
		}

		return current_user_can( $cap );
	}

	/**
	 * Render the component and echo by default.
	 *
	 * @param array $args Component options.
	 *
	 * @return string|void
	 */
	public static function render( $args = array() ) {

		$args    = self::normalize_args( $args );
		$is_echo = ( ! empty( $args['is_echo'] ) );

		ob_start();

		?><span class="wpdevelop"><?php                                         // BS UI CSS Class.

		if ( ! empty( $args['is_booking_page_js'] ) ) {
			wpbc_js_for_bookings_page();                                        // JavaScript functions.
		}

		if ( ! empty( $args['is_toolbar_visible'] ) ) {
			wpbc_add_new_booking_toolbar(
				array(
					'resource_id'  => $args['_is_explicit_resource_id'] ? $args['resource_id'] : null,
					'booking_form' => $args['_is_explicit_booking_form'] ? $args['custom_booking_form'] : null,
				)
			);
		}

		?></span><!-- wpdevelop class --><?php

		if ( ! empty( $args['is_show_before_content_spacer'] ) ) {
			?><div class="clear" style="height:40px;"></div><?php
		}

		?><div class="<?php echo esc_attr( $args['content_css_class'] ); ?>" style="<?php echo esc_attr( $args['content_style'] ); ?>"><?php

		self::print_context_js( $args );

		WPBC_FE_Render::render_booking_form(
			array(
				'resource_id'                     => $args['resource_id'],
				'cal_count'                       => $args['cal_count'],
				'is_echo'                         => 1,
				'custom_booking_form'             => $args['custom_booking_form'],
				'selected_dates_without_calendar' => $args['selected_dates_without_calendar'],
				'start_month_calendar'            => $args['start_month_calendar'],
				'shortcode_param__options'        => $args['shortcode_param__options'],
				'calendar_dates_start'            => $args['calendar_dates_start'],
				'calendar_dates_end'              => $args['calendar_dates_end'],
				'booking_hash'                    => $args['booking_hash'],
			)
		);

		?></div><?php

		if ( ! empty( $args['is_show_footer_email_toggle'] ) ) {
			?><hr /><?php
			wpbc_toolbar_is_send_emails_btn_duplicated();
		}

		if ( ! empty( $args['is_booking_page_popover'] ) ) {
			wpbc_bs_javascript_popover();                                      // JS Popover.
		}

		$html = ob_get_clean();

		if ( $is_echo ) {
			echo $html;                                                        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			return;
		}

		return $html;
	}


	/**
	 * Normalize component args.
	 *
	 * Explicit args are preferred first. Empty/non-provided args fall back to legacy $_GET behavior.
	 *
	 * @param array $args Component options.
	 *
	 * @return array
	 */
	private static function normalize_args( $args ) {

		$defaults = array(
			'resource_id'                     => null,
			'booking_type'                    => null,
			'booking_form'                    => null,
			'custom_booking_form'             => null,
			'calendar_options'                => null,
			'cal_count'                       => null,
			'calendar_months_count'           => null,
			'shortcode_param__options'        => null,
			'selected_dates_without_calendar' => null,
			'start_month_calendar'            => false,
			'calendar_dates_start'            => '',
			'calendar_dates_end'              => '',
			'booking_hash'                    => '',
			'selected_date'                   => '',
			'selected_time'                   => '',
			'is_toolbar_visible'              => true,
			'is_booking_page_js'              => true,
			'is_booking_page_popover'         => true,
			'is_show_before_content_spacer'   => true,
			'is_show_footer_email_toggle'     => true,
			'content_css_class'               => 'add_booking_page_content',
			'content_style'                   => 'width:100%;margin-bottom:100px;',
			'is_echo'                         => 1,
		);
		$args     = wp_parse_args( $args, $defaults );

		$args['_is_explicit_resource_id']  = ( ( null !== $args['resource_id'] ) && ( absint( $args['resource_id'] ) > 0 ) )
											|| ( ( null !== $args['booking_type'] ) && ( absint( $args['booking_type'] ) > 0 ) );
		$args['_is_explicit_booking_form'] = ( ( null !== $args['custom_booking_form'] ) && ( '' !== (string) $args['custom_booking_form'] ) )
											|| ( ( null !== $args['booking_form'] ) && ( '' !== (string) $args['booking_form'] ) );

		$resource_id = self::get_explicit_or_get_resource_id( $args );
		$form_name   = self::get_explicit_or_get_booking_form( $args );

		$calendar_params = self::get_calendar_params( $args );

		$args['resource_id']              = $resource_id;
		$args['custom_booking_form']      = $form_name;
		$args['cal_count']                = $calendar_params['months_number'];
		$args['shortcode_param__options'] = $calendar_params['shortcode_param__options'];

		$args['selected_dates_without_calendar'] = ( null !== $args['selected_dates_without_calendar'] ) ? (string) $args['selected_dates_without_calendar'] : '';
		$args['calendar_dates_start']            = (string) $args['calendar_dates_start'];
		$args['calendar_dates_end']              = (string) $args['calendar_dates_end'];
		$args['booking_hash']                    = sanitize_text_field( wp_unslash( (string) $args['booking_hash'] ) );
		$args['selected_date']                   = sanitize_text_field( wp_unslash( (string) $args['selected_date'] ) );
		$args['selected_time']                   = sanitize_text_field( wp_unslash( (string) $args['selected_time'] ) );

		return $args;
	}


	/**
	 * Print per-render context that legacy front-end JavaScript reads from the global _wpbc object.
	 *
	 * @param array $args Component options.
	 *
	 * @return void
	 */
	private static function print_context_js( $args ) {

		$booking_hash = isset( $args['booking_hash'] ) ? (string) $args['booking_hash'] : '';
		$context      = array(
			'resource_id'                     => absint( $args['resource_id'] ),
			'selected_dates_without_calendar' => (string) $args['selected_dates_without_calendar'],
			'selected_date'                   => (string) $args['selected_date'],
			'selected_time'                   => (string) $args['selected_time'],
		);
		?>
		<script type="text/javascript">
			window.wpbc_add_booking_component_context = <?php echo wp_json_encode( $context ); ?>;
			if ( 'undefined' !== typeof _wpbc ) {
				_wpbc.set_other_param( 'this_page_booking_hash', <?php echo wp_json_encode( $booking_hash ); ?> );
			}
		</script>
		<?php
	}


	/**
	 * Resolve booking resource id: explicit component args first, then legacy $_GET.
	 *
	 * @param array $args Component options.
	 *
	 * @return int
	 */
	private static function get_explicit_or_get_resource_id( $args ) {

		if ( ( null !== $args['resource_id'] ) && ( absint( $args['resource_id'] ) > 0 ) ) {
			return absint( $args['resource_id'] );
		}

		if ( ( null !== $args['booking_type'] ) && ( absint( $args['booking_type'] ) > 0 ) ) {
			return absint( $args['booking_type'] );
		}

		if ( isset( $_GET['booking_type'] ) ) {                                // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return intval( $_GET['booking_type'] );                            // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		}

		return 1;
	}


	/**
	 * Resolve booking form: explicit component args first, then legacy $_GET.
	 *
	 * @param array $args Component options.
	 *
	 * @return string
	 */
	private static function get_explicit_or_get_booking_form( $args ) {

		if ( ( null !== $args['custom_booking_form'] ) && ( '' !== (string) $args['custom_booking_form'] ) ) {
			return sanitize_text_field( wp_unslash( (string) $args['custom_booking_form'] ) );
		}

		if ( ( null !== $args['booking_form'] ) && ( '' !== (string) $args['booking_form'] ) ) {
			return sanitize_text_field( wp_unslash( (string) $args['booking_form'] ) );
		}

		return WPBC_GET_Request::has_non_empty_get( 'booking_form' ) ? WPBC_GET_Request::get_sanitized( 'booking_form' ) : 'standard';
	}


	/**
	 * Resolve calendar settings for the component.
	 *
	 * @param array $args Component options.
	 *
	 * @return array
	 */
	private static function get_calendar_params( $args ) {

		if ( null !== $args['calendar_options'] && is_array( $args['calendar_options'] ) ) {
			$calendar_options = self::format_calendar_options( $args['calendar_options'] );
		} else {
			$calendar_options = self::get_saved_user_calendar_options();
		}

		if ( null !== $args['calendar_months_count'] ) {
			$calendar_options['months_number'] = absint( $args['calendar_months_count'] );
		}

		if ( null !== $args['cal_count'] ) {
			$calendar_options['months_number'] = absint( $args['cal_count'] );
		}

		if ( empty( $calendar_options['months_number'] ) ) {
			$calendar_options['months_number'] = 1;
		}

		if ( null !== $args['shortcode_param__options'] ) {
			$shortcode_param__options = (string) $args['shortcode_param__options'];
		} else {
			$shortcode_param__options = '{calendar' . $calendar_options['options_param'] . '}';
		}

		return array(
			'months_number'             => absint( $calendar_options['months_number'] ),
			'shortcode_param__options'  => $shortcode_param__options,
		);
	}


	/**
	 * Get Calendar Options of specific User.
	 *
	 * @return array Number of months and calendar options parameter.
	 */
	public static function get_saved_user_calendar_options() {

		$user_calendar_options = get_user_option( 'booking_custom_' . 'add_booking_calendar_options', wpbc_get_current_user_id() );

		if ( false === $user_calendar_options ) {
			$user_calendar_options = array();
		} else {
			$user_calendar_options = maybe_unserialize( $user_calendar_options );
		}

		return self::format_calendar_options( $user_calendar_options );
	}


	/**
	 * Convert calendar option values to the shortcode option string used by the renderer.
	 *
	 * @param array $user_calendar_options Raw calendar options.
	 *
	 * @return array
	 */
	private static function format_calendar_options( $user_calendar_options ) {

		$defaults = array(
			'calendar_months_count'        => 1,
			'calendar_months_num_in_1_row' => 0,
			'calendar_width'               => '',
			'calendar_widthunits'          => 'px',
			'calendar_cell_height'         => '',
			'calendar_cell_heightunits'    => 'px',
		);

		$user_calendar_options = wp_parse_args( (array) $user_calendar_options, $defaults );

		if ( ! empty( $user_calendar_options['calendar_months_count'] ) ) {
			$selected_calendar_months_count = intval( $user_calendar_options['calendar_months_count'] );
		} else {
			$selected_calendar_months_count = 1;
		}

		if ( ! empty( $user_calendar_options['calendar_months_num_in_1_row'] ) ) {
			$option_months_num_in_row = ' months_num_in_row=' . intval( $user_calendar_options['calendar_months_num_in_1_row'] );
		} else {
			$option_months_num_in_row = '';
		}

		if ( ! empty( $user_calendar_options['calendar_width'] ) ) {
			$unit_value    = ( esc_attr( $user_calendar_options['calendar_widthunits'] ) == 'percent' ) ? '%' : esc_attr( $user_calendar_options['calendar_widthunits'] );
			$option_width  = ' width=' . intval( $user_calendar_options['calendar_width'] ) . $unit_value;
			$option_width .= ' strong_width=' . intval( $user_calendar_options['calendar_width'] ) . $unit_value;        // FixIn: 9.3.1.6.
		} else {
			$option_width = '';
		}

		if ( ! empty( $user_calendar_options['calendar_cell_height'] ) ) {
			$unit_value         = ( esc_attr( $user_calendar_options['calendar_cell_heightunits'] ) == 'percent' ) ? '%' : esc_attr( $user_calendar_options['calendar_cell_heightunits'] );
			$option_cell_height = ' cell_height=' . intval( $user_calendar_options['calendar_cell_height'] ) . $unit_value;
		} else {
			$option_cell_height = '';
		}

		return array(
			'months_number' => $selected_calendar_months_count,
			'options_param' => $option_months_num_in_row . $option_width . $option_cell_height,
		);
	}
}
