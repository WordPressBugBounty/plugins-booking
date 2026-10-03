/**
 * Drive the Setup Wizard Appearance controls and request-local live preview.
 *
 * @package Booking Calendar
 */
( function ( window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_appearance || { i18n: {} };

	/**
	 * Create one Appearance step adapter for the shared wizard shell.
	 *
	 * @param {Object} config Server-owned preset and translation configuration.
	 * @return {Object} Step adapter.
	 */
	function create_appearance_adapter( config ) {
		var shell_api = null;
		var editor = null;
		var preview_frame_request = 0;

		/**
		 * Return one translated string with a safe fallback.
		 *
		 * @param {string} key Translation key.
		 * @param {string} fallback Fallback text.
		 * @return {string} Translation or fallback.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? String( config.i18n[ key ] ) : fallback;
		}

		/**
		 * Return the current scalar Appearance values.
		 *
		 * @return {Object} Current values.
		 */
		function get_values() {
			var style = editor.node.querySelector( '[data-wpbc-appearance-style]:checked' );
			var time_mode = editor.node.querySelector( '[data-wpbc-appearance-time-mode]:checked' );

			return {
				booking_form_style: style ? String( style.value || '' ) : '',
				booking_form_accent_color: String( editor.accent_value.value || '' ).toUpperCase(),
				booking_skin: String( editor.skin.value || '' ),
				booking_timeslot_picker: time_mode ? String( time_mode.value || '' ) : ''
			};
		}

		/**
		 * Update the selected presentation for style and time radios.
		 *
		 * @return {void}
		 */
		function render_selected_controls() {
			Array.prototype.slice.call( editor.node.querySelectorAll( '[data-wpbc-appearance-style]' ) ).forEach( function ( input ) {
				input.closest( '.wpbc_setup_wizard__appearance-style-card' ).classList.toggle( 'is-selected', input.checked );
			} );
			Array.prototype.slice.call( editor.node.querySelectorAll( '[data-wpbc-appearance-time-mode]' ) ).forEach( function ( input ) {
				input.closest( 'label' ).classList.toggle( 'is-selected', input.checked );
			} );
		}

		/**
		 * Synchronize preset swatches and the Coloris field presentation.
		 *
		 * @param {string} color Canonical six-digit hexadecimal color.
		 * @return {void}
		 */
		function render_accent_controls( color ) {
			var coloris_field;

			editor.accent_swatches.forEach( function ( swatch ) {
				var is_selected = String( swatch.dataset.wpbcAppearanceAccentSwatch || '' ).toUpperCase() === color;

				swatch.classList.toggle( 'is-selected', is_selected );
				swatch.setAttribute( 'aria-pressed', is_selected ? 'true' : 'false' );
			} );

			coloris_field = editor.accent_value.closest( '.clr-field' );
			if ( coloris_field && /^#[0-9A-F]{6}$/.test( color ) ) {
				coloris_field.style.color = color;
			}
		}

		/**
		 * Normalize the canonical Coloris accent field.
		 *
		 * @param {string} color Candidate six-digit hexadecimal color.
		 * @return {boolean} Whether the color is valid and was normalized.
		 */
		function set_accent_color( color ) {
			color = String( color || '' ).toUpperCase();
			if ( ! /^#[0-9A-F]{6}$/.test( color ) ) {
				render_accent_controls( '' );
				return false;
			}

			editor.accent_value.value = color;
			render_accent_controls( color );
			shell_api.clear_field_error( 'booking_form_accent_color' );

			return true;
		}

		/**
		 * Return the server-authorized Form Style preset registry.
		 *
		 * @return {Object} Presets keyed by style identifier.
		 */
		function get_form_style_presets() {
			return config.form_style_presets && 'object' === typeof config.form_style_presets
				? config.form_style_presets
				: {};
		}

		/**
		 * Return every CSS variable that may be applied by a Form Style preset.
		 *
		 * @return {string[]} CSS custom-property names.
		 */
		function get_form_style_css_var_names() {
			return Array.isArray( config.form_style_css_var_names ) ? config.form_style_css_var_names : [];
		}

		/**
		 * Return relative luminance for a six-digit hexadecimal color.
		 *
		 * @param {string} color Valid six-digit hexadecimal color.
		 * @return {number} WCAG relative luminance.
		 */
		function get_color_luminance( color ) {
			var hex = String( color || '#000000' ).replace( '#', '' );
			var channels = [ 0, 1, 2 ].map( function ( index ) {
				var channel = parseInt( hex.substr( index * 2, 2 ), 16 ) / 255;
				return channel <= 0.03928 ? channel / 12.92 : Math.pow( ( channel + 0.055 ) / 1.055, 2.4 );
			} );

			return ( 0.2126 * channels[ 0 ] ) + ( 0.7152 * channels[ 1 ] ) + ( 0.0722 * channels[ 2 ] );
		}

		/**
		 * Mix one hexadecimal color toward a target color.
		 *
		 * @param {string} color Source color.
		 * @param {string} target Target color.
		 * @param {number} amount Target mix ratio from zero to one.
		 * @return {string} Mixed six-digit hexadecimal color.
		 */
		function mix_colors( color, target, amount ) {
			var source = String( color || '#000000' ).replace( '#', '' );
			var destination = String( target || '#000000' ).replace( '#', '' );
			var channels = [];
			var index;

			for ( index = 0; index < 3; index++ ) {
				channels.push( Math.round( parseInt( source.substr( index * 2, 2 ), 16 ) + ( ( parseInt( destination.substr( index * 2, 2 ), 16 ) - parseInt( source.substr( index * 2, 2 ), 16 ) ) * amount ) ) );
			}

			return '#' + channels.map( function ( channel ) {
				return ( '0' + channel.toString( 16 ) ).slice( -2 );
			} ).join( '' );
		}

		/**
		 * Add the selected accent to one preset CSS-variable map.
		 *
		 * @param {Object} css_vars Preset CSS variables.
		 * @param {string} accent Valid six-digit hexadecimal accent.
		 * @return {Object} CSS variables with accent overlays.
		 */
		function apply_accent_to_css_vars( css_vars, accent ) {
			var contrast = get_color_luminance( accent ) > 0.18 ? '#000000' : '#ffffff';
			var hover = mix_colors( accent, '#ffffff' === contrast ? '#000000' : '#ffffff', 0.10 );
			var accent_overlay = {
				'--wpbc_form-accent-color': accent,
				'--wpbc_form-accent-hover-color': hover,
				'--wpbc_form-accent-contrast-color': contrast,
				'--wpbc_form-field-focus-border-color': accent,
				'--wpbc_form-field-focus-shadow-color': accent,
				'--wpbc_form-choice-checked-border-color': accent,
				'--wpbc_form-choice-checked-color': accent,
				'--wpbc_form-choice-focus-color': accent,
				'--wpbc_form-button-background-color': accent,
				'--wpbc_form-button-background-color-alt': accent,
				'--wpbc_form-button-border-color': accent,
				'--wpbc_form-button-text-color': contrast,
				'--wpbc_form-button-text-color-alt': contrast,
				'--wpbc_form-button-hover-background-color': hover,
				'--wpbc_form-button-hover-border-color': hover,
				'--wpbc_form-button-hover-text-color': contrast,
				'--wpbc_form-button-light-hover-border-color': accent,
				'--wpbc_form-button-primary-hover-border-color': hover,
				'--wpbc_form-page-break-color': accent
			};

			return Object.assign( {}, css_vars, accent_overlay );
		}

		/**
		 * Apply style classes, preset variables, and accent variables in place.
		 *
		 * @return {void}
		 */
		function apply_form_style_to_preview() {
			var values = get_values();
			var presets = get_form_style_presets();
			var preset = presets[ values.booking_form_style ] || presets.light_bordered || {};
			var css_vars = preset.css_vars && 'object' === typeof preset.css_vars ? preset.css_vars : {};
			var css_var_names = get_form_style_css_var_names();
			var targets = Array.prototype.slice.call( editor.preview_root.querySelectorAll( '.wpbc_container.wpbc_form, .wpbc_bfb_form, .wpbc_bfb__form_preview_section_container' ) );

			if ( ! /^#[0-9A-F]{6}$/.test( values.booking_form_accent_color ) ) {
				return;
			}

			css_vars = apply_accent_to_css_vars( css_vars, values.booking_form_accent_color );
			targets.forEach( function ( target ) {
				target.classList.remove( 'wpbc_theme_dark_1', 'wpbc_bfb_form_appearance_custom' );
				css_var_names.forEach( function ( variable_name ) {
					target.style.removeProperty( variable_name );
				} );
				Object.keys( css_vars ).forEach( function ( variable_name ) {
					if ( '' !== String( css_vars[ variable_name ] || '' ) ) {
						target.style.setProperty( variable_name, css_vars[ variable_name ] );
					}
				} );
				if ( preset.theme_class ) {
					target.classList.add( String( preset.theme_class ) );
				}
			} );
		}

		/**
		 * Apply the selected server-resolved calendar skin without rebuilding markup.
		 *
		 * @return {void}
		 */
		function apply_calendar_skin_to_preview() {
			var option = editor.skin.options[ editor.skin.selectedIndex ];
			var skin_url = option ? String( option.dataset.wpbcCalendarSkinUrl || '' ) : '';

			if ( skin_url && 'function' === typeof window.wpbc__calendar__change_skin && document.getElementById( 'wpbc-calendar-skin-css' ) ) {
				window.wpbc__calendar__change_skin( skin_url );
			}
		}

		/**
		 * Switch the existing time controls between select and time-picker views.
		 *
		 * @return {void}
		 */
		function apply_time_mode_to_preview() {
			var is_enabled = 'On' === get_values().booking_timeslot_picker;
			var time_selectors = 'select[name^="rangetime"], select[name^="starttime"], select[name^="endtime"], select[name^="durationtime"]';

			if ( window._wpbc && 'function' === typeof window._wpbc.set_other_param ) {
				window._wpbc.set_other_param( 'is_enabled_booking_timeslot_picker', is_enabled );
			}

			if ( is_enabled ) {
				if ( window._wpbc && 'function' === typeof window.wpbc_hook__init_timeselector ) {
					window.wpbc_hook__init_timeselector();
				}
				return;
			}
			if ( 'function' === typeof window.wpbc_hook__destroy_timeselector ) {
				window.wpbc_hook__destroy_timeselector( editor.preview_root );
				return;
			}

			Array.prototype.slice.call( editor.preview_root.querySelectorAll( '.wpbc_times_selector' ) ).forEach( function ( selector ) {
				selector.remove();
			} );
			Array.prototype.slice.call( editor.preview_root.querySelectorAll( time_selectors ) ).forEach( function ( select ) {
				select.style.display = '';
			} );
		}

		/**
		 * Coalesce continuous Coloris input into one animation-frame update.
		 *
		 * @return {void}
		 */
		function schedule_form_preview_update() {
			if ( preview_frame_request ) {
				window.cancelAnimationFrame( preview_frame_request );
			}
			preview_frame_request = window.requestAnimationFrame( function () {
				preview_frame_request = 0;
				apply_form_style_to_preview();
			} );
		}

		/**
		 * Handle accent shortcut activation.
		 *
		 * @param {MouseEvent} event Click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var accent_swatch = event.target.closest( '[data-wpbc-appearance-accent-swatch]' );

			if ( accent_swatch && set_accent_color( accent_swatch.dataset.wpbcAppearanceAccentSwatch ) ) {
				schedule_form_preview_update();
			}
		}

		/**
		 * Handle canonical select and radio changes without a network request.
		 *
		 * @param {Event} event Change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			if ( event.target.matches( '[data-wpbc-appearance-style]' ) ) {
				shell_api.clear_field_error( 'booking_form_style' );
				render_selected_controls();
				apply_form_style_to_preview();
			} else if ( event.target.matches( '[data-wpbc-appearance-time-mode]' ) ) {
				shell_api.clear_field_error( 'booking_timeslot_picker' );
				render_selected_controls();
				apply_time_mode_to_preview();
			} else if ( event.target.matches( '[data-wpbc-appearance-preview-field]' ) ) {
				shell_api.clear_field_error( 'booking_skin' );
				apply_calendar_skin_to_preview();
			}
		}

		/**
		 * Validate and apply continuous accent input.
		 *
		 * @param {Event} event Input event.
		 * @return {void}
		 */
		function handle_accent_input( event ) {
			if ( set_accent_color( event.target.value ) ) {
				schedule_form_preview_update();
			}
		}

		/**
		 * Initialize this module against shell-provided APIs.
		 *
		 * @param {Object} registered_shell_api Shared wizard adapter services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var editor_node;

			shell_api = registered_shell_api;
			editor_node = shell_api.root.querySelector( '[data-wpbc-appearance-editor]' );
			if ( ! editor_node ) {
				return;
			}

			editor = {
				node: editor_node,
				accent_value: editor_node.querySelector( '[data-wpbc-appearance-accent-value]' ),
				accent_swatches: Array.prototype.slice.call( editor_node.querySelectorAll( '[data-wpbc-appearance-accent-swatch]' ) ),
				skin: editor_node.querySelector( '[name="booking_skin"]' ),
				preview_root: editor_node.querySelector( '[data-wpbc-appearance-inline-preview]' )
			};

			if ( ! editor.accent_value || ! editor.skin || ! editor.preview_root ) {
				return;
			}

			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			editor.accent_value.addEventListener( 'input', handle_accent_input );
			if ( 'function' === typeof window.Coloris ) {
				window.Coloris( {
					el: '.wpbc_setup_wizard__appearance-coloris',
					alpha: false,
					format: 'hex',
					themeMode: 'auto',
					onChange: function ( color, current_input ) {
						if ( current_input === editor.accent_value && set_accent_color( color ) ) {
							schedule_form_preview_update();
						}
					}
				} );
			}

			render_selected_controls();
			set_accent_color( editor.accent_value.value );
			apply_form_style_to_preview();
			apply_calendar_skin_to_preview();
			apply_time_mode_to_preview();
		}

		/**
		 * Validate required fields before forward navigation.
		 *
		 * @return {HTMLElement|null} First invalid control, or null.
		 */
		function validate() {
			var values = get_values();
			if ( ! values.booking_form_style ) {
				return shell_api.set_field_error( 'booking_form_style', get_message( 'style_required', 'Choose a starting style.' ) );
			}
			if ( ! /^#[0-9A-F]{6}$/.test( values.booking_form_accent_color ) ) {
				shell_api.set_field_error( 'booking_form_accent_color', get_message( 'accent_required', 'Choose a valid accent color.' ) );
				return editor.accent_value;
			}
			if ( ! values.booking_skin ) {
				return shell_api.set_field_error( 'booking_skin', get_message( 'skin_required', 'Choose a calendar skin.' ) );
			}
			if ( ! values.booking_timeslot_picker ) {
				return shell_api.set_field_error( 'booking_timeslot_picker', get_message( 'time_required', 'Choose how time slots are displayed.' ) );
			}
			return null;
		}

		return {
			initialize: initialize,
			sync: function () {},
			validate: validate
		};
	}

	window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
	window.wpbc_setup_editor_modules.appearance = { create: create_appearance_adapter };

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_appearance_adapter( module_config ) );
	}
}( window, document ) );
