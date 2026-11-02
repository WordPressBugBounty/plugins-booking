<?php
/**
 * Authorized bootstrap read service for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Orchestrates non-mutating Resource, form, field, schedule, and edition reads.
 */
final class WPBC_Booking_New_Inspector_Bootstrap_Service {

	/** @var WPBC_Booking_New_Inspector_Authorization Authorization service. */
	private $authorization;

	/** @var WPBC_Booking_New_Inspector_Request_Validator Request validator. */
	private $request_validator;

	/** @var WPBC_Booking_New_Inspector_Resource_Repository Resource repository. */
	private $resource_repository;

	/** @var WPBC_Booking_New_Inspector_Form_Repository Form repository. */
	private $form_repository;

	/** @var WPBC_Booking_New_Inspector_Field_DTO_Mapper Field mapper. */
	private $field_mapper;

	/** @var WPBC_Booking_New_Inspector_Timeline_Seed Timeline seed service. */
	private $timeline_seed;

	/** @var WPBC_Booking_New_Inspector_Edition_Capabilities Edition mapper. */
	private $edition_capabilities;

	/** @var WPBC_Booking_New_Inspector_Notes Authorized creation-note contract. */
	private $notes;

	/** @var WPBC_Booking_New_Inspector_Autofill Logged-in-user field projector. */
	private $autofill;

	/**
	 * Construct the service with optional test doubles.
	 *
	 * @param object|null $authorization        Authorization service.
	 * @param object|null $request_validator    Request validator.
	 * @param object|null $resource_repository  Resource repository.
	 * @param object|null $form_repository      Form repository.
	 * @param object|null $field_mapper         Field DTO mapper.
	 * @param object|null $timeline_seed        Timeline seed service.
	 * @param object|null $edition_capabilities Edition capability mapper.
	 * @param object|null $notes                Authorized creation-note contract.
	 * @param object|null $autofill             Logged-in-user field projector.
	 */
	public function __construct( $authorization = null, $request_validator = null, $resource_repository = null, $form_repository = null, $field_mapper = null, $timeline_seed = null, $edition_capabilities = null, $notes = null, $autofill = null ) {
		$this->authorization        = $authorization ? $authorization : new WPBC_Booking_New_Inspector_Authorization();
		$this->request_validator    = $request_validator ? $request_validator : new WPBC_Booking_New_Inspector_Request_Validator();
		$this->resource_repository  = $resource_repository ? $resource_repository : new WPBC_Booking_New_Inspector_Resource_Repository();
		$this->form_repository      = $form_repository ? $form_repository : new WPBC_Booking_New_Inspector_Form_Repository();
		$this->field_mapper         = $field_mapper ? $field_mapper : new WPBC_Booking_New_Inspector_Field_DTO_Mapper();
		$this->timeline_seed        = $timeline_seed ? $timeline_seed : new WPBC_Booking_New_Inspector_Timeline_Seed();
		$this->edition_capabilities = $edition_capabilities ? $edition_capabilities : new WPBC_Booking_New_Inspector_Edition_Capabilities();
		$this->notes                = $notes ? $notes : new WPBC_Booking_New_Inspector_Notes();
		$this->autofill             = $autofill ? $autofill : new WPBC_Booking_New_Inspector_Autofill();
	}

