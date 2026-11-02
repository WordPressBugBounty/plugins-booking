<?php
/**
 * Versioned Timeline Resource-view preference contract.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Validate and persist the current user's site-scoped Resource-view state.
 *
 * The service owns presentation preferences only. It never changes booking,
 * Resource, Availability, or Pricing domain data. Storage callbacks are
 * injectable so the same contract can be tested without mutating user meta.
 */
final class WPBC_Timeline_Resource_View_Preferences {

	/** Current stored-record schema version. */
	const SCHEMA_VERSION = 2;

	/** Historical user-option key retained for backward compatibility. */
	const USER_OPTION_KEY = 'booking_custom_wpbc_timeline_resource_preferences';

	/** Server expression selecting every currently authorized Resource. */
	const SELECTION_MODE_ALL = 'all';

	/** Server expression selecting one ordered set of authorized Resources. */
	const SELECTION_MODE_EXPLICIT = 'explicit';

	/** Preserve the established edition-aware Resource order. */
	const SORT_ORDER_STANDARD = 'standard';

	/** Sort Resource groups and rows by title, ascending. */
	const SORT_ORDER_TITLE_ASC = 'title_asc';

	/** Sort Resource groups and rows by title, descending. */
	const SORT_ORDER_TITLE_DESC = 'title_desc';

	/** Sort Resource groups and rows by identifier, ascending. */
	const SORT_ORDER_ID_ASC = 'id_asc';

	/** Sort Resource groups and rows by identifier, descending. */
	const SORT_ORDER_ID_DESC = 'id_desc';

	/** Default Resource page number. */
	const DEFAULT_PAGE = 1;

	/** Default number of Resource rows per page. */
	const DEFAULT_PAGE_SIZE = 20;

	/** Maximum number of Resource rows per page. */
	const MAXIMUM_PAGE_SIZE = 50;

	/** Maximum explicit Resource selection stored for one user and site. */
	const MAXIMUM_SELECTED_RESOURCES = 500;

	/** Maximum stored expansion identifiers for either expansion collection. */
	const MAXIMUM_EXPANDED_RESOURCES = 500;

	/** @var int Current user ID. */
	private $user_id;

	/** @var callable|null Optional test-safe storage reader. */
	private $read_callback;

	/** @var callable|null Optional test-safe storage writer. */
	private $write_callback;

	/**
	 * Construct the preference service.
	 *
	 * When callbacks are omitted, WordPress site-scoped user-option APIs are
	 * used. Passing false as the fourth update_user_option() argument is
	 * intentional: preferences must be isolated per site on multisite.
	 *
	 * @param int|null      $user_id       Current user ID, or null to resolve it.
	 * @param callable|null $read_callback Optional callback receiving option key
	 *                                     and user ID, then returning stored data.
	 * @param callable|null $write_callback Optional callback receiving user ID,
	 *                                      option key, record, and global flag.
	 */
	public function __construct( $user_id = null, $read_callback = null, $write_callback = null ) {
		$this->user_id        = null === $user_id ? $this->resolve_current_user_id() : absint( $user_id );
		$this->read_callback  = is_callable( $read_callback ) ? $read_callback : null;
		$this->write_callback = is_callable( $write_callback ) ? $write_callback : null;
	}

	/**
	 * Return the normalized versioned preference record without writing it.
	 *
	 * @return array<string,mixed> Versioned Resource-view and toolbar record.
	 */
	public function get_record() {
		return $this->normalize_stored_record( $this->read_stored_record() );
	}

	/**
	 * Determine whether any historical or versioned record is stored.
	 *
	 * @return bool True when a non-empty record exists.
	 */
	public function has_stored_record() {
		return ! empty( $this->read_stored_record() );
	}

	/**
	 * Return one registered, presentation-neutral preference extension.
	 *
	 * Extensions share the existing current-user, current-site Timeline record
	 * so the primary Reset action can clear all Timeline presentation state in
	 * one write. Unknown, unregistered fields remain protected as future data.
	 *
	 * @param string $extension_key Registered extension key.
	 *
	 * @return array<string,mixed> Stored extension record, or an empty array.
	 */
	public function get_extension( $extension_key ) {
		$extension_key = sanitize_key( (string) $extension_key );
		if ( ! in_array( $extension_key, $this->get_registered_extension_keys(), true ) ) {
			return array();
		}

		$stored = $this->read_stored_record();

		return isset( $stored[ $extension_key ] ) && is_array( $stored[ $extension_key ] )
			? $stored[ $extension_key ]
			: array();
	}

