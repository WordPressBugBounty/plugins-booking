<?php
/**
 * Lazy expanded-details DTO for the independent Booking Resources catalog.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert one authorized Resource record into presentation-only detail cards.
 *
 * This class contains Booking Resources domain knowledge but no SQL or HTML.
 * URLs are omitted unless the current viewer has the capability used by their
 * native destination. Sensitive owner information is returned only to the
 * established Booking Calendar MultiUser super-administrator context.
 */
final class WPBC_Catalog_Booking_Resource_Details_DTO {

	/**
	 * Current expanded-details response schema.
	 *
	 * @var int
	 */
	const SCHEMA_VERSION = 1;

	/**
	 * Build the lazy details DTO for one authorized Resource.
	 *
	 * @param mixed $resource Authorized repository record with lazy relations.
	 *
	 * @return array<string,mixed>|WP_Error Normalized details or a safe error.
	 */
	public function create( $resource ) {
		if ( ! is_array( $resource ) || empty( $resource['id'] ) ) {
			return new WP_Error( 'wpbc_catalog_booking_resource_details_invalid', __( 'The Booking Resource details are unavailable.', 'booking' ) );
		}

		$resource_id          = absint( $resource['id'] );
		$resource_type        = $this->normalize_resource_type( isset( $resource['resource_type'] ) ? $resource['resource_type'] : '' );
		$ownership_section    = $this->get_ownership_section( $resource );
		$availability_section = $this->get_availability_section( $resource, $resource_type );
		if ( null !== $ownership_section ) {
			$availability_section['class_name'] .= ' wpbc_booking_resources__details_card--availability-with-ownership';
		}
		$sections = array_merge(
			array( $this->get_resource_actions_section( $resource ) ),
			$this->get_booking_page_sections( $resource ),
			array(
				$this->get_booking_setup_section( $resource, $resource_type ),
				$this->get_pricing_section( $resource ),
				$this->get_structure_section( $resource, $resource_type ),
				$availability_section,
			)
		);
		if ( null !== $ownership_section ) {
			$sections[] = $ownership_section;
		}

		return array(
			'dto_schema_version' => self::SCHEMA_VERSION,
			'resource_id'        => $resource_id,
			'title'              => sanitize_text_field( (string) $resource['title'] ),
			'sections'           => array_values( array_filter( $sections ) ),
		);
	}

	/**
	 * Build separate shortcode and published-page cards.
	 *
	 * Normalizing the published pages once keeps the two presentation sections
	 * consistent without exposing repository records to the WP template.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<int,array<string,mixed>> Ordered presentation sections.
	 */
	private function get_booking_page_sections( $resource ) {
		$shortcode       = sanitize_text_field( (string) $resource['publishing_shortcode'] );
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

		$booking_page_actions = array(
			$this->get_copy_action( $shortcode ),
			$this->get_client_action( 'customize_shortcode', 'customize', __( 'Customize shortcode', 'booking' ), 'wpbc-bi-sliders', $shortcode ),
			$this->get_client_action( 'publish_shortcode', 'publish', __( 'Embed or publish', 'booking' ), 'wpbc-bi-box-arrow-up-right', $shortcode, 'primary' ),
		);
		$published_page_actions = array();
		if ( isset( $published_pages[0] ) ) {
			$published_page_actions[] = $this->get_link_action( 'preview_booking_page', __( 'Preview booking page', 'booking' ), 'wpbc-bi-eye', $published_pages[0]['url'], 'secondary', true );
		}

		$booking_page_section = $this->get_section(
			'booking_page',
			__( 'Shortcode and publishing', 'booking' ),
			'wpbc-bi-code-square',
			array( $this->get_field( __( 'Effective booking shortcode', 'booking' ), $shortcode, 'code' ) ),
			$booking_page_actions
		);

		$published_pages_field                = $this->get_links_field(
			__( 'Published booking pages', 'booking' ),
			$published_pages,
			empty( $published_pages ) ? __( 'No published booking page found', 'booking' ) : ''
		);
		$published_pages_field['label_class'] = 'screen-reader-text';
		$published_pages_section              = $this->get_section(
			'published_booking_pages',
			__( 'Published booking pages', 'booking' ),
			'wpbc-bi-code-square',
			array( $published_pages_field ),
			$published_page_actions
		);
		$published_pages_section['class_name'] = 'wpbc_booking_resources__details_card--published-pages wpbc_booking_resources__details_card--actions-first';

		return array( $booking_page_section, $published_pages_section );
	}

