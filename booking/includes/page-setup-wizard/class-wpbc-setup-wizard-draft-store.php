<?php
/**
 * User-scoped checkpoint persistence for the isolated Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Persist validated wizard progress without owning domain mutations.
 */
final class WPBC_Setup_Wizard_Draft_Store implements WPBC_Setup_Wizard_Checkpoint_Store, WPBC_Setup_Wizard_Email_State_Store {

	/** Current normalized checkpoint schema. */
	const SCHEMA_VERSION = 21;

	/** @var WPBC_Setup_Wizard_Step_Registry */
	private $step_registry;

	/** @var WPBC_Setup_Wizard_Draft_Validator */
	private $draft_validator;

	/** @var array{real_user_id:int,owner_user_id:int,site_id:int} */
	private $storage_context;

	/**
	 * Build a draft store bound to the current server-owned user and site context.
	 *
	 * @param WPBC_Setup_Wizard_Step_Registry   $step_registry   Ordered step registry.
	 * @param WPBC_Setup_Wizard_Draft_Validator $draft_validator Draft field validator.
	 */
	public function __construct( WPBC_Setup_Wizard_Step_Registry $step_registry, WPBC_Setup_Wizard_Draft_Validator $draft_validator ) {
		$this->step_registry   = $step_registry;
		$this->draft_validator = $draft_validator;
		$this->storage_context = WPBC_Setup_Wizard_Access::get_storage_context();
	}

	/**
	 * Return the context-specific user-option key.
	 *
	 * @return string User-option key isolated by site and effective owner.
	 */
	public function get_option_key() {
		return sprintf(
			'booking_setup_wizard_11_9_draft_%1$d_%2$d',
			$this->storage_context['site_id'],
			$this->storage_context['owner_user_id']
		);
	}

	/**
	 * Return a clean in-memory checkpoint without writing storage.
	 *
	 * @return array<string,mixed> Default navigation draft.
	 */
	public function get_default_draft() {
		$email_status = WPBC_Setup_Wizard_Environment_Policy::allows_summary_email()
			? 'not_requested'
			: 'disabled';

		return array(
			'schema_version'     => self::SCHEMA_VERSION,
			'status'             => 'active',
			'current_step'       => $this->step_registry->get_first_step_id(),
			'completed_steps'    => array(),
			'needs_review_steps' => array(),
			'values'             => array(),
			'step_results'       => array(),
			'revision'           => 0,
			'updated_at'         => '',
			'skipped_at'         => '',
			'completed_at'       => '',
			'email'              => array(
				'requested'          => false,
				'recipient'          => '',
				'status'             => $email_status,
				'operation_id'       => '',
				'summary_fingerprint' => '',
				'attempted_at'        => '',
				'sent_at'             => '',
				'last_error'          => '',
			),
		);
	}

	/**
	 * Load and normalize the current draft without causing a write.
	 *
	 * @return array<string,mixed> Normalized navigation draft.
	 */
	public function load() {
		$stored_draft = get_user_option( $this->get_option_key(), $this->storage_context['real_user_id'] );

		return $this->normalize_draft( is_array( $stored_draft ) ? $stored_draft : array() );
	}

	/**
	 * Return an opaque lock scope for this site, real user, and effective owner.
	 *
	 * @return string Context-specific lock scope.
	 */
	public function get_lock_scope() {
		return sprintf(
			'%1$d:%2$d:%3$d',
			$this->storage_context['site_id'],
			$this->storage_context['real_user_id'],
			$this->storage_context['owner_user_id']
		);
	}

	/**
	 * Return the active server-owned route for one checkpoint.
	 *
	 * @param array<string,mixed> $checkpoint Current normalized checkpoint.
	 *
	 * @return string[] Ordered active step identifiers.
	 */
	public function get_active_step_ids( array $checkpoint ) {
		return $this->step_registry->get_active_step_ids(
			isset( $checkpoint['values'] ) && is_array( $checkpoint['values'] ) ? $checkpoint['values'] : array()
		);
	}

	/**
	 * Navigate backward without validating or merging current form fields.
	 *
	 * Back is deliberately navigation-only. A prior successful save remains
	 * active and unsaved edits on the current page are discarded.
	 *
	 * @param string $client_step_id    Client-observed current step identifier.
	 * @param int    $expected_revision Client-observed checkpoint revision.
	 *
	 * @return array<string,mixed>|WP_Error Updated checkpoint or error.
	 */
	public function navigate_back( $client_step_id, $expected_revision ) {
		$current_draft = $this->load();
		$stale_error   = $this->validate_request_state( $current_draft, $client_step_id, $expected_revision );

		if ( is_wp_error( $stale_error ) ) {
			return $stale_error;
		}

		$target_step_id = $this->step_registry->get_adjacent_step_id( $current_draft['current_step'], 'back', $current_draft['values'] );
		if ( null === $target_step_id ) {
			return new WP_Error( 'wpbc_setup_wizard_navigation_boundary', __( 'There is no available Setup Wizard step in that direction.', 'booking' ) );
		}

		$current_draft['current_step']    = $target_step_id;
		$current_draft['status']          = 'active';
		$current_draft['completed_at']    = '';
		$current_draft['completed_steps'] = $this->step_registry->get_completed_step_ids( $current_draft['current_step'], $current_draft['values'] );
		$current_draft['revision']        = (int) $current_draft['revision'] + 1;
		$current_draft['updated_at']      = current_time( 'mysql', true );

		return $this->save( $current_draft );
	}

