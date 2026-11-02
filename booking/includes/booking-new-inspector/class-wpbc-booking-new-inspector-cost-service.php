<?php
/**
 * Authorized data-only cost service for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reloads authority, validates one exact draft, and calculates without mutation.
 */
final class WPBC_Booking_New_Inspector_Cost_Service {

	/** @var object Authorization service. */
	private $authorization;

	/** @var object Cost request validator. */
	private $request_validator;

	/** @var object Resource repository. */
	private $resource_repository;

	/** @var object Form repository. */
	private $form_repository;

	/** @var object Exact field mapper. */
	private $field_mapper;

	/** @var object Exact form validator. */
	private $form_validator;

	/** @var object Canonical form serializer. */
	private $form_serializer;

	/** @var object Signed Timeline context resolver. */
	private $timeline_seed;

	/** @var object Shared schedule syntax normalizer. */
	private $schedule_normalizer;

	/** @var object Creation-specific schedule policy. */
	private $schedule_policy;

	/** @var object Edition capability mapper. */
	private $edition_capabilities;

	/** @var object Read-only canonical calculator. */
	private $cost_calculator;

	/** @var object Authorized creation-note contract. */
	private $notes;

	/**
	 * Construct the service with replaceable read-only boundaries.
	 *
	 * @param object|null $authorization       Authorization service.
	 * @param object|null $request_validator   Cost request validator.
	 * @param object|null $resource_repository Resource repository.
	 * @param object|null $form_repository     Form repository.
	 * @param object|null $field_mapper        Exact field mapper.
	 * @param object|null $form_validator      Exact form validator.
	 * @param object|null $form_serializer     Canonical serializer.
	 * @param object|null $timeline_seed       Signed Timeline resolver.
	 * @param object|null $schedule_normalizer Shared schedule normalizer.
	 * @param object|null $schedule_policy     Creation schedule policy.
	 * @param object|null $edition_capabilities Edition capability mapper.
	 * @param object|null $cost_calculator     Read-only canonical calculator.
	 * @param object|null $notes               Authorized creation-note contract.
	 */
	public function __construct( $authorization = null, $request_validator = null, $resource_repository = null, $form_repository = null, $field_mapper = null, $form_validator = null, $form_serializer = null, $timeline_seed = null, $schedule_normalizer = null, $schedule_policy = null, $edition_capabilities = null, $cost_calculator = null, $notes = null ) {
		$this->authorization        = $authorization ? $authorization : new WPBC_Booking_New_Inspector_Authorization();
		$this->request_validator    = $request_validator ? $request_validator : new WPBC_Booking_New_Inspector_Cost_Request_Validator();
		$this->resource_repository  = $resource_repository ? $resource_repository : new WPBC_Booking_New_Inspector_Resource_Repository();
		$this->form_repository      = $form_repository ? $form_repository : new WPBC_Booking_New_Inspector_Form_Repository();
		$this->field_mapper         = $field_mapper ? $field_mapper : new WPBC_Booking_New_Inspector_Field_DTO_Mapper();
		$this->form_validator       = $form_validator ? $form_validator : new WPBC_Booking_New_Inspector_Form_Validator( $this->field_mapper );
		$this->form_serializer      = $form_serializer ? $form_serializer : new WPBC_Booking_New_Inspector_Form_Serializer();
		$this->timeline_seed        = $timeline_seed ? $timeline_seed : new WPBC_Booking_New_Inspector_Timeline_Seed();
		$this->schedule_normalizer  = $schedule_normalizer ? $schedule_normalizer : new WPBC_Booking_Schedule_Proposal_Normalizer();
		$this->schedule_policy      = $schedule_policy ? $schedule_policy : new WPBC_Booking_New_Inspector_Schedule_Policy();
		$this->edition_capabilities = $edition_capabilities ? $edition_capabilities : new WPBC_Booking_New_Inspector_Edition_Capabilities();
		$this->cost_calculator      = $cost_calculator ? $cost_calculator : new WPBC_Booking_New_Inspector_Cost_Calculator();
		$this->notes                = $notes ? $notes : new WPBC_Booking_New_Inspector_Notes();
	}

