<?php
/**
 * Reusable date, time, and local-language editor for Setup Wizard Step 3.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the Step 3 field contract and the explicit Local translation operation.
 *
 * Reading the step is side-effect free. The only canonical mutation is exposed
 * through {@see install_site_local_translation()} and must be called by the
 * separately authorized AJAX action after an explicit user click.
 */
final class WPBC_Setup_Wizard_Date_Time_Formats {

	/**
	 * Return the ordered draft field identifiers owned by this editor.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array( 'date_format', 'time_format', 'start_day_of_week' );
	}

	/**
	 * Return fields required when the consumer advances.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields() {
		return $this->get_field_names();
	}

	/**
	 * Return current settings or safe read-only suggestions.
	 *
	 * @return array<string,string> Initial field values.
	 */
	public function get_initial_values() {
		return array(
			'date_format'       => $this->get_initial_choice( 'booking_date_format', 'date_format', $this->get_date_formats(), 'j M Y' ),
			'time_format'       => $this->get_initial_choice( 'booking_time_format', 'time_format', $this->get_time_formats(), 'H:i' ),
			'start_day_of_week' => $this->get_initial_week_start(),
		);
	}

	/**
	 * Build the data-only presentation context for Step 3.
	 *
	 * @param array<string,mixed> $field_values Validated draft values.
	 *
	 * @return array<string,mixed> Authorized template context.
	 */
	public function get_context( array $field_values ) {
		return array(
			'values'                   => $field_values,
			'date_formats'             => $this->get_date_format_options(),
			'time_formats'             => $this->get_time_format_options(),
			'week_start_days'          => $this->get_week_start_options(),
			'site_language'            => $this->get_site_language_context(),
			'date_time_settings_url'   => $this->get_date_time_settings_url(),
			'translation_settings_url' => $this->get_translation_settings_url(),
		);
	}

