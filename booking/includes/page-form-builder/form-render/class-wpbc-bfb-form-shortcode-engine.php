<?php
/**
 * Description
 *
 * @package     Booking Calendar.
 * @author      wpdevelop, oplugins
 * @web-site    https://wpbookingcalendar.com/
 * @email       info@wpbookingcalendar.com
 *
 * @modified    2025-08-09
 * @version     1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}


/**
 * WPBC Form Shortcode Engine (modular)
 * - Parses and renders booking form shortcodes.
 * - Supports placeholder:"Enter first name" (quoted) and legacy placeholder:Enter_first_name
 * - Field rendering split into small private methods.
 */
class WPBC_BFB_FormShortcodeEngine {

	/** @var string */
	public $current_resource_id = '';


	/** @var array */
	public $current_edit_booking = array(); // expects ['parsed_form'=>...]


	/* ============================== Public API ============================== */

	/**
	 * Extend the allow-list of safe inline CSS properties for KSES.
	 *
	 * @param array<int,string> $props Existing list of allowed CSS properties.
	 * @return array<int,string> Updated, de-duplicated list of properties.
	 */
	public function wpbc_bfa_safe_style_css( $props ) {
		$props[] = 'display';         // allow display
		$props[] = 'visibility';      // (optional) allow visibility
		$props[] = 'opacity';         // (optional)

		return array_values( array_unique( $props ) );
	}

	/**
	 * Render a booking form string by parsing supported shortcodes into HTML.
	 *
	 * @param string $form Raw form markup containing shortcodes.
	 * @return string Form HTML with shortcodes replaced.
	 */
	public function render( $form ) {

		// Allow some inline styles in SHORTCODESS of the booking form parser.
		add_filter( 'safe_style_css', array( $this, 'wpbc_bfa_safe_style_css' ), 10, 1 );

		$form  = $this->form_elements( $form, true );

		remove_filter( 'safe_style_css', array( $this, 'wpbc_bfa_safe_style_css' ) );

		return $form;
	}

	/**
	 * Parse all shortcodes in a form string without replacing them.
	 *
	 * @param string $form Raw form markup containing shortcodes.
	 * @return array<int,array<string,mixed>> Token arrays describing each shortcode found.
	 */
	public function parse( $form ) {
		return $this->form_elements( $form, false );
	}

	/* ============================ Core Dispatcher ============================ */

	/**
	 * Core dispatcher: finds shortcode tokens and either replaces them or returns parsed tokens.
	 *
	 * @param string $form    Source form string.
	 * @param bool   $replace When true, returns rendered HTML; when false, returns parsed tokens.
	 * @return string|array<int,array<string,mixed>> Rendered form HTML or parsed token arrays.
	 */
	public function form_elements( $form, $replace = true ) {

		// Deprected old code:
		//		$types                = 'text[*]?|email[*]?|coupon[*]?|time[*]?|textarea[*]?|select[*]?|selectbox[*]?|checkbox[*]?|radio[*]?|acceptance|captchac|captchar|file[*]?|quiz';
		//		$regex                = '%\[\s*(' . $types . ')(\s+[a-zA-Z][0-9a-zA-Z:._-]*)([-0-9a-zA-Z:#_/|\s]*)?((?:\s*(?:"[^"]*"|\'[^\']*\'))*)?\s*\]%';
		//		$regex_start_end_time = '%\[\s*(country[*]?|starttime[*]?|endtime[*]?)(\s*[a-zA-Z]*[0-9a-zA-Z:._-]*)([-0-9a-zA-Z:#_/|\s]*)*((?:\s*(?:"[^"]*"|\'[^\']*\'))*)?\s*\]%';
		//		$submit_regex         = '%\[\s*submit(\s[-0-9a-zA-Z:#_/\s]*)?(\s+(?:"[^"]*"|\'[^\']*\'))?\s*\]%';

		$types = 'text[*]?|email[*]?|coupon[*]?|time[*]?|textarea[*]?|select[*]?|selectbox[*]?|checkbox[*]?|radio[*]?|acceptance|captchac|captchar|file[*]?|quiz';

		$regex = '%\[\s*(' . $types . ')' .
				 '(\s+[a-zA-Z][0-9a-zA-Z:._-]*)' .
				 '((?:\s*(?:"[^"]*"|\'[^\']*\'|[^"\]\s]+))*)' .
				 '\s*\]%u';

		$regex_start_end_time = '%\[\s*(country[*]?|starttime[*]?|endtime[*]?)' .
								'(\s*[a-zA-Z]*[0-9a-zA-Z:._-]*)' .
								'((?:\s*(?:"[^"]*"|\'[^\']*\'|[^"\]\s]+))*)' .
								'\s*\]%u';

		$submit_regex = '%\[\s*submit' .
						'((?:\s*(?:"[^"]*"|\'[^\']*\'|[^"\]\s]+))*)' .
						'\s*\]%u';


		if ( $replace ) {
			$form = preg_replace_callback( $regex, array( $this, 'form_element_replace_callback' ), $form );
			$form = preg_replace_callback( $regex_start_end_time, array(
				$this,
				'form_element_replace_callback',
			), $form );
			$form = preg_replace_callback( $submit_regex, array( $this, 'submit_replace_callback' ), $form );

			return $form;
		}

		$out = array();
		preg_match_all( $regex, $form, $m1, PREG_SET_ORDER );
		preg_match_all( $regex_start_end_time, $form, $m2, PREG_SET_ORDER );
		foreach ( array_merge( $m1, $m2 ) as $m ) {
			$out[] = (array) $this->form_element_parse( $m );
		}

		return $out;
	}

	/**
	 * preg_replace_callback handler for all non-submit shortcodes.
	 *
	 * @param array<int,mixed> $matches Regex matches for a single shortcode.
	 * @return string Rendered HTML for the matched shortcode.
	 */
	public function form_element_replace_callback( $matches ) {
		// Provide defaults for extract()
		$type             = $name = '';
		$options          = $raw_values = $values = array();
		$placeholder_text = null;
		$named = array();

		extract( (array) $this->form_element_parse( $matches ) ); // $type, $name, $options, $values, $raw_values, $placeholder_text. Now includes $named.

		// Normalize name for country.
		if ( $type === 'country' || $type === 'country*' ) {
			if ( $name === '' ) {
				$name = $type;
			}
		}

		// Suffix booking type for runtime uniqueness
		$name_with_suffix = $name . $this->current_resource_id;

		// Apply edit-booking defaults (select/radio/checkbox/country)
		list( $values, $options ) = $this->apply_edit_defaults( $type, $name_with_suffix, $values, $options );

		// Build common attributes: autocomplete, id, placeholder, class flags.
		$atts = $this->build_common_atts( $type, $name, $name_with_suffix, $options, $placeholder_text, $named );

		$validation_error = $this->build_validation_error( $name_with_suffix );

		// Restore posted value on validation error (for text-ish types)
		$restored_value = $this->restore_posted_value( $type, $name_with_suffix, isset( $values[0] ) ? $values[0]
			: '' );

		// Dispatch per field type
		switch ( $type ) {
			case 'text':
			case 'text*':
			case 'email':
			case 'email*':
			case 'coupon':
			case 'coupon*':
			case 'time':
			case 'time*':
			case 'starttime':
			case 'starttime*':
			case 'endtime':
			case 'endtime*':
			case 'captchar':
				return $this->render_text_like( $type, $name_with_suffix, $atts, $options, $restored_value, $validation_error );

			case 'textarea':
			case 'textarea*':
				return $this->render_textarea( $name_with_suffix, $atts, $options, $restored_value, $validation_error );

			case 'country':
			case 'country*':
				return $this->render_country( $name_with_suffix, $atts, $options, $values, $validation_error );

			case 'select':
			case 'select*':
			case 'selectbox':
			case 'selectbox*':
				return $this->render_select( $type, $name_with_suffix, $atts, $options, $values, $validation_error );

			case 'checkbox':
			case 'checkbox*':
			case 'radio':
			case 'radio*':
				return $this->render_checkable_group( $type, $name_with_suffix, $atts, $options, $values, $validation_error );

			case 'quiz':
				return $this->render_quiz( $name_with_suffix, $atts, $options, $raw_values, $values, $validation_error );

			case 'acceptance':
				return $this->render_acceptance( $name_with_suffix, $atts, $options );

			case 'captchac':
				return $this->render_captcha( $name_with_suffix, $atts, $options );

			case 'file':
			case 'file*':
				return $this->render_file( $name_with_suffix, $atts, $validation_error );
		}

		return '';
	}