	/**
	 * Calculate one current authorized draft without persisting any state.
	 *
	 * @param mixed $request_values Untrusted decoded request values.
	 * @return array<string,mixed>|WP_Error Cost response or safe validation error.
	 */
	public function preview( $request_values ) {
		$context = $this->resolve_authoritative_context( $request_values, WPBC_Booking_New_Inspector_Form_Validator::INTENT_COST_PREVIEW );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		if ( isset( $context['fallback_response'] ) ) {
			return $context['fallback_response'];
		}

		return array(
			'schema_version'    => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'        => $context['request']['request_id'],
			'state'             => WPBC_Booking_New_Inspector_Contract::STATE_COST_PREVIEW,
			'cost'              => $context['cost'],
			'draft_revision'    => $context['request']['draft_revision'],
			'draft_fingerprint' => $context['draft_fingerprint'],
			'warnings'          => $context['validation_warnings'],
			'fallback'          => null,
		);
	}

	/**
	 * Resolve one complete server-authoritative draft for preview and review.
	 *
	 * The returned internal context is never sent directly to the browser. It
	 * deliberately retains the exact current definitions, canonical customer
	 * records, normalized schedule, ownership context, and pricing fingerprints
	 * needed by signed Review and later apply-time revalidation.
	 *
	 * @since 12.0.0
	 * @param mixed  $request_values    Untrusted decoded draft values.
	 * @param string $validation_intent Exact Booking Form validation purpose.
	 * @return array<string,mixed>|WP_Error Authoritative internal context or safe validation error.
	 */
	public function resolve_authoritative_context( $request_values, $validation_intent = WPBC_Booking_New_Inspector_Form_Validator::INTENT_CREATION ) {
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
		if ( ! $this->source_context_matches( $request, $seed ) ) {
			return $this->get_context_error();
		}

		$resources = $this->resource_repository->get_authorized_resources();
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		$resource = $this->find_record( $resources, $request['resource_id'] );
		if ( empty( $resource ) ) {
			return $this->get_not_found_error( 'resource' );
		}

		$previous_owner_context = $this->activate_owner_context( isset( $resource['owner_user_id'] ) ? $resource['owner_user_id'] : 0 );
		try {
			$forms = $this->form_repository->get_authorized_forms( $resource );
			if ( is_wp_error( $forms ) ) {
				return $forms;
			}
			$form = $this->find_record( $forms, $request['form_id'] );
			if ( empty( $form ) || (string) $form['source'] !== $request['form_source'] ) {
				return $this->get_not_found_error( 'form' );
			}

			$form_contract = $this->field_mapper->resolve_form_contract( $form['definition'], $resource['id'], $form['source'] );
			if ( empty( $form_contract['support']['creation_allowed'] ) ) {
				return array( 'fallback_response' => $this->get_fallback_response( $request, 'unsupported_form', $this->get_draft_fingerprint( $request, array() ) ) );
			}

			$schedule = $this->normalize_schedule( $request['schedule'], $form['source'], $form_contract );
			if ( is_wp_error( $schedule ) ) {
				return $schedule;
			}
			$validated_form = $this->form_validator->validate( $form['definition'], $resource['id'], $form['source'], $request['fields'], $validation_intent );
			if ( is_wp_error( $validated_form ) ) {
				return $validated_form;
			}
			$validation_warnings = WPBC_Booking_New_Inspector_Form_Validator::INTENT_COST_PREVIEW === $validation_intent
				? $this->get_validation_warning_messages( $validated_form, $form_contract )
				: array();
			$form_data = $this->form_serializer->serialize( $validated_form, $schedule );
			if ( is_wp_error( $form_data ) ) {
				return $form_data;
			}
			$notes = $this->notes->validate_draft( $request['notes'] );
			if ( is_wp_error( $notes ) ) {
				return $notes;
			}

			$canonical_draft = array(
				'resource_id'    => absint( $resource['id'] ),
				'form_id'        => (string) $form['id'],
				'form_source'    => (string) $form['source'],
				'form_data'      => $form_data,
				'notes'          => $notes,
				'schedule'       => $schedule,
				'email_intent'   => $request['email_intent'],
				'cost_intent'    => $request['cost_intent'],
				'corrected_cost' => $request['corrected_cost'],
			);
			$draft_fingerprint = $this->get_draft_fingerprint( $canonical_draft, $form['definition'] );
			$capabilities      = $this->edition_capabilities->get_capabilities();
			if ( 'corrected' === $request['cost_intent'] && empty( $capabilities['cost_correction'] ) ) {
				return array( 'fallback_response' => $this->get_fallback_response( $request, 'cost_correction_unauthorized', $draft_fingerprint ) );
			}
			if ( ! empty( $seed['service_id'] ) ) {
				return array( 'fallback_response' => $this->get_fallback_response( $request, 'appointment_context_unsupported', $draft_fingerprint ) );
			}
			if ( $this->definition_uses_additional_calendars( $form['definition'] ) ) {
				return array( 'fallback_response' => $this->get_fallback_response( $request, 'additional_calendars_unsupported', $draft_fingerprint ) );
			}

			if ( empty( $capabilities['cost_preview'] ) ) {
				if ( WPBC_Booking_New_Inspector_Form_Validator::INTENT_COST_PREVIEW === $validation_intent ) {
					return array( 'fallback_response' => $this->get_fallback_response( $request, 'edition_unavailable', $draft_fingerprint ) );
				}

				// Free and Personal can create bookings without asserting a price.
				$cost_dto = $this->get_unpriced_creation_cost_dto();
			} else {
				$calculated_cost = $this->cost_calculator->calculate( $canonical_draft );
				if ( is_wp_error( $calculated_cost ) ) {
					$error_data  = $calculated_cost->get_error_data();
					$reason_code = is_array( $error_data ) && ! empty( $error_data['reason_code'] ) ? $error_data['reason_code'] : 'pricing_path_unsupported';

					return array( 'fallback_response' => $this->get_fallback_response( $request, $reason_code, $draft_fingerprint ) );
				}

				$cost_dto = $this->get_cost_dto( $calculated_cost, $resource['id'] );
			}
			$draft_fingerprint = $this->get_draft_fingerprint(
				$canonical_draft,
				array(
					'form_definition' => $form['definition'],
					'cost'            => $cost_dto,
				)
			);

			return array(
				'request'             => $request,
				'seed'                => $seed,
				'resource'            => $resource,
				'form'                => $form,
				'form_contract'       => $form_contract,
				'validated_form'      => $validated_form,
				'canonical_form_data' => $form_data,
				'notes'               => $notes,
				'note_definitions'     => $this->notes->get_review_rows( $notes ),
				'canonical_draft'     => $canonical_draft,
				'schedule'            => $schedule,
				'edition_capabilities' => $capabilities,
				'cost'                => $cost_dto,
				'draft_fingerprint'   => $draft_fingerprint,
				'form_fingerprint'    => $this->get_draft_fingerprint( $form['definition'], array( 'form_id' => $form['id'], 'source' => $form['source'] ) ),
				'pricing_fingerprint' => $this->get_draft_fingerprint( $cost_dto, array( 'resource_id' => $resource['id'], 'form_id' => $form['id'], 'capabilities' => $capabilities ) ),
				'validation_warnings' => $validation_warnings,
			);
		} finally {
			$this->restore_owner_context( $previous_owner_context );
		}
	}

