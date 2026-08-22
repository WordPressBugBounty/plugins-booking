<?php
/**
 * Temporary shared catalog compatibility controls for 11.6.
 *
 * @package Booking Calendar
 * @since   11.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return the minimum paid-edition version that supports the new catalog.
 *
 * @return string Required Booking Calendar Pro version.
 */
function wpbc_booking_resources_catalog_get_minimum_pro_version() {
	return '11.6';
}

/**
 * Determine whether a paid Booking Calendar edition is active.
 *
 * Constants are preferred because they are available for every paid edition.
 * The class fallback keeps mixed-version installations detectable when an old
 * paid bootstrap does not define the current constants.
 *
 * @return bool True when a paid edition is active.
 */
function wpbc_booking_resources_catalog_is_pro_active() {
	return defined( 'WPBC_PRO_VERSION_NUM' ) || defined( 'WPBC_PRO_FILE' ) || class_exists( 'wpdev_bk_personal' );
}

/**
 * Return the detected paid-edition version.
 *
 * @return string Sanitized Pro version, or an empty string when unavailable.
 */
function wpbc_booking_resources_catalog_get_pro_version() {
	if ( ! defined( 'WPBC_PRO_VERSION_NUM' ) ) {
		return '';
	}

	return sanitize_text_field( (string) WPBC_PRO_VERSION_NUM );
}

/**
 * Determine whether a detected paid-edition version is safe to compare.
 *
 * Mixed-version installations can expose an empty or malformed constant while
 * the paid bootstrap is only partly loaded. Treating that value as compatible
 * would allow the new renderer to call APIs that the active paid edition does
 * not provide, so only conventional dotted WordPress plugin versions are
 * accepted.
 *
 * @param string $pro_version Detected paid-edition version.
 *
 * @return bool True when the version is a dotted numeric version with an
 *              optional prerelease or build suffix.
 */
function wpbc_booking_resources_catalog_is_valid_pro_version( $pro_version ) {
	if ( ! is_scalar( $pro_version ) ) {
		return false;
	}

	$pro_version = trim( (string) $pro_version );

	return 1 === preg_match( '/^\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?$/', $pro_version );
}

/**
 * Resolve whether one edition/version combination supports the new catalog.
 *
 * This pure policy boundary exists so release tests can exercise Free, current
 * Pro, old Pro, and incomplete mixed-version installations without redefining
 * immutable PHP constants or changing the active plugin set.
 *
 * @param bool   $is_pro_active Whether any paid edition is active.
 * @param string $pro_version   Detected paid-edition version, or an empty value.
 *
 * @return bool True when the installation is compatible with the new catalog.
 */
function wpbc_booking_resources_catalog_resolve_pro_compatibility( $is_pro_active, $pro_version ) {
	if ( ! $is_pro_active ) {
		return true;
	}

	if ( ! wpbc_booking_resources_catalog_is_valid_pro_version( $pro_version ) ) {
		return false;
	}

	return version_compare( (string) $pro_version, wpbc_booking_resources_catalog_get_minimum_pro_version(), '>=' );
}

/**
 * Determine whether the active paid edition supports the new catalog.
 *
 * Free-only installations are compatible. An active paid edition without a
 * reliable version is treated conservatively as incompatible.
 *
 * @return bool True when the installation may use the new catalog.
 */
function wpbc_booking_resources_catalog_is_pro_compatible() {
	return wpbc_booking_resources_catalog_resolve_pro_compatibility(
		wpbc_booking_resources_catalog_is_pro_active(),
		wpbc_booking_resources_catalog_get_pro_version()
	);
}

/**
 * Determine whether the independent catalog runtime is available.
 *
 * The saved renderer preference is not changed when a development or rollback
 * gate is disabled. This allows the installation to return to the preferred
 * renderer when the catalog runtime becomes available again.
 *
 * @return bool True when both 11.6 catalog feature gates are enabled.
 */
function wpbc_booking_resources_catalog_is_available() {
	return function_exists( 'wpbc_is_11_6_features_enabled' )
		&& wpbc_is_11_6_features_enabled()
		&& function_exists( 'wpbc_is_11_6_catalog_v2_enabled' )
		&& wpbc_is_11_6_catalog_v2_enabled();
}

