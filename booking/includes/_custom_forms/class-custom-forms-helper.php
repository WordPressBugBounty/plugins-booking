<?php
/**
 * Description.
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.x
 * @file        ../W:/w3/beta/www/wp-content/plugins/booking/includes/_front_end\class-custom-forms-helper.php.php
 *
 * @modified    2026-02-22 15:22
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}


/**
 * Custom Form Helper.
 *
 * @since 11.0.x.
 */
class WPBC_FE_Custom_Form_Helper {

	/**
	 * List available booking forms (standard + legacy + BFB).
	 *
	 * Returned array format:
	 * array(
	 *   'standard' => array( 'title' => '...', 'engine' => 'standard', 'name' => '' ),
	 *   'myform'   => array( 'title' => '...', 'engine' => 'legacy',   'name' => 'myform' ),
	 *   'mybfb'    => array( 'title' => '...', 'engine' => 'bfb',      'name' => 'mybfb', 'id' => 12, 'status' => 'published' ),
	 * )
	 *
	 * @param array $params   - array(
	 *		'include_standard' => true,                 - include_standard (bool) default true .
	 *		'owner_user_id'    => 0,                    - owner_user_id (int)     default 0  (0 = no filter) .
	 *		'statuses'         => array( 'published' ), - statuses (array)        default array('published') .
	 *		'list_mode'        => 'auto',               - list_mode (string)      auto|legacy|bfb|both (default auto)   // auto|legacy|bfb|both .
	 *	)
	 *
	 * @return array
	 */
	public static function get_custom_booking_forms_list( $params = array() ) {

		$params = wp_parse_args(
			$params,
			array(
				'include_standard' => true,
				'owner_user_id'    => 0,
				'statuses'         => array( 'published' ),
				'list_mode'        => 'auto',                                 // auto | legacy | bfb | both.
			)
		);

		$forms_list_arr = array();

		// 1) Standard.
		if ( ! empty( $params['include_standard'] ) ) {
			$forms_list_arr['standard'] = array(
				'title'  => __( 'Standard booking form', 'booking' ),
				'engine' => 'standard',
				'name'   => '',
			);
		}

		// Decide list mode.
		$list_mode = sanitize_key( (string) $params['list_mode'] );
		if ( ! in_array( $list_mode, array( 'auto', 'legacy', 'bfb', 'both' ), true ) ) {
			$list_mode = 'auto';
		}

		if ( 'auto' === $list_mode ) {
			$list_mode = WPBC_Frontend_Settings::is_bfb_enabled( null ) ? 'bfb' : 'legacy';
		}

		// 2) Legacy.
		if ( in_array( $list_mode, array( 'legacy', 'both' ), true ) ) {

			$legacy_forms = get_bk_option( 'booking_forms_extended' );
			$legacy_forms = ( ! empty( $legacy_forms ) ) ? maybe_unserialize( $legacy_forms ) : array();

			if ( is_array( $legacy_forms ) ) {
				foreach ( $legacy_forms as $legacy_name => $legacy_data ) {

					$legacy_name = sanitize_text_field( (string) $legacy_name );
					if ( '' === $legacy_name || 'standard' === $legacy_name ) {
						continue;
					}

					$title = $legacy_name;
					if ( is_array( $legacy_data ) && isset( $legacy_data['title'] ) ) {
						$title = sanitize_text_field( (string) $legacy_data['title'] );
						if ( '' === $title ) {
							$title = $legacy_name;
						}
					}

					$forms_list_arr[ $legacy_name ] = array(
						'title'  => $title,
						'engine' => 'legacy',
						'name'   => $legacy_name,
					);
				}
			}
		}

		// 3) BFB.
		if ( in_array( $list_mode, array( 'bfb', 'both' ), true ) ) {

			global $wpdb;

			$owner_user_id = absint( $params['owner_user_id'] );

			$statuses = ( isset( $params['statuses'] ) && is_array( $params['statuses'] ) ) ? $params['statuses'] : array();
			$statuses = array_values( array_filter( array_map( 'sanitize_key', $statuses ) ) );
			if ( empty( $statuses ) ) {
				$statuses = array( 'published' );
			}

			$where = array();
			$args  = array();

			$in_placeholders = implode( ',', array_fill( 0, count( $statuses ), '%s' ) );
			$where[]         = "status IN ($in_placeholders)";
			$args            = array_merge( $args, $statuses );

			// FixIn: 2026-03-08.
			// if ( $owner_user_id > 0 ) {
				$where[] = 'owner_user_id = %d';
				$args[]  = $owner_user_id;
			// }

			$sql = "SELECT booking_form_id, form_slug, owner_user_id, status
				FROM {$wpdb->prefix}booking_form_structures
				WHERE " . implode( ' AND ', $where ) . '
				ORDER BY is_default DESC, updated_at DESC, version DESC, booking_form_id DESC
				LIMIT 500';

			$wpdb->last_error = '';

			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
			$rows = $wpdb->get_results( $wpdb->prepare( $sql, $args ), ARRAY_A );

			if ( empty( $wpdb->last_error ) && ! empty( $rows ) ) {
				foreach ( $rows as $row ) {

					$form_slug = isset( $row['form_slug'] ) ? sanitize_text_field( (string) $row['form_slug'] ) : '';
					if ( '' === $form_slug ) {
						continue;
					}

					$forms_list_arr[ $form_slug ] = array(
						'title'         => $form_slug, // slug as label.
						'engine'        => 'bfb',
						'name'          => $form_slug,
						'id'            => isset( $row['booking_form_id'] ) ? absint( $row['booking_form_id'] ) : 0,
						'status'        => isset( $row['status'] ) ? sanitize_key( (string) $row['status'] ) : '',
						'owner_user_id' => isset( $row['owner_user_id'] ) ? absint( $row['owner_user_id'] ) : 0,
					);
				}
			}
		}

		return $forms_list_arr;
	}


