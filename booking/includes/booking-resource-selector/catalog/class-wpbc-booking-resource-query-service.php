<?php
/**
 * Public Booking Resource repository and query service.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read canonical Resource data and expose a frontend-safe DTO collection.
 *
 * This service reads established edition-specific Resource providers but does
 * not render HTML. It is the shared data boundary for public selectors,
 * shortcodes, blocks, and future frontend catalog integrations.
 */
final class WPBC_Booking_Resource_Query_Service {

	/**
	 * Query public Booking Resources.
	 *
	 * Supported query keys are `resource_ids` (ordered allow-list) and
	 * `include_summaries`. Unknown keys are ignored so callers cannot widen the
	 * public record or request admin-only data.
	 *
	 * @param array<string,mixed> $query Public Resource query.
	 *
	 * @return array<int,array<string,mixed>> Resources keyed by Resource ID.
	 */
	public function get_resources( $query = array() ) {
		$query = wp_parse_args(
			is_array( $query ) ? $query : array(),
			array(
				'resource_ids'      => array(),
				'include_summaries' => true,
			)
		);
		$allowed_resource_ids = function_exists( 'wpbc_booking_resource_selector_normalize_ids' )
			? wpbc_booking_resource_selector_normalize_ids( $query['resource_ids'] )
			: array_values( array_unique( array_filter( array_map( 'absint', (array) $query['resource_ids'] ) ) ) );
		$raw_resources        = (array) apply_bk_filter( 'wpdebk_get_keyed_all_bk_resources', array() );
		$search_options       = function_exists( 'wpbc_searchable_resources__get_all_options' )
			? (array) wpbc_searchable_resources__get_all_options()
			: array();
		$resources            = array();

		foreach ( $raw_resources as $resource_key => $raw_resource ) {
			$resource_id = $this->get_resource_id( $raw_resource, $resource_key );
			if ( ! $resource_id ) {
				continue;
			}
			$resource_options = isset( $search_options[ $resource_id ] ) && is_array( $search_options[ $resource_id ] )
				? $search_options[ $resource_id ]
				: array();
			$resources[ $resource_id ] = $this->normalize_resource( $raw_resource, $resource_id, $resource_options, ! empty( $query['include_summaries'] ) );
		}

		if ( empty( $resources ) && ! class_exists( 'wpdev_bk_personal' ) ) {
			$resource_id               = class_exists( 'WPBC_FE_Attr_Postprocessor' )
				? WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id()
				: 1;
			$resources[ $resource_id ] = $this->normalize_resource( array(), $resource_id, array(), ! empty( $query['include_summaries'] ) );
		}

		$resources = $this->attach_hierarchy( $resources );
		if ( ! empty( $allowed_resource_ids ) ) {
			$ordered_resources = array();
			foreach ( $allowed_resource_ids as $resource_id ) {
				if ( isset( $resources[ $resource_id ] ) ) {
					$ordered_resources[ $resource_id ] = $resources[ $resource_id ];
				}
			}
			$resources = $ordered_resources;
		}

		/**
		 * Filters frontend-safe Booking Resource DTO arrays after query filtering.
		 *
		 * @param array<int,array<string,mixed>> $resources Public Resources keyed by ID.
		 * @param array<string,mixed>            $query     Normalized public query.
		 */
		return (array) apply_filters( 'wpbc_booking_resource_catalog_query_results', $resources, $query );
	}

	/**
	 * Resolve one Resource ID from a raw object, array, or keyed collection.
	 *
	 * @param mixed $raw_resource Raw Resource value.
	 * @param mixed $fallback_id  Key supplied by the Resource collection.
	 *
	 * @return int Positive Resource ID or zero.
	 */
	private function get_resource_id( $raw_resource, $fallback_id ) {
		$resource = is_object( $raw_resource ) ? get_object_vars( $raw_resource ) : (array) $raw_resource;

		if ( ! empty( $resource['id'] ) ) {
			return absint( $resource['id'] );
		}
		if ( ! empty( $resource['booking_type_id'] ) ) {
			return absint( $resource['booking_type_id'] );
		}

		return absint( $fallback_id );
	}

