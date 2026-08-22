<?php
/**
 * Provider contract for independent template-driven catalogs.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Supply normalized responses for one registered catalog.
 *
 * Providers own domain authorization and data retrieval. The shared catalog
 * boundary owns only registration, shared request mechanics, and normalized
 * response validation.
 */
interface WPBC_UI_Catalog_Provider {

	/**
	 * Return the stable catalog identifier served by this provider.
	 *
	 * @return string Stable catalog identifier.
	 */
	public function get_catalog_id();

	/**
	 * Build a response for one validated shared request.
	 *
	 * @param WPBC_UI_Catalog_Request $request Validated shared request.
	 *
	 * @return WPBC_UI_Catalog_Response|WP_Error Normalized response or safe error.
	 */
	public function get_response( $request );
}
