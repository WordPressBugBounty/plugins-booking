<?php
/**
 * Common right sidebar panels and collapsible group render helpers.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Shared markup helpers for Builder-style right sidebar panels.
 */
class WPBC_UI_Sidebar_Panels {

	/**
	 * Render compact right sidebar tabs.
	 *
	 * @param array $tabs Tabs definitions.
	 * @param array $args Render arguments.
	 *
	 * @return void
	 */
	public static function render_rightbar_tabs( $tabs, $args = array() ) {

		$defaults = array(
			'aria_label' => __( 'Sidebar Panels', 'booking' ),
			'context'    => 'common',
			'class'      => '',
		);
		$args     = wp_parse_args( $args, $defaults );
		$class    = trim( 'wpbc_bfb__rightbar_tabs ' . $args['class'] );
		$context  = sanitize_html_class( $args['context'] );
		?>
		<div class="<?php echo esc_attr( $class ); ?>" role="tablist" aria-label="<?php echo esc_attr( $args['aria_label'] ); ?>">
			<?php foreach ( $tabs as $tab ) : ?>
				<?php
				$tab = wp_parse_args(
					$tab,
					array(
						'id'       => '',
						'panel_id' => '',
						'title'    => '',
						'icon'     => 'wpbc_icn_tune',
						'selected' => false,
						'hidden'   => false,
						'class'    => '',
					)
				);
				?>
				<div class="wpbc_ui_el__level__folder <?php echo $tab['hidden'] ? 'wpbc_bfb__rightbar_tab_wrap' : ''; ?>" <?php echo $tab['hidden'] ? 'hidden' : ''; ?>>
					<div class="wpbc_ui_el__vert_nav_item wpbc_ui_el__vert_nav_item__<?php echo esc_attr( $context ); ?>">
						<button type="button" id="<?php echo esc_attr( $tab['id'] ); ?>"
								class="wpbc_ui_el__vert_nav_item__a wpbc_ui_el__vert_nav_item__single <?php echo esc_attr( $tab['class'] ); ?>"
								role="tab"
								aria-controls="<?php echo esc_attr( $tab['panel_id'] ); ?>"
								aria-selected="<?php echo $tab['selected'] ? 'true' : 'false'; ?>">
							<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x <?php echo esc_attr( $tab['icon'] ); ?>"
								aria-hidden="true"
								data-original-title="<?php echo esc_attr( $tab['title'] ); ?>"></i>
							<span><?php echo esc_html( $tab['title'] ); ?></span>
						</button>
					</div>
				</div>
			<?php endforeach; ?>
		</div>
		<?php
	}

	/**
	 * Render a tab panel.
	 *
	 * @param array         $args Panel arguments.
	 * @param callable|null $callback Content callback.
	 *
	 * @return void
	 */
	public static function render_panel( $args, $callback = null ) {

		$args = wp_parse_args(
			$args,
			array(
				'id'            => '',
				'labelledby'    => '',
				'class'         => '',
				'hidden'        => false,
				'body_class'    => '',
				'use_body_wrap' => false,
			)
		);
		$class = trim( $args['class'] . ' wpbc_bfb__palette_panel wpbc_collapsible wpbc_collapsible--exclusive' );
		?>
		<div id="<?php echo esc_attr( $args['id'] ); ?>"
				class="<?php echo esc_attr( $class ); ?>"
				role="tabpanel"
				aria-labelledby="<?php echo esc_attr( $args['labelledby'] ); ?>"
				<?php echo $args['hidden'] ? 'hidden' : ''; ?>
				aria-hidden="<?php echo $args['hidden'] ? 'true' : 'false'; ?>">
			<?php if ( $args['use_body_wrap'] ) : ?>
				<div class="<?php echo esc_attr( trim( 'wpbc_bfb__inspector__body ' . $args['body_class'] ) ); ?>">
			<?php endif; ?>
			<?php
			if ( is_callable( $callback ) ) {
				call_user_func( $callback );
			}
			?>
			<?php if ( $args['use_body_wrap'] ) : ?>
				</div>
			<?php endif; ?>
		</div>
		<?php
	}

	/**
	 * Render a Builder-style inspector header.
	 *
	 * @param string $title Header title.
	 * @param string $description Header description.
	 *
	 * @return void
	 */
	public static function render_inspector_header( $title, $description = '' ) {
		?>
		<div class="wpbc_bfb__inspector__head">
			<div class="header_container">
				<div class="header_title_content">
					<h3 class="title"><?php echo esc_html( $title ); ?></h3>
					<?php if ( '' !== $description ) : ?>
						<div class="desc"><?php echo esc_html( $description ); ?></div>
					<?php endif; ?>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Render a common collapsible group.
	 *
	 * @param array         $args Group arguments.
	 * @param callable|null $callback Content callback.
	 *
	 * @return void
	 */
	public static function render_collapsible_group( $args, $callback = null ) {

		$args = wp_parse_args(
			$args,
			array(
				'id'     => '',
				'group'  => '',
				'title'  => '',
				'open'   => false,
				'class'  => '',
				'fields' => '',
			)
		);

		$panel_id = $args['id'] ? $args['id'] : wp_unique_id( 'wpbc_collapsible_panel_' );
		$class    = trim( 'wpbc_bfb__inspector__group wpbc_ui__collapsible_group ' . ( $args['open'] ? 'is-open ' : '' ) . $args['class'] );
		?>
		<section class="<?php echo esc_attr( $class ); ?>" data-group="<?php echo esc_attr( $args['group'] ); ?>">
			<button type="button"
					class="group__header"
					role="button"
					aria-expanded="<?php echo $args['open'] ? 'true' : 'false'; ?>"
					aria-controls="<?php echo esc_attr( $panel_id ); ?>">
				<h3><?php echo esc_html( $args['title'] ); ?></h3>
				<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
			</button>
			<div class="group__fields"
					id="<?php echo esc_attr( $panel_id ); ?>"
					<?php echo $args['open'] ? '' : 'hidden'; ?>
					aria-hidden="<?php echo $args['open'] ? 'false' : 'true'; ?>">
				<?php
				if ( is_callable( $callback ) ) {
					call_user_func( $callback );
				} elseif ( '' !== $args['fields'] ) {
					echo wp_kses_post( $args['fields'] );
				}
				?>
			</div>
		</section>
		<?php
	}
}
