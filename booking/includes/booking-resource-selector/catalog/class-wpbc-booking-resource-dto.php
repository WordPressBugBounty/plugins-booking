<?php
/**
 * Public Booking Resource data-transfer object.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Carry public Resource data between repositories and frontend presenters.
 *
 * The object intentionally excludes admin actions, capabilities, owner data,
 * inspector schemas, and storage details. This keeps frontend renderers from
 * becoming coupled to the Booking Resources administration table.
 */
final class WPBC_Booking_Resource_DTO {

	/**
	 * Normalized public Resource values.
	 *
	 * @var array<string,mixed>
	 */
	private $values;

	/**
	 * Initialize one immutable public Resource snapshot.
	 *
	 * @param array<string,mixed> $values Normalized public Resource values.
	 */
	public function __construct( $values ) {
		$defaults = array(
			'resource_id'          => 0,
			'title'                => '',
			'description'          => '',
			'image_url'            => '',
			'attachment_id'        => 0,
			'parent_id'            => 0,
			'parent_title'         => '',
			'resource_type'        => 'single',
			'child_ids'            => array(),
			'child_count'          => 0,
			'capacity'             => 1,
			'count'                => 0,
			'availability_summary' => array(),
			'price_summary'        => array(),
		);

		$values       = is_array( $values ) ? array_intersect_key( $values, $defaults ) : array();
		$this->values = wp_parse_args( $values, $defaults );
	}

	/**
	 * Return the stable public representation used by frontend consumers.
	 *
	 * @return array<string,mixed> Public Resource values.
	 */
	public function to_array() {
		return $this->values;
	}
}