	/**
	 * Build the complete authorized bootstrap DTO without mutation.
	 *
	 * @param mixed $request_values Untrusted request values.
	 * @return array<string,mixed>|WP_Error Bootstrap DTO or a safe error.
	 */
	public function get_bootstrap( $request_values ) {
		if ( ! $this->authorization->current_user_can_bootstrap() ) {
			return $this->authorization->get_forbidden_error();
		}

		$request = $this->request_validator->validate( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}

		$seed = $this->timeline_seed->resolve( $request );
		if ( is_wp_error( $seed ) ) {
			return $seed;
		}

		if ( ! empty( $seed['resource_id'] ) && ! empty( $request['resource_id'] ) && absint( $seed['resource_id'] ) !== absint( $request['resource_id'] ) ) {
			return $this->get_context_mismatch_error();
		}
		if ( ! empty( $seed['form_id'] ) && '' !== $request['form_id'] && (string) $seed['form_id'] !== (string) $request['form_id'] ) {
			return $this->get_context_mismatch_error();
		}

		$resources = $this->resource_repository->get_authorized_resources();
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		if ( empty( $resources ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_resource_not_found',
				__( 'No authorized Booking Resource is available.', 'booking' ),
				array( 'status' => 404 )
			);
		}

		$selected_resource_id = ! empty( $seed['resource_id'] )
			? absint( $seed['resource_id'] )
			: ( ! empty( $request['resource_id'] ) ? absint( $request['resource_id'] ) : $this->resource_repository->get_default_resource_id( $resources ) );
		$selected_resource    = $this->find_record( $resources, $selected_resource_id );
		if ( empty( $selected_resource ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_resource_not_found',
				__( 'The requested Booking Resource was not found.', 'booking' ),
				array( 'status' => 404 )
			);
		}

		$forms = $this->form_repository->get_authorized_forms( $selected_resource );
		if ( is_wp_error( $forms ) ) {
			return $forms;
		}
		$has_explicit_form = ! empty( $seed['form_id'] ) || '' !== $request['form_id'];
		$selected_form_id  = ! empty( $seed['form_id'] )
			? (string) $seed['form_id']
			: ( '' !== $request['form_id'] ? (string) $request['form_id'] : $this->get_default_form_id( $selected_resource_id ) );
		$selected_form     = $this->find_record( $forms, $selected_form_id );
		if ( empty( $selected_form ) && ! $has_explicit_form ) {
			$selected_form_id = 'standard';
			$selected_form    = $this->find_record( $forms, $selected_form_id );
		}
		if ( empty( $selected_form ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_form_not_authorized',
				__( 'The requested Booking Form was not found.', 'booking' ),
				array( 'status' => 404 )
			);
		}

		/*
		 * A booking_handoff may include the one service available for the same
		 * Resource because Timeline reuses one payload for its two navigation
		 * actions. Token purpose, not service presence, distinguishes Booking from
		 * Appointment workflows. This endpoint accepts booking_handoff only.
		 */
		$selected_form_source = sanitize_key( (string) $selected_form['source'] );
		$selected_projection  = $this->field_mapper->map_form( $selected_form['definition'], $selected_resource_id, $selected_form_source );
		$selected_projection['fields'] = $this->autofill->apply( $selected_projection['fields'] );
		$form_choices         = array();
		foreach ( $forms as $form ) {
			$form_source    = (string) $form['id'] === $selected_form_id ? $selected_form_source : sanitize_key( (string) $form['source'] );
			$form_projection = (string) $form['id'] === $selected_form_id
				? $selected_projection
				: $this->field_mapper->map_form( $form['definition'], $selected_resource_id, $form_source );
			$form_choices[] = array(
				'id'             => substr( sanitize_text_field( (string) $form['id'] ), 0, 191 ),
				'label'          => $this->plain_text( isset( $form['label'] ) ? $form['label'] : $form['id'] ),
				'source'         => $form_source,
				'selected'       => (string) $form['id'] === $selected_form_id,
				'support_status' => $form_projection['support']['status'],
				'reason_code'    => $form_projection['support']['reason_code'],
			);
		}

		$resource_choices  = array();
		$authorized_ids    = array_map( 'absint', array_column( $resources, 'id' ) );
		foreach ( $resources as $resource ) {
			$parent_id = ! empty( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : null;
			$resource_choices[] = array(
				'id'         => absint( $resource['id'] ),
				'label'      => $this->plain_text( $resource['label'] ),
				'selected'   => absint( $resource['id'] ) === $selected_resource_id,
				'selectable' => true,
				'parent_id'  => null !== $parent_id && in_array( $parent_id, $authorized_ids, true ) ? $parent_id : null,
			);
		}

		$fallback = 'unsupported' === $selected_projection['support']['status']
			? $this->build_fallback( $selected_resource_id, $selected_form_id, $seed, $selected_projection['support'] )
			: null;

		return array(
			'schema_version'       => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'component_id'         => WPBC_Booking_New_Inspector_Config::COMPONENT_ID,
			'state'                => WPBC_Booking_New_Inspector_Contract::STATE_EDITING,
			'request_id'           => $request['request_id'],
			'resources'            => $resource_choices,
			'forms'                => $form_choices,
			'selected_resource_id' => $selected_resource_id,
			'selected_form_id'     => $selected_form_id,
			'form_source'          => $selected_form_source,
			'fields'               => $selected_projection['fields'],
			'notes'                => $this->notes->get_authorized_definitions(),
			'schedule'             => $seed['schedule'],
			'cost'                 => array(
				'status'          => 'unavailable',
				'currency'        => null,
				'total'           => null,
				'formatted_total' => '',
				'line_items'      => array(),
				'message'         => __( 'Cost preview is not available in this development phase. It will be added by the data-only cost-preview phase.', 'booking' ),
			),
			'support'              => $selected_projection['support'],
			'edition_capabilities' => $this->edition_capabilities->get_capabilities(),
			'fallback'             => $fallback,
			'warnings'             => array_slice( $selected_projection['warnings'], 0, WPBC_Booking_New_Inspector_Config::MAX_WARNINGS ),
		);
	}

	/**
	 * Find one exact normalized record by its `id` field.
	 *
	 * @param array<int,array<string,mixed>> $records   Candidate records.
	 * @param int|string                     $record_id Exact identifier.
	 * @return array<string,mixed> Matching record or an empty array.
	 */
	private function find_record( $records, $record_id ) {
		foreach ( is_array( $records ) ? $records : array() as $record ) {
			if ( is_array( $record ) && isset( $record['id'] ) && (string) $record['id'] === (string) $record_id ) {
				return $record;
			}
		}

		return array();
	}

	/**
	 * Resolve the canonical default form for one authorized Resource.
	 *
	 * @param int $resource_id Resource identifier.
	 * @return string Sanitized form slug.
	 */
	private function get_default_form_id( $resource_id ) {
		$form_id = class_exists( 'WPBC_Add_Booking_Component' ) && method_exists( 'WPBC_Add_Booking_Component', 'get_default_booking_form_for_resource' )
			? WPBC_Add_Booking_Component::get_default_booking_form_for_resource( $resource_id, 'standard' )
			: 'standard';
		$form_id = substr( sanitize_text_field( (string) $form_id ), 0, 191 );

		return '' !== $form_id ? $form_id : 'standard';
	}

	/**
	 * Build the canonical full-page fallback for an unsupported form.
	 *
	 * @param int                 $resource_id Resource identifier.
	 * @param string              $form_id     Form slug.
	 * @param array<string,mixed> $seed        Verified seed context.
	 * @param array<string,mixed> $support     Unsupported-form DTO.
	 * @return array<string,mixed> Data-only fallback DTO.
	 */
	private function build_fallback( $resource_id, $form_id, $seed, $support ) {
		$query_arguments = array(
			'page'         => 'wpbc',
			'tab'          => 'add-booking',
			'booking_type' => absint( $resource_id ),
			'booking_form' => sanitize_text_field( $form_id ),
		);
		if ( ! empty( $seed['source_context_token'] ) ) {
			$query_arguments['wpbc_timeline_handoff'] = (string) $seed['source_context_token'];
		}

		return array(
			'action_id'         => WPBC_Booking_New_Inspector_Config::FALLBACK_ACTION_OPEN_FULL_ADD_BOOKING,
			'label'             => __( 'Open full Add Booking', 'booking' ),
			'url'               => add_query_arg( $query_arguments, admin_url( 'admin.php' ) ),
			'reason_code'       => sanitize_key( (string) $support['reason_code'] ),
			'message'           => $this->plain_text( $support['message'] ),
			'preserved_context' => array(
				'resource_id'          => absint( $resource_id ),
				'form_id'              => substr( sanitize_text_field( $form_id ), 0, 191 ),
				'source_context_token' => ! empty( $seed['source_context_token'] ) ? (string) $seed['source_context_token'] : '',
			),
		);
	}

	/**
	 * Return a uniform mismatch error for forged signed-context companions.
	 *
	 * @return WP_Error Safe context error.
	 */
	private function get_context_mismatch_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_source_context_invalid',
			__( 'This booking selection expired or is invalid. Return to Timeline and select the range again.', 'booking' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Convert an authorized label to plain text.
	 *
	 * @param mixed $text Candidate label.
	 * @return string Plain text.
	 */
	private function plain_text( $text ) {
		return trim( sanitize_text_field( wp_strip_all_tags( is_scalar( $text ) ? (string) $text : '' ) ) );
	}
}
