/**
 * Timeline toolbar, date navigation, density, and axis-keyboard controller.
 *
 * Shared UI components continue to own their reusable disclosure, datepicker,
 * dropdown, focus, and keyboard mechanics. This Timeline-domain adapter owns
 * only the server-declared range/scale mapping, navigation request proposals,
 * visual cell-width state, and movement between rendered axis cells.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp ) {
	'use strict';

	var module_id = 'toolbar_navigation';

	/**
	 * Create one Timeline toolbar and navigation controller.
	 *
	 * @param {Object} context Timeline settings, module references, and callbacks.
	 * @return {Object} Toolbar/navigation lifecycle and interaction API.
	 */
	function create_toolbar_navigation_controller( context ) {
		var mount = context.mount || null;
		var settings = context.settings || {};
		var window_cache = context.window_cache || null;
		var callbacks = context.callbacks || {};
		var visual_zoom_configuration = get_visual_zoom_configuration();
		var visual_zoom_percent = visual_zoom_configuration.default_percent;
		var visual_zoom_anchor = null;
		var visual_zoom_frame = 0;
		var is_initialized = false;

		/**
		 * Invoke one optional page-controller callback.
		 *
		 * @param {string} callback_name Stable callback key.
		 * @param {...*} callback_arguments Callback arguments.
		 * @return {*} Callback result or null when unavailable.
		 */
		function invoke_callback( callback_name ) {
			var callback = callbacks[ callback_name ];
			var callback_arguments = Array.prototype.slice.call( arguments, 1 );

			return 'function' === typeof callback ? callback.apply( null, callback_arguments ) : null;
		}

		/**
		 * Normalize the executable-free visual cell-width configuration.
		 *
		 * @return {Object} Minimum, maximum, step, and selected default percentage.
		 */
		function get_visual_zoom_configuration() {
			var configured = settings.metadata && settings.metadata.visual_zoom ? settings.metadata.visual_zoom : {};
			var stored_percent = settings.preferences ? Number( settings.preferences.visual_zoom_percent ) : 0;
			var min_percent = Math.max( 30, Math.min( 300, Math.round( Number( configured.min_percent ) || 30 ) ) );
			var max_percent = Math.max( min_percent, Math.min( 300, Math.round( Number( configured.max_percent ) || 300 ) ) );
			var step_percent = Math.max( 1, Math.min( max_percent - min_percent || 1, Math.round( Number( configured.step_percent ) || 10 ) ) );
			var configured_default_percent = Number( configured.default_percent ) || 100;
			var default_percent = stored_percent || configured_default_percent;

			configured_default_percent = Math.max( min_percent, Math.min( max_percent, Math.round( configured_default_percent ) ) );
			configured_default_percent = min_percent + Math.round( ( configured_default_percent - min_percent ) / step_percent ) * step_percent;
			configured_default_percent = Math.min( max_percent, configured_default_percent );
			default_percent = Math.max( min_percent, Math.min( max_percent, Math.round( default_percent ) ) );
			default_percent = min_percent + Math.round( ( default_percent - min_percent ) / step_percent ) * step_percent;
			default_percent = Math.min( max_percent, default_percent );

			return {
				min_percent: min_percent,
				max_percent: max_percent,
				step_percent: step_percent,
				configured_default_percent: configured_default_percent,
				default_percent: default_percent
			};
		}

		/**
		 * Return one server-declared shared UI WordPress template renderer.
		 *
		 * @param {string} template_key Stable shared component key.
		 * @return {Function|null} WordPress template renderer or null.
		 */
		function get_shared_ui_template( template_key ) {
			var template_id = settings.shared_ui && settings.shared_ui.templates
				? settings.shared_ui.templates[ template_key ]
				: '';

			if ( ! template_id || ! wp || 'function' !== typeof wp.template ) {
				return null;
			}

			return wp.template( template_id );
		}

		/**
		 * Render one shared component into its Timeline-owned host.
		 *
		 * @param {Element|null} target Domain-owned host.
		 * @param {string} template_key Shared component key.
		 * @param {Object} view_model Executable-free component data.
		 * @return {boolean} True when the component rendered.
		 */
		function render_shared_ui_template( target, template_key, view_model ) {
			var template = get_shared_ui_template( template_key );

			if ( ! target || ! template ) {
				return false;
			}
			target.innerHTML = template( view_model );
			return true;
		}

		/**
		 * Return one exact server-declared range-and-scale option.
		 *
		 * @param {string} option_value Stable opaque option value.
		 * @return {Object|null} Matching option metadata or null.
		 */
		function get_range_scale_option( option_value ) {
			var matching_option = null;

			( settings.metadata.range_scale_options || [] ).some( function ( range_scale_option ) {
				if ( String( range_scale_option.value ) === String( option_value ) ) {
					matching_option = range_scale_option;
					return true;
				}
				return false;
			} );

			return matching_option;
		}

		/**
		 * Format the fallback label for a custom range and current scale.
		 *
		 * @param {string} range_label Date-range label.
		 * @param {string} scale_label Cell-scale label.
		 * @return {string} Combined visible label.
		 */
		function format_custom_range_label( range_label, scale_label ) {
			return String( settings.i18n.advanced_combination_format || '%1$s — %2$s' )
				.replace( '%1$s', String( range_label || '' ) )
				.replace( '%2$s', String( scale_label || '' ) );
		}

		/**
		 * Return the option matching the current logical server window.
		 *
		 * @return {string} Exact option value or `custom`.
		 */
		function get_matching_range_scale_option_value() {
			var matching_option_value = 'custom';
			var current_view = settings.current_axis && settings.current_axis.view ? settings.current_axis.view : settings.axis.view;

			( settings.metadata.range_scale_options || [] ).some( function ( range_scale_option ) {
				var option_months = Number( range_scale_option.window_months );
				var matches_months = 0 < option_months && option_months === Number( settings.window.window_months );
				var matches_days = 0 === option_months && 0 === Number( settings.window.window_months ) && Number( range_scale_option.window_days ) === Number( settings.window.window_days );

				if ( String( range_scale_option.view_id ) === String( current_view ) && ( matches_months || matches_days ) ) {
					matching_option_value = String( range_scale_option.value );
					return true;
				}
				return false;
			} );

			return matching_option_value;
		}

		/**
		 * Return one option label from ordered metadata.
		 *
		 * @param {Array<Object>} options Metadata records.
		 * @param {string} selected_value Selected identifier.
		 * @param {string} fallback_label Fallback when no record matches.
		 * @return {string} Selected display label.
		 */
		function get_option_label( options, selected_value, fallback_label ) {
			var selected_label = fallback_label || selected_value;

			( options || [] ).some( function ( option ) {
				if ( String( option.id ) === String( selected_value ) ) {
					selected_label = option.label;
					return true;
				}
				return false;
			} );

			return selected_label;
		}

		/**
		 * Return the decorative icon for one Timeline cell scale.
		 *
		 * @param {string} view_id Timeline view identifier.
		 * @return {string} Booking Calendar icon class.
		 */
		function get_timeline_scale_icon_class( view_id ) {
			if ( 'day' === String( view_id ) ) {
				return 'wpbc-bi-calendar3';
			}
			if ( -1 !== String( view_id ).indexOf( 'minutes' ) ) {
				return 'wpbc-bi-stopwatch';
			}
			return 'wpbc-bi-clock';
		}

		/**
		 * Render exact Timeline-owned range-and-scale options through shared UI.
		 *
		 * @return {void}
		 */
		function render_toolbar_dropdown() {
			var host = mount.querySelector( '[data-wpbc-timeline-advanced-combination-dropdown]' );
			var selected_value = get_matching_range_scale_option_value();
			var selected_option = get_range_scale_option( selected_value );
			var current_view = settings.current_axis && settings.current_axis.view ? settings.current_axis.view : settings.axis.view;
			var current_group = '';
			var custom_label = format_custom_range_label(
				settings.i18n.custom_range,
				get_option_label( settings.metadata.views, current_view, current_view )
			);
			var options = [ {
				type: 'option',
				value: 'custom',
				label: custom_label,
				icon_class: get_timeline_scale_icon_class( current_view ),
				disabled: true
			} ];

			( settings.metadata.range_scale_options || [] ).forEach( function ( range_scale_option ) {
				if ( current_group !== String( range_scale_option.preset_id ) ) {
					current_group = String( range_scale_option.preset_id );
					options.push( { type: 'separator' } );
					options.push( { type: 'heading', label: range_scale_option.preset_title } );
				}
				options.push( {
					type: 'option',
					value: range_scale_option.value,
					label: range_scale_option.title,
					icon_class: get_timeline_scale_icon_class( range_scale_option.view_id ),
					disabled: false
				} );
			} );
			render_shared_ui_template( host, 'dropdown', {
				id: 'wpbc_timeline_advanced_combination',
				label: settings.i18n.advanced_combination_label,
				described_by: 'wpbc_timeline_advanced_combination_description',
				selected_value: selected_value,
				selected_label: selected_option ? selected_option.title : custom_label,
				icon_class: get_timeline_scale_icon_class( current_view ),
				options: options
			} );
		}

		/**
		 * Shift one strict ISO date by whole UTC calendar days.
		 *
		 * @param {string} iso_date YYYY-MM-DD date.
		 * @param {number} day_count Signed day count.
		 * @return {string} Shifted YYYY-MM-DD date, or an empty string.
		 */
		function shift_iso_date( iso_date, day_count ) {
			var match = String( iso_date || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var shifted_date;

			if ( ! match ) {
				return '';
			}
			shifted_date = new Date( Date.UTC( Number( match[ 1 ] ), Number( match[ 2 ] ) - 1, Number( match[ 3 ] ) + day_count ) );
			return shifted_date.getUTCFullYear() + '-' + ( '0' + String( shifted_date.getUTCMonth() + 1 ) ).slice( -2 ) + '-' + ( '0' + String( shifted_date.getUTCDate() ) ).slice( -2 );
		}

		/**
		 * Return inclusive date values for the current half-open server axis.
		 *
		 * @return {Object} Inclusive start and end YYYY-MM-DD values.
		 */
		function get_current_axis_date_range() {
			var axis = settings.current_axis || settings.axis || {};
			var start_date = String( axis.start_at || '' ).slice( 0, 10 );
			var exclusive_end_date = String( axis.end_at || '' ).slice( 0, 10 );

			return {
				start_date: start_date,
				end_date: shift_iso_date( exclusive_end_date, -1 )
			};
		}

		/**
		 * Render Timeline dates through the shared range-navigation component.
		 *
		 * @return {void}
		 */
		function render_date_range_navigation() {
			var host = mount.querySelector( '[data-wpbc-timeline-date-range-navigation]' );
			var date_range = get_current_axis_date_range();

			render_shared_ui_template( host, 'date_range_navigation', {
				id: 'wpbc_timeline_date_range',
				range_label: settings.current_axis && settings.current_axis.range_label ? settings.current_axis.range_label : settings.axis.range_label,
				start_date: date_range.start_date,
				end_date: date_range.end_date,
				first_day: settings.shared_ui ? Number( settings.shared_ui.first_day ) || 0 : 0,
				maximum_span_days: settings.metadata && settings.metadata.limits ? Number( settings.metadata.limits.maximum_window_days ) || 62 : 62,
				previous_label: settings.i18n.previous_window,
				next_label: settings.i18n.next_window,
				dialog_label: settings.i18n.choose_date_range,
				start_label: settings.i18n.start_date,
				end_label: settings.i18n.end_date,
				apply_label: settings.i18n.apply_date_range,
				reset_label: settings.i18n.reset_date_range,
				cancel_label: settings.i18n.cancel,
				invalid_message: settings.i18n.invalid_date_range,
				maximum_message: settings.i18n.maximum_date_range
			} );
		}

		/**
		 * Render the shared Today/single-date split control.
		 *
		 * @return {void}
		 */
		function render_date_jump() {
			var host = mount.querySelector( '[data-wpbc-timeline-date-jump]' );

			render_shared_ui_template( host, 'date_jump', {
				id: 'wpbc_timeline_date_jump',
				action_label: settings.i18n.today,
				choose_date_label: settings.i18n.choose_jump_date,
				date_label: settings.i18n.jump_date,
				selected_date: settings.shared_ui ? String( settings.shared_ui.today_date || '' ) : '',
				first_day: settings.shared_ui ? Number( settings.shared_ui.first_day ) || 0 : 0
			} );
		}

		/**
		 * Render the Timeline Reset action through the shared control button.
		 *
		 * @return {void}
		 */
		function render_reset_preferences_button() {
			var host = mount.querySelector( '[data-wpbc-timeline-reset-preferences-host]' );

			render_shared_ui_template( host, 'context_popover_button', {
				id: 'wpbc_timeline_reset_preferences',
				label: settings.i18n.reset_timeline,
				description: settings.i18n.reset_timeline_description,
				icon_class: 'wpbc_icn_refresh',
				disabled: false
			} );
		}

		/**
		 * Synchronize rendered range values without replacing focused markup.
		 *
		 * @return {void}
		 */
		function synchronize_date_range_navigation() {
			var root = mount.querySelector( '[data-wpbc-shared-ui-date-range-navigation="wpbc_timeline_date_range"]' );
			var range_label = root ? root.querySelector( '[data-wpbc-shared-ui-date-range-label]' ) : null;
			var start_input = root ? root.querySelector( '[data-wpbc-shared-ui-date-range-start]' ) : null;
			var end_input = root ? root.querySelector( '[data-wpbc-shared-ui-date-range-end]' ) : null;
			var date_range = get_current_axis_date_range();

			if ( ! root ) {
				return;
			}
			if ( range_label ) {
				range_label.textContent = settings.current_axis && settings.current_axis.range_label ? settings.current_axis.range_label : settings.axis.range_label;
			}
			root.setAttribute( 'data-start-date', date_range.start_date );
			root.setAttribute( 'data-end-date', date_range.end_date );
			if ( root.querySelector( '[data-wpbc-shared-ui-popover].is-open' ) ) {
				return;
			}
			if ( start_input ) {
				start_input.value = date_range.start_date;
			}
			if ( end_input ) {
				end_input.value = date_range.end_date;
			}
		}

		/**
		 * Synchronize a shared dropdown without replacing its focused DOM.
		 *
		 * @param {HTMLElement|null} dropdown_root Shared dropdown root.
		 * @param {string} selected_value Selected option value.
		 * @param {boolean} is_disabled Whether the trigger is disabled.
		 * @param {Array<string>} disabled_values Option values to disable.
		 * @return {void}
		 */
		function synchronize_shared_dropdown( dropdown_root, selected_value, is_disabled, disabled_values ) {
			var trigger;
			var panel;
			var value_label;
			var hidden_input;
			var selected_option = null;

			if ( ! dropdown_root ) {
				return;
			}
			trigger = dropdown_root.querySelector( '[data-wpbc-shared-ui-dropdown-trigger]' );
			panel = dropdown_root.querySelector( '[data-wpbc-shared-ui-dropdown-panel]' );
			value_label = dropdown_root.querySelector( '[data-wpbc-shared-ui-dropdown-label]' );
			hidden_input = dropdown_root.querySelector( '[data-wpbc-shared-ui-dropdown-input]' );
			dropdown_root.setAttribute( 'data-wpbc-shared-ui-dropdown-value', selected_value );
			Array.prototype.forEach.call( dropdown_root.querySelectorAll( '[data-wpbc-shared-ui-dropdown-option]' ), function ( option ) {
				var option_value = option.getAttribute( 'data-value' ) || '';
				var is_selected = option_value === selected_value;
				var option_disabled = -1 !== disabled_values.indexOf( option_value );

				option.classList.toggle( 'is-selected', is_selected );
				option.setAttribute( 'aria-selected', is_selected ? 'true' : 'false' );
				option.disabled = option_disabled;
				option.setAttribute( 'aria-disabled', option_disabled ? 'true' : 'false' );
				if ( is_selected ) {
					selected_option = option;
				}
			} );
			if ( trigger ) {
				trigger.disabled = is_disabled;
				if ( is_disabled ) {
					trigger.setAttribute( 'aria-expanded', 'false' );
				}
			}
			if ( panel && is_disabled ) {
				panel.hidden = true;
				dropdown_root.classList.remove( 'is-open' );
			}
			if ( value_label && selected_option ) {
				value_label.textContent = selected_option.textContent.trim();
			}
			if ( hidden_input ) {
				hidden_input.value = selected_value;
			}
		}

		/**
		 * Apply the server axis dimensions and presentation-only density.
		 *
		 * @return {void}
		 */
		function apply_axis_dimensions() {
			var timeline = mount.querySelector( '.wpbc_timeline' );
			var window_loading = settings.metadata && settings.metadata.window_loading ? settings.metadata.window_loading : {};
			var base_cell_width;
			var visual_cell_width;

			if ( ! timeline || ! settings.axis ) {
				return;
			}
			base_cell_width = Number( settings.axis.cell_width_px ) || 96;
			visual_cell_width = Math.max( 1, Math.round( base_cell_width * visual_zoom_percent / 100 ) );
			timeline.style.setProperty( '--wpbc-timeline-cells', Number( settings.axis.cell_count ) || 1 );
			timeline.style.setProperty( '--wpbc-timeline-cell-width', visual_cell_width + 'px' );
			timeline.style.setProperty( '--wpbc-timeline-visual-zoom', visual_zoom_percent );
			timeline.style.setProperty( '--wpbc_timeline_general__resource-header-height', ( Number( settings.axis.header_height_px ) || 96 ) + 'px' );
			timeline.style.setProperty( '--wpbc_timeline_general__edge-placeholder-cells', Math.max( 1, Number( window_loading.edge_placeholder_cells ) || 3 ) );
		}

		/**
		 * Select compact vertical timed labels only when localized text is clipped.
		 *
		 * @return {void}
		 */
		function synchronize_time_label_presentation() {
			var timeline = mount.querySelector( '.wpbc_timeline' );
			var time_labels;
			var has_overflow = false;

			if ( ! timeline ) {
				return;
			}
			timeline.classList.remove( 'has-vertical-time-labels' );
			if ( ! settings.axis || ! settings.axis.is_timed ) {
				return;
			}
			time_labels = timeline.querySelectorAll( '.wpbc_timeline__time_label, .wpbc_timeline__offset_label' );
			Array.prototype.some.call( time_labels, function ( time_label ) {
				has_overflow = time_label.scrollWidth > time_label.clientWidth;
				return has_overflow;
			} );
			timeline.classList.toggle( 'has-vertical-time-labels', has_overflow );
		}

		/**
		 * Normalize a requested visual cell-width percentage.
		 *
		 * @param {number|string} requested_percent Untrusted range-control value.
		 * @return {number} Bounded percentage aligned to the configured step.
		 */
		function normalize_visual_zoom_percent( requested_percent ) {
			var normalized_percent = Number( requested_percent );

			if ( ! Number.isFinite( normalized_percent ) ) {
				return visual_zoom_percent;
			}
			normalized_percent = Math.max( visual_zoom_configuration.min_percent, Math.min( visual_zoom_configuration.max_percent, normalized_percent ) );
			normalized_percent = visual_zoom_configuration.min_percent + Math.round( ( normalized_percent - visual_zoom_configuration.min_percent ) / visual_zoom_configuration.step_percent ) * visual_zoom_configuration.step_percent;

			return Math.min( visual_zoom_configuration.max_percent, normalized_percent );
		}

		/**
		 * Synchronize the density range and its visible value.
		 *
		 * @return {void}
		 */
		function update_visual_zoom_controls() {
			var status = mount.querySelector( '[data-wpbc-timeline-visual-zoom-status]' );
			var range = mount.querySelector( '[data-wpbc-timeline-visual-zoom-range]' );

			if ( status ) {
				status.textContent = visual_zoom_percent + '%';
			}
			if ( range ) {
				range.min = visual_zoom_configuration.min_percent;
				range.max = visual_zoom_configuration.max_percent;
				range.step = visual_zoom_configuration.step_percent;
				range.value = visual_zoom_percent;
				range.setAttribute( 'aria-valuetext', visual_zoom_percent + '%' );
			}
		}

		/**
		 * Change only the rendered cell width and retain the visible instant.
		 *
		 * @param {number|string} requested_percent Requested visual width percentage.
		 * @return {void}
		 */
		function change_visual_zoom( requested_percent ) {
			var next_percent = normalize_visual_zoom_percent( requested_percent );

			if ( next_percent === visual_zoom_percent ) {
				update_visual_zoom_controls();
				return;
			}
			if ( ! visual_zoom_anchor ) {
				invoke_callback( 'cancel_anchor_restoration' );
				visual_zoom_anchor = window_cache ? window_cache.capture_axis_anchor() : null;
				invoke_callback( 'suspend_adjacent_loading' );
			}
			visual_zoom_percent = next_percent;
			update_visual_zoom_controls();
			if ( visual_zoom_frame ) {
				return;
			}
			visual_zoom_frame = window.requestAnimationFrame( function () {
				if ( ! is_initialized ) {
					visual_zoom_frame = 0;
					visual_zoom_anchor = null;
					return;
				}
				apply_axis_dimensions();
				synchronize_time_label_presentation();
				if ( window_cache && visual_zoom_anchor ) {
					window_cache.restore_axis_anchor( visual_zoom_anchor );
				}
				visual_zoom_anchor = null;
				visual_zoom_frame = 0;
				invoke_callback( 'schedule_overflow_tooltips' );
				invoke_callback( 'schedule_edge_status' );
				invoke_callback( 'schedule_booking_layout' );
			} );
		}

		/**
		 * Preview a density range value without repeated announcements.
		 *
		 * @param {Event} event Range input event.
		 * @return {void}
		 */
		function handle_visual_zoom_input( event ) {
			var range = event.target.closest( '[data-wpbc-timeline-visual-zoom-range]' );

			if ( range ) {
				change_visual_zoom( range.value );
			}
		}

		/**
		 * Announce the committed density value.
		 *
		 * @param {Event} event Range change event.
		 * @return {void}
		 */
		function handle_visual_zoom_change( event ) {
			var range = event.target.closest( '[data-wpbc-timeline-visual-zoom-range]' );

			if ( ! range ) {
				return;
			}
			change_visual_zoom( range.value );
			invoke_callback( 'announce', String( settings.i18n.visual_zoom_updated || '' ).replace( '{percent}', visual_zoom_percent ) );
			invoke_callback( 'save_preferences' );
		}

		/**
		 * Cancel an active empty-range proposal before replacing navigation state.
		 *
		 * @return {void}
		 */
		function cancel_active_selection() {
			invoke_callback( 'cancel_active_selection' );
		}

		/**
		 * Navigate to the current instant without changing range or scale.
		 *
		 * @return {void}
		 */
		function navigate_to_today() {
			var navigation = window_cache ? window_cache.resolve_today_navigation() : null;
			var anchor;

			if ( ! navigation ) {
				return;
			}
			anchor = navigation.anchor;
			cancel_active_selection();
			if ( navigation.is_loaded && invoke_callback( 'restore_loaded_anchor', anchor, { refresh_today: true } ) ) {
				invoke_callback( 'save_preferences', {
					anchor_date: settings.shared_ui.today_date,
					anchor_ratio: navigation.anchor_ratio
				} );
				return;
			}
			invoke_callback( 'request_window', invoke_callback( 'add_current_window_span', {
				anchor_at: anchor.at,
				anchor_ratio: navigation.anchor_ratio,
				window_position: 0,
				view: settings.current_axis ? settings.current_axis.view : settings.axis.view
			}, false ), anchor, true, {
				loading: settings.i18n.loading_today,
				complete: settings.i18n.status_ready,
				persist_preferences: true
			} );
		}

		/**
		 * Navigate to one strict site-local date without changing range or scale.
		 *
		 * @param {string} iso_date Strict YYYY-MM-DD date.
		 * @return {void}
		 */
		function navigate_to_date( iso_date ) {
			var anchor;
			var anchor_ratio;

			if ( shift_iso_date( iso_date, 0 ) !== iso_date ) {
				return;
			}
			cancel_active_selection();
			anchor_ratio = window_cache ? window_cache.get_today_request_anchor_ratio() : 0;
			anchor = window_cache ? window_cache.create_loaded_date_anchor( iso_date ) : null;
			if ( anchor && invoke_callback( 'restore_loaded_anchor', anchor, { announcement: settings.i18n.selected_date_loaded } ) ) {
				invoke_callback( 'save_preferences', {
					anchor_date: iso_date,
					anchor_ratio: anchor_ratio
				} );
				return;
			}
			anchor = {
				at: iso_date + 'T00:00:00+00:00',
				ratio: anchor_ratio,
				leading_cells_before: 1,
				restore_focus: false,
				target_date: iso_date
			};
			invoke_callback( 'request_window', invoke_callback( 'add_current_window_span', {
				anchor_date: iso_date,
				anchor_ratio: anchor_ratio,
				window_position: 0,
				view: settings.current_axis ? settings.current_axis.view : settings.axis.view
			}, false ), anchor, true, {
				loading: settings.i18n.loading_selected_date,
				complete: settings.i18n.selected_date_loaded,
				persist_preferences: true
			} );
		}

		/**
		 * Load the previous or next server-authorized Timeline window.
		 *
		 * @param {string} direction Previous or next.
		 * @return {boolean} True when a valid navigation request was dispatched.
		 */
		function navigate_timeline_window( direction ) {
			var anchor;
			var current_axis = settings.current_axis ? settings.current_axis : settings.axis;

			if ( 'previous' !== direction && 'next' !== direction ) {
				return false;
			}
			anchor = {
				at: current_axis.start_at,
				ratio: 0,
				leading_cells_before: 0,
				restore_focus: false,
				use_response_start: true
			};
			invoke_callback( 'request_window', invoke_callback( 'add_current_window_span', {
				anchor_at: current_axis.start_at,
				window_position: 'previous' === direction ? -1 : 1,
				view: settings.current_axis ? settings.current_axis.view : settings.axis.view
			}, false ), anchor, true, {
				loading: 'previous' === direction ? settings.i18n.loading_previous_window : settings.i18n.loading_next_window,
				complete: settings.i18n.status_ready,
				persist_preferences: true
			} );

			return true;
		}

		/**
		 * Apply one server-declared range-and-scale selection.
		 *
		 * @param {string} selected_value Stable opaque option value.
		 * @return {boolean} True when the option was recognized and dispatched.
		 */
		function apply_range_scale_option( selected_value ) {
			var selected_option = get_range_scale_option( selected_value );
			var anchor;
			var request_values;

			if ( ! selected_option ) {
				return false;
			}
			anchor = window_cache ? window_cache.capture_axis_anchor() : { at: settings.axis.anchor.at, ratio: 0.5 };
			request_values = {
				anchor_at: anchor.at,
				anchor_ratio: anchor.ratio,
				window_position: 0,
				view: selected_option.view_id
			};
			if ( 0 < Number( selected_option.window_months ) ) {
				request_values.window_months = Number( selected_option.window_months );
			} else {
				request_values.window_days = Number( selected_option.window_days );
			}
			invoke_callback( 'request_window', request_values, anchor, true, {
				loading: settings.i18n.loading_timeline_combination,
				complete: settings.i18n.combination_loaded,
				persist_preferences: true
			} );

			return true;
		}

		/**
		 * Apply one strict inclusive custom date range.
		 *
		 * UTC calendar arithmetic validates civil dates without applying the browser
		 * timezone or a daylight-saving offset. PHP still independently validates
		 * the authorized axis, Resource scope, and payload budgets.
		 *
		 * @param {string} start_date Inclusive YYYY-MM-DD start.
		 * @param {string} end_date Inclusive YYYY-MM-DD end.
		 * @return {boolean} True when a valid request was dispatched.
		 */
		function apply_custom_date_range( start_date, end_date ) {
			var maximum_span_days = settings.metadata && settings.metadata.limits ? Number( settings.metadata.limits.maximum_window_days ) || 62 : 62;
			var start_match = String( start_date || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var end_match = String( end_date || '' ).match( /^(\d{4})-(\d{2})-(\d{2})$/ );
			var start_epoch;
			var end_epoch;
			var span_days;
			var anchor;

			if ( ! start_match || ! end_match || shift_iso_date( start_date, 0 ) !== start_date || shift_iso_date( end_date, 0 ) !== end_date ) {
				return false;
			}
			start_epoch = Date.UTC( Number( start_match[ 1 ] ), Number( start_match[ 2 ] ) - 1, Number( start_match[ 3 ] ) );
			end_epoch = Date.UTC( Number( end_match[ 1 ] ), Number( end_match[ 2 ] ) - 1, Number( end_match[ 3 ] ) );
			span_days = Math.round( ( end_epoch - start_epoch ) / 86400000 ) + 1;
			if ( span_days < 1 || span_days > maximum_span_days || shift_iso_date( start_date, span_days - 1 ) !== end_date ) {
				return false;
			}
			anchor = {
				at: start_date + 'T00:00:00+00:00',
				ratio: 0,
				leading_cells_before: 0,
				restore_focus: false,
				use_response_start: true
			};
			invoke_callback( 'request_window', {
				anchor_date: start_date,
				anchor_ratio: 0,
				window_position: 0,
				window_days: span_days,
				view: settings.current_axis ? settings.current_axis.view : settings.axis.view
			}, anchor, true, {
				loading: settings.i18n.loading_date_range,
				complete: settings.i18n.status_ready,
				persist_preferences: true
			} );

			return true;
		}

		/**
		 * Restore configured toolbar defaults and refresh at the site-local today.
		 *
		 * Persistence is reset first by the page-controller callback. This method
		 * applies only the server-declared default request and presentation density;
		 * Resource selection and hierarchy state remain outside its ownership.
		 *
		 * @return {boolean} True when the default window request was dispatched.
		 */
		function reset_to_defaults() {
			var default_request = settings.metadata && settings.metadata.default_window_request
				? settings.metadata.default_window_request
				: {};
			var today_date = settings.shared_ui ? String( settings.shared_ui.today_date || '' ) : '';
			var anchor_ratio = window_cache ? window_cache.get_today_request_anchor_ratio() : 0;
			var request_values;
			var request_result;
			var anchor;

			if (
				shift_iso_date( today_date, 0 ) !== today_date
				|| ! default_request.view
				|| ( ! Number( default_request.window_days ) && ! Number( default_request.window_months ) )
			) {
				return false;
			}

			cancel_active_selection();
			change_visual_zoom( visual_zoom_configuration.configured_default_percent );
			invoke_callback( 'set_preference_anchor', today_date, anchor_ratio );
			anchor = {
				at: today_date + 'T00:00:00+00:00',
				ratio: anchor_ratio,
				leading_cells_before: 1,
				restore_focus: false,
				target_date: today_date
			};
			request_values = {
				anchor_date: today_date,
				anchor_ratio: anchor_ratio,
				window_position: 0,
				view: String( default_request.view )
			};
			if ( 0 < Number( default_request.window_months ) ) {
				request_values.window_months = Number( default_request.window_months );
			} else {
				request_values.window_days = Number( default_request.window_days );
			}

			request_result = invoke_callback( 'request_window', request_values, anchor, true, {
				loading: settings.i18n.resetting_timeline,
				complete: settings.i18n.timeline_reset,
				persist_preferences: false
			} );

			return Boolean( request_result );
		}

		/**
		 * Handle shared Timeline toolbar events.
		 *
		 * @param {CustomEvent} event Shared component event.
		 * @return {void}
		 */
		function handle_shared_event( event ) {
			var detail = event.detail && 'object' === typeof event.detail ? event.detail : {};
			var component_id = String( detail.id || '' );

			if ( 'wpbc:shared-ui-dropdown-change' === event.type && 'wpbc_timeline_advanced_combination' === component_id ) {
				apply_range_scale_option( String( detail.value || '' ) );
			} else if ( 'wpbc:shared-ui-date-range-shift' === event.type && 'wpbc_timeline_date_range' === component_id ) {
				navigate_timeline_window( String( detail.direction || '' ) );
			} else if ( 'wpbc:shared-ui-date-range-apply' === event.type && 'wpbc_timeline_date_range' === component_id ) {
				apply_custom_date_range( String( detail.start_date || '' ), String( detail.end_date || '' ) );
			} else if ( 'wpbc:shared-ui-date-jump-action' === event.type && 'wpbc_timeline_date_jump' === component_id ) {
				navigate_to_today();
			} else if ( 'wpbc:shared-ui-date-jump-select' === event.type && 'wpbc_timeline_date_jump' === component_id ) {
				navigate_to_date( String( detail.date || '' ) );
			}
		}

		/**
		 * Handle previous/next controls delegated by the page controller.
		 *
		 * @param {MouseEvent} event Browser click event.
		 * @return {boolean} True when this module consumed the click.
		 */
		function handle_click( event ) {
			var window_button = event.target.closest( '[data-wpbc-timeline-window]' );
			var reset_button = event.target.closest( '[data-wpbc-shared-ui-context-popover-button="wpbc_timeline_reset_preferences"]' );

			if ( reset_button ) {
				if ( 'true' === reset_button.getAttribute( 'aria-disabled' ) ) {
					return true;
				}
				invoke_callback( 'reset_preferences', reset_button );
				return true;
			}

			return Boolean( window_button && navigate_timeline_window( window_button.getAttribute( 'data-wpbc-timeline-window' ) ) );
		}

		/**
		 * Move focus between server-defined axis cells with RTL-aware arrows.
		 *
		 * @param {KeyboardEvent} event Key event from the axis.
		 * @return {boolean} True when this module consumed the key.
		 */
		function handle_keydown( event ) {
			var cell = event.target.closest( '[data-wpbc-timeline-axis-cell]' );
			var cells;
			var current_index;
			var requested_index;
			var next_index;
			var direction;

			if ( ! cell || -1 === [ 'ArrowLeft', 'ArrowRight', 'Home', 'End' ].indexOf( event.key ) ) {
				return false;
			}
			cells = mount.querySelectorAll( '[data-wpbc-timeline-axis-cell]' );
			current_index = Array.prototype.indexOf.call( cells, cell );
			if ( 0 > current_index ) {
				return false;
			}
			if ( 'Home' === event.key ) {
				requested_index = 0;
			} else if ( 'End' === event.key ) {
				requested_index = cells.length - 1;
			} else {
				requested_index = current_index + ( 'ArrowRight' === event.key ? 1 : -1 ) * ( settings.is_rtl ? -1 : 1 );
			}
			next_index = Math.max( 0, Math.min( cells.length - 1, requested_index ) );
			if ( next_index === current_index ) {
				if ( -1 !== [ 'ArrowLeft', 'ArrowRight' ].indexOf( event.key ) && requested_index !== current_index ) {
					direction = 0 > requested_index ? 'previous' : 'next';
					if ( invoke_callback( 'activate_adjacent_intent', direction, false ) ) {
						invoke_callback( 'request_adjacent_window', direction );
						event.preventDefault();
						return true;
					}
				}
				return false;
			}
			direction = next_index < current_index ? 'previous' : 'next';
			invoke_callback( 'activate_adjacent_intent', direction, false );
			event.preventDefault();
			cell.setAttribute( 'tabindex', '-1' );
			cells[ next_index ].setAttribute( 'tabindex', '0' );
			cells[ next_index ].focus();
			cells[ next_index ].scrollIntoView( { block: 'nearest', inline: 'nearest' } );
			invoke_callback( 'synchronize_axis_scroll' );

			return true;
		}

		/**
		 * Render all shared toolbar controls once after the shell mounts.
		 *
		 * @return {void}
		 */
		function render_controls() {
			render_toolbar_dropdown();
			render_date_range_navigation();
			render_date_jump();
			render_reset_preferences_button();
		}

		/**
		 * Synchronize controls and dimensions after an authorized window render.
		 *
		 * @return {void}
		 */
		function refresh_after_window_render() {
			var dropdown = mount.querySelector( '[data-wpbc-shared-ui-dropdown="wpbc_timeline_advanced_combination"]' );

			synchronize_date_range_navigation();
			synchronize_shared_dropdown( dropdown, get_matching_range_scale_option_value(), false, [ 'custom' ] );
			apply_axis_dimensions();
			synchronize_time_label_presentation();
			update_visual_zoom_controls();
		}

		/**
		 * Initialize owned shared-control event listeners once.
		 *
		 * @return {void}
		 */
		function initialize() {
			if ( is_initialized || ! mount ) {
				return;
			}
			is_initialized = true;
			mount.addEventListener( 'input', handle_visual_zoom_input );
			mount.addEventListener( 'change', handle_visual_zoom_change );
			mount.addEventListener( 'wpbc:shared-ui-dropdown-change', handle_shared_event );
			mount.addEventListener( 'wpbc:shared-ui-date-range-shift', handle_shared_event );
			mount.addEventListener( 'wpbc:shared-ui-date-range-apply', handle_shared_event );
			mount.addEventListener( 'wpbc:shared-ui-date-jump-action', handle_shared_event );
			mount.addEventListener( 'wpbc:shared-ui-date-jump-select', handle_shared_event );
		}

		/**
		 * Remove owned listeners and cancel pending density work.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! is_initialized ) {
				return;
			}
			mount.removeEventListener( 'input', handle_visual_zoom_input );
			mount.removeEventListener( 'change', handle_visual_zoom_change );
			mount.removeEventListener( 'wpbc:shared-ui-dropdown-change', handle_shared_event );
			mount.removeEventListener( 'wpbc:shared-ui-date-range-shift', handle_shared_event );
			mount.removeEventListener( 'wpbc:shared-ui-date-range-apply', handle_shared_event );
			mount.removeEventListener( 'wpbc:shared-ui-date-jump-action', handle_shared_event );
			mount.removeEventListener( 'wpbc:shared-ui-date-jump-select', handle_shared_event );
			if ( visual_zoom_frame ) {
				window.cancelAnimationFrame( visual_zoom_frame );
			}
			visual_zoom_frame = 0;
			visual_zoom_anchor = null;
			is_initialized = false;
		}

		/**
		 * Return the current presentation-only cell-width percentage.
		 *
		 * This public diagnostic is intentionally read-only and does not expose or
		 * modify authoritative Timeline request state.
		 *
		 * @return {number} Current bounded visual density percentage.
		 */
		function get_visual_zoom_percent() {
			return visual_zoom_percent;
		}

		return {
			initialize: initialize,
			destroy: destroy,
			render_controls: render_controls,
			refresh_after_window_render: refresh_after_window_render,
			handle_click: handle_click,
			handle_keydown: handle_keydown,
			apply_range_scale_option: apply_range_scale_option,
			apply_custom_date_range: apply_custom_date_range,
			reset_to_defaults: reset_to_defaults,
			navigate_to_today: navigate_to_today,
			navigate_to_date: navigate_to_date,
			change_visual_zoom: change_visual_zoom,
			get_visual_zoom_percent: get_visual_zoom_percent
		};
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_toolbar_navigation_controller );
	}
}( window, document, window.wp ) );
