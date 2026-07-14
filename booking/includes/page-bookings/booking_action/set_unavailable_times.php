<?php
/**
 * Set unavailable times from the Booking Listing action menu.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;                                                                                                               // Exit, if accessed directly.
}

/**
 * Class WPBC_Action_Set_Unavailable_Times
 */
class WPBC_Action_Set_Unavailable_Times {

	const ACTION = 'set_unavailable_times';

	/**
	 * Check whether current user can manage time-slot availability.
	 *
	 * @return bool
	 */
	public static function is_action_available() {

		if ( function_exists( 'wpbc_availability_timeslots__get_manage_cap' ) ) {
			return current_user_can( wpbc_availability_timeslots__get_manage_cap() );
		}

		return current_user_can( 'manage_options' );
	}

	/**
	 * Get action button for the booking row menu.
	 *
	 * @return false|string
	 */
	public static function get_button() {

		if (
			   ( ! function_exists( 'wpbc_availability_timeslots__render_timeline_component' ) )
			|| ( ! self::is_action_available() )
		) {
			return false;
		}

		$html = "<a class='ul_dropdown_menu_li_action ul_dropdown_menu_li_action_" . esc_js( self::ACTION ) . "'
					href=\"javascript:void(0)\"
					onclick=\"wpbc_boo_listing__click__set_unavailable_times(
						{{data['parsed_fields']['booking_id']}},
						{{data['parsed_fields']['resource_id']}},
						'{{data['short_dates'][0]}}',
						'{{data['short_dates'][ data['short_dates'].length > 2 ? ( data['short_dates'].length - 1 ) : 0 ]}}'
					);\"
				>" .
					esc_js( __( 'Set unavailable times', 'booking' ) ) .
					"<i class='menu_icon icon-1x wpbc_icn_do_not_disturb_on'></i>" .
				'</a>';

		return $html;
	}

	/**
	 * Print top toolbar button for opening the availability popup without booking context.
	 *
	 * @param string $page_tag           Current page tag.
	 * @param string $active_page_tab    Current tab.
	 * @param string $active_page_subtab Current subtab.
	 *
	 * @return false|void
	 */
	public static function print_top_toolbar_button( $page_tag, $active_page_tab, $active_page_subtab ) {

		if ( ( 'wpbc' !== $page_tag ) || ( 'vm_booking_listing' !== $active_page_tab ) ) {
			return false;
		}

		if (
			( ! function_exists( 'wpbc_availability_timeslots__render_timeline_component' ) )
			|| ( ! self::is_action_available() )
		) {
			return false;
		}

		?>
		<div class="wpbc_ui_el__buttons_group wpbc_booking_listing__top_toolbar_group">
			<a  href="javascript:void(0);"
				id="wpbc_booking_listing_set_unavailable_times_button"
				class="button button-secondary"
				onclick="wpbc_boo_listing__click__set_unavailable_times( '', '', '', '' );"
				title="<?php esc_attr_e( 'Set times availability', 'booking' ); ?>">
				<i class="menu_icon icon-1x wpbc-bi-clock-history"></i>&nbsp;
				<?php esc_html_e( 'Set Times Availability', 'booking' ); ?>
			</a>
		</div>
		<?php
	}

	/**
	 * Add action to Booking Listing dropdown.
	 *
	 * @param array $el_arr Dropdown configuration.
	 *
	 * @return array
	 */
	public static function add_action_to_dropdown( $el_arr ) {

		$button = self::get_button();
		if ( false === $button ) {
			return $el_arr;
		}

		$new_item     = array( 'type' => 'html', 'html' => $button );
		$insert_index = null;

		foreach ( $el_arr['items'] as $index => $item ) {
			if ( ( 'html' === $item['type'] ) && ( false !== strpos( $item['html'], 'ul_dropdown_menu_li_action_set_booking_locale' ) ) ) {
				$insert_index = $index + 1;
				break;
			}
		}

		if ( null === $insert_index ) {
			$el_arr['items'][] = $new_item;
			return $el_arr;
		}

		array_splice( $el_arr['items'], $insert_index, 0, array( $new_item ) );

		return $el_arr;
	}

	/**
	 * Get template for modal window.
	 *
	 * @return false|void
	 */
	public static function template_for_modal() {

		if (
			( ! function_exists( 'wpbc_availability_timeslots__render_timeline_component' ) )
			|| ( ! self::is_action_available() )
		) {
			return false;
		}

		?>
		<span class="wpdevelop">
			<div id="wpbc_modal__set_unavailable_times__section" class="modal wpbc_popup_modal wpbc_modal_in_listing wpbc_modal__availability_timeslots__section" tabindex="-1" role="dialog">
				<div class="modal-dialog">
					<div class="modal-content">
						<div class="modal-header">
							<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
							<h4 class="modal-title">
								<?php esc_html_e( 'Set unavailable times', 'booking' ); ?>
								<sup class="wpbc_modal__set_unavailable_times__booking_id wpbc_modal__booking_id__in_title"></sup>
							</h4>
						</div>
						<div class="modal-body">
							<?php
							wpbc_availability_timeslots__render_timeline_component(
								array(
									'id_prefix'            => 'wpbc_ts_listing_popup',
									'wrap_class'           => 'wpbc_ts_page wpbc_ts_popup',
									'resource_id'          => wpbc_get_default_resource(),
									'show_hint'            => false,
									'show_legend'          => true,
									'auto_init'            => false,
									'show_toolbar_actions' => false,
								)
							);
							?>
						</div>
						<div class="modal-footer">
							<a href="javascript:void(0)" class="button button-primary wpbc_ts_create_booking_button" data-wpbc-ts-create-booking="1">
								<i class="menu_icon icon-1x wpbc-bi-calendar-plus"></i>&nbsp;
								<?php esc_html_e( 'Create Booking for Selection', 'booking' ); ?>
							</a>
							<?php wpbc_availability_timeslots__render_action_buttons( 'wpbc_ts_action_buttons_inline wpbc_ts_footer_action_buttons' ); ?>
							<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal">
								<?php esc_html_e( 'Close', 'booking' ); ?>
							</a>
						</div>
					</div><!-- /.modal-content -->
				</div><!-- /.modal-dialog -->
			</div><!-- /.modal -->
		</span>
		<?php
	}
}

add_filter( 'wpbc_template__booking_listing__el__btn_action', array( 'WPBC_Action_Set_Unavailable_Times', 'add_action_to_dropdown' ) );
add_action( 'wpbc_hook_booking_template__hidden_templates', array( 'WPBC_Action_Set_Unavailable_Times', 'template_for_modal' ) );
add_action( 'wpbc_ui_el__top_nav__content_end', array( 'WPBC_Action_Set_Unavailable_Times', 'print_top_toolbar_button' ), 20, 3 );
