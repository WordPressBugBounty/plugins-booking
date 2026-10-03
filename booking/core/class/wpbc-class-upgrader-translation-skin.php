<?php
/**
 * @version    1.0
 * @package    Booking Calendar
 * @subpackage Translations Functions
 * @category   Functions
 *
 * @author     wpdevelop
 * @link       https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified   29.09.2015
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}                                             // Exit if accessed directly.

require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

class WPBC_Upgrader_Translation_Skin extends WP_Upgrader_Skin {

	/**
	 * Installer error captured without exposing it to an AJAX response.
	 *
	 * @var WP_Error|null
	 */
	protected $installer_error = null;

	function __construct( $args = array() ) {
		$defaults      = array(
			'url'             => '',
			'nonce'           => '',
			'title'           => '',
			'context'         => false,
			'suppress_output' => false,
		);
		$this->options = wp_parse_args( $args, $defaults );
	}

	function header() {}

	function footer() {}

	function error( $error ) {
		$this->installer_error = $error;
	}

	/**
	 * Render or suppress one upgrader progress message.
	 *
	 * AJAX consumers use the silent mode because upgrader markup before a JSON
	 * response makes a successful installation look like a failed request.
	 * Existing Settings-page consumers retain the original visible feedback.
	 *
	 * @param string|array $feedback Message key, text, or structured feedback.
	 * @param mixed        ...$args  Optional formatting arguments.
	 * @return void
	 */
	public function feedback( $feedback, ...$args ) {
		if ( ! empty( $this->options['suppress_output'] ) ) {
			return;
		}

		parent::feedback( $feedback, ...$args );
	}

	function add_strings() {
		$this->upgrader->strings['starting_upgrade'] = __( 'Some of your translations need updating. Sit tight for a few more seconds while we update them as well.', 'booking' );
		$this->upgrader->strings['up_to_date']       = __( 'Your translations are all up to date.', 'booking' );
		$this->upgrader->strings['no_package']       = __( 'Update package not available.', 'booking' );
		/* translators: %s: Package URL. */
		$this->upgrader->strings['downloading_package'] = sprintf( __( 'Downloading translation from %s&#8230;', 'booking' ), '<span class="code">%s</span>' );
		$this->upgrader->strings['unpack_package']      = __( 'Unpacking the update&#8230;', 'booking' );
		$this->upgrader->strings['process_failed']      = __( 'Translation update failed.', 'booking' );
		$this->upgrader->strings['process_success']     = __( 'Translation updated successfully.', 'booking' );
		$this->upgrader->strings['remove_old']          = __( 'Removing the old version of the translation&#8230;', 'booking' );
		$this->upgrader->strings['remove_old_failed']   = __( 'Could not remove the old translation.', 'booking' );

	}

	public function set_upgrader( &$upgrader ) {
		if ( is_object( $upgrader ) ) {
			$this->upgrader =& $upgrader;
		}
		$this->add_strings();
	}

	function before() {}

	function after() {
		if ( ! empty( $this->options['suppress_output'] ) ) {
			return;
		}

		if ( ! empty( $this->installer_error ) ) {
			if ( is_wp_error( $this->installer_error ) ) {
				$message    = $this->installer_error->get_error_message();
				$error_data = $this->installer_error->get_error_data();

				if ( is_scalar( $error_data ) && '' !== (string) $error_data ) {
					$message .= ' (' . (string) $error_data . ')';
				}

				echo wp_kses_post( $message );
			}
		}
	}

	/**
	 * Return the error captured from WordPress's upgrader, when present.
	 *
	 * @return WP_Error|null Installer error or null.
	 */
	public function get_installer_error() {
		return is_wp_error( $this->installer_error ) && ! empty( $this->installer_error->get_error_codes() )
			? $this->installer_error
			: null;
	}
}