	/**
	 * Normalize one raw Resource into a frontend-safe DTO array.
	 *
	 * @param mixed               $raw_resource      Raw Resource object or array.
	 * @param int                 $resource_id       Resource ID.
	 * @param array<string,mixed> $resource_options  Searchable Resource presentation fallback.
	 * @param bool                $include_summaries Whether summary providers should run.
	 *
	 * @return array<string,mixed> Public Resource DTO values.
	 */
	private function normalize_resource( $raw_resource, $resource_id, $resource_options, $include_summaries ) {
		$resource  = is_object( $raw_resource ) ? get_object_vars( $raw_resource ) : (array) $raw_resource;
		$raw_title = isset( $resource['title'] ) && is_scalar( $resource['title'] ) ? (string) $resource['title'] : '';
		$content   = function_exists( 'wpbc_booking_resource_content_repository' )
			? wpbc_booking_resource_content_repository()->get( $resource_id, $raw_title, true )
			: array();
		$title     = ! empty( $content['title'] ) ? (string) $content['title'] : $raw_title;
		if ( '' === trim( $title ) ) {
			/* translators: %d: Booking Resource ID. */
			$title = sprintf( __( 'Booking Resource #%d', 'booking' ), $resource_id );
		}

		$description = ! empty( $content['description'] ) ? (string) $content['description'] : '';
		if ( '' === $description && ! empty( $resource['description'] ) && is_scalar( $resource['description'] ) ) {
			$description = (string) $resource['description'];
		}
		if ( '' === $description && ! empty( $resource_options['description'] ) && is_scalar( $resource_options['description'] ) ) {
			$description = (string) $resource_options['description'];
		}
		$image_url = ! empty( $content['picture_url'] ) ? (string) $content['picture_url'] : '';
		if ( '' === $image_url && ! empty( $resource['image_url'] ) && is_scalar( $resource['image_url'] ) ) {
			$image_url = (string) $resource['image_url'];
		}
		if ( '' === $image_url && ! empty( $resource['picture'] ) && is_scalar( $resource['picture'] ) ) {
			$image_url = (string) $resource['picture'];
		}
		if ( '' === $image_url && ! empty( $resource_options['picture'] ) ) {
			$image_value = is_array( $resource_options['picture'] ) ? reset( $resource_options['picture'] ) : $resource_options['picture'];
			$image_url   = is_scalar( $image_value ) ? (string) $image_value : '';
		}

		$dto_values = array(
			'resource_id'          => absint( $resource_id ),
			'title'                => wp_strip_all_tags( wpbc_lang( $title ) ),
			'description'          => wp_strip_all_tags( wpbc_lang( $description ) ),
			'image_url'            => esc_url_raw( wpbc_lang( $image_url ) ),
			'attachment_id'        => ! empty( $content['attachment_id'] ) ? absint( $content['attachment_id'] ) : 0,
			'parent_id'            => isset( $resource['parent'] ) ? absint( $resource['parent'] ) : 0,
			'parent_title'         => '',
			'resource_type'        => isset( $resource['parent'] ) && absint( $resource['parent'] ) ? 'child' : 'single',
			'child_ids'            => array(),
			'child_count'          => 0,
			'capacity'             => 1,
			'count'                => isset( $resource['count'] ) ? absint( $resource['count'] ) : 0,
			'availability_summary' => $include_summaries ? $this->get_availability_summary( $resource_id, $resource ) : array(),
			'price_summary'        => $include_summaries ? $this->get_price_summary( $resource_id, $resource ) : array(),
		);

		/**
		 * Filters one public DTO before it enters the Resource catalog.
		 *
		 * @param array<string,mixed> $dto_values  Frontend-safe Resource values.
		 * @param array<string,mixed> $resource    Raw Resource values.
		 * @param array<string,mixed> $resource_options Searchable Resource fallbacks.
		 */
		$dto_values = (array) apply_filters( 'wpbc_booking_resource_catalog_dto', $dto_values, $resource, $resource_options );

		return ( new WPBC_Booking_Resource_DTO( $dto_values ) )->to_array();
	}

