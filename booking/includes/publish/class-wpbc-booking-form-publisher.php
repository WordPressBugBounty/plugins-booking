<?php
/**
 * Presentation-neutral Booking Form publishing service.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Publish one Booking Form shortcode into a new or existing WordPress page.
 *
 * This service owns request-independent validation and delegates the canonical
 * content write to wpbc_add_shortcode_into_page(). UI-specific AJAX and modal
 * controllers remain thin consumers of this neutral boundary.
 */
final class WPBC_Booking_Form_Publisher {

	/**
	 * Determine whether page publishing must be blocked on this website.
	 *
	 * The configured WordPress home host is the canonical site identity for both
	 * normal page loads and AJAX mutations. The request host is used only when a
	 * canonical home host is unavailable, which keeps the decision stable without
	 * trusting a client-controlled Host header over WordPress configuration.
	 * Development hosts such as `beta` require no exception because only the
	 * official wpbookingcalendar.com domain and its subdomains are restricted.
	 *
	 * @return bool True when page discovery and page mutations must be blocked.
	 */
	public static function is_demo_restricted() {
		$request_host       = self::get_request_host();
		$site_host          = self::normalize_host( wp_parse_url( home_url( '/' ), PHP_URL_HOST ) );
		$canonical_host     = '' !== $site_host ? $site_host : $request_host;
		$official_demo_host = self::is_official_demo_host( $canonical_host );

		/**
		 * Filter whether neutral Booking Form publishing is restricted as a live demo.
		 *
		 * @since 11.6.0
		 *
		 * @param bool   $official_demo_host Whether the current host is restricted.
		 * @param string $site_host          Normalized WordPress home URL host.
		 * @param string $request_host       Normalized current request host used only as a fallback.
		 */
		return (bool) apply_filters( 'wpbc_publish_booking_form_is_demo_restricted', $official_demo_host, $site_host, $request_host );
	}

	/**
	 * Read the current HTTP request host without trusting proxy-only headers.
	 *
	 * This value is a fallback for unusual environments where WordPress cannot
	 * provide a configured home hostname. It never overrides a valid canonical
	 * WordPress site host.
	 *
	 * @return string Normalized request host, or an empty string outside HTTP.
	 */
	private static function get_request_host() {
		if ( empty( $_SERVER['HTTP_HOST'] ) ) {
			return '';
		}

		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- normalize_host() validates and reduces this value to a hostname.
		return self::normalize_host( wp_unslash( $_SERVER['HTTP_HOST'] ) );
	}

	/**
	 * Normalize a URL or HTTP Host value to a lowercase hostname.
	 *
	 * @param mixed $host Hostname, optionally including a port.
	 *
	 * @return string Normalized hostname, or an empty string when invalid.
	 */
	private static function normalize_host( $host ) {
		$host = trim( strtolower( (string) $host ) );
		if ( '' === $host ) {
			return '';
		}

		$normalized_host = wp_parse_url( 'http://' . ltrim( $host, '/' ), PHP_URL_HOST );
		if ( ! is_string( $normalized_host ) ) {
			return '';
		}

		return untrailingslashit( strtolower( rtrim( $normalized_host, '.' ) ) );
	}

	/**
	 * Determine whether a normalized host belongs to the public demo network.
	 *
	 * @param string $host Normalized hostname.
	 *
	 * @return bool True for wpbookingcalendar.com and its subdomains.
	 */
	private static function is_official_demo_host( $host ) {
		return 'wpbookingcalendar.com' === $host
			|| ( strlen( $host ) > strlen( '.wpbookingcalendar.com' )
				&& '.wpbookingcalendar.com' === substr( $host, -strlen( '.wpbookingcalendar.com' ) ) );
	}

