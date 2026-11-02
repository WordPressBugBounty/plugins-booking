/**
 * Timeline booking Resource selector and Resource-page navigation.
 *
 * The server remains authoritative for authorization, selection persistence,
 * group-safe pagination, and signed window replacement. This focused module
 * owns only selector drafts, feedback, focus, and stale-safe browser requests.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
( function ( window, document, wp ) {
	'use strict';

	var module_id = 'resource_navigation';
	var all_mode = 'all';
	var explicit_mode = 'explicit';
	var selector_instance_id = 'wpbc-timeline-resource-selector';
	var default_sort_order = 'standard';
	var allowed_sort_orders = [ 'standard', 'title_asc', 'title_desc', 'id_asc', 'id_desc' ];

	/**
	 * Replace one bounded set of named placeholders in translated text.
	 *
	 * @param {string} text   Translated source text.
	 * @param {Object} values Placeholder values keyed without braces.
	 * @return {string} Interpolated plain text.
	 */
	function interpolate( text, values ) {
		Object.keys( values || {} ).forEach( function ( key ) {
			text = String( text || '' ).replace( new RegExp( '\\{' + key + '\\}', 'g' ), String( values[ key ] ) );
		} );

		return String( text || '' );
	}

	/**
	 * Normalize one positive integer using a bounded fallback.
	 *
	 * @param {*}      candidate Candidate value.
	 * @param {number} fallback  Positive fallback.
	 * @return {number} Positive integer.
	 */
	function positive_integer( candidate, fallback ) {
		candidate = Number( candidate );

		return Number.isInteger( candidate ) && 0 < candidate ? candidate : fallback;
	}

	/**
	 * Normalize the server-owned page-size choices and retain a compatible
	 * previously stored size that predates the visible option list.
	 *
	 * @param {Array}  candidates        Server-owned visible choices.
	 * @param {number} current_page_size Current persisted page size.
	 * @param {number} maximum_page_size Server maximum.
	 * @return {number[]} Ordered unique page-size choices.
	 */
	function normalize_page_size_options( candidates, current_page_size, maximum_page_size ) {
		var page_sizes = [];

		maximum_page_size = positive_integer( maximum_page_size, 50 );
		( Array.isArray( candidates ) ? candidates : [] ).forEach( function ( candidate ) {
			candidate = positive_integer( candidate, 0 );
			if ( candidate && candidate <= maximum_page_size && -1 === page_sizes.indexOf( candidate ) ) {
				page_sizes.push( candidate );
			}
		} );
		current_page_size = positive_integer( current_page_size, 0 );
		if ( current_page_size && current_page_size <= maximum_page_size && -1 === page_sizes.indexOf( current_page_size ) ) {
			page_sizes.push( current_page_size );
		}
		page_sizes.sort( function ( first_page_size, second_page_size ) {
			return first_page_size - second_page_size;
		} );

		return page_sizes;
	}

	/**
	 * Normalize one server or draft Resource sort value.
	 *
	 * @param {*} candidate Candidate Resource sort value.
	 * @return {string} Allow-listed Resource sort value.
	 */
	function normalize_sort_order( candidate ) {
		candidate = String( candidate || '' );

		return -1 !== allowed_sort_orders.indexOf( candidate ) ? candidate : default_sort_order;
	}

	/**
	 * Normalize one server Resource-view record for browser drafts.
	 *
	 * @param {Object} candidate Candidate server record.
	 * @param {number} fallback_page_size Default page size.
	 * @return {Object} Canonical browser view.
	 */
	function normalize_resource_view( candidate, fallback_page_size ) {
		var selected_ids = Object.create( null );
		var selection_mode;

		candidate = candidate && 'object' === typeof candidate ? candidate : {};
		selection_mode = explicit_mode === candidate.selection_mode ? explicit_mode : all_mode;
		if ( explicit_mode === selection_mode && Array.isArray( candidate.selected_resource_ids ) ) {
			candidate.selected_resource_ids.forEach( function ( resource_id ) {
				resource_id = positive_integer( resource_id, 0 );
				if ( resource_id ) {
					selected_ids[ resource_id ] = true;
				}
			} );
		}

		return {
			selection_mode: selection_mode,
			selected_ids: selected_ids,
			sort_order: normalize_sort_order( candidate.sort_order ),
			page: positive_integer( candidate.page, 1 ),
			per_page: positive_integer( candidate.per_page, fallback_page_size ),
			expanded_resource_ids: Array.isArray( candidate.expanded_resource_ids ) ? candidate.expanded_resource_ids.slice() : [],
			expanded_parent_ids: Array.isArray( candidate.expanded_parent_ids ) ? candidate.expanded_parent_ids.slice() : []
		};
	}

	/**
	 * Clone a normalized Resource view without sharing draft collections.
	 *
	 * @param {Object} resource_view Normalized Resource view.
	 * @return {Object} Independent clone.
	 */
	function clone_resource_view( resource_view ) {
		var selected_ids = Object.create( null );

		Object.keys( resource_view.selected_ids || {} ).forEach( function ( resource_id ) {
			selected_ids[ resource_id ] = true;
		} );

		return {
			selection_mode: resource_view.selection_mode,
			selected_ids: selected_ids,
			sort_order: normalize_sort_order( resource_view.sort_order ),
			page: resource_view.page,
			per_page: resource_view.per_page,
			expanded_resource_ids: resource_view.expanded_resource_ids.slice(),
			expanded_parent_ids: resource_view.expanded_parent_ids.slice()
		};
	}

	/**
	 * Convert a browser view into the complete save DTO.
	 *
	 * @param {Object} resource_view Normalized Resource view.
	 * @param {number} requested_page Requested Resource page.
	 * @return {Object} Complete Resource-view save request fields.
	 */
	function build_save_dto( resource_view, requested_page ) {
		return {
			selection_mode: resource_view.selection_mode,
			selected_resource_ids: explicit_mode === resource_view.selection_mode
				? Object.keys( resource_view.selected_ids ).map( Number )
				: [],
			sort_order: normalize_sort_order( resource_view.sort_order ),
			page: positive_integer( requested_page, 1 ),
			per_page: resource_view.per_page,
			expanded_resource_ids: resource_view.expanded_resource_ids.slice(),
			expanded_parent_ids: resource_view.expanded_parent_ids.slice()
		};
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

		return fallback;
	}

	/**
	 * Create one Resource navigation module instance.
	 *
	 * @param {Object} context Page-controller hosts, settings, feedback, and signed replacement boundary.
	 * @return {Object} Focused lifecycle and refresh controller.
	 */
	function create_resource_navigation( context ) {
		var mount = context.mount || null;
		var settings = context.settings || {};
		var configuration = settings.resource_navigation || {};
		var i18n = configuration.i18n || {};
		var transport_root = settings.transport && 'object' === typeof settings.transport ? settings.transport : {};
		var transport = transport_root.resources && 'object' === typeof transport_root.resources ? transport_root.resources : {};
		var transport_url = transport_root.url ? String( transport_root.url ) : '';
		var announce = 'function' === typeof context.announce ? context.announce : function () {};
		var show_admin_message = 'function' === typeof context.show_admin_message ? context.show_admin_message : function () {};
		var replace_resource_view = 'function' === typeof context.replace_resource_view ? context.replace_resource_view : function () { return null; };
		var selector_host = null;
		var main_pagination_host = null;
		var timeline_root = null;
		var resource_header = null;
		var resource_pane = null;
		var resource_pane_toggle_host = null;
		var resource_pane_toggle = null;
		var selector_root = null;
		var selector_panel = null;
		var selector_backdrop = null;
		var selector_rows = null;
		var selector_pagination_host = null;
		var selector_status = null;
		var selector_status_message = null;
		var selector_spinner = null;
		var validation = null;
		var validation_message = null;
		var apply_button = null;
		var search_input = null;
		var sort_select = null;
		var page_size_select = null;
		var committed_view = normalize_resource_view( settings.resource_view, configuration.default_selector_size || 20 );
		var draft_view = clone_resource_view( committed_view );
		var page_size_options = normalize_page_size_options(
			configuration.page_size_options,
			committed_view.per_page,
			configuration.maximum_selector_size
		);
		var resource_pagination = settings.resource_pagination || {};
		var selector_page = null;
		var selector_request = null;
		var selector_generation = 0;
		var materialization_generation = 0;
		var materialization_requests = [];
		var search_timer = 0;
		var is_saving = false;
		var is_materializing = false;
		var is_initialized = false;
		var pending_page_focus = '';
		var mobile_drawer_media = null;
		var was_mobile_layout = null;
		var is_resource_pane_collapsed = false;
		var visual_viewport = window.visualViewport || null;

		/**
		 * Return one server-allow-listed Resource navigation template.
		 *
		 * @param {string} template_key Domain template key.
		 * @return {Function|null} WordPress template renderer or null.
		 */
		function get_template( template_key ) {
			var template_id = configuration.templates && configuration.templates[ template_key ];

			return template_id && wp && 'function' === typeof wp.template ? wp.template( template_id ) : null;
		}

		/**
		 * Render one Resource navigation template into an owned host.
		 *
		 * @param {HTMLElement} target Target host.
		 * @param {string} template_key Domain template key.
		 * @param {Object} view_model Authorized template model.
		 * @return {boolean} True when rendered.
		 */
		function render_template( target, template_key, view_model ) {
			var template = get_template( template_key );

			if ( ! target || ! template ) {
				return false;
			}
			target.innerHTML = template( view_model || {} );

			return true;
		}

		/**
		 * Return the current draft selection count.
		 *
		 * All-mode intentionally returns the authorized root-page total used by the
		 * server. The trigger says "All Resources" so Business Large child rows are
		 * never misrepresented as independently paged units.
		 *
		 * @return {number} Explicit count or authorized pagination total.
		 */
		function get_selected_count() {
			return all_mode === draft_view.selection_mode
				? Math.max( 0, Number( resource_pagination.total_items ) || 0 )
				: Object.keys( draft_view.selected_ids ).length;
		}

		/**
		 * Return the exact authorized IDs controlled by one selector row.
		 *
		 * Business Large parent rows receive their complete group scope from the
		 * server DTO. Flat and child rows retain one-Resource selection semantics.
		 *
		 * @param {Object} resource Authorized selector Resource DTO.
		 * @return {number[]} Positive unique Resource IDs.
		 */
		function get_resource_selection_scope( resource ) {
			var scope_ids = resource && resource.is_group_control && Array.isArray( resource.selection_scope_ids )
				? resource.selection_scope_ids
				: [ resource ? resource.id : 0 ];
			var normalized_ids = Object.create( null );

			scope_ids.forEach( function ( resource_id ) {
				resource_id = positive_integer( resource_id, 0 );
				if ( resource_id ) {
					normalized_ids[ resource_id ] = true;
				}
			} );

			return Object.keys( normalized_ids ).map( Number );
		}

		/**
		 * Calculate one row's checked, mixed, or unchecked draft state.
		 *
		 * @param {Object} resource Authorized selector Resource DTO.
		 * @return {string} One of selected, mixed, or unselected.
		 */
		function get_resource_selection_state( resource ) {
			var scope_ids = get_resource_selection_scope( resource );
			var selected_count;

			if ( all_mode === draft_view.selection_mode ) {
				return 'selected';
			}
			selected_count = scope_ids.filter( function ( resource_id ) {
				return Boolean( draft_view.selected_ids[ resource_id ] );
			} ).length;
			if ( ! selected_count ) {
				return 'unselected';
			}

			return selected_count === scope_ids.length ? 'selected' : 'mixed';
		}

		/**
		 * Synchronize visible native checkbox properties after a draft change.
		 *
		 * @return {void}
		 */
		function synchronize_selector_checkboxes() {
			var resources = selector_page && Array.isArray( selector_page.resources ) ? selector_page.resources : [];

			resources.forEach( function ( resource ) {
				var checkbox = selector_rows ? selector_rows.querySelector( '[data-wpbc-timeline-resource-checkbox][value="' + resource.id + '"]' ) : null;
				var selection_state = get_resource_selection_state( resource );

				if ( ! checkbox ) {
					return;
				}
				checkbox.checked = 'selected' === selection_state;
				checkbox.indeterminate = 'mixed' === selection_state;
			} );
		}

		/**
		 * Return the selector trigger label for the committed view.
		 *
		 * @return {string} Translated plain label.
		 */
		function get_trigger_label() {
			return all_mode === committed_view.selection_mode
				? i18n.all_resources
				: interpolate( i18n.resources_count, { count: Object.keys( committed_view.selected_ids ).length } );
		}

		/**
		 * Merge current presentation-only expansion state into a save candidate.
		 *
		 * Row and hierarchy toggles update the shared settings object between window
		 * reads. Reading it at submit time avoids overwriting a newer browser state
		 * with the Resource view captured when this module last refreshed.
		 *
		 * @param {Object} resource_view Normalized selection and paging state.
		 * @return {Object} Independent view with current expansion collections.
		 */
		function with_current_expansion_state( resource_view ) {
			var save_view = clone_resource_view( resource_view );
			var preferences = settings.preferences || {};

			save_view.expanded_resource_ids = Array.isArray( preferences.expanded_resource_ids )
				? preferences.expanded_resource_ids.slice()
				: save_view.expanded_resource_ids;
			save_view.expanded_parent_ids = Array.isArray( preferences.expanded_parent_ids )
				? preferences.expanded_parent_ids.slice()
				: save_view.expanded_parent_ids;

			return save_view;
		}

		/**
		 * Update selection labels, validation, and Apply availability.
		 *
		 * @return {void}
		 */
		function refresh_selection_feedback() {
			var count = get_selected_count();
			var count_host = selector_root ? selector_root.querySelector( '[data-wpbc-timeline-resource-selected-count]' ) : null;
			var trigger_label = selector_root ? selector_root.querySelector( '[data-wpbc-timeline-resource-selector-label]' ) : null;
			var is_empty = explicit_mode === draft_view.selection_mode && 0 === count;

			if ( count_host ) {
				count_host.textContent = interpolate( i18n.selected_count, { count: count } );
			}
			if ( trigger_label ) {
				trigger_label.textContent = get_trigger_label();
			}
			if ( validation ) {
				validation.hidden = ! is_empty;
			}
			if ( validation_message && is_empty ) {
				validation_message.textContent = i18n.minimum_one;
			}
			if ( apply_button ) {
				apply_button.disabled = is_saving || is_materializing || is_empty;
				apply_button.textContent = is_saving ? i18n.applying : i18n.apply;
			}
		}

		/**
		 * Set the selector's non-destructive loading or error feedback.
		 *
		 * @param {string} message Plain text message.
		 * @param {boolean} is_error Whether the message represents an error.
		 * @return {void}
		 */
		function set_selector_status( message, is_error ) {
			var is_loading;

			if ( ! selector_status ) {
				return;
			}
			is_loading = message === i18n.loading || message === i18n.applying;
			if ( selector_status_message ) {
				selector_status_message.textContent = message || '';
			}
			if ( selector_spinner ) {
				selector_spinner.hidden = ! is_loading;
			}
			selector_status.classList.toggle( 'is-error', Boolean( is_error ) );
			selector_status.classList.toggle( 'is-loading', is_loading );
			selector_status.hidden = ! message;
		}

		/**
		 * Report a Resource-view failure through both local and page-level feedback.
		 *
		 * Main sidebar pagination can run while the selector is closed, so its
		 * failure cannot rely on the selector status region alone. The page-owned
		 * notice callback keeps transport and save failures visible without letting
		 * this domain adapter construct administration notice markup.
		 *
		 * @param {string} message Plain translated error text.
		 * @param {boolean} show_notice Whether to display the page-level notice.
		 * @return {void}
		 */
		function report_save_error( message, show_notice ) {
			message = String( message || i18n.load_error || '' );
			set_selector_status( message, true );
			announce( message );
			if ( show_notice ) {
				show_admin_message( message, 'error', 30000 );
			}
		}

		/**
		 * Update selector and main paging controls during save/readback.
		 *
		 * @param {boolean} busy Whether a Resource-view request owns the UI.
		 * @return {void}
		 */
		function set_save_busy( busy ) {
			is_saving = Boolean( busy );
			if ( selector_root ) {
				selector_root.classList.toggle( 'is-saving', is_saving );
				Array.prototype.forEach.call(
					selector_root.querySelectorAll( 'input, select, button' ),
					function ( control ) {
						if ( ! control.hasAttribute( 'data-wpbc-timeline-resource-apply' ) ) {
							control.disabled = is_saving;
						}
					}
				);
			}
			refresh_selection_feedback();
			if ( ! is_saving && selector_page ) {
				render_selector_page( selector_page );
			}
			render_main_pagination();
		}

		/**
		 * Build a normalized pagination template model.
		 *
		 * @param {Object} pagination Server pagination DTO.
		 * @param {string} pagination_context Main or selector context.
		 * @param {boolean} busy Whether navigation is locked.
		 * @return {Object} Template-ready model.
		 */
		function get_pagination_view_model( pagination, pagination_context, busy ) {
			var page = positive_integer( pagination.page, 1 );
			var total_pages = Math.max( 0, Number( pagination.total_pages ) || 0 );

			return {
				context: pagination_context,
				navigation_label: 'selector' === pagination_context ? i18n.choose_resources : settings.i18n.resource_heading,
				page_status: interpolate( i18n.page_status, { page: page, pages: Math.max( 1, total_pages ) } ),
				has_previous: Boolean( pagination.has_previous ),
				has_next: Boolean( pagination.has_next ),
				is_busy: Boolean( busy ),
				i18n: i18n
			};
		}

		/**
		 * Render the fixed Resource sidebar pagination.
		 *
		 * @return {void}
		 */
		function render_main_pagination() {
			if ( ! main_pagination_host ) {
				return;
			}
			render_template(
				main_pagination_host,
				'pagination',
				get_pagination_view_model( resource_pagination, 'main', is_saving )
			);
		}

		/**
		 * Render one authorized selector page with the current cross-page draft.
		 *
		 * @param {Object} response Selector endpoint DTO.
		 * @return {void}
		 */
		function render_selector_page( response ) {
			var row_template = get_template( 'selector_row' );
			var row_buffer;

			selector_page = response || {};
			if ( selector_rows ) {
				selector_rows.textContent = '';
			}
			if ( ! selector_rows || ! row_template ) {
				return;
			}
			( Array.isArray( selector_page.resources ) ? selector_page.resources : [] ).forEach( function ( resource ) {
				var row_view_model = Object.assign( {}, resource );

				row_view_model.selection_state = get_resource_selection_state( resource );
				row_view_model.is_selected = 'selected' === row_view_model.selection_state;
				row_view_model.checkbox_label = interpolate(
					resource.is_group_control ? i18n.select_resource_group : i18n.select_resource,
					{ title: resource.title }
				);
				row_buffer = document.createElement( 'div' );
				row_buffer.innerHTML = row_template( row_view_model );
				if ( row_buffer.firstElementChild ) {
					selector_rows.appendChild( row_buffer.firstElementChild );
				}
			} );
			synchronize_selector_checkboxes();

			if ( selector_pagination_host ) {
				render_template(
					selector_pagination_host,
					'pagination',
					get_pagination_view_model( selector_page.selector_pagination || {}, 'selector', is_saving || is_materializing )
				);
			}
			if ( ! selector_page.resources || ! selector_page.resources.length ) {
				set_selector_status( i18n.empty, false );
			} else {
				set_selector_status( '', false );
			}
			refresh_selection_feedback();
			if ( pending_page_focus && selector_pagination_host ) {
				( selector_pagination_host.querySelector( '[data-wpbc-timeline-resource-page="' + pending_page_focus + '"]' ) || search_input ).focus();
				pending_page_focus = '';
			}
		}

		/**
		 * Request one independently paged selector result and reject stale responses.
		 *
		 * @param {number} page Requested selector page.
		 * @param {string} search Validated server search candidate.
		 * @return {Object|null} jQuery request or null when transport is unavailable.
		 */
		function request_selector_page( page, search ) {
			var generation;

			if ( is_saving || is_materializing ) {
				return null;
			}
			if ( ! window.jQuery || ! transport_url || ! transport.action || ! transport.nonce ) {
				set_selector_status( i18n.load_error, true );
				return null;
			}
			selector_generation += 1;
			generation = selector_generation;
			if ( selector_request && 'function' === typeof selector_request.abort ) {
				selector_request.abort();
			}
			set_selector_status( i18n.loading, false );
			selector_request = window.jQuery.ajax( {
				url: transport_url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.action,
					nonce: transport.nonce,
					page: positive_integer( page, 1 ),
					per_page: positive_integer( draft_view.per_page, configuration.default_selector_size || 20 ),
					search: String( search || '' ),
					sort_order: normalize_sort_order( draft_view.sort_order )
				}
			} ).done( function ( response ) {
				if ( generation !== selector_generation ) {
					return;
				}
				if ( ! response || ! response.success || ! response.data ) {
					set_selector_status( get_error_message( response, null, i18n.load_error ), true );
					return;
				}
				render_selector_page( response.data );
			} ).fail( function ( request, request_status ) {
				if ( generation !== selector_generation || 'abort' === request_status ) {
					return;
				}
				set_selector_status( get_error_message( null, request, i18n.load_error ), true );
			} ).always( function () {
				if ( generation === selector_generation ) {
					selector_request = null;
				}
			} );

			return selector_request;
		}

		/**
		 * Materialize all authorized IDs only when all-mode loses one checkbox.
		 *
		 * The persisted contract intentionally has only `all` and `explicit`; it has
		 * no exclusion mode. A dedicated IDs-only read therefore produces an exact
		 * explicit draft without applying presentation-row or hierarchy budgets.
		 *
		 * @param {number[]} excluded_resource_ids Exact Resource IDs unchecked from all-mode.
		 * @return {void}
		 */
		function materialize_all_except( excluded_resource_ids ) {
			var generation;
			var maximum_selected = positive_integer( configuration.maximum_selected, 500 );
			var request;
			var excluded_lookup = Object.create( null );

			( Array.isArray( excluded_resource_ids ) ? excluded_resource_ids : [ excluded_resource_ids ] ).forEach( function ( resource_id ) {
				resource_id = positive_integer( resource_id, 0 );
				if ( resource_id ) {
					excluded_lookup[ resource_id ] = true;
				}
			} );

			if ( ! window.jQuery || ! transport_url || ! transport.selection_action || ! transport.selection_nonce || is_materializing || is_saving ) {
				set_selector_status( i18n.load_error, true );
				return;
			}
			materialization_generation += 1;
			generation = materialization_generation;
			is_materializing = true;
			if ( selector_root ) {
				Array.prototype.forEach.call( selector_root.querySelectorAll( 'input, select, button' ), function ( control ) {
					control.disabled = true;
				} );
			}
			set_selector_status( i18n.loading, false );
			refresh_selection_feedback();

			/**
			 * Release the materialization lock and restore the visible draft page.
			 *
			 * @param {string} error_message Safe error or an empty success value.
			 * @return {void}
			 */
			function finish_materialization( error_message ) {
				if ( generation !== materialization_generation ) {
					return;
				}
				is_materializing = false;
				materialization_requests = [];
				if ( selector_root ) {
					Array.prototype.forEach.call( selector_root.querySelectorAll( 'input, select, button' ), function ( control ) {
						control.disabled = false;
					} );
				}
				if ( selector_page ) {
					render_selector_page( selector_page );
				}
				if ( error_message ) {
					set_selector_status( error_message, true );
				}
				refresh_selection_feedback();
			}

			request = window.jQuery.ajax( {
				url: transport_url,
				method: 'POST',
				dataType: 'json',
				data: {
					action: transport.selection_action,
					nonce: transport.selection_nonce
				}
			} ).done( function ( response ) {
				var collected_ids = Object.create( null );
				var selection = response && response.data && response.data.selection ? response.data.selection : {};

				if ( generation !== materialization_generation ) {
					return;
				}
				if ( ! response || ! response.success || explicit_mode !== selection.mode || ! Array.isArray( selection.resource_ids ) ) {
					finish_materialization( get_error_message( response, null, i18n.load_error ) );
					return;
				}
				selection.resource_ids.forEach( function ( resource_id ) {
					resource_id = positive_integer( resource_id, 0 );
					if ( resource_id ) {
						collected_ids[ resource_id ] = true;
					}
				} );
				if (
					Object.keys( collected_ids ).length !== selection.resource_ids.length
					|| Object.keys( collected_ids ).length !== Number( selection.count )
				) {
					finish_materialization( i18n.load_error );
					return;
				}
				if ( Object.keys( collected_ids ).length > maximum_selected ) {
					finish_materialization( i18n.maximum_selected_error );
					return;
				}
				Object.keys( excluded_lookup ).forEach( function ( resource_id ) {
					delete collected_ids[ resource_id ];
				} );
				if ( ! Object.keys( collected_ids ).length ) {
					finish_materialization( i18n.minimum_one );
					return;
				}
				draft_view.selection_mode = explicit_mode;
				draft_view.selected_ids = collected_ids;
				finish_materialization( '' );
			} ).fail( function ( failed_request, request_status ) {
				if ( generation === materialization_generation && 'abort' !== request_status ) {
					finish_materialization( get_error_message( null, failed_request, i18n.load_error ) );
				}
			} );

			materialization_requests.push( request );
		}

		/**
		 * Send one complete Resource-view save and keep controls locked through readback.
		 *
		 * @param {Object} candidate Complete Resource-view save DTO.
		 * @param {boolean} close_selector Whether successful readback closes the selector.
		 * @return {Object|null} jQuery-compatible completion promise or null.
		 */
		function save_resource_view( candidate, close_selector ) {
			var completion;
			var request;

			if ( is_saving ) {
				return null;
			}
			if ( ! window.jQuery || ! transport_url || ! transport.save_action || ! transport.view_nonce ) {
				report_save_error( i18n.load_error, true );
				return null;
			}
			completion = window.jQuery.Deferred();
			set_save_busy( true );
			set_selector_status( i18n.applying, false );
			request = window.jQuery.ajax( {
				url: transport_url,
				method: 'POST',
				dataType: 'json',
				data: Object.assign( {}, candidate, {
					action: transport.save_action,
					nonce: transport.view_nonce
				} )
			} ).done( function ( response ) {
				var replacement;
				var error_message;

				if ( ! response || ! response.success || ! response.data || ! response.data.resource_view_context ) {
					error_message = get_error_message( response, null, i18n.load_error );
					report_save_error( error_message, true );
					completion.reject( false );
					return;
				}
				committed_view = normalize_resource_view( response.data.resource_view, configuration.default_selector_size || 20 );
				draft_view = clone_resource_view( committed_view );
				resource_pagination = response.data.resource_pagination || {};
				settings.resource_view = response.data.resource_view;
				settings.resource_pagination = resource_pagination;
				replacement = replace_resource_view( response.data.resource_view_context );
				if ( ! replacement || 'function' !== typeof replacement.done ) {
					report_save_error( i18n.load_error, true );
					completion.reject( false );
					return;
				}
				replacement.done( function () {
					announce( i18n.applied );
					if ( close_selector && selector_root ) {
						var close_button = selector_root.querySelector( '[data-wpbc-shared-ui-popover-close]' );
						if ( close_button ) {
							// The save lock disables Cancel, but a successful Apply must close through the shared lifecycle.
							close_button.disabled = false;
							close_button.click();
						}
					}
					completion.resolve( true );
				} ).fail( function () {
					// The page controller already owns the visible window-read error notice.
					report_save_error( i18n.load_error, false );
					completion.reject( false );
				} );
			} ).fail( function ( failed_request, request_status ) {
				if ( 'abort' !== request_status ) {
					report_save_error( get_error_message( null, failed_request, i18n.load_error ), true );
				}
				completion.reject( false );
			} );
			completion.always( function () {
				set_save_busy( false );
				render_main_pagination();
			} );

			return completion.promise( {
				abort: function () {
					if ( request && 'function' === typeof request.abort ) {
						request.abort();
					}
				}
			} );
		}

		/**
		 * Reset the selector draft when its disclosure opens.
		 *
		 * @return {void}
		 */
		function open_selector() {
			draft_view = clone_resource_view( committed_view );
			if ( sort_select ) {
				sort_select.value = draft_view.sort_order;
			}
			if ( page_size_select ) {
				page_size_select.value = String( draft_view.per_page );
			}
			refresh_selection_feedback();
			request_selector_page( 1, search_input ? search_input.value : '' );
			window.setTimeout( function () {
				if ( search_input ) {
					search_input.focus();
				}
			}, 0 );
		}

		/**
		 * Raise or restore the Resource header stacking layer with the selector.
		 *
		 * The date-axis header is a sibling stacking context. Raising the owning
		 * Resource header prevents its current-date marker from painting over the
		 * domain popover without changing Timeline scroll or shared-layer rules.
		 *
		 * @param {boolean} is_open Whether the Resource selector is open.
		 * @return {void}
		 */
		function set_selector_layer_state( is_open ) {
			if ( resource_header ) {
				resource_header.classList.toggle( 'has-open-resource-selector', Boolean( is_open ) );
			}
			if ( selector_backdrop ) {
				selector_backdrop.hidden = ! is_open || ! is_mobile_drawer();
			}
		}

		/**
		 * Determine whether the responsive Resource selector is a modal drawer.
		 *
		 * @return {boolean} True at the WordPress administration mobile breakpoint.
		 */
		function is_mobile_drawer() {
			return Boolean( mobile_drawer_media && mobile_drawer_media.matches );
		}

		/**
		 * Set the mobile Resource-pane presentation without changing saved view data.
		 *
		 * Both the sticky Resource header and Resource rows inherit the same collapsed
		 * width from the Timeline root. This preserves their alignment with the date
		 * axis while the toggle remains keyboard and screen-reader accessible.
		 *
		 * @param {boolean} should_collapse Whether the mobile Resource pane should collapse.
		 * @return {void}
		 */
		function set_resource_pane_collapsed( should_collapse ) {
			var next_collapsed = Boolean( should_collapse && is_mobile_drawer() );
			var toggle_label = next_collapsed ? i18n.show_resource_panel : i18n.hide_resource_panel;
			var accessible_label;
			var focused_control = document.activeElement;
			var should_restore_toggle_focus = Boolean(
				next_collapsed
				&& focused_control
				&& (
					resource_pane && resource_pane.contains( focused_control )
					|| selector_host && selector_host.contains( focused_control )
				)
			);

			if ( next_collapsed && selector_root && selector_root.classList.contains( 'is-open' ) ) {
				accessible_label = selector_root.querySelector( '[data-wpbc-timeline-resource-cancel]' );
				if ( accessible_label ) {
					accessible_label.click();
				}
			}
			is_resource_pane_collapsed = next_collapsed;
			if ( timeline_root ) {
				timeline_root.classList.toggle( 'is-resource-pane-collapsed', next_collapsed );
			}
			if ( resource_pane ) {
				if ( next_collapsed ) {
					resource_pane.setAttribute( 'aria-hidden', 'true' );
					resource_pane.setAttribute( 'inert', '' );
				} else {
					resource_pane.removeAttribute( 'aria-hidden' );
					resource_pane.removeAttribute( 'inert' );
				}
			}
			if ( ! resource_pane_toggle ) {
				return;
			}
			resource_pane_toggle.hidden = ! is_mobile_drawer();
			resource_pane_toggle.setAttribute( 'aria-expanded', next_collapsed ? 'false' : 'true' );
			resource_pane_toggle.setAttribute( 'aria-label', toggle_label );
			resource_pane_toggle.setAttribute( 'title', toggle_label );
			accessible_label = resource_pane_toggle.querySelector( '[data-wpbc-timeline-resource-pane-toggle-label]' );
			if ( accessible_label ) {
				accessible_label.textContent = toggle_label;
			}
			if ( should_restore_toggle_focus ) {
				window.setTimeout( function () {
					if ( resource_pane_toggle && ! resource_pane_toggle.hidden ) {
						resource_pane_toggle.focus();
					}
				}, 0 );
			}
		}

		/**
		 * Keep the drawer inside the visual viewport when zoom or a software
		 * keyboard reduces the usable layout viewport.
		 *
		 * @return {void}
		 */
		function update_mobile_viewport_metrics() {
			var viewport_height;
			var viewport_offset_top;
			var viewport_bottom_inset;

			if ( ! selector_panel || ! is_mobile_drawer() ) {
				if ( selector_panel ) {
					selector_panel.style.removeProperty( '--wpbc-timeline-resource-mobile-viewport-height' );
					selector_panel.style.removeProperty( '--wpbc-timeline-resource-mobile-bottom-inset' );
				}
				return;
			}
			viewport_height = visual_viewport ? visual_viewport.height : window.innerHeight;
			viewport_offset_top = visual_viewport ? visual_viewport.offsetTop : 0;
			viewport_bottom_inset = Math.max( 0, window.innerHeight - viewport_height - viewport_offset_top );
			selector_panel.style.setProperty( '--wpbc-timeline-resource-mobile-viewport-height', Math.max( 1, Math.floor( viewport_height ) ) + 'px' );
			selector_panel.style.setProperty( '--wpbc-timeline-resource-mobile-bottom-inset', Math.floor( viewport_bottom_inset ) + 'px' );
		}

		/**
		 * Synchronize responsive semantics without replacing the shared popover
		 * lifecycle that owns open, close, Escape, and trigger focus restoration.
		 *
		 * @return {void}
		 */
		function synchronize_responsive_mode() {
			var drawer_enabled = is_mobile_drawer();
			var selector_is_open = Boolean( selector_root && selector_root.classList.contains( 'is-open' ) );
			var entered_mobile_layout = drawer_enabled && true !== was_mobile_layout;

			if ( ! selector_root || ! selector_panel ) {
				return;
			}
			selector_root.classList.toggle( 'is-mobile-drawer', drawer_enabled );
			selector_panel.setAttribute( 'aria-modal', drawer_enabled ? 'true' : 'false' );
			selector_panel.setAttribute( 'data-wpbc-timeline-resource-layout', drawer_enabled ? 'drawer' : 'popover' );
			if ( selector_backdrop ) {
				selector_backdrop.hidden = ! drawer_enabled || ! selector_is_open;
			}
			if ( entered_mobile_layout ) {
				set_resource_pane_collapsed( true );
			} else if ( ! drawer_enabled ) {
				set_resource_pane_collapsed( false );
			} else {
				set_resource_pane_collapsed( is_resource_pane_collapsed );
			}
			was_mobile_layout = drawer_enabled;
			update_mobile_viewport_metrics();
		}

		/**
		 * Return enabled controls that can participate in the modal drawer focus loop.
		 *
		 * @return {HTMLElement[]} Ordered focusable controls.
		 */
		function get_drawer_focusable_controls() {
			if ( ! selector_panel ) {
				return [];
			}

			return Array.prototype.filter.call(
				selector_panel.querySelectorAll( 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])' ),
				function ( control ) {
					return ! control.hidden
						&& ! control.closest( '[hidden]' )
						&& 'true' !== control.getAttribute( 'aria-hidden' );
				}
			);
		}

		/**
		 * Handle Resource selector and pagination actions through one listener.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var pane_toggle = event.target.closest( '[data-wpbc-timeline-resource-pane-toggle]' );
			var select_all_button = event.target.closest( '[data-wpbc-timeline-resource-select-all]' );
			var clear_all_button = event.target.closest( '[data-wpbc-timeline-resource-clear-all]' );
			var apply_control = event.target.closest( '[data-wpbc-timeline-resource-apply]' );
			var page_control = event.target.closest( '[data-wpbc-timeline-resource-page]' );
			var pagination;
			var direction;
			var target_page;

			if ( pane_toggle && is_mobile_drawer() ) {
				set_resource_pane_collapsed( ! is_resource_pane_collapsed );
				return;
			}

			if ( select_all_button && ! is_saving && ! is_materializing ) {
				draft_view.selection_mode = all_mode;
				draft_view.selected_ids = Object.create( null );
				if ( selector_page ) {
					render_selector_page( selector_page );
				}
				return;
			}
			if ( clear_all_button && ! is_saving && ! is_materializing ) {
				draft_view.selection_mode = explicit_mode;
				draft_view.selected_ids = Object.create( null );
				if ( selector_page ) {
					render_selector_page( selector_page );
				}
				return;
			}
			if ( apply_control ) {
				if ( apply_control.disabled || explicit_mode === draft_view.selection_mode && ! Object.keys( draft_view.selected_ids ).length ) {
					refresh_selection_feedback();
					return;
				}
				save_resource_view( build_save_dto( with_current_expansion_state( draft_view ), 1 ), true );
				return;
			}
			if ( ! page_control || page_control.disabled || is_saving || is_materializing ) {
				return;
			}
			direction = page_control.getAttribute( 'data-wpbc-timeline-resource-page' );
			if ( 'selector' === page_control.getAttribute( 'data-wpbc-timeline-resource-page-context' ) ) {
				pagination = selector_page && selector_page.selector_pagination ? selector_page.selector_pagination : {};
				target_page = positive_integer( pagination.page, 1 ) + ( 'next' === direction ? 1 : -1 );
				pending_page_focus = direction;
				request_selector_page( target_page, search_input ? search_input.value : '' );
				return;
			}
			pagination = resource_pagination || {};
			target_page = positive_integer( pagination.page, 1 ) + ( 'next' === direction ? 1 : -1 );
			save_resource_view( build_save_dto( with_current_expansion_state( committed_view ), target_page ), false );
		}

		/**
		 * Update a cross-page selector draft from a checkbox.
		 *
		 * @param {Event} event Delegated change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			var checkbox = event.target.closest( '[data-wpbc-timeline-resource-checkbox]' );
			var sort_control = event.target.closest( '[data-wpbc-timeline-resource-sort]' );
			var page_size_control = event.target.closest( '[data-wpbc-timeline-resource-page-size]' );
			var requested_page_size;
			var resource_id;
			var resource;
			var selection_scope_ids;

			if ( is_saving || is_materializing ) {
				return;
			}
			if ( sort_control ) {
				draft_view.sort_order = normalize_sort_order( sort_control.value );
				pending_page_focus = '';
				request_selector_page( 1, search_input ? search_input.value : '' );
				return;
			}
			if ( page_size_control ) {
				requested_page_size = positive_integer( page_size_control.value, 0 );
				if ( -1 === page_size_options.indexOf( requested_page_size ) ) {
					page_size_control.value = String( draft_view.per_page );
					return;
				}
				draft_view.per_page = requested_page_size;
				pending_page_focus = '';
				request_selector_page( 1, search_input ? search_input.value : '' );
				return;
			}
			if ( ! checkbox ) {
				return;
			}
			resource_id = positive_integer( checkbox.value, 0 );
			if ( ! resource_id ) {
				return;
			}
			resource = ( selector_page && Array.isArray( selector_page.resources ) ? selector_page.resources : [] ).filter( function ( candidate ) {
				return resource_id === positive_integer( candidate.id, 0 );
			} )[0];
			if ( ! resource ) {
				// Retain the exact-row fallback for compatibility with pre-v2 cached selector markup.
				resource = { id: resource_id, is_group_control: false, selection_scope_ids: [ resource_id ] };
			}
			selection_scope_ids = get_resource_selection_scope( resource );
			if ( all_mode === draft_view.selection_mode && ! checkbox.checked ) {
				checkbox.checked = true;
				checkbox.indeterminate = false;
				materialize_all_except( selection_scope_ids );
				return;
			}
			draft_view.selection_mode = explicit_mode;
			selection_scope_ids.forEach( function ( selected_resource_id ) {
				if ( checkbox.checked ) {
					draft_view.selected_ids[ selected_resource_id ] = true;
				} else {
					delete draft_view.selected_ids[ selected_resource_id ];
				}
			} );
			synchronize_selector_checkboxes();
			refresh_selection_feedback();
		}

		/**
		 * Debounce selector search without changing the cross-page draft.
		 *
		 * @param {InputEvent} event Delegated input event.
		 * @return {void}
		 */
		function handle_input( event ) {
			if ( ! event.target.matches( '[data-wpbc-timeline-resource-search]' ) ) {
				return;
			}
			window.clearTimeout( search_timer );
			search_timer = window.setTimeout( function () {
				request_selector_page( 1, event.target.value );
			}, Math.max( 0, Number( configuration.search_delay_ms ) || 250 ) );
		}

		/**
		 * Support direct search submission and predictable list entry by keyboard.
		 *
		 * @param {KeyboardEvent} event Delegated key event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var first_checkbox;
			var focusable_controls;
			var first_control;
			var last_control;

			if (
				'Tab' === event.key
				&& is_mobile_drawer()
				&& selector_root
				&& selector_root.classList.contains( 'is-open' )
			) {
				focusable_controls = get_drawer_focusable_controls();
				first_control = focusable_controls[0];
				last_control = focusable_controls[ focusable_controls.length - 1 ];
				if ( first_control && last_control && event.shiftKey && document.activeElement === first_control ) {
					event.preventDefault();
					last_control.focus();
					return;
				}
				if ( first_control && last_control && ! event.shiftKey && document.activeElement === last_control ) {
					event.preventDefault();
					first_control.focus();
					return;
				}
			}

			if ( event.target.matches( '[data-wpbc-timeline-resource-search]' ) && 'Enter' === event.key ) {
				event.preventDefault();
				window.clearTimeout( search_timer );
				request_selector_page( 1, event.target.value );
				return;
			}
			if ( event.target.matches( '[data-wpbc-timeline-resource-search]' ) && 'ArrowDown' === event.key ) {
				first_checkbox = selector_rows ? selector_rows.querySelector( '[data-wpbc-timeline-resource-checkbox]' ) : null;
				if ( first_checkbox ) {
					event.preventDefault();
					first_checkbox.focus();
				}
				return;
			}
			if (
				event.target.matches( '[data-wpbc-timeline-resource-checkbox]' )
				&& 'ArrowUp' === event.key
				&& selector_rows
				&& event.target === selector_rows.querySelector( '[data-wpbc-timeline-resource-checkbox]' )
				&& search_input
			) {
				event.preventDefault();
				search_input.focus();
			}
		}

		/**
		 * Focus the selector search after the shared disclosure opens.
		 *
		 * @param {CustomEvent} event Shared UI layer lifecycle event.
		 * @return {void}
		 */
		function handle_layer_open( event ) {
			if ( event.detail && selector_instance_id === event.detail.instance_id ) {
				synchronize_responsive_mode();
				set_selector_layer_state( true );
				open_selector();
			}
		}

		/**
		 * Cancel selector-only reads when the disclosure closes.
		 *
		 * Save/readback remains owned by its independent request so closing with
		 * Escape cannot interrupt a preference that the server may have committed.
		 *
		 * @param {CustomEvent} event Shared UI layer lifecycle event.
		 * @return {void}
		 */
		function handle_layer_close( event ) {
			if ( ! event.detail || selector_instance_id !== event.detail.instance_id ) {
				return;
			}
			set_selector_layer_state( false );
			selector_generation += 1;
			materialization_generation += 1;
			window.clearTimeout( search_timer );
			if ( selector_request && 'function' === typeof selector_request.abort ) {
				selector_request.abort();
			}
			selector_request = null;
			materialization_requests.forEach( function ( request ) {
				if ( request && 'function' === typeof request.abort ) {
					request.abort();
				}
			} );
			materialization_requests = [];
			is_materializing = false;
			draft_view = clone_resource_view( committed_view );
		}

		/**
		 * Refresh canonical view and pagination after a server window commit.
		 *
		 * @param {Object} resource_view Server Resource-view DTO.
		 * @param {Object} pagination Server Resource pagination DTO.
		 * @return {void}
		 */
		function refresh( resource_view, pagination ) {
			committed_view = normalize_resource_view( resource_view, configuration.default_selector_size || 20 );
			draft_view = clone_resource_view( committed_view );
			page_size_options = normalize_page_size_options(
				configuration.page_size_options,
				committed_view.per_page,
				configuration.maximum_selector_size
			);
			resource_pagination = pagination && 'object' === typeof pagination ? pagination : {};
			settings.resource_view = resource_view;
			settings.resource_pagination = resource_pagination;
			if ( page_size_select ) {
				page_size_select.value = String( committed_view.per_page );
			}
			refresh_selection_feedback();
			render_main_pagination();
		}

		/**
		 * Render the selector shell and attach delegated module listeners.
		 *
		 * @return {void}
		 */
		function initialize() {
			if ( ! mount || is_initialized ) {
				return;
			}
			selector_host = mount.querySelector( '[data-wpbc-timeline-resource-selector-host]' );
			main_pagination_host = mount.querySelector( '[data-wpbc-timeline-resource-main-pagination]' );
			timeline_root = mount.matches && mount.matches( '.wpbc_timeline' ) ? mount : mount.querySelector( '.wpbc_timeline' );
			resource_pane = mount.querySelector( '[data-wpbc-timeline-resource-pane]' );
			resource_pane_toggle_host = mount.querySelector( '[data-wpbc-timeline-resource-pane-toggle-host]' );
			if ( resource_pane_toggle_host ) {
				render_template( resource_pane_toggle_host, 'pane_toggle', {
					show_label: i18n.show_resource_panel,
					hide_label: i18n.hide_resource_panel
				} );
				resource_pane_toggle = resource_pane_toggle_host.querySelector( '[data-wpbc-timeline-resource-pane-toggle]' );
			}
			if ( ! selector_host || ! render_template( selector_host, 'selector', {
				trigger_label: get_trigger_label(),
				selected_label: interpolate( i18n.selected_count, { count: get_selected_count() } ),
				sort_order: committed_view.sort_order,
				sort_options: Array.isArray( configuration.sort_options ) ? configuration.sort_options : [],
				per_page: committed_view.per_page,
				page_size_options: page_size_options,
				i18n: i18n
			} ) ) {
				return;
			}
			selector_root = selector_host.querySelector( '[data-wpbc-shared-ui-popover]' );
			selector_panel = selector_host.querySelector( '[data-wpbc-timeline-resource-selector-panel]' );
			selector_backdrop = selector_host.querySelector( '[data-wpbc-timeline-resource-drawer-backdrop]' );
			resource_header = selector_root && selector_root.closest ? selector_root.closest( '.wpbc_timeline__resource_header' ) : null;
			selector_rows = selector_host.querySelector( '[data-wpbc-timeline-resource-selector-rows]' );
			selector_pagination_host = selector_host.querySelector( '[data-wpbc-timeline-resource-selector-pagination]' );
			selector_status = selector_host.querySelector( '[data-wpbc-timeline-resource-selector-status]' );
			selector_status_message = selector_host.querySelector( '[data-wpbc-timeline-resource-selector-status-message]' );
			selector_spinner = selector_host.querySelector( '[data-wpbc-timeline-resource-selector-spinner]' );
			validation = selector_host.querySelector( '[data-wpbc-timeline-resource-validation]' );
			validation_message = selector_host.querySelector( '[data-wpbc-timeline-resource-validation-message]' );
			apply_button = selector_host.querySelector( '[data-wpbc-timeline-resource-apply]' );
			search_input = selector_host.querySelector( '[data-wpbc-timeline-resource-search]' );
			sort_select = selector_host.querySelector( '[data-wpbc-timeline-resource-sort]' );
			page_size_select = selector_host.querySelector( '[data-wpbc-timeline-resource-page-size]' );
			mobile_drawer_media = window.matchMedia ? window.matchMedia( '(max-width: 782px)' ) : null;
			mount.addEventListener( 'click', handle_click );
			mount.addEventListener( 'change', handle_change );
			mount.addEventListener( 'input', handle_input );
			mount.addEventListener( 'keydown', handle_keydown );
			document.addEventListener( 'wpbc:shared-ui-layer-open', handle_layer_open );
			document.addEventListener( 'wpbc:shared-ui-layer-close', handle_layer_close );
			window.addEventListener( 'resize', update_mobile_viewport_metrics );
			if ( mobile_drawer_media ) {
				if ( 'function' === typeof mobile_drawer_media.addEventListener ) {
					mobile_drawer_media.addEventListener( 'change', synchronize_responsive_mode );
				} else if ( 'function' === typeof mobile_drawer_media.addListener ) {
					mobile_drawer_media.addListener( synchronize_responsive_mode );
				}
			}
			if ( visual_viewport && 'function' === typeof visual_viewport.addEventListener ) {
				visual_viewport.addEventListener( 'resize', update_mobile_viewport_metrics );
				visual_viewport.addEventListener( 'scroll', update_mobile_viewport_metrics );
			}
			is_initialized = true;
			synchronize_responsive_mode();
			refresh_selection_feedback();
			render_main_pagination();
		}

		/**
		 * Abort requests, timers, and listeners owned by this module.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! is_initialized ) {
				return;
			}
			selector_generation += 1;
			materialization_generation += 1;
			window.clearTimeout( search_timer );
			set_selector_layer_state( false );
			if ( selector_request && 'function' === typeof selector_request.abort ) {
				selector_request.abort();
			}
			materialization_requests.forEach( function ( request ) {
				if ( request && 'function' === typeof request.abort ) {
					request.abort();
				}
			} );
			mount.removeEventListener( 'click', handle_click );
			mount.removeEventListener( 'change', handle_change );
			mount.removeEventListener( 'input', handle_input );
			mount.removeEventListener( 'keydown', handle_keydown );
			document.removeEventListener( 'wpbc:shared-ui-layer-open', handle_layer_open );
			document.removeEventListener( 'wpbc:shared-ui-layer-close', handle_layer_close );
			window.removeEventListener( 'resize', update_mobile_viewport_metrics );
			if ( mobile_drawer_media ) {
				if ( 'function' === typeof mobile_drawer_media.removeEventListener ) {
					mobile_drawer_media.removeEventListener( 'change', synchronize_responsive_mode );
				} else if ( 'function' === typeof mobile_drawer_media.removeListener ) {
					mobile_drawer_media.removeListener( synchronize_responsive_mode );
				}
			}
			if ( visual_viewport && 'function' === typeof visual_viewport.removeEventListener ) {
				visual_viewport.removeEventListener( 'resize', update_mobile_viewport_metrics );
				visual_viewport.removeEventListener( 'scroll', update_mobile_viewport_metrics );
			}
			if ( selector_panel ) {
				selector_panel.style.removeProperty( '--wpbc-timeline-resource-mobile-viewport-height' );
				selector_panel.style.removeProperty( '--wpbc-timeline-resource-mobile-bottom-inset' );
				selector_panel.setAttribute( 'aria-modal', 'false' );
				selector_panel.setAttribute( 'data-wpbc-timeline-resource-layout', 'popover' );
			}
			if ( selector_root ) {
				selector_root.classList.remove( 'is-mobile-drawer' );
			}
			if ( selector_backdrop ) {
				selector_backdrop.hidden = true;
			}
			if ( timeline_root ) {
				timeline_root.classList.remove( 'is-resource-pane-collapsed' );
			}
			if ( resource_pane ) {
				resource_pane.removeAttribute( 'aria-hidden' );
				resource_pane.removeAttribute( 'inert' );
			}
			if ( resource_pane_toggle ) {
				resource_pane_toggle.hidden = true;
				resource_pane_toggle.setAttribute( 'aria-expanded', 'true' );
			}
			was_mobile_layout = null;
			is_resource_pane_collapsed = false;
			is_initialized = false;
		}

		return {
			initialize: initialize,
			refresh: refresh,
			destroy: destroy
		};
	}

	if ( window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory ) {
		window.wpbc_timeline_modules.register_factory( module_id, create_resource_navigation );
	}
}( window, document, window.wp ) );
