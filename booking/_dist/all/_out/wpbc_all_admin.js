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
 * Expand Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_max() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('max');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wp-admin').removeClass('wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none');
  jQuery('.wp-admin').addClass('wpbc_page_wrapper_left_max');
}

/**
 * Hide Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_min() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('min');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wp-admin').removeClass('wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none');
  jQuery('.wp-admin').addClass('wpbc_page_wrapper_left_min');
}

/**
 * Colapse Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_compact() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('compact');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wp-admin').removeClass('wpbc_page_wrapper_left_min wpbc_page_wrapper_left_max wpbc_page_wrapper_left_compact wpbc_page_wrapper_left_none');
  jQuery('.wp-admin').addClass('wpbc_page_wrapper_left_compact');
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
 * Expand Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_max() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min_right max_right compact_right none_right');
  jQuery('.wpbc_settings_page_wrapper').addClass('max_right');
  jQuery('.wpbc_ui__top_nav__btn_open_right_vertical_nav').addClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_right_vertical_nav').removeClass('wpbc_ui__hide');
}

/**
 * Hide Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_min() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min_right max_right compact_right none_right');
  jQuery('.wpbc_settings_page_wrapper').addClass('min_right');
  jQuery('.wpbc_ui__top_nav__btn_open_right_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_right_vertical_nav').addClass('wpbc_ui__hide');
}

/**
 * Colapse Vertical Right Bar.
 */
