<?php
/**
 * Canonical logged-in-user values and field-name matching for Booking forms.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolves the released Booking Form logged-in-user auto-fill contract.
 *
 * The service deliberately does not inspect request values or rendered markup.
 * Callers decide where auto-fill is appropriate, while this Booking-domain
 * service owns the configured user values and the released field-name rules.
 */
final class WPBC_Booking_Logged_User_Autofill {

	/**
	 * Get the configured current-user values used by Booking Form auto-fill.
	 *
	 * MultiUser installations are respected through `wpbc_get_current_user()`,
	 * which applies the released forced-user context before returning the user.
	 * Only scalar values are exposed so the result remains JSON safe. Values are
	 * still untrusted profile data: DTO/template consumers must escape them for
	 * their output context, and mutation paths must validate them independently.
	 *
	 * @return array<string,string> Empty when auto-fill is disabled or no current
	 *                              Booking Calendar user is available.
	 */
	public function get_fill_values() {
		if ( 'On' !== get_bk_option( 'booking_is_use_autofill_4_logged_user' ) ) {
			return array();
		}

		$current_user = wpbc_get_current_user();
		if ( ! is_object( $current_user ) || empty( $current_user->ID ) ) {
			return array();
		}

		$user_id  = absint( $current_user->ID );
		$nickname = get_user_meta( $user_id, 'nickname', true );

		return array(
			'nickname'   => $this->get_scalar_string( $nickname ),
			'last_name'  => $this->get_user_property( $current_user, 'last_name' ),
			'first_name' => $this->get_user_property( $current_user, 'first_name' ),
			'email'      => $this->get_user_property( $current_user, 'user_email' ),
			'phone'      => $this->get_user_property( $current_user, 'phone_number' ),
			'nb_enfant'  => $this->get_user_property( $current_user, 'nb_enfant' ),
			'url'        => $this->get_user_property( $current_user, 'user_url' ),
		);
	}

	/**
	 * Resolve an initial value using the released ordered field-name rules.
	 *
	 * Legacy Booking Form auto-fill applies only to text and email controls and
	 * stops at the first matching rule. This method mirrors that behavior for
	 * data-only consumers such as the Add New Booking Inspector bootstrap.
	 *
	 * @param string                    $field_name  Canonical Booking Form field name.
	 * @param string                    $field_type  Public field control type.
	 * @param array<string,string>|null $fill_values Optional preloaded user values.
	 * @return string Matched untrusted initial value, or an empty string.
	 */
	public function get_field_value( $field_name, $field_type, $fill_values = null ) {
		$field_type = sanitize_key( (string) $field_type );
		if ( ! in_array( $field_type, array( 'text', 'email' ), true ) ) {
			return '';
		}

		$field_name  = (string) $field_name;
		$fill_values = is_array( $fill_values ) ? $fill_values : $this->get_fill_values();
		if ( '' === $field_name || empty( $fill_values ) ) {
			return '';
		}

		foreach ( $this->get_field_rules() as $field_rule ) {
			if ( 1 !== preg_match( $field_rule['pattern'], $field_name ) ) {
				continue;
			}

			$fill_key = $field_rule['fill_key'];
			return isset( $fill_values[ $fill_key ] ) && is_scalar( $fill_values[ $fill_key ] )
				? (string) $fill_values[ $fill_key ]
				: '';
		}

		return '';
	}

	/**
	 * Return the ordered released auto-fill field-name rules.
	 *
	 * Rule order is significant because a field may match more than one broad
	 * expression. Keeping the order here aligned with `autofill_fields.js`
	 * preserves existing public and Add Booking behavior.
	 *
	 * @return array<int,array{pattern:string,fill_key:string}> Ordered rules.
	 */
	private function get_field_rules() {
		return array(
			array(
				'pattern'  => '/^([A-Za-z0-9_\-\.])*(nickname){1}([A-Za-z0-9_\-\.])*$/',
				'fill_key' => 'nickname',
			),
			array(
				'pattern'  => '/^([A-Za-z0-9_\-\.])*(last|second){1}([_\-\.])?name([A-Za-z0-9_\-\.])*$/',
				'fill_key' => 'last_name',
			),
			array(
				'pattern'  => '/^name([0-9_\-\.]*)$/',
				'fill_key' => 'first_name',
			),
			array(
				'pattern'  => '/^([A-Za-z0-9_\-\.])*(first|my){1}([_\-\.])?name([A-Za-z0-9_\-\.])*$/',
				'fill_key' => 'first_name',
			),
			array(
				'pattern'  => '/^(e)?([_\-\.])?mail([0-9_\-\.]*)$/',
				'fill_key' => 'email',
			),
			array(
				'pattern'  => '/^([A-Za-z0-9_\-\.])*(phone|fone){1}([A-Za-z0-9_\-\.])*$/',
				'fill_key' => 'phone',
			),
			array(
				'pattern'  => '/^(e)?([_\-\.])?nb_enfant([0-9_\-\.]*)$/',
				'fill_key' => 'nb_enfant',
			),
			array(
				'pattern'  => '/^([A-Za-z0-9_\-\.])*(URL|site|web|WEB){1}([A-Za-z0-9_\-\.])*$/',
				'fill_key' => 'url',
			),
		);
	}

	/**
	 * Read one scalar property from the current user object.
	 *
	 * WP_User exposes custom user meta through magic properties, so property
	 * access is retained for compatibility with the released implementation.
	 *
	 * @param object $current_user Current Booking Calendar user object.
	 * @param string $property     Property or user-meta key.
	 * @return string Scalar string or an empty string.
	 */
	private function get_user_property( $current_user, $property ) {
		$property_value = isset( $current_user->{$property} ) ? $current_user->{$property} : '';

		return $this->get_scalar_string( $property_value );
	}

	/**
	 * Normalize one user value without changing its stored contents.
	 *
	 * @param mixed $property_value Candidate user property value.
	 * @return string Scalar string or an empty string for non-scalar values.
	 */
	private function get_scalar_string( $property_value ) {
		return is_scalar( $property_value ) ? (string) $property_value : '';
	}
}
