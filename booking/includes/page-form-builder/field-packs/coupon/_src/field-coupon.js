/**
 * WPBC BFB: Discount Coupon field renderer and exporters.
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
	 * Read server-owned Coupon field configuration.
	 *
	 * @returns {{is_supported:boolean, upgrade_text:string}} Coupon configuration.
	 */
	function wpbc_bfb_coupon_get_boot() {
		var boot = w.WPBC_BFB_Coupon_Boot || {};

		return {
			is_supported : String( boot.is_supported || '0' ) === '1',
			upgrade_text : String( boot.upgrade_text || 'This field is available only in Booking Calendar Business Large or higher versions.' )
		};
	}

	/**
	 * Escape preview text if the shared Builder sanitizer is unavailable.
	 *
	 * @param {*} raw_value Preview value.
	 *
	 * @returns {string} HTML-safe preview value.
	 */
	function wpbc_bfb_coupon_escape_html( raw_value ) {
		return String( raw_value )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	/**
	 * Render the Coupon field inside the visual Builder canvas.
	 */
	class WPBC_BFB_Field_Coupon extends Base {

		/**
		 * Return defaults kept in sync with the PHP schema.
		 *
		 * @returns {Object} Coupon field defaults.
		 */
		static get_defaults() {
			return {
				type        : 'coupon',
				label       : 'Discount Coupon',
				name        : 'coupon',
				placeholder : '',
				required    : false,
				help        : '',
				cssclass    : '',
				html_id     : ''
			};
		}

		/**
		 * Render an inert Coupon input preview and edition guidance.
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
			var sanitize_name;
			var sanitize_id;
			var sanitize_classes;
			var is_truthy;
			var field_name;
			var html_id;
			var css_classes;
			var is_required;
			var boot;
			var input_classes;
			var label_html;
			var input_html;
			var help_html;
			var upgrade_html;

			if ( ! element ) {
				return;
			}

			data             = this.normalize_data( field_data );
			sanitize         = Core.WPBC_BFB_Sanitize || {};
			escape_html      = sanitize.escape_html || wpbc_bfb_coupon_escape_html;
			sanitize_name    = sanitize.sanitize_html_name || function ( value ) { return String( value ); };
			sanitize_id      = sanitize.sanitize_html_id || function ( value ) { return String( value ); };
			sanitize_classes = sanitize.sanitize_css_classlist || function ( value ) { return String( value ); };
			is_truthy        = sanitize.is_truthy || function ( value ) { return true === value || 'true' === value || 1 === value || '1' === value; };
			field_name       = sanitize_name( String( data.name || 'coupon' ) ) || 'coupon';
			html_id          = data.html_id ? sanitize_id( String( data.html_id ) ) : '';
			css_classes      = data.cssclass ? sanitize_classes( String( data.cssclass ) ) : '';
			is_required      = is_truthy( data.required );
			boot             = wpbc_bfb_coupon_get_boot();
			input_classes    = 'wpbc_bfb__preview-input wpdev-validates-as-coupon' +
				( is_required ? ' wpdev-validates-as-required' : '' ) +
				( css_classes ? ' ' + css_classes : '' );

			label_html = data.label
				? '<label class="wpbc_bfb__field-label"' + ( html_id ? ' for="' + escape_html( html_id ) + '"' : '' ) + '>' +
					escape_html( data.label ) + ( is_required ? ' <span aria-hidden="true">*</span>' : '' ) + '</label>'
				: '';
			input_html = '<span class="wpbc_wrap_text wpdev-form-control-wrap ' + escape_html( field_name ) + '">' +
				'<input type="text" class="' + escape_html( input_classes ) + '" name="' + escape_html( field_name ) + '"' +
				( html_id ? ' id="' + escape_html( html_id ) + '"' : '' ) +
				( data.placeholder ? ' placeholder="' + escape_html( data.placeholder ) + '"' : '' ) +
				( is_required ? ' required aria-required="true"' : '' ) +
				' readonly aria-readonly="true" tabindex="-1" /></span>';
			help_html = data.help ? '<div class="wpbc_bfb__help">' + escape_html( data.help ) + '</div>' : '';
			upgrade_html = ! boot.is_supported
				? '<div class="wpbc_bfb__help" role="note">' + escape_html( boot.upgrade_text ) + '</div>'
				: '';

			element.dataset.name        = field_name;
			element.dataset.html_id     = html_id;
			element.dataset.cssclass    = css_classes;
			element.dataset.required    = is_required ? 'true' : 'false';
			element.innerHTML = '<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">' +
				label_html + input_html + help_html + upgrade_html + '</span>';

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
				field_data.type = 'coupon';
				field_data.name = field_data.name || 'coupon';
			}

			if ( element ) {
				element.dataset.type      = 'coupon';
				element.dataset.name      = element.dataset.name || 'coupon';
				element.dataset.usage_key = 'coupon';
			}

			if ( typeof super.on_field_drop === 'function' ) {
				super.on_field_drop( field_data, element, context );
			}
		}
	}

	registry.register( 'coupon', WPBC_BFB_Field_Coupon );
	w.WPBC_BFB_Field_Coupon = w.WPBC_BFB_Field_Coupon || WPBC_BFB_Field_Coupon;

	/**
	 * Register the Coupon Advanced Booking Form exporter.
	 *
	 * @returns {boolean} True when registration is complete.
	 */
	function wpbc_bfb_register_coupon_form_exporter() {
		var Exporter = w.WPBC_BFB_Exporter;

		if ( ! Exporter || typeof Exporter.register !== 'function' ) {
			return false;
		}
		if ( typeof Exporter.has_exporter === 'function' && Exporter.has_exporter( 'coupon' ) ) {
			return true;
		}

		Exporter.register( 'coupon', function ( field, emit, extras ) {
			var boot;
			var once;
			var context;
			var config;
			var required_marker;
			var name;
			var shortcode;

			extras  = extras || {};
			boot    = wpbc_bfb_coupon_get_boot();
			once    = extras.once || {};
			context = extras.ctx || { usedIds: new Set() };
			config  = extras.cfg || {};

			if ( ! boot.is_supported || Number( once.coupon || 0 ) > 0 ) {
				return;
			}

			once.coupon   = Number( once.coupon || 0 ) + 1;
			required_marker = Exporter.is_required( field ) ? '*' : '';
			name = Exporter.compute_name( 'coupon', field );
			shortcode = '[coupon' + required_marker + ' ' + name +
				Exporter.id_option( field, context ) +
				Exporter.class_options( field ) +
				Exporter.ph_attr( field.placeholder ) + ']';

			Exporter.emit_label_then( field, emit, shortcode, config );
		} );

		return true;
	}

	if ( ! wpbc_bfb_register_coupon_form_exporter() && document && typeof document.addEventListener === 'function' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', wpbc_bfb_register_coupon_form_exporter, { once: true } );
	}

	/**
	 * Register the Coupon Booking Data exporter.
	 *
	 * @returns {boolean} True when registration is complete.
	 */
	function wpbc_bfb_register_coupon_content_exporter() {
		var ContentExporter = w.WPBC_BFB_ContentExporter;

		if ( ! ContentExporter || typeof ContentExporter.register !== 'function' ) {
			return false;
		}
		if ( typeof ContentExporter.has_exporter === 'function' && ContentExporter.has_exporter( 'coupon' ) ) {
			return true;
		}

		ContentExporter.register( 'coupon', function ( field, emit, extras ) {
			var Exporter;
			var config;
			var name;
			var label;

			if ( ! wpbc_bfb_coupon_get_boot().is_supported ) {
				return;
			}

			Exporter = w.WPBC_BFB_Exporter;
			if ( ! Exporter || typeof Exporter.compute_name !== 'function' ) {
				return;
			}

			extras = extras || {};
			config = extras.cfg || {};
			name   = Exporter.compute_name( 'coupon', field );
			label  = field && typeof field.label === 'string' && field.label.trim()
				? field.label.trim()
				: 'Discount Coupon';

			ContentExporter.emit_line_bold_field( emit, label, name, config );
		} );

		return true;
	}

	if ( ! wpbc_bfb_register_coupon_content_exporter() && document && typeof document.addEventListener === 'function' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', wpbc_bfb_register_coupon_content_exporter, { once: true } );
	}
} )( window, document );