	/**
	 * Validate one allow-listed Step 3 draft field.
	 *
	 * @param string $field_id     Stable field identifier.
	 * @param mixed  $raw_value    Untrusted submitted value.
	 * @param bool   $is_required  Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Normalized value or a validation error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		$allowed_values = array(
			'date_format'       => $this->get_date_formats(),
			'time_format'       => $this->get_time_formats(),
			'start_day_of_week' => array_map( 'strval', array_keys( $this->get_week_start_options() ) ),
		);

		if ( ! isset( $allowed_values[ $field_id ] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_date_time_field_unknown', __( 'The Dates and times editor received an unsupported field.', 'booking' ) );
		}

		if ( ! is_scalar( $raw_value ) ) {
			return new WP_Error( 'wpbc_setup_wizard_date_time_field_invalid', __( 'Choose one of the available options.', 'booking' ) );
		}

		$field_value = sanitize_text_field( (string) $raw_value );
		if ( '' === trim( $field_value ) ) {
			return $is_required
				? new WP_Error( 'wpbc_setup_wizard_date_time_field_required', __( 'This field is required.', 'booking' ) )
				: '';
		}

		if ( ! in_array( $field_value, $allowed_values[ $field_id ], true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_date_time_choice_invalid', __( 'Choose one of the available options.', 'booking' ) );
		}

		return $field_value;
	}

	/**
	 * Return the server-derived Local translation presentation record.
	 *
	 * The website locale is never accepted from the browser. Available Local
	 * translations are discovered only from Booking Calendar's language folder,
	 * so rendering this context performs no remote request.
	 *
	 * @return array<string,mixed> Site-language presentation data.
	 */
	public function get_site_language_context() {
		$site_locale              = $this->get_site_locale();
		$local_locale             = $this->find_local_translation_locale( $site_locale );
		$translation_freshness    = $this->get_local_translation_freshness( $local_locale );
		$is_builtin               = 0 === strpos( strtolower( $site_locale ), 'en' );
		$is_local_active          = 'wpbc' === (string) get_bk_option( 'booking_translation_load_from', 'wp.org' );
		$translation_source       = $is_local_active ? 'wpbc' : 'wp.org';
		$translation_source_label = $is_local_active ? __( 'Local', 'booking' ) : __( 'WordPress.org', 'booking' );
		$is_demo                  = function_exists( 'wpbc_is_this_demo' ) && wpbc_is_this_demo();
		$can_manage_files         = current_user_can( 'activate_plugins' );
		$language_name            = $this->get_language_name( $site_locale );
		$language_label           = sprintf(
			/* translators: 1: Site language name, 2: WordPress locale. */
			__( '%1$s (%2$s)', 'booking' ),
			$language_name,
			$site_locale
		);

		if ( $is_local_active ) {
			$status       = 'active';
			$status_label = __( 'Local translations active', 'booking' );
			$help         = '' === $local_locale && ! $is_builtin
				? __( 'Booking Calendar is configured to prefer Local translations. The current website language is not present in the installed Local archive, so the WordPress.org translation remains the fallback.', 'booking' )
				: __( 'Booking Calendar is configured to load its Local translation first. You can update the complete Local translation archive at any time.', 'booking' );
		} elseif ( $is_builtin ) {
			$status       = 'builtin';
			$status_label = __( 'Built in', 'booking' );
			$help         = __( 'English is built into Booking Calendar. You can still download the complete Local translation archive for later language changes.', 'booking' );
		} elseif ( '' === $local_locale ) {
			$status       = 'unavailable';
			$status_label = __( 'Local translation unavailable', 'booking' );
			$help         = __( 'The currently installed Local archive does not include this website language. You can update the archive and make Local translations the preferred source.', 'booking' );
		} else {
			$status       = 'available';
			$status_label = __( 'Local translation available', 'booking' );
			$help         = __( 'A matching Booking Calendar Local translation is installed. You can update the complete archive and make Local translations the preferred source.', 'booking' );
		}

		$is_local_source_recommended = 'available' === $status && 'wp.org' === $translation_source;
		$local_source_recommendation = $is_local_source_recommended
			? __( 'Recommended: Update and use Local translations for this website language.', 'booking' )
			: '';
		$action_label = $is_local_active
			? __( 'Update Local translations', 'booking' )
			: __( 'Download and use Local translations', 'booking' );

		return array(
			'locale'                      => $site_locale,
			'local_locale'                => $local_locale,
			'label'                       => $language_label,
			'status'                      => $status,
			'status_label'                => $status_label,
			'help'                        => $help,
			'translation_source'          => $translation_source,
			'translation_source_label'    => $translation_source_label,
			'is_builtin'                  => $is_builtin,
			'is_available'                => $is_builtin || '' !== $local_locale,
			'is_local_active'             => $is_local_active,
			'is_local_source_recommended' => $is_local_source_recommended,
			'local_source_recommendation' => $local_source_recommendation,
			'is_demo'                     => $is_demo,
			'can_install'                 => ! $is_demo && $can_manage_files,
			'can_manage'                  => $can_manage_files,
			'action_label'                => $action_label,
			'updated_timestamp'           => $translation_freshness['updated_timestamp'],
			'updated_date'                => $translation_freshness['updated_date'],
			'updated_label'               => $translation_freshness['updated_label'],
			'is_update_recommended'       => $translation_freshness['is_update_recommended'],
			'update_recommendation'       => $translation_freshness['update_recommendation'],
		);
	}

