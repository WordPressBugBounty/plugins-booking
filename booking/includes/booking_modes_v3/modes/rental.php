<?php
/**
 * Rental Booking Modes V3 declaration.
 *
 * This executable-free declaration contains presentation references only. It
 * registers no hooks, loads no domain controller, and performs no mutation.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the Rental mode definition consumed by the allow-listed V3 loader.
 *
 * @return array<string,mixed> Validated Booking Modes V3 declaration.
 */
return array(
	'id'             => 'rental',
	'label'          => 'Rentals',
	'description'    => 'Property rental administration.',
	'default_route'  => array( 'page' => 'wpbc', 'tab' => 'vm_booking_listing' ),
	'quickstart_id'  => 'rental',

	// Only references used below; all other pages and subtabs keep their own definitions.
	'pages'          => array(
		// Bookings. booking/includes/page-bookings/bookings__page.php:33.
		'bookings'                    => array(
			'route'           => array( 'page' => 'wpbc', 'tab' => 'vm_booking_listing' ),
			'page_options'    => array(
				'is_show_top_path'       => true,
				'top_path_title'         => 'Bookings',
				'is_show_top_navigation' => true,
			),
			'horizontal_menu' => array(
				'visible'       => true,
				'title'         => 'Bookings',
				'show_on_pages' => array( 'bookings', 'calendar', 'add_booking' ),
			),
		),
		// Timeline View. booking/core/admin/page-timeline.php:31.
		// Horizontal-only link: hidden separately in sidebar_menu; no independent native slug.
		'calendar'                    => array(
			'route'           => array( 'page' => 'wpbc', 'tab' => 'vm_calendar' ),
			'page_options'    => array(
				'is_show_top_path'       => true,
				'top_path_title'         => 'Timeline',
				'is_show_top_navigation' => true,
			),
			'horizontal_menu' => array(
				'visible'       => true,
				'title'         => 'Timeline',
				'show_on_pages' => array( 'bookings', 'calendar', 'add_booking' ),
			),
		),
		// Add booking. booking/includes/page-add-booking/add_booking__page.php:174.
		'add_booking'                 => array(
			'route'           => array( 'page' => 'wpbc', 'tab' => 'add-booking' ),
			'page_options'    => array(
				'is_show_top_path'       => true,
				'top_path_title'         => 'Add Booking',
				'is_show_top_navigation' => true,
			),
			'horizontal_menu' => array(
				'visible'       => true,
				'title'         => 'Add Booking',
				'show_on_pages' => array( 'bookings', 'calendar', 'add_booking' ),
			),
		),
		// Add Appointment. booking/includes/page-add-appointment/add_appointment__page.php:178.
		'add_appointment'             => array(
			'route'           => array( 'page' => 'wpbc', 'tab' => 'add-appointment' ),
			'horizontal_menu' => array(
				'visible' => false,
			),
		),
		// Services. booking/includes/page-appointment-services/appointment_services__page.php:475.
		'services'                    => array(
			'route'           => array( 'page' => 'wpbc-services', 'tab' => 'appointment_services' ),
			'horizontal_menu' => array(
				'visible' => false,
			),
		),
		// Resources. booking/includes/page-catalog-booking-resources/booking-resources-catalog-page.php:504.
		'resources'                   => array(
			'route'        => array( 'page' => 'wpbc-resources', 'tab' => 'resources' ),
			'page_options' => array(
				'top_path_title' => 'Properties',
			),
		),
		// Capacity Rules. booking/includes/page-resource-capacity/page-resource-capacity.php:209.
		'capacity_rules'              => array(
			'route' => array( 'page' => 'wpbc-resources', 'tab' => 'capacity' ),
		),
		// Search Availability. booking-calendar-com/inc/_bl/search/page-searchable.php:52.
		'searchable_resources'        => array(
			'route'        => array( 'page' => 'wpbc-resources', 'tab' => 'searchable_resources' ),
			'page_options' => array(
				'top_path_title' => 'Searchable Properties',
			),
		),
		// Searchable Resources leaf used by the flattened Search Availability sidebar group.
		'searchable_resources_options' => array(
			'route' => array( 'page' => 'wpbc-resources', 'tab' => 'searchable_resources', 'subtab' => 'searchable_resources_options' ),
		),
		// Block Dates. booking/includes/page-availability/availability__page.php:37.
		'block_dates'                 => array(
			'route' => array( 'page' => 'wpbc-availability', 'tab' => 'availability' ),
		),
		// Block Times. booking/includes/page-availability-timeslots/availability_timeslots__page.php:525.
		'block_times'                 => array(
			'route'           => array( 'page' => 'wpbc-availability', 'tab' => 'time_slots_availability' ),
			'horizontal_menu' => array(
				'visible' => false,
			),
		),
		// Schedule & Rules. booking/includes/page-availability/availability__page.php:424.
		'schedule_rules'              => array(
			'route' => array( 'page' => 'wpbc-availability', 'tab' => 'general_availability' ),
		),
		// Seasonal Availability. booking-calendar-com/inc/_bm/admin/page-availability.php:49.
		'seasonal_availability'       => array(
			'route' => array( 'page' => 'wpbc-availability', 'tab' => 'season_availability' ),
		),
		// Seasons. booking-calendar-com/inc/_bm/admin/page-seasons.php:61.
		// Legacy route: use only while its existing controller registers this tab.
		'legacy_availability_seasons' => array(
			'route' => array( 'page' => 'wpbc-availability', 'tab' => 'filter' ),
		),
		// Prices. booking-calendar-com/inc/_bm/admin/page-costs_flexible.php:58.
		'prices'                      => array(
			'route' => array( 'page' => 'wpbc-prices', 'tab' => 'cost' ),
		),
		// Form Options Costs. booking-calendar-com/inc/_bm/admin/page-cost-advanced.php:38.
		'form_options_costs'          => array(
			'route' => array( 'page' => 'wpbc-prices', 'tab' => 'cost_advanced' ),
		),
		// Discount Coupons. booking-calendar-com/inc/_bl/admin/page-coupons.php:40.
		'coupons'                     => array(
			'route' => array( 'page' => 'wpbc-prices', 'tab' => 'coupons' ),
		),
		// Payment Setup. booking-calendar-com/inc/gateways/page-gateways.php:572.
		'payment_setup'               => array(
			'route' => array( 'page' => 'wpbc-prices', 'tab' => 'payment' ),
		),
		// Payment Description is an in-page anchor, not a standalone administration screen.
		'payment_description'         => array(
			'route' => array( 'page' => 'wpbc-prices', 'tab' => 'payment', 'subtab' => 'payment_description' ),
		),
		// Seasons. booking-calendar-com/inc/_bm/admin/page-seasons.php:61.
		// Legacy route: use only while its existing controller registers this tab.
		'legacy_price_seasons'        => array(
			'route' => array( 'page' => 'wpbc-prices', 'tab' => 'filter' ),
		),
		// Seasons. booking-calendar-com/inc/_bm/includes/page-catalog-seasons/seasons-catalog-page.php:703.
		'seasons'                     => array(
			'route' => array( 'page' => 'wpbc-seasons', 'tab' => 'seasons' ),
		),
		// Dashboard. booking/core/admin/page-settings.php:103.
		'general_settings'            => array(
			'route' => array( 'page' => 'wpbc-settings', 'tab' => 'general' ),
		),
		// Search Availability form and results settings. booking-calendar-com/inc/_bl/search/page-search.php:715.
		'search_settings'             => array(
			'route' => array( 'page' => 'wpbc-settings', 'tab' => 'search' ),
		),
		'search_form_layout'          => array(
			'route' => array( 'page' => 'wpbc-settings', 'tab' => 'search', 'subtab' => 'search_form' ),
		),
		'search_results_layout'       => array(
			'route' => array( 'page' => 'wpbc-settings', 'tab' => 'search', 'subtab' => 'search_results' ),
		),
		'search_options'              => array(
			'route' => array( 'page' => 'wpbc-settings', 'tab' => 'search', 'subtab' => 'search_options' ),
		),
		// Forms Builder. booking/includes/page-form-builder/builder-form-page.php:52.
		// Promoted to a standalone sidebar link. The original Settings route stays unchanged.
		'booking_form'                => array(
			'route' => array( 'page' => 'wpbc-settings', 'tab' => 'builder_booking_form' ),
		),
		// MultiUser settings. The source controller remains responsible for super-admin access.
		'users'                       => array(
			'route' => array( 'page' => 'wpbc-settings', 'tab' => 'users' ),
		),
		// Setup. booking/includes/page-setup/setup__page.php:57.
		'setup'                       => array(
			'route' => array( 'page' => 'wpbc-setup', 'tab' => 'step_01' ),
		),
		// Log Off. booking-calendar-com/inc/_mu/admin/page-log_off.php:31.
		// MultiUser impersonation exit. Preserve domain behavior; never preload this route.
		'log_off'                     => array(
			'route' => array( 'page' => 'wpbc-log-off', 'tab' => 'upgrade' ),
		),
	),

	// Native WordPress entries. editions is an exact list; omission retains domain availability.
	'wordpress_menu' => array(
		'wpbc'              => array(
			'page_id' => 'bookings',
			'title'   => 'Bookings',
		),
		'wpbc-new'          => array(
			'page_id' => 'add_booking',
			'title'   => '+ Add Booking',
		),
		'wpbc-services'     => array(
			'page_id' => 'services',
			'visible' => false,
		),
		'wpbc-resources'    => array(
			'page_id' => 'resources',
			'title'   => 'Properties',
		),
		'wpbc-availability' => array( 'page_id' => 'block_dates' ),
		'wpbc-seasons'      => array(
			'page_id'  => 'seasons',
			'editions' => array( 'business_medium', 'business_large', 'multiuser' ),
		),
		'wpbc-prices'       => array(
			'page_id'  => 'prices',
			'title'    => 'Pricing & Extras',
			'editions' => array( 'business_medium', 'business_large', 'multiuser' ),
		),
		'wpbc-settings'     => array( 'page_id' => 'general_settings' ),
		'wpbc-setup'        => array( 'page_id' => 'setup' ),
		'wpbc-log-off'      => array(
			'page_id'  => 'log_off',
			'editions' => array( 'multiuser' ),
		),
	),

	// White WPBC sidebar. Unlisted tabs inherit; edition-excluded entries never return via fallback.
	'sidebar_menu'   => array(
		'wpbc'              => array(
			'title' => 'Bookings',
			'items' => array(
				'bookings'        => array(
					'page_id' => 'bookings',
					'title'   => 'Bookings',
				),
				'calendar'        => array(
					'page_id' => 'calendar',
					'title'   => 'Timeline',
					'visible' => false,
				),
				'add_booking'     => array(
					'page_id' => 'add_booking',
					'title'   => 'Add Booking',
				),
				'add_appointment' => array(
					'page_id' => 'add_appointment',
					'title'   => 'Add Appointment',
					'visible' => false,
				),
			),
		),
		'wpbc-services'     => array(
			'title'   => 'Services',
			'visible' => false,
			'items'   => array(
				'services' => array(
					'page_id' => 'services',
					'title'   => 'Services',
				),
			),
		),
		'wpbc-resources'    => array(
			'title' => 'Properties',
			'items' => array(
				'resources' => array(
					'page_id' => 'resources',
					'title'   => 'Properties',
				),
			),
		),
		'wpbc-availability' => array(
			'title' => 'Availability',
			'items' => array(
				'block_dates'                 => array(
					'page_id' => 'block_dates',
					'title'   => 'Block Dates',
				),
				'block_times'                 => array(
					'page_id' => 'block_times',
					'title'   => 'Block Times',
					'visible' => false,
				),
				'schedule_rules'              => array(
					'page_id' => 'schedule_rules',
					'title'   => 'Schedule & Rules',
				),
				'seasonal_availability'       => array(
					'page_id'  => 'seasonal_availability',
					'title'    => 'Seasonal Availability',
					'editions' => array( 'business_medium', 'business_large', 'multiuser' ),
				),
				'legacy_availability_seasons' => array(
					'page_id'  => 'legacy_availability_seasons',
					'editions' => array( 'business_medium', 'business_large', 'multiuser' ),
				),
			),
		),
		'wpbc-seasons'      => array(
			'title'    => 'Seasons',
			'page_id'  => 'seasons',
			'editions' => array( 'business_medium', 'business_large', 'multiuser' ),
		),
		'wpbc-prices'       => array(
			'title'    => 'Pricing & Extras',
			'items'    => array(
				'prices'               => array(
					'page_id' => 'prices',
					'title'   => 'Prices & Extras',
				),
				'form_options_costs'   => array(
					'page_id' => 'form_options_costs',
					'title'   => 'Advanced Costs',
				),
				'coupons'              => array(
					'page_id'  => 'coupons',
					'editions' => array( 'business_large', 'multiuser' ),
				),
				'legacy_price_seasons' => array( 'page_id' => 'legacy_price_seasons' ),
				'payment'             => array(
					'page_id' => 'payment_setup',
					'items'   => array(
						'payment_description' => array(
							'page_id' => 'payment_description',
							'visible' => false,
						),
					),
				),
			),
			'editions' => array( 'business_medium', 'business_large', 'multiuser' ),
		),
		'booking_form'      => array(
			'page_id' => 'booking_form',
			'title'   => 'Booking Forms',
		),
		'wpbc-settings'     => array(
			'title'    => 'Settings',
			'expanded' => 'when_active',
			'items'    => array(
				'capacity_rules' => array( 'page_id' => 'capacity_rules' ),
			),
			// Search Availability and MultiUser settings are explicitly reserved below; other Settings pages inherit.
		),
		'wpbc-search-availability' => array(
			'title'    => 'Search Availability',
			'expanded' => 'when_active',
			'items'    => array(
				'searchable_resources_parent' => array(
					'page_id' => 'searchable_resources',
					'visible' => false,
				),
				'search_settings_parent'      => array(
					'page_id' => 'search_settings',
					'visible' => false,
				),
				'searchable_resources'        => array(
					'page_id' => 'searchable_resources_options',
					'title'   => 'Searchable Resources',
				),
				'search_form_layout'           => array(
					'page_id' => 'search_form_layout',
					'title'   => 'Search Form Layout',
				),
				'search_results_layout'        => array(
					'page_id' => 'search_results_layout',
					'title'   => 'Search Results Layout',
				),
				'search_options'               => array(
					'page_id' => 'search_options',
					'title'   => 'Search Options',
				),
			),
			'editions' => array( 'business_large', 'multiuser' ),
		),
		'wpbc-multiuser-settings' => array(
			'page_id'  => 'users',
			'title'    => 'MultiUser Settings',
			'expanded' => 'when_active',
			'editions' => array( 'multiuser' ),
		),
		'wpbc-setup'        => array(
			'title'   => 'Setup',
			'items'   => array(
				'setup' => array( 'page_id' => 'setup' ),
			),
			'visible' => false,
		),
		'log_off'           => array(
			'page_id'  => 'log_off',
			'visible'  => false,
			'editions' => array( 'multiuser' ),
		),
	),
);
