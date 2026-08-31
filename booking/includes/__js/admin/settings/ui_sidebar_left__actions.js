"use strict";
// =====================================================================================================================
// == Left Bar  -  expand / colapse functions   ==
// =====================================================================================================================

/**
 * Save user's preferred left sidebar mode.
 *
 * @param string mode
 */
function wpbc_admin_ui__sidebar_left__save_mode( mode ) {
	var allowed_modes = [ 'min', 'compact', 'max' ];

	if ( allowed_modes.indexOf( mode ) === -1 ) {
		return;
	}

	var $saver = jQuery( '#wpbc_left_sidebar_view_mode_saver' );

	if ( ! $saver.length ) {
		return;
	}

	if ( 'function' !== typeof wpbc_save_custom_user_data_from_element ) {
		return;
	}

	$saver.data( 'wpbc-u-save-value', mode );
	$saver.attr( 'data-wpbc-u-save-value', mode );

	wpbc_save_custom_user_data_from_element( $saver.get( 0 ) );
}

/**
 * Reveal the active item inside the scrollable left navigation.
 *
 * The active item itself is aligned with a small leading offset, regardless of
 * its position inside a root section. Scrolling is applied only to SimpleBar's
 * internal scroll element so the WordPress administration document does not
 * move.
 *
 * @param {Object|null|undefined} simplebar_instance Optional initialized SimpleBar instance.
 * @return {void}
 */
function wpbc_admin_ui__sidebar_left__scroll_to_active_item( simplebar_instance ) {
	var left_navigation_element = document.querySelector( '.wpbc_ui_el__vert_left_bar__content' );

	if (
		! simplebar_instance
		&& 'undefined' !== typeof SimpleBar
		&& SimpleBar.instances
		&& left_navigation_element
	) {
		simplebar_instance = SimpleBar.instances.get( left_navigation_element );
	}

	if (
		! simplebar_instance
		|| 'function' !== typeof simplebar_instance.getScrollElement
		|| 'function' !== typeof simplebar_instance.getContentElement
	) {
		return;
	}

	window.requestAnimationFrame( function () {
		var scroll_element  = simplebar_instance.getScrollElement();
		var content_element = simplebar_instance.getContentElement();

		if (
			! scroll_element
			|| ! content_element
			|| ! content_element.closest( '.wpbc_ui_el__vert_left_bar__content' )
		) {
			return;
		}

		simplebar_instance.recalculate();

		var active_item = content_element.querySelector( '.wpbc_ui_el__vert_nav_item.active' );

		if ( ! active_item || null === active_item.offsetParent || 0 >= scroll_element.clientHeight ) {
			return;
		}

		var scroll_rect    = scroll_element.getBoundingClientRect();
		var active_rect    = active_item.getBoundingClientRect();
		var current_top    = scroll_element.scrollTop;
		var leading_offset = 85;
		var active_top     = current_top + active_rect.top - scroll_rect.top;
		var target_top     = active_top - leading_offset;

		var maximum_top = Math.max( 0, scroll_element.scrollHeight - scroll_element.clientHeight );

		scroll_element.scrollTop = Math.max( 0, Math.min( Math.round( target_top ), maximum_top ) );
	} );
}

/**
 * Expand Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_max( is_save_user_state ) {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'max' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_max' );
	wpbc_admin_ui__sidebar_left__scroll_to_active_item();

	if ( is_save_user_state ) {
		wpbc_admin_ui__sidebar_left__save_mode( 'max' );
	}
}

/**
 * Hide Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_min( is_save_user_state ) {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'min' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_min' );

	if ( is_save_user_state ) {
		wpbc_admin_ui__sidebar_left__save_mode( 'min' );
	}
}

/**
 * Colapse Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_compact( is_save_user_state ) {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'compact' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_compact' );
	wpbc_admin_ui__sidebar_left__scroll_to_active_item();

	if ( is_save_user_state ) {
		wpbc_admin_ui__sidebar_left__save_mode( 'compact' );
	}
}

/**
 * Completely Hide Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_hide() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min max compact none' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'none' );
	jQuery( '.wpbc_ui__top_nav__btn_open_left_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_left_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	// Hide top "Menu" button with divider.
	jQuery( '.wpbc_ui__top_nav__btn_show_left_vertical_nav,.wpbc_ui__top_nav__btn_show_left_vertical_nav_divider' ).addClass( 'wpbc_ui__hide' );

	jQuery( '.wp-admin' ).removeClass( 'wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none' );
	jQuery( '.wp-admin' ).addClass( 'wpbc_page_wrapper_left_none' );
}

/**
 * Action on click "Go Back" - show root menu
 * or some other section in left sidebar.
 *
 * @param string menu_to_show - menu slug.
 */
