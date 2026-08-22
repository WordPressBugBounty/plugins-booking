/**
 * Render normalized Booking Resource DTOs through identifiable WP templates.
 *
 * @since 11.6.0
 */
( function ( window, document ) {
	'use strict';

	var catalog_controller = null;
	var inline_workflow_controller = null;
	var inline_review_workflow_controller = null;
	var delete_review_workflow_controller = null;
	var inspector_workflow_controller = null;
	var catalog_response = null;
	var details_abort_controller = null;
	var details_request_sequence = 0;
	var details_resource_id = 0;
	var details_toggle_button = null;
	var pending_focus_direction = '';
	var inspector_dirty = false;
	var inspector_focus_target = null;
	var inspector_mode = '';
	var inspector_mutation_in_progress = false;
	var inspector_mutation_request_sequence = 0;
	var inspector_original_fields = '';
	var inspector_request_sequence = 0;
	var inspector_resource_id = 0;
	var inspector_resource_ids = [];
	var inspector_bulk_operations = {};
	var inspector_review_token = '';
	var inspector_selection_stale = false;
	var inspector_tracks_selection = false;
	var inspector_capacity_context = null;
	var inspector_capacity_detach_ids = [];
	var inspector_capacity_decrease_action = 'detach';
	var inspector_capacity_target = 0;
	var pending_highlight_ids = [];
	var inline_state = {
		active: false,
		changed_rows: [],
		loading: false,
		request_sequence: 0,
		review_token: ''
	};

	/**
	 * Normalize a localized WordPress flag to a strict boolean.
	 *
	 * @param {*} flag_value Localized flag value.
	 * @return {boolean} True only for an explicitly enabled flag.
	 */
	function is_true_flag( flag_value ) {
		return true === flag_value || 1 === flag_value || '1' === flag_value || 'true' === String( flag_value ).toLowerCase();
	}

	/**
	 * Format a localized positional-placeholder string.
	 *
	 * @param {string} template Localized string containing `%1$s` placeholders.
	 * @param {Array<*>} values Scalar replacement values.
	 * @return {string} Formatted plain text.
	 */
	function format_message( template, values ) {
		var message = String( template || '' );

		values.forEach( function ( replacement, replacement_index ) {
			var placeholder = new RegExp( '%' + ( replacement_index + 1 ) + '\\$s', 'g' );
			message = message.replace( placeholder, String( replacement ) );
		} );

		return message;
	}

	/**
	 * Return the shared signed-review presentation controller.
	 *
	 * @return {Object|false} Shared review controller or false when unavailable.
	 */
	function get_inline_review_workflow() {
		if ( inline_review_workflow_controller ) {
			return inline_review_workflow_controller;
		}
		if ( ! window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.create_inline_review_workflow ) {
			return false;
		}
		inline_review_workflow_controller = window.wpbc_ui_catalog.create_inline_review_workflow( {
			apply_selector: '[data-wpbc-ui-catalog-inspector-save]',
			cancel_selector: '[data-wpbc-ui-catalog-inspector-cancel]',
			root: document
		} );

		return inline_review_workflow_controller;
	}

	/**
	 * Return the shared permanent-deletion presentation controller.
	 *
	 * @return {Object|false} Shared deletion controller or false when unavailable.
	 */
	function get_delete_review_workflow() {
		if ( delete_review_workflow_controller ) {
			return delete_review_workflow_controller;
		}
		if ( ! window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.create_delete_review_workflow ) {
			return false;
		}
		delete_review_workflow_controller = window.wpbc_ui_catalog.create_delete_review_workflow( {
			acknowledgement_selector: '[data-wpbc-catalog-resource-delete-acknowledgement]',
			apply_selector: '[data-wpbc-ui-catalog-inspector-save]',
			cancel_selector: '[data-wpbc-ui-catalog-inspector-cancel]',
			root: document
		} );

		return delete_review_workflow_controller;
	}

	/**
	 * Return the localized count shown in a collapsed child-group summary.
	 *
	 * The DTO label remains authoritative because PHP applies WordPress locale
	 * plural rules. The numeric fallback consumes the shared direct-child count
	 * when an older or custom domain DTO does not include the prepared label.
	 *
	 * @param {Object} parent_resource Parent Booking Resource DTO.
	 * @param {Object} i18n            Localized catalog strings.
	 * @return {string} Localized child-count label.
	 */
	function get_children_summary_label( parent_resource, i18n ) {
		var hierarchy = parent_resource && parent_resource.hierarchy ? parent_resource.hierarchy : {};
		var server_label = String( hierarchy.children_label || '' ).trim();
		var child_count = Math.max( 0, Number( hierarchy.rendered_children_count ) || 0 );
		var label_template;

		if ( server_label ) {
			return server_label;
		}

		label_template = 1 === child_count
			? i18n.child_count_singular || '%1$s child resource'
			: i18n.child_count_plural || '%1$s child resources';

		return format_message( label_template, [ child_count ] );
	}

	/**
	 * Render one allow-listed Resource presentation template.
	 *
	 * @param {Object} config        Registered catalog configuration.
	 * @param {string} template_role Registered template role.
	 * @param {Object} template_data Normalized DTO or presentation data.
	 * @return {string} Escaped template HTML or an empty string.
	 */
	function render_component( config, template_role, template_data ) {
		var component_template = window.wpbc_ui_catalog.load_template( config, template_role );

		if ( ! component_template ) {
			return '';
		}

		try {
			return component_template( template_data || {} );
		} catch ( error ) {
			return '';
		}
	}

	/**
	 * Return complete column presentation records in the active order.
	 *
	 * @param {Object} config         Registered catalog configuration.
	 * @param {Object} display_state  Normalized display request or response.
	 * @param {boolean} visible_only  Whether hidden columns must be omitted.
	 * @param {Object} sorting_state  Normalized sorting response.
	 * @return {Array<Object>} Ordered presentation-only column records.
	 */
	function get_columns( config, display_state, visible_only, sorting_state ) {
		var column_config = config.columns || {};
		var definitions = column_config.definitions || {};
		var default_order = Array.isArray( column_config.default_order ) ? column_config.default_order : [];
		var order = display_state && Array.isArray( display_state.column_order ) ? display_state.column_order.slice() : default_order.slice();
		var visible_columns = display_state && Array.isArray( display_state.visible_columns ) ? display_state.visible_columns : column_config.default_visible || [];

		default_order.forEach( function ( column_id ) {
			if ( -1 === order.indexOf( column_id ) ) {
				order.push( column_id );
			}
		} );

		return order.filter( function ( column_id ) {
			return definitions[ column_id ] && ( ! visible_only || -1 !== visible_columns.indexOf( column_id ) );
		} ).map( function ( column_id, column_index ) {
			var definition = definitions[ column_id ];
			var is_sorted = !! definition.sort_key && sorting_state && definition.sort_key === sorting_state.sort_by;
			return {
				aria_sort: is_sorted ? ( 'desc' === sorting_state.sort_order ? 'descending' : 'ascending' ) : 'none',
				class_name: definition.class || 'column-' + column_id,
				default_index: default_order.indexOf( column_id ),
				id: column_id,
				is_sorted: is_sorted,
				label: definition.label || column_id,
				move_label: format_message( config.i18n.move_column || '', [ definition.label || column_id ] ),
				reorderable: false !== definition.reorderable,
				required: !! definition.required,
				sort_icon: is_sorted ? ( 'desc' === sorting_state.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' ) : 'wpbc_icn_import_export',
				sort_key: definition.sort_key || '',
				visible: -1 !== visible_columns.indexOf( column_id )
			};
		} );
	}

	/**
	 * Determine whether display values match the Overview defaults.
	 *
	 * @param {Object} config        Registered catalog configuration.
	 * @param {Object} display_state Current normalized display state.
	 * @return {string} overview or custom.
	 */
	function get_active_view( config, display_state ) {
		var view_definitions = config.views && config.views.definitions ? config.views.definitions : {};
		var current_visible = display_state && Array.isArray( display_state.visible_columns ) ? display_state.visible_columns : [];
		var matching_view = '';

		Object.keys( view_definitions ).some( function ( view_id ) {
			var view_fields = Array.isArray( view_definitions[ view_id ].fields ) ? view_definitions[ view_id ].fields : [];
			if ( JSON.stringify( current_visible ) === JSON.stringify( view_fields ) ) {
				matching_view = view_id;
				return true;
			}
			return false;
		} );

		return matching_view || 'custom';
	}

	/**
	 * Return ordered view presets declared by the independent PHP configuration.
	 *
	 * @param {Object} config Registered catalog configuration.
	 * @return {Array<Object>} Browser-safe view definitions.
	 */
	function get_view_definitions( config ) {
		var definitions = config.views && config.views.definitions ? config.views.definitions : {};

		return Object.keys( definitions ).map( function ( view_id ) {
			return definitions[ view_id ];
		} );
	}

	/**
	 * Return the allow-listed presentation packs declared by PHP.
	 *
	 * Labels remain domain-owned while the shared controller validates and
	 * persists only pack identifiers registered in the catalog configuration.
	 *
	 * @param {Object} config Registered catalog configuration.
	 * @return {Array<Object>} Ordered browser-safe pack options.
	 */
	function get_template_pack_definitions( config ) {
		var labels = {
			cards: config.i18n.layout_cards || '',
			compact: config.i18n.layout_compact || '',
			table: config.i18n.layout_table || ''
		};
		var template_packs = config.template_packs || {};

		return Object.keys( template_packs ).map( function ( template_pack_id ) {
			return {
				id: template_pack_id,
				label: labels[ template_pack_id ] || template_pack_id
			};
		} );
	}

	/**
	 * Render the established Resource filters above the bordered listing.
	 *
	 * Free editions intentionally render no filter form, matching the existing
	 * page where a single default Resource makes these controls unnecessary.
	 *
	 * @param {Object} config Registered catalog configuration.
	 * @return {boolean} True when the filters target was found.
	 */
	function render_booking_resources_filters( config ) {
		var initial_request = config.initial_request || {};
		var mount_element = document.getElementById( config.mount_id );
		var filters_target = mount_element ? mount_element.querySelector( '[data-wpbc-booking-resources-filters]' ) : null;

		if ( ! filters_target ) {
			return false;
		}
		filters_target.innerHTML = render_component( config, 'filters', {
			i18n: config.i18n || {},
			resource_type: initial_request.resource_type || 'all',
			search: initial_request.search || '',
			show_filters: !! ( config.features && config.features.resource_filters ),
			show_resource_type_filter: !! ( config.features && config.features.resource_type_filter )
		} );

		return true;
	}

	/**
	 * Render persistent filters and display controls outside response content.
	 *
	 * @param {Object} config Registered catalog configuration.
	 * @return {boolean} True when the toolbar target was populated.
	 */
	function render_booking_resources_toolbar( config ) {
		var initial_request = config.initial_request || {};
		var mount_element = document.getElementById( config.mount_id );
		var toolbar_target = mount_element ? mount_element.querySelector( '[data-wpbc-booking-resources-toolbar]' ) : null;

		if ( ! toolbar_target ) {
			return false;
		}
		toolbar_target.innerHTML = render_component( config, 'toolbar', {
			active_template_pack: initial_request.template_pack || config.default_template_pack || 'table',
			active_view: get_active_view( config, initial_request ),
			columns: get_columns( config, initial_request, false, initial_request ),
			i18n: config.i18n || {},
			template_packs: get_template_pack_definitions( config ),
			views: get_view_definitions( config )
		} );
		if ( catalog_controller && 'function' === typeof catalog_controller.refresh_controls ) {
			catalog_controller.refresh_controls();
		}

		return !! toolbar_target.firstElementChild;
	}

	/**
	 * Add full-text tooltips only to elements whose rendered text is clipped.
	 *
	 * Native title text remains available without a JavaScript tooltip library;
	 * the established tooltip attributes are also supplied for Booking Calendar
	 * admin themes that initialize them globally.
	 *
	 * @param {HTMLElement} catalog_mount Catalog mount element.
	 * @return {void}
	 */
	function synchronize_overflow_tooltips( catalog_mount ) {
		if ( ! window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.synchronize_overflow_tooltips ) {
			return;
		}

		window.wpbc_ui_catalog.synchronize_overflow_tooltips( catalog_mount );
	}

	/**
	 * Initialize tooltips for compact controls inserted by a lazy details render.
	 *
	 * The native title remains as a fallback when the established Booking
	 * Calendar tooltip helper is unavailable.
	 *
	 * @param {HTMLElement} catalog_mount Catalog mount element.
	 * @return {void}
	 */
	function initialize_details_tooltips( catalog_mount ) {
		var tooltip_selector;

		if ( ! catalog_mount || ! catalog_mount.id || 'function' !== typeof window.wpbc_define_tippy_tooltips ) {
			return;
		}
		tooltip_selector = '#' + catalog_mount.id + ' [data-wpbc-ui-catalog-details-tooltip]';
		window.wpbc_define_tippy_tooltips( tooltip_selector );
	}

	/**
	 * Synchronize persistent controls with server-authoritative response state.
	 *
	 * @param {Object} config   Registered catalog configuration.
	 * @param {Object} response Normalized catalog response.
	 * @return {void}
	 */
	function synchronize_booking_resources_toolbar( config, response ) {
		var columns = get_columns( config, response.display || {}, false, response.sorting || {} );
		var mount_element = document.getElementById( config.mount_id );
		var column_list = mount_element ? mount_element.querySelector( '[data-wpbc-ui-catalog-column-list]' ) : null;
		var search_control = mount_element ? mount_element.querySelector( '[data-wpbc-ui-catalog-search]' ) : null;
		var template_pack_control = mount_element ? mount_element.querySelector( '[data-wpbc-ui-catalog-template-pack]' ) : null;
		var type_control = mount_element ? mount_element.querySelector( '[data-wpbc-ui-catalog-filter="resource_type"]' ) : null;
		var view_control = mount_element ? mount_element.querySelector( '[data-wpbc-ui-catalog-view]' ) : null;

		if ( search_control && document.activeElement !== search_control ) {
			search_control.value = response.filters.search || '';
		}
		if ( type_control ) {
			type_control.value = response.filters.resource_type || 'all';
		}
		if ( template_pack_control && response.display && response.display.template_pack ) {
			template_pack_control.value = response.display.template_pack;
		}
		columns.forEach( function ( column ) {
			var column_control = mount_element.querySelector( '[data-wpbc-ui-catalog-column-visible][value="' + column.id + '"]' );
			var column_item = mount_element.querySelector( '[data-wpbc-ui-catalog-column-item="' + column.id + '"]' );
			if ( column_control ) {
				column_control.checked = column.visible;
			}
			if ( column_list && column_item ) {
				column_list.appendChild( column_item );
			}
		} );
		if ( view_control ) {
			view_control.value = get_active_view( config, response.display || {} );
		}
	}

	/**
	 * Render the persistent inline-edit status bar from its registered template.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {void}
	 */
	function render_inline_bar( config ) {
		var mount_element = document.getElementById( config.mount_id );
		var inline_host = mount_element ? mount_element.querySelector( '[data-wpbc-catalog-inline-bar-host]' ) : null;

		if ( inline_host && ! inline_host.firstElementChild ) {
			inline_host.innerHTML = render_component( config, 'inline_bar', { i18n: config.i18n || {} } );
		}
		if ( inline_workflow_controller ) {
			inline_workflow_controller.register_sticky_bar();
		}
	}

	/**
	 * Synchronize inline activation, changed count, and disabled navigation.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {void}
	 */
	function synchronize_inline_controls( config ) {
		var mount_element = document.getElementById( config.mount_id );
		var changed_count = inline_state.changed_rows.length;
		var count_label = 1 === changed_count ? config.i18n.inline_changed_row : config.i18n.inline_changed_rows;

		if ( ! mount_element || ! inline_workflow_controller ) {
			return;
		}

		inline_workflow_controller.synchronize( {
			active: inline_state.active,
			active_toggle_text: config.i18n.inline_editing_rows || '',
			busy: inline_state.loading,
			changed_count: changed_count,
			count_text: inline_state.loading
				? config.i18n.inline_loading || ''
				: format_message( count_label || '%1$s changed rows', [ changed_count ] ),
			has_items: !! mount_element.querySelector( '[data-wpbc-booking-resource-id]' ),
			inactive_toggle_text: config.i18n.edit_rows || ''
		} );
	}

	/**
	 * Block page-changing catalog controls before shared handlers can discard drafts.
	 *
	 * Native summary elements do not honor a disabled property, so this capture
	 * guard complements the visual disabled state while inline editing is active.
	 *
	 * @param {Event} event Captured catalog event.
	 * @return {void}
	 */
	function protect_inline_drafts_from_catalog_controls( event ) {
		if ( inline_workflow_controller ) {
			inline_workflow_controller.protect_event( event, inline_state.active );
		}
	}

	/**
	 * Show or clear an inline workflow error.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {string} message Safe message or empty string.
	 * @return {void}
	 */
	function show_inline_message( config, message ) {
		var mount_element = document.getElementById( config.mount_id );
		var notice = mount_element ? mount_element.querySelector( '[data-wpbc-catalog-inline-message]' ) : null;

		if ( notice ) {
			notice.hidden = ! message;
			var text = notice.querySelector( 'p' );
			if ( text ) {
				text.textContent = message || '';
			}
		}
	}

	/**
	 * Render one server-declared field through the inline WP template.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {Object} row_schema Row schema.
	 * @return {void}
	 */
	function render_inline_row( config, row_schema ) {
		var mount_element = document.getElementById( config.mount_id );
		var resource_id = Number( row_schema.resource_id ) || 0;
		var row = mount_element ? mount_element.querySelector( '[data-wpbc-booking-resource-id="' + resource_id + '"]' ) : null;
		var resource_fields = [];

		if ( ! row ) {
			return;
		}
		( row_schema.fields || [] ).forEach( function ( field ) {
			var cell = row.querySelector( '[data-wpbc-ui-catalog-field="' + String( field.column || '' ) + '"]' );
			if ( ! cell || cell.hidden ) {
				return;
			}
			if ( 'resource' === field.column ) {
				resource_fields.push( field );
				return;
			}
			cell.innerHTML = render_component( config, 'inline_field', { field: field, resource_id: resource_id } );
		} );
		if ( resource_fields.length ) {
			var copy = row.querySelector( '[data-wpbc-ui-catalog-field="resource"] .wpbc_ui_listing__item_copy' );
			if ( copy ) {
				var wrapper = document.createElement( 'span' );
				wrapper.className = 'wpbc_booking_resources__inline_identity_fields';
				resource_fields.forEach( function ( field ) {
					wrapper.insertAdjacentHTML( 'beforeend', render_component( config, 'inline_field', { field: field, resource_id: resource_id } ) );
				} );
				copy.replaceWith( wrapper );
			}
		}
	}

	/**
	 * Collect only changed row fields while preserving visible catalog order.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {Array<Object>} Changed row envelopes.
	 */
	function collect_inline_drafts( config ) {
		var mount_element = document.getElementById( config.mount_id );
		var changed_rows = [];

		if ( ! mount_element ) {
			return changed_rows;
		}
		mount_element.querySelectorAll( '.wpbc_booking_resources__item[data-wpbc-booking-resource-id]' ).forEach( function ( row ) {
			var fields = {};
			var has_changes;
			var indicator_host;

			row.querySelectorAll( '[data-wpbc-catalog-inline-field]' ).forEach( function ( control ) {
				var field_key = control.getAttribute( 'data-wpbc-catalog-inline-field' ) || '';
				if ( field_key && String( control.value || '' ) !== String( control.getAttribute( 'data-wpbc-catalog-inline-original' ) || '' ) ) {
					fields[ field_key ] = control.value;
				}
			} );
			has_changes = 0 < Object.keys( fields ).length;
			indicator_host = row.querySelector( '[data-wpbc-ui-catalog-field="resource"]' );
			row.classList.toggle( 'is-inline-dirty', has_changes );
			if ( inline_workflow_controller ) {
				inline_workflow_controller.set_row_changed( row, has_changes, indicator_host, config.i18n.inline_changed || '' );
			}
			if ( has_changes ) {
				changed_rows.push( { resource_id: Number( row.getAttribute( 'data-wpbc-booking-resource-id' ) ), fields: fields } );
			}
		} );

		return changed_rows;
	}

	/**
	 * Invalidate a prior review and synchronize draft state.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {void}
	 */
	function synchronize_inline_drafts( config ) {
		inline_state.changed_rows = collect_inline_drafts( config );
		inline_state.review_token = '';
		show_inline_message( config, '' );
		synchronize_inline_controls( config );
	}

	/**
	 * Exit inline mode and optionally reload canonical rows.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {boolean} reload Whether to reload the catalog.
	 * @param {string} message Optional success message.
	 * @return {void}
	 */
	function leave_inline_mode( config, reload, message ) {
		inline_state.request_sequence += 1;
		inline_state.active = false;
		inline_state.loading = false;
		inline_state.changed_rows = [];
		inline_state.review_token = '';
		if ( 'inline_review' === inspector_mode ) {
			close_inspector( config, false );
		}
		synchronize_inline_controls( config );
		if ( message ) {
			show_admin_message( message, 'success', 4000 );
		}
		if ( reload && catalog_controller ) {
			catalog_controller.load();
		}
	}

	/**
	 * Start row editing for the current visible Resource page.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {void}
	 */
	function start_inline_mode( config ) {
		var mount_element = document.getElementById( config.mount_id );
		var resource_ids = [];
		var request_sequence;

		if ( inline_state.active ) {
			synchronize_inline_drafts( config );
			if ( ! inline_state.changed_rows.length || window.confirm( config.i18n.inline_discard || '' ) ) {
				leave_inline_mode( config, true, '' );
			}
			return;
		}
		mount_element.querySelectorAll( '.wpbc_booking_resources__item[data-wpbc-booking-resource-id]' ).forEach( function ( row ) {
			resource_ids.push( Number( row.getAttribute( 'data-wpbc-booking-resource-id' ) ) );
		} );
		if ( ! resource_ids.length ) {
			return;
		}
		if ( ! can_discard_inspector( config ) ) {
			return;
		}
		close_inspector( config, false );
		mount_element.querySelectorAll( '[data-wpbc-ui-catalog-display-customizer][open]' ).forEach( function ( customizer ) {
			customizer.removeAttribute( 'open' );
		} );
		inline_state.active = true;
		inline_state.loading = true;
		inline_state.changed_rows = [];
		request_sequence = ++inline_state.request_sequence;
		close_details_row( false );
		synchronize_inline_controls( config );
		request_inspector( config, config.inline_schema_action, { resource_ids: JSON.stringify( resource_ids ) } ).then( function ( response ) {
			if ( request_sequence !== inline_state.request_sequence || ! inline_state.active || ! response || ! response.success || ! response.data || ! response.data.schema ) {
				throw new Error( get_inspector_response_message( response, config.i18n.inline_load_failed ) );
			}
			( response.data.schema.rows || [] ).forEach( function ( row_schema ) {
				render_inline_row( config, row_schema );
			} );
			var first_field = mount_element.querySelector( '[data-wpbc-catalog-inline-field]' );
			if ( first_field ) {
				first_field.focus();
			}
		} ).catch( function ( error ) {
			if ( request_sequence === inline_state.request_sequence ) {
				show_admin_message( error.message || config.i18n.inline_load_failed || '', 'error', 5000 );
				inline_state.active = false;
				if ( catalog_controller ) {
					catalog_controller.load();
				}
			}
		} ).then( function () {
			if ( request_sequence === inline_state.request_sequence ) {
				inline_state.loading = false;
				synchronize_inline_controls( config );
			}
		} );
	}

	/**
	 * Preview current inline drafts and open their signed review inspector.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {HTMLElement} focus_target Review trigger for focus restoration.
	 * @return {void}
	 */
	function preview_inline_changes( config, focus_target ) {
		var inspector_workflow;
		var request_sequence;

		synchronize_inline_drafts( config );
		inspector_workflow = get_inspector_workflow( config );
		if ( ! inline_state.changed_rows.length || inline_state.loading || ! inspector_workflow || ! inspector_workflow.mount() ) {
			return;
		}
		inline_state.loading = true;
		request_sequence = ++inline_state.request_sequence;
		inspector_focus_target = focus_target;
		inspector_mode = 'inline_review';
		inspector_dirty = true;
		if ( ! inspector_workflow.open_loading() ) {
			inline_state.loading = false;
			return;
		}
		synchronize_inline_controls( config );
		request_inspector( config, config.inline_preview_action, { rows: JSON.stringify( inline_state.changed_rows ) } ).then( function ( response ) {
			var review_workflow;
			var review_model;
			var target;
			if ( request_sequence !== inline_state.request_sequence ) {
				return;
			}
			if ( ! response || ! response.success || ! response.data || ! response.data.preview ) {
				throw new Error( get_inspector_response_message( response, config.i18n.inline_review_failed ) );
			}
			inline_state.review_token = String( response.data.preview.review_token || '' );
			target = get_inspector_host().querySelector( '[data-wpbc-ui-catalog-inspector-form]' );
			review_workflow = get_inline_review_workflow();
			review_model = review_workflow ? review_workflow.prepare( response.data.preview.review || {}, {
				changed_label: format_message( 1 === inline_state.changed_rows.length ? config.i18n.inline_changed_row : config.i18n.inline_changed_rows, [ inline_state.changed_rows.length ] ),
				description: config.i18n.inline_review_description || '',
				form_id: 'wpbc_catalog_booking_resources_inline_review_form',
				mode: 'inline_review',
				pending_message: config.i18n.review_changes_help || '',
				title: config.i18n.inline_review_title || ''
			} ) : {};
			target.innerHTML = render_component( config, 'inspector_inline_review', review_model );
			set_inspector_state( 'form', '' );
			configure_inspector_footer( 'wpbc_catalog_booking_resources_inline_review_form', config.i18n.apply_changes || '', false, ! inline_state.review_token );
			if ( review_workflow ) {
				review_workflow.synchronize( { busy: false, can_apply: !! inline_state.review_token } );
			}
			focus_inspector_heading( target.querySelector( '[data-wpbc-catalog-inline-review-form]' ) );
		} ).catch( function ( error ) {
			if ( request_sequence !== inline_state.request_sequence ) {
				return;
			}
			inline_state.review_token = '';
			inspector_dirty = false;
			show_admin_message( error.message || config.i18n.inline_review_failed || '', 'error', 5000 );
			close_inspector( config, false );
		} ).then( function () {
			if ( request_sequence === inline_state.request_sequence ) {
				inline_state.loading = false;
				synchronize_inline_controls( config );
			}
		} );
	}

	/**
	 * Apply the reviewed inline plan and retain the catalog selection.
	 *
	 * @param {SubmitEvent} event Review form submit event.
	 * @param {Object} config Catalog configuration.
	 * @return {void}
	 */
	function apply_inline_changes( event, config ) {
		var form = event.target;
		var save_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );
		var request_sequence;

		event.preventDefault();
		if ( inline_state.loading || ! inline_state.review_token || ( save_button && save_button.disabled ) ) {
			return;
		}
		inline_state.loading = true;
		inspector_mutation_in_progress = true;
		if ( get_inline_review_workflow() ) {
			get_inline_review_workflow().synchronize( { busy: true, can_apply: true } );
		}
		request_sequence = ++inspector_mutation_request_sequence;
		if ( save_button ) {
			save_button.disabled = true;
			save_button.classList.add( 'is-busy' );
		}
		request_inspector( config, config.inline_apply_action, { rows: JSON.stringify( inline_state.changed_rows ), review_token: inline_state.review_token } ).then( function ( response ) {
			if ( request_sequence !== inspector_mutation_request_sequence || ! response || ! response.success || ! response.data ) {
				throw new Error( get_inspector_response_message( response, config.i18n.inline_apply_failed ) );
			}
			pending_highlight_ids = ( response.data.updated_ids || [] ).map( String );
			inspector_mutation_in_progress = false;
			leave_inline_mode( config, true, get_inspector_response_message( response, '' ) );
		} ).catch( function ( error ) {
			inspector_mutation_in_progress = false;
			inline_state.review_token = '';
			if ( get_inline_review_workflow() ) {
				get_inline_review_workflow().synchronize( { busy: false, can_apply: false } );
			}
			if ( document.documentElement.contains( form ) ) {
				show_inspector_message( form, error.message || config.i18n.inline_apply_failed || '', true );
			} else {
				show_admin_message( error.message || config.i18n.inline_apply_failed || '', 'error', 5000 );
			}
			if ( save_button ) {
				save_button.disabled = true;
				save_button.classList.remove( 'is-busy' );
			}
		} ).then( function () {
			inline_state.loading = false;
			synchronize_inline_controls( config );
		} );
	}

	/**
	 * Render the header, complete Resource rows, partials, and pagination.
	 *
	 * @param {Object} config   Registered catalog configuration.
	 * @param {Object} response Normalized catalog response.
	 * @return {boolean} True when every required presentation target exists.
	 */
	function render_booking_resources_response( config, response ) {
		var catalog_heading;
		var catalog_mount = document.getElementById( config.mount_id );
		var card_groups = {};
		var children_by_parent = {};
		var columns;
		var header_element;
		var hierarchy_enabled;
		var hierarchy_is_expanded;
		var is_cards_pack;
		var parent_resources = {};
		var pagination;
		var pagination_element;
		var rows_element;

		if ( ! catalog_mount || ! response || ! Array.isArray( response.items ) ) {
			return false;
		}

		header_element = catalog_mount.querySelector( '[data-wpbc-booking-resources-header]' );
		rows_element = catalog_mount.querySelector( '[data-wpbc-booking-resources-rows]' );
		pagination_element = catalog_mount.querySelector( '[data-wpbc-booking-resources-pagination]' );
		if ( ! header_element || ! rows_element || ! pagination_element ) {
			return false;
		}

		columns = get_columns( config, response.display || {}, true, response.sorting || {} );
		is_cards_pack = 'cards' === String( response.display && response.display.template_pack || '' );
		hierarchy_enabled = !! ( response.hierarchy && response.hierarchy.enabled );
		hierarchy_is_expanded = hierarchy_enabled
			&& window.wpbc_ui_catalog_hierarchy
			&& 'function' === typeof window.wpbc_ui_catalog_hierarchy.get_initial_expanded
			&& window.wpbc_ui_catalog_hierarchy.get_initial_expanded( response.hierarchy || {} );
		header_element.innerHTML = render_component( config, 'header', {
			all_expanded: hierarchy_is_expanded,
			columns: columns,
			hierarchy_enabled: hierarchy_enabled,
			i18n: config.i18n || {},
			selection_enabled: !! ( config.features && config.features.selection )
		} );
		rows_element.innerHTML = '';
		if ( hierarchy_enabled ) {
			response.items.forEach( function ( resource ) {
				if ( resource.hierarchy && 'parent' === resource.hierarchy.type ) {
					parent_resources[ String( resource.id ) ] = resource;
				} else if ( resource.hierarchy && 'child' === resource.hierarchy.type ) {
					var parent_id = String( resource.hierarchy.parent_id || '' );
					children_by_parent[ parent_id ] = children_by_parent[ parent_id ] || [];
					children_by_parent[ parent_id ].push( resource );
				}
			} );
		}
		response.items.forEach( function ( resource ) {
			var action_target;
			var classic_label_classes = {
				child: 'wpbc_label_resource_child',
				cost: 'wpbc_label_cost',
				'default-form': 'wpbc_label_resource_default_form',
				owner: 'wpbc_label_user_owner',
				parent: 'wpbc_label_resource_parent',
				single: 'wpbc_label_resource_single'
			};
			var label_target;
			var price_target;
			var description = resource.description || config.i18n.no_description || '';
			var hierarchy = Object.assign( {}, resource.hierarchy || {} );
			var parent_context_label = '';
			var row_variant = hierarchy_enabled && ( 'parent' === hierarchy.type || 'child' === hierarchy.type ) ? hierarchy.type : 'single';
			var row_template_role = 'parent' === row_variant ? 'parent_row' : ( 'child' === row_variant ? 'child_row' : 'row' );
			var type_badge_label = config.i18n.independent_label || '';
			hierarchy.expandable = !! ( hierarchy_enabled && hierarchy.expandable );
			if ( hierarchy.parent_title ) {
				parent_context_label = format_message( config.i18n.child_of || '', [ hierarchy.parent_title ] );
			}
			if ( 'parent' === row_variant ) {
				var rendered_child_count = Math.max( 0, Number( hierarchy.rendered_children_count ) || 0 );
				var parent_children_template = 1 === rendered_child_count
					? config.i18n.parent_child_label || '%1$s · %2$s child'
					: config.i18n.parent_children_label || '%1$s · %2$s children';
				type_badge_label = format_message( parent_children_template, [
					config.i18n.parent_label || '',
					rendered_child_count
				] );
			} else if ( 'child' === row_variant ) {
				type_badge_label = config.i18n.child_label || '';
			}
			var resource_row_data = Object.assign( {}, resource, {
				parent_context_label: parent_context_label,
				collapse_label: format_message( config.i18n.collapse_children_for || config.i18n.collapse_children || '', [ resource.title || '' ] ),
				columns: columns,
				expand_label: format_message( config.i18n.expand_children_for || config.i18n.expand_children || '', [ resource.title || '' ] ),
				hierarchy: hierarchy,
				i18n: config.i18n || {},
				is_expanded: hierarchy_is_expanded,
				parent_label: config.i18n.parent_label || '',
				row_variant: row_variant,
				selection_label: format_message( config.i18n.select_resource || '', [ resource.title || '' ] ),
				selection_enabled: !! ( config.features && config.features.selection ),
				thumbnail_label: format_message( config.i18n.thumbnail_tooltip || '', [ resource.title || '', description ] ),
				type_badge_label: type_badge_label
			} );
			var resource_row_html = render_component( config, row_template_role, resource_row_data );
			var resource_row;

			if ( ! resource_row_html ) {
				return;
			}

			if ( is_cards_pack && 'parent' === row_variant ) {
				var child_resources = children_by_parent[ String( resource.id ) ] || [];
				var child_count = Math.max( child_resources.length, Number( hierarchy.rendered_children_count ) || 0 );
				var card_group_html = render_component( config, 'card_group', {
					children_description: format_message( config.i18n.children_belong_to || '', [ resource.title || '' ] ),
					children_heading: format_message( config.i18n.children_of_count || '', [ resource.title || '', child_count ] ),
					collapse_label: resource_row_data.collapse_label,
					expand_label: resource_row_data.expand_label,
					is_expanded: hierarchy_is_expanded,
					parent_id: resource.id,
					parent_node_id: hierarchy.node_id,
					stack_items: child_resources.slice( 0, 3 )
				} );
				if ( ! card_group_html ) {
					return;
				}
				rows_element.insertAdjacentHTML( 'beforeend', card_group_html );
				card_groups[ String( resource.id ) ] = rows_element.lastElementChild;
				var parent_slot = card_groups[ String( resource.id ) ].querySelector( '[data-wpbc-booking-resource-card-parent-slot]' );
				parent_slot.insertAdjacentHTML( 'beforeend', resource_row_html );
				resource_row = parent_slot.lastElementChild;
			} else if ( is_cards_pack && 'child' === row_variant && card_groups[ String( hierarchy.parent_id ) ] ) {
				var children_slot = card_groups[ String( hierarchy.parent_id ) ].querySelector( '[data-wpbc-booking-resource-card-children-slot]' );
				children_slot.insertAdjacentHTML( 'beforeend', resource_row_html );
				resource_row = children_slot.lastElementChild;
			} else {
				rows_element.insertAdjacentHTML( 'beforeend', resource_row_html );
				resource_row = rows_element.lastElementChild;
			}
			if ( ! resource_row ) {
				return;
			}

			label_target = resource_row.querySelector( '[data-wpbc-booking-resource-labels]' );
			price_target = resource_row.querySelector( '[data-wpbc-booking-resource-price]' );
			action_target = resource_row.querySelector( '[data-wpbc-booking-resource-actions]' );
			if ( label_target ) {
				label_target.innerHTML = render_component( config, 'labels', {
					aria_label: config.i18n.column_labels || '',
					empty_label: config.i18n.no_labels || '',
					labels: Array.isArray( resource.labels ) ? resource.labels.map( function ( label ) {
						return Object.assign( {}, label, { class_name: classic_label_classes[ label.kind ] || '' } );
					} ) : []
				} );
			}
			if ( price_target ) {
				price_target.innerHTML = render_component( config, 'price', {
					empty_label: config.i18n.price_unavailable || '',
					price: resource.price || {}
				} );
			}
			if ( action_target ) {
				action_target.innerHTML = render_component( config, 'action_menu', {
					actions: Array.isArray( resource.action_items ) ? resource.action_items.map( function ( action ) {
						var action_classes = { adjust_capacity: 'capacity', delete_resource: 'delete', edit_resource: 'edit', publish_resource: 'publish' };
						var action_id = String( action.id || '' );
						return Object.assign( {}, action, { class_name: 'wpbc_booking_resources__action_' + ( action_classes[ action_id ] || action_id ) } );
					} ) : [],
					aria_label: format_message( config.i18n.actions_for || '', [ resource.title || '' ] ),
					empty_label: config.i18n.no_actions || '',
					menu_id: 'wpbc_' + config.id + '_actions_' + String( resource.id ),
					resource_id: resource.id
				} );
			}
			if ( hierarchy_enabled && 'child' === row_variant && hierarchy.is_last_sibling ) {
				var parent_resource = parent_resources[ String( hierarchy.parent_id ) ];
				if ( parent_resource ) {
					var summary_target = is_cards_pack && card_groups[ String( hierarchy.parent_id ) ]
						? card_groups[ String( hierarchy.parent_id ) ].querySelector( '[data-wpbc-booking-resource-card-parent-slot]' )
						: rows_element;
					summary_target.insertAdjacentHTML( 'beforeend', render_component( config, 'child_summary', {
						children_label: get_children_summary_label( parent_resource, config.i18n || {} ),
						collapse_label: format_message( config.i18n.collapse_children_for || config.i18n.collapse_children || '', [ parent_resource.title || '' ] ),
						columns: columns,
						expand_label: format_message( config.i18n.expand_children_for || config.i18n.expand_children || '', [ parent_resource.title || '' ] ),
						is_expanded: hierarchy_is_expanded,
						parent_id: hierarchy.parent_id,
						parent_node_id: parent_resource.hierarchy.node_id,
						selection_enabled: !! ( config.features && config.features.selection )
					} ) );
				}
			}
		} );
		synchronize_overflow_tooltips( catalog_mount );

		pagination = response.pagination || {};
		pagination_element.innerHTML = render_component( config, 'pagination', {
			aria_label: config.i18n.pagination_label || '',
			has_next: Number( pagination.page_number ) < Number( pagination.total_pages ),
			has_previous: 1 < Number( pagination.page_number ),
			items_per_page: Number( pagination.items_per_page ),
			items_per_page_options: config.items_per_page && Array.isArray( config.items_per_page.options ) ? config.items_per_page.options : [],
			next_label: config.i18n.next_page || '',
			next_page: Math.min( Number( pagination.total_pages ), Number( pagination.page_number ) + 1 ),
			page_number: Number( pagination.page_number ),
			page_number_label: config.i18n.page_number || '',
			per_page_label: config.i18n.per_page || '',
			previous_label: config.i18n.previous_page || '',
			previous_page: Math.max( 1, Number( pagination.page_number ) - 1 ),
			results_status: format_message( config.i18n.results_status || '', [ pagination.items_from, pagination.items_to, pagination.total_items ] ),
			show_label: config.i18n.show || '',
			total_pages: Math.max( 1, Number( pagination.total_pages ) )
		} );
		synchronize_booking_resources_toolbar( config, response );

		if ( pending_focus_direction ) {
			catalog_heading = catalog_mount.querySelector( '[data-wpbc-catalog-heading]' );
			pending_focus_direction = '';
			if ( catalog_heading && 'function' === typeof catalog_heading.focus ) {
				catalog_heading.focus();
			}
		}

		return rows_element.querySelectorAll( '[data-wpbc-ui-catalog-selectable-row][data-wpbc-booking-resource-id]' ).length === response.items.length;
	}

	/**
	 * Return the number of currently visible cells in one Resource row.
	 *
	 * @param {HTMLElement} resource_row Rendered Resource table row.
	 * @return {number} Safe details-row colspan.
	 */
	function get_details_colspan( resource_row ) {
		var visible_cells = 0;

		if ( resource_row && 'TR' === resource_row.tagName ) {
			Array.prototype.forEach.call( resource_row.cells || [], function ( cell ) {
				if ( ! cell.hidden && 'none' !== window.getComputedStyle( cell ).display ) {
					visible_cells += 1;
				}
			} );
		}

		return Math.max( 1, visible_cells );
	}

	/**
	 * Resolve the rendered Resource container that owns an interactive control.
	 *
	 * Resource controls repeat the Resource ID for event dispatch. Limiting this
	 * lookup to selectable row/card containers prevents lazy templates from being
	 * inserted beside the control itself.
	 *
	 * @param {Element|null} source_element Element inside a Resource row or card.
	 * @return {HTMLElement|null} Owning Resource row/card, or null when unavailable.
	 */
	function get_resource_item_container( source_element ) {
		if ( ! source_element || 'function' !== typeof source_element.closest ) {
			return null;
		}

		return source_element.closest( '[data-wpbc-ui-catalog-selectable-row][data-wpbc-booking-resource-id]' );
	}

	/**
	 * Synchronize Cards-pack parent stages with shared hierarchy visibility.
	 *
	 * Child cards remain normal shared hierarchy nodes. This adapter only mirrors
	 * their computed visibility onto the presentation-only tray wrapper.
	 *
	 * @param {HTMLElement} catalog_mount Mounted Booking Resources catalog.
	 * @return {void}
	 */
	function synchronize_card_group_panels( catalog_mount ) {
		var catalog_root;

		if ( ! catalog_mount ) {
			return;
		}

		catalog_root = catalog_mount.hasAttribute( 'data-wpbc-catalog-id' )
			? catalog_mount
			: catalog_mount.querySelector( '[data-wpbc-catalog-id]' );

		// The shared controller owns the active-pack attribute on the inner catalog root.
		if ( ! catalog_root || 'cards' !== catalog_root.getAttribute( 'data-wpbc-template-pack' ) ) {
			return;
		}

		catalog_root.querySelectorAll( '[data-wpbc-booking-resource-card-group]' ).forEach( function ( card_group ) {
			var children_panel = card_group.querySelector( '[data-wpbc-booking-resource-card-children-panel]' );
			var visible_child = card_group.querySelector( '[data-wpbc-booking-resource-card-children-slot] [data-wpbc-ui-catalog-parent-node-id]:not([hidden])' );

			if ( children_panel ) {
				children_panel.hidden = ! visible_child;
				card_group.classList.toggle( 'is-expanded', !! visible_child );
			}
		} );
	}

	/**
	 * Synchronize one details disclosure button.
	 *
	 * @param {HTMLElement|null} toggle_button Disclosure button.
	 * @param {boolean}          is_expanded   Whether its details row is open.
	 * @return {void}
	 */
	function set_details_toggle_state( toggle_button, is_expanded ) {
		var icon;
		var label;

		if ( ! toggle_button ) {
			return;
		}

		label = toggle_button.getAttribute( is_expanded ? 'data-hide-label' : 'data-show-label' ) || '';
		toggle_button.setAttribute( 'aria-expanded', is_expanded ? 'true' : 'false' );
		toggle_button.setAttribute( 'aria-label', label );
		toggle_button.setAttribute( 'title', label );
		icon = toggle_button.querySelector( 'span[aria-hidden="true"]' );
		if ( icon ) {
			icon.className = is_expanded ? 'wpbc-bi-chevron-up' : 'wpbc-bi-chevron-down';
		}
	}

	/**
	 * Close the active details row and cancel its lazy request.
	 *
	 * @param {boolean} restore_focus Whether to return focus to the disclosure.
	 * @return {void}
	 */
	function close_details_row( restore_focus ) {
		var active_row = document.querySelector( '[data-wpbc-booking-resource-details-row]' );
		var focus_target = details_toggle_button;

		details_request_sequence += 1;
		if ( details_abort_controller && 'function' === typeof details_abort_controller.abort ) {
			details_abort_controller.abort();
		}
		details_abort_controller = null;
		if ( active_row && active_row.parentNode ) {
			active_row.parentNode.removeChild( active_row );
		}
		set_details_toggle_state( details_toggle_button, false );
		if ( details_toggle_button ) {
			var source_row = get_resource_item_container( details_toggle_button );
			if ( source_row ) {
				source_row.classList.remove( 'is-details-expanded' );
			}
		}
		details_resource_id = 0;
		details_toggle_button = null;

		if ( restore_focus && focus_target && document.documentElement.contains( focus_target ) && 'function' === typeof focus_target.focus ) {
			focus_target.focus();
		}
	}

	/**
	 * Replace the active details row through the registered WP template.
	 *
	 * @param {Object}      config       Catalog configuration.
	 * @param {HTMLElement} resource_row Source Resource row.
	 * @param {Object}      template_data Presentation-only template state.
	 * @return {HTMLElement|null} Rendered details row.
	 */
	function render_details_row( config, resource_row, template_data ) {
		var active_row = document.querySelector( '[data-wpbc-booking-resource-details-row]' );
		var card_group = resource_row ? resource_row.closest( '[data-wpbc-booking-resource-card-group]' ) : null;
		var details_html = render_component( config, 'details', template_data );
		var insertion_target = card_group || resource_row;

		if ( ! details_html || ! insertion_target || ! insertion_target.parentNode ) {
			return null;
		}
		if ( active_row && active_row.parentNode ) {
			active_row.parentNode.removeChild( active_row );
		}
		insertion_target.insertAdjacentHTML( 'afterend', details_html );

		return insertion_target.nextElementSibling;
	}

	/**
	 * Return a safe message from a normalized details error response.
	 *
	 * @param {Object} response Normalized endpoint response.
	 * @param {string} fallback Localized fallback message.
	 * @return {string} Safe plain-text message.
	 */
	function get_details_error_message( response, fallback ) {
		return response && response.error && response.error.message
			? String( response.error.message )
			: String( fallback || '' );
	}

	/**
	 * Open one details row and lazily request its authorized DTO.
	 *
	 * @param {Object}      config        Catalog configuration.
	 * @param {HTMLElement} toggle_button Details disclosure button.
	 * @param {HTMLElement} resource_row  Source Resource row.
	 * @param {number}      resource_id   Booking Resource ID.
	 * @return {void}
	 */
	function open_details_row( config, toggle_button, resource_row, resource_id ) {
		var details_request_id;
		var request_body;
		var resource_title_element = resource_row.querySelector( '.wpbc_ui_listing__item_title' );
		var resource_title = resource_title_element ? resource_title_element.textContent.trim() : '';
		var template_base;

		close_details_row( false );
		details_resource_id = resource_id;
		details_toggle_button = toggle_button;
		details_request_id = ++details_request_sequence;
		set_details_toggle_state( toggle_button, true );
		resource_row.classList.add( 'is-details-expanded' );
		template_base = {
			colspan: get_details_colspan( resource_row ),
			resource_id: resource_id,
			title: resource_title
		};
		render_details_row( config, resource_row, Object.assign( {}, template_base, {
			loading_label: config.i18n.details_loading || config.i18n.loading || '',
			state: 'loading'
		} ) );

		request_body = new window.URLSearchParams();
		request_body.append( 'action', config.details_action );
		request_body.append( 'nonce', config.nonce || '' );
		request_body.append( 'request_id', String( details_request_id ) );
		request_body.append( 'resource_id', String( resource_id ) );
		details_abort_controller = 'function' === typeof window.AbortController ? new window.AbortController() : null;

		window.fetch( config.ajax_url, {
			body: request_body.toString(),
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			method: 'POST',
			signal: details_abort_controller ? details_abort_controller.signal : undefined
		} ).then( function ( response ) {
			return response.json();
		} ).then( function ( response ) {
			if ( details_request_id !== details_request_sequence || resource_id !== details_resource_id ) {
				return;
			}
			if ( ! response || true !== response.success || Number( response.request_id ) !== details_request_id || Number( response.resource_id ) !== resource_id || ! response.details || ! Array.isArray( response.details.sections ) ) {
				render_details_row( config, resource_row, Object.assign( {}, template_base, {
					error_message: get_details_error_message( response, config.i18n.details_load_failed ),
					state: 'error'
				} ) );
				return;
			}
			render_details_row( config, resource_row, Object.assign( {}, template_base, response.details, {
				colspan: get_details_colspan( resource_row ),
				state: 'ready'
			} ) );
			var catalog_mount = document.getElementById( config.mount_id );
			synchronize_overflow_tooltips( catalog_mount );
			initialize_details_tooltips( catalog_mount );
		} ).catch( function ( error ) {
			if ( error && 'AbortError' === error.name ) {
				return;
			}
			if ( details_request_id === details_request_sequence && resource_id === details_resource_id ) {
				render_details_row( config, resource_row, Object.assign( {}, template_base, {
					error_message: config.i18n.details_load_failed || '',
					state: 'error'
				} ) );
			}
		} ).then( function () {
			if ( details_request_id === details_request_sequence ) {
				details_abort_controller = null;
			}
		} );
	}

	/**
	 * Copy one details value without navigating or mutating Resource state.
	 *
	 * @param {string}      copy_value    Plain text to copy.
	 * @param {HTMLElement} action_button Copy button used to locate status text.
	 * @param {Object}      config        Catalog configuration.
	 * @return {void}
	 */
	function copy_details_value( copy_value, action_button, config ) {
		var details_row = action_button.closest( '[data-wpbc-booking-resource-details-row]' );
		var resource_id = Number( action_button.getAttribute( 'data-wpbc-booking-resource-id' ) || 0 );
		var status_element = details_row
			? details_row.querySelector( '[data-wpbc-booking-resource-copy-status]' )
			: document.querySelector( '[data-wpbc-booking-resource-copy-status="' + String( resource_id ) + '"]' );
		var copy_promise;

		if ( window.navigator.clipboard && 'function' === typeof window.navigator.clipboard.writeText ) {
			copy_promise = window.navigator.clipboard.writeText( copy_value );
		} else {
			copy_promise = new window.Promise( function ( resolve, reject ) {
				var copy_input = document.createElement( 'textarea' );
				copy_input.value = copy_value;
				copy_input.setAttribute( 'readonly', 'readonly' );
				copy_input.style.position = 'fixed';
				copy_input.style.opacity = '0';
				document.body.appendChild( copy_input );
				copy_input.select();
				if ( document.execCommand( 'copy' ) ) {
					resolve();
				} else {
					reject();
				}
				document.body.removeChild( copy_input );
			} );
		}
		copy_promise.then( function () {
			if ( status_element ) {
				status_element.classList.remove( 'has-error' );
				status_element.textContent = config.i18n.shortcode_copied || '';
			}
		} ).catch( function () {
			if ( status_element ) {
				status_element.classList.add( 'has-error' );
				status_element.textContent = config.i18n.shortcode_copy_failed || '';
			}
		} );
	}

	/**
	 * Return the current effective shortcode for one Resource.
	 *
	 * The active inspector wins so unsaved customizer changes are used by Copy
	 * and Publish. A hidden compatibility input is the fallback required by the
	 * shared Booking Calendar publish wizard.
	 *
	 * @param {number}      resource_id  Booking Resource ID.
	 * @param {HTMLElement} action_button Optional initiating action.
	 * @return {string} Current effective shortcode.
	 */
	function get_booking_resource_shortcode( resource_id, action_button ) {
		var inspector_shortcode = resource_id === inspector_resource_id
			? document.querySelector( '[data-wpbc-catalog-resource-inspector-form] .wpbc_catalog_booking_resources__editor_code' )
			: null;
		var hidden_shortcode = document.getElementById( 'booking_resource_shortcode_' + String( resource_id ) );

		if ( inspector_shortcode ) {
			return String( inspector_shortcode.value || '' );
		}
		if ( action_button && action_button.getAttribute( 'data-wpbc-booking-resource-shortcode' ) ) {
			return String( action_button.getAttribute( 'data-wpbc-booking-resource-shortcode' ) || '' );
		}

		return hidden_shortcode ? String( hidden_shortcode.value || '' ) : '';
	}

	/**
	 * Create or update the hidden input consumed by the shared publish wizard.
	 *
	 * @param {number} resource_id Booking Resource ID.
	 * @param {string} shortcode   Effective Booking shortcode.
	 * @return {HTMLInputElement|null} Compatibility input or null.
	 */
	function synchronize_booking_resource_shortcode_input( resource_id, shortcode ) {
		var input;

		if ( ! resource_id ) {
			return null;
		}
		input = document.getElementById( 'booking_resource_shortcode_' + String( resource_id ) );
		if ( ! input ) {
			input = document.createElement( 'input' );
			input.type = 'hidden';
			input.id = 'booking_resource_shortcode_' + String( resource_id );
			input.setAttribute( 'data-wpbc-catalog-shortcode-compatibility', String( resource_id ) );
			document.body.appendChild( input );
		}
		input.value = String( shortcode || '' );

		return input;
	}

	/**
	 * Open the shared Booking Calendar shortcode customizer for one Resource.
	 *
	 * @param {number} resource_id Booking Resource ID.
	 * @param {string} shortcode   Current shortcode.
	 * @return {void}
	 */
	function customize_booking_resource_shortcode( resource_id, shortcode ) {
		synchronize_booking_resource_shortcode_input( resource_id, shortcode );
		if ( 'function' === typeof window.wpbc_resource_page_btn_click ) {
			window.wpbc_resource_page_btn_click( resource_id, shortcode );
		}
	}

	/**
	 * Open the shared Booking Calendar embed/create-page wizard.
	 *
	 * @param {number} resource_id Booking Resource ID.
	 * @param {string} shortcode   Current shortcode.
	 * @return {void}
	 */
	function publish_booking_resource_shortcode( resource_id, shortcode, trigger_button ) {
		synchronize_booking_resource_shortcode_input( resource_id, shortcode );
		if ( 'function' === typeof window.wpbc_publish_booking_form__open ) {
			window.wpbc_publish_booking_form__open( resource_id, shortcode, trigger_button );
		}
	}

	/**
	 * Open the informational Free-edition Booking Resource upgrade dialog.
	 *
	 * @param {HTMLElement} trigger_button Button that opened the dialog.
	 * @return {void}
	 */
	function open_booking_resource_upgrade_dialog( trigger_button ) {
		var modal_element = document.getElementById( 'wpbc_catalog_booking_resources__upgrade_modal' );
		var upgrade_url = trigger_button ? trigger_button.getAttribute( 'data-wpbc-catalog-booking-resource-upgrade-url' ) : '';

		if ( modal_element && window.jQuery && 'function' === typeof window.jQuery( modal_element ).wpbc_my_modal ) {
			window.jQuery( modal_element )
				.off( 'hidden.wpbc.modal.wpbcCatalogResourceUpgrade hidden.bs.modal.wpbcCatalogResourceUpgrade' )
				.one( 'hidden.wpbc.modal.wpbcCatalogResourceUpgrade hidden.bs.modal.wpbcCatalogResourceUpgrade', function () {
					if ( trigger_button && document.contains( trigger_button ) ) {
						trigger_button.focus();
					}
				} )
				.wpbc_my_modal( 'show' );
			return;
		}

		if ( upgrade_url ) {
			window.open( upgrade_url, '_blank', 'noopener' );
		}
	}

	/**
	 * Open the reusable native catalog message dialog.
	 *
	 * Message content is assigned with textContent so translated or server-provided
	 * text cannot become dialog markup. The browser alert remains a resilience
	 * fallback when the Booking Calendar modal runtime is unavailable.
	 *
	 * @param {string}      message        Message shown in the dialog body.
	 * @param {string}      title          Optional dialog heading.
	 * @param {HTMLElement} trigger_button Control that opened the dialog.
	 * @return {boolean} True when the native dialog opened; otherwise false.
	 */
	function open_booking_resource_message_dialog( message, title, trigger_button ) {
		var modal_element = document.getElementById( 'wpbc_catalog_booking_resources__message_modal' );
		var title_element = document.getElementById( 'wpbc_catalog_booking_resources__message_modal_title' );
		var description_element = document.getElementById( 'wpbc_catalog_booking_resources__message_modal_description' );

		if ( message && modal_element && description_element && window.jQuery && 'function' === typeof window.jQuery( modal_element ).wpbc_my_modal ) {
			description_element.textContent = message;
			if ( title_element ) {
				title_element.textContent = title || title_element.getAttribute( 'data-wpbc-default-title' ) || '';
			}
			window.jQuery( modal_element )
				.off( 'hidden.wpbc.modal.wpbcCatalogResourceMessage hidden.bs.modal.wpbcCatalogResourceMessage' )
				.one( 'hidden.wpbc.modal.wpbcCatalogResourceMessage hidden.bs.modal.wpbcCatalogResourceMessage', function () {
					if ( trigger_button && document.contains( trigger_button ) ) {
						trigger_button.focus();
					}
				} )
				.wpbc_my_modal( 'show' );
			return true;
		}

		if ( message && 'function' === typeof window.alert ) {
			window.alert( message );
		}
		return false;
	}

	/**
	 * Return the template-driven inspector host.
	 *
	 * @return {HTMLElement|null} Inspector host or null.
	 */
	function get_inspector_host() {
		return document.querySelector( '[data-wpbc-catalog-booking-resources-inspector-host]' );
	}

	/**
	 * Return the sticky native-sidebar footer.
	 *
	 * @return {HTMLElement|null} Footer element or null.
	 */
	function get_inspector_footer() {
		return document.querySelector( '[data-wpbc-ui-catalog-inspector-footer]' );
	}

	/**
	 * Return the shared native inspector state workflow.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {Object|false} Shared inspector workflow or false.
	 */
	function get_inspector_workflow( config ) {
		if ( inspector_workflow_controller ) {
			return inspector_workflow_controller;
		}
		if ( ! window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.create_inspector_workflow ) {
			return false;
		}

		inspector_workflow_controller = window.wpbc_ui_catalog.create_inspector_workflow( {
			expand: expand_inspector_sidebar,
			get_footer: get_inspector_footer,
			get_host: get_inspector_host,
			render_shell: function ( shell_data ) { return render_component( config, 'inspector', shell_data ); },
			shell_data: {
				catalog_id: config.id,
				empty_icon: 'wpbc-bi-pencil-square',
				empty_message: config.i18n.inspector_empty_message || '',
				empty_title: config.i18n.inspector_empty_title || '',
				loading_label: config.i18n.inspector_loading || config.i18n.loading || ''
			}
		} );

		return inspector_workflow_controller;
	}

	/**
	 * Render the shared inspector fallback-state shell once.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {boolean} True when the shell is available.
	 */
	function mount_inspector_shell( config ) {
		var inspector_workflow = get_inspector_workflow( config );

		return !! inspector_workflow && inspector_workflow.mount();
	}

	/**
	 * Expand the native right sidebar after an explicit editor action.
	 *
	 * @return {void}
	 */
	function expand_inspector_sidebar() {
		synchronize_inspector_width();
		if ( 'function' === typeof window.wpbc_admin_ui__sidebar_right__do_max ) {
			window.wpbc_admin_ui__sidebar_right__do_max();
		}
		document.dispatchEvent( new CustomEvent( 'wpbc_setup_wizard_layout_changed' ) );
	}

	/**
	 * Apply the established wider sidebar only while creating Resources.
	 *
	 * The new catalog owns its class and styling so it does not depend on the old
	 * listing assets while retaining the same native-sidebar width contract.
	 *
	 * @return {void}
	 */
	function synchronize_inspector_width() {
		var host = get_inspector_host();
		var sidebar = host ? host.closest( '.wpbc_ui_el__vert_right_bar__wrapper' ) : null;

		if ( sidebar ) {
			sidebar.classList.toggle( 'wpbc_catalog_booking_resources__inspector_width--wide', 'create' === inspector_mode );
		}
	}

	/**
	 * Mark only the Resource currently owned by the inspector.
	 *
	 * @param {number} resource_id Resource ID or zero to clear highlighting.
	 * @return {void}
	 */
	function mark_inspector_resource_row( resource_id ) {
		document.querySelectorAll( '[data-wpbc-booking-resource-id].is-editor-active' ).forEach( function ( row ) {
			row.classList.remove( 'is-editor-active' );
		} );
		if ( resource_id ) {
			var row = document.querySelector( '[data-wpbc-booking-resource-id="' + String( resource_id ) + '"]' );
			if ( row ) {
				row.classList.add( 'is-editor-active' );
				row.scrollIntoView( { block: 'nearest', behavior: 'smooth' } );
			}
		}
	}

	/**
	 * Synchronize shared empty, loading, error, form, and footer states.
	 *
	 * @param {string} state Empty, loading, error, or form.
	 * @param {string} message Optional safe error message.
	 * @return {void}
	 */
	function set_inspector_state( state, message ) {
		if ( inspector_workflow_controller ) {
			inspector_workflow_controller.set_state( state, message );
		}
	}

	/**
	 * Serialize current editable field values for dirty-state comparison.
	 *
	 * @return {string} Stable JSON field snapshot.
	 */
	function serialize_inspector_fields() {
		var fields = {};
		document.querySelectorAll( '[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-radio-field]:checked' ).forEach( function ( field ) {
			fields[ field.getAttribute( 'data-wpbc-catalog-resource-radio-field' ) || '' ] = field.value;
		} );
		document.querySelectorAll( '[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-field]' ).forEach( function ( field ) {
			fields[ field.getAttribute( 'data-wpbc-catalog-resource-field' ) || '' ] = field.value;
		} );

		return JSON.stringify( fields );
	}

	/**
	 * Return the currently selected Resource creation mode.
	 *
	 * @return {string} Independent or children.
	 */
	function get_inspector_creation_mode() {
		var selected_mode = document.querySelector( '[data-wpbc-catalog-resource-radio-field="creation_mode"]:checked' );
		var hidden_mode = document.querySelector( '[data-wpbc-catalog-resource-field="creation_mode"]' );

		return String( selected_mode ? selected_mode.value : hidden_mode ? hidden_mode.value : 'independent' );
	}

	/**
	 * Synchronize create-only conditional fields and radio-card presentation.
	 *
	 * These controls improve clarity only. The create service independently
	 * authorizes the selected parent and derives all inherited values.
	 *
	 * @return {void}
	 */
	function synchronize_create_inspector_controls() {
		if ( 'create' !== inspector_mode ) {
			return;
		}

		var creation_mode = get_inspector_creation_mode();
		var parent_wrap = document.querySelector( '[data-wpbc-catalog-resource-field-wrap="parent_id"]' );

		document.querySelectorAll( '[data-wpbc-catalog-resource-radio-field="creation_mode"]' ).forEach( function ( radio ) {
			var choice = radio.closest( 'label' );
			if ( choice ) {
				choice.classList.toggle( 'is-selected', radio.checked );
			}
		} );
		if ( parent_wrap ) {
			parent_wrap.hidden = 'children' !== creation_mode;
			parent_wrap.classList.toggle( 'is-conditionally-hidden', 'children' !== creation_mode );
		}
		[ 'base_cost', 'default_form', 'owner_user_id' ].forEach( function ( field_key ) {
			var field_wrap = document.querySelector( '[data-wpbc-catalog-resource-field-wrap="' + field_key + '"]' );
			if ( field_wrap ) {
				field_wrap.hidden = 'children' === creation_mode;
				field_wrap.classList.toggle( 'is-conditionally-hidden', 'children' === creation_mode );
			}
		} );
	}

	/**
	 * Synchronize dirty state and the sticky primary action.
	 *
	 * @return {void}
	 */
	function synchronize_inspector_dirty_state() {
		var save_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );
		var form = document.querySelector( '[data-wpbc-catalog-resource-inspector-form]' );
		var save_is_busy = !! save_button && save_button.classList.contains( 'is-busy' );

		inspector_dirty = !! form && serialize_inspector_fields() !== inspector_original_fields;
		if ( save_button ) {
			var title_field = form ? form.querySelector( '[data-wpbc-catalog-resource-field="title"]' ) : null;
			var parent_field = form ? form.querySelector( '[data-wpbc-catalog-resource-field="parent_id"]' ) : null;
			var create_is_valid = 'create' !== inspector_mode
				|| ( form
					&& 'true' === form.getAttribute( 'data-can-create' )
					&& title_field
					&& '' !== String( title_field.value || '' ).trim()
					&& ( 'children' !== get_inspector_creation_mode() || ( parent_field && Number( parent_field.value ) > 0 ) ) );

			save_button.disabled = save_is_busy || ! form || ! inspector_dirty || ! create_is_valid;
		}
	}

	/**
	 * Confirm whether the active inspector may be replaced or closed.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {boolean} True when navigation may continue.
	 */
	function can_discard_inspector( config ) {
		if ( inspector_mutation_in_progress ) {
			return false;
		}

		return ! inspector_dirty || window.confirm( config.i18n.inspector_discard || '' );
	}

	/**
	 * Close the inspector without changing catalog checkbox selection.
	 *
	 * @param {Object}  config         Catalog configuration.
	 * @param {boolean} confirm_discard Whether dirty state needs confirmation.
	 * @return {boolean} True when closed.
	 */
	function close_inspector( config, confirm_discard ) {
		if ( confirm_discard && ! can_discard_inspector( config ) ) {
			return false;
		}

		inspector_request_sequence += 1;
		inspector_dirty = false;
		inspector_mode = '';
		inspector_original_fields = '';
		inspector_resource_id = 0;
		inspector_resource_ids = [];
		inspector_bulk_operations = {};
		inspector_review_token = '';
		inspector_selection_stale = false;
		inspector_tracks_selection = false;
		inspector_capacity_context = null;
		inspector_capacity_detach_ids = [];
		inspector_capacity_decrease_action = 'detach';
		inspector_capacity_target = 0;
		synchronize_inspector_width();
		set_inspector_state( 'empty', '' );
		mark_inspector_resource_row( 0 );
		if ( 'function' === typeof window.wpbc_admin_ui__sidebar_right__do_hide ) {
			window.wpbc_admin_ui__sidebar_right__do_hide();
		}
		document.dispatchEvent( new CustomEvent( 'wpbc_setup_wizard_layout_changed' ) );
		if ( inspector_focus_target && document.documentElement.contains( inspector_focus_target ) && 'function' === typeof inspector_focus_target.focus ) {
			inspector_focus_target.focus();
		}
		inspector_focus_target = null;

		return true;
	}

	/**
	 * Post one authenticated inspector request.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {string} action AJAX action.
	 * @param {Object} values Request values.
	 * @return {Promise<Object>} Parsed WordPress response.
	 */
	function request_inspector( config, action, values ) {
		var body = new window.URLSearchParams();

		body.append( 'action', action );
		body.append( 'nonce', config.nonce || '' );
		Object.keys( values || {} ).forEach( function ( key ) {
			body.append( key, String( values[ key ] ) );
		} );

		return window.fetch( config.ajax_url, {
			body: body.toString(),
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
			method: 'POST'
		} ).then( function ( response ) {
			return response.json();
		} );
	}

	/**
	 * Return the explicit selection owned by the shared catalog controller.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {Array<number>} Selected positive Resource IDs.
	 */
	function get_selected_resource_ids( config ) {
		var mount = document.getElementById( config.mount_id );
		var selection = mount && mount._wpbc_ui_catalog_selection_controller;
		var selected_ids = selection && 'function' === typeof selection.get_selected_ids ? selection.get_selected_ids() : [];

		return selected_ids.map( Number ).filter( function ( resource_id ) {
			return resource_id > 0;
		} );
	}

	/**
	 * Compare two Resource-ID selections without relying on event ordering.
	 *
	 * @param {Array<number|string>} first_ids  First ID list.
	 * @param {Array<number|string>} second_ids Second ID list.
	 * @return {boolean} True when both lists contain the same Resource IDs.
	 */
	function resource_id_lists_match( first_ids, second_ids ) {
		var normalize_ids = function ( resource_ids ) {
			return ( resource_ids || [] ).map( Number ).filter( function ( resource_id ) {
				return resource_id > 0;
			} ).sort( function ( first_id, second_id ) {
				return first_id - second_id;
			} );
		};

		return JSON.stringify( normalize_ids( first_ids ) ) === JSON.stringify( normalize_ids( second_ids ) );
	}

	/**
	 * Return a localized selection-count label.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {number} count  Number of selected Resources.
	 * @return {string} Count and localized noun.
	 */
	function get_selection_count_label( config, count ) {
		return String( count ) + ' ' + ( 1 === Number( count ) ? config.i18n.resource_selected || '' : config.i18n.resources_selected || '' );
	}

	/**
	 * Configure the native sticky footer for the active inspector workflow.
	 *
	 * @param {string} form_id      Form receiving the submit action.
	 * @param {string} button_label Localized primary label.
	 * @param {boolean} destructive Whether the action permanently deletes data.
	 * @param {boolean} disabled    Whether submission starts disabled.
	 * @return {void}
	 */
	function configure_inspector_footer( form_id, button_label, destructive, disabled ) {
		var footer = get_inspector_footer();
		var save_button = footer ? footer.querySelector( '[data-wpbc-ui-catalog-inspector-save]' ) : null;
		var cancel_button = footer ? footer.querySelector( '[data-wpbc-ui-catalog-inspector-cancel]' ) : null;
		var delete_workflow;

		if ( save_button ) {
			save_button.classList.remove( 'is-busy', 'button-link-delete', 'wpbc_catalog_booking_resources__delete_submit', 'wpbc_ui_listing__inspector_action--destructive', 'wpbc_booking_resources__delete_confirm_button', 'wpbc_ui_catalog_delete_review__apply' );
			save_button.classList.toggle( 'button-primary', ! destructive );
			save_button.classList.toggle( 'button-secondary', !! destructive );
			save_button.classList.toggle( 'wpbc_ui_listing__inspector_action--destructive', !! destructive );
			save_button.classList.toggle( 'wpbc_booking_resources__delete_confirm_button', !! destructive );
			save_button.textContent = button_label || '';
			save_button.setAttribute( 'form', form_id );
			save_button.disabled = !! disabled;
		}
		if ( cancel_button ) {
			cancel_button.textContent = window.wpbc_catalog_booking_resources_config && window.wpbc_catalog_booking_resources_config.i18n
				? window.wpbc_catalog_booking_resources_config.i18n.cancel || cancel_button.textContent
				: cancel_button.textContent;
			cancel_button.disabled = false;
		}
		if ( destructive && 'wpbc_catalog_booking_resources_delete_form' === form_id ) {
			delete_workflow = get_delete_review_workflow();
			if ( delete_workflow ) {
				delete_workflow.configure_footer( {
					can_apply: true,
					footer: footer,
					form_id: form_id,
					label: button_label
				} );
			}
		}
	}

	/**
	 * Emphasize the permanent-deletion acknowledgement.
	 *
	 * Restarting the finite animation mirrors the established Booking Resource
	 * editor behavior when a deletion review opens or acknowledgement is cleared.
	 *
	 * @param {HTMLElement|null} acknowledgement Deletion acknowledgement label.
	 * @return {void}
	 */
	function pulse_delete_acknowledgement( acknowledgement ) {
		var delete_workflow = get_delete_review_workflow();

		if ( acknowledgement && acknowledgement.matches( '.wpbc_ui_catalog_delete_review__acknowledgement' ) && delete_workflow ) {
			delete_workflow.pulse_acknowledgement();
			return;
		}
		if ( ! acknowledgement ) {
			return;
		}

		acknowledgement.classList.remove( 'wpbc_booking_resources__delete_acknowledgement--attention' );
		void acknowledgement.offsetWidth;
		acknowledgement.classList.add( 'wpbc_booking_resources__delete_acknowledgement--attention' );
	}

	/**
	 * Return a safe message from a WordPress inspector response.
	 *
	 * @param {Object} response Response payload.
	 * @param {string} fallback Fallback message.
	 * @return {string} Plain message.
	 */
	function get_inspector_response_message( response, fallback ) {
		return response && response.data && response.data.message ? String( response.data.message ) : String( fallback || '' );
	}

	/**
	 * Show a success or error notice in the active inspector.
	 *
	 * @param {HTMLFormElement} form     Inspector form.
	 * @param {string}          message  Safe server or localized message.
	 * @param {boolean}         is_error Whether the notice represents an error.
	 * @return {void}
	 */
	function show_inspector_message( form, message, is_error ) {
		var notice = form ? form.querySelector( '[data-wpbc-catalog-resource-inspector-message]' ) : null;

		if ( ! notice ) {
			return;
		}
		notice.classList.toggle( 'notice-error', !! is_error );
		notice.classList.toggle( 'notice-success', ! is_error );
		notice.hidden = ! message;
		var notice_text = notice.querySelector( 'p' );
		if ( notice_text ) {
			notice_text.textContent = message || '';
		}
	}

	/**
	 * Move keyboard focus to the heading of a newly rendered reviewed inspector.
	 *
	 * @param {HTMLFormElement|null} form Rendered inspector form.
	 * @return {void}
	 */
	function focus_inspector_heading( form ) {
		var heading = form ? form.querySelector( '[data-wpbc-catalog-resource-inspector-heading]' ) : null;

		if ( ! heading ) {
			return;
		}
		window.setTimeout( function () {
			if ( document.documentElement.contains( heading ) && 'function' === typeof heading.focus ) {
				heading.focus();
			}
		}, 0 );
	}

	/**
	 * Show a standard Booking Calendar administration notice.
	 *
	 * Successful mutations use the shared top-right notice area used by the
	 * Booking Calendar settings pages. The boolean return lets callers retain
	 * an inline fallback when that shared helper is unavailable.
	 *
	 * @param {string} message      Safe server or localized message.
	 * @param {string} message_type Notice type accepted by the shared helper.
	 * @param {number} delay        Notice visibility duration in milliseconds.
	 * @return {boolean} True when the message was displayed.
	 */
	function show_admin_message( message, message_type, delay ) {
		var config;
		var mount_element;
		var notice;
		var notice_text;

		if ( ! message ) {
			return false;
		}
		if ( 'function' === typeof window.wpbc_admin_show_message ) {
			window.wpbc_admin_show_message( message, message_type || 'info', delay || 4000, false );
			return true;
		}

		config = window.wpbc_catalog_booking_resources_config || {};
		mount_element = config.mount_id ? document.getElementById( config.mount_id ) : null;
		mount_element = mount_element && mount_element.parentNode ? mount_element.parentNode : document.getElementById( 'wpbody-content' ) || document.body;
		if ( ! mount_element ) {
			return false;
		}

		notice = document.createElement( 'div' );
		notice.className = 'notice notice-' + ( 'error' === message_type ? 'error' : 'success' ) + ' wpbc_catalog_booking_resources__mutation_notice';
		notice.setAttribute( 'role', 'error' === message_type ? 'alert' : 'status' );
		notice.setAttribute( 'aria-live', 'error' === message_type ? 'assertive' : 'polite' );
		notice_text = document.createElement( 'p' );
		notice_text.textContent = message;
		notice.appendChild( notice_text );
		mount_element.insertBefore( notice, mount_element.firstChild );
		window.setTimeout( function () {
			if ( notice.parentNode ) {
				notice.parentNode.removeChild( notice );
			}
		}, delay || 4000 );

		return true;
	}

	/**
	 * Open and focus one server-defined edit-inspector section.
	 *
	 * The shared collapsible controller keeps exclusive group state and ARIA
	 * attributes synchronized. The header click is retained as a compatibility
	 * fallback for older administration bundles.
	 *
	 * @param {string} section_id Inspector section identifier.
	 * @return {boolean} True when the requested section exists.
	 */
	function activate_inspector_section( section_id ) {
		var form;
		var group;
		var root;
		var controller;
		var header;

		section_id = String( section_id || '' );
		if ( ! /^[a-z0-9_]+$/.test( section_id ) ) {
			return false;
		}

		form = document.querySelector( '[data-wpbc-catalog-resource-inspector-form][data-mode="edit"]' );
		group = form ? form.querySelector( '[data-group="catalog-booking-resource-' + section_id + '"]' ) : null;
		header = group ? group.querySelector( '.group__header' ) : null;
		if ( ! group || ! header ) {
			return false;
		}

		root = group.closest( '.wpbc_collapsible' );
		controller = root && root.__wpbc_collapsible_instance ? root.__wpbc_collapsible_instance : null;
		if ( controller && 'function' === typeof controller.expand ) {
			controller.expand( group );
		} else if ( ! group.classList.contains( 'is-open' ) ) {
			header.click();
		}

		window.setTimeout( function () {
			group.scrollIntoView( { behavior: 'smooth', block: 'start' } );
			header.focus();
		}, 120 );

		return true;
	}

	/**
	 * Render one server-authoritative create or edit schema.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {Object} schema Inspector schema.
	 * @param {boolean} focus_title Whether the title control receives focus.
	 * @return {boolean} True when rendered.
	 */
	function render_inspector_schema( config, schema, focus_title ) {
		var host = get_inspector_host();
		var form_target = host ? host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' ) : null;
		var footer = get_inspector_footer();
		var save_button = footer ? footer.querySelector( '[data-wpbc-ui-catalog-inspector-save]' ) : null;
		var template_role = 'create' === schema.mode ? 'inspector_create' : 'inspector_edit';

		if ( ! form_target ) {
			return false;
		}
		form_target.innerHTML = render_component( config, template_role, { i18n: config.i18n || {}, schema: schema } );
		var form = form_target.querySelector( '[data-wpbc-catalog-resource-inspector-form]' );
		if ( ! form ) {
			return false;
		}
		if ( 'create' === schema.mode ) {
			form.setAttribute( 'data-can-create', schema.can_create ? 'true' : 'false' );
		}
		inspector_mode = schema.mode;
		inspector_resource_id = Number( schema.resource_id ) || 0;
		if ( inspector_resource_id ) {
			var shortcode_field = form.querySelector( '.wpbc_catalog_booking_resources__editor_code' );
			if ( shortcode_field ) {
				synchronize_booking_resource_shortcode_input( inspector_resource_id, shortcode_field.value );
			}
		}
		set_inspector_state( 'form', '' );
		if ( save_button ) {
			configure_inspector_footer( 'wpbc_catalog_booking_resource_inspector_form', 'create' === inspector_mode ? config.i18n.add_resource || '' : config.i18n.save_changes || '', false, true );
		}
		var cancel_button = footer ? footer.querySelector( '[data-wpbc-ui-catalog-inspector-cancel]' ) : null;
		if ( cancel_button ) {
			cancel_button.disabled = false;
		}
		if ( 'function' === typeof window.WPBC_Collapsible_AutoInit ) {
			window.WPBC_Collapsible_AutoInit();
		}
		synchronize_all_inspector_numeric_ranges();
		synchronize_create_inspector_controls();
		inspector_original_fields = serialize_inspector_fields();
		inspector_dirty = false;
		synchronize_inspector_dirty_state();
		mark_inspector_resource_row( inspector_resource_id );
		if ( false !== focus_title ) {
			window.setTimeout( function () {
				var title_field = form.querySelector( '[data-wpbc-catalog-resource-field="title"]' );
				if ( title_field && 'function' === typeof title_field.focus ) {
					title_field.focus();
				}
			}, 120 );
		}

		return true;
	}

	/**
	 * Load and open one create or edit inspector.
	 *
	 * @param {Object}      config       Catalog configuration.
	 * @param {string}      mode         Create or edit.
	 * @param {number}      resource_id  Resource ID for edit.
	 * @param {HTMLElement} focus_target Initiating control.
	 * @param {string}      section_id   Optional edit section to open and focus.
	 * @return {void}
	 */
	function open_inspector( config, mode, resource_id, focus_target, section_id ) {
		var request_sequence;
		var action;

		resource_id = Number( resource_id ) || 0;
		if ( 'edit' === mode && resource_id === inspector_resource_id && document.querySelector( '[data-wpbc-catalog-resource-inspector-form][data-mode="edit"]' ) ) {
			expand_inspector_sidebar();
			mark_inspector_resource_row( resource_id );
			if ( section_id ) {
				activate_inspector_section( section_id );
			}
			return;
		}
		if ( ! can_discard_inspector( config ) || ! mount_inspector_shell( config ) ) {
			return;
		}
		close_details_row( false );
		inspector_focus_target = focus_target || document.activeElement;
		request_sequence = ++inspector_request_sequence;
		inspector_dirty = false;
		inspector_mode = mode;
		inspector_resource_id = resource_id;
		synchronize_inspector_width();
		action = 'create' === mode ? config.inspector_create_schema_action : config.inspector_edit_schema_action;
		set_inspector_state( 'loading', '' );
		mark_inspector_resource_row( inspector_resource_id );
		expand_inspector_sidebar();

		request_inspector( config, action, 'edit' === mode ? { resource_id: inspector_resource_id } : {} ).then( function ( response ) {
			if ( request_sequence !== inspector_request_sequence ) {
				return;
			}
			if ( ! response || true !== response.success || ! response.data || ! response.data.schema || ! render_inspector_schema( config, response.data.schema, ! section_id ) ) {
				set_inspector_state( 'error', get_inspector_response_message( response, config.i18n.inspector_load_failed ) );
			} else if ( section_id ) {
				activate_inspector_section( section_id );
			}
		} ).catch( function () {
			if ( request_sequence === inspector_request_sequence ) {
				set_inspector_state( 'error', config.i18n.inspector_load_failed || '' );
			}
		} );
	}

	/**
	 * Render the server-generated common-field bulk editor.
	 *
	 * @param {Object} config Catalog configuration.
	 * @param {Object} schema Authorized bulk schema.
	 * @return {boolean} True when the form rendered.
	 */
	function render_bulk_editor( config, schema ) {
		var host = get_inspector_host();
		var target = host ? host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' ) : null;

		if ( ! target ) {
			return false;
		}
		target.innerHTML = render_component( config, 'inspector_bulk_edit', { i18n: config.i18n || {}, schema: schema, selection_label: get_selection_count_label( config, schema.selection_count ) } );
		if ( ! target.querySelector( '[data-wpbc-catalog-resource-bulk-form]' ) ) {
			return false;
		}
		inspector_mode = 'bulk_edit';
		inspector_resource_id = 0;
		inspector_resource_ids = ( schema.resource_ids || [] ).map( Number );
		inspector_bulk_operations = {};
		inspector_review_token = '';
		inspector_selection_stale = false;
		inspector_tracks_selection = true;
		inspector_dirty = false;
		set_inspector_state( 'form', '' );
		configure_inspector_footer( 'wpbc_catalog_booking_resources_bulk_form', config.i18n.review_changes_button || '', false, true );
		if ( 'function' === typeof window.WPBC_Collapsible_AutoInit ) {
			window.WPBC_Collapsible_AutoInit();
		}
		mark_inspector_resource_row( 0 );
		focus_inspector_heading( target.querySelector( '[data-wpbc-catalog-resource-bulk-form]' ) );

		return true;
	}

	/**
	 * Open a bulk editor for the current explicit selection.
	 *
	 * @param {Object}      config       Catalog configuration.
	 * @param {HTMLElement} focus_target Initiating control.
	 * @return {void}
	 */
	function open_bulk_editor( config, focus_target ) {
		var resource_ids = get_selected_resource_ids( config );
		var request_sequence;

		if ( ! resource_ids.length || ! can_discard_inspector( config ) || ! mount_inspector_shell( config ) ) {
			return;
		}
		close_details_row( false );
		inspector_focus_target = focus_target || document.activeElement;
		request_sequence = ++inspector_request_sequence;
		inspector_mode = 'bulk_edit';
		inspector_resource_ids = resource_ids.slice();
		inspector_dirty = false;
		inspector_tracks_selection = true;
		synchronize_inspector_width();
		set_inspector_state( 'loading', '' );
		expand_inspector_sidebar();

		request_inspector( config, config.bulk_schema_action, { resource_ids: JSON.stringify( resource_ids ) } ).then( function ( response ) {
			if ( request_sequence !== inspector_request_sequence ) {
				return;
			}
			if ( ! response || true !== response.success || ! response.data || ! response.data.schema || ! render_bulk_editor( config, response.data.schema ) ) {
				set_inspector_state( 'error', get_inspector_response_message( response, config.i18n.bulk_load_failed ) );
			} else if ( ! resource_id_lists_match( inspector_resource_ids, get_selected_resource_ids( config ) ) ) {
				handle_inspector_selection_change( null, config );
			}
		} ).catch( function () {
			if ( request_sequence === inspector_request_sequence ) {
				set_inspector_state( 'error', config.i18n.bulk_load_failed || '' );
			}
		} );
	}

	/**
	 * Return only explicitly enabled bulk operations.
	 *
	 * @return {Object} Operation envelope keyed by field.
	 */
	function collect_bulk_operations() {
		var operations = {};

		document.querySelectorAll( '[data-wpbc-catalog-resource-bulk-enable]:checked' ).forEach( function ( enabled_control ) {
			var field_key = enabled_control.getAttribute( 'data-wpbc-catalog-resource-bulk-enable' ) || '';
			var operation = document.querySelector( '[data-wpbc-catalog-resource-bulk-operation="' + field_key + '"]' );
			var field_value = document.querySelector( '[data-wpbc-catalog-resource-bulk-value="' + field_key + '"]' );

			if ( field_key && operation && field_value ) {
				operations[ field_key ] = { operation: operation.value, value: field_value.value };
			}
		} );

		return operations;
	}

	/**
	 * Synchronize one optional bulk field and the review action.
	 *
	 * @param {HTMLElement|null} changed_control Control that changed, when available.
	 * @return {void}
	 */
	function synchronize_bulk_editor( changed_control ) {
		var field_wrap = changed_control ? changed_control.closest( '[data-wpbc-catalog-resource-bulk-field]' ) : null;
		var save_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );

		if ( field_wrap ) {
			var enabled_control = field_wrap.querySelector( '[data-wpbc-catalog-resource-bulk-enable]' );
			var operation_control = field_wrap.querySelector( '[data-wpbc-catalog-resource-bulk-operation]' );
			var prefix_element = field_wrap.querySelector( '[data-wpbc-catalog-resource-bulk-prefix]' );
			var suffix_element = field_wrap.querySelector( '[data-wpbc-catalog-resource-bulk-suffix]' );
			var enabled = !! enabled_control && enabled_control.checked;
			var operation_id = operation_control ? String( operation_control.value || '' ) : '';
			var is_percent = -1 !== operation_id.indexOf( 'percent' );
			field_wrap.classList.toggle( 'is-enabled', enabled );
			field_wrap.querySelectorAll( '[data-wpbc-catalog-resource-bulk-operation], [data-wpbc-catalog-resource-bulk-value], [data-wpbc-catalog-resource-bulk-range]' ).forEach( function ( control ) {
				control.disabled = ! enabled;
			} );
			if ( prefix_element ) {
				prefix_element.textContent = is_percent ? '' : field_wrap.getAttribute( 'data-wpbc-catalog-resource-bulk-prefix' ) || '';
			}
			if ( suffix_element ) {
				suffix_element.textContent = is_percent ? '%' : field_wrap.getAttribute( 'data-wpbc-catalog-resource-bulk-suffix' ) || '';
			}
			if ( changed_control && changed_control.matches( '[data-wpbc-catalog-resource-bulk-range]' ) ) {
				var number_control = field_wrap.querySelector( '[data-wpbc-catalog-resource-bulk-value]' );
				if ( number_control ) {
					number_control.value = changed_control.value;
				}
			} else {
				var range_control = field_wrap.querySelector( '[data-wpbc-catalog-resource-bulk-range]' );
				var field_value_control = field_wrap.querySelector( '[data-wpbc-catalog-resource-bulk-value]' );
				if ( range_control && field_value_control && '' !== field_value_control.value ) {
					range_control.value = field_value_control.value;
				}
			}
		}
		inspector_bulk_operations = collect_bulk_operations();
		inspector_dirty = Object.keys( inspector_bulk_operations ).length > 0;
		if ( save_button ) {
			save_button.disabled = inspector_selection_stale || ! inspector_dirty;
		}
	}

	/**
	 * Render a signed bulk-edit review without performing a mutation.
	 *
	 * @param {Object} config  Catalog configuration.
	 * @param {Object} preview Server-authoritative preview.
	 * @return {boolean} True when rendered.
	 */
	function render_bulk_review( config, preview ) {
		var host = get_inspector_host();
		var review_workflow = get_inline_review_workflow();
		var review_model;
		var target = host ? host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' ) : null;

		if ( ! target ) {
			return false;
		}
		review_model = review_workflow ? review_workflow.prepare( preview.review || {}, {
			changed_label: get_selection_count_label( config, preview.schema.resource_ids.length ),
			description: config.i18n.inline_review_description || '',
			form_id: 'wpbc_catalog_booking_resources_bulk_review_form',
			mode: 'bulk_review',
			pending_message: config.i18n.review_changes_help || '',
			title: config.i18n.review_changes || config.i18n.edit_booking_resources || ''
		} ) : {};
		target.innerHTML = render_component( config, 'inspector_bulk_review', review_model );
		if ( ! target.querySelector( '[data-wpbc-catalog-resource-bulk-review-form]' ) ) {
			return false;
		}
		inspector_mode = 'bulk_review';
		inspector_review_token = String( preview.review_token || '' );
		inspector_dirty = true;
		set_inspector_state( 'form', '' );
		configure_inspector_footer( 'wpbc_catalog_booking_resources_bulk_review_form', config.i18n.apply_changes || '', false, inspector_selection_stale );
		if ( review_workflow ) {
			review_workflow.synchronize( { busy: false, can_apply: ! inspector_selection_stale && !! inspector_review_token } );
		}
		focus_inspector_heading( target.querySelector( '[data-wpbc-catalog-resource-bulk-review-form]' ) );

		return true;
	}

	/**
	 * Render the signed deletion impact and explicit acknowledgement.
	 *
	 * @param {Object} config  Catalog configuration.
	 * @param {Object} preview Server-authoritative deletion preview.
	 * @return {boolean} True when rendered.
	 */
	function render_delete_review( config, preview ) {
		var host = get_inspector_host();
		var target = host ? host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' ) : null;
		var acknowledgement;

		if ( ! target ) {
			return false;
		}
		var delete_i18n = preview.i18n || {};

		target.innerHTML = render_component( config, 'inspector_delete', {
			delete_i18n: {
				acknowledgement: delete_i18n.acknowledgement || config.i18n.delete_acknowledgement || '',
				actions_heading: delete_i18n.actions_heading || '',
				bookings_retained_warning: delete_i18n.bookings_retained_warning || config.i18n.bookings_retained_warning || '',
				resources_to_delete: delete_i18n.resources_to_delete || config.i18n.resources_to_delete || '',
				review_help: delete_i18n.review_help || config.i18n.delete_review_help || '',
				title: delete_i18n.title || config.i18n.delete_booking_resources || '',
				warning: delete_i18n.warning || config.i18n.delete_warning || ''
			},
			i18n: config.i18n || {},
			preview: preview,
			selection_label: delete_i18n.selection_label || get_selection_count_label( config, preview.selection_count )
		} );
		if ( ! target.querySelector( '[data-wpbc-catalog-resource-delete-form]' ) ) {
			return false;
		}
		inspector_mode = 'delete_review';
		inspector_resource_ids = ( preview.resources || [] ).map( function ( resource ) { return Number( resource.id ); } );
		inspector_resource_id = ! inspector_tracks_selection && 1 === inspector_resource_ids.length ? inspector_resource_ids[0] : 0;
		inspector_review_token = String( preview.review_token || '' );
		inspector_selection_stale = false;
		inspector_dirty = false;
		set_inspector_state( 'form', '' );
		configure_inspector_footer(
			'wpbc_catalog_booking_resources_delete_form',
			delete_i18n.delete_button || format_message( 1 === Number( preview.selection_count ) ? config.i18n.delete_resource || '' : config.i18n.delete_resources || '', [ preview.selection_count ] ),
			true,
			true
		);
		acknowledgement = target.querySelector( '.wpbc_booking_resources__delete_acknowledgement' );
		pulse_delete_acknowledgement( acknowledgement );
		mark_inspector_resource_row( inspector_resource_id );
		focus_inspector_heading( target.querySelector( '[data-wpbc-catalog-resource-delete-form]' ) );

		return true;
	}

	/**
	 * Open the independent deletion review for explicit Resource IDs.
	 *
	 * @param {Object}        config       Catalog configuration.
	 * @param {Array<number>} resource_ids Resource IDs selected for deletion.
	 * @param {HTMLElement}   focus_target Initiating control.
	 * @param {boolean}       track_selection Whether deletion owns the checkbox selection.
	 * @return {void}
	 */
	function open_delete_review( config, resource_ids, focus_target, track_selection ) {
		var request_sequence;

		resource_ids = ( resource_ids || [] ).map( Number ).filter( function ( resource_id ) { return resource_id > 0; } );
		if ( ! resource_ids.length || ! can_discard_inspector( config ) || ! mount_inspector_shell( config ) ) {
			return;
		}
		close_details_row( false );
		inspector_focus_target = focus_target || document.activeElement;
		request_sequence = ++inspector_request_sequence;
		inspector_mode = 'delete_review';
		inspector_resource_ids = resource_ids.slice();
		inspector_resource_id = ! track_selection && 1 === inspector_resource_ids.length ? inspector_resource_ids[0] : 0;
		inspector_dirty = false;
		inspector_tracks_selection = !! track_selection;
		synchronize_inspector_width();
		set_inspector_state( 'loading', '' );
		mark_inspector_resource_row( inspector_resource_id );
		expand_inspector_sidebar();

		request_inspector( config, config.delete_preview_action, { resource_ids: JSON.stringify( resource_ids ) } ).then( function ( response ) {
			if ( request_sequence !== inspector_request_sequence ) {
				return;
			}
			if ( ! response || true !== response.success || ! response.data || ! response.data.preview || ! render_delete_review( config, response.data.preview ) ) {
				set_inspector_state( 'error', get_inspector_response_message( response, config.i18n.delete_load_failed ) );
			} else if ( inspector_tracks_selection && ! resource_id_lists_match( inspector_resource_ids, get_selected_resource_ids( config ) ) ) {
				handle_inspector_selection_change( null, config );
			}
		} ).catch( function () {
			if ( request_sequence === inspector_request_sequence ) {
				set_inspector_state( 'error', config.i18n.delete_load_failed || '' );
			}
		} );
	}

	/**
	 * Return one localized capacity count label.
	 *
	 * @param {Object} config       Catalog configuration.
	 * @param {string} singular_key Singular translation key.
	 * @param {string} plural_key   Plural translation key.
	 * @param {number} count        Non-negative count.
	 * @return {string} Localized label.
	 */
	function get_capacity_count_label( config, singular_key, plural_key, count ) {
		var template = 1 === Number( count ) ? config.i18n[ singular_key ] : config.i18n[ plural_key ];

		return format_message( template || '', [ count ] );
	}

	/**
	 * Build presentation-only data for the capacity WP template.
	 *
	 * @param {Object} config  Catalog configuration.
	 * @param {Object} context Server-authoritative capacity context.
	 * @return {Object} Template view data.
	 */
	function get_capacity_editor_view( config, context ) {
		var current_capacity = Number( context.current_capacity ) || 1;
		var target_capacity = inspector_capacity_target || current_capacity;
		var operation = target_capacity > current_capacity ? 'increase' : ( target_capacity < current_capacity ? 'decrease' : 'unchanged' );
		var keep_count = 'decrease' === operation ? target_capacity : current_capacity;
		var create_count = Math.max( 0, target_capacity - current_capacity );
		var decrease_count = Math.max( 0, current_capacity - target_capacity );
		var delete_action = 'decrease' === operation && 'delete' === inspector_capacity_decrease_action;

		return {
			children: ( context.children || [] ).map( function ( child ) {
				child = Object.assign( {}, child );
				child.selected = -1 !== inspector_capacity_detach_ids.indexOf( Number( child.id ) );
				return child;
			} ),
			context_label: ( config.i18n.resource_id || 'ID' ) + ': ' + String( context.resource_id ),
			current_capacity: current_capacity,
			decrease_action: inspector_capacity_decrease_action,
			decrease_heading: get_capacity_count_label( config, delete_action ? 'choose_delete_unit' : 'choose_detach_unit', delete_action ? 'choose_delete_units' : 'choose_detach_units', decrease_count ),
			decrease_help: delete_action ? config.i18n.delete_units_help || '' : config.i18n.select_detach_help || '',
			decrease_outcome_label: delete_action ? config.i18n.will_be_deleted || '' : config.i18n.make_independent || '',
			description: config.i18n.capacity_description || '',
			create_label: get_capacity_count_label( config, 'create_new_unit', 'create_new_units', create_count ),
			keep_label: get_capacity_count_label( config, 'keep_existing_unit', 'keep_existing_units', keep_count ),
			maximum_capacity: Number( context.maximum_capacity ) || current_capacity,
			minimum_capacity: Number( context.minimum_capacity ) || 1,
			mode: 'capacity',
			operation: operation,
			target_capacity: target_capacity,
			title: config.i18n.adjust_capacity || ''
		};
	}

	/**
	 * Synchronize the live capacity plan without replacing focused controls.
	 *
	 * @param {Object} config Catalog configuration.
	 * @return {void}
	 */
	function synchronize_capacity_editor( config ) {
		var form = document.querySelector( '[data-wpbc-catalog-resource-capacity-form][data-mode="capacity"]' );
		var save_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );
		var context = inspector_capacity_context || {};
		var current_capacity = Number( context.current_capacity ) || 1;
		var target_capacity = inspector_capacity_target || current_capacity;
		var operation = target_capacity > current_capacity ? 'increase' : ( target_capacity < current_capacity ? 'decrease' : 'unchanged' );
		var required_detach_count = Math.max( 0, current_capacity - target_capacity );
		var target_number = form ? form.querySelector( '[data-wpbc-catalog-capacity-target]' ) : null;
		var target_range = form ? form.querySelector( '[data-wpbc-catalog-capacity-range]' ) : null;

		if ( ! form ) {
			return;
		}
		if ( 'decrease' !== operation ) {
			inspector_capacity_detach_ids = [];
			inspector_capacity_decrease_action = 'detach';
		} else if ( inspector_capacity_detach_ids.length > required_detach_count ) {
			inspector_capacity_detach_ids = inspector_capacity_detach_ids.slice( 0, required_detach_count );
		}
		if ( target_number ) {
			target_number.value = String( target_capacity );
		}
		if ( target_range ) {
			target_range.value = String( target_capacity );
		}
		var after_value = form.querySelector( '[data-wpbc-catalog-capacity-after]' );
		var keep_label = form.querySelector( '[data-wpbc-catalog-capacity-keep-label]' );
		var create_label = form.querySelector( '[data-wpbc-catalog-capacity-create-label]' );
		var increase_row = form.querySelector( '[data-wpbc-catalog-capacity-increase-row]' );
		var decrease_panel = form.querySelector( '[data-wpbc-catalog-capacity-decrease]' );
		var decrease_heading = form.querySelector( '[data-wpbc-catalog-capacity-decrease-heading]' );
		var decrease_help = form.querySelector( '[data-wpbc-catalog-capacity-decrease-help]' );
		var delete_action = 'decrease' === operation && 'delete' === inspector_capacity_decrease_action;
		if ( after_value ) {
			after_value.textContent = String( target_capacity );
		}
		if ( keep_label ) {
			keep_label.textContent = get_capacity_count_label( config, 'keep_existing_unit', 'keep_existing_units', 'decrease' === operation ? target_capacity : current_capacity );
		}
		if ( create_label ) {
			create_label.textContent = get_capacity_count_label( config, 'create_new_unit', 'create_new_units', Math.max( 0, target_capacity - current_capacity ) );
		}
		if ( increase_row ) {
			increase_row.hidden = 'increase' !== operation;
		}
		if ( decrease_panel ) {
			decrease_panel.hidden = 'decrease' !== operation;
		}
		if ( decrease_heading ) {
			decrease_heading.textContent = get_capacity_count_label( config, delete_action ? 'choose_delete_unit' : 'choose_detach_unit', delete_action ? 'choose_delete_units' : 'choose_detach_units', required_detach_count );
		}
		if ( decrease_help ) {
			decrease_help.textContent = delete_action ? config.i18n.delete_units_help || '' : config.i18n.select_detach_help || '';
		}
		form.querySelectorAll( '[data-wpbc-catalog-capacity-decrease-action]' ).forEach( function ( action_control ) {
			var action_selected = action_control.value === inspector_capacity_decrease_action;
			action_control.checked = action_selected;
			if ( action_control.closest( 'label' ) ) {
				action_control.closest( 'label' ).classList.toggle( 'is-selected', action_selected );
			}
		} );
		form.querySelectorAll( '[data-wpbc-catalog-capacity-detach]' ).forEach( function ( checkbox ) {
			var selected = -1 !== inspector_capacity_detach_ids.indexOf( Number( checkbox.value ) );
			var unit = checkbox.closest( '.wpbc_booking_resources__capacity_unit' );
			var outcome = unit ? unit.querySelector( '.wpbc_booking_resources__capacity_unit_outcome' ) : null;
			checkbox.checked = selected;
			checkbox.disabled = ! selected && inspector_capacity_detach_ids.length >= required_detach_count;
			if ( unit ) {
				unit.classList.toggle( 'is-selected', selected );
			}
			if ( outcome ) {
				outcome.hidden = ! selected;
				outcome.textContent = delete_action ? config.i18n.will_be_deleted || '' : config.i18n.make_independent || '';
				outcome.classList.toggle( 'is-destructive', delete_action );
			}
		} );
		inspector_dirty = target_capacity !== current_capacity;
		if ( save_button ) {
			save_button.disabled = 'unchanged' === operation || ( 'decrease' === operation && inspector_capacity_detach_ids.length !== required_detach_count );
		}
	}

	/**
	 * Render an authorized capacity editor context.
	 *
	 * @param {Object} config  Catalog configuration.
	 * @param {Object} context Server capacity context.
	 * @return {boolean} True when the template rendered.
	 */
	function render_capacity_editor( config, context ) {
		var host = get_inspector_host();
		var target = host ? host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' ) : null;

		if ( ! target ) {
			return false;
		}
		inspector_capacity_context = context;
		inspector_capacity_target = Number( context.current_capacity ) || 1;
		inspector_capacity_detach_ids = [];
		inspector_capacity_decrease_action = 'detach';
		target.innerHTML = render_component( config, 'inspector_capacity', {
			i18n: config.i18n || {},
			view: get_capacity_editor_view( config, context )
		} );
		if ( ! target.querySelector( '[data-wpbc-catalog-resource-capacity-form]' ) ) {
			return false;
		}
		inspector_mode = 'capacity';
		inspector_resource_id = Number( context.resource_id ) || 0;
		inspector_review_token = '';
		inspector_dirty = false;
		set_inspector_state( 'form', '' );
		configure_inspector_footer( 'wpbc_catalog_booking_resource_capacity_form', config.i18n.review_capacity_change || '', false, true );
		mark_inspector_resource_row( inspector_resource_id );
		focus_inspector_heading( target.querySelector( '[data-wpbc-catalog-resource-capacity-form]' ) );

		return true;
	}

	/**
	 * Open capacity context from either row action entry point.
	 *
	 * @param {Object}      config       Catalog configuration.
	 * @param {number}      resource_id  Root or child Resource ID.
	 * @param {HTMLElement} focus_target Initiating control.
	 * @return {void}
	 */
	function open_capacity_editor( config, resource_id, focus_target ) {
		var request_sequence;

		if ( ! resource_id || ! can_discard_inspector( config ) || ! mount_inspector_shell( config ) ) {
			return;
		}
		close_details_row( false );
		inspector_focus_target = focus_target || document.activeElement;
		request_sequence = ++inspector_request_sequence;
		inspector_mode = 'capacity';
		inspector_resource_id = resource_id;
		inspector_dirty = false;
		inspector_tracks_selection = false;
		synchronize_inspector_width();
		set_inspector_state( 'loading', '' );
		mark_inspector_resource_row( resource_id );
		expand_inspector_sidebar();

		request_inspector( config, config.capacity_context_action, { resource_id: resource_id } ).then( function ( response ) {
			if ( request_sequence !== inspector_request_sequence ) {
				return;
			}
			if ( ! response || true !== response.success || ! response.data || ! response.data.context || ! render_capacity_editor( config, response.data.context ) ) {
				set_inspector_state( 'error', get_inspector_response_message( response, config.i18n.capacity_load_failed ) );
			}
		} ).catch( function () {
			if ( request_sequence === inspector_request_sequence ) {
				set_inspector_state( 'error', config.i18n.capacity_load_failed || '' );
			}
		} );
	}

	/**
	 * Render a signed capacity review returned by the domain service.
	 *
	 * @param {Object} config  Catalog configuration.
	 * @param {Object} preview Signed preview.
	 * @return {boolean} True when rendered.
	 */
	function render_capacity_review( config, preview ) {
		var host = get_inspector_host();
		var target = host ? host.querySelector( '[data-wpbc-ui-catalog-inspector-form]' ) : null;
		var increase = 'increase' === preview.operation;
		var delete_action = 'delete' === preview.decrease_action;
		var view;

		if ( ! target ) {
			return false;
		}
		view = {
			context_label: ( config.i18n.resource_id || 'ID' ) + ': ' + String( preview.resource_id ),
			current_capacity: Number( preview.current_capacity ),
			decrease_action: preview.decrease_action || 'detach',
			delete_has_bookings: true === preview.delete_has_bookings,
			description: config.i18n.review_capacity_help || '',
			mode: 'capacity_review',
			operation: preview.operation,
			operation_help: increase ? config.i18n.create_units_help || '' : ( delete_action ? config.i18n.delete_units_help || '' : config.i18n.select_detach_help || '' ),
			operation_label: increase
				? get_capacity_count_label( config, 'create_new_unit', 'create_new_units', Number( preview.create_count ) )
				: get_capacity_count_label( config, 'keep_existing_unit', 'keep_existing_units', Number( preview.target_capacity ) ),
			resources: increase ? preview.create_resources || [] : preview.detach_resources || [],
			target_capacity: Number( preview.target_capacity ),
			title: config.i18n.review_capacity_title || ''
		};
		target.innerHTML = render_component( config, 'inspector_capacity', { i18n: config.i18n || {}, view: view } );
		if ( ! target.querySelector( '[data-wpbc-catalog-resource-capacity-form]' ) ) {
			return false;
		}
		inspector_mode = 'capacity_review';
		inspector_resource_id = Number( preview.resource_id ) || 0;
		inspector_review_token = String( preview.review_token || '' );
		inspector_capacity_decrease_action = preview.decrease_action || 'detach';
		inspector_dirty = true;
		set_inspector_state( 'form', '' );
		configure_inspector_footer( 'wpbc_catalog_booking_resource_capacity_form', config.i18n.apply_capacity_change || '', delete_action, delete_action );
		if ( delete_action ) {
			var acknowledgement = target.querySelector( '[data-wpbc-catalog-capacity-delete-acknowledgement]' );
			pulse_delete_acknowledgement( acknowledgement ? acknowledgement.closest( '.wpbc_booking_resources__delete_acknowledgement' ) : null );
		}
		var cancel_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-cancel]' );
		if ( cancel_button ) {
			cancel_button.textContent = config.i18n.back || '';
		}
		focus_inspector_heading( target.querySelector( '[data-wpbc-catalog-resource-capacity-form]' ) );

		return true;
	}

	/**
	 * Synchronize the Resource image preview after Media Library changes.
	 *
	 * @param {HTMLElement} field Picture URL field.
	 * @return {void}
	 */
	function synchronize_inspector_image( field ) {
		var field_wrap = field ? field.closest( '[data-wpbc-catalog-resource-field-wrap]' ) : null;
		var preview = field_wrap ? field_wrap.querySelector( '[data-wpbc-catalog-resource-image-preview]' ) : null;
		var placeholder = field_wrap ? field_wrap.querySelector( '[data-wpbc-catalog-resource-image-placeholder]' ) : null;
		var remove_button = field_wrap ? field_wrap.querySelector( '[data-wpbc-catalog-resource-remove-image]' ) : null;
		var picture_url = field ? String( field.value || '' ).trim() : '';

		if ( preview ) {
			preview.src = picture_url;
			preview.hidden = ! picture_url;
		}
		if ( placeholder ) {
			placeholder.hidden = !! picture_url;
		}
		if ( remove_button ) {
			remove_button.disabled = ! picture_url;
		}
	}

	/**
	 * Synchronize one numeric slider with its precise number field.
	 *
	 * Suggested slider bounds remain convenient for ordinary values. Price keeps
	 * its product-defined 0-1000 slider while the authoritative number field can
	 * still preserve a legacy price above 1000. Other numeric controls can expand
	 * to represent stored values outside their suggested range.
	 *
	 * @param {string} field_key Numeric inspector field key.
	 * @return {void}
	 */
	function synchronize_inspector_numeric_range( field_key ) {
		var number_field = document.querySelector( '[data-wpbc-catalog-resource-field="' + field_key + '"][type="number"]' );
		var range = document.querySelector( '[data-wpbc-catalog-resource-range="' + field_key + '"]' );
		var number_value;
		var default_min;
		var default_max;
		var hard_min;
		var hard_max;
		var range_min;
		var range_max;

		if ( ! number_field || ! range ) {
			return;
		}

		number_value = Number( number_field.value );
		if ( ! isFinite( number_value ) ) {
			return;
		}

		default_min = Number( range.getAttribute( 'data-wpbc-catalog-resource-range-default-min' ) );
		default_max = Number( range.getAttribute( 'data-wpbc-catalog-resource-range-default-max' ) );
		hard_min = '' === String( number_field.getAttribute( 'min' ) || '' ) ? null : Number( number_field.getAttribute( 'min' ) );
		hard_max = '' === String( number_field.getAttribute( 'max' ) || '' ) ? null : Number( number_field.getAttribute( 'max' ) );
		if ( 'base_cost' === field_key ) {
			range_min = isFinite( default_min ) ? default_min : 0;
			range_max = isFinite( default_max ) ? default_max : 1000;
		} else {
			range_min = null !== hard_min && isFinite( hard_min )
				? hard_min
				: Math.min( isFinite( default_min ) ? default_min : number_value, number_value );
			range_max = null !== hard_max && isFinite( hard_max )
				? hard_max
				: Math.max( isFinite( default_max ) ? default_max : number_value, number_value );
		}

		range.min = String( range_min );
		range.max = String( range_max );
		range.value = String( number_value );
	}

	/**
	 * Synchronize every rendered inspector numeric slider.
	 *
	 * @return {void}
	 */
	function synchronize_all_inspector_numeric_ranges() {
		document.querySelectorAll( '[data-wpbc-catalog-resource-range]' ).forEach( function ( range ) {
			synchronize_inspector_numeric_range( range.getAttribute( 'data-wpbc-catalog-resource-range' ) || '' );
		} );
	}

	/**
	 * Copy a slider value into its authoritative number field.
	 *
	 * The number field remains the only serialized control and emits one native
	 * input event so validation and dirty-state behavior stay centralized.
	 *
	 * @param {HTMLElement} range Numeric range control.
	 * @return {void}
	 */
	function synchronize_inspector_number_from_range( range ) {
		var field_key = range ? range.getAttribute( 'data-wpbc-catalog-resource-range' ) || '' : '';
		var number_field = field_key ? document.querySelector( '[data-wpbc-catalog-resource-field="' + field_key + '"][type="number"]' ) : null;

		if ( ! number_field ) {
			return;
		}
		number_field.value = range.value;
		number_field.dispatchEvent( new Event( 'input', { bubbles: true } ) );
	}

	/**
	 * Confirm that a form submit originated from the inspector save action.
	 *
	 * WordPress Media Library controls may temporarily coexist with the sidebar
	 * form. Rejecting their submitters prevents an image insertion from starting
	 * a Resource mutation. The active inspector field fallback preserves native
	 * Enter-key submission in browsers without SubmitEvent.submitter support.
	 *
	 * @param {SubmitEvent} event Form submission.
	 * @param {HTMLElement} form  Active inspector form.
	 * @return {boolean} True only for an intentional inspector submission.
	 */
	function is_expected_inspector_submit( event, form ) {
		var submitter = event.submitter || document.activeElement;

		if ( submitter && submitter.matches && submitter.matches( '[data-wpbc-ui-catalog-inspector-save]' ) ) {
			return true;
		}

		return ! event.submitter
			&& submitter
			&& form.contains( submitter )
			&& submitter.matches
			&& submitter.matches( 'input:not([type="button"]):not([type="submit"]), select' );
	}

	/**
	 * Report inspector validity without rejecting an existing decimal price.
	 *
	 * Price controls intentionally use a one-unit spinner step. Existing prices
	 * may still contain decimals, so their step constraint is relaxed only while
	 * native form validity is evaluated. Server-side price validation remains the
	 * authoritative boundary.
	 *
	 * @param {HTMLFormElement} form Inspector form.
	 * @return {boolean} True when the form passes native validity checks.
	 */
	function report_inspector_validity( form ) {
		var price_fields = form.querySelectorAll( '[data-wpbc-catalog-resource-field="base_cost"], [data-wpbc-catalog-resource-bulk-value="base_cost"]' );
		var price_steps = [];
		var is_valid;

		price_fields.forEach( function ( price_field ) {
			price_steps.push( {
				field: price_field,
				step: price_field.getAttribute( 'step' )
			} );
			price_field.setAttribute( 'step', 'any' );
		} );

		is_valid = form.reportValidity();
		price_steps.forEach( function ( price_step ) {
			if ( null === price_step.step ) {
				price_step.field.removeAttribute( 'step' );
			} else {
				price_step.field.setAttribute( 'step', price_step.step );
			}
		} );

		return is_valid;
	}

	/**
	 * Save the active inspector through its independent mutation endpoint.
	 *
	 * @param {SubmitEvent} event Form submission.
	 * @param {Object}      config Catalog configuration.
	 * @return {void}
	 */
	function submit_inspector( event, config ) {
		var form = event.target;
		var save_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );
		var cancel_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-cancel]' );
		var mutation_request_sequence;
		var fields;
		var action;
		var submitted_mode;
		var request_values;
		var control_disabled_states = [];
		var success_message;
		var success_message_is_global;
		var submitted_form_is_active;

		event.preventDefault();
		if ( ! is_expected_inspector_submit( event, form ) || ( save_button && save_button.classList.contains( 'is-busy' ) ) || ! report_inspector_validity( form ) ) {
			return;
		}
		mutation_request_sequence = ++inspector_mutation_request_sequence;
		inspector_mutation_in_progress = true;
		fields = JSON.parse( serialize_inspector_fields() || '{}' );
		action = 'create' === inspector_mode ? config.inspector_create_action : config.inspector_update_action;
		submitted_mode = inspector_mode;
		request_values = { fields: JSON.stringify( fields ) };
		if ( 'edit' === inspector_mode ) {
			request_values.resource_id = inspector_resource_id;
		}
		if ( save_button ) {
			save_button.disabled = true;
			save_button.classList.add( 'is-busy' );
		}
		if ( cancel_button ) {
			cancel_button.disabled = true;
		}
		form.classList.add( 'is-saving' );
		form.setAttribute( 'aria-busy', 'true' );
		form.querySelectorAll( 'input, select, textarea, button' ).forEach( function ( control ) {
			control_disabled_states.push( { control: control, disabled: control.disabled } );
			control.disabled = true;
		} );

		request_inspector( config, action, request_values ).then( function ( response ) {
			if ( mutation_request_sequence !== inspector_mutation_request_sequence ) {
				return;
			}
			if ( ! response || true !== response.success || ! response.data ) {
				throw new Error( get_inspector_response_message( response, config.i18n.inspector_save_failed ) );
			}
			pending_highlight_ids = Array.isArray( response.data.resource_ids ) ? response.data.resource_ids.map( String ) : [];
			inspector_dirty = false;
			success_message = get_inspector_response_message( response, '' );
			success_message_is_global = show_admin_message( success_message, 'success', 3000 );
			submitted_form_is_active = document.documentElement.contains( form );
			if ( 'create' === submitted_mode ) {
				inspector_mutation_in_progress = false;
				if ( submitted_form_is_active ) {
					close_inspector( config, false );
				}
				if ( catalog_controller ) {
					catalog_controller.load( { page_number: 1 } );
				}
				return;
			}
			if ( ! submitted_form_is_active ) {
				if ( catalog_controller ) {
					catalog_controller.load();
				}
				inspector_mutation_in_progress = false;
				return;
			}
			if ( response.data.schema && render_inspector_schema( config, response.data.schema, false ) ) {
				form = document.querySelector( '[data-wpbc-catalog-resource-inspector-form]' );
				show_inspector_message( form, success_message_is_global ? '' : success_message, false );
			} else {
				form.classList.remove( 'is-saving' );
				form.removeAttribute( 'aria-busy' );
				control_disabled_states.forEach( function ( control_state ) {
					if ( document.documentElement.contains( control_state.control ) ) {
						control_state.control.disabled = control_state.disabled;
					}
				} );
				if ( save_button ) {
					save_button.classList.remove( 'is-busy' );
				}
				if ( cancel_button ) {
					cancel_button.disabled = false;
				}
				inspector_original_fields = serialize_inspector_fields();
				synchronize_inspector_dirty_state();
				show_inspector_message( form, success_message_is_global ? '' : success_message, false );
			}
			if ( catalog_controller ) {
				catalog_controller.load();
			}
			inspector_mutation_in_progress = false;
		} ).catch( function ( error ) {
			if ( mutation_request_sequence !== inspector_mutation_request_sequence ) {
				return;
			}
			inspector_mutation_in_progress = false;
			var message = error && error.message ? error.message : config.i18n.inspector_save_failed || '';
			if ( ! document.documentElement.contains( form ) ) {
				show_admin_message( message, 'error', 5000 );
				return;
			}
			form.classList.remove( 'is-saving' );
			form.removeAttribute( 'aria-busy' );
			show_inspector_message( form, message, true );
			control_disabled_states.forEach( function ( control_state ) {
				if ( document.documentElement.contains( control_state.control ) ) {
					control_state.control.disabled = control_state.disabled;
				}
			} );
			if ( save_button ) {
				save_button.classList.remove( 'is-busy' );
			}
			if ( cancel_button ) {
				cancel_button.disabled = false;
			}
			synchronize_inspector_dirty_state();
		} );
	}

	/**
	 * Submit bulk, permanent-delete, and capacity review inspector states.
	 *
	 * Mutations remain impossible from selection alone: bulk editing requires a
	 * signed preview, and deletion additionally requires explicit acknowledgement.
	 *
	 * @param {SubmitEvent} event  Inspector form submission.
	 * @param {Object}      config Catalog configuration.
	 * @return {void}
	 */
	function submit_reviewed_inspector( event, config ) {
		var form = event.target;
		var save_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );
		var cancel_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-cancel]' );
		var request_sequence;
		var action;
		var values;
		var fallback;
		var is_mutation;
		var submitted_mode;
		var submitted_resource_ids;
		var submitted_tracks_selection;

		event.preventDefault();
		if ( inspector_selection_stale || ! is_expected_inspector_submit( event, form ) || ( save_button && ( save_button.disabled || save_button.classList.contains( 'is-busy' ) ) ) || ! report_inspector_validity( form ) ) {
			return;
		}
		submitted_mode = inspector_mode;
		submitted_resource_ids = inspector_resource_ids.slice();
		submitted_tracks_selection = inspector_tracks_selection;
		if ( 'bulk_edit' === submitted_mode ) {
			inspector_bulk_operations = collect_bulk_operations();
			action = config.bulk_preview_action;
			values = { resource_ids: JSON.stringify( inspector_resource_ids ), operations: JSON.stringify( inspector_bulk_operations ) };
			fallback = config.i18n.bulk_review_failed;
		} else if ( 'bulk_review' === submitted_mode ) {
			action = config.bulk_apply_action;
			values = { resource_ids: JSON.stringify( inspector_resource_ids ), operations: JSON.stringify( inspector_bulk_operations ), review_token: inspector_review_token };
			fallback = config.i18n.bulk_apply_failed;
		} else if ( 'delete_review' === submitted_mode ) {
			action = config.delete_apply_action;
			values = { acknowledged: '1', resource_ids: JSON.stringify( inspector_resource_ids ), review_token: inspector_review_token };
			fallback = config.i18n.delete_apply_failed;
		} else if ( 'capacity' === submitted_mode ) {
			action = config.capacity_preview_action;
			values = { resource_id: inspector_resource_id, target_capacity: inspector_capacity_target, detach_resource_ids: JSON.stringify( inspector_capacity_detach_ids ), decrease_action: inspector_capacity_decrease_action };
			fallback = config.i18n.capacity_review_failed;
		} else if ( 'capacity_review' === submitted_mode ) {
			action = config.capacity_apply_action;
			var capacity_acknowledgement = form.querySelector( '[data-wpbc-catalog-capacity-delete-acknowledgement]' );
			values = { resource_id: inspector_resource_id, target_capacity: inspector_capacity_target, detach_resource_ids: JSON.stringify( inspector_capacity_detach_ids ), decrease_action: inspector_capacity_decrease_action, acknowledged: capacity_acknowledgement && capacity_acknowledgement.checked ? '1' : '0', review_token: inspector_review_token };
			fallback = config.i18n.capacity_apply_failed;
		} else {
			return;
		}

		is_mutation = 'bulk_review' === submitted_mode || 'delete_review' === submitted_mode || 'capacity_review' === submitted_mode;
		request_sequence = is_mutation ? ++inspector_mutation_request_sequence : ++inspector_request_sequence;
		if ( is_mutation ) {
			inspector_mutation_in_progress = true;
		}
		if ( 'bulk_review' === submitted_mode && get_inline_review_workflow() ) {
			get_inline_review_workflow().synchronize( { busy: true, can_apply: true } );
		}
		if ( 'delete_review' === submitted_mode && get_delete_review_workflow() ) {
			get_delete_review_workflow().synchronize( { busy: true, can_apply: true } );
		}
		if ( save_button ) {
			save_button.disabled = true;
			save_button.classList.add( 'is-busy' );
		}
		if ( cancel_button ) {
			cancel_button.disabled = true;
		}
		form.classList.add( 'is-saving' );
		form.setAttribute( 'aria-busy', 'true' );

		request_inspector( config, action, values ).then( function ( response ) {
			if ( request_sequence !== ( is_mutation ? inspector_mutation_request_sequence : inspector_request_sequence ) ) {
				return;
			}
			if ( ! response || true !== response.success || ! response.data ) {
				throw new Error( get_inspector_response_message( response, fallback ) );
			}
			if ( 'bulk_edit' === submitted_mode ) {
				if ( ! response.data.preview || ! render_bulk_review( config, response.data.preview ) ) {
					throw new Error( fallback || '' );
				}
				return;
			}
			if ( 'capacity' === submitted_mode ) {
				if ( ! response.data.preview || ! render_capacity_review( config, response.data.preview ) ) {
					throw new Error( fallback || '' );
				}
				return;
			}
			if ( 'bulk_review' === submitted_mode ) {
				pending_highlight_ids = Array.isArray( response.data.updated_ids ) ? response.data.updated_ids.map( String ) : [];
			} else if ( 'capacity_review' === submitted_mode ) {
				pending_highlight_ids = Array.isArray( response.data.affected_ids ) ? response.data.affected_ids.map( String ) : [];
			} else {
				var mount = document.getElementById( config.mount_id );
				var selection = mount && mount._wpbc_ui_catalog_selection_controller;
				var selected_resource_ids = get_selected_resource_ids( config );
				var deleted_selected_resource = submitted_resource_ids.some( function ( resource_id ) {
					return -1 !== selected_resource_ids.indexOf( Number( resource_id ) );
				} );
				if ( selection && 'function' === typeof selection.clear && ( submitted_tracks_selection || deleted_selected_resource ) ) {
					selection.clear();
				}
			}
			show_admin_message( get_inspector_response_message( response, '' ), 'success', 4000 );
			inspector_dirty = false;
			inspector_mutation_in_progress = false;
			if ( document.documentElement.contains( form ) ) {
				close_inspector( config, false );
			}
			if ( catalog_controller ) {
				catalog_controller.load();
			}
		} ).catch( function ( error ) {
			if ( request_sequence !== ( is_mutation ? inspector_mutation_request_sequence : inspector_request_sequence ) ) {
				return;
			}
			if ( is_mutation ) {
				inspector_mutation_in_progress = false;
			}
			if ( ! document.documentElement.contains( form ) ) {
				show_admin_message( error && error.message ? error.message : fallback || '', 'error', 5000 );
				return;
			}
			form.classList.remove( 'is-saving' );
			form.removeAttribute( 'aria-busy' );
			show_inspector_message( form, error && error.message ? error.message : fallback || '', true );
			if ( save_button ) {
				save_button.classList.remove( 'is-busy' );
				save_button.disabled = inspector_selection_stale || ( 'delete_review' === inspector_mode && ! form.querySelector( '[data-wpbc-catalog-resource-delete-acknowledgement]:checked' ) );
			}
			if ( cancel_button ) {
				cancel_button.disabled = false;
			}
			if ( 'bulk_review' === submitted_mode && get_inline_review_workflow() ) {
				get_inline_review_workflow().synchronize( { busy: false, can_apply: ! inspector_selection_stale } );
			}
			if ( 'delete_review' === submitted_mode && get_delete_review_workflow() ) {
				get_delete_review_workflow().synchronize( { busy: false, can_apply: ! inspector_selection_stale } );
			}
		} );
	}

	/**
	 * Invalidate an open selection-owned inspector when its selection changes.
	 *
	 * @param {CustomEvent} event  Shared selection lifecycle event.
	 * @param {Object}      config Catalog configuration.
	 * @return {void}
	 */
	function handle_inspector_selection_change( event, config ) {
		var selected_ids = event && event.detail && Array.isArray( event.detail.selected_ids ) ? event.detail.selected_ids : get_selected_resource_ids( config );
		var form;
		var save_button;

		if ( ! inspector_tracks_selection || -1 === [ 'bulk_edit', 'bulk_review', 'delete_review' ].indexOf( inspector_mode ) ) {
			return;
		}
		form = document.querySelector( '[data-wpbc-catalog-resource-bulk-form], [data-wpbc-catalog-resource-bulk-review-form], [data-wpbc-catalog-resource-delete-form]' );
		save_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );
		if ( resource_id_lists_match( inspector_resource_ids, selected_ids ) ) {
			if ( ! inspector_selection_stale ) {
				return;
			}
			inspector_selection_stale = false;
			show_inspector_message( form, '', false );
			if ( 'delete_review' === inspector_mode && get_delete_review_workflow() ) {
				get_delete_review_workflow().synchronize( { busy: false, can_apply: true } );
			}
			if ( 'bulk_edit' === inspector_mode ) {
				synchronize_bulk_editor( null );
			} else if ( save_button ) {
				var acknowledgement = form ? form.querySelector( '[data-wpbc-catalog-resource-delete-acknowledgement]' ) : null;
				save_button.disabled = 'delete_review' === inspector_mode && ( ! acknowledgement || ! acknowledgement.checked );
			}
			return;
		}
		inspector_selection_stale = true;
		show_inspector_message( form, config.i18n.selection_changed || '', true );
		if ( 'delete_review' === inspector_mode && get_delete_review_workflow() ) {
			get_delete_review_workflow().synchronize( { busy: false, can_apply: false } );
		}
		if ( save_button ) {
			save_button.disabled = true;
		}
	}

	/**
	 * Apply the post-mutation highlight after an AJAX catalog refresh.
	 *
	 * @return {void}
	 */
	function apply_pending_highlights() {
		var first_row = null;

		pending_highlight_ids.forEach( function ( resource_id ) {
			var row = document.querySelector( '[data-wpbc-booking-resource-id="' + resource_id + '"]' );
			if ( row ) {
				row.classList.add( 'is-recently-saved' );
				first_row = first_row || row;
			}
		} );
		if ( first_row ) {
			first_row.scrollIntoView( { block: 'nearest', behavior: 'smooth' } );
		}
		window.setTimeout( function () {
			document.querySelectorAll( '.wpbc_booking_resources__item.is-recently-saved' ).forEach( function ( row ) {
				row.classList.remove( 'is-recently-saved' );
			} );
		}, 5000 );
		pending_highlight_ids = [];
	}

	/**
	 * Handle completed shared renders for this Resource catalog only.
	 *
	 * @param {CustomEvent} event Shared catalog lifecycle event.
	 * @return {void}
	 */
	function handle_catalog_rendered( event ) {
		var config = window.wpbc_catalog_booking_resources_config;
		var event_detail = event && event.detail ? event.detail : {};

		if ( ! config || event_detail.catalog_id !== config.id || ! event_detail.response ) {
			return;
		}

		catalog_response = event_detail.response;
		synchronize_booking_resources_toolbar( config, catalog_response );
		render_booking_resources_response( config, catalog_response );
		render_inline_bar( config );
		synchronize_inline_controls( config );
		if ( inspector_resource_id ) {
			mark_inspector_resource_row( inspector_resource_id );
		}
		apply_pending_highlights();
	}

	/**
	 * Request a selected pagination page through the shared controller.
	 *
	 * @param {MouseEvent} event Catalog click event.
	 * @return {void}
	 */
	function handle_catalog_click( event ) {
		var action_button = event.target.closest( '[data-wpbc-booking-resource-action]' );
		var action_details;
		var catalog_mount;
		var config = window.wpbc_catalog_booking_resources_config;
		var page_button = event.target.closest( '[data-wpbc-ui-catalog-page]' );
		var resource_action_event;

		if ( inline_state.active && action_button ) {
			event.preventDefault();
			return;
		}

		if ( page_button && ! page_button.disabled ) {
			pending_focus_direction = page_button.getAttribute( 'data-wpbc-ui-catalog-page-direction' ) || 'page';
		}

		if ( ! action_button || ! config ) {
			return;
		}
		var action_id = action_button.getAttribute( 'data-wpbc-booking-resource-action' ) || '';
		if ( 'toggle_details' === action_id ) {
			var resource_id = Number( action_button.getAttribute( 'data-wpbc-booking-resource-id' ) || 0 );
			var resource_row = get_resource_item_container( action_button );
			event.preventDefault();
			if ( resource_id && resource_row && config.details_action ) {
				if ( resource_id === details_resource_id ) {
					close_details_row( true );
				} else {
					open_details_row( config, action_button, resource_row, resource_id );
				}
			}
			return;
		}
		if ( 'copy_details_value' === action_id ) {
			event.preventDefault();
			copy_details_value( action_button.getAttribute( 'data-wpbc-booking-resource-copy-value' ) || '', action_button, config );
			return;
		}
		action_details = action_button.closest( 'details' );
		if ( action_details ) {
			action_details.removeAttribute( 'open' );
		}

		catalog_mount = document.getElementById( config.mount_id );
		if ( catalog_mount ) {
			if ( 'function' === typeof window.CustomEvent ) {
				resource_action_event = new window.CustomEvent( 'wpbc:booking-resource-action', {
					bubbles: true,
					detail: {
						action: action_button.getAttribute( 'data-wpbc-booking-resource-action' ) || '',
						resource_id: Number( action_button.getAttribute( 'data-wpbc-booking-resource-id' ) || 0 )
					}
				} );
			} else {
				resource_action_event = document.createEvent( 'CustomEvent' );
				resource_action_event.initCustomEvent( 'wpbc:booking-resource-action', true, false, {
					action: action_button.getAttribute( 'data-wpbc-booking-resource-action' ) || '',
					resource_id: Number( action_button.getAttribute( 'data-wpbc-booking-resource-id' ) || 0 )
				} );
			}
			catalog_mount.dispatchEvent( resource_action_event );
		}
	}

	/**
	 * Close expanded details with Escape and restore disclosure focus.
	 *
	 * @param {KeyboardEvent} event Catalog keyboard event.
	 * @return {void}
	 */
	function handle_catalog_keydown( event ) {
		var config = window.wpbc_catalog_booking_resources_config;

		if ( 'Escape' === event.key && inline_state.active && 'inline_review' !== inspector_mode ) {
			synchronize_inline_drafts( config );
			if ( ! inline_state.changed_rows.length || window.confirm( config.i18n.inline_discard || '' ) ) {
				event.preventDefault();
				leave_inline_mode( config, true, '' );
			}
			return;
		}
		if ( 'Escape' === event.key && event.target.closest( '[data-wpbc-booking-resource-details-row]' ) ) {
			event.preventDefault();
			close_details_row( true );
		}
	}

	/**
	 * Block Booking Resource image changes in public demo installations.
	 *
	 * This capture-phase guard runs before the shared delegated media-uploader
	 * handler, preventing the WordPress media modal from opening. Server-side
	 * create validation independently rejects a forged picture URL.
	 *
	 * @param {MouseEvent} event  Browser click event.
	 * @param {Object}     config Catalog configuration.
	 * @return {void}
	 */
	function protect_demo_resource_image_change( event, config ) {
		var media_button;
		var inspector_form;
		var message;
		var message_title;

		if ( ! config || ! is_true_flag( config.is_demo ) || ! event.target || 'function' !== typeof event.target.closest ) {
			return;
		}

		media_button = event.target.closest( '.wpbc_media_upload_button, [data-wpbc-catalog-resource-remove-image]' );
		inspector_form = media_button ? media_button.closest( '[data-wpbc-catalog-resource-inspector-form]' ) : null;
		if ( ! media_button || ! inspector_form ) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if ( 'function' === typeof event.stopImmediatePropagation ) {
			event.stopImmediatePropagation();
		}
		message = config.i18n && config.i18n.demo_image_change_unavailable ? config.i18n.demo_image_change_unavailable : '';
		message_title = config.i18n && config.i18n.demo_image_change_unavailable_title ? config.i18n.demo_image_change_unavailable_title : '';
		open_booking_resource_message_dialog( message, message_title, media_button );
	}

	/**
	 * Mount the localized catalog configuration after the document is ready.
	 *
	 * @return {void}
	 */
	function mount_booking_resources_catalog() {
		var config = window.wpbc_catalog_booking_resources_config;
		var mount_element;

		if ( ! config || ! window.wpbc_ui_catalog || 'function' !== typeof window.wpbc_ui_catalog.mount ) {
			return;
		}

		mount_element = document.getElementById( config.mount_id );
		if ( ! mount_element ) {
			return;
		}

		mount_element.addEventListener( 'wpbc:ui-catalog-rendered', handle_catalog_rendered );
		mount_element.addEventListener( 'wpbc:ui-catalog-before-render', function () {
			close_details_row( false );
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-hierarchy-change', function () {
			close_details_row( false );
			synchronize_card_group_panels( mount_element );
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-selection-change', function ( event ) {
			handle_inspector_selection_change( event, config );
		} );
		mount_element.addEventListener( 'wpbc:ui-catalog-selection-restored', function ( event ) {
			handle_inspector_selection_change( event, config );
		} );
		mount_element.addEventListener( 'click', protect_inline_drafts_from_catalog_controls, true );
		mount_element.addEventListener( 'change', protect_inline_drafts_from_catalog_controls, true );
		mount_element.addEventListener( 'input', protect_inline_drafts_from_catalog_controls, true );
		mount_element.addEventListener( 'click', handle_catalog_click );
		mount_element.addEventListener( 'keydown', handle_catalog_keydown );
		window.addEventListener( 'resize', function () {
			synchronize_overflow_tooltips( mount_element );
		} );
		catalog_controller = window.wpbc_ui_catalog.mount( config );
		if ( catalog_controller ) {
			if ( 'function' === typeof window.wpbc_ui_catalog.create_inline_editing_workflow ) {
				inline_workflow_controller = window.wpbc_ui_catalog.create_inline_editing_workflow( mount_element, {
					bar_selector: '[data-wpbc-catalog-inline-bar]',
					cancel_selector: '[data-wpbc-catalog-inline-cancel]',
					controls_root: document,
					count_selector: '[data-wpbc-catalog-inline-count]',
					page_element: mount_element.matches( '.wpbc_booking_resources_page' ) ? mount_element : mount_element.querySelector( '.wpbc_booking_resources_page' ),
					protected_selector: '[data-wpbc-catalog-booking-resource-create]',
					review_selector: '[data-wpbc-catalog-inline-review]',
					toggle_label_selector: '[data-wpbc-catalog-inline-toggle-label]',
					toggle_selector: '[data-wpbc-catalog-inline-toggle]'
				} );
			}
			render_booking_resources_filters( config );
			render_booking_resources_toolbar( config );
			render_inline_bar( config );
			synchronize_inline_controls( config );
			mount_inspector_shell( config );
		}
		if ( 'function' === typeof window.wpbc_define_tippy_tooltips ) {
			window.wpbc_define_tippy_tooltips( '[data-wpbc-catalog-booking-resource-upgrade]' );
		}

		document.addEventListener( 'wpbc:booking-resource-action', function ( event ) {
			var detail = event && event.detail ? event.detail : {};
			if ( 'edit_resource' === detail.action ) {
				open_inspector( config, 'edit', Number( detail.resource_id ) || 0, document.activeElement );
			} else if ( 'publish_resource' === detail.action ) {
				open_inspector( config, 'edit', Number( detail.resource_id ) || 0, document.activeElement, 'shortcode_publishing' );
			} else if ( 'adjust_capacity' === detail.action ) {
				open_capacity_editor( config, Number( detail.resource_id ) || 0, document.activeElement );
			} else if ( 'delete_resource' === detail.action ) {
				open_delete_review( config, [ Number( detail.resource_id ) || 0 ], document.activeElement, false );
			}
		} );
		document.addEventListener( 'click', function ( event ) {
			protect_demo_resource_image_change( event, config );
		}, true );
		document.addEventListener( 'click', function ( event ) {
			var inline_toggle = event.target.closest( '[data-wpbc-catalog-inline-toggle]' );
			var inline_cancel = event.target.closest( '[data-wpbc-catalog-inline-cancel]' );
			var inline_review = event.target.closest( '[data-wpbc-catalog-inline-review]' );
			var create_button = event.target.closest( '[data-wpbc-catalog-booking-resource-create]' );
			var upgrade_button = event.target.closest( '[data-wpbc-catalog-booking-resource-upgrade]' );
			var cancel_button = event.target.closest( '[data-wpbc-ui-catalog-inspector-cancel]' );
			var remove_image_button = event.target.closest( '[data-wpbc-catalog-resource-remove-image]' );
			var shortcode_button = event.target.closest( '[data-wpbc-booking-resource-shortcode-command]' );
			var resource_row = get_resource_item_container( event.target );
			var selection_action = event.target.closest( '[data-wpbc-catalog-selection-action]' );
			if ( inline_toggle ) {
				event.preventDefault();
				start_inline_mode( config );
				return;
			}
			if ( inline_cancel ) {
				event.preventDefault();
				synchronize_inline_drafts( config );
				if ( ! inline_state.changed_rows.length || window.confirm( config.i18n.inline_discard || '' ) ) {
					leave_inline_mode( config, true, '' );
				}
				return;
			}
			if ( inline_review ) {
				event.preventDefault();
				preview_inline_changes( config, inline_review );
				return;
			}
			if ( selection_action ) {
				event.preventDefault();
				if ( 'bulk_edit' === selection_action.getAttribute( 'data-wpbc-catalog-selection-action' ) ) {
					open_bulk_editor( config, selection_action );
				} else {
					open_delete_review( config, get_selected_resource_ids( config ), selection_action, true );
				}
				return;
			}
			if ( shortcode_button ) {
				event.preventDefault();
				var shortcode_resource_id = Number( shortcode_button.getAttribute( 'data-wpbc-booking-resource-id' ) || 0 );
				var shortcode_command = shortcode_button.getAttribute( 'data-wpbc-booking-resource-shortcode-command' ) || '';
				var shortcode_value = get_booking_resource_shortcode( shortcode_resource_id, shortcode_button );
				if ( 'copy' === shortcode_command ) {
					copy_details_value( shortcode_value, shortcode_button, config );
				} else if ( 'customize' === shortcode_command ) {
					customize_booking_resource_shortcode( shortcode_resource_id, shortcode_value );
				} else if ( 'publish' === shortcode_command ) {
					publish_booking_resource_shortcode( shortcode_resource_id, shortcode_value, shortcode_button );
				}
				return;
			}
			if ( create_button ) {
				event.preventDefault();
				open_inspector( config, 'create', 0, create_button );
				return;
			}
			if ( upgrade_button ) {
				event.preventDefault();
				open_booking_resource_upgrade_dialog( upgrade_button );
				return;
			}
			if ( cancel_button ) {
				event.preventDefault();
				if ( 'inline_review' === inspector_mode ) {
					inspector_dirty = false;
					close_inspector( config, false );
					inline_state.review_token = '';
					synchronize_inline_controls( config );
				} else if ( 'capacity_review' === inspector_mode && inspector_capacity_context ) {
					var reviewed_target_capacity = inspector_capacity_target;
					var reviewed_detach_ids = inspector_capacity_detach_ids.slice();
					var reviewed_decrease_action = inspector_capacity_decrease_action;
					inspector_dirty = false;
					render_capacity_editor( config, inspector_capacity_context );
					inspector_capacity_target = reviewed_target_capacity;
					inspector_capacity_detach_ids = reviewed_detach_ids;
					inspector_capacity_decrease_action = reviewed_decrease_action;
					synchronize_capacity_editor( config );
				} else {
					close_inspector( config, true );
				}
				return;
			}
			if ( remove_image_button ) {
				event.preventDefault();
				var image_field = remove_image_button.closest( '[data-wpbc-catalog-resource-field-wrap]' ).querySelector( '[data-wpbc-catalog-resource-field="picture_url"]' );
				if ( image_field ) {
					image_field.value = '';
					synchronize_inspector_image( image_field );
					synchronize_inspector_dirty_state();
				}
				return;
			}
			if ( ! inline_state.active && resource_row && ! event.target.closest( 'a, button, input, select, textarea, summary, details, label' ) ) {
				open_inspector( config, 'edit', Number( resource_row.getAttribute( 'data-wpbc-booking-resource-id' ) ) || 0, resource_row );
			}
		} );
		document.addEventListener( 'input', function ( event ) {
			if ( event.target.matches( '[data-wpbc-catalog-capacity-target], [data-wpbc-catalog-capacity-range]' ) ) {
				var context = inspector_capacity_context || {};
				var minimum = Number( context.minimum_capacity ) || 1;
				var maximum = Number( context.maximum_capacity ) || minimum;
				var requested_capacity = Math.round( Number( event.target.value ) || minimum );

				inspector_capacity_target = Math.max( minimum, Math.min( maximum, requested_capacity ) );
				synchronize_capacity_editor( config );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-inline-field]' ) ) {
				synchronize_inline_drafts( config );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-resource-bulk-value], [data-wpbc-catalog-resource-bulk-range]' ) ) {
				synchronize_bulk_editor( event.target );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-resource-range]' ) ) {
				synchronize_inspector_number_from_range( event.target );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-field]' ) ) {
				if ( 'picture_url' === event.target.getAttribute( 'data-wpbc-catalog-resource-field' ) ) {
					synchronize_inspector_image( event.target );
				}
				if ( 'number' === event.target.type ) {
					synchronize_inspector_numeric_range( event.target.getAttribute( 'data-wpbc-catalog-resource-field' ) || '' );
				}
				synchronize_inspector_dirty_state();
			}
		} );
		document.addEventListener( 'change', function ( event ) {
			if ( get_delete_review_workflow() && get_delete_review_workflow().handle_change( event ) ) {
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-capacity-decrease-action]' ) ) {
				inspector_capacity_decrease_action = 'delete' === event.target.value ? 'delete' : 'detach';
				synchronize_capacity_editor( config );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-capacity-detach]' ) ) {
				var detach_id = Number( event.target.value ) || 0;
				if ( event.target.checked ) {
					if ( -1 === inspector_capacity_detach_ids.indexOf( detach_id ) ) {
						inspector_capacity_detach_ids.push( detach_id );
					}
				} else {
					inspector_capacity_detach_ids = inspector_capacity_detach_ids.filter( function ( resource_id ) { return resource_id !== detach_id; } );
				}
				synchronize_capacity_editor( config );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-inline-field]' ) ) {
				synchronize_inline_drafts( config );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-resource-bulk-enable], [data-wpbc-catalog-resource-bulk-operation], [data-wpbc-catalog-resource-bulk-value], [data-wpbc-catalog-resource-bulk-range]' ) ) {
				synchronize_bulk_editor( event.target );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-capacity-delete-acknowledgement]' ) ) {
				var capacity_delete_button = document.querySelector( '[data-wpbc-ui-catalog-inspector-save]' );
				var capacity_acknowledgement = event.target.closest( '.wpbc_booking_resources__delete_acknowledgement' );

				if ( event.target.checked && capacity_acknowledgement ) {
					capacity_acknowledgement.classList.remove( 'wpbc_booking_resources__delete_acknowledgement--attention' );
				} else {
					pulse_delete_acknowledgement( capacity_acknowledgement );
				}
				if ( capacity_delete_button ) {
					capacity_delete_button.disabled = ! event.target.checked;
				}
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-resource-range]' ) ) {
				synchronize_inspector_number_from_range( event.target );
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-resource-radio-field="creation_mode"]' ) ) {
				synchronize_create_inspector_controls();
				synchronize_inspector_dirty_state();
				return;
			}
			if ( event.target.matches( '[data-wpbc-catalog-resource-inspector-form] [data-wpbc-catalog-resource-field]' ) ) {
				if ( 'create' === inspector_mode ) {
					synchronize_create_inspector_controls();
				}
				synchronize_inspector_dirty_state();
			}
		} );
		if ( window.jQuery ) {
			window.jQuery( '.wpbc_settings_page_wrapper' ).on( 'wpbc:right-sidebar-before-content-collapse.wpbcCatalogBookingResources', function ( event ) {
				if ( inspector_mutation_in_progress ) {
					event.preventDefault();
				}
			} );
			window.jQuery( document ).on( 'wpbc_media_upload_url_set', '[data-wpbc-catalog-resource-field="picture_url"]', function () {
				synchronize_inspector_image( this );
				synchronize_inspector_dirty_state();
			} );
			window.jQuery( document ).on( 'wpbc:resource-shortcode-selected', function ( event, selection ) {
				var selected_resource_id = Number( selection && selection.resource_id ? selection.resource_id : 0 );
				var selected_shortcode = String( selection && selection.shortcode ? selection.shortcode : '' );
				var inspector_shortcode;

				if ( ! selected_resource_id ) {
					return;
				}
				synchronize_booking_resource_shortcode_input( selected_resource_id, selected_shortcode );
				document.querySelectorAll( '[data-wpbc-booking-resource-id="' + String( selected_resource_id ) + '"][data-wpbc-booking-resource-shortcode-command]' ).forEach( function ( action_button ) {
					action_button.setAttribute( 'data-wpbc-booking-resource-shortcode', selected_shortcode );
				} );
				var details_row = document.querySelector( '[data-wpbc-booking-resource-details-row="' + String( selected_resource_id ) + '"]' );
				var details_code = details_row ? details_row.querySelector( '[data-wpbc-booking-resource-details-section="booking_page"] code' ) : null;
				if ( details_code ) {
					details_code.textContent = selected_shortcode;
					details_code.setAttribute( 'data-wpbc-ui-catalog-overflow-tooltip', selected_shortcode );
					synchronize_overflow_tooltips( document.getElementById( config.mount_id ) );
				}
				if ( selected_resource_id === inspector_resource_id ) {
					inspector_shortcode = document.querySelector( '[data-wpbc-catalog-resource-inspector-form] .wpbc_catalog_booking_resources__editor_code' );
					if ( inspector_shortcode ) {
						inspector_shortcode.value = selected_shortcode;
						synchronize_inspector_dirty_state();
					}
				}
			} );
		}
		document.addEventListener( 'submit', function ( event ) {
			if ( event.target.matches( '[data-wpbc-catalog-inline-review-form]' ) ) {
				apply_inline_changes( event, config );
			} else if ( event.target.matches( '[data-wpbc-catalog-resource-inspector-form]' ) ) {
				submit_inspector( event, config );
			} else if ( event.target.matches( '[data-wpbc-catalog-resource-bulk-form], [data-wpbc-catalog-resource-bulk-review-form], [data-wpbc-catalog-resource-delete-form], [data-wpbc-catalog-resource-capacity-form]' ) ) {
				submit_reviewed_inspector( event, config );
			}
		} );
		window.addEventListener( 'beforeunload', function ( event ) {
			if ( inspector_dirty || inspector_mutation_in_progress || ( inline_state.active && inline_state.changed_rows.length ) ) {
				event.preventDefault();
				event.returnValue = '';
			}
		} );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', mount_booking_resources_catalog );
	} else {
		mount_booking_resources_catalog();
	}
}( window, document ) );