	/**
	 * Persist one registered preference extension in the shared Timeline record.
	 *
	 * Passing an empty record removes the extension. The operation never accepts
	 * callbacks, objects, or arbitrary keys from a browser request; registration
	 * is exclusively server-owned through the documented filter.
	 *
	 * @param string              $extension_key Registered extension key.
	 * @param array<string,mixed> $extension_record Validated JSON-safe record.
	 *
	 * @return bool True when unchanged or stored successfully.
	 */
	public function save_extension( $extension_key, $extension_record ) {
		$extension_key = sanitize_key( (string) $extension_key );
		if (
			! in_array( $extension_key, $this->get_registered_extension_keys(), true )
			|| ! is_array( $extension_record )
		) {
			return false;
		}

		$record = $this->normalize_stored_record( $this->read_stored_record() );
		if ( empty( $extension_record ) ) {
			unset( $record[ $extension_key ] );
		} else {
			$record[ $extension_key ] = $extension_record;
		}

		return $this->write_record( $record );
	}

	/**
	 * Return the stable Resource sort values accepted by every server boundary.
	 *
	 * @return array<int,string> Allow-listed Resource sort values.
	 */
	public static function get_allowed_sort_orders() {
		return array(
			self::SORT_ORDER_STANDARD,
			self::SORT_ORDER_TITLE_ASC,
			self::SORT_ORDER_TITLE_DESC,
			self::SORT_ORDER_ID_ASC,
			self::SORT_ORDER_ID_DESC,
		);
	}

	/**
	 * Determine whether one Resource-view field was explicitly stored.
	 *
	 * This preserves the historical first-run expansion behavior while still
	 * distinguishing a deliberately stored empty expansion collection.
	 *
	 * @param string $field_name Allowed Resource-view field name.
	 *
	 * @return bool True when the field exists in legacy or versioned storage.
	 */
	public function has_stored_resource_view_field( $field_name ) {
		$allowed_fields = array( 'selection_mode', 'selected_resource_ids', 'sort_order', 'page', 'per_page', 'expanded_resource_ids', 'expanded_parent_ids' );
		$stored         = $this->read_stored_record();

		if ( ! in_array( $field_name, $allowed_fields, true ) ) {
			return false;
		}
		if ( isset( $stored['resource_view'] ) && is_array( $stored['resource_view'] ) ) {
			return array_key_exists( $field_name, $stored['resource_view'] );
		}

		return array_key_exists( $field_name, $stored );
	}

