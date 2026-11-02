<?php
/**
 * Canonical booking activity mutation integrations.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert a released comma-separated booking selection into unique IDs.
 *
 * @param mixed $booking_ids Booking ID, comma-separated IDs, or an ID array.
 *
 * @return array<int,int> Positive unique booking IDs.
 */
function wpbc_booking_activity_normalize_booking_ids( $booking_ids ) {
	if ( is_string( $booking_ids ) ) {
		$booking_ids = explode( ',', $booking_ids );
	}

	return array_values( array_unique( array_filter( array_map( 'absint', (array) $booking_ids ) ) ) );
}

/**
 * Append one typed event for every booking in a released selection.
 *
 * @param mixed               $booking_ids Booking ID selection.
 * @param string              $event_type  Stable event type.
 * @param array<string,mixed> $payload     Safe event metadata.
 * @param string              $source      Server-owned source identifier.
 *
 * @return void
 */
function wpbc_booking_activity_append_for_bookings( $booking_ids, $event_type, $payload = array(), $source = 'booking' ) {
	$append_service = new WPBC_Booking_Activity_Append_Service();
	foreach ( wpbc_booking_activity_normalize_booking_ids( $booking_ids ) as $booking_id ) {
		$append_service->append( $booking_id, $event_type, $payload, array( 'source' => $source ) );
	}
}

/**
 * Record successful actions emitted by the canonical Booking Listing router.
 *
 * The router action runs after the mutation service returns, so failed actions
 * cannot enter the immutable stream.
 *
 * @param array<string,mixed> $request_params Sanitized canonical request.
 * @param array<string,mixed> $action_result  Mutation result.
 *
 * @return void
 */
function wpbc_booking_activity_capture_listing_action( $request_params, $action_result ) {
	if ( empty( $request_params['booking_action'] ) ) {
		return;
	}
	$action_map = array(
		'set_booking_locale'          => 'booking_locale_changed',
		'set_booking_pending'         => 'booking_set_pending',
		'set_booking_approved'        => 'booking_approved',
		'move_booking_to_trash'       => 'booking_trashed',
		'restore_booking_from_trash'  => 'booking_restored',
		'set_booking_as_read'         => 'booking_marked_read',
		'set_booking_as_unread'       => 'booking_marked_unread',
		'change_booking_resource'     => 'booking_resource_changed',
		'duplicate_booking_to_other_resource' => 'booking_duplicated',
		'send_payment_request'        => 'payment_request_sent',
	);
	$action     = sanitize_key( $request_params['booking_action'] );
	if ( ! isset( $action_map[ $action ] ) ) {
		return;
	}
	$booking_ids = isset( $request_params['booking_id'] ) ? wpbc_booking_activity_normalize_booking_ids( $request_params['booking_id'] ) : array();
	if ( empty( $action_result['after_action_result'] ) ) {
		foreach ( $booking_ids as $booking_id ) {
			$GLOBALS['wpbc_booking_activity_suppressed'][ $booking_id . ':' . $action_map[ $action ] ] = true;
		}
		return;
	}
	$payload = array();
	if ( isset( $request_params['selected_resource_id'] ) ) {
		$payload['resource_id'] = absint( $request_params['selected_resource_id'] );
	}
	if ( isset( $request_params['booking_meta_locale'] ) ) {
		$payload['after'] = sanitize_text_field( $request_params['booking_meta_locale'] );
	}
	wpbc_booking_activity_append_for_bookings( $booking_ids, $action_map[ $action ], $payload );
}

foreach ( array( 'set_booking_locale', 'set_booking_pending', 'set_booking_approved', 'move_booking_to_trash', 'restore_booking_from_trash', 'set_booking_as_read', 'set_booking_as_unread', 'change_booking_resource', 'duplicate_booking_to_other_resource', 'send_payment_request' ) as $wpbc_activity_action ) {
	add_action( 'wpbc_' . $wpbc_activity_action, 'wpbc_booking_activity_capture_listing_action', 20, 2 );
}