	/**
	 * Commit one validated save result and advance to the next route step.
	 *
	 * @param string              $client_step_id    Step being saved.
	 * @param int                 $expected_revision Client-observed revision.
	 * @param array<string,mixed> $validated_fields  Validated step fields.
	 * @param string              $operation_id      Stable idempotency identifier.
	 * @param array<string,mixed> $operation_result  Normalized handler result.
	 * @param bool                $is_terminal       Whether this completes the route.
	 *
	 * @return array<string,mixed>|WP_Error Updated checkpoint or error.
	 */
	public function commit_step_save( $client_step_id, $expected_revision, array $validated_fields, $operation_id, array $operation_result, $is_terminal ) {
		$current_draft = $this->load();
		$stale_error   = $this->validate_request_state( $current_draft, $client_step_id, $expected_revision );
		if ( is_wp_error( $stale_error ) ) {
			return $stale_error;
		}

		$current_values = isset( $current_draft['values'][ $client_step_id ] ) && is_array( $current_draft['values'][ $client_step_id ] )
			? $current_draft['values'][ $client_step_id ]
			: array();
		$merged_values  = array_merge( $current_values, $validated_fields );
		$values_changed = $current_values !== $merged_values;
		$current_draft['values'][ $client_step_id ] = $merged_values;

		$saved_at = current_time( 'mysql', true );
		$current_draft['step_results'][ $client_step_id ] = array_merge(
			$operation_result,
			array(
				'operation_id'     => sanitize_key( (string) $operation_id ),
				'source_revision'  => (int) $expected_revision,
				'saved_at'         => $saved_at,
				'submitted_values' => $validated_fields,
			)
		);
		$active_step_ids     = $this->step_registry->get_active_step_ids( $current_draft['values'] );
		$registered_step_ids = array_keys( $this->step_registry->get_steps() );
		$current_index       = array_search( $client_step_id, $registered_step_ids, true );
		$needs_review        = array_values( array_diff( $current_draft['needs_review_steps'], array( $client_step_id ) ) );
		if ( $values_changed && false !== $current_index ) {
			foreach ( array_slice( $registered_step_ids, $current_index + 1 ) as $dependent_step_id ) {
				if ( isset( $current_draft['step_results'][ $dependent_step_id ] ) ) {
					$needs_review[] = $dependent_step_id;
				}
			}
		}
		$current_draft['needs_review_steps'] = array_values( array_unique( $needs_review ) );

		if ( $is_terminal ) {
			$current_draft['status']          = 'completed';
			$current_draft['completed_steps'] = $active_step_ids;
			$current_draft['completed_at']    = $saved_at;
		} else {
			$target_step_id = $this->step_registry->get_adjacent_step_id( $client_step_id, 'next', $current_draft['values'] );
			if ( null === $target_step_id ) {
				return new WP_Error( 'wpbc_setup_wizard_navigation_boundary', __( 'There is no available Setup Wizard step in that direction.', 'booking' ) );
			}

			$current_draft['status']          = 'active';
			$current_draft['current_step']    = $target_step_id;
			$current_draft['completed_steps'] = $this->step_registry->get_completed_step_ids( $target_step_id, $current_draft['values'] );
			$current_draft['completed_at']    = '';
		}

		$current_draft['revision']   = (int) $current_draft['revision'] + 1;
		$current_draft['updated_at'] = $saved_at;

		return $this->save( $current_draft );
	}

	/**
	 * Navigate to one earlier active Setup Wizard step selected by the server.
	 *
	 * The target must be part of the current route and precede the current step.
	 * This lets the journey rail and review actions revisit completed steps without
	 * allowing a client to open inactive branch pages or skip forward.
	 *
	 * @param string $target_step_id    Requested earlier active-route target.
	 * @param string $client_step_id    Client-observed current step.
	 * @param int    $expected_revision Client-observed draft revision.
	 *
	 * @return array<string,mixed>|WP_Error Updated draft or a validation/storage error.
	 */
	public function navigate_to_step( $target_step_id, $client_step_id, $expected_revision ) {
		$current_draft = $this->load();
		$stale_error   = $this->validate_request_state( $current_draft, $client_step_id, $expected_revision );

		if ( is_wp_error( $stale_error ) ) {
			return $stale_error;
		}

		$target_step_id     = sanitize_key( is_scalar( $target_step_id ) ? (string) $target_step_id : '' );
		$active_steps       = $this->step_registry->get_active_step_ids( $current_draft['values'] );
		$current_step_index = array_search( $current_draft['current_step'], $active_steps, true );
		$target_step_index  = array_search( $target_step_id, $active_steps, true );

		if ( false === $current_step_index || false === $target_step_index || $target_step_index >= $current_step_index ) {
			return new WP_Error( 'wpbc_setup_wizard_edit_target_invalid', __( 'That setup step is not available as a completed step in this journey.', 'booking' ) );
		}

		$current_draft['current_step']    = $target_step_id;
		$current_draft['status']          = 'active';
		$current_draft['completed_at']    = '';
		$current_draft['completed_steps'] = $this->step_registry->get_completed_step_ids( $target_step_id, $current_draft['values'] );
		$current_draft['revision']        = (int) $current_draft['revision'] + 1;
		$current_draft['updated_at']      = current_time( 'mysql', true );

		return $this->save( $current_draft );
	}

