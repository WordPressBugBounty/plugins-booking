<?php
/**
 * Cross-edition content storage for Booking Resources.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Store and resolve editable Booking Resource identity fields.
 *
 * Paid editions retain `bookingtypes.title` as the canonical resource title.
 * Photo and description are edition-neutral and live in one non-autoloaded
 * option per resource. Booking Calendar Free also stores its implicit
 * resource title there because the Free edition has no `bookingtypes` table.
 *
 * The repository lazily reads the legacy Business Large Search Availability
 * picture and description when no new value has been saved. Writes mirror
 * those two values back without changing searchable state, URL, or filters.
 */
class WPBC_Booking_Resource_Content_Repository {

	/**
	 * Prefix for per-resource WordPress options.
	 *
	 * @var string
	 */
	const OPTION_PREFIX = 'wpbc_booking_resource_content_';

	/**
	 * Return editable content for one Booking Resource.
	 *
	 * @param int    $resource_id       Booking Resource ID.
	 * @param string $fallback_title    Cached title used when no canonical title can be loaded.
	 * @param bool   $use_fallback_title Whether to prefer the supplied cached title and avoid a database query.
	 *
	 * @return array{resource_id:int,title:string,description:string,picture_url:string,attachment_id:int} Normalized content.
	 */
	public function get( $resource_id, $fallback_title = '', $use_fallback_title = false ) {
		$resource_id = absint( $resource_id );
		$stored       = $this->get_stored_content( $resource_id );
		$legacy       = $this->get_legacy_search_content( $resource_id );
		$title        = $use_fallback_title ? (string) $fallback_title : $this->get_canonical_title( $resource_id );

		if ( '' === $title ) {
			$title = isset( $stored['title'] ) ? (string) $stored['title'] : (string) $fallback_title;
		}
		if ( '' === $title && ! class_exists( 'wpdev_bk_personal' ) ) {
			$title = __( 'Default Resource', 'booking' );
		}

		$description = array_key_exists( 'description', $stored )
			? (string) $stored['description']
			: (string) $legacy['description'];
		if ( '' === $description && ! array_key_exists( 'description', $stored ) && ! class_exists( 'wpdev_bk_personal' ) ) {
			$description = __( 'A unique calendar for any item that can be booked.', 'booking' );
		}
		$picture_url = array_key_exists( 'picture_url', $stored )
			? (string) $stored['picture_url']
			: (string) $legacy['picture_url'];
		if ( '' === $picture_url && ! array_key_exists( 'picture_url', $stored ) && ! class_exists( 'wpdev_bk_personal' ) ) {
			$picture_url = wpbc_get_starter_asset_url( 'img/resources/booking-resource.jpg' );
		}

		return array(
			'resource_id'   => $resource_id,
			'title'         => $title,
			'description'   => $description,
			'picture_url'   => $picture_url,
			'attachment_id' => isset( $stored['attachment_id'] ) ? absint( $stored['attachment_id'] ) : 0,
		);
	}

