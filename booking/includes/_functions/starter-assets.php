<?php
/**
 * Starter-image URL resolution.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve a bundled starter image from the configured local or remote source.
 *
 * The relative path is allow-listed to the plugin assets hierarchy. Absolute
 * paths, parent traversal, query strings, and fragments are rejected so the
 * helper cannot become an arbitrary URL proxy. Local URLs retain their plugin
 * subdirectory; the remote source uses the filename in its flat asset folder.
 *
 * @param string $relative_path Path below the plugin `assets` directory.
 *
 * @return string Sanitized image URL, or an empty string for an invalid path.
 */
function wpbc_get_starter_asset_url( $relative_path ) {
	$relative_path = str_replace( '\\', '/', trim( (string) $relative_path ) );
	$relative_path = ltrim( $relative_path, '/' );

	if (
		'' === $relative_path
		|| false !== strpos( $relative_path, '..' )
		|| false !== strpos( $relative_path, '?' )
		|| false !== strpos( $relative_path, '#' )
		|| 1 !== preg_match( '#^[a-zA-Z0-9_./-]+$#', $relative_path )
	) {
		return '';
	}

	$is_remote_source = defined( 'WPBC_STARTER_ASSETS_SOURCE' )
		&& 'remote' === strtolower( (string) WPBC_STARTER_ASSETS_SOURCE );
	$assets_base_url  = $is_remote_source
		? 'https://wpbookingcalendar.com/assets/plugin/assets/'
		: trailingslashit( WPBC_PLUGIN_URL ) . 'assets/';
	// $asset_path       = $is_remote_source ? wp_basename( $relative_path ) : $relative_path;
	$asset_path       =  $relative_path;

	return esc_url_raw( $assets_base_url . $asset_path );
}
