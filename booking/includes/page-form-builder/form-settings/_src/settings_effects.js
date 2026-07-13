/**
 * Applies effects in Canvas, after changing some settings in the right sidebar in BFB.
 *
 * @file ../includes/page-form-builder/form-settings/_src/settings_effects.js
 */
(function (w, d) {
	'use strict';

	const Effects = (w.WPBC_BFB_Settings_Effects = w.WPBC_BFB_Settings_Effects || {});
	const map     = (Effects.map = Effects.map || Object.create( null ));

	Effects.register = function (key, fn) {
		if ( key && typeof fn === 'function' ) {
			map[String( key )] = fn;
		}
	};

	function get_canvas_root() {
		return (
			d.querySelector( '#wpbc_bfb__pages_container' ) ||
			d.querySelector( '.wpbc_bfb__panel--preview' ) ||
			d.getElementById( 'wpbc_bfb__preview' ) ||
			d.body || d.documentElement
		);
	}

	Effects.apply_one = function (key, value, ctx) {
		const fn = map[String( key )];
		if ( ! fn ) {
			return;
		}
		try {
			fn( value, Object.assign( { key, value, canvas: get_canvas_root() }, ctx || {} ) );
		} catch ( e ) {
			// keep silent in production if you prefer
			console.error( 'WPBC Effects error:', key, e );
		}
	};

	Effects.apply_all = function (options, ctx) {
		if ( ! options || typeof options !== 'object' ) {
			return;
		}
		Object.keys( options ).forEach( function (k) {
			Effects.apply_one( k, options[k], Object.assign( { options: options }, ctx || {} ) );
		} );
	};

	/**
	 * Normalize settings pack to the minimum required shape:
	 * { options: {}, css_vars: {} }
	 *
	 * @param {*} pack
	 * @return {{options:Object, css_vars:Object, bfb_options?:Object}|null}
	 */
	Effects.normalize_pack = function (pack) {

		if ( pack === null || typeof pack === 'undefined' || pack === '' ) {
			return null;
		}

		// Parse JSON string if needed.
		if ( typeof pack === 'string' ) {
			try {
				pack = JSON.parse( pack );
			} catch ( _e ) {
				return null;
			}
		}

		if ( ! pack || typeof pack !== 'object' ) {
			return null;
		}

		// If user passed just {key:value} options map, wrap it.
		const has_shape =
				  Object.prototype.hasOwnProperty.call( pack, 'options' ) ||
				  Object.prototype.hasOwnProperty.call( pack, 'css_vars' ) ||
				  Object.prototype.hasOwnProperty.call( pack, 'bfb_options' );

		if ( ! has_shape ) {
			pack = { options: pack, css_vars: {} };
		}

		if ( ! pack.options || typeof pack.options !== 'object' ) {
			pack.options = {};
		}
		if ( ! pack.css_vars || typeof pack.css_vars !== 'object' ) {
			pack.css_vars = {};
		}

		// bfb_options is optional; keep if valid.
		if ( pack.bfb_options && typeof pack.bfb_options !== 'object' ) {
			delete pack.bfb_options;
		}

		return pack;
	};

	/**
	 * Re-apply settings effects after a canvas rebuild / structure load.
	 *
	 * This is needed because structure loading can replace DOM nodes that effects target.
	 *
	 * @param {*} settings_pack  string|object settings_json pack (or plain options map)
	 * @param {Object} [ctx]
	 */
	Effects.reapply_after_canvas = function (settings_pack, ctx) {

		const pack = Effects.normalize_pack( settings_pack );
		if ( ! pack ) {
			return;
		}

		// Apply immediately (best effort).
		Effects.apply_all( pack.options, Object.assign( { source: 'reapply_after_canvas' }, ctx || {} ) );
		wpbc_bfb_global_form_style__apply( null, Object.assign( { source: 'reapply_after_canvas' }, ctx || {} ) );

		// Some modules/hydration may run shortly after; do one more pass.
		setTimeout( function () {
			Effects.apply_all( pack.options, Object.assign( { source: 'reapply_after_canvas_delayed' }, ctx || {} ) );
			wpbc_bfb_global_form_style__apply( null, Object.assign( { source: 'reapply_after_canvas_delayed' }, ctx || {} ) );
		}, 60 );
	};

	// 1) Apply from AJAX load.
	d.addEventListener( 'wpbc:bfb:form_settings:apply', function (e) {
		const pack = e && e.detail ? e.detail.settings : null;
		if ( pack && pack.options ) {
			Effects.apply_all( pack.options, { source: 'apply' } );
		}
		wpbc_bfb_global_form_style__apply( null, { source: 'apply-global-style' } );
	} );

	// 2) Apply live from UI change (delegated).
	function css_escape(value) {
		const v = String( value == null ? '' : value );
		if ( w.CSS && typeof w.CSS.escape === 'function' ) {
			return w.CSS.escape( v );
		}
		return v.replace( /[^a-zA-Z0-9_\-]/g, '\\$&' );
	}

	function find_fs_root(el) {
		if ( ! el || ! el.closest ) {
			return null;
		}

		// 1) Direct: element or ancestor carries FS key (input/select/textarea writer, radio wrapper, etc.)
		const direct = el.closest( '[data-wpbc-bfb-fs-key]' );
		if ( direct ) {
			return direct;
		}

		// 2) Length: event came from number/unit/range inside .wpbc_slider_len_group
		const len_group = el.closest( '.wpbc_slider_len_group' );
		if ( len_group ) {
			return (
				len_group.querySelector( 'input[data-wpbc_slider_len_writer][data-wpbc-bfb-fs-key]' ) ||
				len_group.querySelector( 'input[data-wpbc-bfb-fs-type="length"][data-wpbc-bfb-fs-key]' ) ||
				null
			);
		}

		// 3) Spacing: event came from vertical/horizontal number inside .wpbc_spacing_group.
		const spacing_group = el.closest( '.wpbc_spacing_group' );
		if ( spacing_group ) {
			return (
				spacing_group.querySelector( 'input[data-wpbc_spacing_writer][data-wpbc-bfb-fs-key]' ) ||
				spacing_group.querySelector( 'input[data-wpbc-bfb-fs-type="spacing"][data-wpbc-bfb-fs-key]' ) ||
				null
			);
		}

		// 4) Range: event came from range input inside .wpbc_slider_range_group
		const range_group = el.closest( '.wpbc_slider_range_group' );
		if ( range_group ) {
			return (
				range_group.querySelector( 'input[data-wpbc_slider_range_writer][data-wpbc-bfb-fs-key]' ) ||
				range_group.querySelector( 'input[data-wpbc_slider_range_writer]' ) ||
				null
			);
		}

		return null;
	}

	function read_value_from_fs_root(fs_root, original_target) {
		if ( ! fs_root ) {
			return '';
		}

		const fs_type = String( fs_root.getAttribute( 'data-wpbc-bfb-fs-type' ) || '' );

		// RADIO: read checked within wrapper.
		if ( fs_type === 'radio' ) {
			const control_id = fs_root.getAttribute( 'data-wpbc-bfb-fs-controlid' ) || '';
			const selector   = control_id
				? 'input[type="radio"][name="' + css_escape( control_id ) + '"]:checked'
				: 'input[type="radio"]:checked';

			const checked = fs_root.querySelector( selector );
			return checked ? String( checked.value || '' ) : '';
		}

		if ( fs_type === 'spacing' ) {
			const group = ( original_target && original_target.closest ) ? original_target.closest( '.wpbc_spacing_group' ) : fs_root.closest( '.wpbc_spacing_group' );
			const vertical_input = group ? group.querySelector( 'input[data-wpbc_spacing_vertical]' ) : null;
			const horizontal_input = group ? group.querySelector( 'input[data-wpbc_spacing_horizontal]' ) : null;
			const writer = group ? group.querySelector( 'input[data-wpbc_spacing_writer]' ) : null;
			const vertical = vertical_input ? String( vertical_input.value || '0' ) : '0';
			const horizontal = horizontal_input ? String( horizontal_input.value || vertical ) : vertical;
			const combined = wpbc_bfb_form_appearance__normalize_spacing_numbers( vertical, horizontal );

			if ( writer ) {
				writer.value = combined;
			}

			return combined;
		}

		// CHECKBOX / TOGGLE
		if ( (original_target && original_target.type === 'checkbox') || fs_root.type === 'checkbox' ) {
			const cb = (original_target && original_target.type === 'checkbox') ? original_target : fs_root;
			return cb.checked ? 'On' : 'Off';
		}

		// DEFAULT: writer/input/textarea/select
		if ( fs_root.value != null ) {
			return String( fs_root.value );
		}
		if ( original_target && original_target.value != null ) {
			return String( original_target.value );
		}

		return '';
	}

	function apply_change_from_target(target, event_type, event_source) {
		if ( ! target ) { return; }

		const fs_root = find_fs_root( target );
		if ( ! fs_root ) { return; }


		// Normalize events so each control produces exactly one effect call.
		// - toggle/select/radio/checkbox => "change" only.
		// - everything else              => "input" only.
		const fs_type = String( fs_root.getAttribute( 'data-wpbc-bfb-fs-type' ) || '' );
		const tag     = String( target.tagName || '' ).toLowerCase();
		const type    = String( target.type || '' ).toLowerCase();

		const use_change = (fs_type === 'toggle') || (fs_type === 'select') || (fs_type === 'radio') || (type === 'checkbox') || (type === 'radio') || (tag === 'select');

		if ( use_change && event_type !== 'change' ) { return; }
		if ( ! use_change && event_type !== 'input' ) { return; }
		// -------------------------------------------------------------------------------------------

		const key = fs_root.getAttribute( 'data-wpbc-bfb-fs-key' );
		if ( ! key ) { return; }

		const scope = fs_root.getAttribute( 'data-wpbc-bfb-fs-scope' ) || '';
		const value = read_value_from_fs_root( fs_root, target );

		Effects.apply_one( key, value, { source: event_source || 'ui', scope: scope, control: target, fs_root: fs_root } );
	}

	function is_coloris_control(target) {
		if ( ! target || ! target.matches ) {
			return false;
		}

		return target.matches( '[data-wpbc-bfb-fs-type="color"], [data-inspector-type="color"], .wpbc_bfb_coloris' );
	}

	function on_change(ev) {
		// Ignore generic synthetic events dispatched by code (apply/reapply, slider sync, etc.).
		// Coloris dispatches synthetic input events while the user picks a color, so allow those color controls through.
		if ( ev && ev.isTrusted === false && ! is_coloris_control( ev.target ) ) { return; }
		apply_change_from_target( ev && ev.target, ev && ev.type, ( ev && ev.isTrusted === false ) ? 'coloris' : 'ui' );
	}

	d.addEventListener( 'input', on_change, false );
	d.addEventListener( 'change', on_change, false );
	function on_coloris_pick(ev) {
		const detail = ev && ev.detail ? ev.detail : {};
		const target = detail.currentEl || detail.el || detail.input || ev.target || null;

		if ( ! is_coloris_control( target ) ) {
			return;
		}

		if ( detail.color && target.value !== detail.color ) {
			target.value = detail.color;
		}

		apply_change_from_target( target, 'input', 'coloris' );
	}
	d.addEventListener( 'coloris:pick', on_coloris_pick, false );
	d.addEventListener( 'wpbc:bfb:coloris:change', on_coloris_pick, false );

})( window, document );

