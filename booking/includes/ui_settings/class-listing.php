<?php
/**
 * Shared AJAX-ready administration listing shell.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render a reusable catalog table and persist its per-user page-size preference.
 *
 * The class deliberately does not fetch records or render rows. Each catalog
 * keeps its own repository, authorization rules, filters, and JavaScript row
 * renderer while reusing one accessible table and pagination structure.
 */
class WPBC_UI_Listing {

	/** User option containing preferences for every registered listing. */
	const USER_OPTION_NAME = 'wpbc_admin_listing_preferences';

	/** @var string Sanitized identifier used for HTML IDs and preference storage. */
	private $listing_id;

	/** @var array<string,mixed> Normalized listing settings. */
	private $settings;

	/**
	 * Create one reusable listing definition.
	 *
	 * @param string              $listing_id Stable listing identifier, such as services_catalog.
	 * @param array<string,mixed> $settings   Columns, labels, CSS classes, and page-size settings.
	 */
	public function __construct( $listing_id, $settings = array() ) {
		$this->listing_id = sanitize_key( $listing_id );

		if ( '' === $this->listing_id ) {
			$this->listing_id = 'catalog';
		}

		/**
		 * Filter the settings of any shared Booking Calendar administration listing.
		 *
		 * @param array<string,mixed> $settings   Listing settings supplied by its page.
		 * @param string              $listing_id Sanitized listing identifier.
		 */
		$settings = apply_filters( 'wpbc_ui_listing_settings', $settings, $this->listing_id );

		/**
		 * Filter the settings of one identified Booking Calendar administration listing.
		 *
		 * @param array<string,mixed> $settings Listing settings supplied by its page.
		 */
		$settings = apply_filters( 'wpbc_ui_listing_' . $this->listing_id . '_settings', $settings );

		$this->settings = $this->normalize_settings( $settings );
	}

	/**
	 * Enqueue the shared listing layout stylesheet.
	 *
	 * Pages should call this method from their normal Booking Calendar admin CSS
	 * enqueue hook. Calling it more than once is safe because WordPress de-duplicates
	 * the registered handle.
	 *
	 * @return void
	 */
	public static function enqueue_styles() {
		wp_enqueue_style(
			'wpbc-ui-listing',
			trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/wpbc_ui_listing.css',
			array( 'wpbc-all-admin' ),
			WP_BK_VERSION_NUM
		);
	}

	/**
	 * Return the stable identifier for this listing.
	 *
	 * @return string Sanitized listing identifier.
	 */
	public function get_listing_id() {
		return $this->listing_id;
	}

	/**
	 * Return one normalized listing setting.
	 *
	 * @param string $setting_name Setting key.
	 * @param mixed  $default      Fallback returned when the setting is absent.
	 *
	 * @return mixed Configured value or the supplied fallback.
	 */
	public function get_setting( $setting_name, $default = null ) {
		return array_key_exists( $setting_name, $this->settings ) ? $this->settings[ $setting_name ] : $default;
	}

	/**
	 * Return the allowed item counts for this listing.
	 *
	 * @return array<int,int> Positive page sizes in ascending order.
	 */
	public function get_items_per_page_options() {
		$options = $this->settings['items_per_page_options'];

		/**
		 * Filter allowed page sizes for one shared administration listing.
		 *
		 * @param array<int,int> $options    Allowed page sizes.
		 * @param string         $listing_id Listing identifier.
		 */
		$options = apply_filters( 'wpbc_ui_listing_items_per_page_options', $options, $this->listing_id );
		$options = array_values( array_unique( array_filter( array_map( 'absint', (array) $options ) ) ) );
		sort( $options, SORT_NUMERIC );

		if ( empty( $options ) ) {
			$options = array( 5, 10, 50, 100 );
		}
		if ( ! in_array( $this->settings['items_per_page_default'], $options, true ) ) {
			$options[] = $this->settings['items_per_page_default'];
			sort( $options, SORT_NUMERIC );
		}

		return $options;
	}

