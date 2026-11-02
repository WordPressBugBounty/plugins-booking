/**
 * Timeline per-Resource action menus and settings inspector adapter.
 *
 * The Resource domain owns requests, DTO interpretation, and templates. Shared
 * dropdown and inspector components exclusively own menu/dialog lifecycle,
 * keyboard operation, outside-click behavior, and focus restoration.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp ) {
	'use strict';

	var module_id = 'resource_settings';
	var inspector_instance_id = 'wpbc_timeline_resource_settings';
	var inherit_mode = 'inherit';
	var custom_mode = 'custom';

	/**
	 * Replace named placeholders in one translated plain-text label.
	 *
	 * @param {string} text   Translated source text.
	 * @param {Object} values Plain replacement values keyed without braces.
	 * @return {string} Interpolated plain text.
	 */
	function interpolate( text, values ) {
		Object.keys( values || {} ).forEach( function ( key ) {
			text = String( text || '' ).replace( new RegExp( '\\{' + key + '\\}', 'g' ), String( values[ key ] ) );
		} );

		return String( text || '' );
	}

	/**
	 * Extract one safe server error message from a jQuery AJAX result.
	 *
	 * @param {Object} response Optional JSON response.
	 * @param {Object} request  Optional failed XMLHttpRequest.
	 * @param {string} fallback Safe translated fallback.
	 * @return {string} User-facing plain text.
	 */
	function get_error_message( response, request, fallback ) {
		if ( response && response.data && response.data.message ) {
			return String( response.data.message );
		}
		if ( request && request.responseJSON && request.responseJSON.data && request.responseJSON.data.message ) {
			return String( request.responseJSON.data.message );
		}

		return String( fallback || '' );
	}

	/**
	 * Normalize an exact positive Resource identifier.
	 *
	 * @param {*} candidate Candidate identifier.
	 * @return {number} Positive integer or zero.
	 */
	function positive_resource_id( candidate ) {
		candidate = Number( candidate );

		return Number.isInteger( candidate ) && 0 < candidate ? candidate : 0;
	}

	/**
	 * Create the focused Resource-settings browser adapter.
	 *
	 * @param {Object}  context          Page-controller construction context.
	 * @param {Element} context.mount    Timeline mount.
	 * @param {Object}  context.settings Server-localized settings.
	 * @param {Function} context.announce Accessible announcement callback.
	 * @param {Function} context.refresh_after_mutation Canonical Timeline refresh callback.
	 * @return {Object|null} Lifecycle and row-refresh API.
	 */
	function create_resource_settings( context ) {
		var mount = context && context.mount ? context.mount : null;
		var settings = context && context.settings ? context.settings : {};
		var configuration = settings.resource_settings || {};
		var templates = configuration.templates || {};
		var i18n = configuration.i18n || {};
		var transport_root = settings.transport && 'object' === typeof settings.transport ? settings.transport : {};
		var transport = transport_root.resource_settings && 'object' === typeof transport_root.resource_settings ? transport_root.resource_settings : {};
		var transport_url = transport_root.url ? String( transport_root.url ) : '';
		var announce = context && 'function' === typeof context.announce ? context.announce : function () {};
		var refresh_after_mutation = context && 'function' === typeof context.refresh_after_mutation
			? context.refresh_after_mutation
			: function () {};
		var shared_templates = settings.shared_ui && settings.shared_ui.templates ? settings.shared_ui.templates : {};
		var inspector_host = null;
		var inspector_root = null;
		var inspector = null;
		var active_resource_id = 0;
		var active_resource_title = '';
		var clean_draft = '';
		var read_request = null;
		var mutation_request = null;
		var request_generation = 0;
		var is_dirty = false;
		var is_busy = false;
		var is_initialized = false;

		/**
		 * Return one fixed server-allow-listed WordPress template renderer.
		 *
		 * @param {string} template_id Allow-listed template identifier.
		 * @return {Function|null} Template renderer or null.
		 */
		function get_template_by_id( template_id ) {
			return template_id && wp && 'function' === typeof wp.template ? wp.template( template_id ) : null;
		}

		/**
		 * Return one Resource-settings domain template.
		 *
		 * @param {string} template_key Domain template key.
		 * @return {Function|null} Template renderer or null.
		 */
		function get_domain_template( template_key ) {
			return get_template_by_id( templates[ template_key ] );
		}

		/**
		 * Reset shared-menu selection so its single action remains repeatable.
		 *
		 * @param {HTMLElement} dropdown Shared dropdown root.
		 * @return {void}
		 */
		function reset_action_menu( dropdown ) {
			if ( ! dropdown ) {
				return;
			}
			dropdown.setAttribute( 'data-wpbc-shared-ui-dropdown-value', '' );
			Array.prototype.forEach.call( dropdown.querySelectorAll( '[data-wpbc-shared-ui-dropdown-option]' ), function ( option ) {
				option.setAttribute( 'aria-selected', 'false' );
				option.classList.remove( 'is-selected' );
			} );
		}

		/**
		 * Render one domain-owned row-actions host and shared dropdown menu.
		 *
		 * @param {HTMLElement} host     Timeline Resource-row integration host.
		 * @param {Object}      resource Authorized Resource summary already in the window DTO.
		 * @return {void}
		 */
		function render_row_actions( host, resource ) {
			var row_actions_template = get_domain_template( 'row_actions' );
			var dropdown_template = get_template_by_id( shared_templates.dropdown );
			var menu_host;
			var resource_id = positive_resource_id( resource && resource.id );

			if ( ! host || ! resource_id || ! row_actions_template || ! dropdown_template ) {
				return;
			}
			host.innerHTML = row_actions_template( { resource_id: resource_id } );
			menu_host = host.querySelector( '[data-wpbc-timeline-resource-settings-menu-host]' );
			if ( ! menu_host ) {
				return;
			}
			menu_host.innerHTML = dropdown_template( {
				id: 'wpbc_timeline_resource_actions_' + resource_id,
				class_name: 'wpbc_timeline_resource_settings__menu',
				label: interpolate( i18n.row_actions, { title: resource.title || '' } ),
				selected_value: '',
				selected_label: '',
				icon_class: 'wpbc-bi-three-dots-vertical',
				options: [
					{
						type: 'option',
						value: 'timeline_settings',
						label: i18n.timeline_settings,
						icon_class: 'wpbc-bi-sliders'
					}
				]
			} );
		}

		/**
		 * Return a normalized editable draft from the current form.
		 *
		 * @return {Object} Mode and template draft.
		 */
		function get_form_draft() {
			var form = inspector_root ? inspector_root.querySelector( '[data-wpbc-timeline-resource-settings-form]' ) : null;
			var selected_mode = form ? form.querySelector( 'input[name="wpbc_timeline_resource_title_mode"]:checked' ) : null;
			var template_input = form ? form.querySelector( '[data-wpbc-timeline-resource-settings-template]' ) : null;

			return {
				mode: selected_mode && custom_mode === selected_mode.value ? custom_mode : inherit_mode,
				template: template_input ? template_input.value : ''
			};
		}

		/**
		 * Update the browser dirty flag from the canonical form draft.
		 *
		 * @return {void}
		 */
		function update_dirty_state() {
			is_dirty = Boolean( clean_draft ) && JSON.stringify( get_form_draft() ) !== clean_draft;
		}

		/**
		 * Enable custom-template controls only for explicit custom mode.
		 *
		 * @return {void}
		 */
		function synchronize_custom_controls() {
			var form = inspector_root ? inspector_root.querySelector( '[data-wpbc-timeline-resource-settings-form]' ) : null;
			var custom_fields = form ? form.querySelector( '[data-wpbc-timeline-resource-custom-fields]' ) : null;
			var custom_controls = custom_fields ? custom_fields.querySelectorAll( 'input, button' ) : [];
			var is_custom = custom_mode === get_form_draft().mode;

			if ( custom_fields ) {
				custom_fields.classList.toggle( 'is-disabled', ! is_custom );
			}
			Array.prototype.forEach.call( custom_controls, function ( control ) {
				control.disabled = ! is_custom || is_busy;
			} );
		}

		/**
		 * Lock or unlock every settings control during a state-changing request.
		 *
		 * @param {boolean} should_lock Whether mutation controls must be locked.
		 * @return {void}
		 */
		function set_busy( should_lock ) {
			var controls = inspector_root ? inspector_root.querySelectorAll( '[data-wpbc-timeline-resource-settings-form] button, [data-wpbc-timeline-resource-settings-form] input' ) : [];

			is_busy = Boolean( should_lock );
			Array.prototype.forEach.call( controls, function ( control ) {
				control.disabled = is_busy;
			} );
			synchronize_custom_controls();
		}

		/**
		 * Render one authorized Resource-settings DTO inside the shared shell.
		 *
		 * @param {Object} dto          Exact server Resource-settings DTO.
		 * @param {string} announcement Accessible status announcement.
		 * @return {boolean} True when rendered successfully.
		 */
		function render_settings( dto, announcement ) {
			var header_template = get_domain_template( 'header' );
			var inspector_template = get_domain_template( 'inspector' );
			var title;
			var tokens;

			if ( ! inspector || ! header_template || ! inspector_template || ! dto || ! dto.resource || ! dto.booking_title ) {
				return false;
			}
			title = interpolate( i18n.inspector_title, { title: dto.resource.title || active_resource_title } );
			tokens = ( configuration.tokens || [] ).map( function ( token ) {
				return {
					value: String( token ),
					label: interpolate( i18n.insert_token_label, { token: token } )
				};
			} );
			inspector.set_header( header_template( { title: title } ), title );
			inspector.set_content(
				inspector_template( {
					booking_title: dto.booking_title,
					maximum_length: Number( configuration.maximum_length ) || 200,
					tokens: tokens,
					i18n: i18n
				} ),
				announcement || ''
			);
			clean_draft = JSON.stringify( get_form_draft() );
			is_dirty = false;
			set_busy( false );

			return true;
		}

		/**
		 * Abort only non-mutating reads and invalidate pending callbacks.
		 *
		 * @return {void}
		 */
		function abort_read() {
			request_generation += 1;
			if ( read_request && 'function' === typeof read_request.abort ) {
				read_request.abort();
			}
			read_request = null;
		}

		/**
		 * Restore focus to the same Resource action after canonical row replacement.
		 *
		 * Focus is restored only when row replacement left focus on the document body
		 * or on the original trigger. Deliberate focus movement is never overridden.
		 *
		 * @param {number}      resource_id  Authorized Resource identifier.
		 * @param {HTMLElement} old_trigger  Trigger focused before canonical refresh.
		 * @return {void}
		 */
		function restore_resource_action_focus( resource_id, old_trigger ) {
			var active_element = document.activeElement;
			var action_root;
			var trigger;

			if (
				! is_initialized
				|| ( active_element && document.body !== active_element && old_trigger !== active_element )
			) {
				return;
			}
			action_root = mount.querySelector( '[data-wpbc-timeline-resource-settings-actions="' + resource_id + '"]' );
			trigger = action_root ? action_root.querySelector( '[data-wpbc-shared-ui-dropdown-trigger]' ) : null;
			if ( ! trigger || 'function' !== typeof trigger.focus ) {
				return;
			}
			try {
				trigger.focus( { preventScroll: true } );
			} catch ( error ) {
				trigger.focus();
			}
		}

		/**
		 * Read and open one exact authorized Resource settings record.
		 *
		 * @param {number}      resource_id    Authorized Resource ID from the current window DTO.
		 * @param {string}      resource_title Authorized Resource title from the current window DTO.
		 * @param {HTMLElement} trigger        Shared dropdown trigger used for focus restoration.
		 * @return {void}
		 */
		function open_settings( resource_id, resource_title, trigger ) {
			var generation;

			if ( ! inspector || ! window.jQuery || ! transport_url || ! transport.read_action || ! transport.read_nonce ) {
				announce( i18n.load_error );
				return;
			}
			abort_read();
			active_resource_id = resource_id;
			active_resource_title = String( resource_title || '' );
			clean_draft = '';
			is_dirty = false;
			inspector.reset_header( interpolate( i18n.inspector_title, { title: active_resource_title } ) );
			inspector.open( trigger );
			inspector.set_loading( i18n.loading );
			generation = request_generation;
			read_request = window.jQuery.ajax( {
				url: transport_url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.read_action,
					nonce: transport.read_nonce,
					resource_id: resource_id
				}
			} );
			read_request.done( function ( response ) {
				if ( generation !== request_generation || resource_id !== active_resource_id || ! inspector.is_open() ) {
					return;
				}
				if ( ! response || ! response.success || ! render_settings( response.data, i18n.loaded ) ) {
					inspector.set_error( get_error_message( response, null, i18n.load_error ) );
				}
			} );
			read_request.fail( function ( request, request_status ) {
				if ( 'abort' !== request_status && generation === request_generation && resource_id === active_resource_id && inspector.is_open() ) {
					inspector.set_error( get_error_message( null, request, i18n.load_error ) );
				}
			} );
			read_request.always( function () {
				if ( generation === request_generation ) {
					read_request = null;
				}
			} );
		}

		/**
		 * Persist or reset the current Resource preference through its fixed endpoint.
		 *
		 * @param {string} operation `save` or `reset`.
		 * @return {void}
		 */
		function mutate_settings( operation ) {
			var is_reset = 'reset' === operation;
			var draft = get_form_draft();
			var action = is_reset ? transport.reset_action : transport.save_action;
			var generation = request_generation;
			var request_data;
			var resource_id;
			var restored_trigger;
			var refresh_request;

			if ( is_busy || ! active_resource_id ) {
				return;
			}
			if ( ! window.jQuery || ! transport_url || ! action || ! transport.write_nonce ) {
				announce( i18n.save_error );
				return;
			}
			set_busy( true );
			announce( is_reset ? i18n.resetting : i18n.saving );
			request_data = {
				action: action,
				nonce: transport.write_nonce,
				resource_id: active_resource_id
			};
			if ( ! is_reset ) {
				request_data.mode = draft.mode;
				request_data.template = draft.template;
			}
			mutation_request = window.jQuery.ajax( {
				url: transport_url,
				method: 'POST',
				dataType: 'json',
				data: request_data
			} );
			mutation_request.done( function ( response ) {
				if ( generation !== request_generation || ! inspector || ! inspector.is_open() ) {
					return;
				}
				if ( response && response.success && render_settings( response.data, is_reset ? i18n.reset_complete : i18n.saved ) ) {
					resource_id = active_resource_id;
					announce( is_reset ? i18n.reset_complete : i18n.saved );
					inspector.close( true );
					restored_trigger = document.activeElement;
					refresh_request = refresh_after_mutation();
					if ( refresh_request && 'function' === typeof refresh_request.done ) {
						refresh_request.done( function () {
							window.requestAnimationFrame( function () {
								restore_resource_action_focus( resource_id, restored_trigger );
							} );
						} );
					}
					return;
				}
				set_busy( false );
				announce( get_error_message( response, null, i18n.save_error ) );
			} );
			mutation_request.fail( function ( request ) {
				if ( generation === request_generation && inspector && inspector.is_open() ) {
					set_busy( false );
					announce( get_error_message( null, request, i18n.save_error ) );
				}
			} );
			mutation_request.always( function () {
				mutation_request = null;
			} );
		}

		/**
		 * Handle domain actions without taking over shared menu/dialog lifecycle.
		 *
		 * @param {Event} event Timeline delegated event.
		 * @return {void}
		 */
		function handle_event( event ) {
			var dropdown;
			var row_actions;
			var resource_id;
			var resource_row;
			var trigger;
			var form;
			var token_button;
			var template_input;

			if ( 'wpbc:shared-ui-dropdown-change' === event.type ) {
				dropdown = event.target.closest( '[data-wpbc-shared-ui-dropdown]' );
				row_actions = dropdown ? dropdown.closest( '[data-wpbc-timeline-resource-settings-actions]' ) : null;
				if ( ! row_actions || ! event.detail || 'timeline_settings' !== event.detail.value ) {
					return;
				}
				resource_id = positive_resource_id( row_actions.getAttribute( 'data-wpbc-timeline-resource-settings-actions' ) );
				resource_row = row_actions.closest( '[data-wpbc-timeline-row-side="resource"]' );
				trigger = dropdown.querySelector( '[data-wpbc-shared-ui-dropdown-trigger]' );
				reset_action_menu( dropdown );
				open_settings(
					resource_id,
					resource_row ? resource_row.getAttribute( 'data-wpbc-timeline-resource-title' ) : '',
					trigger
				);
				return;
			}

			form = event.target.closest( '[data-wpbc-timeline-resource-settings-form]' );
			if ( ! form ) {
				return;
			}
			if ( 'submit' === event.type ) {
				event.preventDefault();
				mutate_settings( 'save' );
				return;
			}
			if ( 'click' === event.type && event.target.closest( '[data-wpbc-timeline-resource-settings-reset]' ) ) {
				event.preventDefault();
				mutate_settings( 'reset' );
				return;
			}
			token_button = 'click' === event.type ? event.target.closest( '[data-wpbc-timeline-resource-settings-token]' ) : null;
			if ( token_button ) {
				template_input = form.querySelector( '[data-wpbc-timeline-resource-settings-template]' );
				if ( template_input && ! template_input.disabled ) {
					template_input.setRangeText(
						token_button.getAttribute( 'data-wpbc-timeline-resource-settings-token' ) || '',
						template_input.selectionStart,
						template_input.selectionEnd,
						'end'
					);
					template_input.focus();
					update_dirty_state();
				}
				return;
			}
			if ( 'change' === event.type || 'input' === event.type ) {
				synchronize_custom_controls();
				update_dirty_state();
			}
		}

		/**
		 * Mount the shared inspector shell and delegated domain event handlers.
		 *
		 * @return {void}
		 */
		function initialize() {
			var shell_template = get_template_by_id( shared_templates.inspector );

			if (
				is_initialized || ! mount || ! shell_template || ! window.wpbc_shared_ui_inspector ||
				'function' !== typeof window.wpbc_shared_ui_inspector.create
			) {
				return;
			}
			inspector_host = mount.querySelector( '[data-wpbc-timeline-resource-settings-inspector-host]' );
			if ( ! inspector_host ) {
				return;
			}
			inspector_host.innerHTML = shell_template( {
				id: inspector_instance_id,
				title: i18n.timeline_settings,
				close_label: i18n.close,
				loading_label: i18n.loading
			} );
			inspector_root = inspector_host.querySelector( '[data-wpbc-shared-ui-inspector]' );
			inspector = window.wpbc_shared_ui_inspector.create( inspector_root, {
				owner_id: inspector_instance_id,
				interaction_group: 'wpbc_timeline_resource_settings',
				on_before_close: function () {
					if ( is_busy ) {
						return false;
					}

					return ! is_dirty || window.confirm( i18n.discard_changes || '' );
				},
				on_close: function () {
					abort_read();
					active_resource_id = 0;
					active_resource_title = '';
					clean_draft = '';
					is_dirty = false;
				}
			} );
			if ( ! inspector ) {
				return;
			}
			mount.addEventListener( 'wpbc:shared-ui-dropdown-change', handle_event );
			inspector_root.addEventListener( 'submit', handle_event );
			inspector_root.addEventListener( 'click', handle_event );
			inspector_root.addEventListener( 'change', handle_event );
			inspector_root.addEventListener( 'input', handle_event );
			is_initialized = true;
		}

		/**
		 * Render action menus for every currently visible authorized Resource row.
		 *
		 * @param {Array<Object>} resources Current Timeline Resource summaries.
		 * @return {void}
		 */
		function refresh( resources ) {
			var resources_by_id = Object.create( null );

			( Array.isArray( resources ) ? resources : [] ).forEach( function ( resource ) {
				var resource_id = positive_resource_id( resource && resource.id );

				if ( resource_id ) {
					resources_by_id[ resource_id ] = resource;
				}
			} );
			Array.prototype.forEach.call( mount.querySelectorAll( '[data-wpbc-timeline-resource-actions-host]' ), function ( host ) {
				var resource_id = positive_resource_id( host.getAttribute( 'data-wpbc-timeline-resource-actions-host' ) );

				if ( resources_by_id[ resource_id ] ) {
					render_row_actions( host, resources_by_id[ resource_id ] );
				}
			} );
		}

		/**
		 * Release requests, listeners, and shared shell state.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! is_initialized ) {
				return;
			}
			abort_read();
			is_busy = false;
			is_dirty = false;
			if ( inspector && inspector.is_open() ) {
				inspector.close( false );
			}
			mount.removeEventListener( 'wpbc:shared-ui-dropdown-change', handle_event );
			inspector_root.removeEventListener( 'submit', handle_event );
			inspector_root.removeEventListener( 'click', handle_event );
			inspector_root.removeEventListener( 'change', handle_event );
			inspector_root.removeEventListener( 'input', handle_event );
			if ( mutation_request && 'function' === typeof mutation_request.abort ) {
				mutation_request.abort();
			}
			mutation_request = null;
			inspector_host.textContent = '';
			inspector = null;
			inspector_root = null;
			is_initialized = false;
		}

		return {
			initialize: initialize,
			refresh: refresh,
			destroy: destroy
		};
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_resource_settings );
	}
}( window, document, window.wp ) );