	/**
	 * preg_replace_callback handler for the [submit ... "Label"] shortcode.
	 * Supports legacy options (id:, class:) and named attributes (id="", class="", aria-*, data-*, style, ...).
	 *
	 * @param array<int,mixed> $matches Regex matches for the submit shortcode.
	 * @return string Rendered <input type="button"> HTML.
	 */
	public function submit_replace_callback( $matches ) {

		$atts    = '';
		$options = array();
		$value   = '';

		// Parse named attributes from the whole shortcode (id="...", class="...", title="...", aria-*, data-*, style, etc.)
		list( $named_raw, $consumed ) = $this->parse_named_attributes_from_shortcode( $matches[0] );

		// Legacy-style options (id:..., class:..., etc.) from the unquoted leftovers of $matches[1].
		if ( isset( $matches[1] ) && trim( $matches[1] ) !== '' ) {
			$opts_no_quotes = preg_replace( '/"[^"]*"|\'[^\']*\'/u', ' ', trim( $matches[1] ) );
			$options        = preg_split( '/\s+/u', trim( $opts_no_quotes ) );
			$options        = array_values( array_filter( (array) $options, 'strlen' ) );
		}

		// Legacy id:... has priority over named id="..."
		$id_legacy = $this->shift_match( '%^id:([-0-9a-zA-Z_]+)$%', $options );
		if ( $id_legacy ) {
			$atts .= ' id="' . $id_legacy . '"';
		} elseif ( isset( $named_raw['id'] ) && $named_raw['id'] !== '' ) {
			$atts .= ' id="' . esc_attr( $named_raw['id'] ) . '"';
		}

		// Legacy class:... + named class="..."
		$class_legacy = $this->collect_classes( $options );
		$class_named  = isset( $named_raw['class'] ) ? trim( $named_raw['class'] ) : '';
		$btn_classes  = trim( 'wpbc_button_light ' . $class_legacy . ' ' . $class_named );
		$atts         .= ' class="' . esc_attr( $btn_classes ) . '"';

		// Add safe named attributes (title, aria-*, data-*, style if allowed, etc.)
		foreach ( $named_raw as $k => $v ) {
			$kk = $this->sanitize_attr_name( $k, 'submit', 'submit' );
			if ( $kk === '' ) {
				continue;
			}
			if ( in_array( $kk, array( 'id', 'class' ), true ) ) {
				continue;
			}
			if ( $v === '' ) {
				continue;
			}
			$atts .= ' ' . $kk . '="' . esc_attr( $v ) . '"';
		}

		// Label: take the *last* quoted string not consumed by named-attr values
		preg_match_all( '/"[^"]*"|\'[^\']*\'/u', $matches[0], $qm );
		$quoted = $this->strip_quote_deep( $qm[0] );   // unquoted strings
		if ( is_array( $quoted ) ) {
			foreach ( (array) $consumed as $q ) {
				$idx = array_search( $q, $quoted, true );
				if ( $idx !== false ) {
					unset( $quoted[ $idx ] );
				}
			}
			$quoted = array_values( $quoted );
			if ( ! empty( $quoted ) ) {
				$value = $quoted[ count( $quoted ) - 1 ];
			}
		}
		if ( $value === '' ) {
			$value = __( 'Send', 'booking' );
		}

		$html = '';

		// -------------------------------------------------------------------------------------------------------------
		// Cancel / Edit  Buttons.
		// -------------------------------------------------------------------------------------------------------------
		if ( isset( $_GET['booking_hash'] ) ) {                                                                                            // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$get_booking_hash = ( ( isset( $_GET['booking_hash'] ) ) ? sanitize_text_field( wp_unslash( $_GET['booking_hash'] ) ) : '' );  /* phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing */ /* FixIn: sanitize_unslash */
			$my_booking_id_type = wpbc_hash__get_booking_id__resource_id( $get_booking_hash );

			if ( $my_booking_id_type !== false ) {

				$my_edited_bk_id = $my_booking_id_type[0];

				$admin_uri = ltrim( str_replace( get_site_url( null, '', 'admin' ), '', admin_url( 'admin.php?' ) ), '/' );

				$server_request_uri = ( ( isset( $_SERVER['REQUEST_URI'] ) ) ? sanitize_text_field( $_SERVER['REQUEST_URI'] ) : '' );         /* phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.MissingUnslash */ /* FixIn: sanitize_unslash */
				$server_http_referer_uri = ( ( isset( $_SERVER['HTTP_REFERER'] ) ) ? sanitize_text_field( $_SERVER['HTTP_REFERER'] ) : '' );  /* phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.MissingUnslash */ /* FixIn: sanitize_unslash */

				if ( ( strpos( $server_request_uri, $admin_uri ) !== false ) && ( isset( $server_http_referer_uri ) ) ) {
					$html .= '<input type="hidden" name="wpdev_http_referer" id="wpdev_http_referer" value="' . $server_http_referer_uri . '" />';
				}

				$value = __( 'Change your Booking', 'booking' );

				if ( isset( $_GET['booking_cancel'] ) ) {                                                               // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing

					$value = __( 'Cancel Booking', 'booking' );

					$wpbc_nonce = wp_nonce_field( 'DELETE_BY_VISITOR', ( "wpbc_nonce_delete" . $this->current_resource_id ), true, false );

					$get_booking_hash = ( ( isset( $_GET['booking_hash'] ) ) ? sanitize_text_field( wp_unslash( $_GET['booking_hash'] ) ) : '' );  /* phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing */ /* FixIn: sanitize_unslash */

					$html .= $wpbc_nonce . '<input type="button" value="' . esc_attr( $value ) . '"' .
							 					$atts .
							 					' onclick="wpbc_customer_action__booking_cancel(\'' . $get_booking_hash . '\',' . $this->current_resource_id . ', \'' . wpbc_get_maybe_reloaded_booking_locale() . '\' );wpbc_booking_form__this_button__disable( this );" />';

					// FixIn: 8.4.2.5.
					$html .= '<script type="text/javascript"> ' . wpbc_jq_ready_start();                                 // FixIn: 10.1.3.7.
					$html .= ' jQuery( "#booking_form' . (int) $this->current_resource_id . '" ).find(":input").prop("disabled", true);';
					$html .= ' jQuery( "#booking_form' . (int) $this->current_resource_id . '" ).find("input[type=\'button\']").prop("disabled",  false );';
					$html .= wpbc_jq_ready_end() . '</script>';                                                          // FixIn: 10.1.3.7.

					return $html;

				} else {
					// FixIn: 8.4.2.9.
					if ( wpbc_is_new_booking_page() ) {    // FixIn: 8.4.5.9.

						$html .= '<input type="button" value="' . __( 'Duplicate Booking', 'booking' ) . '"' . $atts . ' style="margin:0 50px 20px 0;float: left;"' . ' onclick="if ( wpbc_are_you_sure(\'' . esc_js( __( 'Do you really want to do this ?', 'booking' ) ) . '\') ) { jQuery( \'#wpbc_other_action\' ).val(\'duplicate_booking\'); wpbc_booking_form_submit(this.form,' . $this->current_resource_id . ', \'' . wpbc_get_maybe_reloaded_booking_locale() . '\' ); }" />';
					}
					$html .= '<input type="text" name="wpbc_other_action" id="wpbc_other_action" value="" style="display:none;" />';
				}
			}
		}

		// -------------------------------------------------------------------------------------------------------------
		// Submit Button.
		// -------------------------------------------------------------------------------------------------------------
		$html .= '<input type="button" value="' . esc_attr( $value ) . '"' .
							  $atts .
							  ' onclick="wpbc_booking_form_submit(this.form,' . esc_attr( $this->current_resource_id ) . ', \'' .
							  		esc_js( function_exists( 'wpbc_get_maybe_reloaded_booking_locale' ) ? wpbc_get_maybe_reloaded_booking_locale() : '' ) .
							  '\');" />';

		return $html;
	}