	/**
	 * Build the Booking setup card.
	 *
	 * @param array<string,mixed> $resource      Authorized Resource record.
	 * @param string              $resource_type Normalized relationship type.
	 *
	 * @return array<string,mixed> Presentation section.
	 */
	private function get_booking_setup_section( $resource, $resource_type ) {
		$owner_user_id = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$default_form  = empty( $resource['default_form'] ) ? 'standard' : sanitize_text_field( (string) $resource['default_form'] );
		$form_label    = 'standard' === $default_form ? __( 'Standard', 'booking' ) : wp_strip_all_tags( wpbc_lang( $default_form ) );
		$form_url      = class_exists( 'wpdev_bk_biz_m' ) ? $this->get_form_builder_url( $default_form, $owner_user_id ) : '';

		return $this->get_section(
			'booking_setup',
			__( 'Booking setup', 'booking' ),
			'wpbc-bi-sliders',
			array(
				$this->get_field( __( 'Default Form', 'booking' ), class_exists( 'wpdev_bk_biz_m' ) ? $form_label : __( 'Not available in this version', 'booking' ), 'text', '', $form_url, $form_url ? __( 'Edit form', 'booking' ) : '' ),
				$this->get_field( __( 'Booking units', 'booking' ), number_format_i18n( max( 1, absint( $resource['capacity'] ) ) ) ),
				$this->get_field( __( 'Resource ID', 'booking' ), number_format_i18n( absint( $resource['id'] ) ) ),
				$this->get_field( __( 'Resource type', 'booking' ), $this->get_resource_type_label( $resource_type ) ),
			)
		);
	}

	/**
	 * Build the edition-aware pricing card.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<string,mixed> Presentation section.
	 */
	private function get_pricing_section( $resource ) {
		if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
			return $this->get_section(
				'pricing',
				__( 'Pricing', 'booking' ),
				'wpbc-bi-cash-coin',
				array( $this->get_field( __( 'Base cost', 'booking' ), __( 'Not available in this version', 'booking' ), 'text', __( 'Resource pricing requires Booking Calendar Business Small or higher.', 'booking' ) ) )
			);
		}

		$resource_id        = absint( $resource['id'] );
		$owner_user_id      = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$charging_period    = function_exists( 'wpbc_get_cost_per_period_for_user' ) ? sanitize_key( (string) wpbc_get_cost_per_period_for_user( $resource_id ) ) : 'day';
		$previous_user      = $this->set_owner_environment( $resource_id );
		$currency_code      = sanitize_text_field( (string) get_bk_option( 'booking_currency' ) );
		$this->restore_owner_environment( $previous_user, $resource_id );
		$can_edit_settings  = $this->can_edit_owner_settings( $owner_user_id );
		$settings_base_url  = $can_edit_settings && function_exists( 'wpbc_get_settings_url' ) ? wpbc_get_settings_url( true, false ) : '';
		$currency_url       = $settings_base_url ? esc_url_raw( add_query_arg( 'tab', 'payment', $settings_base_url ) . '#wpbc_settings_payment_currency_metabox' ) : '';
		$period_url         = $settings_base_url ? esc_url_raw( add_query_arg( 'tab', 'payment', $settings_base_url ) . '#gateways_booking_paypal_price_period' ) : '';
		$advanced_price_url = '';
		if ( class_exists( 'wpdev_bk_biz_m' ) && function_exists( 'wpbc_get_price_url' ) && current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_prices' ) ) ) {
			$advanced_price_url = esc_url_raw( add_query_arg( 'wh_resource_id', $resource_id, wpbc_get_price_url( true, false ) ) );
		}

