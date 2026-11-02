<?php
/**
 * Authorized Booking Form repository for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Loads bounded published forms for the selected authorized Resource owner.
 */
final class WPBC_Booking_New_Inspector_Form_Repository {

	/** @var WPBC_Booking_Form_Definition_Repository Exact fallback resolver. */
	private $form_definition_repository;

	/**
	 * Construct the repository.
	 *
	 * @param WPBC_Booking_Form_Definition_Repository|null $form_definition_repository Optional exact resolver.
	 */
	public function __construct( $form_definition_repository = null ) {
		$this->form_definition_repository = $form_definition_repository
			? $form_definition_repository
			: new WPBC_Booking_Form_Definition_Repository();
	}

	/**
	 * Load owner-authorized published form records and exact definitions.
	 *
	 * @param array<string,mixed> $resource Authorized internal Resource record.
	 * @return array<int,array<string,mixed>>|WP_Error Internal form records or a safe query error.
	 */
	public function get_authorized_forms( $resource ) {
		$resource_id  = isset( $resource['id'] ) ? absint( $resource['id'] ) : 0;
		$owner_user_id = $this->get_form_owner_user_id( $resource_id, $resource );
		$allow_custom  = $this->regular_owner_can_use_custom_forms( $owner_user_id );
		$forms         = $this->load_builder_forms( $owner_user_id, $allow_custom );
		if ( is_wp_error( $forms ) ) {
			return $forms;
		}

		$forms_by_id = array();
		foreach ( $forms as $form ) {
			if ( empty( $form['id'] ) || isset( $forms_by_id[ $form['id'] ] ) ) {
				continue;
			}
			$forms_by_id[ $form['id'] ] = $form;
		}

		if ( ! isset( $forms_by_id['standard'] ) ) {
			$definition = $this->form_definition_repository->get_form_definition(
				$resource_id,
				'standard',
				array(
					'form_status'  => 'published',
					'owner_user_id' => $owner_user_id,
				)
			);
			$forms_by_id = array_merge(
				array(
					'standard' => array(
						'id'         => 'standard',
						'label'      => __( 'Standard booking form', 'booking' ),
						'source'     => $this->get_definition_source( $definition ),
						'definition' => is_array( $definition ) ? $definition : array(),
					),
				),
				$forms_by_id
			);
		}

		if ( WPBC_Booking_New_Inspector_Config::MAX_FORM_CHOICES < count( $forms_by_id ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_form_limit',
				__( 'Too many Booking Forms are available for this view. Use the full Add Booking page.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		return array_values( $forms_by_id );
	}

	/**
	 * Load all published Builder definitions in one owner-scoped query.
	 *
	 * @param int  $owner_user_id Resource owner context, or zero for global forms.
	 * @param bool $allow_custom  Whether non-standard forms are visible.
	 * @return array<int,array<string,mixed>>|WP_Error Normalized form records or a safe query error.
	 */
	private function load_builder_forms( $owner_user_id, $allow_custom ) {
		if ( function_exists( 'wpbc_is_table_exists' ) && ! wpbc_is_table_exists( 'booking_form_structures' ) ) {
			return array();
		}

		global $wpdb;
		if ( ! is_object( $wpdb ) || empty( $wpdb->prefix ) ) {
			return array();
		}

		$query_parameters = array( 'published' );
		$sql              = "SELECT booking_form_id, form_slug, title, engine, structure_json, settings_json, advanced_form, content_form, owner_user_id FROM {$wpdb->prefix}booking_form_structures WHERE status = %s";
		if ( 0 < $owner_user_id ) {
			$sql               .= ' AND owner_user_id = %d';
			$query_parameters[] = $owner_user_id;
		} else {
			$sql .= ' AND ( owner_user_id = 0 OR owner_user_id IS NULL )';
		}
		if ( ! $allow_custom ) {
			$sql               .= ' AND form_slug = %s';
			$query_parameters[] = 'standard';
		}
		$sql               .= ' ORDER BY is_default DESC, updated_at DESC, version DESC, booking_form_id DESC LIMIT %d';
		$query_parameters[] = WPBC_Booking_New_Inspector_Config::MAX_FORM_CHOICES + 1;
		$sql                = $wpdb->prepare( $sql, $query_parameters ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- Repository owns the complete SQL structure and placeholder count.

		$wpdb->last_error = '';
		// phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching -- One bounded owner-scoped form read prevents N+1 definition queries.
		$database_rows = $wpdb->get_results( $sql, ARRAY_A );
		if ( '' !== (string) $wpdb->last_error || ! is_array( $database_rows ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_forms_unavailable',
				__( 'Booking Forms could not be loaded. Reload the page and try again.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		$forms = array();
		foreach ( $database_rows as $database_row ) {
			$row_owner_user_id = isset( $database_row['owner_user_id'] ) ? absint( $database_row['owner_user_id'] ) : 0;
			if ( $row_owner_user_id !== $owner_user_id ) {
				continue;
			}
			$form_id = isset( $database_row['form_slug'] ) ? trim( sanitize_text_field( (string) $database_row['form_slug'] ) ) : '';
			if ( '' === $form_id || ( ! $allow_custom && 'standard' !== $form_id ) ) {
				continue;
			}

			$form_title = isset( $database_row['title'] ) ? (string) $database_row['title'] : '';
			$form_title = function_exists( 'wpbc_lang' ) ? wpbc_lang( $form_title ) : $form_title;
			$form_title = trim( wp_strip_all_tags( html_entity_decode( $form_title, ENT_QUOTES, 'UTF-8' ) ) );
			$definition = $this->normalize_definition( $database_row, $form_id );
			$forms[]    = array(
				'id'         => substr( $form_id, 0, 191 ),
				'label'      => '' !== $form_title ? $form_title : ( 'standard' === $form_id ? __( 'Standard booking form', 'booking' ) : $form_id ),
				'source'     => $this->get_definition_source( $definition ),
				'definition' => $definition,
			);
		}

		return $forms;
	}

	/**
	 * Normalize one owner-authorized Builder row to the shared definition shape.
	 *
	 * @param array<string,mixed> $database_row Authorized query row.
	 * @param string              $form_id      Stable form slug.
	 * @return array<string,string> Data-only form definition.
	 */
	private function normalize_definition( $database_row, $form_id ) {
		$definition = array(
			'form_key'       => substr( sanitize_text_field( $form_id ), 0, 191 ),
			'source'         => 'advanced_mode' === sanitize_key( isset( $database_row['engine'] ) ? $database_row['engine'] : '' ) ? 'advanced_mode' : 'bfb_storage',
			'structure_json' => isset( $database_row['structure_json'] ) && is_scalar( $database_row['structure_json'] ) ? (string) $database_row['structure_json'] : '',
			'settings_json'  => isset( $database_row['settings_json'] ) && is_scalar( $database_row['settings_json'] ) ? (string) $database_row['settings_json'] : '',
			'advanced_form'  => isset( $database_row['advanced_form'] ) && is_scalar( $database_row['advanced_form'] ) ? (string) $database_row['advanced_form'] : '',
			'content_form'   => isset( $database_row['content_form'] ) && is_scalar( $database_row['content_form'] ) ? (string) $database_row['content_form'] : '',
		);

		if ( function_exists( 'wpbc_bf__replace_custom_html_shortcodes' ) ) {
			$definition['advanced_form'] = wpbc_bf__replace_custom_html_shortcodes( $definition['advanced_form'] );
			$definition['content_form']  = wpbc_bf__replace_custom_html_shortcodes( $definition['content_form'] );
		}
		if ( function_exists( 'wpbc_lang' ) ) {
			$definition['advanced_form'] = wpbc_lang( $definition['advanced_form'] );
			$definition['content_form']  = wpbc_lang( $definition['content_form'] );
		}

		return $definition;
	}

	/**
	 * Resolve the Resource owner context used by the front-end form resolver.
	 *
	 * @param int                 $resource_id Resource identifier.
	 * @param array<string,mixed> $resource    Authorized internal Resource record.
	 * @return int Owner-specific identifier, or zero for the global super-admin context.
	 */
	private function get_form_owner_user_id( $resource_id, $resource ) {
		$owner_user_id = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		if ( class_exists( 'WPBC_FE_MU' ) && method_exists( 'WPBC_FE_MU', 'get_owner_user_id_for_resource' ) ) {
			$owner_user_id = absint( WPBC_FE_MU::get_owner_user_id_for_resource( $resource_id ) );
			if ( method_exists( 'WPBC_FE_MU', 'is_user_super_booking_admin' ) && WPBC_FE_MU::is_user_super_booking_admin( $owner_user_id ) ) {
				$owner_user_id = 0;
			}
		}

		return $owner_user_id;
	}

	/**
	 * Apply the released regular-owner custom-form setting.
	 *
	 * @param int $owner_user_id Effective owner identifier.
	 * @return bool True when custom forms may be listed.
	 */
	private function regular_owner_can_use_custom_forms( $owner_user_id ) {
		return 0 === absint( $owner_user_id ) || 'On' === get_bk_option( 'booking_is_custom_forms_for_regular_users' );
	}

	/**
	 * Map the internal definition source to a stable browser source ID.
	 *
	 * @param array<string,mixed> $definition Normalized definition.
	 * @return string Stable form source.
	 */
	private function get_definition_source( $definition ) {
		$source = isset( $definition['source'] ) ? sanitize_key( (string) $definition['source'] ) : '';

		return 'advanced_mode' === $source ? 'advanced' : ( 'bfb_storage' === $source || 'preview' === $source ? 'form_builder' : 'classic' );
	}
}