function wpbc_bfb_form_appearance__get_presets() {
	return {
		bordered: {
			background : '#ffffff',
			borderColor: '#cccccc',
			borderWidth: '1px',
			radius     : '2px',
			padding    : '10px 30px',
			shadow     : 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px'
		},
		none    : {
			background : 'transparent',
			borderColor: 'transparent',
			borderWidth: '0px',
			radius     : '0px',
			padding    : '0px',
			shadow     : 'none'
		},
		soft    : {
			background : '#f9f9fa',
			borderColor: '#fff',
			borderWidth: '3px',
			radius     : '8px',
			padding    : '20px',
			shadow     : 'rgba(15, 23, 42, 0.06) 0px 4px 16px 0px'
		}
	};
}

function wpbc_bfb_form_appearance__is_dark_theme(options) {
	options = options && typeof options === 'object' ? options : {};
	return 'wpbc_theme_dark_1' === String( options.booking_form_theme || '' );
}

function wpbc_bfb_form_appearance__get_preset_for_options(style, options) {
	const presets = wpbc_bfb_form_appearance__get_presets();

	if ( ! wpbc_bfb_form_appearance__is_dark_theme( options ) ) {
		return presets[style] || presets.bordered;
	}

	if ( 'soft' === style ) {
		return {
			background : '#1f2937',
			borderColor: '#334155',
			borderWidth: '3px',
			radius     : '8px',
			padding    : '20px',
			shadow     : 'rgba(0, 0, 0, 0.24) 0px 4px 16px 0px'
		};
	}

	return presets[style] || presets.bordered;
}

