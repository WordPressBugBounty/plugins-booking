( function ( w, $ ) {
	'use strict';
	var config = w.wpbc_appointment_services_config || {};
	var state = {
		storageReady: false,
		selectedId: Number( config.selected_id || 0 ),
		requested_focus: String( config.focus_section || '' ),
		focus_handled: false,
		busy: false,
		status: 'all',
		services: [],
		providers: {},
		providerCount: 0,
		editor_snapshot: '',
		page: 1,
		page_size: Number( config.listing && config.listing.items_per_page ? config.listing.items_per_page : 10 ),
		total_items: 0,
		total_pages: 0,
		sort_by: String( config.listing && config.listing.sort_by ? config.listing.sort_by : 'service_id' ),
		sort_order: String( config.listing && config.listing.sort_order ? config.listing.sort_order : 'desc' )
	};
	var searchTimer = 0;
	var weekdayKeys = [ 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun' ];

	/** Extract an API message while preserving a caller-provided fallback. */
	function messageFrom( response, fallback ) { return response && response.data && response.data.message ? response.data.message : fallback; }
	/** Display a shared Booking Calendar administrator notice. */
	function notify( message, type ) {
		if ( message && typeof w.wpbc_admin_show_message === 'function' ) { w.wpbc_admin_show_message( message, type || 'info', 5000, false ); }
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
	 * Every request uses the shared administrator Processing notice and removes
	 * only its own notice after the request settles.
	 *
	 * @param {string} action WordPress AJAX action name.
	 * @param {Object} data Request-specific payload.
	 * @return {jqXHR} jQuery AJAX promise for the request.
	 */
	function request( action, data ) {
		var $processing_notice = show_processing_notice();

		return $.ajax( { url: config.ajax_url, type: 'POST', dataType: 'json', data: $.extend( { action: action, nonce: config.nonce }, data || {} ) } )
			.always( function () { hide_processing_notice( $processing_notice ); } );
	}
	/** Toggle the loading overlay without hiding the existing Service table. */
	function setLoading( isLoading ) {
		$( '.wpbc_appointment_services__loading' ).toggleClass( 'is-visible', isLoading ).attr( 'aria-hidden', isLoading ? 'false' : 'true' );
		$( '.wpbc_appointment_services__content' ).attr( 'aria-busy', isLoading ? 'true' : 'false' );
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
	 * The slider expands to represent an existing value above its normal visual
	 * range without clamping or rewriting that stored value.
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
		range_max = value > default_max ? default_min + ( Math.ceil( ( value - default_min ) / step ) * step ) : default_max;
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
		var hasPicture = !! String( $( '[data-service-field="picture_url"]' ).val() || '' ).trim();
		var show_save = open && 'true' === $( '#wpbc_tab_service_settings' ).attr( 'aria-selected' );
		$( '.wpbc_appointment_services__add' ).prop( 'hidden', false ).prop( 'disabled', ! state.storageReady || state.busy );
		$( '.wpbc_appointment_services__right_sidebar_footer, .wpbc_appointment_services__top_actions' ).prop( 'hidden', ! show_save );
		$( '.wpbc_appointment_services__save' ).prop( 'hidden', ! show_save ).prop( 'disabled', ! open || state.busy );
		$( '.wpbc_appointment_services__duplicate, .wpbc_appointment_services__archive' ).prop( 'disabled', ! open || ! state.selectedId || state.busy );
		$( '.wpbc_appointment_services__media_preview, .wpbc_appointment_services__select_image' ).prop( 'disabled', ! open || state.busy );
		$( '.wpbc_appointment_services__remove_image' ).prop( 'disabled', ! open || ! hasPicture || state.busy );
	}
	/** Mark the page busy during a mutating request and refresh controls. */
	function setBusy( value ) { state.busy = value; $( '.wpbc_appointment_services_page' ).toggleClass( 'is-busy', value ); updateControls(); }
	/** Enable or disable all fields in the Service inspector. */
	function setFieldsEnabled( enabled ) { $( '[data-service-field], [data-service-range-field], [data-service-status-choice]' ).prop( 'disabled', ! enabled ); updateControls(); }
	/** Return defaults for a new unsaved Service. */
	function blankService() {
		return { service_id: 0, title: '', description: '', picture_url: '', status: 'active', duration_minutes: 30, buffer_before_minutes: 0, buffer_after_minutes: 0, base_cost: '0.00', booking_form_id: 0, resource_ids: [] };
	}
	/** Populate the inspector from a normalized Service response. */
	function fillEditor( service ) {
		service = $.extend( blankService(), service || {} );
		state.selectedId = Number( service.service_id || 0 );
		$.each( service, function ( key, value ) { $( '[data-service-field="' + key + '"]' ).val( value ); } );
		sync_status_radios();
		sync_all_numeric_ranges();
		updateMediaPreview();
		setFieldsEnabled( state.storageReady );
		$( '.wpbc_appointment_services__item' ).removeClass( 'is-selected' ).attr( 'aria-current', 'false' );
		$( '.wpbc_appointment_services__item[data-service-id="' + state.selectedId + '"]' ).addClass( 'is-selected' ).attr( 'aria-current', 'true' );
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
	/** Reflect the selected Service in the admin URL without reloading. */
	function updateUrl( serviceId ) {
		if ( ! w.history || ! w.URL ) { return; }
		var url = new w.URL( w.location.href );
		if ( serviceId ) { url.searchParams.set( 'service_id', serviceId ); } else { url.searchParams.delete( 'service_id' ); }
		w.history.replaceState( {}, '', url.toString() );
	}
	/** Render the empty or storage-unavailable state in the central workspace. */
	function renderEmpty( message, storageNotice ) {
		var $empty = $( '.wpbc_appointment_services__empty' );
		var noProviders = ! storageNotice && ! message && 0 === state.providerCount;
		$( '.wpbc_appointment_services__list' ).prop( 'hidden', true );
		$empty.prop( 'hidden', false ).toggleClass( 'is-storage-notice', !! storageNotice );
		$empty.find( 'h2' ).text( storageNotice ? ( config.i18n.not_connected || 'Services storage is not connected' ) : ( noProviders ? ( config.i18n.no_providers || 'No Providers available' ) : ( config.i18n.empty || 'No Services yet' ) ) );
		$empty.find( 'p' ).text( message || ( noProviders ? config.i18n.no_providers_help : config.i18n.empty_help ) || '' );
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
			'class': 'wpbc_appointment_services__service_thumbnail tooltip_top',
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
		var listing_selector = '#wpbc_ui_listing_appointment_services_catalog ';
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
		var format = config.i18n.showing || 'Showing %1$s–%2$s of %3$s Services';
		return format.replace( '%1$s', from ).replace( '%2$s', to ).replace( '%3$s', total );
	}
	/**
	 * Apply the server-authoritative listing preference to state and controls.
	 *
	 * @param {Object} listing_settings Shared listing client settings.
	 * @return {void}
	 */
	function sync_listing_settings( listing_settings ) {
		var page_size = Number( listing_settings && listing_settings.items_per_page ? listing_settings.items_per_page : state.page_size );
		if ( ! isFinite( page_size ) || page_size < 1 ) { return; }
		state.page_size = page_size;
		$( '[data-wpbc-listing-items-per-page-control="appointment_services_catalog"]' ).val( String( page_size ) );
	}
	/**
	 * Synchronize sortable table headers with the server-authoritative ordering.
	 *
	 * @param {Object} sorting Normalized sort key and direction.
	 * @return {void}
	 */
	function sync_sorting_controls( sorting ) {
		state.sort_by = String( sorting && sorting.sort_by ? sorting.sort_by : state.sort_by );
		state.sort_order = 'desc' === String( sorting && sorting.sort_order ? sorting.sort_order : state.sort_order ) ? 'desc' : 'asc';

		$( '[data-wpbc-listing-sort="appointment_services_catalog"]' ).each( function () {
			var $sort_link = $( this );
			var is_active = String( $sort_link.data( 'wpbc-listing-sort-key' ) || '' ) === state.sort_by;
			var $sort_icon = $sort_link.find( '.wpbc_ui_listing__sort_icon' );

			$sort_link.toggleClass( 'is-active', is_active );
			$sort_icon.removeClass( 'wpbc_icn_import_export wpbc-bi-arrow-down wpbc-bi-arrow-up' )
				.addClass( is_active ? ( 'desc' === state.sort_order ? 'wpbc-bi-arrow-down' : 'wpbc-bi-arrow-up' ) : 'wpbc_icn_import_export' );
		} );
		$( '.wpbc_appointment_services__table th' ).each( function () {
			var $column = $( this );
			if ( ! $column.find( '.wpbc_ui_listing__sort_link' ).length ) {
				return;
			}
			var has_active_sort = $column.find( '.wpbc_ui_listing__sort_link.is-active' ).length > 0;
			$column.attr( 'aria-sort', has_active_sort ? ( 'desc' === state.sort_order ? 'descending' : 'ascending' ) : 'none' );
		} );
	}
	/**
	 * Synchronize direct-page and previous/next controls with the server response.
	 *
	 * @param {Object} pagination Server-authoritative pagination metadata.
	 * @return {void}
	 */
	function sync_pagination_controls( pagination ) {
		var total_pages = Math.max( 0, Number( pagination && pagination.total_pages ? pagination.total_pages : 0 ) );
		var maximum_page = Math.max( 1, total_pages );
		var $page_control = $( '[data-wpbc-listing-page-number-control="appointment_services_catalog"]' );
		$page_control.attr( 'max', maximum_page ).val( state.page ).prop( 'disabled', total_pages <= 1 );
		$( '[data-wpbc-listing-page-total="appointment_services_catalog"]' ).text( total_pages );
	}
	/**
	 * Request the valid page entered in the shared direct-page control.
	 *
	 * @param {jQuery} $page_control Direct-page number input.
	 * @return {void}
	 */
	function request_selected_page( $page_control ) {
		var requested_page = Number( $page_control.val() );
		requested_page = Math.min( Math.max( 1, isFinite( requested_page ) ? requested_page : state.page ), Math.max( 1, state.total_pages ) );
		$page_control.val( requested_page );
		if ( requested_page === state.page ) { return; }
		state.page = requested_page;
		loadList();
	}
	/**
	 * Render one server-selected page of Services in the management table.
	 *
	 * @param {Array}  services   Services returned for the requested page only.
	 * @param {Object} pagination Server-authoritative pagination metadata.
	 * @return {void}
	 */
	function renderList( services, pagination ) {
		var $list = $( '.wpbc_appointment_services__list' );
		var $tbody = $( '.wpbc_appointment_services__table tbody' );
		var items_from;
		var items_to;
		var page_items;
		destroy_service_thumbnail_tooltips();
		$tbody.empty();
		pagination = pagination || {};
		state.services = services || [];
		state.page = Math.max( 1, Number( pagination.page_number || state.page || 1 ) );
		state.total_items = Math.max( 0, Number( pagination.total_items || 0 ) );
		state.total_pages = Math.max( 0, Number( pagination.total_pages || 0 ) );
		sync_pagination_controls( pagination );
		$( '.wpbc_appointment_services__empty' ).prop( 'hidden', true );
		if ( ! state.services.length ) { renderEmpty( '', false ); return; }
		items_from = Math.max( 1, Number( pagination.items_from || ( ( state.page - 1 ) * state.page_size ) + 1 ) );
		items_to = Math.max( items_from, Number( pagination.items_to || ( items_from + state.services.length - 1 ) ) );
		page_items = state.services;
		$list.prop( 'hidden', false );

		$.each( page_items, function ( index, service ) {
			var id = Number( service.service_id || 0 );
			var title = service.title || config.i18n.untitled || 'Untitled Service';
			var description = String( service.description || '#' + id );
			var status = String( service.status || 'active' );
			var $row = $( '<tr>', { 'class': 'wpbc_appointment_services__item', 'data-service-id': id, tabindex: '0', 'aria-current': id === state.selectedId ? 'true' : 'false' } );
			var $serviceCell = $( '<td>', { 'class': 'column-service', 'data-label': config.i18n.column_service || 'Service' } ).appendTo( $row );
			$row.toggleClass( 'is-selected', id === state.selectedId );
			var $serviceIdentity = $( '<div>', { 'class': 'wpbc_appointment_services__service_identity' } ).appendTo( $serviceCell );
			var $serviceCopy = $( '<span>', { 'class': 'wpbc_appointment_services__service_copy' } ).appendTo( $serviceIdentity );
			serviceThumbnailNode( service ).prependTo( $serviceIdentity );
			$( '<strong>', { text: title } ).appendTo( $serviceCopy );
			$( '<span>', { text: description } ).appendTo( $serviceCopy );
			$( '<td>', { 'class': 'column-duration', 'data-label': config.i18n.column_duration || 'Duration' } ).append( service_duration_node( service ) ).appendTo( $row );
			if ( config.pricing_available ) {
				$( '<td>', { 'class': 'column-price', 'data-label': config.i18n.column_price || 'Price', text: formatCost( service.base_cost ) } ).appendTo( $row );
			}
			$( '<td>', { 'class': 'column-providers', 'data-label': config.i18n.column_providers || 'Providers' } ).append( providerNodes( service ) ).appendTo( $row );
			var $availabilityCell = $( '<td>', { 'class': 'column-weekdays', 'data-label': config.i18n.column_weekly_availability || 'Weekly Availability' } ).appendTo( $row );
			var $availabilityWeek = $( '<div>', { 'class': 'wpbc_appointment_services__availability_week' } ).appendTo( $availabilityCell );
			var hasWeeklyAvailability = false;
			$.each( weekdayKeys, function ( dayIndex, day ) {
				var available_providers = providers_available_on( service, day );
				var available = available_providers.length > 0;
				if ( available ) { hasWeeklyAvailability = true; }
				var dayTitle = config.weekdays && config.weekdays[ dayIndex ] ? config.weekdays[ dayIndex ] : day;
				var provider_titles = $.map( available_providers, function ( provider ) { return provider.title || ''; } ).filter( function ( title ) { return !! title; } );
				var availability_title = available
					? String( config.i18n.available_providers || 'Available Providers: %s' ).replace( '%s', provider_titles.join( ', ' ) )
					: ( config.i18n.no_available_providers || 'No assigned Providers are available' );
				$( '<span>', { 'class': 'wpbc_appointment_services__availability' + ( available ? ' is-available' : '' ), title: dayTitle + ': ' + availability_title, 'aria-label': dayTitle + ': ' + availability_title } ).appendTo( $availabilityWeek );
			} );
			$availabilityCell.append( availability_edit_links( service ) );
			if ( service.resource_ids && service.resource_ids.length && ! hasWeeklyAvailability ) {
				$( '<span>', { 'class': 'wpbc_appointment_services__availability_empty', text: config.i18n.no_availability || 'No weekly availability' } ).appendTo( $availabilityCell );
			}
			var $status_cell = $( '<td>', { 'class': 'column-status', 'data-label': config.i18n.column_status || 'Status' } ).appendTo( $row );
			var $status_identity = $( '<div>', { 'class': 'wpbc_appointment_services__status_identity' } ).appendTo( $status_cell );
			$( '<span>', { 'class': 'wpbc_appointment_services__status status-' + status, text: statusLabel( status ) } ).appendTo( $status_identity );
			$( '<span>', { 'class': 'wpbc_appointment_services__id', text: ( config.i18n.column_id || 'ID' ) + ': ' + id } ).appendTo( $status_identity );
			var $actions = $( '<td>', { 'class': 'column-actions', 'data-label': config.i18n.column_actions || 'Actions' } ).appendTo( $row );
			$( '<button>', { type: 'button', 'class': 'button-link wpbc_appointment_services__row_edit wpbc_icn_edit', 'data-service-id': id, title: config.i18n.edit || 'Edit Service', 'aria-label': config.i18n.edit || 'Edit Service' } ).appendTo( $actions );
			if ( 'archived' !== status ) { $( '<button>', { type: 'button', 'class': 'button-link wpbc_appointment_services__row_archive wpbc_icn_open_in_browser wpbc_icn_rotate_180 ', 'data-service-id': id, title: config.i18n.archive || 'Archive Service', 'aria-label': config.i18n.archive || 'Archive Service' } ).appendTo( $actions ); }
			$tbody.append( $row );
		} );

		refresh_service_thumbnail_tooltips();
		$( '.wpbc_appointment_services__list_footer' ).prop( 'hidden', false );
		$( '.wpbc_appointment_services__result_count' ).text( showingText( items_from, items_to, state.total_items ) );
		$( '.wpbc_appointment_services__page_prev' ).prop( 'disabled', state.page <= 1 );
		$( '.wpbc_appointment_services__page_next' ).prop( 'disabled', state.total_pages < 1 || state.page >= state.total_pages );
	}
	/** Load one Service and open it in the right inspector. */
	function loadOne( serviceId ) {
		if ( ! serviceId || state.busy ) { return; }
		if ( editorIsOpen() && state.selectedId === serviceId ) { expand_service_inspector(); focus_requested_service_section(); return; }
		if ( ! can_replace_editor() ) { return; }
		setBusy( true );
		request( config.actions.load, { service_id: serviceId } ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.service ) { fillEditor( response.data.service ); updateUrl( state.selectedId ); expand_service_inspector(); focus_requested_service_section(); return; }
			notify( messageFrom( response, config.i18n.load_failed ), 'error' );
		} ).fail( function ( xhr ) { notify( messageFrom( xhr.responseJSON, config.i18n.load_failed ), 'error' ); } ).always( function () { setBusy( false ); } );
	}
	/** Reload Services and Provider presentation data for the active filters. */
	function loadList( save_items_per_page ) {
		var request_data = {
			search: $( '#wpbc_service_search' ).val() || '',
			status: state.status,
			resource_id: $( '#wpbc_service_provider_filter' ).val() || 0,
			page_number: state.page,
			items_per_page: state.page_size,
			sort_by: state.sort_by,
			sort_order: state.sort_order
		};
		if ( save_items_per_page ) { request_data.save_items_per_page = 1; }
		setLoading( true );
		request( config.actions.list, request_data ).done( function ( response ) {
			if ( ! response || ! response.success || ! response.data ) { renderEmpty( messageFrom( response, config.i18n.load_failed ), false ); return; }
			state.storageReady = !! response.data.storage_ready;
			if ( ! state.storageReady ) { $( '.wpbc_appointment_services__table tbody' ).empty(); setFieldsEnabled( false ); renderEmpty( response.data.message || config.i18n.not_connected, true ); return; }
			sync_listing_settings( response.data.listing || config.listing || {} );
			sync_sorting_controls( response.data.sorting || {} );
			indexProviders( response.data.providers || [] );
			updateSummary( response.data.counts, response.data.provider_count );
			renderList( response.data.services || [], response.data.pagination || {} );
			updateControls();
			if ( state.selectedId ) { loadOne( state.selectedId ); }
		} ).fail( function ( xhr ) {
			state.storageReady = false;
			setFieldsEnabled( false );
			renderEmpty( messageFrom( xhr.responseJSON, config.i18n.load_failed ), false );
		} ).always( function () { setLoading( false ); } );
	}
	/** Archive one Service after confirmation, then refresh the list. */
	function archiveService( serviceId ) {
		if ( ! serviceId || state.busy || ! w.confirm( config.i18n.confirm_archive || 'Archive this Service?' ) ) { return; }
		setBusy( true );
		request( config.actions.archive, { service_id: serviceId } ).done( function ( response ) {
			if ( response && response.success ) {
				if ( state.selectedId === serviceId ) { state.selectedId = 0; setFieldsEnabled( false ); updateUrl( 0 ); }
				notify( response.data.message, 'success' ); loadList(); return;
			}
			notify( messageFrom( response, config.i18n.archive_failed ), 'error' );
		} ).fail( function ( xhr ) { notify( messageFrom( xhr.responseJSON, config.i18n.archive_failed ), 'error' ); } ).always( function () { setBusy( false ); } );
	}

	$( document ).on( 'click', '.wpbc_appointment_services__rightbar_tabs [role="tab"]', function ( event ) { event.preventDefault(); switchRightPanel( $( this ) ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__rightbar .wpbc_ui__collapsible_group > .group__header', function ( event ) { event.preventDefault(); toggleInspectorGroup( $( this ) ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__item', function ( event ) { if ( ! $( event.target ).closest( 'button, a' ).length ) { loadOne( Number( $( this ).data( 'service-id' ) || 0 ) ); } } );
	$( document ).on( 'keydown', '.wpbc_appointment_services__item', function ( event ) { if ( ! $( event.target ).closest( 'button, a' ).length && ( 'Enter' === event.key || ' ' === event.key ) ) { event.preventDefault(); loadOne( Number( $( this ).data( 'service-id' ) || 0 ) ); } } );
	$( document ).on( 'click', '.wpbc_appointment_services__row_edit', function () { loadOne( Number( $( this ).data( 'service-id' ) || 0 ) ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__row_archive', function () { archiveService( Number( $( this ).data( 'service-id' ) || 0 ) ); } );
	$( document ).on( 'click', '.wpbc_appointment_services__status_filter', function () {
		state.status = String( $( this ).data( 'service-status' ) || 'all' );
		state.page = 1;
		$( '.wpbc_appointment_services__status_filter' ).removeClass( 'is-active' ).attr( 'aria-pressed', 'false' );
		$( this ).addClass( 'is-active' ).attr( 'aria-pressed', 'true' );
		loadList();
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__page_prev', function () { if ( state.page > 1 ) { state.page--; loadList(); } } );
	$( document ).on( 'click', '.wpbc_appointment_services__page_next', function () { if ( state.page < state.total_pages ) { state.page++; loadList(); } } );
	$( document ).on( 'click', '[data-wpbc-listing-sort="appointment_services_catalog"]', function ( event ) {
		var sort_by = String( $( this ).data( 'wpbc-listing-sort-key' ) || '' );

		event.preventDefault();
		if ( ! sort_by ) { return; }
		state.sort_order = sort_by === state.sort_by && 'asc' === state.sort_order ? 'desc' : 'asc';
		state.sort_by = sort_by;
		state.page = 1;
		loadList();
	} );
	$( document ).on( 'change', '[data-wpbc-listing-page-number-control="appointment_services_catalog"]', function () { request_selected_page( $( this ) ); } );
	$( document ).on( 'keydown', '[data-wpbc-listing-page-number-control="appointment_services_catalog"]', function ( event ) {
		if ( 'Enter' === event.key ) { event.preventDefault(); request_selected_page( $( this ) ); }
	} );
	$( document ).on( 'change', '[data-wpbc-listing-items-per-page-control="appointment_services_catalog"]', function () {
		var page_size = Number( $( this ).val() );
		if ( ! isFinite( page_size ) || page_size < 1 || page_size === state.page_size ) { return; }
		state.page_size = page_size;
		state.page = 1;
		loadList( true );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__add', function () {
		if ( ! state.storageReady || state.busy || ! can_replace_editor() ) { return; }
		fillEditor( blankService() );
		updateUrl( 0 );
		open_add_service_inspector();
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__save', function () {
		if ( ! state.storageReady || state.busy ) { return; }
		setBusy( true );
		request( config.actions.save, { service: collectEditor() } ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.service ) { fillEditor( response.data.service ); updateUrl( state.selectedId ); notify( response.data.message, 'success' ); loadList(); return; }
			notify( messageFrom( response, config.i18n.save_failed ), 'error' );
		} ).fail( function ( xhr ) { notify( messageFrom( xhr.responseJSON, config.i18n.save_failed ), 'error' ); } ).always( function () { setBusy( false ); } );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__duplicate', function () {
		if ( ! state.selectedId || state.busy ) { return; }
		setBusy( true );
		request( config.actions.duplicate, { service_id: state.selectedId } ).done( function ( response ) {
			if ( response && response.success && response.data && response.data.service ) { fillEditor( response.data.service ); updateUrl( state.selectedId ); notify( response.data.message, 'success' ); loadList(); return; }
			notify( messageFrom( response, config.i18n.duplicate_failed ), 'error' );
		} ).fail( function ( xhr ) { notify( messageFrom( xhr.responseJSON, config.i18n.duplicate_failed ), 'error' ); } ).always( function () { setBusy( false ); } );
	} );
	$( document ).on( 'click', '.wpbc_appointment_services__archive', function () { archiveService( state.selectedId ); } );
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
	$( document ).on( 'input', '#wpbc_service_search', function () { w.clearTimeout( searchTimer ); state.page = 1; searchTimer = w.setTimeout( loadList, 250 ); } );
	$( document ).on( 'change', '#wpbc_service_provider_filter', function () { state.page = 1; loadList(); } );
	$( function () { if ( $( '[data-wpbc-appointment-services-page="1"]' ).length ) { loadList(); } } );
} )( window, jQuery );
