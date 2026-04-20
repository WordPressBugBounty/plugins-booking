// == WPBC BFB Pack: Coupon Discount Hint
(function ( w, d ) {
	'use strict';

	var T = 'coupon_discount_hint';
	var P = 'Coupon Discount:';
	var L = 'Coupon Discount';
	var B = 'WPBC_BFB_Coupon_Discount_Hint_Boot';
	var F = '$ 10.00';
	var Core = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base = Core.WPBC_BFB_Field_Base;

	if ( ! Registry || typeof Registry.register !== 'function' || ! Base ) {
		w._wpbc?.dev?.error?.( 'wpbc_bfb_field_' + T, 'Core registry/base missing' );
		return;
	}

	class CostLikeHintField extends Base {
		static template_id = 'wpbc-bfb-field-' + T;

		static get_defaults() {
			return { type: T, prefix_text: P, html_id: '', cssclass: '', help: '' };
		}

		static get_boot() {
			return w[ B ] || {};
		}

		static render( el, data, ctx ) {
			if ( ! el ) {
				return;
			}

			var d_normalized = this.normalize_data( data );
			var s = Core.WPBC_BFB_Sanitize || {};
			var boot = this.get_boot();
			var html_id = d_normalized.html_id ? ( s.sanitize_html_id ? s.sanitize_html_id( String( d_normalized.html_id ) ) : String( d_normalized.html_id ) ) : '';
			var cssclass = d_normalized.cssclass ? ( s.sanitize_css_classlist ? s.sanitize_css_classlist( String( d_normalized.cssclass ) ) : String( d_normalized.cssclass ) ) : '';
			var tpl = this.get_template( this.template_id );
			var is_supported = String( boot.is_supported || '0' ) === '1';

			if ( typeof tpl !== 'function' ) {
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: ' + this.template_id + '.</div>';
				return;
			}

			try {
				el.innerHTML = tpl( Object.assign( {}, d_normalized, {
					html_id: html_id,
					cssclass: cssclass,
					is_supported: is_supported,
					upgrade_text: String( boot.upgrade_text || '' ),
					preview_value: String( boot.preview_value || F )
				} ) );
			} catch ( er ) {
				w._wpbc?.dev?.error?.( T + '_wptpl.tpl.render', er );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering ' + L + ' preview.</div>';
				return;
			}

			el.dataset.type = T;
			el.dataset.prefix_text = d_normalized.prefix_text != null ? String( d_normalized.prefix_text ) : '';
			el.dataset.html_id = html_id;
			el.dataset.cssclass = cssclass;
			el.dataset.help = d_normalized.help != null ? String( d_normalized.help ) : '';
			el.setAttribute( 'data-label', d_normalized.prefix_text != null ? String( d_normalized.prefix_text ) : '' );
			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		static on_field_drop( data, el, ctx ) {
			super.on_field_drop?.( data, el, ctx );
		}
	}

	try {
		Registry.register( T, CostLikeHintField );
	} catch ( er ) {
		w._wpbc?.dev?.error?.( 'wpbc_bfb_field_' + T + '.register', er );
	}

	function register_booking_form_exporter() {
		var exporter = w.WPBC_BFB_Exporter;
		if ( ! exporter || typeof exporter.register !== 'function' ) {
			return;
		}
		if ( typeof exporter.has_exporter === 'function' && exporter.has_exporter( T ) ) {
			return;
		}

		var s = Core.WPBC_BFB_Sanitize || {};
		var esc_html = s.escape_html || function ( value ) {
			return String( value ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' ).replace( /'/g, '&#039;' );
		};
		var sanitize_html_id = s.sanitize_html_id || function ( value ) { return String( value || '' ); };
		var sanitize_css_classlist = s.sanitize_css_classlist || function ( value ) { return String( value || '' ); };

		exporter.register( T, function ( field, emit ) {
			var prefix_text = ( field && typeof field.prefix_text === 'string' ) ? field.prefix_text.trim() : P;
			var html_id = field && field.html_id ? sanitize_html_id( field.html_id ) : '';
			var cssclass = field && field.cssclass ? sanitize_css_classlist( field.cssclass ) : '';
			var body_html = '';
			var attrs = '';

			if ( prefix_text ) {
				body_html += esc_html( prefix_text ) + '&nbsp;';
			}
			body_html += '<strong>[' + T + ']</strong>';
			if ( html_id ) {
				attrs += ' id="' + esc_html( html_id ) + '"';
			}
			if ( cssclass ) {
				attrs += ' class="' + esc_html( cssclass ) + '"';
			}
			if ( attrs ) {
				body_html = '<span' + attrs + '>' + body_html + '</span>';
			}
			emit( body_html );
		} );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_booking_form_exporter();
	} else {
		d.addEventListener( 'wpbc:bfb:exporter-ready', register_booking_form_exporter, { once: true } );
	}

	function register_booking_data_exporter() {
		var content_exporter = w.WPBC_BFB_ContentExporter;
		if ( ! content_exporter || typeof content_exporter.register !== 'function' ) {
			return;
		}
		if ( typeof content_exporter.has_exporter === 'function' && content_exporter.has_exporter( T ) ) {
			return;
		}

		content_exporter.register( T, function ( field, emit, extras ) {
			extras = extras || {};
			var cfg = extras.cfg || {};
			var raw_label = ( field && typeof field.prefix_text === 'string' ) ? field.prefix_text.trim() : '';
			var label = raw_label.replace( /\s*:\s*$/, '' ) || L;

			if ( typeof content_exporter.emit_line_bold_field === 'function' ) {
				content_exporter.emit_line_bold_field( emit, label, T, cfg );
				return;
			}
			emit( '<b>' + label + '</b>: <f>[' + T + ']</f><br>' );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_booking_data_exporter();
	} else {
		d.addEventListener( 'wpbc:bfb:content-exporter-ready', register_booking_data_exporter, { once: true } );
	}
})( window, document );
