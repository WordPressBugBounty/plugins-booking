"use strict";

/**
 *  Add 'last_selected', 'current' CSS classes  on FOCUS to table rows
 */
(function ($) {
  var controlled = false;
  var shifted = false;
  var hasFocus = false;
  $(document).on('keyup keydown', function (e) {
    shifted = e.shiftKey;
    controlled = e.ctrlKey || e.metaKey;
  });
  $('.wpbc_input_table').on('focus click', 'input', function (e) {
    var this_closest_table = $(this).closest('table');
    var this_closest_row = $(this).closest('tr');
    if (e.type == 'focus' && hasFocus != this_closest_row.index() || e.type == 'click' && $(this).is(':focus')) {
      hasFocus = this_closest_row.index();
      if (!shifted && !controlled) {
        $('tr', this_closest_table).removeClass('current').removeClass('last_selected');
        this_closest_row.addClass('current').addClass('last_selected');
      } else if (shifted) {
        $('tr', this_closest_table).removeClass('current');
        this_closest_row.addClass('selected_now').addClass('current');
        if ($('tr.last_selected', this_closest_table).size() > 0) {
          if (this_closest_row.index() > $('tr.last_selected', this_closest_table).index()) {
            $('tr', this_closest_table).slice($('tr.last_selected', this_closest_table).index(), this_closest_row.index()).addClass('current');
          } else {
            $('tr', this_closest_table).slice(this_closest_row.index(), $('tr.last_selected', this_closest_table).index() + 1).addClass('current');
          }
        }
        $('tr', this_closest_table).removeClass('last_selected');
        this_closest_row.addClass('last_selected');
      } else {
        $('tr', this_closest_table).removeClass('last_selected');
        if (controlled && $(this).closest('tr').is('.current')) {
          this_closest_row.removeClass('current');
        } else {
          this_closest_row.addClass('current').addClass('last_selected');
        }
      }
      $('tr', this_closest_table).removeClass('selected_now');
    }
  }).on('blur', 'input', function (e) {
    hasFocus = false;
  });
})(jQuery);

// Make Table sortable
function wpbc_make_table_sortable() {
  jQuery('.wpbc_input_table tbody th').css('cursor', 'move');
  jQuery('.wpbc_input_table tbody td.sort').css('cursor', 'move');
  jQuery('.wpbc_input_table.sortable tbody').sortable({
    items: 'tr',
    cursor: 'move',
    axis: 'y',
    // connectWith: ".wpbc_table_form_free tbody",					//// FixIn: 10.1.2.2.
    // //axis:'y',
    scrollSensitivity: 40,
    forcePlaceholderSize: true,
    helper: 'clone',
    opacity: 0.65,
    placeholder: '.wpbc_input_table .sort',
    start: function start(event, ui) {
      ui.item.css('background-color', '#f6f6f6');
    },
    stop: function stop(event, ui) {
      ui.item.removeAttr('style');
    }
  });
}

// Activate row delete
function wpbc_activate_table_row_delete(del_btn_css_class, is_confirm) {
  // Delete Row
  jQuery(del_btn_css_class).on('click', function () {
    // FixIn: 8.7.11.12.

    if (true === is_confirm) {
      if (!wpbc_are_you_sure('Do you really want to do this ?')) {
        return false;
      }
    }
    var $current = jQuery(this).closest('tr');
    if ($current.size() > 0) {
      $current.each(function () {
        jQuery(this).remove();
      });
      return true;
    }
    return false;
  });
}

//////////////////////////////////////////////////////////
// Fields Generator Section
//////////////////////////////////////////////////////////

/**
 * Check  Name  in  "field form" about possible usage of this name and about  any Duplicates in Filds Table
 * @param {string} field_name
 */
function wpbc_check_typed_name(field_name) {
  // Set Name only Letters
  if (jQuery('#' + field_name + '_name').val() != '' && !jQuery('#' + field_name + '_name').is(':disabled')) {
    var p_name = jQuery('#' + field_name + '_name').val();
    p_name = p_name.replace(/[^A-Za-z0-9_-]*[0-9]*$/g, '').replace(/[^A-Za-z0-9_-]/g, '');
    p_name = p_name.toLowerCase();
    jQuery('input[name^=form_field_name]').each(function () {
      var text_value = jQuery(this).val();
      if (text_value == p_name) {
        // error element with this name exist

        p_name += '_' + Math.round(new Date().getTime()) + '_rand'; //Add random sufix
      }
    });
    jQuery('#' + field_name + '_name').val(p_name);
  }
}

/** Reset to default values all Form  fields for creation new fields */
function wpbc_reset_all_forms() {
  jQuery('.wpbc_table_form_free tr').removeClass('highlight');
  jQuery('.wpbc_add_field_row').hide();
  jQuery('.wpbc_edit_field_row').hide();
  var field_type_array = ['text', 'textarea', 'select', 'selectbox', 'checkbox', 'rangetime']; //FixIn: TimeFreeGenerator
  var field_type;
  for (var i = 0; i < field_type_array.length; i++) {
    field_type = field_type_array[i];
    if (!jQuery('#' + field_type + '_field_generator_name').is(':disabled')) {
      //FixIn: TimeFreeGenerator
      jQuery('#' + field_type + '_field_generator_active').prop('checked', true);
      jQuery('#' + field_type + '_field_generator_required').prop('checked', false);
      jQuery('#' + field_type + '_field_generator_label').val('');
      jQuery('#' + field_type + '_field_generator_name').prop('disabled', false);
      jQuery('#' + field_type + '_field_generator_name').val('');
      jQuery('#' + field_type + '_field_generator_value').val('');
    }
  }
}

/**
 * Show selected Add New Field form, and reset fields in this form
 *
 * @param string selected_field_value
 */
function wpbc_show_fields_generator(selected_field_value) {
  wpbc_reset_all_forms();
  if (selected_field_value == 'edit_rangetime') {
    // this field already  exist  in the booking form,  and thats why  we can  not add a new field,  and instead of that  edit it.
    var range_time_edit_field = jQuery('.wpbc_table_form_free :input[value="rangetime"]');
    var range_time_field_num = 0;
    if (range_time_edit_field.length > 0) {
      var range_time_edit_field_name = jQuery(range_time_edit_field.get(0)).attr('name');
      range_time_edit_field_name = range_time_edit_field_name.replaceAll('form_field_name[', '').replaceAll(']', '');
      range_time_field_num = parseInt(range_time_edit_field_name);
      if (range_time_field_num > 0) {
        wpbc_start_edit_form_field(range_time_field_num);
      }
    }
    if (0 == range_time_field_num) {
      //alert( 'Ups... Something wrong.' );
      selected_field_value = 'rangetime';
    } else {
      return;
    }
  }
  if (selected_field_value == 'selector_hint') {
    jQuery('.metabox_wpbc_form_field_free_generator').hide();
    jQuery('#wpbc_form_field_free input.wpbc_submit_button[type="submit"],input.wpbc_submit_button[type="button"]').show(); // FixIn: 8.7.11.7.
    jQuery('#wpbc_settings__form_fields__toolbar').show();
  } else {
    jQuery('.metabox_wpbc_form_field_free_generator').show();
    jQuery('.wpbc_field_generator').hide();
    jQuery('.wpbc_field_generator_' + selected_field_value).show();
    jQuery('#wpbc_form_field_free_generator_metabox h3.hndle span').html(jQuery('#select_form_help_shortcode option:selected').text());
    jQuery('.wpbc_add_field_row').show();
    jQuery('#wpbc_form_field_free input.wpbc_submit_button[type="submit"],input.wpbc_submit_button[type="button"]').hide(); // FixIn: 8.7.11.7.
    jQuery('#wpbc_settings__form_fields__toolbar').hide();
  }
}

/** Hide all Add New Field forms, and reset fields in these forms*/
function wpbc_hide_fields_generators() {
  wpbc_reset_all_forms();
  jQuery('.metabox_wpbc_form_field_free_generator').hide();
  jQuery('#select_form_help_shortcode>option:eq(0)').attr('selected', true);
  jQuery('#wpbc_form_field_free input.wpbc_submit_button[type="submit"],input.wpbc_submit_button[type="button"]').show(); // FixIn: 8.7.11.7.
  jQuery('#wpbc_settings__form_fields__toolbar').show();
}

/**
 * Add New Row with new Field to Table and Submit Saving changes.
 *
 * @param {string} field_name
 * @param {string} field_type
 */
function wpbc_add_field(field_name, field_type) {
  //FixIn: TimeFreeGenerator
  if ('rangetime_field_generator' == field_name) {
    var replaced_result = wpbc_get_saved_value_from_timeslots_table();
    if (false === replaced_result) {
      wpbc_hide_fields_generators();
      //TOO: Show warning at  the top of page,  about error during saving timeslots
      console.log('error during parsing timeslots tbale and savig it.');
      return;
    }
  }
  if (jQuery('#' + field_name + '_name').val() != '') {
    wpbc_check_typed_name(field_name);
    var row_num = jQuery('.wpbc_table_form_free tbody tr').length + Math.round(new Date().getTime());
    var row_active = 'Off';
    var row_active_checked = '';
    if (jQuery('#' + field_name + '_active').is(":checked")) {
      row_active = 'On';
      row_active_checked = ' checked="checked" ';
    }
    var row_required = 'Off';
    var row_required_checked = '';
    if (jQuery('#' + field_name + '_required').is(":checked")) {
      row_required = 'On';
      row_required_checked = ' checked="checked" ';
    }
    var row;
    row = '<tr class="account ui-sortable-handle">';

    ////////////////////////////////////////////////////////////
    row += '<td class="sort" style="cursor: move;"><span class="wpbc_icn_drag_indicator" aria-hidden="true"></span></td>';
    row += '<td class="field_active">';
    row += '<input type="checkbox" name="form_field_active[' + row_num + ']" value="' + row_active + '" ' + row_active_checked + ' autocomplete="off" />';
    row += '</td>';

    ////////////////////////////////////////////////////////////
    row += '<td class="field_label">';

    //row +=      '<legend class="screen-reader-text"><span>' + jQuery('#' + field_name + '_label').val() + '</span></legend>';

    row += '<input type="text" name="form_field_label[' + row_num + ']" value="' + jQuery('#' + field_name + '_label').val() + '" placeholder="' + jQuery('#' + field_name + '_label').val() + '" class="regular-text" autocomplete="off" />';
    row += '<div class="field_type_name_description">';
    //row +=        			'<?php echo esc_js( __( 'Type', 'booking' ) ); ?>: <div class="field_type_name_value">' +field_type+ '</div>';
    row += 'Type: <div class="field_type_name_value">' + field_type + '</div>';
    row += '<span class="field_type_name_separator">|</span>';
    //row +=        			'<?php echo esc_js( __( 'Name', 'booking' ) ); ?>: <div class="field_type_name_value">' + jQuery('#' + field_name + '_name').val() + '</div>';
    row += 'Name: <div class="field_type_name_value">' + jQuery('#' + field_name + '_name').val() + '</div>';
    row += '</div>';
    row += '<input type="hidden" value="' + ('select' == field_type ? 'selectbox' : field_type) + '"  name="form_field_type[' + row_num + ']" autocomplete="off" />';
    row += '<input type="hidden" value="' + jQuery('#' + field_name + '_name').val() + '"  name="form_field_name[' + row_num + ']" autocomplete="off" />';
    row += '<input type="hidden" value="' + (jQuery('#' + field_name + '_value').length ? jQuery('#' + field_name + '_value').val() : '') + '"  name="form_field_value[' + row_num + ']" autocomplete="off" />';
    row += '</td>';

    ////////////////////////////////////////////////////////////
    row += '<td class="field_required">';

    //FixIn:  TimeFreeGenerator
    if ('rangetime' == field_name) {
      row += '<input type="checkbox" disabled="DISABLED" name="form_field_required[' + row_num + ']" value="' + 'On' + '" ' + ' checked="checked" ' + ' autocomplete="off" />';
    } else {
      row += '<input type="checkbox" name="form_field_required[' + row_num + ']" value="' + row_required + '" ' + row_required_checked + ' autocomplete="off" />';
    }
    row += '</td>';

    ////////////////////////////////////////////////////////////
    // row += '<td class="field_options">';
    // row +=        '<input type="text" disabled="DISABLED" value="' + field_type + ' | ' + jQuery('#' + field_name + '_name').val() + '"  autocomplete="off" />';
    // row += '</td>';

    ////////////////////////////////////////////////////////////
    row += '<td class="field_options">';

    //row +=      '<a href="javascript:void(0)" class="tooltip_top button-secondary button" title="<?php echo esc_js( __('Edit' ,'booking') ) ; ?>"><i class="wpbc_icn_draw"></i></a>';
    //row +=      '<a href="javascript:void(0)" class="tooltip_top button-secondary button delete_bk_link" title="<?php echo esc_js( __('Remove' ,'booking') ) ; ?>"><i class="wpbc_icn_close"></i></a>';

    row += '</td>';
    ////////////////////////////////////////////////////////////
    row += '</tr>';
    jQuery('.wpbc_table_form_free tbody').append(row);
    wpbc_hide_fields_generators();
    document.forms['wpbc_form_field_free'].submit(); //Submit form
  } else {
    wpbc_field_highlight('#' + field_name + '_name');
  }
}

