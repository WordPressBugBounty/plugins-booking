<?php
/**
 * UX state, DTO, and unsupported-form contracts for Add New Booking Inspector.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Defines the data-only public contract of the creation workflow.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_New_Inspector_Contract {

	/** Closed state with no creation draft mounted. */
	const STATE_CLOSED = 'closed';

	/** Authorized creation context is loading. */
	const STATE_LOADING = 'loading';

	/** The administrator is editing a local draft. */
	const STATE_EDITING = 'editing';

	/** A non-mutating cost preview is in progress or displayed. */
	const STATE_COST_PREVIEW = 'cost_preview';

	/** A signed, non-mutating creation review is displayed. */
	const STATE_REVIEW = 'review';

	/** A reviewed plan is being applied exactly once. */
	const STATE_APPLYING = 'applying';

	/** The authoritative creation result was read back successfully. */
	const STATE_CREATED = 'created';

	/** A recoverable or terminal workflow error is displayed. */
	const STATE_ERROR = 'error';

	/**
	 * Return states in stable lifecycle order.
	 *
	 * @since 12.0.0
	 * @return array<int,string> Stable state IDs.
	 */
	public static function get_states() {
		return array(
			self::STATE_CLOSED,
			self::STATE_LOADING,
			self::STATE_EDITING,
			self::STATE_COST_PREVIEW,
			self::STATE_REVIEW,
			self::STATE_APPLYING,
			self::STATE_CREATED,
			self::STATE_ERROR,
		);
	}

	/**
	 * Return the complete state-transition allow list.
	 *
	 * Error recovery returns only to a server-authorized retry state carried by
	 * the error DTO. Cost preview retries return through editing so a stale cost
	 * cannot be presented as current. Editing may return to loading only when a
	 * Resource or form choice requests a fresh authorized bootstrap.
	 *
	 * @since 12.0.0
	 * @return array<string,array<int,string>> Allowed target states by source state.
	 */
	public static function get_state_transitions() {
		return array(
			self::STATE_CLOSED       => array( self::STATE_LOADING ),
			self::STATE_LOADING      => array( self::STATE_EDITING, self::STATE_ERROR, self::STATE_CLOSED ),
			self::STATE_EDITING      => array(
				self::STATE_LOADING,
				self::STATE_COST_PREVIEW,
				self::STATE_REVIEW,
				self::STATE_ERROR,
				self::STATE_CLOSED,
			),
			self::STATE_COST_PREVIEW => array(
				self::STATE_EDITING,
				self::STATE_REVIEW,
				self::STATE_ERROR,
				self::STATE_CLOSED,
			),
			self::STATE_REVIEW       => array(
				self::STATE_EDITING,
				self::STATE_APPLYING,
				self::STATE_ERROR,
				self::STATE_CLOSED,
			),
			self::STATE_APPLYING     => array( self::STATE_CREATED, self::STATE_ERROR ),
			self::STATE_CREATED      => array( self::STATE_CLOSED ),
			self::STATE_ERROR        => array(
				self::STATE_LOADING,
				self::STATE_EDITING,
				self::STATE_REVIEW,
				self::STATE_APPLYING,
				self::STATE_CLOSED,
			),
		);
	}

	/**
	 * Determine whether one state transition is permitted.
	 *
	 * @since 12.0.0
	 * @param string $from_state Current stable state ID.
	 * @param string $to_state   Requested stable state ID.
	 * @return bool True when the transition is explicitly allowed.
	 */
	public static function can_transition( $from_state, $to_state ) {
		$transitions = self::get_state_transitions();

		return isset( $transitions[ $from_state ] )
			&& in_array( $to_state, $transitions[ $from_state ], true );
	}

	/**
	 * Return the versioned endpoint DTO schemas.
	 *
	 * Schema values are descriptive scalar type expressions only. They carry no
	 * callbacks, objects, HTML, database rows, capability names, or persistence
	 * instructions. Later request validators and DTO mappers must implement these
	 * exact fields without broadening authority.
	 *
	 * @since 12.0.0
	 * @return array<string,array<string,mixed>> DTO schemas keyed by stable name.
	 */
	public static function get_dto_schemas() {
		$draft_properties = array(
			'schema_version'       => 'integer:1',
			'request_id'           => 'string:1..64-bytes',
			'resource_id'          => 'positive-integer',
			'form_id'              => 'string:1..191-bytes',
			'form_source'          => 'enum:classic|form_builder|advanced|appointment',
			'selection_source'     => 'enum:empty|timeline|booking_listing|add_booking',
			'source_context_token' => 'opaque-string:0..16384-bytes',
			'schedule'             => 'creation-schedule-draft-dto',
			'fields'               => 'ordered-list(field-value-dto):0..100',
			'notes'                => 'map(public|string,private|string):authorized-exact-keys',
			'email_intent'         => 'enum:send|do_not_send|canonical_default',
			'cost_intent'          => 'enum:canonical|corrected',
			'corrected_cost'       => 'decimal-string:0..1000000000-or-empty',
			'draft_revision'       => 'non-negative-integer',
		);

		return array(
			'bootstrap_request' => self::schema(
				'client-to-server',
				array( 'schema_version', 'request_id', 'selection_source' ),
				array( 'resource_id', 'form_id', 'source_context_token' ),
				array(
					'schema_version'       => 'integer:1',
					'request_id'           => 'string:1..64-bytes',
					'selection_source'     => 'enum:empty|timeline|booking_listing|add_booking',
					'resource_id'          => 'positive-integer',
					'form_id'              => 'string:1..191-bytes',
					'source_context_token' => 'opaque-string:0..16384-bytes',
				),
				32768
			),
			'bootstrap_response' => self::schema(
				'server-to-client',
				array(
					'schema_version',
					'component_id',
					'state',
					'request_id',
					'resources',
					'forms',
					'selected_resource_id',
					'selected_form_id',
					'form_source',
					'fields',
					'notes',
					'schedule',
					'cost',
					'support',
					'edition_capabilities',
					'fallback',
				),
				array( 'warnings' ),
				array(
					'schema_version'       => 'integer:1',
					'component_id'         => 'string:wpbc_booking_new_inspector',
					'state'                => 'enum:editing|error',
					'request_id'           => 'string:1..64-bytes',
					'resources'            => 'ordered-list(resource-choice-dto):0..500',
					'forms'                => 'ordered-list(form-choice-dto):0..200',
					'selected_resource_id' => 'positive-integer|null',
					'selected_form_id'     => 'string:0..191-bytes',
					'form_source'          => 'enum:classic|form_builder|advanced|appointment|unknown',
					'fields'               => 'ordered-list(field-definition-dto):0..100',
					'notes'                => 'ordered-list(note-definition-dto):0..2',
					'schedule'             => 'schedule-dto',
					'cost'                 => 'cost-dto',
					'support'              => 'form-support-dto',
					'edition_capabilities' => 'edition-capabilities-dto',
					'fallback'             => 'fallback-dto|null',
					'warnings'             => 'ordered-list(string):0..20',
				),
				0
			),
			'schedule_request' => self::schema(
				'client-to-server',
				array( 'schema_version', 'request_id', 'selection_source', 'resource_id', 'form_id' ),
				array( 'source_context_token', 'schedule', 'calendar_anchor_date' ),
				array(
					'schema_version'       => 'integer:1',
					'request_id'           => 'string:1..64-bytes',
					'selection_source'     => 'enum:empty|timeline|booking_listing|add_booking',
					'resource_id'          => 'positive-integer',
					'form_id'              => 'string:1..191-bytes',
					'source_context_token' => 'opaque-string:0..16384-bytes',
					'schedule'             => 'creation-schedule-draft-dto',
					'calendar_anchor_date' => 'iso-date:YYYY-MM-DD|empty',
				),
				65536
			),
			'schedule_response' => self::schema(
				'server-to-client',
				array( 'schema_version', 'component_id', 'state', 'request_id', 'resource_id', 'form_id', 'form_source', 'schedule', 'choices', 'calendar' ),
				array(),
				array(
					'schema_version' => 'integer:1',
					'component_id'   => 'string:wpbc_booking_new_inspector',
					'state'          => 'enum:editing|error',
					'request_id'     => 'string:1..64-bytes',
					'resource_id'    => 'positive-integer',
					'form_id'        => 'string:1..191-bytes',
					'form_source'    => 'enum:classic|form_builder|advanced',
					'schedule'       => 'creation-schedule-draft-dto',
					'choices'        => 'creation-schedule-choices-dto',
					'calendar'       => 'native-calendar-contract-dto',
				),
				0
			),
			'cost_preview_request' => self::schema(
				'client-to-server',
				array_keys( $draft_properties ),
				array(),
				$draft_properties,
				WPBC_Booking_New_Inspector_Config::MAX_REQUEST_BYTES
			),
			'cost_preview_response' => self::schema(
				'server-to-client',
				array( 'schema_version', 'request_id', 'state', 'cost', 'draft_revision', 'draft_fingerprint' ),
				array( 'warnings', 'fallback' ),
				array(
					'schema_version' => 'integer:1',
					'request_id'     => 'string:1..64-bytes',
					'state'          => 'enum:editing|cost_preview|error',
					'cost'           => 'cost-dto',
					'draft_revision' => 'non-negative-integer',
					'draft_fingerprint' => 'sha256-hex-string',
					'warnings'       => 'ordered-list(string):0..20',
					'fallback'       => 'fallback-dto|null',
				),
				0
			),
			'review_request' => self::schema(
				'client-to-server',
				array_keys( $draft_properties ),
				array(),
				$draft_properties,
				WPBC_Booking_New_Inspector_Config::MAX_REQUEST_BYTES
			),
			'review_response' => self::schema(
				'server-to-client',
				array( 'schema_version', 'request_id', 'state', 'review', 'plan', 'token', 'expires_at', 'idempotency_key' ),
				array( 'warnings' ),
				array(
					'schema_version' => 'integer:1',
					'request_id'     => 'string:1..64-bytes',
					'state'          => 'enum:review|error',
					'review'         => 'creation-review-dto',
					'plan'           => 'signed-creation-plan-dto',
					'token'          => 'opaque-string:1..128-bytes',
					'expires_at'     => 'unix-timestamp',
					'idempotency_key' => 'string:16..64-bytes',
					'warnings'       => 'ordered-list(string):0..20',
				),
				0
			),
			'apply_request' => self::schema(
				'client-to-server',
				array( 'schema_version', 'request_id', 'plan', 'token', 'idempotency_key' ),
				array(),
				array(
					'schema_version'  => 'integer:1',
					'request_id'      => 'string:1..64-bytes',
					'plan'            => 'signed-creation-plan-dto',
					'token'           => 'opaque-string:1..128-bytes',
					'idempotency_key' => 'string:16..64-bytes',
				),
				98304
			),
			'apply_response' => self::schema(
				'server-to-client',
				array( 'schema_version', 'request_id', 'state', 'booking', 'idempotency_key' ),
				array( 'warnings' ),
				array(
					'schema_version'  => 'integer:1',
					'request_id'      => 'string:1..64-bytes',
					'state'           => 'enum:created|error',
					'booking'         => 'created-booking-dto',
					'idempotency_key' => 'string:16..64-bytes',
					'warnings'        => 'ordered-list(string):0..20',
				),
				0
			),
			'error_response' => self::schema(
				'server-to-client',
				array( 'schema_version', 'request_id', 'state', 'code', 'message', 'retry_state', 'field_errors', 'fallback' ),
				array(),
				array(
					'schema_version' => 'integer:1',
					'request_id'     => 'string:0..64-bytes',
					'state'          => 'enum:error',
					'code'           => 'stable-error-code',
					'message'        => 'authorized-plain-string',
					'retry_state'    => 'enum:closed|loading|editing|review|applying|null',
					'field_errors'   => 'ordered-list(field-error-dto):0..100',
					'fallback'       => 'fallback-dto|null',
				),
				0
			),
			'resource_choice_dto' => self::schema(
				'server-to-client',
				array( 'id', 'label', 'selected', 'selectable' ),
				array( 'parent_id' ),
				array(
					'id'         => 'positive-integer',
					'label'      => 'authorized-plain-string',
					'selected'   => 'boolean',
					'selectable' => 'boolean',
					'parent_id'  => 'positive-integer|null',
				),
				0
			),
			'form_choice_dto' => self::schema(
				'server-to-client',
				array( 'id', 'label', 'source', 'selected', 'support_status' ),
				array( 'reason_code' ),
				array(
					'id'             => 'string:1..191-bytes',
					'label'          => 'authorized-plain-string',
					'source'         => 'enum:classic|form_builder|advanced|appointment',
					'selected'       => 'boolean',
					'support_status' => 'enum:supported|unsupported',
					'reason_code'    => 'unsupported-form-reason-code|null',
				),
				0
			),
			'field_definition_dto' => self::schema(
				'server-to-client',
				array( 'key', 'label', 'type', 'required', 'multiple', 'value', 'options', 'validation', 'readonly' ),
				array( 'help', 'section', 'schedule_role' ),
				array(
					'key'           => 'string:1..191-bytes',
					'label'         => 'authorized-plain-string',
					'type'          => 'stable-domain-field-type',
					'required'      => 'boolean',
					'multiple'      => 'boolean',
					'value'         => 'scalar-or-ordered-list(string)',
					'options'       => 'ordered-list(field-option-dto):0..300',
					'validation'    => 'field-validation-dto',
					'readonly'      => 'boolean',
					'help'          => 'authorized-plain-string',
					'section'       => 'stable-section-id',
					'schedule_role' => 'stable-schedule-role|null',
				),
				0
			),
			'field_validation_dto' => self::schema(
				'server-to-client',
				array( 'maxlength', 'min', 'max', 'step', 'pattern_id' ),
				array(),
				array(
					'maxlength' => 'non-negative-integer|null',
					'min'       => 'numeric-string|null',
					'max'       => 'numeric-string|null',
					'step'      => 'positive-numeric-string|null',
					'pattern_id' => 'stable-server-defined-pattern-id|null',
				),
				0
			),
			'field_option_dto' => self::schema(
				'server-to-client',
				array( 'value', 'label', 'disabled' ),
				array(),
				array(
					'value'    => 'string:0..10000-bytes',
					'label'    => 'authorized-plain-string',
					'disabled' => 'boolean',
				),
				0
			),
			'field_value_dto' => self::schema(
				'client-to-server',
				array( 'key', 'values' ),
				array(),
				array(
					'key'    => 'string:1..191-bytes',
					'values' => 'ordered-list(string:0..10000-bytes):0..100',
				),
				0
			),
			'note_definition_dto' => self::schema(
				'server-to-client',
				array( 'type', 'label', 'audience', 'value', 'maxlength' ),
				array(),
				array(
					'type'      => 'enum:public|private',
					'label'     => 'authorized-plain-string',
					'audience'  => 'authorized-plain-string',
					'value'     => 'string:0..10000-bytes',
					'maxlength' => 'integer:10000',
				),
				0
			),
			'schedule_dto' => self::schema(
				'bidirectional',
				array( 'mode', 'dates', 'timezone', 'selection_method' ),
				array( 'start_time', 'end_time', 'time_slot' ),
				array(
					'mode'             => 'enum:full_day|date_range|time_range|time_slot',
					'dates'            => 'ordered-list(iso-date):0..366',
					'timezone'         => 'authorized-iana-timezone',
					'selection_method' => 'enum:calendar|timeline|form_control|appointment',
					'start_time'       => 'hh:mm|null',
					'end_time'         => 'hh:mm|null',
					'time_slot'        => 'authorized-stable-option-value|null',
				),
				0
			),
			'creation_schedule_draft_dto' => self::schema(
				'bidirectional',
				array( 'selection_method', 'time_application', 'selected_dates', 'start_time', 'end_time', 'seed_source', 'exact_timeline_seed' ),
				array(),
				array(
					'selection_method'   => 'enum:policy|individual',
					'time_application'   => 'enum:full_day|boundary|per_date',
					'selected_dates'     => 'ordered-list(iso-date):0..366',
					'start_time'         => 'hh:mm-or-empty-string',
					'end_time'           => 'hh:mm-or-empty-string',
					'seed_source'        => 'enum:empty|timeline|draft',
					'exact_timeline_seed' => 'boolean',
				),
				0
			),
			'creation_schedule_choices_dto' => self::schema(
				'server-to-client',
				array( 'selection_methods', 'time_applications' ),
				array(),
				array(
					'selection_methods' => 'ordered-list(choice-dto)',
					'time_applications' => 'ordered-list(choice-dto)',
				),
				0
			),
			'native_calendar_contract_dto' => self::schema(
				'server-to-client',
				array( 'html', 'calendar_parameters', 'policy_parameters', 'context_parameters', 'secure_parameters', 'request_parameters' ),
				array(),
				array(
					'html'                => 'server-generated-native-calendar-markup',
					'calendar_parameters' => 'allow-listed-json-safe-map',
					'policy_parameters'   => 'allow-listed-json-safe-map',
					'context_parameters'  => 'allow-listed-json-safe-map',
					'secure_parameters'   => 'allow-listed-json-safe-map',
					'request_parameters'  => 'allow-listed-json-safe-map',
				),
				0
			),
			'edition_capabilities_dto' => self::schema(
				'server-to-client',
				array( 'edition_id', 'multiple_resources', 'custom_forms', 'cost_preview', 'cost_correction', 'advanced_pricing', 'capacity', 'appointments', 'multiuser', 'multisite' ),
				array(),
				array(
					'edition_id'        => 'enum:free|personal|business_small|business_medium|business_large|multiuser',
					'multiple_resources' => 'boolean',
					'custom_forms'       => 'boolean',
					'cost_preview'       => 'boolean',
					'cost_correction'    => 'boolean',
					'advanced_pricing'   => 'boolean',
					'capacity'           => 'boolean',
					'appointments'       => 'boolean',
					'multiuser'          => 'boolean',
					'multisite'          => 'boolean',
				),
				0
			),
			'cost_dto' => self::schema(
				'server-to-client',
				array( 'status', 'currency', 'total', 'formatted_total', 'line_items' ),
				array( 'message', 'canonical_total', 'cost_intent', 'corrected_cost' ),
				array(
					'status'          => 'enum:unavailable|stale|estimated|calculated',
					'currency'        => 'iso-4217-code|null',
					'total'           => 'canonical-decimal-string|null',
					'formatted_total' => 'authorized-plain-string',
					'line_items'      => 'ordered-list(cost-line-item-dto)',
					'message'         => 'authorized-plain-string',
					'canonical_total' => 'canonical-decimal-string',
					'cost_intent'     => 'enum:canonical|corrected',
					'corrected_cost'  => 'canonical-decimal-string-or-empty',
				),
				0
			),
			'cost_line_item_dto' => self::schema(
				'server-to-client',
				array( 'id', 'label', 'amount', 'formatted_amount' ),
				array(),
				array(
					'id'               => 'stable-line-item-id',
					'label'            => 'authorized-plain-string',
					'amount'           => 'canonical-decimal-string',
					'formatted_amount' => 'authorized-plain-string',
				),
				0
			),
			'form_support_dto' => self::schema(
				'server-to-client',
				array( 'status', 'creation_allowed', 'reason_code', 'message' ),
				array(),
				array(
					'status'           => 'enum:supported|unsupported',
					'creation_allowed' => 'boolean',
					'reason_code'      => 'unsupported-form-reason-code|null',
					'message'          => 'authorized-plain-string',
				),
				0
			),
			'fallback_dto' => self::schema(
				'server-to-client',
				array( 'action_id', 'label', 'url', 'reason_code', 'message', 'preserved_context' ),
				array(),
				array(
					'action_id'         => 'string:open_full_add_booking',
					'label'             => 'authorized-plain-string',
					'url'               => 'authorized-add-booking-url',
					'reason_code'       => 'unsupported-form-reason-code',
					'message'           => 'authorized-plain-string',
					'preserved_context' => 'fallback-context-dto',
				),
				0
			),
			'fallback_context_dto' => self::schema(
				'server-to-client',
				array( 'resource_id', 'form_id', 'source_context_token' ),
				array(),
				array(
					'resource_id'         => 'positive-integer|null',
					'form_id'             => 'string:0..191-bytes',
					'source_context_token' => 'opaque-string:0..16384-bytes',
				),
				0
			),
			'creation_review_dto' => self::schema(
				'server-to-client',
				array( 'resource', 'form', 'schedule', 'fields', 'notes', 'cost', 'email_intent', 'approval_intent', 'allocation', 'warnings', 'limitations' ),
				array(),
				array(
					'resource'        => 'review-resource-dto',
					'form'            => 'review-form-dto',
					'schedule'        => 'review-schedule-dto',
					'fields'          => 'ordered-list(review-field-dto):0..100',
					'notes'           => 'ordered-list(review-note-dto):0..2',
					'cost'            => 'cost-dto',
					'email_intent'    => 'authorized-plain-string',
					'approval_intent' => 'authorized-plain-string',
					'allocation'       => 'review-allocation-dto',
					'warnings'         => 'ordered-list(string):0..20',
					'limitations'      => 'ordered-list(string):0..20',
				),
				0
			),
			'review_resource_dto' => self::schema(
				'server-to-client',
				array( 'id', 'label' ),
				array(),
				array(
					'id'    => 'positive-integer',
					'label' => 'authorized-plain-string',
				),
				0
			),
			'review_form_dto' => self::schema(
				'server-to-client',
				array( 'id', 'label', 'source' ),
				array(),
				array(
					'id'     => 'string:1..191-bytes',
					'label'  => 'authorized-plain-string',
					'source' => 'enum:classic|form_builder|advanced|appointment',
				),
				0
			),
			'review_schedule_dto' => self::schema(
				'server-to-client',
				array( 'dates', 'time_application', 'start_time', 'end_time' ),
				array(),
				array(
					'dates'            => 'ordered-list(iso-date):1..366',
					'time_application' => 'enum:full_day|boundary|per_date',
					'start_time'       => 'hh:mm-or-empty-string',
					'end_time'         => 'hh:mm-or-empty-string',
				),
				0
			),
			'review_field_dto' => self::schema(
				'server-to-client',
				array( 'key', 'label', 'value' ),
				array(),
				array(
					'key'   => 'string:1..191-bytes',
					'label' => 'authorized-plain-string',
					'value' => 'authorized-plain-string',
				),
				0
			),
			'review_allocation_dto' => self::schema(
				'server-to-client',
				array( 'quantity' ),
				array(),
				array(
					'quantity' => 'positive-integer',
				),
				0
			),
			'review_note_dto' => self::schema(
				'server-to-client',
				array( 'type', 'label', 'audience', 'value' ),
				array(),
				array(
					'type'     => 'enum:public|private',
					'label'    => 'authorized-plain-string',
					'audience' => 'authorized-plain-string',
					'value'    => 'string:0..10000-bytes',
				),
				0
			),
			'signed_creation_plan_dto' => self::schema(
				'client-to-server',
				array( 'version', 'purpose', 'site_id', 'user_id', 'actor_user_id', 'session_fingerprint', 'issued_at', 'expires_at', 'source', 'resource', 'edition', 'form', 'fields', 'canonical_form_data', 'notes', 'schedule', 'availability_revision', 'workflow', 'cost', 'draft_fingerprint', 'idempotency_key' ),
				array(),
				array(
					'version'               => 'integer:1',
					'purpose'               => 'string:wpbc_booking_new_inspector_create_review',
					'site_id'               => 'non-negative-integer',
					'user_id'               => 'positive-integer',
					'actor_user_id'         => 'positive-integer',
					'session_fingerprint'   => 'sha256-hmac-hex-string',
					'issued_at'             => 'unix-timestamp',
					'expires_at'            => 'unix-timestamp',
					'source'                => 'signed-source-context-map',
					'resource'              => 'signed-resource-allocation-map',
					'edition'               => 'edition-capabilities-dto',
					'form'                  => 'signed-form-identity-map',
					'fields'                => 'ordered-list(field-submission-dto):0..100',
					'canonical_form_data'   => 'canonical-booking-form-record-string',
					'notes'                 => 'map(public|string,private|string):authorized-exact-keys',
					'schedule'              => 'creation-schedule-draft-dto',
					'availability_revision' => 'sha256-hmac-hex-string',
					'workflow'              => 'signed-workflow-intent-map',
					'cost'                  => 'signed-cost-intent-map',
					'draft_fingerprint'     => 'sha256-hex-string',
					'idempotency_key'       => 'string:16..64-bytes',
				),
				WPBC_Booking_New_Inspector_Config::MAX_REVIEW_PLAN_BYTES
			),
			'created_booking_dto' => self::schema(
				'server-to-client',
				array( 'booking_id', 'resource_id', 'status', 'cost', 'message', 'readback_revision' ),
				array(),
				array(
					'booking_id'       => 'positive-integer',
					'resource_id'      => 'positive-integer',
					'status'           => 'authorized-booking-status',
					'cost'             => 'cost-dto',
					'message'          => 'authorized-plain-string',
					'readback_revision' => 'stable-authoritative-revision',
				),
				0
			),
			'field_error_dto' => self::schema(
				'server-to-client',
				array( 'key', 'code', 'message' ),
				array(),
				array(
					'key'     => 'string:1..191-bytes',
					'code'    => 'stable-field-error-code',
					'message' => 'authorized-plain-string',
				),
				0
			),
		);
	}

	/**
	 * Return reason codes that require the canonical Add Booking fallback.
	 *
	 * @since 12.0.0
	 * @return array<int,string> Stable unsupported-form reason codes.
	 */
	public static function get_unsupported_form_reason_codes() {
		return array(
			'unsupported_required_field',
			'unsupported_behavior_field',
			'unsupported_form_source',
			'form_definition_unavailable',
			'form_not_authorized',
		);
	}

	/**
	 * Return the fail-closed unsupported-form fallback contract.
	 *
	 * The fallback URL must be generated by an authorized server service. It
	 * preserves only the current Resource, form, and verified source context.
	 * The Inspector must not submit a partial or downgraded booking.
	 *
	 * @since 12.0.0
	 * @return array<string,mixed> Data-only fallback policy.
	 */
	public static function get_unsupported_form_fallback() {
		return array(
			'support_status'       => 'unsupported',
			'creation_allowed'     => false,
			'action_id'            => WPBC_Booking_New_Inspector_Config::FALLBACK_ACTION_OPEN_FULL_ADD_BOOKING,
			'destination'          => 'canonical_add_booking_page',
			'preserve_context'     => array( 'resource_id', 'form_id', 'source_context_token' ),
			'allowed_reason_codes' => self::get_unsupported_form_reason_codes(),
			'partial_submit'       => false,
		);
	}

	/**
	 * Build one normalized schema record.
	 *
	 * @since 12.0.0
	 * @param string                    $direction  Data-flow direction.
	 * @param array<int,string>         $required   Required property names.
	 * @param array<int,string>         $optional   Optional property names.
	 * @param array<string,string>      $properties Property type expressions.
	 * @param int                       $max_bytes  Encoded request ceiling, or zero for responses.
	 * @return array<string,mixed> Executable-free schema record.
	 */
	private static function schema( $direction, $required, $optional, $properties, $max_bytes ) {
		return array(
			'version'    => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'direction'  => $direction,
			'max_bytes'  => $max_bytes,
			'required'   => array_values( $required ),
			'optional'   => array_values( $optional ),
			'properties' => $properties,
		);
	}
}