function wpbc_bfb_form_appearance__sanitize_color(value, fallback) {
	const v = String( value == null ? '' : value ).trim();
	if ( /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test( v ) ) {
		return v;
	}
	if ( v === 'transparent' ) {
		return v;
	}
	return fallback;
}

function wpbc_bfb_form_appearance__sanitize_optional_color(value) {
	return wpbc_bfb_form_appearance__sanitize_color( value, '' );
}

function wpbc_bfb_form_appearance__sanitize_length(value, fallback) {
	const v = String( value == null ? '' : value ).trim();
	if ( /^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test( v ) ) {
		return v;
	}
	return fallback;
}

function wpbc_bfb_form_appearance__sanitize_spacing(value, fallback) {
	const v = String( value == null ? '' : value ).trim().replace( /\s+/g, ' ' );
	const parts = v ? v.split( ' ' ) : [];
	if ( parts.length < 1 || parts.length > 4 ) {
		return fallback;
	}
	for ( let i = 0; i < parts.length; i++ ) {
		if ( ! /^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test( parts[i] ) ) {
			return fallback;
		}
	}
	return parts.join( ' ' );
}

function wpbc_bfb_form_appearance__normalize_spacing_numbers(vertical, horizontal) {
	const v = String( vertical == null ? '' : vertical ).trim();
	const h = String( horizontal == null ? '' : horizontal ).trim();
	const vertical_num = /^-?\d+(?:\.\d+)?$/.test( v ) ? v : '0';
	const horizontal_num = /^-?\d+(?:\.\d+)?$/.test( h ) ? h : vertical_num;

	return vertical_num + 'px ' + horizontal_num + 'px';
}

function wpbc_bfb_form_appearance__collect_options(ctx, key, value) {
	let options = (ctx && ctx.options && typeof ctx.options === 'object') ? Object.assign( {}, ctx.options ) : {};

	if ( window.WPBC_BFB_FormSettings && typeof window.WPBC_BFB_FormSettings.collect === 'function' ) {
		options = Object.assign( window.WPBC_BFB_FormSettings.collect( 'form' ) || {}, options );
	}

	if ( key ) {
		options[String( key )] = value;
	}

	if ( wpbc_bfb_form_appearance__is_custom_control_key( key ) ) {
		options.booking_form_container_style = 'custom';
		wpbc_bfb_form_appearance__set_container_style_control( 'custom' );
	}

	return options;
}

function wpbc_bfb_form_appearance__get_custom_control_keys() {
	return [
		'booking_form_background_color',
		'booking_form_border_color',
		'booking_form_border_width',
		'booking_form_border_radius',
		'booking_form_padding',
		'booking_form_text_color',
		'booking_form_field_background_color',
		'booking_form_field_text_color',
		'booking_form_field_border_color'
	];
}

function wpbc_bfb_form_appearance__is_custom_control_key(key) {
	return wpbc_bfb_form_appearance__get_custom_control_keys().indexOf( String( key || '' ) ) !== -1;
}

function wpbc_bfb_form_appearance__set_container_style_control(value) {
	const control = document.querySelector( '[data-wpbc-bfb-fs-key="booking_form_container_style"]' );
	if ( ! control || control.value === value ) {
		return;
	}

	control.value = value;
}

function wpbc_bfb_form_appearance__set_radio_control(key, value) {
	const row = document.querySelector( '.wpbc_bfb__form_setting[data-key="' + key + '"]' );
	if ( ! row ) {
		return;
	}

	const wrap = row.querySelector( '.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]' );
	const control_id = wrap ? String( wrap.getAttribute( 'data-wpbc-bfb-fs-controlid' ) || '' ) : '';
	const radios = control_id
		? row.querySelectorAll( 'input[type="radio"][name="' + control_id + '"]' )
		: row.querySelectorAll( 'input[type="radio"]' );

	radios.forEach( function (radio) {
		const should_check = ( String( radio.value ) === String( value == null ? '' : value ) );
		radio.checked = should_check;

		const choice = radio.closest ? radio.closest( '.wpbc_theme_choice' ) : null;
		if ( choice ) {
			choice.classList.toggle( 'is-selected', should_check );
		}
	} );
}

function wpbc_bfb_form_appearance__set_select_control(key, value) {
	const control = document.querySelector( '[data-wpbc-bfb-fs-key="' + key + '"]' );
	if ( control ) {
		control.value = String( value == null ? '' : value );
	}
}

function wpbc_bfb_form_appearance__get_current_options() {
	return window.WPBC_BFB_FormSettings && typeof window.WPBC_BFB_FormSettings.collect === 'function'
		? window.WPBC_BFB_FormSettings.collect( 'form' ) || {}
		: {};
}

