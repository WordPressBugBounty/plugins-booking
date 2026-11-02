<?php
/**
 * Authorized, internal-only Timeline read operations.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Orchestrate Timeline read services without registering a public handler.
 */
final class WPBC_Timeline_Read_Operations {
	/** @var WPBC_Timeline_Axis Shared time-axis authority. */
	private $axis;


	/** @var WPBC_Timeline_Authorization Page-read authorization. */
	private $authorization;

	/** @var WPBC_Timeline_Request_Validator Request validator. */
	private $validator;

	/** @var WPBC_Timeline_Resource_Repository Resource repository. */
	private $resource_repository;

	/** @var WPBC_Timeline_Booking_Repository Booking repository. */
	private $booking_repository;

	/** @var WPBC_Timeline_DTO_Mapper DTO mapper. */
	private $dto_mapper;

	/** @var WPBC_Timeline_Availability_Provider Availability provider. */
	private $availability_provider;

	/** @var WPBC_Timeline_Rates_Provider Rates provider. */
	private $rates_provider;

	/** @var WPBC_Timeline_Preferences Preference reader. */
	private $preferences;

	/** @var WPBC_Timeline_Payload_Guard Payload guard. */
	private $payload_guard;

	/** @var WPBC_Timeline_Resource_View_Service Persisted Resource-view service. */
	private $resource_view_service;

	/** @var callable|null Optional absolute database query counter for deterministic tests. */
	private $query_count_callback;

	/**
	 * Construct the internal read facade.
	 *
	 * @param WPBC_Timeline_Authorization|null        $authorization        Optional authorization service.
	 * @param WPBC_Timeline_Request_Validator|null    $validator            Optional request validator.
	 * @param WPBC_Timeline_Resource_Repository|null  $resource_repository  Optional Resource repository.
	 * @param WPBC_Timeline_Booking_Repository|null   $booking_repository   Optional booking repository.
	 * @param WPBC_Timeline_DTO_Mapper|null           $dto_mapper           Optional DTO mapper.
	 * @param WPBC_Timeline_Availability_Provider|null $availability_provider Optional availability provider.
	 * @param WPBC_Timeline_Rates_Provider|null       $rates_provider       Optional rates provider.
	 * @param WPBC_Timeline_Preferences|null          $preferences          Optional preference reader.
	 * @param WPBC_Timeline_Payload_Guard|null        $payload_guard        Optional payload guard.
	 * @param WPBC_Timeline_Axis|null                 $axis                 Optional shared time axis.
	 * @param WPBC_Timeline_Resource_View_Service|null $resource_view_service Optional Resource-view service.
	 * @param callable|null                           $query_count_callback Optional absolute query counter.
	 */
	public function __construct(
		$authorization = null,
		$validator = null,
		$resource_repository = null,
		$booking_repository = null,
		$dto_mapper = null,
		$availability_provider = null,
		$rates_provider = null,
		$preferences = null,
		$payload_guard = null,
		$axis = null,
		$resource_view_service = null,
		$query_count_callback = null
	) {
		$this->axis                  = $axis ? $axis : new WPBC_Timeline_Axis();
		$this->authorization         = $authorization ? $authorization : new WPBC_Timeline_Authorization();
		$this->validator             = $validator ? $validator : new WPBC_Timeline_Request_Validator( $this->axis );
		$this->resource_repository   = $resource_repository ? $resource_repository : new WPBC_Timeline_Resource_Repository();
		$this->booking_repository    = $booking_repository ? $booking_repository : new WPBC_Timeline_Booking_Repository();
		$this->dto_mapper            = $dto_mapper ? $dto_mapper : new WPBC_Timeline_DTO_Mapper( $this->axis );
		$this->availability_provider = $availability_provider ? $availability_provider : new WPBC_Timeline_Availability_Provider();
		$this->rates_provider        = $rates_provider ? $rates_provider : new WPBC_Timeline_Rates_Provider();
		$this->preferences           = $preferences ? $preferences : new WPBC_Timeline_Preferences();
		$this->payload_guard         = $payload_guard ? $payload_guard : new WPBC_Timeline_Payload_Guard();
		$this->resource_view_service = $resource_view_service ? $resource_view_service : new WPBC_Timeline_Resource_View_Service(
			$this->authorization,
			$this->resource_repository
		);
		$this->query_count_callback = is_callable( $query_count_callback ) ? $query_count_callback : null;
	}