	/**
	 * Resolve the current user's saved page size for this listing.
	 *
	 * WordPress user options are used instead of a global plugin option so each
	 * administrator, including users on multisite, keeps an independent choice.
	 *
	 * @param int $user_id Optional WordPress user ID. Defaults to the current user.
	 *
	 * @return int Allowed number of items per page.
	 */
	public function get_items_per_page( $user_id = 0 ) {
		$user_id     = $this->resolve_user_id( $user_id );
		$preferences = $this->get_user_preferences( $user_id );
		$page_size   = $this->settings['items_per_page_default'];

		if (
			isset( $preferences[ $this->listing_id ] )
			&& is_array( $preferences[ $this->listing_id ] )
			&& isset( $preferences[ $this->listing_id ]['items_per_page'] )
		) {
			$page_size = absint( $preferences[ $this->listing_id ]['items_per_page'] );
		}

		$page_size = $this->normalize_items_per_page( $page_size );

		/**
		 * Filter the resolved page size without changing the stored preference.
		 *
		 * @param int    $page_size  Resolved allowed page size.
		 * @param string $listing_id Listing identifier.
		 * @param int    $user_id    WordPress user ID.
		 */
		$page_size = absint( apply_filters( 'wpbc_ui_listing_items_per_page', $page_size, $this->listing_id, $user_id ) );

		return $this->normalize_items_per_page( $page_size );
	}

	/**
	 * Save an allowed page size for one user and listing.
	 *
	 * Authorization and nonce checks belong to the catalog endpoint calling this
	 * method. Invalid values never enter user metadata and resolve to the current
	 * saved/default value.
	 *
	 * @param mixed $requested_page_size Requested page size from a validated request.
	 * @param int   $user_id             Optional WordPress user ID. Defaults to current user.
	 *
	 * @return int Effective saved or existing page size.
	 */
	public function save_items_per_page( $requested_page_size, $user_id = 0 ) {
		$user_id = $this->resolve_user_id( $user_id );
		if ( ! is_scalar( $requested_page_size ) ) {
			return $this->get_items_per_page( $user_id );
		}

		$requested_page_size = absint( $requested_page_size );

		if ( ! $user_id || ! in_array( $requested_page_size, $this->get_items_per_page_options(), true ) ) {
			return $this->get_items_per_page( $user_id );
		}

		$preferences = $this->get_user_preferences( $user_id );

		if ( ! isset( $preferences[ $this->listing_id ] ) || ! is_array( $preferences[ $this->listing_id ] ) ) {
			$preferences[ $this->listing_id ] = array();
		}

		$preferences[ $this->listing_id ]['items_per_page'] = $requested_page_size;
		update_user_option( $user_id, self::USER_OPTION_NAME, $preferences, false );

		return $this->get_items_per_page( $user_id );
	}

	/**
	 * Return safe values needed by an AJAX listing client.
	 *
	 * @return array<string,mixed> Listing ID, current page size, and allowed sizes.
	 */
	public function get_client_settings() {
		$sorting = $this->get_sorting_request();

		return array(
			'listing_id'             => $this->listing_id,
			'items_per_page'         => $this->get_items_per_page(),
			'items_per_page_options' => $this->get_items_per_page_options(),
			'sort_by'                => $sorting['sort_by'],
			'sort_order'             => $sorting['sort_order'],
			'sortable_columns'       => $this->get_sortable_columns(),
		);
	}

