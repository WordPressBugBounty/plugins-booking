<?php
/**
 * Admin Panel UI - Parts
 *
 * @version  1.2
 * @package  Any
 * @category Page Structure in Admin Panel
 * @author   wpdevelop
 *
 * @web-site https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2025-03-20
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;                                                                                                               // Exit, if accessed directly.
}

/**
 * Show Top Horisontal Navigation Bar
 *
 * @param array $args {
 *     Navigation parameters. An active tab can set top_navigation_use_subtabs
 *     to render its subtabs instead of the active root's top-level peers.
 *
 *     @type string $active_page   Current root page slug.
 *     @type string $active_tab    Current tab slug.
 *     @type string $active_subtab Current subtab slug.
 *     @type array  $page_nav_tabs Complete registered navigation tree.
 * }
 *
 * @return bool True when a horizontal row was rendered; otherwise false.
 */
function wpbc_ui__top_horisontal_nav( $args = array() ) {

	$params = wp_parse_args(
		$args,
		array(
			'active_page'   => '',
			'active_tab'    => '',
			'active_subtab' => '',
			'page_nav_tabs' => array(),
		)
	);

	$active_page_arr = array(
		'active_page'   => is_scalar( $params['active_page'] ) ? (string) $params['active_page'] : '',
		'active_tab'    => is_scalar( $params['active_tab'] ) ? (string) $params['active_tab'] : '',
		'active_subtab' => is_scalar( $params['active_subtab'] ) ? (string) $params['active_subtab'] : '',
	);
	$page_nav_tabs   = is_array( $params['page_nav_tabs'] ) ? $params['page_nav_tabs'] : array();

	if ( function_exists( 'wpbc_booking_modes_v3_compile_horizontal_navigation' ) ) {
		$compiled_navigation = wpbc_booking_modes_v3_compile_horizontal_navigation(
			$page_nav_tabs,
			$active_page_arr['active_page'],
			$active_page_arr['active_tab'],
			$active_page_arr['active_subtab']
		);
		if ( ! is_array( $compiled_navigation ) ) {
			return false;
		}

		$page_nav_tabs = $compiled_navigation;
	}

	$main_page_slug = $active_page_arr['active_page'];
	if ( '' === $main_page_slug || ! isset( $page_nav_tabs[ $main_page_slug ] ) || ! is_array( $page_nav_tabs[ $main_page_slug ] ) ) {
		return false;
	}

	$page_item_arr = $page_nav_tabs[ $main_page_slug ];
	$active_tab    = isset( $page_item_arr[ $active_page_arr['active_tab'] ] ) && is_array( $page_item_arr[ $active_page_arr['active_tab'] ] )
		? $page_item_arr[ $active_page_arr['active_tab'] ]
		: array();

	// Some focused settings pages use their subtabs as the horizontal page-level navigation.
	if (
		! empty( $active_tab['top_navigation_use_subtabs'] )
		&& ! empty( $active_tab['subtabs'] )
		&& is_array( $active_tab['subtabs'] )
	) {
		$page_item_arr = $active_tab['subtabs'];
	}

	$page_item_arr = wpbc_ui__top_horisontal_nav__get_meaningful_items( $page_item_arr );
	if ( count( $page_item_arr ) < 2 ) {
		return false;
	}

	echo '<div class="wpbc_ui_el__horis_top_bar__wrapper">';
	echo '  <div class="wpbc_ui_el__horis_top_bar__content">';
	echo '    <nav class="wpbc_ui_el__horis_top_bar__navigation" aria-label="' . esc_attr__( 'Booking Calendar page navigation', 'booking' ) . '">';

	do_action( 'hook__wpbc_ui__top_horisontal_nav__start', $active_page_arr['active_page'], $active_page_arr['active_tab'] );  // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

	foreach ( $page_item_arr as $main_menu_slug => $menu_item_arr ) {
		do_action( 'hook__wpbc_ui__top_horisontal_nav__item_start', $active_page_arr['active_page'], $active_page_arr['active_tab'], $main_menu_slug );   // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		wpbc_ui__horis_menu__item_main( $main_menu_slug, $menu_item_arr );

		do_action( 'hook__wpbc_ui__top_horisontal_nav__item_end', $active_page_arr['active_page'], $active_page_arr['active_tab'], $main_menu_slug );   // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	}
	echo '    </nav><!-- wpbc_ui_el__horis_top_bar__navigation -->';

	echo '<div class="wpbc_ui_el__horis_top_bar__actions">';
	do_action( 'hook__wpbc_ui__top_horisontal_nav__end', $active_page_arr['active_page'], $active_page_arr['active_tab'] );   // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
	echo '</div><!-- wpbc_ui_el__horis_top_bar__actions -->';

	echo '   </div><!-- wpbc_ui_el__horis_top_bar__content -->';
	echo '</div><!-- wpbc_ui_el__horis_top_bar__wrapper -->';

	return true;
}


/**
 * Return the ordered navigation peers that are meaningful in the horizontal row.
 *
 * The compiled navigation tree already owns URL, capability, edition, ordering,
 * and active-state decisions. This presentation helper therefore removes only
 * malformed nodes and nodes with the horizontal surface's explicit hidden flag.
 * Array keys and node values remain unchanged.
 *
 * @param mixed $navigation_items Candidate sibling navigation map.
 *
 * @return array Ordered visible navigation peers.
 */
function wpbc_ui__top_horisontal_nav__get_meaningful_items( $navigation_items ) {

	if ( ! is_array( $navigation_items ) ) {
		return array();
	}

	$meaningful_items = array();
	foreach ( $navigation_items as $menu_slug => $menu_item_arr ) {
		if (
			! is_array( $menu_item_arr )
			|| ! empty( $menu_item_arr['top_navigation_hidden'] )
			|| ! isset( $menu_item_arr['title'], $menu_item_arr['url'] )
			|| ! is_scalar( $menu_item_arr['title'] )
			|| ! is_scalar( $menu_item_arr['url'] )
			|| '' === trim( (string) $menu_item_arr['title'] )
			|| '' === trim( (string) $menu_item_arr['url'] )
		) {
			continue;
		}

		$meaningful_items[ $menu_slug ] = $menu_item_arr;
	}

	return $meaningful_items;
}


/**
 * Remove New labels from titles rendered in the top horizontal navigation.
 *
 * @param string $title Horizontal navigation title.
 *
 * @return string
 */
function wpbc_ui__horis_menu__item_main__remove_new_label( $title ) {

	if ( ! is_string( $title ) || '' === $title ) {
		return $title;
	}

	$filtered_title = preg_replace(
		'/<span\b[^>]*\bclass\s*=\s*(["\'])[^"\']*\bwpbc_new_label\b[^"\']*\1[^>]*>.*?<\/span>(?:\s|&nbsp;)*/is',
		'',
		$title
	);

	return ( null === $filtered_title ) ? $title : $filtered_title;
}
add_filter( 'wpbc_ui__horis_menu__item_main__title', 'wpbc_ui__horis_menu__item_main__remove_new_label', PHP_INT_MAX );


/**
 * Show Horisontal - "Menu Item".
 *
 * @param string $menu_slug     - 'calendar_appearance'.
 * @param array  $menu_item_arr - [    [title] => Skin
 *                                     [page_title] => Calendar General Settings 3
 *                                     [hint] => Calendar General Settings 2
 *                                     [link] =>
 *                                     [position] =>
 *                                     [css_classes] =>
 *                                     [folder_style] => order:93;
 *                                     [icon] =>
 *                                     [font_icon] => wpbc-bi-calendar2-range
 *                                     [default] =>
 *                                     [disabled] =>
 *                                     [hided] =>
 *                                     [top_navigation_hidden] =>
 *                                     [is_active] => 1
 *                                     [url] => http://beta/wp-admin/admin.php?page=wpbc-settings&#038;tab=calendar_appearance
 *                                     [subtabs] => [....]
 *                               ]
 *
 * @return void
 */
function wpbc_ui__horis_menu__item_main( $menu_slug, $menu_item_arr ) {

	$defaults      = array(
		'title'                 => '',
		'page_title'            => '',
		'hint'                  => '',
		'link'                  => '',
		'position'              => '',
		'css_classes'           => '',
		'folder_style'          => '',
		'icon'                  => '',
		'font_icon'             => '',
		'default'               => false,
		'disabled'              => false,
		'hided'                 => false,
		'top_navigation_hidden' => false,
		'is_active'             => 0,
		'url'                   => '',
		'subtabs'               => array(),
	);
	$menu_item_arr = wp_parse_args( $menu_item_arr, $defaults );
	$folder_style  = ( ! empty( $menu_item_arr['folder_style'] ) ) ? esc_attr( $menu_item_arr['folder_style'] ) : ''; // FixIn: 11.4.2.

	/**
	 * Filter the title displayed in the top horizontal navigation.
	 *
	 * @param string $title         Horizontal navigation title.
	 * @param string $menu_slug     Menu item slug.
	 * @param array  $menu_item_arr Complete menu item configuration.
	 */
	$menu_item_arr['title'] = apply_filters( 'wpbc_ui__horis_menu__item_main__title', $menu_item_arr['title'], $menu_slug, $menu_item_arr );

	?><div class="wpbc_ui_el__horis_nav_item wpbc_ui_el__horis_nav_item__<?php echo esc_attr( $menu_slug ); ?>  <?php echo ( ! empty( $menu_item_arr['is_active'] ) ) ? ' active ' : ''; ?>"
		   style="<?php echo esc_attr( $folder_style ); ?>">
		<?php
		// Single Item.
		?>
		<a 	href="<?php echo esc_url( $menu_item_arr['url'] ); ?>"
			<?php if ( ! empty( $menu_item_arr['is_active'] ) ) : ?> aria-current="page"<?php endif; ?>
			class="wpbc_ui_el__horis_nav_item__a wpbc_ui_el__horis_nav_item__single<?php echo ( ! empty( $menu_item_arr['font_icon'] ) ) ? ' tooltip_top' : ''; ?>"
			<?php if ( ! empty( $menu_item_arr['font_icon'] ) ) : ?> data-original-title="<?php echo esc_attr( wp_strip_all_tags( $menu_item_arr['title'] ) ); ?>"<?php endif; ?>>
			<?php if ( ! empty( $menu_item_arr['font_icon'] ) ) { ?>
			<i 	class="wpbc_ui_el__horis_nav_icon menu_icon icon-1x <?php echo esc_attr( $menu_item_arr['font_icon'] ); ?>"></i>
			<?php } ?>
			<span class="wpbc_ui_el__horis_nav_title"><?php
				 echo wp_kses_post( $menu_item_arr['title'] );
			?></span>
		</a>
	</div>
	<?php
}
