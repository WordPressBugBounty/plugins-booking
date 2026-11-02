<?php
/**
 * Stable identifiers and bounded request limits for Add New Booking Inspector.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Defines stable, executable-free configuration for the creation domain.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_New_Inspector_Config {

	/** Contract version carried by every request and response. */
	const SCHEMA_VERSION = 1;

	/** Stable shared-Inspector component identifier. */
	const COMPONENT_ID = 'wpbc_booking_new_inspector';

	/** Stable Timeline empty-launch action identifier. */
	const TIMELINE_TOOLBAR_ACTION_ID = 'wpbc_timeline_new_booking';

	/** Stable Timeline empty-launch marker; the historical constant name remains compatible. */
	const TIMELINE_TOOLBAR_LAUNCH_CONTEXT = 'timeline_toolbar';

	/** Stable full-day Timeline selection launch-context marker. */
	const TIMELINE_SELECTION_LAUNCH_CONTEXT = 'timeline_selection';

	/** Stable Time Rows range launch-context marker. */
	const TIMELINE_TIME_ROWS_LAUNCH_CONTEXT = 'timeline_time_rows';

	/** Released Timeline handoff query argument containing the opaque token. */
	const TIMELINE_HANDOFF_QUERY_ARG = 'wpbc_timeline_handoff';

	/** Compiler-owned schedule workflow script handle. */
	const SCHEDULE_SCRIPT_HANDLE = 'wpbc-booking-new-inspector-schedule';

	/** Compiler-owned Inspector host adapter script handle. */
	const ADAPTER_SCRIPT_HANDLE = 'wpbc-booking-new-inspector';

	/** Compiler-owned Inspector domain stylesheet handle. */
	const STYLE_HANDLE = 'wpbc-booking-new-inspector';

	/** AJAX action used to load authorized creation context. */
	const ACTION_BOOTSTRAP = 'wpbc_booking_new_inspector_bootstrap';

	/** AJAX action used to load and normalize a non-mutating schedule draft. */
	const ACTION_SCHEDULE = 'wpbc_booking_new_inspector_schedule';

	/** AJAX action used for non-mutating cost previews. */
	const ACTION_COST_PREVIEW = 'wpbc_booking_new_inspector_cost_preview';

	/** AJAX action used for signed, non-mutating creation review. */
	const ACTION_REVIEW = 'wpbc_booking_new_inspector_review';

	/** AJAX action used to apply one reviewed creation plan. */
	const ACTION_APPLY = 'wpbc_booking_new_inspector_apply';

	/** Stable fallback action shown for unsupported forms. */
	const FALLBACK_ACTION_OPEN_FULL_ADD_BOOKING = 'open_full_add_booking';

	/** Maximum encoded request body accepted by any domain endpoint. */
	const MAX_REQUEST_BYTES = 131072;

	/** Maximum selected dates accepted in one draft. */
	const MAX_DATES = 366;

	/** Maximum form fields accepted in one draft. */
	const MAX_FIELDS = 100;

	/** Maximum submitted values accepted for one multi-value field. */
	const MAX_VALUES_PER_FIELD = 100;

	/** Maximum selectable options exposed for one form field. */
	const MAX_OPTIONS_PER_FIELD = 300;

	/** Maximum bytes accepted for one scalar form-field value. */
	const MAX_FIELD_VALUE_BYTES = 10000;

	/** Maximum bytes accepted for one single-line text value. */
	const MAX_TEXT_VALUE_BYTES = 1000;

	/** Maximum bytes accepted for one multiline text value. */
	const MAX_TEXTAREA_VALUE_BYTES = 10000;

	/** Maximum bytes accepted for one authorized creation note. */
	const MAX_NOTE_VALUE_BYTES = 10000;

	/** Maximum bytes accepted for one email address. */
	const MAX_EMAIL_VALUE_BYTES = 254;

	/** Maximum bytes accepted for one coupon code before pricing validation. */
	const MAX_COUPON_VALUE_BYTES = 191;

	/** Maximum bytes accepted for an opaque signed context token. */
	const MAX_CONTEXT_TOKEN_BYTES = 16384;

	/** Maximum bytes accepted for an encoded signed review plan. */
	const MAX_REVIEW_PLAN_BYTES = 65536;

	/** Maximum bytes accepted for a review signature. */
	const MAX_REVIEW_TOKEN_BYTES = 128;

	/** Maximum bytes accepted for an idempotency key. */
	const MAX_IDEMPOTENCY_KEY_BYTES = 64;

	/** Maximum bytes accepted for a browser request correlation ID. */
	const MAX_REQUEST_ID_BYTES = 64;

	/** Maximum resources returned by one bootstrap response. */
	const MAX_RESOURCE_CHOICES = 500;

	/** Maximum forms returned by one bootstrap response. */
	const MAX_FORM_CHOICES = 200;

	/** Maximum warnings returned by one response. */
	const MAX_WARNINGS = 20;

	/** Maximum field errors returned by one response. */
	const MAX_FIELD_ERRORS = 100;

	/**
	 * Return the stable authenticated AJAX action IDs.
	 *
	 * @since 12.0.0
	 * @return array<string,string> Action IDs keyed by workflow operation.
	 */
	public static function get_action_ids() {
		return array(
			'bootstrap'    => self::ACTION_BOOTSTRAP,
			'schedule'     => self::ACTION_SCHEDULE,
			'cost_preview' => self::ACTION_COST_PREVIEW,
			'review'       => self::ACTION_REVIEW,
			'apply'        => self::ACTION_APPLY,
		);
	}

	/**
	 * Return the site-bound nonce actions for current and reserved endpoints.
	 *
	 * @since 12.0.0
	 * @return array<string,string> Nonce actions keyed by workflow operation.
	 */
	public static function get_nonce_actions() {
		return array(
			'bootstrap'    => self::ACTION_BOOTSTRAP . '_nonce',
			'schedule'     => self::ACTION_SCHEDULE . '_nonce',
			'cost_preview' => self::ACTION_COST_PREVIEW . '_nonce',
			'review'       => self::ACTION_REVIEW . '_nonce',
			'apply'        => self::ACTION_APPLY . '_nonce',
		);
	}

	/**
	 * Return one nonce action bound explicitly to the current multisite site.
	 *
	 * WordPress nonces bind users and sessions but do not include the current
	 * blog ID by default. Appending that server-side ID prevents a nonce created
	 * on one network site from authorizing this domain on another site.
	 *
	 * @since 12.0.0
	 * @param string $operation Stable operation key from get_nonce_actions().
	 * @return string Site-bound nonce action, or an empty string for an unknown operation.
	 */
	public static function get_site_nonce_action( $operation ) {
		$nonce_actions = self::get_nonce_actions();
		$operation     = sanitize_key( (string) $operation );
		if ( ! isset( $nonce_actions[ $operation ] ) ) {
			return '';
		}

		$site_id = function_exists( 'get_current_blog_id' ) ? absint( get_current_blog_id() ) : 0;

		return $nonce_actions[ $operation ] . ':site:' . $site_id;
	}

	/**
	 * Return the fixed WordPress template allow list.
	 *
	 * These IDs remain reservations through Phase 3. No templates are registered
	 * or rendered until their domain-owned implementations exist.
	 *
	 * @since 12.0.0
	 * @return array<string,string> Template IDs keyed by presentation role.
	 */
	public static function get_template_ids() {
		return array(
			'shell'             => 'wpbc-booking-new-inspector-shell',
			'header'            => 'wpbc-booking-new-inspector-header',
			'resource'          => 'wpbc-booking-new-inspector-resource',
			'fields'            => 'wpbc-booking-new-inspector-fields',
			'field'             => 'wpbc-booking-new-inspector-field',
			'notes'             => 'wpbc-booking-new-inspector-notes',
			'dates'             => 'wpbc-booking-new-inspector-dates',
			'costs'             => 'wpbc-booking-new-inspector-costs',
			'footer'            => 'wpbc-booking-new-inspector-footer',
			'review'            => 'wpbc-booking-new-inspector-review',
			'created'           => 'wpbc-booking-new-inspector-created',
			'state'             => 'wpbc-booking-new-inspector-state',
			'unsupported_form'  => 'wpbc-booking-new-inspector-unsupported-form',
		);
	}

	/**
	 * Return per-action encoded request ceilings.
	 *
	 * The bootstrap request carries identity only. Draft-bearing preview and
	 * review requests receive the global ceiling. Apply accepts only a reviewed
	 * plan, signature, and idempotency envelope.
	 *
	 * @since 12.0.0
	 * @return array<string,int> Maximum request bytes keyed by action ID.
	 */
	public static function get_action_request_limits() {
		return array(
			self::ACTION_BOOTSTRAP    => 32768,
			self::ACTION_SCHEDULE     => 65536,
			self::ACTION_COST_PREVIEW => self::MAX_REQUEST_BYTES,
			self::ACTION_REVIEW       => self::MAX_REQUEST_BYTES,
			self::ACTION_APPLY        => 98304,
		);
	}

	/**
	 * Return all collection and scalar-size ceilings.
	 *
	 * @since 12.0.0
	 * @return array<string,int> Stable request and response limits.
	 */
	public static function get_limits() {
		return array(
			'max_request_bytes'          => self::MAX_REQUEST_BYTES,
			'max_dates'                  => self::MAX_DATES,
			'max_fields'                 => self::MAX_FIELDS,
			'max_values_per_field'       => self::MAX_VALUES_PER_FIELD,
			'max_options_per_field'      => self::MAX_OPTIONS_PER_FIELD,
			'max_field_value_bytes'      => self::MAX_FIELD_VALUE_BYTES,
			'max_text_value_bytes'       => self::MAX_TEXT_VALUE_BYTES,
			'max_textarea_value_bytes'   => self::MAX_TEXTAREA_VALUE_BYTES,
			'max_note_value_bytes'       => self::MAX_NOTE_VALUE_BYTES,
			'max_email_value_bytes'      => self::MAX_EMAIL_VALUE_BYTES,
			'max_coupon_value_bytes'     => self::MAX_COUPON_VALUE_BYTES,
			'max_context_token_bytes'    => self::MAX_CONTEXT_TOKEN_BYTES,
			'max_review_plan_bytes'      => self::MAX_REVIEW_PLAN_BYTES,
			'max_review_token_bytes'     => self::MAX_REVIEW_TOKEN_BYTES,
			'max_idempotency_key_bytes'  => self::MAX_IDEMPOTENCY_KEY_BYTES,
			'max_request_id_bytes'       => self::MAX_REQUEST_ID_BYTES,
			'max_resource_choices'       => self::MAX_RESOURCE_CHOICES,
			'max_form_choices'           => self::MAX_FORM_CHOICES,
			'max_warnings'               => self::MAX_WARNINGS,
			'max_field_errors'           => self::MAX_FIELD_ERRORS,
		);
	}
}
