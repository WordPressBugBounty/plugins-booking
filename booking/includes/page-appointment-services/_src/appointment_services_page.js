( function ( w, $ ) {
	'use strict';
	var config = w.wpbc_appointment_services_config || {};
	var state = {
		storageReady: false,
		catalog_loading: true,
		selectedId: Number( config.selected_id || 0 ),
		requested_focus: String( config.focus_section || '' ),
		focus_handled: false,
		busy: false,
		status: 'all',
		services: [],
		providers: {},
		providerCount: 0,
		editor_snapshot: '',
		editor_request_sequence: 0,
		initial_selection_pending: 0 < Number( config.selected_id || 0 ),
		inspector_focus_target: null,
		mutation_in_progress: false,
		operation_mode: '',
		operation_review: null,
		operation_request_sequence: 0,
		inline_editing: false,
		inline_drafts: {},
		inline_schema: {},
		inline_schema_loading: false,
		inline_request_sequence: 0,
		last_response: null,
		page: 1,
		page_size: Number( config.catalog && config.catalog.initial_request && config.catalog.initial_request.items_per_page ? config.catalog.initial_request.items_per_page : 10 ),
		total_items: 0,
		total_pages: 0,
		sort_by: String( config.catalog && config.catalog.initial_request && config.catalog.initial_request.sort_by ? config.catalog.initial_request.sort_by : 'service_id' ),
		sort_order: String( config.catalog && config.catalog.initial_request && config.catalog.initial_request.sort_order ? config.catalog.initial_request.sort_order : 'desc' )
	};
	var catalogController = false;
	var inlineWorkflowController = false;
	var inlineReviewWorkflowController = false;
	var deleteReviewWorkflowController = false;
	var inspectorWorkflowController = false;
	var searchTimer = 0;
	var weekdayKeys = [ 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun' ];
	var pending_highlight_ids = [];

	/** Extract an API message while preserving a caller-provided fallback. */
	function messageFrom( response, fallback ) { return response && response.data && response.data.message ? response.data.message : fallback; }
	/** Display a shared Booking Calendar administrator notice. */
	function notify( message, type ) {
		if ( message && typeof w.wpbc_admin_show_message === 'function' ) { w.wpbc_admin_show_message( message, type || 'info', 5000, false ); }
	}
	/**
	 * Return the shared signed-review presentation controller.
	 *
	 * @return {Object|false} Shared review controller or false when unavailable.
	 */
	function get_inline_review_workflow() {
		if ( inlineReviewWorkflowController ) { return inlineReviewWorkflowController; }
		if ( ! w.wpbc_ui_catalog || 'function' !== typeof w.wpbc_ui_catalog.create_inline_review_workflow ) { return false; }
		inlineReviewWorkflowController = w.wpbc_ui_catalog.create_inline_review_workflow( {
			apply_selector: '.wpbc_appointment_services__operation_apply',
			cancel_selector: '.wpbc_appointment_services__cancel',
			root: document
		} );
		return inlineReviewWorkflowController;
	}
	/**
	 * Return the shared permanent-deletion presentation controller.
	 *
	 * @return {Object|false} Shared deletion controller or false when unavailable.
	 */
	function get_delete_review_workflow() {
		if ( deleteReviewWorkflowController ) { return deleteReviewWorkflowController; }
		if ( ! w.wpbc_ui_catalog || 'function' !== typeof w.wpbc_ui_catalog.create_delete_review_workflow ) { return false; }
		deleteReviewWorkflowController = w.wpbc_ui_catalog.create_delete_review_workflow( {
			acknowledgement_selector: '[data-wpbc-ui-catalog-delete-acknowledgement]',
			apply_selector: '.wpbc_appointment_services__operation_apply',
			cancel_selector: '.wpbc_appointment_services__cancel',
			root: document
		} );
		return deleteReviewWorkflowController;
	}
	/**
	 * Show the native Booking Calendar Processing notice.
	 *
	 * The returned element identifies this specific request's notice so
	 * overlapping requests cannot dismiss each other's feedback.
	 *
	 * @return {jQuery} Processing notice wrapper, or an empty collection.
	 */
	function show_processing_notice() {
		if ( 'function' !== typeof w.wpbc_admin_show_message_processing ) {
			return $();
		}

		w.wpbc_admin_show_message_processing( '' );

		return $( '#ajax_working .wpbc_processing.wpbc_spin' ).last().closest( '[id^="wpbc_notice_"]' );
	}
	/**
	 * Hide the Processing notice created for one completed request.
	 *
	 * @param {jQuery} $processing_notice Notice wrapper returned by show_processing_notice().
	 * @return {void}
	 */
	function hide_processing_notice( $processing_notice ) {
		if ( $processing_notice && $processing_notice.length ) {
			$processing_notice.stop( true, true ).hide();
		}
	}
	/**
	 * Send an authenticated Appointment Services AJAX request.
	 *
	 * Requests normally use the shared administrator Processing notice and remove
	 * only their own notice after settling. Inspector-loading requests may opt out
	 * because the shared inspector already exposes equivalent progress feedback.
	 *
	 * @param {string} action WordPress AJAX action name.
	 * @param {Object}  data                   Request-specific payload.
	 * @param {boolean} use_processing_notice Whether to show the global notice.
	 * @return {jqXHR} jQuery AJAX promise for the request.
	 */
	function request( action, data, use_processing_notice ) {
		var $processing_notice = false === use_processing_notice ? $() : show_processing_notice();

		return $.ajax( { url: config.ajax_url, type: 'POST', dataType: 'json', data: $.extend( { action: action, nonce: config.nonce }, data || {} ) } )
			.always( function () { hide_processing_notice( $processing_notice ); } );
	}
	/** Activate the Settings or Help panel selected in the right sidebar. */
	function switchRightPanel( $tab ) {
		var panelId = $tab.attr( 'aria-controls' );
		var panel = panelId ? document.getElementById( panelId ) : null;
		var $tabs = $tab.closest( '.wpbc_appointment_services__rightbar_tabs' ).find( '[role="tab"]' );
		var $panels = $( '.wpbc_appointment_services__rightbar [role="tabpanel"]' );
		if ( ! panel ) { return; }
		$tabs.attr( 'aria-selected', 'false' );
		$tab.attr( 'aria-selected', 'true' );
		$panels.prop( 'hidden', true ).attr( 'aria-hidden', 'true' );
		$( panel ).prop( 'hidden', false ).attr( 'aria-hidden', 'false' );
		updateControls();
	}
	/**
	 * Tell the active Setup Wizard bar that the page workspace changed width.
	 *
	 * The delayed notification runs after the shared sidebar transition so the
	 * setup bar can measure the final inspector boundary.
	 *
	 * @return {void}
	 */
	function notify_setup_wizard_layout_changed() {
		$( document ).trigger( 'wpbc_setup_wizard_layout_changed' );
		w.setTimeout( function () { $( document ).trigger( 'wpbc_setup_wizard_layout_changed' ); }, 300 );
	}
	/**
	 * Expand the right sidebar and display the Service Settings inspector.
	 *
	 * @return {void}
	 */
	function expand_service_inspector() {
		var $settings_tab = $( '#wpbc_tab_service_settings' );

		if ( 'function' === typeof w.wpbc_admin_ui__sidebar_right__do_max ) {
			w.wpbc_admin_ui__sidebar_right__do_max();
		}
		if ( $settings_tab.length ) {
			switchRightPanel( $settings_tab );
		}
		notify_setup_wizard_layout_changed();
	}
	/**
	 * Reveal, expand, highlight, and optionally focus one Service editor group.
	 *
	 * @param {string} fields_selector Group fields selector from the fixed editor markup.
	 * @param {string} focus_selector  Optional control selector to focus after scrolling.
	 * @return {boolean} True when the requested inspector group was found.
	 */
	function open_service_inspector_group( fields_selector, focus_selector ) {
		var $group_fields = $( fields_selector );
		var $group = $group_fields.closest( '.wpbc_ui__collapsible_group' );
		var $group_header = $group.children( '.group__header' );
		var group_element = $group.get( 0 );
		var focus_element = focus_selector ? document.querySelector( focus_selector ) : null;

		expand_service_inspector();
		if ( ! $group.length ) {
			return false;
		}

		$group.addClass( 'is-open' );
		$group_header.attr( 'aria-expanded', 'true' );
		$group_fields.prop( 'hidden', false ).attr( 'aria-hidden', 'false' );
		$group.removeClass( 'wpbc_appointment_services__focus_pulse' );
		if ( group_element ) {
			void group_element.offsetWidth;
			$group.addClass( 'wpbc_appointment_services__focus_pulse' );
			try { group_element.scrollIntoView( { behavior: 'smooth', block: 'start', inline: 'nearest' } ); }
			catch ( error ) { group_element.scrollIntoView( true ); }
			w.setTimeout( function () { $group.removeClass( 'wpbc_appointment_services__focus_pulse' ); }, 900 );
		}
		if ( focus_element && typeof focus_element.focus === 'function' ) {
			try { focus_element.focus( { preventScroll: true } ); }
			catch ( error ) { focus_element.focus(); }
		}

		return true;
	}
	/**
	 * Open, reveal, and highlight the General Service editor section.
	 *
	 * @return {void}
	 */
	function open_add_service_inspector() {
		open_service_inspector_group( '#wpbc_service_general', '[data-service-field="title"]' );
	}
	/**
	 * Apply the one-time inspector focus requested by an administration link.
	 *
	 * @return {void}
	 */
	function focus_requested_service_section() {
		if ( state.focus_handled || 'booking_form' !== state.requested_focus ) {
			return;
		}

		if ( open_service_inspector_group( '#wpbc_service_form', '[data-service-field="booking_form_id"]' ) ) {
			state.focus_handled = true;
			if ( w.history && w.URL ) {
				var url = new w.URL( w.location.href );
				url.searchParams.delete( 'wpbc_service_focus' );
				w.history.replaceState( {}, '', url.toString() );
			}
		}
	}
	/** Expand or collapse one inspector field group. */
	function toggleInspectorGroup( $button ) {
		var $group = $button.closest( '.wpbc_ui__collapsible_group' );
		var $fields = $group.find( '> .group__fields' );
		var isOpen = $group.hasClass( 'is-open' );
		$group.toggleClass( 'is-open', ! isOpen );
		$button.attr( 'aria-expanded', isOpen ? 'false' : 'true' );
		$fields.prop( 'hidden', isOpen ).attr( 'aria-hidden', isOpen ? 'true' : 'false' );
	}
	/** Determine whether a Service is currently loaded into the editor. */
	function editorIsOpen() { return ! $( '[data-service-field="title"]' ).prop( 'disabled' ); }
	/**
	 * Synchronize one numeric Service field with its range control.
	 *
	 * Non-price sliders expand to represent an existing value above their normal
	 * visual range. The price slider remains the product-defined 0-1000 control;
	 * its number field can still preserve and submit a legacy value above 1000.
	 *
	 * @param {string} field_id Service field identifier.
	 * @return {void}
	 */
	function sync_numeric_range( field_id ) {
		var $field = $( '[data-service-field="' + field_id + '"]' );
		var $range = $( '[data-service-range-field="' + field_id + '"]' );
		var value = Number( $field.val() );
		var default_min = Number( $range.data( 'service-range-default-min' ) );
		var default_max = Number( $range.data( 'service-range-default-max' ) );
		var step = Number( $range.attr( 'step' ) || 1 );
		var range_max;

		if ( ! $field.length || ! $range.length || ! isFinite( value ) ) { return; }
		default_min = isFinite( default_min ) ? default_min : 0;
		default_max = isFinite( default_max ) ? default_max : 100;
		step = isFinite( step ) && step > 0 ? step : 1;
		range_max = 'base_cost' === field_id || value <= default_max
			? default_max
			: default_min + ( Math.ceil( ( value - default_min ) / step ) * step );
		$range.attr( { min: default_min, max: range_max } ).val( value );
	}
	/**
	 * Synchronize every numeric Service field with its range control.
	 *
	 * @return {void}
	 */
	function sync_all_numeric_ranges() {
		$( '[data-service-range-field]' ).each( function () { sync_numeric_range( String( $( this ).data( 'service-range-field' ) || '' ) ); } );
	}
	/**
	 * Synchronize the visible Status radios with the stored Service status field.
	 *
	 * @return {void}
	 */
	function sync_status_radios() {
		var status = String( $( '[data-service-field="status"]' ).val() || 'active' );
		$( '[data-service-status-choice]' ).each( function () {
			$( this ).prop( 'checked', String( $( this ).val() ) === status );
		} );
	}
	/**
	 * Synchronize the Service image preview with the readonly URL field.
	 *
	 * @return {void}
	 */
	function updateMediaPreview() {
		var pictureUrl = String( $( '[data-service-field="picture_url"]' ).val() || '' ).trim();
		var $image = $( '.wpbc_appointment_services__media_image' );
		if ( pictureUrl ) { $image.attr( 'src', pictureUrl ); } else { $image.removeAttr( 'src' ); }
		$image.prop( 'hidden', ! pictureUrl );
		$( '.wpbc_appointment_services__media_placeholder' ).prop( 'hidden', !! pictureUrl );
	}
	/** Synchronize toolbar and inspector action states with the page state. */
	function updateControls() {
		var open = state.storageReady && editorIsOpen();
		var operation_open = !! state.operation_mode && 'loading' !== state.operation_mode;
		var operation_is_review = 'bulk_review' === state.operation_mode || 'inline_review' === state.operation_mode || 'delete_review' === state.operation_mode;
		var operation_is_delete_review = 'delete_review' === state.operation_mode;
		var hasPicture = !! String( $( '[data-service-field="picture_url"]' ).val() || '' ).trim();
		var show_save = ( open || operation_open ) && 'true' === $( '#wpbc_tab_service_settings' ).attr( 'aria-selected' );
		$( '.wpbc_appointment_services__add' ).prop( 'hidden', false ).prop( 'disabled', ! state.storageReady || state.busy );
		$( '.wpbc_appointment_services__right_sidebar_footer, .wpbc_appointment_services__top_actions' ).prop( 'hidden', ! show_save );
		$( '.wpbc_appointment_services__cancel' ).prop( 'hidden', ! show_save ).prop( 'disabled', ( ! open && ! operation_open ) || state.busy );
		$( '.wpbc_appointment_services__save' ).prop( 'hidden', ! show_save || operation_open ).prop( 'disabled', ! open || state.busy );
		$( '.wpbc_appointment_services__operation_review' ).prop( 'hidden', 'bulk_edit' !== state.operation_mode ).prop( 'disabled', 'bulk_edit' !== state.operation_mode || state.busy || ! collect_bulk_changes() );
		$( '.wpbc_appointment_services__operation_apply' ).prop( 'hidden', ! operation_is_review );
		if ( ! operation_is_delete_review ) {
			$( '.wpbc_appointment_services__operation_apply' ).prop( 'disabled', ! operation_is_review || state.busy || ! state.operation_review );
		}
		$( '.wpbc_appointment_services__duplicate, .wpbc_appointment_services__archive' ).prop( 'disabled', ! open || ! state.selectedId || state.busy );
		$( '.wpbc_appointment_services__media_preview, .wpbc_appointment_services__select_image' ).prop( 'disabled', ! open || state.busy );
		$( '.wpbc_appointment_services__remove_image' ).prop( 'disabled', ! open || ! hasPicture || state.busy );
		synchronize_inline_workflow();
	}

	/** Synchronize the shared inline workflow from Service-owned state. */
	function synchronize_inline_workflow() {
		var changed_count = get_inline_changed_count();

		if ( ! inlineWorkflowController ) { return; }
		inlineWorkflowController.synchronize( {
			active: state.inline_editing,
			busy: state.busy,
			changed_count: changed_count,
			count_text: String( config.i18n.changed_rows || '%s changed rows' ).replace( '%s', changed_count ),
			has_items: 0 < state.services.length,
			lock_controls: state.inline_schema_loading || !! state.operation_mode,
			toggle_disabled: state.catalog_loading || ! state.storageReady || !! state.operation_mode,
			active_toggle_text: config.i18n.editing_rows,
			inactive_toggle_text: config.catalog && config.catalog.i18n ? config.catalog.i18n.edit_rows : ''
		} );
	}
	/**
	 * Stop page-changing catalog controls while a pending operation owns row state.
	 *
	 * Summary elements do not honor the disabled property, so this capture guard
	 * complements the visual disabled state while Service inline or bulk editing is active.
	 *
	 * @param {Event} event Captured catalog event.
	 * @return {void}
	 */
	function protect_inline_drafts_from_catalog_controls( event ) {
		var protected_control;

		if ( inlineWorkflowController && inlineWorkflowController.protect_event( event, state.inline_editing || state.inline_schema_loading || !! state.operation_mode ) ) { return; }
		if ( ( ! state.inline_editing && ! state.inline_schema_loading && ! state.operation_mode ) || ! event.target || ! event.target.closest ) { return; }
		protected_control = event.target.closest( '.wpbc_appointment_services__status_filter, #wpbc_service_provider_filter, .wpbc_appointment_services__add' );
		if ( ! protected_control ) { return; }
		event.preventDefault();
		event.stopImmediatePropagation();
	}
	/** Mark the page busy during a mutating request and refresh controls. */
	function setBusy( value ) { state.busy = value; $( '.wpbc_appointment_services_page' ).toggleClass( 'is-busy', value ); updateControls(); }
	/** Enable or disable all fields in the Service inspector. */
	function setFieldsEnabled( enabled ) { $( '[data-service-field], [data-service-range-field], [data-service-status-choice]' ).prop( 'disabled', ! enabled ); updateControls(); }
	/** Return defaults for a new unsaved Service. */
	function blankService() {
		return { service_id: 0, title: '', description: '', picture_url: '', status: 'active', duration_minutes: 30, buffer_before_minutes: 0, buffer_after_minutes: 0, base_cost: '0.00', booking_form_id: 0, resource_ids: ( config.default_provider_ids || [] ).slice() };
	}
	/**
	 * Render the Service-owned create or edit inspector header template.
	 *
	 * Existing Service fields remain in their native collapsible groups so the
	 * template changes presentation without moving domain validation to shared code.
	 *
	 * @param {boolean} is_edit Whether an existing Service is being edited.
	 * @return {void}
	 */
	function render_inspector_header( is_edit ) {
		var template_id = is_edit ? 'wpbc-appointment-service-inspector-edit' : 'wpbc-appointment-service-inspector-create';
		var template = catalogTemplate( template_id );
		var $header = $( '[data-wpbc-appointment-service-inspector-header]' );
		var context = is_edit
			? String( config.i18n.inspector_context_id || 'ID: %d' ).replace( '%d', String( state.selectedId ) )
			: String( config.i18n.inspector_context_new || 'New' );

		if ( ! template || ! $header.length ) {
			return;
		}

		$header.html( template( {
			title: is_edit ? config.i18n.edit_service_title : config.i18n.create_service_title,
			context: context,
			description: is_edit ? config.i18n.edit_service_description : config.i18n.create_service_description
		} ) );
	}
	/** Populate the inspector from a normalized Service response. */
	function fillEditor( service ) {
		service = $.extend( blankService(), service || {} );
		state.selectedId = Number( service.service_id || 0 );
		render_inspector_header( 0 < state.selectedId );
		$.each( service, function ( key, value ) { $( '[data-service-field="' + key + '"]' ).val( value ); } );
		sync_status_radios();
		sync_all_numeric_ranges();
		updateMediaPreview();
		setFieldsEnabled( state.storageReady );
		$( '.wpbc_appointment_services__item' ).removeClass( 'is-inspector-selected' ).attr( 'aria-current', 'false' );
		$( '.wpbc_appointment_services__item[data-service-id="' + state.selectedId + '"]' ).addClass( 'is-inspector-selected' ).attr( 'aria-current', 'true' );
		capture_editor_snapshot();
	}
	/** Collect the current Service inspector values for saving. */
	function collectEditor() {
		var service = { service_id: state.selectedId };
		$( '[data-service-field]' ).each( function () { service[ $( this ).data( 'service-field' ) ] = $( this ).val(); } );
		return service;
	}
	/**
	 * Store the current editor values as the last loaded or saved state.
	 *
	 * @return {void}
	 */
	function capture_editor_snapshot() {
		state.editor_snapshot = JSON.stringify( collectEditor() );
	}
	/**
	 * Determine whether the open Service editor contains unsaved changes.
	 *
	 * @return {boolean} True when current fields differ from the captured state.
	 */
	function is_editor_dirty() {
		return editorIsOpen() && state.editor_snapshot !== JSON.stringify( collectEditor() );
	}
	/**
	 * Confirm before replacing an editor that contains unsaved Service changes.
	 *
	 * @return {boolean} True when replacing the current editor may continue.
	 */
	function can_replace_editor() {
		return ! is_editor_dirty() || w.confirm( config.i18n.confirm_discard || 'Discard unsaved Service changes?' );
	}
	/**
	 * Determine whether the current Service operation contains unapplied values.
	 *
	 * Inline drafts and signed review screens remain dirty until they are
	 * explicitly applied or discarded. This prevents an outside click from
	 * silently replacing a reviewed mutation.
	 *
	 * @return {boolean} True when closing would discard pending changes.
	 */
	function is_operation_dirty() {
		if ( 'bulk_edit' === state.operation_mode ) {
			return !! collect_bulk_changes();
		}

		if ( 'inline_review' === state.operation_mode || 'bulk_review' === state.operation_mode || 'delete_review' === state.operation_mode ) {
			return !! state.operation_review;
		}

		return state.inline_editing && 0 < get_inline_changed_count();
	}
	/**
	 * Clear the Service editor after its native sidebar has been closed.
	 *
	 * Invalidating the request sequence prevents a late load response from
	 * reopening an inspector that the user already dismissed.
	 *
	 * @return {void}
	 */
	function reset_service_editor() {
		var service = blankService();

		state.editor_request_sequence += 1;
		state.selectedId = 0;
		state.requested_focus = '';
		state.focus_handled = true;
		render_inspector_header( false );
		$.each( service, function ( key, value ) { $( '[data-service-field="' + key + '"]' ).val( value ); } );
		sync_status_radios();
		sync_all_numeric_ranges();
		updateMediaPreview();
		setFieldsEnabled( false );
		$( '.wpbc_appointment_services__item' ).removeClass( 'is-inspector-selected' ).attr( 'aria-current', 'false' );
		capture_editor_snapshot();
		updateUrl( 0 );
	}
	/**
	 * Clear a Service inline or bulk operation without changing selection.
	 *
	 * @param {boolean} restore_inline Whether inline rows should return to presentation mode.
	 * @return {void}
	 */
	function reset_operation( restore_inline ) {
		state.operation_request_sequence += 1;
		state.operation_mode = '';
		state.operation_review = null;
		$( '[data-wpbc-appointment-services-operation-host]' ).empty().prop( 'hidden', true );
		$( '[data-wpbc-appointment-services-native-inspector]' ).prop( 'hidden', false );
		$( '.wpbc_appointment_services__operation_apply' )
			.removeClass( 'wpbc_ui_catalog_delete_review__apply button-secondary is-busy' )
			.addClass( 'button-primary' )
			.removeAttr( 'aria-busy form' )
			.text( config.i18n.apply_changes || 'Apply changes' );
		if ( restore_inline ) {
			state.inline_editing = false;
			state.inline_drafts = {};
			state.inline_schema = {};
			state.inline_schema_loading = false;
			state.inline_request_sequence += 1;
			$( '[data-wpbc-appointment-services-inline-bar-host]' ).empty();
			if ( state.last_response ) {
				renderCatalogResponse( state.last_response );
			}
		}
		setBusy( false );
	}
	/**
	 * Close the Service inspector using the Booking Resources lifecycle.
	 *
	 * @param {boolean} confirm_discard Whether to confirm unsaved changes.
	 * @param {boolean} hide_sidebar    Whether this function must hide the native sidebar.
	 * @return {boolean} True when the inspector was closed.
	 */
	function close_service_inspector( confirm_discard, hide_sidebar ) {
		var focus_target = state.inspector_focus_target;

		if ( state.mutation_in_progress ) {
			return false;
		}

		if ( state.operation_mode ) {
			if ( confirm_discard && is_operation_dirty() && ! w.confirm( config.i18n.confirm_discard || 'Discard unsaved Service changes?' ) ) {
				return false;
			}
			reset_operation( true );
			state.inspector_focus_target = null;
			if ( hide_sidebar && 'function' === typeof w.wpbc_admin_ui__sidebar_right__do_hide ) {
				w.wpbc_admin_ui__sidebar_right__do_hide();
			}
			notify_setup_wizard_layout_changed();
			if ( hide_sidebar && focus_target && document.documentElement.contains( focus_target ) && 'function' === typeof focus_target.focus ) {
				focus_target.focus();
			}
			return true;
		}

		if ( confirm_discard && ! can_replace_editor() ) {
			return false;
		}

		reset_service_editor();
		state.inspector_focus_target = null;
		if ( hide_sidebar && 'function' === typeof w.wpbc_admin_ui__sidebar_right__do_hide ) {
			w.wpbc_admin_ui__sidebar_right__do_hide();
		}
		notify_setup_wizard_layout_changed();
		if ( hide_sidebar && focus_target && document.documentElement.contains( focus_target ) && 'function' === typeof focus_target.focus ) {
			focus_target.focus();
		}

		return true;
	}
	/** Reflect the selected Service in the admin URL without reloading. */
	function updateUrl( serviceId ) {
		if ( ! w.history || ! w.URL ) { return; }
		var url = new w.URL( w.location.href );
		if ( serviceId ) { url.searchParams.set( 'service_id', serviceId ); } else { url.searchParams.delete( 'service_id' ); }
		w.history.replaceState( {}, '', url.toString() );
	}
	/** Index Provider presentation records by booking resource ID. */
	function indexProviders( providers ) {
		state.providers = {};
		$.each( providers || [], function ( index, provider ) { state.providers[ String( provider.id ) ] = provider; } );
	}
	/** Update status and Provider counters above the Service table. */
	function updateSummary( counts, providerCount ) {
		counts = $.extend( { all: 0, active: 0, inactive: 0, archived: 0 }, counts || {} );
		state.providerCount = Number( providerCount || 0 );
		$.each( counts, function ( status, count ) { $( '[data-service-count="' + status + '"]' ).text( Number( count || 0 ) ); } );
		$( '[data-provider-count]' ).text( state.providerCount );
		$( '.wpbc_appointment_services__provider_notice' ).prop( 'hidden', 0 !== state.providerCount );
	}
	/** Format a normalized Service cost using the configured currency symbol. */
	function formatCost( cost ) {
		var amount = Number( cost || 0 );
		var symbol = config.currency_symbol || '$';
		return symbol + amount.toFixed( 2 );
	}
	/** Build compact Provider avatar nodes for one Service row. */
	function providerNodes( service ) {
		var ids = $.map( service.resource_ids || [], function ( value ) { return Number( value || 0 ); } );
		var $stack = $( '<div>', { 'class': 'wpbc_appointment_services__provider_stack' } );
		if ( ! ids.length ) { return $( '<span>', { 'class': 'wpbc_appointment_services__no_provider', text: config.i18n.no_provider || 'No Providers assigned' } ); }
		$.each( ids.slice( 0, 3 ), function ( index, id ) {
			var provider = state.providers[ String( id ) ] || { id: id, title: 'Provider #' + id, initials: 'P', avatar_url: '' };
			var has_availability = false !== provider.has_weekly_availability;
			var provider_title = provider.title || 'Provider #' + id;
			var avatar_title = provider_title;
			var avatar_attributes;
			var $avatar;

			if ( ! has_availability ) { avatar_title += ' — ' + ( config.i18n.no_availability || 'No weekly availability' ); }
			avatar_attributes = {
				'class': 'wpbc_appointment_services__provider_avatar' + ( has_availability ? '' : ' has-no-availability' ),
				title: avatar_title
			};
			if ( provider.availability_url ) {
				avatar_title = String( config.i18n.edit_availability || 'Edit availability for %s' ).replace( '%s', provider_title );
				avatar_attributes.href = provider.availability_url;
				avatar_attributes.title = avatar_title;
				avatar_attributes[ 'aria-label' ] = avatar_title;
				$avatar = $( '<a>', avatar_attributes );
			} else {
				$avatar = $( '<span>', avatar_attributes );
			}
			if ( provider.avatar_url ) { $( '<img>', { src: provider.avatar_url, alt: '', loading: 'lazy' } ).appendTo( $avatar ); }
			else { $avatar.text( provider.initials || 'P' ); }
			$stack.append( $avatar );
		} );
		if ( ids.length > 3 ) { $( '<span>', { 'class': 'wpbc_appointment_services__provider_more', text: '+' + ( ids.length - 3 ), title: ( ids.length - 3 ) + ' ' + ( config.i18n.more_providers || 'more Providers' ) } ).appendTo( $stack ); }
		return $stack;
	}
	/**
	 * Build the Service thumbnail used in the management table.
	 *
	 * @param {Object} service Normalized Service response.
	 * @return {jQuery} Thumbnail wrapper containing an image or placeholder icon.
	 */
	function serviceThumbnailNode( service ) {
		var pictureUrl = String( service.picture_url || '' ).trim();
		var service_title = String( service.title || config.i18n.untitled || 'Untitled Service' );
		var service_description = String( service.description || '' ).trim() || config.i18n.no_description || 'No description';
		var tooltip_format = String( config.i18n.service_thumbnail_tooltip || 'Title: %1$s\nDescription: %2$s' );
		var tooltip_text = tooltip_format.replace( '%1$s', service_title ).replace( '%2$s', service_description );
		var $thumbnail = $( '<span>', {
			'class': 'wpbc_ui_listing__table_icon wpbc_appointment_services__service_thumbnail tooltip_top',
			'data-original-title': tooltip_text,
			'aria-label': tooltip_text,
			role: 'img',
			tabindex: '0'
		} );
		if ( pictureUrl ) {
			$( '<img>', { src: pictureUrl, alt: '', loading: 'lazy', decoding: 'async' } ).appendTo( $thumbnail );
		} else {
			$( '<i>', { 'class': 'menu_icon icon-1x wpbc-bi-image-fill', 'aria-hidden': 'true' } ).appendTo( $thumbnail );
		}
		return $thumbnail;
	}
	/**
	 * Destroy Service thumbnail tooltips before AJAX replaces their elements.
	 *
	 * @return {void}
	 */
	function destroy_service_thumbnail_tooltips() {
		$( '.wpbc_appointment_services__service_thumbnail' ).each( function () {
			if ( this._tippy && 'function' === typeof this._tippy.destroy ) {
				this._tippy.destroy();
			}
		} );
	}
	/**
	 * Initialize Service thumbnail tooltips after an AJAX listing render.
	 *
	 * The native title attribute is used only when the Booking Calendar Tippy
	 * helper is unavailable, avoiding duplicate browser and Tippy tooltips.
	 *
	 * @return {void}
	 */
	function refresh_service_thumbnail_tooltips() {
		var listing_selector = '#wpbc_appointment_services_catalog ';
		var $thumbnails = $( listing_selector + '.wpbc_appointment_services__service_thumbnail' );
		var tooltips_initialized = false;

		if ( 'function' === typeof w.wpbc_define_tippy_tooltips ) {
			tooltips_initialized = w.wpbc_define_tippy_tooltips( listing_selector );
		}
		if ( tooltips_initialized ) {
			return;
		}
		$thumbnails.each( function () {
			$( this ).attr( 'title', $( this ).attr( 'data-original-title' ) || '' );
		} );
	}
	/**
	 * Build the compact duration and before/after buffer summary for one Service.
	 *
	 * @param {Object} service Normalized Service response.
	 * @return {jQuery} Duration details wrapper for the listing column.
	 */
	function service_duration_node( service ) {
		var duration_minutes = Math.max( 0, Number( service.duration_minutes || 0 ) );
		var buffer_before_minutes = Math.max( 0, Number( service.buffer_before_minutes || 0 ) );
		var buffer_after_minutes = Math.max( 0, Number( service.buffer_after_minutes || 0 ) );
		var duration_format = String( config.i18n.duration_minutes || '%s min' );
		var buffers_format = String( config.i18n.buffers_summary || 'Buffers: %1$s / %2$s min' );
		var buffers_tooltip_format = String( config.i18n.buffers_tooltip || 'Buffer before: %1$s min; Buffer after: %2$s min' );
		var buffers_summary = buffers_format.replace( '%1$s', buffer_before_minutes ).replace( '%2$s', buffer_after_minutes );
		var buffers_tooltip = buffers_tooltip_format.replace( '%1$s', buffer_before_minutes ).replace( '%2$s', buffer_after_minutes );
		var $duration_details = $( '<span>', { 'class': 'wpbc_appointment_services__duration_details' } );

		$( '<strong>', {
			'class': 'wpbc_appointment_services__duration_value',
			text: duration_format.replace( '%s', duration_minutes )
		} ).appendTo( $duration_details );
		$( '<span>', {
			'class': 'wpbc_appointment_services__buffers_summary',
			text: buffers_summary,
			title: buffers_tooltip,
			'aria-label': buffers_tooltip
		} ).appendTo( $duration_details );

		return $duration_details;
	}
	/**
	 * Return assigned Providers with recurring availability on one weekday.
	 *
	 * @param {Object} service Normalized Service response.
	 * @param {string} day Weekday key from mon through sun.
	 * @return {Array<Object>} Matching Provider presentation records.
	 */
	function providers_available_on( service, day ) {
		var available_providers = [];
		$.each( service.resource_ids || [], function ( index, id ) {
			var provider = state.providers[ String( Number( id || 0 ) ) ];
			if ( provider && provider.weekdays && provider.weekdays[ day ] ) {
				available_providers.push( provider );
			}
		} );

		return available_providers;
	}
	/**
	 * Build compact Provider-specific links below the weekly availability dots.
	 *
	 * @param {Object} service Normalized Service response.
	 * @return {jQuery} Availability links, or an empty collection when unavailable.
	 */
	function availability_edit_links( service ) {
		var $links = $( '<div>', {
			'class': 'wpbc_appointment_services__availability_links',
			'aria-label': config.i18n.edit_provider_availability || 'Edit Provider availability'
		} );

		$.each( service.resource_ids || [], function ( index, id ) {
			var provider = state.providers[ String( Number( id || 0 ) ) ];
			var provider_title;
			var link_title;

			if ( ! provider || ! provider.availability_url ) {
				return;
			}
			provider_title = provider.title || 'Provider #' + Number( id || 0 );
			link_title = String( config.i18n.edit_availability || 'Edit availability for %s' ).replace( '%s', provider_title );
			$( '<a>', {
				'class': 'wpbc_appointment_services__availability_link',
				href: provider.availability_url,
				text: provider.initials || 'P',
				title: link_title,
				'aria-label': link_title
			} ).appendTo( $links );
		} );

		return $links.children().length ? $links : $();
	}
	/** Convert a stored Service status to its translated UI label. */
	function statusLabel( status ) {
		if ( 'inactive' === status ) { return config.i18n.draft || 'Draft'; }
		if ( 'archived' === status ) { return config.i18n.archived || 'Archived'; }
		return config.i18n.active || 'Active';
	}
	/** Format the translated table pagination summary. */
	function showingText( from, to, total ) {
		var format = config.i18n.showing || 'Showing %1$s-%2$s of %3$s Services';
		return format.replace( '%1$s', from ).replace( '%2$s', to ).replace( '%3$s', total );
	}
	/** Return one compiled, allow-listed WordPress template. */
	function catalogTemplate( templateId ) {
		try { return templateId && w.wp && 'function' === typeof w.wp.template ? w.wp.template( templateId ) : null; }
		catch ( error ) { return null; }
	}
	/**
	 * Return the shared native inspector state workflow for Service operations.
	 *
	 * @return {Object|false} Shared inspector workflow or false.
	 */
	function get_operation_inspector_workflow() {
		var template_id;

		if ( inspectorWorkflowController ) { return inspectorWorkflowController; }
		if ( ! w.wpbc_ui_catalog || 'function' !== typeof w.wpbc_ui_catalog.create_inspector_workflow ) { return false; }
		template_id = config.catalog && config.catalog.templates ? config.catalog.templates.inspector : '';
		inspectorWorkflowController = w.wpbc_ui_catalog.create_inspector_workflow( {
			expand: function () {
				$( '[data-wpbc-appointment-services-operation-host]' ).prop( 'hidden', false );
				$( '[data-wpbc-appointment-services-native-inspector]' ).prop( 'hidden', true );
				expand_service_inspector();
			},
			get_footer: function () { return document.querySelector( '.wpbc_appointment_services__right_sidebar_footer' ); },
			get_host: function () { return document.querySelector( '[data-wpbc-appointment-services-operation-host]' ); },
			render_shell: function ( shell_data ) {
				var shell_template = catalogTemplate( template_id );

				return shell_template ? shell_template( shell_data ) : '';
			},
			shell_data: {
				catalog_id: config.catalog && config.catalog.id ? config.catalog.id : 'appointment_services_catalog',
				empty_icon: 'wpbc-bi-pencil-square',
				empty_message: '',
				empty_title: '',
				loading_label: config.i18n.loading || ''
			}
		} );

		return inspectorWorkflowController;
	}
	/** Return safe HTML from a detached jQuery presentation node. */
	function nodeHtml( $node ) { return $node && $node.length ? $( '<div>' ).append( $node ).html() : ''; }
	/**
	 * Return the shared selection controller mounted for the Services catalog.
	 *
	 * @return {Object|null} Shared selection controller, or null before mount.
	 */
	function get_selection_controller() {
		var mount = document.getElementById( 'wpbc_appointment_services_catalog' );

		return mount && mount._wpbc_ui_catalog_selection_controller ? mount._wpbc_ui_catalog_selection_controller : null;
	}
	/**
	 * Return selected Service identifiers without exposing selection internals.
	 *
	 * @return {Array<number>} Persisted selected Service identifiers.
	 */
	function get_selected_service_ids() {
		var selection = get_selection_controller();

		return selection && 'function' === typeof selection.get_selected_ids ? selection.get_selected_ids() : [];
	}
	/**
	 * Return one Service from the last normalized catalog response.
	 *
	 * @param {number|string} service_id Service identifier to find.
	 * @return {Object|null} Matching Service DTO, or null when not on this page.
	 */
	function find_service( service_id ) {
		var found = null;

		$.each( state.services, function ( index, service ) {
			if ( Number( service.service_id || service.id || 0 ) === Number( service_id ) ) {
				found = service;
				return false;
			}
		} );

		return found;
	}
	/**
	 * Return the allow-listed initial inline draft for one Service.
	 *
	 * Provider assignments, status, and buffers are deliberately omitted because
	 * they require the reviewed bulk inspector or the complete Service inspector.
	 *
	 * @param {Object} row_schema Server-authoritative row schema.
	 * @return {Object} Editable row-specific draft.
	 */
	function create_inline_draft( row_schema ) {
		var draft = {};

		$.each( row_schema && Array.isArray( row_schema.fields ) ? row_schema.fields : [], function ( index, field ) {
			var field_key = String( field && field.key ? field.key : '' );
			if ( field_key ) { draft[ field_key ] = String( field.value ); }
		} );

		return draft;
	}
	/** Return one cached server-authoritative inline row schema. */
	function find_inline_schema( service_id ) {
		return state.inline_schema[ String( Number( service_id || 0 ) ) ] || null;
	}
	/**
	 * Return whether one inline draft differs from its current Service DTO.
	 *
	 * @param {Object|null} row_schema Current server-authoritative row schema.
	 * @param {Object|null} draft   Row-specific inline draft.
	 * @return {boolean} True when at least one allow-listed value changed.
	 */
	function inline_draft_changed( row_schema, draft ) {
		var changed = false;

		if ( ! row_schema || ! draft ) { return false; }
		$.each( Array.isArray( row_schema.fields ) ? row_schema.fields : [], function ( index, field ) {
			if ( String( field.value ) !== String( draft[ field.key ] ) ) {
				changed = true;
				return false;
			}
		} );

		return changed;
	}
	/**
	 * Return changed inline drafts keyed by Service ID.
	 *
	 * @return {Object<string,Object>} Changed drafts keyed by Service identifier.
	 */
	function collect_inline_changes() {
		var changes = {};

		$.each( state.inline_drafts, function ( service_id, draft ) {
			var row_schema = find_inline_schema( service_id );
			var row_changes = {};

			$.each( row_schema && Array.isArray( row_schema.fields ) ? row_schema.fields : [], function ( index, field ) {
				if ( String( field.value ) !== String( draft[ field.key ] ) ) {
					row_changes[ field.key ] = draft[ field.key ];
				}
			} );
			if ( Object.keys( row_changes ).length ) {
				changes[ service_id ] = row_changes;
			}
		} );

		return changes;
	}
	/**
	 * Return the count of changed Service rows in inline mode.
	 *
	 * @return {number} Number of row drafts that differ from their DTOs.
	 */
	function get_inline_changed_count() { return Object.keys( collect_inline_changes() ).length; }
	/**
	 * Render and register the sticky inline-editing status bar.
	 *
	 * Registration delegates viewport positioning to the shared selection
	 * controller so the Service page follows the Resource catalog behavior.
	 *
	 * @return {void}
	 */
	function render_inline_bar() {
		var template = catalogTemplate( 'wpbc-appointment-services-inline-bar' );
		var changed_count = get_inline_changed_count();
		var $host = $( '[data-wpbc-appointment-services-inline-bar-host]' );

		if ( ! template || ! $host.length ) { return; }
		if ( ! $host.children().length ) {
			$host.html( template( {
				title: config.i18n.editing_rows,
				changed_label: String( config.i18n.changed_rows || '%s changed rows' ).replace( '%s', changed_count ),
				description: config.i18n.inline_help,
				cancel: config.i18n.cancel,
				review: config.i18n.review_changes,
				changed_count: changed_count
			} ) );
		}
		synchronize_inline_bar();
	}
	/**
	 * Synchronize the inline bar without replacing its active controls.
	 *
	 * A focused inline field emits its final change event while the Review
	 * button is being clicked. Replacing the bar from that change handler would
	 * remove the pointer target before the click event can complete.
	 *
	 * @return {void}
	 */
	function synchronize_inline_bar() {
		var changed_count = get_inline_changed_count();
		var $bar = $( '[data-wpbc-appointment-services-inline-bar]' );

		if ( ! $bar.length ) { return; }
		$bar.find( '[data-wpbc-appointment-services-inline-changed-label]' ).text(
			String( config.i18n.changed_rows || '%s changed rows' ).replace( '%s', changed_count )
		);
		synchronize_inline_workflow();
	}
	/**
	 * Start row-specific inline editing for the current catalog page.
	 *
	 * Drafts intentionally cover the current page only. Page-changing controls
	 * remain protected until the user cancels or completes the reviewed change.
	 *
	 * @return {void}
	 */
	function start_inline_editing() {
		var request_sequence;
		var visible_ids;

		if ( state.busy || state.catalog_loading || state.operation_mode ) { return; }
		if ( state.inline_editing ) {
			cancel_inline_editing( true );
			return;
		}
		if ( ! state.services.length ) { return; }
		if ( ! can_replace_editor() ) { return; }
		if ( editorIsOpen() ) { reset_service_editor(); }
		visible_ids = $.map( state.services, function ( service ) { return Number( service.service_id || service.id || 0 ); } );
		request_sequence = ++state.inline_request_sequence;
		state.inline_editing = false;
		state.inline_drafts = {};
		state.inline_schema = {};
		state.inline_schema_loading = true;
		setBusy( true );
		request( config.actions.inline_schema, { ids: JSON.stringify( visible_ids ) } ).done( function ( response ) {
			var schema = response && response.success && response.data ? response.data.schema : null;

			if ( request_sequence !== state.inline_request_sequence ) { return; }
			if ( ! schema || ! Array.isArray( schema.rows ) ) {
				notify( messageFrom( response, config.i18n.inline_schema_failed ), 'error' );
				return;
			}
			$.each( schema.rows, function ( index, row_schema ) {
				var service_id = String( Number( row_schema.service_id || 0 ) );
				if ( '0' === service_id || ! Array.isArray( row_schema.fields ) || ! row_schema.fields.length ) { return; }
				state.inline_schema[ service_id ] = row_schema;
				state.inline_drafts[ service_id ] = create_inline_draft( row_schema );
			} );
			if ( ! Object.keys( state.inline_drafts ).length ) {
				notify( config.i18n.inline_schema_failed, 'error' );
				return;
			}
			state.inline_editing = true;
			renderCatalogResponse( state.last_response );
			render_inline_bar();
			$( '[data-wpbc-appointment-services-inline-field]' ).first().trigger( 'focus' );
		} ).fail( function ( xhr ) {
			if ( request_sequence === state.inline_request_sequence ) {
				notify( messageFrom( xhr.responseJSON, config.i18n.inline_schema_failed ), 'error' );
			}
		} ).always( function () {
			if ( request_sequence === state.inline_request_sequence ) {
				state.inline_schema_loading = false;
				setBusy( false );
			}
		} );
	}
	/**
	 * Cancel Service inline editing and restore focus to its toolbar action.
	 *
	 * The stable shared data attribute is the interaction contract. Keeping the
	 * cancellation in this domain adapter preserves ownership of Service drafts
	 * while preventing surrounding page and sidebar click handlers from deciding
	 * whether those drafts should be discarded.
	 *
	 * @param {boolean} confirm_discard Whether changed drafts need confirmation.
	 * @return {boolean} True when inline editing was cancelled.
	 */
	function cancel_inline_editing( confirm_discard ) {
		var focus_target = document.querySelector( '[data-wpbc-ui-catalog-inline-toggle]' );

		if ( state.mutation_in_progress ) { return false; }
		if ( confirm_discard && get_inline_changed_count() && ! w.confirm( config.i18n.confirm_discard || 'Discard unsaved Service changes?' ) ) {
			return false;
		}
		reset_operation( true );
		if ( focus_target && document.documentElement.contains( focus_target ) && 'function' === typeof focus_target.focus ) {
			focus_target.focus();
		}

		return true;
	}
	/**
	 * Return enabled values from the Service bulk editor.
	 *
	 * @return {Object<string,string>|null} Shared changes, or null when none enabled.
	 */
	function collect_bulk_changes() {
		var changes = {};

		$( '[data-wpbc-appointment-services-bulk-enable]:checked' ).each( function () {
			var field_id = String( $( this ).data( 'wpbc-appointment-services-bulk-enable' ) || '' );
			var $field = $( '[data-wpbc-appointment-services-bulk-value="' + field_id + '"]' );
			if ( field_id && $field.length ) { changes[ field_id ] = $field.val(); }
		} );

		return Object.keys( changes ).length ? changes : null;
	}
	/**
	 * Open a Service-owned operation inside the native right inspector.
	 *
	 * @param {string}      mode          Operation state identifier.
	 * @param {string}      template_id   Allow-listed WordPress template ID.
	 * @param {Object}      template_data Presentation data for the template.
	 * @param {HTMLElement} focus_target  Element that should regain focus on close.
	 * @return {boolean} True when the operation template was opened.
	 */
	function open_operation( mode, template_id, template_data, focus_target ) {
		var inspector_workflow = get_operation_inspector_workflow();
		var template = catalogTemplate( template_id );
		var $host = $( '[data-wpbc-appointment-services-operation-host]' );
		var rendered_operation;
		var target;

		if ( ! template || ! $host.length || ! inspector_workflow || ! inspector_workflow.mount() ) {
			state.operation_mode = '';
			state.operation_review = null;
			updateControls();
			notify( config.i18n.operation_failed || config.i18n.load_failed, 'error' );
			return false;
		}

		try {
			rendered_operation = template( template_data );
		} catch ( error ) {
			state.operation_mode = '';
			state.operation_review = null;
			$host.empty().prop( 'hidden', true );
			$( '[data-wpbc-appointment-services-native-inspector]' ).prop( 'hidden', false );
			updateControls();
			notify( config.i18n.operation_failed || config.i18n.load_failed, 'error' );
			return false;
		}

		state.operation_mode = mode;
		state.inspector_focus_target = focus_target || document.activeElement;
		target = inspector_workflow.get_form_target();
		if ( ! target ) {
			state.operation_mode = '';
			state.operation_review = null;
			inspector_workflow.set_state( 'error', config.i18n.operation_failed || config.i18n.load_failed );
			updateControls();
			notify( config.i18n.operation_failed || config.i18n.load_failed, 'error' );
			return false;
		}
		target.innerHTML = rendered_operation;
		inspector_workflow.set_state( 'form', '' );
		$host.prop( 'hidden', false );
		$( '[data-wpbc-appointment-services-native-inspector]' ).prop( 'hidden', true );
		expand_service_inspector();
		updateControls();
		$host.find( '[data-wpbc-ui-catalog-delete-review-heading], [data-wpbc-ui-catalog-inline-review-heading], h2' ).first().attr( 'tabindex', '-1' ).trigger( 'focus' );

		return true;
	}
	/**
	 * Open bulk editing for the current persistent Service selection.
	 *
	 * @param {HTMLElement} focus_target Element that opened the bulk inspector.
	 * @return {void}
	 */
	function open_bulk_edit( focus_target ) {
		var selected_ids = get_selected_service_ids();

		if ( ! selected_ids.length || state.busy || state.inline_editing ) { return; }
		if ( ! can_replace_editor() ) { return; }
		if ( editorIsOpen() ) { reset_service_editor(); }
		setBusy( true );
		request( config.actions.bulk_contract, { ids: JSON.stringify( selected_ids ) } ).done( function ( response ) {
			var contract = response && response.success && response.data ? response.data.contract : null;

			if ( ! contract || ! Array.isArray( contract.fields ) || ! contract.fields.length ) {
				notify( messageFrom( response, config.i18n.bulk_contract_failed ), 'error' );
				return;
			}
			open_operation( 'bulk_edit', 'wpbc-appointment-services-bulk-edit', {
				title: config.i18n.bulk_edit_title,
				description: contract.message || config.i18n.bulk_edit_description,
				fields: contract.fields
			}, focus_target );
		} ).fail( function ( xhr ) {
			notify( messageFrom( xhr.responseJSON, config.i18n.bulk_contract_failed ), 'error' );
		} ).always( function () { setBusy( false ); } );
	}
	/**
	 * Render a signed inline or bulk review in the Service inspector.
	 *
	 * The preview endpoint is non-mutating. Only the returned signed plan can be
	 * submitted to the separate apply endpoint.
	 *
	 * @param {string}      mode         Either inline or bulk.
	 * @param {Array<number>} ids        Service identifiers to review.
	 * @param {Object}      changes      Row-specific or shared field changes.
	 * @param {HTMLElement} focus_target Element that opened the review.
	 * @return {void}
	 */
	function preview_operation( mode, ids, changes, focus_target ) {
		var inspector_workflow;
		var request_sequence;

		if ( state.busy || ! ids.length || ! changes ) { return; }
		inspector_workflow = get_operation_inspector_workflow();
		request_sequence = ++state.operation_request_sequence;
		state.operation_mode = 'loading';
		state.operation_review = null;
		state.inspector_focus_target = focus_target || document.activeElement;
		if ( ! inspector_workflow || ! inspector_workflow.open_loading() ) {
			reset_operation( false );
			notify( config.i18n.operation_failed || config.i18n.preview_failed, 'error' );
			return;
		}
		setBusy( true );
		request( config.actions.preview, {
			mode: mode,
			ids: JSON.stringify( ids ),
			changes: JSON.stringify( changes )
		}, false ).done( function ( response ) {
			var review = response && response.success ? response.data : null;
			var review_workflow = get_inline_review_workflow();
			var review_rows;
			var review_model;
			var template_id = 'inline' === mode ? 'wpbc-appointment-services-inline-review' : 'wpbc-appointment-services-bulk-review';
			if ( request_sequence !== state.operation_request_sequence ) { return; }
			if ( ! review || ! review.plan || ! review.token ) {
				var error_message = messageFrom( response, config.i18n.preview_failed );
				inspector_workflow.set_state( 'error', error_message );
				notify( error_message, 'error' );
				return;
			}
			state.operation_review = review;
			review_rows = review.review && Array.isArray( review.review.rows ) ? review.review.rows : [];
			review_model = review_workflow ? review_workflow.prepare( review.review || {}, {
				changed_label: String( config.i18n.changed_rows || '%s changed rows' ).replace( '%s', String( review_rows.length ) ),
				description: config.i18n.review_confirmation || '',
				form_id: 'wpbc_appointment_services_' + mode + '_review_form',
				mode: mode + '_review',
				pending_message: config.i18n.review_description || '',
				title: 'inline' === mode ? config.i18n.inline_review_title : config.i18n.bulk_review_title
			} ) : {};
			if ( ! open_operation( mode + '_review', template_id, review_model, focus_target ) ) {
				inspector_workflow.set_state( 'error', config.i18n.operation_failed || config.i18n.preview_failed );
				return;
			}
			if ( review_workflow ) { review_workflow.synchronize( { busy: false, can_apply: true } ); }
		} ).fail( function ( xhr ) {
			var error_message = messageFrom( xhr.responseJSON, config.i18n.preview_failed );
			if ( request_sequence !== state.operation_request_sequence ) { return; }
			state.operation_mode = 'loading';
			inspector_workflow.set_state( 'error', error_message );
			notify( error_message, 'error' );
		} ).always( function () {
			if ( request_sequence === state.operation_request_sequence ) { setBusy( false ); }
		} );
	}
	/**
	 * Open a loading inspector immediately and request a signed deletion review.
	 *
	 * @param {Array<number>} ids          Selected Service identifiers.
	 * @param {HTMLElement}   focus_target Control that opened the review.
	 * @return {void}
	 */
	function preview_deletion( ids, focus_target ) {
		var inspector_workflow;
		var request_sequence;

		ids = Array.isArray( ids ) ? ids.map( Number ).filter( function ( service_id ) { return service_id > 0; } ) : [];
		if ( state.busy || ! ids.length || state.inline_editing ) { return; }
		if ( ! can_replace_editor() ) { return; }
		if ( editorIsOpen() ) { reset_service_editor(); }
		inspector_workflow = get_operation_inspector_workflow();
		request_sequence = ++state.operation_request_sequence;
		state.operation_mode = 'loading';
		state.operation_review = null;
		state.inspector_focus_target = focus_target || document.activeElement;
		if ( ! inspector_workflow || ! inspector_workflow.open_loading() ) {
			reset_operation( false );
			notify( config.i18n.operation_failed || config.i18n.delete_preview_failed, 'error' );
			return;
		}
		setBusy( true );
		request( config.actions.delete_preview, { ids: JSON.stringify( ids ) }, false ).done( function ( response ) {
			var review = response && response.success ? response.data : null;
			var delete_review = review && review.delete_review ? review.delete_review : {};
			var delete_i18n = delete_review.i18n || {};
			var delete_workflow = get_delete_review_workflow();
			var review_model;

			if ( request_sequence !== state.operation_request_sequence ) { return; }
			if ( ! review || ! review.plan || ! review.token ) {
				inspector_workflow.set_state( 'error', messageFrom( response, config.i18n.delete_preview_failed ) );
				return;
			}
			review_model = {
				acknowledgement: String( delete_i18n.acknowledgement || '' ),
				actions_heading: String( delete_i18n.actions_heading || '' ),
				can_apply: true === review.can_apply,
				description: String( delete_i18n.description || '' ),
				id_label: String( delete_i18n.id_label || config.i18n.column_id || 'ID' ),
				items: Array.isArray( delete_review.items ) ? delete_review.items : [],
				items_heading: String( delete_i18n.items_heading || '' ),
				pending_message: String( delete_i18n.pending_message || '' ),
				selection_label: String( delete_i18n.selection_label || '' ),
				title: String( delete_i18n.title || '' ),
				warning: String( delete_review.warning || review.warning || '' )
			};
			state.operation_review = review;
			if ( ! open_operation( 'delete_review', 'wpbc-appointment-services-delete-review', review_model, focus_target ) ) {
				inspector_workflow.set_state( 'error', config.i18n.delete_preview_failed );
				return;
			}
			if ( delete_workflow ) {
				delete_workflow.configure_footer( {
					can_apply: true === review.can_apply,
					footer: document.querySelector( '.wpbc_appointment_services__right_sidebar_footer' ),
					form_id: 'wpbc_appointment_services_delete_review_form',
					label: String( delete_i18n.delete_button || '' )
				} );
				delete_workflow.synchronize( { busy: false, can_apply: true === review.can_apply } );
				if ( true === review.can_apply ) { delete_workflow.pulse_acknowledgement(); }
			}
		} ).fail( function ( xhr ) {
			var error_message = messageFrom( xhr.responseJSON, config.i18n.delete_preview_failed );
			if ( request_sequence !== state.operation_request_sequence ) { return; }
			state.operation_mode = 'loading';
			inspector_workflow.set_state( 'error', error_message );
			notify( error_message, 'error' );
		} ).always( function () {
			if ( request_sequence === state.operation_request_sequence ) { setBusy( false ); }
		} );
	}
	/**
	 * Apply the current signed Service review, then refresh the active page.
	 *
	 * Selection remains owned by the shared controller and is therefore restored
	 * after the AJAX refresh instead of being silently cleared by the mutation.
	 *
	 * @return {void}
	 */
	function apply_operation() {
		var review = state.operation_review;
		var changed_ids;
		var is_delete = 'delete_review' === state.operation_mode;
		var acknowledgement;

		if ( state.busy || ! review || ! review.plan || ! review.token ) { return; }
		if ( is_delete ) {
			acknowledgement = document.querySelector( '[data-wpbc-ui-catalog-delete-acknowledgement]' );
			if ( true !== review.can_apply || ! acknowledgement || ! acknowledgement.checked ) {
				if ( get_delete_review_workflow() ) { get_delete_review_workflow().pulse_acknowledgement(); }
				return;
			}
		}
		state.mutation_in_progress = true;
		setBusy( true );
		if ( is_delete && get_delete_review_workflow() ) { get_delete_review_workflow().synchronize( { busy: true, can_apply: true } ); }
		else if ( get_inline_review_workflow() ) { get_inline_review_workflow().synchronize( { busy: true, can_apply: true } ); }
		request( is_delete ? config.actions.delete_apply : config.actions.apply, { acknowledged: is_delete ? '1' : '', plan: JSON.stringify( review.plan ), token: review.token } ).done( function ( response ) {
			if ( ! response || ! response.success ) {
				notify( messageFrom( response, is_delete ? config.i18n.delete_apply_failed : config.i18n.apply_failed ), 'error' );
				return;
			}
			changed_ids = response.data && Array.isArray( response.data.changed_ids ) ? response.data.changed_ids.map( String ) : [];
			notify( response.data.message, 'success' );
			state.mutation_in_progress = false;
			close_service_inspector( false, true );
			pending_highlight_ids = is_delete ? [] : changed_ids;
			if ( is_delete && catalogController && 'function' === typeof catalogController.clear_selection ) { catalogController.clear_selection(); }
			if ( catalogController ) { catalogController.load( { page_number: state.page } ); }
		} ).fail( function ( xhr ) {
			notify( messageFrom( xhr.responseJSON, is_delete ? config.i18n.delete_apply_failed : config.i18n.apply_failed ), 'error' );
		} ).always( function () {
			state.mutation_in_progress = false;
			setBusy( false );
			if ( is_delete && get_delete_review_workflow() ) { get_delete_review_workflow().synchronize( { busy: false, can_apply: !! state.operation_review && true === state.operation_review.can_apply } ); }
			else if ( get_inline_review_workflow() ) { get_inline_review_workflow().synchronize( { busy: false, can_apply: !! state.operation_review } ); }
		} );
	}
	/**
	 * Highlight Services changed by the last reviewed mutation.
	 *
	 * The identifiers are retained until the refreshed catalog contains at least
	 * one affected Service. This avoids consuming the highlight while closing an
	 * operation re-renders the previous response.
	 *
	 * @return {void}
	 */
	function apply_pending_highlights() {
		var first_service = null;

		pending_highlight_ids.forEach( function ( service_id ) {
			var service = document.querySelector( '.wpbc_appointment_services__item[data-service-id="' + service_id + '"]' );

			if ( service ) {
				service.classList.add( 'is-recently-saved' );
				first_service = first_service || service;
			}
		} );
		if ( ! first_service ) {
			return;
		}
		first_service.scrollIntoView( { block: 'nearest', behavior: 'smooth' } );
		window.setTimeout( function () {
			document.querySelectorAll( '.wpbc_appointment_services__item.is-recently-saved' ).forEach( function ( service ) {
				service.classList.remove( 'is-recently-saved' );
			} );
		}, 5000 );
		pending_highlight_ids = [];
	}
	/** Return the current ordered and visible Service column definitions. */
	function responseColumns( response ) {
		var definitions = config.catalog && config.catalog.columns ? config.catalog.columns.definitions || {} : {};
		var visible = response.display && response.display.visible_columns ? response.display.visible_columns : [];
		var order = response.display && response.display.column_order ? response.display.column_order : [];
		return $.map( order, function ( columnId ) {
			var definition = definitions[ columnId ];
			var is_sorted;
			if ( ! definition || -1 === visible.indexOf( columnId ) ) { return null; }
			is_sorted = !! definition.sort_key && definition.sort_key === response.sorting.sort_by;
			return {
				aria_sort: is_sorted ? ( 'desc' === response.sorting.sort_order ? 'descending' : 'ascending' ) : 'none',
				id: columnId,
				label: definition.label || columnId,
				class_name: definition.class || 'column-' + columnId,
				is_sorted: is_sorted,
				sort_icon: is_sorted ? ( 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' ) : 'wpbc_icn_import_export',
				sort_key: definition.sort_key || ''
			};
		} );
	}
	/**
	 * Return sortable presentation records for the cards layout header.
	 *
	 * The table combines Status and Service ID in one column, so cards expand
	 * that column into two independent sort controls without changing the DTO.
	 *
	 * @param {Object} response Normalized shared catalog response.
	 * @return {Array<Object>} Visible, allow-listed cards sorting records.
	 */
	function responseSortColumns( response ) {
		var columns = [];
		$.each( responseColumns( response ), function ( columnIndex, column ) {
			if ( 'status' === column.id ) {
				columns.push( {
					is_sorted: 'status' === response.sorting.sort_by,
					label: column.label,
					sort_icon: 'status' === response.sorting.sort_by ? ( 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' ) : 'wpbc_icn_import_export',
					sort_key: 'status'
				} );
				columns.push( {
					is_sorted: 'service_id' === response.sorting.sort_by,
					label: config.i18n.column_id || 'ID',
					sort_icon: 'service_id' === response.sorting.sort_by ? ( 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' ) : 'wpbc_icn_import_export',
					sort_key: 'service_id'
				} );
				return;
			}
			if ( ! column.sort_key ) { return; }
			columns.push( {
				is_sorted: column.sort_key === response.sorting.sort_by,
				label: column.label,
				sort_icon: column.sort_key === response.sorting.sort_by ? ( 'desc' === response.sorting.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' ) : 'wpbc_icn_import_export',
				sort_key: column.sort_key
			} );
		} );
		return columns;
	}
	/**
	 * Build presentation cells for the Service-owned row and card templates.
	 *
	 * Inline drafts replace only the allow-listed editable controls. Provider,
	 * availability, status, and action presentation stays read-only.
	 *
	 * @param {Object} service Normalized Service DTO.
	 * @return {Object} Escaped HTML fragments keyed by catalog column ID.
	 */
	function serviceCells( service ) {
		var id = Number( service.service_id || service.id || 0 );
		var draft = state.inline_editing ? state.inline_drafts[ String( id ) ] : null;
		var row_schema = draft ? find_inline_schema( id ) : null;
		var inline_field_template = catalogTemplate( 'wpbc-appointment-service-inline-field' );
		var inline_cells = {};
		var title = service.title || config.i18n.untitled || 'Untitled Service';
		var description = String( service.description || '#' + id );
		var status = String( service.status || 'active' );
		var $identity = $( '<div>', { 'class': 'wpbc_appointment_services__service_identity' } );
		var identity_fields_class = draft
			? 'wpbc_appointment_services__inline_identity_fields'
			: 'wpbc_ui_listing__item_copy wpbc_appointment_services__service_copy';
		var $copy = $( '<span>', { 'class': identity_fields_class } ).appendTo( $identity );
		var $availability = $( '<div>' );
		var $availabilityWeek = $( '<div>', { 'class': 'wpbc_appointment_services__availability_week' } ).appendTo( $availability );
		var hasWeeklyAvailability = false;
		var statusTemplate = catalogTemplate( 'wpbc-appointment-service-status-label' );
		var providerTemplate = catalogTemplate( 'wpbc-appointment-service-provider-labels' );
		var $actions = $( '<div>', { 'class': 'wpbc_appointment_services__actions' } );
		if ( row_schema && inline_field_template ) {
			$.each( row_schema.fields || [], function ( field_index, field ) {
				var column_id = String( field.column || '' );
				var field_key = String( field.key || '' );
				var field_data;
				if ( ! column_id || ! field_key || ! Object.prototype.hasOwnProperty.call( draft, field_key ) ) { return; }
				field_data = $.extend( {}, field, { original_value: field.value, value: draft[ field_key ] } );
				inline_cells[ column_id ] = ( inline_cells[ column_id ] || '' ) + inline_field_template( { field: field_data, service_id: id } );
			} );
		}

		serviceThumbnailNode( service ).prependTo( $identity );
		if ( draft && inline_cells.service ) {
			$copy.append( inline_cells.service );
		} else {
			$( '<strong>', { 'class': 'wpbc_ui_listing__item_title wpbc_ui_listing__overflow_tooltip', 'data-wpbc-ui-catalog-overflow-tooltip': title, title: title, text: title } ).appendTo( $copy );
			$( '<span>', { 'class': 'wpbc_ui_listing__item_description wpbc_ui_listing__overflow_tooltip', 'data-wpbc-ui-catalog-overflow-tooltip': description, title: description, text: description } ).appendTo( $copy );
		}
		$.each( weekdayKeys, function ( dayIndex, day ) {
			var availableProviders = providers_available_on( service, day );
			var available = availableProviders.length > 0;
			var dayTitle = config.weekdays && config.weekdays[ dayIndex ] ? config.weekdays[ dayIndex ] : day;
			var providerTitles = $.map( availableProviders, function ( provider ) { return provider.title || ''; } ).filter( function ( providerTitle ) { return !! providerTitle; } );
			var availabilityTitle = available
				? String( config.i18n.available_providers || 'Available Providers: %s' ).replace( '%s', providerTitles.join( ', ' ) )
				: ( config.i18n.no_available_providers || 'No assigned Providers are available' );
			if ( available ) { hasWeeklyAvailability = true; }
			$( '<span>', { 'class': 'wpbc_appointment_services__availability' + ( available ? ' is-available' : '' ), title: dayTitle + ': ' + availabilityTitle, 'aria-label': dayTitle + ': ' + availabilityTitle } ).appendTo( $availabilityWeek );
		} );
		$availability.append( availability_edit_links( service ) );
		if ( service.resource_ids && service.resource_ids.length && ! hasWeeklyAvailability ) {
			$( '<span>', { 'class': 'wpbc_appointment_services__availability_empty', text: config.i18n.no_availability || 'No weekly availability' } ).appendTo( $availability );
		}
		$( '<button>', { type: 'button', 'class': 'button-link wpbc_appointment_services__row_edit wpbc_icn_edit', 'data-service-id': id, title: config.i18n.edit || 'Edit Service', 'aria-label': config.i18n.edit || 'Edit Service' } ).appendTo( $actions );
		if ( service.actions && service.actions.archive ) {
			$( '<button>', { type: 'button', 'class': 'button-link wpbc_appointment_services__row_archive wpbc_icn_open_in_browser wpbc_icn_rotate_180', 'data-service-id': id, title: config.i18n.archive || 'Archive Service', 'aria-label': config.i18n.archive || 'Archive Service' } ).appendTo( $actions );
		}

		return {
			service: nodeHtml( $identity ),
			duration: draft && inline_cells.duration ? inline_cells.duration : nodeHtml( service_duration_node( service ) ),
			price: draft && inline_cells.price ? inline_cells.price : nodeHtml( $( '<span>', { text: formatCost( service.base_cost ) } ) ),
			providers: providerTemplate ? providerTemplate( { providers: service.providers || [], max_visible: 3, empty_label: config.i18n.no_provider || 'No Providers assigned', more_label: config.i18n.more_providers || 'more Providers' } ) : nodeHtml( providerNodes( service ) ),
			availability: nodeHtml( $availability ),
			status: ( statusTemplate ? statusTemplate( { status: status, label: statusLabel( status ) } ) : '' ) + nodeHtml( $( '<span>', { 'class': 'wpbc_appointment_services__id', text: ( config.i18n.column_id || 'ID' ) + ': ' + id } ) ),
			actions: nodeHtml( $actions )
		};
	}
	/**
	 * Render a normalized catalog response through Service-owned WP templates.
	 *
	 * @param {Object} response Normalized shared-catalog response.
	 * @return {void}
	 */
	function renderCatalogResponse( response ) {
		if ( ! response ) { return; }
		var columns = responseColumns( response );
		var rowTemplate = catalogTemplate( 'wpbc-appointment-service-row' );
		var cardTemplate = catalogTemplate( 'wpbc-appointment-service-card' );
		var headerTemplate = catalogTemplate( 'wpbc-appointment-services-header' );
		var cardsHeaderTemplate = catalogTemplate( 'wpbc-appointment-services-cards-header' );
		var paginationTemplate = catalogTemplate( 'wpbc-appointment-services-pagination' );
		var isCards = 'cards' === response.display.template_pack;
		var $rowHost = $( '[data-wpbc-appointment-services-rows]' );
		var $cardHost = $( '[data-wpbc-appointment-services-cards]' );
		var pagination = response.pagination || {};
		var renderedItems = [];

		destroy_service_thumbnail_tooltips();
		state.last_response = response;
		state.services = response.items || [];
		state.page = Number( pagination.page_number || 1 );
		state.page_size = Number( pagination.items_per_page || state.page_size );
		state.total_items = Number( pagination.total_items || 0 );
		state.total_pages = Number( pagination.total_pages || 0 );
		state.sort_by = String( response.sorting.sort_by || state.sort_by );
		state.sort_order = String( response.sorting.sort_order || state.sort_order );

		if ( headerTemplate && $rowHost.length ) {
			$( '[data-wpbc-appointment-services-header]' ).html( headerTemplate( { columns: columns, id_label: config.i18n.column_id || 'ID', sort_by: state.sort_by, sort_order: state.sort_order, select_all_label: config.i18n.select_all } ) );
		}
		if ( cardsHeaderTemplate && $cardHost.length ) {
			$( '[data-wpbc-appointment-services-cards-header]' ).html( cardsHeaderTemplate( { columns: responseSortColumns( response ), i18n: config.catalog.i18n || {}, select_all_label: config.i18n.select_all } ) );
		}
		$.each( state.services, function ( index, service ) {
			var template = isCards ? cardTemplate : rowTemplate;
			if ( template ) {
				var service_id = Number( service.service_id || service.id || 0 );
				renderedItems.push( template( {
					service_id: service_id,
					is_inspector_selected: service_id === state.selectedId,
					select_label: String( config.i18n.select_service || 'Select %s' ).replace( '%s', service.title || config.i18n.untitled ),
					picture_url: String( service.picture_url || '' ),
					columns: columns,
					cells: serviceCells( service )
				} ) );
			}
		} );
		( isCards ? $cardHost : $rowHost ).html( renderedItems.join( '' ) );
		if ( paginationTemplate ) {
			$( '[data-wpbc-appointment-services-pagination]' ).html( paginationTemplate( {
				results_status: showingText( pagination.items_from || 0, pagination.items_to || 0, pagination.total_items || 0 ),
				show_label: config.catalog.i18n.show_label,
				per_page_label: config.catalog.i18n.per_page_label,
				items_per_page_options: config.catalog.items_per_page.options || [],
				items_per_page: state.page_size,
				aria_label: config.catalog.i18n.pagination_label,
				page_number_label: config.catalog.i18n.page_number,
				page_number: state.page,
				total_pages: Math.max( 1, state.total_pages ),
				previous_page: Math.max( 1, state.page - 1 ),
				next_page: Math.min( Math.max( 1, state.total_pages ), state.page + 1 ),
				previous_label: config.catalog.i18n.previous_page,
				next_label: config.catalog.i18n.next_page,
				has_previous: state.page > 1,
				has_next: state.total_pages > 0 && state.page < state.total_pages
			} ) );
		}
		refresh_service_thumbnail_tooltips();
		if ( catalogController ) { catalogController.refresh_controls(); catalogController.sync_table_min_width(); }
		var selection = get_selection_controller();
		if ( selection && 'function' === typeof selection.synchronize ) {
			selection.synchronize();
		}
		apply_pending_highlights();
		if ( state.inline_editing ) { render_inline_bar(); }
	}
	/** Load one Service and open it in the right inspector. */
	function loadOne( serviceId, focus_target ) {
		var request_sequence;

		if ( ! serviceId || state.busy ) { return; }
		if ( editorIsOpen() && state.selectedId === serviceId ) { expand_service_inspector(); focus_requested_service_section(); return; }
		if ( ! can_replace_editor() ) { return; }
		state.inspector_focus_target = focus_target || document.activeElement;
		request_sequence = ++state.editor_request_sequence;
		setBusy( true );
		request( config.actions.load, { service_id: serviceId } ).done( function ( response ) {
			if ( request_sequence !== state.editor_request_sequence ) { return; }
			if ( response && response.success && response.data && response.data.service ) { fillEditor( response.data.service ); updateUrl( state.selectedId ); expand_service_inspector(); focus_requested_service_section(); return; }
			notify( messageFrom( response, config.i18n.load_failed ), 'error' );
		} ).fail( function ( xhr ) {
			if ( request_sequence === state.editor_request_sequence ) { notify( messageFrom( xhr.responseJSON, config.i18n.load_failed ), 'error' ); }
		} ).always( function () { setBusy( false ); } );
	}
	/**
	 * Reload Services and Provider presentation data for the active filters.
	 *
	 * @param {boolean} save_preferences Whether to persist the active Service filters.
	 * @return {void}
	 */
	function loadList( save_preferences ) {
		var requestData = {
			search: $( '#wpbc_service_search' ).val() || '',
			status: state.status,
			resource_id: $( '#wpbc_service_provider_filter' ).val() || 0,
			page_number: 1
		};
		if ( save_preferences ) { requestData.preference_action = 'save'; }
		return catalogController ? catalogController.load( requestData ) : Promise.resolve( false );
	}
	/**
	 * Keep the Service search clear control synchronized with the search value.
	 *
	 * The Service filters live outside the shared catalog mount, so this small
	 * adapter mirrors the shared catalog clear-button visibility contract.
	 *
	 * @return {void}
	 */
	function sync_search_clear_button() {
		var search_value = String( $( '#wpbc_service_search' ).val() || '' );

		$( '[data-wpbc-appointment-services-search-clear]' ).prop( 'hidden', ! search_value );
	}
	/** Archive one Service after confirmation, then refresh the list. */
	function archiveService( serviceId ) {
		if ( ! serviceId || state.busy || ! w.confirm( config.i18n.confirm_archive || 'Archive this Service?' ) ) { return; }
		state.mutation_in_progress = true;
		setBusy( true );
		request( config.actions.archive, { service_id: serviceId } ).done( function ( response ) {
			if ( response && response.success ) {
				if ( state.selectedId === serviceId ) { state.selectedId = 0; setFieldsEnabled( false ); updateUrl( 0 ); }
				notify( response.data.message, 'success' ); loadList(); return;
			}
			notify( messageFrom( response, config.i18n.archive_failed ), 'error' );
		} ).fail( function ( xhr ) { notify( messageFrom( xhr.responseJSON, config.i18n.archive_failed ), 'error' ); } ).always( function () { state.mutation_in_progress = false; setBusy( false ); } );
	}

	$( document ).on( 'click', '.wpbc_appointment_services__rightbar_tabs [role="tab"]', function ( event ) { event.preventDefault(); switchRightPanel( $( this ) ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__rightbar .wpbc_ui__collapsible_group > .group__header', function ( event ) { event.preventDefault(); toggleInspectorGroup( $( this ) ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__item', function ( event ) { if ( ! state.inline_editing && ! $( event.target ).closest( 'button, a, input, select, textarea, label' ).length ) { loadOne( Number( $( this ).data( 'service-id' ) || 0 ), this ); } } );
	$( document ).on( 'keydown', '.wpbc_appointment_services__item', function ( event ) { if ( ! state.inline_editing && ! $( event.target ).closest( 'button, a, input, select, textarea, label' ).length && ( 'Enter' === event.key || ' ' === event.key ) ) { event.preventDefault(); loadOne( Number( $( this ).data( 'service-id' ) || 0 ), this ); } } );
	$( document ).on( 'click', '.wpbc_appointment_services__row_edit', function () { loadOne( Number( $( this ).data( 'service-id' ) || 0 ), this ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__row_archive', function () { archiveService( Number( $( this ).data( 'service-id' ) || 0 ) ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__status_filter', function () {
		state.status = String( $( this ).data( 'service-status' ) || 'all' );
		state.page = 1;
		$( '.wpbc_appointment_services__status_filter' ).removeClass( 'is-active' ).attr( 'aria-pressed', 'false' );
		$( this ).addClass( 'is-active' ).attr( 'aria-pressed', 'true' );
		loadList( true );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__add', function () {
		if ( ! state.storageReady || state.busy || ! can_replace_editor() ) { return; }
		state.inspector_focus_target = this;
		fillEditor( blankService() );
		updateUrl( 0 );
		open_add_service_inspector();
	} );
	$( document ).on( 'click', '[data-wpbc-appointment-services-cancel]', function ( event ) {
		event.preventDefault();
		event.stopPropagation();
		close_service_inspector( true, true );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__save', function () {
		if ( ! state.storageReady || state.busy ) { return; }
		state.mutation_in_progress = true;
		setBusy( true );
		request( config.actions.save, { service: collectEditor() } ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.service ) { fillEditor( response.data.service ); updateUrl( state.selectedId ); notify( response.data.message, 'success' ); loadList(); return; }
			notify( messageFrom( response, config.i18n.save_failed ), 'error' );
		} ).fail( function ( xhr ) { notify( messageFrom( xhr.responseJSON, config.i18n.save_failed ), 'error' ); } ).always( function () { state.mutation_in_progress = false; setBusy( false ); } );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__duplicate', function () {
		if ( ! state.selectedId || state.busy ) { return; }
		state.mutation_in_progress = true;
		setBusy( true );
		request( config.actions.duplicate, { service_id: state.selectedId } ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.service ) { fillEditor( response.data.service ); updateUrl( state.selectedId ); notify( response.data.message, 'success' ); loadList(); return; }
			notify( messageFrom( response, config.i18n.duplicate_failed ), 'error' );
		} ).fail( function ( xhr ) { notify( messageFrom( xhr.responseJSON, config.i18n.duplicate_failed ), 'error' ); } ).always( function () { state.mutation_in_progress = false; setBusy( false ); } );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__archive', function () { archiveService( state.selectedId ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__inline_toggle', function () { start_inline_editing(); } );
	$( document ).on( 'click', '[data-wpbc-appointment-services-inline-bar] [data-wpbc-ui-catalog-inline-cancel]', function ( event ) {
		event.preventDefault();
		event.stopPropagation();
		cancel_inline_editing( true );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__inline_review', function () {
		var changes = collect_inline_changes();

		preview_operation( 'inline', $.map( Object.keys( changes ), function ( service_id ) { return Number( service_id ); } ), changes, this );
	} );
	$( document ).on( 'input change', '[data-wpbc-appointment-services-inline-field]', function () {
		var service_id = String( Number( $( this ).data( 'service-id' ) || 0 ) );
		var field_id = String( $( this ).data( 'wpbc-appointment-services-inline-field' ) || '' );
		var row_element;
		var indicator_element;
		var changed;

		if ( state.inline_drafts[ service_id ] && field_id ) {
			state.inline_drafts[ service_id ][ field_id ] = $( this ).val();
			row_element = $( this ).closest( '.wpbc_appointment_services__item' ).get( 0 );
			indicator_element = row_element ? row_element.querySelector( '.wpbc_appointment_services__inline_identity_fields' ) : null;
			changed = inline_draft_changed( find_inline_schema( service_id ), state.inline_drafts[ service_id ] );
			if ( inlineWorkflowController ) {
				inlineWorkflowController.set_row_changed( row_element, changed, indicator_element, config.i18n.changed );
			}
			synchronize_inline_bar();
		}
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__bulk_edit', function () { open_bulk_edit( this ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__bulk_delete', function () { preview_deletion( get_selected_service_ids(), this ); } );
	$( document ).on( 'change', '[data-wpbc-appointment-services-bulk-enable]', function () {
		var field_id = String( $( this ).data( 'wpbc-appointment-services-bulk-enable' ) || '' );
		$( '[data-wpbc-appointment-services-bulk-value="' + field_id + '"], [data-wpbc-appointment-services-bulk-range="' + field_id + '"]' ).prop( 'disabled', ! this.checked );
		updateControls();
	} );
	$( document ).on( 'input change', '[data-wpbc-appointment-services-bulk-value]', function () {
		var field_id = String( $( this ).data( 'wpbc-appointment-services-bulk-value' ) || '' );

		$( '[data-wpbc-appointment-services-bulk-range="' + field_id + '"]' ).val( $( this ).val() );
		updateControls();
	} );
	$( document ).on( 'input change', '[data-wpbc-appointment-services-bulk-range]', function () {
		var field_id = String( $( this ).data( 'wpbc-appointment-services-bulk-range' ) || '' );

		$( '[data-wpbc-appointment-services-bulk-value="' + field_id + '"]' ).val( $( this ).val() );
		updateControls();
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__operation_review', function () {
		preview_operation( 'bulk', get_selected_service_ids(), collect_bulk_changes(), this );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__operation_apply', apply_operation );
	$( document ).on( 'submit', '[data-wpbc-ui-catalog-inline-review-form], [data-wpbc-ui-catalog-delete-review-form]', function ( event ) {
		event.preventDefault();
		apply_operation();
	} );
	$( document ).on( 'change', '[data-wpbc-ui-catalog-delete-acknowledgement]', function ( event ) {
		if ( get_delete_review_workflow() ) { get_delete_review_workflow().handle_change( event ); }
	} );
	$( document ).on( 'input change', '[data-service-range-field]', function () {
		var field_id = String( $( this ).data( 'service-range-field' ) || '' );
		if ( field_id ) { $( '[data-service-field="' + field_id + '"]' ).val( $( this ).val() ).trigger( 'input' ); }
	} );
	$( document ).on( 'input change', 'input[type="number"][data-service-field]', function () { sync_numeric_range( String( $( this ).data( 'service-field' ) || '' ) ); } );
	$( document ).on( 'change', '[data-service-status-choice]', function () {
		if ( this.checked ) { $( '[data-service-field="status"]' ).val( this.value ).trigger( 'change' ); }
	} );
	$( document ).on( 'input change wpbc_media_upload_url_set', '[data-service-field="picture_url"]', function () { updateMediaPreview(); updateControls(); } );
	$( document ).on( 'click', '.wpbc_appointment_services__remove_image', function () {
		if ( $( this ).prop( 'disabled' ) ) { return; }
		$( '[data-service-field="picture_url"]' ).val( '' ).trigger( 'input' ).trigger( 'change' );
	} );
	$( document ).on( 'input', '#wpbc_service_search', function () {
		w.clearTimeout( searchTimer );
		state.page = 1;
		sync_search_clear_button();
		searchTimer = w.setTimeout( loadList, 250 );
	} );
	$( document ).on( 'click', '[data-wpbc-appointment-services-search-clear]', function ( event ) {
		var $search_control = $( '#wpbc_service_search' );

		event.preventDefault();
		w.clearTimeout( searchTimer );
		$search_control.val( '' ).trigger( 'focus' );
		state.page = 1;
		sync_search_clear_button();
		loadList();
	} );
	$( document ).on( 'change', '#wpbc_service_provider_filter', function () { state.page = 1; loadList( true ); } );
	$( document ).on( 'wpbc:ui-catalog-loading', '#wpbc_appointment_services_catalog', function ( event ) {
		var event_detail = event.originalEvent && event.originalEvent.detail ? event.originalEvent.detail : {};

		if ( event_detail.catalog_id !== 'appointment_services_catalog' ) { return; }
		state.catalog_loading = true;
		updateControls();
	} );
	$( document ).on( 'wpbc:ui-catalog-rendered', '#wpbc_appointment_services_catalog', function ( event ) {
		var response = event.originalEvent && event.originalEvent.detail ? event.originalEvent.detail.response : null;
		var filters = response && response.filters ? response.filters : {};
		if ( ! response || response.catalog_id !== 'appointment_services_catalog' ) { return; }
		state.catalog_loading = false;
		state.storageReady = !! filters.storage_ready;
		state.status = String( filters.status || state.status );
		indexProviders( filters.providers || ( response.items && response.items.length ? response.items[0].providers || [] : [] ) );
		updateSummary( filters.status_counts || {}, filters.provider_count || 0 );
		$( '.wpbc_appointment_services__status_filter' ).removeClass( 'is-active' ).attr( 'aria-pressed', 'false' )
			.filter( '[data-service-status="' + state.status + '"]' ).addClass( 'is-active' ).attr( 'aria-pressed', 'true' );
		$( '#wpbc_service_provider_filter' ).val( String( filters.resource_id || 0 ) );
		renderCatalogResponse( response );
		updateControls();
		if ( state.initial_selection_pending && state.selectedId ) {
			state.initial_selection_pending = false;
			loadOne( state.selectedId );
		}
	} );
	$( function () {
		var mount_element = document.getElementById( 'wpbc_appointment_services_catalog' );
		var page_element = document.querySelector( '.wpbc_appointment_services_page' );
		var protected_events_root = page_element || mount_element;

		if ( ! $( '[data-wpbc-appointment-services-page="1"]' ).length || ! mount_element || ! config.catalog || ! w.wpbc_ui_catalog ) { return; }
		state.status = String( config.catalog.initial_request && config.catalog.initial_request.status ? config.catalog.initial_request.status : 'all' );
		$( '#wpbc_service_search' ).val( String( config.catalog.initial_request && config.catalog.initial_request.search ? config.catalog.initial_request.search : '' ) );
		sync_search_clear_button();
		protected_events_root.addEventListener( 'click', protect_inline_drafts_from_catalog_controls, true );
		protected_events_root.addEventListener( 'change', protect_inline_drafts_from_catalog_controls, true );
		protected_events_root.addEventListener( 'input', protect_inline_drafts_from_catalog_controls, true );
		catalogController = w.wpbc_ui_catalog.mount( config.catalog );
		if ( ! catalogController ) {
			notify( config.i18n.load_failed, 'error' );
		} else if ( 'function' === typeof w.wpbc_ui_catalog.create_inline_editing_workflow ) {
			inlineWorkflowController = w.wpbc_ui_catalog.create_inline_editing_workflow( mount_element, {
				controls_root: page_element || mount_element,
				page_element: page_element || mount_element,
				protected_selector: '.wpbc_appointment_services__status_filter, #wpbc_service_provider_filter, .wpbc_appointment_services__add'
			} );
			synchronize_inline_workflow();
		}
		$( '.wpbc_settings_page_wrapper' ).on( 'wpbc:right-sidebar-before-content-collapse.wpbcAppointmentServices', function ( event ) {
			if ( ( editorIsOpen() || state.operation_mode ) && ! close_service_inspector( true, false ) ) {
				event.preventDefault();
			}
		} );
	} );
} )( window, jQuery );