	/**
	 * Convert non-blocking partial-form warnings to bounded browser-safe strings.
	 *
	 * Cost preview intentionally excludes malformed non-pricing email values from
	 * the legacy calculator. Review and Apply remain creation-strict. Including
	 * the authorized field label here keeps that distinction visible without
	 * exposing an arbitrary submitted key.
	 *
	 * @param array<string,mixed> $validated_form Exact validator result.
	 * @param array<string,mixed> $form_contract  Current authorized form contract.
	 * @return array<int,string> Ordered plain-text warning messages.
	 */
	private function get_validation_warning_messages( $validated_form, $form_contract ) {
		$field_labels = array();
		foreach ( isset( $form_contract['fields'] ) && is_array( $form_contract['fields'] ) ? $form_contract['fields'] : array() as $field_contract ) {
			if ( ! is_array( $field_contract ) || empty( $field_contract['key'] ) ) {
				continue;
			}
			$field_labels[ (string) $field_contract['key'] ] = isset( $field_contract['label'] ) && '' !== (string) $field_contract['label']
				? (string) $field_contract['label']
				: __( 'Booking details', 'booking' );
		}

		$warning_messages = array();
		$warnings         = isset( $validated_form['validation_warnings'] ) && is_array( $validated_form['validation_warnings'] )
			? $validated_form['validation_warnings']
			: array();
		foreach ( $warnings as $warning ) {
			if ( ! is_array( $warning ) || empty( $warning['key'] ) || empty( $warning['message'] ) || ! isset( $field_labels[ $warning['key'] ] ) ) {
				continue;
			}

			/* translators: 1: Booking Form field label, 2: validation warning. */
			$warning_messages[] = sprintf( __( '%1$s: %2$s', 'booking' ), $field_labels[ $warning['key'] ], (string) $warning['message'] );
			if ( WPBC_Booking_New_Inspector_Config::MAX_WARNINGS <= count( $warning_messages ) ) {
				break;
			}
		}

		return $warning_messages;
	}

