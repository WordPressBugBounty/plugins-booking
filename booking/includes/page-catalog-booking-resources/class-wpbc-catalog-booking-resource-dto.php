<?php
/**
 * Stable Booking Resource DTO mapper for catalog JSON responses.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map authorized repository records to presentation-neutral JSON-safe arrays.
 */
final class WPBC_Catalog_Booking_Resource_DTO {

	/**
	 * Current Booking Resource item schema.
	 *
	 * @var int
	 */
	const SCHEMA_VERSION = 3;

	/**
	 * Map one authorized repository record.
	 *
	 * The DTO contains no HTML, database column names, callbacks, objects, or
	 * sensitive owner data. Action identifiers and labels are fixed server-side.
	 *
	 * @param mixed $resource Authorized repository record.
	 *
	 * @return array<string,mixed>|WP_Error Stable DTO or safe error.
	 */
	public function create( $resource ) {
		if ( ! is_array( $resource ) || empty( $resource['id'] ) ) {
			return new WP_Error(
				'wpbc_catalog_booking_resource_invalid_dto',
				__( 'A Booking Resource could not be prepared for the catalog.', 'booking' )
			);
		}

		$resource_id         = absint( $resource['id'] );
		$title               = isset( $resource['title'] ) ? sanitize_text_field( (string) $resource['title'] ) : '';
		$resource_type       = isset( $resource['resource_type'] ) ? sanitize_key( (string) $resource['resource_type'] ) : 'single';
		$resource_type       = in_array( $resource_type, array( 'single', 'parent', 'child' ), true ) ? $resource_type : 'single';
		$parent_id           = isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0;
		$parent_title        = isset( $resource['parent_title'] ) ? sanitize_text_field( (string) $resource['parent_title'] ) : '';
		$child_count         = isset( $resource['child_count'] ) ? max( 0, absint( $resource['child_count'] ) ) : 0;
		$visible_child_count = isset( $resource['visible_child_count'] ) ? max( 0, absint( $resource['visible_child_count'] ) ) : $child_count;
		$child_position      = isset( $resource['child_position'] ) ? max( 0, absint( $resource['child_position'] ) ) : 0;
		$capacity            = isset( $resource['capacity'] ) ? max( 1, absint( $resource['capacity'] ) ) : 1;
		$cost                = isset( $resource['cost'] ) ? sanitize_text_field( (string) $resource['cost'] ) : '';
		$price_display       = isset( $resource['price_display'] ) ? sanitize_text_field( (string) $resource['price_display'] ) : '';
		$price_major         = isset( $resource['price_major'] ) ? sanitize_text_field( (string) $resource['price_major'] ) : $price_display;
		$price_fraction      = isset( $resource['price_fraction'] ) ? sanitize_text_field( (string) $resource['price_fraction'] ) : '';
		$price_suffix        = isset( $resource['price_suffix'] ) ? sanitize_text_field( (string) $resource['price_suffix'] ) : '';
		$price_period        = isset( $resource['price_period'] ) ? sanitize_key( (string) $resource['price_period'] ) : '';
		$permissions         = $this->get_permissions( $resource_id );
		$action_items        = $this->get_action_items( $permissions, $resource_type );
		$actions             = wp_list_pluck( $action_items, 'id' );
		$structure_label     = $this->get_structure_label( $resource_type, $parent_id, $child_count );
		$owner_display_name  = $this->get_authorized_owner_display_name( $resource );
		$node_id             = 'booking-resource:' . $resource_id;
		$parent_node_id      = $parent_id ? 'booking-resource:' . $parent_id : '';
		$is_container        = 'parent' === $resource_type && ( 0 < $child_count || 0 < $visible_child_count );
		$is_expandable       = $is_container && 0 < $visible_child_count;

		return array(
			'dto_schema_version' => self::SCHEMA_VERSION,
			'id'                 => $resource_id,
			'title'              => $title,
			'description'        => isset( $resource['description'] ) ? sanitize_textarea_field( (string) $resource['description'] ) : '',
			'picture_url'        => isset( $resource['picture_url'] ) ? esc_url_raw( (string) $resource['picture_url'] ) : '',
			'selection_label'    => sprintf(
				/* translators: %s: Booking Resource title. */
				__( 'Select %s', 'booking' ),
				$title
			),
			'labels'             => $this->get_labels( $resource, $resource_type, $capacity, $price_display ),
			'capacity'           => $capacity,
			'price'              => array(
				'value'        => $cost,
				'display'      => $price_display,
				'major'        => $price_major,
				'fraction'     => $price_fraction,
				'suffix'       => $price_suffix,
				'period'       => $price_period,
				'period_label' => $this->get_period_label( $price_period ),
			),
			'priority'           => isset( $resource['priority'] ) ? max( 0, (int) $resource['priority'] ) : 0,
			'default_form'       => isset( $resource['default_form'] ) ? sanitize_text_field( (string) $resource['default_form'] ) : 'standard',
			'publishing_shortcode' => isset( $resource['publishing_shortcode'] ) && '' !== trim( (string) $resource['publishing_shortcode'] )
				? sanitize_text_field( (string) $resource['publishing_shortcode'] )
				: '[booking resource_id=' . $resource_id . ']',
			'structure_label'      => $structure_label,
			'owner_display_name'   => $owner_display_name,
			'hierarchy'            => array(
				'node_id'                 => $node_id,
				'parent_node_id'          => $parent_node_id,
				'node_kind'               => 'entity',
				'is_container'            => $is_container,
				'expandable'              => $is_expandable,
				'children_count'          => $child_count,
				'rendered_children_count' => $visible_child_count,
				'depth'                   => 'child' === $resource_type ? 1 : 0,
				'position'                => $child_position,
				'is_last_sibling'         => 'child' !== $resource_type || ! empty( $resource['is_last_child'] ),
				'type'                     => $resource_type,
				'parent_id'                => $parent_id,
				'parent_title'             => $parent_title,
				'child_count'              => $child_count,
				'visible_child_count'      => $visible_child_count,
				'child_position'           => $child_position,
				'is_last_child'            => 'child' === $resource_type && ! empty( $resource['is_last_child'] ),
				'children_label'           => $this->get_children_label( $visible_child_count ),
				'is_group_root'            => ! empty( $resource['is_group_root'] ),
			),
			'permissions'          => $permissions,
			'actions'              => $actions,
			'action_items'         => $action_items,
		);
	}