	/* ============================ Rendering methods ============================ */

	/**
	 * Render text-like inputs (text, email, coupon, time, starttime, endtime, captchar).
	 *
	 * @param string              $type             Shortcode type (e.g., 'text', 'email*', 'starttime').
	 * @param string              $name             Field name (already suffixed with booking type).
	 * @param string              $atts             Prebuilt attribute string (leading space included).
	 * @param array<int,string>   $options          Legacy option tokens.
	 * @param string              $value            Initial value.
	 * @param string              $validation_error Validation error HTML (or empty).
	 * @return string Wrapped control HTML.
	 */
	private function render_text_like( $type, $name, $atts, $options, $value, $validation_error ) {
		// Normalize name for start/end time fields
		if ( $type === 'starttime' || $type === 'starttime*' ) {
			$name = 'starttime' . $this->current_resource_id;
		}
		if ( $type === 'endtime' || $type === 'endtime*' ) {
			$name = 'endtime' . $this->current_resource_id;
		}

		// size/maxlength (default size=40) — respect named attrs if already present
		list( $size, $maxlength ) = $this->parse_size_maxlength( $options, 40 );
		$this->append_att_once( $atts, 'size', $size );
		if ( $maxlength > 0 ) {
			$this->append_att_once( $atts, 'maxlength', $maxlength );
		}

		// coupon onchange handler
		$additional_js = ( $type === 'coupon' || $type === 'coupon*' )
			? ' onchange="javascript:if(typeof( wpbc_show_cost_hints_after_few_seconds )==\'function\'){wpbc_show_cost_hints_after_few_seconds(' . $this->current_resource_id . ');}" '
			: '';

		// Input type
		$field_type = ( $type === 'email' || $type === 'email*' ) ? 'type="email"' : 'type="text"';

		$html = '<input ' . $field_type . ' name="' . $name . '" value="' . esc_attr( $value ) . '"' . $atts . $additional_js . ' />';

		return '<span class="wpbc_wrap_text wpdev-form-control-wrap ' . $name . '">' . $html . $validation_error . '</span>';
	}

	/**
	 * Render a <textarea> control.
	 *
	 * @param string            $name             Field name (with booking type suffix).
	 * @param string            $atts             Attribute string.
	 * @param array<int,string> $options          Legacy option tokens (may include 40x5).
	 * @param string            $value            Initial textarea value.
	 * @param string            $validation_error Validation error HTML.
	 * @return string Wrapped control HTML.
	 */
	private function render_textarea( $name, $atts, $options, $value, $validation_error ) {
		// cols/rows
		if ( $cr = $this->shift_match_raw( '%^[0-9]*[x/][0-9]*$%', $options ) ) {
			if ( preg_match( '%^([0-9]*)[x/]([0-9]*)$%', $cr, $mm ) ) {
				if ( ! empty( $mm[1] ) ) {
					$atts .= ' cols="' . (int) $mm[1] . '"';
				}
				if ( ! empty( $mm[2] ) ) {
					$atts .= ' rows="' . (int) $mm[2] . '"';
				}
			}
		}
		$html = '<textarea name="' . $name . '"' . $atts . '>' . esc_attr( $value ) . '</textarea>';

		return '<span class="wpbc_wrap_textarea wpdev-form-control-wrap ' . $name . '">' . $html . $validation_error . '</span>';
	}

	/**
	 * Render a country <select>
	 *
	 * @param string            $name             Field name (with booking type suffix).
	 * @param string            $atts             Attribute string.
	 * @param array<int,string> $options          Legacy option tokens (default:US_CA etc).
	 * @param array<int,string> $values           Single value (e.g., ['US']) or empty.
	 * @param string            $validation_error Validation error HTML.
	 * @return string Wrapped control HTML.
	 */
	private function render_country( $name, $atts, $options, $values, $validation_error ) {
		// Defaults from options default:
		$scr_default = $this->collect_defaults_country( $options );

		$value = isset( $values[0] ) ? $values[0] : '';
		$html  = '';
		$wpbc_dataset_countries = wpbc_dataset_countries();
		foreach ( $wpbc_dataset_countries as $code => $label ) {
			$selected = '';
			if ( is_array( $scr_default ) && in_array( $code, $scr_default, true ) ) {
				$selected = ' selected="selected"';
			}
			if ( $value === $code ) {
				$selected = ' selected="selected"';
			}
			$html .= '<option value="' . esc_attr( $code ) . '"' . $selected . '>' . esc_html( $label ) . '</option>';
		}

		$html = '<select name="' . $name . '"' . $atts . '>' . $html . '</select>';

		return '<span class="wpbc_wrap_select wpdev-form-control-wrap ' . $name . '">' . $html . $validation_error . '</span>';
	}

	/**
	 * Render a generic <select> (and 'selectbox') with support for defaults and multiple selection.
	 *
	 * @param string            $type             'select'|'select*'|'selectbox'|'selectbox*'.
	 * @param string            $name             Field name (with booking type suffix).
	 * @param string            $atts             Attribute string (may already contain multiple="...").
	 * @param array<int,string> $options          Legacy option tokens (include_blank, multiple, default:...).
	 * @param array<int,string> $values           Display/value pairs possibly using 'Label@@value'.
	 * @param string            $validation_error Validation error HTML.
	 * @return string Wrapped control HTML.
	 */
	private function render_select( $type, $name, $atts, $options, $values, $validation_error ) {

		$multiple      = (bool) preg_grep( '%^multiple$%', $options );
		$include_blank = (bool) preg_grep( '%^include_blank$%', $options );
		if ( empty( $values ) || $include_blank ) {
			array_unshift( $values, '---' );
		}

		$scr_default = $this->collect_defaults_scalar( $options ); // default:value

		$onclick = '';
		if (
			( preg_match( '/^select[*]?$/', $type ) && $multiple && ( $name === 'rangetime' . $this->current_resource_id ) ) || ( preg_match( '/^selectbox[*]?$/', $type ) && $multiple && ( $name === 'rangetime' . $this->current_resource_id ) ) ) {
			$onclick = ' wpbc_in_form__make_exclusive_selectbox(this); ';
		}

		$html = '';
		foreach ( $values as $raw ) {
			$selected = '';
			$label    = $raw;
			$value    = $raw;

			// Title@@value support
			if ( strpos( $raw, '@@' ) !== false ) {
				list( $label, $value ) = explode( '@@', $raw, 2 );
			}

			if ( in_array( $value, $scr_default, true ) ) {
				$selected = ' selected="selected"';
			}



			$html .= '<option value="' . esc_attr( $value ) . '"' . $selected . '>' . esc_html( $label ) . '</option>';
		}

		// If author supplied multiple via named attr (multiple="multiple" or ""), it will already be in $atts
		if ( strpos( $atts, ' multiple="' ) !== false ) {
			$multiple = true;
		}

		if ( $multiple ) {
			// only add if not already present from named attrs
			if ( strpos( $atts, ' multiple="' ) === false ) {
				$atts .= ' multiple="multiple"';
			}
		}

		$html = '<select onchange="javascript:' . $onclick . 'if(typeof( wpbc_show_cost_hints_after_few_seconds )==\'function\'){wpbc_show_cost_hints_after_few_seconds(' . $this->current_resource_id . ');}" ' . 'name="' . $name . ( $multiple
				? '[]' : '' ) . '"' . $atts . '>' . $html . '</select>';

		return '<span class="wpbc_wrap_select wpdev-form-control-wrap ' . $name . '">' . $html . $validation_error . '</span>';
	}