	/**
	 * Validate the signed source companion against the current draft identity.
	 *
	 * @param array<string,mixed> $request Validated request.
	 * @param array<string,mixed> $seed    Verified source context.
	 * @return bool True when source identity and intent match.
	 */
	private function source_context_matches( $request, $seed ) {
		if ( 'timeline' !== $request['selection_source'] ) {
			return empty( $seed['source_context_token'] );
		}

		return absint( $seed['resource_id'] ) === absint( $request['resource_id'] )
			&& ( '' === (string) $seed['form_id'] || (string) $seed['form_id'] === (string) $request['form_id'] )
			&& ( 'canonical_default' === $request['email_intent'] || (string) $seed['email_intent'] === $request['email_intent'] );
	}

	/**
	 * Normalize the exact draft under current form-owned schedule choices.
	 *
	 * @param array<string,mixed> $proposal      Untrusted schedule proposal.
	 * @param string              $form_source   Current exact form source.
	 * @param array<string,mixed> $form_contract Current exact form contract.
	 * @return array<string,mixed>|WP_Error Normalized schedule or safe error.
	 */
	private function normalize_schedule( $proposal, $form_source, $form_contract ) {
		$schedule = $this->schedule_normalizer->normalize( $proposal, WPBC_Booking_New_Inspector_Config::MAX_DATES );
		if ( is_wp_error( $schedule ) ) {
			return $this->get_schedule_error();
		}
		$choices = $this->schedule_policy->get_choices( $form_source, isset( $form_contract['schedule_fields'] ) ? $form_contract['schedule_fields'] : array() );
		if ( ! $this->schedule_policy->permits_selection_method( $schedule['selection_method'], $choices ) || ! $this->schedule_policy->permits_time_application( $schedule['time_application'], $choices ) ) {
			return $this->get_schedule_error();
		}

		return $schedule;
	}

