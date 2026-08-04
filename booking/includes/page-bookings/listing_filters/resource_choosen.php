<?php
/**
 * Class Resource_Choosen
 *
 * @package Support functions.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;                                                                                                               // Exit, if accessed directly.
}

/**
 * Class WPBC_Listing_Actions__Resource_Choosen
 */
class WPBC_Listing_Actions__Resource_Choosen{

	const ACTION = 'resource_choosen';

	/**
	 * Get element
	 *
	 * @return false|string
	 */
	public static function get_element_html( $escaped_search_request_params, $defaults ) {

		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return '';
		}

		$is_provider_mode   = function_exists( 'wpbc_appointment_services_is_appointment_listing_mode' ) && wpbc_appointment_services_is_appointment_listing_mode();
		$placeholder        = $is_provider_mode ? __( 'Select Providers', 'booking' ) : __( 'Select booking resources', 'booking' );
		$clear_title        = $is_provider_mode ? __( 'Clear Provider selection', 'booking' ) : __( 'Clear booking resources selection', 'booking' );
		$selection_message  = $is_provider_mode
			? __( 'When All Providers is selected, clear that selection before choosing individual Providers.', 'booking' )
			: __( 'When All resources is selected, clear that selection before choosing individual booking resources.', 'booking' );
		$select_box_options = self::get_booking_resources_arr();
		$element_id         = 'wh_booking_type';
		$selected_resources = isset( $escaped_search_request_params[ $element_id ] )
			? $escaped_search_request_params[ $element_id ]
			: $defaults[ $element_id ];

		wpbc_ui_chosen_filter_enqueue_assets();

