<?php
/**
 * Add Booking modal for Booking Listing and Timeline.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;                                                                                                               // Exit, if accessed directly.
}

/**
 * Class WPBC_Add_Booking_Modal
 */
class WPBC_Add_Booking_Modal {

	const AJAX_ACTION = 'WPBC_AJX_ADD_BOOKING_MODAL';

	/**
	 * Print top toolbar button for opening the Add Booking popup.
	 *
	 * @param string $page_tag           Current page tag.
	 * @param string $active_page_tab    Current tab.
	 * @param string $active_page_subtab Current subtab.
	 *
	 * @return false|void
	 */
	public static function print_top_toolbar_button( $page_tag, $active_page_tab, $active_page_subtab ) {

		if ( ( 'wpbc' !== $page_tag ) || ! in_array( $active_page_tab, array( 'vm_booking_listing', 'vm_calendar' ), true ) ) {
			return false;
		}

		if ( ! WPBC_Add_Booking_Component::current_user_can_add_booking() ) {
			return false;
		}

		?>
		<div class="wpbc_ui_el__buttons_group wpbc_booking_listing__top_toolbar_group">
			<a  href="javascript:void(0);"
				id="wpbc_booking_listing_add_booking_button"
				class="button button-primary"
				onclick="wpbc_boo_listing__click__add_booking_modal( { mode: 'add' } );"
				title="<?php esc_attr_e( 'Create booking without leaving this view', 'booking' ); ?>">
				<i class="menu_icon icon-1x wpbc-bi-plus"></i>&nbsp;
				<?php esc_html_e( 'New booking', 'booking' ); ?>
			</a>
		</div>
		<?php
	}