	/**
	 * Detect additional-calendar definitions that this draft contract cannot express.
	 *
	 * @param array<string,mixed> $form_definition Exact authorized form definition.
	 * @return bool True when another Resource calendar is embedded.
	 */
	private function definition_uses_additional_calendars( $form_definition ) {
		foreach ( array( 'advanced_form', 'content_form', 'structure_json' ) as $definition_key ) {
			$definition_value = isset( $form_definition[ $definition_key ] ) && is_string( $form_definition[ $definition_key ] ) ? $form_definition[ $definition_key ] : '';
			if ( preg_match( '/\[calendar\b[^\]]*\b(?:id|type)\s*=\s*["\']?[1-9][0-9]*/i', $definition_value ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Build a JSON-safe cost DTO with total, deposit, and balance.
	 *
	 * @param array<string,mixed> $calculated_cost Canonical numeric result.
	 * @param int                 $resource_id    Authorized Resource ID.
	 * @return array<string,mixed> Cost DTO.
	 */
	private function get_cost_dto( $calculated_cost, $resource_id ) {
		$currency = function_exists( 'wpbc_get_currency' ) ? sanitize_text_field( (string) wpbc_get_currency() ) : sanitize_text_field( (string) get_bk_option( 'booking_currency' ) );
		$values   = array(
			'total'   => (float) $calculated_cost['total_cost'],
			'deposit' => (float) $calculated_cost['deposit_cost'],
			'balance' => (float) $calculated_cost['balance_cost'],
		);
		$labels   = array(
			'total'   => __( 'Total', 'booking' ),
			'deposit' => __( 'Deposit', 'booking' ),
			'balance' => __( 'Balance', 'booking' ),
		);
		$line_items = array();
		foreach ( $values as $line_item_id => $line_item_value ) {
			$amount       = number_format( $line_item_value, 2, '.', '' );
			$line_items[] = array(
				'id'               => $line_item_id,
				'label'            => $labels[ $line_item_id ],
				'amount'           => $amount,
				'formatted_amount' => $this->format_cost( $line_item_value, $resource_id ),
			);
		}

		return array(
			'status'          => 'calculated',
			'currency'        => preg_match( '/^[A-Z]{3}$/', strtoupper( $currency ) ) ? strtoupper( $currency ) : null,
			'total'           => $line_items[0]['amount'],
			'formatted_total' => $line_items[0]['formatted_amount'],
			'canonical_total' => number_format( (float) $calculated_cost['canonical_total_cost'], 2, '.', '' ),
			'cost_intent'     => (string) $calculated_cost['cost_intent'],
			'corrected_cost'  => (string) $calculated_cost['corrected_cost'],
			'line_items'      => $line_items,
			'message'         => 'corrected' === $calculated_cost['cost_intent']
				? __( 'The authorized manual total is applied to this cost preview.', 'booking' )
				: __( 'Calculated from the current booking details and schedule.', 'booking' ),
		);
	}

	/**
	 * Build the signed neutral cost contract used by lower-edition creation.
	 *
	 * Cost preview and correction are separate Business Small capabilities. Free
	 * and Personal Review must still bind a deterministic, non-priced value so
	 * Apply can revalidate the exact plan without inventing or trusting a total.
	 *
	 * @return array<string,mixed> JSON-safe neutral creation cost DTO.
	 */
	private function get_unpriced_creation_cost_dto() {
		return array(
			'status'          => 'unavailable',
			'currency'        => null,
			'total'           => null,
			'formatted_total' => '',
			'line_items'      => array(),
			'cost_intent'     => 'canonical',
			'corrected_cost'  => '',
			'message'         => __( 'Cost calculation and correction in this Inspector are available in Booking Calendar Business Small or higher. You can still review and create this booking.', 'booking' ),
		);
	}

	/**
	 * Format one numeric cost as presentation-safe plain text.
	 *
	 * @param float $cost        Numeric cost.
	 * @param int   $resource_id Authorized Resource ID.
	 * @return string Plain formatted cost.
	 */
	private function format_cost( $cost, $resource_id ) {
		$formatted_cost = function_exists( 'wpbc_get_cost_with_currency_for_user' )
			? wpbc_get_cost_with_currency_for_user( $cost, $resource_id )
			: number_format( $cost, 2, '.', '' );

		return trim( sanitize_text_field( html_entity_decode( wp_strip_all_tags( (string) $formatted_cost ), ENT_QUOTES, 'UTF-8' ) ) );
	}

	/**
	 * Return a non-misleading editing response for an unsupported pricing path.
	 *
	 * @param array<string,mixed> $request           Validated request.
	 * @param string              $reason_code       Stable fallback reason.
	 * @param string              $draft_fingerprint Current exact draft fingerprint.
	 * @return array<string,mixed> Data-only fallback response.
	 */
	private function get_fallback_response( $request, $reason_code, $draft_fingerprint ) {
		$query_arguments = array(
			'page'         => 'wpbc',
			'tab'          => 'add-booking',
			'booking_type' => absint( $request['resource_id'] ),
			'booking_form' => substr( sanitize_text_field( (string) $request['form_id'] ), 0, 191 ),
		);
		if ( '' !== $request['source_context_token'] ) {
			$query_arguments[ WPBC_Booking_New_Inspector_Config::TIMELINE_HANDOFF_QUERY_ARG ] = (string) $request['source_context_token'];
		}
		$canonical_url = add_query_arg( $query_arguments, admin_url( 'admin.php' ) );
		$message = 'edition_unavailable' === $reason_code
			? __( 'Cost calculation in this Inspector is available in Booking Calendar Business Small or higher.', 'booking' )
			: __( 'This booking cost must be calculated on the full Add Booking page.', 'booking' );

		return array(
			'schema_version'   => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'       => $request['request_id'],
			'state'            => WPBC_Booking_New_Inspector_Contract::STATE_EDITING,
			'cost'             => array(
				'status'          => 'unavailable',
				'currency'        => null,
				'total'           => null,
				'formatted_total' => '',
				'line_items'      => array(),
				'message'         => $message,
			),
			'draft_revision'   => $request['draft_revision'],
			'draft_fingerprint' => $draft_fingerprint,
			'warnings'         => array(),
			'fallback'         => array(
				'action_id'         => WPBC_Booking_New_Inspector_Config::FALLBACK_ACTION_OPEN_FULL_ADD_BOOKING,
				'label'             => __( 'Open full Add Booking', 'booking' ),
				'url'               => esc_url_raw( $canonical_url ),
				'reason_code'       => sanitize_key( $reason_code ),
				'message'           => $message,
				'preserved_context' => array(
					'resource_id'         => absint( $request['resource_id'] ),
					'form_id'             => substr( sanitize_text_field( (string) $request['form_id'] ), 0, 191 ),
					'source_context_token' => (string) $request['source_context_token'],
				),
			),
		);
	}

	/**
	 * Hash canonical draft and current server dependencies for exact binding.
	 *
	 * @param array<string,mixed> $canonical_draft Canonical draft values.
	 * @param array<string,mixed> $dependencies    Current server-side dependencies.
	 * @return string SHA-256 hexadecimal fingerprint.
	 */
	private function get_draft_fingerprint( $canonical_draft, $dependencies ) {
		$encoded = function_exists( 'wp_json_encode' ) ? wp_json_encode( array( $canonical_draft, $dependencies ) ) : json_encode( array( $canonical_draft, $dependencies ) );

		return hash( 'sha256', is_string( $encoded ) ? $encoded : '' );
	}

	/**
	 * Find one exact repository record.
	 *
	 * @param array<int,array<string,mixed>> $records   Candidate records.
	 * @param int|string                     $record_id Exact identifier.
	 * @return array<string,mixed> Matching record or empty array.
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
	 * Activate one already-authorized MultiUser owner.
	 *
	 * @param int $owner_user_id Owner WordPress user ID.
	 * @return mixed Previous environment token.
	 */
	private function activate_owner_context( $owner_user_id ) {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) || ! absint( $owner_user_id ) ) {
			return null;
		}
		$previous_owner_context = apply_bk_filter( 'get_client_side_active_params_of_user' );
		make_bk_action( 'check_multiuser_params_for_client_side_by_user_id', absint( $owner_user_id ) );

		return $previous_owner_context;
	}

	/**
	 * Restore the exact previous MultiUser environment.
	 *
	 * @param mixed $previous_owner_context Previous environment token.
	 * @return void
	 */
	private function restore_owner_context( $previous_owner_context ) {
		if ( class_exists( 'wpdev_bk_multiuser' ) && null !== $previous_owner_context ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_owner_context );
		}
	}

	/**
	 * Return a safe source-context mismatch.
	 *
	 * @return WP_Error Safe context error.
	 */
	private function get_context_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_source_context_invalid',
			__( 'This booking selection expired or is invalid. Return to Timeline and select the range again.', 'booking' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Return a safe current-authority lookup error.
	 *
	 * @param string $record_type Resource or form.
	 * @return WP_Error Safe not-found error.
	 */
	private function get_not_found_error( $record_type ) {
		return new WP_Error(
			'resource' === $record_type ? 'wpbc_booking_new_inspector_resource_not_found' : 'wpbc_booking_new_inspector_form_not_authorized',
			'resource' === $record_type ? __( 'The requested Booking Resource was not found.', 'booking' ) : __( 'The requested Booking Form was not found.', 'booking' ),
			array( 'status' => 404 )
		);
	}

	/**
	 * Return a safe invalid schedule error.
	 *
	 * @return WP_Error Safe schedule error.
	 */
	private function get_schedule_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_schedule_invalid',
			__( 'The proposed booking schedule is invalid. Review the selection and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