	/**
	 * Resolve an exact or two-letter Local locale without filesystem access.
	 *
	 * This pure matcher mirrors the canonical translation loader and exists so
	 * consumers and tests can verify locale behavior independently of rendering
	 * or installation.
	 *
	 * WordPress returns the basename of each MO file, so Booking Calendar's
	 * bundled files arrive as values such as `booking-de_DE`. Normalizing that
	 * fixed text-domain prefix here keeps filesystem discovery and the loader's
	 * locale contract aligned.
	 *
	 * @param mixed    $site_locale       Proposed WordPress website locale.
	 * @param string[] $available_locales Available Local locale or MO basename records.
	 *
	 * @return string Matching locale, or an empty string.
	 */
	public function resolve_local_translation_locale( $site_locale, array $available_locales ) {
		if ( ! is_scalar( $site_locale ) ) {
			return '';
		}

		$site_locale = (string) $site_locale;
		$is_valid    = function_exists( 'wpbc_validate_request_locale' )
			? wpbc_validate_request_locale( $site_locale )
			: 1 === preg_match( '/\A[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*\z/D', $site_locale );

		if ( ! $is_valid ) {
			return '';
		}

		$normalized_locales = array();
		foreach ( $available_locales as $available_locale ) {
			if ( ! is_scalar( $available_locale ) ) {
				continue;
			}

			$available_locale = (string) $available_locale;
			if ( 0 === strpos( $available_locale, 'booking-' ) ) {
				$available_locale = substr( $available_locale, strlen( 'booking-' ) );
			}

			if ( 1 === preg_match( '/\A[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*\z/D', $available_locale ) ) {
				$normalized_locales[] = $available_locale;
			}
		}

		$available_locales = array_values( array_unique( $normalized_locales ) );

		if ( in_array( $site_locale, $available_locales, true ) ) {
			return $site_locale;
		}

		$short_locale = substr( $site_locale, 0, 2 );

		return in_array( $short_locale, $available_locales, true ) ? $short_locale : '';
	}

