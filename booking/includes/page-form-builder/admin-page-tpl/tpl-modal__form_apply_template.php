<?php
/**
 * BFB Admin Templates: "Apply Template" modal.
 *
 * Prints Underscore template:
 * - tmpl-wpbc-bfb-tpl-modal-apply_template
 *
 * Purpose:
 * - Select an existing TEMPLATE form (status=template)
 * - Apply its structure/settings into the currently opened form (reset tool)
 * - Does NOT create a new booking form
 * - Does NOT save automatically (user still clicks "Save Form" if they want to keep changes)
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/admin-page-tpl/tpl-modal__form_apply_template.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Tpl__Apply_Template {

	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-apply_template';
	const MODAL_DOM_ID = 'wpbc_bfb_modal__apply_template';

	/**
	 * Register template printer.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wpbc_hook_bfb_template__hidden_templates', array( __CLASS__, 'print_templates' ) );
	}

	/**
	 * Print templates.
	 *
	 * @return void
	 */
	public static function print_templates() {
		self::template_modal();
	}

	/**
	 * Print modal underscore template.
	 *
	 * @return void
	 */
	public static function template_modal() {

		$label_delete_template = __( 'Delete template', 'booking' );
		/* translators: 1: template name */
		$label_delete_template_confirm      = __( 'Delete template "%s"? This action cannot be undone.', 'booking' );
		$label_delete_template_success      = __( 'Template deleted.', 'booking' );
		$label_delete_template_failed       = __( 'Failed to delete template.', 'booking' );
		$label_delete_template_missing_help = __( 'WPBC BFB: template delete helper is not available.', 'booking' );
		$text_blank_desc                    = __( 'Reset to an empty Builder layout.', 'booking' );
		$text_empty_templates               = __( 'No templates found.', 'booking' );
		$text_list_helper_missing           = __( 'WPBC BFB: list forms helper missing.', 'booking' );
		$text_load_failed                   = __( 'Failed to load templates list.', 'booking' );
		$text_picker_missing                = __( 'WPBC BFB: Template Picker helper is not available.', 'booking' );
		$text_applying                      = __( 'Applying...', 'booking' );
		$text_blank_applied                 = __( 'Blank layout applied. Click “Save Form” to keep changes.', 'booking' );
		$text_form_load_failed              = __( 'Failed to load template.', 'booking' );
		$text_applied                       = __( 'Template applied. Click “Save Form” to keep changes.', 'booking' );
		$text_modal_missing                 = __( 'WPBC BFB: Apply Template modal is not available.', 'booking' );
		$text_ajax_load_missing             = __( 'WPBC BFB: ajax load config is missing.', 'booking' );
		$text_jquery_missing                = __( 'WPBC BFB: jQuery is not available.', 'booking' );


		// UI + AJAX separator (default "|").

		WPBC_BFB_Template_Picker_Section::print_js_config(
			array(
				'template_delete_label'                   => $label_delete_template,
				'template_delete_confirm'                 => $label_delete_template_confirm,
				'template_delete_success'                 => $label_delete_template_success,
				'template_delete_failed'                  => $label_delete_template_failed,
				'template_delete_missing_helper'          => $label_delete_template_missing_help,
				'text_apply_template_blank_desc'          => $text_blank_desc,
				'text_apply_template_empty_templates'     => $text_empty_templates,
				'text_apply_template_list_helper_missing' => $text_list_helper_missing,
				'text_apply_template_load_failed'         => $text_load_failed,
				'text_apply_template_picker_missing'      => $text_picker_missing,
				'text_apply_template_applying'            => $text_applying,
				'text_apply_template_blank_applied'       => $text_blank_applied,
				'text_apply_template_form_load_failed'    => $text_form_load_failed,
				'text_apply_template_applied'             => $text_applied,
				'text_apply_template_modal_missing'       => $text_modal_missing,
				'text_apply_template_ajax_load_missing'   => $text_ajax_load_missing,
				'text_apply_template_jquery_missing'      => $text_jquery_missing,
			)
		);

		?>
		<script type="text/html" id="tmpl-<?php echo esc_attr( self::TPL_MODAL_ID ); ?>">
			<span class="wpdevelop">

				<div id="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>"
					 class="modal wpbc_popup_modal wpbc_modal_in_bfb wpbc_bfb_modal__full_screen wpbc_bfb_modal__include_section_load <?php echo esc_attr( self::MODAL_DOM_ID ); ?>"
					 data-backdrop="static" data-keyboard="false" data-enforce-focus="false"
					 tabindex="-1" role="dialog" aria-hidden="true">

					<div class="modal-dialog">
						<div class="modal-content">

							<div class="modal-header">
								<button type="button" class="close" aria-label="<?php echo esc_attr__( 'Close', 'booking' ); ?>" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<span aria-hidden="true">&times;</span>
								</button>
								<h4 class="modal-title">
									<?php echo esc_html__( 'Apply Form Template', 'booking' ); ?>
								</h4>
							</div>

							<div class="modal-body wpbc_bfb_popup_modal__rows_container">

								<div class="notice notice-error inline" data-wpbc-bfb-error="1" style="display:none;margin:0 0 12px 0;"></div>

								<div class="notice notice-warning inline" style="line-height: 2.1;">
									<?php
									echo esc_html__( 'Applying a template will replace the current Builder layout and form settings in this editor.', 'booking' );
									?>
									<br/>
									<?php
									echo esc_html__( 'Nothing is saved automatically — click “Save Form” after applying if you want to keep the changes.', 'booking' );
									?>
								</div>

								<?php
								/* == Templates section ================================================================= */
								WPBC_BFB_Template_Picker_Section::print_section(
									array(
										'context'         => 'apply_template',
										'search_input_id' => 'wpbc_bfb_popup_modal__apply_template__tpl_search',
										'description'     => __( 'Select a template to apply. You can also choose “Blank Form” to reset the Builder layout to empty.', 'booking' ),
										'show_presets'    => true,
										'search_presets'  => WPBC_BFB_Template_Picker_Section::get_template_search_presets(),
									)
								);
								?>

							</div>

							<div class="modal-footer">
								<a href="javascript:void(0)" class="button button-primary" data-wpbc-bfb-confirm="1">
									<?php echo esc_html__( 'Apply Template', 'booking' ); ?>
								</a>
								<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<?php echo esc_html__( 'Cancel', 'booking' ); ?>
								</a>
							</div>

							<div class="wpbc_modal_hidden_elements" style="display:none !important;">
								<div class="wpbc_bfb_popup_modal__forms_loading_spin_container" data-wpbc-bfb-tpl-loading="1">
									<?php
									// Reuse existing spinner helper if available.
									if ( function_exists( 'wpbc_bfb_spins_loading_container_mini' ) ) {
										wpbc_bfb_spins_loading_container_mini();
									}
									?>
								</div>
							</div>

						</div>
					</div>

				</div>
			</span>
		</script>
		<?php
	}
}

WPBC_BFB_Tpl__Apply_Template::register();