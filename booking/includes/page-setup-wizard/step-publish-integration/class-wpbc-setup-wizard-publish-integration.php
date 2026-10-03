<?php
/**
 * Publish and integration choices for the Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/class-wpbc-setup-wizard-environment-policy.php';

/**
 * Provide authorized destinations, WordPress pages, shortcode suggestions, and
 * the bounded managed block used by the progressive publishing save boundary.
 */
final class WPBC_Setup_Wizard_Publish_Integration {

	/** Opening marker for the one Setup Wizard-owned block on a WordPress page. */
	const MANAGED_BLOCK_START = '<!-- wpbc-setup-wizard-booking:start -->';

	/** Closing marker for the one Setup Wizard-owned block on a WordPress page. */
	const MANAGED_BLOCK_END = '<!-- wpbc-setup-wizard-booking:end -->';

	/** Meta key containing the site- and Booking Calendar owner-scoped context. */
	const META_CONTEXT = '_wpbc_setup_wizard_publish_context';

	/** Meta key containing the operation that created a wizard-owned page. */
	const META_OPERATION = '_wpbc_setup_wizard_publish_operation';

	/** Meta key containing the last server-owned page-content choice. */
	const META_CONTENT = '_wpbc_setup_wizard_publish_content';

	const DESTINATION_CREATE_PAGE   = 'create_page';
	const DESTINATION_EXISTING_PAGE = 'existing_page';
	const DESTINATION_MANUAL        = 'manual';
	const DESTINATION_LATER         = 'later';

	const CONTENT_RECOMMENDED          = 'recommended';
	const CONTENT_APPOINTMENT_FLOW     = 'appointment_flow';
	const CONTENT_RESOURCE_SELECTION   = 'resource_selection';
	const CONTENT_DIRECT_BOOKING_FORM  = 'direct_booking_form';
	const CONTENT_AVAILABILITY_CALENDAR = 'availability_calendar';

	/** Canonical form identity produced by every Setup Wizard Booking Form route. */
	const CANONICAL_FORM_SLUG = 'standard';

	/** Backward-compatible alias for the former Guided-only constant name. */
	const GUIDED_FORM_SLUG = 'standard';

	/** Official configuration guide for the Appointment booking shortcode. */
	const HELP_APPOINTMENT_SHORTCODE_URL = 'https://wpbookingcalendar.com/faq/shortcode-appointment-booking/';

	/** Official configuration guide for the Booking Resource selector shortcode. */
	const HELP_RESOURCE_SHORTCODE_URL = 'https://wpbookingcalendar.com/faq/shortcode-booking-resource-selector/';

	/** Official configuration guide for the direct Booking Form shortcode. */
	const HELP_BOOKING_FORM_SHORTCODE_URL = 'https://wpbookingcalendar.com/faq/shortcode-booking-form/';

	/** Official configuration guide for the availability-only calendar shortcode. */
	const HELP_AVAILABILITY_SHORTCODE_URL = 'https://wpbookingcalendar.com/faq/shortcode-availability-calendar/';

	/** Official guide for inserting Booking Calendar shortcodes into WordPress content. */
	const HELP_SHORTCODE_INSERTION_URL = 'https://wpbookingcalendar.com/faq/insert-booking-calendar-into-page/';

	/**
	 * Determine whether this planning step may appear on the current site.
	 *
	 * The step is deliberately omitted when the shared environment policy blocks
	 * page publishing instead of merely disabling its controls. Public live demos
	 * are restricted; internal test installations keep the complete route.
	 *
	 * @return bool True when the step may be shown.
	 */
	public function is_available() {
		return WPBC_Setup_Wizard_Environment_Policy::allows_page_publishing();
	}

	/**
	 * Return the preferred initial destination for the current user.
	 *
	 * @return string Stable destination identifier.
	 */
	public function get_initial_destination() {
		return current_user_can( 'publish_pages' ) ? self::DESTINATION_CREATE_PAGE : self::DESTINATION_MANUAL;
	}

	/**
	 * Return the initial page title suggestion for one customer journey.
	 *
	 * Guided Appointment keeps its established appointment language. Every other
	 * journey publishes a direct Booking Form by default, so its suggested public
	 * page title must not imply the guided Service and Provider flow.
	 *
	 * @param string $customer_journey Selected customer journey identifier.
	 *
	 * @return string Translated page title.
	 */
	public function get_initial_page_title( $customer_journey ) {
		return 'guided_appointment_flow' === sanitize_key( (string) $customer_journey )
			? __( 'Book an appointment', 'booking' )
			: __( 'Booking form', 'booking' );
	}

