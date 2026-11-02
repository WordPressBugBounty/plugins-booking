<?php
/**
 * Signed Timeline Resource-view context contract.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Bind a displayed Resource page to the current user, site, and saved view.
 */
final class WPBC_Timeline_Resource_View_Context {

	/** Signed handoff purpose. */
	const TOKEN_PURPOSE = 'timeline_resource_view';

	/** Context schema version. */
	const SCHEMA_VERSION = 1;

	/** @var WPBC_Timeline_Handoff Generic signed-token service. */
	private $handoff;

	/**
	 * Construct the context service.
	 *
	 * @param WPBC_Timeline_Handoff|null $handoff Optional signed-token service.
	 */
	public function __construct( $handoff = null ) {
		$this->handoff = $handoff ? $handoff : new WPBC_Timeline_Handoff();
	}

	/**
	 * Sign one effective Resource page against the source preference revision.
	 *
	 * @param array<string,mixed>            $resource_view Normalized saved Resource view.
	 * @param array<int,array<string,mixed>> $resources     Authorized effective page.
	 * @param array<string,mixed>            $pagination    Effective Resource pagination.
	 *
	 * @return string Signed opaque context.
	 */
	public function create( $resource_view, $resources, $pagination ) {
		$resource_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ) );

		return $this->handoff->create_token(
			self::TOKEN_PURPOSE,
			array(
				'schema_version' => self::SCHEMA_VERSION,
				'view_revision'  => $this->get_view_revision( $resource_view ),
				'resource_ids'   => $resource_ids,
				'pagination'     => $this->normalize_pagination( $pagination ),
			)
		);
	}

	/**
	 * Verify one token and reject a context from an older saved Resource view.
	 *
	 * Repository authorization is deliberately not performed here. The domain
	 * service must reload every returned identifier through its repository.
	 *
	 * @param mixed               $token                 Untrusted signed token.
	 * @param array<string,mixed> $current_resource_view Current normalized view.
	 *
	 * @return array<string,mixed>|WP_Error Verified data-only context or safe error.
	 */
	public function verify( $token, $current_resource_view ) {
		$payload = $this->handoff->verify_token( $token, self::TOKEN_PURPOSE );
		if ( is_wp_error( $payload ) ) {
			return $this->get_invalid_error();
		}

		$resource_ids = isset( $payload['resource_ids'] )
			? $this->validate_resource_ids( $payload['resource_ids'] )
			: $this->get_invalid_error();
		if (
			self::SCHEMA_VERSION !== absint( isset( $payload['schema_version'] ) ? $payload['schema_version'] : 0 )
			|| is_wp_error( $resource_ids )
			|| ! isset( $payload['view_revision'] )
			|| ! is_scalar( $payload['view_revision'] )
			|| ! isset( $payload['pagination'] )
			|| ! is_array( $payload['pagination'] )
		) {
			return $this->get_invalid_error();
		}
		if ( ! hash_equals( $this->get_view_revision( $current_resource_view ), (string) $payload['view_revision'] ) ) {
			return new WP_Error(
				'wpbc_timeline_resource_view_context_stale',
				__( 'The Timeline Resource view changed. Reload the Resources and try again.', 'booking' ),
				array( 'status' => 409 )
			);
		}

		$pagination = $this->normalize_pagination( $payload['pagination'] );
		if ( empty( $resource_ids ) || ! $pagination['page'] || ! $pagination['per_page'] ) {
			return $this->get_invalid_error();
		}

		return array(
			'resource_ids' => $resource_ids,
			'pagination'   => $pagination,
		);
	}

	/**
	 * Create a deterministic revision without exposing preference contents.
	 *
	 * @param array<string,mixed> $resource_view Normalized Resource view.
	 *
	 * @return string Site-secret-bound revision.
	 */
	public function get_view_revision( $resource_view ) {
		$resource_view = is_array( $resource_view ) ? $resource_view : array();

		return wp_hash( wp_json_encode( $resource_view ), 'nonce' );
	}

	/**
	 * Normalize the public pagination contract.
	 *
	 * @param mixed $pagination Pagination candidate.
	 *
	 * @return array<string,mixed> Safe pagination values.
	 */
	private function normalize_pagination( $pagination ) {
		$pagination = is_array( $pagination ) ? $pagination : array();
		$unit       = isset( $pagination['unit'] ) && 'resource_group' === $pagination['unit'] ? 'resource_group' : 'resource';

		return array(
			'page'         => absint( isset( $pagination['page'] ) ? $pagination['page'] : 0 ),
			'per_page'     => absint( isset( $pagination['per_page'] ) ? $pagination['per_page'] : 0 ),
			'total_items'  => absint( isset( $pagination['total_items'] ) ? $pagination['total_items'] : 0 ),
			'total_pages'  => absint( isset( $pagination['total_pages'] ) ? $pagination['total_pages'] : 0 ),
			'unit'         => $unit,
			'has_previous' => ! empty( $pagination['has_previous'] ),
			'has_next'     => ! empty( $pagination['has_next'] ),
		);
	}

	/**
	 * Strictly validate exact positive Resource identifiers from a signed token.
	 *
	 * @param mixed $candidate Signed payload value.
	 *
	 * @return array<int,int>|WP_Error Ordered IDs or safe error.
	 */
	private function validate_resource_ids( $candidate ) {
		if ( ! is_array( $candidate ) || count( $candidate ) > WPBC_Timeline_Resource_View_Preferences::MAXIMUM_PAGE_SIZE ) {
			return $this->get_invalid_error();
		}

		$resource_ids = array();
		foreach ( $candidate as $resource_id ) {
			if ( ! is_scalar( $resource_id ) || ! preg_match( '/^[1-9]\d*$/', (string) $resource_id ) ) {
				return $this->get_invalid_error();
			}
			$resource_ids[] = (int) $resource_id;
		}

		return count( $resource_ids ) === count( array_unique( $resource_ids ) ) ? $resource_ids : $this->get_invalid_error();
	}

	/**
	 * Return a uniform non-sensitive context error.
	 *
	 * @return WP_Error Invalid context error.
	 */
	private function get_invalid_error() {
		return new WP_Error(
			'wpbc_timeline_resource_view_context_invalid',
			__( 'The Timeline Resource view expired or is invalid. Reload the page and try again.', 'booking' ),
			array( 'status' => 403 )
		);
	}
}