	/**
	 * Return the localized child-count summary used by collapsed parent groups.
	 *
	 * @param int $child_count Number of visible child Resources.
	 *
	 * @return string Localized plain-text child summary.
	 */
	private function get_children_label( $child_count ) {
		return sprintf(
			/* translators: %s: Number of child Booking Resources. */
			_n( '%s child resource', '%s child resources', $child_count, 'booking' ),
			number_format_i18n( $child_count )
		);
	}

	/**
	 * Return the plain-text relationship summary used by the Structure preset.
	 *
	 * @param string $resource_type Normalized Resource type.
	 * @param int    $parent_id     Parent Resource ID for a child.
	 * @param int    $child_count   Number of child Resources for a parent.
	 *
	 * @return string Localized relationship summary.
	 */
	private function get_structure_label( $resource_type, $parent_id, $child_count ) {
		if ( 'parent' === $resource_type ) {
			return sprintf(
				/* translators: %s: Number of child Booking Resources. */
				_n( '%s child resource', '%s child resources', $child_count, 'booking' ),
				number_format_i18n( $child_count )
			);
		}
		if ( 'child' === $resource_type ) {
			return sprintf(
				/* translators: %s: Parent Booking Resource ID. */
				__( 'Child of resource %s', 'booking' ),
				number_format_i18n( $parent_id )
			);
		}

		return __( 'Single resource', 'booking' );
	}