	/**
	 * Return executable-free bootstrap metadata.
	 *
	 * @return array<string,mixed>|WP_Error Metadata or authorization error.
	 */
	public function get_bootstrap_metadata() {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$configuration                 = wpbc_timeline_get_configuration();
		$views                        = array();
		$presets                      = array();
		$preset_view_policies          = array();
		$range_scale_options           = array();
		$range_scale_option_values     = array();
		$configured_range_scale_options = array();
		if ( isset( $configuration['range_scale_options'] ) && is_array( $configuration['range_scale_options'] ) ) {
			$configured_range_scale_options = $configuration['range_scale_options'];
		}
		foreach ( $configuration['supported_views'] as $view_id => $view ) {
			$views[] = array(
				'id'           => sanitize_key( $view_id ),
				'cell_minutes' => absint( $view['cell_minutes'] ),
				'label'        => sanitize_text_field( $view['label'] ),
			);
		}
		foreach ( $configuration['presets'] as $preset_id => $preset ) {
			$preset_view_policy                 = $this->validator->get_maximum_resource_preset_view_policy( $preset, $preset_id );
			$preset_view_policies[ $preset_id ] = $preset_view_policy;
			$presets[] = array(
				'id'            => sanitize_key( $preset_id ),
				'window_days'   => absint( $preset['window_days'] ),
				'window_months' => absint( $preset['window_months'] ),
				'view'          => sanitize_key( $preset['view'] ),
				'locks_view'    => ! empty( $preset['locks_view'] ),
				'label'         => sanitize_text_field( $preset['label'] ),
				'allowed_views' => array_values( array_map( 'sanitize_key', $preset_view_policy['allowed_views'] ) ),
			);
		}
		foreach ( $configured_range_scale_options as $range_scale_option ) {
			if ( ! is_array( $range_scale_option ) ) {
				continue;
			}
			$option_value = sanitize_key( isset( $range_scale_option['value'] ) ? $range_scale_option['value'] : '' );
			$option_title = sanitize_text_field( isset( $range_scale_option['title'] ) ? $range_scale_option['title'] : '' );
			$preset_id    = sanitize_key( isset( $range_scale_option['preset_id'] ) ? $range_scale_option['preset_id'] : '' );
			$view_id      = sanitize_key( isset( $range_scale_option['view_id'] ) ? $range_scale_option['view_id'] : '' );

			if (
				'' === $option_value
				|| '' === $option_title
				|| isset( $range_scale_option_values[ $option_value ] )
				|| ! isset( $configuration['presets'][ $preset_id ], $configuration['supported_views'][ $view_id ], $preset_view_policies[ $preset_id ] )
				|| ! in_array( $view_id, $preset_view_policies[ $preset_id ]['allowed_views'], true )
			) {
				continue;
			}

			$preset                                     = $configuration['presets'][ $preset_id ];
			$range_scale_option_values[ $option_value ] = true;
			$range_scale_options[]                       = array(
				'value'         => $option_value,
				'title'         => $option_title,
				'preset_id'     => $preset_id,
				'preset_title'  => sanitize_text_field( $preset['label'] ),
				'view_id'       => $view_id,
				'window_days'   => absint( $preset['window_days'] ),
				'window_months' => absint( $preset['window_months'] ),
			);
		}
		return array(
			'component_id'        => sanitize_key( $configuration['component_id'] ),
			'default_view'        => sanitize_key( $configuration['default_view'] ),
			'default_preset'      => sanitize_key( $configuration['default_preset'] ),
			'default_window_request' => wpbc_timeline_get_default_window_request(),
			'views'               => $views,
			'presets'             => $presets,
			'range_scale_options' => $range_scale_options,
			'limits'              => array_map( 'absint', $configuration['limits'] ),
			'window_loading'      => array_map( 'absint', $configuration['window_loading'] ),
			'visual_zoom'         => array(
				'min_percent'     => absint( $configuration['visual_zoom']['min_percent'] ),
				'max_percent'     => absint( $configuration['visual_zoom']['max_percent'] ),
				'step_percent'    => absint( $configuration['visual_zoom']['step_percent'] ),
				'default_percent' => absint( $configuration['visual_zoom']['default_percent'] ),
			),
			'transport'           => 'authenticated-admin-ajax',
			'read_only'           => true,
		);
	}

