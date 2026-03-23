<?php
/**
 * BFB Admin Templates: Generic Confirm Delete modal.
 *
 * Prints Underscore template:
 * - tmpl-wpbc-bfb-tpl-modal-confirm-delete
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Tpl__Confirm_Delete {

	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-confirm-delete';
	const MODAL_DOM_ID = 'wpbc_bfb_modal__confirm_delete';

	public static function register() {
		add_action( 'wpbc_hook_bfb_template__hidden_templates', array( __CLASS__, 'print_templates' ) );
	}

	public static function print_templates() {
		self::template_modal();
	}

	public static function template_modal() {

		/* translators: 1: name of element to delete. */
		$msg_tpl  = __( 'Delete %s? This cannot be undone.', 'booking' );
		$msg_html = sprintf( $msg_tpl, '<strong class="wpbc_bfb__confirm_label"></strong>' );
		?>
		<script type="text/html" id="tmpl-<?php echo esc_attr( self::TPL_MODAL_ID ); ?>">
			<span class="wpdevelop">
				<div id="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>" class="modal wpbc_popup_modal wpbc_modal_in_listing" tabindex="-1" role="dialog" aria-hidden="true">

					<div class="modal-dialog">
						<div class="modal-content">

							<div class="modal-header">
								<button type="button" class="close" aria-label="<?php echo esc_attr__( 'Close', 'booking' ); ?>" data-dismiss="modal" data-wpbc-bfb-cancel="1">
									<span aria-hidden="true">&times;</span>
								</button>
								<h4 class="modal-title">
									<?php echo esc_html__( 'Confirm delete', 'booking' ); ?>
								</h4>
							</div>

							<div class="modal-body">
								<p class="help-block wpbc_bfb__confirm_message">
									<?php echo wp_kses_post( $msg_html ); ?>
								</p>
							</div>

							<div class="modal-footer">
								<a href="javascript:void(0)" class="button button-primary" data-wpbc-bfb-confirm="1">
									<?php echo esc_html__( 'Delete', 'booking' ); ?>
								</a>
								<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal" data-wpbc-bfb-cancel="1" >
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

WPBC_BFB_Tpl__Confirm_Delete::register();
