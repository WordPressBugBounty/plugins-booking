<?php
/**
 * WPBC BFB Pack: Booking Resource Info Hint.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Get pack config.
 *
 * @return array
 */
function wpbc_bfb_field_bookingresource_info_wptpl_config() {

	return array(
		'token'           => 'bookingresource_info_hint',
		'prefix'          => __( 'Resource:', 'booking' ),
		'palette_label'   => __( 'Booking Resource Info', 'booking' ),
		'inspector_title' => __( 'Booking Resource Info Hint', 'booking' ),
		'description'     => __( 'Shows selected booking resource information inside the form using the [bookingresource show=\'...\'] shortcode.', 'booking' ),
		'folder'          => 'hint-bookingresource_info',
		'script_file'     => 'field-bookingresource-info-wptpl.js',
		'handle'          => 'wpbc-bfb_field_bookingresource_info_wptpl',
		'boot_var'        => 'WPBC_BFB_Bookingresource_Info_Boot',
		'group'             => 'hints_other',
	);
}

/**
 * Get sample values for the Booking Resource Info hint preview.
 *
 * @return array
 */
function wpbc_bfb_field_bookingresource_info_preview_values() {

	$cost = function_exists( 'wpbc_bfb_hint_cost_like_preview_value' )
		? wpbc_bfb_hint_cost_like_preview_value( 75, '$ 75.00' )
		: '$ 75.00';

	return array(
		'id'    => '3',
		'title' => __( 'Standard Room', 'booking' ),
		'cost'  => $cost,
	);
}

/**
 * Register the "bookingresource_info_hint" field pack.
 *
 * @param array $packs Accumulated packs.
 *
 * @return array
 */