	/**
	 * Restart wizard navigation and recommendations without rolling back settings.
	 *
	 * Released Setup Wizard completion flags and all canonical settings remain
	 * untouched. The reset starts a new recommendation/navigation pass while
	 * preserving operation evidence, email history, and a monotonic revision.
	 *
	 * @param int $expected_revision Client-observed draft revision.
	 *
	 * @return array<string,mixed>|WP_Error Restarted draft or a validation/storage error.
	 */
	public function restart( $expected_revision ) {
		$current_draft = $this->load();
		$stale_error   = $this->validate_request_state( $current_draft, $current_draft['current_step'], $expected_revision );

		if ( is_wp_error( $stale_error ) ) {
			return $stale_error;
		}

		$restarted_draft                       = $this->get_default_draft();
		$restarted_draft['step_results']       = $current_draft['step_results'];
		$restarted_draft['needs_review_steps'] = array_keys( $current_draft['step_results'] );
		$restarted_draft['email']              = $current_draft['email'];
		$restarted_draft['revision']           = (int) $current_draft['revision'] + 1;
		$restarted_draft['updated_at']         = current_time( 'mysql', true );

		return $this->save( $restarted_draft );
	}

	/**
	 * Complete the wizard while explicitly skipping every remaining active step.
	 *
	 * This transition does not validate or save fields from the current page and
	 * does not perform domain writes. Canonical changes saved by earlier steps
	 * remain active, while the checkpoint becomes terminal so the normal Setup
	 * overview is shown on the next request.
	 *
	 * @param string $client_step_id    Client-observed current step identifier.
	 * @param int    $expected_revision Client-observed draft revision.
	 *
	 * @return array<string,mixed>|WP_Error Completed checkpoint or a validation/storage error.
	 */
	public function complete_with_skipped_steps( $client_step_id, $expected_revision ) {
		$current_draft = $this->load();
		$stale_error   = $this->validate_request_state( $current_draft, $client_step_id, $expected_revision );

		if ( is_wp_error( $stale_error ) ) {
			return $stale_error;
		}

		return $this->save( $this->prepare_skipped_completion( $current_draft ) );
	}

	/**
	 * Build the terminal checkpoint used by Skip Setup Wizard.
	 *
	 * The active route is server-owned and may vary by environment and selected
	 * Customer Journey. Resolving that route here prevents the browser from
	 * claiming completion for inactive branch steps.
	 *
	 * @param array<string,mixed> $current_draft Current normalized checkpoint.
	 *
	 * @return array<string,mixed> Terminal checkpoint ready for persistence.
	 */
	private function prepare_skipped_completion( array $current_draft ) {
		$completed_at    = current_time( 'mysql', true );
		$active_step_ids = $this->step_registry->get_active_step_ids( $current_draft['values'] );

		$current_draft['status']             = 'completed';
		$current_draft['current_step']       = (string) end( $active_step_ids );
		$current_draft['completed_steps']    = $active_step_ids;
		$current_draft['needs_review_steps'] = array();
		$current_draft['skipped_at']         = $completed_at;
		$current_draft['completed_at']       = $completed_at;
		$current_draft['updated_at']         = $completed_at;
		$current_draft['revision']           = (int) $current_draft['revision'] + 1;

		return $current_draft;
	}

	/**
	 * Persist Review-page summary-email metadata against an expected revision.
	 *
	 * Email delivery is intentionally owned by the Review module. This method is
	 * only the user-, site-, and owner-scoped persistence boundary required to
	 * record pending, sent, or failed delivery without exposing the complete
	 * checkpoint write implementation.
	 *
	 * @param array<string,mixed> $email_state       New summary-email metadata.
	 * @param int                 $expected_revision Checkpoint revision observed by the sender.
	 *
	 * @return array<string,mixed>|WP_Error Updated checkpoint or a stale/storage error.
	 */
	public function update_email_state( array $email_state, $expected_revision ) {
		$current_draft = $this->load();
		if ( (int) $current_draft['revision'] !== (int) $expected_revision ) {
			return new WP_Error( 'wpbc_setup_wizard_email_stale_revision', __( 'The Setup Wizard state changed in another request. Reload the page and try again.', 'booking' ) );
		}

		$current_draft['email']      = $this->normalize_email_state( $email_state );
		$current_draft['revision']   = (int) $current_draft['revision'] + 1;
		$current_draft['updated_at'] = current_time( 'mysql', true );

		return $this->save( $current_draft );
	}

