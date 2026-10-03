<?php
/**
 * Review-plan presentation for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build a read-only, data-only summary of the validated Setup Wizard draft.
 *
 * This service deliberately does not apply canonical settings. It translates
 * values already owned by earlier steps into a detailed review plan and keeps
 * every Edit target tied to a server-registered step identifier.
 */
final class WPBC_Setup_Wizard_Review_Setup {

	/**
	 * Build the complete review context.
	 *
	 * @param array<string,mixed> $field_values     Review-step field values.
	 * @param array<string,mixed> $consumer_context Validated values from earlier steps.
	 *
	 * @return array<string,mixed> Review presentation data.
	 */
	public function get_context( array $field_values, array $consumer_context ) {
		$journey_id      = $this->get_scalar_value( $consumer_context, 'customer_journey', 'customer_journey' );
		$journeys        = WPBC_Setup_Wizard_Step_Data::get_customer_journeys();
		$journey         = isset( $journeys[ $journey_id ] ) ? $journeys[ $journey_id ] : reset( $journeys );
		$feedback_profile = array();

		if ( WPBC_Setup_Wizard_Environment_Policy::allows_business_details() ) {
			$feedback_profile = $this->create_row(
				'business_details',
				__( 'Business details', 'booking' ),
				$this->get_business_review( $consumer_context )
			);
		}

		return array(
			'values'           => $field_values,
			'journey'          => is_array( $journey ) ? $journey : array(),
			'groups'           => $this->get_review_groups( $consumer_context, $journey_id ),
			'feedback_profile' => $feedback_profile,
		);
	}

	/**
	 * Return the ordered review groups for the current route.
	 *
	 * @param array<string,mixed> $consumer_context Validated values from earlier steps.
	 * @param string              $journey_id       Selected Customer Journey identifier.
	 *
	 * @return array<int,array{id:string,label:string,rows:array<int,array<string,mixed>>}> Review groups.
	 */
	private function get_review_groups( array $consumer_context, $journey_id ) {
		$general_rows = array();
		$is_live_demo = WPBC_Setup_Wizard_Environment_Policy::is_live_demo();

		$general_rows[] = $this->create_row(
			'date_time_formats',
			__( 'Dates & times', 'booking' ),
			$this->get_date_time_review( $consumer_context )
		);
		$general_rows[] = $this->create_row(
			'booking_experience',
			__( 'Terminology', 'booking' ),
			$this->get_booking_experience_review( $consumer_context )
		);

		$booking_rows = array();
		if ( 'guided_appointment_flow' === $journey_id ) {
			$booking_rows[] = $this->create_row( 'services', __( 'Services', 'booking' ), $this->get_services_review( $consumer_context ) );
		}
		if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_resources_configuration( $journey_id ) ) {
			$booking_rows[] = $this->create_row( 'booking_resources', __( 'Booking resources', 'booking' ), $this->get_booking_resources_review( $consumer_context ) );
		}

