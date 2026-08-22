<?php
/** Appointment Services presentation helpers. @package Booking Calendar */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build capability-aware semantic administration links for Providers.
 *
 * Providers remain Booking Resources. These routes expose familiar
 * Appointment terminology while preserving the existing availability and
 * Service assignment controllers as the single source of truth.
 *
 * @param int  $resource_id                Optional Provider booking resource ID.
 * @param bool $include_service_assignments Whether to include the Services-catalog shortcut.
 *
 * @return array<int,array<string,string>> Link title, URL, and icon values.
 */
function wpbc_appointment_services_get_provider_admin_links( $resource_id = 0, $include_service_assignments = true ) {
	$resource_id = absint( $resource_id );
	$links       = array();

	if ( wpbc_appointment_services_can_manage_availability() ) {
		$working_hours_url = function_exists( 'wpbc_get_general_availability_url' )
			? wpbc_get_general_availability_url()
			: admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' );
		$days_off_url = function_exists( 'wpbc_get_availability_url' )
			? wpbc_get_availability_url()
			: admin_url( 'admin.php?page=wpbc-availability' );
		$working_hours_url = add_query_arg( 'wpbc_ag_open', 'working_time', $working_hours_url );
		if ( $resource_id ) {
			$working_hours_url = add_query_arg( 'resource_id', $resource_id, $working_hours_url );
			$days_off_url      = add_query_arg( 'resource_id', $resource_id, $days_off_url );
		}
		$links[] = array(
			'title' => __( 'Working Hours', 'booking' ),
			'url'   => $working_hours_url,
			'icon'  => 'wpbc-bi-clock',
		);
		$links[] = array(
			'title' => __( 'Days Off', 'booking' ),
			'url'   => $days_off_url,
			'icon'  => 'wpbc-bi-calendar-x',
		);
	}

	if ( $include_service_assignments && current_user_can( wpbc_appointment_services_get_manage_capability() ) ) {
		$service_assignments_url = admin_url( 'admin.php?page=wpbc-services' );
		$services_link_title     = __( 'Manage Services', 'booking' );
		if ( $resource_id ) {
			$service_assignments_url = add_query_arg( 'provider_id', $resource_id, $service_assignments_url );
			$services_link_title     = __( 'Assigned Services', 'booking' );
		}
		$links[] = array(
			'title' => $services_link_title,
			'url'   => $service_assignments_url,
			'icon'  => 'wpbc-bi-grid',
		);
	}

	return (array) apply_filters( 'wpbc_appointment_provider_admin_links', $links, $resource_id, $include_service_assignments );
}

/**
 * Render semantic Provider administration links using standard WP buttons.
 *
 * @param int    $resource_id                Optional Provider booking resource ID.
 * @param string $css_class                  Optional additional wrapper class.
 * @param bool   $include_service_assignments Whether to include the Services-catalog shortcut.
 *
 * @return void
 */
function wpbc_appointment_services_render_provider_admin_links( $resource_id = 0, $css_class = '', $include_service_assignments = true ) {
	$links = wpbc_appointment_services_get_provider_admin_links( $resource_id, $include_service_assignments );
	if ( empty( $links ) ) {
		return;
	}
	?>
	<div class="wpbc_appointment_provider_links wpbc_ui_el__buttons_group <?php echo esc_attr( sanitize_html_class( $css_class ) ); ?>">
		<?php foreach ( $links as $link ) : ?>
			<a class="button button-secondary" href="<?php echo esc_url( $link['url'] ); ?>">
				<i class="menu_icon icon-1x <?php echo esc_attr( $link['icon'] ); ?>" aria-hidden="true"></i>
				<?php echo esc_html( $link['title'] ); ?>
			</a>
		<?php endforeach; ?>
	</div>
	<?php
}

/**
 * Add a mode-aware setup guide above the existing Resources table.
 *
 * Appointment mode retains Provider and Service terminology. Rental and
 * Classic modes use their native resource terminology and omit the
 * Appointment-only Services action.
 *
 * @param string $settings_section Existing Resources page section identifier.
 *
 * @return void
 */
