<?php
/**
 * Booking form visitor-message settings page.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Check whether the Form Messages settings tab is active.
 *
 * @return bool
 */
function wpbc_settings_messages__is_page() {

	if ( ! is_admin() ) {
		return false;
	}
	if ( function_exists( 'wpbc_is_settings_messages_page' ) ) {
		return wpbc_is_settings_messages_page();
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$page = isset( $_REQUEST['page'] ) ? sanitize_key( wp_unslash( $_REQUEST['page'] ) ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$tab = isset( $_REQUEST['tab'] ) ? sanitize_key( wp_unslash( $_REQUEST['tab'] ) ) : '';
	return ( 'wpbc-settings' === $page && 'form_messages' === $tab );
}

/**
 * Get the capability used by this settings page.
 *
 * @return string
 */
function wpbc_settings_messages__get_manage_cap() {

	if ( function_exists( 'wpbc_settings_calendar__get_manage_cap' ) ) {
		return wpbc_settings_calendar__get_manage_cap();
	}

	return 'manage_options';
}

/**
 * Get message group definitions.
 *
 * @return array
 */
function wpbc_settings_messages__get_groups() {
	return array(
		'date_selection'  => array( 'title' => __( 'Date Selection', 'booking' ), 'icon' => 'wpbc-bi-calendar3-week' ),
		'form_validation' => array( 'title' => __( 'Form Validation', 'booking' ), 'icon' => 'wpbc-bi-ui-checks' ),
		'time_validation' => array( 'title' => __( 'Time Validation', 'booking' ), 'icon' => 'wpbc-bi-clock' ),
		'submission'      => array( 'title' => __( 'Booking Submission', 'booking' ), 'icon' => 'wpbc-bi-send' ),
		'captcha'         => array( 'title' => __( 'CAPTCHA', 'booking' ), 'icon' => 'wpbc-bi-shield-check' ),
	);
}

/**
 * Enqueue page assets.
 *
 * @param string $where_to_load Asset context.
 * @return void
 */
function wpbc_settings_messages_enqueue_css_files( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_settings_messages__is_page() ) {
		return;
	}
	wp_enqueue_style(
		'wpbc-settings-messages-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/settings_messages_page.css',
		array( 'wpbc-all-admin' ),
		WP_BK_VERSION_NUM
	);
}
add_action( 'wpbc_enqueue_css_files', 'wpbc_settings_messages_enqueue_css_files', 68 );

/**
 * Enqueue page JavaScript.
 *
 * @param string $where_to_load Asset context.
 * @return void
 */
function wpbc_settings_messages_enqueue_js_files( $where_to_load ) {
	if ( ! in_array( $where_to_load, array( 'admin', 'both' ), true ) || ! wpbc_settings_messages__is_page() ) {
		return;
	}
	wp_enqueue_script(
		'wpbc-settings-messages-page',
		trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/settings_messages_page.js',
		array( 'jquery', 'wpbc_all_admin' ),
		WP_BK_VERSION_NUM,
		array( 'in_footer' => true )
	);
	wp_localize_script(
		'wpbc-settings-messages-page',
		'wpbc_settings_messages_page',
		array(
			'ajax_url' => admin_url( 'admin-ajax.php' ),
			'nonce' => wp_create_nonce( 'wpbc_settings_messages_ajax_nonce' ),
			'action' => 'WPBC_AJX_SETTINGS_MESSAGES_SAVE',
			'i18n' => array(
				'saving' => __( 'Saving', 'booking' ),
				'saved' => __( 'Form messages updated.', 'booking' ),
				'save_failed' => __( 'Unable to save form messages.', 'booking' ),
				'reset_confirm' => __( 'Restore every form message to its plugin default?', 'booking' ),
			),
		)
	);
}
add_action( 'wpbc_enqueue_js_files', 'wpbc_settings_messages_enqueue_js_files', 68 );

/**
 * Compose and validate posted form-message settings.
 *
 * @param array $post_data Raw request data.
 * @return array|WP_Error
 */
function wpbc_settings_messages__validate_data( $post_data ) {

	$registry = wpbc_frontend_messages__get_registry();
	$current_settings = wpbc_frontend_messages__get_settings();
	$messages = ! empty( $current_settings['messages'] ) && is_array( $current_settings['messages'] ) ? $current_settings['messages'] : array();
	$enabled = ! empty( $current_settings['enabled'] ) && is_array( $current_settings['enabled'] ) ? $current_settings['enabled'] : array();
	$defaults = isset( $post_data['message_default'] ) && is_array( $post_data['message_default'] ) ? $post_data['message_default'] : array();
	$translations = isset( $post_data['message_translations'] ) && is_array( $post_data['message_translations'] ) ? $post_data['message_translations'] : array();
	$raw_messages = isset( $post_data['message_raw'] ) && is_array( $post_data['message_raw'] ) ? $post_data['message_raw'] : array();
	$raw_modes = isset( $post_data['message_raw_mode'] ) && is_array( $post_data['message_raw_mode'] ) ? $post_data['message_raw_mode'] : array();
	$enabled_post = isset( $post_data['message_enabled'] ) && is_array( $post_data['message_enabled'] ) ? $post_data['message_enabled'] : array();

	foreach ( $registry as $message_key => $config ) {
		$is_message_posted = array_key_exists( $message_key, $defaults ) || array_key_exists( $message_key, $translations ) || array_key_exists( $message_key, $raw_messages ) || array_key_exists( $message_key, $raw_modes );
		if ( ! $is_message_posted ) {
			continue;
		}

		if ( isset( $raw_modes[ $message_key ] ) && is_scalar( $raw_modes[ $message_key ] ) && '1' === (string) wp_unslash( $raw_modes[ $message_key ] ) ) {
			$raw_value = isset( $raw_messages[ $message_key ] ) ? $raw_messages[ $message_key ] : '';
		} else {
				$default_text = isset( $defaults[ $message_key ] ) && is_scalar( $defaults[ $message_key ] ) ? trim( (string) $defaults[ $message_key ] ) : '';
			$message_translations = isset( $translations[ $message_key ] ) && is_array( $translations[ $message_key ] ) ? $translations[ $message_key ] : array();
			$translation_sections = array();

			foreach ( $message_translations as $locale => $translation ) {
				$locale = sanitize_text_field( wp_unslash( (string) $locale ) );
				if ( ! preg_match( '/^[A-Za-z0-9_@.\-]+$/', $locale ) || ! is_scalar( $translation ) ) {
					return new WP_Error( 'invalid_locale', __( 'A message contains an invalid locale.', 'booking' ) );
				}
				$translation = trim( (string) $translation );
				if ( '' !== $translation ) {
					$translation_sections[ $locale ] = $translation;
				}
			}

			$raw_value = $default_text;
			foreach ( $translation_sections as $locale => $translation ) {
				$raw_value .= "\n[lang=" . $locale . "]\n" . $translation;
			}
		}

		$validated = wpbc_frontend_messages__validate_value( $message_key, $raw_value );
		if ( is_wp_error( $validated ) ) {
			return new WP_Error(
				$validated->get_error_code(),
				sprintf( '%1$s: %2$s', $config['title'], $validated->get_error_message() )
			);
		}
		if ( '' !== $validated && $validated !== $config['default'] ) {
			$messages[ $message_key ] = $validated;
		} else {
			unset( $messages[ $message_key ] );
		}
		if ( ! empty( $config['optional'] ) ) {
			$enabled[ $message_key ] = isset( $enabled_post[ $message_key ] ) ? 'On' : 'Off';
		}
	}

	return array( 'version' => 1, 'messages' => $messages, 'enabled' => $enabled );
}

/**
 * Show the standard Save button in the settings top toolbar.
 *
 * @param string $page_tag Current page tag.
 * @param string $active_page_tab Current tab.
 * @param string $active_page_subtab Current subtab.
 * @return void
 */
function wpbc_settings_messages__top_toolbar_save_button( $page_tag, $active_page_tab, $active_page_subtab ) {

	if ( 'wpbc-settings' !== $page_tag || 'form_messages' !== $active_page_tab ) {
		return;
	}
	if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_messages__get_manage_cap() ) ) {
		return;
	}
	?>
	<div class="wpbc_ui_el__buttons_group wpbc_messages__top_toolbar_group">
		<a href="javascript:void(0);"
			class="button button-primary wpbc_messages__top_btn_save"
			data-wpbc-messages-save="1"
			data-wpbc-u-busy-text="<?php esc_attr_e( 'Saving', 'booking' ); ?>...">
			<i class="menu_icon icon-1x wpbc-bi-check2-circle"></i>
			<span class="in-button-text">&nbsp;&nbsp;<?php esc_html_e( 'Save Changes', 'booking' ); ?></span>
		</a>
	</div>
	<?php
}
add_action( 'wpbc_ui_el__top_nav__content_end', 'wpbc_settings_messages__top_toolbar_save_button', 20, 3 );

