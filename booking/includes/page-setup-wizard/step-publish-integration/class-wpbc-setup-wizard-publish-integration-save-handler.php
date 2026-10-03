<?php
/**
 * Progressive save handler for Setup Wizard publishing and integration.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist one authorized publishing destination with bounded compensation.
 *
 * Create-page retries recover the page by an operation marker when the page was
 * committed but the checkpoint response was lost. Existing pages receive one
 * marker-bounded block, so later saves replace that block without duplicating
 * the shortcode or changing unrelated page content.
 */
final class WPBC_Setup_Wizard_Publish_Integration_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** Meta key containing the site- and Booking Calendar owner-scoped context. */
	const META_CONTEXT = WPBC_Setup_Wizard_Publish_Integration::META_CONTEXT;

	/** Meta key containing the operation that created a wizard-owned page. */
	const META_OPERATION = WPBC_Setup_Wizard_Publish_Integration::META_OPERATION;

	/** Meta key containing the last server-owned page-content choice. */
	const META_CONTENT = WPBC_Setup_Wizard_Publish_Integration::META_CONTENT;

	/** @var WPBC_Setup_Wizard_Publish_Integration */
	private $publish_integration;

	/**
	 * Build the handler around the publishing domain service.
	 *
	 * @param WPBC_Setup_Wizard_Publish_Integration|null $publish_integration Optional service for tests.
	 */
	public function __construct( $publish_integration = null ) {
		$this->publish_integration = $publish_integration instanceof WPBC_Setup_Wizard_Publish_Integration
			? $publish_integration
			: new WPBC_Setup_Wizard_Publish_Integration();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'publish_integration';
	}

	/**
	 * Return an operation-specific, server-owned action label.
	 *
	 * @param array<string,mixed> $checkpoint   Current checkpoint.
	 * @param array<string,mixed> $step_context Authorized presentation context.
	 *
	 * @return string Translated action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		$destination = isset( $step_context['values']['publish_destination'] )
			? sanitize_key( (string) $step_context['values']['publish_destination'] )
			: $this->get_checkpoint_destination( $checkpoint );

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination ) {
			return $this->get_saved_created_page_id( $checkpoint )
				? __( 'Update page & continue', 'booking' )
				: __( 'Create page & continue', 'booking' );
		}
		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE === $destination ) {
			return __( 'Update page & continue', 'booking' );
		}

		return __( 'Save & continue', 'booking' );
	}

	/**
	 * Revalidate and persist one publishing choice.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		if ( ! $this->publish_integration->is_available() ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_restricted', __( 'Publishing from the Setup Wizard is unavailable on this website.', 'booking' ) );
		}
		if ( class_exists( 'WPBC_Setup_Wizard_Access' ) && ! WPBC_Setup_Wizard_Access::current_user_can_access() ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_forbidden', __( 'You are not allowed to publish from this Setup Wizard.', 'booking' ) );
		}

		$destination = isset( $validated_fields['publish_destination'] )
			? $this->publish_integration->validate_destination( $validated_fields['publish_destination'], true )
			: new WP_Error( 'wpbc_setup_wizard_publish_destination_required', __( 'Choose how customers will access booking.', 'booking' ) );
		if ( is_wp_error( $destination ) ) {
			return $destination;
		}

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_LATER === $destination ) {
			return $this->create_metadata_result(
				__( 'Publishing deferred. No WordPress page was created or changed.', 'booking' ),
				array( 'destination' => $destination ),
				$checkpoint
			);
		}

		$content_option = $this->publish_integration->resolve_content_option(
			$this->get_customer_journey_id( $checkpoint ),
			$this->get_booking_form_slug( $checkpoint ),
			isset( $validated_fields['publish_page_content'] ) ? $validated_fields['publish_page_content'] : ''
		);
		if ( is_wp_error( $content_option ) ) {
			return $content_option;
		}

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_MANUAL === $destination ) {
			return $this->create_metadata_result(
				__( 'Shortcode saved for manual placement. No WordPress page was created or changed.', 'booking' ),
				array(
					'destination' => $destination,
					'content_id'  => $content_option['id'],
					'shortcode'   => $content_option['shortcode'],
				),
				$checkpoint
			);
		}

		$operation_id = isset( $operation_context['operation_id'] ) ? sanitize_key( (string) $operation_context['operation_id'] ) : '';
		if ( '' === $operation_id ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_operation_missing', __( 'The publishing operation is invalid. Reload the page and try again.', 'booking' ) );
		}

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination ) {
			$page_title = isset( $validated_fields['publish_page_title'] )
				? $this->publish_integration->validate_page_title( $validated_fields['publish_page_title'], true )
				: new WP_Error( 'wpbc_setup_wizard_publish_title_required', __( 'Enter a page title.', 'booking' ) );
			if ( is_wp_error( $page_title ) ) {
				return $page_title;
			}

			return $this->save_created_page( $page_title, $content_option, $checkpoint, $operation_id );
		}

		$page_id = isset( $validated_fields['publish_existing_page_id'] )
			? $this->publish_integration->validate_page_id( $validated_fields['publish_existing_page_id'] )
			: new WP_Error( 'wpbc_setup_wizard_publish_page_invalid', __( 'Choose a valid WordPress page.', 'booking' ) );
		if ( is_wp_error( $page_id ) ) {
			return $page_id;
		}

		return $this->save_existing_page( $page_id, $content_option, $checkpoint );
	}

	/**
	 * Create or update the one page owned by this wizard context.
	 *
	 * @param string                     $page_title     Validated WordPress page title.
	 * @param array<string,string>       $content_option Server-owned content record.
	 * @param array<string,mixed>        $checkpoint     Current checkpoint.
	 * @param string                     $operation_id   Stable save operation identifier.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or error.
	 */
	private function save_created_page( $page_title, array $content_option, array $checkpoint, $operation_id ) {
		if ( ! current_user_can( 'publish_pages' ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_create_forbidden', __( 'Your WordPress role cannot publish pages.', 'booking' ) );
		}

		$context_fingerprint = $this->get_context_fingerprint();
		$page_id             = $this->get_saved_created_page_id( $checkpoint );
		$page                = null;
		$recovered_operation = false;
		if ( $page_id ) {
			$page = $this->get_owned_page( $page_id, $context_fingerprint );
			if ( ! $page ) {
				return new WP_Error( 'wpbc_setup_wizard_publish_page_stale', __( 'The Setup Wizard booking page is missing or is no longer owned by this Booking Calendar account. Review WordPress Pages before continuing.', 'booking' ) );
			}
		}

		if ( ! $page ) {
			$recovered_page = $this->find_page_by_operation( $context_fingerprint, $operation_id );
			if ( is_wp_error( $recovered_page ) ) {
				return $recovered_page;
			}
			if ( $recovered_page ) {
				$page                = $recovered_page;
				$page_id             = absint( $page->ID );
				$recovered_operation = true;
			}
		}

		$managed_block = $this->publish_integration->build_managed_block( $content_option['shortcode'] );
		$page_slug     = sanitize_title( $page_title );
		if ( ! $page ) {
			$page_id = wp_insert_post(
				array(
					'post_type'      => 'page',
					'post_status'    => 'publish',
					'post_title'     => $page_title,
					'post_name'      => $page_slug,
					'post_content'   => $managed_block,
					'comment_status' => 'closed',
					'ping_status'    => 'closed',
					'meta_input'     => array(
						self::META_CONTEXT   => $context_fingerprint,
						self::META_OPERATION => $operation_id,
						self::META_CONTENT   => $content_option['id'],
					),
				),
				true
			);
			if ( is_wp_error( $page_id ) || ! $page_id ) {
				return is_wp_error( $page_id ) ? $page_id : new WP_Error( 'wpbc_setup_wizard_publish_page_not_created', __( 'The booking page could not be created.', 'booking' ) );
			}

			$page = get_post( $page_id );
			if ( ! $this->verify_created_page( $page, $page_title, $managed_block, $context_fingerprint, $operation_id, $content_option['id'] ) ) {
				$was_removed = $this->remove_created_page( $page_id );
				$message     = $was_removed
					? __( 'The booking page could not be verified, so the incomplete page was removed.', 'booking' )
					: __( 'The booking page could not be verified or removed completely. Review WordPress Pages before continuing.', 'booking' );
				return new WP_Error( 'wpbc_setup_wizard_publish_page_not_verified', $message );
			}

			return $this->create_page_result( $page, $content_option, true, false );
		}

		if ( ! current_user_can( 'edit_post', $page_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_page_forbidden', __( 'You no longer have permission to update the Setup Wizard booking page.', 'booking' ) );
		}

		$before_image = $this->get_page_before_image( $page );
		$creation_operation = (string) get_post_meta( $page_id, self::META_OPERATION, true );
		if ( '' === $creation_operation ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_page_stale', __( 'The Setup Wizard booking page has lost its creation identity. Review WordPress Pages before continuing.', 'booking' ) );
		}
		$desired_meta = array(
			self::META_CONTEXT   => $context_fingerprint,
			self::META_OPERATION => $creation_operation,
			self::META_CONTENT   => $content_option['id'],
		);
		$post_changed = (string) $page->post_title !== (string) $page_title
			|| ! $this->page_slug_matches_title( $page, $page_title )
			|| 'publish' !== (string) $page->post_status
			|| (string) $page->post_content !== $managed_block;
		$meta_changed = ! $this->page_meta_matches( $page_id, $desired_meta );

		if ( $post_changed ) {
			$update_result = wp_update_post(
				array(
					'ID'           => $page_id,
					'post_title'   => $page_title,
					'post_name'    => $page_slug,
					'post_status'  => 'publish',
					'post_content' => $managed_block,
				),
				true
			);
			if ( is_wp_error( $update_result ) || ! $update_result ) {
				return is_wp_error( $update_result ) ? $update_result : new WP_Error( 'wpbc_setup_wizard_publish_page_not_updated', __( 'The booking page could not be updated.', 'booking' ) );
			}
		}
		if ( $meta_changed ) {
			$this->write_page_meta( $page_id, $desired_meta );
		}

		$page = get_post( $page_id );
		if ( ! $this->verify_created_page( $page, $page_title, $managed_block, $context_fingerprint, $desired_meta[ self::META_OPERATION ], $content_option['id'] ) ) {
			$was_restored = $this->restore_page( $page_id, $before_image );
			$message      = $was_restored
				? __( 'The booking page update could not be verified. Previous values were restored.', 'booking' )
				: __( 'The booking page update could not be verified or restored completely. Review WordPress Pages before continuing.', 'booking' );
			return new WP_Error( 'wpbc_setup_wizard_publish_page_update_not_verified', $message );
		}

		return $this->create_page_result( $page, $content_option, false, $post_changed || $meta_changed || $recovered_operation );
	}

	/**
	 * Add or replace the managed block on one authorized existing page.
	 *
	 * @param int                        $page_id        Authorized WordPress page ID.
	 * @param array<string,string>       $content_option Server-owned content record.
	 * @param array<string,mixed>        $checkpoint     Current checkpoint containing retained identities.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or error.
	 */
	private function save_existing_page( $page_id, array $content_option, array $checkpoint ) {
		$page_id = absint( $page_id );
		if ( ! current_user_can( 'edit_pages' ) || ! current_user_can( 'edit_post', $page_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_existing_forbidden', __( 'You are not allowed to edit the selected WordPress page.', 'booking' ) );
		}
		$page = get_post( $page_id );
		if ( ! $page || 'page' !== $page->post_type || ! in_array( $page->post_status, array( 'draft', 'publish', 'private' ), true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_existing_stale', __( 'The selected WordPress page is no longer available for publishing.', 'booking' ) );
		}

		$context_fingerprint = $this->get_context_fingerprint();
		$stored_context      = (string) get_post_meta( $page_id, self::META_CONTEXT, true );
		$has_managed_block   = false !== strpos( (string) $page->post_content, WPBC_Setup_Wizard_Publish_Integration::MANAGED_BLOCK_START );
		if ( $has_managed_block && '' !== $stored_context && ! hash_equals( $stored_context, $context_fingerprint ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_existing_owned', __( 'This page contains a booking block managed by another Booking Calendar owner. Choose another page or edit it manually.', 'booking' ) );
		}

		$updated_content = $this->publish_integration->upsert_managed_block( $page->post_content, $content_option['shortcode'] );
		if ( is_wp_error( $updated_content ) ) {
			return $updated_content;
		}

		$before_image = $this->get_page_before_image( $page );
		$desired_meta = array(
			self::META_CONTEXT => $context_fingerprint,
			self::META_CONTENT => $content_option['id'],
		);
		$post_changed = (string) $updated_content !== (string) $page->post_content;
		$meta_changed = ! $this->page_meta_matches( $page_id, $desired_meta );
		if ( $post_changed ) {
			$update_result = wp_update_post(
				array(
					'ID'           => $page_id,
					'post_content' => $updated_content,
				),
				true
			);
			if ( is_wp_error( $update_result ) || ! $update_result ) {
				return is_wp_error( $update_result ) ? $update_result : new WP_Error( 'wpbc_setup_wizard_publish_existing_not_updated', __( 'The selected WordPress page could not be updated.', 'booking' ) );
			}
		}
		if ( $meta_changed ) {
			$this->write_page_meta( $page_id, $desired_meta );
		}

		$verified_page = get_post( $page_id );
		if ( ! $verified_page || (string) $verified_page->post_content !== (string) $updated_content || ! $this->page_meta_matches( $page_id, $desired_meta ) ) {
			$was_restored = $this->restore_page( $page_id, $before_image );
			$message      = $was_restored
				? __( 'The page update could not be verified. Previous content was restored.', 'booking' )
				: __( 'The page update could not be verified or restored completely. Review the selected WordPress page before continuing.', 'booking' );
			return new WP_Error( 'wpbc_setup_wizard_publish_existing_not_verified', $message );
		}

		$updated_ids      = array( 'wp_page_existing:' . $page_id );
		$retained_page_id = $this->get_saved_created_page_id( $checkpoint );
		if ( $retained_page_id ) {
			$updated_ids[] = 'wp_page_created:' . $retained_page_id;
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => $post_changed || $meta_changed
				? __( 'Booking Calendar content added to the selected WordPress page.', 'booking' )
				: __( 'The selected WordPress page already contains the current Booking Calendar content.', 'booking' ),
			'canonical_fingerprint'     => $this->get_page_fingerprint( $verified_page, $content_option ),
			'created_ids'               => array(),
			'updated_ids'               => $updated_ids,
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Create one checkpoint-only result for Manual and Decide later choices.
	 *
	 * A prior wizard-created page mapping is retained without mutating that page.
	 * This prevents a later return to Create page from producing a duplicate.
	 *
	 * @param string              $summary    Translated user-facing summary.
	 * @param array<string,mixed> $metadata   Normalized publishing metadata.
	 * @param array<string,mixed> $checkpoint Current checkpoint containing retained identities.
	 *
	 * @return array<string,mixed> Save result.
	 */
	private function create_metadata_result( $summary, array $metadata, array $checkpoint ) {
		$retained_page_id = $this->get_saved_created_page_id( $checkpoint );

		return array(
			'status'                    => 'saved',
			'summary'                   => $summary,
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( $metadata ) ),
			'created_ids'               => array(),
			'updated_ids'               => $retained_page_id ? array( 'wp_page_created:' . $retained_page_id ) : array(),
			'warnings'                  => array(),
			'writes_canonical_settings' => false,
		);
	}

	/**
	 * Create the normalized result for a verified wizard-owned page.
	 *
	 * @param WP_Post|object             $page           Verified WordPress page.
	 * @param array<string,string>       $content_option Server-owned content record.
	 * @param bool                       $was_created     Whether this request created the page.
	 * @param bool                       $was_updated     Whether this request changed or recovered it.
	 *
	 * @return array<string,mixed> Save result.
	 */
	private function create_page_result( $page, array $content_option, $was_created, $was_updated ) {
		$page_id = absint( $page->ID );
		if ( $was_created ) {
			$summary = __( 'Booking page created and published.', 'booking' );
		} elseif ( $was_updated ) {
			$summary = __( 'Booking page updated and published.', 'booking' );
		} else {
			$summary = __( 'The booking page is already up to date.', 'booking' );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => $summary,
			'canonical_fingerprint'     => $this->get_page_fingerprint( $page, $content_option ),
			'created_ids'               => $was_created ? array( 'wp_page_created:' . $page_id ) : array(),
			'updated_ids'               => $was_created ? array() : array( 'wp_page_created:' . $page_id ),
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Verify exact canonical values for one wizard-owned page.
	 *
	 * @param mixed  $page                Candidate WP_Post object.
	 * @param string $page_title          Expected title.
	 * @param string $managed_block       Expected page content.
	 * @param string $context_fingerprint Expected wizard context.
	 * @param string $operation_id        Expected creation operation.
	 * @param string $content_id          Expected page-content ID.
	 *
	 * @return bool True when every owned value matches.
	 */
	private function verify_created_page( $page, $page_title, $managed_block, $context_fingerprint, $operation_id, $content_id ) {
		if ( ! is_object( $page ) || empty( $page->ID ) || 'page' !== $page->post_type ) {
			return false;
		}

		return 'publish' === (string) $page->post_status
			&& (string) $page_title === (string) $page->post_title
			&& $this->page_slug_matches_title( $page, $page_title )
			&& (string) $managed_block === (string) $page->post_content
			&& $this->page_meta_matches(
				absint( $page->ID ),
				array(
					self::META_CONTEXT   => $context_fingerprint,
					self::META_OPERATION => $operation_id,
					self::META_CONTENT   => $content_id,
				)
			);
	}

	/**
	 * Determine whether WordPress kept the page slug synchronized with its title.
	 *
	 * WordPress may append a numeric suffix when another page already owns the
	 * requested slug. That unique variant remains a correct title-derived URL and
	 * must not make a verified publishing operation fail or retry indefinitely.
	 *
	 * @param WP_Post|object $page       Candidate WordPress page.
	 * @param string         $page_title Expected page title.
	 *
	 * @return bool True for the requested slug or a WordPress numeric unique suffix.
	 */
	private function page_slug_matches_title( $page, $page_title ) {
		if ( ! is_object( $page ) || ! isset( $page->post_name ) ) {
			return false;
		}

		$expected_slug = sanitize_title( (string) $page_title );
		$actual_slug   = sanitize_title( (string) $page->post_name );
		if ( '' === $expected_slug ) {
			return '' !== $actual_slug;
		}

		return $expected_slug === $actual_slug
			|| 1 === preg_match( '/^' . preg_quote( $expected_slug, '/' ) . '-[0-9]+$/', $actual_slug );
	}

	/**
	 * Return an owner- and site-scoped context fingerprint.
	 *
	 * The real administrator ID is intentionally excluded so another authorized
	 * administrator for the same Booking Calendar owner can continue the setup.
	 *
	 * @return string SHA-256 context fingerprint.
	 */
	private function get_context_fingerprint() {
		return $this->publish_integration->get_context_fingerprint();
	}

	/**
	 * Resolve a retained create-page mapping from an earlier successful save.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return int Mapped WordPress page ID, or zero.
	 */
	private function get_saved_created_page_id( array $checkpoint ) {
		$step_result = isset( $checkpoint['step_results']['publish_integration'] ) && is_array( $checkpoint['step_results']['publish_integration'] )
			? $checkpoint['step_results']['publish_integration']
			: array();
		$identifiers = array_merge(
			isset( $step_result['created_ids'] ) ? (array) $step_result['created_ids'] : array(),
			isset( $step_result['updated_ids'] ) ? (array) $step_result['updated_ids'] : array()
		);
		foreach ( $identifiers as $identifier ) {
			if ( is_scalar( $identifier ) && preg_match( '/^wp_page_created:([0-9]+)$/', (string) $identifier, $matches ) ) {
				return absint( $matches[1] );
			}
		}

		return 0;
	}

	/**
	 * Return one mapped page only when it remains owned by this context.
	 *
	 * @param int    $page_id             Candidate WordPress page ID.
	 * @param string $context_fingerprint Expected owner/site fingerprint.
	 *
	 * @return WP_Post|object|null Owned page or null.
	 */
	private function get_owned_page( $page_id, $context_fingerprint ) {
		$page = get_post( absint( $page_id ) );
		if ( ! $page || 'page' !== $page->post_type ) {
			return null;
		}

		$stored_context = (string) get_post_meta( $page->ID, self::META_CONTEXT, true );

		return '' !== $stored_context && hash_equals( $stored_context, $context_fingerprint ) ? $page : null;
	}

	/**
	 * Recover a page created by the same operation before checkpoint commit.
	 *
	 * @param string $context_fingerprint Expected owner/site fingerprint.
	 * @param string $operation_id        Stable operation identifier.
	 *
	 * @return WP_Post|object|null|WP_Error Recovered page, null, or duplicate error.
	 */
	private function find_page_by_operation( $context_fingerprint, $operation_id ) {
		$page_ids = get_posts(
			array(
				'post_type'      => 'page',
				'post_status'    => 'any',
				'posts_per_page' => 2,
				'fields'         => 'ids',
				'no_found_rows'  => true,
				'meta_query'     => array(
					'relation' => 'AND',
					array(
						'key'   => self::META_CONTEXT,
						'value' => $context_fingerprint,
					),
					array(
						'key'   => self::META_OPERATION,
						'value' => $operation_id,
					),
				),
			)
		);
		if ( 1 < count( $page_ids ) ) {
			return new WP_Error( 'wpbc_setup_wizard_publish_operation_ambiguous', __( 'More than one page is linked to this publishing operation. Review WordPress Pages before continuing.', 'booking' ) );
		}

		return empty( $page_ids ) ? null : $this->get_owned_page( absint( reset( $page_ids ) ), $context_fingerprint );
	}

	/**
	 * Capture the bounded page fields and metadata this handler may change.
	 *
	 * @param WP_Post|object $page Current WordPress page.
	 *
	 * @return array<string,mixed> Canonical before-image.
	 */
	private function get_page_before_image( $page ) {
		$meta_before = array();
		foreach ( array( self::META_CONTEXT, self::META_OPERATION, self::META_CONTENT ) as $meta_key ) {
			$meta_before[ $meta_key ] = array(
				'exists' => metadata_exists( 'post', $page->ID, $meta_key ),
				'value'  => get_post_meta( $page->ID, $meta_key, true ),
			);
		}

		return array(
			'post_title'   => (string) $page->post_title,
			'post_name'    => isset( $page->post_name ) ? (string) $page->post_name : '',
			'post_status'  => (string) $page->post_status,
			'post_content' => (string) $page->post_content,
			'meta'         => $meta_before,
		);
	}

	/**
	 * Restore the page fields and metadata owned by this handler.
	 *
	 * @param int                 $page_id      WordPress page ID.
	 * @param array<string,mixed> $before_image Canonical before-image.
	 *
	 * @return bool True when the before-image was restored exactly.
	 */
	private function restore_page( $page_id, array $before_image ) {
		$restore_result = wp_update_post(
			array(
				'ID'           => absint( $page_id ),
				'post_title'   => isset( $before_image['post_title'] ) ? $before_image['post_title'] : '',
				'post_name'    => isset( $before_image['post_name'] ) ? $before_image['post_name'] : '',
				'post_status'  => isset( $before_image['post_status'] ) ? $before_image['post_status'] : 'draft',
				'post_content' => isset( $before_image['post_content'] ) ? $before_image['post_content'] : '',
			),
			true
		);
		if ( is_wp_error( $restore_result ) || ! $restore_result ) {
			return false;
		}

		foreach ( isset( $before_image['meta'] ) && is_array( $before_image['meta'] ) ? $before_image['meta'] : array() as $meta_key => $meta_before ) {
			if ( ! empty( $meta_before['exists'] ) ) {
				update_post_meta( $page_id, $meta_key, $meta_before['value'] );
			} else {
				delete_post_meta( $page_id, $meta_key );
			}
		}

		$restored_page = get_post( $page_id );
		if ( ! $restored_page
			|| (string) $restored_page->post_title !== (string) $before_image['post_title']
			|| (string) $restored_page->post_name !== (string) $before_image['post_name']
			|| (string) $restored_page->post_status !== (string) $before_image['post_status']
			|| (string) $restored_page->post_content !== (string) $before_image['post_content']
		) {
			return false;
		}

		foreach ( $before_image['meta'] as $meta_key => $meta_before ) {
			if ( ! empty( $meta_before['exists'] ) ) {
				if ( ! metadata_exists( 'post', $page_id, $meta_key ) || get_post_meta( $page_id, $meta_key, true ) !== $meta_before['value'] ) {
					return false;
				}
			} elseif ( metadata_exists( 'post', $page_id, $meta_key ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Remove a page created by the current failed operation.
	 *
	 * @param int $page_id WordPress page ID.
	 *
	 * @return bool True when the page no longer exists.
	 */
	private function remove_created_page( $page_id ) {
		wp_delete_post( absint( $page_id ), true );

		return null === get_post( absint( $page_id ) );
	}

	/**
	 * Write a bounded page-meta map.
	 *
	 * @param int                  $page_id      WordPress page ID.
	 * @param array<string,string> $desired_meta Meta values keyed by owned keys.
	 *
	 * @return void
	 */
	private function write_page_meta( $page_id, array $desired_meta ) {
		foreach ( $desired_meta as $meta_key => $meta_value ) {
			update_post_meta( absint( $page_id ), $meta_key, $meta_value );
		}
	}

	/**
	 * Compare exact stored meta values with a bounded expected map.
	 *
	 * @param int                  $page_id      WordPress page ID.
	 * @param array<string,string> $desired_meta Expected meta values.
	 *
	 * @return bool True when every value exists and matches.
	 */
	private function page_meta_matches( $page_id, array $desired_meta ) {
		foreach ( $desired_meta as $meta_key => $meta_value ) {
			if ( ! metadata_exists( 'post', absint( $page_id ), $meta_key ) || (string) get_post_meta( $page_id, $meta_key, true ) !== (string) $meta_value ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Hash the canonical publishing state without storing page content in metadata.
	 *
	 * @param WP_Post|object        $page           Verified page.
	 * @param array<string,string> $content_option Server-owned content record.
	 *
	 * @return string SHA-256 canonical fingerprint.
	 */
	private function get_page_fingerprint( $page, array $content_option ) {
		return hash(
			'sha256',
			wp_json_encode(
				array(
					'page_id'      => absint( $page->ID ),
					'post_title'   => (string) $page->post_title,
					'post_name'    => isset( $page->post_name ) ? (string) $page->post_name : '',
					'post_status'  => (string) $page->post_status,
					'content_hash' => hash( 'sha256', (string) $page->post_content ),
					'content_id'   => (string) $content_option['id'],
					'shortcode'    => (string) $content_option['shortcode'],
				)
			)
		);
	}

	/**
	 * Read the saved Customer Journey.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return string Stable journey ID.
	 */
	private function get_customer_journey_id( array $checkpoint ) {
		return isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $checkpoint['values']['customer_journey']['customer_journey'] )
			: '';
	}

	/**
	 * Read the saved Booking Form template slug.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return string Sanitized form slug.
	 */
	private function get_booking_form_slug( array $checkpoint ) {
		return isset( $checkpoint['values']['booking_form_template']['booking_form_template'] )
			? sanitize_title( (string) $checkpoint['values']['booking_form_template']['booking_form_template'] )
			: '';
	}

	/**
	 * Read the retained destination for action-label fallback.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return string Sanitized destination ID.
	 */
	private function get_checkpoint_destination( array $checkpoint ) {
		return isset( $checkpoint['values']['publish_integration']['publish_destination'] )
			? sanitize_key( (string) $checkpoint['values']['publish_integration']['publish_destination'] )
			: '';
	}

	/**
	 * Publish & integrate is not the terminal route step.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}