/**
 * Record booking creation or canonical date/detail editing after persistence.
 *
 * @param int                 $booking_id           Saved booking ID.
 * @param array<string,mixed> $create_booking_params Canonical creation parameters.
 * @param array<string,mixed> $save_context         Canonical allocation context.
 *
 * @return void
 */
function wpbc_booking_activity_after_booking_save( $booking_id, $create_booking_params, $save_context ) {
	unset( $save_context );
	$is_edit    = ! empty( $create_booking_params['is_edit_booking'] );
	$event_type = $is_edit ? 'booking_dates_updated' : 'booking_created';
	$source     = ! empty( $create_booking_params['sync_gid'] ) ? 'import' : 'booking';
	$event_payload = isset( $create_booking_params['activity_payload'] ) && is_array( $create_booking_params['activity_payload'] )
		? $create_booking_params['activity_payload']
		: array();
	$event_context = array( 'source' => $source );
	if ( isset( $create_booking_params['activity_idempotency_key'] ) && is_scalar( $create_booking_params['activity_idempotency_key'] ) ) {
		$event_context['idempotency_key'] = sanitize_text_field( (string) $create_booking_params['activity_idempotency_key'] );
	}
	( new WPBC_Booking_Activity_Append_Service() )->append( absint( $booking_id ), $event_type, $event_payload, $event_context );
}
add_action( 'wpbc_booking_after_save', 'wpbc_booking_activity_after_booking_save', 30, 3 );

/**
 * Record a successful legacy Private note update without copying note content.
 *
 * @param mixed  $booking_ids Booking ID selection.
 * @param string $private_note Stored Private note (intentionally not logged).
 *
 * @return void
 */
function wpbc_booking_activity_after_private_note_update( $booking_ids, $private_note ) {
	unset( $private_note );
	wpbc_booking_activity_append_for_bookings( $booking_ids, 'private_note_updated' );
}
add_action( 'wpbc_booking_action__note_saved', 'wpbc_booking_activity_after_private_note_update', 20, 2 );

/**
 * Record a successful saved-cost update.
 *
 * @param int   $booking_id Booking ID.
 * @param mixed $new_cost   New stored cost.
 * @param mixed $old_cost   Previous stored cost.
 *
 * @return void
 */
function wpbc_booking_activity_after_cost_update( $booking_id, $new_cost, $old_cost ) {
	wpbc_booking_activity_append_for_bookings( $booking_id, 'booking_cost_updated', array( 'before' => $old_cost, 'after' => $new_cost ) );
}
add_action( 'wpbc_booking_action__set_booking_cost', 'wpbc_booking_activity_after_cost_update', 20, 3 );

/**
 * Record a successful payment-status update.
 *
 * @param int    $booking_id Booking ID.
 * @param string $new_status New payment status.
 * @param string $old_status Previous payment status.
 *
 * @return void
 */
function wpbc_booking_activity_after_payment_status_update( $booking_id, $new_status, $old_status ) {
	wpbc_booking_activity_append_for_bookings( $booking_id, 'payment_status_updated', array( 'before' => $old_status, 'after' => $new_status ), 'payment' );
	$GLOBALS['wpbc_booking_activity_suppressed'][ absint( $booking_id ) . ':payment_response_received' ] = true;
}
add_action( 'wpbc_booking_action__set_payment_status', 'wpbc_booking_activity_after_payment_status_update', 20, 3 );

/**
 * Record the Inspector-only field groups not covered by released hooks.
 *
 * @param int                 $booking_id          Booking ID.
 * @param array<int,string>   $changed_columns     Persisted column names.
 * @param array<string,mixed> $activity_change_set Privacy-aware booking-field changes.
 *
 * @return void
 */