	/**
	 * Persist title, photo, and description for one authorized resource.
	 *
	 * The caller must verify capability, nonce, and ownership before invoking
	 * this method. The method validates storage-level invariants and refreshes
	 * the established resource cache after a successful paid-title update.
	 *
	 * @param int                 $resource_id Booking Resource ID.
	 * @param array<string,mixed> $fields      Raw title, description, and picture URL values.
	 *
	 * @return array{resource_id:int,title:string,description:string,picture_url:string,attachment_id:int}|WP_Error Saved content or error.
	 */
	public function save( $resource_id, $fields ) {
		$resource_id = absint( $resource_id );
		$title       = isset( $fields['title'] ) && is_scalar( $fields['title'] )
			? sanitize_text_field( (string) $fields['title'] )
			: '';
		$description = isset( $fields['description'] ) && is_scalar( $fields['description'] )
			? wp_kses_post( (string) $fields['description'] )
			: '';
		$picture_url = isset( $fields['picture_url'] ) && is_scalar( $fields['picture_url'] )
			? sanitize_text_field( trim( (string) $fields['picture_url'] ) )
			: '';
		$resolved_picture_url = '' !== $picture_url ? esc_url_raw( wpbc_lang( $picture_url ) ) : '';

		$title       = function_exists( 'mb_substr' ) ? mb_substr( $title, 0, 200 ) : substr( $title, 0, 200 );
		$description = function_exists( 'mb_substr' ) ? mb_substr( $description, 0, 2000 ) : substr( $description, 0, 2000 );

		if ( ! $resource_id ) {
			return new WP_Error( 'wpbc_booking_resource_invalid_id', __( 'The Booking Resource is invalid.', 'booking' ) );
		}
		if ( '' === $title ) {
			return new WP_Error( 'wpbc_booking_resource_empty_title', __( 'Enter a title for this Booking Resource.', 'booking' ) );
		}
		if ( '' !== $picture_url && '' === $resolved_picture_url ) {
			return new WP_Error( 'wpbc_booking_resource_invalid_picture', __( 'Select a valid image for this Booking Resource.', 'booking' ) );
		}

		$title_saved = $this->save_canonical_title( $resource_id, $title );
		if ( is_wp_error( $title_saved ) ) {
			return $title_saved;
		}

		$stored = $this->save_presentation( $resource_id, $description, $picture_url, false );
		if ( is_wp_error( $stored ) ) {
			return $stored;
		}
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			$stored['title'] = $title;
			$updated         = update_option( $this->get_option_name( $resource_id ), $stored, false );
			if ( ! $updated && $this->get_stored_content( $resource_id ) !== $stored ) {
				return new WP_Error( 'wpbc_booking_resource_title_not_saved', __( 'The Booking Resource title could not be saved.', 'booking' ) );
			}
		}

		$this->mirror_legacy_search_content( $resource_id, $description, $picture_url );

		/**
		 * Fires after cross-edition Booking Resource content is saved.
		 *
		 * @param int                 $resource_id Booking Resource ID.
		 * @param array<string,mixed> $stored      Normalized edition-neutral fields.
		 */
		do_action( 'wpbc_booking_resource_content_saved', $resource_id, $stored );