function wpbc_appointment_services_render_provider_tools( $settings_section ) {
	if (
		'resources' !== $settings_section
		|| ! function_exists( 'wpbc_is_resources_page' )
		|| ! wpbc_is_resources_page()
	) {
		return;
	}

	$selected_mode_id  = function_exists( 'wpbc_booking_modes_get_selected_mode_id' )
		? wpbc_booking_modes_get_selected_mode_id()
		: 'classic';
	$guide_title       = __( 'Booking Resources and availability', 'booking' );
	$guide_description = __( 'Configure available weekdays and dates for each Booking Resource, then use the Publish buttons below to add its booking form to a page.', 'booking' );
	$guide_links       = array();
	$guide_html_id     = 'wpbc_resources_booking_resources_availability_guide';

	if ( 'appointment' === $selected_mode_id ) {
		$guide_title       = __( 'Provider schedules and Services', 'booking' );
		$guide_description = __( 'Providers use Booking Resources to manage availability. Configure their working hours and days off, then assign them to Services.', 'booking' );
		$guide_links       = wpbc_appointment_services_get_provider_admin_links( 0, true );
		$guide_html_id     = 'wpbc_resources_provider_services_guide';
	} else {
		if ( 'rental' === $selected_mode_id ) {
			$guide_title       = __( 'Property availability and publishing', 'booking' );
			$guide_description = __( 'Properties use Booking Resources to manage availability. Configure available weekdays and dates, then publish each property\'s booking form below.', 'booking' );
			$guide_html_id     = 'wpbc_resources_property_availability_publishing_guide';
		}

		if ( wpbc_appointment_services_can_manage_availability() ) {
			$weekdays_availability_url = function_exists( 'wpbc_get_general_availability_url' )
				? wpbc_get_general_availability_url()
				: admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' );
			$days_availability_url     = function_exists( 'wpbc_get_availability_url' )
				? wpbc_get_availability_url()
				: admin_url( 'admin.php?page=wpbc-availability' );

			$guide_links[] = array(
				'title' => ( 'rental' === $selected_mode_id ) ? __( 'Weekdays Availability', 'booking' ) : __( 'General Availability', 'booking' ),
				'url'   => $weekdays_availability_url,
				'icon'  => 'wpbc-bi-calendar-week',
			);
			$guide_links[] = array(
				'title' => __( 'Days Availability', 'booking' ),
				'url'   => $days_availability_url,
				'icon'  => 'wpbc-bi-calendar-check',
			);
		}
	}

	if ( function_exists( 'wpbc_is_dismissed_panel_visible' ) && ! wpbc_is_dismissed_panel_visible( $guide_html_id ) ) {
		return;
	}

	?>
	<div id="<?php echo esc_attr( $guide_html_id ); ?>" class="wpbc_appointment_provider_tools is-dismissible">
		<?php
		if ( function_exists( 'wpbc_is_dismissed' ) ) {
			wpbc_is_dismissed(
				$guide_html_id,
				array(
					'title'            => '<span class="wpbc-bi-x-lg" aria-hidden="true"></span><span class="screen-reader-text">' . esc_html__( 'Dismiss', 'booking' ) . '</span>',
					'hint'             => __( 'Dismiss', 'booking' ),
					'class'            => 'wpbc_appointment_provider_tools__dismiss',
					'is_apply_in_demo' => true,
				)
			);
		}
		?>
		<div class="wpbc_appointment_provider_tools__copy">
			<strong><?php echo esc_html( $guide_title ); ?></strong>
			<span><?php echo esc_html( $guide_description ); ?></span>
		</div>
		<?php if ( ! empty( $guide_links ) ) : ?>
			<div class="wpbc_appointment_provider_links wpbc_ui_el__buttons_group wpbc_appointment_provider_tools__actions">
				<?php foreach ( $guide_links as $guide_link ) : ?>
					<a class="button button-secondary" href="<?php echo esc_url( $guide_link['url'] ); ?>">
						<i class="menu_icon icon-1x <?php echo esc_attr( $guide_link['icon'] ); ?>" aria-hidden="true"></i>
						<?php echo esc_html( $guide_link['title'] ); ?>
					</a>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</div>
	<?php
}
add_action( 'wpbc_hook_settings_page_before_content_table', 'wpbc_appointment_services_render_provider_tools', 15, 1 );

/**
 * Render one disabled Service inspector field for client-side editing.
 *
 * @param string              $field_id Stable field and DOM identifier.
 * @param string              $label    User-facing field label.
 * @param string              $type     Input type, textarea, or status.
 * @param array<string,mixed> $args     Optional min, step, placeholder, help, and slider values.
 *
 * @return void
 */