/**
 * Return the explicitly stored renderer preference.
 *
 * Missing or malformed historical values intentionally resolve to the new
 * renderer without writing a default during activation or update.
 *
 * @return string Either `new` or `legacy`.
 */
function wpbc_booking_resources_catalog_get_stored_renderer() {
	$stored_renderer = sanitize_key( (string) get_bk_option( 'booking_resources_catalog_renderer' ) );

	return in_array( $stored_renderer, array( 'new', 'legacy' ), true ) ? $stored_renderer : 'new';
}

/**
 * Return the temporary support override for the Resources renderer.
 *
 * The constant is intentionally read at runtime and never copied into the
 * database. Removing it therefore returns control to the customer's saved
 * compatibility setting. Invalid and non-scalar values are ignored safely.
 *
 * @return string Either `new`, `legacy`, or an empty string when no valid
 *                support override is defined.
 */
function wpbc_booking_resources_catalog_get_constant_renderer() {
	if ( ! defined( 'WPBC_BOOKING_RESOURCES_CATALOG_MODE' ) ) {
		return '';
	}

	$constant_renderer = constant( 'WPBC_BOOKING_RESOURCES_CATALOG_MODE' );
	if ( ! is_scalar( $constant_renderer ) ) {
		return '';
	}

	$constant_renderer = sanitize_key( trim( (string) $constant_renderer ) );

	return in_array( $constant_renderer, array( 'new', 'legacy' ), true ) ? $constant_renderer : '';
}

/**
 * Return the temporary support override shared by all 11.6 catalogs.
 *
 * `WPBC_CATALOG_MODE` is the domain-neutral override. The released
 * `WPBC_BOOKING_RESOURCES_CATALOG_MODE` constant remains a compatibility alias
 * and is used when the generic override is absent.
 *
 * @return string Either `new`, `legacy`, or an empty string when no valid
 *                support override is defined.
 */
function wpbc_catalogs_get_constant_renderer() {
	if ( defined( 'WPBC_CATALOG_MODE' ) ) {
		$constant_renderer = constant( 'WPBC_CATALOG_MODE' );
		if ( is_scalar( $constant_renderer ) ) {
			$constant_renderer = sanitize_key( trim( (string) $constant_renderer ) );
			if ( in_array( $constant_renderer, array( 'new', 'legacy' ), true ) ) {
				return $constant_renderer;
			}
		}
	}

	return wpbc_booking_resources_catalog_get_constant_renderer();
}

/**
 * Resolve the renderer for one complete compatibility-policy input.
 *
 * The stored preference is presentation-only. Runtime availability and paid
 * edition compatibility always win. A valid support constant then overrides
 * the saved presentation preference without changing it. Invalid values safely
 * use the saved renderer, which itself defaults to `new` without being written.
 *
 * @param bool   $catalog_available Whether both catalog feature gates are enabled.
 * @param bool   $is_pro_active     Whether any paid edition is active.
 * @param string $pro_version       Detected paid-edition version, or an empty value.
 * @param string $stored_renderer   Stored renderer preference.
 * @param string $constant_renderer Temporary support override, or an empty value.
 *
 * @return string Either `new` or `legacy`.
 */
function wpbc_booking_resources_catalog_resolve_renderer(
	$catalog_available,
	$is_pro_active,
	$pro_version,
	$stored_renderer,
	$constant_renderer = ''
) {
	$stored_renderer   = is_scalar( $stored_renderer ) ? sanitize_key( (string) $stored_renderer ) : '';
	$stored_renderer   = in_array( $stored_renderer, array( 'new', 'legacy' ), true ) ? $stored_renderer : 'new';
	$constant_renderer = is_scalar( $constant_renderer ) ? sanitize_key( (string) $constant_renderer ) : '';
	$constant_renderer = in_array( $constant_renderer, array( 'new', 'legacy' ), true ) ? $constant_renderer : '';

	if ( ! $catalog_available || ! wpbc_booking_resources_catalog_resolve_pro_compatibility( $is_pro_active, $pro_version ) ) {
		return 'legacy';
	}

	return '' !== $constant_renderer ? $constant_renderer : $stored_renderer;
}