	public static function get_default_custom_form__for__booking_resource( $booking_resource_id ) {

		$default_custom_form = 'standard';

		if ( ! class_exists( 'wpdev_bk_biz_m' ) ) {
			return $default_custom_form;
		}

		global $wpdb;
		$wpdb->last_error = '';

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$result = $wpdb->get_row( $wpdb->prepare( "SELECT default_form FROM {$wpdb->prefix}bookingtypes  WHERE booking_type_id = %d ", $booking_resource_id ) );

		// If table does not exist or query fails, do not fatal — just skip.
		if ( empty( $wpdb->last_error ) && ! empty( $result ) ) {
			return $result->default_form;
		}

		return $default_custom_form;
	}

	/**
	 * Get ID of current logged in user in MU logic. If user super admin, then return 0.
	 *
	 * @return int  return ( > 0 ) only for the "regular users"  in MU context.
	 */
	public static function wpbc_mu__get_current__owner_user_id() {
		// == MU owner logic ==
		$owner_user_id = 0;
		if ( class_exists( 'wpdev_bk_multiuser' ) ) {
			$current_user_id     = wpbc_get_current_user_id();
			$is_user_super_admin = apply_bk_filter( 'is_user_super_admin', $current_user_id );
			if ( ! $is_user_super_admin ) {
				$owner_user_id = $current_user_id;
			}
		}

		return $owner_user_id;
	}