	/**
	 * Publish a normalized Booking Form request.
	 *
	 * @param array $publish_request Untrusted publish values from an authorized controller.
	 *
	 * @return array|WP_Error Published-page response or a safe validation error.
	 */
	public function publish( $publish_request ) {
		$publish_request = is_array( $publish_request ) ? $publish_request : array();

		if ( self::is_demo_restricted() ) {
			return new WP_Error( 'wpbc_publish_demo_restricted', __( 'In the demo versions this operation is not allowed.', 'booking' ) );
		}

		if ( ! function_exists( 'wpbc_add_shortcode_into_page' ) ) {
			return new WP_Error( 'wpbc_publish_helper_unavailable', __( 'Publishing helper is not available.', 'booking' ) );
		}

		$publish_mode  = isset( $publish_request['publish_mode'] ) ? sanitize_key( $publish_request['publish_mode'] ) : '';
		$resource_id   = isset( $publish_request['resource_id'] ) ? absint( $publish_request['resource_id'] ) : 0;
		$form_name     = $this->normalize_form_name(
			isset( $publish_request['form_name'] ) ? $publish_request['form_name'] : '',
			isset( $publish_request['shortcode_raw'] ) ? $publish_request['shortcode_raw'] : ''
		);
		$page_id       = isset( $publish_request['page_id'] ) ? absint( $publish_request['page_id'] ) : 0;
		$page_title    = isset( $publish_request['page_title'] ) ? sanitize_text_field( $publish_request['page_title'] ) : '';
		$shortcode_raw = $this->normalize_booking_shortcode(
			isset( $publish_request['shortcode_raw'] ) ? $publish_request['shortcode_raw'] : '',
			$resource_id,
			$form_name
		);

		if ( ! in_array( $publish_mode, array( 'create', 'edit' ), true ) ) {
			return new WP_Error( 'wpbc_publish_invalid_mode', __( 'Unknown publish mode.', 'booking' ) );
		}

		if ( ! $resource_id ) {
			return new WP_Error( 'wpbc_publish_invalid_resource', __( 'The selected Booking Resource is invalid.', 'booking' ) );
		}

		$capability_error = $this->validate_page_capability( $publish_mode, $page_id );
		if ( is_wp_error( $capability_error ) ) {
			return $capability_error;
		}

		$helper_params = array(
			'shortcode'             => $this->wrap_shortcode_for_editor( $shortcode_raw ),
			'check_exist_shortcode' => $this->get_duplicate_check_list( $resource_id, $shortcode_raw, $form_name ),
			'resource_id'           => $resource_id,
		);

		if ( 'create' === $publish_mode ) {
			if ( '' === $page_title ) {
				return new WP_Error( 'wpbc_publish_missing_title', __( 'Please enter a page title.', 'booking' ) );
			}
			$helper_params['post_title']     = $page_title;
			$helper_params['page_post_name'] = sanitize_title( $page_title );
		} else {
			$page = get_post( $page_id );
			if ( ! $page_id ) {
				return new WP_Error( 'wpbc_publish_missing_page', __( 'Please select an existing page.', 'booking' ) );
			}
			if ( ! $page || 'page' !== $page->post_type ) {
				return new WP_Error( 'wpbc_publish_page_missing', __( 'The selected page does not exist.', 'booking' ) );
			}
			$helper_params['page_id'] = $page_id;
		}

		/**
		 * Filter canonical page-helper parameters for neutral Booking Form publishing.
		 *
		 * @param array  $helper_params Canonical wpbc_add_shortcode_into_page() parameters.
		 * @param string $publish_mode Create or edit mode.
		 * @param int    $resource_id  Booking Resource ID.
		 * @param string $shortcode_raw Normalized raw shortcode.
		 * @param string $form_name     Normalized Booking Form name.
		 */
		$helper_params = apply_filters(
			'wpbc_publish_booking_form_request_params',
			$helper_params,
			$publish_mode,
			$resource_id,
			$shortcode_raw,
			$form_name
		);

		$publish_result = wpbc_add_shortcode_into_page( $helper_params );
		if ( ! is_array( $publish_result ) || empty( $publish_result['result'] ) ) {
			$message = is_array( $publish_result ) && ! empty( $publish_result['message'] )
				? wp_kses_post( $publish_result['message'] )
				: __( 'Unable to publish the booking form into the selected page.', 'booking' );
			return new WP_Error( 'wpbc_publish_failed', $message );
		}

		$post_id    = $this->resolve_post_id( $publish_result, $helper_params );
		$view_url  = $post_id ? get_permalink( $post_id ) : '';
		$edit_url  = $post_id ? get_edit_post_link( $post_id, '' ) : '';
		$post_title = $post_id ? get_the_title( $post_id ) : '';

		if ( $view_url ) {
			$view_url .= '#bklnk' . $resource_id;
		}

		return array(
			'message'    => ! empty( $publish_result['message'] ) ? wp_kses_post( $publish_result['message'] ) : __( 'Booking form has been published.', 'booking' ),
			'post_id'    => $post_id,
			'post_title' => $post_title,
			'view_url'   => $view_url,
			'edit_url'   => $edit_url,
			'form_name'  => $form_name,
		);
	}