	/**
	 * Normalize stored draft fields against server-owned contracts.
	 *
	 * @param array<string,mixed> $stored_draft Stored draft candidate.
	 *
	 * @return array<string,mixed> Normalized draft.
	 */
	private function normalize_draft( array $stored_draft ) {
		$default_draft          = $this->get_default_draft();
		$stored_schema_version = isset( $stored_draft['schema_version'] ) && is_scalar( $stored_draft['schema_version'] )
			? absint( $stored_draft['schema_version'] )
			: 0;
		$normalized_values      = $this->draft_validator->normalize_stored_values(
			isset( $stored_draft['values'] ) && is_array( $stored_draft['values'] ) ? $stored_draft['values'] : array(),
			array_keys( $this->step_registry->get_steps() )
		);
		$stored_current_step = isset( $stored_draft['current_step'] ) && is_scalar( $stored_draft['current_step'] )
			? sanitize_key( (string) $stored_draft['current_step'] )
			: '';
		$stored_journey      = isset( $normalized_values['customer_journey']['customer_journey'] )
			? (string) $normalized_values['customer_journey']['customer_journey']
			: '';

		/*
		 * Schema 4 placed Days Off before Guided Services and Working Hours. Move
		 * an unfinished legacy draft to its first missing prerequisite so the
		 * reordered route cannot be bypassed after an upgrade.
		 */
		if ( 5 > $stored_schema_version && 'guided_appointment_flow' === $stored_journey && 'days_off' === $stored_current_step ) {
			if ( empty( $normalized_values['services'] ) ) {
				$stored_current_step = 'services';
			} elseif ( empty( $normalized_values['working_hours'] ) ) {
				$stored_current_step = 'working_hours';
			}
		}

		/*
		 * Schema 6 placed Appearance before Booking Form. Route an unfinished
		 * Guided draft to its first missing prerequisite after the order changed.
		 */
		if (
			7 > $stored_schema_version
			&& 'guided_appointment_flow' === $stored_journey
			&& 'appearance' === $stored_current_step
			&& empty( $normalized_values['booking_form_template'] )
		) {
			$stored_current_step = 'booking_form_template';
		}

		/*
		 * Schema 8 inserts Date Selection immediately after Customer Journey.
		 * Return unfinished drafts that had already passed that boundary to the
		 * new prerequisite once, without overwriting any previously saved values.
		 */
		if (
			8 > $stored_schema_version
			&& empty( $normalized_values['date_selection'] )
			&& in_array( $stored_current_step, array( 'services', 'working_hours', 'days_off', 'booking_form_template', 'appearance' ), true )
		) {
			$stored_current_step = 'date_selection';
		}

		/*
		 * Schema 9 appends the draft-only Publish & integrate page. Existing
		 * unfinished drafts stay on their current step and reach it naturally.
		 */

		/*
		 * Schema 10 appends Review Setup. Existing drafts retain their current
		 * page and reach the new revalidation boundary through normal navigation.
		 */

		/*
		 * Schema 11 introduces progressive-save metadata. A schema 10 `reviewed`
		 * flag represented draft approval only, so it must not be promoted to a
		 * completed or applied checkpoint. Preserve validated values and require
		 * those previously visited steps to be reviewed at the new save boundary.
		 */

		/*
		 * Schema 12 records a Review-summary fingerprint and attempt timestamp.
		 * Older normalized email fields remain valid; the first eligible Review
		 * opening creates the new idempotency metadata without migrating options.
		 */

		/*
		 * Schema 14 removes Services from the `start_end_time` route. An unfinished
		 * schema-13 draft left on Services moves to Start & End Times. Older drafts
		 * that already passed this new prerequisite return there only when no time
		 * choices exist. Completed setups remain completed and open Setup Overview.
		 */
		if (
			14 > $stored_schema_version
			&& 'start_end_time' === $stored_journey
			&& 'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
			&& (
				'services' === $stored_current_step
				|| (
					empty( $normalized_values['start_end_times'] )
					&& in_array( $stored_current_step, array( 'days_off', 'publish_integration', 'review_setup' ), true )
				)
			)
		) {
			$stored_current_step = 'start_end_times';
		}

		/*
		 * Schema 15 gives every time-configured journey the complete scheduling,
		 * form, appearance, publishing, and review route. Move an unfinished older
		 * checkpoint to its first missing prerequisite only when it had already
		 * reached or passed that prerequisite. Saved values are never replaced.
		 */
		if (
			15 > $stored_schema_version
			&& WPBC_Setup_Wizard_Customer_Journey_Policy::uses_time_configuration( $stored_journey )
			&& 'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
		) {
			$prerequisites_by_current_step = array(
				'services'              => array( 'start_end_times' ),
				'working_hours'         => array( 'start_end_times' ),
				'days_off'              => array( 'start_end_times', 'working_hours' ),
				'booking_form_template' => array( 'start_end_times', 'working_hours' ),
				'appearance'            => array( 'start_end_times', 'working_hours', 'booking_form_template' ),
				'publish_integration'   => array( 'start_end_times', 'working_hours', 'booking_form_template', 'appearance' ),
				'review_setup'          => array( 'start_end_times', 'working_hours', 'booking_form_template', 'appearance' ),
			);
			$required_steps = isset( $prerequisites_by_current_step[ $stored_current_step ] )
				? $prerequisites_by_current_step[ $stored_current_step ]
				: array();
			foreach ( $required_steps as $required_step_id ) {
				if ( empty( $normalized_values[ $required_step_id ] ) ) {
					$stored_current_step = $required_step_id;
					break;
				}
			}
		}

		/*
		 * Schema 16 separates Start Time + Duration from the former shared
		 * Start/End checkpoint. Preserve any validated start-time ordering from
		 * that legacy proposal, seed only the previously missing duration list,
		 * and return unfinished drafts that passed the boundary to the new step.
		 * Completed setups remain completed and continue to Setup Overview.
		 */
		if ( 16 > $stored_schema_version && WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_duration_configuration( $stored_journey ) ) {
			if ( empty( $normalized_values['start_duration_times']['start_duration_times'] ) ) {
				$start_duration_service = new WPBC_Setup_Wizard_Start_Duration_Times();
				$migrated_time_choices  = $start_duration_service->get_initial_start_duration_times();
				$legacy_start_times     = isset( $normalized_values['start_end_times']['start_end_times']['start_times'] )
					? $normalized_values['start_end_times']['start_end_times']['start_times']
					: array();
				$legacy_proposal        = $start_duration_service->validate_start_duration_times(
					array(
						'start_times'    => $legacy_start_times,
						'duration_times' => $migrated_time_choices['duration_times'],
					),
					true
				);
				if ( ! is_wp_error( $legacy_proposal ) ) {
					$migrated_time_choices = $legacy_proposal;
				}
				$normalized_values['start_duration_times'] = array(
					'start_duration_times' => $migrated_time_choices,
				);
			}

			if (
				'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
				&& in_array( $stored_current_step, array( 'start_end_times', 'working_hours', 'days_off', 'booking_form_template', 'appearance', 'publish_integration', 'review_setup' ), true )
			) {
				$stored_current_step = 'start_duration_times';
			}
		}

		/*
		 * Schema 17 separates Fixed Time Slots from the former independent
		 * Start/End proposal. Convert equal-length valid legacy lists to explicit
		 * slot pairs; otherwise use the preferred template's safe defaults. Return
		 * unfinished drafts that passed the boundary to the new dedicated step.
		 */
		if ( 17 > $stored_schema_version && WPBC_Setup_Wizard_Customer_Journey_Policy::uses_fixed_time_slots_configuration( $stored_journey ) ) {
			if ( empty( $normalized_values['fixed_time_slots']['fixed_time_slots'] ) ) {
				$fixed_slots_service = new WPBC_Setup_Wizard_Fixed_Time_Slots();
				$migrated_slots      = $fixed_slots_service->get_initial_fixed_time_slots();
				$legacy_start_times  = isset( $normalized_values['start_end_times']['start_end_times']['start_times'] )
					? $normalized_values['start_end_times']['start_end_times']['start_times']
					: array();
				$legacy_end_times    = isset( $normalized_values['start_end_times']['start_end_times']['end_times'] )
					? $normalized_values['start_end_times']['start_end_times']['end_times']
					: array();
				$legacy_slots        = $fixed_slots_service->create_slots_from_time_lists( $legacy_start_times, $legacy_end_times );
				if ( ! is_wp_error( $legacy_slots ) ) {
					$migrated_slots = $legacy_slots;
				}
				$normalized_values['fixed_time_slots'] = array(
					'fixed_time_slots' => $migrated_slots,
				);
			}

			if (
				'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
				&& in_array( $stored_current_step, array( 'start_end_times', 'working_hours', 'days_off', 'booking_form_template', 'appearance', 'publish_integration', 'review_setup' ), true )
			) {
				$stored_current_step = 'fixed_time_slots';
			}
		}

		/*
		 * Schema 18 inserts Booking Resources after Date Selection for Single Full
		 * Day. Return unfinished drafts that already passed this boundary to the new
		 * prerequisite. Completed setup remains completed and existing canonical
		 * Resources are never duplicated or changed by migration.
		 */
		if (
			18 > $stored_schema_version
			&& 'single_full_day' === $stored_journey
			&& 'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
			&& in_array( $stored_current_step, array( 'days_off', 'publish_integration', 'review_setup' ), true )
		) {
			$stored_current_step = 'booking_resources';
		}

		/*
		 * Schema 19 gives every supported full-day and date-range journey the same
		 * complete resource route. Return unfinished checkpoints that already passed
		 * a newly required boundary to their first missing prerequisite. Completed
		 * setups remain completed, and saved Resource, form, and appearance values are
		 * preserved without repeating their canonical writes.
		 */
		if (
			19 > $stored_schema_version
			&& WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_resources_configuration( $stored_journey )
			&& 'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
		) {
			$prerequisites_by_current_step = array(
				'days_off'              => array( 'booking_resources' ),
				'booking_form_template' => array( 'booking_resources' ),
				'appearance'            => array( 'booking_resources', 'booking_form_template' ),
				'publish_integration'   => array( 'booking_resources', 'booking_form_template', 'appearance' ),
				'review_setup'          => array( 'booking_resources', 'booking_form_template', 'appearance' ),
			);
			$required_steps = isset( $prerequisites_by_current_step[ $stored_current_step ] )
				? $prerequisites_by_current_step[ $stored_current_step ]
				: array();

			foreach ( $required_steps as $required_step_id ) {
				if ( empty( $normalized_values[ $required_step_id ] ) ) {
					$stored_current_step = $required_step_id;
					break;
				}
			}
		}

		/*
		 * Schema 20 gives both multi-date timed journeys the complete Start/End,
		 * Booking Form, and Appearance route. Repeat bookings also require Working
		 * Hours, while the First-date boundary-time route added by schema 21 does
		 * not. Return unfinished checkpoints to their first missing prerequisite
		 * without replacing already saved values or canonical data.
		 */
		if (
			20 > $stored_schema_version
			&& in_array( $stored_journey, array( 'repeated_time_multiple_dates', 'first_start_last_end' ), true )
			&& 'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
		) {
			$time_prerequisites = array( 'start_end_times' );
			if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_working_hours_configuration( $stored_journey ) ) {
				$time_prerequisites[] = 'working_hours';
			}
			$prerequisites_by_current_step = array(
				'days_off'              => $time_prerequisites,
				'booking_form_template' => $time_prerequisites,
				'appearance'            => array_merge( $time_prerequisites, array( 'booking_form_template' ) ),
				'publish_integration'   => array_merge( $time_prerequisites, array( 'booking_form_template', 'appearance' ) ),
				'review_setup'          => array_merge( $time_prerequisites, array( 'booking_form_template', 'appearance' ) ),
			);
			$required_steps = isset( $prerequisites_by_current_step[ $stored_current_step ] )
				? $prerequisites_by_current_step[ $stored_current_step ]
				: array();

			foreach ( $required_steps as $required_step_id ) {
				if ( empty( $normalized_values[ $required_step_id ] ) ) {
					$stored_current_step = $required_step_id;
					break;
				}
			}
		}