	/**
	 * Download the WPBC Local language archive and activate the Local source.
	 *
	 * This reuses the same upgrader function and canonical option used by the
	 * existing Settings > Admin Panel > Translations workflow. The active locale
	 * is derived again at apply time and never comes from request data.
	 *
	 * @return array<string,mixed>|WP_Error Updated language context or an error.
	 */
	public function install_site_local_translation() {
		$language_context = $this->get_site_language_context();
		$previous_status  = get_bk_option( 'booking_translation_update_status', '0' );
		$previous_source  = get_bk_option( 'booking_translation_load_from', 'wp.org' );
		$operation_log    = array(
			$this->create_operation_log_entry( 'info', __( 'Preparing the Booking Calendar Local translation update.', 'booking' ) ),
		);

		if ( $language_context['is_demo'] ) {
			$operation_log[] = $this->create_operation_log_entry( 'error', __( 'Local translation downloads are unavailable on live demo sites.', 'booking' ) );

			return $this->create_operation_error( 'wpbc_setup_wizard_translation_demo_denied', __( 'Local translation downloads are unavailable on live demo sites.', 'booking' ), $operation_log );
		}

		if ( ! current_user_can( 'activate_plugins' ) ) {
			$operation_log[] = $this->create_operation_log_entry( 'error', __( 'You are not allowed to install Booking Calendar translations.', 'booking' ) );

			return $this->create_operation_error( 'wpbc_setup_wizard_translation_capability_denied', __( 'You are not allowed to install Booking Calendar translations.', 'booking' ), $operation_log );
		}

		if ( ! function_exists( 'wpbc_translation_download_from_wpbc' ) ) {
			$operation_log[] = $this->create_operation_log_entry( 'error', __( 'The Booking Calendar translation installer is unavailable.', 'booking' ) );

			return $this->create_operation_error( 'wpbc_setup_wizard_translation_installer_unavailable', __( 'The Booking Calendar translation installer is unavailable.', 'booking' ), $operation_log );
		}

		$operation_log[] = $this->create_operation_log_entry( 'info', __( 'Selecting Local as the preferred Booking Calendar translation source.', 'booking' ) );
		update_bk_option( 'booking_translation_load_from', 'wpbc' );

		if ( 'wpbc' !== (string) get_bk_option( 'booking_translation_load_from', '' ) ) {
			update_bk_option( 'booking_translation_load_from', $previous_source );
			$operation_log[] = $this->create_operation_log_entry( 'error', __( 'The Local translation preference could not be saved, so the archive update was not started.', 'booking' ) );

			return $this->create_operation_error( 'wpbc_setup_wizard_translation_activation_failed', __( 'Booking Calendar could not select the Local translation source.', 'booking' ), $operation_log );
		}

		$operation_log[] = $this->create_operation_log_entry( 'success', __( 'Local is now the preferred Booking Calendar translation source.', 'booking' ) );

		if ( class_exists( 'WPBC_Action_Scheduler_Compatibility' ) ) {
			WPBC_Action_Scheduler_Compatibility::raise_memory_limit();
			WPBC_Action_Scheduler_Compatibility::raise_time_limit( 300 );
		}

		$operation_log[] = $this->create_operation_log_entry( 'info', __( 'Downloading the official Local translation archive from wpbookingcalendar.com.', 'booking' ) );
		require_once WPBC_PLUGIN_DIR . '/core/class/wpbc-class-upgrader-translation-skin.php';
		$translation_skin = new WPBC_Upgrader_Translation_Skin(
			array(
				'skip_header_footer' => true,
				'suppress_output'     => true,
			)
		);
		$output_buffer_level = ob_get_level();
		ob_start();
		$download_result = wpbc_translation_download_from_wpbc( $translation_skin );
		$this->discard_output_buffers_above_level( $output_buffer_level );
		$installer_error = $translation_skin->get_installer_error();
		$install_failure = $this->get_translation_install_failure( $download_result, $installer_error );

		if ( null !== $install_failure ) {
			$operation_log[] = $this->create_operation_log_entry( 'error', $install_failure['log_message'] );

			return $this->create_operation_error( $install_failure['error_code'], $install_failure['message'], $operation_log );
		}

		$operation_log[] = $this->create_operation_log_entry( 'success', __( 'The Local translation archive was downloaded and unpacked.', 'booking' ) );
		$this->invalidate_local_translation_file_cache();
		update_bk_option( 'booking_translation_update_status', 'translations_updated_from_wpbc' );

		if ( 'translations_updated_from_wpbc' !== (string) get_bk_option( 'booking_translation_update_status', '' ) ) {
			update_bk_option( 'booking_translation_update_status', $previous_status );
			$operation_log[] = $this->create_operation_log_entry( 'error', __( 'The archive was updated and Local remains selected, but the translation update status could not be saved.', 'booking' ) );

			return $this->create_operation_error( 'wpbc_setup_wizard_translation_status_failed', __( 'The Local translation was downloaded, but Booking Calendar could not save the update status.', 'booking' ), $operation_log );
		}

		$updated_context = $this->get_site_language_context();
		if ( ! $updated_context['is_builtin'] && ! $updated_context['is_available'] ) {
			$operation_log[] = $this->create_operation_log_entry( 'warning', __( 'The archive was updated, but it does not contain a Local translation matching the current website language. WordPress.org remains the fallback for this locale.', 'booking' ) );
		}
		$updated_context['message'] = sprintf(
			/* translators: %s: Site language and locale. */
			__( 'Local translations were updated and selected as the preferred source for %s. The setting will be used on the next page load.', 'booking' ),
			$updated_context['label']
		);
		$updated_context['logs'] = $operation_log;

		return $updated_context;
	}

	/**
	 * Normalize the WordPress upgrader result into one safe failure contract.
	 *
	 * `WP_Upgrader::run()` is the authoritative operation result. A skin can
	 * retain a warning or cleanup error after the archive was installed, so a
	 * populated skin error must not override a successful non-false result. The
	 * skin is consulted only when an integration returns no operation result.
	 * Raw upgrader messages are never returned because they may contain paths or
	 * remote-request details.
	 *
	 * @param mixed         $download_result Result returned by the canonical downloader.
	 * @param WP_Error|null $installer_error Error retained by the silent upgrader skin.
	 *
	 * @return array{error_code:string,message:string,log_message:string}|null Safe failure or null on success.
	 */
	private function get_translation_install_failure( $download_result, $installer_error ) {
		if ( false === $download_result ) {
			return array(
				'error_code'  => 'wpbc_setup_wizard_translation_filesystem_unavailable',
				'message'     => __( 'WordPress could not access the filesystem to install the Local translation. Check filesystem access, then try again.', 'booking' ),
				'log_message' => __( 'WordPress could not establish filesystem access for the Local translation update.', 'booking' ),
			);
		}

		$upgrader_error = $this->get_nonempty_wordpress_error( $download_result );
		if ( null === $upgrader_error && null === $download_result ) {
			$upgrader_error = $this->get_nonempty_wordpress_error( $installer_error );
		}

		if ( null === $upgrader_error ) {
			return null;
		}

		return $this->get_safe_translation_error_presentation( $upgrader_error );
	}