function wpbc_bfb_form_appearance__get_style_value_from_options(options) {
	options = options && typeof options === 'object' ? options : {};

	const theme = String( options.booking_form_theme || '' );
	const style = String( options.booking_form_container_style || 'inherit' );

	if ( 'custom' === style ) {
		return 'custom';
	}
	if ( 'inherit' === style || '' === style ) {
		return 'inherit';
	}

	const prefix = ( 'wpbc_theme_dark_1' === theme ) ? 'dark' : 'light';
	if ( [ 'bordered', 'none', 'soft' ].indexOf( style ) === -1 ) {
		return prefix + '_bordered';
	}

	return prefix + '_' + style;
}

function wpbc_bfb_form_appearance__sync_form_style_control(options) {
	wpbc_bfb_form_appearance__set_radio_control( 'booking_form_style', wpbc_bfb_form_appearance__get_style_value_from_options( options ) );
}

function wpbc_bfb_form_appearance__resolve_form_style_choice(value) {
	const current_options = wpbc_bfb_form_appearance__get_current_options();
	const current_theme = String( current_options.booking_form_theme || '' );
	const choice = String( value || 'inherit' );

	if ( 'custom' === choice ) {
		return {
			booking_form_theme          : current_theme,
			booking_form_container_style: 'custom'
		};
	}
	if ( 'inherit' === choice || '' === choice ) {
		return {
			booking_form_theme          : '',
			booking_form_container_style: 'inherit'
		};
	}

	const parts = choice.split( '_' );
	const theme = ( 'dark' === parts[0] ) ? 'wpbc_theme_dark_1' : '';
	const style = parts[1] || 'bordered';

	return {
		booking_form_theme          : theme,
		booking_form_container_style: ( [ 'bordered', 'none', 'soft' ].indexOf( style ) === -1 ) ? 'bordered' : style
	};
}

function wpbc_bfb_form_appearance__is_user_theme_switch(ctx) {
	const source = String( ctx && ctx.source ? ctx.source : '' );
	return [ 'ui', 'coloris' ].indexOf( source ) !== -1;
}

function wpbc_bfb_form_appearance__is_custom_style(options) {
	return String( options && options.booking_form_container_style ? options.booking_form_container_style : 'inherit' ) === 'custom';
}

function wpbc_bfb_form_appearance__sync_custom_controls(options) {
	const is_custom = wpbc_bfb_form_appearance__is_custom_style( options );
	const reset_row = document.querySelector( '[data-wpbc-bfb-custom-appearance-reset-row]' );
	const base_theme_row = document.querySelector( '.wpbc_bfb__form_setting[data-key="booking_form_theme"]' );

	wpbc_bfb_form_appearance__get_custom_control_keys().forEach( function (key) {
		const row = document.querySelector( '.wpbc_bfb__form_setting[data-key="' + key + '"]' );
		if ( ! row ) {
			return;
		}
		row.hidden = ! is_custom;
		row.setAttribute( 'aria-hidden', is_custom ? 'false' : 'true' );
		row.classList.toggle( 'is-hidden', ! is_custom );
	} );

	if ( reset_row ) {
		reset_row.hidden = ! is_custom;
		reset_row.setAttribute( 'aria-hidden', is_custom ? 'false' : 'true' );
		reset_row.classList.toggle( 'is-hidden', ! is_custom );
	}

	if ( base_theme_row ) {
		base_theme_row.hidden = ! is_custom;
		base_theme_row.setAttribute( 'aria-hidden', is_custom ? 'false' : 'true' );
		base_theme_row.classList.toggle( 'is-hidden', ! is_custom );
	}
}

function wpbc_bfb_form_appearance__resolve(options) {
	let style     = String( options.booking_form_container_style || 'inherit' );

	if ( style === 'inherit' ) {
		const global_options = window.wpbc_bfb_settings_vars && window.wpbc_bfb_settings_vars.global_appearance
			? window.wpbc_bfb_settings_vars.global_appearance
			: {};
		options = Object.assign( {}, global_options || {} );
		style = String( options.booking_form_container_style || 'bordered' );
	}

	if ( style === 'bordered' ) {
		return null;
	}

	if ( style !== 'custom' ) {
		return wpbc_bfb_form_appearance__get_preset_for_options( style, options );
	}

	return {
		background : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_background_color, '#ffffff' ),
		borderColor: wpbc_bfb_form_appearance__sanitize_color( options.booking_form_border_color, '#cccccc' ),
		borderWidth: wpbc_bfb_form_appearance__sanitize_length( options.booking_form_border_width, '1px' ),
		radius     : wpbc_bfb_form_appearance__sanitize_length( options.booking_form_border_radius, '2px' ),
		padding    : wpbc_bfb_form_appearance__sanitize_spacing( options.booking_form_padding, '10px 30px' ),
		shadow     : 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px'
	};
}

function wpbc_bfb_form_appearance__resolve_design_colors(options) {
	options = options && typeof options === 'object' ? options : {};

	if ( ! wpbc_bfb_form_appearance__is_custom_style( options ) ) {
		if (
			wpbc_bfb_form_appearance__is_dark_theme( options ) &&
			'none' === String( options.booking_form_container_style || '' )
		) {
			return {
				textColor      : '#1d2327',
				fieldBackground: '',
				fieldText      : '',
				fieldBorder    : ''
			};
		}
		return {
			textColor      : '',
			fieldBackground: '',
			fieldText      : '',
			fieldBorder    : ''
		};
	}

	return {
		textColor      : wpbc_bfb_form_appearance__sanitize_optional_color( options.booking_form_text_color ),
		fieldBackground: wpbc_bfb_form_appearance__sanitize_optional_color( options.booking_form_field_background_color ),
		fieldText      : wpbc_bfb_form_appearance__sanitize_optional_color( options.booking_form_field_text_color ),
		fieldBorder    : wpbc_bfb_form_appearance__sanitize_optional_color( options.booking_form_field_border_color )
	};
}