	/**
	 * Normalize versioned or legacy flat storage without persisting a migration.
	 *
	 * Missing state defaults to the server-side `all` expression. An explicitly
	 * empty legacy selection also becomes `all`, because zero effective active
	 * Resources is not a valid persisted state.
	 *
	 * @param mixed $stored_record Untrusted value read from user meta.
	 *
	 * @return array<string,mixed> Normalized schema-version 2 record.
	 */
	public function normalize_stored_record( $stored_record ) {
		$stored_record = is_array( $stored_record ) ? $stored_record : array();
		$is_versioned  = isset( $stored_record['schema_version'] )
			&& self::SCHEMA_VERSION === (int) $stored_record['schema_version']
			&& isset( $stored_record['resource_view'] )
			&& is_array( $stored_record['resource_view'] );
		$resource_view = $is_versioned ? $stored_record['resource_view'] : $stored_record;
		$toolbar       = $is_versioned && isset( $stored_record['toolbar'] ) && is_array( $stored_record['toolbar'] )
			? $stored_record['toolbar']
			: $stored_record;
		$selected_ids  = $this->normalize_identifier_list(
			isset( $resource_view['selected_resource_ids'] ) ? $resource_view['selected_resource_ids'] : array(),
			self::MAXIMUM_SELECTED_RESOURCES
		);
		$selection_mode = isset( $resource_view['selection_mode'] ) && is_scalar( $resource_view['selection_mode'] )
			? sanitize_key( (string) $resource_view['selection_mode'] )
			: ( ! empty( $selected_ids ) ? self::SELECTION_MODE_EXPLICIT : self::SELECTION_MODE_ALL );

		if ( self::SELECTION_MODE_EXPLICIT !== $selection_mode || empty( $selected_ids ) ) {
			$selection_mode = self::SELECTION_MODE_ALL;
			$selected_ids   = array();
		}

		$normalized_record = array(
			'schema_version' => self::SCHEMA_VERSION,
			'resource_view'  => array(
				'selection_mode'       => $selection_mode,
				'selected_resource_ids' => $selected_ids,
				'sort_order'            => $this->normalize_sort_order(
					isset( $resource_view['sort_order'] ) ? $resource_view['sort_order'] : self::SORT_ORDER_STANDARD
				),
				'page'                 => $this->normalize_positive_integer(
					isset( $resource_view['page'] ) ? $resource_view['page'] : self::DEFAULT_PAGE,
					self::DEFAULT_PAGE,
					PHP_INT_MAX
				),
				'per_page'             => $this->normalize_positive_integer(
					isset( $resource_view['per_page'] ) ? $resource_view['per_page'] : self::DEFAULT_PAGE_SIZE,
					self::DEFAULT_PAGE_SIZE,
					self::MAXIMUM_PAGE_SIZE
				),
				'expanded_resource_ids' => $this->normalize_identifier_list(
					isset( $resource_view['expanded_resource_ids'] ) ? $resource_view['expanded_resource_ids'] : array(),
					self::MAXIMUM_EXPANDED_RESOURCES
				),
				'expanded_parent_ids'  => $this->normalize_identifier_list(
					isset( $resource_view['expanded_parent_ids'] ) ? $resource_view['expanded_parent_ids'] : array(),
					self::MAXIMUM_EXPANDED_RESOURCES
				),
			),
			'toolbar'        => $this->normalize_stored_toolbar( $toolbar ),
		);
		foreach ( $this->get_registered_extension_keys() as $extension_key ) {
			if ( isset( $stored_record[ $extension_key ] ) && is_array( $stored_record[ $extension_key ] ) ) {
				$normalized_record[ $extension_key ] = $stored_record[ $extension_key ];
			}
		}

		return $normalized_record;
	}

