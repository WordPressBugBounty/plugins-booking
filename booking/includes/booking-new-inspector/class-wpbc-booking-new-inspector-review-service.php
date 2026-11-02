<?php
/**
 * Signed non-mutating review for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Revalidates one creation draft and issues a short-lived signed plan.
 */
final class WPBC_Booking_New_Inspector_Review_Service {

	/** Signed plan schema version. */
	const PLAN_VERSION = 1;

	/** Stable plan purpose. */
	const PLAN_PURPOSE = 'wpbc_booking_new_inspector_create_review';

	/** Signed plan lifetime in seconds. */
	const PLAN_LIFETIME = 600;

	/** @var object Exact review request validator. */
	private $request_validator;

	/** @var object Shared authoritative draft resolver. */
	private $draft_service;

	/** @var object Canonical creation availability resolver. */
	private $availability_service;

	/**
	 * Construct the service with replaceable non-mutating boundaries.
	 *
	 * @param object|null $request_validator    Optional object exposing validate().
	 * @param object|null $draft_service        Optional object exposing resolve_authoritative_context().
	 * @param object|null $availability_service Optional object exposing resolve().
	 */
	public function __construct( $request_validator = null, $draft_service = null, $availability_service = null ) {
		$this->request_validator    = $request_validator ? $request_validator : new WPBC_Booking_New_Inspector_Review_Request_Validator();
		$this->draft_service        = $draft_service ? $draft_service : new WPBC_Booking_New_Inspector_Cost_Service();
		$this->availability_service = $availability_service ? $availability_service : new WPBC_Booking_New_Inspector_Availability_Service();
	}

	/**
	 * Build one signed review without creating a booking or sending email.
	 *
	 * @param mixed $request_values Untrusted decoded draft values.
	 * @return array<string,mixed>|WP_Error Review DTO and signed plan or safe error.
	 */
	public function review( $request_values ) {
		$request = $this->request_validator->validate( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}
		$context = $this->draft_service->resolve_authoritative_context( $request );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		if ( isset( $context['fallback_response'] ) ) {
			return $this->get_fallback_error( $context['fallback_response'] );
		}
		$availability = $this->availability_service->resolve( $context );
		if ( is_wp_error( $availability ) ) {
			return $availability;
		}

		$issued_at       = time();
		$expires_at      = $issued_at + self::PLAN_LIFETIME;
		$idempotency_key = $this->create_idempotency_key();
		$normalized_fields = $this->get_normalized_fields( $context['validated_form'] );
		$resource_context  = array(
			'id'            => absint( $context['resource']['id'] ),
			'owner_user_id' => isset( $context['resource']['owner_user_id'] ) ? absint( $context['resource']['owner_user_id'] ) : 0,
			'parent_id'     => ! empty( $context['resource']['parent_id'] ) ? absint( $context['resource']['parent_id'] ) : 0,
			'allocation'    => $availability['allocation'],
		);
		$plan = array(
			'version'               => self::PLAN_VERSION,
			'purpose'               => self::PLAN_PURPOSE,
			'site_id'               => $this->get_site_id(),
			'user_id'               => $this->get_effective_user_id(),
			'actor_user_id'         => $this->get_actor_user_id(),
			'session_fingerprint'   => $this->get_session_fingerprint(),
			'issued_at'             => $issued_at,
			'expires_at'            => $expires_at,
			'source'                => array(
				'selection_source'     => $request['selection_source'],
				'source_context_token' => $request['source_context_token'],
				'verified_seed'        => $context['seed'],
			),
			'resource'              => $resource_context,
			'edition'               => $context['edition_capabilities'],
			'form'                  => array(
				'id'                     => (string) $context['form']['id'],
				'source'                 => (string) $context['form']['source'],
				'definition_fingerprint' => $context['form_fingerprint'],
			),
			'fields'                => $normalized_fields,
			'canonical_form_data'   => (string) $context['canonical_form_data'],
			'notes'                 => $context['notes'],
			'schedule'              => $context['schedule'],
			'availability_revision' => $availability['availability_revision'],
			'workflow'              => array(
				'email_intent'    => $request['email_intent'],
				'approval_intent' => 'canonical_default',
			),
			'cost'                  => array(
				'intent'              => $request['cost_intent'],
				'corrected_cost'      => $request['corrected_cost'],
				'preview'             => $context['cost'],
				'pricing_fingerprint' => $context['pricing_fingerprint'],
				'currency'            => $context['cost']['currency'],
			),
			'draft_fingerprint'     => $context['draft_fingerprint'],
			'idempotency_key'       => $idempotency_key,
		);
		$encoded_plan = wp_json_encode( $plan );
		if ( ! is_string( $encoded_plan ) || WPBC_Booking_New_Inspector_Config::MAX_REVIEW_PLAN_BYTES < strlen( $encoded_plan ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_review_plan_too_large',
				__( 'This booking review is too large. Open the full Add Booking page and try again.', 'booking' ),
				array( 'status' => 413 )
			);
		}

		return array(
			'schema_version'  => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'      => $request['request_id'],
			'state'           => WPBC_Booking_New_Inspector_Contract::STATE_REVIEW,
			'review'          => $this->build_review_dto( $context, $availability ),
			'plan'            => $plan,
			'token'           => $this->sign_plan( $plan ),
			'expires_at'      => $expires_at,
			'idempotency_key' => $idempotency_key,
			'warnings'        => array(),
		);
	}