	/**
	 * Render checkbox/radio groups with support for label options and defaults.
	 *
	 * @param string            $type             'checkbox'|'checkbox*'|'radio'|'radio*'.
	 * @param string            $name             Field name (with booking type suffix).
	 * @param string            $atts             Attribute string (may include id for label for=... pairing).
	 * @param array<int,string> $options          Legacy option tokens (use_label_element, label_first, etc).
	 * @param array<int,string> $values           Items possibly in 'Label@@value' format.
	 * @param string            $validation_error Validation error HTML.
	 * @return string Wrapped control HTML.
	 */
	private function render_checkable_group( $type, $name, $atts, $options, $values, $validation_error ) {

		// Never reuse the same id="" on multiple inputs.
		$input_atts = preg_replace( '/\s+id="[^"]*"/i', '', (string) $atts );

		$multiple   = ( preg_match( '/^checkbox[*]?$/', $type ) && ! preg_grep( '%^exclusive$%', $options ) );
		$onclick    = ( preg_match( '/^checkbox[*]?$/', $type ) && ! $multiple ) ? ' onclick="wpbc_in_form__make_exclusive_checkbox(this);"' : '';
		$default_on = (bool) preg_grep( '%^default:on$%', $options ) ? ' checked="checked"' : '';
		$input_type = rtrim( $type, '*' );

		$html              = '';
		$id_attr_for_group = '';

		foreach ( (array) $values as $idx => $raw ) {
			$checked    = '';
			$label_text = $raw;
			$value      = $raw;

			if ( strpos( $raw, '@@' ) !== false ) {
				list( $label_text, $value ) = explode( '@@', $raw, 2 );
			}

			// defaults: default:foo, default:bar,...
			foreach ( $this->collect_defaults_scalar( $options ) as $dv ) {
				if ( trim( $dv ) === trim( $value ) && $value !== '' ) {
					$checked = ' checked="checked"';
				}
			}



			// label options
			$is_use_label       = preg_grep( '%^use[_-]?label[_-]?element$%', $options ) ? 'label' : 'span';
			$is_use_label_first = (bool) preg_grep( '%^label[_-]?first$%', $options );
			$is_label_wrap      = (bool) preg_grep( '%^label[_-]?wrap$%', $options );

			$id_attr_for_checkbox = '';
			$label_for_parameter  = '';

			if ( $is_use_label === 'label' ) {
				if ( preg_match( '%id="([-0-9a-zA-Z_]+)"%', $atts, $id_matches ) ) {
					$atts              = str_replace( $id_matches[0], '', $atts );
					$id_attr_for_group = ' id="' . $id_matches[1] . '" ';
					$uniq              = $id_matches[1] . time() . $idx . wp_rand( 1000, 10000 );
				} else {
					$uniq = 'checkboxid' . time() . $idx . wp_rand( 1000, 10000 );
				}
				$label_for_parameter  = ' for="' . $uniq . '" ';
				$id_attr_for_checkbox = ' id="' . $uniq . '" ';
			}

			$item = '<input ' . $input_atts . $id_attr_for_checkbox . ' onchange="javascript:if(typeof( wpbc_show_cost_hints_after_few_seconds )==\'function\'){wpbc_show_cost_hints_after_few_seconds(' . $this->current_resource_id . ');}" ' . ' type="' . $input_type . '" ' . ' name="' . $name . ( $multiple
					? '[]'
					: '' ) . '" ' . ' value="' . esc_attr( $value ) . '"' . $checked . $onclick . $default_on . ' />';

			if ( $is_label_wrap ) {
				$item = $is_use_label_first
					? '<' . $is_use_label . $label_for_parameter . ' class="wpdev-list-item-label">' . esc_html( $label_text ) . $item . '</' . $is_use_label . '>'
					: '<' . $is_use_label . $label_for_parameter . ' class="wpdev-list-item-label">' . $item . esc_html( $label_text ) . '</' . $is_use_label . '>';
			} else {
				$item_label = '<' . $is_use_label . $label_for_parameter . ' class="wpdev-list-item-label">' . esc_html( $label_text ) . '</' . $is_use_label . '>';
				$item       = $is_use_label_first ? ( $item_label . $item ) : ( $item . $item_label );
			}

			$html .= '<span class="wpdev-list-item">' . $item . '</span>';
		}

		$html = '<span' . $atts . $id_attr_for_group . '>' . $html . '</span>';

		return '<span class="wpbc_wrap_checkbox wpdev-form-control-wrap ' . $name . '">' . $html . $validation_error . '</span>';
	}

	/**
	 * Render a simple anti-bot quiz (question + text input + hidden hashed answer).
	 *
	 * @param string            $name             Field name.
	 * @param string            $atts             Attribute string.
	 * @param array<int,string> $options          Legacy option tokens (e.g., 20/80).
	 * @param array<int,string> $raw_values       Raw quoted values including pipes ('Q|A').
	 * @param array<int,string> $values           Extracted question labels.
	 * @param string            $validation_error Validation error HTML.
	 * @return string Wrapped control HTML.
	 */
	private function render_quiz( $name, $atts, $options, $raw_values, $values, $validation_error ) {
		$raw_values = (array) $raw_values;
		if ( count( $raw_values ) === 0 && count( $values ) === 0 ) {
			$raw_values[] = '1+1=?|2';
			$values[]     = '1+1=?';
		}

		$pipes  = $this->get_pipes( $raw_values );
		$label  = ( count( $values ) === 0 ) ? ''
			: ( count( $values ) === 1 ? $values[0] : $values[ array_rand( $values ) ] );
		$answer = $this->canonicalize( $this->pipe( $pipes, $label ) );

		list( $size, $maxlength ) = $this->parse_size_maxlength( $options, 40 );
		$atts .= ' size="' . (int) $size . '"';
		if ( $maxlength > 0 ) {
			$atts .= ' maxlength="' . (int) $maxlength . '"';
		}

		$html = '<span class="wpdev-quiz-label">' . esc_html( $label ) . '</span>&nbsp;';
		$html .= '<input type="text" name="' . $name . '"' . $atts . ' />';
		$html .= '<input type="hidden" name="wpdev_quiz_answer_' . $name . '" value="' . wp_hash( $answer, 'wpdev_quiz' ) . '" />';

		return '<span class="wpdev-form-control-wrap ' . $name . '">' . $html . $validation_error . '</span>';
	}

	/**
	 * Render an acceptance checkbox that toggles submit availability.
	 *
	 * @param string            $name    Field name.
	 * @param string            $atts    Attribute string.
	 * @param array<int,string> $options Legacy option tokens (default:on, invert).
	 * @return string <input type="checkbox"> HTML.
	 */
	private function render_acceptance( $name, $atts, $options ) {
		$default = (bool) preg_grep( '%^default:on$%', $options );
		$onclick = ' onclick="wpdevToggleSubmit(this.form);"';
		$checked = $default ? ' checked="checked"' : '';

		return '<input type="checkbox" name="' . $name . '" value="1"' . $atts . $onclick . $checked . ' />';
	}