	/**
	 * Validate one complete Resource-view draft against authorized identifiers.
	 *
	 * Authorization lists must come from the Resource domain repository. This
	 * service treats missing and inaccessible identifiers identically so error
	 * responses do not reveal whether another user's Resource exists.
	 *
	 * @param mixed          $candidate                 Untrusted Resource-view draft.
	 * @param array<int,int> $authorized_resource_ids   Complete authorized selectable IDs.
	 * @param array<int,int> $authorized_expandable_ids Authorized expandable IDs.
	 *
	 * @return array<string,mixed>|WP_Error Normalized draft or safe validation error.
	 */
	public function validate_resource_view( $candidate, $authorized_resource_ids, $authorized_expandable_ids = array() ) {
		if ( ! is_array( $candidate ) ) {
			return $this->error( 'wpbc_timeline_resource_view_invalid', __( 'The Timeline Resource view is invalid. Reload the page and try again.', 'booking' ), 400 );
		}

		$authorized_resource_ids   = $this->normalize_identifier_list( $authorized_resource_ids, PHP_INT_MAX );
		$authorized_expandable_ids = $this->normalize_identifier_list( $authorized_expandable_ids, self::MAXIMUM_EXPANDED_RESOURCES );
		$selection_mode            = isset( $candidate['selection_mode'] ) && is_scalar( $candidate['selection_mode'] )
			? sanitize_key( (string) $candidate['selection_mode'] )
			: '';

		if ( ! in_array( $selection_mode, array( self::SELECTION_MODE_ALL, self::SELECTION_MODE_EXPLICIT ), true ) ) {
			return $this->error( 'wpbc_timeline_resource_selection_mode_invalid', __( 'The Timeline Resource selection mode is invalid.', 'booking' ), 400 );
		}
		if ( empty( $authorized_resource_ids ) ) {
			return $this->error( 'wpbc_timeline_resource_selection_empty', __( 'At least one available booking Resource is required.', 'booking' ), 422 );
		}

		$selected_result = $this->validate_identifier_list(
			isset( $candidate['selected_resource_ids'] ) ? $candidate['selected_resource_ids'] : array(),
			self::MAXIMUM_SELECTED_RESOURCES,
			'wpbc_timeline_resource_selection_too_large'
		);
		if ( is_wp_error( $selected_result ) ) {
			return $selected_result;
		}
		if ( self::SELECTION_MODE_EXPLICIT === $selection_mode && empty( $selected_result ) ) {
			return $this->error( 'wpbc_timeline_resource_selection_empty', __( 'At least one available booking Resource is required.', 'booking' ), 422 );
		}
		if ( self::SELECTION_MODE_EXPLICIT === $selection_mode && array_diff( $selected_result, $authorized_resource_ids ) ) {
			return $this->error( 'wpbc_timeline_resource_selection_unavailable', __( 'One or more selected booking Resources are not available.', 'booking' ), 404 );
		}

		$sort_order = $this->validate_sort_order(
			isset( $candidate['sort_order'] ) ? $candidate['sort_order'] : self::SORT_ORDER_STANDARD
		);
		if ( is_wp_error( $sort_order ) ) {
			return $sort_order;
		}

		$page = $this->validate_positive_integer(
			isset( $candidate['page'] ) ? $candidate['page'] : self::DEFAULT_PAGE,
			PHP_INT_MAX,
			'wpbc_timeline_resource_page_invalid'
		);
		if ( is_wp_error( $page ) ) {
			return $page;
		}
		$per_page = $this->validate_positive_integer(
			isset( $candidate['per_page'] ) ? $candidate['per_page'] : self::DEFAULT_PAGE_SIZE,
			self::MAXIMUM_PAGE_SIZE,
			'wpbc_timeline_resource_page_size_invalid'
		);
		if ( is_wp_error( $per_page ) ) {
			return $per_page;
		}

		$expanded_resource_ids = $this->validate_identifier_list(
			isset( $candidate['expanded_resource_ids'] ) ? $candidate['expanded_resource_ids'] : array(),
			self::MAXIMUM_EXPANDED_RESOURCES,
			'wpbc_timeline_resource_expansion_too_large'
		);
		$expanded_parent_ids = $this->validate_identifier_list(
			isset( $candidate['expanded_parent_ids'] ) ? $candidate['expanded_parent_ids'] : array(),
			self::MAXIMUM_EXPANDED_RESOURCES,
			'wpbc_timeline_resource_expansion_too_large'
		);
		if ( is_wp_error( $expanded_resource_ids ) ) {
			return $expanded_resource_ids;
		}
		if ( is_wp_error( $expanded_parent_ids ) ) {
			return $expanded_parent_ids;
		}
		if ( array_diff( $expanded_resource_ids, $authorized_resource_ids ) || array_diff( $expanded_parent_ids, $authorized_expandable_ids ) ) {
			return $this->error( 'wpbc_timeline_resource_expansion_unavailable', __( 'One or more expanded booking Resources are not available.', 'booking' ), 404 );
		}

		return array(
			'selection_mode'       => $selection_mode,
			'selected_resource_ids' => self::SELECTION_MODE_EXPLICIT === $selection_mode ? $selected_result : array(),
			'sort_order'            => $sort_order,
			'page'                 => $page,
			'per_page'             => $per_page,
			'expanded_resource_ids' => $expanded_resource_ids,
			'expanded_parent_ids'  => $expanded_parent_ids,
		);
	}

	/**
	 * Validate and store one Resource-view draft.
	 *
	 * @param mixed          $candidate                 Untrusted Resource-view draft.
	 * @param array<int,int> $authorized_resource_ids   Complete authorized selectable IDs.
	 * @param array<int,int> $authorized_expandable_ids Authorized expandable IDs.
	 *
	 * @return array<string,mixed>|WP_Error Saved view or safe error.
	 */
	public function save_resource_view( $candidate, $authorized_resource_ids, $authorized_expandable_ids = array() ) {
		$validated = $this->validate_resource_view( $candidate, $authorized_resource_ids, $authorized_expandable_ids );
		if ( is_wp_error( $validated ) ) {
			return $validated;
		}

		$record                  = $this->get_record();
		$record['resource_view'] = $validated;
		if ( ! $this->write_record( $record ) ) {
			return $this->error( 'wpbc_timeline_resource_view_not_saved', __( 'The Timeline Resource view could not be saved.', 'booking' ), 500 );
		}

		return $validated;
	}