/**
 * Settings tab definition and page output.
 */
class WPBC_Page_Settings_Messages extends WPBC_Page_Structure {

	/** @return string */
	public function in_page() {
		return ( wpbc_is_mu_user_can_be_here( 'only_super_admin' ) && current_user_can( wpbc_settings_messages__get_manage_cap() ) ) ? 'wpbc-settings' : (string) wp_rand( 100000, 1000000 );
	}

	/** @return array */
	public function tabs() {
		return array(
			'form_messages' => array(
				'is_show_top_path' => true,
				'right_vertical_sidebar__is_show' => true,
				'right_vertical_sidebar__default_view_mode' => '',
				'right_vertical_sidebar_compact__is_show' => true,
				'left_navigation__default_view_mode' => 'compact',
				'top_path_title' => __( 'Form Messages', 'booking' ),
				'title' => __( 'Form Messages', 'booking' ),
				'hint' => __( 'Customize visitor-facing booking form notices and validation messages.', 'booking' ),
				'page_title' => __( 'Form Messages', 'booking' ),
				'link' => function_exists( 'wpbc_get_settings_messages_url' ) ? wpbc_get_settings_messages_url() : admin_url( 'admin.php?page=wpbc-settings&tab=form_messages' ), 'position' => '', 'css_classes' => 'wpbc_top_tab__form_messages',
				'icon' => '', 'font_icon' => 'wpbc-bi-chat-square-text', 'font_icon_right' => '',
				'default' => false, 'disabled' => false, 'hided' => false, 'subtabs' => array(),
				'folder_style' => 'order:22;',
			),
		);
	}