	/**
	 * Get template for modal window.
	 *
	 * @return void
	 */
	public static function template_for_modal() {

		$nonce = wp_create_nonce( strtolower( self::AJAX_ACTION ) . '_wpbcnonce' );
		?>
		<span class="wpdevelop">
			<div id="wpbc_modal__add_booking__section"
				 class="modal wpbc_popup_modal wpbc_modal_in_listing wpbc_modal__add_booking__section"
				 tabindex="-1"
				 role="dialog"
				 data-wpbc-add-booking-nonce="<?php echo esc_attr( $nonce ); ?>"
				 data-wpbc-add-booking-resource-id="">
				<div class="modal-dialog modal-lg">
					<div class="modal-content">
						<div class="modal-header">
							<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
							<div class="wpbc_modal__add_booking__header_main">
								<h4 class="modal-title">
									<span class="wpbc_modal__add_booking__title"><?php esc_html_e( 'Add booking', 'booking' ); ?></span>
									<sup class="wpbc_modal__add_booking__booking_id wpbc_modal__booking_id__in_title"></sup>
								</h4>
								<div class="wpbc_modal__add_booking__controls">
									<?php self::print_modal_resource_select(); ?>
									<?php self::print_modal_booking_form_select(); ?>
									<?php self::print_modal_allow_past_toggle(); ?>
								</div>
							</div>
						</div>
						<div class="modal-body">
							<div id="wpbc_modal__add_booking__body" class="wpbc_modal__add_booking__body">
								<?php self::print_loading_spinner(); ?>
							</div>
						</div>
						<div class="modal-footer">
							<div class="wpbc_modal__add_booking__footer_time_override" data-wpbc-add-booking-time-override-footer="1"></div>
							<?php self::print_modal_send_emails_toggle(); ?>
							<a href="javascript:void(0)" id="wpbc_modal__add_booking__button_send" class="button button-primary" onclick="wpbc_boo_listing__submit__add_booking_modal();">
								<?php esc_html_e( 'Add booking', 'booking' ); ?>
							</a>
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


	/**
	 * Print modal-scoped email notification toggle.
	 *
	 * The legacy Add Booking page uses #is_send_email_for_pending. Timeline uses the same id,
	 * so the modal needs its own id to avoid cross-toggling that page control.
	 *
	 * @return void
	 */
	private static function print_modal_send_emails_toggle() {

		$el_id    = 'wpbc_modal__add_booking__is_send_email_for_pending';
		$el_value = ( get_bk_option( 'booking_send_emails_off_addbooking' ) !== 'On' ) ? 'On' : 'Off';

		$params_checkbox = array(
			'id'       => $el_id,
			'name'     => $el_id,
			'label'    => array( 'title' => __( 'Emails sending', 'booking' ), 'position' => 'right' ),
			'style'    => '',
			'class'    => '',
			'disabled' => false,
			'attr'     => array(
				'data-wpbc-add-booking-send-emails' => '1',
			),
			'legend'   => '',
			'value'    => $el_value,
			'selected' => ( 'On' === $el_value ),
			'hint'     => array( 'title' => __( 'Send email notification to customer about this operation', 'booking' ), 'position' => 'top' ),
		);
		?>
		<div class="btn-group" style="position:static;margin:0 10px 0 0;display:inline-flex;vertical-align:middle;">
			<?php wpbc_flex_toggle( $params_checkbox ); ?>
		</div>
		<?php
	}


	/**
	 * Print modal-scoped toggle for allowing bookings in the past.
	 *
	 * @return void
	 */
	private static function print_modal_allow_past_toggle() {

		$el_id = 'wpbc_modal__add_booking__allow_past';

		$params_checkbox = array(
			'id'       => $el_id,
			'name'     => $el_id,
			'label'    => array( 'title' => __( 'Allow booking in the past', 'booking' ), 'position' => 'right' ),
			'style'    => '',
			'class'    => '',
			'disabled' => false,
			'attr'     => array(
				'data-wpbc-add-booking-allow-past' => '1',
			),
			'legend'   => '',
			'value'    => 'On',
			'selected' => false,
			'hint'     => array( 'title' => __( 'Allow booking in the past', 'booking' ), 'position' => 'top' ),
		);
		?>
		<div class="wpbc_modal__add_booking__control wpbc_modal__add_booking__allow_past_control btn-group" style="position:static;margin:0 0 0 6px;display:inline-flex;vertical-align:middle;">
			<?php wpbc_flex_toggle( $params_checkbox ); ?>
		</div>
		<?php
	}


	/**
	 * Print modal loading spinner.
	 *
	 * @return void
	 */
	private static function print_loading_spinner() {
		?>
		<div class="wpbc_spins_loading_container">
			<div class="wpbc_booking_form_spin_loader">
				<div class="wpbc_spins_loader_wrapper">
					<div class="wpbc_spin_loader_one_new"></div>
				</div>
			</div>
			<span><?php esc_html_e( 'Loading', 'booking' ); ?>...</span>
		</div>
		<?php
	}


	/**
	 * Print booking resource selector for the modal header.
	 *
	 * @return void
	 */
	private static function print_modal_resource_select() {

		$selected_resource = absint( wpbc_get_default_resource() );
		$selected_resource = $selected_resource ? $selected_resource : 1;
		$resources         = self::get_booking_resource_options();
		?>
		<label class="wpbc_modal__add_booking__control wpbc_modal__add_booking__resource_control" for="wpbc_modal__add_booking__resource_id">
			<span><?php esc_html_e( 'Resource', 'booking' ); ?>:</span>
			<select id="wpbc_modal__add_booking__resource_id" class="wpbc_modal__add_booking__resource_id">
				<?php foreach ( $resources as $resource_id => $resource ) : ?>
					<option value="<?php echo esc_attr( absint( $resource_id ) ); ?>" <?php selected( absint( $resource_id ), $selected_resource ); ?>>
						<?php echo esc_html( $resource['title'] ); ?>
					</option>
				<?php endforeach; ?>
			</select>
		</label>
		<?php
	}


	/**
	 * Print custom booking form selector for the modal header.
	 *
	 * @return void
	 */
	private static function print_modal_booking_form_select() {

		$form_options = self::get_booking_form_options();
		if ( count( $form_options ) <= 1 ) {
			return;
		}
		?>
		<label class="wpbc_modal__add_booking__control wpbc_modal__add_booking__form_control" for="wpbc_modal__add_booking__booking_form">
			<span><?php esc_html_e( 'Booking Form', 'booking' ); ?>:</span>
			<select id="wpbc_modal__add_booking__booking_form" class="wpbc_modal__add_booking__booking_form">
				<?php foreach ( $form_options as $form_name => $form_title ) : ?>
					<option value="<?php echo esc_attr( $form_name ); ?>">
						<?php echo esc_html( $form_title ); ?>
					</option>
				<?php endforeach; ?>
			</select>
		</label>
		<?php self::print_modal_booking_form_edit_link(); ?>
		<?php
	}


	/**
	 * Print link to edit currently selected form in Forms Builder.
	 *
	 * @return void
	 */
	private static function print_modal_booking_form_edit_link() {

		if ( ! defined( 'WPBC_NEW_FORM_BUILDER' ) || ! WPBC_NEW_FORM_BUILDER || ! function_exists( 'wpbc_get_settings_url' ) ) {
			return;
		}

		$base_url = add_query_arg(
			array(
				'tab'       => 'builder_booking_form',
				'form_name' => 'standard',
			),
			wpbc_get_settings_url()
		);
		?>
		<a href="<?php echo esc_url( $base_url ); ?>"
		   class="wpbc_modal__add_booking__edit_form_link"
		   data-wpbc-add-booking-form-builder-url="<?php echo esc_url( remove_query_arg( 'form_name', $base_url ) ); ?>"
		   target="_blank"
		   rel="noopener noreferrer"
		   title="<?php esc_attr_e( 'Edit selected booking form', 'booking' ); ?>">
			<i class="menu_icon icon-1x wpbc_icn_draw"></i>
			<span><?php esc_html_e( 'Edit form', 'booking' ); ?></span>
		</a>
		<?php
	}


	/**
	 * Enqueue client booking-form scripts required by the modal body.
	 *
	 * @param string $where_to_load Load context.
	 *
	 * @return void
	 */
	public static function enqueue_js_files( $where_to_load ) {

		if ( ! self::is_supported_admin_page() || ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) {
			return;
		}

		wp_enqueue_script( 'wpbc-main-client', wpbc_plugin_url( '/js/client.js' ), array( 'wpbc-datepick' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
		wp_enqueue_script( 'wpbc_capacity', wpbc_plugin_url( '/includes/_capacity/_out/create_booking.js' ), array( 'wpbc-main-client' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
		wp_enqueue_script( 'wpbc-times', wpbc_plugin_url( '/js/wpbc_times.js' ), array( 'wpbc-main-client' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
		wp_enqueue_script( 'wpbc-time-selector', wpbc_plugin_url( '/js/wpbc_time-selector.js' ), array( 'wpbc-times' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
		wp_enqueue_script( 'wpbc-imask', wpbc_plugin_url( '/vendors/imask/dist/imask.js' ), array( 'wpbc-main-client' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
		wp_enqueue_script( 'wpbc-boo_listing_ajx_actions', wpbc_plugin_url( '/includes/page-bookings/_out/boo_listing__actions.js' ), array( 'wpbc_all', 'wpbc-modal' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );

		if ( 'On' === get_bk_option( 'booking_is_use_phone_validation' ) ) {
			wp_enqueue_script( 'wpbc-iphone-validator', wpbc_plugin_url( '/js/wpbc_phone_validator.js' ), array( 'wpbc-imask' ), WP_BK_VERSION_NUM, array( 'in_footer' => WPBC_JS_IN_FOOTER ) );
		}
	}


	/**
	 * Enqueue front-end booking-form styles required by the modal body.
	 *
	 * @param string $where_to_load Load context.
	 *
	 * @return void
	 */
	public static function enqueue_css_files( $where_to_load ) {

		if ( ! self::is_supported_admin_page() || ! in_array( $where_to_load, array( 'admin', 'both' ), true ) ) {
			return;
		}

		if ( function_exists( 'wpbc_enqueue_styles__front_end' ) ) {
			wpbc_enqueue_styles__front_end();
		}
	}


	/**
	 * AJAX: render Add Booking modal body.
	 *
	 * @return void
	 */
	public static function ajax_render() {

		check_ajax_referer( strtolower( self::AJAX_ACTION ) . '_wpbcnonce', 'nonce' );

		if ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) ) {
			wp_send_json_error( array( 'message' => __( 'You do not have access to this page.', 'booking' ) ), 403 );
		}

		$args = self::get_clean_request_args();

		if ( ( 'add' === $args['mode'] ) && ! WPBC_Add_Booking_Component::current_user_can_add_booking() ) {
			wp_send_json_error( array( 'message' => __( 'You do not have access to this page.', 'booking' ) ), 403 );
		}

		if ( empty( $args['resource_id'] ) ) {
			$args['resource_id'] = wpbc_get_default_resource();
		}

		if ( empty( $args['resource_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Booking resource type is not defined.', 'booking' ) ), 400 );
		}

		if (
			class_exists( 'wpdev_bk_multiuser' )
			&& ! wpbc_is_mu_user_can_be_here( 'resource_owner', $args['resource_id'] )
		) {
			wp_send_json_error( array( 'message' => __( 'You do not have access to this booking resource.', 'booking' ) ), 403 );
		}

		if ( ( 'add' === $args['mode'] ) && ( '' === (string) $args['booking_form'] ) ) {
			$args['booking_form']        = WPBC_Add_Booking_Component::get_default_booking_form_for_resource( $args['resource_id'], 'standard' );
			$args['custom_booking_form'] = $args['booking_form'];
		}

		$html = self::render_component_with_legacy_request_context( $args );

		wp_send_json_success(
			array(
				'html'         => $html,
				'resource_id'  => absint( $args['resource_id'] ),
				'booking_hash' => (string) $args['booking_hash'],
				'mode'         => (string) $args['mode'],
				'title'        => ( 'edit' === $args['mode'] ) ? __( 'Edit booking', 'booking' ) : __( 'Add booking', 'booking' ),
				'button_title' => ( 'edit' === $args['mode'] ) ? __( 'Save booking', 'booking' ) : __( 'Add booking', 'booking' ),
				'booking_id'   => absint( $args['booking_id'] ),
				'booking_form' => (string) $args['booking_form'],
				'allow_past'   => absint( $args['allow_past'] ),
				'selected_dates_without_calendar' => (string) $args['selected_dates_without_calendar'],
				'selected_dates' => (string) $args['selected_dates'],
				'selected_date' => (string) $args['selected_date'],
				'selected_time' => (string) $args['selected_time'],
				'time_override_enabled' => absint( $args['time_override_enabled'] ),
				'time_override_source'  => (string) $args['time_override_source'],
				'time_override_start'   => (string) $args['time_override_start'],
				'time_override_end'     => (string) $args['time_override_end'],
			)
		);
	}


	/**
	 * Get sanitized request args.
	 *
	 * @return array
	 */
	private static function get_clean_request_args() {

		$mode = isset( $_POST['mode'] ) ? sanitize_key( wp_unslash( $_POST['mode'] ) ) : 'add';                         // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$mode = in_array( $mode, array( 'add', 'edit' ), true ) ? $mode : 'add';

		$booking_hash = isset( $_POST['booking_hash'] ) ? sanitize_text_field( wp_unslash( $_POST['booking_hash'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$resource_id  = isset( $_POST['resource_id'] ) ? absint( $_POST['resource_id'] ) : 0;                           // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$booking_id   = isset( $_POST['booking_id'] ) ? absint( $_POST['booking_id'] ) : 0;                             // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$booking_form = isset( $_POST['booking_form'] ) ? sanitize_text_field( wp_unslash( $_POST['booking_form'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$allow_past   = isset( $_POST['allow_past'] ) ? absint( $_POST['allow_past'] ) : 0;                              // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$selected_dates_without_calendar = isset( $_POST['selected_dates_without_calendar'] ) ? sanitize_text_field( wp_unslash( $_POST['selected_dates_without_calendar'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$selected_dates = isset( $_POST['selected_dates'] ) ? sanitize_text_field( wp_unslash( $_POST['selected_dates'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$selected_date = isset( $_POST['selected_date'] ) ? sanitize_text_field( wp_unslash( $_POST['selected_date'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$selected_time = isset( $_POST['selected_time'] ) ? sanitize_text_field( wp_unslash( $_POST['selected_time'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$time_override_enabled = isset( $_POST['time_override_enabled'] ) ? absint( $_POST['time_override_enabled'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$time_override_source  = isset( $_POST['time_override_source'] ) ? sanitize_key( wp_unslash( $_POST['time_override_source'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$time_override_start   = isset( $_POST['time_override_start'] ) ? self::sanitize_time_hm( wp_unslash( $_POST['time_override_start'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$time_override_end     = isset( $_POST['time_override_end'] ) ? self::sanitize_time_hm( wp_unslash( $_POST['time_override_end'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing

		if ( '' !== $booking_hash ) {
			$hash_resource = wpbc_hash__get_booking_id__resource_id( $booking_hash );
			if ( false === $hash_resource ) {
				wp_send_json_error( array( 'message' => __( 'We could not find your booking. The link you used may be incorrect or has expired.', 'booking' ) ), 404 );
			}

			$booking_id  = absint( $hash_resource[0] );
			$resource_id = absint( $hash_resource[1] );
			$mode        = 'edit';
			$allow_past  = 1;
		}

		return array(
			'mode'                         => $mode,
			'resource_id'                  => $resource_id,
			'booking_type'                 => $resource_id,
			'booking_id'                   => $booking_id,
			'booking_hash'                 => $booking_hash,
			'booking_form'                 => $booking_form,
			'custom_booking_form'          => $booking_form,
			'allow_past'                   => $allow_past ? 1 : 0,
			'selected_dates_without_calendar' => $selected_dates_without_calendar,
			'selected_dates'               => $selected_dates,
			'selected_date'                => $selected_date,
			'selected_time'                => $selected_time,
			'time_override_enabled'        => ( $time_override_enabled && $time_override_start && $time_override_end ) ? 1 : 0,
			'time_override_source'         => $time_override_source,
			'time_override_start'          => $time_override_start,
			'time_override_end'            => $time_override_end,
			'is_toolbar_visible'           => false,
			'is_booking_page_js'           => false,
			'is_booking_page_popover'      => false,
			'is_show_before_content_spacer'=> false,
			'is_show_footer_email_toggle'  => false,
			'content_css_class'            => 'add_booking_page_content wpbc_add_booking_component__in_modal',
			'content_style'                => 'width:100%;margin-bottom:20px;',
			'is_echo'                      => 0,
		);
	}


	/**
	 * Sanitize HH:MM time value.
	 *
	 * @param string $time_value Time value.
	 *
	 * @return string
	 */
	private static function sanitize_time_hm( $time_value ) {

		$time_value = trim( sanitize_text_field( (string) $time_value ) );

		if ( ! preg_match( '/^([0-9]{1,2}):([0-9]{2})$/', $time_value, $matches ) ) {
			return '';
		}

		$hour   = absint( $matches[1] );
		$minute = absint( $matches[2] );

		if ( $hour > 24 || $minute > 59 || ( 24 === $hour && 0 !== $minute ) ) {
			return '';
		}

		return sprintf( '%02d:%02d', $hour, $minute );
	}


	/**
	 * Render the component with a scoped legacy request context for older renderers that still read $_GET.
	 *
	 * @param array $args Component args.
	 *
	 * @return string
	 */
	private static function render_component_with_legacy_request_context( $args ) {

		$old_get         = $_GET;
		$old_request     = $_REQUEST;
		$old_request_uri = isset( $_SERVER['REQUEST_URI'] ) ? $_SERVER['REQUEST_URI'] : '';

		$query_args = array(
			'page'                 => 'wpbc',
			'tab'                  => 'add-booking',
			'booking_type'         => absint( $args['resource_id'] ),
			'is_show_payment_form' => 'Off',
		);

		if ( '' !== $args['booking_hash'] ) {
			$query_args['booking_hash'] = $args['booking_hash'];
			$query_args['parent_res']   = 1;
		}

		if ( ! empty( $args['allow_past'] ) || ( '' !== $args['booking_hash'] ) ) {
			$query_args['allow_past'] = 1;
		}

		if ( '' !== $args['booking_form'] ) {
			$query_args['booking_form'] = $args['booking_form'];
		}

		foreach ( $query_args as $key => $value ) {
			$_GET[ $key ]     = $value;
			$_REQUEST[ $key ] = $value;
		}

		$_SERVER['REQUEST_URI'] = wp_parse_url( admin_url( 'admin.php' ), PHP_URL_PATH ) . '?' . http_build_query( $query_args, '', '&' );

		try {
			return WPBC_Add_Booking_Component::render( $args );
		} finally {
			$_GET                  = $old_get;
			$_REQUEST              = $old_request;
			$_SERVER['REQUEST_URI'] = $old_request_uri;
		}
	}


	/**
	 * Get booking resource options for the modal selector.
	 *
	 * @return array
	 */
	private static function get_booking_resource_options() {

		$resources = array();

		if ( function_exists( 'wpbc_get_all_booking_resources_list' ) ) {
			$resources = wpbc_get_all_booking_resources_list();
		}

		if ( empty( $resources ) ) {
			$default_resource = absint( wpbc_get_default_resource() );
			$default_resource = $default_resource ? $default_resource : 1;
			$resources        = array(
				$default_resource => array(
					'title' => __( 'Default', 'booking' ),
					'attr'  => array(),
				),
			);
		}

		return $resources;
	}


	/**
	 * Get booking form options for the modal selector.
	 *
	 * @return array
	 */
	private static function get_booking_form_options() {

		$options = array(
			'standard' => __( 'Standard', 'booking' ),
		);

		if ( ! class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
			return $options;
		}

		$is_can = apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
		if ( ( ! $is_can ) && ( 'On' !== get_bk_option( 'booking_is_custom_forms_for_regular_users' ) ) ) {
			return $options;
		}

		$owner_user_id = WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id();
		$forms         = WPBC_FE_Custom_Form_Helper::get_custom_booking_forms_list(
			array(
				'include_standard' => false,
				'owner_user_id'    => $owner_user_id,
				'statuses'         => array( 'published' ),
				'list_mode'        => 'auto',
			)
		);

		foreach ( $forms as $form ) {
			if ( empty( $form['name'] ) ) {
				continue;
			}
			$form_title              = ! empty( $form['title'] ) ? $form['title'] : $form['name'];
			$options[ $form['name'] ] = wpbc_lang( $form_title );
		}

		return $options;
	}


	/**
	 * Check if assets should be loaded for Booking Listing or Timeline view.
	 *
	 * @return bool
	 */
	public static function is_supported_admin_page() {

		if ( ! is_admin() ) {
			return false;
		}

		if ( function_exists( 'wpbc_is_availability_page' ) && wpbc_is_availability_page() ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$requested_tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';
			return ( 'time_slots_availability' === $requested_tab );
		}

		if ( function_exists( 'wpbc_is_bookings_page' ) ) {
			if ( ! wpbc_is_bookings_page() ) {
				return false;
			}
		} else {
			$server_request_uri = ( isset( $_SERVER['REQUEST_URI'] ) ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			if ( ( false === strpos( $server_request_uri, 'page=wpbc' ) ) || ( false !== strpos( $server_request_uri, 'page=wpbc-' ) ) ) {
				return false;
			}
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		$requested_tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';
		if ( '' !== $requested_tab ) {
			return in_array( $requested_tab, array( 'vm_booking_listing', 'vm_calendar' ), true );
		}

		if ( function_exists( 'wpbc_get_default_saved_view_mode_for_wpbc_page' ) ) {
			return in_array( wpbc_get_default_saved_view_mode_for_wpbc_page(), array( 'vm_booking_listing', 'vm_calendar' ), true );
		}

		return true;
	}


	/**
	 * Backward-compatible alias for existing Add Booking modal checks.
	 *
	 * @return bool
	 */
	public static function is_booking_listing_admin_page() {

		return self::is_supported_admin_page();
	}
}

/**
 * Check if Booking Listing or Timeline needs the Add Booking modal client assets.
 *
 * @return bool
 */
if ( ! function_exists( 'wpbc_is_add_booking_modal_on_booking_listing_page' ) ) {
	/**
	 * Check if Booking Listing or Timeline needs the Add Booking modal client assets.
	 *
	 * @return bool
	 */
	function wpbc_is_add_booking_modal_on_booking_listing_page() {
		return WPBC_Add_Booking_Modal::is_supported_admin_page();
	}
}

add_action( 'wpbc_ui_el__top_nav__content_end', array( 'WPBC_Add_Booking_Modal', 'print_top_toolbar_button' ), 19, 3 );
add_action( 'wpbc_hook_booking_template__hidden_templates', array( 'WPBC_Add_Booking_Modal', 'template_for_modal' ) );
add_action( 'wpbc_enqueue_js_files', array( 'WPBC_Add_Booking_Modal', 'enqueue_js_files' ), 52 );
add_action( 'wpbc_enqueue_css_files', array( 'WPBC_Add_Booking_Modal', 'enqueue_css_files' ), 52 );
add_action( 'wp_ajax_' . WPBC_Add_Booking_Modal::AJAX_ACTION, array( 'WPBC_Add_Booking_Modal', 'ajax_render' ) );
