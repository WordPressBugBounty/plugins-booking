/**
 * WPBC BFB: Country List field renderer and exporters.
 *
 * @since 11.8.5
 */
( function ( w, document ) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		return;
	}

	/**
	 * Escape preview text if the shared Builder sanitizer is unavailable.
	 *
	 * @param {*} raw_value Preview value.
	 *
	 * @returns {string} HTML-safe preview value.
	 */
	function wpbc_bfb_country_escape_html( raw_value ) {
		return String( raw_value )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	/**
	 * Read and normalize the server-owned Country dataset.
	 *
	 * @returns {Array<{value:string,label:string}>} Safe ordered choices.
	 */
	function wpbc_bfb_country_get_choices() {
		var boot = w.WPBC_BFB_Country_Boot || {};

		if ( ! Array.isArray( boot.countries ) ) {
			return [];
		}

		return boot.countries.reduce( function ( country_choices, country_choice ) {
			var country_code;
			var country_label;

			if ( ! country_choice || typeof country_choice !== 'object' ) {
				return country_choices;
			}

			country_code  = String( country_choice.value || '' );
			country_label = String( country_choice.label || '' );

			if ( ! /^[A-Za-z0-9_.:-]{1,32}$/.test( country_code ) || ! country_label ) {
				return country_choices;
			}

			country_choices.push( { value: country_code, label: country_label } );
			return country_choices;
		}, [] );
	}

	/**
	 * Resolve a candidate code to its canonical localized dataset key.
	 *
	 * @param {*} country_code Candidate stored country code.
	 *
	 * @returns {string} Canonical code, or an empty string when unsupported.
	 */
	function wpbc_bfb_country_get_canonical_code( country_code ) {
		var candidate = String( country_code || '' ).trim();
		var choices   = wpbc_bfb_country_get_choices();
		var exact_choice;
		var case_insensitive_choice;

		if ( ! candidate ) {
			return '';
		}

		exact_choice = choices.find( function ( country_choice ) {
			return country_choice.value === candidate;
		} );
		if ( exact_choice ) {
			return exact_choice.value;
		}

		case_insensitive_choice = choices.find( function ( country_choice ) {
			return country_choice.value.toLowerCase() === candidate.toLowerCase();
		} );

		return case_insensitive_choice ? case_insensitive_choice.value : '';
	}

	/**
	 * Render the Country List field inside the visual Builder canvas.
	 */
	class WPBC_BFB_Field_Country extends Base {

		/**
		 * Return defaults kept in sync with the PHP schema.
		 *
		 * @returns {Object} Country field defaults.
		 */
		static get_defaults() {
			return {
				type            : 'country',
				label           : 'Country',
				default_country : '',
				help            : ''
			};
		}

		/**
		 * Render an inert country selector using the public renderer's dataset.
		 *
		 * @param {HTMLElement} element    Canvas field element.
		 * @param {Object}      field_data Stored field data.
		 * @param {Object}      context    Builder rendering context.
		 *
		 * @returns {void}
		 */
		static render( element, field_data, context ) {
			var data;
			var sanitize;
			var escape_html;
			var default_country;
			var option_html;
			var label_html;
			var help_html;

			if ( ! element ) {
				return;
			}

			data            = this.normalize_data( field_data );
			sanitize        = Core.WPBC_BFB_Sanitize || {};
			escape_html     = sanitize.escape_html || wpbc_bfb_country_escape_html;
			default_country = wpbc_bfb_country_get_canonical_code( data.default_country );
			option_html     = wpbc_bfb_country_get_choices().map( function ( country_choice ) {
				var selected = country_choice.value === default_country ? ' selected' : '';

				return '<option value="' + escape_html( country_choice.value ) + '"' + selected + '>' +
					escape_html( country_choice.label ) + '</option>';
			} ).join( '' );
			label_html = data.label
				? '<label class="wpbc_bfb__field-label">' + escape_html( data.label ) + '</label>'
				: '';
			help_html = data.help ? '<div class="wpbc_bfb__help">' + escape_html( data.help ) + '</div>' : '';

			element.dataset.default_country = default_country;
			element.innerHTML = '<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">' +
				label_html +
				'<span class="wpbc_wrap_select wpdev-form-control-wrap country">' +
				'<select class="wpbc_bfb__preview-input" disabled aria-disabled="true" tabindex="-1">' +
				option_html + '</select></span>' + help_html + '</span>';

			if ( Core.UI && Core.UI.WPBC_BFB_Overlay && typeof Core.UI.WPBC_BFB_Overlay.ensure === 'function' ) {
				Core.UI.WPBC_BFB_Overlay.ensure( context && context.builder, element );
			}
		}

		/**
		 * Apply canonical defaults when the palette item is first dropped.
		 *
		 * @param {Object}      field_data New field data.
		 * @param {HTMLElement} element    New canvas element.
		 * @param {Object}      context    Builder context.
		 *
		 * @returns {void}
		 */
		static on_field_drop( field_data, element, context ) {
			if ( field_data ) {
				field_data.type            = 'country';
				field_data.default_country = wpbc_bfb_country_get_canonical_code( field_data.default_country );
			}

			if ( element ) {
				element.dataset.type            = 'country';
				element.dataset.usage_key       = 'country';
				element.dataset.default_country = wpbc_bfb_country_get_canonical_code( element.dataset.default_country );
			}

			if ( typeof super.on_field_drop === 'function' ) {
				super.on_field_drop( field_data, element, context );
			}
		}
	}

	registry.register( 'country', WPBC_BFB_Field_Country );
	w.WPBC_BFB_Field_Country = w.WPBC_BFB_Field_Country || WPBC_BFB_Field_Country;

	/**
	 * Register the Country Advanced Booking Form exporter.
	 *
	 * @returns {boolean} True when registration is complete.
	 */
	function wpbc_bfb_register_country_form_exporter() {
		var Exporter = w.WPBC_BFB_Exporter;

		if ( ! Exporter || typeof Exporter.register !== 'function' ) {
			return false;
		}
		if ( typeof Exporter.has_exporter === 'function' && Exporter.has_exporter( 'country' ) ) {
			return true;
		}

		Exporter.register( 'country', function ( field, emit, extras ) {
			var once;
			var config;
			var default_country;
			var shortcode;

			extras = extras || {};
			once   = extras.once || {};
			config = extras.cfg || {};

			if ( Number( once.country || 0 ) > 0 ) {
				return;
			}

			once.country    = Number( once.country || 0 ) + 1;
			default_country = wpbc_bfb_country_get_canonical_code( field && field.default_country );
			shortcode       = default_country ? '[country "' + default_country + '"]' : '[country]';

			Exporter.emit_label_then( field, emit, shortcode, config );
		} );

		return true;
	}

	if ( ! wpbc_bfb_register_country_form_exporter() && document && typeof document.addEventListener === 'function' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', wpbc_bfb_register_country_form_exporter, { once: true } );
	}

	/**
	 * Register the Country Booking Data exporter.
	 *
	 * @returns {boolean} True when registration is complete.
	 */
	function wpbc_bfb_register_country_content_exporter() {
		var ContentExporter = w.WPBC_BFB_ContentExporter;

		if ( ! ContentExporter || typeof ContentExporter.register !== 'function' ) {
			return false;
		}
		if ( typeof ContentExporter.has_exporter === 'function' && ContentExporter.has_exporter( 'country' ) ) {
			return true;
		}

		ContentExporter.register( 'country', function ( field, emit, extras ) {
			var config;
			var label;

			extras = extras || {};
			config = extras.cfg || {};
			label  = field && typeof field.label === 'string' && field.label.trim()
				? field.label.trim()
				: 'Country';

			ContentExporter.emit_line_bold_field( emit, label, 'country', config );
		} );

		return true;
	}

	if ( ! wpbc_bfb_register_country_content_exporter() && document && typeof document.addEventListener === 'function' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', wpbc_bfb_register_country_content_exporter, { once: true } );
	}
} )( window, document );
