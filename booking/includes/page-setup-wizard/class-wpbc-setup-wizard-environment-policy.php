<?php
/**
 * Environment policy for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/_functions/class-wpbc-environment-policy.php';

/**
 * Expose Setup Wizard capabilities from the shared environment policy.
 *
 * Route composition, review presentation, checkpoint normalization, and any
 * future final-summary sender use this facade. Host identity and capability
 * decisions remain owned by WPBC_Environment_Policy, the project-wide source
 * of truth.
 */
final class WPBC_Setup_Wizard_Environment_Policy {

	/**
	 * Determine whether the current site is a Booking Calendar live demo.
	 *
	 * @return bool True for a live-demo website.
	 */
	public static function is_live_demo() {
		return WPBC_Environment_Policy::is_live_demo();
	}

	/**
	 * Determine whether WordPress is running in Playground.
	 *
	 * A strict boolean check avoids treating a non-boolean compatibility value
	 * as authorization to remove a normal-site wizard step.
	 *
	 * @return bool True only when the canonical Playground constant is true.
	 */
	public static function is_playground() {
		return WPBC_Environment_Policy::is_playground();
	}

	/**
	 * Determine whether the wizard may collect Business details.
	 *
	 * @return bool True on normal installations; false on demos and Playground.
	 */
	public static function allows_business_details() {
		return WPBC_Environment_Policy::allows_setup_business_details();
	}

	/**
	 * Determine whether a final setup-summary email may be requested or sent.
	 *
	 * Summary email depends on the Business details step for its explicit email
	 * address and consent. Environments that omit that step must never infer a
	 * recipient from an older checkpoint or another WordPress option.
	 *
	 * @return bool True when Business details and summary email are available.
	 */
	public static function allows_summary_email() {
		return WPBC_Environment_Policy::allows_setup_summary_email();
	}

	/**
	 * Determine whether the wizard may discover or publish WordPress pages.
	 *
	 * @return bool True for customer and internal test installations.
	 */
	public static function allows_page_publishing() {
		return WPBC_Environment_Policy::allows_page_publishing();
	}
}
