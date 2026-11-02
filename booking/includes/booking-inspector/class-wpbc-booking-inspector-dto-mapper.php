<?php
/**
 * Booking Inspector browser DTO mapper.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map internal booking records to explicit JSON-safe read models.
 */
final class WPBC_Booking_Inspector_DTO_Mapper {

	/** @var WPBC_Booking_Inspector_Form_Field_Resolver Form projection service. */
	private $form_field_resolver;

	/** @var WPBC_Booking_Inspector_Notes_Projection Notes projection service. */
	private $notes_projection;

	/** @var WPBC_Booking_Inspector_Date_Projection Date projection service. */
	private $date_projection;

	/** @var WPBC_Booking_Inspector_Resource_Projection Resource projection service. */
	private $resource_projection;

	/** @var WPBC_Booking_Inspector_Cost_Projection Cost projection service. */
	private $cost_projection;

	/**
	 * Construct the mapper with focused projection collaborators.
	 *
	 * @param WPBC_Booking_Inspector_Form_Field_Resolver|null $form_field_resolver Optional form resolver.
	 * @param WPBC_Booking_Inspector_Notes_Projection|null    $notes_projection    Optional notes projection.
	 * @param WPBC_Booking_Inspector_Date_Projection|null     $date_projection     Optional date projection.
	 * @param WPBC_Booking_Inspector_Resource_Projection|null $resource_projection Optional Resource projection.
	 * @param WPBC_Booking_Inspector_Cost_Projection|null     $cost_projection     Optional cost projection.
	 */
	public function __construct(
		$form_field_resolver = null,
		$notes_projection = null,
		$date_projection = null,
		$resource_projection = null,
		$cost_projection = null
	) {
		$this->form_field_resolver = $form_field_resolver ? $form_field_resolver : new WPBC_Booking_Inspector_Form_Field_Resolver();
		$this->notes_projection    = $notes_projection ? $notes_projection : new WPBC_Booking_Inspector_Notes_Projection();
		$this->date_projection     = $date_projection ? $date_projection : new WPBC_Booking_Inspector_Date_Projection();
		$this->resource_projection = $resource_projection ? $resource_projection : new WPBC_Booking_Inspector_Resource_Projection();
		$this->cost_projection     = $cost_projection ? $cost_projection : new WPBC_Booking_Inspector_Cost_Projection();
	}

	/**
	 * Map one authorized internal booking record.
	 *
	 * Raw form/options storage and ownership internals are never returned.
	 *
	 * @param array<string,mixed> $booking                Internal booking record.
	 * @param array<string,mixed> $activity               Canonical activity page.
	 * @param array<int,array<string,mixed>> $date_rows   Canonical date rows.
	 * @param array<int,int>      $effective_resource_ids Authorized effective Resources.
	 * @param array<string,array<string,mixed>> $notes    Canonical normalized note contract.
	 * @param array<int,array<string,int|string>> $action_resource_options Authorized Resource choices for canonical actions.
	 *
	 * @return array<string,mixed>|WP_Error Safe details DTO or a safe projection error.
	 */
	public function map_booking( $booking, $activity = array(), $date_rows = array(), $effective_resource_ids = array(), $notes = array(), $action_resource_options = array() ) {
		$form_projection = $this->form_field_resolver->resolve_booking_fields( $booking );
		$form_key        = isset( $form_projection['form_key'] ) ? sanitize_text_field( (string) $form_projection['form_key'] ) : '';
		$date_projection = $this->date_projection->project( $date_rows );
		$resource_projection = $this->resource_projection->project( $booking, $effective_resource_ids );
		if ( is_wp_error( $resource_projection ) ) {
			return $resource_projection;
		}
		$created_at      = isset( $booking['creation_date'] ) ? sanitize_text_field( (string) $booking['creation_date'] ) : '';
		$last_modified   = isset( $booking['modification_date'] ) ? sanitize_text_field( (string) $booking['modification_date'] ) : '';

		$fields = isset( $form_projection['fields'] ) && is_array( $form_projection['fields'] )
			? $this->normalize_browser_fields( $form_projection['fields'] )
			: array();
		$costs  = $this->cost_projection->project( $booking );

		return array(
			'booking_id'       => isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0,
			'resource_id'      => isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
			'label'            => $this->form_field_resolver->resolve_title( $booking ),
			'status'           => $date_projection['status'],
			'resource'         => $resource_projection,
			'dates'            => $date_projection,
			'costs'            => $costs,
			'fields'           => $fields,
			'customer'         => $this->get_customer_summary( $fields ),
			'notes'            => $this->notes_projection->project( $notes ),
			'activity'         => $this->normalize_activity( $activity ),
			'created_at'       => $created_at,
			'created_label'    => $this->format_database_date_time( $created_at ),
			'last_modified_at' => $last_modified,
			'last_modified_label' => $this->format_database_date_time( $last_modified ),
			'actions'          => $this->get_actions( $booking, $form_key ),
			'action_context'   => $this->get_listing_action_context( $booking, $form_key, $fields, $costs, $notes, $date_projection, $date_rows, $action_resource_options ),
			'fingerprint'      => WPBC_Booking_Inspector_Fingerprint::build( $booking, $notes ),
		);
	}

