/**
 * Drive the Setup Wizard Date Selection editor and real calendar preview.
 *
 * Canonical Booking Calendar helpers remain responsible for selection rules.
 * This adapter changes only request-local calendar parameters and draft fields;
 * it does not save settings or submit a booking.
 *
 * @package Booking Calendar
 */
( function ( window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_date_selection || { i18n: {} };

	/**
	 * Create one isolated Date Selection step adapter.
	 *
	 * @param {Object} config Localized limits and messages.
	 * @return {Object} Adapter accepted by the shared wizard shell.
	 */
	function create_date_selection_adapter( config ) {
		var shell_api = null;
		var editor = null;
		var apply_timers = [];
		var preview_data_timer = null;
		var last_selected_mode = '';

		/**
		 * Return one localized message with a safe fallback.
		 *
		 * @param {string} key      Translation key.
		 * @param {string} fallback Fallback message.
		 * @return {string} Translation or fallback.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? String( config.i18n[ key ] ) : fallback;
		}

		/**
		 * Return the selected mode identifier.
		 *
		 * @return {string} Selected mode or an empty string.
		 */
		function get_selected_mode() {
			var selected = get_selected_mode_control();

			return selected ? selected.value : '';
		}

		/**
		 * Return the selected server-authorized mode control.
		 *
		 * @return {HTMLElement|null} Selected radio control or null.
		 */
		function get_selected_mode_control() {
			return editor ? editor.node.querySelector( '[data-wpbc-date-selection-mode]:checked' ) : null;
		}

		/**
		 * Read one dependent-setting state from the selected mode policy.
		 *
		 * @param {string} setting_name Policy setting name in camel case.
		 * @return {string} Policy state or `hidden_off`.
		 */
		function get_mode_policy_state( setting_name ) {
			var selected_mode_control = get_selected_mode_control();

			if ( ! selected_mode_control || ! selected_mode_control.dataset[ setting_name ] ) {
				return 'hidden_off';
			}

			return String( selected_mode_control.dataset[ setting_name ] );
		}

		/**
		 * Apply defaults only when the customer changes the Date Selection mode.
		 *
		 * Time-based Customer Journeys default recurrent selected-time behavior to
		 * on for Multiple days, while leaving the visible option editable afterward.
		 * Tracking the previous mode prevents later synchronization from overwriting
		 * an explicit customer choice.
		 *
		 * @param {HTMLElement|null} mode_control Changed mode radio control.
		 * @return {void}
		 */
		function apply_selected_mode_defaults( mode_control ) {
			var selected_mode;
			var recurrent_policy;
			var recurrent_toggle;

			if ( ! editor || ! mode_control || ! mode_control.checked ) {
				return;
			}

			selected_mode = String( mode_control.value || '' );
			if ( selected_mode === last_selected_mode ) {
				return;
			}
			last_selected_mode = selected_mode;
			recurrent_policy = String( mode_control.dataset.wpbcDateSelectionPolicyRecurrentTime || '' );
			if ( 'optional_default_on' !== recurrent_policy ) {
				return;
			}

			recurrent_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_recurrent_time"]' );
			if ( recurrent_toggle ) {
				recurrent_toggle.checked = true;
			}
		}

		/**
		 * Parse one bounded integer control.
		 *
		 * @param {string} selector Control selector below the editor.
		 * @param {number} fallback Value used for an absent or invalid control.
		 * @return {number} Parsed integer.
		 */
		function get_integer( selector, fallback ) {
			var control = editor ? editor.node.querySelector( selector ) : null;
			var parsed = control ? parseInt( control.value, 10 ) : NaN;

			return isNaN( parsed ) ? fallback : parsed;
		}

		/**
		 * Convert one weekday transport field to the canonical number array.
		 *
		 * @param {string} mode Range mode owning the transport field.
		 * @return {number[]} Weekday numbers or the unrestricted marker.
		 */
		function get_weekdays( mode ) {
			var transport = editor ? editor.node.querySelector( '[data-wpbc-date-selection-weekday-transport="' + mode + '"]' ) : null;
			var values = transport ? String( transport.value || '' ).split( ',' ) : [];
			var weekdays = values.map( function ( value ) {
				return parseInt( value, 10 );
			} ).filter( function ( value ) {
				return -1 === value || ( value >= 0 && value <= 6 );
			} );

			return weekdays.length ? weekdays : [ -1 ];
		}

		/**
		 * Parse the released comma-and-range syntax into canonical day lengths.
		 *
		 * This intentionally mirrors the server validator instead of evaluating
		 * input text. An empty expression means that every length within the
		 * configured minimum and maximum is allowed.
		 *
		 * @param {string} raw_specific_days Untrusted text field value.
		 * @return {number[]|null} Sorted unique lengths, an empty array, or null when invalid.
		 */
		function parse_specific_days( raw_specific_days ) {
			var maximum_days = parseInt( config.max_dynamic_days || 1095, 10 );
			var specific_expression = String( raw_specific_days || '' ).trim();
			var specific_days = [];

			if ( '' === specific_expression ) {
				return specific_days;
			}
			if (
				specific_expression.length > 500
				|| ! /^\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*$/.test( specific_expression )
			) {
				return null;
			}

			specific_expression.split( ',' ).forEach( function ( specific_part ) {
				var range_bounds = specific_part.trim().split( /\s*-\s*/ ).map( function ( range_bound ) {
					return parseInt( range_bound, 10 );
				} );
				var range_start = Math.min.apply( null, range_bounds );
				var range_end = Math.max.apply( null, range_bounds );
				var specific_day;

				if ( null === specific_days ) {
					return;
				}

				if ( range_start < 1 || range_end > maximum_days ) {
					specific_days = null;
					return;
				}

				for ( specific_day = range_start; specific_day <= range_end; specific_day++ ) {
					if ( -1 === specific_days.indexOf( specific_day ) ) {
						specific_days.push( specific_day );
					}
				}
			} );

			return null === specific_days ? null : specific_days.sort( function ( first_day, second_day ) {
				return first_day - second_day;
			} );
		}

		/**
		 * Return the specific flexible-range lengths from the current editor.
		 *
		 * @return {number[]|null} Canonical lengths, an empty array, or null when invalid.
		 */
		function get_specific_days() {
			var control = editor ? editor.node.querySelector( '[data-wpbc-date-selection-specific]' ) : null;

			return parse_specific_days( control ? control.value : '' );
		}

		/**
		 * Write visible weekday button state into its scalar transport field.
		 *
		 * @param {string} mode Range mode owning the controls.
		 * @return {void}
		 */
		function sync_weekday_transport( mode ) {
			var group = editor ? editor.node.querySelector( '[data-wpbc-date-selection-weekdays="' + mode + '"]' ) : null;
			var transport = editor ? editor.node.querySelector( '[data-wpbc-date-selection-weekday-transport="' + mode + '"]' ) : null;
			var selected = [];

			if ( ! group || ! transport ) {
				return;
			}

			group.querySelectorAll( '[data-weekday][aria-pressed="true"]' ).forEach( function ( button ) {
				selected.push( parseInt( button.dataset.weekday, 10 ) );
			} );
			selected = selected.filter( function ( value ) {
				return ! isNaN( value ) && value >= 0 && value <= 6;
			} ).sort( function ( first_value, second_value ) {
				return first_value - second_value;
			} );

			transport.value = 7 === selected.length || 0 === selected.length ? '-1' : selected.join( ',' );
		}

		/**
		 * Apply a canonical weekday preset to the visible buttons and transport.
		 *
		 * The `-1` unrestricted marker is presented as all seven weekdays selected
		 * so the allowed-start-days state remains explicit to sighted users.
		 *
		 * @param {string} mode         Range mode owning the controls.
		 * @param {string} raw_weekdays Canonical comma list or `-1` for any day.
		 * @return {void}
		 */
		function apply_weekday_preset( mode, raw_weekdays ) {
			var group = editor ? editor.node.querySelector( '[data-wpbc-date-selection-weekdays="' + mode + '"]' ) : null;
			var weekdays = '-1' === raw_weekdays ? [ 0, 1, 2, 3, 4, 5, 6 ] : String( raw_weekdays || '' ).split( ',' ).map( function ( raw_weekday ) {
				return parseInt( raw_weekday, 10 );
			} ).filter( function ( weekday ) {
				return ! isNaN( weekday ) && weekday >= 0 && weekday <= 6;
			} );

			if ( ! group ) {
				return;
			}

			group.querySelectorAll( '[data-weekday]' ).forEach( function ( button ) {
				var is_selected = -1 !== weekdays.indexOf( parseInt( button.dataset.weekday, 10 ) );

				button.setAttribute( 'aria-pressed', is_selected ? 'true' : 'false' );
				button.classList.toggle( 'is-selected', is_selected );
			} );
			sync_weekday_transport( mode );
		}

		/**
		 * Synchronize visible switches into their allow-listed hidden fields.
		 *
		 * @return {void}
		 */
		function sync_toggle_transports() {
			if ( ! editor ) {
				return;
			}

			editor.node.querySelectorAll( '[data-wpbc-date-selection-toggle]' ).forEach( function ( toggle ) {
				var field_name = toggle.dataset.wpbcDateSelectionToggle;
				var transport = editor.node.querySelector( '[name="' + field_name + '"]' );
				var policy_state = String( toggle.dataset.wpbcDateSelectionPolicyState || '' );

				if ( transport ) {
					if ( 'required_on' === policy_state || 'hidden_on' === policy_state ) {
						transport.value = 'On';
					} else if ( 'hidden_off' === policy_state ) {
						transport.value = 'Off';
					} else {
						transport.value = toggle.checked && ! toggle.disabled ? 'On' : 'Off';
					}
				}
			} );
		}

		/**
		 * Explain configuration-driven disabled toggle states.
		 *
		 * Native disabled inputs do not receive pointer or keyboard focus. The
		 * surrounding toggle remains hoverable and becomes keyboard focusable only
		 * while a documented dependency or edition rule disables its input.
		 *
		 * @return {void}
		 */
		function sync_disabled_toggle_tooltips() {
			if ( ! editor ) {
				return;
			}

			editor.node.querySelectorAll( '[data-wpbc-date-selection-disabled-tooltip]' ).forEach( function ( tooltip_wrapper ) {
				var toggle = tooltip_wrapper.querySelector( '[data-wpbc-date-selection-toggle]' );
				var description_id = String( tooltip_wrapper.dataset.wpbcDateSelectionDisabledTooltip || '' );
				var description = description_id ? document.getElementById( description_id ) : null;
				var disabled_reason = toggle && toggle.disabled ? String( toggle.dataset.wpbcDateSelectionDisabledReason || '' ) : '';

				if ( disabled_reason ) {
					tooltip_wrapper.setAttribute( 'title', disabled_reason );
					tooltip_wrapper.setAttribute( 'tabindex', '0' );
					tooltip_wrapper.setAttribute( 'aria-describedby', description_id );
					tooltip_wrapper.dataset.wpbcDateSelectionDisabledTooltipActive = '1';
				} else {
					tooltip_wrapper.removeAttribute( 'title' );
					tooltip_wrapper.removeAttribute( 'tabindex' );
					tooltip_wrapper.removeAttribute( 'aria-describedby' );
					delete tooltip_wrapper.dataset.wpbcDateSelectionDisabledTooltipActive;
				}

				if ( description ) {
					description.textContent = disabled_reason;
				}
			} );
		}

		/**
		 * Enforce canonical changeover, recurrent-time, and check-out dependencies.
		 *
		 * Booking Calendar treats changeover processing as mutually exclusive with
		 * recurrent time and an independently available check-out date. A check-out
		 * date also has no meaning for single or independent-date selections. Hide
		 * incompatible controls and normalize their request-local draft state.
		 *
		 * @return {void}
		 */
		function sync_changeover_dependencies() {
			var changeover_toggle;
			var changeover_controls;
			var changeover_fields;
			var checkout_option;
			var checkout_toggle;
			var checkout_tooltip_wrapper;
			var checkout_disabled_reason;
			var recurrent_toggle;
			var recurrent_option;
			var behavior_section;
			var changeover_is_active;
			var checkout_is_supported;
			var changeover_policy;
			var recurrent_policy;
			var checkout_policy;

			if ( ! editor || ! editor.changeover ) {
				return;
			}

			changeover_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_changeover_enabled"]' );
			changeover_controls = editor.changeover.querySelector( '[data-wpbc-date-selection-changeover-controls]' );
			changeover_fields = editor.changeover.querySelector( '[data-wpbc-date-selection-changeover-fields]' );
			checkout_option = editor.node.querySelector( '[data-wpbc-date-selection-checkout-option]' );
			checkout_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_checkout_available"]' );
			checkout_tooltip_wrapper = checkout_toggle ? checkout_toggle.closest( '[data-wpbc-date-selection-disabled-tooltip]' ) : null;
			recurrent_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_recurrent_time"]' );
			recurrent_option = editor.node.querySelector( '[data-wpbc-date-selection-recurrent-option]' );
			behavior_section = editor.node.querySelector( '[data-wpbc-date-selection-behavior]' );
			changeover_policy = get_mode_policy_state( 'wpbcDateSelectionPolicyChangeover' );
			recurrent_policy = get_mode_policy_state( 'wpbcDateSelectionPolicyRecurrentTime' );
			checkout_policy = get_mode_policy_state( 'wpbcDateSelectionPolicyCheckoutAvailable' );
			checkout_is_supported = 'optional' === checkout_policy;

			if ( changeover_toggle ) {
				changeover_toggle.dataset.wpbcDateSelectionPolicyState = changeover_policy;
				if ( 'required_on' === changeover_policy ) {
					changeover_toggle.checked = true;
					changeover_toggle.disabled = true;
				} else if ( 'hidden_off' === changeover_policy ) {
					changeover_toggle.checked = false;
				} else {
					changeover_toggle.disabled = '1' === changeover_toggle.dataset.wpbcDateSelectionEditionLocked;
				}
			}
			changeover_is_active = Boolean( changeover_toggle && changeover_toggle.checked && 'hidden_off' !== changeover_policy );

			editor.changeover.hidden = -1 === [ 'optional', 'required_on' ].indexOf( changeover_policy );

			if ( changeover_controls ) {
				changeover_controls.hidden = ! changeover_is_active;
			}
			if ( changeover_fields ) {
				changeover_fields.hidden = ! changeover_is_active;
			}
			if ( recurrent_option ) {
				recurrent_option.hidden = -1 === [ 'optional', 'optional_default_on', 'required_on' ].indexOf( recurrent_policy );
			}
			if ( recurrent_toggle ) {
				recurrent_toggle.dataset.wpbcDateSelectionPolicyState = recurrent_policy;
				recurrent_toggle.disabled = 'required_on' === recurrent_policy;
				if ( 'hidden_on' === recurrent_policy || 'required_on' === recurrent_policy ) {
					recurrent_toggle.checked = true;
				} else if ( -1 === [ 'optional', 'optional_default_on' ].indexOf( recurrent_policy ) || changeover_is_active ) {
					recurrent_toggle.checked = false;
				}
			}
			if ( checkout_option ) {
				checkout_option.hidden = ! checkout_is_supported;
				checkout_option.dataset.wpbcDateSelectionPolicyState = checkout_policy;
			}
			if ( checkout_toggle ) {
				checkout_toggle.dataset.wpbcDateSelectionPolicyState = checkout_policy;
				checkout_toggle.disabled = '1' === checkout_toggle.dataset.wpbcDateSelectionEditionLocked || changeover_is_active || ! checkout_is_supported;
				checkout_disabled_reason = '';
				if ( checkout_tooltip_wrapper && '1' === checkout_toggle.dataset.wpbcDateSelectionEditionLocked ) {
					checkout_disabled_reason = checkout_tooltip_wrapper.dataset.wpbcDateSelectionCheckoutReasonEdition || '';
				} else if ( checkout_tooltip_wrapper && changeover_is_active ) {
					checkout_disabled_reason = checkout_tooltip_wrapper.dataset.wpbcDateSelectionCheckoutReasonChangeover || '';
				} else if ( checkout_tooltip_wrapper && ! checkout_is_supported ) {
					checkout_disabled_reason = checkout_tooltip_wrapper.dataset.wpbcDateSelectionCheckoutReasonMode || '';
				}
				checkout_toggle.dataset.wpbcDateSelectionDisabledReason = checkout_disabled_reason;
				if ( changeover_is_active || ! checkout_is_supported ) {
					checkout_toggle.checked = false;
				}
			}
			if ( behavior_section ) {
				behavior_section.hidden = -1 === [ 'optional', 'optional_default_on', 'required_on' ].indexOf( recurrent_policy ) && ! checkout_is_supported;
			}
		}

		/**
		 * Let the most recently activated mutually exclusive option win.
		 *
		 * @param {HTMLElement|null} toggle Changed Date Selection toggle.
		 * @return {void}
		 */
		function apply_exclusive_toggle_action( toggle ) {
			var field_name;
			var conflicting_toggle;

			if ( ! editor || ! toggle || ! toggle.checked ) {
				return;
			}

			field_name = toggle.dataset.wpbcDateSelectionToggle || '';
			if ( 'date_selection_changeover_enabled' === field_name ) {
				conflicting_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_recurrent_time"]' );
			} else if ( 'date_selection_recurrent_time' === field_name ) {
				conflicting_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_changeover_enabled"]' );
			}

			if ( conflicting_toggle ) {
				conflicting_toggle.checked = false;
			}
		}

		/**
		 * Synchronize the non-mutating calendar-legend configuration preview.
		 *
		 * All preview nodes are rendered by PHP. This method changes only text,
		 * visibility, and layout classes; it never constructs or evaluates markup.
		 *
		 * @return {void}
		 */
		function sync_legend_preview() {
			var legend_toggle;
			var legend_settings;
			var legend_preview;
			var show_numbers_toggle;
			var vertical_toggle;
			var day_number;

			if ( ! editor || ! editor.legend ) {
				return;
			}

			legend_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_legend_enabled"]' );
			legend_settings = editor.legend.querySelector( '[data-wpbc-date-selection-legend-settings]' );
			legend_preview = editor.node.querySelector( '[data-wpbc-date-selection-legend-preview]' );
			show_numbers_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_legend_show_numbers"]' );
			vertical_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_legend_vertical"]' );
			day_number = legend_preview ? String( legend_preview.dataset.wpbcDateSelectionLegendDayNumber || '' ) : '';

			if ( legend_settings ) {
				legend_settings.hidden = ! legend_toggle || ! legend_toggle.checked;
			}
			if ( ! legend_preview ) {
				return;
			}

			legend_preview.hidden = ! legend_toggle || ! legend_toggle.checked;
			legend_preview.classList.toggle( 'is-vertical', Boolean( vertical_toggle && vertical_toggle.checked ) );
			legend_preview.querySelectorAll( '[data-wpbc-date-selection-legend-preview-item]' ).forEach( function ( preview_item ) {
				var legend_id = preview_item.dataset.wpbcDateSelectionLegendPreviewItem;
				var item_toggle = editor.node.querySelector( '[data-wpbc-date-selection-toggle="date_selection_legend_item_' + legend_id + '"]' );
				var title_control = editor.node.querySelector( '[data-wpbc-date-selection-legend-title="' + legend_id + '"]' );
				var title_node = preview_item.querySelector( '.wpdev_hint_with_text .block_text:last-child' );
				var title = title_control ? String( title_control.value || '' ).trim() : '';

				preview_item.hidden = ! item_toggle || ! item_toggle.checked;
				if ( title_node && title_control ) {
					title_node.textContent = title || title_control.placeholder || '';
				}
				preview_item.querySelectorAll( '.wpbc_calendar_legend_day_cell_height .date-cell-content > a, .wpbc_calendar_legend_day_cell_height .date-cell-content > span' ).forEach( function ( date_node ) {
					date_node.textContent = show_numbers_toggle && show_numbers_toggle.checked ? day_number : '';
				} );
			} );
		}

		/**
		 * Synchronize canonical changeover classes in the calendar and legend.
		 *
		 * Booking Calendar owns the underlying day status and SVG markup. This
		 * adapter changes only the same ancestor and day-state classes used by the
		 * released calendar renderer, so triangle and split-day presentation stay
		 * consistent without constructing or evaluating HTML.
		 *
		 * @return {void}
		 */
		function sync_changeover_preview_classes() {
			var changeover_transport;
			var triangles_transport;
			var changeover_is_active;
			var triangles_are_active;
			var partially_item;
			var partially_day;
			var legend_table;
			var legend_wrapper;
			var changeover_classes;

			if ( ! editor ) {
				return;
			}

			changeover_transport = editor.node.querySelector( '[name="date_selection_changeover_enabled"]' );
			triangles_transport = editor.node.querySelector( '[name="date_selection_triangles"]' );
			changeover_is_active = Boolean( changeover_transport && 'On' === changeover_transport.value );
			triangles_are_active = Boolean( changeover_is_active && triangles_transport && 'On' === triangles_transport.value );

			if ( editor.calendar ) {
				editor.calendar.classList.toggle( 'wpbc_change_over_triangle', triangles_are_active );
				editor.calendar.querySelectorAll( '.wpbc_calendar_wraper' ).forEach( function ( calendar_wrapper ) {
					calendar_wrapper.classList.toggle( 'wpbc_change_over_triangle', triangles_are_active );
				} );
			}

			partially_item = editor.node.querySelector( '[data-wpbc-date-selection-legend-preview-item="partially"]' );
			if ( ! partially_item ) {
				return;
			}

			partially_day = partially_item.querySelector( '.wpbc_calendar_legend_day_cell_height' );
			if ( partially_day ) {
				changeover_classes = [
					'date_approved',
					'check_in_time',
					'check_out_time',
					'check_in_time_date_approved',
					'check_out_time_date2approve'
				];
				changeover_classes.forEach( function ( class_name ) {
					partially_day.classList.toggle( class_name, changeover_is_active );
				} );
				partially_day.classList.toggle( 'date2approve', ! changeover_is_active );
				partially_day.classList.toggle( 'times_clock', ! changeover_is_active );
			}

			legend_table = partially_item.querySelector( '.wpbc_calendar_legend_table_width_height' );
			legend_wrapper = legend_table ? legend_table.parentElement : null;
			if ( legend_wrapper ) {
				legend_wrapper.classList.toggle( 'wpbc_change_over_triangle', triangles_are_active );
			}
		}

		/**
		 * Reload canonical day-status data with authorized draft overrides.
		 *
		 * The shared calendar endpoint calculates booking boundaries. A dedicated
		 * Setup Wizard nonce and capability check authorize these request-local
		 * values; no setting or booking is written by this request.
		 *
		 * @return {void}
		 */
		function refresh_changeover_preview_data() {
			var changeover_transport;
			var triangles_transport;
			var recurrent_transport;
			var checkout_transport;

			if (
				! editor
				|| ! editor.calendar
				|| ! config.preview_nonce
				|| 'function' !== typeof window.wpbc_calendar__load_data__ajx
			) {
				return;
			}

			changeover_transport = editor.node.querySelector( '[name="date_selection_changeover_enabled"]' );
			triangles_transport = editor.node.querySelector( '[name="date_selection_triangles"]' );
			recurrent_transport = editor.node.querySelector( '[name="date_selection_recurrent_time"]' );
			checkout_transport = editor.node.querySelector( '[name="date_selection_checkout_available"]' );

			window.wpbc_calendar__load_data__ajx( {
				resource_id: editor.resource_id,
				booking_hash: '',
				request_uri: '',
				custom_form: 'standard',
				aggregate_resource_id_str: '',
				aggregate_type: 'all',
				skip_general_availability: 0,
				classic_booking_context_token: '',
				wpbc_settings_calendar_preview: 1,
				wpbc_setup_wizard_date_selection_preview: 1,
				wpbc_setup_wizard_date_selection_preview_nonce: String( config.preview_nonce ),
				wpbc_settings_calendar_preview_changeover: changeover_transport && 'On' === changeover_transport.value ? 'On' : 'Off',
				wpbc_settings_calendar_preview_triangles: triangles_transport && 'On' === triangles_transport.value ? 'On' : 'Off',
				wpbc_settings_calendar_preview_recurrent_time: recurrent_transport && 'On' === recurrent_transport.value ? 'On' : 'Off',
				wpbc_settings_calendar_preview_last_checkout: checkout_transport && 'On' === checkout_transport.value ? 'On' : 'Off',
				wpbc_settings_calendar_preview_show_legend: 'Off'
			} );
		}

		/**
		 * Debounce request-local day-status refreshes after related toggles change.
		 *
		 * @return {void}
		 */
		function schedule_changeover_data_refresh() {
			if ( preview_data_timer ) {
				window.clearTimeout( preview_data_timer );
			}
			preview_data_timer = window.setTimeout( refresh_changeover_preview_data, 180 );
		}

		/**
		 * Return the authoritative number field paired with one presentation slider.
		 *
		 * @param {string} field_name Date Selection draft field name.
		 * @return {HTMLInputElement|null} Matching number field, or null.
		 */
		function get_number_control( field_name ) {
			return editor ? editor.node.querySelector( '[data-wpbc-date-selection-number="' + field_name + '"]' ) : null;
		}

		/**
		 * Copy one valid authoritative number value into its presentation slider.
		 *
		 * Invalid exact values remain visible for native and wizard validation; the
		 * slider must not silently coerce them into an apparently valid draft.
		 *
		 * @param {HTMLInputElement} number_control Authoritative number field.
		 * @return {void}
		 */
		function sync_range_from_number( number_control ) {
			var field_name = number_control ? number_control.dataset.wpbcDateSelectionNumber : '';
			var range_control = field_name && editor ? editor.node.querySelector( '[data-wpbc-date-selection-range="' + field_name + '"]' ) : null;

			if ( ! range_control || '' === number_control.value || ! number_control.checkValidity() ) {
				return;
			}

			range_control.value = number_control.value;
		}

		/**
		 * Copy one presentation slider value into its authoritative number field.
		 *
		 * @param {HTMLInputElement} range_control Presentation range control.
		 * @return {void}
		 */
		function sync_number_from_range( range_control ) {
			var field_name = range_control ? range_control.dataset.wpbcDateSelectionRange : '';
			var number_control = get_number_control( field_name );

			if ( ! number_control || number_control.disabled || range_control.disabled ) {
				return;
			}

			number_control.value = range_control.value;
		}

		/**
		 * Align every presentation slider with its authoritative number field.
		 *
		 * @return {void}
		 */
		function sync_number_ranges() {
			if ( ! editor ) {
				return;
			}

			editor.node.querySelectorAll( '[data-wpbc-date-selection-number]' ).forEach( sync_range_from_number );
		}

		/**
		 * Apply one trusted preset value through the authoritative number control.
		 *
		 * @param {string} field_name Draft field name.
		 * @param {string} raw_value  Server-defined integer value.
		 * @return {void}
		 */
		function apply_number_preset( field_name, raw_value ) {
			var number_control = get_number_control( field_name );

			if ( ! number_control || number_control.disabled || ! /^\d+$/.test( String( raw_value ) ) ) {
				return;
			}

			number_control.value = String( raw_value );
			sync_range_from_number( number_control );
		}

		/**
		 * Apply a server-defined specific-length preset as one coherent draft.
		 *
		 * Clear intentionally omits the range and weekday data attributes, so it
		 * removes only the specific-length restriction and preserves manual rules.
		 *
		 * @param {HTMLElement} preset_button   Activated preset button.
		 * @param {HTMLInputElement} text_control Specific-length text field.
		 * @return {void}
		 */
		function apply_specific_day_preset( preset_button, text_control ) {
			text_control.value = preset_button.dataset.wpbcDateSelectionSpecificPreset || '';

			if ( preset_button.hasAttribute( 'data-wpbc-date-selection-preset-minimum' ) ) {
				apply_number_preset( 'date_selection_dynamic_min', preset_button.dataset.wpbcDateSelectionPresetMinimum );
			}
			if ( preset_button.hasAttribute( 'data-wpbc-date-selection-preset-maximum' ) ) {
				apply_number_preset( 'date_selection_dynamic_max', preset_button.dataset.wpbcDateSelectionPresetMaximum );
			}
			if ( preset_button.hasAttribute( 'data-wpbc-date-selection-preset-weekdays' ) ) {
				apply_weekday_preset( 'dynamic', preset_button.dataset.wpbcDateSelectionPresetWeekdays );
			}

			shell_api.clear_field_error( 'date_selection_dynamic_min' );
			shell_api.clear_field_error( 'date_selection_dynamic_max' );
			shell_api.clear_field_error( 'date_selection_dynamic_specific' );
			shell_api.clear_field_error( 'date_selection_dynamic_weekdays' );
		}

		/**
		 * Update selected cards, settings panels, and changeover visibility.
		 *
		 * @return {void}
		 */
		function render_editor_state() {
			var mode = get_selected_mode();

			if ( ! editor ) {
				return;
			}

			editor.node.querySelectorAll( '.wpbc_setup_wizard__date-selection-mode-card' ).forEach( function ( card ) {
				var radio = card.querySelector( '[data-wpbc-date-selection-mode]' );
				card.classList.toggle( 'is-selected', Boolean( radio && radio.checked ) );
			} );
			editor.node.querySelectorAll( '[data-wpbc-date-selection-panel]' ).forEach( function ( panel ) {
				panel.hidden = panel.dataset.wpbcDateSelectionPanel !== mode;
			} );

			sync_changeover_dependencies();
		}

		/**
		 * Set one canonical request-local calendar parameter.
		 *
		 * @param {string} key   Calendar parameter name.
		 * @param {*}      value Parameter value.
		 * @return {void}
		 */
		function set_calendar_parameter( key, value ) {
			if ( editor && window._wpbc && 'function' === typeof window._wpbc.calendar__set_param_value ) {
				window._wpbc.calendar__set_param_value( editor.resource_id, key, value );
			}
		}

		/**
		 * Normalize the legacy calendar scroll target before a released mode helper runs.
		 *
		 * The core calendar accepts either false or a two-value month/year array. The
		 * request-local preview can initially expose null, which the legacy helper
		 * otherwise attempts to index while reinitializing the calendar.
		 *
		 * @return {void}
		 */
		function normalize_calendar_scroll_target() {
			var scroll_target;

			if (
				! editor
				|| ! window._wpbc
				|| 'function' !== typeof window._wpbc.calendar__get_param_value
				|| 'function' !== typeof window._wpbc.calendar__set_param_value
			) {
				return;
			}

			scroll_target = window._wpbc.calendar__get_param_value( editor.resource_id, 'calendar_scroll_to' );
			if (
				false !== scroll_target
				&& (
					! Array.isArray( scroll_target )
					|| scroll_target.length < 2
					|| null === scroll_target[ 0 ]
					|| null === scroll_target[ 1 ]
				)
			) {
				set_calendar_parameter( 'calendar_scroll_to', false );
			}
		}

		/**
		 * Apply the current draft through the real Booking Calendar mode helpers.
		 *
		 * @return {boolean} True when the calendar runtime was ready.
		 */
		function apply_preview_policy() {
			var mode;
			var changeover;
			var recurrent_time;
			var triangles;
			var calendar_node;
			var fixed_days;
			var fixed_weekdays;
			var dynamic_min;
			var dynamic_max;
			var dynamic_specific;
			var dynamic_weekdays;

			if ( ! editor ) {
				return false;
			}

			sync_changeover_preview_classes();

			if ( ! window._wpbc || 'function' !== typeof window._wpbc.calendar__set_param_value ) {
				return false;
			}

			calendar_node = document.getElementById( 'calendar_booking' + editor.resource_id );
			if ( ! calendar_node ) {
				return false;
			}

			mode = get_selected_mode();
			changeover = editor.node.querySelector( '[name="date_selection_changeover_enabled"]' );
			recurrent_time = editor.node.querySelector( '[name="date_selection_recurrent_time"]' );
			triangles = editor.node.querySelector( '[name="date_selection_triangles"]' );
			fixed_days = get_integer( '[name="date_selection_fixed_days"]', 3 );
			fixed_weekdays = get_weekdays( 'fixed' );
			dynamic_min = get_integer( '[name="date_selection_dynamic_min"]', 1 );
			dynamic_max = get_integer( '[name="date_selection_dynamic_max"]', 1 );
			dynamic_specific = get_specific_days();
			dynamic_weekdays = get_weekdays( 'dynamic' );
			dynamic_specific = null === dynamic_specific ? [] : dynamic_specific;

			set_calendar_parameter( 'is_enabled_change_over', Boolean( changeover && 'On' === changeover.value ) );
			set_calendar_parameter( 'booking_recurrent_time', recurrent_time && 'On' === recurrent_time.value ? 'On' : 'Off' );
			set_calendar_parameter( 'days_select_mode', mode );
			set_calendar_parameter( 'fixed__days_num', fixed_days );
			set_calendar_parameter( 'fixed__week_days__start', fixed_weekdays );
			set_calendar_parameter( 'dynamic__days_min', dynamic_min );
			set_calendar_parameter( 'dynamic__days_max', dynamic_max );
			set_calendar_parameter( 'dynamic__days_specific', dynamic_specific );
			set_calendar_parameter( 'dynamic__week_days__start', dynamic_weekdays );
			normalize_calendar_scroll_target();
			if ( 'function' === typeof window._wpbc.set_other_param ) {
				window._wpbc.set_other_param( 'is_enabled_change_over', Boolean( changeover && 'On' === changeover.value ) );
			}
			if ( 'function' === typeof window.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm ) {
				window.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm( editor.resource_id );
			}

			if ( 'single' === mode && 'function' === typeof window.wpbc_cal_days_select__single ) {
				window.wpbc_cal_days_select__single( editor.resource_id );
				return true;
			}
			if ( 'multiple' === mode && 'function' === typeof window.wpbc_cal_days_select__multiple ) {
				window.wpbc_cal_days_select__multiple( editor.resource_id );
				return true;
			}
			if ( 'fixed' === mode && 'function' === typeof window.wpbc_cal_days_select__fixed ) {
				window.wpbc_cal_days_select__fixed(
					editor.resource_id,
					fixed_days,
					fixed_weekdays
				);
				return true;
			}
			if ( 'dynamic' === mode && 'function' === typeof window.wpbc_cal_days_select__range ) {
				window.wpbc_cal_days_select__range(
					editor.resource_id,
					dynamic_min,
					dynamic_max,
					dynamic_specific,
					dynamic_weekdays
				);
				return true;
			}

			return false;
		}

		/**
		 * Reapply policy after immediate interaction and delayed calendar bootstrap.
		 *
		 * @return {void}
		 */
		function schedule_preview_update() {
			apply_timers.forEach( function ( timer_id ) {
				window.clearTimeout( timer_id );
			} );
			apply_timers = [ 0, 120, 420, 900, 1400 ].map( function ( delay ) {
				return window.setTimeout( apply_preview_policy, delay );
			} );
		}

		/**
		 * Synchronize all presentation controls before draft collection.
		 *
		 * @return {void}
		 */
		function sync() {
			sync_weekday_transport( 'fixed' );
			sync_weekday_transport( 'dynamic' );
			sync_changeover_dependencies();
			sync_disabled_toggle_tooltips();
			sync_toggle_transports();
			sync_legend_preview();
			sync_changeover_preview_classes();
			sync_number_ranges();
		}

		/**
		 * Validate coupled date-selection values before navigation.
		 *
		 * Server-side field allow-lists remain authoritative. This prevents an
		 * internally inconsistent flexible range from being sent as a draft.
		 *
		 * @return {HTMLElement|null} First invalid control, or null.
		 */
		function validate() {
			var mode = get_selected_mode();
			var fixed_days = get_integer( '[name="date_selection_fixed_days"]', 0 );
			var dynamic_min = get_integer( '[name="date_selection_dynamic_min"]', 0 );
			var dynamic_max = get_integer( '[name="date_selection_dynamic_max"]', 0 );
			var dynamic_specific = get_specific_days();
			var fixed_control = editor.node.querySelector( '[name="date_selection_fixed_days"]' );
			var dynamic_min_control = editor.node.querySelector( '[name="date_selection_dynamic_min"]' );
			var dynamic_max_control = editor.node.querySelector( '[name="date_selection_dynamic_max"]' );
			var dynamic_specific_control = editor.node.querySelector( '[data-wpbc-date-selection-specific]' );

			if ( ! mode ) {
				shell_api.set_field_error( 'date_selection_mode', get_message( 'mode_required', 'Choose how customers select dates.' ) );
				return editor.node.querySelector( '[data-wpbc-date-selection-mode]' );
			}

			if ( fixed_days < 1 || fixed_days > parseInt( config.max_fixed_days || 180, 10 ) ) {
				shell_api.set_field_error( 'date_selection_fixed_days', get_message( 'fixed_days_invalid', 'Enter a valid fixed range.' ) );
				return fixed_control;
			}
			shell_api.clear_field_error( 'date_selection_fixed_days' );

			if ( dynamic_min < 1 || dynamic_max < dynamic_min || dynamic_max > parseInt( config.max_dynamic_days || 1095, 10 ) ) {
				shell_api.set_field_error( 'date_selection_dynamic_min', get_message( 'dynamic_days_invalid', 'Enter a valid flexible range.' ) );
				shell_api.set_field_error( 'date_selection_dynamic_max', get_message( 'dynamic_days_invalid', 'Enter a valid flexible range.' ) );
				return dynamic_min < 1 ? dynamic_min_control : dynamic_max_control;
			}
			shell_api.clear_field_error( 'date_selection_dynamic_min' );
			shell_api.clear_field_error( 'date_selection_dynamic_max' );

			if (
				null === dynamic_specific
				|| dynamic_specific.some( function ( specific_day ) {
					return specific_day < dynamic_min || specific_day > dynamic_max;
				} )
			) {
				shell_api.set_field_error( 'date_selection_dynamic_specific', get_message( 'specific_days_invalid', 'Enter comma-separated day lengths within the flexible range, for example 7,14,21,28.' ) );
				return dynamic_specific_control;
			}
			shell_api.clear_field_error( 'date_selection_dynamic_specific' );

			return null;
		}

		/**
		 * Handle editor controls without constructing dynamic HTML.
		 *
		 * @param {Event} event Browser input or click event.
		 * @return {void}
		 */
		function handle_interaction( event ) {
			var weekday_button = event.target.closest( '[data-wpbc-date-selection-weekdays] [data-weekday]' );
			var number_control = event.target.closest( '[data-wpbc-date-selection-number]' );
			var range_control = event.target.closest( '[data-wpbc-date-selection-range]' );
			var specific_preset = event.target.closest( '[data-wpbc-date-selection-specific-preset]' );
			var specific_control = editor ? editor.node.querySelector( '[data-wpbc-date-selection-specific]' ) : null;
			var changed_mode = event.target.closest( '[data-wpbc-date-selection-mode]' );
			var changed_toggle = event.target.closest( '[data-wpbc-date-selection-toggle]' );
			var changed_toggle_name = changed_toggle ? String( changed_toggle.dataset.wpbcDateSelectionToggle || '' ) : '';
			var editor_control = event.target.closest( '[data-wpbc-date-selection-mode], [data-wpbc-date-selection-number], [data-wpbc-date-selection-range], [data-wpbc-date-selection-specific], [data-wpbc-date-selection-specific-preset], [data-wpbc-date-selection-toggle], [data-wpbc-date-selection-legend-title], [data-wpbc-date-selection-weekdays] [data-weekday], [name="date_selection_check_in_time"], [name="date_selection_check_out_time"]' );

			if ( ! editor_control || event.target.closest( '[data-wpbc-date-selection-calendar]' ) ) {
				return;
			}

			if ( weekday_button && ! weekday_button.disabled ) {
				event.preventDefault();
				weekday_button.setAttribute( 'aria-pressed', 'true' === weekday_button.getAttribute( 'aria-pressed' ) ? 'false' : 'true' );
				weekday_button.classList.toggle( 'is-selected', 'true' === weekday_button.getAttribute( 'aria-pressed' ) );
				sync_weekday_transport( weekday_button.closest( '[data-wpbc-date-selection-weekdays]' ).dataset.wpbcDateSelectionWeekdays );
			}
			if ( specific_preset && specific_control && ! specific_preset.disabled && ! specific_control.disabled ) {
				event.preventDefault();
				apply_specific_day_preset( specific_preset, specific_control );
			}
			if ( range_control ) {
				sync_number_from_range( range_control );
			} else if ( number_control ) {
				sync_range_from_number( number_control );
			}
			apply_exclusive_toggle_action( changed_toggle );
			apply_selected_mode_defaults( changed_mode );

			sync();
			render_editor_state();
			schedule_preview_update();
			if (
				changed_mode
				|| 'date_selection_changeover_enabled' === changed_toggle_name
				|| 'date_selection_recurrent_time' === changed_toggle_name
				|| 'date_selection_checkout_available' === changed_toggle_name
			) {
				schedule_changeover_data_refresh();
			}
		}

		return {
			/**
			 * Initialize the editor below the authorized wizard shell.
			 *
			 * @param {Object} api Shared shell services.
			 * @return {void}
			 */
			initialize: function ( api ) {
				var node = api.root.querySelector( '[data-wpbc-date-selection-editor]' );

				if ( ! node ) {
					return;
				}

				shell_api = api;
				editor = {
					node: node,
					resource_id: parseInt( node.dataset.resourceId, 10 ) || 1,
					calendar: node.querySelector( '[data-wpbc-date-selection-calendar]' ),
					changeover: node.querySelector( '[data-wpbc-date-selection-changeover]' ),
					legend: node.querySelector( '[data-wpbc-date-selection-legend]' )
				};
				last_selected_mode = get_selected_mode();
				node.addEventListener( 'change', handle_interaction );
				node.addEventListener( 'input', handle_interaction );
				node.addEventListener( 'click', handle_interaction );
				sync();
				render_editor_state();
				schedule_preview_update();
			},
			sync: sync,
			validate: validate
		};
	}

	/**
	 * Register after the shared shell exposes its module adapter API.
	 *
	 * @return {void}
	 */
	function register_adapter() {
		if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
			window.wpbc_setup_wizard_api.register_step_adapter( create_date_selection_adapter( module_config ) );
		}
	}

	window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
	window.wpbc_setup_editor_modules.date_selection = {
		create: create_date_selection_adapter
	};

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', register_adapter );
	} else {
		register_adapter();
	}
}( window, document ) );