/**
 * Return the renderer that may be used by the current installation.
 *
 * Compatibility is derived rather than saved. Consequently, temporarily
 * activating an old paid edition never overwrites an explicit preference.
 * The temporary support constant also remains request-local and is never
 * persisted.
 *
 * @return string Either `new` or `legacy`.
 */
function wpbc_booking_resources_catalog_get_effective_renderer() {
	return wpbc_catalogs_get_effective_renderer();
}

/**
 * Return the renderer shared by catalog pages upgraded in Booking Calendar 11.6.
 *
 * The existing `booking_resources_catalog_renderer` option remains the
 * canonical stored preference to avoid a data migration. Runtime gates, paid
 * version compatibility, and support constants are derived without replacing
 * the customer's stored selection.
 *
 * @return string Either `new` or `legacy`.
 */
function wpbc_catalogs_get_effective_renderer() {
	return wpbc_booking_resources_catalog_resolve_renderer(
		wpbc_booking_resources_catalog_is_available(),
		wpbc_booking_resources_catalog_is_pro_active(),
		wpbc_booking_resources_catalog_get_pro_version(),
		wpbc_booking_resources_catalog_get_stored_renderer(),
		wpbc_catalogs_get_constant_renderer()
	);
}

/**
 * Determine whether upgraded 11.6 catalog pages should use their new renderer.
 *
 * @return bool True when new catalog renderers are selected.
 */
function wpbc_catalogs_should_use_new_renderer() {
	return 'new' === wpbc_catalogs_get_effective_renderer();
}

/**
 * Determine whether the canonical Resources tab should use the new catalog.
 *
 * @return bool True when the independent catalog is the effective renderer.
 */
function wpbc_booking_resources_catalog_should_use_new_renderer() {
	return 'new' === wpbc_booking_resources_catalog_get_effective_renderer();
}

/**
 * Determine whether a route targets the default Booking Resources surface.
 *
 * The compatibility renderer applies only to the canonical Resources page
 * when its tab is omitted or explicitly set to `resources`. Sibling tabs keep
 * their established controllers and are never interpreted as a request for
 * either the new or legacy default renderer.
 *
 * @param string $page_slug Administration page slug.
 * @param string $tab_slug  Administration tab slug, or an empty string when omitted.
 *
 * @return bool True for the canonical default Resources route.
 */
function wpbc_booking_resources_catalog_is_default_route( $page_slug, $tab_slug = '' ) {
	if ( ! is_scalar( $page_slug ) || ! is_scalar( $tab_slug ) ) {
		return false;
	}

	$page_slug = sanitize_key( (string) $page_slug );
	$tab_slug  = sanitize_key( (string) $tab_slug );

	return 'wpbc-resources' === $page_slug && in_array( $tab_slug, array( '', 'resources' ), true );
}

/**
 * Resolve the renderer selected for the current administration request.
 *
 * An empty result is intentional for Capacity Rules, Searchable Resources,
 * MultiUser Users, and every non-Resources request. The default page classes
 * may still register their tab metadata so sibling-page navigation remains
 * complete, but only this resolver authorizes their content renderer.
 *
 * @return string Either `new`, `legacy`, or an empty string for a sibling route.
 */