		return $this->get( $resource_id );
	}

	/**
	 * Save only photo and description without changing the canonical title.
	 *
	 * This method keeps the legacy Business Large Searchable Resources screen
	 * synchronized with the cross-edition content source. Callers may suppress
	 * legacy mirroring when the legacy option is already the active save path.
	 *
	 * @param int    $resource_id  Booking Resource ID.
	 * @param string $description  Raw description.
	 * @param string $picture_url  Raw image URL, optionally containing WPBC language markers.
	 * @param bool   $mirror_legacy Whether to mirror the saved values into Business Large search options.
	 *
	 * @return array<string,mixed>|WP_Error Stored record or a validation/storage error.
	 */
	public function save_presentation( $resource_id, $description, $picture_url, $mirror_legacy = true ) {
		$resource_id         = absint( $resource_id );
		$description         = wp_kses_post( (string) $description );
		$picture_url         = sanitize_text_field( trim( (string) $picture_url ) );
		$resolved_picture_url = '' !== $picture_url ? esc_url_raw( wpbc_lang( $picture_url ) ) : '';
		$description         = function_exists( 'mb_substr' ) ? mb_substr( $description, 0, 2000 ) : substr( $description, 0, 2000 );

		if ( ! $resource_id ) {
			return new WP_Error( 'wpbc_booking_resource_invalid_id', __( 'The Booking Resource is invalid.', 'booking' ) );
		}
		if ( '' !== $picture_url && '' === $resolved_picture_url ) {
			return new WP_Error( 'wpbc_booking_resource_invalid_picture', __( 'Select a valid image for this Booking Resource.', 'booking' ) );
		}

		$option_name     = $this->get_option_name( $resource_id );
		$previous_stored = get_option( $option_name, null );
		$stored          = is_array( $previous_stored ) ? $previous_stored : array();
		$stored['description']   = $description;
		$stored['picture_url']   = $picture_url;
		$stored['attachment_id'] = $resolved_picture_url ? absint( attachment_url_to_postid( $resolved_picture_url ) ) : 0;

		if ( null === $previous_stored ) {
			$stored_saved = add_option( $option_name, $stored, '', false );
		} elseif ( $previous_stored === $stored ) {
			$stored_saved = true;
		} else {
			$stored_saved = update_option( $option_name, $stored, false );
		}
		if ( ! $stored_saved ) {
			return new WP_Error( 'wpbc_booking_resource_content_not_saved', __( 'The Booking Resource details could not be saved.', 'booking' ) );
		}
		if ( $mirror_legacy ) {
			$this->mirror_legacy_search_content( $resource_id, $description, $picture_url );
		}

		return $stored;
	}

	/**
	 * Save a starter picture only when no picture choice has been recorded.
	 *
	 * An explicitly saved empty picture is a valid user choice and is therefore
	 * preserved. The legacy Searchable Resources picture is also respected.
	 * Setup Wizard uses this method to apply workflow-specific imagery without
	 * replacing customer configuration.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $picture_url Sanitized starter image URL.
	 *
	 * @return true|WP_Error True when saved or already configured; otherwise a storage error.
	 */
	public function save_starter_picture_if_unconfigured( $resource_id, $picture_url ) {
		$resource_id = absint( $resource_id );
		$picture_url = esc_url_raw( trim( (string) $picture_url ) );

		if ( ! $resource_id ) {
			return new WP_Error( 'wpbc_invalid_resource_id', __( 'A valid Booking Resource is required.', 'booking' ) );
		}

		if ( '' === $picture_url ) {
			return new WP_Error( 'wpbc_invalid_resource_picture', __( 'A valid Booking Resource picture is required.', 'booking' ) );
		}

		$stored      = $this->get_stored_content( $resource_id );
		$legacy      = $this->get_legacy_search_content( $resource_id );

		if ( array_key_exists( 'picture_url', $stored ) || '' !== trim( (string) $legacy['picture_url'] ) ) {
			return true;
		}

		$description = array_key_exists( 'description', $stored )
			? (string) $stored['description']
			: (string) $legacy['description'];
		$saved       = $this->save_presentation( $resource_id, $description, $picture_url );

		return is_wp_error( $saved ) ? $saved : true;
	}

	/**
	 * Delete content options when paid Booking Resources are deleted.
	 *
	 * @param string|int|array<int,int|string> $resource_ids Comma-separated, scalar, or array resource identifiers.
	 *
	 * @return void
	 */
	public function delete( $resource_ids ) {
		if ( ! is_array( $resource_ids ) ) {
			$resource_ids = explode( ',', (string) $resource_ids );
		}

		foreach ( $resource_ids as $resource_id ) {
			$resource_id = absint( $resource_id );
			if ( $resource_id ) {
				delete_option( $this->get_option_name( $resource_id ) );
			}
		}
	}

	/**
	 * Return the stable option name for one resource.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return string Option name.
	 */
	private function get_option_name( $resource_id ) {
		return self::OPTION_PREFIX . absint( $resource_id );
	}

	/**
	 * Read and normalize one stored option without applying fallbacks.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return array<string,mixed> Stored content.
	 */
	private function get_stored_content( $resource_id ) {
		$stored = get_option( $this->get_option_name( $resource_id ), array() );

		return is_array( $stored ) ? $stored : array();
	}

	/**
	 * Load the raw canonical paid title or the stored Free title.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return string Raw title, including supported WPBC language markers.
	 */
	private function get_canonical_title( $resource_id ) {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			$stored = $this->get_stored_content( $resource_id );

			return isset( $stored['title'] ) ? (string) $stored['title'] : '';
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$title = $wpdb->get_var(
			$wpdb->prepare(
				"SELECT title FROM {$wpdb->prefix}bookingtypes WHERE booking_type_id = %d",
				absint( $resource_id )
			)
		);

		return is_scalar( $title ) ? wp_strip_all_tags( (string) $title ) : '';
	}

	/**
	 * Save the canonical title in the edition-appropriate storage.
	 *
	 * Free title storage is completed with the other content fields in `save()`.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $title       Sanitized title.
	 *
	 * @return true|WP_Error True on success or a storage error.
	 */
	private function save_canonical_title( $resource_id, $title ) {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return true;
		}

		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$updated = $wpdb->update(
			$wpdb->prefix . 'bookingtypes',
			array( 'title' => $title ),
			array( 'booking_type_id' => absint( $resource_id ) ),
			array( '%s' ),
			array( '%d' )
		);

		if ( false === $updated ) {
			return new WP_Error( 'wpbc_booking_resource_title_not_saved', __( 'The Booking Resource title could not be saved.', 'booking' ) );
		}
		if ( 0 === $updated && '' === $this->get_canonical_title( $resource_id ) ) {
			return new WP_Error( 'wpbc_booking_resource_not_found', __( 'The Booking Resource no longer exists.', 'booking' ) );
		}

		make_bk_action( 'wpbc_reinit_booking_resource_cache' );

		return true;
	}

	/**
	 * Read legacy Business Large presentation fields as a lazy fallback.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return array{description:string,picture_url:string} Legacy values.
	 */
	private function get_legacy_search_content( $resource_id ) {
		$legacy_content = array(
			'description' => '',
			'picture_url' => '',
		);
		if ( ! function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
			return $legacy_content;
		}

		$all_options = (array) wpbc_searchable_resources__get_all_options();
		if ( empty( $all_options[ $resource_id ] ) || ! is_array( $all_options[ $resource_id ] ) ) {
			return $legacy_content;
		}

		$resource_options              = $all_options[ $resource_id ];
		$legacy_content['description'] = isset( $resource_options['description'] ) ? (string) $resource_options['description'] : '';
		$legacy_content['picture_url'] = isset( $resource_options['picture'] ) ? (string) $resource_options['picture'] : '';

		return $legacy_content;
	}

	/**
	 * Mirror shared content into the legacy Business Large Search UI option.
	 *
	 * Only the two historically overlapping fields are changed. Searchable
	 * state, result URL, title override, categories, and filters are preserved.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $description Sanitized description.
	 * @param string $picture_url Sanitized picture URL.
	 *
	 * @return void
	 */
	private function mirror_legacy_search_content( $resource_id, $description, $picture_url ) {
		if (
			! function_exists( 'wpbc_searchable_resources__get_all_options' )
			|| ! function_exists( 'wpbc_searchable_resources__save_all_options' )
		) {
			return;
		}

		$all_options = (array) wpbc_searchable_resources__get_all_options();
		if ( ! isset( $all_options[ $resource_id ] ) || ! is_array( $all_options[ $resource_id ] ) ) {
			$all_options[ $resource_id ] = array();
		}
		$all_options[ $resource_id ]['description'] = $description;
		$all_options[ $resource_id ]['picture']     = $picture_url;
		wpbc_searchable_resources__save_all_options( $all_options );
	}
}

/**
 * Return the shared Booking Resource content repository.
 *
 * @return WPBC_Booking_Resource_Content_Repository Repository instance.
 */
function wpbc_booking_resource_content_repository() {
	static $repository = null;

	if ( null === $repository ) {
		$repository = new WPBC_Booking_Resource_Content_Repository();
	}

	return $repository;
}

/**
 * Remove cross-edition content after a paid resource deletion.
 *
 * @param string|int|array<int,int|string> $resource_ids Deleted resource identifiers.
 *
 * @return void
 */
function wpbc_booking_resource_content_delete_on_resource_delete( $resource_ids ) {
	wpbc_booking_resource_content_repository()->delete( $resource_ids );
}
add_action( 'wpbc_deleted_booking_resources', 'wpbc_booking_resource_content_delete_on_resource_delete', 20, 1 );