	/**
	 * Derive parent and child metadata without exposing the admin hierarchy UI.
	 *
	 * @param array<int,array<string,mixed>> $resources Resources keyed by ID.
	 *
	 * @return array<int,array<string,mixed>> Resources with hierarchy values.
	 */
	private function attach_hierarchy( $resources ) {
		$child_ids_by_parent = array();
		foreach ( $resources as $resource ) {
			$parent_id = absint( $resource['parent_id'] );
			if ( $parent_id && isset( $resources[ $parent_id ] ) ) {
				if ( ! isset( $child_ids_by_parent[ $parent_id ] ) ) {
					$child_ids_by_parent[ $parent_id ] = array();
				}
				$child_ids_by_parent[ $parent_id ][] = absint( $resource['resource_id'] );
			}
		}

		foreach ( $resources as $resource_id => $resource ) {
			$parent_id = absint( $resource['parent_id'] );
			$child_ids = isset( $child_ids_by_parent[ $resource_id ] ) ? $child_ids_by_parent[ $resource_id ] : array();
			if ( $parent_id && isset( $resources[ $parent_id ] ) ) {
				$resource['resource_type'] = 'child';
				$resource['parent_title']  = (string) $resources[ $parent_id ]['title'];
			} elseif ( ! empty( $child_ids ) ) {
				$resource['resource_type'] = 'parent';
			} else {
				$resource['resource_type'] = 'single';
			}
			$resource['child_ids']   = array_values( array_map( 'absint', $child_ids ) );
			$resource['child_count'] = count( $child_ids );
			$resource['capacity']    = 'parent' === $resource['resource_type'] ? count( $child_ids ) + 1 : 1;
			$resource['count']       = $resource['capacity'];
			$resources[ $resource_id ] = ( new WPBC_Booking_Resource_DTO( $resource ) )->to_array();
		}

		return $resources;
	}

	/**
	 * Build a truthful context-free availability summary.
	 *
	 * Exact availability depends on dates, duration, capacity, and edition
	 * rules. The catalog therefore prompts visitors to check dates rather than
	 * claiming that a Resource is available. Date-aware integrations may replace
	 * this structure through the documented filter.
	 *
	 * @param int                 $resource_id Resource ID.
	 * @param array<string,mixed> $resource    Raw Resource values.
	 *
	 * @return array<string,string> Structured availability summary.
	 */
	private function get_availability_summary( $resource_id, $resource ) {
		$summary = array(
			'status'      => 'requires_dates',
			'label'       => __( 'Check available dates', 'booking' ),
			'description' => __( 'Availability is confirmed after you choose dates.', 'booking' ),
		);

		/**
		 * Filters the public availability summary for one Resource.
		 *
		 * @param array<string,string> $summary     Default context-free summary.
		 * @param int                  $resource_id Resource ID.
		 * @param array<string,mixed>  $resource    Raw Resource values.
		 */
		return (array) apply_filters( 'wpbc_booking_resource_catalog_availability_summary', $summary, $resource_id, $resource );
	}

	/**
	 * Build the edition-aware starting-price summary for one Resource.
	 *
	 * @param int                 $resource_id Resource ID.
	 * @param array<string,mixed> $resource    Raw Resource values.
	 *
	 * @return array<string,string> Structured price summary, or an empty array.
	 */
	private function get_price_summary( $resource_id, $resource ) {
		$summary = array();
		$cost    = isset( $resource['cost'] ) && is_scalar( $resource['cost'] ) ? (string) $resource['cost'] : '';
		if ( class_exists( 'wpdev_bk_biz_s' ) && '' !== $cost && function_exists( 'wpbc_get_cost_with_currency_for_user' ) ) {
			$formatted_cost = html_entity_decode( wp_strip_all_tags( (string) wpbc_get_cost_with_currency_for_user( $cost, $resource_id ) ), ENT_QUOTES, 'UTF-8' );
			$period         = function_exists( 'wpbc_get_cost_per_period_for_user' )
				? sanitize_key( (string) wpbc_get_cost_per_period_for_user( $resource_id ) )
				: '';
			$period_labels  = array(
				'day'   => __( 'per day', 'booking' ),
				'night' => __( 'per night', 'booking' ),
				'hour'  => __( 'per hour', 'booking' ),
				'fixed' => __( 'fixed price', 'booking' ),
			);
			$summary = array(
				'amount'       => $cost,
				'formatted'    => $formatted_cost,
				'period'       => $period,
				'period_label' => isset( $period_labels[ $period ] ) ? $period_labels[ $period ] : '',
				'label'        => sprintf( __( 'From %s', 'booking' ), $formatted_cost ),
			);
		}

		/**
		 * Filters the public starting-price summary for one Resource.
		 *
		 * @param array<string,string> $summary     Default edition-aware price summary.
		 * @param int                  $resource_id Resource ID.
		 * @param array<string,mixed>  $resource    Raw Resource values.
		 */
		return (array) apply_filters( 'wpbc_booking_resource_catalog_price_summary', $summary, $resource_id, $resource );
	}
}

/**
 * Return the shared public Booking Resource query service.
 *
 * @return WPBC_Booking_Resource_Query_Service Query service singleton.
 */
function wpbc_booking_resource_catalog_query_service() {
	static $query_service = null;

	if ( null === $query_service ) {
		$query_service = new WPBC_Booking_Resource_Query_Service();
	}

	return $query_service;
}
