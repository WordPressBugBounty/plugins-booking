<?php
/**
 * BFB Current Form Details UI.
 *
 * Renders UI controls for the currently loaded form:
 * - Slug / Key
 * - Title
 * - Picture (via WP Media picker in JS)
 * - Description
 *
 * Notes:
 * - Controls are "ui" scope (rendered in UI), but values are persisted per-form by JS
 *   that injects `form_details` into the "Save Form" AJAX payload.
 *
 * @package     Booking Calendar
 * @subpackage  Form Builder
 * @since       11.0.x
 * @file        includes/page-form-builder/form-details/current-form-details.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Print Current Form Details groups and controls.
 *
 * @return void
 */
function wpbc_bfb_ui__current_form_details__print() {

	$panel_id_basic = 'wpbc_bfb_form_details_panel_basic';

	?>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="form-details-basic">
		<button type="button" class="group__header" role="button" aria-expanded="true" aria-controls="<?php echo esc_attr( $panel_id_basic ); ?>">
			<h3><?php esc_html_e( 'Basic', 'booking' ); ?></h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
		</button>

		<div class="group__fields" id="<?php echo esc_attr( $panel_id_basic ); ?>" aria-hidden="false">
			<?php

			// Slug / Key.
			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'input',
					'input_type'  => 'text',
					'input_attrs' => array(
						'placeholder' => __( 'e.g. standard', 'booking' ),
						'autocomplete' => 'off',
						'spellcheck'   => 'false',
					),
					'key'     => 'bfb_form_details__form_name',
					'scope'   => 'ui',
					'default' => '',
					'label'   => __( 'Slug / Key', 'booking' ),
					'help'    => __( 'Form key used in shortcodes.', 'booking' ),
					'attr'    => array(
						'data-wpbc-bfb-form-details' => 'form_name',
					),
				)
			);

			// Title.
			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'input',
					'input_type'  => 'text',
					'input_attrs' => array(
						'placeholder' => __( 'Displayed name for this form', 'booking' ),
					),
					'key'     => 'bfb_form_details__title',
					'scope'   => 'ui',
					'default' => '',
					'label'   => __( 'Title', 'booking' ),
					'help'    => __( 'Shown in admin UI.', 'booking' ),
					'attr'    => array(
						'data-wpbc-bfb-form-details' => 'title',
					),
				)
			);

			$picture_field_id = 'wpbc_bfb_setting__bfb_form_details__picture_url';
			?>
			<label><strong><?php esc_html_e( 'Picture', 'booking' ); ?></strong></label>
			<div class="wpbc_bfb__form_details_media" data-wpbc-bfb-form-details-media="1" style="display: flex;flex-flow: column wrap;align-items: center;">
				<div class="wpbc_bfb__form_details_media__preview wpbc_media_upload_button"
					role="button"
					tabindex="0"
					aria-label="<?php echo esc_attr__( 'Selected image preview', 'booking' ); ?>" style="margin: 0 0 20px;"
					data-modal_title="<?php echo esc_attr__( 'Select Image', 'booking' ); ?>"
					data-btn_title="<?php echo esc_attr__( 'Use this image', 'booking' ); ?>"
					data-url_field="<?php echo esc_attr( $picture_field_id ); ?>"
				>
					<img src="" alt="" class="wpbc_bfb__form_details_media__img" style="display:none;max-width: 100%;height: auto;" />
					<i class="wpbc_bfb__form_details_media__placeholder menu_icon icon-1x wpbc-bi-image-fill"  aria-hidden="true"  style="display:none;"></i>
				</div>

				<div class="wpbc_bfb__form_details_media__actions">
					<button type="button" class="button wpbc_media_upload_button" id="wpbc_bfb__form_details_select_image"
							data-modal_title="<?php echo esc_attr__( 'Select Image', 'booking' ); ?>"
							data-btn_title="<?php echo esc_attr__( 'Use this image', 'booking' ); ?>"
							data-url_field="<?php echo esc_attr( $picture_field_id ); ?>"
					>
						<?php esc_html_e( 'Select image', 'booking' ); ?>
					</button>
					<button type="button" class="button" id="wpbc_bfb__form_details_remove_image">
						<?php esc_html_e( 'Remove', 'booking' ); ?>
					</button>
				</div>
			</div>
			<?php
			// Picture URL (filled by WP Media in JS).
			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'input',
					'input_type'  => 'text',
					'input_attrs' => array(
						'placeholder' => __( 'Select image…', 'booking' ),
						'readonly'    => 'readonly',
					),
					'key'     => 'bfb_form_details__picture_url',
					'scope'   => 'ui',
					'default' => '',
					'label'   => '',
					'help'    => __( 'Used as a thumbnail.', 'booking' ),
					'attr'    => array(
						'data-wpbc-bfb-form-details' => 'picture_url',
					),
				)
			);

			// Description.
			WPBC_BFB_Setting_Options::print_option(
				array(
					'type'        => 'textarea',
					'input_attrs' => array(
						'placeholder' => __( 'Short description (optional)', 'booking' ),
						'rows'        => 3,
					),
					'key'     => 'bfb_form_details__description',
					'scope'   => 'ui',
					'default' => '',
					'label'   => __( 'Description', 'booking' ),
					'help'    => __( 'Optional admin note.', 'booking' ),
					'attr'    => array(
						'data-wpbc-bfb-form-details' => 'description',
					),
				)
			);

			?>
		</div>
	</section>
	<?php

	$panel_id_danger = 'wpbc_bfb_form_details_panel_danger';
	?>
	<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="form-details-danger">
		<button type="button" class="group__header" role="button" aria-expanded="false" aria-controls="<?php echo esc_attr( $panel_id_danger ); ?>">
			<h3><?php esc_html_e( 'Danger zone', 'booking' ); ?></h3>
			<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
		</button>

		<div class="group__fields" id="<?php echo esc_attr( $panel_id_danger ); ?>" aria-hidden="true">

			<p class="description">
				<?php esc_html_e( 'Delete this custom form from the database. This action cannot be undone.', 'booking' ); ?>
			</p>

			<div class="ui_element" style="display: flex;flex-flow: column nowrap;align-items: center;">
				<button type="button"
						class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete"
						id="wpbc_bfb__form_details_delete_form"
						data-wpbc-bfb-delete-nonce="<?php echo esc_attr( wp_create_nonce( 'wpbc_bfb_form_delete' ) ); ?>"
						data-wpbc-bfb-delete-action="<?php echo esc_attr( 'WPBC_AJX_BFB_DELETE_FORM_CONFIG' ); ?>"
				>
					<span class="in-button-text"><?php esc_html_e( 'Delete form', 'booking' ); ?></span> <i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
				</button>
			</div>

			<p class="description" id="wpbc_bfb__form_details_delete_form__note" style="display:none;margin-top:6px;">
				<?php esc_html_e( 'The Standard form cannot be deleted.', 'booking' ); ?>
			</p>

		</div>
	</section>
	<?php

}