function wpbc_booking_resources_catalog_get_request_renderer() {
	if ( ! is_admin() || wp_doing_ajax() ) {
		return '';
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration route detection.
	$page_slug = isset( $_GET['page'] ) && is_scalar( $_GET['page'] ) ? wp_unslash( $_GET['page'] ) : '';
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration route detection.
	if ( isset( $_GET['tab'] ) && ! is_scalar( $_GET['tab'] ) ) {
		return '';
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration route detection.
	$tab_slug = isset( $_GET['tab'] ) ? wp_unslash( $_GET['tab'] ) : '';

	if ( ! wpbc_booking_resources_catalog_is_default_route( $page_slug, $tab_slug ) ) {
		return '';
	}

	return wpbc_booking_resources_catalog_get_effective_renderer();
}

/**
 * Redirect temporary parallel catalog aliases to the canonical Resources tab.
 *
 * These aliases were used only while the new catalog was developed in
 * parallel. Redirecting before WordPress resolves plugin pages keeps saved
 * bookmarks working without registering duplicate visible admin pages.
 *
 * @return void
 */
function wpbc_booking_resources_catalog_redirect_parallel_aliases() {
	if ( ! is_admin() || wp_doing_ajax() ) {
		return;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only administration route normalization.
	$page_slug = isset( $_GET['page'] ) && is_scalar( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
	if ( ! wpbc_booking_resources_catalog_is_parallel_alias( $page_slug ) ) {
		return;
	}

	$canonical_url = add_query_arg(
		array(
			'page' => 'wpbc-resources',
			'tab'  => 'resources',
		),
		admin_url( 'admin.php' )
	);

	wp_safe_redirect( $canonical_url, 302, 'Booking Calendar' );
	exit;
}

/**
 * Canonicalize the temporary aliases before administration output can begin.
 *
 * The admin_init registration is an intentional fallback for non-standard
 * loaders that include Booking Calendar after plugins_loaded has fired, or
 * for integrations that temporarily reject an earlier redirect.
 */
add_action( 'plugins_loaded', 'wpbc_booking_resources_catalog_redirect_parallel_aliases', 1 );
add_action( 'admin_init', 'wpbc_booking_resources_catalog_redirect_parallel_aliases', 1 );

/**
 * Determine whether an administration slug is a temporary catalog alias.
 *
 * @param string $page_slug Administration page slug.
 *
 * @return bool True for an allow-listed 11.6 parallel-route alias.
 */
function wpbc_booking_resources_catalog_is_parallel_alias( $page_slug ) {
	if ( ! is_scalar( $page_slug ) ) {
		return false;
	}

	return in_array(
		sanitize_key( (string) $page_slug ),
		array( 'wpbc-booking-resources', 'wpbc-catalog-booking-resources' ),
		true
	);
}

/**
 * Map the configured Booking Calendar settings role to a capability.
 *
 * @return string WordPress capability required to manage plugin settings.
 */
function wpbc_booking_resources_catalog_get_settings_capability() {
	if ( function_exists( 'wpbc_booking_resources_get_role_capability' ) ) {
		return wpbc_booking_resources_get_role_capability( 'booking_user_role_settings' );
	}

	$minimum_role = get_bk_option( 'booking_user_role_settings' );
	$capabilities = array(
		'administrator' => 'activate_plugins',
		'editor'        => 'publish_pages',
		'author'        => 'publish_posts',
		'contributor'   => 'edit_posts',
		'subscriber'    => 'read',
	);

	return isset( $capabilities[ $minimum_role ] ) ? $capabilities[ $minimum_role ] : 'manage_options';
}

/**
 * Determine whether the current user may manage Booking Calendar settings.
 *
 * MultiUser settings remain restricted to the same super-administrator
 * context used by the General Settings page.
 *
 * @return bool True when the current user may view and save the setting.
 */
function wpbc_booking_resources_catalog_can_manage_settings() {
	$has_settings_capability = current_user_can( wpbc_booking_resources_catalog_get_settings_capability() );
	$is_multiuser_active     = function_exists( 'wpbc_is_mu_user_can_be_here' );
	$is_multiuser_admin      = ! $is_multiuser_active || wpbc_is_mu_user_can_be_here( 'only_super_admin' );

	return wpbc_booking_resources_catalog_resolve_settings_access(
		$has_settings_capability,
		$is_multiuser_active,
		$is_multiuser_admin
	);
}

/**
 * Resolve settings access for one capability and MultiUser context.
 *
 * Keeping this policy independent of the current user permits deterministic
 * regular-user and super-administrator release tests while the runtime wrapper
 * continues to use the established Booking Calendar permission APIs.
 *
 * @param bool $has_settings_capability Whether the user has the configured settings capability.
 * @param bool $is_multiuser_active     Whether Booking Calendar MultiUser is active.
 * @param bool $is_multiuser_admin      Whether the user is in its super-administrator context.
 *
 * @return bool True when settings access is allowed.
 */
function wpbc_booking_resources_catalog_resolve_settings_access( $has_settings_capability, $is_multiuser_active, $is_multiuser_admin ) {
	if ( ! $has_settings_capability ) {
		return false;
	}

	return ! $is_multiuser_active || (bool) $is_multiuser_admin;
}

/**
 * Determine whether the current user may act on plugin updates.
 *
 * @return bool True for users who can update or otherwise manage plugins.
 */
function wpbc_booking_resources_catalog_can_manage_plugins() {
	return current_user_can( 'update_plugins' ) || current_user_can( 'activate_plugins' );
}

/**
 * Return the administration screen used to update the paid plugin.
 *
 * Booking Calendar Pro exposes its custom updater on the Plugins screen. On a
 * multisite installation that screen belongs to Network Admin.
 *
 * @return string Absolute Plugins screen URL.
 */
function wpbc_booking_resources_catalog_get_plugin_update_url() {
	return is_multisite() ? network_admin_url( 'plugins.php' ) : admin_url( 'plugins.php' );
}

/**
 * Show the persistent mixed-version warning on the legacy Resources page.
 *
 * The warning is intentionally not dismissible while the incompatible paid
 * edition remains active. It informs administrators without blocking the
 * temporary legacy workflow in 11.6.
 *
 * @param string $page_name Booking Calendar settings page identifier.
 *
 * @return void
 */
function wpbc_booking_resources_catalog_show_pro_compatibility_notice( $page_name ) {
	if ( 'resources' !== $page_name || ! wpbc_is_11_6_features_enabled() ) {
		return;
	}

	if ( wpbc_booking_resources_catalog_is_pro_compatible() || ! wpbc_booking_resources_catalog_can_manage_plugins() ) {
		return;
	}

	$pro_version = wpbc_booking_resources_catalog_get_pro_version();
	if ( '' === $pro_version ) {
		$pro_version = __( 'Unknown', 'booking' );
	}

	$guide_html_id = 'wpbc_resources_booking_resources_warning_116';
	?>
	<div  id="<?php echo esc_attr( $guide_html_id ); ?>" class="notice notice-warning wpbc_booking_resources_catalog__compatibility_notice">
		<?php
		if ( function_exists( 'wpbc_is_dismissed' ) ) {
			wpbc_is_dismissed(
				$guide_html_id,
				array(
					'title'            => '<span class="wpbc-bi-x-lg" aria-hidden="true"></span><span class="screen-reader-text">' . esc_html__( 'Dismiss', 'booking' ) . '</span>',
					'hint'             => __( 'Dismiss', 'booking' ),
					'class'            => 'wpbc_booking_resources_catalog__compatibility_notice',
					'is_apply_in_demo' => true,
					'css'   => 'border-radius: 7px;padding: 7px 0 7px 10px;',
				)
			);
		}
		?>
		<p>
			<?php
			/* translators: %s: Detected Booking Calendar Pro version. */
			printf( esc_html( 'Your Booking Calendar Pro version must be updated to 11.6 or newer to use the %s new Booking Resources catalog %s. The legacy Resources page remains available temporarily and is scheduled for removal in Booking Calendar 11.7 - 11.8.' ),
				'<a href="https://wpbookingcalendar.com/wn/whats-new-in-booking-calendar-update-11-6/" target="_blank">',
				'</a>'
			);
			?>
			<br />
			<?php
			/* translators: %s: Detected Booking Calendar Pro version. */
			printf( esc_html__( 'Detected Pro version: %s.', 'booking' ), esc_html( $pro_version ) );
			?>
			<a href="<?php echo esc_url( wpbc_booking_resources_catalog_get_plugin_update_url() ); ?>"><?php esc_html_e( 'Update Booking Calendar Pro', 'booking' ); ?></a>
		</p>
	</div>
	<?php
}
add_action( 'wpbc_hook_settings_page_header', 'wpbc_booking_resources_catalog_show_pro_compatibility_notice', 20, 1 );