function wpbc_admin_ui__sidebar_left__show_section( menu_to_show ) {
	jQuery( '.wpbc_ui_el__vert_left_bar__section' ).addClass( 'wpbc_ui__hide' )
	jQuery( '.wpbc_ui_el__vert_left_bar__section_' + menu_to_show ).removeClass( 'wpbc_ui__hide' );
}

// =====================================================================================================================
// == Right Side Bar  -  expand / colapse functions   ==
// =====================================================================================================================

/**
 * Synchronize the document body marker for the expanded right sidebar.
 *
 * The marker is domain-neutral so individual administration pages can adjust
 * their presentation without duplicating right-sidebar state handling.
 *
 * @param {boolean} is_open Whether the right sidebar is fully expanded.
 * @return {void}
 */
function wpbc_admin_ui__sidebar_right__set_body_open_state( is_open ) {
	jQuery( 'body' ).toggleClass( 'wpbc_ui_el__vert_right_bar__wrapper_opened', !! is_open );
}

/**
 * Expand Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_max() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'max_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( true );
}

/**
 * Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_min() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'min_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( false );
}

/**
 * Colapse Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_compact() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'compact_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( false );
}

/**
 * Completely Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_hide() {
	jQuery( '.wpbc_settings_page_wrapper' ).removeClass( 'min_right max_right compact_right none_right' );
	jQuery( '.wpbc_settings_page_wrapper' ).addClass( 'none_right' );
	jQuery( '.wpbc_ui__top_nav__btn_open_right_vertical_nav' ).removeClass( 'wpbc_ui__hide' );
	jQuery( '.wpbc_ui__top_nav__btn_hide_right_vertical_nav' ).addClass( 'wpbc_ui__hide' );
	// Hide top "Menu" button with divider.
	jQuery( '.wpbc_ui__top_nav__btn_show_right_vertical_nav,.wpbc_ui__top_nav__btn_show_right_vertical_nav_divider' ).addClass( 'wpbc_ui__hide' );
	wpbc_admin_ui__sidebar_right__set_body_open_state( false );
}

/**
 * Restore the body marker when a page renders with the right sidebar open.
 */
jQuery( document ).ready( function () {
	wpbc_admin_ui__sidebar_right__set_body_open_state( 0 < jQuery( '.wpbc_settings_page_wrapper.max_right' ).length );
} );

/**
 * Collapse an expanded right sidebar after an opted-in page-content click.
 *
 * Pages enable this behavior through the page-structure
 * right_vertical_sidebar__content_click_collapse_mode option. Interactive
 * controls that open or retain sidebar content can opt out by placing the
 * data-wpbc-right-sidebar-keep-open attribute on themselves or an ancestor.
 *
 * @param {MouseEvent} event Content click event captured before catalog rows.
 * @return {void}
 */
function wpbc_admin_ui__sidebar_right__collapse_from_content_click( event ) {
	var event_target = event.target && 1 === event.target.nodeType ? event.target : null;
	var content_element = event_target && 'function' === typeof event_target.closest
		? event_target.closest( '.wpbc_settings_page_wrapper[data-wpbc-right-sidebar-content-click-collapse-mode] > .wpbc_settings_page_content' )
		: null;
	var $content;
	var $wrapper;
	var collapse_mode;
	var before_collapse_event;

	if ( ! content_element ) {
		return;
	}

	$content = jQuery( content_element );
	$wrapper = $content.closest( '.wpbc_settings_page_wrapper' );
	collapse_mode = String( $wrapper.attr( 'data-wpbc-right-sidebar-content-click-collapse-mode' ) || '' );

	if ( ! $wrapper.hasClass( 'max_right' ) || [ 'min', 'compact', 'none' ].indexOf( collapse_mode ) === -1 ) {
		return;
	}
	if ( jQuery( event.target ).closest( '[data-wpbc-right-sidebar-keep-open]' ).length ) {
		return;
	}

	/*
	 * This click belongs to the open-sidebar dismissal layer. Consume it before
	 * domain row handlers run so the same pointer action cannot close one
	 * inspector and immediately open another one underneath it.
	 */
	event.preventDefault();
	event.stopImmediatePropagation();

	before_collapse_event = jQuery.Event( 'wpbc:right-sidebar-before-content-collapse' );
	$wrapper.trigger( before_collapse_event, [ event ] );
	if ( before_collapse_event.isDefaultPrevented() ) {
		return;
	}

	if ( 'compact' === collapse_mode ) {
		wpbc_admin_ui__sidebar_right__do_compact();
	} else if ( 'none' === collapse_mode ) {
		wpbc_admin_ui__sidebar_right__do_hide();
	} else {
		wpbc_admin_ui__sidebar_right__do_min();
	}

	jQuery( document ).trigger( 'wpbc_setup_wizard_layout_changed' );
}