	/**
	 * Render CAPTCHA image markup (Really Simple CAPTCHA integration).
	 *
	 * @param string            $name    Field name.
	 * @param string            $atts    Attribute string (width/height may be added).
	 * @param array<int,string> $options Legacy option tokens mapped to generator options.
	 * @return string Hidden challenge + <img> HTML, or message if plugin not active.
	 */
	private function render_captcha( $name, $atts, $options ) {
		if ( ! class_exists( 'ReallySimpleCaptcha' ) ) {
			return '<em>' . esc_html__( 'To use CAPTCHA, you need Really Simple CAPTCHA plugin installed.', 'booking' ) . '</em>';
		}
		$op = array(
			'img_size'        => array( 72, 24 ),
			'base'            => array( 6, 18 ),
			'font_size'       => 14,
			'font_char_width' => 15,
		);
		$op = array_merge( $op, $this->captchac_options( $options ) );
		if ( ! $filename = $this->generate_captcha( $op ) ) {
			return '';
		}
		if ( is_array( $op['img_size'] ) ) {
			$atts .= ' width="' . (int) $op['img_size'][0] . '" height="' . (int) $op['img_size'][1] . '"';
		}
		$captcha_url = trailingslashit( $this->captcha_tmp_url() ) . $filename;
		$html        = '<img alt="' . esc_attr__( 'To show CAPTCHA, please deactivate cache plugin or exclude this page from caching or disable CAPTCHA at WP Booking Calendar - Settings General page in Form Options section.', 'booking' ) . '" src="' . esc_url( $captcha_url ) . '"' . $atts . ' />';
		$ref         = substr( $filename, 0, strrpos( $filename, '.' ) );

		return '<input type="hidden" name="wpdev_captcha_challenge_' . $name . '" value="' . esc_attr( $ref ) . '" />' . $html;
	}

	/**
	 * Render a file upload input.
	 *
	 * @param string $name             Field name.
	 * @param string $atts             Attribute string.
	 * @param string $validation_error Validation error HTML.
	 * @return string Wrapped control HTML.
	 */
	private function render_file( $name, $atts, $validation_error ) {
		$html = '<input type="file" name="' . $name . '"' . $atts . ' value="1" />';

		return '<span class="wpdev-form-control-wrap ' . $name . '">' . $html . $validation_error . '</span>';
	}

	/* =============================== Helpers =============================== */


	/**
	 * Restore a previously submitted value after validation errors.
	 *
	 * @param string $type     Shortcode type.
	 * @param string $name     Field name (with booking type suffix).
	 * @param string $fallback Fallback value when not restoring.
	 * @return string Restored or fallback value.
	 */
	private function restore_posted_value( $type, $name, $fallback ) {
		return $fallback;
	}

	/**
	 * Produce inline validation error HTML for a named field, if present.
	 *
	 * @param string $name Field name (with booking type suffix).
	 * @return string Error span HTML or empty string.
	 */
	private function build_validation_error( $name ) {
		return '';
	}

	/**
	 * Build common HTML attributes for a field from legacy and named attributes.
	 *
	 * @param string               $type                Shortcode type.
	 * @param string               $name_without_suffix Original field name (no booking-type suffix).
	 * @param string               $name_with_suffix    Field name with booking-type suffix.
	 * @param array<int,string>   &$options             Legacy options (consumed as needed).
	 * @param string|null          $placeholder_text    Named/legacy placeholder text, if any.
	 * @param array<string,string> $named               Sanitized named attributes (id, class, aria-*, etc).
	 * @return string Attribute string beginning with a leading space.
	 */
	private function build_common_atts( $type, $name_without_suffix, $name_with_suffix, &$options, $placeholder_text, $named = array() ) {

		$atts = '';

		// Base autocomplete using raw field name (BC).
		$atts .= ' autocomplete="' . esc_attr( $name_without_suffix ) . '"';

		// Legacy id:foo (wins over named id="...").
		if ( $id = $this->shift_match( '%^id:([-0-9a-zA-Z_]+)$%', $options ) ) {
			$atts .= ' id="' . $id . $this->current_resource_id . '"';

		}

		// Legacy placeholder:Enter_name (kept for BC if no named placeholder=...).
		if ( empty( $named['placeholder'] ) ) {
			if ( ! empty( $placeholder_text ) ) {   // placeholder (quoted first).
				$atts .= ' placeholder="' . esc_attr( $placeholder_text ) . '"';
			} else {
				if ( $legacy = $this->shift_match( '%^placeholder:([-0-9a-zA-Z_//]+)$%', $options ) ) {
					$atts .= ' placeholder="' . esc_attr( str_replace( '_', ' ', $legacy ) ) . '"';
				}
			}
		}

		// Legacy classes first.
		$class_att = $this->collect_classes( $options );

		// Validation/role CSS (unchanged).
		if ( preg_match( '/^email[*]?$/', $type ) )     $class_att .= ' wpdev-validates-as-email';
		if ( preg_match( '/^coupon[*]?$/', $type ) )    $class_att .= ' wpdev-validates-as-coupon';
		if ( preg_match( '/^time[*]?$/', $type ) )      $class_att .= ' wpdev-validates-as-time';
		if ( preg_match( '/^starttime[*]?$/', $type ) ) $class_att .= ' wpdev-validates-as-time';
		if ( preg_match( '/^endtime[*]?$/', $type ) )   $class_att .= ' wpdev-validates-as-time';
		if ( preg_match( '/[*]$/', $type ) )            $class_att .= ' wpdev-validates-as-required';
		if ( preg_match( '/^checkbox[*]?$/', $type ) )  $class_att .= ' wpdev-checkbox';
		if ( preg_match( '/^radio[*]?$/', $type ) )     $class_att .= ' wpdev-radio';
		if ( preg_match( '/^captchac$/', $type ) )      $class_att .= ' wpdev-captcha-' . $name_with_suffix;
		if ( $type === 'acceptance' ) {
			$class_att .= ' wpdev-acceptance';
			if ( preg_grep( '%^invert$%', $options ) ) {
				$class_att .= ' wpdev-invert';
			}
		}

		// Merge named class="...".
		if ( isset( $named['class'] ) && $named['class'] !== '' ) {
			$class_att .= ' ' . trim( $named['class'] );
		}
		if ( $class_att ) {
			$atts .= ' class="' . esc_attr( trim( $class_att ) ) . '"';
		}

		// Add the rest of named attributes safely (id/placeholder/class already handled).
		$atts .= $this->build_named_atts_string( $named, $type, $name_without_suffix, $name_with_suffix, $atts, $options );

		return $atts;
	}

	/**
	 * Parse a "size/maxlength" token (e.g., "30/100") from legacy options.
	 *
	 * @param array<int,string> $options       Legacy option tokens.
	 * @param int               $default_size  Default input size if none provided.
	 * @return array{0:int,1:int} [size, maxlength] (maxlength may be 0 if not set).
	 */
	private function parse_size_maxlength( $options, $default_size = 40 ) {
		$size      = (int) $default_size;
		$maxlength = 0;
		$sm        = preg_grep( '%^[0-9]*[/x][0-9]*$%', $options );
		if ( $raw = array_shift( $sm ) ) {
			if ( preg_match( '%^([0-9]*)[/x]([0-9]*)$%', $raw, $mm ) ) {
				if ( ! empty( $mm[1] ) ) {
					$size = (int) $mm[1];
				}
				if ( ! empty( $mm[2] ) ) {
					$maxlength = (int) $mm[2];
				}
			}
		}

		return array( $size, $maxlength );
	}