		return $this->get_section(
			'pricing',
			__( 'Pricing', 'booking' ),
			'wpbc-bi-cash-coin',
			array(
				$this->get_field( __( 'Base cost', 'booking' ), sanitize_text_field( (string) $resource['price_display'] ) ),
				$this->get_field( __( 'Currency', 'booking' ), $currency_code, 'text', '', $currency_url, $currency_url ? __( 'Change currency', 'booking' ) : '' ),
				$this->get_field( __( 'Charging period', 'booking' ), $this->get_charging_period_label( $charging_period ), 'text', '', $period_url, $period_url ? __( 'Change charging period', 'booking' ) : '' ),
				$this->get_field(
					__( 'Advanced pricing', 'booking' ),
					$advanced_price_url ? __( 'Configured per resource', 'booking' ) : __( 'Not available in this version', 'booking' ),
					'text',
					'',
					$advanced_price_url,
					$advanced_price_url ? __( 'Manage advanced pricing', 'booking' ) : ''
				),
			)
		);
	}

	/**
	 * Build the parent/child structure card.
	 *
	 * @param array<string,mixed> $resource      Authorized Resource record.
	 * @param string              $resource_type Normalized relationship type.
	 *
	 * @return array<string,mixed> Presentation section.
	 */
	private function get_structure_section( $resource, $resource_type ) {
		if ( ! class_exists( 'wpdev_bk_biz_l' ) ) {
			return $this->get_section(
				'structure',
				__( 'Structure', 'booking' ),
				'wpbc-bi-diagram-3',
				array( $this->get_field( __( 'Parent and child resources', 'booking' ), __( 'Not available in this version', 'booking' ) ) )
			);
		}

		$children = array();
		foreach ( isset( $resource['children'] ) ? (array) $resource['children'] : array() as $child_resource ) {
			if ( empty( $child_resource['id'] ) ) {
				continue;
			}
			$children[] = array(
				'label' => sanitize_text_field( (string) $child_resource['title'] ),
				'url'   => '',
			);
		}
		$parent_label = 'child' === $resource_type && ! empty( $resource['parent_id'] )
			? sanitize_text_field( (string) $resource['parent_title'] )
			: __( 'None', 'booking' );

		return $this->get_section(
			'structure',
			__( 'Structure', 'booking' ),
			'wpbc-bi-diagram-3',
			array(
				$this->get_field( __( 'Resource type', 'booking' ), $this->get_structure_type_label( $resource_type ) ),
				$this->get_field( __( 'Parent resource', 'booking' ), $parent_label ),
				$this->get_links_field( __( 'Child resources', 'booking' ), $children, empty( $children ) ? __( 'None', 'booking' ) : '' ),
				$this->get_field( __( 'Child count', 'booking' ), number_format_i18n( count( $children ) ) ),
				$this->get_field( __( 'Priority', 'booking' ), number_format_i18n( max( 0, absint( $resource['priority'] ) ) ) ),
			)
		);
	}

	/**
	 * Build sensitive ownership details when the viewer is authorized.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<string,mixed>|null Ownership section or null.
	 */
	private function get_ownership_section( $resource ) {
		$owner_user_id = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		if ( ! $owner_user_id || ! $this->can_view_owner_details() ) {
			return null;
		}

		$owner_user = get_userdata( $owner_user_id );
		if ( ! $owner_user instanceof WP_User ) {
			return null;
		}
		$is_booking_super_admin = (bool) apply_bk_filter( 'is_user_super_admin', $owner_user_id );
		$is_booking_active      = 'On' === get_user_option( 'booking_is_active', $owner_user_id );
		$account_context       = $is_booking_super_admin
			? __( 'Booking Calendar super administrator', 'booking' )
			: ( $is_booking_active ? __( 'Active Booking Calendar user', 'booking' ) : __( 'Inactive Booking Calendar user', 'booking' ) );
		$fields                = array(
			$this->get_field( __( 'Resource owner', 'booking' ), sanitize_text_field( (string) $owner_user->display_name ) ),
		);
		$is_demo_site = function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo();
		if ( ! $is_demo_site && current_user_can( 'activate_plugins' ) ) {
			$wp_roles     = wp_roles();
			$primary_role = isset( $owner_user->roles[0] ) ? sanitize_key( $owner_user->roles[0] ) : '';
			if ( $primary_role && isset( $wp_roles->roles[ $primary_role ]['name'] ) ) {
				$fields[] = $this->get_field( __( 'WordPress role', 'booking' ), translate_user_role( $wp_roles->roles[ $primary_role ]['name'] ) );
			}
		}
		$fields[] = $this->get_field( __( 'Account context', 'booking' ), $account_context );

		$section               = $this->get_section( 'ownership', __( 'Ownership', 'booking' ), 'wpbc-bi-person-badge', $fields );
		$section['class_name'] = 'wpbc_booking_resources__details_card--ownership';

		return $section;
	}

	/**
	 * Build read-only availability and Search Availability details.
	 *
	 * @param array<string,mixed> $resource      Authorized Resource record.
	 * @param string              $resource_type Normalized relationship type.
	 *
	 * @return array<string,mixed> Presentation section.
	 */
	private function get_availability_section( $resource, $resource_type ) {
		$resource_id     = absint( $resource['id'] );
		$owner_user_id   = isset( $resource['owner_user_id'] ) ? absint( $resource['owner_user_id'] ) : 0;
		$can_manage_days = current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_availability' ) );
		$previous_user   = $this->set_owner_environment( $resource_id );
		$fields          = array();

		if ( class_exists( 'wpdev_bk_biz_l' ) && function_exists( 'wpbc_searchable_resources__get_all_options' ) ) {
			$search_options = (array) wpbc_searchable_resources__get_all_options();
			$is_searchable  = 'child' !== $resource_type
				&& isset( $search_options[ $resource_id ]['is_searchable'] )
				&& 'On' === $search_options[ $resource_id ]['is_searchable'];
			$search_url     = function_exists( 'wpbc_get_resources_url' ) && current_user_can( wpbc_catalog_booking_resources_get_manage_capability() )
				? esc_url_raw( add_query_arg( array( 'tab' => 'searchable_resources', 'wh_resource_id' => $resource_id ), wpbc_get_resources_url( true, false ) ) )
				: '';
			$fields[]       = $this->get_field(
				__( 'Search Availability results', 'booking' ),
				$is_searchable ? __( 'Searchable', 'booking' ) : __( 'Hidden from search results', 'booking' ),
				'text',
				'child' === $resource_type
					? __( 'Child resources stay hidden because Search Availability returns their top-level parent resource.', 'booking' )
					: __( 'Choose whether this Booking Resource can appear in Search Availability results.', 'booking' ),
				$search_url,
				$search_url ? __( 'Manage search presentation and filters', 'booking' ) : ''
			);
		} else {
			$fields[] = $this->get_field( __( 'Search Availability results', 'booking' ), __( 'Not available in this version', 'booking' ) );
		}

		if ( class_exists( 'wpdev_bk_biz_m' ) && function_exists( 'wpbc_get_resource_meta' ) ) {
			$availability = $this->get_season_availability( $resource_id );
			$season_url   = $can_manage_days && function_exists( 'wpbc_get_availability_url' )
				? esc_url_raw( add_query_arg( array( 'tab' => 'season_availability', 'edit_resource_id' => $resource_id ), wpbc_get_availability_url( true, false ) ) )
				: '';
			$fields[]     = $this->get_field( __( 'Default day availability', 'booking' ), 'Off' === $availability['general'] ? __( 'Unavailable', 'booking' ) : __( 'Available', 'booking' ), 'text', __( 'Active season rules invert this default only on the dates matched by those rules.', 'booking' ), $season_url, $season_url ? __( 'Manage season availability', 'booking' ) : '' );
			$rule_count   = $this->count_active_season_rules( $availability );
			$fields[]     = $this->get_field(
				__( 'Active season rules', 'booking' ),
				sprintf( _n( '%s rule', '%s rules', $rule_count, 'booking' ), number_format_i18n( $rule_count ) ),
				'text',
				'',
				$season_url,
				$season_url ? __( 'Review season rules', 'booking' ) : ''
			);
		} else {
			$fields[] = $this->get_field( __( 'Season availability', 'booking' ), __( 'Not available in this version', 'booking' ) );
		}

		$manual_url = $can_manage_days && function_exists( 'wpbc_get_availability_url' )
			? esc_url_raw( add_query_arg( 'resource_id', $resource_id, wpbc_get_availability_url( true, false ) ) )
			: '';
		$fields[]   = $this->get_field( __( 'Manual date availability', 'booking' ), __( 'Per-date overrides', 'booking' ), 'text', __( 'Use the availability calendar to mark individual dates available or unavailable.', 'booking' ), $manual_url, $manual_url ? __( 'Manage dates', 'booking' ) : '' );

		$global_url = $can_manage_days && $this->can_edit_owner_settings( $owner_user_id ) && function_exists( 'wpbc_get_general_availability_url' )
			? esc_url_raw( wpbc_get_general_availability_url( true, false ) )
			: '';
		$fields[]   = $this->get_field( __( 'Earliest bookable day', 'booking' ), $this->format_booking_window_start(), 'text', __( 'This is a global Booking Calendar rule shared by every Booking Resource.', 'booking' ), $global_url, $global_url ? __( 'Change global booking window', 'booking' ) : '' );
		$fields[]   = $this->get_field( __( 'Booking horizon', 'booking' ), class_exists( 'wpdev_bk_biz_m' ) ? $this->format_booking_window_horizon() : __( 'Not available in this version', 'booking' ), 'text', __( 'This is a global Booking Calendar rule shared by every Booking Resource.', 'booking' ), class_exists( 'wpdev_bk_biz_m' ) ? $global_url : '', $global_url ? __( 'Change global booking window', 'booking' ) : '' );
		$this->restore_owner_environment( $previous_user, $resource_id );

		$section = $this->get_section( 'availability_search', __( 'Availability and search', 'booking' ), 'wpbc-bi-calendar-check', $fields );
		$section['class_name'] = 'wpbc_booking_resources__details_card--availability';

		return $section;
	}

	/**
	 * Build capability-aware Resource action links.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<string,mixed> Presentation section.
	 */
	private function get_resource_actions_section( $resource ) {
		$resource_id = absint( $resource['id'] );
		$can_manage  = current_user_can( wpbc_catalog_booking_resources_get_manage_capability() );
		$actions     = array();

		if ( $can_manage ) {
			$actions[] = $this->get_button_action( 'edit_resource', __( 'Edit Booking Resource', 'booking' ), 'wpbc-bi-pencil-square', 'edit', 'primary' );
		}
		if ( $can_manage && class_exists( 'wpdev_bk_biz_l' ) ) {
			$capacity_label = 'child' === $this->normalize_resource_type( isset( $resource['resource_type'] ) ? $resource['resource_type'] : '' )
				? __( 'Adjust parent capacity', 'booking' )
				: __( 'Adjust capacity', 'booking' );
			$actions[] = $this->get_button_action( 'adjust_capacity', $capacity_label, 'wpbc-bi-people', 'capacity' );
		}

		if ( current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_booking' ) ) ) {
			$bookings_url = function_exists( 'wpbc_get_bookings_url' ) ? wpbc_get_bookings_url( true, false ) : admin_url( 'admin.php?page=wpbc' );
			$actions[]    = $this->get_link_action( 'view_bookings', __( 'View bookings', 'booking' ), 'wpbc-bi-list-check', add_query_arg( array( 'tab' => 'vm_booking_listing', 'wh_booking_type' => $resource_id, 'overwrite' => 1 ), $bookings_url ) );
		}
		if ( current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_addbooking' ) ) ) {
			$add_booking_url = function_exists( 'wpbc_get_new_booking_url' ) ? wpbc_get_new_booking_url( true, false ) : admin_url( 'admin.php?page=wpbc-new' );
			$actions[]       = $this->get_link_action( 'add_booking', __( 'Add booking', 'booking' ), 'wpbc-bi-calendar-plus', add_query_arg( 'booking_type', $resource_id, $add_booking_url ) );
		}
		if ( current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_availability' ) ) ) {
			$availability_url = function_exists( 'wpbc_get_availability_url' ) ? wpbc_get_availability_url( true, false ) : admin_url( 'admin.php?page=wpbc-availability' );
			$actions[]        = $this->get_link_action( 'manage_availability', __( 'Manage availability', 'booking' ), 'wpbc-bi-calendar-check', add_query_arg( 'resource_id', $resource_id, $availability_url ) );
		}
		/**
		 * Filter already-authorized navigation actions for catalog details.
		 *
		 * The normalizer below permits removal or URL replacement only; it cannot
		 * add a capability-gated action that was absent from the original set.
		 *
		 * @param array<int,array<string,string>> $actions     Authorized actions.
		 * @param int                            $resource_id Booking Resource ID.
		 */
		$authorized_actions = array_values(
			array_filter(
				$actions,
				static function ( $action ) {
					return is_array( $action ) && 'link' === $action['kind'];
				}
			)
		);
		$filtered_actions   = (array) apply_filters( 'wpbc_catalog_booking_resource_details_actions', $authorized_actions, $resource_id );
		$filtered_links     = array();
		foreach ( $authorized_actions as $authorized_action ) {
			$action_id = $authorized_action['id'];
			foreach ( $filtered_actions as $filtered_action ) {
				if ( ! is_array( $filtered_action ) || ! isset( $filtered_action['id'] ) || $action_id !== sanitize_key( $filtered_action['id'] ) ) {
					continue;
				}
				$filtered_url = isset( $filtered_action['url'] ) ? esc_url_raw( (string) $filtered_action['url'] ) : '';
				if ( '' !== $filtered_url ) {
					$authorized_action['url'] = $filtered_url;
					$filtered_links[]         = $authorized_action;
				}
				break;
			}
		}
		$actions = array_values(
			array_filter(
				$actions,
				static function ( $action ) {
					return is_array( $action ) && 'link' !== $action['kind'];
				}
			)
		);
		array_splice( $actions, count( $actions ), 0, $filtered_links );
		if (
			$can_manage
			&& class_exists( 'wpdev_bk_personal' )
			&& WPBC_Catalog_Booking_Resource_Demo_Policy::can_delete_resource( $resource_id )
		) {
			$actions[] = $this->get_button_action( 'delete_resource', __( 'Delete Booking Resource', 'booking' ), 'wpbc-bi-trash3', 'delete', 'destructive' );
		}

		$section               = $this->get_section( 'resource_actions', __( 'Resource actions', 'booking' ), 'wpbc-bi-lightning-charge', array(), $actions );
		$section['class_name'] = 'wpbc_booking_resources__details_card--actions';

		return $section;
	}

	/**
	 * Return a normalized card section.
	 *
	 * @param string $section_id Section identifier.
	 * @param string $title      Translated section title.
	 * @param string $icon       Existing Booking Calendar icon class.
	 * @param array  $fields     Presentation fields.
	 * @param array  $actions    Presentation actions.
	 *
	 * @return array<string,mixed> Normalized section.
	 */
	private function get_section( $section_id, $title, $icon, $fields = array(), $actions = array() ) {
		return array(
			'id'         => sanitize_key( $section_id ),
			'title'      => sanitize_text_field( $title ),
			'icon'       => sanitize_html_class( $icon ),
			'class_name' => '',
			'fields'     => array_values( array_filter( (array) $fields ) ),
			'actions'    => array_values( array_filter( (array) $actions ) ),
		);
	}

	/**
	 * Return a normalized text/code field.
	 *
	 * @param string $label        Field label.
	 * @param mixed  $field_value  Scalar display value.
	 * @param string $value_type   Presentation type: text or code.
	 * @param string $help         Optional explanatory text.
	 * @param string $manage_url   Optional authorized destination.
	 * @param string $manage_label Optional destination label.
	 *
	 * @return array<string,mixed> Normalized field.
	 */
	private function get_field( $label, $field_value, $value_type = 'text', $help = '', $manage_url = '', $manage_label = '' ) {
		return array(
			'label'        => sanitize_text_field( $label ),
			'label_class'  => '',
			'value'        => is_scalar( $field_value ) ? sanitize_text_field( (string) $field_value ) : '',
			'value_type'   => 'code' === $value_type ? 'code' : 'text',
			'help'         => sanitize_text_field( $help ),
			'manage_url'   => esc_url_raw( $manage_url ),
			'manage_label' => sanitize_text_field( $manage_label ),
			'links'        => array(),
		);
	}

	/**
	 * Return a normalized list field.
	 *
	 * @param string $label       Field label.
	 * @param array  $links       Label and optional URL records.
	 * @param string $empty_value Text used when the list is empty.
	 *
	 * @return array<string,mixed> Normalized list field.
	 */
	private function get_links_field( $label, $links, $empty_value ) {
		$field               = $this->get_field( $label, $empty_value );
		$field['value_type'] = 'links';
		$field['links']      = array_values( $links );

		return $field;
	}

	/**
	 * Return one authorized link action.
	 *
	 * @param string $action_id Action identifier.
	 * @param string $label     Action label.
	 * @param string $icon      Icon class.
	 * @param string $url       Authorized destination URL.
	 * @param string $style     Button style identifier.
	 * @param bool   $new_tab   Whether the public link opens in a new tab.
	 *
	 * @return array<string,string> Normalized action.
	 */
	private function get_link_action( $action_id, $label, $icon, $url, $style = 'secondary', $new_tab = false ) {
		return array(
			'id'         => sanitize_key( $action_id ),
			'kind'       => 'link',
			'label'      => sanitize_text_field( $label ),
			'icon'       => sanitize_html_class( $icon ),
			'url'        => esc_url_raw( $url ),
			'style'      => 'primary' === $style ? 'primary' : 'secondary',
			'target'     => $new_tab ? '_blank' : '',
			'copy_value' => '',
		);
	}

	/**
	 * Return one client-side Resource action button.
	 *
	 * Edit, capacity, and delete are handled by the independent inspectors.
	 * Pending buttons are deliberately rendered without a command attribute
	 * until their authorized mutation workflows are implemented in later phases.
	 *
	 * @param string $action_id Action identifier.
	 * @param string $label     Action label.
	 * @param string $icon      Existing Booking Calendar icon class.
	 * @param string $kind      Edit, capacity, delete, or pending behavior.
	 * @param string $style     Primary, secondary, or destructive style.
	 *
	 * @return array<string,string> Normalized button action.
	 */
	private function get_button_action( $action_id, $label, $icon, $kind, $style = 'secondary' ) {
		$allowed_styles = array( 'destructive', 'primary', 'secondary' );
		$allowed_kinds  = array( 'capacity', 'delete', 'edit', 'pending' );

		return array(
			'id'         => sanitize_key( $action_id ),
			'kind'       => in_array( $kind, $allowed_kinds, true ) ? $kind : 'pending',
			'label'      => sanitize_text_field( $label ),
			'icon'       => sanitize_html_class( $icon ),
			'url'        => '',
			'style'      => in_array( $style, $allowed_styles, true ) ? $style : 'secondary',
			'target'     => '',
			'copy_value' => '',
		);
	}

	/**
	 * Return the client-side shortcode-copy action.
	 *
	 * @param string $shortcode Effective Booking shortcode.
	 *
	 * @return array<string,string> Normalized action.
	 */
	private function get_copy_action( $shortcode ) {
		return array(
			'id'         => 'copy_shortcode',
			'kind'       => 'copy',
			'label'      => __( 'Copy shortcode', 'booking' ),
			'icon'       => 'wpbc-bi-clipboard',
			'url'        => '',
			'style'      => 'secondary',
			'target'     => '',
			'copy_value' => sanitize_text_field( $shortcode ),
		);
	}

	/**
	 * Return a client-owned shortcode action without executable response data.
	 *
	 * @param string $action_id Action identifier.
	 * @param string $kind      Customize or publish command.
	 * @param string $label     Translated button label.
	 * @param string $icon      Existing Booking Calendar icon class.
	 * @param string $shortcode Effective Booking shortcode.
	 * @param string $style     Primary or secondary button style.
	 *
	 * @return array<string,string> Normalized client action.
	 */
	private function get_client_action( $action_id, $kind, $label, $icon, $shortcode, $style = 'secondary' ) {
		return array(
			'id'         => sanitize_key( $action_id ),
			'kind'       => in_array( $kind, array( 'customize', 'publish' ), true ) ? $kind : 'customize',
			'label'      => sanitize_text_field( $label ),
			'icon'       => sanitize_html_class( $icon ),
			'url'        => '',
			'style'      => 'primary' === $style ? 'primary' : 'secondary',
			'target'     => '',
			'copy_value' => sanitize_text_field( $shortcode ),
		);
	}

	/**
	 * Normalize the Resource relationship type.
	 *
	 * @param mixed $resource_type Untrusted type value.
	 *
	 * @return string Single, parent, or child.
	 */
	private function normalize_resource_type( $resource_type ) {
		$resource_type = sanitize_key( (string) $resource_type );

		return in_array( $resource_type, array( 'single', 'parent', 'child' ), true ) ? $resource_type : 'single';
	}

	/**
	 * Return the normal Resource type label.
	 *
	 * @param string $resource_type Normalized Resource type.
	 *
	 * @return string Translated label.
	 */
	private function get_resource_type_label( $resource_type ) {
		$labels = array(
			'single' => __( 'Booking Resource', 'booking' ),
			'parent' => __( 'Parent Booking Resource', 'booking' ),
			'child'  => __( 'Child Booking Resource', 'booking' ),
		);

		return $labels[ $resource_type ];
	}

	/**
	 * Return the structural type label.
	 *
	 * @param string $resource_type Normalized Resource type.
	 *
	 * @return string Translated relationship label.
	 */
	private function get_structure_type_label( $resource_type ) {
		$labels = array(
			'single' => __( 'Independent', 'booking' ),
			'parent' => __( 'Parent', 'booking' ),
			'child'  => __( 'Child', 'booking' ),
		);

		return $labels[ $resource_type ];
	}

	/**
	 * Return the translated charging-period label.
	 *
	 * @param string $charging_period Stored charging-period identifier.
	 *
	 * @return string Translated label.
	 */
	private function get_charging_period_label( $charging_period ) {
		$labels = array(
			'day'     => __( 'Per day', 'booking' ),
			'night'   => __( 'Per night', 'booking' ),
			'hour'    => __( 'Per hour', 'booking' ),
			'session' => __( 'Per session', 'booking' ),
			'fixed'   => __( 'Fixed price', 'booking' ),
		);

		return isset( $labels[ $charging_period ] ) ? $labels[ $charging_period ] : $labels['day'];
	}

	/**
	 * Build an authorized Form Builder URL.
	 *
	 * @param string $form_name     Booking Form slug.
	 * @param int    $owner_user_id Resource owner user ID.
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
	 * Determine whether the current context can edit an owner's settings.
	 *
	 * @param int $owner_user_id Resource owner user ID.
	 *
	 * @return bool True when the exact settings context is accessible.
	 */
	private function can_edit_owner_settings( $owner_user_id ) {
		if ( ! current_user_can( wpbc_catalog_booking_resources_get_role_capability( 'booking_user_role_settings' ) ) ) {
			return false;
		}
		if ( function_exists( 'wpbc_is_mu_user_can_be_here' ) && ( ! wpbc_is_mu_user_can_be_here( 'activated_user' ) || ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) ) ) {
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

	/**
	 * Determine whether sensitive MultiUser owner data may be disclosed.
	 *
	 * @return bool True only for the Booking Calendar super administrator.
	 */
	private function can_view_owner_details() {
		return class_exists( 'wpdev_bk_multiuser' )
			&& (bool) apply_bk_filter( 'multiuser_is_user_can_be_here', true, 'only_super_admin' );
	}

	/**
	 * Read normalized season availability for one Resource.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return array{general:string,filter:array} Normalized availability record.
	 */
	private function get_season_availability( $resource_id ) {
		$availability = array( 'general' => 'On', 'filter' => array() );
		$records      = wpbc_get_resource_meta( absint( $resource_id ), 'availability' );
		if ( empty( $records[0]->value ) ) {
			return $availability;
		}
		$stored = maybe_unserialize( $records[0]->value );
		if ( is_array( $stored ) ) {
			$availability['general'] = isset( $stored['general'] ) && 'Off' === $stored['general'] ? 'Off' : 'On';
			$availability['filter']  = isset( $stored['filter'] ) && is_array( $stored['filter'] ) ? $stored['filter'] : array();
		}

		return $availability;
	}

	/**
	 * Count active season rules.
	 *
	 * @param array $availability Normalized availability record.
	 *
	 * @return int Number of enabled rules.
	 */
	private function count_active_season_rules( $availability ) {
		$rule_count = 0;
		foreach ( isset( $availability['filter'] ) ? (array) $availability['filter'] : array() as $filter_state ) {
			if ( 'On' === $filter_state ) {
				++$rule_count;
			}
		}

		return $rule_count;
	}

	/**
	 * Format the global earliest bookable day.
	 *
	 * @return string Human-readable booking-window start.
	 */
	private function format_booking_window_start() {
		$stored_start = sanitize_text_field( (string) get_bk_option( 'booking_unavailable_days_num_from_today' ) );
		if ( '' === $stored_start || '0' === $stored_start ) {
			return __( 'Today', 'booking' );
		}
		if ( function_exists( 'wpbc_availability_general__get_unavailable_from_today_options' ) ) {
			$options = wpbc_availability_general__get_unavailable_from_today_options();
			if ( isset( $options[ $stored_start ] ) ) {
				return wp_strip_all_tags( (string) $options[ $stored_start ] ) . ' ' . __( 'from now', 'booking' );
			}
		}
		if ( preg_match( '/^(\d+)m$/', $stored_start, $matches ) ) {
			$minutes = absint( $matches[1] );
			return sprintf( _n( '%s minute from now', '%s minutes from now', $minutes, 'booking' ), number_format_i18n( $minutes ) );
		}
		$days = absint( $stored_start );

		return sprintf( _n( '%s day from today', '%s days from today', $days, 'booking' ), number_format_i18n( $days ) );
	}

	/**
	 * Format the global booking horizon.
	 *
	 * @return string Human-readable booking horizon.
	 */
	private function format_booking_window_horizon() {
		$stored_horizon = get_bk_option( 'booking_available_days_num_from_today' );
		if ( '' === (string) $stored_horizon || 0 === absint( $stored_horizon ) ) {
			return __( 'No day limit', 'booking' );
		}
		$days = absint( $stored_horizon );

		return sprintf( _n( '%s day from today', '%s days from today', $days, 'booking' ), number_format_i18n( $days ) );
	}

	/**
	 * Activate the owning MultiUser option context for one Resource.
	 *
	 * @param int $resource_id Booking Resource ID.
	 *
	 * @return mixed Previous active-user token.
	 */
	private function set_owner_environment( $resource_id ) {
		return function_exists( 'apply_bk_filter' )
			? apply_bk_filter( 'wpbc_mu_set_environment_for_owner_of_resource', -1, absint( $resource_id ) )
			: -1;
	}

	/**
	 * Restore the prior MultiUser option context.
	 *
	 * @param mixed $previous_user Previous active-user token.
	 * @param int   $resource_id   Booking Resource ID used to decide whether a switch occurred.
	 *
	 * @return void
	 */
	private function restore_owner_environment( $previous_user, $resource_id ) {
		if ( absint( $resource_id ) && function_exists( 'make_bk_action' ) ) {
			make_bk_action( 'wpbc_mu_set_environment_for_user', $previous_user );
		}
	}
}
