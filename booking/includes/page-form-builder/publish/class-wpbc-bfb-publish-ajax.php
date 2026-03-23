<?php
/**
 * BFB AJAX Publish controller.
 *
 * Publishes the current booking form shortcode into:
 * - an existing page, or
 * - a new page
 *
 * This controller is intentionally thin and reuses the generic page/shortcode
 * helper functions that already exist in Booking Calendar.
 *
 * Expected request args:
 * - nonce
 * - publish_mode : create | edit
 * - resource_id
 * - form_name
 * - shortcode_raw
 * - page_id      (for edit)
 * - page_title   (for create)
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/publish/class-wpbc-bfb-publish-ajax.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Publish_Ajax {

	const ACTION       = 'WPBC_AJX_BFB_PUBLISH_FORM';
	const NONCE_ACTION = 'wpbc_bfb_publish_form';

	/**
	 * Init hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'wp_ajax_' . self::ACTION, array( __CLASS__, 'ajax_publish_form' ) );
	}

	/**
	 * Send JSON error and finish.
	 *
	 * @param string $message Error message.
	 *
	 * @return void
	 */
	private static function send_error( $message ) {
		wp_send_json_error(
			array(
				'message' => $message,
			)
		);
	}

	/**
	 * Get text request value.
	 *
	 * @param string $key Request key.
	 *
	 * @return string
	 */
	private static function get_request_text( $key ) {

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST[ $key ] ) ) {
			return '';
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		return sanitize_text_field( wp_unslash( $_POST[ $key ] ) );
	}

	/**
	 * Get raw request value.
	 *
	 * @param string $key Request key.
	 *
	 * @return string
	 */
	private static function get_request_raw( $key ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST[ $key ] ) ) {
			return '';
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		return trim( wp_unslash( $_POST[ $key ] ) );
	}

	/**
	 * Get integer request value.
	 *
	 * @param string $key Request key.
	 *
	 * @return int
	 */
	private static function get_request_absint( $key ) {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( ! isset( $_POST[ $key ] ) ) {
			return 0;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		return absint( $_POST[ $key ] );
	}

	/**
	 * Normalize form name.
	 *
	 * @param string $form_name Form name.
	 *
	 * @return string
	 */
	private static function normalize_form_name( $form_name ) {

		$form_name = sanitize_key( $form_name );

		if ( empty( $form_name ) ) {
			$form_name = 'standard';
		}

		return $form_name;
	}

	/**
	 * Get form name from request.
	 *
	 * @return string
	 */
	private static function get_request_form_name() {
		return self::normalize_form_name( self::get_request_text( 'form_name' ) );
	}

	/**
	 * Normalize raw shortcode string.
	 *
	 * Important:
	 * - Removes Gutenberg shortcode block comments if they were passed accidentally.
	 * - Keeps only raw shortcode text like: [booking resource_id=1 form_type='standard']
	 *
	 * @param string $shortcode_raw Raw shortcode.
	 *
	 * @return string
	 */
	private static function normalize_shortcode_raw( $shortcode_raw ) {

		$shortcode_raw = (string) $shortcode_raw;

		$shortcode_raw = preg_replace( '/<!--\s*wp:shortcode\s*-->/', '', $shortcode_raw );
		$shortcode_raw = preg_replace( '/<!--\s*\/wp:shortcode\s*-->/', '', $shortcode_raw );

		$shortcode_raw = wp_strip_all_tags( $shortcode_raw );
		$shortcode_raw = trim( $shortcode_raw );

		return $shortcode_raw;
	}

	/**
	 * Build default raw shortcode.
	 *
	 * @param int    $resource_id Booking resource ID.
	 * @param string $form_name   Form name.
	 *
	 * @return string
	 */
	private static function build_default_shortcode_raw( $resource_id, $form_name ) {

		$resource_id = absint( $resource_id );
		$form_name   = self::normalize_form_name( $form_name );

		return "[booking resource_id={$resource_id} form_type='{$form_name}']";
	}

	/**
	 * Upsert one shortcode attribute inside [booking ...].
	 *
	 * @param string $shortcode_raw Shortcode.
	 * @param string $attr_name     Attribute name.
	 * @param string $attr_value    Attribute value.
	 * @param string $quote_char    Quote char. Use empty string for unquoted values.
	 *
	 * @return string
	 */
	private static function upsert_shortcode_attr( $shortcode_raw, $attr_name, $attr_value, $quote_char = '' ) {

		$shortcode_raw = (string) $shortcode_raw;
		$attr_name     = trim( (string) $attr_name );
		$attr_value    = trim( (string) $attr_value );
		$quote_char    = (string) $quote_char;

		if ( empty( $attr_name ) ) {
			return $shortcode_raw;
		}

		$replacement_value = $attr_value;
		if ( '' !== $quote_char ) {
			$replacement_value = $quote_char . $attr_value . $quote_char;
		}

		$replacement = $attr_name . '=' . $replacement_value;
		$pattern     = '/\b' . preg_quote( $attr_name, '/' ) . '\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s\]]+)/i';

		if ( preg_match( $pattern, $shortcode_raw ) ) {
			return preg_replace( $pattern, $replacement, $shortcode_raw, 1 );
		}

		if ( ']' === substr( $shortcode_raw, -1 ) ) {
			return substr( $shortcode_raw, 0, -1 ) . ' ' . $replacement . ']';
		}

		return $shortcode_raw . ' ' . $replacement;
	}

	/**
	 * Normalize booking shortcode to current resource + form name.
	 *
	 * @param string $shortcode_raw Raw shortcode.
	 * @param int    $resource_id   Booking resource ID.
	 * @param string $form_name     Form name.
	 *
	 * @return string
	 */
	private static function normalize_booking_shortcode_raw( $shortcode_raw, $resource_id, $form_name ) {

		$shortcode_raw = trim( (string) $shortcode_raw );
		$resource_id   = absint( $resource_id );
		$form_name     = self::normalize_form_name( $form_name );

		if ( empty( $shortcode_raw ) ) {
			return self::build_default_shortcode_raw( $resource_id, $form_name );
		}

		if ( 0 !== strpos( ltrim( $shortcode_raw ), '[booking' ) ) {
			return self::build_default_shortcode_raw( $resource_id, $form_name );
		}

		$shortcode_raw = self::upsert_shortcode_attr( $shortcode_raw, 'resource_id', (string) $resource_id );
		$shortcode_raw = self::upsert_shortcode_attr( $shortcode_raw, 'form_type', $form_name, '\'' );

		return trim( $shortcode_raw );
	}

	/**
	 * Get raw shortcode for publishing.
	 *
	 * @param int    $resource_id Booking resource ID.
	 * @param string $form_name   Form name.
	 *
	 * @return string
	 */
	private static function get_shortcode_raw( $resource_id, $form_name ) {

		$resource_id   = absint( $resource_id );
		$form_name     = self::normalize_form_name( $form_name );
		$shortcode_raw = self::normalize_shortcode_raw( self::get_request_raw( 'shortcode_raw' ) );

		if ( empty( $shortcode_raw ) ) {
			$shortcode_raw = self::build_default_shortcode_raw( $resource_id, $form_name );
		}

		$shortcode_raw = self::normalize_booking_shortcode_raw( $shortcode_raw, $resource_id, $form_name );

		/**
		 * Filter raw shortcode before publishing from BFB.
		 *
		 * @param string $shortcode_raw Raw shortcode.
		 * @param int    $resource_id   Booking resource ID.
		 * @param string $form_name     Form name.
		 */
		$shortcode_raw = apply_filters( 'wpbc_bfb_publish_shortcode_raw', $shortcode_raw, $resource_id, $form_name );

		return trim( $shortcode_raw );
	}

	/**
	 * Wrap raw shortcode into Gutenberg shortcode block comments.
	 *
	 * @param string $shortcode_raw Raw shortcode.
	 *
	 * @return string
	 */
	private static function wrap_shortcode_for_editor( $shortcode_raw ) {
		return '<!-- wp:shortcode -->' . $shortcode_raw . '<!-- /wp:shortcode -->';
	}

	/**
	 * Build duplicate detection signatures for existing page content.
	 *
	 * Important:
	 * - We always check exact current shortcode.
	 * - For "standard" form we also check older legacy variants without form_type.
	 *
	 * @param int    $resource_id   Booking resource ID.
	 * @param string $shortcode_raw Raw shortcode.
	 * @param string $form_name     Form name.
	 *
	 * @return array
	 */
	private static function get_duplicate_check_list( $resource_id, $shortcode_raw, $form_name ) {

		$resource_id = absint( $resource_id );
		$form_name   = self::normalize_form_name( $form_name );

		$check_exist_shortcode_arr = array();

		if ( ! empty( $shortcode_raw ) ) {
			$check_exist_shortcode_arr[] = $shortcode_raw;
		}

		$check_exist_shortcode_arr[] = self::build_default_shortcode_raw( $resource_id, $form_name );
		$check_exist_shortcode_arr[] = '[booking resource_id=' . $resource_id . ' form_type="' . $form_name . '"]';

		if ( 'standard' === $form_name ) {
			$check_exist_shortcode_arr[] = '[booking resource_id=' . $resource_id . ' ';
			$check_exist_shortcode_arr[] = '[booking resource_id=' . $resource_id . ']';
			$check_exist_shortcode_arr[] = '[booking type=' . $resource_id . ' ';
			$check_exist_shortcode_arr[] = '[booking type=' . $resource_id . ']';

			if ( 1 === $resource_id ) {
				$check_exist_shortcode_arr[] = '[booking]';
			}
		}

		return array_values( array_unique( array_filter( $check_exist_shortcode_arr ) ) );
	}

	/**
	 * Resolve page ID from publish result.
	 *
	 * This keeps the AJAX layer compatible with the existing helper,
	 * even if that helper does not yet return post_id directly.
	 *
	 * @param array $result_arr Helper result array.
	 * @param array $request    Original request info.
	 *
	 * @return int
	 */
	private static function resolve_post_id_from_result( $result_arr, $request ) {

		if ( ! empty( $result_arr['post_id'] ) ) {
			return absint( $result_arr['post_id'] );
		}

		if ( ! empty( $request['page_id'] ) ) {
			return absint( $request['page_id'] );
		}

		if ( ! empty( $result_arr['relative_url'] ) ) {

			$relative_url = trim( (string) $result_arr['relative_url'] );

			if ( ! empty( $relative_url ) ) {

				if ( function_exists( 'wpbc_make_link_absolute' ) ) {
					$absolute_url = wpbc_make_link_absolute( $relative_url );
				} else {
					$absolute_url = home_url( $relative_url );
				}

				$post_id = url_to_postid( $absolute_url );

				if ( ! empty( $post_id ) ) {
					return absint( $post_id );
				}

				$path = wp_parse_url( $absolute_url, PHP_URL_PATH );

				if ( ! empty( $path ) ) {
					$path     = trim( $path, '/' );
					$post_obj = get_page_by_path( $path, OBJECT, 'page' );

					if ( ! empty( $post_obj ) ) {
						return absint( $post_obj->ID );
					}
				}
			}
		}

		if ( ! empty( $request['page_post_name'] ) ) {
			$post_obj = get_page_by_path( $request['page_post_name'], OBJECT, 'page' );

			if ( ! empty( $post_obj ) ) {
				return absint( $post_obj->ID );
			}
		}

		return 0;
	}

	/**
	 * Check whether a page template value is already valid.
	 *
	 * @param string $template_value Existing template value.
	 *
	 * @return bool
	 */
	private static function is_page_template_value_valid( $template_value ) {

		$template_value = trim( (string) $template_value );

		if ( '' === $template_value || 'default' === $template_value ) {
			return false;
		}

		if ( function_exists( 'wp_is_block_theme' ) && wp_is_block_theme() ) {
			return true;
		}

		$located = locate_template( array( $template_value ), false, false );

		return ( ! empty( $located ) );
	}

	/**
	 * Try to ensure a full width template on the target page.
	 *
	 * Notes:
	 * - Reuses existing helper wpbc_try_assign_full_width_template() when available.
	 * - Does not override an already valid custom template.
	 *
	 * @param int $post_id Page ID.
	 *
	 * @return bool
	 */
	private static function maybe_ensure_full_width_template( $post_id ) {

		$post_id = absint( $post_id );

		if ( $post_id <= 0 ) {
			return false;
		}

		if ( ! function_exists( 'wpbc_try_assign_full_width_template' ) ) {
			return false;
		}

		$current_template = (string) get_post_meta( $post_id, '_wp_page_template', true );

		if ( self::is_page_template_value_valid( $current_template ) ) {
			return false;
		}

		return (bool) wpbc_try_assign_full_width_template( $post_id );
	}

	/**
	 * Build public page URL.
	 *
	 * @param int $post_id     Page ID.
	 * @param int $resource_id Booking resource ID.
	 *
	 * @return string
	 */
	private static function get_view_url( $post_id, $resource_id ) {

		$post_id     = absint( $post_id );
		$resource_id = absint( $resource_id );

		if ( empty( $post_id ) ) {
			return '';
		}

		$view_url = get_permalink( $post_id );

		if ( ! empty( $resource_id ) ) {
			$view_url .= '#bklnk' . $resource_id;
		}

		return $view_url;
	}

	/**
	 * Validate user capability for requested publish operation.
	 *
	 * @param string $publish_mode Publish mode.
	 * @param int    $page_id      Page ID for edit mode.
	 *
	 * @return void
	 */
	private static function validate_capability( $publish_mode, $page_id ) {

		if ( 'create' === $publish_mode ) {
			if ( ! current_user_can( 'publish_pages' ) ) {
				self::send_error( __( 'You do not have permission to create pages.', 'booking' ) );
			}
			return;
		}

		if ( 'edit' === $publish_mode ) {
			if ( ! current_user_can( 'edit_pages' ) ) {
				self::send_error( __( 'You do not have permission to edit pages.', 'booking' ) );
			}

			if ( ! empty( $page_id ) && ! current_user_can( 'edit_post', $page_id ) ) {
				self::send_error( __( 'You do not have permission to edit the selected page.', 'booking' ) );
			}
		}
	}

	/**
	 * AJAX: Publish booking form into page.
	 *
	 * @return void
	 */
	public static function ajax_publish_form() {

		check_ajax_referer( self::NONCE_ACTION, 'nonce' );

		if ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() ) {
			self::send_error( __( 'This operation is restricted in the demo version.', 'booking' ) );
		}

		if ( ! function_exists( 'wpbc_add_shortcode_into_page' ) ) {
			self::send_error( __( 'Publishing helper is not available.', 'booking' ) );
		}

		$publish_mode  = self::get_request_text( 'publish_mode' );
		$resource_id   = self::get_request_absint( 'resource_id' );
		$form_name     = self::get_request_form_name();
		$page_id       = self::get_request_absint( 'page_id' );
		$page_title    = self::get_request_text( 'page_title' );
		$shortcode_raw = self::get_shortcode_raw( $resource_id, $form_name );

		if ( ( 'create' !== $publish_mode ) && ( 'edit' !== $publish_mode ) ) {
			self::send_error( __( 'Unknown publish mode.', 'booking' ) );
		}

		self::validate_capability( $publish_mode, $page_id );

		if ( empty( $shortcode_raw ) ) {
			self::send_error( __( 'Please save the form first before publishing it.', 'booking' ) );
		}

		$request_params = array(
			'shortcode'             => self::wrap_shortcode_for_editor( $shortcode_raw ),
			'check_exist_shortcode' => self::get_duplicate_check_list( $resource_id, $shortcode_raw, $form_name ),
			'resource_id'           => $resource_id,
			'form_name'             => $form_name,
		);

		if ( 'create' === $publish_mode ) {

			if ( empty( $page_title ) ) {
				self::send_error( __( 'Please enter a page title.', 'booking' ) );
			}

			$request_params['post_title']     = $page_title;
			$request_params['page_post_name'] = sanitize_title( $page_title );

		} elseif ( 'edit' === $publish_mode ) {

			if ( empty( $page_id ) ) {
				self::send_error( __( 'Please select an existing page.', 'booking' ) );
			}

			$page_obj = get_post( $page_id );

			if ( empty( $page_obj ) || ( 'page' !== $page_obj->post_type ) ) {
				self::send_error( __( 'The selected page does not exist.', 'booking' ) );
			}

			$request_params['page_id'] = $page_id;
		}

		/**
		 * Final publish params before calling the shared page helper.
		 *
		 * @param array  $request_params Final params.
		 * @param string $publish_mode   Publish mode.
		 * @param int    $resource_id    Resource ID.
		 * @param string $shortcode_raw  Raw shortcode.
		 * @param string $form_name      Form name.
		 */
		$request_params = apply_filters(
			'wpbc_bfb_publish_request_params',
			$request_params,
			$publish_mode,
			$resource_id,
			$shortcode_raw,
			$form_name
		);

		$result_arr = wpbc_add_shortcode_into_page( $request_params );

		if ( empty( $result_arr['result'] ) ) {
			self::send_error(
				! empty( $result_arr['message'] )
					? $result_arr['message']
					: __( 'Unable to publish booking form into the selected page.', 'booking' )
			);
		}

		$post_id          = self::resolve_post_id_from_result( $result_arr, $request_params );
		$template_applied = self::maybe_ensure_full_width_template( $post_id );
		$view_url         = self::get_view_url( $post_id, $resource_id );
		$edit_url         = ( ! empty( $post_id ) ) ? get_edit_post_link( $post_id, '' ) : '';
		$post_title       = ( ! empty( $post_id ) ) ? get_the_title( $post_id ) : '';

		wp_send_json_success(
			array(
				'message'          => ! empty( $result_arr['message'] ) ? $result_arr['message'] : __( 'Booking form has been published.', 'booking' ),
				'post_id'          => $post_id,
				'post_title'       => $post_title,
				'view_url'         => $view_url,
				'edit_url'         => $edit_url,
				'form_name'        => $form_name,
				'template_applied' => $template_applied ? 1 : 0,
			)
		);
	}
}

WPBC_BFB_Publish_Ajax::init();