	// == HMTL =========================================================================================================
	/**
	 * Custom booking forms - HTML Selectbox -> WP Booking Calendar > Add Booking page.
	 *
	 * @return void
	 */
	public static function wpbc_bfb__custom_booking_forms_list__selectbox_html( $params = array() ) {

		// == Legacy | Check if we can be here. ==
		$is_can = apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
		if ( ( ! $is_can ) && ( get_bk_option( 'booking_is_custom_forms_for_regular_users' ) !== 'On' ) ) {
			return;
		}

		// == MU owner logic ==
		$owner_user_id = self::wpbc_mu__get_current__owner_user_id();

		$form_params = array(
			'include_standard' => false,
			'owner_user_id'    => $owner_user_id,
			'statuses'         => array( 'published' ),
			'list_mode'        => 'auto',                    // auto | legacy | bfb | both.
		);
		$booking_forms_extended = self::get_custom_booking_forms_list( $form_params );

		if ( empty( $booking_forms_extended ) ) {
			return array();
		}

		$defaults = array(
			'on_change' => false,
			'title'     => __( 'Booking Form', 'booking' ) . ':',
		);
		$params   = wp_parse_args( $params, $defaults );

		// -------------------------------------------------------------------------------------------------------------

		// == Check  if selected booking resource,  which has default custom booking form ==
		$selected_booking_resource = isset( $_GET['booking_type'] ) ? intval( $_GET['booking_type'] ) : 0;              // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing

		// Set Default custom booking form for specific selected booking resource.
		if ( ( $selected_booking_resource > 0 ) && ( ! isset( $_GET['booking_form'] ) ) ) {                             // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$my_booking_form_name = self::get_default_custom_form__for__booking_resource( $selected_booking_resource );
			if ( ! empty( $my_booking_form_name ) ) {
				$_GET['booking_form'] = $my_booking_form_name;
			}
		}

		// -------------------------------------------------------------------------------------------------------------

		$get_parameter_name = 'booking_form';

		if ( false === $params['on_change'] ) {
			$link_base = wpbc_get_new_booking_url__base( array( $get_parameter_name ) ) . '&' . $get_parameter_name . '=';
			$on_change = 'location.href=\'' . $link_base . '\' + this.value;';
		} else {
			$on_change = $params['on_change'];
		}

		// Show DropDown list with Custom forms selection.
		wpbc_dropdown_list_with_custom_forms__free( $booking_forms_extended, $on_change, $params );
	}

	/**
	 * Custom booking forms - HTML Selectbox -> Modal Shortcode
	 *
	 * @param array $params   - [
	 *                           'name'        => $id,
	 *						     'title'       => __( 'Booking Form', 'booking' ),
	 *						     'description' => __( 'Select custom booking form', 'booking' ),
	 *						     'group'       => $group_key,
	 *                          ]
	 * @return void
	 */
	public static function wpbc_bfb__custom_booking_forms_list__selectbox_html__sh_modal( $params ){

		// == Legacy | Check if we can be here. ==
		$is_can = apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
		if ( ( ! $is_can ) && ( get_bk_option( 'booking_is_custom_forms_for_regular_users' ) !== 'On' ) ) {
			return;
		}

		// == MU owner logic ==
		$owner_user_id = self::wpbc_mu__get_current__owner_user_id();

		$form_params = array(
			'include_standard' => false,
			'owner_user_id'    => $owner_user_id,
			'statuses'         => array( 'published' ),
			'list_mode'        => 'auto',                    // auto | legacy | bfb | both.
		);

		$booking_forms_extended = self::get_custom_booking_forms_list( $form_params );

		if ( empty( $booking_forms_extended ) ) {
			return array();
		}

		// -----------------------------------------------------------------------------------------------------------------

		$defaults = array(
			'name'         => 'select_booking_form',
			'title'        => __( 'Booking Form', 'booking' ),
			'description'  => __( 'Select default custom booking form', 'booking' ),
			'group'        => 'general',
			'init_options' => array(),                             // Init default list of options.
		);
		$params   = wp_parse_args( $params, $defaults );


		$form_options             = $params['init_options'];
		$form_options['standard'] = array(
			'title' => __( 'Standard', 'booking' ),
			'class' => '',
			'attr'  => array( 'style' => '' ),
		);

		$form_options['optgroup_cf_s'] = array( 'optgroup' => true, 'close' => false, 'title' => '&nbsp;' . __( 'Custom Forms', 'booking' ) );

		foreach ( $booking_forms_extended as $cust_form ) {

			$form_options[ $cust_form['name'] ] = array(
				'title' => wpbc_lang( $cust_form['name'] ),
				'attr'  => array(),
			);
		}

		$form_options['optgroup_cf_e'] = array( 'optgroup' => true, 'close' => true );

		WPBC_Settings_API::field_select_row_static(
			$params['name'],
			array(
				'type'             => 'select',
				'title'            => $params['title'],
				'label'            => '',
				'disabled'         => false,
				'disabled_options' => array(),
				'multiple'         => false,
				'description'      => $params['description'],
				'description_tag'  => 'span',
				'tr_class'         => $params['group'] . '_standard_section',
				'group'            => $params['group'],
				'class'            => '',
				'css'              => 'margin-right:10px;',
				'only_field'       => false,
				'attr'             => array(),
				'value'            => '',
				'options'          => $form_options,
			)
		);
	}

