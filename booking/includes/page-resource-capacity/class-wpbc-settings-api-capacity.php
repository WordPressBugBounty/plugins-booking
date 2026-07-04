<?php
/**
 * Capacity Rules settings API.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Capacity settings fields.
 */
class WPBC_Settings_API_Capacity extends WPBC_Settings_API {

	/**
	 * Constructor.
	 *
	 * @param string $id Settings ID.
	 */
	public function __construct( $id = '' ) {

		$options = array(
			'db_prefix_option' => '',
			'db_saving_type'   => 'separate',
			'id'               => 'set_gen',
		);

		$id = empty( $id ) ? $options['id'] : $id;

		parent::__construct( $id, $options );
	}

	/**
	 * Init Capacity fields.
	 *
	 * @return void
	 */
	public function init_settings_fields() {

		$this->fields = array();

		$default_options_values = wpbc_get_default_options();

		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$this->fields['booking_quantity_control'] = array(
				'type'            => 'checkbox',
				'default'         => $default_options_values['booking_quantity_control'],
				'title'           => __( 'Booking Quantity Control', 'booking' ),
				'label'           => __( 'Enable this option to allow visitors to define the number of items they can book for specific dates or times within a single reservation. ', 'booking' ),
				'description'     => __( 'If disabled, visitors can book only one slot within a single reservation.', 'booking' ),
				'description_tag' => 'p',
				'group'           => 'capacity',
			);

			$this->fields['booking_capacity_field'] = array(
				'type'            => 'select',
				'default'         => $default_options_values['booking_capacity_field'],
				'title'           => __( 'Quantity field name', 'booking' ),
				'description'     => sprintf( __( 'Select the field that will control how many slots visitors can book during the reservation process.', 'booking' ), '<b>', '</b>' ),
				'description_tag' => 'span',
				'css'             => '',
				'tr_class'        => 'wpbc_booking_capacity_field_settings wpbc_sub_settings_grayed',
				'options'         => $this->get_quantity_field_options(),
				'group'           => 'capacity',
			);

			$this->fields['booking_is_dissbale_booking_for_different_sub_resources'] = array(
				'type'        => 'checkbox',
				'default'     => $default_options_values['booking_is_dissbale_booking_for_different_sub_resources'],
				'title'       => __( 'Disable bookings in different booking resources', 'booking' ),
				'label'       => __( 'Check this box to disable reservations, which can be stored in different booking resources.', 'booking' ),
				'description' => '<strong>' . esc_html__( 'Note', 'booking' ) . '!</strong> ' . esc_html__( 'When checked, all reserved days must be at same booking resource otherwise error message will show.', 'booking' ),
				'group'       => 'capacity',
			);

			$this->fields['hr_calendar_before_is_use_visitors_number_for_availability'] = array(
				'type'  => 'hr',
				'group' => 'capacity',
			);
		}

		$this->fields['booking_is_days_always_available'] = array(
			'type'        => 'checkbox',
			'default'     => $default_options_values['booking_is_days_always_available'],
			'title'       => __( 'Allow unlimited bookings per same day(s)', 'booking' ),
			/* translators: 1: ... */
			'label'       => sprintf( __( 'Check this box, if you want to %1$sset any days as available%2$s in calendar. Your visitors will be able to make %3$sunlimited bookings per same date(s) in calendar and do not see any booked date(s)%4$s of other visitors.', 'booking' ), '<strong>', '</strong>', '<strong>', '</strong>' ),
			'description' => '',
			'group'       => 'capacity',
		);

		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$this->fields['booking_is_show_pending_days_as_available'] = array(
				'type'        => 'checkbox',
				'default'     => $default_options_values['booking_is_show_pending_days_as_available'],
				'title'       => __( 'Use pending days as available', 'booking' ),
				'label'       => __( 'Check this box if you want to show the pending days as available in calendars', 'booking' ),
				'description' => '',
				'group'       => 'capacity',
				'tr_class'    => '',
			);