	/**
	 * Strictly extract identifier collections needed for authorization.
	 *
	 * This method does not authorize an identifier. It exists so the Resource
	 * domain service can reject malformed values before performing an exact,
	 * ownership-scoped repository read.
	 *
	 * @param mixed $candidate Untrusted Resource-view draft.
	 *
	 * @return array<string,array<int,int>>|WP_Error Strict identifier lists or a safe error.
	 */
	public function validate_candidate_identifier_lists( $candidate ) {
		if ( ! is_array( $candidate ) ) {
			return $this->error( 'wpbc_timeline_resource_view_invalid', __( 'The Timeline Resource view is invalid. Reload the page and try again.', 'booking' ), 400 );
		}

		$selected_resource_ids = $this->validate_identifier_list(
			isset( $candidate['selected_resource_ids'] ) ? $candidate['selected_resource_ids'] : array(),
			self::MAXIMUM_SELECTED_RESOURCES,
			'wpbc_timeline_resource_selection_too_large'
		);
		$expanded_resource_ids = $this->validate_identifier_list(
			isset( $candidate['expanded_resource_ids'] ) ? $candidate['expanded_resource_ids'] : array(),
			self::MAXIMUM_EXPANDED_RESOURCES,
			'wpbc_timeline_resource_expansion_too_large'
		);
		$expanded_parent_ids = $this->validate_identifier_list(
			isset( $candidate['expanded_parent_ids'] ) ? $candidate['expanded_parent_ids'] : array(),
			self::MAXIMUM_EXPANDED_RESOURCES,
			'wpbc_timeline_resource_expansion_too_large'
		);

		foreach ( array( $selected_resource_ids, $expanded_resource_ids, $expanded_parent_ids ) as $identifier_result ) {
			if ( is_wp_error( $identifier_result ) ) {
				return $identifier_result;
			}
		}

		return array(
			'selected_resource_ids' => $selected_resource_ids,
			'expanded_resource_ids' => $expanded_resource_ids,
			'expanded_parent_ids'   => $expanded_parent_ids,
		);
	}

	/**
	 * Store validated legacy toolbar fields inside the versioned record.
	 *
	 * @param array<string,mixed> $toolbar_fields Already validated toolbar fields.
	 *
	 * @return bool True when the record is unchanged or stored successfully.
	 */
	public function save_toolbar( $toolbar_fields ) {
		$stored         = $this->read_stored_record();
		$toolbar_fields = is_array( $toolbar_fields ) ? $toolbar_fields : array();
		if ( $this->has_unsupported_future_schema( $stored ) ) {
			return false;
		}
		if ( $this->is_versioned_record( $stored ) ) {
			$record            = $this->normalize_stored_record( $stored );
			$record['toolbar'] = $toolbar_fields;

			return $this->write_record( $record );
		}

		$updated = $stored;
		foreach ( $this->get_toolbar_field_names() as $toolbar_field ) {
			unset( $updated[ $toolbar_field ] );
		}
		$updated = array_merge( $updated, $toolbar_fields );

		return $this->write_raw_record( $updated, $stored );
	}

	/**
	 * Remove toolbar fields while retaining Resource-view and unknown data.
	 *
	 * @return bool True when the record is unchanged or stored successfully.
	 */
	public function reset_toolbar() {
		if ( ! $this->has_stored_record() ) {
			return true;
		}
		$stored = $this->read_stored_record();
		if ( $this->has_unsupported_future_schema( $stored ) ) {
			return false;
		}
		if ( $this->is_versioned_record( $stored ) ) {
			$record            = $this->normalize_stored_record( $stored );
			$record['toolbar'] = array();

			return $this->write_record( $record );
		}

		$updated = $stored;
		foreach ( $this->get_toolbar_field_names() as $toolbar_field ) {
			unset( $updated[ $toolbar_field ] );
		}

		return $this->write_raw_record( $updated, $stored );
	}

	/**
	 * Reset toolbar and Resource-view state in one site-scoped user-option write.
	 *
	 * Unknown future fields remain intact, while every field owned by the
	 * current Timeline display contract returns to its server default.
	 *
	 * @return bool True when the record is unchanged or stored successfully.
	 */
	public function reset_all() {
		$stored = $this->read_stored_record();
		if ( $this->has_unsupported_future_schema( $stored ) ) {
			return false;
		}

		$record                  = $this->normalize_stored_record( array() );
		$record['resource_view'] = $this->get_default_resource_view();
		$record['toolbar']       = array();

		return $this->write_record( $record );
	}

