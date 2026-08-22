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
 * Apply the recommended compact presentation when List view is selected.
 *
 * The preset is applied only in the shortcode configuration UI when the
 * Resource layout control changes to List. Each affected control remains
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
  $container = $changed_field.closest('#wpbc_sc_container__shortcode_booking_resource_selector');
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvdWlfbW9kYWxfX3Nob3J0Y29kZXMvX291dC93cGJjX3Nob3J0Y29kZV9wb3B1cC5qcyIsIm5hbWVzIjpbIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX3dvcmtmbG93X2lkX2xpc3QiLCJyYXdfdmFsdWUiLCJub3JtYWxpemVkX2lkcyIsIlN0cmluZyIsInNwbGl0IiwiZm9yRWFjaCIsInJhd19pZCIsIm5vcm1hbGl6ZWRfaWQiLCJwYXJzZUludCIsImluZGV4T2YiLCJwdXNoIiwiam9pbiIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX2Nzc193aWR0aCIsIm5vcm1hbGl6ZWRfd2lkdGgiLCJ0cmltIiwidG9Mb3dlckNhc2UiLCJ3aWR0aF9tYXRjaCIsIm51bWVyaWNfd2lkdGgiLCJtYXhpbXVtX3dpZHRoIiwidGVzdCIsImV4ZWMiLCJwYXJzZUZsb2F0IiwiTnVtYmVyIiwidG9GaXhlZCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fZ2V0X3dvcmtmbG93X2ZpZWxkX3ZhbHVlIiwiJGZpZWxkIiwidmFsdWVfdHlwZSIsImRhdGEiLCJpcyIsInZhbCIsImZpZWxkX3ZhbHVlIiwiQXJyYXkiLCJpc0FycmF5IiwiaXNfdmFsaWQiLCJtb250aF9tYXRjaCIsInJhd19jc3Nfd2lkdGgiLCJpc05hTiIsIndwYmNfZmllbGRfaGlnaGxpZ2h0IiwiYXR0ciIsInJlcGxhY2UiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX2J1aWxkX3dvcmtmbG93X3Nob3J0Y29kZSIsInNob3J0Y29kZV9pZCIsInNob3J0Y29kZV90ZXh0IiwiJGNvbnRhaW5lciIsImpRdWVyeSIsImZpbmQiLCJlYWNoIiwicGFyYW1ldGVyX25hbWUiLCJkZWZhdWx0X3ZhbHVlIiwid3BiY19zaG9ydGNvZGVfY29uZmlnX19yZXNldF93b3JrZmxvdyIsInByb3AiLCJ3cGJjX3NldF9zaG9ydGNvZGUiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX2FwcGx5X3Jlc291cmNlX2xpc3RfcHJlc2V0IiwiJGNoYW5nZWRfZmllbGQiLCJjbG9zZXN0IiwibGVuZ3RoIiwiY29uc29sZSIsImxvZyIsIndwYmNfc2hvcnRjb2RlIiwid3BiY19vcHRpb25zX2FyciIsIm11bHRpcGxlX3Jlc291cmNlcyIsImZpbHRlciIsIm4iLCJ3cGJjX2lzX21hdHJpeF9fdmlld19kYXlzX251bV90ZW1wIiwid3BiY19zaG9ydGNvZGVfY29uZmlnX191cGRhdGVfZWxlbWVudHNfaW5fdGltZWxpbmUiLCJ3cGJjX2lzX21hdHJpeCIsInZpZXdfZGF5c19udW1fdGVtcCIsImhlYWRlcl90aXRsZV90ZW1wIiwiaGlkZSIsInNob3ciLCJ2aWV3X3RpbWVzX3N0YXJ0X3RlbXAiLCJ2aWV3X3RpbWVzX2VuZF90ZW1wIiwid3BiY19zZWxlY3RlZF9kYXkiLCJ3cGJjX3NlbGVjdGVkX21vbnRoIiwid3BiY19zZWFyY2hfZm9ybV9yZXN1bHRzIiwic2VhcmNoX3Jlc3VsdHNfdXJsX3RlbXAiLCJvbmx5X2Zvcl91c2Vyc190ZW1wIiwiYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlIiwic2hvcnRjb2RlX3VybF90ZW1wIiwicF9mcm9tIiwicF9mcm9tX29mZnNldCIsImNoYXJBdCIsInBfdW50aWwiLCJwX3VudGlsX29mZnNldCIsInBfbWF4IiwicF9pc19hbGxfZGF0ZXNfaW4iLCJwX2ltcG9ydF9jb25kaXRpb25zIiwiZm9ybV90eXBlX3RlbXAiLCJwb3B1cF9idXR0b25fdGl0bGVfZGVmYXVsdCIsInBvcHVwX2J1dHRvbl90aXRsZV90ZW1wIiwicG9wdXBfdGl0bGVfZGVmYXVsdCIsInBvcHVwX3RpdGxlX3RlbXAiLCJwb3B1cF9idXR0b25fY2xhc3NfdGVtcCIsInBvcHVwX21vZGFsX2NsYXNzX3RlbXAiLCJwb3B1cF9zaXplX3RlbXAiLCJ3cGJjX2FnZ3JlZ2F0ZV90ZW1wIiwid3BiY19vcHRpb25zX3NpemUiLCJNYXRoIiwibWluIiwid3BiY190aW55X2J0bl9jbGljayIsInRhZyIsIndwYmNfbXlfbW9kYWwiLCJrZXlib2FyZCIsImJhY2tkcm9wIiwid3BiY190aW55X2Nsb3NlIiwid3BiY19zZW5kX3RleHRfdG9fZWRpdG9yIiwiaCIsIndwYmNfc2VuZF90ZXh0X3RvX2d1dGVuYmVyZyIsImlzX3NlbmQiLCJlZCIsIm1jZSIsInRpbnltY2UiLCJxdCIsIlFUYWdzIiwid2luZG93Iiwid3BBY3RpdmVFZGl0b3IiLCJhY3RpdmVFZGl0b3IiLCJpZCIsImdldCIsImlzSGlkZGVuIiwiaXNJRSIsIndpbmRvd01hbmFnZXIiLCJpbnNlcnRpbWFnZWJvb2ttYXJrIiwic2VsZWN0aW9uIiwibW92ZVRvQm9va21hcmsiLCJ3cFNldEltZ0NhcHRpb24iLCJwbHVnaW5zIiwid3BnYWxsZXJ5IiwiX2RvX2dhbGxlcnkiLCJ3b3JkcHJlc3MiLCJfc2V0RW1iZWQiLCJleGVjQ29tbWFuZCIsImluc2VydENvbnRlbnQiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwidmFsdWUiLCJ0Yl9yZW1vdmUiLCJlIiwid3BiY19yZXNvdXJjZV9wYWdlX2J0bl9jbGljayIsInJlc291cmNlX2lkIiwic2hvcnRjb2RlX2RlZmF1bHRfdmFsdWUiLCJzaG9ydGNvZGVfYXJyIiwic2hvcnRjZGVfa2V5IiwidHJpZ2dlciIsIndwYmNfc2VuZF90ZXh0X3RvX3Jlc291cmNlIiwic2hvcnRjb2RlX3ZhbCIsImh0bWwiLCJzaG9ydGNvZGUiLCJ3cGJjX3Njcm9sbF90byIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fcmVzZXQiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfd2Vla2RheV9fcmVzZXQiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfc2Vhc29uX19yZXNldCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc3RhcnRfZGF5X3NlYXNvbl9fcmVzZXQiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfZm9yZGF0ZV9fcmVzZXQiLCJEYXRlIiwiZ2V0RnVsbFllYXIiLCJnZXRNb250aCIsImdldERhdGUiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfY2xpY2tfc2hvd19zZWN0aW9uIiwiX3RoaXMiLCJzZWN0aW9uX2lkX3RvX3Nob3ciLCJzaG9ydGNvZGVfbmFtZSIsInNob3J0Y29kZV9jb250YWluZXIiLCJwYXJlbnRzIiwicmVtb3ZlQ2xhc3MiLCJhZGRDbGFzcyIsInNjcm9sbFRvcCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19jb250ZW50X3Rvb2xiYXJfX25leHRfcHJpb3IiLCJzdGVwIiwial93b3JrX25hdl90YWIiLCJzdWJtZW51X3NlbGVjdGVkIiwibmV4dEFsbCIsImZpcnN0IiwicHJldkFsbCIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV93ZWVrZGF5X19hZGQiLCJjb25kaXRpb25fcnVsZV9hcnIiLCJ3ZWVrZGF5X251bSIsImRheXNfdG9fc2VsZWN0IiwiY29uZGl0aW9uX3J1bGUiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfc2Vhc29uX19hZGQiLCJzZWFzb25fZmlsdGVyX25hbWUiLCJ0ZXh0IiwiZGF5c19udW1iZXIiLCJleGlzdF9jb25maWd1cmF0aW9uIiwicmVwbGFjZUFsbCIsIml0ZW0iLCJwb3MiLCJ3cGJjX3Nob3J0Y29kZV9jb25maWdfX3N0YXJ0X2RheV9zZWFzb25fX2FkZCIsImFjdGl2YXRlZF93ZWVrZGF5cyIsIndwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV9mb3JkYXRlX19hZGQiLCJzdGFydF9kYXRlX19mb3JkYXRlIiwiZ2xvYmFsUmVnZXgiLCJSZWdFeHAiLCJpc192YWxpZF9kYXRlIiwiYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzX3RlbXAiLCJyZWFkeSIsIm9uIiwiZXZlbnQiLCJ0eXBlIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvdWlfbW9kYWxfX3Nob3J0Y29kZXMvX3NyYy93cGJjX3Nob3J0Y29kZV9wb3B1cC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE5vcm1hbGl6ZSBhIHVzZXItZW50ZXJlZCBsaXN0IG9mIHBvc2l0aXZlIElEcyBmb3IgYSB3b3JrZmxvdyBzaG9ydGNvZGUuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHJhd192YWx1ZSBDb21tYS0sIHNlbWljb2xvbi0sIG9yIHdoaXRlc3BhY2UtZGVsaW1pdGVkIElEcy5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IFVuaXF1ZSBjb21tYS1kZWxpbWl0ZWQgcG9zaXRpdmUgSURzLlxuICovXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX25vcm1hbGl6ZV93b3JrZmxvd19pZF9saXN0KCByYXdfdmFsdWUgKSB7XG4gICAgdmFyIG5vcm1hbGl6ZWRfaWRzID0gW107XG4gICAgU3RyaW5nKCByYXdfdmFsdWUgfHwgJycgKS5zcGxpdCggL1s7LFxcc10rLyApLmZvckVhY2goIGZ1bmN0aW9uICggcmF3X2lkICkge1xuICAgICAgICB2YXIgbm9ybWFsaXplZF9pZCA9IHBhcnNlSW50KCByYXdfaWQsIDEwICk7XG4gICAgICAgIGlmICggbm9ybWFsaXplZF9pZCA+IDAgJiYgLTEgPT09IG5vcm1hbGl6ZWRfaWRzLmluZGV4T2YoIG5vcm1hbGl6ZWRfaWQgKSApIHtcbiAgICAgICAgICAgIG5vcm1hbGl6ZWRfaWRzLnB1c2goIG5vcm1hbGl6ZWRfaWQgKTtcbiAgICAgICAgfVxuICAgIH0gKTtcblxuICAgIHJldHVybiBub3JtYWxpemVkX2lkcy5qb2luKCAnLCcgKTtcbn1cblxuLyoqXG4gKiBOb3JtYWxpemUgb25lIHNhZmUgcHVibGljIGNhdGFsb2cgQ1NTIHdpZHRoLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSByYXdfdmFsdWUgUmF3IHdpZHRoIGVudGVyZWQgaW4gdGhlIHNob3J0Y29kZSBidWlsZGVyLlxuICogQHJldHVybnMge3N0cmluZ30gTm9ybWFsaXplZCB3aWR0aCBvciBhbiBlbXB0eSBzdHJpbmcgZm9yIGF1dG9tYXRpYyB3aWR0aC5cbiAqL1xuZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19ub3JtYWxpemVfY3NzX3dpZHRoKCByYXdfdmFsdWUgKSB7XG4gICAgdmFyIG5vcm1hbGl6ZWRfd2lkdGggPSBTdHJpbmcoIHJhd192YWx1ZSB8fCAnJyApLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhciB3aWR0aF9tYXRjaDtcbiAgICB2YXIgbnVtZXJpY193aWR0aDtcbiAgICB2YXIgbWF4aW11bV93aWR0aDtcblxuICAgIGlmICggJycgPT09IG5vcm1hbGl6ZWRfd2lkdGggfHwgJ2F1dG8nID09PSBub3JtYWxpemVkX3dpZHRoICkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIGlmICggL15cXGQrKD86XFwuXFxkKyk/JC8udGVzdCggbm9ybWFsaXplZF93aWR0aCApICkge1xuICAgICAgICBub3JtYWxpemVkX3dpZHRoICs9ICdweCc7XG4gICAgfVxuXG4gICAgd2lkdGhfbWF0Y2ggPSAvXihcXGQrKD86XFwuXFxkKyk/KShweHwlfHJlbXxlbXx2dykkLy5leGVjKCBub3JtYWxpemVkX3dpZHRoICk7XG4gICAgaWYgKCAhIHdpZHRoX21hdGNoICkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgbnVtZXJpY193aWR0aCA9IHBhcnNlRmxvYXQoIHdpZHRoX21hdGNoWyAxIF0gKTtcbiAgICBtYXhpbXVtX3dpZHRoID0gJyUnID09PSB3aWR0aF9tYXRjaFsgMiBdIHx8ICd2dycgPT09IHdpZHRoX21hdGNoWyAyIF0gPyAxMDAgOiAoICdweCcgPT09IHdpZHRoX21hdGNoWyAyIF0gPyAyMDAwIDogMTAwICk7XG4gICAgaWYgKCBudW1lcmljX3dpZHRoIDw9IDAgfHwgbnVtZXJpY193aWR0aCA+IG1heGltdW1fd2lkdGggKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICByZXR1cm4gU3RyaW5nKCBOdW1iZXIoIG51bWVyaWNfd2lkdGgudG9GaXhlZCggNCApICkgKSArIHdpZHRoX21hdGNoWyAyIF07XG59XG5cbi8qKlxuICogTm9ybWFsaXplIG9uZSB3b3JrZmxvdyBzaG9ydGNvZGUgZmllbGQgYWNjb3JkaW5nIHRvIGl0cyBkZWNsYXJlZCB2YWx1ZSB0eXBlLlxuICpcbiAqIEBwYXJhbSB7alF1ZXJ5fSAkZmllbGQgUGFyYW1ldGVyIGNvbnRyb2wuXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBTYWZlIHZhbHVlIGZvciB0aGUgZ2VuZXJhdGVkIHNob3J0Y29kZS5cbiAqL1xuZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX19nZXRfd29ya2Zsb3dfZmllbGRfdmFsdWUoICRmaWVsZCApIHtcbiAgICB2YXIgdmFsdWVfdHlwZSA9IFN0cmluZyggJGZpZWxkLmRhdGEoICd3cGJjLXNob3J0Y29kZS12YWx1ZS10eXBlJyApIHx8ICd0ZXh0JyApO1xuICAgIHZhciByYXdfdmFsdWUgPSAkZmllbGQuaXMoICc6Y2hlY2tib3gnICkgPyAoICRmaWVsZC5pcyggJzpjaGVja2VkJyApID8gJ29uJyA6ICdvZmYnICkgOiAkZmllbGQudmFsKCk7XG4gICAgdmFyIGZpZWxkX3ZhbHVlID0gQXJyYXkuaXNBcnJheSggcmF3X3ZhbHVlICkgPyByYXdfdmFsdWUuam9pbiggJywnICkgOiBTdHJpbmcoIHJhd192YWx1ZSB8fCAnJyApLnRyaW0oKTtcbiAgICB2YXIgaXNfdmFsaWQgPSB0cnVlO1xuICAgIHZhciBtb250aF9tYXRjaDtcbiAgICB2YXIgcmF3X2Nzc193aWR0aDtcblxuICAgIGlmICggJ3Bvc2l0aXZlX2ludGVnZXInID09PSB2YWx1ZV90eXBlICkge1xuICAgICAgICBmaWVsZF92YWx1ZSA9ICcnID09PSBmaWVsZF92YWx1ZSA/ICcnIDogU3RyaW5nKCBwYXJzZUludCggZmllbGRfdmFsdWUsIDEwICkgKTtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gZmllbGRfdmFsdWUgfHwgKCAhIGlzTmFOKCBwYXJzZUludCggZmllbGRfdmFsdWUsIDEwICkgKSAmJiBwYXJzZUludCggZmllbGRfdmFsdWUsIDEwICkgPiAwICk7XG4gICAgfSBlbHNlIGlmICggJ2lkX2xpc3QnID09PSB2YWx1ZV90eXBlICkge1xuICAgICAgICBmaWVsZF92YWx1ZSA9IHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX3dvcmtmbG93X2lkX2xpc3QoIGZpZWxkX3ZhbHVlICk7XG4gICAgfSBlbHNlIGlmICggJ2Nzc193aWR0aCcgPT09IHZhbHVlX3R5cGUgKSB7XG4gICAgICAgIHJhd19jc3Nfd2lkdGggPSBmaWVsZF92YWx1ZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBmaWVsZF92YWx1ZSA9IHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbm9ybWFsaXplX2Nzc193aWR0aCggZmllbGRfdmFsdWUgKTtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gcmF3X2Nzc193aWR0aCB8fCAnYXV0bycgPT09IHJhd19jc3Nfd2lkdGggfHwgJycgIT09IGZpZWxkX3ZhbHVlO1xuICAgIH0gZWxzZSBpZiAoICdkYXRlJyA9PT0gdmFsdWVfdHlwZSApIHtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gZmllbGRfdmFsdWUgfHwgL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvLnRlc3QoIGZpZWxkX3ZhbHVlICk7XG4gICAgfSBlbHNlIGlmICggJ21vbnRoJyA9PT0gdmFsdWVfdHlwZSApIHtcbiAgICAgICAgbW9udGhfbWF0Y2ggPSAvXihcXGR7NH0pKD86LT8oXFxkezEsMn0pfFxcLyhcXGR7MSwyfSkpJC8uZXhlYyggZmllbGRfdmFsdWUgKTtcbiAgICAgICAgaXNfdmFsaWQgPSAnJyA9PT0gZmllbGRfdmFsdWUgfHwgKCBtb250aF9tYXRjaCAmJiBwYXJzZUludCggbW9udGhfbWF0Y2hbIDIgXSB8fCBtb250aF9tYXRjaFsgMyBdLCAxMCApID49IDFcbiAgICAgICAgICAgICYmIHBhcnNlSW50KCBtb250aF9tYXRjaFsgMiBdIHx8IG1vbnRoX21hdGNoWyAzIF0sIDEwICkgPD0gMTIgKTtcbiAgICB9XG5cbiAgICBpZiAoICEgaXNfdmFsaWQgKSB7XG4gICAgICAgIGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdwYmNfZmllbGRfaGlnaGxpZ2h0ICkge1xuICAgICAgICAgICAgd3BiY19maWVsZF9oaWdobGlnaHQoICcjJyArICRmaWVsZC5hdHRyKCAnaWQnICkgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZpZWxkX3ZhbHVlLnJlcGxhY2UoIC8nL2csICcnICk7XG59XG5cbi8qKlxuICogQnVpbGQgb25lIG1vZGVybiB3b3JrZmxvdyBzaG9ydGNvZGUgZnJvbSBkZWNsYXJhdGl2ZSBwb3B1cCBjb250cm9scy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc2hvcnRjb2RlX2lkIGJvb2tpbmdfYXBwb2ludG1lbnQgb3IgYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvci5cbiAqIEByZXR1cm5zIHtzdHJpbmd9IENvbXBsZXRlIHNob3J0Y29kZSB0ZXh0LlxuICovXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX2J1aWxkX3dvcmtmbG93X3Nob3J0Y29kZSggc2hvcnRjb2RlX2lkICkge1xuICAgIHZhciBzaG9ydGNvZGVfdGV4dCA9ICdbJyArIHNob3J0Y29kZV9pZDtcbiAgICB2YXIgJGNvbnRhaW5lciA9IGpRdWVyeSggJyN3cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlXycgKyBzaG9ydGNvZGVfaWQgKTtcblxuICAgICRjb250YWluZXIuZmluZCggJ1tkYXRhLXdwYmMtc2hvcnRjb2RlLXBhcmFtZXRlcl0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJGZpZWxkID0galF1ZXJ5KCB0aGlzICk7XG4gICAgICAgIHZhciBwYXJhbWV0ZXJfbmFtZSA9IFN0cmluZyggJGZpZWxkLmRhdGEoICd3cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXInICkgfHwgJycgKTtcbiAgICAgICAgdmFyIGRlZmF1bHRfdmFsdWUgPSBTdHJpbmcoICRmaWVsZC5kYXRhKCAnd3BiYy1zaG9ydGNvZGUtZGVmYXVsdCcgKSApO1xuICAgICAgICB2YXIgZmllbGRfdmFsdWUgPSB3cGJjX3Nob3J0Y29kZV9jb25maWdfX2dldF93b3JrZmxvd19maWVsZF92YWx1ZSggJGZpZWxkICk7XG5cbiAgICAgICAgaWYgKCBwYXJhbWV0ZXJfbmFtZSAmJiBmaWVsZF92YWx1ZSAhPT0gZGVmYXVsdF92YWx1ZSApIHtcbiAgICAgICAgICAgIHNob3J0Y29kZV90ZXh0ICs9ICcgJyArIHBhcmFtZXRlcl9uYW1lICsgJz1cXCcnICsgZmllbGRfdmFsdWUgKyAnXFwnJztcbiAgICAgICAgfVxuICAgIH0gKTtcblxuICAgIHJldHVybiBzaG9ydGNvZGVfdGV4dCArICddJztcbn1cblxuLyoqXG4gKiBSZXN0b3JlIG9uZSB3b3JrZmxvdyBzaG9ydGNvZGUgc2VjdGlvbiB0byBpdHMgcGFyc2VyLWJhY2tlZCBVSSBkZWZhdWx0cy5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gc2hvcnRjb2RlX2lkIGJvb2tpbmdfYXBwb2ludG1lbnQgb3IgYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvci5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3Jlc2V0X3dvcmtmbG93KCBzaG9ydGNvZGVfaWQgKSB7XG4gICAgdmFyICRjb250YWluZXIgPSBqUXVlcnkoICcjd3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZV8nICsgc2hvcnRjb2RlX2lkICk7XG5cbiAgICAkY29udGFpbmVyLmZpbmQoICdbZGF0YS13cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXJdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyICRmaWVsZCA9IGpRdWVyeSggdGhpcyApO1xuICAgICAgICB2YXIgZGVmYXVsdF92YWx1ZSA9IFN0cmluZyggJGZpZWxkLmRhdGEoICd3cGJjLXNob3J0Y29kZS1kZWZhdWx0JyApICk7XG5cbiAgICAgICAgaWYgKCAkZmllbGQuaXMoICc6Y2hlY2tib3gnICkgKSB7XG4gICAgICAgICAgICAkZmllbGQucHJvcCggJ2NoZWNrZWQnLCAnb24nID09PSBkZWZhdWx0X3ZhbHVlICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkZmllbGQudmFsKCBkZWZhdWx0X3ZhbHVlICk7XG4gICAgICAgIH1cbiAgICB9ICk7XG5cbiAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbn1cblxuLyoqXG4gKiBBcHBseSB0aGUgcmVjb21tZW5kZWQgY29tcGFjdCBwcmVzZW50YXRpb24gd2hlbiBMaXN0IHZpZXcgaXMgc2VsZWN0ZWQuXG4gKlxuICogVGhlIHByZXNldCBpcyBhcHBsaWVkIG9ubHkgaW4gdGhlIHNob3J0Y29kZSBjb25maWd1cmF0aW9uIFVJIHdoZW4gdGhlXG4gKiBSZXNvdXJjZSBsYXlvdXQgY29udHJvbCBjaGFuZ2VzIHRvIExpc3QuIEVhY2ggYWZmZWN0ZWQgY29udHJvbCByZW1haW5zXG4gKiBpbmRlcGVuZGVudGx5IGVkaXRhYmxlIGFmdGVyIHRoZSBwcmVzZXQgaXMgYXBwbGllZCwgYW5kIHNob3J0Y29kZSBwYXJzZXJcbiAqIGRlZmF1bHRzIGFyZSBub3QgY2hhbmdlZC5cbiAqXG4gKiBAcGFyYW0ge2pRdWVyeX0gJGNoYW5nZWRfZmllbGQgV29ya2Zsb3cgZmllbGQgdGhhdCB0cmlnZ2VyZWQgdGhlIGNoYW5nZS5cbiAqIEByZXR1cm5zIHt2b2lkfVxuICovXG5mdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX2FwcGx5X3Jlc291cmNlX2xpc3RfcHJlc2V0KCAkY2hhbmdlZF9maWVsZCApIHtcbiAgICB2YXIgcGFyYW1ldGVyX25hbWUgPSBTdHJpbmcoICRjaGFuZ2VkX2ZpZWxkLmRhdGEoICd3cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXInICkgfHwgJycgKTtcbiAgICB2YXIgJGNvbnRhaW5lcjtcblxuICAgIGlmICggJ2NhdGFsb2dfbGF5b3V0JyAhPT0gcGFyYW1ldGVyX25hbWUgfHwgJ2xpc3QnICE9PSBTdHJpbmcoICRjaGFuZ2VkX2ZpZWxkLnZhbCgpIHx8ICcnICkgKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAkY29udGFpbmVyID0gJGNoYW5nZWRfZmllbGQuY2xvc2VzdCggJyN3cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3InICk7XG4gICAgaWYgKCAhICRjb250YWluZXIubGVuZ3RoICkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgJGNvbnRhaW5lci5maW5kKCAnW2RhdGEtd3BiYy1zaG9ydGNvZGUtcGFyYW1ldGVyPVwic2hvd19yZXNvdXJjZV9kZXNjcmlwdGlvblwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XG4gICAgJGNvbnRhaW5lci5maW5kKCAnW2RhdGEtd3BiYy1zaG9ydGNvZGUtcGFyYW1ldGVyPVwiY2F0YWxvZ19saXN0X2l0ZW1zX3Blcl9yb3dcIl0nICkudmFsKCAnMicgKTtcbiAgICAkY29udGFpbmVyLmZpbmQoICdbZGF0YS13cGJjLXNob3J0Y29kZS1wYXJhbWV0ZXI9XCJzaG93X3Jlc291cmNlX2hpZXJhcmNoeVwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICk7XG4gICAgJGNvbnRhaW5lci5maW5kKCAnW2RhdGEtd3BiYy1zaG9ydGNvZGUtcGFyYW1ldGVyPVwic2hvd19hdmFpbGFiaWxpdHlcIl0nICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xufVxuXG4vKipcbiAqIFNob3J0Y29kZSBDb25maWcgLSBNYWluIExvb3BcbiAqL1xuZnVuY3Rpb24gd3BiY19zZXRfc2hvcnRjb2RlKCl7XG5cbiAgICBpZiAoIDAgPT09IGpRdWVyeSggJyN3cGJjX3Nob3J0Y29kZV90eXBlJyApLmxlbmd0aCApIHtcbiAgICAgICAgY29uc29sZS5sb2coICdXUEJDIDo6IEVycm9yISBFbGVtZW50ICN3cGJjX3Nob3J0Y29kZV90eXBlIG5vdCBleGlzdCEnICk7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgd3BiY19zaG9ydGNvZGUgPSAnWyc7XG4gICAgdmFyIHNob3J0Y29kZV9pZCA9IGpRdWVyeSggJyN3cGJjX3Nob3J0Y29kZV90eXBlJyApLnZhbCgpLnRyaW0oKTtcblxuICAgIGlmICggJ2Jvb2tpbmdfYXBwb2ludG1lbnQnID09PSBzaG9ydGNvZGVfaWQgfHwgJ2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3InID09PSBzaG9ydGNvZGVfaWQgKSB7XG4gICAgICAgIGpRdWVyeSggJyN3cGJjX3RleHRfcHV0X2luX3Nob3J0Y29kZScgKS52YWwoIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fYnVpbGRfd29ya2Zsb3dfc2hvcnRjb2RlKCBzaG9ydGNvZGVfaWQgKSApO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG5cbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFtib29raW5nXSAgfCBbYm9va2luZ2NhbGVuZGFyXSB8IC4uLlxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICBpZiAoXG4gICAgICAgICAgICggJ2Jvb2tpbmcnID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICB8fCAoICdib29raW5nY2FsZW5kYXInID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICB8fCAoICdib29raW5nc2VsZWN0JyA9PT0gc2hvcnRjb2RlX2lkIClcbiAgICAgICAgfHwgKCAnYm9va2luZ3RpbWVsaW5lJyA9PT0gc2hvcnRjb2RlX2lkIClcbiAgICAgICAgfHwgKCAnYm9va2luZ2Zvcm0nID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICB8fCAoICdib29raW5nc2VhcmNoJyA9PT0gc2hvcnRjb2RlX2lkIClcbiAgICAgICAgfHwgKCAnYm9va2luZ290aGVyJyA9PT0gc2hvcnRjb2RlX2lkIClcblxuICAgICAgICB8fCAoICdib29raW5nX2ltcG9ydF9pY3MnID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICB8fCAoICdib29raW5nX2xpc3RpbmdfaWNzJyA9PT0gc2hvcnRjb2RlX2lkIClcbiAgICApe1xuXG4gICAgICAgIHdwYmNfc2hvcnRjb2RlICs9IHNob3J0Y29kZV9pZDtcblxuICAgICAgICB2YXIgd3BiY19vcHRpb25zX2FyciA9IFtdO1xuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgLy8gW2Jvb2tpbmdzZWxlY3RdIHwgW2Jvb2tpbmd0aW1lbGluZV0gLSBPcHRpb25zIHJlbGF0aXZlIG9ubHkgdG8gdGhpcyBzaG9ydGNvZGUuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgKCAnYm9va2luZ3NlbGVjdCcgPT09IHNob3J0Y29kZV9pZCApXG4gICAgICAgICAgICB8fCAoICdib29raW5ndGltZWxpbmUnID09PSBzaG9ydGNvZGVfaWQgKVxuICAgICAgICApe1xuXG4gICAgICAgICAgICAvLyBbYm9va2luZ3NlbGVjdCB0eXBlPScxLDIsMyddIC0gTXVsdGlwbGUgUmVzb3VyY2VzXG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX211bHRpcGxlX3Jlc291cmNlcycgKS5sZW5ndGggPiAwICl7XG5cbiAgICAgICAgICAgICAgICB2YXIgbXVsdGlwbGVfcmVzb3VyY2VzID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzJyApLnZhbCgpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCAobXVsdGlwbGVfcmVzb3VyY2VzICE9IG51bGwpICYmIChtdWx0aXBsZV9yZXNvdXJjZXMubGVuZ3RoID4gMCkgKXtcblxuICAgICAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZW1wdHkgc3BhY2VzIGZyb20gIGFycmF5IDogJycgfCBcIlwiIHwgMFxuICAgICAgICAgICAgICAgICAgICBtdWx0aXBsZV9yZXNvdXJjZXMgPSBtdWx0aXBsZV9yZXNvdXJjZXMuZmlsdGVyKGZ1bmN0aW9uKG4pe3JldHVybiBwYXJzZUludChuKTsgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbXVsdGlwbGVfcmVzb3VyY2VzID0gbXVsdGlwbGVfcmVzb3VyY2VzLmpvaW4oICcsJyApLnRyaW0oKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIG11bHRpcGxlX3Jlc291cmNlcyAhPSAwICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHR5cGU9XFwnJyArIG11bHRpcGxlX3Jlc291cmNlcyArICdcXCcnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBbYm9va2luZ3NlbGVjdCBzZWxlY3RlZF90eXBlPTFdIC0gU2VsZWN0ZWQgUmVzb3VyY2VcbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VsZWN0ZWRfcmVzb3VyY2UnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWxlY3RlZF9yZXNvdXJjZScgKS52YWwoKSAhPT0gbnVsbCApICAgICAgICAgICAgICAgICAgICAgIC8vIEZpeEluOiA4LjIuMS4xMi5cbiAgICAgICAgICAgICAgICAgICAgJiYgKCBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VsZWN0ZWRfcmVzb3VyY2UnICkudmFsKCkgKSA+IDAgKVxuICAgICAgICAgICAgICAgICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2VsZWN0ZWRfdHlwZT0nICsgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VsZWN0ZWRfcmVzb3VyY2UnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gW2Jvb2tpbmdzZWxlY3QgbGFiZWw9J1RhZGEnXSAtIExhYmVsXG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3RleHRfbGFiZWwnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgIGlmICggJycgIT09IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3RleHRfbGFiZWwnICkudmFsKCkudHJpbSgpICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgbGFiZWw9XFwnJyArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3RleHRfbGFiZWwnICkudmFsKCkudHJpbSgpLnJlcGxhY2UoIC8nL2dpLCAnJyApICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBbYm9va2luZ3NlbGVjdCBmaXJzdF9vcHRpb25fdGl0bGU9J1RhZGEnXSAtIEZpcnN0ICBPcHRpb25cbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfZmlyc3Rfb3B0aW9uX3RpdGxlJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICBpZiAoICcnICE9PSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19maXJzdF9vcHRpb25fdGl0bGUnICkudmFsKCkudHJpbSgpICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgZmlyc3Rfb3B0aW9uX3RpdGxlPVxcJycgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19maXJzdF9vcHRpb25fdGl0bGUnICkudmFsKCkudHJpbSgpLnJlcGxhY2UoIC8nL2dpLCAnJyApICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIC8vIFtib29raW5ndGltZWxpbmVdIC0gT3B0aW9ucyByZWxhdGl2ZSBvbmx5IHRvIHRoaXMgc2hvcnRjb2RlLlxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIGlmICggJ2Jvb2tpbmd0aW1lbGluZScgPT09IHNob3J0Y29kZV9pZCApe1xuICAgICAgICAgICAgLy8gVmlzdWFsbHkgdXBkYXRlXG4gICAgICAgICAgICB2YXIgd3BiY19pc19tYXRyaXhfX3ZpZXdfZGF5c19udW1fdGVtcCA9IHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fdXBkYXRlX2VsZW1lbnRzX2luX3RpbWVsaW5lKCk7XG4gICAgICAgICAgICB2YXIgd3BiY19pc19tYXRyaXggPSB3cGJjX2lzX21hdHJpeF9fdmlld19kYXlzX251bV90ZW1wWyAwIF07XG4gICAgICAgICAgICB2YXIgdmlld19kYXlzX251bV90ZW1wID0gd3BiY19pc19tYXRyaXhfX3ZpZXdfZGF5c19udW1fdGVtcFsgMSBdO1xuXG4gICAgICAgICAgICAvLyA6IHZpZXdfZGF5c19udW1cbiAgICAgICAgICAgIGlmICggdmlld19kYXlzX251bV90ZW1wICE9IDMwICl7XG4gICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyB2aWV3X2RheXNfbnVtPScgKyB2aWV3X2RheXNfbnVtX3RlbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyA6IGhlYWRlcl90aXRsZVxuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY190ZXh0X2xhYmVsX3RpbWVsaW5lJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICB2YXIgaGVhZGVyX3RpdGxlX3RlbXAgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY190ZXh0X2xhYmVsX3RpbWVsaW5lJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBoZWFkZXJfdGl0bGVfdGVtcCA9IGhlYWRlcl90aXRsZV90ZW1wLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgIGlmICggaGVhZGVyX3RpdGxlX3RlbXAgIT0gJycgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBoZWFkZXJfdGl0bGU9XFwnJyArIGhlYWRlcl90aXRsZV90ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gOiBzY3JvbGxfbW9udGhcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAoICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2Nyb2xsX3RpbWVsaW5lX3Njcm9sbF9tb250aCcgKS5pcyggJzp2aXNpYmxlJyApKVxuICAgICAgICAgICAgICAgICYmICggICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX21vbnRoJyApLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgJiYgKHBhcnNlSW50KCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX21vbnRoJyApLnZhbCgpLnRyaW0oKSApICE9PSAwKVxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHNjcm9sbF9tb250aD0nICsgcGFyc2VJbnQoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfbW9udGgnICkudmFsKCkudHJpbSgpICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyA6IHNjcm9sbF9kYXlcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAoICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2Nyb2xsX3RpbWVsaW5lX3Njcm9sbF9kYXlzJyApLmlzKCAnOnZpc2libGUnICkpXG4gICAgICAgICAgICAgICAgJiYgKCAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfZGF5cycgKS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgICYmIChwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2Nyb2xsX3RpbWVsaW5lX3Njcm9sbF9kYXlzJyApLnZhbCgpLnRyaW0oKSApICE9PSAwKVxuICAgICAgICAgICAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHNjcm9sbF9kYXk9JyArIHBhcnNlSW50KCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX2RheXMnICkudmFsKCkudHJpbSgpICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIDpsaW1pdF9ob3Vyc1xuICAgICAgICAgICAgLy8gRml4SW46IDcuMC4xLjE3LlxuICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmd0aW1lbGluZV92aWV3X3RpbWVzJyApLmhpZGUoKTtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAoICggd3BiY19pc19tYXRyaXggKSAmJiAoIHZpZXdfZGF5c19udW1fdGVtcCA9PSAxICkgKVxuICAgICAgICAgICAgICAgIHx8ICggKCAhIHdwYmNfaXNfbWF0cml4ICkgJiYgKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gMzAgKSApXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ3RpbWVsaW5lX3ZpZXdfdGltZXMnICkuc2hvdygpO1xuICAgICAgICAgICAgICAgIHZhciB2aWV3X3RpbWVzX3N0YXJ0X3RlbXAgPSBwYXJzZUludCggalF1ZXJ5KCAnI2Jvb2tpbmd0aW1lbGluZV93cGJjX3N0YXJ0X2VuZF90aW1lX3RpbWVsaW5lX3N0YXJ0dGltZScgKS52YWwoKS50cmltKCkgKTtcbiAgICAgICAgICAgICAgICB2YXIgdmlld190aW1lc19lbmRfdGVtcCA9IHBhcnNlSW50KCBqUXVlcnkoICcjYm9va2luZ3RpbWVsaW5lX3dwYmNfc3RhcnRfZW5kX3RpbWVfdGltZWxpbmVfZW5kdGltZScgKS52YWwoKS50cmltKCkgKTtcbiAgICAgICAgICAgICAgICBpZiAoICh2aWV3X3RpbWVzX3N0YXJ0X3RlbXAgIT0gMCkgfHwgKHZpZXdfdGltZXNfZW5kX3RlbXAgIT0gMjQpICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgbGltaXRfaG91cnM9XFwnJyArIHZpZXdfdGltZXNfc3RhcnRfdGVtcCArICcsJyArIHZpZXdfdGltZXNfZW5kX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIDpzY3JvbGxfc3RhcnRfZGF0ZVxuICAgICAgICAgICAgaWYgKCAgKCBqUXVlcnkoJyNib29raW5ndGltZWxpbmVfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX2FjdGl2ZScpLmlzKCc6Y2hlY2tlZCcpICkgICYmICggalF1ZXJ5KCAnI2Jvb2tpbmd0aW1lbGluZV93cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfYWN0aXZlJyApLmxlbmd0aCA+IDAgKSAgKSB7XG4gICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2Nyb2xsX3N0YXJ0X2RhdGU9XFwnJyArIGpRdWVyeSggJyNib29raW5ndGltZWxpbmVfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX3llYXInICkudmFsKCkudHJpbSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgJy0nICsgalF1ZXJ5KCAnI2Jvb2tpbmd0aW1lbGluZV93cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfbW9udGgnICkudmFsKCkudHJpbSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgJy0nICsgalF1ZXJ5KCAnI2Jvb2tpbmd0aW1lbGluZV93cGJjX3N0YXJ0X2RhdGVfdGltZWxpbmVfZGF5JyApLnZhbCgpLnRyaW0oKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICsgJ1xcJyc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgLy8gW2Jvb2tpbmdmb3JtICBdIC0gRm9ybSBPbmx5ICAgICAgICAtICAgICBbYm9va2luZ2Zvcm0gdHlwZT0xIHNlbGVjdGVkX2RhdGVzPScwMS4wMy4yMDI0J11cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBpZiAoICdib29raW5nZm9ybScgPT09IHNob3J0Y29kZV9pZCApe1xuXG4gICAgICAgICAgICB2YXIgd3BiY19zZWxlY3RlZF9kYXkgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19ib29raW5nX2RhdGVfZGF5JyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICggcGFyc2VJbnQod3BiY19zZWxlY3RlZF9kYXkpIDwgMTAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3NlbGVjdGVkX2RheSA9ICcwJyArIHdwYmNfc2VsZWN0ZWRfZGF5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHdwYmNfc2VsZWN0ZWRfbW9udGggPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19ib29raW5nX2RhdGVfbW9udGgnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCBwYXJzZUludCh3cGJjX3NlbGVjdGVkX21vbnRoKSA8IDEwICl7XG4gICAgICAgICAgICAgICAgd3BiY19zZWxlY3RlZF9tb250aCA9ICcwJyArIHdwYmNfc2VsZWN0ZWRfbW9udGg7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHNlbGVjdGVkX2RhdGVzPVxcJycgKyB3cGJjX3NlbGVjdGVkX2RheSArICcuJyArIHdwYmNfc2VsZWN0ZWRfbW9udGggKyAnLicgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19ib29raW5nX2RhdGVfeWVhcicgKS52YWwoKS50cmltKCkgKyAnXFwnJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgLy8gW2Jvb2tpbmdzZWFyY2ggIF0gLSBPcHRpb25zIHJlbGF0aXZlIG9ubHkgdG8gdGhpcyBzaG9ydGNvZGUuICAgICBbYm9va2luZ3NlYXJjaCBzZWFyY2hyZXN1bHRzdGl0bGU9J3tzZWFyY2hyZXN1bHRzfSBSZXN1bHQocykgRm91bmQnIG5vcmVzdWx0c3RpdGxlPSdOb3RoaW5nIEZvdW5kJ11cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICBpZiAoICdib29raW5nc2VhcmNoJyA9PT0gc2hvcnRjb2RlX2lkICl7XG5cbiAgICAgICAgICAgIC8vIENoZWNrICBpZiB3ZSBzZWxlY3RlZCAnYm9va2luZ3NlYXJjaCcgfCAnYm9va2luZ3NlYXJjaHJlc3VsdHMnXG4gICAgICAgICAgICB2YXIgd3BiY19zZWFyY2hfZm9ybV9yZXN1bHRzID0gJ2Jvb2tpbmdzZWFyY2gnO1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3NlYXJjaF93cGJjX3NlYXJjaF9mb3JtX3Jlc3VsdHMnXTpjaGVja2VkXCIgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgd3BiY19zZWFyY2hfZm9ybV9yZXN1bHRzID0galF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmdzZWFyY2hfd3BiY19zZWFyY2hfZm9ybV9yZXN1bHRzJ106Y2hlY2tlZFwiICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTaG93IHwgSGlkZSBmb3JtICBmaWVsZHMgZm9yICdib29raW5nc2VhcmNoJyBkZXBlbmRzIGZyb20gIHJhZGlvICBidXRpb24gIHNlbGVjdGlvblxuICAgICAgICAgICAgaWYgKCAnYm9va2luZ3NlYXJjaHJlc3VsdHMnID09PSB3cGJjX3NlYXJjaF9mb3JtX3Jlc3VsdHMgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSA9ICdbYm9va2luZ3NlYXJjaHJlc3VsdHMnO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy53cGJjX3NlYXJjaF9hdmFpbGFiaWxpdHlfZm9ybScgKS5oaWRlKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy53cGJjX3NlYXJjaF9hdmFpbGFiaWxpdHlfZm9ybScgKS5zaG93KCk7XG5cblxuICAgICAgICAgICAgICAgIC8vIE5ldyBwYWdlIGZvciBzZWFyY2ggcmVzdWx0c1xuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgKGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9uZXdfcGFnZV9lbmFibGVkJyApLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgICAgICYmIChqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWFyY2hfbmV3X3BhZ2VfZW5hYmxlZCcgKS5pcyggJzpjaGVja2VkJyApKVxuICAgICAgICAgICAgICAgICl7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNob3dcbiAgICAgICAgICAgICAgICAgICAgalF1ZXJ5KCAnLicgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfc2VhcmNoX25ld19wYWdlX3dwYmNfc2Nfc2VhcmNocmVzdWx0c19uZXdfcGFnZScgKS5zaG93KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gOiBTZWFyY2ggUmVzdWx0cyBVUkxcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWFyY2hfbmV3X3BhZ2VfdXJsJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzZWFyY2hfcmVzdWx0c191cmxfdGVtcCA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9uZXdfcGFnZV91cmwnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VhcmNoX3Jlc3VsdHNfdXJsX3RlbXAgPSBzZWFyY2hfcmVzdWx0c191cmxfdGVtcC5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggc2VhcmNoX3Jlc3VsdHNfdXJsX3RlbXAgIT0gJycgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHNlYXJjaHJlc3VsdHM9XFwnJyArIHNlYXJjaF9yZXN1bHRzX3VybF90ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBIaWRlXG4gICAgICAgICAgICAgICAgICAgIGpRdWVyeSggJy4nICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9uZXdfcGFnZV93cGJjX3NjX3NlYXJjaHJlc3VsdHNfbmV3X3BhZ2UnICkuaGlkZSgpO1xuICAgICAgICAgICAgICAgIH1cblxuLyogICAgICAgICAgICAgIC8vIEZpeEluOiAxMC4wLjAuNDEuXG4gICAgICAgICAgICAgICAgLy8gOiBTZWFyY2ggSGVhZGVyXG4gICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWFyY2hfaGVhZGVyJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlYXJjaF9oZWFkZXJfdGVtcCA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9oZWFkZXInICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBzZWFyY2hfaGVhZGVyX3RlbXAgPSBzZWFyY2hfaGVhZGVyX3RlbXAucmVwbGFjZSggLycvZ2ksICcnICk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggc2VhcmNoX2hlYWRlcl90ZW1wICE9ICcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHNlYXJjaHJlc3VsdHN0aXRsZT1cXCcnICsgc2VhcmNoX2hlYWRlcl90ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gOiBOb3RoaW5nIEZvdW5kXG4gICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zZWFyY2hfbm90aGluZ19mb3VuZCcgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgICAgIHZhciBub3RoaW5nZm91bmRfdGVtcCA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9ub3RoaW5nX2ZvdW5kJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAgICAgbm90aGluZ2ZvdW5kX3RlbXAgPSBub3RoaW5nZm91bmRfdGVtcC5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBub3RoaW5nZm91bmRfdGVtcCAhPSAnJyApe1xuICAgICAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBub3Jlc3VsdHN0aXRsZT1cXCcnICsgbm90aGluZ2ZvdW5kX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiovXG4gICAgICAgICAgICAgICAgLy8gOiBVc2VycyAgICAgIC8vIFtib29raW5nc2VhcmNoIHNlYXJjaHJlc3VsdHN0aXRsZT0ne3NlYXJjaHJlc3VsdHN9IFJlc3VsdChzKSBGb3VuZCcgbm9yZXN1bHRzdGl0bGU9J05vdGhpbmcgRm91bmQnIHVzZXJzPSczLDQ1NDMsJ11cbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9mb3JfdXNlcnMnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB2YXIgb25seV9mb3JfdXNlcnNfdGVtcCA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NlYXJjaF9mb3JfdXNlcnMnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBvbmx5X2Zvcl91c2Vyc190ZW1wID0gb25seV9mb3JfdXNlcnNfdGVtcC5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBvbmx5X2Zvcl91c2Vyc190ZW1wICE9ICcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHVzZXJzPVxcJycgKyBvbmx5X2Zvcl91c2Vyc190ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAvLyBbYm9va2luZ2VkaXRdICwgW2Jvb2tpbmdjdXN0b21lcmxpc3RpbmddICwgW2Jvb2tpbmdyZXNvdXJjZSB0eXBlPTYgc2hvdz0nY2FwYWNpdHknXSAsIFtib29raW5nX2NvbmZpcm1dXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgaWYgKCAnYm9va2luZ290aGVyJyA9PT0gc2hvcnRjb2RlX2lkICl7XG5cbiAgICAgICAgICAgIC8vVFJJQ0s6XG4gICAgICAgICAgICBzaG9ydGNvZGVfaWQgPSAnbm8nOyAgLy9yZXF1aXJlZCBmb3Igbm90IHVwZGF0ZSBib29raW5nIHJlc291cmNlIElEXG5cbiAgICAgICAgICAgIC8vIENoZWNrICBpZiB3ZSBzZWxlY3RlZCAnYm9va2luZ3NlYXJjaCcgfCAnYm9va2luZ3NlYXJjaHJlc3VsdHMnXG4gICAgICAgICAgICB2YXIgYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlID0gJ2Jvb2tpbmdzZWFyY2gnO1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ290aGVyX3dwYmNfc2hvcnRjb2RlX3R5cGUnXTpjaGVja2VkXCIgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlID0galF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmdvdGhlcl93cGJjX3Nob3J0Y29kZV90eXBlJ106Y2hlY2tlZFwiICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTaG93IHwgSGlkZSBzZWN0aW9uc1xuICAgICAgICAgICAgaWYgKCAnYm9va2luZ19jb25maXJtJyA9PT0gYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlICl7XG4gICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgPSAnW2Jvb2tpbmdfY29uZmlybSc7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdvdGhlcl9zZWN0aW9uX2FkZGl0aW9uYWwnICkuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy5ib29raW5nb3RoZXJfc2VjdGlvbl8nICsgYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlICkuc2hvdygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCAnYm9va2luZ2VkaXQnID09PSBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSA9ICdbYm9va2luZ2VkaXQnO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy5ib29raW5nb3RoZXJfc2VjdGlvbl9hZGRpdGlvbmFsJyApLmhpZGUoKTtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ290aGVyX3NlY3Rpb25fJyArIGJvb2tpbmdvdGhlcl9zaG9ydGNvZGVfdHlwZSApLnNob3coKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICggJ2Jvb2tpbmdjdXN0b21lcmxpc3RpbmcnID09PSBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgKXtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSA9ICdbYm9va2luZ2N1c3RvbWVybGlzdGluZyc7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdvdGhlcl9zZWN0aW9uX2FkZGl0aW9uYWwnICkuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy5ib29raW5nb3RoZXJfc2VjdGlvbl8nICsgYm9va2luZ290aGVyX3Nob3J0Y29kZV90eXBlICkuc2hvdygpO1xuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoICdib29raW5ncmVzb3VyY2UnID09PSBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgKXtcblxuICAgICAgICAgICAgICAgIC8vVFJJQ0s6XG4gICAgICAgICAgICAgICAgc2hvcnRjb2RlX2lkID0gJ2Jvb2tpbmdvdGhlcic7ICAvL3JlcXVpcmVkIHRvIGZvcmNlIHVwZGF0ZSBib29raW5nIHJlc291cmNlIElEXG5cbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSA9ICdbYm9va2luZ3Jlc291cmNlJztcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcuYm9va2luZ290aGVyX3NlY3Rpb25fYWRkaXRpb25hbCcgKS5oaWRlKCk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdvdGhlcl9zZWN0aW9uXycgKyBib29raW5nb3RoZXJfc2hvcnRjb2RlX3R5cGUgKS5zaG93KCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyNib29raW5nb3RoZXJfd3BiY19yZXNvdXJjZV9zaG93JyApLnZhbCgpLnRyaW0oKSAhPSAndGl0bGUnICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2hvdz1cXCcnICsgalF1ZXJ5KCAnI2Jvb2tpbmdvdGhlcl93cGJjX3Jlc291cmNlX3Nob3cnICkudmFsKCkudHJpbSgpICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gW2Jvb2tpbmctbWFuYWdlci1pbXBvcnQgLi4uXSAgICAgfHwgICAgICBbYm9va2luZy1tYW5hZ2VyLWxpc3RpbmcgLi4uXVxuICAgICAgICBpZiAoICgnYm9va2luZ19pbXBvcnRfaWNzJyA9PT0gc2hvcnRjb2RlX2lkKSB8fCAoJ2Jvb2tpbmdfbGlzdGluZ19pY3MnID09PSBzaG9ydGNvZGVfaWQpICl7XG5cbiAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlID0gJ1tib29raW5nLW1hbmFnZXItaW1wb3J0JztcblxuICAgICAgICAgICAgaWYgKCAnYm9va2luZ19saXN0aW5nX2ljcycgPT09IHNob3J0Y29kZV9pZCApe1xuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlID0gJ1tib29raW5nLW1hbmFnZXItbGlzdGluZyc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgIC8vIDogLmljcyBmZWVkIFVSTFxuICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgdmFyIHNob3J0Y29kZV91cmxfdGVtcCA9ICcnXG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3VybCcgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgc2hvcnRjb2RlX3VybF90ZW1wID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfdXJsJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICBzaG9ydGNvZGVfdXJsX3RlbXAgPSBzaG9ydGNvZGVfdXJsX3RlbXAucmVwbGFjZSggLycvZ2ksICcnICk7XG4gICAgICAgICAgICAgICAgaWYgKCBzaG9ydGNvZGVfdXJsX3RlbXAgIT0gJycgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyB1cmw9XFwnJyArIHNob3J0Y29kZV91cmxfdGVtcCArICdcXCcnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBpZiAoIHNob3J0Y29kZV91cmxfdGVtcCA9PSAnJyApe1xuICAgICAgICAgICAgICAgIC8vIEVycm9yOlxuICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlID0gJ1sgVVJMIGlzIHJlcXVpcmVkICdcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBWQUxJRDpcblxuICAgICAgICAgICAgICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgICAgICAvLyBbLi4uIGZyb209JycgJ2Zyb21fb2Zmc2V0PScnICAuLi5dXG4gICAgICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX2Zyb20nICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB2YXIgcF9mcm9tICAgICAgICAgID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX2Zyb20nICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcF9mcm9tX29mZnNldCAgID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX2Zyb21fb2Zmc2V0JyApLnZhbCgpLnRyaW0oKTtcblxuICAgICAgICAgICAgICAgICAgICBwX2Zyb20gICAgICAgID0gcF9mcm9tLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgICAgICBwX2Zyb21fb2Zmc2V0ID0gcF9mcm9tX29mZnNldC5yZXBsYWNlKCAvJy9naSwgJycgKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoICgnJyAhPSBwX2Zyb20pICYmICgnZGF0ZScgIT0gcF9mcm9tKSApeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gT2Zmc2V0XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgZnJvbT1cXCcnICsgcF9mcm9tICsgJ1xcJyc7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICggKCdhbnknICE9IHBfZnJvbSkgJiYgKCcnICE9IHBfZnJvbV9vZmZzZXQpICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcF9mcm9tX29mZnNldCA9IHBhcnNlSW50KCBwX2Zyb21fb2Zmc2V0ICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCAhaXNOYU4oIHBfZnJvbV9vZmZzZXQgKSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIGZyb21fb2Zmc2V0PVxcJycgKyBwX2Zyb21fb2Zmc2V0ICsgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX2Zyb21fb2Zmc2V0X3R5cGUnICkudmFsKCkudHJpbSgpLmNoYXJBdCggMCApICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIChwX2Zyb20gPT0gJ2RhdGUnKSAmJiAocF9mcm9tX29mZnNldCAhPSAnJykgKXtcdFx0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWYgc2VsZWN0ZWQgRGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBmcm9tPVxcJycgKyBwX2Zyb21fb2Zmc2V0ICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAgICAgLy8gWy4uLiB1bnRpbD0nJyAndW50aWxfb2Zmc2V0PScnICAuLi5dXG4gICAgICAgICAgICAgICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgICAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3VudGlsJyApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHBfdW50aWwgICAgICAgICAgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfdW50aWwnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICB2YXIgcF91bnRpbF9vZmZzZXQgICA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ191bnRpbF9vZmZzZXQnICkudmFsKCkudHJpbSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHBfdW50aWwgICAgICAgID0gcF91bnRpbC5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICAgICAgcF91bnRpbF9vZmZzZXQgPSBwX3VudGlsX29mZnNldC5yZXBsYWNlKCAvJy9naSwgJycgKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoICgnJyAhPSBwX3VudGlsKSAmJiAoJ2RhdGUnICE9IHBfdW50aWwpICl7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBPZmZzZXRcblxuICAgICAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyB1bnRpbD1cXCcnICsgcF91bnRpbCArICdcXCcnO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoICgnYW55JyAhPSBwX3VudGlsKSAmJiAoJycgIT0gcF91bnRpbF9vZmZzZXQpICl7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcF91bnRpbF9vZmZzZXQgPSBwYXJzZUludCggcF91bnRpbF9vZmZzZXQgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoICFpc05hTiggcF91bnRpbF9vZmZzZXQgKSApe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHVudGlsX29mZnNldD1cXCcnICsgcF91bnRpbF9vZmZzZXQgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfdW50aWxfb2Zmc2V0X3R5cGUnICkudmFsKCkudHJpbSgpLmNoYXJBdCggMCApICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIChwX3VudGlsID09ICdkYXRlJykgJiYgKHBfdW50aWxfb2Zmc2V0ICE9ICcnKSApe1x0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBzZWxlY3RlZCBEYXRlXG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHVudGlsPVxcJycgKyBwX3VudGlsX29mZnNldCArICdcXCcnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG5cdFx0XHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHRcdFx0Ly8gTWF4XG5cdFx0XHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ19jb25kaXRpb25zX21heF9udW0nICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB2YXIgcF9tYXggPSBwYXJzZUludCggalF1ZXJ5KCAgJyMnICsgc2hvcnRjb2RlX2lkICsgJ19jb25kaXRpb25zX21heF9udW0nICkudmFsKCkudHJpbSgpICk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggcF9tYXggIT0gMCApe1xuICAgICAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBtYXg9JyArIHBfbWF4O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG5cdFx0XHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblx0XHRcdFx0Ly8gU2lsZW5jZVxuXHRcdFx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfc2lsZW5jZScgKS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgICAgIGlmICggJzEnID09PSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfc2lsZW5jZScgKS52YWwoKS50cmltKCkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgc2lsZW5jZT0xJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuXHRcdFx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cdFx0XHRcdC8vIGlzX2FsbF9kYXRlc19pblxuXHRcdFx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfY29uZGl0aW9uc19ldmVudHMnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB2YXIgcF9pc19hbGxfZGF0ZXNfaW4gPSBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX2NvbmRpdGlvbnNfZXZlbnRzJyAgKS52YWwoKS50cmltKCkgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBwX2lzX2FsbF9kYXRlc19pbiAhPSAwICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIGlzX2FsbF9kYXRlc19pbj0nICsgcF9pc19hbGxfZGF0ZXNfaW47XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cblx0XHRcdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXHRcdFx0XHQvLyBpbXBvcnRfY29uZGl0aW9uc1xuXHRcdFx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfY29uZGl0aW9uc19pbXBvcnQnICkubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgICAgICB2YXIgcF9pbXBvcnRfY29uZGl0aW9ucyA9IGpRdWVyeSggICcjJyArIHNob3J0Y29kZV9pZCArICdfY29uZGl0aW9uc19pbXBvcnQnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgICAgICAgICBwX2ltcG9ydF9jb25kaXRpb25zID0gcF9pbXBvcnRfY29uZGl0aW9ucy5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCBwX2ltcG9ydF9jb25kaXRpb25zICE9ICcnICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIGltcG9ydF9jb25kaXRpb25zPVxcJycgKyBwX2ltcG9ydF9jb25kaXRpb25zICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAvLyBbYm9va2luZ10gLCBbYm9va2luZ2NhbGVuZGFyXSAsIC4uLiAgcGFyYW1ldGVycyBmb3IgdGhlc2Ugc2hvcnRjb2RlcyBhbmQgb3RoZXJzLi4uXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19yZXNvdXJjZV9pZCcgKS5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19yZXNvdXJjZV9pZCcgKS52YWwoKSA9PT0gbnVsbCApIHtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDguMi4xLjEyLlxuICAgICAgICAgICAgICAgIGpRdWVyeSggJyN3cGJjX3RleHRfcHV0X2luX3Nob3J0Y29kZScgKS52YWwoICctLS0nICk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHJlc291cmNlX2lkPScgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19yZXNvdXJjZV9pZCcgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jdXN0b21fZm9ybScgKS5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgdmFyIGZvcm1fdHlwZV90ZW1wID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfY3VzdG9tX2Zvcm0nICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCBmb3JtX3R5cGVfdGVtcCAhPSAnc3RhbmRhcmQnIClcbiAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIGZvcm1fdHlwZT1cXCcnICsgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfY3VzdG9tX2Zvcm0nICkudmFsKCkudHJpbSgpICsgJ1xcJyc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfbnVtbW9udGhzJyApLmxlbmd0aCA+IDAgKVxuICAgICAgICAgICAgICYmICggcGFyc2VJbnQoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX251bW1vbnRocycgKS52YWwoKS50cmltKCkgKSA+IDEgKVxuICAgICAgICApe1xuICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBudW1tb250aHM9JyArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX251bW1vbnRocycgKS52YWwoKS50cmltKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgKCAnYm9va2luZycgPT09IHNob3J0Y29kZV9pZCApXG4gICAgICAgICAgICAgJiYgKCBqUXVlcnkoICcjYm9va2luZ193cGJjX3BvcHVwX2VuYWJsZWQnICkubGVuZ3RoID4gMCApXG4gICAgICAgICl7XG4gICAgICAgICAgICBpZiAoIGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfZW5hYmxlZCcgKS5pcyggJzpjaGVja2VkJyApICl7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdfd3BiY19wb3B1cF93cGJjX3NjX2Jvb2tpbmdfcG9wdXAnICkuc2hvdygpO1xuXG4gICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBwb3B1cD0xJztcblxuICAgICAgICAgICAgICAgIHZhciBwb3B1cF9idXR0b25fdGl0bGVfZGVmYXVsdCA9IGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfYnV0dG9uX3RpdGxlJyApLmF0dHIoICdwbGFjZWhvbGRlcicgKTtcbiAgICAgICAgICAgICAgICB2YXIgcG9wdXBfYnV0dG9uX3RpdGxlX3RlbXAgPSBqUXVlcnkoICcjYm9va2luZ193cGJjX3BvcHVwX2J1dHRvbl90aXRsZScgKS52YWwoKS50cmltKCkucmVwbGFjZSggLycvZ2ksICcnICk7XG4gICAgICAgICAgICAgICAgaWYgKCAoIHBvcHVwX2J1dHRvbl90aXRsZV90ZW1wICE9ICcnICkgJiYgKCBwb3B1cF9idXR0b25fdGl0bGVfdGVtcCAhPSBwb3B1cF9idXR0b25fdGl0bGVfZGVmYXVsdCApICl7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgcG9wdXBfYnV0dG9uX3RpdGxlPVxcJycgKyBwb3B1cF9idXR0b25fdGl0bGVfdGVtcCArICdcXCcnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBwb3B1cF90aXRsZV9kZWZhdWx0ID0galF1ZXJ5KCAnI2Jvb2tpbmdfd3BiY19wb3B1cF90aXRsZScgKS5hdHRyKCAncGxhY2Vob2xkZXInICk7XG4gICAgICAgICAgICAgICAgdmFyIHBvcHVwX3RpdGxlX3RlbXAgPSBqUXVlcnkoICcjYm9va2luZ193cGJjX3BvcHVwX3RpdGxlJyApLnZhbCgpLnRyaW0oKS5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICBpZiAoICggcG9wdXBfdGl0bGVfdGVtcCAhPSAnJyApICYmICggcG9wdXBfdGl0bGVfdGVtcCAhPSBwb3B1cF90aXRsZV9kZWZhdWx0ICkgKXtcbiAgICAgICAgICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBwb3B1cF90aXRsZT1cXCcnICsgcG9wdXBfdGl0bGVfdGVtcCArICdcXCcnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHZhciBwb3B1cF9idXR0b25fY2xhc3NfdGVtcCA9IGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfYnV0dG9uX2NsYXNzJyApLnZhbCgpLnRyaW0oKS5yZXBsYWNlKCAvJy9naSwgJycgKTtcbiAgICAgICAgICAgICAgICBpZiAoICggcG9wdXBfYnV0dG9uX2NsYXNzX3RlbXAgIT0gJycgKSAmJiAoIHBvcHVwX2J1dHRvbl9jbGFzc190ZW1wICE9ICd3cC1lbGVtZW50LWJ1dHRvbicgKSApe1xuICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHBvcHVwX2J1dHRvbl9jbGFzcz1cXCcnICsgcG9wdXBfYnV0dG9uX2NsYXNzX3RlbXAgKyAnXFwnJztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB2YXIgcG9wdXBfbW9kYWxfY2xhc3NfdGVtcCA9IGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfbW9kYWxfY2xhc3MnICkudmFsKCkudHJpbSgpLnJlcGxhY2UoIC8nL2dpLCAnJyApO1xuICAgICAgICAgICAgICAgIGlmICggcG9wdXBfbW9kYWxfY2xhc3NfdGVtcCAhPSAnJyApe1xuICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHBvcHVwX21vZGFsX2NsYXNzPVxcJycgKyBwb3B1cF9tb2RhbF9jbGFzc190ZW1wICsgJ1xcJyc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdmFyIHBvcHVwX3NpemVfdGVtcCA9IGpRdWVyeSggJyNib29raW5nX3dwYmNfcG9wdXBfc2l6ZScgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICAgICAgaWYgKCBwb3B1cF9zaXplX3RlbXAgIT0gJ2xnJyApe1xuICAgICAgICAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHBvcHVwX3NpemU9XFwnJyArIHBvcHVwX3NpemVfdGVtcCArICdcXCcnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLmJvb2tpbmdfd3BiY19wb3B1cF93cGJjX3NjX2Jvb2tpbmdfcG9wdXAnICkuaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICggalF1ZXJ5KCcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zdGFydG1vbnRoX2FjdGl2ZScpLmxlbmd0aCA+IDAgKVxuICAgICAgICAgICAgICYmICggalF1ZXJ5KCcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zdGFydG1vbnRoX2FjdGl2ZScpLmlzKCc6Y2hlY2tlZCcpIClcbiAgICAgICAgKXtcbiAgICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIHN0YXJ0bW9udGg9XFwnJyArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3N0YXJ0bW9udGhfeWVhcicgKS52YWwoKS50cmltKCkgKyAnLScgKyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zdGFydG1vbnRoX21vbnRoJyApLnZhbCgpLnRyaW0oKSArICdcXCcnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICggalF1ZXJ5KCcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF9hY3RpdmUnKS5sZW5ndGggPiAwIClcbiAgICAgICAgICAgICAmJiAoIGpRdWVyeSgnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfc3RhcnRfYWN0aXZlJykuaXMoJzpjaGVja2VkJykgKVxuICAgICAgICApe1xuICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgY2FsZW5kYXJfZGF0ZXNfc3RhcnQ9XFwnJyArXG5cdFx0XHRcdCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF95ZWFyJyApLnZhbCgpLnRyaW0oKSArICctJyArXG5cdFx0XHRcdCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF9tb250aCcgKS52YWwoKS50cmltKCkgKyAgJy0nICtcblx0XHRcdFx0IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX3N0YXJ0X2RhdGUnICkudmFsKCkudHJpbSgpICtcblx0XHRcdFx0ICdcXCcnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICggalF1ZXJ5KCcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfYWN0aXZlJykubGVuZ3RoID4gMCApXG4gICAgICAgICAgICAgJiYgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX2VuZF9hY3RpdmUnKS5pcygnOmNoZWNrZWQnKSApXG4gICAgICAgICl7XG4gICAgICAgICAgICAgd3BiY19zaG9ydGNvZGUgKz0gJyBjYWxlbmRhcl9kYXRlc19lbmQ9XFwnJyArXG5cdFx0XHRcdCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfeWVhcicgKS52YWwoKS50cmltKCkgKyAnLScgK1xuXHRcdFx0XHQgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfZW5kX21vbnRoJyApLnZhbCgpLnRyaW0oKSArICAnLScgK1xuXHRcdFx0XHQgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfZW5kX2RhdGUnICkudmFsKCkudHJpbSgpICtcblx0XHRcdFx0ICdcXCcnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19hZ2dyZWdhdGUnICkubGVuZ3RoID4gMCApIHtcbiAgICAgICAgICAgIHZhciB3cGJjX2FnZ3JlZ2F0ZV90ZW1wID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfYWdncmVnYXRlJyApLnZhbCgpO1xuXG4gICAgICAgICAgICBpZiAoICggd3BiY19hZ2dyZWdhdGVfdGVtcCAhPSBudWxsICkgJiYgKCB3cGJjX2FnZ3JlZ2F0ZV90ZW1wLmxlbmd0aCA+IDAgKSAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX2FnZ3JlZ2F0ZV90ZW1wID0gd3BiY19hZ2dyZWdhdGVfdGVtcC5qb2luKCc7JylcblxuICAgICAgICAgICAgICAgIGlmICggd3BiY19hZ2dyZWdhdGVfdGVtcCAhPSAwICl7ICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgYWJvdXQgMD0+J05vbmUnXG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2hvcnRjb2RlICs9ICcgYWdncmVnYXRlPVxcJycgKyB3cGJjX2FnZ3JlZ2F0ZV90ZW1wICsgJ1xcJyc7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX2FnZ3JlZ2F0ZV9fYm9va2luZ3Nfb25seScpLmlzKCc6Y2hlY2tlZCcpICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX29wdGlvbnNfYXJyLnB1c2goICd7YWdncmVnYXRlIHR5cGU9Ym9va2luZ3Nfb25seX0nICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIC8vIE9wdGlvbiBQYXJhbVxuICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgIC8vIE9wdGlvbnMgOiBTaXplXG4gICAgICAgIHZhciB3cGJjX29wdGlvbnNfc2l6ZSA9ICcnO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgKCBqUXVlcnkoJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NpemVfZW5hYmxlZCcpLmxlbmd0aCA+IDAgKVxuICAgICAgICAgICAgICYmICggalF1ZXJ5KCcjJyArIHNob3J0Y29kZV9pZCArICdfd3BiY19zaXplX2VuYWJsZWQnKS5pcygnOmNoZWNrZWQnKSApXG4gICAgICAgICl7XG5cbiAgICAgICAgICAgIC8vIG9wdGlvbnM9J3tjYWxlbmRhciBtb250aHNfbnVtX2luX3Jvdz0yIHdpZHRoPTEwMCUgY2VsbF9oZWlnaHQ9NDBweH0nXG5cbiAgICAgICAgICAgIHdwYmNfb3B0aW9uc19zaXplICs9ICd7Y2FsZW5kYXInIDtcbiAgICAgICAgICAgIHdwYmNfb3B0aW9uc19zaXplICs9ICcgJyArICdtb250aHNfbnVtX2luX3Jvdz0nXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArIE1hdGgubWluKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VJbnQoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NpemVfbW9udGhzX251bV9pbl9yb3cnICkudmFsKCkudHJpbSgpICksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnX3dwYmNfbnVtbW9udGhzJyApLnZhbCgpLnRyaW0oKSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHdwYmNfb3B0aW9uc19zaXplICs9ICcgJyArICd3aWR0aD0nICsgcGFyc2VJbnQoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NpemVfY2FsZW5kYXJfd2lkdGgnICkudmFsKCkudHJpbSgpIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NpemVfY2FsZW5kYXJfd2lkdGhfcHhfcHInICkudmFsKCkudHJpbSgpIDtcbiAgICAgICAgICAgIHdwYmNfb3B0aW9uc19zaXplICs9ICcgJyArICdjZWxsX2hlaWdodD0nICsgcGFyc2VJbnQoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3NpemVfY2FsZW5kYXJfY2VsbF9oZWlnaHQnICkudmFsKCkudHJpbSgpICkgKyAncHgnO1xuICAgICAgICAgICAgd3BiY19vcHRpb25zX3NpemUgKz0gJ30nO1xuICAgICAgICAgICAgd3BiY19vcHRpb25zX2Fyci5wdXNoKCB3cGJjX29wdGlvbnNfc2l6ZSApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3B0aW9uczogRGF5cyBudW1iZXIgZGVwZW5kIG9uICAgV2Vla2RheVxuICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ3dwYmNfc2VsZWN0X2RheV93ZWVrZGF5X3RleHRhcmVhJyApLmxlbmd0aCA+IDAgKSB7XG4gICAgICAgICAgICB3cGJjX29wdGlvbnNfc2l6ZSA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ3dwYmNfc2VsZWN0X2RheV93ZWVrZGF5X3RleHRhcmVhJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICggd3BiY19vcHRpb25zX3NpemUubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgIHdwYmNfb3B0aW9uc19hcnIucHVzaCggd3BiY19vcHRpb25zX3NpemUgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE9wdGlvbnM6IERheXMgbnVtYmVyIGRlcGVuZCBvbiAgIFNFQVNPTlxuICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ3dwYmNfc2VsZWN0X2RheV9zZWFzb25fdGV4dGFyZWEnICkubGVuZ3RoID4gMCApIHtcbiAgICAgICAgICAgIHdwYmNfb3B0aW9uc19zaXplID0galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfaWQgKyAnd3BiY19zZWxlY3RfZGF5X3NlYXNvbl90ZXh0YXJlYScgKS52YWwoKS50cmltKCk7XG4gICAgICAgICAgICBpZiAoIHdwYmNfb3B0aW9uc19zaXplLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgICAgICAgICB3cGJjX29wdGlvbnNfYXJyLnB1c2goIHdwYmNfb3B0aW9uc19zaXplICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPcHRpb25zOiBTdGFydCB3ZWVrZGF5IGRlcGVuZCBvbiAgIFNFQVNPTlxuICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ3dwYmNfc3RhcnRfZGF5X3NlYXNvbl90ZXh0YXJlYScgKS5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgd3BiY19vcHRpb25zX3NpemUgPSBqUXVlcnkoICcjJyArIHNob3J0Y29kZV9pZCArICd3cGJjX3N0YXJ0X2RheV9zZWFzb25fdGV4dGFyZWEnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCB3cGJjX29wdGlvbnNfc2l6ZS5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICAgICAgd3BiY19vcHRpb25zX2Fyci5wdXNoKCB3cGJjX29wdGlvbnNfc2l6ZSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3B0aW9uOiBEYXlzIG51bWJlciBkZXBlbmQgb24gZnJvbSAgREFURVxuICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ3dwYmNfc2VsZWN0X2RheV9mb3JkYXRlX3RleHRhcmVhJyApLmxlbmd0aCA+IDAgKSB7XG4gICAgICAgICAgICB3cGJjX29wdGlvbnNfc2l6ZSA9IGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ3dwYmNfc2VsZWN0X2RheV9mb3JkYXRlX3RleHRhcmVhJyApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICggd3BiY19vcHRpb25zX3NpemUubGVuZ3RoID4gMCApe1xuICAgICAgICAgICAgICAgIHdwYmNfb3B0aW9uc19hcnIucHVzaCggd3BiY19vcHRpb25zX3NpemUgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggd3BiY19vcHRpb25zX2Fyci5sZW5ndGggPiAwICl7XG4gICAgICAgICAgICB3cGJjX3Nob3J0Y29kZSArPSAnIG9wdGlvbnM9XFwnJyArIHdwYmNfb3B0aW9uc19hcnIuam9pbiggJywnICkgKyAnXFwnJztcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgd3BiY19zaG9ydGNvZGUgKz0gJ10nO1xuXG4gICAgalF1ZXJ5KCAnI3dwYmNfdGV4dF9wdXRfaW5fc2hvcnRjb2RlJyApLnZhbCggd3BiY19zaG9ydGNvZGUgKTtcbn1cblxuICAgIC8qKlxuICAgICAqIE9wZW4gVGlueU1DRSBNb2RhbCAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfdGlueV9idG5fY2xpY2soIHRhZyApIHtcbiAgICAgICAgLy8gRml4SW46IDkuMC4xLjUuXG4gICAgICAgIGpRdWVyeSgnI3dwYmNfdGlueV9tb2RhbCcpLndwYmNfbXlfbW9kYWwoe1xuICAgICAgICAgICAga2V5Ym9hcmQ6IGZhbHNlXG4gICAgICAgICAgLCBiYWNrZHJvcDogdHJ1ZVxuICAgICAgICAgICwgc2hvdzogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgLy8gRml4SW46IDguMy4zLjk5LlxuICAgICAgICBqUXVlcnkoIFwiI3dwYmNfdGV4dF9nZXR0ZW5iZXJnX3NlY3Rpb25faWRcIiApLnZhbCggJycgKTtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE9wZW4gVGlueU1DRSBNb2RhbCAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfdGlueV9jbG9zZSgpIHtcblxuICAgICAgICBqUXVlcnkoJyN3cGJjX3RpbnlfbW9kYWwnKS53cGJjX215X21vZGFsKCdoaWRlJyk7XHQvLyBGaXhJbjogOS4wLjEuNS5cbiAgICB9XG5cbiAgICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbiAgICAvKiogU2VuZCBUZXh0ICovXG4gICAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG4gICAgLyoqXG4gICAgICogU2VuZCB0ZXh0ICB0byBlZGl0b3IgKi9cbiAgICBmdW5jdGlvbiB3cGJjX3NlbmRfdGV4dF90b19lZGl0b3IoIGggKSB7XG5cbiAgICAgICAgLy8gRml4SW46IDguMy4zLjk5XG4gICAgICAgIGlmICggdHlwZW9mKCB3cGJjX3NlbmRfdGV4dF90b19ndXRlbmJlcmcgKSA9PSAnZnVuY3Rpb24nICl7XG4gICAgICAgICAgICB2YXIgaXNfc2VuZCA9IHdwYmNfc2VuZF90ZXh0X3RvX2d1dGVuYmVyZyggaCApO1xuICAgICAgICAgICAgaWYgKCB0cnVlID09PSBpc19zZW5kICl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBlZCwgbWNlID0gdHlwZW9mKHRpbnltY2UpICE9ICd1bmRlZmluZWQnLCBxdCA9IHR5cGVvZihRVGFncykgIT0gJ3VuZGVmaW5lZCc7XG5cbiAgICAgICAgICAgIGlmICggISB3aW5kb3cud3BBY3RpdmVFZGl0b3IgKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICggbWNlICYmIHRpbnltY2UuYWN0aXZlRWRpdG9yICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVkID0gdGlueW1jZS5hY3RpdmVFZGl0b3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LndwQWN0aXZlRWRpdG9yID0gZWQuaWQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoICFxdCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIG1jZSApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB0aW55bWNlLmFjdGl2ZUVkaXRvciAmJiAodGlueW1jZS5hY3RpdmVFZGl0b3IuaWQgPT0gJ21jZV9mdWxsc2NyZWVuJyB8fCB0aW55bWNlLmFjdGl2ZUVkaXRvci5pZCA9PSAnd3BfbWNlX2Z1bGxzY3JlZW4nKSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWQgPSB0aW55bWNlLmFjdGl2ZUVkaXRvcjtcbiAgICAgICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVkID0gdGlueW1jZS5nZXQod3BBY3RpdmVFZGl0b3IpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIGVkICYmICFlZC5pc0hpZGRlbigpICkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZXN0b3JlIGNhcmV0IHBvc2l0aW9uIG9uIElFXG4gICAgICAgICAgICAgICAgICAgIGlmICggdGlueW1jZS5pc0lFICYmIGVkLndpbmRvd01hbmFnZXIuaW5zZXJ0aW1hZ2Vib29rbWFyayApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZWQuc2VsZWN0aW9uLm1vdmVUb0Jvb2ttYXJrKGVkLndpbmRvd01hbmFnZXIuaW5zZXJ0aW1hZ2Vib29rbWFyayk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCBoLmluZGV4T2YoJ1tjYXB0aW9uJykgIT09IC0xICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggZWQud3BTZXRJbWdDYXB0aW9uIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGggPSBlZC53cFNldEltZ0NhcHRpb24oaCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGguaW5kZXhPZignW2dhbGxlcnknKSAhPT0gLTEgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBlZC5wbHVnaW5zLndwZ2FsbGVyeSApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoID0gZWQucGx1Z2lucy53cGdhbGxlcnkuX2RvX2dhbGxlcnkoaCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIGguaW5kZXhPZignW2VtYmVkJykgPT09IDAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBlZC5wbHVnaW5zLndvcmRwcmVzcyApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoID0gZWQucGx1Z2lucy53b3JkcHJlc3MuX3NldEVtYmVkKGgpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgZWQuZXhlY0NvbW1hbmQoJ21jZUluc2VydENvbnRlbnQnLCBmYWxzZSwgaCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBxdCApIHtcbiAgICAgICAgICAgICAgICAgICAgUVRhZ3MuaW5zZXJ0Q29udGVudChoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHdwQWN0aXZlRWRpdG9yKS52YWx1ZSArPSBoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnl7dGJfcmVtb3ZlKCk7fWNhdGNoKGUpe307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUkVTT1VSQ0VTIFBBR0U6IE9wZW4gVGlueU1DRSBNb2RhbCAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfcmVzb3VyY2VfcGFnZV9idG5fY2xpY2soIHJlc291cmNlX2lkICwgc2hvcnRjb2RlX2RlZmF1bHRfdmFsdWUgPSAnJykge1xuXG4gICAgICAgIC8vIEZpeEluOiA5LjAuMS41LlxuICAgICAgICBqUXVlcnkoJyN3cGJjX3RpbnlfbW9kYWwnKS53cGJjX215X21vZGFsKHtcbiAgICAgICAgICAgIGtleWJvYXJkOiBmYWxzZVxuICAgICAgICAgICwgYmFja2Ryb3A6IHRydWVcbiAgICAgICAgICAsIHNob3c6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gRGlzYWJsZSBzb21lIG9wdGlvbnMgLSBzZWxlY3Rpb24gb2YgYm9va2luZyByZXNvdXJjZSAtIGJlY2F1c2Ugd2UgY29uZmlndXJlIGl0IG9ubHkgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UsIHdoZXJlIHdlIGNsaWNrZWQuXG4gICAgICAgIHZhciBzaG9ydGNvZGVfYXJyID0gWydib29raW5nJywgJ2Jvb2tpbmdjYWxlbmRhcicsICdib29raW5nZm9ybSddO1xuXG4gICAgICAgIGZvciAoIHZhciBzaG9ydGNkZV9rZXkgaW4gc2hvcnRjb2RlX2FyciApe1xuXG4gICAgICAgICAgICB2YXIgc2hvcnRjb2RlX2lkID0gc2hvcnRjb2RlX2Fyclsgc2hvcnRjZGVfa2V5IF07XG5cbiAgICAgICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Jlc291cmNlX2lkJyApLnByb3AoIFx0XHQgJ2Rpc2FibGVkJywgZmFsc2UgKTtcbiAgICAgICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgXCJfd3BiY19yZXNvdXJjZV9pZCBvcHRpb25bdmFsdWU9J1wiICsgcmVzb3VyY2VfaWQgKyBcIiddXCIgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICAgICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX2lkICsgJ193cGJjX3Jlc291cmNlX2lkJyApLnByb3AoIFx0XHQgJ2Rpc2FibGVkJywgdHJ1ZSApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSGlkZSBsZWZ0ICBuYXZpZ2F0aW9uICBpdGVtc1xuLy8gICAgICAgIGpRdWVyeSggXCIud3BiY19zaG9ydGNvZGVfY29uZmlnX25hdmlnYXRpb25fY29sdW1uIC53cGJjX3NldHRpbmdzX25hdmlnYXRpb25faXRlbVwiICkuaGlkZSgpO1xuICAgICAgICBqUXVlcnkoIFwiI3dwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbmF2X3RhYl9fYm9va2luZ1wiICkuc2hvdygpO1xuICAgICAgICBqUXVlcnkoIFwiI3dwYmNfc2hvcnRjb2RlX2NvbmZpZ19fbmF2X3RhYl9fYm9va2luZ2NhbGVuZGFyXCIgKS5zaG93KCk7XG5cbiAgICAgICAgLy8gSGlkZSB8IFNob3cgSW5zZXJ0ICBidXR0b24gIGZvciBib29raW5nIHJlc291cmNlIHBhZ2VcbiAgICAgICAgalF1ZXJ5KCBcIi53cGJjX3RpbnlfYnV0dG9uX19pbnNlcnRfdG9fZWRpdG9yXCIgKS5oaWRlKCk7XG4gICAgICAgIGpRdWVyeSggXCIud3BiY190aW55X2J1dHRvbl9faW5zZXJ0X3RvX3Jlc291cmNlXCIgKS5zaG93KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IFNob3J0Y29kZSBWYWx1ZSBmcm9tICBzaG9ydGNvZGUgdGV4dCBmaWVsZCBpbiBQb3BVcCBzaG9ydGNvZGUgQ29uZmlnIGRpYWxvZyBhbmQgaW5zZXJ0ICBpbnRvIERJViBhbmQgSU5QVVQgVEVYVCBmaWVsZCBuZWFyIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UuXG4gICAgICogIEJ1dCBpdCB0YWtlcyBJRCAgb2YgYm9va2luZyByZXNvdXJjZSwgIHdoZXJlIHRvICBpbnNlcnQgIHRoaXMgc2hvcnRjb2RlIG9ubHkgZnJvbSAgJ2Jvb2tpbmcnIHNlY3Rpb24gIG9mIENvbmZpZyBEaWFsb2cuIHVzdWFsbHkgIHN1Y2ggIGJvb2tpbmcgcmVzb3VyY2UgIGRpc2FibGVkIHRoZXJlIVxuICAgICAqICBlLmcuOiBqUXVlcnkoIFwiI2Jvb2tpbmdfd3BiY19yZXNvdXJjZV9pZFwiICkudmFsKClcbiAgICAgKlxuICAgICAqIEBwYXJhbSBzaG9ydGNvZGVfdmFsXG4gICAgICovXG4gICAgZnVuY3Rpb24gd3BiY19zZW5kX3RleHRfdG9fcmVzb3VyY2UoIHNob3J0Y29kZV92YWwgKXtcbiAgICAgICAgLy8gRml4SW46IDEwLjMuMC44LlxuICAgICAgICB2YXIgcmVzb3VyY2VfaWQgPSAxO1xuICAgICAgICBpZiAoIGpRdWVyeSggXCIjYm9va2luZ193cGJjX3Jlc291cmNlX2lkXCIgKS5sZW5ndGggKXtcbiAgICAgICAgICAgIHJlc291cmNlX2lkID0galF1ZXJ5KCBcIiNib29raW5nX3dwYmNfcmVzb3VyY2VfaWRcIiApLnZhbCgpO1xuICAgICAgICB9XG4gICAgICAgIGpRdWVyeSggJyNkaXZfYm9va2luZ19yZXNvdXJjZV9zaG9ydGNvZGVfJyArIHJlc291cmNlX2lkICkuaHRtbCggc2hvcnRjb2RlX3ZhbCApO1xuICAgICAgICAgICAgalF1ZXJ5KCAnI2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlXycgKyByZXNvdXJjZV9pZCApLnZhbCggc2hvcnRjb2RlX3ZhbCApO1xuICAgICAgICAgICAgalF1ZXJ5KCAnI2Jvb2tpbmdfcmVzb3VyY2Vfc2hvcnRjb2RlXycgKyByZXNvdXJjZV9pZCApLnRyaWdnZXIoJ2NoYW5nZScpO1xuXG5cdFx0LyoqXG5cdFx0ICogRmlyZXMgYWZ0ZXIgdGhlIFJlc291cmNlIHNob3J0Y29kZSBjdXN0b21pemVyIHJldHVybnMgYSBzaG9ydGNvZGUuXG5cdFx0ICpcblx0XHQgKiBBSkFYIGluc3BlY3RvcnMgY29uc3VtZSB0aGlzIGV2ZW50IHdpdGhvdXQgZHVwbGljYXRpbmcgdGhlIGxlZ2FjeVxuXHRcdCAqIGBib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV97SUR9YCBET00gY29udHJhY3QuXG5cdFx0ICpcblx0XHQgKiBAZXZlbnQgd3BiYzpyZXNvdXJjZS1zaG9ydGNvZGUtc2VsZWN0ZWRcblx0XHQgKiBAdHlwZSB7e3Jlc291cmNlX2lkOiBudW1iZXJ8c3RyaW5nLCBzaG9ydGNvZGU6IHN0cmluZ319XG5cdFx0ICovXG5cdFx0alF1ZXJ5KCBkb2N1bWVudCApLnRyaWdnZXIoICd3cGJjOnJlc291cmNlLXNob3J0Y29kZS1zZWxlY3RlZCcsIFsge1xuXHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHRcdFx0c2hvcnRjb2RlOiBzaG9ydGNvZGVfdmFsXG5cdFx0fSBdICk7XG5cbiAgICAgICAgLy8gU2Nyb2xsXG4gICAgICAgIGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX3Njcm9sbF90bykgKXtcbiAgICAgICAgICAgIHdwYmNfc2Nyb2xsX3RvKCAnI2Rpdl9ib29raW5nX3Jlc291cmNlX3Nob3J0Y29kZV8nICsgalF1ZXJ5KCBcIiNib29raW5nX3dwYmNfcmVzb3VyY2VfaWRcIiApLnZhbCgpICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiBSIEUgUyBFIFQgKi9cbiAgICBmdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3Jlc2V0KHNob3J0Y29kZV92YWwpe1xuICAgICAgICBpZiAoICdib29raW5nX2FwcG9pbnRtZW50JyA9PT0gc2hvcnRjb2RlX3ZhbCB8fCAnYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvcicgPT09IHNob3J0Y29kZV92YWwgKSB7XG4gICAgICAgICAgICB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3Jlc2V0X3dvcmtmbG93KCBzaG9ydGNvZGVfdmFsICk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc3RhcnRtb250aF9hY3RpdmUnICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfc3RhcnRfYWN0aXZlJyApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX2NhbGVuZGFyX2RhdGVzX2VuZF9hY3RpdmUnICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuXG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19hZ2dyZWdhdGUgb3B0aW9uOnNlbGVjdGVkJykucHJvcCggJ3NlbGVjdGVkJywgZmFsc2UpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfYWdncmVnYXRlIG9wdGlvbjplcSgwKScgICApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX2FnZ3JlZ2F0ZV9fYm9va2luZ3Nfb25seScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICkudHJpZ2dlcignY2hhbmdlJyk7XG5cbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX2N1c3RvbV9mb3JtIG9wdGlvbjplcSgwKScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19udW1tb250aHMgb3B0aW9uOmVxKDApJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3NpemVfZW5hYmxlZCcgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICkudHJpZ2dlcignY2hhbmdlJyk7XG5cbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3BvcHVwX2VuYWJsZWQnICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfYnV0dG9uX3RpdGxlJyApLnZhbCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3BvcHVwX2J1dHRvbl90aXRsZScgKS5hdHRyKCAncGxhY2Vob2xkZXInICkgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3BvcHVwX3RpdGxlJyApLnZhbCggalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3BvcHVwX3RpdGxlJyApLmF0dHIoICdwbGFjZWhvbGRlcicgKSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfYnV0dG9uX2NsYXNzJyApLnZhbCggJ3dwLWVsZW1lbnQtYnV0dG9uJyApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfbW9kYWxfY2xhc3MnICkudmFsKCAnJyApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfcG9wdXBfc2l6ZSBvcHRpb25bdmFsdWU9XCJsZ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG5cbiAgICAgICAgd3BiY19zaG9ydGNvZGVfY29uZmlnX19zZWxlY3RfZGF5X3dlZWtkYXlfX3Jlc2V0KCBzaG9ydGNvZGVfdmFsICsgJ3dwYmNfc2VsZWN0X2RheV93ZWVrZGF5JyApO1xuICAgICAgICB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfc2Vhc29uX19yZXNldCggc2hvcnRjb2RlX3ZhbCArICd3cGJjX3NlbGVjdF9kYXlfc2Vhc29uJyApO1xuICAgICAgICB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3N0YXJ0X2RheV9zZWFzb25fX3Jlc2V0KCBzaG9ydGNvZGVfdmFsICsgJ3dwYmNfc3RhcnRfZGF5X3NlYXNvbicgKTtcbiAgICAgICAgd3BiY19zaG9ydGNvZGVfY29uZmlnX19zZWxlY3RfZGF5X2ZvcmRhdGVfX3Jlc2V0KCBzaG9ydGNvZGVfdmFsICsgJ3dwYmNfc2VsZWN0X2RheV9mb3JkYXRlJyApO1xuXG4gICAgICAgIC8vIFJlc2V0ICBmb3IgW2Jvb2tpbmdzZWxlY3RdIHNob3J0Y29kZSBwYXJhbXNcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX211bHRpcGxlX3Jlc291cmNlcyBvcHRpb246c2VsZWN0ZWQnKS5wcm9wKCAnc2VsZWN0ZWQnLCBmYWxzZSk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXMgb3B0aW9uOmVxKDApJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3NlbGVjdGVkX3Jlc291cmNlIG9wdGlvbjplcSgwKScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY190ZXh0X2xhYmVsJyApLnZhbCggJycgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX2ZpcnN0X29wdGlvbl90aXRsZScgKS52YWwoICcnICkudHJpZ2dlcignY2hhbmdlJyk7XG5cbiAgICAgICAgLy8gUmVzZXQgIGZvciBbYm9va2luZ3RpbWVsaW5lXSBzaG9ydGNvZGUgcGFyYW1zXG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY190ZXh0X2xhYmVsX3RpbWVsaW5lJyApLnZhbCggJycgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3Njcm9sbF90aW1lbGluZV9zY3JvbGxfbW9udGggb3B0aW9uW3ZhbHVlPVwiMFwiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX2RheXMgb3B0aW9uW3ZhbHVlPVwiMFwiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX2FjdGl2ZScgKS5wcm9wKCAnY2hlY2tlZCcsIGZhbHNlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zdGFydF9lbmRfdGltZV90aW1lbGluZV9zdGFydHRpbWUgb3B0aW9uW3ZhbHVlPVwiMFwiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zdGFydF9lbmRfdGltZV90aW1lbGluZV9lbmR0aW1lIG9wdGlvblt2YWx1ZT1cIjI0XCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnaW5wdXRbbmFtZT1cIicgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3Jvd1wiXVt2YWx1ZT1cIjMwXCJdJyApLnByb3AoICdjaGVja2VkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc3RhcnRfZGF0ZV90aW1lbGluZV95ZWFyIG9wdGlvblt2YWx1ZT1cIicgKyAobmV3IERhdGUoKS5nZXRGdWxsWWVhcigpKSArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX21vbnRoIG9wdGlvblt2YWx1ZT1cIicgKyAoKG5ldyBEYXRlKCkuZ2V0TW9udGgoKSkgKyAxKSArICdcIl0nICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc3RhcnRfZGF0ZV90aW1lbGluZV9kYXkgb3B0aW9uW3ZhbHVlPVwiJyArIChuZXcgRGF0ZSgpLmdldERhdGUoKSkgKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuICAgICAgICAvLyBSZXNldCAgZm9yIFtib29raW5nZm9ybV0gc2hvcnRjb2RlIHBhcmFtc1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfYm9va2luZ19kYXRlX3llYXIgb3B0aW9uW3ZhbHVlPVwiJyArIChuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkpICsgJ1wiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV9tb250aCBvcHRpb25bdmFsdWU9XCInICsgKChuZXcgRGF0ZSgpLmdldE1vbnRoKCkpICsgMSkgKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV9kYXkgb3B0aW9uW3ZhbHVlPVwiJyArIChuZXcgRGF0ZSgpLmdldERhdGUoKSkgKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuICAgICAgICAvLyBSZXNldCAgZm9yIFtbYm9va2luZ3NlYXJjaCAuLi5dIHNob3J0Y29kZSBwYXJhbXNcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3NlYXJjaF9uZXdfcGFnZV91cmwnICkudmFsKCAnJyApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2VhcmNoX25ld19wYWdlX2VuYWJsZWQnICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICAvLyBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2VhcmNoX2hlYWRlcicgKS52YWwoICcnICkudHJpZ2dlcignY2hhbmdlJyk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRml4SW46IDEwLjAuMC40MS5cbiAgICAgICAgLy8galF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3NlYXJjaF9ub3RoaW5nX2ZvdW5kJyApLnZhbCggJycgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3NlYXJjaF9mb3JfdXNlcnMnICkudmFsKCAnJyApLnRyaWdnZXIoJ2NoYW5nZScpO1xuICAgICAgICBqUXVlcnkoICdpbnB1dFtuYW1lPVwiJyArIHNob3J0Y29kZV92YWwgKyAnX3dwYmNfc2VhcmNoX2Zvcm1fcmVzdWx0c1wiXVt2YWx1ZT1cImJvb2tpbmdzZWFyY2hcIl0nICkucHJvcCggJ2NoZWNrZWQnLCB0cnVlICkudHJpZ2dlcignY2hhbmdlJyk7XG5cbiAgICAgICAgLy8gUmVzZXQgIGZvciBbYm9va2luZ2VkaXRdICwgW2Jvb2tpbmdjdXN0b21lcmxpc3RpbmddICwgW2Jvb2tpbmdyZXNvdXJjZSB0eXBlPTYgc2hvdz0nY2FwYWNpdHknXSAsIFtib29raW5nX2NvbmZpcm1dXG4gICAgICAgIGpRdWVyeSggJ2lucHV0W25hbWU9XCInICsgc2hvcnRjb2RlX3ZhbCArICdfd3BiY19zaG9ydGNvZGVfdHlwZVwiXVt2YWx1ZT1cImJvb2tpbmdfY29uZmlybVwiXScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS50cmlnZ2VyKCdjaGFuZ2UnKTtcblxuXG4gICAgICAgIC8vIGJvb2tpbmdfaW1wb3J0X2ljcyAsIGJvb2tpbmdfbGlzdGluZ19pY3NcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ193cGJjX3VybCcgKS52YWwoICcnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ19mcm9tIG9wdGlvblt2YWx1ZT1cInRvZGF5XCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX2Zyb21fb2Zmc2V0JyApLnZhbCggJycgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX2Zyb21fb2Zmc2V0X3R5cGUgb3B0aW9uOmVxKDApJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3VudGlsIG9wdGlvblt2YWx1ZT1cImFueVwiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ191bnRpbF9vZmZzZXQnICkudmFsKCAnJyApLnRyaWdnZXIoICdjaGFuZ2UnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgc2hvcnRjb2RlX3ZhbCArICdfdW50aWxfb2Zmc2V0X3R5cGUgb3B0aW9uOmVxKDApJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX2NvbmRpdGlvbnNfaW1wb3J0IG9wdGlvbjplcSgwKScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBzaG9ydGNvZGVfdmFsICsgJ19jb25kaXRpb25zX2V2ZW50cyBvcHRpb25bdmFsdWU9XCIxXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX2NvbmRpdGlvbnNfbWF4X251bSBvcHRpb25bdmFsdWU9XCIwXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIHNob3J0Y29kZV92YWwgKyAnX3NpbGVuY2Ugb3B0aW9uW3ZhbHVlPVwiMFwiXScgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcbiAgICB9XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuLyoqXG4gKiAgU0hPUlRDT0RFX0NPTkZJR1xuICogKi9cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG4vKipcbiAqIFNob3cgdGhlIHNlbGVjdGVkIHNob3J0Y29kZSBjb25maWd1cmF0aW9uIGZyb20gdGhlIHBvcHVwIG5hdmlnYXRpb24uXG4gKlxuICogRXZlcnkgc2hvcnRjb2RlIHVzZXMgdGhlIHNhbWUgY29uc3RyYWluZWQgY29udGVudCBsYXlvdXQgc28gaXRzIHRhYiBiYXIsXG4gKiBnZW5lcmF0ZWQgc2hvcnRjb2RlLCBhbmQgcG9wdXAgYWN0aW9ucyByZW1haW4gZml4ZWQgd2hpbGUgb25seSB0aGUgc2VsZWN0ZWRcbiAqIGNvbmZpZ3VyYXRpb24gc2VjdGlvbiBzY3JvbGxzLlxuICpcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IF90aGlzICAgICAgICAgICAgICBDbGlja2VkIG5hdmlnYXRpb24gbGluay5cbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIHNlY3Rpb25faWRfdG9fc2hvdyBTZWxlY3RvciBmb3IgdGhlIHNob3J0Y29kZSBjb250YWluZXIuXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICBzaG9ydGNvZGVfbmFtZSAgICAgU2hvcnRjb2RlIG5hbWUgd2l0aG91dCBicmFja2V0cy5cbiAqIEByZXR1cm4ge3ZvaWR9XG4gKi9cbmZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19jbGlja19zaG93X3NlY3Rpb24oIF90aGlzLCBzZWN0aW9uX2lkX3RvX3Nob3csIHNob3J0Y29kZV9uYW1lICl7XG5cbiAgICB2YXIgc2hvcnRjb2RlX2NvbnRhaW5lciA9IGpRdWVyeSggc2VjdGlvbl9pZF90b19zaG93ICk7XG5cbiAgICAvLyBNZW51XG4gICAgalF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY19zZXR0aW5nc19mbGV4X2NvbnRhaW5lcicgKS5maW5kKCAnLndwYmNfc2V0dGluZ3NfbmF2aWdhdGlvbl9pdGVtX2FjdGl2ZScgKS5yZW1vdmVDbGFzcyggJ3dwYmNfc2V0dGluZ3NfbmF2aWdhdGlvbl9pdGVtX2FjdGl2ZScgKTtcbiAgICBqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3NldHRpbmdzX25hdmlnYXRpb25faXRlbScgKS5hZGRDbGFzcyggJ3dwYmNfc2V0dGluZ3NfbmF2aWdhdGlvbl9pdGVtX2FjdGl2ZScgKTtcblxuICAgIC8vIENvbnRlbnRcbiAgICBqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3NldHRpbmdzX2ZsZXhfY29udGFpbmVyJyApLmZpbmQoICcud3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZScgKS5yZW1vdmVDbGFzcyggJ3dwYmNfc2NfY29udGFpbmVyX19zaG9ydGNvZGVfaXNfYWN0aXZlJyApLmhpZGUoKTtcbiAgICBzaG9ydGNvZGVfY29udGFpbmVyLnNob3coKS5hZGRDbGFzcyggJ3dwYmNfc2NfY29udGFpbmVyX19zaG9ydGNvZGVfaXNfYWN0aXZlJyApO1xuXG4gICAgLy8gU3RhcnQgZWFjaCBzZWxlY3RlZCBjb25maWd1cmF0aW9uIGF0IHRoZSBiZWdpbm5pbmcgb2YgaXRzIHZpc2libGUgc2VjdGlvbi5cbiAgICBzaG9ydGNvZGVfY29udGFpbmVyLmZpbmQoICcud3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZV9zZWN0aW9uOnZpc2libGUnICkuc2Nyb2xsVG9wKCAwICk7XG4gICAgLy8gU2V0IC0gU2hvcnRjb2RlIFR5cGVcbiAgICBqUXVlcnkoICcjd3BiY19zaG9ydGNvZGVfdHlwZScpLnZhbCggc2hvcnRjb2RlX25hbWUgKTtcblxuICAgIC8vIFBhcnNlIHNob3J0Y29kZSBwYXJhbXNcbiAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbn1cblxuXG4gICAgLyoqXG4gICAgICogRG8gTmV4dCAvIFByaW9yIHN0ZXBcbiAgICAgKiBAcGFyYW0gX3RoaXNcdFx0YnV0dG9uICB0aGlzXG4gICAgICogQHBhcmFtIHN0ZXBcdFx0J3ByaW9yJyB8ICduZXh0J1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19jb250ZW50X3Rvb2xiYXJfX25leHRfcHJpb3IoIF90aGlzLCBzdGVwICl7XG5cbiAgICAgICAgdmFyIGpfd29ya19uYXZfdGFiO1xuXG4gICAgICAgIHZhciBzdWJtZW51X3NlbGVjdGVkID0galF1ZXJ5KCBfdGhpcyApLnBhcmVudHMoICcud3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZScgKS5maW5kKCAnLndwYmNfc2NfY29udGFpbmVyX19zaG9ydGNvZGVfc2VjdGlvbjp2aXNpYmxlJyApLmZpbmQoICcud3BkZXZlbG9wLXN1Ym1lbnUtdGFiLXNlbGVjdGVkOnZpc2libGUnICk7XG4gICAgICAgIGlmICggc3VibWVudV9zZWxlY3RlZC5sZW5ndGggKXtcbiAgICAgICAgICAgIGlmICggJ25leHQnID09PSBzdGVwICl7XG4gICAgICAgICAgICAgICAgal93b3JrX25hdl90YWIgPSBzdWJtZW51X3NlbGVjdGVkLm5leHRBbGwoICdhLm5hdi10YWI6dmlzaWJsZScgKS5maXJzdCgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBqX3dvcmtfbmF2X3RhYiA9IHN1Ym1lbnVfc2VsZWN0ZWQucHJldkFsbCggJ2EubmF2LXRhYjp2aXNpYmxlJyApLmZpcnN0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIGpfd29ya19uYXZfdGFiLmxlbmd0aCApe1xuICAgICAgICAgICAgICAgIGpfd29ya19uYXZfdGFiLnRyaWdnZXIoICdjbGljaycgKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoICduZXh0JyA9PT0gc3RlcCApe1xuICAgICAgICAgICAgal93b3JrX25hdl90YWIgPSBqUXVlcnkoIF90aGlzICkucGFyZW50cyggJy53cGJjX3NjX2NvbnRhaW5lcl9fc2hvcnRjb2RlJyApLmZpbmQoICcubmF2LXRhYi5uYXYtdGFiLWFjdGl2ZTp2aXNpYmxlJyApLm5leHRBbGwoICdhLm5hdi10YWI6dmlzaWJsZScgKS5maXJzdCgpO1xuICAgICAgICB9IGVsc2V7XG4gICAgICAgICAgICBqX3dvcmtfbmF2X3RhYiA9IGpRdWVyeSggX3RoaXMgKS5wYXJlbnRzKCAnLndwYmNfc2NfY29udGFpbmVyX19zaG9ydGNvZGUnICkuZmluZCggJy5uYXYtdGFiLm5hdi10YWItYWN0aXZlOnZpc2libGUnICkucHJldkFsbCggJ2EubmF2LXRhYjp2aXNpYmxlJyApLmZpcnN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGpfd29ya19uYXZfdGFiLmxlbmd0aCApe1xuICAgICAgICAgICAgal93b3JrX25hdl90YWIudHJpZ2dlciggJ2NsaWNrJyApO1xuICAgICAgICB9XG5cbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIENvbmRpdGlvbjogICB7c2VsZWN0LWRheSBjb25kaXRpb249XCJ3ZWVrZGF5XCIgZm9yPVwiNVwiIHZhbHVlPVwiM1wifVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV93ZWVrZGF5X19hZGQoaWQpe1xuICAgICAgICB2YXIgY29uZGl0aW9uX3J1bGVfYXJyID0gW107XG4gICAgICAgIGZvciAoIHZhciB3ZWVrZGF5X251bSA9IDA7IHdlZWtkYXlfbnVtIDwgODsgd2Vla2RheV9udW0rKyApe1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIGlkICsgJ19fd2Vla2RheV8nICsgd2Vla2RheV9udW0gKS5pcyggJzpjaGVja2VkJyApICl7XG4gICAgICAgICAgICAgICAgdmFyIGRheXNfdG9fc2VsZWN0ID0galF1ZXJ5KCAnIycgKyBpZCArICdfX2RheXNfbnVtYmVyXycgKyB3ZWVrZGF5X251bSApLnZhbCgpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgYWxsIHdvcmRzIGV4Y2VwdCBkaWdpdHMgYW5kICwgYW5kIC1cbiAgICAgICAgICAgICAgICBkYXlzX3RvX3NlbGVjdCA9IGRheXNfdG9fc2VsZWN0LnJlcGxhY2UoL1teMC05LC1dL2csICcnKTtcbiAgICAgICAgICAgICAgICBkYXlzX3RvX3NlbGVjdCA9IGRheXNfdG9fc2VsZWN0LnJlcGxhY2UoL1ssXXsyLH0vZywgJywnKTtcbiAgICAgICAgICAgICAgICBkYXlzX3RvX3NlbGVjdCA9IGRheXNfdG9fc2VsZWN0LnJlcGxhY2UoL1stXXsyLH0vZywgJy0nKTtcbiAgICAgICAgICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXJfJyArIHdlZWtkYXlfbnVtICkudmFsKCBkYXlzX3RvX3NlbGVjdCApO1xuXG4gICAgICAgICAgICAgICAgaWYgKCAnJyAhPT0gZGF5c190b19zZWxlY3QgKXtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9uX3J1bGVfYXJyLnB1c2goICd7c2VsZWN0LWRheSBjb25kaXRpb249XCJ3ZWVrZGF5XCIgZm9yPVwiJyArIHdlZWtkYXlfbnVtICsgJ1wiIHZhbHVlPVwiJyArIGRheXNfdG9fc2VsZWN0ICsgJ1wifScgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvLyBSZWQgaGlnaGxpZ2h0IGZpZWxkcywgIGlmIHNvbWUgcmVxdWlyZWQgZmllbGRzIGFyZSBlbXB0eVxuICAgICAgICAgICAgICAgICAgICBpZiAoICgnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZmllbGRfaGlnaGxpZ2h0KSkgJiYgKCcnID09PSBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXJfJyArIHdlZWtkYXlfbnVtICkudmFsKCkpICl7XG4gICAgICAgICAgICAgICAgICAgICAgICB3cGJjX2ZpZWxkX2hpZ2hsaWdodCggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcl8nICsgd2Vla2RheV9udW0gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgY29uZGl0aW9uX3J1bGUgPSBjb25kaXRpb25fcnVsZV9hcnIuam9pbiggJywnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCggY29uZGl0aW9uX3J1bGUgKTtcbiAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV93ZWVrZGF5X19yZXNldChpZCl7XG5cbiAgICAgICAgZm9yICggdmFyIHdlZWtkYXlfbnVtID0gMDsgd2Vla2RheV9udW0gPCA4OyB3ZWVrZGF5X251bSsrICl7XG4gICAgICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXJfJyArIHdlZWtkYXlfbnVtICkudmFsKCAnJyApO1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIGlkICsgJ19fd2Vla2RheV8nICsgd2Vla2RheV9udW0gKS5pcyggJzpjaGVja2VkJyApICl7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfX3dlZWtkYXlfJyArIHdlZWtkYXlfbnVtICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCggJycgKTtcbiAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBDb25kaXRpb246ICAge3NlbGVjdC1kYXkgY29uZGl0aW9uPVwic2Vhc29uXCIgZm9yPVwiSGlnaCBzZWFzb25cIiB2YWx1ZT1cIjctMTQsMjBcIn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfc2Vhc29uX19hZGQoaWQpe1xuXG4gICAgICAgIHZhciBzZWFzb25fZmlsdGVyX25hbWUgPSBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lIG9wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCkudHJpbSgpO1xuICAgICAgICAvLyBFc2NhcGUgcXVvdGUgc3ltYm9sc1xuICAgICAgICBzZWFzb25fZmlsdGVyX25hbWUgPSBzZWFzb25fZmlsdGVyX25hbWUucmVwbGFjZSgvW1xcXCJcIl0vZywgJ1xcXFxcIicpO1xuXG4gICAgICAgIHZhciBkYXlzX251bWJlciA9IGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKS52YWwoKS50cmltKCk7XG4gICAgICAgIC8vIFJlbW92ZSBhbGwgd29yZHMgZXhjZXB0IGRpZ2l0cyBhbmQgLCBhbmQgLVxuICAgICAgICBkYXlzX251bWJlciA9IGRheXNfbnVtYmVyLnJlcGxhY2UoIC9bXjAtOSwtXS9nLCAnJyApO1xuICAgICAgICBkYXlzX251bWJlciA9IGRheXNfbnVtYmVyLnJlcGxhY2UoIC9bLF17Mix9L2csICcsJyApO1xuICAgICAgICBkYXlzX251bWJlciA9IGRheXNfbnVtYmVyLnJlcGxhY2UoIC9bLV17Mix9L2csICctJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXInICkudmFsKCBkYXlzX251bWJlciApO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICgnJyAhPSBkYXlzX251bWJlcilcbiAgICAgICAgICAgICYmICgnJyAhPSBzZWFzb25fZmlsdGVyX25hbWUpXG4gICAgICAgICAgICAmJiAoMCAhPSBqUXVlcnkoICcjJyArIGlkICsgJ19fc2Vhc29uX2ZpbHRlcl9uYW1lJyApLnZhbCgpKVxuXG4gICAgICAgICl7XG4gICAgICAgICAgICB2YXIgZXhpc3RfY29uZmlndXJhdGlvbiA9IGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCgpO1xuXG4gICAgICAgICAgICBleGlzdF9jb25maWd1cmF0aW9uID0gZXhpc3RfY29uZmlndXJhdGlvbi5yZXBsYWNlQWxsKFwifSx7XCIsICd9fn57JylcbiAgICAgICAgICAgIHZhciBjb25kaXRpb25fcnVsZV9hcnIgPSBleGlzdF9jb25maWd1cmF0aW9uLnNwbGl0KCAnfn4nICk7XG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSBlbXB0eSBzcGFjZXMgZnJvbSAgYXJyYXkgOiAnJyB8IFwiXCJcbiAgICAgICAgICAgIGNvbmRpdGlvbl9ydWxlX2FyciA9IGNvbmRpdGlvbl9ydWxlX2Fyci5maWx0ZXIoZnVuY3Rpb24obil7cmV0dXJuIG47IH0pO1xuXG4gICAgICAgICAgICBjb25kaXRpb25fcnVsZV9hcnIucHVzaCggJ3tzZWxlY3QtZGF5IGNvbmRpdGlvbj1cInNlYXNvblwiIGZvcj1cIicgKyBzZWFzb25fZmlsdGVyX25hbWUgKyAnXCIgdmFsdWU9XCInICsgZGF5c19udW1iZXIgKyAnXCJ9JyApO1xuXG4gICAgICAgICAgICAvLyBSZW1vdmUgZHVwbGljYXRlcyBmcm9tICB0aGUgYXJyYXlcbiAgICAgICAgICAgIGNvbmRpdGlvbl9ydWxlX2FyciA9IGNvbmRpdGlvbl9ydWxlX2Fyci5maWx0ZXIoIGZ1bmN0aW9uICggaXRlbSwgcG9zICl7IHJldHVybiBjb25kaXRpb25fcnVsZV9hcnIuaW5kZXhPZiggaXRlbSApID09PSBwb3M7IH0gKTtcbiAgICAgICAgICAgIHZhciBjb25kaXRpb25fcnVsZSA9IGNvbmRpdGlvbl9ydWxlX2Fyci5qb2luKCAnLCcgKTtcbiAgICAgICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCggY29uZGl0aW9uX3J1bGUgKTtcblxuICAgICAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWQgaGlnaGxpZ2h0IGZpZWxkcywgIGlmIHNvbWUgcmVxdWlyZWQgZmllbGRzIGFyZSBlbXB0eVxuICAgICAgICBpZiAoICgnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZmllbGRfaGlnaGxpZ2h0KSkgJiYgKCcnID09PSBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXInICkudmFsKCkpICl7XG4gICAgICAgICAgICB3cGJjX2ZpZWxkX2hpZ2hsaWdodCggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoICgnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZmllbGRfaGlnaGxpZ2h0KSkgJiYgKCcwJyA9PT0galF1ZXJ5KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZScgKS52YWwoKSkgKXtcbiAgICAgICAgICAgIHdwYmNfZmllbGRfaGlnaGxpZ2h0KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZScgKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV9zZWFzb25fX3Jlc2V0KGlkKXtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZSBvcHRpb246ZXEoMCknICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXInICkudmFsKCAnJyApO1xuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ190ZXh0YXJlYScgKS52YWwoICcnICk7XG4gICAgICAgIHdwYmNfc2V0X3Nob3J0Y29kZSgpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQ29uZGl0aW9uOiAgIHtzdGFydC1kYXkgY29uZGl0aW9uPVwic2Vhc29uXCIgZm9yPVwiTG93IHNlYXNvblwiIHZhbHVlPVwiMCwxLDVcIn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3N0YXJ0X2RheV9zZWFzb25fX2FkZCggaWQgKXtcblxuICAgICAgICB2YXIgc2Vhc29uX2ZpbHRlcl9uYW1lID0galF1ZXJ5KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZSBvcHRpb246c2VsZWN0ZWQnICkudGV4dCgpLnRyaW0oKTtcbiAgICAgICAgLy8gRXNjYXBlIHF1b3RlIHN5bWJvbHNcbiAgICAgICAgc2Vhc29uX2ZpbHRlcl9uYW1lID0gc2Vhc29uX2ZpbHRlcl9uYW1lLnJlcGxhY2UoL1tcXFwiXCJdL2csICdcXFxcXCInKTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAoJycgIT0gc2Vhc29uX2ZpbHRlcl9uYW1lKVxuICAgICAgICAgICAgJiYgKDAgIT0galF1ZXJ5KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZScgKS52YWwoKSlcblxuICAgICAgICApe1xuICAgICAgICAgICAgdmFyIGFjdGl2YXRlZF93ZWVrZGF5cyA9W107XG4gICAgICAgICAgICBmb3IgKCB2YXIgd2Vla2RheV9udW0gPSAwOyB3ZWVrZGF5X251bSA8IDg7IHdlZWtkYXlfbnVtKysgKXtcbiAgICAgICAgICAgICAgICBpZiAoIGpRdWVyeSggJyMnICsgaWQgKyAnX193ZWVrZGF5XycgKyB3ZWVrZGF5X251bSApLmlzKCAnOmNoZWNrZWQnICkgKXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGl2YXRlZF93ZWVrZGF5cy5wdXNoKCB3ZWVrZGF5X251bSApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFjdGl2YXRlZF93ZWVrZGF5cyA9IGFjdGl2YXRlZF93ZWVrZGF5cy5qb2luKCAnLCcgKTtcblxuICAgICAgICAgICAgaWYgKCAnJyAhPSBhY3RpdmF0ZWRfd2Vla2RheXMgKXtcblxuICAgICAgICAgICAgICAgIHZhciBleGlzdF9jb25maWd1cmF0aW9uID0galF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCk7XG5cbiAgICAgICAgICAgICAgICBleGlzdF9jb25maWd1cmF0aW9uID0gZXhpc3RfY29uZmlndXJhdGlvbi5yZXBsYWNlQWxsKCBcIn0se1wiLCAnfX5+eycgKVxuICAgICAgICAgICAgICAgIHZhciBjb25kaXRpb25fcnVsZV9hcnIgPSBleGlzdF9jb25maWd1cmF0aW9uLnNwbGl0KCAnfn4nICk7XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZW1wdHkgc3BhY2VzIGZyb20gIGFycmF5IDogJycgfCBcIlwiXG4gICAgICAgICAgICAgICAgY29uZGl0aW9uX3J1bGVfYXJyID0gY29uZGl0aW9uX3J1bGVfYXJyLmZpbHRlciggZnVuY3Rpb24gKCBuICl7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xuICAgICAgICAgICAgICAgIH0gKTtcblxuICAgICAgICAgICAgICAgIGNvbmRpdGlvbl9ydWxlX2Fyci5wdXNoKCAne3N0YXJ0LWRheSBjb25kaXRpb249XCJzZWFzb25cIiBmb3I9XCInICsgc2Vhc29uX2ZpbHRlcl9uYW1lICsgJ1wiIHZhbHVlPVwiJyArIGFjdGl2YXRlZF93ZWVrZGF5cyArICdcIn0nICk7XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgZHVwbGljYXRlcyBmcm9tICB0aGUgYXJyYXlcbiAgICAgICAgICAgICAgICBjb25kaXRpb25fcnVsZV9hcnIgPSBjb25kaXRpb25fcnVsZV9hcnIuZmlsdGVyKCBmdW5jdGlvbiAoIGl0ZW0sIHBvcyApe1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29uZGl0aW9uX3J1bGVfYXJyLmluZGV4T2YoIGl0ZW0gKSA9PT0gcG9zO1xuICAgICAgICAgICAgICAgIH0gKTtcbiAgICAgICAgICAgICAgICB2YXIgY29uZGl0aW9uX3J1bGUgPSBjb25kaXRpb25fcnVsZV9hcnIuam9pbiggJywnICk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCBjb25kaXRpb25fcnVsZSApO1xuXG4gICAgICAgICAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWQgaGlnaGxpZ2h0IGZpZWxkcywgIGlmIHNvbWUgcmVxdWlyZWQgZmllbGRzIGFyZSBlbXB0eVxuICAgICAgICBpZiAoICgnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZmllbGRfaGlnaGxpZ2h0KSkgJiYgKCcwJyA9PT0galF1ZXJ5KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZScgKS52YWwoKSkgKXtcbiAgICAgICAgICAgIHdwYmNfZmllbGRfaGlnaGxpZ2h0KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZScgKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3N0YXJ0X2RheV9zZWFzb25fX3Jlc2V0KGlkKXtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfX3NlYXNvbl9maWx0ZXJfbmFtZSBvcHRpb246ZXEoMCknICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApO1xuICAgICAgICBmb3IgKCB2YXIgd2Vla2RheV9udW0gPSAwOyB3ZWVrZGF5X251bSA8IDg7IHdlZWtkYXlfbnVtKysgKXtcbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBpZCArICdfX3dlZWtkYXlfJyArIHdlZWtkYXlfbnVtICkuaXMoICc6Y2hlY2tlZCcgKSApe1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX193ZWVrZGF5XycgKyB3ZWVrZGF5X251bSApLnByb3AoICdjaGVja2VkJywgZmFsc2UgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ190ZXh0YXJlYScgKS52YWwoICcnICk7XG4gICAgICAgIHdwYmNfc2V0X3Nob3J0Y29kZSgpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogQ29uZGl0aW9uOiAgIHtzZWxlY3QtZGF5IGNvbmRpdGlvbj1cImRhdGVcIiBmb3I9XCIyMDIzLTEwLTAxXCIgdmFsdWU9XCIyMCwyNSwzMC0zNVwifVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHdwYmNfc2hvcnRjb2RlX2NvbmZpZ19fc2VsZWN0X2RheV9mb3JkYXRlX19hZGQoaWQpe1xuXG4gICAgICAgIHZhciBzdGFydF9kYXRlX19mb3JkYXRlID0galF1ZXJ5KCAnIycgKyBpZCArICdfX2RhdGUnICkudmFsKCkudHJpbSgpO1xuICAgICAgICAvLyBSZW1vdmUgYWxsIHdvcmRzIGV4Y2VwdCBkaWdpdHMgYW5kICwgYW5kIC1cbiAgICAgICAgc3RhcnRfZGF0ZV9fZm9yZGF0ZSA9IHN0YXJ0X2RhdGVfX2ZvcmRhdGUucmVwbGFjZSggL1teMC05LV0vZywgJycgKTtcblxuICAgICAgICB2YXIgZ2xvYmFsUmVnZXggPSBuZXcgUmVnRXhwKCAvXlxcZHs0fS1bMDFdezF9XFxkezF9LVswMTIzXXsxfVxcZHsxfSQvLCAnZycgKTtcbiAgICAgICAgdmFyIGlzX3ZhbGlkX2RhdGUgPSBnbG9iYWxSZWdleC50ZXN0KCBzdGFydF9kYXRlX19mb3JkYXRlICk7XG4gICAgICAgIGlmICggIWlzX3ZhbGlkX2RhdGUgKXtcbiAgICAgICAgICAgIHN0YXJ0X2RhdGVfX2ZvcmRhdGUgPSAnJztcbiAgICAgICAgfVxuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF0ZScgKS52YWwoIHN0YXJ0X2RhdGVfX2ZvcmRhdGUgKTtcblxuICAgICAgICB2YXIgZGF5c19udW1iZXIgPSBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXInICkudmFsKCkudHJpbSgpO1xuICAgICAgICAvLyBSZW1vdmUgYWxsIHdvcmRzIGV4Y2VwdCBkaWdpdHMgYW5kICwgYW5kIC1cbiAgICAgICAgZGF5c19udW1iZXIgPSBkYXlzX251bWJlci5yZXBsYWNlKCAvW14wLTksLV0vZywgJycgKTtcbiAgICAgICAgZGF5c19udW1iZXIgPSBkYXlzX251bWJlci5yZXBsYWNlKCAvWyxdezIsfS9nLCAnLCcgKTtcbiAgICAgICAgZGF5c19udW1iZXIgPSBkYXlzX251bWJlci5yZXBsYWNlKCAvWy1dezIsfS9nLCAnLScgKTtcbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfX2RheXNfbnVtYmVyJyApLnZhbCggZGF5c19udW1iZXIgKTtcblxuICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAoJycgIT0gZGF5c19udW1iZXIpXG4gICAgICAgICAgICAmJiAoJycgIT0gc3RhcnRfZGF0ZV9fZm9yZGF0ZSlcbiAgICAgICAgICAgICYmICgwICE9IGpRdWVyeSggJyMnICsgaWQgKyAnX19zZWFzb25fZmlsdGVyX25hbWUnICkudmFsKCkpXG5cbiAgICAgICAgKXtcbiAgICAgICAgICAgIHZhciBleGlzdF9jb25maWd1cmF0aW9uID0galF1ZXJ5KCAnIycgKyBpZCArICdfdGV4dGFyZWEnICkudmFsKCk7XG5cbiAgICAgICAgICAgIGV4aXN0X2NvbmZpZ3VyYXRpb24gPSBleGlzdF9jb25maWd1cmF0aW9uLnJlcGxhY2VBbGwoXCJ9LHtcIiwgJ31+fnsnKVxuICAgICAgICAgICAgdmFyIGNvbmRpdGlvbl9ydWxlX2FyciA9IGV4aXN0X2NvbmZpZ3VyYXRpb24uc3BsaXQoICd+ficgKTtcblxuICAgICAgICAgICAgLy8gUmVtb3ZlIGVtcHR5IHNwYWNlcyBmcm9tICBhcnJheSA6ICcnIHwgXCJcIlxuICAgICAgICAgICAgY29uZGl0aW9uX3J1bGVfYXJyID0gY29uZGl0aW9uX3J1bGVfYXJyLmZpbHRlcihmdW5jdGlvbihuKXtyZXR1cm4gbjsgfSk7XG5cbiAgICAgICAgICAgIGNvbmRpdGlvbl9ydWxlX2Fyci5wdXNoKCAne3NlbGVjdC1kYXkgY29uZGl0aW9uPVwiZGF0ZVwiIGZvcj1cIicgKyBzdGFydF9kYXRlX19mb3JkYXRlICsgJ1wiIHZhbHVlPVwiJyArIGRheXNfbnVtYmVyICsgJ1wifScgKTtcblxuICAgICAgICAgICAgLy8gUmVtb3ZlIGR1cGxpY2F0ZXMgZnJvbSAgdGhlIGFycmF5XG4gICAgICAgICAgICBjb25kaXRpb25fcnVsZV9hcnIgPSBjb25kaXRpb25fcnVsZV9hcnIuZmlsdGVyKCBmdW5jdGlvbiAoIGl0ZW0sIHBvcyApeyByZXR1cm4gY29uZGl0aW9uX3J1bGVfYXJyLmluZGV4T2YoIGl0ZW0gKSA9PT0gcG9zOyB9ICk7XG4gICAgICAgICAgICB2YXIgY29uZGl0aW9uX3J1bGUgPSBjb25kaXRpb25fcnVsZV9hcnIuam9pbiggJywnICk7XG4gICAgICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ190ZXh0YXJlYScgKS52YWwoIGNvbmRpdGlvbl9ydWxlICk7XG5cbiAgICAgICAgICAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgICAgIH0gZWxzZVxuXG4gICAgICAgIC8vIFJlZCBoaWdobGlnaHQgZmllbGRzLCAgaWYgc29tZSByZXF1aXJlZCBmaWVsZHMgYXJlIGVtcHR5XG4gICAgICAgIGlmICggKCdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19maWVsZF9oaWdobGlnaHQpKSAmJiAoJycgPT09IGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXRlJyApLnZhbCgpKSApe1xuICAgICAgICAgICAgd3BiY19maWVsZF9oaWdobGlnaHQoICcjJyArIGlkICsgJ19fZGF0ZScgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoICgnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfZmllbGRfaGlnaGxpZ2h0KSkgJiYgKCcnID09PSBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF5c19udW1iZXInICkudmFsKCkpICl7XG4gICAgICAgICAgICB3cGJjX2ZpZWxkX2hpZ2hsaWdodCggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiB3cGJjX3Nob3J0Y29kZV9jb25maWdfX3NlbGVjdF9kYXlfZm9yZGF0ZV9fcmVzZXQoaWQpe1xuICAgICAgICBqUXVlcnkoICcjJyArIGlkICsgJ19fZGF0ZScgKS52YWwoICcnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX19kYXlzX251bWJlcicgKS52YWwoICcnICk7XG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3RleHRhcmVhJyApLnZhbCggJycgKTtcbiAgICAgICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG4gICAgfVxuXG5cblxuZnVuY3Rpb24gd3BiY19zaG9ydGNvZGVfY29uZmlnX191cGRhdGVfZWxlbWVudHNfaW5fdGltZWxpbmUoKXtcblxuICAgIHZhciB3cGJjX2lzX21hdHJpeCA9IGZhbHNlO1xuXG4gICAgaWYgKCBqUXVlcnkoICcjYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzJyApLmxlbmd0aCA+IDAgKSB7XG5cbiAgICAgICAgdmFyIGJvb2tpbmd0aW1lbGluZV93cGJjX211bHRpcGxlX3Jlc291cmNlc190ZW1wID0galF1ZXJ5KCAnI2Jvb2tpbmd0aW1lbGluZV93cGJjX211bHRpcGxlX3Jlc291cmNlcycgKS52YWwoKTtcblxuICAgICAgICBpZiAoICggYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzX3RlbXAgIT0gbnVsbCApICYmICggYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzX3RlbXAubGVuZ3RoID4gMCApICApe1xuXG4gICAgICAgICAgICBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J11cIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgZmFsc2UgKTtcbiAgICAgICAgICAgIGpRdWVyeSggXCIud3BiY19zY19jb250YWluZXJfX3Nob3J0Y29kZV9ib29raW5ndGltZWxpbmUgbGFiZWwud3BiYy1mb3JtLXJhZGlvXCIgKS5zaG93KCk7XG5cbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgKCBib29raW5ndGltZWxpbmVfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXNfdGVtcC5sZW5ndGggPiAxIClcbiAgICAgICAgICAgICAgICB8fCAgKCAoYm9va2luZ3RpbWVsaW5lX3dwYmNfbXVsdGlwbGVfcmVzb3VyY2VzX3RlbXAubGVuZ3RoID09IDEpICYmIChib29raW5ndGltZWxpbmVfd3BiY19tdWx0aXBsZV9yZXNvdXJjZXNfdGVtcFsgMCBdID09ICcwJykpXG4gICAgICAgICAgICApeyAgLy8gTWF0cml4XG4gICAgICAgICAgICAgICAgd3BiY19pc19tYXRyaXggPSB0cnVlO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nOTAnXVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPSc5MCddXCIgKS5wYXJlbnRzKCcud3BiYy1mb3JtLXJhZGlvJykuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nMzY1J11cIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nMzY1J11cIiApLnBhcmVudHMoJy53cGJjLWZvcm0tcmFkaW8nKS5oaWRlKCk7XG4gICAgICAgICAgICB9IGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2luZ2xlXG4gICAgICAgICAgICAgICAgalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddW3ZhbHVlPScxJ11cIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nMSddXCIgKS5wYXJlbnRzKCcud3BiYy1mb3JtLXJhZGlvJykuaGlkZSgpO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nNyddXCIgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTtcbiAgICAgICAgICAgICAgICBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J11bdmFsdWU9JzcnXVwiICkucGFyZW50cygnLndwYmMtZm9ybS1yYWRpbycpLmhpZGUoKTtcbiAgICAgICAgICAgICAgICBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J11bdmFsdWU9JzYwJ11cIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApO1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nNjAnXVwiICkucGFyZW50cygnLndwYmMtZm9ybS1yYWRpbycpLmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgaWYgKCBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J106Y2hlY2tlZFwiICkuaXMoJzpkaXNhYmxlZCcpICkge1xuICAgICAgICAgICAgICAgIGpRdWVyeSggXCJpbnB1dFtuYW1lPSdib29raW5ndGltZWxpbmVfd3BiY192aWV3X21vZGVfdGltZWxpbmVfbW9udGhzX251bV9pbl9yb3cnXVt2YWx1ZT0nMzAnXVwiICkucHJvcCggXCJjaGVja2VkXCIsIHRydWUgKTtcbiAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHZpZXdfZGF5c19udW1fdGVtcCA9IDMwO1xuICAgIGlmICggalF1ZXJ5KCBcImlucHV0W25hbWU9J2Jvb2tpbmd0aW1lbGluZV93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddOmNoZWNrZWRcIiApLmxlbmd0aCA+IDAgKXtcbiAgICAgICAgdmFyIHZpZXdfZGF5c19udW1fdGVtcCA9IHBhcnNlSW50KCBqUXVlcnkoIFwiaW5wdXRbbmFtZT0nYm9va2luZ3RpbWVsaW5lX3dwYmNfdmlld19tb2RlX3RpbWVsaW5lX21vbnRoc19udW1faW5fcm93J106Y2hlY2tlZFwiICkudmFsKCkudHJpbSgpICk7XG4gICAgfVxuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vIEhpZGUgb3IgU2hvdyBTY3JvbGxpbmcgRGF5cyBhbmQgTW9udGhzLCBkZXBlbmRpbmcgb24gZnJvbSB0eXBlIG9mIHZpZXcgYW5kIG51bWJlciBvZiBib29raW5nIHJlc291cmNlc1xuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICBqUXVlcnkoIFwiI3dwYmNfYm9va2luZ3RpbWVsaW5lX3Njcm9sbF9tb250aCwjd3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX2RheVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCBmYWxzZSApO1xuICAgIGpRdWVyeSggXCIud3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX21vbnRoLC53cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfZGF5XCIgKS5zaG93KCk7XG4gICAgLy8gTWF0cml4IC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICBpZiAoXG4gICAgICAgICAgKCB3cGJjX2lzX21hdHJpeCApICYmICggKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gMSApIHx8ICggdmlld19kYXlzX251bV90ZW1wID09IDcgKSApIC8vIERheSB8IFdlZWsgdmlld1xuICAgICAgICApIHtcbiAgICAgICAgICAgIGpRdWVyeSggXCIjd3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX21vbnRoXCIgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2Nyb2xsIE1vbnRoIE5PVCB3b3JraW5nXG4gICAgICAgICAgICBqUXVlcnkoICcud3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX21vbnRoJyApLmhpZGUoKTtcbiAgICAgICAgfVxuICAgIGlmIChcbiAgICAgICAgICAoIHdwYmNfaXNfbWF0cml4ICkmJiAoICggdmlld19kYXlzX251bV90ZW1wID09IDMwICkgfHwgKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gNjAgKSApIC8vIE1vbnRoIHZpZXdcbiAgICAgICAgKSB7XG4gICAgICAgICAgICBqUXVlcnkoIFwiI3dwYmNfYm9va2luZ3RpbWVsaW5lX3Njcm9sbF9kYXlcIiApLnByb3AoIFwiZGlzYWJsZWRcIiwgdHJ1ZSApOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNjcm9sbCBEYXlzIE5PVCB3b3JraW5nXG4gICAgICAgICAgICBqUXVlcnkoICcud3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX2RheScgKS5oaWRlKCk7XG4gICAgICAgIH1cbiAgICAvLyBTaW5nbGUgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIGlmIChcbiAgICAgICAgICAoICEgd3BiY19pc19tYXRyaXggKSAmJiAoICggdmlld19kYXlzX251bV90ZW1wID09IDMwICkgfHwgKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gOTAgKSApICAvLyBNb250aCB8IDMgTW9udGhzIHZpZXcgKGxpa2Ugd2VlayB2aWV3KVxuICAgICAgICApIHtcbiAgICAgICAgICAgIGpRdWVyeSggXCIjd3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX21vbnRoXCIgKS5wcm9wKCBcImRpc2FibGVkXCIsIHRydWUgKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2Nyb2xsIE1vbnRoIE5PVCB3b3JraW5nXG4gICAgICAgICAgICBqUXVlcnkoICcud3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX21vbnRoJyApLmhpZGUoKTtcbiAgICAgICAgfVxuICAgIGlmIChcbiAgICAgICAgICAoICEgd3BiY19pc19tYXRyaXggKSYmICggKCB2aWV3X2RheXNfbnVtX3RlbXAgPT0gMzY1ICkgKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFllYXIgdmlld1xuICAgICAgICApIHtcbiAgICAgICAgICAgIGpRdWVyeSggXCIjd3BiY19ib29raW5ndGltZWxpbmVfc2Nyb2xsX2RheVwiICkucHJvcCggXCJkaXNhYmxlZFwiLCB0cnVlICk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2Nyb2xsIERheXMgTk9UIHdvcmtpbmdcbiAgICAgICAgICAgIGpRdWVyeSggJy53cGJjX2Jvb2tpbmd0aW1lbGluZV9zY3JvbGxfZGF5JyApLmhpZGUoKTtcbiAgICAgICAgfVxuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuXG4gICAgcmV0dXJuIFsgd3BiY19pc19tYXRyaXgsIHZpZXdfZGF5c19udW1fdGVtcCBdO1xufVxuXG5cbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCl7XG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLyBbYm9va2luZyAuLi4gXVxuXG4gICAgdmFyIHNob3J0Y29kZV9hcnIgPSBbJ2Jvb2tpbmcnLCAnYm9va2luZ2NhbGVuZGFyJywgJ2Jvb2tpbmdzZWxlY3QnLCAnYm9va2luZ3RpbWVsaW5lJywgJ2Jvb2tpbmdmb3JtJywgJ2Jvb2tpbmdzZWFyY2gnLCAnYm9va2luZ290aGVyJywgJ2Jvb2tpbmdfaW1wb3J0X2ljcycgLCAnYm9va2luZ19saXN0aW5nX2ljcycsICdib29raW5nX2FwcG9pbnRtZW50JywgJ2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3InXTtcblxuICAgIGZvciAoIHZhciBzaG9ydGNkZV9rZXkgaW4gc2hvcnRjb2RlX2FyciApe1xuXG4gICAgICAgIHZhciBpZCA9IHNob3J0Y29kZV9hcnJbIHNob3J0Y2RlX2tleSBdO1xuXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgLy8gSGlkZSBieSBTaXplIHNlY3Rpb25zXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgalF1ZXJ5KCAnLicgKyBpZCArICdfd3BiY19zaXplX3dwYmNfc2NfY2FsZW5kYXJfc2l6ZScgKS5oaWRlKCk7XG4gICAgICAgIGpRdWVyeSggJy4nICsgaWQgKyAnX3dwYmNfcG9wdXBfd3BiY19zY19ib29raW5nX3BvcHVwJyApLmhpZGUoKTtcblxuICAgICAgICAvLyBvcHRpb25zIDo6IFNob3cgLyBIaWRlIFNJWkUgY2FsZW5kYXIgIHNlY3Rpb25cbiAgICAgICAgalF1ZXJ5KCAnIycgKyBpZCArICdfd3BiY19zaXplX2VuYWJsZWQnICkub24oICdjaGFuZ2UnLCB7J2lkJzogaWR9LCBmdW5jdGlvbiggZXZlbnQgKXtcbiAgICAgICAgICAgIGlmICggalF1ZXJ5KCAnIycgKyBldmVudC5kYXRhLmlkICsgJ193cGJjX3NpemVfZW5hYmxlZCcgKS5pcyggJzpjaGVja2VkJyApICl7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLicgKyBldmVudC5kYXRhLmlkICsgJ193cGJjX3NpemVfd3BiY19zY19jYWxlbmRhcl9zaXplJyApLnNob3coKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLicgKyBldmVudC5kYXRhLmlkICsgJ193cGJjX3NpemVfd3BiY19zY19jYWxlbmRhcl9zaXplJyApLmhpZGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSApO1xuXG4gICAgICAgIGpRdWVyeSggJyMnICsgaWQgKyAnX3dwYmNfcG9wdXBfZW5hYmxlZCcgKS5vbiggJ2NoYW5nZScsIHsnaWQnOiBpZH0sIGZ1bmN0aW9uKCBldmVudCApe1xuICAgICAgICAgICAgaWYgKCBqUXVlcnkoICcjJyArIGV2ZW50LmRhdGEuaWQgKyAnX3dwYmNfcG9wdXBfZW5hYmxlZCcgKS5pcyggJzpjaGVja2VkJyApICl7XG4gICAgICAgICAgICAgICAgalF1ZXJ5KCAnLicgKyBldmVudC5kYXRhLmlkICsgJ193cGJjX3BvcHVwX3dwYmNfc2NfYm9va2luZ19wb3B1cCcgKS5zaG93KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGpRdWVyeSggJy4nICsgZXZlbnQuZGF0YS5pZCArICdfd3BiY19wb3B1cF93cGJjX3NjX2Jvb2tpbmdfcG9wdXAnICkuaGlkZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ICk7XG5cbiAgICAgICAgLy8gSWYgd2UgY2hhbmdlZCBudW1iZXIgb2YgbW9udGhzIGluICdTZXR1cCBTaXplICYgU3RydWN0dXJlJyB0aGVuICBjaGFuZ2UgZ2VuZXJhbCAnVmlzaWJsZSBtb250aHMnIG51bWJlciAgICAgIC8vIEZpeEluOiAxMC4wLjAuNC5cbiAgICAgICAgalF1ZXJ5KCAgJyMnICsgaWQgKyAnX3dwYmNfc2l6ZV9tb250aHNfbnVtX2luX3JvdycgICAgICAgICAgICAgICAgICAgLy8gLSBNb250aCBOdW0gaW4gUm93XG4gICAgICAgICAgICAgICAgICAgICkub24oICdjaGFuZ2UnLCB7J2lkJzogaWR9LCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgICAgICBqUXVlcnkoICcjJyArIGV2ZW50LmRhdGEuaWQgKyAnX3dwYmNfbnVtbW9udGhzIG9wdGlvblt2YWx1ZT1cIicgKyBwYXJzZUludCggalF1ZXJ5KCAnIycgKyBldmVudC5kYXRhLmlkICsgJ193cGJjX3NpemVfbW9udGhzX251bV9pbl9yb3cnICkudmFsKCkudHJpbSgpICkgKyAnXCJdJyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKTsvLy50cmlnZ2VyKCdjaGFuZ2UnKTtcbiAgICAgICAgICAgIGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX2ZpZWxkX2hpZ2hsaWdodCkgKXtcbiAgICAgICAgICAgICAgICB3cGJjX2ZpZWxkX2hpZ2hsaWdodCggJyMnICsgZXZlbnQuZGF0YS5pZCArICdfd3BiY19udW1tb250aHMnICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgICAgICAvLyBVcGRhdGUgU2hvcnRjb2RlIG9uIGNoYW5naW5nOiBTaXplXG4gICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAgalF1ZXJ5KCAgICcjJyArIGlkICsgJ193cGJjX3NpemVfZW5hYmxlZCcgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNpemUgT24gfCBPZmZcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3NpemVfbW9udGhzX251bV9pbl9yb3cnICAgICAgICAgICAgICAgICAgIC8vIC0gTW9udGggTnVtIGluIFJvd1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc2l6ZV9jYWxlbmRhcl93aWR0aCcgICAgICAgICAgICAgICAgICAgICAgLy8gLSBXaWR0aFxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc2l6ZV9jYWxlbmRhcl93aWR0aF9weF9wcicgICAgICAgICAgICAgICAgLy8gLSBXaWR0aCBQUyB8ICVcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3NpemVfY2FsZW5kYXJfY2VsbF9oZWlnaHQnICAgICAgICAgICAgICAgIC8vIC0gQ2VsbCBIZWlnaHRcblxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfcG9wdXBfZW5hYmxlZCcgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQm9va2luZyBmb3JtIHBvcHVwIE9uIHwgT2ZmXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19wb3B1cF9idXR0b25fdGl0bGUnICAgICAgICAgICAgICAgICAgICAgICAvLyBQb3B1cCBidXR0b24gdGl0bGVcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3BvcHVwX3RpdGxlJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBvcHVwIHRpdGxlXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19wb3B1cF9idXR0b25fY2xhc3MnICAgICAgICAgICAgICAgICAgICAgICAvLyBQb3B1cCBidXR0b24gY2xhc3NcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3BvcHVwX21vZGFsX2NsYXNzJyAgICAgICAgICAgICAgICAgICAgICAgIC8vIFBvcHVwIG1vZGFsIGNsYXNzXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19wb3B1cF9zaXplJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQb3B1cCBzaXplXG5cbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ3dwYmNfc2VsZWN0X2RheV93ZWVrZGF5X3RleHRhcmVhJyAgICAgICAgICAgICAgIC8vIFJ1bGUgV2Vla2RheVxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnd3BiY19zZWxlY3RfZGF5X3NlYXNvbl90ZXh0YXJlYScgICAgICAgICAgICAgICAgLy8gUnVsZSBTZWFzb25cbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ3dwYmNfc3RhcnRfZGF5X3NlYXNvbl90ZXh0YXJlYScgICAgICAgICAgICAgICAgIC8vIFJ1bGUgU2Vhc29uIC0gU3RhcnQgZGF5XG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICd3cGJjX3NlbGVjdF9kYXlfZm9yZGF0ZV90ZXh0YXJlYScgICAgICAgICAgICAgICAvLyBSdWxlIERhdGVcblxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfcmVzb3VyY2VfaWQnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gUmVzb3VyY2UgSURcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2N1c3RvbV9mb3JtJyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEN1c3RvbSBGb3JtXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19udW1tb250aHMnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBOdW0gTW9udGhzXG5cbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3N0YXJ0bW9udGhfYWN0aXZlJyAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RhcnQgTW9udGggRW5hYmxlXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zdGFydG1vbnRoX3llYXInICAgICAgICAgICAgICAgICAgICAgICAgIC8vICAtIFllYXJcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3N0YXJ0bW9udGhfbW9udGgnICAgICAgICAgICAgICAgICAgICAgICAgLy8gIC0gTW9udGhcblxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfc3RhcnRfYWN0aXZlJyAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RhcnQgTW9udGggRW5hYmxlXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF95ZWFyJyAgICAgICAgICAgICAgICAgICAgICAgICAvLyAgLSBZZWFyXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19zdGFydF9tb250aCcgICAgICAgICAgICAgICAgICAgICAgICAvLyAgLSBNb250aFxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfc3RhcnRfZGF0ZScgICAgICAgICAgICAgICAgICAgICAgICAvLyAgLSBNb250aFxuXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfYWN0aXZlJyAgICAgICAgICAgICAgICAgICAgICAgLy8gU3RhcnQgTW9udGggRW5hYmxlXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfeWVhcicgICAgICAgICAgICAgICAgICAgICAgICAgLy8gIC0gWWVhclxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfY2FsZW5kYXJfZGF0ZXNfZW5kX21vbnRoJyAgICAgICAgICAgICAgICAgICAgICAgIC8vICAtIE1vbnRoXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19jYWxlbmRhcl9kYXRlc19lbmRfZGF0ZScgICAgICAgICAgICAgICAgICAgICAgICAvLyAgLSBNb250aFxuXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19hZ2dyZWdhdGUnICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFnZ3JlZ2F0ZVxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfYWdncmVnYXRlX19ib29raW5nc19vbmx5JyAgICAgICAgICAgICAgICAvLyBhZ2dyZWdhdGUgb3B0aW9uXG5cbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX211bHRpcGxlX3Jlc291cmNlcycgICAgICAgICAgICAgICAgICAgICAvLyBbYm9va2luZ3NlbGVjdF0gLSBNdWx0aXBsZSBSZXNvdXJjZXNcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3NlbGVjdGVkX3Jlc291cmNlJyAgICAgICAgICAgICAgICAgICAgICAvLyBbYm9va2luZ3NlbGVjdF0gLSBTZWxlY3RlZCBSZXNvdXJjZVxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfdGV4dF9sYWJlbCcgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFtib29raW5nc2VsZWN0XSAtIExhYmVsXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19maXJzdF9vcHRpb25fdGl0bGUnICAgICAgICAgICAgICAgICAgICAgLy8gW2Jvb2tpbmdzZWxlY3RdIC0gRmlyc3QgIE9wdGlvblxuXG4gICAgICAgICAgICAgICAgLy8gVGltZUxpbmVcbiAgICAgICAgICAgICAgICArXCIsaW5wdXRbbmFtZT0nXCIrIGlkICtcIl93cGJjX3ZpZXdfbW9kZV90aW1lbGluZV9tb250aHNfbnVtX2luX3JvdyddXCJcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3RleHRfbGFiZWxfdGltZWxpbmUnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX2RheXMnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zY3JvbGxfdGltZWxpbmVfc2Nyb2xsX21vbnRoJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc3RhcnRfZGF0ZV90aW1lbGluZV9hY3RpdmUnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX3llYXInXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zdGFydF9kYXRlX3RpbWVsaW5lX21vbnRoJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc3RhcnRfZGF0ZV90aW1lbGluZV9kYXknXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zdGFydF9lbmRfdGltZV90aW1lbGluZV9zdGFydHRpbWUnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zdGFydF9lbmRfdGltZV90aW1lbGluZV9lbmR0aW1lJ1xuXG4gICAgICAgICAgICAgICAgLy8gRm9ybSBPbmx5XG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19ib29raW5nX2RhdGVfeWVhcidcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV9tb250aCdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX2Jvb2tpbmdfZGF0ZV9kYXknXG5cbiAgICAgICAgICAgICAgICAvLyBbYm9va2luZ3NlYXJjaCAuLi5dXG4gICAgICAgICAgICAgICAgK1wiLGlucHV0W25hbWU9J1wiKyBpZCArXCJfd3BiY19zZWFyY2hfZm9ybV9yZXN1bHRzJ11cIlxuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3dwYmNfc2VhcmNoX25ld19wYWdlX2VuYWJsZWQnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfd3BiY19zZWFyY2hfbmV3X3BhZ2VfdXJsJ1xuICAgICAgICAgICAgICAgIC8vICsnLCMnICsgaWQgKyAnX3dwYmNfc2VhcmNoX2hlYWRlcicgICAgICAgICAgICAgICAgICAgICAgIC8vIEZpeEluOiAxMC4wLjAuNDEuXG4gICAgICAgICAgICAgICAgLy8gKycsIycgKyBpZCArICdfd3BiY19zZWFyY2hfbm90aGluZ19mb3VuZCdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3NlYXJjaF9mb3JfdXNlcnMnXG5cbiAgICAgICAgICAgICAgICAvLyBbYm9va2luZ290aGVyIC4uLiBdXG4gICAgICAgICAgICAgICAgK1wiLGlucHV0W25hbWU9J1wiKyBpZCArXCJfd3BiY19zaG9ydGNvZGVfdHlwZSddXCJcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3Jlc291cmNlX3Nob3cnXG5cbiAgICAgICAgICAgICAgICAvL2Jvb2tpbmdfaW1wb3J0X2ljcyAsIGJvb2tpbmdfbGlzdGluZ19pY3NcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ193cGJjX3VybCdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ19mcm9tJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX2Zyb21fb2Zmc2V0J1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX2Zyb21fb2Zmc2V0X3R5cGUnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfdW50aWwnXG4gICAgICAgICAgICAgICAgKycsIycgKyBpZCArICdfdW50aWxfb2Zmc2V0J1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX3VudGlsX29mZnNldF90eXBlJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX2NvbmRpdGlvbnNfaW1wb3J0J1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX2NvbmRpdGlvbnNfZXZlbnRzJ1xuICAgICAgICAgICAgICAgICsnLCMnICsgaWQgKyAnX2NvbmRpdGlvbnNfbWF4X251bSdcbiAgICAgICAgICAgICAgICArJywjJyArIGlkICsgJ19zaWxlbmNlJ1xuICAgICAgICAgICAgKS5vbiggJ2NoYW5nZScsIHsnaWQnOiBpZH0sIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyggJ29uIGNoYW5nZSB3cGJjX3NldF9zaG9ydGNvZGUnLCBldmVudC5kYXRhLmlkICk7XG4gICAgICAgICAgICAgICAgICAgIHdwYmNfc2V0X3Nob3J0Y29kZSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgd3BiY19zZXRfc2hvcnRjb2RlKCk7XG5cbiAgICBqUXVlcnkoICcud3BiY19zaG9ydGNvZGVfY29uZmlnX193b3JrZmxvd19wYXJhbWV0ZXInICkub24oICdjaGFuZ2UgaW5wdXQnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuICAgICAgICBpZiAoICdjaGFuZ2UnID09PSBldmVudC50eXBlICkge1xuICAgICAgICAgICAgd3BiY19zaG9ydGNvZGVfY29uZmlnX19hcHBseV9yZXNvdXJjZV9saXN0X3ByZXNldCggalF1ZXJ5KCB0aGlzICkgKTtcbiAgICAgICAgfVxuICAgICAgICB3cGJjX3NldF9zaG9ydGNvZGUoKTtcbiAgICB9ICk7XG59KTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxpREFBaURBLENBQUVDLFNBQVMsRUFBRztFQUNwRSxJQUFJQyxjQUFjLEdBQUcsRUFBRTtFQUN2QkMsTUFBTSxDQUFFRixTQUFTLElBQUksRUFBRyxDQUFDLENBQUNHLEtBQUssQ0FBRSxTQUFVLENBQUMsQ0FBQ0MsT0FBTyxDQUFFLFVBQVdDLE1BQU0sRUFBRztJQUN0RSxJQUFJQyxhQUFhLEdBQUdDLFFBQVEsQ0FBRUYsTUFBTSxFQUFFLEVBQUcsQ0FBQztJQUMxQyxJQUFLQyxhQUFhLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLTCxjQUFjLENBQUNPLE9BQU8sQ0FBRUYsYUFBYyxDQUFDLEVBQUc7TUFDdkVMLGNBQWMs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QSxFQUFFLEdBQUc7O0lBRWI7SUFBQSxFQUNDLElBQUksR0FBR0EsRUFBRSxHQUFHLHlCQUF5QixHQUNyQyxJQUFJLEdBQUdBLEVBQUUsR0FBRywwQkFBMEIsR0FDdEMsSUFBSSxHQUFHQSxFQUFFLEdBQUc7O0lBRWI7SUFBQSxFQUNDLGVBQWUsR0FBRUEsRUFBRSxHQUFFLDZCQUE2QixHQUNsRCxJQUFJLEdBQUdBLEVBQUUsR0FBRywrQkFBK0IsR0FDM0MsSUFBSSxHQUFHQSxFQUFFLEdBQUc7SUFDYjtJQUNBO0lBQUEsRUFDQyxJQUFJLEdBQUdBLEVBQUUsR0FBRzs7SUFFYjtJQUFBLEVBQ0MsZUFBZSxHQUFFQSxFQUFFLEdBQUUsd0JBQXdCLEdBQzdDLElBQUksR0FBR0EsRUFBRSxHQUFHOztJQUViO0lBQUEsRUFDQyxJQUFJLEdBQUdBLEVBQUUsR0FBRyxXQUFXLEdBQ3ZCLElBQUksR0FBR0EsRUFBRSxHQUFHLE9BQU8sR0FDbkIsSUFBSSxHQUFHQSxFQUFFLEdBQUcsY0FBYyxHQUMxQixJQUFJLEdBQUdBLEVBQUUsR0FBRyxtQkFBbUIsR0FDL0IsSUFBSSxHQUFHQSxFQUFFLEdBQUcsUUFBUSxHQUNwQixJQUFJLEdBQUdBLEVBQUUsR0FBRyxlQUFlLEdBQzNCLElBQUksR0FBR0EsRUFBRSxHQUFHLG9CQUFvQixHQUNoQyxJQUFJLEdBQUdBLEVBQUUsR0FBRyxvQkFBb0IsR0FDaEMsSUFBSSxHQUFHQSxFQUFFLEdBQUcsb0JBQW9CLEdBQ2hDLElBQUksR0FBR0EsRUFBRSxHQUFHLHFCQUFxQixHQUNqQyxJQUFJLEdBQUdBLEVBQUUsR0FBRyxVQUNqQixDQUFDLENBQUMrRSxFQUFFLENBQUUsUUFBUSxFQUFFO01BQUMsSUFBSSxFQUFFL0U7SUFBRSxDQUFDLEVBQUUsVUFBU2dGLEtBQUssRUFBQztNQUNuQztNQUNBbEosa0JBQWtCLENBQUMsQ0FBQztJQUM1QixDQUFDLENBQUM7RUFDVjtFQUNBO0VBQ0FBLGtCQUFrQixDQUFDLENBQUM7RUFFcEJQLE1BQU0sQ0FBRSw0Q0FBNkMsQ0FBQyxDQUFDd0osRUFBRSxDQUFFLGNBQWMsRUFBRSxVQUFXQyxLQUFLLEVBQUc7SUFDMUYsSUFBSyxRQUFRLEtBQUtBLEtBQUssQ0FBQ0MsSUFBSSxFQUFHO01BQzNCbEosaURBQWlELENBQUVSLE1BQU0sQ0FBRSxJQUFLLENBQUUsQ0FBQztJQUN2RTtJQUNBTyxrQkFBa0IsQ0FBQyxDQUFDO0VBQ3hCLENBQUUsQ0FBQztBQUNQLENBQUMsQ0FBQyIsImlnbm9yZUxpc3QiOltdfQ==