	/**
	 * Return ordered destination cards with capability-aware availability.
	 *
	 * @param array<int,array<string,mixed>> $publishable_pages Pages the current user may edit.
	 *
	 * @return array<int,array<string,mixed>> Destination presentation records.
	 */
	public function get_destination_options( array $publishable_pages ) {
		$can_create_page = current_user_can( 'publish_pages' );
		$can_use_page    = current_user_can( 'edit_pages' ) && ! empty( $publishable_pages );

		return array(
			array(
				'id'              => self::DESTINATION_CREATE_PAGE,
				'label'           => __( 'Create a new page', 'booking' ),
				'description'     => __( 'Create a dedicated WordPress page for your booking experience.', 'booking' ),
				'icon'            => 'wpbc_icn_note_add',
				'badge'           => __( 'Recommended', 'booking' ),
				'is_enabled'      => $can_create_page,
				'disabled_reason' => $can_create_page ? '' : __( 'Your WordPress role cannot publish pages. Choose another destination.', 'booking' ),
			),
			array(
				'id'              => self::DESTINATION_EXISTING_PAGE,
				'label'           => __( 'Use an existing page', 'booking' ),
				'description'     => __( 'Add the booking experience to a page already on your site.', 'booking' ),
				'icon'            => 'wpbc_icn_insert_drive_file',
				'badge'           => '',
				'is_enabled'      => $can_use_page,
				'disabled_reason' => current_user_can( 'edit_pages' )
					? __( 'No editable WordPress pages are available.', 'booking' )
					: __( 'Your WordPress role cannot edit pages. Choose another destination.', 'booking' ),
			),
			array(
				'id'              => self::DESTINATION_MANUAL,
				'label'           => __( 'Add it manually', 'booking' ),
				'description'     => __( 'Copy the shortcode and place it wherever you prefer.', 'booking' ),
				'icon'            => 'wpbc_icn_code',
				'badge'           => '',
				'is_enabled'      => true,
				'disabled_reason' => '',
			),
			array(
				'id'              => self::DESTINATION_LATER,
				'label'           => __( 'Decide later', 'booking' ),
				'description'     => __( 'Finish setup now and integrate the booking experience later.', 'booking' ),
				'icon'            => 'wpbc_icn_schedule',
				'badge'           => '',
				'is_enabled'      => true,
				'disabled_reason' => '',
			),
		);
	}

	/**
	 * Return every editable WordPress page authorized for the current user.
	 *
	 * @return array<int,array{id:int,title:string,url:string}> Authorized page records.
	 */
	public function get_publishable_pages() {
		if ( ! current_user_can( 'edit_pages' ) || ! $this->is_available() ) {
			return array();
		}

		$page_ids = get_posts(
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
				'url'   => $this->get_relative_url( get_permalink( $page_id ) ),
			);
		}