	/**
	 * Collect default values from tokens like "default:foo" (scalar values).
	 *
	 * @param array<int,string> $options Legacy option tokens.
	 * @return string[] Array of default values.
	 */
	private function collect_defaults_scalar( $options ) {
		$defs = array();
		foreach ( preg_grep( '/^default:/', (array) $options ) as $dv ) {
			// Capture everything after "default:" as-is (trim trailing/leading whitespace).
			if ( preg_match( '/^default:(.+)$/u', $dv, $m ) ) {
				$val    = trim( (string) $m[1] );
				// Historic BC: decode percent entity if present.
				$val    = str_replace( '&#37;', '%', $val );
				$defs[] = $val;
			}
		}
		return $defs;
	}

	/**
	 * Collect default country codes from a token like "default:US_FR".
	 *
	 * @param array<int,string> $options Legacy option tokens.
	 * @return string[] Array of ISO-like country codes.
	 */
	private function collect_defaults_country( $options ) {
		// returns array of country codes from default:US_FR (or similar)
		$def = array_values( preg_grep( '/^default:/', (array) $options ) );
		if ( isset( $def[0] ) && preg_match( '/^default:([0-9a-zA-Z_:\s-]+)$/', $def[0], $m ) ) {
			return explode( '_', $m[1] );
		}

		return array();
	}

	/**
	 * Collect legacy classes from tokens like "class:my_class".
	 *
	 * @param array<int,string> $options Legacy option tokens.
	 * @return string Space-prefixed class list string (may be empty).
	 */
	private function collect_classes( $options ) {
		$acc = '';
		foreach ( preg_grep( '%^class:[-0-9a-zA-Z_]+$%', (array) $options ) as $class ) {
			if ( preg_match( '%^class:([-0-9a-zA-Z_]+)$%', $class, $m ) ) {
				$acc .= ' ' . $m[1];
			}
		}

		return $acc;
	}

	/**
	 * Find and remove the first option that matches a regex and return its first capturing group.
	 *
	 * @param string            $pattern PCRE pattern with exactly one capturing group.
	 * @param array<int,string> $options Options array, passed by reference and mutated.
	 * @return string Captured value or empty string if not found.
	 */
	private function shift_match( $pattern, &$options ) {
		foreach ( (array) $options as $i => $opt ) {
			if ( preg_match( $pattern, $opt, $m ) ) {
				unset( $options[ $i ] );

				return $m[1];
			}
		}

		return '';
	}

	/**
	 * Find and remove the first option that matches a regex; return the raw matched token.
	 *
	 * @param string            $pattern PCRE pattern.
	 * @param array<int,string> $options Options array, passed by reference and mutated.
	 * @return string Matched token or empty string if not found.
	 */
	private function shift_match_raw( $pattern, &$options ) {
		foreach ( (array) $options as $i => $opt ) {
			if ( preg_match( $pattern, $opt ) ) {
				unset( $options[ $i ] );

				return $opt;
			}
		}

		return '';
	}