	/**
	 * Custom booking forms - HTML Selectbox ->  Resource Table Field.
	 *
	 * @param $row_num
	 * @param $resource - array(
	 *                  [booking_type_id] => 1
	 *                  [title] => Default
	 *                  [users] => 1
	 *                  [import] =>
	 *                  [export] =>
	 *                  [cost] => 25
	 *                  [default_form] => standard
	 *                  [prioritet] => 0
	 *                  [parent] => 0
	 *                  [visitors] => 1
	 *                  [id] => 1
	 *                  [count] => 6
	 * )
	 *
	 * @return void
	 */
	public static function wpbc_bfb__custom_booking_forms_list__selectbox_html__in_resource_table( $row_num, $resource ){

		$is_bfb_enabled = (bool) WPBC_Frontend_Settings::is_bfb_enabled( null );
		if ( ! $is_bfb_enabled ) {
			return;
		}

		// == Legacy | Check if we can be here. ==
		$is_can = apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
		if ( ( ! $is_can ) && ( get_bk_option( 'booking_is_custom_forms_for_regular_users' ) !== 'On' ) ) {
			return;
		}

		// == MU owner logic ==
		if ( class_exists( 'wpdev_bk_multiuser' ) ) {                                    // Check what to show in MU		// FixIn: 8.1.3.19.
			$is_booking_resource_user_super_admin = apply_bk_filter( 'is_user_super_admin', $resource['users'] );
		} else {
			$is_booking_resource_user_super_admin = true;
		}

		if ($is_booking_resource_user_super_admin){
			$owner_user_id = 0;
		} else {
			$owner_user_id = absint( $resource[ 'users' ] );
		}


		$form_params = array(
			'include_standard' => false,
			'owner_user_id'    => $owner_user_id,
			'statuses'         => array( 'published' ),
			'list_mode'        => 'auto',                    // auto | legacy | bfb | both.
		);

		$booking_forms_extended = self::get_custom_booking_forms_list( $form_params );

		if ( empty( $booking_forms_extended ) ) {
			return array();
		}

		// -------------------------------------------------------------------------------------------------------------

		$form_options = array();
		foreach ( $booking_forms_extended as $cust_form ) {

			$form_options[ $cust_form['name'] ] = array(
				'title'    => wpbc_lang( $cust_form['name'] ),
				'selected' => ( ( isset( $resource['default_form'] ) ) && ( $resource['default_form'] === $cust_form['name'] ) ),
			);
		}


		?><label for="booking_resource_default_form_<?php echo esc_attr( $resource['id' ] ); ?>"
				   class="wpbc_ui_control_label " style=""><span style="font-weight:400"><?php esc_html_e( 'Default Form', 'booking' ); ?>: </span></label><?php

		?><select autocomplete="off" id="booking_resource_default_form_<?php echo esc_attr( $resource['id' ] ); ?>"
									 name="booking_resource_default_form_<?php echo esc_attr( $resource['id' ] ); ?>"
									 class="wpbc_ui_control wpbc_ui_select"
			><?php

			?><option value="standard" style="padding:3px;border-bottom: 1px dashed #ccc;" ><?php echo esc_attr( __('Standard', 'booking') );  ?></option><?php

			?><optgroup label="<?php  echo esc_attr( '&nbsp;' . __('Custom Forms' ,'booking') ); ?>"><?php

				foreach ( $form_options as $option_value => $option_data ) {

					?><option value="<?php echo esc_attr( $option_value ); ?>"
						<?php selected(  $option_data['selected'], true ); ?>
					><?php echo esc_attr( $option_data['title'] ); ?></option><?php
				}

			?></optgroup><?php

		?></select><?php
	}