	/**
	 * Normalize a requested sorting column and direction.
	 *
	 * Only sort keys declared by the listing columns are accepted. Repositories
	 * must still map these public keys to fixed SQL expressions rather than place
	 * request values directly into an ORDER BY clause.
	 *
	 * @param mixed $requested_sort_by    Requested public sort key.
	 * @param mixed $requested_sort_order Requested `asc` or `desc` direction.
	 *
	 * @return array{sort_by:string,sort_order:string} Safe sorting request.
	 */
	public function get_sorting_request( $requested_sort_by = null, $requested_sort_order = null ) {
		$sortable_columns = $this->get_sortable_columns();
		$default_sort_by  = sanitize_key( $this->settings['sort_by'] );
		$default_order    = 'desc' === $this->settings['sort_order'] ? 'desc' : 'asc';

		if ( ! in_array( $default_sort_by, $sortable_columns, true ) ) {
			$default_sort_by = $sortable_columns ? reset( $sortable_columns ) : '';
		}

		$sort_by = is_scalar( $requested_sort_by ) ? sanitize_key( $requested_sort_by ) : '';
		if ( ! in_array( $sort_by, $sortable_columns, true ) ) {
			$sort_by = $default_sort_by;
		}

		$sort_order = is_scalar( $requested_sort_order ) ? strtolower( sanitize_key( $requested_sort_order ) ) : '';
		if ( ! in_array( $sort_order, array( 'asc', 'desc' ), true ) ) {
			$sort_order = $default_order;
		}

		return array(
			'sort_by'    => $sort_by,
			'sort_order' => $sort_order,
		);
	}

	/**
	 * Normalize a requested page and page size before a catalog count query.
	 *
	 * This request contract is independent of any repository. A catalog may use
	 * the returned limit and offset directly when it already knows the requested
	 * page is valid, or pass the values to get_pagination_data() after counting
	 * matching records so an out-of-range page can be clamped safely.
	 *
	 * @param mixed $requested_page_number Requested one-based page number.
	 * @param mixed $requested_page_size   Requested page size, or null for the saved user preference.
	 *
	 * @return array<string,int> Page number, items per page, and SQL boundaries.
	 */
	public function get_pagination_request( $requested_page_number = 1, $requested_page_size = null ) {
		$page_number = is_scalar( $requested_page_number ) ? max( 1, absint( $requested_page_number ) ) : 1;
		$page_size   = null === $requested_page_size
			? $this->get_items_per_page()
			: $this->normalize_items_per_page( $requested_page_size, $this->get_items_per_page() );

		return array(
			'page_number'    => $page_number,
			'items_per_page' => $page_size,
			'limit'          => $page_size,
			'offset'         => ( $page_number - 1 ) * $page_size,
		);
	}

	/**
	 * Build server-authoritative pagination metadata after counting matching rows.
	 *
	 * The requested page is clamped to the last real page. This prevents an empty
	 * catalog after deleting the final row on the final page and supplies a stable
	 * response contract that Services, Resources, Events, and extensions can share.
	 *
	 * @param mixed $total_items           Total records matching the active filters.
	 * @param mixed $requested_page_number Requested one-based page number.
	 * @param mixed $requested_page_size   Requested page size, or null for the saved user preference.
	 *
	 * @return array<string,int> Complete pagination metadata including SQL limit and offset.
	 */
	public function get_pagination_data( $total_items, $requested_page_number = 1, $requested_page_size = null ) {
		$total_items = is_scalar( $total_items ) ? absint( $total_items ) : 0;
		$pagination  = $this->get_pagination_request( $requested_page_number, $requested_page_size );
		$total_pages = $total_items > 0 ? (int) ceil( $total_items / $pagination['items_per_page'] ) : 0;
		$page_number = $total_pages > 0 ? min( $pagination['page_number'], $total_pages ) : 1;
		$offset      = ( $page_number - 1 ) * $pagination['items_per_page'];

		$pagination['page_number'] = $page_number;
		$pagination['limit']       = $pagination['items_per_page'];
		$pagination['total_items'] = $total_items;
		$pagination['total_pages'] = $total_pages;
		$pagination['offset']      = $offset;
		$pagination['items_from']  = $total_items > 0 ? $offset + 1 : 0;
		$pagination['items_to']    = $total_items > 0 ? min( $total_items, $offset + $pagination['items_per_page'] ) : 0;

		/**
		 * Filter server-authoritative pagination metadata for a shared listing.
		 *
		 * @param array<string,int> $pagination Pagination response and SQL boundaries.
		 * @param string            $listing_id Listing identifier.
		 */
		return (array) apply_filters( 'wpbc_ui_listing_pagination_data', $pagination, $this->listing_id );
	}