	/**
	 * Read raw storage through the injected or WordPress implementation.
	 *
	 * @return array<string,mixed> Raw stored record.
	 */
	private function read_stored_record() {
		if ( ! $this->user_id ) {
			return array();
		}
		$stored = $this->read_callback
			? call_user_func( $this->read_callback, self::USER_OPTION_KEY, $this->user_id )
			: get_user_option( self::USER_OPTION_KEY, $this->user_id );

		return is_array( $stored ) ? $stored : array();
	}

	/**
	 * Persist one versioned record while preserving unknown future fields.
	 *
	 * @param array<string,mixed> $record Normalized owned record fields.
	 *
	 * @return bool True when unchanged or stored.
	 */
	private function write_record( $record ) {
		if ( ! $this->user_id ) {
			return false;
		}

		$stored      = $this->read_stored_record();
		if ( $this->has_unsupported_future_schema( $stored ) ) {
			return false;
		}
		$owned_keys  = array_merge( array(
			'schema_version', 'resource_view', 'toolbar', 'selection_mode', 'selected_resource_ids',
			'sort_order', 'page', 'per_page', 'expanded_resource_ids', 'expanded_parent_ids', 'anchor_date',
			'anchor_ratio', 'window_days', 'window_months', 'view', 'visual_zoom_percent',
		), $this->get_registered_extension_keys() );
		$unknown     = array_diff_key( $stored, array_fill_keys( $owned_keys, true ) );
		$stored_resource_view = isset( $stored['resource_view'] ) && is_array( $stored['resource_view'] )
			? $stored['resource_view']
			: array();
		$resource_view_keys = array( 'selection_mode', 'selected_resource_ids', 'sort_order', 'page', 'per_page', 'expanded_resource_ids', 'expanded_parent_ids' );
		$unknown_resource_view = array_diff_key( $stored_resource_view, array_fill_keys( $resource_view_keys, true ) );
		$record['resource_view'] = array_merge( $unknown_resource_view, $record['resource_view'] );
		$stored_toolbar = isset( $stored['toolbar'] ) && is_array( $stored['toolbar'] ) ? $stored['toolbar'] : array();
		$unknown_toolbar = array_diff_key( $stored_toolbar, array_fill_keys( $this->get_toolbar_field_names(), true ) );
		$record['toolbar'] = array_merge( $unknown_toolbar, $record['toolbar'] );
		$updated     = array_merge( $unknown, $record );

		return $this->write_raw_record( $updated, $stored );
	}

	/**
	 * Persist one raw record through injected or WordPress site-scoped storage.
	 *
	 * @param array<string,mixed> $updated Updated record.
	 * @param array<string,mixed> $stored  Previously stored record.
	 *
	 * @return bool True when unchanged or stored.
	 */
	private function write_raw_record( $updated, $stored ) {
		if ( ! $this->user_id ) {
			return false;
		}
		if ( $updated === $stored ) {
			return true;
		}
		if ( $this->write_callback ) {
			return false !== call_user_func( $this->write_callback, $this->user_id, self::USER_OPTION_KEY, $updated, false );
		}

		return false !== update_user_option( $this->user_id, self::USER_OPTION_KEY, $updated, false );
	}

	/**
	 * Normalize toolbar-owned fields from stored data without validating a save.
	 *
	 * @param array<string,mixed> $stored_toolbar Stored toolbar candidate.
	 *
	 * @return array<string,mixed> Present toolbar fields only.
	 */
	private function normalize_stored_toolbar( $stored_toolbar ) {
		$normalized     = array();
		$toolbar_fields = $this->get_toolbar_field_names();

		foreach ( $toolbar_fields as $toolbar_field ) {
			if ( array_key_exists( $toolbar_field, $stored_toolbar ) ) {
				$normalized[ $toolbar_field ] = $stored_toolbar[ $toolbar_field ];
			}
		}

		return $normalized;
	}

