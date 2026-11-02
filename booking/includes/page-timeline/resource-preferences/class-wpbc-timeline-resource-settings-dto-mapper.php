<?php
/**
 * Timeline per-Resource settings DTO mapping.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map authorized Resource settings to a strict JSON-safe browser contract.
 */
final class WPBC_Timeline_Resource_Settings_DTO_Mapper {

	/** Resource-settings response schema version. */
	const SCHEMA_VERSION = 1;

	/**
	 * Map one authorized Resource and its current-user display preference.
	 *
	 * @param array<string,mixed>  $resource           Authorized repository record.
	 * @param array<string,string> $booking_title      Validated stored preference.
	 * @param bool                 $is_configured      Whether an explicit Resource record exists.
	 * @param mixed                $inherited_template Current global Timeline title template.
	 *
	 * @return array<string,mixed> Exact data-only Resource-settings DTO.
	 */
	public function map( $resource, $booking_title, $is_configured, $inherited_template ) {
		$mode = isset( $booking_title['mode'] ) && WPBC_Timeline_Resource_Display_Preferences::BOOKING_TITLE_MODE_CUSTOM === $booking_title['mode']
			? WPBC_Timeline_Resource_Display_Preferences::BOOKING_TITLE_MODE_CUSTOM
			: WPBC_Timeline_Resource_Display_Preferences::BOOKING_TITLE_MODE_INHERIT;

		return array(
			'schema_version' => self::SCHEMA_VERSION,
			'resource'       => array(
				'id'    => absint( isset( $resource['id'] ) ? $resource['id'] : 0 ),
				'title' => sanitize_text_field( isset( $resource['title'] ) ? (string) $resource['title'] : '' ),
			),
			'booking_title'  => array(
				'mode'               => $mode,
				'custom_template'    => WPBC_Timeline_Resource_Display_Preferences::BOOKING_TITLE_MODE_CUSTOM === $mode && isset( $booking_title['template'] )
					? (string) $booking_title['template']
					: '',
				'inherited_template' => $this->normalize_inherited_template( $inherited_template ),
				'is_configured'      => (bool) $is_configured,
			),
		);
	}

	/**
	 * Normalize a legacy global title template for safe browser presentation.
	 *
	 * This does not validate, resolve, or rewrite the canonical option. It only
	 * strips markup and control characters from the copy shown in the inspector.
	 *
	 * @param mixed $template Current global option value.
	 *
	 * @return string Safe bounded display copy.
	 */
	private function normalize_inherited_template( $template ) {
		$template = is_scalar( $template ) ? wp_strip_all_tags( (string) $template ) : '';
		$template = preg_replace( '/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $template );
		$template = trim( preg_replace( '/[\r\n\t]+/', ' ', $template ) );

		return function_exists( 'mb_substr' ) ? mb_substr( $template, 0, 1000 ) : substr( $template, 0, 1000 );
	}
}
