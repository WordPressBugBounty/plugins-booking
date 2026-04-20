<?php
/**
 * Shared helpers for generic BFB hint shortcode field packs.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Check whether the configured pack requirement is available.
 *
 * @param array $cfg Pack config.
 *
 * @return bool
 */
function wpbc_bfb_hint_shortcode_is_supported( $cfg ) {

	return empty( $cfg['required_class'] ) || class_exists( $cfg['required_class'] );
}

/**
 * Register a generic hint shortcode field pack.
 *
 * @param array $packs Accumulated packs.
 * @param array $cfg   Pack config.
 *
 * @return array
 */
function wpbc_bfb_hint_shortcode_register_pack( $packs, $cfg ) {

	$packs[ $cfg['token'] ] = array(
		'kind'      => 'field',
		'type'      => $cfg['token'],
		'label'     => '',
		'icon'      => $cfg['icon'],
		'usage_key' => $cfg['token'],

		'schema'    => array(
			'props' => array(
				'prefix_text' => array( 'type' => 'string', 'default' => $cfg['prefix'] ),
				'html_id'     => array( 'type' => 'string', 'default' => '' ),
				'cssclass'    => array( 'type' => 'string', 'default' => '' ),
				'help'        => array( 'type' => 'string', 'default' => '' ),
			),
		),

		'templates_printer' => $cfg['templates_printer'],
	);

	return $packs;
}

/**
 * Enqueue a generic hint shortcode pack script.
 *
 * @param string $page Current admin page slug.
 * @param array  $cfg  Pack config.
 *
 * @return void
 */