	/**
	 * Return a WordPress error only when it contains a real error code.
	 *
	 * Some upgrader skins receive an empty `WP_Error` container during their
	 * lifecycle. Treating that container as a failed installation produces a
	 * false error after files were updated successfully.
	 *
	 * @param mixed $candidate Candidate upgrader result or skin error.
	 *
	 * @return WP_Error|null Populated WordPress error or null.
	 */
	private function get_nonempty_wordpress_error( $candidate ) {
		if ( ! is_wp_error( $candidate ) || empty( $candidate->get_error_codes() ) ) {
			return null;
		}

		return $candidate;
	}

	/**
	 * Map a raw upgrader error to a bounded user-facing failure category.
	 *
	 * Error codes are used only for categorization. Raw messages and data are not
	 * exposed to the browser because WordPress or filesystem transports can add
	 * server paths, remote responses, or credential-related details.
	 *
	 * @param WP_Error $upgrader_error Populated WordPress upgrader error.
	 *
	 * @return array{error_code:string,message:string,log_message:string} Safe failure presentation.
	 */
	private function get_safe_translation_error_presentation( $upgrader_error ) {
		$upgrader_error_code = sanitize_key( (string) $upgrader_error->get_error_code() );
		$network_error_codes = array(
			'download_failed',
			'http_404',
			'http_no_file',
			'http_no_url',
			'http_request_failed',
			'md5_mismatch',
			'signature_verification_failed',
		);
		$archive_error_codes = array(
			'copy_failed',
			'disk_full_unzip_file',
			'empty_archive',
			'incompatible_archive',
			'mkdir_failed',
		);

		if ( in_array( $upgrader_error_code, $network_error_codes, true ) ) {
			return array(
				'error_code'  => 'wpbc_setup_wizard_translation_network_failed',
				'message'     => __( 'WordPress could not download the Local translation archive. Check the site connection to wpbookingcalendar.com, then try again.', 'booking' ),
				'log_message' => __( 'The Local translation archive download did not complete.', 'booking' ),
			);
		}

		if ( in_array( $upgrader_error_code, $archive_error_codes, true ) ) {
			return array(
				'error_code'  => 'wpbc_setup_wizard_translation_archive_failed',
				'message'     => __( 'WordPress downloaded the Local translation archive but could not unpack or install it. Check filesystem access, then try again.', 'booking' ),
				'log_message' => __( 'The Local translation archive could not be unpacked or copied into the plugin languages directory.', 'booking' ),
			);
		}

		return array(
			'error_code'  => 'wpbc_setup_wizard_translation_download_failed',
			'message'     => __( 'Booking Calendar could not update the Local translation. Check network and filesystem access, then try again.', 'booking' ),
			'log_message' => __( 'WordPress reported an error while updating the Local translation archive.', 'booking' ),
		);
	}