	/**
	 * Return one authorized Resource page.
	 *
	 * @param mixed $request_values Untrusted Resource query.
	 *
	 * @return array<string,mixed>|WP_Error Data-only response or error.
	 */
	public function get_resources( $request_values = array() ) {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$query_start = $this->get_absolute_query_count();
		$query       = $this->validator->normalize_resource_request( $request_values );
		$page        = $this->resource_repository->get_resource_page( $query );
		if ( is_wp_error( $page ) ) {
			return $page;
		}

		$resource_dtos = array();
		foreach ( $page['resources'] as $resource ) {
			$resource_dtos[] = $this->dto_mapper->map_resource( $resource );
		}
		$payload = array(
			'resources'  => $resource_dtos,
			'pagination' => $page['pagination'],
		);

		return $this->payload_guard->guard( $payload, $this->get_query_count( $query_start ) );
	}

	/**
	 * Return booking spans and occupancy for one bounded window.
	 *
	 * @param mixed $request_values Untrusted read values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only response or error.
	 */
	public function get_window( $request_values = array() ) {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$query_start = $this->get_absolute_query_count();
		$context     = $this->get_authorized_window_context( $request_values );
		if ( is_wp_error( $context ) ) {
			return $context;
		}

		$records = $this->booking_repository->get_window_records( $context['resource_ids'], $context['window'] );
		if ( is_wp_error( $records ) ) {
			return $records;
		}

		$axis       = $this->axis->build_axis( $context['window'] );
		$projection = $this->dto_mapper->map_booking_window(
			$records,
			$context['window'],
			$this->validator->normalize_visible_statuses( $request_values ),
			$axis
		);
		$resource_dtos = array_map( array( $this->dto_mapper, 'map_resource' ), $context['resources'] );
		foreach ( $resource_dtos as &$resource_dto ) {
			$resource_id               = absint( $resource_dto['id'] );
			$resource_dto['lane_count'] = isset( $projection['lane_counts'][ $resource_id ] ) ? absint( $projection['lane_counts'][ $resource_id ] ) : 1;
		}
		unset( $resource_dto );
		$payload = array(
			'window'         => $context['window'],
			'axis'           => $axis,
			'resources'      => $resource_dtos,
			'segments'       => $projection['segments'],
			'occupancy'      => $projection['occupancy'],
			'time_slot_overflows' => isset( $projection['time_slot_overflows'] ) ? $projection['time_slot_overflows'] : array(),
			'preferences'    => $this->preferences->get_preferences( $context['resources'] ),
			'resource_view'  => $context['resource_view'],
			'resource_pagination' => $context['resource_pagination'],
			'window_context' => $this->build_window_context( $context['window'], $context['resource_ids'], $context['resource_view_context'] ),
			'view_policy'    => $this->validator->get_view_policy( $context['window'], count( $context['resource_ids'] ) ),
		);

		return $this->payload_guard->guard( $payload, $this->get_query_count( $query_start ), count( $projection['segments'] ) );
	}

	/**
	 * Load the authorized period immediately before an initial Timeline window.
	 *
	 * The browser composes this response with the current window before its
	 * first anchor restoration. The same server-built adjacent descriptor,
	 * exact authorized Resource IDs, and bounded get_window() validation are
	 * reused instead of creating a separate trust path for page bootstrap.
	 *
	 * @param mixed $current_window Current authorized window response or error.
	 *
	 * @return array<string,mixed> Authorized previous-window DTO, or an empty array when unavailable.
	 */
	public function get_initial_previous_window( $current_window ) {
		return $this->get_initial_adjacent_window( $current_window, 'previous' );
	}

	/**
	 * Load the authorized period immediately after an initial Timeline window.
	 *
	 * Preloading both neighbors lets the first browser render compose a bounded
	 * previous/current/next set without exposing an unloaded edge beside the
	 * selected period.
	 *
	 * @param mixed $current_window Current authorized window response or error.
	 *
	 * @return array<string,mixed> Authorized next-window DTO, or an empty array when unavailable.
	 */
	public function get_initial_next_window( $current_window ) {
		return $this->get_initial_adjacent_window( $current_window, 'next' );
	}