	/**
	 * Map a collection of authorized repository records.
	 *
	 * @param mixed $resources Authorized repository records.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Stable DTO collection or safe error.
	 */
	public function create_collection( $resources ) {
		if ( ! is_array( $resources ) ) {
			return new WP_Error(
				'wpbc_catalog_booking_resources_invalid_collection',
				__( 'The Booking Resources response is malformed.', 'booking' )
			);
		}

		$items = array();
		foreach ( $resources as $resource ) {
			$item = $this->create( $resource );
			if ( is_wp_error( $item ) ) {
				return $item;
			}
			$items[] = $item;
		}

		return $items;
	}

	/**
	 * Build edition-aware, plain-text labels.
	 *
	 * @param array  $resource      Authorized repository record.
	 * @param string $resource_type Normalized Resource type.
	 * @param int    $capacity      Number of independently bookable units.
	 * @param string $price_display Plain-text formatted price.
	 *
	 * @return array<int,array<string,string>> Allow-listed label records.
	 */
	private function get_labels( $resource, $resource_type, $capacity, $price_display ) {
		$labels = array();

		if ( class_exists( 'wpdev_bk_biz_s' ) && '' !== $price_display ) {
			$labels[] = array(
				'kind'  => 'cost',
				'text'  => $price_display,
				'title' => __( 'Cost', 'booking' ),
			);
		}

		$default_form = isset( $resource['default_form'] ) ? sanitize_text_field( (string) $resource['default_form'] ) : 'standard';
		if ( class_exists( 'wpdev_bk_biz_m' ) && '' !== $default_form && 'standard' !== $default_form ) {
			$labels[] = array(
				'kind'  => 'default-form',
				'text'  => sprintf(
					/* translators: %s: Booking form name. */
					__( 'Default Form: %s', 'booking' ),
					$default_form
				),
				'title' => __( 'Default Form', 'booking' ),
			);
		}

		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			if ( 'parent' === $resource_type ) {
				$labels[] = array(
					'kind'  => 'parent',
					'text'  => sprintf(
						/* translators: %s: Number of booking units. */
						__( 'Capacity: %s', 'booking' ),
						number_format_i18n( $capacity )
					),
					'title' => __( 'Parent Booking Resource', 'booking' ),
				);
			} elseif ( 'child' === $resource_type ) {
				$labels[] = array(
					'kind'  => 'child',
					'text'  => __( 'Child', 'booking' ),
					'title' => __( 'Child Booking Resource', 'booking' ),
				);
			} else {
				$labels[] = array(
					'kind'  => 'single',
					'text'  => __( 'Single', 'booking' ),
					'title' => __( 'Single Booking Resource', 'booking' ),
				);
			}
		} else {
			$labels[] = array(
				'kind'  => 'single',
				'text'  => __( 'Resource', 'booking' ),
				'title' => __( 'Booking Resource', 'booking' ),
			);
		}

		$owner_label = $this->get_owner_label( $resource );
		if ( '' !== $owner_label ) {
			$labels[] = array(
				'kind'  => 'owner',
				'text'  => sprintf(
					/* translators: %s: Booking Resource owner display name. */
					__( 'User: %s', 'booking' ),
					$owner_label
				),
				'title' => __( 'Booking Resource owner', 'booking' ),
			);
		}