	/**
	 * Discard installer output without closing an output buffer it already ended.
	 *
	 * WordPress upgrader skins can alter the output-buffer stack while installing
	 * an archive. Restoring only removable buffers above the caller's initial
	 * level prevents upgrader markup and notices from corrupting the AJAX JSON.
	 *
	 * @param int $output_buffer_level Output-buffer level before capture started.
	 * @return void
	 */
	private function discard_output_buffers_above_level( $output_buffer_level ) {
		$output_buffer_level = max( 0, (int) $output_buffer_level );

		while ( ob_get_level() > $output_buffer_level ) {
			$output_buffer_status = ob_get_status();

			if (
				! is_array( $output_buffer_status )
				|| ! isset( $output_buffer_status['flags'] )
				|| 0 === ( (int) $output_buffer_status['flags'] & PHP_OUTPUT_HANDLER_REMOVABLE )
			) {
				break;
			}

			ob_end_clean();
		}
	}

	/**
	 * Create one safe operation-console record.
	 *
	 * @param string $level   One of info, success, warning, or error.
	 * @param string $message Translated operation message.
	 *
	 * @return array{level:string,message:string} JSON-safe console record.
	 */
	private function create_operation_log_entry( $level, $message ) {
		$allowed_levels = array( 'info', 'success', 'warning', 'error' );

		return array(
			'level'   => in_array( $level, $allowed_levels, true ) ? $level : 'info',
			'message' => sanitize_text_field( $message ),
		);
	}

	/**
	 * Create a bounded installation error with safe operation-console records.
	 *
	 * Raw upgrader errors may contain filesystem details, so only the controlled
	 * log records created by this service are returned to the browser.
	 *
	 * @param string                                   $error_code    Stable error identifier.
	 * @param string                                   $error_message Translated user-facing error.
	 * @param array<int,array{level:string,message:string}> $operation_log Safe console records.
	 *
	 * @return WP_Error Installation error with JSON-safe log data.
	 */
	private function create_operation_error( $error_code, $error_message, array $operation_log ) {
		return new WP_Error(
			$error_code,
			$error_message,
			array(
				'logs' => $operation_log,
			)
		);
	}

	/**
	 * Return the fixed date-format allow-list.
	 *
	 * @return string[] Allowed WordPress date formats.
	 */
	private function get_date_formats() {
		return array( 'j M Y', 'F j, Y', 'd/m/Y', 'd.m.Y', 'd-m-Y', 'm/d/Y', 'm.d.Y', 'm-d-Y', 'Y/m/d', 'Y.m.d', 'Y-m-d' );
	}

	/**
	 * Return the fixed time-format allow-list.
	 *
	 * @return string[] Allowed WordPress time formats.
	 */
	private function get_time_formats() {
		return array( 'g:i a', 'g:i A', 'H:i' );
	}

	/**
	 * Return date-format options with localized examples.
	 *
	 * @return array<int,array{value:string,label:string}> Date format records.
	 */
	private function get_date_format_options() {
		$options          = array();
		$sample_timestamp = current_time( 'timestamp' );

		foreach ( $this->get_date_formats() as $date_format ) {
			$options[] = array(
				'value' => $date_format,
				'label' => date_i18n( $date_format, $sample_timestamp ),
			);
		}

		return $options;
	}

	/**
	 * Return time-format options with localized examples.
	 *
	 * @return array<int,array{value:string,label:string}> Time format records.
	 */
	private function get_time_format_options() {
		$options          = array();
		$sample_timestamp = current_time( 'timestamp' );

		foreach ( $this->get_time_formats() as $time_format ) {
			$options[] = array(
				'value' => $time_format,
				'label' => date_i18n( $time_format, $sample_timestamp ),
			);
		}

		return $options;
	}

	/**
	 * Return localized weekday choices.
	 *
	 * @return array<string,string> Weekday labels keyed by numeric string.
	 */
	private function get_week_start_options() {
		return array(
			'0' => __( 'Sunday', 'booking' ),
			'1' => __( 'Monday', 'booking' ),
			'2' => __( 'Tuesday', 'booking' ),
			'3' => __( 'Wednesday', 'booking' ),
			'4' => __( 'Thursday', 'booking' ),
			'5' => __( 'Friday', 'booking' ),
			'6' => __( 'Saturday', 'booking' ),
		);
	}

