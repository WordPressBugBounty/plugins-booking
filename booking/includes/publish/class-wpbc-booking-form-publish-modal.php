<?php
/**
 * Neutral Booking Form publishing modal.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render and configure the shared Booking Form page-publishing interface.
 *
 * The modal is independent of the Resources catalog and Form Builder. Any
 * authorized administration screen can render it and open it through the
 * wpbc_publish_booking_form__open() JavaScript API.
 */
final class WPBC_Booking_Form_Publish_Modal {

	const SCRIPT_HANDLE = 'wpbc-publish-booking-form';
	const MODAL_DOM_ID  = 'wpbc_publish_booking_form__modal';

	/**
	 * Whether the script and localized configuration were registered this request.
	 *
	 * @var bool
	 */
	private static $assets_configured = false;

	/**
	 * Register the route-scoped runtime asset.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 10, 0 );
	}

	/**
	 * Enqueue the neutral publishing client on the new Resources catalog only.
	 *
	 * Other consumers can enqueue the same handle explicitly before rendering
	 * the modal. Keeping the automatic enqueue route-scoped prevents catalog
	 * assets from leaking onto unrelated administration screens.
	 *
	 * @param bool $force Whether an explicit modal consumer is requesting assets.
	 *
	 * @return void
	 */
	public static function enqueue_assets( $force = false ) {
		if ( self::$assets_configured ) {
			return;
		}

		if ( ! $force && ( ! function_exists( 'wpbc_catalog_booking_resources_is_page' ) || ! wpbc_catalog_booking_resources_is_page() ) ) {
			return;
		}

		if ( function_exists( 'wpbc_catalog_booking_resources_get_manage_capability' ) && ! current_user_can( wpbc_catalog_booking_resources_get_manage_capability() ) ) {
			return;
		}

		$script_path = WPBC_PLUGIN_DIR . '/includes/publish/_out/wpbc-publish-booking-form.js';
		$version     = file_exists( $script_path ) ? (string) filemtime( $script_path ) : WP_BK_VERSION_NUM;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			wpbc_plugin_url( '/includes/publish/_out/wpbc-publish-booking-form.js' ),
			array( 'jquery' ),
			$version,
			true
		);

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'wpbc_publish_booking_form_vars',
			array(
				'ajax_url'       => admin_url( 'admin-ajax.php', 'relative' ),
				'action'         => WPBC_Booking_Form_Publish_Ajax::ACTION,
				'pages_action'   => WPBC_Booking_Form_Publish_Ajax::LIST_PAGES_ACTION,
				'nonce'          => wp_create_nonce( WPBC_Booking_Form_Publish_Ajax::NONCE_ACTION ),
				'modal_selector' => '#' . self::MODAL_DOM_ID,
				'is_demo'        => WPBC_Booking_Form_Publisher::is_demo_restricted() ? 1 : 0,
				'i18n'           => array(
					'loading'          => __( 'Publishing booking form', 'booking' ),
					'loading_pages'    => __( 'Loading pages', 'booking' ),
					'select_page'      => __( 'Please select an existing page.', 'booking' ),
					'no_pages'         => __( 'No editable pages are available.', 'booking' ),
					'enter_page_title' => __( 'Please enter a page title.', 'booking' ),
					'generic_error'    => __( 'An unexpected error occurred while publishing the booking form.', 'booking' ),
					'demo_error'       => __( 'In the demo versions this operation is not allowed.', 'booking' ),
				),
			)
		);

		self::$assets_configured = true;
	}

	/**
	 * Print the shared native Booking Calendar publishing modal.
	 *
	 * The caller is responsible for rendering this once on an authorized screen.
	 * Page writes are always performed asynchronously through the neutral AJAX
	 * controller and are re-authorized server-side.
	 *
	 * @return void
	 */
	public static function render() {
		self::enqueue_assets( true );

		$is_demo = WPBC_Booking_Form_Publisher::is_demo_restricted();
		?>
		<span class="wpdevelop">
			<div id="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>" class="modal wpbc_popup_modal" tabindex="-1" role="dialog" aria-hidden="true" aria-labelledby="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>_title">
				<style type="text/css">
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .modal-header .modal-title { font-weight: 600; }
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__notice { margin: 0 0 15px; }
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__chooser_text,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__panel_text { font-size: 16px; font-weight: 400; line-height: 1.75em; margin: 0 auto 15px; max-width: 32em; text-align: center; }
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__actions,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__inputs,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__result_actions { align-items: center; display: flex; flex-flow: row wrap; gap: 10px; justify-content: center; margin: 10px 0; }
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__inputs input[type="text"],
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__inputs select { margin: 5px 10px 10px; max-width: min(100%, 28em); min-height: 34px; width: min(100%, 28em); }
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_publish_booking_form__result_actions { display: none; margin-top: 15px; }
				</style>
				<div class="modal-dialog modal-lg0">
					<div class="modal-content">
						<div class="modal-header">
							<button type="button" class="close" data-dismiss="modal" aria-label="<?php esc_attr_e( 'Close', 'booking' ); ?>"><span aria-hidden="true">&times;</span></button>
							<h4 id="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>_title" class="modal-title"><?php esc_html_e( 'Publish Booking Form', 'booking' ); ?></h4>
						</div>
						<div class="modal-body">
							<div class="wpbc_publish_booking_form__notice" role="status" aria-live="polite"></div>
							<input type="hidden" data-wpbc-publish-booking-form-resource-id value="" />
							<input type="hidden" data-wpbc-publish-booking-form-form-name value="standard" />
							<input type="hidden" data-wpbc-publish-booking-form-shortcode value="" />

							<?php if ( $is_demo ) : ?>
								<div class="wpbc-settings-notice notice-warning" style="text-align:left;font-size:1rem;margin-top:0;">
									<?php esc_html_e( 'In the demo versions this operation is not allowed.', 'booking' ); ?>
								</div>
							<?php else : ?>
								<div class="wpbc_publish_booking_form__chooser">
									<div class="wpbc_publish_booking_form__chooser_text"><?php esc_html_e( 'Choose whether to embed your booking form in an existing page or create a new one.', 'booking' ); ?></div>
									<div class="wpbc_publish_booking_form__actions">
										<button type="button" class="button button-secondary" data-wpbc-publish-booking-form-mode="edit"><?php esc_html_e( 'Embed in Existing Page', 'booking' ); ?></button>
										<button type="button" class="button button-secondary" data-wpbc-publish-booking-form-mode="create"><?php esc_html_e( 'Create New Page', 'booking' ); ?></button>
									</div>
								</div>

								<div class="wpbc_publish_booking_form__panel wpbc_publish_booking_form__panel--edit" style="display:none;">
									<div class="wpbc_publish_booking_form__panel_text"><?php esc_html_e( 'Select the page where you want to embed your booking form.', 'booking' ); ?></div>
									<div class="wpbc_publish_booking_form__inputs">
										<select id="wpbc_publish_booking_form_page_id" name="wpbc_publish_booking_form_page_id" data-wpbc-publish-booking-form-page-list disabled="disabled">
											<option value="0"><?php esc_html_e( 'Select', 'booking' ); ?></option>
										</select>
										<button type="button" class="button button-primary" data-wpbc-publish-booking-form-submit="edit"><?php esc_html_e( 'Use This Page', 'booking' ); ?></button>
									</div>
								</div>

								<div class="wpbc_publish_booking_form__panel wpbc_publish_booking_form__panel--create" style="display:none;">
									<div class="wpbc_publish_booking_form__panel_text"><?php esc_html_e( 'Provide a name for your new page.', 'booking' ); ?></div>
									<div class="wpbc_publish_booking_form__inputs">
										<input id="wpbc_publish_booking_form_page_title" type="text" value="" placeholder="<?php echo esc_attr__( 'Enter Page Name', 'booking' ); ?>" />
										<button type="button" class="button button-primary" data-wpbc-publish-booking-form-submit="create"><?php esc_html_e( 'Create Page', 'booking' ); ?></button>
									</div>
								</div>

								<div class="wpbc_publish_booking_form__result_actions">
									<a href="#" class="button button-primary" target="_blank" rel="noopener noreferrer" data-wpbc-publish-booking-form-open-page style="display:none;"><?php esc_html_e( 'Open Page', 'booking' ); ?></a>
									<a href="#" class="button button-secondary" target="_blank" rel="noopener noreferrer" data-wpbc-publish-booking-form-edit-page style="display:none;"><?php esc_html_e( 'Edit Page', 'booking' ); ?></a>
								</div>
							<?php endif; ?>
						</div>
						<div class="modal-footer" style="display:none;">
							<button type="button" class="button button-secondary" data-wpbc-publish-booking-form-back><i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_left" aria-hidden="true"></i> <?php esc_html_e( 'Go Back', 'booking' ); ?></button>
						</div>
					</div>
				</div>
			</div>
		</span>
		<?php
	}
}

WPBC_Booking_Form_Publish_Modal::init();
