<?php
/**
 * Dedicated frontend Booking Resource catalog presenter.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render public Resource cards without depending on admin listing markup.
 */
final class WPBC_Booking_Resource_Catalog_Presenter {

	/** Horizontal gap mirrored by the frontend catalog stylesheet. */
	private const CATALOG_COLUMN_GAP_PX = 10;

	/**
	 * Render filters and a selectable public Resource collection.
	 *
	 * @param array<int,array<string,mixed>> $resources Public Resource DTO arrays.
	 * @param array<string,mixed>            $args      Presentation arguments.
	 *
	 * @return string Escaped public catalog markup.
	 */
	public function render_selectable_catalog( $resources, $args = array() ) {
		$args = wp_parse_args(
			is_array( $args ) ? $args : array(),
			array(
				'layout'                 => 'grid',
				'show_filters'           => false,
				'show_image'             => true,
				'show_title'             => true,
				'show_description'       => true,
				'item_width'             => '',
				'item_max_width'         => 0,
				'grid_items_per_row'     => 0,
				'list_items_per_row'     => 0,
				'show_hierarchy'         => true,
				'show_availability'      => true,
				'show_price'             => true,
				'selected_resource_id'   => 0,
				'input_name'             => 'wpbc_resource_selector_resource',
				'input_id_prefix'        => 'wpbc_resource_selector',
				'catalog_label'          => __( 'Booking Resources', 'booking' ),
			)
		);
		$layout = 'list' === $args['layout'] ? 'list' : 'grid';
		$item_width = wpbc_booking_resource_selector_normalize_css_width( $args['item_width'] );
		$item_max_width = absint( $args['item_max_width'] );
		$requested_column_count = 'list' === $layout ? absint( $args['list_items_per_row'] ) : absint( $args['grid_items_per_row'] );
		$column_count = min( 12, $requested_column_count );
		$catalog_class = 'wpbc_booking_resource_catalog wpbc_booking_resource_catalog--' . $layout;
		$catalog_styles = array();
		if ( $item_max_width > 0 ) {
			$catalog_class .= ' wpbc_booking_resource_catalog--bounded';
			$catalog_styles[] = '--wpbc-resource-catalog-item-max-width:' . min( 1200, max( 280, $item_max_width ) ) . 'px';
		}
		if ( empty( $args['show_image'] ) ) {
			$catalog_class .= ' wpbc_booking_resource_catalog--without-images';
		}
		if ( $column_count > 0 ) {
			$catalog_class .= ' wpbc_booking_resource_catalog--explicit-columns wpbc_booking_resource_catalog--columns-' . $column_count;
			$catalog_styles[] = '--wpbc-resource-catalog-items-per-row:' . $column_count;
		} elseif ( '' !== $item_width ) {
			$catalog_class .= ' wpbc_booking_resource_catalog--explicit-item-width';
			$catalog_styles[] = '--wpbc-resource-catalog-item-width:' . $item_width;
			$catalog_styles[] = '--wpbc-resource-catalog-item-track-width:' . $this->get_item_track_width( $item_width );
		}
		$catalog_style = empty( $catalog_styles ) ? '' : ' style="' . esc_attr( implode( ';', $catalog_styles ) . ';' ) . '"';
		$html          = '<div class="' . esc_attr( $catalog_class ) . '" data-wpbc-resource-catalog="" data-layout="' . esc_attr( $layout ) . '"' . $catalog_style . '>';
		if ( ! empty( $args['show_filters'] ) && count( $resources ) > 1 ) {
			$html .= $this->render_search_field();
		}
		$html .= '<div class="wpbc_booking_resource_catalog__items wpbc_booking_resource_selector__choices" role="radiogroup" aria-label="' . esc_attr( $args['catalog_label'] ) . '" data-wpbc-resource-catalog-items="">';
		foreach ( $resources as $resource ) {
			$html .= $this->render_selectable_card( $resource, $args );
		}
		$html .= '</div>';
		$html .= '<p class="wpbc_booking_resource_catalog__empty" data-wpbc-resource-catalog-empty="" role="status" hidden>' . esc_html__( 'No Booking Resources match your search.', 'booking' ) . '</p>';
		$html .= '<p class="screen-reader-text" data-wpbc-resource-catalog-status="" aria-live="polite"></p>';
		$html .= '</div>';

		return $html;
	}