function wpbc_bfb_form_appearance__apply_vars(value, ctx) {
	const options = wpbc_bfb_form_appearance__collect_options( ctx, ctx && ctx.key, value );
	const resolved = wpbc_bfb_form_appearance__resolve( options );
	const design = wpbc_bfb_form_appearance__resolve_design_colors( options );
	const is_custom = wpbc_bfb_form_appearance__is_custom_style( options );
	const root = ctx && ctx.canvas;

	wpbc_bfb_form_appearance__sync_form_style_control( options );
	wpbc_bfb_form_appearance__sync_custom_controls( options );

	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	const wraps = root.querySelectorAll( '.wpbc_bfb__form_preview_section_container, .wpbc_bfb_form' );
	if ( ! wraps.length ) {
		return;
	}

	wraps.forEach( function (wrap) {
		if ( ! wrap || ! wrap.style ) {
			return;
		}
		wrap.classList.toggle( 'wpbc_bfb_form_appearance_custom', is_custom );
		if ( ! resolved ) {
			wrap.style.removeProperty( '--wpbc-bfb-form-background' );
			wrap.style.removeProperty( '--wpbc-bfb-form-border-color' );
			wrap.style.removeProperty( '--wpbc-bfb-form-border-width' );
			wrap.style.removeProperty( '--wpbc-bfb-form-border-radius' );
			wrap.style.removeProperty( '--wpbc-bfb-form-padding' );
			wrap.style.removeProperty( '--wpbc-bfb-form-box-shadow' );
		} else {
			wrap.style.setProperty( '--wpbc-bfb-form-background', resolved.background );
			wrap.style.setProperty( '--wpbc-bfb-form-border-color', resolved.borderColor );
			wrap.style.setProperty( '--wpbc-bfb-form-border-width', resolved.borderWidth );
			wrap.style.setProperty( '--wpbc-bfb-form-border-radius', resolved.radius );
			wrap.style.setProperty( '--wpbc-bfb-form-padding', resolved.padding );
			wrap.style.setProperty( '--wpbc-bfb-form-box-shadow', resolved.shadow );
		}

		if ( design.textColor ) {
			wrap.style.setProperty( '--wpbc_form-label-color', design.textColor );
			wrap.style.setProperty( '--wpbc_form-label-sublabel-color', design.textColor );
		} else {
			wrap.style.removeProperty( '--wpbc_form-label-color' );
			wrap.style.removeProperty( '--wpbc_form-label-sublabel-color' );
		}

		if ( design.fieldBackground ) {
			wrap.style.setProperty( '--wpbc_form-field-background-color', design.fieldBackground );
			wrap.style.setProperty( '--wpbc_form-field-menu-color', design.fieldBackground );
		} else {
			wrap.style.removeProperty( '--wpbc_form-field-background-color' );
			wrap.style.removeProperty( '--wpbc_form-field-menu-color' );
		}

		if ( design.fieldText ) {
			wrap.style.setProperty( '--wpbc_form-field-text-color', design.fieldText );
		} else {
			wrap.style.removeProperty( '--wpbc_form-field-text-color' );
		}

		if ( design.fieldBorder ) {
			wrap.style.setProperty( '--wpbc_form-field-border-color', design.fieldBorder );
			wrap.style.setProperty( '--wpbc_form-field-border-color-spare', design.fieldBorder );
		} else {
			wrap.style.removeProperty( '--wpbc_form-field-border-color' );
			wrap.style.removeProperty( '--wpbc_form-field-border-color-spare' );
		}
	} );
}

function wpbc_bfb_global_form_style__get_vars() {
	return window.wpbc_bfb_settings_vars || {};
}

function wpbc_bfb_global_form_style__get_presets() {
	const vars = wpbc_bfb_global_form_style__get_vars();
	return vars.form_style_presets && typeof vars.form_style_presets === 'object' ? vars.form_style_presets : {};
}

function wpbc_bfb_global_form_style__get_custom_keys() {
	return [
		'booking_form_custom_background_color',
		'booking_form_custom_border_color',
		'booking_form_custom_border_width',
		'booking_form_custom_border_radius',
		'booking_form_custom_padding_vertical',
		'booking_form_custom_padding_horizontal',
		'booking_form_custom_text_color',
		'booking_form_custom_field_background_color',
		'booking_form_custom_field_text_color',
		'booking_form_custom_field_border_color',
		'booking_form_custom_button_background_color',
		'booking_form_custom_button_text_color',
		'booking_form_custom_button_border_color',
		'booking_form_custom_button_hover_background_color',
		'booking_form_custom_button_hover_text_color',
		'booking_form_custom_button_hover_border_color',
		'booking_form_custom_secondary_button_background_color',
		'booking_form_custom_secondary_button_text_color',
		'booking_form_custom_secondary_button_border_color',
		'booking_form_custom_secondary_button_hover_background_color',
		'booking_form_custom_secondary_button_hover_text_color',
		'booking_form_custom_secondary_button_hover_border_color'
	];
}

function wpbc_bfb_global_form_style__get_custom_defaults() {
	const vars = wpbc_bfb_global_form_style__get_vars();
	const localized = vars.custom_form_style_defaults && typeof vars.custom_form_style_defaults === 'object'
		? vars.custom_form_style_defaults
		: {};

	return Object.assign( {
		booking_form_custom_background_color       : '#ffffff',
		booking_form_custom_border_color           : '#cccccc',
		booking_form_custom_border_width           : '1px',
		booking_form_custom_border_radius          : '2px',
		booking_form_custom_padding_vertical       : '10px',
		booking_form_custom_padding_horizontal     : '30px',
		booking_form_custom_text_color             : '#1d2327',
		booking_form_custom_field_background_color : '#ffffff',
		booking_form_custom_field_text_color       : '#3c434a',
		booking_form_custom_field_border_color     : '#cccccc',
		booking_form_custom_button_background_color: '#066aab',
		booking_form_custom_button_text_color      : '#ffffff',
		booking_form_custom_button_border_color    : '#066aab',
		booking_form_custom_button_hover_background_color: '#055589',
		booking_form_custom_button_hover_text_color: '#ffffff',
		booking_form_custom_button_hover_border_color: '#055589',
		booking_form_custom_secondary_button_background_color: '#fdfdfd',
		booking_form_custom_secondary_button_text_color: '#444444',
		booking_form_custom_secondary_button_border_color: '#eeeeee',
		booking_form_custom_secondary_button_hover_background_color: '#fdfdfd',
		booking_form_custom_secondary_button_hover_text_color: '#444444',
		booking_form_custom_secondary_button_hover_border_color: '#4d91cd'
	}, localized );
}

