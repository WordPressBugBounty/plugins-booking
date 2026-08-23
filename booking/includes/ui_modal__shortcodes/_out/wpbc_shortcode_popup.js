"use strict";

/**
 * Normalize a user-entered list of positive IDs for a workflow shortcode.
 *
 * @param {string} raw_value Comma-, semicolon-, or whitespace-delimited IDs.
 * @returns {string} Unique comma-delimited positive IDs.
 */
function wpbc_shortcode_config__normalize_workflow_id_list(raw_value) {
  var normalized_ids = [];
  String(raw_value || '').split(/[;,\s]+/).forEach(function (raw_id) {
    var normalized_id = parseInt(raw_id, 10);
    if (normalized_id > 0 && -1 === normalized_ids.indexOf(normalized_id)) {
      normalized_ids.push(normalized_id);
    }
  });
  return normalized_ids.join(',');
}

/**
 * Normalize one safe public catalog CSS width.
 *
 * @param {string} raw_value Raw width entered in the shortcode builder.
 * @returns {string} Normalized width or an empty string for automatic width.
 */
function wpbc_shortcode_config__normalize_css_width(raw_value) {
  var normalized_width = String(raw_value || '').trim().toLowerCase();
  var width_match;
  var numeric_width;
  var maximum_width;
  if ('' === normalized_width || 'auto' === normalized_width) {
    return '';
  }
  if (/^\d+(?:\.\d+)?$/.test(normalized_width)) {
    normalized_width += 'px';
  }
  width_match = /^(\d+(?:\.\d+)?)(px|%|rem|em|vw)$/.exec(normalized_width);
  if (!width_match) {
    return '';
  }
  numeric_width = parseFloat(width_match[1]);
  maximum_width = '%' === width_match[2] || 'vw' === width_match[2] ? 100 : 'px' === width_match[2] ? 2000 : 100;
  if (numeric_width <= 0 || numeric_width > maximum_width) {
    return '';
  }
  return String(Number(numeric_width.toFixed(4))) + width_match[2];
}

/**
 * Normalize one workflow shortcode field according to its declared value type.
 *
 * @param {jQuery} $field Parameter control.
 * @returns {string} Safe value for the generated shortcode.
 */
