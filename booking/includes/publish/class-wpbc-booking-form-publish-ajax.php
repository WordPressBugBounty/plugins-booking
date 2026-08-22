<?php
/**
 * AJAX controller for neutral Booking Form publishing.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Authorize and dispatch asynchronous Booking Form publishing requests.
 */
final class WPBC_Booking_Form_Publish_Ajax {

	const ACTION            = 'WPBC_AJX_PUBLISH_BOOKING_FORM';
	const LIST_PAGES_ACTION = 'WPBC_AJX_GET_PUBLISHABLE_PAGES';
	const NONCE_ACTION      = 'wpbc_publish_booking_form';

	/**
	 * Register the authenticated AJAX action.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'wp_ajax_' . self::ACTION, array( __CLASS__, 'publish' ) );
		add_action( 'wp_ajax_' . self::LIST_PAGES_ACTION, array( __CLASS__, 'list_pages' ) );
	}

	/**
	 * Return only WordPress pages the current user is authorized to edit.
	 *
	 * Page titles are discovered lazily after the user chooses the existing-page
	 * workflow. They are never printed into the catalog shell, and live demos are
	 * rejected before any page query is executed.
	 *
	 * @return void Sends JSON and terminates the AJAX request.
	 */
	public static function list_pages() {
		check_ajax_referer( self::NONCE_ACTION, 'nonce' );

		$manage_capability = function_exists( 'wpbc_catalog_booking_resources_get_manage_capability' )
			? wpbc_catalog_booking_resources_get_manage_capability()
			: 'manage_options';

		if ( ! current_user_can( $manage_capability ) || ! current_user_can( 'edit_pages' ) ) {
			self::send_error( __( 'You do not have permission to view publishable pages.', 'booking' ), 'wpbc_publish_pages_forbidden' );
		}

		if ( WPBC_Booking_Form_Publisher::is_demo_restricted() ) {
			self::send_error( __( 'In the demo versions this operation is not allowed.', 'booking' ), 'wpbc_publish_demo_restricted' );
		}

		$page_ids          = get_posts(
			array(
				'post_type'        => 'page',
				'post_status'      => array( 'draft', 'publish', 'private' ),
				'posts_per_page'   => -1,
				'orderby'          => 'title',
				'order'            => 'ASC',
				'fields'           => 'ids',
				'no_found_rows'    => true,
				'suppress_filters' => false,
			)
		);
		$publishable_pages = array();

		foreach ( $page_ids as $page_id ) {
			$page_id = absint( $page_id );
			if ( ! $page_id || ! current_user_can( 'edit_post', $page_id ) ) {
				continue;
			}

			$page_title          = wp_strip_all_tags( get_the_title( $page_id ) );
			$publishable_pages[] = array(
				'id'    => $page_id,
				'title' => '' !== $page_title ? $page_title : __( '(no title)', 'booking' ),
			);
		}

		wp_send_json_success(
			array(
				'pages' => $publishable_pages,
			)
		);
	}

	/**
	 * Publish one authorized Resource shortcode into a WordPress page.
	 *
	 * @return void Sends JSON and terminates the AJAX request.
	 */
	public static function publish() {
		check_ajax_referer( self::NONCE_ACTION, 'nonce' );

		$manage_capability = function_exists( 'wpbc_catalog_booking_resources_get_manage_capability' )
			? wpbc_catalog_booking_resources_get_manage_capability()
			: 'manage_options';

		if ( ! current_user_can( $manage_capability ) ) {
			self::send_error( __( 'You do not have permission to publish this Booking Resource.', 'booking' ) );
		}

		$resource_id = self::get_request_integer( 'resource_id' );
		if ( ! self::is_authorized_resource( $resource_id ) ) {
			self::send_error( __( 'The selected Booking Resource does not exist or is not available to this user.', 'booking' ) );
		}

		$publisher = new WPBC_Booking_Form_Publisher();
		$result    = $publisher->publish(
			array(
				'publish_mode' => self::get_request_text( 'publish_mode' ),
				'resource_id'  => $resource_id,
				'form_name'    => self::get_request_text( 'form_name' ),
				'shortcode_raw' => self::get_request_raw( 'shortcode_raw' ),
				'page_id'      => self::get_request_integer( 'page_id' ),
				'page_title'   => self::get_request_text( 'page_title' ),
			)
		);

		if ( is_wp_error( $result ) ) {
			self::send_error( $result->get_error_message(), $result->get_error_code() );
		}

		wp_send_json_success( $result );
	}

	/**
	 * Determine whether the current user can see the exact Resource.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return bool True when the independent repository authorizes the Resource.
	 */
	private static function is_authorized_resource( $resource_id ) {
		if ( ! $resource_id || ! class_exists( 'WPBC_Catalog_Booking_Resources_Repository' ) ) {
			return false;
		}

		$repository = new WPBC_Catalog_Booking_Resources_Repository();
		$resource   = $repository->get_resource( $resource_id );

		return is_array( $resource ) && ! empty( $resource['id'] );
	}

	/**
	 * Read and sanitize a text request field.
	 *
	 * @param string $request_key Request key.
	 *
	 * @return string Sanitized value.
	 */
	private static function get_request_text( $request_key ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified before this helper is called.
		return isset( $_POST[ $request_key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $request_key ] ) ) : '';
	}

	/**
	 * Read a raw shortcode request field for service-level normalization.
	 *
	 * @param string $request_key Request key.
	 *
	 * @return string Unslashed request value.
	 */
	private static function get_request_raw( $request_key ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Nonce is verified and the publisher normalizes the shortcode.
		return isset( $_POST[ $request_key ] ) ? trim( wp_unslash( $_POST[ $request_key ] ) ) : '';
	}

	/**
	 * Read a positive integer request field.
	 *
	 * @param string $request_key Request key.
	 *
	 * @return int Normalized integer.
	 */
	private static function get_request_integer( $request_key ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Nonce is verified before this helper is called.
		return isset( $_POST[ $request_key ] ) ? absint( $_POST[ $request_key ] ) : 0;
	}

	/**
	 * Send a consistent JSON publishing error.
	 *
	 * @param string $message    Safe user-facing error message.
	 * @param string $error_code Optional stable error code.
	 *
	 * @return void Sends JSON and terminates the AJAX request.
	 */
	private static function send_error( $message, $error_code = 'wpbc_publish_error' ) {
		wp_send_json_error(
			array(
				'code'    => sanitize_key( $error_code ),
				'message' => wp_kses_post( $message ),
			)
		);
	}
}

WPBC_Booking_Form_Publish_Ajax::init();