		/*
		 * Schema 21 removes Working Hours from First-date start and last-date end.
		 * Continue an unfinished checkpoint parked on the removed page at Days Off.
		 * Previously saved Working Hours values remain available to other journeys;
		 * normalization does not mutate canonical availability settings.
		 */
		if (
			21 > $stored_schema_version
			&& 'first_start_last_end' === $stored_journey
			&& 'completed' !== ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' )
			&& 'working_hours' === $stored_current_step
		) {
			$stored_current_step = 'days_off';
		}

		$current_step_id = $this->step_registry->normalize_step_id(
			$stored_current_step,
			$normalized_values
		);
		$status = isset( $stored_draft['status'] ) && in_array( $stored_draft['status'], array( 'active', 'skipped', 'completed' ), true )
			? $stored_draft['status']
			: 'active';
		if ( self::SCHEMA_VERSION > $stored_schema_version && 'reviewed' === ( isset( $stored_draft['status'] ) ? $stored_draft['status'] : '' ) ) {
			$status = 'active';
		}

		$active_step_ids     = $this->step_registry->get_active_step_ids( $normalized_values );
		$registered_step_ids = array_keys( $this->step_registry->get_steps() );
		$normalized_results = $this->normalize_step_results(
			isset( $stored_draft['step_results'] ) && is_array( $stored_draft['step_results'] ) ? $stored_draft['step_results'] : array(),
			$registered_step_ids
		);
		$needs_review_steps = $this->normalize_step_ids(
			isset( $stored_draft['needs_review_steps'] ) && is_array( $stored_draft['needs_review_steps'] ) ? $stored_draft['needs_review_steps'] : array(),
			$registered_step_ids
		);
		if ( self::SCHEMA_VERSION > $stored_schema_version ) {
			$legacy_completed_steps = $this->step_registry->get_completed_step_ids( $current_step_id, $normalized_values );
			$legacy_value_steps     = $this->normalize_step_ids( array_keys( $normalized_values ), $registered_step_ids );
			$legacy_result_steps    = $this->normalize_step_ids( array_keys( $normalized_results ), $registered_step_ids );
			$needs_review_steps     = array_values( array_unique( array_merge( $needs_review_steps, $legacy_completed_steps, $legacy_value_steps, $legacy_result_steps ) ) );
		}