			$this->fields['booking_auto_cancel_pending_bookings_for_approved_date'] = array(
				'type'        => 'checkbox',
				'default'     => $default_options_values['booking_auto_cancel_pending_bookings_for_approved_date'],
				'title'       => __( 'Auto-cancel bookings', 'booking' ),
				'label'       => __( 'Auto Cancel all pending bookings for the specific date(s), if some booking is approved for these date(s)', 'booking' ),
				'description' => '',
				'group'       => 'capacity',
				'tr_class'    => 'wpbc_pending_days_as_available_sub_settings wpbc_sub_settings_grayed',
			);
		} else {
			$this->fields['booking_is_show_pending_days_as_available'] = array(
				'type'        => 'checkbox',
				'default'     => $default_options_values['booking_is_show_pending_days_as_available'],
				'title'       => __( 'Use pending days as available', 'booking' ),
				'label'       => __( 'Check this box if you want to show the pending days as available in calendars', 'booking' ),
				'description' => '',
				'group'       => 'capacity',
				'tr_class'    => '',
			);
		}

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			$this->fields['booking_quantity_control__promote_upgrade'] = array(
				'type'            => 'checkbox',
				'default'         => 'On',
				'value'           => 'On',
				'title'           => __( 'Booking Quantity Control', 'booking' ),
				'label'           => __( 'Enable this option to allow visitors to define the number of items they can book for specific dates or times within a single reservation. ', 'booking' ),
				'description'     => __( 'If disabled, visitors can book only one slot within a single reservation.', 'booking' ),
				'description_tag' => 'p',
				'group'           => 'capacity_upgrade',
				'tr_class'        => 'wpbc_blur',
			);

			$this->fields['booking_capacity_field__promote_upgrade'] = array(
				'type'            => 'select',
				'default'         => 'items',
				'value'           => 'items',
				'title'           => __( 'Quantity field name', 'booking' ),
				'description'     => sprintf( __( 'Select the field that will control how many slots visitors can book during the reservation process.', 'booking' ), '<b>', '</b>' ),
				'description_tag' => 'span',
				'css'             => '',
				'tr_class'        => 'wpbc_booking_capacity_field_settings wpbc_sub_settings_grayed wpbc_blur',
				'options'         => array( 'items' => __( 'Items', 'booking' ) ),
				'group'           => 'capacity_upgrade',
			);

			$this->fields['booking_is_dissbale_booking_for_different_sub_resources__promote_upgrade'] = array(
				'type'        => 'checkbox',
				'default'     => 'On',
				'value'       => 'On',
				'title'       => __( 'Disable bookings in different booking resources', 'booking' ),
				'label'       => __( 'Check this box to disable reservations, which can be stored in different booking resources.', 'booking' ),
				'description' => '<strong>' . esc_html__( 'Note', 'booking' ) . '!</strong> ' . __( 'When checked, all reserved days must be at same booking resource otherwise error message will show.', 'booking' ),
				'group'       => 'capacity_upgrade',
				'tr_class'    => 'wpbc_blur',
			);

			$this->fields['capacity_upgrade__promote_upgrade'] = array(
				'type'  => 'pure_html',
				'group' => 'capacity_upgrade',
				'html'  => '<tr><td colspan="2">
								<div class="wpbc_widget_content" style="transform: translate(0) translateY(-10em);">
									<div class="ui_container ui_container_toolbar ui_container_small" style="background: #fff;position: relative;">
										<div class="ui_group ui_group__upgrade">
											<div class="wpbc_upgrade_note wpbc_upgrade_theme_green">
												<div>This <a target="_blank" href="https://wpbookingcalendar.com/features/#capacity">feature</a>
													 is available in the <strong>Business Large or MultiUser version</strong>.
													<a target="_blank" href="https://wpbookingcalendar.com/prices/#bk_news_section">Upgrade to Pro</a>.
												</div>
											</div>
										</div>
									</div>
								</div>
							</td></tr>',
			);
		}
	}

	/**
	 * Get selectable booking-form fields for Quantity Control.
	 *
	 * @return array
	 */
	private function get_quantity_field_options() {

		$options = array(
			'' => __( 'None', 'booking' ),
		);

		if ( ! function_exists( 'wpbc_get__in_all_forms__field_names_arr' ) ) {
			return $options;
		}

		$booking_forms = wpbc_get__in_all_forms__field_names_arr();

		foreach ( $booking_forms as $single_booking_form ) {
			$form_name = trim( $single_booking_form['name'] );

			$options[ $form_name ] = array(
				'title'    => ucfirst( $form_name ),
				'optgroup' => true,
				'close'    => false,
			);

			for ( $i = 0; $i < $single_booking_form['num']; $i++ ) {
				$field_key             = ( ( 'standard' !== $form_name ) ? $form_name . '^' : '' ) . trim( $single_booking_form['listing']['fields_type'][ $i ] ) . '^' . trim( $single_booking_form['listing']['fields'][ $i ] );
				$options[ $field_key ] = trim( $single_booking_form['listing']['labels'][ $i ] );
			}

			$options[ $form_name . '_close' ] = array(
				'title'    => $form_name,
				'optgroup' => true,
				'close'    => true,
			);
		}

		return $options;
	}
}