	/**
	 * Ovverides this function:      wpbc_toolbar__get_custom_forms__options_for_selection()
	 * and this method: self:get_custom_forms_arr__for_options()  overide this function:  wpbc_get_custom_forms_arr__for_options()
	 * @return array|void
	 */
	public static function wpbc_bfb__custom_booking_forms_list__selectbox_html__for_elementor() {

		$form_options             = array();
		$form_options['standard'] = array(
			'title'    => __( 'Standard', 'booking' ),
			'id'       => '',
			'name'     => '',
			'style'    => 'padding:3px;border-bottom: 1px dashed #ccc;',
			'class'    => '',
			'disabled' => false,
			'selected' => false,
			'attr'     => array(),
		);

		// -------------------------------------------------------------------------------------------------------------

		// == Legacy | Check if we can be here. ==
		$is_can = apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
		if ( ( ! $is_can ) && ( get_bk_option( 'booking_is_custom_forms_for_regular_users' ) !== 'On' ) ) {
			return $form_options;
		}

		// == MU owner logic ==
		$owner_user_id = self::wpbc_mu__get_current__owner_user_id();

		$form_params = array(
			'include_standard' => false,
			'owner_user_id'    => $owner_user_id,
			'statuses'         => array( 'published' ),
			'list_mode'        => 'auto',                    // auto | legacy | bfb | both.
		);

		$booking_forms_extended = self::get_custom_booking_forms_list( $form_params );

		if ( empty( $booking_forms_extended ) ) {
			return array();
		}


		// Show DropDown list with Custom forms selection.
		$form_options = self::get_custom_forms_arr__for_options( $booking_forms_extended );

		return $form_options;
	}

	/**
	 * Get array with Custom Forms - prepared for selectbox options
	 *
	 * @param $booking_forms_extended
	 *
	 * @return array
	 */
	protected static function get_custom_forms_arr__for_options( $booking_forms_extended ) {

		$form_options = array();

		$form_options['standard'] = array(
			'title'    => __( 'Standard', 'booking' ),
			'id'       => '',
			'name'     => '',
			'style'    => 'padding:3px;border-bottom: 1px dashed #ccc;',
			'class'    => '',
			'disabled' => false,
			'selected' => false,
			'attr'     => array(),
		);

		$form_options['optgroup_cf_s'] = array(
			'optgroup' => true,
			'close'    => false,
			'title'    => '&nbsp;' . __( 'Custom Forms', 'booking' ),
		);

		foreach ( $booking_forms_extended as $cust_form ) {

			$form_options[ $cust_form['name'] ] = array(
				'title'    => wpbc_lang( $cust_form['name'] ),
				'id'       => '',
				'name'     => '',
				'style'    => '',
				'class'    => '',
				'disabled' => false,
				'selected' => ( ( isset( $_GET['booking_form'] ) ) && ( $_GET['booking_form'] === $cust_form['name'] ) ),   // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
				'attr'     => array(),
			);
		}

		$form_options['optgroup_cf_e'] = array( 'optgroup' => true, 'close' => true );

		return $form_options;
	}

	// =================================================================================================================