/**
 * Prepare Edit section for editing specific field.
 * @param row_number
 */
function wpbc_start_edit_form_field(row_number) {
  wpbc_reset_all_forms(); // Reset Fields in all generator rows (text,select,...) to init (empty) values
  jQuery('.wpbc_edit_field_row').show(); // Show row with edit btn

  jQuery('.wpbc_table_form_free tr').removeClass('highlight');
  jQuery('input[name="form_field_name[' + row_number + ']"]').closest('tr').addClass('highlight'); //Highlight row

  // Get exist data from EXIST fields Table
  var field_active = jQuery('input[name="form_field_active[' + row_number + ']"]').is(":checked");
  var field_required = jQuery('input[name="form_field_required[' + row_number + ']"]').is(":checked");
  var field_label = jQuery('input[name="form_field_label[' + row_number + ']"]').val();
  var field_value = jQuery('input[name="form_field_value[' + row_number + ']"]').val();
  var field_name = jQuery('input[name="form_field_name[' + row_number + ']"]').val();
  var field_type = jQuery('input[name="form_field_type[' + row_number + ']"]').val();
  //console.log( 'field_active, field_required, field_label, field_value, field_name, field_type', field_active, field_required, field_label, field_value, field_name, field_type );

  jQuery('.metabox_wpbc_form_field_free_generator').show(); // Show Generator section
  jQuery('.wpbc_field_generator').hide(); // Hide inside of generator sub section  relative to fields types

  //FixIn: TimeFreeGenerator	- Exception - field with  name 'rangetime, have type 'rangetype' in Generator BUT, it have to  be saved as 'select' type'
  if ('rangetime' == field_name) {
    /**
    *  Field 'rangetime_field_generator' have DIV section, which have CSS class 'wpbc_field_generator_rangetime',
    *  but its also  defined with  type 'select'  for adding this field via    javascript:wpbc_add_field ( 'rangetime_field_generator', 'select' );
    */

    field_type = 'rangetime';

    /**
    * During editing 'field_required' == false,  because this field does not exist  in the Table with exist fields,  but we need to  set it to  true and disabled.
    */
  }
  jQuery('.wpbc_field_generator_' + field_type).show(); // Show specific generator sub section  relative to selected Field Type
  //jQuery('#wpbc_form_field_free_generator_metabox h3.hndle span').html( '<?php echo __('Edit', 'booking') . ': '  ?>' + field_name );
  jQuery('#wpbc_form_field_free_generator_metabox h3.hndle span').html('Edit: ' + field_name);
  //jQuery('#wpbc_form_field_free_generator_metabox h3.hndle span').html( this.options[this.selectedIndex].text )

  jQuery('#' + field_type + '_field_generator_active').prop('checked', field_active);
  jQuery('#' + field_type + '_field_generator_required').prop('checked', field_required);
  jQuery('#' + field_type + '_field_generator_label').val(field_label);
  jQuery('#' + field_type + '_field_generator_name').val(field_name);
  jQuery('#' + field_type + '_field_generator_value').val(field_value);
  jQuery('#' + field_type + '_field_generator_name').prop('disabled', true);

  //FixIn: TimeFreeGenerator
  if ('rangetime' == field_name) {
    jQuery('#' + field_type + '_field_generator_required').prop('checked', true).prop('disabled', true); // Set Disabled and Checked -- Required field
    wpbc_check_typed_values(field_name + '_field_generator'); // Update Options and Titles for TimeSlots
    wpbc_timeslots_table__fill_rows();
  }
  jQuery('#wpbc_form_field_free input.wpbc_submit_button[type="submit"],input.wpbc_submit_button[type="button"]').hide(); // FixIn: 8.7.11.7.
  jQuery('#wpbc_settings__form_fields__toolbar').hide();
  wpbc_scroll_to('#wpbc_form_field_free_generator_metabox');
}

/**
 * Prepare fields data, and submit Edited field by clicking "Save changes" btn.
 *
 * @param field_name
 * @param field_type
 */
function wpbc_finish_edit_form_field(field_name, field_type) {
  //FixIn: TimeFreeGenerator
  if ('rangetime_field_generator' == field_name) {
    var replaced_result = wpbc_get_saved_value_from_timeslots_table();
    if (false === replaced_result) {
      wpbc_hide_fields_generators();
      //TODO: Show warning at  the top of page,  about error during saving timeslots
      console.log('error during parsing timeslots tbale and savig it.');
      return;
    }
  }

  // Get Values in  Edit Form ////////////////////////////////////

  //0: var field_type
  //1:
  var row_active = 'Off';
  var row_active_checked = false;
  if (jQuery('#' + field_name + '_active').is(":checked")) {
    row_active = 'On';
    row_active_checked = true;
  }
  //2:
  var row_required = 'Off';
  var row_required_checked = false;
  if (jQuery('#' + field_name + '_required').is(":checked")) {
    row_required = 'On';
    row_required_checked = true;
  }
  //3:
  var row_label = jQuery('#' + field_name + '_label').val();
  //4:
  var row_name = jQuery('#' + field_name + '_name').val();
  //5:
  var row_value = jQuery('#' + field_name + '_value').val();

  // Set  values to  the ROW in Fields Table /////////////////////
  //1:
  jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_active]').prop('checked', row_active_checked);
  jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_active]').val(row_active);
  //2:
  jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_required]').prop('checked', row_required_checked);
  jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_required]').val(row_required);
  //3:
  jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_label]').val(row_label);
  //                //4:
  //                jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_name]').val( row_name );
  //                //0:
  //                jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_type]').val( field_type );
  //5:
  jQuery('.wpbc_table_form_free tr.highlight input[name^=form_field_value]').val(row_value);
  //                // Options field:
  //                jQuery('.wpbc_table_form_free tr.highlight td.field_options input:disabled').val( field_type + '|' +  row_name );

  // Hide generators and Reset forms  and Disable highlighting
  wpbc_hide_fields_generators();

  // Submit form
  document.forms['wpbc_form_field_free'].submit();
}

/**
 * Check  Value and parse it to Options and Titles
 * @param {string} field_name
 */
function wpbc_check_typed_values(field_name) {
  var t_options_titles_arr = wpbc_get_titles_options_from_values('#' + field_name + '_value');
  if (false !== t_options_titles_arr) {
    var t_options = t_options_titles_arr[0].join("\n");
    var t_titles = t_options_titles_arr[1].join("\n");
    jQuery('#' + field_name + '_options_options').val(t_options);
    jQuery('#' + field_name + '_options_titles').val(t_titles);
  }
}

/**
 * Get array  with  Options and Titles from  Values,  if in values was defined constrution  like this 			' Option @@ Title '
 * @param field_id string
 * @returns array | false
 */