	/**
	 * Load one authorized adjacent period for the initial Timeline cache.
	 *
	 * The current response supplies the allow-listed adjacent descriptor and
	 * exact authorized Resource IDs. The normal window reader then repeats all
	 * authorization, validation, query, DTO, and payload-budget checks.
	 *
	 * @param mixed  $current_window Current authorized window response or error.
	 * @param string $direction      Allow-listed adjacent direction.
	 *
	 * @return array<string,mixed> Authorized adjacent-window DTO, or an empty array when unavailable.
	 */
	private function get_initial_adjacent_window( $current_window, $direction ) {
		if ( ! is_array( $current_window ) || is_wp_error( $current_window ) ) {
			return array();
		}
		if ( ! in_array( $direction, array( 'previous', 'next' ), true ) ) {
			return array();
		}

		$window_context = isset( $current_window['window_context'] ) && is_array( $current_window['window_context'] )
			? $current_window['window_context']
			: array();
		$adjacent_reads = isset( $window_context['adjacent_requests'] ) && is_array( $window_context['adjacent_requests'] )
			? $window_context['adjacent_requests']
			: array();
		$adjacent_request = isset( $adjacent_reads[ $direction ] ) && is_array( $adjacent_reads[ $direction ] )
			? $adjacent_reads[ $direction ]
			: array();
		$resource_view_context = isset( $window_context['resource_view_context'] ) && is_scalar( $window_context['resource_view_context'] )
			? sanitize_text_field( (string) $window_context['resource_view_context'] )
			: '';

		if ( empty( $adjacent_request ) || '' === $resource_view_context ) {
			return array();
		}

		$adjacent_request['resource_view_context'] = $resource_view_context;
		$adjacent_window                            = $this->get_window( $adjacent_request );

		return is_array( $adjacent_window ) && ! is_wp_error( $adjacent_window ) ? $adjacent_window : array();
	}

	/**
	 * Return the lazy availability layer for one bounded window.
	 *
	 * @param mixed $request_values Untrusted read values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only response or error.
	 */
	public function get_availability( $request_values = array() ) {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$query_start = $this->get_absolute_query_count();
		$context     = $this->get_authorized_window_context( $request_values );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		$booking_query_window = $this->availability_provider->get_booking_query_window( $context['resources'], $context['window'] );
		$records = $this->booking_repository->get_window_records( $context['resource_ids'], $booking_query_window );
		if ( is_wp_error( $records ) ) {
			return $records;
		}
		$axis           = $this->axis->build_axis( $context['window'] );
		$booking_window = $this->dto_mapper->map_booking_window( $records, $context['window'], array( 'approved', 'pending' ), $axis );
		$availability   = $this->availability_provider->get_availability( $context['resources'], $context['window'], $booking_window );
		if ( is_wp_error( $availability ) ) {
			return $availability;
		}
		$availability['window']       = $context['window'];
		$availability['resource_ids'] = array_values( $context['resource_ids'] );
		$availability['axis']         = $axis;

		$interval_count = isset( $availability['intervals'] ) && is_array( $availability['intervals'] )
			? count( $availability['intervals'] )
			: 0;

		return $this->payload_guard->guard(
			$availability,
			$this->get_query_count( $query_start ),
			count( $booking_window['segments'] ),
			$interval_count
		);
	}

	/**
	 * Return the lazy read-only rates layer for one bounded window.
	 *
	 * @param mixed $request_values Untrusted read values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only response or error.
	 */
	public function get_rates( $request_values = array() ) {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$query_start = $this->get_absolute_query_count();
		$context     = $this->get_authorized_window_context( $request_values );
		if ( is_wp_error( $context ) ) {
			return $context;
		}
		$rates = $this->rates_provider->get_rates( $context['resources'], $context['window'] );
		if ( is_wp_error( $rates ) ) {
			return $rates;
		}
		$rates['axis'] = $this->axis->build_axis( $context['window'] );

		return $this->payload_guard->guard( $rates, $this->get_query_count( $query_start ) );
	}

