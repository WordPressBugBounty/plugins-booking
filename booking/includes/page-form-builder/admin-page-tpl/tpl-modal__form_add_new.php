<?php
/**
 * BFB Admin Templates: "Add New Form" modal.
 *
 * Prints Underscore template:
 * - tmpl-wpbc-bfb-tpl-modal-add_new_form
 *
 * Fields:
 * - Template (optional; list from DB, status=template; blank form is always available)
 * - Title (required)
 * - Slug / Form Key (required; auto-generated from title; editable)
 * - Image URL (optional; WP media)
 * - Description (optional)
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/admin-page-tpl/tpl-modal__form_add_new.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Tpl__Add_New_Form {

	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-add_new_form';
	const MODAL_DOM_ID = 'wpbc_bfb_modal__add_new_form';

	public static function register() {
		add_action( 'wpbc_hook_bfb_template__hidden_templates', array( __CLASS__, 'print_templates' ) );
	}

	public static function print_templates() {
		self::template_modal();
	}

	/**
	 * Print modal underscore template.
	 *
	 * @return void
	 */
	public static function template_modal() {

		$label_title       = __( 'Name Your Form', 'booking' );
		$label_slug        = __( 'Form Key (Slug)', 'booking' );
		$label_image       = __( 'Thumbnail Image', 'booking' );
		$label_description = __( 'Description', 'booking' );

		$help_slug = __( 'Used in shortcodes as form_type. Example: form_type="my_form". You can edit it if needed.', 'booking' );

		WPBC_BFB_Template_Picker_Section::print_js_config(
			array(
				'template_delete_label'              => __( 'Delete template', 'booking' ),
				/* translators: 1: template name */
				'template_delete_confirm'            => __( 'Delete template "%s"? This action cannot be undone.', 'booking' ),
				'template_delete_success'            => __( 'Template deleted.', 'booking' ),
				'template_delete_failed'             => __( 'Failed to delete template.', 'booking' ),
				'template_delete_missing_helper'     => __( 'WPBC BFB: template delete helper is not available.', 'booking' ),
				'text_add_new_blank_desc'            => __( 'Start with an empty layout.', 'booking' ),
				'text_add_new_empty_templates'       => __( 'No templates found. You can still create a blank form.', 'booking' ),
				'text_add_new_list_helper_missing'   => __( 'WPBC BFB: list forms helper missing.', 'booking' ),
				'text_add_new_load_failed'           => __( 'Failed to load templates list. You can still create a blank form.', 'booking' ),
				'text_add_new_picker_missing'        => __( 'WPBC BFB: Template Picker helper is not available. You can still create a blank form.', 'booking' ),
				'text_add_new_validation_title'      => __( 'Please enter a form title.', 'booking' ),
				'text_add_new_validation_slug'       => __( 'Please enter a valid form key (slug).', 'booking' ),
				'text_add_new_media_demo_restricted' => __( 'Warning! This feature is restricted in the public live demo.', 'booking' ),
				'text_add_new_creating'              => __( 'Creating...', 'booking' ),
				'text_add_new_create_helper_missing' => __( 'WPBC BFB: create helper missing.', 'booking' ),
				'text_add_new_form_created'          => __( 'Form created', 'booking' ),
			)
		);

		?>
		<script type="text/html" id="tmpl-<?php echo esc_attr( self::TPL_MODAL_ID ); ?>">
			<span class="wpdevelop">

				<div id="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>" class="modal wpbc_popup_modal wpbc_modal_in_bfb wpbc_bfb_modal__full_screen wpbc_bfb_modal__include_section_load <?php echo esc_attr( self::MODAL_DOM_ID ); ?>"
					data-backdrop="static" data-keyboard="false" data-enforce-focus="false"
					tabindex="-1" role="dialog" aria-hidden="true">

					<div class="modal-dialog">
						<div class="modal-content">

							<div class="modal-header">
								<button type="button" class="close" aria-label="<?php echo esc_attr__( 'Close', 'booking' ); ?>" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<span aria-hidden="true">&times;</span>
								</button>
								<h4 class="modal-title">
									<?php echo esc_html__( 'Add New Booking Form', 'booking' ); ?>
								</h4>
							</div>

							<div class="modal-body wpbc_bfb_popup_modal__rows_container">

								<div class="notice notice-error inline" data-wpbc-bfb-error="1" style="display:none;margin:0 0 12px 0;"></div>

								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col" style="flex: 1 1 45%;">

										<label for="wpbc_bfb_popup_modal__add_new_form__title">
											<strong><?php echo esc_html( $label_title ); ?></strong>
										</label>
										<input type="text"
											   id="wpbc_bfb_popup_modal__add_new_form__title"
											   value=""
											   class="regular-text"
											   style="margin-bottom:6px;width:100%;border: 1.7px solid #376cbe;"
										/>
										<label class="help-block" style=""> <?php esc_html_e( 'Enter your form name here', 'booking' ); ?> </label>
									</div>
									<div class="wpbc_bfb_popup_modal__col" style="flex: 0 1 590px;">
										<label for="wpbc_bfb_popup_modal__add_new_form__slug">
											<strong><?php echo esc_html( $label_slug ); ?></strong>
										</label>
										<input type="text"
											   id="wpbc_bfb_popup_modal__add_new_form__slug"
											   value=""
											   class="regular-text"
											   style="margin-bottom:6px;width:100%;"
											   placeholder="<?php esc_attr_e( 'my_form', 'booking' ); ?>"
										/>
										<label class="help-block" style=""> <?php echo esc_html( $help_slug ); ?> </label>
									</div>
								</div>
								<?php

								/* == Templates section ================================================================= */
								WPBC_BFB_Template_Picker_Section::print_section(
									array(
										'context'         => 'add_new_form',
										'search_input_id' => 'wpbc_bfb_popup_modal__add_new_form__tpl_search',
										'description'     => __( 'Choose a template (optional). If you do not select one, a blank form will be created.', 'booking' ),
										'show_presets'    => true,
										'search_presets'  => WPBC_BFB_Template_Picker_Section::get_template_search_presets(),
									)
								);

								/* == Meta fields ========================================================================= */
								?>
								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col">
										<label for="wpbc_bfb_popup_modal__add_new_form__image_url">
											<strong><?php echo esc_html( $label_image ); ?></strong>
										</label>

										<div class="wpbc_bfb_modal__image_row" style="display:flex;gap:12px;align-items:flex-start;align-self: stretch;">
											<div class="wpbc_bfb_modal__image_preview" data-wpbc-bfb-thumb="1"
												 style="padding:3px;width:110px;min-width:110px;height:78px;border:1px solid #ccd0d4;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
												<span class="description" style="padding:6px;text-align:center;">
													<?php esc_html_e( 'No Image', 'booking' ); ?>
												</span>
											</div>

											<div style="flex:1;">
												<input type="text"
													   id="wpbc_bfb_popup_modal__add_new_form__image_url"
													   value=""
													   class="regular-text"
													   style="width:100%;margin-bottom:8px;"
													   placeholder="<?php esc_attr_e( 'Optional image URL', 'booking' ); ?>"
												/>

												<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
													<a href="javascript:void(0)"
													   class="button button-secondary wpbc_media_upload_button"
													   data-modal_title="<?php echo esc_attr( __( 'Select Image', 'booking' ) ); ?>"
													   data-btn_title="<?php echo esc_attr( __( 'Select Image', 'booking' ) ); ?>"
													   data-url_field="wpbc_bfb_popup_modal__add_new_form__image_url"
													><?php esc_html_e( 'Select Image', 'booking' ); ?></a>

													<a href="javascript:void(0)" class="button button-link-delete" data-wpbc-bfb-clear-image="1" ><?php esc_html_e( 'Remove', 'booking' ); ?></a>
												</div>
											</div>
										</div>

									</div>
								</div>

								<div class="wpbc_bfb_popup_modal__row" style="margin-bottom:30px;">
									<div class="wpbc_bfb_popup_modal__col">
										<label for="wpbc_bfb_popup_modal__add_new_form__description"><strong><?php echo esc_html( $label_description ); ?></strong></label>
										<textarea id="wpbc_bfb_popup_modal__add_new_form__description" rows="2" style="width:100%;"
												  placeholder="<?php esc_attr_e( 'Optional short description...', 'booking' ); ?>"></textarea>
									</div>
								</div>

							</div>

							<div class="modal-footer">
								<a href="javascript:void(0)" class="button button-primary disabled" aria-disabled="true" data-wpbc-bfb-confirm="1">
									<?php echo esc_html__( 'Create', 'booking' ); ?>
								</a>
								<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<?php echo esc_html__( 'Cancel', 'booking' ); ?>
								</a>
							</div>

							<div class="wpbc_modal_hidden_elements" style="display:none !important;">
								<div class="wpbc_bfb_popup_modal__forms_loading_spin_container" data-wpbc-bfb-tpl-loading="1">
									<?php wpbc_bfb_spins_loading_container_mini(); ?>
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

WPBC_BFB_Tpl__Add_New_Form::register();