function wpbc_get_titles_options_from_values(field_id) {
  if (jQuery(field_id).val() != '' && !jQuery(field_id).is(':disabled')) {
    var tslots = jQuery(field_id).val();
    tslots = tslots.split('\n');
    var t_options = [];
    var t_titles = [];
    var slot_t = '';
    if (typeof tslots !== 'undefined' && tslots.length > 0) {
      for (var i = 0; i < tslots.length; i++) {
        slot_t = tslots[i].split('@@');
        if (slot_t.length > 1) {
          t_options.push(slot_t[1].trim());
          t_titles.push(slot_t[0].trim());
        } else {
          t_options.push(slot_t[0].trim());
          t_titles.push('');
        }
      }
    }
    var t_options_titles_arr = [];
    t_options_titles_arr.push(t_options);
    t_options_titles_arr.push(t_titles);
    return t_options_titles_arr;
  }
  return false;
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLXNpbXBsZS9fb3V0L3dwYmNfc2ltcGxlX2Zvcm0uanMiLCJuYW1lcyI6WyIkIiwiY29udHJvbGxlZCIsInNoaWZ0ZWQiLCJoYXNGb2N1cyIsImRvY3VtZW50Iiwib24iLCJlIiwic2hpZnRLZXkiLCJjdHJsS2V5IiwibWV0YUtleSIsInRoaXNfY2xvc2VzdF90YWJsZSIsImNsb3Nlc3QiLCJ0aGlzX2Nsb3Nlc3Rfcm93IiwidHlwZSIsImluZGV4IiwiaXMiLCJyZW1vdmVDbGFzcyIsImFkZENsYXNzIiwic2l6ZSIsInNsaWNlIiwialF1ZXJ5Iiwid3BiY19tYWtlX3RhYmxlX3NvcnRhYmxlIiwiY3NzIiwic29ydGFibGUiLCJpdGVtcyIsImN1cnNvciIsImF4aXMiLCJzY3JvbGxTZW5zaXRpdml0eSIsImZvcmNlUGxhY2Vob2xkZXJTaXplIiwiaGVscGVyIiwib3BhY2l0eSIsInBsYWNlaG9sZGVyIiwic3RhcnQiLCJldmVudCIsInVpIiwiaXRlbSIsInN0b3AiLCJyZW1vdmVBdHRyIiwid3BiY19hY3RpdmF0ZV90YWJsZV9yb3dfZGVsZXRlIiwiZGVsX2J0bl9jc3NfY2xhc3MiLCJpc19jb25maXJtIiwid3BiY19hcmVfeW91X3N1cmUiLCIkY3VycmVudCIsImVhY2giLCJyZW1vdmUiLCJ3cGJjX2NoZWNrX3R5cGVkX25hbWUiLCJmaWVsZF9uYW1lIiwidmFsIiwicF9uYW1lIiwicmVwbGFjZSIsInRvTG93ZXJDYXNlIiwidGV4dF92YWx1ZSIsIk1hdGgiLCJyb3VuZCIsIkRhdGUiLCJnZXRUaW1lIiwid3BiY19yZXNldF9hbGxfZm9ybXMiLCJoaWRlIiwiZmllbGRfdHlwZV9hcnJheSIsImZpZWxkX3R5cGUiLCJpIiwibGVuZ3RoIiwicHJvcCIsIndwYmNfc2hvd19maWVsZHNfZ2VuZXJhdG9yIiwic2VsZWN0ZWRfZmllbGRfdmFsdWUiLCJyYW5nZV90aW1lX2VkaXRfZmllbGQiLCJyYW5nZV90aW1lX2ZpZWxkX251bSIsInJhbmdlX3RpbWVfZWRpdF9maWVsZF9uYW1lIiwiZ2V0IiwiYXR0ciIsInJlcGxhY2VBbGwiLCJwYXJzZUludCIsIndwYmNfc3RhcnRfZWRpdF9mb3JtX2ZpZWxkIiwic2hvdyIsImh0bWwiLCJ0ZXh0Iiwid3BiY19oaWRlX2ZpZWxkc19nZW5lcmF0b3JzIiwid3BiY19hZGRfZmllbGQiLCJyZXBsYWNlZF9yZXN1bHQiLCJ3cGJjX2dldF9zYXZlZF92YWx1ZV9mcm9tX3RpbWVzbG90c190YWJsZSIsImNvbnNvbGUiLCJsb2ciLCJyb3dfbnVtIiwicm93X2FjdGl2ZSIsInJvd19hY3RpdmVfY2hlY2tlZCIsInJvd19yZXF1aXJlZCIsInJvd19yZXF1aXJlZF9jaGVja2VkIiwicm93IiwiYXBwZW5kIiwiZm9ybXMiLCJzdWJtaXQiLCJ3cGJjX2ZpZWxkX2hpZ2hsaWdodCIsInJvd19udW1iZXIiLCJmaWVsZF9hY3RpdmUiLCJmaWVsZF9yZXF1aXJlZCIsImZpZWxkX2xhYmVsIiwiZmllbGRfdmFsdWUiLCJ3cGJjX2NoZWNrX3R5cGVkX3ZhbHVlcyIsIndwYmNfdGltZXNsb3RzX3RhYmxlX19maWxsX3Jvd3MiLCJ3cGJjX3Njcm9sbF90byIsIndwYmNfZmluaXNoX2VkaXRfZm9ybV9maWVsZCIsInJvd19sYWJlbCIsInJvd19uYW1lIiwicm93X3ZhbHVlIiwidF9vcHRpb25zX3RpdGxlc19hcnIiLCJ3cGJjX2dldF90aXRsZXNfb3B0aW9uc19mcm9tX3ZhbHVlcyIsInRfb3B0aW9ucyIsImpvaW4iLCJ0X3RpdGxlcyIsImZpZWxkX2lkIiwidHNsb3RzIiwic3BsaXQiLCJzbG90X3QiLCJwdXNoIiwidHJpbSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1zaW1wbGUvX3NyYy93cGJjX3NpbXBsZV9mb3JtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiAgQWRkICdsYXN0X3NlbGVjdGVkJywgJ2N1cnJlbnQnIENTUyBjbGFzc2VzICBvbiBGT0NVUyB0byB0YWJsZSByb3dzXHJcbiAqL1xyXG4oIGZ1bmN0aW9uKCAkICl7XHJcblx0dmFyIGNvbnRyb2xsZWQgPSBmYWxzZTtcclxuXHR2YXIgc2hpZnRlZCA9IGZhbHNlO1xyXG5cdHZhciBoYXNGb2N1cyA9IGZhbHNlO1xyXG5cclxuXHQkKGRvY3VtZW50KS5vbigna2V5dXAga2V5ZG93bicsIGZ1bmN0aW9uKGUpeyBzaGlmdGVkID0gZS5zaGlmdEtleTsgY29udHJvbGxlZCA9IGUuY3RybEtleSB8fCBlLm1ldGFLZXkgfSApO1xyXG5cclxuXHQkKCcud3BiY19pbnB1dF90YWJsZScpLm9uKCAnZm9jdXMgY2xpY2snLCAnaW5wdXQnLCBmdW5jdGlvbiggZSApIHtcclxuXHJcblx0XHRcdHZhciB0aGlzX2Nsb3Nlc3RfdGFibGUgPSAkKHRoaXMpLmNsb3Nlc3QoJ3RhYmxlJyk7XHJcblx0XHRcdHZhciB0aGlzX2Nsb3Nlc3Rfcm93ICAgPSAkKHRoaXMpLmNsb3Nlc3QoJ3RyJyk7XHJcblxyXG5cdFx0XHRpZiAoICggZS50eXBlID09ICdmb2N1cycgJiYgaGFzRm9jdXMgIT0gdGhpc19jbG9zZXN0X3Jvdy5pbmRleCgpICkgfHwgKCBlLnR5cGUgPT0gJ2NsaWNrJyAmJiAkKHRoaXMpLmlzKCc6Zm9jdXMnKSApICkge1xyXG5cclxuXHRcdFx0XHRcdGhhc0ZvY3VzID0gdGhpc19jbG9zZXN0X3Jvdy5pbmRleCgpO1xyXG5cclxuXHRcdFx0XHRcdGlmICggISBzaGlmdGVkICYmICEgY29udHJvbGxlZCApIHtcclxuXHRcdFx0XHRcdFx0XHQkKCd0cicsIHRoaXNfY2xvc2VzdF90YWJsZSkucmVtb3ZlQ2xhc3MoJ2N1cnJlbnQnKS5yZW1vdmVDbGFzcygnbGFzdF9zZWxlY3RlZCcpO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXNfY2xvc2VzdF9yb3cuYWRkQ2xhc3MoJ2N1cnJlbnQnKS5hZGRDbGFzcygnbGFzdF9zZWxlY3RlZCcpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggc2hpZnRlZCApIHtcclxuXHRcdFx0XHRcdFx0XHQkKCd0cicsIHRoaXNfY2xvc2VzdF90YWJsZSkucmVtb3ZlQ2xhc3MoJ2N1cnJlbnQnKTtcclxuXHRcdFx0XHRcdFx0XHR0aGlzX2Nsb3Nlc3Rfcm93LmFkZENsYXNzKCdzZWxlY3RlZF9ub3cnKS5hZGRDbGFzcygnY3VycmVudCcpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRpZiAoICQoJ3RyLmxhc3Rfc2VsZWN0ZWQnLCB0aGlzX2Nsb3Nlc3RfdGFibGUpLnNpemUoKSA+IDAgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdGlmICggdGhpc19jbG9zZXN0X3Jvdy5pbmRleCgpID4gJCgndHIubGFzdF9zZWxlY3RlZCcsIHRoaXNfY2xvc2VzdF90YWJsZSkuaW5kZXgoKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCQoJ3RyJywgdGhpc19jbG9zZXN0X3RhYmxlKS5zbGljZSggJCgndHIubGFzdF9zZWxlY3RlZCcsIHRoaXNfY2xvc2VzdF90YWJsZSkuaW5kZXgoKSwgdGhpc19jbG9zZXN0X3Jvdy5pbmRleCgpICkuYWRkQ2xhc3MoJ2N1cnJlbnQnKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCQoJ3RyJywgdGhpc19jbG9zZXN0X3RhYmxlKS5zbGljZSggdGhpc19jbG9zZXN0X3Jvdy5pbmRleCgpLCAkKCd0ci5sYXN0X3NlbGVjdGVkJywgdGhpc19jbG9zZXN0X3RhYmxlKS5pbmRleCgpICsgMSApLmFkZENsYXNzKCdjdXJyZW50Jyk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHRcdCQoJ3RyJywgdGhpc19jbG9zZXN0X3RhYmxlKS5yZW1vdmVDbGFzcygnbGFzdF9zZWxlY3RlZCcpO1xyXG5cdFx0XHRcdFx0XHRcdHRoaXNfY2xvc2VzdF9yb3cuYWRkQ2xhc3MoJ2xhc3Rfc2VsZWN0ZWQnKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0JCgndHInLCB0aGlzX2Nsb3Nlc3RfdGFibGUpLnJlbW92ZUNsYXNzKCdsYXN0X3NlbGVjdGVkJyk7XHJcblx0XHRcdFx0XHRcdFx0aWYgKCBjb250cm9sbGVkICYmICQodGhpcykuY2xvc2VzdCgndHInKS5pcygnLmN1cnJlbnQnKSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0dGhpc19jbG9zZXN0X3Jvdy5yZW1vdmVDbGFzcygnY3VycmVudCcpO1xyXG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXNfY2xvc2VzdF9yb3cuYWRkQ2xhc3MoJ2N1cnJlbnQnKS5hZGRDbGFzcygnbGFzdF9zZWxlY3RlZCcpO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQkKCd0cicsIHRoaXNfY2xvc2VzdF90YWJsZSkucmVtb3ZlQ2xhc3MoJ3NlbGVjdGVkX25vdycpO1xyXG5cclxuXHRcdFx0fVxyXG5cdH0pLm9uKCAnYmx1cicsICdpbnB1dCcsIGZ1bmN0aW9uKCBlICkge1xyXG5cdFx0XHRoYXNGb2N1cyA9IGZhbHNlO1xyXG5cdH0pO1xyXG5cclxufSggalF1ZXJ5ICkgKTtcclxuXHJcblxyXG4vLyBNYWtlIFRhYmxlIHNvcnRhYmxlXHJcbmZ1bmN0aW9uIHdwYmNfbWFrZV90YWJsZV9zb3J0YWJsZSgpe1xyXG5cclxuXHRqUXVlcnkoJy53cGJjX2lucHV0X3RhYmxlIHRib2R5IHRoJykuY3NzKCdjdXJzb3InLCdtb3ZlJyk7XHJcblxyXG5cdGpRdWVyeSgnLndwYmNfaW5wdXRfdGFibGUgdGJvZHkgdGQuc29ydCcpLmNzcygnY3Vyc29yJywnbW92ZScpO1xyXG5cclxuXHRqUXVlcnkoJy53cGJjX2lucHV0X3RhYmxlLnNvcnRhYmxlIHRib2R5Jykuc29ydGFibGUoe1xyXG5cdFx0XHRpdGVtczondHInLFxyXG5cdFx0XHRjdXJzb3I6J21vdmUnLFxyXG5cdFx0XHRheGlzOid5JyxcclxuLy8gY29ubmVjdFdpdGg6IFwiLndwYmNfdGFibGVfZm9ybV9mcmVlIHRib2R5XCIsXHRcdFx0XHRcdC8vLy8gRml4SW46IDEwLjEuMi4yLlxyXG4vLyAvL2F4aXM6J3knLFxyXG5cdFx0XHRzY3JvbGxTZW5zaXRpdml0eTo0MCxcclxuXHRcdFx0Zm9yY2VQbGFjZWhvbGRlclNpemU6IHRydWUsXHJcblx0XHRcdGhlbHBlcjogJ2Nsb25lJyxcclxuXHRcdFx0b3BhY2l0eTogMC42NSxcclxuXHRcdFx0cGxhY2Vob2xkZXI6ICcud3BiY19pbnB1dF90YWJsZSAuc29ydCcsXHJcblx0XHRcdHN0YXJ0OmZ1bmN0aW9uKGV2ZW50LHVpKXtcclxuXHRcdFx0XHRcdHVpLml0ZW0uY3NzKCdiYWNrZ3JvdW5kLWNvbG9yJywnI2Y2ZjZmNicpO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRzdG9wOmZ1bmN0aW9uKGV2ZW50LHVpKXtcclxuXHRcdFx0XHRcdHVpLml0ZW0ucmVtb3ZlQXR0cignc3R5bGUnKTtcclxuXHRcdFx0fVxyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuLy8gQWN0aXZhdGUgcm93IGRlbGV0ZVxyXG5mdW5jdGlvbiB3cGJjX2FjdGl2YXRlX3RhYmxlX3Jvd19kZWxldGUoIGRlbF9idG5fY3NzX2NsYXNzLCBpc19jb25maXJtICl7XHJcblxyXG5cdC8vIERlbGV0ZSBSb3dcclxuXHRqUXVlcnkoIGRlbF9idG5fY3NzX2NsYXNzICkub24oICdjbGljaycsIGZ1bmN0aW9uKCl7ICAgICAgICAgICAgICAgICAgIC8vIEZpeEluOiA4LjcuMTEuMTIuXHJcblxyXG5cdFx0aWYgKCB0cnVlID09PSBpc19jb25maXJtICl7XHJcblx0XHRcdGlmICggISB3cGJjX2FyZV95b3Vfc3VyZSggJ0RvIHlvdSByZWFsbHkgd2FudCB0byBkbyB0aGlzID8nICkgKXtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR2YXIgJGN1cnJlbnQgPSBqUXVlcnkodGhpcykuY2xvc2VzdCgndHInKTtcclxuXHRcdGlmICggJGN1cnJlbnQuc2l6ZSgpID4gMCApIHtcclxuXHRcdFx0JGN1cnJlbnQuZWFjaChmdW5jdGlvbigpe1xyXG5cdFx0XHRcdFx0alF1ZXJ5KHRoaXMpLnJlbW92ZSgpO1xyXG5cdFx0XHR9KTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH0pO1xyXG5cclxufVxyXG5cclxuXHJcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuLy8gRmllbGRzIEdlbmVyYXRvciBTZWN0aW9uXHJcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuXHJcblxyXG4vKipcclxuICogQ2hlY2sgIE5hbWUgIGluICBcImZpZWxkIGZvcm1cIiBhYm91dCBwb3NzaWJsZSB1c2FnZSBvZiB0aGlzIG5hbWUgYW5kIGFib3V0ICBhbnkgRHVwbGljYXRlcyBpbiBGaWxkcyBUYWJsZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZmllbGRfbmFtZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jaGVja190eXBlZF9uYW1lKCBmaWVsZF9uYW1lICl7XHJcblxyXG5cdC8vIFNldCBOYW1lIG9ubHkgTGV0dGVyc1xyXG5cdGlmICggICAgKCBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfbmFtZScpLnZhbCgpICE9ICcnIClcclxuXHRcdCAmJiAoICEgalF1ZXJ5KCcjJyArIGZpZWxkX25hbWUgKyAnX25hbWUnKS5pcygnOmRpc2FibGVkJykgKVxyXG5cdFx0KXtcclxuXHRcdHZhciBwX25hbWUgPSBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfbmFtZScpLnZhbCgpO1xyXG5cdFx0cF9uYW1lID0gcF9uYW1lLnJlcGxhY2UoL1teQS1aYS16MC05Xy1dKlswLTldKiQvZywnJykucmVwbGFjZSgvW15BLVphLXowLTlfLV0vZywnJyk7XHJcblx0XHRwX25hbWUgPSBwX25hbWUudG9Mb3dlckNhc2UoKTtcclxuXHJcblxyXG5cdFx0alF1ZXJ5KCdpbnB1dFtuYW1lXj1mb3JtX2ZpZWxkX25hbWVdJykuZWFjaChmdW5jdGlvbigpe1xyXG5cdFx0XHR2YXIgdGV4dF92YWx1ZSA9IGpRdWVyeSh0aGlzKS52YWwoKTtcclxuXHRcdFx0aWYoIHRleHRfdmFsdWUgPT0gcF9uYW1lICkgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlcnJvciBlbGVtZW50IHdpdGggdGhpcyBuYW1lIGV4aXN0XHJcblxyXG5cdFx0XHRcdHBfbmFtZSArPSAgJ18nICsgTWF0aC5yb3VuZCggbmV3IERhdGUoKS5nZXRUaW1lKCkgICkgKyAnX3JhbmQnOyAgICAgICAgIC8vQWRkIHJhbmRvbSBzdWZpeFxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblx0XHRqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfbmFtZScpLnZhbCggcF9uYW1lICk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuLyoqIFJlc2V0IHRvIGRlZmF1bHQgdmFsdWVzIGFsbCBGb3JtICBmaWVsZHMgZm9yIGNyZWF0aW9uIG5ldyBmaWVsZHMgKi9cclxuZnVuY3Rpb24gd3BiY19yZXNldF9hbGxfZm9ybXMoKXtcclxuXHJcblx0alF1ZXJ5KCcud3BiY190YWJsZV9mb3JtX2ZyZWUgdHInKS5yZW1vdmVDbGFzcygnaGlnaGxpZ2h0Jyk7XHJcblx0alF1ZXJ5KCcud3BiY19hZGRfZmllbGRfcm93JykuaGlkZSgpO1xyXG5cdGpRdWVyeSgnLndwYmNfZWRpdF9maWVsZF9yb3cnKS5oaWRlKCk7XHJcblxyXG5cdHZhciBmaWVsZF90eXBlX2FycmF5ID0gWyAndGV4dCcsICd0ZXh0YXJlYScsICdzZWxlY3QnLCdzZWxlY3Rib3gnLCAnY2hlY2tib3gnICwgJ3JhbmdldGltZSddO1x0XHRcdFx0XHRcdC8vRml4SW46IFRpbWVGcmVlR2VuZXJhdG9yXHJcblx0dmFyIGZpZWxkX3R5cGU7XHJcblxyXG5cdGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRfdHlwZV9hcnJheS5sZW5ndGg7IGkrKykge1xyXG5cdFx0ZmllbGRfdHlwZSA9IGZpZWxkX3R5cGVfYXJyYXlbaV07XHJcblxyXG5cdFx0aWYgKCAhIGpRdWVyeSgnIycgKyBmaWVsZF90eXBlICsgJ19maWVsZF9nZW5lcmF0b3JfbmFtZScpLmlzKCc6ZGlzYWJsZWQnKSApe1x0XHRcdFx0XHRcdC8vRml4SW46IFRpbWVGcmVlR2VuZXJhdG9yXHJcblx0XHRcdGpRdWVyeSggJyMnICsgZmllbGRfdHlwZSArICdfZmllbGRfZ2VuZXJhdG9yX2FjdGl2ZScgKS5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKTtcclxuXHRcdFx0alF1ZXJ5KCAnIycgKyBmaWVsZF90eXBlICsgJ19maWVsZF9nZW5lcmF0b3JfcmVxdWlyZWQnICkucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xyXG5cdFx0XHRqUXVlcnkoICcjJyArIGZpZWxkX3R5cGUgKyAnX2ZpZWxkX2dlbmVyYXRvcl9sYWJlbCcgKS52YWwoICcnICk7XHJcblxyXG5cdFx0XHRqUXVlcnkoICcjJyArIGZpZWxkX3R5cGUgKyAnX2ZpZWxkX2dlbmVyYXRvcl9uYW1lJyApLnByb3AoICdkaXNhYmxlZCcsIGZhbHNlICk7XHJcblx0XHRcdGpRdWVyeSggJyMnICsgZmllbGRfdHlwZSArICdfZmllbGRfZ2VuZXJhdG9yX25hbWUnICkudmFsKCAnJyApO1xyXG5cdFx0XHRqUXVlcnkoICcjJyArIGZpZWxkX3R5cGUgKyAnX2ZpZWxkX2dlbmVyYXRvcl92YWx1ZScgKS52YWwoICcnICk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNob3cgc2VsZWN0ZWQgQWRkIE5ldyBGaWVsZCBmb3JtLCBhbmQgcmVzZXQgZmllbGRzIGluIHRoaXMgZm9ybVxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nIHNlbGVjdGVkX2ZpZWxkX3ZhbHVlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3Nob3dfZmllbGRzX2dlbmVyYXRvciggc2VsZWN0ZWRfZmllbGRfdmFsdWUgKSB7XHJcblx0d3BiY19yZXNldF9hbGxfZm9ybXMoKTtcclxuXHRpZiAoIHNlbGVjdGVkX2ZpZWxkX3ZhbHVlID09ICdlZGl0X3JhbmdldGltZScgKXtcclxuXHRcdC8vIHRoaXMgZmllbGQgYWxyZWFkeSAgZXhpc3QgIGluIHRoZSBib29raW5nIGZvcm0sICBhbmQgdGhhdHMgd2h5ICB3ZSBjYW4gIG5vdCBhZGQgYSBuZXcgZmllbGQsICBhbmQgaW5zdGVhZCBvZiB0aGF0ICBlZGl0IGl0LlxyXG5cdFx0dmFyIHJhbmdlX3RpbWVfZWRpdF9maWVsZCA9IGpRdWVyeSggJy53cGJjX3RhYmxlX2Zvcm1fZnJlZSA6aW5wdXRbdmFsdWU9XCJyYW5nZXRpbWVcIl0nICk7XHJcblx0XHR2YXIgcmFuZ2VfdGltZV9maWVsZF9udW0gPSAwO1xyXG5cclxuXHRcdGlmICggcmFuZ2VfdGltZV9lZGl0X2ZpZWxkLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dmFyIHJhbmdlX3RpbWVfZWRpdF9maWVsZF9uYW1lID0galF1ZXJ5KCByYW5nZV90aW1lX2VkaXRfZmllbGQuZ2V0KCAwICkgKS5hdHRyKCAnbmFtZScgKTtcclxuXHRcdFx0cmFuZ2VfdGltZV9lZGl0X2ZpZWxkX25hbWUgPSByYW5nZV90aW1lX2VkaXRfZmllbGRfbmFtZS5yZXBsYWNlQWxsKCAnZm9ybV9maWVsZF9uYW1lWycsICcnICkucmVwbGFjZUFsbCggJ10nLCAnJyApO1xyXG5cdFx0XHRyYW5nZV90aW1lX2ZpZWxkX251bSA9IHBhcnNlSW50KCByYW5nZV90aW1lX2VkaXRfZmllbGRfbmFtZSApO1xyXG5cdFx0XHRpZiAoIHJhbmdlX3RpbWVfZmllbGRfbnVtID4gMCApe1xyXG5cdFx0XHRcdHdwYmNfc3RhcnRfZWRpdF9mb3JtX2ZpZWxkKCByYW5nZV90aW1lX2ZpZWxkX251bSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRpZiAoIDAgPT0gcmFuZ2VfdGltZV9maWVsZF9udW0gKXtcclxuXHRcdFx0Ly9hbGVydCggJ1Vwcy4uLiBTb21ldGhpbmcgd3JvbmcuJyApO1xyXG5cdFx0XHRzZWxlY3RlZF9maWVsZF92YWx1ZSA9ICdyYW5nZXRpbWUnO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cdGlmIChzZWxlY3RlZF9maWVsZF92YWx1ZSA9PSAnc2VsZWN0b3JfaGludCcpIHtcclxuXHRcdGpRdWVyeSgnLm1ldGFib3hfd3BiY19mb3JtX2ZpZWxkX2ZyZWVfZ2VuZXJhdG9yJykuaGlkZSgpO1xyXG5cdFx0alF1ZXJ5KCAnI3dwYmNfZm9ybV9maWVsZF9mcmVlIGlucHV0LndwYmNfc3VibWl0X2J1dHRvblt0eXBlPVwic3VibWl0XCJdLGlucHV0LndwYmNfc3VibWl0X2J1dHRvblt0eXBlPVwiYnV0dG9uXCJdJykuc2hvdygpO1x0XHRcdFx0XHRcdC8vIEZpeEluOiA4LjcuMTEuNy5cclxuXHRcdGpRdWVyeSggJyN3cGJjX3NldHRpbmdzX19mb3JtX2ZpZWxkc19fdG9vbGJhcicpLnNob3coKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCcubWV0YWJveF93cGJjX2Zvcm1fZmllbGRfZnJlZV9nZW5lcmF0b3InKS5zaG93KCk7XHJcblx0XHRqUXVlcnkoJy53cGJjX2ZpZWxkX2dlbmVyYXRvcicpLmhpZGUoKTtcclxuXHRcdGpRdWVyeSgnLndwYmNfZmllbGRfZ2VuZXJhdG9yXycgKyBzZWxlY3RlZF9maWVsZF92YWx1ZSApLnNob3coKTtcclxuXHRcdGpRdWVyeSgnI3dwYmNfZm9ybV9maWVsZF9mcmVlX2dlbmVyYXRvcl9tZXRhYm94IGgzLmhuZGxlIHNwYW4nKS5odG1sKCBqUXVlcnkoJyNzZWxlY3RfZm9ybV9oZWxwX3Nob3J0Y29kZSBvcHRpb246c2VsZWN0ZWQnKS50ZXh0KCkgKTtcclxuXHRcdGpRdWVyeSgnLndwYmNfYWRkX2ZpZWxkX3JvdycpLnNob3coKTtcclxuXHRcdGpRdWVyeSggJyN3cGJjX2Zvcm1fZmllbGRfZnJlZSBpbnB1dC53cGJjX3N1Ym1pdF9idXR0b25bdHlwZT1cInN1Ym1pdFwiXSxpbnB1dC53cGJjX3N1Ym1pdF9idXR0b25bdHlwZT1cImJ1dHRvblwiXScpLmhpZGUoKTtcdFx0XHRcdFx0XHQvLyBGaXhJbjogOC43LjExLjcuXHJcblx0XHRqUXVlcnkoICcjd3BiY19zZXR0aW5nc19fZm9ybV9maWVsZHNfX3Rvb2xiYXInKS5oaWRlKCk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuLyoqIEhpZGUgYWxsIEFkZCBOZXcgRmllbGQgZm9ybXMsIGFuZCByZXNldCBmaWVsZHMgaW4gdGhlc2UgZm9ybXMqL1xyXG5mdW5jdGlvbiB3cGJjX2hpZGVfZmllbGRzX2dlbmVyYXRvcnMoKSB7XHJcblx0d3BiY19yZXNldF9hbGxfZm9ybXMoKTtcclxuXHRqUXVlcnkoJy5tZXRhYm94X3dwYmNfZm9ybV9maWVsZF9mcmVlX2dlbmVyYXRvcicpLmhpZGUoKTtcclxuXHRqUXVlcnkoJyNzZWxlY3RfZm9ybV9oZWxwX3Nob3J0Y29kZT5vcHRpb246ZXEoMCknKS5hdHRyKCdzZWxlY3RlZCcsIHRydWUpO1xyXG5cclxuXHRqUXVlcnkoICcjd3BiY19mb3JtX2ZpZWxkX2ZyZWUgaW5wdXQud3BiY19zdWJtaXRfYnV0dG9uW3R5cGU9XCJzdWJtaXRcIl0saW5wdXQud3BiY19zdWJtaXRfYnV0dG9uW3R5cGU9XCJidXR0b25cIl0nKS5zaG93KCk7XHRcdFx0XHRcdFx0Ly8gRml4SW46IDguNy4xMS43LlxyXG5cdGpRdWVyeSggJyN3cGJjX3NldHRpbmdzX19mb3JtX2ZpZWxkc19fdG9vbGJhcicpLnNob3coKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBBZGQgTmV3IFJvdyB3aXRoIG5ldyBGaWVsZCB0byBUYWJsZSBhbmQgU3VibWl0IFNhdmluZyBjaGFuZ2VzLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZmllbGRfbmFtZVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZmllbGRfdHlwZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hZGRfZmllbGQgKCBmaWVsZF9uYW1lLCBmaWVsZF90eXBlICkge1xyXG5cclxuXHQvL0ZpeEluOiBUaW1lRnJlZUdlbmVyYXRvclxyXG5cdGlmICggJ3JhbmdldGltZV9maWVsZF9nZW5lcmF0b3InID09IGZpZWxkX25hbWUgKSB7XHJcblx0XHR2YXIgcmVwbGFjZWRfcmVzdWx0ID0gd3BiY19nZXRfc2F2ZWRfdmFsdWVfZnJvbV90aW1lc2xvdHNfdGFibGUoKTtcclxuXHRcdGlmICggZmFsc2UgPT09IHJlcGxhY2VkX3Jlc3VsdCApe1xyXG5cdFx0XHR3cGJjX2hpZGVfZmllbGRzX2dlbmVyYXRvcnMoKTtcclxuXHRcdFx0Ly9UT086IFNob3cgd2FybmluZyBhdCAgdGhlIHRvcCBvZiBwYWdlLCAgYWJvdXQgZXJyb3IgZHVyaW5nIHNhdmluZyB0aW1lc2xvdHNcclxuXHRcdFx0Y29uc29sZS5sb2coICdlcnJvciBkdXJpbmcgcGFyc2luZyB0aW1lc2xvdHMgdGJhbGUgYW5kIHNhdmlnIGl0LicgKVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoIGpRdWVyeSgnIycgKyBmaWVsZF9uYW1lICsgJ19uYW1lJykudmFsKCkgIT0gJycgKSB7XHJcblxyXG5cdFx0d3BiY19jaGVja190eXBlZF9uYW1lKCBmaWVsZF9uYW1lICk7XHJcblxyXG5cdFx0dmFyIHJvd19udW0gPSBqUXVlcnkoJy53cGJjX3RhYmxlX2Zvcm1fZnJlZSB0Ym9keSB0cicpLmxlbmd0aCArIE1hdGgucm91bmQoIG5ldyBEYXRlKCkuZ2V0VGltZSgpICApIDtcclxuXHJcblx0XHR2YXIgcm93X2FjdGl2ZSA9ICdPZmYnO1xyXG5cdFx0dmFyIHJvd19hY3RpdmVfY2hlY2tlZCA9ICcnO1xyXG5cdFx0aWYgKCBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfYWN0aXZlJykuaXMoIFwiOmNoZWNrZWRcIiApICkge1xyXG5cdFx0XHRyb3dfYWN0aXZlID0gJ09uJztcclxuXHRcdFx0cm93X2FjdGl2ZV9jaGVja2VkID0gJyBjaGVja2VkPVwiY2hlY2tlZFwiICc7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHJvd19yZXF1aXJlZCA9ICdPZmYnO1xyXG5cdFx0dmFyIHJvd19yZXF1aXJlZF9jaGVja2VkID0gJyc7XHJcblx0XHRpZiAoIGpRdWVyeSgnIycgKyBmaWVsZF9uYW1lICsgJ19yZXF1aXJlZCcpLmlzKCBcIjpjaGVja2VkXCIgKSApIHtcclxuXHRcdFx0cm93X3JlcXVpcmVkID0gJ09uJztcclxuXHRcdFx0cm93X3JlcXVpcmVkX2NoZWNrZWQgPSAnIGNoZWNrZWQ9XCJjaGVja2VkXCIgJztcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0dmFyIHJvdztcclxuXHRcdHJvdyA9ICc8dHIgY2xhc3M9XCJhY2NvdW50IHVpLXNvcnRhYmxlLWhhbmRsZVwiPic7XHJcblxyXG5cdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcblx0XHRyb3cgKz0gJzx0ZCBjbGFzcz1cInNvcnRcIiBzdHlsZT1cImN1cnNvcjogbW92ZTtcIj48c3BhbiBjbGFzcz1cIndwYmNfaWNuX2RyYWdfaW5kaWNhdG9yXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9zcGFuPjwvdGQ+JztcclxuXHJcblx0XHRyb3cgKz0gJzx0ZCBjbGFzcz1cImZpZWxkX2FjdGl2ZVwiPic7XHJcblx0XHRyb3cgKz0gICAgICAnPGlucHV0IHR5cGU9XCJjaGVja2JveFwiIG5hbWU9XCJmb3JtX2ZpZWxkX2FjdGl2ZVsnKyByb3dfbnVtICsnXVwiIHZhbHVlPVwiJyArIHJvd19hY3RpdmUgKyAnXCIgJyArIHJvd19hY3RpdmVfY2hlY2tlZCArICcgYXV0b2NvbXBsZXRlPVwib2ZmXCIgLz4nO1xyXG5cdFx0cm93ICs9ICc8L3RkPic7XHJcblxyXG5cdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcblx0XHRyb3cgKz0gJzx0ZCBjbGFzcz1cImZpZWxkX2xhYmVsXCI+JztcclxuXHJcblx0XHQvL3JvdyArPSAgICAgICc8bGVnZW5kIGNsYXNzPVwic2NyZWVuLXJlYWRlci10ZXh0XCI+PHNwYW4+JyArIGpRdWVyeSgnIycgKyBmaWVsZF9uYW1lICsgJ19sYWJlbCcpLnZhbCgpICsgJzwvc3Bhbj48L2xlZ2VuZD4nO1xyXG5cclxuXHRcdHJvdyArPSAgICAgICc8aW5wdXQgdHlwZT1cInRleHRcIiBuYW1lPVwiZm9ybV9maWVsZF9sYWJlbFsnKyByb3dfbnVtICsnXVwiIHZhbHVlPVwiJ1xyXG5cdFx0XHRcdFx0XHRcdCsgalF1ZXJ5KCcjJyArIGZpZWxkX25hbWUgKyAnX2xhYmVsJykudmFsKCkgKyAnXCIgcGxhY2Vob2xkZXI9XCInXHJcblx0XHRcdFx0XHRcdFx0KyBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfbGFiZWwnKS52YWwoKSArICdcIiBjbGFzcz1cInJlZ3VsYXItdGV4dFwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIC8+JztcclxuXHJcblx0XHRyb3cgKz0gICAgICAgIFx0XHQnPGRpdiBjbGFzcz1cImZpZWxkX3R5cGVfbmFtZV9kZXNjcmlwdGlvblwiPic7XHJcblx0XHQvL3JvdyArPSAgICAgICAgXHRcdFx0Jzw/cGhwIGVjaG8gZXNjX2pzKCBfXyggJ1R5cGUnLCAnYm9va2luZycgKSApOyA/PjogPGRpdiBjbGFzcz1cImZpZWxkX3R5cGVfbmFtZV92YWx1ZVwiPicgK2ZpZWxkX3R5cGUrICc8L2Rpdj4nO1xyXG5cdFx0cm93ICs9ICAgICAgICBcdFx0XHQnVHlwZTogPGRpdiBjbGFzcz1cImZpZWxkX3R5cGVfbmFtZV92YWx1ZVwiPicgK2ZpZWxkX3R5cGUrICc8L2Rpdj4nO1xyXG5cdFx0cm93ICs9ICAgICAgICBcdFx0XHQnPHNwYW4gY2xhc3M9XCJmaWVsZF90eXBlX25hbWVfc2VwYXJhdG9yXCI+fDwvc3Bhbj4nO1xyXG5cdFx0Ly9yb3cgKz0gICAgICAgIFx0XHRcdCc8P3BocCBlY2hvIGVzY19qcyggX18oICdOYW1lJywgJ2Jvb2tpbmcnICkgKTsgPz46IDxkaXYgY2xhc3M9XCJmaWVsZF90eXBlX25hbWVfdmFsdWVcIj4nICsgalF1ZXJ5KCcjJyArIGZpZWxkX25hbWUgKyAnX25hbWUnKS52YWwoKSArICc8L2Rpdj4nO1xyXG5cdFx0cm93ICs9ICAgICAgICBcdFx0XHQnTmFtZTogPGRpdiBjbGFzcz1cImZpZWxkX3R5cGVfbmFtZV92YWx1ZVwiPicgKyBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfbmFtZScpLnZhbCgpICsgJzwvZGl2Pic7XHJcblx0XHRyb3cgKz0gICAgICAgIFx0XHQnPC9kaXY+JztcclxuXHJcblx0XHRyb3cgKz0gICAgICAgICc8aW5wdXQgdHlwZT1cImhpZGRlblwiIHZhbHVlPVwiJyArICggKCAnc2VsZWN0JyA9PSBmaWVsZF90eXBlICkgPyAnc2VsZWN0Ym94JyA6IGZpZWxkX3R5cGUgKSAgKyAgJ1wiICBuYW1lPVwiZm9ybV9maWVsZF90eXBlWycgKyByb3dfbnVtICsgJ11cIiBhdXRvY29tcGxldGU9XCJvZmZcIiAvPic7XHJcblx0XHRyb3cgKz0gICAgICAgICc8aW5wdXQgdHlwZT1cImhpZGRlblwiIHZhbHVlPVwiJyArIGpRdWVyeSgnIycgKyBmaWVsZF9uYW1lICsgJ19uYW1lJykudmFsKCkgKyAnXCIgIG5hbWU9XCJmb3JtX2ZpZWxkX25hbWVbJyArIHJvd19udW0gKyAnXVwiIGF1dG9jb21wbGV0ZT1cIm9mZlwiIC8+JztcclxuXHRcdHJvdyArPSAgICAgICAgJzxpbnB1dCB0eXBlPVwiaGlkZGVuXCIgdmFsdWU9XCInICsgKChqUXVlcnkoICcjJyArIGZpZWxkX25hbWUgKyAnX3ZhbHVlJyApLmxlbmd0aCkgPyBqUXVlcnkoICcjJyArIGZpZWxkX25hbWUgKyAnX3ZhbHVlJyApLnZhbCgpIDogJycpICsgJ1wiICBuYW1lPVwiZm9ybV9maWVsZF92YWx1ZVsnICsgcm93X251bSArICddXCIgYXV0b2NvbXBsZXRlPVwib2ZmXCIgLz4nO1xyXG5cclxuXHRcdHJvdyArPSAnPC90ZD4nO1xyXG5cclxuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG5cdFx0cm93ICs9ICc8dGQgY2xhc3M9XCJmaWVsZF9yZXF1aXJlZFwiPic7XHJcblxyXG5cdFx0XHQvL0ZpeEluOiAgVGltZUZyZWVHZW5lcmF0b3JcclxuXHRcdFx0aWYgKCAncmFuZ2V0aW1lJyA9PSBmaWVsZF9uYW1lICkge1xyXG5cdFx0XHRcdHJvdyArPSAgICAgICc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgZGlzYWJsZWQ9XCJESVNBQkxFRFwiIG5hbWU9XCJmb3JtX2ZpZWxkX3JlcXVpcmVkWycrIHJvd19udW0gKyddXCIgdmFsdWU9XCInICsgJ09uJyArICdcIiAnICsgJyBjaGVja2VkPVwiY2hlY2tlZFwiICcgKyAnIGF1dG9jb21wbGV0ZT1cIm9mZlwiIC8+JztcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRyb3cgKz0gXHRcdCc8aW5wdXQgdHlwZT1cImNoZWNrYm94XCIgbmFtZT1cImZvcm1fZmllbGRfcmVxdWlyZWRbJyArIHJvd19udW0gKyAnXVwiIHZhbHVlPVwiJyArIHJvd19yZXF1aXJlZCArICdcIiAnICsgcm93X3JlcXVpcmVkX2NoZWNrZWQgKyAnIGF1dG9jb21wbGV0ZT1cIm9mZlwiIC8+JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdHJvdyArPSAnPC90ZD4nO1xyXG5cclxuXHRcdC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xyXG5cdFx0Ly8gcm93ICs9ICc8dGQgY2xhc3M9XCJmaWVsZF9vcHRpb25zXCI+JztcclxuXHRcdC8vIHJvdyArPSAgICAgICAgJzxpbnB1dCB0eXBlPVwidGV4dFwiIGRpc2FibGVkPVwiRElTQUJMRURcIiB2YWx1ZT1cIicgKyBmaWVsZF90eXBlICsgJyB8ICcgKyBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfbmFtZScpLnZhbCgpICsgJ1wiICBhdXRvY29tcGxldGU9XCJvZmZcIiAvPic7XHJcblx0XHQvLyByb3cgKz0gJzwvdGQ+JztcclxuXHJcblx0XHQvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cclxuXHRcdHJvdyArPSAnPHRkIGNsYXNzPVwiZmllbGRfb3B0aW9uc1wiPic7XHJcblxyXG5cdFx0Ly9yb3cgKz0gICAgICAnPGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIGNsYXNzPVwidG9vbHRpcF90b3AgYnV0dG9uLXNlY29uZGFyeSBidXR0b25cIiB0aXRsZT1cIjw/cGhwIGVjaG8gZXNjX2pzKCBfXygnRWRpdCcgLCdib29raW5nJykgKSA7ID8+XCI+PGkgY2xhc3M9XCJ3cGJjX2ljbl9kcmF3XCI+PC9pPjwvYT4nO1xyXG5cdFx0Ly9yb3cgKz0gICAgICAnPGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIGNsYXNzPVwidG9vbHRpcF90b3AgYnV0dG9uLXNlY29uZGFyeSBidXR0b24gZGVsZXRlX2JrX2xpbmtcIiB0aXRsZT1cIjw/cGhwIGVjaG8gZXNjX2pzKCBfXygnUmVtb3ZlJyAsJ2Jvb2tpbmcnKSApIDsgPz5cIj48aSBjbGFzcz1cIndwYmNfaWNuX2Nsb3NlXCI+PC9pPjwvYT4nO1xyXG5cclxuXHRcdHJvdyArPSAnPC90ZD4nO1xyXG5cdFx0Ly8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcblx0XHRyb3cgKz0gJzwvdHI+JztcclxuXHJcblx0XHRqUXVlcnkoJy53cGJjX3RhYmxlX2Zvcm1fZnJlZSB0Ym9keScpLmFwcGVuZCggcm93ICk7XHJcblxyXG5cdFx0d3BiY19oaWRlX2ZpZWxkc19nZW5lcmF0b3JzKCk7XHJcblxyXG5cdFx0ZG9jdW1lbnQuZm9ybXNbJ3dwYmNfZm9ybV9maWVsZF9mcmVlJ10uc3VibWl0KCk7ICAgICAgICAgICAgLy9TdWJtaXQgZm9ybVxyXG5cclxuXHR9IGVsc2Uge1xyXG5cdFx0d3BiY19maWVsZF9oaWdobGlnaHQoICcjJyArIGZpZWxkX25hbWUgKyAnX25hbWUnICk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFByZXBhcmUgRWRpdCBzZWN0aW9uIGZvciBlZGl0aW5nIHNwZWNpZmljIGZpZWxkLlxyXG4gKiBAcGFyYW0gcm93X251bWJlclxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zdGFydF9lZGl0X2Zvcm1fZmllbGQoIHJvd19udW1iZXIgKSB7XHJcblxyXG5cdHdwYmNfcmVzZXRfYWxsX2Zvcm1zKCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgRmllbGRzIGluIGFsbCBnZW5lcmF0b3Igcm93cyAodGV4dCxzZWxlY3QsLi4uKSB0byBpbml0IChlbXB0eSkgdmFsdWVzXHJcblx0alF1ZXJ5KCcud3BiY19lZGl0X2ZpZWxkX3JvdycpLnNob3coKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2hvdyByb3cgd2l0aCBlZGl0IGJ0blxyXG5cclxuXHRqUXVlcnkoJy53cGJjX3RhYmxlX2Zvcm1fZnJlZSB0cicpLnJlbW92ZUNsYXNzKCdoaWdobGlnaHQnKTtcclxuXHRqUXVlcnkoJ2lucHV0W25hbWU9XCJmb3JtX2ZpZWxkX25hbWVbJytyb3dfbnVtYmVyKyddXCJdJykuY2xvc2VzdCgndHInKS5hZGRDbGFzcygnaGlnaGxpZ2h0Jyk7XHRcdFx0Ly9IaWdobGlnaHQgcm93XHJcblxyXG5cdC8vIEdldCBleGlzdCBkYXRhIGZyb20gRVhJU1QgZmllbGRzIFRhYmxlXHJcblx0dmFyIGZpZWxkX2FjdGl2ZSA9IGpRdWVyeSgnaW5wdXRbbmFtZT1cImZvcm1fZmllbGRfYWN0aXZlWycrcm93X251bWJlcisnXVwiXScpLmlzKCBcIjpjaGVja2VkXCIgKTtcclxuXHR2YXIgZmllbGRfcmVxdWlyZWQgPSBqUXVlcnkoJ2lucHV0W25hbWU9XCJmb3JtX2ZpZWxkX3JlcXVpcmVkWycrcm93X251bWJlcisnXVwiXScpLmlzKCBcIjpjaGVja2VkXCIgKTtcclxuXHR2YXIgZmllbGRfbGFiZWwgPSBqUXVlcnkoJ2lucHV0W25hbWU9XCJmb3JtX2ZpZWxkX2xhYmVsWycrcm93X251bWJlcisnXVwiXScpLnZhbCgpO1xyXG5cdHZhciBmaWVsZF92YWx1ZSA9IGpRdWVyeSgnaW5wdXRbbmFtZT1cImZvcm1fZmllbGRfdmFsdWVbJytyb3dfbnVtYmVyKyddXCJdJykudmFsKCk7XHJcblx0dmFyIGZpZWxkX25hbWUgPSBqUXVlcnkoJ2lucHV0W25hbWU9XCJmb3JtX2ZpZWxkX25hbWVbJytyb3dfbnVtYmVyKyddXCJdJykudmFsKCk7XHJcblx0dmFyIGZpZWxkX3R5cGUgPSBqUXVlcnkoJ2lucHV0W25hbWU9XCJmb3JtX2ZpZWxkX3R5cGVbJytyb3dfbnVtYmVyKyddXCJdJykudmFsKCk7XHJcbi8vY29uc29sZS5sb2coICdmaWVsZF9hY3RpdmUsIGZpZWxkX3JlcXVpcmVkLCBmaWVsZF9sYWJlbCwgZmllbGRfdmFsdWUsIGZpZWxkX25hbWUsIGZpZWxkX3R5cGUnLCBmaWVsZF9hY3RpdmUsIGZpZWxkX3JlcXVpcmVkLCBmaWVsZF9sYWJlbCwgZmllbGRfdmFsdWUsIGZpZWxkX25hbWUsIGZpZWxkX3R5cGUgKTtcclxuXHJcblx0alF1ZXJ5KCcubWV0YWJveF93cGJjX2Zvcm1fZmllbGRfZnJlZV9nZW5lcmF0b3InKS5zaG93KCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2hvdyBHZW5lcmF0b3Igc2VjdGlvblxyXG5cdGpRdWVyeSgnLndwYmNfZmllbGRfZ2VuZXJhdG9yJykuaGlkZSgpO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBIaWRlIGluc2lkZSBvZiBnZW5lcmF0b3Igc3ViIHNlY3Rpb24gIHJlbGF0aXZlIHRvIGZpZWxkcyB0eXBlc1xyXG5cclxuXHJcblxyXG4vL0ZpeEluOiBUaW1lRnJlZUdlbmVyYXRvclx0LSBFeGNlcHRpb24gLSBmaWVsZCB3aXRoICBuYW1lICdyYW5nZXRpbWUsIGhhdmUgdHlwZSAncmFuZ2V0eXBlJyBpbiBHZW5lcmF0b3IgQlVULCBpdCBoYXZlIHRvICBiZSBzYXZlZCBhcyAnc2VsZWN0JyB0eXBlJ1xyXG5pZiAoICdyYW5nZXRpbWUnID09IGZpZWxkX25hbWUgKSB7XHJcbi8qKlxyXG4qICBGaWVsZCAncmFuZ2V0aW1lX2ZpZWxkX2dlbmVyYXRvcicgaGF2ZSBESVYgc2VjdGlvbiwgd2hpY2ggaGF2ZSBDU1MgY2xhc3MgJ3dwYmNfZmllbGRfZ2VuZXJhdG9yX3JhbmdldGltZScsXHJcbiogIGJ1dCBpdHMgYWxzbyAgZGVmaW5lZCB3aXRoICB0eXBlICdzZWxlY3QnICBmb3IgYWRkaW5nIHRoaXMgZmllbGQgdmlhICAgIGphdmFzY3JpcHQ6d3BiY19hZGRfZmllbGQgKCAncmFuZ2V0aW1lX2ZpZWxkX2dlbmVyYXRvcicsICdzZWxlY3QnICk7XHJcbiovXHJcblxyXG5maWVsZF90eXBlID0gJ3JhbmdldGltZSc7XHJcblxyXG4vKipcclxuKiBEdXJpbmcgZWRpdGluZyAnZmllbGRfcmVxdWlyZWQnID09IGZhbHNlLCAgYmVjYXVzZSB0aGlzIGZpZWxkIGRvZXMgbm90IGV4aXN0ICBpbiB0aGUgVGFibGUgd2l0aCBleGlzdCBmaWVsZHMsICBidXQgd2UgbmVlZCB0byAgc2V0IGl0IHRvICB0cnVlIGFuZCBkaXNhYmxlZC5cclxuKi9cclxuXHJcbn1cclxuXHJcblx0alF1ZXJ5KCcud3BiY19maWVsZF9nZW5lcmF0b3JfJyArIGZpZWxkX3R5cGUgKS5zaG93KCk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBTaG93IHNwZWNpZmljIGdlbmVyYXRvciBzdWIgc2VjdGlvbiAgcmVsYXRpdmUgdG8gc2VsZWN0ZWQgRmllbGQgVHlwZVxyXG5cdC8valF1ZXJ5KCcjd3BiY19mb3JtX2ZpZWxkX2ZyZWVfZ2VuZXJhdG9yX21ldGFib3ggaDMuaG5kbGUgc3BhbicpLmh0bWwoICc8P3BocCBlY2hvIF9fKCdFZGl0JywgJ2Jvb2tpbmcnKSAuICc6ICcgID8+JyArIGZpZWxkX25hbWUgKTtcclxuXHRqUXVlcnkoJyN3cGJjX2Zvcm1fZmllbGRfZnJlZV9nZW5lcmF0b3JfbWV0YWJveCBoMy5obmRsZSBzcGFuJykuaHRtbCggJ0VkaXQ6ICcgKyBmaWVsZF9uYW1lICk7XHJcblx0Ly9qUXVlcnkoJyN3cGJjX2Zvcm1fZmllbGRfZnJlZV9nZW5lcmF0b3JfbWV0YWJveCBoMy5obmRsZSBzcGFuJykuaHRtbCggdGhpcy5vcHRpb25zW3RoaXMuc2VsZWN0ZWRJbmRleF0udGV4dCApXHJcblxyXG5cdGpRdWVyeSggJyMnICsgZmllbGRfdHlwZSArICdfZmllbGRfZ2VuZXJhdG9yX2FjdGl2ZScgKS5wcm9wKCAnY2hlY2tlZCcsIGZpZWxkX2FjdGl2ZSApO1xyXG5cdGpRdWVyeSggJyMnICsgZmllbGRfdHlwZSArICdfZmllbGRfZ2VuZXJhdG9yX3JlcXVpcmVkJyApLnByb3AoICdjaGVja2VkJywgZmllbGRfcmVxdWlyZWQgKTtcclxuXHRqUXVlcnkoICcjJyArIGZpZWxkX3R5cGUgKyAnX2ZpZWxkX2dlbmVyYXRvcl9sYWJlbCcgKS52YWwoIGZpZWxkX2xhYmVsICk7XHJcblx0alF1ZXJ5KCAnIycgKyBmaWVsZF90eXBlICsgJ19maWVsZF9nZW5lcmF0b3JfbmFtZScgKS52YWwoIGZpZWxkX25hbWUgKTtcclxuXHRqUXVlcnkoICcjJyArIGZpZWxkX3R5cGUgKyAnX2ZpZWxkX2dlbmVyYXRvcl92YWx1ZScgKS52YWwoIGZpZWxkX3ZhbHVlICk7XHJcblx0alF1ZXJ5KCAnIycgKyBmaWVsZF90eXBlICsgJ19maWVsZF9nZW5lcmF0b3JfbmFtZScgKS5wcm9wKCdkaXNhYmxlZCcgLCB0cnVlKTtcclxuXHJcbi8vRml4SW46IFRpbWVGcmVlR2VuZXJhdG9yXHJcbmlmICggJ3JhbmdldGltZScgPT0gZmllbGRfbmFtZSApIHtcclxualF1ZXJ5KCAnIycgKyBmaWVsZF90eXBlICsgJ19maWVsZF9nZW5lcmF0b3JfcmVxdWlyZWQnICkucHJvcCggJ2NoZWNrZWQnLCAgdHJ1ZSApLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKTtcdFx0XHQvLyBTZXQgRGlzYWJsZWQgYW5kIENoZWNrZWQgLS0gUmVxdWlyZWQgZmllbGRcclxud3BiY19jaGVja190eXBlZF92YWx1ZXMoIGZpZWxkX25hbWUgKyAnX2ZpZWxkX2dlbmVyYXRvcicgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBVcGRhdGUgT3B0aW9ucyBhbmQgVGl0bGVzIGZvciBUaW1lU2xvdHNcclxud3BiY190aW1lc2xvdHNfdGFibGVfX2ZpbGxfcm93cygpO1xyXG59XHJcblxyXG5cdGpRdWVyeSggJyN3cGJjX2Zvcm1fZmllbGRfZnJlZSBpbnB1dC53cGJjX3N1Ym1pdF9idXR0b25bdHlwZT1cInN1Ym1pdFwiXSxpbnB1dC53cGJjX3N1Ym1pdF9idXR0b25bdHlwZT1cImJ1dHRvblwiXScpLmhpZGUoKTtcdFx0XHRcdFx0XHQvLyBGaXhJbjogOC43LjExLjcuXHJcblx0alF1ZXJ5KCAnI3dwYmNfc2V0dGluZ3NfX2Zvcm1fZmllbGRzX190b29sYmFyJykuaGlkZSgpO1xyXG5cclxuXHR3cGJjX3Njcm9sbF90bygnI3dwYmNfZm9ybV9maWVsZF9mcmVlX2dlbmVyYXRvcl9tZXRhYm94JyApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFByZXBhcmUgZmllbGRzIGRhdGEsIGFuZCBzdWJtaXQgRWRpdGVkIGZpZWxkIGJ5IGNsaWNraW5nIFwiU2F2ZSBjaGFuZ2VzXCIgYnRuLlxyXG4gKlxyXG4gKiBAcGFyYW0gZmllbGRfbmFtZVxyXG4gKiBAcGFyYW0gZmllbGRfdHlwZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19maW5pc2hfZWRpdF9mb3JtX2ZpZWxkKCBmaWVsZF9uYW1lLCBmaWVsZF90eXBlICkge1xyXG5cclxuXHQvL0ZpeEluOiBUaW1lRnJlZUdlbmVyYXRvclxyXG5cdGlmICggJ3JhbmdldGltZV9maWVsZF9nZW5lcmF0b3InID09IGZpZWxkX25hbWUgKSB7XHJcblx0XHR2YXIgcmVwbGFjZWRfcmVzdWx0ID0gd3BiY19nZXRfc2F2ZWRfdmFsdWVfZnJvbV90aW1lc2xvdHNfdGFibGUoKTtcclxuXHRcdGlmICggZmFsc2UgPT09IHJlcGxhY2VkX3Jlc3VsdCApIHtcclxuXHRcdFx0d3BiY19oaWRlX2ZpZWxkc19nZW5lcmF0b3JzKCk7XHJcblx0XHRcdC8vVE9ETzogU2hvdyB3YXJuaW5nIGF0ICB0aGUgdG9wIG9mIHBhZ2UsICBhYm91dCBlcnJvciBkdXJpbmcgc2F2aW5nIHRpbWVzbG90c1xyXG5cdFx0XHRjb25zb2xlLmxvZyggJ2Vycm9yIGR1cmluZyBwYXJzaW5nIHRpbWVzbG90cyB0YmFsZSBhbmQgc2F2aWcgaXQuJyApXHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cclxuXHQvLyBHZXQgVmFsdWVzIGluICBFZGl0IEZvcm0gLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcblxyXG5cdC8vMDogdmFyIGZpZWxkX3R5cGVcclxuXHQvLzE6XHJcblx0dmFyIHJvd19hY3RpdmUgPSAnT2ZmJztcclxuXHR2YXIgcm93X2FjdGl2ZV9jaGVja2VkID0gZmFsc2U7XHJcblx0aWYgKCBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfYWN0aXZlJykuaXMoIFwiOmNoZWNrZWRcIiApICkge1xyXG5cdFx0cm93X2FjdGl2ZSA9ICdPbic7XHJcblx0XHRyb3dfYWN0aXZlX2NoZWNrZWQgPSB0cnVlO1xyXG5cdH1cclxuXHQvLzI6XHJcblx0dmFyIHJvd19yZXF1aXJlZCA9ICdPZmYnO1xyXG5cdHZhciByb3dfcmVxdWlyZWRfY2hlY2tlZCA9IGZhbHNlO1xyXG5cdGlmICggalF1ZXJ5KCcjJyArIGZpZWxkX25hbWUgKyAnX3JlcXVpcmVkJykuaXMoIFwiOmNoZWNrZWRcIiApICkge1xyXG5cdFx0cm93X3JlcXVpcmVkID0gJ09uJztcclxuXHRcdHJvd19yZXF1aXJlZF9jaGVja2VkID0gdHJ1ZTtcclxuXHR9XHJcblx0Ly8zOlxyXG5cdHZhciByb3dfbGFiZWwgPSBqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfbGFiZWwnKS52YWwoKTtcclxuXHQvLzQ6XHJcblx0dmFyIHJvd19uYW1lID0galF1ZXJ5KCcjJyArIGZpZWxkX25hbWUgKyAnX25hbWUnKS52YWwoKTtcclxuXHQvLzU6XHJcblx0dmFyIHJvd192YWx1ZSA9IGpRdWVyeSgnIycgKyBmaWVsZF9uYW1lICsgJ192YWx1ZScpLnZhbCgpO1xyXG5cclxuXHQvLyBTZXQgIHZhbHVlcyB0byAgdGhlIFJPVyBpbiBGaWVsZHMgVGFibGUgLy8vLy8vLy8vLy8vLy8vLy8vLy8vXHJcblx0Ly8xOlxyXG5cdGpRdWVyeSgnLndwYmNfdGFibGVfZm9ybV9mcmVlIHRyLmhpZ2hsaWdodCBpbnB1dFtuYW1lXj1mb3JtX2ZpZWxkX2FjdGl2ZV0nKS5wcm9wKCAnY2hlY2tlZCcsIHJvd19hY3RpdmVfY2hlY2tlZCApO1xyXG5cdGpRdWVyeSgnLndwYmNfdGFibGVfZm9ybV9mcmVlIHRyLmhpZ2hsaWdodCBpbnB1dFtuYW1lXj1mb3JtX2ZpZWxkX2FjdGl2ZV0nKS52YWwoIHJvd19hY3RpdmUgKTtcclxuXHQvLzI6XHJcblx0alF1ZXJ5KCcud3BiY190YWJsZV9mb3JtX2ZyZWUgdHIuaGlnaGxpZ2h0IGlucHV0W25hbWVePWZvcm1fZmllbGRfcmVxdWlyZWRdJykucHJvcCggJ2NoZWNrZWQnLCByb3dfcmVxdWlyZWRfY2hlY2tlZCApO1xyXG5cdGpRdWVyeSgnLndwYmNfdGFibGVfZm9ybV9mcmVlIHRyLmhpZ2hsaWdodCBpbnB1dFtuYW1lXj1mb3JtX2ZpZWxkX3JlcXVpcmVkXScpLnZhbCggcm93X3JlcXVpcmVkICk7XHJcblx0Ly8zOlxyXG5cdGpRdWVyeSgnLndwYmNfdGFibGVfZm9ybV9mcmVlIHRyLmhpZ2hsaWdodCBpbnB1dFtuYW1lXj1mb3JtX2ZpZWxkX2xhYmVsXScpLnZhbCggcm93X2xhYmVsICk7XHJcbi8vICAgICAgICAgICAgICAgIC8vNDpcclxuLy8gICAgICAgICAgICAgICAgalF1ZXJ5KCcud3BiY190YWJsZV9mb3JtX2ZyZWUgdHIuaGlnaGxpZ2h0IGlucHV0W25hbWVePWZvcm1fZmllbGRfbmFtZV0nKS52YWwoIHJvd19uYW1lICk7XHJcbi8vICAgICAgICAgICAgICAgIC8vMDpcclxuLy8gICAgICAgICAgICAgICAgalF1ZXJ5KCcud3BiY190YWJsZV9mb3JtX2ZyZWUgdHIuaGlnaGxpZ2h0IGlucHV0W25hbWVePWZvcm1fZmllbGRfdHlwZV0nKS52YWwoIGZpZWxkX3R5cGUgKTtcclxuXHQvLzU6XHJcblx0alF1ZXJ5KCcud3BiY190YWJsZV9mb3JtX2ZyZWUgdHIuaGlnaGxpZ2h0IGlucHV0W25hbWVePWZvcm1fZmllbGRfdmFsdWVdJykudmFsKCByb3dfdmFsdWUgKTtcclxuLy8gICAgICAgICAgICAgICAgLy8gT3B0aW9ucyBmaWVsZDpcclxuLy8gICAgICAgICAgICAgICAgalF1ZXJ5KCcud3BiY190YWJsZV9mb3JtX2ZyZWUgdHIuaGlnaGxpZ2h0IHRkLmZpZWxkX29wdGlvbnMgaW5wdXQ6ZGlzYWJsZWQnKS52YWwoIGZpZWxkX3R5cGUgKyAnfCcgKyAgcm93X25hbWUgKTtcclxuXHJcblxyXG5cdC8vIEhpZGUgZ2VuZXJhdG9ycyBhbmQgUmVzZXQgZm9ybXMgIGFuZCBEaXNhYmxlIGhpZ2hsaWdodGluZ1xyXG5cdHdwYmNfaGlkZV9maWVsZHNfZ2VuZXJhdG9ycygpO1xyXG5cclxuXHQvLyBTdWJtaXQgZm9ybVxyXG5cdGRvY3VtZW50LmZvcm1zWyd3cGJjX2Zvcm1fZmllbGRfZnJlZSddLnN1Ym1pdCgpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIENoZWNrICBWYWx1ZSBhbmQgcGFyc2UgaXQgdG8gT3B0aW9ucyBhbmQgVGl0bGVzXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZF9uYW1lXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NoZWNrX3R5cGVkX3ZhbHVlcyggZmllbGRfbmFtZSApe1xyXG5cclxuXHR2YXIgdF9vcHRpb25zX3RpdGxlc19hcnIgPSB3cGJjX2dldF90aXRsZXNfb3B0aW9uc19mcm9tX3ZhbHVlcyggJyMnICsgZmllbGRfbmFtZSArICdfdmFsdWUnICk7XHJcblxyXG5cdGlmICggZmFsc2UgIT09IHRfb3B0aW9uc190aXRsZXNfYXJyICkge1xyXG5cclxuXHRcdHZhciB0X29wdGlvbnMgPSB0X29wdGlvbnNfdGl0bGVzX2FyclswXS5qb2luKCBcIlxcblwiICk7XHJcblx0XHR2YXIgdF90aXRsZXMgID0gdF9vcHRpb25zX3RpdGxlc19hcnJbMV0uam9pbiggXCJcXG5cIiApO1xyXG5cdFx0alF1ZXJ5KCcjJyArIGZpZWxkX25hbWUgKyAnX29wdGlvbnNfb3B0aW9ucycpLnZhbCggdF9vcHRpb25zICk7XHJcblx0XHRqUXVlcnkoJyMnICsgZmllbGRfbmFtZSArICdfb3B0aW9uc190aXRsZXMnKS52YWwoIHRfdGl0bGVzICk7XHJcblxyXG5cdH1cclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBHZXQgYXJyYXkgIHdpdGggIE9wdGlvbnMgYW5kIFRpdGxlcyBmcm9tICBWYWx1ZXMsICBpZiBpbiB2YWx1ZXMgd2FzIGRlZmluZWQgY29uc3RydXRpb24gIGxpa2UgdGhpcyBcdFx0XHQnIE9wdGlvbiBAQCBUaXRsZSAnXHJcbiAqIEBwYXJhbSBmaWVsZF9pZCBzdHJpbmdcclxuICogQHJldHVybnMgYXJyYXkgfCBmYWxzZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19nZXRfdGl0bGVzX29wdGlvbnNfZnJvbV92YWx1ZXMoIGZpZWxkX2lkICl7XHJcblx0aWYgKCAgICAoIGpRdWVyeSggZmllbGRfaWQgKS52YWwoKSAhPSAnJyApXHJcblx0XHQgJiYgKCAhIGpRdWVyeSggZmllbGRfaWQgKS5pcygnOmRpc2FibGVkJykgKVxyXG5cdFx0KXtcclxuXHJcblx0XHR2YXIgdHNsb3RzID0galF1ZXJ5KCBmaWVsZF9pZCApLnZhbCgpO1xyXG5cdFx0dHNsb3RzID0gdHNsb3RzLnNwbGl0KCdcXG4nKTtcclxuXHRcdHZhciB0X29wdGlvbnMgPSBbXTtcclxuXHRcdHZhciB0X3RpdGxlcyAgPSBbXTtcclxuXHRcdHZhciBzbG90X3QgPSAnJztcclxuXHJcblx0XHRpZiAoICggdHlwZW9mIHRzbG90cyAhPT0gJ3VuZGVmaW5lZCcgKSAmJiAoIHRzbG90cy5sZW5ndGggPiAwICkgKXtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpPTA7IGkgPCB0c2xvdHMubGVuZ3RoOyBpKysgKSB7XHJcblxyXG5cdFx0XHRcdHNsb3RfdCA9IHRzbG90c1sgaSBdLnNwbGl0KCAnQEAnICk7XHJcblxyXG5cdFx0XHRcdGlmICggc2xvdF90Lmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHRcdHRfb3B0aW9ucy5wdXNoKCBzbG90X3RbIDEgXS50cmltKCkgKTtcclxuXHRcdFx0XHRcdHRfdGl0bGVzLnB1c2goICBzbG90X3RbIDAgXS50cmltKCkgKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dF9vcHRpb25zLnB1c2goIHNsb3RfdFsgMCBdLnRyaW0oKSApO1xyXG5cdFx0XHRcdFx0dF90aXRsZXMucHVzaCggICcnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cdFx0dmFyIHRfb3B0aW9uc190aXRsZXNfYXJyID0gW107XHJcblx0XHR0X29wdGlvbnNfdGl0bGVzX2Fyci5wdXNoKCB0X29wdGlvbnMgKTtcclxuXHRcdHRfb3B0aW9uc190aXRsZXNfYXJyLnB1c2goIHRfdGl0bGVzICk7XHJcblxyXG5cdFx0cmV0dXJuIHRfb3B0aW9uc190aXRsZXNfYXJyO1xyXG5cdH1cclxuXHRyZXR1cm4gZmFsc2U7XHJcbn1cclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNFLFdBQVVBLENBQUMsRUFBRTtFQUNkLElBQUlDLFVBQVUsR0FBRyxLQUFLO0VBQ3RCLElBQUlDLE9BQU8sR0FBRyxLQUFLO0VBQ25CLElB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