	/**
	 * Return a grid track width that preserves percentage widths beside gaps.
	 *
	 * Percentage tracks subtract their proportional share of the fixed catalog
	 * gap so familiar values such as 50% and 25% produce two and four columns
	 * without horizontal overflow. Other safe units are returned unchanged.
	 *
	 * @param string $item_width Normalized item width.
	 *
	 * @return string Safe CSS grid track width.
	 */
	private function get_item_track_width( $item_width ) {
		if ( ! preg_match( '/^(\d+(?:\.\d+)?)%$/', $item_width, $matches ) ) {
			return $item_width;
		}

		$percentage_width = (float) $matches[1];
		$estimated_columns = max( 1, (int) floor( ( 100 + 0.0001 ) / $percentage_width ) );
		if ( $estimated_columns <= 1 ) {
			return $item_width;
		}

		$gap_adjustment = self::CATALOG_COLUMN_GAP_PX * ( $estimated_columns - 1 ) / $estimated_columns;
		$gap_adjustment = rtrim( rtrim( number_format( $gap_adjustment, 4, '.', '' ), '0' ), '.' );

		return 'calc(' . $item_width . ' - ' . $gap_adjustment . 'px)';
	}

	/**
	 * Render the public Resource search field.
	 *
	 * @return string Escaped filter markup.
	 */
	private function render_search_field() {
		$filter_id = wp_unique_id( 'wpbc_resource_catalog_search_' );
		$html      = '<div class="wpbc_booking_resource_catalog__filters" role="search" aria-label="' . esc_attr__( 'Filter Booking Resources', 'booking' ) . '">';
		$html     .= '<label class="wpbc_booking_resource_catalog__search" for="' . esc_attr( $filter_id ) . '"><span class="screen-reader-text">' . esc_html__( 'Search Booking Resources', 'booking' ) . '</span><input id="' . esc_attr( $filter_id ) . '" type="search" placeholder="' . esc_attr__( 'Search Booking Resources', 'booking' ) . '" data-wpbc-resource-catalog-search="" autocomplete="off"></label>';
		$html .= '</div>';

		return $html;
	}

	/**
	 * Render one accessible selectable Resource card.
	 *
	 * @param array<string,mixed> $resource Public Resource DTO array.
	 * @param array<string,mixed> $args     Presentation arguments.
	 *
	 * @return string Escaped card markup.
	 */
	private function render_selectable_card( $resource, $args ) {
		$resource_id   = absint( $resource['resource_id'] );
		$resource_type = ! empty( $args['show_hierarchy'] ) && ! empty( $resource['resource_type'] )
			? sanitize_key( $resource['resource_type'] )
			: 'single';
		$input_id      = sanitize_html_class( $args['input_id_prefix'] ) . '_' . $resource_id . '_' . wp_rand( 1000, 9999 );
		$is_selected   = $resource_id === absint( $args['selected_resource_id'] );
		$search_text   = wp_strip_all_tags( (string) $resource['title'] . ' ' . (string) $resource['description'] . ' ' . (string) $resource['parent_title'] );
		$classes       = array( 'wpbc_booking_resource_selector__choice', 'wpbc_booking_resource_catalog__card', 'is-' . $resource_type );
		if ( $is_selected ) {
			$classes[] = 'is-selected';
		}

		$html  = '<label class="' . esc_attr( implode( ' ', array_map( 'sanitize_html_class', $classes ) ) ) . '" for="' . esc_attr( $input_id ) . '" data-resource-id="' . $resource_id . '" data-resource-type="' . esc_attr( $resource_type ) . '" data-resource-search="' . esc_attr( $search_text ) . '">';
		$html .= '<input id="' . esc_attr( $input_id ) . '" type="radio" name="' . esc_attr( $args['input_name'] ) . '" value="' . $resource_id . '"' . checked( $is_selected, true, false ) . ' required>';
		if ( ! empty( $args['show_image'] ) ) {
			$html .= '<span class="wpbc_booking_resource_selector__resource_icon wpbc_booking_resource_catalog__image" aria-hidden="true">';
			if ( ! empty( $resource['image_url'] ) ) {
				$html .= '<img src="' . esc_url( $resource['image_url'] ) . '" alt="" loading="lazy" decoding="async">';
			} else {
				$html .= esc_html( wpbc_booking_resource_selector_get_resource_initials( $resource['title'] ) );
			}
			$html .= '</span>';
		}
		$html .= '<span class="wpbc_booking_resource_selector__choice_body wpbc_booking_resource_catalog__body"><span class="wpbc_booking_resource_catalog__title_line">';
		$html .= ! empty( $args['show_title'] )
			? '<strong>' . esc_html( $resource['title'] ) . '</strong>'
			: '<span class="screen-reader-text">' . esc_html( $resource['title'] ) . '</span>';
		$html .= $this->render_hierarchy_badge( $resource, $args ) . '</span>';
		if ( ! empty( $args['show_description'] ) && ! empty( $resource['description'] ) ) {
			$html .= '<span class="wpbc_booking_resource_selector__choice_description wpbc_booking_resource_catalog__description">' . esc_html( $resource['description'] ) . '</span>';
		}
		$html .= $this->render_summaries( $resource, $args );
		$html .= '</span><span class="wpbc_booking_resource_selector__choice_mark" aria-hidden="true"></span></label>';

		return $html;
	}

