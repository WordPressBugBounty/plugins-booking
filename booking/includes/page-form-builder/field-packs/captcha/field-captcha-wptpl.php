<?php
/**
 * WPBC BFB Pack: Text Captcha (WP-template–driven with Inspector)
 *
 * Purpose:
 * - Adds a CAPTCHA field that exports to the shortcode [captcha].
 * - Inspector and Preview are rendered via wp.template() blocks.
 * - Supports standard field title (label) and help text under the CAPTCHA.
 * - Enforces usage guard via usage_key 'captcha' (palette item can set data-usagenumber="1").
 *
 * Contracts:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 *
 * File:  ../includes/page-form-builder/field-packs/captcha/field-captcha-wptpl.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop, oplugins
 * @since     11.0.0
 * @modified  2025-10-18
 * @version   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "captcha" field pack (WP-template–driven Inspector).
 *
 * @param array $packs Accumulated packs from other modules.
 *
 * @return array Modified packs with "captcha" field included.
 */
function wpbc_bfb_register_field_packs__field_captcha_wptpl( $packs ) {

	$packs['captcha'] = array(
		'kind'              => 'field',
		'type'              => 'captcha',
		'label'             => '',//__( 'Text Captcha', 'booking' ),
		'icon'              => 'wpbc-bi-shield-lock',
		'usage_key'         => 'captcha',

		// Schema for coercion/defaults/serialization (template-driven inspector).
		'schema'            => array(
			'props' => array(
				'label'    => array( 'type' => 'string', 'default' => __( 'CAPTCHA', 'booking' ) ),
				'html_id'  => array( 'type' => 'string', 'default' => '' ),
				'cssclass' => array( 'type' => 'string', 'default' => '' ),
				'help'     => array( 'type' => 'string', 'default' => '' ),
			),
		),

		// Ask core to print wp.template() blocks for this pack.
		'templates_printer' => 'wpbc_bfb_field_captcha_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_captcha_wptpl' );


/**
 * Enqueue the CAPTCHA (WP-template) pack JS for the Builder page.
 *
 * @param string $page Current admin page slug (from core).
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_captcha_wptpl_js( $page ) {

	wp_enqueue_script(
		'wpbc-bfb_field_captcha_wptpl',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/captcha/_out/field-captcha-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_captcha_wptpl_js', 10, 1 );


/**
 * Print wp.template() blocks for the CAPTCHA field:
 *  - Canvas Preview:  tmpl-wpbc-bfb-field-captcha
 *  - Inspector:       tmpl-wpbc-bfb-inspector-captcha
 *
 * Uses {{ ... }} (escaped). Keep preview inert/disabled (Builder only).
 *
 * @param string $page The current page slug (core passes the Builder slug here).
 *
 * @return void
 */
function wpbc_bfb_field_captcha_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	// ============ Canvas Preview Template ============
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-captcha">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<# var has_label = !!( data.label && data.label !== '' ); #>

			<# if ( has_label ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }}
			</label>
			<# } #>

			<span class="wpbc_text_captcha_container wpdev-form-control-wrap">
				<input autocomplete="off" type="hidden"
					   name="wpdev_captcha_challenge_{{ data.id || 'X' }}"
					   id="wpdev_captcha_challenge_{{ data.id || 'X' }}"
					   value="{{ data.challenge || '0000000000' }}"/>

				<input autocomplete="off" type="text"
					   class="captachinput {{ data.cssclass || '' }}"
					   value=""
					   name="captcha_input{{ data.id || 'X' }}"
					   id="captcha_input{{ data.id || 'X' }}"
					   tabindex="-1"
					   disabled
					   aria-disabled="true"/>

				<img decoding="async"  draggable="false"
					 class="captcha_img"
					 id="captcha_img{{ data.id || 'X' }}"
					 alt="{{ data.alt_text || '' }}"
					 src="{{ data.img_url || data.placeholder_src || '' }}"/>
			</span>

			<# if ( data.help ) { #>
				<div class="wpbc_bfb__help">{{ data.help }}</div>
			<# } #>
		</span>
	</script>
	<?php

	// ============ Inspector Template ============
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-inspector-captcha">
		<div class="wpbc_bfb__inspector__head">
			<div class="header_container">
				<div class="header_title_content">
					<h3 class="title"><?php
						echo esc_html__( 'Text Captcha', 'booking' ); ?></h3>
					<div class="desc">
						<?php
						echo esc_html__( 'The CAPTCHA appears on the form only if it is enabled in Settings - Form Options.', 'booking' );
						?>
					</div>
				</div>
				<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
					<div class="ui_container ui_container_small">
						<div class="ui_group">
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="deselect" aria-label="<?php
								echo esc_attr__( 'Deselect', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_remove_done"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="scrollto" aria-label="<?php
								echo esc_attr__( 'Scroll to field', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
								</button>
							</div>
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="move-up" aria-label="<?php
								echo esc_attr__( 'Move up', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="move-down" aria-label="<?php
								echo esc_attr__( 'Move down', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
								</button>
							</div>
							<div class="ui_element">
								<button data-action="delete" aria-label="<?php
								echo esc_attr__( 'Delete', 'booking' ); ?>"
										type="button"
										class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete">
									<span class="in-button-text"><?php
										echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;
									<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
								</button>
							</div>
						</div><!-- .ui_group -->
					</div><!-- .ui_container -->
				</div><!-- .actions -->
			</div><!-- .header_container -->
		</div><!-- .wpbc_bfb__inspector__head -->

		<div class="wpbc_bfb__inspector__body">

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="basic">
				<button type="button" class="group__header">
					<h3><?php
						echo esc_html__( 'Basic', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Label', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="label"
								   value="{{ data.label || '<?php
								   echo esc_js( __( 'CAPTCHA', 'booking' ) ); ?>' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Help text', 'booking' ); ?></label>
						<div class="inspector__control">
							<textarea class="inspector__textarea" rows="3" data-inspector-key="help">{{ data.help || '' }}</textarea>
						</div>
					</div>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="appearance">
				<button type="button" class="group__header">
					<h3><?php
						echo esc_html__( 'Appearance', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'CSS class', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="cssclass"
								   value="{{ data.cssclass || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'HTML ID', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="html_id"
								   value="{{ data.html_id || '' }}">
						</div>
					</div>

					<div class="wpbc_bfb__inspector__note">
						<?php
						echo esc_html__( 'This field renders as [captcha]. Name and validation are handled by the Booking Calendar core.', 'booking' ); ?>
					</div>
				</div>
			</section>

		</div><!-- .wpbc_bfb__inspector__body -->
	</script>
	<?php
}

/**
 * (Optional) Register the "Text Captcha" palette item in "general/bottom".
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__captcha_wptpl( $group, $position ) {

	if ( 'essentials' !== $group || 'top' !== $position ) {
		return;
	}

	?>
	<li class="wpbc_bfb__field"
		data-id="captcha"
		data-type="captcha"
		data-usage_key="captcha"
		data-usagenumber="1"
		data-label="<?php
		echo ''; // esc_attr( __( 'Text Captcha', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc_icn_format_shapes"></i>
		<span class="wpbc_bfb__field-label"><?php
			echo esc_html( __( 'Text Captcha', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">captcha</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__captcha_wptpl', 10, 2 );
