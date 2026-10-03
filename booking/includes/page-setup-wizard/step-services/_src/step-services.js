/**
 * Provide the reusable progressively saved Service editor used by Setup Wizard.
 *
 * The module owns Service presentation, local draft synchronization, media
 * preview behavior, and early validation. Persistence and authorization remain
 * server-owned. The number input remains authoritative when paired with a
 * range input so keyboard users can enter exact minute values.
 *
 * @package Booking Calendar
 */
( function ( $, window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_services || { i18n: {} };

	/**
	 * Create one isolated Service editor adapter.
	 *
	 * @param {Object} config Module translations and presentation settings.
	 * @return {Object} Step adapter accepted by the shared wizard shell.
	 */
	function create_services_adapter( config ) {
		var shell_api = null;
		var root = null;
		var editor = null;

		/**
		 * Return one translated string with a safe fallback.
		 *
		 * @param {string} key      Translation key.
		 * @param {string} fallback Fallback copy.
		 * @return {string} Translation or fallback.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? config.i18n[ key ] : fallback;
		}

		/**
		 * Replace one string placeholder without interpreting replacement tokens.
		 *
		 * @param {string} message     Translated message containing `%s`.
		 * @param {string} replacement Plain-text replacement.
		 * @return {string} Formatted message.
		 */
		function format_message( message, replacement ) {
			return String( message ).replace( '%s', function () {
				return String( replacement );
			} );
		}

		/**
		 * Create one unsaved Service proposal using safe presentation defaults.
		 *
		 * @return {Object} JSON-safe Service proposal.
		 */
		function create_service_draft() {
			return {
				draft_id: 'draft-' + Date.now() + '-' + Math.floor( Math.random() * 100000 ),
				source_service_id: 0,
				title: get_message( 'new_service', 'New Service' ),
				description: '',
				picture_url: '',
				duration_minutes: 30,
				buffer_before_minutes: 0,
				buffer_after_minutes: 0,
				base_cost: '0.00',
				status: 'active'
			};
		}

		/**
		 * Return one editable Service field control.
		 *
		 * @param {string} field_name Stable Service DTO field.
		 * @return {HTMLElement|null} Matching field control.
		 */
		function get_service_field( field_name ) {
			return editor ? editor.node.querySelector( '[data-wpbc-service-field="' + field_name + '"]' ) : null;
		}

		/**
		 * Synchronize both explicit Service transport fields.
		 *
		 * Canonical lifecycle intent is kept separate from the visible proposal
		 * collection so omission alone can never move a Service to Draft.
		 *
		 * @return {void}
		 */
		function sync_transports() {
			if ( ! editor ) {
				return;
			}

			editor.transport.value = JSON.stringify( editor.services );
			editor.inactive_transport.value = JSON.stringify( editor.inactive_service_ids );
		}

		/**
		 * Synchronize a range input from its authoritative number control.
		 *
		 * Invalid number input is intentionally left visible for validation and is
		 * not allowed to coerce the stored draft silently.
		 *
		 * @param {string} field_name Stable numeric Service field.
		 * @return {void}
		 */
		function sync_range_from_number( field_name ) {
			var number_control = get_service_field( field_name );
			var range_control = editor && editor.node.querySelector( '[data-wpbc-service-range="' + field_name + '"]' );
			var number_value;

			if ( ! number_control || ! range_control ) {
				return;
			}

			number_value = Number( number_control.value );
			if ( isFinite( number_value ) && number_value >= Number( range_control.min ) && number_value <= Number( range_control.max ) ) {
				range_control.value = String( number_value );
			}
		}

		/**
		 * Persist the current detail controls into the in-memory draft collection.
		 *
		 * @return {void}
		 */
		function sync_selected_service() {
			var service;

			if ( ! editor || ! editor.services[ editor.selected_index ] ) {
				return;
			}

			service = editor.services[ editor.selected_index ];
			[ 'title', 'description', 'picture_url', 'duration_minutes', 'buffer_before_minutes', 'buffer_after_minutes', 'base_cost' ].forEach( function ( field_name ) {
				var field = get_service_field( field_name );
				if ( field && ! field.disabled ) {
					service[ field_name ] = field.value;
				}
			} );
			service.status = 'active';
			sync_transports();
		}

		/**
		 * Update the Service picture preview from the URL control.
		 *
		 * @return {void}
		 */
		function update_service_picture() {
			var url_field = get_service_field( 'picture_url' );
			var image = editor && editor.node.querySelector( '[data-wpbc-service-picture-image]' );
			var placeholder = editor && editor.node.querySelector( '[data-wpbc-service-picture-placeholder]' );
			var remove_button = editor && editor.node.querySelector( '[data-wpbc-remove-service-picture]' );
			var picture_url = url_field ? String( url_field.value || '' ).trim() : '';

			if ( image ) {
				image.hidden = ! picture_url;
				if ( picture_url ) {
					image.src = picture_url;
				} else {
					image.removeAttribute( 'src' );
				}
			}
			if ( placeholder ) {
				placeholder.hidden = Boolean( picture_url );
			}
			if ( remove_button ) {
				remove_button.disabled = ! picture_url;
			}
		}

		/**
		 * Format a Service duration as localized hours and minutes.
		 *
		 * The formatter is presentation-only. Canonical Service draft values remain
		 * integer minutes for validation and persistence.
		 *
		 * @param {number|string} duration_minutes Canonical duration in minutes.
		 * @return {string} Human-readable duration such as "2 hours and 3 minutes".
		 */
		function format_service_duration( duration_minutes ) {
			var parsed_minutes = Number( duration_minutes );
			var total_minutes = isFinite( parsed_minutes ) && parsed_minutes >= 0 ? Math.floor( parsed_minutes ) : 0;
			var hours = Math.floor( total_minutes / 60 );
			var minutes = total_minutes % 60;
			var duration_parts = [];
			var locale = document.documentElement.getAttribute( 'lang' ) || undefined;

			if ( window.Intl && 'function' === typeof window.Intl.NumberFormat ) {
				try {
					if ( hours ) {
						duration_parts.push( new window.Intl.NumberFormat( locale, { style: 'unit', unit: 'hour', unitDisplay: 'long' } ).format( hours ) );
					}
					if ( minutes || ! hours ) {
						duration_parts.push( new window.Intl.NumberFormat( locale, { style: 'unit', unit: 'minute', unitDisplay: 'long' } ).format( minutes ) );
					}
				} catch ( formatter_error ) {
					duration_parts = [];
				}
			}

			if ( ! duration_parts.length ) {
				if ( hours ) {
					duration_parts.push( String( hours ) + ' ' + get_message( 1 === hours ? 'hour_singular' : 'hour_plural', 1 === hours ? 'hour' : 'hours' ) );
				}
				if ( minutes || ! hours ) {
					duration_parts.push( String( minutes ) + ' ' + get_message( 1 === minutes ? 'minute_singular' : 'minute_plural', 1 === minutes ? 'minute' : 'minutes' ) );
				}
			}

			if ( 1 === duration_parts.length ) {
				return duration_parts[0];
			}

			if ( window.Intl && 'function' === typeof window.Intl.ListFormat ) {
				try {
					return new window.Intl.ListFormat( locale, { style: 'long', type: 'conjunction' } ).format( duration_parts );
				} catch ( list_formatter_error ) {
					// Fall through to the translated conjunction for older browsers.
				}
			}

			return duration_parts.join( ' ' + get_message( 'duration_joiner', 'and' ) + ' ' );
		}

		/**
		 * Update the customer-facing title and duration preview.
		 *
		 * @return {void}
		 */
		function update_service_summary() {
			var summary = editor && editor.node.querySelector( '[data-wpbc-service-summary]' );
			var title = get_service_field( 'title' );
			var duration = get_service_field( 'duration_minutes' );

			if ( summary ) {
				summary.textContent = ( title && title.value.trim() ? title.value.trim() : get_message( 'new_service', 'New Service' ) ) + ' · ' + format_service_duration( duration ? duration.value : 30 );
			}
		}

		/**
		 * Load the selected proposal into the detail controls and preview.
		 *
		 * @return {void}
		 */
		function load_selected_service() {
			var service;

			if ( ! editor ) {
				return;
			}

			service = editor.services[ editor.selected_index ];
			if ( ! service ) {
				return;
			}

			[ 'title', 'description', 'picture_url', 'duration_minutes', 'buffer_before_minutes', 'buffer_after_minutes', 'base_cost' ].forEach( function ( field_name ) {
				var field = get_service_field( field_name );
				if ( field ) {
					field.value = null === service[ field_name ] || undefined === service[ field_name ] ? '' : service[ field_name ];
				}
			} );

			[ 'duration_minutes', 'buffer_before_minutes', 'buffer_after_minutes' ].forEach( sync_range_from_number );
			update_service_picture();
			update_service_summary();
		}

		/**
		 * Render the proposal chooser from the data-only draft collection.
		 *
		 * @return {void}
		 */
		function render_service_cards() {
			if ( ! editor || ! editor.list || ! editor.template ) {
				return;
			}

			editor.list.textContent = '';
			editor.services.forEach( function ( service, service_index ) {
				var card = editor.template.content.firstElementChild.cloneNode( true );
				var radio = card.querySelector( 'input[type="radio"]' );
				var image = card.querySelector( 'img' );
				var placeholder = card.querySelector( 'i' );
				var title = card.querySelector( 'strong' );
				var duration = card.querySelector( '[data-wpbc-service-card-duration]' );
				var remove_button = card.querySelector( '[data-wpbc-remove-service]' );
				var picture_url = String( service.picture_url || '' ).trim();
				var service_title = service.title || get_message( 'new_service', 'New Service' );

				radio.value = String( service_index );
				radio.checked = service_index === editor.selected_index;
				radio.dataset.wpbcServiceSelection = String( service_index );
				card.classList.toggle( 'is-selected', radio.checked );
				title.textContent = service_title;
				duration.textContent = format_service_duration( null === service.duration_minutes || undefined === service.duration_minutes || '' === service.duration_minutes ? 30 : service.duration_minutes );
				if ( remove_button ) {
					remove_button.dataset.wpbcRemoveService = String( service_index );
					remove_button.disabled = 1 === editor.services.length;
					if ( Number( service.source_service_id ) > 0 ) {
						remove_button.setAttribute( 'aria-label', format_message( get_message( 'move_service_to_draft', 'Move %s to Draft' ), service_title ) );
						remove_button.title = format_message( get_message( 'move_service_to_draft', 'Move %s to Draft' ), service_title );
					} else {
						remove_button.setAttribute( 'aria-label', format_message( get_message( 'remove_service', 'Remove %s' ), service_title ) );
						remove_button.title = format_message( get_message( 'remove_service', 'Remove %s' ), service_title );
					}
				}
				if ( picture_url ) {
					image.src = picture_url;
					image.hidden = false;
					placeholder.hidden = true;
				} else {
					image.hidden = true;
					image.removeAttribute( 'src' );
					placeholder.hidden = false;
				}
				editor.list.appendChild( card );
			} );
		}

		/**
		 * Remove one proposal and explicitly stage a canonical Service for Draft.
		 *
		 * The required final Service cannot be removed. Canonical storage is not
		 * changed until Save; unsaved proposals have no canonical lifecycle action.
		 *
		 * @param {number} service_index Zero-based Service draft index.
		 * @return {void}
		 */
		function remove_service( service_index ) {
			var focus_target;
			var removed_service;
			var source_service_id;
			var status_message;

			if ( ! editor || ! isFinite( service_index ) || service_index !== Math.floor( service_index ) || editor.services.length <= 1 || service_index < 0 || service_index >= editor.services.length ) {
				return;
			}

			sync_selected_service();
			removed_service = editor.services[ service_index ];
			source_service_id = Number( removed_service.source_service_id || 0 );
			if ( source_service_id > 0 && -1 === editor.inactive_service_ids.indexOf( source_service_id ) ) {
				editor.inactive_service_ids.push( source_service_id );
			}
			editor.services.splice( service_index, 1 );

			if ( service_index < editor.selected_index ) {
				editor.selected_index -= 1;
			} else if ( service_index === editor.selected_index ) {
				editor.selected_index = Math.min( service_index, editor.services.length - 1 );
			}

			render_service_editor();
			shell_api.clear_field_error( 'services' );
			status_message = source_service_id > 0
				? format_message( get_message( 'service_draft_pending', '%s will move to Draft when you save.' ), removed_service.title || get_message( 'new_service', 'New Service' ) )
				: get_message( 'service_removed', 'Unsaved Service removed from this setup.' );
			shell_api.set_status( status_message );

			focus_target = editor.list.querySelector( '[data-wpbc-remove-service="' + editor.selected_index + '"]' );
			if ( focus_target && focus_target.disabled ) {
				focus_target = editor.node.querySelector( '[data-wpbc-add-service]' );
			}
			if ( focus_target ) {
				focus_target.focus();
			}
		}

		/**
		 * Refresh all Service editor presentation and its JSON transport field.
		 *
		 * @return {void}
		 */
		function render_service_editor() {
			var add_button;

			if ( ! editor ) {
				return;
			}

			editor.selected_index = Math.min( editor.selected_index, editor.services.length - 1 );
			sync_transports();
			render_service_cards();
			load_selected_service();
			add_button = editor.node.querySelector( '[data-wpbc-add-service]' );
			if ( add_button ) {
				add_button.disabled = editor.services.length >= editor.max_services;
			}
		}

		/**
		 * Handle Service editor button actions.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var add_button = event.target.closest( '[data-wpbc-add-service]' );
			var remove_service_button = event.target.closest( '[data-wpbc-remove-service]' );
			var remove_picture_button = event.target.closest( '[data-wpbc-remove-service-picture]' );

			if ( remove_service_button ) {
				event.preventDefault();
				event.stopPropagation();
				remove_service( parseInt( remove_service_button.dataset.wpbcRemoveService, 10 ) );
				return;
			}

			if ( add_button ) {
				event.preventDefault();
				if ( editor.services.length >= editor.max_services ) {
					shell_api.set_status( get_message( 'service_limit', 'The maximum number of Service drafts has been reached.' ) );
					return;
				}

				sync_selected_service();
				editor.services.push( create_service_draft() );
				editor.selected_index = editor.services.length - 1;
				render_service_editor();
				get_service_field( 'title' ).select();
				return;
			}

			if ( remove_picture_button ) {
				event.preventDefault();
				get_service_field( 'picture_url' ).value = '';
				sync_selected_service();
				update_service_picture();
				render_service_cards();
			}
		}

		/**
		 * Handle selection and committed field changes.
		 *
		 * @param {Event} event Delegated change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			if ( event.target.matches( '[data-wpbc-service-selection]' ) ) {
				sync_selected_service();
				editor.selected_index = parseInt( event.target.dataset.wpbcServiceSelection, 10 );
				render_service_editor();
				return;
			}

			if ( event.target.matches( '[data-wpbc-service-field]' ) ) {
				sync_range_from_number( event.target.dataset.wpbcServiceField );
				sync_selected_service();
				update_service_picture();
				update_service_summary();
				render_service_cards();
				shell_api.clear_field_error( 'services' );
			}
		}

		/**
		 * Handle live number, range, and text edits.
		 *
		 * @param {InputEvent} event Delegated input event.
		 * @return {void}
		 */
		function handle_input( event ) {
			var field_name;
			var number_control;

			if ( event.target.matches( '[data-wpbc-service-range]' ) ) {
				field_name = event.target.dataset.wpbcServiceRange;
				number_control = get_service_field( field_name );
				if ( number_control ) {
					number_control.value = event.target.value;
				}
			} else if ( event.target.matches( '[data-wpbc-service-field]' ) ) {
				field_name = event.target.dataset.wpbcServiceField;
				sync_range_from_number( field_name );
			} else {
				return;
			}

			sync_selected_service();
			update_service_picture();
			update_service_summary();
			render_service_cards();
			shell_api.clear_field_error( 'services' );
		}

		/**
		 * Refresh the media preview after the shared WordPress picker writes a URL.
		 *
		 * @return {void}
		 */
		function handle_media_url_set() {
			if ( ! editor ) {
				return;
			}

			sync_selected_service();
			update_service_picture();
			render_service_cards();
		}

		/**
		 * Initialize this module against shell-provided services.
		 *
		 * @param {Object} registered_shell_api Shared wizard adapter services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var parsed_services;
			var parsed_inactive_service_ids;
			var editor_node;
			var transport;
			var inactive_transport;

			shell_api = registered_shell_api;
			root = shell_api.root;
			editor_node = root.querySelector( '[data-wpbc-services-editor]' );
			transport = root.querySelector( '[data-wpbc-service-draft]' );
			inactive_transport = root.querySelector( '[data-wpbc-inactive-service-ids]' );
			if ( ! editor_node || ! transport || ! inactive_transport ) {
				return;
			}

			try {
				parsed_services = JSON.parse( transport.value || '[]' );
			} catch ( parse_error ) {
				parsed_services = [];
			}
			if ( ! Array.isArray( parsed_services ) ) {
				parsed_services = [];
			}
			try {
				parsed_inactive_service_ids = JSON.parse( inactive_transport.value || '[]' );
			} catch ( inactive_parse_error ) {
				parsed_inactive_service_ids = [];
			}
			if ( ! Array.isArray( parsed_inactive_service_ids ) ) {
				parsed_inactive_service_ids = [];
			}
			parsed_inactive_service_ids = parsed_inactive_service_ids.map( Number ).filter( function ( service_id, service_index, service_ids ) {
				return isFinite( service_id ) && service_id === Math.floor( service_id ) && service_id > 0 && service_ids.indexOf( service_id ) === service_index;
			} );

			editor = {
				node: editor_node,
				transport: transport,
				inactive_transport: inactive_transport,
				list: editor_node.querySelector( '[data-wpbc-services-list]' ),
				template: root.querySelector( '[data-wpbc-service-card-template]' ),
				services: parsed_services,
				inactive_service_ids: parsed_inactive_service_ids,
				selected_index: 0,
				max_services: parseInt( transport.dataset.maxServices || '20', 10 ),
				pricing_available: 'true' === editor_node.dataset.pricingAvailable
			};

			if ( ! editor.services.length ) {
				editor.services.push( create_service_draft() );
			}

			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			editor.node.addEventListener( 'input', handle_input );
			$( document ).on( 'wpbc_media_upload_url_set.wpbcSetupWizardServices', '#wpbc-setup-wizard-service-picture-url', handle_media_url_set );
			render_service_editor();
		}

		/**
		 * Validate all proposed Services before forward navigation.
		 *
		 * @return {HTMLElement|null} First invalid detail control, or null.
		 */
		function validate() {
			var first_invalid = null;

			if ( ! editor || ! editor.services.length ) {
				return shell_api.set_field_error( 'services', get_message( 'service_title_required', 'Enter a title for every Service.' ) );
			}

			sync_selected_service();
			editor.services.some( function ( service, service_index ) {
				var invalid_field_name = '';
				var numeric_fields = [
					{ key: 'duration_minutes', min: 1, max: 1440 },
					{ key: 'buffer_before_minutes', min: 0, max: 1440 },
					{ key: 'buffer_after_minutes', min: 0, max: 1440 }
				];
				var invalid_number = numeric_fields.some( function ( rule ) {
					var number_value = Number( service[ rule.key ] );
					var is_invalid = ! /^\d+$/.test( String( service[ rule.key ] ) ) || number_value < rule.min || number_value > rule.max;

					if ( is_invalid ) {
						invalid_field_name = rule.key;
					}
					return is_invalid;
				} );
				var base_cost = Number( service.base_cost );

				if ( ! invalid_number && editor.pricing_available && ( ! isFinite( base_cost ) || base_cost < 0 || base_cost > 1000 ) ) {
					invalid_number = true;
					invalid_field_name = 'base_cost';
				}

				if ( ! String( service.title || '' ).trim() || invalid_number ) {
					editor.selected_index = service_index;
					render_service_editor();
					first_invalid = get_service_field( ! String( service.title || '' ).trim() ? 'title' : invalid_field_name );
					shell_api.set_field_error( 'services', ! String( service.title || '' ).trim() ? get_message( 'service_title_required', 'Enter a title for every Service.' ) : get_message( 'service_number_invalid', 'Enter a valid number within the available range.' ) );
					return true;
				}
				return false;
			} );

			return first_invalid;
		}

		return {
			initialize: initialize,
			sync: sync_selected_service,
			validate: validate
		};
	}

	window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
	window.wpbc_setup_editor_modules.services = {
		create: create_services_adapter
	};

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_services_adapter( module_config ) );
	}
}( jQuery, window, document ) );