function wpbc_shortcode_config__get_workflow_field_value($field) {
  var value_type = String($field.data('wpbc-shortcode-value-type') || 'text');
  var raw_value = $field.is(':checkbox') ? $field.is(':checked') ? 'on' : 'off' : $field.val();
  var field_value = Array.isArray(raw_value) ? raw_value.join(',') : String(raw_value || '').trim();
  var is_valid = true;
  var month_match;
  var raw_css_width;
  if ('positive_integer' === value_type) {
    field_value = '' === field_value ? '' : String(parseInt(field_value, 10));
    is_valid = '' === field_value || !isNaN(parseInt(field_value, 10)) && parseInt(field_value, 10) > 0;
  } else if ('id_list' === value_type) {
    field_value = wpbc_shortcode_config__normalize_workflow_id_list(field_value);
  } else if ('css_width' === value_type) {
    raw_css_width = field_value.toLowerCase();
    field_value = wpbc_shortcode_config__normalize_css_width(field_value);
    is_valid = '' === raw_css_width || 'auto' === raw_css_width || '' !== field_value;
  } else if ('date' === value_type) {
    is_valid = '' === field_value || /^\d{4}-\d{2}-\d{2}$/.test(field_value);
  } else if ('month' === value_type) {
    month_match = /^(\d{4})(?:-?(\d{1,2})|\/(\d{1,2}))$/.exec(field_value);
    is_valid = '' === field_value || month_match && parseInt(month_match[2] || month_match[3], 10) >= 1 && parseInt(month_match[2] || month_match[3], 10) <= 12;
  }
  if (!is_valid) {
    if ('function' === typeof wpbc_field_highlight) {
      wpbc_field_highlight('#' + $field.attr('id'));
    }
    return '';
  }
  return field_value.replace(/'/g, '');
}

/**
 * Build one modern workflow shortcode from declarative popup controls.
 *
 * @param {string} shortcode_id booking_appointment or booking_resource_selector.
 * @returns {string} Complete shortcode text.
 */
function wpbc_shortcode_config__build_workflow_shortcode(shortcode_id) {
  var shortcode_text = '[' + shortcode_id;
  var $container = jQuery('#wpbc_sc_container__shortcode_' + shortcode_id);
  $container.find('[data-wpbc-shortcode-parameter]').each(function () {
    var $field = jQuery(this);
    var parameter_name = String($field.data('wpbc-shortcode-parameter') || '');
    var default_value = String($field.data('wpbc-shortcode-default'));
    var field_value = wpbc_shortcode_config__get_workflow_field_value($field);
    if (parameter_name && field_value !== default_value) {
      shortcode_text += ' ' + parameter_name + '=\'' + field_value + '\'';
    }
  });
  return shortcode_text + ']';
}

/**
 * Restore one workflow shortcode section to its parser-backed UI defaults.
 *
 * @param {string} shortcode_id booking_appointment or booking_resource_selector.
 * @returns {void}
 */
function wpbc_shortcode_config__reset_workflow(shortcode_id) {
  var $container = jQuery('#wpbc_sc_container__shortcode_' + shortcode_id);
  $container.find('[data-wpbc-shortcode-parameter]').each(function () {
    var $field = jQuery(this);
    var default_value = String($field.data('wpbc-shortcode-default'));
    if ($field.is(':checkbox')) {
      $field.prop('checked', 'on' === default_value);
    } else {
      $field.val(default_value);
    }
  });
  wpbc_set_shortcode();
}

/**
 * Apply the recommended compact presentation when a workflow List view is selected.
 *
 * The preset is applied only in the shortcode configuration UI when the
 * catalog layout control changes to List. Each affected control remains
 * independently editable after the preset is applied, and shortcode parser
 * defaults are not changed.
 *
 * @param {jQuery} $changed_field Workflow field that triggered the change.
 * @returns {void}
 */
function wpbc_shortcode_config__apply_resource_list_preset($changed_field) {
  var parameter_name = String($changed_field.data('wpbc-shortcode-parameter') || '');
  var $container;
  if ('catalog_layout' !== parameter_name || 'list' !== String($changed_field.val() || '')) {
    return;
  }
  $container = $changed_field.closest('#wpbc_sc_container__shortcode_booking_resource_selector, #wpbc_sc_container__shortcode_booking_appointment');
  if (!$container.length) {
    return;
  }
  $container.find('[data-wpbc-shortcode-parameter="show_resource_description"]').prop('checked', false);
  $container.find('[data-wpbc-shortcode-parameter="catalog_list_items_per_row"]').val('2');
  $container.find('[data-wpbc-shortcode-parameter="show_resource_hierarchy"]').prop('checked', false);
  $container.find('[data-wpbc-shortcode-parameter="show_availability"]').prop('checked', false);
}

/**
 * Shortcode Config - Main Loop
 */
function wpbc_set_shortcode() {
  if (0 === jQuery('#wpbc_shortcode_type').length) {
    console.log('WPBC :: Error! Element #wpbc_shortcode_type not exist!');
    return;
  }
  var wpbc_shortcode = '[';
  var shortcode_id = jQuery('#wpbc_shortcode_type').val().trim();
  if ('booking_appointment' === shortcode_id || 'booking_resource_selector' === shortcode_id) {
    jQuery('#wpbc_text_put_in_shortcode').val(wpbc_shortcode_config__build_workflow_shortcode(shortcode_id));
    return;
  }

  // -----------------------------------------------------------------------------------------------------------------
  // [booking]  | [bookingcalendar] | ...
  // -----------------------------------------------------------------------------------------------------

  if ('booking' === shortcode_id || 'bookingcalendar' === shortcode_id || 'bookingselect' === shortcode_id || 'bookingtimeline' === shortcode_id || 'bookingform' === shortcode_id || 'bookingsearch' === shortcode_id || 'bookingother' === shortcode_id || 'booking_import_ics' === shortcode_id || 'booking_listing_ics' === shortcode_id) {
    wpbc_shortcode += shortcode_id;
    var wpbc_options_arr = [];

    // -------------------------------------------------------------------------------------------------------------
    // [bookingselect] | [bookingtimeline] - Options relative only to this shortcode.
    // -------------------------------------------------------------------------------------------------------------
    if ('bookingselect' === shortcode_id || 'bookingtimeline' === shortcode_id) {
      // [bookingselect type='1,2,3'] - Multiple Resources
      if (jQuery('#' + shortcode_id + '_wpbc_multiple_resources').length > 0) {
        var multiple_resources = jQuery('#' + shortcode_id + '_wpbc_multiple_resources').val();
        if (multiple_resources != null && multiple_resources.length > 0) {
          // Remove empty spaces from  array : '' | "" | 0
          multiple_resources = multiple_resources.filter(function (n) {
            return parseInt(n);
          });
          multiple_resources = multiple_resources.join(',').trim();
          if (multiple_resources != 0) {
            wpbc_shortcode += ' type=\'' + multiple_resources + '\'';
          }
        }
      }

      // [bookingselect selected_type=1] - Selected Resource
      if (jQuery('#' + shortcode_id + '_wpbc_selected_resource').length > 0) {
        if (jQuery('#' + shortcode_id + '_wpbc_selected_resource').val() !== null // FixIn: 8.2.1.12.
        && parseInt(jQuery('#' + shortcode_id + '_wpbc_selected_resource').val()) > 0) {
          wpbc_shortcode += ' selected_type=' + jQuery('#' + shortcode_id + '_wpbc_selected_resource').val().trim();
        }
      }

      // [bookingselect label='Tada'] - Label
      if (jQuery('#' + shortcode_id + '_wpbc_text_label').length > 0) {
        if ('' !== jQuery('#' + shortcode_id + '_wpbc_text_label').val().trim()) {
          wpbc_shortcode += ' label=\'' + jQuery('#' + shortcode_id + '_wpbc_text_label').val().trim().replace(/'/gi, '') + '\'';
        }
      }

      // [bookingselect first_option_title='Tada'] - First  Option
      if (jQuery('#' + shortcode_id + '_wpbc_first_option_title').length > 0) {
        if ('' !== jQuery('#' + shortcode_id + '_wpbc_first_option_title').val().trim()) {
          wpbc_shortcode += ' first_option_title=\'' + jQuery('#' + shortcode_id + '_wpbc_first_option_title').val().trim().replace(/'/gi, '') + '\'';
        }
      }
    }

    // -------------------------------------------------------------------------------------------------------------
    // [bookingtimeline] - Options relative only to this shortcode.
    // -------------------------------------------------------------------------------------------------------------
    if ('bookingtimeline' === shortcode_id) {
      // Visually update
      var wpbc_is_matrix__view_days_num_temp = wpbc_shortcode_config__update_elements_in_timeline();
      var wpbc_is_matrix = wpbc_is_matrix__view_days_num_temp[0];
      var view_days_num_temp = wpbc_is_matrix__view_days_num_temp[1];

      // : view_days_num
      if (view_days_num_temp != 30) {
        wpbc_shortcode += ' view_days_num=' + view_days_num_temp;
      }
      // : header_title
      if (jQuery('#' + shortcode_id + '_wpbc_text_label_timeline').length > 0) {
        var header_title_temp = jQuery('#' + shortcode_id + '_wpbc_text_label_timeline').val().trim();
        header_title_temp = header_title_temp.replace(/'/gi, '');
        if (header_title_temp != '') {
          wpbc_shortcode += ' header_title=\'' + header_title_temp + '\'';
        }
      }
      // : scroll_month
      if (jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_month').is(':visible') && jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_month').length > 0 && parseInt(jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_month').val().trim()) !== 0) {
        wpbc_shortcode += ' scroll_month=' + parseInt(jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_month').val().trim());
      }
      // : scroll_day
      if (jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_days').is(':visible') && jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_days').length > 0 && parseInt(jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_days').val().trim()) !== 0) {
        wpbc_shortcode += ' scroll_day=' + parseInt(jQuery('#' + shortcode_id + '_wpbc_scroll_timeline_scroll_days').val().trim());
      }

      // :limit_hours
      // FixIn: 7.0.1.17.
      jQuery('.bookingtimeline_view_times').hide();
      if (wpbc_is_matrix && view_days_num_temp == 1 || !wpbc_is_matrix && view_days_num_temp == 30) {
        jQuery('.bookingtimeline_view_times').show();
        var view_times_start_temp = parseInt(jQuery('#bookingtimeline_wpbc_start_end_time_timeline_starttime').val().trim());
        var view_times_end_temp = parseInt(jQuery('#bookingtimeline_wpbc_start_end_time_timeline_endtime').val().trim());
        if (view_times_start_temp != 0 || view_times_end_temp != 24) {
          wpbc_shortcode += ' limit_hours=\'' + view_times_start_temp + ',' + view_times_end_temp + '\'';
        }
      }

      // :scroll_start_date
      if (jQuery('#bookingtimeline_wpbc_start_date_timeline_active').is(':checked') && jQuery('#bookingtimeline_wpbc_start_date_timeline_active').length > 0) {
        wpbc_shortcode += ' scroll_start_date=\'' + jQuery('#bookingtimeline_wpbc_start_date_timeline_year').val().trim() + '-' + jQuery('#bookingtimeline_wpbc_start_date_timeline_month').val().trim() + '-' + jQuery('#bookingtimeline_wpbc_start_date_timeline_day').val().trim() + '\'';
      }
    }

    // -------------------------------------------------------------------------------------------------------------
    // [bookingform  ] - Form Only        -     [bookingform type=1 selected_dates='01.03.2024']
    // -------------------------------------------------------------------------------------------------------------
    if ('bookingform' === shortcode_id) {
      var wpbc_selected_day = jQuery('#' + shortcode_id + '_wpbc_booking_date_day').val().trim();
      if (parseInt(wpbc_selected_day) < 10) {
        wpbc_selected_day = '0' + wpbc_selected_day;
      }
      var wpbc_selected_month = jQuery('#' + shortcode_id + '_wpbc_booking_date_month').val().trim();
      if (parseInt(wpbc_selected_month) < 10) {
        wpbc_selected_month = '0' + wpbc_selected_month;
      }
      wpbc_shortcode += ' selected_dates=\'' + wpbc_selected_day + '.' + wpbc_selected_month + '.' + jQuery('#' + shortcode_id + '_wpbc_booking_date_year').val().trim() + '\'';
    }

    // -------------------------------------------------------------------------------------------------------------
    // [bookingsearch  ] - Options relative only to this shortcode.     [bookingsearch searchresultstitle='{searchresults} Result(s) Found' noresultstitle='Nothing Found']
    // -------------------------------------------------------------------------------------------------------------
    if ('bookingsearch' === shortcode_id) {
      // Check  if we selected 'bookingsearch' | 'bookingsearchresults'
      var wpbc_search_form_results = 'bookingsearch';
      if (jQuery("input[name='bookingsearch_wpbc_search_form_results']:checked").length > 0) {
        wpbc_search_form_results = jQuery("input[name='bookingsearch_wpbc_search_form_results']:checked").val().trim();
      }

      // Show | Hide form  fields for 'bookingsearch' depends from  radio  bution  selection
      if ('bookingsearchresults' === wpbc_search_form_results) {
        wpbc_shortcode = '[bookingsearchresults';
        jQuery('.wpbc_search_availability_form').hide();
      } else {
        jQuery('.wpbc_search_availability_form').show();

        // New page for search results
        if (jQuery('#' + shortcode_id + '_wpbc_search_new_page_enabled').length > 0 && jQuery('#' + shortcode_id + '_wpbc_search_new_page_enabled').is(':checked')) {
          // Show
          jQuery('.' + shortcode_id + '_wpbc_search_new_page_wpbc_sc_searchresults_new_page').show();

          // : Search Results URL
          if (jQuery('#' + shortcode_id + '_wpbc_search_new_page_url').length > 0) {
            var search_results_url_temp = jQuery('#' + shortcode_id + '_wpbc_search_new_page_url').val().trim();
            search_results_url_temp = search_results_url_temp.replace(/'/gi, '');
            if (search_results_url_temp != '') {
              wpbc_shortcode += ' searchresults=\'' + search_results_url_temp + '\'';
            }
          }
        } else {
          // Hide
          jQuery('.' + shortcode_id + '_wpbc_search_new_page_wpbc_sc_searchresults_new_page').hide();
        }

        /*              // FixIn: 10.0.0.41.
                        // : Search Header
                        if ( jQuery( '#' + shortcode_id + '_wpbc_search_header' ).length > 0 ){
                            var search_header_temp = jQuery( '#' + shortcode_id + '_wpbc_search_header' ).val().trim();
                            search_header_temp = search_header_temp.replace( /'/gi, '' );
                            if ( search_header_temp != '' ){
                                wpbc_shortcode += ' searchresultstitle=\'' + search_header_temp + '\'';
                            }
                        }
                        // : Nothing Found
                        if ( jQuery( '#' + shortcode_id + '_wpbc_search_nothing_found' ).length > 0 ){
                            var nothingfound_temp = jQuery( '#' + shortcode_id + '_wpbc_search_nothing_found' ).val().trim();
                            nothingfound_temp = nothingfound_temp.replace( /'/gi, '' );
                            if ( nothingfound_temp != '' ){
                                wpbc_shortcode += ' noresultstitle=\'' + nothingfound_temp + '\'';
                            }
                        }
        */
        // : Users      // [bookingsearch searchresultstitle='{searchresults} Result(s) Found' noresultstitle='Nothing Found' users='3,4543,']
        if (jQuery('#' + shortcode_id + '_wpbc_search_for_users').length > 0) {
          var only_for_users_temp = jQuery('#' + shortcode_id + '_wpbc_search_for_users').val().trim();
          only_for_users_temp = only_for_users_temp.replace(/'/gi, '');
          if (only_for_users_temp != '') {
            wpbc_shortcode += ' users=\'' + only_for_users_temp + '\'';
          }
        }
      }
    }

    // -------------------------------------------------------------------------------------------------------------
    // [bookingedit] , [bookingcustomerlisting] , [bookingresource type=6 show='capacity'] , [booking_confirm]
    // -------------------------------------------------------------------------------------------------------------
    if ('bookingother' === shortcode_id) {
      //TRICK:
      shortcode_id = 'no'; //required for not update booking resource ID

      // Check  if we selected 'bookingsearch' | 'bookingsearchresults'
      var bookingother_shortcode_type = 'bookingsearch';
      if (jQuery("input[name='bookingother_wpbc_shortcode_type']:checked").length > 0) {
        bookingother_shortcode_type = jQuery("input[name='bookingother_wpbc_shortcode_type']:checked").val().trim();
      }

      // Show | Hide sections
      if ('booking_confirm' === bookingother_shortcode_type) {
        wpbc_shortcode = '[booking_confirm';
        jQuery('.bookingother_section_additional').hide();
        jQuery('.bookingother_section_' + bookingother_shortcode_type).show();
      }
      if ('bookingedit' === bookingother_shortcode_type) {
        wpbc_shortcode = '[bookingedit';
        jQuery('.bookingother_section_additional').hide();
        jQuery('.bookingother_section_' + bookingother_shortcode_type).show();
      }
      if ('bookingcustomerlisting' === bookingother_shortcode_type) {
        wpbc_shortcode = '[bookingcustomerlisting';
        jQuery('.bookingother_section_additional').hide();
        jQuery('.bookingother_section_' + bookingother_shortcode_type).show();
      }
      if ('bookingresource' === bookingother_shortcode_type) {
        //TRICK:
        shortcode_id = 'bookingother'; //required to force update booking resource ID

        wpbc_shortcode = '[bookingresource';
        jQuery('.bookingother_section_additional').hide();
        jQuery('.bookingother_section_' + bookingother_shortcode_type).show();
        if (jQuery('#bookingother_wpbc_resource_show').val().trim() != 'title') {
          wpbc_shortcode += ' show=\'' + jQuery('#bookingother_wpbc_resource_show').val().trim() + '\'';
        }
      }
    }

    // [booking-manager-import ...]     ||      [booking-manager-listing ...]
    if ('booking_import_ics' === shortcode_id || 'booking_listing_ics' === shortcode_id) {
      wpbc_shortcode = '[booking-manager-import';
      if ('booking_listing_ics' === shortcode_id) {
        wpbc_shortcode = '[booking-manager-listing';
      }

      ////////////////////////////////////////////////////////////////
      // : .ics feed URL
      ////////////////////////////////////////////////////////////////
      var shortcode_url_temp = '';
      if (jQuery('#' + shortcode_id + '_wpbc_url').length > 0) {
        shortcode_url_temp = jQuery('#' + shortcode_id + '_wpbc_url').val().trim();
        shortcode_url_temp = shortcode_url_temp.replace(/'/gi, '');
        if (shortcode_url_temp != '') {
          wpbc_shortcode += ' url=\'' + shortcode_url_temp + '\'';
        }
      }
      if (shortcode_url_temp == '') {
        // Error:
        wpbc_shortcode = '[ URL is required ';
      } else {
        // VALID:

        ////////////////////////////////////////////////////////////////
        // [... from='' 'from_offset=''  ...]
        ////////////////////////////////////////////////////////////////
        if (jQuery('#' + shortcode_id + '_from').length > 0) {
          var p_from = jQuery('#' + shortcode_id + '_from').val().trim();
          var p_from_offset = jQuery('#' + shortcode_id + '_from_offset').val().trim();
          p_from = p_from.replace(/'/gi, '');
          p_from_offset = p_from_offset.replace(/'/gi, '');
          if ('' != p_from && 'date' != p_from) {
            // Offset

            wpbc_shortcode += ' from=\'' + p_from + '\'';
            if ('any' != p_from && '' != p_from_offset) {
              p_from_offset = parseInt(p_from_offset);
              if (!isNaN(p_from_offset)) {
                wpbc_shortcode += ' from_offset=\'' + p_from_offset + jQuery('#' + shortcode_id + '_from_offset_type').val().trim().charAt(0) + '\'';
              }
            }
          } else if (p_from == 'date' && p_from_offset != '') {
            // If selected Date
            wpbc_shortcode += ' from=\'' + p_from_offset + '\'';
          }
        }

        ////////////////////////////////////////////////////////////////
        // [... until='' 'until_offset=''  ...]
        ////////////////////////////////////////////////////////////////
        if (jQuery('#' + shortcode_id + '_until').length > 0) {
          var p_until = jQuery('#' + shortcode_id + '_until').val().trim();
          var p_until_offset = jQuery('#' + shortcode_id + '_until_offset').val().trim();
          p_until = p_until.replace(/'/gi, '');
          p_until_offset = p_until_offset.replace(/'/gi, '');
          if ('' != p_until && 'date' != p_until) {
            // Offset

            wpbc_shortcode += ' until=\'' + p_until + '\'';
            if ('any' != p_until && '' != p_until_offset) {
              p_until_offset = parseInt(p_until_offset);
              if (!isNaN(p_until_offset)) {
                wpbc_shortcode += ' until_offset=\'' + p_until_offset + jQuery('#' + shortcode_id + '_until_offset_type').val().trim().charAt(0) + '\'';
              }
            }
          } else if (p_until == 'date' && p_until_offset != '') {
            // If selected Date
            wpbc_shortcode += ' until=\'' + p_until_offset + '\'';
          }
        }

        ////////////////////////////////////////////////////////////////
        // Max
        ////////////////////////////////////////////////////////////////
        if (jQuery('#' + shortcode_id + '_conditions_max_num').length > 0) {
          var p_max = parseInt(jQuery('#' + shortcode_id + '_conditions_max_num').val().trim());
          if (p_max != 0) {
            wpbc_shortcode += ' max=' + p_max;
          }
        }

        ////////////////////////////////////////////////////////////////
        // Silence
        ////////////////////////////////////////////////////////////////
        if (jQuery('#' + shortcode_id + '_silence').length > 0) {
          if ('1' === jQuery('#' + shortcode_id + '_silence').val().trim()) {
            wpbc_shortcode += ' silence=1';
          }
        }

        ////////////////////////////////////////////////////////////////
        // is_all_dates_in
        ////////////////////////////////////////////////////////////////
        if (jQuery('#' + shortcode_id + '_conditions_events').length > 0) {
          var p_is_all_dates_in = parseInt(jQuery('#' + shortcode_id + '_conditions_events').val().trim());
          if (p_is_all_dates_in != 0) {
            wpbc_shortcode += ' is_all_dates_in=' + p_is_all_dates_in;
          }
        }

        ////////////////////////////////////////////////////////////////
        // import_conditions
        ////////////////////////////////////////////////////////////////
        if (jQuery('#' + shortcode_id + '_conditions_import').length > 0) {
          var p_import_conditions = jQuery('#' + shortcode_id + '_conditions_import').val().trim();
          p_import_conditions = p_import_conditions.replace(/'/gi, '');
          if (p_import_conditions != '') {
            wpbc_shortcode += ' import_conditions=\'' + p_import_conditions + '\'';
          }
        }
      }
    }

    // -------------------------------------------------------------------------------------------------------------
    // [booking] , [bookingcalendar] , ...  parameters for these shortcodes and others...
    // -------------------------------------------------------------------------------------------------------------
    if (jQuery('#' + shortcode_id + '_wpbc_resource_id').length > 0) {
      if (jQuery('#' + shortcode_id + '_wpbc_resource_id').val() === null) {
        // FixIn: 8.2.1.12.
        jQuery('#wpbc_text_put_in_shortcode').val('---');
        return;
      } else {
        wpbc_shortcode += ' resource_id=' + jQuery('#' + shortcode_id + '_wpbc_resource_id').val().trim();
      }
    }
    if (jQuery('#' + shortcode_id + '_wpbc_custom_form').length > 0) {
      var form_type_temp = jQuery('#' + shortcode_id + '_wpbc_custom_form').val().trim();
      if (form_type_temp != 'standard') wpbc_shortcode += ' form_type=\'' + jQuery('#' + shortcode_id + '_wpbc_custom_form').val().trim() + '\'';
    }
    if (jQuery('#' + shortcode_id + '_wpbc_nummonths').length > 0 && parseInt(jQuery('#' + shortcode_id + '_wpbc_nummonths').val().trim()) > 1) {
      wpbc_shortcode += ' nummonths=' + jQuery('#' + shortcode_id + '_wpbc_nummonths').val().trim();
    }
    if ('booking' === shortcode_id && jQuery('#booking_wpbc_popup_enabled').length > 0) {
      if (jQuery('#booking_wpbc_popup_enabled').is(':checked')) {
        jQuery('.booking_wpbc_popup_wpbc_sc_booking_popup').show();
        wpbc_shortcode += ' popup=1';
        var popup_button_title_default = jQuery('#booking_wpbc_popup_button_title').attr('placeholder');
        var popup_button_title_temp = jQuery('#booking_wpbc_popup_button_title').val().trim().replace(/'/gi, '');
        if (popup_button_title_temp != '' && popup_button_title_temp != popup_button_title_default) {
          wpbc_shortcode += ' popup_button_title=\'' + popup_button_title_temp + '\'';
        }
        var popup_title_default = jQuery('#booking_wpbc_popup_title').attr('placeholder');
        var popup_title_temp = jQuery('#booking_wpbc_popup_title').val().trim().replace(/'/gi, '');
        if (popup_title_temp != '' && popup_title_temp != popup_title_default) {
          wpbc_shortcode += ' popup_title=\'' + popup_title_temp + '\'';
        }
        var popup_button_class_temp = jQuery('#booking_wpbc_popup_button_class').val().trim().replace(/'/gi, '');
        if (popup_button_class_temp != '' && popup_button_class_temp != 'wp-element-button') {
          wpbc_shortcode += ' popup_button_class=\'' + popup_button_class_temp + '\'';
        }
        var popup_modal_class_temp = jQuery('#booking_wpbc_popup_modal_class').val().trim().replace(/'/gi, '');
        if (popup_modal_class_temp != '') {
          wpbc_shortcode += ' popup_modal_class=\'' + popup_modal_class_temp + '\'';
        }
        var popup_size_temp = jQuery('#booking_wpbc_popup_size').val().trim();
        if (popup_size_temp != 'lg') {
          wpbc_shortcode += ' popup_size=\'' + popup_size_temp + '\'';
        }
      } else {
        jQuery('.booking_wpbc_popup_wpbc_sc_booking_popup').hide();
      }
    }
    if (jQuery('#' + shortcode_id + '_wpbc_startmonth_active').length > 0 && jQuery('#' + shortcode_id + '_wpbc_startmonth_active').is(':checked')) {
      wpbc_shortcode += ' startmonth=\'' + jQuery('#' + shortcode_id + '_wpbc_startmonth_year').val().trim() + '-' + jQuery('#' + shortcode_id + '_wpbc_startmonth_month').val().trim() + '\'';
    }
    if (jQuery('#' + shortcode_id + '_wpbc_calendar_dates_start_active').length > 0 && jQuery('#' + shortcode_id + '_wpbc_calendar_dates_start_active').is(':checked')) {
      wpbc_shortcode += ' calendar_dates_start=\'' + jQuery('#' + shortcode_id + '_wpbc_calendar_dates_start_year').val().trim() + '-' + jQuery('#' + shortcode_id + '_wpbc_calendar_dates_start_month').val().trim() + '-' + jQuery('#' + shortcode_id + '_wpbc_calendar_dates_start_date').val().trim() + '\'';
    }
    if (jQuery('#' + shortcode_id + '_wpbc_calendar_dates_end_active').length > 0 && jQuery('#' + shortcode_id + '_wpbc_calendar_dates_end_active').is(':checked')) {
      wpbc_shortcode += ' calendar_dates_end=\'' + jQuery('#' + shortcode_id + '_wpbc_calendar_dates_end_year').val().trim() + '-' + jQuery('#' + shortcode_id + '_wpbc_calendar_dates_end_month').val().trim() + '-' + jQuery('#' + shortcode_id + '_wpbc_calendar_dates_end_date').val().trim() + '\'';
    }
    if (jQuery('#' + shortcode_id + '_wpbc_aggregate').length > 0) {
      var wpbc_aggregate_temp = jQuery('#' + shortcode_id + '_wpbc_aggregate').val();
      if (wpbc_aggregate_temp != null && wpbc_aggregate_temp.length > 0) {
        wpbc_aggregate_temp = wpbc_aggregate_temp.join(';');
        if (wpbc_aggregate_temp != 0) {
          // Check about 0=>'None'
          wpbc_shortcode += ' aggregate=\'' + wpbc_aggregate_temp + '\'';
          if (jQuery('#' + shortcode_id + '_wpbc_aggregate__bookings_only').is(':checked')) {
            wpbc_options_arr.push('{aggregate type=bookings_only}');
          }
        }
      }
    }

    // -------------------------------------------------------------------------------------------------------------
    // Option Param
    // -------------------------------------------------------------------------------------------------------------
    // Options : Size
    var wpbc_options_size = '';
    if (jQuery('#' + shortcode_id + '_wpbc_size_enabled').length > 0 && jQuery('#' + shortcode_id + '_wpbc_size_enabled').is(':checked')) {
      // options='{calendar months_num_in_row=2 width=100% cell_height=40px}'

      wpbc_options_size += '{calendar';
      wpbc_options_size += ' ' + 'months_num_in_row=' + Math.min(parseInt(jQuery('#' + shortcode_id + '_wpbc_size_months_num_in_row').val().trim()), parseInt(jQuery('#' + shortcode_id + '_wpbc_nummonths').val().trim()));
      wpbc_options_size += ' ' + 'width=' + parseInt(jQuery('#' + shortcode_id + '_wpbc_size_calendar_width').val().trim()) + jQuery('#' + shortcode_id + '_wpbc_size_calendar_width_px_pr').val().trim();
      wpbc_options_size += ' ' + 'cell_height=' + parseInt(jQuery('#' + shortcode_id + '_wpbc_size_calendar_cell_height').val().trim()) + 'px';
      wpbc_options_size += '}';
      wpbc_options_arr.push(wpbc_options_size);
    }

    // Options: Days number depend on   Weekday
    if (jQuery('#' + shortcode_id + 'wpbc_select_day_weekday_textarea').length > 0) {
      wpbc_options_size = jQuery('#' + shortcode_id + 'wpbc_select_day_weekday_textarea').val().trim();
      if (wpbc_options_size.length > 0) {
        wpbc_options_arr.push(wpbc_options_size);
      }
    }

    // Options: Days number depend on   SEASON
    if (jQuery('#' + shortcode_id + 'wpbc_select_day_season_textarea').length > 0) {
      wpbc_options_size = jQuery('#' + shortcode_id + 'wpbc_select_day_season_textarea').val().trim();
      if (wpbc_options_size.length > 0) {
        wpbc_options_arr.push(wpbc_options_size);
      }
    }

    // Options: Start weekday depend on   SEASON
    if (jQuery('#' + shortcode_id + 'wpbc_start_day_season_textarea').length > 0) {
      wpbc_options_size = jQuery('#' + shortcode_id + 'wpbc_start_day_season_textarea').val().trim();
      if (wpbc_options_size.length > 0) {
        wpbc_options_arr.push(wpbc_options_size);
      }
    }

    // Option: Days number depend on from  DATE
    if (jQuery('#' + shortcode_id + 'wpbc_select_day_fordate_textarea').length > 0) {
      wpbc_options_size = jQuery('#' + shortcode_id + 'wpbc_select_day_fordate_textarea').val().trim();
      if (wpbc_options_size.length > 0) {
        wpbc_options_arr.push(wpbc_options_size);
      }
    }
    if (wpbc_options_arr.length > 0) {
      wpbc_shortcode += ' options=\'' + wpbc_options_arr.join(',') + '\'';
    }
  }
  wpbc_shortcode += ']';
  jQuery('#wpbc_text_put_in_shortcode').val(wpbc_shortcode);
}

/**
 * Open TinyMCE Modal */
function wpbc_tiny_btn_click(tag) {
  // FixIn: 9.0.1.5.
  jQuery('#wpbc_tiny_modal').wpbc_my_modal({
    keyboard: false,
    backdrop: true,
    show: true
  });
  // FixIn: 8.3.3.99.
  jQuery("#wpbc_text_gettenberg_section_id").val('');
}

/**
 * Open TinyMCE Modal */
function wpbc_tiny_close() {
  jQuery('#wpbc_tiny_modal').wpbc_my_modal('hide'); // FixIn: 9.0.1.5.
}

/* ------------------------------------------------------------------------------------------------------------------ */
/** Send Text */
/* ------------------------------------------------------------------------------------------------------------------ */
/**
 * Send text  to editor */
function wpbc_send_text_to_editor(h) {
  // FixIn: 8.3.3.99
  if (typeof wpbc_send_text_to_gutenberg == 'function') {
    var is_send = wpbc_send_text_to_gutenberg(h);
    if (true === is_send) {
      return;
    }
  }
  var ed,
    mce = typeof tinymce != 'undefined',
    qt = typeof QTags != 'undefined';
  if (!window.wpActiveEditor) {
    if (mce && tinymce.activeEditor) {
      ed = tinymce.activeEditor;
      window.wpActiveEditor = ed.id;
    } else if (!qt) {
      return false;
    }
  } else if (mce) {
    if (tinymce.activeEditor && (tinymce.activeEditor.id == 'mce_fullscreen' || tinymce.activeEditor.id == 'wp_mce_fullscreen')) ed = tinymce.activeEditor;else ed = tinymce.get(wpActiveEditor);
  }
  if (ed && !ed.isHidden()) {
    // restore caret position on IE
    if (tinymce.isIE && ed.windowManager.insertimagebookmark) ed.selection.moveToBookmark(ed.windowManager.insertimagebookmark);
    if (h.indexOf('[caption') !== -1) {
      if (ed.wpSetImgCaption) h = ed.wpSetImgCaption(h);
    } else if (h.indexOf('[gallery') !== -1) {
      if (ed.plugins.wpgallery) h = ed.plugins.wpgallery._do_gallery(h);
    } else if (h.indexOf('[embed') === 0) {
      if (ed.plugins.wordpress) h = ed.plugins.wordpress._setEmbed(h);
    }
    ed.execCommand('mceInsertContent', false, h);
  } else if (qt) {
    QTags.insertContent(h);
  } else {
    document.getElementById(wpActiveEditor).value += h;
  }
  try {
    tb_remove();
  } catch (e) {}
  ;
}

/**
 * RESOURCES PAGE: Open TinyMCE Modal */
function wpbc_resource_page_btn_click(resource_id, shortcode_default_value = '') {
  // FixIn: 9.0.1.5.
  jQuery('#wpbc_tiny_modal').wpbc_my_modal({
    keyboard: false,
    backdrop: true,
    show: true
  });

  // Disable some options - selection of booking resource - because we configure it only for specific booking resource, where we clicked.
  var shortcode_arr = ['booking', 'bookingcalendar', 'bookingform'];
  for (var shortcde_key in shortcode_arr) {
    var shortcode_id = shortcode_arr[shortcde_key];
    jQuery('#' + shortcode_id + '_wpbc_resource_id').prop('disabled', false);
    jQuery('#' + shortcode_id + "_wpbc_resource_id option[value='" + resource_id + "']").prop('selected', true).trigger('change');
    jQuery('#' + shortcode_id + '_wpbc_resource_id').prop('disabled', true);
  }

  // Hide left  navigation  items
  //        jQuery( ".wpbc_shortcode_config_navigation_column .wpbc_settings_navigation_item" ).hide();
  jQuery("#wpbc_shortcode_config__nav_tab__booking").show();
  jQuery("#wpbc_shortcode_config__nav_tab__bookingcalendar").show();

  // Hide | Show Insert  button  for booking resource page
  jQuery(".wpbc_tiny_button__insert_to_editor").hide();
  jQuery(".wpbc_tiny_button__insert_to_resource").show();
}

/**
 * Get Shortcode Value from  shortcode text field in PopUp shortcode Config dialog and insert  into DIV and INPUT TEXT field near specific booking resource.
 *  But it takes ID  of booking resource,  where to  insert  this shortcode only from  'booking' section  of Config Dialog. usually  such  booking resource  disabled there!
 *  e.g.: jQuery( "#booking_wpbc_resource_id" ).val()
 *
 * @param shortcode_val
 */
function wpbc_send_text_to_resource(shortcode_val) {
  // FixIn: 10.3.0.8.
  var resource_id = 1;
  if (jQuery("#booking_wpbc_resource_id").length) {
    resource_id = jQuery("#booking_wpbc_resource_id").val();
  }
  jQuery('#div_booking_resource_shortcode_' + resource_id).html(shortcode_val);
  jQuery('#booking_resource_shortcode_' + resource_id).val(shortcode_val);
  jQuery('#booking_resource_shortcode_' + resource_id).trigger('change');

  /**
   * Fires after the Resource shortcode customizer returns a shortcode.
   *
   * AJAX inspectors consume this event without duplicating the legacy
   * `booking_resource_shortcode_{ID}` DOM contract.
   *
   * @event wpbc:resource-shortcode-selected
   * @type {{resource_id: number|string, shortcode: string}}
   */
  jQuery(document).trigger('wpbc:resource-shortcode-selected', [{
    resource_id: resource_id,
    shortcode: shortcode_val
  }]);

  // Scroll
  if ('function' === typeof wpbc_scroll_to) {
    wpbc_scroll_to('#div_booking_resource_shortcode_' + jQuery("#booking_wpbc_resource_id").val());
  }
}

/* R E S E T */
function wpbc_shortcode_config__reset(shortcode_val) {
  if ('booking_appointment' === shortcode_val || 'booking_resource_selector' === shortcode_val) {
    wpbc_shortcode_config__reset_workflow(shortcode_val);
    return;
  }
  jQuery('#' + shortcode_val + '_wpbc_startmonth_active').prop('checked', false).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_calendar_dates_start_active').prop('checked', false).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_calendar_dates_end_active').prop('checked', false).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_aggregate option:selected').prop('selected', false);
  jQuery('#' + shortcode_val + '_wpbc_aggregate option:eq(0)').prop('selected', true);
  jQuery('#' + shortcode_val + '_wpbc_aggregate__bookings_only').prop('checked', false).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_custom_form option:eq(0)').prop('selected', true);
  jQuery('#' + shortcode_val + '_wpbc_nummonths option:eq(0)').prop('selected', true);
  jQuery('#' + shortcode_val + '_wpbc_size_enabled').prop('checked', false).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_popup_enabled').prop('checked', false).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_popup_button_title').val(jQuery('#' + shortcode_val + '_wpbc_popup_button_title').attr('placeholder')).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_popup_title').val(jQuery('#' + shortcode_val + '_wpbc_popup_title').attr('placeholder')).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_popup_button_class').val('wp-element-button').trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_popup_modal_class').val('').trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_popup_size option[value="lg"]').prop('selected', true).trigger('change');
  wpbc_shortcode_config__select_day_weekday__reset(shortcode_val + 'wpbc_select_day_weekday');
  wpbc_shortcode_config__select_day_season__reset(shortcode_val + 'wpbc_select_day_season');
  wpbc_shortcode_config__start_day_season__reset(shortcode_val + 'wpbc_start_day_season');
  wpbc_shortcode_config__select_day_fordate__reset(shortcode_val + 'wpbc_select_day_fordate');

  // Reset  for [bookingselect] shortcode params
  jQuery('#' + shortcode_val + '_wpbc_multiple_resources option:selected').prop('selected', false);
  jQuery('#' + shortcode_val + '_wpbc_multiple_resources option:eq(0)').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_selected_resource option:eq(0)').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_text_label').val('').trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_first_option_title').val('').trigger('change');

  // Reset  for [bookingtimeline] shortcode params
  jQuery('#' + shortcode_val + '_wpbc_text_label_timeline').val('').trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_scroll_timeline_scroll_month option[value="0"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_scroll_timeline_scroll_days option[value="0"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_start_date_timeline_active').prop('checked', false).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_start_end_time_timeline_starttime option[value="0"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_start_end_time_timeline_endtime option[value="24"]').prop('selected', true).trigger('change');
  jQuery('input[name="' + shortcode_val + '_wpbc_view_mode_timeline_months_num_in_row"][value="30"]').prop('checked', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_start_date_timeline_year option[value="' + new Date().getFullYear() + '"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_start_date_timeline_month option[value="' + (new Date().getMonth() + 1) + '"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_start_date_timeline_day option[value="' + new Date().getDate() + '"]').prop('selected', true).trigger('change');

  // Reset  for [bookingform] shortcode params
  jQuery('#' + shortcode_val + '_wpbc_booking_date_year option[value="' + new Date().getFullYear() + '"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_booking_date_month option[value="' + (new Date().getMonth() + 1) + '"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_booking_date_day option[value="' + new Date().getDate() + '"]').prop('selected', true).trigger('change');

  // Reset  for [[bookingsearch ...] shortcode params
  jQuery('#' + shortcode_val + '_wpbc_search_new_page_url').val('').trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_search_new_page_enabled').prop('checked', false).trigger('change');
  // jQuery( '#' + shortcode_val + '_wpbc_search_header' ).val( '' ).trigger('change');                           // FixIn: 10.0.0.41.
  // jQuery( '#' + shortcode_val + '_wpbc_search_nothing_found' ).val( '' ).trigger('change');
  jQuery('#' + shortcode_val + '_wpbc_search_for_users').val('').trigger('change');
  jQuery('input[name="' + shortcode_val + '_wpbc_search_form_results"][value="bookingsearch"]').prop('checked', true).trigger('change');

  // Reset  for [bookingedit] , [bookingcustomerlisting] , [bookingresource type=6 show='capacity'] , [booking_confirm]
  jQuery('input[name="' + shortcode_val + '_wpbc_shortcode_type"][value="booking_confirm"]').prop('checked', true).trigger('change');

  // booking_import_ics , booking_listing_ics
  jQuery('#' + shortcode_val + '_wpbc_url').val('').trigger('change');
  jQuery('#' + shortcode_val + '_from option[value="today"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_from_offset').val('').trigger('change');
  jQuery('#' + shortcode_val + '_from_offset_type option:eq(0)').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_until option[value="any"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_until_offset').val('').trigger('change');
  jQuery('#' + shortcode_val + '_until_offset_type option:eq(0)').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_conditions_import option:eq(0)').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_conditions_events option[value="1"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_conditions_max_num option[value="0"]').prop('selected', true).trigger('change');
  jQuery('#' + shortcode_val + '_silence option[value="0"]').prop('selected', true).trigger('change');
}

/* ------------------------------------------------------------------------------------------------------------------ */
/**
 *  SHORTCODE_CONFIG
 * */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * Show the selected shortcode configuration from the popup navigation.
 *
 * Every shortcode uses the same constrained content layout so its tab bar,
 * generated shortcode, and popup actions remain fixed while only the selected
 * configuration section scrolls.
 *
 * @param {HTMLElement} _this              Clicked navigation link.
 * @param {string}      section_id_to_show Selector for the shortcode container.
 * @param {string}      shortcode_name     Shortcode name without brackets.
 * @return {void}
 */
function wpbc_shortcode_config_click_show_section(_this, section_id_to_show, shortcode_name) {
  var shortcode_container = jQuery(section_id_to_show);

  // Menu
  jQuery(_this).parents('.wpbc_settings_flex_container').find('.wpbc_settings_navigation_item_active').removeClass('wpbc_settings_navigation_item_active');
  jQuery(_this).parents('.wpbc_settings_navigation_item').addClass('wpbc_settings_navigation_item_active');

  // Content
  jQuery(_this).parents('.wpbc_settings_flex_container').find('.wpbc_sc_container__shortcode').removeClass('wpbc_sc_container__shortcode_is_active').hide();
  shortcode_container.show().addClass('wpbc_sc_container__shortcode_is_active');

  // Start each selected configuration at the beginning of its visible section.
  shortcode_container.find('.wpbc_sc_container__shortcode_section:visible').scrollTop(0);
  // Set - Shortcode Type
  jQuery('#wpbc_shortcode_type').val(shortcode_name);

  // Parse shortcode params
  wpbc_set_shortcode();
}

/**
 * Do Next / Prior step
 * @param _this		button  this
 * @param step		'prior' | 'next'
 */
function wpbc_shortcode_config_content_toolbar__next_prior(_this, step) {
  var j_work_nav_tab;
  var submenu_selected = jQuery(_this).parents('.wpbc_sc_container__shortcode').find('.wpbc_sc_container__shortcode_section:visible').find('.wpdevelop-submenu-tab-selected:visible');
  if (submenu_selected.length) {
    if ('next' === step) {
      j_work_nav_tab = submenu_selected.nextAll('a.nav-tab:visible').first();
    } else {
      j_work_nav_tab = submenu_selected.prevAll('a.nav-tab:visible').first();
    }
    if (j_work_nav_tab.length) {
      j_work_nav_tab.trigger('click');
      return;
    }
  }
  if ('next' === step) {
    j_work_nav_tab = jQuery(_this).parents('.wpbc_sc_container__shortcode').find('.nav-tab.nav-tab-active:visible').nextAll('a.nav-tab:visible').first();
  } else {
    j_work_nav_tab = jQuery(_this).parents('.wpbc_sc_container__shortcode').find('.nav-tab.nav-tab-active:visible').prevAll('a.nav-tab:visible').first();
  }
  if (j_work_nav_tab.length) {
    j_work_nav_tab.trigger('click');
  }
}

/**
 * Condition:   {select-day condition="weekday" for="5" value="3"}
 */
function wpbc_shortcode_config__select_day_weekday__add(id) {
  var condition_rule_arr = [];
  for (var weekday_num = 0; weekday_num < 8; weekday_num++) {
    if (jQuery('#' + id + '__weekday_' + weekday_num).is(':checked')) {
      var days_to_select = jQuery('#' + id + '__days_number_' + weekday_num).val().trim();
      // Remove all words except digits and , and -
      days_to_select = days_to_select.replace(/[^0-9,-]/g, '');
      days_to_select = days_to_select.replace(/[,]{2,}/g, ',');
      days_to_select = days_to_select.replace(/[-]{2,}/g, '-');
      jQuery('#' + id + '__days_number_' + weekday_num).val(days_to_select);
      if ('' !== days_to_select) {
        condition_rule_arr.push('{select-day condition="weekday" for="' + weekday_num + '" value="' + days_to_select + '"}');
      } else {
        // Red highlight fields,  if some required fields are empty
        if ('function' === typeof wpbc_field_highlight && '' === jQuery('#' + id + '__days_number_' + weekday_num).val()) {
          wpbc_field_highlight('#' + id + '__days_number_' + weekday_num);
        }
      }
    }
  }
  var condition_rule = condition_rule_arr.join(',');
  jQuery('#' + id + '_textarea').val(condition_rule);
  wpbc_set_shortcode();
}
function wpbc_shortcode_config__select_day_weekday__reset(id) {
  for (var weekday_num = 0; weekday_num < 8; weekday_num++) {
    jQuery('#' + id + '__days_number_' + weekday_num).val('');
    if (jQuery('#' + id + '__weekday_' + weekday_num).is(':checked')) {
      jQuery('#' + id + '__weekday_' + weekday_num).prop('checked', false);
    }
  }
  jQuery('#' + id + '_textarea').val('');
  wpbc_set_shortcode();
}

/**
 * Condition:   {select-day condition="season" for="High season" value="7-14,20"}
 */
function wpbc_shortcode_config__select_day_season__add(id) {
  var season_filter_name = jQuery('#' + id + '__season_filter_name option:selected').text().trim();
  // Escape quote symbols
  season_filter_name = season_filter_name.replace(/[\""]/g, '\\"');
  var days_number = jQuery('#' + id + '__days_number').val().trim();
  // Remove all words except digits and , and -
  days_number = days_number.replace(/[^0-9,-]/g, '');
  days_number = days_number.replace(/[,]{2,}/g, ',');
  days_number = days_number.replace(/[-]{2,}/g, '-');
  jQuery('#' + id + '__days_number').val(days_number);
  if ('' != days_number && '' != season_filter_name && 0 != jQuery('#' + id + '__season_filter_name').val()) {
    var exist_configuration = jQuery('#' + id + '_textarea').val();
    exist_configuration = exist_configuration.replaceAll("},{", '}~~{');
    var condition_rule_arr = exist_configuration.split('~~');

    // Remove empty spaces from  array : '' | ""
    condition_rule_arr = condition_rule_arr.filter(function (n) {
      return n;
    });
    condition_rule_arr.push('{select-day condition="season" for="' + season_filter_name + '" value="' + days_number + '"}');

    // Remove duplicates from  the array
    condition_rule_arr = condition_rule_arr.filter(function (item, pos) {
      return condition_rule_arr.indexOf(item) === pos;
    });
    var condition_rule = condition_rule_arr.join(',');
    jQuery('#' + id + '_textarea').val(condition_rule);
    wpbc_set_shortcode();
  }

  // Red highlight fields,  if some required fields are empty
  if ('function' === typeof wpbc_field_highlight && '' === jQuery('#' + id + '__days_number').val()) {
    wpbc_field_highlight('#' + id + '__days_number');
  }
  if ('function' === typeof wpbc_field_highlight && '0' === jQuery('#' + id + '__season_filter_name').val()) {
    wpbc_field_highlight('#' + id + '__season_filter_name');
  }
}
function wpbc_shortcode_config__select_day_season__reset(id) {
  jQuery('#' + id + '__season_filter_name option:eq(0)').prop('selected', true);
  jQuery('#' + id + '__days_number').val('');
  jQuery('#' + id + '_textarea').val('');
  wpbc_set_shortcode();
}

/**
 * Condition:   {start-day condition="season" for="Low season" value="0,1,5"}
 */
function wpbc_shortcode_config__start_day_season__add(id) {
  var season_filter_name = jQuery('#' + id + '__season_filter_name option:selected').text().trim();
  // Escape quote symbols
  season_filter_name = season_filter_name.replace(/[\""]/g, '\\"');
  if ('' != season_filter_name && 0 != jQuery('#' + id + '__season_filter_name').val()) {
    var activated_weekdays = [];
    for (var weekday_num = 0; weekday_num < 8; weekday_num++) {
      if (jQuery('#' + id + '__weekday_' + weekday_num).is(':checked')) {
        activated_weekdays.push(weekday_num);
      }
    }
    activated_weekdays = activated_weekdays.join(',');
    if ('' != activated_weekdays) {
      var exist_configuration = jQuery('#' + id + '_textarea').val();
      exist_configuration = exist_configuration.replaceAll("},{", '}~~{');
      var condition_rule_arr = exist_configuration.split('~~');

      // Remove empty spaces from  array : '' | ""
      condition_rule_arr = condition_rule_arr.filter(function (n) {
        return n;
      });
      condition_rule_arr.push('{start-day condition="season" for="' + season_filter_name + '" value="' + activated_weekdays + '"}');

      // Remove duplicates from  the array
      condition_rule_arr = condition_rule_arr.filter(function (item, pos) {
        return condition_rule_arr.indexOf(item) === pos;
      });
      var condition_rule = condition_rule_arr.join(',');
      jQuery('#' + id + '_textarea').val(condition_rule);
      wpbc_set_shortcode();
    }
  }

  // Red highlight fields,  if some required fields are empty
  if ('function' === typeof wpbc_field_highlight && '0' === jQuery('#' + id + '__season_filter_name').val()) {
    wpbc_field_highlight('#' + id + '__season_filter_name');
  }
}
function wpbc_shortcode_config__start_day_season__reset(id) {
  jQuery('#' + id + '__season_filter_name option:eq(0)').prop('selected', true);
  for (var weekday_num = 0; weekday_num < 8; weekday_num++) {
    if (jQuery('#' + id + '__weekday_' + weekday_num).is(':checked')) {
      jQuery('#' + id + '__weekday_' + weekday_num).prop('checked', false);
    }
  }
  jQuery('#' + id + '_textarea').val('');
  wpbc_set_shortcode();
}

/**
 * Condition:   {select-day condition="date" for="2023-10-01" value="20,25,30-35"}
 */
function wpbc_shortcode_config__select_day_fordate__add(id) {
  var start_date__fordate = jQuery('#' + id + '__date').val().trim();
  // Remove all words except digits and , and -
  start_date__fordate = start_date__fordate.replace(/[^0-9-]/g, '');
  var globalRegex = new RegExp(/^\d{4}-[01]{1}\d{1}-[0123]{1}\d{1}$/, 'g');
  var is_valid_date = globalRegex.test(start_date__fordate);
  if (!is_valid_date) {
    start_date__fordate = '';
  }
  jQuery('#' + id + '__date').val(start_date__fordate);
  var days_number = jQuery('#' + id + '__days_number').val().trim();
  // Remove all words except digits and , and -
  days_number = days_number.replace(/[^0-9,-]/g, '');
  days_number = days_number.replace(/[,]{2,}/g, ',');
  days_number = days_number.replace(/[-]{2,}/g, '-');
  jQuery('#' + id + '__days_number').val(days_number);
  if ('' != days_number && '' != start_date__fordate && 0 != jQuery('#' + id + '__season_filter_name').val()) {
    var exist_configuration = jQuery('#' + id + '_textarea').val();
    exist_configuration = exist_configuration.replaceAll("},{", '}~~{');
    var condition_rule_arr = exist_configuration.split('~~');

    // Remove empty spaces from  array : '' | ""
    condition_rule_arr = condition_rule_arr.filter(function (n) {
      return n;
    });
    condition_rule_arr.push('{select-day condition="date" for="' + start_date__fordate + '" value="' + days_number + '"}');

    // Remove duplicates from  the array
    condition_rule_arr = condition_rule_arr.filter(function (item, pos) {
      return condition_rule_arr.indexOf(item) === pos;
    });
    var condition_rule = condition_rule_arr.join(',');
    jQuery('#' + id + '_textarea').val(condition_rule);
    wpbc_set_shortcode();
  } else
    // Red highlight fields,  if some required fields are empty
    if ('function' === typeof wpbc_field_highlight && '' === jQuery('#' + id + '__date').val()) {
      wpbc_field_highlight('#' + id + '__date');
    }
  if ('function' === typeof wpbc_field_highlight && '' === jQuery('#' + id + '__days_number').val()) {
    wpbc_field_highlight('#' + id + '__days_number');
  }
}
function wpbc_shortcode_config__select_day_fordate__reset(id) {
  jQuery('#' + id + '__date').val('');
  jQuery('#' + id + '__days_number').val('');
  jQuery('#' + id + '_textarea').val('');
  wpbc_set_shortcode();
}
function wpbc_shortcode_config__update_elements_in_timeline() {
  var wpbc_is_matrix = false;
  if (jQuery('#bookingtimeline_wpbc_multiple_resources').length > 0) {
    var bookingtimeline_wpbc_multiple_resources_temp = jQuery('#bookingtimeline_wpbc_multiple_resources').val();
    if (bookingtimeline_wpbc_multiple_resources_temp != null && bookingtimeline_wpbc_multiple_resources_temp.length > 0) {
      jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row']").prop("disabled", false);
      jQuery(".wpbc_sc_container__shortcode_bookingtimeline label.wpbc-form-radio").show();
      if (bookingtimeline_wpbc_multiple_resources_temp.length > 1 || bookingtimeline_wpbc_multiple_resources_temp.length == 1 && bookingtimeline_wpbc_multiple_resources_temp[0] == '0') {
        // Matrix
        wpbc_is_matrix = true;
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='90']").prop("disabled", true);
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='90']").parents('.wpbc-form-radio').hide();
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='365']").prop("disabled", true);
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='365']").parents('.wpbc-form-radio').hide();
      } else {
        // Single
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='1']").prop("disabled", true);
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='1']").parents('.wpbc-form-radio').hide();
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='7']").prop("disabled", true);
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='7']").parents('.wpbc-form-radio').hide();
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='60']").prop("disabled", true);
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='60']").parents('.wpbc-form-radio').hide();
      }
      if (jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row']:checked").is(':disabled')) {
        jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row'][value='30']").prop("checked", true);
      }
    }
  }
  var view_days_num_temp = 30;
  if (jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row']:checked").length > 0) {
    var view_days_num_temp = parseInt(jQuery("input[name='bookingtimeline_wpbc_view_mode_timeline_months_num_in_row']:checked").val().trim());
  }

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Hide or Show Scrolling Days and Months, depending on from type of view and number of booking resources
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  jQuery("#wpbc_bookingtimeline_scroll_month,#wpbc_bookingtimeline_scroll_day").prop("disabled", false);
  jQuery(".wpbc_bookingtimeline_scroll_month,.wpbc_bookingtimeline_scroll_day").show();
  // Matrix //////////////////////////////////////////////
  if (wpbc_is_matrix && (view_days_num_temp == 1 || view_days_num_temp == 7) // Day | Week view
  ) {
    jQuery("#wpbc_bookingtimeline_scroll_month").prop("disabled", true); // Scroll Month NOT working
    jQuery('.wpbc_bookingtimeline_scroll_month').hide();
  }
  if (wpbc_is_matrix && (view_days_num_temp == 30 || view_days_num_temp == 60) // Month view
  ) {
    jQuery("#wpbc_bookingtimeline_scroll_day").prop("disabled", true); // Scroll Days NOT working
    jQuery('.wpbc_bookingtimeline_scroll_day').hide();
  }
  // Single //////////////////////////////////////////////
  if (!wpbc_is_matrix && (view_days_num_temp == 30 || view_days_num_temp == 90) // Month | 3 Months view (like week view)
  ) {
    jQuery("#wpbc_bookingtimeline_scroll_month").prop("disabled", true); // Scroll Month NOT working
    jQuery('.wpbc_bookingtimeline_scroll_month').hide();
  }
  if (!wpbc_is_matrix && view_days_num_temp == 365 // Year view
  ) {
    jQuery("#wpbc_bookingtimeline_scroll_day").prop("disabled", true); // Scroll Days NOT working
    jQuery('.wpbc_bookingtimeline_scroll_day').hide();
  }
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  return [wpbc_is_matrix, view_days_num_temp];
}
jQuery(document).ready(function () {
  // -----------------------------------------------------------------------------------------------------
  // [booking ... ]

  var shortcode_arr = ['booking', 'bookingcalendar', 'bookingselect', 'bookingtimeline', 'bookingform', 'bookingsearch', 'bookingother', 'booking_import_ics', 'booking_listing_ics', 'booking_appointment', 'booking_resource_selector'];
  for (var shortcde_key in shortcode_arr) {
    var id = shortcode_arr[shortcde_key];

    // -------------------------------------------------------------------------------------------------------------
    // Hide by Size sections
    // -------------------------------------------------------------------------------------------------------------
    jQuery('.' + id + '_wpbc_size_wpbc_sc_calendar_size').hide();
    jQuery('.' + id + '_wpbc_popup_wpbc_sc_booking_popup').hide();

    // options :: Show / Hide SIZE calendar  section
    jQuery('#' + id + '_wpbc_size_enabled').on('change', {
      'id': id
    }, function (event) {
      if (jQuery('#' + event.data.id + '_wpbc_size_enabled').is(':checked')) {
        jQuery('.' + event.data.id + '_wpbc_size_wpbc_sc_calendar_size').show();
      } else {
        jQuery('.' + event.data.id + '_wpbc_size_wpbc_sc_calendar_size').hide();
      }
    });
    jQuery('#' + id + '_wpbc_popup_enabled').on('change', {
      'id': id
    }, function (event) {
      if (jQuery('#' + event.data.id + '_wpbc_popup_enabled').is(':checked')) {
        jQuery('.' + event.data.id + '_wpbc_popup_wpbc_sc_booking_popup').show();
      } else {
        jQuery('.' + event.data.id + '_wpbc_popup_wpbc_sc_booking_popup').hide();
      }
    });

    // If we changed number of months in 'Setup Size & Structure' then  change general 'Visible months' number      // FixIn: 10.0.0.4.
    jQuery('#' + id + '_wpbc_size_months_num_in_row' // - Month Num in Row
    ).on('change', {
      'id': id
    }, function (event) {
      jQuery('#' + event.data.id + '_wpbc_nummonths option[value="' + parseInt(jQuery('#' + event.data.id + '_wpbc_size_months_num_in_row').val().trim()) + '"]').prop('selected', true); //.trigger('change');
      if ('function' === typeof wpbc_field_highlight) {
        wpbc_field_highlight('#' + event.data.id + '_wpbc_nummonths');
      }
    });

    // -------------------------------------------------------------------------------------------------------------
    // Update Shortcode on changing: Size
    // -------------------------------------------------------------------------------------------------------------
    jQuery('#' + id + '_wpbc_size_enabled' // Size On | Off
    + ',#' + id + '_wpbc_size_months_num_in_row' // - Month Num in Row
    + ',#' + id + '_wpbc_size_calendar_width' // - Width
    + ',#' + id + '_wpbc_size_calendar_width_px_pr' // - Width PS | %
    + ',#' + id + '_wpbc_size_calendar_cell_height' // - Cell Height
    + ',#' + id + '_wpbc_popup_enabled' // Booking form popup On | Off
    + ',#' + id + '_wpbc_popup_button_title' // Popup button title
    + ',#' + id + '_wpbc_popup_title' // Popup title
    + ',#' + id + '_wpbc_popup_button_class' // Popup button class
    + ',#' + id + '_wpbc_popup_modal_class' // Popup modal class
    + ',#' + id + '_wpbc_popup_size' // Popup size
    + ',#' + id + 'wpbc_select_day_weekday_textarea' // Rule Weekday
    + ',#' + id + 'wpbc_select_day_season_textarea' // Rule Season
    + ',#' + id + 'wpbc_start_day_season_textarea' // Rule Season - Start day
    + ',#' + id + 'wpbc_select_day_fordate_textarea' // Rule Date
    + ',#' + id + '_wpbc_resource_id' // Resource ID
    + ',#' + id + '_wpbc_custom_form' // Custom Form
    + ',#' + id + '_wpbc_nummonths' // Num Months
    + ',#' + id + '_wpbc_startmonth_active' // Start Month Enable
    + ',#' + id + '_wpbc_startmonth_year' //  - Year
    + ',#' + id + '_wpbc_startmonth_month' //  - Month
    + ',#' + id + '_wpbc_calendar_dates_start_active' // Start Month Enable
    + ',#' + id + '_wpbc_calendar_dates_start_year' //  - Year
    + ',#' + id + '_wpbc_calendar_dates_start_month' //  - Month
    + ',#' + id + '_wpbc_calendar_dates_start_date' //  - Month
    + ',#' + id + '_wpbc_calendar_dates_end_active' // Start Month Enable
    + ',#' + id + '_wpbc_calendar_dates_end_year' //  - Year
    + ',#' + id + '_wpbc_calendar_dates_end_month' //  - Month
    + ',#' + id + '_wpbc_calendar_dates_end_date' //  - Month
    + ',#' + id + '_wpbc_aggregate' // Aggregate
    + ',#' + id + '_wpbc_aggregate__bookings_only' // aggregate option
    + ',#' + id + '_wpbc_multiple_resources' // [bookingselect] - Multiple Resources
    + ',#' + id + '_wpbc_selected_resource' // [bookingselect] - Selected Resource
    + ',#' + id + '_wpbc_text_label' // [bookingselect] - Label
    + ',#' + id + '_wpbc_first_option_title' // [bookingselect] - First  Option

    // TimeLine
    + ",input[name='" + id + "_wpbc_view_mode_timeline_months_num_in_row']" + ',#' + id + '_wpbc_text_label_timeline' + ',#' + id + '_wpbc_scroll_timeline_scroll_days' + ',#' + id + '_wpbc_scroll_timeline_scroll_month' + ',#' + id + '_wpbc_start_date_timeline_active' + ',#' + id + '_wpbc_start_date_timeline_year' + ',#' + id + '_wpbc_start_date_timeline_month' + ',#' + id + '_wpbc_start_date_timeline_day' + ',#' + id + '_wpbc_start_end_time_timeline_starttime' + ',#' + id + '_wpbc_start_end_time_timeline_endtime'

    // Form Only
    + ',#' + id + '_wpbc_booking_date_year' + ',#' + id + '_wpbc_booking_date_month' + ',#' + id + '_wpbc_booking_date_day'

    // [bookingsearch ...]
    + ",input[name='" + id + "_wpbc_search_form_results']" + ',#' + id + '_wpbc_search_new_page_enabled' + ',#' + id + '_wpbc_search_new_page_url'
    // +',#' + id + '_wpbc_search_header'                       // FixIn: 10.0.0.41.
    // +',#' + id + '_wpbc_search_nothing_found'
    + ',#' + id + '_wpbc_search_for_users'

    // [bookingother ... ]
    + ",input[name='" + id + "_wpbc_shortcode_type']" + ',#' + id + '_wpbc_resource_show'

    //booking_import_ics , booking_listing_ics
    + ',#' + id + '_wpbc_url' + ',#' + id + '_from' + ',#' + id + '_from_offset' + ',#' + id + '_from_offset_type' + ',#' + id + '_until' + ',#' + id + '_until_offset' + ',#' + id + '_until_offset_type' + ',#' + id + '_conditions_import' + ',#' + id + '_conditions_events' + ',#' + id + '_conditions_max_num' + ',#' + id + '_silence').on('change', {
      'id': id
    }, function (event) {
      //console.log( 'on change wpbc_set_shortcode', event.data.id );
      wpbc_set_shortcode();
    });
  }
  // -----------------------------------------------------------------------------------------------------
  wpbc_set_shortcode();
  jQuery('.wpbc_shortcode_config__workflow_parameter').on('change input', function (event) {
    if ('change' === event.type) {
      wpbc_shortcode_config__apply_resource_list_preset(jQuery(this));
    }
    wpbc_set_shortcode();
  });
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvdWlfbW9kYWxfX3Nob3J0Y29kZXMvX291dC93cGJjX3Nob3J0Y29kZV9wb3B1cC5qcyIsIm5hbWVzIjpbIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX3dvcmtmbG93X2lkX2xpc3QiLCJyYXdfdmFsdWUiLCJub3JtYWxpemVkX2lkcyIsIlN0cmluZyIsInNwbGl0IiwiZm9yRWFjaCIsInJhd19pZCIsIm5vcm1hbGl6ZWRfaWQiLCJwYXJzZUludCIsImluZGV4T2YiLCJwdXNoIiwiam9pbiIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX2Nzc193aWR0aCIsIm5vcm1hbGl6ZWRfd2lkdGgiLCJ0cmltIiwidG9Mb3dlckNhc2UiLCJ3aWR0aF9tYXRjaCIsIm51bWVyaWNfd2lkdGgiLCJtYXhpbXVtX3dpZHRoIiwidGVzdCIsImV4ZWMiLCJwYXJzZUZsb2F0IiwiTnVtYmVyIiwidG9GaXhlZCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fZ2V0X3dvcmtmbG93X2ZpZWxkX3ZhbHVlIiwiJGZpZWxkIiwidmFsdWVfdHlwZSIsImRhdGEiLCJpcyIsInZhbCIsImZpZWxkX3ZhbHVlIiwiQXJyYXkiLCJpc0FycmF5IiwiaXNfdmFsaWQiLCJtb250aF9tYXRjaCIsInJhd19jc3Nfd2lkdGgiLCJpc05hTiIsIndwYmNfZmllbGRfaGlnaGxpZ2h0IiwiYXR0ciIsInJlcGxhY2UiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX2J1aWxkX3dvcmtmbG93X3Nob3J0Y29kZSIsInNob3J0Y29kZV9pZCIsInNob3J0Y29kZV90ZXh0IiwiJGNvbnRhaW5lciIsImpRdWVyeSIsImZpbmQiLCJlYWNoIiwicGFyYW1ldGVyX25hbWUiLCJkZWZhdWx0X3ZhbHVlIiwid3BiY19zaG9ydGNvZGVfY29uZmlnX19yZXNldF93b3JrZmxvdyIsInByb3AiLCJ3cGJjX3NldF9zaG9ydGNvZGUiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX2FwcGx5X3Jlc291cmNlX2xpc3RfcHJlc2V0IiwiJGNoYW5nZWRfZmllbGQiLCJjbG9zZXN0IiwibGVuZ3RoIiwiY29uc29sZSIsImxvZyIsIndwYmNfc2hvcnRjb2RlIiwid3BiY19vcHRpb25zX2FyciIsIm11bHRpcGxlX3Jlc291cmNlcyIsImZpbHRlciIsIm4iLCJ3cGJjX2lzX21hdHJpeF9fdmlld19kYXlzX251bV90ZW1wIiwid3BiY19zaG9ydGNvZGVfY29uZmlnX191cGRhdGVfZWxlbWVudHNfaW5fdGltZWxpbmUiLCJ3cGJjX2lzX21hdHJpeCIsInZpZXdfZGF5c19udW1fdGVtcCIsImhlYWRlcl90aXRsZV90ZW1wIiwiaGlkZSIsInNob3ciLCJ2aWV3X3RpbWVzX3N0YXJ0X3RlbXAiLCJ2aWV3X3RpbWVzX2VuZF90ZW1wIiwid3BiY19zZWxlY3RlZF9kYXkiLCJ3cGJjX3NlbGVjdGVkX21vbnRoIiwid3BiY19zZWFyY2hfZm9ybV9yZXN1bHRzIiwic2VhcmNoX3Jlc3VsdHNfdXJsX3RlbXAiLCJvbmx5X2Zvcl91c2Vyc190ZW1wIiwiYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlIiwic2hvcnRjb2RlX3VybF90ZW1wIiwicF9mcm9tIiwicF9mcm9tX29mZnNldCIsImNoYXJBdCIsInBfdW50aWwiLCJwX3VudGlsX29mZnNldCIsInBfbWF4IiwicF9pc19hbGxfZGF0ZXNfaW4iLCJwX2ltcG9ydF9jb25kaXRpb25zIiwiZm9ybV90eXBlX3RlbXAiLCJwb3B1cF9idXR0b25fdGl0bGVfZGVmYXVsdCIsInBvcHVwX2J1dHRvbl90aXRsZV90ZW1wIiwicG9wdXBfdGl0bGVfZGVmYXVsdCIsInBvcHVwX3RpdGxlX3RlbXAiLCJwb3B1cF9idXR0b25fY2xhc3NfdGVtcCIsInBvcHVwX21vZGFsX2NsYXNzX3RlbXAiLCJwb3B1cF9zaXplX3RlbXAiLCJ3cGJjX2FnZ3JlZ2F0ZV90ZW1wIiwid3BiY19vcHRpb25zX3NpemUiLCJNYXRoIiwibWluIiwid3BiY190aW55X2J0bl9jbGljayIsInRhZyIsIndwYmNfbXlfbW9kYWwiLCJrZXlib2FyZCIsImJhY2tkcm9wIiwid3BiY190aW55X2Nsb3NlIiwid3BiY19zZW5kX3RleHRfdG9fZWRpdG9yIiwiaCIsIndwYmNfc2VuZF90ZXh0X3RvX2d1dGVuYmVyZyIsImlzX3NlbmQiLCJlZCIsIm1jZSIsInRpbnltY2UiLCJxdCIsIlFUYWdzIiwid2luZG93Iiwid3BBY3RpdmVFZGl0b3IiLCJhY3RpdmVFZGl0b3IiLCJpZCIsImdldCIsImlzSGlkZGVuIiwiaXNJRSIsIndpbmRvd01hbmFnZXIiLCJpbnNlcnRpbWFnZWJvb2ttYXJrIiwic2VsZWN0aW9uIiwibW92ZVRvQm9va21hcmsiLCJ3cFNldEltZ0NhcHRpb24iLCJwbHVnaW5zIiwid3BnYWxsZXJ5IiwiX2RvX2dhbGxlcnkiLCJ3b3JkcHJlc3MiLCJfc2V0RW1iZWQiLCJleGVjQ29tbWFuZCIsImluc2VydENvbnRlbnQiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwidmFsdWUiLCJ0Yl9yZW1vdmUiLCJlIiwid3BiY19yZXNvdXJjZV9wYWdlX2J0bl9jbGljayIsInJlc291cmNlX2lkIiwic2hvcnRjb2RlX2RlZmF1bHRfdmFsdWUiLCJzaG9ydGNvZGVfYXJyIiwic2hvcnRjZGVfa2V5IiwidHJpZ2dlciIsIndwYmNfc2VuZF90ZXh0X3RvX3Jlc291cmNlIiwic2hvcnRjb2RlX3ZhbCIsImh0bWwiLCJzaG9ydGNvZGUiLCJ3cGJjX3Njcm9sbF90byIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fcmVzZXQiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfd2Vla2RheV9fcmVzZXQiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfc2Vhc29uX19yZXNldCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc3RhcnRfZGF5X3NlYXNvbl9fcmVzZXQiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfZm9yZGF0ZV9fcmVzZXQiLCJEYXRlIiwiZ2V0RnVsbFllYXIiLCJnZXRNb250aCIsImdldERhdGUiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfY2xpY2tfc2hvd19zZWN0aW9uIiwiX3RoaXMiLCJzZWN0aW9uX2lkX3RvX3Nob3ciLCJzaG9ydGNvZGVfbmFtZSIsInNob3J0Y29kZV9jb250YWluZXIiLCJwYXJlbnRzIiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsInNjcm9sbFRvcCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19jb250ZW50X3Rvb2xiYXJfX25leHRfcHJpb3IiLCJzdGVwIiwial93b3JrX25hdl90YWIiLCJzdWJtZW51X3NlbGVjdGVkIiwibmV4dEFsbCIsImZpcnN0IiwicHJldkFsbCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV93ZWVrZGF5X19hZGQiLCJjb25kaXRpb25fcnVsZV9hcnIiLCJ3ZWVrZGF5X251bSIsImRheXNfdG9fc2VsZWN0IiwiY29uZGl0aW9uX3J1bGUiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfc2Vhc29uX19hZGQiLCJzZWFzb25fZmlsdGVyX25hbWUiLCJ0ZXh0IiwiZGF5c19udW1iZXIiLCJleGlzdF9jb25maWd1cmF0aW9uIiwicmVwbGFjZUFsbCIsIml0ZW0iLCJwb3MiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3N0YXJ0X2RheV9zZWFzb25fX2FkZCIsImFjdGl2YXRlZF93ZWVrZGF5cyIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV9mb3JkYXRlX19hZGQiLCJzdGFydF9kYXRlX19mb3JkYXRlIiwiZ2xvYmFsUmVnZXgiLCJSZWdFeHAiLCJpc192YWxpZF9kYXRlIiwiYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzX3RlbXAiLCJyZWFkeSIsIm9uIiwiZXZlbnQiLCJ0eXBlIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvdWlfbW9kYWxfX3Nob3J0Y29kZXMvX3NyYy93cGJjX3Nob3J0Y29kZV9wb3B1cC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE5vcm1hbGl6ZSBhIHVzZXItZW50ZXJlZCBsaXN0IG9mIHBvc2l0aXZlIElEcyBmb3IgYSB3b3JrZmxvdyBzaG9ydGNvZGUuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHJhd192YWx1ZSBDb21tYS0sIHNlbWljb2xvbi0sIG9yIHdoaXRlc3BhY2UtZGVsaW1pdGVkIElEcy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFVuaXF1ZSBjb21tYS1kZWxpbWl0ZWQgcG9zaXRpdmUgSURzLlxuICovXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX25vcm1hbGl6ZV93b3JrZmxvd19pZF9saXN0KCByYXdfdmFsdWUgKSB7XG4gICAgdmFyIG5vcm1hbGl6ZWRfaWRzID0gW107XG4gICAgU3RyaW5nKCByYXdfdmFsdWUgfHwgJycgKS5zcGxpdCggL1s7LFxcc10rLyApLmZvckVhY2goIGZ1bmN0aW9uICggcmF3X2lkICkge1xuICAgICAgICB2YXIgbm9ybWFsaXplZF9pZCA9IHBhcnNlSW50KCByYXdfaWQsIDEwICk7XG4gICAgICAgIGlmICggbm9ybWFsaXplZF9pZCA+IDAgJiYgLTEgPT09IG5vcm1hbGl6ZWRfaWRzLmluZGV4T2YoIG5vcm1hbGl6ZWRfaWQgKSApIHtcbiAgICAgICAgICAgIG5vcm1hbGl6ZWRfaWRzLnB1c2goIG5vcm1hbGl6ZWRfaWQgKTtcbiAgICAgICAgfVxuICAgIH0gKTtcblxuICAgIHJldHVybiBub3JtYWxpemVkX2lkcy5qb2luKCAnLCcgKTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgb25lIHNhZmUgcHVibGljIGNhdGFsb2cgQ1NTIHdpZHRoLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSByYXdfdmFsdWUgUmF3IHdpZHRoIGVudGVyZWQgaW4gdGhlIHNob3J0Y29kZSBidWlsZGVyLlxuICogQHJldHVybnMge3N0cmluZ30gTm9ybWFsaXplZCB3aWR0aCBvciBhbiBlbXB0eSBzdHJpbmcgZm9yIGF1dG9tYXRpYyB3aWR0aC5cbiAqL1xuZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19ub3JtYWxpemVfY3NzX3dpZHRoKCByYXdfdmFsdWUgKSB7XG4gICAgdmFyIG5vcm1hbGl6ZWRfd2lkdGggPSBTdHJpbmcoIHJhd192YWx1ZSB8fCAnJyApLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhciB3aWR0aF9tYXRjaDtcbiAgICB2YXIgbnVtZXJpY193aWR0aDtcbiAgICB2YXIgbWF4aW11bV93aWR0aDtcblxuICAgIGlmICggJycgPT09IG5vcm1hbGl6ZWRfd2lkdGggfHwgJ2F1dG8nID09PSBub3JtYWxpemVkX3dpZHRoICkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIGlmICggL15cXGQrKD86XFwuXFxkKyk/JC8udGVzdCggbm9ybWFsaXplZF93aWR0aCApICkge1xuICAgICAgICBub3JtYWxpemVkX3dpZHRoICs9ICdweCc7XG4gICAgfVxuXG4gICAgd2lkdGhfbWF0Y2ggPSAvXihcXGQrKD86XFwuXFxkKyk/KShweHwlfHJlbXxlbXx2dykkLy5leGVjKCBub3JtYWxpemVkX3dpZHRoICk7XG4gICAgaWYgKCAhIHdpZHRoX21hdGNoICkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgbnVtZXJpY193aWR0aCA9IHBhcnNlRmxvYXQoIHdpZHRoX21hdGNoWyAxIF0gKTtcbiAgICBtYXhpbXVtX3dpZHRoID0gJyUnID09PSB3aWR0aF9tYXRjaFsgMiBdIHx8ICd2dycgPT09IHdpZHRoX21hdGNoWyAyIF0gPyAxMDAgOiAoICdweCcgPT09IHdpZHRoX21hdGNoWyAyIF0gPyAyMDAwIDogMTAwICk7XG4gICAgaWYgKCBudW1lcmljX3dpZHRoIDw9IDAgfHwgbnVtZXJpY193aWR0aCA+IG1heGltdW1fd2lkdGggKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICByZXR1cm4gU3RyaW5nKCBOdW1iZXIoIG51bWVyaWNfd2lkdGgudG9GaXhlZCggNCApICkgKSArIHdpZHRoX21hdGNoWyAyIF07XG59XG5cbi8qKlxuICogTm9ybWFsaXplIG9uZSB3b3JrZmxvdyBzaG9ydGNvZGUgZmllbGQgYWNjb3JkaW5nIHRvIGl0cyBkZWNsYXJlZCB2YWx1ZSB0eXBlLlxuICpcbiAqIEBwYXJhbSB7alF1ZXJ5fSAkZmllbGQgUGFyYW1ldGVyIGNvbnRyb2wuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBTYWZlIHZhbHVlIGZvciB0aGUgZ2VuZXJhdGVkIHNob3J0Y29kZS5cbiAqL1xuZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19nZXRfd29ya2Zsb3dfZmllbGRfdmFsdWUoICRmaWVsZCApIHtcbiAgICB2YXIgdmFsdWVfdHlwZSA9IFN0cmluZyggJGZpZWxkLmRhdGEoICd3cGJjLXNob3J0Y29kZS12YWx1ZS10eXBlJyApIHx8ICd0ZXh0JyApO1xuICAgIHZhciByYXdfdmFsdWUgPSAkZmllbGQuaXMoICc6Y2hlY2tib3gnICkgPyAoICRmaWVsZC5pcyggJzpjaGVja2VkJyApID8gJ29uJyA6ICdvZmYnICkgOiAkZmllbGQudmFsKCk7XG4gICAgdmFyIGZpZWxkX3ZhbHVlID0gQXJyYXkuaXNBcnJheSggcmF3X3ZhbHVlICkgPyByYXdfdmFsdWUuam9pbiggJywnICkgOiBTdHJpbmcoIHJhd192YWx1ZSB8fCAnJyApLnRyaW0oKTtcbiAgICB2YXIgaXNfdmFsaWQgPSB0cnVlO1xuICAgIHZhciBtb250aF9tYXRjaDtcbiAgICB2YXIgcmF3X2Nzc193aWR0aDtcblxuICAgIGlmICggJ3Bvc2l0aXZlX2ludGVnZXInID09PSB2YWx1ZV90eXBlICkge1xuICAgICAgICBmaWVsZF92YWx1ZSA9ICcnID09PSBmaWVsZF92YWx1ZSA/ICcnIDogU3RyaW5nKCBwYXJzZUludCggZmllbGRfdmFsdWUsIDEwICkgKTtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gZmllbGRfdmFsdWUgfHwgKCAhIGlzTmFOKCBwYXJzZUludCggZmllbGRfdmFsdWUsIDEwICkgKSAmJiBwYXJzZUludCggZmllbGRfdmFsdWUsIDEwICkgPiAwICk7XG4gICAgfSBlbHNlIGlmICggJ2lkX2xpc3QnID09PSB2YWx1ZV90eXBlICkge1xuICAgICAgICBmaWVsZF92YWx1ZSA9IHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX3dvcmtmbG93X2lkX2xpc3QoIGZpZWxkX3ZhbHVlICk7XG4gICAgfSBlbHNlIGlmICggJ2Nzc193aWR0aCcgPT09IHZhbHVlX3R5cGUgKSB7XG4gICAgICAgIHJhd19jc3Nfd2lkdGggPSBmaWVsZF92YWx1ZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBmaWVsZF92YWx1ZSA9IHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX2Nzc193aWR0aCggZmllbGRfdmFsdWUgKTtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gcmF3X2Nzc193aWR0aCB8fCAnYXV0bycgPT09IHJhd19jc3Nfd2lkdGggfHwgJycgIT09IGZpZWxkX3ZhbHVlO1xuICAgIH0gZWxzZSBpZiAoICdkYXRlJyA9PT0gdmFsdWVfdHlwZSApIHtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gZmllbGRfdmFsdWUgfHwgL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoIGZpZWxkX3ZhbHVlICk7XG4gICAgfSBlbHNlIGlmICggJ21vbnRoJyA9PT0gdmFsdWVfdHlwZSApIHtcbiAgICAgICAgbW9udGhfbWF0Y2ggPSAvXihcXGR7NH0pKD86LT8oXFxkezEsMn0pfFxcLyhcXGR7MSwyfSkpJC8uZXhlYyggZmllbGRfdmFsdWUgKTtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gZmllbGRfdmFsdWUgfHwgKCBtb250aF9tYXRjaCAmJiBwYXJzZUludCggbW9udGhfbWF0Y2hbIDIgXSB8fCBtb250aF9tYXRjaFsgMyBdLCAxMCApID49IDFcbiAgICAgICAgICAgICYmIHBhcnNlSW50KCBtb250aF9tYXRjaFsgMiBdIHx8IG1vbnRoX21hdGNoWyAzIF0sIDEwICkgPD0gMTIgKTtcbiAgICB9XG5cbiAgICBpZiAoICEgaXNfdmFsaWQgKSB7XG4gICAgICAgIGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfZmllbGRfaGlnaGxpZ2h0ICkge1xuICAgICAgICAgICAgd3BiY19maWVsZF9oaWdobGlnaHQoICcjJyArICRmaWVsZC5hdHRyKCAnaWQnICkgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZpZWxkX3ZhbHVlLnJlcGxhY2UoIC8nL2csICcnICk7XG59XG5cbi8qKlxuICogQnVpbGQgb25lIG1vZGVybiB3b3JrZmxvdyBzaG9ydGNvZGUgZnJvbSBkZWNsYXJhdGl2ZSBwb3B1cCBjb250cm9scy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc2hvcnRjb2RlX2lkIGJvb2tpbmdfYXBwb2ludG1lbnQgb3IgYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvci5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IENvbXBsZXRlIHNob3J0Y29kZSB0ZXh0LlxuICovXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX2J1aWxkX3dvcmtmbG93X3Nob3J0Y29kZSggc2hvcnRjb2RlX2lkICkge1xuICAgIHZhciBzaG9ydGNvZGVfdGV4dCA9ICdbJyArIHNob3J0Y29kZV9pZDtcbiAgICB2YXIgJGNvbnRhaW5lciA9IGpRdWVyeSggJyN3cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlXycgKyBzaG9ydGNvZGVfaWQgKTtcblxuICAgICRjb250YWluZXIuZmluZCggJ1tkYXRhLXdwYmMtc2hvcnRjb2RlLXBhcmFtZXRlcl0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJGZpZWxkID0galF1ZXJ5KCB0aGlzICk7XG4gICAgICAgIHZhciBwYXJhbWV0ZXJfbmFtZSA9IFN0cmluZyggJGZpZWxkLmRhdGEoICd3cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXInICkgfHwgJycgKTtcbiAgICAgICAgdmFyIGRlZmF1bHRfdmFsdWUgPSBTdHJpbmcoICRmaWVsZC5kYXRhKCAnd3BiYy1zaG9ydGNvZGUtZGVmYXVsdCcgKSApO1xuICAgICAgICB2YXIgZmllbGRfdmFsdWUgPSB3cGJjX3Nob3J0Y29kZV9jb25maWdfX2dldF93b3JrZmxvd19maWVsZF92YWx1ZSggJGZpZWxkICk7XG5cbiAgICAgICAgaWYgKCBwYXJhbWV0ZXJfbmFtZSAmJiBmaWVsZF92YWx1ZSAhPT0gZGVmYXVsdF92YWx1ZSApIHtcbiAgICAgICAgICAgIHNob3J0Y29kZV90ZXh0ICs9ICcgJyArIHBhcmFtZXRlcl9uYW1lICsgJz1cXCcnICsgZmllbGRfdmFsdWUgKyAnXFwnJztcbiAgICAgICAgfVxuICAgIH0gKTtcblxuICAgIHJldHVybiBzaG9ydGNvZGVfdGV4dCArICddJztcbn1cblxuLyoqXG4gKiBSZXN0b3JlIG9uZSB3b3JrZmxvdyBzaG9ydGNvZGUgc2VjdGlvbiB0byBpdHMgcGFyc2VyLWJhY2tlZCBVSSBkZWZhdWx0cy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc2hvcnRjb2RlX2lkIGJvb2tpbmdfYXBwb2ludG1lbnQgb3IgYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvci5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3Jlc2V0X3dvcmtmbG93KCBzaG9ydGNvZGVfaWQgKSB7XG4gICAgdmFyICRjb250YWluZXIgPSBqUXVlcnkoICcjd3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZV8nICsgc2hvcnRjb2RlX2lkICk7XG5cbiAgICAkY29udGFpbmVyLmZpbmQoICdbZGF0YS13cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXJdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyICRmaWVsZCA9IGpRdWVyeSggdGhpcyApO1xuICAgICAgICB2YXIgZGVmYXVsdF92YWx1ZSA9IFN0cmluZyggJGZpZWxkLmRhdGEoICd3cGJjLXNob3J0Y29kZS1kZWZhdWx0JyApICk7XG5cbiAgICAgICAgaWYgKCAkZmllbGQuaXMoICc6Y2hlY2tib3gnICkgKSB7XG4gICAgICAgICAgICAkZmllbGQucHJvcCggJ2NoZWNrZWQnLCAnb24nID09PSBkZWZhdWx0X3ZhbHVlICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkZmllbGQudmFsKCBkZWZhdWx0X3ZhbHVlICk7XG4gICAgICAgIH1cbiAgICB9ICk7XG5cbiAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbn1cblxuLyoqXG4gKiBBcHBseSB0aGUgcmVjb21tZW5kZWQgY29tcGFjdCBwcmVzZW50YXRpb24gd2hlbiBhIHdvcmtmbG93IExpc3QgdmlldyBpcyBzZWxlY3RlZC5cbiAqXG4gKiBUaGUgcHJlc2V0IGlzIGFwcGxpZWQgb25seSBpbiB0aGUgc2hvcnRjb2RlIGNvbmZpZ3VyYXRpb24gVUkgd2hlbiB0aGVcbiAqIGNhdGFsb2cgbGF5b3V0IGNvbnRyb2wgY2hhbmdlcyB0byBMaXN0LiBFYWNoIGFmZmVjdGVkIGNvbnRyb2wgcmVtYWluc1xuICogaW5kZXBlbmRlbnRseSBlZGl0YWJsZSBhZnRlciB0aGUgcHJlc2V0IGlzIGFwcGxpZWQsIGFuZCBzaG9ydGNvZGUgcGFyc2VyXG4gKiBkZWZhdWx0cyBhcmUgbm90IGNoYW5nZWQuXG4gKlxuICogQHBhcmFtIHtqUXVlcnl9ICRjaGFuZ2VkX2ZpZWxkIFdvcmtmbG93IGZpZWxkIHRoYXQgdHJpZ2dlcmVkIHRoZSBjaGFuZ2UuXG4gKiBAcmV0dXJucyB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19hcHBseV9yZXNvdXJjZV9saXN0X3ByZXNldCggJGNoYW5nZWRfZmllbGQgKSB7XG4gICAgdmFyIHBhcmFtZXRlcl9uYW1lID0gU3RyaW5nKCAkY2hhbmdlZF9maWVsZC5kYXRhKCAnd3BiYy1zaG9ydGNvZGUtcGFyYW1ldGVyJyApIHx8ICcnICk7XG4gICAgdmFyICRjb250YWluZXI7XG5cbiAgICBpZiAoICdjYXRhbG9nX2xheW91dCcgIT09IHBhcmFtZXRlcl9uYW1lIHx8ICdsaXN0JyAhPT0gU3RyaW5nKCAkY2hhbmdlZF9maWVsZC52YWwoKSB8fCAnJyApICkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG5cdCRjb250YWluZXIgPSAkY2hhbmdlZF9maWVsZC5jbG9zZXN0KCAnI3dwYmNfc2NfY29udGFpbmVyX19zaG9ydGNvZGVfYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvciwgI3dwYmNfc2NfY29udGFpbmVyX19zaG9ydGNvZGVfYm9va2luZ19hcHBvaW50bWVudCcgKTtcbiAgICBpZiAoICEgJGNvbnRhaW5lci5sZW5ndGggKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAkY29udGFpbmVyLmZpbmQoICdbZGF0YS13cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXI9XCJzaG93X3Jlc291cmNlX2Rlc2NyaXB0aW9uXCJdJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKTtcbiAgICAkY29udGFpbmVyLmZpbmQoICdbZGF0YS13cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXI9XCJjYXRhbG9nX2xpc3RfaXRlbXNfcGVyX3Jvd1wiXScgKS52YWwoICcyJyApO1xuICAgICRjb250YWluZXIuZmluZCggJ1tkYXRhLXdwYmMtc2hvcnRjb2RlLXBhcmFtZXRlcj1cInNob3dfcmVzb3VyY2VfaGllcmFyY2h5XCJdJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKTtcbiAgICAkY29udGFpbmVyLmZpbmQoICdbZGF0YS13cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXI9XCJzaG93X2F2YWlsYWJpbGl0eVwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XG59XG5cbi8qKlxuICogU2hvcnRjb2RlIENvbmZpZyAtIE1haW4gTG9vcFxuICovXG5mdW5jdGlvbiB3cGJjX3NldF9zaG9ydGNvZGUoKXtcblxuICAgIGlmICggMCA9PT0galF1ZXJ5KCAnI3dwYmNfc2hvcnRjb2RlX3R5cGUnICkubGVuZ3RoICkge1xuICAgICAgICBjb25zb2xlLmxvZyggJ1dQQkMgOjogRXJyb3IhIEVsZW1lbnQgI3dwYmNfc2hvcnRjb2RlX3R5cGUgbm90IGV4aXN0IScgKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB3cGJjX3Nob3J0Y29kZSA9ICdbJztcbiAgICB2YXIgc2hvcnRjb2RlX2lkID0galF1ZXJ5KCAnI3dwYmNfc2hvcnRjb2RlX3R5cGUnICkudmFsKCkudHJpbSgpO1xuXG4gICAgaWYgKCAnYm9va2luZ19hcHBvaW50bWVudCcgPT09IHNob3J0Y29kZV9pZCB8fCAnYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvcicgPT09IHNob3J0Y29kZV9pZCApIHtcbiAgICAgICAgalF1ZXJ5KCAnI3dwYmNfdGV4dF9wdXRfaW5fc2hvcnRjb2RlJyApLnZhbCggd3BiY19zaG9ydGNvZGVfY29uZmlnX19idWlsZF93b3JrZmxvd19zaG9ydGNvZGUoIHNob3J0Y29kZV9pZCApICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cblxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy8gW2Jvb2tpbmddICB8IFtib29raW5nY2FsZW5kYXJdIHwgLi4uXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgIGlmIChcbiAgICAgICAgICAgKCAnYm9va2luZycgPT09IHNob3J0Y29kZV9pZCApXG4gICAgICAgIHx8ICggJ2Jvb2tpbmdjYWxlbmRhcicgPT09IHNob3J0Y29kZV9pZCApXG4gICAgICAgIHx8ICggJ2Jvb2tpbmdzZWxlY3QnID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICB8fCAoICdib29raW5ndGltZWxpbmUnID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICB8fCAoICdib29raW5nZm9ybScgPT09IHNob3J0Y29kZV9pZCApXG4gICAgICAgIHx8ICggJ2Jvb2tpbmdzZWFyY2gnID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICB8fCAoICdib29raW5nb3RoZXInID09PSBzaG9ydGNvZGVfaWQgKVxuXG4gICAgICAgIHx8ICggJ2Jvb2tpbmdfaW1wb3J0X2ljcycgPT09IHNob3J0Y29kZV9pZCApXG4gICAgICAgIHx8ICggJ2Jvb2tpbmdfbGlzdGluZ19pY3MnID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICl7XG5cbiAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gc2hvcnRjb2RlX2lkO1xuXG4gICAgICAgIHZhciB3cGJjX29wdGlvbnNfYXJyID0gW107XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAvLyBbYm9va2luZ3NlbGVjdF0gfCBbYm9va2luZ3RpbWVsaW5lXSAtIE9wdGlvbnMgcmVsYXRpdmUgb25seSB0byB0aGlzIHNob3J0Y29kZS5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAoICdib29raW5nc2VsZWN0JyA9PT0gc2hvcnRjb2RlX2lkIClcbiAgICAgICAgICAgIHx8ICggJ2Jvb2tpbmd0aW1lbGluZScgPT09IHNob3J0Y29kZV9pZCApXG4gICAgICAgICl7XG5cbiAgICAgICAgICAgIC8vIFtib29raW5nc2VsZWN0IHR5cGU9JzEsMiwzJ10gLSBNdWx0aXBsZSBSZXNvdXJjZXNcbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzJyApLmxlbmd0aCA+IDAgKXtcblxuICAgICAgICAgICAgICAgIHZhciBtdWx0aXBsZV9yZXNvdXJjZXMgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXMnICkudmFsKCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIChtdWx0aXBsZV9yZXNvdXJjZXMgIT0gbnVsbCkgJiYgKG11bHRpcGxlX3Jlc291cmNlcy5sZW5ndGggPiAwKSApe1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBlbXB0eSBzcGFjZXMgZnJvbSAgYXJyYXkgOiAnJyB8IFwiXCIgfCAwXG4gICAgICAgICAgICAgICAgICAgIG11bHRpcGxlX3Jlc291cmNlcyA9IG11bHRpcGxlX3Jlc291cmNlcy5maWx0ZXIoZnVuY3Rpb24obil7cmV0dXJuIHBhcnNlSW50KG4pOyB9KTtcblxuICAgICAgICAgICAgICAgICAgICBtdWx0aXBsZV9yZXNvdXJjZXMgPSBtdWx0aXBsZV9yZXNvdXJjZXMuam9pbiggJywnICkudHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICggbXVsdGlwbGVfcmVzb3VyY2VzICE9IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgdHlwZT1cXCcnICsgbXVsdGlwbGVfcmVzb3VyY2VzICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFtib29raW5nc2VsZWN0IHNlbGVjdGVkX3R5cGU9MV0gLSBTZWxlY3RlZCBSZXNvdXJjZVxuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWxlY3RlZF9yZXNvdXJjZScgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlbGVjdGVkX3Jlc291cmNlJyApLnZhbCgpICE9PSBudWxsICkgICAgICAgICAgICAgICAgICAgICAgLy8gRml4SW46IDguMi4xLjEyLlxuICAgICAgICAgICAgICAgICAgICAmJiAoIHBhcnNlSW50KCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWxlY3RlZF9yZXNvdXJjZScgKS52YWwoKSApID4gMCApXG4gICAgICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBzZWxlY3RlZF90eXBlPScgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWxlY3RlZF9yZXNvdXJjZScgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBbYm9va2luZ3NlbGVjdCBsYWJlbD0nVGFkYSddIC0gTGFiZWxcbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfdGV4dF9sYWJlbCcgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgaWYgKCAnJyAhPT0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfdGV4dF9sYWJlbCcgKS52YWwoKS50cmltKCkgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBsYWJlbD1cXCcnICsgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfdGV4dF9sYWJlbCcgKS52YWwoKS50cmltKCkucmVwbGFjZSggLycvZ2ksICcnICkgKyAnXFwnJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFtib29raW5nc2VsZWN0IGZpcnN0X29wdGlvbl90aXRsZT0nVGFkYSddIC0gRmlyc3QgIE9wdGlvblxuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19maXJzdF9vcHRpb25fdGl0bGUnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgIGlmICggJycgIT09IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2ZpcnN0X29wdGlvbl90aXRsZScgKS52YWwoKS50cmltKCkgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBmaXJzdF9vcHRpb25fdGl0bGU9XFwnJyArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2ZpcnN0X29wdGlvbl90aXRsZScgKS52YWwoKS50cmltKCkucmVwbGFjZSggLycvZ2ksICcnICkgKyAnXFwnJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgLy8gW2Jvb2tpbmd0aW1lbGluZV0gLSBPcHRpb25zIHJlbGF0aXZlIG9ubHkgdG8gdGhpcyBzaG9ydGNvZGUuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgaWYgKCAnYm9va2luZ3RpbWVsaW5lJyA9PT0gc2hvcnRjb2RlX2lkICl7XG4gICAgICAgICAgICAvLyBWaXN1YWxseSB1cGRhdGVcbiAgICAgICAgICAgIHZhciB3cGJjX2lzX21hdHJpeF9fdmlld19kYXlzX251bV90ZW1wID0gd3BiY19zaG9ydGNvZGVfY29uZmlnX191cGRhdGVfZWxlbWVudHNfaW5fdGltZWxpbmUoKTtcbiAgICAgICAgICAgIHZhciB3cGJjX2lzX21hdHJpeCA9IHdwYmNfaXNfbWF0cml4X192aWV3X2RheXNfbnVtX3RlbXBbIDAgXTtcbiAgICAgICAgICAgIHZhciB2aWV3X2RheXNfbnVtX3RlbXAgPSB3cGJjX2lzX21hdHJpeF9fdmlld19kYXlzX251bV90ZW1wWyAxIF07XG5cbiAgICAgICAgICAgIC8vIDogdmlld19kYXlzX251bVxuICAgICAgICAgICAgaWYgKCB2aWV3X2RheXNfbnVtX3RlbXAgIT0gMzAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHZpZXdfZGF5c19udW09JyArIHZpZXdfZGF5c19udW1fdGVtcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIDogaGVhZGVyX3RpdGxlXG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3RleHRfbGFiZWxfdGltZWxpbmUnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgIHZhciBoZWFkZXJfdGl0bGVfdGVtcCA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3RleHRfbGFiZWxfdGltZWxpbmUnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIGhlYWRlcl90aXRsZV90ZW1wID0gaGVhZGVyX3RpdGxlX3RlbXAucmVwbGFjZSggLycvZ2ksICcnICk7XG4gICAgICAgICAgICAgICAgaWYgKCBoZWFkZXJfdGl0bGVfdGVtcCAhPSAnJyApe1xuICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIGhlYWRlcl90aXRsZT1cXCcnICsgaGVhZGVyX3RpdGxlX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyA6IHNjcm9sbF9tb250aFxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICggICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX21vbnRoJyApLmlzKCAnOnZpc2libGUnICkpXG4gICAgICAgICAgICAgICAgJiYgKCAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfbW9udGgnICkubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICAmJiAocGFyc2VJbnQoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfbW9udGgnICkudmFsKCkudHJpbSgpICkgIT09IDApXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2Nyb2xsX21vbnRoPScgKyBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2Nyb2xsX3RpbWVsaW5lX3Njcm9sbF9tb250aCcgKS52YWwoKS50cmltKCkgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIDogc2Nyb2xsX2RheVxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICggICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX2RheXMnICkuaXMoICc6dmlzaWJsZScgKSlcbiAgICAgICAgICAgICAgICAmJiAoICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2Nyb2xsX3RpbWVsaW5lX3Njcm9sbF9kYXlzJyApLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgJiYgKHBhcnNlSW50KCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX2RheXMnICkudmFsKCkudHJpbSgpICkgIT09IDApXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2Nyb2xsX2RheT0nICsgcGFyc2VJbnQoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfZGF5cycgKS52YWwoKS50cmltKCkgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gOmxpbWl0X2hvdXJzXG4gICAgICAgICAgICAvLyBGaXhJbjogNy4wLjEuMTcuXG4gICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ3RpbWVsaW5lX3ZpZXdfdGltZXMnICkuaGlkZSgpO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICggKCB3cGJjX2lzX21hdHJpeCApICYmICggdmlld19kYXlzX251bV90ZW1wID09IDEgKSApXG4gICAgICAgICAgICAgICAgfHwgKCAoICEgd3BiY19pc19tYXRyaXggKSAmJiAoIHZpZXdfZGF5c19udW1fdGVtcCA9PSAzMCApIClcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy5ib29raW5ndGltZWxpbmVfdmlld190aW1lcycgKS5zaG93KCk7XG4gICAgICAgICAgICAgICAgdmFyIHZpZXdfdGltZXNfc3RhcnRfdGVtcCA9IHBhcnNlSW50KCBqUXVlcnkoICcjYm9va2luZ3RpbWVsaW5lX3dwYmNfc3RhcnRfZW5kX3RpbWVfdGltZWxpbmVfc3RhcnR0aW1lJyApLnZhbCgpLnRyaW0oKSApO1xuICAgICAgICAgICAgICAgIHZhciB2aWV3X3RpbWVzX2VuZF90ZW1wID0gcGFyc2VJbnQoIGpRdWVyeSggJyNib29raW5ndGltZWxpbmVfd3BiY19zdGFydF9lbmRfdGltZV90aW1lbGluZV9lbmR0aW1lJyApLnZhbCgpLnRyaW0oKSApO1xuICAgICAgICAgICAgICAgIGlmICggKHZpZXdfdGltZXNfc3RhcnRfdGVtcCAhPSAwKSB8fCAodmlld190aW1lc19lbmRfdGVtcCAhPSAyNCkgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBsaW1pdF9ob3Vycz1cXCcnICsgdmlld190aW1lc19zdGFydF90ZW1wICsgJywnICsgdmlld190aW1lc19lbmRfdGVtcCArICdcXCcnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gOnNjcm9sbF9zdGFydF9kYXRlXG4gICAgICAgICAgICBpZiAoICAoIGpRdWVyeSgnI2Jvb2tpbmd0aW1lbGluZV93cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfYWN0aXZlJykuaXMoJzpjaGVja2VkJykgKSAgJiYgKCBqUXVlcnkoICcjYm9va2luZ3RpbWVsaW5lX3dwYmNfc3RhcnRfZGF0ZV90aW1lbGluZV9hY3RpdmUnICkubGVuZ3RoID4gMCApICApIHtcbiAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBzY3JvbGxfc3RhcnRfZGF0ZT1cXCcnICsgalF1ZXJ5KCAnI2Jvb2tpbmd0aW1lbGluZV93cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfeWVhcicgKS52YWwoKS50cmltKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKyAnLScgKyBqUXVlcnkoICcjYm9va2luZ3RpbWVsaW5lX3dwYmNfc3RhcnRfZGF0ZV90aW1lbGluZV9tb250aCcgKS52YWwoKS50cmltKClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKyAnLScgKyBqUXVlcnkoICcjYm9va2luZ3RpbWVsaW5lX3dwYmNfc3RhcnRfZGF0ZV90aW1lbGluZV9kYXknICkudmFsKCkudHJpbSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKyAnXFwnJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAvLyBbYm9va2luZ2Zvcm0gIF0gLSBGb3JtIE9ubHkgICAgICAgIC0gICAgIFtib29raW5nZm9ybSB0eXBlPTEgc2VsZWN0ZWRfZGF0ZXM9JzAxLjAzLjIwMjQnXVxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGlmICggJ2Jvb2tpbmdmb3JtJyA9PT0gc2hvcnRjb2RlX2lkICl7XG5cbiAgICAgICAgICAgIHZhciB3cGJjX3NlbGVjdGVkX2RheSA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV9kYXknICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCBwYXJzZUludCh3cGJjX3NlbGVjdGVkX2RheSkgPCAxMCApe1xuICAgICAgICAgICAgICAgIHdwYmNfc2VsZWN0ZWRfZGF5ID0gJzAnICsgd3BiY19zZWxlY3RlZF9kYXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgd3BiY19zZWxlY3RlZF9tb250aCA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV9tb250aCcgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICBpZiAoIHBhcnNlSW50KHdwYmNfc2VsZWN0ZWRfbW9udGgpIDwgMTAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3NlbGVjdGVkX21vbnRoID0gJzAnICsgd3BiY19zZWxlY3RlZF9tb250aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2VsZWN0ZWRfZGF0ZXM9XFwnJyArIHdwYmNfc2VsZWN0ZWRfZGF5ICsgJy4nICsgd3BiY19zZWxlY3RlZF9tb250aCArICcuJyArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV95ZWFyJyApLnZhbCgpLnRyaW0oKSArICdcXCcnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAvLyBbYm9va2luZ3NlYXJjaCAgXSAtIE9wdGlvbnMgcmVsYXRpdmUgb25seSB0byB0aGlzIHNob3J0Y29kZS4gICAgIFtib29raW5nc2VhcmNoIHNlYXJjaHJlc3VsdHN0aXRsZT0ne3NlYXJjaHJlc3VsdHN9IFJlc3VsdChzKSBGb3VuZCcgbm9yZXN1bHRzdGl0bGU9J05vdGhpbmcgRm91bmQnXVxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGlmICggJ2Jvb2tpbmdzZWFyY2gnID09PSBzaG9ydGNvZGVfaWQgKXtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgIGlmIHdlIHNlbGVjdGVkICdib29raW5nc2VhcmNoJyB8ICdib29raW5nc2VhcmNocmVzdWx0cydcbiAgICAgICAgICAgIHZhciB3cGJjX3NlYXJjaF9mb3JtX3Jlc3VsdHMgPSAnYm9va2luZ3NlYXJjaCc7XG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5nc2VhcmNoX3dwYmNfc2VhcmNoX2Zvcm1fcmVzdWx0cyddOmNoZWNrZWRcIiApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3NlYXJjaF9mb3JtX3Jlc3VsdHMgPSBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3NlYXJjaF93cGJjX3NlYXJjaF9mb3JtX3Jlc3VsdHMnXTpjaGVja2VkXCIgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNob3cgfCBIaWRlIGZvcm0gIGZpZWxkcyBmb3IgJ2Jvb2tpbmdzZWFyY2gnIGRlcGVuZHMgZnJvbSAgcmFkaW8gIGJ1dGlvbiAgc2VsZWN0aW9uXG4gICAgICAgICAgICBpZiAoICdib29raW5nc2VhcmNocmVzdWx0cycgPT09IHdwYmNfc2VhcmNoX2Zvcm1fcmVzdWx0cyApe1xuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlID0gJ1tib29raW5nc2VhcmNocmVzdWx0cyc7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLndwYmNfc2VhcmNoX2F2YWlsYWJpbGl0eV9mb3JtJyApLmhpZGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLndwYmNfc2VhcmNoX2F2YWlsYWJpbGl0eV9mb3JtJyApLnNob3coKTtcblxuXG4gICAgICAgICAgICAgICAgLy8gTmV3IHBhZ2UgZm9yIHNlYXJjaCByZXN1bHRzXG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAoalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX25ld19wYWdlX2VuYWJsZWQnICkubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICAgICAgJiYgKGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9uZXdfcGFnZV9lbmFibGVkJyApLmlzKCAnOmNoZWNrZWQnICkpXG4gICAgICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICAgICAgLy8gU2hvd1xuICAgICAgICAgICAgICAgICAgICBqUXVlcnkoICcuJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWFyY2hfbmV3X3BhZ2Vfd3BiY19zY19zZWFyY2hyZXN1bHRzX25ld19wYWdlJyApLnNob3coKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyA6IFNlYXJjaCBSZXN1bHRzIFVSTFxuICAgICAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9uZXdfcGFnZV91cmwnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHNlYXJjaF9yZXN1bHRzX3VybF90ZW1wID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX25ld19wYWdlX3VybCcgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWFyY2hfcmVzdWx0c191cmxfdGVtcCA9IHNlYXJjaF9yZXN1bHRzX3VybF90ZW1wLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBzZWFyY2hfcmVzdWx0c191cmxfdGVtcCAhPSAnJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2VhcmNocmVzdWx0cz1cXCcnICsgc2VhcmNoX3Jlc3VsdHNfdXJsX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEhpZGVcbiAgICAgICAgICAgICAgICAgICAgalF1ZXJ5KCAnLicgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX25ld19wYWdlX3dwYmNfc2Nfc2VhcmNocmVzdWx0c19uZXdfcGFnZScgKS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4vKiAgICAgICAgICAgICAgLy8gRml4SW46IDEwLjAuMC40MS5cbiAgICAgICAgICAgICAgICAvLyA6IFNlYXJjaCBIZWFkZXJcbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9oZWFkZXInICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB2YXIgc2VhcmNoX2hlYWRlcl90ZW1wID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX2hlYWRlcicgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIHNlYXJjaF9oZWFkZXJfdGVtcCA9IHNlYXJjaF9oZWFkZXJfdGVtcC5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBzZWFyY2hfaGVhZGVyX3RlbXAgIT0gJycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2VhcmNocmVzdWx0c3RpdGxlPVxcJycgKyBzZWFyY2hfaGVhZGVyX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyA6IE5vdGhpbmcgRm91bmRcbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9ub3RoaW5nX2ZvdW5kJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5vdGhpbmdmb3VuZF90ZW1wID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX25vdGhpbmdfZm91bmQnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBub3RoaW5nZm91bmRfdGVtcCA9IG5vdGhpbmdmb3VuZF90ZW1wLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIG5vdGhpbmdmb3VuZF90ZW1wICE9ICcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIG5vcmVzdWx0c3RpdGxlPVxcJycgKyBub3RoaW5nZm91bmRfdGVtcCArICdcXCcnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuKi9cbiAgICAgICAgICAgICAgICAvLyA6IFVzZXJzICAgICAgLy8gW2Jvb2tpbmdzZWFyY2ggc2VhcmNocmVzdWx0c3RpdGxlPSd7c2VhcmNocmVzdWx0c30gUmVzdWx0KHMpIEZvdW5kJyBub3Jlc3VsdHN0aXRsZT0nTm90aGluZyBGb3VuZCcgdXNlcnM9JzMsNDU0MywnXVxuICAgICAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX2Zvcl91c2VycycgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBvbmx5X2Zvcl91c2Vyc190ZW1wID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX2Zvcl91c2VycycgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIG9ubHlfZm9yX3VzZXJzX3RlbXAgPSBvbmx5X2Zvcl91c2Vyc190ZW1wLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIG9ubHlfZm9yX3VzZXJzX3RlbXAgIT0gJycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgdXNlcnM9XFwnJyArIG9ubHlfZm9yX3VzZXJzX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIC8vIFtib29raW5nZWRpdF0gLCBbYm9va2luZ2N1c3RvbWVybGlzdGluZ10gLCBbYm9va2luZ3Jlc291cmNlIHR5cGU9NiBzaG93PSdjYXBhY2l0eSddICwgW2Jvb2tpbmdfY29uZmlybV1cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBpZiAoICdib29raW5nb3RoZXInID09PSBzaG9ydGNvZGVfaWQgKXtcblxuICAgICAgICAgICAgLy9UUklDSzpcbiAgICAgICAgICAgIHNob3J0Y29kZV9pZCA9ICdubyc7ICAvL3JlcXVpcmVkIGZvciBub3QgdXBkYXRlIGJvb2tpbmcgcmVzb3VyY2UgSURcblxuICAgICAgICAgICAgLy8gQ2hlY2sgIGlmIHdlIHNlbGVjdGVkICdib29raW5nc2VhcmNoJyB8ICdib29raW5nc2VhcmNocmVzdWx0cydcbiAgICAgICAgICAgIHZhciBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgPSAnYm9va2luZ3NlYXJjaCc7XG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5nb3RoZXJfd3BiY19zaG9ydGNvZGVfdHlwZSddOmNoZWNrZWRcIiApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgPSBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ290aGVyX3dwYmNfc2hvcnRjb2RlX3R5cGUnXTpjaGVja2VkXCIgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNob3cgfCBIaWRlIHNlY3Rpb25zXG4gICAgICAgICAgICBpZiAoICdib29raW5nX2NvbmZpcm0nID09PSBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSA9ICdbYm9va2luZ19jb25maXJtJztcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ290aGVyX3NlY3Rpb25fYWRkaXRpb25hbCcgKS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdvdGhlcl9zZWN0aW9uXycgKyBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgKS5zaG93KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoICdib29raW5nZWRpdCcgPT09IGJvb2tpbmdvdGhlcl9zaG9ydGNvZGVfdHlwZSApe1xuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlID0gJ1tib29raW5nZWRpdCc7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdvdGhlcl9zZWN0aW9uX2FkZGl0aW9uYWwnICkuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy5ib29raW5nb3RoZXJfc2VjdGlvbl8nICsgYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlICkuc2hvdygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCAnYm9va2luZ2N1c3RvbWVybGlzdGluZycgPT09IGJvb2tpbmdvdGhlcl9zaG9ydGNvZGVfdHlwZSApe1xuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlID0gJ1tib29raW5nY3VzdG9tZXJsaXN0aW5nJztcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ290aGVyX3NlY3Rpb25fYWRkaXRpb25hbCcgKS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdvdGhlcl9zZWN0aW9uXycgKyBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgKS5zaG93KCk7XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggJ2Jvb2tpbmdyZXNvdXJjZScgPT09IGJvb2tpbmdvdGhlcl9zaG9ydGNvZGVfdHlwZSApe1xuXG4gICAgICAgICAgICAgICAgLy9UUklDSzpcbiAgICAgICAgICAgICAgICBzaG9ydGNvZGVfaWQgPSAnYm9va2luZ290aGVyJzsgIC8vcmVxdWlyZWQgdG8gZm9yY2UgdXBkYXRlIGJvb2tpbmcgcmVzb3VyY2UgSURcblxuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlID0gJ1tib29raW5ncmVzb3VyY2UnO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy5ib29raW5nb3RoZXJfc2VjdGlvbl9hZGRpdGlvbmFsJyApLmhpZGUoKTtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ290aGVyX3NlY3Rpb25fJyArIGJvb2tpbmdvdGhlcl9zaG9ydGNvZGVfdHlwZSApLnNob3coKTtcblxuICAgICAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnI2Jvb2tpbmdvdGhlcl93cGJjX3Jlc291cmNlX3Nob3cnICkudmFsKCkudHJpbSgpICE9ICd0aXRsZScgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBzaG93PVxcJycgKyBqUXVlcnkoICcjYm9va2luZ290aGVyX3dwYmNfcmVzb3VyY2Vfc2hvdycgKS52YWwoKS50cmltKCkgKyAnXFwnJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBbYm9va2luZy1tYW5hZ2VyLWltcG9ydCAuLi5dICAgICB8fCAgICAgIFtib29raW5nLW1hbmFnZXItbGlzdGluZyAuLi5dXG4gICAgICAgIGlmICggKCdib29raW5nX2ltcG9ydF9pY3MnID09PSBzaG9ydGNvZGVfaWQpIHx8ICgnYm9va2luZ19saXN0aW5nX2ljcycgPT09IHNob3J0Y29kZV9pZCkgKXtcblxuICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgPSAnW2Jvb2tpbmctbWFuYWdlci1pbXBvcnQnO1xuXG4gICAgICAgICAgICBpZiAoICdib29raW5nX2xpc3RpbmdfaWNzJyA9PT0gc2hvcnRjb2RlX2lkICl7XG4gICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgPSAnW2Jvb2tpbmctbWFuYWdlci1saXN0aW5nJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgLy8gOiAuaWNzIGZlZWQgVVJMXG4gICAgICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICB2YXIgc2hvcnRjb2RlX3VybF90ZW1wID0gJydcbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfdXJsJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICBzaG9ydGNvZGVfdXJsX3RlbXAgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY191cmwnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIHNob3J0Y29kZV91cmxfdGVtcCA9IHNob3J0Y29kZV91cmxfdGVtcC5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICBpZiAoIHNob3J0Y29kZV91cmxfdGVtcCAhPSAnJyApe1xuICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHVybD1cXCcnICsgc2hvcnRjb2RlX3VybF90ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgICAgIGlmICggc2hvcnRjb2RlX3VybF90ZW1wID09ICcnICl7XG4gICAgICAgICAgICAgICAgLy8gRXJyb3I6XG4gICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgPSAnWyBVUkwgaXMgcmVxdWlyZWQgJ1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFZBTElEOlxuXG4gICAgICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgICAgIC8vIFsuLi4gZnJvbT0nJyAnZnJvbV9vZmZzZXQ9JycgIC4uLl1cbiAgICAgICAgICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfZnJvbScgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwX2Zyb20gICAgICAgICAgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfZnJvbScgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwX2Zyb21fb2Zmc2V0ICAgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfZnJvbV9vZmZzZXQnICkudmFsKCkudHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHBfZnJvbSAgICAgICAgPSBwX2Zyb20ucmVwbGFjZSggLycvZ2ksICcnICk7XG4gICAgICAgICAgICAgICAgICAgIHBfZnJvbV9vZmZzZXQgPSBwX2Zyb21fb2Zmc2V0LnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICggKCcnICE9IHBfZnJvbSkgJiYgKCdkYXRlJyAhPSBwX2Zyb20pICl7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPZmZzZXRcblxuICAgICAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBmcm9tPVxcJycgKyBwX2Zyb20gKyAnXFwnJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAoJ2FueScgIT0gcF9mcm9tKSAmJiAoJycgIT0gcF9mcm9tX29mZnNldCkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwX2Zyb21fb2Zmc2V0ID0gcGFyc2VJbnQoIHBfZnJvbV9vZmZzZXQgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoICFpc05hTiggcF9mcm9tX29mZnNldCApICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgZnJvbV9vZmZzZXQ9XFwnJyArIHBfZnJvbV9vZmZzZXQgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfZnJvbV9vZmZzZXRfdHlwZScgKS52YWwoKS50cmltKCkuY2hhckF0KCAwICkgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggKHBfZnJvbSA9PSAnZGF0ZScpICYmIChwX2Zyb21fb2Zmc2V0ICE9ICcnKSApe1x0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBzZWxlY3RlZCBEYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIGZyb209XFwnJyArIHBfZnJvbV9vZmZzZXQgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgICAgICAvLyBbLi4uIHVudGlsPScnICd1bnRpbF9vZmZzZXQ9JycgIC4uLl1cbiAgICAgICAgICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfdW50aWwnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB2YXIgcF91bnRpbCAgICAgICAgICA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ191bnRpbCcgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwX3VudGlsX29mZnNldCAgID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3VudGlsX29mZnNldCcgKS52YWwoKS50cmltKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgcF91bnRpbCAgICAgICAgPSBwX3VudGlsLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgICAgICBwX3VudGlsX29mZnNldCA9IHBfdW50aWxfb2Zmc2V0LnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICggKCcnICE9IHBfdW50aWwpICYmICgnZGF0ZScgIT0gcF91bnRpbCkgKXsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE9mZnNldFxuXG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHVudGlsPVxcJycgKyBwX3VudGlsICsgJ1xcJyc7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggKCdhbnknICE9IHBfdW50aWwpICYmICgnJyAhPSBwX3VudGlsX29mZnNldCkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwX3VudGlsX29mZnNldCA9IHBhcnNlSW50KCBwX3VudGlsX29mZnNldCApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggIWlzTmFOKCBwX3VudGlsX29mZnNldCApICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgdW50aWxfb2Zmc2V0PVxcJycgKyBwX3VudGlsX29mZnNldCArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ191bnRpbF9vZmZzZXRfdHlwZScgKS52YWwoKS50cmltKCkuY2hhckF0KCAwICkgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggKHBfdW50aWwgPT0gJ2RhdGUnKSAmJiAocF91bnRpbF9vZmZzZXQgIT0gJycpICl7XHRcdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHNlbGVjdGVkIERhdGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgdW50aWw9XFwnJyArIHBfdW50aWxfb2Zmc2V0ICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cblx0XHRcdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdFx0XHQvLyBNYXhcblx0XHRcdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX2NvbmRpdGlvbnNfbWF4X251bScgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwX21heCA9IHBhcnNlSW50KCBqUXVlcnkoICAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX2NvbmRpdGlvbnNfbWF4X251bScgKS52YWwoKS50cmltKCkgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBwX21heCAhPSAwICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIG1heD0nICsgcF9tYXg7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cblx0XHRcdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdFx0XHQvLyBTaWxlbmNlXG5cdFx0XHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ19zaWxlbmNlJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCAnMScgPT09IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ19zaWxlbmNlJyApLnZhbCgpLnRyaW0oKSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBzaWxlbmNlPTEnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG5cdFx0XHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHRcdFx0Ly8gaXNfYWxsX2RhdGVzX2luXG5cdFx0XHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ19jb25kaXRpb25zX2V2ZW50cycgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwX2lzX2FsbF9kYXRlc19pbiA9IHBhcnNlSW50KCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfY29uZGl0aW9uc19ldmVudHMnICApLnZhbCgpLnRyaW0oKSApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHBfaXNfYWxsX2RhdGVzX2luICE9IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgaXNfYWxsX2RhdGVzX2luPScgKyBwX2lzX2FsbF9kYXRlc19pbjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuXHRcdFx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cdFx0XHRcdC8vIGltcG9ydF9jb25kaXRpb25zXG5cdFx0XHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ19jb25kaXRpb25zX2ltcG9ydCcgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBwX2ltcG9ydF9jb25kaXRpb25zID0galF1ZXJ5KCAgJyMnICsgc2hvcnRjb2RlX2lkICsgJ19jb25kaXRpb25zX2ltcG9ydCcgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgICAgIHBfaW1wb3J0X2NvbmRpdGlvbnMgPSBwX2ltcG9ydF9jb25kaXRpb25zLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHBfaW1wb3J0X2NvbmRpdGlvbnMgIT0gJycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgaW1wb3J0X2NvbmRpdGlvbnM9XFwnJyArIHBfaW1wb3J0X2NvbmRpdGlvbnMgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIC8vIFtib29raW5nXSAsIFtib29raW5nY2FsZW5kYXJdICwgLi4uICBwYXJhbWV0ZXJzIGZvciB0aGVzZSBzaG9ydGNvZGVzIGFuZCBvdGhlcnMuLi5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Jlc291cmNlX2lkJyApLmxlbmd0aCA+IDAgKSB7XG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Jlc291cmNlX2lkJyApLnZhbCgpID09PSBudWxsICkge1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOC4yLjEuMTIuXG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnI3dwYmNfdGV4dF9wdXRfaW5fc2hvcnRjb2RlJyApLnZhbCggJy0tLScgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgcmVzb3VyY2VfaWQ9JyArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Jlc291cmNlX2lkJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2N1c3RvbV9mb3JtJyApLmxlbmd0aCA+IDAgKSB7XG4gICAgICAgICAgICB2YXIgZm9ybV90eXBlX3RlbXAgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jdXN0b21fZm9ybScgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICBpZiAoIGZvcm1fdHlwZV90ZW1wICE9ICdzdGFuZGFyZCcgKVxuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgZm9ybV90eXBlPVxcJycgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jdXN0b21fZm9ybScgKS52YWwoKS50cmltKCkgKyAnXFwnJztcbiAgICAgICAgfVxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19udW1tb250aHMnICkubGVuZ3RoID4gMCApXG4gICAgICAgICAgICAgJiYgKCBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfbnVtbW9udGhzJyApLnZhbCgpLnRyaW0oKSApID4gMSApXG4gICAgICAgICl7XG4gICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIG51bW1vbnRocz0nICsgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfbnVtbW9udGhzJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAoICdib29raW5nJyA9PT0gc2hvcnRjb2RlX2lkIClcbiAgICAgICAgICAgICAmJiAoIGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfZW5hYmxlZCcgKS5sZW5ndGggPiAwIClcbiAgICAgICAgKXtcbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnI2Jvb2tpbmdfd3BiY19wb3B1cF9lbmFibGVkJyApLmlzKCAnOmNoZWNrZWQnICkgKXtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ193cGJjX3BvcHVwX3dwYmNfc2NfYm9va2luZ19wb3B1cCcgKS5zaG93KCk7XG5cbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHBvcHVwPTEnO1xuXG4gICAgICAgICAgICAgICAgdmFyIHBvcHVwX2J1dHRvbl90aXRsZV9kZWZhdWx0ID0galF1ZXJ5KCAnI2Jvb2tpbmdfd3BiY19wb3B1cF9idXR0b25fdGl0bGUnICkuYXR0ciggJ3BsYWNlaG9sZGVyJyApO1xuICAgICAgICAgICAgICAgIHZhciBwb3B1cF9idXR0b25fdGl0bGVfdGVtcCA9IGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfYnV0dG9uX3RpdGxlJyApLnZhbCgpLnRyaW0oKS5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICBpZiAoICggcG9wdXBfYnV0dG9uX3RpdGxlX3RlbXAgIT0gJycgKSAmJiAoIHBvcHVwX2J1dHRvbl90aXRsZV90ZW1wICE9IHBvcHVwX2J1dHRvbl90aXRsZV9kZWZhdWx0ICkgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBwb3B1cF9idXR0b25fdGl0bGU9XFwnJyArIHBvcHVwX2J1dHRvbl90aXRsZV90ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHBvcHVwX3RpdGxlX2RlZmF1bHQgPSBqUXVlcnkoICcjYm9va2luZ193cGJjX3BvcHVwX3RpdGxlJyApLmF0dHIoICdwbGFjZWhvbGRlcicgKTtcbiAgICAgICAgICAgICAgICB2YXIgcG9wdXBfdGl0bGVfdGVtcCA9IGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfdGl0bGUnICkudmFsKCkudHJpbSgpLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgIGlmICggKCBwb3B1cF90aXRsZV90ZW1wICE9ICcnICkgJiYgKCBwb3B1cF90aXRsZV90ZW1wICE9IHBvcHVwX3RpdGxlX2RlZmF1bHQgKSApe1xuICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHBvcHVwX3RpdGxlPVxcJycgKyBwb3B1cF90aXRsZV90ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHBvcHVwX2J1dHRvbl9jbGFzc190ZW1wID0galF1ZXJ5KCAnI2Jvb2tpbmdfd3BiY19wb3B1cF9idXR0b25fY2xhc3MnICkudmFsKCkudHJpbSgpLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgIGlmICggKCBwb3B1cF9idXR0b25fY2xhc3NfdGVtcCAhPSAnJyApICYmICggcG9wdXBfYnV0dG9uX2NsYXNzX3RlbXAgIT0gJ3dwLWVsZW1lbnQtYnV0dG9uJyApICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgcG9wdXBfYnV0dG9uX2NsYXNzPVxcJycgKyBwb3B1cF9idXR0b25fY2xhc3NfdGVtcCArICdcXCcnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBwb3B1cF9tb2RhbF9jbGFzc190ZW1wID0galF1ZXJ5KCAnI2Jvb2tpbmdfd3BiY19wb3B1cF9tb2RhbF9jbGFzcycgKS52YWwoKS50cmltKCkucmVwbGFjZSggLycvZ2ksICcnICk7XG4gICAgICAgICAgICAgICAgaWYgKCBwb3B1cF9tb2RhbF9jbGFzc190ZW1wICE9ICcnICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgcG9wdXBfbW9kYWxfY2xhc3M9XFwnJyArIHBvcHVwX21vZGFsX2NsYXNzX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgcG9wdXBfc2l6ZV90ZW1wID0galF1ZXJ5KCAnI2Jvb2tpbmdfd3BiY19wb3B1cF9zaXplJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBpZiAoIHBvcHVwX3NpemVfdGVtcCAhPSAnbGcnICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgcG9wdXBfc2l6ZT1cXCcnICsgcG9wdXBfc2l6ZV90ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ193cGJjX3BvcHVwX3dwYmNfc2NfYm9va2luZ19wb3B1cCcgKS5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3N0YXJ0bW9udGhfYWN0aXZlJykubGVuZ3RoID4gMCApXG4gICAgICAgICAgICAgJiYgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3N0YXJ0bW9udGhfYWN0aXZlJykuaXMoJzpjaGVja2VkJykgKVxuICAgICAgICApe1xuICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc3RhcnRtb250aD1cXCcnICsgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc3RhcnRtb250aF95ZWFyJyApLnZhbCgpLnRyaW0oKSArICctJyArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3N0YXJ0bW9udGhfbW9udGgnICkudmFsKCkudHJpbSgpICsgJ1xcJyc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX3N0YXJ0X2FjdGl2ZScpLmxlbmd0aCA+IDAgKVxuICAgICAgICAgICAgICYmICggalF1ZXJ5KCcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF9hY3RpdmUnKS5pcygnOmNoZWNrZWQnKSApXG4gICAgICAgICl7XG4gICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBjYWxlbmRhcl9kYXRlc19zdGFydD1cXCcnICtcblx0XHRcdFx0IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX3N0YXJ0X3llYXInICkudmFsKCkudHJpbSgpICsgJy0nICtcblx0XHRcdFx0IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX3N0YXJ0X21vbnRoJyApLnZhbCgpLnRyaW0oKSArICAnLScgK1xuXHRcdFx0XHQgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfc3RhcnRfZGF0ZScgKS52YWwoKS50cmltKCkgK1xuXHRcdFx0XHQgJ1xcJyc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX2VuZF9hY3RpdmUnKS5sZW5ndGggPiAwIClcbiAgICAgICAgICAgICAmJiAoIGpRdWVyeSgnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfZW5kX2FjdGl2ZScpLmlzKCc6Y2hlY2tlZCcpIClcbiAgICAgICAgKXtcbiAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIGNhbGVuZGFyX2RhdGVzX2VuZD1cXCcnICtcblx0XHRcdFx0IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX2VuZF95ZWFyJyApLnZhbCgpLnRyaW0oKSArICctJyArXG5cdFx0XHRcdCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfbW9udGgnICkudmFsKCkudHJpbSgpICsgICctJyArXG5cdFx0XHRcdCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfZGF0ZScgKS52YWwoKS50cmltKCkgK1xuXHRcdFx0XHQgJ1xcJyc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2FnZ3JlZ2F0ZScgKS5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgdmFyIHdwYmNfYWdncmVnYXRlX3RlbXAgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19hZ2dyZWdhdGUnICkudmFsKCk7XG5cbiAgICAgICAgICAgIGlmICggKCB3cGJjX2FnZ3JlZ2F0ZV90ZW1wICE9IG51bGwgKSAmJiAoIHdwYmNfYWdncmVnYXRlX3RlbXAubGVuZ3RoID4gMCApICApe1xuICAgICAgICAgICAgICAgIHdwYmNfYWdncmVnYXRlX3RlbXAgPSB3cGJjX2FnZ3JlZ2F0ZV90ZW1wLmpvaW4oJzsnKVxuXG4gICAgICAgICAgICAgICAgaWYgKCB3cGJjX2FnZ3JlZ2F0ZV90ZW1wICE9IDAgKXsgICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBhYm91dCAwPT4nTm9uZSdcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBhZ2dyZWdhdGU9XFwnJyArIHdwYmNfYWdncmVnYXRlX3RlbXAgKyAnXFwnJztcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSgnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfYWdncmVnYXRlX19ib29raW5nc19vbmx5JykuaXMoJzpjaGVja2VkJykgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfb3B0aW9uc19hcnIucHVzaCggJ3thZ2dyZWdhdGUgdHlwZT1ib29raW5nc19vbmx5fScgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgLy8gT3B0aW9uIFBhcmFtXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgLy8gT3B0aW9ucyA6IFNpemVcbiAgICAgICAgdmFyIHdwYmNfb3B0aW9uc19zaXplID0gJyc7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAoIGpRdWVyeSgnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2l6ZV9lbmFibGVkJykubGVuZ3RoID4gMCApXG4gICAgICAgICAgICAgJiYgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NpemVfZW5hYmxlZCcpLmlzKCc6Y2hlY2tlZCcpIClcbiAgICAgICAgKXtcblxuICAgICAgICAgICAgLy8gb3B0aW9ucz0ne2NhbGVuZGFyIG1vbnRoc19udW1faW5fcm93PTIgd2lkdGg9MTAwJSBjZWxsX2hlaWdodD00MHB4fSdcblxuICAgICAgICAgICAgd3BiY19vcHRpb25zX3NpemUgKz0gJ3tjYWxlbmRhcicgO1xuICAgICAgICAgICAgd3BiY19vcHRpb25zX3NpemUgKz0gJyAnICsgJ21vbnRoc19udW1faW5fcm93PSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgTWF0aC5taW4oXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2l6ZV9tb250aHNfbnVtX2luX3JvdycgKS52YWwoKS50cmltKCkgKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlSW50KCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19udW1tb250aHMnICkudmFsKCkudHJpbSgpIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgd3BiY19vcHRpb25zX3NpemUgKz0gJyAnICsgJ3dpZHRoPScgKyBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2l6ZV9jYWxlbmRhcl93aWR0aCcgKS52YWwoKS50cmltKCkgKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2l6ZV9jYWxlbmRhcl93aWR0aF9weF9wcicgKS52YWwoKS50cmltKCkgO1xuICAgICAgICAgICAgd3BiY19vcHRpb25zX3NpemUgKz0gJyAnICsgJ2NlbGxfaGVpZ2h0PScgKyBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2l6ZV9jYWxlbmRhcl9jZWxsX2hlaWdodCcgKS52YWwoKS50cmltKCkgKSArICdweCc7XG4gICAgICAgICAgICB3cGJjX29wdGlvbnNfc2l6ZSArPSAnfSc7XG4gICAgICAgICAgICB3cGJjX29wdGlvbnNfYXJyLnB1c2goIHdwYmNfb3B0aW9uc19zaXplICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPcHRpb25zOiBEYXlzIG51bWJlciBkZXBlbmQgb24gICBXZWVrZGF5XG4gICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnd3BiY19zZWxlY3RfZGF5X3dlZWtkYXlfdGV4dGFyZWEnICkubGVuZ3RoID4gMCApIHtcbiAgICAgICAgICAgIHdwYmNfb3B0aW9uc19zaXplID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnd3BiY19zZWxlY3RfZGF5X3dlZWtkYXlfdGV4dGFyZWEnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCB3cGJjX29wdGlvbnNfc2l6ZS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgd3BiY19vcHRpb25zX2Fyci5wdXNoKCB3cGJjX29wdGlvbnNfc2l6ZSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3B0aW9uczogRGF5cyBudW1iZXIgZGVwZW5kIG9uICAgU0VBU09OXG4gICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnd3BiY19zZWxlY3RfZGF5X3NlYXNvbl90ZXh0YXJlYScgKS5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgd3BiY19vcHRpb25zX3NpemUgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICd3cGJjX3NlbGVjdF9kYXlfc2Vhc29uX3RleHRhcmVhJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICggd3BiY19vcHRpb25zX3NpemUubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgIHdwYmNfb3B0aW9uc19hcnIucHVzaCggd3BiY19vcHRpb25zX3NpemUgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE9wdGlvbnM6IFN0YXJ0IHdlZWtkYXkgZGVwZW5kIG9uICAgU0VBU09OXG4gICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnd3BiY19zdGFydF9kYXlfc2Vhc29uX3RleHRhcmVhJyApLmxlbmd0aCA+IDAgKSB7XG4gICAgICAgICAgICB3cGJjX29wdGlvbnNfc2l6ZSA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ3dwYmNfc3RhcnRfZGF5X3NlYXNvbl90ZXh0YXJlYScgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICBpZiAoIHdwYmNfb3B0aW9uc19zaXplLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX29wdGlvbnNfYXJyLnB1c2goIHdwYmNfb3B0aW9uc19zaXplICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPcHRpb246IERheXMgbnVtYmVyIGRlcGVuZCBvbiBmcm9tICBEQVRFXG4gICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnd3BiY19zZWxlY3RfZGF5X2ZvcmRhdGVfdGV4dGFyZWEnICkubGVuZ3RoID4gMCApIHtcbiAgICAgICAgICAgIHdwYmNfb3B0aW9uc19zaXplID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnd3BiY19zZWxlY3RfZGF5X2ZvcmRhdGVfdGV4dGFyZWEnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCB3cGJjX29wdGlvbnNfc2l6ZS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgd3BiY19vcHRpb25zX2Fyci5wdXNoKCB3cGJjX29wdGlvbnNfc2l6ZSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCB3cGJjX29wdGlvbnNfYXJyLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgb3B0aW9ucz1cXCcnICsgd3BiY19vcHRpb25zX2Fyci5qb2luKCAnLCcgKSArICdcXCcnO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICB3cGJjX3Nob3J0Y29kZSArPSAnXSc7XG5cbiAgICBqUXVlcnkoICcjd3BiY190ZXh0X3B1dF9pbl9zaG9ydGNvZGUnICkudmFsKCB3cGJjX3Nob3J0Y29kZSApO1xufVxuXG4gICAgLyoqXG4gICAgICogT3BlbiBUaW55TUNFIE1vZGFsICovXG4gICAgZnVuY3Rpb24gd3BiY190aW55X2J0bl9jbGljayggdGFnICkge1xuICAgICAgICAvLyBGaXhJbjogOS4wLjEuNS5cbiAgICAgICAgalF1ZXJ5KCcjd3BiY190aW55X21vZGFsJykud3BiY19teV9tb2RhbCh7XG4gICAgICAgICAgICBrZXlib2FyZDogZmFsc2VcbiAgICAgICAgICAsIGJhY2tkcm9wOiB0cnVlXG4gICAgICAgICAgLCBzaG93OiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICAvLyBGaXhJbjogOC4zLjMuOTkuXG4gICAgICAgIGpRdWVyeSggXCIjd3BiY190ZXh0X2dldHRlbmJlcmdfc2VjdGlvbl9pZFwiICkudmFsKCAnJyApO1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogT3BlbiBUaW55TUNFIE1vZGFsICovXG4gICAgZnVuY3Rpb24gd3BiY190aW55X2Nsb3NlKCkge1xuXG4gICAgICAgIGpRdWVyeSgnI3dwYmNfdGlueV9tb2RhbCcpLndwYmNfbXlfbW9kYWwoJ2hpZGUnKTtcdC8vIEZpeEluOiA5LjAuMS41LlxuICAgIH1cblxuICAgIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuICAgIC8qKiBTZW5kIFRleHQgKi9cbiAgICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbiAgICAvKipcbiAgICAgKiBTZW5kIHRleHQgIHRvIGVkaXRvciAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfc2VuZF90ZXh0X3RvX2VkaXRvciggaCApIHtcblxuICAgICAgICAvLyBGaXhJbjogOC4zLjMuOTlcbiAgICAgICAgaWYgKCB0eXBlb2YoIHdwYmNfc2VuZF90ZXh0X3RvX2d1dGVuYmVyZyApID09ICdmdW5jdGlvbicgKXtcbiAgICAgICAgICAgIHZhciBpc19zZW5kID0gd3BiY19zZW5kX3RleHRfdG9fZ3V0ZW5iZXJnKCBoICk7XG4gICAgICAgICAgICBpZiAoIHRydWUgPT09IGlzX3NlbmQgKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGVkLCBtY2UgPSB0eXBlb2YodGlueW1jZSkgIT0gJ3VuZGVmaW5lZCcsIHF0ID0gdHlwZW9mKFFUYWdzKSAhPSAndW5kZWZpbmVkJztcblxuICAgICAgICAgICAgaWYgKCAhIHdpbmRvdy53cEFjdGl2ZUVkaXRvciApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBtY2UgJiYgdGlueW1jZS5hY3RpdmVFZGl0b3IgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWQgPSB0aW55bWNlLmFjdGl2ZUVkaXRvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cud3BBY3RpdmVFZGl0b3IgPSBlZC5pZDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggIXF0ICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICggbWNlICkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHRpbnltY2UuYWN0aXZlRWRpdG9yICYmICh0aW55bWNlLmFjdGl2ZUVkaXRvci5pZCA9PSAnbWNlX2Z1bGxzY3JlZW4nIHx8IHRpbnltY2UuYWN0aXZlRWRpdG9yLmlkID09ICd3cF9tY2VfZnVsbHNjcmVlbicpIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlZCA9IHRpbnltY2UuYWN0aXZlRWRpdG9yO1xuICAgICAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWQgPSB0aW55bWNlLmdldCh3cEFjdGl2ZUVkaXRvcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICggZWQgJiYgIWVkLmlzSGlkZGVuKCkgKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlc3RvcmUgY2FyZXQgcG9zaXRpb24gb24gSUVcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aW55bWNlLmlzSUUgJiYgZWQud2luZG93TWFuYWdlci5pbnNlcnRpbWFnZWJvb2ttYXJrIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlZC5zZWxlY3Rpb24ubW92ZVRvQm9va21hcmsoZWQud2luZG93TWFuYWdlci5pbnNlcnRpbWFnZWJvb2ttYXJrKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIGguaW5kZXhPZignW2NhcHRpb24nKSAhPT0gLTEgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBlZC53cFNldEltZ0NhcHRpb24gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaCA9IGVkLndwU2V0SW1nQ2FwdGlvbihoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggaC5pbmRleE9mKCdbZ2FsbGVyeScpICE9PSAtMSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGVkLnBsdWdpbnMud3BnYWxsZXJ5IClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGggPSBlZC5wbHVnaW5zLndwZ2FsbGVyeS5fZG9fZ2FsbGVyeShoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICggaC5pbmRleE9mKCdbZW1iZWQnKSA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGVkLnBsdWdpbnMud29yZHByZXNzIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGggPSBlZC5wbHVnaW5zLndvcmRwcmVzcy5fc2V0RW1iZWQoaCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBlZC5leGVjQ29tbWFuZCgnbWNlSW5zZXJ0Q29udGVudCcsIGZhbHNlLCBoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIHF0ICkge1xuICAgICAgICAgICAgICAgICAgICBRVGFncy5pbnNlcnRDb250ZW50KGgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQod3BBY3RpdmVFZGl0b3IpLnZhbHVlICs9IGg7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeXt0Yl9yZW1vdmUoKTt9Y2F0Y2goZSl7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSRVNPVVJDRVMgUEFHRTogT3BlbiBUaW55TUNFIE1vZGFsICovXG4gICAgZnVuY3Rpb24gd3BiY19yZXNvdXJjZV9wYWdlX2J0bl9jbGljayggcmVzb3VyY2VfaWQgLCBzaG9ydGNvZGVfZGVmYXVsdF92YWx1ZSA9ICcnKSB7XG5cbiAgICAgICAgLy8gRml4SW46IDkuMC4xLjUuXG4gICAgICAgIGpRdWVyeSgnI3dwYmNfdGlueV9tb2RhbCcpLndwYmNfbXlfbW9kYWwoe1xuICAgICAgICAgICAga2V5Ym9hcmQ6IGZhbHNlXG4gICAgICAgICAgLCBiYWNrZHJvcDogdHJ1ZVxuICAgICAgICAgICwgc2hvdzogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBEaXNhYmxlIHNvbWUgb3B0aW9ucyAtIHNlbGVjdGlvbiBvZiBib29raW5nIHJlc291cmNlIC0gYmVjYXVzZSB3ZSBjb25maWd1cmUgaXQgb25seSBmb3Igc3BlY2lmaWMgYm9va2luZyByZXNvdXJjZSwgd2hlcmUgd2UgY2xpY2tlZC5cbiAgICAgICAgdmFyIHNob3J0Y29kZV9hcnIgPSBbJ2Jvb2tpbmcnLCAnYm9va2luZ2NhbGVuZGFyJywgJ2Jvb2tpbmdmb3JtJ107XG5cbiAgICAgICAgZm9yICggdmFyIHNob3J0Y2RlX2tleSBpbiBzaG9ydGNvZGVfYXJyICl7XG5cbiAgICAgICAgICAgIHZhciBzaG9ydGNvZGVfaWQgPSBzaG9ydGNvZGVfYXJyWyBzaG9ydGNkZV9rZXkgXTtcblxuICAgICAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfcmVzb3VyY2VfaWQnICkucHJvcCggXHRcdCAnZGlzYWJsZWQnLCBmYWxzZSApO1xuICAgICAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyBcIl93cGJjX3Jlc291cmNlX2lkIG9wdGlvblt2YWx1ZT0nXCIgKyByZXNvdXJjZV9pZCArIFwiJ11cIiApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfcmVzb3VyY2VfaWQnICkucHJvcCggXHRcdCAnZGlzYWJsZWQnLCB0cnVlICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIaWRlIGxlZnQgIG5hdmlnYXRpb24gIGl0ZW1zXG4vLyAgICAgICAgalF1ZXJ5KCBcIi53cGJjX3Nob3J0Y29kZV9jb25maWdfbmF2aWdhdGlvbl9jb2x1bW4gLndwYmNfc2V0dGluZ3NfbmF2aWdhdGlvbl9pdGVtXCIgKS5oaWRlKCk7XG4gICAgICAgIGpRdWVyeSggXCIjd3BiY19zaG9ydGNvZGVfY29uZmlnX19uYXZfdGFiX19ib29raW5nXCIgKS5zaG93KCk7XG4gICAgICAgIGpRdWVyeSggXCIjd3BiY19zaG9ydGNvZGVfY29uZmlnX19uYXZfdGFiX19ib29raW5nY2FsZW5kYXJcIiApLnNob3coKTtcblxuICAgICAgICAvLyBIaWRlIHwgU2hvdyBJbnNlcnQgIGJ1dHRvbiAgZm9yIGJvb2tpbmcgcmVzb3VyY2UgcGFnZVxuICAgICAgICBqUXVlcnkoIFwiLndwYmNfdGlueV9idXR0b25fX2luc2VydF90b19lZGl0b3JcIiApLmhpZGUoKTtcbiAgICAgICAgalF1ZXJ5KCBcIi53cGJjX3RpbnlfYnV0dG9uX19pbnNlcnRfdG9fcmVzb3VyY2VcIiApLnNob3coKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgU2hvcnRjb2RlIFZhbHVlIGZyb20gIHNob3J0Y29kZSB0ZXh0IGZpZWxkIGluIFBvcFVwIHNob3J0Y29kZSBDb25maWcgZGlhbG9nIGFuZCBpbnNlcnQgIGludG8gRElWIGFuZCBJTlBVVCBURVhUIGZpZWxkIG5lYXIgc3BlY2lmaWMgYm9va2luZyByZXNvdXJjZS5cbiAgICAgKiAgQnV0IGl0IHRha2VzIElEICBvZiBib29raW5nIHJlc291cmNlLCAgd2hlcmUgdG8gIGluc2VydCAgdGhpcyBzaG9ydGNvZGUgb25seSBmcm9tICAnYm9va2luZycgc2VjdGlvbiAgb2YgQ29uZmlnIERpYWxvZy4gdXN1YWxseSAgc3VjaCAgYm9va2luZyByZXNvdXJjZSAgZGlzYWJsZWQgdGhlcmUhXG4gICAgICogIGUuZy46IGpRdWVyeSggXCIjYm9va2luZ193cGJjX3Jlc291cmNlX2lkXCIgKS52YWwoKVxuICAgICAqXG4gICAgICogQHBhcmFtIHNob3J0Y29kZV92YWxcbiAgICAgKi9cbiAgICBmdW5jdGlvbiB3cGJjX3NlbmRfdGV4dF90b19yZXNvdXJjZSggc2hvcnRjb2RlX3ZhbCApe1xuICAgICAgICAvLyBGaXhJbjogMTAuMy4wLjguXG4gICAgICAgIHZhciByZXNvdXJjZV9pZCA9IDE7XG4gICAgICAgIGlmICggalF1ZXJ5KCBcIiNib29raW5nX3dwYmNfcmVzb3VyY2VfaWRcIiApLmxlbmd0aCApe1xuICAgICAgICAgICAgcmVzb3VyY2VfaWQgPSBqUXVlcnkoIFwiI2Jvb2tpbmdfd3BiY19yZXNvdXJjZV9pZFwiICkudmFsKCk7XG4gICAgICAgIH1cbiAgICAgICAgalF1ZXJ5KCAnI2Rpdl9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV8nICsgcmVzb3VyY2VfaWQgKS5odG1sKCBzaG9ydGNvZGVfdmFsICk7XG4gICAgICAgICAgICBqUXVlcnkoICcjYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfJyArIHJlc291cmNlX2lkICkudmFsKCBzaG9ydGNvZGVfdmFsICk7XG4gICAgICAgICAgICBqUXVlcnkoICcjYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfJyArIHJlc291cmNlX2lkICkudHJpZ2dlcignY2hhbmdlJyk7XG5cblx0XHQvKipcblx0XHQgKiBGaXJlcyBhZnRlciB0aGUgUmVzb3VyY2Ugc2hvcnRjb2RlIGN1c3RvbWl6ZXIgcmV0dXJucyBhIHNob3J0Y29kZS5cblx0XHQgKlxuXHRcdCAqIEFKQVggaW5zcGVjdG9ycyBjb25zdW1lIHRoaXMgZXZlbnQgd2l0aG91dCBkdXBsaWNhdGluZyB0aGUgbGVnYWN5XG5cdFx0ICogYGJvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlX3tJRH1gIERPTSBjb250cmFjdC5cblx0XHQgKlxuXHRcdCAqIEBldmVudCB3cGJjOnJlc291cmNlLXNob3J0Y29kZS1zZWxlY3RlZFxuXHRcdCAqIEB0eXBlIHt7cmVzb3VyY2VfaWQ6IG51bWJlcnxzdHJpbmcsIHNob3J0Y29kZTogc3RyaW5nfX1cblx0XHQgKi9cblx0XHRqUXVlcnkoIGRvY3VtZW50ICkudHJpZ2dlciggJ3dwYmM6cmVzb3VyY2Utc2hvcnRjb2RlLXNlbGVjdGVkJywgWyB7XG5cdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXG5cdFx0XHRzaG9ydGNvZGU6IHNob3J0Y29kZV92YWxcblx0XHR9IF0gKTtcblxuICAgICAgICAvLyBTY3JvbGxcbiAgICAgICAgaWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfc2Nyb2xsX3RvKSApe1xuICAgICAgICAgICAgd3BiY19zY3JvbGxfdG8oICcjZGl2X2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlXycgKyBqUXVlcnkoIFwiI2Jvb2tpbmdfd3BiY19yZXNvdXJjZV9pZFwiICkudmFsKCkgKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qIFIgRSBTIEUgVCAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fcmVzZXQoc2hvcnRjb2RlX3ZhbCl7XG4gICAgICAgIGlmICggJ2Jvb2tpbmdfYXBwb2ludG1lbnQnID09PSBzaG9ydGNvZGVfdmFsIHx8ICdib29raW5nX3Jlc291cmNlX3NlbGVjdG9yJyA9PT0gc2hvcnRjb2RlX3ZhbCApIHtcbiAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fcmVzZXRfd29ya2Zsb3coIHNob3J0Y29kZV92YWwgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zdGFydG1vbnRoX2FjdGl2ZScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF9hY3RpdmUnICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfZW5kX2FjdGl2ZScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICkudHJpZ2dlcignY2hhbmdlJyk7XG5cbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX2FnZ3JlZ2F0ZSBvcHRpb246c2VsZWN0ZWQnKS5wcm9wKCAnc2VsZWN0ZWQnLCBmYWxzZSk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19hZ2dyZWdhdGUgb3B0aW9uOmVxKDApJyAgICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfYWdncmVnYXRlX19ib29raW5nc19vbmx5JyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfY3VzdG9tX2Zvcm0gb3B0aW9uOmVxKDApJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX251bW1vbnRocyBvcHRpb246ZXEoMCknICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2l6ZV9lbmFibGVkJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfZW5hYmxlZCcgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19wb3B1cF9idXR0b25fdGl0bGUnICkudmFsKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfYnV0dG9uX3RpdGxlJyApLmF0dHIoICdwbGFjZWhvbGRlcicgKSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfdGl0bGUnICkudmFsKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfdGl0bGUnICkuYXR0ciggJ3BsYWNlaG9sZGVyJyApICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19wb3B1cF9idXR0b25fY2xhc3MnICkudmFsKCAnd3AtZWxlbWVudC1idXR0b24nICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19wb3B1cF9tb2RhbF9jbGFzcycgKS52YWwoICcnICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19wb3B1cF9zaXplIG9wdGlvblt2YWx1ZT1cImxnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuICAgICAgICB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfd2Vla2RheV9fcmVzZXQoIHNob3J0Y29kZV92YWwgKyAnd3BiY19zZWxlY3RfZGF5X3dlZWtkYXknICk7XG4gICAgICAgIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV9zZWFzb25fX3Jlc2V0KCBzaG9ydGNvZGVfdmFsICsgJ3dwYmNfc2VsZWN0X2RheV9zZWFzb24nICk7XG4gICAgICAgIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc3RhcnRfZGF5X3NlYXNvbl9fcmVzZXQoIHNob3J0Y29kZV92YWwgKyAnd3BiY19zdGFydF9kYXlfc2Vhc29uJyApO1xuICAgICAgICB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfZm9yZGF0ZV9fcmVzZXQoIHNob3J0Y29kZV92YWwgKyAnd3BiY19zZWxlY3RfZGF5X2ZvcmRhdGUnICk7XG5cbiAgICAgICAgLy8gUmVzZXQgIGZvciBbYm9va2luZ3NlbGVjdF0gc2hvcnRjb2RlIHBhcmFtc1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzIG9wdGlvbjpzZWxlY3RlZCcpLnByb3AoICdzZWxlY3RlZCcsIGZhbHNlKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX211bHRpcGxlX3Jlc291cmNlcyBvcHRpb246ZXEoMCknICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2VsZWN0ZWRfcmVzb3VyY2Ugb3B0aW9uOmVxKDApJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3RleHRfbGFiZWwnICkudmFsKCAnJyApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfZmlyc3Rfb3B0aW9uX3RpdGxlJyApLnZhbCggJycgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuICAgICAgICAvLyBSZXNldCAgZm9yIFtib29raW5ndGltZWxpbmVdIHNob3J0Y29kZSBwYXJhbXNcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3RleHRfbGFiZWxfdGltZWxpbmUnICkudmFsKCAnJyApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2Nyb2xsX3RpbWVsaW5lX3Njcm9sbF9tb250aCBvcHRpb25bdmFsdWU9XCIwXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfZGF5cyBvcHRpb25bdmFsdWU9XCIwXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfYWN0aXZlJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3N0YXJ0X2VuZF90aW1lX3RpbWVsaW5lX3N0YXJ0dGltZSBvcHRpb25bdmFsdWU9XCIwXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3N0YXJ0X2VuZF90aW1lX3RpbWVsaW5lX2VuZHRpbWUgb3B0aW9uW3ZhbHVlPVwiMjRcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICdpbnB1dFtuYW1lPVwiJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93XCJdW3ZhbHVlPVwiMzBcIl0nICkucHJvcCggJ2NoZWNrZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX3llYXIgb3B0aW9uW3ZhbHVlPVwiJyArIChuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkpICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfbW9udGggb3B0aW9uW3ZhbHVlPVwiJyArICgobmV3IERhdGUoKS5nZXRNb250aCgpKSArIDEpICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX2RheSBvcHRpb25bdmFsdWU9XCInICsgKG5ldyBEYXRlKCkuZ2V0RGF0ZSgpKSArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuXG4gICAgICAgIC8vIFJlc2V0ICBmb3IgW2Jvb2tpbmdmb3JtXSBzaG9ydGNvZGUgcGFyYW1zXG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19ib29raW5nX2RhdGVfeWVhciBvcHRpb25bdmFsdWU9XCInICsgKG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKSkgKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfYm9va2luZ19kYXRlX21vbnRoIG9wdGlvblt2YWx1ZT1cIicgKyAoKG5ldyBEYXRlKCkuZ2V0TW9udGgoKSkgKyAxKSArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfYm9va2luZ19kYXRlX2RheSBvcHRpb25bdmFsdWU9XCInICsgKG5ldyBEYXRlKCkuZ2V0RGF0ZSgpKSArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuXG4gICAgICAgIC8vIFJlc2V0ICBmb3IgW1tib29raW5nc2VhcmNoIC4uLl0gc2hvcnRjb2RlIHBhcmFtc1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2VhcmNoX25ld19wYWdlX3VybCcgKS52YWwoICcnICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zZWFyY2hfbmV3X3BhZ2VfZW5hYmxlZCcgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIC8vIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zZWFyY2hfaGVhZGVyJyApLnZhbCggJycgKS50cmlnZ2VyKCdjaGFuZ2UnKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGaXhJbjogMTAuMC4wLjQxLlxuICAgICAgICAvLyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2VhcmNoX25vdGhpbmdfZm91bmQnICkudmFsKCAnJyApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2VhcmNoX2Zvcl91c2VycycgKS52YWwoICcnICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJ2lucHV0W25hbWU9XCInICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zZWFyY2hfZm9ybV9yZXN1bHRzXCJdW3ZhbHVlPVwiYm9va2luZ3NlYXJjaFwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuICAgICAgICAvLyBSZXNldCAgZm9yIFtib29raW5nZWRpdF0gLCBbYm9va2luZ2N1c3RvbWVybGlzdGluZ10gLCBbYm9va2luZ3Jlc291cmNlIHR5cGU9NiBzaG93PSdjYXBhY2l0eSddICwgW2Jvb2tpbmdfY29uZmlybV1cbiAgICAgICAgalF1ZXJ5KCAnaW5wdXRbbmFtZT1cIicgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3Nob3J0Y29kZV90eXBlXCJdW3ZhbHVlPVwiYm9va2luZ19jb25maXJtXCJdJyApLnByb3AoICdjaGVja2VkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuXG5cbiAgICAgICAgLy8gYm9va2luZ19pbXBvcnRfaWNzICwgYm9va2luZ19saXN0aW5nX2ljc1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfdXJsJyApLnZhbCggJycgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX2Zyb20gb3B0aW9uW3ZhbHVlPVwidG9kYXlcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfZnJvbV9vZmZzZXQnICkudmFsKCAnJyApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfZnJvbV9vZmZzZXRfdHlwZSBvcHRpb246ZXEoMCknICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfdW50aWwgb3B0aW9uW3ZhbHVlPVwiYW55XCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3VudGlsX29mZnNldCcgKS52YWwoICcnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ191bnRpbF9vZmZzZXRfdHlwZSBvcHRpb246ZXEoMCknICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfY29uZGl0aW9uc19pbXBvcnQgb3B0aW9uOmVxKDApJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX2NvbmRpdGlvbnNfZXZlbnRzIG9wdGlvblt2YWx1ZT1cIjFcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfY29uZGl0aW9uc19tYXhfbnVtIG9wdGlvblt2YWx1ZT1cIjBcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfc2lsZW5jZSBvcHRpb25bdmFsdWU9XCIwXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgIH1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG4vKipcbiAqICBTSE9SVENPREVfQ09ORklHXG4gKiAqL1xuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cbi8qKlxuICogU2hvdyB0aGUgc2VsZWN0ZWQgc2hvcnRjb2RlIGNvbmZpZ3VyYXRpb24gZnJvbSB0aGUgcG9wdXAgbmF2aWdhdGlvbi5cbiAqXG4gKiBFdmVyeSBzaG9ydGNvZGUgdXNlcyB0aGUgc2FtZSBjb25zdHJhaW5lZCBjb250ZW50IGxheW91dCBzbyBpdHMgdGFiIGJhcixcbiAqIGdlbmVyYXRlZCBzaG9ydGNvZGUsIGFuZCBwb3B1cCBhY3Rpb25zIHJlbWFpbiBmaXhlZCB3aGlsZSBvbmx5IHRoZSBzZWxlY3RlZFxuICogY29uZmlndXJhdGlvbiBzZWN0aW9uIHNjcm9sbHMuXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gX3RoaXMgICAgICAgICAgICAgIENsaWNrZWQgbmF2aWdhdGlvbiBsaW5rLlxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgc2VjdGlvbl9pZF90b19zaG93IFNlbGVjdG9yIGZvciB0aGUgc2hvcnRjb2RlIGNvbnRhaW5lci5cbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIHNob3J0Y29kZV9uYW1lICAgICBTaG9ydGNvZGUgbmFtZSB3aXRob3V0IGJyYWNrZXRzLlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xuZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX2NsaWNrX3Nob3dfc2VjdGlvbiggX3RoaXMsIHNlY3Rpb25faWRfdG9fc2hvdywgc2hvcnRjb2RlX25hbWUgKXtcblxuICAgIHZhciBzaG9ydGNvZGVfY29udGFpbmVyID0galF1ZXJ5KCBzZWN0aW9uX2lkX3RvX3Nob3cgKTtcblxuICAgIC8vIE1lbnVcbiAgICBqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3NldHRpbmdzX2ZsZXhfY29udGFpbmVyJyApLmZpbmQoICcud3BiY19zZXR0aW5nc19uYXZpZ2F0aW9uX2l0ZW1fYWN0aXZlJyApLnJlbW92ZUNsYXNzKCAnd3BiY19zZXR0aW5nc19uYXZpZ2F0aW9uX2l0ZW1fYWN0aXZlJyApO1xuICAgIGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfc2V0dGluZ3NfbmF2aWdhdGlvbl9pdGVtJyApLmFkZENsYXNzKCAnd3BiY19zZXR0aW5nc19uYXZpZ2F0aW9uX2l0ZW1fYWN0aXZlJyApO1xuXG4gICAgLy8gQ29udGVudFxuICAgIGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfc2V0dGluZ3NfZmxleF9jb250YWluZXInICkuZmluZCggJy53cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlJyApLnJlbW92ZUNsYXNzKCAnd3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZV9pc19hY3RpdmUnICkuaGlkZSgpO1xuICAgIHNob3J0Y29kZV9jb250YWluZXIuc2hvdygpLmFkZENsYXNzKCAnd3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZV9pc19hY3RpdmUnICk7XG5cbiAgICAvLyBTdGFydCBlYWNoIHNlbGVjdGVkIGNvbmZpZ3VyYXRpb24gYXQgdGhlIGJlZ2lubmluZyBvZiBpdHMgdmlzaWJsZSBzZWN0aW9uLlxuICAgIHNob3J0Y29kZV9jb250YWluZXIuZmluZCggJy53cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlX3NlY3Rpb246dmlzaWJsZScgKS5zY3JvbGxUb3AoIDAgKTtcbiAgICAvLyBTZXQgLSBTaG9ydGNvZGUgVHlwZVxuICAgIGpRdWVyeSggJyN3cGJjX3Nob3J0Y29kZV90eXBlJykudmFsKCBzaG9ydGNvZGVfbmFtZSApO1xuXG4gICAgLy8gUGFyc2Ugc2hvcnRjb2RlIHBhcmFtc1xuICAgIHdwYmNfc2V0X3Nob3J0Y29kZSgpO1xufVxuXG5cbiAgICAvKipcbiAgICAgKiBEbyBOZXh0IC8gUHJpb3Igc3RlcFxuICAgICAqIEBwYXJhbSBfdGhpc1x0XHRidXR0b24gIHRoaXNcbiAgICAgKiBAcGFyYW0gc3RlcFx0XHQncHJpb3InIHwgJ25leHQnXG4gICAgICovXG4gICAgZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX2NvbnRlbnRfdG9vbGJhcl9fbmV4dF9wcmlvciggX3RoaXMsIHN0ZXAgKXtcblxuICAgICAgICB2YXIgal93b3JrX25hdl90YWI7XG5cbiAgICAgICAgdmFyIHN1Ym1lbnVfc2VsZWN0ZWQgPSBqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlJyApLmZpbmQoICcud3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZV9zZWN0aW9uOnZpc2libGUnICkuZmluZCggJy53cGRldmVsb3Atc3VibWVudS10YWItc2VsZWN0ZWQ6dmlzaWJsZScgKTtcbiAgICAgICAgaWYgKCBzdWJtZW51X3NlbGVjdGVkLmxlbmd0aCApe1xuICAgICAgICAgICAgaWYgKCAnbmV4dCcgPT09IHN0ZXAgKXtcbiAgICAgICAgICAgICAgICBqX3dvcmtfbmF2X3RhYiA9IHN1Ym1lbnVfc2VsZWN0ZWQubmV4dEFsbCggJ2EubmF2LXRhYjp2aXNpYmxlJyApLmZpcnN0KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGpfd29ya19uYXZfdGFiID0gc3VibWVudV9zZWxlY3RlZC5wcmV2QWxsKCAnYS5uYXYtdGFiOnZpc2libGUnICkuZmlyc3QoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggal93b3JrX25hdl90YWIubGVuZ3RoICl7XG4gICAgICAgICAgICAgICAgal93b3JrX25hdl90YWIudHJpZ2dlciggJ2NsaWNrJyApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggJ25leHQnID09PSBzdGVwICl7XG4gICAgICAgICAgICBqX3dvcmtfbmF2X3RhYiA9IGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfc2NfY29udGFpbmVyX19zaG9ydGNvZGUnICkuZmluZCggJy5uYXYtdGFiLm5hdi10YWItYWN0aXZlOnZpc2libGUnICkubmV4dEFsbCggJ2EubmF2LXRhYjp2aXNpYmxlJyApLmZpcnN0KCk7XG4gICAgICAgIH0gZWxzZXtcbiAgICAgICAgICAgIGpfd29ya19uYXZfdGFiID0galF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZScgKS5maW5kKCAnLm5hdi10YWIubmF2LXRhYi1hY3RpdmU6dmlzaWJsZScgKS5wcmV2QWxsKCAnYS5uYXYtdGFiOnZpc2libGUnICkuZmlyc3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggal93b3JrX25hdl90YWIubGVuZ3RoICl7XG4gICAgICAgICAgICBqX3dvcmtfbmF2X3RhYi50cmlnZ2VyKCAnY2xpY2snICk7XG4gICAgICAgIH1cblxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQ29uZGl0aW9uOiAgIHtzZWxlY3QtZGF5IGNvbmRpdGlvbj1cIndlZWtkYXlcIiBmb3I9XCI1XCIgdmFsdWU9XCIzXCJ9XG4gICAgICovXG4gICAgZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19zZWxlY3RfZGF5X3dlZWtkYXlfX2FkZChpZCl7XG4gICAgICAgIHZhciBjb25kaXRpb25fcnVsZV9hcnIgPSBbXTtcbiAgICAgICAgZm9yICggdmFyIHdlZWtkYXlfbnVtID0gMDsgd2Vla2RheV9udW0gPCA4OyB3ZWVrZGF5X251bSsrICl7XG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgaWQgKyAnX193ZWVrZGF5XycgKyB3ZWVrZGF5X251bSApLmlzKCAnOmNoZWNrZWQnICkgKXtcbiAgICAgICAgICAgICAgICB2YXIgZGF5c190b19zZWxlY3QgPSBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXJfJyArIHdlZWtkYXlfbnVtICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBhbGwgd29yZHMgZXhjZXB0IGRpZ2l0cyBhbmQgLCBhbmQgLVxuICAgICAgICAgICAgICAgIGRheXNfdG9fc2VsZWN0ID0gZGF5c190b19zZWxlY3QucmVwbGFjZSgvW14wLTksLV0vZywgJycpO1xuICAgICAgICAgICAgICAgIGRheXNfdG9fc2VsZWN0ID0gZGF5c190b19zZWxlY3QucmVwbGFjZSgvWyxdezIsfS9nLCAnLCcpO1xuICAgICAgICAgICAgICAgIGRheXNfdG9fc2VsZWN0ID0gZGF5c190b19zZWxlY3QucmVwbGFjZSgvWy1dezIsfS9nLCAnLScpO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcl8nICsgd2Vla2RheV9udW0gKS52YWwoIGRheXNfdG9fc2VsZWN0ICk7XG5cbiAgICAgICAgICAgICAgICBpZiAoICcnICE9PSBkYXlzX3RvX3NlbGVjdCApe1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25fcnVsZV9hcnIucHVzaCggJ3tzZWxlY3QtZGF5IGNvbmRpdGlvbj1cIndlZWtkYXlcIiBmb3I9XCInICsgd2Vla2RheV9udW0gKyAnXCIgdmFsdWU9XCInICsgZGF5c190b19zZWxlY3QgKyAnXCJ9JyApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlZCBoaWdobGlnaHQgZmllbGRzLCAgaWYgc29tZSByZXF1aXJlZCBmaWVsZHMgYXJlIGVtcHR5XG4gICAgICAgICAgICAgICAgICAgIGlmICggKCdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19maWVsZF9oaWdobGlnaHQpKSAmJiAoJycgPT09IGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcl8nICsgd2Vla2RheV9udW0gKS52YWwoKSkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfZmllbGRfaGlnaGxpZ2h0KCAnIycgKyBpZCArICdfX2RheXNfbnVtYmVyXycgKyB3ZWVrZGF5X251bSApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBjb25kaXRpb25fcnVsZSA9IGNvbmRpdGlvbl9ydWxlX2Fyci5qb2luKCAnLCcgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCBjb25kaXRpb25fcnVsZSApO1xuICAgICAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19zZWxlY3RfZGF5X3dlZWtkYXlfX3Jlc2V0KGlkKXtcblxuICAgICAgICBmb3IgKCB2YXIgd2Vla2RheV9udW0gPSAwOyB3ZWVrZGF5X251bSA8IDg7IHdlZWtkYXlfbnVtKysgKXtcbiAgICAgICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcl8nICsgd2Vla2RheV9udW0gKS52YWwoICcnICk7XG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgaWQgKyAnX193ZWVrZGF5XycgKyB3ZWVrZGF5X251bSApLmlzKCAnOmNoZWNrZWQnICkgKXtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fd2Vla2RheV8nICsgd2Vla2RheV9udW0gKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCAnJyApO1xuICAgICAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIENvbmRpdGlvbjogICB7c2VsZWN0LWRheSBjb25kaXRpb249XCJzZWFzb25cIiBmb3I9XCJIaWdoIHNlYXNvblwiIHZhbHVlPVwiNy0xNCwyMFwifVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV9zZWFzb25fX2FkZChpZCl7XG5cbiAgICAgICAgdmFyIHNlYXNvbl9maWx0ZXJfbmFtZSA9IGpRdWVyeSggJyMnICsgaWQgKyAnX19zZWFzb25fZmlsdGVyX25hbWUgb3B0aW9uOnNlbGVjdGVkJyApLnRleHQoKS50cmltKCk7XG4gICAgICAgIC8vIEVzY2FwZSBxdW90ZSBzeW1ib2xzXG4gICAgICAgIHNlYXNvbl9maWx0ZXJfbmFtZSA9IHNlYXNvbl9maWx0ZXJfbmFtZS5yZXBsYWNlKC9bXFxcIlwiXS9nLCAnXFxcXFwiJyk7XG5cbiAgICAgICAgdmFyIGRheXNfbnVtYmVyID0galF1ZXJ5KCAnIycgKyBpZCArICdfX2RheXNfbnVtYmVyJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgLy8gUmVtb3ZlIGFsbCB3b3JkcyBleGNlcHQgZGlnaXRzIGFuZCAsIGFuZCAtXG4gICAgICAgIGRheXNfbnVtYmVyID0gZGF5c19udW1iZXIucmVwbGFjZSggL1teMC05LC1dL2csICcnICk7XG4gICAgICAgIGRheXNfbnVtYmVyID0gZGF5c19udW1iZXIucmVwbGFjZSggL1ssXXsyLH0vZywgJywnICk7XG4gICAgICAgIGRheXNfbnVtYmVyID0gZGF5c19udW1iZXIucmVwbGFjZSggL1stXXsyLH0vZywgJy0nICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKS52YWwoIGRheXNfbnVtYmVyICk7XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgKCcnICE9IGRheXNfbnVtYmVyKVxuICAgICAgICAgICAgJiYgKCcnICE9IHNlYXNvbl9maWx0ZXJfbmFtZSlcbiAgICAgICAgICAgICYmICgwICE9IGpRdWVyeSggJyMnICsgaWQgKyAnX19zZWFzb25fZmlsdGVyX25hbWUnICkudmFsKCkpXG5cbiAgICAgICAgKXtcbiAgICAgICAgICAgIHZhciBleGlzdF9jb25maWd1cmF0aW9uID0galF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCk7XG5cbiAgICAgICAgICAgIGV4aXN0X2NvbmZpZ3VyYXRpb24gPSBleGlzdF9jb25maWd1cmF0aW9uLnJlcGxhY2VBbGwoXCJ9LHtcIiwgJ31+fnsnKVxuICAgICAgICAgICAgdmFyIGNvbmRpdGlvbl9ydWxlX2FyciA9IGV4aXN0X2NvbmZpZ3VyYXRpb24uc3BsaXQoICd+ficgKTtcblxuICAgICAgICAgICAgLy8gUmVtb3ZlIGVtcHR5IHNwYWNlcyBmcm9tICBhcnJheSA6ICcnIHwgXCJcIlxuICAgICAgICAgICAgY29uZGl0aW9uX3J1bGVfYXJyID0gY29uZGl0aW9uX3J1bGVfYXJyLmZpbHRlcihmdW5jdGlvbihuKXtyZXR1cm4gbjsgfSk7XG5cbiAgICAgICAgICAgIGNvbmRpdGlvbl9ydWxlX2Fyci5wdXNoKCAne3NlbGVjdC1kYXkgY29uZGl0aW9uPVwic2Vhc29uXCIgZm9yPVwiJyArIHNlYXNvbl9maWx0ZXJfbmFtZSArICdcIiB2YWx1ZT1cIicgKyBkYXlzX251bWJlciArICdcIn0nICk7XG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSBkdXBsaWNhdGVzIGZyb20gIHRoZSBhcnJheVxuICAgICAgICAgICAgY29uZGl0aW9uX3J1bGVfYXJyID0gY29uZGl0aW9uX3J1bGVfYXJyLmZpbHRlciggZnVuY3Rpb24gKCBpdGVtLCBwb3MgKXsgcmV0dXJuIGNvbmRpdGlvbl9ydWxlX2Fyci5pbmRleE9mKCBpdGVtICkgPT09IHBvczsgfSApO1xuICAgICAgICAgICAgdmFyIGNvbmRpdGlvbl9ydWxlID0gY29uZGl0aW9uX3J1bGVfYXJyLmpvaW4oICcsJyApO1xuICAgICAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCBjb25kaXRpb25fcnVsZSApO1xuXG4gICAgICAgICAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZCBoaWdobGlnaHQgZmllbGRzLCAgaWYgc29tZSByZXF1aXJlZCBmaWVsZHMgYXJlIGVtcHR5XG4gICAgICAgIGlmICggKCdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19maWVsZF9oaWdobGlnaHQpKSAmJiAoJycgPT09IGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKS52YWwoKSkgKXtcbiAgICAgICAgICAgIHdwYmNfZmllbGRfaGlnaGxpZ2h0KCAnIycgKyBpZCArICdfX2RheXNfbnVtYmVyJyApO1xuICAgICAgICB9XG4gICAgICAgIGlmICggKCdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19maWVsZF9oaWdobGlnaHQpKSAmJiAoJzAnID09PSBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lJyApLnZhbCgpKSApe1xuICAgICAgICAgICAgd3BiY19maWVsZF9oaWdobGlnaHQoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lJyApO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19zZWxlY3RfZGF5X3NlYXNvbl9fcmVzZXQoaWQpe1xuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lIG9wdGlvbjplcSgwKScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKS52YWwoICcnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCggJycgKTtcbiAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBDb25kaXRpb246ICAge3N0YXJ0LWRheSBjb25kaXRpb249XCJzZWFzb25cIiBmb3I9XCJMb3cgc2Vhc29uXCIgdmFsdWU9XCIwLDEsNVwifVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc3RhcnRfZGF5X3NlYXNvbl9fYWRkKCBpZCApe1xuXG4gICAgICAgIHZhciBzZWFzb25fZmlsdGVyX25hbWUgPSBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lIG9wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCkudHJpbSgpO1xuICAgICAgICAvLyBFc2NhcGUgcXVvdGUgc3ltYm9sc1xuICAgICAgICBzZWFzb25fZmlsdGVyX25hbWUgPSBzZWFzb25fZmlsdGVyX25hbWUucmVwbGFjZSgvW1xcXCJcIl0vZywgJ1xcXFxcIicpO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICgnJyAhPSBzZWFzb25fZmlsdGVyX25hbWUpXG4gICAgICAgICAgICAmJiAoMCAhPSBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lJyApLnZhbCgpKVxuXG4gICAgICAgICl7XG4gICAgICAgICAgICB2YXIgYWN0aXZhdGVkX3dlZWtkYXlzID1bXTtcbiAgICAgICAgICAgIGZvciAoIHZhciB3ZWVrZGF5X251bSA9IDA7IHdlZWtkYXlfbnVtIDwgODsgd2Vla2RheV9udW0rKyApe1xuICAgICAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBpZCArICdfX3dlZWtkYXlfJyArIHdlZWtkYXlfbnVtICkuaXMoICc6Y2hlY2tlZCcgKSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZhdGVkX3dlZWtkYXlzLnB1c2goIHdlZWtkYXlfbnVtICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYWN0aXZhdGVkX3dlZWtkYXlzID0gYWN0aXZhdGVkX3dlZWtkYXlzLmpvaW4oICcsJyApO1xuXG4gICAgICAgICAgICBpZiAoICcnICE9IGFjdGl2YXRlZF93ZWVrZGF5cyApe1xuXG4gICAgICAgICAgICAgICAgdmFyIGV4aXN0X2NvbmZpZ3VyYXRpb24gPSBqUXVlcnkoICcjJyArIGlkICsgJ190ZXh0YXJlYScgKS52YWwoKTtcblxuICAgICAgICAgICAgICAgIGV4aXN0X2NvbmZpZ3VyYXRpb24gPSBleGlzdF9jb25maWd1cmF0aW9uLnJlcGxhY2VBbGwoIFwifSx7XCIsICd9fn57JyApXG4gICAgICAgICAgICAgICAgdmFyIGNvbmRpdGlvbl9ydWxlX2FyciA9IGV4aXN0X2NvbmZpZ3VyYXRpb24uc3BsaXQoICd+ficgKTtcblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBlbXB0eSBzcGFjZXMgZnJvbSAgYXJyYXkgOiAnJyB8IFwiXCJcbiAgICAgICAgICAgICAgICBjb25kaXRpb25fcnVsZV9hcnIgPSBjb25kaXRpb25fcnVsZV9hcnIuZmlsdGVyKCBmdW5jdGlvbiAoIG4gKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG47XG4gICAgICAgICAgICAgICAgfSApO1xuXG4gICAgICAgICAgICAgICAgY29uZGl0aW9uX3J1bGVfYXJyLnB1c2goICd7c3RhcnQtZGF5IGNvbmRpdGlvbj1cInNlYXNvblwiIGZvcj1cIicgKyBzZWFzb25fZmlsdGVyX25hbWUgKyAnXCIgdmFsdWU9XCInICsgYWN0aXZhdGVkX3dlZWtkYXlzICsgJ1wifScgKTtcblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBkdXBsaWNhdGVzIGZyb20gIHRoZSBhcnJheVxuICAgICAgICAgICAgICAgIGNvbmRpdGlvbl9ydWxlX2FyciA9IGNvbmRpdGlvbl9ydWxlX2Fyci5maWx0ZXIoIGZ1bmN0aW9uICggaXRlbSwgcG9zICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb25kaXRpb25fcnVsZV9hcnIuaW5kZXhPZiggaXRlbSApID09PSBwb3M7XG4gICAgICAgICAgICAgICAgfSApO1xuICAgICAgICAgICAgICAgIHZhciBjb25kaXRpb25fcnVsZSA9IGNvbmRpdGlvbl9ydWxlX2Fyci5qb2luKCAnLCcgKTtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ190ZXh0YXJlYScgKS52YWwoIGNvbmRpdGlvbl9ydWxlICk7XG5cbiAgICAgICAgICAgICAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZCBoaWdobGlnaHQgZmllbGRzLCAgaWYgc29tZSByZXF1aXJlZCBmaWVsZHMgYXJlIGVtcHR5XG4gICAgICAgIGlmICggKCdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19maWVsZF9oaWdobGlnaHQpKSAmJiAoJzAnID09PSBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lJyApLnZhbCgpKSApe1xuICAgICAgICAgICAgd3BiY19maWVsZF9oaWdobGlnaHQoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lJyApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc3RhcnRfZGF5X3NlYXNvbl9fcmVzZXQoaWQpe1xuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lIG9wdGlvbjplcSgwKScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XG4gICAgICAgIGZvciAoIHZhciB3ZWVrZGF5X251bSA9IDA7IHdlZWtkYXlfbnVtIDwgODsgd2Vla2RheV9udW0rKyApe1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIGlkICsgJ19fd2Vla2RheV8nICsgd2Vla2RheV9udW0gKS5pcyggJzpjaGVja2VkJyApICl7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfX3dlZWtkYXlfJyArIHdlZWtkYXlfbnVtICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCggJycgKTtcbiAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBDb25kaXRpb246ICAge3NlbGVjdC1kYXkgY29uZGl0aW9uPVwiZGF0ZVwiIGZvcj1cIjIwMjMtMTAtMDFcIiB2YWx1ZT1cIjIwLDI1LDMwLTM1XCJ9XG4gICAgICovXG4gICAgZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19zZWxlY3RfZGF5X2ZvcmRhdGVfX2FkZChpZCl7XG5cbiAgICAgICAgdmFyIHN0YXJ0X2RhdGVfX2ZvcmRhdGUgPSBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF0ZScgKS52YWwoKS50cmltKCk7XG4gICAgICAgIC8vIFJlbW92ZSBhbGwgd29yZHMgZXhjZXB0IGRpZ2l0cyBhbmQgLCBhbmQgLVxuICAgICAgICBzdGFydF9kYXRlX19mb3JkYXRlID0gc3RhcnRfZGF0ZV9fZm9yZGF0ZS5yZXBsYWNlKCAvW14wLTktXS9nLCAnJyApO1xuXG4gICAgICAgIHZhciBnbG9iYWxSZWdleCA9IG5ldyBSZWdFeHAoIC9eXFxkezR9LVswMV17MX1cXGR7MX0tWzAxMjNdezF9XFxkezF9JC8sICdnJyApO1xuICAgICAgICB2YXIgaXNfdmFsaWRfZGF0ZSA9IGdsb2JhbFJlZ2V4LnRlc3QoIHN0YXJ0X2RhdGVfX2ZvcmRhdGUgKTtcbiAgICAgICAgaWYgKCAhaXNfdmFsaWRfZGF0ZSApe1xuICAgICAgICAgICAgc3RhcnRfZGF0ZV9fZm9yZGF0ZSA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXRlJyApLnZhbCggc3RhcnRfZGF0ZV9fZm9yZGF0ZSApO1xuXG4gICAgICAgIHZhciBkYXlzX251bWJlciA9IGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKS52YWwoKS50cmltKCk7XG4gICAgICAgIC8vIFJlbW92ZSBhbGwgd29yZHMgZXhjZXB0IGRpZ2l0cyBhbmQgLCBhbmQgLVxuICAgICAgICBkYXlzX251bWJlciA9IGRheXNfbnVtYmVyLnJlcGxhY2UoIC9bXjAtOSwtXS9nLCAnJyApO1xuICAgICAgICBkYXlzX251bWJlciA9IGRheXNfbnVtYmVyLnJlcGxhY2UoIC9bLF17Mix9L2csICcsJyApO1xuICAgICAgICBkYXlzX251bWJlciA9IGRheXNfbnVtYmVyLnJlcGxhY2UoIC9bLV17Mix9L2csICctJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXInICkudmFsKCBkYXlzX251bWJlciApO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICgnJyAhPSBkYXlzX251bWJlcilcbiAgICAgICAgICAgICYmICgnJyAhPSBzdGFydF9kYXRlX19mb3JkYXRlKVxuICAgICAgICAgICAgJiYgKDAgIT0galF1ZXJ5KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZScgKS52YWwoKSlcblxuICAgICAgICApe1xuICAgICAgICAgICAgdmFyIGV4aXN0X2NvbmZpZ3VyYXRpb24gPSBqUXVlcnkoICcjJyArIGlkICsgJ190ZXh0YXJlYScgKS52YWwoKTtcblxuICAgICAgICAgICAgZXhpc3RfY29uZmlndXJhdGlvbiA9IGV4aXN0X2NvbmZpZ3VyYXRpb24ucmVwbGFjZUFsbChcIn0se1wiLCAnfX5+eycpXG4gICAgICAgICAgICB2YXIgY29uZGl0aW9uX3J1bGVfYXJyID0gZXhpc3RfY29uZmlndXJhdGlvbi5zcGxpdCggJ35+JyApO1xuXG4gICAgICAgICAgICAvLyBSZW1vdmUgZW1wdHkgc3BhY2VzIGZyb20gIGFycmF5IDogJycgfCBcIlwiXG4gICAgICAgICAgICBjb25kaXRpb25fcnVsZV9hcnIgPSBjb25kaXRpb25fcnVsZV9hcnIuZmlsdGVyKGZ1bmN0aW9uKG4pe3JldHVybiBuOyB9KTtcblxuICAgICAgICAgICAgY29uZGl0aW9uX3J1bGVfYXJyLnB1c2goICd7c2VsZWN0LWRheSBjb25kaXRpb249XCJkYXRlXCIgZm9yPVwiJyArIHN0YXJ0X2RhdGVfX2ZvcmRhdGUgKyAnXCIgdmFsdWU9XCInICsgZGF5c19udW1iZXIgKyAnXCJ9JyApO1xuXG4gICAgICAgICAgICAvLyBSZW1vdmUgZHVwbGljYXRlcyBmcm9tICB0aGUgYXJyYXlcbiAgICAgICAgICAgIGNvbmRpdGlvbl9ydWxlX2FyciA9IGNvbmRpdGlvbl9ydWxlX2Fyci5maWx0ZXIoIGZ1bmN0aW9uICggaXRlbSwgcG9zICl7IHJldHVybiBjb25kaXRpb25fcnVsZV9hcnIuaW5kZXhPZiggaXRlbSApID09PSBwb3M7IH0gKTtcbiAgICAgICAgICAgIHZhciBjb25kaXRpb25fcnVsZSA9IGNvbmRpdGlvbl9ydWxlX2Fyci5qb2luKCAnLCcgKTtcbiAgICAgICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCggY29uZGl0aW9uX3J1bGUgKTtcblxuICAgICAgICAgICAgICAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbiAgICAgICAgfSBlbHNlXG5cbiAgICAgICAgLy8gUmVkIGhpZ2hsaWdodCBmaWVsZHMsICBpZiBzb21lIHJlcXVpcmVkIGZpZWxkcyBhcmUgZW1wdHlcbiAgICAgICAgaWYgKCAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX2ZpZWxkX2hpZ2hsaWdodCkpICYmICgnJyA9PT0galF1ZXJ5KCAnIycgKyBpZCArICdfX2RhdGUnICkudmFsKCkpICl7XG4gICAgICAgICAgICB3cGJjX2ZpZWxkX2hpZ2hsaWdodCggJyMnICsgaWQgKyAnX19kYXRlJyApO1xuICAgICAgICB9XG4gICAgICAgIGlmICggKCdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19maWVsZF9oaWdobGlnaHQpKSAmJiAoJycgPT09IGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKS52YWwoKSkgKXtcbiAgICAgICAgICAgIHdwYmNfZmllbGRfaGlnaGxpZ2h0KCAnIycgKyBpZCArICdfX2RheXNfbnVtYmVyJyApO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV9mb3JkYXRlX19yZXNldChpZCl7XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXRlJyApLnZhbCggJycgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfX2RheXNfbnVtYmVyJyApLnZhbCggJycgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCAnJyApO1xuICAgICAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbiAgICB9XG5cblxuXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3VwZGF0ZV9lbGVtZW50c19pbl90aW1lbGluZSgpe1xuXG4gICAgdmFyIHdwYmNfaXNfbWF0cml4ID0gZmFsc2U7XG5cbiAgICBpZiAoIGpRdWVyeSggJyNib29raW5ndGltZWxpbmVfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXMnICkubGVuZ3RoID4gMCApIHtcblxuICAgICAgICB2YXIgYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzX3RlbXAgPSBqUXVlcnkoICcjYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzJyApLnZhbCgpO1xuXG4gICAgICAgIGlmICggKCBib29raW5ndGltZWxpbmVfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXNfdGVtcCAhPSBudWxsICkgJiYgKCBib29raW5ndGltZWxpbmVfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXNfdGVtcC5sZW5ndGggPiAwICkgICl7XG5cbiAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCBmYWxzZSApO1xuICAgICAgICAgICAgalF1ZXJ5KCBcIi53cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlX2Jvb2tpbmd0aW1lbGluZSBsYWJlbC53cGJjLWZvcm0tcmFkaW9cIiApLnNob3coKTtcblxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAoIGJvb2tpbmd0aW1lbGluZV93cGJjX211bHRpcGxlX3Jlc291cmNlc190ZW1wLmxlbmd0aCA+IDEgKVxuICAgICAgICAgICAgICAgIHx8ICAoIChib29raW5ndGltZWxpbmVfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXNfdGVtcC5sZW5ndGggPT0gMSkgJiYgKGJvb2tpbmd0aW1lbGluZV93cGJjX211bHRpcGxlX3Jlc291cmNlc190ZW1wWyAwIF0gPT0gJzAnKSlcbiAgICAgICAgICAgICl7ICAvLyBNYXRyaXhcbiAgICAgICAgICAgICAgICB3cGJjX2lzX21hdHJpeCA9IHRydWU7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPSc5MCddXCIgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcbiAgICAgICAgICAgICAgICBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J11bdmFsdWU9JzkwJ11cIiApLnBhcmVudHMoJy53cGJjLWZvcm0tcmFkaW8nKS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPSczNjUnXVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPSczNjUnXVwiICkucGFyZW50cygnLndwYmMtZm9ybS1yYWRpbycpLmhpZGUoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTaW5nbGVcbiAgICAgICAgICAgICAgICBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J11bdmFsdWU9JzEnXVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPScxJ11cIiApLnBhcmVudHMoJy53cGJjLWZvcm0tcmFkaW8nKS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPSc3J11cIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nNyddXCIgKS5wYXJlbnRzKCcud3BiYy1mb3JtLXJhZGlvJykuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nNjAnXVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPSc2MCddXCIgKS5wYXJlbnRzKCcud3BiYy1mb3JtLXJhZGlvJykuaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICBpZiAoIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXTpjaGVja2VkXCIgKS5pcygnOmRpc2FibGVkJykgKSB7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPSczMCddXCIgKS5wcm9wKCBcImNoZWNrZWRcIiwgdHJ1ZSApO1xuICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdmlld19kYXlzX251bV90ZW1wID0gMzA7XG4gICAgaWYgKCBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J106Y2hlY2tlZFwiICkubGVuZ3RoID4gMCApe1xuICAgICAgICB2YXIgdmlld19kYXlzX251bV90ZW1wID0gcGFyc2VJbnQoIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXTpjaGVja2VkXCIgKS52YWwoKS50cmltKCkgKTtcbiAgICB9XG5cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gSGlkZSBvciBTaG93IFNjcm9sbGluZyBEYXlzIGFuZCBNb250aHMsIGRlcGVuZGluZyBvbiBmcm9tIHR5cGUgb2YgdmlldyBhbmQgbnVtYmVyIG9mIGJvb2tpbmcgcmVzb3VyY2VzXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIGpRdWVyeSggXCIjd3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX21vbnRoLCN3cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfZGF5XCIgKS5wcm9wKCBcImRpc2FibGVkXCIsIGZhbHNlICk7XG4gICAgalF1ZXJ5KCBcIi53cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfbW9udGgsLndwYmNfYm9va2luZ3RpbWVsaW5lX3Njcm9sbF9kYXlcIiApLnNob3coKTtcbiAgICAvLyBNYXRyaXggLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIGlmIChcbiAgICAgICAgICAoIHdwYmNfaXNfbWF0cml4ICkgJiYgKCAoIHZpZXdfZGF5c19udW1fdGVtcCA9PSAxICkgfHwgKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gNyApICkgLy8gRGF5IHwgV2VlayB2aWV3XG4gICAgICAgICkge1xuICAgICAgICAgICAgalF1ZXJ5KCBcIiN3cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfbW9udGhcIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTY3JvbGwgTW9udGggTk9UIHdvcmtpbmdcbiAgICAgICAgICAgIGpRdWVyeSggJy53cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfbW9udGgnICkuaGlkZSgpO1xuICAgICAgICB9XG4gICAgaWYgKFxuICAgICAgICAgICggd3BiY19pc19tYXRyaXggKSYmICggKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gMzAgKSB8fCAoIHZpZXdfZGF5c19udW1fdGVtcCA9PSA2MCApICkgLy8gTW9udGggdmlld1xuICAgICAgICApIHtcbiAgICAgICAgICAgIGpRdWVyeSggXCIjd3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX2RheVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2Nyb2xsIERheXMgTk9UIHdvcmtpbmdcbiAgICAgICAgICAgIGpRdWVyeSggJy53cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfZGF5JyApLmhpZGUoKTtcbiAgICAgICAgfVxuICAgIC8vIFNpbmdsZSAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgaWYgKFxuICAgICAgICAgICggISB3cGJjX2lzX21hdHJpeCApICYmICggKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gMzAgKSB8fCAoIHZpZXdfZGF5c19udW1fdGVtcCA9PSA5MCApICkgIC8vIE1vbnRoIHwgMyBNb250aHMgdmlldyAobGlrZSB3ZWVrIHZpZXcpXG4gICAgICAgICkge1xuICAgICAgICAgICAgalF1ZXJ5KCBcIiN3cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfbW9udGhcIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTY3JvbGwgTW9udGggTk9UIHdvcmtpbmdcbiAgICAgICAgICAgIGpRdWVyeSggJy53cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfbW9udGgnICkuaGlkZSgpO1xuICAgICAgICB9XG4gICAgaWYgKFxuICAgICAgICAgICggISB3cGJjX2lzX21hdHJpeCApJiYgKCAoIHZpZXdfZGF5c19udW1fdGVtcCA9PSAzNjUgKSApICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gWWVhciB2aWV3XG4gICAgICAgICkge1xuICAgICAgICAgICAgalF1ZXJ5KCBcIiN3cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfZGF5XCIgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTY3JvbGwgRGF5cyBOT1Qgd29ya2luZ1xuICAgICAgICAgICAgalF1ZXJ5KCAnLndwYmNfYm9va2luZ3RpbWVsaW5lX3Njcm9sbF9kYXknICkuaGlkZSgpO1xuICAgICAgICB9XG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5cbiAgICByZXR1cm4gWyB3cGJjX2lzX21hdHJpeCwgdmlld19kYXlzX251bV90ZW1wIF07XG59XG5cblxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFtib29raW5nIC4uLiBdXG5cbiAgICB2YXIgc2hvcnRjb2RlX2FyciA9IFsnYm9va2luZycsICdib29raW5nY2FsZW5kYXInLCAnYm9va2luZ3NlbGVjdCcsICdib29raW5ndGltZWxpbmUnLCAnYm9va2luZ2Zvcm0nLCAnYm9va2luZ3NlYXJjaCcsICdib29raW5nb3RoZXInLCAnYm9va2luZ19pbXBvcnRfaWNzJyAsICdib29raW5nX2xpc3RpbmdfaWNzJywgJ2Jvb2tpbmdfYXBwb2ludG1lbnQnLCAnYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvciddO1xuXG4gICAgZm9yICggdmFyIHNob3J0Y2RlX2tleSBpbiBzaG9ydGNvZGVfYXJyICl7XG5cbiAgICAgICAgdmFyIGlkID0gc2hvcnRjb2RlX2Fyclsgc2hvcnRjZGVfa2V5IF07XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAvLyBIaWRlIGJ5IFNpemUgc2VjdGlvbnNcbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBqUXVlcnkoICcuJyArIGlkICsgJ193cGJjX3NpemVfd3BiY19zY19jYWxlbmRhcl9zaXplJyApLmhpZGUoKTtcbiAgICAgICAgalF1ZXJ5KCAnLicgKyBpZCArICdfd3BiY19wb3B1cF93cGJjX3NjX2Jvb2tpbmdfcG9wdXAnICkuaGlkZSgpO1xuXG4gICAgICAgIC8vIG9wdGlvbnMgOjogU2hvdyAvIEhpZGUgU0laRSBjYWxlbmRhciAgc2VjdGlvblxuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ193cGJjX3NpemVfZW5hYmxlZCcgKS5vbiggJ2NoYW5nZScsIHsnaWQnOiBpZH0sIGZ1bmN0aW9uKCBldmVudCApe1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIGV2ZW50LmRhdGEuaWQgKyAnX3dwYmNfc2l6ZV9lbmFibGVkJyApLmlzKCAnOmNoZWNrZWQnICkgKXtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuJyArIGV2ZW50LmRhdGEuaWQgKyAnX3dwYmNfc2l6ZV93cGJjX3NjX2NhbGVuZGFyX3NpemUnICkuc2hvdygpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuJyArIGV2ZW50LmRhdGEuaWQgKyAnX3dwYmNfc2l6ZV93cGJjX3NjX2NhbGVuZGFyX3NpemUnICkuaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICk7XG5cbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfd3BiY19wb3B1cF9lbmFibGVkJyApLm9uKCAnY2hhbmdlJywgeydpZCc6IGlkfSwgZnVuY3Rpb24oIGV2ZW50ICl7XG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgZXZlbnQuZGF0YS5pZCArICdfd3BiY19wb3B1cF9lbmFibGVkJyApLmlzKCAnOmNoZWNrZWQnICkgKXtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuJyArIGV2ZW50LmRhdGEuaWQgKyAnX3dwYmNfcG9wdXBfd3BiY19zY19ib29raW5nX3BvcHVwJyApLnNob3coKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLicgKyBldmVudC5kYXRhLmlkICsgJ193cGJjX3BvcHVwX3dwYmNfc2NfYm9va2luZ19wb3B1cCcgKS5oaWRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gKTtcblxuICAgICAgICAvLyBJZiB3ZSBjaGFuZ2VkIG51bWJlciBvZiBtb250aHMgaW4gJ1NldHVwIFNpemUgJiBTdHJ1Y3R1cmUnIHRoZW4gIGNoYW5nZSBnZW5lcmFsICdWaXNpYmxlIG1vbnRocycgbnVtYmVyICAgICAgLy8gRml4SW46IDEwLjAuMC40LlxuICAgICAgICBqUXVlcnkoICAnIycgKyBpZCArICdfd3BiY19zaXplX21vbnRoc19udW1faW5fcm93JyAgICAgICAgICAgICAgICAgICAvLyAtIE1vbnRoIE51bSBpbiBSb3dcbiAgICAgICAgICAgICAgICAgICAgKS5vbiggJ2NoYW5nZScsIHsnaWQnOiBpZH0sIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgICAgIGpRdWVyeSggJyMnICsgZXZlbnQuZGF0YS5pZCArICdfd3BiY19udW1tb250aHMgb3B0aW9uW3ZhbHVlPVwiJyArIHBhcnNlSW50KCBqUXVlcnkoICcjJyArIGV2ZW50LmRhdGEuaWQgKyAnX3dwYmNfc2l6ZV9tb250aHNfbnVtX2luX3JvdycgKS52YWwoKS50cmltKCkgKSArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApOy8vLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICAgICAgaWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZmllbGRfaGlnaGxpZ2h0KSApe1xuICAgICAgICAgICAgICAgIHdwYmNfZmllbGRfaGlnaGxpZ2h0KCAnIycgKyBldmVudC5kYXRhLmlkICsgJ193cGJjX251bW1vbnRocycgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9KTtcblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIC8vIFVwZGF0ZSBTaG9ydGNvZGUgb24gY2hhbmdpbmc6IFNpemVcbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBqUXVlcnkoICAgJyMnICsgaWQgKyAnX3dwYmNfc2l6ZV9lbmFibGVkJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2l6ZSBPbiB8IE9mZlxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc2l6ZV9tb250aHNfbnVtX2luX3JvdycgICAgICAgICAgICAgICAgICAgLy8gLSBNb250aCBOdW0gaW4gUm93XG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zaXplX2NhbGVuZGFyX3dpZHRoJyAgICAgICAgICAgICAgICAgICAgICAvLyAtIFdpZHRoXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zaXplX2NhbGVuZGFyX3dpZHRoX3B4X3ByJyAgICAgICAgICAgICAgICAvLyAtIFdpZHRoIFBTIHwgJVxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc2l6ZV9jYWxlbmRhcl9jZWxsX2hlaWdodCcgICAgICAgICAgICAgICAgLy8gLSBDZWxsIEhlaWdodFxuXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19wb3B1cF9lbmFibGVkJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBCb29raW5nIGZvcm0gcG9wdXAgT24gfCBPZmZcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3BvcHVwX2J1dHRvbl90aXRsZScgICAgICAgICAgICAgICAgICAgICAgIC8vIFBvcHVwIGJ1dHRvbiB0aXRsZVxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfcG9wdXBfdGl0bGUnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUG9wdXAgdGl0bGVcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3BvcHVwX2J1dHRvbl9jbGFzcycgICAgICAgICAgICAgICAgICAgICAgIC8vIFBvcHVwIGJ1dHRvbiBjbGFzc1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfcG9wdXBfbW9kYWxfY2xhc3MnICAgICAgICAgICAgICAgICAgICAgICAgLy8gUG9wdXAgbW9kYWwgY2xhc3NcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3BvcHVwX3NpemUnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBvcHVwIHNpemVcblxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnd3BiY19zZWxlY3RfZGF5X3dlZWtkYXlfdGV4dGFyZWEnICAgICAgICAgICAgICAgLy8gUnVsZSBXZWVrZGF5XG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICd3cGJjX3NlbGVjdF9kYXlfc2Vhc29uX3RleHRhcmVhJyAgICAgICAgICAgICAgICAvLyBSdWxlIFNlYXNvblxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnd3BiY19zdGFydF9kYXlfc2Vhc29uX3RleHRhcmVhJyAgICAgICAgICAgICAgICAgLy8gUnVsZSBTZWFzb24gLSBTdGFydCBkYXlcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ3dwYmNfc2VsZWN0X2RheV9mb3JkYXRlX3RleHRhcmVhJyAgICAgICAgICAgICAgIC8vIFJ1bGUgRGF0ZVxuXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19yZXNvdXJjZV9pZCcgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSZXNvdXJjZSBJRFxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfY3VzdG9tX2Zvcm0nICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ3VzdG9tIEZvcm1cbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX251bW1vbnRocycgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE51bSBNb250aHNcblxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc3RhcnRtb250aF9hY3RpdmUnICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGFydCBNb250aCBFbmFibGVcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3N0YXJ0bW9udGhfeWVhcicgICAgICAgICAgICAgICAgICAgICAgICAgLy8gIC0gWWVhclxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc3RhcnRtb250aF9tb250aCcgICAgICAgICAgICAgICAgICAgICAgICAvLyAgLSBNb250aFxuXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF9hY3RpdmUnICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGFydCBNb250aCBFbmFibGVcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX3N0YXJ0X3llYXInICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAtIFllYXJcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX3N0YXJ0X21vbnRoJyAgICAgICAgICAgICAgICAgICAgICAgIC8vICAtIE1vbnRoXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF9kYXRlJyAgICAgICAgICAgICAgICAgICAgICAgIC8vICAtIE1vbnRoXG5cbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX2VuZF9hY3RpdmUnICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGFydCBNb250aCBFbmFibGVcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX2VuZF95ZWFyJyAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgLSBZZWFyXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfbW9udGgnICAgICAgICAgICAgICAgICAgICAgICAgLy8gIC0gTW9udGhcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX2VuZF9kYXRlJyAgICAgICAgICAgICAgICAgICAgICAgIC8vICAtIE1vbnRoXG5cbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2FnZ3JlZ2F0ZScgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWdncmVnYXRlXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19hZ2dyZWdhdGVfX2Jvb2tpbmdzX29ubHknICAgICAgICAgICAgICAgIC8vIGFnZ3JlZ2F0ZSBvcHRpb25cblxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzJyAgICAgICAgICAgICAgICAgICAgIC8vIFtib29raW5nc2VsZWN0XSAtIE11bHRpcGxlIFJlc291cmNlc1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc2VsZWN0ZWRfcmVzb3VyY2UnICAgICAgICAgICAgICAgICAgICAgIC8vIFtib29raW5nc2VsZWN0XSAtIFNlbGVjdGVkIFJlc291cmNlXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY190ZXh0X2xhYmVsJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gW2Jvb2tpbmdzZWxlY3RdIC0gTGFiZWxcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2ZpcnN0X29wdGlvbl90aXRsZScgICAgICAgICAgICAgICAgICAgICAvLyBbYm9va2luZ3NlbGVjdF0gLSBGaXJzdCAgT3B0aW9uXG5cbiAgICAgICAgICAgICAgICAvLyBUaW1lTGluZVxuICAgICAgICAgICAgICAgICtcIixpbnB1dFtuYW1lPSdcIisgaWQgK1wiX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J11cIlxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfdGV4dF9sYWJlbF90aW1lbGluZSdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfZGF5cydcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfbW9udGgnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX2FjdGl2ZSdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfeWVhcidcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfbW9udGgnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX2RheSdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3N0YXJ0X2VuZF90aW1lX3RpbWVsaW5lX3N0YXJ0dGltZSdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3N0YXJ0X2VuZF90aW1lX3RpbWVsaW5lX2VuZHRpbWUnXG5cbiAgICAgICAgICAgICAgICAvLyBGb3JtIE9ubHlcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV95ZWFyJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfYm9va2luZ19kYXRlX21vbnRoJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfYm9va2luZ19kYXRlX2RheSdcblxuICAgICAgICAgICAgICAgIC8vIFtib29raW5nc2VhcmNoIC4uLl1cbiAgICAgICAgICAgICAgICArXCIsaW5wdXRbbmFtZT0nXCIrIGlkICtcIl93cGJjX3NlYXJjaF9mb3JtX3Jlc3VsdHMnXVwiXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zZWFyY2hfbmV3X3BhZ2VfZW5hYmxlZCdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3NlYXJjaF9uZXdfcGFnZV91cmwnXG4gICAgICAgICAgICAgICAgLy8gKycsIycgKyBpZCArICdfd3BiY19zZWFyY2hfaGVhZGVyJyAgICAgICAgICAgICAgICAgICAgICAgLy8gRml4SW46IDEwLjAuMC40MS5cbiAgICAgICAgICAgICAgICAvLyArJywjJyArIGlkICsgJ193cGJjX3NlYXJjaF9ub3RoaW5nX2ZvdW5kJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc2VhcmNoX2Zvcl91c2VycydcblxuICAgICAgICAgICAgICAgIC8vIFtib29raW5nb3RoZXIgLi4uIF1cbiAgICAgICAgICAgICAgICArXCIsaW5wdXRbbmFtZT0nXCIrIGlkICtcIl93cGJjX3Nob3J0Y29kZV90eXBlJ11cIlxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfcmVzb3VyY2Vfc2hvdydcblxuICAgICAgICAgICAgICAgIC8vYm9va2luZ19pbXBvcnRfaWNzICwgYm9va2luZ19saXN0aW5nX2ljc1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfdXJsJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX2Zyb20nXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfZnJvbV9vZmZzZXQnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfZnJvbV9vZmZzZXRfdHlwZSdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ191bnRpbCdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ191bnRpbF9vZmZzZXQnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfdW50aWxfb2Zmc2V0X3R5cGUnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfY29uZGl0aW9uc19pbXBvcnQnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfY29uZGl0aW9uc19ldmVudHMnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfY29uZGl0aW9uc19tYXhfbnVtJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3NpbGVuY2UnXG4gICAgICAgICAgICApLm9uKCAnY2hhbmdlJywgeydpZCc6IGlkfSwgZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKCAnb24gY2hhbmdlIHdwYmNfc2V0X3Nob3J0Y29kZScsIGV2ZW50LmRhdGEuaWQgKTtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcblxuICAgIGpRdWVyeSggJy53cGJjX3Nob3J0Y29kZV9jb25maWdfX3dvcmtmbG93X3BhcmFtZXRlcicgKS5vbiggJ2NoYW5nZSBpbnB1dCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG4gICAgICAgIGlmICggJ2NoYW5nZScgPT09IGV2ZW50LnR5cGUgKSB7XG4gICAgICAgICAgICB3cGJjX3Nob3J0Y29kZV9jb25maWdfX2FwcGx5X3Jlc291cmNlX2xpc3RfcHJlc2V0KCBqUXVlcnkoIHRoaXMgKSApO1xuICAgICAgICB9XG4gICAgICAgIHdwYmNfc2V0X3Nob3J0Y29kZSgpO1xuICAgIH0gKTtcbn0pO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLGlEQUFpREEsQ0FBRUMsU0FBUyxFQUFHO0VBQ3BFLElBQUlDLGNBQWMsR0FBRyxFQUFFO0VBQ3ZCQyxNQUFNLENBQUVGLFNBQVMsSUFBSSxFQUFHLENBQUMsQ0FBQ0csS0FBSyxDQUFFLFNBQVUsQ0FBQyxDQUFDQyxPQUFPLENBQUUsVUFBV0MsTUFBTSxFQUFHO0lBQ3RFLElBQUlDLGFBQWEsR0FBR0MsUUFBUSxDQUFFRixNQUFNLEVBQUUsRUFBRyxDQUFDO0lBQzFDLElBQUtDLGFBQWEsR0FBRyxDQUFDLElBQUksQ0FBQyxD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QUcsK0JBQStCLEdBQzNDLElBQUksR0FBR0EsRUFBRSxHQUFHLHlDQUF5QyxHQUNyRCxJQUFJLEdBQUdBLEVBQUUsR0FBRzs7SUFFYjtJQUFBLEVBQ0MsSUFBSSxHQUFHQSxFQUFFLEdBQUcseUJBQXlCLEdBQ3JDLElBQUksR0FBR0EsRUFBRSxHQUFHLDBCQUEwQixHQUN0QyxJQUFJLEdBQUdBLEVBQUUsR0FBRzs7SUFFYjtJQUFBLEVBQ0MsZUFBZSxHQUFFQSxFQUFFLEdBQUUsNkJBQTZCLEdBQ2xELElBQUksR0FBR0EsRUFBRSxHQUFHLCtCQUErQixHQUMzQyxJQUFJLEdBQUdBLEVBQUUsR0FBRztJQUNiO0lBQ0E7SUFBQSxFQUNDLElBQUksR0FBR0EsRUFBRSxHQUFHOztJQUViO0lBQUEsRUFDQyxlQUFlLEdBQUVBLEVBQUUsR0FBRSx3QkFBd0IsR0FDN0MsSUFBSSxHQUFHQSxFQUFFLEdBQUc7O0lBRWI7SUFBQSxFQUNDLElBQUksR0FBR0EsRUFBRSxHQUFHLFdBQVcsR0FDdkIsSUFBSSxHQUFHQSxFQUFFLEdBQUcsT0FBTyxHQUNuQixJQUFJLEdBQUdBLEVBQUUsR0FBRyxjQUFjLEdBQzFCLElBQUksR0FBR0EsRUFBRSxHQUFHLG1CQUFtQixHQUMvQixJQUFJLEdBQUdBLEVBQUUsR0FBRyxRQUFRLEdBQ3BCLElBQUksR0FBR0EsRUFBRSxHQUFHLGVBQWUsR0FDM0IsSUFBSSxHQUFHQSxFQUFFLEdBQUcsb0JBQW9CLEdBQ2hDLElBQUksR0FBR0EsRUFBRSxHQUFHLG9CQUFvQixHQUNoQyxJQUFJLEdBQUdBLEVBQUUsR0FBRyxvQkFBb0IsR0FDaEMsSUFBSSxHQUFHQSxFQUFFLEdBQUcscUJBQXFCLEdBQ2pDLElBQUksR0FBR0EsRUFBRSxHQUFHLFVBQ2pCLENBQUMsQ0FBQytFLEVBQUUsQ0FBRSxRQUFRLEVBQUU7TUFBQyxJQUFJLEVBQUUvRTtJQUFFLENBQUMsRUFBRSxVQUFTZ0YsS0FBSyxFQUFDO01BQ25DO01BQ0FsSixrQkFBa0IsQ0FBQyxDQUFDO0lBQzVCLENBQUMsQ0FBQztFQUNWO0VBQ0E7RUFDQUEsa0JBQWtCLENBQUMsQ0FBQztFQUVwQlAsTUFBTSxDQUFFLDRDQUE2QyxDQUFDLENBQUN3SixFQUFFLENBQUUsY0FBYyxFQUFFLFVBQVdDLEtBQUssRUFBRztJQUMxRixJQUFLLFFBQVEsS0FBS0EsS0FBSyxDQUFDQyxJQUFJLEVBQUc7TUFDM0JsSixpREFBaUQsQ0FBRVIsTUFBTSxDQUFFLElBQUssQ0FBRSxDQUFDO0lBQ3ZFO0lBQ0FPLGtCQUFrQixDQUFDLENBQUM7RUFDeEIsQ0FBRSxDQUFDO0FBQ1AsQ0FBQyxDQUFDIiwiaWdub3JlTGlzdCI6W119
