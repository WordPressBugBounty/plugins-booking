<?php
/**
 * WPBC BFB Pack: Section (WP-template–driven) — with reusable “Style” Inspector (per-column)
 *
 * - Adds a shared Inspector "Style" panel to control per-column flex layout (direction/wrap/justify/align/gap).
 * - Values are stored in section props as JSON string (key: col_styles) for reliable serialization.
 * - Preview applies styles via CSS custom properties on each column (safe, extendable, themable).
 *
 * File:  ../includes/page-form-builder/field-packs/section/section-wptpl.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @modified  2025-09-16 11:24
 * @version   1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "section" pack with schema extended by col_styles (JSON string).
 *
 * @param array $packs Accumulated packs from other modules.
 *
 * @return array
 */
function wpbc_bfb_register_field_packs__section_wptpl( $packs ) {

	$packs['section'] = array(
		'kind'      => 'section',
		'type'      => 'section',
		'label'     => __( 'Section', 'booking' ),
		'icon'      => 'wpbc_icn_view_quilt',
		'usage_key' => 'section',

		// Schema: add 'col_styles' as JSON string (per-column style map).
		'schema'    => array(
			'props' => array(
				'columns'    => array(
					'type'    => 'number',
					'default' => 1,
					'min'     => 1,
					'max'     => 4,
					'step'    => 1,
				),
				'cssclass'   => array(
					'type'    => 'string',
					'default' => '',
				),
				'html_id'    => array(
					'type'    => 'string',
					'default' => '',
				),
				'id'         => array(
					'type'    => 'string',
					'default' => '',
				),
				'label'      => array(
					'type'    => 'string',
					'default' => __( 'Section', 'booking' ),
				),

				// NEW: Per-column flex style settings (JSON string; see JS for structure).
				'col_styles' => array(
					'type'    => 'string',
					'default' => '',
				),
			),
		),

		'templates_printer' => 'wpbc_bfb_section_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__section_wptpl' );


/**
 * Enqueue the section pack JS (renderer + style inspector slot).
 *
 * @param string $page Current admin page slug.
 */
function wpbc_bfb_enqueue__section_wptpl_js( $page ) {
	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}
	wp_enqueue_script( 'wpbc-bfb_section_wptpl', wpbc_plugin_url( '/includes/page-form-builder/field-packs/section/_out/section-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ), WP_BK_VERSION_NUM, true );
	wp_enqueue_script( 'wpbc-bfb_section_column_styles', wpbc_plugin_url( '/includes/page-form-builder/field-packs/section/_out/ui-column-styles.js' ),
		array( 'wpbc-bfb_section_wptpl' ), WP_BK_VERSION_NUM, true );
	wp_enqueue_script( 'wpbc-bfb_section_inspector_patch', wpbc_plugin_url( '/includes/page-form-builder/field-packs/section/_out/bfb-inspector-patches.js' ),
		array( 'wpbc-bfb_section_wptpl' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__section_wptpl_js', 10, 1 );


/**
 * wp.template() blocks.
 * - Adds new Inspector "Style" group with a reusable slot 'column_styles' (rendered by JS).
 *
 * @param string $page Current admin page slug.
 */
function wpbc_bfb_section_wptpl_print_templates( $page ) {
	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	} ?>
	<script type="text/html" id="tmpl-wpbc-bfb-section">
		<div class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<# var cols = parseInt( data.columns || 1, 10 ); if ( ! Number.isFinite(cols) || cols < 1 ) { cols = 1; } if ( cols > 4 ) { cols = 4; } #>

			<# if ( data.label ) { #>
				<div class="wpbc_bfb__section__title">{{ data.label }}</div>
			<# } #>

			<div class="wpbc_bfb__section__summary">
				<span class="wpbc_bfb__badge">{{ cols }} <?php echo esc_html__( 'columns', 'booking' ); ?></span>
				<# if ( data.cssclass ) { #><span class="wpbc_bfb__badge wpbc_bfb__badge--muted">{{ data.cssclass }}</span><# } #>
			</div>

			<div class="wpbc_bfb__section__cols" aria-label="<?php echo esc_attr__( 'Section columns preview', 'booking' ); ?>">
				<# for ( var i = 0; i < cols; i++ ) { #>
					<div class="wpbc_bfb__section__col"><span class="ghost"><?php echo esc_html__( 'Drop fields here', 'booking' ); ?></span></div>
				<# } #>
			</div>
		</div>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-section">
		<# var uid = (Math.random().toString(36).slice(2,8));
		   var sel = (window.wpbc_bfb_api && typeof window.wpbc_bfb_api.get_selection_el === 'function') ? window.wpbc_bfb_api.get_selection_el() : null;
		   var d = sel && sel.dataset ? sel.dataset : {};
		   var initCols = 1;
		   try {
			   var row = sel ? sel.querySelector(':scope > .wpbc_bfb__row') : null;
			   initCols = row ? row.querySelectorAll(':scope > .wpbc_bfb__column').length : 1;
			   if ( ! Number.isFinite(initCols) || initCols < 1 ) initCols = 1;
			   if ( initCols > 4 ) initCols = 4;
		   } catch(e){ initCols = 1; }
		   var labelV    = (d && d.label)    ? d.label    : '<?php echo esc_js( __( 'Section', 'booking' ) ); ?>';
		   var cssclassV = (d && d.cssclass) ? d.cssclass : '';
		   var htmlIdV   = (d && d.html_id)  ? d.html_id  : '';
		   var internalV = (d && d.id)       ? d.id       : '';
		#>

		<div class="wpbc_bfb__inspector__head">
			<div class="header_container">
				<div class="header_title_content">
					<h3 class="title"><?php echo esc_html__( 'Section', 'booking' ); ?></h3>
					<div class="desc"><?php echo esc_html__( 'Layout container with columns.', 'booking' ); ?></div>
				</div>
				<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
					<div class="ui_container ui_container_small">
						<div class="ui_group">
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="deselect" aria-label="<?php echo esc_attr__( 'Deselect', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_remove_done"></i></button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="scrollto" aria-label="<?php echo esc_attr__( 'Scroll to section', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i></button>
							</div>
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-up" aria-label="<?php echo esc_attr__( 'Move up', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i></button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-down" aria-label="<?php echo esc_attr__( 'Move down', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i></button>
							</div>
							<div class="ui_element">
								<button data-action="duplicate" aria-label="<?php echo esc_attr__( 'Duplicate', 'booking' ); ?>" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"><i class="menu_icon icon-1x wpbc_icn_content_copy"></i></button>
								<button data-action="delete" aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete"><span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="wpbc_bfb__inspector__body">

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="layout">
				<button type="button" class="group__header" role="button" aria-expanded="true" aria-controls="wpbc_collapsible_panel_{{ uid }}_layout">
					<h3><?php echo esc_html__( 'Layout', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields" id="wpbc_collapsible_panel_{{ uid }}_layout" aria-hidden="false">
					<div class="inspector__row">
						<label class="inspector__label" for="wpbc_ins_columns_{{ uid }}"><?php echo esc_html__( 'Columns Number', 'booking' ); ?></label>
						<div class="inspector__control">
							<div class="wpbc_len_group wpbc_inline_inputs" data-len-group="columns-number">
								<input type="range" class="inspector__input" data-len-range min="1" max="4" step="1" value="{{ initCols }}" >
								<input data-len-value id="wpbc_ins_columns_{{ uid }}" type="number" class="inspector__input inspector__w_30" data-inspector-key="columns" min="1" max="4" step="1" value="{{ initCols }}" >
							</div>
						</div>
					</div>

					<div class="inspector__row inspector__row--layout-chips">
						<label class="inspector__label"><?php echo esc_html__( 'Layout', 'booking' ); ?></label>
						<div class="inspector__control">
							<div class="wpbc_bfb__layout_chips" data-bfb-slot="layout_chips" id="wpbc_bfb__layout_chips_host"></div>
						</div>
					</div>
				</div>
				<div id="wpbc_collapsible_panel_{{ uid }}_style" aria-hidden="true" class="group__content">
					<div class="wpbc_bfb__column_styles_host" data-bfb-slot="column_styles"></div><!-- Slot host: rendered by JS shared component UI.wpbc_bfb_column_styles -->
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="appearance">
				<button type="button" class="group__header" role="button" aria-expanded="false" aria-controls="wpbc_collapsible_panel_{{ uid }}_appearance">
					<h3><?php echo esc_html__( 'Advanced', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields" id="wpbc_collapsible_panel_{{ uid }}_appearance" aria-hidden="true">
					<div class="inspector__row">
						<label class="inspector__label" for="wpbc_ins_cssclass_{{ uid }}"><?php echo esc_html__( 'CSS class', 'booking' ); ?></label>
						<div class="inspector__control"><input id="wpbc_ins_cssclass_{{ uid }}" type="text" class="inspector__input" data-inspector-key="cssclass" value="{{ cssclassV }}"></div>
					</div>
					<div class="inspector__row">
						<label class="inspector__label" for="wpbc_ins_htmlid_{{ uid }}"><?php echo esc_html__( 'HTML ID', 'booking' ); ?></label>
						<div class="inspector__control"><input id="wpbc_ins_htmlid_{{ uid }}" type="text" class="inspector__input" data-inspector-key="html_id" value="{{ htmlIdV }}"></div>
					</div>
				</div>
			</section>
<?php /* ?>
			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="attributes">
				<button type="button" class="group__header" role="button" aria-expanded="false" aria-controls="wpbc_collapsible_panel_{{ uid }}_attributes">
					<h3><?php echo esc_html__( 'Attributes', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields" id="wpbc_collapsible_panel_{{ uid }}_attributes" aria-hidden="true">
					<div class="inspector__row">
						<label class="inspector__label" for="wpbc_ins_internalid_{{ uid }}"><?php echo esc_html__( 'Internal ID', 'booking' ); ?></label>
						<div class="inspector__control"><input id="wpbc_ins_internalid_{{ uid }}" type="text" class="inspector__input" data-inspector-key="id" value="{{ internalV }}"></div>
					</div>
					<div class="inspector__row">
						<label class="inspector__label" for="wpbc_ins_label_{{ uid }}"><?php echo esc_html__( 'Label', 'booking' ); ?></label>
						<div class="inspector__control"><input id="wpbc_ins_label_{{ uid }}" type="text" class="inspector__input" data-inspector-key="label" value="{{ labelV }}"></div>
					</div>
				</div>
			</section>
<?php */ ?>
		</div>
	</script>
	<?php
	// Reuse it Anywhere , where  already have:.
    // <div class="wpbc_bfb__column_styles_host" data-bfb-slot="column_styles"></div>
 	// and  inspector glue calls:
	// UI.wpbc_bfb_column_styles.render_for_section(builder, section_el, host)
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-column-styles">
		<# var cols   = data.cols || 1;
		   var styles = data.styles || [];
		   var active = !! data.active;
		#>
		<div class="wpbc_ui_tabs_root" data-wpbc-tabs="column-styles" data-wpbc-tab-active="1" >
			<!-- Header Tabs -->
			<div class=" wpbc_ui_el__horis_top_bar__wrapper" data-wpbc-tablist  role="tablist">
				<div class="wpbc_ui_el__horis_top_bar__content">
					<h2 class="wpbc_ui_el__horis_nav_label" ><?php echo esc_html__( 'Column', 'booking' ); ?>:</h2>
					<# for ( var i = 0; i < cols; i++ ) {  var is_first = ( i === 0 ); var k = String( i + 1 ); #>
						<div class="wpbc_ui_el__horis_nav_item wpbc_ui_el__horis_nav_item__{{ k }}">
							<a href="javascript:void(0);"
							   class="wpbc_ui_el__horis_nav_item__a wpbc_ui_el__horis_nav_item__single"
							   data-wpbc-tab-key="{{ k }}"
							   id="wpbc_tab_col_{{ k }}"
							   title="<?php echo esc_attr__( 'Column', 'booking' ); ?> {{ k }}"
							   <# if ( is_first ) { #> aria-selected="true" <# } #>
								role="tab"
								tabindex="<# if ( is_first ) { #>0<# } else { #>-1<# } #>"
								aria-controls="wpbc_tab_panel_col_{{ k }}">
								<span class="wpbc_ui_el__horis_nav_title">{{ k }}</span>
							</a>
						</div>
					<# } #>
				</div>
			</div>
			<!-- Tabs Content -->
			<# for ( var i = 0; i < cols; i++ ) {
				var k = String(i + 1);
				var s = styles[i] || {};
				var is_first = (i === 0);

				// Radio group names per column:
				var __name_layout_combo = 'bfb_col_' + k + '_layout_combo';

				var __name_dir   = 'bfb_col_' + k + '_dir';
				var __name_wrap  = 'bfb_col_' + k + '_wrap';
				var __name_jc    = 'bfb_col_' + k + '_jc';
				var __name_ai    = 'bfb_col_' + k + '_ai';
				var __name_aself = 'bfb_col_' + k + '_aself';

				// use merged defaults already in s.*
				var val_dir   = String(s.dir);
				var val_wrap  = String(s.wrap);
				var val_jc    = String(s.jc);
				var val_ai    = String(s.ai);
				var val_aself = String(s.aself);

				// labels depend on actual value (no fallback needed)
				var __isRow = (val_dir.indexOf('row') === 0);
				var __main_label  = __isRow ? '<?php echo esc_js( __( 'Horizontally', 'booking' ) ); ?>'
										  : '<?php echo esc_js( __( 'Vertically', 'booking' ) ); ?>';
				var __cross_label = __isRow ? '<?php echo esc_js( __( 'Vertically', 'booking' ) ); ?>'
										  : '<?php echo esc_js( __( 'Horizontally', 'booking' ) ); ?>';
			#>
				<div class="wpbc_tab__panel group__fields"
					 data-wpbc-tab-panel="{{ k }}"
					 id="wpbc_tab_panel_col_{{ k }}"
					 role="tabpanel"
					 aria-labelledby="wpbc_tab_col_{{ k }}"
					 <# if ( ! is_first ) { #> hidden <# } #>
				>
					<div class="inspector__row"><h2><?php echo esc_js( __( 'Arrange Items', 'booking' ) ); ?></h2></div>
					<!-- Combo Direction (dir + wrap in one control) -->
					<div class="inspector__row">
						<label class="inspector__label inspector__w_40"><?php echo esc_html__( 'Direction', 'booking' ); ?></label>
						<div class="inspector__control inspector__w_55">
							<div class="wpbc_bfb__choices" role="radiogroup" aria-label="<?php echo esc_attr__( 'Layout', 'booking' ); ?>">
								<input type="radio" class="inspector__input wpbc_sr_only"
									name="{{ __name_layout_combo }}"
									data-style-key="layout_combo"
									data-col-idx="{{ i }}"
									id="bfb_col_{{ k }}_layout_row_nowrap"
									value="row|nowrap"
									<# if ( ( val_dir === 'row' ) && ( val_wrap === 'nowrap' ) ) { #>checked<# } #>
								>
								<label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_layout_row_nowrap" title="<?php echo esc_attr__( 'Row', 'booking' ); ?>">
									<span aria-hidden="true"><i class="menu_icon icon-1x wpbc_icn_south wpbc_icn_rotate_270"></i></span>
									<span class="sr-only"><?php echo esc_html__( 'Row', 'booking' ); ?> + <?php echo esc_html__( 'No Wrap', 'booking' ); ?></span>
								</label>
								<input type="radio" class="inspector__input wpbc_sr_only"
									name="{{ __name_layout_combo }}"
									data-style-key="layout_combo"
									data-col-idx="{{ i }}"
									id="bfb_col_{{ k }}_layout_column_nowrap"
									value="column|nowrap"
									<# if ( ( val_dir === 'column' ) && ( val_wrap === 'nowrap' ) ) { #>checked<# } #>
								>
								<label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_layout_column_nowrap" title="<?php echo esc_attr__( 'Column', 'booking' ); ?>">
									<span aria-hidden="true"><i class="menu_icon icon-1x wpbc_icn_south"></i></span>
									<span class="sr-only"><?php echo esc_html__( 'Column', 'booking' ); ?> + <?php echo esc_html__( 'No Wrap', 'booking' ); ?></span>
								</label>
								<input type="radio" class="inspector__input wpbc_sr_only"
									name="{{ __name_layout_combo }}"
									data-style-key="layout_combo"
									data-col-idx="{{ i }}"
									id="bfb_col_{{ k }}_layout_row_wrap"
									value="row|wrap"
									<# if ( ( val_dir === 'row' ) && ( val_wrap === 'wrap' ) ) { #>checked<# } #>
								>
								<label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_layout_row_wrap" title="<?php echo esc_attr__( 'Row', 'booking' ) . ' | ' . esc_attr__( 'Wrap', 'booking' ); ?>">
									<span aria-hidden="true"><i class="menu_icon icon-1x wpbc_icn_u_turn_right wpbc_icn_rotate_90"></i></span>
									<span class="sr-only"><?php echo esc_html__( 'Row', 'booking' ); ?> | <?php echo esc_html__( 'Wrap', 'booking' ); ?></span>
								</label>
							</div>
						</div>
					</div>

<?php /* ?>

					<!-- Direction -->
					<div class="inspector__row">
						<label class="inspector__label inspector__w_40"><?php echo esc_html__( 'Direction', 'booking' ); ?></label>
						<div class="inspector__control inspector__w_50">
							<div class="wpbc_bfb__choices" role="radiogroup" aria-label="<?php echo esc_attr__( 'Direction', 'booking' ); ?>">
								<input 	type="radio" class="inspector__input wpbc_sr_only" name="{{ __name_dir }}" data-style-key="dir" data-col-idx="{{ i }}"
										id="bfb_col_{{ k }}_dir_row"
										value="row"
										<# if (val_dir === 'row') { #>checked<# } #> >
								<label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_dir_row" title="<?php echo esc_attr__( 'Row – horizontal', 'booking' ); ?>">
									<span aria-hidden="true"><i class="menu_icon icon-1x wpbc_icn_south wpbc_icn_rotate_270"></i></span><span class="sr-only"><?php echo esc_html__( 'Row', 'booking' ); ?></span>
								</label>

								<input 	type="radio" class="inspector__input wpbc_sr_only" name="{{ __name_dir }}" data-style-key="dir" data-col-idx="{{ i }}"
										id="bfb_col_{{ k }}_dir_column"
										value="column"
										<# if (val_dir === 'column') { #>checked<# } #> >
								<label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_dir_column" title="<?php echo esc_attr__( 'Column – vertical', 'booking' ); ?>">
									<span aria-hidden="true"><i class="menu_icon icon-1x wpbc_icn_south"></i></span><span class="sr-only"><?php echo esc_html__( 'Column', 'booking' ); ?></span>
								</label>
							</div>
						</div>
					</div>

					<!-- Wrap -->
					<div class="inspector__row">
						<label class="inspector__label inspector__w_40"><?php echo esc_html__( 'Wrap', 'booking' ); ?></label>
						<div class="inspector__control inspector__w_50">
							<div class="wpbc_bfb__choices" role="radiogroup" aria-label="<?php echo esc_attr__( 'Wrap', 'booking' ); ?>">
								<input class="inspector__input wpbc_sr_only"
									   type="radio"
									   id="bfb_col_{{ k }}_wrap_nowrap"
									   name="{{ __name_wrap }}"
									   data-style-key="wrap"
									   data-col-idx="{{ i }}"
									   value="nowrap"
									   <# if (val_wrap === 'nowrap') { #>checked<# } #> >
								<label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_wrap_nowrap" title="<?php echo esc_attr__( 'No Wrap', 'booking' ); ?>">
									<span aria-hidden="true"><i class="menu_icon icon-1x wpbc_icn_straight wpbc_icn_rotate_90"></i></span><span class="sr-only"><?php echo esc_html__( 'No Wrap', 'booking' ); ?></span>
								</label>

								<input class="inspector__input wpbc_sr_only"
									   type="radio"
									   id="bfb_col_{{ k }}_wrap_wrap"
									   name="{{ __name_wrap }}"
									   data-style-key="wrap"
									   data-col-idx="{{ i }}"
									   value="wrap"
									   <# if (val_wrap === 'wrap') { #>checked<# } #> >
								<label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_wrap_wrap" title="<?php echo esc_attr__( 'Wrap', 'booking' ); ?>">
									<span aria-hidden="true"><i class="menu_icon icon-1x wpbc_icn_u_turn_right wpbc_icn_rotate_90"></i></span><span class="sr-only"><?php echo esc_html__( 'Wrap', 'booking' ); ?></span>
								</label>
							</div>
						</div>
					</div>
<?php /**/ ?>
					<!-- Main axis (Justify Content) -->
					<div class="inspector__row">
						<label class="inspector__label inspector__w_40">{{ __main_label }}</label>
						<div class="inspector__control inspector__w_55">
							<div class="wpbc_bfb__choices" role="radiogroup" aria-label="{{ __main_label }}">
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_jc_fstart" name="{{ __name_jc }}" data-style-key="jc" data-col-idx="{{ i }}" value="flex-start"   <# if   (val_jc === 'flex-start')    { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_jc_fstart"  title="<?php echo esc_attr__( 'Start', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-start"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_jc_center" name="{{ __name_jc }}" data-style-key="jc" data-col-idx="{{ i }}" value="center"       <# if   (val_jc === 'center')        { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_jc_center"  title="<?php echo esc_attr__( 'Center', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-center"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_jc_fend"   name="{{ __name_jc }}" data-style-key="jc" data-col-idx="{{ i }}" value="flex-end"     <# if   (val_jc === 'flex-end')      { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_jc_fend"    title="<?php echo esc_attr__( 'End', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-end"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_jc_between" name="{{ __name_jc }}" data-style-key="jc" data-col-idx="{{ i }}" value="space-between" <# if (val_jc === 'space-between') { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_jc_between" title="<?php echo esc_attr__( 'Space Between', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_expand wpbc_icn_rotate_90"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_jc_around"  name="{{ __name_jc }}" data-style-key="jc" data-col-idx="{{ i }}" value="space-around"  <# if (val_jc === 'space-around')  { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_jc_around"  title="<?php echo esc_attr__( 'Space Around', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-distribute-vertical wpbc_icn_rotate_90"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_jc_evenly"  name="{{ __name_jc }}" data-style-key="jc" data-col-idx="{{ i }}" value="space-evenly"  <# if (val_jc === 'space-evenly')  { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_jc_evenly"  title="<?php echo esc_attr__( 'Space Evenly', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc_icn_horizontal_distribute "></i></label>
							</div>
						</div>
					</div>

					<!-- Cross axis (Align Items) -->
					<div class="inspector__row">
						<label class="inspector__label inspector__w_40">{{ __cross_label }}</label>
						<div class="inspector__control inspector__w_55">
							<div class="wpbc_bfb__choices" role="radiogroup" aria-label="{{ __cross_label }}">
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_ai_fstart"  name="{{ __name_ai }}" data-style-key="ai" data-col-idx="{{ i }}" value="flex-start" <# if ( val_ai === 'flex-start') { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_ai_fstart"  title="<?php echo esc_attr__( 'Start', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-top"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_ai_center"  name="{{ __name_ai }}" data-style-key="ai" data-col-idx="{{ i }}" value="center"     <# if ( val_ai ==='center' )     { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_ai_center"  title="<?php echo esc_attr__( 'Center', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-middle"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_ai_fend"    name="{{ __name_ai }}" data-style-key="ai" data-col-idx="{{ i }}" value="flex-end"   <# if ( val_ai ==='flex-end' )   { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_ai_fend"    title="<?php echo esc_attr__( 'End', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-bottom"></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_ai_stretch" name="{{ __name_ai }}" data-style-key="ai" data-col-idx="{{ i }}" value="stretch"    <# if ( val_ai ==='stretch' )    { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_ai_stretch" title="<?php echo esc_attr__( 'Stretch', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-arrows-expand"></i></label>
							</div>
						</div>
					</div>

					<#  /* --------------------------------------------------------------------------------------------------------------
						 * Item Spacing (GAP) - Parses current s.gap into numeric value (__gnum) and unit (__gunit).
						 * ----------------------------------------------------------------------------------------------------------- */
						var __gap   = String(s.gap || '0px');
						var __gm    = __gap.match( /^(\d+(?:\.\d+)?)(px|rem|em|%)?$/ );
						var __gnum  = __gm ? __gm[1] : '0';
						var __gunit = ( __gm && __gm[2] ) ? __gm[2] : 'px';
					#>
					<div class="inspector__row">
						<label class="inspector__label inspector__w_40"><?php echo esc_html__( 'Item Spacing', 'booking' ); ?></label>
						<div class="wpbc_len_group inspector__w_55" data-len-group="gap">
							<div class="wpbc_inline_inputs">
								<input
									type="number" min="0" step="any" class="inspector__input"
									data-style-key="gap" data-style-part="value" data-len-value
									data-col-idx="{{ i }}" value="{{ __gnum }}"
								>
								<select class="inspector__input"
									data-style-key="gap" data-style-part="unit" data-len-unit
									data-col-idx="{{ i }}"
								>
									<option value="px"  <# if ( __gunit === 'px' )  { #>selected<# } #>>px</option>
									<option value="rem" <# if ( __gunit === 'rem' ) { #>selected<# } #>>rem</option>
									<option value="em"  <# if ( __gunit === 'em' )  { #>selected<# } #>>em</option>
									<option value="%"   <# if ( __gunit === '%' )   { #>selected<# } #>>%</option>
								</select>
							</div>
							<input type="range" class="inspector__input"
								data-style-key="gap" data-style-part="value" data-len-range
								data-col-idx="{{ i }}"
								min="0" max="128" step="1" value="{{ __gnum }}"
							>
						</div>
					</div>

					<div class="inspector__row"><h2><?php echo esc_js( __( 'Column Position', 'booking' ) ); ?></h2></div>
					<!-- Self align (column itself) -->
					<div class="inspector__row">
						<label class="inspector__label inspector__w_40"><?php echo esc_html__( 'In Row', 'booking' ); ?></label>
						<div class="inspector__control inspector__w_55">
							<div class="wpbc_bfb__choices" role="radiogroup" aria-label="<?php echo esc_attr__( 'Column Align', 'booking' ); ?>">
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_aself_fstart"  name="{{ __name_aself }}" data-style-key="aself" data-col-idx="{{ i }}" value="flex-start" <# if ( val_aself ==='flex-start' ) { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_aself_fstart"  title="<?php echo esc_attr__( 'Start', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-top "></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_aself_center"  name="{{ __name_aself }}" data-style-key="aself" data-col-idx="{{ i }}" value="center"     <# if ( val_aself ==='center' )     { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_aself_center"  title="<?php echo esc_attr__( 'Center', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-middle "></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_aself_fend"    name="{{ __name_aself }}" data-style-key="aself" data-col-idx="{{ i }}" value="flex-end"   <# if ( val_aself ==='flex-end' )   { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_aself_fend"    title="<?php echo esc_attr__( 'End', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-align-bottom "></i></label>
								<input class="inspector__input wpbc_sr_only" type="radio" id="bfb_col_{{ k }}_aself_stretch" name="{{ __name_aself }}" data-style-key="aself" data-col-idx="{{ i }}" value="stretch"    <# if ( val_aself ==='stretch' )    { #>checked<# } #> ><label class="wpbc_bfb__chip" for="bfb_col_{{ k }}_aself_stretch" title="<?php echo esc_attr__( 'Stretch', 'booking' ); ?>"><i class="menu_icon icon-1x wpbc-bi-arrows-expand "></i></label>
							</div>
						</div>
					</div>

				</div>
			<# } #>

			<# if ( active ) { #>
				<div class="wpbc_tab__panel group__fields">
					<div class="inspector__row">
						<div class="inspector__control">
							<button type="button" class="button button-secondary wpbc_ui_button" data-action="colstyles-reset">
								<?php echo esc_html__( 'Reset', 'booking' ); ?>
							</button>
						</div>
					</div>
				</div>
			<# } #>
		</div>
	</script>
	<?php
}

/**
 * Palette presets (unchanged).
 *
 * @param string $group    Palette group slug.
 * @param string $position Position in palette.
 */
function wpbc_bfb_palette_register_items__section_wptpl( $group, $position ) {
	if ( 'layout' !== $group || 'top' !== $position ) {
		return;
	}
	for ( $cols = 1; $cols <= 4; $cols ++ ) {
		$id = 'section-' . $cols . 'col';
		/* translators: 1: column number. */
		$label_text = sprintf( _n( '%d Column', '%d Columns', $cols, 'booking' ), $cols );
		?>
		<li class="wpbc_bfb__field"
		    data-id="<?php echo esc_attr( $id ); ?>"
		    data-type="section"
		    data-usage_key="section"
		    data-columns="<?php echo esc_attr( $cols ); ?>"
		    data-label="<?php echo esc_attr( $label_text ); ?>">
			<?php if ( 1 === $cols ) { ?><i class="menu_icon icon-1x wpbc-bi-square"></i><?php } ?>
			<?php if ( 2 === $cols ) { ?><i class="menu_icon icon-1x wpbc-bi-layout-split"></i><?php } ?>
			<?php if ( 3 === $cols ) { ?><i class="menu_icon icon-1x wpbc-bi-layout-three-columns"></i><?php } ?>
			<?php if ( 4 === $cols ) { ?><i class="menu_icon icon-1x wpbc_icn_calendar_view_week"></i><?php } ?>
			<span class="wpbc_bfb__field-label"><?php echo esc_html( $label_text ); ?></span>
			<span class="wpbc_bfb__field-type">section</span>
		</li>
	<?php
	}
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__section_wptpl', 10, 2 );