function wpbc_bfb_global_form_style__get_current_options(ctx, key, value) {
	const vars = wpbc_bfb_global_form_style__get_vars();
	let options = vars.global_form_style && typeof vars.global_form_style === 'object'
		? Object.assign( {}, vars.global_form_style )
		: {};

	if ( window.WPBC_BFB_FormSettings && typeof window.WPBC_BFB_FormSettings.collect === 'function' ) {
		options = Object.assign( options, window.WPBC_BFB_FormSettings.collect( 'global' ) || {} );
	}

	if ( ctx && ctx.options && typeof ctx.options === 'object' ) {
		options = Object.assign( options, ctx.options );
	}
	if ( key ) {
		options[String( key )] = value;
	}
	if ( ! options.booking_form_style ) {
		options.booking_form_style = 'light_bordered';
	}

	return options;
}

function wpbc_bfb_global_form_style__resolve_css_vars(options) {
	options = options && typeof options === 'object' ? options : {};
	const style = String( options.booking_form_style || 'light_bordered' );
	const presets = wpbc_bfb_global_form_style__get_presets();
	const preset = presets[style] || presets.light_bordered || {};
	const defaults = wpbc_bfb_global_form_style__get_custom_defaults();

	if ( 'custom' !== style ) {
		return preset.css_vars && typeof preset.css_vars === 'object' ? Object.assign( {}, preset.css_vars ) : {};
	}

	return {
		'--wpbc-bfb-form-background'          : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_background_color, defaults.booking_form_custom_background_color ),
		'--wpbc-bfb-form-border-color'        : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_border_color, defaults.booking_form_custom_border_color ),
		'--wpbc-bfb-form-border-width'        : wpbc_bfb_form_appearance__sanitize_length( options.booking_form_custom_border_width, defaults.booking_form_custom_border_width ),
		'--wpbc-bfb-form-border-radius'       : wpbc_bfb_form_appearance__sanitize_length( options.booking_form_custom_border_radius, defaults.booking_form_custom_border_radius ),
		'--wpbc-bfb-form-padding'             : wpbc_bfb_form_appearance__sanitize_length( options.booking_form_custom_padding_vertical, defaults.booking_form_custom_padding_vertical ) + ' ' + wpbc_bfb_form_appearance__sanitize_length( options.booking_form_custom_padding_horizontal, defaults.booking_form_custom_padding_horizontal ),
		'--wpbc-bfb-form-box-shadow'          : 'rgba(0, 0, 0, 0.05) 0px 2px 6px 0px',
		'--wpbc_form-label-color'             : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_text_color, defaults.booking_form_custom_text_color ),
		'--wpbc_form-label-sublabel-color'    : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_text_color, defaults.booking_form_custom_text_color ),
		'--wpbc_form-label-error-color'       : '#d63637',
		'--wpbc_form-field-background-color'  : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color ),
		'--wpbc_form-field-menu-color'        : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_field_background_color, defaults.booking_form_custom_field_background_color ),
		'--wpbc_form-field-text-color'        : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_field_text_color, defaults.booking_form_custom_field_text_color ),
		'--wpbc_form-field-border-color'      : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color ),
		'--wpbc_form-field-border-color-spare': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_field_border_color, defaults.booking_form_custom_field_border_color ),
		'--wpbc_form-field-focus-border-color': '#066aab',
		'--wpbc_form-field-focus-shadow-color': '#066aab',
		'--wpbc_form-field-disabled-color'    : 'rgba(0, 0, 0, 0.2)',
		'--wpbc_form-button-background-color' : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color ),
		'--wpbc_form-button-background-color-alt': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_background_color, defaults.booking_form_custom_button_background_color ),
		'--wpbc_form-button-border-color'     : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_border_color, defaults.booking_form_custom_button_border_color ),
		'--wpbc_form-button-text-color'       : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color ),
		'--wpbc_form-button-text-color-alt'   : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_text_color, defaults.booking_form_custom_button_text_color ),
		'--wpbc_form-button-hover-background-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_hover_background_color, defaults.booking_form_custom_button_hover_background_color ),
		'--wpbc_form-button-hover-border-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color ),
		'--wpbc_form-button-hover-text-color' : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_hover_text_color, defaults.booking_form_custom_button_hover_text_color ),
		'--wpbc_form-choice-checked-border-color': '#066aab',
		'--wpbc_form-choice-checked-color'    : '#066aab',
		'--wpbc_form-choice-focus-color'      : '#066aab',
		'--wpbc_form-button-light-background-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_secondary_button_background_color, defaults.booking_form_custom_secondary_button_background_color ),
		'--wpbc_form-button-light-border-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_secondary_button_border_color, defaults.booking_form_custom_secondary_button_border_color ),
		'--wpbc_form-button-light-text-color' : wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_secondary_button_text_color, defaults.booking_form_custom_secondary_button_text_color ),
		'--wpbc_form-button-light-box-shadow' : '0 2px 10px 2px #ffffff54',
		'--wpbc_form-button-light-hover-background-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_secondary_button_hover_background_color, defaults.booking_form_custom_secondary_button_hover_background_color ),
		'--wpbc_form-button-light-hover-border-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_secondary_button_hover_border_color, defaults.booking_form_custom_secondary_button_hover_border_color ),
		'--wpbc_form-button-light-hover-text-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_secondary_button_hover_text_color, defaults.booking_form_custom_secondary_button_hover_text_color ),
		'--wpbc_form-button-light-hover-box-shadow': '0 2px 10px 2px #ffffff54',
		'--wpbc_form-button-primary-hover-border-color': wpbc_bfb_form_appearance__sanitize_color( options.booking_form_custom_button_hover_border_color, defaults.booking_form_custom_button_hover_border_color ),
		'--wpbc_form-page-break-color'        : '#066aab'
	};
}