	/**
	 * Render a concise hierarchy badge for one Resource.
	 *
	 * @param array<string,mixed> $resource Public Resource DTO array.
	 * @param array<string,mixed> $args     Presentation arguments.
	 *
	 * @return string Escaped hierarchy markup or an empty string.
	 */
	private function render_hierarchy_badge( $resource, $args ) {
		if ( empty( $args['show_hierarchy'] ) ) {
			return '';
		}
		$resource_type = isset( $resource['resource_type'] ) ? sanitize_key( $resource['resource_type'] ) : 'single';
		if ( 'parent' === $resource_type ) {
			$capacity = max( 1, absint( $resource['capacity'] ) );
			/* translators: %s: Number of bookable units. */
			$label = sprintf( _n( '%s unit', '%s units', $capacity, 'booking' ), number_format_i18n( $capacity ) );
		} elseif ( 'child' === $resource_type ) {
			$label = ! empty( $resource['parent_title'] )
				? sprintf( __( 'Unit of %s', 'booking' ), $resource['parent_title'] )
				: __( 'Booking unit', 'booking' );
		} else {
			return '';
		}

		return '<span class="wpbc_booking_resource_catalog__hierarchy">' . esc_html( $label ) . '</span>';
	}

	/**
	 * Render availability and price summaries owned by the public DTO.
	 *
	 * @param array<string,mixed> $resource Public Resource DTO array.
	 * @param array<string,mixed> $args     Presentation arguments.
	 *
	 * @return string Escaped summary markup.
	 */
	private function render_summaries( $resource, $args ) {
		$summary_items = array();
		if ( ! empty( $args['show_availability'] ) && ! empty( $resource['availability_summary']['label'] ) ) {
			$availability_description = isset( $resource['availability_summary']['description'] )
				? (string) $resource['availability_summary']['description']
				: '';
			$summary_items[] = '<span class="wpbc_booking_resource_catalog__summary wpbc_booking_resource_catalog__summary--availability" title="' . esc_attr( $availability_description ) . '">' . esc_html( $resource['availability_summary']['label'] ) . ( '' !== $availability_description ? '<span class="screen-reader-text"> ' . esc_html( $availability_description ) . '</span>' : '' ) . '</span>';
		}
		if ( ! empty( $args['show_price'] ) && ! empty( $resource['price_summary']['label'] ) ) {
			$price_label = (string) $resource['price_summary']['label'];
			if ( ! empty( $resource['price_summary']['period_label'] ) ) {
				$price_label .= ' ' . (string) $resource['price_summary']['period_label'];
			}
			$summary_items[] = '<span class="wpbc_booking_resource_catalog__summary wpbc_booking_resource_catalog__summary--price">' . esc_html( $price_label ) . '</span>';
		}

		return empty( $summary_items ) ? '' : '<span class="wpbc_booking_resource_catalog__summaries">' . implode( '', $summary_items ) . '</span>';
	}
}

/**
 * Return the shared frontend Resource catalog presenter.
 *
 * @return WPBC_Booking_Resource_Catalog_Presenter Presenter singleton.
 */
function wpbc_booking_resource_catalog_presenter() {
	static $presenter = null;

	if ( null === $presenter ) {
		$presenter = new WPBC_Booking_Resource_Catalog_Presenter();
	}

	return $presenter;
}
