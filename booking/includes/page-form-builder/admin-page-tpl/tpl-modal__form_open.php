<?php
/**
 * BFB Admin Templates: "Load Form" modal (list all forms for current user).
 *
 * Prints Underscore template:
 * - tmpl-wpbc-bfb-tpl-modal-load_form
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/admin-page-tpl/tpl-modal__form_open.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Tpl__Load_Form {

	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-load_form';
	const MODAL_DOM_ID = 'wpbc_bfb_modal__load_form';

	public static function register() {
		add_action( 'wpbc_hook_bfb_template__hidden_templates', array( __CLASS__, 'print_templates' ) );
	}

	public static function print_templates() {
		self::template_modal();
	}

	public static function template_modal() {

		$label_search = __( 'Search', 'booking' );

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
								<h4 class="modal-title"><?php echo esc_html__( 'Load Booking Form', 'booking' ); ?></h4>
							</div>

							<div class="modal-body wpbc_bfb_popup_modal__rows_container">

								<div class="notice notice-error inline" data-wpbc-bfb-error="1" style="display:none;margin:0 0 12px 0;"></div>

								<div class="wpbc_bfb_popup_modal__row wpbc_bfb_popup_modal__row__search_key" style="margin-bottom:10px;">
									<div class="wpbc_bfb_popup_modal__col wpbc_bfb_popup_modal__col__search_key_label">
										<label for="wpbc_bfb_popup_modal__load_form__search" style="display:block;"><strong><?php echo esc_html( $label_search ); ?></strong></label>
									</div>
									<div class="wpbc_bfb_popup_modal__col wpbc_bfb_popup_modal__col__search_key_input">
										<input type="text"
											id="wpbc_bfb_popup_modal__load_form__search"
											class="regular-text"
											style="width:100%;"
											placeholder="<?php esc_attr_e( 'Type to filter by title or key...', 'booking' ); ?>"
										/>
									</div>
								</div>

								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col">
										<div class="wpbc_bfb_popup_modal__forms_loading_section" data-wpbc-bfb-forms-list="1" ></div>
									</div>
								</div>

								<div class="wpbc_bfb_popup_modal__row">
									<div class="wpbc_bfb_popup_modal__col">
										<div class="description" style="margin-top:8px;">
											<?php esc_html_e( 'Select a form, then click “Load”.', 'booking' ); ?>
										</div>
									</div>
									<div class="wpbc_bfb_popup_modal__col">
										<div data-wpbc-bfb-forms-pager="1" style="display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:10px;border-top:1px solid #f0f0f1;margin-left:auto;">
											<a href="#" class="button button-secondary" data-wpbc-bfb-page-prev="1" aria-disabled="true"><?php esc_html_e( 'Prev', 'booking' ); ?></a>
											<span data-wpbc-bfb-page-label="1" style="color:#666;font-size:12px;"><?php esc_html_e( 'Page', 'booking' ); ?> 1</span>
											<a href="#" class="button button-secondary" data-wpbc-bfb-page-next="1" aria-disabled="true"><?php esc_html_e( 'Next', 'booking' ); ?></a>
										</div>
									</div>
								</div>

							</div>

							<div class="modal-footer">
								<a href="javascript:void(0)" class="button button-primary disabled" aria-disabled="true" data-wpbc-bfb-confirm="1">
									<?php echo esc_html__( 'Load', 'booking' ); ?>
								</a>
								<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<?php echo esc_html__( 'Cancel', 'booking' ); ?>
								</a>
							</div>
							<div class="wpbc_modal_hidden_elements" style="display:none !important;">
								<div class="wpbc_bfb_popup_modal__forms_loading_spin_container" data-wpbc-bfb-forms-loading="1">
									<?php
										wpbc_bfb_spins_loading_container_mini();
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

WPBC_BFB_Tpl__Load_Form::register();
