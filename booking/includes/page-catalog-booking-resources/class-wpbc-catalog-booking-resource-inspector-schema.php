<?php
/**
 * Edition-aware inspector schema for the independent Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build executable-free create and edit contracts for Resource WP templates.
 *
 * This class contains Resource-domain decisions only. It performs no writes
 * and emits no HTML. Templates receive normalized labels, values, field types,
 * and permissions, while mutation services independently repeat validation.
 */
final class WPBC_Catalog_Booking_Resource_Inspector_Schema {

	/**
	 * Return the authorized edit-inspector contract for one Resource.
	 *
	 * @param array $resource Authorized repository record.
	 *
	 * @return array<string,mixed>|WP_Error Inspector contract or safe error.
	 */
	public function get_edit_schema( $resource ) {
		if ( ! is_array( $resource ) || empty( $resource['id'] ) ) {
			return new WP_Error( 'wpbc_catalog_resource_inspector_invalid', __( 'The Booking Resource editor is unavailable.', 'booking' ) );
		}

		$resource_id       = absint( $resource['id'] );
		$ownership_section = $this->get_ownership_section( $resource );
		$sections          = array_merge(
			array( $this->get_general_section( $resource ) ),
			$this->get_publishing_sections( $resource ),
			array(
				$this->get_booking_setup_section( $resource ),
				$this->get_pricing_section( $resource ),
				$this->get_structure_section( $resource ),
				$this->get_availability_section( $resource ),
			)
		);
		if ( null !== $ownership_section ) {
			$sections[] = $ownership_section;
		}

		return array(
			'mode'        => 'edit',
			'resource_id' => $resource_id,
			'context'     => sprintf( __( 'ID: %d', 'booking' ), $resource_id ),
			'title'       => __( 'Edit Booking Resource', 'booking' ),
			'description' => __( 'Update this resource without leaving the catalog.', 'booking' ),
			'sections'    => array_values( array_filter( $sections ) ),
		);
	}

	/**
	 * Return the current edition-aware create-inspector contract.
	 *
	 * @return array<string,mixed> Create contract and server-authoritative limit.
	 */
	public function get_create_schema() {
		$maximum_quantity = $this->get_maximum_quantity();
		$parent_options   = ( new WPBC_Catalog_Booking_Resources_Repository() )->get_create_parent_options();
		$resource_defaults = array(
			'id'            => 0,
			'title'         => '',
			'description'   => '',
			'picture_url'   => '',
			'default_form'  => 'standard',
			'cost'          => '0',
			'priority'      => 0,
			'owner_user_id' => $this->get_current_owner_user_id(),
		);
		$creation_fields = array();
		if ( class_exists( 'wpdev_bk_biz_l' ) && count( $parent_options ) > 1 ) {
			$creation_fields[] = $this->get_field(
				'creation_mode',
				__( 'Create as', 'booking' ),
				'radio',
				'independent',
				true,
				__( 'Independent resources have separate calendars. Units become child calendars of the selected parent.', 'booking' ),
				array(
					'options' => array(
						array( 'value' => 'independent', 'label' => __( 'Independent resources', 'booking' ) ),
						array( 'value' => 'children', 'label' => __( 'Units of an existing parent', 'booking' ) ),
					),
				)
			);
			$creation_fields[] = $this->get_field(
				'parent_id',
				__( 'Parent resource', 'booking' ),
				'select',
				'0',
				true,
				__( 'New units inherit the parent resource owner and base cost.', 'booking' ),
				array( 'options' => $parent_options )
			);
		} else {
			$creation_fields[] = $this->get_field( 'creation_mode', __( 'Create as', 'booking' ), 'hidden', 'independent', true );
		}
		$creation_fields[] = $this->get_field(
			'quantity',
			__( 'Quantity', 'booking' ),
			'number',
			'1',
			true,
			sprintf(
				/* translators: %d: Maximum number of resources that the current account may create. */
				__( 'You can create up to %d resources in this batch.', 'booking' ),
				$maximum_quantity
			),
			array( 'min' => 1, 'max' => max( 1, $maximum_quantity ), 'step' => 1, 'slider_min' => 1, 'slider_max' => max( 1, $maximum_quantity ), 'slider_step' => 1 )
		);
		$general_section = $this->get_general_section( $resource_defaults );
		$sections = array(
			$general_section,
			$this->get_section( 'creation', __( 'Resources to create', 'booking' ), false, $creation_fields, 'wpbc-bi-collection' ),
		);

		$setup_fields = array();
		if ( class_exists( 'wpdev_bk_biz_m' ) && $this->can_edit_default_form() ) {
			$setup_fields[] = $this->get_field( 'default_form', __( 'Default Form', 'booking' ), 'select', 'standard', true, __( 'This Booking Form is assigned to every resource created in the batch.', 'booking' ), array( 'options' => $this->get_form_options( 0, 'standard' ) ) );
		}
		if ( class_exists( 'wpdev_bk_biz_s' ) ) {
			$setup_fields[] = $this->get_field( 'base_cost', __( 'Base cost', 'booking' ), 'number', '0', true, __( 'Applied to every resource created in this batch.', 'booking' ), array( 'min' => 0, 'step' => 1, 'slider_min' => 0, 'slider_max' => 1000, 'slider_step' => 1, 'prefix' => $this->get_currency_symbol(), 'suffix' => $this->get_charging_period_label() ) );
		}
		if ( class_exists( 'wpdev_bk_biz_l' ) ) {
			$setup_fields[] = $this->get_field( 'priority', __( 'Starting priority', 'booking' ), 'number', '0', true, __( 'Each following resource receives the next priority value.', 'booking' ), array( 'min' => 0, 'step' => 1, 'slider_min' => 0, 'slider_max' => 100, 'slider_step' => 1 ) );
		}
		if ( $this->can_assign_owner() ) {
			$setup_fields[] = $this->get_field( 'owner_user_id', __( 'Resource owner', 'booking' ), 'select', (string) $this->get_current_owner_user_id(), true, '', array( 'options' => $this->get_owner_options( $this->get_current_owner_user_id() ) ) );
		}
		if ( ! empty( $setup_fields ) ) {
			$sections[] = $this->get_section( 'booking_setup', __( 'Booking setup', 'booking' ), false, $setup_fields, 'wpbc-bi-sliders' );
		}

		return array(
			'mode'             => 'create',
			'resource_id'      => 0,
			'context'          => __( 'New', 'booking' ),
			'title'            => __( 'Add Booking Resource', 'booking' ),
			'description'      => __( 'Create one or more bookable calendars without leaving the catalog.', 'booking' ),
			'shared_notice'    => __( 'The description and picture are applied to every resource in this batch.', 'booking' ),
			'can_create'       => class_exists( 'wpdev_bk_personal' ) && 0 < $maximum_quantity,
			'maximum_quantity' => $maximum_quantity,
			'sections'         => $sections,
		);
	}

