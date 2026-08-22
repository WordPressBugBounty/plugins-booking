/**
 * Control shared request sequences and render normalized catalog responses.
 *
 * Domain scripts provide configuration and domain-specific interactions. This
 * controller owns only allow-listed WP templates, shared response validation,
 * loading, empty, populated, error, and stale-response mechanics.
 *
 * @since 11.6.0
 */
( function ( window, document ) {
	'use strict';

	var catalog_states = {};

	/**
	 * Return a normalized non-negative request sequence.
	 *
	 * @param {*} sequence Candidate request sequence.
	 * @return {number|null} Sequence or null when malformed.
	 */
	function normalize_sequence( sequence ) {
		var normalized_sequence;

		if ( 'number' === typeof sequence && isFinite( sequence ) && Math.floor( sequence ) === sequence ) {
			normalized_sequence = sequence;
		} else if ( 'string' === typeof sequence && /^\d+$/.test( sequence ) ) {
			normalized_sequence = parseInt( sequence, 10 );
		} else {
			return null;
		}

		return 0 <= normalized_sequence ? normalized_sequence : null;
	}

	/**
	 * Return a supported positive response schema version.
	 *
	 * WordPress localizes top-level scalar values as strings, so the registered
	 * configuration may contain "1" while the nested response retains number 1.
	 *
	 * @param {*} schema_version Candidate schema version.
	 * @return {number|null} Supported version or null.
	 */
	function normalize_schema_version( schema_version ) {
		var normalized_version = normalize_sequence( schema_version );

		return 1 === normalized_version ? normalized_version : null;
	}

	/**
	 * Return one catalog's request state.
	 *
	 * @param {string} catalog_id Registered catalog identifier.
	 * @return {Object|null} Mutable catalog state or null.
	 */
	function get_catalog_state( catalog_id ) {
		if ( ! catalog_id || 'string' !== typeof catalog_id ) {
			return null;
		}

		if ( ! catalog_states[ catalog_id ] ) {
			catalog_states[ catalog_id ] = {
				actions_controller: null,
				abort_controller: null,
				config: null,
				content_element: null,
				latest_sequence: 0,
				preference_abort_controller: null,
				preference_revision: 0,
				request_values: {},
				search_timer: 0,
				selection_controller: null,
				sortable: null
			};
		}

		return catalog_states[ catalog_id ];
	}

	/**
	 * Return the registered, bounded delay for an incremental search request.
	 *
	 * Search timing is a domain-neutral interaction mechanic. Catalogs may tune
	 * the delay through their server-normalized configuration without replacing
	 * the shared request controller.
	 *
	 * @param {Object} config Registered browser configuration.
	 * @return {number} Delay in milliseconds between zero and 2000.
	 */
	function get_search_debounce_delay( config ) {
		var search_config = config && config.search && 'object' === typeof config.search ? config.search : {};
		var debounce_delay = Number( search_config.debounce_delay_ms );

		if ( ! isFinite( debounce_delay ) || debounce_delay < 0 ) {
			return 300;
		}

		return Math.min( 2000, Math.floor( debounce_delay ) );
	}

	/**
	 * Determine whether clearing search bypasses the incremental-search delay.
	 *
	 * Immediate clear remains the compatibility default. A catalog may disable
	 * it only through server-normalized, domain-neutral search configuration.
	 *
	 * @param {Object} config Registered browser configuration.
	 * @return {boolean} True when Clear must request unfiltered results now.
	 */
	function is_immediate_search_clear_enabled( config ) {
		return ! config || ! config.search || false !== config.search.immediate_clear;
	}

	/**
	 * Start a new request sequence for one catalog.
	 *
	 * @param {string} catalog_id Registered catalog identifier.
	 * @return {number} New sequence, or zero for an invalid catalog.
	 */
	function next_request_sequence( catalog_id ) {
		var catalog_state = get_catalog_state( catalog_id );

		if ( ! catalog_state ) {
			return 0;
		}

		catalog_state.latest_sequence += 1;

		return catalog_state.latest_sequence;
	}

	/**
	 * Determine whether a response belongs to an older request.
	 *
	 * @param {string} catalog_id Registered catalog identifier.
	 * @param {*}      sequence   Response request sequence.
	 * @return {boolean} True when the response must not render.
	 */
	function is_stale_response( catalog_id, sequence ) {
		var catalog_state = get_catalog_state( catalog_id );
		var normalized_sequence = normalize_sequence( sequence );

		return ! catalog_state || null === normalized_sequence || normalized_sequence < catalog_state.latest_sequence;
	}

	/**
	 * Resolve one allow-listed template identifier from the configuration.
	 *
	 * @param {Object} config        Registered browser configuration.
	 * @param {string} template_role Template role such as empty or error.
	 * @return {string} Template identifier or an empty string.
	 */
	function get_template_id( config, template_role ) {
		var catalog_state;
		var initial_request;
		var template_id = '';
		var template_pack;
		var template_pack_id;

		if ( ! config || ! config.templates || 'string' !== typeof template_role ) {
			return '';
		}

		if ( 'string' === typeof config.templates[ template_role ] ) {
			template_id = config.templates[ template_role ];
		}

		catalog_state    = ( config.catalog_id || config.id ) ? get_catalog_state( config.catalog_id || config.id ) : null;
		initial_request  = config.initial_request || {};
		template_pack_id = catalog_state && catalog_state.request_values.template_pack
			? catalog_state.request_values.template_pack
			: initial_request.template_pack;
		template_pack    = config.template_packs && config.template_packs[ template_pack_id ];

		if ( template_pack && 'string' === typeof template_pack[ template_role ] ) {
			template_id = template_pack[ template_role ];
		}

		return /^[a-z0-9_-]+$/.test( template_id ) ? template_id : '';
	}

	/**
	 * Synchronize one server-authoritative allow-listed presentation pack.
	 *
	 * The active pack is shared presentation state only. Updating it before an
	 * items template is resolved allows an AJAX response to switch markup while
	 * leaving the provider, DTO, authorization, and mutation paths unchanged.
	 *
	 * @param {Object} config           Registered browser configuration.
	 * @param {*}      template_pack_id Candidate pack identifier from a response.
	 * @return {string} Active allow-listed pack identifier.
	 */
	function set_active_template_pack( config, template_pack_id ) {
		var catalog_root;
		var catalog_state = config && config.catalog_id ? get_catalog_state( config.catalog_id ) : null;
		var normalized_pack_id = 'string' === typeof template_pack_id ? template_pack_id : '';

		if ( ! catalog_state || ! config.template_packs || ! config.template_packs[ normalized_pack_id ] ) {
			normalized_pack_id = config && config.default_template_pack && config.template_packs
				&& config.template_packs[ config.default_template_pack ]
				? config.default_template_pack
				: '';
		}
		if ( ! normalized_pack_id ) {
			return '';
		}

		catalog_state.request_values.template_pack = normalized_pack_id;
		catalog_root = catalog_state.content_element
			? catalog_state.content_element.closest( '[data-wpbc-catalog-id]' )
			: null;
		if ( catalog_root ) {
			catalog_root.setAttribute( 'data-wpbc-template-pack', normalized_pack_id );
		}

		return normalized_pack_id;
	}

	/**
	 * Compile one allow-listed WordPress template.
	 *
	 * @param {Object} config        Registered browser configuration.
	 * @param {string} template_role Template role.
	 * @return {Function|null} Compiled template or null.
	 */
	function load_template( config, template_role ) {
		var template_id = get_template_id( config, template_role );

		if ( ! template_id || ! window.wp || 'function' !== typeof window.wp.template ) {
			return null;
		}

		try {
			return window.wp.template( template_id );
		} catch ( error ) {
			return null;
		}
	}

	/**
	 * Replace one catalog's current presentation with rendered template output.
	 *
	 * @param {Object} config        Registered browser configuration.
	 * @param {string} template_role Allow-listed template role.
	 * @param {Object} template_data Normalized template data.
	 * @return {boolean} True when rendered.
	 */
	function render_template( config, template_role, template_data ) {
		var catalog_root;
		var catalog_state = get_catalog_state( config.catalog_id );
		var render_target;
		var rendered_html;
		var template = load_template( config, template_role );

		if ( ! catalog_state || ! catalog_state.content_element || ! template ) {
			return false;
		}

		try {
			rendered_html = template( template_data || {} );
		} catch ( error ) {
			return false;
		}

		render_target = catalog_state.response_element || catalog_state.content_element;
		dispatch_catalog_event( config, 'wpbc:ui-catalog-before-render', {
			catalog_id: config.catalog_id,
			template_role: template_role
		} );
		render_target.innerHTML = rendered_html;
		catalog_root = catalog_state.content_element.parentNode;
		if ( catalog_root && 'function' === typeof catalog_root.setAttribute ) {
			catalog_root.setAttribute( 'aria-busy', 'shell' === template_role ? 'true' : 'false' );
		}
		if ( 'shell' !== template_role ) {
			set_catalog_loading_state( config, false );
		}

		return true;
	}

	/**
	 * Toggle a persistent catalog overlay without removing the current rows.
	 *
	 * Catalogs with a dedicated overlay keep their existing table visible beneath
	 * the Booking Calendar spinner. Generic catalogs retain the shell-template
	 * fallback when no overlay is declared.
	 *
	 * @param {Object}  config     Registered browser configuration.
	 * @param {boolean} is_loading Whether a request is active.
	 * @return {boolean} True when a persistent overlay was updated.
	 */
	function set_catalog_loading_state( config, is_loading ) {
		var catalog_state = config && config.catalog_id ? get_catalog_state( config.catalog_id ) : null;
		var loading_element = catalog_state ? catalog_state.loading_element : null;

		if ( catalog_state && catalog_state.content_element ) {
			catalog_state.content_element.setAttribute( 'aria-busy', is_loading ? 'true' : 'false' );
		}
		if ( ! loading_element ) {
			return false;
		}

		loading_element.classList.toggle( 'is-visible', !! is_loading );
		return true;
	}

	/**
	 * Set the table minimum width from currently visible header contracts.
	 *
	 * Domain styles declare `--wpbc-listing-column-min-width` per column. The
	 * shared controller sums only rendered headers so wide/custom views scroll
	 * horizontally while short presets continue filling the available panel.
	 *
	 * @param {Object} config Registered browser configuration.
	 * @return {void}
	 */
	function sync_catalog_table_min_width( config ) {
		var mount_element = config && config.mount_id ? document.getElementById( config.mount_id ) : null;
		var table = mount_element ? mount_element.querySelector( '.wpbc_ui_listing__table--catalog' ) : null;
		var header_cells;
		var table_min_width = 0;

		if ( ! table || 'function' !== typeof window.getComputedStyle ) {
			return;
		}
		header_cells = Array.prototype.filter.call( table.querySelectorAll( 'thead > tr > th' ), function ( header_cell ) {
			return ! header_cell.hidden;
		} );
		header_cells.forEach( function ( header_cell ) {
			var column_min_width = parseFloat(
				window.getComputedStyle( header_cell ).getPropertyValue( '--wpbc-listing-column-min-width' )
			);
			if ( isFinite( column_min_width ) && 0 < column_min_width ) {
				table_min_width += column_min_width;
			}
		} );
		if ( 0 < table_min_width ) {
			table.style.setProperty( '--wpbc-listing-table-min-width', Math.ceil( table_min_width ) + 'px' );
		}
	}

	/**
	 * Keep the open column customizer inside the usable browser viewport.
	 *
	 * @param {HTMLDetailsElement} customizer Column customizer details element.
	 * @return {void}
	 */
	function position_display_panel( customizer ) {
		var panel = customizer ? customizer.querySelector( '.wpbc_ui_listing__display_panel' ) : null;
		var summary = customizer ? customizer.querySelector( 'summary' ) : null;
		var field_list = customizer ? customizer.querySelector( '[data-wpbc-ui-catalog-column-list]' ) : null;
		var summary_rect;
		var panel_rect;
		var viewport_width;
		var viewport_height;
		var margin = 12;
		var gap = 6;
		var space_above;
		var space_below;
		var natural_height;
		var open_above;
		var available_height;
		var rendered_height;
		var panel_left;
		var panel_top;

		if ( ! customizer || ! customizer.open || ! panel || ! summary ) {
			return;
		}

		customizer.classList.remove( 'is-positioned' );
		panel.style.removeProperty( '--wpbc-listing-display-panel-max-height' );
		panel.style.removeProperty( 'left' );
		panel.style.removeProperty( 'top' );
		summary_rect = summary.getBoundingClientRect();
		panel_rect = panel.getBoundingClientRect();
		viewport_width = document.documentElement.clientWidth || window.innerWidth || 0;
		viewport_height = window.innerHeight || document.documentElement.clientHeight || 0;
		space_above = Math.max( 0, summary_rect.top - margin - gap );
		space_below = Math.max( 0, viewport_height - summary_rect.bottom - margin - gap );
		natural_height = panel.scrollHeight;
		if ( field_list ) {
			natural_height += Math.max( 0, field_list.scrollHeight - field_list.clientHeight );
		}
		open_above = space_below < natural_height && space_above > space_below;
		available_height = open_above ? space_above : space_below;
		customizer.classList.toggle( 'is-open-above', open_above );
		panel.style.setProperty( '--wpbc-listing-display-panel-max-height', Math.floor( available_height ) + 'px' );
		rendered_height = panel.getBoundingClientRect().height;
		panel_left = Math.max( margin, Math.min( summary_rect.right - panel_rect.width, viewport_width - panel_rect.width - margin ) );
		panel_top = open_above ? summary_rect.top - gap - rendered_height : summary_rect.bottom + gap;
		panel_top = Math.max( margin, Math.min( panel_top, viewport_height - rendered_height - margin ) );
		panel.style.setProperty( 'left', Math.round( panel_left ) + 'px' );
		panel.style.setProperty( 'top', Math.round( panel_top ) + 'px' );
		customizer.classList.add( 'is-positioned' );
	}

	/**
	 * Clear fixed column-panel coordinates after the customizer closes.
	 *
	 * @param {HTMLDetailsElement} customizer Column customizer details element.
	 * @return {void}
	 */
	function reset_display_panel_position( customizer ) {
		var panel = customizer ? customizer.querySelector( '.wpbc_ui_listing__display_panel' ) : null;

		if ( ! customizer || ! panel ) {
			return;
		}
		customizer.classList.remove( 'is-open-above', 'is-positioned' );
		panel.style.removeProperty( '--wpbc-listing-display-panel-max-height' );
		panel.style.removeProperty( 'left' );
		panel.style.removeProperty( 'top' );
	}

	/**
	 * Close one column customizer and optionally return focus to its summary.
	 *
	 * Keyboard and explicit Close-button dismissal restore focus to the control
	 * that opened the panel. Pointer dismissal keeps the pointer's natural focus
	 * destination while sharing the same details-toggle cleanup path.
	 *
	 * @param {HTMLDetailsElement|null} customizer    Column customizer details element.
	 * @param {boolean}                 restore_focus Whether summary focus is restored.
	 * @return {void}
	 */
	function close_display_customizer( customizer, restore_focus ) {
		var summary;

		if ( ! customizer || ! customizer.open ) {
			return;
		}
		customizer.open = false;
		if ( ! restore_focus ) {
			return;
		}
		summary = customizer.querySelector( 'summary' );
		if ( summary && 'function' === typeof summary.focus ) {
			summary.focus();
		}
	}

	/**
	 * Render a generic safe browser error.
	 *
	 * @param {Object} config  Registered browser configuration.
	 * @param {string} message Safe localized error message.
	 * @return {boolean} True when rendered.
	 */
	function render_error( config, message ) {
		var i18n = config.i18n || {};

		return render_template( config, 'error', {
			title: i18n.error_title || '',
			message: message || i18n.error_message || ''
		} );
	}

	/**
	 * Dispatch one shared catalog lifecycle event from the current mount.
	 *
	 * @param {Object} config     Registered browser configuration.
	 * @param {string} event_name Stable shared event name.
	 * @param {Object} detail     JSON-safe event detail.
	 * @return {boolean} True when the event was dispatched.
	 */
	function dispatch_catalog_event( config, event_name, detail ) {
		var catalog_event;
		var catalog_state = get_catalog_state( config.catalog_id );

		if ( ! catalog_state || ! catalog_state.content_element || 'string' !== typeof event_name ) {
			return false;
		}

		if ( 'function' === typeof window.CustomEvent ) {
			catalog_event = new window.CustomEvent( event_name, {
				bubbles: true,
				detail: detail || {}
			} );
		} else {
			catalog_event = document.createEvent( 'CustomEvent' );
			catalog_event.initCustomEvent( event_name, true, false, detail || {} );
		}

		catalog_state.content_element.dispatchEvent( catalog_event );

		return true;
	}

	/**
	 * Append one normalized request value to a URL-encoded AJAX body.
	 *
	 * @param {URLSearchParams} request_body  Request body receiving values.
	 * @param {string}          request_key   Normalized request key.
	 * @param {*}               request_value Scalar or scalar-array value.
	 * @return {void}
	 */
	function append_request_value( request_body, request_key, request_value ) {
		if ( Array.isArray( request_value ) ) {
			request_value.forEach( function ( array_value ) {
				if ( null !== array_value && 'object' !== typeof array_value ) {
					request_body.append( request_key + '[]', String( array_value ) );
				}
			} );
			return;
		}

		if ( null !== request_value && 'undefined' !== typeof request_value && 'object' !== typeof request_value ) {
			request_body.append( request_key, String( request_value ) );
		}
	}

	/**
	 * Return ordered column IDs from the current display controls.
	 *
	 * @param {HTMLElement} mount_element Catalog mount element.
	 * @return {string[]} Current column order.
	 */
	function get_column_order( mount_element ) {
		return Array.prototype.slice.call( mount_element.querySelectorAll( '[data-wpbc-ui-catalog-column-item]' ) ).map( function ( column_item ) {
			return column_item.getAttribute( 'data-wpbc-ui-catalog-column-item' ) || '';
		} ).filter( function ( column_id ) {
			return !! column_id;
		} );
	}

	/**
	 * Return visible column IDs from the current display controls.
	 *
	 * @param {HTMLElement} mount_element Catalog mount element.
	 * @return {string[]} Current visible columns.
	 */
	function get_visible_columns( mount_element ) {
		return Array.prototype.slice.call( mount_element.querySelectorAll( '[data-wpbc-ui-catalog-column-visible]' ) ).filter( function ( column_control ) {
			return column_control.checked;
		} ).map( function ( column_control ) {
			return column_control.value;
		} );
	}

	/**
	 * Request the current column controls and persist the validated result.
	 *
	 * @param {Object}      config        Registered browser configuration.
	 * @param {HTMLElement} mount_element Catalog mount element.
	 * @return {Promise<boolean>} Shared request result.
	 */
	function save_column_controls( config, mount_element ) {
		var view_control = mount_element.querySelector( '[data-wpbc-ui-catalog-view]' );

		if ( view_control ) {
			view_control.value = 'custom';
		}

		return request_catalog( config, {
			column_order: get_column_order( mount_element ),
			page_number: 1,
			preference_action: 'save',
			visible_columns: get_visible_columns( mount_element )
		} );
	}

	/**
	 * Announce a completed column-order change to assistive technology.
	 *
	 * @param {Object}      config        Registered browser configuration.
	 * @param {HTMLElement} mount_element Catalog mount element.
	 * @return {void}
	 */
	function announce_column_moved( config, mount_element ) {
		var status_element = mount_element.querySelector( '[data-wpbc-ui-catalog-column-status]' );

		if ( ! status_element ) {
			return;
		}
		status_element.textContent = '';
		window.setTimeout( function () {
			status_element.textContent = config.i18n && config.i18n.column_moved ? config.i18n.column_moved : '';
		}, 0 );
	}

	/**
	 * Synchronize the current catalog state into the initial URL aliases.
	 *
	 * Search and page number remain request-local but survive a normal refresh
	 * through the URL. Persisted settings are also reflected for shareable state.
	 *
	 * @param {Object} config   Registered browser configuration.
	 * @param {Object} response Normalized successful response.
	 * @return {void}
	 */
	function update_url_state( config, response ) {
		var filters = response.filters || {};
		var parameters = config.url_parameters || {};
		var state_values = {
			page_number: response.pagination.page_number,
			items_per_page: response.pagination.items_per_page,
			sort_by: response.sorting.sort_by,
			sort_order: response.sorting.sort_order,
			search: filters.search || '',
			visible_columns: response.display.visible_columns || [],
			column_order: response.display.column_order || [],
			template_pack: response.display.template_pack || ''
		};
		var page_url;

		if ( ! window.history || 'function' !== typeof window.history.replaceState || 'function' !== typeof window.URL ) {
			return;
		}

		page_url = new window.URL( window.location.href );
		Object.keys( filters ).forEach( function ( filter_key ) {
			state_values[ filter_key ] = filters[ filter_key ];
		} );
		Object.keys( parameters ).forEach( function ( state_key ) {
			var parameter_name = parameters[ state_key ];
			var state_value = state_values[ state_key ];
			if ( ! parameter_name ) {
				return;
			}
			if ( Array.isArray( state_value ) ) {
				state_value = state_value.join( ',' );
			}
			if ( '' === state_value || null === state_value || 'undefined' === typeof state_value ) {
				page_url.searchParams.delete( parameter_name );
			} else {
				page_url.searchParams.set( parameter_name, String( state_value ) );
			}
		} );
		window.history.replaceState( {}, document.title, page_url.toString() );
	}

	/**
	 * Bind domain-neutral delegated catalog controls once per mount.
	 *
	 * @param {Object}      config        Registered browser configuration.
	 * @param {HTMLElement} mount_element Catalog mount element.
	 * @return {void}
	 */
	function bind_catalog_controls( config, mount_element ) {
		var catalog_state = get_catalog_state( config.catalog_id );

		if ( ! catalog_state || mount_element._wpbc_ui_catalog_controls_bound ) {
			return;
		}
		mount_element._wpbc_ui_catalog_controls_bound = true;

		mount_element.addEventListener( 'submit', function ( event ) {
			var search_control;
			if ( ! event.target.matches( '[data-wpbc-ui-catalog-filters]' ) ) {
				return;
			}
			event.preventDefault();
			search_control = mount_element.querySelector( '[data-wpbc-ui-catalog-search]' );
			request_catalog( config, { page_number: 1, search: search_control ? search_control.value : '' } );
		} );

		mount_element.addEventListener( 'input', function ( event ) {
			var clear_control;
			if ( ! event.target.matches( '[data-wpbc-ui-catalog-search]' ) ) {
				return;
			}
			clear_control = mount_element.querySelector( '[data-wpbc-ui-catalog-search-clear]' );
			if ( clear_control ) {
				clear_control.hidden = ! event.target.value;
			}
			window.clearTimeout( catalog_state.search_timer );
			catalog_state.search_timer = window.setTimeout( function () {
				request_catalog( config, { page_number: 1, search: event.target.value || '' } );
			}, get_search_debounce_delay( config ) );
		} );

		mount_element.addEventListener( 'change', function ( event ) {
			var default_request = config.default_request || {};
			var filter_key;
			if ( event.target.matches( '[data-wpbc-ui-catalog-items-per-page]' ) ) {
				request_catalog( config, { items_per_page: Number( event.target.value ), page_number: 1, preference_action: 'save' } );
			} else if ( event.target.matches( '[data-wpbc-ui-catalog-page-number]' ) ) {
				request_catalog( config, { page_number: Number( event.target.value ) || 1 } );
			} else if ( event.target.matches( '[data-wpbc-ui-catalog-template-pack]' ) ) {
				if ( config.template_packs && config.template_packs[ event.target.value ] ) {
					request_catalog( config, {
						page_number: 1,
						preference_action: 'save',
						template_pack: event.target.value
					} );
				}
			} else if ( event.target.matches( '[data-wpbc-ui-catalog-filter]' ) ) {
				filter_key = event.target.getAttribute( 'data-wpbc-ui-catalog-filter' ) || '';
				if ( /^[a-z0-9_]+$/.test( filter_key ) ) {
					var filter_request = { page_number: 1, preference_action: 'save' };
					filter_request[ filter_key ] = event.target.value;
					request_catalog( config, filter_request );
				}
			} else if ( event.target.matches( '[data-wpbc-ui-catalog-column-visible]' ) ) {
				save_column_controls( config, mount_element );
			} else if ( event.target.matches( '[data-wpbc-ui-catalog-view]' ) && 'custom' !== event.target.value ) {
				var view_definition = config.views && config.views.definitions ? config.views.definitions[ event.target.value ] : null;
				if ( view_definition && Array.isArray( view_definition.fields ) ) {
					request_catalog( config, {
						page_number: 1,
						preference_action: 'save',
						visible_columns: view_definition.fields
					} );
				}
			}
		} );

		mount_element.addEventListener( 'click', function ( event ) {
			var close_control = event.target.closest( '[data-wpbc-ui-catalog-display-close]' );
			var default_request = config.default_request || {};
			var page_control = event.target.closest( '[data-wpbc-ui-catalog-page]' );
			var reset_control = event.target.closest( '[data-wpbc-ui-catalog-preferences-reset]' );
			var reset_order_control = event.target.closest( '[data-wpbc-ui-catalog-column-order-reset]' );
			var search_clear = event.target.closest( '[data-wpbc-ui-catalog-search-clear]' );
			var sort_control = event.target.closest( '[data-wpbc-ui-catalog-sort]' );
			var sort_key;

			if ( search_clear ) {
				event.preventDefault();
				var search_control = mount_element.querySelector( '[data-wpbc-ui-catalog-search]' );
				window.clearTimeout( catalog_state.search_timer );
				if ( search_control ) {
					search_control.value = '';
					search_control.focus();
				}
				search_clear.hidden = true;
				if ( is_immediate_search_clear_enabled( config ) ) {
					request_catalog( config, { page_number: 1, search: '' } );
				} else {
					catalog_state.search_timer = window.setTimeout( function () {
						request_catalog( config, { page_number: 1, search: '' } );
					}, get_search_debounce_delay( config ) );
				}
			} else if ( sort_control ) {
				event.preventDefault();
				sort_key = sort_control.getAttribute( 'data-wpbc-ui-catalog-sort' ) || '';
				request_catalog( config, {
					page_number: 1,
					preference_action: 'save',
					sort_by: sort_key,
					sort_order: sort_key === catalog_state.request_values.sort_by && 'asc' === catalog_state.request_values.sort_order ? 'desc' : 'asc'
				} );
			} else if ( page_control && ! page_control.disabled ) {
				event.preventDefault();
				request_catalog( config, { page_number: Number( page_control.getAttribute( 'data-wpbc-ui-catalog-page' ) ) || 1 } );
			} else if ( reset_order_control ) {
				event.preventDefault();
				request_catalog( config, { column_order: default_request.column_order || [], page_number: 1, preference_action: 'save' } );
			} else if ( reset_control ) {
				event.preventDefault();
				request_catalog( config, Object.assign( {}, default_request, { preference_action: 'reset' } ) );
			} else if ( close_control ) {
				event.preventDefault();
				var customizer = close_control.closest( '[data-wpbc-ui-catalog-display-customizer]' );
				close_display_customizer( customizer, true );
			}
		} );

		mount_element.addEventListener( 'keydown', function ( event ) {
			var customizer = event.target && 'function' === typeof event.target.closest
				? event.target.closest( '[data-wpbc-ui-catalog-display-customizer]' )
				: null;
			if ( 'Escape' !== event.key || ! customizer || ! customizer.open ) {
				return;
			}
			event.preventDefault();
			close_display_customizer( customizer, true );
		} );

		mount_element.addEventListener( 'toggle', function ( event ) {
			var customizer = event.target.closest( '[data-wpbc-ui-catalog-display-customizer]' );
			if ( ! customizer ) {
				return;
			}
			if ( customizer.open ) {
				window.requestAnimationFrame( function () {
					position_display_panel( customizer );
				} );
			} else {
				reset_display_panel_position( customizer );
			}
		}, true );

		document.addEventListener( 'click', function ( event ) {
			var customizer = mount_element.querySelector( '[data-wpbc-ui-catalog-display-customizer]' );
			if ( customizer && customizer.open && ! customizer.contains( event.target ) ) {
				close_display_customizer( customizer, false );
			}
		} );
		window.addEventListener( 'resize', function () {
			position_display_panel( mount_element.querySelector( '[data-wpbc-ui-catalog-display-customizer]' ) );
			sync_catalog_table_min_width( config );
		} );
		window.addEventListener( 'scroll', function ( event ) {
			var customizer = mount_element.querySelector( '[data-wpbc-ui-catalog-display-customizer]' );
			if (
				customizer
				&& customizer.open
				&& (
					! event.target
					|| 'function' !== typeof event.target.closest
					|| ! event.target.closest( '[data-wpbc-ui-catalog-display-customizer]' )
				)
			) {
				position_display_panel( customizer );
			}
		}, true );
	}

	/**
	 * Initialize pointer and keyboard column ordering after toolbar rendering.
	 *
	 * @param {Object} config Registered browser configuration.
	 * @return {void}
	 */
	function refresh_catalog_controls( config ) {
		var catalog_state = get_catalog_state( config.catalog_id );
		var mount_element = document.getElementById( config.mount_id );
		var column_list = mount_element ? mount_element.querySelector( '[data-wpbc-ui-catalog-column-list]' ) : null;

		if ( ! catalog_state || ! column_list || column_list._wpbc_ui_catalog_initialized ) {
			return;
		}
		column_list._wpbc_ui_catalog_initialized = true;
		column_list.addEventListener( 'keydown', function ( event ) {
			var handle = event.target.closest( '[data-wpbc-ui-catalog-column-drag-handle]' );
			var item;
			var sibling;
			if ( ! handle || ( 'ArrowUp' !== event.key && 'ArrowDown' !== event.key ) ) {
				return;
			}
			item = handle.closest( '[data-wpbc-ui-catalog-column-item]' );
			sibling = 'ArrowUp' === event.key ? item.previousElementSibling : item.nextElementSibling;
			while ( sibling && '1' !== sibling.getAttribute( 'data-wpbc-ui-catalog-column-reorderable' ) ) {
				sibling = 'ArrowUp' === event.key ? sibling.previousElementSibling : sibling.nextElementSibling;
			}
			if ( ! sibling ) {
				return;
			}
			event.preventDefault();
			if ( 'ArrowUp' === event.key ) {
				column_list.insertBefore( item, sibling );
			} else {
				column_list.insertBefore( sibling, item );
			}
			save_column_controls( config, mount_element );
			announce_column_moved( config, mount_element );
			handle.focus();
		} );

		if ( 'function' === typeof window.Sortable ) {
			catalog_state.sortable = new window.Sortable( column_list, {
				animation: 150,
				chosenClass: 'is-dragging',
				draggable: '[data-wpbc-ui-catalog-column-reorderable="1"]',
				ghostClass: 'is-drag-placeholder',
				handle: '[data-wpbc-ui-catalog-column-drag-handle]',
				onEnd: function ( sort_event ) {
					if ( sort_event.oldIndex !== sort_event.newIndex ) {
						save_column_controls( config, mount_element );
						announce_column_moved( config, mount_element );
					}
				}
			} );
		}
	}

	/**
	 * Validate a normalized server response before rendering.
	 *
	 * @param {Object} config   Registered browser configuration.
	 * @param {*}      response Candidate response.
	 * @return {boolean} True when the response contract is supported.
	 */
	function validate_response( config, response ) {
		var configured_schema_version = config ? normalize_schema_version( config.schema_version ) : null;
		var response_schema_version = response ? normalize_schema_version( response.schema_version ) : null;

		if (
			! config
			|| ! response
			|| 'object' !== typeof response
			|| response.catalog_id !== config.catalog_id
			|| null === configured_schema_version
			|| response_schema_version !== configured_schema_version
			|| 'boolean' !== typeof response.success
			|| null === normalize_sequence( response.request_id )
		) {
			return false;
		}

		if ( false === response.success ) {
			return !! response.error
				&& 'object' === typeof response.error
				&& 'string' === typeof response.error.code
				&& 'string' === typeof response.error.message
				&& 'boolean' === typeof response.error.retryable;
		}

		return Array.isArray( response.items )
			&& !! response.pagination
			&& 'object' === typeof response.pagination
			&& !! response.sorting
			&& 'object' === typeof response.sorting
			&& !! response.filters
			&& 'object' === typeof response.filters
			&& !! response.display
			&& 'object' === typeof response.display
			&& !! response.hierarchy
			&& 'object' === typeof response.hierarchy
			&& !! response.capabilities
			&& 'object' === typeof response.capabilities
			&& Array.isArray( response.messages );
	}

	/**
	 * Refresh optional shared hierarchy mechanics after domain rows are mounted.
	 *
	 * The rendered lifecycle event runs synchronously first so a domain adapter
	 * can compose its WP row templates before the controller indexes node DOM.
	 *
	 * @param {Object} config   Registered browser configuration.
	 * @param {Object} response Normalized current response.
	 * @return {boolean} Whether hierarchy behavior is active.
	 */
	function refresh_catalog_hierarchy( config, response ) {
		var catalog_state = config && config.catalog_id ? get_catalog_state( config.catalog_id ) : null;

		return !! (
			catalog_state
			&& catalog_state.hierarchy_controller
			&& 'function' === typeof catalog_state.hierarchy_controller.refresh
			&& catalog_state.hierarchy_controller.refresh( response && response.hierarchy ? response.hierarchy : {} )
		);
	}

	/**
	 * Render a current normalized response and ignore stale sequences.
	 *
	 * @param {Object} config           Registered browser configuration.
	 * @param {*}      response         Candidate normalized response.
	 * @param {*}      request_sequence Sequence assigned when the request began.
	 * @return {boolean} True when the response changed the catalog.
	 */
	function render_response( config, response, request_sequence ) {
		var catalog_state;
		var i18n;
		var items_template_data;
		var response_sequence = response && normalize_sequence( response.request_id );
		var normalized_sequence = normalize_sequence( request_sequence );

		if ( ! config || ! config.catalog_id ) {
			return false;
		}

		catalog_state = get_catalog_state( config.catalog_id );
		if (
			! catalog_state
			|| null === normalized_sequence
			|| null === response_sequence
			|| response_sequence !== normalized_sequence
			|| is_stale_response( config.catalog_id, normalized_sequence )
		) {
			return false;
		}

		if ( ! validate_response( config, response ) ) {
			return render_error( config, config.i18n && config.i18n.error_message ? config.i18n.error_message : '' );
		}

		if ( false === response.success ) {
			return render_error( config, response.error.message );
		}

		set_active_template_pack( config, response.display.template_pack );

		i18n = config.i18n || {};
		if ( 0 === response.items.length ) {
			var is_empty_rendered = render_template( config, 'empty', {
				title: i18n.empty_title || '',
				message: i18n.empty_message || ''
			} );
			if ( is_empty_rendered ) {
				dispatch_catalog_event( config, 'wpbc:ui-catalog-rendered', {
					catalog_id: config.catalog_id,
					request_sequence: normalized_sequence,
					response: response
				} );
				refresh_catalog_hierarchy( config, response );
			}
			return is_empty_rendered;
		}

		items_template_data = Object.assign( {}, response, { i18n: i18n } );
		if ( ! render_template( config, 'items', items_template_data ) ) {
			return render_error( config, i18n.error_message || '' );
		}
		dispatch_catalog_event( config, 'wpbc:ui-catalog-rendered', {
			catalog_id: config.catalog_id,
			request_sequence: normalized_sequence,
			response: response
		} );
		refresh_catalog_hierarchy( config, response );
		sync_catalog_table_min_width( config );

		return true;
	}

	/**
	 * Request and render one normalized catalog response.
	 *
	 * Request cancellation and sequence checks are shared mechanics. Catalog
	 * scripts supply only normalized request values and respond to lifecycle
	 * events after the allow-listed items template is mounted.
	 *
	 * @param {Object} config         Registered browser configuration.
	 * @param {Object} request_values Normalized request overrides.
	 * @return {Promise<boolean>} Whether a current response was rendered.
	 */
	function request_catalog( config, request_values ) {
		var catalog_state;
		var persistent_request_values;
		var preference_action;
		var request_body;
		var request_sequence;
		var request_url;

		if (
			! config
			|| ! config.catalog_id
			|| ! config.ajax_url
			|| ! config.action
			|| ! config.nonce
			|| 'function' !== typeof window.fetch
		) {
			return Promise.resolve( render_error( config || {}, config && config.i18n ? config.i18n.error_message : '' ) );
		}

		catalog_state = get_catalog_state( config.catalog_id );
		if ( ! catalog_state ) {
			return Promise.resolve( false );
		}

		if ( catalog_state.abort_controller && 'function' === typeof catalog_state.abort_controller.abort ) {
			catalog_state.abort_controller.abort();
		}
		catalog_state.abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
		persistent_request_values = Object.assign( {}, request_values || {} );
		preference_action = persistent_request_values.preference_action || '';
		delete persistent_request_values.preference_action;
		catalog_state.request_values = Object.assign( {}, config.initial_request || {}, catalog_state.request_values || {}, persistent_request_values );
		request_sequence = next_request_sequence( config.catalog_id );
		catalog_state.request_values.request_id = request_sequence;

		if ( ! set_catalog_loading_state( config, true ) ) {
			render_template( config, 'shell', {
				catalog_id: config.catalog_id,
				aria_label: config.i18n && config.i18n.catalog_label ? config.i18n.catalog_label : '',
				loading_message: config.i18n && config.i18n.loading ? config.i18n.loading : ''
			} );
		}
		dispatch_catalog_event( config, 'wpbc:ui-catalog-loading', {
			catalog_id: config.catalog_id,
			request_sequence: request_sequence
		} );

		request_body = new window.URLSearchParams();
		request_body.append( 'action', config.action );
		request_body.append( 'nonce', config.nonce );
		if ( preference_action ) {
			catalog_state.preference_revision = Math.max( Date.now(), catalog_state.preference_revision + 1 );
			request_body.append( 'preference_action', preference_action );
			request_body.append( 'preference_revision', String( catalog_state.preference_revision ) );
		}
		Object.keys( catalog_state.request_values ).forEach( function ( request_key ) {
			append_request_value( request_body, request_key, catalog_state.request_values[ request_key ] );
		} );
		request_url = String( config.ajax_url );

		return window.fetch( request_url, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: request_body.toString(),
			signal: catalog_state.abort_controller ? catalog_state.abort_controller.signal : undefined
		} ).then( function ( response ) {
			return response.text().then( function ( response_text ) {
				var response_payload = null;

				try {
					response_payload = JSON.parse( response_text );
				} catch ( error ) {
					response_payload = null;
				}

				if ( is_stale_response( config.catalog_id, request_sequence ) ) {
					return false;
				}
				if ( ! response_payload ) {
					return render_error( config, config.i18n && config.i18n.error_message ? config.i18n.error_message : '' );
				}

				var is_rendered = render_response( config, response_payload, request_sequence );
				if ( is_rendered && response_payload.success ) {
					catalog_state.request_values = Object.assign( {}, catalog_state.request_values, {
						page_number: response_payload.pagination.page_number,
						items_per_page: response_payload.pagination.items_per_page,
						sort_by: response_payload.sorting.sort_by,
						sort_order: response_payload.sorting.sort_order,
						search: response_payload.filters.search || '',
						visible_columns: response_payload.display.visible_columns || [],
						column_order: response_payload.display.column_order || [],
						template_pack: response_payload.display.template_pack || ''
					} );
					Object.keys( response_payload.filters || {} ).forEach( function ( filter_key ) {
						catalog_state.request_values[ filter_key ] = response_payload.filters[ filter_key ];
					} );
					update_url_state( config, response_payload );
				}

				return is_rendered;
			} );
		} ).catch( function ( error ) {
			if ( error && 'AbortError' === error.name ) {
				return false;
			}
			if ( is_stale_response( config.catalog_id, request_sequence ) ) {
				return false;
			}

			return render_error( config, config.i18n && config.i18n.error_message ? config.i18n.error_message : '' );
		} );
	}

	/**
	 * Persist validated presentation preferences without rebuilding catalog rows.
	 *
	 * Domain catalogs may add their own scalar preference values to the shared
	 * request state. The endpoint remains responsible for validation and
	 * authorization. A separate abort slot prevents a disclosure-state save from
	 * cancelling an active list request or showing the catalog loading overlay.
	 *
	 * @param {Object} config            Registered browser configuration.
	 * @param {Object} preference_values Shared or domain-owned request values.
	 * @return {Promise<boolean>} Whether the current preference request succeeded.
	 */
	function save_catalog_preferences( config, preference_values ) {
		var catalog_state;
		var request_body;
		var request_revision;

		if ( ! config || ! config.catalog_id || ! config.ajax_url || ! config.action || ! config.nonce || 'function' !== typeof window.fetch ) {
			return Promise.resolve( false );
		}
		catalog_state = get_catalog_state( config.catalog_id );
		if ( ! catalog_state ) {
			return Promise.resolve( false );
		}
		if ( catalog_state.preference_abort_controller && 'function' === typeof catalog_state.preference_abort_controller.abort ) {
			catalog_state.preference_abort_controller.abort();
		}
		catalog_state.preference_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;
		catalog_state.request_values = Object.assign( {}, config.initial_request || {}, catalog_state.request_values || {}, preference_values || {} );
		catalog_state.preference_revision = Math.max( Date.now(), catalog_state.preference_revision + 1 );
		request_revision = catalog_state.preference_revision;

		request_body = new window.URLSearchParams();
		request_body.append( 'action', config.action );
		request_body.append( 'nonce', config.nonce );
		request_body.append( 'preference_action', 'save' );
		request_body.append( 'preference_revision', String( request_revision ) );
		request_body.append( 'preferences_only', '1' );
		Object.keys( catalog_state.request_values ).forEach( function ( request_key ) {
			append_request_value( request_body, request_key, catalog_state.request_values[ request_key ] );
		} );

		return window.fetch( String( config.ajax_url ), {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			body: request_body.toString(),
			signal: catalog_state.preference_abort_controller ? catalog_state.preference_abort_controller.signal : undefined
		} ).then( function ( response ) {
			return response.text().then( function ( response_text ) {
				var response_payload = null;
				try {
					response_payload = JSON.parse( response_text );
				} catch ( error ) {
					response_payload = null;
				}
				return request_revision === catalog_state.preference_revision
					&& response.ok
					&& !! response_payload
					&& true === response_payload.success;
			} );
		} ).catch( function ( error ) {
			return false;
		} );
	}

	/**
	 * Add full-text tooltips only to catalog text that is visually clipped.
	 *
	 * The helper owns the domain-neutral overflow measurement, keyboard focus,
	 * Booking Calendar tooltip initialization, and native-title fallback. Domain
	 * templates opt in by providing authorized plain text through the
	 * `data-wpbc-ui-catalog-overflow-tooltip` attribute.
	 *
	 * @param {HTMLElement} catalog_mount Catalog mount element.
	 * @return {void}
	 */
	function synchronize_overflow_tooltips( catalog_mount ) {
		var has_overflowing_text = false;
		var tooltip_selector;

		if ( ! catalog_mount ) {
			return;
		}
		catalog_mount.querySelectorAll( '[data-wpbc-ui-catalog-overflow-tooltip]' ).forEach( function ( text_element ) {
			var full_text = text_element.getAttribute( 'data-wpbc-ui-catalog-overflow-tooltip' ) || '';
			var static_title = text_element.getAttribute( 'data-wpbc-ui-catalog-static-title' ) || '';
			var is_overflowing = text_element.scrollWidth > text_element.clientWidth + 1
				|| text_element.scrollHeight > text_element.clientHeight + 1;

			if ( text_element._tippy && 'function' === typeof text_element._tippy.destroy ) {
				text_element._tippy.destroy();
			}
			text_element.classList.remove( 'tooltip_top', 'wpbc_ui_listing__overflow_tooltip' );
			text_element.removeAttribute( 'title' );
			text_element.removeAttribute( 'data-original-title' );
			if ( '1' === text_element.getAttribute( 'data-wpbc-ui-catalog-tooltip-tabindex' ) ) {
				text_element.removeAttribute( 'tabindex' );
				text_element.removeAttribute( 'data-wpbc-ui-catalog-tooltip-tabindex' );
			}

			if ( full_text && is_overflowing ) {
				text_element.setAttribute( 'data-original-title', full_text );
				text_element.classList.add( 'tooltip_top', 'wpbc_ui_listing__overflow_tooltip' );
				if ( ! text_element.hasAttribute( 'tabindex' ) ) {
					text_element.setAttribute( 'tabindex', '0' );
					text_element.setAttribute( 'data-wpbc-ui-catalog-tooltip-tabindex', '1' );
				}
				has_overflowing_text = true;
			} else if ( static_title ) {
				text_element.setAttribute( 'title', static_title );
			}
		} );

		tooltip_selector = catalog_mount.id ? '#' + catalog_mount.id + ' .wpbc_ui_listing__overflow_tooltip' : '';
		if ( has_overflowing_text && tooltip_selector && 'function' === typeof window.wpbc_define_tippy_tooltips && window.wpbc_define_tippy_tooltips( tooltip_selector ) ) {
			return;
		}
		catalog_mount.querySelectorAll( '.wpbc_ui_listing__overflow_tooltip' ).forEach( function ( text_element ) {
			text_element.setAttribute( 'title', text_element.getAttribute( 'data-original-title' ) || '' );
		} );
	}

	/**
	 * Create a domain-neutral native inspector state workflow.
	 *
	 * Domains supply their allow-listed shell renderer, host/footer boundaries,
	 * localized shell data, and sidebar expansion callback. The shared workflow
	 * owns only shell mounting and the empty, loading, error, and form states.
	 *
	 * @param {Object} settings Inspector boundary callbacks and shell data.
	 * @return {Object|false} Inspector workflow controller or false when invalid.
	 */
	function create_inspector_workflow( settings ) {
		var options = Object.assign( {
			expand: null,
			get_footer: null,
			get_host: null,
			render_shell: null,
			shell_data: {}
		}, settings || {} );

		if ( 'function' !== typeof options.get_host || 'function' !== typeof options.render_shell ) {
			return false;
		}

		/**
		 * Return the current domain-owned inspector host.
		 *
		 * @return {Element|null} Inspector host or null when it is unavailable.
		 */
		function get_host() {
			var host = options.get_host();

			return host && host.querySelector ? host : null;
		}

		/**
		 * Return the current domain-owned sticky footer when configured.
		 *
		 * @return {Element|null} Inspector footer or null when it is unavailable.
		 */
		function get_footer() {
			var footer = 'function' === typeof options.get_footer ? options.get_footer() : null;

			return footer && footer.querySelector ? footer : null;
		}

		/**
		 * Mount the allow-listed shared shell inside the domain host once.
		 *
		 * @return {boolean} True when the inspector shell is available.
		 */
		function mount() {
			var host = get_host();
			var rendered_shell;

			if ( ! host ) {
				return false;
			}
			if ( ! host.querySelector( '[data-wpbc-ui-catalog-inspector]' ) ) {
				try {
					rendered_shell = options.render_shell( Object.assign( {}, options.shell_data || {} ) );
				} catch ( error ) {
					return false;
				}
				if ( 'string' !== typeof rendered_shell || ! rendered_shell ) {
					return false;
				}
				host.innerHTML = rendered_shell;
			}

			return !! host.querySelector( '[data-wpbc-ui-catalog-inspector]' );
		}

		/**
		 * Synchronize one allow-listed inspector presentation state.
		 *
		 * @param {string} state   Empty, loading, error, or form.
		 * @param {string} message Optional safe error message.
		 * @return {boolean} True when the mounted shell was updated.
		 */
		function set_state( state, message ) {
			var error;
			var error_text;
			var footer;
			var form_target;
			var host;
			var loading;
			var empty;

			if ( [ 'empty', 'loading', 'error', 'form' ].indexOf( state ) < 0 || ! mount() ) {
				return false;
			}

			host = get_host();
			footer = get_footer();
			empty = host.querySelector( '[data-wpbc-ui-catalog-inspector-empty]' );
			loading = host.querySelector( '[data-wpbc-ui-catalog-inspector-loading]' );
			error = host.querySelector( '[data-wpbc-ui-catalog-inspector-error]' );
			form_target = host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' );

			if ( empty ) { empty.hidden = 'empty' !== state; }
			if ( loading ) { loading.hidden = 'loading' !== state; }
			if ( error ) {
				error.hidden = 'error' !== state;
				error_text = error.querySelector( 'p' );
				if ( error_text ) { error_text.textContent = String( message || '' ); }
			}
			if ( form_target && 'form' !== state ) { form_target.innerHTML = ''; }
			if ( footer ) { footer.hidden = 'form' !== state; }

			return true;
		}

		/**
		 * Expand the configured native sidebar boundary.
		 *
		 * @return {void}
		 */
		function expand() {
			if ( 'function' === typeof options.expand ) {
				options.expand();
			}
		}

		/**
		 * Mount, reveal loading state, and immediately expand the inspector.
		 *
		 * @return {boolean} True when the loading state was opened.
		 */
		function open_loading() {
			if ( ! set_state( 'loading', '' ) ) {
				return false;
			}
			expand();

			return true;
		}

		/**
		 * Return the shell form target used by domain-owned templates.
		 *
		 * @return {Element|null} Form target or null when mounting failed.
		 */
		function get_form_target() {
			var host = mount() ? get_host() : null;

			return host ? host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' ) : null;
		}

		return {
			expand: expand,
			get_form_target: get_form_target,
			mount: mount,
			open_loading: open_loading,
			set_state: set_state
		};
	}

	/**
	 * Create a domain-neutral inline-editing workflow controller.
	 *
	 * Domains retain ownership of editable fields, draft values, authorization,
	 * review payloads, and mutations. This controller only synchronizes the
	 * repeated catalog mechanics around an active inline workflow: sticky-bar
	 * registration, busy controls, navigation locking, changed-row presentation,
	 * and the shared active-state classes.
	 *
	 * @param {HTMLElement|string} catalog_mount Catalog mount element or its ID.
	 * @param {Object}             settings      Domain selectors and page element.
	 * @return {Object|false} Inline workflow controller or false when unavailable.
	 */
	function create_inline_editing_workflow( catalog_mount, settings ) {
		var options;
		var mount_element = 'string' === typeof catalog_mount ? document.getElementById( catalog_mount ) : catalog_mount;
		var default_protected_selector = [
			'[data-wpbc-ui-catalog-view]',
			'[data-wpbc-ui-catalog-template-pack]',
			'[data-wpbc-ui-catalog-display-customizer] summary',
			'[data-wpbc-ui-catalog-search]',
			'[data-wpbc-ui-catalog-filter]',
			'[data-wpbc-ui-catalog-select-item]',
			'[data-wpbc-ui-catalog-select-all]',
			'[data-wpbc-ui-catalog-sort]',
			'[data-wpbc-ui-catalog-page]',
			'[data-wpbc-ui-catalog-items-per-page]',
			'[data-wpbc-ui-catalog-column-visible]',
			'[data-wpbc-ui-catalog-column-order-reset]',
			'[data-wpbc-ui-catalog-preferences-reset]'
		].join( ', ' );

		if ( ! mount_element || ! mount_element.querySelector ) {
			return false;
		}

		options = Object.assign( {
			bar_selector: '[data-wpbc-ui-catalog-inline-bar]',
			cancel_selector: '[data-wpbc-ui-catalog-inline-cancel]',
			controls_root: mount_element,
			count_selector: '[data-wpbc-ui-catalog-inline-count]',
			page_element: mount_element,
			protected_selector: '',
			review_selector: '[data-wpbc-ui-catalog-inline-review]',
			toggle_label_selector: '[data-wpbc-ui-catalog-inline-toggle-label]',
			toggle_selector: '[data-wpbc-ui-catalog-inline-toggle]'
		}, settings || {} );

		/**
		 * Return the configured page element without escaping the catalog mount.
		 *
		 * @return {HTMLElement|null} Configured page root, mount, or null.
		 */
		function get_page_element() {
			if ( options.page_element && options.page_element.nodeType ) {
				return options.page_element;
			}

			return 'string' === typeof options.page_element
				? mount_element.querySelector( options.page_element )
				: mount_element;
		}

		/**
		 * Return the complete selector for controls locked by active drafts.
		 *
		 * @return {string} Shared selectors plus the trusted domain extension.
		 */
		function get_protected_selector() {
			return options.protected_selector
				? default_protected_selector + ', ' + options.protected_selector
				: default_protected_selector;
		}

		/**
		 * Preserve and restore a control's pre-workflow disabled state.
		 *
		 * @param {HTMLElement} control         Catalog control to synchronize.
		 * @param {boolean}     controls_locked Whether inline navigation is locked.
		 * @return {void}
		 */
		function synchronize_protected_control( control, controls_locked ) {
			var prior_disabled;

			if ( controls_locked ) {
				if ( ! control.hasAttribute( 'data-wpbc-ui-catalog-inline-was-disabled' ) ) {
					control.setAttribute( 'data-wpbc-ui-catalog-inline-was-disabled', control.disabled ? '1' : '0' );
				}
				control.disabled = true;
				control.setAttribute( 'aria-disabled', 'true' );
				return;
			}

			if ( ! control.hasAttribute( 'data-wpbc-ui-catalog-inline-was-disabled' ) ) {
				return;
			}
			prior_disabled = '1' === control.getAttribute( 'data-wpbc-ui-catalog-inline-was-disabled' );
			control.disabled = prior_disabled;
			control.removeAttribute( 'data-wpbc-ui-catalog-inline-was-disabled' );
			if ( ! prior_disabled ) {
				control.removeAttribute( 'aria-disabled' );
			}
		}

		/**
		 * Register the current inline bar with the shared viewport controller.
		 *
		 * @return {void}
		 */
		function register_sticky_bar() {
			var inline_bar = mount_element.querySelector( options.bar_selector );
			var selection_controller = mount_element._wpbc_ui_catalog_selection_controller;

			if ( inline_bar && selection_controller && 'function' === typeof selection_controller.register_viewport_sticky ) {
				selection_controller.register_viewport_sticky( inline_bar );
			}
		}

		/**
		 * Remove shared changed-row presentation after inline mode ends.
		 *
		 * Domain drafts and values remain domain-owned. This cleanup removes only
		 * the shared class and badge that this controller previously applied.
		 *
		 * @return {void}
		 */
		function clear_changed_rows() {
			mount_element.querySelectorAll( '.wpbc_ui_catalog_inline_row.is-inline-changed' ).forEach( function ( row_element ) {
				set_row_changed( row_element, false, null, '' );
			} );
		}

		/**
		 * Synchronize shared inline workflow presentation from domain-owned state.
		 *
		 * @param {Object} workflow_state Normalized active, busy, count, and labels.
		 * @return {void}
		 */
		function synchronize( workflow_state ) {
			var active;
			var busy;
			var controls_root;
			var controls_locked;
			var inline_bar;
			var page_element;
			var toggle_button;
			var toggle_label;

			workflow_state = workflow_state || {};
			active = true === workflow_state.active;
			busy = true === workflow_state.busy;
			controls_root = options.controls_root && options.controls_root.querySelectorAll ? options.controls_root : mount_element;
			controls_locked = active || true === workflow_state.lock_controls;
			inline_bar = mount_element.querySelector( options.bar_selector );
			page_element = get_page_element();
			toggle_button = mount_element.querySelector( options.toggle_selector );

			if ( inline_bar ) {
				inline_bar.hidden = ! active;
				inline_bar.setAttribute( 'aria-busy', busy ? 'true' : 'false' );
				if ( inline_bar.querySelector( options.count_selector ) ) {
					inline_bar.querySelector( options.count_selector ).textContent = String( workflow_state.count_text || '' );
				}
				if ( inline_bar.querySelector( options.review_selector ) ) {
					inline_bar.querySelector( options.review_selector ).disabled = busy || ! Number( workflow_state.changed_count || 0 );
				}
				if ( inline_bar.querySelector( options.cancel_selector ) ) {
					inline_bar.querySelector( options.cancel_selector ).disabled = busy;
				}
			}

			if ( toggle_button ) {
				toggle_button.classList.toggle( 'is-active', active );
				toggle_button.classList.toggle( 'is-busy', busy );
				toggle_button.disabled = busy
					|| true === workflow_state.toggle_disabled
					|| ( ! active && false === workflow_state.has_items );
				toggle_button.setAttribute( 'aria-pressed', active ? 'true' : 'false' );
				toggle_button.setAttribute( 'aria-busy', busy ? 'true' : 'false' );
				toggle_label = toggle_button.querySelector( options.toggle_label_selector );
				if ( toggle_label ) {
					toggle_label.textContent = active
						? String( workflow_state.active_toggle_text || '' )
						: String( workflow_state.inactive_toggle_text || '' );
				}
			}

			if ( page_element ) {
				page_element.classList.toggle( 'is-inline-editing', active );
			}
			if ( ! active ) {
				clear_changed_rows();
			}
			controls_root.querySelectorAll( get_protected_selector() ).forEach( function ( control ) {
				synchronize_protected_control( control, controls_locked );
			} );
			register_sticky_bar();
			if (
				mount_element._wpbc_ui_catalog_selection_controller
				&& 'function' === typeof mount_element._wpbc_ui_catalog_selection_controller.refresh_viewport_sticky
			) {
				mount_element._wpbc_ui_catalog_selection_controller.refresh_viewport_sticky();
			}
		}

		/**
		 * Block a captured event that targets a control protected by active drafts.
		 *
		 * @param {Event}   event           Captured browser event.
		 * @param {boolean} controls_locked Whether the domain workflow is active.
		 * @return {boolean} True when the event was blocked.
		 */
		function protect_event( event, controls_locked ) {
			if ( ! controls_locked || ! event.target || ! event.target.closest ) {
				return false;
			}
			if ( ! event.target.closest( get_protected_selector() ) ) {
				return false;
			}

			event.preventDefault();
			event.stopImmediatePropagation();
			return true;
		}

		/**
		 * Synchronize one changed row and its accessible text badge.
		 *
		 * @param {HTMLElement} row_element       Domain row or card element.
		 * @param {boolean}     changed           Whether its draft differs.
		 * @param {HTMLElement} indicator_element Element receiving the badge.
		 * @param {string}      changed_label     Localized badge text.
		 * @return {void}
		 */
		function set_row_changed( row_element, changed, indicator_element, changed_label ) {
			var indicator;

			if ( ! row_element ) {
				return;
			}
			row_element.classList.add( 'wpbc_ui_catalog_inline_row' );
			row_element.classList.toggle( 'is-inline-changed', !! changed );
			indicator = row_element.querySelector( '[data-wpbc-ui-catalog-inline-changed-label]' );
			if ( ! changed ) {
				if ( indicator ) {
					indicator.remove();
				}
				return;
			}
			if ( ! indicator && indicator_element ) {
				indicator = document.createElement( 'span' );
				indicator.className = 'wpbc_ui_catalog_inline_changed_label';
				indicator.setAttribute( 'data-wpbc-ui-catalog-inline-changed-label', '' );
				indicator_element.appendChild( indicator );
			}
			if ( indicator ) {
				indicator.textContent = String( changed_label || '' );
			}
		}

		return {
			protect_event: protect_event,
			register_sticky_bar: register_sticky_bar,
			set_row_changed: set_row_changed,
			synchronize: synchronize
		};
	}

	/**
	 * Create a domain-neutral signed-review presentation controller.
	 *
	 * Domains own preview and apply requests, signed plans, permissions, field
	 * validation, and mutations. This controller accepts only the normalized
	 * review DTO and owns the repeated model preparation and busy-state locking.
	 *
	 * @param {Object} settings DOM roots and domain button selectors.
	 * @return {Object} Review presentation controller.
	 */
	function create_inline_review_workflow( settings ) {
		var options = Object.assign( {
			apply_selector: '[data-wpbc-ui-catalog-inline-review-apply]',
			cancel_selector: '[data-wpbc-ui-catalog-inline-review-cancel]',
			root: document
		}, settings || {} );

		/**
		 * Normalize one server-authoritative review DTO for a domain template.
		 *
		 * @param {Object} review       Server review with rows and field changes.
		 * @param {Object} presentation Localized headings and explanatory text.
		 * @return {Object} Executable-free template model.
		 */
		function prepare( review, presentation ) {
			var normalized_rows = [];

			review = review && 'object' === typeof review ? review : {};
			presentation = presentation && 'object' === typeof presentation ? presentation : {};
			( Array.isArray( review.rows ) ? review.rows : [] ).forEach( function ( row ) {
				var normalized_fields = [];
				var normalized_notes = [];

				if ( ! row || 'object' !== typeof row ) {
					return;
				}
				( Array.isArray( row.fields ) ? row.fields : [] ).forEach( function ( field ) {
					if ( ! field || 'object' !== typeof field ) {
						return;
					}
					normalized_fields.push( {
						after: String( undefined === field.after ? '' : field.after ),
						before: String( undefined === field.before ? '' : field.before ),
						key: String( field.key || '' ),
						label: String( field.label || field.key || '' )
					} );
				} );
				( Array.isArray( row.notes ) ? row.notes : [] ).forEach( function ( note ) {
					if ( 'string' === typeof note || 'number' === typeof note ) {
						normalized_notes.push( String( note ) );
					}
				} );
				if ( normalized_fields.length ) {
					normalized_rows.push( {
						fields: normalized_fields,
						id: Number( row.id || 0 ),
						notes: normalized_notes,
						title: String( row.title || '' )
					} );
				}
			} );

			return {
				changed_label: String( presentation.changed_label || '' ),
				description: String( presentation.description || '' ),
				form_id: String( presentation.form_id || '' ),
				mode: String( presentation.mode || 'inline_review' ),
				pending_message: String( presentation.pending_message || '' ),
				rows: normalized_rows,
				title: String( presentation.title || '' ),
				warning: String( review.warning || presentation.warning || '' )
			};
		}

		/**
		 * Lock or unlock review actions while a domain request is in flight.
		 *
		 * @param {Object} review_state Busy and apply-ready flags.
		 * @return {void}
		 */
		function synchronize( review_state ) {
			var busy;
			var can_apply;
			var root = options.root && options.root.querySelectorAll ? options.root : document;

			review_state = review_state || {};
			busy = true === review_state.busy;
			can_apply = true === review_state.can_apply;
			root.querySelectorAll( options.apply_selector ).forEach( function ( control ) {
				control.disabled = busy || ! can_apply;
				control.classList.toggle( 'is-busy', busy );
				control.setAttribute( 'aria-busy', busy ? 'true' : 'false' );
			} );
			root.querySelectorAll( options.cancel_selector ).forEach( function ( control ) {
				control.disabled = busy;
			} );
			root.querySelectorAll( '[data-wpbc-ui-catalog-inline-review-form]' ).forEach( function ( form ) {
				form.setAttribute( 'aria-busy', busy ? 'true' : 'false' );
			} );
		}

		return {
			prepare: prepare,
			synchronize: synchronize
		};
	}

	/**
	 * Create a domain-neutral permanent-deletion review controller.
	 *
	 * Domains remain responsible for deciding whether deletion is allowed,
	 * producing the signed impact review, rendering their allow-listed template,
	 * and applying the mutation. This controller owns only the repeated browser
	 * mechanics for explicit acknowledgement, destructive footer presentation,
	 * busy locking, and reduced-motion-safe attention feedback.
	 *
	 * @param {Object} settings DOM roots and domain selectors.
	 * @return {Object} Deletion-review presentation controller.
	 */
	function create_delete_review_workflow( settings ) {
		var options = Object.assign( {
			acknowledgement_selector: '[data-wpbc-ui-catalog-delete-acknowledgement]',
			apply_selector: '[data-wpbc-ui-catalog-delete-apply], [data-wpbc-ui-catalog-inspector-save]',
			cancel_selector: '[data-wpbc-ui-catalog-delete-cancel], [data-wpbc-ui-catalog-inspector-cancel]',
			root: document
		}, settings || {} );
		var review_state = {
			busy: false,
			can_apply: false
		};

		/**
		 * Return the configured query root.
		 *
		 * @return {Document|Element} Query-capable root.
		 */
		function get_root() {
			return options.root && options.root.querySelectorAll ? options.root : document;
		}

		/**
		 * Return the active acknowledgement checkbox.
		 *
		 * @return {HTMLInputElement|null} Checkbox or null when the review is blocked.
		 */
		function get_acknowledgement() {
			return get_root().querySelector( options.acknowledgement_selector );
		}

		/**
		 * Restart the finite acknowledgement attention animation.
		 *
		 * @return {void}
		 */
		function pulse_acknowledgement() {
			var acknowledgement = get_acknowledgement();
			var container = acknowledgement ? acknowledgement.closest( '.wpbc_ui_catalog_delete_review__acknowledgement' ) : null;

			if ( ! container ) {
				return;
			}
			container.classList.remove( 'is-attention' );
			void container.offsetWidth;
			container.classList.add( 'is-attention' );
		}

		/**
		 * Synchronize destructive review actions with server and user state.
		 *
		 * @param {Object} next_state Busy and server-authoritative apply flags.
		 * @return {void}
		 */
		function synchronize( next_state ) {
			var acknowledgement;
			var acknowledged;
			var root = get_root();

			next_state = next_state || {};
			if ( 'boolean' === typeof next_state.busy ) {
				review_state.busy = next_state.busy;
			}
			if ( 'boolean' === typeof next_state.can_apply ) {
				review_state.can_apply = next_state.can_apply;
			}
			acknowledgement = get_acknowledgement();
			acknowledged = !! acknowledgement && acknowledgement.checked;
			root.querySelectorAll( options.apply_selector ).forEach( function ( control ) {
				control.disabled = review_state.busy || ! review_state.can_apply || ! acknowledged;
				control.classList.toggle( 'is-busy', review_state.busy );
				control.setAttribute( 'aria-busy', review_state.busy ? 'true' : 'false' );
			} );
			root.querySelectorAll( options.cancel_selector ).forEach( function ( control ) {
				control.disabled = review_state.busy;
			} );
			root.querySelectorAll( '[data-wpbc-ui-catalog-delete-review-form]' ).forEach( function ( form ) {
				form.setAttribute( 'aria-busy', review_state.busy ? 'true' : 'false' );
			} );
		}

		/**
		 * Apply the standard destructive footer contract to domain-owned controls.
		 *
		 * @param {Object} footer_settings Footer element, form ID, and label.
		 * @return {void}
		 */
		function configure_footer( footer_settings ) {
			var footer_options = footer_settings || {};
			var footer = footer_options.footer && footer_options.footer.querySelector ? footer_options.footer : null;
			var apply_button = footer ? footer.querySelector( options.apply_selector ) : null;

			if ( ! apply_button ) {
				return;
			}
			apply_button.classList.remove( 'button-primary', 'button-link-delete' );
			apply_button.classList.add( 'button-secondary', 'wpbc_ui_catalog_delete_review__apply' );
			apply_button.textContent = String( footer_options.label || '' );
			if ( footer_options.form_id ) {
				apply_button.setAttribute( 'form', String( footer_options.form_id ) );
			}
			review_state.can_apply = true === footer_options.can_apply;
			review_state.busy = false;
			synchronize();
		}

		/**
		 * Handle a delegated acknowledgement change.
		 *
		 * @param {Event} event Browser change event.
		 * @return {boolean} True when the event belonged to this workflow.
		 */
		function handle_change( event ) {
			var target = event && event.target;

			if ( ! target || ! target.matches || ! target.matches( options.acknowledgement_selector ) ) {
				return false;
			}
			if ( target.checked ) {
				var container = target.closest( '.wpbc_ui_catalog_delete_review__acknowledgement' );
				if ( container ) {
					container.classList.remove( 'is-attention' );
				}
			} else {
				pulse_acknowledgement();
			}
			synchronize();

			return true;
		}

		return {
			configure_footer: configure_footer,
			handle_change: handle_change,
			pulse_acknowledgement: pulse_acknowledgement,
			synchronize: synchronize
		};
	}

	/**
	 * Mount one registered catalog and render its initial response.
	 *
	 * @param {Object} config Registered browser configuration.
	 * @return {Object|false} Catalog controller or false when mounting fails.
	 */
	function mount_catalog( config ) {
		var catalog_state;
		var catalog_template;
		var content_element;
		var initial_sequence;
		var mount_element;

		if ( ! config || ! config.id || ! config.mount_id || ! config.templates || ! config.templates.catalog || ! config.templates.shell ) {
			return false;
		}

		config.catalog_id = config.id;
		mount_element     = document.getElementById( config.mount_id );
		catalog_template  = load_template( config, 'catalog' );

		if ( ! mount_element || ! catalog_template ) {
			return false;
		}

		mount_element.innerHTML = catalog_template( Object.assign( {}, config, { catalog_id: config.catalog_id } ) );
		content_element = mount_element.querySelector( '[data-wpbc-catalog-content]' );
		if ( ! content_element ) {
			return false;
		}
		if ( config.i18n && config.i18n.catalog_label ) {
			content_element.parentNode.setAttribute( 'aria-label', config.i18n.catalog_label );
		}

		catalog_state                 = get_catalog_state( config.catalog_id );
		catalog_state.config          = config;
		catalog_state.content_element = content_element;
		catalog_state.response_element = content_element.querySelector( '[data-wpbc-ui-catalog-response]' ) || content_element;
		catalog_state.loading_element = content_element.querySelector( '[data-wpbc-ui-catalog-loading]' );
		catalog_state.latest_sequence = 0;
		catalog_state.request_values = Object.assign( {}, config.initial_request || {} );
		bind_catalog_controls( config, mount_element );
		if ( window.wpbc_ui_catalog_actions && 'function' === typeof window.wpbc_ui_catalog_actions.initialize ) {
			catalog_state.actions_controller = window.wpbc_ui_catalog_actions.initialize( mount_element, config );
		}
		if (
			config.features
			&& config.features.hierarchy
			&& window.wpbc_ui_catalog_hierarchy
			&& 'function' === typeof window.wpbc_ui_catalog_hierarchy.initialize
		) {
			catalog_state.hierarchy_controller = window.wpbc_ui_catalog_hierarchy.initialize( mount_element, config, function ( hierarchy_state ) {
				var hierarchy_configuration = config.hierarchy || {};
				var preference_key = String( hierarchy_configuration.preference_key || '' );
				var preference_values = {};

				if ( 'global' !== hierarchy_configuration.persistence || ! preference_key ) {
					return Promise.resolve( false );
				}
				preference_values[ preference_key ] = JSON.stringify( hierarchy_state || {} );

				return save_catalog_preferences( config, preference_values );
			} );
		}
		if (
			config.features
			&& config.features.selection
			&& window.wpbc_ui_catalog_selection
			&& 'function' === typeof window.wpbc_ui_catalog_selection.initialize
		) {
			catalog_state.selection_controller = window.wpbc_ui_catalog_selection.initialize( mount_element, config );
		}

		if ( ! set_catalog_loading_state( config, true ) ) {
			render_template( config, 'shell', {
				catalog_id: config.catalog_id,
				aria_label: config.i18n && config.i18n.catalog_label ? config.i18n.catalog_label : '',
				loading_message: config.i18n && config.i18n.loading ? config.i18n.loading : ''
			} );
		}

		if ( config.auto_load ) {
			request_catalog( config, config.initial_request || {} );
			initial_sequence = catalog_state.latest_sequence;
		} else {
			initial_sequence = next_request_sequence( config.catalog_id );
			if ( config.initial_response ) {
				render_response( config, config.initial_response, initial_sequence );
			}
		}

		return {
			catalog_id: config.catalog_id,
			clear_selection: function () {
				if ( catalog_state.selection_controller && 'function' === typeof catalog_state.selection_controller.clear ) {
					catalog_state.selection_controller.clear();
				}
			},
			get_selected_ids: function () {
				return catalog_state.selection_controller && 'function' === typeof catalog_state.selection_controller.get_selected_ids
					? catalog_state.selection_controller.get_selected_ids()
					: [];
			},
			get_hierarchy_controller: function () {
				return catalog_state.hierarchy_controller || false;
			},
			sequence: initial_sequence,
			load: function ( request_values ) {
				return request_catalog( config, request_values || {} );
			},
			save_preferences: function ( preference_values ) {
				return save_catalog_preferences( config, preference_values || {} );
			},
			refresh_controls: function () {
				refresh_catalog_controls( config );
			},
			sync_table_min_width: function () {
				sync_catalog_table_min_width( config );
			},
			next_sequence: function () {
				return next_request_sequence( config.catalog_id );
			},
			render_response: function ( response, request_sequence ) {
				return render_response( config, response, request_sequence );
			}
		};
	}

	window.wpbc_ui_catalog = window.wpbc_ui_catalog || {};
	window.wpbc_ui_catalog.create_inspector_workflow = create_inspector_workflow;
	window.wpbc_ui_catalog.create_inline_editing_workflow = create_inline_editing_workflow;
	window.wpbc_ui_catalog.create_inline_review_workflow = create_inline_review_workflow;
	window.wpbc_ui_catalog.create_delete_review_workflow = create_delete_review_workflow;
	window.wpbc_ui_catalog.is_stale_response = is_stale_response;
	window.wpbc_ui_catalog.load_template = load_template;
	window.wpbc_ui_catalog.mount = mount_catalog;
	window.wpbc_ui_catalog.next_request_sequence = next_request_sequence;
	window.wpbc_ui_catalog.render_response = render_response;
	window.wpbc_ui_catalog.request = request_catalog;
	window.wpbc_ui_catalog.sync_table_min_width = sync_catalog_table_min_width;
	window.wpbc_ui_catalog.synchronize_overflow_tooltips = synchronize_overflow_tooltips;
	window.wpbc_ui_catalog.validate_response = validate_response;
}( window, document ) );