		return wpbc_ui_chosen_filter_get_html(
			array(
				'id'                    => $element_id,
				'name'                  => $element_id,
				'options'               => $select_box_options,
				'selected_values'       => $selected_resources,
				'multiple'              => true,
				'placeholder'           => $placeholder,
				'clear_label'           => $clear_title,
				'listing_param'         => $element_id,
				'listing_value_type'    => 'digit_or_csd_array',
				// Preserve the historical empty-selection request used to show bookings whose resource was deleted.
				'empty_request_value'   => array( '-1' ),
				'clear_selected_values' => array(),
				'exclusive_values'      => array( '0' ),
				'exclusive_message'     => $selection_message,
			)
		);
	}

	/**
	 * Preserve the historical public initializer while the shared component owns JavaScript behavior.
	 *
	 * @param string $el_id Select element identifier retained for backward compatibility.
	 *
	 * @return void
	 */
	public static function js_for_choosen( $el_id ) {
		unset( $el_id );
		wpbc_ui_chosen_filter_enqueue_assets();
	}

	public static function get_booking_resources_arr() {
		$is_provider_mode    = function_exists( 'wpbc_appointment_services_is_appointment_listing_mode' ) && wpbc_appointment_services_is_appointment_listing_mode();
		$all_resources_label = $is_provider_mode ? __( 'All Providers', 'booking' ) : __( 'All resources', 'booking' );

		/**
		 * $resources_sql_arr:
		 * result = [
		 *            1 = [
		 *                  booking_type_id = "1"
		 *                  title = "Standard"
		 *                  users = "3"
		 *                  import = null
		 *                  export = null
		 *                  cost = "25"
		 *                  default_form = "owner-custom-form-1"
		 *                  prioritet = "2"
		 *                  parent = "0"
		 *                 ],
		 *             ...
		 */
		$resources_sql_arr = wpbc_ajx_get_all_booking_resources_arr();

		/**
		 * $resources_arr = array(             linear_resources = {array} [12]            single_or_parent = {array} [5]                child = {array} [2]  )
		 *
		 *    $resources_arr = {array} [3]
		 *                                     linear_resources = {array} [12]
		 *                                                                          1 = {array} [12]
		 *                                                                                           booking_type_id = "1"
		 *                                                                                           title = "Standard"
		 *                                                                                           users = "3"
		 *                                                                                           import = null
		 *                                                                                           export = null
		 *                                                                                           cost = "25"
		 *                                                                                           default_form = "owner-custom-form-1"
		 *                                                                                           prioritet = "2"
		 *                                                                                           parent = "0"
		 *                                                                                           visitors = "2"
		 *                                                                                           id = "1"
		 *                                                                                           count = {int} 5
		 *                                                                          5 = {array} [12]
		 *                                                                                           booking_type_id = "5"
		 *                                                                                           title = "Standard-1"
		 *                                                                                           users = "1"
		 *                                                                                           import = null
		 */

		$resources_arr      = wpbc_ajx_arrange_booking_resources_arr( $resources_sql_arr );
		$style              = '';
		$select_box_options = array();            // FixIn: 4.3.2.1.

		if ( ! empty( $resources_arr ) ) {

			$linear_resources_arr = $resources_arr['linear_resources'];

			if ( count( $linear_resources_arr ) > 1 ) {

				$resources_id_arr = array();
				foreach ( $linear_resources_arr as $bkr ) {
					$resources_id_arr[] = $bkr['id'];
				}

				/* implode( ',', $resources_id_arr ) */
				$select_box_options[0] = array(
					'title' => $all_resources_label,
					'attr'  => array( 'title' => '<strong>' . esc_html( $all_resources_label ) . '</strong>' ),
					'style' => 'font-weight:600;',
				);
			}

			foreach ( $linear_resources_arr as $bkr ) {

				$option_title = wpbc_lang( $bkr['title'] );

				if ( isset( $bkr['parent'] ) ) {
					if ( $bkr ['parent'] == 0 ) {
						$option_title = $option_title;
						$style        = 'font-weight:600;';
					} else {
						$option_title = '&nbsp;&nbsp;&nbsp;' . $option_title;
						$style        = 'font-weight:400;';
					}
				}
				$select_box_options[ $bkr ['id'] ] = array(
					'title' => $option_title,
					'attr'  => array( 'title' => $option_title ),
					'style' => $style,
				);
			}
		}

		return $select_box_options;
	}



	/**
	 * Get Template for Modal Window -  Booking Cost Edit - Layout - Modal Window structure
	 *
	 * @return false|void
	 */
	public static function template_for_modal__000() {

		?>
		<span class="wpdevelop">
			<div id="wpbc_modal__resource_choosen__section" class="modal wpbc_popup_modal wpbc_modal_in_listing" tabindex="-1" role="dialog">
				<div class="modal-dialog">
					<div class="modal-content">
						<div class="modal-header">
							<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
							<h4 class="modal-title">
								<span class="wpbc_modal__title__reason">
								<?php
									esc_html_e( 'Delete selected bookings', 'booking' );
								?>
								</span>
								<sup class="wpbc_modal__title__reason__booking_id wpbc_modal__booking_id__in_title"></sup>
							</h4>
						</div>
						<div class="modal-body">
							<label for="wpbc_modal__resource_choosen__value" style="font-size: 14px;margin: 5px 0 10px;">
							<?php
								echo '<strong>' . esc_attr__( 'Enter the reason for the operation.', 'booking' ) . '</strong> (' . esc_attr__( 'Optional', 'booking' ) . ')';
							?>
							</label>
							<textarea id="wpbc_modal__resource_choosen__value"
									name="wpbc_modal__resource_choosen__value" cols="87" rows="3"
									placeholder="<?php echo esc_attr__( 'Optional', 'booking' ) . ' '; ?>"
							></textarea>
							<input type="hidden" id="wpbc_modal__resource_choosen__booking_id" value=""/>
							<p class="help-block">
								<?php
								/* translators: 1: ... */
								echo wp_kses_post( sprintf( __( 'In the %1$semail template%2$s, use the %3$s shortcode to display this text.', 'booking' ), '<a href="' . esc_url( wpbc_get_settings_url( true, false ) . '&tab=email&subtab=deleted' ) . '">', '</a>', '<b>[reason]</b>' ) );
								?>
							</p>
						</div>
						<div class="modal-footer">
							<a  id="wpbc_modal__resource_choosen__button_send" class="button button-primary"
								href="javascript:void(0);"
								onclick="javascript: wpbc_ajx_booking_ajax_action_request( {
														'booking_action'       : '<?php echo esc_js( self::ACTION ); ?>',
														'booking_id'           : wpbc_get_selected_row_id(),
														'reason_of_action'     : jQuery( '#wpbc_modal__resource_choosen__value' ).val(),
														'ui_clicked_element_id': 'wpbc_modal__resource_choosen__button_send'
												} );
												wpbc_button_enable_loading_icon( this );
												jQuery( '.wpbc_modal__title__reason__booking_id' ).html('');
												jQuery( '#wpbc_modal__resource_choosen__value' ).val(''),
												jQuery( '#wpbc_modal__resource_choosen__section' ).wpbc_my_modal( 'hide' );
										" >
							<?php
								esc_html_e( 'Completely Delete', 'booking' );
							?>
							</a>
							<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal">
							<?php
								esc_html_e( 'Cancel', 'booking' );
							?>
							</a>
						</div>
					</div><!-- /.modal-content -->
				</div><!-- /.modal-dialog -->
			</div><!-- /.modal -->
		</span>
		<?php
	}
}

// Loads hidden modal template.
//add_action( 'wpbc_hook_booking_template__hidden_templates', array( new WPBC_Listing_Actions__Resource_Choosen(), 'template_for_modal' ) );