document.addEventListener( 'click', wpbc_admin_ui__sidebar_right__collapse_from_content_click, true );


/**
 * Action on click "Go Back" - show root menu
 * or some other section in right sidebar.
 *
 * @param string menu_to_show - menu slug.
 */
function wpbc_admin_ui__sidebar_right__show_section( menu_to_show ) {
	jQuery( '.wpbc_ui_el__vert_right_bar__section' ).addClass( 'wpbc_ui__hide' )
	jQuery( '.wpbc_ui_el__vert_right_bar__section_' + menu_to_show ).removeClass( 'wpbc_ui__hide' );
}

// =====================================================================================================================
// == End Right Side Bar  section   ==
// =====================================================================================================================

/**
 * Get anchor(s) array  from  URL.
 * Doc: https://developer.mozilla.org/en-US/docs/Web/API/Location
 *
 * @returns {*[]}
 */
function wpbc_url_get_anchors_arr() {
	var hashes            = window.location.hash.replace( '%23', '#' );
	var hashes_arr        = hashes.split( '#' );
	var result            = [];
	var hashes_arr_length = hashes_arr.length;

	for ( var i = 0; i < hashes_arr_length; i++ ) {
		if ( hashes_arr[i].length > 0 ) {
			result.push( hashes_arr[i] );
		}
	}
	return result;
}

/**
 * Auto Expand Settings section based on URL anchor, after  page loaded.
 */
jQuery( document ).ready( function () { wpbc_admin_ui__redirect_legacy_general_availability_url(); } );
jQuery( document ).ready( function () { wpbc_admin_ui__do_expand_section(); setTimeout( 'wpbc_admin_ui__do_expand_section', 10 ); } );
jQuery( document ).ready( function () { wpbc_admin_ui__do_expand_section(); setTimeout( 'wpbc_admin_ui__do_expand_section', 150 ); } );

/**
 * Redirect old Settings > Availability anchors to the dedicated General Availability page.
 */
function wpbc_admin_ui__redirect_legacy_general_availability_url() {

	if (
		   ( window.location.href.indexOf( 'page=wpbc-settings' ) > -1 )
		&& (
			   ( window.location.hash.indexOf( 'wpbc_general_settings_availability_metabox' ) > -1 )
			|| ( window.location.hash.indexOf( 'wpbc_general_settings_availability_tab' ) > -1 )
		)
	) {
		window.location.replace( window.location.href.split( '?' )[0] + '?page=wpbc-availability&tab=general_availability' );
	}
}

/**
 * Expand section in  General Settings page and select Menu item.
 */
