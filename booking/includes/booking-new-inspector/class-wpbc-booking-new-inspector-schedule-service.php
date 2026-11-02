<?php
/**
 * Authorized schedule-read service for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Orchestrates creation-only schedule normalization and native calendar reads.
 */
final class WPBC_Booking_New_Inspector_Schedule_Service {

	/** @var object Authorization service. */
	private $authorization;

	/** @var object Schedule request validator. */
	private $request_validator;

	/** @var object Resource repository. */
	private $resource_repository;

	/** @var object Form repository. */
	private $form_repository;

	/** @var object Field mapper used only to enforce unsupported-form fallback. */
	private $field_mapper;

	/** @var object Signed Timeline seed resolver. */
	private $timeline_seed;

	/** @var object Shared Booking schedule syntax normalizer. */
	private $schedule_normalizer;

	/** @var object Creation-specific schedule policy. */
	private $schedule_policy;

	/** @var object Shared native calendar contract builder. */
	private $calendar_builder;

	/**
	 * Construct the service with optional test doubles for every boundary.
	 *
	 * @param object|null $authorization       Authorization service.
	 * @param object|null $request_validator   Schedule request validator.
	 * @param object|null $resource_repository Resource repository.
	 * @param object|null $form_repository     Form repository.
	 * @param object|null $field_mapper        Field DTO mapper.
	 * @param object|null $timeline_seed       Timeline seed resolver.
	 * @param object|null $schedule_normalizer Shared schedule normalizer.
	 * @param object|null $schedule_policy     Creation schedule policy.
	 * @param object|null $calendar_builder    Native calendar builder.
	 */
	public function __construct( $authorization = null, $request_validator = null, $resource_repository = null, $form_repository = null, $field_mapper = null, $timeline_seed = null, $schedule_normalizer = null, $schedule_policy = null, $calendar_builder = null ) {
		$this->authorization       = $authorization ? $authorization : new WPBC_Booking_New_Inspector_Authorization();
		$this->request_validator   = $request_validator ? $request_validator : new WPBC_Booking_New_Inspector_Schedule_Request_Validator();
		$this->resource_repository = $resource_repository ? $resource_repository : new WPBC_Booking_New_Inspector_Resource_Repository();
		$this->form_repository     = $form_repository ? $form_repository : new WPBC_Booking_New_Inspector_Form_Repository();
		$this->field_mapper        = $field_mapper ? $field_mapper : new WPBC_Booking_New_Inspector_Field_DTO_Mapper();
		$this->timeline_seed       = $timeline_seed ? $timeline_seed : new WPBC_Booking_New_Inspector_Timeline_Seed();
		$this->schedule_normalizer = $schedule_normalizer ? $schedule_normalizer : new WPBC_Booking_Schedule_Proposal_Normalizer();
		$this->schedule_policy     = $schedule_policy ? $schedule_policy : new WPBC_Booking_New_Inspector_Schedule_Policy();
		$this->calendar_builder    = $calendar_builder ? $calendar_builder : new WPBC_Booking_Native_Calendar_Contract_Builder();
	}