function wpbc_bfb_global_form_style__get_css_var_keys(options) {
	const vars = wpbc_bfb_global_form_style__get_vars();
	const localized = Array.isArray( vars.form_style_css_var_names ) ? vars.form_style_css_var_names : [];
	const keys = [];
	const presets = wpbc_bfb_global_form_style__get_presets();

	if ( localized.length ) {
		return localized;
	}

	Object.keys( presets ).forEach( function (preset_key) {
		const preset = presets[preset_key] || {};
		const css_vars = preset.css_vars && typeof preset.css_vars === 'object' ? preset.css_vars : {};

		Object.keys( css_vars ).forEach( function (var_name) {
			if ( keys.indexOf( var_name ) === -1 ) {
				keys.push( var_name );
			}
		} );
	} );

	Object.keys( wpbc_bfb_global_form_style__resolve_css_vars( Object.assign( {}, options || {}, { booking_form_style: 'custom' } ) ) ).forEach( function (var_name) {
		if ( keys.indexOf( var_name ) === -1 ) {
			keys.push( var_name );
		}
	} );

	return keys;
}

function wpbc_bfb_global_form_style__sync_controls(options) {
	const is_custom = 'custom' === String( options && options.booking_form_style ? options.booking_form_style : '' );
	const reset_row = document.querySelector( '[data-wpbc-bfb-custom-appearance-reset-row]' );

	wpbc_bfb_form_appearance__set_radio_control( 'booking_form_style', options.booking_form_style || 'light_bordered' );

	document.querySelectorAll( '.wpbc_bfb__form_setting_global_custom_style' ).forEach( function (row) {
		row.hidden = ! is_custom;
		row.setAttribute( 'aria-hidden', is_custom ? 'false' : 'true' );
		row.classList.toggle( 'is-hidden', ! is_custom );
	} );

	if ( reset_row ) {
		reset_row.hidden = ! is_custom;
		reset_row.setAttribute( 'aria-hidden', is_custom ? 'false' : 'true' );
		reset_row.classList.toggle( 'is-hidden', ! is_custom );
	}
}

function wpbc_bfb_global_form_style__apply(value, ctx) {
	const options = wpbc_bfb_global_form_style__get_current_options( ctx, ctx && ctx.key, value );
	const style = String( options.booking_form_style || 'light_bordered' );
	const presets = wpbc_bfb_global_form_style__get_presets();
	const preset = presets[style] || presets.light_bordered || {};
	const css_vars = wpbc_bfb_global_form_style__resolve_css_vars( options );
	const root = ( ctx && ctx.canvas ) || document.getElementById( 'wpbc_bfb__theme_scope' ) || document;
	const theme_classes = [];
	const css_var_keys = wpbc_bfb_global_form_style__get_css_var_keys( options );

	wpbc_bfb_global_form_style__sync_controls( options );

	Object.keys( presets ).forEach( function (preset_key) {
		const class_name = presets[preset_key] && presets[preset_key].theme_class ? String( presets[preset_key].theme_class ) : '';
		if ( class_name && theme_classes.indexOf( class_name ) === -1 ) {
			theme_classes.push( class_name );
		}
	} );

	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	const selector = '.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__pages_panel, .wpbc_bfb__form_preview_section_container';
	const wraps = [];
	if ( root.matches && root.matches( selector ) ) {
		wraps.push( root );
	}
	root.querySelectorAll( selector ).forEach( function (wrap) {
		wraps.push( wrap );
	} );

	wraps.forEach( function (wrap) {
		if ( ! wrap || ! wrap.style ) {
			return;
		}
		theme_classes.forEach( function (class_name) {
			wrap.classList.remove( class_name );
		} );
		if ( preset.theme_class ) {
			wrap.classList.add( String( preset.theme_class ) );
		}
		wrap.classList.toggle( 'wpbc_bfb_form_appearance_custom', 'custom' === style );

		css_var_keys.forEach( function (css_key) {
			wrap.style.removeProperty( css_key );
		} );
		Object.keys( css_vars ).forEach( function (css_key) {
			wrap.style.setProperty( css_key, css_vars[css_key] );
		} );
	} );
}

[
	'booking_form_style',
	'booking_form_custom_background_color',
	'booking_form_custom_border_color',
	'booking_form_custom_border_width',
	'booking_form_custom_border_radius',
	'booking_form_custom_padding_vertical',
	'booking_form_custom_padding_horizontal',
	'booking_form_custom_text_color',
	'booking_form_custom_field_background_color',
	'booking_form_custom_field_text_color',
	'booking_form_custom_field_border_color',
	'booking_form_custom_button_background_color',
	'booking_form_custom_button_text_color',
	'booking_form_custom_button_border_color',
	'booking_form_custom_button_hover_background_color',
	'booking_form_custom_button_hover_text_color',
	'booking_form_custom_button_hover_border_color',
	'booking_form_custom_secondary_button_background_color',
	'booking_form_custom_secondary_button_text_color',
	'booking_form_custom_secondary_button_border_color',
	'booking_form_custom_secondary_button_hover_background_color',
	'booking_form_custom_secondary_button_hover_text_color',
	'booking_form_custom_secondary_button_hover_border_color'
].forEach( function (key) {
	WPBC_BFB_Settings_Effects.register( key, function (value, ctx) {
		wpbc_bfb_global_form_style__apply( value, Object.assign( {}, ctx || {}, { key: key } ) );
	} );
} );

