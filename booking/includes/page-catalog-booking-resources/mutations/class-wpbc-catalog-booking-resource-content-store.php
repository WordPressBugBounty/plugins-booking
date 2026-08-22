<?php
/**
 * Independent cross-edition content persistence for catalog inspectors.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist Resource identity fields without invoking either legacy editor.
 */
final class WPBC_Catalog_Booking_Resource_Content_Store {

	/**
	 * Save title, description, and picture in canonical cross-edition storage.
	 *
	 * The caller must authorize the Resource before invoking this method. Paid
	 * titles remain in bookingtypes; presentation values use the non-autoloaded
	 * option already read by the independent repository. Business Large Search
	 * presentation is mirrored without altering its searchable state or filters.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $title       Validated Resource title.
	 * @param string $description Validated description.
	 * @param string $picture_url Validated picture URL or language expression.
	 *
	 * @return true|WP_Error True on success or a safe storage error.
	 */
	public function save( $resource_id, $title, $description, $picture_url ) {
		$resource_id = absint( $resource_id );
		if ( ! $resource_id ) {
			return new WP_Error( 'wpbc_catalog_resource_content_invalid', __( 'The Booking Resource is invalid.', 'booking' ) );
		}

		$option_name = WPBC_Catalog_Booking_Resources_Repository::CONTENT_OPTION_PREFIX . $resource_id;
		$previous    = get_option( $option_name, null );
		$stored      = is_array( $previous ) ? $previous : array();
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			$stored['title'] = $title;
		}
		$stored['description']   = $description;
		$stored['picture_url']   = $picture_url;
		$resolved_picture_url    = '' !== $picture_url ? esc_url_raw( wpbc_lang( $picture_url ) ) : '';
		$stored['attachment_id'] = $resolved_picture_url ? absint( attachment_url_to_postid( $resolved_picture_url ) ) : 0;

		if ( null === $previous ) {
			$saved = add_option( $option_name, $stored, '', false );
		} elseif ( $previous === $stored ) {
			$saved = true;
		} else {
			$saved = update_option( $option_name, $stored, false );
		}
		if ( ! $saved ) {
			return new WP_Error( 'wpbc_catalog_resource_content_not_saved', __( 'The Booking Resource details could not be saved.', 'booking' ) );
		}

		global $wpdb;

		if ( class_exists( 'wpdev_bk_personal' ) ) {
			// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- Canonical Resource table has no independent CRUD API.
			$updated = $wpdb->update(
				$wpdb->prefix . 'bookingtypes',
				array( 'title' => $title ),
				array( 'booking_type_id' => $resource_id ),
				array( '%s' ),
				array( '%d' )
			);
			if ( false === $updated ) {
				if ( null === $previous ) {
					delete_option( $option_name );
				} else {
					update_option( $option_name, $previous, false );
				}

				return new WP_Error( 'wpbc_catalog_resource_title_not_saved', __( 'The Booking Resource title could not be saved.', 'booking' ) );
			}
		}

		$this->mirror_search_presentation( $resource_id, $description, $picture_url );
		if ( function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_reinit_booking_resource_cache' );
		}

		return true;
	}

	/**
	 * Delete a presentation option created for a failed insert.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return true|WP_Error True when presentation values are absent or a safe storage error.
	 */
	public function delete( $resource_id ) {
		$resource_id = absint( $resource_id );
		$option_name = WPBC_Catalog_Booking_Resources_Repository::CONTENT_OPTION_PREFIX . $resource_id;
		delete_option( $option_name );
		if ( false !== get_option( $option_name, false ) ) {
			return new WP_Error( 'wpbc_catalog_resource_content_not_deleted', __( 'The Booking Resource presentation details could not be deleted.', 'booking' ) );
		}
		if ( function_exists( 'wpbc_searchable_resources__get_all_options' ) && function_exists( 'wpbc_searchable_resources__save_all_options' ) ) {
			$search_options = (array) wpbc_searchable_resources__get_all_options();
			unset( $search_options[ $resource_id ] );
			wpbc_searchable_resources__save_all_options( $search_options );
			$stored_search_options = (array) wpbc_searchable_resources__get_all_options();
			if ( isset( $stored_search_options[ $resource_id ] ) ) {
				return new WP_Error( 'wpbc_catalog_resource_search_content_not_deleted', __( 'The Booking Resource search presentation could not be deleted.', 'booking' ) );
			}
		}

		return true;
	}

	/**
	 * Mirror only overlapping Search Availability presentation values.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $description Sanitized description.
	 * @param string $picture_url Sanitized picture URL.
	 *
	 * @return void
	 */
	private function mirror_search_presentation( $resource_id, $description, $picture_url ) {
		if ( ! function_exists( 'wpbc_searchable_resources__get_all_options' ) || ! function_exists( 'wpbc_searchable_resources__save_all_options' ) ) {
			return;
		}

		$search_options = (array) wpbc_searchable_resources__get_all_options();
		if ( ! isset( $search_options[ $resource_id ] ) || ! is_array( $search_options[ $resource_id ] ) ) {
			$search_options[ $resource_id ] = array();
		}
		$search_options[ $resource_id ]['description'] = $description;
		$search_options[ $resource_id ]['picture']     = $picture_url;
		wpbc_searchable_resources__save_all_options( $search_options );
	}
}