		return $publishable_pages;
	}

	/**
	 * Return journey-aware page-content choices and exact shortcodes.
	 *
	 * @param string $customer_journey Selected customer journey identifier.
	 * @param string $form_slug        Retained source-template slug. Publishing always targets the canonical Standard form.
	 *
	 * @return array<int,array<string,string>> Content option records with official help links.
	 */
	public function get_content_options( $customer_journey, $form_slug ) {
		$customer_journey = sanitize_key( (string) $customer_journey );
		$form_slug        = self::CANONICAL_FORM_SLUG;
		$direct_shortcode = sprintf( '[booking form_type="%s"]', $form_slug );

		$direct_booking_option = array(
			'id'                   => self::CONTENT_DIRECT_BOOKING_FORM,
			'label'                => __( 'Direct booking form', 'booking' ),
			'description'          => __( 'Show the booking form immediately.', 'booking' ),
			'shortcode'            => $direct_shortcode,
			'shortcode_help_url'   => self::HELP_BOOKING_FORM_SHORTCODE_URL,
			'shortcode_help_label' => __( 'Booking form shortcode', 'booking' ),
		);
		$resource_selection_option = array(
			'id'                   => self::CONTENT_RESOURCE_SELECTION,
			'label'                => __( 'Resource selection', 'booking' ),
			'description'          => __( 'Let customers choose what they want to book before opening the booking form.', 'booking' ),
			'shortcode'            => '[booking_resource_selector]',
			'shortcode_help_url'   => self::HELP_RESOURCE_SHORTCODE_URL,
			'shortcode_help_label' => __( 'Booking Resource selector shortcode', 'booking' ),
		);

		if ( 'guided_appointment_flow' === $customer_journey ) {
			$primary_option = array(
				'id'                   => self::CONTENT_APPOINTMENT_FLOW,
				'label'                => __( 'Guided appointment flow', 'booking' ),
				'description'          => __( 'Let customers choose a Service, Provider, date, and time.', 'booking' ),
				'shortcode'            => '' !== $form_slug
					? sprintf( '[booking_appointment form_type="%s"]', $form_slug )
					: '[booking_appointment]',
				'shortcode_help_url'   => self::HELP_APPOINTMENT_SHORTCODE_URL,
				'shortcode_help_label' => __( 'Appointment booking shortcode', 'booking' ),
			);
			$secondary_option = $direct_booking_option;
		} else {
			$primary_option   = $direct_booking_option;
			$secondary_option = $resource_selection_option;
		}

		return array(
			$primary_option,
			$secondary_option,
			array(
				'id'                   => self::CONTENT_AVAILABILITY_CALENDAR,
				'label'                => __( 'Availability calendar', 'booking' ),
				'description'          => __( 'Show the booking availability calendar without the booking form.', 'booking' ),
				'shortcode'            => '[bookingcalendar]',
				'shortcode_help_url'   => self::HELP_AVAILABILITY_SHORTCODE_URL,
				'shortcode_help_label' => __( 'Availability calendar shortcode', 'booking' ),
			),
		);
	}

	/**
	 * Return the official guide for placing Booking Calendar shortcodes.
	 *
	 * This guide is shared by every allow-listed page-content choice, while the
	 * shortcode-specific guide remains part of each content record.
	 *
	 * @return array{url:string,label:string} Official insertion-help record.
	 */
	public function get_shortcode_insertion_help() {
		return array(
			'url'   => self::HELP_SHORTCODE_INSERTION_URL,
			'label' => __( 'Add a shortcode to a WordPress page', 'booking' ),
		);
	}

	/**
	 * Return the recommended content choice for one journey.
	 *
	 * @param string $customer_journey Selected customer journey identifier.
	 *
	 * @return string Stable content identifier.
	 */
	public function get_recommended_content_id( $customer_journey ) {
		return 'guided_appointment_flow' === sanitize_key( (string) $customer_journey )
			? self::CONTENT_APPOINTMENT_FLOW
			: self::CONTENT_DIRECT_BOOKING_FORM;
	}

	/**
	 * Return the current owner- and site-scoped publishing context fingerprint.
	 *
	 * Both the mutation handler and read-only Booking Listing discovery use this
	 * value. Keeping the calculation here prevents ownership drift between the
	 * page writer and the component that later presents the created page.
	 *
	 * @return string SHA-256 context fingerprint.
	 */
	public function get_context_fingerprint() {
		$storage_context = class_exists( 'WPBC_Setup_Wizard_Access' )
			? WPBC_Setup_Wizard_Access::get_storage_context()
			: array(
				'owner_user_id' => function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : absint( get_current_user_id() ),
				'site_id'       => absint( get_current_blog_id() ),
			);

		return hash(
			'sha256',
			wp_json_encode(
				array(
					'owner_user_id' => isset( $storage_context['owner_user_id'] ) ? absint( $storage_context['owner_user_id'] ) : 0,
					'site_id'       => isset( $storage_context['site_id'] ) ? absint( $storage_context['site_id'] ) : 0,
				)
			)
		);
	}

	/**
	 * Find the most recently modified public page created by this Setup context.
	 *
	 * Existing pages edited by Setup Wizard intentionally have no creation marker
	 * and are excluded. The Booking Listing dialog therefore describes a page as
	 * Setup-created only when the publish handler actually created and still owns
	 * it for the current Booking Calendar owner and multisite site.
	 *
	 * @return WP_Post|object|null Owned published page, or null when unavailable.
	 */
	public function get_latest_created_page() {
		$context_fingerprint = $this->get_context_fingerprint();
		$page_ids           = get_posts(
			array(
				'post_type'        => 'page',
				'post_status'      => 'publish',
				'posts_per_page'   => 1,
				'orderby'          => 'modified',
				'order'            => 'DESC',
				'fields'           => 'ids',
				'no_found_rows'    => true,
				'suppress_filters' => false,
				'meta_query'       => array(
					'relation' => 'AND',
					array(
						'key'   => self::META_CONTEXT,
						'value' => $context_fingerprint,
					),
					array(
						'key'     => self::META_OPERATION,
						'compare' => 'EXISTS',
					),
				),
			)
		);
		$page_id  = ! empty( $page_ids ) ? absint( reset( $page_ids ) ) : 0;
		$page     = $page_id ? get_post( $page_id ) : null;

		if ( ! $page || 'page' !== $page->post_type || 'publish' !== $page->post_status ) {
			return null;
		}

		$stored_context = (string) get_post_meta( $page_id, self::META_CONTEXT, true );
		$operation_id   = (string) get_post_meta( $page_id, self::META_OPERATION, true );

		return '' !== $operation_id && hash_equals( $stored_context, $context_fingerprint ) ? $page : null;
	}

	/**
	 * Resolve one journey-aware, server-owned page-content record.
	 *
	 * The `recommended` alias is resolved before lookup so persistence never
	 * depends on a browser-provided shortcode or label.
	 *
	 * @param string $customer_journey Selected customer journey identifier.
	 * @param string $form_slug        Retained source-template slug. Publishing resolves it to the canonical Standard form.
	 * @param string $content_id       Proposed page-content identifier.
	 *
	 * @return array<string,string>|WP_Error Authorized content record or error.
	 */
	public function resolve_content_option( $customer_journey, $form_slug, $content_id ) {
		$content_id = sanitize_key( (string) $content_id );
		if ( self::CONTENT_RECOMMENDED === $content_id ) {
			$content_id = $this->get_recommended_content_id( $customer_journey );
		}

		foreach ( $this->get_content_options( $customer_journey, $form_slug ) as $content_option ) {
			if ( isset( $content_option['id'] ) && $content_id === $content_option['id'] ) {
				return $content_option;
			}
		}

		return new WP_Error( 'wpbc_setup_wizard_publish_content_stale', __( 'The selected booking page content is no longer available. Review the publishing choice and try again.', 'booking' ) );
	}

	/**
	 * Build the exact block managed by the Setup Wizard on a WordPress page.
	 *
	 * @param string $shortcode Server-owned Booking Calendar shortcode.
	 *
	 * @return string WordPress Shortcode block wrapped in stable management markers.
	 */
	public function build_managed_block( $shortcode ) {
		$shortcode = trim( (string) $shortcode );

		return self::MANAGED_BLOCK_START . "\n"
			. '<!-- wp:shortcode -->' . "\n"
			. $shortcode . "\n"
			. '<!-- /wp:shortcode -->' . "\n"
			. self::MANAGED_BLOCK_END;
	}

	/**
	 * Insert or replace the one Setup Wizard-managed booking block.
	 *
	 * Existing unmarked copies are claimed only when exactly one unambiguous
	 * Shortcode block or raw shortcode exists. Multiple marker regions or
	 * multiple unmarked copies fail closed to avoid deleting customer content.
	 *
	 * @param string $post_content Existing WordPress page content.
	 * @param string $shortcode    Server-owned Booking Calendar shortcode.
	 *
	 * @return string|WP_Error Updated page content or a safe ambiguity error.
	 */
	public function upsert_managed_block( $post_content, $shortcode ) {
		$post_content  = (string) $post_content;
		$shortcode     = trim( (string) $shortcode );
		$managed_block = $this->build_managed_block( $shortcode );
		$start_count   = substr_count( $post_content, self::MANAGED_BLOCK_START );
		$end_count     = substr_count( $post_content, self::MANAGED_BLOCK_END );

		if ( 1 < $start_count || 1 < $end_count || $start_count !== $end_count ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_block_ambiguous', __( 'This page contains an incomplete or duplicate Setup Wizard booking block. Review the page content before trying again.', 'booking' ) );
		}

		if ( 1 === $start_count ) {
			$pattern = '/' . preg_quote( self::MANAGED_BLOCK_START, '/' ) . '.*?' . preg_quote( self::MANAGED_BLOCK_END, '/' ) . '/s';
			if ( 1 !== preg_match_all( $pattern, $post_content ) ) {
				return new WP_Error( 'wpbc_setup_wizard_publish_block_ambiguous', __( 'This page contains an incomplete or duplicate Setup Wizard booking block. Review the page content before trying again.', 'booking' ) );
			}

			$unmanaged_content = preg_replace( $pattern, '', $post_content, 1 );
			if ( ! is_string( $unmanaged_content ) || false !== strpos( $unmanaged_content, $shortcode ) ) {
				return new WP_Error( 'wpbc_setup_wizard_publish_shortcode_ambiguous', __( 'This page contains another copy of the selected shortcode outside the Setup Wizard booking block. Remove the duplicate before trying again.', 'booking' ) );
			}

			return preg_replace_callback(
				$pattern,
				static function () use ( $managed_block ) {
					return $managed_block;
				},
				$post_content,
				1
			);
		}

		$shortcode_block_pattern = '/<!--\s+wp:shortcode\s*-->\s*' . preg_quote( $shortcode, '/' ) . '\s*<!--\s+\/wp:shortcode\s*-->/';
		$block_count             = preg_match_all( $shortcode_block_pattern, $post_content );
		$raw_count               = substr_count( $post_content, $shortcode );

		if ( false === $block_count || 1 < $raw_count || 1 < $block_count ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_shortcode_ambiguous', __( 'This page already contains the selected shortcode more than once. Remove duplicate copies before asking the Setup Wizard to manage it.', 'booking' ) );
		}

		if ( 1 === $block_count ) {
			return preg_replace_callback(
				$shortcode_block_pattern,
				static function () use ( $managed_block ) {
					return $managed_block;
				},
				$post_content,
				1
			);
		}
		if ( 1 === $raw_count ) {
			return preg_replace_callback(
				'/' . preg_quote( $shortcode, '/' ) . '/',
				static function () use ( $managed_block ) {
					return $managed_block;
				},
				$post_content,
				1
			);
		}

		return '' === trim( $post_content ) ? $managed_block : rtrim( $post_content ) . "\n\n" . $managed_block;
	}

	/**
	 * Build a relative page URL preview without creating the page.
	 *
	 * @param string $page_title Proposed WordPress page title.
	 *
	 * @return string Relative URL preview.
	 */
	public function get_new_page_url_preview( $page_title ) {
		$page_slug = sanitize_title( (string) $page_title );
		$page_slug = '' !== $page_slug ? $page_slug : 'booking';

		return $this->get_relative_url( home_url( user_trailingslashit( $page_slug ) ) );
	}

	/**
	 * Return the WordPress home path used by the browser-side slug preview.
	 *
	 * @return string Root-relative, trailing-slashed path.
	 */
	public function get_home_path() {
		$home_path = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		$home_path = is_string( $home_path ) && '' !== $home_path ? $home_path : '/';

		return trailingslashit( '/' . ltrim( $home_path, '/' ) );
	}

	/**
	 * Validate a destination identifier against current capabilities.
	 *
	 * @param mixed $raw_destination Untrusted destination identifier.
	 * @param bool  $is_required     Whether an empty destination is invalid.
	 *
	 * @return string|WP_Error Normalized identifier or validation error.
	 */
	public function validate_destination( $raw_destination, $is_required ) {
		if ( ! is_scalar( $raw_destination ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_destination_invalid', __( 'Choose a valid booking destination.', 'booking' ) );
		}

		$raw_destination = trim( (string) $raw_destination );
		$destination     = sanitize_key( $raw_destination );
		if ( '' === $destination ) {
			return $is_required
				? new WP_Error( 'wpbc_setup_wizard_publish_destination_required', __( 'Choose how customers will access booking.', 'booking' ) )
				: '';
		}

		if ( $destination !== $raw_destination || ! in_array( $destination, $this->get_destination_ids(), true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_destination_unknown', __( 'Choose a valid booking destination.', 'booking' ) );
		}

		if ( self::DESTINATION_CREATE_PAGE === $destination && ! current_user_can( 'publish_pages' ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_create_forbidden', __( 'Your WordPress role cannot publish pages.', 'booking' ) );
		}

		if ( self::DESTINATION_EXISTING_PAGE === $destination && ! current_user_can( 'edit_pages' ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_existing_forbidden', __( 'Your WordPress role cannot edit pages.', 'booking' ) );
		}

		return $destination;
	}

	/**
	 * Validate a bounded proposed page title.
	 *
	 * @param mixed $raw_title   Untrusted page title.
	 * @param bool  $is_required Whether an empty title is invalid.
	 *
	 * @return string|WP_Error Sanitized title or validation error.
	 */
	public function validate_page_title( $raw_title, $is_required ) {
		if ( ! is_scalar( $raw_title ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_title_invalid', __( 'Enter a valid page title.', 'booking' ) );
		}

		$page_title = sanitize_text_field( (string) $raw_title );
		if ( '' === trim( $page_title ) ) {
			return $is_required
				? new WP_Error( 'wpbc_setup_wizard_publish_title_required', __( 'Enter a page title.', 'booking' ) )
				: '';
		}

		$length = function_exists( 'mb_strlen' ) ? mb_strlen( $page_title ) : strlen( $page_title );
		if ( 200 < $length ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_title_too_long', __( 'Use 200 characters or fewer for the page title.', 'booking' ) );
		}

		return $page_title;
	}

	/**
	 * Validate a selected WordPress page ID without authorizing it yet.
	 *
	 * @param mixed $raw_page_id Untrusted page ID.
	 *
	 * @return int|WP_Error Non-negative page ID or validation error.
	 */
	public function validate_page_id( $raw_page_id ) {
		if ( ! is_scalar( $raw_page_id ) || ! preg_match( '/^\d+$/', (string) $raw_page_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_page_invalid', __( 'Choose a valid WordPress page.', 'booking' ) );
		}

		return absint( $raw_page_id );
	}

	/**
	 * Validate a content choice before journey-specific validation.
	 *
	 * @param mixed $raw_content Untrusted content identifier.
	 * @param bool  $is_required Whether an empty choice is invalid.
	 *
	 * @return string|WP_Error Normalized identifier or validation error.
	 */
	public function validate_content( $raw_content, $is_required ) {
		if ( ! is_scalar( $raw_content ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_content_invalid', __( 'Choose valid booking page content.', 'booking' ) );
		}

		$raw_content = trim( (string) $raw_content );
		$content     = sanitize_key( $raw_content );
		if ( '' === $content ) {
			return $is_required
				? new WP_Error( 'wpbc_setup_wizard_publish_content_required', __( 'Choose the booking experience to display.', 'booking' ) )
				: '';
		}

		$allowed_content = array(
			self::CONTENT_RECOMMENDED,
			self::CONTENT_APPOINTMENT_FLOW,
			self::CONTENT_RESOURCE_SELECTION,
			self::CONTENT_DIRECT_BOOKING_FORM,
			self::CONTENT_AVAILABILITY_CALENDAR,
		);
		if ( $content !== $raw_content || ! in_array( $content, $allowed_content, true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_content_unknown', __( 'Choose valid booking page content.', 'booking' ) );
		}

		return $content;
	}

	/**
	 * Confirm that one page belongs to the current authorized page list.
	 *
	 * @param int                                $page_id           Proposed WordPress page ID.
	 * @param array<int,array<string,mixed>>     $publishable_pages Authorized page records.
	 *
	 * @return bool True when the page remains authorized.
	 */
	public function is_authorized_page( $page_id, array $publishable_pages ) {
		$page_id = absint( $page_id );
		foreach ( $publishable_pages as $publishable_page ) {
			if ( isset( $publishable_page['id'] ) && $page_id === absint( $publishable_page['id'] ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Return all stable destination IDs.
	 *
	 * @return string[] Destination allow-list.
	 */
	private function get_destination_ids() {
		return array(
			self::DESTINATION_CREATE_PAGE,
			self::DESTINATION_EXISTING_PAGE,
			self::DESTINATION_MANUAL,
			self::DESTINATION_LATER,
		);
	}

	/**
	 * Reduce an absolute site URL to a root-relative display URL.
	 *
	 * @param mixed $url Candidate page URL.
	 *
	 * @return string Root-relative URL, or an empty string.
	 */
	private function get_relative_url( $url ) {
		if ( ! is_scalar( $url ) || '' === (string) $url ) {
			return '';
		}

		$url_parts = wp_parse_url( (string) $url );
		if ( ! is_array( $url_parts ) ) {
			return '';
		}

		$path  = isset( $url_parts['path'] ) && '' !== $url_parts['path'] ? (string) $url_parts['path'] : '/';
		$query = isset( $url_parts['query'] ) && '' !== $url_parts['query'] ? '?' . $url_parts['query'] : '';

		return $path . $query;
	}
}