function wpbc_appointment_services_render_field( $field_id, $label, $type = 'text', $args = array() ) {
	$args = wp_parse_args(
		$args,
		array(
			'min'            => '',
			'step'           => '',
			'placeholder'    => '',
			'help'           => '',
			'slider'         => false,
			'slider_min'     => 0,
			'slider_max'     => 100,
			'slider_step'    => 1,
		)
	);
	$slider_aria_label = '';
	if ( $args['slider'] ) {
		/* translators: %s: Service numeric field label. */
		$slider_aria_label = sprintf( __( 'Adjust %s', 'booking' ), $label );
	}
	?>
	<div class="inspector__row">
		<?php if ( 'status' === $type ) : ?>
			<span id="<?php echo esc_attr( $field_id ); ?>_label" class="inspector__label"><?php echo esc_html( $label ); ?></span>
		<?php else : ?>
			<label for="<?php echo esc_attr( $field_id ); ?>" class="inspector__label"><?php echo esc_html( $label ); ?></label>
		<?php endif; ?>
		<div class="inspector__control">
			<?php if ( 'textarea' === $type ) : ?>
				<textarea id="<?php echo esc_attr( $field_id ); ?>" class="inspector__input" data-service-field="<?php echo esc_attr( $field_id ); ?>" rows="4" disabled></textarea>
			<?php elseif ( 'status' === $type ) : ?>
				<input type="hidden" id="<?php echo esc_attr( $field_id ); ?>" data-service-field="<?php echo esc_attr( $field_id ); ?>" value="active" disabled />
				<div class="wpbc_appointment_services__status_options" role="radiogroup" aria-labelledby="<?php echo esc_attr( $field_id ); ?>_label">
					<label for="<?php echo esc_attr( $field_id ); ?>_active">
						<input type="radio" id="<?php echo esc_attr( $field_id ); ?>_active" name="wpbc_appointment_service_status" value="active" data-service-status-choice checked disabled />
						<span><?php esc_html_e( 'Active', 'booking' ); ?></span>
					</label>
					<label for="<?php echo esc_attr( $field_id ); ?>_inactive">
						<input type="radio" id="<?php echo esc_attr( $field_id ); ?>_inactive" name="wpbc_appointment_service_status" value="inactive" data-service-status-choice disabled />
						<span><?php esc_html_e( 'Inactive', 'booking' ); ?></span>
					</label>
					<label for="<?php echo esc_attr( $field_id ); ?>_archived">
						<input type="radio" id="<?php echo esc_attr( $field_id ); ?>_archived" name="wpbc_appointment_service_status" value="archived" data-service-status-choice disabled />
						<span><?php esc_html_e( 'Archived', 'booking' ); ?></span>
					</label>
				</div>
			<?php else : ?>
				<div class="<?php echo $args['slider'] ? 'wpbc_appointment_services__number_control' : ''; ?>">
					<input type="<?php echo esc_attr( $type ); ?>" id="<?php echo esc_attr( $field_id ); ?>" class="inspector__input" data-service-field="<?php echo esc_attr( $field_id ); ?>" <?php echo '' !== $args['min'] ? 'min="' . esc_attr( $args['min'] ) . '"' : ''; ?> <?php echo '' !== $args['step'] ? 'step="' . esc_attr( $args['step'] ) . '"' : ''; ?> placeholder="<?php echo esc_attr( $args['placeholder'] ); ?>" disabled />
					<?php if ( $args['slider'] ) : ?>
						<input type="range"
							class="wpbc_appointment_services__number_slider"
							data-service-range-field="<?php echo esc_attr( $field_id ); ?>"
							data-service-range-default-min="<?php echo esc_attr( $args['slider_min'] ); ?>"
							data-service-range-default-max="<?php echo esc_attr( $args['slider_max'] ); ?>"
							min="<?php echo esc_attr( $args['slider_min'] ); ?>"
							max="<?php echo esc_attr( $args['slider_max'] ); ?>"
							step="<?php echo esc_attr( $args['slider_step'] ); ?>"
							value="<?php echo esc_attr( $args['slider_min'] ); ?>"
							aria-label="<?php echo esc_attr( $slider_aria_label ); ?>"
							disabled />
					<?php endif; ?>
				</div>
			<?php endif; ?>
			<?php if ( $args['help'] ) : ?>
				<p class="description wpbc_bfb__help"><?php echo esc_html( $args['help'] ); ?></p>
			<?php endif; ?>
		</div>
	</div>
	<?php
}