		if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_fixed_time_slots_configuration( $journey_id ) ) {
			$booking_rows[] = $this->create_row( 'fixed_time_slots', __( 'Fixed time slots', 'booking' ), $this->get_fixed_time_slots_review( $consumer_context ) );
		} elseif ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_duration_configuration( $journey_id ) ) {
			$booking_rows[] = $this->create_row( 'start_duration_times', __( 'Start & duration times', 'booking' ), $this->get_start_duration_times_review( $consumer_context ) );
		} elseif ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_end_configuration( $journey_id ) ) {
			$booking_rows[] = $this->create_row( 'start_end_times', __( 'Start & end times', 'booking' ), $this->get_start_end_times_review( $consumer_context ) );
		}

		if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_working_hours_configuration( $journey_id ) ) {
			$booking_rows[] = $this->create_row( 'working_hours', __( 'Working hours', 'booking' ), $this->get_working_hours_review( $consumer_context ) );
		}

		$booking_rows[] = $this->create_row( 'days_off', __( 'Days off', 'booking' ), $this->get_days_off_review() );
		$booking_rows[] = $this->create_row( 'date_selection', __( 'Date selection', 'booking' ), $this->get_date_selection_review( $consumer_context ) );

		if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_form_and_appearance_route( $journey_id ) ) {
			$booking_rows[] = $this->create_row( 'booking_form_template', __( 'Booking form', 'booking' ), $this->get_booking_form_review( $consumer_context, $journey_id ) );
			$booking_rows[] = $this->create_row( 'appearance', __( 'Appearance', 'booking' ), $this->get_appearance_review( $consumer_context ) );
		}

		$groups = array(
			array(
				'id'    => 'business',
				'label' => __( 'General settings', 'booking' ),
				'rows'  => $general_rows,
			),
			array(
				'id'    => 'booking_experience',
				'label' => __( 'Booking experience', 'booking' ),
				'rows'  => $booking_rows,
			),
		);

		if ( ! $is_live_demo && isset( $consumer_context['publish_integration'] ) ) {
			$groups[] = array(
				'id'    => 'publishing',
				'label' => __( 'Publishing', 'booking' ),
				'rows'  => array(
					$this->create_row(
						'publish_integration',
						__( 'Publish destination', 'booking' ),
						$this->get_publish_review( $consumer_context )
					),
				),
			);
		}

		return $groups;
	}

	/**
	 * Create one stable review row.
	 *
	 * @param string              $step_id Step edited by this row.
	 * @param string              $label   Visible row label.
	 * @param array<string,mixed> $review  Structured row presentation.
	 *
	 * @return array<string,mixed> Review row.
	 */
	private function create_row( $step_id, $label, array $review ) {
		$details = array();
		foreach ( isset( $review['details'] ) && is_array( $review['details'] ) ? $review['details'] : array() as $detail ) {
			if ( ! is_array( $detail ) || ! isset( $detail['label'], $detail['value'] ) ) {
				continue;
			}
			$normalized_detail = array(
				'label' => sanitize_text_field( (string) $detail['label'] ),
				'value' => sanitize_text_field( (string) $detail['value'] ),
			);
			if ( ! empty( $detail['feedback_hidden'] ) ) {
				$normalized_detail['feedback_hidden'] = true;
			}
			if ( isset( $detail['feedback_value'] ) && is_scalar( $detail['feedback_value'] ) ) {
				$normalized_detail['feedback_value'] = sanitize_text_field( (string) $detail['feedback_value'] );
			}
			if ( isset( $detail['url'] ) && is_scalar( $detail['url'] ) ) {
				$normalized_url = esc_url_raw( (string) $detail['url'] );
				if ( '' !== $normalized_url ) {
					$normalized_detail['url'] = $normalized_url;
				}
			}
			$details[] = $normalized_detail;
		}

		$items = array();
		foreach ( isset( $review['items'] ) && is_array( $review['items'] ) ? $review['items'] : array() as $item ) {
			if ( ! is_array( $item ) || ! isset( $item['label'], $item['value'] ) ) {
				continue;
			}
			$normalized_item = array(
				'label' => sanitize_text_field( (string) $item['label'] ),
				'value' => sanitize_text_field( (string) $item['value'] ),
			);
			if ( ! empty( $item['feedback_hidden'] ) ) {
				$normalized_item['feedback_hidden'] = true;
			}
			if ( isset( $item['feedback_value'] ) && is_scalar( $item['feedback_value'] ) ) {
				$normalized_item['feedback_value'] = sanitize_text_field( (string) $item['feedback_value'] );
			}
			$items[] = $normalized_item;
		}

		return array(
			'step_id'     => sanitize_key( $step_id ),
			'label'       => sanitize_text_field( $label ),
			'summary'     => isset( $review['summary'] ) ? sanitize_text_field( (string) $review['summary'] ) : '',
			'details'     => $details,
			'items'       => $items,
			'items_label' => isset( $review['items_label'] ) ? sanitize_text_field( (string) $review['items_label'] ) : '',
		);
	}

	/**
	 * Describe Business details for the explicitly consented feedback email.
	 *
	 * Business details intentionally remain absent from the visible Review plan.
	 * Keeping this record separate preserves the legacy feedback payload without
	 * reintroducing the intentionally omitted Review row.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_business_review( array $consumer_context ) {
		$values          = isset( $consumer_context['business_details'] ) && is_array( $consumer_context['business_details'] ) ? $consumer_context['business_details'] : array();
		$step_data       = new WPBC_Setup_Wizard_Step_Data();
		$business_name   = isset( $values['business_name'] ) ? sanitize_text_field( (string) $values['business_name'] ) : '';
		$business_stage  = isset( $values['business_stage'] ) ? sanitize_key( (string) $values['business_stage'] ) : '';
		$industry_id     = isset( $values['industry'] ) ? sanitize_key( (string) $values['industry'] ) : '';
		$industry_label  = $this->find_grouped_option_label( $step_data->get_industry_groups(), $industry_id, __( 'Not selected', 'booking' ) );
		$business_stages = $step_data->get_business_stages();

		return array(
			'summary' => '' !== $business_name ? $business_name : __( 'Business profile', 'booking' ),
			'details' => array(
				$this->create_detail( __( 'Business name', 'booking' ), '' !== $business_name ? $business_name : __( 'Not configured', 'booking' ) ),
				$this->create_detail( __( 'Business stage', 'booking' ), isset( $business_stages[ $business_stage ] ) ? $business_stages[ $business_stage ] : __( 'Not selected', 'booking' ) ),
				$this->create_detail( __( 'Industry', 'booking' ), $industry_label ),
				$this->create_detail( __( 'Booking email', 'booking' ), isset( $values['booking_email'] ) ? sanitize_email( (string) $values['booking_email'] ) : '' ),
				$this->create_feedback_hidden_detail( __( 'Send setup details by email', 'booking' ), ! empty( $values['personalization_consent'] ) ? __( 'Enabled', 'booking' ) : __( 'Disabled', 'booking' ) ),
			),
		);
	}

	/**
	 * Describe every selected date, time, language, and week-start choice.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_date_time_review( array $consumer_context ) {
		$date_format = $this->get_scalar_value( $consumer_context, 'date_time_formats', 'date_format' );
		$time_format = $this->get_scalar_value( $consumer_context, 'date_time_formats', 'time_format' );
		$week_start  = absint( $this->get_scalar_value( $consumer_context, 'date_time_formats', 'start_day_of_week' ) );
		$weekdays    = array(
			__( 'Sunday', 'booking' ),
			__( 'Monday', 'booking' ),
			__( 'Tuesday', 'booking' ),
			__( 'Wednesday', 'booking' ),
			__( 'Thursday', 'booking' ),
			__( 'Friday', 'booking' ),
			__( 'Saturday', 'booking' ),
		);
		$sample_time = wp_date( in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i', 48600, new DateTimeZone( 'UTC' ) );

		$date_time_context = ( new WPBC_Setup_Wizard_Date_Time_Formats() )->get_context(
			isset( $consumer_context['date_time_formats'] ) && is_array( $consumer_context['date_time_formats'] ) ? $consumer_context['date_time_formats'] : array()
		);
		$language          = isset( $date_time_context['site_language'] ) && is_array( $date_time_context['site_language'] ) ? $date_time_context['site_language'] : array();
		$sample_date       = wp_date( '' !== $date_format ? $date_format : 'F j, Y', strtotime( '2027-03-24 12:00:00 UTC' ), new DateTimeZone( 'UTC' ) );

		return array(
			/* translators: 1: Example date, 2: Example time. */
			'summary' => sprintf( __( '%1$s at %2$s', 'booking' ), $sample_date, $sample_time ),
			'details' => array(
				$this->create_feedback_hidden_detail( __( 'Date format', 'booking' ), $date_format ),
				$this->create_feedback_hidden_detail( __( 'Time format', 'booking' ), $time_format ),
				$this->create_detail( __( 'Week starts', 'booking' ), $weekdays[ min( 6, $week_start ) ] ),
				$this->create_detail( __( 'Website language', 'booking' ), isset( $language['label'] ) ? $language['label'] : '' ),
				$this->create_detail( __( 'Translation source', 'booking' ), isset( $language['translation_source_label'] ) ? $language['translation_source_label'] : '' ),
				$this->create_feedback_hidden_detail( __( 'Translation status', 'booking' ), isset( $language['status_label'] ) ? $language['status_label'] : '' ),
			),
		);
	}

	/**
	 * Describe the selected administration terminology mode.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_booking_experience_review( array $consumer_context ) {
		$mode_id = $this->get_scalar_value( $consumer_context, 'booking_experience', 'booking_experience' );
		$context = ( new WPBC_Setup_Wizard_Step_Data() )->get_step_context( 'booking_experience', $consumer_context );
		$record  = $this->find_record( isset( $context['experiences'] ) && is_array( $context['experiences'] ) ? $context['experiences'] : array(), 'id', $mode_id );

		return array(
			'summary' => isset( $record['title'] ) ? $record['title'] : __( 'Booking Calendar', 'booking' ),
			'details' => array(
				$this->create_detail( __( 'Administration label', 'booking' ), isset( $record['toolbar_label'] ) ? $record['toolbar_label'] : '' ),
				$this->create_feedback_hidden_detail( __( 'Administration areas', 'booking' ), isset( $record['dashboard_uses'] ) ? $record['dashboard_uses'] : '' ),
				$this->create_feedback_hidden_detail( __( 'Best for', 'booking' ), isset( $record['best_for'] ) ? $record['best_for'] : '' ),
			),
		);
	}

	/**
	 * Describe every proposed Service.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_services_review( array $consumer_context ) {
		$services = isset( $consumer_context['services']['services'] ) && is_array( $consumer_context['services']['services'] )
			? array_values( $consumer_context['services']['services'] )
			: array();

		if ( empty( $services ) ) {
			return array( 'summary' => __( 'No Services selected', 'booking' ) );
		}

		$services_context = ( new WPBC_Setup_Wizard_Services() )->get_context( array( 'services' => $services ) );
		$show_price       = ! empty( $services_context['pricing_available'] );
		$currency_symbol  = isset( $services_context['currency_symbol'] ) ? (string) $services_context['currency_symbol'] : '$';
		$items            = array();

		foreach ( $services as $service_index => $service ) {
			$service       = is_array( $service ) ? $service : array();
			$service_title = isset( $service['title'] ) && '' !== trim( (string) $service['title'] ) ? (string) $service['title'] : sprintf( __( 'Service %d', 'booking' ), $service_index + 1 );
			$parts         = array();
			/* translators: %d: Service duration in minutes. */
			$parts[] = sprintf( __( '%d minutes', 'booking' ), isset( $service['duration_minutes'] ) ? absint( $service['duration_minutes'] ) : 0 );
			/* translators: 1: Buffer before in minutes, 2: Buffer after in minutes. */
			$parts[] = sprintf( __( 'Buffers: %1$d before, %2$d after', 'booking' ), isset( $service['buffer_before_minutes'] ) ? absint( $service['buffer_before_minutes'] ) : 0, isset( $service['buffer_after_minutes'] ) ? absint( $service['buffer_after_minutes'] ) : 0 );
			if ( $show_price && isset( $service['base_cost'] ) && is_numeric( $service['base_cost'] ) ) {
				$parts[] = sprintf( '%1$s%2$s', $currency_symbol, number_format_i18n( (float) $service['base_cost'], 2 ) );
			}
			$parts[]        = isset( $service['status'] ) && 'active' === $service['status'] ? __( 'Active', 'booking' ) : __( 'Inactive', 'booking' );
			$feedback_parts = $parts;
			if ( ! empty( $service['description'] ) ) {
				$parts[] = sprintf( __( 'Description: %s', 'booking' ), sanitize_textarea_field( (string) $service['description'] ) );
			}
			$image_state      = ! empty( $service['picture_url'] ) ? __( 'Image selected', 'booking' ) : __( 'No image', 'booking' );
			$parts[]          = $image_state;
			$feedback_parts[] = $image_state;
			$items[]          = $this->create_feedback_value_detail( $service_title, implode( ' · ', $parts ), implode( ' · ', $feedback_parts ) );
		}

		return array(
			/* translators: %d: Number of Services. */
			'summary'     => sprintf( _n( '%d Service configured', '%d Services configured', count( $services ), 'booking' ), count( $services ) ),
			'items'       => $items,
			'items_label' => __( 'Review configured Services', 'booking' ),
		);
	}

	/**
	 * Describe Booking Resources created or reused by the full-day route.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values and verified results.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_booking_resources_review( array $consumer_context ) {
		$resource_drafts = isset( $consumer_context['booking_resources']['booking_resources'] ) && is_array( $consumer_context['booking_resources']['booking_resources'] )
			? array_values( $consumer_context['booking_resources']['booking_resources'] )
			: array();
		$items = array();

		foreach ( $resource_drafts as $resource_index => $resource_draft ) {
			$resource_draft = is_array( $resource_draft ) ? $resource_draft : array();
			$title          = isset( $resource_draft['title'] ) && '' !== trim( (string) $resource_draft['title'] )
				? (string) $resource_draft['title']
				: sprintf( __( 'Booking Resource %d', 'booking' ), $resource_index + 1 );
			$description    = isset( $resource_draft['description'] ) ? sanitize_textarea_field( (string) $resource_draft['description'] ) : '';
			$items[]        = $this->create_detail( $title, '' !== $description ? $description : __( 'No description', 'booking' ) );
		}

		if ( empty( $items ) ) {
			return array( 'summary' => __( 'Existing Booking Resources retained', 'booking' ) );
		}

		return array(
			/* translators: %d: Number of Booking Resources created by Setup Wizard. */
			'summary'     => sprintf( _n( '%d Booking Resource created', '%d Booking Resources created', count( $items ), 'booking' ), count( $items ) ),
			'items'       => $items,
			'items_label' => __( 'Review created Booking Resources', 'booking' ),
		);
	}

	/**
	 * Describe the complete weekly Working Hours proposal.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_working_hours_review( array $consumer_context ) {
		$working_hours = isset( $consumer_context['working_hours']['working_hours'] ) && is_array( $consumer_context['working_hours']['working_hours'] )
			? $consumer_context['working_hours']['working_hours']
			: array();
		$weekdays      = isset( $working_hours['weekdays'] ) && is_array( $working_hours['weekdays'] ) ? $working_hours['weekdays'] : array();
		$enabled_days   = array_filter( $weekdays );
		$time_format    = $this->get_scalar_value( $consumer_context, 'date_time_formats', 'time_format' );
		$time_format    = in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i';
		$weekday_labels = array(
			1 => __( 'Monday', 'booking' ),
			2 => __( 'Tuesday', 'booking' ),
			3 => __( 'Wednesday', 'booking' ),
			4 => __( 'Thursday', 'booking' ),
			5 => __( 'Friday', 'booking' ),
			6 => __( 'Saturday', 'booking' ),
			0 => __( 'Sunday', 'booking' ),
		);
		$items          = array();

		foreach ( $weekday_labels as $day_number => $weekday_label ) {
			$intervals = isset( $weekdays[ $day_number ] ) && is_array( $weekdays[ $day_number ] ) ? $weekdays[ $day_number ] : array();
			$labels    = array();
			foreach ( $intervals as $interval ) {
				if ( ! is_array( $interval ) || ! isset( $interval['start_second'], $interval['end_second'] ) ) {
					continue;
				}
				$labels[] = $this->format_time_second( $interval['start_second'], $time_format ) . '–' . $this->format_time_second( $interval['end_second'], $time_format );
			}
			$items[] = $this->create_detail( $weekday_label, ! empty( $labels ) ? implode( ', ', $labels ) : __( 'Closed', 'booking' ) );
		}

		return array(
			/* translators: %d: Number of working days. */
			'summary'     => ! empty( $enabled_days ) ? sprintf( _n( '%d working day', '%d working days', count( $enabled_days ), 'booking' ), count( $enabled_days ) ) : __( 'No working hours selected', 'booking' ),
			'details'     => array(
				$this->create_detail( __( 'Schedule status', 'booking' ), isset( $working_hours['enabled'] ) && 'On' === $working_hours['enabled'] ? __( 'Enabled', 'booking' ) : __( 'Disabled', 'booking' ) ),
			),
			'items'       => $items,
			'items_label' => __( 'Review the weekly schedule', 'booking' ),
		);
	}

	/**
	 * Describe the ordered start and end choices without expanding long lists.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_start_end_times_review( array $consumer_context ) {
		$time_choices = isset( $consumer_context['start_end_times']['start_end_times'] ) && is_array( $consumer_context['start_end_times']['start_end_times'] )
			? $consumer_context['start_end_times']['start_end_times']
			: array();
		$start_times = isset( $time_choices['start_times'] ) && is_array( $time_choices['start_times'] ) ? array_values( $time_choices['start_times'] ) : array();
		$end_times   = isset( $time_choices['end_times'] ) && is_array( $time_choices['end_times'] ) ? array_values( $time_choices['end_times'] ) : array();
		$time_format = $this->get_scalar_value( $consumer_context, 'date_time_formats', 'time_format' );
		$time_format = in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i';

		return array(
			/* translators: 1: Number of start-time choices, 2: Number of end-time choices. */
			'summary' => sprintf( __( '%1$d start times / %2$d end times', 'booking' ), count( $start_times ), count( $end_times ) ),
			'details' => array(
				$this->create_detail( __( 'Start times', 'booking' ), $this->format_time_choice_summary( $start_times, $time_format ) ),
				$this->create_detail( __( 'End times', 'booking' ), $this->format_time_choice_summary( $end_times, $time_format ) ),
			),
		);
	}

	/**
	 * Describe ordered start-time and duration choices without long output.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_start_duration_times_review( array $consumer_context ) {
		$time_choices = isset( $consumer_context['start_duration_times']['start_duration_times'] ) && is_array( $consumer_context['start_duration_times']['start_duration_times'] )
			? $consumer_context['start_duration_times']['start_duration_times']
			: array();
		$start_times    = isset( $time_choices['start_times'] ) && is_array( $time_choices['start_times'] ) ? array_values( $time_choices['start_times'] ) : array();
		$duration_times = isset( $time_choices['duration_times'] ) && is_array( $time_choices['duration_times'] ) ? array_values( $time_choices['duration_times'] ) : array();
		$time_format    = $this->get_scalar_value( $consumer_context, 'date_time_formats', 'time_format' );
		$time_format    = in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i';
		$duration_labels = array();
		$duration_service = new WPBC_Setup_Wizard_Start_Duration_Times();
		foreach ( array_slice( $duration_times, 0, 5 ) as $duration_time ) {
			if ( ! is_scalar( $duration_time ) || ! preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/', (string) $duration_time ) ) {
				continue;
			}
			list( $hour, $minute ) = array_map( 'intval', explode( ':', (string) $duration_time ) );
			$duration_labels[] = $duration_service->format_duration_label( ( $hour * 60 ) + $minute );
		}
		$hidden_duration_count = count( $duration_times ) - count( $duration_labels );
		if ( 0 < $hidden_duration_count ) {
			/* translators: %d: Number of additional duration choices omitted from the compact summary. */
			$duration_labels[] = sprintf( _n( '%d more duration', '%d more durations', $hidden_duration_count, 'booking' ), $hidden_duration_count );
		}

		return array(
			/* translators: 1: Number of start-time choices, 2: Number of duration choices. */
			'summary' => sprintf( __( '%1$d start times / %2$d durations', 'booking' ), count( $start_times ), count( $duration_times ) ),
			'details' => array(
				$this->create_detail( __( 'Start times', 'booking' ), $this->format_time_choice_summary( $start_times, $time_format ) ),
				$this->create_detail( __( 'Durations', 'booking' ), ! empty( $duration_labels ) ? implode( ', ', $duration_labels ) : __( 'Not configured', 'booking' ) ),
			),
		);
	}

	/**
	 * Describe ordered fixed time-slot ranges without expanding long lists.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_fixed_time_slots_review( array $consumer_context ) {
		$fixed_time_slots = isset( $consumer_context['fixed_time_slots']['fixed_time_slots']['time_slots'] )
			&& is_array( $consumer_context['fixed_time_slots']['fixed_time_slots']['time_slots'] )
			? array_values( $consumer_context['fixed_time_slots']['fixed_time_slots']['time_slots'] )
			: array();
		$time_format = $this->get_scalar_value( $consumer_context, 'date_time_formats', 'time_format' );
		$time_format = in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ? $time_format : 'H:i';
		$slot_labels = array();
		$slot_service = new WPBC_Setup_Wizard_Fixed_Time_Slots();

		foreach ( array_slice( $fixed_time_slots, 0, 5 ) as $time_slot ) {
			if ( ! is_array( $time_slot ) || ! isset( $time_slot['start_time'], $time_slot['end_time'] ) ) {
				continue;
			}
			$start_label = $slot_service->format_time_label( (string) $time_slot['start_time'], $time_format );
			$end_label   = $slot_service->format_time_label( (string) $time_slot['end_time'], $time_format );
			if ( '' !== $start_label && '' !== $end_label ) {
				$slot_labels[] = $start_label . '–' . $end_label;
			}
		}

		$hidden_slot_count = count( $fixed_time_slots ) - count( $slot_labels );
		if ( 0 < $hidden_slot_count ) {
			/* translators: %d: Number of additional fixed time slots omitted from the compact summary. */
			$slot_labels[] = sprintf( _n( '%d more slot', '%d more slots', $hidden_slot_count, 'booking' ), $hidden_slot_count );
		}

		return array(
			/* translators: %d: Number of fixed time slots. */
			'summary' => sprintf( _n( '%d fixed time slot', '%d fixed time slots', count( $fixed_time_slots ), 'booking' ), count( $fixed_time_slots ) ),
			'details' => array(
				$this->create_detail( __( 'Time slots', 'booking' ), ! empty( $slot_labels ) ? implode( ', ', $slot_labels ) : __( 'Not configured', 'booking' ) ),
			),
		);
	}

	/**
	 * Describe all current canonical unavailable-date ranges.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_days_off_review() {
		$state = ( new WPBC_Setup_Wizard_Days_Off() )->get_state();
		if ( is_wp_error( $state ) || empty( $state['ranges'] ) || ! is_array( $state['ranges'] ) ) {
			return array( 'summary' => __( 'No upcoming unavailable date periods', 'booking' ) );
		}

		$range_count = count( $state['ranges'] );
		$items       = array();
		foreach ( $state['ranges'] as $range ) {
			if ( ! is_array( $range ) || empty( $range['label'] ) ) {
				continue;
			}
			$day_count = isset( $range['day_count'] ) ? absint( $range['day_count'] ) : 0;
			$scope     = isset( $range['scope_label'] ) ? sanitize_text_field( (string) $range['scope_label'] ) : '';
			/* translators: 1: Number of unavailable days, 2: Booking-item scope. */
			$description = sprintf( _n( '%1$d day · %2$s', '%1$d days · %2$s', $day_count, 'booking' ), $day_count, $scope );
			$items[]     = $this->create_detail( $range['label'], $description );
		}

		return array(
			/* translators: %d: Number of unavailable date periods. */
			'summary'     => sprintf( _n( '%d unavailable date period', '%d unavailable date periods', $range_count, 'booking' ), $range_count ),
			'items'       => $items,
			'items_label' => __( 'Review unavailable date periods', 'booking' ),
		);
	}

	/**
	 * Describe the complete customer-facing Date Selection policy.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_date_selection_review( array $consumer_context ) {
		$values  = isset( $consumer_context['date_selection'] ) && is_array( $consumer_context['date_selection'] ) ? $consumer_context['date_selection'] : array();
		$mode_id = $this->get_scalar_value( $consumer_context, 'date_selection', 'date_selection_mode' );
		$labels  = array(
			'single'   => __( 'Single day', 'booking' ),
			'multiple' => __( 'Multiple days', 'booking' ),
			'dynamic'  => __( 'Flexible range', 'booking' ),
			'fixed'    => __( 'Fixed range', 'booking' ),
		);

		$details = array();
		if ( 'fixed' === $mode_id ) {
			$details[] = $this->create_detail( __( 'Number of selected days', 'booking' ), isset( $values['date_selection_fixed_days'] ) ? absint( $values['date_selection_fixed_days'] ) : 0 );
			$details[] = $this->create_detail( __( 'Booking can start on', 'booking' ), $this->format_weekday_selection( isset( $values['date_selection_fixed_weekdays'] ) ? $values['date_selection_fixed_weekdays'] : '' ) );
		} elseif ( 'dynamic' === $mode_id ) {
			$details[] = $this->create_detail( __( 'Minimum days', 'booking' ), isset( $values['date_selection_dynamic_min'] ) ? absint( $values['date_selection_dynamic_min'] ) : 0 );
			$details[] = $this->create_detail( __( 'Maximum days', 'booking' ), isset( $values['date_selection_dynamic_max'] ) ? absint( $values['date_selection_dynamic_max'] ) : 0 );
			$details[] = $this->create_detail( __( 'Specific selectable lengths', 'booking' ), ! empty( $values['date_selection_dynamic_specific'] ) ? $values['date_selection_dynamic_specific'] : __( 'Any length within the range', 'booking' ) );
			$details[] = $this->create_detail( __( 'Booking can start on', 'booking' ), $this->format_weekday_selection( isset( $values['date_selection_dynamic_weekdays'] ) ? $values['date_selection_dynamic_weekdays'] : '' ) );
		}

		$changeover_enabled = isset( $values['date_selection_changeover_enabled'] ) && 'On' === $values['date_selection_changeover_enabled'];
		$details[]          = $this->create_detail( __( 'Changeover days', 'booking' ), $this->format_toggle( $changeover_enabled ) );
		if ( $changeover_enabled ) {
			$details[] = $this->create_detail( __( 'Check-in time', 'booking' ), isset( $values['date_selection_check_in_time'] ) ? $values['date_selection_check_in_time'] : '' );
			$details[] = $this->create_detail( __( 'Check-out time', 'booking' ), isset( $values['date_selection_check_out_time'] ) ? $values['date_selection_check_out_time'] : '' );
			$details[] = $this->create_detail( __( 'Show changeover days as triangles', 'booking' ), $this->format_toggle( isset( $values['date_selection_triangles'] ) && 'On' === $values['date_selection_triangles'] ) );
		}
		$details[] = $this->create_detail( __( 'Use selected times for each booking date', 'booking' ), $this->format_toggle( isset( $values['date_selection_recurrent_time'] ) && 'On' === $values['date_selection_recurrent_time'] ) );
		$details[] = $this->create_detail( __( 'Set check-out date as available', 'booking' ), $this->format_toggle( isset( $values['date_selection_checkout_available'] ) && 'On' === $values['date_selection_checkout_available'] ) );
		$details[] = $this->create_detail( __( 'Calendar legend', 'booking' ), $this->format_toggle( isset( $values['date_selection_legend_enabled'] ) && 'On' === $values['date_selection_legend_enabled'] ) );

		$legend_items = array();
		foreach ( ( new WPBC_Setup_Wizard_Date_Selection() )->get_legend_items() as $legend_item ) {
			$legend_id   = $legend_item['id'];
			$show_key    = 'date_selection_legend_item_' . $legend_id;
			$text_key    = 'date_selection_legend_text_' . $legend_id;
			$legend_text = ! empty( $values[ $text_key ] ) ? $values[ $text_key ] : $legend_item['placeholder'];
			$legend_items[] = $this->create_detail(
				$legend_item['label'],
				isset( $values[ $show_key ] ) && 'On' === $values[ $show_key ]
					? sprintf( __( 'Shown as “%s”', 'booking' ), $legend_text )
					: __( 'Hidden', 'booking' )
			);
		}
		$legend_items[] = $this->create_detail( __( 'Show date number', 'booking' ), $this->format_toggle( isset( $values['date_selection_legend_show_numbers'] ) && 'On' === $values['date_selection_legend_show_numbers'] ) );
		$legend_items[] = $this->create_detail( __( 'Legend layout', 'booking' ), isset( $values['date_selection_legend_vertical'] ) && 'On' === $values['date_selection_legend_vertical'] ? __( 'Column', 'booking' ) : __( 'Row', 'booking' ) );

		return array(
			'summary'     => isset( $labels[ $mode_id ] ) ? $labels[ $mode_id ] : __( 'Date selection', 'booking' ),
			'details'     => $details,
			'items'       => $legend_items,
			'items_label' => __( 'Review Calendar legend items', 'booking' ),
		);
	}

	/**
	 * Summarize the selected Booking Form template and entry point.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 * @param string              $journey_id       Selected Customer Journey ID.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_booking_form_review( array $consumer_context, $journey_id ) {
		$values      = isset( $consumer_context['booking_form_template'] ) && is_array( $consumer_context['booking_form_template'] ) ? $consumer_context['booking_form_template'] : array();
		$context     = ( new WPBC_Setup_Wizard_Booking_Form_Templates() )->get_context( $values, $journey_id );
		$template    = isset( $context['selected_template'] ) && is_array( $context['selected_template'] ) ? $context['selected_template'] : array();
		$title       = isset( $template['title'] ) ? sanitize_text_field( (string) $template['title'] ) : __( 'Booking form', 'booking' );
		$usage       = isset( $values['booking_form_usage'] ) ? sanitize_key( (string) $values['booking_form_usage'] ) : '';
		$usage_record = $this->find_record( isset( $context['usage_options'] ) && is_array( $context['usage_options'] ) ? $context['usage_options'] : array(), 'id', $usage );
		$usage_label  = isset( $usage_record['label'] ) ? $usage_record['label'] : __( 'Direct booking form', 'booking' );

		return array(
			'summary' => $title,
			'details' => array(
				$this->create_detail( __( 'Entry point', 'booking' ), $usage_label ),
				$this->create_detail( __( 'Entry-point behavior', 'booking' ), isset( $usage_record['description'] ) ? $usage_record['description'] : '' ),
				$this->create_detail( __( 'Template category', 'booking' ), isset( $template['category'] ) ? $template['category'] : '' ),
				$this->create_feedback_hidden_detail( __( 'Template description', 'booking' ), isset( $template['description'] ) ? $template['description'] : '' ),
			),
		);
	}

	/**
	 * Summarize the selected appearance style and accent.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 *
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_appearance_review( array $consumer_context ) {
		$values       = isset( $consumer_context['appearance'] ) && is_array( $consumer_context['appearance'] ) ? $consumer_context['appearance'] : array();
		$appearance   = new WPBC_Setup_Wizard_Appearance();
		$style_id     = isset( $values['booking_form_style'] ) ? sanitize_key( (string) $values['booking_form_style'] ) : '';
		$accent       = isset( $values['booking_form_accent_color'] ) ? sanitize_hex_color( (string) $values['booking_form_accent_color'] ) : '';
		$style_label  = $this->find_record_label( $appearance->get_starting_styles(), 'id', $style_id, __( 'Booking appearance', 'booking' ) );
		$accent_label = $this->find_record_label( $appearance->get_accent_colors(), 'value', $accent, $accent );
		$skin_value   = isset( $values['booking_skin'] ) ? sanitize_text_field( (string) $values['booking_skin'] ) : '';
		$skin_label   = $this->find_grouped_record_label( $appearance->get_calendar_skin_groups(), 'value', $skin_value, $skin_value );

		return array(
			'summary' => $style_label,
			'details' => array(
				$this->create_detail( __( 'Accent color', 'booking' ), trim( $accent_label . ( '' !== $accent ? ' (' . $accent . ')' : '' ) ) ),
				$this->create_detail( __( 'Calendar skin', 'booking' ), $skin_label ),
				$this->create_detail( __( 'Time choices', 'booking' ), isset( $values['booking_timeslot_picker'] ) && 'On' === $values['booking_timeslot_picker'] ? __( 'Time-slot picker', 'booking' ) : __( 'Standard time choices', 'booking' ) ),
			),
		);
	}

	/**
	 * Summarize the saved publishing destination and verified operation result.
	 *
	 * @param array<string,mixed> $consumer_context Earlier step values.
	 * @return array<string,mixed> Structured review presentation.
	 */
	private function get_publish_review( array $consumer_context ) {
		$values      = isset( $consumer_context['publish_integration'] ) && is_array( $consumer_context['publish_integration'] ) ? $consumer_context['publish_integration'] : array();
		$step_results = isset( $consumer_context['_step_results'] ) && is_array( $consumer_context['_step_results'] ) ? $consumer_context['_step_results'] : array();
		$publish_result = isset( $step_results['publish_integration'] ) && is_array( $step_results['publish_integration'] ) ? $step_results['publish_integration'] : array();
		$destination = isset( $values['publish_destination'] ) ? sanitize_key( (string) $values['publish_destination'] ) : '';
		$labels      = array(
			WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE   => __( 'Create a new page', 'booking' ),
			WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE => __( 'Use an existing page', 'booking' ),
			WPBC_Setup_Wizard_Publish_Integration::DESTINATION_MANUAL        => __( 'Add it manually', 'booking' ),
			WPBC_Setup_Wizard_Publish_Integration::DESTINATION_LATER         => __( 'Decide later', 'booking' ),
		);
		$service          = new WPBC_Setup_Wizard_Publish_Integration();
		$journey_id       = $this->get_scalar_value( $consumer_context, 'customer_journey', 'customer_journey' );
		$form_slug        = $this->get_scalar_value( $consumer_context, 'booking_form_template', 'booking_form_template' );
		$content_options  = $service->get_content_options( $journey_id, $form_slug );
		$content_id       = isset( $values['publish_page_content'] ) ? sanitize_key( (string) $values['publish_page_content'] ) : '';
		if ( WPBC_Setup_Wizard_Publish_Integration::CONTENT_RECOMMENDED === $content_id ) {
			$content_id = $service->get_recommended_content_id( $journey_id );
		}
		$content_record = $this->find_record( $content_options, 'id', $content_id );
		$page_title     = isset( $values['publish_page_title'] ) ? sanitize_text_field( (string) $values['publish_page_title'] ) : '';
		$page_id        = isset( $values['publish_existing_page_id'] ) ? absint( $values['publish_existing_page_id'] ) : 0;
		$page_label     = '';
		$page_url       = '';

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination ) {
			$page_id = $this->get_result_page_id( $publish_result, 'wp_page_created:' );
			if ( $page_id && current_user_can( 'edit_post', $page_id ) ) {
				$permalink  = get_permalink( $page_id );
				$page_label = sanitize_text_field( get_the_title( $page_id ) );
				$page_url   = is_string( $permalink ) ? esc_url_raw( $permalink ) : '';
			} else {
				$page_label = $page_title;
				$page_url   = $service->get_new_page_url_preview( $page_title );
			}
		} elseif ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE === $destination && $page_id && current_user_can( 'edit_post', $page_id ) ) {
			$permalink  = get_permalink( $page_id );
			$page_label = sanitize_text_field( get_the_title( $page_id ) );
			$page_url   = is_string( $permalink ) ? esc_url_raw( $permalink ) : '';
		}

		$details = array(
			$this->create_detail( __( 'WordPress page', 'booking' ), '' !== $page_label ? $page_label : __( 'No page selected', 'booking' ) ),
			$this->create_link_detail( __( 'Page URL', 'booking' ), $page_url ),
			$this->create_detail( __( 'Page content', 'booking' ), isset( $content_record['label'] ) ? $content_record['label'] : __( 'Not applicable', 'booking' ) ),
			$this->create_detail( __( 'Booking shortcode', 'booking' ), isset( $content_record['shortcode'] ) ? $content_record['shortcode'] : __( 'Not applicable', 'booking' ) ),
		);
		if ( isset( $publish_result['summary'] ) && is_scalar( $publish_result['summary'] ) && '' !== trim( (string) $publish_result['summary'] ) ) {
			$details[] = $this->create_detail( __( 'Save result', 'booking' ), (string) $publish_result['summary'] );
		}

		return array(
			'summary' => isset( $labels[ $destination ] ) ? $labels[ $destination ] : __( 'Publishing plan', 'booking' ),
			'details' => $details,
		);
	}

	/**
	 * Resolve a verified WordPress page ID from one normalized save result.
	 *
	 * @param array<string,mixed> $step_result Normalized progressive-save result.
	 * @param string              $id_prefix   Expected server-owned identifier prefix.
	 *
	 * @return int Verified result page ID, or zero when absent.
	 */
	private function get_result_page_id( array $step_result, $id_prefix ) {
		$result_ids = array_merge(
			isset( $step_result['created_ids'] ) && is_array( $step_result['created_ids'] ) ? $step_result['created_ids'] : array(),
			isset( $step_result['updated_ids'] ) && is_array( $step_result['updated_ids'] ) ? $step_result['updated_ids'] : array()
		);
		foreach ( $result_ids as $result_id ) {
			if ( ! is_scalar( $result_id ) || 0 !== strpos( (string) $result_id, $id_prefix ) ) {
				continue;
			}

			return absint( substr( (string) $result_id, strlen( $id_prefix ) ) );
		}

		return 0;
	}

	/**
	 * Create one label/value presentation record.
	 *
	 * @param mixed $label Visible detail label.
	 * @param mixed $value Visible detail value.
	 *
	 * @return array{label:string,value:string} Presentation record.
	 */
	private function create_detail( $label, $value ) {
		return array(
			'label' => is_scalar( $label ) ? (string) $label : '',
			'value' => is_scalar( $value ) ? (string) $value : '',
		);
	}

	/**
	 * Create one label/value presentation record with an optional safe URL.
	 *
	 * The visible value remains available to the plain-text setup summary while
	 * the Review template may render the same authorized URL as an external link.
	 * Empty or invalid URLs intentionally fall back to ordinary text.
	 *
	 * @param mixed $label Visible detail label.
	 * @param mixed $url   Candidate destination URL and visible value.
	 *
	 * @return array{label:string,value:string,url?:string} Link presentation record.
	 */
	private function create_link_detail( $label, $url ) {
		$detail         = $this->create_detail( $label, $url );
		$normalized_url = is_scalar( $url ) ? esc_url_raw( (string) $url ) : '';

		if ( '' !== $normalized_url ) {
			$detail['url'] = $normalized_url;
		}

		return $detail;
	}

	/**
	 * Create a visible detail with a shorter feedback-email value.
	 *
	 * The Review page retains the complete value while the explicitly consented
	 * feedback email omits long free-text descriptions.
	 *
	 * @param mixed $label          Visible detail label.
	 * @param mixed $value          Complete visible value.
	 * @param mixed $feedback_value Compact value used only by feedback email.
	 *
	 * @return array{label:string,value:string,feedback_value:string} Presentation record.
	 */
	private function create_feedback_value_detail( $label, $value, $feedback_value ) {
		$detail                   = $this->create_detail( $label, $value );
		$detail['feedback_value'] = is_scalar( $feedback_value ) ? (string) $feedback_value : '';

		return $detail;
	}

	/**
	 * Create a visible detail that is intentionally omitted from feedback email.
	 *
	 * @param mixed $label Visible detail label.
	 * @param mixed $value Complete visible value.
	 *
	 * @return array{label:string,value:string,feedback_hidden:bool} Presentation record.
	 */
	private function create_feedback_hidden_detail( $label, $value ) {
		$detail                    = $this->create_detail( $label, $value );
		$detail['feedback_hidden'] = true;

		return $detail;
	}

	/**
	 * Return a localized On or Off label.
	 *
	 * @param bool $is_enabled Whether the reviewed behavior is enabled.
	 *
	 * @return string Localized state label.
	 */
	private function format_toggle( $is_enabled ) {
		return $is_enabled ? __( 'On', 'booking' ) : __( 'Off', 'booking' );
	}

	/**
	 * Format one seconds-from-midnight value with the selected time format.
	 *
	 * @param mixed  $raw_second Seconds from midnight.
	 * @param string $time_format Validated WordPress time format.
	 *
	 * @return string Formatted time.
	 */
	private function format_time_second( $raw_second, $time_format ) {
		$second = min( DAY_IN_SECONDS, absint( $raw_second ) );
		if ( DAY_IN_SECONDS === $second ) {
			return __( '24:00', 'booking' );
		}

		return wp_date( $time_format, $second, new DateTimeZone( 'UTC' ) );
	}

	/**
	 * Format a bounded preview of one ordered `HH:MM` choice list.
	 *
	 * @param string[] $time_values Validated time values.
	 * @param string   $time_format Validated WordPress time format.
	 *
	 * @return string Localized compact list summary.
	 */
	private function format_time_choice_summary( array $time_values, $time_format ) {
		$visible_values = array_slice( $time_values, 0, 5 );
		$labels         = array();

		foreach ( $visible_values as $time_value ) {
			if ( ! is_scalar( $time_value ) || ! preg_match( '/^(?:[01]\d|2[0-3]):[0-5]\d$/', (string) $time_value ) ) {
				continue;
			}
			list( $hour, $minute ) = array_map( 'intval', explode( ':', (string) $time_value ) );
			$labels[] = wp_date( $time_format, ( ( $hour * 60 ) + $minute ) * MINUTE_IN_SECONDS, new DateTimeZone( 'UTC' ) );
		}

		$hidden_count = count( $time_values ) - count( $visible_values );
		if ( 0 < $hidden_count ) {
			/* translators: %d: Number of additional time choices omitted from the compact summary. */
			$labels[] = sprintf( _n( '%d more time', '%d more times', $hidden_count, 'booking' ), $hidden_count );
		}

		return ! empty( $labels ) ? implode( ', ', $labels ) : __( 'Not configured', 'booking' );
	}

	/**
	 * Format a stored weekday list through the Date Selection registry.
	 *
	 * @param mixed $raw_weekdays Comma-separated weekday numbers or `-1`.
	 *
	 * @return string Localized weekday summary.
	 */
	private function format_weekday_selection( $raw_weekdays ) {
		$weekday_records = ( new WPBC_Setup_Wizard_Date_Selection() )->get_weekdays();
		$weekday_labels  = array();
		foreach ( $weekday_records as $weekday_record ) {
			if ( isset( $weekday_record['value'], $weekday_record['label'] ) ) {
				$weekday_labels[ (string) $weekday_record['value'] ] = (string) $weekday_record['label'];
			}
		}
		$weekday_ids = is_scalar( $raw_weekdays ) ? array_filter( array_map( 'trim', explode( ',', (string) $raw_weekdays ) ), 'strlen' ) : array();
		if ( in_array( '-1', $weekday_ids, true ) || empty( $weekday_ids ) ) {
			return __( 'Any day', 'booking' );
		}
		$selected_labels = array();
		foreach ( $weekday_ids as $weekday_id ) {
			if ( isset( $weekday_labels[ $weekday_id ] ) ) {
				$selected_labels[] = $weekday_labels[ $weekday_id ];
			}
		}

		return ! empty( $selected_labels ) ? implode( ', ', $selected_labels ) : __( 'Any day', 'booking' );
	}

	/**
	 * Find one complete record in a trusted presentation registry.
	 *
	 * @param array<int,array<string,mixed>> $records  Presentation records.
	 * @param string                         $key      Identity field.
	 * @param string                         $expected Expected identity.
	 *
	 * @return array<string,mixed> Matching record or an empty array.
	 */
	private function find_record( array $records, $key, $expected ) {
		foreach ( $records as $record ) {
			if ( is_array( $record ) && isset( $record[ $key ] ) && (string) $record[ $key ] === (string) $expected ) {
				return $record;
			}
		}

		return array();
	}

	/**
	 * Find an associative option label in grouped presentation records.
	 *
	 * @param array<int,array<string,mixed>> $groups         Group records.
	 * @param string                         $expected       Expected option value.
	 * @param string                         $fallback_label Label used when no option matches.
	 *
	 * @return string Matching label or fallback.
	 */
	private function find_grouped_option_label( array $groups, $expected, $fallback_label ) {
		foreach ( $groups as $group ) {
			if ( isset( $group['options'][ $expected ] ) && is_scalar( $group['options'][ $expected ] ) ) {
				return sanitize_text_field( (string) $group['options'][ $expected ] );
			}
		}

		return sanitize_text_field( (string) $fallback_label );
	}

	/**
	 * Find a label in grouped ordered presentation records.
	 *
	 * @param array<int,array<string,mixed>> $groups         Group records.
	 * @param string                         $key            Identity field.
	 * @param string                         $expected       Expected option value.
	 * @param string                         $fallback_label Label used when no option matches.
	 *
	 * @return string Matching label or fallback.
	 */
	private function find_grouped_record_label( array $groups, $key, $expected, $fallback_label ) {
		foreach ( $groups as $group ) {
			$record = $this->find_record( isset( $group['options'] ) && is_array( $group['options'] ) ? $group['options'] : array(), $key, $expected );
			if ( isset( $record['label'] ) ) {
				return sanitize_text_field( (string) $record['label'] );
			}
		}

		return sanitize_text_field( (string) $fallback_label );
	}

	/**
	 * Find one translated label in a trusted presentation registry.
	 *
	 * @param array<int,array<string,mixed>> $records       Presentation records.
	 * @param string                         $key           Identity field.
	 * @param string                         $expected      Expected identity.
	 * @param string                         $fallback_label Label used when no record matches.
	 *
	 * @return string Matching label or the fallback.
	 */
	private function find_record_label( array $records, $key, $expected, $fallback_label ) {
		foreach ( $records as $record ) {
			if ( isset( $record[ $key ], $record['label'] ) && (string) $record[ $key ] === (string) $expected ) {
				return sanitize_text_field( (string) $record['label'] );
			}
		}

		return sanitize_text_field( (string) $fallback_label );
	}

	/**
	 * Read one scalar dependency value.
	 *
	 * @param array<string,mixed> $consumer_context Dependency values keyed by step.
	 * @param string              $step_id          Dependency step identifier.
	 * @param string              $field_id         Field identifier.
	 *
	 * @return string Sanitized scalar value or an empty string.
	 */
	private function get_scalar_value( array $consumer_context, $step_id, $field_id ) {
		if ( ! isset( $consumer_context[ $step_id ][ $field_id ] ) || ! is_scalar( $consumer_context[ $step_id ][ $field_id ] ) ) {
			return '';
		}

		return sanitize_text_field( (string) $consumer_context[ $step_id ][ $field_id ] );
	}
}
