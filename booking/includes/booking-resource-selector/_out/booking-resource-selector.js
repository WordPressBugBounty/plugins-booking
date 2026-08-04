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

  /** Toggle one selector loading state without clearing its current stage. */
  function set_loading($root, is_loading) {
    $root.toggleClass('is-loading', is_loading).attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_resource_selector__stage').attr('aria-busy', is_loading ? 'true' : 'false');
    $root.find('> .wpbc_booking_resource_selector__loading').prop('hidden', !is_loading).attr('aria-hidden', is_loading ? 'false' : 'true');
    $root.find('.wpbc_booking_resource_selector__selection_form :input').prop('disabled', is_loading);
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvYm9va2luZy1yZXNvdXJjZS1zZWxlY3Rvci9fb3V0L2Jvb2tpbmctcmVzb3VyY2Utc2VsZWN0b3IuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCIkIiwiY29uZmlnIiwid3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX2NvbmZpZyIsImFjdGl2ZV9uYXRpdmVfY29udGV4dHMiLCJsb2FkZWRfc2NyaXB0X3VybHMiLCJlYWNoIiwiU3RyaW5nIiwic3JjIiwiZ2V0X3NlbGVjdGVkX3Jlc291cmNlX2lkIiwiJGZvcm0iLCJOdW1iZXIiLCJmaW5kIiwiZmlyc3QiLCJ2YWwiLCJzZXRfbG9hZGluZyIsIiRyb290IiwiaXNfbG9hZGluZyIsInRvZ2dsZUNsYXNzIiwiYXR0ciIsInByb3AiLCJzaG93X2Vycm9yIiwibWVzc2FnZSIsIiRub3RpY2UiLCJlbXB0eSIsImFwcGVuZCIsInRleHQiLCJlcnJvciIsImdldCIsImZvY3VzIiwidHJpZ2dlciIsImNsZWFyX2Vycm9yIiwiZ2V0X25hdGl2ZV9jb250ZXh0IiwicmVzb3VyY2VfaWQiLCJjb250ZXh0IiwiZWxlbWVudCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50IiwiY29udGFpbnMiLCJoYXNfZHVwbGljYXRlX3Jlc291cmNlX2Zvcm0iLCJmaWx0ZXIiLCJsZW5ndGgiLCJyZWdpc3Rlcl9uYXRpdmVfZm9ybSIsIiRuYXRpdmUiLCJkYXRhIiwiY29udGV4dF90b2tlbiIsImFsbG93X3Bhc3QiLCJleGlzdGluZyIsInVucmVnaXN0ZXJfbmF0aXZlX2Zvcm0iLCJwcmVwYXJlX25hdGl2ZV9mb3JtIiwiJHNjb3BlIiwiZ2V0X2Fic29sdXRlX3NjcmlwdF91cmwiLCJ1cmwiLCJhbmNob3IiLCJjcmVhdGVFbGVtZW50IiwiaHJlZiIsInJlamVjdGVkX3N0YWdlIiwiZGVmZXJyZWQiLCJEZWZlcnJlZCIsInJlamVjdCIsIndwYmNfbWVzc2FnZSIsInByb21pc2UiLCJleGVjdXRlX3NjcmlwdHMiLCJzY3JpcHRzIiwib3duc19zdGFnZSIsInNlcXVlbmNlIiwicmVzb2x2ZSIsImluZGV4Iiwic2NyaXB0IiwidGhlbiIsImFic29sdXRlX3VybCIsInVuZGVmaW5lZCIsImFqYXgiLCJkYXRhVHlwZSIsImNhY2hlIiwiY29kZSIsImdsb2JhbEV2YWwiLCJpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scyIsIndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMiLCJjbGVhbnVwX25hdGl2ZV9mb3JtIiwiJGNhbGVuZGFyIiwiZGF0ZXBpY2siLCJpbnN0YW5jZSIsIl9nZXRJbnN0IiwicmVtb3ZlQ2xhc3MiLCJyZXN0b3JlX3Jlc291cmNlX3NlbGVjdGlvbiIsIiRpbnB1dCIsImNsb3Nlc3QiLCJhZGRDbGFzcyIsImZvY3VzX3N0YWdlIiwiJHRhcmdldCIsInByZXZlbnRTY3JvbGwiLCJzY3JvbGxJbnRvVmlldyIsInJlZHVjZV9tb3Rpb24iLCJtYXRjaE1lZGlhIiwibWF0Y2hlcyIsImJlaGF2aW9yIiwiYmxvY2siLCJpc19jdXJyZW50X3JlcXVlc3QiLCJyZXF1ZXN0X2lkIiwiZmluaXNoX3JlcXVlc3QiLCJyZW1vdmVEYXRhIiwicmVwbGFjZV9zdGFnZSIsImh0bWwiLCJzdGFnZSIsImR1cGxpY2F0ZV9yZXNvdXJjZSIsInBhcnNlZCIsInBhcnNlSFRNTCIsIiRjb250YWluZXIiLCJhZGRCYWNrIiwicHVzaCIsInRleHRDb250ZW50IiwicmVtb3ZlIiwiY29udGVudHMiLCJpbml0aWFsaXphdGlvbl9lcnJvciIsInJlc29sdmVfc3RhZ2UiLCJwcmV2aW91c19yZXF1ZXN0IiwicmVhZHlTdGF0ZSIsImFib3J0IiwicmVxdWVzdCIsInBvc3QiLCJhamF4X3VybCIsImFjdGlvbiIsIm5vbmNlIiwiY29uZmlnX3Rva2VuIiwiZG9uZSIsInJlc3BvbnNlIiwic3VjY2VzcyIsInJlcGxhY2VtZW50IiwiZmFpbCIsInhociIsInN0YXR1cyIsInJlc3BvbnNlSlNPTiIsIm9uIiwiZXZlbnQiLCJwcmV2ZW50RGVmYXVsdCIsImhhc0NsYXNzIiwicGFyYW1zIiwicmVzb3VyY2Vfc2VsZWN0b3JfcmVxdWlyZWQiLCJyZXNvdXJjZV9zZWxlY3Rvcl9jb250ZXh0X3Rva2VuIiwiZHVwbGljYXRlIiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvYm9va2luZy1yZXNvdXJjZS1zZWxlY3Rvci9fc3JjL2Jvb2tpbmctcmVzb3VyY2Utc2VsZWN0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiKCBmdW5jdGlvbiAoIHdpbmRvdywgJCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBjb25maWcgPSB3aW5kb3cud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX2NvbmZpZyB8fCB7fTtcblx0dmFyIGFjdGl2ZV9uYXRpdmVfY29udGV4dHMgPSB7fTtcblx0dmFyIGxvYWRlZF9zY3JpcHRfdXJscyA9IHt9O1xuXG5cdCQoICdzY3JpcHRbc3JjXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0bG9hZGVkX3NjcmlwdF91cmxzWyBTdHJpbmcoIHRoaXMuc3JjIHx8ICcnICkgXSA9IHRydWU7XG5cdH0gKTtcblxuXHQvKiogUmV0dXJuIGEgbm9ybWFsaXplZCBCb29raW5nIFJlc291cmNlIElEIGZyb20gYSBzZWxlY3Rpb24gZm9ybS4gKi9cblx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGVkX3Jlc291cmNlX2lkKCAkZm9ybSApIHtcblx0XHRyZXR1cm4gTnVtYmVyKCAkZm9ybS5maW5kKCAnW25hbWU9XCJ3cGJjX3Jlc291cmNlX3NlbGVjdG9yX3Jlc291cmNlXCJdOmNoZWNrZWQnICkuZmlyc3QoKS52YWwoKSB8fCAwICk7XG5cdH1cblxuXHQvKiogVG9nZ2xlIG9uZSBzZWxlY3RvciBsb2FkaW5nIHN0YXRlIHdpdGhvdXQgY2xlYXJpbmcgaXRzIGN1cnJlbnQgc3RhZ2UuICovXG5cdGZ1bmN0aW9uIHNldF9sb2FkaW5nKCAkcm9vdCwgaXNfbG9hZGluZyApIHtcblx0XHQkcm9vdC50b2dnbGVDbGFzcyggJ2lzLWxvYWRpbmcnLCBpc19sb2FkaW5nICkuYXR0ciggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fc3RhZ2UnICkuYXR0ciggJ2FyaWEtYnVzeScsIGlzX2xvYWRpbmcgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fbG9hZGluZycgKS5wcm9wKCAnaGlkZGVuJywgISBpc19sb2FkaW5nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNfbG9hZGluZyA/ICdmYWxzZScgOiAndHJ1ZScgKTtcblx0XHQkcm9vdC5maW5kKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fc2VsZWN0aW9uX2Zvcm0gOmlucHV0JyApLnByb3AoICdkaXNhYmxlZCcsIGlzX2xvYWRpbmcgKTtcblx0fVxuXG5cdC8qKiBEaXNwbGF5IGFuZCBmb2N1cyBvbmUgY29udHJvbGxlZCBBSkFYIG9yIGluaXRpYWxpemF0aW9uIGVycm9yLiAqL1xuXHRmdW5jdGlvbiBzaG93X2Vycm9yKCAkcm9vdCwgbWVzc2FnZSApIHtcblx0XHR2YXIgJG5vdGljZSA9ICRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2FqYXhfbm90aWNlJyApO1xuXHRcdCRub3RpY2UuZW1wdHkoKS5hcHBlbmQoICQoICc8c3Bhbj4nICkudGV4dCggbWVzc2FnZSB8fCBjb25maWcuZXJyb3IgfHwgJ1VuYWJsZSB0byBsb2FkIHRoZSBib29raW5nIGZvcm0uJyApICkucHJvcCggJ2hpZGRlbicsIGZhbHNlICk7XG5cdFx0aWYgKCAkbm90aWNlLmdldCggMCApICYmIHR5cGVvZiAkbm90aWNlLmdldCggMCApLmZvY3VzID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0JG5vdGljZS50cmlnZ2VyKCAnZm9jdXMnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqIENsZWFyIHRoZSBzZWxlY3RvciBBSkFYIGVycm9yLiAqL1xuXHRmdW5jdGlvbiBjbGVhcl9lcnJvciggJHJvb3QgKSB7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fYWpheF9ub3RpY2UnICkuZW1wdHkoKS5wcm9wKCAnaGlkZGVuJywgdHJ1ZSApO1xuXHR9XG5cblx0LyoqIFJldHVybiBhIHJlZ2lzdGVyZWQgY29udGV4dCBvbmx5IHdoaWxlIGl0cyBuYXRpdmUgZm9ybSByZW1haW5zIGxpdmUuICovXG5cdGZ1bmN0aW9uIGdldF9uYXRpdmVfY29udGV4dCggcmVzb3VyY2VfaWQgKSB7XG5cdFx0cmVzb3VyY2VfaWQgPSBOdW1iZXIoIHJlc291cmNlX2lkIHx8IDAgKTtcblx0XHR2YXIgY29udGV4dCA9IGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHJlc291cmNlX2lkIF07XG5cdFx0aWYgKCAhIGNvbnRleHQgfHwgISBjb250ZXh0LmVsZW1lbnQgfHwgISBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoIGNvbnRleHQuZWxlbWVudCApICkge1xuXHRcdFx0ZGVsZXRlIGFjdGl2ZV9uYXRpdmVfY29udGV4dHNbIHJlc291cmNlX2lkIF07XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRleHQ7XG5cdH1cblxuXHQvKiogRGV0ZWN0IGFueSBvdGhlciBsaXZlIG5hdGl2ZSBCb29raW5nIENhbGVuZGFyIGZvcm0gZm9yIHRoZSBzYW1lIHJlc291cmNlLiAqL1xuXHRmdW5jdGlvbiBoYXNfZHVwbGljYXRlX3Jlc291cmNlX2Zvcm0oICRyb290LCByZXNvdXJjZV9pZCApIHtcblx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWQgfHwgMCApO1xuXHRcdGlmICggISByZXNvdXJjZV9pZCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR2YXIgY29udGV4dCA9IGdldF9uYXRpdmVfY29udGV4dCggcmVzb3VyY2VfaWQgKTtcblx0XHRpZiAoIGNvbnRleHQgJiYgISAkLmNvbnRhaW5zKCAkcm9vdC5nZXQoIDAgKSwgY29udGV4dC5lbGVtZW50ICkgKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gJCggJ1tpZD1cImJvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICdcIl0nICkuZmlsdGVyKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gISAkLmNvbnRhaW5zKCAkcm9vdC5nZXQoIDAgKSwgdGhpcyApO1xuXHRcdH0gKS5sZW5ndGggPiAwO1xuXHR9XG5cblx0LyoqIFJlZ2lzdGVyIHRoZSBzaWduZWQgcmVzb3VyY2UgY29udGV4dCB1c2VkIGJ5IGZpbmFsIGJvb2tpbmcgc3VibWlzc2lvbi4gKi9cblx0ZnVuY3Rpb24gcmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKSB7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdyZXNvdXJjZS1pZCcgKSB8fCAwICk7XG5cdFx0dmFyIGNvbnRleHRfdG9rZW4gPSBTdHJpbmcoICRuYXRpdmUuYXR0ciggJ2RhdGEtcmVzb3VyY2Utc2VsZWN0b3ItY29udGV4dC10b2tlbicgKSB8fCAnJyApO1xuXHRcdHZhciBhbGxvd19wYXN0ID0gJzEnID09PSBTdHJpbmcoICRuYXRpdmUuYXR0ciggJ2RhdGEtYWxsb3ctcGFzdCcgKSB8fCAnMCcgKSA/IDEgOiAwO1xuXHRcdHZhciBleGlzdGluZyA9IGdldF9uYXRpdmVfY29udGV4dCggcmVzb3VyY2VfaWQgKTtcblxuXHRcdGlmICggISByZXNvdXJjZV9pZCB8fCAhIGNvbnRleHRfdG9rZW4gKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICggZXhpc3RpbmcgJiYgZXhpc3RpbmcuZWxlbWVudCAhPT0gJG5hdGl2ZS5nZXQoIDAgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRhY3RpdmVfbmF0aXZlX2NvbnRleHRzWyByZXNvdXJjZV9pZCBdID0ge1xuXHRcdFx0ZWxlbWVudDogJG5hdGl2ZS5nZXQoIDAgKSxcblx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcblx0XHRcdGNvbnRleHRfdG9rZW46IGNvbnRleHRfdG9rZW4sXG5cdFx0XHRhbGxvd19wYXN0OiBhbGxvd19wYXN0XG5cdFx0fTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKiBSZW1vdmUgb25lIG5hdGl2ZSBmb3JtIGZyb20gdGhlIGxvY2FsIHN1Ym1pc3Npb24gcmVnaXN0cnkuICovXG5cdGZ1bmN0aW9uIHVucmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKSB7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCAkbmF0aXZlLmRhdGEoICdyZXNvdXJjZS1pZCcgKSB8fCAwICk7XG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfbmF0aXZlX2NvbnRleHQoIHJlc291cmNlX2lkICk7XG5cdFx0aWYgKCBjb250ZXh0ICYmIGNvbnRleHQuZWxlbWVudCA9PT0gJG5hdGl2ZS5nZXQoIDAgKSApIHtcblx0XHRcdGRlbGV0ZSBhY3RpdmVfbmF0aXZlX2NvbnRleHRzWyByZXNvdXJjZV9pZCBdO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBQcmVwYXJlIGEgbmV3bHkgaW5zZXJ0ZWQgbmF0aXZlIGZvcm0gZm9yIHJlc291cmNlLWJvdW5kIHN1Ym1pc3Npb24uICovXG5cdGZ1bmN0aW9uIHByZXBhcmVfbmF0aXZlX2Zvcm0oICRzY29wZSApIHtcblx0XHR2YXIgJG5hdGl2ZSA9ICRzY29wZS5maW5kKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fbmF0aXZlX2Zvcm0nICkuZmlyc3QoKTtcblx0XHRpZiAoICEgJG5hdGl2ZS5sZW5ndGggKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKTtcblx0fVxuXG5cdC8qKiBDb252ZXJ0IGEgc2NyaXB0IFVSTCB0byB0aGUgc2FtZSBhYnNvbHV0ZSBmb3JtIHVzZWQgYnkgc2NyaXB0IGVsZW1lbnRzLiAqL1xuXHRmdW5jdGlvbiBnZXRfYWJzb2x1dGVfc2NyaXB0X3VybCggdXJsICkge1xuXHRcdHZhciBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnYScgKTtcblx0XHRhbmNob3IuaHJlZiA9IFN0cmluZyggdXJsIHx8ICcnICk7XG5cdFx0cmV0dXJuIGFuY2hvci5ocmVmO1xuXHR9XG5cblx0LyoqIFJldHVybiBhIHJlamVjdGVkIHByb21pc2UgY2Fycnlpbmcgb25lIGNvbnRyb2xsZWQgbWVzc2FnZS4gKi9cblx0ZnVuY3Rpb24gcmVqZWN0ZWRfc3RhZ2UoIG1lc3NhZ2UgKSB7XG5cdFx0dmFyIGRlZmVycmVkID0gJC5EZWZlcnJlZCgpO1xuXHRcdGRlZmVycmVkLnJlamVjdCggeyB3cGJjX21lc3NhZ2U6IG1lc3NhZ2UgfSApO1xuXHRcdHJldHVybiBkZWZlcnJlZC5wcm9taXNlKCk7XG5cdH1cblxuXHQvKiogRXhlY3V0ZSByZW5kZXJlciBzY3JpcHRzIHNlcXVlbnRpYWxseSB3aGlsZSB0aGUgcmVxdWVzdCBvd25zIHRoZSBzdGFnZS4gKi9cblx0ZnVuY3Rpb24gZXhlY3V0ZV9zY3JpcHRzKCBzY3JpcHRzLCBvd25zX3N0YWdlICkge1xuXHRcdHZhciBzZXF1ZW5jZSA9ICQuRGVmZXJyZWQoKS5yZXNvbHZlKCkucHJvbWlzZSgpO1xuXG5cdFx0JC5lYWNoKCBzY3JpcHRzLCBmdW5jdGlvbiAoIGluZGV4LCBzY3JpcHQgKSB7XG5cdFx0XHRzZXF1ZW5jZSA9IHNlcXVlbmNlLnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0aWYgKCAhIG93bnNfc3RhZ2UoKSApIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCBzY3JpcHQuc3JjICkge1xuXHRcdFx0XHRcdHZhciBhYnNvbHV0ZV91cmwgPSBnZXRfYWJzb2x1dGVfc2NyaXB0X3VybCggc2NyaXB0LnNyYyApO1xuXHRcdFx0XHRcdGlmICggbG9hZGVkX3NjcmlwdF91cmxzWyBhYnNvbHV0ZV91cmwgXSApIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiAkLmFqYXgoIHsgdXJsOiBhYnNvbHV0ZV91cmwsIGRhdGFUeXBlOiAnc2NyaXB0JywgY2FjaGU6IHRydWUgfSApLnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdGxvYWRlZF9zY3JpcHRfdXJsc1sgYWJzb2x1dGVfdXJsIF0gPSB0cnVlO1xuXHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHNjcmlwdC5jb2RlICkge1xuXHRcdFx0XHRcdCQuZ2xvYmFsRXZhbCggc2NyaXB0LmNvZGUgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSApO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBzZXF1ZW5jZTtcblx0fVxuXG5cdC8qKiBJbml0aWFsaXplIG5hdGl2ZSBjb250cm9scyB3aG9zZSBjb3JlIGhhbmRsZXJzIGJpbmQgb24gZG9jdW1lbnQgcmVhZHkuICovXG5cdGZ1bmN0aW9uIGluaXRpYWxpemVfYWpheF9mb3JtX2NvbnRyb2xzKCkge1xuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2hvb2tfX2luaXRfYm9va2luZ19mb3JtX3dpemFyZF9idXR0b25zID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0d2luZG93LndwYmNfaG9va19faW5pdF9ib29raW5nX2Zvcm1fd2l6YXJkX2J1dHRvbnMoKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRGVzdHJveSBuYXRpdmUgY2FsZW5kYXJzIGFuZCB1bnJlZ2lzdGVyIGNvbnRleHQgYmVmb3JlIHN0YWdlIHJlbW92YWwuICovXG5cdGZ1bmN0aW9uIGNsZWFudXBfbmF0aXZlX2Zvcm0oICRyb290ICkge1xuXHRcdCRyb290LmZpbmQoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19uYXRpdmVfZm9ybScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJG5hdGl2ZSA9ICQoIHRoaXMgKTtcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggJG5hdGl2ZS5kYXRhKCAncmVzb3VyY2UtaWQnICkgfHwgMCApO1xuXHRcdFx0dmFyICRjYWxlbmRhciA9ICRuYXRpdmUuZmluZCggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICk7XG5cblx0XHRcdHVucmVnaXN0ZXJfbmF0aXZlX2Zvcm0oICRuYXRpdmUgKTtcblx0XHRcdGlmICggISByZXNvdXJjZV9pZCB8fCAhICRjYWxlbmRhci5sZW5ndGggfHwgISAkLmRhdGVwaWNrIHx8IHR5cGVvZiAkY2FsZW5kYXIuZGF0ZXBpY2sgIT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIGluc3RhbmNlID0gdHlwZW9mICQuZGF0ZXBpY2suX2dldEluc3QgPT09ICdmdW5jdGlvbicgPyAkLmRhdGVwaWNrLl9nZXRJbnN0KCAkY2FsZW5kYXIuZ2V0KCAwICkgKSA6IG51bGw7XG5cdFx0XHRcdGlmICggaW5zdGFuY2UgKSB7XG5cdFx0XHRcdFx0JGNhbGVuZGFyLmRhdGVwaWNrKCAnZGVzdHJveScgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xuXHRcdFx0XHQkY2FsZW5kYXIucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKiogUmVzdG9yZSB0aGUgY29uZmlndXJlZCBpbml0aWFsIFJlc291cmNlIGNob2ljZSBhZnRlciBTdGFydCBvdmVyLiAqL1xuXHRmdW5jdGlvbiByZXN0b3JlX3Jlc291cmNlX3NlbGVjdGlvbiggJHJvb3QgKSB7XG5cdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCAkcm9vdC5hdHRyKCAnZGF0YS1zZWxlY3RlZC1yZXNvdXJjZS1pZCcgKSB8fCAwICk7XG5cdFx0aWYgKCAhIHJlc291cmNlX2lkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgJGlucHV0ID0gJHJvb3QuZmluZCggJ1tuYW1lPVwid3BiY19yZXNvdXJjZV9zZWxlY3Rvcl9yZXNvdXJjZVwiXVt2YWx1ZT1cIicgKyByZXNvdXJjZV9pZCArICdcIl0nICkuZmlyc3QoKTtcblx0XHRpZiAoICRpbnB1dC5sZW5ndGggKSB7XG5cdFx0XHQkaW5wdXQuY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2Nob2ljZXMnICkuZmluZCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2Nob2ljZScgKS5yZW1vdmVDbGFzcyggJ2lzLXNlbGVjdGVkJyApO1xuXHRcdFx0JGlucHV0LnByb3AoICdjaGVja2VkJywgdHJ1ZSApLmNsb3Nlc3QoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19jaG9pY2UnICkuYWRkQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHR9XG5cdH1cblxuXHQvKiogRm9jdXMgdGhlIG5ldyBzdGFnZSBoZWFkaW5nIGFuZCBrZWVwIHRoZSBjb21wb25lbnQgbmVhciB0aGUgdmlld3BvcnQuICovXG5cdGZ1bmN0aW9uIGZvY3VzX3N0YWdlKCAkcm9vdCApIHtcblx0XHR2YXIgJHRhcmdldCA9ICRyb290LmZpbmQoICc+IC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX3N0YWdlIC53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2hlYWRpbmcgaDMsID4gLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fc3RhZ2UgLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fbm90aWNlJyApLmZpcnN0KCk7XG5cdFx0aWYgKCAkdGFyZ2V0Lmxlbmd0aCApIHtcblx0XHRcdCR0YXJnZXQuYXR0ciggJ3RhYmluZGV4JywgJy0xJyApO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0JHRhcmdldC5nZXQoIDAgKS5mb2N1cyggeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0gKTtcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcblx0XHRcdFx0JHRhcmdldC50cmlnZ2VyKCAnZm9jdXMnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCAkcm9vdC5nZXQoIDAgKSAmJiB0eXBlb2YgJHJvb3QuZ2V0KCAwICkuc2Nyb2xsSW50b1ZpZXcgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHR2YXIgcmVkdWNlX21vdGlvbiA9IHdpbmRvdy5tYXRjaE1lZGlhICYmIHdpbmRvdy5tYXRjaE1lZGlhKCAnKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246IHJlZHVjZSknICkubWF0Y2hlcztcblx0XHRcdCRyb290LmdldCggMCApLnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiByZWR1Y2VfbW90aW9uID8gJ2F1dG8nIDogJ3Ntb290aCcsIGJsb2NrOiAnbmVhcmVzdCcgfSApO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBEZXRlcm1pbmUgd2hldGhlciBhbiBBSkFYIGNhbGxiYWNrIHN0aWxsIG93bnMgdGhlIGNvbXBvbmVudCBzdGF0ZS4gKi9cblx0ZnVuY3Rpb24gaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApIHtcblx0XHRyZXR1cm4gTnVtYmVyKCAkcm9vdC5kYXRhKCAnd3BiYy1yZXNvdXJjZS1zZWxlY3Rvci1yZXF1ZXN0LWlkJyApIHx8IDAgKSA9PT0gTnVtYmVyKCByZXF1ZXN0X2lkICk7XG5cdH1cblxuXHQvKiogRmluaXNoIG9ubHkgdGhlIGN1cnJlbnQgcmVxdWVzdCBzbyBzdGFsZSBjYWxsYmFja3MgY2Fubm90IGFsdGVyIHRoZSBVSS4gKi9cblx0ZnVuY3Rpb24gZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkge1xuXHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdCRyb290LnJlbW92ZURhdGEoICd3cGJjLXJlc291cmNlLXNlbGVjdG9yLXJlcXVlc3QnICk7XG5cdFx0c2V0X2xvYWRpbmcoICRyb290LCBmYWxzZSApO1xuXHR9XG5cblx0LyoqIFJlcGxhY2UgYSBjb21wbGV0ZSBzdGFnZSB3aXRoIERPTS1iZWZvcmUtc2NyaXB0IGluaXRpYWxpemF0aW9uIG9yZGVyaW5nLiAqL1xuXHRmdW5jdGlvbiByZXBsYWNlX3N0YWdlKCAkcm9vdCwgaHRtbCwgc3RhZ2UsIHJlc291cmNlX2lkLCByZXF1ZXN0X2lkICkge1xuXHRcdGlmICggISBpc19jdXJyZW50X3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICkgKSB7XG5cdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoICcnICk7XG5cdFx0fVxuXHRcdGlmICggJ2Jvb2tpbmcnID09PSBzdGFnZSAmJiBoYXNfZHVwbGljYXRlX3Jlc291cmNlX2Zvcm0oICRyb290LCByZXNvdXJjZV9pZCApICkge1xuXHRcdFx0cmV0dXJuIHJlamVjdGVkX3N0YWdlKCBjb25maWcuZHVwbGljYXRlX3Jlc291cmNlICk7XG5cdFx0fVxuXG5cdFx0dmFyIHBhcnNlZCA9ICQucGFyc2VIVE1MKCBTdHJpbmcoIGh0bWwgfHwgJycgKSwgZG9jdW1lbnQsIHRydWUgKSB8fCBbXTtcblx0XHR2YXIgc2NyaXB0cyA9IFtdO1xuXHRcdHZhciAkY29udGFpbmVyID0gJCggJzxkaXY+JyApLmFwcGVuZCggcGFyc2VkICk7XG5cblx0XHQkY29udGFpbmVyLmZpbmQoICdzY3JpcHQnICkuYWRkQmFjayggJ3NjcmlwdCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzY3JpcHRzLnB1c2goIHsgc3JjOiB0aGlzLnNyYyB8fCAnJywgY29kZTogdGhpcy5zcmMgPyAnJyA6ICggdGhpcy50ZXh0IHx8IHRoaXMudGV4dENvbnRlbnQgfHwgJycgKSB9ICk7XG5cdFx0XHQkKCB0aGlzICkucmVtb3ZlKCk7XG5cdFx0fSApO1xuXG5cdFx0Y2xlYW51cF9uYXRpdmVfZm9ybSggJHJvb3QgKTtcblx0XHQkcm9vdC5hdHRyKCAnZGF0YS1yZXNvdXJjZS1zZWxlY3Rvci1zdGFnZScsIHN0YWdlICk7XG5cdFx0JHJvb3QuZmluZCggJz4gLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3Rvcl9fc3RhZ2UnICkuZW1wdHkoKS5hcHBlbmQoICRjb250YWluZXIuY29udGVudHMoKSApO1xuXG5cdFx0aWYgKCAhIHByZXBhcmVfbmF0aXZlX2Zvcm0oICRyb290ICkgKSB7XG5cdFx0XHRjbGVhbnVwX25hdGl2ZV9mb3JtKCAkcm9vdCApO1xuXHRcdFx0JHJvb3QuZmluZCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX25hdGl2ZV9mb3JtIDppbnB1dCcgKS5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICk7XG5cdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoIGNvbmZpZy5pbml0aWFsaXphdGlvbl9lcnJvciB8fCBjb25maWcuZXJyb3IgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZXhlY3V0ZV9zY3JpcHRzKCBzY3JpcHRzLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdH0gKS50aGVuKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRyZXR1cm4gcmVqZWN0ZWRfc3RhZ2UoICcnICk7XG5cdFx0XHR9XG5cdFx0XHRpbml0aWFsaXplX2FqYXhfZm9ybV9jb250cm9scygpO1xuXHRcdFx0aWYgKCAncmVzb3VyY2UnID09PSBzdGFnZSApIHtcblx0XHRcdFx0cmVzdG9yZV9yZXNvdXJjZV9zZWxlY3Rpb24oICRyb290ICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIFJlcXVlc3QgYW5kIHJlbmRlciB0aGUgbmV4dCBCb29raW5nIFJlc291cmNlIHNlbGVjdG9yIHN0YWdlLiAqL1xuXHRmdW5jdGlvbiByZXNvbHZlX3N0YWdlKCAkcm9vdCwgcmVzb3VyY2VfaWQgKSB7XG5cdFx0aWYgKCAhICRyb290IHx8ICEgJHJvb3QubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZV9pZCB8fCAwICk7XG5cdFx0aWYgKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdCRyb290LmF0dHIoICdkYXRhLXNlbGVjdGVkLXJlc291cmNlLWlkJywgcmVzb3VyY2VfaWQgKTtcblx0XHR9XG5cblx0XHR2YXIgcHJldmlvdXNfcmVxdWVzdCA9ICRyb290LmRhdGEoICd3cGJjLXJlc291cmNlLXNlbGVjdG9yLXJlcXVlc3QnICk7XG5cdFx0dmFyIHJlcXVlc3RfaWQgPSBOdW1iZXIoICRyb290LmRhdGEoICd3cGJjLXJlc291cmNlLXNlbGVjdG9yLXJlcXVlc3QtaWQnICkgfHwgMCApICsgMTtcblx0XHQkcm9vdC5kYXRhKCAnd3BiYy1yZXNvdXJjZS1zZWxlY3Rvci1yZXF1ZXN0LWlkJywgcmVxdWVzdF9pZCApO1xuXHRcdGlmICggcHJldmlvdXNfcmVxdWVzdCAmJiBwcmV2aW91c19yZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgKSB7XG5cdFx0XHRwcmV2aW91c19yZXF1ZXN0LmFib3J0KCk7XG5cdFx0fVxuXG5cdFx0Y2xlYXJfZXJyb3IoICRyb290ICk7XG5cdFx0c2V0X2xvYWRpbmcoICRyb290LCB0cnVlICk7XG5cdFx0dmFyIHJlcXVlc3QgPSAkLnBvc3QoIGNvbmZpZy5hamF4X3VybCwge1xuXHRcdFx0YWN0aW9uOiBjb25maWcuYWN0aW9uLFxuXHRcdFx0bm9uY2U6IGNvbmZpZy5ub25jZSxcblx0XHRcdGNvbmZpZ190b2tlbjogJHJvb3QuYXR0ciggJ2RhdGEtY29uZmlnLXRva2VuJyApIHx8ICcnLFxuXHRcdFx0cmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkXG5cdFx0fSApO1xuXHRcdCRyb290LmRhdGEoICd3cGJjLXJlc291cmNlLXNlbGVjdG9yLXJlcXVlc3QnLCByZXF1ZXN0ICk7XG5cblx0XHRyZXF1ZXN0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgcmVzcG9uc2UgfHwgISByZXNwb25zZS5zdWNjZXNzIHx8ICEgcmVzcG9uc2UuZGF0YSApIHtcblx0XHRcdFx0c2hvd19lcnJvciggJHJvb3QsIHJlc3BvbnNlICYmIHJlc3BvbnNlLmRhdGEgJiYgcmVzcG9uc2UuZGF0YS5tZXNzYWdlID8gcmVzcG9uc2UuZGF0YS5tZXNzYWdlIDogY29uZmlnLmVycm9yICk7XG5cdFx0XHRcdGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzdGFnZSA9IHJlc3BvbnNlLmRhdGEuc3RhZ2UgfHwgJyc7XG5cdFx0XHR2YXIgcmVwbGFjZW1lbnQgPSByZXBsYWNlX3N0YWdlKCAkcm9vdCwgcmVzcG9uc2UuZGF0YS5odG1sLCBzdGFnZSwgcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV9pZCwgcmVxdWVzdF9pZCApO1xuXHRcdFx0cmVwbGFjZW1lbnQuZG9uZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIE51bWJlciggcmVzcG9uc2UuZGF0YS5yZXNvdXJjZV9pZCB8fCAwICkgKSB7XG5cdFx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtcmVzb3VyY2UtaWQnLCBOdW1iZXIoIHJlc3BvbnNlLmRhdGEucmVzb3VyY2VfaWQgKSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZpbmlzaF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApO1xuXHRcdFx0XHRmb2N1c19zdGFnZSggJHJvb3QgKTtcblx0XHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIGVycm9yICkge1xuXHRcdFx0XHRpZiAoICEgaXNfY3VycmVudF9yZXF1ZXN0KCAkcm9vdCwgcmVxdWVzdF9pZCApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRzaG93X2Vycm9yKCAkcm9vdCwgZXJyb3IgJiYgZXJyb3Iud3BiY19tZXNzYWdlID8gZXJyb3Iud3BiY19tZXNzYWdlIDogKCBjb25maWcuaW5pdGlhbGl6YXRpb25fZXJyb3IgfHwgY29uZmlnLmVycm9yICkgKTtcblx0XHRcdFx0ZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICk7XG5cdFx0XHR9ICk7XG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyLCBzdGF0dXMgKSB7XG5cdFx0XHRpZiAoICdhYm9ydCcgPT09IHN0YXR1cyB8fCAhIGlzX2N1cnJlbnRfcmVxdWVzdCggJHJvb3QsIHJlcXVlc3RfaWQgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHJlc3BvbnNlID0geGhyLnJlc3BvbnNlSlNPTjtcblx0XHRcdHNob3dfZXJyb3IoICRyb290LCByZXNwb25zZSAmJiByZXNwb25zZS5kYXRhICYmIHJlc3BvbnNlLmRhdGEubWVzc2FnZSA/IHJlc3BvbnNlLmRhdGEubWVzc2FnZSA6IGNvbmZpZy5lcnJvciApO1xuXHRcdFx0ZmluaXNoX3JlcXVlc3QoICRyb290LCByZXF1ZXN0X2lkICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqIFJlc29sdmUgdGhlIHNlbGVjdGVkIEJvb2tpbmcgUmVzb3VyY2UgdGhyb3VnaCBBSkFYLiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnc3VibWl0JywgJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX3NlbGVjdGlvbl9mb3JtJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRpZiAoICEgY29uZmlnLmFqYXhfdXJsIHx8ICEgY29uZmlnLmFjdGlvbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHR2YXIgJGZvcm0gPSAkKCB0aGlzICk7XG5cdFx0cmVzb2x2ZV9zdGFnZSggJGZvcm0uY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3InICksIGdldF9zZWxlY3RlZF9yZXNvdXJjZV9pZCggJGZvcm0gKSApO1xuXHR9ICk7XG5cblx0LyoqIEtlZXAgc2VsZWN0ZWQgY2FyZCBzdHlsaW5nIGluZGVwZW5kZW50IGZyb20gQ1NTIDpoYXMoKSBzdXBwb3J0LiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2Nob2ljZSA+IGlucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdHZhciAkaW5wdXQgPSAkKCB0aGlzICk7XG5cdFx0JGlucHV0LmNsb3Nlc3QoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19jaG9pY2VzJyApLmZpbmQoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19jaG9pY2UnICkucmVtb3ZlQ2xhc3MoICdpcy1zZWxlY3RlZCcgKTtcblx0XHQkaW5wdXQuY2xvc2VzdCggJy53cGJjX2Jvb2tpbmdfcmVzb3VyY2Vfc2VsZWN0b3JfX2Nob2ljZScgKS5hZGRDbGFzcyggJ2lzLXNlbGVjdGVkJyApO1xuXHR9ICk7XG5cblx0LyoqIFJldHVybiB0byBSZXNvdXJjZSBzZWxlY3Rpb24gd2l0aG91dCByZWxvYWRpbmcgdGhlIHB1YmxpYyBwYWdlLiAqL1xuXHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvciBbZGF0YS13cGJjLXJlc291cmNlLXNlbGVjdG9yLWFjdGlvbj1cInN0YXJ0LW92ZXJcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGlmICggISBjb25maWcuYWpheF91cmwgfHwgISBjb25maWcuYWN0aW9uICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdHZhciAkcm9vdCA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvcicgKTtcblx0XHRpZiAoICRyb290Lmhhc0NsYXNzKCAnaXMtbG9hZGluZycgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmVzb2x2ZV9zdGFnZSggJHJvb3QsIDAgKTtcblx0fSApO1xuXG5cdC8qKiBBZGQgdGhlIHNpZ25lZCByZXNvdXJjZSBjb250ZXh0IHRvIHRoZSBjb3JlIGJvb2tpbmctY3JlYXRlIHJlcXVlc3QuICovXG5cdCQoICdib2R5JyApLm9uKCAnd3BiY19iZWZvcmVfYm9va2luZ19jcmVhdGUud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yJywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIHBhcmFtcyApIHtcblx0XHR2YXIgY29udGV4dCA9IGdldF9uYXRpdmVfY29udGV4dCggcmVzb3VyY2VfaWQgKTtcblx0XHRpZiAoICEgY29udGV4dCB8fCAhIHBhcmFtcyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cGFyYW1zLnJlc291cmNlX3NlbGVjdG9yX3JlcXVpcmVkID0gMTtcblx0XHRwYXJhbXMucmVzb3VyY2Vfc2VsZWN0b3JfY29udGV4dF90b2tlbiA9IGNvbnRleHQuY29udGV4dF90b2tlbjtcblx0XHRwYXJhbXMuYWxsb3dfcGFzdCA9IGNvbnRleHQuYWxsb3dfcGFzdDtcblx0fSApO1xuXG5cdCQoIGZ1bmN0aW9uICgpIHtcblx0XHQkKCAnLndwYmNfYm9va2luZ19yZXNvdXJjZV9zZWxlY3RvcicgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHR2YXIgJHJvb3QgPSAkKCB0aGlzICk7XG5cdFx0XHR2YXIgJG5hdGl2ZSA9ICRyb290LmZpbmQoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19uYXRpdmVfZm9ybScgKS5maXJzdCgpO1xuXHRcdFx0aWYgKCAkbmF0aXZlLmxlbmd0aCApIHtcblx0XHRcdFx0JHJvb3QuYXR0ciggJ2RhdGEtc2VsZWN0ZWQtcmVzb3VyY2UtaWQnLCBOdW1iZXIoICRuYXRpdmUuZGF0YSggJ3Jlc291cmNlLWlkJyApIHx8IDAgKSApO1xuXHRcdFx0fVxuXHRcdFx0dmFyIGR1cGxpY2F0ZSA9ICRuYXRpdmUubGVuZ3RoICYmIGhhc19kdXBsaWNhdGVfcmVzb3VyY2VfZm9ybSggJHJvb3QsIE51bWJlciggJG5hdGl2ZS5kYXRhKCAncmVzb3VyY2UtaWQnICkgfHwgMCApICk7XG5cdFx0XHRpZiAoIGR1cGxpY2F0ZSB8fCAhIHByZXBhcmVfbmF0aXZlX2Zvcm0oICRyb290ICkgKSB7XG5cdFx0XHRcdGNsZWFudXBfbmF0aXZlX2Zvcm0oICRyb290ICk7XG5cdFx0XHRcdCRyb290LmZpbmQoICcud3BiY19ib29raW5nX3Jlc291cmNlX3NlbGVjdG9yX19uYXRpdmVfZm9ybSA6aW5wdXQnICkucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xuXHRcdFx0XHRzaG93X2Vycm9yKCAkcm9vdCwgZHVwbGljYXRlID8gY29uZmlnLmR1cGxpY2F0ZV9yZXNvdXJjZSA6IGNvbmZpZy5pbml0aWFsaXphdGlvbl9lcnJvciApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fSApO1xufSApKCB3aW5kb3csIGpRdWVyeSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBLENBQUUsVUFBV0EsTUFBTSxFQUFFQyxDQUFDLEVBQUc7RUFDeEIsWUFBWTs7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