function wpbc_bfb_register_field_packs__field_bookingresource_info_wptpl( $packs ) {

	$cfg = wpbc_bfb_field_bookingresource_info_wptpl_config();

	$packs[ $cfg['token'] ] = array(
		'kind'      => 'field',
		'type'      => $cfg['token'],
		'label'     => '',
		'icon'      => 'wpbc-bi-house-door',
		'usage_key' => $cfg['token'],

		'schema'    => array(
			'props' => array(
				'prefix_text'   => array( 'type' => 'string', 'default' => $cfg['prefix'] ),
				'resource_show' => array( 'type' => 'string', 'default' => 'title' ),
				'html_id'       => array( 'type' => 'string', 'default' => '' ),
				'cssclass'      => array( 'type' => 'string', 'default' => '' ),
				'help'          => array( 'type' => 'string', 'default' => '' ),
			),
		),

		'templates_printer' => 'wpbc_bfb_field_bookingresource_info_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_bookingresource_info_wptpl' );

/**
 * Enqueue the Booking Resource Info Hint pack JS for the Builder page.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_bookingresource_info_wptpl_js( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	$cfg = wpbc_bfb_field_bookingresource_info_wptpl_config();

	wp_enqueue_script(
		$cfg['handle'],
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/' . $cfg['folder'] . '/_out/' . $cfg['script_file'] ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		$cfg['handle'],
		$cfg['boot_var'],
		array(
			'is_supported'      => class_exists( 'wpdev_bk_personal' ) ? 1 : 0,
			'is_cost_supported' => class_exists( 'wpdev_bk_biz_s' ) ? 1 : 0,
			'upgrade_text'      => __( 'This hint is available only in Booking Calendar Pro versions.', 'booking' ),
			'cost_upgrade_text' => __( 'Resource Cost is available only in Booking Calendar Business Small or higher versions.', 'booking' ),
			'preview_values'    => wpbc_bfb_field_bookingresource_info_preview_values(),
		)
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_bookingresource_info_wptpl_js', 10, 1 );

/**
 * Print wp.template() blocks for the Booking Resource Info Hint field.
 *
 * @param string $page Current page slug.
 *
 * @return void
 */
function wpbc_bfb_field_bookingresource_info_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	$cfg = wpbc_bfb_field_bookingresource_info_wptpl_config();

	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-bookingresource_info_hint">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<#
			var show = [ 'id', 'title', 'cost' ].indexOf( data.resource_show ) > -1 ? data.resource_show : 'title';
			var values = data.preview_values || {};
			var preview_value = values[ show ] || '';
			#>
			<span class="wpbc_bfb__bookingresource_info_hint_line {{ data.cssclass || '' }}"
				  <# if ( data.html_id ) { #> id="{{ data.html_id }}" <# } #>>
				<# if ( data.prefix_text ) { #>
					<span class="wpbc_bfb__bookingresource_info_hint_prefix">{{ data.prefix_text }}</span>
				<# } #>
				<# if ( data.prefix_text ) { #>&nbsp;<# } #>
				<strong class="wpbc_bfb__bookingresource_info_hint_shortcode">{{ preview_value }}</strong>
			</span>

			<# if ( ! data.is_supported && data.upgrade_text ) { #>
				<div class="wpbc_bfb__help">
					{{ data.upgrade_text }}
				</div>
			<# } #>

			<# if ( 'cost' === show && ! data.is_cost_supported && data.cost_upgrade_text ) { #>
				<div class="wpbc_bfb__help">
					{{ data.cost_upgrade_text }}
				</div>
			<# } #>

			<# if ( data.help ) { #>
				<div class="wpbc_bfb__help">{{ data.help }}</div>
			<# } #>
		</span>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-bookingresource_info_hint">
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

		<div class="wpbc_bfb__inspector__body wpbc_bfb__inspector_bookingresource_info">
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
						<label class="inspector__label"><?php echo esc_html__( 'Show', 'booking' ); ?></label>
						<div class="inspector__control">
							<#
							var show = [ 'id', 'title', 'cost' ].indexOf( data.resource_show ) > -1 ? data.resource_show : 'title';
							#>
							<input type="hidden" class="inspector__input js-bookingresource-show-value" data-inspector-key="resource_show" value="{{ show }}">
							<div class="wpbc_bfb__radio-group" role="radiogroup">
								<label class="wpbc_bfb__radio-item">
									<input type="radio" class="js-bookingresource-show-radio" name="wpbc_bfb_bookingresource_show" value="id" <# if ( 'id' === show ) { #> checked <# } #>>
									<span class="wpbc_bfb__radio-label"><?php echo esc_html__( 'Resource ID', 'booking' ); ?></span>
								</label>
								<label class="wpbc_bfb__radio-item">
									<input type="radio" class="js-bookingresource-show-radio" name="wpbc_bfb_bookingresource_show" value="title" <# if ( 'title' === show ) { #> checked <# } #>>
									<span class="wpbc_bfb__radio-label"><?php echo esc_html__( 'Resource Title', 'booking' ); ?></span>
								</label>
								<label class="wpbc_bfb__radio-item">
									<input type="radio" class="js-bookingresource-show-radio" name="wpbc_bfb_bookingresource_show" value="cost" <# if ( 'cost' === show ) { #> checked <# } #>>
									<span class="wpbc_bfb__radio-label"><?php echo esc_html__( 'Resource Cost', 'booking' ); ?></span>
									<?php
									if ( ! class_exists( 'wpdev_bk_biz_s' ) ) {
										echo '<span class="wpbc_pro_label">BS+</span>';
									}
									?>
								</label>
							</div>
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

					<div class="wpbc_bfb__inspector__note js-bookingresource-export-note">
						<?php echo esc_html__( 'Exported output: Resource: <strong>[bookingresource show=\'title\']</strong>', 'booking' ); ?>
					</div>

					<div class="wpbc_bfb__inspector__note">
						<?php echo esc_html__( 'Booking Resource Info is available only in Booking Calendar Pro versions. Resource Cost requires Business Small or higher.', 'booking' ); ?>
					</div>
				</div>
			</section>
		</div>
	</script>
	<?php
}

/**
 * Register the "Booking Resource Info" palette item inside the "Hints" section.
 *
 * @param string $group    Palette group.
 * @param string $position Position.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__bookingresource_info_wptpl( $group, $position ) {

	if ( 'hints_other' !== $group || 'top' !== $position ) {
		return;
	}

	$preview_values = wpbc_bfb_field_bookingresource_info_preview_values();

	?>
	<li class="wpbc_bfb__field"
		data-id="bookingresource_info_hint"
		data-type="bookingresource_info_hint"
		data-usage_key="bookingresource_info_hint"
		data-prefix_text="<?php echo esc_attr__( 'Resource:', 'booking' ); ?>"
		data-resource_show="title"
		data-help=""
		data-label="">
		<i class="menu_icon icon-1x wpbc-bi-house-door"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html__( 'Booking Resource Info', 'booking' ); ?></span>
		<?php
		if ( ! class_exists( 'wpdev_bk_personal' ) ) {
			echo '<span class="wpbc_pro_label">Pro</span>';
		}
		?>
		<span class="wpbc_bfb__field-type"><?php echo esc_html( $preview_values['title'] ); ?></span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__bookingresource_info_wptpl', 10, 2 );