	/**
	 * Read a WPBC setting with a WordPress and fixed fallback.
	 *
	 * @param string   $wpbc_option_name WPBC option name.
	 * @param string   $wp_option_name   WordPress option name, or empty string.
	 * @param string[] $allowed_values   Accepted canonical values.
	 * @param string   $fallback_value   Final source-supported default.
	 *
	 * @return string Allowed initial value.
	 */
	private function get_initial_choice( $wpbc_option_name, $wp_option_name, array $allowed_values, $fallback_value ) {
		$wpbc_value = get_bk_option( $wpbc_option_name );
		if ( is_scalar( $wpbc_value ) && in_array( (string) $wpbc_value, $allowed_values, true ) ) {
			return (string) $wpbc_value;
		}

		if ( '' !== $wp_option_name ) {
			$wp_value = get_option( $wp_option_name, '' );
			if ( is_scalar( $wp_value ) && in_array( (string) $wp_value, $allowed_values, true ) ) {
				return (string) $wp_value;
			}
		}

		return $fallback_value;
	}

	/**
	 * Read the WPBC week-start option with a WordPress fallback.
	 *
	 * @return string Numeric weekday value from zero through six.
	 */
	private function get_initial_week_start() {
		$allowed_values = array_map( 'strval', array_keys( $this->get_week_start_options() ) );
		$wpbc_value     = get_bk_option( 'booking_start_day_weeek' );

		if ( is_scalar( $wpbc_value ) && in_array( (string) $wpbc_value, $allowed_values, true ) ) {
			return (string) $wpbc_value;
		}

		$wp_value = get_option( 'start_of_week', 0 );

		return in_array( (string) $wp_value, $allowed_values, true ) ? (string) $wp_value : '0';
	}

	/**
	 * Return the website locale without accepting an AJAX locale override.
	 *
	 * @return string Valid locale identifier.
	 */
	private function get_site_locale() {
		$site_locale = get_locale();
		$is_valid    = function_exists( 'wpbc_validate_request_locale' )
			? wpbc_validate_request_locale( $site_locale )
			: ( is_string( $site_locale ) && 1 === preg_match( '/\A[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*\z/D', $site_locale ) );

		return $is_valid ? (string) $site_locale : 'en_US';
	}

	/**
	 * Find the exact or two-letter Local translation used by the WPBC loader.
	 *
	 * @param string $site_locale Valid website locale.
	 *
	 * @return string Matching bundled locale, or an empty string.
	 */
	private function find_local_translation_locale( $site_locale ) {
		$language_directory = trailingslashit( WPBC_PLUGIN_DIR ) . 'languages';
		$available_locales  = function_exists( 'get_available_languages' )
			? get_available_languages( $language_directory )
			: array();

		return $this->resolve_local_translation_locale( $site_locale, $available_locales );
	}

