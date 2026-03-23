<?php
/**
 * BFB Admin Templates: Page Controls + Confirm Delete Page modal.
 *
 * Prints Underscore templates consumed by bfb-ui.js via wp.template():
 * - tmpl-wpbc-bfb-tpl-page-remove
 * - tmpl-wpbc-bfb-tpl-modal-page-delete
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/admin-page-tpl/tpl-page-delete.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Templates for "Delete page" action.
 */
class WPBC_BFB_Tpl__Page_Delete {

	/**
	 * Action key (also used by JS as data-wpbc-bfb-action).
	 *
	 * @var string
	 */
	const ACTION = 'bfb_action__page_delete';

	/**
	 * WP template ids (without the "tmpl-" prefix).
	 *
	 * @var string
	 */
	const TPL_PAGE_CONTROLS = 'wpbc-bfb-tpl-page-remove';
	const TPL_MODAL_DELETE  = 'wpbc-bfb-tpl-modal-page-delete';


	/**
	 * Register templates output.
	 *
	 * @return void
	 */
	public static function register() {
		add_action( 'wpbc_hook_bfb_template__hidden_templates', array( __CLASS__, 'print_templates' ) );
	}

	/**
	 * Check capability for this action.
	 *
	 * @return bool
	 */
	public static function user_can() {
		return true; // (bool) wpbc_is_user_can( self::ACTION, wpbc_get_current_user_id() ); //.
	}

	/**
	 * Print all templates (called by the hidden templates hook).
	 *
	 * @return void
	 */
	public static function print_templates() {
		self::template_page_controls();
		self::template_modal();
	}


	/**
	 * Template: page header controls (contains "Page X" + delete button + optional dropdown).
	 *
	 * JS usage:
	 * wp.template('wpbc-bfb-tpl-page-remove')({ page_number: 1 })
	 *
	 * @return void
	 */
	public static function template_page_controls() {
		?>
		<script type="text/html" id="tmpl-<?php echo esc_attr( self::TPL_PAGE_CONTROLS ); ?>">
			<div class="wpbc_bfb__controls">
				<h3 class="wpbc_bfb__page_number">
					<?php echo esc_html__( 'Page', 'booking' ); ?> {{ data.page_number }}

					<?php if ( self::user_can() ) : ?>
						<button type="button"
								class="wpbc_bfb__page_delete_btn wpbc_bfb__field-remove-btn"
								data-wpbc-bfb-action="<?php echo esc_attr( self::ACTION ); ?>"
								aria-label="<?php echo esc_attr__( 'Remove page', 'booking' ); ?>"
								title="<?php echo esc_attr__( 'Remove page', 'booking' ); ?>">
							<i class="menu_icon icon-1x wpbc_icn_close"></i>
						</button>
					<?php endif; ?>
				</h3>
			</div>
		</script>
		<?php
	}

	/**
	 * Template: confirm "Delete page" modal.
	 *
	 * JS usage:
	 * wp.template('wpbc-bfb-tpl-modal-page-delete')({ page_number: 1 })
	 *
	 * @return void
	 */
	public static function template_modal() {

		if ( ! self::user_can() ) {
			return;
		}
		?>
		<script type="text/html" id="tmpl-<?php echo esc_attr( self::TPL_MODAL_DELETE ); ?>">
			<span class="wpdevelop">
				<div id="wpbc_bfb_modal__page_delete" class="modal wpbc_popup_modal wpbc_modal_in_listing" tabindex="-1" role="dialog" aria-hidden="true">
					<div class="modal-dialog">
						<div class="modal-content">
							<div class="modal-header">
								<button type="button" class="close" data-dismiss="modal" aria-label="<?php echo esc_attr__( 'Close', 'booking' ); ?>">
									<span aria-hidden="true">&times;</span>
								</button>
								<h4 class="modal-title">
									<?php echo esc_html__( 'Delete page', 'booking' ); ?>
									<sup class="wpbc_bfb__modal_page_number">{{ data.page_number }}</sup>
								</h4>
							</div>

							<div class="modal-body">
								<p class="help-block">
									<?php echo esc_html__( 'This will remove the entire page and all its sections and fields.', 'booking' ); ?>
								</p>
								<p class="help-block">
									<?php echo esc_html__( 'This action cannot be undone.', 'booking' ); ?>
								</p>
							</div>

							<div class="modal-footer">
								<a href="javascript:void(0)"
								   class="button button-primary wpbc_bfb__modal_confirm"
								   data-wpbc-bfb-action="<?php echo esc_attr( self::ACTION ); ?>"
								   data-wpbc-bfb-confirm="1">
									<?php echo esc_html__( 'Delete', 'booking' ); ?>
								</a>
								<a href="javascript:void(0)" class="button button-secondary" data-dismiss="modal">
									<?php echo esc_html__( 'Cancel', 'booking' ); ?>
								</a>
							</div>
						</div><!-- /.modal-content -->
					</div><!-- /.modal-dialog -->
				</div><!-- /.modal -->
			</span>
		</script>
		<?php
	}
}