function wpbc_admin_ui__do_expand_section() {

	// window.location.hash  = #section_id  /  doc: https://developer.mozilla.org/en-US/docs/Web/API/Location .
	var anchors_arr        = wpbc_url_get_anchors_arr();
	var anchors_arr_length = anchors_arr.length;

	if ( anchors_arr_length > 0 ) {
		var one_anchor_prop_value = anchors_arr[0].split( 'do_expand__' );
		if ( one_anchor_prop_value.length > 1 ) {

			// 'wpbc_general_settings_calendar_metabox'
			var section_to_show    = one_anchor_prop_value[1];
			var section_id_to_show = '#' + section_to_show;


			// -- Remove selected background in all left  menu  items ---------------------------------------------------
			jQuery( '.wpbc_ui_el__vert_nav_item ' ).removeClass( 'active' );
			// Set left menu selected.
			jQuery( '.do_expand__' + section_to_show + '_link' ).addClass( 'active' );
			var selected_title = jQuery( '.do_expand__' + section_to_show + '_link a .wpbc_ui_el__vert_nav_title ' ).text();

			// Expand section, if it colapsed.
			if ( ! jQuery( '.do_expand__' + section_to_show + '_link' ).parents( '.wpbc_ui_el__level__folder' ).hasClass( 'expanded' ) ) {
				jQuery( '.wpbc_ui_el__level__folder' ).removeClass( 'expanded' );
				jQuery( '.do_expand__' + section_to_show + '_link' ).parents( '.wpbc_ui_el__level__folder' ).addClass( 'expanded' );
			}

			// -- Expand section ---------------------------------------------------------------------------------------
			var container_to_hide_class = '.postbox';
			// Hide sections '.postbox' in admin page and show specific one.
			jQuery( '.wpbc_admin_page ' + container_to_hide_class ).hide();
			jQuery( '.wpbc_container_always_hide__on_left_nav_click' ).hide();
			jQuery( section_id_to_show ).show();

			// Show all other sections,  if provided in URL: ..?page=wpbc-settings#do_expand__wpbc_general_settings_capacity_metabox#wpbc_general_settings_capacity_upgrade_metabox .
			for ( let i = 1; i < anchors_arr_length; i++ ) {
				jQuery( '#' + anchors_arr[i] ).show();
			}

			if ( false ) {
				var targetOffset = wpbc_scroll_to( section_id_to_show );
			}

			// -- Set Value to Input about selected Nav element  ---------------------------------------------------------------       // FixIn: 9.8.6.1.
			var section_id_tab = section_id_to_show.substring( 0, section_id_to_show.length - 8 ) + '_tab';
			if ( container_to_hide_class == section_id_to_show ) {
				section_id_tab = '#wpbc_general_settings_all_tab'
			}
			if ( '#wpbc_general_settings_capacity_metabox,#wpbc_general_settings_capacity_upgrade_metabox' == section_id_to_show ) {
				section_id_tab = '#wpbc_general_settings_capacity_tab'
			}
			jQuery( '#form_visible_section' ).val( section_id_tab );
		}

		// Like blinking some elements.
		wpbc_admin_ui__do__anchor__another_actions();
	}
}

function wpbc_admin_ui__is_in_mobile_screen_size() {
	return wpbc_admin_ui__is_in_this_screen_size( 605 );
}

function wpbc_admin_ui__is_in_this_screen_size(size) {
	return (window.screen.width <= size);
}

/**
 * Open settings page  |  Expand section  |  Select Menu item.
 */
function wpbc_admin_ui__do__open_url__expand_section(url, section_id) {

	// window.location.href = url + '&do_expand=' + section_id + '#do_expand__' + section_id; //.
	window.location.href = url + '#do_expand__' + section_id;

	if ( wpbc_admin_ui__is_in_mobile_screen_size() ) {
		wpbc_admin_ui__sidebar_left__do_min();
	}

	wpbc_admin_ui__do_expand_section();
}


/**
 * Check  for Other actions:  Like blinking some elements in settings page. E.g. Days selection  or  change-over days.
 */
function wpbc_admin_ui__do__anchor__another_actions() {

	var anchors_arr        = wpbc_url_get_anchors_arr();
	var anchors_arr_length = anchors_arr.length;

	// Other actions:  Like blinking some elements.
	for ( var i = 0; i < anchors_arr_length; i++ ) {

		var this_anchor = anchors_arr[i];

		var this_anchor_prop_value = this_anchor.split( 'do_other_actions__' );

		if ( this_anchor_prop_value.length > 1 ) {

			var section_action = this_anchor_prop_value[1];

			switch ( section_action ) {

				case 'blink_day_selections':
					// wpbc_ui_settings__panel__click( '#wpbc_general_settings_calendar_tab a', '#wpbc_general_settings_calendar_metabox', 'Days Selection' );.
					wpbc_blink_element( '.wpbc_tr_set_gen_booking_type_of_day_selections', 4, 350 );
						wpbc_scroll_to( '.wpbc_tr_set_gen_booking_type_of_day_selections' );
					break;

				case 'blink_change_over_days':
					// wpbc_ui_settings__panel__click( '#wpbc_general_settings_calendar_tab a', '#wpbc_general_settings_calendar_metabox', 'Changeover Days' );.
					wpbc_blink_element( '.wpbc_tr_set_gen_booking_range_selection_time_is_active', 4, 350 );
						wpbc_scroll_to( '.wpbc_tr_set_gen_booking_range_selection_time_is_active' );
					break;

				case 'blink_captcha':
					wpbc_blink_element( '.wpbc_tr_set_gen_booking_is_use_captcha', 4, 350 );
						wpbc_scroll_to( '.wpbc_tr_set_gen_booking_is_use_captcha' );
					break;

				default:
			}
		}
	}
}
