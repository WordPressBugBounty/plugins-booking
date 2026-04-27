// == WPBC BFB Pack: Booking Resource Info Hint
(function ( w, d ) {
	'use strict';

	var T = 'bookingresource_info_hint';
	var P = 'Resource:';
	var L = 'Booking Resource Info';
	var B = 'WPBC_BFB_Bookingresource_Info_Boot';
	var Core = w.WPBC_BFB_Core || {};
	var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base = Core.WPBC_BFB_Field_Base;

	if ( ! Registry || typeof Registry.register !== 'function' || ! Base ) {
		w._wpbc?.dev?.error?.( 'wpbc_bfb_field_' + T, 'Core registry/base missing' );
		return;
	}

	function normalize_show( value ) {
		value = String( value || 'title' );
		return [ 'id', 'title', 'cost' ].indexOf( value ) > -1 ? value : 'title';
	}

	function shortcode_for( show ) {
		return "bookingresource show='" + normalize_show( show ) + "'";
	}

	function label_for( show ) {
		show = normalize_show( show );
		if ( 'id' === show ) {
			return 'Resource ID';
		}
		if ( 'cost' === show ) {
			return 'Resource Cost';
		}
		return 'Resource Title';
	}

	function decode_html_entities( value ) {
		var txt = d.createElement( 'textarea' );
		txt.innerHTML = String( value || '' );
		return txt.value;
	}

	function normalize_preview_values( values ) {
		values = values || {};
		return {
			id: decode_html_entities( values.id || '' ),
			title: decode_html_entities( values.title || '' ),
			cost: decode_html_entities( values.cost || '' )
		};
	}

	class BookingResourceInfoHintField extends Base {
		static template_id = 'wpbc-bfb-field-' + T;

		static get_defaults() {
			return { type: T, prefix_text: P, resource_show: 'title', html_id: '', cssclass: '', help: '' };
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
			var resource_show = normalize_show( d_normalized.resource_show );
			var tpl = this.get_template( this.template_id );
			var is_supported = String( boot.is_supported || '0' ) === '1';
			var is_cost_supported = String( boot.is_cost_supported || '0' ) === '1';

			if ( typeof tpl !== 'function' ) {
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: ' + this.template_id + '.</div>';
				return;
			}

			try {
				el.innerHTML = tpl( Object.assign( {}, d_normalized, {
					html_id: html_id,
					cssclass: cssclass,
					resource_show: resource_show,
					is_supported: is_supported,
					is_cost_supported: is_cost_supported,
					upgrade_text: String( boot.upgrade_text || '' ),
					cost_upgrade_text: String( boot.cost_upgrade_text || '' ),
					preview_values: normalize_preview_values( boot.preview_values )
				} ) );
			} catch ( er ) {
				w._wpbc?.dev?.error?.( T + '_wptpl.tpl.render', er );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering ' + L + ' preview.</div>';
				return;
			}

			el.dataset.type = T;
			el.dataset.prefix_text = d_normalized.prefix_text != null ? String( d_normalized.prefix_text ) : '';
			el.dataset.resource_show = resource_show;
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
		Registry.register( T, BookingResourceInfoHintField );
	} catch ( er ) {
		w._wpbc?.dev?.error?.( 'wpbc_bfb_field_' + T + '.register', er );
	}

	function get_selected_field() {
		return d.querySelector( '.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected' );
	}

	function sync_export_note( panel, show ) {
		var note = panel ? panel.querySelector( '.js-bookingresource-export-note' ) : null;
		if ( note ) {
			note.innerHTML = 'Exported output: ' + P + ' <strong>[' + shortcode_for( show ) + ']</strong>';
		}
	}

	function bind_inspector_events_once() {
		if ( d.__wpbc_bfb_bookingresource_info_bound ) {
			return;
		}
		d.__wpbc_bfb_bookingresource_info_bound = true;

		d.addEventListener( 'change', function ( event_obj ) {
			var radio = event_obj.target && event_obj.target.closest && event_obj.target.closest( '.js-bookingresource-show-radio' );
			if ( ! radio ) {
				return;
			}

			var panel = radio.closest( '.wpbc_bfb__inspector_bookingresource_info' );
			var hidden = panel ? panel.querySelector( '.js-bookingresource-show-value[data-inspector-key="resource_show"]' ) : null;
			var show = normalize_show( radio.value );
			var field_el = get_selected_field();

			if ( hidden ) {
				hidden.value = show;
				hidden.dispatchEvent( new Event( 'change', { bubbles: true } ) );
			}

			if ( field_el && field_el.dataset && field_el.dataset.type === T ) {
				field_el.dataset.resource_show = show;
				BookingResourceInfoHintField.render( field_el, field_el.dataset, {} );
			}

			sync_export_note( panel, show );
		}, true );

		d.addEventListener( 'wpbc_bfb_inspector_render', function () {
			var panel = d.querySelector( '#wpbc_bfb__inspector .wpbc_bfb__inspector_bookingresource_info' );
			var hidden = panel ? panel.querySelector( '.js-bookingresource-show-value[data-inspector-key="resource_show"]' ) : null;
			sync_export_note( panel, hidden ? hidden.value : 'title' );
		} );
	}

	bind_inspector_events_once();
	w.WPBC_BFB_Field_BookingResource_Info_Hint = BookingResourceInfoHintField;

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
			var resource_show = normalize_show( field && field.resource_show );
			var html_id = field && field.html_id ? sanitize_html_id( field.html_id ) : '';
			var cssclass = field && field.cssclass ? sanitize_css_classlist( field.cssclass ) : '';
			var body_html = '';
			var attrs = '';

			if ( prefix_text ) {
				body_html += esc_html( prefix_text ) + '&nbsp;';
			}
			body_html += '<strong>[' + shortcode_for( resource_show ) + ']</strong>';
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
			var resource_show = normalize_show( field && field.resource_show );
			var raw_label = ( field && typeof field.prefix_text === 'string' ) ? field.prefix_text.trim() : '';
			var label = raw_label.replace( /\s*:\s*$/, '' ) || label_for( resource_show );

			if ( typeof content_exporter.emit_line_bold_field === 'function' ) {
				content_exporter.emit_line_bold_field( emit, label, shortcode_for( resource_show ), cfg );
				return;
			}
			emit( '<b>' + label + '</b>: <f>[' + shortcode_for( resource_show ) + ']</f><br>' );
		} );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_booking_data_exporter();
	} else {
		d.addEventListener( 'wpbc:bfb:content-exporter-ready', register_booking_data_exporter, { once: true } );
	}
})( window, document );