		$completed_at = isset( $stored_draft['completed_at'] ) && is_string( $stored_draft['completed_at'] )
			? sanitize_text_field( $stored_draft['completed_at'] )
			: '';
		if ( 'completed' !== $status || '' === $completed_at ) {
			$status       = 'completed' === $status ? 'active' : $status;
			$completed_at = '';
		}
		$completed_steps = 'completed' === $status
			? $active_step_ids
			: $this->step_registry->get_completed_step_ids( $current_step_id, $normalized_values );

		return array(
			'schema_version'     => self::SCHEMA_VERSION,
			'status'             => $status,
			'current_step'       => $current_step_id,
			'completed_steps'    => $completed_steps,
			'needs_review_steps' => $needs_review_steps,
			'values'             => $normalized_values,
			'step_results'       => $normalized_results,
			'revision'           => isset( $stored_draft['revision'] ) ? max( 0, absint( $stored_draft['revision'] ) ) : $default_draft['revision'],
			'updated_at'         => isset( $stored_draft['updated_at'] ) && is_string( $stored_draft['updated_at'] ) ? sanitize_text_field( $stored_draft['updated_at'] ) : '',
			'skipped_at'         => isset( $stored_draft['skipped_at'] ) && is_string( $stored_draft['skipped_at'] ) ? sanitize_text_field( $stored_draft['skipped_at'] ) : '',
			'completed_at'       => $completed_at,
			'email'              => $this->normalize_email_state( isset( $stored_draft['email'] ) ? $stored_draft['email'] : array() ),
		);
	}

	/**
	 * Normalize stored step identifiers against one server-owned allow-list.
	 *
	 * @param mixed    $step_ids       Stored step identifier list.
	 * @param string[] $allowed_step_ids Allowed step identifiers.
	 *
	 * @return string[] Unique ordered allowed step identifiers.
	 */
	private function normalize_step_ids( $step_ids, array $allowed_step_ids ) {
		$normalized_step_ids = array();
		foreach ( is_array( $step_ids ) ? $step_ids : array() as $step_id ) {
			$step_id = sanitize_key( is_scalar( $step_id ) ? (string) $step_id : '' );
			if ( in_array( $step_id, $allowed_step_ids, true ) && ! in_array( $step_id, $normalized_step_ids, true ) ) {
				$normalized_step_ids[] = $step_id;
			}
		}

		return $normalized_step_ids;
	}

	/**
	 * Normalize bounded progressive-save results for registered steps.
	 *
	 * Results from an inactive route branch remain available as historical
	 * metadata. Changing Customer Journey recommendations must not imply that a
	 * canonical record created by a later domain handler was removed.
	 *
	 * @param array<string,mixed> $step_results       Stored result candidates.
	 * @param string[]            $registered_step_ids Registered step identifiers.
	 *
	 * @return array<string,array<string,mixed>> Normalized results keyed by step.
	 */
	private function normalize_step_results( array $step_results, array $registered_step_ids ) {
		$normalized_results = array();
		foreach ( $registered_step_ids as $step_id ) {
			if ( empty( $step_results[ $step_id ] ) || ! is_array( $step_results[ $step_id ] ) ) {
				continue;
			}
			$step_result = $step_results[ $step_id ];
			if ( 'saved' !== ( isset( $step_result['status'] ) ? $step_result['status'] : '' ) ) {
				continue;
			}
			$normalized_submitted_values = $this->draft_validator->normalize_stored_values(
				array(
					$step_id => isset( $step_result['submitted_values'] ) && is_array( $step_result['submitted_values'] )
						? $step_result['submitted_values']
						: array(),
				),
				array( $step_id )
			);

			$normalized_results[ $step_id ] = array(
				'status'                    => 'saved',
				'operation_id'              => isset( $step_result['operation_id'] ) ? sanitize_key( (string) $step_result['operation_id'] ) : '',
				'source_revision'           => isset( $step_result['source_revision'] ) ? max( 0, absint( $step_result['source_revision'] ) ) : 0,
				'saved_at'                  => isset( $step_result['saved_at'] ) ? sanitize_text_field( (string) $step_result['saved_at'] ) : '',
				'summary'                   => isset( $step_result['summary'] ) ? sanitize_text_field( (string) $step_result['summary'] ) : '',
				'canonical_fingerprint'     => isset( $step_result['canonical_fingerprint'] ) ? sanitize_text_field( (string) $step_result['canonical_fingerprint'] ) : '',
				'created_ids'               => $this->normalize_scalar_list( isset( $step_result['created_ids'] ) ? $step_result['created_ids'] : array(), 100 ),
				'updated_ids'               => $this->normalize_scalar_list( isset( $step_result['updated_ids'] ) ? $step_result['updated_ids'] : array(), 100 ),
				'warnings'                  => $this->normalize_scalar_list( isset( $step_result['warnings'] ) ? $step_result['warnings'] : array(), 20 ),
				'writes_canonical_settings' => ! empty( $step_result['writes_canonical_settings'] ),
				'submitted_values'          => isset( $normalized_submitted_values[ $step_id ] ) ? $normalized_submitted_values[ $step_id ] : array(),
			);
		}

		return $normalized_results;
	}

	/**
	 * Normalize a bounded scalar list used by checkpoint metadata.
	 *
	 * @param mixed $values Stored values.
	 * @param int   $limit  Maximum retained records.
	 *
	 * @return array<int,int|string> Normalized scalar values.
	 */
	private function normalize_scalar_list( $values, $limit ) {
		$normalized_values = array();
		foreach ( is_array( $values ) ? array_slice( $values, 0, $limit ) : array() as $stored_value ) {
			if ( is_int( $stored_value ) ) {
				$normalized_values[] = $stored_value;
			} elseif ( is_scalar( $stored_value ) && '' !== trim( (string) $stored_value ) ) {
				$normalized_values[] = sanitize_text_field( (string) $stored_value );
			}
		}

		return $normalized_values;
	}

	/**
	 * Normalize optional final-summary email state without sending email.
	 *
	 * Live demos and WordPress Playground omit Business details. In those
	 * environments any stored request, recipient, operation, or failure state is
	 * discarded so a stale checkpoint cannot enable a later summary sender.
	 *
	 * @param mixed $email_state Stored email-state candidate.
	 *
	 * @return array<string,mixed> Normalized email metadata.
	 */
	private function normalize_email_state( $email_state ) {
		if ( ! WPBC_Setup_Wizard_Environment_Policy::allows_summary_email() ) {
			return array(
				'requested'          => false,
				'recipient'          => '',
				'status'             => 'disabled',
				'operation_id'       => '',
				'summary_fingerprint' => '',
				'attempted_at'        => '',
				'sent_at'             => '',
				'last_error'          => '',
			);
		}

		$email_state = is_array( $email_state ) ? $email_state : array();
		$status      = isset( $email_state['status'] ) && in_array( $email_state['status'], array( 'not_requested', 'pending', 'sent', 'failed' ), true )
			? $email_state['status']
			: 'not_requested';

		return array(
			'requested'          => ! empty( $email_state['requested'] ),
			'recipient'          => isset( $email_state['recipient'] ) ? sanitize_email( (string) $email_state['recipient'] ) : '',
			'status'             => $status,
			'operation_id'       => isset( $email_state['operation_id'] ) ? sanitize_key( (string) $email_state['operation_id'] ) : '',
			'summary_fingerprint' => isset( $email_state['summary_fingerprint'] ) && is_string( $email_state['summary_fingerprint'] ) && 1 === preg_match( '/^[a-f0-9]{64}$/', $email_state['summary_fingerprint'] ) ? $email_state['summary_fingerprint'] : '',
			'attempted_at'        => isset( $email_state['attempted_at'] ) ? sanitize_text_field( (string) $email_state['attempted_at'] ) : '',
			'sent_at'             => isset( $email_state['sent_at'] ) ? sanitize_text_field( (string) $email_state['sent_at'] ) : '',
			'last_error'          => isset( $email_state['last_error'] ) ? sanitize_text_field( (string) $email_state['last_error'] ) : '',
		);
	}

	/**
	 * Reject stale navigation requests before any draft write.
	 *
	 * @param array<string,mixed> $current_draft     Current normalized draft.
	 * @param string              $client_step_id    Client-observed step identifier.
	 * @param int                 $expected_revision Client-observed revision.
	 *
	 * @return true|WP_Error True when current, otherwise a stale-state error.
	 */
	public function validate_request_state( array $current_draft, $client_step_id, $expected_revision ) {
		if ( (int) $current_draft['revision'] !== (int) $expected_revision ) {
			return new WP_Error( 'wpbc_setup_wizard_stale_revision', __( 'The Setup Wizard checkpoint changed in another request. Reload the page and try again.', 'booking' ) );
		}

		$client_step_id = sanitize_key( is_scalar( $client_step_id ) ? (string) $client_step_id : '' );
		if ( null === $this->step_registry->get_step( $client_step_id ) || $current_draft['current_step'] !== $client_step_id ) {
			return new WP_Error( 'wpbc_setup_wizard_stale_step', __( 'The Setup Wizard step changed in another request. Reload the page and try again.', 'booking' ) );
		}

		return true;
	}

	/**
	 * Persist one normalized draft and verify ambiguous WordPress false returns.
	 *
	 * @param array<string,mixed> $draft Draft to persist.
	 *
	 * @return array<string,mixed>|WP_Error Normalized saved draft or storage error.
	 */
	private function save( array $draft ) {
		$draft = $this->normalize_draft( $draft );
		$saved = update_user_option( $this->storage_context['real_user_id'], $this->get_option_key(), $draft );

		if ( false === $saved ) {
			$stored_draft = get_user_option( $this->get_option_key(), $this->storage_context['real_user_id'] );
			if ( ! is_array( $stored_draft ) || $draft !== $this->normalize_draft( $stored_draft ) ) {
				return new WP_Error( 'wpbc_setup_wizard_save_failed', __( 'The Setup Wizard checkpoint could not be saved.', 'booking' ) );
			}
		}

		return $draft;
	}
}
