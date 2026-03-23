<?php
/**
 * Admin UI — Top Tabs (Universal Renderer)
 *
 * @package    Booking Calendar
 * @subpackage Form Builder
 * @since      11.0.0
 * @file       includes/page-form-builder/ui-parts/bfb-ui__nav_horis.php
 *
 *
 * This class prints a “tabs navigation bar” and works together with the small JS switcher
 * (bfb-top-tabs.js) to show/hide tab panels in a scoped container.
 *
 * -------------------------------------------------------------------------------------
 * How it works (PHP + JS contract)
 * -------------------------------------------------------------------------------------
 *
 * 1) Navigation container (printed by ::render()):
 *
 * The nav container MUST have these attributes (the class prints them automatically):
 *
 * - data-wpbc-bfb-tabs-nav="1"
 *     Marker for JS to auto-init this nav.
 *
 * - data-active-tab="builder_tab"
 *     Initial active panel tab id. JS updates this attribute on each click.
 *
 * - data-wpbc-bfb-panel-class="wpbc_bfb__top_tab_section"
 *     The “base class” used to find panels inside the panels root.
 *
 * - data-wpbc-bfb-panels-root="#wpbc_bfb__top_panels"   (optional but recommended)
 *     CSS selector of the container that holds panels for this nav.
 *     If omitted, JS falls back to document scope (not recommended when there are nested tabs).
 *
 * 2) Tab links (printed for type="panel"):
 *
 * Each panel tab link MUST contain:
 * - data-wpbc-bfb-action="panel"
 * - data-wpbc-bfb-tab="{tab_id}"
 *
 * JS uses event delegation and listens for clicks on these links.
 *
 * 3) Panels markup (you write this in the page template):
 *
 * Panels must exist inside the panels root (data-wpbc-bfb-panels-root) and follow class naming:
 *
 * - Base class:          .{panel_base_class}
 * - Tab-specific class:  .{panel_base_class}__{tab_id}
 *
 * Example for tab_id="builder_tab" and panel_base_class="wpbc_bfb__top_tab_section":
 *   <div class="wpbc_bfb__top_tab_section wpbc_bfb__top_tab_section__builder_tab"> ... </div>
 *
 * JS hides all ".{panel_base_class}" inside the root, and shows only the matching
 * ".{panel_base_class}__{active_tab_id}".
 *
 * IMPORTANT (nested tabs):
 * - Always set a unique panels root and a unique panel_base_class per tab group.
 * - Otherwise a “parent” tab switch can hide “child” panels (classic nested tabs bug).
 *
 * -------------------------------------------------------------------------------------
 * Tabs config format
 * -------------------------------------------------------------------------------------
 *
 * $tabs_config = array(
 *   'builder_tab' => array(
 *     'title'       => 'Form Builder',
 *     'type'        => 'panel',          // panel|url
 *     'css_classes' => '',               // extra wrapper classes
 *     'font_icon'   => '',               // optional icon class
 *     'hint'        => array(            // optional tooltip
 *       'title'    => 'Tooltip text',
 *       'position' => 'top',
 *     ),
 *     'data_attr'   => array(            // optional extra link attrs (data-  /aria-  /title/role)
 *       'data-foo' => '1',
 *     ),
 *   ),
 *   'docs' => array(
 *     'title' => 'Docs',
 *     'type'  => 'url',
 *     'url'   => admin_url( 'admin.php?page=...' ),
 *   ),
 * );
 *
 * -------------------------------------------------------------------------------------
 * Usage examples
 * -------------------------------------------------------------------------------------
 *
 * Example A: Top-level tabs (recommended pattern)
 *
 * $active_tab_id = WPBC_BFB_UI_Top_Tabs::resolve_active_tab_id( $tabs_config, 'builder_tab' );
 * WPBC_BFB_UI_Top_Tabs::render( array(
 *   'active_tab'       => $active_tab_id,
 *   'tabs'             => $tabs_config,
 *   'nav_container_id' => 'wpbc_bfb__top_horisontal_nav',
 *   'panels_root_id'   => 'wpbc_bfb__top_panels',
 *   'panel_base_class' => 'wpbc_bfb__top_tab_section',
 * ) );
 *
 * <div id="wpbc_bfb__top_panels">
 *   <div class="wpbc_bfb__top_tab_section wpbc_bfb__top_tab_section__builder_tab" <?php echo WPBC_BFB_UI_Top_Tabs::get_panel_hidden_attr( 'builder_tab', $active_tab_id ); ?>>
 *     ...
 *   </div>
 *
 *   <div class="wpbc_bfb__top_tab_section wpbc_bfb__top_tab_section__advanced_tab" <?php echo WPBC_BFB_UI_Top_Tabs::get_panel_hidden_attr( 'advanced_tab', $active_tab_id ); ?>>
 *     ...
 *   </div>
 * </div>
 *
 * Example B: Nested tabs inside a panel (use different base + root)
 *
 * WPBC_BFB_UI_Top_Tabs::render( array(
 *   'active_tab'       => 'tab_one',
 *   'tabs'             => $inner_tabs,
 *   'nav_container_id' => 'my_inner_tabs_nav',
 *   'panels_root_id'   => 'my_inner_tabs_panels',
 *   'panel_base_class' => 'my_inner_tab_panel',
 * ) );
 *
 * <div id="my_inner_tabs_panels">
 *   <div class="my_inner_tab_panel my_inner_tab_panel__tab_one">...</div>
 *   <div class="my_inner_tab_panel my_inner_tab_panel__tab_two">...</div>
 * </div>
 *
 * Notes:
 * - Use get_panel_hidden_attr() only for initial PHP render (JS controls switching after load).
 */


