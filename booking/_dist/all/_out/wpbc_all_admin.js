"use strict";

/**
 * Blink specific HTML element to set attention to this element.
 *
 * @param {string} element_to_blink		  - class or id of element: '.wpbc_widget_available_unavailable'
 * @param {int} how_many_times			  - 4
 * @param {int} how_long_to_blink		  - 350
 */
function wpbc_blink_element(element_to_blink) {
  var how_many_times = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4;
  var how_long_to_blink = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 350;
  for (var i = 0; i < how_many_times; i++) {
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
}

/**
 * Hide Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_min() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('min');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').addClass('wpbc_ui__hide');
}

/**
 * Colapse Vertical Left Bar.
 */
function wpbc_admin_ui__sidebar_left__do_compact() {
  jQuery('.wpbc_settings_page_wrapper').removeClass('min max compact none');
  jQuery('.wpbc_settings_page_wrapper').addClass('compact');
  jQuery('.wpbc_ui__top_nav__btn_open_left_vertical_nav').removeClass('wpbc_ui__hide');
  jQuery('.wpbc_ui__top_nav__btn_hide_left_vertical_nav').addClass('wpbc_ui__hide');
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
      for (var i = 1; i < anchors_arr_length; i++) {
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

/**
 * Open settings page  |  Expand section  |  Select Menu item.
 */
function wpbc_admin_ui__do__open_url__expand_section(url, section_id) {
  // window.location.href = url + '&do_expand=' + section_id + '#do_expand__' + section_id; //.
  window.location.href = url + '#do_expand__' + section_id;
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX2Rpc3QvYWxsL19vdXQvd3BiY19hbGxfYWRtaW4uanMiLCJuYW1lcyI6WyJ3cGJjX2JsaW5rX2VsZW1lbnQiLCJlbGVtZW50X3RvX2JsaW5rIiwiaG93X21hbnlfdGltZXMiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJob3dfbG9uZ190b19ibGluayIsImkiLCJqUXVlcnkiLCJmYWRlT3V0IiwiZmFkZUluIiwiYW5pbWF0ZSIsIm9wYWNpdHkiLCJ3cGJjX2J1dHRvbl9fcmVtb3ZlX3NwaW4iLCJidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkIiwicHJldmlvc19jbGFzc2VzIiwiakVsZW1lbnQiLCJ3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbiIsImdldCIsIndwYmNfYnV0dG9uX2VuYWJsZV9sb2FkaW5nX2ljb24iLCJ0aGlzX2J1dHRvbiIsImpCdXR0b24iLCJqSWNvbiIsImZpbmQiLCJhdHRyIiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsInByZXZpb3VzX29uY2xpY2siLCJ3cGJjX3VpX2VsX19yYWRpb19jb250YWluZXJfc2VsZWN0aW9uIiwiX3RoaXMiLCJpcyIsInBhcmVudHMiLCJyZW1vdmVBdHRyIiwid3BiY191aV9lbF9fcmFkaW9fY29udGFpbmVyX2NsaWNrIiwiaGFzQ2xhc3MiLCJqX3JhZGlvIiwicHJvcCIsInRyaWdnZXIiLCJ3cGJjX2NoZWNrX2Z1bGxfc2NyZWVuX21vZGUiLCJkb2N1bWVudCIsInJlYWR5Iiwid3BiY19kZWZpbmVfZ21haWxfY2hlY2tib3hfc2VsZWN0aW9uIiwiJCIsImNoZWNrcyIsImZpcnN0IiwibGFzdCIsImNoZWNrZWQiLCJzbGljZWQiLCJsYXN0Q2xpY2tlZCIsIm9uIiwiZSIsInNoaWZ0S2V5IiwiY2xvc2VzdCIsImZpbHRlciIsImluZGV4Iiwic2xpY2UiLCJ1bmNoZWNrZWQiLCJub3QiLCJjaGlsZHJlbiIsImV2ZW50IiwiJHRoaXMiLCIkdGFibGUiLCJjb250cm9sQ2hlY2tlZCIsInRvZ2dsZSIsImRhdGEiLCJnZXRTZWxlY3Rpb24iLCJyZW1vdmVBbGxSYW5nZXMiLCJ3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MiLCJ3cGJjX2dldF9zZWxlY3RlZF9yb3dfaWQiLCJjaGVja2JveGVzIiwic2VsZWN0ZWRfaWQiLCJlYWNoIiwia2V5IiwiY2hlY2tib3giLCJlbGVtZW50X2lkIiwid3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCIsInB1c2giLCJ0aGlzX2luYm91bmRfZWxlbWVudCIsInBhcnNlSW50IiwicmVwbGFjZSIsInNlbGVjdGVkX3Jvd3NfYXJyIiwic2hvdyIsImhpZGUiLCJ3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX21heCIsIndwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWluIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19jb21wYWN0Iiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19oaWRlIiwid3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19zaG93X3NlY3Rpb24iLCJtZW51X3RvX3Nob3ciLCJ3cGJjX3VybF9nZXRfYW5jaG9yc19hcnIiLCJoYXNoZXMiLCJ3aW5kb3ciLCJsb2NhdGlvbiIsImhhc2giLCJoYXNoZXNfYXJyIiwic3BsaXQiLCJyZXN1bHQiLCJoYXNoZXNfYXJyX2xlbmd0aCIsIndwYmNfYWRtaW5fdWlfX2RvX2V4cGFuZF9zZWN0aW9uIiwic2V0VGltZW91dCIsImFuY2hvcnNfYXJyIiwiYW5jaG9yc19hcnJfbGVuZ3RoIiwib25lX2FuY2hvcl9wcm9wX3ZhbHVlIiwic2VjdGlvbl90b19zaG93Iiwic2VjdGlvbl9pZF90b19zaG93Iiwic2VsZWN0ZWRfdGl0bGUiLCJ0ZXh0IiwiY29udGFpbmVyX3RvX2hpZGVfY2xhc3MiLCJ0YXJnZXRPZmZzZXQiLCJ3cGJjX3Njcm9sbF90byIsInNlY3Rpb25faWRfdGFiIiwic3Vic3RyaW5nIiwidmFsIiwid3BiY19hZG1pbl91aV9fZG9fX2FuY2hvcl9fYW5vdGhlcl9hY3Rpb25zIiwid3BiY19hZG1pbl91aV9fZG9fX29wZW5fdXJsX19leHBhbmRfc2VjdGlvbiIsInVybCIsInNlY3Rpb25faWQiLCJocmVmIiwidGhpc19hbmNob3IiLCJ0aGlzX2FuY2hvcl9wcm9wX3ZhbHVlIiwic2VjdGlvbl9hY3Rpb24iLCJ3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkX2Zyb21fZWxlbWVudCIsImh0bWxfZWxlbWVudF9pZCIsImNvcHlUZXh0IiwiZ2V0RWxlbWVudEJ5SWQiLCJzZWxlY3QiLCJzZXRTZWxlY3Rpb25SYW5nZSIsImlzX2NvcGllZCIsIndwYmNfY29weV90ZXh0X3RvX2NsaXBicmQiLCJ2YWx1ZSIsImNvbnNvbGUiLCJlcnJvciIsIm5hdmlnYXRvciIsImNsaXBib2FyZCIsIndwYmNfZmFsbGJhY2tfY29weV90ZXh0X3RvX2NsaXBicmQiLCJ3cml0ZVRleHQiLCJ0aGVuIiwiZXJyIiwiY29udGFpbmVyIiwiY3JlYXRlRWxlbWVudCIsImlubmVySFRNTCIsInN0eWxlIiwicG9zaXRpb24iLCJwb2ludGVyRXZlbnRzIiwiYWN0aXZlU2hlZXRzIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJjYWxsIiwic3R5bGVTaGVldHMiLCJzaGVldCIsImRpc2FibGVkIiwiYm9keSIsImFwcGVuZENoaWxkIiwicmFuZ2UiLCJjcmVhdGVSYW5nZSIsInNlbGVjdE5vZGUiLCJhZGRSYW5nZSIsImV4ZWNDb21tYW5kIiwiYWN0aXZlU2hlZXRzX2xlbmd0aCIsInJlbW92ZUNoaWxkIl0sInNvdXJjZXMiOlsidWlfZWxlbWVudHMuanMiLCJ1aV9sb2FkaW5nX3NwaW4uanMiLCJ1aV9yYWRpb19jb250YWluZXIuanMiLCJ1aV9mdWxsX3NjcmVlbl9tb2RlLmpzIiwiZ21haWxfY2hlY2tib3hfc2VsZWN0aW9uLmpzIiwiYm9va2luZ3NfY2hlY2tib3hfc2VsZWN0aW9uLmpzIiwidWlfc2lkZWJhcl9sZWZ0X19hY3Rpb25zLmpzIiwiY29weV90ZXh0X3RvX2NsaXBicmQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXHJcbi8qKlxyXG4gKiBCbGluayBzcGVjaWZpYyBIVE1MIGVsZW1lbnQgdG8gc2V0IGF0dGVudGlvbiB0byB0aGlzIGVsZW1lbnQuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBlbGVtZW50X3RvX2JsaW5rXHRcdCAgLSBjbGFzcyBvciBpZCBvZiBlbGVtZW50OiAnLndwYmNfd2lkZ2V0X2F2YWlsYWJsZV91bmF2YWlsYWJsZSdcclxuICogQHBhcmFtIHtpbnR9IGhvd19tYW55X3RpbWVzXHRcdFx0ICAtIDRcclxuICogQHBhcmFtIHtpbnR9IGhvd19sb25nX3RvX2JsaW5rXHRcdCAgLSAzNTBcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmxpbmtfZWxlbWVudCggZWxlbWVudF90b19ibGluaywgaG93X21hbnlfdGltZXMgPSA0LCBob3dfbG9uZ190b19ibGluayA9IDM1MCApe1xyXG5cclxuXHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBob3dfbWFueV90aW1lczsgaSsrICl7XHJcblx0XHRqUXVlcnkoIGVsZW1lbnRfdG9fYmxpbmsgKS5mYWRlT3V0KCBob3dfbG9uZ190b19ibGluayApLmZhZGVJbiggaG93X2xvbmdfdG9fYmxpbmsgKTtcclxuXHR9XHJcbiAgICBqUXVlcnkoIGVsZW1lbnRfdG9fYmxpbmsgKS5hbmltYXRlKCB7b3BhY2l0eTogMX0sIDUwMCApO1xyXG59XHJcbiIsIi8qKlxyXG4gKiAgIFN1cHBvcnQgRnVuY3Rpb25zIC0gU3BpbiBJY29uIGluIEJ1dHRvbnMgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIFJlbW92ZSBzcGluIGljb24gZnJvbSAgYnV0dG9uIGFuZCBFbmFibGUgdGhpcyBidXR0b24uXHJcbiAqXHJcbiAqIEBwYXJhbSBidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkXHRcdC0gSFRNTCBJRCBhdHRyaWJ1dGUgb2YgdGhpcyBidXR0b25cclxuICogQHJldHVybiBzdHJpbmdcdFx0XHRcdFx0XHQtIENTUyBjbGFzc2VzIHRoYXQgd2FzIHByZXZpb3VzbHkgaW4gYnV0dG9uIGljb25cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYnV0dG9uX19yZW1vdmVfc3BpbihidXR0b25fY2xpY2tlZF9lbGVtZW50X2lkKSB7XHJcblxyXG5cdHZhciBwcmV2aW9zX2NsYXNzZXMgPSAnJztcclxuXHRpZiAoXHJcblx0XHQodW5kZWZpbmVkICE9IGJ1dHRvbl9jbGlja2VkX2VsZW1lbnRfaWQpXHJcblx0XHQmJiAoJycgIT0gYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZClcclxuXHQpIHtcclxuXHRcdHZhciBqRWxlbWVudCA9IGpRdWVyeSggJyMnICsgYnV0dG9uX2NsaWNrZWRfZWxlbWVudF9pZCApO1xyXG5cdFx0aWYgKCBqRWxlbWVudC5sZW5ndGggKSB7XHJcblx0XHRcdHByZXZpb3NfY2xhc3NlcyA9IHdwYmNfYnV0dG9uX2Rpc2FibGVfbG9hZGluZ19pY29uKCBqRWxlbWVudC5nZXQoIDAgKSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHByZXZpb3NfY2xhc3NlcztcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTaG93IExvYWRpbmcgKHJvdGF0aW5nIGFycm93KSBpY29uIGZvciBidXR0b24gdGhhdCBoYXMgYmVlbiBjbGlja2VkXHJcbiAqXHJcbiAqIEBwYXJhbSB0aGlzX2J1dHRvblx0XHQtIHRoaXMgb2JqZWN0IG9mIHNwZWNpZmljIGJ1dHRvblxyXG4gKiBAcmV0dXJuIHN0cmluZ1x0XHRcdC0gQ1NTIGNsYXNzZXMgdGhhdCB3YXMgcHJldmlvdXNseSBpbiBidXR0b24gaWNvblxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19idXR0b25fZW5hYmxlX2xvYWRpbmdfaWNvbih0aGlzX2J1dHRvbikge1xyXG5cclxuXHR2YXIgakJ1dHRvbiAgICAgICAgID0galF1ZXJ5KCB0aGlzX2J1dHRvbiApO1xyXG5cdHZhciBqSWNvbiAgICAgICAgICAgPSBqQnV0dG9uLmZpbmQoICdpJyApO1xyXG5cdHZhciBwcmV2aW9zX2NsYXNzZXMgPSBqSWNvbi5hdHRyKCAnY2xhc3MnICk7XHJcblxyXG5cdGpJY29uLnJlbW92ZUNsYXNzKCkuYWRkQ2xhc3MoICdtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluJyApO1x0Ly8gU2V0IFJvdGF0ZSBpY29uLlxyXG5cdC8vIGpJY29uLmFkZENsYXNzKCAnd3BiY19hbmltYXRpb25fcGF1c2UnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUGF1c2UgYW5pbWF0aW9uLlxyXG5cdC8vIGpJY29uLmFkZENsYXNzKCAnd3BiY191aV9yZWQnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFNldCBpY29uIGNvbG9yIHJlZC5cclxuXHJcblx0akljb24uYXR0ciggJ3dwYmNfcHJldmlvdXNfY2xhc3MnLCBwcmV2aW9zX2NsYXNzZXMgKVxyXG5cclxuXHRqQnV0dG9uLmFkZENsYXNzKCAnZGlzYWJsZWQnICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRGlzYWJsZSBidXR0b25cclxuXHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYXR0ciBpbnN0ZWFkIG9mIHByb3AsIGJlY2F1c2UgZm9yIEEgZWxlbWVudHMsICBhdHRyaWJ1dGUgJ2Rpc2FibGVkJyBkbyAgbm90IGFkZGVkIHdpdGggakJ1dHRvbi5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTsuXHJcblxyXG5cdGpCdXR0b24uYXR0ciggJ3dwYmNfcHJldmlvdXNfb25jbGljaycsIGpCdXR0b24uYXR0ciggJ29uY2xpY2snICkgKTtcdFx0Ly8gU2F2ZSB0aGlzIHZhbHVlLlxyXG5cdGpCdXR0b24uYXR0ciggJ29uY2xpY2snLCAnJyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBEaXNhYmxlIGFjdGlvbnMgXCJvbiBjbGlja1wiLlxyXG5cclxuXHRyZXR1cm4gcHJldmlvc19jbGFzc2VzO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEhpZGUgTG9hZGluZyAocm90YXRpbmcgYXJyb3cpIGljb24gZm9yIGJ1dHRvbiB0aGF0IHdhcyBjbGlja2VkIGFuZCBzaG93IHByZXZpb3VzIGljb24gYW5kIGVuYWJsZSBidXR0b25cclxuICpcclxuICogQHBhcmFtIHRoaXNfYnV0dG9uXHRcdC0gdGhpcyBvYmplY3Qgb2Ygc3BlY2lmaWMgYnV0dG9uXHJcbiAqIEByZXR1cm4gc3RyaW5nXHRcdFx0LSBDU1MgY2xhc3NlcyB0aGF0IHdhcyBwcmV2aW91c2x5IGluIGJ1dHRvbiBpY29uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2J1dHRvbl9kaXNhYmxlX2xvYWRpbmdfaWNvbih0aGlzX2J1dHRvbikge1xyXG5cclxuXHR2YXIgakJ1dHRvbiA9IGpRdWVyeSggdGhpc19idXR0b24gKTtcclxuXHR2YXIgakljb24gICA9IGpCdXR0b24uZmluZCggJ2knICk7XHJcblxyXG5cdHZhciBwcmV2aW9zX2NsYXNzZXMgPSBqSWNvbi5hdHRyKCAnd3BiY19wcmV2aW91c19jbGFzcycgKTtcclxuXHRpZiAoXHJcblx0XHQodW5kZWZpbmVkICE9IHByZXZpb3NfY2xhc3NlcylcclxuXHRcdCYmICgnJyAhPSBwcmV2aW9zX2NsYXNzZXMpXHJcblx0KSB7XHJcblx0XHRqSWNvbi5yZW1vdmVDbGFzcygpLmFkZENsYXNzKCBwcmV2aW9zX2NsYXNzZXMgKTtcclxuXHR9XHJcblxyXG5cdGpCdXR0b24ucmVtb3ZlQ2xhc3MoICdkaXNhYmxlZCcgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZW1vdmUgRGlzYWJsZSBidXR0b24uXHJcblxyXG5cdHZhciBwcmV2aW91c19vbmNsaWNrID0gakJ1dHRvbi5hdHRyKCAnd3BiY19wcmV2aW91c19vbmNsaWNrJyApXHJcblx0aWYgKFxyXG5cdFx0KHVuZGVmaW5lZCAhPSBwcmV2aW91c19vbmNsaWNrKVxyXG5cdFx0JiYgKCcnICE9IHByZXZpb3VzX29uY2xpY2spXHJcblx0KSB7XHJcblx0XHRqQnV0dG9uLmF0dHIoICdvbmNsaWNrJywgcHJldmlvdXNfb25jbGljayApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHByZXZpb3NfY2xhc3NlcztcclxufVxyXG4iLCIvKipcclxuICogT24gc2VsZWN0aW9uICBvZiByYWRpbyBidXR0b24sIGFkanVzdCBhdHRyaWJ1dGVzIG9mIHJhZGlvIGNvbnRhaW5lclxyXG4gKlxyXG4gKiBAcGFyYW0gX3RoaXNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9zZWxlY3Rpb24oX3RoaXMpIHtcclxuXHJcblx0aWYgKCBqUXVlcnkoIF90aGlzICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfdWlfcmFkaW9fc2VjdGlvbicgKS5maW5kKCAnLndwYmNfdWlfcmFkaW9fY29udGFpbmVyJyApLnJlbW92ZUF0dHIoICdkYXRhLXNlbGVjdGVkJyApO1xyXG5cdFx0alF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY191aV9yYWRpb19jb250YWluZXI6bm90KC5kaXNhYmxlZCknICkuYXR0ciggJ2RhdGEtc2VsZWN0ZWQnLCB0cnVlICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIGpRdWVyeSggX3RoaXMgKS5pcyggJzpkaXNhYmxlZCcgKSApIHtcclxuXHRcdGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfdWlfcmFkaW9fY29udGFpbmVyJyApLmFkZENsYXNzKCAnZGlzYWJsZWQnICk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogT24gY2xpY2sgb24gUmFkaW8gQ29udGFpbmVyLCB3ZSB3aWxsICBzZWxlY3QgIHRoZSAgcmFkaW8gYnV0dG9uICAgIGFuZCB0aGVuIGFkanVzdCBhdHRyaWJ1dGVzIG9mIHJhZGlvIGNvbnRhaW5lclxyXG4gKlxyXG4gKiBAcGFyYW0gX3RoaXNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdWlfZWxfX3JhZGlvX2NvbnRhaW5lcl9jbGljayhfdGhpcykge1xyXG5cclxuXHRpZiAoIGpRdWVyeSggX3RoaXMgKS5oYXNDbGFzcyggJ2Rpc2FibGVkJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyIGpfcmFkaW8gPSBqUXVlcnkoIF90aGlzICkuZmluZCggJ2lucHV0W3R5cGU9cmFkaW9dOm5vdCgud3BiYy1mb3JtLXJhZGlvLWludGVybmFsKScgKTtcclxuXHRpZiAoIGpfcmFkaW8ubGVuZ3RoICkge1xyXG5cdFx0al9yYWRpby5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdH1cclxuXHJcbn0iLCJcInVzZSBzdHJpY3RcIjtcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IEZ1bGwgU2NyZWVuICAtICBzdXBwb3J0IGZ1bmN0aW9ucyAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIEZ1bGwgIHNjcmVlbiBtb2RlLCAgYnkgIHJlbW92aW5nIHRvcCB0YWJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpe1xyXG5cdGlmICggalF1ZXJ5KCAnYm9keScgKS5oYXNDbGFzcyggJ3dwYmNfYWRtaW5fZnVsbF9zY3JlZW4nICkgKSB7XHJcblx0XHRqUXVlcnkoICdodG1sJyApLnJlbW92ZUNsYXNzKCAnd3AtdG9vbGJhcicgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCcgKS5hZGRDbGFzcyggJ3dwLXRvb2xiYXInICk7XHJcblx0fVxyXG59XHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkge1xyXG5cdHdwYmNfY2hlY2tfZnVsbF9zY3JlZW5fbW9kZSgpO1xyXG59ICk7IiwiLyoqXHJcbiAqIENoZWNrYm94IFNlbGVjdGlvbiBmdW5jdGlvbnMgZm9yIExpc3RpbmcuXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbGVjdGlvbnMgb2Ygc2V2ZXJhbCAgY2hlY2tib3hlcyBsaWtlIGluIGdNYWlsIHdpdGggc2hpZnQgOilcclxuICogTmVlZCB0byAgaGF2ZSB0aGlzIHN0cnVjdHVyZTpcclxuICogLndwYmNfc2VsZWN0YWJsZV90YWJsZVxyXG4gKiAgICAgIC53cGJjX3NlbGVjdGFibGVfaGVhZFxyXG4gKiAgICAgICAgICAgICAgLmNoZWNrLWNvbHVtblxyXG4gKiAgICAgICAgICAgICAgICAgIDpjaGVja2JveFxyXG4gKiAgICAgIC53cGJjX3NlbGVjdGFibGVfYm9keVxyXG4gKiAgICAgICAgICAud3BiY19yb3dcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICogICAgICAud3BiY19zZWxlY3RhYmxlX2Zvb3RcclxuICogICAgICAgICAgICAgIC5jaGVjay1jb2x1bW5cclxuICogICAgICAgICAgICAgICAgICA6Y2hlY2tib3hcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX2dtYWlsX2NoZWNrYm94X3NlbGVjdGlvbiggJCApe1xyXG5cclxuXHR2YXIgY2hlY2tzLCBmaXJzdCwgbGFzdCwgY2hlY2tlZCwgc2xpY2VkLCBsYXN0Q2xpY2tlZCA9IGZhbHNlO1xyXG5cclxuXHQvLyBDaGVjayBhbGwgY2hlY2tib3hlcy5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICcuY2hlY2stY29sdW1uJyApLmZpbmQoICc6Y2hlY2tib3gnICkub24oXHJcblx0XHQnY2xpY2snLFxyXG5cdFx0ZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0aWYgKCAndW5kZWZpbmVkJyA9PSBlLnNoaWZ0S2V5ICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZS5zaGlmdEtleSApIHtcclxuXHRcdFx0XHRpZiAoICEgbGFzdENsaWNrZWQgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2hlY2tzICA9ICQoIGxhc3RDbGlja2VkICkuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maW5kKCAnOmNoZWNrYm94JyApLmZpbHRlciggJzp2aXNpYmxlOmVuYWJsZWQnICk7XHJcblx0XHRcdFx0Zmlyc3QgICA9IGNoZWNrcy5pbmRleCggbGFzdENsaWNrZWQgKTtcclxuXHRcdFx0XHRsYXN0ICAgID0gY2hlY2tzLmluZGV4KCB0aGlzICk7XHJcblx0XHRcdFx0Y2hlY2tlZCA9ICQoIHRoaXMgKS5wcm9wKCAnY2hlY2tlZCcgKTtcclxuXHRcdFx0XHRpZiAoIDAgPCBmaXJzdCAmJiAwIDwgbGFzdCAmJiBmaXJzdCAhPSBsYXN0ICkge1xyXG5cdFx0XHRcdFx0c2xpY2VkID0gKGxhc3QgPiBmaXJzdCkgPyBjaGVja3Muc2xpY2UoIGZpcnN0LCBsYXN0ICkgOiBjaGVja3Muc2xpY2UoIGxhc3QsIGZpcnN0ICk7XHJcblx0XHRcdFx0XHRzbGljZWQucHJvcChcclxuXHRcdFx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCAkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3JvdycgKS5pcyggJzp2aXNpYmxlJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGNoZWNrZWQ7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0KS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRsYXN0Q2xpY2tlZCA9IHRoaXM7XHJcblxyXG5cdFx0XHQvLyB0b2dnbGUgXCJjaGVjayBhbGxcIiBjaGVja2JveGVzLlxyXG5cdFx0XHR2YXIgdW5jaGVja2VkID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY19zZWxlY3RhYmxlX2JvZHknICkuZmluZCggJzpjaGVja2JveCcgKS5maWx0ZXIoICc6dmlzaWJsZTplbmFibGVkJyApLm5vdCggJzpjaGVja2VkJyApO1xyXG5cdFx0XHQkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3NlbGVjdGFibGVfdGFibGUnICkuY2hpbGRyZW4oICcud3BiY19zZWxlY3RhYmxlX2hlYWQsIC53cGJjX3NlbGVjdGFibGVfZm9vdCcgKS5maW5kKCAnOmNoZWNrYm94JyApLnByb3AoXHJcblx0XHRcdFx0J2NoZWNrZWQnLFxyXG5cdFx0XHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHJldHVybiAoMCA9PT0gdW5jaGVja2VkLmxlbmd0aCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHQvLyBIZWFkIHx8IEZvb3QgY2xpY2tpbmcgdG8gIHNlbGVjdCAvIGRlc2VsZWN0IEFMTC5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9oZWFkLCAud3BiY19zZWxlY3RhYmxlX2Zvb3QnICkuZmluZCggJy5jaGVjay1jb2x1bW4gOmNoZWNrYm94JyApLm9uKFxyXG5cdFx0J2NsaWNrJyxcclxuXHRcdGZ1bmN0aW9uIChldmVudCkge1xyXG5cdFx0XHR2YXIgJHRoaXMgICAgICAgICAgPSAkKCB0aGlzICksXHJcblx0XHRcdFx0JHRhYmxlICAgICAgICAgPSAkdGhpcy5jbG9zZXN0KCAnLndwYmNfc2VsZWN0YWJsZV90YWJsZScgKSxcclxuXHRcdFx0XHRjb250cm9sQ2hlY2tlZCA9ICR0aGlzLnByb3AoICdjaGVja2VkJyApLFxyXG5cdFx0XHRcdHRvZ2dsZSAgICAgICAgID0gZXZlbnQuc2hpZnRLZXkgfHwgJHRoaXMuZGF0YSggJ3dwLXRvZ2dsZScgKTtcclxuXHJcblx0XHRcdCR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maWx0ZXIoICc6dmlzaWJsZScgKVxyXG5cdFx0XHRcdC5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApXHJcblx0XHRcdFx0LnByb3AoXHJcblx0XHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdGlmICggJCggdGhpcyApLmlzKCAnOmhpZGRlbiw6ZGlzYWJsZWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGlmICggdG9nZ2xlICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiAhICQoIHRoaXMgKS5wcm9wKCAnY2hlY2tlZCcgKTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggY29udHJvbENoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHJcblx0XHRcdCR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfaGVhZCwgIC53cGJjX3NlbGVjdGFibGVfZm9vdCcgKS5maWx0ZXIoICc6dmlzaWJsZScgKVxyXG5cdFx0XHRcdC5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApXHJcblx0XHRcdFx0LnByb3AoXHJcblx0XHRcdFx0XHQnY2hlY2tlZCcsXHJcblx0XHRcdFx0XHRmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdGlmICggdG9nZ2xlICkge1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICggY29udHJvbENoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdCk7XHJcblx0XHR9XHJcblx0KTtcclxuXHJcblxyXG5cdC8vIFZpc3VhbGx5ICBzaG93IHNlbGVjdGVkIGJvcmRlci5cclxuXHQkKCAnLndwYmNfc2VsZWN0YWJsZV9ib2R5JyApLmZpbmQoICcuY2hlY2stY29sdW1uIDpjaGVja2JveCcgKS5vbihcclxuXHRcdCdjaGFuZ2UnLFxyXG5cdFx0ZnVuY3Rpb24gKGV2ZW50KSB7XHJcblx0XHRcdGlmICggalF1ZXJ5KCB0aGlzICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRqUXVlcnkoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfbGlzdF9yb3cnICkuYWRkQ2xhc3MoICdyb3dfc2VsZWN0ZWRfY29sb3InICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0alF1ZXJ5KCB0aGlzICkuY2xvc2VzdCggJy53cGJjX2xpc3Rfcm93JyApLnJlbW92ZUNsYXNzKCAncm93X3NlbGVjdGVkX2NvbG9yJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBEaXNhYmxlIHRleHQgc2VsZWN0aW9uIHdoaWxlIHByZXNzaW5nICdzaGlmdCcuXHJcblx0XHRcdGRvY3VtZW50LmdldFNlbGVjdGlvbigpLnJlbW92ZUFsbFJhbmdlcygpO1xyXG5cclxuXHRcdFx0Ly8gU2hvdyBvciBoaWRlIGJ1dHRvbnMgb24gQWN0aW9ucyB0b29sYmFyICBhdCAgQm9va2luZyBMaXN0aW5nICBwYWdlLCAgaWYgd2UgaGF2ZSBzb21lIHNlbGVjdGVkIGJvb2tpbmdzLlxyXG5cdFx0XHR3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKTtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHR3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKTtcclxufVxyXG4iLCJcclxuLyoqXHJcbiAqIEdldCBJRCBhcnJheSAgb2Ygc2VsZWN0ZWQgZWxlbWVudHNcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGVkX3Jvd19pZCgpIHtcclxuXHJcblx0dmFyICR0YWJsZSAgICAgID0galF1ZXJ5KCAnLndwYmNfX3dyYXBfX2Jvb2tpbmdfbGlzdGluZyAud3BiY19zZWxlY3RhYmxlX3RhYmxlJyApO1xyXG5cdHZhciBjaGVja2JveGVzICA9ICR0YWJsZS5jaGlsZHJlbiggJy53cGJjX3NlbGVjdGFibGVfYm9keScgKS5maWx0ZXIoICc6dmlzaWJsZScgKS5maW5kKCAnLmNoZWNrLWNvbHVtbicgKS5maW5kKCAnOmNoZWNrYm94JyApO1xyXG5cdHZhciBzZWxlY3RlZF9pZCA9IFtdO1xyXG5cclxuXHRqUXVlcnkuZWFjaChcclxuXHRcdGNoZWNrYm94ZXMsXHJcblx0XHRmdW5jdGlvbiAoa2V5LCBjaGVja2JveCkge1xyXG5cdFx0XHRpZiAoIGpRdWVyeSggY2hlY2tib3ggKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdHZhciBlbGVtZW50X2lkID0gd3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCggY2hlY2tib3ggKTtcclxuXHRcdFx0XHRzZWxlY3RlZF9pZC5wdXNoKCBlbGVtZW50X2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHRyZXR1cm4gc2VsZWN0ZWRfaWQ7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogR2V0IElEIG9mIHJvdywgIGJhc2VkIG9uIGNsY2lrZWQgZWxlbWVudFxyXG4gKlxyXG4gKiBAcGFyYW0gdGhpc19pbmJvdW5kX2VsZW1lbnQgIC0gdXN1c2xseSAgdGhpc1xyXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19nZXRfcm93X2lkX2Zyb21fZWxlbWVudCh0aGlzX2luYm91bmRfZWxlbWVudCkge1xyXG5cclxuXHR2YXIgZWxlbWVudF9pZCA9IGpRdWVyeSggdGhpc19pbmJvdW5kX2VsZW1lbnQgKS5jbG9zZXN0KCAnLndwYmNfbGlzdGluZ191c3VhbF9yb3cnICkuYXR0ciggJ2lkJyApO1xyXG5cclxuXHRlbGVtZW50X2lkID0gcGFyc2VJbnQoIGVsZW1lbnRfaWQucmVwbGFjZSggJ3Jvd19pZF8nLCAnJyApICk7XHJcblxyXG5cdHJldHVybiBlbGVtZW50X2lkO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqID09IEJvb2tpbmcgTGlzdGluZyA9PSBTaG93IG9yIGhpZGUgYnV0dG9ucyBvbiBBY3Rpb25zIHRvb2xiYXIgIGF0ICAgIHBhZ2UsICBpZiB3ZSBoYXZlIHNvbWUgc2VsZWN0ZWQgYm9va2luZ3MuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3Nob3dfaGlkZV9hY3Rpb25fYnV0dG9uc19mb3Jfc2VsZWN0ZWRfYm9va2luZ3MoKXtcclxuXHJcblx0dmFyIHNlbGVjdGVkX3Jvd3NfYXJyID0gd3BiY19nZXRfc2VsZWN0ZWRfcm93X2lkKCk7XHJcblxyXG5cdGlmICggc2VsZWN0ZWRfcm93c19hcnIubGVuZ3RoID4gMCApIHtcclxuXHRcdGpRdWVyeSggJy5oaWRlX2J1dHRvbl9pZl9ub19zZWxlY3Rpb24nICkuc2hvdygpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRqUXVlcnkoICcuaGlkZV9idXR0b25faWZfbm9fc2VsZWN0aW9uJyApLmhpZGUoKTtcclxuXHR9XHJcbn0iLCJcInVzZSBzdHJpY3RcIjtcclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09IExlZnQgQmFyICAtICBleHBhbmQgLyBjb2xhcHNlIGZ1bmN0aW9ucyAgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuLyoqXHJcbiAqIEV4cGFuZCBWZXJ0aWNhbCBMZWZ0IEJhci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX3NpZGViYXJfbGVmdF9fZG9fbWF4KCkge1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5yZW1vdmVDbGFzcyggJ21pbiBtYXggY29tcGFjdCBub25lJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3NldHRpbmdzX3BhZ2Vfd3JhcHBlcicgKS5hZGRDbGFzcyggJ21heCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBIaWRlIFZlcnRpY2FsIExlZnQgQmFyLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZG1pbl91aV9fc2lkZWJhcl9sZWZ0X19kb19taW4oKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbWluJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5fb3Blbl9sZWZ0X3ZlcnRpY2FsX25hdicgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9oaWRlX2xlZnRfdmVydGljYWxfbmF2JyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbGFwc2UgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX2NvbXBhY3QoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnY29tcGFjdCcgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21wbGV0ZWx5IEhpZGUgVmVydGljYWwgTGVmdCBCYXIuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX2RvX2hpZGUoKSB7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLnJlbW92ZUNsYXNzKCAnbWluIG1heCBjb21wYWN0IG5vbmUnICk7XHJcblx0alF1ZXJ5KCAnLndwYmNfc2V0dGluZ3NfcGFnZV93cmFwcGVyJyApLmFkZENsYXNzKCAnbm9uZScgKTtcclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX29wZW5fbGVmdF92ZXJ0aWNhbF9uYXYnICkucmVtb3ZlQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX190b3BfbmF2X19idG5faGlkZV9sZWZ0X3ZlcnRpY2FsX25hdicgKS5hZGRDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcblx0Ly8gSGlkZSB0b3AgXCJNZW51XCIgYnV0dG9uIHdpdGggZGl2aWRlci5cclxuXHRqUXVlcnkoICcud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfbGVmdF92ZXJ0aWNhbF9uYXYsLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X2xlZnRfdmVydGljYWxfbmF2X2RpdmlkZXInICkuYWRkQ2xhc3MoICd3cGJjX3VpX19oaWRlJyApO1xyXG59XHJcblxyXG4vKipcclxuICogQWN0aW9uIG9uIGNsaWNrIFwiR28gQmFja1wiIC0gc2hvdyByb290IG1lbnVcclxuICogb3Igc29tZSBvdGhlciBzZWN0aW9uIGluIGxlZnQgc2lkZWJhci5cclxuICpcclxuICogQHBhcmFtIHN0cmluZyBtZW51X3RvX3Nob3cgLSBtZW51IHNsdWcuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19zaWRlYmFyX2xlZnRfX3Nob3dfc2VjdGlvbiggbWVudV90b19zaG93ICkge1xyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uJyApLmFkZENsYXNzKCAnd3BiY191aV9faGlkZScgKVxyXG5cdGpRdWVyeSggJy53cGJjX3VpX2VsX192ZXJ0X2xlZnRfYmFyX19zZWN0aW9uXycgKyBtZW51X3RvX3Nob3cgKS5yZW1vdmVDbGFzcyggJ3dwYmNfdWlfX2hpZGUnICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogR2V0IGFuY2hvcihzKSBhcnJheSAgZnJvbSAgVVJMLlxyXG4gKiBEb2M6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9Mb2NhdGlvblxyXG4gKlxyXG4gKiBAcmV0dXJucyB7KltdfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY191cmxfZ2V0X2FuY2hvcnNfYXJyKCkge1xyXG5cdHZhciBoYXNoZXMgICAgICAgICAgICA9IHdpbmRvdy5sb2NhdGlvbi5oYXNoLnJlcGxhY2UoICclMjMnLCAnIycgKTtcclxuXHR2YXIgaGFzaGVzX2FyciAgICAgICAgPSBoYXNoZXMuc3BsaXQoICcjJyApO1xyXG5cdHZhciByZXN1bHQgICAgICAgICAgICA9IFtdO1xyXG5cdHZhciBoYXNoZXNfYXJyX2xlbmd0aCA9IGhhc2hlc19hcnIubGVuZ3RoO1xyXG5cclxuXHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBoYXNoZXNfYXJyX2xlbmd0aDsgaSsrICkge1xyXG5cdFx0aWYgKCBoYXNoZXNfYXJyW2ldLmxlbmd0aCA+IDAgKSB7XHJcblx0XHRcdHJlc3VsdC5wdXNoKCBoYXNoZXNfYXJyW2ldICk7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdXRvIEV4cGFuZCBTZXR0aW5ncyBzZWN0aW9uIGJhc2VkIG9uIFVSTCBhbmNob3IsIGFmdGVyICBwYWdlIGxvYWRlZC5cclxuICovXHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkgeyB3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpOyBzZXRUaW1lb3V0KCAnd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24nLCAxMCApOyB9ICk7XHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCkgeyB3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpOyBzZXRUaW1lb3V0KCAnd3BiY19hZG1pbl91aV9fZG9fZXhwYW5kX3NlY3Rpb24nLCAxNTAgKTsgfSApO1xyXG5cclxuLyoqXHJcbiAqIEV4cGFuZCBzZWN0aW9uIGluICBHZW5lcmFsIFNldHRpbmdzIHBhZ2UgYW5kIHNlbGVjdCBNZW51IGl0ZW0uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpIHtcclxuXHJcblx0Ly8gd2luZG93LmxvY2F0aW9uLmhhc2ggID0gI3NlY3Rpb25faWQgIC8gIGRvYzogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0xvY2F0aW9uIC5cclxuXHR2YXIgYW5jaG9yc19hcnIgICAgICAgID0gd3BiY191cmxfZ2V0X2FuY2hvcnNfYXJyKCk7XHJcblx0dmFyIGFuY2hvcnNfYXJyX2xlbmd0aCA9IGFuY2hvcnNfYXJyLmxlbmd0aDtcclxuXHJcblx0aWYgKCBhbmNob3JzX2Fycl9sZW5ndGggPiAwICkge1xyXG5cdFx0dmFyIG9uZV9hbmNob3JfcHJvcF92YWx1ZSA9IGFuY2hvcnNfYXJyWzBdLnNwbGl0KCAnZG9fZXhwYW5kX18nICk7XHJcblx0XHRpZiAoIG9uZV9hbmNob3JfcHJvcF92YWx1ZS5sZW5ndGggPiAxICkge1xyXG5cclxuXHRcdFx0Ly8gJ3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl9tZXRhYm94J1xyXG5cdFx0XHR2YXIgc2VjdGlvbl90b19zaG93ICAgID0gb25lX2FuY2hvcl9wcm9wX3ZhbHVlWzFdO1xyXG5cdFx0XHR2YXIgc2VjdGlvbl9pZF90b19zaG93ID0gJyMnICsgc2VjdGlvbl90b19zaG93O1xyXG5cclxuXHJcblx0XHRcdC8vIC0tIFJlbW92ZSBzZWxlY3RlZCBiYWNrZ3JvdW5kIGluIGFsbCBsZWZ0ICBtZW51ICBpdGVtcyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0alF1ZXJ5KCAnLndwYmNfdWlfZWxfX3ZlcnRfbmF2X2l0ZW0gJyApLnJlbW92ZUNsYXNzKCAnYWN0aXZlJyApO1xyXG5cdFx0XHQvLyBTZXQgbGVmdCBtZW51IHNlbGVjdGVkLlxyXG5cdFx0XHRqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rJyApLmFkZENsYXNzKCAnYWN0aXZlJyApO1xyXG5cdFx0XHR2YXIgc2VsZWN0ZWRfdGl0bGUgPSBqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rIGEgLndwYmNfdWlfZWxfX3ZlcnRfbmF2X3RpdGxlICcgKS50ZXh0KCk7XHJcblxyXG5cdFx0XHQvLyBFeHBhbmQgc2VjdGlvbiwgaWYgaXQgY29sYXBzZWQuXHJcblx0XHRcdGlmICggISBqUXVlcnkoICcuZG9fZXhwYW5kX18nICsgc2VjdGlvbl90b19zaG93ICsgJ19saW5rJyApLnBhcmVudHMoICcud3BiY191aV9lbF9fbGV2ZWxfX2ZvbGRlcicgKS5oYXNDbGFzcyggJ2V4cGFuZGVkJyApICkge1xyXG5cdFx0XHRcdGpRdWVyeSggJy53cGJjX3VpX2VsX19sZXZlbF9fZm9sZGVyJyApLnJlbW92ZUNsYXNzKCAnZXhwYW5kZWQnICk7XHJcblx0XHRcdFx0alF1ZXJ5KCAnLmRvX2V4cGFuZF9fJyArIHNlY3Rpb25fdG9fc2hvdyArICdfbGluaycgKS5wYXJlbnRzKCAnLndwYmNfdWlfZWxfX2xldmVsX19mb2xkZXInICkuYWRkQ2xhc3MoICdleHBhbmRlZCcgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0gRXhwYW5kIHNlY3Rpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdHZhciBjb250YWluZXJfdG9faGlkZV9jbGFzcyA9ICcucG9zdGJveCc7XHJcblx0XHRcdC8vIEhpZGUgc2VjdGlvbnMgJy5wb3N0Ym94JyBpbiBhZG1pbiBwYWdlIGFuZCBzaG93IHNwZWNpZmljIG9uZS5cclxuXHRcdFx0alF1ZXJ5KCAnLndwYmNfYWRtaW5fcGFnZSAnICsgY29udGFpbmVyX3RvX2hpZGVfY2xhc3MgKS5oaWRlKCk7XHJcblx0XHRcdGpRdWVyeSggJy53cGJjX2NvbnRhaW5lcl9hbHdheXNfaGlkZV9fb25fbGVmdF9uYXZfY2xpY2snICkuaGlkZSgpO1xyXG5cdFx0XHRqUXVlcnkoIHNlY3Rpb25faWRfdG9fc2hvdyApLnNob3coKTtcclxuXHJcblx0XHRcdC8vIFNob3cgYWxsIG90aGVyIHNlY3Rpb25zLCAgaWYgcHJvdmlkZWQgaW4gVVJMOiAuLj9wYWdlPXdwYmMtc2V0dGluZ3MjZG9fZXhwYW5kX193cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfbWV0YWJveCN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfdXBncmFkZV9tZXRhYm94IC5cclxuXHRcdFx0Zm9yICggbGV0IGkgPSAxOyBpIDwgYW5jaG9yc19hcnJfbGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0alF1ZXJ5KCAnIycgKyBhbmNob3JzX2FycltpXSApLnNob3coKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBmYWxzZSApIHtcclxuXHRcdFx0XHR2YXIgdGFyZ2V0T2Zmc2V0ID0gd3BiY19zY3JvbGxfdG8oIHNlY3Rpb25faWRfdG9fc2hvdyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLSBTZXQgVmFsdWUgdG8gSW5wdXQgYWJvdXQgc2VsZWN0ZWQgTmF2IGVsZW1lbnQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAgICAgICAvLyBGaXhJbjogOS44LjYuMS5cclxuXHRcdFx0dmFyIHNlY3Rpb25faWRfdGFiID0gc2VjdGlvbl9pZF90b19zaG93LnN1YnN0cmluZyggMCwgc2VjdGlvbl9pZF90b19zaG93Lmxlbmd0aCAtIDggKSArICdfdGFiJztcclxuXHRcdFx0aWYgKCBjb250YWluZXJfdG9faGlkZV9jbGFzcyA9PSBzZWN0aW9uX2lkX3RvX3Nob3cgKSB7XHJcblx0XHRcdFx0c2VjdGlvbl9pZF90YWIgPSAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19hbGxfdGFiJ1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfbWV0YWJveCwjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhcGFjaXR5X3VwZ3JhZGVfbWV0YWJveCcgPT0gc2VjdGlvbl9pZF90b19zaG93ICkge1xyXG5cdFx0XHRcdHNlY3Rpb25faWRfdGFiID0gJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FwYWNpdHlfdGFiJ1xyXG5cdFx0XHR9XHJcblx0XHRcdGpRdWVyeSggJyNmb3JtX3Zpc2libGVfc2VjdGlvbicgKS52YWwoIHNlY3Rpb25faWRfdGFiICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTGlrZSBibGlua2luZyBzb21lIGVsZW1lbnRzLlxyXG5cdFx0d3BiY19hZG1pbl91aV9fZG9fX2FuY2hvcl9fYW5vdGhlcl9hY3Rpb25zKCk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogT3BlbiBzZXR0aW5ncyBwYWdlICB8ICBFeHBhbmQgc2VjdGlvbiAgfCAgU2VsZWN0IE1lbnUgaXRlbS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX19vcGVuX3VybF9fZXhwYW5kX3NlY3Rpb24odXJsLCBzZWN0aW9uX2lkKSB7XHJcblxyXG5cdC8vIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsICsgJyZkb19leHBhbmQ9JyArIHNlY3Rpb25faWQgKyAnI2RvX2V4cGFuZF9fJyArIHNlY3Rpb25faWQ7IC8vLlxyXG5cdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsICsgJyNkb19leHBhbmRfXycgKyBzZWN0aW9uX2lkO1xyXG5cclxuXHR3cGJjX2FkbWluX3VpX19kb19leHBhbmRfc2VjdGlvbigpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIENoZWNrICBmb3IgT3RoZXIgYWN0aW9uczogIExpa2UgYmxpbmtpbmcgc29tZSBlbGVtZW50cyBpbiBzZXR0aW5ncyBwYWdlLiBFLmcuIERheXMgc2VsZWN0aW9uICBvciAgY2hhbmdlLW92ZXIgZGF5cy5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYWRtaW5fdWlfX2RvX19hbmNob3JfX2Fub3RoZXJfYWN0aW9ucygpIHtcclxuXHJcblx0dmFyIGFuY2hvcnNfYXJyICAgICAgICA9IHdwYmNfdXJsX2dldF9hbmNob3JzX2FycigpO1xyXG5cdHZhciBhbmNob3JzX2Fycl9sZW5ndGggPSBhbmNob3JzX2Fyci5sZW5ndGg7XHJcblxyXG5cdC8vIE90aGVyIGFjdGlvbnM6ICBMaWtlIGJsaW5raW5nIHNvbWUgZWxlbWVudHMuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgYW5jaG9yc19hcnJfbGVuZ3RoOyBpKysgKSB7XHJcblxyXG5cdFx0dmFyIHRoaXNfYW5jaG9yID0gYW5jaG9yc19hcnJbaV07XHJcblxyXG5cdFx0dmFyIHRoaXNfYW5jaG9yX3Byb3BfdmFsdWUgPSB0aGlzX2FuY2hvci5zcGxpdCggJ2RvX290aGVyX2FjdGlvbnNfXycgKTtcclxuXHJcblx0XHRpZiAoIHRoaXNfYW5jaG9yX3Byb3BfdmFsdWUubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdHZhciBzZWN0aW9uX2FjdGlvbiA9IHRoaXNfYW5jaG9yX3Byb3BfdmFsdWVbMV07XHJcblxyXG5cdFx0XHRzd2l0Y2ggKCBzZWN0aW9uX2FjdGlvbiApIHtcclxuXHJcblx0XHRcdFx0Y2FzZSAnYmxpbmtfZGF5X3NlbGVjdGlvbnMnOlxyXG5cdFx0XHRcdFx0Ly8gd3BiY191aV9zZXR0aW5nc19fcGFuZWxfX2NsaWNrKCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl90YWIgYScsICcjd3BiY19nZW5lcmFsX3NldHRpbmdzX2NhbGVuZGFyX21ldGFib3gnLCAnRGF5cyBTZWxlY3Rpb24nICk7LlxyXG5cdFx0XHRcdFx0d3BiY19ibGlua19lbGVtZW50KCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3R5cGVfb2ZfZGF5X3NlbGVjdGlvbnMnLCA0LCAzNTAgKTtcclxuXHRcdFx0XHRcdFx0d3BiY19zY3JvbGxfdG8oICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfdHlwZV9vZl9kYXlfc2VsZWN0aW9ucycgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19jaGFuZ2Vfb3Zlcl9kYXlzJzpcclxuXHRcdFx0XHRcdC8vIHdwYmNfdWlfc2V0dGluZ3NfX3BhbmVsX19jbGljayggJyN3cGJjX2dlbmVyYWxfc2V0dGluZ3NfY2FsZW5kYXJfdGFiIGEnLCAnI3dwYmNfZ2VuZXJhbF9zZXR0aW5nc19jYWxlbmRhcl9tZXRhYm94JywgJ0NoYW5nZW92ZXIgRGF5cycgKTsuXHJcblx0XHRcdFx0XHR3cGJjX2JsaW5rX2VsZW1lbnQoICcud3BiY190cl9zZXRfZ2VuX2Jvb2tpbmdfcmFuZ2Vfc2VsZWN0aW9uX3RpbWVfaXNfYWN0aXZlJywgNCwgMzUwICk7XHJcblx0XHRcdFx0XHRcdHdwYmNfc2Nyb2xsX3RvKCAnLndwYmNfdHJfc2V0X2dlbl9ib29raW5nX3JhbmdlX3NlbGVjdGlvbl90aW1lX2lzX2FjdGl2ZScgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdibGlua19jYXB0Y2hhJzpcclxuXHRcdFx0XHRcdHdwYmNfYmxpbmtfZWxlbWVudCggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19pc191c2VfY2FwdGNoYScsIDQsIDM1MCApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX3Njcm9sbF90byggJy53cGJjX3RyX3NldF9nZW5fYm9va2luZ19pc191c2VfY2FwdGNoYScgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59IiwiLyoqXHJcbiAqIENvcHkgdHh0IHRvIGNsaXBicmQgZnJvbSBUZXh0IGZpZWxkcy5cclxuICpcclxuICogQHBhcmFtIGh0bWxfZWxlbWVudF9pZCAgLSBlLmcuICdkYXRhX2ZpZWxkJ1xyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY29weV90ZXh0X3RvX2NsaXBicmRfZnJvbV9lbGVtZW50KCBodG1sX2VsZW1lbnRfaWQgKSB7XHJcblx0Ly8gR2V0IHRoZSB0ZXh0IGZpZWxkLlxyXG5cdHZhciBjb3B5VGV4dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBodG1sX2VsZW1lbnRfaWQgKTtcclxuXHJcblx0Ly8gU2VsZWN0IHRoZSB0ZXh0IGZpZWxkLlxyXG5cdGNvcHlUZXh0LnNlbGVjdCgpO1xyXG5cdGNvcHlUZXh0LnNldFNlbGVjdGlvblJhbmdlKCAwLCA5OTk5OSApOyAvLyBGb3IgbW9iaWxlIGRldmljZXMuXHJcblxyXG5cdC8vIENvcHkgdGhlIHRleHQgaW5zaWRlIHRoZSB0ZXh0IGZpZWxkLlxyXG5cdHZhciBpc19jb3BpZWQgPSB3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkKCBjb3B5VGV4dC52YWx1ZSApO1xyXG5cdGlmICggISBpc19jb3BpZWQgKSB7XHJcblx0XHRjb25zb2xlLmVycm9yKCAnT29wcywgdW5hYmxlIHRvIGNvcHknLCBjb3B5VGV4dC52YWx1ZSApO1xyXG5cdH1cclxuXHRyZXR1cm4gaXNfY29waWVkO1xyXG59XHJcblxyXG4vKipcclxuICogQ29weSB0eHQgdG8gY2xpcGJyZC5cclxuICpcclxuICogQHBhcmFtIHRleHRcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NvcHlfdGV4dF90b19jbGlwYnJkKHRleHQpIHtcclxuXHJcblx0aWYgKCAhIG5hdmlnYXRvci5jbGlwYm9hcmQgKSB7XHJcblx0XHRyZXR1cm4gd3BiY19mYWxsYmFja19jb3B5X3RleHRfdG9fY2xpcGJyZCggdGV4dCApO1xyXG5cdH1cclxuXHJcblx0bmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoIHRleHQgKS50aGVuKFxyXG5cdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHQvLyBjb25zb2xlLmxvZyggJ0FzeW5jOiBDb3B5aW5nIHRvIGNsaXBib2FyZCB3YXMgc3VjY2Vzc2Z1bCEnICk7LlxyXG5cdFx0XHRyZXR1cm4gIHRydWU7XHJcblx0XHR9LFxyXG5cdFx0ZnVuY3Rpb24gKGVycikge1xyXG5cdFx0XHQvLyBjb25zb2xlLmVycm9yKCAnQXN5bmM6IENvdWxkIG5vdCBjb3B5IHRleHQ6ICcsIGVyciApOy5cclxuXHRcdFx0cmV0dXJuICBmYWxzZTtcclxuXHRcdH1cclxuXHQpO1xyXG59XHJcblxyXG4vKipcclxuICogQ29weSB0eHQgdG8gY2xpcGJyZCAtIGRlcHJpY2F0ZWQgbWV0aG9kLlxyXG4gKlxyXG4gKiBAcGFyYW0gdGV4dFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZmFsbGJhY2tfY29weV90ZXh0X3RvX2NsaXBicmQoIHRleHQgKSB7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gdmFyIHRleHRBcmVhICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCBcInRleHRhcmVhXCIgKTtcclxuXHQvLyB0ZXh0QXJlYS52YWx1ZSA9IHRleHQ7XHJcblx0Ly9cclxuXHQvLyAvLyBBdm9pZCBzY3JvbGxpbmcgdG8gYm90dG9tLlxyXG5cdC8vIHRleHRBcmVhLnN0eWxlLnRvcCAgICAgID0gXCIwXCI7XHJcblx0Ly8gdGV4dEFyZWEuc3R5bGUubGVmdCAgICAgPSBcIjBcIjtcclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS5wb3NpdGlvbiA9IFwiZml4ZWRcIjtcclxuXHQvLyB0ZXh0QXJlYS5zdHlsZS56SW5kZXggICA9IFwiOTk5OTk5OTk5XCI7XHJcblx0Ly8gZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggdGV4dEFyZWEgKTtcclxuXHQvLyB0ZXh0QXJlYS5mb2N1cygpO1xyXG5cdC8vIHRleHRBcmVhLnNlbGVjdCgpO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIE5vdyBnZXQgaXQgYXMgSFRNTCAgKG9yaWdpbmFsIGhlcmUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzQxOTE3ODAvamF2YXNjcmlwdC1jb3B5LXN0cmluZy10by1jbGlwYm9hcmQtYXMtdGV4dC1odG1sICkuXHJcblxyXG5cdC8vIFsxXSAtIENyZWF0ZSBjb250YWluZXIgZm9yIHRoZSBIVE1MLlxyXG5cdHZhciBjb250YWluZXIgICAgICAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xyXG5cdGNvbnRhaW5lci5pbm5lckhUTUwgPSB0ZXh0O1xyXG5cclxuXHQvLyBbMl0gLSBIaWRlIGVsZW1lbnQuXHJcblx0Y29udGFpbmVyLnN0eWxlLnBvc2l0aW9uICAgICAgPSAnZml4ZWQnO1xyXG5cdGNvbnRhaW5lci5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xyXG5cdGNvbnRhaW5lci5zdHlsZS5vcGFjaXR5ICAgICAgID0gMDtcclxuXHJcblx0Ly8gRGV0ZWN0IGFsbCBzdHlsZSBzaGVldHMgb2YgdGhlIHBhZ2UuXHJcblx0dmFyIGFjdGl2ZVNoZWV0cyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKCBkb2N1bWVudC5zdHlsZVNoZWV0cyApLmZpbHRlcihcclxuXHRcdGZ1bmN0aW9uIChzaGVldCkge1xyXG5cdFx0XHRyZXR1cm4gISBzaGVldC5kaXNhYmxlZDtcclxuXHRcdH1cclxuXHQpO1xyXG5cclxuXHQvLyBbM10gLSBNb3VudCB0aGUgY29udGFpbmVyIHRvIHRoZSBET00gdG8gbWFrZSBgY29udGVudFdpbmRvd2AgYXZhaWxhYmxlLlxyXG5cdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIGNvbnRhaW5lciApO1xyXG5cclxuXHQvLyBbNF0gLSBDb3B5IHRvIGNsaXBib2FyZC5cclxuXHR3aW5kb3cuZ2V0U2VsZWN0aW9uKCkucmVtb3ZlQWxsUmFuZ2VzKCk7XHJcblxyXG5cdHZhciByYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7XHJcblx0cmFuZ2Uuc2VsZWN0Tm9kZSggY29udGFpbmVyICk7XHJcblx0d2luZG93LmdldFNlbGVjdGlvbigpLmFkZFJhbmdlKCByYW5nZSApO1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHZhciByZXN1bHQgPSBmYWxzZTtcclxuXHJcblx0dHJ5IHtcclxuXHRcdHJlc3VsdCA9IGRvY3VtZW50LmV4ZWNDb21tYW5kKCAnY29weScgKTtcclxuXHRcdC8vIGNvbnNvbGUubG9nKCAnRmFsbGJhY2s6IENvcHlpbmcgdGV4dCBjb21tYW5kIHdhcyAnICsgbXNnICk7IC8vLlxyXG5cdH0gY2F0Y2ggKCBlcnIgKSB7XHJcblx0XHQvLyBjb25zb2xlLmVycm9yKCAnRmFsbGJhY2s6IE9vcHMsIHVuYWJsZSB0byBjb3B5JywgZXJyICk7IC8vLlxyXG5cdH1cclxuXHQvLyBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKCB0ZXh0QXJlYSApOyAvLy5cclxuXHJcblx0Ly8gWzUuNF0gLSBFbmFibGUgQ1NTLlxyXG5cdHZhciBhY3RpdmVTaGVldHNfbGVuZ3RoID0gYWN0aXZlU2hlZXRzLmxlbmd0aDtcclxuXHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBhY3RpdmVTaGVldHNfbGVuZ3RoOyBpKysgKSB7XHJcblx0XHRhY3RpdmVTaGVldHNbaV0uZGlzYWJsZWQgPSBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIFs2XSAtIFJlbW92ZSB0aGUgY29udGFpbmVyXHJcblx0ZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCggY29udGFpbmVyICk7XHJcblxyXG5cdHJldHVybiAgcmVzdWx0O1xyXG59Il0sIm1hcHBpbmdzIjoiOztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQUEsbUJBQUFDLGdCQUFBO0VBQUEsSUFBQUMsY0FBQSxHQUFBQyxTQUFBLENBQUFDLE1BQUEsUUFBQUQsU0FBQSxRQUFBRSxTQUFBLEdBQUFGLFNBQUE7RUFBQSxJQUFBRyxpQkFBQSxHQUFBSCxTQUFBLENBQUFDLE1BQUEsUUFBQUQsU0FBQSxRQUFBRSxTQUFBLEdBQUFGLFNBQUE7RUFFQSxTQUFBSSxDQUFBLE1BQUFBLENBQUEsR0FBQUwsY0FBQSxFQUFBSyxDQUFBO0lBQ0FDLE1BQUEsQ0FBQVAsZ0JBQUEsRUFBQVEsT0FBQSxDQUFBSCxpQkFBQSxFQUFBSSxNQUFBLENBQUFKLGlCQUFBO0VBQ0E7RUFDQUUsTUFBQSxDQUFBUCxnQkFBQSxFQUFBVSxPQUFBO0lBQUFDLE9BQUE7RUFBQTtBQUNBOztBQ2RBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQUMseUJBQUFDLHlCQUFBO0VBRUEsSUFBQUMsZUFBQTtFQUNBLElBQ0FWLFNBQUEsSUFBQVMseUJBQUEsSUFDQSxNQUFBQSx5QkFBQSxFQUNBO0lBQ0EsSUFBQUUsUUFBQSxHQUFBUixNQUFBLE9BQUFNLHlCQUFBO0lBQ0EsSUFBQUUsUUFBQSxDQUFBWixNQUFBO01BQ0FXLGVBQUEsR0FBQUUsZ0NBQUEsQ0FBQUQsUUFBQSxDQUFBRSxHQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUFILGVBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxT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
