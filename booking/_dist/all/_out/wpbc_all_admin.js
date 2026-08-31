"use strict";

/**
 * Blink specific HTML element to set attention to this element.
 *
 * @param {string} element_to_blink		  - class or id of element: '.wpbc_widget_available_unavailable'
 * @param {int} how_many_times			  - 4
 * @param {int} how_long_to_blink		  - 350
 */
function wpbc_blink_element(element_to_blink, how_many_times = 4, how_long_to_blink = 350) {
  for (let i = 0; i < how_many_times; i++) {
    jQuery(element_to_blink).fadeOut(how_long_to_blink).fadeIn(how_long_to_blink);
  }
  jQuery(element_to_blink).animate({
    opacity: 1
  }, 500);
}

/**
 *   Support Functions - Spin Icon in Buttons  ------------------------------------------------------------------ */

/**
 * Remove spin icon from  button and Enable this button.
 *
 * @param button_clicked_element_id		- HTML ID attribute of this button
 * @return string						- CSS classes that was previously in button icon
 */
function wpbc_button__remove_spin(button_clicked_element_id) {
  var previos_classes = '';
  if (undefined != button_clicked_element_id && '' != button_clicked_element_id) {
    var jElement = jQuery('#' + button_clicked_element_id);
    if (jElement.length) {
      previos_classes = wpbc_button_disable_loading_icon(jElement.get(0));
    }
  }
  return previos_classes;
}

/**
 * Show Loading (rotating arrow) icon for button that has been clicked
 *
 * @param this_button		- this object of specific button
 * @return string			- CSS classes that was previously in button icon
 */
function wpbc_button_enable_loading_icon(this_button) {
  var jButton = jQuery(this_button);
  var jIcon = jButton.find('i');
  var previos_classes = jIcon.attr('class');
  jIcon.removeClass().addClass('menu_icon icon-1x wpbc_icn_rotate_right wpbc_spin'); // Set Rotate icon.
  // jIcon.addClass( 'wpbc_animation_pause' );												// Pause animation.
  // jIcon.addClass( 'wpbc_ui_red' );														// Set icon color red.

  jIcon.attr('wpbc_previous_class', previos_classes);
  jButton.addClass('disabled'); // Disable button
  // We need to  set  here attr instead of prop, because for A elements,  attribute 'disabled' do  not added with jButton.prop( "disabled", true );.

  jButton.attr('wpbc_previous_onclick', jButton.attr('onclick')); // Save this value.
  jButton.attr('onclick', ''); // Disable actions "on click".

  return previos_classes;
}

/**
 * Hide Loading (rotating arrow) icon for button that was clicked and show previous icon and enable button
 *
 * @param this_button		- this object of specific button
 * @return string			- CSS classes that was previously in button icon
 */
function wpbc_button_disable_loading_icon(this_button) {
  var jButton = jQuery(this_button);
  var jIcon = jButton.find('i');
  var previos_classes = jIcon.attr('wpbc_previous_class');
  if (undefined != previos_classes && '' != previos_classes) {
    jIcon.removeClass().addClass(previos_classes);
  }
  jButton.removeClass('disabled'); // Remove Disable button.

  var previous_onclick = jButton.attr('wpbc_previous_onclick');
  if (undefined != previous_onclick && '' != previous_onclick) {
    jButton.attr('onclick', previous_onclick);
  }
  return previos_classes;
}

/**
 * On selection  of radio button, adjust attributes of radio container
 *
 * @param _this
 */
function wpbc_ui_el__radio_container_selection(_this) {
  if (jQuery(_this).is(':checked')) {
    jQuery(_this).parents('.wpbc_ui_radio_section').find('.wpbc_ui_radio_container').removeAttr('data-selected');
    jQuery(_this).parents('.wpbc_ui_radio_container:not(.disabled)').attr('data-selected', true);
  }
  if (jQuery(_this).is(':disabled')) {
    jQuery(_this).parents('.wpbc_ui_radio_container').addClass('disabled');
  }
}

/**
 * On click on Radio Container, we will  select  the  radio button    and then adjust attributes of radio container
 *
 * @param _this
 */
function wpbc_ui_el__radio_container_click(_this) {
  if (jQuery(_this).hasClass('disabled')) {
    return false;
  }
  var j_radio = jQuery(_this).find('input[type=radio]:not(.wpbc-form-radio-internal)');
  if (j_radio.length) {
    j_radio.prop('checked', true).trigger('change');
  }
}
"use strict";
// =====================================================================================================================
// == Full Screen  -  support functions   ==
// =====================================================================================================================

/**
 * Return every cookie path that can apply to the current WordPress admin URL.
 *
 * WordPress may run from a subdirectory. Updating the root, site, and admin
 * paths prevents an older, more-specific cookie from overriding the new mode.
 *
 * @return {string[]} Unique absolute cookie paths.
 */
function wpbc_admin_ui__full_screen__get_cookie_paths() {
  var cookie_paths = ['/'];
  var admin_marker = '/wp-admin/';
  var current_path = window.location && window.location.pathname ? window.location.pathname : '';
  var admin_index = current_path.indexOf(admin_marker);
  if (admin_index >= 0) {
    cookie_paths.push(current_path.substring(0, admin_index + 1));
    cookie_paths.push(current_path.substring(0, admin_index + admin_marker.length));
  }
  return cookie_paths.filter(function (path, index) {
    return path && cookie_paths.indexOf(path) === index;
  });
}

/**
 * Save Full Screen preference in a short-lived browser cookie.
 *
 * This makes the next admin page load deterministic even if the asynchronous
 * user-meta request is interrupted. The timestamp lets PHP distinguish this
 * pending value from a stale legacy cookie.
 *
 * @param {string} value Fullscreen mode, either `On` or `Off`.
 *
 * @return {void}
 */
function wpbc_admin_ui__full_screen__set_cookie(value) {
  var max_age = 5 * 60;
  var issued_at = Math.floor(Date.now() / 1000);
  var cookie_value = encodeURIComponent(value + '|' + issued_at);
  wpbc_admin_ui__full_screen__get_cookie_paths().forEach(function (cookie_path) {
    document.cookie = 'wpbc_admin_full_screen=' + cookie_value + '; path=' + cookie_path + '; max-age=' + max_age + '; SameSite=Lax';
  });
}

/**
 * Apply Full Screen mode from a user click.
 *
 * @param HTMLElement el                 Clicked control.
 * @param bool        is_save_user_state Whether to save user preference.
 */
function wpbc_admin_ui__full_screen__do_on(el, is_save_user_state) {
  jQuery('body').addClass('wpbc_admin_full_screen');
  wpbc_check_full_screen_mode();
  if (is_save_user_state) {
    wpbc_admin_ui__full_screen__set_cookie('On');
    if ('function' === typeof wpbc_save_custom_user_data_from_element) {
      wpbc_save_custom_user_data_from_element(el);
    }
  }
}

/**
 * Exit Full Screen mode from a user click.
 *
 * @param HTMLElement el                 Clicked control.
 * @param bool        is_save_user_state Whether to save user preference.
 */
function wpbc_admin_ui__full_screen__do_off(el, is_save_user_state) {
  jQuery('body').removeClass('wpbc_admin_full_screen');
  wpbc_check_full_screen_mode();
  if (is_save_user_state) {
    wpbc_admin_ui__full_screen__set_cookie('Off');
    if ('function' === typeof wpbc_save_custom_user_data_from_element) {
      wpbc_save_custom_user_data_from_element(el);
    }
  }
}

/**
 * Check Full  screen mode,  by  removing top tab
 */
function wpbc_check_full_screen_mode() {
  if (jQuery('body').hasClass('wpbc_admin_full_screen')) {
    jQuery('html').removeClass('wp-toolbar');
  } else {
    jQuery('html').addClass('wp-toolbar');
  }
  wpbc_check_buttons_max_min_in_full_screen_mode();
}
function wpbc_check_buttons_max_min_in_full_screen_mode() {
  if (jQuery('body').hasClass('wpbc_admin_full_screen')) {
    jQuery('.wpbc_ui__top_nav__btn_full_screen').addClass('wpbc_ui__hide');
    jQuery('.wpbc_ui__top_nav__btn_normal_screen').removeClass('wpbc_ui__hide');
  } else {
    jQuery('.wpbc_ui__top_nav__btn_full_screen').removeClass('wpbc_ui__hide');
    jQuery('.wpbc_ui__top_nav__btn_normal_screen').addClass('wpbc_ui__hide');
  }
}
jQuery(document).ready(function () {
  wpbc_check_full_screen_mode();
});

/**
 * Checkbox Selection functions for Listing.
 */

/**
 * Selections of several  checkboxes like in gMail with shift :)
 * Need to  have this structure:
 * .wpbc_selectable_table
 *      .wpbc_selectable_head
 *              .check-column
 *                  :checkbox
 *      .wpbc_selectable_body
 *          .wpbc_row
 *              .check-column
 *                  :checkbox
 *      .wpbc_selectable_foot
 *              .check-column
 *                  :checkbox
 */
function wpbc_define_gmail_checkbox_selection($) {
  var checks,
    first,
    last,
    checked,
    sliced,
    lastClicked = false;

  // Check all checkboxes.
  $('.wpbc_selectable_body').find('.check-column').find(':checkbox').on('click', function (e) {
    if ('undefined' == e.shiftKey) {
      return true;
    }
    if (e.shiftKey) {
      if (!lastClicked) {
        return true;
      }
      checks = $(lastClicked).closest('.wpbc_selectable_body').find(':checkbox').filter(':visible:enabled');
      first = checks.index(lastClicked);
      last = checks.index(this);
      checked = $(this).prop('checked');
      if (0 < first && 0 < last && first != last) {
        sliced = last > first ? checks.slice(first, last) : checks.slice(last, first);
        sliced.prop('checked', function () {
          if ($(this).closest('.wpbc_row').is(':visible')) {
            return checked;
          }
          return false;
        }).trigger('change');
      }
    }
    lastClicked = this;

    // toggle "check all" checkboxes.
    var unchecked = $(this).closest('.wpbc_selectable_body').find(':checkbox').filter(':visible:enabled').not(':checked');
    $(this).closest('.wpbc_selectable_table').children('.wpbc_selectable_head, .wpbc_selectable_foot').find(':checkbox').prop('checked', function () {
      return 0 === unchecked.length;
    }).trigger('change');
    return true;
  });

  // Head || Foot clicking to  select / deselect ALL.
  $('.wpbc_selectable_head, .wpbc_selectable_foot').find('.check-column :checkbox').on('click', function (event) {
    var $this = $(this),
      $table = $this.closest('.wpbc_selectable_table'),
      controlChecked = $this.prop('checked'),
      toggle = event.shiftKey || $this.data('wp-toggle');
    $table.children('.wpbc_selectable_body').filter(':visible').find('.check-column').find(':checkbox').prop('checked', function () {
      if ($(this).is(':hidden,:disabled')) {
        return false;
      }
      if (toggle) {
        return !$(this).prop('checked');
      } else if (controlChecked) {
        return true;
      }
      return false;
    }).trigger('change');
    $table.children('.wpbc_selectable_head,  .wpbc_selectable_foot').filter(':visible').find('.check-column').find(':checkbox').prop('checked', function () {
      if (toggle) {
        return false;
      } else if (controlChecked) {
        return true;
      }
      return false;
    });
  });

  // Visually  show selected border.
  $('.wpbc_selectable_body').find('.check-column :checkbox').on('change', function (event) {
    if (jQuery(this).is(':checked')) {
      jQuery(this).closest('.wpbc_list_row').addClass('row_selected_color');
    } else {
      jQuery(this).closest('.wpbc_list_row').removeClass('row_selected_color');
    }

    // Disable text selection while pressing 'shift'.
    document.getSelection().removeAllRanges();

    // Show or hide buttons on Actions toolbar  at  Booking Listing  page,  if we have some selected bookings.
    wpbc_show_hide_action_buttons_for_selected_bookings();
  });
  wpbc_show_hide_action_buttons_for_selected_bookings();
}

/**
 * Get ID array  of selected elements
 */
function wpbc_get_selected_row_id() {
  var $table = jQuery('.wpbc__wrap__booking_listing .wpbc_selectable_table');
  var checkboxes = $table.children('.wpbc_selectable_body').filter(':visible').find('.check-column').find(':checkbox');
  var selected_id = [];
  jQuery.each(checkboxes, function (key, checkbox) {
    if (jQuery(checkbox).is(':checked')) {
      var element_id = wpbc_get_row_id_from_element(checkbox);
      selected_id.push(element_id);
    }
  });
  return selected_id;
}

/**
 * Get ID of row,  based on clciked element
 *
 * @param this_inbound_element  - ususlly  this
 * @returns {number}
 */
function wpbc_get_row_id_from_element(this_inbound_element) {
  var element_id = jQuery(this_inbound_element).closest('.wpbc_listing_usual_row').attr('id');
  element_id = parseInt(element_id.replace('row_id_', ''));
  return element_id;
}

/**
 * == Booking Listing == Show or hide buttons on Actions toolbar  at    page,  if we have some selected bookings.
 */
function wpbc_show_hide_action_buttons_for_selected_bookings() {
  var selected_rows_arr = wpbc_get_selected_row_id();
  if (selected_rows_arr.length > 0) {
    jQuery('.hide_button_if_no_selection').show();
  } else {
    jQuery('.hide_button_if_no_selection').hide();
  }
}
"use strict";
// =====================================================================================================================
// == Left Bar  -  expand / colapse functions   ==
// =====================================================================================================================

/**
 * Save user's preferred left sidebar mode.
 *
 * @param string mode
 */
function wpbc_admin_ui__sidebar_left__save_mode(mode) {
  var allowed_modes = ['min', 'compact', 'max'];
  if (allowed_modes.indexOf(mode) === -1) {
    return;
  }
  var $saver = jQuery('#wpbc_left_sidebar_view_mode_saver');
  if (!$saver.length) {
    return;
  }
  if ('function' !== typeof wpbc_save_custom_user_data_from_element) {
    return;
  }
  $saver.data('wpbc-u-save-value', mode);
  $saver.attr('data-wpbc-u-save-value', mode);
  wpbc_save_custom_user_data_from_element($saver.get(0));
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
function wpbc_admin_ui__sidebar_left__scroll_to_active_item(simplebar_instance) {
  var left_navigation_element = document.querySelector('.wpbc_ui_el__vert_left_bar__content');
  if (!simplebar_instance && 'undefined' !== typeof SimpleBar && SimpleBar.instances && left_navigation_element) {
    simplebar_instance = SimpleBar.instances.get(left_navigation_element);
  }
  if (!simplebar_instance || 'function' !== typeof simplebar_instance.getScrollElement || 'function' !== typeof simplebar_instance.getContentElement) {
    return;
  }
  window.requestAnimationFrame(function () {
    var scroll_element = simplebar_instance.getScrollElement();
    var content_element = simplebar_instance.getContentElement();
    if (!scroll_element || !content_element || !content_element.closest('.wpbc_ui_el__vert_left_bar__content')) {
      return;
    }
    simplebar_instance.recalculate();
    var active_item = content_element.querySelector('.wpbc_ui_el__vert_nav_item.active');
    if (!active_item || null === active_item.offsetParent || 0 >= scroll_element.clientHeight) {
      return;
    }
    var scroll_rect = scroll_element.getBoundingClientRect();
    var active_rect = active_item.getBoundingClientRect();
    var current_top = scroll_element.scrollTop;
    var leading_offset = 85;
    var active_top = current_top + active_rect.top - scroll_rect.top;
    var target_top = active_top - leading_offset;
    var maximum_top = Math.max(0, scroll_element.scrollHeight - scroll_element.clientHeight);
    scroll_element.scrollTop = Math.max(0, Math.min(Math.round(target_top), maximum_top));
  });
}

/**
 * Expand Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_max(is_save_user_state) {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('max');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wp-admin').removeClass('wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none');
  jQuery('.wp-admin').addClass('wpbc_page_wrapper_left_max');
  wpbc_admin_ui__sidebar_left__scroll_to_active_item();
  if (is_save_user_state) {
    wpbc_admin_ui__sidebar_left__save_mode('max');
  }
}

/**
 * Hide Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_min(is_save_user_state) {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('min');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wp-admin').removeClass('wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none');
  jQuery('.wp-admin').addClass('wpbc_page_wrapper_left_min');
  if (is_save_user_state) {
    wpbc_admin_ui__sidebar_left__save_mode('min');
  }
}

/**
 * Colapse Vertical Left Bar.
 *
 * @param bool is_save_user_state Save this mode as user's preference.
 */
function wpbc_admin_ui__sidebar_left__do_compact(is_save_user_state) {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('compact');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wp-admin').removeClass('wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none');
  jQuery('.wp-admin').addClass('wpbc_page_wrapper_left_compact');
  wpbc_admin_ui__sidebar_left__scroll_to_active_item();
  if (is_save_user_state) {
    wpbc_admin_ui__sidebar_left__save_mode('compact');
  }
}

/**
 * Completely Hide Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_hide() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('none');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').addClass('wpbc_ui__hide');
  // Hide top "Menu" button with divider.
  jQuery('.wpbc_ui__top_nav__btn_show_left_vertical_nav,.wpbc_ui__top_nav__btn_show_left_vertical_nav_divider').addClass('wpbc_ui__hide');
  jQuery('.wp-admin').removeClass('wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none');
  jQuery('.wp-admin').addClass('wpbc_page_wrapper_left_none');
}

/**
 * Action on click "Go Back" - show root menu
 * or some other section in left sidebar.
 *
 * @param string menu_to_show - menu slug.
 */
function wpbc_admin_ui__sidebar_left__show_section(menu_to_show) {
  jQuery('.wpbc_ui_el__vert_left_bar__section').addClass('wpbc_ui__hide');
  jQuery('.wpbc_ui_el__vert_left_bar__section_' + menu_to_show).removeClass('wpbc_ui__hide');
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
function wpbc_admin_ui__sidebar_right__set_body_open_state(is_open) {
  jQuery('body').toggleClass('wpbc_ui_el__vert_right_bar__wrapper_opened', !!is_open);
}

/**
 * Expand Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_max() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min_right max_right compact_right none_right');
  jQuery('.wpbc_settings_page_wrapper').addClass('max_right');
  jQuery('.wpbc_ui__top_nav__btn_open_right_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_right_vertical_nav').removeClass('wpbc_ui__hide');
  wpbc_admin_ui__sidebar_right__set_body_open_state(true);
}

/**
 * Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_min() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min_right max_right compact_right none_right');
  jQuery('.wpbc_settings_page_wrapper').addClass('min_right');
  jQuery('.wpbc_ui__top_nav__btn_open_right_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_right_vertical_nav').addClass('wpbc_ui__hide');
  wpbc_admin_ui__sidebar_right__set_body_open_state(false);
}

/**
 * Colapse Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_compact() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min_right max_right compact_right none_right');
  jQuery('.wpbc_settings_page_wrapper').addClass('compact_right');
  jQuery('.wpbc_ui__top_nav__btn_open_right_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_right_vertical_nav').addClass('wpbc_ui__hide');
  wpbc_admin_ui__sidebar_right__set_body_open_state(false);
}

/**
 * Completely Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_hide() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min_right max_right compact_right none_right');
  jQuery('.wpbc_settings_page_wrapper').addClass('none_right');
  jQuery('.wpbc_ui__top_nav__btn_open_right_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_right_vertical_nav').addClass('wpbc_ui__hide');
  // Hide top "Menu" button with divider.
  jQuery('.wpbc_ui__top_nav__btn_show_right_vertical_nav,.wpbc_ui__top_nav__btn_show_right_vertical_nav_divider').addClass('wpbc_ui__hide');
  wpbc_admin_ui__sidebar_right__set_body_open_state(false);
}

/**
 * Restore the body marker when a page renders with the right sidebar open.
 */
jQuery(document).ready(function () {
  wpbc_admin_ui__sidebar_right__set_body_open_state(0 < jQuery('.wpbc_settings_page_wrapper.max_right').length);
});

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
function wpbc_admin_ui__sidebar_right__collapse_from_content_click(event) {
  var event_target = event.target && 1 === event.target.nodeType ? event.target : null;
  var content_element = event_target && 'function' === typeof event_target.closest ? event_target.closest('.wpbc_settings_page_wrapper[data-wpbc-right-sidebar-content-click-collapse-mode] > .wpbc_settings_page_content') : null;
  var $content;
  var $wrapper;
  var collapse_mode;
  var before_collapse_event;
  if (!content_element) {
    return;
  }
  $content = jQuery(content_element);
  $wrapper = $content.closest('.wpbc_settings_page_wrapper');
  collapse_mode = String($wrapper.attr('data-wpbc-right-sidebar-content-click-collapse-mode') || '');
  if (!$wrapper.hasClass('max_right') || ['min', 'compact', 'none'].indexOf(collapse_mode) === -1) {
    return;
  }
  if (jQuery(event.target).closest('[data-wpbc-right-sidebar-keep-open]').length) {
    return;
  }

  /*
   * This click belongs to the open-sidebar dismissal layer. Consume it before
   * domain row handlers run so the same pointer action cannot close one
   * inspector and immediately open another one underneath it.
   */
  event.preventDefault();
  event.stopImmediatePropagation();
  before_collapse_event = jQuery.Event('wpbc:right-sidebar-before-content-collapse');
  $wrapper.trigger(before_collapse_event, [event]);
  if (before_collapse_event.isDefaultPrevented()) {
    return;
  }
  if ('compact' === collapse_mode) {
    wpbc_admin_ui__sidebar_right__do_compact();
  } else if ('none' === collapse_mode) {
    wpbc_admin_ui__sidebar_right__do_hide();
  } else {
    wpbc_admin_ui__sidebar_right__do_min();
  }
  jQuery(document).trigger('wpbc_setup_wizard_layout_changed');
}
document.addEventListener('click', wpbc_admin_ui__sidebar_right__collapse_from_content_click, true);

/**
 * Action on click "Go Back" - show root menu
 * or some other section in right sidebar.
 *
 * @param string menu_to_show - menu slug.
 */
function wpbc_admin_ui__sidebar_right__show_section(menu_to_show) {
  jQuery('.wpbc_ui_el__vert_right_bar__section').addClass('wpbc_ui__hide');
  jQuery('.wpbc_ui_el__vert_right_bar__section_' + menu_to_show).removeClass('wpbc_ui__hide');
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
  var hashes = window.location.hash.replace('%23', '#');
  var hashes_arr = hashes.split('#');
  var result = [];
  var hashes_arr_length = hashes_arr.length;
  for (var i = 0; i < hashes_arr_length; i++) {
    if (hashes_arr[i].length > 0) {
      result.push(hashes_arr[i]);
    }
  }
  return result;
}

/**
 * Auto Expand Settings section based on URL anchor, after  page loaded.
 */
jQuery(document).ready(function () {
  wpbc_admin_ui__redirect_legacy_general_availability_url();
});
jQuery(document).ready(function () {
  wpbc_admin_ui__do_expand_section();
  setTimeout('wpbc_admin_ui__do_expand_section', 10);
});
jQuery(document).ready(function () {
  wpbc_admin_ui__do_expand_section();
  setTimeout('wpbc_admin_ui__do_expand_section', 150);
});

/**
 * Redirect old Settings > Availability anchors to the dedicated General Availability page.
 */
function wpbc_admin_ui__redirect_legacy_general_availability_url() {
  if (window.location.href.indexOf('page=wpbc-settings') > -1 && (window.location.hash.indexOf('wpbc_general_settings_availability_metabox') > -1 || window.location.hash.indexOf('wpbc_general_settings_availability_tab') > -1)) {
    window.location.replace(window.location.href.split('?')[0] + '?page=wpbc-availability&tab=general_availability');
  }
}

/**
 * Expand section in  General Settings page and select Menu item.
 */
function wpbc_admin_ui__do_expand_section() {
  // window.location.hash  = #section_id  /  doc: https://developer.mozilla.org/en-US/docs/Web/API/Location .
  var anchors_arr = wpbc_url_get_anchors_arr();
  var anchors_arr_length = anchors_arr.length;
  if (anchors_arr_length > 0) {
    var one_anchor_prop_value = anchors_arr[0].split('do_expand__');
    if (one_anchor_prop_value.length > 1) {
      // 'wpbc_general_settings_calendar_metabox'
      var section_to_show = one_anchor_prop_value[1];
      var section_id_to_show = '#' + section_to_show;

      // -- Remove selected background in all left  menu  items ---------------------------------------------------
      jQuery('.wpbc_ui_el__vert_nav_item ').removeClass('active');
      // Set left menu selected.
      jQuery('.do_expand__' + section_to_show + '_link').addClass('active');
      var selected_title = jQuery('.do_expand__' + section_to_show + '_link a .wpbc_ui_el__vert_nav_title ').text();

      // Expand section, if it colapsed.
      if (!jQuery('.do_expand__' + section_to_show + '_link').parents('.wpbc_ui_el__level__folder').hasClass('expanded')) {
        jQuery('.wpbc_ui_el__level__folder').removeClass('expanded');
        jQuery('.do_expand__' + section_to_show + '_link').parents('.wpbc_ui_el__level__folder').addClass('expanded');
      }

      // -- Expand section ---------------------------------------------------------------------------------------
      var container_to_hide_class = '.postbox';
      // Hide sections '.postbox' in admin page and show specific one.
      jQuery('.wpbc_admin_page ' + container_to_hide_class).hide();
      jQuery('.wpbc_container_always_hide__on_left_nav_click').hide();
      jQuery(section_id_to_show).show();

      // Show all other sections,  if provided in URL: ..?page=wpbc-settings#do_expand__wpbc_general_settings_capacity_metabox#wpbc_general_settings_capacity_upgrade_metabox .
      for (let i = 1; i < anchors_arr_length; i++) {
        jQuery('#' + anchors_arr[i]).show();
      }
      if (false) {
        var targetOffset = wpbc_scroll_to(section_id_to_show);
      }

      // -- Set Value to Input about selected Nav element  ---------------------------------------------------------------       // FixIn: 9.8.6.1.
      var section_id_tab = section_id_to_show.substring(0, section_id_to_show.length - 8) + '_tab';
      if (container_to_hide_class == section_id_to_show) {
        section_id_tab = '#wpbc_general_settings_all_tab';
      }
      if ('#wpbc_general_settings_capacity_metabox,#wpbc_general_settings_capacity_upgrade_metabox' == section_id_to_show) {
        section_id_tab = '#wpbc_general_settings_capacity_tab';
      }
      jQuery('#form_visible_section').val(section_id_tab);
    }

    // Like blinking some elements.
    wpbc_admin_ui__do__anchor__another_actions();
  }
}
function wpbc_admin_ui__is_in_mobile_screen_size() {
  return wpbc_admin_ui__is_in_this_screen_size(605);
}
function wpbc_admin_ui__is_in_this_screen_size(size) {
  return window.screen.width <= size;
}

/**
 * Open settings page  |  Expand section  |  Select Menu item.
 */
function wpbc_admin_ui__do__open_url__expand_section(url, section_id) {
  // window.location.href = url + '&do_expand=' + section_id + '#do_expand__' + section_id; //.
  window.location.href = url + '#do_expand__' + section_id;
  if (wpbc_admin_ui__is_in_mobile_screen_size()) {
    wpbc_admin_ui__sidebar_left__do_min();
  }
  wpbc_admin_ui__do_expand_section();
}

/**
 * Check  for Other actions:  Like blinking some elements in settings page. E.g. Days selection  or  change-over days.
 */
function wpbc_admin_ui__do__anchor__another_actions() {
  var anchors_arr = wpbc_url_get_anchors_arr();
  var anchors_arr_length = anchors_arr.length;

  // Other actions:  Like blinking some elements.
  for (var i = 0; i < anchors_arr_length; i++) {
    var this_anchor = anchors_arr[i];
    var this_anchor_prop_value = this_anchor.split('do_other_actions__');
    if (this_anchor_prop_value.length > 1) {
      var section_action = this_anchor_prop_value[1];
      switch (section_action) {
        case 'blink_day_selections':
          // wpbc_ui_settings__panel__click( '#wpbc_general_settings_calendar_tab a', '#wpbc_general_settings_calendar_metabox', 'Days Selection' );.
          wpbc_blink_element('.wpbc_tr_set_gen_booking_type_of_day_selections', 4, 350);
          wpbc_scroll_to('.wpbc_tr_set_gen_booking_type_of_day_selections');
          break;
        case 'blink_change_over_days':
          // wpbc_ui_settings__panel__click( '#wpbc_general_settings_calendar_tab a', '#wpbc_general_settings_calendar_metabox', 'Changeover Days' );.
          wpbc_blink_element('.wpbc_tr_set_gen_booking_range_selection_time_is_active', 4, 350);
          wpbc_scroll_to('.wpbc_tr_set_gen_booking_range_selection_time_is_active');
          break;
        case 'blink_captcha':
          wpbc_blink_element('.wpbc_tr_set_gen_booking_is_use_captcha', 4, 350);
          wpbc_scroll_to('.wpbc_tr_set_gen_booking_is_use_captcha');
          break;
        default:
      }
    }
  }
}

/**
 * Copy txt to clipbrd from Text fields.
 *
 * @param html_element_id  - e.g. 'data_field'
 * @returns {boolean}
 */
function wpbc_copy_text_to_clipbrd_from_element(html_element_id) {
  // Get the text field.
  var copyText = document.getElementById(html_element_id);

  // Select the text field.
  copyText.select();
  copyText.setSelectionRange(0, 99999); // For mobile devices.

  // Copy the text inside the text field.
  var is_copied = wpbc_copy_text_to_clipbrd(copyText.value);
  if (!is_copied) {
    console.error('Oops, unable to copy', copyText.value);
  }
  return is_copied;
}

/**
 * Copy txt to clipbrd.
 *
 * @param text
 * @returns {boolean}
 */
function wpbc_copy_text_to_clipbrd(text) {
  if (!navigator.clipboard) {
    return wpbc_fallback_copy_text_to_clipbrd(text);
  }
  navigator.clipboard.writeText(text).then(function () {
    // console.log( 'Async: Copying to clipboard was successful!' );.
    return true;
  }, function (err) {
    // console.error( 'Async: Could not copy text: ', err );.
    return false;
  });
}

/**
 * Copy txt to clipbrd - depricated method.
 *
 * @param text
 * @returns {boolean}
 */
function wpbc_fallback_copy_text_to_clipbrd(text) {
  // -----------------------------------------------------------------------------------------------------------------
  // var textArea   = document.createElement( "textarea" );
  // textArea.value = text;
  //
  // // Avoid scrolling to bottom.
  // textArea.style.top      = "0";
  // textArea.style.left     = "0";
  // textArea.style.position = "fixed";
  // textArea.style.zIndex   = "999999999";
  // document.body.appendChild( textArea );
  // textArea.focus();
  // textArea.select();

  // -----------------------------------------------------------------------------------------------------------------
  // Now get it as HTML  (original here https://stackoverflow.com/questions/34191780/javascript-copy-string-to-clipboard-as-text-html ).

  // [1] - Create container for the HTML.
  var container = document.createElement('div');
  container.innerHTML = text;

  // [2] - Hide element.
  container.style.position = 'fixed';
  container.style.pointerEvents = 'none';
  container.style.opacity = 0;

  // Detect all style sheets of the page.
  var activeSheets = Array.prototype.slice.call(document.styleSheets).filter(function (sheet) {
    return !sheet.disabled;
  });

  // [3] - Mount the container to the DOM to make `contentWindow` available.
  document.body.appendChild(container);

  // [4] - Copy to clipboard.
  window.getSelection().removeAllRanges();
  var range = document.createRange();
  range.selectNode(container);
  window.getSelection().addRange(range);
  // -----------------------------------------------------------------------------------------------------------------

  var result = false;
  try {
    result = document.execCommand('copy');
    // console.log( 'Fallback: Copying text command was ' + msg ); //.
  } catch (err) {
    // console.error( 'Fallback: Oops, unable to copy', err ); //.
  }
  // document.body.removeChild( textArea ); //.

  // [5.4] - Enable CSS.
  var activeSheets_length = activeSheets.length;
  for (var i = 0; i < activeSheets_length; i++) {
    activeSheets[i].disabled = false;
  }

  // [6] - Remove the container
  document.body.removeChild(container);
  return result;
}
/**
 * WPBC Collapsible Groups
 *
 * Universal, dependency-free controller for expanding/collapsing grouped sections in right-side panels (Inspector/Library/Form Settings, or any other WPBC page).
 *
 * 		=== How to use it (quick) ? ===
 *
 *		-- 1. Markup (independent mode: multiple open allowed) --
 *			<div class="wpbc_collapsible">
 *			  <section class="wpbc_ui__collapsible_group is-open">
 *				<button type="button" class="group__header"><h3>General</h3></button>
 *				<div class="group__fields">…</div>
 *			  </section>
 *			  <section class="wpbc_ui__collapsible_group">
 *				<button type="button" class="group__header"><h3>Advanced</h3></button>
 *				<div class="group__fields">…</div>
 *			  </section>
 *			</div>
 *
 *		-- 2. Exclusive/accordion mode (one open at a time) --
 *			<div class="wpbc_collapsible wpbc_collapsible--exclusive">…</div>
 *
 *		-- 3. Auto-init --
 *			The script auto-initializes on DOMContentLoaded. No extra code needed.
 *
 *		-- 4. Programmatic control (optional)
 *			const root = document.querySelector('#wpbc_bfb__inspector');
 *			const api  = root.__wpbc_collapsible_instance; // set by auto-init
 *
 *			api.open_by_heading('Validation'); // open by heading text
 *			api.open_by_index(0);              // open the first group
 *
 *		-- 5.Listen to events (e.g., to persist “open group” state) --
 *			root.addEventListener('wpbc:collapsible:open',  (e) => { console.log(  e.detail.group ); });
 *			root.addEventListener('wpbc:collapsible:close', (e) => { console.log(  e.detail.group ); });
 *
 *
 *
 * Markup expectations (minimal):
 *  <div class="wpbc_collapsible [wpbc_collapsible--exclusive]">
 *    <section class="wpbc_ui__collapsible_group [is-open]">
 *      <button type="button" class="group__header"> ... </button>
 *      <div class="group__fields"> ... </div>
 *    </section>
 *    ... more <section> ...
 *  </div>
 *
 * Notes:
 *  - Add `is-open` to any section you want initially expanded.
 *  - Add `wpbc_collapsible--exclusive` to the container for "open one at a time" behavior.
 *  - Works with your existing BFB markup (classes used there are the defaults).
 *
 * Accessibility:
 *  - Sets aria-expanded on .group__header
 *  - Sets aria-hidden + [hidden] on .group__fields
 *  - ArrowUp/ArrowDown move focus between headers; Enter/Space toggles
 *
 * Events (bubbles from the <section>):
 *  - 'wpbc:collapsible:open'  (detail: { group, root, instance })
 *  - 'wpbc:collapsible:close' (detail: { group, root, instance })
 *
 * Public API (instance methods):
 *  - init(), destroy(), refresh()
 *  - expand(group, [exclusive]), collapse(group), toggle(group)
 *  - open_by_index(index), open_by_heading(text)
 *  - is_exclusive(), is_open(group)
 *
 * @version 2025-08-26
 * @since 2025-08-26
 */
// ---------------------------------------------------------------------------------------------------------------------
// == File  /collapsible_groups.js == Time point: 2025-08-26 14:13
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
  'use strict';

  class WPBC_Collapsible_Groups {
    /**
     * Create a collapsible controller for a container.
     *
     * @param {HTMLElement|string} root_el
     *        The container element (or CSS selector) that wraps collapsible groups.
     *        The container usually has the class `.wpbc_collapsible`.
     * @param {Object} [opts={}]
     * @param {string}  [opts.group_selector='.wpbc_ui__collapsible_group']
     *        Selector for each collapsible group inside the container.
     * @param {string}  [opts.header_selector='.group__header']
     *        Selector for the clickable header inside a group.
     * @param {string}  [opts.fields_selector='.group__fields']
     *        Selector for the content/panel element inside a group.
     * @param {string}  [opts.open_class='is-open']
     *        Class name that indicates the group is open.
     * @param {boolean} [opts.exclusive=false]
     *        If true, only one group can be open at a time in this container.
     *
     * @constructor
     * @since 2025-08-26
     */
    constructor(root_el, opts = {}) {
      this.root = typeof root_el === 'string' ? d.querySelector(root_el) : root_el;
      this.opts = Object.assign({
        group_selector: '.wpbc_ui__collapsible_group',
        header_selector: '.group__header',
        fields_selector: '.group__fields,.group__content',
        open_class: 'is-open',
        exclusive: false
      }, opts);

      // Bound handlers (for add/removeEventListener symmetry).
      /** @private */
      this._on_click = this._on_click.bind(this);
      /** @private */
      this._on_keydown = this._on_keydown.bind(this);

      /** @type {HTMLElement[]} @private */
      this._groups = [];
      /** @type {MutationObserver|null} @private */
      this._observer = null;
    }

    /**
     * Initialize the controller: cache groups, attach listeners, set ARIA,
     * and start observing DOM changes inside the container.
     *
     * @returns {WPBC_Collapsible_Groups} The instance (chainable).
     * @listens click
     * @listens keydown
     * @since 2025-08-26
     */
    init() {
      if (!this.root) {
        return this;
      }
      this._groups = Array.prototype.slice.call(this.root.querySelectorAll(this.opts.group_selector));
      this.root.addEventListener('click', this._on_click, false);
      this.root.addEventListener('keydown', this._on_keydown, false);

      // Observe dynamic inserts/removals (Inspector re-renders).
      this._observer = new MutationObserver(() => {
        this.refresh();
      });
      this._observer.observe(this.root, {
        childList: true,
        subtree: true
      });
      this._sync_all_aria();
      return this;
    }

    /**
     * Tear down the controller: detach listeners, stop the observer,
     * and drop internal references.
     *
     * @returns {void}
     * @since 2025-08-26
     */
    destroy() {
      if (!this.root) {
        return;
      }
      this.root.removeEventListener('click', this._on_click, false);
      this.root.removeEventListener('keydown', this._on_keydown, false);
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      this._groups = [];
    }

    /**
     * Re-scan the DOM for current groups and re-apply ARIA to all of them.
     * Useful after dynamic (re)renders.
     *
     * @returns {void}
     * @since 2025-08-26
     */
    refresh() {
      if (!this.root) {
        return;
      }
      this._groups = Array.prototype.slice.call(this.root.querySelectorAll(this.opts.group_selector));
      this._sync_all_aria();
    }

    /**
     * Check whether the container is in exclusive (accordion) mode.
     *
     * Order of precedence:
     *  1) Explicit option `opts.exclusive`
     *  2) Container has class `.wpbc_collapsible--exclusive`
     *  3) Container matches `[data-wpbc-accordion="exclusive"]`
     *
     * @returns {boolean} True if exclusive mode is active.
     * @since 2025-08-26
     */
    is_exclusive() {
      return !!(this.opts.exclusive || this.root.classList.contains('wpbc_collapsible--exclusive') || this.root.matches('[data-wpbc-accordion="exclusive"]'));
    }

    /**
     * Determine whether a specific group is open.
     *
     * @param {HTMLElement} group The group element to test.
     * @returns {boolean} True if the group is currently open.
     * @since 2025-08-26
     */
    is_open(group) {
      return group.classList.contains(this.opts.open_class);
    }

    /**
     * Open a group. Honors exclusive mode by collapsing all sibling groups
     * (queried from the live DOM at call-time).
     *
     * @param {HTMLElement} group The group element to open.
     * @param {boolean} [exclusive]
     *        If provided, overrides container mode for this action only.
     * @returns {void}
     * @fires CustomEvent#wpbc:collapsible:open
     * @since 2025-08-26
     */
    expand(group, exclusive) {
      if (!group) {
        return;
      }
      const do_exclusive = typeof exclusive === 'boolean' ? exclusive : this.is_exclusive();
      if (do_exclusive) {
        // Always use the live DOM, not the cached list.
        Array.prototype.forEach.call(this.root.querySelectorAll(this.opts.group_selector), g => {
          if (g !== group) {
            this._set_open(g, false);
          }
        });
      }
      this._set_open(group, true);
    }

    /**
     * Close a group.
     *
     * @param {HTMLElement} group The group element to close.
     * @returns {void}
     * @fires CustomEvent#wpbc:collapsible:close
     * @since 2025-08-26
     */
    collapse(group) {
      if (!group) {
        return;
      }
      this._set_open(group, false);
    }

    /**
     * Toggle a group's open/closed state.
     *
     * @param {HTMLElement} group The group element to toggle.
     * @returns {void}
     * @since 2025-08-26
     */
    toggle(group) {
      if (!group) {
        return;
      }
      this[this.is_open(group) ? 'collapse' : 'expand'](group);
    }

    /**
     * Open a group by its index within the container (0-based).
     *
     * @param {number} index Zero-based index of the group.
     * @returns {void}
     * @since 2025-08-26
     */
    open_by_index(index) {
      const group = this._groups[index];
      if (group) {
        this.expand(group);
      }
    }

    /**
     * Open a group by matching text contained within the <h3> inside the header.
     * The comparison is case-insensitive and substring-based.
     *
     * @param {string} text Text to match against the heading contents.
     * @returns {void}
     * @since 2025-08-26
     */
    open_by_heading(text) {
      if (!text) {
        return;
      }
      const t = String(text).toLowerCase();
      const match = this._groups.find(g => {
        const h = g.querySelector(this.opts.header_selector + ' h3');
        return h && h.textContent.toLowerCase().indexOf(t) !== -1;
      });
      if (match) {
        this.expand(match);
      }
    }

    // -------------------------------------------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------------------------------------------

    /**
     * Delegated click handler for headers.
     *
     * @private
     * @param {MouseEvent} ev The click event.
     * @returns {void}
     * @since 2025-08-26
     */
    _on_click(ev) {
      const btn = ev.target.closest(this.opts.header_selector);
      if (!btn || !this.root.contains(btn)) {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      const group = btn.closest(this.opts.group_selector);
      if (group) {
        this.toggle(group);
      }
    }

    /**
     * Keyboard handler for header interactions and roving focus:
     *  - Enter/Space toggles the active group.
     *  - ArrowUp/ArrowDown moves focus between group headers.
     *
     * @private
     * @param {KeyboardEvent} ev The keyboard event.
     * @returns {void}
     * @since 2025-08-26
     */
    _on_keydown(ev) {
      const btn = ev.target.closest(this.opts.header_selector);
      if (!btn) {
        return;
      }
      const key = ev.key;

      // Toggle on Enter / Space.
      if (key === 'Enter' || key === ' ') {
        ev.preventDefault();
        const group = btn.closest(this.opts.group_selector);
        if (group) {
          this.toggle(group);
        }
        return;
      }

      // Move focus with ArrowUp/ArrowDown between headers in this container.
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        ev.preventDefault();
        const headers = Array.prototype.map.call(this.root.querySelectorAll(this.opts.group_selector), g => g.querySelector(this.opts.header_selector)).filter(Boolean);
        const idx = headers.indexOf(btn);
        if (idx !== -1) {
          const next_idx = key === 'ArrowDown' ? Math.min(headers.length - 1, idx + 1) : Math.max(0, idx - 1);
          headers[next_idx].focus();
        }
      }
    }

    /**
     * Apply ARIA synchronization to all known groups based on their open state.
     *
     * @private
     * @returns {void}
     * @since 2025-08-26
     */
    _sync_all_aria() {
      this._groups.forEach(g => this._sync_group_aria(g));
    }

    /**
     * Sync ARIA attributes and visibility on a single group.
     *
     * @private
     * @param {HTMLElement} group The group element to sync.
     * @returns {void}
     * @since 2025-08-26
     */
    _sync_group_aria(group) {
      const is_open = this.is_open(group);
      const header = group.querySelector(this.opts.header_selector);
      // Only direct children that match.
      const panels = Array.prototype.filter.call(group.children, el => el.matches(this.opts.fields_selector));

      // Header ARIA.
      if (header) {
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', is_open ? 'true' : 'false');
        if (panels.length) {
          // Ensure each panel has an id; then wire aria-controls with space-separated ids.
          const ids = panels.map(p => {
            if (!p.id) p.id = this._generate_id('wpbc_collapsible_panel');
            return p.id;
          });
          header.setAttribute('aria-controls', ids.join(' '));
        }
      }

      // (3) Panels ARIA + visibility.
      panels.forEach(p => {
        p.hidden = !is_open; // actual visibility.
        p.setAttribute('aria-hidden', is_open ? 'false' : 'true'); // ARIA.
      });
    }

    /**
     * Internal state change: set a group's open/closed state, sync ARIA,
     * manage focus on collapse, and emit a custom event.
     *
     * @private
     * @param {HTMLElement} group The group element to mutate.
     * @param {boolean} open Whether the group should be open.
     * @returns {void}
     * @fires CustomEvent#wpbc:collapsible:open
     * @fires CustomEvent#wpbc:collapsible:close
     * @since 2025-08-26
     */
    _set_open(group, open) {
      if (!open && group.contains(document.activeElement)) {
        const header = group.querySelector(this.opts.header_selector);
        header && header.focus();
      }
      group.classList.toggle(this.opts.open_class, open);
      this._sync_group_aria(group);
      const ev_name = open ? 'wpbc:collapsible:open' : 'wpbc:collapsible:close';
      group.dispatchEvent(new CustomEvent(ev_name, {
        bubbles: true,
        detail: {
          group,
          root: this.root,
          instance: this
        }
      }));
    }

    /**
     * Generate a unique DOM id with the specified prefix.
     *
     * @private
     * @param {string} prefix The id prefix to use.
     * @returns {string} A unique element id not present in the document.
     * @since 2025-08-26
     */
    _generate_id(prefix) {
      let i = 1;
      let id;
      do {
        id = prefix + '_' + i++;
      } while (d.getElementById(id));
      return id;
    }
  }

  /**
   * Auto-initialize collapsible controllers on the page.
   * Finds top-level `.wpbc_collapsible` containers (ignoring nested ones),
   * and instantiates {@link WPBC_Collapsible_Groups} on each.
   *
   * @function WPBC_Collapsible_AutoInit
   * @returns {void}
   * @since 2025-08-26
   * @example
   * // Runs automatically on DOMContentLoaded; can also be called manually:
   * WPBC_Collapsible_AutoInit();
   */
  function wpbc_collapsible__auto_init() {
    var ROOT = '.wpbc_collapsible';
    var nodes = Array.prototype.slice.call(d.querySelectorAll(ROOT)).filter(function (n) {
      return !n.parentElement || !n.parentElement.closest(ROOT);
    });
    nodes.forEach(function (node) {
      if (node.__wpbc_collapsible_instance) {
        return;
      }
      var exclusive = node.classList.contains('wpbc_collapsible--exclusive') || node.matches('[data-wpbc-accordion="exclusive"]');
      node.__wpbc_collapsible_instance = new WPBC_Collapsible_Groups(node, {
        exclusive
      }).init();
    });
  }

  // Export to global for manual control if needed.
  w.WPBC_Collapsible_Groups = WPBC_Collapsible_Groups;
  w.WPBC_Collapsible_AutoInit = wpbc_collapsible__auto_init;

  // DOM-ready auto init.
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', wpbc_collapsible__auto_init, {
      once: true
    });
  } else {
    wpbc_collapsible__auto_init();
  }
})(window, document);

