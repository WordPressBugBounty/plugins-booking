// File: /includes/page-form-builder/field-packs/custom-shortcode/custom-shortcode.js
( function ( window, document ) {
	'use strict';

	var Core     = window.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		return;
	}

	/**
	 * Return translated field-pack strings with safe fallbacks.
	 *
	 * @returns {{example_shortcode:string, invalid_message:string}} Field-pack strings.
	 */
	function wpbc_bfb_custom_shortcode_get_boot() {
		var boot = window.WPBC_BFB_Custom_Shortcode_Boot || {};

		return {
			example_shortcode : String( boot.example_shortcode || '[field_name_hint]' ),
			invalid_message   : String( boot.invalid_message || 'Enter one shortcode in square brackets, for example [field_name_hint].' )
		};
	}

	/**
	 * Normalize one bare bracketed shortcode token.
	 *
	 * Attributes, whitespace, nested brackets, and multiple tokens are rejected
	 * so this presentation field cannot become a second form-control builder.
	 *
	 * @param {*} shortcode_value Candidate value from Builder field data.
	 *
	 * @returns {string} Trimmed token when valid, otherwise an empty string.
	 */
	function wpbc_bfb_custom_shortcode_normalize( shortcode_value ) {
		var shortcode = String( shortcode_value || '' ).trim();

		return /^\[[A-Za-z0-9_-]+\]$/.test( shortcode ) ? shortcode : '';
	}

	/**
	 * Escape preview text when the shared sanitizer is unexpectedly unavailable.
	 *
	 * @param {*} raw_value Preview value.
	 *
	 * @returns {string} HTML-safe preview value.
	 */
	function wpbc_bfb_custom_shortcode_escape_html( raw_value ) {
		return String( raw_value )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	/**
	 * Render and export a single custom shortcode token.
	 */
	class WPBC_BFB_Field_Custom_Shortcode extends Base {

		/**
		 * Return defaults kept in sync with the PHP schema.
		 *
		 * @returns {{type:string, shortcode:string, usage_key:string}} Field defaults.
		 */
		static get_defaults() {
			return {
				type       : 'custom_shortcode',
				shortcode  : '[field_name_hint]',
				usage_key  : 'custom_shortcode'
			};
		}

		/**
		 * Render an inert and escaped Builder preview.
		 *
		 * The raw draft remains in `data-shortcode` while the preview and exporter
		 * use only a validated token. This lets the author finish typing without
		 * silently replacing an incomplete draft with the example value.
		 *
		 * @param {HTMLElement} el   Builder field element.
		 * @param {Object}      data Field properties.
		 * @param {Object}      ctx  Builder context.
		 *
		 * @returns {void}
		 */
		static render( el, data, ctx ) {
			var field_data;
			var raw_shortcode;
			var shortcode;
			var boot;
			var display_shortcode;
			var invalid_html;
			var escape_html;

			if ( ! el ) {
				return;
			}

			field_data       = this.normalize_data( data );
			raw_shortcode    = String( field_data.shortcode || '' ).trim();
			shortcode        = wpbc_bfb_custom_shortcode_normalize( raw_shortcode );
			boot             = wpbc_bfb_custom_shortcode_get_boot();
			display_shortcode = raw_shortcode || boot.example_shortcode;
			escape_html      = Core.WPBC_BFB_Sanitize && Core.WPBC_BFB_Sanitize.escape_html
				? Core.WPBC_BFB_Sanitize.escape_html
				: wpbc_bfb_custom_shortcode_escape_html;
			invalid_html = shortcode
				? ''
				: '<span class="wpbc_bfb__help" role="alert">' + escape_html( boot.invalid_message ) + '</span>';

			el.dataset.shortcode = raw_shortcode;
			el.innerHTML =
				'<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">' +
					'<code class="wpbc_bfb__custom-shortcode-preview">' + escape_html( display_shortcode ) + '</code>' +
				'</span>' +
				invalid_html;

			if ( Core.UI && Core.UI.WPBC_BFB_Overlay && typeof Core.UI.WPBC_BFB_Overlay.ensure === 'function' ) {
				Core.UI.WPBC_BFB_Overlay.ensure( ctx && ctx.builder, el );
			}
		}

		/**
		 * Preserve the standard Builder post-drop behavior.
		 *
		 * @param {Object}      data Field properties.
		 * @param {HTMLElement} el   Builder field element.
		 * @param {Object}      ctx  Builder context.
		 *
		 * @returns {void}
		 */
		static on_field_drop( data, el, ctx ) {
			if ( typeof super.on_field_drop === 'function' ) {
				super.on_field_drop( data, el, ctx );
			}
		}
	}

	registry.register( 'custom_shortcode', WPBC_BFB_Field_Custom_Shortcode );

	/**
	 * Export one validated token to the Advanced Booking Form.
	 *
	 * @param {Object}   field Field data from the Builder structure.
	 * @param {Function} emit  Exporter output callback.
	 *
	 * @returns {void}
	 */
	function wpbc_bfb_export_custom_shortcode_to_form( field, emit ) {
		var shortcode = wpbc_bfb_custom_shortcode_normalize( field && field.shortcode );

		if ( shortcode ) {
			emit( shortcode );
		}
	}

	/**
	 * Register the Advanced Booking Form exporter.
	 *
	 * @returns {void}
	 */
	function wpbc_bfb_register_custom_shortcode_form_exporter() {
		var Exporter = window.WPBC_BFB_Exporter;

		if ( ! Exporter || typeof Exporter.register !== 'function' ) {
			return;
		}
		if ( typeof Exporter.has_exporter === 'function' && Exporter.has_exporter( 'custom_shortcode' ) ) {
			return;
		}

		Exporter.register( 'custom_shortcode', wpbc_bfb_export_custom_shortcode_to_form );
	}

	if ( window.WPBC_BFB_Exporter && typeof window.WPBC_BFB_Exporter.register === 'function' ) {
		wpbc_bfb_register_custom_shortcode_form_exporter();
	} else if ( document && typeof document.addEventListener === 'function' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', wpbc_bfb_register_custom_shortcode_form_exporter, { once: true } );
	}

	/**
	 * Omit a display-only shortcode from submitted Booking Data output.
	 *
	 * @returns {void}
	 */
	function wpbc_bfb_omit_custom_shortcode_from_content() {
		return;
	}

	/**
	 * Register an empty Booking Data exporter.
	 *
	 * Custom runtime hints belong to the public form only and do not represent a
	 * submitted customer value suitable for booking details or notifications.
	 *
	 * @returns {void}
	 */
	function wpbc_bfb_register_custom_shortcode_content_exporter() {
		var Exporter = window.WPBC_BFB_ContentExporter;

		if ( ! Exporter || typeof Exporter.register !== 'function' ) {
			return;
		}
		if ( typeof Exporter.has_exporter === 'function' && Exporter.has_exporter( 'custom_shortcode' ) ) {
			return;
		}

		Exporter.register( 'custom_shortcode', wpbc_bfb_omit_custom_shortcode_from_content );
	}

	if ( window.WPBC_BFB_ContentExporter && typeof window.WPBC_BFB_ContentExporter.register === 'function' ) {
		wpbc_bfb_register_custom_shortcode_content_exporter();
	} else if ( document && typeof document.addEventListener === 'function' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', wpbc_bfb_register_custom_shortcode_content_exporter, { once: true } );
	}
} )( window, document );
