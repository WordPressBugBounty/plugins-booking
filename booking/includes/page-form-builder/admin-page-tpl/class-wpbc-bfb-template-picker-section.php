<?php
/**
 * Shared Template Picker section for BFB modals.
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.x
 * @file        ../includes/page-form-builder/admin-page-tpl/class-wpbc-bfb-template-picker-section.php
 *
 * @modified    2026-03-16 10:41
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

class WPBC_BFB_Template_Picker_Section {

	/**
	 * Print shared Template Picker JS config once.
	 *
	 * @param array $args Optional config values.
	 *
	 * @return void
	 */
	public static function print_js_config( $args = array() ) {

		$defaults = array(
			'template_search_or_sep'                  => ( defined( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR' ) ) ? (string) WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR : '|',
			'template_search_or_sep_url'              => ( defined( 'WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR_URL' ) ) ? (string) WPBC_BFB_TEMPLATE_SEARCH_OR_SEPARATOR_URL : '^',
			'template_delete_label'                   => '',
			'template_delete_confirm'                 => '',
			'template_delete_success'                 => '',
			'template_delete_failed'                  => '',
			'template_delete_missing_helper'          => '',
			'text_blank_form_title'                   => __( 'Blank Form', 'booking' ),
			'text_blank_thumb'                        => __( 'Blank', 'booking' ),
			'text_no_image'                           => __( 'No Image', 'booking' ),
			'text_no_image_thumb'                     => __( 'No image', 'booking' ),
			'text_loading'                            => __( 'Loading...', 'booking' ),
			'text_page'                               => __( 'Page', 'booking' ),
			'text_apply_template_blank_desc'          => '',
			'text_apply_template_empty_templates'     => '',
			'text_apply_template_list_helper_missing' => '',
			'text_apply_template_load_failed'         => '',
			'text_apply_template_picker_missing'      => '',
			'text_apply_template_applying'            => '',
			'text_apply_template_blank_applied'       => '',
			'text_apply_template_form_load_failed'    => '',
			'text_apply_template_applied'             => '',
			'text_apply_template_modal_missing'       => '',
			'text_apply_template_ajax_load_missing'   => '',
			'text_apply_template_jquery_missing'      => '',
			'text_add_new_blank_desc'                 => '',
			'text_add_new_empty_templates'            => '',
			'text_add_new_list_helper_missing'        => '',
			'text_add_new_load_failed'                => '',
			'text_add_new_picker_missing'             => '',
			'text_add_new_validation_title'           => '',
			'text_add_new_validation_slug'            => '',
			'text_add_new_media_demo_restricted'      => '',
			'text_add_new_creating'                   => '',
			'text_add_new_create_helper_missing'      => '',
			'text_add_new_form_created'               => '',
		);

		$args = wp_parse_args( $args, $defaults );

		if ( '' === $args['template_search_or_sep'] ) {
			$args['template_search_or_sep'] = '|';
		}
		if ( '' === $args['template_search_or_sep_url'] ) {
			$args['template_search_or_sep_url'] = '^';
		}

		?>
		<script type="text/javascript">
			window.WPBC_BFB_Ajax = window.WPBC_BFB_Ajax || {};
			<?php
			foreach ( $defaults as $key => $value ) {
				if ( '' !== $args[ $key ] ) {
					?>
					window.WPBC_BFB_Ajax[<?php echo wp_json_encode( $key ); ?>] = <?php echo wp_json_encode( $args[ $key ] ); ?>;
					<?php
				}
			}
			?>
		</script>
		<?php
	}

	/**
	 * Get shared quick-search presets for template pickers.
	 *
	 * @return array
	 */
	public static function get_template_search_presets() {
		return array(
			array(
				'label'      => __( 'All', 'booking' ),
				'search_key' => '',
			),
			array(
				'label'      => __( 'Full Days', 'booking' ),
				'search_key' => 'full day|full-days',
			),
			array(
				'label'      => __( 'Time Slots', 'booking' ),
				'search_key' => 'times|time slots',
			),
			array(
				'label'      => __( 'Appointments', 'booking' ),
				'search_key' => 'appointments|service',
			),
			array(
				'label'      => __( 'Changeover', 'booking' ),
				'search_key' => 'changeover|triangles',
			),
			array(
				'label'      => __( 'Contact Form', 'booking' ),
				'search_key' => 'contact form|request form',
			),
			array(
				'label'      => __( 'Inquiry Form', 'booking' ),
				'search_key' => 'inquiry form|request form',
			),
		);
	}

	/**
	 * Print shared template picker UI.
	 *
	 * @param array $args {
	 *     @type string $context
	 *     @type string $title_label
	 *     @type string $search_label
	 *     @type string $search_input_id
	 *     @type string $search_placeholder
	 *     @type string $description
	 *     @type array  $search_presets
	 *     @type bool   $show_presets
	 * }
	 *
	 * @return void
	 */
	public static function print_section( $args = array() ) {

		$defaults = array(
			'context'            => 'default',
			'title_label'        => __( 'Choose a Template', 'booking' ),
			'search_label'       => __( 'Search Templates', 'booking' ),
			'search_input_id'    => '',
			'search_placeholder' => __( 'Type to filter by title or key...', 'booking' ),
			'description'        => '',
			'search_presets'     => array(),
			'show_presets'       => false,
		);

		$args = wp_parse_args( $args, $defaults );
		?>
		<div class="wpbc_bfb_popup_modal__container_forms_listing" data-wpbc-bfb-template-picker="<?php echo esc_attr( $args['context'] ); ?>">

			<div class="wpbc_bfb_popup_modal__row wpbc_bfb_popup_modal__row__search_key">
				<div class="wpbc_bfb_popup_modal__col" style="flex: 0 1 50%;">
					<label for="<?php echo esc_attr( $args['search_input_id'] ); ?>" style="display:block;flex:1 1 100%">
						<strong><?php echo esc_html( $args['title_label'] ); ?></strong>
					</label>
				</div>

				<div class="wpbc_bfb_popup_modal__col" style="flex: 1 1 25%;">
					<div class="wpbc_bfb_popup_modal__row" style="width: 100%;">
						<div class="wpbc_bfb_popup_modal__col wpbc_bfb_popup_modal__col__search_key_label">
							<label for="<?php echo esc_attr( $args['search_input_id'] ); ?>" style="display:block;font-weight:450;font-size:12px;">
								<span><?php echo esc_html( $args['search_label'] ); ?></span>
							</label>
						</div>
						<div class="wpbc_bfb_popup_modal__col wpbc_bfb_popup_modal__col__search_key_input">
							<input
								type="text"
								id="<?php echo esc_attr( $args['search_input_id'] ); ?>"
								class="regular-text"
								style="width:100%;"
								placeholder="<?php echo esc_attr( $args['search_placeholder'] ); ?>"
							/>
						</div>
					</div>
				</div>

				<?php if ( $args['show_presets'] && ! empty( $args['search_presets'] ) ) : ?>
					<div class="wpbc_bfb_popup_modal__col" style="flex: 1 1 100%;margin-top:-15px;margin-bottom:-10px;">
						<div class="wpbc_bfb_popup_modal__row" style="width:100%;justify-content:flex-end;">
							<div class="wpbc_bfb_popup_modal__tpl_search_presets" data-wpbc-bfb-tpl-search-presets="1">
								<?php foreach ( $args['search_presets'] as $preset ) : ?>
									<button
										type="button"
										class="button-link wpbc_bfb_popup_modal__tpl_search_preset"
										data-wpbc-bfb-tpl-search-key="<?php echo esc_attr( $preset['search_key'] ); ?>"
										aria-pressed="false"><?php echo esc_html( $preset['label'] ); ?></button>
								<?php endforeach; ?>
							</div>
						</div>
					</div>
				<?php endif; ?>

				<div class="wpbc_bfb_popup_modal__forms_loading_section" data-wpbc-bfb-tpl-list="1"></div>
			</div>

			<div class="wpbc_bfb_popup_modal__row">
				<div class="wpbc_bfb_popup_modal__col">
					<div class="description" style="margin-top:8px;">
						<?php echo esc_html( $args['description'] ); ?>
					</div>
				</div>
				<div class="wpbc_bfb_popup_modal__col">
					<div data-wpbc-bfb-tpl-pager="1" style="display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:10px;border-top:1px solid #f0f0f1;margin-left:auto;">
						<a href="#" class="button button-secondary" data-wpbc-bfb-tpl-page-prev="1" aria-disabled="true"><?php esc_html_e( 'Prev', 'booking' ); ?></a>
						<span data-wpbc-bfb-tpl-page-label="1" style="color:#666;font-size:12px;"><?php esc_html_e( 'Page', 'booking' ); ?> 1</span>
						<a href="#" class="button button-secondary" data-wpbc-bfb-tpl-page-next="1" aria-disabled="true"><?php esc_html_e( 'Next', 'booking' ); ?></a>
					</div>
				</div>
			</div>

		</div>
		<?php
	}
}