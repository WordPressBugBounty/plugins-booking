<?php
/**
 * Option-specific save policies for the generic WPBC option saver.
 *
 * Keep feature-specific permissions and value normalization here so
 * save-load-option.php can stay focused on transport, nonce checks, and storage.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shared helpers for global option save policies.
 */
class WPBC_Option_Save_Policy_Global_Options {

	/**
	 * Check if current user can save global options.
	 *
	 * In MultiUser regular users do not have access to global options.
	 *
	 * @return bool
	 */
	public static function can_save_global_options() {
		return ( ! function_exists( 'wpbc_is_mu_user_can_be_here' ) || wpbc_is_mu_user_can_be_here( 'only_super_admin' ) );
	}

	/**
	 * Normalize On/Off option values.
	 *
	 * @param mixed $value Raw value.
	 *
	 * @return string
	 */
	public static function normalize_on_off( $value ) {
		return ( 'On' === $value ) ? 'On' : 'Off';
	}
}

/**
 * Calendar global option policies.
 */
class WPBC_Option_Save_Policy_Global_Calendar {

	/**
	 * Normalize and validate global calendar skin value before saving.
	 *
	 * @param mixed  $data_raw  Raw calendar skin value.
	 * @param string $data_name Option name.
	 *
	 * @return string
	 */
	public static function normalize_calendar_skin( $data_raw, $data_name = '' ) {

		$skin_value = is_scalar( $data_raw ) ? (string) $data_raw : '';
		$replace    = array();

		if ( defined( 'WPBC_PLUGIN_DIR' ) ) {
			$replace[] = WPBC_PLUGIN_DIR;
		}
		if ( defined( 'WPBC_PLUGIN_URL' ) ) {
			$replace[] = WPBC_PLUGIN_URL;
		}

		$upload_dir = wp_upload_dir();
		if ( ! empty( $upload_dir['basedir'] ) ) {
			$replace[] = $upload_dir['basedir'];
		}
		if ( ! empty( $upload_dir['baseurl'] ) ) {
			$replace[] = $upload_dir['baseurl'];
		}

		$skin_value = str_replace( $replace, '', $skin_value );
		$skin_value = sanitize_text_field( $skin_value );

		if (
			'' === $skin_value ||
			false !== strpos( $skin_value, '..' ) ||
			! preg_match( '/\.css$/i', $skin_value ) ||
			( 0 !== strpos( $skin_value, '/css/skins/' ) && 0 !== strpos( $skin_value, '/wpbc_skins/' ) )
		) {
			wp_send_json_error( array( 'message' => __( 'Invalid calendar skin.', 'booking' ) ) );
		}

		$file_path = '';
		if ( 0 === strpos( $skin_value, '/wpbc_skins/' ) ) {
			$file_path = ( ! empty( $upload_dir['basedir'] ) ) ? $upload_dir['basedir'] . $skin_value : '';
		} elseif ( defined( 'WPBC_PLUGIN_DIR' ) ) {
			$file_path = WPBC_PLUGIN_DIR . $skin_value;
		}

		if ( empty( $file_path ) || ! file_exists( $file_path ) ) {
			wp_send_json_error( array( 'message' => __( 'Calendar skin file does not exist.', 'booking' ) ) );
		}

		return $skin_value;
	}

	/**
	 * Get allowed global calendar legend option names.
	 *
	 * @return array
	 */
	public static function get_calendar_legend_option_names() {
		return array(
			'booking_is_show_legend',
			'booking_legend_is_show_item_available',
			'booking_legend_text_for_item_available',
			'booking_legend_is_show_item_pending',
			'booking_legend_text_for_item_pending',
			'booking_legend_is_show_item_approved',
			'booking_legend_text_for_item_approved',
			'booking_legend_is_show_item_partially',
			'booking_legend_text_for_item_partially',
			'booking_legend_is_show_item_unavailable',
			'booking_legend_text_for_item_unavailable',
			'booking_legend_is_show_numbers',
			'booking_legend_is_vertical',
		);
	}

	/**
	 * Normalize a global calendar legend option before saving.
	 *
	 * @param string $option_key Option name.
	 * @param mixed  $value      Option value.
	 * @param string $data_name  Submitted data name.
	 *
	 * @return string
	 */
	public static function normalize_calendar_legend_option( $option_key, $value, $data_name = '' ) {

		$on_off_options = array(
			'booking_is_show_legend',
			'booking_legend_is_show_item_available',
			'booking_legend_is_show_item_pending',
			'booking_legend_is_show_item_approved',
			'booking_legend_is_show_item_partially',
			'booking_legend_is_show_item_unavailable',
			'booking_legend_is_show_numbers',
			'booking_legend_is_vertical',
		);

		if ( in_array( $option_key, $on_off_options, true ) ) {
			return WPBC_Option_Save_Policy_Global_Options::normalize_on_off( $value );
		}

		return sanitize_text_field( (string) $value );
	}
}

/**
 * Time-slot global option policies.
 */
class WPBC_Option_Save_Policy_Global_Time {

	/**
	 * Normalize the global timeslot picker toggle.
	 *
	 * @param mixed  $data_raw  Raw value.
	 * @param string $data_name Option name.
	 *
	 * @return string
	 */
	public static function normalize_timeslot_picker( $data_raw, $data_name = '' ) {
		return WPBC_Option_Save_Policy_Global_Options::normalize_on_off( $data_raw );
	}
}

/**
 * Register built-in policies.
 *
 * @return void
 */
function wpbc_register_builtin_option_save_policies() {

	if ( ! class_exists( 'wpbc_option_saver_loader' ) ) {
		return;
	}

	wpbc_option_saver_loader::register_option_policy(
		'booking_skin',
		array(
			'can_save'           => array( 'WPBC_Option_Save_Policy_Global_Options', 'can_save_global_options' ),
			'permission_message' => __( 'You do not have permission to save global calendar options.', 'booking' ),
			'normalize_raw'      => array( 'WPBC_Option_Save_Policy_Global_Calendar', 'normalize_calendar_skin' ),
		)
	);

	wpbc_option_saver_loader::register_option_policy(
		'wpbc_calendar_legend_options',
		array(
			'can_save'           => array( 'WPBC_Option_Save_Policy_Global_Options', 'can_save_global_options' ),
			'permission_message' => __( 'You do not have permission to save global calendar options.', 'booking' ),
			'force_mode'         => 'split',
			'allowed_keys'       => array( 'WPBC_Option_Save_Policy_Global_Calendar', 'get_calendar_legend_option_names' ),
			'normalize_item'     => array( 'WPBC_Option_Save_Policy_Global_Calendar', 'normalize_calendar_legend_option' ),
		)
	);

	wpbc_option_saver_loader::register_option_policy(
		'booking_timeslot_picker',
		array(
			'can_save'           => array( 'WPBC_Option_Save_Policy_Global_Options', 'can_save_global_options' ),
			'permission_message' => __( 'You do not have permission to save global time-slot options.', 'booking' ),
			'normalize_raw'      => array( 'WPBC_Option_Save_Policy_Global_Time', 'normalize_timeslot_picker' ),
		)
	);
}
add_action( 'init', 'wpbc_register_builtin_option_save_policies', 5 );
