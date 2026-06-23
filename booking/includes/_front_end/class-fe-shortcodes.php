<?php
/**
 * Front-End Shortcodes (Phase #1)
 *
 * File: /wp-content/plugins/booking/includes/_front_end/class-fe-shortcodes.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


class WPBC_FE_Shortcodes {

	/**
	 * Boot.
	 */
	public static function init() {

		// Register after legacy (legacy uses init priority 9999).
		add_action( 'init', array( __CLASS__, 'register_shortcodes' ), 10000 );
	}

	/**
	 * Register the shortcodes we move in Phase #1.
	 */
	public static function register_shortcodes() {

		/**
		 * [booking]
		 * - WPBC_FE_Shortcodes::booking_shortcode()
		 * - WPBC_FE_Render::render_booking_form()
		 * - WPBC_FE_Form_Body_Renderer::render()
		 * - WPBC_FE_Form_Source::get_form_body_html()
		 * - WPBC_FE_Form_Source_Resolver::resolve()        |   (engine bfb_db)
		 *     - wpbc_bfb_get_booking_form_pair()
		 *     - wpbc_render_booking_form_shortcodes()
		 *     - WPBC_BFB_FormShortcodeEngine->render().
		 */
		add_shortcode( 'booking', array( __CLASS__, 'booking_shortcode' ) );
		add_shortcode( 'booking_popup', array( __CLASS__, 'booking_popup_shortcode' ) );
		add_shortcode( 'bookingcalendar', array( __CLASS__, 'booking_calendar_only_shortcode' ) );
		add_shortcode( 'bookingform', array( __CLASS__, 'bookingform_shortcode' ) );
	}

	// ---------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------

	private static function force_attr_array( $attr ) {
		return is_array( $attr ) ? $attr : array();
	}

	private static function maybe_escape_shortcode_params( $attr ) {

		// This function sanitize each value in attr array  by  using WP function: sanitize_text_field().
		$attr = wpbc_escape_shortcode_params( $attr );

		return is_array( $attr ) ? $attr : array();
	}

	/**
	 * Check shortcode parameter for a boolean-like true value.
	 *
	 * @param array  $attr Shortcode attributes.
	 * @param string $key  Attribute key.
	 *
	 * @return bool
	 */
	private static function is_truthy_attr( $attr, $key ) {

		if ( ! isset( $attr[ $key ] ) ) {
			return false;
		}

		$value = strtolower( trim( (string) $attr[ $key ] ) );

		return in_array( $value, array( '1', 'true', 'yes', 'on' ), true );
	}

	/**
	 * Check if the current render is happening inside Elementor editor/preview.
	 *
	 * Elementor can render widgets through admin AJAX, where is_admin() is true
	 * even though the output is displayed in the front-end canvas iframe.
	 *
	 * @return bool
	 */
	private static function is_elementor_render_context() {

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$action = isset( $_REQUEST['action'] ) ? sanitize_key( wp_unslash( $_REQUEST['action'] ) ) : '';
		if ( in_array( $action, array( 'elementor', 'elementor_ajax' ), true ) ) {
			return true;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['elementor-preview'] ) ) {
			return true;
		}

		if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance ) ) {
			if ( isset( \Elementor\Plugin::$instance->editor ) && method_exists( \Elementor\Plugin::$instance->editor, 'is_edit_mode' ) && \Elementor\Plugin::$instance->editor->is_edit_mode() ) {
				return true;
			}
			if ( isset( \Elementor\Plugin::$instance->preview ) && method_exists( \Elementor\Plugin::$instance->preview, 'is_preview_mode' ) && \Elementor\Plugin::$instance->preview->is_preview_mode() ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Check if popup wrapping is safe for the current render context.
	 *
	 * @return bool
	 */
	private static function is_popup_render_allowed() {

		return ( ! is_admin() ) || self::is_elementor_render_context();
	}

	/**
	 * Sanitize a space-separated HTML class list.
	 *
	 * @param string $class_list     Class list.
	 * @param string $default_value  Fallback classes.
	 *
	 * @return string
	 */
	private static function sanitize_class_list( $class_list, $default_value = '' ) {

		$class_list = is_scalar( $class_list ) ? trim( (string) $class_list ) : '';

		if ( '' === $class_list ) {
			$class_list = (string) $default_value;
		}

		$classes = preg_split( '/\s+/', $class_list );
		$classes = array_filter( array_map( 'sanitize_html_class', $classes ) );

		return implode( ' ', array_unique( $classes ) );
	}

	/**
	 * Get normalized popup parameters from shortcode attributes.
	 *
	 * @param array $attr Shortcode attributes.
	 *
	 * @return array
	 */
	private static function get_popup_params_from_attr( $attr ) {

		$popup_title = isset( $attr['popup_title'] ) ? sanitize_text_field( wp_unslash( $attr['popup_title'] ) ) : '';
		if ( '' === $popup_title ) {
			$popup_title = __( 'Booking Form', 'booking' );
		}

		$button_title = isset( $attr['popup_button_title'] ) ? sanitize_text_field( wp_unslash( $attr['popup_button_title'] ) ) : '';
		if ( '' === $button_title ) {
			$button_title = __( 'Book now', 'booking' );
		}

		$button_class = isset( $attr['popup_button_class'] ) ? $attr['popup_button_class'] : 'wp-element-button';
		$modal_class  = isset( $attr['popup_modal_class'] ) ? $attr['popup_modal_class'] : '';

		$popup_size = isset( $attr['popup_size'] ) ? sanitize_key( wp_unslash( $attr['popup_size'] ) ) : 'lg';
		if ( ! in_array( $popup_size, array( 'lg', 'sm', 'default' ), true ) ) {
			$popup_size = 'lg';
		}

		return array(
			'title'        => $popup_title,
			'button_title' => $button_title,
			'button_class' => self::sanitize_class_list( $button_class, 'wp-element-button' ),
			'modal_class'  => self::sanitize_class_list( $modal_class ),
			'size'         => $popup_size,
		);
	}

	/**
	 * Enqueue front-end assets needed for popup booking forms.
	 *
	 * @return string Fallback inline assets if they must be printed at the shortcode location.
	 */
	private static function enqueue_popup_assets() {

		if ( function_exists( 'wpbc_load_js__required_for_front_end_modals' ) ) {
			wpbc_load_js__required_for_front_end_modals();
		} else {
			wp_enqueue_script( 'wpbc-modal', wpbc_plugin_url( '/vendors/_custom/dropdown_modal/_out/dropdown_modal.js' ), array( 'jquery' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
			wp_enqueue_style( 'wpbc-admin-modal-popups', wpbc_plugin_url( '/css/modal.css' ), array(), WP_BK_VERSION_NUM );
		}

		$js_body = "jQuery( document ).on( 'shown.wpbc.modal', '.wpbc_booking_form_popup_modal', function(){ jQuery( window ).trigger( 'resize' ); jQuery( this ).trigger( 'wpbc_booking_popup_opened' ); } );";
		$added   = WPBC_FE_Assets::add_jq_ready_js_to_wp_script( 'wpbc-modal', $js_body, 'wpbc-booking-popup-modal-shown' );
		if ( ! $added ) {
			return WPBC_FE_Assets::add_inline_js( wpbc_jq_ready_start() . "\n" . $js_body . "\n" . wpbc_jq_ready_end(), 'wpbc-booking-popup-modal-shown' );
		}

		return '';
	}

	/**
	 * Wrap already-rendered booking form HTML into a front-end modal.
	 *
	 * @param string $booking_form_html Rendered booking form.
	 * @param array  $popup_params      Normalized popup params.
	 * @param int    $resource_id       Primary booking resource ID.
	 *
	 * @return string
	 */
	private static function render_booking_popup( $booking_form_html, $popup_params, $resource_id ) {

		static $popup_counter = 0;
		$popup_counter++;

		$fallback_assets = self::enqueue_popup_assets();

		$resource_id = absint( $resource_id );
		$modal_id    = 'wpbc_booking_form_popup_modal_' . $resource_id . '_' . $popup_counter;

		$modal_size_class = '';
		if ( 'default' !== $popup_params['size'] ) {
			$modal_size_class = ' modal-' . $popup_params['size'];
		}

		$modal_extra_class = ( '' !== $popup_params['modal_class'] ) ? ' ' . $popup_params['modal_class'] : '';

		$html  = $fallback_assets;
		$html .= '<div class="wpbc_booking_form_popup">';
		$html .= '<a href="#' . esc_attr( $modal_id ) . '" class="' . esc_attr( $popup_params['button_class'] ) . '" data-toggle="wpbc_my_modal" data-target="#' . esc_attr( $modal_id ) . '" aria-haspopup="dialog" aria-controls="' . esc_attr( $modal_id ) . '">' . esc_html( $popup_params['button_title'] ) . '</a>';
		$html .= '<div class="wpdevelop">';
		$html .= '<div id="' . esc_attr( $modal_id ) . '" class="modal wpbc_popup_modal wpbc_booking_form_popup_modal' . esc_attr( $modal_extra_class ) . '" tabindex="-1" role="dialog" aria-hidden="true" data-keyboard="false" data-backdrop="true" data-resource-id="' . esc_attr( $resource_id ) . '" style="display:none;">';
		$html .= '<div class="modal-dialog' . esc_attr( $modal_size_class ) . '" role="document">';
		$html .= '<div class="modal-content">';
		$html .= '<div class="modal-header">';
		$html .= '<button type="button" class="close" data-dismiss="modal" aria-label="' . esc_attr__( 'Close', 'booking' ) . '"><span aria-hidden="true">&times;</span></button>';
		$html .= '<h4 class="modal-title">' . esc_html( $popup_params['title'] ) . '</h4>';
		$html .= '</div>';
		$html .= '<div class="modal-body">';
		$html .= $booking_form_html;
		$html .= '</div>';
		$html .= '</div>';
		$html .= '</div>';
		$html .= '</div>';
		$html .= '</div>';
		$html .= '</div>';

		return $html;
	}

	// ---------------------------------------------------------------------
	// Shortcodes
	// ---------------------------------------------------------------------

	/**
	 * Shortcode [booking ...]
	 *
	 * @param array $attr
	 *
	 * @return string
	 */
	public static function booking_shortcode( $attr ) {

		if ( wpbc_is_on_edit_page() ) {
			return wpbc_get_preview_for_shortcode( 'booking', $attr );
		}

		if ( WPBC_GET_Request::has_non_empty_get( 'booking_hash' ) ) {
			/* translators: 1: URL  to FAQ page. */
			return __( 'You need to use special shortcode [bookingedit] for booking editing.', 'booking' ) . ' ' . sprintf( __( 'Please check FAQ instruction how to configure it here %s', 'booking' ), '<a href="https://wpbookingcalendar.com/faq/configure-editing-cancel-payment-bookings-for-visitors/">https://wpbookingcalendar.com/faq/configure-editing-cancel-payment-bookings-for-visitors/</a>' );
		}

		$attr = self::force_attr_array( $attr );
		$attr = self::maybe_escape_shortcode_params( $attr );

		// Parse, sanitize and normilize shortcode paramaters.
		$shortcode_params = array(
			'is_echo'                         => 0,
			'resource_id'                     => WPBC_FE_Shortcode_Params::get_from_attr__resource_id_with_aggregate( $attr, WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() ),
			'cal_count'                       => WPBC_FE_Shortcode_Params::get_from_attr__months_count( $attr, 1 ),
			'start_month_calendar'            => WPBC_FE_Shortcode_Params::get_from_attr__start_month( $attr, false ),// [ year, month ] | false.
			'calendar_dates_start'            => WPBC_FE_Shortcode_Params::get_from_attr__calendar_dates_start( $attr, '' ),
			'calendar_dates_end'              => WPBC_FE_Shortcode_Params::get_from_attr__calendar_dates_end( $attr, '' ),
			'selected_dates_without_calendar' => '',
			'custom_booking_form'             => WPBC_FE_Shortcode_Params::get_from_attr__custom_form( $attr, 'standard' ),
			'shortcode_param__options'        => WPBC_FE_Shortcode_Params::get_from_attr__options( $attr, '' ),
			'form_status'                     => WPBC_FE_Shortcode_Params::get_from_attr__form_status( $attr, 'published' ),
		);

		$shortcode_result = WPBC_FE_Render::render_booking_form( $shortcode_params );

		if ( self::is_popup_render_allowed() && self::is_truthy_attr( $attr, 'popup' ) ) {
			$resource_id_for_popup = WPBC_FE_Shortcode_Params::get_from_attr__primary_resource_id( $attr, WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() );
			$shortcode_result      = self::render_booking_popup( $shortcode_result, self::get_popup_params_from_attr( $attr ), $resource_id_for_popup );
		}

		return $shortcode_result;
	}

	/**
	 * Shortcode [booking_popup ...]
	 *
	 * Convenience alias for [booking ... popup=1].
	 *
	 * @param array $attr
	 *
	 * @return string
	 */
	public static function booking_popup_shortcode( $attr ) {

		$attr = self::force_attr_array( $attr );

		$attr['popup'] = '1';

		return self::booking_shortcode( $attr );
	}


	/**
	 * Shortcode [bookingcalendar ...]
	 *
	 * @param array $attr
	 *
	 * @return string
	 */
	public static function booking_calendar_only_shortcode( $attr ) {

		if ( wpbc_is_on_edit_page() ) {
			return wpbc_get_preview_for_shortcode( 'bookingcalendar', $attr );
		}

		if ( WPBC_GET_Request::has_non_empty_get( 'booking_hash' ) ) {
			/* translators: 1: URL  to FAQ page. */
			return __( 'You need to use special shortcode [bookingedit] for booking editing.', 'booking' ) . ' ' . sprintf( __( 'Please check FAQ instruction how to configure it here %s', 'booking' ), '<a href="https://wpbookingcalendar.com/faq/configure-editing-cancel-payment-bookings-for-visitors/">https://wpbookingcalendar.com/faq/configure-editing-cancel-payment-bookings-for-visitors/</a>' );
		}

		$attr = self::force_attr_array( $attr );
		$attr = self::maybe_escape_shortcode_params( $attr );

		$resource_id = WPBC_FE_Shortcode_Params::get_from_attr__primary_resource_id( $attr, WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() );

		// Parse, sanitize and normilize shortcode paramaters.
		$shortcode_params = array(
			'is_echo'                         => 0,
			'resource_id'                     => WPBC_FE_Shortcode_Params::get_from_attr__resource_id_with_aggregate( $attr, WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() ),
			'cal_count'                       => WPBC_FE_Shortcode_Params::get_from_attr__months_count( $attr, 1 ),
			'start_month_calendar'            => WPBC_FE_Shortcode_Params::get_from_attr__start_month( $attr, false ),  // [ year, month ] | false.
			'calendar_dates_start'            => WPBC_FE_Shortcode_Params::get_from_attr__calendar_dates_start( $attr, '' ),
			'calendar_dates_end'              => WPBC_FE_Shortcode_Params::get_from_attr__calendar_dates_end( $attr, '' ),
			'shortcode_param__options'                       => WPBC_FE_Shortcode_Params::get_from_attr__options( $attr, '' ),
			'selected_dates_without_calendar' => '',
			'custom_booking_form'             => '', // WPBC_FE_Shortcode_Params::get_from_attr__custom_form( $attr, 'standard' ), //.
		);

		$shortcode_calendar_html = WPBC_FE_Render::render_calendar_only( $shortcode_params );

		$shortcode_html = "<div class='wpbc_only_calendar wpbc_container'>" .
							"<div id='calendar_booking_unselectable" . esc_attr( intval( preg_replace( '/[^0-9].*$/', '', (string) $resource_id ) ) ) . "'></div>" .
							$shortcode_calendar_html .
						'</div>';

		return $shortcode_html;
	}


	/**
	 * Shortcode [bookingform ...]
	 *
	 * @param array $attr
	 *
	 * @return string
	 */
	public static function bookingform_shortcode( $attr ) {

		if ( wpbc_is_on_edit_page() ) {
			return wpbc_get_preview_for_shortcode( 'bookingform', $attr );
		}

		if ( WPBC_GET_Request::has_non_empty_get( 'booking_hash' ) ) {
			/* translators: 1: URL  to FAQ page. */
			return __( 'You need to use special shortcode [bookingedit] for booking editing.', 'booking' ) . ' ' . sprintf( __( 'Please check FAQ instruction how to configure it here %s', 'booking' ), '<a href="https://wpbookingcalendar.com/faq/configure-editing-cancel-payment-bookings-for-visitors/">https://wpbookingcalendar.com/faq/configure-editing-cancel-payment-bookings-for-visitors/</a>' );
		}

		$attr = self::force_attr_array( $attr );
		$attr = self::maybe_escape_shortcode_params( $attr );

		// Parse, sanitize and normilize shortcode paramaters.
		$shortcode_params = array(
			'is_echo'                         => 0,
			'resource_id'                     => WPBC_FE_Shortcode_Params::get_from_attr__resource_id_with_aggregate( $attr, WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() ),
			'selected_dates_without_calendar' => WPBC_FE_Shortcode_Params::get_from_attr__selected_dates_without_calendar( $attr, '' ),
			'custom_booking_form'             => WPBC_FE_Shortcode_Params::get_from_attr__custom_form( $attr, 'standard' ),
			'shortcode_param__options'                       => WPBC_FE_Shortcode_Params::get_from_attr__options( $attr, '' ),
			'cal_count'                       => 1,
			'start_month_calendar'            => false,
			'calendar_dates_start'            => '',
			'calendar_dates_end'              => '',
		);

		$shortcode_result = WPBC_FE_Render::render_booking_form( $shortcode_params );

		return $shortcode_result;
	}

}

WPBC_FE_Shortcodes::init();