	/**
	 * Return the server-authoritative paid-edition creation limit.
	 *
	 * @return int Allowed count between zero and 200.
	 */
	public function get_maximum_quantity() {
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			return 0;
		}

		return min( 200, max( 0, (int) apply_filters( 'wpbc_check_max_allowed_booking_resources', 200 ) ) );
	}

	/**
	 * Return whether the current user may assign a Resource owner.
	 *
	 * @return bool True only for a non-demo MultiUser super administrator.
	 */
	public function can_assign_owner() {
		return ! wpbc_is_this_demo()
			&& class_exists( 'wpdev_bk_multiuser' )
			&& function_exists( 'wpbc_users_cache' )
			&& (bool) apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
	}

	/**
	 * Return normalized owner choices, retaining an assigned owner if needed.
	 *
	 * @param int $current_owner_user_id Currently assigned owner ID.
	 *
	 * @return array<int,array{value:string,label:string}> Owner choices.
	 */
	public function get_owner_options( $current_owner_user_id = 0 ) {
		if ( ! $this->can_assign_owner() ) {
			return array();
		}

		$wpbc_users_cache = wpbc_users_cache();
		$wpbc_users_cache->set_sorting_params( 'ID', 'ASC' );
		$options = array();
		foreach ( (array) $wpbc_users_cache->get_activated_users_only() as $booking_user ) {
			$user_id = isset( $booking_user['id'] ) ? absint( $booking_user['id'] ) : 0;
			$label   = isset( $booking_user['display_name'] ) ? sanitize_text_field( (string) $booking_user['display_name'] ) : '';
			if ( $user_id && '' !== $label ) {
				$options[] = array( 'value' => (string) $user_id, 'label' => $label );
			}
		}
		$current_owner_user_id = absint( $current_owner_user_id );
		if ( $current_owner_user_id && ! in_array( (string) $current_owner_user_id, wp_list_pluck( $options, 'value' ), true ) ) {
			$current_owner = get_userdata( $current_owner_user_id );
			if ( $current_owner instanceof WP_User ) {
				$options[] = array( 'value' => (string) $current_owner_user_id, 'label' => sanitize_text_field( (string) $current_owner->display_name ) );
			}
		}

		return $options;
	}

	/**
	 * Return available Booking Form choices for one owner context.
	 *
	 * @param int    $owner_user_id Resource owner ID.
	 * @param string $current_form  Currently assigned form.
	 *
	 * @return array<int,array{value:string,label:string}> Form choices.
	 */
	public function get_form_options( $owner_user_id, $current_form = 'standard' ) {
		$options = array( array( 'value' => 'standard', 'label' => __( 'Standard', 'booking' ) ) );
		if ( ! class_exists( 'WPBC_FE_Custom_Form_Helper' ) ) {
			return $options;
		}

		$owner_user_id = absint( $owner_user_id );
		if ( $owner_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $owner_user_id ) ) {
			$owner_user_id = 0;
		}
		$forms = WPBC_FE_Custom_Form_Helper::get_custom_booking_forms_list(
			array(
				'include_standard' => false,
				'owner_user_id'    => $owner_user_id,
				'statuses'          => array( 'published' ),
				'list_mode'        => 'bfb',
			)
		);
		foreach ( (array) $forms as $form ) {
			if ( empty( $form['name'] ) ) {
				continue;
			}
			$form_name = sanitize_text_field( (string) $form['name'] );
			$options[] = array( 'value' => $form_name, 'label' => wp_strip_all_tags( wpbc_lang( $form_name ) ) );
		}
		if ( '' !== $current_form && ! in_array( $current_form, wp_list_pluck( $options, 'value' ), true ) ) {
			$options[] = array( 'value' => $current_form, 'label' => sprintf( __( '%s (currently assigned)', 'booking' ), wp_strip_all_tags( wpbc_lang( $current_form ) ) ) );
		}

		return $options;
	}

	/**
	 * Return the General fields shared by Create and Edit modes.
	 *
	 * @param array $resource Resource values or create defaults.
	 *
	 * @return array<string,mixed> General section.
	 */
	private function get_general_section( $resource ) {
		return $this->get_section(
			'general',
			__( 'General', 'booking' ),
			true,
			array(
				$this->get_field( 'title', __( 'Title', 'booking' ), 'text', isset( $resource['title'] ) ? (string) $resource['title'] : '', true, __( 'Use a short, recognizable name customers and administrators can understand.', 'booking' ), array( 'maxlength' => 200, 'required' => true ) ),
				$this->get_field( 'picture_url', __( 'Picture', 'booking' ), 'media', isset( $resource['picture_url'] ) ? (string) $resource['picture_url'] : '', true, __( 'Shown in resource listings and supported booking-selection layouts.', 'booking' ) ),
				$this->get_field( 'description', __( 'Description', 'booking' ), 'textarea', isset( $resource['description'] ) ? (string) $resource['description'] : '', true, __( 'Explain what this resource is and what makes it useful to book.', 'booking' ), array( 'maxlength' => 2000 ) ),
			),
			'wpbc-bi-gear'
		);
	}

	/**
	 * Return separate shortcode and published-page sections for one Resource.
	 *
	 * The edit inspector follows the same domain-section structure as lazy
	 * expanded details while retaining General as its inspector-only first group.
	 *
	 * @param array $resource Authorized Resource.
	 *
	 * @return array<int,array<string,mixed>> Ordered publishing sections.
	 */
	private function get_publishing_sections( $resource ) {
		$resource_id = absint( $resource['id'] );
		$shortcode   = ! empty( $resource['publishing_shortcode'] ) ? (string) $resource['publishing_shortcode'] : '[booking resource_id=' . $resource_id . ']';
		$published_pages = array();
		foreach ( isset( $resource['published_pages'] ) ? (array) $resource['published_pages'] : array() as $published_page ) {
			$page_url = isset( $published_page['url'] ) ? esc_url_raw( (string) $published_page['url'] ) : '';
			if ( '' === $page_url ) {
				continue;
			}
			$published_pages[] = array(
				'label' => isset( $published_page['title'] ) ? sanitize_text_field( (string) $published_page['title'] ) : __( '(no title)', 'booking' ),
				'url'   => $page_url,
			);
		}

		$shortcode_section = $this->get_section(
			'shortcode_publishing',
			__( 'Shortcode and publishing', 'booking' ),
			false,
			array(
				$this->get_field(
					'booking_shortcode',
					__( 'Booking shortcode', 'booking' ),
					'code',
					$shortcode,
					class_exists( 'wpdev_bk_personal' ),
					class_exists( 'wpdev_bk_personal' )
						? __( 'Use Customize shortcode to change the shortcode used when publishing this Booking Resource.', 'booking' )
						: __( 'The Free version uses the default shortcode for its single Booking Resource.', 'booking' ),
					array( 'maxlength' => 1000, 'readonly_input' => true )
				),
			),
			'wpbc-bi-code-square'
		);
		$shortcode_section['publishing'] = array(
			'resource_id'     => $resource_id,
			'shortcode'       => sanitize_text_field( $shortcode ),
			'copy_label'      => __( 'Copy shortcode', 'booking' ),
			'customize_label' => __( 'Customize shortcode', 'booking' ),
			'publish_label'   => __( 'Embed or publish', 'booking' ),
		);
		$published_pages_section               = $this->get_section(
			'published_booking_pages',
			__( 'Published booking pages', 'booking' ),
			false,
			array(),
			'wpbc-bi-code-square'
		);
		$published_pages_section['published_pages'] = array(
			'preview_page'     => isset( $published_pages[0] ) ? $published_pages[0] : array(),
			'pages'            => $published_pages,
			'preview_label'    => __( 'Preview booking page', 'booking' ),
			'no_preview_label' => __( 'No published booking page found', 'booking' ),
		);

		return array( $shortcode_section, $published_pages_section );
	}

	/**
	 * Return the Booking setup section.
	 *
	 * @param array $resource Authorized Resource.
	 *
	 * @return array<string,mixed> Booking setup section.
	 */
	private function get_booking_setup_section( $resource ) {
		$current_form = empty( $resource['default_form'] ) ? 'standard' : sanitize_text_field( (string) $resource['default_form'] );
		$owner_id     = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$form_editable = class_exists( 'wpdev_bk_biz_m' ) && $this->can_edit_default_form();
		$fields = array(
			$this->get_field(
				'default_form',
				__( 'Default Form', 'booking' ),
				$form_editable ? 'select' : 'readonly',
				$current_form,
				$form_editable,
				$form_editable ? '' : __( 'Custom Booking Forms require Booking Calendar Business Medium or higher.', 'booking' ),
				array(
					'display_value' => 'standard' === $current_form ? __( 'Standard', 'booking' ) : wp_strip_all_tags( wpbc_lang( $current_form ) ),
					'options'       => $form_editable ? $this->get_form_options( $owner_id, $current_form ) : array(),
					'link_url'      => class_exists( 'wpdev_bk_biz_m' ) ? $this->get_form_builder_url( $current_form, $owner_id ) : '',
					'link_label'    => __( 'Edit form', 'booking' ),
				)
			),
			$this->get_field( 'booking_units', __( 'Booking units', 'booking' ), 'readonly', isset( $resource['capacity'] ) ? (string) max( 1, absint( $resource['capacity'] ) ) : '1', false, __( 'Parent capacity equals the parent calendar plus its child resource calendars.', 'booking' ) ),
		);

		return $this->get_section( 'booking_setup', __( 'Booking setup', 'booking' ), false, $fields, 'wpbc-bi-sliders' );
	}

	/**
	 * Return edition-aware pricing controls.
	 *
	 * @param array $resource Authorized Resource.
	 *
	 * @return array<string,mixed> Pricing section.
	 */
	private function get_pricing_section( $resource ) {
		$is_editable = class_exists( 'wpdev_bk_biz_s' );
		$field_type  = $is_editable ? 'number' : 'readonly';
		$field_value = $is_editable ? (string) $resource['cost'] : __( 'Not available in this version', 'booking' );
		$resource_id = absint( $resource['id'] );
		$owner_id    = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$period      = function_exists( 'wpbc_get_cost_per_period_for_user' ) ? sanitize_key( (string) wpbc_get_cost_per_period_for_user( $resource_id ) ) : 'day';
		$currency    = $this->get_currency_code( $resource_id );
		$currency_url = $is_editable ? $this->get_payment_settings_url( 'currency', $owner_id ) : '';
		$period_url   = $is_editable ? $this->get_payment_settings_url( 'charging_period', $owner_id ) : '';
		$advanced_url = class_exists( 'wpdev_bk_biz_m' ) && function_exists( 'wpbc_get_price_url' ) && current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_prices' ) )
			? esc_url_raw( add_query_arg( 'wh_resource_id', $resource_id, wpbc_get_price_url( true, false ) ) )
			: '';
		$fields       = array(
			$this->get_field( 'base_cost', __( 'Base cost', 'booking' ), $field_type, $field_value, $is_editable, $is_editable ? __( 'Enter the base cost for this Booking Resource. Seasonal and conditional pricing remain separate.', 'booking' ) : __( 'Resource pricing requires Booking Calendar Business Small or higher.', 'booking' ), array( 'min' => 0, 'step' => 1, 'slider_min' => 0, 'slider_max' => 1000, 'slider_step' => 1, 'prefix' => $this->get_currency_symbol( $resource_id ), 'suffix' => $this->get_charging_period_label( $period ) ) ),
		);
		if ( $is_editable ) {
			$fields[] = $this->get_field( 'currency', __( 'Currency', 'booking' ), 'readonly', $currency, false, '', array( 'link_url' => $currency_url, 'link_label' => __( 'Change currency', 'booking' ) ) );
			$fields[] = $this->get_field( 'charging_period', __( 'Charging period', 'booking' ), 'readonly', $period, false, '', array( 'display_value' => $this->get_charging_period_label( $period ), 'link_url' => $period_url, 'link_label' => __( 'Change charging period', 'booking' ) ) );
			$fields[] = $this->get_field( 'advanced_pricing', __( 'Advanced pricing', 'booking' ), 'readonly', $advanced_url ? __( 'Seasonal and conditional pricing', 'booking' ) : __( 'Not available in this version', 'booking' ), false, '', array( 'link_url' => $advanced_url, 'link_label' => $advanced_url ? __( 'Manage advanced pricing', 'booking' ) : '' ) );
		}

		return $this->get_section(
			'pricing',
			__( 'Pricing', 'booking' ),
			false,
			$fields,
			'wpbc-bi-cash-coin'
		);
	}

	/**
	 * Return edition-aware structure controls.
	 *
	 * @param array $resource Authorized Resource.
	 *
	 * @return array<string,mixed> Structure section.
	 */
	private function get_structure_section( $resource ) {
		$is_editable = class_exists( 'wpdev_bk_biz_l' );
		$has_children = ! empty( $resource['child_count'] );
		$parent_id    = isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0;
		$parent_label = $parent_id && ! empty( $resource['parent_title'] ) ? (string) $resource['parent_title'] : __( 'Independent resource', 'booking' );
		$fields       = array();
		if ( $is_editable ) {
			$parent_options = ( new WPBC_Catalog_Booking_Resources_Repository() )->get_parent_options( $resource );
			$fields[] = $this->get_field(
				'parent_id',
				__( 'Parent resource', 'booking' ),
				$has_children ? 'readonly' : 'select',
				$has_children ? $parent_label : (string) $parent_id,
				! $has_children,
				$has_children
					? __( 'Move or detach the child resources before assigning this parent resource to another parent.', 'booking' )
					: __( 'Choose an independent top-level resource, or leave this resource independent.', 'booking' ),
				array( 'display_value' => $parent_label, 'options' => $parent_options )
			);
			$fields[] = $this->get_field( 'priority', __( 'Priority', 'booking' ), 'number', (string) absint( $resource['priority'] ), true, __( 'Lower values appear first where resource priority is used.', 'booking' ), array( 'min' => 0, 'step' => 1, 'slider_min' => 0, 'slider_max' => 100, 'slider_step' => 1 ) );
			$fields[] = $this->get_field( 'child_count', __( 'Child resources', 'booking' ), 'readonly', isset( $resource['child_count'] ) ? (string) absint( $resource['child_count'] ) : '0', false );
		} else {
			$fields[] = $this->get_field( 'parent_id', __( 'Parent and child resources', 'booking' ), 'readonly', __( 'Not available in this version', 'booking' ), false, __( 'Organize Booking Resources into parent calendars and child booking units.', 'booking' ) );
		}

		return $this->get_section(
			'structure',
			__( 'Structure', 'booking' ),
			false,
			$fields,
			'wpbc-bi-diagram-3'
		);
	}

	/**
	 * Return sensitive ownership controls only for authorized viewers.
	 *
	 * @param array $resource Authorized Resource.
	 *
	 * @return array<string,mixed>|null Ownership section or null.
	 */
	private function get_ownership_section( $resource ) {
		$owner_id = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		if ( ! class_exists( 'wpdev_bk_multiuser' ) || ! $owner_id ) {
			return null;
		}
		$current_user = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();
		$current_user_id = is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
		$is_editable = $this->can_assign_owner();
		if ( ! $is_editable && $owner_id !== $current_user_id ) {
			return null;
		}
		$owner_user  = get_userdata( $owner_id );
		$owner_value = $owner_user instanceof WP_User ? sanitize_text_field( (string) $owner_user->display_name ) : __( 'Owner unavailable', 'booking' );
		$fields      = array(
			$this->get_field( 'owner_user_id', __( 'Resource owner', 'booking' ), $is_editable ? 'select' : 'readonly', $is_editable ? (string) $owner_id : $owner_value, $is_editable, $is_editable ? __( 'Assign this Booking Resource to an active Booking Calendar user.', 'booking' ) : '', array( 'display_value' => $owner_value, 'layout' => 'summary', 'options' => $is_editable ? $this->get_owner_options( $owner_id ) : array() ) ),
		);
		if ( $owner_user instanceof WP_User ) {
			$is_booking_super_admin = (bool) apply_bk_filter( 'is_user_super_admin', $owner_id );
			$is_booking_active      = 'On' === get_user_option( 'booking_is_active', $owner_id );
			$account_context        = $is_booking_super_admin
				? __( 'Booking Calendar super administrator', 'booking' )
				: ( $is_booking_active ? __( 'Active Booking Calendar user', 'booking' ) : __( 'Inactive Booking Calendar user', 'booking' ) );
			$fields[] = $this->get_field( 'owner_account_context', __( 'Account context', 'booking' ), 'readonly', $account_context, false );
			if ( ! wpbc_is_this_demo() && current_user_can( 'activate_plugins' ) ) {
				$wp_roles     = wp_roles();
				$primary_role = isset( $owner_user->roles[0] ) ? sanitize_key( $owner_user->roles[0] ) : '';
				if ( $primary_role && isset( $wp_roles->roles[ $primary_role ]['name'] ) ) {
					$fields[] = $this->get_field( 'owner_wordpress_role', __( 'WordPress role', 'booking' ), 'readonly', translate_user_role( $wp_roles->roles[ $primary_role ]['name'] ), false );
				}
			}
		}

		return $this->get_section(
			'ownership',
			__( 'Ownership', 'booking' ),
			false,
			$fields,
			'wpbc-bi-person-badge'
		);
	}

	/**
	 * Return the independent availability and Search Availability controls.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<string,mixed> Availability inspector section.
	 */
	private function get_availability_section( $resource ) {
		$availability = new WPBC_Catalog_Booking_Resource_Availability();
		$fields       = array();
		foreach ( $availability->get_field_definitions( $resource ) as $definition ) {
			$fields[] = $this->get_field(
				isset( $definition['key'] ) ? (string) $definition['key'] : '',
				isset( $definition['label'] ) ? (string) $definition['label'] : '',
				isset( $definition['type'] ) ? (string) $definition['type'] : 'readonly',
				isset( $definition['value'] ) ? $definition['value'] : '',
				! empty( $definition['editable'] ),
				isset( $definition['help'] ) ? (string) $definition['help'] : '',
				$definition
			);
		}

		return $this->get_section( 'availability_search', __( 'Availability and search', 'booking' ), false, $fields, 'wpbc-bi-calendar-check' );
	}

	/**
	 * Build one normalized inspector section.
	 *
	 * @param string $section_id Section identifier.
	 * @param string $title      Translated section title.
	 * @param bool   $expanded   Whether the section starts open.
	 * @param array  $fields     Normalized fields.
	 * @param string $icon       Existing Booking Calendar icon class.
	 *
	 * @return array<string,mixed> Section contract.
	 */
	private function get_section( $section_id, $title, $expanded, $fields, $icon = '' ) {
		return array(
			'id'       => sanitize_key( $section_id ),
			'title'    => sanitize_text_field( $title ),
			'icon'     => sanitize_html_class( $icon ),
			'expanded' => (bool) $expanded,
			'fields'   => array_values( array_filter( (array) $fields ) ),
		);
	}

	/**
	 * Build one executable-free field record for a WP template.
	 *
	 * @param string $field_key Field identifier.
	 * @param string $label     Translated label.
	 * @param string $type      Presentation type.
	 * @param mixed  $value     Scalar field value.
	 * @param bool   $editable  Whether the current context may submit it.
	 * @param string $help      Optional explanatory text.
	 * @param array  $extra     Allow-listed field properties.
	 *
	 * @return array<string,mixed> Field contract.
	 */
	private function get_field( $field_key, $label, $type, $value, $editable, $help = '', $extra = array() ) {
		$allowed_types = array( 'code', 'hidden', 'media', 'number', 'radio', 'readonly', 'select', 'text', 'textarea' );
		$default_layout = $editable || 'code' === $type ? 'field' : 'summary';
		$field = array(
			'key'           => sanitize_key( $field_key ),
			'label'         => sanitize_text_field( $label ),
			'type'          => in_array( $type, $allowed_types, true ) ? $type : 'readonly',
			'value'         => is_scalar( $value ) ? (string) $value : '',
			'display_value' => isset( $extra['display_value'] ) && is_scalar( $extra['display_value'] ) ? (string) $extra['display_value'] : ( is_scalar( $value ) ? (string) $value : '' ),
			'editable'      => (bool) $editable,
			'layout'        => isset( $extra['layout'] ) && in_array( $extra['layout'], array( 'field', 'summary' ), true ) ? $extra['layout'] : $default_layout,
			'help'          => sanitize_text_field( $help ),
			'options'       => array(),
			'prefix'        => '',
			'suffix'        => '',
			'min'           => '',
			'max'           => '',
			'step'          => '',
			'slider'        => 'number' === $type && (bool) $editable,
			'slider_min'    => '',
			'slider_max'    => '',
			'slider_step'   => '',
			'maxlength'     => 0,
			'required'      => false,
			'readonly_input' => false,
			'link_url'      => '',
			'link_label'    => '',
		);
		foreach ( array( 'prefix', 'suffix' ) as $text_property ) {
			if ( isset( $extra[ $text_property ] ) && is_scalar( $extra[ $text_property ] ) ) {
				$field[ $text_property ] = sanitize_text_field( (string) $extra[ $text_property ] );
			}
		}
		foreach ( array( 'min', 'max', 'step' ) as $number_property ) {
			if ( isset( $extra[ $number_property ] ) && is_numeric( $extra[ $number_property ] ) ) {
				$field[ $number_property ] = (string) $extra[ $number_property ];
			}
		}
		if ( $field['slider'] ) {
			$slider_defaults = array(
				'slider_min'  => '' !== $field['min'] ? $field['min'] : '0',
				'slider_max'  => '' !== $field['max'] ? $field['max'] : '100',
				'slider_step' => '' !== $field['step'] ? $field['step'] : '1',
			);
			foreach ( $slider_defaults as $slider_property => $slider_default ) {
				$field[ $slider_property ] = isset( $extra[ $slider_property ] ) && is_numeric( $extra[ $slider_property ] )
					? (string) $extra[ $slider_property ]
					: $slider_default;
			}
		}
		$field['maxlength'] = isset( $extra['maxlength'] ) ? absint( $extra['maxlength'] ) : 0;
		$field['required']  = ! empty( $extra['required'] );
		$field['readonly_input'] = ! empty( $extra['readonly_input'] );
		$field['link_url']       = isset( $extra['link_url'] ) && is_scalar( $extra['link_url'] ) ? esc_url_raw( (string) $extra['link_url'] ) : '';
		$field['link_label']     = $field['link_url'] && isset( $extra['link_label'] ) && is_scalar( $extra['link_label'] ) ? sanitize_text_field( (string) $extra['link_label'] ) : '';
		foreach ( isset( $extra['options'] ) ? (array) $extra['options'] : array() as $option ) {
			if ( is_array( $option ) && isset( $option['value'] ) && is_scalar( $option['value'] ) ) {
				$field['options'][] = array(
					'value' => (string) $option['value'],
					'label' => isset( $option['label'] ) ? sanitize_text_field( (string) $option['label'] ) : (string) $option['value'],
				);
			}
		}

		return $field;
	}

	/**
	 * Return whether this account may assign a custom default form.
	 *
	 * @return bool True when the established MultiUser policy permits editing.
	 */
	public function can_edit_default_form() {
		return (bool) apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' )
			|| 'On' === get_bk_option( 'booking_is_custom_forms_for_regular_users' );
	}

	/**
	 * Return the current MultiUser owner context.
	 *
	 * @return int Current WordPress user ID in MultiUser, otherwise zero.
	 */
	private function get_current_owner_user_id() {
		if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
			return 0;
		}
		$current_user = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();

		return is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
	}

	/**
	 * Return the plain currency symbol for a cost field prefix.
	 *
	 * @return string Currency symbol or an empty string.
	 */
	private function get_currency_symbol( $resource_id = 0 ) {
		if ( $resource_id && function_exists( 'wpbc_get_currency_symbol_for_user' ) ) {
			return html_entity_decode( wp_strip_all_tags( (string) wpbc_get_currency_symbol_for_user( absint( $resource_id ) ) ), ENT_QUOTES, 'UTF-8' );
		}

		return function_exists( 'wpbc_get_currency_symbol' )
			? html_entity_decode( wp_strip_all_tags( (string) wpbc_get_currency_symbol() ), ENT_QUOTES, 'UTF-8' )
			: '';
	}

	/**
	 * Return the translated charging-period suffix.
	 *
	 * @return string Plain charging-period label.
	 */
	private function get_charging_period_label( $period = '' ) {
		$period = '' !== $period
			? sanitize_key( (string) $period )
			: ( function_exists( 'wpbc_get_cost_per_period_for_user' ) ? sanitize_key( (string) wpbc_get_cost_per_period_for_user() ) : 'day' );
		$labels = array(
			'day'    => __( 'Per day', 'booking' ),
			'night'  => __( 'Per night', 'booking' ),
			'hour'   => __( 'Per hour', 'booking' ),
			'session' => __( 'Per session', 'booking' ),
			'fixed'  => __( 'Fixed', 'booking' ),
		);

		return isset( $labels[ $period ] ) ? $labels[ $period ] : ucfirst( str_replace( '_', ' ', $period ) );
	}

	/**
	 * Return the owner-aware currency code for a Resource.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return string Currency code or an empty string.
	 */
	private function get_currency_code( $resource_id ) {
		$previous_user = function_exists( 'apply_bk_filter' )
			? apply_bk_filter( 'wpbc_mu_set_environment_for_owner_of_resource', -1, absint( $resource_id ) )
			: -1;
		$currency_code = sanitize_text_field( (string) get_bk_option( 'booking_currency' ) );
		if ( $resource_id && function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_user );
		}

		return $currency_code;
	}

	/**
	 * Build an authorized Booking Form Builder URL.
	 *
	 * @param string $form_name     Booking Form slug.
	 * @param int    $owner_user_id Resource owner ID.
	 *
	 * @return string Authorized URL or an empty string.
	 */
	private function get_form_builder_url( $form_name, $owner_user_id ) {
		if ( ! function_exists( 'wpbc_get_settings_url' ) || ! $this->can_edit_owner_settings( $owner_user_id ) ) {
			return '';
		}

		return esc_url_raw(
			add_query_arg(
				array(
					'tab'       => 'builder_booking_form',
					'form_name' => sanitize_text_field( $form_name ),
				),
				wpbc_get_settings_url( true, false )
			)
		);
	}

	/**
	 * Build an authorized Payment Setup anchor.
	 *
	 * @param string $setting_key  Currency or charging-period setting.
	 * @param int    $owner_user_id Resource owner ID.
	 *
	 * @return string Authorized URL or an empty string.
	 */
	private function get_payment_settings_url( $setting_key, $owner_user_id ) {
		if ( ! function_exists( 'wpbc_get_settings_url' ) || ! $this->can_edit_owner_settings( $owner_user_id ) ) {
			return '';
		}
		$anchor = 'currency' === $setting_key ? '#wpbc_settings_payment_currency_metabox' : '#gateways_booking_paypal_price_period';

		return esc_url_raw( add_query_arg( 'tab', 'payment', wpbc_get_settings_url( true, false ) ) . $anchor );
	}

	/**
	 * Determine whether the current account can edit an owner's settings.
	 *
	 * @param int $owner_user_id Resource owner ID.
	 *
	 * @return bool True when the exact settings context is accessible.
	 */
	private function can_edit_owner_settings( $owner_user_id ) {
		if ( ! current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_settings' ) ) ) {
			return false;
		}
		if ( ! class_exists( 'wpdev_bk_multiuser' ) ) {
			return true;
		}
		$owner_user_id = absint( $owner_user_id );
		if ( $owner_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $owner_user_id ) ) {
			$owner_user_id = 0;
		}
		$current_user    = function_exists( 'wpbc_mu__wp_get_current_user' ) ? wpbc_mu__wp_get_current_user() : wp_get_current_user();
		$current_user_id = is_object( $current_user ) && isset( $current_user->ID ) ? absint( $current_user->ID ) : 0;
		if ( $current_user_id && (bool) apply_bk_filter( 'is_user_super_admin', $current_user_id ) ) {
			$current_user_id = 0;
		}

		return $owner_user_id === $current_user_id;
	}
}