	/**
	 * Return the installed Local translation file date and freshness state.
	 *
	 * The locale is first resolved from WordPress' own language-file discovery,
	 * then constrained again before it is used to construct a path. Both legacy
	 * MO files and WordPress 6.5+ PHP translation files are supported. The newest
	 * matching file timestamp represents the installed archive state; no remote
	 * metadata or browser-supplied path is consulted.
	 *
	 * @param string $local_locale Server-resolved Local translation locale.
	 *
	 * @return array{updated_timestamp:int,updated_date:string,updated_label:string,is_update_recommended:bool,update_recommendation:string} Translation freshness record.
	 */
	private function get_local_translation_freshness( $local_locale ) {
		$freshness = array(
			'updated_timestamp'     => 0,
			'updated_date'          => '',
			'updated_label'         => '',
			'is_update_recommended' => false,
			'update_recommendation' => '',
		);

		if ( ! is_string( $local_locale ) || 1 !== preg_match( '/\A[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)*\z/D', $local_locale ) ) {
			return $freshness;
		}

		$language_directory = trailingslashit( WPBC_PLUGIN_DIR ) . 'languages/';
		$translation_files  = array(
			$language_directory . 'booking-' . $local_locale . '.mo',
			$language_directory . 'booking-' . $local_locale . '.l10n.php',
		);
		$updated_timestamp  = 0;

		foreach ( $translation_files as $translation_file ) {
			clearstatcache( true, $translation_file );
			if ( ! is_file( $translation_file ) || ! is_readable( $translation_file ) ) {
				continue;
			}

			$file_timestamp = filemtime( $translation_file );
			if ( false !== $file_timestamp ) {
				$updated_timestamp = max( $updated_timestamp, absint( $file_timestamp ) );
			}
		}

		if ( $updated_timestamp <= 0 ) {
			return $freshness;
		}

		$date_format  = get_option( 'date_format', 'F j, Y' );
		$date_format  = is_scalar( $date_format ) && '' !== trim( (string) $date_format ) ? (string) $date_format : 'F j, Y';
		$updated_date = function_exists( 'wp_date' )
			? wp_date( $date_format, $updated_timestamp )
			: date_i18n( $date_format, $updated_timestamp );
		$is_stale     = $updated_timestamp < ( time() - MONTH_IN_SECONDS );

		$freshness['updated_timestamp']     = $updated_timestamp;
		$freshness['updated_date']          = $updated_date;
		$freshness['updated_label']         = sprintf(
			/* translators: %s: Installed Local translation file date. */
			__( 'Installed Local translation updated: %s', 'booking' ),
			$updated_date
		);
		$freshness['is_update_recommended'] = $is_stale;
		$freshness['update_recommendation'] = $is_stale
			? __( 'This Local translation is more than one month old. Update it to get the latest translations.', 'booking' )
			: '';

		return $freshness;
	}

	/**
	 * Invalidate WordPress' cached file list for the WPBC language directory.
	 *
	 * WordPress 6.5 and newer cache translation-file discovery by directory for
	 * one hour. The WPBC archive installer writes to its own language directory,
	 * so the core upgrader invalidation for wp-content/languages/plugins does not
	 * clear this entry. Removing the exact cache key lets the success response
	 * verify the newly installed locale in the same request. The cache deletion
	 * is harmless on older WordPress versions that do not use this cache.
	 *
	 * @return void
	 */
	private function invalidate_local_translation_file_cache() {
		$language_directory = trailingslashit( WPBC_PLUGIN_DIR ) . 'languages';
		$cache_path          = trailingslashit( $language_directory );

		wp_cache_delete( md5( $cache_path ), 'translation_files' );
		clearstatcache();
	}

	/**
	 * Return a human-readable locale name without requiring a remote lookup.
	 *
	 * @param string $site_locale Valid website locale.
	 *
	 * @return string Display label.
	 */
	private function get_language_name( $site_locale ) {
		$language_name = function_exists( 'locale_get_display_name' ) ? locale_get_display_name( $site_locale, $site_locale ) : '';
		$language_name = is_string( $language_name ) ? sanitize_text_field( $language_name ) : '';

		return '' !== trim( $language_name ) ? $language_name : str_replace( array( '_', '-' ), ' ', $site_locale );
	}

	/**
	 * Return the canonical Date / Time Formats settings URL.
	 *
	 * @return string Server-owned administration URL.
	 */
	private function get_date_time_settings_url() {
		$settings_url = function_exists( 'wpbc_get_settings_url' ) ? wpbc_get_settings_url() : admin_url( 'admin.php?page=wpbc-settings' );

		return add_query_arg( 'scroll_to_section', 'wpbc_general_settings_datestimes_tab', $settings_url );
	}

	/**
	 * Return the canonical Admin Panel > Translations settings URL.
	 *
	 * @return string Server-owned administration URL.
	 */
	private function get_translation_settings_url() {
		$settings_url = function_exists( 'wpbc_get_settings_url' ) ? wpbc_get_settings_url() : admin_url( 'admin.php?page=wpbc-settings' );

		return add_query_arg( 'scroll_to_section', 'wpbc_general_settings_translations_tab', $settings_url );
	}
}