/**
 * Render the Service image selector using the shared WordPress media library.
 *
 * The URL is stored with the Service payload while the media attachment remains
 * managed by WordPress. A readonly URL field keeps the AJAX editor contract
 * transparent and allows the common media-uploader helper to populate it.
 *
 * @return void
 */
function wpbc_appointment_services_render_picture_field() {
	?>
	<div class="inspector__row wpbc_ui_listing__picture_row wpbc_appointment_services__picture_row">
		<label for="picture_url" class="inspector__label"><?php esc_html_e( 'Picture', 'booking' ); ?></label>
		<div class="inspector__control">
			<div class="wpbc_ui_listing__media wpbc_appointment_services__media">
				<button type="button" class="wpbc_ui_listing__media_preview wpbc_appointment_services__media_preview wpbc_media_upload_button" data-modal_title="<?php esc_attr_e( 'Select Service Image', 'booking' ); ?>" data-btn_title="<?php esc_attr_e( 'Use this image', 'booking' ); ?>" data-url_field="picture_url" aria-label="<?php esc_attr_e( 'Select Service image', 'booking' ); ?>" disabled>
					<img alt="" class="wpbc_ui_listing__media_image wpbc_appointment_services__media_image" hidden />
					<i class="wpbc_ui_listing__media_placeholder wpbc_appointment_services__media_placeholder menu_icon icon-1x wpbc-bi-image-fill" aria-hidden="true"></i>
				</button>
				<div class="wpbc_ui_listing__media_actions wpbc_appointment_services__media_actions wpbc_ui_el__buttons_group">
					<button type="button" class="button wpbc_media_upload_button wpbc_appointment_services__select_image" data-modal_title="<?php esc_attr_e( 'Select Service Image', 'booking' ); ?>" data-btn_title="<?php esc_attr_e( 'Use this image', 'booking' ); ?>" data-url_field="picture_url" disabled><?php esc_html_e( 'Select image', 'booking' ); ?></button>
					<button type="button" class="button wpbc_appointment_services__remove_image" disabled><?php esc_html_e( 'Remove', 'booking' ); ?></button>
				</div>
			</div>
			<input type="text" id="picture_url" class="inspector__input" data-service-field="picture_url" value="" placeholder="<?php esc_attr_e( 'Select image...', 'booking' ); ?>" readonly disabled />
			<p class="description wpbc_bfb__help"><?php esc_html_e( 'Used in the Services catalog and Appointment selection.', 'booking' ); ?></p>
		</div>
	</div>
	<?php
}

/**
 * Render the general Service fields for the inspector callback.
 *
 * @return void
 */
function wpbc_appointment_services_render_general_fields() {
	wpbc_appointment_services_render_field( 'title', __( 'Service title', 'booking' ), 'text', array( 'placeholder' => __( 'Example: Initial Consultation', 'booking' ) ) );
	wpbc_appointment_services_render_field( 'description', __( 'Description', 'booking' ), 'textarea' );
	wpbc_appointment_services_render_picture_field();
	wpbc_appointment_services_render_field( 'status', __( 'Status', 'booking' ), 'status' );
}

/**
 * Render duration and buffer fields for the inspector.
 *
 * @return void
 */
function wpbc_appointment_services_render_scheduling_fields() {

	wpbc_appointment_services_render_field(
		'duration_minutes',
		__( 'Duration (minutes)', 'booking' ),
		'number',
		array(
			'min'         => 1,
			'step'        => 1,
			'slider'      => true,
			'slider_min'  => 1,
			'slider_max'  => 480,
			'slider_step' => 5,
		)
	);
	wpbc_appointment_services_render_field(
		'buffer_before_minutes',
		__( 'Buffer before (minutes)', 'booking' ),
		'number',
		array(
			'min'         => 0,
			'step'        => 1,
			'slider'      => true,
			'slider_min'  => 0,
			'slider_max'  => 180,
			'slider_step' => 5,
		)
	);
	wpbc_appointment_services_render_field(
		'buffer_after_minutes',
		__( 'Buffer after (minutes)', 'booking' ),
		'number',
		array(
			'min'         => 0,
			'step'        => 1,
			'slider'      => true,
			'slider_min'  => 0,
			'slider_max'  => 180,
			'slider_step' => 5,
		)
	);
}

