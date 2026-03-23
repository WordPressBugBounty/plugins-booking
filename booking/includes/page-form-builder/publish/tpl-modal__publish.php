<?php
/**
 * BFB Admin Templates: "Publish" modal.
 *
 * Prints the modal window for embedding the current booking form shortcode
 * into an existing page or creating a new page via AJAX.
 *
 * Responsibilities:
 * - Enqueue bfb-publish.js on the Form Builder page.
 * - Localize AJAX config and UI strings.
 * - Print the modal HTML in the admin footer.
 *
 * @package     Booking Calendar
 * @subpackage  Booking Form Builder
 * @since       11.0.0
 * @file        ../includes/page-form-builder/publish/tpl-modal__publish.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPBC_BFB_Tpl__Publish {

	const SCRIPT_HANDLE = 'wpbc-bfb-publish';
	const MODAL_DOM_ID  = 'wpbc_bfb_modal__publish';

	/**
	 * Init hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_action( 'wpbc_hook_settings_page_footer', array( __CLASS__, 'print_modal' ), 10, 1 );
	}

	/**
	 * Check whether current admin page is the Form Builder page.
	 *
	 * @param string $page_name Optional page name from custom footer hook.
	 *
	 * @return bool
	 */
	private static function is_builder_page( $page_name = '' ) {

		if ( function_exists( 'wpbc_is_builder_booking_form_page' ) && wpbc_is_builder_booking_form_page() ) {
			return true;
		}

		if ( ! empty( $page_name ) ) {
			$page_name = (string) $page_name;

			if (
				( false !== strpos( $page_name, 'form-builder' ) ) ||
				( false !== strpos( $page_name, 'form_builder' ) ) ||
				( false !== strpos( $page_name, 'booking_form' ) )
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Get JS file URL.
	 *
	 * @return string
	 */
	private static function get_script_url() {
		return plugins_url( '_out/bfb-publish.js', __FILE__ );
	}

	/**
	 * Get JS file version.
	 *
	 * @return string
	 */
	private static function get_script_version() {

		$script_path = dirname( __FILE__ ) . '/_out/bfb-publish.js';

		if ( file_exists( $script_path ) ) {
			return (string) filemtime( $script_path );
		}

		return '1.0.0';
	}

	/**
	 * Get AJAX action name.
	 *
	 * @return string
	 */
	private static function get_ajax_action_name() {

		if ( class_exists( 'WPBC_BFB_Publish_Ajax' ) ) {
			return WPBC_BFB_Publish_Ajax::ACTION;
		}

		return 'WPBC_AJX_BFB_PUBLISH_FORM';
	}

	/**
	 * Get AJAX nonce action name.
	 *
	 * @return string
	 */
	private static function get_ajax_nonce_action_name() {

		if ( class_exists( 'WPBC_BFB_Publish_Ajax' ) ) {
			return WPBC_BFB_Publish_Ajax::NONCE_ACTION;
		}

		return 'wpbc_bfb_publish_form';
	}

	/**
	 * Get default resource ID.
	 *
	 * @return int
	 */
	private static function get_default_resource_id() {

		if ( function_exists( 'wpbc_get_default_resource' ) ) {
			return absint( wpbc_get_default_resource() );
		}

		return 1;
	}

	/**
	 * Get default form name.
	 *
	 * @return string
	 */
	private static function get_default_form_name() {

		$form_name = 'standard';

		/**
		 * Filter default BFB publish form name.
		 *
		 * @param string $form_name Default form name.
		 */
		$form_name = apply_filters( 'wpbc_bfb_publish_default_form_name', $form_name );

		$form_name = sanitize_key( $form_name );

		if ( empty( $form_name ) ) {
			$form_name = 'standard';
		}

		return $form_name;
	}

	/**
	 * Get default raw shortcode for publishing.
	 *
	 * Important:
	 * - This must be RAW shortcode only, without block comments.
	 * - The AJAX controller wraps it into Gutenberg shortcode block comments.
	 *
	 * @param int    $resource_id Booking resource ID.
	 * @param string $form_name   Form name.
	 *
	 * @return string
	 */
	private static function get_default_shortcode_raw( $resource_id, $form_name ) {

		$resource_id = absint( $resource_id );
		$form_name   = sanitize_key( $form_name );

		if ( empty( $form_name ) ) {
			$form_name = 'standard';
		}

		$shortcode_raw = "[booking resource_id={$resource_id} form_type='{$form_name}']";

		/**
		 * Filter default raw shortcode used by BFB Publish modal.
		 *
		 * @param string $shortcode_raw Raw shortcode.
		 * @param int    $resource_id   Booking resource ID.
		 * @param string $form_name     Form name.
		 */
		$shortcode_raw = apply_filters( 'wpbc_bfb_publish_default_shortcode_raw', $shortcode_raw, $resource_id, $form_name );

		return trim( $shortcode_raw );
	}

	/**
	 * Enqueue modal JS and pass AJAX config.
	 *
	 * @return void
	 */
	public static function enqueue_assets() {

		if ( ! self::is_builder_page() ) {
			return;
		}

		$default_resource_id   = self::get_default_resource_id();
		$default_form_name     = self::get_default_form_name();
		$default_shortcode_raw = self::get_default_shortcode_raw( $default_resource_id, $default_form_name );
		$is_demo               = ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() );

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			self::get_script_url(),
			array( 'jquery' ),
			self::get_script_version(),
			true
		);

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'wpbc_bfb_publish_vars',
			array(
				'ajax_url'              => admin_url( 'admin-ajax.php' ),
				'action'                => self::get_ajax_action_name(),
				'nonce'                 => wp_create_nonce( self::get_ajax_nonce_action_name() ),
				'modal_selector'        => '#' . self::MODAL_DOM_ID,
				'default_resource_id'   => $default_resource_id,
				'default_form_name'     => $default_form_name,
				'default_shortcode_raw' => $default_shortcode_raw,
				'is_demo'               => $is_demo ? 1 : 0,
				'i18n'                  => array(
					'loading'               => __( 'Publishing booking form...', 'booking' ),
					'select_page'           => __( 'Please select an existing page.', 'booking' ),
					'enter_page_title'      => __( 'Please enter a page title.', 'booking' ),
					'generic_error'         => __( 'An unexpected error occurred while publishing the booking form.', 'booking' ),
					'demo_error'            => __( 'This operation is restricted in the demo version.', 'booking' ),
					'view_page'             => __( 'Open Page', 'booking' ),
					'edit_page'             => __( 'Edit Page', 'booking' ),
					'save_step_title'       => __( 'Would you like to save the current booking form configuration before publishing?', 'booking' ),
					'save_and_continue'     => __( 'Save and Continue', 'booking' ),
					'skip_save'             => __( 'Skip', 'booking' ),
					'saving_form'           => __( 'Saving booking form...', 'booking' ),
					'save_success'          => __( 'Booking form has been saved. Continue with publishing.', 'booking' ),
					'save_timeout'          => __( 'Saving is taking longer than expected. You can wait a little longer or use Skip to continue without waiting.', 'booking' ),
					'save_failed'           => __( 'Unable to confirm that the booking form was saved.', 'booking' ),
					'save_fn_missing'       => __( 'Save function is not available. You can use Skip to continue without saving.', 'booking' ),
					'chooser_title'         => __( 'Choose whether to embed your booking form in an existing page or create a new one.', 'booking' ),
					'embed_existing'        => __( 'Embed in Existing Page', 'booking' ),
					'create_new'            => __( 'Create New Page', 'booking' ),
				),
			)
		);
	}

	/**
	 * Print Publish modal in admin footer.
	 *
	 * @param string $page_name Current page name from plugin footer hook.
	 *
	 * @return void
	 */
	public static function print_modal( $page_name ) {

		if ( ! self::is_builder_page( $page_name ) ) {
			return;
		}

		$is_demo = ( function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo() );
		?>
		<span class="wpdevelop">
			<div id="<?php echo esc_attr( self::MODAL_DOM_ID ); ?>" class="modal wpbc_popup_modal" tabindex="-1" role="dialog" aria-hidden="true">
				<style type="text/css">
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .modal-header .modal-title {
						font-weight: 600;
					}
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__notice {
						margin: 0 0 15px;
					}
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__save_step,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__chooser,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__panel {
						margin: 0;
					}
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__save_step_text,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__chooser_text,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__panel_text {
						line-height: 1.75em;
						text-align: center;
						font-size: 16px;
						font-weight: 400;
						max-width: 32em;
						margin: 0 auto 15px;
					}
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__actions,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__inputs,
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__result_actions {
						display: flex;
						flex-flow: row wrap;
						justify-content: center;
						align-items: center;
						gap: 10px;
						margin: 10px 0;
					}
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__inputs input[type="text"],
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__inputs select {
						width: min(100%, 28em);
						max-width: min(100%, 28em);
						margin: 5px 10px 10px;
						min-height: 34px;
					}
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> .wpbc_bfb_publish__result_actions {
						display: none;
						margin-top: 15px;
					}
					#<?php echo esc_attr( self::MODAL_DOM_ID ); ?> code.wpbc_inserted_shortcode_view {
						background: #d5d5d5;
						color: #444;
						line-height: 2;
						padding: 3px 10px;
					}
				</style>
				<div class="modal-dialog modal-lg0">
					<div class="modal-content">
						<div class="modal-header">
							<button type="button" class="close" data-dismiss="modal" aria-label="<?php esc_attr_e( 'Close', 'booking' ); ?>">
								<span aria-hidden="true">&times;</span>
							</button>
							<h4 class="modal-title"><?php esc_html_e( 'Publish Booking Form', 'booking' ); ?></h4>
						</div>

						<div class="modal-body">
							<div class="wpbc_bfb_publish__notice"></div>

							<input type="hidden" id="wpbc_bfb_publish__resource_id" value="" />
							<input type="hidden" id="wpbc_bfb_publish__form_name" value="" />
							<input type="hidden" id="wpbc_bfb_publish__shortcode_raw" value="" />

							<?php if ( $is_demo ) { ?>
								<div class="wpbc-settings-notice notice-warning" style="text-align:left;font-size:1rem;margin-top:0;">
									<?php esc_html_e( 'In the demo versions this operation is not allowed.', 'booking' ); ?>
								</div>
							<?php } else { ?>

								<div class="wpbc_bfb_publish__save_step">
									<div class="wpbc_bfb_publish__save_step_text">
										<?php esc_html_e( 'Would you like to save the current booking form configuration before publishing?', 'booking' ); ?>
									</div>

									<div class="wpbc_bfb_publish__actions">
										<a
											href="#"
											class="button button-primary"
											data-wpbc-bfb-publish-save-step="save"
											data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving booking form', 'booking' ); ?>..."
										>
											<?php esc_html_e( 'Save and Continue', 'booking' ); ?>
										</a>

										<a
											href="#"
											class="button button-secondary"
											data-wpbc-bfb-publish-save-step="skip"
										>
											<?php esc_html_e( 'Skip', 'booking' ); ?>
										</a>
									</div>
								</div>

								<div class="wpbc_bfb_publish__chooser" style="display:none;">
									<div class="wpbc_bfb_publish__chooser_text">
										<?php esc_html_e( 'Choose whether to embed your booking form in an existing page or create a new one.', 'booking' ); ?>
									</div>

									<div class="wpbc_bfb_publish__actions">
										<a href="#" class="button button-secondary" data-wpbc-bfb-publish-mode="edit">
											<?php esc_html_e( 'Embed in Existing Page', 'booking' ); ?>
										</a>

										<a href="#" class="button button-secondary" data-wpbc-bfb-publish-mode="create">
											<?php esc_html_e( 'Create New Page', 'booking' ); ?>
										</a>
									</div>
								</div>

								<div class="wpbc_bfb_publish__panel wpbc_bfb_publish__panel--edit" style="display:none;">
									<div class="wpbc_bfb_publish__panel_text">
										<?php esc_html_e( 'Select the page where you want to embed your booking form.', 'booking' ); ?>
									</div>

									<div class="wpbc_bfb_publish__inputs">
										<?php
										wp_dropdown_pages(
											array(
												'name'              => 'wpbc_bfb_publish_page_id',
												'id'                => 'wpbc_bfb_publish_page_id',
												'show_option_none'  => '&mdash; ' . esc_html__( 'Select', 'booking' ) . ' &mdash;',
												'option_none_value' => '0',
												'selected'          => 0,
												'post_type'         => 'page',
												'post_status'       => array( 'draft', 'publish', 'private' ),
											)
										);
										?>

										<a href="#" class="button button-primary" data-wpbc-bfb-publish-submit="edit">
											<?php esc_html_e( 'Use This Page', 'booking' ); ?>
										</a>
									</div>
								</div>

								<div class="wpbc_bfb_publish__panel wpbc_bfb_publish__panel--create" style="display:none;">
									<div class="wpbc_bfb_publish__panel_text">
										<?php esc_html_e( 'Provide a name for your new page.', 'booking' ); ?>
									</div>

									<div class="wpbc_bfb_publish__inputs">
										<input
											id="wpbc_bfb_publish_page_title"
											type="text"
											value=""
											placeholder="<?php echo esc_attr__( 'Enter Page Name', 'booking' ); ?>"
										/>

										<a href="#" class="button button-primary" data-wpbc-bfb-publish-submit="create">
											<?php esc_html_e( 'Create Page', 'booking' ); ?>
										</a>
									</div>
								</div>

								<div class="wpbc_bfb_publish__result_actions">
									<a href="#" class="button button-primary" target="_blank" rel="noopener noreferrer" data-wpbc-bfb-publish-open-page="1" style="display:none;">
										<?php esc_html_e( 'Open Page', 'booking' ); ?>
									</a>

									<a href="#" class="button button-secondary" target="_blank" rel="noopener noreferrer" data-wpbc-bfb-publish-edit-page="1" style="display:none;">
										<?php esc_html_e( 'Edit Page', 'booking' ); ?>
									</a>
								</div>

							<?php } ?>
						</div>

						<div class="modal-footer" style="display:none;">
							<a href="#" class="button button-secondary" data-wpbc-bfb-publish-back="1">
								<i class="menu_icon icon-1x wpbc_icn_keyboard_arrow_left"></i>
								<?php esc_html_e( 'Go Back', 'booking' ); ?>
							</a>
						</div>
					</div>
				</div>
			</div>
		</span>
		<?php
	}
}

WPBC_BFB_Tpl__Publish::init();