function wpbc_bfb_hint_shortcode_enqueue_js( $page, $cfg ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	wp_enqueue_script(
		'wpbc-bfb_hint_shortcode_wptpl_shared',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/_shared/_out/hint-shortcode-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_enqueue_script(
		$cfg['handle'],
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/' . $cfg['folder'] . '/_out/' . $cfg['script_file'] ),
		array( 'wpbc-bfb_hint_shortcode_wptpl_shared' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		$cfg['handle'],
		$cfg['boot_var'],
		array(
			'is_supported' => wpbc_bfb_hint_shortcode_is_supported( $cfg ) ? 1 : 0,
			'upgrade_text' => $cfg['upgrade_text'],
			'preview_value' => $cfg['preview_value'],
		)
	);
}

/**
 * Print wp.template() blocks for a generic hint shortcode pack.
 *
 * @param string $page Current admin page slug.
 * @param array  $cfg  Pack config.
 *
 * @return void
 */
function wpbc_bfb_hint_shortcode_print_templates( $page, $cfg ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	$token             = $cfg['token'];
	$shortcode_display = $cfg['shortcode_display'];
	$template_id       = 'wpbc-bfb-field-' . $token;
	$inspector_id      = 'wpbc-bfb-inspector-' . $token;
	$exported          = sprintf(
		/* translators: 1: Field prefix text. 2: Shortcode text. */
		__( 'Exported output: %1$s <strong>[%2$s]</strong>', 'booking' ),
		$cfg['prefix'],
		$shortcode_display
	);

	?>
	<script type="text/html" id="tmpl-<?php echo esc_attr( $template_id ); ?>">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<span class="wpbc_bfb__<?php echo esc_attr( $token ); ?>_line {{ data.cssclass || '' }}"
				  <# if ( data.html_id ) { #> id="{{ data.html_id }}" <# } #>>
				<# if ( data.prefix_text ) { #>
					<span class="wpbc_bfb__<?php echo esc_attr( $token ); ?>_prefix">{{ data.prefix_text }}</span>
				<# } #>
				<# if ( data.prefix_text ) { #>&nbsp;<# } #>
				<strong class="wpbc_bfb__<?php echo esc_attr( $token ); ?>_shortcode">{{{ data.preview_value || '<?php echo esc_js( $cfg['preview_value'] ); ?>' }}}</strong>
			</span>

			<# if ( ! data.is_supported && data.upgrade_text ) { #>
				<div class="wpbc_bfb__help">
					{{ data.upgrade_text }}
				</div>
			<# } #>

			<# if ( data.help ) { #>
				<div class="wpbc_bfb__help">{{ data.help }}</div>
			<# } #>
		</span>
	</script>

	<script type="text/html" id="tmpl-<?php echo esc_attr( $inspector_id ); ?>">
		<div class="wpbc_bfb__inspector__head">
			<div class="header_container">
				<div class="header_title_content">
					<h3 class="title"><?php echo esc_html( $cfg['inspector_title'] ); ?></h3>
					<div class="desc">
						<?php echo esc_html( $cfg['description'] ); ?>
					</div>
				</div>
				<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
					<div class="ui_container ui_container_small">
						<div class="ui_group">
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="deselect" aria-label="<?php echo esc_attr__( 'Deselect', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_remove_done"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="scrollto" aria-label="<?php echo esc_attr__( 'Scroll to field', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
								</button>
							</div>
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="move-up" aria-label="<?php echo esc_attr__( 'Move up', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="move-down" aria-label="<?php echo esc_attr__( 'Move down', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
								</button>
							</div>
							<div class="ui_element">
								<button data-action="delete"
										aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>"
										type="button"
										class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete">
									<span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;
									<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="wpbc_bfb__inspector__body">
			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="basic">
				<button type="button" class="group__header">
					<h3><?php echo esc_html__( 'Basic', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Text before shortcode', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text"
								   class="inspector__input"
								   data-inspector-key="prefix_text"
								   value="{{ data.prefix_text || '<?php echo esc_js( $cfg['prefix'] ); ?>' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Help text', 'booking' ); ?></label>
						<div class="inspector__control">
							<textarea class="inspector__textarea" rows="3" data-inspector-key="help">{{ data.help || '' }}</textarea>
						</div>
					</div>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="appearance">
				<button type="button" class="group__header">
					<h3><?php echo esc_html__( 'Appearance', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'CSS class', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text"
								   class="inspector__input"
								   data-inspector-key="cssclass"
								   value="{{ data.cssclass || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'HTML ID', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text"
								   class="inspector__input"
								   data-inspector-key="html_id"
								   value="{{ data.html_id || '' }}">
						</div>
					</div>

					<div class="wpbc_bfb__inspector__note">
						<?php echo esc_html( $exported ); ?>
					</div>

					<?php if ( ! empty( $cfg['upgrade_text'] ) ) { ?>
					<div class="wpbc_bfb__inspector__note">
						<?php echo esc_html( $cfg['upgrade_text'] ); ?>
					</div>
					<?php } ?>
				</div>
			</section>
		</div>
	</script>
	<?php
}

/**
 * Print a generic hint shortcode palette item.
 *
 * @param string $group    Palette group.
 * @param string $position Position.
 * @param array  $cfg      Pack config.
 *
 * @return void
 */
function wpbc_bfb_hint_shortcode_palette_item( $group, $position, $cfg ) {

	if ( 'hints' !== $group || 'top' !== $position ) {
		return;
	}

	?>
	<li class="wpbc_bfb__field"
		data-id="<?php echo esc_attr( $cfg['token'] ); ?>"
		data-type="<?php echo esc_attr( $cfg['token'] ); ?>"
		data-usage_key="<?php echo esc_attr( $cfg['token'] ); ?>"
		data-prefix_text="<?php echo esc_attr( $cfg['prefix'] ); ?>"
		data-help=""
		data-label="">
		<i class="menu_icon icon-1x <?php echo esc_attr( $cfg['palette_icon'] ); ?>"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( $cfg['palette_label'] ); ?></span>
		<?php
		if ( ! wpbc_bfb_hint_shortcode_is_supported( $cfg ) && ! empty( $cfg['pro_label'] ) ) {
			echo '<span class="wpbc_pro_label">' . esc_html( $cfg['pro_label'] ) . '</span>';
		}
		?>
		<span class="wpbc_bfb__field-type">[<?php echo esc_html( $cfg['shortcode_display'] ); ?>]</span>
	</li>
	<?php
}