	/**
	 * Render the shared table shell and footer controls.
	 *
	 * AJAX clients may populate the empty tbody and update elements through the
	 * stable data-wpbc-listing-* attributes. An optional body callback can render
	 * server-side rows without changing the surrounding component.
	 *
	 * @return void
	 */
	public function render() {
		$classes = $this->settings['classes'];
		?>
		<div id="<?php echo esc_attr( 'wpbc_ui_listing_' . $this->listing_id ); ?>"
			class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing', $classes['container'] ) ); ?>"
			data-wpbc-listing="<?php echo esc_attr( $this->listing_id ); ?>"
			data-wpbc-listing-items-per-page="<?php echo esc_attr( $this->get_items_per_page() ); ?>">
			<div class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__table_wrap', $classes['table_wrap'] ) ); ?>">
				<table class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__table', $classes['table'] ) ); ?>"<?php
				if ( '' !== $this->settings['aria_label'] ) {
					echo ' aria-label="' . esc_attr( $this->settings['aria_label'] ) . '"';
				}
				?>>
					<thead><tr><?php $this->render_header_cells(); ?></tr></thead>
					<tbody data-wpbc-listing-body="<?php echo esc_attr( $this->listing_id ); ?>"><?php
					if ( is_callable( $this->settings['body_callback'] ) ) {
						call_user_func( $this->settings['body_callback'], $this );
					}
					?></tbody>
				</table>
			</div>
			<?php $this->render_footer(); ?>
		</div>
		<?php
	}

	/**
	 * Render configured table header cells.
	 *
	 * Header callbacks are trusted internal renderers and must escape their own
	 * dynamic output. Plain labels are escaped automatically.
	 *
	 * @return void
	 */
	private function render_header_cells() {
		$current_sorting = $this->get_sorting_request();

		foreach ( $this->settings['columns'] as $column ) {
			$column_classes = $this->combine_classes( 'wpbc_ui_listing__column', $column['class'] );
			$is_sorted      = '' !== $column['sortable'] && $column['sortable'] === $current_sorting['sort_by'];
			$aria_sort      = $is_sorted ? ( 'desc' === $current_sorting['sort_order'] ? 'descending' : 'ascending' ) : 'none';
			?>
			<th scope="col" class="<?php echo esc_attr( $column_classes ); ?>" data-wpbc-listing-column="<?php echo esc_attr( $column['id'] ); ?>"<?php
			if ( '' !== $column['sortable'] ) {
				echo ' aria-sort="' . esc_attr( $aria_sort ) . '"';
			}
			?>><?php
			if ( is_callable( $column['header_callback'] ) ) {
				call_user_func( $column['header_callback'], $column, $this );
			} elseif ( '' !== $column['sortable'] ) {
				$this->render_sortable_header( $column, $is_sorted, $current_sorting['sort_order'] );
			} else {
				echo esc_html( $column['label'] );
			}
			?></th>
			<?php
		}
	}

