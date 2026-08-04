<?php
/** AJAX: list Appointment Services. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) { exit; }

/**
 * Return the filtered Service list and Provider presentation directory.
 *
 * Status counts are calculated from the complete provider-filtered result so
 * the management table can switch status without a separate count request.
 *
 * @return void Terminates with a JSON success or error response.
 */
function wpbc_appointment_services_ajax_list() {
	wpbc_appointment_services_ajax_authorize();
	$service_listing = wpbc_appointment_services_get_catalog_listing();
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; the flag only enables an allow-listed user preference write.
	$save_items_per_page = isset( $_POST['save_items_per_page'] )
		&& is_scalar( $_POST['save_items_per_page'] )
		&& '1' === sanitize_text_field( wp_unslash( $_POST['save_items_per_page'] ) );
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above and normalized by WPBC_UI_Listing.
	if ( $save_items_per_page && isset( $_POST['items_per_page'] ) ) {
		$service_listing->save_items_per_page( wp_unslash( $_POST['items_per_page'] ) );
	}
	$provider = wpbc_appointment_services_get_data_provider();
	if ( ! is_object( $provider ) || ! method_exists( $provider, 'list_items' ) || ! wpbc_appointment_services_storage_is_ready() ) {
		wp_send_json_success(
			array(
				'storage_ready' => false,
				'services'      => array(),
				'listing'       => $service_listing->get_client_settings(),
				'message'       => wpbc_appointment_services_storage_error()->get_error_message(),
			)
		);
	}
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; sanitized before the repository boundary.
	$search = isset( $_POST['search'] ) && is_scalar( $_POST['search'] ) ? sanitize_text_field( wp_unslash( $_POST['search'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; validated against the status allow-list.
	$status = isset( $_POST['status'] ) && is_scalar( $_POST['status'] ) ? sanitize_key( wp_unslash( $_POST['status'] ) ) : 'active';
	if ( ! in_array( $status, array( 'all', 'active', 'inactive', 'archived' ), true ) ) { $status = 'active'; }
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; normalized to a positive integer.
	$resource_id = isset( $_POST['resource_id'] ) && is_scalar( $_POST['resource_id'] ) ? absint( $_POST['resource_id'] ) : 0;
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; normalized by the shared listing component.
	$page_number = isset( $_POST['page_number'] ) ? wp_unslash( $_POST['page_number'] ) : 1;
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; normalized against the configured allow-list.
	$items_per_page = isset( $_POST['items_per_page'] ) ? wp_unslash( $_POST['items_per_page'] ) : $service_listing->get_items_per_page();
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; normalized against sortable listing columns.
	$sort_by = isset( $_POST['sort_by'] ) ? wp_unslash( $_POST['sort_by'] ) : null;
	// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Authorized above; normalized to asc or desc.
	$sort_order = isset( $_POST['sort_order'] ) ? wp_unslash( $_POST['sort_order'] ) : null;
	$catalog_page   = wpbc_appointment_services_get_catalog_page(
		$provider,
		array(
			'search'         => $search,
			'status'         => $status,
			'resource_id'    => $resource_id,
			'page_number'    => $page_number,
			'items_per_page' => $items_per_page,
			'sort_by'        => $sort_by,
			'sort_order'     => $sort_order,
		),
		$service_listing
	);
	if ( is_wp_error( $catalog_page ) ) {
		wpbc_appointment_services_send_provider_error( $catalog_page, __( 'Services could not be loaded.', 'booking' ) );
	}
	$directory = wpbc_appointment_services_get_provider_directory();
	wp_send_json_success(
		array(
			'storage_ready' => true,
			'services'      => $catalog_page['services'],
			'counts'        => $catalog_page['counts'],
			'pagination'    => $catalog_page['pagination'],
			'sorting'       => $catalog_page['sorting'],
			'providers'     => array_values( $directory ),
			'provider_count'=> count( $directory ),
			'listing'       => $service_listing->get_client_settings(),
		)
	);
}
add_action( 'wp_ajax_WPBC_AJX_APPOINTMENT_SERVICES_LIST', 'wpbc_appointment_services_ajax_list' );