	/**
	 * Maybe get the  'custom booking form name'  in the $_POST | $_ GET request
	 *
	 * @param string $request_type     - 'post' | 'get'.
	 * @param string $request_key_name - 'booking_form_type'.
	 *
	 * @return array|string|string[]
	 */
	public static function get__custom_form_name__in__post( $request_type = 'post', $request_key_name = 'booking_form_type' ) {

		$request_type = ( 'post' === $request_type ) ? 'post' : 'get';

		$booking_form_name = '';

		if ( 'post' === $request_type ) {

			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$booking_form_name = isset( $_POST[ $request_key_name ] ) ? sanitize_text_field( wp_unslash( $_POST[ $request_key_name ] ) ) : '';
		} else {
			$booking_form_name = isset( $_GET[ $request_key_name ] ) ? sanitize_text_field( wp_unslash( $_GET[ $request_key_name ] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		}

		// Legacy escaping.
		$booking_form_name = str_replace( "\'", '', $booking_form_name );

		if ( 'standard' === $booking_form_name ) {
			// Form does not exist.
			$booking_form_name = '';
		}

		return $booking_form_name;
	}

	/**
	 * Maybe get the  'custom booking form name'  from  the "Content of booking fields data" from parameter:  ~text^wpbc_custom_booking_form + resource_ID^custom_form_name
	 *
	 * @param string $booking_form_data - form  data,  e.g.:  'text^selected_short_timedates_hint1^...~text^nights_number_hint1^0~text^cost_hint1^&#036;0.00~text^name1^John~text^secondname1^Smith~email^email1^s@wpbookingcalendar.com~text^phone1^~selectbox-one^visitors1^1~selectbox-one^children1^0~textarea^details1^~coupon^coupon1^~checkbox^term_and_condition1[]^ .
	 * @param int    $resource_id       - ID of booking resource.
	 *
	 * @return mixed
	 */
	public static function get__custom_form_name__in__form_data( $booking_form_data, $resource_id ) {

		if ( false !== strpos( $booking_form_data, 'wpbc_custom_booking_form' . $resource_id . '^' ) ) {

			$parsed_booking_data_arr = wpbc_get_parsed_booking_data_arr( $booking_form_data, $resource_id, array( 'get' => 'value' ) );

			if ( ! empty( $parsed_booking_data_arr['wpbc_custom_booking_form'] ) ) {
					return $parsed_booking_data_arr['wpbc_custom_booking_form'];
			}
		}
		return '';
	}

	// =================================================================================================================

	/**
	 * Maybe implement 'custom booking form name'  parameter:  ~text^wpbc_custom_booking_form + resource_ID^custom_form_name
	 *
	 * @param string $booking_form_data - form  data,  e.g.:  'text^selected_short_timedates_hint1^...~text^nights_number_hint1^0~text^cost_hint1^&#036;0.00~text^name1^John~text^secondname1^Smith~email^email1^s@wpbookingcalendar.com~text^phone1^~selectbox-one^visitors1^1~selectbox-one^children1^0~textarea^details1^~coupon^coupon1^~checkbox^term_and_condition1[]^ .
	 * @param string $custom_form_name  - custom  booking form  name.
	 * @param int    $resource_id       - ID of booking resource.
	 *
	 * @return mixed
	 */
	public static function maybe_implement__custom_form_name__in__form_data( $booking_form_data, $custom_form_name, $resource_id ) {

		$resource_id       = absint( $resource_id );
		$booking_form_data = (string) $booking_form_data;
		$custom_form_name  = sanitize_text_field( (string) $custom_form_name );

		if ( $resource_id <= 0 || '' === $custom_form_name ) {
			return $booking_form_data;
		}

		if ( false === strpos( $booking_form_data, 'wpbc_custom_booking_form' . $resource_id . '^' ) ) {

			// We have no custom  form  name parameter,  so  need to  implement it.
			$booking_form_data .= '~text^wpbc_custom_booking_form' . $resource_id . '^' . $custom_form_name;
		}

		return $booking_form_data;
	}


	/**
	 * Get 'Advanced Costs' | 'Form Options Cost' of each field in booking form:  [ 'rangetime' => [  '10:00_-_15:00' = 115.0,  '16:00_-_21:30' = 135.0, ... ], ... ]
	 *
	 * @param string $booking_form_name - Optional  custom  booking form  name.
	 *
	 * @return array|mixed|string       - [ 'rangetime' => [  '10:00_-_15:00' = 115.0,  '16:00_-_21:30' = 135.0, ... ], ... ].
	 */
	public static function get_form_options_costs__fields_arr( $booking_form_name = '' ) {

		if ( ( empty( $booking_form_name ) ) || ( 'standard' === $booking_form_name ) ) {
			$booking_form_name = '';
		}

		$field__values = ( '' === $booking_form_name )
			? get_bk_option( 'booking_advanced_costs_values' )
			: get_bk_option( 'booking_advanced_costs_values_for' . $booking_form_name );

		$form_options_costs__fields_arr = ( ! empty( $field__values ) ) ? maybe_unserialize( $field__values ) : array();

		return $form_options_costs__fields_arr;
	}
}

add_action( 'wpbc_resources_table_show_col__customform_field', array( 'WPBC_FE_Custom_Form_Helper', 'wpbc_bfb__custom_booking_forms_list__selectbox_html__in_resource_table' ), 11, 2 );
/* Remove second "default custom booking form" of legacy  scripts,  if enabled BFB. */
add_action(
	'init',
	function () {
		$is_bfb_enabled = (bool) WPBC_Frontend_Settings::is_bfb_enabled( null );
		if ( $is_bfb_enabled ) {
			remove_action( 'wpbc_resources_table_show_col__customform_field', 'wpbc_resources_table_show_col__customform_field__bm', 10 );
		}
	}
);


/**
 * Show Selectbox with Custom Forms
 *
 * @param $booking_forms_extended
 * @param $on_change
 * @param $params
 *
 * @return void
 */
function wpbc_dropdown_list_with_custom_forms__free( $booking_forms_extended, $on_change , $params = array() ) {

	$defaults = array(
		'on_change' => false,
		'title'     => __( 'Booking Form', 'booking' ) . ':',
	);
	$params   = wp_parse_args( $params, $defaults );


	// -----------------------------------------------------------------------------------------------------------------
	// DropDown list with Custom Forms.
	// -----------------------------------------------------------------------------------------------------------------

	$form_options = array();

	$form_options['standard'] = array(
		'title'    => __( 'Standard', 'booking' ),
		'id'       => '',
		'name'     => '',
		'style'    => 'padding:3px;border-bottom: 1px dashed #ccc;',
		'class'    => '',
		'disabled' => false,
		'selected' => false,
		'attr'     => array(),
	);

	$form_options['optgroup_cf_s'] = array(
		'optgroup' => true,
		'close'    => false,
		'title'    => '&nbsp;' . __( 'Custom Forms', 'booking' ),
	);

	foreach ( $booking_forms_extended as $cust_form ) {

		$form_options[ $cust_form['name'] ] = array(
			'title'    => wpbc_lang( $cust_form['name'] ),
			'id'       => '',
			'name'     => '',
			'style'    => '',
			'class'    => '',
			'disabled' => false,
			'selected' => ( ( isset( $_GET['booking_form'] ) ) && ( $_GET['booking_form'] === $cust_form['name'] ) ),   // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			'attr'     => array(),
		);
	}

	$templates['optgroup_cf_e'] = array( 'optgroup' => true, 'close' => true );


	$params = array(
		'label_for' => 'select_booking_form',                        // "For" parameter  of label element.
		'label'     => '',                                         // Label above the input group.
		'style'     => '',                                         // CSS Style of entire div element.
		'items'     => array(
			array(
				'type'    => 'addon',
				'element' => 'text',                     // text | radio | checkbox.
				'text'    => $params['title'],
				'class'   => '',                         // Any CSS class here.
				'style'   => 'font-weight:600;',         // CSS Style of entire div element.
			),
			array(
				'type'     => 'select',
				'id'       => 'select_booking_form',     // HTML ID  of element.
				'name'     => 'select_booking_form',
				'options'  => $form_options,
				// Associated array  of titles and values
				// , 'disabled_options' => array( 'any' )      // If some options disbaled,  then its must list  here.
				// , 'default' => 'specific'             // Some Value from optins array that selected by default.
				'style'    => '',                       // CSS of select element.
				'class'    => '',                       // CSS Class of select element.
				'attr'     => array(),                  // Any  additional attributes, if this radio | checkbox element.
				'onchange' => $on_change,
			),
		),
	);
	echo '<div class="control-group wpbc-no-padding">';
	wpbc_bs_input_group( $params );
	echo '</div>';
}