// Register templates.
WPBC_BFB_Tpl__Page_Delete::register();

/**
 * How it works:
 *
 *    ┌──────────────────────────────────────────────────────────────────────────────┐
 *    │ A) Page header controls exist (template rendered somewhere in Builder UI)     │
 *    └──────────────────────────────────────────────────────────────────────────────┘
 *    PHP template: tmpl-wpbc-bfb-tpl-page-remove
 *      - shows "Page X"
 *      - contains button:
 *          data-wpbc-bfb-action="bfb_action__page_delete"
 *
 *    User clicks delete button
 *      |
 *      v
 *    ┌──────────────────────────────────────────────────────────────────────────────┐
 *    │ B) Page Delete module catches click (event delegation)                        │
 *    └──────────────────────────────────────────────────────────────────────────────┘
 *    UI.WPBC_BFB_Page_Delete_Confirm._on_trigger_click (capturing=true)
 *      - finds closest [data-wpbc-bfb-action="bfb_action__page_delete"]
 *      - finds closest page container: .wpbc_bfb__panel--preview
 *      - calls _open_modal_for_page(page_el, ...)
 *
 *      |
 *      v
 *    ┌──────────────────────────────────────────────────────────────────────────────┐
 *    │ C) Ensure modal exists in DOM (lazy insert from wp.template)                  │
 *    └──────────────────────────────────────────────────────────────────────────────┘
 *    _open_modal_for_page():
 *      page_number = page_el.getAttribute('data-page')
 *
 *      ensure = UI.Templates.ensure_dom_ref_from_wp_template
 *      ref = ensure(
 *              tpl_modal_id = "wpbc-bfb-tpl-modal-page-delete",
 *              dom_id       = "wpbc_bfb_modal__page_delete",
 *              data         = { page_number }
 *            )
 *
 *      If modal already exists in DOM:
 *         - ensure() returns existing modal node (no duplicates)
 *      Else:
 *         - render wp.template() HTML
 *         - insert first root element into DOM
 *         - return the actual element + id
 *
 *      modal_el.__wpbc_bfb_page_el = page_el   (store the page node being deleted)
 *
 *      UI.Modals.show(modal_id)
 *        - prefer jQuery wpbc_my_modal('show')
 *        - else fallback: modal_el.style.display = 'block'
 *
 *      |
 *      v
 *    ┌──────────────────────────────────────────────────────────────────────────────┐
 *    │ D) Confirm click inside modal                                                  │
 *    └──────────────────────────────────────────────────────────────────────────────┘
 *    Document click handler (capturing=true)
 *      - looks for:
 *          #wpbc_bfb_modal__page_delete
 *            [data-wpbc-bfb-confirm="1"]
 *            [data-wpbc-bfb-action="bfb_action__page_delete"]
 *
 *    If confirm clicked:
 *      - modal_el = document.getElementById('wpbc_bfb_modal__page_delete')
 *      - page_el  = modal_el.__wpbc_bfb_page_el
 *      - clear modal_el.__wpbc_bfb_page_el
 *
 *      - _remove_page_el(page_el)
 *      - UI.Modals.hide(modal_el)
 *          jQuery wpbc_my_modal('hide') OR display='none'
 *
 *      |
 *      v
 *    ┌──────────────────────────────────────────────────────────────────────────────┐
 *    │ E) Removing page and syncing Builder UI                                        │
 *    └──────────────────────────────────────────────────────────────────────────────┘
 *    _remove_page_el(page_el):
 *      - if current selection is inside this page:
 *          neighbor = find a field on another page to select afterwards
 *
 *      - page_el.remove()
 *      - builder.usage.update_palette_ui()
 *
 *      - emit STRUCTURE_CHANGE:
 *          builder.bus.emit(WPBC_BFB_Events.STRUCTURE_CHANGE, {
 *            source: 'page-remove',
 *            structure: builder.get_structure(),
 *            page_el
 *          })
 *
 *      - builder.select_field(neighbor || null)
 *
 */