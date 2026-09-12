"use strict";

/** Add Appointment administrator inspector and non-submitting helper tools. */
(function ($) {
  'use strict';

  var summary_timer = 0;
  var labels = window.wpbc_add_appointment_page_config || {};

  /** Apply the administrator page context before any Provider calendar loads. */
  function apply_booking_context() {
    if ('undefined' === typeof window._wpbc) {
      return;
    }
    window._wpbc.set_other_param('this_page_booking_hash', '');
    window._wpbc.set_other_param('this_page_allow_past', labels.allowPast ? 1 : 0);
    window._wpbc.set_other_param('this_page_allow_past_arr', labels.allowPastDateArr || []);
    window._wpbc.set_other_param('this_page_admin_booking_nonce', String(labels.adminBookingNonce || ''));
  }

  /** Switch one shared right-sidebar panel. */
  function switch_right_panel($tab) {
    var panel_id = $tab.attr('aria-controls');
    var $tabs = $tab.closest('.wpbc_add_appointment__rightbar_tabs').find('[role="tab"]');
    var $panels = $('.wpbc_add_appointment__rightbar').find('[role="tabpanel"]');
    $tabs.attr('aria-selected', 'false');
    $tab.attr('aria-selected', 'true');
    $panels.attr({
      hidden: true,
      'aria-hidden': 'true'
    });
    $('#' + panel_id).removeAttr('hidden').attr('aria-hidden', 'false');
  }

  /** Return trimmed visible text from the first matching element. */
  function get_text($root, selector) {
    return String($root.find(selector).first().text() || '').replace(/\s+/g, ' ').trim();
  }

  /** Return the display value of one native Booking Form field. */
  function get_field_value($field) {
    var value;
    if (!$field.length) {
      return '';
    }
    if ($field.is('select')) {
      value = $field.find('option:selected').text();
    } else {
      value = $field.val();
    }
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  /** Update one summary value and its empty-state presentation. */
  function set_summary_value(key, value) {
    var $target = $('[data-wpbc-add-appointment-summary="' + key + '"]');
    var is_empty = '' === String(value || '').trim();
    $target.text(is_empty ? labels.emptyLabel || 'Not selected' : value);
    $target.toggleClass('is-empty', is_empty);
  }

  /**
   * Expand one Settings inspector group through the shared collapsible API.
   *
   * @param {string} group_name Group data key.
   * @param {string} focus_selector Optional control to focus after expansion.
   * @return {void}
   */
  function open_inspector_group(group_name, focus_selector) {
    var $group = $('.wpbc_add_appointment__inspector_overview .wpbc_ui__collapsible_group[data-group="' + group_name + '"]').first();
    var root;
    var api;
    if (!$group.length) {
      return;
    }
    root = $group.closest('.wpbc_collapsible').get(0);
    api = root && root.__wpbc_collapsible_instance;
    if (api && 'function' === typeof api.expand) {
      api.expand($group.get(0));
    } else {
      $group.siblings('.wpbc_ui__collapsible_group').each(function () {
        var $sibling = $(this);
        $sibling.removeClass('is-open');
        $sibling.children('.group__header').attr('aria-expanded', 'false');
        $sibling.children('.group__fields').attr({
          hidden: true,
          'aria-hidden': 'true'
        });
      });
      $group.addClass('is-open');
      $group.children('.group__header').attr('aria-expanded', 'true');
      $group.children('.group__fields').removeAttr('hidden').attr('aria-hidden', 'false');
    }
    window.requestAnimationFrame(function () {
      $group.get(0).scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      if (focus_selector) {
        window.setTimeout(function () {
          $(focus_selector).first().trigger('focus');
        }, 250);
      }
    });
  }

  /** Format the effective before/after Service buffers. */
  function get_buffer_summary($source) {
    var before = $source.attr('data-buffer-before');
    var after = $source.attr('data-buffer-after');
    if ('undefined' === typeof before) {
      before = $source.attr('data-summary-buffer-before');
      after = $source.attr('data-summary-buffer-after');
    }
    if ('undefined' === typeof before || 'undefined' === typeof after) {
      return '';
    }
    return String(before) + ' / ' + String(after) + ' ' + (labels.minutesLabel || 'min');
  }

  /** Read the most useful customer identity from the loaded Booking Form. */
  function get_customer_summary($form) {
    var first = get_field_value($form.find('[name^="firstname"]').first());
    var last = get_field_value($form.find('[name^="secondname"], [name^="lastname"]').first());
    var email = get_field_value($form.find('[name^="email"]').first());
    var name = String(first + ' ' + last).trim();
    return name || email;
  }

  /** Mirror live Appointment and native Booking Form values into the inspector. */
  function refresh_summary() {
    var $root = $('.wpbc_add_appointment__canvas .wpbc_booking_appointment').first();
    var $native = $root.find('.wpbc_booking_appointment__native_form').first();
    var $form = $native.find('form').first();
    var $service = $root.find('input[name="wpbc_appointment_service"]:checked').closest('.wpbc_booking_appointment__choice');
    var $provider = $root.find('input[name="wpbc_appointment_provider"]:checked').closest('.wpbc_booking_appointment__choice');
    var $selected = $root.find('.wpbc_booking_appointment__selected').first();
    var $detail_source = $provider.length ? $provider : $service.length ? $service : $selected;
    var stage = $root.attr('data-appointment-stage') || 'service';
    var step = get_text($root, '.wpbc_booking_appointment__progress_step.is-active .wpbc_booking_appointment__progress_label');
    var service = $service.attr('data-summary-service') || $selected.attr('data-summary-service') || '';
    var provider = $provider.attr('data-summary-provider') || '';
    var duration = $detail_source.attr('data-summary-duration') || '';
    var price = $detail_source.attr('data-summary-price') || '';
    if ($native.length) {
      service = $native.attr('data-service-title') || service;
      provider = $native.attr('data-provider-title') || provider;
      duration = $native.attr('data-duration-label') || duration;
      price = $native.attr('data-service-cost-label') || price;
      $detail_source = $native;
    }
    set_summary_value('step', step || stage);
    set_summary_value('service', service);
    set_summary_value('provider', provider);
    set_summary_value('duration', duration);
    set_summary_value('buffers', get_buffer_summary($detail_source));
    set_summary_value('price', price);
    set_summary_value('date', get_field_value($form.find('[id^="date_booking"]').first()));
    set_summary_value('time', get_field_value($form.find('[name^="starttime"]').first()));
    set_summary_value('customer', get_customer_summary($form));
    set_summary_value('form', $native.attr('data-form-slug') || '');
    set_summary_value('emails', $('#is_send_email_for_pending').is(':checked') ? labels.enabledLabel || 'Enabled' : labels.disabledLabel || 'Disabled');
    $('[data-wpbc-add-appointment-start-over]').prop('hidden', 'service' === stage);
    $('[data-wpbc-add-appointment-autofill]').prop('disabled', !$form.length);
  }

  /** Debounce summary work during large AJAX Booking Form DOM insertions. */
  function schedule_summary_refresh() {
    window.clearTimeout(summary_timer);
    summary_timer = window.setTimeout(refresh_summary, 20);
  }

  /** Fill sample customer fields in the current form without submitting it. */
  function auto_fill_booking_form() {
    var $form = $('.wpbc_add_appointment__canvas .wpbc_booking_appointment__native_form form').first();
    if (!$form.length) {
      return;
    }
    $form.find('input, textarea, select').each(function () {
      var $field = $(this);
      var name = String($field.attr('name') || '').toLowerCase();
      var type = String($field.attr('type') || '').toLowerCase();
      var ignored = /date_booking|starttime|endtime|durationtime|rangetime|captcha|coupon|service_id|appointment_/.test(name);
      var value = '';
      if (ignored || $field.is(':disabled') || 'hidden' === type || 'button' === type || 'submit' === type || 'radio' === type) {
        return;
      }
      if ('checkbox' === type) {
        if ($field.prop('required')) {
          $field.prop('checked', true).trigger('change');
        }
        return;
      }
      if ($field.is('select')) {
        if (!$field.val()) {
          var $option = $field.find('option:not(:disabled)').filter(function () {
            return '' !== String($(this).val() || '');
          }).first();
          if ($option.length) {
            $field.val($option.val()).trigger('change');
          }
        }
        return;
      }
      if (/^firstname/.test(name)) {
        value = 'John';
      } else if (/^(secondname|lastname)/.test(name)) {
        value = 'Smith';
      } else if (/^email/.test(name) || 'email' === type) {
        value = 'blank@wpbookingmanager.com';
      } else if (/^phone/.test(name) || 'tel' === type) {
        value = '0000000000';
      } else if ($field.is('textarea')) {
        value = '---';
      }
      if (value && !$field.val()) {
        $field.val(value).trigger('input').trigger('change');
      }
    });
    schedule_summary_refresh();
  }

  /** Copy the authoritative Appointment correction into its convenience slider. */
  function synchronize_cost_correction_range() {
    var $number_field = $('#wpbc_add_appointment_cost_correction');
    var $range = $('[data-wpbc-admin-cost-correction-range="1"]').first();
    var number_value;
    if (!$number_field.length || !$range.length) {
      return;
    }
    number_value = Number($number_field.val());
    if ('' === String($number_field.val() || '').trim() || !isFinite(number_value)) {
      $range.val('0');
      return;
    }
    $range.val(String(number_value));
  }

  /** Copy the convenience slider into the authoritative Appointment number input. */
  function synchronize_cost_correction_number() {
    var $number_field = $('#wpbc_add_appointment_cost_correction');
    var $range = $('[data-wpbc-admin-cost-correction-range="1"]').first();
    if (!$number_field.length || !$range.length) {
      return;
    }
    $number_field.val($range.val()).trigger('input');
  }

  /** Clear an unsaved or successfully submitted Appointment correction draft. */
  function clear_cost_correction() {
    var $number_field = $('#wpbc_add_appointment_cost_correction');
    if (!$number_field.length) {
      return;
    }
    $number_field.val('');
    synchronize_cost_correction_range();
  }

  /**
   * Add an explicitly entered correction to the active Appointment request.
   *
   * The inspector is outside the AJAX-inserted native Booking Form. Requiring
   * the submitted Provider to match the active Appointment form prevents this
   * page-only draft from affecting an unrelated booking-create event.
   *
   * @param {Event} event jQuery event.
   * @param {number} resource_id Submitted Provider resource ID.
   * @param {Object} params Mutable booking-create request parameters.
   * @return {void}
   */
  function add_cost_correction_to_appointment_request(event, resource_id, params) {
    var number_field = document.getElementById('wpbc_add_appointment_cost_correction');
    var $native_form = $('.wpbc_add_appointment__canvas .wpbc_booking_appointment__native_form[data-provider-id="' + Number(resource_id || 0) + '"]').first();
    var raw_cost;
    if (!params || !number_field || !$native_form.length) {
      return;
    }
    delete params.wpbc_admin_cost_correction;
    raw_cost = String(number_field.value || '').trim();
    if ('' === raw_cost || !number_field.checkValidity()) {
      return;
    }
    params.wpbc_admin_cost_correction = raw_cost;
  }
  $(document).on('click', '.wpbc_add_appointment__rightbar_tabs [role="tab"]', function (event) {
    event.preventDefault();
    switch_right_panel($(this));
  });
  $(document).on('click', '[data-wpbc-add-appointment-start-over]', function () {
    clear_cost_correction();
    var $action = $('.wpbc_add_appointment__canvas [data-wpbc-appointment-action="start-over"]').first();
    if (!$action.length) {
      $action = $('.wpbc_add_appointment__canvas [data-appointment-back="service"]').first();
    }
    if ($action.length) {
      $action.trigger('click');
    }
  });
  $(document).on('click', '.wpbc_add_appointment__canvas [data-wpbc-appointment-action="start-over"]', clear_cost_correction);
  $(document).on('click', '[data-wpbc-add-appointment-open-group]', function (event) {
    event.preventDefault();
    open_inspector_group($(this).attr('data-wpbc-add-appointment-open-group'), $(this).attr('data-wpbc-add-appointment-focus') || '');
  });
  $(document).on('click', '[data-wpbc-add-appointment-autofill]', auto_fill_booking_form);
  $(document).on('input change wpbc_booking_date_or_option_selected', '.wpbc_add_appointment__canvas, #is_send_email_for_pending', schedule_summary_refresh);
  $(document).on('input', '#wpbc_add_appointment_cost_correction', synchronize_cost_correction_range);
  $(document).on('input', '.wpbc_add_appointment__cost_correction [data-wpbc-admin-cost-correction-range="1"]', synchronize_cost_correction_number);
  $('body').on('wpbc_before_booking_create.wpbc_add_appointment_cost_correction', add_cost_correction_to_appointment_request);
  $('body').on('wpbc_booking_form_submit_success.wpbc_add_appointment_cost_correction', clear_cost_correction);
  $(function () {
    var stage = document.querySelector('.wpbc_add_appointment__canvas .wpbc_booking_appointment__stage');
    apply_booking_context();
    refresh_summary();
    synchronize_cost_correction_range();
    if (stage && window.MutationObserver) {
      new MutationObserver(schedule_summary_refresh).observe(stage, {
        childList: true,
        subtree: true
      });
    }
  });
})(jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hZGQtYXBwb2ludG1lbnQvX291dC9hZGRfYXBwb2ludG1lbnRfcGFnZS5qcyIsIm5hbWVzIjpbIiQiLCJzdW1tYXJ5X3RpbWVyIiwibGFiZWxzIiwid2luZG93Iiwid3BiY19hZGRfYXBwb2ludG1lbnRfcGFnZV9jb25maWciLCJhcHBseV9ib29raW5nX2NvbnRleHQiLCJfd3BiYyIsInNldF9vdGhlcl9wYXJhbSIsImFsbG93UGFzdCIsImFsbG93UGFzdERhdGVBcnIiLCJTdHJpbmciLCJhZG1pbkJvb2tpbmdOb25jZSIsInN3aXRjaF9yaWdodF9wYW5lbCIsIiR0YWIiLCJwYW5lbF9pZCIsImF0dHIiLCIkdGFicyIsImNsb3Nlc3QiLCJmaW5kIiwiJHBhbmVscyIsImhpZGRlbiIsInJlbW92ZUF0dHIiLCJnZXRfdGV4dCIsIiRyb290Iiwic2VsZWN0b3IiLCJmaXJzdCIsInRleHQiLCJyZXBsYWNlIiwidHJpbSIsImdldF9maWVsZF92YWx1ZSIsIiRmaWVsZCIsInZhbHVlIiwibGVuZ3RoIiwiaXMiLCJ2YWwiLCJzZXRfc3VtbWFyeV92YWx1ZSIsImtleSIsIiR0YXJnZXQiLCJpc19lbXB0eSIsImVtcHR5TGFiZWwiLCJ0b2dnbGVDbGFzcyIsIm9wZW5faW5zcGVjdG9yX2dyb3VwIiwiZ3JvdXBfbmFtZSIsImZvY3VzX3NlbGVjdG9yIiwiJGdyb3VwIiwicm9vdCIsImFwaSIsImdldCIsIl9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZSIsImV4cGFuZCIsInNpYmxpbmdzIiwiZWFjaCIsIiRzaWJsaW5nIiwicmVtb3ZlQ2xhc3MiLCJjaGlsZHJlbiIsImFkZENsYXNzIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwic2Nyb2xsSW50b1ZpZXciLCJiZWhhdmlvciIsImJsb2NrIiwic2V0VGltZW91dCIsInRyaWdnZXIiLCJnZXRfYnVmZmVyX3N1bW1hcnkiLCIkc291cmNlIiwiYmVmb3JlIiwiYWZ0ZXIiLCJtaW51dGVzTGFiZWwiLCJnZXRfY3VzdG9tZXJfc3VtbWFyeSIsIiRmb3JtIiwibGFzdCIsImVtYWlsIiwibmFtZSIsInJlZnJlc2hfc3VtbWFyeSIsIiRuYXRpdmUiLCIkc2VydmljZSIsIiRwcm92aWRlciIsIiRzZWxlY3RlZCIsIiRkZXRhaWxfc291cmNlIiwic3RhZ2UiLCJzdGVwIiwic2VydmljZSIsInByb3ZpZGVyIiwiZHVyYXRpb24iLCJwcmljZSIsImVuYWJsZWRMYWJlbCIsImRpc2FibGVkTGFiZWwiLCJwcm9wIiwic2NoZWR1bGVfc3VtbWFyeV9yZWZyZXNoIiwiY2xlYXJUaW1lb3V0IiwiYXV0b19maWxsX2Jvb2tpbmdfZm9ybSIsInRvTG93ZXJDYXNlIiwidHlwZSIsImlnbm9yZWQiLCJ0ZXN0IiwiJG9wdGlvbiIsImZpbHRlciIsInN5bmNocm9uaXplX2Nvc3RfY29ycmVjdGlvbl9yYW5nZSIsIiRudW1iZXJfZmllbGQiLCIkcmFuZ2UiLCJudW1iZXJfdmFsdWUiLCJOdW1iZXIiLCJpc0Zpbml0ZSIsInN5bmNocm9uaXplX2Nvc3RfY29ycmVjdGlvbl9udW1iZXIiLCJjbGVhcl9jb3N0X2NvcnJlY3Rpb24iLCJhZGRfY29zdF9jb3JyZWN0aW9uX3RvX2FwcG9pbnRtZW50X3JlcXVlc3QiLCJldmVudCIsInJlc291cmNlX2lkIiwicGFyYW1zIiwibnVtYmVyX2ZpZWxkIiwiZG9jdW1lbnQiLCJnZXRFbGVtZW50QnlJZCIsIiRuYXRpdmVfZm9ybSIsInJhd19jb3N0Iiwid3BiY19hZG1pbl9jb3N0X2NvcnJlY3Rpb24iLCJjaGVja1ZhbGlkaXR5Iiwib24iLCJwcmV2ZW50RGVmYXVsdCIsIiRhY3Rpb24iLCJxdWVyeVNlbGVjdG9yIiwiTXV0YXRpb25PYnNlcnZlciIsIm9ic2VydmUiLCJjaGlsZExpc3QiLCJzdWJ0cmVlIiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hZGQtYXBwb2ludG1lbnQvX3NyYy9hZGRfYXBwb2ludG1lbnRfcGFnZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQWRkIEFwcG9pbnRtZW50IGFkbWluaXN0cmF0b3IgaW5zcGVjdG9yIGFuZCBub24tc3VibWl0dGluZyBoZWxwZXIgdG9vbHMuICovXG4oIGZ1bmN0aW9uICggJCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBzdW1tYXJ5X3RpbWVyID0gMDtcblx0dmFyIGxhYmVscyA9IHdpbmRvdy53cGJjX2FkZF9hcHBvaW50bWVudF9wYWdlX2NvbmZpZyB8fCB7fTtcblxuXHQvKiogQXBwbHkgdGhlIGFkbWluaXN0cmF0b3IgcGFnZSBjb250ZXh0IGJlZm9yZSBhbnkgUHJvdmlkZXIgY2FsZW5kYXIgbG9hZHMuICovXG5cdGZ1bmN0aW9uIGFwcGx5X2Jvb2tpbmdfY29udGV4dCgpIHtcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2Ygd2luZG93Ll93cGJjICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHdpbmRvdy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYm9va2luZ19oYXNoJywgJycgKTtcblx0XHR3aW5kb3cuX3dwYmMuc2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2FsbG93X3Bhc3QnLCBsYWJlbHMuYWxsb3dQYXN0ID8gMSA6IDAgKTtcblx0XHR3aW5kb3cuX3dwYmMuc2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2FsbG93X3Bhc3RfYXJyJywgbGFiZWxzLmFsbG93UGFzdERhdGVBcnIgfHwgW10gKTtcblx0XHR3aW5kb3cuX3dwYmMuc2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2FkbWluX2Jvb2tpbmdfbm9uY2UnLCBTdHJpbmcoIGxhYmVscy5hZG1pbkJvb2tpbmdOb25jZSB8fCAnJyApICk7XG5cdH1cblxuXHQvKiogU3dpdGNoIG9uZSBzaGFyZWQgcmlnaHQtc2lkZWJhciBwYW5lbC4gKi9cblx0ZnVuY3Rpb24gc3dpdGNoX3JpZ2h0X3BhbmVsKCAkdGFiICkge1xuXHRcdHZhciBwYW5lbF9pZCA9ICR0YWIuYXR0ciggJ2FyaWEtY29udHJvbHMnICk7XG5cdFx0dmFyICR0YWJzID0gJHRhYi5jbG9zZXN0KCAnLndwYmNfYWRkX2FwcG9pbnRtZW50X19yaWdodGJhcl90YWJzJyApLmZpbmQoICdbcm9sZT1cInRhYlwiXScgKTtcblx0XHR2YXIgJHBhbmVscyA9ICQoICcud3BiY19hZGRfYXBwb2ludG1lbnRfX3JpZ2h0YmFyJyApLmZpbmQoICdbcm9sZT1cInRhYnBhbmVsXCJdJyApO1xuXG5cdFx0JHRhYnMuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICk7XG5cdFx0JHRhYi5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xuXHRcdCRwYW5lbHMuYXR0ciggeyBoaWRkZW46IHRydWUsICdhcmlhLWhpZGRlbic6ICd0cnVlJyB9ICk7XG5cdFx0JCggJyMnICsgcGFuZWxfaWQgKS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0fVxuXG5cdC8qKiBSZXR1cm4gdHJpbW1lZCB2aXNpYmxlIHRleHQgZnJvbSB0aGUgZmlyc3QgbWF0Y2hpbmcgZWxlbWVudC4gKi9cblx0ZnVuY3Rpb24gZ2V0X3RleHQoICRyb290LCBzZWxlY3RvciApIHtcblx0XHRyZXR1cm4gU3RyaW5nKCAkcm9vdC5maW5kKCBzZWxlY3RvciApLmZpcnN0KCkudGV4dCgpIHx8ICcnICkucmVwbGFjZSggL1xccysvZywgJyAnICkudHJpbSgpO1xuXHR9XG5cblx0LyoqIFJldHVybiB0aGUgZGlzcGxheSB2YWx1ZSBvZiBvbmUgbmF0aXZlIEJvb2tpbmcgRm9ybSBmaWVsZC4gKi9cblx0ZnVuY3Rpb24gZ2V0X2ZpZWxkX3ZhbHVlKCAkZmllbGQgKSB7XG5cdFx0dmFyIHZhbHVlO1xuXG5cdFx0aWYgKCAhICRmaWVsZC5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdGlmICggJGZpZWxkLmlzKCAnc2VsZWN0JyApICkge1xuXHRcdFx0dmFsdWUgPSAkZmllbGQuZmluZCggJ29wdGlvbjpzZWxlY3RlZCcgKS50ZXh0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhbHVlID0gJGZpZWxkLnZhbCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBTdHJpbmcoIHZhbHVlIHx8ICcnICkucmVwbGFjZSggL1xccysvZywgJyAnICkudHJpbSgpO1xuXHR9XG5cblx0LyoqIFVwZGF0ZSBvbmUgc3VtbWFyeSB2YWx1ZSBhbmQgaXRzIGVtcHR5LXN0YXRlIHByZXNlbnRhdGlvbi4gKi9cblx0ZnVuY3Rpb24gc2V0X3N1bW1hcnlfdmFsdWUoIGtleSwgdmFsdWUgKSB7XG5cdFx0dmFyICR0YXJnZXQgPSAkKCAnW2RhdGEtd3BiYy1hZGQtYXBwb2ludG1lbnQtc3VtbWFyeT1cIicgKyBrZXkgKyAnXCJdJyApO1xuXHRcdHZhciBpc19lbXB0eSA9ICcnID09PSBTdHJpbmcoIHZhbHVlIHx8ICcnICkudHJpbSgpO1xuXG5cdFx0JHRhcmdldC50ZXh0KCBpc19lbXB0eSA/ICggbGFiZWxzLmVtcHR5TGFiZWwgfHwgJ05vdCBzZWxlY3RlZCcgKSA6IHZhbHVlICk7XG5cdFx0JHRhcmdldC50b2dnbGVDbGFzcyggJ2lzLWVtcHR5JywgaXNfZW1wdHkgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHBhbmQgb25lIFNldHRpbmdzIGluc3BlY3RvciBncm91cCB0aHJvdWdoIHRoZSBzaGFyZWQgY29sbGFwc2libGUgQVBJLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZ3JvdXBfbmFtZSBHcm91cCBkYXRhIGtleS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IGZvY3VzX3NlbGVjdG9yIE9wdGlvbmFsIGNvbnRyb2wgdG8gZm9jdXMgYWZ0ZXIgZXhwYW5zaW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9pbnNwZWN0b3JfZ3JvdXAoIGdyb3VwX25hbWUsIGZvY3VzX3NlbGVjdG9yICkge1xuXHRcdHZhciAkZ3JvdXAgPSAkKCAnLndwYmNfYWRkX2FwcG9pbnRtZW50X19pbnNwZWN0b3Jfb3ZlcnZpZXcgLndwYmNfdWlfX2NvbGxhcHNpYmxlX2dyb3VwW2RhdGEtZ3JvdXA9XCInICsgZ3JvdXBfbmFtZSArICdcIl0nICkuZmlyc3QoKTtcblx0XHR2YXIgcm9vdDtcblx0XHR2YXIgYXBpO1xuXG5cdFx0aWYgKCAhICRncm91cC5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cm9vdCA9ICRncm91cC5jbG9zZXN0KCAnLndwYmNfY29sbGFwc2libGUnICkuZ2V0KCAwICk7XG5cdFx0YXBpID0gcm9vdCAmJiByb290Ll9fd3BiY19jb2xsYXBzaWJsZV9pbnN0YW5jZTtcblxuXHRcdGlmICggYXBpICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBhcGkuZXhwYW5kICkge1xuXHRcdFx0YXBpLmV4cGFuZCggJGdyb3VwLmdldCggMCApICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdCRncm91cC5zaWJsaW5ncyggJy53cGJjX3VpX19jb2xsYXBzaWJsZV9ncm91cCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciAkc2libGluZyA9ICQoIHRoaXMgKTtcblx0XHRcdFx0JHNpYmxpbmcucmVtb3ZlQ2xhc3MoICdpcy1vcGVuJyApO1xuXHRcdFx0XHQkc2libGluZy5jaGlsZHJlbiggJy5ncm91cF9faGVhZGVyJyApLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyApO1xuXHRcdFx0XHQkc2libGluZy5jaGlsZHJlbiggJy5ncm91cF9fZmllbGRzJyApLmF0dHIoIHsgaGlkZGVuOiB0cnVlLCAnYXJpYS1oaWRkZW4nOiAndHJ1ZScgfSApO1xuXHRcdFx0fSApO1xuXHRcdFx0JGdyb3VwLmFkZENsYXNzKCAnaXMtb3BlbicgKTtcblx0XHRcdCRncm91cC5jaGlsZHJlbiggJy5ncm91cF9faGVhZGVyJyApLmF0dHIoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0XHQkZ3JvdXAuY2hpbGRyZW4oICcuZ3JvdXBfX2ZpZWxkcycgKS5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0XHR9XG5cblx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHQkZ3JvdXAuZ2V0KCAwICkuc2Nyb2xsSW50b1ZpZXcoIHsgYmVoYXZpb3I6ICdzbW9vdGgnLCBibG9jazogJ3N0YXJ0JyB9ICk7XG5cdFx0XHRpZiAoIGZvY3VzX3NlbGVjdG9yICkge1xuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdCQoIGZvY3VzX3NlbGVjdG9yICkuZmlyc3QoKS50cmlnZ2VyKCAnZm9jdXMnICk7XG5cdFx0XHRcdH0sIDI1MCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBGb3JtYXQgdGhlIGVmZmVjdGl2ZSBiZWZvcmUvYWZ0ZXIgU2VydmljZSBidWZmZXJzLiAqL1xuXHRmdW5jdGlvbiBnZXRfYnVmZmVyX3N1bW1hcnkoICRzb3VyY2UgKSB7XG5cdFx0dmFyIGJlZm9yZSA9ICRzb3VyY2UuYXR0ciggJ2RhdGEtYnVmZmVyLWJlZm9yZScgKTtcblx0XHR2YXIgYWZ0ZXIgPSAkc291cmNlLmF0dHIoICdkYXRhLWJ1ZmZlci1hZnRlcicgKTtcblxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBiZWZvcmUgKSB7XG5cdFx0XHRiZWZvcmUgPSAkc291cmNlLmF0dHIoICdkYXRhLXN1bW1hcnktYnVmZmVyLWJlZm9yZScgKTtcblx0XHRcdGFmdGVyID0gJHNvdXJjZS5hdHRyKCAnZGF0YS1zdW1tYXJ5LWJ1ZmZlci1hZnRlcicgKTtcblx0XHR9XG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGJlZm9yZSB8fCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGFmdGVyICkge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblxuXHRcdHJldHVybiBTdHJpbmcoIGJlZm9yZSApICsgJyAvICcgKyBTdHJpbmcoIGFmdGVyICkgKyAnICcgKyAoIGxhYmVscy5taW51dGVzTGFiZWwgfHwgJ21pbicgKTtcblx0fVxuXG5cdC8qKiBSZWFkIHRoZSBtb3N0IHVzZWZ1bCBjdXN0b21lciBpZGVudGl0eSBmcm9tIHRoZSBsb2FkZWQgQm9va2luZyBGb3JtLiAqL1xuXHRmdW5jdGlvbiBnZXRfY3VzdG9tZXJfc3VtbWFyeSggJGZvcm0gKSB7XG5cdFx0dmFyIGZpcnN0ID0gZ2V0X2ZpZWxkX3ZhbHVlKCAkZm9ybS5maW5kKCAnW25hbWVePVwiZmlyc3RuYW1lXCJdJyApLmZpcnN0KCkgKTtcblx0XHR2YXIgbGFzdCA9IGdldF9maWVsZF92YWx1ZSggJGZvcm0uZmluZCggJ1tuYW1lXj1cInNlY29uZG5hbWVcIl0sIFtuYW1lXj1cImxhc3RuYW1lXCJdJyApLmZpcnN0KCkgKTtcblx0XHR2YXIgZW1haWwgPSBnZXRfZmllbGRfdmFsdWUoICRmb3JtLmZpbmQoICdbbmFtZV49XCJlbWFpbFwiXScgKS5maXJzdCgpICk7XG5cdFx0dmFyIG5hbWUgPSBTdHJpbmcoIGZpcnN0ICsgJyAnICsgbGFzdCApLnRyaW0oKTtcblxuXHRcdHJldHVybiBuYW1lIHx8IGVtYWlsO1xuXHR9XG5cblx0LyoqIE1pcnJvciBsaXZlIEFwcG9pbnRtZW50IGFuZCBuYXRpdmUgQm9va2luZyBGb3JtIHZhbHVlcyBpbnRvIHRoZSBpbnNwZWN0b3IuICovXG5cdGZ1bmN0aW9uIHJlZnJlc2hfc3VtbWFyeSgpIHtcblx0XHR2YXIgJHJvb3QgPSAkKCAnLndwYmNfYWRkX2FwcG9pbnRtZW50X19jYW52YXMgLndwYmNfYm9va2luZ19hcHBvaW50bWVudCcgKS5maXJzdCgpO1xuXHRcdHZhciAkbmF0aXZlID0gJHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtJyApLmZpcnN0KCk7XG5cdFx0dmFyICRmb3JtID0gJG5hdGl2ZS5maW5kKCAnZm9ybScgKS5maXJzdCgpO1xuXHRcdHZhciAkc2VydmljZSA9ICRyb290LmZpbmQoICdpbnB1dFtuYW1lPVwid3BiY19hcHBvaW50bWVudF9zZXJ2aWNlXCJdOmNoZWNrZWQnICkuY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2Nob2ljZScgKTtcblx0XHR2YXIgJHByb3ZpZGVyID0gJHJvb3QuZmluZCggJ2lucHV0W25hbWU9XCJ3cGJjX2FwcG9pbnRtZW50X3Byb3ZpZGVyXCJdOmNoZWNrZWQnICkuY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX2Nob2ljZScgKTtcblx0XHR2YXIgJHNlbGVjdGVkID0gJHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX3NlbGVjdGVkJyApLmZpcnN0KCk7XG5cdFx0dmFyICRkZXRhaWxfc291cmNlID0gJHByb3ZpZGVyLmxlbmd0aCA/ICRwcm92aWRlciA6ICggJHNlcnZpY2UubGVuZ3RoID8gJHNlcnZpY2UgOiAkc2VsZWN0ZWQgKTtcblx0XHR2YXIgc3RhZ2UgPSAkcm9vdC5hdHRyKCAnZGF0YS1hcHBvaW50bWVudC1zdGFnZScgKSB8fCAnc2VydmljZSc7XG5cdFx0dmFyIHN0ZXAgPSBnZXRfdGV4dCggJHJvb3QsICcud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19wcm9ncmVzc19zdGVwLmlzLWFjdGl2ZSAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19wcm9ncmVzc19sYWJlbCcgKTtcblx0XHR2YXIgc2VydmljZSA9ICRzZXJ2aWNlLmF0dHIoICdkYXRhLXN1bW1hcnktc2VydmljZScgKSB8fCAkc2VsZWN0ZWQuYXR0ciggJ2RhdGEtc3VtbWFyeS1zZXJ2aWNlJyApIHx8ICcnO1xuXHRcdHZhciBwcm92aWRlciA9ICRwcm92aWRlci5hdHRyKCAnZGF0YS1zdW1tYXJ5LXByb3ZpZGVyJyApIHx8ICcnO1xuXHRcdHZhciBkdXJhdGlvbiA9ICRkZXRhaWxfc291cmNlLmF0dHIoICdkYXRhLXN1bW1hcnktZHVyYXRpb24nICkgfHwgJyc7XG5cdFx0dmFyIHByaWNlID0gJGRldGFpbF9zb3VyY2UuYXR0ciggJ2RhdGEtc3VtbWFyeS1wcmljZScgKSB8fCAnJztcblxuXHRcdGlmICggJG5hdGl2ZS5sZW5ndGggKSB7XG5cdFx0XHRzZXJ2aWNlID0gJG5hdGl2ZS5hdHRyKCAnZGF0YS1zZXJ2aWNlLXRpdGxlJyApIHx8IHNlcnZpY2U7XG5cdFx0XHRwcm92aWRlciA9ICRuYXRpdmUuYXR0ciggJ2RhdGEtcHJvdmlkZXItdGl0bGUnICkgfHwgcHJvdmlkZXI7XG5cdFx0XHRkdXJhdGlvbiA9ICRuYXRpdmUuYXR0ciggJ2RhdGEtZHVyYXRpb24tbGFiZWwnICkgfHwgZHVyYXRpb247XG5cdFx0XHRwcmljZSA9ICRuYXRpdmUuYXR0ciggJ2RhdGEtc2VydmljZS1jb3N0LWxhYmVsJyApIHx8IHByaWNlO1xuXHRcdFx0JGRldGFpbF9zb3VyY2UgPSAkbmF0aXZlO1xuXHRcdH1cblxuXHRcdHNldF9zdW1tYXJ5X3ZhbHVlKCAnc3RlcCcsIHN0ZXAgfHwgc3RhZ2UgKTtcblx0XHRzZXRfc3VtbWFyeV92YWx1ZSggJ3NlcnZpY2UnLCBzZXJ2aWNlICk7XG5cdFx0c2V0X3N1bW1hcnlfdmFsdWUoICdwcm92aWRlcicsIHByb3ZpZGVyICk7XG5cdFx0c2V0X3N1bW1hcnlfdmFsdWUoICdkdXJhdGlvbicsIGR1cmF0aW9uICk7XG5cdFx0c2V0X3N1bW1hcnlfdmFsdWUoICdidWZmZXJzJywgZ2V0X2J1ZmZlcl9zdW1tYXJ5KCAkZGV0YWlsX3NvdXJjZSApICk7XG5cdFx0c2V0X3N1bW1hcnlfdmFsdWUoICdwcmljZScsIHByaWNlICk7XG5cdFx0c2V0X3N1bW1hcnlfdmFsdWUoICdkYXRlJywgZ2V0X2ZpZWxkX3ZhbHVlKCAkZm9ybS5maW5kKCAnW2lkXj1cImRhdGVfYm9va2luZ1wiXScgKS5maXJzdCgpICkgKTtcblx0XHRzZXRfc3VtbWFyeV92YWx1ZSggJ3RpbWUnLCBnZXRfZmllbGRfdmFsdWUoICRmb3JtLmZpbmQoICdbbmFtZV49XCJzdGFydHRpbWVcIl0nICkuZmlyc3QoKSApICk7XG5cdFx0c2V0X3N1bW1hcnlfdmFsdWUoICdjdXN0b21lcicsIGdldF9jdXN0b21lcl9zdW1tYXJ5KCAkZm9ybSApICk7XG5cdFx0c2V0X3N1bW1hcnlfdmFsdWUoICdmb3JtJywgJG5hdGl2ZS5hdHRyKCAnZGF0YS1mb3JtLXNsdWcnICkgfHwgJycgKTtcblx0XHRzZXRfc3VtbWFyeV92YWx1ZSggJ2VtYWlscycsICQoICcjaXNfc2VuZF9lbWFpbF9mb3JfcGVuZGluZycgKS5pcyggJzpjaGVja2VkJyApID8gKCBsYWJlbHMuZW5hYmxlZExhYmVsIHx8ICdFbmFibGVkJyApIDogKCBsYWJlbHMuZGlzYWJsZWRMYWJlbCB8fCAnRGlzYWJsZWQnICkgKTtcblx0XHQkKCAnW2RhdGEtd3BiYy1hZGQtYXBwb2ludG1lbnQtc3RhcnQtb3Zlcl0nICkucHJvcCggJ2hpZGRlbicsICdzZXJ2aWNlJyA9PT0gc3RhZ2UgKTtcblx0XHQkKCAnW2RhdGEtd3BiYy1hZGQtYXBwb2ludG1lbnQtYXV0b2ZpbGxdJyApLnByb3AoICdkaXNhYmxlZCcsICEgJGZvcm0ubGVuZ3RoICk7XG5cdH1cblxuXHQvKiogRGVib3VuY2Ugc3VtbWFyeSB3b3JrIGR1cmluZyBsYXJnZSBBSkFYIEJvb2tpbmcgRm9ybSBET00gaW5zZXJ0aW9ucy4gKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfc3VtbWFyeV9yZWZyZXNoKCkge1xuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIHN1bW1hcnlfdGltZXIgKTtcblx0XHRzdW1tYXJ5X3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIHJlZnJlc2hfc3VtbWFyeSwgMjAgKTtcblx0fVxuXG5cdC8qKiBGaWxsIHNhbXBsZSBjdXN0b21lciBmaWVsZHMgaW4gdGhlIGN1cnJlbnQgZm9ybSB3aXRob3V0IHN1Ym1pdHRpbmcgaXQuICovXG5cdGZ1bmN0aW9uIGF1dG9fZmlsbF9ib29raW5nX2Zvcm0oKSB7XG5cdFx0dmFyICRmb3JtID0gJCggJy53cGJjX2FkZF9hcHBvaW50bWVudF9fY2FudmFzIC53cGJjX2Jvb2tpbmdfYXBwb2ludG1lbnRfX25hdGl2ZV9mb3JtIGZvcm0nICkuZmlyc3QoKTtcblxuXHRcdGlmICggISAkZm9ybS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0JGZvcm0uZmluZCggJ2lucHV0LCB0ZXh0YXJlYSwgc2VsZWN0JyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkZmllbGQgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgbmFtZSA9IFN0cmluZyggJGZpZWxkLmF0dHIoICduYW1lJyApIHx8ICcnICkudG9Mb3dlckNhc2UoKTtcblx0XHRcdHZhciB0eXBlID0gU3RyaW5nKCAkZmllbGQuYXR0ciggJ3R5cGUnICkgfHwgJycgKS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0dmFyIGlnbm9yZWQgPSAvZGF0ZV9ib29raW5nfHN0YXJ0dGltZXxlbmR0aW1lfGR1cmF0aW9udGltZXxyYW5nZXRpbWV8Y2FwdGNoYXxjb3Vwb258c2VydmljZV9pZHxhcHBvaW50bWVudF8vLnRlc3QoIG5hbWUgKTtcblx0XHRcdHZhciB2YWx1ZSA9ICcnO1xuXG5cdFx0XHRpZiAoIGlnbm9yZWQgfHwgJGZpZWxkLmlzKCAnOmRpc2FibGVkJyApIHx8ICdoaWRkZW4nID09PSB0eXBlIHx8ICdidXR0b24nID09PSB0eXBlIHx8ICdzdWJtaXQnID09PSB0eXBlIHx8ICdyYWRpbycgPT09IHR5cGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ2NoZWNrYm94JyA9PT0gdHlwZSApIHtcblx0XHRcdFx0aWYgKCAkZmllbGQucHJvcCggJ3JlcXVpcmVkJyApICkge1xuXHRcdFx0XHRcdCRmaWVsZC5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJGZpZWxkLmlzKCAnc2VsZWN0JyApICkge1xuXHRcdFx0XHRpZiAoICEgJGZpZWxkLnZhbCgpICkge1xuXHRcdFx0XHRcdHZhciAkb3B0aW9uID0gJGZpZWxkLmZpbmQoICdvcHRpb246bm90KDpkaXNhYmxlZCknICkuZmlsdGVyKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJycgIT09IFN0cmluZyggJCggdGhpcyApLnZhbCgpIHx8ICcnICk7XG5cdFx0XHRcdFx0fSApLmZpcnN0KCk7XG5cdFx0XHRcdFx0aWYgKCAkb3B0aW9uLmxlbmd0aCApIHtcblx0XHRcdFx0XHRcdCRmaWVsZC52YWwoICRvcHRpb24udmFsKCkgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIC9eZmlyc3RuYW1lLy50ZXN0KCBuYW1lICkgKSB7XG5cdFx0XHRcdHZhbHVlID0gJ0pvaG4nO1xuXHRcdFx0fSBlbHNlIGlmICggL14oc2Vjb25kbmFtZXxsYXN0bmFtZSkvLnRlc3QoIG5hbWUgKSApIHtcblx0XHRcdFx0dmFsdWUgPSAnU21pdGgnO1xuXHRcdFx0fSBlbHNlIGlmICggL15lbWFpbC8udGVzdCggbmFtZSApIHx8ICdlbWFpbCcgPT09IHR5cGUgKSB7XG5cdFx0XHRcdHZhbHVlID0gJ2JsYW5rQHdwYm9va2luZ21hbmFnZXIuY29tJztcblx0XHRcdH0gZWxzZSBpZiAoIC9ecGhvbmUvLnRlc3QoIG5hbWUgKSB8fCAndGVsJyA9PT0gdHlwZSApIHtcblx0XHRcdFx0dmFsdWUgPSAnMDAwMDAwMDAwMCc7XG5cdFx0XHR9IGVsc2UgaWYgKCAkZmllbGQuaXMoICd0ZXh0YXJlYScgKSApIHtcblx0XHRcdFx0dmFsdWUgPSAnLS0tJztcblx0XHRcdH1cblxuXHRcdFx0aWYgKCB2YWx1ZSAmJiAhICRmaWVsZC52YWwoKSApIHtcblx0XHRcdFx0JGZpZWxkLnZhbCggdmFsdWUgKS50cmlnZ2VyKCAnaW5wdXQnICkudHJpZ2dlciggJ2NoYW5nZScgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRzY2hlZHVsZV9zdW1tYXJ5X3JlZnJlc2goKTtcblx0fVxuXG5cdC8qKiBDb3B5IHRoZSBhdXRob3JpdGF0aXZlIEFwcG9pbnRtZW50IGNvcnJlY3Rpb24gaW50byBpdHMgY29udmVuaWVuY2Ugc2xpZGVyLiAqL1xuXHRmdW5jdGlvbiBzeW5jaHJvbml6ZV9jb3N0X2NvcnJlY3Rpb25fcmFuZ2UoKSB7XG5cdFx0dmFyICRudW1iZXJfZmllbGQgPSAkKCAnI3dwYmNfYWRkX2FwcG9pbnRtZW50X2Nvc3RfY29ycmVjdGlvbicgKTtcblx0XHR2YXIgJHJhbmdlID0gJCggJ1tkYXRhLXdwYmMtYWRtaW4tY29zdC1jb3JyZWN0aW9uLXJhbmdlPVwiMVwiXScgKS5maXJzdCgpO1xuXHRcdHZhciBudW1iZXJfdmFsdWU7XG5cblx0XHRpZiAoICEgJG51bWJlcl9maWVsZC5sZW5ndGggfHwgISAkcmFuZ2UubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdG51bWJlcl92YWx1ZSA9IE51bWJlciggJG51bWJlcl9maWVsZC52YWwoKSApO1xuXHRcdGlmICggJycgPT09IFN0cmluZyggJG51bWJlcl9maWVsZC52YWwoKSB8fCAnJyApLnRyaW0oKSB8fCAhIGlzRmluaXRlKCBudW1iZXJfdmFsdWUgKSApIHtcblx0XHRcdCRyYW5nZS52YWwoICcwJyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdCRyYW5nZS52YWwoIFN0cmluZyggbnVtYmVyX3ZhbHVlICkgKTtcblx0fVxuXG5cdC8qKiBDb3B5IHRoZSBjb252ZW5pZW5jZSBzbGlkZXIgaW50byB0aGUgYXV0aG9yaXRhdGl2ZSBBcHBvaW50bWVudCBudW1iZXIgaW5wdXQuICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX2Nvc3RfY29ycmVjdGlvbl9udW1iZXIoKSB7XG5cdFx0dmFyICRudW1iZXJfZmllbGQgPSAkKCAnI3dwYmNfYWRkX2FwcG9pbnRtZW50X2Nvc3RfY29ycmVjdGlvbicgKTtcblx0XHR2YXIgJHJhbmdlID0gJCggJ1tkYXRhLXdwYmMtYWRtaW4tY29zdC1jb3JyZWN0aW9uLXJhbmdlPVwiMVwiXScgKS5maXJzdCgpO1xuXG5cdFx0aWYgKCAhICRudW1iZXJfZmllbGQubGVuZ3RoIHx8ICEgJHJhbmdlLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkbnVtYmVyX2ZpZWxkLnZhbCggJHJhbmdlLnZhbCgpICkudHJpZ2dlciggJ2lucHV0JyApO1xuXHR9XG5cblx0LyoqIENsZWFyIGFuIHVuc2F2ZWQgb3Igc3VjY2Vzc2Z1bGx5IHN1Ym1pdHRlZCBBcHBvaW50bWVudCBjb3JyZWN0aW9uIGRyYWZ0LiAqL1xuXHRmdW5jdGlvbiBjbGVhcl9jb3N0X2NvcnJlY3Rpb24oKSB7XG5cdFx0dmFyICRudW1iZXJfZmllbGQgPSAkKCAnI3dwYmNfYWRkX2FwcG9pbnRtZW50X2Nvc3RfY29ycmVjdGlvbicgKTtcblxuXHRcdGlmICggISAkbnVtYmVyX2ZpZWxkLmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQkbnVtYmVyX2ZpZWxkLnZhbCggJycgKTtcblx0XHRzeW5jaHJvbml6ZV9jb3N0X2NvcnJlY3Rpb25fcmFuZ2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGQgYW4gZXhwbGljaXRseSBlbnRlcmVkIGNvcnJlY3Rpb24gdG8gdGhlIGFjdGl2ZSBBcHBvaW50bWVudCByZXF1ZXN0LlxuXHQgKlxuXHQgKiBUaGUgaW5zcGVjdG9yIGlzIG91dHNpZGUgdGhlIEFKQVgtaW5zZXJ0ZWQgbmF0aXZlIEJvb2tpbmcgRm9ybS4gUmVxdWlyaW5nXG5cdCAqIHRoZSBzdWJtaXR0ZWQgUHJvdmlkZXIgdG8gbWF0Y2ggdGhlIGFjdGl2ZSBBcHBvaW50bWVudCBmb3JtIHByZXZlbnRzIHRoaXNcblx0ICogcGFnZS1vbmx5IGRyYWZ0IGZyb20gYWZmZWN0aW5nIGFuIHVucmVsYXRlZCBib29raW5nLWNyZWF0ZSBldmVudC5cblx0ICpcblx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgalF1ZXJ5IGV2ZW50LlxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgU3VibWl0dGVkIFByb3ZpZGVyIHJlc291cmNlIElELlxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zIE11dGFibGUgYm9va2luZy1jcmVhdGUgcmVxdWVzdCBwYXJhbWV0ZXJzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYWRkX2Nvc3RfY29ycmVjdGlvbl90b19hcHBvaW50bWVudF9yZXF1ZXN0KCBldmVudCwgcmVzb3VyY2VfaWQsIHBhcmFtcyApIHtcblx0XHR2YXIgbnVtYmVyX2ZpZWxkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2FkZF9hcHBvaW50bWVudF9jb3N0X2NvcnJlY3Rpb24nICk7XG5cdFx0dmFyICRuYXRpdmVfZm9ybSA9ICQoICcud3BiY19hZGRfYXBwb2ludG1lbnRfX2NhbnZhcyAud3BiY19ib29raW5nX2FwcG9pbnRtZW50X19uYXRpdmVfZm9ybVtkYXRhLXByb3ZpZGVyLWlkPVwiJyArIE51bWJlciggcmVzb3VyY2VfaWQgfHwgMCApICsgJ1wiXScgKS5maXJzdCgpO1xuXHRcdHZhciByYXdfY29zdDtcblxuXHRcdGlmICggISBwYXJhbXMgfHwgISBudW1iZXJfZmllbGQgfHwgISAkbmF0aXZlX2Zvcm0ubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGRlbGV0ZSBwYXJhbXMud3BiY19hZG1pbl9jb3N0X2NvcnJlY3Rpb247XG5cdFx0cmF3X2Nvc3QgPSBTdHJpbmcoIG51bWJlcl9maWVsZC52YWx1ZSB8fCAnJyApLnRyaW0oKTtcblx0XHRpZiAoICcnID09PSByYXdfY29zdCB8fCAhIG51bWJlcl9maWVsZC5jaGVja1ZhbGlkaXR5KCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cGFyYW1zLndwYmNfYWRtaW5fY29zdF9jb3JyZWN0aW9uID0gcmF3X2Nvc3Q7XG5cdH1cblxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYWRkX2FwcG9pbnRtZW50X19yaWdodGJhcl90YWJzIFtyb2xlPVwidGFiXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHN3aXRjaF9yaWdodF9wYW5lbCggJCggdGhpcyApICk7XG5cdH0gKTtcblxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy1hZGQtYXBwb2ludG1lbnQtc3RhcnQtb3Zlcl0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y2xlYXJfY29zdF9jb3JyZWN0aW9uKCk7XG5cdFx0dmFyICRhY3Rpb24gPSAkKCAnLndwYmNfYWRkX2FwcG9pbnRtZW50X19jYW52YXMgW2RhdGEtd3BiYy1hcHBvaW50bWVudC1hY3Rpb249XCJzdGFydC1vdmVyXCJdJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAhICRhY3Rpb24ubGVuZ3RoICkge1xuXHRcdFx0JGFjdGlvbiA9ICQoICcud3BiY19hZGRfYXBwb2ludG1lbnRfX2NhbnZhcyBbZGF0YS1hcHBvaW50bWVudC1iYWNrPVwic2VydmljZVwiXScgKS5maXJzdCgpO1xuXHRcdH1cblx0XHRpZiAoICRhY3Rpb24ubGVuZ3RoICkge1xuXHRcdFx0JGFjdGlvbi50cmlnZ2VyKCAnY2xpY2snICk7XG5cdFx0fVxuXHR9ICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY19hZGRfYXBwb2ludG1lbnRfX2NhbnZhcyBbZGF0YS13cGJjLWFwcG9pbnRtZW50LWFjdGlvbj1cInN0YXJ0LW92ZXJcIl0nLCBjbGVhcl9jb3N0X2NvcnJlY3Rpb24gKTtcblxuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy1hZGQtYXBwb2ludG1lbnQtb3Blbi1ncm91cF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0b3Blbl9pbnNwZWN0b3JfZ3JvdXAoICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLWFkZC1hcHBvaW50bWVudC1vcGVuLWdyb3VwJyApLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYXBwb2ludG1lbnQtZm9jdXMnICkgfHwgJycgKTtcblx0fSApO1xuXG5cdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICdbZGF0YS13cGJjLWFkZC1hcHBvaW50bWVudC1hdXRvZmlsbF0nLCBhdXRvX2ZpbGxfYm9va2luZ19mb3JtICk7XG5cdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2Ugd3BiY19ib29raW5nX2RhdGVfb3Jfb3B0aW9uX3NlbGVjdGVkJywgJy53cGJjX2FkZF9hcHBvaW50bWVudF9fY2FudmFzLCAjaXNfc2VuZF9lbWFpbF9mb3JfcGVuZGluZycsIHNjaGVkdWxlX3N1bW1hcnlfcmVmcmVzaCApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQnLCAnI3dwYmNfYWRkX2FwcG9pbnRtZW50X2Nvc3RfY29ycmVjdGlvbicsIHN5bmNocm9uaXplX2Nvc3RfY29ycmVjdGlvbl9yYW5nZSApO1xuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQnLCAnLndwYmNfYWRkX2FwcG9pbnRtZW50X19jb3N0X2NvcnJlY3Rpb24gW2RhdGEtd3BiYy1hZG1pbi1jb3N0LWNvcnJlY3Rpb24tcmFuZ2U9XCIxXCJdJywgc3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX251bWJlciApO1xuXHQkKCAnYm9keScgKS5vbiggJ3dwYmNfYmVmb3JlX2Jvb2tpbmdfY3JlYXRlLndwYmNfYWRkX2FwcG9pbnRtZW50X2Nvc3RfY29ycmVjdGlvbicsIGFkZF9jb3N0X2NvcnJlY3Rpb25fdG9fYXBwb2ludG1lbnRfcmVxdWVzdCApO1xuXHQkKCAnYm9keScgKS5vbiggJ3dwYmNfYm9va2luZ19mb3JtX3N1Ym1pdF9zdWNjZXNzLndwYmNfYWRkX2FwcG9pbnRtZW50X2Nvc3RfY29ycmVjdGlvbicsIGNsZWFyX2Nvc3RfY29ycmVjdGlvbiApO1xuXG5cdCQoIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgc3RhZ2UgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYWRkX2FwcG9pbnRtZW50X19jYW52YXMgLndwYmNfYm9va2luZ19hcHBvaW50bWVudF9fc3RhZ2UnICk7XG5cdFx0YXBwbHlfYm9va2luZ19jb250ZXh0KCk7XG5cdFx0cmVmcmVzaF9zdW1tYXJ5KCk7XG5cdFx0c3luY2hyb25pemVfY29zdF9jb3JyZWN0aW9uX3JhbmdlKCk7XG5cdFx0aWYgKCBzdGFnZSAmJiB3aW5kb3cuTXV0YXRpb25PYnNlcnZlciApIHtcblx0XHRcdG5ldyBNdXRhdGlvbk9ic2VydmVyKCBzY2hlZHVsZV9zdW1tYXJ5X3JlZnJlc2ggKS5vYnNlcnZlKCBzdGFnZSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xuXHRcdH1cblx0fSApO1xufSApKCBqUXVlcnkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLENBQUUsVUFBV0EsQ0FBQyxFQUFHO0VBQ2hCLFlBQVk7O0VBRVosSUFBSUMsYUFBYSxHQUFHLENBQUM7RUFDckIsSUFBSUMsTUFBTSxHQUFHQyxNQUFNLENBQUNDLGdDQUFnQyxJQUFJLENBQUMsQ0FBQzs7RUFFMUQ7RUFDQSxTQUFTQyxxQkFBcUJBLENBQUEsRUFBRztJQUNoQyxJQUFLLFdBQVcsS0FBSyxPQUFPRixNQUFNLENBQUNHLEtBQUssRUFBRztNQUMxQztJQUNEO0lBRUFILE1BQU0sQ0FBQ0csS0FBSyxDQUFDQyxlQUFlLENBQUUsd0JBQXdCLEVBQUUsRUFBRyxDQUFDO0lBQzVESixNQUFNLENBQUNHLEtBQUssQ0FBQ0MsZUFBZSxDQUFFLHNCQUFzQixFQUFFTCxNQUFNLENBQUNNLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDO0lBQ2hGTCxNQUFNLENBQUNHLEtBQUssQ0FBQ0MsZUFBZSxDQUFFLDBCQUEwQixFQUFFTCxNQUFNLENBQUNPLGdCQUFnQixJQUFJLEVB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QUVaLHFCQUFzQixDQUFDO0VBRS9IdkcsQ0FBQyxDQUFFNkcsUUFBUyxDQUFDLENBQUNNLEVBQUUsQ0FBRSxPQUFPLEVBQUUsd0NBQXdDLEVBQUUsVUFBV1YsS0FBSyxFQUFHO0lBQ3ZGQSxLQUFLLENBQUNXLGNBQWMsQ0FBQyxDQUFDO0lBQ3RCM0Usb0JBQW9CLENBQUV6QyxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNlLElBQUksQ0FBRSxzQ0FBdUMsQ0FBQyxFQUFFZixDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNlLElBQUksQ0FBRSxpQ0FBa0MsQ0FBQyxJQUFJLEVBQUcsQ0FBQztFQUM1SSxDQUFFLENBQUM7RUFFSGYsQ0FBQyxDQUFFNkcsUUFBUyxDQUFDLENBQUNNLEVBQUUsQ0FBRSxPQUFPLEVBQUUsc0NBQXNDLEVBQUUxQixzQkFBdUIsQ0FBQztFQUMzRnpGLENBQUMsQ0FBRTZHLFFBQVMsQ0FBQyxDQUFDTSxFQUFFLENBQUUsbURBQW1ELEVBQUUsMkRBQTJELEVBQUU1Qix3QkFBeUIsQ0FBQztFQUM5SnZGLENBQUMsQ0FBRTZHLFFBQVMsQ0FBQyxDQUFDTSxFQUFFLENBQUUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFbkIsaUNBQWtDLENBQUM7RUFDdkdoRyxDQUFDLENBQUU2RyxRQUFTLENBQUMsQ0FBQ00sRUFBRSxDQUFFLE9BQU8sRUFBRSxvRkFBb0YsRUFBRWIsa0NBQW1DLENBQUM7RUFDckp0RyxDQUFDLENBQUUsTUFBTyxDQUFDLENBQUNtSCxFQUFFLENBQUUsaUVBQWlFLEVBQUVYLDBDQUEyQyxDQUFDO0VBQy9IeEcsQ0FBQyxDQUFFLE1BQU8sQ0FBQyxDQUFDbUgsRUFBRSxDQUFFLHVFQUF1RSxFQUFFWixxQkFBc0IsQ0FBQztFQUVoSHZHLENBQUMsQ0FBRSxZQUFZO0lBQ2QsSUFBSThFLEtBQUssR0FBRytCLFFBQVEsQ0FBQ1MsYUFBYSxDQUFFLGdFQUFpRSxDQUFDO0lBQ3RHakgscUJBQXFCLENBQUMsQ0FBQztJQUN2Qm1FLGVBQWUsQ0FBQyxDQUFDO0lBQ2pCd0IsaUNBQWlDLENBQUMsQ0FBQztJQUNuQyxJQUFLbEIsS0FBSyxJQUFJM0UsTUFBTSxDQUFDb0gsZ0JBQWdCLEVBQUc7TUFDdkMsSUFBSUEsZ0JBQWdCLENBQUVoQyx3QkFBeUIsQ0FBQyxDQUFDaUMsT0FBTyxDQUFFMUMsS0FBSyxFQUFFO1FBQUUyQyxTQUFTLEVBQUUsSUFBSTtRQUFFQyxPQUFPLEVBQUU7TUFBSyxDQUFFLENBQUM7SUFDdEc7RUFDRCxDQUFFLENBQUM7QUFDSixDQUFDLEVBQUlDLE1BQU8sQ0FBQyIsImlnbm9yZUxpc3QiOltdfQ==