function wpbc_bfb_form_appearance__sync_custom_controls_from_ui() {
	const options = wpbc_bfb_global_form_style__get_current_options();
	wpbc_bfb_global_form_style__sync_controls( options );
	wpbc_bfb_global_form_style__apply( null, { source: 'sync-global-style' } );
}

wpbc_bfb_form_appearance__sync_custom_controls_from_ui();
document.addEventListener( 'DOMContentLoaded', wpbc_bfb_form_appearance__sync_custom_controls_from_ui );


// BOOKING_FORM_THEME.
WPBC_BFB_Settings_Effects.register( 'booking_form_theme', function (value, ctx) {
	const root = (ctx && ctx.canvas) || document.getElementById( 'wpbc_bfb__theme_scope' ) || document;
	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	if ( wpbc_bfb_form_appearance__is_user_theme_switch( ctx ) ) {
		const current_options = wpbc_bfb_form_appearance__get_current_options();
		if ( 'custom' === String( current_options.booking_form_container_style || '' ) ) {
			current_options.booking_form_theme = value;
			wpbc_bfb_form_appearance__sync_form_style_control( current_options );
			wpbc_bfb_form_appearance__apply_vars( 'custom', Object.assign( {}, ctx || {}, {
				key    : 'booking_form_container_style',
				source : 'theme-base-custom',
				options: current_options
			} ) );
		} else {
			wpbc_bfb_form_appearance__set_container_style_control( 'bordered' );
			wpbc_bfb_form_appearance__apply_vars( 'bordered', Object.assign( {}, ctx || {}, { key: 'booking_form_container_style' } ) );
		}
	} else if ( ctx && ctx.options ) {
		wpbc_bfb_form_appearance__sync_form_style_control( ctx.options );
	}

	const theme_selector = '.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__pages_panel';
	const wraps = [];
	if ( root.matches && root.matches( theme_selector ) ) {
		wraps.push( root );
	}
	root.querySelectorAll( theme_selector ).forEach( function (wrap) {
		wraps.push( wrap );
	} );
	if ( ! wraps.length ) {
		return;
	}

	wraps.forEach( function (wrap) {
		// remove any previous theme classes (simple + future-proof).
		Array.from( wrap.classList ).forEach( function (cls) {
			if ( /^wpbc_theme_/.test( cls ) ) {
				wrap.classList.remove( cls );
			}
		} );

		if ( value ) {
			wrap.classList.add( String( value ) );
		}
	} );
} );


// BOOKING_FORM_LAYOUT_WIDTH — Form width: applies combined "100%" / "600px" / "40rem" to the booking form containers.
WPBC_BFB_Settings_Effects.register( 'booking_form_layout_width', function (value, ctx) {
	const root = ctx && ctx.canvas;
	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	const wraps = root.querySelectorAll( '.wpbc_bfb__form_preview_section_container' );
	if ( ! wraps.length ) {
		return;
	}

	const v = String( value == null ? '' : value ).trim();

	// allow only "number + unit".
	if ( v && ! /^-?\d+(?:\.\d+)?(?:%|px|rem|em|vw|vh)$/.test( v ) ) {
		return;
	}

	wraps.forEach(
		function (wrap) {
			if ( ! wrap || ! wrap.style ) {
				return;
			}

			if ( ! v ) {
				wrap.style.removeProperty( '--wpbc-bfb-booking_form_layout_width' );
			} else {
				wrap.style.setProperty( '--wpbc-bfb-booking_form_layout_width', v );
			}
		}
	);
} );


// Debug Preview Mode.
WPBC_BFB_Settings_Effects.register( 'booking_bfb_preview_mode', function (value, ctx) {
	const root = ctx.canvas;
	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	const wraps = root.querySelectorAll( '.wpbc_container.wpbc_form' );
	if ( ! wraps.length ) {
		return;
	}

	// Get builder async.
	wpbc_bfb_api.with_builder(
		function (Builder) {

			/**
			 * Capture active right sidebar tab and return restore handle.
			 *
			 * @return {{restore:function():void}|null}
			 */
			function capture_right_sidebar_active_tab_restore_handle() {

				var tablist_el = document.querySelector( '.wpbc_bfb__rightbar_tabs[role="tablist"]' );
				if ( ! tablist_el ) {
					return null;
				}

				var active_tab_el = tablist_el.querySelector( '[role="tab"][aria-selected="true"]' );

				if ( ! active_tab_el ) {
					active_tab_el = tablist_el.querySelector( '[role="tab"][aria-controls="wpbc_bfb__palette_add_new"]' );
				}

				if ( ! active_tab_el || typeof active_tab_el.click !== 'function' ) {
					return null;
				}

				return {
					restore: function () {
						try { active_tab_el.click(); } catch ( _e ) {}
					}
				};
			}

			var tab_restore_handle = capture_right_sidebar_active_tab_restore_handle();

			let restored  = false;
			var EVS      = window.WPBC_BFB_Core && window.WPBC_BFB_Core.WPBC_BFB_Events ? window.WPBC_BFB_Core.WPBC_BFB_Events : {};
			var EV_DONE  = EVS.STRUCTURE_LOADED || EVS.CANVAS_REFRESHED || 'wpbc:bfb:structure-loaded';


			function do_restore() {
				if ( restored ) { return; }
				restored = true;
				try { Builder?.bus?.off?.( EV_DONE, do_restore ); } catch ( _ ) {}
				requestAnimationFrame( function () {
					if ( ! tab_restore_handle ) { return; }
					tab_restore_handle.restore();
				} );
			}

			// Listen once (best), plus a fallback in case event isn't fired.
			try { Builder?.bus?.on?.( EV_DONE, do_restore ); } catch ( _ ) {}


			var enabled = ('On' === value);
			Builder.set_preview_mode( enabled, { rebuild: true, reinit: true, source: 'settings-effects' } );
		}
	);

} );