	/**
	 * Remove server-only storage metadata from browser field DTOs.
	 *
	 * The form projection may carry exact source provenance and a proven legacy
	 * display-companion relationship for apply-time synchronization. Neither is
	 * needed by the browser and neither may become mutation authority there.
	 *
	 * @param array<int,array<string,mixed>> $fields Authorized internal field projections.
	 *
	 * @return array<int,array<string,mixed>> Explicit JSON-safe browser fields.
	 */
	private function normalize_browser_fields( $fields ) {
		$browser_fields = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) ) {
				continue;
			}
			$is_schedule_field = WPBC_Booking_Inspector_Time_Field_Policy::is_schedule_field( $field );
			$field['editable']  = ! $is_schedule_field;
			$field['editing_help'] = $is_schedule_field
				? __( 'Change booking time with Change dates.', 'booking' )
				: '';
			unset( $field['source_type'], $field['storage_companion'] );
			$browser_fields[] = $field;
		}

		return $browser_fields;
	}

	/**
	 * Build the compact customer identity displayed in the static header.
	 *
	 * Field keys come from the exact saved booking-form projection. Aliases are
	 * intentionally narrow so a custom field with an unrelated label is never
	 * guessed to contain personal contact information.
	 *
	 * @param array<int,array<string,mixed>> $fields Authorized booking-form fields.
	 *
	 * @return array<string,string> JSON-safe customer identity.
	 */
	private function get_customer_summary( $fields ) {
		$field_values = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['key'] ) ) {
				continue;
			}

			$field_value = isset( $field['value'] ) ? $field['value'] : '';
			if ( is_array( $field_value ) ) {
				$field_value = implode( ', ', array_map( 'sanitize_text_field', $field_value ) );
			}

			$field_values[ sanitize_key( (string) $field['key'] ) ] = sanitize_text_field( (string) $field_value );
		}

		$first_name = $this->first_field_value( $field_values, array( 'name', 'firstname', 'first_name' ) );
		$last_name  = $this->first_field_value( $field_values, array( 'secondname', 'lastname', 'last_name' ) );
		$full_name  = trim( $first_name . ' ' . $last_name );

		return array(
			'name'  => $full_name,
			'email' => $this->first_field_value( $field_values, array( 'email' ) ),
			'phone' => $this->first_field_value( $field_values, array( 'phone' ) ),
		);
	}

	/**
	 * Return the first non-empty value from an ordered field-key allow list.
	 *
	 * @param array<string,string> $field_values Normalized values keyed by form field.
	 * @param array<int,string>    $field_keys   Ordered accepted keys.
	 *
	 * @return string First non-empty value, or an empty string.
	 */
	private function first_field_value( $field_values, $field_keys ) {
		foreach ( $field_keys as $field_key ) {
			if ( isset( $field_values[ $field_key ] ) && '' !== trim( $field_values[ $field_key ] ) ) {
				return $field_values[ $field_key ];
			}
		}

		return '';
	}

	/**
	 * Build the safe compatibility context consumed by the canonical Listing menu.
	 *
	 * The menu remains generated by the Booking Listing action registry, including
	 * its capability and edition filters. Only the scalar values required by those
	 * established actions cross the Inspector DTO boundary.
	 *
	 * @param array<string,mixed>              $booking   Authorized booking record.
	 * @param string                           $form_key  Exact stored Booking Form key.
	 * @param array<int,array<string,mixed>>   $fields    Authorized form-field projection.
	 * @param array<string,mixed>              $costs     Authorized cost projection.
	 * @param array<string,mixed>              $notes     Canonical notes contract.
	 * @param array<string,mixed>              $dates     Canonical date projection.
	 * @param array<int,array<string,mixed>>   $date_rows Authorized canonical date rows.
	 * @param array<int,array<string,int|string>> $action_resource_options Authorized action Resource choices.
	 *
	 * @return array<string,mixed> JSON-safe Listing action context.
	 */
	private function get_listing_action_context( $booking, $form_key, $fields, $costs, $notes, $dates, $date_rows, $action_resource_options ) {
		$booking_id  = isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0;
		$resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$booking_hash = isset( $booking['hash'] ) ? sanitize_text_field( (string) $booking['hash'] ) : '';
		$private_note = isset( $notes['private']['value'] ) ? sanitize_textarea_field( (string) $notes['private']['value'] ) : '';
		$booking_options = $this->get_listing_booking_options( isset( $booking['booking_options'] ) ? $booking['booking_options'] : '' );
		$custom_form = 'standard' === $form_key ? '' : sanitize_text_field( (string) $form_key );
		$edit_url = function_exists( 'wpbc_get_booking_admin_edit_url' )
			? wpbc_get_booking_admin_edit_url( $resource_id, $booking_hash, $custom_form )
			: '';
		$currency_symbol = function_exists( 'wpbc_get_currency_symbol_for_user' )
			? wpbc_get_currency_symbol_for_user( $resource_id )
			: '';
		$visitor_payment_url = class_exists( 'wpdev_bk_biz_s' ) && function_exists( 'apply_bk_filter' )
			? apply_bk_filter( 'wpdev_booking_set_booking_edit_link_at_email', '[visitorbookingpayurl]', $booking_id )
			: '';
		$short_dates = $this->get_listing_short_dates( $date_rows );
		$form_data   = $this->get_listing_form_data( $fields );
		$form_show   = $this->get_listing_form_summary( $fields );
		$google_calendar_link = function_exists( 'wpbc_booking_do_action__get_google_calendar_link' )
			? wpbc_booking_do_action__get_google_calendar_link(
				array(
					'form_data'   => $form_data,
					'form_show'   => $form_show,
					'dates_short' => $short_dates,
				)
			)
			: '';

		$is_approved = isset( $dates['status']['key'] ) && 'approved' === $dates['status']['key'];

		return array(
			'approved'      => $is_approved ? '1' : '0',
			'short_dates'   => $short_dates,
			'booking_resources' => $this->normalize_action_resource_options( $action_resource_options ),
			'parsed_fields' => array(
				'booking_id'              => $booking_id,
				'resource_id'             => $resource_id,
				'hash'                    => $booking_hash,
				'trash'                   => '0',
				'cost'                    => ! empty( $costs['has_saved_cost'] ) ? sanitize_text_field( (string) $costs['saved_cost'] ) : '',
				'pay_status'              => isset( $costs['payment']['value'] ) ? sanitize_text_field( (string) $costs['payment']['value'] ) : '',
				'currency_symbol'         => wp_kses_post( (string) $currency_symbol ),
				'remark'                  => $private_note,
				'booking_options'         => $booking_options,
				'wpbc_custom_booking_form' => $custom_form,
				'admin_edit_url'          => esc_url_raw( $edit_url ),
				'google_calendar_link'    => esc_url_raw( $google_calendar_link ),
				'visitorbookingpayurl'    => esc_url_raw( $visitor_payment_url ),
			),
		);
	}

	/**
	 * Normalize authorized Resource choices for established Listing dialogs.
	 *
	 * @param array<int,array<string,int|string>> $resource_options Repository Resource choices.
	 *
	 * @return array<int,array<string,int|string>> Stable JSON-safe dialog choices.
	 */
	private function normalize_action_resource_options( $resource_options ) {
		$normalized_options = array();
		foreach ( (array) $resource_options as $resource_option ) {
			$resource_id = isset( $resource_option['booking_type_id'] ) ? absint( $resource_option['booking_type_id'] ) : 0;
			if ( ! $resource_id ) {
				continue;
			}

			$normalized_option = array(
				'booking_type_id' => $resource_id,
				'title'           => isset( $resource_option['title'] ) ? sanitize_text_field( (string) $resource_option['title'] ) : '',
			);
			if ( isset( $resource_option['parent'] ) ) {
				$normalized_option['parent'] = absint( $resource_option['parent'] );
			}
			$normalized_options[] = $normalized_option;
		}

		return $normalized_options;
	}

	/**
	 * Convert canonical date rows to the machine-readable Listing action shape.
	 *
	 * The action menu uses only the first and last values for date-aware actions.
	 * Preserving legacy boundary seconds keeps those established actions compatible
	 * without deriving persistence values from localized labels.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Authorized canonical date rows.
	 *
	 * @return array<int,string> Ordered safe database date values.
	 */
	private function get_listing_short_dates( $date_rows ) {
		$short_dates = array();
		foreach ( $date_rows as $date_row ) {
			$date_value = isset( $date_row['booking_date'] ) ? (string) $date_row['booking_date'] : '';
			if ( ! preg_match( '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $date_value ) ) {
				continue;
			}
			$short_dates[] = $date_value;
		}

		sort( $short_dates, SORT_STRING );

		return array_values( array_unique( $short_dates ) );
	}

	/**
	 * Map the authorized form projection to the scalar values used by calendar actions.
	 *
	 * @param array<int,array<string,mixed>> $fields Authorized form fields.
	 *
	 * @return array<string,string> Field values keyed by stable form field name.
	 */
	private function get_listing_form_data( $fields ) {
		$form_data = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['key'] ) ) {
				continue;
			}

			$field_key = sanitize_key( (string) $field['key'] );
			if ( '' === $field_key ) {
				continue;
			}

			$field_value = isset( $field['value'] ) ? $field['value'] : '';
			if ( is_array( $field_value ) ) {
				$field_value = implode( ', ', array_map( 'sanitize_text_field', $field_value ) );
			}
			$form_data[ $field_key ] = sanitize_text_field( (string) $field_value );
		}

		return $form_data;
	}

	/**
	 * Build the plain-text description accepted by the existing calendar-link helper.
	 *
	 * @param array<int,array<string,mixed>> $fields Authorized form fields.
	 *
	 * @return string Human-readable authorized field summary.
	 */
	private function get_listing_form_summary( $fields ) {
		$summary_lines = array();
		foreach ( $fields as $field ) {
			if ( ! is_array( $field ) || empty( $field['label'] ) ) {
				continue;
			}

			$field_value = isset( $field['value_label'] ) ? $field['value_label'] : ( isset( $field['value'] ) ? $field['value'] : '' );
			if ( is_array( $field_value ) ) {
				$field_value = implode( ', ', array_map( 'sanitize_text_field', $field_value ) );
			}
			$summary_lines[] = sanitize_text_field( (string) $field['label'] ) . ': ' . sanitize_text_field( (string) $field_value );
		}

		return implode( "\n", $summary_lines );
	}

	/**
	 * Retain only the locale needed by the Listing language action.
	 *
	 * @param mixed $raw_options Serialized booking options.
	 *
	 * @return array<string,string> Safe Listing option subset.
	 */
	private function get_listing_booking_options( $raw_options ) {
		$decoded_options = $raw_options;
		if ( is_string( $raw_options ) && function_exists( 'maybe_unserialize' ) ) {
			$decoded_options = maybe_unserialize( $raw_options );
		}
		if ( ! is_array( $decoded_options ) || empty( $decoded_options['booking_meta_locale'] ) ) {
			return array();
		}

		return array(
			'booking_meta_locale' => sanitize_text_field( (string) $decoded_options['booking_meta_locale'] ),
		);
	}

	/**
	 * Return authorized links into canonical booking workflows.
	 *
	 * Editing remains owned by the established booking editor so its availability,
	 * lifecycle hooks, email choices, and edition rules remain in effect. The
	 * separate Listing action compatibility projection carries the legacy action
	 * values required by the canonical three-dots menu.
	 *
	 * @param array<string,mixed> $booking  Authorized internal booking record.
	 * @param string              $form_key Exact stored Booking Form key.
	 *
	 * @return array<string,mixed> Safe action presentation contract.
	 */
	private function get_actions( $booking, $form_key ) {
		$can_edit = function_exists( 'wpbc_is_user_can' )
			? wpbc_is_user_can( 'edit_booking', wpbc_get_current_user_id() )
			: false;
		$booking_hash = isset( $booking['hash'] ) ? sanitize_text_field( (string) $booking['hash'] ) : '';
		$form_key     = sanitize_text_field( (string) $form_key );
		$edit_url     = $can_edit && function_exists( 'wpbc_get_booking_admin_edit_url' )
			? wpbc_get_booking_admin_edit_url(
				isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
				$booking_hash,
				'standard' === $form_key ? '' : $form_key
			)
			: '';

		return array(
			'can_edit'                => $can_edit && '' !== $edit_url,
			'can_update'              => (bool) $can_edit,
			'can_edit_fields'         => (bool) $can_edit,
			'can_edit_public_note'    => (bool) $can_edit && function_exists( 'wpbc_booking_notes_column_exists' ) && wpbc_booking_notes_column_exists( 'public_note' ),
			'can_edit_private_note'   => (bool) $can_edit && $this->current_user_can_action( 'set_booking_note' ),
			'can_edit_cost'           => (bool) $can_edit && ! empty( $booking['supports_costs'] ) && $this->current_user_can_action( 'set_booking_cost' ),
			'can_edit_payment_status' => (bool) $can_edit && ! empty( $booking['supports_costs'] ) && $this->current_user_can_action( 'set_payment_status' ),
			'edit_url'                => esc_url_raw( $edit_url ),
		);
	}

	/**
	 * Check an established booking-action capability for the current user.
	 *
	 * @param string $action Booking action identifier.
	 *
	 * @return bool True when the current user may perform the action.
	 */
	private function current_user_can_action( $action ) {
		return function_exists( 'wpbc_is_user_can' )
			&& wpbc_is_user_can( sanitize_key( $action ), wpbc_get_current_user_id() );
	}

	/**
	 * Normalize activity records without permitting objects or raw rows.
	 *
	 * @param mixed $activity Candidate activity records.
	 *
	 * @return array<string,mixed> JSON-safe event page.
	 */
	private function normalize_activity( $activity ) {
		$normalized_activity = array();
		$activity_events      = is_array( $activity ) && isset( $activity['events'] ) && is_array( $activity['events'] ) ? $activity['events'] : array();
		foreach ( $activity_events as $activity_record ) {
			if ( ! is_array( $activity_record ) ) {
				continue;
			}
			$activity_changes = $this->normalize_activity_changes(
				isset( $activity_record['changes'] ) ? $activity_record['changes'] : array()
			);
			$normalized_activity[] = array(
				'id'             => isset( $activity_record['id'] ) ? absint( $activity_record['id'] ) : 0,
				'type'           => isset( $activity_record['type'] ) ? sanitize_key( $activity_record['type'] ) : '',
				'label'          => isset( $activity_record['label'] ) ? sanitize_text_field( $activity_record['label'] ) : '',
				'description'    => isset( $activity_record['description'] ) ? sanitize_textarea_field( $activity_record['description'] ) : '',
				'changes'        => $activity_changes,
				'changes_notice' => isset( $activity_record['changes_notice'] ) ? sanitize_text_field( $activity_record['changes_notice'] ) : '',
				'actor_label'     => isset( $activity_record['actor_label'] ) ? sanitize_text_field( $activity_record['actor_label'] ) : '',
				'occurred_at'     => isset( $activity_record['occurred_at'] ) ? sanitize_text_field( $activity_record['occurred_at'] ) : '',
			);
		}

		$pagination = is_array( $activity ) && isset( $activity['pagination'] ) && is_array( $activity['pagination'] ) ? $activity['pagination'] : array();

		return array(
			'events'     => $normalized_activity,
			'pagination' => array(
				'page'        => isset( $pagination['page'] ) ? max( 1, absint( $pagination['page'] ) ) : 1,
				'per_page'    => isset( $pagination['per_page'] ) ? min( 50, max( 1, absint( $pagination['per_page'] ) ) ) : 20,
				'total_items' => isset( $pagination['total_items'] ) ? absint( $pagination['total_items'] ) : 0,
				'total_pages' => isset( $pagination['total_pages'] ) ? absint( $pagination['total_pages'] ) : 0,
			),
		);
	}

	/**
	 * Preserve bounded presentation-only Activity change rows.
	 *
	 * The Activity domain has already removed raw values and private storage
	 * details. This defensive projection keeps only the two strings consumed by
	 * the Inspector template and prevents arbitrary nested records from reaching
	 * the browser.
	 *
	 * @param mixed $candidate_changes Candidate Activity presentation rows.
	 *
	 * @return array<int,array{label:string,description:string}> Safe change rows.
	 */
	private function normalize_activity_changes( $candidate_changes ) {
		$normalized_changes = array();
		foreach ( (array) $candidate_changes as $candidate_change ) {
			if ( 25 <= count( $normalized_changes ) ) {
				break;
			}
			if ( ! is_array( $candidate_change ) ) {
				continue;
			}
			$change_label       = isset( $candidate_change['label'] ) ? sanitize_text_field( $candidate_change['label'] ) : '';
			$change_description = isset( $candidate_change['description'] ) ? sanitize_text_field( $candidate_change['description'] ) : '';
			if ( '' === $change_label || '' === $change_description ) {
				continue;
			}
			$normalized_changes[] = array(
				'label'       => $change_label,
				'description' => $change_description,
			);
		}

		return $normalized_changes;
	}

	/**
	 * Format a database-local timestamp for the current WordPress site.
	 *
	 * @param string $database_date_time Canonical database date/time.
	 *
	 * @return string Localized label or an empty string.
	 */
	private function format_database_date_time( $database_date_time ) {
		if ( '' === trim( (string) $database_date_time ) || '0000-00-00 00:00:00' === $database_date_time ) {
			return '';
		}

		$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$date_time = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s', $database_date_time, $timezone );
		if ( ! $date_time instanceof DateTimeImmutable ) {
			return '';
		}

		return wp_date( get_option( 'date_format' ) . ', ' . get_option( 'time_format' ), $date_time->getTimestamp(), $timezone );
	}
}
