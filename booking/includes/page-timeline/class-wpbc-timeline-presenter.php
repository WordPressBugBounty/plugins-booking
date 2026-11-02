<?php
/**
 * Template-safe page view model for the administration Timeline shell.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build JSON-safe presentation data without reading bookings or Resources.
 */
final class WPBC_Timeline_Presenter {

	/**
	 * Build the complete read-only page view model.
	 *
	 * @param bool                $is_authorized Whether the current user passed page-read authorization.
	 * @param array<string,mixed> $initial_reads Authorized internal read-operation results.
	 *
	 * @return array<string,mixed> JSON-safe, template-ready page data.
	 */
	public function get_page_view_model( $is_authorized, $initial_reads = array() ) {
		$configuration        = wpbc_timeline_get_configuration();
		$initial_reads        = is_array( $initial_reads ) ? $initial_reads : array();
		$window_read          = isset( $initial_reads['window'] ) ? $initial_reads['window'] : array();
		$previous_window_read = isset( $initial_reads['previous_window'] ) ? $initial_reads['previous_window'] : array();
		$next_window_read     = isset( $initial_reads['next_window'] ) ? $initial_reads['next_window'] : array();
		$window_error         = is_wp_error( $window_read ) ? $this->map_error( $window_read ) : array();
		$window_data          = is_array( $window_read ) && ! is_wp_error( $window_read ) ? $window_read : array();
		$previous_window_data = is_array( $previous_window_read ) && ! is_wp_error( $previous_window_read ) ? $previous_window_read : array();
		$next_window_data     = is_array( $next_window_read ) && ! is_wp_error( $next_window_read ) ? $next_window_read : array();
		$window               = isset( $window_data['window'] ) && is_array( $window_data['window'] ) ? $window_data['window'] : array();
		$axis                 = isset( $window_data['axis'] ) && is_array( $window_data['axis'] )
			? $window_data['axis']
			: $this->build_fallback_axis( $configuration );
		$resources            = isset( $window_data['resources'] ) && is_array( $window_data['resources'] ) ? $window_data['resources'] : array();
		$segments             = isset( $window_data['segments'] ) && is_array( $window_data['segments'] ) ? $window_data['segments'] : array();
		$occupancy            = isset( $window_data['occupancy'] ) && is_array( $window_data['occupancy'] ) ? $window_data['occupancy'] : array();
		$time_slot_overflows  = isset( $window_data['time_slot_overflows'] ) && is_array( $window_data['time_slot_overflows'] ) ? $window_data['time_slot_overflows'] : array();
		$preferences          = isset( $window_data['preferences'] ) && is_array( $window_data['preferences'] ) ? $window_data['preferences'] : array();
		$window_context       = isset( $window_data['window_context'] ) && is_array( $window_data['window_context'] ) ? $window_data['window_context'] : array();
		$resource_view        = isset( $window_data['resource_view'] ) && is_array( $window_data['resource_view'] ) ? $window_data['resource_view'] : array();
		$resource_pagination  = isset( $window_data['resource_pagination'] ) && is_array( $window_data['resource_pagination'] ) ? $window_data['resource_pagination'] : array();
		$view_policy          = isset( $window_data['view_policy'] ) && is_array( $window_data['view_policy'] ) ? $window_data['view_policy'] : array();
		$timezone             = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$today_date           = ( new DateTimeImmutable( 'today', $timezone ) )->format( 'Y-m-d' );
		$new_booking_action    = array();

		/**
		 * Filters the authorized Timeline New Booking toolbar action.
		 *
		 * The default is intentionally empty. The development-gated creation
		 * domain supplies a data-only action only after repeating canonical Add
		 * Booking and MultiUser authorization.
		 *
		 * @since 12.0.0
		 *
		 * @param array<string,mixed> $new_booking_action Empty or authorized action DTO.
		 * @param bool                $is_authorized      Whether Timeline read access passed.
		 */
		$new_booking_action = apply_filters( 'wpbc_timeline_new_booking_action', $new_booking_action, (bool) $is_authorized );
		$new_booking_action = is_array( $new_booking_action ) ? $new_booking_action : array();

		return array(
			'component_id'            => $configuration['component_id'],
			'template_pack'           => $configuration['default_template_pack'],
			'templates'               => $configuration['template_packs'][ $configuration['default_template_pack'] ],
			'navigation_pack'         => $configuration['default_navigation_pack'],
			'shared_ui'               => array(
				'templates' => array(
					'dropdown'               => WPBC_Shared_UI_Dropdown::get_template_id(),
					'inspector'              => WPBC_Shared_UI_Inspector::get_template_id(),
					'date_range_navigation'  => WPBC_Shared_UI_Date_Range_Navigation::get_template_id(),
					'date_jump'              => WPBC_Shared_UI_Date_Jump::get_template_id(),
					'context_popover_button' => WPBC_Shared_UI_Context_Popover::get_control_button_template_id(),
				),
				'first_day' => min( 6, absint( get_bk_option( 'booking_start_day_weeek' ) ) ),
				'today_date' => $today_date,
			),
			'booking_inspector'       => $is_authorized ? WPBC_Booking_Inspector_Config::get_browser_configuration( WPBC_Booking_Inspector_Config::SOURCE_TIMELINE ) : array(),
			'new_booking'             => $new_booking_action,
			'booking_overview_tooltip' => $is_authorized ? WPBC_Booking_Overview_Tooltip_Config::get_browser_configuration() : array(),
			'booking_resizing'        => $is_authorized ? WPBC_Timeline_Booking_Resizing_Config::get_browser_configuration() : array(),
			'resource_navigation'     => $is_authorized ? WPBC_Timeline_Resource_Navigation_Config::get_browser_configuration() : array(),
			'resource_settings'       => $is_authorized ? WPBC_Timeline_Resource_Settings_Config::get_browser_configuration() : array(),
			'extensions'              => $is_authorized ? $this->get_browser_extensions() : array(),
			'resource_upgrade'        => array(
				'visible' => (bool) $is_authorized && ! class_exists( 'wpdev_bk_personal' ),
			),
			'is_authorized'           => (bool) $is_authorized,
			'is_rtl'                  => is_rtl(),
			'axis'                    => $axis,
			'window'                  => $window,
			'window_context'          => $window_context,
			'resource_view'           => $resource_view,
			'resource_pagination'     => $resource_pagination,
			'view_policy'             => $view_policy,
			'availability_sources'    => class_exists( 'WPBC_Timeline_Unavailable_Days_BG_Projection' )
				? array_values( WPBC_Timeline_Unavailable_Days_BG_Projection::get_source_definitions() )
				: array(),
			'initial_previous_window' => $previous_window_data,
			'initial_next_window'     => $next_window_data,
			'metadata'                => isset( $initial_reads['metadata'] ) && is_array( $initial_reads['metadata'] ) ? $initial_reads['metadata'] : array(),
			'transport'               => isset( $initial_reads['transport'] ) && is_array( $initial_reads['transport'] ) ? $initial_reads['transport'] : array(),
			'initial'         => array(
				'load_state'  => ! $is_authorized ? 'unauthorized' : ( empty( $window_error ) ? 'loaded' : 'error' ),
				'resources'   => $resources,
				'segments'    => $segments,
				'occupancy'   => $occupancy,
				'time_slot_overflows' => $time_slot_overflows,
				'error'       => $window_error,
				'diagnostics' => isset( $window_data['diagnostics'] ) && is_array( $window_data['diagnostics'] ) ? $window_data['diagnostics'] : array(),
			),
			'preferences'     => $preferences,
			'links'           => array(
				'legacy_timeline' => add_query_arg( array( 'page' => 'wpbc', 'tab' => 'vm_calendar' ), admin_url( 'admin.php' ) ),
			),
			'i18n'            => array(
				'resource_heading'     => __( 'Booking resources', 'booking' ),
				'canvas_heading'       => __( 'Timeline schedule', 'booking' ),
				'toolbar_label'        => __( 'Timeline controls', 'booking' ),
				'range_label'          => $axis['range_label'],
				'advanced_combination_label' => __( 'Timeline range and scale', 'booking' ),
				'advanced_combination_description' => __( 'Choose one of the available date-range and cell-scale combinations. Large combinations can be reduced to remain within the authorized cell budget.', 'booking' ),
				/* translators: 1: Timeline date-range label. 2: Timeline cell-scale label. */
				'advanced_combination_format' => __( '%1$s — %2$s', 'booking' ),
				'custom_range'         => __( 'Custom range', 'booking' ),
				'visual_zoom_short_label' => __( 'Density', 'booking' ),
				'visual_zoom_label'    => __( 'Timeline cell width', 'booking' ),
				'visual_zoom_description' => __( 'Change the visual width of Timeline cells from 30 to 300 percent. Booking times and loaded data do not change.', 'booking' ),
				/* translators: {percent}: visual Timeline cell-width percentage. */
				'visual_zoom_updated'  => __( 'Timeline cell width: {percent}%.', 'booking' ),
				'previous_window'      => __( 'Previous Timeline window', 'booking' ),
				'next_window'          => __( 'Next Timeline window', 'booking' ),
				'choose_date_range'     => __( 'Choose Timeline dates', 'booking' ),
				'start_date'            => __( 'Start date', 'booking' ),
				'end_date'              => __( 'End date', 'booking' ),
				'apply_date_range'      => __( 'Apply', 'booking' ),
				'reset_date_range'      => __( 'Reset dates', 'booking' ),
				'cancel'                => __( 'Cancel', 'booking' ),
				'invalid_date_range'    => __( 'Enter a valid start and end date. The end date cannot be before the start date.', 'booking' ),
				'maximum_date_range'    => sprintf(
					/* translators: %d: maximum number of Timeline calendar days. */
					__( 'Select no more than %d calendar days.', 'booking' ),
					absint( $configuration['limits']['maximum_window_days'] )
				),
				'today'                => __( 'Today', 'booking' ),
				'choose_jump_date'     => __( 'Choose a date to show in the Timeline', 'booking' ),
				'jump_date'            => __( 'Timeline date', 'booking' ),
				'reset_timeline'       => __( 'Reset', 'booking' ),
				'reset_timeline_description' => __( 'Reset Timeline filters and Resource display preferences to their defaults', 'booking' ),
				'resetting_timeline'   => __( 'Resetting Timeline display preferences', 'booking' ),
				'timeline_reset'       => __( 'Timeline display preferences reset to their defaults.', 'booking' ),
				'timeline_reset_failed' => __( 'The Timeline display preferences could not be reset. Reload the page and try again.', 'booking' ),
				'window_reduced'       => __( 'The Timeline range was reduced to remain within the authorized cell budget.', 'booking' ),
				'combination_loaded'   => __( 'Timeline range and scale updated.', 'booking' ),
				'loading'              => __( 'Loading Timeline', 'booking' ),
				'loading_previous_window' => __( 'Loading the previous Timeline period', 'booking' ),
				'loading_next_window'   => __( 'Loading the next Timeline period', 'booking' ),
				'loading_today'         => __( 'Loading today in the Timeline', 'booking' ),
				'loading_selected_date' => __( 'Loading the selected date in the Timeline', 'booking' ),
				'selected_date_loaded'  => __( 'Timeline moved to the selected date.', 'booking' ),
				'loading_timeline_combination' => __( 'Updating Timeline range and scale', 'booking' ),
				'loading_date_range'    => __( 'Updating the Timeline date range', 'booking' ),
				'loading_reduced_window' => __( 'Loading a narrower Timeline range', 'booking' ),
				'reloading_timeline'    => __( 'Reloading the Timeline', 'booking' ),
				'load_previous_dates'   => __( 'Load previous dates', 'booking' ),
				'load_next_dates'       => __( 'Load next dates', 'booking' ),
				'loading_previous_dates' => __( 'Loading previous dates', 'booking' ),
				'loading_next_dates'    => __( 'Loading next dates', 'booking' ),
				'cancel_loading'        => __( 'Cancel loading', 'booking' ),
				'loading_cancelled'      => __( 'Adjacent Timeline loading cancelled.', 'booking' ),
				'still_loading'         => __( 'This is taking longer than expected.', 'booking' ),
				'edge_load_failed'      => __( 'These dates could not be loaded. The current Timeline is still available.', 'booking' ),
				'retry_loading_dates'   => __( 'Retry loading dates', 'booking' ),
				'adjacent_dates_loaded' => __( 'Adjacent Timeline dates loaded.', 'booking' ),
				'open_legacy_timeline' => __( 'Open current Timeline View', 'booking' ),
				'error_title'          => __( 'Timeline could not be displayed', 'booking' ),
				'error_message'        => __( 'Reload the page. If the problem continues, use the current Timeline View.', 'booking' ),
				'retry'                => __( 'Reload Timeline', 'booking' ),
				'unauthorized_title'   => __( 'Timeline access is unavailable', 'booking' ),
				'unauthorized_message' => __( 'Your WordPress or Booking Calendar account cannot open this page.', 'booking' ),
				'expand_resource'      => __( 'Expand Resource row', 'booking' ),
				'collapse_resource'    => __( 'Collapse Resource row', 'booking' ),
				'show_resource_presentation' => __( 'Show {label}', 'booking' ),
				'hide_resource_presentation' => __( 'Hide {label}', 'booking' ),
				'show_resource_group_presentation' => __( 'Show {label} for all Resources in {resource}', 'booking' ),
				'hide_resource_group_presentation' => __( 'Hide {label} for all Resources in {resource}', 'booking' ),
				'approved'             => __( 'Approved', 'booking' ),
				'pending'              => __( 'Pending', 'booking' ),
				'available'            => __( 'Available', 'booking' ),
				'unavailable'          => __( 'Unavailable', 'booking' ),
				'legend_label'         => __( 'Timeline status legend', 'booking' ),
				'status_empty'         => __( 'No Timeline booking data is loaded.', 'booking' ),
				'status_ready'         => __( 'Timeline booking data is loaded.', 'booking' ),
				'loading_availability_backgrounds' => __( 'Loading unavailable-time backgrounds…', 'booking' ),
				'timeline_refresh_complete' => __( 'Timeline bookings and unavailable-time backgrounds are loaded.', 'booking' ),
				'availability_load_failed' => __( 'Unavailable-time backgrounds could not be loaded. The booking Timeline remains available.', 'booking' ),
				'status_unauthorized'  => __( 'Timeline access is unavailable.', 'booking' ),
				'capacity'             => __( 'Capacity', 'booking' ),
				'child_resources'      => __( 'Child Resources', 'booking' ),
				'parent_resource'      => __( 'Parent', 'booking' ),
				'expand_children'      => __( 'Show child Resources', 'booking' ),
				'collapse_children'    => __( 'Hide child Resources', 'booking' ),
				'continues_before'     => __( 'Booking continues before this window', 'booking' ),
				'continues_after'      => __( 'Booking continues after this window', 'booking' ),
				'selection_preview'    => __( 'Selected Timeline range', 'booking' ),
				'selection_start_handle' => __( 'Adjust selection start', 'booking' ),
				'selection_end_handle' => __( 'Adjust selection end', 'booking' ),
				'selection_days_short' => __( '%s d', 'booking' ),
				'selection_hours_short' => __( '%s h', 'booking' ),
				'selection_minutes_short' => __( '%s min', 'booking' ),
				'cancel_selection'     => __( 'Cancel selection', 'booking' ),
				'checking_selection'   => __( 'Checking availability and permitted actions…', 'booking' ),
				'applying_availability' => __( 'Updating Availability…', 'booking' ),
				'retry_selection'      => __( 'Retry selection preview', 'booking' ),
				'availability_requires_review' => __( 'Availability or required booking context needs review in the canonical workflow.', 'booking' ),
				'selection_instructions' => __( 'Drag an empty Timeline row, tap two boundaries, or use Enter and Shift plus arrow keys to select a range. Drag either selection handle, or focus it and use the arrow, Home, or End keys, to adjust one boundary. Press Escape to cancel.', 'booking' ),
				'selected_booking'      => __( 'Selected', 'booking' ),
				'time_slot_more'        => __( '+{count} more', 'booking' ),
				'time_slot_more_label'  => __( 'Show {count} more bookings on {date}', 'booking' ),
				'time_slot_more_heading' => __( 'More bookings on {date}', 'booking' ),
				'close_time_slot_bookings' => __( 'Close additional bookings', 'booking' ),
				'selection_ready'      => __( 'Timeline range selected. Loading permitted actions.', 'booking' ),
				'selection_cancelled'  => __( 'Timeline selection cancelled.', 'booking' ),
			),
		);
	}