		return $labels;
	}

	/**
	 * Return the compact owner label allowed by the established catalog rules.
	 *
	 * MultiUser ownership is visible only to a Booking Calendar super
	 * administrator, and the compact label is omitted for that administrator's
	 * own Resources. The repository already omits unauthorized display names;
	 * the repeated authorization check keeps direct DTO use safe as well.
	 *
	 * @param array $resource Authorized repository record.
	 *
	 * @return string Sanitized owner display name or an empty string.
	 */
	private function get_owner_label( $resource ) {
		$owner_user_id   = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$owner_name      = $this->get_authorized_owner_display_name( $resource );
		$current_user    = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();
		$current_user_id = is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;

		if ( ! $owner_user_id || $owner_user_id === $current_user_id ) {
			return '';
		}

		return $owner_name;
	}

	/**
	 * Return an owner display name only when MultiUser disclosure is authorized.
	 *
	 * @param array $resource Authorized repository record.
	 *
	 * @return string Sanitized owner display name or an empty string.
	 */
	private function get_authorized_owner_display_name( $resource ) {
		if (
			! class_exists( 'wpdev_bk_multiuser' )
			|| ! (bool) apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' )
		) {
			return '';
		}

		return isset( $resource['owner_display_name'] )
			? sanitize_text_field( (string) $resource['owner_display_name'] )
			: '';
	}

	/**
	 * Return the translated unit for an allow-listed charging period.
	 *
	 * @param string $price_period Stored charging-period identifier.
	 *
	 * @return string Translated period label or an empty string.
	 */
	private function get_period_label( $price_period ) {
		$period_labels = array(
			'day'     => _x( 'day', 'price period unit', 'booking' ),
			'night'   => _x( 'night', 'price period unit', 'booking' ),
			'hour'    => _x( 'hour', 'price period unit', 'booking' ),
			'session' => _x( 'session', 'price period unit', 'booking' ),
			'fixed'   => _x( 'booking', 'price period unit', 'booking' ),
		);

		return isset( $period_labels[ $price_period ] ) ? $period_labels[ $price_period ] : '';
	}

	/**
	 * Return current row-action presentation permissions without exposing user identity.
	 *
	 * Public demos expose deletion only for visitor-created Resources. The
	 * mutation service repeats this fixture-protection check after normal
	 * authorization and before generating the signed deletion review.
	 *
	 * @param int $resource_id Authorized Booking Resource ID.
	 *
	 * @return array<string,bool> Stable permission flags.
	 */
	private function get_permissions( $resource_id ) {
		$can_manage = function_exists( 'wpbc_catalog_booking_resources_get_manage_capability' )
			&& current_user_can( wpbc_catalog_booking_resources_get_manage_capability() );

		return array(
			'edit_resource'    => $can_manage,
			'publish_resource' => $can_manage,
			'delete_resource'  => $can_manage
				&& class_exists( 'wpdev_bk_personal' )
				&& WPBC_Catalog_Booking_Resource_Demo_Policy::can_delete_resource( $resource_id ),
			'adjust_capacity'  => $can_manage && class_exists( 'wpdev_bk_biz_l' ),
		);
	}

	/**
	 * Build allow-listed presentation records for authorized Resource actions.
	 *
	 * Phase 4 renders these controls but does not implement mutation workflows.
	 * Keeping labels and icons in the DTO prevents templates from interpreting
	 * permission flags or mapping domain action identifiers.
	 *
	 * @param array<string,bool> $permissions   Authorized action flags.
	 * @param string             $resource_type Normalized Resource type.
	 *
	 * @return array<int,array<string,mixed>> Authorized action presentation records.
	 */
	private function get_action_items( $permissions, $resource_type ) {
		$action_definitions = array(
			'edit_resource'   => array(
				'label' => __( 'Edit resource', 'booking' ),
				'icon'  => 'menu_icon icon-1x wpbc-bi-pencil-square',
			),
			'publish_resource' => array(
				'label' => __( 'Publish', 'booking' ),
				'icon'  => 'menu_icon icon-1x wpbc-bi-box-arrow-up-right',
			),
			'adjust_capacity' => array(
				'label' => 'child' === $resource_type
					? __( 'Adjust parent capacity', 'booking' )
					: __( 'Adjust capacity', 'booking' ),
				'icon'  => 'menu_icon icon-1x wpbc-bi-people',
			),
			'delete_resource' => array(
				'label' => __( 'Delete resource', 'booking' ),
				'icon'  => 'menu_icon icon-1x wpbc-bi-trash3',
			),
		);
		$actions            = array();

		foreach ( $action_definitions as $action_id => $action_definition ) {
			if ( empty( $permissions[ $action_id ] ) ) {
				continue;
			}

			$actions[] = array(
				'id'                => $action_id,
				'label'             => $action_definition['label'],
				'icon'              => $action_definition['icon'],
				'keep_sidebar_open' => in_array( $action_id, array( 'edit_resource', 'publish_resource', 'adjust_capacity', 'delete_resource' ), true ),
			);
		}

		return $actions;
	}
}