	/**
	 * Build one authorized, non-mutating creation schedule response.
	 *
	 * Timeline requests always regenerate their exact draft from the verified
	 * signed seed. Browser-supplied schedule values cannot override that source.
	 * Direct requests may carry one bounded syntax-only draft; availability is
	 * loaded independently by the native calendar and remains authoritative.
	 *
	 * @param mixed $request_values Untrusted schedule request values.
	 * @return array<string,mixed>|WP_Error Schedule response or safe error.
	 */
	public function get_schedule( $request_values ) {
		if ( ! $this->authorization->current_user_can_bootstrap() ) {
			return $this->authorization->get_forbidden_error();
		}

		$request = $this->request_validator->validate( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}
		if ( 'timeline' === $request['selection_source'] && null !== $request['schedule'] ) {
			return $this->get_invalid_schedule_error();
		}

		$seed = $this->timeline_seed->resolve( $request );
		if ( is_wp_error( $seed ) ) {
			return $seed;
		}
		if (
			! empty( $seed['resource_id'] )
			&& absint( $seed['resource_id'] ) !== absint( $request['resource_id'] )
		) {
			return $this->get_context_mismatch_error();
		}
		if ( ! empty( $seed['form_id'] ) && (string) $seed['form_id'] !== (string) $request['form_id'] ) {
			return $this->get_context_mismatch_error();
		}

		$resources = $this->resource_repository->get_authorized_resources();
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		$selected_resource = $this->find_record( $resources, $request['resource_id'] );
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
		$selected_form = $this->find_record( $forms, $request['form_id'] );
		if ( empty( $selected_form ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_form_not_authorized',
				__( 'The requested Booking Form was not found.', 'booking' ),
				array( 'status' => 404 )
			);
		}

		$form_source     = sanitize_key( (string) $selected_form['source'] );
		$form_projection = $this->field_mapper->map_form( $selected_form['definition'], absint( $selected_resource['id'] ), $form_source );
		if ( empty( $form_projection['support']['creation_allowed'] ) ) {
			return new WP_Error(
				'wpbc_booking_new_inspector_form_unsupported',
				__( 'This Booking Form must be completed on the full Add Booking page.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$form_contract = method_exists( $this->field_mapper, 'resolve_form_contract' )
			? $this->field_mapper->resolve_form_contract( $selected_form['definition'], absint( $selected_resource['id'] ), $form_source )
			: array();
		$schedule_fields = isset( $form_contract['schedule_fields'] ) && is_array( $form_contract['schedule_fields'] )
			? $form_contract['schedule_fields']
			: array();
		$choices         = $this->schedule_policy->get_choices( $form_source, $schedule_fields );
		$schedule        = $this->build_schedule_draft( $request, $seed, $choices );
		if ( is_wp_error( $schedule ) ) {
			return $schedule;
		}

		$calendar = $this->calendar_builder->build(
			absint( $selected_resource['id'] ),
			'',
			(string) $selected_form['id'],
			$schedule['selected_dates'],
			$request['calendar_anchor_date']
		);

		return array(
			'schema_version' => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
			'component_id'   => WPBC_Booking_New_Inspector_Config::COMPONENT_ID,
			'state'          => WPBC_Booking_New_Inspector_Contract::STATE_EDITING,
			'request_id'     => $request['request_id'],
			'resource_id'    => absint( $selected_resource['id'] ),
			'form_id'        => substr( sanitize_text_field( (string) $selected_form['id'] ), 0, 191 ),
			'form_source'    => $form_source,
			'schedule'       => $schedule,
			'choices'        => $choices,
			'calendar'       => $calendar,
		);
	}

	/**
	 * Resolve the exact creation draft from Timeline or direct browser context.
	 *
	 * @param array<string,mixed> $request Validated request.
	 * @param array<string,mixed> $seed    Verified Timeline or empty seed.
	 * @param array<string,mixed> $choices Authorized choice DTOs.
	 * @return array<string,mixed>|WP_Error Creation draft or safe error.
	 */
	private function build_schedule_draft( $request, $seed, $choices ) {
		if ( 'timeline' === $request['selection_source'] ) {
			$timeline_schedule = isset( $seed['schedule'] ) && is_array( $seed['schedule'] ) ? $seed['schedule'] : array();
			$time_application  = 'time_range' === ( isset( $timeline_schedule['mode'] ) ? $timeline_schedule['mode'] : '' ) ? 'boundary' : 'full_day';
			if ( ! $this->schedule_policy->permits_time_application( $time_application, $choices ) ) {
				return $this->get_invalid_schedule_error();
			}
			$proposal = array(
				'selection_method' => $this->schedule_policy->permits_selection_method( 'individual', $choices ) ? 'individual' : 'policy',
				'time_application' => $time_application,
				'selected_dates'   => isset( $timeline_schedule['dates'] ) ? $timeline_schedule['dates'] : array(),
				'start_time'       => 'full_day' === $time_application ? '' : ( isset( $timeline_schedule['start_time'] ) ? $timeline_schedule['start_time'] : '' ),
				'end_time'         => 'full_day' === $time_application ? '' : ( isset( $timeline_schedule['end_time'] ) ? $timeline_schedule['end_time'] : '' ),
			);

			$normalized = $this->schedule_normalizer->normalize( $proposal, WPBC_Booking_New_Inspector_Config::MAX_DATES );
			if ( is_wp_error( $normalized ) ) {
				return $this->get_invalid_schedule_error();
			}

			return $this->decorate_schedule( $normalized, 'timeline', true );
		}

		if ( null === $request['schedule'] || $this->is_neutral_empty_schedule( $request['schedule'] ) ) {
			$default_time_application = $this->schedule_policy->permits_time_application( 'full_day', $choices ) ? 'full_day' : 'boundary';

			return array(
				'selection_method'   => 'policy',
				'time_application'   => $default_time_application,
				'selected_dates'     => array(),
				'start_time'         => '',
				'end_time'           => '',
				'seed_source'        => 'empty',
				'exact_timeline_seed' => false,
			);
		}

		$normalized = $this->schedule_normalizer->normalize( $request['schedule'], WPBC_Booking_New_Inspector_Config::MAX_DATES );
		if ( is_wp_error( $normalized ) ) {
			return $this->get_invalid_schedule_error();
		}
		if (
			! $this->schedule_policy->permits_selection_method( $normalized['selection_method'], $choices )
			|| ! $this->schedule_policy->permits_time_application( $normalized['time_application'], $choices )
		) {
			return $this->get_invalid_schedule_error();
		}

		return $this->decorate_schedule( $normalized, 'draft', false );
	}

	/**
	 * Check for the exact neutral draft emitted by older Inspector runtimes.
	 *
	 * A Resource or form replacement with no selected dates has no schedule
	 * proposal to normalize. Only the complete neutral policy/full-day shape is
	 * accepted here; every other empty or malformed proposal continues through
	 * the strict shared normalizer and fails closed.
	 *
	 * @param mixed $schedule Candidate validated request schedule.
	 * @return bool Whether the schedule is the exact neutral empty draft.
	 */
	private function is_neutral_empty_schedule( $schedule ) {
		$expected_keys = array( 'selection_method', 'time_application', 'selected_dates', 'start_time', 'end_time' );

		return is_array( $schedule )
			&& count( $expected_keys ) === count( $schedule )
			&& ! array_diff( array_keys( $schedule ), $expected_keys )
			&& 'policy' === $schedule['selection_method']
			&& 'full_day' === $schedule['time_application']
			&& array() === $schedule['selected_dates']
			&& '' === $schedule['start_time']
			&& '' === $schedule['end_time'];
	}

	/**
	 * Add immutable provenance fields to a normalized schedule.
	 *
	 * @param array<string,mixed> $schedule            Normalized schedule.
	 * @param string              $seed_source         Stable source identifier.
	 * @param bool                $exact_timeline_seed Whether a signed exact seed was used.
	 * @return array<string,mixed> Decorated creation schedule.
	 */
	private function decorate_schedule( $schedule, $seed_source, $exact_timeline_seed ) {
		$schedule['seed_source']         = $seed_source;
		$schedule['exact_timeline_seed'] = (bool) $exact_timeline_seed;

		return $schedule;
	}

	/**
	 * Find one exact repository record by ID.
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
	 * Return the uniform error for a forged signed-context companion.
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
	 * Return one non-sensitive schedule validation error.
	 *
	 * @return WP_Error Safe schedule error.
	 */
	private function get_invalid_schedule_error() {
		return new WP_Error(
			'wpbc_booking_new_inspector_schedule_invalid',
			__( 'The proposed booking schedule is invalid. Review the selection and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}
}
