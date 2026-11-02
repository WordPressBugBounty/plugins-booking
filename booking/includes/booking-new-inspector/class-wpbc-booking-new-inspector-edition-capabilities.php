<?php
/**
 * Edition capability DTO for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Projects edition availability without exposing PHP class or capability names.
 */
final class WPBC_Booking_New_Inspector_Edition_Capabilities {

	/**
	 * Return stable JSON-safe edition capabilities.
	 *
	 * @return array<string,mixed> Edition capability DTO.
	 */
	public function get_capabilities() {
		$is_personal        = class_exists( 'wpdev_bk_personal' );
		$is_business_small  = class_exists( 'wpdev_bk_biz_s' );
		$is_business_medium = class_exists( 'wpdev_bk_biz_m' );
		$is_business_large  = class_exists( 'wpdev_bk_biz_l' );
		$is_multiuser       = class_exists( 'wpdev_bk_multiuser' );
		$edition_id        = 'free';

		if ( $is_multiuser ) {
			$edition_id = 'multiuser';
		} elseif ( $is_business_large ) {
			$edition_id = 'business_large';
		} elseif ( $is_business_medium ) {
			$edition_id = 'business_medium';
		} elseif ( $is_business_small ) {
			$edition_id = 'business_small';
		} elseif ( $is_personal ) {
			$edition_id = 'personal';
		}

		return array(
			'edition_id'         => $edition_id,
			'multiple_resources' => $is_personal,
			'custom_forms'       => class_exists( 'WPBC_FE_Custom_Form_Helper' ),
			'cost_preview'       => $is_business_small,
			'cost_correction'    => $is_business_small,
			'advanced_pricing'   => $is_business_medium,
			'capacity'           => $is_business_large,
			'appointments'       => function_exists( 'wpbc_appointment_services_repository' ),
			'multiuser'          => $is_multiuser,
			'multisite'          => function_exists( 'is_multisite' ) && is_multisite(),
		);
	}
}