	/**
	 * When editing an existing booking, convert previously saved values into current defaults.
	 *
	 * @param string            $type              Shortcode type.
	 * @param string            $name_with_suffix  Field name with booking-type suffix.
	 * @param array<int,string> $values            Current values array (may be modified).
	 * @param array<int,string> $options           Current legacy options (may be modified).
	 * @return array{0:array<int,string>,1:array<int,string>} Updated [$values, $options].
	 */
	private function apply_edit_defaults( $type, $name_with_suffix, $values, $options ) {
		$my_edited_bk_id = false;
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
		if ( isset( $_GET['booking_hash'] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.NonceVerification.Missing
			$get_booking_hash = ( isset( $_GET['booking_hash'] ) ? sanitize_text_field( wp_unslash( $_GET['booking_hash'] ) ) : '' );

			$pair = function_exists( 'wpbc_hash__get_booking_id__resource_id' ) ? wpbc_hash__get_booking_id__resource_id( $get_booking_hash ) : false;

			if ( $pair !== false ) {
				$my_edited_bk_id = $pair[0];
			}
		}

		if ( $my_edited_bk_id === false ) {
			return array( $values, $options );
		}

		// Select/radio/checkbox/country: convert previous saved selection into default:
		if ( preg_match( '/^(?:select|selectbox|country|checkbox|radio)[*]?$/', $type ) ) {
			if ( isset( $this->current_edit_booking['parsed_form'][ $name_with_suffix ]['value'] ) ) {
				$options = (array) $options;
				// Remove any existing default:
				foreach ( $options as $k => $v ) {
					if ( strpos( $v, 'default:' ) === 0 ) {
						unset( $options[ $k ] );
					}
				}
				// Preserve spaces and just trim surrounding whitespace on split parts.
				$vals = array_map( 'trim', explode( ',', $this->current_edit_booking['parsed_form'][ $name_with_suffix ]['value'] ) );

				foreach ( $vals as $v ) {
					$options[] = 'default:' . $v;
				}
			}
		} else {
			$values[0] = '';
			$map       = array( 'starttime', 'starttime*', 'endtime', 'endtime*' );
			if ( in_array( $type, $map, true ) ) {
				$key = $type . $this->current_resource_id;
				if ( isset( $this->current_edit_booking['parsed_form'][ $key ]['value'] ) ) {
					$values[0] = $this->current_edit_booking['parsed_form'][ $key ]['value'];
				}
			} elseif ( $type === 'country' || $type === 'country*' ) {
				$key = $type . $this->current_resource_id;
				if ( isset( $this->current_edit_booking['parsed_form'][ $key ]['value'] ) ) {
					$options[0] = $this->current_edit_booking['parsed_form'][ $key ]['value'];
				}
			} else {
				if ( isset( $this->current_edit_booking['parsed_form'][ $name_with_suffix ]['value'] ) ) {
					$values[0] = $this->current_edit_booking['parsed_form'][ $name_with_suffix ]['value'];
				}
			}
		}

		return array( $values, $options );
	}

	/* =============================== Parser =============================== */

	/**
	 * Parse a matched shortcode token into a structured array (type, name, options, values, etc.).
	 *
	 * @param array<int,mixed> $element Regex match array for a shortcode.
	 * @return array{
	 *   type:string,
	 *   name:string,
	 *   options:array<int,string>,
	 *   values:array<int,string>,
	 *   raw_values:array<int,string>,
	 *   placeholder_text:?string,
	 *   named:array<string,string>
	 * }
	 */
	public function form_element_parse( $element ) {
		$type    = trim( $element[1] );
		$name    = trim( $element[2] );


		$opt_str = isset( $element[3] ) ? trim( $element[3] ) : '';

		// 1) Build $options from the combined “rest” group, but ignore quoted substrings.
		$options = array();
		if ( $opt_str !== '' ) {
			$opts_no_quotes = preg_replace( '/"[^"]*"|\'[^\']*\'/u', ' ', $opt_str );
			$options        = preg_split( '/\s+/u', trim( $opts_no_quotes ) );
			$options        = array_values( array_filter( $options, 'strlen' ) );
		}

		// 2) Quoted chunks: scan the FULL shortcode text (so order doesn’t matter).
		preg_match_all( '/"[^"]*"|\'[^\']*\'/u', $element[0], $m );
		$raw_values = $this->strip_quote_deep( $m[0] );

		// 3) As you already do:
		list( $named_raw, $consumed ) = $this->parse_named_attributes_from_shortcode( $element[0] );

		// Remove named-attr quoted values from $raw_values (unchanged logic).
		if ( is_array( $raw_values ) && is_array( $consumed ) ) {
			foreach ( $consumed as $q ) {
				$idx = array_search( $q, $raw_values, true );
				if ( $idx !== false ) {
					unset( $raw_values[ $idx ] );
				}
			}
			$raw_values = array_values( $raw_values );
		}

		/* -------------------------------------------------------------------------------------------------
		 * FixIn: 11.0.3 — Unify 'default' handling:
		 * Treat named attribute default="VALUE" the same as legacy default:VALUE,
		 * and preserve spaces (do NOT replace with underscores). This ensures both
		 * syntaxes select the same option on first render.
		 * ------------------------------------------------------------------------------------------------- */
		if ( isset( $named_raw['default'] ) && $named_raw['default'] !== '' ) {
			$options[] = 'default:' . $named_raw['default'];
			// De-duplicate if the author happened to include both forms.
			$options   = array_values( array_unique( (array) $options ) );
		}

		// Placeholder precedence: named placeholder=... first, then legacy placeholder:"..."/placeholder:token.
		$placeholder_text = null;
		if ( isset( $named_raw['placeholder'] ) && $named_raw['placeholder'] !== '' ) {
			$placeholder_text = $named_raw['placeholder'];
		} else {
			if ( preg_match( '/\bplaceholder\s*:\s*(?:"([^"]*)"|\'([^\']*)\')/u', $element[0], $pm ) ) {
				$placeholder_text = ( $pm[1] !== '' ) ? $pm[1] : ( isset( $pm[2] ) ? $pm[2] : null );
				if ( $placeholder_text !== null && is_array( $raw_values ) ) {
					$idx = array_search( $placeholder_text, $raw_values, true );
					if ( $idx !== false ) {
						unset( $raw_values[ $idx ] );
						$raw_values = array_values( $raw_values );
					}
				}
			}
		}

		// For choice-like fields, keep your existing pipe logic
		if ( preg_match( '/^(select[*]?|selectbox[*]?|checkbox[*]?|radio[*]?)$/', $type ) || 'quiz' === $type ) {
			$pipes  = $this->get_pipes( $raw_values );
			$values = $this->get_pipe_ins( $pipes );
		} else {
			$values =& $raw_values;
		}

		// Sanitize named attribute keys (allow aria-*, data-*, block style)
		$named = array();
		foreach ( (array) $named_raw as $k => $v ) {
			$kk = $this->sanitize_attr_name( $k, $type, $name );
			if ( $kk !== '' ) {
				$named[ $kk ] = $v;
			}
		}

		return compact( 'type', 'name', 'options', 'values', 'raw_values', 'placeholder_text', 'named' );
	}

	/* ======================= Utility / existing helpers ======================= */

	/**
	 * Remove surrounding single/double quotes from a string.
	 *
	 * @param string $text Possibly quoted text.
	 * @return string Unquoted text.
	 */
	public function strip_quote( $text ) {
		$text = trim( $text );
		if ( preg_match( '/^"(.*)"$/s', $text, $m ) ) {
			$text = $m[1];
		} elseif ( preg_match( "/^'(.*)'$/s", $text, $m ) ) {
			$text = $m[1];
		}

		return $text;
	}

	/**
	 * Apply strip_quote() to a string or every element of an array.
	 *
	 * @param string|array<int,string> $arr String or array of strings.
	 * @return string|array<int,string> Unquoted string or array of unquoted strings.
	 */
	public function strip_quote_deep( $arr ) {
		if ( is_string( $arr ) ) {
			return $this->strip_quote( $arr );
		}
		if ( is_array( $arr ) ) {
			$out = array();
			foreach ( $arr as $k => $text ) {
				$out[ $k ] = $this->strip_quote( $text );
			}

			return $out;
		}

		return array();
	}

	/**
	 * Map a value (or array of values) through "pipes" pairs [in, out]; returns mapped value(s).
	 *
	 * @param array<int,array{0:string,1:string}> $pipes  Array of [label,binding] pairs.
	 * @param string|array<int,string>            $value  Value(s) to map.
	 * @return string|array<int,string> Mapped value(s).
	 */
	public function pipe( $pipes, $value ) {
		if ( is_array( $value ) ) {
			$res = array();
			foreach ( $value as $k => $v ) {
				$res[ $k ] = $this->pipe( $pipes, $v );
			}

			return $res;
		}
		foreach ( $pipes as $p ) {
			if ( $p[0] == $value ) {
				return $p[1];
			}
		}

		return $value;
	}

	/**
	 * Return unique "in" values from pipes.
	 *
	 * @param array<int,array{0:string,1:string}> $pipes Pipes array.
	 * @return string[] Unique list of "in" values.
	 */
	public function get_pipe_ins( $pipes ) {
		$ins = array();
		foreach ( $pipes as $pipe ) {
			$in = $pipe[0];
			if ( ! in_array( $in, $ins, true ) ) {
				$ins[] = $in;
			}
		}

		return $ins;
	}

	/**
	 * Convert raw values like "Label|Value" into [Label, Value] pipe pairs.
	 *
	 * @param array<int,string> $values Raw values (may include '|').
	 * @return array<int,array{0:string,1:string}> Pipe pairs [label,binding].
	 */
	public function get_pipes( $values ) {
		$pipes = array();
		foreach ( (array) $values as $value ) {
			$pos = strpos( $value, '|' );
			if ( false === $pos ) {
				$before = $after = $value;
			} else {
				$before = substr( $value, 0, $pos );
				$after  = substr( $value, $pos + 1 );
			}
			$pipes[] = array( $before, $after );
		}

		return $pipes;
	}

	/* ---- Stubs you likely have elsewhere; keep signatures identical ---- */
	/**
	 * Canonicalize a string for comparisons/hashing (override upstream if needed).
	 *
	 * @param string $str Input string.
	 * @return string Canonical form (default: unchanged).
	 */
	protected function canonicalize( $str ) {
		return $str;
	}

	/**
	 * Map legacy captcha options into generator options (override upstream if needed).
	 *
	 * @param array<int,string> $options Legacy option tokens.
	 * @return array<string,mixed> Captcha generator options.
	 */
	protected function captchac_options( $options ) {
		return array();
	}

	/**
	 * Generate a CAPTCHA image file and return its filename (override upstream if needed).
	 *
	 * @param array<string,mixed> $op Options for image generation.
	 * @return string|false Filename (without path) on success, false on failure.
	 */
	protected function generate_captcha( $op ) {
		return false;
	}

	/**
	 * Get temporary URL for CAPTCHA images (override upstream if needed).
	 *
	 * @return string Base URL used to serve generated CAPTCHA files.
	 */
	protected function captcha_tmp_url() {
		return '';
	}

	// =================================================================================================================
	// FixIn: 11.0.2.   2025-08-22 11:54
	// =================================================================================================================

	/* == New helpers for named attributes ====================== */

	/**
	 * Parse named attributes (id, class, placeholder, aria-*, data-*, style, etc.) from a shortcode slice.
	 * Also returns the set of quoted values that were consumed so they can be excluded from field values.
	 *
	 * @param string $shortcode_text Raw shortcode substring including brackets.
	 * @return array{0:array<string,string>,1:array<int,string>} [named attributes, consumed quoted values].
	 */
	private function parse_named_attributes_from_shortcode( $shortcode_text ) {
		$named    = array();
		$consumed = array();

		// key[:=]"double" | 'single' | unquoted
		$attr_pattern = '/\b([a-zA-Z][\w:-]*)\s*[:=]\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s\]"]+))/u';

		if ( preg_match_all( $attr_pattern, $shortcode_text, $mm, PREG_SET_ORDER ) ) {
			foreach ( $mm as $m ) {
				$key = strtolower( $m[1] );
				$val = '';
				if ( isset( $m[2] ) && $m[2] !== '' ) {
					$val        = $m[2];
					$consumed[] = $m[2];                // so we can remove this quoted piece from values
				} elseif ( isset( $m[3] ) && $m[3] !== '' ) {
					$val        = $m[3];
					$consumed[] = $m[3];
				} elseif ( isset( $m[4] ) ) {
					$val = $m[4];
				}
				$named[ $key ] = $val;
			}
		}

		// Normalize boolean-ish flags: multiple="", multiple="multiple", multiple=1 → multiple: true
		foreach ( array( 'multiple' ) as $bool_key ) {
			if ( array_key_exists( $bool_key, $named ) && $named[ $bool_key ] === '' ) {
				$named[ $bool_key ] = '1';
			}
		}

		return array( $named, $consumed );
	}

	/**
	 * Validate/allow attribute names; permits aria-* and data-* and optionally 'style' via a filter.
	 *
	 * @param string $name       Raw attribute name.
	 * @param string $type       Shortcode type (used for style gating).
	 * @param string $field_name Original field name (used for style gating).
	 * @return string Sanitized attribute name, or '' if disallowed.
	 */
	private function sanitize_attr_name( $name, $type = '', $field_name = '' ) {

		$name = strtolower( trim( $name ) );

		if ( strpos( $name, 'on' ) === 0 ) {
			return '';
		}

		if ( $name === 'style' ) {
			// Only allow if opt-in filter returns true for this field/type.
			return $this->allow_inline_style( $type, $field_name ) ? 'style' : '';
		}

		// basic validity, allow aria-* and data-*
		if ( preg_match( '/^(?:[a-z][\w:-]*|aria-[\w:-]+|data-[\w:-]+)$/', $name ) ) {
			return $name;
		}

		return '';
	}

	/**
	 * Build a string of allowed named attributes for an element, avoiding duplicates and honoring filters.
	 *
	 * @param array<string,string> $named             Named attributes parsed from shortcode.
	 * @param string               $type              Shortcode type.
	 * @param string               $name_without_suffix Field name without booking-type suffix.
	 * @param string               $name_with_suffix    Field name with booking-type suffix.
	 * @param string               $existing_atts     Current attribute string (to avoid duplicates).
	 * @param array<int,string>   &$options           Legacy options (checked for id:... etc).
	 * @return string Attribute fragment beginning with a leading space (or empty).
	 */
	private function build_named_atts_string( $named, $type, $name_without_suffix, $name_with_suffix, $existing_atts, &$options ) {
		$atts = '';

		// We'll avoid duplicating attributes already present in $existing_atts.
		$has = function ( $needle ) use ( $existing_atts ) {
			return ( strpos( $existing_atts, ' ' . $needle . '="' ) !== false );
		};

		// id: prefer legacy id:... already handled elsewhere; otherwise allow id="..."
		if ( ! $has( 'id' ) && ! $this->shift_match( '%^id:([-0-9a-zA-Z_]+)$%', $options ) && isset( $named['id'] ) && $named['id'] !== '' ) {
			$atts .= ' id="' . esc_attr( $named['id'] . $this->current_resource_id ) . '"';
		}

		// placeholder: prefer quoted named > legacy placeholder:token
		if ( ! $has( 'placeholder' ) && isset( $named['placeholder'] ) && $named['placeholder'] !== '' ) {
			$atts .= ' placeholder="' . esc_attr( $named['placeholder'] ) . '"';
		}

		// class: merge legacy (collect_classes) with named class=""
		if ( isset( $named['class'] ) && $named['class'] !== '' ) {
			// We'll merge later in build_common_atts(); here we just mark presence to suppress duplicates.
			if ( ! $has( 'class' ) ) {
				$atts .= ' class="' . esc_attr( trim( $named['class'] ) ) . '"';
			}
		}

		// Generic allowlist for simple inputs; these are safe + common.
		$generic_allow = array( 'maxlength', 'minlength', 'size', 'pattern', 'title', 'inputmode', 'list', 'step', 'min', 'max', 'dir', 'lang', 'tabindex' );

		// Allow style only if opted-in.
		if ( $this->allow_inline_style( $type, $name_without_suffix ) ) {
			$generic_allow[] = 'style';
		}

		foreach ( $named as $k => $v ) {
			$k = $this->sanitize_attr_name( $k, $type, $name_without_suffix );
			if ( '' === $k ) {
				continue;
			}
			if ( in_array( $k, array( 'id', 'class', 'placeholder' ), true ) ) {
				continue;
			}

			$allow = ( in_array( $k, $generic_allow, true ) || str_starts_with( $k, 'aria-' ) || str_starts_with( $k, 'data-' ) );
			if ( ! $allow || '' === $v || $has( $k ) ) {
				continue;
			}

			if ( 'style' === $k ) {
				$v = $this->sanitize_style_attr( $v );
				if ( '' === $v ) {
					continue; // dropped if unsafe/empty.
				}
			}

			$atts .= ' ' . $k . '="' . esc_attr( $v ) . '"';
		}


		return $atts;
	}

	/**
	 * Append an HTML attribute only once to an attributes string.
	 *
	 * @param string &$atts Current attributes string (modified in place).
	 * @param string $name  Attribute name.
	 * @param mixed  $value Attribute value (will be escaped).
	 * @return void
	 */
	private function append_att_once( &$atts, $name, $value ) {
		if ( strpos( $atts, ' ' . $name . '="' ) === false ) {
			$atts .= ' ' . $name . '="' . esc_attr( $value ) . '"';
		}
	}

	/**
	 * Whether inline style="" attributes are allowed for a given field/type (via filter).
	 *
	 * @param string $type Shortcode type.
	 * @param string $name Field name without suffix.
	 * @return bool True if style is allowed.
	 */
	private function allow_inline_style( $type = '', $name = '' ) {
		// Developers can enable per site / per field via filter.
		// Example: add_filter('wpbc_form_allow_inline_style_attr', fn($allow,$type,$name)=> true);
		return (bool) apply_filters( 'wpbc_form_allow_inline_style_attr', false, $type, $name, $this );
	}

	/**
	 * Sanitize a CSS style attribute value using WordPress KSES (or a conservative fallback).
	 *
	 * @param string $style Raw style attribute.
	 * @return string Sanitized style (empty string if nothing allowed remains).
	 */
	private function sanitize_style_attr( $style ) {
		$style = trim( (string) $style );
		if ( $style === '' ) {
			return '';
		}

		// Prefer WP core’s CSS sanitizer if available.
		if ( function_exists( 'safecss_filter_attr' ) ) {
			$style = safecss_filter_attr( $style );
		} else {
			// Very conservative fallback: drop dangerous patterns.
			// Disallow expression() and url(...) which can hide JS.
			$style = preg_replace( '/expression\s*\([^)]*\)/i', '', $style );
			$style = preg_replace( '/url\s*\([^)]*\)/i', '', $style );
			// Normalize spacing around semicolons.
			$style = preg_replace( '/\s*;\s*/', '; ', $style );
		}

		return trim( $style );
	}

}


/**
 * Allow inline style="" for selected shortcode types via the 'wpbc_form_allow_inline_style_attr' filter.
 *
 * @param bool   $allow Current decision (default false).
 * @param string $type  Shortcode type being rendered (e.g., 'text', 'select*', 'submit').
 * @param string $name  Field name (without booking-type suffix).
 * @return bool True to allow style for this field/type; otherwise previous $allow.
 */
function wpbc_form_allow_inline_style_attr_filter_free( $allow, $type, $name ) {

	$allow_shortcode_type_arr = array(
		'text', 'email', 'coupon', 'time', 'textarea', 'select', 'selectbox', 'checkbox', 'radio', 'submit',
		'text*', 'email*', 'coupon*', 'time*', 'textarea*', 'select*', 'selectbox*', 'checkbox*', 'radio'
	);
 	// 'text[*]?|email[*]?|coupon[*]?|time[*]?|textarea[*]?|select[*]?|selectbox[*]?|checkbox[*]?|radio[*]?|submit';  //.

	if ( in_array( $type, $allow_shortcode_type_arr, true ) ) {
		return true;
	}

	return $allow;
}
add_filter( 'wpbc_form_allow_inline_style_attr', 'wpbc_form_allow_inline_style_attr_filter_free', 10, 3 );