	/** @return void */
	public function right_sidebar_compact_content() {
		WPBC_UI_Sidebar_Panels::render_rightbar_tabs(
			array(
				array( 'id' => 'wpbc_tab_messages_options', 'panel_id' => 'wpbc_messages__inspector_options', 'title' => __( 'Sections', 'booking' ), 'icon' => 'wpbc-bi-list-ul', 'selected' => true ),
				array( 'id' => 'wpbc_tab_messages_help', 'panel_id' => 'wpbc_messages__inspector_help', 'title' => __( 'Help', 'booking' ), 'icon' => 'wpbc-bi-info-circle' ),
			),
			array( 'aria_label' => __( 'Form Message Panels', 'booking' ), 'context' => 'settings_messages', 'class' => 'wpbc_messages_rightbar_tabs' )
		);
	}

	/** @return void */
	public function right_sidebar_content() {
		?>
		<div class="wpbc_bfb__panel--library wpbc_rightbar_palette wpbc_messages_rightbar_panels">
			<?php
			WPBC_UI_Sidebar_Panels::render_panel(
				array( 'id' => 'wpbc_messages__inspector_options', 'labelledby' => 'wpbc_tab_messages_options', 'class' => 'wpbc_messages__inspector_options' ),
				array( $this, 'right_panel_options_content' )
			);
			WPBC_UI_Sidebar_Panels::render_panel(
				array( 'id' => 'wpbc_messages__inspector_help', 'labelledby' => 'wpbc_tab_messages_help', 'class' => 'wpbc_messages__inspector_help', 'hidden' => true ),
				array( $this, 'right_panel_help_content' )
			);
			?>
		</div>
		<?php
	}

	/** @return void */
	public function right_panel_options_content() {
		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Sections', 'booking' ), __( 'Jump directly to a message group on this page.', 'booking' ) );
		?>
		<div class="wpbc_messages_sidebar_body">
			<nav class="wpbc_messages_section_nav" aria-label="<?php esc_attr_e( 'Form message sections', 'booking' ); ?>">
				<?php foreach ( wpbc_settings_messages__get_groups() as $group_key => $group ) : ?>
					<a href="#wpbc_messages_group_<?php echo esc_attr( $group_key ); ?>"><i class="<?php echo esc_attr( $group['icon'] ); ?>" aria-hidden="true"></i><span><?php echo esc_html( $group['title'] ); ?></span></a>
				<?php endforeach; ?>
			</nav>
			<hr>
			<button type="button" class="button" data-wpbc-messages-reset-all="1"><?php esc_html_e( 'Restore All Defaults', 'booking' ); ?></button>
		</div>
		<?php
	}

