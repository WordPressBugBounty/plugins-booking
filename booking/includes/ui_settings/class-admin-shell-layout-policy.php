<?php
/**
 * Shared administration shell layout policy.
 *
 * @package Booking Calendar
 * @since   11.9.2
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve the allow-listed content-spacing profile for an administration page.
 *
 * Page definitions choose a semantic layout instead of supplying CSS lengths.
 * This keeps full-width shell chrome independent from page-owned content and
 * prevents feature stylesheets from changing the spacing of unrelated pages.
 */
final class WPBC_Admin_Shell_Layout_Policy {

	const LAYOUT_STANDARD = 'standard';
	const LAYOUT_SPACIOUS = 'spacious';
	const LAYOUT_FLUSH    = 'flush';

	/**
	 * Resolve the active page content layout.
	 *
	 * Missing or invalid values deliberately fall back to the standard profile.
	 * The returned class is generated only from an allow-listed identifier and is
	 * safe to use as a presentation contract after normal output escaping.
	 *
	 * @param array<string,mixed> $page_options Merged active tab and subtab options.
	 *
	 * @return array<string,string> Resolved layout identifier and CSS class.
	 */
	public static function resolve( $page_options ) {
		$page_options = is_array( $page_options ) ? $page_options : array();
		$layout       = array_key_exists( 'page_content_layout', $page_options )
			? self::normalize_layout( $page_options['page_content_layout'] )
			: '';

		if ( '' === $layout ) {
			$layout = self::LAYOUT_STANDARD;
		}

		return array(
			'page_content_layout'       => $layout,
			'page_content_layout_class' => 'wpbc_admin_page__content--' . $layout,
		);
	}

	/**
	 * Normalize a proposed content layout identifier.
	 *
	 * @param mixed $layout Candidate layout value.
	 *
	 * @return string Valid layout identifier, or an empty string when unsupported.
	 */
	public static function normalize_layout( $layout ) {
		$layout = is_scalar( $layout ) ? (string) $layout : '';

		return in_array( $layout, self::get_layouts(), true ) ? $layout : '';
	}

	/**
	 * Return the stable layout identifiers accepted by page contracts.
	 *
	 * @return array<int,string> Ordered layout identifiers.
	 */
	public static function get_layouts() {
		return array( self::LAYOUT_STANDARD, self::LAYOUT_SPACIOUS, self::LAYOUT_FLUSH );
	}
}