if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_UI_Top_Tabs {

	/**
	 * HTML id of the default top navigation container.
	 *
	 * @var string
	 */
	const NAV_CONTAINER_ID         = 'wpbc_bfb__top_horisontal_nav';

	/**
	 * Default panel base class used by JS to find/hide/show panels.
	 *
	 * Panels:
	 * - base:  .wpbc_bfb__tab_section
	 * - by id: .wpbc_bfb__tab_section__{tab_id}
	 *
	 * @var string
	 */
	const DEFAULT_PANEL_BASE_CLASS = 'wpbc_bfb__tab_section';

	/**
	 * Resolve active tab id to a valid "panel" tab id.
	 *
	 * @param array  $tabs_config      Tabs config (tab_id => args).
	 * @param string $requested_tab_id Requested tab id.
	 * @param string $fallback_tab_id  Optional fallback id (if no panel tab found).
	 *
	 * @return string
	 */
	public static function resolve_active_tab_id( $tabs_config, $requested_tab_id, $fallback_tab_id = '' ) {

		$tabs_config      = is_array( $tabs_config ) ? $tabs_config : array();
		$requested_tab_id = sanitize_key( (string) $requested_tab_id );
		$fallback_tab_id  = sanitize_key( (string) $fallback_tab_id );

		// 1) Requested tab if valid panel.
		if ( isset( $tabs_config[ $requested_tab_id ] ) && is_array( $tabs_config[ $requested_tab_id ] ) ) {
			$tab_type = isset( $tabs_config[ $requested_tab_id ]['type'] ) ? (string) $tabs_config[ $requested_tab_id ]['type'] : 'panel';
			if ( 'panel' === $tab_type ) {
				return $requested_tab_id;
			}
		}

		// 2) First explicitly marked active panel.
		foreach ( $tabs_config as $tab_id => $tab_args ) {
			$tab_id    = sanitize_key( (string) $tab_id );
			$tab_args  = is_array( $tab_args ) ? $tab_args : array();
			$tab_type  = isset( $tab_args['type'] ) ? (string) $tab_args['type'] : 'panel';
			$is_active = ! empty( $tab_args['active'] );

			if ( $is_active && 'panel' === $tab_type ) {
				return $tab_id;
			}
		}

		// 3) First panel tab.
		foreach ( $tabs_config as $tab_id => $tab_args ) {
			$tab_id   = sanitize_key( (string) $tab_id );
			$tab_args = is_array( $tab_args ) ? $tab_args : array();
			$tab_type = isset( $tab_args['type'] ) ? (string) $tab_args['type'] : 'panel';

			if ( 'panel' === $tab_type ) {
				return $tab_id;
			}
		}

		// 4) Fallback.
		return $fallback_tab_id ? $fallback_tab_id : 'builder_tab';
	}

	/**
	 * Inline attribute to hide inactive panels on initial PHP render.
	 *
	 * @param string $panel_id_suffix Panel suffix.
	 * @param string $active_tab_id   Active tab id.
	 *
	 * @return string
	 */
	public static function get_panel_hidden_attr( $panel_id_suffix, $active_tab_id ) {

		$panel_id_suffix = sanitize_key( (string) $panel_id_suffix );
		$active_tab_id   = sanitize_key( (string) $active_tab_id );

		return ( $panel_id_suffix === $active_tab_id ) ? '' : ' style="display:none;"';
	}

	/**
	 * Render the tabs navigation.
	 *
	 * Args:
	 * - active_tab       (string)
	 * - tabs             (array)
	 * - nav_container_id (string)
	 * - panels_root_id   (string)
	 * - panels_root_selector (string)
	 * - panel_base_class (string)
	 *
	 * @param array $args
	 *
	 * @return void
	 */
	public static function render( $args = array() ) {

		$args = wp_parse_args(
			(array) $args,
			array(
				'active_tab'           => '',
				'tabs'                 => array(),
				'nav_container_id'     => self::NAV_CONTAINER_ID,
				'panels_root_id'       => '',
				'panels_root_selector' => '',
				'panel_base_class'     => self::DEFAULT_PANEL_BASE_CLASS,
			)
		);

		$tabs_config = ( ! empty( $args['tabs'] ) && is_array( $args['tabs'] ) ) ? $args['tabs'] : array();
		$active_tab  = self::resolve_active_tab_id( $tabs_config, (string) $args['active_tab'] );

		$nav_container_id = sanitize_html_class( (string) $args['nav_container_id'] );
		if ( '' === $nav_container_id ) {
			$nav_container_id = self::NAV_CONTAINER_ID;
		}

		$panel_base_class = sanitize_html_class( (string) $args['panel_base_class'] );
		if ( '' === $panel_base_class ) {
			$panel_base_class = self::DEFAULT_PANEL_BASE_CLASS;
		}

		$panels_root_selector = '';
		if ( ! empty( $args['panels_root_selector'] ) && is_string( $args['panels_root_selector'] ) ) {
			$panels_root_selector = trim( (string) $args['panels_root_selector'] );
		} elseif ( ! empty( $args['panels_root_id'] ) && is_string( $args['panels_root_id'] ) ) {
			$panels_root_selector = '#' . sanitize_html_class( (string) $args['panels_root_id'] );
		}

		echo '<div class="wpbc_ui_el__horis_top_bar__wrapper wpbc_bfb_ui__elements_hide_in_preview">';
		echo '<div'
			. ' id="' . esc_attr( $nav_container_id ) . '"'
			. ' class="wpbc_ui_el__horis_top_bar__content"'
			. ' data-wpbc-bfb-tabs-nav="1"'
			. ' data-active-tab="' . esc_attr( $active_tab ) . '"'
			. ' data-wpbc-bfb-panel-class="' . esc_attr( $panel_base_class ) . '"';

		if ( '' !== $panels_root_selector ) {
			echo ' data-wpbc-bfb-panels-root="' . esc_attr( $panels_root_selector ) . '"';
		}

		echo '>';

		do_action( 'wpbc_bfb_ui__top_horisontal_nav__start' );
		foreach ( $tabs_config as $tab_id => $tab_args ) {
			self::render_tab_item( $tab_id, $tab_args, $active_tab );
		}
		do_action( 'wpbc_bfb_ui__top_horisontal_nav__end' );

		echo '</div></div>';
	}

	private static function render_tab_item( $tab_id, $tab_args, $active_tab_id ) {

		$tab_id = sanitize_key( (string) $tab_id );

		$tab_args = wp_parse_args(
			(array) $tab_args,
			array(
				'title'       => '',
				'type'        => 'panel',
				'url'         => '',
				'css_classes' => '',
				'font_icon'   => '',
				'hint'        => array(),
				'data_attr'   => array(),
			)
		);

		$is_active = ( $tab_id === sanitize_key( (string) $active_tab_id ) );

		$wrapper_css  = 'wpbc_ui_el__horis_nav_item wpbc_ui_el__horis_nav_item__' . $tab_id;
		$wrapper_css .= ( '' !== $tab_args['css_classes'] ) ? ' ' . (string) $tab_args['css_classes'] : '';
		$wrapper_css .= $is_active ? ' active' : '';

		$href       = '#';
		$link_attrs = array();

		if ( 'url' === (string) $tab_args['type'] ) {
			$href = ( '' !== (string) $tab_args['url'] ) ? (string) $tab_args['url'] : '#';
		} else {
			$link_attrs['data-wpbc-bfb-action'] = 'panel';
			$link_attrs['data-wpbc-bfb-tab']    = $tab_id;
		}

		// Tooltip (optional).
		if ( ! empty( $tab_args['hint']['title'] ) ) {
			$link_attrs['title']             = $tab_args['hint']['title'];
			$link_attrs['data-original-title'] = $tab_args['hint']['title'];
		}

		// Extra attrs (data_attr).
		if ( ! empty( $tab_args['data_attr'] ) && is_array( $tab_args['data_attr'] ) ) {
			foreach ( $tab_args['data_attr'] as $attr_name => $attr_value ) {
				$link_attrs[ (string) $attr_name ] = $attr_value;
			}
		}

		$tooltip_pos_class = '';
		if ( ! empty( $tab_args['hint']['position'] ) ) {
			$tooltip_pos_class = ' tooltip_' . sanitize_key( (string) $tab_args['hint']['position'] );
		}

		?>
		<div class="<?php echo esc_attr( $wrapper_css ); ?>">
			<a href="<?php echo esc_url( $href ); ?>"
			   class="wpbc_ui_el__horis_nav_item__a wpbc_ui_el__horis_nav_item__single<?php echo esc_attr( $tooltip_pos_class ); ?>"
				<?php echo self::build_allowed_attr_string( $link_attrs ); /* phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped */ ?>
			>
				<?php if ( ! empty( $tab_args['font_icon'] ) ) { ?>
					<i class="wpbc_ui_el__horis_nav_icon tooltip_top menu_icon icon-1x <?php echo esc_attr( $tab_args['font_icon'] ); ?>"
					   data-original-title="<?php echo esc_attr( $tab_args['title'] ); ?>"></i>
				<?php } ?>
				<span class="wpbc_ui_el__horis_nav_title"><?php echo wp_kses_post( $tab_args['title'] ); ?></span>
			</a>
		</div>
		<?php
	}

	/**
	 * Build HTML attributes string from array, allowing only safe/expected attributes.
	 *
	 * Allowed:
	 * - data-*
	 * - aria-*
	 * - title
	 * - data-original-title
	 * - role
	 *
	 * Values are escaped with esc_attr().
	 * Empty values are skipped, except value "0" which is kept.
	 *
	 * @param array $attrs Attributes map.
	 *
	 * @return string Example: ` data-foo="1" aria-label="X"`.
	 */
	private static function build_allowed_attr_string( $attrs ) {

		if ( empty( $attrs ) || ! is_array( $attrs ) ) {
			return '';
		}

		$out = '';

		foreach ( $attrs as $name => $value ) {

			$name = is_scalar( $name ) ? trim( (string) $name ) : '';
			if ( '' === $name ) {
				continue;
			}

			// Allow only expected attribute namespaces.
			$is_allowed =
				( 0 === strpos( $name, 'data-' ) ) ||
				( 0 === strpos( $name, 'aria-' ) ) ||
				( 'title' === $name ) ||
				( 'data-original-title' === $name ) ||
				( 'role' === $name );

			if ( ! $is_allowed ) {
				continue;
			}

			// Validate name characters (basic HTML attribute name safety).
			if ( ! preg_match( '/^[a-zA-Z_:][a-zA-Z0-9:._-]*$/', $name ) ) {
				continue;
			}

			// Boolean attribute support (true => render as name="name" or just name).
			// Here we keep it simple: true => name="1".
			if ( true === $value ) {
				$out .= ' ' . $name . '="1"';
				continue;
			}

			// Skip null/empty (but keep "0").
			if ( null === $value ) {
				continue;
			}

			$value = is_scalar( $value ) ? (string) $value : '';
			if ( '' === $value && '0' !== $value ) {
				continue;
			}

			$out .= ' ' . $name . '="' . esc_attr( $value ) . '"';
		}

		return $out;
	}
}