function wpbc_admin_ui__sidebar_right__do_compact() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min_right max_right compact_right none_right');
  jQuery('.wpbc_settings_page_wrapper').addClass('compact_right');
  jQuery('.wpbc_ui__top_nav__btn_open_right_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_right_vertical_nav').addClass('wpbc_ui__hide');
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
}

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
  wpbc_admin_ui__do_expand_section();
  setTimeout('wpbc_admin_ui__do_expand_section', 10);
});
jQuery(document).ready(function () {
  wpbc_admin_ui__do_expand_section();
  setTimeout('wpbc_admin_ui__do_expand_section', 150);
});

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
        fields_selector: '.group__fields',
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
      const panel = group.querySelector(this.opts.fields_selector);
      if (header) {
        // Header is a real <button>, role is harmless here.
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', is_open ? 'true' : 'false');

        // Link header to panel by id if available.
        if (panel) {
          if (!panel.id) {
            panel.id = this._generate_id('wpbc_collapsible_panel');
          }
          if (!header.hasAttribute('aria-controls')) {
            header.setAttribute('aria-controls', panel.id);
          }
        }
      }
      if (panel) {
        panel.hidden = !is_open;
        panel.setAttribute('aria-hidden', is_open ? 'false' : 'true');
        // Optional landmark:
        // panel.setAttribute('role', 'region');
        // panel.setAttribute('aria-labelledby', header.id || (header.id = this._generate_id('wpbc_collapsible_header')));
      }
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX2Rpc3QvYWxsL19vdXQvd3BiY19hbGxfYWRtaW4uanMiLCJuYW1lcyI6WyJ3cGJjX2JsaW5rX2VsZW1lbnQiLCJlbGVtZW50X3RvX2JsaW5rIiwiaG93X21hbnlfdGltZXMiLCJob3dfbG9uZ190b19ibGluayIsImkiLCJqUXVlcnkiLCJmYWRlT3V0IiwiZmFkZUluIiwiYW5pbWF0ZSIsIm9wYWNpdHkiLCJ3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4iLCJidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkIiwicHJldmlvc19jbGFzc2VzIiwidW5kZWZpbmVkIiwiakVsZW1lbnQiLCJsZW5ndGgiLCJ3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbiIsImdldCIsIndwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24iLCJ0aGlzX2J1dHRvbiIsImpCdXR0b24iLCJqSWNvbiIsImZpbmQiLCJhdHRyIiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsInByZXZpb3VzX29uY2xpY2siLCJ3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uIiwiX3RoaXMiLCJpcyIsInBhcmVudHMiLCJyZW1vdmVBdHRyIiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrIiwiaGFzQ2xhc3MiLCJqX3JhZGlvIiwicHJvcCIsInRyaWdnZXIiLCJ3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUiLCJ3cGJjX2NoZWNrX2J1dHRvbnNfbWF4X21pbl9pbl9mdWxsX3NjcmVlbl9tb2RlIiwiZG9jdW1lbnQiLCJyZWFkeSIsIndwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiIsIiQiLCJjaGVja3MiLCJmaXJzdCIsImxhc3QiLCJjaGVja2VkIiwic2xpY2VkIiwibGFzdENsaWNrZWQiLCJvbiIsImUiLCJzaGlmdEtleSIsImNsb3Nlc3QiLCJmaWx0ZXIiLCJpbmRleCIsInNsaWNlIiwidW5jaGVja2VkIiwibm90IiwiY2hpbGRyZW4iLCJldmVudCIsIiR0aGlzIiwiJHRhYmxlIiwiY29udHJvbENoZWNrZWQiLCJ0b2dnbGUiLCJkYXRhIiwiZ2V0U2VsZWN0aW9uIiwicmVtb3ZlQWxsUmFuZ2VzIiwid3BiY19zaG93X2hpZGVfYWN0aW9uX2J1dHRvbnNfZm9yX3NlbGVjdGVkX2Jvb2tpbmdzIiwid3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkIiwiY2hlY2tib3hlcyIsInNlbGVjdGVkX2lkIiwiZWFjaCIsImtleSIsImNoZWNrYm94IiwiZWxlbWVudF9pZCIsIndwYmNfZ2V0X3Jvd19pZF9mcm9tX2VsZW1lbnQiLCJwdXNoIiwidGhpc19pbmJvdW5kX2VsZW1lbnQiLCJwYXJzZUludCIsInJlcGxhY2UiLCJzZWxlY3RlZF9yb3dzX2FyciIsInNob3ciLCJoaWRlIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19tYXgiLCJ3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21pbiIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fY29tcGFjdCIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9faGlkZSIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fc2hvd19zZWN0aW9uIiwibWVudV90b19zaG93Iiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWF4Iiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fbWluIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9yaWdodF9fZG9fY29tcGFjdCIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2hpZGUiLCJ3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19zaG93X3NlY3Rpb24iLCJ3cGJjX3VybF9nZXRfYW5jaG9yc19hcnIiLCJoYXNoZXMiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsImhhc2giLCJoYXNoZXNfYXJyIiwic3BsaXQiLCJyZXN1bHQiLCJoYXNoZXNfYXJyX2xlbmd0aCIsIndwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uIiwic2V0VGltZW91dCIsImFuY2hvcnNfYXJyIiwiYW5jaG9yc19hcnJfbGVuZ3RoIiwib25lX2FuY2hvcl9wcm9wX3ZhbHVlIiwic2VjdGlvbl90b19zaG93Iiwic2VjdGlvbl9pZF90b19zaG93Iiwic2VsZWN0ZWRfdGl0bGUiLCJ0ZXh0IiwiY29udGFpbmVyX3RvX2hpZGVfY2xhc3MiLCJ0YXJnZXRPZmZzZXQiLCJ3cGJjX3Njcm9sbF90byIsInNlY3Rpb25faWRfdGFiIiwic3Vic3RyaW5nIiwidmFsIiwid3BiY19hZG1pbl91aV9fZG9fX2FuY2hvcl9fYW5vdGhlcl9hY3Rpb25zIiwid3BiY19hZG1pbl91aV9faXNfaW5fbW9iaWxlX3NjcmVlbl9zaXplIiwid3BiY19hZG1pbl91aV9faXNfaW5fdGhpc19zY3JlZW5fc2l6ZSIsInNpemUiLCJzY3JlZW4iLCJ3aWR0aCIsIndwYmNfYWRtaW5fdWlfX2RvX19vcGVuX3VybF9fZXhwYW5kX3NlY3Rpb24iLCJ1cmwiLCJzZWN0aW9uX2lkIiwiaHJlZiIsInRoaXNfYW5jaG9yIiwidGhpc19hbmNob3JfcHJvcF92YWx1ZSIsInNlY3Rpb25fYWN0aW9uIiwid3BiY19jb3B5X3RleHRfdG9fY2xpcGJyZF9mcm9tX2VsZW1lbnQiLCJodG1sX2VsZW1lbnRfaWQiLCJjb3B5VGV4dCIsImdldEVsZW1lbnRCeUlkIiwic2VsZWN0Iiwic2V0U2VsZWN0aW9uUmFuZ2UiLCJpc19jb3BpZWQiLCJ3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkIiwidmFsdWUiLCJjb25zb2xlIiwiZXJyb3IiLCJuYXZpZ2F0b3IiLCJjbGlwYm9hcmQiLCJ3cGJjX2ZhbGxiYWNrX2NvcHlfdGV4dF90b19jbGlwYnJkIiwid3JpdGVUZXh0IiwidGhlbiIsImVyciIsImNvbnRhaW5lciIsImNyZWF0ZUVsZW1lbnQiLCJpbm5lckhUTUwiLCJzdHlsZSIsInBvc2l0aW9uIiwicG9pbnRlckV2ZW50cyIsImFjdGl2ZVNoZWV0cyIsIkFycmF5IiwicHJvdG90eXBlIiwiY2FsbCIsInN0eWxlU2hlZXRzIiwic2hlZXQiLCJkaXNhYmxlZCIsImJvZHkiLCJhcHBlbmRDaGlsZCIsInJhbmdlIiwiY3JlYXRlUmFuZ2UiLCJzZWxlY3ROb2RlIiwiYWRkUmFuZ2UiLCJleGVjQ29tbWFuZCIsImFjdGl2ZVNoZWV0c19sZW5ndGgiLCJyZW1vdmVDaGlsZCIsInciLCJkIiwiV1BCQ19Db2xsYXBzaWJsZV9Hcm91cHMiLCJjb25zdHJ1Y3RvciIsInJvb3RfZWwiLCJvcHRzIiwicm9vdCIsInF1ZXJ5U2VsZWN0b3IiLCJPYmplY3QiLCJhc3NpZ24iLCJncm91cF9zZWxlY3RvciIsImhlYWRlcl9zZWxlY3RvciIsImZpZWxkc19zZWxlY3RvciIsIm9wZW5fY2xhc3MiLCJleGNsdXNpdmUiLCJfb25fY2xpY2siLCJiaW5kIiwiX29uX2tleWRvd24iLCJfZ3JvdXBzIiwiX29ic2VydmVyIiwiaW5pdCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJhZGRFdmVudExpc3RlbmVyIiwiTXV0YXRpb25PYnNlcnZlciIsInJlZnJlc2giLCJvYnNlcnZlIiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsIl9zeW5jX2FsbF9hcmlhIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJkaXNjb25uZWN0IiwiaXNfZXhjbHVzaXZlIiwiY2xhc3NMaXN0IiwiY29udGFpbnMiLCJtYXRjaGVzIiwiaXNfb3BlbiIsImdyb3VwIiwiZXhwYW5kIiwiZG9fZXhjbHVzaXZlIiwiZm9yRWFjaCIsImciLCJfc2V0X29wZW4iLCJjb2xsYXBzZSIsIm9wZW5fYnlfaW5kZXgiLCJvcGVuX2J5X2hlYWRpbmciLCJ0IiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJtYXRjaCIsImgiLCJ0ZXh0Q29udGVudCIsImluZGV4T2YiLCJldiIsImJ0biIsInRhcmdldCIsInByZXZlbnREZWZhdWx0Iiwic3RvcFByb3BhZ2F0aW9uIiwiaGVhZGVycyIsIm1hcCIsIkJvb2xlYW4iLCJpZHgiLCJuZXh0X2lkeCIsIk1hdGgiLCJtaW4iLCJtYXgiLCJmb2N1cyIsIl9zeW5jX2dyb3VwX2FyaWEiLCJoZWFkZXIiLCJwYW5lbCIsInNldEF0dHJpYnV0ZSIsImlkIiwiX2dlbmVyYXRlX2lkIiwiaGFzQXR0cmlidXRlIiwiaGlkZGVuIiwib3BlbiIsImFjdGl2ZUVsZW1lbnQiLCJldl9uYW1lIiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiYnViYmxlcyIsImRldGFpbCIsImluc3RhbmNlIiwicHJlZml4Iiwid3BiY19jb2xsYXBzaWJsZV9fYXV0b19pbml0IiwiUk9PVCIsIm5vZGVzIiwibiIsInBhcmVudEVsZW1lbnQiLCJub2RlIiwiX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlIiwiV1BCQ19Db2xsYXBzaWJsZV9BdXRvSW5pdCIsInJlYWR5U3RhdGUiLCJvbmNlIl0sInNvdXJjZXMiOlsidWlfZWxlbWVudHMuanMiLCJ1aV9sb2FkaW5nX3NwaW4uanMiLCJ1aV9yYWRpb19jb250YWluZXIuanMiLCJ1aV9mdWxsX3NjcmVlbl9tb2RlLmpzIiwiZ21haWxfY2hlY2tib3hfc2VsZWN0aW9uLmpzIiwiYm9va2luZ3NfY2hlY2tib3hfc2VsZWN0aW9uLmpzIiwidWlfc2lkZWJhcl9sZWZ0X19hY3Rpb25zLmpzIiwiY29weV90ZXh0X3RvX2NsaXBicmQuanMiLCJjb2xsYXBzaWJsZV9ncm91cHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXHJcbi8qKlxyXG4gKiBCbGluayBzcGVjaWZpYyBIVE1MIGVsZW1lbnQgdG8gc2V0IGF0dGVudGlvbiB0byB0aGlzIGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbGVtZW50X3RvX2JsaW5rXHRcdCAgLSBjbGFzcyBvciBpZCBvZiBlbGVtZW50OiAnLndwYmNfd2lkZ2V0X2F2YWlsYWJsZV91bmF2YWlsYWJsZSdcclxuICogQHBhcmFtIHtpbnR9IGhvd19tYW55X3RpbWVzXHRcdFx0ICAtIDRcclxuICogQHBhcmFtIHtpbnR9IGhvd19sb25nX3RvX2JsaW5rXHRcdCAgLSAzNTBcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmxpbmtfZWxlbWVudCggZWxlbWVudF90b19ibGluaywgaG93X21hbnlfdGltZXMgPSA0LCBob3dfbG9uZ190b19ibGluayA9IDM1MCApe1xyXG5cclxuXHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBob3dfbWFueV90aW1lczsgaSsrICl7XHJcblx0XHRqUXVlcnkoIGVsZW1lbnRfdG9fYmxpbmsgKS5mYWRlT3V0KCBob3dfbG9uZ190b19ibGluayApLmZhZGVJbiggaG93X2xvbmdfdG9fYmxpbmsgKTtcclxuXHR9XHJcbiAgICBqUXVlcnkoIGVsZW1lbnRfdG9fYmxpbmsgKS5hbmltYXRlKCB7b3BhY2l0eTogMX0sIDUwMCApO1xyXG59XHJcbiIsIi8qKlxyXG4gKiAgIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIEJ1dHRvbnMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBzcGluIGljb24gZnJvbSAgYnV0dG9uIGFuZCBFbmFibGUgdGhpcyBidXR0b24uXHJcbiAqXHJcbiAqIEBwYXJhbSBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkXHRcdC0gSFRNTCBJRCBhdHRyaWJ1dGUgb2YgdGhpcyBidXR0b25cclxuICogQHJldHVybiBzdHJpbmdcdFx0XHRcdFx0XHQtIENTUyBjbGFzc2VzIHRoYXQgd2FzIHByZXZpb3VzbHkgaW4gYnV0dG9uIGljb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYnV0dG9uX19yZW1vdmVfc3BpbihidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkKSB7XHJcblxyXG5cdHZhciBwcmV2aW9zX2NsYXNzZXMgPSAnJztcclxuXHRpZiAoXHJcblx0XHQodW5kZWZpbmVkICE9IGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQpXHJcblx0XHQmJiAoJycgIT0gYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZClcclxuXHQpIHtcclxuXHRcdHZhciBqRWxlbWVudCA9IGpRdWVyeSggJyMnICsgYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZCApO1xyXG5cdFx0aWYgKCBqRWxlbWVudC5sZW5ndGggKSB7XHJcblx0XHRcdHByZXZpb3NfY2xhc3NlcyA9IHdwYmNfYnV0dG9uX2Rpc2FibGVfbG9hZGluZ19pY29uKCBqRWxlbWVudC5nZXQoIDAgKSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHByZXZpb3NfY2xhc3NlcztcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaG93IExvYWRpbmcgKHJvdGF0aW5nIGFycm93KSBpY29uIGZvciBidXR0b24gdGhhdCBoYXMgYmVlbiBjbGlja2VkXHJcbiAqXHJcbiAqIEBwYXJhbSB0aGlzX2J1dHRvblx0XHQtIHRoaXMgb2JqZWN0IG9mIHNwZWNpZmljIGJ1dHRvblxyXG4gKiBAcmV0dXJuIHN0cmluZ1x0XHRcdC0gQ1NTIGNsYXNzZXMgdGhhdCB3YXMgcHJldmlvdXNseSBpbiBidXR0b24gaWNvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbih0aGlzX2J1dHRvbikge1xyXG5cclxuXHR2YXIgakJ1dHRvbiAgICAgICAgID0galF1ZXJ5KCB0aGlzX2J1dHRvbiApO1xyXG5cdHZhciBqSWNvbiAgICAgICAgICAgPSBqQnV0dG9uLmZpbmQoICdpJyApO1xyXG5cdHZhciBwcmV2aW9zX2NsYXNzZXMgPSBqSWNvbi5hdHRyKCAnY2xhc3MnICk7XHJcblxyXG5cdGpJY29uLnJlbW92ZUNsYXNzKCkuYWRkQ2xhc3MoICdtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluJyApO1x0Ly8gU2V0IFJvdGF0ZSBpY29uLlxyXG5cdC8vIGpJY29uLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUGF1c2UgYW5pbWF0aW9uLlxyXG5cdC8vIGpJY29uLmFkZENsYXNzKCAnd3BiY191aV9yZWQnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFNldCBpY29uIGNvbG9yIHJlZC5cclxuXHJcblx0akljb24uYXR0ciggJ3dwYmNfcHJldmlvdXNfY2xhc3MnLCBwcmV2aW9zX2NsYXNzZXMgKVxyXG5cclxuXHRqQnV0dG9uLmFkZENsYXNzKCAnZGlzYWJsZWQnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGlzYWJsZSBidXR0b25cclxuXHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYXR0ciBpbnN0ZWFkIG9mIHByb3AsIGJlY2F1c2UgZm9yIEEgZWxlbWVudHMsICBhdHRyaWJ1dGUgJ2Rpc2FibGVkJyBkbyAgbm90IGFkZGVkIHdpdGggakJ1dHRvbi5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTsuXHJcblxyXG5cdGpCdXR0b24uYXR0ciggJ3dwYmNfcHJldmlvdXNfb25jbGljaycsIGpCdXR0b24uYXR0ciggJ29uY2xpY2snICkgKTtcdFx0Ly8gU2F2ZSB0aGlzIHZhbHVlLlxyXG5cdGpCdXR0b24uYXR0ciggJ29uY2xpY2snLCAnJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBEaXNhYmxlIGFjdGlvbnMgXCJvbiBjbGlja1wiLlxyXG5cclxuXHRyZXR1cm4gcHJldmlvc19jbGFzc2VzO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEhpZGUgTG9hZGluZyAocm90YXRpbmcgYXJyb3cpIGljb24gZm9yIGJ1dHRvbiB0aGF0IHdhcyBjbGlja2VkIGFuZCBzaG93IHByZXZpb3VzIGljb24gYW5kIGVuYWJsZSBidXR0b25cclxuICpcclxuICogQHBhcmFtIHRoaXNfYnV0dG9uXHRcdC0gdGhpcyBvYmplY3Qgb2Ygc3BlY2lmaWMgYnV0dG9uXHJcbiAqIEByZXR1cm4gc3RyaW5nXHRcdFx0LSBDU1MgY2xhc3NlcyB0aGF0IHdhcyBwcmV2aW91c2x5IGluIGJ1dHRvbiBpY29uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbih0aGlzX2J1dHRvbikge1xyXG5cclxuXHR2YXIgakJ1dHRvbiA9IGpRdWVyeSggdGhpc19idXR0b24gKTtcclxuXHR2YXIgakljb24gICA9IGpCdXR0b24uZmluZCggJ2knICk7XHJcblxyXG5cdHZhciBwcmV2aW9zX2NsYXNzZXMgPSBqSWNvbi5hdHRyKCAnd3BiY19wcmV2aW91c19jbGFzcycgKTtcclxuXHRpZiAoXHJcblx0XHQodW5kZWZpbmVkICE9IHByZXZpb3NfY2xhc3NlcylcclxuXHRcdCYmICgnJyAhPSBwcmV2aW9zX2NsYXNzZXMpXHJcblx0KSB7XHJcblx0XHRqSWNvbi5yZW1vdmVDbGFzcygpLmFkZENsYXNzKCBwcmV2aW9zX2NsYXNzZXMgKTtcclxuXHR9XHJcblxyXG5cdGpCdXR0b24ucmVtb3ZlQ2xhc3MoICdkaXNhYmxlZCcgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZW1vdmUgRGlzYWJsZSBidXR0b24uXHJcblxyXG5cdHZhciBwcmV2aW91c19vbmNsaWNrID0gakJ1dHRvbi5hdHRyKCAnd3BiY19wcmV2aW91c19vbmNsaWNrJyApXHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBwcmV2aW91c19vbmNsaWNrKVxyXG5cdFx0JiYgKCcnICE9IHByZXZpb3VzX29uY2xpY2spXHJcblx0KSB7XHJcblx0XHRqQnV0dG9uLmF0dHIoICdvbmNsaWNrJywgcHJldmlvdXNfb25jbGljayApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHByZXZpb3NfY2xhc3NlcztcclxufVxyXG4iLCIvKipcclxuICogT24gc2VsZWN0aW9uICBvZiByYWRpbyBidXR0b24sIGFkanVzdCBhdHRyaWJ1dGVzIG9mIHJhZGlvIGNvbnRhaW5lclxyXG4gKlxyXG4gKiBAcGFyYW0gX3RoaXNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9zZWxlY3Rpb24oX3RoaXMpIHtcclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfdWlfcmFkaW9fc2VjdGlvbicgKS5maW5kKCAnLndwYmNfdWlfcmFkaW9fY29udGFpbmVyJyApLnJlbW92ZUF0dHIoICdkYXRhLXNlbGVjdGVkJyApO1xyXG5cdFx0alF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY191aV9yYWRpb19jb250YWluZXI6bm90KC5kaXNhYmxlZCknICkuYXR0ciggJ2RhdGEtc2VsZWN0ZWQnLCB0cnVlICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIGpRdWVyeSggX3RoaXMgKS5pcyggJzpkaXNhYmxlZCcgKSApIHtcclxuXHRcdGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfdWlfcmFkaW9fY29udGFpbmVyJyApLmFkZENsYXNzKCAnZGlzYWJsZWQnICk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogT24gY2xpY2sgb24gUmFkaW8gQ29udGFpbmVyLCB3ZSB3aWxsICBzZWxlY3QgIHRoZSAgcmFkaW8gYnV0dG9uICAgIGFuZCB0aGVuIGFkanVzdCBhdHRyaWJ1dGVzIG9mIHJhZGlvIGNvbnRhaW5lclxyXG4gKlxyXG4gKiBAcGFyYW0gX3RoaXNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9jbGljayhfdGhpcykge1xyXG5cclxuXHRpZiAoIGpRdWVyeSggX3RoaXMgKS5oYXNDbGFzcyggJ2Rpc2FibGVkJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyIGpfcmFkaW8gPSBqUXVlcnkoIF90aGlzICkuZmluZCggJ2lucHV0W3R5cGU9cmFkaW9dOm5vdCgud3BiYy1mb3JtLXJhZGlvLWludGVybmFsKScgKTtcclxuXHRpZiAoIGpfcmFkaW8ubGVuZ3RoICkge1xyXG5cdFx0al9yYWRpby5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdH1cclxuXHJcbn0iLCJcInVzZSBzdHJpY3RcIjtcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEZ1bGwgU2NyZWVuICAtICBzdXBwb3J0IGZ1bmN0aW9ucyAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIEZ1bGwgIHNjcmVlbiBtb2RlLCAgYnkgIHJlbW92aW5nIHRvcCB0YWJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpe1xyXG5cdGlmICggalF1ZXJ5KCAnYm9keScgKS5oYXNDbGFzcyggJ3dwYmNfYWRtaW5fZnVsbF9zY3JlZW4nICkgKSB7XHJcblx0XHRqUXVlcnkoICdodG1sJyApLnJlbW92ZUNsYXNzKCAnd3AtdG9vbGJhcicgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCcgKS5hZGRDbGFzcyggJ3dwLXRvb2xiYXInICk7XHJcblx0fVxyXG5cdHdwYmNfY2hlY2tfYnV0dG9uc19tYXhfbWluX2luX2Z1bGxfc2NyZWVuX21vZGUoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19jaGVja19idXR0b25zX21heF9taW5faW5fZnVsbF9zY3JlZW5fbW9kZSgpIHtcclxuXHRpZiAoIGpRdWVyeSggJ2JvZHknICkuaGFzQ2xhc3MoICd3cGJjX2FkbWluX2Z1bGxfc2NyZWVuJyApICkge1xyXG5cdFx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9mdWxsX3NjcmVlbicgICApLmFkZENsYXNzKCAgICAnd3BiY191aV9faGlkZScgKTtcclxuXHRcdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fbm9ybWFsX3NjcmVlbicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fZnVsbF9zY3JlZW4nICAgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0XHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX25vcm1hbF9zY3JlZW4nICkuYWRkQ2xhc3MoICAgICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdH1cclxufVxyXG5cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7XHJcblx0d3BiY19jaGVja19mdWxsX3NjcmVlbl9tb2RlKCk7XHJcbn0gKTsiLCIvKipcclxuICogQ2hlY2tib3ggU2VsZWN0aW9uIGZ1bmN0aW9ucyBmb3IgTGlzdGluZy5cclxuICovXHJcblxyXG4vKipcclxuICogU2VsZWN0aW9ucyBvZiBzZXZlcmFsICBjaGVja2JveGVzIGxpa2UgaW4gZ01haWwgd2l0aCBzaGlmdCA6KVxyXG4gKiBOZWVkIHRvICBoYXZlIHRoaXMgc3RydWN0dXJlOlxyXG4gKiAud3BiY19zZWxlY3RhYmxlX3RhYmxlXHJcbiAqICAgICAgLndwYmNfc2VsZWN0YWJsZV9oZWFkXHJcbiAqICAgICAgICAgICAgICAuY2hlY2stY29sdW1uXHJcbiAqICAgICAgICAgICAgICAgICAgOmNoZWNrYm94XHJcbiAqICAgICAgLndwYmNfc2VsZWN0YWJsZV9ib2R5XHJcbiAqICAgICAgICAgIC53cGJjX3Jvd1xyXG4gKiAgICAgICAgICAgICAgLmNoZWNrLWNvbHVtblxyXG4gKiAgICAgICAgICAgICAgICAgIDpjaGVja2JveFxyXG4gKiAgICAgIC53cGJjX3NlbGVjdGFibGVfZm9vdFxyXG4gKiAgICAgICAgICAgICAgLmNoZWNrLWNvbHVtblxyXG4gKiAgICAgICAgICAgICAgICAgIDpjaGVja2JveFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kZWZpbmVfZ21haWxfY2hlY2tib3hfc2VsZWN0aW9uKCAkICl7XHJcblxyXG5cdHZhciBjaGVja3MsIGZpcnN0LCBsYXN0LCBjaGVja2VkLCBzbGljZWQsIGxhc3RDbGlja2VkID0gZmFsc2U7XHJcblxyXG5cdC8vIENoZWNrIGFsbCBjaGVja2JveGVzLlxyXG5cdCQoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJy5jaGVjay1jb2x1bW4nICkuZmluZCggJzpjaGVja2JveCcgKS5vbihcclxuXHRcdCdjbGljaycsXHJcblx0XHRmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRpZiAoICd1bmRlZmluZWQnID09IGUuc2hpZnRLZXkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBlLnNoaWZ0S2V5ICkge1xyXG5cdFx0XHRcdGlmICggISBsYXN0Q2xpY2tlZCApIHtcclxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjaGVja3MgID0gJCggbGFzdENsaWNrZWQgKS5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICc6Y2hlY2tib3gnICkuZmlsdGVyKCAnOnZpc2libGU6ZW5hYmxlZCcgKTtcclxuXHRcdFx0XHRmaXJzdCAgID0gY2hlY2tzLmluZGV4KCBsYXN0Q2xpY2tlZCApO1xyXG5cdFx0XHRcdGxhc3QgICAgPSBjaGVja3MuaW5kZXgoIHRoaXMgKTtcclxuXHRcdFx0XHRjaGVja2VkID0gJCggdGhpcyApLnByb3AoICdjaGVja2VkJyApO1xyXG5cdFx0XHRcdGlmICggMCA8IGZpcnN0ICYmIDAgPCBsYXN0ICYmIGZpcnN0ICE9IGxhc3QgKSB7XHJcblx0XHRcdFx0XHRzbGljZWQgPSAobGFzdCA+IGZpcnN0KSA/IGNoZWNrcy5zbGljZSggZmlyc3QsIGxhc3QgKSA6IGNoZWNrcy5zbGljZSggbGFzdCwgZmlyc3QgKTtcclxuXHRcdFx0XHRcdHNsaWNlZC5wcm9wKFxyXG5cdFx0XHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfcm93JyApLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gY2hlY2tlZDtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQpLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdGxhc3RDbGlja2VkID0gdGhpcztcclxuXHJcblx0XHRcdC8vIHRvZ2dsZSBcImNoZWNrIGFsbFwiIGNoZWNrYm94ZXMuXHJcblx0XHRcdHZhciB1bmNoZWNrZWQgPSAkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnOmNoZWNrYm94JyApLmZpbHRlciggJzp2aXNpYmxlOmVuYWJsZWQnICkubm90KCAnOmNoZWNrZWQnICk7XHJcblx0XHRcdCQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV90YWJsZScgKS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfaGVhZCwgLndwYmNfc2VsZWN0YWJsZV9mb290JyApLmZpbmQoICc6Y2hlY2tib3gnICkucHJvcChcclxuXHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0cmV0dXJuICgwID09PSB1bmNoZWNrZWQubGVuZ3RoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cdC8vIEhlYWQgfHwgRm9vdCBjbGlja2luZyB0byAgc2VsZWN0IC8gZGVzZWxlY3QgQUxMLlxyXG5cdCQoICcud3BiY19zZWxlY3RhYmxlX2hlYWQsIC53cGJjX3NlbGVjdGFibGVfZm9vdCcgKS5maW5kKCAnLmNoZWNrLWNvbHVtbiA6Y2hlY2tib3gnICkub24oXHJcblx0XHQnY2xpY2snLFxyXG5cdFx0ZnVuY3Rpb24gKGV2ZW50KSB7XHJcblx0XHRcdHZhciAkdGhpcyAgICAgICAgICA9ICQoIHRoaXMgKSxcclxuXHRcdFx0XHQkdGFibGUgICAgICAgICA9ICR0aGlzLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX3RhYmxlJyApLFxyXG5cdFx0XHRcdGNvbnRyb2xDaGVja2VkID0gJHRoaXMucHJvcCggJ2NoZWNrZWQnICksXHJcblx0XHRcdFx0dG9nZ2xlICAgICAgICAgPSBldmVudC5zaGlmdEtleSB8fCAkdGhpcy5kYXRhKCAnd3AtdG9nZ2xlJyApO1xyXG5cclxuXHRcdFx0JHRhYmxlLmNoaWxkcmVuKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbHRlciggJzp2aXNpYmxlJyApXHJcblx0XHRcdFx0LmZpbmQoICcuY2hlY2stY29sdW1uJyApLmZpbmQoICc6Y2hlY2tib3gnIClcclxuXHRcdFx0XHQucHJvcChcclxuXHRcdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0aWYgKCAkKCB0aGlzICkuaXMoICc6aGlkZGVuLDpkaXNhYmxlZCcgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0aWYgKCB0b2dnbGUgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuICEgJCggdGhpcyApLnByb3AoICdjaGVja2VkJyApO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCBjb250cm9sQ2hlY2tlZCApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cclxuXHRcdFx0JHRhYmxlLmNoaWxkcmVuKCAnLndwYmNfc2VsZWN0YWJsZV9oZWFkLCAgLndwYmNfc2VsZWN0YWJsZV9mb290JyApLmZpbHRlciggJzp2aXNpYmxlJyApXHJcblx0XHRcdFx0LmZpbmQoICcuY2hlY2stY29sdW1uJyApLmZpbmQoICc6Y2hlY2tib3gnIClcclxuXHRcdFx0XHQucHJvcChcclxuXHRcdFx0XHRcdCdjaGVja2VkJyxcclxuXHRcdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0aWYgKCB0b2dnbGUgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCBjb250cm9sQ2hlY2tlZCApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0KTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHJcblx0Ly8gVmlzdWFsbHkgIHNob3cgc2VsZWN0ZWQgYm9yZGVyLlxyXG5cdCQoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJy5jaGVjay1jb2x1bW4gOmNoZWNrYm94JyApLm9uKFxyXG5cdFx0J2NoYW5nZScsXHJcblx0XHRmdW5jdGlvbiAoZXZlbnQpIHtcclxuXHRcdFx0aWYgKCBqUXVlcnkoIHRoaXMgKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdGpRdWVyeSggdGhpcyApLmNsb3Nlc3QoICcud3BiY19saXN0X3JvdycgKS5hZGRDbGFzcyggJ3Jvd19zZWxlY3RlZF9jb2xvcicgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRqUXVlcnkoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfbGlzdF9yb3cnICkucmVtb3ZlQ2xhc3MoICdyb3dfc2VsZWN0ZWRfY29sb3InICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIERpc2FibGUgdGV4dCBzZWxlY3Rpb24gd2hpbGUgcHJlc3NpbmcgJ3NoaWZ0Jy5cclxuXHRcdFx0ZG9jdW1lbnQuZ2V0U2VsZWN0aW9uKCkucmVtb3ZlQWxsUmFuZ2VzKCk7XHJcblxyXG5cdFx0XHQvLyBTaG93IG9yIGhpZGUgYnV0dG9ucyBvbiBBY3Rpb25zIHRvb2xiYXIgIGF0ICBCb29raW5nIExpc3RpbmcgIHBhZ2UsICBpZiB3ZSBoYXZlIHNvbWUgc2VsZWN0ZWQgYm9va2luZ3MuXHJcblx0XHRcdHdwYmNfc2hvd19oaWRlX2FjdGlvbl9idXR0b25zX2Zvcl9zZWxlY3RlZF9ib29raW5ncygpO1xyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cdHdwYmNfc2hvd19oaWRlX2FjdGlvbl9idXR0b25zX2Zvcl9zZWxlY3RlZF9ib29raW5ncygpO1xyXG59XHJcbiIsIlxyXG4vKipcclxuICogR2V0IElEIGFycmF5ICBvZiBzZWxlY3RlZCBlbGVtZW50c1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCkge1xyXG5cclxuXHR2YXIgJHRhYmxlICAgICAgPSBqUXVlcnkoICcud3BiY19fd3JhcF9fYm9va2luZ19saXN0aW5nIC53cGJjX3NlbGVjdGFibGVfdGFibGUnICk7XHJcblx0dmFyIGNoZWNrYm94ZXMgID0gJHRhYmxlLmNoaWxkcmVuKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbHRlciggJzp2aXNpYmxlJyApLmZpbmQoICcuY2hlY2stY29sdW1uJyApLmZpbmQoICc6Y2hlY2tib3gnICk7XHJcblx0dmFyIHNlbGVjdGVkX2lkID0gW107XHJcblxyXG5cdGpRdWVyeS5lYWNoKFxyXG5cdFx0Y2hlY2tib3hlcyxcclxuXHRcdGZ1bmN0aW9uIChrZXksIGNoZWNrYm94KSB7XHJcblx0XHRcdGlmICggalF1ZXJ5KCBjaGVja2JveCApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0dmFyIGVsZW1lbnRfaWQgPSB3cGJjX2dldF9yb3dfaWRfZnJvbV9lbGVtZW50KCBjaGVja2JveCApO1xyXG5cdFx0XHRcdHNlbGVjdGVkX2lkLnB1c2goIGVsZW1lbnRfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdCk7XHJcblxyXG5cdHJldHVybiBzZWxlY3RlZF9pZDtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBHZXQgSUQgb2Ygcm93LCAgYmFzZWQgb24gY2xjaWtlZCBlbGVtZW50XHJcbiAqXHJcbiAqIEBwYXJhbSB0aGlzX2luYm91bmRfZWxlbWVudCAgLSB1c3VzbGx5ICB0aGlzXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2dldF9yb3dfaWRfZnJvbV9lbGVtZW50KHRoaXNfaW5ib3VuZF9lbGVtZW50KSB7XHJcblxyXG5cdHZhciBlbGVtZW50X2lkID0galF1ZXJ5KCB0aGlzX2luYm91bmRfZWxlbWVudCApLmNsb3Nlc3QoICcud3BiY19saXN0aW5nX3VzdWFsX3JvdycgKS5hdHRyKCAnaWQnICk7XHJcblxyXG5cdGVsZW1lbnRfaWQgPSBwYXJzZUludCggZWxlbWVudF9pZC5yZXBsYWNlKCAncm93X2lkXycsICcnICkgKTtcclxuXHJcblx0cmV0dXJuIGVsZW1lbnRfaWQ7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogPT0gQm9va2luZyBMaXN0aW5nID09IFNob3cgb3IgaGlkZSBidXR0b25zIG9uIEFjdGlvbnMgdG9vbGJhciAgYXQgICAgcGFnZSwgIGlmIHdlIGhhdmUgc29tZSBzZWxlY3RlZCBib29raW5ncy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfc2hvd19oaWRlX2FjdGlvbl9idXR0b25zX2Zvcl9zZWxlY3RlZF9ib29raW5ncygpe1xyXG5cclxuXHR2YXIgc2VsZWN0ZWRfcm93c19hcnIgPSB3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQoKTtcclxuXHJcblx0aWYgKCBzZWxlY3RlZF9yb3dzX2Fyci5sZW5ndGggPiAwICkge1xyXG5cdFx0alF1ZXJ5KCAnLmhpZGVfYnV0dG9uX2lmX25vX3NlbGVjdGlvbicgKS5zaG93KCk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJy5oaWRlX2J1dHRvbl9pZl9ub19zZWxlY3Rpb24nICkuaGlkZSgpO1xyXG5cdH1cclxufSIsIlwidXNlIHN0cmljdFwiO1xyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gTGVmdCBCYXIgIC0gIGV4cGFuZCAvIGNvbGFwc2UgZnVuY3Rpb25zICAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogRXhwYW5kIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19tYXgoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbWF4JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLnJlbW92ZUNsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4gd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9tYXggd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9jb21wYWN0IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkuYWRkQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21heCcgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21pbigpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW4gbWF4IGNvbXBhY3Qgbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdtaW4nICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX2xlZnRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkucmVtb3ZlQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21pbiB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21heCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X2NvbXBhY3Qgd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9ub25lJyApO1xyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5hZGRDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbWluJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29sYXBzZSBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fY29tcGFjdCgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW4gbWF4IGNvbXBhY3Qgbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdjb21wYWN0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHJcblx0alF1ZXJ5KCAnLndwLWFkbWluJyApLnJlbW92ZUNsYXNzKCAnd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9taW4gd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9tYXggd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9jb21wYWN0IHdwYmNfcGFnZV93cmFwcGVyX2xlZnRfbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkuYWRkQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X2NvbXBhY3QnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21wbGV0ZWx5IEhpZGUgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX2hpZGUoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0Ly8gSGlkZSB0b3AgXCJNZW51XCIgYnV0dG9uIHdpdGggZGl2aWRlci5cclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfbGVmdF92ZXJ0aWNhbF9uYXYsLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X2xlZnRfdmVydGljYWxfbmF2X2RpdmlkZXInICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cclxuXHRqUXVlcnkoICcud3AtYWRtaW4nICkucmVtb3ZlQ2xhc3MoICd3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21pbiB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X21heCB3cGJjX3BhZ2Vfd3JhcHBlcl9sZWZ0X2NvbXBhY3Qgd3BiY19wYWdlX3dyYXBwZXJfbGVmdF9ub25lJyApO1xyXG5cdGpRdWVyeSggJy53cC1hZG1pbicgKS5hZGRDbGFzcyggJ3dwYmNfcGFnZV93cmFwcGVyX2xlZnRfbm9uZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFjdGlvbiBvbiBjbGljayBcIkdvIEJhY2tcIiAtIHNob3cgcm9vdCBtZW51XHJcbiAqIG9yIHNvbWUgb3RoZXIgc2VjdGlvbiBpbiBsZWZ0IHNpZGViYXIuXHJcbiAqXHJcbiAqIEBwYXJhbSBzdHJpbmcgbWVudV90b19zaG93IC0gbWVudSBzbHVnLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zaG93X3NlY3Rpb24oIG1lbnVfdG9fc2hvdyApIHtcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9sZWZ0X2Jhcl9fc2VjdGlvbicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnIClcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9sZWZ0X2Jhcl9fc2VjdGlvbl8nICsgbWVudV90b19zaG93ICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gPT0gUmlnaHQgU2lkZSBCYXIgIC0gIGV4cGFuZCAvIGNvbGFwc2UgZnVuY3Rpb25zICAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogRXhwYW5kIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21heCgpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW5fcmlnaHQgbWF4X3JpZ2h0IGNvbXBhY3RfcmlnaHQgbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdtYXhfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX21pbigpIHtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkucmVtb3ZlQ2xhc3MoICdtaW5fcmlnaHQgbWF4X3JpZ2h0IGNvbXBhY3RfcmlnaHQgbm9uZV9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY19zZXR0aW5nc19wYWdlX3dyYXBwZXInICkuYWRkQ2xhc3MoICdtaW5fcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xhcHNlIFZlcnRpY2FsIFJpZ2h0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfcmlnaHRfX2RvX2NvbXBhY3QoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluX3JpZ2h0IG1heF9yaWdodCBjb21wYWN0X3JpZ2h0IG5vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnY29tcGFjdF9yaWdodCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fcmlnaHRfdmVydGljYWxfbmF2JyApLnJlbW92ZUNsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX2hpZGVfcmlnaHRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbXBsZXRlbHkgSGlkZSBWZXJ0aWNhbCBSaWdodCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19kb19oaWRlKCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbl9yaWdodCBtYXhfcmlnaHQgY29tcGFjdF9yaWdodCBub25lX3JpZ2h0JyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ25vbmVfcmlnaHQnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9vcGVuX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX3JpZ2h0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0Ly8gSGlkZSB0b3AgXCJNZW51XCIgYnV0dG9uIHdpdGggZGl2aWRlci5cclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfcmlnaHRfdmVydGljYWxfbmF2LC53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19yaWdodF92ZXJ0aWNhbF9uYXZfZGl2aWRlcicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBY3Rpb24gb24gY2xpY2sgXCJHbyBCYWNrXCIgLSBzaG93IHJvb3QgbWVudVxyXG4gKiBvciBzb21lIG90aGVyIHNlY3Rpb24gaW4gcmlnaHQgc2lkZWJhci5cclxuICpcclxuICogQHBhcmFtIHN0cmluZyBtZW51X3RvX3Nob3cgLSBtZW51IHNsdWcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX3JpZ2h0X19zaG93X3NlY3Rpb24oIG1lbnVfdG9fc2hvdyApIHtcclxuXHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9yaWdodF9iYXJfX3NlY3Rpb24nICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApXHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX3ZlcnRfcmlnaHRfYmFyX19zZWN0aW9uXycgKyBtZW51X3RvX3Nob3cgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PSBFbmQgUmlnaHQgU2lkZSBCYXIgIHNlY3Rpb24gICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBHZXQgYW5jaG9yKHMpIGFycmF5ICBmcm9tICBVUkwuXHJcbiAqIERvYzogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0xvY2F0aW9uXHJcbiAqXHJcbiAqIEByZXR1cm5zIHsqW119XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3VybF9nZXRfYW5jaG9yc19hcnIoKSB7XHJcblx0dmFyIGhhc2hlcyAgICAgICAgICAgID0gd2luZG93LmxvY2F0aW9uLmhhc2gucmVwbGFjZSggJyUyMycsICcjJyApO1xyXG5cdHZhciBoYXNoZXNfYXJyICAgICAgICA9IGhhc2hlcy5zcGxpdCggJyMnICk7XHJcblx0dmFyIHJlc3VsdCAgICAgICAgICAgID0gW107XHJcblx0dmFyIGhhc2hlc19hcnJfbGVuZ3RoID0gaGFzaGVzX2Fyci5sZW5ndGg7XHJcblxyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGhhc2hlc19hcnJfbGVuZ3RoOyBpKysgKSB7XHJcblx0XHRpZiAoIGhhc2hlc19hcnJbaV0ubGVuZ3RoID4gMCApIHtcclxuXHRcdFx0cmVzdWx0LnB1c2goIGhhc2hlc19hcnJbaV0gKTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEF1dG8gRXhwYW5kIFNldHRpbmdzIHNlY3Rpb24gYmFzZWQgb24gVVJMIGFuY2hvciwgYWZ0ZXIgIHBhZ2UgbG9hZGVkLlxyXG4gKi9cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7IHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCk7IHNldFRpbWVvdXQoICd3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbicsIDEwICk7IH0gKTtcclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKSB7IHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCk7IHNldFRpbWVvdXQoICd3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbicsIDE1MCApOyB9ICk7XHJcblxyXG4vKipcclxuICogRXhwYW5kIHNlY3Rpb24gaW4gIEdlbmVyYWwgU2V0dGluZ3MgcGFnZSBhbmQgc2VsZWN0IE1lbnUgaXRlbS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uKCkge1xyXG5cclxuXHQvLyB3aW5kb3cubG9jYXRpb24uaGFzaCAgPSAjc2VjdGlvbl9pZCAgLyAgZG9jOiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvTG9jYXRpb24gLlxyXG5cdHZhciBhbmNob3JzX2FyciAgICAgICAgPSB3cGJjX3VybF9nZXRfYW5jaG9yc19hcnIoKTtcclxuXHR2YXIgYW5jaG9yc19hcnJfbGVuZ3RoID0gYW5jaG9yc19hcnIubGVuZ3RoO1xyXG5cclxuXHRpZiAoIGFuY2hvcnNfYXJyX2xlbmd0aCA+IDAgKSB7XHJcblx0XHR2YXIgb25lX2FuY2hvcl9wcm9wX3ZhbHVlID0gYW5jaG9yc19hcnJbMF0uc3BsaXQoICdkb19leHBhbmRfXycgKTtcclxuXHRcdGlmICggb25lX2FuY2hvcl9wcm9wX3ZhbHVlLmxlbmd0aCA+IDEgKSB7XHJcblxyXG5cdFx0XHQvLyAnd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX21ldGFib3gnXHJcblx0XHRcdHZhciBzZWN0aW9uX3RvX3Nob3cgICAgPSBvbmVfYW5jaG9yX3Byb3BfdmFsdWVbMV07XHJcblx0XHRcdHZhciBzZWN0aW9uX2lkX3RvX3Nob3cgPSAnIycgKyBzZWN0aW9uX3RvX3Nob3c7XHJcblxyXG5cclxuXHRcdFx0Ly8gLS0gUmVtb3ZlIHNlbGVjdGVkIGJhY2tncm91bmQgaW4gYWxsIGxlZnQgIG1lbnUgIGl0ZW1zIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRqUXVlcnkoICcud3BiY191aV9lbF9fdmVydF9uYXZfaXRlbSAnICkucmVtb3ZlQ2xhc3MoICdhY3RpdmUnICk7XHJcblx0XHRcdC8vIFNldCBsZWZ0IG1lbnUgc2VsZWN0ZWQuXHJcblx0XHRcdGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsnICkuYWRkQ2xhc3MoICdhY3RpdmUnICk7XHJcblx0XHRcdHZhciBzZWxlY3RlZF90aXRsZSA9IGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsgYSAud3BiY191aV9lbF9fdmVydF9uYXZfdGl0bGUgJyApLnRleHQoKTtcclxuXHJcblx0XHRcdC8vIEV4cGFuZCBzZWN0aW9uLCBpZiBpdCBjb2xhcHNlZC5cclxuXHRcdFx0aWYgKCAhIGpRdWVyeSggJy5kb19leHBhbmRfXycgKyBzZWN0aW9uX3RvX3Nob3cgKyAnX2xpbmsnICkucGFyZW50cyggJy53cGJjX3VpX2VsX19sZXZlbF9fZm9sZGVyJyApLmhhc0NsYXNzKCAnZXhwYW5kZWQnICkgKSB7XHJcblx0XHRcdFx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX2xldmVsX19mb2xkZXInICkucmVtb3ZlQ2xhc3MoICdleHBhbmRlZCcgKTtcclxuXHRcdFx0XHRqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rJyApLnBhcmVudHMoICcud3BiY191aV9lbF9fbGV2ZWxfX2ZvbGRlcicgKS5hZGRDbGFzcyggJ2V4cGFuZGVkJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLSBFeHBhbmQgc2VjdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0dmFyIGNvbnRhaW5lcl90b19oaWRlX2NsYXNzID0gJy5wb3N0Ym94JztcclxuXHRcdFx0Ly8gSGlkZSBzZWN0aW9ucyAnLnBvc3Rib3gnIGluIGFkbWluIHBhZ2UgYW5kIHNob3cgc3BlY2lmaWMgb25lLlxyXG5cdFx0XHRqUXVlcnkoICcud3BiY19hZG1pbl9wYWdlICcgKyBjb250YWluZXJfdG9faGlkZV9jbGFzcyApLmhpZGUoKTtcclxuXHRcdFx0alF1ZXJ5KCAnLndwYmNfY29udGFpbmVyX2Fsd2F5c19oaWRlX19vbl9sZWZ0X25hdl9jbGljaycgKS5oaWRlKCk7XHJcblx0XHRcdGpRdWVyeSggc2VjdGlvbl9pZF90b19zaG93ICkuc2hvdygpO1xyXG5cclxuXHRcdFx0Ly8gU2hvdyBhbGwgb3RoZXIgc2VjdGlvbnMsICBpZiBwcm92aWRlZCBpbiBVUkw6IC4uP3BhZ2U9d3BiYy1zZXR0aW5ncyNkb19leHBhbmRfX3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV9tZXRhYm94I3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV91cGdyYWRlX21ldGFib3ggLlxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDE7IGkgPCBhbmNob3JzX2Fycl9sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRqUXVlcnkoICcjJyArIGFuY2hvcnNfYXJyW2ldICkuc2hvdygpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGZhbHNlICkge1xyXG5cdFx0XHRcdHZhciB0YXJnZXRPZmZzZXQgPSB3cGJjX3Njcm9sbF90byggc2VjdGlvbl9pZF90b19zaG93ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIC0tIFNldCBWYWx1ZSB0byBJbnB1dCBhYm91dCBzZWxlY3RlZCBOYXYgZWxlbWVudCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICAgICAgIC8vIEZpeEluOiA5LjguNi4xLlxyXG5cdFx0XHR2YXIgc2VjdGlvbl9pZF90YWIgPSBzZWN0aW9uX2lkX3RvX3Nob3cuc3Vic3RyaW5nKCAwLCBzZWN0aW9uX2lkX3RvX3Nob3cubGVuZ3RoIC0gOCApICsgJ190YWInO1xyXG5cdFx0XHRpZiAoIGNvbnRhaW5lcl90b19oaWRlX2NsYXNzID09IHNlY3Rpb25faWRfdG9fc2hvdyApIHtcclxuXHRcdFx0XHRzZWN0aW9uX2lkX3RhYiA9ICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2FsbF90YWInXHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV9tZXRhYm94LCN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfdXBncmFkZV9tZXRhYm94JyA9PSBzZWN0aW9uX2lkX3RvX3Nob3cgKSB7XHJcblx0XHRcdFx0c2VjdGlvbl9pZF90YWIgPSAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYXBhY2l0eV90YWInXHJcblx0XHRcdH1cclxuXHRcdFx0alF1ZXJ5KCAnI2Zvcm1fdmlzaWJsZV9zZWN0aW9uJyApLnZhbCggc2VjdGlvbl9pZF90YWIgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBMaWtlIGJsaW5raW5nIHNvbWUgZWxlbWVudHMuXHJcblx0XHR3cGJjX2FkbWluX3VpX19kb19fYW5jaG9yX19hbm90aGVyX2FjdGlvbnMoKTtcclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2lzX2luX21vYmlsZV9zY3JlZW5fc2l6ZSgpIHtcclxuXHRyZXR1cm4gd3BiY19hZG1pbl91aV9faXNfaW5fdGhpc19zY3JlZW5fc2l6ZSggNjA1ICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2lzX2luX3RoaXNfc2NyZWVuX3NpemUoc2l6ZSkge1xyXG5cdHJldHVybiAod2luZG93LnNjcmVlbi53aWR0aCA8PSBzaXplKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE9wZW4gc2V0dGluZ3MgcGFnZSAgfCAgRXhwYW5kIHNlY3Rpb24gIHwgIFNlbGVjdCBNZW51IGl0ZW0uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19kb19fb3Blbl91cmxfX2V4cGFuZF9zZWN0aW9uKHVybCwgc2VjdGlvbl9pZCkge1xyXG5cclxuXHQvLyB3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybCArICcmZG9fZXhwYW5kPScgKyBzZWN0aW9uX2lkICsgJyNkb19leHBhbmRfXycgKyBzZWN0aW9uX2lkOyAvLy5cclxuXHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IHVybCArICcjZG9fZXhwYW5kX18nICsgc2VjdGlvbl9pZDtcclxuXHJcblx0aWYgKCB3cGJjX2FkbWluX3VpX19pc19pbl9tb2JpbGVfc2NyZWVuX3NpemUoKSApIHtcclxuXHRcdHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWluKCk7XHJcblx0fVxyXG5cclxuXHR3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIENoZWNrICBmb3IgT3RoZXIgYWN0aW9uczogIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cyBpbiBzZXR0aW5ncyBwYWdlLiBFLmcuIERheXMgc2VsZWN0aW9uICBvciAgY2hhbmdlLW92ZXIgZGF5cy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX19hbmNob3JfX2Fub3RoZXJfYWN0aW9ucygpIHtcclxuXHJcblx0dmFyIGFuY2hvcnNfYXJyICAgICAgICA9IHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpO1xyXG5cdHZhciBhbmNob3JzX2Fycl9sZW5ndGggPSBhbmNob3JzX2Fyci5sZW5ndGg7XHJcblxyXG5cdC8vIE90aGVyIGFjdGlvbnM6ICBMaWtlIGJsaW5raW5nIHNvbWUgZWxlbWVudHMuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgYW5jaG9yc19hcnJfbGVuZ3RoOyBpKysgKSB7XHJcblxyXG5cdFx0dmFyIHRoaXNfYW5jaG9yID0gYW5jaG9yc19hcnJbaV07XHJcblxyXG5cdFx0dmFyIHRoaXNfYW5jaG9yX3Byb3BfdmFsdWUgPSB0aGlzX2FuY2hvci5zcGxpdCggJ2RvX290aGVyX2FjdGlvbnNfXycgKTtcclxuXHJcblx0XHRpZiAoIHRoaXNfYW5jaG9yX3Byb3BfdmFsdWUubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdHZhciBzZWN0aW9uX2FjdGlvbiA9IHRoaXNfYW5jaG9yX3Byb3BfdmFsdWVbMV07XHJcblxyXG5cdFx0XHRzd2l0Y2ggKCBzZWN0aW9uX2FjdGlvbiApIHtcclxuXHJcblx0XHRcdFx0Y2FzZSAnYmxpbmtfZGF5X3NlbGVjdGlvbnMnOlxyXG5cdFx0XHRcdFx0Ly8gd3BiY191aV9zZXR0aW5nc19fcGFuZWxfX2NsaWNrKCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl90YWIgYScsICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX21ldGFib3gnLCAnRGF5cyBTZWxlY3Rpb24nICk7LlxyXG5cdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3R5cGVfb2ZfZGF5X3NlbGVjdGlvbnMnLCA0LCAzNTAgKTtcclxuXHRcdFx0XHRcdFx0d3BiY19zY3JvbGxfdG8oICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfdHlwZV9vZl9kYXlfc2VsZWN0aW9ucycgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19jaGFuZ2Vfb3Zlcl9kYXlzJzpcclxuXHRcdFx0XHRcdC8vIHdwYmNfdWlfc2V0dGluZ3NfX3BhbmVsX19jbGljayggJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfdGFiIGEnLCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl9tZXRhYm94JywgJ0NoYW5nZW92ZXIgRGF5cycgKTsuXHJcblx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfcmFuZ2Vfc2VsZWN0aW9uX3RpbWVfaXNfYWN0aXZlJywgNCwgMzUwICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfc2Nyb2xsX3RvKCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3JhbmdlX3NlbGVjdGlvbl90aW1lX2lzX2FjdGl2ZScgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19jYXB0Y2hhJzpcclxuXHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19pc191c2VfY2FwdGNoYScsIDQsIDM1MCApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX3Njcm9sbF90byggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19pc191c2VfY2FwdGNoYScgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59IiwiLyoqXHJcbiAqIENvcHkgdHh0IHRvIGNsaXBicmQgZnJvbSBUZXh0IGZpZWxkcy5cclxuICpcclxuICogQHBhcmFtIGh0bWxfZWxlbWVudF9pZCAgLSBlLmcuICdkYXRhX2ZpZWxkJ1xyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmRfZnJvbV9lbGVtZW50KCBodG1sX2VsZW1lbnRfaWQgKSB7XHJcblx0Ly8gR2V0IHRoZSB0ZXh0IGZpZWxkLlxyXG5cdHZhciBjb3B5VGV4dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBodG1sX2VsZW1lbnRfaWQgKTtcclxuXHJcblx0Ly8gU2VsZWN0IHRoZSB0ZXh0IGZpZWxkLlxyXG5cdGNvcHlUZXh0LnNlbGVjdCgpO1xyXG5cdGNvcHlUZXh0LnNldFNlbGVjdGlvblJhbmdlKCAwLCA5OTk5OSApOyAvLyBGb3IgbW9iaWxlIGRldmljZXMuXHJcblxyXG5cdC8vIENvcHkgdGhlIHRleHQgaW5zaWRlIHRoZSB0ZXh0IGZpZWxkLlxyXG5cdHZhciBpc19jb3BpZWQgPSB3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkKCBjb3B5VGV4dC52YWx1ZSApO1xyXG5cdGlmICggISBpc19jb3BpZWQgKSB7XHJcblx0XHRjb25zb2xlLmVycm9yKCAnT29wcywgdW5hYmxlIHRvIGNvcHknLCBjb3B5VGV4dC52YWx1ZSApO1xyXG5cdH1cclxuXHRyZXR1cm4gaXNfY29waWVkO1xyXG59XHJcblxyXG4vKipcclxuICogQ29weSB0eHQgdG8gY2xpcGJyZC5cclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkKHRleHQpIHtcclxuXHJcblx0aWYgKCAhIG5hdmlnYXRvci5jbGlwYm9hcmQgKSB7XHJcblx0XHRyZXR1cm4gd3BiY19mYWxsYmFja19jb3B5X3RleHRfdG9fY2xpcGJyZCggdGV4dCApO1xyXG5cdH1cclxuXHJcblx0bmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoIHRleHQgKS50aGVuKFxyXG5cdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyggJ0FzeW5jOiBDb3B5aW5nIHRvIGNsaXBib2FyZCB3YXMgc3VjY2Vzc2Z1bCEnICk7LlxyXG5cdFx0XHRyZXR1cm4gIHRydWU7XHJcblx0XHR9LFxyXG5cdFx0ZnVuY3Rpb24gKGVycikge1xyXG5cdFx0XHQvLyBjb25zb2xlLmVycm9yKCAnQXN5bmM6IENvdWxkIG5vdCBjb3B5IHRleHQ6ICcsIGVyciApOy5cclxuXHRcdFx0cmV0dXJuICBmYWxzZTtcclxuXHRcdH1cclxuXHQpO1xyXG59XHJcblxyXG4vKipcclxuICogQ29weSB0eHQgdG8gY2xpcGJyZCAtIGRlcHJpY2F0ZWQgbWV0aG9kLlxyXG4gKlxyXG4gKiBAcGFyYW0gdGV4dFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZmFsbGJhY2tfY29weV90ZXh0X3RvX2NsaXBicmQoIHRleHQgKSB7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gdmFyIHRleHRBcmVhICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCBcInRleHRhcmVhXCIgKTtcclxuXHQvLyB0ZXh0QXJlYS52YWx1ZSA9IHRleHQ7XHJcblx0Ly9cclxuXHQvLyAvLyBBdm9pZCBzY3JvbGxpbmcgdG8gYm90dG9tLlxyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnRvcCAgICAgID0gXCIwXCI7XHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUubGVmdCAgICAgPSBcIjBcIjtcclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS56SW5kZXggICA9IFwiOTk5OTk5OTk5XCI7XHJcblx0Ly8gZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggdGV4dEFyZWEgKTtcclxuXHQvLyB0ZXh0QXJlYS5mb2N1cygpO1xyXG5cdC8vIHRleHRBcmVhLnNlbGVjdCgpO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIE5vdyBnZXQgaXQgYXMgSFRNTCAgKG9yaWdpbmFsIGhlcmUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzQxOTE3ODAvamF2YXNjcmlwdC1jb3B5LXN0cmluZy10by1jbGlwYm9hcmQtYXMtdGV4dC1odG1sICkuXHJcblxyXG5cdC8vIFsxXSAtIENyZWF0ZSBjb250YWluZXIgZm9yIHRoZSBIVE1MLlxyXG5cdHZhciBjb250YWluZXIgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdGNvbnRhaW5lci5pbm5lckhUTUwgPSB0ZXh0O1xyXG5cclxuXHQvLyBbMl0gLSBIaWRlIGVsZW1lbnQuXHJcblx0Y29udGFpbmVyLnN0eWxlLnBvc2l0aW9uICAgICAgPSAnZml4ZWQnO1xyXG5cdGNvbnRhaW5lci5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xyXG5cdGNvbnRhaW5lci5zdHlsZS5vcGFjaXR5ICAgICAgID0gMDtcclxuXHJcblx0Ly8gRGV0ZWN0IGFsbCBzdHlsZSBzaGVldHMgb2YgdGhlIHBhZ2UuXHJcblx0dmFyIGFjdGl2ZVNoZWV0cyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBkb2N1bWVudC5zdHlsZVNoZWV0cyApLmZpbHRlcihcclxuXHRcdGZ1bmN0aW9uIChzaGVldCkge1xyXG5cdFx0XHRyZXR1cm4gISBzaGVldC5kaXNhYmxlZDtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHQvLyBbM10gLSBNb3VudCB0aGUgY29udGFpbmVyIHRvIHRoZSBET00gdG8gbWFrZSBgY29udGVudFdpbmRvd2AgYXZhaWxhYmxlLlxyXG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIGNvbnRhaW5lciApO1xyXG5cclxuXHQvLyBbNF0gLSBDb3B5IHRvIGNsaXBib2FyZC5cclxuXHR3aW5kb3cuZ2V0U2VsZWN0aW9uKCkucmVtb3ZlQWxsUmFuZ2VzKCk7XHJcblxyXG5cdHZhciByYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7XHJcblx0cmFuZ2Uuc2VsZWN0Tm9kZSggY29udGFpbmVyICk7XHJcblx0d2luZG93LmdldFNlbGVjdGlvbigpLmFkZFJhbmdlKCByYW5nZSApO1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHZhciByZXN1bHQgPSBmYWxzZTtcclxuXHJcblx0dHJ5IHtcclxuXHRcdHJlc3VsdCA9IGRvY3VtZW50LmV4ZWNDb21tYW5kKCAnY29weScgKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCAnRmFsbGJhY2s6IENvcHlpbmcgdGV4dCBjb21tYW5kIHdhcyAnICsgbXNnICk7IC8vLlxyXG5cdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHQvLyBjb25zb2xlLmVycm9yKCAnRmFsbGJhY2s6IE9vcHMsIHVuYWJsZSB0byBjb3B5JywgZXJyICk7IC8vLlxyXG5cdH1cclxuXHQvLyBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKCB0ZXh0QXJlYSApOyAvLy5cclxuXHJcblx0Ly8gWzUuNF0gLSBFbmFibGUgQ1NTLlxyXG5cdHZhciBhY3RpdmVTaGVldHNfbGVuZ3RoID0gYWN0aXZlU2hlZXRzLmxlbmd0aDtcclxuXHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBhY3RpdmVTaGVldHNfbGVuZ3RoOyBpKysgKSB7XHJcblx0XHRhY3RpdmVTaGVldHNbaV0uZGlzYWJsZWQgPSBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIFs2XSAtIFJlbW92ZSB0aGUgY29udGFpbmVyXHJcblx0ZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCggY29udGFpbmVyICk7XHJcblxyXG5cdHJldHVybiAgcmVzdWx0O1xyXG59IiwiLyoqXHJcbiAqIFdQQkMgQ29sbGFwc2libGUgR3JvdXBzXHJcbiAqXHJcbiAqIFVuaXZlcnNhbCwgZGVwZW5kZW5jeS1mcmVlIGNvbnRyb2xsZXIgZm9yIGV4cGFuZGluZy9jb2xsYXBzaW5nIGdyb3VwZWQgc2VjdGlvbnMgaW4gcmlnaHQtc2lkZSBwYW5lbHMgKEluc3BlY3Rvci9MaWJyYXJ5L0Zvcm0gU2V0dGluZ3MsIG9yIGFueSBvdGhlciBXUEJDIHBhZ2UpLlxyXG4gKlxyXG4gKiBcdFx0PT09IEhvdyB0byB1c2UgaXQgKHF1aWNrKSA/ID09PVxyXG4gKlxyXG4gKlx0XHQtLSAxLiBNYXJrdXAgKGluZGVwZW5kZW50IG1vZGU6IG11bHRpcGxlIG9wZW4gYWxsb3dlZCkgLS1cclxuICpcdFx0XHQ8ZGl2IGNsYXNzPVwid3BiY19jb2xsYXBzaWJsZVwiPlxyXG4gKlx0XHRcdCAgPHNlY3Rpb24gY2xhc3M9XCJ3cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCBpcy1vcGVuXCI+XHJcbiAqXHRcdFx0XHQ8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImdyb3VwX19oZWFkZXJcIj48aDM+R2VuZXJhbDwvaDM+PC9idXR0b24+XHJcbiAqXHRcdFx0XHQ8ZGl2IGNsYXNzPVwiZ3JvdXBfX2ZpZWxkc1wiPuKApjwvZGl2PlxyXG4gKlx0XHRcdCAgPC9zZWN0aW9uPlxyXG4gKlx0XHRcdCAgPHNlY3Rpb24gY2xhc3M9XCJ3cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cFwiPlxyXG4gKlx0XHRcdFx0PGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJncm91cF9faGVhZGVyXCI+PGgzPkFkdmFuY2VkPC9oMz48L2J1dHRvbj5cclxuICpcdFx0XHRcdDxkaXYgY2xhc3M9XCJncm91cF9fZmllbGRzXCI+4oCmPC9kaXY+XHJcbiAqXHRcdFx0ICA8L3NlY3Rpb24+XHJcbiAqXHRcdFx0PC9kaXY+XHJcbiAqXHJcbiAqXHRcdC0tIDIuIEV4Y2x1c2l2ZS9hY2NvcmRpb24gbW9kZSAob25lIG9wZW4gYXQgYSB0aW1lKSAtLVxyXG4gKlx0XHRcdDxkaXYgY2xhc3M9XCJ3cGJjX2NvbGxhcHNpYmxlIHdwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZVwiPuKApjwvZGl2PlxyXG4gKlxyXG4gKlx0XHQtLSAzLiBBdXRvLWluaXQgLS1cclxuICpcdFx0XHRUaGUgc2NyaXB0IGF1dG8taW5pdGlhbGl6ZXMgb24gRE9NQ29udGVudExvYWRlZC4gTm8gZXh0cmEgY29kZSBuZWVkZWQuXHJcbiAqXHJcbiAqXHRcdC0tIDQuIFByb2dyYW1tYXRpYyBjb250cm9sIChvcHRpb25hbClcclxuICpcdFx0XHRjb25zdCByb290ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3dwYmNfYmZiX19pbnNwZWN0b3InKTtcclxuICpcdFx0XHRjb25zdCBhcGkgID0gcm9vdC5fX3dwYmNfY29sbGFwc2libGVfaW5zdGFuY2U7IC8vIHNldCBieSBhdXRvLWluaXRcclxuICpcclxuICpcdFx0XHRhcGkub3Blbl9ieV9oZWFkaW5nKCdWYWxpZGF0aW9uJyk7IC8vIG9wZW4gYnkgaGVhZGluZyB0ZXh0XHJcbiAqXHRcdFx0YXBpLm9wZW5fYnlfaW5kZXgoMCk7ICAgICAgICAgICAgICAvLyBvcGVuIHRoZSBmaXJzdCBncm91cFxyXG4gKlxyXG4gKlx0XHQtLSA1Lkxpc3RlbiB0byBldmVudHMgKGUuZy4sIHRvIHBlcnNpc3Qg4oCcb3BlbiBncm91cOKAnSBzdGF0ZSkgLS1cclxuICpcdFx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmM6Y29sbGFwc2libGU6b3BlbicsICAoZSkgPT4geyBjb25zb2xlLmxvZyggIGUuZGV0YWlsLmdyb3VwICk7IH0pO1xyXG4gKlx0XHRcdHJvb3QuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpjb2xsYXBzaWJsZTpjbG9zZScsIChlKSA9PiB7IGNvbnNvbGUubG9nKCAgZS5kZXRhaWwuZ3JvdXAgKTsgfSk7XHJcbiAqXHJcbiAqXHJcbiAqXHJcbiAqIE1hcmt1cCBleHBlY3RhdGlvbnMgKG1pbmltYWwpOlxyXG4gKiAgPGRpdiBjbGFzcz1cIndwYmNfY29sbGFwc2libGUgW3dwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZV1cIj5cclxuICogICAgPHNlY3Rpb24gY2xhc3M9XCJ3cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCBbaXMtb3Blbl1cIj5cclxuICogICAgICA8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cImdyb3VwX19oZWFkZXJcIj4gLi4uIDwvYnV0dG9uPlxyXG4gKiAgICAgIDxkaXYgY2xhc3M9XCJncm91cF9fZmllbGRzXCI+IC4uLiA8L2Rpdj5cclxuICogICAgPC9zZWN0aW9uPlxyXG4gKiAgICAuLi4gbW9yZSA8c2VjdGlvbj4gLi4uXHJcbiAqICA8L2Rpdj5cclxuICpcclxuICogTm90ZXM6XHJcbiAqICAtIEFkZCBgaXMtb3BlbmAgdG8gYW55IHNlY3Rpb24geW91IHdhbnQgaW5pdGlhbGx5IGV4cGFuZGVkLlxyXG4gKiAgLSBBZGQgYHdwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZWAgdG8gdGhlIGNvbnRhaW5lciBmb3IgXCJvcGVuIG9uZSBhdCBhIHRpbWVcIiBiZWhhdmlvci5cclxuICogIC0gV29ya3Mgd2l0aCB5b3VyIGV4aXN0aW5nIEJGQiBtYXJrdXAgKGNsYXNzZXMgdXNlZCB0aGVyZSBhcmUgdGhlIGRlZmF1bHRzKS5cclxuICpcclxuICogQWNjZXNzaWJpbGl0eTpcclxuICogIC0gU2V0cyBhcmlhLWV4cGFuZGVkIG9uIC5ncm91cF9faGVhZGVyXHJcbiAqICAtIFNldHMgYXJpYS1oaWRkZW4gKyBbaGlkZGVuXSBvbiAuZ3JvdXBfX2ZpZWxkc1xyXG4gKiAgLSBBcnJvd1VwL0Fycm93RG93biBtb3ZlIGZvY3VzIGJldHdlZW4gaGVhZGVyczsgRW50ZXIvU3BhY2UgdG9nZ2xlc1xyXG4gKlxyXG4gKiBFdmVudHMgKGJ1YmJsZXMgZnJvbSB0aGUgPHNlY3Rpb24+KTpcclxuICogIC0gJ3dwYmM6Y29sbGFwc2libGU6b3BlbicgIChkZXRhaWw6IHsgZ3JvdXAsIHJvb3QsIGluc3RhbmNlIH0pXHJcbiAqICAtICd3cGJjOmNvbGxhcHNpYmxlOmNsb3NlJyAoZGV0YWlsOiB7IGdyb3VwLCByb290LCBpbnN0YW5jZSB9KVxyXG4gKlxyXG4gKiBQdWJsaWMgQVBJIChpbnN0YW5jZSBtZXRob2RzKTpcclxuICogIC0gaW5pdCgpLCBkZXN0cm95KCksIHJlZnJlc2goKVxyXG4gKiAgLSBleHBhbmQoZ3JvdXAsIFtleGNsdXNpdmVdKSwgY29sbGFwc2UoZ3JvdXApLCB0b2dnbGUoZ3JvdXApXHJcbiAqICAtIG9wZW5fYnlfaW5kZXgoaW5kZXgpLCBvcGVuX2J5X2hlYWRpbmcodGV4dClcclxuICogIC0gaXNfZXhjbHVzaXZlKCksIGlzX29wZW4oZ3JvdXApXHJcbiAqXHJcbiAqIEB2ZXJzaW9uIDIwMjUtMDgtMjZcclxuICogQHNpbmNlIDIwMjUtMDgtMjZcclxuICovXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvY29sbGFwc2libGVfZ3JvdXBzLmpzID09IFRpbWUgcG9pbnQ6IDIwMjUtMDgtMjYgMTQ6MTNcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Y2xhc3MgV1BCQ19Db2xsYXBzaWJsZV9Hcm91cHMge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ3JlYXRlIGEgY29sbGFwc2libGUgY29udHJvbGxlciBmb3IgYSBjb250YWluZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxzdHJpbmd9IHJvb3RfZWxcclxuXHRcdCAqICAgICAgICBUaGUgY29udGFpbmVyIGVsZW1lbnQgKG9yIENTUyBzZWxlY3RvcikgdGhhdCB3cmFwcyBjb2xsYXBzaWJsZSBncm91cHMuXHJcblx0XHQgKiAgICAgICAgVGhlIGNvbnRhaW5lciB1c3VhbGx5IGhhcyB0aGUgY2xhc3MgYC53cGJjX2NvbGxhcHNpYmxlYC5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0cz17fV1cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdHMuZ3JvdXBfc2VsZWN0b3I9Jy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCddXHJcblx0XHQgKiAgICAgICAgU2VsZWN0b3IgZm9yIGVhY2ggY29sbGFwc2libGUgZ3JvdXAgaW5zaWRlIHRoZSBjb250YWluZXIuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIFtvcHRzLmhlYWRlcl9zZWxlY3Rvcj0nLmdyb3VwX19oZWFkZXInXVxyXG5cdFx0ICogICAgICAgIFNlbGVjdG9yIGZvciB0aGUgY2xpY2thYmxlIGhlYWRlciBpbnNpZGUgYSBncm91cC5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgW29wdHMuZmllbGRzX3NlbGVjdG9yPScuZ3JvdXBfX2ZpZWxkcyddXHJcblx0XHQgKiAgICAgICAgU2VsZWN0b3IgZm9yIHRoZSBjb250ZW50L3BhbmVsIGVsZW1lbnQgaW5zaWRlIGEgZ3JvdXAuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIFtvcHRzLm9wZW5fY2xhc3M9J2lzLW9wZW4nXVxyXG5cdFx0ICogICAgICAgIENsYXNzIG5hbWUgdGhhdCBpbmRpY2F0ZXMgdGhlIGdyb3VwIGlzIG9wZW4uXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmV4Y2x1c2l2ZT1mYWxzZV1cclxuXHRcdCAqICAgICAgICBJZiB0cnVlLCBvbmx5IG9uZSBncm91cCBjYW4gYmUgb3BlbiBhdCBhIHRpbWUgaW4gdGhpcyBjb250YWluZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQGNvbnN0cnVjdG9yXHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3Rvcihyb290X2VsLCBvcHRzID0ge30pIHtcclxuXHRcdFx0dGhpcy5yb290ID0gKHR5cGVvZiByb290X2VsID09PSAnc3RyaW5nJykgPyBkLnF1ZXJ5U2VsZWN0b3IoIHJvb3RfZWwgKSA6IHJvb3RfZWw7XHJcblx0XHRcdHRoaXMub3B0cyA9IE9iamVjdC5hc3NpZ24oIHtcclxuXHRcdFx0XHRncm91cF9zZWxlY3RvciA6ICcud3BiY191aV9fY29sbGFwc2libGVfZ3JvdXAnLFxyXG5cdFx0XHRcdGhlYWRlcl9zZWxlY3RvcjogJy5ncm91cF9faGVhZGVyJyxcclxuXHRcdFx0XHRmaWVsZHNfc2VsZWN0b3I6ICcuZ3JvdXBfX2ZpZWxkcycsXHJcblx0XHRcdFx0b3Blbl9jbGFzcyAgICAgOiAnaXMtb3BlbicsXHJcblx0XHRcdFx0ZXhjbHVzaXZlICAgICAgOiBmYWxzZVxyXG5cdFx0XHR9LCBvcHRzICk7XHJcblxyXG5cdFx0XHQvLyBCb3VuZCBoYW5kbGVycyAoZm9yIGFkZC9yZW1vdmVFdmVudExpc3RlbmVyIHN5bW1ldHJ5KS5cclxuXHRcdFx0LyoqIEBwcml2YXRlICovXHJcblx0XHRcdHRoaXMuX29uX2NsaWNrID0gdGhpcy5fb25fY2xpY2suYmluZCggdGhpcyApO1xyXG5cdFx0XHQvKiogQHByaXZhdGUgKi9cclxuXHRcdFx0dGhpcy5fb25fa2V5ZG93biA9IHRoaXMuX29uX2tleWRvd24uYmluZCggdGhpcyApO1xyXG5cclxuXHRcdFx0LyoqIEB0eXBlIHtIVE1MRWxlbWVudFtdfSBAcHJpdmF0ZSAqL1xyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBbXTtcclxuXHRcdFx0LyoqIEB0eXBlIHtNdXRhdGlvbk9ic2VydmVyfG51bGx9IEBwcml2YXRlICovXHJcblx0XHRcdHRoaXMuX29ic2VydmVyID0gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEluaXRpYWxpemUgdGhlIGNvbnRyb2xsZXI6IGNhY2hlIGdyb3VwcywgYXR0YWNoIGxpc3RlbmVycywgc2V0IEFSSUEsXHJcblx0XHQgKiBhbmQgc3RhcnQgb2JzZXJ2aW5nIERPTSBjaGFuZ2VzIGluc2lkZSB0aGUgY29udGFpbmVyLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHtXUEJDX0NvbGxhcHNpYmxlX0dyb3Vwc30gVGhlIGluc3RhbmNlIChjaGFpbmFibGUpLlxyXG5cdFx0ICogQGxpc3RlbnMgY2xpY2tcclxuXHRcdCAqIEBsaXN0ZW5zIGtleWRvd25cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGluaXQoKSB7XHJcblx0XHRcdGlmICggIXRoaXMucm9vdCApIHtcclxuXHRcdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChcclxuXHRcdFx0XHR0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yIClcclxuXHRcdFx0KTtcclxuXHRcdFx0dGhpcy5yb290LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHRoaXMuX29uX2NsaWNrLCBmYWxzZSApO1xyXG5cdFx0XHR0aGlzLnJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCB0aGlzLl9vbl9rZXlkb3duLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0Ly8gT2JzZXJ2ZSBkeW5hbWljIGluc2VydHMvcmVtb3ZhbHMgKEluc3BlY3RvciByZS1yZW5kZXJzKS5cclxuXHRcdFx0dGhpcy5fb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggKCkgPT4ge1xyXG5cdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHRoaXMuX29ic2VydmVyLm9ic2VydmUoIHRoaXMucm9vdCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xyXG5cclxuXHRcdFx0dGhpcy5fc3luY19hbGxfYXJpYSgpO1xyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFRlYXIgZG93biB0aGUgY29udHJvbGxlcjogZGV0YWNoIGxpc3RlbmVycywgc3RvcCB0aGUgb2JzZXJ2ZXIsXHJcblx0XHQgKiBhbmQgZHJvcCBpbnRlcm5hbCByZWZlcmVuY2VzLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5yb290ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLnJvb3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fY2xpY2ssIGZhbHNlICk7XHJcblx0XHRcdHRoaXMucm9vdC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleWRvd24sIGZhbHNlICk7XHJcblx0XHRcdGlmICggdGhpcy5fb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdFx0dGhpcy5fb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdHRoaXMuX29ic2VydmVyID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9ncm91cHMgPSBbXTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlLXNjYW4gdGhlIERPTSBmb3IgY3VycmVudCBncm91cHMgYW5kIHJlLWFwcGx5IEFSSUEgdG8gYWxsIG9mIHRoZW0uXHJcblx0XHQgKiBVc2VmdWwgYWZ0ZXIgZHluYW1pYyAocmUpcmVuZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdHJlZnJlc2goKSB7XHJcblx0XHRcdGlmICggIXRoaXMucm9vdCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0dGhpcy5fZ3JvdXBzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoXHJcblx0XHRcdFx0dGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApXHJcblx0XHRcdCk7XHJcblx0XHRcdHRoaXMuX3N5bmNfYWxsX2FyaWEoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIHdoZXRoZXIgdGhlIGNvbnRhaW5lciBpcyBpbiBleGNsdXNpdmUgKGFjY29yZGlvbikgbW9kZS5cclxuXHRcdCAqXHJcblx0XHQgKiBPcmRlciBvZiBwcmVjZWRlbmNlOlxyXG5cdFx0ICogIDEpIEV4cGxpY2l0IG9wdGlvbiBgb3B0cy5leGNsdXNpdmVgXHJcblx0XHQgKiAgMikgQ29udGFpbmVyIGhhcyBjbGFzcyBgLndwYmNfY29sbGFwc2libGUtLWV4Y2x1c2l2ZWBcclxuXHRcdCAqICAzKSBDb250YWluZXIgbWF0Y2hlcyBgW2RhdGEtd3BiYy1hY2NvcmRpb249XCJleGNsdXNpdmVcIl1gXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgZXhjbHVzaXZlIG1vZGUgaXMgYWN0aXZlLlxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0aXNfZXhjbHVzaXZlKCkge1xyXG5cdFx0XHRyZXR1cm4gISEoXHJcblx0XHRcdFx0dGhpcy5vcHRzLmV4Y2x1c2l2ZSB8fFxyXG5cdFx0XHRcdHRoaXMucm9vdC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2NvbGxhcHNpYmxlLS1leGNsdXNpdmUnICkgfHxcclxuXHRcdFx0XHR0aGlzLnJvb3QubWF0Y2hlcyggJ1tkYXRhLXdwYmMtYWNjb3JkaW9uPVwiZXhjbHVzaXZlXCJdJyApXHJcblx0XHRcdCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBEZXRlcm1pbmUgd2hldGhlciBhIHNwZWNpZmljIGdyb3VwIGlzIG9wZW4uXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gdGVzdC5cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBncm91cCBpcyBjdXJyZW50bHkgb3Blbi5cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGlzX29wZW4oZ3JvdXApIHtcclxuXHRcdFx0cmV0dXJuIGdyb3VwLmNsYXNzTGlzdC5jb250YWlucyggdGhpcy5vcHRzLm9wZW5fY2xhc3MgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE9wZW4gYSBncm91cC4gSG9ub3JzIGV4Y2x1c2l2ZSBtb2RlIGJ5IGNvbGxhcHNpbmcgYWxsIHNpYmxpbmcgZ3JvdXBzXHJcblx0XHQgKiAocXVlcmllZCBmcm9tIHRoZSBsaXZlIERPTSBhdCBjYWxsLXRpbWUpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIG9wZW4uXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IFtleGNsdXNpdmVdXHJcblx0XHQgKiAgICAgICAgSWYgcHJvdmlkZWQsIG92ZXJyaWRlcyBjb250YWluZXIgbW9kZSBmb3IgdGhpcyBhY3Rpb24gb25seS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6b3BlblxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0ZXhwYW5kKGdyb3VwLCBleGNsdXNpdmUpIHtcclxuXHRcdFx0aWYgKCAhZ3JvdXAgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGRvX2V4Y2x1c2l2ZSA9ICh0eXBlb2YgZXhjbHVzaXZlID09PSAnYm9vbGVhbicpID8gZXhjbHVzaXZlIDogdGhpcy5pc19leGNsdXNpdmUoKTtcclxuXHRcdFx0aWYgKCBkb19leGNsdXNpdmUgKSB7XHJcblx0XHRcdFx0Ly8gQWx3YXlzIHVzZSB0aGUgbGl2ZSBET00sIG5vdCB0aGUgY2FjaGVkIGxpc3QuXHJcblx0XHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChcclxuXHRcdFx0XHRcdHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCB0aGlzLm9wdHMuZ3JvdXBfc2VsZWN0b3IgKSxcclxuXHRcdFx0XHRcdChnKSA9PiB7XHJcblx0XHRcdFx0XHRcdGlmICggZyAhPT0gZ3JvdXAgKSB7XHJcblx0XHRcdFx0XHRcdFx0dGhpcy5fc2V0X29wZW4oIGcsIGZhbHNlICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHQpO1xyXG5cdFx0XHR9XHJcblx0XHRcdHRoaXMuX3NldF9vcGVuKCBncm91cCwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2xvc2UgYSBncm91cC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBncm91cCBUaGUgZ3JvdXAgZWxlbWVudCB0byBjbG9zZS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6Y2xvc2VcclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdGNvbGxhcHNlKGdyb3VwKSB7XHJcblx0XHRcdGlmICggIWdyb3VwICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzLl9zZXRfb3BlbiggZ3JvdXAsIGZhbHNlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBUb2dnbGUgYSBncm91cCdzIG9wZW4vY2xvc2VkIHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIHRvZ2dsZS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0dG9nZ2xlKGdyb3VwKSB7XHJcblx0XHRcdGlmICggIWdyb3VwICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR0aGlzW3RoaXMuaXNfb3BlbiggZ3JvdXAgKSA/ICdjb2xsYXBzZScgOiAnZXhwYW5kJ10oIGdyb3VwICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIGEgZ3JvdXAgYnkgaXRzIGluZGV4IHdpdGhpbiB0aGUgY29udGFpbmVyICgwLWJhc2VkKS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggWmVyby1iYXNlZCBpbmRleCBvZiB0aGUgZ3JvdXAuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdG9wZW5fYnlfaW5kZXgoaW5kZXgpIHtcclxuXHRcdFx0Y29uc3QgZ3JvdXAgPSB0aGlzLl9ncm91cHNbaW5kZXhdO1xyXG5cdFx0XHRpZiAoIGdyb3VwICkge1xyXG5cdFx0XHRcdHRoaXMuZXhwYW5kKCBncm91cCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBPcGVuIGEgZ3JvdXAgYnkgbWF0Y2hpbmcgdGV4dCBjb250YWluZWQgd2l0aGluIHRoZSA8aDM+IGluc2lkZSB0aGUgaGVhZGVyLlxyXG5cdFx0ICogVGhlIGNvbXBhcmlzb24gaXMgY2FzZS1pbnNlbnNpdGl2ZSBhbmQgc3Vic3RyaW5nLWJhc2VkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IFRleHQgdG8gbWF0Y2ggYWdhaW5zdCB0aGUgaGVhZGluZyBjb250ZW50cy5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0b3Blbl9ieV9oZWFkaW5nKHRleHQpIHtcclxuXHRcdFx0aWYgKCAhdGV4dCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgdCAgICAgPSBTdHJpbmcoIHRleHQgKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRjb25zdCBtYXRjaCA9IHRoaXMuX2dyb3Vwcy5maW5kKCAoZykgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IGggPSBnLnF1ZXJ5U2VsZWN0b3IoIHRoaXMub3B0cy5oZWFkZXJfc2VsZWN0b3IgKyAnIGgzJyApO1xyXG5cdFx0XHRcdHJldHVybiBoICYmIGgudGV4dENvbnRlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCB0ICkgIT09IC0xO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGlmICggbWF0Y2ggKSB7XHJcblx0XHRcdFx0dGhpcy5leHBhbmQoIG1hdGNoICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBJbnRlcm5hbFxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRGVsZWdhdGVkIGNsaWNrIGhhbmRsZXIgZm9yIGhlYWRlcnMuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXYgVGhlIGNsaWNrIGV2ZW50LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdFx0ICovXHJcblx0XHRfb25fY2xpY2soZXYpIHtcclxuXHRcdFx0Y29uc3QgYnRuID0gZXYudGFyZ2V0LmNsb3Nlc3QoIHRoaXMub3B0cy5oZWFkZXJfc2VsZWN0b3IgKTtcclxuXHRcdFx0aWYgKCAhYnRuIHx8ICF0aGlzLnJvb3QuY29udGFpbnMoIGJ0biApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRldi5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0Y29uc3QgZ3JvdXAgPSBidG4uY2xvc2VzdCggdGhpcy5vcHRzLmdyb3VwX3NlbGVjdG9yICk7XHJcblx0XHRcdGlmICggZ3JvdXAgKSB7XHJcblx0XHRcdFx0dGhpcy50b2dnbGUoIGdyb3VwICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEtleWJvYXJkIGhhbmRsZXIgZm9yIGhlYWRlciBpbnRlcmFjdGlvbnMgYW5kIHJvdmluZyBmb2N1czpcclxuXHRcdCAqICAtIEVudGVyL1NwYWNlIHRvZ2dsZXMgdGhlIGFjdGl2ZSBncm91cC5cclxuXHRcdCAqICAtIEFycm93VXAvQXJyb3dEb3duIG1vdmVzIGZvY3VzIGJldHdlZW4gZ3JvdXAgaGVhZGVycy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldiBUaGUga2V5Ym9hcmQgZXZlbnQuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9vbl9rZXlkb3duKGV2KSB7XHJcblx0XHRcdGNvbnN0IGJ0biA9IGV2LnRhcmdldC5jbG9zZXN0KCB0aGlzLm9wdHMuaGVhZGVyX3NlbGVjdG9yICk7XHJcblx0XHRcdGlmICggIWJ0biApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGtleSA9IGV2LmtleTtcclxuXHJcblx0XHRcdC8vIFRvZ2dsZSBvbiBFbnRlciAvIFNwYWNlLlxyXG5cdFx0XHRpZiAoIGtleSA9PT0gJ0VudGVyJyB8fCBrZXkgPT09ICcgJyApIHtcclxuXHRcdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdGNvbnN0IGdyb3VwID0gYnRuLmNsb3Nlc3QoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApO1xyXG5cdFx0XHRcdGlmICggZ3JvdXAgKSB7XHJcblx0XHRcdFx0XHR0aGlzLnRvZ2dsZSggZ3JvdXAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBNb3ZlIGZvY3VzIHdpdGggQXJyb3dVcC9BcnJvd0Rvd24gYmV0d2VlbiBoZWFkZXJzIGluIHRoaXMgY29udGFpbmVyLlxyXG5cdFx0XHRpZiAoIGtleSA9PT0gJ0Fycm93VXAnIHx8IGtleSA9PT0gJ0Fycm93RG93bicgKSB7XHJcblx0XHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRjb25zdCBoZWFkZXJzID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKFxyXG5cdFx0XHRcdFx0dGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMub3B0cy5ncm91cF9zZWxlY3RvciApLFxyXG5cdFx0XHRcdFx0KGcpID0+IGcucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApXHJcblx0XHRcdFx0KS5maWx0ZXIoIEJvb2xlYW4gKTtcclxuXHRcdFx0XHRjb25zdCBpZHggICAgID0gaGVhZGVycy5pbmRleE9mKCBidG4gKTtcclxuXHRcdFx0XHRpZiAoIGlkeCAhPT0gLTEgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBuZXh0X2lkeCA9IChrZXkgPT09ICdBcnJvd0Rvd24nKVxyXG5cdFx0XHRcdFx0XHQ/IE1hdGgubWluKCBoZWFkZXJzLmxlbmd0aCAtIDEsIGlkeCArIDEgKVxyXG5cdFx0XHRcdFx0XHQ6IE1hdGgubWF4KCAwLCBpZHggLSAxICk7XHJcblx0XHRcdFx0XHRoZWFkZXJzW25leHRfaWR4XS5mb2N1cygpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXBwbHkgQVJJQSBzeW5jaHJvbml6YXRpb24gdG8gYWxsIGtub3duIGdyb3VwcyBiYXNlZCBvbiB0aGVpciBvcGVuIHN0YXRlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9zeW5jX2FsbF9hcmlhKCkge1xyXG5cdFx0XHR0aGlzLl9ncm91cHMuZm9yRWFjaCggKGcpID0+IHRoaXMuX3N5bmNfZ3JvdXBfYXJpYSggZyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTeW5jIEFSSUEgYXR0cmlidXRlcyBhbmQgdmlzaWJpbGl0eSBvbiBhIHNpbmdsZSBncm91cC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZ3JvdXAgVGhlIGdyb3VwIGVsZW1lbnQgdG8gc3luYy5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQHNpbmNlIDIwMjUtMDgtMjZcclxuXHRcdCAqL1xyXG5cdFx0X3N5bmNfZ3JvdXBfYXJpYShncm91cCkge1xyXG5cdFx0XHRjb25zdCBpc19vcGVuID0gdGhpcy5pc19vcGVuKCBncm91cCApO1xyXG5cdFx0XHRjb25zdCBoZWFkZXIgID0gZ3JvdXAucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApO1xyXG5cdFx0XHRjb25zdCBwYW5lbCAgID0gZ3JvdXAucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmZpZWxkc19zZWxlY3RvciApO1xyXG5cclxuXHRcdFx0aWYgKCBoZWFkZXIgKSB7XHJcblx0XHRcdFx0Ly8gSGVhZGVyIGlzIGEgcmVhbCA8YnV0dG9uPiwgcm9sZSBpcyBoYXJtbGVzcyBoZXJlLlxyXG5cdFx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoICdyb2xlJywgJ2J1dHRvbicgKTtcclxuXHRcdFx0XHRoZWFkZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsIGlzX29wZW4gPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblxyXG5cdFx0XHRcdC8vIExpbmsgaGVhZGVyIHRvIHBhbmVsIGJ5IGlkIGlmIGF2YWlsYWJsZS5cclxuXHRcdFx0XHRpZiAoIHBhbmVsICkge1xyXG5cdFx0XHRcdFx0aWYgKCAhcGFuZWwuaWQgKSB7XHJcblx0XHRcdFx0XHRcdHBhbmVsLmlkID0gdGhpcy5fZ2VuZXJhdGVfaWQoICd3cGJjX2NvbGxhcHNpYmxlX3BhbmVsJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCAhaGVhZGVyLmhhc0F0dHJpYnV0ZSggJ2FyaWEtY29udHJvbHMnICkgKSB7XHJcblx0XHRcdFx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWNvbnRyb2xzJywgcGFuZWwuaWQgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBwYW5lbCApIHtcclxuXHRcdFx0XHRwYW5lbC5oaWRkZW4gPSAhaXNfb3BlbjtcclxuXHRcdFx0XHRwYW5lbC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIGlzX29wZW4gPyAnZmFsc2UnIDogJ3RydWUnICk7XHJcblx0XHRcdFx0Ly8gT3B0aW9uYWwgbGFuZG1hcms6XHJcblx0XHRcdFx0Ly8gcGFuZWwuc2V0QXR0cmlidXRlKCdyb2xlJywgJ3JlZ2lvbicpO1xyXG5cdFx0XHRcdC8vIHBhbmVsLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbGxlZGJ5JywgaGVhZGVyLmlkIHx8IChoZWFkZXIuaWQgPSB0aGlzLl9nZW5lcmF0ZV9pZCgnd3BiY19jb2xsYXBzaWJsZV9oZWFkZXInKSkpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbnRlcm5hbCBzdGF0ZSBjaGFuZ2U6IHNldCBhIGdyb3VwJ3Mgb3Blbi9jbG9zZWQgc3RhdGUsIHN5bmMgQVJJQSxcclxuXHRcdCAqIG1hbmFnZSBmb2N1cyBvbiBjb2xsYXBzZSwgYW5kIGVtaXQgYSBjdXN0b20gZXZlbnQuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGdyb3VwIFRoZSBncm91cCBlbGVtZW50IHRvIG11dGF0ZS5cclxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gb3BlbiBXaGV0aGVyIHRoZSBncm91cCBzaG91bGQgYmUgb3Blbi5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6b3BlblxyXG5cdFx0ICogQGZpcmVzIEN1c3RvbUV2ZW50I3dwYmM6Y29sbGFwc2libGU6Y2xvc2VcclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9zZXRfb3Blbihncm91cCwgb3Blbikge1xyXG5cdFx0XHRpZiAoICFvcGVuICYmIGdyb3VwLmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgKSB7XHJcblx0XHRcdFx0Y29uc3QgaGVhZGVyID0gZ3JvdXAucXVlcnlTZWxlY3RvciggdGhpcy5vcHRzLmhlYWRlcl9zZWxlY3RvciApO1xyXG5cdFx0XHRcdGhlYWRlciAmJiBoZWFkZXIuZm9jdXMoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRncm91cC5jbGFzc0xpc3QudG9nZ2xlKCB0aGlzLm9wdHMub3Blbl9jbGFzcywgb3BlbiApO1xyXG5cdFx0XHR0aGlzLl9zeW5jX2dyb3VwX2FyaWEoIGdyb3VwICk7XHJcblx0XHRcdGNvbnN0IGV2X25hbWUgPSBvcGVuID8gJ3dwYmM6Y29sbGFwc2libGU6b3BlbicgOiAnd3BiYzpjb2xsYXBzaWJsZTpjbG9zZSc7XHJcblx0XHRcdGdyb3VwLmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggZXZfbmFtZSwge1xyXG5cdFx0XHRcdGJ1YmJsZXM6IHRydWUsXHJcblx0XHRcdFx0ZGV0YWlsIDogeyBncm91cCwgcm9vdDogdGhpcy5yb290LCBpbnN0YW5jZTogdGhpcyB9XHJcblx0XHRcdH0gKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2VuZXJhdGUgYSB1bmlxdWUgRE9NIGlkIHdpdGggdGhlIHNwZWNpZmllZCBwcmVmaXguXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmVmaXggVGhlIGlkIHByZWZpeCB0byB1c2UuXHJcblx0XHQgKiBAcmV0dXJucyB7c3RyaW5nfSBBIHVuaXF1ZSBlbGVtZW50IGlkIG5vdCBwcmVzZW50IGluIHRoZSBkb2N1bWVudC5cclxuXHRcdCAqIEBzaW5jZSAyMDI1LTA4LTI2XHJcblx0XHQgKi9cclxuXHRcdF9nZW5lcmF0ZV9pZChwcmVmaXgpIHtcclxuXHRcdFx0bGV0IGkgPSAxO1xyXG5cdFx0XHRsZXQgaWQ7XHJcblx0XHRcdGRvIHtcclxuXHRcdFx0XHRpZCA9IHByZWZpeCArICdfJyArIChpKyspO1xyXG5cdFx0XHR9XHJcblx0XHRcdHdoaWxlICggZC5nZXRFbGVtZW50QnlJZCggaWQgKSApO1xyXG5cdFx0XHRyZXR1cm4gaWQ7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBdXRvLWluaXRpYWxpemUgY29sbGFwc2libGUgY29udHJvbGxlcnMgb24gdGhlIHBhZ2UuXHJcblx0ICogRmluZHMgdG9wLWxldmVsIGAud3BiY19jb2xsYXBzaWJsZWAgY29udGFpbmVycyAoaWdub3JpbmcgbmVzdGVkIG9uZXMpLFxyXG5cdCAqIGFuZCBpbnN0YW50aWF0ZXMge0BsaW5rIFdQQkNfQ29sbGFwc2libGVfR3JvdXBzfSBvbiBlYWNoLlxyXG5cdCAqXHJcblx0ICogQGZ1bmN0aW9uIFdQQkNfQ29sbGFwc2libGVfQXV0b0luaXRcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKiBAc2luY2UgMjAyNS0wOC0yNlxyXG5cdCAqIEBleGFtcGxlXHJcblx0ICogLy8gUnVucyBhdXRvbWF0aWNhbGx5IG9uIERPTUNvbnRlbnRMb2FkZWQ7IGNhbiBhbHNvIGJlIGNhbGxlZCBtYW51YWxseTpcclxuXHQgKiBXUEJDX0NvbGxhcHNpYmxlX0F1dG9Jbml0KCk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jb2xsYXBzaWJsZV9fYXV0b19pbml0KCkge1xyXG5cdFx0dmFyIFJPT1QgID0gJy53cGJjX2NvbGxhcHNpYmxlJztcclxuXHRcdHZhciBub2RlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBkLnF1ZXJ5U2VsZWN0b3JBbGwoIFJPT1QgKSApXHJcblx0XHRcdC5maWx0ZXIoIGZ1bmN0aW9uIChuKSB7XHJcblx0XHRcdFx0cmV0dXJuICFuLnBhcmVudEVsZW1lbnQgfHwgIW4ucGFyZW50RWxlbWVudC5jbG9zZXN0KCBST09UICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRub2Rlcy5mb3JFYWNoKCBmdW5jdGlvbiAobm9kZSkge1xyXG5cdFx0XHRpZiAoIG5vZGUuX193cGJjX2NvbGxhcHNpYmxlX2luc3RhbmNlICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHR2YXIgZXhjbHVzaXZlID0gbm9kZS5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2NvbGxhcHNpYmxlLS1leGNsdXNpdmUnICkgfHwgbm9kZS5tYXRjaGVzKCAnW2RhdGEtd3BiYy1hY2NvcmRpb249XCJleGNsdXNpdmVcIl0nICk7XHJcblxyXG5cdFx0XHRub2RlLl9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZSA9IG5ldyBXUEJDX0NvbGxhcHNpYmxlX0dyb3Vwcyggbm9kZSwgeyBleGNsdXNpdmUgfSApLmluaXQoKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdC8vIEV4cG9ydCB0byBnbG9iYWwgZm9yIG1hbnVhbCBjb250cm9sIGlmIG5lZWRlZC5cclxuXHR3LldQQkNfQ29sbGFwc2libGVfR3JvdXBzICAgPSBXUEJDX0NvbGxhcHNpYmxlX0dyb3VwcztcclxuXHR3LldQQkNfQ29sbGFwc2libGVfQXV0b0luaXQgPSB3cGJjX2NvbGxhcHNpYmxlX19hdXRvX2luaXQ7XHJcblxyXG5cdC8vIERPTS1yZWFkeSBhdXRvIGluaXQuXHJcblx0aWYgKCBkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCB3cGJjX2NvbGxhcHNpYmxlX19hdXRvX2luaXQsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdwYmNfY29sbGFwc2libGVfX2F1dG9faW5p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