	/**
	 * Return the fixed toolbar-owned legacy and versioned field names.
	 *
	 * @return array<int,string> Toolbar field names.
	 */
	private function get_toolbar_field_names() {
		return array( 'anchor_date', 'anchor_ratio', 'window_days', 'window_months', 'view', 'visual_zoom_percent' );
	}

	/**
	 * Return server-registered top-level preference extension keys.
	 *
	 * Shared storage understands only key ownership. Each registering module
	 * remains responsible for authorization, validation, normalization, and the
	 * contents of its extension record.
	 *
	 * @return array<int,string> Unique allow-listed extension keys.
	 */
	private function get_registered_extension_keys() {
		/**
		 * Filters domain-owned extensions stored in the Timeline preference record.
		 *
		 * @since 12.0.0
		 *
		 * @param array<int,string> $extension_keys Registered top-level keys.
		 */
		$extension_keys = apply_filters( 'wpbc_timeline_preference_extension_keys', array() );
		$normalized     = array();

		foreach ( is_array( $extension_keys ) ? $extension_keys : array() as $extension_key ) {
			$extension_key = is_scalar( $extension_key ) ? sanitize_key( (string) $extension_key ) : '';
			if ( '' !== $extension_key && preg_match( '/^[a-z][a-z0-9_]{0,63}$/', $extension_key ) ) {
				$normalized[ $extension_key ] = $extension_key;
			}
		}

		return array_values( $normalized );
	}

	/**
	 * Return the canonical first-run Resource-view state.
	 *
	 * @return array<string,mixed> Default Resource-view subrecord.
	 */
	private function get_default_resource_view() {
		return array(
			'selection_mode'        => self::SELECTION_MODE_ALL,
			'selected_resource_ids' => array(),
			'sort_order'            => self::SORT_ORDER_STANDARD,
			'page'                  => self::DEFAULT_PAGE,
			'per_page'              => self::DEFAULT_PAGE_SIZE,
			'expanded_resource_ids' => array(),
			'expanded_parent_ids'   => array(),
		);
	}

	/**
	 * Normalize one stored Resource sort to the stable default.
	 *
	 * @param mixed $candidate Stored sort value.
	 *
	 * @return string Allowed Resource sort value.
	 */
	private function normalize_sort_order( $candidate ) {
		$candidate = is_scalar( $candidate ) ? sanitize_key( (string) $candidate ) : '';

		return in_array( $candidate, self::get_allowed_sort_orders(), true )
			? $candidate
			: self::SORT_ORDER_STANDARD;
	}

	/**
	 * Strictly validate one Resource sort submitted by the browser.
	 *
	 * @param mixed $candidate Untrusted sort value.
	 *
	 * @return string|WP_Error Allowed Resource sort or safe validation error.
	 */
	private function validate_sort_order( $candidate ) {
		if ( ! is_scalar( $candidate ) ) {
			return $this->error( 'wpbc_timeline_resource_sort_invalid', __( 'The booking Resource sort order is invalid.', 'booking' ), 400 );
		}

		$candidate = sanitize_key( (string) $candidate );
		if ( ! in_array( $candidate, self::get_allowed_sort_orders(), true ) ) {
			return $this->error( 'wpbc_timeline_resource_sort_invalid', __( 'The booking Resource sort order is invalid.', 'booking' ), 400 );
		}

		return $candidate;
	}

	/**
	 * Determine whether a stored record uses the complete version-2 shape.
	 *
	 * @param array<string,mixed> $stored Stored record.
	 *
	 * @return bool True for version-2 storage.
	 */
	private function is_versioned_record( $stored ) {
		return isset( $stored['schema_version'], $stored['resource_view'] )
			&& self::SCHEMA_VERSION === (int) $stored['schema_version']
			&& is_array( $stored['resource_view'] );
	}

	/**
	 * Detect storage written by a newer contract that this service must not alter.
	 *
	 * @param array<string,mixed> $stored Stored record.
	 *
	 * @return bool True when the stored schema is newer than this service.
	 */
	private function has_unsupported_future_schema( $stored ) {
		return isset( $stored['schema_version'] )
			&& is_scalar( $stored['schema_version'] )
			&& self::SCHEMA_VERSION < (int) $stored['schema_version'];
	}

