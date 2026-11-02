<?php
/**
 * Versioned booking activity retention policy.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve and normalize the bounded site-local Activity retention policy.
 */
final class WPBC_Booking_Activity_Retention_Policy {

	/** Current retention contract version. */
	const VERSION = 1;

	/** Default maximum Activity age in days. */
	const DEFAULT_MAX_AGE_DAYS = 365;

	/** Default maximum Activity rows retained per site. */
	const DEFAULT_MAX_ROWS = 100000;

	/** Default maximum rows deleted by one cleanup execution. */
	const DEFAULT_BATCH_SIZE = 500;

	/** Default period during which row-cap cleanup must preserve retry keys. */
	const DEFAULT_RETRY_PROTECTION_DAYS = 7;

	/** Minimum and maximum supported policy values. */
	const MIN_MAX_AGE_DAYS           = 30;
	const MAX_MAX_AGE_DAYS           = 3650;
	const MIN_MAX_ROWS               = 1000;
	const MAX_MAX_ROWS               = 1000000;
	const MIN_BATCH_SIZE             = 50;
	const MAX_BATCH_SIZE             = 1000;
	const MIN_RETRY_PROTECTION_DAYS = 1;
	const MAX_RETRY_PROTECTION_DAYS = 30;

	/**
	 * Return the effective filtered policy for the current site.
	 *
	 * The filter may adjust numeric limits, but normalization always restores
	 * finite safe bounds. Passing zero does not disable retention.
	 *
	 * @return array<string,int> Versioned normalized policy.
	 */
	public function get_policy() {
		/**
		 * Filter the current site's bounded Activity retention limits.
		 *
		 * Values are normalized after this filter, and cannot disable retention.
		 *
		 * @since 12.0.0
		 *
		 * @param array<string,int> $policy Default versioned retention policy.
		 */
		$policy = apply_filters(
			'wpbc_booking_activity_retention_policy',
			array(
				'version'               => self::VERSION,
				'max_age_days'          => self::DEFAULT_MAX_AGE_DAYS,
				'max_rows'              => self::DEFAULT_MAX_ROWS,
				'batch_size'            => self::DEFAULT_BATCH_SIZE,
				'retry_protection_days' => self::DEFAULT_RETRY_PROTECTION_DAYS,
			)
		);

		return self::normalize( $policy );
	}

	/**
	 * Normalize candidate policy values into the supported bounded contract.
	 *
	 * Missing values use defaults. Explicit numeric values are clamped instead
	 * of being treated as missing, so a filter cannot accidentally select an
	 * unlimited policy with zero or a negative value.
	 *
	 * @param mixed $candidate_policy Candidate policy supplied by the filter.
	 *
	 * @return array<string,int> Versioned normalized policy.
	 */
	public static function normalize( $candidate_policy ) {
		$candidate_policy = is_array( $candidate_policy ) ? $candidate_policy : array();
		$max_age_days     = self::normalize_limit(
			$candidate_policy,
			'max_age_days',
			self::DEFAULT_MAX_AGE_DAYS,
			self::MIN_MAX_AGE_DAYS,
			self::MAX_MAX_AGE_DAYS
		);
		$retry_days  = self::normalize_limit(
			$candidate_policy,
			'retry_protection_days',
			self::DEFAULT_RETRY_PROTECTION_DAYS,
			self::MIN_RETRY_PROTECTION_DAYS,
			self::MAX_RETRY_PROTECTION_DAYS
		);

		return array(
			'version'               => self::VERSION,
			'max_age_days'          => $max_age_days,
			'max_rows'              => self::normalize_limit(
				$candidate_policy,
				'max_rows',
				self::DEFAULT_MAX_ROWS,
				self::MIN_MAX_ROWS,
				self::MAX_MAX_ROWS
			),
			'batch_size'            => self::normalize_limit(
				$candidate_policy,
				'batch_size',
				self::DEFAULT_BATCH_SIZE,
				self::MIN_BATCH_SIZE,
				self::MAX_BATCH_SIZE
			),
			'retry_protection_days' => min( $retry_days, $max_age_days ),
		);
	}

	/**
	 * Normalize one integer policy limit while preserving missing-value semantics.
	 *
	 * @param array<string,mixed> $candidate_policy Candidate policy.
	 * @param string              $key              Policy key.
	 * @param int                 $default_value    Default when the key is missing or not numeric.
	 * @param int                 $minimum_value    Inclusive minimum.
	 * @param int                 $maximum_value    Inclusive maximum.
	 *
	 * @return int Bounded integer.
	 */
	private static function normalize_limit( $candidate_policy, $key, $default_value, $minimum_value, $maximum_value ) {
		$candidate_value = array_key_exists( $key, $candidate_policy ) && is_numeric( $candidate_policy[ $key ] )
			? (int) $candidate_policy[ $key ]
			: (int) $default_value;

		return min( (int) $maximum_value, max( (int) $minimum_value, $candidate_value ) );
	}
}