/**
 * Render Service pricing fields for the inspector.
 *
 * @return void
 */
function wpbc_appointment_services_render_pricing_fields() {
	if ( ! wpbc_appointment_services_is_pricing_available() ) {
		?>
		<div class="inspector__row wpbc_appointment_services__pricing_upgrade">
			<div class="inspector__control">
				<div class="inspector__label">
					<?php esc_html_e( 'Service price', 'booking' ); ?>
					<a class="wpbc_pro_label" href="<?php echo esc_url( 'https://wpbookingcalendar.com/features/' ); ?>" target="_blank" rel="noopener noreferrer">BS+</a>
				</div>
				<p class="description wpbc_bfb__help"><?php esc_html_e( 'Service pricing and online payments are available in Booking Calendar Business Small or higher. Service scheduling remains fully available in this edition.', 'booking' ); ?></p>
			</div>
		</div>
		<?php
		return;
	}

	wpbc_appointment_services_render_field( 'base_cost', __( 'Base price', 'booking' ), 'number', array(
		'min'         => 0,
		'step'        => 1,
		'slider'      => true,
		'slider_min'  => 0,
		'slider_max'  => 1000,
		'slider_step' => 1,
	) );
}

/**
 * Render the existing booking-resource choices as assigned Providers.
 *
 * @return void
 */
function wpbc_appointment_services_render_provider_fields() {
	?>
	<div class="inspector__row">
		<label for="resource_ids" class="inspector__label"><?php esc_html_e( 'Assigned Providers', 'booking' ); ?></label>
		<div class="inspector__control">
			<select id="resource_ids" class="inspector__input" data-service-field="resource_ids" multiple size="6" disabled>
				<?php foreach ( wpbc_appointment_services_get_provider_options() as $resource_id => $title ) : ?>
					<option value="<?php echo absint( $resource_id ); ?>"><?php echo esc_html( $title ); ?></option>
				<?php endforeach; ?>
			</select>
			<p class="description wpbc_bfb__help"><?php esc_html_e( 'Select every Provider who can perform this Service. Providers use the availability of their Booking Calendar resource.', 'booking' ); ?></p>
			<?php wpbc_appointment_services_render_provider_admin_links( 0, 'wpbc_appointment_provider_links--inspector', false ); ?>
		</div>
	</div>
	<?php
}

/**
 * Render the Booking Form assignment field for the inspector.
 *
 * @return void
 */
function wpbc_appointment_services_render_form_fields() {
	?>
	<div class="inspector__row">
		<label for="booking_form_id" class="inspector__label"><?php esc_html_e( 'Booking Form', 'booking' ); ?></label>
		<div class="inspector__control">
			<select id="booking_form_id" class="inspector__input" data-service-field="booking_form_id" disabled>
				<?php foreach ( wpbc_appointment_services_get_form_options() as $form_id => $title ) : ?>
					<option value="<?php echo absint( $form_id ); ?>"><?php echo esc_html( $title ); ?></option>
				<?php endforeach; ?>
			</select>
		</div>
	</div>
	<?php
}

/**
 * Render duplicate and archive actions for the inspector.
 *
 * @return void
 */
function wpbc_appointment_services_render_advanced_fields() {
	?>
	<button type="button" class="button wpbc_appointment_services__duplicate" disabled><?php
		esc_html_e( 'Duplicate Service', 'booking' ); ?></button>
	<button type="button" class="button button-link-delete wpbc_appointment_services__archive" disabled><?php
	esc_html_e( 'Archive Service', 'booking' ); ?></button><?php
}

/**
 * Render the complete Service Settings inspector panel.
 *
 * @return void
 */