	/**
	 * Return approved per-user Resource presentation preferences.
	 *
	 * @param mixed $request_values Untrusted Resource paging values.
	 *
	 * @return array<string,mixed>|WP_Error Preference response or error.
	 */
	public function get_resource_preferences( $request_values = array() ) {
		$authorized = $this->authorize();
		if ( is_wp_error( $authorized ) ) {
			return $authorized;
		}

		$query = $this->validator->normalize_resource_request( $request_values );
		$page  = $this->resource_repository->get_resource_page( $query );
		if ( is_wp_error( $page ) ) {
			return $page;
		}

		return array( 'preferences' => $this->preferences->get_preferences( $page['resources'] ) );
	}

	/**
	 * Load and validate the authorized Resource/window context.
	 *
	 * @param mixed $request_values Untrusted read values.
	 *
	 * @return array<string,mixed>|WP_Error Authorized context or safe error.
	 */
	private function get_authorized_window_context( $request_values ) {
		$request_values    = is_array( $request_values ) ? $request_values : array();
		$requested_ids     = array();
		$has_requested_ids = array_key_exists( 'resource_ids', $request_values );
		$has_view_context  = isset( $request_values['resource_view_context'] ) && is_scalar( $request_values['resource_view_context'] );
		if ( $has_view_context ) {
			$resource_result = $this->resource_view_service->resolve_signed( $request_values['resource_view_context'] );
			if ( is_wp_error( $resource_result ) ) {
				return $resource_result;
			}
			$resources             = $resource_result['resources'];
			$resource_view         = $resource_result['resource_view'];
			$resource_pagination   = $resource_result['resource_pagination'];
			$resource_view_context = $resource_result['resource_view_context'];
		} elseif ( $has_requested_ids ) {
			$requested_ids = $this->validate_requested_resource_ids( $request_values['resource_ids'] );
			if ( is_wp_error( $requested_ids ) ) {
				return $requested_ids;
			}
			$resources = $this->resource_repository->get_authorized_resources_by_ids( $requested_ids );
			if ( is_wp_error( $resources ) ) {
				return $resources;
			}
			if ( count( $resources ) !== count( $requested_ids ) ) {
				return $this->get_not_found_error();
			}
			$resource_pagination = array(
				'page'         => 1,
				'per_page'     => count( $resources ),
				'total_items'  => count( $resources ),
				'total_pages'  => 1,
				'unit'         => 'resource',
				'has_previous' => false,
				'has_next'     => false,
			);
			$resource_view = array(
				'selection_mode'        => WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_EXPLICIT,
				'selected_resource_ids' => $requested_ids,
				'page'                  => 1,
				'per_page'              => max( 1, count( $resources ) ),
				'expanded_resource_ids' => array(),
				'expanded_parent_ids'   => array(),
			);
			$resource_view_context = '';
		} else {
			$resource_result = $this->resource_view_service->resolve_initial();
			if ( is_wp_error( $resource_result ) ) {
				return $resource_result;
			}
			$resources             = $resource_result['resources'];
			$resource_view         = $resource_result['resource_view'];
			$resource_pagination   = $resource_result['resource_pagination'];
			$resource_view_context = $resource_result['resource_view_context'];
		}

		$resource_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ) );
		$window       = $this->validator->normalize_window_request( $request_values, count( $resource_ids ) );
		if ( is_wp_error( $window ) ) {
			return $window;
		}

		return array(
			'resources'             => $resources,
			'resource_ids'          => $resource_ids,
			'resource_view'         => $resource_view,
			'resource_pagination'   => $resource_pagination,
			'resource_view_context' => $resource_view_context,
			'window'                => $window,
		);
	}

	/**
	 * Build an opaque cache identity and bounded adjacent-window descriptors.
	 *
	 * The browser receives no owner or site identifiers. It may submit only the
	 * same allow-listed request fields and visible Resource IDs already accepted
	 * by the authenticated window reader. Every adjacent request is revalidated.
	 *
	 * @param array<string,mixed> $window       Validated Timeline window.
	 * @param array<int,int>      $resource_ids Authorized visible Resource IDs.
	 * @param string              $resource_view_context Signed persisted Resource-view context.
	 *
	 * @return array<string,mixed> Cache and adjacent-window metadata.
	 */
	private function build_window_context( $window, $resource_ids, $resource_view_context ) {
		$fingerprint_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', $resource_ids ) ) ) );
		sort( $fingerprint_resource_ids, SORT_NUMERIC );
		$resource_fingerprint = wp_hash( implode( ',', $fingerprint_resource_ids ), 'nonce' );
		$previous_request     = $this->build_adjacent_window_request( $window, -1 );
		$next_request         = $this->build_adjacent_window_request( $window, 1 );
		$resource_count       = count( $fingerprint_resource_ids );
		$previous_preview     = $this->build_adjacent_window_preview( $previous_request, $resource_count, 'previous' );
		$next_preview         = $this->build_adjacent_window_preview( $next_request, $resource_count, 'next' );
		$window_key_source    = implode(
			'|',
			array(
				$resource_fingerprint,
				isset( $window['timezone'] ) ? (string) $window['timezone'] : '',
				isset( $window['view'] ) ? (string) $window['view'] : '',
				isset( $window['start_at'] ) ? (string) $window['start_at'] : '',
				isset( $window['end_at'] ) ? (string) $window['end_at'] : '',
			)
		);
		$selection_token      = ( new WPBC_Timeline_Handoff() )->create_token(
			'timeline_loaded_window',
			array(
				'start_at'     => isset( $window['start_at'] ) ? (string) $window['start_at'] : '',
				'end_at'       => isset( $window['end_at'] ) ? (string) $window['end_at'] : '',
				'view'         => isset( $window['view'] ) ? sanitize_key( (string) $window['view'] ) : '',
				'resource_ids' => $fingerprint_resource_ids,
			)
		);

		return array(
			'window_key'           => wp_hash( $window_key_source, 'nonce' ),
			'resource_fingerprint' => $resource_fingerprint,
			'resource_view_context' => sanitize_text_field( (string) $resource_view_context ),
			'selection_token'      => $selection_token,
			'adjacent_requests'     => array(
				'previous' => $previous_request,
				'next'     => $next_request,
			),
			'adjacent_previews'     => array(
				'previous' => $previous_preview,
				'next'     => $next_preview,
			),
		);
	}

	/**
	 * Build localized presentation metadata for an unloaded adjacent edge.
	 *
	 * The preview is calculated from the same validated axis that will authorize
	 * the eventual read. It contains no booking, availability, price, owner, or
	 * site data and is never accepted back as request authority.
	 *
	 * @param array<string,mixed> $request_values Adjacent-window request values.
	 * @param int                 $resource_count Number of authorized visible Resources.
	 * @param string              $direction      Previous or next edge.
	 *
	 * @return array<string,mixed> Localized range and bounded header-cell preview.
	 */
	private function build_adjacent_window_preview( $request_values, $resource_count, $direction ) {
		$adjacent_window = $this->validator->normalize_window_request(
			$request_values,
			max( 1, absint( $resource_count ) )
		);
		if ( is_wp_error( $adjacent_window ) ) {
			return array(
				'range_label' => '',
				'is_timed'    => false,
				'cells'       => array(),
			);
		}

		$axis          = $this->axis->build_axis( $adjacent_window );
		$configuration = wpbc_timeline_get_configuration();
		$loading       = isset( $configuration['window_loading'] ) && is_array( $configuration['window_loading'] )
			? $configuration['window_loading']
			: array();
		$cell_limit    = max(
			1,
			absint( isset( $loading['edge_placeholder_cells'] ) ? $loading['edge_placeholder_cells'] : 3 )
		);
		$axis_cells    = isset( $axis['cells'] ) && is_array( $axis['cells'] ) ? $axis['cells'] : array();
		$preview_cells = 'previous' === $direction
			? array_slice( $axis_cells, -$cell_limit )
			: array_slice( $axis_cells, 0, $cell_limit );
		$cells         = array();

		foreach ( $preview_cells as $preview_cell ) {
			$cells[] = array(
				'primary_label'   => isset( $preview_cell['primary_label'] )
					? sanitize_text_field( $preview_cell['primary_label'] )
					: '',
				'day_number'      => isset( $preview_cell['day_number'] )
					? sanitize_text_field( $preview_cell['day_number'] )
					: '',
				'secondary_label' => isset( $preview_cell['secondary_label'] )
					? sanitize_text_field( $preview_cell['secondary_label'] )
					: '',
				'aria_label'      => isset( $preview_cell['aria_label'] )
					? sanitize_text_field( $preview_cell['aria_label'] )
					: '',
				'is_weekend'      => ! empty( $preview_cell['is_weekend'] ),
			);
		}

		return array(
			'range_label' => isset( $axis['range_label'] ) ? sanitize_text_field( $axis['range_label'] ) : '',
			'is_timed'    => ! empty( $axis['is_timed'] ),
			'cells'       => $cells,
		);
	}

	/**
	 * Build one allow-listed request descriptor relative to a trusted window.
	 *
	 * @param array<string,mixed> $window          Validated Timeline window.
	 * @param int                 $window_position Previous or next position.
	 *
	 * @return array<string,mixed> Adjacent-window request values.
	 */
	private function build_adjacent_window_request( $window, $window_position ) {
		$request = array(
			'anchor_at'       => isset( $window['start_at'] ) ? (string) $window['start_at'] : '',
			'anchor_ratio'    => 0,
			'window_position' => 0 > $window_position ? -1 : 1,
			'view'            => isset( $window['view'] ) ? sanitize_key( $window['view'] ) : 'day',
		);

		if ( 0 < absint( isset( $window['window_months'] ) ? $window['window_months'] : 0 ) ) {
			$request['window_months'] = absint( $window['window_months'] );
		} else {
			$request['window_days'] = absint( isset( $window['window_days'] ) ? $window['window_days'] : 1 );
		}

		return $request;
	}

	/**
	 * Enforce the common read authorization boundary.
	 *
	 * @return true|WP_Error True when authorized or safe error.
	 */
	private function authorize() {
		if ( $this->authorization->current_user_can_view() ) {
			return true;
		}

		return new WP_Error(
			'wpbc_timeline_unauthorized',
			__( 'Timeline access is unavailable for this account.', 'booking' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Validate an exact Resource-ID selection against the approved hard limit.
	 *
	 * @param mixed $resource_ids Candidate Resource IDs.
	 *
	 * @return array<int,int>|WP_Error Unique IDs or safe validation error.
	 */
	private function validate_requested_resource_ids( $resource_ids ) {
		if ( ! is_array( $resource_ids ) ) {
			return new WP_Error(
				'wpbc_timeline_resource_ids_invalid',
				__( 'The requested Booking Resources are invalid.', 'booking' )
			);
		}

		$resource_ids = array_values( array_unique( array_filter( array_map( 'absint', $resource_ids ) ) ) );
		$maximum      = absint( wpbc_timeline_get_configuration()['limits']['maximum_resources'] );
		if ( count( $resource_ids ) > $maximum ) {
			return new WP_Error(
				'wpbc_timeline_resource_budget_exceeded',
				sprintf(
					/* translators: 1: requested Booking Resource count, 2: maximum supported Booking Resource count. */
					__( 'This Timeline window requests %1$d Booking Resources, but the safe maximum is %2$d.', 'booking' ),
					count( $resource_ids ),
					$maximum
				),
				array(
					'maximum_resources'   => $maximum,
					'suggested_resources' => absint( wpbc_timeline_get_configuration()['limits']['default_resources'] ),
				)
			);
		}

		return $resource_ids;
	}

	/**
	 * Return uniform missing/foreign record behavior.
	 *
	 * @return WP_Error Not-found error.
	 */
	private function get_not_found_error() {
		return new WP_Error(
			'wpbc_timeline_not_found',
			__( 'The requested Timeline record could not be found.', 'booking' ),
			array( 'status' => 404 )
		);
	}

	/**
	 * Calculate query usage since an operation started.
	 *
	 * @param int $query_start Starting absolute query counter value.
	 *
	 * @return int Query count.
	 */
	private function get_query_count( $query_start ) {
		$current = $this->get_absolute_query_count();

		return max( 0, $current - absint( $query_start ) );
	}

	/**
	 * Return the absolute database query count from WordPress or a test probe.
	 *
	 * @return int Non-negative absolute query count.
	 */
	private function get_absolute_query_count() {
		if ( $this->query_count_callback ) {
			return max( 0, absint( call_user_func( $this->query_count_callback ) ) );
		}

		global $wpdb;

		return isset( $wpdb->num_queries ) ? max( 0, absint( $wpdb->num_queries ) ) : 0;
	}
}