	/**
	 * Normalize a Booking Form name to a stable key.
	 *
	 * @param mixed $form_name     Raw Booking Form name.
	 * @param mixed $shortcode_raw Optional shortcode used to recover its form type.
	 *
	 * @return string Normalized name.
	 */
	private function normalize_form_name( $form_name, $shortcode_raw = '' ) {
		$form_name = sanitize_key( (string) $form_name );
		if ( '' === $form_name && preg_match( '/\bform_type\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s\]]+))/i', (string) $shortcode_raw, $matches ) ) {
			$form_name = sanitize_key( $matches[1] ? $matches[1] : ( $matches[2] ? $matches[2] : $matches[3] ) );
		}
		return '' !== $form_name ? $form_name : 'standard';
	}

	/**
	 * Normalize a raw Booking Form shortcode for one Resource and form.
	 *
	 * @param mixed  $shortcode_raw Raw shortcode value.
	 * @param int    $resource_id  Booking Resource ID.
	 * @param string $form_name    Booking Form name.
	 *
	 * @return string Normalized raw shortcode.
	 */
	private function normalize_booking_shortcode( $shortcode_raw, $resource_id, $form_name ) {
		$shortcode_raw = preg_replace( '/<!--\s*\/?wp:shortcode\s*-->/', '', (string) $shortcode_raw );
		$shortcode_raw = trim( wp_strip_all_tags( $shortcode_raw ) );

		if ( ! preg_match( '/^\[booking(?:\s[^\]]*)?\]$/i', $shortcode_raw ) ) {
			$shortcode_raw = "[booking resource_id={$resource_id} form_type='{$form_name}']";
		}

		$shortcode_raw = $this->upsert_shortcode_attribute( $shortcode_raw, 'resource_id', (string) $resource_id );
		$shortcode_raw = $this->upsert_shortcode_attribute( $shortcode_raw, 'form_type', $form_name, '\'' );

		return trim( $shortcode_raw );
	}

	/**
	 * Insert or replace one Booking shortcode attribute.
	 *
	 * @param string $shortcode_raw Shortcode being normalized.
	 * @param string $attribute     Attribute name.
	 * @param string $attribute_value Attribute value.
	 * @param string $quote_character Optional quote character.
	 *
	 * @return string Updated shortcode.
	 */
	private function upsert_shortcode_attribute( $shortcode_raw, $attribute, $attribute_value, $quote_character = '' ) {
		$replacement_value = $quote_character ? $quote_character . $attribute_value . $quote_character : $attribute_value;
		$replacement       = $attribute . '=' . $replacement_value;
		$pattern           = '/\b' . preg_quote( $attribute, '/' ) . '\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s\]]+)/i';

		if ( preg_match( $pattern, $shortcode_raw ) ) {
			return preg_replace( $pattern, $replacement, $shortcode_raw, 1 );
		}

		return ']' === substr( $shortcode_raw, -1 )
			? substr( $shortcode_raw, 0, -1 ) . ' ' . $replacement . ']'
			: $shortcode_raw . ' ' . $replacement;
	}

	/**
	 * Wrap a raw shortcode in the WordPress Shortcode block comments.
	 *
	 * @param string $shortcode_raw Raw shortcode.
	 *
	 * @return string Block-editor content.
	 */
	private function wrap_shortcode_for_editor( $shortcode_raw ) {
		return '<!-- wp:shortcode -->' . $shortcode_raw . '<!-- /wp:shortcode -->';
	}