function wpbc_appointment_services_render_settings_panel() {
	?>
	<div class="wpbc_appointment_services__operation_host" data-wpbc-appointment-services-operation-host hidden></div>
	<div data-wpbc-appointment-services-native-inspector>
	<div data-wpbc-appointment-service-inspector-header>
		<?php WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Service Settings', 'booking' ), __( 'Select a Service or create a new one.', 'booking' ) ); ?>
	</div>
	<?php
	WPBC_UI_Sidebar_Panels::render_collapsible_group( array(
		'id'    => 'wpbc_service_general',
		'group' => 'service-general',
		'title' => __( 'General', 'booking' ),
		'open'  => true,
	), 'wpbc_appointment_services_render_general_fields' );
	WPBC_UI_Sidebar_Panels::render_collapsible_group( array(
		'id'    => 'wpbc_service_scheduling',
		'group' => 'service-scheduling',
		'title' => __( 'Scheduling', 'booking' ),
		'open'  => true,
	), 'wpbc_appointment_services_render_scheduling_fields' );
	WPBC_UI_Sidebar_Panels::render_collapsible_group( array(
		'id'    => 'wpbc_service_pricing',
		'group' => 'service-pricing',
		'title' => __( 'Pricing', 'booking' ),
	), 'wpbc_appointment_services_render_pricing_fields' );
	WPBC_UI_Sidebar_Panels::render_collapsible_group( array(
		'id'    => 'wpbc_service_providers',
		'group' => 'service-providers',
		'title' => __( 'Providers', 'booking' ),
	), 'wpbc_appointment_services_render_provider_fields' );
	WPBC_UI_Sidebar_Panels::render_collapsible_group( array(
		'id'    => 'wpbc_service_form',
		'group' => 'service-form',
		'title' => __( 'Booking Form', 'booking' ),
	), 'wpbc_appointment_services_render_form_fields' );
	WPBC_UI_Sidebar_Panels::render_collapsible_group( array(
		'id'    => 'wpbc_service_advanced',
		'group' => 'service-advanced',
		'title' => __( 'Advanced', 'booking' ),
	), 'wpbc_appointment_services_render_advanced_fields' );
	?></div><?php
}

/**
 * Render the Service editor action in the native right-sidebar footer.
 *
 * The footer is outside the SimpleBar scrolling element so Save Service is
 * immediately visible and remains available while inspector widgets scroll.
 * JavaScript reveals it only while the Settings panel has an open editor.
 *
 * @param array $active_page_arr Active page, tab, and subtab identifiers.
 *
 * @return void
 */
function wpbc_appointment_services_render_right_sidebar_footer( $active_page_arr ) {
	if (
		empty( $active_page_arr['active_page'] )
		|| 'wpbc-services' !== $active_page_arr['active_page']
		|| ! wpbc_appointment_services__is_page()
		|| ! current_user_can( wpbc_appointment_services_get_manage_capability() )
	) {
		return;
	}
	?>
	<div class="wpbc_ui_el__vert_right_bar__footer_section wpbc_appointment_services__right_sidebar_footer" hidden>
		<div class="wpbc_appointment_services__top_actions wpbc_appointment_services__footer_actions wpbc_ui_el__buttons_group" hidden>
			<button type="button" class="button wpbc_appointment_services__cancel" data-wpbc-appointment-services-cancel hidden disabled>
				<?php esc_html_e( 'Cancel', 'booking' ); ?>
			</button>
			<button type="button" class="button button-primary wpbc_appointment_services__save" hidden disabled>
				<?php esc_html_e( 'Save Service', 'booking' ); ?>
			</button>
			<button type="button" class="button button-primary wpbc_appointment_services__operation_review" hidden disabled><?php esc_html_e( 'Review changes', 'booking' ); ?></button>
			<button type="button" class="button button-primary wpbc_appointment_services__operation_apply" hidden disabled><?php esc_html_e( 'Apply changes', 'booking' ); ?></button>
		</div>
	</div>
	<?php
}
add_action( 'wpbc_ui__right_vertical_sidebar_footer', 'wpbc_appointment_services_render_right_sidebar_footer', 10, 1 );

/**
 * Render contextual help for the Service and Provider data model.
 *
 * @return void
 */
