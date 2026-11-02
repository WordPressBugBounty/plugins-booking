<?php
/**
 * Bootstrap for the Add New Booking Inspector domain.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'WPBC_ENABLE_12_0_BOOKING_NEW_INSPECTOR' ) || true !== WPBC_ENABLE_12_0_BOOKING_NEW_INSPECTOR ) {
	return;
}

require_once __DIR__ . '/class-wpbc-booking-new-inspector-config.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-contract.php';
require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-form-definition-repository.php';
require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-structured-field-resolver.php';
require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-schedule-proposal-normalizer.php';
require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-native-calendar-contract-builder.php';
require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-logged-user-autofill.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-authorization.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-resource-repository.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-form-repository.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-field-dto-mapper.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-autofill.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-form-validator.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-form-serializer.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-notes.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-timeline-seed.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-edition-capabilities.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-bootstrap-service.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-bootstrap-endpoint.php';
require_once __DIR__ . '/ajax/booking-new-inspector-bootstrap-ajax.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-schedule-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-schedule-policy.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-schedule-service.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-schedule-endpoint.php';
require_once __DIR__ . '/ajax/booking-new-inspector-schedule-ajax.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-cost-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-cost-calculator.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-cost-service.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-cost-endpoint.php';
require_once __DIR__ . '/ajax/booking-new-inspector-cost-ajax.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-review-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-availability-service.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-review-service.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-review-endpoint.php';
require_once __DIR__ . '/ajax/booking-new-inspector-review-ajax.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-apply-request-validator.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-idempotency-repository.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-creation-repository.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-creation-service.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-apply-service.php';
require_once __DIR__ . '/class-wpbc-booking-new-inspector-apply-endpoint.php';
require_once __DIR__ . '/ajax/booking-new-inspector-apply-ajax.php';

/**
 * Exposes Add New Booking Inspector contracts and its development-gated
 * Timeline creation workflow.
 *
 * Phase 10 completes the host-owned Timeline readback after authenticated,
 * idempotent Apply while preserving the canonical booking lifecycle,
 * server-side authority, and compiler-owned asset boundary.
 *
 * @since 12.0.0
 */
