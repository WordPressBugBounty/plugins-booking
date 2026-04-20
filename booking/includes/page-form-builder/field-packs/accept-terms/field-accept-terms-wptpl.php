<?php
/**
 * WPBC BFB Pack: Accept Terms field (WP-template–driven, sentence + token links)
 *
 * Strategy:
 * - User writes one sentence with tokens, for example:
 *   "the {terms} and {conditions}"
 * - User defines link rows for each token:
 *   - key: terms
 *   - text: terms
 *   - type: url / popup / anchor
 *   - destination: URL or popup id or anchor id
 *
 * File: ../includes/page-form-builder/field-packs/accept-terms/field-accept-terms-wptpl.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop, oplugins
 * @since     11.0.0
 * @modified  2026-04-05
 * @version   1.0.2
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "accept_terms" field pack.
 *
 * @param array $packs Registered field packs.
 *
 * @return array
 */
function wpbc_bfb_register_field_packs__field_accept_terms_wptpl( $packs ) {

	$packs['accept_terms'] = array(
		'kind'      => 'field',
		'type'      => 'accept_terms',
		'label'     => __( 'Accept Terms', 'booking' ),
		'icon'      => 'wpbc_icn_check_box0',
		'usage_key' => 'accept_terms',
		'schema'    => array(
			'props' => array(
				'title'         => array( 'type' => 'string', 'default' => '' ),
				'name'          => array( 'type' => 'string', 'default' => 'terms' ),
				'html_id'       => array( 'type' => 'string', 'default' => '' ),
				'required'      => array( 'type' => 'boolean', 'default' => true ),
				'cssclass'      => array( 'type' => 'string', 'default' => '' ),
				'help'          => array( 'type' => 'string', 'default' => '' ),
				'checkbox_text' => array( 'type' => 'string', 'default' => __( 'I accept', 'booking' ) ),
				'sentence'      => array( 'type' => 'string', 'default' => __( 'the {terms} and {conditions}', 'booking' ) ),
				'links'         => array(
					'type'    => 'array',
					'default' => array(
						array(
							'key'         => 'terms',
							'text'        => __( 'terms', 'booking' ),
							'link_type'   => 'url',
							'destination' => 'https://server.com/terms/',
							'target'      => '_blank',
							'cssclass'    => '',
						),
						array(
							'key'         => 'conditions',
							'text'        => __( 'conditions', 'booking' ),
							'link_type'   => 'url',
							'destination' => 'https://server.com/conditions/',
							'target'      => '_blank',
							'cssclass'    => '',
						),
					),
				),
				// 'min_width'     => array( 'type' => 'string', 'default' => '260px' ),
			),
		),
		'templates_printer' => 'wpbc_bfb_field_accept_terms_wptpl_print_templates',
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_accept_terms_wptpl' );


/**
 * Enqueue JS renderer for the Accept Terms field pack.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_accept_terms_wptpl_js( $page ) {

	wp_enqueue_script(
		'wpbc-bfb_field_accept_terms_wptpl',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/accept-terms/_out/field-accept-terms-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_accept_terms_wptpl_js', 10, 1 );


/**
 * Print wp.template() blocks for the Accept Terms field.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_field_accept_terms_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-accept_terms">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<#
			var is_req     = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required );
			var field_id   = data.html_id || data.id || data.name || 'accept_terms';
			var field_name = data.name || data.id || 'terms';
			#>

			<# if ( data.title && data.title !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ field_id }}" <# } #>>
					{{ data.title }} <# if ( is_req ) { #><span aria-hidden="true">*</span><# } #>
				</label>
			<# } #>

			<span class="wpbc_wrap_text wpdev-form-control-wrap {{ data.cssclass || '' }}">
				<label class="wpbc_bfb__checkbox-item wpbc_bfb__accept_terms_item">
					<input
						type="checkbox"
						class="wpbc_bfb__preview-input wpbc_bfb__preview-checkbox"
						name="{{ field_name }}"
						value="{{ data.checkbox_text || '<?php echo esc_js( __( 'I accept', 'booking' ) ); ?>' }}"
						tabindex="-1"
						aria-disabled="true"
						<# if ( is_req ) { #> required aria-required="true" <# } #>
						id="{{ field_id }}"
					>
					<span class="wpbc_bfb__checkbox-label">
						{{ data.checkbox_text || '<?php echo esc_js( __( 'I accept', 'booking' ) ); ?>' }}{{{ data.sentence_preview_html || '' }}}
					</span>
				</label>
			</span>

			<# if ( data.help ) { #>
				<div class="wpbc_bfb__help">{{ data.help }}</div>
			<# } #>
		</span>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-accept_terms">
		<style type="text/css">
			.wpbc_admin .wpbc_ui_el__vert_right_bar__wrapper:has(.wpbc_bfb__inspector_accept_terms) {
				--wpbc_ui_left_vert_nav__width_max: Min(330px, 100%);
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_links_list {
				display: flex;
				flex-direction: column;
				gap: 8px;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_row {
				display: flex;
				flex-flow: row wrap;
				align-items: center;
				gap: 8px;
				padding: 10px 0;
				border-bottom: 1px solid #dcdcde;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_row span {
				flex: 0 1 30%;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_row input,
			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_row select {
				flex: 1 1 50%;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_row:last-child {
				border-bottom: 0;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_prop_label {
				flex: 0 0 92px;
				margin: 0;
				color: #50575e;
				white-space: nowrap;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_key {
				flex: 1 1 calc(100% - 100px);
				min-width: 140px;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_text {
				flex: 1 1 calc(100% - 100px);
				min-width: 160px;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_type {
				flex: 1 1 calc(100% - 100px);
				min-width: 120px;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_destination {
				flex: 1 1 calc(100% - 100px);
				min-width: 180px;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_target {
				flex: 1 1 calc(100% - 100px);
				min-width: 100px;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_link_cssclass {
				flex: 1 1 calc(100% - 100px);
				min-width: 140px;
			}

			.wpbc_bfb__inspector_accept_terms .wpbc_bfb__accept_terms_row_actions {
				flex: 0 0 40px;
				width: 40px;
				margin-left: auto;
			}

			.wpbc_bfb__inspector_accept_terms [data-wpbc-bfb-accept-terms-available-tokens="1"] {
				display: flex;
				flex-flow: row wrap;
				align-items: center;
				justify-content: flex-start;
				gap: 6px;
			}
		</style>

		<#
		var _default_links = [
			{
				key         : 'terms',
				text        : '<?php echo esc_js( __( 'terms', 'booking' ) ); ?>',
				link_type   : 'url',
				destination : 'https://server.com/terms/',
				target      : '_blank',
				cssclass    : ''
			},
			{
				key         : 'conditions',
				text        : '<?php echo esc_js( __( 'conditions', 'booking' ) ); ?>',
				link_type   : 'url',
				destination : 'https://server.com/conditions/',
				target      : '_blank',
				cssclass    : ''
			}
		];

		var _has_links_prop = Object.prototype.hasOwnProperty.call( data || {}, 'links' );
		var _links_raw      = _has_links_prop ? data.links : _default_links;

		if ( 'string' === typeof _links_raw ) {
			try {
				_links_raw = JSON.parse( _links_raw );
			} catch ( _links_err ) {
				_links_raw = _has_links_prop ? [] : _default_links;
			}
		}

		var _links2 = Array.isArray( _links_raw )
			? _links_raw
			: ( function( o ) {
				var a = [], k;
				for ( k in ( o || {} ) ) {
					if ( Object.prototype.hasOwnProperty.call( o, k ) ) {
						a.push( o[ k ] );
					}
				}
				return a;
			} )( _links_raw );
		#>

		<div class="wpbc_bfb__inspector_accept_terms" data-type="accept_terms">
			<div class="wpbc_bfb__inspector__head">
				<div class="header_container">
					<div class="header_title_content">
						<h3 class="title"><?php echo esc_html__( 'Accept Terms', 'booking' ); ?></h3>
						<div class="desc"><?php echo esc_html__( 'Write one sentence with tokens like {terms}, then define the links below.', 'booking' ); ?></div>
					</div>
					<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
						<div class="ui_container ui_container_small">
							<div class="ui_group">
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="deselect" aria-label="<?php echo esc_attr__( 'Deselect', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_remove_done"></i>
									</button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="scrollto" aria-label="<?php echo esc_attr__( 'Scroll to field', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
									</button>
								</div>
								<div class="ui_element">
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-up" aria-label="<?php echo esc_attr__( 'Move up', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
									</button>
									<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" data-action="move-down" aria-label="<?php echo esc_attr__( 'Move down', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
									</button>
								</div>
								<div class="ui_element">
									<button data-action="duplicate" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button" aria-label="<?php echo esc_attr__( 'Duplicate', 'booking' ); ?>">
										<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
									</button>
									<button data-action="delete" type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete" aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>">
										<span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="wpbc_bfb__inspector__body" data-wpbc-bfb-accept-terms-panel="1">

				<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="basic">
					<button type="button" class="group__header">
						<h3><?php echo esc_html__( 'Basic', 'booking' ); ?></h3>
						<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
					</button>

					<div class="group__fields inspector__group__fields__times">

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Required', 'booking' ); ?></label>
							<div class="inspector__control">
								<input
									type="checkbox"
									class="inspector__checkbox inspector__input"
									data-inspector-key="required"
									<# if ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ) { #>
										checked="checked" aria-checked="true"
									<# } else { #>
										aria-checked="false"
									<# } #>
								>
								<p class="wpbc_bfb__help" style="margin-top:6px;"><?php echo esc_html__( 'Enable this option to require accepting this checkbox before form submission.', 'booking' ); ?></p>
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Name', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="name" value="{{ data.name || 'terms' }}">
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Checkbox text', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="checkbox_text" value="{{ data.checkbox_text || '<?php echo esc_js( __( 'I accept', 'booking' ) ); ?>' }}">
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Sentence after checkbox', 'booking' ); ?></label>
							<div class="inspector__control">
								<textarea class="inspector__textarea" rows="3" data-inspector-key="sentence">{{ data.sentence || '<?php echo esc_js( __( 'the {terms} and {conditions}', 'booking' ) ); ?>' }}</textarea>

								<div class="wpbc_bfb__help" data-wpbc-bfb-accept-terms-available-tokens="1">
									<# _links2.forEach( function( _link_item ) { #>
										<button type="button" class="button button-secondary button-small js-insert-token-from-hint" data-token="{{ _link_item.key || '' }}">
											<# print( '{' + ( _link_item.key || '' ) + '}' ); #>
										</button>
									<# } ); #>
								</div>

								<p class="wpbc_bfb__help" style="margin-top:6px;"><?php echo esc_html__( 'Use tokens inside braces, for example: {terms} or {privacy_policy}.', 'booking' ); ?></p>
								<div class="wpbc_bfb__help" data-wpbc-bfb-accept-terms-status="1" style="margin-top:8px;"></div>
							</div>
						</div>

						<div class="inspector__row wpbc_bfb__options_editor">
							<label class="inspector__label"><?php echo esc_html__( 'Link definitions', 'booking' ); ?></label>

							<div class="inspector__control">
								<div class="wpbc_bfb__options_list wpbc_bfb__accept_terms_links_list">
									<# _links2.forEach( function( opt, idx ) { #>
										<div class="wpbc_bfb__options_row wpbc_bfb__accept_terms_link_row" data-index="{{ idx }}">
											<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Token Key', 'booking' ); ?>:</span>
											<input type="text" class="wpbc_bfb__accept_terms_link_key" placeholder="<?php echo esc_attr__( 'Token key', 'booking' ); ?>" value="{{ opt && opt.key || '' }}">

											<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Text', 'booking' ); ?>:</span>
											<input type="text" class="wpbc_bfb__accept_terms_link_text" placeholder="<?php echo esc_attr__( 'Visible text', 'booking' ); ?>" value="{{ opt && opt.text || '' }}">

											<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Type', 'booking' ); ?>:</span>
											<select class="wpbc_bfb__accept_terms_link_type">
												<option value="url" <# if ( 'url' === ( opt && opt.link_type || 'url' ) ) { #> selected="selected" <# } #> ><?php echo esc_html__( 'URL', 'booking' ); ?></option>
												<option value="anchor" <# if ( 'anchor' === ( opt && opt.link_type || '' ) ) { #> selected="selected" <# } #> ><?php echo esc_html__( 'Anchor', 'booking' ); ?></option>
											</select>

											<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Destination', 'booking' ); ?>:</span>
											<input type="text" class="wpbc_bfb__accept_terms_link_destination" placeholder="<?php echo esc_attr__( 'Destination', 'booking' ); ?>" value="{{ opt && opt.destination || '' }}">

											<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Target', 'booking' ); ?>:</span>
											<select class="wpbc_bfb__accept_terms_link_target">
												<option value="_self" <# if ( '_self' === ( opt && opt.target || '' ) ) { #> selected="selected" <# } #> >_self</option>
												<option value="_blank" <# if ( '_blank' === ( opt && opt.target || '_blank' ) ) { #> selected="selected" <# } #> >_blank</option>
											</select>

											<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'CSS', 'booking' ); ?>:</span>
											<input type="text" class="wpbc_bfb__accept_terms_link_cssclass" placeholder="<?php echo esc_attr__( 'CSS class', 'booking' ); ?>" value="{{ opt && opt.cssclass || '' }}">

											<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown wpbc_bfb__accept_terms_row_actions">
												<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">
													<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>
												</a>
												<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">
													<li>
														<a class="ul_dropdown_menu_li_action js-link-row-action" data-action="add_after" href="javascript:void(0)">
															<?php echo esc_html__( 'Add New', 'booking' ); ?>
															<i class="menu_icon icon-1x wpbc_icn_add_circle"></i>
														</a>
													</li>
													<li>
														<a class="ul_dropdown_menu_li_action js-link-row-action" data-action="duplicate" href="javascript:void(0)">
															<?php echo esc_html__( 'Duplicate', 'booking' ); ?>
															<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
														</a>
													</li>
													<li class="divider"></li>
													<li>
														<a class="ul_dropdown_menu_li_action js-link-row-action" data-action="remove" href="javascript:void(0)">
															<?php echo esc_html__( 'Remove', 'booking' ); ?>
															<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
														</a>
													</li>
												</ul>
											</div>
										</div>
									<# } ); #>
								</div>

								<div class="wpbc_bfb__options_toolbar">
									<div class="wpbc_bfb__options_toolbar wpbc_inline_inputs">
										<div class="inspector__control inspector__w_100" style="text-align:center;">
											<button type="button" class="button button-secondary js-add-link-definition">
												<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x wpbc_icn_add_circle" aria-hidden="true"></i>
												<?php echo esc_html__( 'Add link', 'booking' ); ?>
											</button>
										</div>
									</div>
								</div>

								<#
								var _links_json = JSON.stringify( _links2 || [] );
								_links_json = _links_json.replace( /<\/textarea/gi, '<\\/textarea' );
								#>
								<textarea class="wpbc_bfb__accept_terms_links_state inspector__input" data-inspector-key="links" hidden>{{ _links_json }}</textarea>

								<p class="wpbc_bfb__help" style="margin-top:8px;"><?php echo esc_html__( 'Token key is used inside the sentence as {token_key}. Destination means URL or anchor ID depending on selected type.', 'booking' ); ?></p>
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Title', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="title" value="{{ data.title || '' }}">
								<p class="wpbc_bfb__help" style="margin-top:6px;"><?php echo esc_html__( 'Optional label above the checkbox row.', 'booking' ); ?></p>
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
								<input type="text" class="inspector__input" data-inspector-key="cssclass" value="{{ data.cssclass || '' }}">
							</div>
						</div>

						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'HTML ID', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="html_id" value="{{ data.html_id || '' }}">
							</div>
						</div>
<?php /* ?>
						<div class="inspector__row">
							<label class="inspector__label"><?php echo esc_html__( 'Min width', 'booking' ); ?></label>
							<div class="inspector__control">
								<input type="text" class="inspector__input" data-inspector-key="min_width" placeholder="260px" value="{{ data.min_width || '260px' }}">
							</div>
						</div>
<?php */ ?>
					</div>
				</section>

			</div>
		</div>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-accept_terms-link-row">
		<div class="wpbc_bfb__options_row wpbc_bfb__accept_terms_link_row" data-index="{{ data.index || 0 }}">
			<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Token Key', 'booking' ); ?>:</span>
			<input type="text" class="wpbc_bfb__accept_terms_link_key" placeholder="<?php echo esc_attr__( 'Token key', 'booking' ); ?>" value="{{ data.key || '' }}">

			<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Text', 'booking' ); ?>:</span>
			<input type="text" class="wpbc_bfb__accept_terms_link_text" placeholder="<?php echo esc_attr__( 'Visible text', 'booking' ); ?>" value="{{ data.text || '' }}">

			<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Type', 'booking' ); ?>:</span>
			<select class="wpbc_bfb__accept_terms_link_type">
				<option value="url" <# if ( 'url' === ( data.link_type || 'url' ) ) { #> selected="selected" <# } #> ><?php echo esc_html__( 'URL', 'booking' ); ?></option>
				<option value="anchor" <# if ( 'anchor' === ( data.link_type || '' ) ) { #> selected="selected" <# } #> ><?php echo esc_html__( 'Anchor', 'booking' ); ?></option>
			</select>

			<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Destination', 'booking' ); ?>:</span>
			<input type="text" class="wpbc_bfb__accept_terms_link_destination" placeholder="<?php echo esc_attr__( 'Destination', 'booking' ); ?>" value="{{ data.destination || '' }}">

			<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'Target', 'booking' ); ?>:</span>
			<select class="wpbc_bfb__accept_terms_link_target">
				<option value="_self" <# if ( '_self' === ( data.target || '' ) ) { #> selected="selected" <# } #> >_self</option>
				<option value="_blank" <# if ( '_blank' === ( data.target || '_blank' ) ) { #> selected="selected" <# } #> >_blank</option>
			</select>

			<span class="wpbc_bfb__accept_terms_prop_label"><?php echo esc_html__( 'CSS', 'booking' ); ?>:</span>
			<input type="text" class="wpbc_bfb__accept_terms_link_cssclass" placeholder="<?php echo esc_attr__( 'CSS class', 'booking' ); ?>" value="{{ data.cssclass || '' }}">

			<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown wpbc_bfb__accept_terms_row_actions">
				<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">
					<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>
				</a>
				<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">
					<li>
						<a class="ul_dropdown_menu_li_action js-link-row-action" data-action="add_after" href="javascript:void(0)">
							<?php echo esc_html__( 'Add New', 'booking' ); ?>
							<i class="menu_icon icon-1x wpbc_icn_add_circle"></i>
						</a>
					</li>
					<li>
						<a class="ul_dropdown_menu_li_action js-link-row-action" data-action="duplicate" href="javascript:void(0)">
							<?php echo esc_html__( 'Duplicate', 'booking' ); ?>
							<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
						</a>
					</li>
					<li class="divider"></li>
					<li>
						<a class="ul_dropdown_menu_li_action js-link-row-action" data-action="remove" href="javascript:void(0)">
							<?php echo esc_html__( 'Remove', 'booking' ); ?>
							<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
						</a>
					</li>
				</ul>
			</div>
		</div>
	</script>
	<?php
}


/**
 * Register the "Accept Terms" palette item.
 *
 * @param string $group Palette group.
 * @param string $position Position in group.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__accept_terms_wptpl( $group, $position ) {

	if ( 'standard' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
	    data-id="accept_terms"
	    data-type="accept_terms"
	    data-usage_key="accept_terms"
	    data-label="<?php echo esc_attr( __( 'Accept Terms', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc_icn_check_box0 wpbc-bi-check-square"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Accept Terms', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">accept_terms</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__accept_terms_wptpl', 10, 2 );