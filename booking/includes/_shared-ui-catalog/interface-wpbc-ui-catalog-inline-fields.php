<?php
/**
 * Domain contract for catalog inline and bulk field definitions.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Require each catalog domain to expose editable fields through one API.
 *
 * Implementations remain domain-owned because field availability depends on
 * authorization, ownership, edition, and current row state. Returned fields
 * are executable-free presentation contracts; they are never mutation
 * authority and must be rebuilt during preview and apply.
 *
 * @since 11.6.0
 */
interface WPBC_UI_Catalog_Inline_Fields {

	/**
	 * Return row-specific inline fields for one authorized domain record.
	 *
	 * @param array<string,mixed> $record Current authorized domain record.
	 * @return array<int,array<string,mixed>> Executable-free field definitions.
	 */
	public function get_inline_fields( $record );

	/**
	 * Return the safe field intersection for authorized domain records.
	 *
	 * @param array<int,array<string,mixed>> $records Current authorized records.
	 * @return array<int,array<string,mixed>> Executable-free field definitions.
	 */
	public function get_bulk_fields( $records );
}
