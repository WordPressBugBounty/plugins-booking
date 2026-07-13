/* globals window, document */
(function (w, d) {
	'use strict';

	/**
	 * BFB Form Settings UI bridge.
	 *
	 * Listens to:
	 * - wpbc:bfb:form_settings:apply   (from AJAX load)  -> apply to controls
	 * - wpbc:bfb:form_settings:collect (from AJAX save)  -> collect from controls
	 *
	 * Optional:
	 * - re-apply after Builder STRUCTURE_LOADED (timing hook only)
	 */
	const api = (w.WPBC_BFB_FormSettings = w.WPBC_BFB_FormSettings || {});

	// Last received settings pack (from AJAX).
	let last_settings_pack = null;

	// Small retry, because DOM can be re-rendered after apply event.
	let raf_id      = 0;
	let retry_count = 0;
	const retry_max = 20;
	const fallback_form_style_option_keys = [
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
		'booking_form_custom_secondary_button_hover_border_color',
		'booking_form_theme',
		'booking_form_container_style',
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

	// -----------------------------------------------------------------------------------------------
	// Small helpers
	// -----------------------------------------------------------------------------------------------

	function query_all(root, selector) {
		return Array.from((root || d).querySelectorAll(selector));
	}

	function css_escape(value) {
		const v = String(value == null ? '' : value);
		if (w.CSS && typeof w.CSS.escape === 'function') return w.CSS.escape(v);
		return v.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
	}

	function is_on(value) {
		const v = String(value == null ? '' : value).trim().toLowerCase();
		return (v === 'on' || v === '1' || v === 'true' || v === 'yes');
	}

	function set_initial_attr(el, value) {
		if (!el) return;
		el.setAttribute('data-wpbc-bfb-fs-initial', String(value == null ? '' : value));
	}

	function trigger_change(el) {
		if (!el) return;
		try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
	}

	function trigger_input(el) {
		if ( !el ) return;
		try { el.dispatchEvent( new Event( 'input', { bubbles: true } ) ); } catch ( _ ) {}
	}

	function find_rows(scope) {
		const rows = query_all(d, '.wpbc-setting[data-key]');
		if (!scope) return rows;

		return rows.filter(function (row) {
			return String(row.getAttribute('data-scope') || '') === String(scope);
		});
	}

	function has_any_rows() {
		return query_all(d, '.wpbc-setting[data-key]').length > 0;
	}

	function init_coloris_pickers(root) {
		if ( ! root || ! w.Coloris ) {
			return;
		}

		const inputs = query_all(root, 'input[data-wpbc-bfb-fs-type="color"][data-coloris], input[data-inspector-type="color"][data-coloris]');
		if ( ! inputs.length ) {
			return;
		}

		inputs.forEach(function (input) {
			if (input.classList.contains('wpbc_bfb_coloris')) return;
			input.classList.add('wpbc_bfb_coloris');
		});

		try {
			w.Coloris({
				el       : '.wpbc_bfb_coloris',
				alpha    : false,
				format   : 'hex',
				themeMode: 'auto',
				onChange : function (color, input) {
					if ( ! input ) {
						return;
					}
					try {
						input.dispatchEvent( new CustomEvent( 'wpbc:bfb:coloris:change', {
							bubbles: true,
							detail : {
								color    : color,
								currentEl: input
							}
						} ) );
					} catch ( _e ) {}
				}
			});
		} catch (e) {
			console.warn('WPBC Form Settings: Coloris init failed:', e);
		}
	}

	function get_default_custom_appearance_settings() {
		const localized = w.wpbc_bfb_settings_vars && w.wpbc_bfb_settings_vars.custom_form_style_defaults
			? w.wpbc_bfb_settings_vars.custom_form_style_defaults
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

	function get_form_style_option_keys() {
		const localized = w.wpbc_bfb_settings_vars && Array.isArray( w.wpbc_bfb_settings_vars.form_style_option_keys )
			? w.wpbc_bfb_settings_vars.form_style_option_keys
			: [];

		return localized.length ? localized : fallback_form_style_option_keys;
	}

	function strip_form_style_options_from_pack(settings_pack) {
		if (!settings_pack || typeof settings_pack !== 'object') return settings_pack;
		if (!settings_pack.options || typeof settings_pack.options !== 'object') return settings_pack;

		get_form_style_option_keys().forEach(function (key) {
			delete settings_pack.options[key];
		});

		return settings_pack;
	}

	// -----------------------------------------------------------------------------------------------
	// Row setter
	// -----------------------------------------------------------------------------------------------

	function set_value_for_row(row, value, opts) {
		if (!row) return;

		const row_type = String(row.getAttribute('data-type') || '');
		const row_key  = String(row.getAttribute('data-key') || '');
		const do_trigger_events = !!(opts && opts.trigger_change);

		if (!row_key) return;

		// Radio group
		if (row_type === 'radio') {
			const wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]');
			const control_id = wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-controlid') || '') : '';
			if (!control_id) return;

			const target_value = String(value == null ? '' : value);
			const radios = query_all(row, 'input[type="radio"][name="' + css_escape(control_id) + '"]');

			let checked_radio = null;
			radios.forEach(function (radio) {
				const should_check = (String(radio.value) === target_value);
				radio.checked = should_check;
				if (should_check) checked_radio = radio;

				const choice = radio.closest ? radio.closest('.wpbc_theme_choice') : null;
				if ( choice ) {
					choice.classList.toggle('is-selected', should_check);
				}
			});

			if (wrap) set_initial_attr(wrap, target_value);
			if (do_trigger_events && checked_radio) trigger_change(checked_radio);
			return;
		}

		// Toggle
		if (row_type === 'toggle') {
			const checkbox =
				row.querySelector('input[type="checkbox"][data-wpbc-bfb-fs-type="toggle"]') ||
				row.querySelector('input[type="checkbox"]');

			if (!checkbox) return;

			const checked = is_on(value);
			checkbox.checked = checked;
			checkbox.setAttribute('aria-checked', checked ? 'true' : 'false');

			set_initial_attr(checkbox, checked ? 'On' : 'Off');
			if (do_trigger_events) trigger_change(checkbox);
			return;
		}

		// Select
		if (row_type === 'select') {
			const select =
				row.querySelector('select[data-wpbc-bfb-fs-type="select"]') ||
				row.querySelector('select');

			if (!select) return;

			select.value = String(value == null ? '' : value);
			set_initial_attr(select, select.value);
			if (do_trigger_events) trigger_change(select);
			return;
		}

		// Length: hidden combined + num/unit
		if ( row_type === 'length' ) {
			// JS slider length control: - hidden writer carries FS markers and must receive input event so wpbc_slider_len_groups.js syncs UI.
			const writer =
					  row.querySelector( 'input[data-wpbc_slider_len_writer][data-wpbc-bfb-fs-type="length"]' ) ||
					  row.querySelector( 'input[data-wpbc-bfb-fs-type="length"]' );
			if ( !writer ) return;

			const combined = String( value == null ? '' : value );
			writer.value   = combined;
			set_initial_attr( writer, combined );
			if ( do_trigger_events ) trigger_input( writer );
			return;
		}

		// Spacing: two number inputs saved into a hidden CSS shorthand writer.
		if ( row_type === 'spacing' ) {
			const group = row.querySelector( '.wpbc_spacing_group' );
			const vertical_input = group ? group.querySelector( 'input[data-wpbc_spacing_vertical]' ) : null;
			const horizontal_input = group ? group.querySelector( 'input[data-wpbc_spacing_horizontal]' ) : null;
			const writer = group ? group.querySelector( 'input[data-wpbc_spacing_writer]' ) : null;
			const parsed = parse_spacing_value( value );

			if ( ! writer ) {
				return;
			}

			if ( vertical_input ) {
				vertical_input.value = parsed.vertical;
			}
			if ( horizontal_input ) {
				horizontal_input.value = parsed.horizontal;
			}
			writer.value = parsed.combined;
			set_initial_attr( writer, parsed.combined );
			if ( do_trigger_events ) trigger_input( writer );
			return;
		}

		// Range (slider number): writer is the number input.
		if (row_type === 'range') {
			const writer =
				row.querySelector('input[data-wpbc_slider_range_writer]') ||
				row.querySelector('input[data-wpbc-bfb-fs-key="' + css_escape(row_key) + '"]') ||
				row.querySelector('input[type="number"]');
			if (!writer) return;

			writer.value = String(value == null ? '' : value);
			set_initial_attr(writer, writer.value);
			if (do_trigger_events) trigger_input(writer);
			return;
		}

		// Default: input/textarea
		const control =
			row.querySelector('[data-wpbc-bfb-fs-key="' + css_escape(row_key) + '"]') ||
			row.querySelector('input,textarea');

		if (!control) return;

		control.value = String(value == null ? '' : value);
		set_initial_attr(control, control.value);
		// For normal inputs, "input" gives better reactivity than "change".
		if (do_trigger_events) trigger_input(control);
	}

	// -----------------------------------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------------------------------

	/**
	 * Apply FLAT object (key=>value) to rows of some scope.
	 */
	function apply_flat_settings(flat_settings, scope, opts) {
		if (!flat_settings || typeof flat_settings !== 'object') return;

		find_rows(scope).forEach(function (row) {
			const key = String(row.getAttribute('data-key') || '');
			if (!key) return;
			if (!Object.prototype.hasOwnProperty.call(flat_settings, key)) return;
			set_value_for_row(row, flat_settings[key], opts);
		});
	}

	/**
	 * Apply settings.
	 *
	 * Supports:
	 * - flat: { booking_form_layout_width: '100%', ... }
	 * - pack: { options: {...}, css_vars: {...} }   (Option A)
	 */
	api.apply = function (settings_pack, scope, opts) {
		if (!settings_pack || typeof settings_pack !== 'object') return;
		if (!settings_pack.options || typeof settings_pack.options !== 'object') return; // strict Option A
		strip_form_style_options_from_pack(settings_pack);
		apply_flat_settings(settings_pack.options, scope || 'form', opts);
	};

	api.reset_custom_appearance = function () {
		const defaults = get_default_custom_appearance_settings();

		if ( ! last_settings_pack || typeof last_settings_pack !== 'object' ) {
			last_settings_pack = { options: {}, css_vars: {} };
		}
		if ( ! last_settings_pack.options || typeof last_settings_pack.options !== 'object' ) {
			last_settings_pack.options = {};
		}
		Object.keys( defaults ).forEach( function (key) {
			last_settings_pack.options[key] = defaults[key];
		} );

		apply_flat_settings( defaults, 'global', { trigger_change: true } );
		init_coloris_pickers( d );

		if ( w.WPBC_BFB_Settings_Effects && typeof w.WPBC_BFB_Settings_Effects.apply_all === 'function' ) {
			w.WPBC_BFB_Settings_Effects.apply_all( defaults, { source: 'reset-custom-appearance', options: defaults } );
		}

		try {
			d.dispatchEvent( new CustomEvent( 'wpbc:bfb:form_settings:changed', {
				bubbles: true,
				detail : {
					source  : 'reset-custom-appearance',
					settings: { options: Object.assign( {}, defaults ) }
				}
			} ) );
		} catch ( _e ) {}
	};

	/**
	 * Collect current values (flat object).
	 */
	api.collect = function (scope) {
		const out = {};

		find_rows(scope || 'form').forEach(function (row) {
			const key  = String(row.getAttribute('data-key') || '');
			const type = String(row.getAttribute('data-type') || '');
			if (!key) return;

			if (type === 'radio') {
				const wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]');
				const control_id = wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-controlid') || '') : '';
				if (!control_id) return;

				const checked = row.querySelector('input[type="radio"][name="' + css_escape(control_id) + '"]:checked');
				out[key] = checked ? String(checked.value) : '';
				return;
			}

			if (type === 'toggle') {
				const checkbox =
					row.querySelector('input[type="checkbox"][data-wpbc-bfb-fs-type="toggle"]') ||
					row.querySelector('input[type="checkbox"]');
				out[key] = checkbox && checkbox.checked ? 'On' : 'Off';
				return;
			}

			if (type === 'select') {
				const select = row.querySelector('select');
				out[key] = select ? String(select.value) : '';
				return;
			}

			if (type === 'length') {
				const hidden = row.querySelector('input[data-wpbc-bfb-fs-type="length"]');
				out[key] = hidden ? String(hidden.value || '') : '';
				return;
			}

			if (type === 'spacing') {
				out[key] = get_spacing_value(row);
				return;
			}

			if (type === 'range') {
				const writer =
					row.querySelector('input[data-wpbc_slider_range_writer]') ||
					row.querySelector('input[type="number"]') ||
					row.querySelector('input[type="range"]');
				out[key] = writer ? String(writer.value || '') : '';
				return;
			}
			const control = row.querySelector('input,textarea');
			out[key] = control ? String(control.value || '') : '';
		});

		return out;
	};

	function parse_spacing_value(value) {
		const fallback = { vertical: '10', horizontal: '30', combined: '10px 30px' };
		const matches = String(value == null ? '' : value).match(/-?\d+(?:\.\d+)?/g) || [];
		let vertical = matches[0] != null ? String(matches[0]) : fallback.vertical;
		let horizontal = matches[1] != null ? String(matches[1]) : vertical;

		if (isNaN(Number(vertical))) {
			vertical = fallback.vertical;
		}
		if (isNaN(Number(horizontal))) {
			horizontal = fallback.horizontal;
		}

		return {
			vertical  : vertical,
			horizontal: horizontal,
			combined  : vertical + 'px ' + horizontal + 'px'
		};
	}

	function get_spacing_value(row) {
		const group = row ? row.querySelector('.wpbc_spacing_group') : null;
		const vertical_input = group ? group.querySelector('input[data-wpbc_spacing_vertical]') : null;
		const horizontal_input = group ? group.querySelector('input[data-wpbc_spacing_horizontal]') : null;
		const writer = group ? group.querySelector('input[data-wpbc_spacing_writer]') : null;
		const vertical = vertical_input ? String(vertical_input.value || '0') : '0';
		const horizontal = horizontal_input ? String(horizontal_input.value || vertical) : vertical;
		const combined = parse_spacing_value(vertical + 'px ' + horizontal + 'px').combined;

		if (writer) {
			writer.value = combined;
		}

		return combined;
	}

	/**
	 * Re-apply last received settings (useful after DOM re-render).
	 */
	api.reapply_last = function () {
		if (!last_settings_pack) return;
		api.apply(last_settings_pack, 'form', { trigger_change: true });
	};

	api.init = function () {
		init_coloris_pickers(d);

		// If apply event fired before init, try again now.
		if (last_settings_pack) schedule_apply_retry();
	};

	// -----------------------------------------------------------------------------------------------
	// DOM Events (AJAX layer)
	// -----------------------------------------------------------------------------------------------

	// Save: let modules contribute into { options:{}, css_vars:{} }
	d.addEventListener('wpbc:bfb:form_settings:collect', function (e) {
		const detail = (e && e.detail) ? e.detail : {};
		const target_pack = detail.settings;

		if (!target_pack || typeof target_pack !== 'object') return;

		// Option A: write into target_pack.options
		if (!target_pack.options || typeof target_pack.options !== 'object') {
			target_pack.options = {};
		}

		const collected = api.collect('form');
		Object.keys(collected).forEach(function (k) {
			target_pack.options[k] = collected[k];
		});
		strip_form_style_options_from_pack(target_pack);
	});

	// Load: receive settings from AJAX and apply.
	d.addEventListener('wpbc:bfb:form_settings:apply', function (e) {
		const detail = (e && e.detail) ? e.detail : {};

		last_settings_pack = detail.settings || null;

		retry_count = 0;
		schedule_apply_retry();
	});

	d.addEventListener( 'click', function (e) {
		const btn = e && e.target && e.target.closest ? e.target.closest( '[data-wpbc-bfb-reset-custom-appearance]' ) : null;
		if ( ! btn ) {
			return;
		}

		e.preventDefault();
		api.reset_custom_appearance();
	}, false );

	function schedule_apply_retry() {
		if (raf_id) return;

		raf_id = w.requestAnimationFrame(function () {
			raf_id = 0;

			// If settings UI not present yet, retry a few frames.
			if (!has_any_rows()) {
				retry_count++;
				if (retry_count < retry_max) schedule_apply_retry();
				return;
			}

			api.reapply_last();
			init_coloris_pickers(d);
		});
	}

	// -----------------------------------------------------------------------------------------------
	// Optional Builder timing hook (STRUCTURE_LOADED) -> reapply_last()
	// -----------------------------------------------------------------------------------------------

	function bind_builder_timing_hook(builder_instance) {
		const core = w.WPBC_BFB_Core;
		const events = (core && core.WPBC_BFB_Events) ? core.WPBC_BFB_Events : (w.WPBC_BFB_Events || null);


		if (!builder_instance || !builder_instance.bus || !events || !events.STRUCTURE_LOADED) return;

		builder_instance.bus.on(events.STRUCTURE_LOADED, function () {
			// Builder may re-render settings panel after structure load.
			// Re-apply last settings pack (if any).
			retry_count = 0;
			schedule_apply_retry();
		});
	}

	if (w.wpbc_bfb_api && w.wpbc_bfb_api.ready && typeof w.wpbc_bfb_api.ready.then === 'function') {
		w.wpbc_bfb_api.ready.then(bind_builder_timing_hook);
	} else {
		setTimeout(function () { if (w.__B) { bind_builder_timing_hook( w.__B ); } }, 0);
	}

	// DOM ready init.
	if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', api.init);
	else api.init();

})(window, document);