/* globals window, document */
/**
 * WPBC Slider Length Groups
 *
 * Universal, dependency-free controller that keeps a "length" control in sync:
 *  - number input  (data-wpbc_slider_len_value)
 *  - unit select   (data-wpbc_slider_len_unit)
 *  - range slider  (data-wpbc_slider_len_range)
 *  - writer input  (data-wpbc_slider_len_writer)  [optional but recommended]
 *
 * The "writer" stores the combined value like: "100%", "420px", "12.5rem".
 * When number/unit/slider change -> writer updates and emits 'input' (bubbles).
 * When writer is changed externally (apply-from-JSON, etc) -> UI updates.
 *
 * Markup expectations (minimal):
 *  <div class="wpbc_slider_len_group"
 *       data-wpbc_slider_len_bounds_map='{"%":{"min":30,"max":100,"step":1},"px":{"min":300,"max":2000,"step":10}}'
 *       data-wpbc_slider_len_default_unit="%">
 *    <input type="number" data-wpbc_slider_len_value>
 *    <select data-wpbc_slider_len_unit>...</select>
 *    <input type="range" data-wpbc_slider_len_range>
 *    <input type="text" data-wpbc_slider_len_writer style="display:none;">
 *  </div>
 *
 * Performance notes:
 * - MutationObserver is DISABLED by default (prevents performance issues).
 * - If your UI re-renders and inserts new groups dynamically, call:
 *     WPBC_Slider_Len_AutoInit();  OR instance.refresh();
 *   Or enable observer via: new WPBC_Slider_Len_Groups(root, { enable_observer:true }).init();
 *
 * Public API (instance methods):
 *  - init(), destroy(), refresh()
 *
 * @version 2026-01-25
 * @since   2026-01-25
 * @file    ../includes/__js/admin/slider_groups/wpbc_len_groups.js
 */
(function (w, d) {
  'use strict';

  // -------------------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------------------
  function clamp_num(v, min, max) {
    if (typeof min === 'number' && !isNaN(min)) v = Math.max(min, v);
    if (typeof max === 'number' && !isNaN(max)) v = Math.min(max, v);
    return v;
  }
  function parse_float(v) {
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  function safe_json_parse(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
  function parse_len_combined(raw, default_unit) {
    var s = raw == null ? '' : String(raw).trim();
    if (!s) return {
      num: '',
      unit: default_unit || '%'
    };
    var m = s.match(/^\s*([\-]?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i);
    if (!m) {
      // If it's not parseable, treat as number and keep default unit.
      return {
        num: s,
        unit: default_unit || '%'
      };
    }
    var num = m[1] ? String(m[1]) : '';
    var unit = m[2] ? String(m[2]) : '';
    if (!unit) unit = default_unit || '%';
    return {
      num: num,
      unit: unit
    };
  }
  function build_combined(num, unit) {
    if (num == null || String(num).trim() === '') return '';
    return String(num) + String(unit || '');
  }
  function emit_input(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', {
      bubbles: true
    }));
  }

  // -------------------------------------------------------------------------------------------------
  // Controller
  // -------------------------------------------------------------------------------------------------
  class WPBC_Slider_Len_Groups {
    /**
     * @param {HTMLElement|string} root_el Container (or selector). If omitted, uses document.
     * @param {Object} [opts={}]
     */
    constructor(root_el, opts) {
      this.root = root_el ? typeof root_el === 'string' ? d.querySelector(root_el) : root_el : d;
      this.opts = Object.assign({
        // Strict selectors (NO backward compatibility).
        group_selector: '.wpbc_slider_len_group',
        value_selector: '[data-wpbc_slider_len_value]',
        unit_selector: '[data-wpbc_slider_len_unit]',
        range_selector: '[data-wpbc_slider_len_range]',
        writer_selector: '[data-wpbc_slider_len_writer]',
        default_unit: '%',
        fallback_bounds: {
          'px': {
            min: 0,
            max: 512,
            step: 1
          },
          '%': {
            min: 0,
            max: 100,
            step: 1
          },
          'rem': {
            min: 0,
            max: 10,
            step: 0.1
          },
          'em': {
            min: 0,
            max: 10,
            step: 0.1
          }
        },
        // Disabled by default for performance.
        enable_observer: false,
        observer_debounce_ms: 150
      }, opts || {});
      this._on_input = this._on_input.bind(this);
      this._on_change = this._on_change.bind(this);
      this._bounds_cache = new WeakMap(); // group -> bounds_map_object
      this._observer = null;
      this._refresh_tmr = null;
    }
    init() {
      if (!this.root) return this;
      this.root.addEventListener('input', this._on_input, true);
      this.root.addEventListener('change', this._on_change, true);
      if (this.opts.enable_observer && w.MutationObserver) {
        this._observer = new MutationObserver(() => {
          this._debounced_refresh();
        });
        this._observer.observe(this.root === d ? d.documentElement : this.root, {
          childList: true,
          subtree: true
        });
      }
      this.refresh();
      return this;
    }
    destroy() {
      if (!this.root) return;
      this.root.removeEventListener('input', this._on_input, true);
      this.root.removeEventListener('change', this._on_change, true);
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      if (this._refresh_tmr) {
        clearTimeout(this._refresh_tmr);
        this._refresh_tmr = null;
      }
    }
    refresh() {
      if (!this.root) return;
      var scope = this.root === d ? d : this.root;
      var groups = Array.prototype.slice.call(scope.querySelectorAll(this.opts.group_selector));
      for (var i = 0; i < groups.length; i++) {
        this._sync_group_from_writer(groups[i]);
        this._apply_bounds_for_current_unit(groups[i]);
      }
    }

    // -------------------------------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------------------------------
    _debounced_refresh() {
      if (this._refresh_tmr) clearTimeout(this._refresh_tmr);
      this._refresh_tmr = setTimeout(() => {
        this._refresh_tmr = null;
        this.refresh();
      }, Number(this.opts.observer_debounce_ms) || 0);
    }
    _find_group(el) {
      return el && el.closest ? el.closest(this.opts.group_selector) : null;
    }
    _get_parts(group) {
      if (!group) return null;
      return {
        group: group,
        num: group.querySelector(this.opts.value_selector),
        unit: group.querySelector(this.opts.unit_selector),
        range: group.querySelector(this.opts.range_selector),
        writer: group.querySelector(this.opts.writer_selector)
      };
    }
    _get_default_unit(group) {
      var du = group && group.getAttribute ? group.getAttribute('data-wpbc_slider_len_default_unit') : '';
      return du ? String(du) : this.opts.default_unit;
    }
    _get_bounds_map(group) {
      if (!group) return null;
      if (this._bounds_cache.has(group)) {
        return this._bounds_cache.get(group);
      }
      var raw = group.getAttribute('data-wpbc_slider_len_bounds_map');
      var map = raw ? safe_json_parse(raw) : null;
      if (!map || typeof map !== 'object') map = null;
      this._bounds_cache.set(group, map);
      return map;
    }
    _get_bounds_for_unit(group, unit) {
      var map = this._get_bounds_map(group);
      if (map && unit && map[unit]) {
        return map[unit];
      }
      return this.opts.fallback_bounds[unit] || this.opts.fallback_bounds['px'];
    }
    _apply_bounds(parts, bounds) {
      if (!parts || !bounds) return;
      var min = bounds.min != null ? Number(bounds.min) : null;
      var max = bounds.max != null ? Number(bounds.max) : null;
      var step = bounds.step != null ? Number(bounds.step) : null;
      if (parts.range) {
        if (!isNaN(min)) parts.range.min = String(min);
        if (!isNaN(max)) parts.range.max = String(max);
        if (!isNaN(step)) parts.range.step = String(step);
      }
      if (parts.num) {
        if (!isNaN(min)) parts.num.min = String(min);
        if (!isNaN(max)) parts.num.max = String(max);
        if (!isNaN(step)) parts.num.step = String(step);
      }
    }
    _apply_bounds_for_current_unit(group) {
      var parts = this._get_parts(group);
      if (!parts || !parts.unit) return;
      var unit = parts.unit.value || this._get_default_unit(group);
      var b = this._get_bounds_for_unit(group, unit);
      this._apply_bounds(parts, b);

      // Clamp current value to new bounds.
      var v = parse_float(parts.num && parts.num.value ? parts.num.value : parts.range ? parts.range.value : '');
      if (v == null) return;
      var min = b && b.min != null ? Number(b.min) : null;
      var max = b && b.max != null ? Number(b.max) : null;
      v = clamp_num(v, isNaN(min) ? null : min, isNaN(max) ? null : max);
      if (parts.num) parts.num.value = String(v);
      if (parts.range) parts.range.value = String(v);
      this._write_combined(parts, String(v), unit, /*emit*/false);
    }
    _write_combined(parts, num, unit, emit) {
      if (!parts) return;
      var combined = build_combined(num, unit);
      if (parts.writer) {
        // Avoid recursion: mark as internal write.
        parts.writer.__wpbc_slider_len_internal = true;
        parts.writer.value = combined;
        if (emit) emit_input(parts.writer);
        parts.writer.__wpbc_slider_len_internal = false;
      } else if (parts.num) {
        // If writer is missing, at least notify via number input.
        if (emit) emit_input(parts.num);
      }
    }
    _sync_group_from_writer(group) {
      var parts = this._get_parts(group);
      if (!parts || !parts.writer) return;
      var raw = String(parts.writer.value || '').trim();
      if (!raw) return;
      var du = this._get_default_unit(group);
      var p = parse_len_combined(raw, du);
      if (parts.unit) parts.unit.value = p.unit;
      if (parts.num) parts.num.value = p.num;
      if (parts.range) parts.range.value = p.num;
    }
    _on_input(ev) {
      var t = ev.target;
      if (!t) return;
      var group = this._find_group(t);
      if (!group) return;
      var parts = this._get_parts(group);
      if (!parts) return;

      // Writer changed externally -> update UI.
      if (parts.writer && t === parts.writer) {
        if (t.__wpbc_slider_len_internal) return;
        this._sync_group_from_writer(group);
        this._apply_bounds_for_current_unit(group);
        return;
      }

      // Slider moved -> update number + writer.
      if (t.matches && t.matches(this.opts.range_selector)) {
        if (parts.num) parts.num.value = t.value;
        var unit = parts.unit && parts.unit.value ? parts.unit.value : this._get_default_unit(group);
        this._write_combined(parts, t.value, unit, /*emit*/true);
        return;
      }

      // Number typed -> update slider + writer (clamp if slider has bounds).
      if (t.matches && t.matches(this.opts.value_selector)) {
        var v = parse_float(t.value);
        if (v != null && parts.range) {
          var rmin = Number(parts.range.min);
          var rmax = Number(parts.range.max);
          v = clamp_num(v, isNaN(rmin) ? null : rmin, isNaN(rmax) ? null : rmax);
          parts.range.value = String(v);
          if (String(v) !== t.value) t.value = String(v);
        }
        var unit2 = parts.unit && parts.unit.value ? parts.unit.value : this._get_default_unit(group);
        this._write_combined(parts, t.value, unit2, /*emit*/true);
      }
    }
    _on_change(ev) {
      var t = ev.target;
      if (!t) return;
      var group = this._find_group(t);
      if (!group) return;
      var parts = this._get_parts(group);
      if (!parts) return;

      // Unit changed -> update bounds + writer.
      if (t.matches && t.matches(this.opts.unit_selector)) {
        this._apply_bounds_for_current_unit(group);
        var num = parts.num ? parts.num.value : parts.range ? parts.range.value : '';
        var unit = t.value || this._get_default_unit(group);
        this._write_combined(parts, num, unit, /*emit*/true);
      }
    }
  }

  // -------------------------------------------------------------------------------------------------
  // Auto-init
  // -------------------------------------------------------------------------------------------------
  function wpbc_slider_len_groups__auto_init() {
    var ROOT = '.wpbc_slider_len_groups';
    var nodes = Array.prototype.slice.call(d.querySelectorAll(ROOT)).filter(function (n) {
      return !n.parentElement || !n.parentElement.closest(ROOT);
    });

    // If no explicit containers, install a single document-root instance.
    if (!nodes.length) {
      if (!d.__wpbc_slider_len_groups_global_instance) {
        d.__wpbc_slider_len_groups_global_instance = new WPBC_Slider_Len_Groups(d).init();
      }
      return;
    }
    nodes.forEach(function (node) {
      if (node.__wpbc_slider_len_groups_instance) return;
      node.__wpbc_slider_len_groups_instance = new WPBC_Slider_Len_Groups(node).init();
    });
  }

  // Export globals (manual control if needed).
  w.WPBC_Slider_Len_Groups = WPBC_Slider_Len_Groups;
  w.WPBC_Slider_Len_AutoInit = wpbc_slider_len_groups__auto_init;

  // DOM-ready auto init.
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', wpbc_slider_len_groups__auto_init, {
      once: true
    });
  } else {
    wpbc_slider_len_groups__auto_init();
  }
})(window, document);

/* globals window, document */
/**
 * WPBC Slider Range Groups
 *
 * Universal, dependency-free controller that keeps a "range + number" pair in sync:
 *  - number input  (data-wpbc_slider_range_value)
 *  - range slider  (data-wpbc_slider_range_range)
 *  - writer input  (data-wpbc_slider_range_writer) [optional]
 *
 * If writer exists: number/slider update writer and emit 'input' on writer (bubbles).
 * If writer is missing: emits 'input' on the number input.
 * If writer changes externally: updates number/slider.
 *
 * Markup expectations (minimal):
 *  <div class="wpbc_slider_range_group">
 *    <input type="number" data-wpbc_slider_range_value>
 *    <input type="range"  data-wpbc_slider_range_range>
 *    <!-- optional -->
 *    <input type="text" data-wpbc_slider_range_writer style="display:none;">
 *  </div>
 *
 * Performance notes:
 * - MutationObserver is DISABLED by default.
 * - If your UI re-renders and inserts new groups dynamically, call:
 *     WPBC_Slider_Range_AutoInit(); OR instance.refresh();
 *   Or enable observer via: new WPBC_Slider_Range_Groups(root, { enable_observer:true }).init();
 *
 * Public API (instance methods):
 *  - init(), destroy(), refresh()
 *
 * @version 2026-01-25
 * @since   2026-01-25
 * @file    ../includes/__js/admin/slider_groups/wpbc_range_groups.js
 */
(function (w, d) {
  'use strict';

  // -------------------------------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------------------------------
  function clamp_num(v, min, max) {
    if (typeof min === 'number' && !isNaN(min)) v = Math.max(min, v);
    if (typeof max === 'number' && !isNaN(max)) v = Math.min(max, v);
    return v;
  }
  function parse_float(v) {
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }
  function emit_input(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', {
      bubbles: true
    }));
  }

  // -------------------------------------------------------------------------------------------------
  // Controller
  // -------------------------------------------------------------------------------------------------
  class WPBC_Slider_Range_Groups {
    /**
     * @param {HTMLElement|string} root_el Container (or selector). If omitted, uses document.
     * @param {Object} [opts={}]
     */
    constructor(root_el, opts) {
      this.root = root_el ? typeof root_el === 'string' ? d.querySelector(root_el) : root_el : d;
      this.opts = Object.assign({
        // Strict selectors (NO backward compatibility).
        group_selector: '.wpbc_slider_range_group',
        value_selector: '[data-wpbc_slider_range_value]',
        range_selector: '[data-wpbc_slider_range_range]',
        writer_selector: '[data-wpbc_slider_range_writer]',
        // Disabled by default for performance.
        enable_observer: false,
        observer_debounce_ms: 150
      }, opts || {});
      this._on_input = this._on_input.bind(this);
      this._on_change = this._on_change.bind(this);
      this._observer = null;
      this._refresh_tmr = null;
    }
    init() {
      if (!this.root) return this;
      this.root.addEventListener('input', this._on_input, true);
      this.root.addEventListener('change', this._on_change, true);
      if (this.opts.enable_observer && w.MutationObserver) {
        this._observer = new MutationObserver(() => {
          this._debounced_refresh();
        });
        this._observer.observe(this.root === d ? d.documentElement : this.root, {
          childList: true,
          subtree: true
        });
      }
      this.refresh();
      return this;
    }
    destroy() {
      if (!this.root) return;
      this.root.removeEventListener('input', this._on_input, true);
      this.root.removeEventListener('change', this._on_change, true);
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      if (this._refresh_tmr) {
        clearTimeout(this._refresh_tmr);
        this._refresh_tmr = null;
      }
    }
    refresh() {
      if (!this.root) return;
      var scope = this.root === d ? d : this.root;
      var groups = Array.prototype.slice.call(scope.querySelectorAll(this.opts.group_selector));
      for (var i = 0; i < groups.length; i++) {
        this._sync_from_writer(groups[i]);
        this._clamp_to_range(groups[i]);
      }
    }

    // -------------------------------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------------------------------
    _debounced_refresh() {
      if (this._refresh_tmr) clearTimeout(this._refresh_tmr);
      this._refresh_tmr = setTimeout(() => {
        this._refresh_tmr = null;
        this.refresh();
      }, Number(this.opts.observer_debounce_ms) || 0);
    }
    _find_group(el) {
      return el && el.closest ? el.closest(this.opts.group_selector) : null;
    }
    _get_parts(group) {
      if (!group) return null;
      return {
        group: group,
        num: group.querySelector(this.opts.value_selector),
        range: group.querySelector(this.opts.range_selector),
        writer: group.querySelector(this.opts.writer_selector)
      };
    }
    _write(parts, value, emit) {
      if (!parts) return;
      if (parts.writer) {
        parts.writer.__wpbc_slider_range_internal = true;
        parts.writer.value = String(value);
        if (emit) emit_input(parts.writer);
        parts.writer.__wpbc_slider_range_internal = false;
      } else if (parts.num) {
        // If writer is missing, at least notify via number input.
        if (emit) emit_input(parts.num);
      }
    }
    _sync_from_writer(group) {
      var parts = this._get_parts(group);
      if (!parts || !parts.writer) return;
      var raw = String(parts.writer.value || '').trim();
      if (!raw) return;
      if (parts.num) parts.num.value = raw;
      if (parts.range) parts.range.value = raw;
    }
    _clamp_to_range(group) {
      var parts = this._get_parts(group);
      if (!parts || !parts.range || !parts.num) return;
      var v = parse_float(parts.num.value);
      if (v == null) return;
      var min = Number(parts.range.min);
      var max = Number(parts.range.max);
      var vv = clamp_num(v, isNaN(min) ? null : min, isNaN(max) ? null : max);
      if (String(vv) !== parts.num.value) parts.num.value = String(vv);
      parts.range.value = String(vv);
    }
    _on_input(ev) {
      var t = ev.target;
      if (!t) return;
      var group = this._find_group(t);
      if (!group) return;
      var parts = this._get_parts(group);
      if (!parts) return;

      // Writer changed externally -> update UI.
      if (parts.writer && t === parts.writer) {
        if (t.__wpbc_slider_range_internal) return;
        this._sync_from_writer(group);
        this._clamp_to_range(group);
        return;
      }

      // Range moved -> update number + writer.
      if (t.matches && t.matches(this.opts.range_selector)) {
        if (parts.num) parts.num.value = t.value;
        this._write(parts, t.value, /*emit*/true);
        return;
      }

      // Number typed -> update range + writer (clamp by slider bounds).
      if (t.matches && t.matches(this.opts.value_selector)) {
        if (parts.range) {
          var v = parse_float(t.value);
          if (v != null) {
            var min = Number(parts.range.min);
            var max = Number(parts.range.max);
            v = clamp_num(v, isNaN(min) ? null : min, isNaN(max) ? null : max);
            parts.range.value = String(v);
            if (String(v) !== t.value) t.value = String(v);
          }
        }
        this._write(parts, t.value, /*emit*/true);
      }
    }
    _on_change(ev) {
      // No special "change" handling needed currently; kept for symmetry/future.
    }
  }

  // -------------------------------------------------------------------------------------------------
  // Auto-init
  // -------------------------------------------------------------------------------------------------
  function wpbc_slider_range_groups__auto_init() {
    var ROOT = '.wpbc_slider_range_groups';
    var nodes = Array.prototype.slice.call(d.querySelectorAll(ROOT)).filter(function (n) {
      return !n.parentElement || !n.parentElement.closest(ROOT);
    });
    if (!nodes.length) {
      if (!d.__wpbc_slider_range_groups_global_instance) {
        d.__wpbc_slider_range_groups_global_instance = new WPBC_Slider_Range_Groups(d).init();
      }
      return;
    }
    nodes.forEach(function (node) {
      if (node.__wpbc_slider_range_groups_instance) return;
      node.__wpbc_slider_range_groups_instance = new WPBC_Slider_Range_Groups(node).init();
    });
  }

  // Export globals.
  w.WPBC_Slider_Range_Groups = WPBC_Slider_Range_Groups;
  w.WPBC_Slider_Range_AutoInit = wpbc_slider_range_groups__auto_init;
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', wpbc_slider_range_groups__auto_init, {
      once: true
    });
  } else {
    wpbc_slider_range_groups__auto_init();
  }
})(window, document);

/**
 * Booking Calendar — Generic UI Tabs Utility (JS)
 *
 * Purpose: Lightweight, dependency-free tabs controller for any small tab group in admin UIs.
 * - Auto-initializes groups marked with data-wpbc-tabs.
 * - Assigns ARIA roles and toggles aria-selected/aria-hidden/tabindex.
 * - Supports keyboard navigation (Left/Right/Home/End).
 * - Public API: window.wpbc_ui_tabs.{init_on, init_group, set_active}
 * - Emits 'wpbc:tabs:change' on the group root when the active tab changes.
 *
 * Markup contract:
 * - Root:   [data-wpbc-tabs]
 * - Tabs:   [data-wpbc-tab-key="K"]
 * - Panels: [data-wpbc-tab-panel="K"]
 *
 * @package   Booking Calendar
 * @subpackage Admin\UI
 * @since     11.0.0
 * @version   1.0.0
 * @see       /includes/__js/admin/ui_tabs/ui_tabs.js
 *
 *
 * How it works:
 * - Root node must have [data-wpbc-tabs] attribute (any value).
 * - Tab buttons must carry [data-wpbc-tab-key="..."] (unique per group).
 * - Panels must carry [data-wpbc-tab-panel="..."] with matching keys.
 * - Adds WAI-ARIA roles and aria-selected/hidden wiring.
 *
 * <div data-wpbc-tabs="column-styles" data-wpbc-tab-active="1"    class="wpbc_ui_tabs_root" >
 *    <!-- Top Tabs -->
 *    <div data-wpbc-tablist="" role="tablist"                    class=" wpbc_ui_el__horis_top_bar__wrapper" >
 *        <div class="wpbc_ui_el__horis_top_bar__content">
 *            <h2 class="wpbc_ui_el__horis_nav_label">Column:</h2>
 *
 *            <div class="wpbc_ui_el__horis_nav_item wpbc_ui_el__horis_nav_item__1">
 *                <a
 *                    data-wpbc-tab-key="1"
 *                    aria-selected="true" role="tab" tabindex="0" aria-controls="wpbc_tab_panel_col_1"
 *
 *                        href="javascript:void(0);"
 *                        class="wpbc_ui_el__horis_nav_item__a wpbc_ui_el__horis_nav_item__single"
 *                        id="wpbc_tab_col_1"
 *                        title="Column 1"
 *                ><span class="wpbc_ui_el__horis_nav_title">Title 1</span></a>
 *            </div>
 *            ...
 *        </div>
 *    </div>
 *    <!-- Tabs Content -->
 *    <div class="wpbc_tab__panel group__fields" data-wpbc-tab-panel="1" id="wpbc_tab_panel_col_1" role="tabpanel" aria-labelledby="wpbc_tab_col_1">
 *        ...
 *    </div>
 *    ...
 * </div>
 *
 * Public API:
 *   - wpbc_ui_tabs.init_on(root_or_selector)   // find and init groups within a container
 *   - wpbc_ui_tabs.init_group(root_el)         // init a single group root
 *   - wpbc_ui_tabs.set_active(root_el, key)    // programmatically change active tab
 *
 * Events:
 *   - Dispatches CustomEvent 'wpbc:tabs:change' on root when tab changes:
 *       detail: { active_key: '2', prev_key: '1' }
 *
 * Switch a local (generic) tabs group to tab 3:     var group = document.querySelector('[data-wpbc-tabs="column-styles"]'); if ( group ) { wpbc_ui_tabs.set_active(group, '3'); }
 */