function wpbc_appointment_services_render_help_panel() {
	WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'About Services', 'booking' ), __( 'How Services work with the existing Booking Calendar architecture.', 'booking' ) );
	?>
	<div class="wpbc_appointment_services__help"><p><?php
			if ( wpbc_appointment_services_is_pricing_available() ) {
				esc_html_e( 'A Service describes what a customer can book. Its settings define the appointment duration, preparation and recovery buffers, price, and Booking Form.', 'booking' );
			} else {
				esc_html_e( 'A Service describes what a customer can book. Its settings define the appointment duration, preparation and recovery buffers, Providers, and Booking Form.', 'booking' );
			}
			?></p>
	<h4><?php
		esc_html_e( 'Providers and availability', 'booking' ); ?></h4>
	<p><?php
		esc_html_e( 'Providers remain Booking Calendar resources because every Provider needs an independent availability calendar.', 'booking' ); ?></p>
	<ul>
		<li><?php
			esc_html_e( 'The weekday dots are a recurring weekly summary. A weekday is available when General Availability allows it and, when Working Time is enabled, the Provider has at least one working interval that day.', 'booking' ); ?></li>
		<li><?php
			esc_html_e( 'The summary does not check Seasons, date-specific days off, existing bookings, time-slot rules, Service duration, or buffers. The customer booking calendar performs those complete checks for the selected date and time.', 'booking' ); ?></li>
		<li><?php
			esc_html_e( 'When several Providers are assigned, a green dot means at least one of them is normally available that weekday. Point to the dot to see which Providers are included.', 'booking' ); ?></li>
		<li><?php
			esc_html_e( 'Use the Provider initials below the dots to open that Provider\'s Working Time settings directly.', 'booking' ); ?></li>
	</ul>
	<h4><?php
		esc_html_e( 'Getting started', 'booking' ); ?></h4>
	<ol>
		<li><?php
			esc_html_e( 'Add a Service and enter its duration.', 'booking' ); ?></li>
		<li><?php
			esc_html_e( 'Assign at least one Provider.', 'booking' ); ?></li>
		<li><?php
			esc_html_e( 'Select a Booking Form and save the Service.', 'booking' ); ?></li>
		<li><?php
			esc_html_e( 'Add the [booking_appointment] shortcode to the page where customers should make Appointments.', 'booking' ); ?></li>
	</ol>
		<h4><?php esc_html_e( 'Appointment shortcode', 'booking' ); ?></h4>
		<p><code>[booking_appointment]</code></p>
		<p><?php esc_html_e( 'Optional parameters:', 'booking' ); ?></p>
		<ul>
			<li><code>service_id</code>, <code>provider_id</code> &mdash; <?php esc_html_e( 'restrict the flow to one Service or Provider.', 'booking' ); ?></li>
			<li><code>services</code>, <code>providers</code> &mdash; <?php esc_html_e( 'comma-separated lists of allowed Service or Provider IDs; Services follow the supplied order.', 'booking' ); ?></li>
			<li><code>form_type</code> &mdash; <?php esc_html_e( 'override the Booking Form selected in the Service.', 'booking' ); ?></li>
			<li><code>nummonths</code>, <code>startmonth</code> &mdash; <?php esc_html_e( 'set the calendar count and initial month.', 'booking' ); ?></li>
			<li><code>calendar_dates_start</code>, <code>calendar_dates_end</code> &mdash; <?php esc_html_e( 'limit the calendar to an inclusive date range in YYYY-MM-DD format.', 'booking' ); ?></li>
			<li><code>options</code> &mdash; <?php esc_html_e( 'pass supported native Booking Calendar options.', 'booking' ); ?></li>
			<li><code>auto_select_provider</code> &mdash; <?php esc_html_e( 'use "on" to skip the Provider step when only one compatible Provider exists; disabled by default.', 'booking' ); ?></li>
			<li><code>show_progress</code> &mdash; <?php esc_html_e( 'use "off" to hide the numbered Appointment progress line.', 'booking' ); ?></li>
			<li><code>progress_item_1_title</code> through <code>progress_item_3_title</code> &mdash; <?php esc_html_e( 'replace the three titles shown below the progress numbers; use an empty value to hide a title.', 'booking' ); ?></li>
			<li><code>progress_item_1_number</code> through <code>progress_item_3_number</code> &mdash; <?php esc_html_e( 'replace the displayed progress numbers; use an empty value to hide a number.', 'booking' ); ?></li>
			<li><code>screen_1_title</code>, <code>screen_1_description</code>, <code>screen_2_title</code>, <code>screen_2_description</code> &mdash; <?php esc_html_e( 'replace the Service and Provider screen headings; use an empty value to hide an element.', 'booking' ); ?></li>
			<li><code>allow_past</code> &mdash; <?php esc_html_e( 'use "on" to allow administrators or controlled workflows to select past dates.', 'booking' ); ?></li>
		</ul>
		<p><code>[booking_appointment service_id=&quot;12&quot; provider_id=&quot;5&quot;]</code></p>
		<p><code>[booking_appointment progress_item_1_title=&quot;&quot; progress_item_1_number=&quot;01/03&quot; progress_item_2_title=&quot;Specialist&quot; progress_item_3_title=&quot;Schedule &amp; Details&quot;]</code></p>
	</div><?php
}
