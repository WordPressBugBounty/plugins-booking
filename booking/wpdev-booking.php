<?php
/*
Plugin Name: Booking Calendar
Plugin URI: https://wpbookingcalendar.com/demo/
Description: Booking Calendar is the original WordPress booking plugin — trusted since 2009. Easily add a calendar to your site, display availability, and accept bookings for appointments, events, time slots, or full-day reservations.
Author: wpdevelop, oplugins
Author URI: https://wpbookingcalendar.com/
Text Domain: booking
Domain Path: /languages/
Version: 11.5
License: GPLv2 or later
*/

/*
	Copyright 2009 - 2026  www.wpbookingcalendar.com  (email: info@wpbookingcalendar.com),

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 2 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>
*/

if ( ! defined( 'ABSPATH' ) ) {
	die( '<h3>Direct access to this file do not allow!</h3>' );                                                         // Exit if accessed directly.
}


if ( ! defined( 'WP_BK_VERSION_NUM' ) ) {
	define( 'WP_BK_VERSION_NUM', '11.5' );
}
if ( ! defined( 'WP_BK_PRO_BFB_ONLY_VERSION' ) ) {
	define( 'WP_BK_PRO_BFB_ONLY_VERSION', '11.4' );                                                                    // First Pro version that no longer loads legacy Booking Form settings pages.
}
if ( ! defined( 'WP_BK_MINOR_UPDATE' ) ) {
	define( 'WP_BK_MINOR_UPDATE', true );
}

/**
 * Default Form Style accent color for new Booking Calendar installations.
 *
 * Existing saved settings are intentionally preserved when this value changes.
 *
 * @since 11.5.0
 * @var string
 */
if ( ! defined( 'WPBC_DEFAULT_FORM_ACCENT_COLOR' ) ) {
	define( 'WPBC_DEFAULT_FORM_ACCENT_COLOR', '#4765d5' );  //  '#4765d5' -> default blue  '#465160'; -> black	 // '#3858e9'; -> light blue   // '#3849e8' -> light Woo.
}

/**
 * Master release gate for unfinished Booking Calendar 11.5 functionality.
 *
 * Keep this disabled in 11.4.x maintenance releases. Define it as true before
 * Booking Calendar loads when testing 11.5, and change the default only when
 * Services and the Appointment flow are release-ready.
 */
if ( ! defined( 'WPBC_ENABLE_11_5_FEATURES' ) ) {
	define( 'WPBC_ENABLE_11_5_FEATURES', true );
	if ( WPBC_ENABLE_11_5_FEATURES ) {
		define( 'WPBC_ENABLE_APPOINTMENT_TESTS', false );
	}
}

// ---------------------------------------------------------------------------------------------------------------------
// PRIMARY URL CONSTANTS
// ---------------------------------------------------------------------------------------------------------------------

if ( ! defined( 'WPBC_FILE' ) ) {
	define( 'WPBC_FILE', __FILE__ );                                                                                    // ..\home\siteurl\www\wp-content\plugins\plugin-name\wpdev-booking.php
}

if ( ! defined( 'WPBC_PLUGIN_FILENAME' ) ) {
	define( 'WPBC_PLUGIN_FILENAME', basename( __FILE__ ) );                                                             // wpdev-booking.php .
}

if ( ! defined( 'WPBC_PLUGIN_DIRNAME' ) ) {
	define( 'WPBC_PLUGIN_DIRNAME', plugin_basename( __DIR__ ) );                                                        // plugin-name .
}

if ( ! defined( 'WPBC_PLUGIN_DIR' ) ) {
	define( 'WPBC_PLUGIN_DIR', untrailingslashit( plugin_dir_path( WPBC_FILE ) ) );                                     // ..\home\siteurl\www\wp-content\plugins\plugin-name
}

if ( ! defined( 'WPBC_PLUGIN_URL' ) ) {
	define( 'WPBC_PLUGIN_URL', untrailingslashit( plugins_url( '', WPBC_FILE ) ) );                                     // https: //website.com/wp-content/plugins/plugin-name .
}

if ( ! defined( 'WP_BK_MIN_WP_VERSION' ) ) {
	define( 'WP_BK_MIN_WP_VERSION', '4.0' );                                                                            // Minimum required WP version.
}

if ( ! defined( 'WPBC_JS_IN_FOOTER' ) ) {
	define( 'WPBC_JS_IN_FOOTER', true );                                                                                // Load all  JavaScript files of plugin  at  footer or in header.
}

// ---------------------------------------------------------------------------------------------------------------------
// ==  SYSTEM  CONSTANTS  ==
// ---------------------------------------------------------------------------------------------------------------------
if ( ! defined( 'WP_BK_RESPONSE' ) ) {
	define( 'WP_BK_RESPONSE', false );
}
if ( ! defined( 'WPBC_IS_PLAYGROUND' ) ) {
	define( 'WPBC_IS_PLAYGROUND', ( isset( $_SERVER['SERVER_SOFTWARE'] ) && ( 'PHP.wasm' === $_SERVER['SERVER_SOFTWARE'] ) ) );
}

// Intentionally completely disable showing booking deatils in Timeline view on Front-End side.                         // FixIn: 10.14.11.1.
if ( ! defined( 'WPBC_DISABLE_POPOVER_IN_TIMELINE' ) ) {
	define( 'WPBC_DISABLE_POPOVER_IN_TIMELINE', true );
}

// ---------------------------------------------------------------------------------------------------------------------
// ==  DEBUG  CONSTANTS  ==
// ---------------------------------------------------------------------------------------------------------------------
if ( true ) {
	// :: LIVE
	if ( ! defined( 'WP_BK_BETA_DATA_FILL' ) ) {
		define( 'WP_BK_BETA_DATA_FILL', 0 );
	}                                                                                                                   // Set 0 for no filling or 2 for 241 bookings or more for more.
} else {
	// :: DEBUG
	define( 'WP_BK_BETA_DATA_FILL', 1 );                                                                                // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound
	define( 'WP_BK_BETA_DATA_FILL_AS', 'BL' );                                                                          // BL - Dates   ,   MU - Times.
}




// ---------------------------------------------------------------------------------------------------------------------
// ==  Go  ==
// ---------------------------------------------------------------------------------------------------------------------
require_once WPBC_PLUGIN_DIR . '/core/wpbc.php';
