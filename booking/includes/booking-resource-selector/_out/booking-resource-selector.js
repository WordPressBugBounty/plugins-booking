"use strict";

(function (window, $) {
  'use strict';

  var config = window.wpbc_booking_resource_selector_config || {};
  var active_native_contexts = {};
  var loaded_script_urls = {};
  $('script[src]').each(function () {
    loaded_script_urls[String(this.src || '')] = true;
  });

  /** Return a normalized Booking Resource ID from a selection form. */
  function get_selected_resource_id($form) {
    return Number($form.find('[name="wpbc_resource_selector_resource"]:checked').first().val() || 0);
  }

  /**
   * Apply the public text search for one Resource catalog.
   *
   * Filtering only hides cards already authorized and rendered by the server;
   * it cannot add Resource IDs to the signed selection context.
   *
   * @param {jQuery} $catalog Resource catalog root.
   * @return {void}
   */
  function filter_resource_catalog($catalog) {
    var search_term = String($catalog.find('[data-wpbc-resource-catalog-search]').val() || '').toLocaleLowerCase().trim();
    var visible_count = 0;
    $catalog.find('[data-resource-id]').each(function () {
      var $card = $(this);
      var searchable_text = String($card.attr('data-resource-search') || '').toLocaleLowerCase();
      var is_visible = !search_term || searchable_text.indexOf(search_term) !== -1;
      var $resource_input = $card.find('[name="wpbc_resource_selector_resource"]');
      $card.prop('hidden', !is_visible);
      $resource_input.prop('disabled', !is_visible);
      if (is_visible) {
        visible_count += 1;
      } else if ($resource_input.prop('checked')) {
        $resource_input.prop('checked', false);
        $card.removeClass('is-selected');
      }
    });
    $catalog.find('[data-wpbc-resource-catalog-empty]').prop('hidden', 0 !== visible_count);
    $catalog.find('[data-wpbc-resource-catalog-status]').text(String(visible_count) + ' ' + (1 === visible_count ? config.resource_found || 'Booking Resource found.' : config.resources_found || 'Booking Resources found.'));
  }

  /** Toggle one selector loading state without clearing its current stage. */
  function set_loading($root, is_loading) {
    $root.toggleClass('is-loading', is_loading).attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_resource_selector__stage').attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_resource_selector__loading').prop('hidden', !is_loading).attr('aria-hidden', is_loading ? 'false' : 'true');
    $root.find('.wpbc_booking_resource_selector__selection_form :input').prop('disabled', is_loading);
    if (!is_loading) {
      $root.find('[data-wpbc-resource-catalog]').each(function () {
        filter_resource_catalog($(this));
      });
    }
  }

  /** Display and focus one controlled AJAX or initialization error. */
  function show_error($root, message) {
    var $notice = $root.find('> .wpbc_booking_resource_selector__ajax_notice');
    $notice.empty().append($('<span>').text(message || config.error || 'Unable to load the booking form.')).prop('hidden', false);
    if ($notice.get(0) && typeof $notice.get(0).focus === 'function') {
      $notice.trigger('focus');
    }
  }

  /** Clear the selector AJAX error. */
  function clear_error($root) {
    $root.find('> .wpbc_booking_resource_selector__ajax_notice').empty().prop('hidden', true);
  }

  /** Return a registered context only while its native form remains live. */
  function get_native_context(resource_id) {
    resource_id = Number(resource_id || 0);
    var context = active_native_contexts[resource_id];
    if (!context || !context.element || !document.documentElement.contains(context.element)) {
      delete active_native_contexts[resource_id];
      return null;
    }
    return context;
  }

  /** Detect any other live native Booking Calendar form for the same resource. */
  function has_duplicate_resource_form($root, resource_id) {
    resource_id = Number(resource_id || 0);
    if (!resource_id) {
      return false;
    }
    var context = get_native_context(resource_id);
    if (context && !$.contains($root.get(0), context.element)) {
      return true;
    }
    return $('[id="booking_form' + resource_id + '"]').filter(function () {
      return !$.contains($root.get(0), this);
    }).length > 0;
  }

  /** Register the signed resource context used by final booking submission. */
  function register_native_form($native) {
    var resource_id = Number($native.data('resource-id') || 0);
    var context_token = String($native.attr('data-resource-selector-context-token') || '');
    var allow_past = '1' === String($native.attr('data-allow-past') || '0') ? 1 : 0;
    var existing = get_native_context(resource_id);
    if (!resource_id || !context_token) {
      return false;
    }
    if (existing && existing.element !== $native.get(0)) {
      return false;
    }
    active_native_contexts[resource_id] = {
      element: $native.get(0),
      resource_id: resource_id,
      context_token: context_token,
      allow_past: allow_past
    };
    return true;
  }

  /** Remove one native form from the local submission registry. */
  function unregister_native_form($native) {
    var resource_id = Number($native.data('resource-id') || 0);
    var context = get_native_context(resource_id);
    if (context && context.element === $native.get(0)) {
      delete active_native_contexts[resource_id];
    }
  }

  /** Prepare a newly inserted native form for resource-bound submission. */
  function prepare_native_form($scope) {
    var $native = $scope.find('.wpbc_booking_resource_selector__native_form').first();
    if (!$native.length) {
      return true;
    }
    return register_native_form($native);
  }

  /** Convert a script URL to the same absolute form used by script elements. */
  function get_absolute_script_url(url) {
    var anchor = document.createElement('a');
    anchor.href = String(url || '');
    return anchor.href;
  }

  /** Return a rejected promise carrying one controlled message. */
  function rejected_stage(message) {
    var deferred = $.Deferred();
    deferred.reject({
      wpbc_message: message
    });
    return deferred.promise();
  }

  /** Execute renderer scripts sequentially while the request owns the stage. */
  function execute_scripts(scripts, owns_stage) {
    var sequence = $.Deferred().resolve().promise();
    $.each(scripts, function (index, script) {
      sequence = sequence.then(function () {
        if (!owns_stage()) {
          return rejected_stage('');
        }
        if (script.src) {
          var absolute_url = get_absolute_script_url(script.src);
          if (loaded_script_urls[absolute_url]) {
            return undefined;
          }
          return $.ajax({
            url: absolute_url,
            dataType: 'script',
            cache: true
          }).then(function () {
            loaded_script_urls[absolute_url] = true;
          });
        }
        if (script.code) {
          $.globalEval(script.code);
        }
        return undefined;
      });
    });
    return sequence;
  }

  /** Initialize native controls whose core handlers bind on document ready. */
  function initialize_ajax_form_controls() {
    if (typeof window.wpbc_hook__init_booking_form_wizard_buttons === 'function') {
      window.wpbc_hook__init_booking_form_wizard_buttons();
    }
  }

  /** Destroy native calendars and unregister context before stage removal. */
  function cleanup_native_form($root) {
    $root.find('.wpbc_booking_resource_selector__native_form').each(function () {
      var $native = $(this);
      var resource_id = Number($native.data('resource-id') || 0);
      var $calendar = $native.find('#calendar_booking' + resource_id);
      unregister_native_form($native);
      if (!resource_id || !$calendar.length || !$.datepick || typeof $calendar.datepick !== 'function') {
        return;
      }
      try {
        var instance = typeof $.datepick._getInst === 'function' ? $.datepick._getInst($calendar.get(0)) : null;
        if (instance) {
          $calendar.datepick('destroy');
        }
      } catch (error) {
        $calendar.removeClass('hasDatepick');
      }
    });
  }

  /** Restore the configured initial Resource choice after Start over. */
  function restore_resource_selection($root) {
    var resource_id = Number($root.attr('data-selected-resource-id') || 0);
    if (!resource_id) {
      return;
    }
    var $input = $root.find('[name="wpbc_resource_selector_resource"][value="' + resource_id + '"]').first();
    if ($input.length) {
      $input.closest('.wpbc_booking_resource_selector__choices').find('.wpbc_booking_resource_selector__choice').removeClass('is-selected');
      $input.prop('checked', true).closest('.wpbc_booking_resource_selector__choice').addClass('is-selected');
    }
  }

  /** Focus the new stage heading and keep the component near the viewport. */
  function focus_stage($root) {
    var $target = $root.find('> .wpbc_booking_resource_selector__stage .wpbc_booking_resource_selector__heading h3, > .wpbc_booking_resource_selector__stage .wpbc_booking_resource_selector__notice').first();
    if ($target.length) {
      $target.attr('tabindex', '-1');
      try {
        $target.get(0).focus({
          preventScroll: true
        });
      } catch (error) {
        $target.trigger('focus');
      }
    }
    if ($root.get(0) && typeof $root.get(0).scrollIntoView === 'function') {
      var reduce_motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      $root.get(0).scrollIntoView({
        behavior: reduce_motion ? 'auto' : 'smooth',
        block: 'nearest'
      });
    }
  }

  /** Determine whether an AJAX callback still owns the component state. */
  function is_current_request($root, request_id) {
    return Number($root.data('wpbc-resource-selector-request-id') || 0) === Number(request_id);
  }

  /** Finish only the current request so stale callbacks cannot alter the UI. */
  function finish_request($root, request_id) {
    if (!is_current_request($root, request_id)) {
      return;
    }
    $root.removeData('wpbc-resource-selector-request');
    set_loading($root, false);
  }

  /** Replace a complete stage with DOM-before-script initialization ordering. */
  function replace_stage($root, html, stage, resource_id, request_id) {
    if (!is_current_request($root, request_id)) {
      return rejected_stage('');
    }
    if ('booking' === stage && has_duplicate_resource_form($root, resource_id)) {
      return rejected_stage(config.duplicate_resource);
    }
    var parsed = $.parseHTML(String(html || ''), document, true) || [];
    var scripts = [];
    var $container = $('<div>').append(parsed);
    $container.find('script').addBack('script').each(function () {
      scripts.push({
        src: this.src || '',
        code: this.src ? '' : this.text || this.textContent || ''
      });
      $(this).remove();
    });
    cleanup_native_form($root);
    $root.attr('data-resource-selector-stage', stage);
    $root.find('> .wpbc_booking_resource_selector__stage').empty().append($container.contents());
    if (!prepare_native_form($root)) {
      cleanup_native_form($root);
      $root.find('.wpbc_booking_resource_selector__native_form :input').prop('disabled', true);
      return rejected_stage(config.initialization_error || config.error);
    }
    return execute_scripts(scripts, function () {
      return is_current_request($root, request_id);
    }).then(function () {
      if (!is_current_request($root, request_id)) {
        return rejected_stage('');
      }
      initialize_ajax_form_controls();
      if ('resource' === stage) {
        restore_resource_selection($root);
      }
    });
  }

  /** Request and render the next Booking Resource selector stage. */
  function resolve_stage($root, resource_id) {
    if (!$root || !$root.length) {
      return;
    }
    resource_id = Number(resource_id || 0);
    if (resource_id) {
      $root.attr('data-selected-resource-id', resource_id);
    }
    var previous_request = $root.data('wpbc-resource-selector-request');
    var request_id = Number($root.data('wpbc-resource-selector-request-id') || 0) + 1;
    $root.data('wpbc-resource-selector-request-id', request_id);
    if (previous_request && previous_request.readyState !== 4) {
      previous_request.abort();
    }
    clear_error($root);
    set_loading($root, true);
    var request = $.post(config.ajax_url, {
      action: config.action,
      nonce: config.nonce,
      config_token: $root.attr('data-config-token') || '',
      resource_id: resource_id
    });
    $root.data('wpbc-resource-selector-request', request);
    request.done(function (response) {
      if (!is_current_request($root, request_id)) {
        return;
      }
      if (!response || !response.success || !response.data) {
        show_error($root, response && response.data && response.data.message ? response.data.message : config.error);
        finish_request($root, request_id);
        return;
      }
      var stage = response.data.stage || '';
      var replacement = replace_stage($root, response.data.html, stage, response.data.resource_id, request_id);
      replacement.done(function () {
        if (!is_current_request($root, request_id)) {
          return;
        }
        if (Number(response.data.resource_id || 0)) {
          $root.attr('data-selected-resource-id', Number(response.data.resource_id));
        }
        finish_request($root, request_id);
        focus_stage($root);
      }).fail(function (error) {
        if (!is_current_request($root, request_id)) {
          return;
        }
        show_error($root, error && error.wpbc_message ? error.wpbc_message : config.initialization_error || config.error);
        finish_request($root, request_id);
      });
    }).fail(function (xhr, status) {
      if ('abort' === status || !is_current_request($root, request_id)) {
        return;
      }
      var response = xhr.responseJSON;
      show_error($root, response && response.data && response.data.message ? response.data.message : config.error);
      finish_request($root, request_id);
    });
  }

  /** Resolve the selected Booking Resource through AJAX. */
  $(document).on('submit', '.wpbc_booking_resource_selector__selection_form', function (event) {
    if (!config.ajax_url || !config.action) {
      return;
    }
    event.preventDefault();
    var $form = $(this);
    resolve_stage($form.closest('.wpbc_booking_resource_selector'), get_selected_resource_id($form));
  });

  /** Keep selected card styling independent from CSS :has() support. */
  $(document).on('change', '.wpbc_booking_resource_selector__choice > input', function () {
    var $input = $(this);
    $input.closest('.wpbc_booking_resource_selector__choices').find('.wpbc_booking_resource_selector__choice').removeClass('is-selected');
    $input.closest('.wpbc_booking_resource_selector__choice').addClass('is-selected');
  });

  /** Filter cards without changing the server-authorized Resource set. */
  $(document).on('input', '.wpbc_booking_resource_catalog [data-wpbc-resource-catalog-search]', function () {
    filter_resource_catalog($(this).closest('[data-wpbc-resource-catalog]'));
  });

  /** Return to Resource selection without reloading the public page. */
  $(document).on('click', '.wpbc_booking_resource_selector [data-wpbc-resource-selector-action="start-over"]', function (event) {
    if (!config.ajax_url || !config.action) {
      return;
    }
    event.preventDefault();
    var $root = $(this).closest('.wpbc_booking_resource_selector');
    if ($root.hasClass('is-loading')) {
      return;
    }
    resolve_stage($root, 0);
  });

  /** Add the signed resource context to the core booking-create request. */
  $('body').on('wpbc_before_booking_create.wpbc_booking_resource_selector', function (event, resource_id, params) {
    var context = get_native_context(resource_id);
    if (!context || !params) {
      return;
    }
    params.resource_selector_required = 1;
    params.resource_selector_context_token = context.context_token;
    params.allow_past = context.allow_past;
  });
  $(function () {
    $('.wpbc_booking_resource_selector').each(function () {
      var $root = $(this);
      var $native = $root.find('.wpbc_booking_resource_selector__native_form').first();
      if ($native.length) {
        $root.attr('data-selected-resource-id', Number($native.data('resource-id') || 0));
      }
      var duplicate = $native.length && has_duplicate_resource_form($root, Number($native.data('resource-id') || 0));
      if (duplicate || !prepare_native_form($root)) {
        cleanup_native_form($root);
        $root.find('.wpbc_booking_resource_selector__native_form :input').prop('disabled', true);
        show_error($root, duplicate ? config.duplicate_resource : config.initialization_error);
      }
    });
  });
})(window, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1yZXNvdXJjZS1zZWxlY3Rvci9fb3V0L2Jvb2tpbmctcmVzb3VyY2Utc2VsZWN0b3IuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCIkIiwiY29uZmlnIiwid3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX2NvbmZpZyIsImFjdGl2ZV9uYXRpdmVfY29udGV4dHMiLCJsb2FkZWRfc2NyaXB0X3VybHMiLCJlYWNoIiwiU3RyaW5nIiwic3JjIiwiZ2V0X3NlbGVjdGVkX3Jlc291cmNlX2lkIiwiJGZvcm0iLCJOdW1iZXIiLCJmaW5kIiwiZmlyc3QiLCJ2YWwiLCJmaWx0ZXJfcmVzb3VyY2VfY2F0YWxvZyIsIiRjYXRhbG9nIiwic2VhcmNoX3Rlcm0iLCJ0b0xvY2FsZUxvd2VyQ2FzZSIsInRyaW0iLCJ2aXNpYmxlX2NvdW50IiwiJGNhcmQiLCJzZWFyY2hhYmxlX3RleHQiLCJhdHRyIiwiaXNfdmlzaWJsZSIsImluZGV4T2YiLCIkcmVzb3VyY2VfaW5wdXQiLCJwcm9wIiwicmVtb3ZlQ2xhc3MiLCJ0ZXh0IiwicmVzb3VyY2VfZm91bmQiLCJyZXNvdXJjZXNfZm91bmQiLCJzZXRfbG9hZGluZyIsIiRyb290IiwiaXNfbG9hZGluZyIsInRvZ2dsZUNsYXNzIiwic2hvd19lcnJvciIsIm1lc3NhZ2UiLCIkbm90aWNlIiwiZW1wdHkiLCJhcHBlbmQiLCJlcnJvciIsImdldCIsImZvY3VzIiwidHJpZ2dlciIsImNsZWFyX2Vycm9yIiwiZ2V0X25hdGl2ZV9jb250ZXh0IiwicmVzb3VyY2VfaWQiLCJjb250ZXh0IiwiZWxlbWVudCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50IiwiY29udGFpbnMiLCJoYXNfZHVwbGljYXRlX3Jlc291cmNlX2Zvcm0iLCJmaWx0ZXIiLCJsZW5ndGgiLCJyZWdpc3Rlcl9uYXRpdmVfZm9ybSIsIiRuYXRpdmUiLCJkYXRhIiwiY29udGV4dF90b2tlbiIsImFsbG93X3Bhc3QiLCJleGlzdGluZyIsInVucmVnaXN0ZXJfbmF0aXZlX2Zvcm0iLCJwcmVwYXJlX25hdGl2ZV9mb3JtIiwiJHNjb3BlIiwiZ2V0X2Fic29sdXRlX3NjcmlwdF91cmwiLCJ1cmwiLCJhbmNob3IiLCJjcmVhdGVFbGVtZW50IiwiaHJlZiIsInJlamVjdGVkX3N0YWdlIiwiZGVmZXJyZWQiLCJEZWZlcnJlZCIsInJlamVjdCIsIndwYmNfbWVzc2FnZSIsInByb21pc2UiLCJleGVjdXRlX3NjcmlwdHMiLCJzY3JpcHRzIiwib3duc19zdGFnZSIsInNlcXVlbmNlIiwicmVzb2x2ZSIsImluZGV4Iiwic2NyaXB0IiwidGhlbiIsImFic29sdXRlX3VybCIsInVuZGVmaW5lZCIsImFqYXgiLCJkYXRhVHlwZSIsImNhY2hlIiwiY29kZSIsImdsb2JhbEV2YWwiLCJpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scyIsIndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMiLCJjbGVhbnVwX25hdGl2ZV9mb3JtIiwiJGNhbGVuZGFyIiwiZGF0ZXBpY2siLCJpbnN0YW5jZSIsIl9nZXRJbnN0IiwicmVzdG9yZV9yZXNvdXJjZV9zZWxlY3Rpb24iLCIkaW5wdXQiLCJjbG9zZXN0IiwiYWRkQ2xhc3MiLCJmb2N1c19zdGFnZSIsIiR0YXJnZXQiLCJwcmV2ZW50U2Nyb2xsIiwic2Nyb2xsSW50b1ZpZXciLCJyZWR1Y2VfbW90aW9uIiwibWF0Y2hNZWRpYSIsIm1hdGNoZXMiLCJiZWhhdmlvciIsImJsb2NrIiwiaXNfY3VycmVudF9yZXF1ZXN0IiwicmVxdWVzdF9pZCIsImZpbmlzaF9yZXF1ZXN0IiwicmVtb3ZlRGF0YSIsInJlcGxhY2Vfc3RhZ2UiLCJodG1sIiwic3RhZ2UiLCJkdXBsaWNhdGVfcmVzb3VyY2UiLCJwYXJzZWQiLCJwYXJzZUhUTUwiLCIkY29udGFpbmVyIiwiYWRkQmFjayIsInB1c2giLCJ0ZXh0Q29udGVudCIsInJlbW92ZSIsImNvbnRlbnRzIiwiaW5pdGlhbGl6YXRpb25fZXJyb3IiLCJyZXNvbHZlX3N0YWdlIiwicHJldmlvdXNfcmVxdWVzdCIsInJlYWR5U3RhdGUiLCJhYm9ydCIsInJlcXVlc3QiLCJwb3N0IiwiYWpheF91cmwiLCJhY3Rpb24iLCJub25jZSIsImNvbmZpZ190b2tlbiIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJyZXBsYWNlbWVudCIsImZhaWwiLCJ4aHIiLCJzdGF0dXMiLCJyZXNwb25zZUpTT04iLCJvbiIsImV2ZW50IiwicHJldmVudERlZmF1bHQiLCJoYXNDbGFzcyIsInBhcmFtcyIsInJlc291cmNlX3NlbGVjdG9yX3JlcXVpcmVkIiwicmVzb3VyY2Vfc2VsZWN0b3JfY29udGV4dF90b2tlbiIsImR1cGxpY2F0ZSIsImpRdWVyeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL2Jvb2tpbmctcmVzb3VyY2Utc2VsZWN0b3IvX3NyYy9ib29raW5nLXJlc291cmNlLXNlbGVjdG9yLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIiggZnVuY3Rpb24gKCB3aW5kb3csICQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgY29uZmlnID0gd2luZG93LndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9jb25maWcgfHwge307XG5cdHZhciBhY3RpdmVfbmF0aXZlX2NvbnRleHRzID0ge307XG5cdHZhciBsb2FkZWRfc2NyaXB0X3VybHMgPSB7fTtcblxuXHQkKCAnc2NyaXB0W3NyY10nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdGxvYWRlZF9zY3JpcHRfdXJsc1sgU3RyaW5nKCB0aGlzLnNyYyB8fCAnJyApIF0gPSB0cnVlO1xuXHR9ICk7XG5cblx0LyoqIFJldHVybiBhIG5vcm1hbGl6ZWQgQm9va2luZyBSZXNvdXJjZSBJRCBmcm9tIGEgc2VsZWN0aW9uIGZvcm0uICovXG5cdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZCggJGZvcm0gKSB7XG5cdFx0cmV0dXJuIE51bWJlciggJGZvcm0uZmluZCggJ1tuYW1lPVwid3BiY19yZXNvdXJjZV9zZWxlY3Rvcl9yZXNvdXJjZVwiXTpjaGVja2VkJyApLmZpcnN0KCkudmFsKCkgfHwgMCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFwcGx5IHRoZSBwdWJsaWMgdGV4dCBzZWFyY2ggZm9yIG9uZSBSZXNvdXJjZSBjYXRhbG9nLlxuXHQgKlxuXHQgKiBGaWx0ZXJpbmcgb25seSBoaWRlcyBjYXJkcyBhbHJlYWR5IGF1dGhvcml6ZWQgYW5kIHJlbmRlcmVkIGJ5IHRoZSBzZXJ2ZXI7XG5cdCAqIGl0IGNhbm5vdCBhZGQgUmVzb3VyY2UgSURzIHRvIHRoZSBzaWduZWQgc2VsZWN0aW9uIGNvbnRleHQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkY2F0YWxvZyBSZXNvdXJjZSBjYXRhbG9nIHJvb3QuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBmaWx0ZXJfcmVzb3VyY2VfY2F0YWxvZyggJGNhdGFsb2cgKSB7XG5cdFx0dmFyIHNlYXJjaF90ZXJtID0gU3RyaW5nKCAkY2F0YWxvZy5maW5kKCAnW2RhdGEtd3BiYy1yZXNvdXJjZS1jYXRhbG9nLXNlYXJjaF0nICkudmFsKCkgfHwgJycgKS50b0xvY2FsZUxvd2VyQ2FzZSgpLnRyaW0oKTtcblx0XHR2YXIgdmlzaWJsZV9jb3VudCA9IDA7XG5cblx0XHQkY2F0YWxvZy5maW5kKCAnW2RhdGEtcmVzb3VyY2UtaWRdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciAkY2FyZCA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciBzZWFyY2hhYmxlX3RleHQgPSBTdHJpbmcoICRjYXJkLmF0dHIoICdkYXRhLXJlc291cmNlLXNlYXJjaCcgKSB8fCAnJyApLnRvTG9jYWxlTG93ZXJDYXNlKCk7XG5cdFx0XHR2YXIgaXNfdmlzaWJsZSA9ICEgc2VhcmNoX3Rlcm0gfHwgc2VhcmNoYWJsZV90ZXh0LmluZGV4T2YoIHNlYXJjaF90ZXJtICkgIT09IC0xO1xuXHRcdFx0dmFyICRyZXNvdXJjZV9pbnB1dCA9ICRjYXJkLmZpbmQoICdbbmFtZT1cIndwYmNfcmVzb3VyY2Vfc2VsZWN0b3JfcmVzb3VyY2VcIl0nICk7XG5cblx0XHRcdCRjYXJkLnByb3AoICdoaWRkZW4nLCAhIGlzX3Zpc2libGUgKTtcblx0XHRcdCRyZXNvdXJjZV9pbnB1dC5wcm9wKCAnZGlzYWJsZWQnLCAhIGlzX3Zpc2libGUgKTtcblx0XHRcdGlmICggaXNfdmlzaWJsZSApIHtcblx0XHRcdFx0dmlzaWJsZV9jb3VudCArPSAxO1xuXHRcdFx0fSBlbHNlIGlmICggJHJlc291cmNlX2lucHV0LnByb3AoICdjaGVja2VkJyApICkge1xuXHRcdFx0XHQkcmVzb3VyY2VfaW5wdXQucHJvcCggJ2NoZWNrZWQnLCBmYWxzZSApO1xuXHRcdFx0XHQkY2FyZC5yZW1vdmVDbGFzcyggJ2lzLXNlbGVjdGVkJyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdCRjYXRhbG9nLmZpbmQoICdbZGF0YS13cGJjLXJlc291cmNlLWNhdGFsb2ctZW1wdHldJyApLnByb3AoICdoaWRkZW4nLCAwICE9PSB2aXNpYmxlX2NvdW50ICk7XG5cdFx0JGNhdGFsb2cuZmluZCggJ1tkYXRhLXdwYmMtcmVzb3VyY2UtY2F0YWxvZy1zdGF0dXNdJyApLnRleHQoXG5cdFx0XHRTdHJpbmcoIHZpc2libGVfY291bnQgKSArICcgJyArICggMSA9PT0gdmlzaWJsZV9jb3VudCA/ICggY29uZmlnLnJlc291cmNlX2ZvdW5kIHx8ICdCb29raW5nIFJlc291cmNlIGZvdW5kLicgKSA6ICggY29uZmlnLnJlc291cmNlc19mb3VuZCB8fCAnQm9va2luZyBSZXNvdXJjZXMgZm91bmQuJyApIClcblx0XHQpO1xuXHR9XG5cblx0LyoqIFRvZ2dsZSBvbmUgc2VsZWN0b3IgbG9hZGluZyBzdGF0ZSB3aXRob3V0IGNsZWFyaW5nIGl0cyBjdXJyZW50IHN0YWdlLiAqL1xuXHRmdW5jdGlvbiBzZXRfbG9hZGluZyggJHJvb3QsIGlzX2xvYWRpbmcgKSB7XG5cdFx0JHJvb3QudG9nZ2xlQ2xhc3MoICdpcy1sb2FkaW5nJywgaXNfbG9hZGluZyApLmF0dHIoICdhcmlhLWJ1c3knLCBpc19sb2FkaW5nID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX3N0YWdlJyApLmF0dHIoICdhcmlhLWJ1c3knLCBpc19sb2FkaW5nID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2xvYWRpbmcnICkucHJvcCggJ2hpZGRlbicsICEgaXNfbG9hZGluZyApLmF0dHIoICdhcmlhLWhpZGRlbicsIGlzX2xvYWRpbmcgPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0JHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX3NlbGVjdGlvbl9mb3JtIDppbnB1dCcgKS5wcm9wKCAnZGlzYWJsZWQnLCBpc19sb2FkaW5nICk7XG5cdFx0aWYgKCAhIGlzX2xvYWRpbmcgKSB7XG5cdFx0XHQkcm9vdC5maW5kKCAnW2RhdGEtd3BiYy1yZXNvdXJjZS1jYXRhbG9nXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGZpbHRlcl9yZXNvdXJjZV9jYXRhbG9nKCAkKCB0aGlzICkgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRGlzcGxheSBhbmQgZm9jdXMgb25lIGNvbnRyb2xsZWQgQUpBWCBvciBpbml0aWFsaXphdGlvbiBlcnJvci4gKi9cblx0ZnVuY3Rpb24gc2hvd19lcnJvciggJHJvb3QsIG1lc3NhZ2UgKSB7XG5cdFx0dmFyICRub3RpY2UgPSAkcm9vdC5maW5kKCAnPiAud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19hamF4X25vdGljZScgKTtcblx0XHQkbm90aWNlLmVtcHR5KCkuYXBwZW5kKCAkKCAnPHNwYW4+JyApLnRleHQoIG1lc3NhZ2UgfHwgY29uZmlnLmVycm9yIHx8ICdVbmFibGUgdG8gbG9hZCB0aGUgYm9va2luZyBmb3JtLicgKSApLnByb3AoICdoaWRkZW4nLCBmYWxzZSApO1xuXHRcdGlmICggJG5vdGljZS5nZXQoIDAgKSAmJiB0eXBlb2YgJG5vdGljZS5nZXQoIDAgKS5mb2N1cyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdCRub3RpY2UudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBDbGVhciB0aGUgc2VsZWN0b3IgQUpBWCBlcnJvci4gKi9cblx0ZnVuY3Rpb24gY2xlYXJfZXJyb3IoICRyb290ICkge1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2FqYXhfbm90aWNlJyApLmVtcHR5KCkucHJvcCggJ2hpZGRlbicsIHRydWUgKTtcblx0fVxuXG5cdC8qKiBSZXR1cm4gYSByZWdpc3RlcmVkIGNvbnRleHQgb25seSB3aGlsZSBpdHMgbmF0aXZlIGZvcm0gcmVtYWlucyBsaXZlLiAqL1xuXHRmdW5jdGlvbiBnZXRfbmF0aXZlX2NvbnRleHQoIHJlc291cmNlX2lkICkge1xuXHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZV9pZCB8fCAwICk7XG5cdFx0dmFyIGNvbnRleHQgPSBhY3RpdmVfbmF0aXZlX2NvbnRleHRzWyByZXNvdXJjZV9pZCBdO1xuXHRcdGlmICggISBjb250ZXh0IHx8ICEgY29udGV4dC5lbGVtZW50IHx8ICEgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNvbnRhaW5zKCBjb250ZXh0LmVsZW1lbnQgKSApIHtcblx0XHRcdGRlbGV0ZSBhY3RpdmVfbmF0aXZlX2NvbnRleHRzWyByZXNvdXJjZV9pZCBdO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBjb250ZXh0O1xuXHR9XG5cblx0LyoqIERldGVjdCBhbnkgb3RoZXIgbGl2ZSBuYXRpdmUgQm9va2luZyBDYWxlbmRhciBmb3JtIGZvciB0aGUgc2FtZSByZXNvdXJjZS4gKi9cblx0ZnVuY3Rpb24gaGFzX2R1cGxpY2F0ZV9yZXNvdXJjZV9mb3JtKCAkcm9vdCwgcmVzb3VyY2VfaWQgKSB7XG5cdFx0cmVzb3VyY2VfaWQgPSBOdW1iZXIoIHJlc291cmNlX2lkIHx8IDAgKTtcblx0XHRpZiAoICEgcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0aWYgKCBjb250ZXh0ICYmICEgJC5jb250YWlucyggJHJvb3QuZ2V0KCAwICksIGNvbnRleHQuZWxlbWVudCApICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICQoICdbaWQ9XCJib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLmZpbHRlciggZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuICEgJC5jb250YWlucyggJHJvb3QuZ2V0KCAwICksIHRoaXMgKTtcblx0XHR9ICkubGVuZ3RoID4gMDtcblx0fVxuXG5cdC8qKiBSZWdpc3RlciB0aGUgc2lnbmVkIHJlc291cmNlIGNvbnRleHQgdXNlZCBieSBmaW5hbCBib29raW5nIHN1Ym1pc3Npb24uICovXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX25hdGl2ZV9mb3JtKCAkbmF0aXZlICkge1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncmVzb3VyY2UtaWQnICkgfHwgMCApO1xuXHRcdHZhciBjb250ZXh0X3Rva2VuID0gU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLXJlc291cmNlLXNlbGVjdG9yLWNvbnRleHQtdG9rZW4nICkgfHwgJycgKTtcblx0XHR2YXIgYWxsb3dfcGFzdCA9ICcxJyA9PT0gU3RyaW5nKCAkbmF0aXZlLmF0dHIoICdkYXRhLWFsbG93LXBhc3QnICkgfHwgJzAnICkgPyAxIDogMDtcblx0XHR2YXIgZXhpc3RpbmcgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cblx0XHRpZiAoICEgcmVzb3VyY2VfaWQgfHwgISBjb250ZXh0X3Rva2VuICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIGV4aXN0aW5nICYmIGV4aXN0aW5nLmVsZW1lbnQgIT09ICRuYXRpdmUuZ2V0KCAwICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0YWN0aXZlX25hdGl2ZV9jb250ZXh0c1sgcmVzb3VyY2VfaWQgXSA9IHtcblx0XHRcdGVsZW1lbnQ6ICRuYXRpdmUuZ2V0KCAwICksXG5cdFx0XHRyZXNvdXJjZV9pZDogcmVzb3VyY2VfaWQsXG5cdFx0XHRjb250ZXh0X3Rva2VuOiBjb250ZXh0X3Rva2VuLFxuXHRcdFx0YWxsb3dfcGFzdDogYWxsb3dfcGFzdFxuXHRcdH07XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKiogUmVtb3ZlIG9uZSBuYXRpdmUgZm9ybSBmcm9tIHRoZSBsb2NhbCBzdWJtaXNzaW9uIHJlZ2lzdHJ5LiAqL1xuXHRmdW5jdGlvbiB1bnJlZ2lzdGVyX25hdGl2ZV9mb3JtKCAkbmF0aXZlICkge1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncmVzb3VyY2UtaWQnICkgfHwgMCApO1xuXHRcdHZhciBjb250ZXh0ID0gZ2V0X25hdGl2ZV9jb250ZXh0KCByZXNvdXJjZV9pZCApO1xuXHRcdGlmICggY29udGV4dCAmJiBjb250ZXh0LmVsZW1lbnQgPT09ICRuYXRpdmUuZ2V0KCAwICkgKSB7XG5cdFx0XHRkZWxldGUgYWN0aXZlX25hdGl2ZV9jb250ZXh0c1sgcmVzb3VyY2VfaWQgXTtcblx0XHR9XG5cdH1cblxuXHQvKiogUHJlcGFyZSBhIG5ld2x5IGluc2VydGVkIG5hdGl2ZSBmb3JtIGZvciByZXNvdXJjZS1ib3VuZCBzdWJtaXNzaW9uLiAqL1xuXHRmdW5jdGlvbiBwcmVwYXJlX25hdGl2ZV9mb3JtKCAkc2NvcGUgKSB7XG5cdFx0dmFyICRuYXRpdmUgPSAkc2NvcGUuZmluZCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX25hdGl2ZV9mb3JtJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAhICRuYXRpdmUubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlZ2lzdGVyX25hdGl2ZV9mb3JtKCAkbmF0aXZlICk7XG5cdH1cblxuXHQvKiogQ29udmVydCBhIHNjcmlwdCBVUkwgdG8gdGhlIHNhbWUgYWJzb2x1dGUgZm9ybSB1c2VkIGJ5IHNjcmlwdCBlbGVtZW50cy4gKi9cblx0ZnVuY3Rpb24gZ2V0X2Fic29sdXRlX3NjcmlwdF91cmwoIHVybCApIHtcblx0XHR2YXIgYW5jaG9yID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2EnICk7XG5cdFx0YW5jaG9yLmhyZWYgPSBTdHJpbmcoIHVybCB8fCAnJyApO1xuXHRcdHJldHVybiBhbmNob3IuaHJlZjtcblx0fVxuXG5cdC8qKiBSZXR1cm4gYSByZWplY3RlZCBwcm9taXNlIGNhcnJ5aW5nIG9uZSBjb250cm9sbGVkIG1lc3NhZ2UuICovXG5cdGZ1bmN0aW9uIHJlamVjdGVkX3N0YWdlKCBtZXNzYWdlICkge1xuXHRcdHZhciBkZWZlcnJlZCA9ICQuRGVmZXJyZWQoKTtcblx0XHRkZWZlcnJlZC5yZWplY3QoIHsgd3BiY19tZXNzYWdlOiBtZXNzYWdlIH0gKTtcblx0XHRyZXR1cm4gZGVmZXJyZWQucHJvbWlzZSgpO1xuXHR9XG5cblx0LyoqIEV4ZWN1dGUgcmVuZGVyZXIgc2NyaXB0cyBzZXF1ZW50aWFsbHkgd2hpbGUgdGhlIHJlcXVlc3Qgb3ducyB0aGUgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIGV4ZWN1dGVfc2NyaXB0cyggc2NyaXB0cywgb3duc19zdGFnZSApIHtcblx0XHR2YXIgc2VxdWVuY2UgPSAkLkRlZmVycmVkKCkucmVzb2x2ZSgpLnByb21pc2UoKTtcblxuXHRcdCQuZWFjaCggc2NyaXB0cywgZnVuY3Rpb24gKCBpbmRleCwgc2NyaXB0ICkge1xuXHRcdFx0c2VxdWVuY2UgPSBzZXF1ZW5jZS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggISBvd25zX3N0YWdlKCkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCAnJyApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggc2NyaXB0LnNyYyApIHtcblx0XHRcdFx0XHR2YXIgYWJzb2x1dGVfdXJsID0gZ2V0X2Fic29sdXRlX3NjcmlwdF91cmwoIHNjcmlwdC5zcmMgKTtcblx0XHRcdFx0XHRpZiAoIGxvYWRlZF9zY3JpcHRfdXJsc1sgYWJzb2x1dGVfdXJsIF0gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gJC5hamF4KCB7IHVybDogYWJzb2x1dGVfdXJsLCBkYXRhVHlwZTogJ3NjcmlwdCcsIGNhY2hlOiB0cnVlIH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRsb2FkZWRfc2NyaXB0X3VybHNbIGFic29sdXRlX3VybCBdID0gdHJ1ZTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzY3JpcHQuY29kZSApIHtcblx0XHRcdFx0XHQkLmdsb2JhbEV2YWwoIHNjcmlwdC5jb2RlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gc2VxdWVuY2U7XG5cdH1cblxuXHQvKiogSW5pdGlhbGl6ZSBuYXRpdmUgY29udHJvbHMgd2hvc2UgY29yZSBoYW5kbGVycyBiaW5kIG9uIGRvY3VtZW50IHJlYWR5LiAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scygpIHtcblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19ob29rX19pbml0X2Jvb2tpbmdfZm9ybV93aXphcmRfYnV0dG9ucyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHdpbmRvdy53cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIERlc3Ryb3kgbmF0aXZlIGNhbGVuZGFycyBhbmQgdW5yZWdpc3RlciBjb250ZXh0IGJlZm9yZSBzdGFnZSByZW1vdmFsLiAqL1xuXHRmdW5jdGlvbiBjbGVhbnVwX25hdGl2ZV9mb3JtKCAkcm9vdCApIHtcblx0XHQkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fbmF0aXZlX2Zvcm0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRuYXRpdmUgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Jlc291cmNlLWlkJyApIHx8IDAgKTtcblx0XHRcdHZhciAkY2FsZW5kYXIgPSAkbmF0aXZlLmZpbmQoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xuXG5cdFx0XHR1bnJlZ2lzdGVyX25hdGl2ZV9mb3JtKCAkbmF0aXZlICk7XG5cdFx0XHRpZiAoICEgcmVzb3VyY2VfaWQgfHwgISAkY2FsZW5kYXIubGVuZ3RoIHx8ICEgJC5kYXRlcGljayB8fCB0eXBlb2YgJGNhbGVuZGFyLmRhdGVwaWNrICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBpbnN0YW5jZSA9IHR5cGVvZiAkLmRhdGVwaWNrLl9nZXRJbnN0ID09PSAnZnVuY3Rpb24nID8gJC5kYXRlcGljay5fZ2V0SW5zdCggJGNhbGVuZGFyLmdldCggMCApICkgOiBudWxsO1xuXHRcdFx0XHRpZiAoIGluc3RhbmNlICkge1xuXHRcdFx0XHRcdCRjYWxlbmRhci5kYXRlcGljayggJ2Rlc3Ryb3knICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0JGNhbGVuZGFyLnJlbW92ZUNsYXNzKCAnaGFzRGF0ZXBpY2snICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIFJlc3RvcmUgdGhlIGNvbmZpZ3VyZWQgaW5pdGlhbCBSZXNvdXJjZSBjaG9pY2UgYWZ0ZXIgU3RhcnQgb3Zlci4gKi9cblx0ZnVuY3Rpb24gcmVzdG9yZV9yZXNvdXJjZV9zZWxlY3Rpb24oICRyb290ICkge1xuXHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtcmVzb3VyY2UtaWQnICkgfHwgMCApO1xuXHRcdGlmICggISByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyICRpbnB1dCA9ICRyb290LmZpbmQoICdbbmFtZT1cIndwYmNfcmVzb3VyY2Vfc2VsZWN0b3JfcmVzb3VyY2VcIl1bdmFsdWU9XCInICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAkaW5wdXQubGVuZ3RoICkge1xuXHRcdFx0JGlucHV0LmNsb3Nlc3QoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19jaG9pY2VzJyApLmZpbmQoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19jaG9pY2UnICkucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHRcdCRpbnB1dC5wcm9wKCAnY2hlY2tlZCcsIHRydWUgKS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fY2hvaWNlJyApLmFkZENsYXNzKCAnaXMtc2VsZWN0ZWQnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIEZvY3VzIHRoZSBuZXcgc3RhZ2UgaGVhZGluZyBhbmQga2VlcCB0aGUgY29tcG9uZW50IG5lYXIgdGhlIHZpZXdwb3J0LiAqL1xuXHRmdW5jdGlvbiBmb2N1c19zdGFnZSggJHJvb3QgKSB7XG5cdFx0dmFyICR0YXJnZXQgPSAkcm9vdC5maW5kKCAnPiAud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19zdGFnZSAud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19oZWFkaW5nIGgzLCA+IC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX3N0YWdlIC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX25vdGljZScgKS5maXJzdCgpO1xuXHRcdGlmICggJHRhcmdldC5sZW5ndGggKSB7XG5cdFx0XHQkdGFyZ2V0LmF0dHIoICd0YWJpbmRleCcsICctMScgKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdCR0YXJnZXQuZ2V0KCAwICkuZm9jdXMoIHsgcHJldmVudFNjcm9sbDogdHJ1ZSB9ICk7XG5cdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7XG5cdFx0XHRcdCR0YXJnZXQudHJpZ2dlciggJ2ZvY3VzJyApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICggJHJvb3QuZ2V0KCAwICkgJiYgdHlwZW9mICRyb290LmdldCggMCApLnNjcm9sbEludG9WaWV3ID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0dmFyIHJlZHVjZV9tb3Rpb24gPSB3aW5kb3cubWF0Y2hNZWRpYSAmJiB3aW5kb3cubWF0Y2hNZWRpYSggJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJyApLm1hdGNoZXM7XG5cdFx0XHQkcm9vdC5nZXQoIDAgKS5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogcmVkdWNlX21vdGlvbiA/ICdhdXRvJyA6ICdzbW9vdGgnLCBibG9jazogJ25lYXJlc3QnIH0gKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRGV0ZXJtaW5lIHdoZXRoZXIgYW4gQUpBWCBjYWxsYmFjayBzdGlsbCBvd25zIHRoZSBjb21wb25lbnQgc3RhdGUuICovXG5cdGZ1bmN0aW9uIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSB7XG5cdFx0cmV0dXJuIE51bWJlciggJHJvb3QuZGF0YSggJ3dwYmMtcmVzb3VyY2Utc2VsZWN0b3ItcmVxdWVzdC1pZCcgKSB8fCAwICkgPT09IE51bWJlciggcmVxdWVzdF9pZCApO1xuXHR9XG5cblx0LyoqIEZpbmlzaCBvbmx5IHRoZSBjdXJyZW50IHJlcXVlc3Qgc28gc3RhbGUgY2FsbGJhY2tzIGNhbm5vdCBhbHRlciB0aGUgVUkuICovXG5cdGZ1bmN0aW9uIGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApIHtcblx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQkcm9vdC5yZW1vdmVEYXRhKCAnd3BiYy1yZXNvdXJjZS1zZWxlY3Rvci1yZXF1ZXN0JyApO1xuXHRcdHNldF9sb2FkaW5nKCAkcm9vdCwgZmFsc2UgKTtcblx0fVxuXG5cdC8qKiBSZXBsYWNlIGEgY29tcGxldGUgc3RhZ2Ugd2l0aCBET00tYmVmb3JlLXNjcmlwdCBpbml0aWFsaXphdGlvbiBvcmRlcmluZy4gKi9cblx0ZnVuY3Rpb24gcmVwbGFjZV9zdGFnZSggJHJvb3QsIGh0bWwsIHN0YWdlLCByZXNvdXJjZV9pZCwgcmVxdWVzdF9pZCApIHtcblx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCAnJyApO1xuXHRcdH1cblx0XHRpZiAoICdib29raW5nJyA9PT0gc3RhZ2UgJiYgaGFzX2R1cGxpY2F0ZV9yZXNvdXJjZV9mb3JtKCAkcm9vdCwgcmVzb3VyY2VfaWQgKSApIHtcblx0XHRcdHJldHVybiByZWplY3RlZF9zdGFnZSggY29uZmlnLmR1cGxpY2F0ZV9yZXNvdXJjZSApO1xuXHRcdH1cblxuXHRcdHZhciBwYXJzZWQgPSAkLnBhcnNlSFRNTCggU3RyaW5nKCBodG1sIHx8ICcnICksIGRvY3VtZW50LCB0cnVlICkgfHwgW107XG5cdFx0dmFyIHNjcmlwdHMgPSBbXTtcblx0XHR2YXIgJGNvbnRhaW5lciA9ICQoICc8ZGl2PicgKS5hcHBlbmQoIHBhcnNlZCApO1xuXG5cdFx0JGNvbnRhaW5lci5maW5kKCAnc2NyaXB0JyApLmFkZEJhY2soICdzY3JpcHQnICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0c2NyaXB0cy5wdXNoKCB7IHNyYzogdGhpcy5zcmMgfHwgJycsIGNvZGU6IHRoaXMuc3JjID8gJycgOiAoIHRoaXMudGV4dCB8fCB0aGlzLnRleHRDb250ZW50IHx8ICcnICkgfSApO1xuXHRcdFx0JCggdGhpcyApLnJlbW92ZSgpO1xuXHRcdH0gKTtcblxuXHRcdGNsZWFudXBfbmF0aXZlX2Zvcm0oICRyb290ICk7XG5cdFx0JHJvb3QuYXR0ciggJ2RhdGEtcmVzb3VyY2Utc2VsZWN0b3Itc3RhZ2UnLCBzdGFnZSApO1xuXHRcdCRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX3N0YWdlJyApLmVtcHR5KCkuYXBwZW5kKCAkY29udGFpbmVyLmNvbnRlbnRzKCkgKTtcblxuXHRcdGlmICggISBwcmVwYXJlX25hdGl2ZV9mb3JtKCAkcm9vdCApICkge1xuXHRcdFx0Y2xlYW51cF9uYXRpdmVfZm9ybSggJHJvb3QgKTtcblx0XHRcdCRyb290LmZpbmQoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19uYXRpdmVfZm9ybSA6aW5wdXQnICkucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xuXHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCBjb25maWcuaW5pdGlhbGl6YXRpb25fZXJyb3IgfHwgY29uZmlnLmVycm9yICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGV4ZWN1dGVfc2NyaXB0cyggc2NyaXB0cywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHR9ICkudGhlbiggZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0aW5pdGlhbGl6ZV9hamF4X2Zvcm1fY29udHJvbHMoKTtcblx0XHRcdGlmICggJ3Jlc291cmNlJyA9PT0gc3RhZ2UgKSB7XG5cdFx0XHRcdHJlc3RvcmVfcmVzb3VyY2Vfc2VsZWN0aW9uKCAkcm9vdCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBSZXF1ZXN0IGFuZCByZW5kZXIgdGhlIG5leHQgQm9va2luZyBSZXNvdXJjZSBzZWxlY3RvciBzdGFnZS4gKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV9zdGFnZSggJHJvb3QsIHJlc291cmNlX2lkICkge1xuXHRcdGlmICggISAkcm9vdCB8fCAhICRyb290Lmxlbmd0aCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgfHwgMCApO1xuXHRcdGlmICggcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHQkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1yZXNvdXJjZS1pZCcsIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0dmFyIHByZXZpb3VzX3JlcXVlc3QgPSAkcm9vdC5kYXRhKCAnd3BiYy1yZXNvdXJjZS1zZWxlY3Rvci1yZXF1ZXN0JyApO1xuXHRcdHZhciByZXF1ZXN0X2lkID0gTnVtYmVyKCAkcm9vdC5kYXRhKCAnd3BiYy1yZXNvdXJjZS1zZWxlY3Rvci1yZXF1ZXN0LWlkJyApIHx8IDAgKSArIDE7XG5cdFx0JHJvb3QuZGF0YSggJ3dwYmMtcmVzb3VyY2Utc2VsZWN0b3ItcmVxdWVzdC1pZCcsIHJlcXVlc3RfaWQgKTtcblx0XHRpZiAoIHByZXZpb3VzX3JlcXVlc3QgJiYgcHJldmlvdXNfcmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0ICkge1xuXHRcdFx0cHJldmlvdXNfcmVxdWVzdC5hYm9ydCgpO1xuXHRcdH1cblxuXHRcdGNsZWFyX2Vycm9yKCAkcm9vdCApO1xuXHRcdHNldF9sb2FkaW5nKCAkcm9vdCwgdHJ1ZSApO1xuXHRcdHZhciByZXF1ZXN0ID0gJC5wb3N0KCBjb25maWcuYWpheF91cmwsIHtcblx0XHRcdGFjdGlvbjogY29uZmlnLmFjdGlvbixcblx0XHRcdG5vbmNlOiBjb25maWcubm9uY2UsXG5cdFx0XHRjb25maWdfdG9rZW46ICRyb290LmF0dHIoICdkYXRhLWNvbmZpZy10b2tlbicgKSB8fCAnJyxcblx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZFxuXHRcdH0gKTtcblx0XHQkcm9vdC5kYXRhKCAnd3BiYy1yZXNvdXJjZS1zZWxlY3Rvci1yZXF1ZXN0JywgcmVxdWVzdCApO1xuXG5cdFx0cmVxdWVzdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xuXHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJlc3BvbnNlIHx8ICEgcmVzcG9uc2Uuc3VjY2VzcyB8fCAhIHJlc3BvbnNlLmRhdGEgKSB7XG5cdFx0XHRcdHNob3dfZXJyb3IoICRyb290LCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6IGNvbmZpZy5lcnJvciApO1xuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgc3RhZ2UgPSByZXNwb25zZS5kYXRhLnN0YWdlIHx8ICcnO1xuXHRcdFx0dmFyIHJlcGxhY2VtZW50ID0gcmVwbGFjZV9zdGFnZSggJHJvb3QsIHJlc3BvbnNlLmRhdGEuaHRtbCwgc3RhZ2UsIHJlc3BvbnNlLmRhdGEucmVzb3VyY2VfaWQsIHJlcXVlc3RfaWQgKTtcblx0XHRcdHJlcGxhY2VtZW50LmRvbmUoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEucmVzb3VyY2VfaWQgfHwgMCApICkge1xuXHRcdFx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXJlc291cmNlLWlkJywgTnVtYmVyKCByZXNwb25zZS5kYXRhLnJlc291cmNlX2lkICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaW5pc2hfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKTtcblx0XHRcdFx0Zm9jdXNfc3RhZ2UoICRyb290ICk7XG5cdFx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCBlcnJvciApIHtcblx0XHRcdFx0aWYgKCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0c2hvd19lcnJvciggJHJvb3QsIGVycm9yICYmIGVycm9yLndwYmNfbWVzc2FnZSA/IGVycm9yLndwYmNfbWVzc2FnZSA6ICggY29uZmlnLmluaXRpYWxpemF0aW9uX2Vycm9yIHx8IGNvbmZpZy5lcnJvciApICk7XG5cdFx0XHRcdGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdFx0fSApO1xuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHhociwgc3RhdHVzICkge1xuXHRcdFx0aWYgKCAnYWJvcnQnID09PSBzdGF0dXMgfHwgISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHZhciByZXNwb25zZSA9IHhoci5yZXNwb25zZUpTT047XG5cdFx0XHRzaG93X2Vycm9yKCAkcm9vdCwgcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiByZXNwb25zZS5kYXRhLm1lc3NhZ2UgPyByZXNwb25zZS5kYXRhLm1lc3NhZ2UgOiBjb25maWcuZXJyb3IgKTtcblx0XHRcdGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKiBSZXNvbHZlIHRoZSBzZWxlY3RlZCBCb29raW5nIFJlc291cmNlIHRocm91Z2ggQUpBWC4gKi9cblx0JCggZG9jdW1lbnQgKS5vbiggJ3N1Ym1pdCcsICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19zZWxlY3Rpb25fZm9ybScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0aWYgKCAhIGNvbmZpZy5hamF4X3VybCB8fCAhIGNvbmZpZy5hY3Rpb24gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0dmFyICRmb3JtID0gJCggdGhpcyApO1xuXHRcdHJlc29sdmVfc3RhZ2UoICRmb3JtLmNsb3Nlc3QoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yJyApLCBnZXRfc2VsZWN0ZWRfcmVzb3VyY2VfaWQoICRmb3JtICkgKTtcblx0fSApO1xuXG5cdC8qKiBLZWVwIHNlbGVjdGVkIGNhcmQgc3R5bGluZyBpbmRlcGVuZGVudCBmcm9tIENTUyA6aGFzKCkgc3VwcG9ydC4gKi9cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19jaG9pY2UgPiBpbnB1dCcsIGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgJGlucHV0ID0gJCggdGhpcyApO1xuXHRcdCRpbnB1dC5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fY2hvaWNlcycgKS5maW5kKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fY2hvaWNlJyApLnJlbW92ZUNsYXNzKCAnaXMtc2VsZWN0ZWQnICk7XG5cdFx0JGlucHV0LmNsb3Nlc3QoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19jaG9pY2UnICkuYWRkQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0fSApO1xuXG5cdC8qKiBGaWx0ZXIgY2FyZHMgd2l0aG91dCBjaGFuZ2luZyB0aGUgc2VydmVyLWF1dGhvcml6ZWQgUmVzb3VyY2Ugc2V0LiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQnLCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9jYXRhbG9nIFtkYXRhLXdwYmMtcmVzb3VyY2UtY2F0YWxvZy1zZWFyY2hdJywgZnVuY3Rpb24gKCkge1xuXHRcdGZpbHRlcl9yZXNvdXJjZV9jYXRhbG9nKCAkKCB0aGlzICkuY2xvc2VzdCggJ1tkYXRhLXdwYmMtcmVzb3VyY2UtY2F0YWxvZ10nICkgKTtcblx0fSApO1xuXG5cdC8qKiBSZXR1cm4gdG8gUmVzb3VyY2Ugc2VsZWN0aW9uIHdpdGhvdXQgcmVsb2FkaW5nIHRoZSBwdWJsaWMgcGFnZS4gKi9cblx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3IgW2RhdGEtd3BiYy1yZXNvdXJjZS1zZWxlY3Rvci1hY3Rpb249XCJzdGFydC1vdmVyXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRpZiAoICEgY29uZmlnLmFqYXhfdXJsIHx8ICEgY29uZmlnLmFjdGlvbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHR2YXIgJHJvb3QgPSAkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3InICk7XG5cdFx0aWYgKCAkcm9vdC5oYXNDbGFzcyggJ2lzLWxvYWRpbmcnICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJlc29sdmVfc3RhZ2UoICRyb290LCAwICk7XG5cdH0gKTtcblxuXHQvKiogQWRkIHRoZSBzaWduZWQgcmVzb3VyY2UgY29udGV4dCB0byB0aGUgY29yZSBib29raW5nLWNyZWF0ZSByZXF1ZXN0LiAqL1xuXHQkKCAnYm9keScgKS5vbiggJ3dwYmNfYmVmb3JlX2Jvb2tpbmdfY3JlYXRlLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvcicsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBwYXJhbXMgKSB7XG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0aWYgKCAhIGNvbnRleHQgfHwgISBwYXJhbXMgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHBhcmFtcy5yZXNvdXJjZV9zZWxlY3Rvcl9yZXF1aXJlZCA9IDE7XG5cdFx0cGFyYW1zLnJlc291cmNlX3NlbGVjdG9yX2NvbnRleHRfdG9rZW4gPSBjb250ZXh0LmNvbnRleHRfdG9rZW47XG5cdFx0cGFyYW1zLmFsbG93X3Bhc3QgPSBjb250ZXh0LmFsbG93X3Bhc3Q7XG5cdH0gKTtcblxuXHQkKCBmdW5jdGlvbiAoKSB7XG5cdFx0JCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3InICkuZWFjaCggZnVuY3Rpb24gKCkge1xuXHRcdFx0dmFyICRyb290ID0gJCggdGhpcyApO1xuXHRcdFx0dmFyICRuYXRpdmUgPSAkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fbmF0aXZlX2Zvcm0nICkuZmlyc3QoKTtcblx0XHRcdGlmICggJG5hdGl2ZS5sZW5ndGggKSB7XG5cdFx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXJlc291cmNlLWlkJywgTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdyZXNvdXJjZS1pZCcgKSB8fCAwICkgKTtcblx0XHRcdH1cblx0XHRcdHZhciBkdXBsaWNhdGUgPSAkbmF0aXZlLmxlbmd0aCAmJiBoYXNfZHVwbGljYXRlX3Jlc291cmNlX2Zvcm0oICRyb290LCBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Jlc291cmNlLWlkJyApIHx8IDAgKSApO1xuXHRcdFx0aWYgKCBkdXBsaWNhdGUgfHwgISBwcmVwYXJlX25hdGl2ZV9mb3JtKCAkcm9vdCApICkge1xuXHRcdFx0XHRjbGVhbnVwX25hdGl2ZV9mb3JtKCAkcm9vdCApO1xuXHRcdFx0XHQkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fbmF0aXZlX2Zvcm0gOmlucHV0JyApLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKTtcblx0XHRcdFx0c2hvd19lcnJvciggJHJvb3QsIGR1cGxpY2F0ZSA/IGNvbmZpZy5kdXBsaWNhdGVfcmVzb3VyY2UgOiBjb25maWcuaW5pdGlhbGl6YXRpb25fZXJyb3IgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH0gKTtcbn0gKSggd2luZG93LCBqUXVlcnkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQSxDQUFFLFVBQVdBLE1BQU0sRUFBRUMsQ0FBQyxFQUFHO0VBQ3hCLFlBQVk7O0VBRVosSUFBSUMsTUFBTSxHQUFHRixNQUFNLENBQUNHLHFDQUFxQyxJQUFJLENBQUMsQ0FBQztFQUMvRCxJQUFJQyxzQkFBc0IsR0FBRyxDQUFDLENBQUM7RUFDL0IsSUFBSUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO0VBRTNCSixDQUFDLENBQUUsYUFBYyxDQUFDLENBQUNLLElBQUksQ0FBRSxZQUFZO0lBQ3BDRCxrQkFBa0IsQ0FBRUUsTUFBTSxDQUFFLElBQUksQ0FBQ0MsR0FBRyxJQUFJLEVBQUcsQ0FBQyxDQUFFLEdBQUcsSUFBSTtFQUN0RCxDQUFFLENBQUM7O0VBRUg7RUFDQSxTQUFTQyx3QkFBd0JBLENBQUVDLEtBQUssRUFBRztJQUMxQyxPQUFPQyxNQUFNLENBQUVELEtBQUssQ0FBQ0UsSUFBSSxDQUFFLGtEQUFtRCxDQUFDLENBQUNDLEtBQUssQ0FBQyxDQUFDLENBQUNDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBRSxDQUFDO0VBQ3JHOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLHVCQUF1QkEsQ0FBRUMsUUFBUSxFQUFHO0lBQzVDLElBQUlDLFdBQVcsR0FBR1YsTUFBTSxDQUFFUyxRQUFRLENBQUNKLElBQUksQ0FBRSxxQ0FBc0MsQ0FBQyxDQUFDRSxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUcsQ0FBQyxDQUFDSSxpQkFBaUIsQ0FBQyxDQUFDLENBQUNDLElBQUksQ0FBQyxDQUFDO0lBQ3pILElBQUlDLGFBQWEsR0FBRyxDQUFDO0lBRXJCSixRQUFRLENBQUNKLElBQUksQ0FBRSxvQkFBcUIsQ0FBQyxDQUFDTixJQUFJLENBQUUsWUFBWTtNQUN2RCxJQUFJZSxLQUFLLEdBQUdwQixDQUFDLENBQUUsSUFBSyxDQUFDO01BQ3JCLElBQUlxQixlQUFlLEdBQUdmLE1BQU0sQ0FBRWMsS0FBSyxDQUFDRSxJQUFJLENBQUUsc0JBQXVCLENBQUMsSUFBSSxFQUFHLENBQUMsQ0FBQ0wsaUJBQWlCLENBQUMsQ0FBQztNQUM5RixJQUFJTSxVQUFVLEdBQUcsQ0FBRVAsV0FBVyxJQUFJSyxlQUFlLENBQUNHLE9BQU8sQ0FBRVIsV0FBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO01BQy9FLElBQUlTLGVBQWUsR0FBR0wsS0FBSyxDQUFDVCxJQUFJLENBQUUsMENBQTJDLENBQUM7TUFFOUVTLEtBQUssQ0FBQ00sSUFBSSxDQUFFLFFBQVEsRUFBRSxDQUFFSCxVQUFXLENBQUM7TUFDcENFLGVBQWUsQ0FBQ0MsSUFBSSxDQUFFLFVBQVUsRUFBRSxDQUFFSCxVQUFXLENBQUM7TUFDaEQsSUFBS0EsVUFBVSxFQUFHO1FBQ2pCSixhQUFhLElBQUksQ0FBQztNQUNuQixDQUFDLE1BQU0sSUFBS00sZUFBZSxDQUFDQyxJQUFJLENBQUUsU0FBVSxDQUFDLEVBQUc7UUFDL0NELGVBQWUsQ0FBQ0MsSUFBSSxDQUFFLFNBQVMsRUFBRSxLQUFNLENBQUM7UUFDeENOLEtBQUssQ0FBQ08sV0FBVyxDQUFFLGFBQWMsQ0FBQztNQUNuQztJQUNELENBQUUsQ0FBQztJQUVIWixRQUFRLENBQUNKLElBQUksQ0FBRSxvQ0FBcUMsQ0FBQyxDQUFDZSxJQUFJLENBQUUsUUFBUSxFQUFFLENBQUMsS0FBS1AsYUFBYyxDQUFDO0lBQzNGSixRQUFRLENBQUNKLElBQUksQ0FBRSxxQ0FBc0MsQ0FBQyxDQUFDaUIsSUFBSSxDQUMxRHRCLE1BQU0sQ0FBRWEsYUFBYyxDQUFDLEdBQUcsR0FBRyxJQUFLLENBQUMsS0FBS0EsYUFBYSxHQUFLbEIsTUFBTSxDQUFDNEIsY0FBYyxJQUFJLHlCQUF5QixHQUFPNUIsTUFBTSxDQUFDNkIsZUFBZSxJQUFJLDBCQUE0QixDQUMxSyxDQUFDO0VBQ0Y7O0VBRUE7RUFDQSxTQUFTQyxXQUFXQSxDQUFFQyxLQUFLLEVBQUVDLFVBQVUsRUFBRztJQUN6Q0QsS0FBSyxDQUFDRSxXQUFXLENBQUUsWUFBWSxFQUFFRCxVQUFXLENBQUMsQ0FBQ1gsSUFBSSxDQUFFLFdBQVcsRUFBRVcsVUFBVSxHQUFHLE1BQU0sR0FBRyxPQUFRLENBQUM7SUFDaEdELEtBQUssQ0FBQ3JCLElBQUksQ0FBRSwwQ0FBMkMsQ0FBQyxDQUFDVyxJQUFJLENBQUUsV0FBVyxFQUFFVyxVQUFVLEdBQUcsTUFBTSxHQUFHLE9BQVEsQ0FBQztJQUMzR0QsS0FBSyxDQUFDckIsSUFBSSxDQUFFLDRDQUE2QyxDQUFDLENBQUNlLElBQUksQ0FBRSxRQUFRLEVBQUUsQ0FBRU8sVUFBVyxDQUFDLENBQUNYLElBQUksQ0FBRSxhQUFhLEVBQUVXLFVBQVUsR0FBRyxPQUFPLEdBQUcsTUFBTyxDQUFDO0lBQzlJRCxLQUFLLENBQUNyQixJQUFJLENBQUUsd0RBQXlELENBQUMsQ0FBQ2UsSUFBSSxDQUFFLFVBQVUsRUFBRU8sVUFBVyxDQUFDO0lBQ3JHLElBQUssQ0FBRUEsVUFBVSxFQUFHO01BQ25CRCxLQUFLLENBQUNyQixJQUFJLENBQUUsOEJBQStCLENBQUMsQ0FBQ04sSUFBSSxDQUFFLFlBQVk7UUFDOURTLHVCQUF1QixDQUFFZCxDQUFDLENBQUUsSUFBSyxDQUFFLENBQUM7TUFDckMsQ0FBRSxDQUFDO0lBQ0o7RUFDRDs7RUFFQTtFQUNBLFNBQVNtQyxVQUFVQSxDQUFFSCxLQUFLLEVBQUVJLE9BQU8sRUFBRztJQUNyQyxJQUFJQyxPQUFPLEdBQUdMLEtBQUssQ0FBQ3JCLElBQUksQ0FBRSxnREFBaUQsQ0FBQztJQUM1RTBCLE9BQU8sQ0FBQ0MsS0FBSyxDQUFDLENBQUMsQ0FBQ0MsTUFBTSxDQUFFdkMsQ0FBQyxDQUFFLFFBQVMsQ0FBQyxDQUFDNEIsSUFBSSxDQUFFUSxPQUFPLElBQUluQyxNQUFNLENBQUN1QyxLQUFLLElBQUksa0NBQW1DLENBQUUsQ0FBQyxDQUFDZCxJQUFJLENBQUUsUUFBUSxFQUFFLEtBQU0sQ0FBQztJQUNySSxJQUFLVyxPQUFPLENBQUNJLEdBQUcsQ0FBRSxDQUFFLENBQUMsSUFBSSxPQUFPSixPQUFPLENBQUNJLEdBQUcsQ0FBRSxDQUFFLENBQUMsQ0FBQ0MsS0FBSyxLQUFLLFVBQVUsRUFBRztNQUN2RUwsT0FBTyxDQUFDTSxPQUFPLENBQUUsT0FBUSxDQUFDO0lBQzNCO0VBQ0Q7O0VBRUE7RUFDQSxTQUFTQyxXQUFXQSxDQUFFWixLQUFLLEVBQUc7SUFDN0JBLEtBQUssQ0FBQ3JCLElBQUksQ0FBRSxnREFBaUQsQ0FBQyxDQUFDMkIsS0FBSyxDQUFDLENBQUMsQ0FBQ1osSUFBSSxDQUFFLFFBQVEsRUFBRSxJQUFLLENBQUM7RUFDOUY7O0VBRUE7RUFDQSxTQUFTbUIsa0JBQWtCQSxDQUFFQyxXQUFXLEVBQUc7SUFDMUNBLFdBQVcsR0FBR3BDLE1BQU0sQ0FBRW9DLFdBQVcsSUFBSSxDQUFFLENBQUM7SUFDeEMsSUFBSUMsT0FBTyxHQUFHNUMsc0JBQXNCLENBQUUyQyxXQUFXLENBQUU7SUFDbkQsSUFBSyxDQUFFQyxPQUFPLElBQUksQ0FBRUEsT0FBTyxDQUFDQyxPQUFPLElBQUksQ0FBRUMsUUFBUSxDQUFDQyxlQUFlLENBQUNDLFFBQVEsQ0FBRUosT0FBTyxDQUFDQyxPQUFRLENBQUMsRUFBRztNQUMvRixPQUFPN0Msc0JBQXNCLENBQUUyQyxXQUFXLENBQUU7TUFDNUMsT0FBTyxJQUFJO0lBQ1o7SUFDQSxPQUFPQyxPQUFPO0VBQ2Y7O0VBRUE7RUFDQSxTQUFTSywyQkFBMkJBLENBQUVwQixLQUFLLEVBQUVjLFdBQVcsRUFBRztJQUMxREEsV0FBVyxHQUFHcEMsTUFBTSxDQUFFb0MsV0FBVyxJQUFJLENBQUUsQ0FBQztJQUN4QyxJQUFLLENBQUVBLFdBQVcsRUFBRztNQUNwQixPQUFPLEtBQUs7SUFDYjtJQUVBLElBQUlDLE9BQU8sR0FBR0Ysa0JBQWtCLENBQUVDLFdBQVksQ0FBQztJQUMvQyxJQUFLQyxPQUFPLElBQUksQ0FBRS9DLENBQUMsQ0FBQ21ELFFBQVEsQ0FBRW5CLEtBQUssQ0FBQ1MsR0FBRyxDQUFFLENBQUUsQ0FBQyxFQUFFTSxPQUFPLENBQUNDLE9BQVEsQ0FBQyxFQUFHO01BQ2pFLE9BQU8sSUFBSTtJQUNaO0lBRUEsT0FBT2hELENBQUMsQ0FBRSxtQkFBbUIsR0FBRzhDLFdBQVcsR0FBRyxJQUFLLENBQUMsQ0FBQ08sTUFBTSxDQUFFLFlBQVk7TUFDeEUsT0FBTyxDQUFFckQsQ0FBQyxDQUFDbUQsUUFBUSxDQUFFbkIsS0FBSyxDQUFDUyxHQUFHLENBQUUsQ0FBRSxDQUFDLEVBQUUsSUFBSyxDQUFDO0lBQzVDLENBQUUsQ0FBQyxDQUFDYSxNQUFNLEdBQUcsQ0FBQztFQUNmOztFQUVBO0VBQ0EsU0FBU0Msb0JBQW9CQSxDQUFFQyxPQUFPLEVBQUc7SUFDeEMsSUFBSVYsV0FBVyxHQUFHcEMsTUFBTSxDQUFFOEMsT0FBTyxDQUFDQyxJQUFJLENBQUUsYUFBYyxDQUFDLElBQUksQ0FBRSxDQUFDO0lBQzlELElBQUlDLGFBQWEsR0FBR3BELE1BQU0sQ0FBRWtELE9BQU8sQ0FBQ2xDLElBQUksQ0FBRSxzQ0FBdUMsQ0FBQyxJQUFJLEVBQUcsQ0FBQztJQUMxRixJQUFJcUMsVUFBVSxHQUFHLEdBQUcsS0FBS3JELE1BQU0sQ0FBRWtELE9BQU8sQ0FBQ2xDLElBQUksQ0FBRSxpQkFBa0IsQ0FBQyxJQUFJLEdBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDO0lBQ25GLElBQUlzQyxRQUFRLEdBQUdmLGtCQUFrQixDQUFFQyxXQUFZLENBQUM7SUFFaEQsSUFBSyxDQUFFQSxXQUFXLElBQUksQ0FBRVksYUFBYSxFQUFHO01BQ3ZDLE9BQU8sS0FBSztJQUNiO0lBQ0EsSUFBS0UsUUFBUSxJQUFJQSxRQUFRLENBQUNaLE9BQU8sS0FBS1EsT0FBTyxDQUFDZixHQUFHLENBQUUsQ0FBRSxDQUFDLEVBQUc7TUFDeEQsT0FBTyxLQUFLO0lBQ2I7SUFFQXRDLHNCQUFzQixDQUFFMkMsV0FBVyxDQUFFLEdBQUc7TUFDdkNFLE9BQU8sRUFBRVEsT0FBTyxDQUFDZixHQUFHLENBQUUsQ0FBRSxDQUFDO01BQ3pCSyxXQUFXLEVBQUVBLFdBQVc7TUFDeEJZLGFBQWEsRUFBRUEsYUFBYTtNQUM1QkMsVUFBVSxFQUFFQTtJQUNiLENBQUM7SUFDRCxPQUFPLElBQUk7RUFDWjs7RUFFQTtFQUNBLFNBQVNFLHNCQUFzQkEsQ0FBRUwsT0FBTyxFQUFHO0lBQzFDLElBQUlWLFdBQVcsR0FBR3BDLE1BQU0sQ0FBRThDLE9BQU8sQ0FBQ0MsSUFBSSxDQUFFLGFBQWMsQ0FBQyxJQUFJLENBQUUsQ0FBQztJQUM5RCxJQUFJVixPQUFPLEdBQUdGLGtCQUFrQixDQUFFQyxXQUFZLENBQUM7SUFDL0MsSUFBS0MsT0FBTyxJQUFJQSxPQUFPLENBQUNDLE9BQU8sS0FBS1EsT0FBTyxDQUFDZixHQUFHLENBQUUsQ0FBRSxDQUFDLEVBQUc7TUFDdEQsT0FBT3RDLHNCQUFzQixDQUFFMkMsV0FBVyxDQUFFO0lBQzdDO0VBQ0Q7O0VBRUE7RUFDQSxTQUFTZ0IsbUJBQW1CQSxDQUFFQyxNQUFNLEVBQUc7SUFDdEMsSUFBSVAsT0FBTyxHQUFHTyxNQUFNLENBQUNwRCxJQUFJLENBQUUsOENBQStDLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7SUFDbkYsSUFBSyxDQUFFNEMsT0FBTyxDQUFDRixNQUFNLEVBQUc7TUFDdkIsT0FBTyxJQUFJO0lBQ1o7SUFFQSxPQUFPQyxvQkFBb0IsQ0FBRUMsT0FBUSxDQUFDO0VBQ3ZDOztFQUVBO0VBQ0EsU0FBU1EsdUJBQXVCQSxDQUFFQyxHQUFHLEVBQUc7SUFDdkMsSUFBSUMsTUFBTSxHQUFHakIsUUFBUSxDQUFDa0IsYUFBYSxDQUFFLEdBQUksQ0FBQztJQUMxQ0QsTUFBTSxDQUFDRSxJQUFJLEdBQUc5RCxNQUFNLENBQUUyRCxHQUFHLElBQUksRUFBRyxDQUFDO0lBQ2pDLE9BQU9DLE1BQU0sQ0FBQ0UsSUFBSTtFQUNuQjs7RUFFQTtFQUNBLFNBQVNDLGNBQWNBLENBQUVqQyxPQUFPLEVBQUc7SUFDbEMsSUFBSWtDLFFBQVEsR0FBR3RFLENBQUMsQ0FBQ3VFLFFBQVEsQ0FBQyxDQUFDO0lBQzNCRCxRQUFRLENBQUNFLE1BQU0sQ0FBRTtNQUFFQyxZQUFZLEVBQUVyQztJQUFRLENBQUUsQ0FBQztJQUM1QyxPQUFPa0MsUUFBUSxDQUFDSSxPQUFPLENBQUMsQ0FBQztFQUMxQjs7RUFFQTtFQUNBLFNBQVNDLGVBQWVBLENBQUVDLE9BQU8sRUFBRUMsVUFBVSxFQUFHO0lBQy9DLElBQUlDLFFBQVEsR0FBRzlFLENBQUMsQ0FBQ3VFLFFBQVEsQ0FBQyxDQUFDLENBQUNRLE9BQU8sQ0FBQyxDQUFDLENBQUNMLE9BQU8sQ0FBQyxDQUFDO0lBRS9DMUUsQ0FBQyxDQUFDSyxJQUFJLENBQUV1RSxPQUFPLEVBQUUsVUFBV0ksS0FBSyxFQUFFQyxNQUFNLEVBQUc7TUFDM0NILFFBQVEsR0FBR0EsUUFBUSxDQUFDSSxJQUFJLENBQUUsWUFBWTtRQUNyQyxJQUFLLENBQUVMLFVBQVUsQ0FBQyxDQUFDLEVBQUc7VUFDckIsT0FBT1IsY0FBYyxDQUFFLEVBQUcsQ0FBQztRQUM1QjtRQUNBLElBQUtZLE1BQU0sQ0FBQzFFLEdBQUcsRUFBRztVQUNqQixJQUFJNEUsWUFBWSxHQUFHbkIsdUJBQXVCLENBQUVpQixNQUFNLENBQUMxRSxHQUFJLENBQUM7VUFDeEQsSUFBS0gsa0JBQWtCLENBQUUrRSxZQUFZLENBQUUsRUFBRztZQUN6QyxPQUFPQyxTQUFTO1VBQ2pCO1VBQ0EsT0FBT3BGLENBQUMsQ0FBQ3FGLElBQUksQ0FBRTtZQUFFcEIsR0FBRyxFQUFFa0IsWUFBWTtZQUFFRyxRQUFRLEVBQUUsUUFBUTtZQUFFQyxLQUFLLEVBQUU7VUFBSyxDQUFFLENBQUMsQ0FBQ0wsSUFBSSxDQUFFLFlBQVk7WUFDekY5RSxrQkFBa0IsQ0FBRStFLFlBQVksQ0FBRSxHQUFHLElBQUk7VUFDMUMsQ0FBRSxDQUFDO1FBQ0o7UUFDQSxJQUFLRixNQUFNLENBQUNPLElBQUksRUFBRztVQUNsQnhGLENBQUMsQ0FBQ3lGLFVBQVUsQ0FBRVIsTUFBTSxDQUFDTyxJQUFLLENBQUM7UUFDNUI7UUFDQSxPQUFPSixTQUFTO01BQ2pCLENBQUUsQ0FBQztJQUNKLENBQUUsQ0FBQztJQUVILE9BQU9OLFFBQVE7RUFDaEI7O0VBRUE7RUFDQSxTQUFTWSw2QkFBNkJBLENBQUEsRUFBRztJQUN4QyxJQUFLLE9BQU8zRixNQUFNLENBQUM0RiwyQ0FBMkMsS0FBSyxVQUFVLEVBQUc7TUFDL0U1RixNQUFNLENBQUM0RiwyQ0FBMkMsQ0FBQyxDQUFDO0lBQ3JEO0VBQ0Q7O0VBRUE7RUFDQSxTQUFTQyxtQkFBbUJBLENBQUU1RCxLQUFLLEVBQUc7SUFDckNBLEtBQUssQ0FBQ3JCLElBQUksQ0FBRSw4Q0FBK0MsQ0FBQyxDQUFDTixJQUFJLENBQUUsWUFBWTtNQUM5RSxJQUFJbUQsT0FBTyxHQUFHeEQsQ0FBQyxDQUFFLElBQUssQ0FBQztNQUN2QixJQUFJOEMsV0FBVyxHQUFHcEMsTUFBTSxDQUFFOEMsT0FBTyxDQUFDQyxJQUFJLENBQUUsYUFBYyxDQUFDLElBQUksQ0FBRSxDQUFDO01BQzlELElBQUlvQyxTQUFTLEdBQUdyQyxPQUFPLENBQUM3QyxJQUFJLENBQUUsbUJBQW1CLEdBQUdtQyxXQUFZLENBQUM7TUFFakVlLHNCQUFzQixDQUFFTCxPQUFRLENBQUM7TUFDakMsSUFBSyxDQUFFVixXQUFXLElBQUksQ0FBRStDLFNBQVMsQ0FBQ3ZDLE1BQU0sSUFBSSxDQUFFdEQsQ0FBQyxDQUFDOEYsUUFBUSxJQUFJLE9BQU9ELFNBQVMsQ0FBQ0MsUUFBUSxLQUFLLFVBQVUsRUFBRztRQUN0RztNQUNEO01BRUEsSUFBSTtRQUNILElBQUlDLFFBQVEsR0FBRyxPQUFPL0YsQ0FBQyxDQUFDOEYsUUFBUSxDQUFDRSxRQUFRLEtBQUssVUFBVSxHQUFHaEcsQ0FBQyxDQUFDOEYsUUFBUSxDQUFDRSxRQUFRLENBQUVILFNBQVMsQ0FBQ3BELEdBQUcsQ0FBRSxDQUFFLENBQUUsQ0FBQyxHQUFHLElBQUk7UUFDM0csSUFBS3NELFFBQVEsRUFBRztVQUNmRixTQUFTLENBQUNDLFFBQVEsQ0FBRSxTQUFVLENBQUM7UUFDaEM7TUFDRCxDQUFDLENBQUMsT0FBUXRELEtBQUssRUFBRztRQUNqQnFELFNBQVMsQ0FBQ2xFLFdBQVcsQ0FBRSxhQUFjLENBQUM7TUFDdkM7SUFDRCxDQUFFLENBQUM7RUFDSjs7RUFFQTtFQUNBLFNBQVNzRSwwQkFBMEJBLENBQUVqRSxLQUFLLEVBQUc7SUFDNUMsSUFBSWMsV0FBVyxHQUFHcEMsTUFBTSxDQUFFc0IsS0FBSyxDQUFDVixJQUFJLENBQUUsMkJBQTRCLENBQUMsSUFBSSxDQUFFLENBQUM7SUFDMUUsSUFBSyxDQUFFd0IsV0FBVyxFQUFHO01BQ3BCO0lBQ0Q7SUFDQSxJQUFJb0QsTUFBTSxHQUFHbEUsS0FBSyxDQUFDckIsSUFBSSxDQUFFLGtEQUFrRCxHQUFHbUMsV0FBVyxHQUFHLElBQUssQ0FBQyxDQUFDbEMsS0FBSyxDQUFDLENBQUM7SUFDMUcsSUFBS3NGLE1BQU0sQ0FBQzVDLE1BQU0sRUFBRztNQUNwQjRDLE1BQU0sQ0FBQ0MsT0FBTyxDQUFFLDBDQUEyQyxDQUFDLENBQUN4RixJQUFJLENBQUUseUNBQTBDLENBQUMsQ0FBQ2dCLFdBQVcsQ0FBRSxhQUFjLENBQUM7TUFDM0l1RSxNQUFNLENBQUN4RSxJQUFJLENBQUUsU0FBUyxFQUFFLElBQUssQ0FBQyxDQUFDeUUsT0FBTyxDQUFFLHlDQUEwQyxDQUFDLENBQUNDLFFBQVEsQ0FBRSxhQUFjLENBQUM7SUFDOUc7RUFDRDs7RUFFQTtFQUNBLFNBQVNDLFdBQVdBLENBQUVyRSxLQUFLLEVBQUc7SUFDN0IsSUFBSXNFLE9BQU8sR0FBR3RFLEtBQUssQ0FBQ3JCLElBQUksQ0FBRSx3S0FBeUssQ0FBQyxDQUFDQyxLQUFLLENBQUMsQ0FBQztJQUM1TSxJQUFLMEYsT0FBTyxDQUFDaEQsTUFBTSxFQUFHO01BQ3JCZ0QsT0FBTyxDQUFDaEYsSUFBSSxDQUFFLFVBQVUsRUFBRSxJQUFLLENBQUM7TUFDaEMsSUFBSTtRQUNIZ0YsT0FBTyxDQUFDN0QsR0FBRyxDQUFFLENBQUUsQ0FBQyxDQUFDQyxLQUFLLENBQUU7VUFBRTZELGFBQWEsRUFBRTtRQUFLLENBQUUsQ0FBQztNQUNsRCxDQUFDLENBQUMsT0FBUS9ELEtBQUssRUFBRztRQUNqQjhELE9BQU8sQ0FBQzNELE9BQU8sQ0FBRSxPQUFRLENBQUM7TUFDM0I7SUFDRDtJQUVBLElBQUtYLEtBQUssQ0FBQ1MsR0FBRyxDQUFFLENBQUUsQ0FBQyxJQUFJLE9BQU9ULEtBQUssQ0FBQ1MsR0FBRyxDQUFFLENBQUUsQ0FBQyxDQUFDK0QsY0FBYyxLQUFLLFVBQVUsRUFBRztNQUM1RSxJQUFJQyxhQUFhLEdBQUcxRyxNQUFNLENBQUMyRyxVQUFVLElBQUkzRyxNQUFNLENBQUMyRyxVQUFVLENBQUUsa0NBQW1DLENBQUMsQ0FBQ0MsT0FBTztNQUN4RzNFLEtBQUssQ0FBQ1MsR0FBRyxDQUFFLENBQUUsQ0FBQyxDQUFDK0QsY0FBYyxDQUFFO1FBQUVJLFFBQVEsRUFBRUgsYUFBYSxHQUFHLE1BQU0sR0FBRyxRQUFRO1FBQUVJLEtBQUssRUFBRTtNQUFVLENBQUUsQ0FBQztJQUNuRztFQUNEOztFQUVBO0VBQ0EsU0FBU0Msa0JBQWtCQSxDQUFFOUUsS0FBSyxFQUFFK0UsVUFBVSxFQUFHO0lBQ2hELE9BQU9yRyxNQUFNLENBQUVzQixLQUFLLENBQUN5QixJQUFJLENBQUUsbUNBQW9DLENBQUMsSUFBSSxDQUFFLENBQUMsS0FBSy9DLE1BQU0sQ0FBRXFHLFVBQVcsQ0FBQztFQUNqRzs7RUFFQTtFQUNBLFNBQVNDLGNBQWNBLENBQUVoRixLQUFLLEVBQUUrRSxVQUFVLEVBQUc7SUFDNUMsSUFBSyxDQUFFRCxrQkFBa0IsQ0FBRTlFLEtBQUssRUFBRStFLFVBQVcsQ0FBQyxFQUFHO01BQ2hEO0lBQ0Q7SUFDQS9FLEtBQUssQ0FBQ2lGLFVBQVUsQ0FBRSxnQ0FBaUMsQ0FBQztJQUNwRGxGLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLEtBQU0sQ0FBQztFQUM1Qjs7RUFFQTtFQUNBLFNBQVNrRixhQUFhQSxDQUFFbEYsS0FBSyxFQUFFbUYsSUFBSSxFQUFFQyxLQUFLLEVBQUV0RSxXQUFXLEVBQUVpRSxVQUFVLEVBQUc7SUFDckUsSUFBSyxDQUFFRCxrQkFBa0IsQ0FBRTlFLEtBQUssRUFBRStFLFVBQVcsQ0FBQyxFQUFHO01BQ2hELE9BQU8xQyxjQUFjLENBQUUsRUFBRyxDQUFDO0lBQzVCO0lBQ0EsSUFBSyxTQUFTLEtBQUsrQyxLQUFLLElBQUloRSwyQkFBMkIsQ0FBRXBCLEtBQUssRUFBRWMsV0FBWSxDQUFDLEVBQUc7TUFDL0UsT0FBT3VCLGNBQWMsQ0FBRXBFLE1BQU0sQ0FBQ29ILGtCQUFtQixDQUFDO0lBQ25EO0lBRUEsSUFBSUMsTUFBTSxHQUFHdEgsQ0FBQyxDQUFDdUgsU0FBUyxDQUFFakgsTUFBTSxDQUFFNkcsSUFBSSxJQUFJLEVBQUcsQ0FBQyxFQUFFbEUsUUFBUSxFQUFFLElBQUssQ0FBQyxJQUFJLEVBQUU7SUFDdEUsSUFBSTJCLE9BQU8sR0FBRyxFQUFFO0lBQ2hCLElBQUk0QyxVQUFVLEdBQUd4SCxDQUFDLENBQUUsT0FBUSxDQUFDLENBQUN1QyxNQUFNLENBQUUrRSxNQUFPLENBQUM7SUFFOUNFLFVBQVUsQ0FBQzdHLElBQUksQ0FBRSxRQUFTLENBQUMsQ0FBQzhHLE9BQU8sQ0FBRSxRQUFTLENBQUMsQ0FBQ3BILElBQUksQ0FBRSxZQUFZO01BQ2pFdUUsT0FBTyxDQUFDOEMsSUFBSSxDQUFFO1FBQUVuSCxHQUFHLEVBQUUsSUFBSSxDQUFDQSxHQUFHLElBQUksRUFBRTtRQUFFaUYsSUFBSSxFQUFFLElBQUksQ0FBQ2pGLEdBQUcsR0FBRyxFQUFFLEdBQUssSUFBSSxDQUFDcUIsSUFBSSxJQUFJLElBQUksQ0FBQytGLFdBQVcsSUFBSTtNQUFLLENBQUUsQ0FBQztNQUN0RzNILENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzRILE1BQU0sQ0FBQyxDQUFDO0lBQ25CLENBQUUsQ0FBQztJQUVIaEMsbUJBQW1CLENBQUU1RCxLQUFNLENBQUM7SUFDNUJBLEtBQUssQ0FBQ1YsSUFBSSxDQUFFLDhCQUE4QixFQUFFOEYsS0FBTSxDQUFDO0lBQ25EcEYsS0FBSyxDQUFDckIsSUFBSSxDQUFFLDBDQUEyQyxDQUFDLENBQUMyQixLQUFLLENBQUMsQ0FBQyxDQUFDQyxNQUFNLENBQUVpRixVQUFVLENBQUNLLFFBQVEsQ0FBQyxDQUFFLENBQUM7SUFFaEcsSUFBSyxDQUFFL0QsbUJBQW1CLENBQUU5QixLQUFNLENBQUMsRUFBRztNQUNyQzRELG1CQUFtQixDQUFFNUQsS0FBTSxDQUFDO01BQzVCQSxLQUFLLENBQUNyQixJQUFJLENBQUUscURBQXNELENBQUMsQ0FBQ2UsSUFBSSxDQUFFLFVBQVUsRUFBRSxJQUFLLENBQUM7TUFDNUYsT0FBTzJDLGNBQWMsQ0FBRXBFLE1BQU0sQ0FBQzZILG9CQUFvQixJQUFJN0gsTUFBTSxDQUFDdUMsS0FBTSxDQUFDO0lBQ3JFO0lBRUEsT0FBT21DLGVBQWUsQ0FBRUMsT0FBTyxFQUFFLFlBQVk7TUFDNUMsT0FBT2tDLGtCQUFrQixDQUFFOUUsS0FBSyxFQUFFK0UsVUFBVyxDQUFDO0lBQy9DLENBQUUsQ0FBQyxDQUFDN0IsSUFBSSxDQUFFLFlBQVk7TUFDckIsSUFBSyxDQUFFNEIsa0JBQWtCLENBQUU5RSxLQUFLLEVBQUUrRSxVQUFXLENBQUMsRUFBRztRQUNoRCxPQUFPMUMsY0FBYyxDQUFFLEVBQUcsQ0FBQztNQUM1QjtNQUNBcUIsNkJBQTZCLENBQUMsQ0FBQztNQUMvQixJQUFLLFVBQVUsS0FBSzBCLEtBQUssRUFBRztRQUMzQm5CLDBCQUEwQixDQUFFakUsS0FBTSxDQUFDO01BQ3BDO0lBQ0QsQ0FBRSxDQUFDO0VBQ0o7O0VBRUE7RUFDQSxTQUFTK0YsYUFBYUEsQ0FBRS9GLEtBQUssRUFBRWMsV0FBVyxFQUFHO0lBQzVDLElBQUssQ0FBRWQsS0FBSyxJQUFJLENBQUVBLEtBQUssQ0FBQ3NCLE1BQU0sRUFBRztNQUNoQztJQUNEO0lBRUFSLFdBQVcsR0FBR3BDLE1BQU0sQ0FBRW9DLFdBQVcsSUFBSSxDQUFFLENBQUM7SUFDeEMsSUFBS0EsV0FBVyxFQUFHO01BQ2xCZCxLQUFLLENBQUNWLElBQUksQ0FBRSwyQkFBMkIsRUFBRXdCLFdBQVksQ0FBQztJQUN2RDtJQUVBLElBQUlrRixnQkFBZ0IsR0FBR2hHLEtBQUssQ0FBQ3lCLElBQUksQ0FBRSxnQ0FBaUMsQ0FBQztJQUNyRSxJQUFJc0QsVUFBVSxHQUFHckcsTUFBTSxDQUFFc0IsS0FBSyxDQUFDeUIsSUFBSSxDQUFFLG1DQUFvQyxDQUFDLElBQUksQ0FBRSxDQUFDLEdBQUcsQ0FBQztJQUNyRnpCLEtBQUssQ0FBQ3lCLElBQUksQ0FBRSxtQ0FBbUMsRUFBRXNELFVBQVcsQ0FBQztJQUM3RCxJQUFLaUIsZ0JBQWdCLElBQUlBLGdCQUFnQixDQUFDQyxVQUFVLEtBQUssQ0FBQyxFQUFHO01BQzVERCxnQkFBZ0IsQ0FBQ0UsS0FBSyxDQUFDLENBQUM7SUFDekI7SUFFQXRGLFdBQVcsQ0FBRVosS0FBTSxDQUFDO0lBQ3BCRCxXQUFXLENBQUVDLEtBQUssRUFBRSxJQUFLLENBQUM7SUFDMUIsSUFBSW1HLE9BQU8sR0FBR25JLENBQUMsQ0FBQ29JLElBQUksQ0FBRW5JLE1BQU0sQ0FBQ29JLFFBQVEsRUFBRTtNQUN0Q0MsTUFBTSxFQUFFckksTUFBTSxDQUFDcUksTUFBTTtNQUNyQkMsS0FBSyxFQUFFdEksTUFBTSxDQUFDc0ksS0FBSztNQUNuQkMsWUFBWSxFQUFFeEcsS0FBSyxDQUFDVixJQUFJLENBQUUsbUJBQW9CLENBQUMsSUFBSSxFQUFFO01BQ3JEd0IsV0FBVyxFQUFFQTtJQUNkLENBQUUsQ0FBQztJQUNIZCxLQUFLLENBQUN5QixJQUFJLENBQUUsZ0NBQWdDLEVBQUUwRSxPQUFRLENBQUM7SUFFdkRBLE9BQU8sQ0FBQ00sSUFBSSxDQUFFLFVBQVdDLFFBQVEsRUFBRztNQUNuQyxJQUFLLENBQUU1QixrQkFBa0IsQ0FBRTlFLEtBQUssRUFBRStFLFVBQVcsQ0FBQyxFQUFHO1FBQ2hEO01BQ0Q7TUFDQSxJQUFLLENBQUUyQixRQUFRLElBQUksQ0FBRUEsUUFBUSxDQUFDQyxPQUFPLElBQUksQ0FBRUQsUUFBUSxDQUFDakYsSUFBSSxFQUFHO1FBQzFEdEIsVUFBVSxDQUFFSCxLQUFLLEVBQUUwRyxRQUFRLElBQUlBLFFBQVEsQ0FBQ2pGLElBQUksSUFBSWlGLFFBQVEsQ0FBQ2pGLElBQUksQ0FBQ3JCLE9BQU8sR0FBR3NHLFFBQVEsQ0FBQ2pGLElBQUksQ0FBQ3JCLE9BQU8sR0FBR25DLE1BQU0sQ0FBQ3VDLEtBQU0sQ0FBQztRQUM5R3dFLGNBQWMsQ0FBRWhGLEtBQUssRUFBRStFLFVBQVcsQ0FBQztRQUNuQztNQUNEO01BRUEsSUFBSUssS0FBSyxHQUFHc0IsUUFBUSxDQUFDakYsSUFBSSxDQUFDMkQsS0FBSyxJQUFJLEVBQUU7TUFDckMsSUFBSXdCLFdBQVcsR0FBRzFCLGFBQWEsQ0FBRWxGLEtBQUssRUFBRTBHLFFBQVEsQ0FBQ2pGLElBQUksQ0FBQzBELElBQUksRUFBRUMsS0FBSyxFQUFFc0IsUUFBUSxDQUFDakYsSUFBSSxDQUFDWCxXQUFXLEVBQUVpRSxVQUFXLENBQUM7TUFDMUc2QixXQUFXLENBQUNILElBQUksQ0FBRSxZQUFZO1FBQzdCLElBQUssQ0FBRTNCLGtCQUFrQixDQUFFOUUsS0FBSyxFQUFFK0UsVUFBVyxDQUFDLEVBQUc7VUFDaEQ7UUFDRDtRQUNBLElBQUtyRyxNQUFNLENBQUVnSSxRQUFRLENBQUNqRixJQUFJLENBQUNYLFdBQVcsSUFBSSxDQUFFLENBQUMsRUFBRztVQUMvQ2QsS0FBSyxDQUFDVixJQUFJLENBQUUsMkJBQTJCLEVBQUVaLE1BQU0sQ0FBRWdJLFFBQVEsQ0FBQ2pGLElBQUksQ0FBQ1gsV0FBWSxDQUFFLENBQUM7UUFDL0U7UUFDQWtFLGNBQWMsQ0FBRWhGLEtBQUssRUFBRStFLFVBQVcsQ0FBQztRQUNuQ1YsV0FBVyxDQUFFckUsS0FBTSxDQUFDO01BQ3JCLENBQUUsQ0FBQyxDQUFDNkcsSUFBSSxDQUFFLFVBQVdyRyxLQUFLLEVBQUc7UUFDNUIsSUFBSyxDQUFFc0Usa0JBQWtCLENBQUU5RSxLQUFLLEVBQUUrRSxVQUFXLENBQUMsRUFBRztVQUNoRDtRQUNEO1FBQ0E1RSxVQUFVLENBQUVILEtBQUssRUFBRVEsS0FBSyxJQUFJQSxLQUFLLENBQUNpQyxZQUFZLEdBQUdqQyxLQUFLLENBQUNpQyxZQUFZLEdBQUt4RSxNQUFNLENBQUM2SCxvQkFBb0IsSUFBSTdILE1BQU0sQ0FBQ3VDLEtBQVEsQ0FBQztRQUN2SHdFLGNBQWMsQ0FBRWhGLEtBQUssRUFBRStFLFVBQVcsQ0FBQztNQUNwQyxDQUFFLENBQUM7SUFDSixDQUFFLENBQUMsQ0FBQzhCLElBQUksQ0FBRSxVQUFXQyxHQUFHLEVBQUVDLE1BQU0sRUFBRztNQUNsQyxJQUFLLE9BQU8sS0FBS0EsTUFBTSxJQUFJLENBQUVqQyxrQkFBa0IsQ0FBRTlFLEtBQUssRUFBRStFLFVBQVcsQ0FBQyxFQUFHO1FBQ3RFO01BQ0Q7TUFDQSxJQUFJMkIsUUFBUSxHQUFHSSxHQUFHLENBQUNFLFlBQVk7TUFDL0I3RyxVQUFVLENBQUVILEtBQUssRUFBRTBHLFFBQVEsSUFBSUEsUUFBUSxDQUFDakYsSUFBSSxJQUFJaUYsUUFBUSxDQUFDakYsSUFBSSxDQUFDckIsT0FBTyxHQUFHc0csUUFBUSxDQUFDakYsSUFBSSxDQUFDckIsT0FBTyxHQUFHbkMsTUFBTSxDQUFDdUMsS0FBTSxDQUFDO01BQzlHd0UsY0FBYyxDQUFFaEYsS0FBSyxFQUFFK0UsVUFBVyxDQUFDO0lBQ3BDLENBQUUsQ0FBQztFQUNKOztFQUVBO0VBQ0EvRyxDQUFDLENBQUVpRCxRQUFTLENBQUMsQ0FBQ2dHLEVBQUUsQ0FBRSxRQUFRLEVBQUUsaURBQWlELEVBQUUsVUFBV0MsS0FBSyxFQUFHO0lBQ2pHLElBQUssQ0FBRWpKLE1BQU0sQ0FBQ29JLFFBQVEsSUFBSSxDQUFFcEksTUFBTSxDQUFDcUksTUFBTSxFQUFHO01BQzNDO0lBQ0Q7SUFDQVksS0FBSyxDQUFDQyxjQUFjLENBQUMsQ0FBQztJQUN0QixJQUFJMUksS0FBSyxHQUFHVCxDQUFDLENBQUUsSUFBSyxDQUFDO0lBQ3JCK0gsYUFBYSxDQUFFdEgsS0FBSyxDQUFDMEYsT0FBTyxDQUFFLGlDQUFrQyxDQUFDLEVBQUUzRix3QkFBd0IsQ0FBRUMsS0FBTSxDQUFFLENBQUM7RUFDdkcsQ0FBRSxDQUFDOztFQUVIO0VBQ0FULENBQUMsQ0FBRWlELFFBQVMsQ0FBQyxDQUFDZ0csRUFBRSxDQUFFLFFBQVEsRUFBRSxpREFBaUQsRUFBRSxZQUFZO0lBQzFGLElBQUkvQyxNQUFNLEdBQUdsRyxDQUFDLENBQUUsSUFBSyxDQUFDO0lBQ3RCa0csTUFBTSxDQUFDQyxPQUFPLENBQUUsMENBQTJDLENBQUMsQ0FBQ3hGLElBQUksQ0FBRSx5Q0FBMEMsQ0FBQyxDQUFDZ0IsV0FBVyxDQUFFLGFBQWMsQ0FBQztJQUMzSXVFLE1BQU0sQ0FBQ0MsT0FBTyxDQUFFLHlDQUEwQyxDQUFDLENBQUNDLFFBQVEsQ0FBRSxhQUFjLENBQUM7RUFDdEYsQ0FBRSxDQUFDOztFQUVIO0VBQ0FwRyxDQUFDLENBQUVpRCxRQUFTLENBQUMsQ0FBQ2dHLEVBQUUsQ0FBRSxPQUFPLEVBQUUsb0VBQW9FLEVBQUUsWUFBWTtJQUM1R25JLHVCQUF1QixDQUFFZCxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNtRyxPQUFPLENBQUUsOEJBQStCLENBQUUsQ0FBQztFQUMvRSxDQUFFLENBQUM7O0VBRUg7RUFDQW5HLENBQUMsQ0FBRWlELFFBQVMsQ0FBQyxDQUFDZ0csRUFBRSxDQUFFLE9BQU8sRUFBRSxtRkFBbUYsRUFBRSxVQUFXQyxLQUFLLEVBQUc7SUFDbEksSUFBSyxDQUFFakosTUFBTSxDQUFDb0ksUUFBUSxJQUFJLENBQUVwSSxNQUFNLENBQUNxSSxNQUFNLEVBQUc7TUFDM0M7SUFDRDtJQUNBWSxLQUFLLENBQUNDLGNBQWMsQ0FBQyxDQUFDO0lBQ3RCLElBQUluSCxLQUFLLEdBQUdoQyxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNtRyxPQUFPLENBQUUsaUNBQWtDLENBQUM7SUFDbEUsSUFBS25FLEtBQUssQ0FBQ29ILFFBQVEsQ0FBRSxZQUFhLENBQUMsRUFBRztNQUNyQztJQUNEO0lBQ0FyQixhQUFhLENBQUUvRixLQUFLLEVBQUUsQ0FBRSxDQUFDO0VBQzFCLENBQUUsQ0FBQzs7RUFFSDtFQUNBaEMsQ0FBQyxDQUFFLE1BQU8sQ0FBQyxDQUFDaUosRUFBRSxDQUFFLDJEQUEyRCxFQUFFLFVBQVdDLEtBQUssRUFBRXBHLFdBQVcsRUFBRXVHLE1BQU0sRUFBRztJQUNwSCxJQUFJdEcsT0FBTyxHQUFHRixrQkFBa0IsQ0FBRUMsV0FBWSxDQUFDO0lBQy9DLElBQUssQ0FBRUMsT0FBTyxJQUFJLENBQUVzRyxNQUFNLEVBQUc7TUFDNUI7SUFDRDtJQUNBQSxNQUFNLENBQUNDLDBCQUEwQixHQUFHLENBQUM7SUFDckNELE1BQU0sQ0FBQ0UsK0JBQStCLEdBQUd4RyxPQUFPLENBQUNXLGFBQWE7SUFDOUQyRixNQUFNLENBQUMxRixVQUFVLEdBQUdaLE9BQU8sQ0FBQ1ksVUFBVTtFQUN2QyxDQUFFLENBQUM7RUFFSDNELENBQUMsQ0FBRSxZQUFZO0lBQ2RBLENBQUMsQ0FBRSxpQ0FBa0MsQ0FBQyxDQUFDSyxJQUFJLENBQUUsWUFBWTtNQUN4RCxJQUFJMkIsS0FBSyxHQUFHaEMsQ0FBQyxDQUFFLElBQUssQ0FBQztNQUNyQixJQUFJd0QsT0FBTyxHQUFHeEIsS0FBSyxDQUFDckIsSUFBSSxDQUFFLDhDQUErQyxDQUFDLENBQUNDLEtBQUssQ0FBQyxDQUFDO01BQ2xGLElBQUs0QyxPQUFPLENBQUNGLE1BQU0sRUFBRztRQUNyQnRCLEtBQUssQ0FBQ1YsSUFBSSxDQUFFLDJCQUEyQixFQUFFWixNQUFNLENBQUU4QyxPQUFPLENBQUNDLElBQUksQ0FBRSxhQUFjLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztNQUN4RjtNQUNBLElBQUkrRixTQUFTLEdBQUdoRyxPQUFPLENBQUNGLE1BQU0sSUFBSUYsMkJBQTJCLENBQUVwQixLQUFLLEVBQUV0QixNQUFNLENBQUU4QyxPQUFPLENBQUNDLElBQUksQ0FBRSxhQUFjLENBQUMsSUFBSSxDQUFFLENBQUUsQ0FBQztNQUNwSCxJQUFLK0YsU0FBUyxJQUFJLENBQUUxRixtQkFBbUIsQ0FBRTlCLEtBQU0sQ0FBQyxFQUFHO1FBQ2xENEQsbUJBQW1CLENBQUU1RCxLQUFNLENBQUM7UUFDNUJBLEtBQUssQ0FBQ3JCLElBQUksQ0FBRSxxREFBc0QsQ0FBQyxDQUFDZSxJQUFJLENBQUUsVUFBVSxFQUFFLElBQUssQ0FBQztRQUM1RlMsVUFBVSxDQUFFSCxLQUFLLEVBQUV3SCxTQUFTLEdBQUd2SixNQUFNLENBQUNvSCxrQkFBa0IsR0FBR3BILE1BQU0sQ0FBQzZILG9CQUFxQixDQUFDO01BQ3pGO0lBQ0QsQ0FBRSxDQUFDO0VBQ0osQ0FBRSxDQUFDO0FBQ0osQ0FBQyxFQUFJL0gsTUFBTSxFQUFFMEosTUFBTyxDQUFDIiwiaWdub3JlTGlzdCI6W119