(function (w) {
  'use strict';

  if (w.wpbc_ui_tabs) {
    return;
  }

  /**
   * Internal: toggle active state.
   *
   * @param {HTMLElement} root_el
   * @param {string}      key
   * @param {boolean}     should_emit
   */
  function set_active_internal(root_el, key, should_emit) {
    var tab_btns = root_el.querySelectorAll('[data-wpbc-tab-key]');
    var panels = root_el.querySelectorAll('[data-wpbc-tab-panel]');
    var prev_key = root_el.getAttribute('data-wpbc-tab-active') || null;
    if (String(prev_key) === String(key)) {
      return;
    }

    // Buttons: aria + class
    for (var i = 0; i < tab_btns.length; i++) {
      var btn = tab_btns[i];
      var b_key = btn.getAttribute('data-wpbc-tab-key');
      var is_on = String(b_key) === String(key);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', is_on ? 'true' : 'false');
      btn.setAttribute('tabindex', is_on ? '0' : '-1');
      if (is_on) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }

    // Panels: aria + visibility
    for (var j = 0; j < panels.length; j++) {
      var pn = panels[j];
      var pkey = pn.getAttribute('data-wpbc-tab-panel');
      var show = String(pkey) === String(key);
      pn.setAttribute('role', 'tabpanel');
      pn.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (show) {
        pn.removeAttribute('hidden');
      } else {
        pn.setAttribute('hidden', '');
      }
    }
    root_el.setAttribute('data-wpbc-tab-active', String(key));
    if (should_emit) {
      try {
        var ev = new w.CustomEvent('wpbc:tabs:change', {
          bubbles: true,
          detail: {
            active_key: String(key),
            prev_key: prev_key
          }
        });
        root_el.dispatchEvent(ev);
      } catch (_e) {}
    }
  }

  /**
   * Internal: get ordered keys from buttons.
   *
   * @param {HTMLElement} root_el
   * @returns {string[]}
   */
  function get_keys(root_el) {
    var list = [];
    var btns = root_el.querySelectorAll('[data-wpbc-tab-key]');
    for (var i = 0; i < btns.length; i++) {
      var k = btns[i].getAttribute('data-wpbc-tab-key');
      if (k != null && k !== '') {
        list.push(String(k));
      }
    }
    return list;
  }

  /**
   * Internal: move focus between tabs using keyboard.
   *
   * @param {HTMLElement} root_el
   * @param {number}      dir  +1 (next) / -1 (prev)
   */
  function focus_relative(root_el, dir) {
    var keys = get_keys(root_el);
    var current = root_el.getAttribute('data-wpbc-tab-active') || keys[0] || null;
    var idx = Math.max(0, keys.indexOf(String(current)));
    var next = keys[(idx + (dir > 0 ? 1 : keys.length - 1)) % keys.length];
    var next_btn = root_el.querySelector('[data-wpbc-tab-key="' + next + '"]');
    if (next_btn) {
      next_btn.focus();
      set_active_internal(root_el, next, true);
    }
  }

  /**
   * Initialize a single tabs group root.
   *
   * @param {HTMLElement} root_el
   */
  function init_group(root_el) {
    if (!root_el || root_el.__wpbc_tabs_inited) {
      return;
    }
    root_el.__wpbc_tabs_inited = true;

    // Roles
    var tablist = root_el.querySelector('[data-wpbc-tablist]') || root_el;
    tablist.setAttribute('role', 'tablist');

    // Default active: from attribute or first button
    var keys = get_keys(root_el);
    var def = root_el.getAttribute('data-wpbc-tab-active') || keys[0] || '1';
    set_active_internal(root_el, def, false);

    // Clicks
    root_el.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-wpbc-tab-key]') : null;
      if (!btn || !root_el.contains(btn)) {
        return;
      }
      e.preventDefault();
      var key = btn.getAttribute('data-wpbc-tab-key');
      if (key != null) {
        set_active_internal(root_el, key, true);
      }
    }, true);

    // Keyboard (Left/Right/Home/End)
    root_el.addEventListener('keydown', function (e) {
      var tgt = e.target;
      if (!tgt || !tgt.hasAttribute || !tgt.hasAttribute('data-wpbc-tab-key')) {
        return;
      }
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          focus_relative(root_el, -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          focus_relative(root_el, +1);
          break;
        case 'Home':
          e.preventDefault();
          set_active_internal(root_el, get_keys(root_el)[0] || '1', true);
          break;
        case 'End':
          e.preventDefault();
          var ks = get_keys(root_el);
          set_active_internal(root_el, ks[ks.length - 1] || '1', true);
          break;
      }
    }, true);
  }

  /**
   * Initialize all groups within a container (or document).
   *
   * @param {HTMLElement|string|null} container
   */
  function init_on(container) {
    var ctx = container ? typeof container === 'string' ? document.querySelector(container) : container : document;
    if (!ctx) {
      return;
    }
    var groups = ctx.querySelectorAll('[data-wpbc-tabs]');
    for (var i = 0; i < groups.length; i++) {
      init_group(groups[i]);
    }
  }

  /**
   * Programmatically set active tab by key.
   *
   * @param {HTMLElement} root_el
   * @param {string|number} key
   */
  function set_active(root_el, key) {
    if (root_el && root_el.hasAttribute && root_el.hasAttribute('data-wpbc-tabs')) {
      set_active_internal(root_el, String(key), true);
    }
  }

  // Public API (snake_case)
  w.wpbc_ui_tabs = {
    init_on: init_on,
    init_group: init_group,
    set_active: set_active
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init_on(document);
    });
  } else {
    init_on(document);
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX2Rpc3QvYWxsL19vdXQvd3BiY19hbGxfYWRtaW4uanMiLCJuYW1lcyI6WyJ3cGJjX2JsaW5rX2VsZW1lbnQiLCJlbGVtZW50X3RvX2JsaW5rIiwiaG93X21hbnlfdGltZXMiLCJob3dfbG9uZ190b19ibGluayIsImkiLCJqUXVlcnkiLCJmYWRlT3V0IiwiZmFkZUluIiwiYW5pbWF0ZSIsIm9wYWNpdHkiLCJ3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4iLCJidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkIiwicHJldmlvc19jbGFzc2VzIiwidW5kZWZpbmVkIiwiakVsZW1lbnQiLCJsZW5ndGgiLCJ3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbiIsImdldCIsIndwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24iLCJ0aGlzX2J1dHRvbiIsImpCdXR0b24iLCJqSWNvbiIsImZpbmQiLCJhdHRyIiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsInByZXZpb3VzX29uY2xpY2siLCJ3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uIiwiX3RoaXMiLCJpcyIsInBhcmVudHMiLCJyZW1vdmVBdHRyIiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrIiwiaGFzQ2xhc3MiLCJqX3JhZGlvIiwicHJvcCIsInRyaWdnZXIiLCJ3cGJjX2FkbWluX3VpX19mdWxsX3NjcmVlbl9fZ2V0X2Nvb2tpZV9wYXRocyIsImNvb2tpZV9wYXRocyIsImFkbWluX21hcmtlciIsImN1cnJlbnRfcGF0aCIsIndpbmRvdyIsImxvY2F0aW9uIiwicGF0aG5hbWUiLCJhZG1pbl9pbmRleCIsImluZGV4T2YiLCJwdXNoIiwic3Vic3RyaW5nIiwiZmlsdGVyIiwicGF0aCIsImluZGV4Iiwid3BiY19hZG1pbl91aV9fZnVsbF9zY3JlZW5fX3NldF9jb29raWUiLCJ2YWx1ZSIsIm1heF9hZ2UiLCJpc3N1ZWRfYXQiLCJNYXRoIiwiZmxvb3IiLCJEYXRlIiwibm93IiwiY29va2llX3ZhbHVlIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZm9yRWFjaCIsImNvb2tpZV9wYXRoIiwiZG9jdW1lbnQiLCJjb29raWUiLCJ3cGJjX2FkbWluX3VpX19mdWxsX3NjcmVlbl9fZG9fb24iLCJlbCIsImlzX3NhdmVfdXNlcl9zdGF0ZSIsIndwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSIsIndwYmNfc2F2ZV9jdXN0b21fdXNlcl9kYXRhX2Zyb21fZWxlbWVudCIsIndwYmNfYWRtaW5fdWlfX2Z1bGxfc2NyZWVuX19kb19vZmYiLCJ3cGJjX2NoZWNrX2J1dHRvbnNfbWF4X21pbl9pbl9mdWxsX3NjcmVlbl9tb2RlIiwicmVhZHkiLCJ3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24iLCIkIiwiY2hlY2tzIiwiZmlyc3QiLCJsYXN0IiwiY2hlY2tlZCIsInNsaWNlZCIsImxhc3RDbGlja2VkIiwib24iLCJlIiwic2hpZnRLZXkiLCJjbG9zZXN0Iiwic2xpY2UiLCJ1bmNoZWNrZWQiLCJub3QiLCJjaGlsZHJlbiIsImV2ZW50IiwiJHRoaXMiLCIkdGFibGUiLCJjb250cm9sQ2hlY2tlZCIsInRvZ2dsZSIsImRhdGEiLCJnZXRTZWxlY3Rpb24iLCJyZW1vdmVBbGxSYW5nZXMiLCJ3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MiLCJ3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQiLCJjaGVja2JveGVzIiwic2VsZWN0ZWRfaWQiLCJlYWNoIiwia2V5IiwiY2hlY2tib3giLCJlbGVtZW50X2lkIiwid3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCIsInRoaXNfaW5ib3VuZF9lbGVtZW50IiwicGFyc2VJbnQiLCJyZXBsYWNlIiwic2VsZWN0ZWRfcm93c19hcnIiLCJzaG93IiwiaGlkZSIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fc2F2ZV9tb2RlIiwibW9kZSIsImFsbG93ZWRfbW9kZXMiLCIkc2F2ZXIiLCJ3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3Njcm9sbF90b19hY3RpdmVfaXRlbSIsInNpbXBsZWJhcl9pbnN0YW5jZSIsImxlZnRfbmF2aWdhdGlvbl9lbGVtZW50IiwicXVlcnlTZWxlY3RvciIsIlNpbXBsZUJhciIsImluc3RhbmNlcyIsImdldFNjcm9sbEVsZW1lbnQiLCJnZXRDb250ZW50RWxlbWVudCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInNjcm9sbF9lbGVtZW50IiwiY29udGVudF9lbGVtZW50IiwicmVjYWxjdWxhdGUiLCJhY3RpdmVfaXRlbSIsIm9mZnNldFBhcmVudCIsImNsaWVudEhlaWdodCIsInNjcm9sbF9yZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiYWN0aXZlX3JlY3QiLCJjdXJyZW50X3RvcCIsInNjcm9sbFRvcCIsImxlYWRpbmdfb2Zmc2V0IiwiYWN0aXZlX3RvcCIsInRvcCIsInRhcmdldF90b3AiLCJtYXhpbXVtX3RvcCIsIm1heCIsInNjcm9sbEhlaWdodCIsIm1pbiIsInJvdW5kIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19tYXgiLCJ3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21pbiIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fY29tcGFjdCIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9faGlkZSIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fc2hvd19zZWN0aW9uIiwibWVudV90b19zaG93Iiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2V0X2JvZHlfb3Blbl9zdGF0ZSIsImlzX29wZW4iLCJ0b2dnbGVDbGFzcyIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21heCIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21pbiIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2NvbXBhY3QiLCJ3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19oaWRlIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fY29sbGFwc2VfZnJvbV9jb250ZW50X2NsaWNrIiwiZXZlbnRfdGFyZ2V0IiwidGFyZ2V0Iiwibm9kZVR5cGUiLCIkY29udGVudCIsIiR3cmFwcGVyIiwiY29sbGFwc2VfbW9kZSIsImJlZm9yZV9jb2xsYXBzZV9ldmVudCIsIlN0cmluZyIsInByZXZlbnREZWZhdWx0Iiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwiRXZlbnQiLCJpc0RlZmF1bHRQcmV2ZW50ZWQiLCJhZGRFdmVudExpc3RlbmVyIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2hvd19zZWN0aW9uIiwid3BiY191cmxfZ2V0X2FuY2hvcnNfYXJyIiwiaGFzaGVzIiwiaGFzaCIsImhhc2hlc19hcnIiLCJzcGxpdCIsInJlc3VsdCIsImhhc2hlc19hcnJfbGVuZ3RoIiwid3BiY19hZG1pbl91aV9fcmVkaXJlY3RfbGVnYWN5X2dlbmVyYWxfYXZhaWxhYmlsaXR5X3VybCIsIndwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uIiwic2V0VGltZW91dCIsImhyZWYiLCJhbmNob3JzX2FyciIsImFuY2hvcnNfYXJyX2xlbmd0aCIsIm9uZV9hbmNob3JfcHJvcF92YWx1ZSIsInNlY3Rpb25fdG9fc2hvdyIsInNlY3Rpb25faWRfdG9fc2hvdyIsInNlbGVjdGVkX3RpdGxlIiwidGV4dCIsImNvbnRhaW5lcl90b19oaWRlX2NsYXNzIiwidGFyZ2V0T2Zmc2V0Iiwid3BiY19zY3JvbGxfdG8iLCJzZWN0aW9uX2lkX3RhYiIsInZhbCIsIndwYmNfYWRtaW5fdWlfX2RvX19hbmNob3JfX2Fub3RoZXJfYWN0aW9ucyIsIndwYmNfYWRtaW5fdWlfX2lzX2luX21vYmlsZV9zY3JlZW5fc2l6ZSIsIndwYmNfYWRtaW5fdWlfX2lzX2luX3RoaXNfc2NyZWVuX3NpemUiLCJzaXplIiwic2NyZWVuIiwid2lkdGgiLCJ3cGJjX2FkbWluX3VpX19kb19fb3Blbl91cmxfX2V4cGFuZF9zZWN0aW9uIiwidXJsIiwic2VjdGlvbl9pZCIsInRoaXNfYW5jaG9yIiwidGhpc19hbmNob3JfcHJvcF92YWx1ZSIsInNlY3Rpb25fYWN0aW9uIiwid3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZF9mcm9tX2VsZW1lbnQiLCJodG1sX2VsZW1lbnRfaWQiLCJjb3B5VGV4dCIsImdldEVsZW1lbnRCeUlkIiwic2VsZWN0Iiwic2V0U2VsZWN0aW9uUmFuZ2UiLCJpc19jb3BpZWQiLCJ3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkIiwiY29uc29sZSIsImVycm9yIiwibmF2aWdhdG9yIiwiY2xpcGJvYXJkIiwid3BiY19mYWxsYmFja19jb3B5X3RleHRfdG9fY2xpcGJyZCIsIndyaXRlVGV4dCIsInRoZW4iLCJlcnIiLCJjb250YWluZXIiLCJjcmVhdGVFbGVtZW50IiwiaW5uZXJIVE1MIiwic3R5bGUiLCJwb3NpdGlvbiIsInBvaW50ZXJFdmVudHMiLCJhY3RpdmVTaGVldHMiLCJBcnJheSIsInByb3RvdHlwZSIsImNhbGwiLCJzdHlsZVNoZWV0cyIsInNoZWV0IiwiZGlzYWJsZWQiLCJib2R5IiwiYXBwZW5kQ2hpbGQiLCJyYW5nZSIsImNyZWF0ZVJhbmdlIiwic2VsZWN0Tm9kZSIsImFkZFJhbmdlIiwiZXhlY0NvbW1hbmQiLCJhY3RpdmVTaGVldHNfbGVuZ3RoIiwicmVtb3ZlQ2hpbGQiLCJ3IiwiZCIsIldQQkNfQ29sbGFwc2libGVfR3JvdXBzIiwiY29uc3RydWN0b3IiLCJyb290X2VsIiwib3B0cyIsInJvb3QiLCJPYmplY3QiLCJhc3NpZ24iLCJncm91cF9zZWxlY3RvciIsImhlYWRlcl9zZWxlY3RvciIsImZpZWxkc19zZWxlY3RvciIsIm9wZW5fY2xhc3MiLCJleGNsdXNpdmUiLCJfb25fY2xpY2siLCJiaW5kIiwiX29uX2tleWRvd24iLCJfZ3JvdXBzIiwiX29ic2VydmVyIiwiaW5pdCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJNdXRhdGlvbk9ic2VydmVyIiwicmVmcmVzaCIsIm9ic2VydmUiLCJjaGlsZExpc3QiLCJzdWJ0cmVlIiwiX3N5bmNfYWxsX2FyaWEiLCJkZXN0cm95IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRpc2Nvbm5lY3QiLCJpc19leGNsdXNpdmUiLCJjbGFzc0xpc3QiLCJjb250YWlucyIsIm1hdGNoZXMiLCJncm91cCIsImV4cGFuZCIsImRvX2V4Y2x1c2l2ZSIsImciLCJfc2V0X29wZW4iLCJjb2xsYXBzZSIsIm9wZW5fYnlfaW5kZXgiLCJvcGVuX2J5X2hlYWRpbmciLCJ0IiwidG9Mb3dlckNhc2UiLCJtYXRjaCIsImgiLCJ0ZXh0Q29udGVudCIsImV2IiwiYnRuIiwic3RvcFByb3BhZ2F0aW9uIiwiaGVhZGVycyIsIm1hcCIsIkJvb2xlYW4iLCJpZHgiLCJuZXh0X2lkeCIsImZvY3VzIiwiX3N5bmNfZ3JvdXBfYXJpYSIsImhlYWRlciIsInBhbmVscyIsInNldEF0dHJpYnV0ZSIsImlkcyIsInAiLCJpZCIsIl9nZW5lcmF0ZV9pZCIsImpvaW4iLCJoaWRkZW4iLCJvcGVuIiwiYWN0aXZlRWxlbWVudCIsImV2X25hbWUiLCJkaXNwYXRjaEV2ZW50IiwiQ3VzdG9tRXZlbnQiLCJidWJibGVzIiwiZGV0YWlsIiwiaW5zdGFuY2UiLCJwcmVmaXgiLCJ3cGJjX2NvbGxhcHNpYmxlX19hdXRvX2luaXQiLCJST09UIiwibm9kZXMiLCJuIiwicGFyZW50RWxlbWVudCIsIm5vZGUiLCJfX3dwYmNfY29sbGFwc2libGVfaW5zdGFuY2UiLCJXUEJDX0NvbGxhcHNpYmxlX0F1dG9Jbml0IiwicmVhZHlTdGF0ZSIsIm9uY2UiLCJjbGFtcF9udW0iLCJ2IiwiaXNOYU4iLCJwYXJzZV9mbG9hdCIsInBhcnNlRmxvYXQiLCJzYWZlX2pzb25fcGFyc2UiLCJzdHIiLCJKU09OIiwicGFyc2UiLCJwYXJzZV9sZW5fY29tYmluZWQiLCJyYXciLCJkZWZhdWx0X3VuaXQiLCJzIiwidHJpbSIsIm51bSIsInVuaXQiLCJtIiwiYnVpbGRfY29tYmluZWQiLCJlbWl0X2lucHV0IiwiV1BCQ19TbGlkZXJfTGVuX0dyb3VwcyIsInZhbHVlX3NlbGVjdG9yIiwidW5pdF9zZWxlY3RvciIsInJhbmdlX3NlbGVjdG9yIiwid3JpdGVyX3NlbGVjdG9yIiwiZmFsbGJhY2tfYm91bmRzIiwic3RlcCIsImVuYWJsZV9vYnNlcnZlciIsIm9ic2VydmVyX2RlYm91bmNlX21zIiwiX29uX2lucHV0IiwiX29uX2NoYW5nZSIsIl9ib3VuZHNfY2FjaGUiLCJXZWFrTWFwIiwiX3JlZnJlc2hfdG1yIiwiX2RlYm91bmNlZF9yZWZyZXNoIiwiZG9jdW1lbnRFbGVtZW50IiwiY2xlYXJUaW1lb3V0Iiwic2NvcGUiLCJncm91cHMiLCJfc3luY19ncm91cF9mcm9tX3dyaXRlciIsIl9hcHBseV9ib3VuZHNfZm9yX2N1cnJlbnRfdW5pdCIsIk51bWJlciIsIl9maW5kX2dyb3VwIiwiX2dldF9wYXJ0cyIsIndyaXRlciIsIl9nZXRfZGVmYXVsdF91bml0IiwiZHUiLCJnZXRBdHRyaWJ1dGUiLCJfZ2V0X2JvdW5kc19tYXAiLCJoYXMiLCJzZXQiLCJfZ2V0X2JvdW5kc19mb3JfdW5pdCIsIl9hcHBseV9ib3VuZHMiLCJwYXJ0cyIsImJvdW5kcyIsImIiLCJfd3JpdGVfY29tYmluZWQiLCJlbWl0IiwiY29tYmluZWQiLCJfX3dwYmNfc2xpZGVyX2xlbl9pbnRlcm5hbCIsInJtaW4iLCJybWF4IiwidW5pdDIiLCJ3cGJjX3NsaWRlcl9sZW5fZ3JvdXBzX19hdXRvX2luaXQiLCJfX3dwYmNfc2xpZGVyX2xlbl9ncm91cHNfZ2xvYmFsX2luc3RhbmNlIiwiX193cGJjX3NsaWRlcl9sZW5fZ3JvdXBzX2luc3RhbmNlIiwiV1BCQ19TbGlkZXJfTGVuX0F1dG9Jbml0IiwiV1BCQ19TbGlkZXJfUmFuZ2VfR3JvdXBzIiwiX3N5bmNfZnJvbV93cml0ZXIiLCJfY2xhbXBfdG9fcmFuZ2UiLCJfd3JpdGUiLCJfX3dwYmNfc2xpZGVyX3JhbmdlX2ludGVybmFsIiwidnYiLCJ3cGJjX3NsaWRlcl9yYW5nZV9ncm91cHNfX2F1dG9faW5pdCIsIl9fd3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXBzX2dsb2JhbF9pbnN0YW5jZSIsIl9fd3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXBzX2luc3RhbmNlIiwiV1BCQ19TbGlkZXJfUmFuZ2VfQXV0b0luaXQiLCJ3cGJjX3VpX3RhYnMiLCJzZXRfYWN0aXZlX2ludGVybmFsIiwic2hvdWxkX2VtaXQiLCJ0YWJfYnRucyIsInByZXZfa2V5IiwiYl9rZXkiLCJpc19vbiIsImFkZCIsInJlbW92ZSIsImoiLCJwbiIsInBrZXkiLCJyZW1vdmVBdHRyaWJ1dGUiLCJhY3RpdmVfa2V5IiwiX2UiLCJnZXRfa2V5cyIsImxpc3QiLCJidG5zIiwiayIsImZvY3VzX3JlbGF0aXZlIiwiZGlyIiwia2V5cyIsImN1cnJlbnQiLCJuZXh0IiwibmV4dF9idG4iLCJpbml0X2dyb3VwIiwiX193cGJjX3RhYnNfaW5pdGVkIiwidGFibGlzdCIsImRlZiIsInRndCIsImhhc0F0dHJpYnV0ZSIsImtzIiwiaW5pdF9vbiIsImN0eCIsInNldF9hY3RpdmUiXSwic291cmNlcyI6WyJ1aV9lbGVtZW50cy5qcyIsInVpX2xvYWRpbmdfc3Bpbi5qcyIsInVpX3JhZGlvX2NvbnRhaW5lci5qcyIsInVpX2Z1bGxfc2NyZWVuX21vZGUuanMiLCJnbWFpbF9jaGVja2JveF9zZWxlY3Rpb24uanMiLCJib29raW5nc19jaGVja2JveF9zZWxlY3Rpb24uanMiLCJ1aV9zaWRlYmFyX2xlZnRfX2FjdGlvbnMuanMiLCJjb3B5X3RleHRfdG9fY2xpcGJyZC5qcyIsImNvbGxhcHNpYmxlX2dyb3Vwcy5qcyIsIndwYmNfbGVuX2dyb3Vwcy5qcyIsIndwYmNfcmFuZ2VfZ3JvdXBzLmpzIiwidWlfdGFicy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJcclxuLyoqXHJcbiAqIEJsaW5rIHNwZWNpZmljIEhUTUwgZWxlbWVudCB0byBzZXQgYXR0ZW50aW9uIHRvIHRoaXMgZWxlbWVudC5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IGVsZW1lbnRfdG9fYmxpbmtcdFx0ICAtIGNsYXNzIG9yIGlkIG9mIGVsZW1lbnQ6ICcud3BiY193aWRnZXRfYXZhaWxhYmxlX3VuYXZhaWxhYmxlJ1xyXG4gKiBAcGFyYW0ge2ludH0gaG93X21hbnlfdGltZXNcdFx0XHQgIC0gNFxyXG4gKiBAcGFyYW0ge2ludH0gaG93X2xvbmdfdG9fYmxpbmtcdFx0ICAtIDM1MFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ibGlua19lbGVtZW50KCBlbGVtZW50X3RvX2JsaW5rLCBob3dfbWFueV90aW1lcyA9IDQsIGhvd19sb25nX3RvX2JsaW5rID0gMzUwICl7XHJcblxyXG5cdGZvciAoIGxldCBpID0gMDsgaSA8IGhvd19tYW55X3RpbWVzOyBpKysgKXtcclxuXHRcdGpRdWVyeSggZWxlbWVudF90b19ibGluayApLmZhZGVPdXQoIGhvd19sb25nX3RvX2JsaW5rICkuZmFkZUluKCBob3dfbG9uZ190b19ibGluayApO1xyXG5cdH1cclxuICAgIGpRdWVyeSggZWxlbWVudF90b19ibGluayApLmFuaW1hdGUoIHtvcGFjaXR5OiAxfSwgNTAwICk7XHJcbn1cclxuIiwiLyoqXHJcbiAqICAgU3VwcG9ydCBGdW5jdGlvbnMgLSBTcGluIEljb24gaW4gQnV0dG9ucyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogUmVtb3ZlIHNwaW4gaWNvbiBmcm9tICBidXR0b24gYW5kIEVuYWJsZSB0aGlzIGJ1dHRvbi5cclxuICpcclxuICogQHBhcmFtIGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWRcdFx0LSBIVE1MIElEIGF0dHJpYnV0ZSBvZiB0aGlzIGJ1dHRvblxyXG4gKiBAcmV0dXJuIHN0cmluZ1x0XHRcdFx0XHRcdC0gQ1NTIGNsYXNzZXMgdGhhdCB3YXMgcHJldmlvdXNseSBpbiBidXR0b24gaWNvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19idXR0b25fX3JlbW92ZV9zcGluKGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQpIHtcclxuXHJcblx0dmFyIHByZXZpb3NfY2xhc3NlcyA9ICcnO1xyXG5cdGlmIChcclxuXHRcdCh1bmRlZmluZWQgIT0gYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZClcclxuXHRcdCYmICgnJyAhPSBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkKVxyXG5cdCkge1xyXG5cdFx0dmFyIGpFbGVtZW50ID0galF1ZXJ5KCAnIycgKyBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkICk7XHJcblx0XHRpZiAoIGpFbGVtZW50Lmxlbmd0aCApIHtcclxuXHRcdFx0cHJldmlvc19jbGFzc2VzID0gd3BiY19idXR0b25fZGlzYWJsZV9sb2FkaW5nX2ljb24oIGpFbGVtZW50LmdldCggMCApICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcHJldmlvc19jbGFzc2VzO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNob3cgTG9hZGluZyAocm90YXRpbmcgYXJyb3cpIGljb24gZm9yIGJ1dHRvbiB0aGF0IGhhcyBiZWVuIGNsaWNrZWRcclxuICpcclxuICogQHBhcmFtIHRoaXNfYnV0dG9uXHRcdC0gdGhpcyBvYmplY3Qgb2Ygc3BlY2lmaWMgYnV0dG9uXHJcbiAqIEByZXR1cm4gc3RyaW5nXHRcdFx0LSBDU1MgY2xhc3NlcyB0aGF0IHdhcyBwcmV2aW91c2x5IGluIGJ1dHRvbiBpY29uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2J1dHRvbl9lbmFibGVfbG9hZGluZ19pY29uKHRoaXNfYnV0dG9uKSB7XHJcblxyXG5cdHZhciBqQnV0dG9uICAgICAgICAgPSBqUXVlcnkoIHRoaXNfYnV0dG9uICk7XHJcblx0dmFyIGpJY29uICAgICAgICAgICA9IGpCdXR0b24uZmluZCggJ2knICk7XHJcblx0dmFyIHByZXZpb3NfY2xhc3NlcyA9IGpJY29uLmF0dHIoICdjbGFzcycgKTtcclxuXHJcblx0akljb24ucmVtb3ZlQ2xhc3MoKS5hZGRDbGFzcyggJ21lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JvdGF0ZV9yaWdodCB3cGJjX3NwaW4nICk7XHQvLyBTZXQgUm90YXRlIGljb24uXHJcblx0Ly8gakljb24uYWRkQ2xhc3MoICd3cGJjX2FuaW1hdGlvbl9wYXVzZScgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBQYXVzZSBhbmltYXRpb24uXHJcblx0Ly8gakljb24uYWRkQ2xhc3MoICd3cGJjX3VpX3JlZCcgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2V0IGljb24gY29sb3IgcmVkLlxyXG5cclxuXHRqSWNvbi5hdHRyKCAnd3BiY19wcmV2aW91c19jbGFzcycsIHByZXZpb3NfY2xhc3NlcyApXHJcblxyXG5cdGpCdXR0b24uYWRkQ2xhc3MoICdkaXNhYmxlZCcgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBEaXNhYmxlIGJ1dHRvblxyXG5cdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBhdHRyIGluc3RlYWQgb2YgcHJvcCwgYmVjYXVzZSBmb3IgQSBlbGVtZW50cywgIGF0dHJpYnV0ZSAnZGlzYWJsZWQnIGRvICBub3QgYWRkZWQgd2l0aCBqQnV0dG9uLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApOy5cclxuXHJcblx0akJ1dHRvbi5hdHRyKCAnd3BiY19wcmV2aW91c19vbmNsaWNrJywgakJ1dHRvbi5hdHRyKCAnb25jbGljaycgKSApO1x0XHQvLyBTYXZlIHRoaXMgdmFsdWUuXHJcblx0akJ1dHRvbi5hdHRyKCAnb25jbGljaycsICcnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIERpc2FibGUgYWN0aW9ucyBcIm9uIGNsaWNrXCIuXHJcblxyXG5cdHJldHVybiBwcmV2aW9zX2NsYXNzZXM7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogSGlkZSBMb2FkaW5nIChyb3RhdGluZyBhcnJvdykgaWNvbiBmb3IgYnV0dG9uIHRoYXQgd2FzIGNsaWNrZWQgYW5kIHNob3cgcHJldmlvdXMgaWNvbiBhbmQgZW5hYmxlIGJ1dHRvblxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19idXR0b25cdFx0LSB0aGlzIG9iamVjdCBvZiBzcGVjaWZpYyBidXR0b25cclxuICogQHJldHVybiBzdHJpbmdcdFx0XHQtIENTUyBjbGFzc2VzIHRoYXQgd2FzIHByZXZpb3VzbHkgaW4gYnV0dG9uIGljb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYnV0dG9uX2Rpc2FibGVfbG9hZGluZ19pY29uKHRoaXNfYnV0dG9uKSB7XHJcblxyXG5cdHZhciBqQnV0dG9uID0galF1ZXJ5KCB0aGlzX2J1dHRvbiApO1xyXG5cdHZhciBqSWNvbiAgID0gakJ1dHRvbi5maW5kKCAnaScgKTtcclxuXHJcblx0dmFyIHByZXZpb3NfY2xhc3NlcyA9IGpJY29uLmF0dHIoICd3cGJjX3ByZXZpb3VzX2NsYXNzJyApO1xyXG5cdGlmIChcclxuXHRcdCh1bmRlZmluZWQgIT0gcHJldmlvc19jbGFzc2VzKVxyXG5cdFx0JiYgKCcnICE9IHByZXZpb3NfY2xhc3NlcylcclxuXHQpIHtcclxuXHRcdGpJY29uLnJlbW92ZUNsYXNzKCkuYWRkQ2xhc3MoIHByZXZpb3NfY2xhc3NlcyApO1xyXG5cdH1cclxuXHJcblx0akJ1dHRvbi5yZW1vdmVDbGFzcyggJ2Rpc2FibGVkJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlbW92ZSBEaXNhYmxlIGJ1dHRvbi5cclxuXHJcblx0dmFyIHByZXZpb3VzX29uY2xpY2sgPSBqQnV0dG9uLmF0dHIoICd3cGJjX3ByZXZpb3VzX29uY2xpY2snIClcclxuXHRpZiAoXHJcblx0XHQodW5kZWZpbmVkICE9IHByZXZpb3VzX29uY2xpY2spXHJcblx0XHQmJiAoJycgIT0gcHJldmlvdXNfb25jbGljaylcclxuXHQpIHtcclxuXHRcdGpCdXR0b24uYXR0ciggJ29uY2xpY2snLCBwcmV2aW91c19vbmNsaWNrICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcHJldmlvc19jbGFzc2VzO1xyXG59XHJcbiIsIi8qKlxyXG4gKiBPbiBzZWxlY3Rpb24gIG9mIHJhZGlvIGJ1dHRvbiwgYWRqdXN0IGF0dHJpYnV0ZXMgb2YgcmFkaW8gY29udGFpbmVyXHJcbiAqXHJcbiAqIEBwYXJhbSBfdGhpc1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX3NlbGVjdGlvbihfdGhpcykge1xyXG5cclxuXHRpZiAoIGpRdWVyeSggX3RoaXMgKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0alF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY191aV9yYWRpb19zZWN0aW9uJyApLmZpbmQoICcud3BiY191aV9yYWRpb19jb250YWluZXInICkucmVtb3ZlQXR0ciggJ2RhdGEtc2VsZWN0ZWQnICk7XHJcblx0XHRqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3VpX3JhZGlvX2NvbnRhaW5lcjpub3QoLmRpc2FibGVkKScgKS5hdHRyKCAnZGF0YS1zZWxlY3RlZCcsIHRydWUgKTtcclxuXHR9XHJcblxyXG5cdGlmICggalF1ZXJ5KCBfdGhpcyApLmlzKCAnOmRpc2FibGVkJyApICkge1xyXG5cdFx0alF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY191aV9yYWRpb19jb250YWluZXInICkuYWRkQ2xhc3MoICdkaXNhYmxlZCcgKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPbiBjbGljayBvbiBSYWRpbyBDb250YWluZXIsIHdlIHdpbGwgIHNlbGVjdCAgdGhlICByYWRpbyBidXR0b24gICAgYW5kIHRoZW4gYWRqdXN0IGF0dHJpYnV0ZXMgb2YgcmFkaW8gY29udGFpbmVyXHJcbiAqXHJcbiAqIEBwYXJhbSBfdGhpc1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrKF90aGlzKSB7XHJcblxyXG5cdGlmICggalF1ZXJ5KCBfdGhpcyApLmhhc0NsYXNzKCAnZGlzYWJsZWQnICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR2YXIgal9yYWRpbyA9IGpRdWVyeSggX3RoaXMgKS5maW5kKCAnaW5wdXRbdHlwZT1yYWRpb106bm90KC53cGJjLWZvcm0tcmFkaW8taW50ZXJuYWwpJyApO1xyXG5cdGlmICggal9yYWRpby5sZW5ndGggKSB7XHJcblx0XHRqX3JhZGlvLnByb3AoICdjaGVja2VkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0fVxyXG5cclxufSIsIlwidXNlIHN0cmljdFwiO1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gRnVsbCBTY3JlZW4gIC0gIHN1cHBvcnQgZnVuY3Rpb25zICAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcbiAqIFJldHVybiBldmVyeSBjb29raWUgcGF0aCB0aGF0IGNhbiBhcHBseSB0byB0aGUgY3VycmVudCBXb3JkUHJlc3MgYWRtaW4gVVJMLlxuICpcbiAqIFdvcmRQcmVzcyBtYXkgcnVuIGZyb20gYSBzdWJkaXJlY3RvcnkuIFVwZGF0aW5nIHRoZSByb290LCBzaXRlLCBhbmQgYWRtaW5cbiAqIHBhdGhzIHByZXZlbnRzIGFuIG9sZGVyLCBtb3JlLXNwZWNpZmljIGNvb2tpZSBmcm9tIG92ZXJyaWRpbmcgdGhlIG5ldyBtb2RlLlxuICpcbiAqIEByZXR1cm4ge3N0cmluZ1tdfSBVbmlxdWUgYWJzb2x1dGUgY29va2llIHBhdGhzLlxuICovXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19mdWxsX3NjcmVlbl9fZ2V0X2Nvb2tpZV9wYXRocygpIHtcblx0dmFyIGNvb2tpZV9wYXRocyA9IFsgJy8nIF07XG5cdHZhciBhZG1pbl9tYXJrZXIgPSAnL3dwLWFkbWluLyc7XG5cdHZhciBjdXJyZW50X3BhdGggPSB3aW5kb3cubG9jYXRpb24gJiYgd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lID8gd2luZG93LmxvY2F0aW9uLnBhdGhuYW1lIDogJyc7XG5cdHZhciBhZG1pbl9pbmRleCAgPSBjdXJyZW50X3BhdGguaW5kZXhPZiggYWRtaW5fbWFya2VyICk7XG5cblx0aWYgKCBhZG1pbl9pbmRleCA+PSAwICkge1xuXHRcdGNvb2tpZV9wYXRocy5wdXNoKCBjdXJyZW50X3BhdGguc3Vic3RyaW5nKCAwLCBhZG1pbl9pbmRleCArIDEgKSApO1xuXHRcdGNvb2tpZV9wYXRocy5wdXNoKCBjdXJyZW50X3BhdGguc3Vic3RyaW5nKCAwLCBhZG1pbl9pbmRleCArIGFkbWluX21hcmtlci5sZW5ndGggKSApO1xuXHR9XG5cblx0cmV0dXJuIGNvb2tpZV9wYXRocy5maWx0ZXIoIGZ1bmN0aW9uICggcGF0aCwgaW5kZXggKSB7XG5cdFx0cmV0dXJuIHBhdGggJiYgY29va2llX3BhdGhzLmluZGV4T2YoIHBhdGggKSA9PT0gaW5kZXg7XG5cdH0gKTtcbn1cblxuLyoqXG4gKiBTYXZlIEZ1bGwgU2NyZWVuIHByZWZlcmVuY2UgaW4gYSBzaG9ydC1saXZlZCBicm93c2VyIGNvb2tpZS5cbiAqXG4gKiBUaGlzIG1ha2VzIHRoZSBuZXh0IGFkbWluIHBhZ2UgbG9hZCBkZXRlcm1pbmlzdGljIGV2ZW4gaWYgdGhlIGFzeW5jaHJvbm91c1xuICogdXNlci1tZXRhIHJlcXVlc3QgaXMgaW50ZXJydXB0ZWQuIFRoZSB0aW1lc3RhbXAgbGV0cyBQSFAgZGlzdGluZ3Vpc2ggdGhpc1xuICogcGVuZGluZyB2YWx1ZSBmcm9tIGEgc3RhbGUgbGVnYWN5IGNvb2tpZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgRnVsbHNjcmVlbiBtb2RlLCBlaXRoZXIgYE9uYCBvciBgT2ZmYC5cbiAqXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19mdWxsX3NjcmVlbl9fc2V0X2Nvb2tpZSggdmFsdWUgKSB7XG5cdHZhciBtYXhfYWdlICAgICAgPSA1ICogNjA7XG5cdHZhciBpc3N1ZWRfYXQgICAgPSBNYXRoLmZsb29yKCBEYXRlLm5vdygpIC8gMTAwMCApO1xuXHR2YXIgY29va2llX3ZhbHVlID0gZW5jb2RlVVJJQ29tcG9uZW50KCB2YWx1ZSArICd8JyArIGlzc3VlZF9hdCApO1xuXG5cdHdwYmNfYWRtaW5fdWlfX2Z1bGxfc2NyZWVuX19nZXRfY29va2llX3BhdGhzKCkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb29raWVfcGF0aCApIHtcblx0XHRkb2N1bWVudC5jb29raWUgPSAnd3BiY19hZG1pbl9mdWxsX3NjcmVlbj0nICsgY29va2llX3ZhbHVlICsgJzsgcGF0aD0nICsgY29va2llX3BhdGggKyAnOyBtYXgtYWdlPScgKyBtYXhfYWdlICsgJzsgU2FtZVNpdGU9TGF4Jztcblx0fSApO1xufVxuXHJcbi8qKlxyXG4gKiBBcHBseSBGdWxsIFNjcmVlbiBtb2RlIGZyb20gYSB1c2VyIGNsaWNrLlxyXG4gKlxyXG4gKiBAcGFyYW0gSFRNTEVsZW1lbnQgZWwgICAgICAgICAgICAgICAgIENsaWNrZWQgY29udHJvbC5cclxuICogQHBhcmFtIGJvb2wgICAgICAgIGlzX3NhdmVfdXNlcl9zdGF0ZSBXaGV0aGVyIHRvIHNhdmUgdXNlciBwcmVmZXJlbmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZnVsbF9zY3JlZW5fX2RvX29uKCBlbCwgaXNfc2F2ZV91c2VyX3N0YXRlICkge1xyXG5cdGpRdWVyeSggJ2JvZHknICkuYWRkQ2xhc3MoICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuJyApO1xyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG5cclxuXHRpZiAoIGlzX3NhdmVfdXNlcl9zdGF0ZSApIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX2Z1bGxfc2NyZWVuX19zZXRfY29va2llKCAnT24nICk7XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19zYXZlX2N1c3RvbV91c2VyX2RhdGFfZnJvbV9lbGVtZW50ICkge1xyXG5cdFx0XHR3cGJjX3NhdmVfY3VzdG9tX3VzZXJfZGF0YV9mcm9tX2VsZW1lbnQoIGVsICk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogRXhpdCBGdWxsIFNjcmVlbiBtb2RlIGZyb20gYSB1c2VyIGNsaWNrLlxyXG4gKlxyXG4gKiBAcGFyYW0gSFRNTEVsZW1lbnQgZWwgICAgICAgICAgICAgICAgIENsaWNrZWQgY29udHJvbC5cclxuICogQHBhcmFtIGJvb2wgICAgICAgIGlzX3NhdmVfdXNlcl9zdGF0ZSBXaGV0aGVyIHRvIHNhdmUgdXNlciBwcmVmZXJlbmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZnVsbF9zY3JlZW5fX2RvX29mZiggZWwsIGlzX3NhdmVfdXNlcl9zdGF0ZSApIHtcclxuXHRqUXVlcnkoICdib2R5JyApLnJlbW92ZUNsYXNzKCAnd3BiY19hZG1pbl9mdWxsX3NjcmVlbicgKTtcclxuXHR3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUoKTtcclxuXHJcblx0aWYgKCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3VpX19mdWxsX3NjcmVlbl9fc2V0X2Nvb2tpZSggJ09mZicgKTtcclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX3NhdmVfY3VzdG9tX3VzZXJfZGF0YV9mcm9tX2VsZW1lbnQgKSB7XHJcblx0XHRcdHdwYmNfc2F2ZV9jdXN0b21fdXNlcl9kYXRhX2Zyb21fZWxlbWVudCggZWwgKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBGdWxsICBzY3JlZW4gbW9kZSwgIGJ5ICByZW1vdmluZyB0b3AgdGFiXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUoKXtcclxuXHRpZiAoIGpRdWVyeSggJ2JvZHknICkuaGFzQ2xhc3MoICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuJyApICkge1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCcgKS5yZW1vdmVDbGFzcyggJ3dwLXRvb2xiYXInICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJ2h0bWwnICkuYWRkQ2xhc3MoICd3cC10b29sYmFyJyApO1xyXG5cdH1cclxuXHR3cGJjX2NoZWNrX2J1dHRvbnNfbWF4X21pbl9pbl9mdWxsX3NjcmVlbl9tb2RlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfY2hlY2tfYnV0dG9uc19tYXhfbWluX2luX2Z1bGxfc2NyZWVuX21vZGUoKSB7XHJcblx0aWYgKCBqUXVlcnkoICdib2R5JyApLmhhc0NsYXNzKCAnd3BiY19hZG1pbl9mdWxsX3NjcmVlbicgKSApIHtcclxuXHRcdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fZnVsbF9zY3JlZW4nICAgKS5hZGRDbGFzcyggICAgJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0XHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX25vcm1hbF9zY3JlZW4nICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2Z1bGxfc2NyZWVuJyAgICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9ub3JtYWxfc2NyZWVuJyApLmFkZENsYXNzKCAgICAnd3BiY191aV9faGlkZScgKTtcclxuXHR9XHJcbn1cclxuXHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkge1xyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG59ICk7XHJcbiIsIi8qKlxyXG4gKiBDaGVja2JveCBTZWxlY3Rpb24gZnVuY3Rpb25zIGZvciBMaXN0aW5nLlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBTZWxlY3Rpb25zIG9mIHNldmVyYWwgIGNoZWNrYm94ZXMgbGlrZSBpbiBnTWFpbCB3aXRoIHNoaWZ0IDopXHJcbiAqIE5lZWQgdG8gIGhhdmUgdGhpcyBzdHJ1Y3R1cmU6XHJcbiAqIC53cGJjX3NlbGVjdGFibGVfdGFibGVcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2hlYWRcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2JvZHlcclxuICogICAgICAgICAgLndwYmNfcm93XHJcbiAqICAgICAgICAgICAgICAuY2hlY2stY29sdW1uXHJcbiAqICAgICAgICAgICAgICAgICAgOmNoZWNrYm94XHJcbiAqICAgICAgLndwYmNfc2VsZWN0YWJsZV9mb290XHJcbiAqICAgICAgICAgICAgICAuY2hlY2stY29sdW1uXHJcbiAqICAgICAgICAgICAgICAgICAgOmNoZWNrYm94XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlZmluZV9nbWFpbF9jaGVja2JveF9zZWxlY3Rpb24oICQgKXtcclxuXHJcblx0dmFyIGNoZWNrcywgZmlyc3QsIGxhc3QsIGNoZWNrZWQsIHNsaWNlZCwgbGFzdENsaWNrZWQgPSBmYWxzZTtcclxuXHJcblx0Ly8gQ2hlY2sgYWxsIGNoZWNrYm94ZXMuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApLm9uKFxyXG5cdFx0J2NsaWNrJyxcclxuXHRcdGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT0gZS5zaGlmdEtleSApIHtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGUuc2hpZnRLZXkgKSB7XHJcblx0XHRcdFx0aWYgKCAhIGxhc3RDbGlja2VkICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNoZWNrcyAgPSAkKCBsYXN0Q2xpY2tlZCApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJzpjaGVja2JveCcgKS5maWx0ZXIoICc6dmlzaWJsZTplbmFibGVkJyApO1xyXG5cdFx0XHRcdGZpcnN0ICAgPSBjaGVja3MuaW5kZXgoIGxhc3RDbGlja2VkICk7XHJcblx0XHRcdFx0bGFzdCAgICA9IGNoZWNrcy5pbmRleCggdGhpcyApO1xyXG5cdFx0XHRcdGNoZWNrZWQgPSAkKCB0aGlzICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0aWYgKCAwIDwgZmlyc3QgJiYgMCA8IGxhc3QgJiYgZmlyc3QgIT0gbGFzdCApIHtcclxuXHRcdFx0XHRcdHNsaWNlZCA9IChsYXN0ID4gZmlyc3QpID8gY2hlY2tzLnNsaWNlKCBmaXJzdCwgbGFzdCApIDogY2hlY2tzLnNsaWNlKCBsYXN0LCBmaXJzdCApO1xyXG5cdFx0XHRcdFx0c2xpY2VkLnByb3AoXHJcblx0XHRcdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRcdGlmICggJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19yb3cnICkuaXMoICc6dmlzaWJsZScgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBjaGVja2VkO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0bGFzdENsaWNrZWQgPSB0aGlzO1xyXG5cclxuXHRcdFx0Ly8gdG9nZ2xlIFwiY2hlY2sgYWxsXCIgY2hlY2tib3hlcy5cclxuXHRcdFx0dmFyIHVuY2hlY2tlZCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICc6Y2hlY2tib3gnICkuZmlsdGVyKCAnOnZpc2libGU6ZW5hYmxlZCcgKS5ub3QoICc6Y2hlY2tlZCcgKTtcclxuXHRcdFx0JCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX3RhYmxlJyApLmNoaWxkcmVuKCAnLndwYmNfc2VsZWN0YWJsZV9oZWFkLCAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmluZCggJzpjaGVja2JveCcgKS5wcm9wKFxyXG5cdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gKDAgPT09IHVuY2hlY2tlZC5sZW5ndGgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0KS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0Ly8gSGVhZCB8fCBGb290IGNsaWNraW5nIHRvICBzZWxlY3QgLyBkZXNlbGVjdCBBTEwuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfaGVhZCwgLndwYmNfc2VsZWN0YWJsZV9mb290JyApLmZpbmQoICcuY2hlY2stY29sdW1uIDpjaGVja2JveCcgKS5vbihcclxuXHRcdCdjbGljaycsXHJcblx0XHRmdW5jdGlvbiAoZXZlbnQpIHtcclxuXHRcdFx0dmFyICR0aGlzICAgICAgICAgID0gJCggdGhpcyApLFxyXG5cdFx0XHRcdCR0YWJsZSAgICAgICAgID0gJHRoaXMuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfdGFibGUnICksXHJcblx0XHRcdFx0Y29udHJvbENoZWNrZWQgPSAkdGhpcy5wcm9wKCAnY2hlY2tlZCcgKSxcclxuXHRcdFx0XHR0b2dnbGUgICAgICAgICA9IGV2ZW50LnNoaWZ0S2V5IHx8ICR0aGlzLmRhdGEoICd3cC10b2dnbGUnICk7XHJcblxyXG5cdFx0XHQkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmlsdGVyKCAnOnZpc2libGUnIClcclxuXHRcdFx0XHQuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKVxyXG5cdFx0XHRcdC5wcm9wKFxyXG5cdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRpZiAoICQoIHRoaXMgKS5pcyggJzpoaWRkZW4sOmRpc2FibGVkJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRpZiAoIHRvZ2dsZSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gISAkKCB0aGlzICkucHJvcCggJ2NoZWNrZWQnICk7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIGNvbnRyb2xDaGVja2VkICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdFx0XHQkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2hlYWQsICAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmlsdGVyKCAnOnZpc2libGUnIClcclxuXHRcdFx0XHQuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKVxyXG5cdFx0XHRcdC5wcm9wKFxyXG5cdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHRvZ2dsZSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoIGNvbnRyb2xDaGVja2VkICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cclxuXHQvLyBWaXN1YWxseSAgc2hvdyBzZWxlY3RlZCBib3JkZXIuXHJcblx0JCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbiA6Y2hlY2tib3gnICkub24oXHJcblx0XHQnY2hhbmdlJyxcclxuXHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHRpZiAoIGpRdWVyeSggdGhpcyApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0alF1ZXJ5KCB0aGlzICkuY2xvc2VzdCggJy53cGJjX2xpc3Rfcm93JyApLmFkZENsYXNzKCAncm93X3NlbGVjdGVkX2NvbG9yJyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGpRdWVyeSggdGhpcyApLmNsb3Nlc3QoICcud3BiY19saXN0X3JvdycgKS5yZW1vdmVDbGFzcyggJ3Jvd19zZWxlY3RlZF9jb2xvcicgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRGlzYWJsZSB0ZXh0IHNlbGVjdGlvbiB3aGlsZSBwcmVzc2luZyAnc2hpZnQnLlxyXG5cdFx0XHRkb2N1bWVudC5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKTtcclxuXHJcblx0XHRcdC8vIFNob3cgb3IgaGlkZSBidXR0b25zIG9uIEFjdGlvbnMgdG9vbGJhciAgYXQgIEJvb2tpbmcgTGlzdGluZyAgcGFnZSwgIGlmIHdlIGhhdmUgc29tZSBzZWxlY3RlZCBib29raW5ncy5cclxuXHRcdFx0d3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0d3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCk7XHJcbn1cclxuIiwiXHJcbi8qKlxyXG4gKiBHZXQgSUQgYXJyYXkgIG9mIHNlbGVjdGVkIGVsZW1lbnRzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQoKSB7XHJcblxyXG5cdHZhciAkdGFibGUgICAgICA9IGpRdWVyeSggJy53cGJjX193cmFwX19ib29raW5nX2xpc3RpbmcgLndwYmNfc2VsZWN0YWJsZV90YWJsZScgKTtcclxuXHR2YXIgY2hlY2tib3hlcyAgPSAkdGFibGUuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmlsdGVyKCAnOnZpc2libGUnICkuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKTtcclxuXHR2YXIgc2VsZWN0ZWRfaWQgPSBbXTtcclxuXHJcblx0alF1ZXJ5LmVhY2goXHJcblx0XHRjaGVja2JveGVzLFxyXG5cdFx0ZnVuY3Rpb24gKGtleSwgY2hlY2tib3gpIHtcclxuXHRcdFx0aWYgKCBqUXVlcnkoIGNoZWNrYm94ICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHR2YXIgZWxlbWVudF9pZCA9IHdwYmNfZ2V0X3Jvd19pZF9mcm9tX2VsZW1lbnQoIGNoZWNrYm94ICk7XHJcblx0XHRcdFx0c2VsZWN0ZWRfaWQucHVzaCggZWxlbWVudF9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblx0cmV0dXJuIHNlbGVjdGVkX2lkO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEdldCBJRCBvZiByb3csICBiYXNlZCBvbiBjbGNpa2VkIGVsZW1lbnRcclxuICpcclxuICogQHBhcmFtIHRoaXNfaW5ib3VuZF9lbGVtZW50ICAtIHVzdXNsbHkgIHRoaXNcclxuICogQHJldHVybnMge251bWJlcn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X3Jvd19pZF9mcm9tX2VsZW1lbnQodGhpc19pbmJvdW5kX2VsZW1lbnQpIHtcclxuXHJcblx0dmFyIGVsZW1lbnRfaWQgPSBqUXVlcnkoIHRoaXNfaW5ib3VuZF9lbGVtZW50ICkuY2xvc2VzdCggJy53cGJjX2xpc3RpbmdfdXN1YWxfcm93JyApLmF0dHIoICdpZCcgKTtcclxuXHJcblx0ZWxlbWVudF9pZCA9IHBhcnNlSW50KCBlbGVtZW50X2lkLnJlcGxhY2UoICdyb3dfaWRfJywgJycgKSApO1xyXG5cclxuXHRyZXR1cm4gZWxlbWVudF9pZDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiA9PSBCb29raW5nIExpc3RpbmcgPT0gU2hvdyBvciBoaWRlIGJ1dHRvbnMgb24gQWN0aW9ucyB0b29sYmFyICBhdCAgICBwYWdlLCAgaWYgd2UgaGF2ZSBzb21lIHNlbGVjdGVkIGJvb2tpbmdzLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzKCl7XHJcblxyXG5cdHZhciBzZWxlY3RlZF9yb3dzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpO1xyXG5cclxuXHRpZiAoIHNlbGVjdGVkX3Jvd3NfYXJyLmxlbmd0aCA+IDAgKSB7XHJcblx0XHRqUXVlcnkoICcuaGlkZV9idXR0b25faWZfbm9fc2VsZWN0aW9uJyApLnNob3coKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnLmhpZGVfYnV0dG9uX2lmX25vX3NlbGVjdGlvbicgKS5oaWRlKCk7XHJcblx0fVxyXG59IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBMZWZ0IEJhciAgLSAgZXhwYW5kIC8gY29sYXBzZSBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBTYXZlIHVzZXIncyBwcmVmZXJyZWQgbGVmdCBzaWRlYmFyIG1vZGUuXHJcbiAqXHJcbiAqIEBwYXJhbSBzdHJpbmcgbW9kZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zYXZlX21vZGUoIG1vZGUgKSB7XHJcblx0dmFyIGFsbG93ZWRfbW9kZXMgPSBbICdtaW4nLCAnY29tcGFjdCcsICdtYXgnIF07XHJcblxyXG5cdGlmICggYWxsb3dlZF9tb2Rlcy5pbmRleE9mKCBtb2RlICkgPT09IC0xICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyICRzYXZlciA9IGpRdWVyeSggJyN3cGJjX2xlZnRfc2lkZWJhcl92aWV3X21vZGVfc2F2ZXInICk7XHJcblxyXG5cdGlmICggISAkc2F2ZXIubGVuZ3RoICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd3BiY19zYXZlX2N1c3RvbV91c2VyX2RhdGFfZnJvbV9lbGVtZW50ICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0JHNhdmVyLmRhdGEoICd3cGJjLXUtc2F2ZS12YWx1ZScsIG1vZGUgKTtcclxuXHQkc2F2ZXIuYXR0ciggJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUnLCBtb2RlICk7XHJcblxyXG5cdHdwYmNfc2F2ZV9jdXN0b21fdXNlcl9kYXRhX2Zyb21fZWxlbWVudCggJHNhdmVyLmdldCggMCApICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXZlYWwgdGhlIGFjdGl2ZSBpdGVtIGluc2lkZSB0aGUgc2Nyb2xsYWJsZSBsZWZ0IG5hdmlnYXRpb24uXHJcbiAqXHJcbiAqIFRoZSBhY3RpdmUgaXRlbSBpdHNlbGYgaXMgYWxpZ25lZCB3aXRoIGEgc21hbGwgbGVhZGluZyBvZmZzZXQsIHJlZ2FyZGxlc3Mgb2ZcclxuICogaXRzIHBvc2l0aW9uIGluc2lkZSBhIHJvb3Qgc2VjdGlvbi4gU2Nyb2xsaW5nIGlzIGFwcGxpZWQgb25seSB0byBTaW1wbGVCYXInc1xyXG4gKiBpbnRlcm5hbCBzY3JvbGwgZWxlbWVudCBzbyB0aGUgV29yZFByZXNzIGFkbWluaXN0cmF0aW9uIGRvY3VtZW50IGRvZXMgbm90XHJcbiAqIG1vdmUuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fG51bGx8dW5kZWZpbmVkfSBzaW1wbGViYXJfaW5zdGFuY2UgT3B0aW9uYWwgaW5pdGlhbGl6ZWQgU2ltcGxlQmFyIGluc3RhbmNlLlxyXG4gKiBAcmV0dXJuIHt2b2lkfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zY3JvbGxfdG9fYWN0aXZlX2l0ZW0oIHNpbXBsZWJhcl9pbnN0YW5jZSApIHtcclxuXHR2YXIgbGVmdF9uYXZpZ2F0aW9uX2VsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfdWlfZWxfX3ZlcnRfbGVmdF9iYXJfX2NvbnRlbnQnICk7XHJcblxyXG5cdGlmIChcclxuXHRcdCEgc2ltcGxlYmFyX2luc3RhbmNlXHJcblx0XHQmJiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIFNpbXBsZUJhclxyXG5cdFx0JiYgU2ltcGxlQmFyLmluc3RhbmNlc1xyXG5cdFx0JiYgbGVmdF9uYXZpZ2F0aW9uX2VsZW1lbnRcclxuXHQpIHtcclxuXHRcdHNpbXBsZWJhcl9pbnN0YW5jZSA9IFNpbXBsZUJhci5pbnN0YW5jZXMuZ2V0KCBsZWZ0X25hdmlnYXRpb25fZWxlbWVudCApO1xyXG5cdH1cclxuXHJcblx0aWYgKFxyXG5cdFx0ISBzaW1wbGViYXJfaW5zdGFuY2VcclxuXHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBzaW1wbGViYXJfaW5zdGFuY2UuZ2V0U2Nyb2xsRWxlbWVudFxyXG5cdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHNpbXBsZWJhcl9pbnN0YW5jZS5nZXRDb250ZW50RWxlbWVudFxyXG5cdCkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xyXG5cdFx0dmFyIHNjcm9sbF9lbGVtZW50ICA9IHNpbXBsZWJhcl9pbnN0YW5jZS5nZXRTY3JvbGxFbGVtZW50KCk7XHJcblx0XHR2YXIgY29udGVudF9lbGVtZW50ID0gc2ltcGxlYmFyX2luc3RhbmNlLmdldENvbnRlbnRFbGVtZW50KCk7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQhIHNjcm9sbF9lbGVtZW50XHJcblx0XHRcdHx8ICEgY29udGVudF9lbGVtZW50XHJcblx0XHRcdHx8ICEgY29udGVudF9lbGVtZW50LmNsb3Nlc3QoICcud3BiY191aV9lbF9fdmVydF9sZWZ0X2Jhcl9fY29udGVudCcgKVxyXG5cdFx0KSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRzaW1wbGViYXJfaW5zdGFuY2UucmVjYWxjdWxhdGUoKTtcclxuXHJcblx0XHR2YXIgYWN0aXZlX2l0ZW0gPSBjb250ZW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJy53cGJjX3VpX2VsX192ZXJ0X25hdl9pdGVtLmFjdGl2ZScgKTtcclxuXHJcblx0XHRpZiAoICEgYWN0aXZlX2l0ZW0gfHwgbnVsbCA9PT0gYWN0aXZlX2l0ZW0ub2Zmc2V0UGFyZW50IHx8IDAgPj0gc2Nyb2xsX2VsZW1lbnQuY2xpZW50SGVpZ2h0ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHNjcm9sbF9yZWN0ICAgID0gc2Nyb2xsX2VsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHR2YXIgYWN0aXZlX3JlY3QgICAgPSBhY3RpdmVfaXRlbS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdHZhciBjdXJyZW50X3RvcCAgICA9IHNjcm9sbF9lbGVtZW50LnNjcm9sbFRvcDtcclxuXHRcdHZhciBsZWFkaW5nX29mZnNldCA9IDg1O1xyXG5cdFx0dmFyIGFjdGl2ZV90b3AgICAgID0gY3VycmVudF90b3AgKyBhY3RpdmVfcmVjdC50b3AgLSBzY3JvbGxfcmVjdC50b3A7XHJcblx0XHR2YXIgdGFyZ2V0X3RvcCAgICAgPSBhY3RpdmVfdG9wIC0gbGVhZGluZ19vZmZzZXQ7XHJcblxyXG5cdFx0dmFyIG1heGltdW1fdG9wID0gTWF0aC5tYXgoIDAsIHNjcm9sbF9lbGVtZW50LnNjcm9sbEhlaWdodCAtIHNjcm9sbF9lbGVtZW50LmNsaWVudEhlaWdodCApO1xyXG5cclxuXHRcdHNjcm9sbF9lbGVtZW50LnNjcm9sbFRvcCA9IE1hdGgubWF4KCAwLCBNYXRoLm1pbiggTWF0aC5yb3VuZCggdGFyZ2V0X3RvcCApLCBtYXhpbXVtX3RvcCApICk7XHJcblx0fSApO1xyXG59XHJcblxyXG4vKipcclxuICogRXhwYW5kIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKlxyXG4gKiBAcGFyYW0gYm9vbCBpc19zYXZlX3VzZXJfc3RhdGUgU2F2ZSB0aGlzIG1vZGUgYXMgdXNlcidzIHByZWZlcmVuY2UuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21heCggaXNfc2F2ZV91c2VyX3N0YXRlICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21heCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblxyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWluIHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWF4IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfY29tcGFjdCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLmFkZENsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9tYXgnICk7XHJcblx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zY3JvbGxfdG9fYWN0aXZlX2l0ZW0oKTtcclxuXHJcblx0aWYgKCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3NhdmVfbW9kZSggJ21heCcgKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKlxyXG4gKiBAcGFyYW0gYm9vbCBpc19zYXZlX3VzZXJfc3RhdGUgU2F2ZSB0aGlzIG1vZGUgYXMgdXNlcidzIHByZWZlcmVuY2UuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21pbiggaXNfc2F2ZV91c2VyX3N0YXRlICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21pbicgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblxyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWluIHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWF4IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfY29tcGFjdCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLmFkZENsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4nICk7XHJcblxyXG5cdGlmICggaXNfc2F2ZV91c2VyX3N0YXRlICkge1xyXG5cdFx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zYXZlX21vZGUoICdtaW4nICk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQ29sYXBzZSBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICpcclxuICogQHBhcmFtIGJvb2wgaXNfc2F2ZV91c2VyX3N0YXRlIFNhdmUgdGhpcyBtb2RlIGFzIHVzZXIncyBwcmVmZXJlbmNlLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19jb21wYWN0KCBpc19zYXZlX3VzZXJfc3RhdGUgKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnY29tcGFjdCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblxyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWluIHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWF4IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfY29tcGFjdCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLmFkZENsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9jb21wYWN0JyApO1xyXG5cdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fc2Nyb2xsX3RvX2FjdGl2ZV9pdGVtKCk7XHJcblxyXG5cdGlmICggaXNfc2F2ZV91c2VyX3N0YXRlICkge1xyXG5cdFx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zYXZlX21vZGUoICdjb21wYWN0JyApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBsZXRlbHkgSGlkZSBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9faGlkZSgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW4gbWF4IGNvbXBhY3Qgbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHQvLyBIaWRlIHRvcCBcIk1lbnVcIiBidXR0b24gd2l0aCBkaXZpZGVyLlxyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19sZWZ0X3ZlcnRpY2FsX25hdiwud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfbGVmdF92ZXJ0aWNhbF9uYXZfZGl2aWRlcicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblxyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWluIHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWF4IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfY29tcGFjdCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X25vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLmFkZENsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9ub25lJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQWN0aW9uIG9uIGNsaWNrIFwiR28gQmFja1wiIC0gc2hvdyByb290IG1lbnVcclxuICogb3Igc29tZSBvdGhlciBzZWN0aW9uIGluIGxlZnQgc2lkZWJhci5cclxuICpcclxuICogQHBhcmFtIHN0cmluZyBtZW51X3RvX3Nob3cgLSBtZW51IHNsdWcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3Nob3dfc2VjdGlvbiggbWVudV90b19zaG93ICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKVxyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uXycgKyBtZW51X3RvX3Nob3cgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBSaWdodCBTaWRlIEJhciAgLSAgZXhwYW5kIC8gY29sYXBzZSBmdW5jdGlvbnMgICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBTeW5jaHJvbml6ZSB0aGUgZG9jdW1lbnQgYm9keSBtYXJrZXIgZm9yIHRoZSBleHBhbmRlZCByaWdodCBzaWRlYmFyLlxyXG4gKlxyXG4gKiBUaGUgbWFya2VyIGlzIGRvbWFpbi1uZXV0cmFsIHNvIGluZGl2aWR1YWwgYWRtaW5pc3RyYXRpb24gcGFnZXMgY2FuIGFkanVzdFxyXG4gKiB0aGVpciBwcmVzZW50YXRpb24gd2l0aG91dCBkdXBsaWNhdGluZyByaWdodC1zaWRlYmFyIHN0YXRlIGhhbmRsaW5nLlxyXG4gKlxyXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzX29wZW4gV2hldGhlciB0aGUgcmlnaHQgc2lkZWJhciBpcyBmdWxseSBleHBhbmRlZC5cclxuICogQHJldHVybiB7dm9pZH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX3NldF9ib2R5X29wZW5fc3RhdGUoIGlzX29wZW4gKSB7XHJcblx0alF1ZXJ5KCAnYm9keScgKS50b2dnbGVDbGFzcyggJ3dwYmNfdWlfZWxfX3ZlcnRfcmlnaHRfYmFyX193cmFwcGVyX29wZW5lZCcsICEhIGlzX29wZW4gKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEV4cGFuZCBWZXJ0aWNhbCBSaWdodCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19tYXgoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluX3JpZ2h0IG1heF9yaWdodCBjb21wYWN0X3JpZ2h0IG5vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbWF4X3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9yaWdodF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9yaWdodF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX3NldF9ib2R5X29wZW5fc3RhdGUoIHRydWUgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgVmVydGljYWwgUmlnaHQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWluKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21pbl9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19zZXRfYm9keV9vcGVuX3N0YXRlKCBmYWxzZSApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29sYXBzZSBWZXJ0aWNhbCBSaWdodCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19jb21wYWN0KCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ2NvbXBhY3RfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2V0X2JvZHlfb3Blbl9zdGF0ZSggZmFsc2UgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBsZXRlbHkgSGlkZSBWZXJ0aWNhbCBSaWdodCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19oaWRlKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ25vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0Ly8gSGlkZSB0b3AgXCJNZW51XCIgYnV0dG9uIHdpdGggZGl2aWRlci5cclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfcmlnaHRfdmVydGljYWxfbmF2LC53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19yaWdodF92ZXJ0aWNhbF9uYXZfZGl2aWRlcicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2V0X2JvZHlfb3Blbl9zdGF0ZSggZmFsc2UgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlc3RvcmUgdGhlIGJvZHkgbWFya2VyIHdoZW4gYSBwYWdlIHJlbmRlcnMgd2l0aCB0aGUgcmlnaHQgc2lkZWJhciBvcGVuLlxyXG4gKi9cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7XHJcblx0d3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fc2V0X2JvZHlfb3Blbl9zdGF0ZSggMCA8IGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlci5tYXhfcmlnaHQnICkubGVuZ3RoICk7XHJcbn0gKTtcclxuXHJcbi8qKlxyXG4gKiBDb2xsYXBzZSBhbiBleHBhbmRlZCByaWdodCBzaWRlYmFyIGFmdGVyIGFuIG9wdGVkLWluIHBhZ2UtY29udGVudCBjbGljay5cclxuICpcclxuICogUGFnZXMgZW5hYmxlIHRoaXMgYmVoYXZpb3IgdGhyb3VnaCB0aGUgcGFnZS1zdHJ1Y3R1cmVcclxuICogcmlnaHRfdmVydGljYWxfc2lkZWJhcl9fY29udGVudF9jbGlja19jb2xsYXBzZV9tb2RlIG9wdGlvbi4gSW50ZXJhY3RpdmVcclxuICogY29udHJvbHMgdGhhdCBvcGVuIG9yIHJldGFpbiBzaWRlYmFyIGNvbnRlbnQgY2FuIG9wdCBvdXQgYnkgcGxhY2luZyB0aGVcclxuICogZGF0YS13cGJjLXJpZ2h0LXNpZGViYXIta2VlcC1vcGVuIGF0dHJpYnV0ZSBvbiB0aGVtc2VsdmVzIG9yIGFuIGFuY2VzdG9yLlxyXG4gKlxyXG4gKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IENvbnRlbnQgY2xpY2sgZXZlbnQgY2FwdHVyZWQgYmVmb3JlIGNhdGFsb2cgcm93cy5cclxuICogQHJldHVybiB7dm9pZH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2NvbGxhcHNlX2Zyb21fY29udGVudF9jbGljayggZXZlbnQgKSB7XHJcblx0dmFyIGV2ZW50X3RhcmdldCA9IGV2ZW50LnRhcmdldCAmJiAxID09PSBldmVudC50YXJnZXQubm9kZVR5cGUgPyBldmVudC50YXJnZXQgOiBudWxsO1xyXG5cdHZhciBjb250ZW50X2VsZW1lbnQgPSBldmVudF90YXJnZXQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGV2ZW50X3RhcmdldC5jbG9zZXN0XHJcblx0XHQ/IGV2ZW50X3RhcmdldC5jbG9zZXN0KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyW2RhdGEtd3BiYy1yaWdodC1zaWRlYmFyLWNvbnRlbnQtY2xpY2stY29sbGFwc2UtbW9kZV0gPiAud3BiY19zZXR0aW5nc19wYWdlX2NvbnRlbnQnIClcclxuXHRcdDogbnVsbDtcclxuXHR2YXIgJGNvbnRlbnQ7XHJcblx0dmFyICR3cmFwcGVyO1xyXG5cdHZhciBjb2xsYXBzZV9tb2RlO1xyXG5cdHZhciBiZWZvcmVfY29sbGFwc2VfZXZlbnQ7XHJcblxyXG5cdGlmICggISBjb250ZW50X2VsZW1lbnQgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQkY29udGVudCA9IGpRdWVyeSggY29udGVudF9lbGVtZW50ICk7XHJcblx0JHdyYXBwZXIgPSAkY29udGVudC5jbG9zZXN0KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApO1xyXG5cdGNvbGxhcHNlX21vZGUgPSBTdHJpbmcoICR3cmFwcGVyLmF0dHIoICdkYXRhLXdwYmMtcmlnaHQtc2lkZWJhci1jb250ZW50LWNsaWNrLWNvbGxhcHNlLW1vZGUnICkgfHwgJycgKTtcclxuXHJcblx0aWYgKCAhICR3cmFwcGVyLmhhc0NsYXNzKCAnbWF4X3JpZ2h0JyApIHx8IFsgJ21pbicsICdjb21wYWN0JywgJ25vbmUnIF0uaW5kZXhPZiggY29sbGFwc2VfbW9kZSApID09PSAtMSApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0aWYgKCBqUXVlcnkoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICdbZGF0YS13cGJjLXJpZ2h0LXNpZGViYXIta2VlcC1vcGVuXScgKS5sZW5ndGggKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvKlxyXG5cdCAqIFRoaXMgY2xpY2sgYmVsb25ncyB0byB0aGUgb3Blbi1zaWRlYmFyIGRpc21pc3NhbCBsYXllci4gQ29uc3VtZSBpdCBiZWZvcmVcclxuXHQgKiBkb21haW4gcm93IGhhbmRsZXJzIHJ1biBzbyB0aGUgc2FtZSBwb2ludGVyIGFjdGlvbiBjYW5ub3QgY2xvc2Ugb25lXHJcblx0ICogaW5zcGVjdG9yIGFuZCBpbW1lZGlhdGVseSBvcGVuIGFub3RoZXIgb25lIHVuZGVybmVhdGggaXQuXHJcblx0ICovXHJcblx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcclxuXHJcblx0YmVmb3JlX2NvbGxhcHNlX2V2ZW50ID0galF1ZXJ5LkV2ZW50KCAnd3BiYzpyaWdodC1zaWRlYmFyLWJlZm9yZS1jb250ZW50LWNvbGxhcHNlJyApO1xyXG5cdCR3cmFwcGVyLnRyaWdnZXIoIGJlZm9yZV9jb2xsYXBzZV9ldmVudCwgWyBldmVudCBdICk7XHJcblx0aWYgKCBiZWZvcmVfY29sbGFwc2VfZXZlbnQuaXNEZWZhdWx0UHJldmVudGVkKCkgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRpZiAoICdjb21wYWN0JyA9PT0gY29sbGFwc2VfbW9kZSApIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2NvbXBhY3QoKTtcclxuXHR9IGVsc2UgaWYgKCAnbm9uZScgPT09IGNvbGxhcHNlX21vZGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19oaWRlKCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21pbigpO1xyXG5cdH1cclxuXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLnRyaWdnZXIoICd3cGJjX3NldHVwX3dpemFyZF9sYXlvdXRfY2hhbmdlZCcgKTtcclxufVxyXG5cclxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgd3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fY29sbGFwc2VfZnJvbV9jb250ZW50X2NsaWNrLCB0cnVlICk7XHJcblxyXG5cclxuLyoqXHJcbiAqIEFjdGlvbiBvbiBjbGljayBcIkdvIEJhY2tcIiAtIHNob3cgcm9vdCBtZW51XHJcbiAqIG9yIHNvbWUgb3RoZXIgc2VjdGlvbiBpbiByaWdodCBzaWRlYmFyLlxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nIG1lbnVfdG9fc2hvdyAtIG1lbnUgc2x1Zy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX3Nob3dfc2VjdGlvbiggbWVudV90b19zaG93ICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X3JpZ2h0X2Jhcl9fc2VjdGlvbicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnIClcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9yaWdodF9iYXJfX3NlY3Rpb25fJyArIG1lbnVfdG9fc2hvdyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEVuZCBSaWdodCBTaWRlIEJhciAgc2VjdGlvbiAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIEdldCBhbmNob3IocykgYXJyYXkgIGZyb20gIFVSTC5cclxuICogRG9jOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTG9jYXRpb25cclxuICpcclxuICogQHJldHVybnMgeypbXX1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpIHtcclxuXHR2YXIgaGFzaGVzICAgICAgICAgICAgPSB3aW5kb3cubG9jYXRpb24uaGFzaC5yZXBsYWNlKCAnJTIzJywgJyMnICk7XHJcblx0dmFyIGhhc2hlc19hcnIgICAgICAgID0gaGFzaGVzLnNwbGl0KCAnIycgKTtcclxuXHR2YXIgcmVzdWx0ICAgICAgICAgICAgPSBbXTtcclxuXHR2YXIgaGFzaGVzX2Fycl9sZW5ndGggPSBoYXNoZXNfYXJyLmxlbmd0aDtcclxuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgaGFzaGVzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHRcdGlmICggaGFzaGVzX2FycltpXS5sZW5ndGggPiAwICkge1xyXG5cdFx0XHRyZXN1bHQucHVzaCggaGFzaGVzX2FycltpXSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG4vKipcclxuICogQXV0byBFeHBhbmQgU2V0dGluZ3Mgc2VjdGlvbiBiYXNlZCBvbiBVUkwgYW5jaG9yLCBhZnRlciAgcGFnZSBsb2FkZWQuXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpIHsgd3BiY19hZG1pbl91aV9fcmVkaXJlY3RfbGVnYWN5X2dlbmVyYWxfYXZhaWxhYmlsaXR5X3VybCgpOyB9ICk7XHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkgeyB3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpOyBzZXRUaW1lb3V0KCAnd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24nLCAxMCApOyB9ICk7XHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkgeyB3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpOyBzZXRUaW1lb3V0KCAnd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24nLCAxNTAgKTsgfSApO1xyXG5cclxuLyoqXHJcbiAqIFJlZGlyZWN0IG9sZCBTZXR0aW5ncyA+IEF2YWlsYWJpbGl0eSBhbmNob3JzIHRvIHRoZSBkZWRpY2F0ZWQgR2VuZXJhbCBBdmFpbGFiaWxpdHkgcGFnZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3JlZGlyZWN0X2xlZ2FjeV9nZW5lcmFsX2F2YWlsYWJpbGl0eV91cmwoKSB7XHJcblxyXG5cdGlmIChcclxuXHRcdCAgICggd2luZG93LmxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1zZXR0aW5ncycgKSA+IC0xIClcclxuXHRcdCYmIChcclxuXHRcdFx0ICAgKCB3aW5kb3cubG9jYXRpb24uaGFzaC5pbmRleE9mKCAnd3BiY19nZW5lcmFsX3NldHRpbmdzX2F2YWlsYWJpbGl0eV9tZXRhYm94JyApID4gLTEgKVxyXG5cdFx0XHR8fCAoIHdpbmRvdy5sb2NhdGlvbi5oYXNoLmluZGV4T2YoICd3cGJjX2dlbmVyYWxfc2V0dGluZ3NfYXZhaWxhYmlsaXR5X3RhYicgKSA+IC0xIClcclxuXHRcdClcclxuXHQpIHtcclxuXHRcdHdpbmRvdy5sb2NhdGlvbi5yZXBsYWNlKCB3aW5kb3cubG9jYXRpb24uaHJlZi5zcGxpdCggJz8nIClbMF0gKyAnP3BhZ2U9d3BiYy1hdmFpbGFiaWxpdHkmdGFiPWdlbmVyYWxfYXZhaWxhYmlsaXR5JyApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEV4cGFuZCBzZWN0aW9uIGluICBHZW5lcmFsIFNldHRpbmdzIHBhZ2UgYW5kIHNlbGVjdCBNZW51IGl0ZW0uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpIHtcclxuXHJcblx0Ly8gd2luZG93LmxvY2F0aW9uLmhhc2ggID0gI3NlY3Rpb25faWQgIC8gIGRvYzogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0xvY2F0aW9uIC5cclxuXHR2YXIgYW5jaG9yc19hcnIgICAgICAgID0gd3BiY191cmxfZ2V0X2FuY2hvcnNfYXJyKCk7XHJcblx0dmFyIGFuY2hvcnNfYXJyX2xlbmd0aCA9IGFuY2hvcnNfYXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKCBhbmNob3JzX2Fycl9sZW5ndGggPiAwICkge1xyXG5cdFx0dmFyIG9uZV9hbmNob3JfcHJvcF92YWx1ZSA9IGFuY2hvcnNfYXJyWzBdLnNwbGl0KCAnZG9fZXhwYW5kX18nICk7XHJcblx0XHRpZiAoIG9uZV9hbmNob3JfcHJvcF92YWx1ZS5sZW5ndGggPiAxICkge1xyXG5cclxuXHRcdFx0Ly8gJ3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl9tZXRhYm94J1xyXG5cdFx0XHR2YXIgc2VjdGlvbl90b19zaG93ICAgID0gb25lX2FuY2hvcl9wcm9wX3ZhbHVlWzFdO1xyXG5cdFx0XHR2YXIgc2VjdGlvbl9pZF90b19zaG93ID0gJyMnICsgc2VjdGlvbl90b19zaG93O1xyXG5cclxuXHJcblx0XHRcdC8vIC0tIFJlbW92ZSBzZWxlY3RlZCBiYWNrZ3JvdW5kIGluIGFsbCBsZWZ0ICBtZW51ICBpdGVtcyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX3ZlcnRfbmF2X2l0ZW0gJyApLnJlbW92ZUNsYXNzKCAnYWN0aXZlJyApO1xyXG5cdFx0XHQvLyBTZXQgbGVmdCBtZW51IHNlbGVjdGVkLlxyXG5cdFx0XHRqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rJyApLmFkZENsYXNzKCAnYWN0aXZlJyApO1xyXG5cdFx0XHR2YXIgc2VsZWN0ZWRfdGl0bGUgPSBqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rIGEgLndwYmNfdWlfZWxfX3ZlcnRfbmF2X3RpdGxlICcgKS50ZXh0KCk7XHJcblxyXG5cdFx0XHQvLyBFeHBhbmQgc2VjdGlvbiwgaWYgaXQgY29sYXBzZWQuXHJcblx0XHRcdGlmICggISBqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rJyApLnBhcmVudHMoICcud3BiY191aV9lbF9fbGV2ZWxfX2ZvbGRlcicgKS5oYXNDbGFzcyggJ2V4cGFuZGVkJyApICkge1xyXG5cdFx0XHRcdGpRdWVyeSggJy53cGJjX3VpX2VsX19sZXZlbF9fZm9sZGVyJyApLnJlbW92ZUNsYXNzKCAnZXhwYW5kZWQnICk7XHJcblx0XHRcdFx0alF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5wYXJlbnRzKCAnLndwYmNfdWlfZWxfX2xldmVsX19mb2xkZXInICkuYWRkQ2xhc3MoICdleHBhbmRlZCcgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0gRXhwYW5kIHNlY3Rpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdHZhciBjb250YWluZXJfdG9faGlkZV9jbGFzcyA9ICcucG9zdGJveCc7XHJcblx0XHRcdC8vIEhpZGUgc2VjdGlvbnMgJy5wb3N0Ym94JyBpbiBhZG1pbiBwYWdlIGFuZCBzaG93IHNwZWNpZmljIG9uZS5cclxuXHRcdFx0alF1ZXJ5KCAnLndwYmNfYWRtaW5fcGFnZSAnICsgY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgKS5oaWRlKCk7XHJcblx0XHRcdGpRdWVyeSggJy53cGJjX2NvbnRhaW5lcl9hbHdheXNfaGlkZV9fb25fbGVmdF9uYXZfY2xpY2snICkuaGlkZSgpO1xyXG5cdFx0XHRqUXVlcnkoIHNlY3Rpb25faWRfdG9fc2hvdyApLnNob3coKTtcclxuXHJcblx0XHRcdC8vIFNob3cgYWxsIG90aGVyIHNlY3Rpb25zLCAgaWYgcHJvdmlkZWQgaW4gVVJMOiAuLj9wYWdlPXdwYmMtc2V0dGluZ3MjZG9fZXhwYW5kX193cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfbWV0YWJveCN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfdXBncmFkZV9tZXRhYm94IC5cclxuXHRcdFx0Zm9yICggbGV0IGkgPSAxOyBpIDwgYW5jaG9yc19hcnJfbGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0alF1ZXJ5KCAnIycgKyBhbmNob3JzX2FycltpXSApLnNob3coKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBmYWxzZSApIHtcclxuXHRcdFx0XHR2YXIgdGFyZ2V0T2Zmc2V0ID0gd3BiY19zY3JvbGxfdG8oIHNlY3Rpb25faWRfdG9fc2hvdyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLSBTZXQgVmFsdWUgdG8gSW5wdXQgYWJvdXQgc2VsZWN0ZWQgTmF2IGVsZW1lbnQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAgICAgICAvLyBGaXhJbjogOS44LjYuMS5cclxuXHRcdFx0dmFyIHNlY3Rpb25faWRfdGFiID0gc2VjdGlvbl9pZF90b19zaG93LnN1YnN0cmluZyggMCwgc2VjdGlvbl9pZF90b19zaG93Lmxlbmd0aCAtIDggKSArICdfdGFiJztcclxuXHRcdFx0aWYgKCBjb250YWluZXJfdG9faGlkZV9jbGFzcyA9PSBzZWN0aW9uX2lkX3RvX3Nob3cgKSB7XHJcblx0XHRcdFx0c2VjdGlvbl9pZF90YWIgPSAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19hbGxfdGFiJ1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfbWV0YWJveCwjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3VwZ3JhZGVfbWV0YWJveCcgPT0gc2VjdGlvbl9pZF90b19zaG93ICkge1xyXG5cdFx0XHRcdHNlY3Rpb25faWRfdGFiID0gJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfdGFiJ1xyXG5cdFx0XHR9XHJcblx0XHRcdGpRdWVyeSggJyNmb3JtX3Zpc2libGVfc2VjdGlvbicgKS52YWwoIHNlY3Rpb25faWRfdGFiICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTGlrZSBibGlua2luZyBzb21lIGVsZW1lbnRzLlxyXG5cdFx0d3BiY19hZG1pbl91aV9fZG9fX2FuY2hvcl9fYW5vdGhlcl9hY3Rpb25zKCk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19pc19pbl9tb2JpbGVfc2NyZWVuX3NpemUoKSB7XHJcblx0cmV0dXJuIHdwYmNfYWRtaW5fdWlfX2lzX2luX3RoaXNfc2NyZWVuX3NpemUoIDYwNSApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19pc19pbl90aGlzX3NjcmVlbl9zaXplKHNpemUpIHtcclxuXHRyZXR1cm4gKHdpbmRvdy5zY3JlZW4ud2lkdGggPD0gc2l6ZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPcGVuIHNldHRpbmdzIHBhZ2UgIHwgIEV4cGFuZCBzZWN0aW9uICB8ICBTZWxlY3QgTWVudSBpdGVtLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fZG9fX29wZW5fdXJsX19leHBhbmRfc2VjdGlvbih1cmwsIHNlY3Rpb25faWQpIHtcclxuXHJcblx0Ly8gd2luZG93LmxvY2F0aW9uLmhyZWYgPSB1cmwgKyAnJmRvX2V4cGFuZD0nICsgc2VjdGlvbl9pZCArICcjZG9fZXhwYW5kX18nICsgc2VjdGlvbl9pZDsgLy8uXHJcblx0d2luZG93LmxvY2F0aW9uLmhyZWYgPSB1cmwgKyAnI2RvX2V4cGFuZF9fJyArIHNlY3Rpb25faWQ7XHJcblxyXG5cdGlmICggd3BiY19hZG1pbl91aV9faXNfaW5fbW9iaWxlX3NjcmVlbl9zaXplKCkgKSB7XHJcblx0XHR3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21pbigpO1xyXG5cdH1cclxuXHJcblx0d3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24oKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBDaGVjayAgZm9yIE90aGVyIGFjdGlvbnM6ICBMaWtlIGJsaW5raW5nIHNvbWUgZWxlbWVudHMgaW4gc2V0dGluZ3MgcGFnZS4gRS5nLiBEYXlzIHNlbGVjdGlvbiAgb3IgIGNoYW5nZS1vdmVyIGRheXMuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19kb19fYW5jaG9yX19hbm90aGVyX2FjdGlvbnMoKSB7XHJcblxyXG5cdHZhciBhbmNob3JzX2FyciAgICAgICAgPSB3cGJjX3VybF9nZXRfYW5jaG9yc19hcnIoKTtcclxuXHR2YXIgYW5jaG9yc19hcnJfbGVuZ3RoID0gYW5jaG9yc19hcnIubGVuZ3RoO1xyXG5cclxuXHQvLyBPdGhlciBhY3Rpb25zOiAgTGlrZSBibGlua2luZyBzb21lIGVsZW1lbnRzLlxyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGFuY2hvcnNfYXJyX2xlbmd0aDsgaSsrICkge1xyXG5cclxuXHRcdHZhciB0aGlzX2FuY2hvciA9IGFuY2hvcnNfYXJyW2ldO1xyXG5cclxuXHRcdHZhciB0aGlzX2FuY2hvcl9wcm9wX3ZhbHVlID0gdGhpc19hbmNob3Iuc3BsaXQoICdkb19vdGhlcl9hY3Rpb25zX18nICk7XHJcblxyXG5cdFx0aWYgKCB0aGlzX2FuY2hvcl9wcm9wX3ZhbHVlLmxlbmd0aCA+IDEgKSB7XHJcblxyXG5cdFx0XHR2YXIgc2VjdGlvbl9hY3Rpb24gPSB0aGlzX2FuY2hvcl9wcm9wX3ZhbHVlWzFdO1xyXG5cclxuXHRcdFx0c3dpdGNoICggc2VjdGlvbl9hY3Rpb24gKSB7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2JsaW5rX2RheV9zZWxlY3Rpb25zJzpcclxuXHRcdFx0XHRcdC8vIHdwYmNfdWlfc2V0dGluZ3NfX3BhbmVsX19jbGljayggJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfdGFiIGEnLCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl9tZXRhYm94JywgJ0RheXMgU2VsZWN0aW9uJyApOy5cclxuXHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ190eXBlX29mX2RheV9zZWxlY3Rpb25zJywgNCwgMzUwICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfc2Nyb2xsX3RvKCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3R5cGVfb2ZfZGF5X3NlbGVjdGlvbnMnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAnYmxpbmtfY2hhbmdlX292ZXJfZGF5cyc6XHJcblx0XHRcdFx0XHQvLyB3cGJjX3VpX3NldHRpbmdzX19wYW5lbF9fY2xpY2soICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX3RhYiBhJywgJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfbWV0YWJveCcsICdDaGFuZ2VvdmVyIERheXMnICk7LlxyXG5cdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3JhbmdlX3NlbGVjdGlvbl90aW1lX2lzX2FjdGl2ZScsIDQsIDM1MCApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX3Njcm9sbF90byggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19yYW5nZV9zZWxlY3Rpb25fdGltZV9pc19hY3RpdmUnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAnYmxpbmtfY2FwdGNoYSc6XHJcblx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfaXNfdXNlX2NhcHRjaGEnLCA0LCAzNTAgKTtcclxuXHRcdFx0XHRcdFx0d3BiY19zY3JvbGxfdG8oICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfaXNfdXNlX2NhcHRjaGEnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG4iLCIvKipcclxuICogQ29weSB0eHQgdG8gY2xpcGJyZCBmcm9tIFRleHQgZmllbGRzLlxyXG4gKlxyXG4gKiBAcGFyYW0gaHRtbF9lbGVtZW50X2lkICAtIGUuZy4gJ2RhdGFfZmllbGQnXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZF9mcm9tX2VsZW1lbnQoIGh0bWxfZWxlbWVudF9pZCApIHtcclxuXHQvLyBHZXQgdGhlIHRleHQgZmllbGQuXHJcblx0dmFyIGNvcHlUZXh0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGh0bWxfZWxlbWVudF9pZCApO1xyXG5cclxuXHQvLyBTZWxlY3QgdGhlIHRleHQgZmllbGQuXHJcblx0Y29weVRleHQuc2VsZWN0KCk7XHJcblx0Y29weVRleHQuc2V0U2VsZWN0aW9uUmFuZ2UoIDAsIDk5OTk5ICk7IC8vIEZvciBtb2JpbGUgZGV2aWNlcy5cclxuXHJcblx0Ly8gQ29weSB0aGUgdGV4dCBpbnNpZGUgdGhlIHRleHQgZmllbGQuXHJcblx0dmFyIGlzX2NvcGllZCA9IHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmQoIGNvcHlUZXh0LnZhbHVlICk7XHJcblx0aWYgKCAhIGlzX2NvcGllZCApIHtcclxuXHRcdGNvbnNvbGUuZXJyb3IoICdPb3BzLCB1bmFibGUgdG8gY29weScsIGNvcHlUZXh0LnZhbHVlICk7XHJcblx0fVxyXG5cdHJldHVybiBpc19jb3BpZWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkLlxyXG4gKlxyXG4gKiBAcGFyYW0gdGV4dFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmQodGV4dCkge1xyXG5cclxuXHRpZiAoICEgbmF2aWdhdG9yLmNsaXBib2FyZCApIHtcclxuXHRcdHJldHVybiB3cGJjX2ZhbGxiYWNrX2NvcHlfdGV4dF90b19jbGlwYnJkKCB0ZXh0ICk7XHJcblx0fVxyXG5cclxuXHRuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCggdGV4dCApLnRoZW4oXHJcblx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUubG9nKCAnQXN5bmM6IENvcHlpbmcgdG8gY2xpcGJvYXJkIHdhcyBzdWNjZXNzZnVsIScgKTsuXHJcblx0XHRcdHJldHVybiAgdHJ1ZTtcclxuXHRcdH0sXHJcblx0XHRmdW5jdGlvbiAoZXJyKSB7XHJcblx0XHRcdC8vIGNvbnNvbGUuZXJyb3IoICdBc3luYzogQ291bGQgbm90IGNvcHkgdGV4dDogJywgZXJyICk7LlxyXG5cdFx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdFx0fVxyXG5cdCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb3B5IHR4dCB0byBjbGlwYnJkIC0gZGVwcmljYXRlZCBtZXRob2QuXHJcbiAqXHJcbiAqIEBwYXJhbSB0ZXh0XHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19mYWxsYmFja19jb3B5X3RleHRfdG9fY2xpcGJyZCggdGV4dCApIHtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyB2YXIgdGV4dEFyZWEgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIFwidGV4dGFyZWFcIiApO1xyXG5cdC8vIHRleHRBcmVhLnZhbHVlID0gdGV4dDtcclxuXHQvL1xyXG5cdC8vIC8vIEF2b2lkIHNjcm9sbGluZyB0byBib3R0b20uXHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUudG9wICAgICAgPSBcIjBcIjtcclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS5sZWZ0ICAgICA9IFwiMFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnBvc2l0aW9uID0gXCJmaXhlZFwiO1xyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnpJbmRleCAgID0gXCI5OTk5OTk5OTlcIjtcclxuXHQvLyBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKCB0ZXh0QXJlYSApO1xyXG5cdC8vIHRleHRBcmVhLmZvY3VzKCk7XHJcblx0Ly8gdGV4dEFyZWEuc2VsZWN0KCk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTm93IGdldCBpdCBhcyBIVE1MICAob3JpZ2luYWwgaGVyZSBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zNDE5MTc4MC9qYXZhc2NyaXB0LWNvcHktc3RyaW5nLXRvLWNsaXBib2FyZC1hcy10ZXh0LWh0bWwgKS5cclxuXHJcblx0Ly8gWzFdIC0gQ3JlYXRlIGNvbnRhaW5lciBmb3IgdGhlIEhUTUwuXHJcblx0dmFyIGNvbnRhaW5lciAgICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0Y29udGFpbmVyLmlubmVySFRNTCA9IHRleHQ7XHJcblxyXG5cdC8vIFsyXSAtIEhpZGUgZWxlbWVudC5cclxuXHRjb250YWluZXIuc3R5bGUucG9zaXRpb24gICAgICA9ICdmaXhlZCc7XHJcblx0Y29udGFpbmVyLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XHJcblx0Y29udGFpbmVyLnN0eWxlLm9wYWNpdHkgICAgICAgPSAwO1xyXG5cclxuXHQvLyBEZXRlY3QgYWxsIHN0eWxlIHNoZWV0cyBvZiB0aGUgcGFnZS5cclxuXHR2YXIgYWN0aXZlU2hlZXRzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoIGRvY3VtZW50LnN0eWxlU2hlZXRzICkuZmlsdGVyKFxyXG5cdFx0ZnVuY3Rpb24gKHNoZWV0KSB7XHJcblx0XHRcdHJldHVybiAhIHNoZWV0LmRpc2FibGVkO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cdC8vIFszXSAtIE1vdW50IHRoZSBjb250YWluZXIgdG8gdGhlIERPTSB0byBtYWtlIGBjb250ZW50V2luZG93YCBhdmFpbGFibGUuXHJcblx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggY29udGFpbmVyICk7XHJcblxyXG5cdC8vIFs0XSAtIENvcHkgdG8gY2xpcGJvYXJkLlxyXG5cdHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKTtcclxuXHJcblx0dmFyIHJhbmdlID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcclxuXHRyYW5nZS5zZWxlY3ROb2RlKCBjb250YWluZXIgKTtcclxuXHR3aW5kb3cuZ2V0U2VsZWN0aW9uKCkuYWRkUmFuZ2UoIHJhbmdlICk7XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0dmFyIHJlc3VsdCA9IGZhbHNlO1xyXG5cclxuXHR0cnkge1xyXG5cdFx0cmVzdWx0ID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQoICdjb3B5JyApO1xyXG5cdFx0Ly8gY29uc29sZS5sb2coICdGYWxsYmFjazogQ29weWluZyB0ZXh0IGNvbW1hbmQgd2FzICcgKyBtc2cgKTsgLy8uXHJcblx0fSBjYXRjaCAoIGVyciApIHtcclxuXHRcdC8vIGNvbnNvbGUuZXJyb3IoICdGYWxsYmFjazogT29wcywgdW5hYmxlIHRvIGNvcHknLCBlcnIgKTsgLy8uXHJcblx0fVxyXG5cdC8vIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoIHRleHRBcmVhICk7IC8vLlxyXG5cclxuXHQvLyBbNS40XSAtIEVuYWJsZSBDU1MuXHJcblx0dmFyIGFjdGl2ZVNoZWV0c19sZW5ndGggPSBhY3RpdmVTaGVldHMubGVuZ3RoO1xyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGFjdGl2ZVNoZWV0c19sZW5ndGg7IGkrKyApIHtcclxuXHRcdGFjdGl2ZVNoZWV0c1tpXS5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gWzZdIC0gUmVtb3ZlIHRoZSBjb250YWluZXJcclxuXHRkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKCBjb250YWluZXIgKTtcclxuXHJcblx0cmV0dXJuICByZXN1bHQ7XHJcbn0iLCIvKipcclxuICogV1BCQyBDb2xsYXBzaWJsZSBHcm91cHNcclxuICpcclxuICogVW5pdmVyc2FsLCBkZXBlbmRlbmN5LWZyZWUgY29udHJvbGxlciBmb3IgZXhwYW5kaW5nL2NvbGxhcHNpbmcgZ3JvdXBlZCBzZWN0aW9ucyBpbiByaWdodC1zaWRlIHBhbmVscyAoSW5zcGVjdG9yL0xpYnJhcnkvRm9ybSBTZXR0aW5ncywgb3IgYW55IG90aGVyIFdQQkMgcGFnZSkuXHJcbiAqXHJcbiAqIFx0XHQ9PT0gSG93IHRvIHVzZSBpdCAocXVpY2spID8gPT09XHJcbiAqXHJcbiAqXHRcdC0tIDEuIE1hcmt1cCAoaW5kZXBlbmRlbnQgbW9kZTogbXVsdGlwbGUgb3BlbiBhbGxvd2VkKSAtLVxyXG4gKlx0XHRcdDxkaXYgY2xhc3M9XCJ3cGJjX2NvbGxhcHNpYmxlXCI+XHJcbiAqXHRcdFx0ICA8c2VjdGlvbiBjbGFzcz1cIndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwIGlzLW9wZW5cIj5cclxuICpcdFx0XHRcdDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZ3JvdXBfX2hlYWRlclwiPjxoMz5HZW5lcmFsPC9oMz48L2J1dHRvbj5cclxuICpcdFx0XHRcdDxkaXYgY2xhc3M9XCJncm91cF9fZmllbGRzXCI+4oCmPC9kaXY+XHJcbiAqXHRcdFx0ICA8L3NlY3Rpb24+XHJcbiAqXHRcdFx0ICA8c2VjdGlvbiBjbGFzcz1cIndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwXCI+XHJcbiAqXHRcdFx0XHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImdyb3VwX19oZWFkZXJcIj48aDM+QWR2YW5jZWQ8L2gzPjwvYnV0dG9uPlxyXG4gKlx0XHRcdFx0PGRpdiBjbGFzcz1cImdyb3VwX19maWVsZHNcIj7igKY8L2Rpdj5cclxuICpcdFx0XHQgIDwvc2VjdGlvbj5cclxuICpcdFx0XHQ8L2Rpdj5cclxuICpcclxuICpcdFx0LS0gMi4gRXhjbHVzaXZlL2FjY29yZGlvbiBtb2RlIChvbmUgb3BlbiBhdCBhIHRpbWUpIC0tXHJcbiAqXHRcdFx0PGRpdiBjbGFzcz1cIndwYmNfY29sbGFwc2libGUgd3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlXCI+4oCmPC9kaXY+XHJcbiAqXHJcbiAqXHRcdC0tIDMuIEF1dG8taW5pdCAtLVxyXG4gKlx0XHRcdFRoZSBzY3JpcHQgYXV0by1pbml0aWFsaXplcyBvbiBET01Db250ZW50TG9hZGVkLiBObyBleHRyYSBjb2RlIG5lZWRlZC5cclxuICpcclxuICpcdFx0LS0gNC4gUHJvZ3JhbW1hdGljIGNvbnRyb2wgKG9wdGlvbmFsKVxyXG4gKlx0XHRcdGNvbnN0IHJvb3QgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjd3BiY19iZmJfX2luc3BlY3RvcicpO1xyXG4gKlx0XHRcdGNvbnN0IGFwaSAgPSByb290Ll9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZTsgLy8gc2V0IGJ5IGF1dG8taW5pdFxyXG4gKlxyXG4gKlx0XHRcdGFwaS5vcGVuX2J5X2hlYWRpbmcoJ1ZhbGlkYXRpb24nKTsgLy8gb3BlbiBieSBoZWFkaW5nIHRleHRcclxuICpcdFx0XHRhcGkub3Blbl9ieV9pbmRleCgwKTsgICAgICAgICAgICAgIC8vIG9wZW4gdGhlIGZpcnN0IGdyb3VwXHJcbiAqXHJcbiAqXHRcdC0tIDUuTGlzdGVuIHRvIGV2ZW50cyAoZS5nLiwgdG8gcGVyc2lzdCDigJxvcGVuIGdyb3Vw4oCdIHN0YXRlKSAtLVxyXG4gKlx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpjb2xsYXBzaWJsZTpvcGVuJywgIChlKSA9PiB7IGNvbnNvbGUubG9nKCAgZS5kZXRhaWwuZ3JvdXAgKTsgfSk7XHJcbiAqXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmNvbGxhcHNpYmxlOmNsb3NlJywgKGUpID0+IHsgY29uc29sZS5sb2coICBlLmRldGFpbC5ncm91cCApOyB9KTtcclxuICpcclxuICpcclxuICpcclxuICogTWFya3VwIGV4cGVjdGF0aW9ucyAobWluaW1hbCk6XHJcbiAqICA8ZGl2IGNsYXNzPVwid3BiY19jb2xsYXBzaWJsZSBbd3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlXVwiPlxyXG4gKiAgICA8c2VjdGlvbiBjbGFzcz1cIndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwIFtpcy1vcGVuXVwiPlxyXG4gKiAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiZ3JvdXBfX2hlYWRlclwiPiAuLi4gPC9idXR0b24+XHJcbiAqICAgICAgPGRpdiBjbGFzcz1cImdyb3VwX19maWVsZHNcIj4gLi4uIDwvZGl2PlxyXG4gKiAgICA8L3NlY3Rpb24+XHJcbiAqICAgIC4uLiBtb3JlIDxzZWN0aW9uPiAuLi5cclxuICogIDwvZGl2PlxyXG4gKlxyXG4gKiBOb3RlczpcclxuICogIC0gQWRkIGBpcy1vcGVuYCB0byBhbnkgc2VjdGlvbiB5b3Ugd2FudCBpbml0aWFsbHkgZXhwYW5kZWQuXHJcbiAqICAtIEFkZCBgd3BiY19jb2xsYXBzaWJsZS0tZXhjbHVzaXZlYCB0byB0aGUgY29udGFpbmVyIGZvciBcIm9wZW4gb25lIGF0IGEgdGltZVwiIGJlaGF2aW9yLlxyXG4gKiAgLSBXb3JrcyB3aXRoIHlvdXIgZXhpc3RpbmcgQkZCIG1hcmt1cCAoY2xhc3NlcyB1c2VkIHRoZXJlIGFyZSB0aGUgZGVmYXVsdHMpLlxyXG4gKlxyXG4gKiBBY2Nlc3NpYmlsaXR5OlxyXG4gKiAgLSBTZXRzIGFyaWEtZXhwYW5kZWQgb24gLmdyb3VwX19oZWFkZXJcclxuICogIC0gU2V0cyBhcmlhLWhpZGRlbiArIFtoaWRkZW5dIG9uIC5ncm91cF9fZmllbGRzXHJcbiAqICAtIEFycm93VXAvQXJyb3dEb3duIG1vdmUgZm9jdXMgYmV0d2VlbiBoZWFkZXJzOyBFbnRlci9TcGFjZSB0b2dnbGVzXHJcbiAqXHJcbiAqIEV2ZW50cyAoYnViYmxlcyBmcm9tIHRoZSA8c2VjdGlvbj4pOlxyXG4gKiAgLSAnd3BiYzpjb2xsYXBzaWJsZTpvcGVuJyAgKGRldGFpbDogeyBncm91cCwgcm9vdCwgaW5zdGFuY2UgfSlcclxuICogIC0gJ3dwYmM6Y29sbGFwc2libGU6Y2xvc2UnIChkZXRhaWw6IHsgZ3JvdXAsIHJvb3QsIGluc3RhbmNlIH0pXHJcbiAqXHJcbiAqIFB1YmxpYyBBUEkgKGluc3RhbmNlIG1ldGhvZHMpOlxyXG4gKiAgLSBpbml0KCksIGRlc3Ryb3koKSwgcmVmcmVzaCgpXHJcbiAqICAtIGV4cGFuZChncm91cCwgW2V4Y2x1c2l2ZV0pLCBjb2xsYXBzZShncm91cCksIHRvZ2dsZShncm91cClcclxuICogIC0gb3Blbl9ieV9pbmRleChpbmRleCksIG9wZW5fYnlfaGVhZGluZyh0ZXh0KVxyXG4gKiAgLSBpc19leGNsdXNpdmUoKSwgaXNfb3Blbihncm91cClcclxuICpcclxuICogQHZlcnNpb24gMjAyNS0wOC0yNlxyXG4gKiBAc2luY2UgMjAyNS0wOC0yNlxyXG4gKi9cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vID09IEZpbGUgIC9jb2xsYXBzaWJsZV9ncm91cHMuanMgPT0gVGltZSBwb2ludDogMjAyNS0wOC0yNiAxNDoxM1xyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjbGFzcyBXUEJDX0NvbGxhcHNpYmxlX0dyb3VwcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDcmVhdGUgYSBjb2xsYXBzaWJsZSBjb250cm9sbGVyIGZvciBhIGNvbnRhaW5lci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fHN0cmluZ30gcm9vdF9lbFxyXG5cdFx0ICogICAgICAgIFRoZSBjb250YWluZXIgZWxlbWVudCAob3IgQ1NTIHNlbGVjdG9yKSB0aGF0IHdyYXBzIGNvbGxhcHNpYmxlIGdyb3Vwcy5cclxuXHRcdCAqICAgICAgICBUaGUgY29udGFpbmVyIHVzdWFsbHkgaGFzIHRoZSBjbGFzcyBgLndwYmNfY29sbGFwc2libGVgLlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzPXt9XVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBbb3B0cy5ncm91cF9zZWxlY3Rvcj0nLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwJ11cclxuXHRcdCAqICAgICAgICBTZWxlY3RvciBmb3IgZWFjaCBjb2xsYXBzaWJsZSBncm91cCBpbnNpZGUgdGhlIGNvbnRhaW5lci5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdHMuaGVhZGVyX3NlbGVjdG9yPScuZ3JvdXBfX2hlYWRlciddXHJcblx0XHQgKiAgICAgICAgU2VsZWN0b3IgZm9yIHRoZSBjbGlja2FibGUgaGVhZGVyIGluc2lkZSBhIGdyb3VwLlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBbb3B0cy5maWVsZHNfc2VsZWN0b3I9Jy5ncm91cF9fZmllbGRzJ11cclxuXHRcdCAqICAgICAgICBTZWxlY3RvciBmb3IgdGhlIGNvbnRlbnQvcGFuZWwgZWxlbWVudCBpbnNpZGUgYSBncm91cC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdHMub3Blbl9jbGFzcz0naXMtb3BlbiddXHJcblx0XHQgKiAgICAgICAgQ2xhc3MgbmFtZSB0aGF0IGluZGljYXRlcyB0aGUgZ3JvdXAgaXMgb3Blbi5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuZXhjbHVzaXZlPWZhbHNlXVxyXG5cdFx0ICogICAgICAgIElmIHRydWUsIG9ubHkgb25lIGdyb3VwIGNhbiBiZSBvcGVuIGF0IGEgdGltZSBpbiB0aGlzIGNvbnRhaW5lci5cclxuXHRcdCAqXHJcblx0XHQgKiBAY29uc3RydWN0b3JcclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGNvbnN0cnVjdG9yKHJvb3RfZWwsIG9wdHMgPSB7fSkge1xyXG5cdFx0XHR0aGlzLnJvb3QgPSAodHlwZW9mIHJvb3RfZWwgPT09ICdzdHJpbmcnKSA/IGQucXVlcnlTZWxlY3Rvciggcm9vdF9lbCApIDogcm9vdF9lbDtcclxuXHRcdFx0dGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbigge1xyXG5cdFx0XHRcdGdyb3VwX3NlbGVjdG9yIDogJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcsXHJcblx0XHRcdFx0aGVhZGVyX3NlbGVjdG9yOiAnLmdyb3VwX19oZWFkZXInLFxyXG5cdFx0XHRcdGZpZWxkc19zZWxlY3RvcjogJy5ncm91cF9fZmllbGRzLC5ncm91cF9fY29udGVudCcsXHJcblx0XHRcdFx0b3Blbl9jbGFzcyAgICAgOiAnaXMtb3BlbicsXHJcblx0XHRcdFx0ZXhjbHVzaXZlICAgICAgOiBmYWxzZVxyXG5cdFx0XHR9LCBvcHRzICk7XHJcblxyXG5cdFx0XHQvLyBCb3VuZCBoYW5kbGVycyAoZm9yIGFkZC9yZW1vdmVFdmVudExpc3RlbmVyIHN5bW1ldHJ5KS5cclxuXHRcdFx0LyoqIEBwcml2YXRlICovXHJcblx0XHRcdHRoaXMuX29uX2NsaWNrID0gdGhpcy5fb25fY2xpY2suYmluZCggdGhpcyApO1xyXG5cdFx0XHQvKiogQHByaXZhdGUgKi9cclxuXHRcdFx0dGhpcy5fb25fa2V5ZG93biA9IHRoaXMuX29uX2tleWRvd24uYmluZCggdGhpcyApO1xyXG5cclxuXHRcdFx0LyoqIEB0eXBlIHtIVE1MRWxlbWVudFtdfSBAcHJpdmF0ZSAqL1xyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBbXTtcclxuXHRcdFx0LyoqIEB0eXBlIHtNdXRhdGlvbk9ic2VydmVyfG51bGx9IEBwcml2YXRlICovXHJcblx0XHRcdHRoaXMuX29ic2VydmVyID0gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEluaXRpYWxpemUgdGhlIGNvbnRyb2xsZXI6IGNhY2hlIGdyb3VwcywgYXR0YWNoIGxpc3RlbmVycywgc2V0IEFSSUEsXHJcblx0XHQgKiBhbmQgc3RhcnQgb2JzZXJ2aW5nIERPTSBjaGFuZ2VzIGluc2lkZSB0aGUgY29udGFpbmVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHtXUEJDX0NvbGxhcHNpYmxlX0dyb3Vwc30gVGhlIGluc3RhbmNlIChjaGFpbmFibGUpLlxyXG5cdFx0ICogQGxpc3RlbnMgY2xpY2tcclxuXHRcdCAqIEBsaXN0ZW5zIGtleWRvd25cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdGlmICggIXRoaXMucm9vdCApIHtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChcclxuXHRcdFx0XHR0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yIClcclxuXHRcdFx0KTtcclxuXHRcdFx0dGhpcy5yb290LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHRoaXMuX29uX2NsaWNrLCBmYWxzZSApO1xyXG5cdFx0XHR0aGlzLnJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCB0aGlzLl9vbl9rZXlkb3duLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0Ly8gT2JzZXJ2ZSBkeW5hbWljIGluc2VydHMvcmVtb3ZhbHMgKEluc3BlY3RvciByZS1yZW5kZXJzKS5cclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHRoaXMuX29ic2VydmVyLm9ic2VydmUoIHRoaXMucm9vdCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xyXG5cclxuXHRcdFx0dGhpcy5fc3luY19hbGxfYXJpYSgpO1xyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRlYXIgZG93biB0aGUgY29udHJvbGxlcjogZGV0YWNoIGxpc3RlbmVycywgc3RvcCB0aGUgb2JzZXJ2ZXIsXHJcblx0XHQgKiBhbmQgZHJvcCBpbnRlcm5hbCByZWZlcmVuY2VzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5yb290ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnJvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fY2xpY2ssIGZhbHNlICk7XHJcblx0XHRcdHRoaXMucm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleWRvd24sIGZhbHNlICk7XHJcblx0XHRcdGlmICggdGhpcy5fb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdHRoaXMuX29ic2VydmVyID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBbXTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlLXNjYW4gdGhlIERPTSBmb3IgY3VycmVudCBncm91cHMgYW5kIHJlLWFwcGx5IEFSSUEgdG8gYWxsIG9mIHRoZW0uXHJcblx0XHQgKiBVc2VmdWwgYWZ0ZXIgZHluYW1pYyAocmUpcmVuZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdHJlZnJlc2goKSB7XHJcblx0XHRcdGlmICggIXRoaXMucm9vdCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fZ3JvdXBzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoXHJcblx0XHRcdFx0dGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApXHJcblx0XHRcdCk7XHJcblx0XHRcdHRoaXMuX3N5bmNfYWxsX2FyaWEoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIHdoZXRoZXIgdGhlIGNvbnRhaW5lciBpcyBpbiBleGNsdXNpdmUgKGFjY29yZGlvbikgbW9kZS5cclxuXHRcdCAqXHJcblx0XHQgKiBPcmRlciBvZiBwcmVjZWRlbmNlOlxyXG5cdFx0ICogIDEpIEV4cGxpY2l0IG9wdGlvbiBgb3B0cy5leGNsdXNpdmVgXHJcblx0XHQgKiAgMikgQ29udGFpbmVyIGhhcyBjbGFzcyBgLndwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZWBcclxuXHRcdCAqICAzKSBDb250YWluZXIgbWF0Y2hlcyBgW2RhdGEtd3BiYy1hY2NvcmRpb249XCJleGNsdXNpdmVcIl1gXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgZXhjbHVzaXZlIG1vZGUgaXMgYWN0aXZlLlxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0aXNfZXhjbHVzaXZlKCkge1xyXG5cdFx0XHRyZXR1cm4gISEoXHJcblx0XHRcdFx0dGhpcy5vcHRzLmV4Y2x1c2l2ZSB8fFxyXG5cdFx0XHRcdHRoaXMucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2NvbGxhcHNpYmxlLS1leGNsdXNpdmUnICkgfHxcclxuXHRcdFx0XHR0aGlzLnJvb3QubWF0Y2hlcyggJ1tkYXRhLXdwYmMtYWNjb3JkaW9uPVwiZXhjbHVzaXZlXCJdJyApXHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciBhIHNwZWNpZmljIGdyb3VwIGlzIG9wZW4uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gdGVzdC5cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBncm91cCBpcyBjdXJyZW50bHkgb3Blbi5cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGlzX29wZW4oZ3JvdXApIHtcclxuXHRcdFx0cmV0dXJuIGdyb3VwLmNsYXNzTGlzdC5jb250YWlucyggdGhpcy5vcHRzLm9wZW5fY2xhc3MgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gYSBncm91cC4gSG9ub3JzIGV4Y2x1c2l2ZSBtb2RlIGJ5IGNvbGxhcHNpbmcgYWxsIHNpYmxpbmcgZ3JvdXBzXHJcblx0XHQgKiAocXVlcmllZCBmcm9tIHRoZSBsaXZlIERPTSBhdCBjYWxsLXRpbWUpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIG9wZW4uXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtleGNsdXNpdmVdXHJcblx0XHQgKiAgICAgICAgSWYgcHJvdmlkZWQsIG92ZXJyaWRlcyBjb250YWluZXIgbW9kZSBmb3IgdGhpcyBhY3Rpb24gb25seS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6b3BlblxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0ZXhwYW5kKGdyb3VwLCBleGNsdXNpdmUpIHtcclxuXHRcdFx0aWYgKCAhZ3JvdXAgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGRvX2V4Y2x1c2l2ZSA9ICh0eXBlb2YgZXhjbHVzaXZlID09PSAnYm9vbGVhbicpID8gZXhjbHVzaXZlIDogdGhpcy5pc19leGNsdXNpdmUoKTtcclxuXHRcdFx0aWYgKCBkb19leGNsdXNpdmUgKSB7XHJcblx0XHRcdFx0Ly8gQWx3YXlzIHVzZSB0aGUgbGl2ZSBET00sIG5vdCB0aGUgY2FjaGVkIGxpc3QuXHJcblx0XHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChcclxuXHRcdFx0XHRcdHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IgKSxcclxuXHRcdFx0XHRcdChnKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmICggZyAhPT0gZ3JvdXAgKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5fc2V0X29wZW4oIGcsIGZhbHNlICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX3NldF9vcGVuKCBncm91cCwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2xvc2UgYSBncm91cC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBncm91cCBUaGUgZ3JvdXAgZWxlbWVudCB0byBjbG9zZS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6Y2xvc2VcclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGNvbGxhcHNlKGdyb3VwKSB7XHJcblx0XHRcdGlmICggIWdyb3VwICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9zZXRfb3BlbiggZ3JvdXAsIGZhbHNlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUb2dnbGUgYSBncm91cCdzIG9wZW4vY2xvc2VkIHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIHRvZ2dsZS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0dG9nZ2xlKGdyb3VwKSB7XHJcblx0XHRcdGlmICggIWdyb3VwICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzW3RoaXMuaXNfb3BlbiggZ3JvdXAgKSA/ICdjb2xsYXBzZScgOiAnZXhwYW5kJ10oIGdyb3VwICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIGEgZ3JvdXAgYnkgaXRzIGluZGV4IHdpdGhpbiB0aGUgY29udGFpbmVyICgwLWJhc2VkKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggWmVyby1iYXNlZCBpbmRleCBvZiB0aGUgZ3JvdXAuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdG9wZW5fYnlfaW5kZXgoaW5kZXgpIHtcclxuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLl9ncm91cHNbaW5kZXhdO1xyXG5cdFx0XHRpZiAoIGdyb3VwICkge1xyXG5cdFx0XHRcdHRoaXMuZXhwYW5kKCBncm91cCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIGEgZ3JvdXAgYnkgbWF0Y2hpbmcgdGV4dCBjb250YWluZWQgd2l0aGluIHRoZSA8aDM+IGluc2lkZSB0aGUgaGVhZGVyLlxyXG5cdFx0ICogVGhlIGNvbXBhcmlzb24gaXMgY2FzZS1pbnNlbnNpdGl2ZSBhbmQgc3Vic3RyaW5nLWJhc2VkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IFRleHQgdG8gbWF0Y2ggYWdhaW5zdCB0aGUgaGVhZGluZyBjb250ZW50cy5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9ieV9oZWFkaW5nKHRleHQpIHtcclxuXHRcdFx0aWYgKCAhdGV4dCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgdCAgICAgPSBTdHJpbmcoIHRleHQgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRjb25zdCBtYXRjaCA9IHRoaXMuX2dyb3Vwcy5maW5kKCAoZykgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGggPSBnLnF1ZXJ5U2VsZWN0b3IoIHRoaXMub3B0cy5oZWFkZXJfc2VsZWN0b3IgKyAnIGgzJyApO1xyXG5cdFx0XHRcdHJldHVybiBoICYmIGgudGV4dENvbnRlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCB0ICkgIT09IC0xO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGlmICggbWF0Y2ggKSB7XHJcblx0XHRcdFx0dGhpcy5leHBhbmQoIG1hdGNoICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBJbnRlcm5hbFxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGVsZWdhdGVkIGNsaWNrIGhhbmRsZXIgZm9yIGhlYWRlcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXYgVGhlIGNsaWNrIGV2ZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRfb25fY2xpY2soZXYpIHtcclxuXHRcdFx0Y29uc3QgYnRuID0gZXYudGFyZ2V0LmNsb3Nlc3QoIHRoaXMub3B0cy5oZWFkZXJfc2VsZWN0b3IgKTtcclxuXHRcdFx0aWYgKCAhYnRuIHx8ICF0aGlzLnJvb3QuY29udGFpbnMoIGJ0biApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRldi5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0Y29uc3QgZ3JvdXAgPSBidG4uY2xvc2VzdCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yICk7XHJcblx0XHRcdGlmICggZ3JvdXAgKSB7XHJcblx0XHRcdFx0dGhpcy50b2dnbGUoIGdyb3VwICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEtleWJvYXJkIGhhbmRsZXIgZm9yIGhlYWRlciBpbnRlcmFjdGlvbnMgYW5kIHJvdmluZyBmb2N1czpcclxuXHRcdCAqICAtIEVudGVyL1NwYWNlIHRvZ2dsZXMgdGhlIGFjdGl2ZSBncm91cC5cclxuXHRcdCAqICAtIEFycm93VXAvQXJyb3dEb3duIG1vdmVzIGZvY3VzIGJldHdlZW4gZ3JvdXAgaGVhZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldiBUaGUga2V5Ym9hcmQgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9vbl9rZXlkb3duKGV2KSB7XHJcblx0XHRcdGNvbnN0IGJ0biA9IGV2LnRhcmdldC5jbG9zZXN0KCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yICk7XHJcblx0XHRcdGlmICggIWJ0biApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGtleSA9IGV2LmtleTtcclxuXHJcblx0XHRcdC8vIFRvZ2dsZSBvbiBFbnRlciAvIFNwYWNlLlxyXG5cdFx0XHRpZiAoIGtleSA9PT0gJ0VudGVyJyB8fCBrZXkgPT09ICcgJyApIHtcclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGNvbnN0IGdyb3VwID0gYnRuLmNsb3Nlc3QoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApO1xyXG5cdFx0XHRcdGlmICggZ3JvdXAgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnRvZ2dsZSggZ3JvdXAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBNb3ZlIGZvY3VzIHdpdGggQXJyb3dVcC9BcnJvd0Rvd24gYmV0d2VlbiBoZWFkZXJzIGluIHRoaXMgY29udGFpbmVyLlxyXG5cdFx0XHRpZiAoIGtleSA9PT0gJ0Fycm93VXAnIHx8IGtleSA9PT0gJ0Fycm93RG93bicgKSB7XHJcblx0XHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb25zdCBoZWFkZXJzID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKFxyXG5cdFx0XHRcdFx0dGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApLFxyXG5cdFx0XHRcdFx0KGcpID0+IGcucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApXHJcblx0XHRcdFx0KS5maWx0ZXIoIEJvb2xlYW4gKTtcclxuXHRcdFx0XHRjb25zdCBpZHggICAgID0gaGVhZGVycy5pbmRleE9mKCBidG4gKTtcclxuXHRcdFx0XHRpZiAoIGlkeCAhPT0gLTEgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBuZXh0X2lkeCA9IChrZXkgPT09ICdBcnJvd0Rvd24nKVxyXG5cdFx0XHRcdFx0XHQ/IE1hdGgubWluKCBoZWFkZXJzLmxlbmd0aCAtIDEsIGlkeCArIDEgKVxyXG5cdFx0XHRcdFx0XHQ6IE1hdGgubWF4KCAwLCBpZHggLSAxICk7XHJcblx0XHRcdFx0XHRoZWFkZXJzW25leHRfaWR4XS5mb2N1cygpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwbHkgQVJJQSBzeW5jaHJvbml6YXRpb24gdG8gYWxsIGtub3duIGdyb3VwcyBiYXNlZCBvbiB0aGVpciBvcGVuIHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9zeW5jX2FsbF9hcmlhKCkge1xyXG5cdFx0XHR0aGlzLl9ncm91cHMuZm9yRWFjaCggKGcpID0+IHRoaXMuX3N5bmNfZ3JvdXBfYXJpYSggZyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTeW5jIEFSSUEgYXR0cmlidXRlcyBhbmQgdmlzaWJpbGl0eSBvbiBhIHNpbmdsZSBncm91cC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gc3luYy5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X3N5bmNfZ3JvdXBfYXJpYShncm91cCkge1xyXG5cdFx0XHRjb25zdCBpc19vcGVuID0gdGhpcy5pc19vcGVuKCBncm91cCApO1xyXG5cdFx0XHRjb25zdCBoZWFkZXIgID0gZ3JvdXAucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApO1xyXG5cdFx0XHQvLyBPbmx5IGRpcmVjdCBjaGlsZHJlbiB0aGF0IG1hdGNoLlxyXG5cdFx0XHRjb25zdCBwYW5lbHMgPSBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoIGdyb3VwLmNoaWxkcmVuLCAoZWwpID0+IGVsLm1hdGNoZXMoIHRoaXMub3B0cy5maWVsZHNfc2VsZWN0b3IgKSApO1xyXG5cclxuXHRcdFx0Ly8gSGVhZGVyIEFSSUEuXHJcblx0XHRcdGlmICggaGVhZGVyICkge1xyXG5cdFx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ2J1dHRvbicgKTtcclxuXHRcdFx0XHRoZWFkZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsIGlzX29wZW4gPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblxyXG5cdFx0XHRcdGlmICggcGFuZWxzLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdC8vIEVuc3VyZSBlYWNoIHBhbmVsIGhhcyBhbiBpZDsgdGhlbiB3aXJlIGFyaWEtY29udHJvbHMgd2l0aCBzcGFjZS1zZXBhcmF0ZWQgaWRzLlxyXG5cdFx0XHRcdFx0Y29uc3QgaWRzID0gcGFuZWxzLm1hcCggKHApID0+IHtcclxuXHRcdFx0XHRcdFx0aWYgKCAhcC5pZCApIHAuaWQgPSB0aGlzLl9nZW5lcmF0ZV9pZCggJ3dwYmNfY29sbGFwc2libGVfcGFuZWwnICk7XHJcblx0XHRcdFx0XHRcdHJldHVybiBwLmlkO1xyXG5cdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0aGVhZGVyLnNldEF0dHJpYnV0ZSggJ2FyaWEtY29udHJvbHMnLCBpZHMuam9pbiggJyAnICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vICgzKSBQYW5lbHMgQVJJQSArIHZpc2liaWxpdHkuXHJcblx0XHRcdHBhbmVscy5mb3JFYWNoKCAocCkgPT4ge1xyXG5cdFx0XHRcdHAuaGlkZGVuID0gIWlzX29wZW47ICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFjdHVhbCB2aXNpYmlsaXR5LlxyXG5cdFx0XHRcdHAuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCBpc19vcGVuID8gJ2ZhbHNlJyA6ICd0cnVlJyApOyAvLyBBUklBLlxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbnRlcm5hbCBzdGF0ZSBjaGFuZ2U6IHNldCBhIGdyb3VwJ3Mgb3Blbi9jbG9zZWQgc3RhdGUsIHN5bmMgQVJJQSxcclxuXHRcdCAqIG1hbmFnZSBmb2N1cyBvbiBjb2xsYXBzZSwgYW5kIGVtaXQgYSBjdXN0b20gZXZlbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIG11dGF0ZS5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gb3BlbiBXaGV0aGVyIHRoZSBncm91cCBzaG91bGQgYmUgb3Blbi5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6b3BlblxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6Y2xvc2VcclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9zZXRfb3Blbihncm91cCwgb3Blbikge1xyXG5cdFx0XHRpZiAoICFvcGVuICYmIGdyb3VwLmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgKSB7XHJcblx0XHRcdFx0Y29uc3QgaGVhZGVyID0gZ3JvdXAucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApO1xyXG5cdFx0XHRcdGhlYWRlciAmJiBoZWFkZXIuZm9jdXMoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRncm91cC5jbGFzc0xpc3QudG9nZ2xlKCB0aGlzLm9wdHMub3Blbl9jbGFzcywgb3BlbiApO1xyXG5cdFx0XHR0aGlzLl9zeW5jX2dyb3VwX2FyaWEoIGdyb3VwICk7XHJcblx0XHRcdGNvbnN0IGV2X25hbWUgPSBvcGVuID8gJ3dwYmM6Y29sbGFwc2libGU6b3BlbicgOiAnd3BiYzpjb2xsYXBzaWJsZTpjbG9zZSc7XHJcblx0XHRcdGdyb3VwLmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggZXZfbmFtZSwge1xyXG5cdFx0XHRcdGJ1YmJsZXM6IHRydWUsXHJcblx0XHRcdFx0ZGV0YWlsIDogeyBncm91cCwgcm9vdDogdGhpcy5yb290LCBpbnN0YW5jZTogdGhpcyB9XHJcblx0XHRcdH0gKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2VuZXJhdGUgYSB1bmlxdWUgRE9NIGlkIHdpdGggdGhlIHNwZWNpZmllZCBwcmVmaXguXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmVmaXggVGhlIGlkIHByZWZpeCB0byB1c2UuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBBIHVuaXF1ZSBlbGVtZW50IGlkIG5vdCBwcmVzZW50IGluIHRoZSBkb2N1bWVudC5cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9nZW5lcmF0ZV9pZChwcmVmaXgpIHtcclxuXHRcdFx0bGV0IGkgPSAxO1xyXG5cdFx0XHRsZXQgaWQ7XHJcblx0XHRcdGRvIHtcclxuXHRcdFx0XHRpZCA9IHByZWZpeCArICdfJyArIChpKyspO1xyXG5cdFx0XHR9XHJcblx0XHRcdHdoaWxlICggZC5nZXRFbGVtZW50QnlJZCggaWQgKSApO1xyXG5cdFx0XHRyZXR1cm4gaWQ7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBdXRvLWluaXRpYWxpemUgY29sbGFwc2libGUgY29udHJvbGxlcnMgb24gdGhlIHBhZ2UuXHJcblx0ICogRmluZHMgdG9wLWxldmVsIGAud3BiY19jb2xsYXBzaWJsZWAgY29udGFpbmVycyAoaWdub3JpbmcgbmVzdGVkIG9uZXMpLFxyXG5cdCAqIGFuZCBpbnN0YW50aWF0ZXMge0BsaW5rIFdQQkNfQ29sbGFwc2libGVfR3JvdXBzfSBvbiBlYWNoLlxyXG5cdCAqXHJcblx0ICogQGZ1bmN0aW9uIFdQQkNfQ29sbGFwc2libGVfQXV0b0luaXRcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdCAqIEBleGFtcGxlXHJcblx0ICogLy8gUnVucyBhdXRvbWF0aWNhbGx5IG9uIERPTUNvbnRlbnRMb2FkZWQ7IGNhbiBhbHNvIGJlIGNhbGxlZCBtYW51YWxseTpcclxuXHQgKiBXUEJDX0NvbGxhcHNpYmxlX0F1dG9Jbml0KCk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jb2xsYXBzaWJsZV9fYXV0b19pbml0KCkge1xyXG5cdFx0dmFyIFJPT1QgID0gJy53cGJjX2NvbGxhcHNpYmxlJztcclxuXHRcdHZhciBub2RlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBkLnF1ZXJ5U2VsZWN0b3JBbGwoIFJPT1QgKSApXHJcblx0XHRcdC5maWx0ZXIoIGZ1bmN0aW9uIChuKSB7XHJcblx0XHRcdFx0cmV0dXJuICFuLnBhcmVudEVsZW1lbnQgfHwgIW4ucGFyZW50RWxlbWVudC5jbG9zZXN0KCBST09UICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRub2Rlcy5mb3JFYWNoKCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRpZiAoIG5vZGUuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR2YXIgZXhjbHVzaXZlID0gbm9kZS5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2NvbGxhcHNpYmxlLS1leGNsdXNpdmUnICkgfHwgbm9kZS5tYXRjaGVzKCAnW2RhdGEtd3BiYy1hY2NvcmRpb249XCJleGNsdXNpdmVcIl0nICk7XHJcblxyXG5cdFx0XHRub2RlLl9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZSA9IG5ldyBXUEJDX0NvbGxhcHNpYmxlX0dyb3Vwcyggbm9kZSwgeyBleGNsdXNpdmUgfSApLmluaXQoKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdC8vIEV4cG9ydCB0byBnbG9iYWwgZm9yIG1hbnVhbCBjb250cm9sIGlmIG5lZWRlZC5cclxuXHR3LldQQkNfQ29sbGFwc2libGVfR3JvdXBzICAgPSBXUEJDX0NvbGxhcHNpYmxlX0dyb3VwcztcclxuXHR3LldQQkNfQ29sbGFwc2libGVfQXV0b0luaXQgPSB3cGJjX2NvbGxhcHNpYmxlX19hdXRvX2luaXQ7XHJcblxyXG5cdC8vIERPTS1yZWFkeSBhdXRvIGluaXQuXHJcblx0aWYgKCBkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCB3cGJjX2NvbGxhcHNpYmxlX19hdXRvX2luaXQsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdwYmNfY29sbGFwc2libGVfX2F1dG9faW5pdCgpO1xyXG5cdH1cclxufSkoIHdpbmRvdywgZG9jdW1lbnQgKTtcclxuIiwiLyogZ2xvYmFscyB3aW5kb3csIGRvY3VtZW50ICovXHJcbi8qKlxyXG4gKiBXUEJDIFNsaWRlciBMZW5ndGggR3JvdXBzXHJcbiAqXHJcbiAqIFVuaXZlcnNhbCwgZGVwZW5kZW5jeS1mcmVlIGNvbnRyb2xsZXIgdGhhdCBrZWVwcyBhIFwibGVuZ3RoXCIgY29udHJvbCBpbiBzeW5jOlxyXG4gKiAgLSBudW1iZXIgaW5wdXQgIChkYXRhLXdwYmNfc2xpZGVyX2xlbl92YWx1ZSlcclxuICogIC0gdW5pdCBzZWxlY3QgICAoZGF0YS13cGJjX3NsaWRlcl9sZW5fdW5pdClcclxuICogIC0gcmFuZ2Ugc2xpZGVyICAoZGF0YS13cGJjX3NsaWRlcl9sZW5fcmFuZ2UpXHJcbiAqICAtIHdyaXRlciBpbnB1dCAgKGRhdGEtd3BiY19zbGlkZXJfbGVuX3dyaXRlcikgIFtvcHRpb25hbCBidXQgcmVjb21tZW5kZWRdXHJcbiAqXHJcbiAqIFRoZSBcIndyaXRlclwiIHN0b3JlcyB0aGUgY29tYmluZWQgdmFsdWUgbGlrZTogXCIxMDAlXCIsIFwiNDIwcHhcIiwgXCIxMi41cmVtXCIuXHJcbiAqIFdoZW4gbnVtYmVyL3VuaXQvc2xpZGVyIGNoYW5nZSAtPiB3cml0ZXIgdXBkYXRlcyBhbmQgZW1pdHMgJ2lucHV0JyAoYnViYmxlcykuXHJcbiAqIFdoZW4gd3JpdGVyIGlzIGNoYW5nZWQgZXh0ZXJuYWxseSAoYXBwbHktZnJvbS1KU09OLCBldGMpIC0+IFVJIHVwZGF0ZXMuXHJcbiAqXHJcbiAqIE1hcmt1cCBleHBlY3RhdGlvbnMgKG1pbmltYWwpOlxyXG4gKiAgPGRpdiBjbGFzcz1cIndwYmNfc2xpZGVyX2xlbl9ncm91cFwiXHJcbiAqICAgICAgIGRhdGEtd3BiY19zbGlkZXJfbGVuX2JvdW5kc19tYXA9J3tcIiVcIjp7XCJtaW5cIjozMCxcIm1heFwiOjEwMCxcInN0ZXBcIjoxfSxcInB4XCI6e1wibWluXCI6MzAwLFwibWF4XCI6MjAwMCxcInN0ZXBcIjoxMH19J1xyXG4gKiAgICAgICBkYXRhLXdwYmNfc2xpZGVyX2xlbl9kZWZhdWx0X3VuaXQ9XCIlXCI+XHJcbiAqICAgIDxpbnB1dCB0eXBlPVwibnVtYmVyXCIgZGF0YS13cGJjX3NsaWRlcl9sZW5fdmFsdWU+XHJcbiAqICAgIDxzZWxlY3QgZGF0YS13cGJjX3NsaWRlcl9sZW5fdW5pdD4uLi48L3NlbGVjdD5cclxuICogICAgPGlucHV0IHR5cGU9XCJyYW5nZVwiIGRhdGEtd3BiY19zbGlkZXJfbGVuX3JhbmdlPlxyXG4gKiAgICA8aW5wdXQgdHlwZT1cInRleHRcIiBkYXRhLXdwYmNfc2xpZGVyX2xlbl93cml0ZXIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7XCI+XHJcbiAqICA8L2Rpdj5cclxuICpcclxuICogUGVyZm9ybWFuY2Ugbm90ZXM6XHJcbiAqIC0gTXV0YXRpb25PYnNlcnZlciBpcyBESVNBQkxFRCBieSBkZWZhdWx0IChwcmV2ZW50cyBwZXJmb3JtYW5jZSBpc3N1ZXMpLlxyXG4gKiAtIElmIHlvdXIgVUkgcmUtcmVuZGVycyBhbmQgaW5zZXJ0cyBuZXcgZ3JvdXBzIGR5bmFtaWNhbGx5LCBjYWxsOlxyXG4gKiAgICAgV1BCQ19TbGlkZXJfTGVuX0F1dG9Jbml0KCk7ICBPUiBpbnN0YW5jZS5yZWZyZXNoKCk7XHJcbiAqICAgT3IgZW5hYmxlIG9ic2VydmVyIHZpYTogbmV3IFdQQkNfU2xpZGVyX0xlbl9Hcm91cHMocm9vdCwgeyBlbmFibGVfb2JzZXJ2ZXI6dHJ1ZSB9KS5pbml0KCk7XHJcbiAqXHJcbiAqIFB1YmxpYyBBUEkgKGluc3RhbmNlIG1ldGhvZHMpOlxyXG4gKiAgLSBpbml0KCksIGRlc3Ryb3koKSwgcmVmcmVzaCgpXHJcbiAqXHJcbiAqIEB2ZXJzaW9uIDIwMjYtMDEtMjVcclxuICogQHNpbmNlICAgMjAyNi0wMS0yNVxyXG4gKiBAZmlsZSAgICAuLi9pbmNsdWRlcy9fX2pzL2FkbWluL3NsaWRlcl9ncm91cHMvd3BiY19sZW5fZ3JvdXBzLmpzXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBIZWxwZXJzXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIGNsYW1wX251bSh2LCBtaW4sIG1heCkge1xyXG5cdFx0aWYgKHR5cGVvZiBtaW4gPT09ICdudW1iZXInICYmICFpc05hTihtaW4pKSB2ID0gTWF0aC5tYXgobWluLCB2KTtcclxuXHRcdGlmICh0eXBlb2YgbWF4ID09PSAnbnVtYmVyJyAmJiAhaXNOYU4obWF4KSkgdiA9IE1hdGgubWluKG1heCwgdik7XHJcblx0XHRyZXR1cm4gdjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBhcnNlX2Zsb2F0KHYpIHtcclxuXHRcdHZhciBuID0gcGFyc2VGbG9hdCh2KTtcclxuXHRcdHJldHVybiBpc05hTihuKSA/IG51bGwgOiBuO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2FmZV9qc29uX3BhcnNlKHN0cikge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0cmV0dXJuIEpTT04ucGFyc2Uoc3RyKTtcclxuXHRcdH0gY2F0Y2ggKGUpIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwYXJzZV9sZW5fY29tYmluZWQocmF3LCBkZWZhdWx0X3VuaXQpIHtcclxuXHRcdHZhciBzID0gKHJhdyA9PSBudWxsKSA/ICcnIDogU3RyaW5nKHJhdykudHJpbSgpO1xyXG5cdFx0aWYgKCFzKSByZXR1cm4geyBudW06ICcnLCB1bml0OiBkZWZhdWx0X3VuaXQgfHwgJyUnIH07XHJcblxyXG5cdFx0dmFyIG0gPSBzLm1hdGNoKC9eXFxzKihbXFwtXT9cXGQrKD86XFwuXFxkKyk/KVxccyooW2EteiVdKilcXHMqJC9pKTtcclxuXHRcdGlmICghbSkge1xyXG5cdFx0XHQvLyBJZiBpdCdzIG5vdCBwYXJzZWFibGUsIHRyZWF0IGFzIG51bWJlciBhbmQga2VlcCBkZWZhdWx0IHVuaXQuXHJcblx0XHRcdHJldHVybiB7IG51bTogcywgdW5pdDogZGVmYXVsdF91bml0IHx8ICclJyB9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBudW0gID0gbVsxXSA/IFN0cmluZyhtWzFdKSA6ICcnO1xyXG5cdFx0dmFyIHVuaXQgPSBtWzJdID8gU3RyaW5nKG1bMl0pIDogJyc7XHJcblx0XHRpZiAoIXVuaXQpIHVuaXQgPSBkZWZhdWx0X3VuaXQgfHwgJyUnO1xyXG5cclxuXHRcdHJldHVybiB7IG51bTogbnVtLCB1bml0OiB1bml0IH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBidWlsZF9jb21iaW5lZChudW0sIHVuaXQpIHtcclxuXHRcdGlmIChudW0gPT0gbnVsbCB8fCBTdHJpbmcobnVtKS50cmltKCkgPT09ICcnKSByZXR1cm4gJyc7XHJcblx0XHRyZXR1cm4gU3RyaW5nKG51bSkgKyBTdHJpbmcodW5pdCB8fCAnJyk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlbWl0X2lucHV0KGVsKSB7XHJcblx0XHRpZiAoIWVsKSByZXR1cm47XHJcblx0XHRlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIENvbnRyb2xsZXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Y2xhc3MgV1BCQ19TbGlkZXJfTGVuX0dyb3VwcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fHN0cmluZ30gcm9vdF9lbCBDb250YWluZXIgKG9yIHNlbGVjdG9yKS4gSWYgb21pdHRlZCwgdXNlcyBkb2N1bWVudC5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0cz17fV1cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3Iocm9vdF9lbCwgb3B0cykge1xyXG5cdFx0XHR0aGlzLnJvb3QgPSByb290X2VsXHJcblx0XHRcdFx0PyAoKHR5cGVvZiByb290X2VsID09PSAnc3RyaW5nJykgPyBkLnF1ZXJ5U2VsZWN0b3Iocm9vdF9lbCkgOiByb290X2VsKVxyXG5cdFx0XHRcdDogZDtcclxuXHJcblx0XHRcdHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oe1xyXG5cdFx0XHRcdC8vIFN0cmljdCBzZWxlY3RvcnMgKE5PIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkpLlxyXG5cdFx0XHRcdGdyb3VwX3NlbGVjdG9yICA6ICcud3BiY19zbGlkZXJfbGVuX2dyb3VwJyxcclxuXHRcdFx0XHR2YWx1ZV9zZWxlY3RvciAgOiAnW2RhdGEtd3BiY19zbGlkZXJfbGVuX3ZhbHVlXScsXHJcblx0XHRcdFx0dW5pdF9zZWxlY3RvciAgIDogJ1tkYXRhLXdwYmNfc2xpZGVyX2xlbl91bml0XScsXHJcblx0XHRcdFx0cmFuZ2Vfc2VsZWN0b3IgIDogJ1tkYXRhLXdwYmNfc2xpZGVyX2xlbl9yYW5nZV0nLFxyXG5cdFx0XHRcdHdyaXRlcl9zZWxlY3RvciA6ICdbZGF0YS13cGJjX3NsaWRlcl9sZW5fd3JpdGVyXScsXHJcblxyXG5cdFx0XHRcdGRlZmF1bHRfdW5pdCAgICA6ICclJyxcclxuXHJcblx0XHRcdFx0ZmFsbGJhY2tfYm91bmRzIDoge1xyXG5cdFx0XHRcdFx0J3B4JyA6IHsgbWluOiAwLCAgIG1heDogNTEyLCAgc3RlcDogMSAgIH0sXHJcblx0XHRcdFx0XHQnJScgIDogeyBtaW46IDAsICAgbWF4OiAxMDAsICBzdGVwOiAxICAgfSxcclxuXHRcdFx0XHRcdCdyZW0nOiB7IG1pbjogMCwgICBtYXg6IDEwLCAgIHN0ZXA6IDAuMSB9LFxyXG5cdFx0XHRcdFx0J2VtJyA6IHsgbWluOiAwLCAgIG1heDogMTAsICAgc3RlcDogMC4xIH1cclxuXHRcdFx0XHR9LFxyXG5cclxuXHRcdFx0XHQvLyBEaXNhYmxlZCBieSBkZWZhdWx0IGZvciBwZXJmb3JtYW5jZS5cclxuXHRcdFx0XHRlbmFibGVfb2JzZXJ2ZXIgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0b2JzZXJ2ZXJfZGVib3VuY2VfbXM6IDE1MFxyXG5cdFx0XHR9LCBvcHRzIHx8IHt9KTtcclxuXHJcblx0XHRcdHRoaXMuX29uX2lucHV0ICA9IHRoaXMuX29uX2lucHV0LmJpbmQodGhpcyk7XHJcblx0XHRcdHRoaXMuX29uX2NoYW5nZSA9IHRoaXMuX29uX2NoYW5nZS5iaW5kKHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy5fYm91bmRzX2NhY2hlID0gbmV3IFdlYWtNYXAoKTsgLy8gZ3JvdXAgLT4gYm91bmRzX21hcF9vYmplY3RcclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgICAgID0gbnVsbDtcclxuXHRcdFx0dGhpcy5fcmVmcmVzaF90bXIgID0gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHRpZiAoIXRoaXMucm9vdCkgcmV0dXJuIHRoaXM7XHJcblxyXG5cdFx0XHR0aGlzLnJvb3QuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAgdGhpcy5fb25faW5wdXQsICB0cnVlKTtcclxuXHRcdFx0dGhpcy5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuX29uX2NoYW5nZSwgdHJ1ZSk7XHJcblxyXG5cdFx0XHRpZiAodGhpcy5vcHRzLmVuYWJsZV9vYnNlcnZlciAmJiB3Lk11dGF0aW9uT2JzZXJ2ZXIpIHtcclxuXHRcdFx0XHR0aGlzLl9vYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCgpID0+IHsgdGhpcy5fZGVib3VuY2VkX3JlZnJlc2goKTsgfSk7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLnJvb3QgPT09IGQgPyBkLmRvY3VtZW50RWxlbWVudCA6IHRoaXMucm9vdCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMucmVmcmVzaCgpO1xyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHRpZiAoIXRoaXMucm9vdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dGhpcy5yb290LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2lucHV0JywgIHRoaXMuX29uX2lucHV0LCAgdHJ1ZSk7XHJcblx0XHRcdHRoaXMucm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLl9vbl9jaGFuZ2UsIHRydWUpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMuX29ic2VydmVyKSB7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdHRoaXMuX29ic2VydmVyID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHRoaXMuX3JlZnJlc2hfdG1yKSB7XHJcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRoaXMuX3JlZnJlc2hfdG1yKTtcclxuXHRcdFx0XHR0aGlzLl9yZWZyZXNoX3RtciA9IG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZWZyZXNoKCkge1xyXG5cdFx0XHRpZiAoIXRoaXMucm9vdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIHNjb3BlICA9ICh0aGlzLnJvb3QgPT09IGQgPyBkIDogdGhpcy5yb290KTtcclxuXHRcdFx0dmFyIGdyb3VwcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHNjb3BlLnF1ZXJ5U2VsZWN0b3JBbGwodGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yKSk7XHJcblxyXG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGdyb3Vwcy5sZW5ndGg7IGkrKykge1xyXG5cdFx0XHRcdHRoaXMuX3N5bmNfZ3JvdXBfZnJvbV93cml0ZXIoZ3JvdXBzW2ldKTtcclxuXHRcdFx0XHR0aGlzLl9hcHBseV9ib3VuZHNfZm9yX2N1cnJlbnRfdW5pdChncm91cHNbaV0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gSW50ZXJuYWxcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdF9kZWJvdW5jZWRfcmVmcmVzaCgpIHtcclxuXHRcdFx0aWYgKHRoaXMuX3JlZnJlc2hfdG1yKSBjbGVhclRpbWVvdXQodGhpcy5fcmVmcmVzaF90bXIpO1xyXG5cdFx0XHR0aGlzLl9yZWZyZXNoX3RtciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hfdG1yID0gbnVsbDtcclxuXHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHRcdFx0fSwgTnVtYmVyKHRoaXMub3B0cy5vYnNlcnZlcl9kZWJvdW5jZV9tcykgfHwgMCk7XHJcblx0XHR9XHJcblxyXG5cdFx0X2ZpbmRfZ3JvdXAoZWwpIHtcclxuXHRcdFx0cmV0dXJuIChlbCAmJiBlbC5jbG9zZXN0KSA/IGVsLmNsb3Nlc3QodGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yKSA6IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0X2dldF9wYXJ0cyhncm91cCkge1xyXG5cdFx0XHRpZiAoIWdyb3VwKSByZXR1cm4gbnVsbDtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRncm91cCA6IGdyb3VwLFxyXG5cdFx0XHRcdG51bSAgIDogZ3JvdXAucXVlcnlTZWxlY3Rvcih0aGlzLm9wdHMudmFsdWVfc2VsZWN0b3IpLFxyXG5cdFx0XHRcdHVuaXQgIDogZ3JvdXAucXVlcnlTZWxlY3Rvcih0aGlzLm9wdHMudW5pdF9zZWxlY3RvciksXHJcblx0XHRcdFx0cmFuZ2UgOiBncm91cC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0cy5yYW5nZV9zZWxlY3RvciksXHJcblx0XHRcdFx0d3JpdGVyOiBncm91cC5xdWVyeVNlbGVjdG9yKHRoaXMub3B0cy53cml0ZXJfc2VsZWN0b3IpXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0X2dldF9kZWZhdWx0X3VuaXQoZ3JvdXApIHtcclxuXHRcdFx0dmFyIGR1ID0gKGdyb3VwICYmIGdyb3VwLmdldEF0dHJpYnV0ZSlcclxuXHRcdFx0XHQ/IGdyb3VwLmdldEF0dHJpYnV0ZSgnZGF0YS13cGJjX3NsaWRlcl9sZW5fZGVmYXVsdF91bml0JylcclxuXHRcdFx0XHQ6ICcnO1xyXG5cdFx0XHRyZXR1cm4gZHUgPyBTdHJpbmcoZHUpIDogdGhpcy5vcHRzLmRlZmF1bHRfdW5pdDtcclxuXHRcdH1cclxuXHJcblx0XHRfZ2V0X2JvdW5kc19tYXAoZ3JvdXApIHtcclxuXHRcdFx0aWYgKCFncm91cCkgcmV0dXJuIG51bGw7XHJcblx0XHRcdGlmICh0aGlzLl9ib3VuZHNfY2FjaGUuaGFzKGdyb3VwKSkge1xyXG5cdFx0XHRcdHJldHVybiB0aGlzLl9ib3VuZHNfY2FjaGUuZ2V0KGdyb3VwKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIHJhdyA9IGdyb3VwLmdldEF0dHJpYnV0ZSgnZGF0YS13cGJjX3NsaWRlcl9sZW5fYm91bmRzX21hcCcpO1xyXG5cdFx0XHR2YXIgbWFwID0gcmF3ID8gc2FmZV9qc29uX3BhcnNlKHJhdykgOiBudWxsO1xyXG5cdFx0XHRpZiAoIW1hcCB8fCB0eXBlb2YgbWFwICE9PSAnb2JqZWN0JykgbWFwID0gbnVsbDtcclxuXHJcblx0XHRcdHRoaXMuX2JvdW5kc19jYWNoZS5zZXQoZ3JvdXAsIG1hcCk7XHJcblx0XHRcdHJldHVybiBtYXA7XHJcblx0XHR9XHJcblxyXG5cdFx0X2dldF9ib3VuZHNfZm9yX3VuaXQoZ3JvdXAsIHVuaXQpIHtcclxuXHRcdFx0dmFyIG1hcCA9IHRoaXMuX2dldF9ib3VuZHNfbWFwKGdyb3VwKTtcclxuXHRcdFx0aWYgKG1hcCAmJiB1bml0ICYmIG1hcFt1bml0XSkge1xyXG5cdFx0XHRcdHJldHVybiBtYXBbdW5pdF07XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHRoaXMub3B0cy5mYWxsYmFja19ib3VuZHNbdW5pdF0gfHwgdGhpcy5vcHRzLmZhbGxiYWNrX2JvdW5kc1sncHgnXTtcclxuXHRcdH1cclxuXHJcblx0XHRfYXBwbHlfYm91bmRzKHBhcnRzLCBib3VuZHMpIHtcclxuXHRcdFx0aWYgKCFwYXJ0cyB8fCAhYm91bmRzKSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgbWluICA9IChib3VuZHMubWluICAhPSBudWxsKSA/IE51bWJlcihib3VuZHMubWluKSAgOiBudWxsO1xyXG5cdFx0XHR2YXIgbWF4ICA9IChib3VuZHMubWF4ICAhPSBudWxsKSA/IE51bWJlcihib3VuZHMubWF4KSAgOiBudWxsO1xyXG5cdFx0XHR2YXIgc3RlcCA9IChib3VuZHMuc3RlcCAhPSBudWxsKSA/IE51bWJlcihib3VuZHMuc3RlcCkgOiBudWxsO1xyXG5cclxuXHRcdFx0aWYgKHBhcnRzLnJhbmdlKSB7XHJcblx0XHRcdFx0aWYgKCFpc05hTihtaW4pKSAgcGFydHMucmFuZ2UubWluICA9IFN0cmluZyhtaW4pO1xyXG5cdFx0XHRcdGlmICghaXNOYU4obWF4KSkgIHBhcnRzLnJhbmdlLm1heCAgPSBTdHJpbmcobWF4KTtcclxuXHRcdFx0XHRpZiAoIWlzTmFOKHN0ZXApKSBwYXJ0cy5yYW5nZS5zdGVwID0gU3RyaW5nKHN0ZXApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmIChwYXJ0cy5udW0pIHtcclxuXHRcdFx0XHRpZiAoIWlzTmFOKG1pbikpICBwYXJ0cy5udW0ubWluICA9IFN0cmluZyhtaW4pO1xyXG5cdFx0XHRcdGlmICghaXNOYU4obWF4KSkgIHBhcnRzLm51bS5tYXggID0gU3RyaW5nKG1heCk7XHJcblx0XHRcdFx0aWYgKCFpc05hTihzdGVwKSkgcGFydHMubnVtLnN0ZXAgPSBTdHJpbmcoc3RlcCk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfYXBwbHlfYm91bmRzX2Zvcl9jdXJyZW50X3VuaXQoZ3JvdXApIHtcclxuXHRcdFx0dmFyIHBhcnRzID0gdGhpcy5fZ2V0X3BhcnRzKGdyb3VwKTtcclxuXHRcdFx0aWYgKCFwYXJ0cyB8fCAhcGFydHMudW5pdCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIHVuaXQgPSBwYXJ0cy51bml0LnZhbHVlIHx8IHRoaXMuX2dldF9kZWZhdWx0X3VuaXQoZ3JvdXApO1xyXG5cdFx0XHR2YXIgYiAgICA9IHRoaXMuX2dldF9ib3VuZHNfZm9yX3VuaXQoZ3JvdXAsIHVuaXQpO1xyXG5cclxuXHRcdFx0dGhpcy5fYXBwbHlfYm91bmRzKHBhcnRzLCBiKTtcclxuXHJcblx0XHRcdC8vIENsYW1wIGN1cnJlbnQgdmFsdWUgdG8gbmV3IGJvdW5kcy5cclxuXHRcdFx0dmFyIHYgPSBwYXJzZV9mbG9hdChwYXJ0cy5udW0gJiYgcGFydHMubnVtLnZhbHVlID8gcGFydHMubnVtLnZhbHVlIDogKHBhcnRzLnJhbmdlID8gcGFydHMucmFuZ2UudmFsdWUgOiAnJykpO1xyXG5cdFx0XHRpZiAodiA9PSBudWxsKSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgbWluID0gKGIgJiYgYi5taW4gIT0gbnVsbCkgPyBOdW1iZXIoYi5taW4pIDogbnVsbDtcclxuXHRcdFx0dmFyIG1heCA9IChiICYmIGIubWF4ICE9IG51bGwpID8gTnVtYmVyKGIubWF4KSA6IG51bGw7XHJcblx0XHRcdHYgPSBjbGFtcF9udW0odiwgaXNOYU4obWluKSA/IG51bGwgOiBtaW4sIGlzTmFOKG1heCkgPyBudWxsIDogbWF4KTtcclxuXHJcblx0XHRcdGlmIChwYXJ0cy5udW0pICAgcGFydHMubnVtLnZhbHVlICAgPSBTdHJpbmcodik7XHJcblx0XHRcdGlmIChwYXJ0cy5yYW5nZSkgcGFydHMucmFuZ2UudmFsdWUgPSBTdHJpbmcodik7XHJcblxyXG5cdFx0XHR0aGlzLl93cml0ZV9jb21iaW5lZChwYXJ0cywgU3RyaW5nKHYpLCB1bml0LCAvKmVtaXQqLyBmYWxzZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0X3dyaXRlX2NvbWJpbmVkKHBhcnRzLCBudW0sIHVuaXQsIGVtaXQpIHtcclxuXHRcdFx0aWYgKCFwYXJ0cykgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIGNvbWJpbmVkID0gYnVpbGRfY29tYmluZWQobnVtLCB1bml0KTtcclxuXHJcblx0XHRcdGlmIChwYXJ0cy53cml0ZXIpIHtcclxuXHRcdFx0XHQvLyBBdm9pZCByZWN1cnNpb246IG1hcmsgYXMgaW50ZXJuYWwgd3JpdGUuXHJcblx0XHRcdFx0cGFydHMud3JpdGVyLl9fd3BiY19zbGlkZXJfbGVuX2ludGVybmFsID0gdHJ1ZTtcclxuXHRcdFx0XHRwYXJ0cy53cml0ZXIudmFsdWUgPSBjb21iaW5lZDtcclxuXHRcdFx0XHRpZiAoZW1pdCkgZW1pdF9pbnB1dChwYXJ0cy53cml0ZXIpO1xyXG5cdFx0XHRcdHBhcnRzLndyaXRlci5fX3dwYmNfc2xpZGVyX2xlbl9pbnRlcm5hbCA9IGZhbHNlO1xyXG5cdFx0XHR9IGVsc2UgaWYgKHBhcnRzLm51bSkge1xyXG5cdFx0XHRcdC8vIElmIHdyaXRlciBpcyBtaXNzaW5nLCBhdCBsZWFzdCBub3RpZnkgdmlhIG51bWJlciBpbnB1dC5cclxuXHRcdFx0XHRpZiAoZW1pdCkgZW1pdF9pbnB1dChwYXJ0cy5udW0pO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0X3N5bmNfZ3JvdXBfZnJvbV93cml0ZXIoZ3JvdXApIHtcclxuXHRcdFx0dmFyIHBhcnRzID0gdGhpcy5fZ2V0X3BhcnRzKGdyb3VwKTtcclxuXHRcdFx0aWYgKCFwYXJ0cyB8fCAhcGFydHMud3JpdGVyKSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgcmF3ID0gU3RyaW5nKHBhcnRzLndyaXRlci52YWx1ZSB8fCAnJykudHJpbSgpO1xyXG5cdFx0XHRpZiAoIXJhdykgcmV0dXJuO1xyXG5cclxuXHRcdFx0dmFyIGR1ID0gdGhpcy5fZ2V0X2RlZmF1bHRfdW5pdChncm91cCk7XHJcblx0XHRcdHZhciBwICA9IHBhcnNlX2xlbl9jb21iaW5lZChyYXcsIGR1KTtcclxuXHJcblx0XHRcdGlmIChwYXJ0cy51bml0KSAgcGFydHMudW5pdC52YWx1ZSAgPSBwLnVuaXQ7XHJcblx0XHRcdGlmIChwYXJ0cy5udW0pICAgcGFydHMubnVtLnZhbHVlICAgPSBwLm51bTtcclxuXHRcdFx0aWYgKHBhcnRzLnJhbmdlKSBwYXJ0cy5yYW5nZS52YWx1ZSA9IHAubnVtO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9vbl9pbnB1dChldikge1xyXG5cdFx0XHR2YXIgdCA9IGV2LnRhcmdldDtcclxuXHRcdFx0aWYgKCF0KSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgZ3JvdXAgPSB0aGlzLl9maW5kX2dyb3VwKHQpO1xyXG5cdFx0XHRpZiAoIWdyb3VwKSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgcGFydHMgPSB0aGlzLl9nZXRfcGFydHMoZ3JvdXApO1xyXG5cdFx0XHRpZiAoIXBhcnRzKSByZXR1cm47XHJcblxyXG5cdFx0XHQvLyBXcml0ZXIgY2hhbmdlZCBleHRlcm5hbGx5IC0+IHVwZGF0ZSBVSS5cclxuXHRcdFx0aWYgKHBhcnRzLndyaXRlciAmJiB0ID09PSBwYXJ0cy53cml0ZXIpIHtcclxuXHRcdFx0XHRpZiAodC5fX3dwYmNfc2xpZGVyX2xlbl9pbnRlcm5hbCkgcmV0dXJuO1xyXG5cdFx0XHRcdHRoaXMuX3N5bmNfZ3JvdXBfZnJvbV93cml0ZXIoZ3JvdXApO1xyXG5cdFx0XHRcdHRoaXMuX2FwcGx5X2JvdW5kc19mb3JfY3VycmVudF91bml0KGdyb3VwKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNsaWRlciBtb3ZlZCAtPiB1cGRhdGUgbnVtYmVyICsgd3JpdGVyLlxyXG5cdFx0XHRpZiAodC5tYXRjaGVzICYmIHQubWF0Y2hlcyh0aGlzLm9wdHMucmFuZ2Vfc2VsZWN0b3IpKSB7XHJcblx0XHRcdFx0aWYgKHBhcnRzLm51bSkgcGFydHMubnVtLnZhbHVlID0gdC52YWx1ZTtcclxuXHJcblx0XHRcdFx0dmFyIHVuaXQgPSAocGFydHMudW5pdCAmJiBwYXJ0cy51bml0LnZhbHVlKSA/IHBhcnRzLnVuaXQudmFsdWUgOiB0aGlzLl9nZXRfZGVmYXVsdF91bml0KGdyb3VwKTtcclxuXHRcdFx0XHR0aGlzLl93cml0ZV9jb21iaW5lZChwYXJ0cywgdC52YWx1ZSwgdW5pdCwgLyplbWl0Ki8gdHJ1ZSk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBOdW1iZXIgdHlwZWQgLT4gdXBkYXRlIHNsaWRlciArIHdyaXRlciAoY2xhbXAgaWYgc2xpZGVyIGhhcyBib3VuZHMpLlxyXG5cdFx0XHRpZiAodC5tYXRjaGVzICYmIHQubWF0Y2hlcyh0aGlzLm9wdHMudmFsdWVfc2VsZWN0b3IpKSB7XHJcblx0XHRcdFx0dmFyIHYgPSBwYXJzZV9mbG9hdCh0LnZhbHVlKTtcclxuXHJcblx0XHRcdFx0aWYgKHYgIT0gbnVsbCAmJiBwYXJ0cy5yYW5nZSkge1xyXG5cdFx0XHRcdFx0dmFyIHJtaW4gPSBOdW1iZXIocGFydHMucmFuZ2UubWluKTtcclxuXHRcdFx0XHRcdHZhciBybWF4ID0gTnVtYmVyKHBhcnRzLnJhbmdlLm1heCk7XHJcblx0XHRcdFx0XHR2ID0gY2xhbXBfbnVtKHYsIGlzTmFOKHJtaW4pID8gbnVsbCA6IHJtaW4sIGlzTmFOKHJtYXgpID8gbnVsbCA6IHJtYXgpO1xyXG5cclxuXHRcdFx0XHRcdHBhcnRzLnJhbmdlLnZhbHVlID0gU3RyaW5nKHYpO1xyXG5cdFx0XHRcdFx0aWYgKFN0cmluZyh2KSAhPT0gdC52YWx1ZSkgdC52YWx1ZSA9IFN0cmluZyh2KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciB1bml0MiA9IChwYXJ0cy51bml0ICYmIHBhcnRzLnVuaXQudmFsdWUpID8gcGFydHMudW5pdC52YWx1ZSA6IHRoaXMuX2dldF9kZWZhdWx0X3VuaXQoZ3JvdXApO1xyXG5cdFx0XHRcdHRoaXMuX3dyaXRlX2NvbWJpbmVkKHBhcnRzLCB0LnZhbHVlLCB1bml0MiwgLyplbWl0Ki8gdHJ1ZSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfb25fY2hhbmdlKGV2KSB7XHJcblx0XHRcdHZhciB0ID0gZXYudGFyZ2V0O1xyXG5cdFx0XHRpZiAoIXQpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBncm91cCA9IHRoaXMuX2ZpbmRfZ3JvdXAodCk7XHJcblx0XHRcdGlmICghZ3JvdXApIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBwYXJ0cyA9IHRoaXMuX2dldF9wYXJ0cyhncm91cCk7XHJcblx0XHRcdGlmICghcGFydHMpIHJldHVybjtcclxuXHJcblx0XHRcdC8vIFVuaXQgY2hhbmdlZCAtPiB1cGRhdGUgYm91bmRzICsgd3JpdGVyLlxyXG5cdFx0XHRpZiAodC5tYXRjaGVzICYmIHQubWF0Y2hlcyh0aGlzLm9wdHMudW5pdF9zZWxlY3RvcikpIHtcclxuXHRcdFx0XHR0aGlzLl9hcHBseV9ib3VuZHNfZm9yX2N1cnJlbnRfdW5pdChncm91cCk7XHJcblxyXG5cdFx0XHRcdHZhciBudW0gID0gcGFydHMubnVtID8gcGFydHMubnVtLnZhbHVlIDogKHBhcnRzLnJhbmdlID8gcGFydHMucmFuZ2UudmFsdWUgOiAnJyk7XHJcblx0XHRcdFx0dmFyIHVuaXQgPSB0LnZhbHVlIHx8IHRoaXMuX2dldF9kZWZhdWx0X3VuaXQoZ3JvdXApO1xyXG5cdFx0XHRcdHRoaXMuX3dyaXRlX2NvbWJpbmVkKHBhcnRzLCBudW0sIHVuaXQsIC8qZW1pdCovIHRydWUpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQXV0by1pbml0XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIHdwYmNfc2xpZGVyX2xlbl9ncm91cHNfX2F1dG9faW5pdCgpIHtcclxuXHRcdHZhciBST09UICA9ICcud3BiY19zbGlkZXJfbGVuX2dyb3Vwcyc7XHJcblx0XHR2YXIgbm9kZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkLnF1ZXJ5U2VsZWN0b3JBbGwoUk9PVCkpXHJcblx0XHRcdC5maWx0ZXIoZnVuY3Rpb24gKG4pIHsgcmV0dXJuICFuLnBhcmVudEVsZW1lbnQgfHwgIW4ucGFyZW50RWxlbWVudC5jbG9zZXN0KFJPT1QpOyB9KTtcclxuXHJcblx0XHQvLyBJZiBubyBleHBsaWNpdCBjb250YWluZXJzLCBpbnN0YWxsIGEgc2luZ2xlIGRvY3VtZW50LXJvb3QgaW5zdGFuY2UuXHJcblx0XHRpZiAoIW5vZGVzLmxlbmd0aCkge1xyXG5cdFx0XHRpZiAoIWQuX193cGJjX3NsaWRlcl9sZW5fZ3JvdXBzX2dsb2JhbF9pbnN0YW5jZSkge1xyXG5cdFx0XHRcdGQuX193cGJjX3NsaWRlcl9sZW5fZ3JvdXBzX2dsb2JhbF9pbnN0YW5jZSA9IG5ldyBXUEJDX1NsaWRlcl9MZW5fR3JvdXBzKGQpLmluaXQoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRpZiAobm9kZS5fX3dwYmNfc2xpZGVyX2xlbl9ncm91cHNfaW5zdGFuY2UpIHJldHVybjtcclxuXHRcdFx0bm9kZS5fX3dwYmNfc2xpZGVyX2xlbl9ncm91cHNfaW5zdGFuY2UgPSBuZXcgV1BCQ19TbGlkZXJfTGVuX0dyb3Vwcyhub2RlKS5pbml0KCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vIEV4cG9ydCBnbG9iYWxzIChtYW51YWwgY29udHJvbCBpZiBuZWVkZWQpLlxyXG5cdHcuV1BCQ19TbGlkZXJfTGVuX0dyb3VwcyAgID0gV1BCQ19TbGlkZXJfTGVuX0dyb3VwcztcclxuXHR3LldQQkNfU2xpZGVyX0xlbl9BdXRvSW5pdCA9IHdwYmNfc2xpZGVyX2xlbl9ncm91cHNfX2F1dG9faW5pdDtcclxuXHJcblx0Ly8gRE9NLXJlYWR5IGF1dG8gaW5pdC5cclxuXHRpZiAoZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycpIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIHdwYmNfc2xpZGVyX2xlbl9ncm91cHNfX2F1dG9faW5pdCwgeyBvbmNlOiB0cnVlIH0pO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR3cGJjX3NsaWRlcl9sZW5fZ3JvdXBzX19hdXRvX2luaXQoKTtcclxuXHR9XHJcblxyXG59KSh3aW5kb3csIGRvY3VtZW50KTtcclxuIiwiLyogZ2xvYmFscyB3aW5kb3csIGRvY3VtZW50ICovXHJcbi8qKlxyXG4gKiBXUEJDIFNsaWRlciBSYW5nZSBHcm91cHNcclxuICpcclxuICogVW5pdmVyc2FsLCBkZXBlbmRlbmN5LWZyZWUgY29udHJvbGxlciB0aGF0IGtlZXBzIGEgXCJyYW5nZSArIG51bWJlclwiIHBhaXIgaW4gc3luYzpcclxuICogIC0gbnVtYmVyIGlucHV0ICAoZGF0YS13cGJjX3NsaWRlcl9yYW5nZV92YWx1ZSlcclxuICogIC0gcmFuZ2Ugc2xpZGVyICAoZGF0YS13cGJjX3NsaWRlcl9yYW5nZV9yYW5nZSlcclxuICogIC0gd3JpdGVyIGlucHV0ICAoZGF0YS13cGJjX3NsaWRlcl9yYW5nZV93cml0ZXIpIFtvcHRpb25hbF1cclxuICpcclxuICogSWYgd3JpdGVyIGV4aXN0czogbnVtYmVyL3NsaWRlciB1cGRhdGUgd3JpdGVyIGFuZCBlbWl0ICdpbnB1dCcgb24gd3JpdGVyIChidWJibGVzKS5cclxuICogSWYgd3JpdGVyIGlzIG1pc3Npbmc6IGVtaXRzICdpbnB1dCcgb24gdGhlIG51bWJlciBpbnB1dC5cclxuICogSWYgd3JpdGVyIGNoYW5nZXMgZXh0ZXJuYWxseTogdXBkYXRlcyBudW1iZXIvc2xpZGVyLlxyXG4gKlxyXG4gKiBNYXJrdXAgZXhwZWN0YXRpb25zIChtaW5pbWFsKTpcclxuICogIDxkaXYgY2xhc3M9XCJ3cGJjX3NsaWRlcl9yYW5nZV9ncm91cFwiPlxyXG4gKiAgICA8aW5wdXQgdHlwZT1cIm51bWJlclwiIGRhdGEtd3BiY19zbGlkZXJfcmFuZ2VfdmFsdWU+XHJcbiAqICAgIDxpbnB1dCB0eXBlPVwicmFuZ2VcIiAgZGF0YS13cGJjX3NsaWRlcl9yYW5nZV9yYW5nZT5cclxuICogICAgPCEtLSBvcHRpb25hbCAtLT5cclxuICogICAgPGlucHV0IHR5cGU9XCJ0ZXh0XCIgZGF0YS13cGJjX3NsaWRlcl9yYW5nZV93cml0ZXIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7XCI+XHJcbiAqICA8L2Rpdj5cclxuICpcclxuICogUGVyZm9ybWFuY2Ugbm90ZXM6XHJcbiAqIC0gTXV0YXRpb25PYnNlcnZlciBpcyBESVNBQkxFRCBieSBkZWZhdWx0LlxyXG4gKiAtIElmIHlvdXIgVUkgcmUtcmVuZGVycyBhbmQgaW5zZXJ0cyBuZXcgZ3JvdXBzIGR5bmFtaWNhbGx5LCBjYWxsOlxyXG4gKiAgICAgV1BCQ19TbGlkZXJfUmFuZ2VfQXV0b0luaXQoKTsgT1IgaW5zdGFuY2UucmVmcmVzaCgpO1xyXG4gKiAgIE9yIGVuYWJsZSBvYnNlcnZlciB2aWE6IG5ldyBXUEJDX1NsaWRlcl9SYW5nZV9Hcm91cHMocm9vdCwgeyBlbmFibGVfb2JzZXJ2ZXI6dHJ1ZSB9KS5pbml0KCk7XHJcbiAqXHJcbiAqIFB1YmxpYyBBUEkgKGluc3RhbmNlIG1ldGhvZHMpOlxyXG4gKiAgLSBpbml0KCksIGRlc3Ryb3koKSwgcmVmcmVzaCgpXHJcbiAqXHJcbiAqIEB2ZXJzaW9uIDIwMjYtMDEtMjVcclxuICogQHNpbmNlICAgMjAyNi0wMS0yNVxyXG4gKiBAZmlsZSAgICAuLi9pbmNsdWRlcy9fX2pzL2FkbWluL3NsaWRlcl9ncm91cHMvd3BiY19yYW5nZV9ncm91cHMuanNcclxuICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEhlbHBlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ZnVuY3Rpb24gY2xhbXBfbnVtKHYsIG1pbiwgbWF4KSB7XHJcblx0XHRpZiAodHlwZW9mIG1pbiA9PT0gJ251bWJlcicgJiYgIWlzTmFOKG1pbikpIHYgPSBNYXRoLm1heChtaW4sIHYpO1xyXG5cdFx0aWYgKHR5cGVvZiBtYXggPT09ICdudW1iZXInICYmICFpc05hTihtYXgpKSB2ID0gTWF0aC5taW4obWF4LCB2KTtcclxuXHRcdHJldHVybiB2O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGFyc2VfZmxvYXQodikge1xyXG5cdFx0dmFyIG4gPSBwYXJzZUZsb2F0KHYpO1xyXG5cdFx0cmV0dXJuIGlzTmFOKG4pID8gbnVsbCA6IG47XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlbWl0X2lucHV0KGVsKSB7XHJcblx0XHRpZiAoIWVsKSByZXR1cm47XHJcblx0XHRlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIENvbnRyb2xsZXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Y2xhc3MgV1BCQ19TbGlkZXJfUmFuZ2VfR3JvdXBzIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8c3RyaW5nfSByb290X2VsIENvbnRhaW5lciAob3Igc2VsZWN0b3IpLiBJZiBvbWl0dGVkLCB1c2VzIGRvY3VtZW50LlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzPXt9XVxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3Rvcihyb290X2VsLCBvcHRzKSB7XHJcblx0XHRcdHRoaXMucm9vdCA9IHJvb3RfZWxcclxuXHRcdFx0XHQ/ICgodHlwZW9mIHJvb3RfZWwgPT09ICdzdHJpbmcnKSA/IGQucXVlcnlTZWxlY3Rvcihyb290X2VsKSA6IHJvb3RfZWwpXHJcblx0XHRcdFx0OiBkO1xyXG5cclxuXHRcdFx0dGhpcy5vcHRzID0gT2JqZWN0LmFzc2lnbih7XHJcblx0XHRcdFx0Ly8gU3RyaWN0IHNlbGVjdG9ycyAoTk8gYmFja3dhcmQgY29tcGF0aWJpbGl0eSkuXHJcblx0XHRcdFx0Z3JvdXBfc2VsZWN0b3IgIDogJy53cGJjX3NsaWRlcl9yYW5nZV9ncm91cCcsXHJcblx0XHRcdFx0dmFsdWVfc2VsZWN0b3IgIDogJ1tkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3ZhbHVlXScsXHJcblx0XHRcdFx0cmFuZ2Vfc2VsZWN0b3IgIDogJ1tkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3JhbmdlXScsXHJcblx0XHRcdFx0d3JpdGVyX3NlbGVjdG9yIDogJ1tkYXRhLXdwYmNfc2xpZGVyX3JhbmdlX3dyaXRlcl0nLFxyXG5cclxuXHRcdFx0XHQvLyBEaXNhYmxlZCBieSBkZWZhdWx0IGZvciBwZXJmb3JtYW5jZS5cclxuXHRcdFx0XHRlbmFibGVfb2JzZXJ2ZXIgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0b2JzZXJ2ZXJfZGVib3VuY2VfbXM6IDE1MFxyXG5cdFx0XHR9LCBvcHRzIHx8IHt9KTtcclxuXHJcblx0XHRcdHRoaXMuX29uX2lucHV0ICA9IHRoaXMuX29uX2lucHV0LmJpbmQodGhpcyk7XHJcblx0XHRcdHRoaXMuX29uX2NoYW5nZSA9IHRoaXMuX29uX2NoYW5nZS5iaW5kKHRoaXMpO1xyXG5cclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgICAgPSBudWxsO1xyXG5cdFx0XHR0aGlzLl9yZWZyZXNoX3RtciA9IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0aWYgKCF0aGlzLnJvb3QpIHJldHVybiB0aGlzO1xyXG5cclxuXHRcdFx0dGhpcy5yb290LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgIHRoaXMuX29uX2lucHV0LCAgdHJ1ZSk7XHJcblx0XHRcdHRoaXMucm9vdC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLl9vbl9jaGFuZ2UsIHRydWUpO1xyXG5cclxuXHRcdFx0aWYgKHRoaXMub3B0cy5lbmFibGVfb2JzZXJ2ZXIgJiYgdy5NdXRhdGlvbk9ic2VydmVyKSB7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcigoKSA9PiB7IHRoaXMuX2RlYm91bmNlZF9yZWZyZXNoKCk7IH0pO1xyXG5cdFx0XHRcdHRoaXMuX29ic2VydmVyLm9ic2VydmUodGhpcy5yb290ID09PSBkID8gZC5kb2N1bWVudEVsZW1lbnQgOiB0aGlzLnJvb3QsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLnJlZnJlc2goKTtcclxuXHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0aWYgKCF0aGlzLnJvb3QpIHJldHVybjtcclxuXHJcblx0XHRcdHRoaXMucm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCdpbnB1dCcsICB0aGlzLl9vbl9pbnB1dCwgIHRydWUpO1xyXG5cdFx0XHR0aGlzLnJvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy5fb25fY2hhbmdlLCB0cnVlKTtcclxuXHJcblx0XHRcdGlmICh0aGlzLl9vYnNlcnZlcikge1xyXG5cdFx0XHRcdHRoaXMuX29ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuXHRcdFx0XHR0aGlzLl9vYnNlcnZlciA9IG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0aGlzLl9yZWZyZXNoX3Rtcikge1xyXG5cdFx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl9yZWZyZXNoX3Rtcik7XHJcblx0XHRcdFx0dGhpcy5fcmVmcmVzaF90bXIgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmVmcmVzaCgpIHtcclxuXHRcdFx0aWYgKCF0aGlzLnJvb3QpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBzY29wZSAgPSAodGhpcy5yb290ID09PSBkID8gZCA6IHRoaXMucm9vdCk7XHJcblx0XHRcdHZhciBncm91cHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChzY29wZS5xdWVyeVNlbGVjdG9yQWxsKHRoaXMub3B0cy5ncm91cF9zZWxlY3RvcikpO1xyXG5cclxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBncm91cHMubGVuZ3RoOyBpKyspIHtcclxuXHRcdFx0XHR0aGlzLl9zeW5jX2Zyb21fd3JpdGVyKGdyb3Vwc1tpXSk7XHJcblx0XHRcdFx0dGhpcy5fY2xhbXBfdG9fcmFuZ2UoZ3JvdXBzW2ldKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEludGVybmFsXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRfZGVib3VuY2VkX3JlZnJlc2goKSB7XHJcblx0XHRcdGlmICh0aGlzLl9yZWZyZXNoX3RtcikgY2xlYXJUaW1lb3V0KHRoaXMuX3JlZnJlc2hfdG1yKTtcclxuXHRcdFx0dGhpcy5fcmVmcmVzaF90bXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuXHRcdFx0XHR0aGlzLl9yZWZyZXNoX3RtciA9IG51bGw7XHJcblx0XHRcdFx0dGhpcy5yZWZyZXNoKCk7XHJcblx0XHRcdH0sIE51bWJlcih0aGlzLm9wdHMub2JzZXJ2ZXJfZGVib3VuY2VfbXMpIHx8IDApO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9maW5kX2dyb3VwKGVsKSB7XHJcblx0XHRcdHJldHVybiAoZWwgJiYgZWwuY2xvc2VzdCkgPyBlbC5jbG9zZXN0KHRoaXMub3B0cy5ncm91cF9zZWxlY3RvcikgOiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdF9nZXRfcGFydHMoZ3JvdXApIHtcclxuXHRcdFx0aWYgKCFncm91cCkgcmV0dXJuIG51bGw7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0Z3JvdXAgOiBncm91cCxcclxuXHRcdFx0XHRudW0gICA6IGdyb3VwLnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRzLnZhbHVlX3NlbGVjdG9yKSxcclxuXHRcdFx0XHRyYW5nZSA6IGdyb3VwLnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRzLnJhbmdlX3NlbGVjdG9yKSxcclxuXHRcdFx0XHR3cml0ZXI6IGdyb3VwLnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRzLndyaXRlcl9zZWxlY3RvcilcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRfd3JpdGUocGFydHMsIHZhbHVlLCBlbWl0KSB7XHJcblx0XHRcdGlmICghcGFydHMpIHJldHVybjtcclxuXHJcblx0XHRcdGlmIChwYXJ0cy53cml0ZXIpIHtcclxuXHRcdFx0XHRwYXJ0cy53cml0ZXIuX193cGJjX3NsaWRlcl9yYW5nZV9pbnRlcm5hbCA9IHRydWU7XHJcblx0XHRcdFx0cGFydHMud3JpdGVyLnZhbHVlID0gU3RyaW5nKHZhbHVlKTtcclxuXHRcdFx0XHRpZiAoZW1pdCkgZW1pdF9pbnB1dChwYXJ0cy53cml0ZXIpO1xyXG5cdFx0XHRcdHBhcnRzLndyaXRlci5fX3dwYmNfc2xpZGVyX3JhbmdlX2ludGVybmFsID0gZmFsc2U7XHJcblx0XHRcdH0gZWxzZSBpZiAocGFydHMubnVtKSB7XHJcblx0XHRcdFx0Ly8gSWYgd3JpdGVyIGlzIG1pc3NpbmcsIGF0IGxlYXN0IG5vdGlmeSB2aWEgbnVtYmVyIGlucHV0LlxyXG5cdFx0XHRcdGlmIChlbWl0KSBlbWl0X2lucHV0KHBhcnRzLm51bSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfc3luY19mcm9tX3dyaXRlcihncm91cCkge1xyXG5cdFx0XHR2YXIgcGFydHMgPSB0aGlzLl9nZXRfcGFydHMoZ3JvdXApO1xyXG5cdFx0XHRpZiAoIXBhcnRzIHx8ICFwYXJ0cy53cml0ZXIpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciByYXcgPSBTdHJpbmcocGFydHMud3JpdGVyLnZhbHVlIHx8ICcnKS50cmltKCk7XHJcblx0XHRcdGlmICghcmF3KSByZXR1cm47XHJcblxyXG5cdFx0XHRpZiAocGFydHMubnVtKSAgIHBhcnRzLm51bS52YWx1ZSAgID0gcmF3O1xyXG5cdFx0XHRpZiAocGFydHMucmFuZ2UpIHBhcnRzLnJhbmdlLnZhbHVlID0gcmF3O1xyXG5cdFx0fVxyXG5cclxuXHRcdF9jbGFtcF90b19yYW5nZShncm91cCkge1xyXG5cdFx0XHR2YXIgcGFydHMgPSB0aGlzLl9nZXRfcGFydHMoZ3JvdXApO1xyXG5cdFx0XHRpZiAoIXBhcnRzIHx8ICFwYXJ0cy5yYW5nZSB8fCAhcGFydHMubnVtKSByZXR1cm47XHJcblxyXG5cdFx0XHR2YXIgdiA9IHBhcnNlX2Zsb2F0KHBhcnRzLm51bS52YWx1ZSk7XHJcblx0XHRcdGlmICh2ID09IG51bGwpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBtaW4gPSBOdW1iZXIocGFydHMucmFuZ2UubWluKTtcclxuXHRcdFx0dmFyIG1heCA9IE51bWJlcihwYXJ0cy5yYW5nZS5tYXgpO1xyXG5cdFx0XHR2YXIgdnYgID0gY2xhbXBfbnVtKHYsIGlzTmFOKG1pbikgPyBudWxsIDogbWluLCBpc05hTihtYXgpID8gbnVsbCA6IG1heCk7XHJcblxyXG5cdFx0XHRpZiAoU3RyaW5nKHZ2KSAhPT0gcGFydHMubnVtLnZhbHVlKSBwYXJ0cy5udW0udmFsdWUgPSBTdHJpbmcodnYpO1xyXG5cdFx0XHRwYXJ0cy5yYW5nZS52YWx1ZSA9IFN0cmluZyh2dik7XHJcblx0XHR9XHJcblxyXG5cdFx0X29uX2lucHV0KGV2KSB7XHJcblx0XHRcdHZhciB0ID0gZXYudGFyZ2V0O1xyXG5cdFx0XHRpZiAoIXQpIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBncm91cCA9IHRoaXMuX2ZpbmRfZ3JvdXAodCk7XHJcblx0XHRcdGlmICghZ3JvdXApIHJldHVybjtcclxuXHJcblx0XHRcdHZhciBwYXJ0cyA9IHRoaXMuX2dldF9wYXJ0cyhncm91cCk7XHJcblx0XHRcdGlmICghcGFydHMpIHJldHVybjtcclxuXHJcblx0XHRcdC8vIFdyaXRlciBjaGFuZ2VkIGV4dGVybmFsbHkgLT4gdXBkYXRlIFVJLlxyXG5cdFx0XHRpZiAocGFydHMud3JpdGVyICYmIHQgPT09IHBhcnRzLndyaXRlcikge1xyXG5cdFx0XHRcdGlmICh0Ll9fd3BiY19zbGlkZXJfcmFuZ2VfaW50ZXJuYWwpIHJldHVybjtcclxuXHRcdFx0XHR0aGlzLl9zeW5jX2Zyb21fd3JpdGVyKGdyb3VwKTtcclxuXHRcdFx0XHR0aGlzLl9jbGFtcF90b19yYW5nZShncm91cCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBSYW5nZSBtb3ZlZCAtPiB1cGRhdGUgbnVtYmVyICsgd3JpdGVyLlxyXG5cdFx0XHRpZiAodC5tYXRjaGVzICYmIHQubWF0Y2hlcyh0aGlzLm9wdHMucmFuZ2Vfc2VsZWN0b3IpKSB7XHJcblx0XHRcdFx0aWYgKHBhcnRzLm51bSkgcGFydHMubnVtLnZhbHVlID0gdC52YWx1ZTtcclxuXHRcdFx0XHR0aGlzLl93cml0ZShwYXJ0cywgdC52YWx1ZSwgLyplbWl0Ki8gdHJ1ZSk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBOdW1iZXIgdHlwZWQgLT4gdXBkYXRlIHJhbmdlICsgd3JpdGVyIChjbGFtcCBieSBzbGlkZXIgYm91bmRzKS5cclxuXHRcdFx0aWYgKHQubWF0Y2hlcyAmJiB0Lm1hdGNoZXModGhpcy5vcHRzLnZhbHVlX3NlbGVjdG9yKSkge1xyXG5cdFx0XHRcdGlmIChwYXJ0cy5yYW5nZSkge1xyXG5cdFx0XHRcdFx0dmFyIHYgPSBwYXJzZV9mbG9hdCh0LnZhbHVlKTtcclxuXHRcdFx0XHRcdGlmICh2ICE9IG51bGwpIHtcclxuXHRcdFx0XHRcdFx0dmFyIG1pbiA9IE51bWJlcihwYXJ0cy5yYW5nZS5taW4pO1xyXG5cdFx0XHRcdFx0XHR2YXIgbWF4ID0gTnVtYmVyKHBhcnRzLnJhbmdlLm1heCk7XHJcblx0XHRcdFx0XHRcdHYgPSBjbGFtcF9udW0odiwgaXNOYU4obWluKSA/IG51bGwgOiBtaW4sIGlzTmFOKG1heCkgPyBudWxsIDogbWF4KTtcclxuXHJcblx0XHRcdFx0XHRcdHBhcnRzLnJhbmdlLnZhbHVlID0gU3RyaW5nKHYpO1xyXG5cdFx0XHRcdFx0XHRpZiAoU3RyaW5nKHYpICE9PSB0LnZhbHVlKSB0LnZhbHVlID0gU3RyaW5nKHYpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR0aGlzLl93cml0ZShwYXJ0cywgdC52YWx1ZSwgLyplbWl0Ki8gdHJ1ZSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRfb25fY2hhbmdlKGV2KSB7XHJcblx0XHRcdC8vIE5vIHNwZWNpYWwgXCJjaGFuZ2VcIiBoYW5kbGluZyBuZWVkZWQgY3VycmVudGx5OyBrZXB0IGZvciBzeW1tZXRyeS9mdXR1cmUuXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQXV0by1pbml0XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGZ1bmN0aW9uIHdwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwc19fYXV0b19pbml0KCkge1xyXG5cdFx0dmFyIFJPT1QgID0gJy53cGJjX3NsaWRlcl9yYW5nZV9ncm91cHMnO1xyXG5cdFx0dmFyIG5vZGVzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZC5xdWVyeVNlbGVjdG9yQWxsKFJPT1QpKVxyXG5cdFx0XHQuZmlsdGVyKGZ1bmN0aW9uIChuKSB7IHJldHVybiAhbi5wYXJlbnRFbGVtZW50IHx8ICFuLnBhcmVudEVsZW1lbnQuY2xvc2VzdChST09UKTsgfSk7XHJcblxyXG5cdFx0aWYgKCFub2Rlcy5sZW5ndGgpIHtcclxuXHRcdFx0aWYgKCFkLl9fd3BiY19zbGlkZXJfcmFuZ2VfZ3JvdXBzX2dsb2JhbF9pbnN0YW5jZSkge1xyXG5cdFx0XHRcdGQuX193cGJjX3NsaWRlcl9yYW5nZV9ncm91cHNfZ2xvYmFsX2luc3RhbmNlID0gbmV3IFdQQkNfU2xpZGVyX1JhbmdlX0dyb3VwcyhkKS5pbml0KCk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdG5vZGVzLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcclxuXHRcdFx0aWYgKG5vZGUuX193cGJjX3NsaWRlcl9yYW5nZV9ncm91cHNfaW5zdGFuY2UpIHJldHVybjtcclxuXHRcdFx0bm9kZS5fX3dwYmNfc2xpZGVyX3JhbmdlX2dyb3Vwc19pbnN0YW5jZSA9IG5ldyBXUEJDX1NsaWRlcl9SYW5nZV9Hcm91cHMobm9kZSkuaW5pdCgpO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvLyBFeHBvcnQgZ2xvYmFscy5cclxuXHR3LldQQkNfU2xpZGVyX1JhbmdlX0dyb3VwcyAgID0gV1BCQ19TbGlkZXJfUmFuZ2VfR3JvdXBzO1xyXG5cdHcuV1BCQ19TbGlkZXJfUmFuZ2VfQXV0b0luaXQgPSB3cGJjX3NsaWRlcl9yYW5nZV9ncm91cHNfX2F1dG9faW5pdDtcclxuXHJcblx0aWYgKGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnKSB7XHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCB3cGJjX3NsaWRlcl9yYW5nZV9ncm91cHNfX2F1dG9faW5pdCwgeyBvbmNlOiB0cnVlIH0pO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR3cGJjX3NsaWRlcl9yYW5nZV9ncm91cHNfX2F1dG9faW5pdCgpO1xyXG5cdH1cclxuXHJcbn0pKHdpbmRvdywgZG9jdW1lbnQpO1xyXG4iLCIvKipcclxuICogQm9va2luZyBDYWxlbmRhciDigJQgR2VuZXJpYyBVSSBUYWJzIFV0aWxpdHkgKEpTKVxyXG4gKlxyXG4gKiBQdXJwb3NlOiBMaWdodHdlaWdodCwgZGVwZW5kZW5jeS1mcmVlIHRhYnMgY29udHJvbGxlciBmb3IgYW55IHNtYWxsIHRhYiBncm91cCBpbiBhZG1pbiBVSXMuXHJcbiAqIC0gQXV0by1pbml0aWFsaXplcyBncm91cHMgbWFya2VkIHdpdGggZGF0YS13cGJjLXRhYnMuXHJcbiAqIC0gQXNzaWducyBBUklBIHJvbGVzIGFuZCB0b2dnbGVzIGFyaWEtc2VsZWN0ZWQvYXJpYS1oaWRkZW4vdGFiaW5kZXguXHJcbiAqIC0gU3VwcG9ydHMga2V5Ym9hcmQgbmF2aWdhdGlvbiAoTGVmdC9SaWdodC9Ib21lL0VuZCkuXHJcbiAqIC0gUHVibGljIEFQSTogd2luZG93LndwYmNfdWlfdGFicy57aW5pdF9vbiwgaW5pdF9ncm91cCwgc2V0X2FjdGl2ZX1cclxuICogLSBFbWl0cyAnd3BiYzp0YWJzOmNoYW5nZScgb24gdGhlIGdyb3VwIHJvb3Qgd2hlbiB0aGUgYWN0aXZlIHRhYiBjaGFuZ2VzLlxyXG4gKlxyXG4gKiBNYXJrdXAgY29udHJhY3Q6XHJcbiAqIC0gUm9vdDogICBbZGF0YS13cGJjLXRhYnNdXHJcbiAqIC0gVGFiczogICBbZGF0YS13cGJjLXRhYi1rZXk9XCJLXCJdXHJcbiAqIC0gUGFuZWxzOiBbZGF0YS13cGJjLXRhYi1wYW5lbD1cIktcIl1cclxuICpcclxuICogQHBhY2thZ2UgICBCb29raW5nIENhbGVuZGFyXHJcbiAqIEBzdWJwYWNrYWdlIEFkbWluXFxVSVxyXG4gKiBAc2luY2UgICAgIDExLjAuMFxyXG4gKiBAdmVyc2lvbiAgIDEuMC4wXHJcbiAqIEBzZWUgICAgICAgL2luY2x1ZGVzL19fanMvYWRtaW4vdWlfdGFicy91aV90YWJzLmpzXHJcbiAqXHJcbiAqXHJcbiAqIEhvdyBpdCB3b3JrczpcclxuICogLSBSb290IG5vZGUgbXVzdCBoYXZlIFtkYXRhLXdwYmMtdGFic10gYXR0cmlidXRlIChhbnkgdmFsdWUpLlxyXG4gKiAtIFRhYiBidXR0b25zIG11c3QgY2FycnkgW2RhdGEtd3BiYy10YWIta2V5PVwiLi4uXCJdICh1bmlxdWUgcGVyIGdyb3VwKS5cclxuICogLSBQYW5lbHMgbXVzdCBjYXJyeSBbZGF0YS13cGJjLXRhYi1wYW5lbD1cIi4uLlwiXSB3aXRoIG1hdGNoaW5nIGtleXMuXHJcbiAqIC0gQWRkcyBXQUktQVJJQSByb2xlcyBhbmQgYXJpYS1zZWxlY3RlZC9oaWRkZW4gd2lyaW5nLlxyXG4gKlxyXG4gKiA8ZGl2IGRhdGEtd3BiYy10YWJzPVwiY29sdW1uLXN0eWxlc1wiIGRhdGEtd3BiYy10YWItYWN0aXZlPVwiMVwiICAgIGNsYXNzPVwid3BiY191aV90YWJzX3Jvb3RcIiA+XHJcbiAqICAgIDwhLS0gVG9wIFRhYnMgLS0+XHJcbiAqICAgIDxkaXYgZGF0YS13cGJjLXRhYmxpc3Q9XCJcIiByb2xlPVwidGFibGlzdFwiICAgICAgICAgICAgICAgICAgICBjbGFzcz1cIiB3cGJjX3VpX2VsX19ob3Jpc190b3BfYmFyX193cmFwcGVyXCIgPlxyXG4gKiAgICAgICAgPGRpdiBjbGFzcz1cIndwYmNfdWlfZWxfX2hvcmlzX3RvcF9iYXJfX2NvbnRlbnRcIj5cclxuICogICAgICAgICAgICA8aDIgY2xhc3M9XCJ3cGJjX3VpX2VsX19ob3Jpc19uYXZfbGFiZWxcIj5Db2x1bW46PC9oMj5cclxuICpcclxuICogICAgICAgICAgICA8ZGl2IGNsYXNzPVwid3BiY191aV9lbF9faG9yaXNfbmF2X2l0ZW0gd3BiY191aV9lbF9faG9yaXNfbmF2X2l0ZW1fXzFcIj5cclxuICogICAgICAgICAgICAgICAgPGFcclxuICogICAgICAgICAgICAgICAgICAgIGRhdGEtd3BiYy10YWIta2V5PVwiMVwiXHJcbiAqICAgICAgICAgICAgICAgICAgICBhcmlhLXNlbGVjdGVkPVwidHJ1ZVwiIHJvbGU9XCJ0YWJcIiB0YWJpbmRleD1cIjBcIiBhcmlhLWNvbnRyb2xzPVwid3BiY190YWJfcGFuZWxfY29sXzFcIlxyXG4gKlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMCk7XCJcclxuICogICAgICAgICAgICAgICAgICAgICAgICBjbGFzcz1cIndwYmNfdWlfZWxfX2hvcmlzX25hdl9pdGVtX19hIHdwYmNfdWlfZWxfX2hvcmlzX25hdl9pdGVtX19zaW5nbGVcIlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgIGlkPVwid3BiY190YWJfY29sXzFcIlxyXG4gKiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlPVwiQ29sdW1uIDFcIlxyXG4gKiAgICAgICAgICAgICAgICA+PHNwYW4gY2xhc3M9XCJ3cGJjX3VpX2VsX19ob3Jpc19uYXZfdGl0bGVcIj5UaXRsZSAxPC9zcGFuPjwvYT5cclxuICogICAgICAgICAgICA8L2Rpdj5cclxuICogICAgICAgICAgICAuLi5cclxuICogICAgICAgIDwvZGl2PlxyXG4gKiAgICA8L2Rpdj5cclxuICogICAgPCEtLSBUYWJzIENvbnRlbnQgLS0+XHJcbiAqICAgIDxkaXYgY2xhc3M9XCJ3cGJjX3RhYl9fcGFuZWwgZ3JvdXBfX2ZpZWxkc1wiIGRhdGEtd3BiYy10YWItcGFuZWw9XCIxXCIgaWQ9XCJ3cGJjX3RhYl9wYW5lbF9jb2xfMVwiIHJvbGU9XCJ0YWJwYW5lbFwiIGFyaWEtbGFiZWxsZWRieT1cIndwYmNfdGFiX2NvbF8xXCI+XHJcbiAqICAgICAgICAuLi5cclxuICogICAgPC9kaXY+XHJcbiAqICAgIC4uLlxyXG4gKiA8L2Rpdj5cclxuICpcclxuICogUHVibGljIEFQSTpcclxuICogICAtIHdwYmNfdWlfdGFicy5pbml0X29uKHJvb3Rfb3Jfc2VsZWN0b3IpICAgLy8gZmluZCBhbmQgaW5pdCBncm91cHMgd2l0aGluIGEgY29udGFpbmVyXHJcbiAqICAgLSB3cGJjX3VpX3RhYnMuaW5pdF9ncm91cChyb290X2VsKSAgICAgICAgIC8vIGluaXQgYSBzaW5nbGUgZ3JvdXAgcm9vdFxyXG4gKiAgIC0gd3BiY191aV90YWJzLnNldF9hY3RpdmUocm9vdF9lbCwga2V5KSAgICAvLyBwcm9ncmFtbWF0aWNhbGx5IGNoYW5nZSBhY3RpdmUgdGFiXHJcbiAqXHJcbiAqIEV2ZW50czpcclxuICogICAtIERpc3BhdGNoZXMgQ3VzdG9tRXZlbnQgJ3dwYmM6dGFiczpjaGFuZ2UnIG9uIHJvb3Qgd2hlbiB0YWIgY2hhbmdlczpcclxuICogICAgICAgZGV0YWlsOiB7IGFjdGl2ZV9rZXk6ICcyJywgcHJldl9rZXk6ICcxJyB9XHJcbiAqXHJcbiAqIFN3aXRjaCBhIGxvY2FsIChnZW5lcmljKSB0YWJzIGdyb3VwIHRvIHRhYiAzOiAgICAgdmFyIGdyb3VwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignW2RhdGEtd3BiYy10YWJzPVwiY29sdW1uLXN0eWxlc1wiXScpOyBpZiAoIGdyb3VwICkgeyB3cGJjX3VpX3RhYnMuc2V0X2FjdGl2ZShncm91cCwgJzMnKTsgfVxyXG4gKi9cclxuKGZ1bmN0aW9uICggdyApIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdGlmICggdy53cGJjX3VpX3RhYnMgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbnRlcm5hbDogdG9nZ2xlIGFjdGl2ZSBzdGF0ZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RfZWxcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBrZXlcclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICBzaG91bGRfZW1pdFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHNldF9hY3RpdmVfaW50ZXJuYWwoIHJvb3RfZWwsIGtleSwgc2hvdWxkX2VtaXQgKSB7XHJcblx0XHR2YXIgdGFiX2J0bnMgPSByb290X2VsLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRhYi1rZXldJyApO1xyXG5cdFx0dmFyIHBhbmVscyAgID0gcm9vdF9lbC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10YWItcGFuZWxdJyApO1xyXG5cclxuXHRcdHZhciBwcmV2X2tleSA9IHJvb3RfZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRhYi1hY3RpdmUnICkgfHwgbnVsbDtcclxuXHRcdGlmICggU3RyaW5nKCBwcmV2X2tleSApID09PSBTdHJpbmcoIGtleSApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQnV0dG9uczogYXJpYSArIGNsYXNzXHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCB0YWJfYnRucy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0dmFyIGJ0biAgID0gdGFiX2J0bnNbaV07XHJcblx0XHRcdHZhciBiX2tleSA9IGJ0bi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWtleScgKTtcclxuXHRcdFx0dmFyIGlzX29uID0gU3RyaW5nKCBiX2tleSApID09PSBTdHJpbmcoIGtleSApO1xyXG5cclxuXHRcdFx0YnRuLnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAndGFiJyApO1xyXG5cdFx0XHRidG4uc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsIGlzX29uID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0XHRidG4uc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCBpc19vbiA/ICcwJyA6ICctMScgKTtcclxuXHJcblx0XHRcdGlmICggaXNfb24gKSB7XHJcblx0XHRcdFx0YnRuLmNsYXNzTGlzdC5hZGQoICdhY3RpdmUnICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0YnRuLmNsYXNzTGlzdC5yZW1vdmUoICdhY3RpdmUnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBQYW5lbHM6IGFyaWEgKyB2aXNpYmlsaXR5XHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBwYW5lbHMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdHZhciBwbiAgID0gcGFuZWxzW2pdO1xyXG5cdFx0XHR2YXIgcGtleSA9IHBuLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10YWItcGFuZWwnICk7XHJcblx0XHRcdHZhciBzaG93ID0gU3RyaW5nKCBwa2V5ICkgPT09IFN0cmluZygga2V5ICk7XHJcblxyXG5cdFx0XHRwbi5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ3RhYnBhbmVsJyApO1xyXG5cdFx0XHRwbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIHNob3cgPyAnZmFsc2UnIDogJ3RydWUnICk7XHJcblx0XHRcdGlmICggc2hvdyApIHtcclxuXHRcdFx0XHRwbi5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0cG4uc2V0QXR0cmlidXRlKCAnaGlkZGVuJywgJycgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJvb3RfZWwuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRhYi1hY3RpdmUnLCBTdHJpbmcoIGtleSApICk7XHJcblxyXG5cdFx0aWYgKCBzaG91bGRfZW1pdCApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgZXYgPSBuZXcgdy5DdXN0b21FdmVudCggJ3dwYmM6dGFiczpjaGFuZ2UnLCB7XHJcblx0XHRcdFx0XHRidWJibGVzIDogdHJ1ZSxcclxuXHRcdFx0XHRcdGRldGFpbCAgOiB7IGFjdGl2ZV9rZXkgOiBTdHJpbmcoIGtleSApLCBwcmV2X2tleSA6IHByZXZfa2V5IH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0cm9vdF9lbC5kaXNwYXRjaEV2ZW50KCBldiApO1xyXG5cdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSW50ZXJuYWw6IGdldCBvcmRlcmVkIGtleXMgZnJvbSBidXR0b25zLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdF9lbFxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmdbXX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBnZXRfa2V5cyggcm9vdF9lbCApIHtcclxuXHRcdHZhciBsaXN0ID0gW107XHJcblx0XHR2YXIgYnRucyA9IHJvb3RfZWwucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGFiLWtleV0nICk7XHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBidG5zLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHR2YXIgayA9IGJ0bnNbaV0uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRhYi1rZXknICk7XHJcblx0XHRcdGlmICggayAhPSBudWxsICYmIGsgIT09ICcnICkge1xyXG5cdFx0XHRcdGxpc3QucHVzaCggU3RyaW5nKCBrICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGxpc3Q7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbnRlcm5hbDogbW92ZSBmb2N1cyBiZXR3ZWVuIHRhYnMgdXNpbmcga2V5Ym9hcmQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290X2VsXHJcblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgZGlyICArMSAobmV4dCkgLyAtMSAocHJldilcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBmb2N1c19yZWxhdGl2ZSggcm9vdF9lbCwgZGlyICkge1xyXG5cdFx0dmFyIGtleXMgICAgPSBnZXRfa2V5cyggcm9vdF9lbCApO1xyXG5cdFx0dmFyIGN1cnJlbnQgPSByb290X2VsLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10YWItYWN0aXZlJyApIHx8IGtleXNbMF0gfHwgbnVsbDtcclxuXHRcdHZhciBpZHggICAgID0gTWF0aC5tYXgoIDAsIGtleXMuaW5kZXhPZiggU3RyaW5nKCBjdXJyZW50ICkgKSApO1xyXG5cdFx0dmFyIG5leHQgICAgPSBrZXlzWyAoIGlkeCArICggZGlyID4gMCA/IDEgOiBrZXlzLmxlbmd0aCAtIDEgKSApICUga2V5cy5sZW5ndGggXTtcclxuXHJcblx0XHR2YXIgbmV4dF9idG4gPSByb290X2VsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRhYi1rZXk9XCInICsgbmV4dCArICdcIl0nICk7XHJcblx0XHRpZiAoIG5leHRfYnRuICkge1xyXG5cdFx0XHRuZXh0X2J0bi5mb2N1cygpO1xyXG5cdFx0XHRzZXRfYWN0aXZlX2ludGVybmFsKCByb290X2VsLCBuZXh0LCB0cnVlICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplIGEgc2luZ2xlIHRhYnMgZ3JvdXAgcm9vdC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RfZWxcclxuXHQgKi9cclxuXHRmdW5jdGlvbiBpbml0X2dyb3VwKCByb290X2VsICkge1xyXG5cdFx0aWYgKCAhIHJvb3RfZWwgfHwgcm9vdF9lbC5fX3dwYmNfdGFic19pbml0ZWQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHJvb3RfZWwuX193cGJjX3RhYnNfaW5pdGVkID0gdHJ1ZTtcclxuXHJcblx0XHQvLyBSb2xlc1xyXG5cdFx0dmFyIHRhYmxpc3QgPSByb290X2VsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRhYmxpc3RdJyApIHx8IHJvb3RfZWw7XHJcblx0XHR0YWJsaXN0LnNldEF0dHJpYnV0ZSggJ3JvbGUnLCAndGFibGlzdCcgKTtcclxuXHJcblx0XHQvLyBEZWZhdWx0IGFjdGl2ZTogZnJvbSBhdHRyaWJ1dGUgb3IgZmlyc3QgYnV0dG9uXHJcblx0XHR2YXIga2V5cyA9IGdldF9rZXlzKCByb290X2VsICk7XHJcblx0XHR2YXIgZGVmICA9IHJvb3RfZWwuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRhYi1hY3RpdmUnICkgfHwgKCBrZXlzWzBdIHx8ICcxJyApO1xyXG5cdFx0c2V0X2FjdGl2ZV9pbnRlcm5hbCggcm9vdF9lbCwgZGVmLCBmYWxzZSApO1xyXG5cclxuXHRcdC8vIENsaWNrc1xyXG5cdFx0cm9vdF9lbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGUgKSB7XHJcblx0XHRcdHZhciBidG4gPSBlLnRhcmdldC5jbG9zZXN0ID8gZS50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdGFiLWtleV0nICkgOiBudWxsO1xyXG5cdFx0XHRpZiAoICEgYnRuIHx8ICEgcm9vdF9lbC5jb250YWlucyggYnRuICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0dmFyIGtleSA9IGJ0bi5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWtleScgKTtcclxuXHRcdFx0aWYgKCBrZXkgIT0gbnVsbCApIHtcclxuXHRcdFx0XHRzZXRfYWN0aXZlX2ludGVybmFsKCByb290X2VsLCBrZXksIHRydWUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSwgdHJ1ZSApO1xyXG5cclxuXHRcdC8vIEtleWJvYXJkIChMZWZ0L1JpZ2h0L0hvbWUvRW5kKVxyXG5cdFx0cm9vdF9lbC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGZ1bmN0aW9uICggZSApIHtcclxuXHRcdFx0dmFyIHRndCA9IGUudGFyZ2V0O1xyXG5cdFx0XHRpZiAoICEgdGd0IHx8ICEgdGd0Lmhhc0F0dHJpYnV0ZSB8fCAhIHRndC5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGFiLWtleScgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0c3dpdGNoICggZS5rZXkgKSB7XHJcblx0XHRcdGNhc2UgJ0Fycm93TGVmdCc6XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpOyBmb2N1c19yZWxhdGl2ZSggcm9vdF9lbCwgLTEgKTsgYnJlYWs7XHJcblx0XHRcdGNhc2UgJ0Fycm93UmlnaHQnOlxyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTsgZm9jdXNfcmVsYXRpdmUoIHJvb3RfZWwsICsxICk7IGJyZWFrO1xyXG5cdFx0XHRjYXNlICdIb21lJzpcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7IHNldF9hY3RpdmVfaW50ZXJuYWwoIHJvb3RfZWwsICggZ2V0X2tleXMoIHJvb3RfZWwgKVswXSB8fCAnMScgKSwgdHJ1ZSApOyBicmVhaztcclxuXHRcdFx0Y2FzZSAnRW5kJzpcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7IHZhciBrcyA9IGdldF9rZXlzKCByb290X2VsICk7IHNldF9hY3RpdmVfaW50ZXJuYWwoIHJvb3RfZWwsICgga3NbIGtzLmxlbmd0aCAtIDEgXSB8fCAnMScgKSwgdHJ1ZSApOyBicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0fSwgdHJ1ZSApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSW5pdGlhbGl6ZSBhbGwgZ3JvdXBzIHdpdGhpbiBhIGNvbnRhaW5lciAob3IgZG9jdW1lbnQpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxzdHJpbmd8bnVsbH0gY29udGFpbmVyXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gaW5pdF9vbiggY29udGFpbmVyICkge1xyXG5cdFx0dmFyIGN0eCA9IGNvbnRhaW5lciA/ICggdHlwZW9mIGNvbnRhaW5lciA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCBjb250YWluZXIgKSA6IGNvbnRhaW5lciApIDogZG9jdW1lbnQ7XHJcblx0XHRpZiAoICEgY3R4ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR2YXIgZ3JvdXBzID0gY3R4LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRhYnNdJyApO1xyXG5cdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgZ3JvdXBzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRpbml0X2dyb3VwKCBncm91cHNbaV0gKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFByb2dyYW1tYXRpY2FsbHkgc2V0IGFjdGl2ZSB0YWIgYnkga2V5LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdF9lbFxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0ga2V5XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gc2V0X2FjdGl2ZSggcm9vdF9lbCwga2V5ICkge1xyXG5cdFx0aWYgKCByb290X2VsICYmIHJvb3RfZWwuaGFzQXR0cmlidXRlICYmIHJvb3RfZWwuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLXRhYnMnICkgKSB7XHJcblx0XHRcdHNldF9hY3RpdmVfaW50ZXJuYWwoIHJvb3RfZWwsIFN0cmluZygga2V5ICksIHRydWUgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIFB1YmxpYyBBUEkgKHNuYWtlX2Nhc2UpXHJcblx0dy53cGJjX3VpX3RhYnMgPSB7XHJcblx0XHRpbml0X29uICAgIDogaW5pdF9vbixcclxuXHRcdGluaXRfZ3JvdXAgOiBpbml0X2dyb3VwLFxyXG5cdFx0c2V0X2FjdGl2ZSA6IHNldF9hY3RpdmVcclxuXHR9O1xyXG5cclxuXHQvLyBBdXRvLWluaXQgb24gRE9NIHJlYWR5XHJcblx0aWYgKCBkb2N1bWVudC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIGZ1bmN0aW9uICgpIHsgaW5pdF9vbiggZG9jdW1lbnQgKTsgfSApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRpbml0X29uKCBkb2N1bWVudCApO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3cgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQUEsbUJBQUFDLGdCQUFBLEVBQUFDLGNBQUEsTUFBQUMsaUJBQUE7RUFFQSxTQUFBQyxDQUFBLE1BQUFBLENBQUEsR0FBQUYsY0FBQSxFQUFBRSxDQUFBO0lBQ0FDLE1BQUEsQ0FBQUosZ0JBQUEsRUFBQUssT0FBQSxDQUFBSCxpQkFBQSxFQUFBSSxNQUFBLENBQUFKLGlCQUFBO0VBQ0E7RUFDQUUsTUFBQSxDQUFBSixnQkFBQSxFQUFBTyxPQUFBO0lBQUFDLE9BQUE7RUFBQTtBQUNBOztBQ2RBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQUMseUJBQUFDLHlCQUFBO0VBRUEsSUFBQUMsZUFBQTtFQUNBLElBQ0FDLFNBQUEsSUFBQUYseUJBQUEsSUFDQSxNQUFBQSx5QkFBQSxFQUNBO0lBQ0EsSUFBQUcsUUFBQSxHQUFBVCxNQUFBLE9BQUFNLHlCQUFBO0lBQ0EsSUFBQUcsUUFBQSxDQUFBQyxNQUFBO01BQ0FILGVBQUEsR0FBQUksZ0NBQUEsQ0FBQUYsUUFBQSxDQUFBRyxHQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUFMLGVBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBTSxn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