if ( ! class_exists( 'WPBC_Booking_New_Inspector', false ) ) {
	final class WPBC_Booking_New_Inspector {

		/**
		 * Whether the read-only domain completed bootstrap.
		 *
		 * @since 12.0.0
		 * @var bool
		 */
		private static $is_bootstrapped = false;

		/**
		 * Register authenticated reads and the development-gated Timeline host.
		 *
		 * Registration is idempotent at module-load level and has no persistence
		 * side effects.
		 *
		 * @since 12.0.0
		 * @return void
		 */
		public static function bootstrap() {
			if ( self::$is_bootstrapped ) {
				return;
			}

			if ( function_exists( 'add_action' ) ) {
				add_action(
					'wp_ajax_' . WPBC_Booking_New_Inspector_Config::ACTION_BOOTSTRAP,
					'wpbc_booking_new_inspector_ajax_bootstrap'
				);
				add_action(
					'wp_ajax_' . WPBC_Booking_New_Inspector_Config::ACTION_SCHEDULE,
					'wpbc_booking_new_inspector_ajax_schedule'
				);
				add_action(
					'wp_ajax_' . WPBC_Booking_New_Inspector_Config::ACTION_COST_PREVIEW,
					'wpbc_booking_new_inspector_ajax_cost_preview'
				);
				add_action(
					'wp_ajax_' . WPBC_Booking_New_Inspector_Config::ACTION_REVIEW,
					'wpbc_booking_new_inspector_ajax_review'
				);
				add_action(
					'wp_ajax_' . WPBC_Booking_New_Inspector_Config::ACTION_APPLY,
					'wpbc_booking_new_inspector_ajax_apply'
				);
				add_action( 'wpbc_booking_new_inspector_cleanup_idempotency', array( 'WPBC_Booking_New_Inspector_Idempotency_Repository', 'cleanup_expired_claim' ) );
				add_action( 'wpbc_hook_booking_template__hidden_templates', array( __CLASS__, 'print_templates' ) );
				add_action(
					'wpbc_ui_el__top_nav__content_end',
					array( __CLASS__, 'render_timeline_top_navigation_action' ),
					19,
					3
				);
			}

			if ( function_exists( 'add_filter' ) ) {
				add_filter( 'wpbc_timeline_new_booking_action', array( __CLASS__, 'filter_timeline_new_booking_action' ), 10, 2 );
				add_filter( 'wpbc_timeline_selection_new_booking_action', array( __CLASS__, 'filter_timeline_selection_new_booking_action' ), 10, 2 );
				add_filter( 'wpbc_timeline_script_dependencies', array( __CLASS__, 'filter_timeline_script_dependencies' ), 10, 2 );
			}

			self::$is_bootstrapped = true;
		}

		/**
		 * Report whether the enabled read-only boundary was loaded.
		 *
		 * @since 12.0.0
		 * @return bool True when the module bootstrap completed.
		 */
		public static function is_bootstrapped() {
			return self::$is_bootstrapped;
		}

		/**
		 * Render the authorized New Booking anchor in the Timeline top navigation.
		 *
		 * The shared top-navigation action slot is the server-owned location shown
		 * above the Timeline workspace. The canonical URL remains operational when
		 * JavaScript or the Inspector adapter is unavailable. Visibility never acts
		 * as authorization; bootstrap repeats every capability and ownership check.
		 *
		 * @since 12.0.0
		 * @param string $page_tag           Current Booking Calendar page tag.
		 * @param string $active_page_tab    Current Booking Calendar tab.
		 * @param string $active_page_subtab Current Booking Calendar subtab.
		 * @return false|void False outside the authorized Timeline route.
		 */
		public static function render_timeline_top_navigation_action( $page_tag, $active_page_tab, $active_page_subtab ) {
			unset( $active_page_subtab );

			if (
				'wpbc' !== $page_tag
				|| 'timeline' !== $active_page_tab
				|| ! function_exists( 'wpbc_timeline_is_page' )
				|| ! wpbc_timeline_is_page()
			) {
				return false;
			}

			$timeline_authorization = class_exists( 'WPBC_Timeline_Authorization' )
				? new WPBC_Timeline_Authorization()
				: null;
			$is_timeline_authorized = $timeline_authorization && $timeline_authorization->current_user_can_view();
			$action                 = self::filter_timeline_new_booking_action( array(), $is_timeline_authorized );

			if (
				empty( $action['visible'] )
				|| empty( $action['action_id'] )
				|| empty( $action['launch_context'] )
				|| empty( $action['label'] )
				|| empty( $action['accessible_name'] )
				|| empty( $action['url'] )
			) {
				return false;
			}
			?>
			<div class="wpbc_ui_el__buttons_group wpbc_booking_new_inspector__top_navigation_action">
				<a
					id="<?php echo esc_attr( $action['action_id'] ); ?>"
					class="button button-primary"
					href="<?php echo esc_url( $action['url'] ); ?>"
					aria-label="<?php echo esc_attr( $action['accessible_name'] ); ?>"
					data-wpbc-booking-new-inspector-open="<?php echo esc_attr( $action['launch_context'] ); ?>"
				><?php echo esc_html( $action['label'] ); ?></a>
			</div>
			<?php
		}

		/**
		 * Supply the authorized Timeline empty-launch action and Inspector transport.
		 *
		 * The canonical URL remains usable without JavaScript. Browser interception
		 * receives only a site-bound read nonce and executable-free configuration;
		 * the bootstrap endpoint repeats capability and ownership checks.
		 *
		 * @since 12.0.0
		 * @param mixed $current_action Existing action DTO from earlier filters.
		 * @param bool  $timeline_authorized Whether Timeline read access passed.
		 * @return array<string,mixed> Authorized action DTO or an empty array.
		 */
		public static function filter_timeline_new_booking_action( $current_action, $timeline_authorized ) {
			$authorization = new WPBC_Booking_New_Inspector_Authorization();
			if ( ! $timeline_authorized || ! $authorization->current_user_can_bootstrap() ) {
				return array();
			}

			$canonical_url = function_exists( 'wpbc_get_new_booking_url' )
				? wpbc_get_new_booking_url( true, false )
				: add_query_arg( array( 'page' => 'wpbc', 'tab' => 'add-booking' ), admin_url( 'admin.php' ) );

			return array(
				'visible'         => true,
				'action_id'       => WPBC_Booking_New_Inspector_Config::TIMELINE_TOOLBAR_ACTION_ID,
				'launch_context'  => WPBC_Booking_New_Inspector_Config::TIMELINE_TOOLBAR_LAUNCH_CONTEXT,
				'label'           => __( 'New Booking', 'booking' ),
				'accessible_name' => __( 'Create a new booking', 'booking' ),
				'url'             => esc_url_raw( $canonical_url ),
				'inspector'       => self::get_browser_configuration( $canonical_url ),
			);
		}

		/**
		 * Add a stable Inspector marker to an authorized Timeline selection action.
		 *
		 * The Timeline preview remains the owner of authorization, availability,
		 * and the signed canonical URL. This module adds only a surface-specific
		 * launch marker when its own Add Booking authorization also passes.
		 *
		 * @since 12.0.0
		 * @param mixed $current_action Existing authorized selection action DTO.
		 * @param mixed $selection      Validated Timeline selection DTO.
		 * @return array<string,mixed> Action DTO with an optional launch marker.
		 */
		public static function filter_timeline_selection_new_booking_action( $current_action, $selection ) {
			$current_action = is_array( $current_action ) ? $current_action : array();
			$selection      = is_array( $selection ) ? $selection : array();
			$authorization  = new WPBC_Booking_New_Inspector_Authorization();

			if (
				empty( $current_action['authorized'] )
				|| empty( $current_action['enabled'] )
				|| empty( $current_action['url'] )
				|| ! $authorization->current_user_can_bootstrap()
			) {
				return $current_action;
			}

			$selection_surface = isset( $selection['selection_surface'] )
				? sanitize_key( (string) $selection['selection_surface'] )
				: '';

			if ( 'native_axis' === $selection_surface ) {
				$current_action['launch_context'] = WPBC_Booking_New_Inspector_Config::TIMELINE_SELECTION_LAUNCH_CONTEXT;
			} elseif ( 'time_rows' === $selection_surface ) {
				$current_action['launch_context'] = WPBC_Booking_New_Inspector_Config::TIMELINE_TIME_ROWS_LAUNCH_CONTEXT;
			}
			if ( ! empty( $current_action['launch_context'] ) ) {
				$current_action['label'] = __( 'New Booking', 'booking' );
			}

			return $current_action;
		}

		/**
		 * Build the executable-free browser contract for the Timeline host.
		 *
		 * @since 12.0.0
		 * @param string $canonical_url Authorized no-JavaScript Add Booking URL.
		 * @return array<string,mixed> Browser configuration containing scalars and arrays only.
		 */
		private static function get_browser_configuration( $canonical_url ) {
			/**
			 * Filters whether an accepted Timeline readback opens the existing
			 * read-only Booking Inspector for the newly created booking.
			 *
			 * The default keeps the creation Inspector in its persisted-success
			 * state. The Timeline still selects and highlights the authoritative
			 * record. This presentation choice never changes creation authority.
			 *
			 * @since 12.0.0
			 * @param bool $open_created_booking_inspector Whether to hand off after readback.
			 */
			$open_created_booking_inspector = function_exists( 'apply_filters' )
				? (bool) apply_filters( 'wpbc_booking_new_inspector_open_created_booking', false )
				: false;

			return array(
				'component_id'                   => WPBC_Booking_New_Inspector_Config::COMPONENT_ID,
				'schema_version'                 => WPBC_Booking_New_Inspector_Config::SCHEMA_VERSION,
				'templates'                      => WPBC_Booking_New_Inspector_Config::get_template_ids(),
				'shared_template'                => class_exists( 'WPBC_Shared_UI_Inspector' ) ? WPBC_Shared_UI_Inspector::get_template_id() : '',
				'canonical_url'                  => esc_url_raw( $canonical_url ),
				'launch_contexts'                => array(
					'toolbar'            => WPBC_Booking_New_Inspector_Config::TIMELINE_TOOLBAR_LAUNCH_CONTEXT,
					'timeline_selection' => WPBC_Booking_New_Inspector_Config::TIMELINE_SELECTION_LAUNCH_CONTEXT,
					'timeline_time_rows' => WPBC_Booking_New_Inspector_Config::TIMELINE_TIME_ROWS_LAUNCH_CONTEXT,
				),
				'handoff_query_arg'              => WPBC_Booking_New_Inspector_Config::TIMELINE_HANDOFF_QUERY_ARG,
				'max_context_token_bytes'        => WPBC_Booking_New_Inspector_Config::MAX_CONTEXT_TOKEN_BYTES,
				'open_created_booking_inspector' => $open_created_booking_inspector,
				'transport'                      => array(
					'url'              => admin_url( 'admin-ajax.php' ),
					'bootstrap_action' => WPBC_Booking_New_Inspector_Config::ACTION_BOOTSTRAP,
					'bootstrap_nonce'  => wp_create_nonce( WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'bootstrap' ) ),
					'schedule_action'  => WPBC_Booking_New_Inspector_Config::ACTION_SCHEDULE,
					'schedule_nonce'   => wp_create_nonce( WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'schedule' ) ),
					'cost_action'      => WPBC_Booking_New_Inspector_Config::ACTION_COST_PREVIEW,
					'cost_nonce'       => wp_create_nonce( WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'cost_preview' ) ),
					'review_action'    => WPBC_Booking_New_Inspector_Config::ACTION_REVIEW,
					'review_nonce'     => wp_create_nonce( WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'review' ) ),
					'apply_action'     => WPBC_Booking_New_Inspector_Config::ACTION_APPLY,
					'apply_nonce'      => wp_create_nonce( WPBC_Booking_New_Inspector_Config::get_site_nonce_action( 'apply' ) ),
				),
				'i18n'                           => array(
					'title'             => __( 'Add New Booking', 'booking' ),
					'subtitle'          => __( 'Complete the authorized booking details and schedule.', 'booking' ),
					'close'             => __( 'Close Add New Booking', 'booking' ),
					'loading'           => __( 'Loading Add New Booking', 'booking' ),
					'loading_title'     => __( 'Loading booking details', 'booking' ),
					'loaded'            => __( 'Add New Booking is ready.', 'booking' ),
					'load_failed'       => __( 'Add New Booking could not be loaded. Use the full Add Booking page or try again.', 'booking' ),
					'error_title'       => __( 'Add New Booking could not be loaded', 'booking' ),
					'empty_title'       => __( 'No booking choices are available', 'booking' ),
					'empty_message'     => __( 'No authorized Booking Resource or Booking Form is available. Use the full Add Booking page or contact an administrator.', 'booking' ),
					'retry'             => __( 'Try again', 'booking' ),
					'booking_form'      => __( 'Booking Form', 'booking' ),
					'booking_resource'  => __( 'Booking Resource', 'booking' ),
					'resource_and_form' => __( 'Resource and Booking Form', 'booking' ),
					'resource_and_form_help' => __( 'Choose only from Resources and forms authorized for your account.', 'booking' ),
					'booking_details'   => __( 'Booking details', 'booking' ),
					'booking_details_help' => __( 'Required fields are marked with an asterisk.', 'booking' ),
					'no_booking_fields' => __( 'This Booking Form has no customer detail fields.', 'booking' ),
					'notes'             => __( 'Notes', 'booking' ),
					'review_notes'      => __( 'Notes', 'booking' ),
					'note_not_set'      => __( 'Not set', 'booking' ),
					'schedule'          => __( 'Schedule', 'booking' ),
					'schedule_help'     => __( 'Availability and booking rules are loaded from the native calendar.', 'booking' ),
					'loading_schedule'  => __( 'Loading current availability.', 'booking' ),
					'schedule_failed'   => __( 'The schedule could not be loaded. Use the full Add Booking page or try again.', 'booking' ),
					'schedule_required'  => __( 'Select at least one booking date before continuing.', 'booking' ),
					'schedule_not_ready' => __( 'Finish loading the schedule and correct its dates or times before continuing.', 'booking' ),
					'reset_dates'       => __( 'Reset dates', 'booking' ),
					'selection_method'  => __( 'Date selection', 'booking' ),
					'select_dates'      => __( 'Select dates', 'booking' ),
					'selected_dates'    => __( 'Selected dates', 'booking' ),
					'dates_selected'    => __( 'dates selected', 'booking' ),
					'apply_times_as'    => __( 'Apply times as', 'booking' ),
					'start_time'        => __( 'Start time', 'booking' ),
					'end_time'          => __( 'End time', 'booking' ),
					'no_dates'          => __( 'No dates selected.', 'booking' ),
					'cost'              => __( 'Cost', 'booking' ),
					'cost_unavailable'  => __( 'Select the booking dates and times to calculate the cost.', 'booking' ),
					'cost_unavailable_short' => __( 'Not available', 'booking' ),
					'recalculate_cost'  => __( 'Recalculate cost', 'booking' ),
					'calculating_cost'  => __( 'Calculating the current booking cost.', 'booking' ),
					'cost_calculated'   => __( 'Cost preview calculated.', 'booking' ),
					'cost_stale'        => __( 'Booking details changed. Updating the cost.', 'booking' ),
					'cost_failed'       => __( 'The cost could not be calculated. Review the booking details or use the full Add Booking page.', 'booking' ),
					'cost_correction'   => __( 'Booking cost', 'booking' ),
					'cost_upgrade_message' => __( 'Cost calculation and correction in this Inspector are available in Booking Calendar Business Small or higher. You can still review and create this booking.', 'booking' ),
					'dismiss'           => __( 'Dismiss', 'booking' ),
					'dismiss_cost_upgrade' => __( 'Dismiss the cost feature upgrade message', 'booking' ),
					'cancel'            => __( 'Cancel', 'booking' ),
					'discard_changes'   => __( 'You have unsaved booking changes. Discard them?', 'booking' ),
					'open_full_page'    => __( 'Open full Add Booking', 'booking' ),
					'review_and_create' => __( 'Review and create', 'booking' ),
					'reviewing'         => __( 'Reviewing the current booking details.', 'booking' ),
					'review_failed'     => __( 'The booking could not be reviewed. Correct the highlighted details or use the full Add Booking page.', 'booking' ),
					'review_incomplete'  => __( 'Complete the required booking details and select at least one booking date before continuing.', 'booking' ),
					'field_required'    => __( 'This field is required.', 'booking' ),
					'review_title'      => __( 'Review booking', 'booking' ),
					'review_resource'   => __( 'Booking Resource', 'booking' ),
					'review_form'       => __( 'Booking Form', 'booking' ),
					'review_schedule'   => __( 'Dates and times', 'booking' ),
					'full_days'         => __( 'Full days', 'booking' ),
					'review_boundary_schedule' => __( 'Starts {start_date} at {start_time} and ends {end_date} at {end_time}', 'booking' ),
					'review_per_date_schedule' => __( '{start_time} - {end_time} on every selected date', 'booking' ),
					'review_fields'     => __( 'Customer details', 'booking' ),
					'review_cost'       => __( 'Cost', 'booking' ),
					'review_email'      => __( 'Email', 'booking' ),
					'review_approval'   => __( 'Initial status', 'booking' ),
					'email_default'     => __( 'Use the current Add Booking email setting', 'booking' ),
					'create_booking'    => __( 'Create booking', 'booking' ),
					'creating_booking'  => __( 'Creating the booking. Keep this Inspector open while the saved result is verified.', 'booking' ),
					'created_title'     => __( 'Booking created', 'booking' ),
					'created_message'   => __( 'The booking was created successfully.', 'booking' ),
					'refreshing_timeline'  => __( 'Refreshing the Timeline with the saved booking.', 'booking' ),
					'timeline_refreshed'   => __( 'The saved booking is selected in the refreshed Timeline.', 'booking' ),
					'timeline_record_not_visible' => __( 'The Timeline was refreshed, but the saved booking is outside the current Resource view.', 'booking' ),
					'timeline_refresh_failed'     => __( 'The booking was created, but the Timeline could not be refreshed. Retry the Timeline readback; do not create the booking again.', 'booking' ),
					'retry_timeline_refresh'      => __( 'Retry Timeline refresh', 'booking' ),
					'create_failed'     => __( 'The booking could not be created safely. Review the message before trying again.', 'booking' ),
					'booking_number'    => __( 'Booking ID', 'booking' ),
					'unsupported_title' => __( 'This Booking Form needs the full Add Booking page', 'booking' ),
					'unsupported_message' => __( 'This form contains controls that are not supported by the Inspector.', 'booking' ),
				),
			);
		}

		/**
		 * Print the fixed domain-owned WordPress templates on the Timeline only.
		 *
		 * No request value participates in template selection. The single file is
		 * resolved under this module's template directory and contains only the
		 * stable IDs returned by the configuration allow list.
		 *
		 * @since 12.0.0
		 * @return void
		 */
		public static function print_templates() {
			static $templates_printed = false;

			if ( $templates_printed || ! function_exists( 'wpbc_timeline_is_page' ) || ! wpbc_timeline_is_page() ) {
				return;
			}

			$template_root = realpath( __DIR__ . '/templates' );
			$template_path = realpath( __DIR__ . '/templates/booking-new-inspector-wptpl.php' );
			if ( false === $template_root || false === $template_path || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) || ! is_readable( $template_path ) ) {
				return;
			}

			$templates_printed = true;
			require $template_path;
		}

		/**
		 * Enqueue compiler-owned Timeline adapter assets when both outputs exist.
		 *
		 * Source files remain the editable authority. Missing generated output keeps
		 * the canonical top-navigation link functional and never causes a request warning.
		 *
		 * @since 12.0.0
		 * @param mixed $script_dependencies Timeline entry-point dependencies.
		 * @param mixed $timeline_configuration Executable-free Timeline configuration.
		 * @return array<int,string> Normalized Timeline dependencies.
		 */
		public static function filter_timeline_script_dependencies( $script_dependencies, $timeline_configuration ) {
			$script_dependencies = is_array( $script_dependencies ) ? $script_dependencies : array();
			$authorization       = new WPBC_Booking_New_Inspector_Authorization();
			$schedule_path       = __DIR__ . '/_out/booking-new-inspector-schedule.js';
			$adapter_path        = __DIR__ . '/_out/booking-new-inspector.js';
			$style_path          = __DIR__ . '/_out/booking-new-inspector.css';

			if (
				! function_exists( 'wpbc_timeline_is_page' )
				|| ! wpbc_timeline_is_page()
				|| ! $authorization->current_user_can_bootstrap()
				|| ! is_readable( $schedule_path )
				|| ! is_readable( $adapter_path )
			) {
				return $script_dependencies;
			}

			$schedule_modified = filemtime( $schedule_path );
			$adapter_modified  = filemtime( $adapter_path );
			$style_modified    = is_readable( $style_path ) ? filemtime( $style_path ) : false;
			$schedule_version  = false !== $schedule_modified ? WP_BK_VERSION_NUM . '.' . $schedule_modified : WP_BK_VERSION_NUM;
			$adapter_version   = false !== $adapter_modified ? WP_BK_VERSION_NUM . '.' . $adapter_modified : WP_BK_VERSION_NUM;
			$style_version     = false !== $style_modified ? WP_BK_VERSION_NUM . '.' . $style_modified : WP_BK_VERSION_NUM;

			if ( is_readable( $style_path ) ) {
				wp_enqueue_style(
					WPBC_Booking_New_Inspector_Config::STYLE_HANDLE,
					trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-new-inspector.css',
					array( WPBC_Shared_UI_Inspector::STYLE_HANDLE ),
					$style_version
				);
			}

			wp_enqueue_script(
				WPBC_Booking_New_Inspector_Config::SCHEDULE_SCRIPT_HANDLE,
				trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-new-inspector-schedule.js',
				array( 'jquery' ),
				$schedule_version,
				array( 'in_footer' => WPBC_JS_IN_FOOTER )
			);
			wp_enqueue_script(
				WPBC_Booking_New_Inspector_Config::ADAPTER_SCRIPT_HANDLE,
				trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/booking-new-inspector.js',
				array( 'jquery', 'wp-util', WPBC_Shared_UI_Inspector::SCRIPT_HANDLE, WPBC_Booking_New_Inspector_Config::SCHEDULE_SCRIPT_HANDLE ),
				$adapter_version,
				array( 'in_footer' => WPBC_JS_IN_FOOTER )
			);

			$script_dependencies[] = WPBC_Booking_New_Inspector_Config::ADAPTER_SCRIPT_HANDLE;

			return array_values( array_unique( $script_dependencies ) );
		}
	}
}

WPBC_Booking_New_Inspector::bootstrap();