	/**
	 * Return executable-free browser extension registrations.
	 *
	 * Extensions receive only their own normalized scalar/array configuration
	 * and explicitly allow-listed shared-controller capability names. They do not
	 * receive server objects, callbacks, template paths, or mutation authority
	 * through the serialized contract.
	 *
	 * @return array<int,array<string,mixed>> Ordered browser extension records.
	 */
	private function get_browser_extensions() {
		$extensions          = apply_filters( 'wpbc_timeline_browser_extensions', array() );
		$normalized_records  = array();
		$registered_instances = array();

		foreach ( is_array( $extensions ) ? $extensions : array() as $extension ) {
			$module_id   = isset( $extension['module_id'] ) && is_scalar( $extension['module_id'] ) ? (string) $extension['module_id'] : '';
			$instance_id = isset( $extension['instance_id'] ) && is_scalar( $extension['instance_id'] ) ? (string) $extension['instance_id'] : '';
			$capabilities = array_values(
				array_intersect(
					array( 'selection_actions' ),
					array_map(
						'sanitize_key',
						array_filter(
							isset( $extension['capabilities'] ) && is_array( $extension['capabilities'] ) ? $extension['capabilities'] : array(),
							'is_scalar'
						)
					)
				)
			);
			$configuration = isset( $extension['configuration'] )
				? $this->normalize_browser_extension_value( $extension['configuration'], 0 )
				: array();

			if (
				! preg_match( '/^[a-z][a-z0-9_-]{0,63}$/', $module_id )
				|| ! preg_match( '/^[a-z][a-z0-9_-]{0,63}$/', $instance_id )
				|| isset( $registered_instances[ $instance_id ] )
				|| ! is_array( $configuration )
			) {
				continue;
			}
			$registered_instances[ $instance_id ] = true;
			$normalized_records[]                 = array(
				'module_id'     => $module_id,
				'instance_id'   => $instance_id,
				'capabilities'  => $capabilities,
				'configuration' => $configuration,
			);
		}

		return $normalized_records;
	}