	/**
	 * Render one accessible AJAX sorting link.
	 *
	 * @param array<string,mixed> $column     Normalized column configuration.
	 * @param bool                $is_sorted  Whether this column owns the current ordering.
	 * @param string              $sort_order Current normalized ordering direction.
	 *
	 * @return void
	 */
	private function render_sortable_header( $column, $is_sorted, $sort_order ) {
		$link_classes = $is_sorted ? 'wpbc_ui_listing__sort_link is-active' : 'wpbc_ui_listing__sort_link';
		$icon_class   = 'wpbc_icn_import_export';
		if ( $is_sorted ) {
			$icon_class = 'desc' === $sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up';
		}
		?>
		<a href="#"
			class="<?php echo esc_attr( $link_classes ); ?>"
			data-wpbc-listing-sort="<?php echo esc_attr( $this->listing_id ); ?>"
			data-wpbc-listing-sort-key="<?php echo esc_attr( $column['sortable'] ); ?>">
			<span><?php echo esc_html( $column['label'] ); ?></span>
			<i class="wpbc_ui_listing__sort_icon <?php echo esc_attr( $icon_class ); ?>" aria-hidden="true"></i>
		</a>
		<?php
	}

	/**
	 * Render result count, items-per-page choice, and page navigation.
	 *
	 * @return void
	 */
	private function render_footer() {
		$classes        = $this->settings['classes'];
		$select_id      = 'wpbc_ui_listing_' . $this->listing_id . '_items_per_page';
		$page_input_id  = 'wpbc_ui_listing_' . $this->listing_id . '_page_number';
		$page_size      = $this->get_items_per_page();
		$page_size_list = $this->get_items_per_page_options();
		?>
		<div class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__footer', $classes['footer'] ) ); ?>"
			data-wpbc-listing-footer="<?php echo esc_attr( $this->listing_id ); ?>" hidden>
			<span class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__result_count', $classes['result_count'] ) ); ?>"
				data-wpbc-listing-result-count aria-live="polite"></span>
			<div class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__footer_controls', $classes['footer_controls'] ) ); ?>">
				<div class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__items_per_page', $classes['items_per_page'] ) ); ?>">
					<label for="<?php echo esc_attr( $select_id ); ?>"><?php echo esc_html( $this->settings['items_per_page_label'] ); ?></label>
					<select id="<?php echo esc_attr( $select_id ); ?>"
						data-wpbc-listing-items-per-page-control="<?php echo esc_attr( $this->listing_id ); ?>"
						autocomplete="off"><?php
					foreach ( $page_size_list as $allowed_page_size ) {
						?><option value="<?php echo esc_attr( $allowed_page_size ); ?>" <?php selected( $page_size, $allowed_page_size ); ?>><?php echo esc_html( $allowed_page_size ); ?></option><?php
					}
					?></select>
					<span><?php echo esc_html( $this->settings['items_per_page_suffix'] ); ?></span>
				</div>
				<div class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__pagination', $classes['pagination'] ) ); ?>">
					<button type="button"
						class="<?php echo esc_attr( $this->combine_classes( 'button wpbc_ui_listing__page_previous', $classes['previous'] ) ); ?>"
						data-wpbc-listing-page-previous="<?php echo esc_attr( $this->listing_id ); ?>"
						aria-label="<?php echo esc_attr( $this->settings['previous_page_label'] ); ?>">
						<span class="wpbc-bi-chevron-left" aria-hidden="true"></span>
					</button>
					<div class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__page_label', $classes['page_label'] ) ); ?>">
						<label class="screen-reader-text" for="<?php echo esc_attr( $page_input_id ); ?>"><?php echo esc_html( $this->settings['page_number_label'] ); ?></label>
						<input id="<?php echo esc_attr( $page_input_id ); ?>"
							type="number"
							class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__page_number', $classes['page_number'] ) ); ?>"
							data-wpbc-listing-page-number-control="<?php echo esc_attr( $this->listing_id ); ?>"
							min="1" max="1" step="1" value="1" inputmode="numeric">
						<span aria-hidden="true">/</span>
						<span class="<?php echo esc_attr( $this->combine_classes( 'wpbc_ui_listing__page_total', $classes['page_total'] ) ); ?>"
							data-wpbc-listing-page-total="<?php echo esc_attr( $this->listing_id ); ?>">1</span>
					</div>
					<button type="button"
						class="<?php echo esc_attr( $this->combine_classes( 'button wpbc_ui_listing__page_next', $classes['next'] ) ); ?>"
						data-wpbc-listing-page-next="<?php echo esc_attr( $this->listing_id ); ?>"
						aria-label="<?php echo esc_attr( $this->settings['next_page_label'] ); ?>">
						<span class="wpbc-bi-chevron-right" aria-hidden="true"></span>
					</button>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Apply defaults and sanitize reusable listing settings.
	 *
	 * @param array<string,mixed> $settings Untrusted or partially defined settings.
	 *
	 * @return array<string,mixed> Complete internal settings.
	 */
	private function normalize_settings( $settings ) {
		$default_classes = array(
			'container'       => '',
			'table_wrap'      => '',
			'table'           => '',
			'footer'          => '',
			'result_count'    => '',
			'footer_controls' => '',
			'items_per_page'  => '',
			'pagination'      => '',
			'previous'        => '',
			'page_label'      => '',
			'page_number'     => '',
			'page_total'      => '',
			'next'            => '',
		);
		$defaults        = array(
			'aria_label'                => '',
			'columns'                   => array(),
			'body_callback'             => null,
			'classes'                   => $default_classes,
			'items_per_page_default'    => 10,
			'items_per_page_options'    => array( 5, 10, 50, 100 ),
			'sort_by'                   => '',
			'sort_order'                => 'asc',
			'sort_keys'                 => array(),
			'items_per_page_label'      => __( 'Show', 'booking' ),
			'items_per_page_suffix'     => __( 'per page', 'booking' ),
			'page_number_label'         => __( 'Page', 'booking' ),
			'previous_page_label'       => __( 'Previous page', 'booking' ),
			'next_page_label'           => __( 'Next page', 'booking' ),
		);
		$settings        = wp_parse_args( is_array( $settings ) ? $settings : array(), $defaults );
		$settings['classes'] = wp_parse_args( is_array( $settings['classes'] ) ? $settings['classes'] : array(), $default_classes );

		foreach ( $settings['classes'] as $class_group => $css_classes ) {
			$settings['classes'][ $class_group ] = $this->sanitize_css_classes( $css_classes );
		}

		$normalized_columns = array();
		foreach ( (array) $settings['columns'] as $column_key => $column ) {
			if ( ! is_array( $column ) ) {
				continue;
			}

			$column = wp_parse_args(
				$column,
				array(
					'id'              => is_string( $column_key ) ? $column_key : '',
					'label'           => '',
					'class'           => '',
					'sortable'        => false,
					'header_callback' => null,
				)
			);
			$column['id']    = sanitize_key( $column['id'] );
			$column['label'] = sanitize_text_field( $column['label'] );
			$column['class'] = $this->sanitize_css_classes( $column['class'] );
			if ( true === $column['sortable'] ) {
				$column['sortable'] = $column['id'];
			} elseif ( is_scalar( $column['sortable'] ) ) {
				$column['sortable'] = sanitize_key( $column['sortable'] );
			} else {
				$column['sortable'] = '';
			}

			if ( '' !== $column['id'] ) {
				$normalized_columns[] = $column;
			}
		}

		$settings['columns']                = $normalized_columns;
		$settings['aria_label']             = sanitize_text_field( $settings['aria_label'] );
		$settings['sort_by']                = is_scalar( $settings['sort_by'] ) ? sanitize_key( $settings['sort_by'] ) : '';
		$settings['sort_order']             = is_scalar( $settings['sort_order'] ) && 'desc' === strtolower( sanitize_key( $settings['sort_order'] ) ) ? 'desc' : 'asc';
		$settings['sort_keys']              = array_values( array_unique( array_filter( array_map( 'sanitize_key', array_filter( (array) $settings['sort_keys'], 'is_scalar' ) ) ) ) );
		$settings['items_per_page_default'] = absint( $settings['items_per_page_default'] );
		$settings['items_per_page_options'] = array_values( array_unique( array_filter( array_map( 'absint', (array) $settings['items_per_page_options'] ) ) ) );
		if ( $settings['items_per_page_default'] < 1 ) {
			$settings['items_per_page_default'] = 10;
		}

		if ( ! in_array( $settings['items_per_page_default'], $settings['items_per_page_options'], true ) ) {
			$settings['items_per_page_options'][] = $settings['items_per_page_default'];
		}

		return $settings;
	}

	/**
	 * Return the public sort keys declared by configured columns.
	 *
	 * @return array<int,string> Unique sanitized sort keys.
	 */
	private function get_sortable_columns() {
		$sortable_columns = $this->settings['sort_keys'];

		foreach ( $this->settings['columns'] as $column ) {
			if ( '' !== $column['sortable'] ) {
				$sortable_columns[] = $column['sortable'];
			}
		}

		return array_values( array_unique( $sortable_columns ) );
	}

	/**
	 * Normalize a page size against the configured allow-list.
	 *
	 * @param mixed $page_size          Candidate page size.
	 * @param mixed $fallback_page_size Optional allowed fallback; defaults to the listing default.
	 *
	 * @return int Allowed page size or the configured default.
	 */
	public function normalize_items_per_page( $page_size, $fallback_page_size = null ) {
		$page_size          = is_scalar( $page_size ) ? absint( $page_size ) : 0;
		$fallback_page_size = is_scalar( $fallback_page_size ) ? absint( $fallback_page_size ) : 0;
		if ( ! in_array( $fallback_page_size, $this->get_items_per_page_options(), true ) ) {
			$fallback_page_size = absint( $this->settings['items_per_page_default'] );
		}

		return in_array( $page_size, $this->get_items_per_page_options(), true )
			? $page_size
			: $fallback_page_size;
	}

	/**
	 * Resolve an optional user ID without trusting arbitrary request data.
	 *
	 * @param int $user_id Optional WordPress user ID.
	 *
	 * @return int Positive user ID or zero for a logged-out request.
	 */
	private function resolve_user_id( $user_id ) {
		if ( $user_id ) {
			return absint( $user_id );
		}

		return function_exists( 'wpbc_get_current_user_id' )
			? absint( wpbc_get_current_user_id() )
			: get_current_user_id();
	}

	/**
	 * Read the shared listing preference collection for one user.
	 *
	 * @param int $user_id WordPress user ID.
	 *
	 * @return array<string,array<string,int>> Saved preferences or an empty array.
	 */
	private function get_user_preferences( $user_id ) {
		if ( ! $user_id ) {
			return array();
		}

		$preferences = get_user_option( self::USER_OPTION_NAME, $user_id );

		return is_array( $preferences ) ? $preferences : array();
	}

	/**
	 * Sanitize a whitespace-separated CSS class list.
	 *
	 * @param mixed $css_classes Class string or array of class names.
	 *
	 * @return string Safe whitespace-separated class names.
	 */
	private function sanitize_css_classes( $css_classes ) {
		if ( is_array( $css_classes ) ) {
			$css_classes = implode( ' ', $css_classes );
		}

		$class_names = preg_split( '/\s+/', trim( (string) $css_classes ) );
		$class_names = array_filter( array_map( 'sanitize_html_class', (array) $class_names ) );

		return implode( ' ', array_unique( $class_names ) );
	}

	/**
	 * Combine component and page-specific class names safely.
	 *
	 * @param string $base_classes  Shared component class names.
	 * @param string $extra_classes Page-specific class names.
	 *
	 * @return string Sanitized combined class list.
	 */
	private function combine_classes( $base_classes, $extra_classes ) {
		return $this->sanitize_css_classes( trim( $base_classes . ' ' . $extra_classes ) );
	}
}