	/**
	 * Build duplicate-detection signatures for the canonical page helper.
	 *
	 * @param int    $resource_id  Booking Resource ID.
	 * @param string $shortcode_raw Normalized raw shortcode.
	 * @param string $form_name    Booking Form name.
	 *
	 * @return array Duplicate signatures.
	 */
	private function get_duplicate_check_list( $resource_id, $shortcode_raw, $form_name ) {
		$signatures = array(
			$shortcode_raw,
			"[booking resource_id={$resource_id} form_type='{$form_name}']",
			'[booking resource_id=' . $resource_id . ' form_type="' . $form_name . '"]',
		);

		if ( 'standard' === $form_name ) {
			$signatures[] = '[booking resource_id=' . $resource_id . ' ';
			$signatures[] = '[booking resource_id=' . $resource_id . ']';
			$signatures[] = '[booking type=' . $resource_id . ' ';
			$signatures[] = '[booking type=' . $resource_id . ']';
			if ( 1 === $resource_id ) {
				$signatures[] = '[booking]';
			}
		}

		return array_values( array_unique( array_filter( $signatures ) ) );
	}

	/**
	 * Validate WordPress page capabilities for the requested operation.
	 *
	 * @param string $publish_mode Create or edit mode.
	 * @param int    $page_id      Existing page ID for edit mode.
	 *
	 * @return true|WP_Error True when allowed, otherwise a safe error.
	 */
	private function validate_page_capability( $publish_mode, $page_id ) {
		if ( 'create' === $publish_mode && ! current_user_can( 'publish_pages' ) ) {
			return new WP_Error( 'wpbc_publish_create_forbidden', __( 'You do not have permission to create pages.', 'booking' ) );
		}
		if ( 'edit' === $publish_mode && ! current_user_can( 'edit_pages' ) ) {
			return new WP_Error( 'wpbc_publish_edit_forbidden', __( 'You do not have permission to edit pages.', 'booking' ) );
		}
		if ( 'edit' === $publish_mode && $page_id && ! current_user_can( 'edit_post', $page_id ) ) {
			return new WP_Error( 'wpbc_publish_page_forbidden', __( 'You do not have permission to edit the selected page.', 'booking' ) );
		}
		return true;
	}

	/**
	 * Resolve the affected page ID from a canonical helper response.
	 *
	 * @param array $publish_result Canonical helper response.
	 * @param array $helper_params  Canonical helper request.
	 *
	 * @return int Affected page ID, or zero when it cannot be resolved.
	 */
	private function resolve_post_id( $publish_result, $helper_params ) {
		if ( ! empty( $helper_params['page_id'] ) ) {
			return absint( $helper_params['page_id'] );
		}
		if ( ! empty( $publish_result['post_id'] ) ) {
			return absint( $publish_result['post_id'] );
		}
		if ( ! empty( $publish_result['relative_url'] ) ) {
			$absolute_url = function_exists( 'wpbc_make_link_absolute' )
				? wpbc_make_link_absolute( $publish_result['relative_url'] )
				: home_url( $publish_result['relative_url'] );
			$post_id = url_to_postid( $absolute_url );
			if ( $post_id ) {
				return absint( $post_id );
			}
		}
		if ( ! empty( $helper_params['page_post_name'] ) ) {
			$page = get_page_by_path( $helper_params['page_post_name'], OBJECT, 'page' );
			return $page ? absint( $page->ID ) : 0;
		}
		return 0;
	}
}

/**
 * Determine whether Booking Form page publishing is restricted on this site.
 *
 * This compatibility boundary keeps Catalog, Form Builder, legacy Resources,
 * and the canonical page helper on the same host-aware demo policy.
 *
 * @return bool True when page discovery and mutations must be blocked.
 */
function wpbc_is_booking_form_publishing_restricted() {
	return WPBC_Booking_Form_Publisher::is_demo_restricted();
}