	/**
	 * Recursively normalize one JSON-safe browser extension value.
	 *
	 * @param mixed $extension_value Candidate configuration value.
	 * @param int   $depth           Current bounded recursion depth.
	 *
	 * @return mixed Normalized scalar/array value, or null when rejected.
	 */
	private function normalize_browser_extension_value( $extension_value, $depth ) {
		if ( 6 < $depth ) {
			return null;
		}
		if ( is_null( $extension_value ) || is_bool( $extension_value ) || is_int( $extension_value ) || is_float( $extension_value ) ) {
			return $extension_value;
		}
		if ( is_string( $extension_value ) ) {
			return sanitize_text_field( $extension_value );
		}
		if ( ! is_array( $extension_value ) ) {
			return null;
		}

		$normalized_array = array();
		foreach ( $extension_value as $extension_key => $nested_value ) {
			$normalized_key = is_int( $extension_key ) ? $extension_key : sanitize_key( (string) $extension_key );
			if ( ! is_int( $normalized_key ) && '' === $normalized_key ) {
				continue;
			}
			$normalized_array[ $normalized_key ] = $this->normalize_browser_extension_value( $nested_value, $depth + 1 );
		}

		return $normalized_array;
	}

	/**
	 * Build a safe axis when no authorized initial window is available.
	 *
	 * @param array<string,mixed> $configuration Timeline configuration.
	 *
	 * @return array<string,mixed> Shared axis DTO.
	 */
	private function build_fallback_axis( $configuration ) {
		$timezone     = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$first_day    = new DateTimeImmutable( 'today', $timezone );
		$window_days  = absint( $configuration['limits']['default_window_days'] );
		$axis_service = new WPBC_Timeline_Axis();
		$last_day     = $first_day->modify( '+' . $window_days . ' days' );

		return $axis_service->build_axis(
			array(
				'view'         => sanitize_key( $configuration['default_view'] ),
				'cell_minutes' => absint( $configuration['supported_views'][ $configuration['default_view'] ]['cell_minutes'] ),
				'timezone'     => $timezone->getName(),
				'start_date'   => $first_day->format( 'Y-m-d' ),
				'end_date'     => $last_day->format( 'Y-m-d' ),
				'start_at'     => $first_day->format( 'Y-m-d\TH:i:sP' ),
				'end_at'       => $last_day->format( 'Y-m-d\TH:i:sP' ),
				'anchor_at'    => $first_day->format( 'Y-m-d\TH:i:sP' ),
			)
		);
	}

	/**
	 * Convert a domain error to the safe presentation contract.
	 *
	 * @param WP_Error $error Domain error.
	 *
	 * @return array<string,mixed> Template-safe error values.
	 */
	private function map_error( $error ) {
		$error_data = $error->get_error_data();

		return array(
			'code'                  => sanitize_key( $error->get_error_code() ),
			'message'               => sanitize_text_field( $error->get_error_message() ),
			'suggested_window_days' => is_array( $error_data ) && isset( $error_data['suggested_window_days'] ) ? absint( $error_data['suggested_window_days'] ) : 0,
			'suggested_resources'   => is_array( $error_data ) && isset( $error_data['suggested_resources'] ) ? absint( $error_data['suggested_resources'] ) : 0,
		);
	}
}
