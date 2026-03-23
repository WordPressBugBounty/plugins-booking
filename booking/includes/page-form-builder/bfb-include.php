<?php
/**
 * Include all  nessacery files for the Booking From Builder (BFB)
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @since       11.0.0
 * @modified    2025-08-29
 * @version     1.0
 */

// ---------------------------------------------------------------------------------------------------------------------
// == File  bfb-include.php == Time point: 2025-08-29 12:25
// ---------------------------------------------------------------------------------------------------------------------
if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// Slug of the Builder page passed by footer hook / bootstrap.
if ( ! defined( 'WPBC_BFB_BUILDER_PAGE_SLUG' ) ) {
	define( 'WPBC_BFB_BUILDER_PAGE_SLUG', 'wpbc-ajx_booking_builder_booking_form' );
}

// Slug of the Builder page passed by footer hook / bootstrap.
if ( ! defined( 'WPBC_BFB_DEBUG' ) ) {
	define( 'WPBC_BFB_DEBUG', !false );
}

// =====================================================================================================================
// == Ajax ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/ajax/bfb-ajax.php';                                         // AJAX controller for saving / loading / listing ...

// =====================================================================================================================
// == Save / Load ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/save-load/bfb-form-manager.php';                            // Bridge between legacy booking form options and the new booking_form_structures table. Provides wpbc_form_config_load() / wpbc_form_config_save().
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/save-load/bfb-form-storage.php';                            // Low-level storage for BFB form structures. Handles DB.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/save-load/bfb-activate.php';                                // Activate / Deactivate.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/save-load/bfb-import-simple-form.php';                      // Import - Simple form - migration loader.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/save-load/bfb-import-legacy-forms.php';                     // Import - all legacy forms - migration loader.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/save-load/bfb-form-loader.php';                             // Loader.

require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/assets/template-records/bfb-activate-templates.php';        // Update Templaets on Activation.
// =====================================================================================================================
// == Admin Page UI ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/ui-parts/bfb-ui__nav_horis.php';                            // "Horisontal  top menu".

// =====================================================================================================================
// == Admin Page Templates (Tpl) ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/admin-page-tpl/class-wpbc-bfb-template-picker-section.php'; // Shared Form Teamplets Section.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/admin-page-tpl/tpl-modal_page-delete.php';                  // "Delete Page" Modal Window - WP Template for Admin page.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/admin-page-tpl/tpl-modal_item-delete.php';                  // Template for confimration  of deleting elements.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/admin-page-tpl/tpl-modal__form_add_new.php';                // Template for creation new booking form.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/admin-page-tpl/tpl-modal__form_open.php';                   // Template for loading booking forms.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/admin-page-tpl/tpl-modal__form_save_as.php';                // Template for Save As form.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/admin-page-tpl/tpl-modal__form_apply_template.php';         // Template for Apply Template to form.

// =====================================================================================================================
// == Publish (Ajax / Tpl) ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/publish/class-wpbc-bfb-publish-ajax.php';                   // Ajax Endpoint.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/publish/tpl-modal__publish.php';                            // "Publish" tpl.

// =====================================================================================================================
// == Settings Options ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/form-settings/options-render.php';                          // Save and Load different form  settings - right sidebar "Settings".
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/form-settings/options-defs.php';                            // Listing of all  Settings options.
// =====================================================================================================================
// == Current Form Details ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/form-details/current-form-details.php';                     // Current Form Details.

// =====================================================================================================================
// == Advanced Mode ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/advanced-mode/bfb-advanced-mode.php';                   // Advanced form  mode.


// =====================================================================================================================
// == Core ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/bfb-schemas.php';
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/bfb-bootstrap.php';

// =====================================================================================================================
// == Field Packs ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/section/section-wptpl.php';                     // -- Section --

// =====================================================================================================================
// == Basic Packs ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/calendar/calendar.php';                         // -- Calendar --  // Calendar - WP Template.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/email/field-email-wptpl.php';                   // -- Email --     // Email Field - WP Template.
// -- Prefilled Packs --.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/text-firstname/field-text-firstname-preset.php';   // First Name Field - based on "Text Field Pack".
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/text-secondname/field-text-secondname-preset.php'; // Second Name Field - based on "Text Field Pack".
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/static-text/field-static-text.php';             // Static Text.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/captcha/field-captcha-wptpl.php';               // -- CAPTCHA --.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/submit/submit.php';                             // -- Submit --

// =====================================================================================================================
// == Standard Packs ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/text/field-text.php';                           // -- Text -- // Reference Pack: JSON.
// require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/text/field-text-wptpl.php';                  // -- Text -- // Reference Pack: WP Template.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/textarea/textarea.php';                         // -- Textara --.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/select/field-select-wptpl.php';                 // -- Selectbox --  // Reference Pack: WP Template.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/radio/field-radio-wptpl.php';                   // -- Radio --.
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/checkbox/field-checkbox-wptpl.php';             // -- Checkbox --

// =====================================================================================================================
// == Times Packs ==
// =====================================================================================================================
// require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/time-range/time-range.php';                  // -- Time Range --
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/time-range/field-rangetime-wptpl.php';          // -- Time Range 2 --
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/time-start/field-starttime-wptpl.php';
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/time-end/field-endtime-wptpl.php';
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/time-duration/field-durationtime-wptpl.php';
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/time-duration-service/field-durationtime-service-preset.php';
// require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/time-grid/time-grid.php';                    // -- TODO: Time Grid  --.

// =====================================================================================================================
// == Structure Packs ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/wizard-nav/wizard-nav.php';                     // -- Wizard Nav. --
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/divider/divider.php';                           // -- Divider --
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/field-packs/steps-timeline/field-steps-timeline.php';       // -- Steps Timeline in Wizards --

// =====================================================================================================================
// == Page ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/bfb-ui-elements.php';
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/builder-form-page.php';

// Boot Hybrid++ for this page: collect packs, localize schemas, and hook template printing.
WPBC_BFB_Bootstrap::init();

// =====================================================================================================================
// == Preview Service ==
// =====================================================================================================================
require_once WPBC_PLUGIN_DIR . '/includes/page-form-builder/preview/bfb-preview.php';
WPBC_BFB_Preview_Service::get_instance();    // Initialize preview PHP CLASS.