	/**
	 * Verify signature, shape, lifetime, user, session, site, and purpose.
	 *
	 * @param mixed $plan  Untrusted plan value.
	 * @param mixed $token Untrusted hexadecimal signature.
	 * @return true|WP_Error True when the envelope is valid or a safe error.
	 */
	public function verify_plan( $plan, $token ) {
		$token = is_scalar( $token ) ? strtolower( trim( (string) $token ) ) : '';
		$encoded_plan = is_array( $plan ) ? wp_json_encode( $plan ) : false;
		if (
			! is_array( $plan )
			|| ! is_string( $encoded_plan )
			|| WPBC_Booking_New_Inspector_Config::MAX_REVIEW_PLAN_BYTES < strlen( $encoded_plan )
			|| ! preg_match( '/^[a-f0-9]{64}$/', $token )
			|| ! hash_equals( $this->sign_plan( $plan ), $token )
		) {
			return $this->get_invalid_plan_error();
		}
		$required_keys = array( 'version', 'purpose', 'site_id', 'user_id', 'actor_user_id', 'session_fingerprint', 'issued_at', 'expires_at', 'source', 'resource', 'edition', 'form', 'fields', 'canonical_form_data', 'notes', 'schedule', 'availability_revision', 'workflow', 'cost', 'draft_fingerprint', 'idempotency_key' );
		foreach ( $required_keys as $required_key ) {
			if ( ! array_key_exists( $required_key, $plan ) ) {
				return $this->get_invalid_plan_error();
			}
		}
		$issued_at  = absint( $plan['issued_at'] );
		$expires_at = absint( $plan['expires_at'] );
		if (
			self::PLAN_VERSION !== absint( $plan['version'] )
			|| self::PLAN_PURPOSE !== (string) $plan['purpose']
			|| $this->get_site_id() !== absint( $plan['site_id'] )
			|| $this->get_effective_user_id() !== absint( $plan['user_id'] )
			|| $this->get_actor_user_id() !== absint( $plan['actor_user_id'] )
			|| ! hash_equals( $this->get_session_fingerprint(), (string) $plan['session_fingerprint'] )
			|| ! $issued_at || time() < $issued_at || $expires_at <= $issued_at || self::PLAN_LIFETIME < ( $expires_at - $issued_at ) || time() > $expires_at
			|| ! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['availability_revision'] )
			|| ! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['draft_fingerprint'] )
			|| ! preg_match( '/^[A-Za-z0-9._:-]{16,64}$/', (string) $plan['idempotency_key'] )
			|| ! is_array( $plan['source'] ) || ! isset( $plan['source']['selection_source'], $plan['source']['source_context_token'], $plan['source']['verified_seed'] )
			|| ! is_array( $plan['resource'] ) || ! isset( $plan['resource']['id'], $plan['resource']['owner_user_id'], $plan['resource']['allocation'] )
			|| ! is_array( $plan['form'] ) || ! isset( $plan['form']['id'], $plan['form']['source'], $plan['form']['definition_fingerprint'] )
			|| ! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['form']['definition_fingerprint'] )
			|| ! is_array( $plan['fields'] ) || WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( $plan['fields'] )
			|| ! $this->has_valid_note_shape( $plan['notes'] )
			|| ! is_array( $plan['schedule'] )
			|| ! is_array( $plan['workflow'] ) || ! isset( $plan['workflow']['email_intent'], $plan['workflow']['approval_intent'] )
			|| ! is_array( $plan['cost'] ) || ! isset( $plan['cost']['intent'], $plan['cost']['corrected_cost'], $plan['cost']['preview'], $plan['cost']['pricing_fingerprint'] ) || ! array_key_exists( 'currency', $plan['cost'] )
			|| ! in_array( $plan['cost']['intent'], array( 'canonical', 'corrected' ), true )
			|| ( 'canonical' === $plan['cost']['intent'] && '' !== $plan['cost']['corrected_cost'] )
			|| ( 'corrected' === $plan['cost']['intent'] && '' === $plan['cost']['corrected_cost'] )
			|| ! preg_match( '/^[a-f0-9]{64}$/', (string) $plan['cost']['pricing_fingerprint'] )
		) {
			return $this->get_invalid_plan_error();
		}

		return true;
	}

	/**
	 * Repeat every authoritative Review check for the future Apply boundary.
	 *
	 * Phase 8 exposes this method for tests and Phase 9 composition only; no Apply
	 * endpoint calls it yet and this method performs no persistence.
	 *
	 * @param array<string,mixed> $plan  Untrusted signed plan.
	 * @param string              $token Untrusted plan signature.
	 * @return array<string,mixed>|WP_Error Fresh authoritative context or stale error.
	 */
	public function revalidate_plan_for_apply( $plan, $token ) {
		$plan_check = $this->verify_plan( $plan, $token );
		if ( is_wp_error( $plan_check ) ) {
			return $plan_check;
		}
		$request = array(
			'schema_version'       => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'request_id'           => 'review-revalidation',
			'resource_id'          => absint( $plan['resource']['id'] ),
			'form_id'              => (string) $plan['form']['id'],
			'form_source'          => (string) $plan['form']['source'],
			'selection_source'     => (string) $plan['source']['selection_source'],
			'source_context_token' => (string) $plan['source']['source_context_token'],
			'schedule'             => $plan['schedule'],
			'fields'               => $plan['fields'],
			'notes'                => $plan['notes'],
			'email_intent'         => (string) $plan['workflow']['email_intent'],
			'cost_intent'          => (string) $plan['cost']['intent'],
			'corrected_cost'       => (string) $plan['cost']['corrected_cost'],
			'draft_revision'       => 0,
		);
		$context = $this->draft_service->resolve_authoritative_context( $request );
		if ( is_wp_error( $context ) || isset( $context['fallback_response'] ) ) {
			return is_wp_error( $context ) ? $context : $this->get_stale_error();
		}
		$availability = $this->availability_service->resolve( $context );
		if ( is_wp_error( $availability ) ) {
			return $availability;
		}
		$resource_matches = absint( $context['resource']['id'] ) === absint( $plan['resource']['id'] )
			&& ( isset( $context['resource']['owner_user_id'] ) ? absint( $context['resource']['owner_user_id'] ) : 0 ) === absint( $plan['resource']['owner_user_id'] );
		if (
			! $resource_matches
			|| ! hash_equals( (string) $plan['form']['definition_fingerprint'], (string) $context['form_fingerprint'] )
			|| ! hash_equals( (string) $plan['draft_fingerprint'], (string) $context['draft_fingerprint'] )
			|| ! hash_equals( (string) $plan['cost']['pricing_fingerprint'], (string) $context['pricing_fingerprint'] )
			|| ! hash_equals( (string) $plan['availability_revision'], (string) $availability['availability_revision'] )
			|| wp_json_encode( $plan['edition'] ) !== wp_json_encode( $context['edition_capabilities'] )
			|| wp_json_encode( $plan['resource']['allocation'] ) !== wp_json_encode( $availability['allocation'] )
		) {
			return $this->get_stale_error();
		}

		return array(
			'context'      => $context,
			'availability' => $availability,
			'idempotency_key' => (string) $plan['idempotency_key'],
		);
	}

	/**
	 * Project validated fields into the exact client-independent plan shape.
	 *
	 * @param array<string,mixed> $validated_form Exact validator output.
	 * @return array<int,array<string,mixed>> Ordered normalized field values.
	 */
	private function get_normalized_fields( $validated_form ) {
		$fields = array();
		foreach ( (array) $validated_form['fields'] as $validated_field ) {
			$fields[] = array(
				'key'    => (string) $validated_field['key'],
				'values' => array_values( $validated_field['values'] ),
			);
		}

		return $fields;
	}

	/**
	 * Build presentation-neutral review rows from authorized plain strings.
	 *
	 * @param array<string,mixed> $context      Authoritative draft context.
	 * @param array<string,mixed> $availability Authoritative allocation context.
	 * @return array<string,mixed> JSON-safe review DTO.
	 */
	private function build_review_dto( $context, $availability ) {
		$field_rows = array();
		foreach ( (array) $context['validated_form']['fields'] as $validated_field ) {
			$field_rows[] = array(
				'key'   => (string) $validated_field['key'],
				'label' => sanitize_text_field( (string) $validated_field['label'] ),
				'value' => sanitize_text_field( implode( ', ', array_values( $validated_field['display_values'] ) ) ),
			);
		}
		$schedule = $context['schedule'];

		return array(
			'resource' => array(
				'label' => sanitize_text_field( (string) $context['resource']['label'] ),
				'id'    => absint( $context['resource']['id'] ),
			),
			'form' => array(
				'label'  => sanitize_text_field( (string) $context['form']['label'] ),
				'id'     => (string) $context['form']['id'],
				'source' => (string) $context['form']['source'],
			),
			'fields'   => $field_rows,
			'notes'    => isset( $context['note_definitions'] ) && is_array( $context['note_definitions'] ) ? $context['note_definitions'] : array(),
			'schedule' => array(
				'dates'            => array_values( $schedule['selected_dates'] ),
				'time_application' => (string) $schedule['time_application'],
				'start_time'       => (string) $schedule['start_time'],
				'end_time'         => (string) $schedule['end_time'],
			),
			'cost'         => $context['cost'],
			'email_intent' => $this->get_email_intent_label( $context['request']['email_intent'] ),
			'approval_intent' => __( 'Use the current Add Booking approval setting', 'booking' ),
			'allocation'   => array(
				'quantity' => absint( $availability['allocation']['quantity'] ),
			),
			'warnings'     => array(),
			'limitations'  => array(),
		);
	}

	/**
	 * Validate the bounded signed-note shape before apply-time revalidation.
	 *
	 * Exact authority is reloaded by the draft service. This check prevents an
	 * oversized or executable plan value from reaching that boundary.
	 *
	 * @param mixed $notes Candidate signed note map.
	 * @return bool True for a bounded public/private scalar map.
	 */
	private function has_valid_note_shape( $notes ) {
		if ( ! is_array( $notes ) || ( ! empty( $notes ) && array_values( $notes ) === $notes ) ) {
			return false;
		}
		foreach ( $notes as $note_type => $note_value ) {
			if (
				! in_array( $note_type, array( 'public', 'private' ), true )
				|| ! is_scalar( $note_value )
				|| WPBC_Booking_New_Inspector_Config::MAX_NOTE_VALUE_BYTES < strlen( (string) $note_value )
			) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Convert the canonical email intent to an authorized display string.
	 *
	 * @param string $email_intent Canonical email intent.
	 * @return string Translated display label.
	 */
	private function get_email_intent_label( $email_intent ) {
		if ( 'send' === $email_intent ) {
			return __( 'Send booking emails', 'booking' );
		}
		if ( 'do_not_send' === $email_intent ) {
			return __( 'Do not send booking emails', 'booking' );
		}

		return __( 'Use the current Add Booking email setting', 'booking' );
	}

	/**
	 * Sign one complete creation review plan.
	 *
	 * @param array<string,mixed> $plan Complete plan.
	 * @return string Lowercase hexadecimal HMAC.
	 */
	private function sign_plan( $plan ) {
		$encoded = wp_json_encode( $plan );

		return hash_hmac( 'sha256', 'wpbc_booking_new_inspector_review:v1:' . ( is_string( $encoded ) ? $encoded : '' ), wp_salt( 'nonce' ) );
	}

	/**
	 * Generate one server-accepted idempotency identifier for future Apply.
	 *
	 * @return string Bounded UUID or random hexadecimal identifier.
	 */
	private function create_idempotency_key() {
		if ( function_exists( 'wp_generate_uuid4' ) ) {
			return wp_generate_uuid4();
		}

		return substr( hash( 'sha256', uniqid( 'wpbc-review-', true ) ), 0, 32 );
	}

	/** @return int Current multisite site ID. */
	private function get_site_id() {
		return function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;
	}

	/** @return int Current effective MultiUser-aware user ID. */
	private function get_effective_user_id() {
		return function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : $this->get_actor_user_id();
	}

	/** @return int Current authenticated WordPress actor ID. */
	private function get_actor_user_id() {
		return function_exists( 'get_current_user_id' ) ? absint( get_current_user_id() ) : 0;
	}

	/**
	 * Bind plans to the current logged-in session without exposing its token.
	 *
	 * @return string Lowercase hexadecimal HMAC.
	 */
	private function get_session_fingerprint() {
		$session_token = function_exists( 'wp_get_session_token' ) ? (string) wp_get_session_token() : '';

		return hash_hmac( 'sha256', 'wpbc_booking_new_inspector_session:v1:' . $session_token, wp_salt( 'nonce' ) );
	}

	/** @return WP_Error Safe invalid-plan error. */
	private function get_invalid_plan_error() {
		return new WP_Error( 'wpbc_booking_new_inspector_review_plan_invalid', __( 'This booking review is invalid or expired. Review the booking again.', 'booking' ), array( 'status' => 403 ) );
	}

	/** @return WP_Error Safe stale-plan error. */
	private function get_stale_error() {
		return new WP_Error( 'wpbc_booking_new_inspector_review_stale', __( 'The booking details, availability, or price changed after review. Review the booking again.', 'booking' ), array( 'status' => 409 ) );
	}

	/**
	 * Convert an unsupported authoritative context into a safe review fallback.
	 *
	 * @param array<string,mixed> $fallback_response Existing cost fallback response.
	 * @return WP_Error Safe fallback error with canonical navigation DTO.
	 */
	private function get_fallback_error( $fallback_response ) {
		$fallback = isset( $fallback_response['fallback'] ) && is_array( $fallback_response['fallback'] ) ? $fallback_response['fallback'] : null;

		return new WP_Error(
			'wpbc_booking_new_inspector_review_unsupported',
			__( 'This booking must be reviewed on the full Add Booking page.', 'booking' ),
			array( 'status' => 409, 'fallback' => $fallback )
		);
	}
}
