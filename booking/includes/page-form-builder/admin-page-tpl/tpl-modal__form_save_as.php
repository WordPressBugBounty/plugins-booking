<?php
/**
 * BFB Admin Templates: "Save As" modal.
 *
 * Prints Underscore template:
 * - tmpl-wpbc-bfb-tpl-modal-save_as_form
 *
 * Fields:
 * - Title (optional, used to auto-generate slug)
 * - Slug / Form Key (required)
 * - Save Type (published|template)
 * - Image URL (optional; WP media)
 * - Description (optional)
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/admin-page-tpl/tpl-modal__form_save_as.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Tpl__Save_As_Form {

	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-save_as_form';
	const MODAL_DOM_ID = 'wpbc_bfb_modal__save_as_form';

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

		$label_title       = __( 'Save Form As', 'booking' );
		$label_slug        = __( 'Form Key (Slug)', 'booking' );
		$label_type        = __( 'Save as', 'booking' );
		$label_image       = __( 'Thumbnail Image', 'booking' );
		$label_description = __( 'Description', 'booking' );

		$help_slug = __( 'Used in shortcodes as form_type. Example: form_type="my_form".', 'booking' );
		$help_type = __( 'Templates are stored with status "template" and can be reused later.', 'booking' );

		?>
		<script type="text/html" id="tmpl-<?php echo esc_attr( self::TPL_MODAL_ID ); ?>">
			<span class="wpdevelop">

				<div id="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>" class="modal wpbc_popup_modal wpbc_modal_in_bfb wpbc_bfb_modal__full_screen"
					data-backdrop="static" data-keyboard="false" data-enforce-focus="false"
					tabindex="-1" role="dialog" aria-hidden="true">

					<div class="modal-dialog">
						<div class="modal-content">

							<div class="modal-header">
								<button type="button" class="close" aria-label="<?php echo esc_attr__( 'Close', 'booking' ); ?>" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<span aria-hidden="true">&times;</span>
								</button>
								<h4 class="modal-title">
									<?php echo esc_html__( 'Save Booking Form As', 'booking' ); ?>
								</h4>
							</div>

							<div class="modal-body wpbc_bfb_popup_modal__rows_container">

								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col" style="flex: 1 1 50%;">

										<div class="notice notice-error inline" data-wpbc-bfb-error="1" style="display:none;margin:0 0 12px 0;"></div>

										<label for="wpbc_bfb_popup_modal__save_as_form__title">
											<strong><?php echo esc_html( $label_title ); ?></strong>
										</label>

										<input type="text"
											   id="wpbc_bfb_popup_modal__save_as_form__title"
											   value=""
											   class="regular-text"
											   style="margin-bottom:12px;width:100%;"
											   placeholder="<?php esc_attr_e( 'Enter your form name here', 'booking' ); ?>..."
										/>
										<label class="help-block" style="margin:0 0 10px 0;">
											<?php echo esc_attr_e( 'Enter your form name here', 'booking' ); ?>
										</label>

									</div>
									<div class="wpbc_bfb_popup_modal__col">

										<label for="wpbc_bfb_popup_modal__save_as_form__slug">
											<strong><?php echo esc_html( $label_slug ); ?></strong>
										</label>

										<input type="text"
											   id="wpbc_bfb_popup_modal__save_as_form__slug"
											   value=""
											   class="regular-text"
											   style="font-size:14px;margin-bottom:6px;width:100%;"
											   placeholder="<?php esc_attr_e( 'my_form_copy', 'booking' ); ?>"
										/>

										<label class="help-block" style="margin:0 0 10px 0;">
											<?php echo esc_html( $help_slug ); ?>
										</label>

									</div>
								</div>

								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col" style="display: inline-flex;flex-flow: row wrap;justify-content: flex-start;align-items: first baseline;">

										<label>
											<strong><?php echo esc_html( $label_type ); ?></strong>
										</label>

										<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:5px 2em;">
											<label style="margin:0;">
												<input type="radio"
													   name="wpbc_bfb_save_as_form__save_type"
													   value="published"
													   checked="checked"
												/>
												<?php echo esc_html__( 'Regular Form', 'booking' ); ?>
											</label>

											<label style="margin:0;">
												<input type="radio"
													   name="wpbc_bfb_save_as_form__save_type"
													   value="template"
												/>
												<?php echo esc_html__( 'Template', 'booking' ); ?>
											</label>
										</div>

										<label class="help-block" style="margin:0 0 10px 0;flex: 1 1 100%;">
											<?php echo esc_html( $help_type ); ?>
										</label>

									</div>
								</div>

								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col">
										<label for="wpbc_bfb_popup_modal__save_as_form__image_url">
											<strong><?php echo esc_html( $label_image ); ?></strong>
										</label>

										<div class="wpbc_bfb_modal__image_row" style="display:flex;gap:12px;align-items:flex-start;align-self: stretch;">
											<div class="wpbc_bfb_modal__image_preview"
												 data-wpbc-bfb-thumb="1"
												 data-wpbc-bfb-open-media="1"
												 style="padding:3px;width:110px;min-width:110px;height:78px;border:1px solid #ccd0d4;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer;"
												 title="<?php echo esc_attr__( 'Click to select image', 'booking' ); ?>">
												<span class="description" style="padding:6px;text-align:center;">
													<?php esc_html_e( 'No Image', 'booking' ); ?>
												</span>
											</div>

											<div style="flex:1;">
												<input type="text"
													   id="wpbc_bfb_popup_modal__save_as_form__image_url"
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
													   data-url_field="wpbc_bfb_popup_modal__save_as_form__image_url"
													><?php esc_html_e( 'Select Image', 'booking' ); ?></a>

													<a href="javascript:void(0)"
													   class="button button-link-delete"
													   data-wpbc-bfb-clear-image="1"
													><?php esc_html_e( 'Remove', 'booking' ); ?></a>
												</div>
											</div>
										</div>

									</div>
								</div>

								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col">
										<label for="wpbc_bfb_popup_modal__save_as_form__description">
											<strong><?php echo esc_html( $label_description ); ?></strong>
										</label>
										<textarea id="wpbc_bfb_popup_modal__save_as_form__description"
												  rows="2"
												  style="width:100%;"
												  placeholder="<?php esc_attr_e( 'Optional short description...', 'booking' ); ?>"></textarea>
									</div>
								</div>

							</div>

							<div class="modal-footer">
								<a href="javascript:void(0)" class="button button-primary disabled" aria-disabled="true" data-wpbc-bfb-confirm="1">
									<?php echo esc_html__( 'Save As', 'booking' ); ?>
								</a>
								<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<?php echo esc_html__( 'Cancel', 'booking' ); ?>
								</a>
							</div>

						</div>
					</div>

				</div>
			</span>
		</script>
		<?php
	}
}

WPBC_BFB_Tpl__Save_As_Form::register();