	/** @return void */
	public function right_panel_help_content() {
		WPBC_UI_Sidebar_Panels::render_inspector_header( __( 'Language Shortcodes', 'booking' ), __( 'Add translations only when a custom message needs language-specific text.', 'booking' ) );
		?>
		<div class="wpbc_messages_sidebar_body">
			<p><?php esc_html_e( 'Enter the default text first, followed by one language block for each translation.', 'booking' ); ?></p>
			<pre>Default message
[lang=fr_FR]
Message en fran&ccedil;ais
[lang=de_DE]
Nachricht auf Deutsch</pre>
			<p><?php esc_html_e( 'Only plain text and valid [lang=LOCALE] blocks are accepted.', 'booking' ); ?></p>
		</div>
		<?php
	}

	/** @return void */
	public function content() {
		do_action( 'wpbc_hook_settings_page_header', 'page_settings_form_messages' );
		if ( ! wpbc_is_mu_user_can_be_here( 'only_super_admin' ) || ! current_user_can( wpbc_settings_messages__get_manage_cap() ) ) {
			return;
		}

		$registry = wpbc_frontend_messages__get_registry();
		$settings = wpbc_frontend_messages__get_settings();
		$groups   = wpbc_settings_messages__get_groups();
		?>
		<div class="wpbc_settings_messages_page">
			<form id="wpbc_settings_messages_form" class="wpbc_settings_messages_form">
				<input type="hidden" name="action" value="WPBC_AJX_SETTINGS_MESSAGES_SAVE">
				<input type="hidden" name="nonce" value="<?php echo esc_attr( wp_create_nonce( 'wpbc_settings_messages_ajax_nonce' ) ); ?>">
				<input type="hidden" name="reset_all" value="0" data-wpbc-messages-reset-input="1">
				<?php foreach ( $groups as $group_key => $group ) : ?>
					<section class="wpbc_settings_messages_group" aria-labelledby="wpbc_messages_group_<?php echo esc_attr( $group_key ); ?>">
						<h2 id="wpbc_messages_group_<?php echo esc_attr( $group_key ); ?>"><i class="<?php echo esc_attr( $group['icon'] ); ?>"></i><?php echo esc_html( $group['title'] ); ?></h2>
						<?php foreach ( $registry as $message_key => $config ) : ?>
							<?php if ( $group_key !== $config['group'] ) { continue; } ?>
							<?php
							$stored      = isset( $settings['messages'][ $message_key ] ) && is_string( $settings['messages'][ $message_key ] ) ? $settings['messages'][ $message_key ] : '';
							$field_value = ( '' !== $stored ) ? $stored : $config['default'];
							$is_enabled  = wpbc_frontend_messages__is_enabled( $message_key );
							?>
							<div class="wpbc_settings_message_row" data-message-key="<?php echo esc_attr( $message_key ); ?>">
								<label for="wpbc_message_<?php echo esc_attr( $message_key ); ?>"><strong><?php echo esc_html( $config['title'] ); ?></strong></label>
								<p class="description"><?php echo esc_html( $config['description'] ); ?></p>
								<?php if ( ! empty( $config['optional'] ) ) : ?>
									<label class="wpbc_message_enabled"><input type="checkbox" name="message_enabled[<?php echo esc_attr( $message_key ); ?>]" value="On" <?php checked( $is_enabled ); ?>> <?php esc_html_e( 'Show this message', 'booking' ); ?></label>
								<?php endif; ?>
								<input type="hidden" name="message_raw_mode[<?php echo esc_attr( $message_key ); ?>]" value="1">
								<textarea id="wpbc_message_<?php echo esc_attr( $message_key ); ?>" rows="3" name="message_raw[<?php echo esc_attr( $message_key ); ?>]" data-default-message="<?php echo esc_attr( $config['default'] ); ?>"><?php echo esc_textarea( $field_value ); ?></textarea>
								<div class="wpbc_message_row_actions"><button type="button" class="button-link" data-reset-message="1"><?php esc_html_e( 'Restore Default', 'booking' ); ?></button></div>
							</div>
						<?php endforeach; ?>
					</section>
				<?php endforeach; ?>
			</form>
		</div>
		<?php
		do_action( 'wpbc_hook_settings_page_footer', 'page_settings_form_messages' );
	}
}
add_action( 'wpbc_menu_created', array( new WPBC_Page_Settings_Messages(), '__construct' ) );