	/**
	 * Strictly validate a bounded identifier list.
	 *
	 * @param mixed  $candidate  Untrusted list.
	 * @param int    $maximum    Maximum entries.
	 * @param string $error_code Safe too-large error code.
	 *
	 * @return array<int,int>|WP_Error Ordered unique IDs or safe error.
	 */
	private function validate_identifier_list( $candidate, $maximum, $error_code ) {
		if ( ! is_array( $candidate ) ) {
			return $this->error( 'wpbc_timeline_resource_ids_invalid', __( 'The booking Resource identifiers are invalid.', 'booking' ), 400 );
		}
		if ( count( $candidate ) > $maximum ) {
			return $this->error( $error_code, __( 'Too many booking Resources were submitted.', 'booking' ), 400 );
		}

		$normalized = array();
		$seen       = array();
		foreach ( $candidate as $resource_id ) {
			if ( ! $this->is_positive_integer_scalar( $resource_id ) ) {
				return $this->error( 'wpbc_timeline_resource_ids_invalid', __( 'The booking Resource identifiers are invalid.', 'booking' ), 400 );
			}
			$resource_id = (int) $resource_id;
			if ( ! isset( $seen[ $resource_id ] ) ) {
				$normalized[] = $resource_id;
				$seen[ $resource_id ] = true;
			}
		}

		return $normalized;
	}

	/**
	 * Leniently normalize trusted storage identifiers.
	 *
	 * @param mixed $candidate Stored list.
	 * @param int   $maximum   Maximum retained entries.
	 *
	 * @return array<int,int> Ordered unique positive IDs.
	 */
	private function normalize_identifier_list( $candidate, $maximum ) {
		if ( ! is_array( $candidate ) ) {
			return array();
		}

		$normalized = array();
		$seen       = array();
		foreach ( $candidate as $resource_id ) {
			if ( ! $this->is_positive_integer_scalar( $resource_id ) ) {
				continue;
			}
			$resource_id = (int) $resource_id;
			if ( ! isset( $seen[ $resource_id ] ) ) {
				$normalized[] = $resource_id;
				$seen[ $resource_id ] = true;
			}
			if ( count( $normalized ) >= $maximum ) {
				break;
			}
		}

		return $normalized;
	}

	/**
	 * Strictly validate one positive integer.
	 *
	 * @param mixed  $candidate  Untrusted integer.
	 * @param int    $maximum    Maximum accepted value.
	 * @param string $error_code Safe error code.
	 *
	 * @return int|WP_Error Positive integer or safe error.
	 */
	private function validate_positive_integer( $candidate, $maximum, $error_code ) {
		if ( ! $this->is_positive_integer_scalar( $candidate ) || (int) $candidate > $maximum ) {
			return $this->error( $error_code, __( 'The Timeline Resource paging value is invalid.', 'booking' ), 400 );
		}

		return (int) $candidate;
	}

	/**
	 * Normalize one stored positive integer to a safe default.
	 *
	 * @param mixed $candidate Stored integer.
	 * @param int   $default   Default value.
	 * @param int   $maximum   Maximum accepted value.
	 *
	 * @return int Normalized value.
	 */
	private function normalize_positive_integer( $candidate, $default, $maximum ) {
		return $this->is_positive_integer_scalar( $candidate ) && (int) $candidate <= $maximum
			? (int) $candidate
			: $default;
	}

	/**
	 * Determine whether a scalar is a lossless positive platform integer.
	 *
	 * @param mixed $candidate Untrusted scalar.
	 *
	 * @return bool True for a canonical positive integer representation.
	 */
	private function is_positive_integer_scalar( $candidate ) {
		if ( ! is_scalar( $candidate ) || ! preg_match( '/^[1-9]\d*$/', (string) $candidate ) ) {
			return false;
		}

		return (string) (int) $candidate === (string) $candidate;
	}

	/**
	 * Resolve the current Booking Calendar user ID.
	 *
	 * @return int Current user ID or zero.
	 */
	private function resolve_current_user_id() {
		return function_exists( 'wpbc_get_current_user_id' ) ? absint( wpbc_get_current_user_id() ) : absint( get_current_user_id() );
	}

	/**
	 * Build one safe validation error.
	 *
	 * @param string $code    Stable machine-readable code.
	 * @param string $message Safe translated message.
	 * @param int    $status  HTTP status for a future endpoint.
	 *
	 * @return WP_Error Safe error.
	 */
	private function error( $code, $message, $status ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}
}