function wpbc_booking_activity_after_inspector_update( $booking_id, $changed_columns, $activity_change_set = array() ) {
	$changed_columns = array_values( array_unique( array_map( 'sanitize_key', (array) $changed_columns ) ) );
	if ( in_array( 'public_note', $changed_columns, true ) ) {
		wpbc_booking_activity_append_for_bookings( $booking_id, 'public_note_updated', array(), 'inspector' );
	}
	$form_columns = array_values( array_diff( $changed_columns, array( 'public_note', 'remark', 'cost', 'pay_status' ) ) );
	if ( $form_columns ) {
		$event_payload = array( 'fields' => $form_columns );
		$change_set    = WPBC_Booking_Activity_Change_Set::normalize( $activity_change_set );
		if ( $change_set ) {
			$event_payload['fields']     = wp_list_pluck( $change_set['changes'], 'field_key' );
			$event_payload['change_set'] = $change_set;
		}
		wpbc_booking_activity_append_for_bookings( $booking_id, 'booking_details_updated', $event_payload, 'inspector' );
	}
}
add_action( 'wpbc_booking_inspector_booking_updated', 'wpbc_booking_activity_after_inspector_update', 20, 3 );

/**
 * Queue a legacy log call for post-request compatibility capture.
 *
 * The message itself is never persisted in the activity table because released
 * log strings can contain URLs, payment responses, or customer information.
 *
 * @param mixed  $booking_ids Booking ID selection.
 * @param string $message     Released log message used only for type inference.
 *
 * @return void
 */
function wpbc_booking_activity_queue_legacy_log( $booking_ids, $message ) {
	$GLOBALS['wpbc_booking_activity_legacy_queue'][] = array(
		'booking_ids' => wpbc_booking_activity_normalize_booking_ids( $booking_ids ),
		'event_type'  => wpbc_booking_activity_infer_legacy_event_type( $message ),
	);
}

/**
 * Infer a safe typed event from a released free-form logging message.
 *
 * @param string $message Released legacy log message.
 *
 * @return string Stable event type.
 */
function wpbc_booking_activity_infer_legacy_event_type( $message ) {
	$message = strtolower( wp_strip_all_tags( (string) $message ) );
	$map     = array(
		'payment request' => 'payment_request_sent',
		'payment'         => 'payment_response_received',
		'cost'            => 'booking_cost_updated',
		'approved'        => 'booking_approved',
		'pending'         => 'booking_set_pending',
		'trash'           => 'booking_trashed',
		'restor'          => 'booking_restored',
		'locale'          => 'booking_locale_changed',
		'resource'        => 'booking_resource_changed',
		'edit'            => 'booking_updated',
	);
	foreach ( $map as $needle => $event_type ) {
		if ( false !== strpos( $message, $needle ) ) {
			return $event_type;
		}
	}

	return 'booking_updated';
}

/**
 * Flush legacy logging only after successful callers finish their request.
 *
 * Events already captured by canonical post-persistence hooks are skipped.
 * Deleted or failed booking mutations are skipped because no canonical booking
 * context remains available at this compatibility boundary.
 *
 * @return void
 */
function wpbc_booking_activity_flush_legacy_logs() {
	$legacy_queue = isset( $GLOBALS['wpbc_booking_activity_legacy_queue'] ) ? (array) $GLOBALS['wpbc_booking_activity_legacy_queue'] : array();
	$repository   = new WPBC_Booking_Activity_Repository();
	$service      = new WPBC_Booking_Activity_Append_Service( $repository );
	foreach ( $legacy_queue as $queued_event ) {
		foreach ( (array) $queued_event['booking_ids'] as $booking_id ) {
			$suppression_key = $booking_id . ':' . $queued_event['event_type'];
			if ( ! $repository->get_booking_context( $booking_id ) || ! empty( $GLOBALS['wpbc_booking_activity_suppressed'][ $suppression_key ] ) || WPBC_Booking_Activity_Append_Service::was_recorded_in_request( $booking_id, $queued_event['event_type'] ) ) {
				continue;
			}
			$service->append( $booking_id, $queued_event['event_type'], array(), array( 'source' => 'legacy' ) );
		}
	}
}
add_action( 'shutdown', 'wpbc_booking_activity_flush_legacy_logs', 20 );
