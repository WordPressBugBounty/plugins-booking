"use strict";

/**
 * Coordinate the explicit Local translation action on Setup Wizard Step 3.
 *
 * Draft date/time controls remain owned by the shared shell. This adapter only
 * runs after an explicit button click and sends no locale or package URL; the
 * server derives the current site language and owns the installation target.
 *
 * @package Booking Calendar
 */
(function ($, window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_date_time_formats || {
    i18n: {}
  };
  var request_sequence = 0;

  /**
   * Extract a safe message from a failed WordPress AJAX response.
   *
   * @param {Object} xhr            jQuery request object.
   * @param {Object} adapter_config Module configuration.
   * @return {string} Human-readable error message.
   */
  function get_error_message(xhr, adapter_config) {
    if (xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
      return String(xhr.responseJSON.data.message);
    }
    return adapter_config.i18n.error || '';
  }

  /**
   * Extract authorized operation-console records from an AJAX payload.
   *
   * @param {Object} payload WordPress AJAX response data.
   * @return {Array} Safe console records.
   */
  function get_operation_logs(payload) {
    if (!payload || !Array.isArray(payload.logs)) {
      return [];
    }
    return payload.logs.filter(function (log_entry) {
      return log_entry && 'string' === typeof log_entry.message;
    });
  }

  /**
   * Append one operation record using text-only DOM output.
   *
   * @param {HTMLElement} log_container Console list element.
   * @param {string}      level         Authorized severity.
   * @param {string}      message       Human-readable operation message.
   * @return {void}
   */
  function append_operation_log(log_container, level, message) {
    var allowed_levels = ['info', 'success', 'warning', 'error'];
    var log_entry;
    if (!log_container || !message) {
      return;
    }
    level = -1 !== allowed_levels.indexOf(level) ? level : 'info';
    log_entry = document.createElement('li');
    log_entry.className = 'wpbc_setup_wizard__translation-console-entry is-' + level;
    log_entry.textContent = String(message);
    log_container.appendChild(log_entry);
  }

  /**
   * Replace the console list with server-authorized operation records.
   *
   * @param {HTMLElement} log_container Console list element.
   * @param {Array}       operation_logs Authorized console records.
   * @return {void}
   */
  function render_operation_logs(log_container, operation_logs) {
    if (!log_container) {
      return;
    }
    log_container.textContent = '';
    operation_logs.forEach(function (log_entry) {
      append_operation_log(log_container, String(log_entry.level || 'info'), String(log_entry.message || ''));
    });
  }

  /**
   * Refresh the server-authoritative language and translation-source display.
   *
   * @param {HTMLElement} editor           Step editor root.
   * @param {Object}      language_context Authorized language response.
   * @return {void}
   */
  function update_language_context(editor, language_context) {
    var allowed_statuses = ['active', 'available', 'builtin', 'unavailable'];
    var action_label = editor.querySelector('[data-wpbc-install-local-translation-label]');
    var action_button = editor.querySelector('[data-wpbc-install-local-translation]');
    var help = editor.querySelector('[data-wpbc-local-translation-help]');
    var local_source_recommendation = editor.querySelector('[data-wpbc-local-source-recommendation]');
    var source = editor.querySelector('[data-wpbc-local-translation-source]');
    var source_label = editor.querySelector('[data-wpbc-local-translation-source-label]');
    var status = editor.querySelector('[data-wpbc-local-translation-status]');
    var updated = editor.querySelector('[data-wpbc-local-translation-updated]');
    var recommendation = editor.querySelector('[data-wpbc-local-translation-recommendation]');
    var status_key;
    if (!language_context) {
      return;
    }
    status_key = -1 !== allowed_statuses.indexOf(language_context.status) ? language_context.status : 'unavailable';
    if (status) {
      status.className = 'wpbc_setup_wizard__language-status wpbc_setup_wizard__language-status--' + status_key;
      status.textContent = String(language_context.status_label || '');
    }
    if (help) {
      help.textContent = String(language_context.help || '');
    }
    if (source) {
      source.setAttribute('data-wpbc-local-translation-source', String(language_context.translation_source || ''));
    }
    if (source_label) {
      source_label.textContent = String(language_context.translation_source_label || '');
    }
    if (action_label) {
      action_label.textContent = String(language_context.action_label || action_label.textContent);
    }
    if (action_button) {
      action_button.classList.toggle('wpbc_setup_wizard__translation-action--recommended', Boolean(language_context.is_local_source_recommended));
    }
    if (local_source_recommendation) {
      local_source_recommendation.textContent = String(language_context.local_source_recommendation || '');
      local_source_recommendation.hidden = !language_context.is_local_source_recommended || !language_context.local_source_recommendation;
    }
    if (updated) {
      updated.textContent = String(language_context.updated_label || '');
      updated.hidden = !language_context.updated_label;
    }
    if (recommendation) {
      recommendation.textContent = String(language_context.update_recommendation || '');
      recommendation.hidden = !language_context.is_update_recommended || !language_context.update_recommendation;
    }
  }

  /**
   * Create the shell adapter for the Step 3 explicit action.
   *
   * @param {Object} adapter_config Localized module configuration.
   * @return {Object} Shared shell adapter.
   */
  function create_date_time_formats_adapter(adapter_config) {
    var services = null;
    var root = null;
    var editor = null;
    adapter_config = adapter_config || {
      i18n: {}
    };
    adapter_config.i18n = adapter_config.i18n || {};
    return {
      /**
       * Bind the Local translation action when it is authorized and rendered.
       *
       * @param {Object} shell_services Domain-neutral shell services.
       * @return {void}
       */
      initialize: function (shell_services) {
        services = shell_services;
        root = shell_services.root;
        editor = root.querySelector('[data-wpbc-date-time-formats-editor]');
        if (!editor) {
          return;
        }
        editor.addEventListener('click', function (event) {
          var install_button = event.target.closest('[data-wpbc-install-local-translation]');
          var feedback;
          var operation_console;
          var console_log;
          var console_state;
          var source;
          var source_label;
          var previous_source;
          var previous_source_label;
          var reload_pending = false;
          var sequence;
          var request_id;
          var request;
          if (!install_button) {
            return;
          }
          event.preventDefault();
          feedback = editor.querySelector('[data-wpbc-local-translation-feedback]');
          operation_console = editor.querySelector('[data-wpbc-local-translation-console]');
          console_log = editor.querySelector('[data-wpbc-local-translation-console-log]');
          console_state = editor.querySelector('[data-wpbc-local-translation-console-state]');
          source = editor.querySelector('[data-wpbc-local-translation-source]');
          source_label = editor.querySelector('[data-wpbc-local-translation-source-label]');
          previous_source = source ? source.getAttribute('data-wpbc-local-translation-source') : '';
          previous_source_label = source_label ? source_label.textContent : '';
          request_sequence += 1;
          sequence = request_sequence;
          request_id = 'translation_' + Date.now() + '_' + sequence;
          if (feedback) {
            feedback.classList.remove('is-error', 'is-success');
            feedback.textContent = '';
          }
          if (operation_console) {
            operation_console.hidden = false;
            operation_console.setAttribute('aria-busy', 'true');
            if ('function' === typeof operation_console.scrollIntoView) {
              operation_console.scrollIntoView({
                block: 'nearest'
              });
            }
          }
          if (console_state) {
            console_state.textContent = adapter_config.i18n.working || '';
          }
          if (console_log) {
            console_log.textContent = '';
            append_operation_log(console_log, 'info', adapter_config.i18n.connecting || adapter_config.i18n.working || '');
            append_operation_log(console_log, 'info', adapter_config.i18n.working || '');
          }
          if (source) {
            source.setAttribute('data-wpbc-local-translation-source', 'wpbc');
          }
          if (source_label) {
            source_label.textContent = adapter_config.i18n.local_source_label || previous_source_label;
          }
          install_button.disabled = true;
          services.set_status(adapter_config.i18n.working || '');
          request = $.ajax({
            url: adapter_config.ajax_url,
            method: 'POST',
            dataType: 'json',
            data: {
              action: adapter_config.action,
              nonce: adapter_config.nonce,
              request_id: request_id
            }
          });
          request.done(function (response) {
            var operation_logs;
            if (sequence !== request_sequence || !response || !response.success || !response.data || response.data.request_id !== request_id) {
              return;
            }
            operation_logs = get_operation_logs(response.data);
            render_operation_logs(console_log, operation_logs);
            if (console_state) {
              console_state.textContent = adapter_config.i18n.complete || '';
            }
            if (feedback) {
              feedback.classList.add('is-success');
              feedback.textContent = String(response.data.message || '');
            }
            update_language_context(editor, response.data.language);
            services.set_status(String(response.data.message || ''));
            if (true === response.data.reload_page) {
              reload_pending = true;
              if (console_state) {
                console_state.textContent = adapter_config.i18n.reloading || adapter_config.i18n.complete || '';
              }
              window.setTimeout(function () {
                window.location.reload();
              }, 250);
            }
          });
          request.fail(function (xhr) {
            var message;
            var response_data;
            var operation_logs;
            if (sequence !== request_sequence) {
              return;
            }
            message = get_error_message(xhr, adapter_config);
            response_data = xhr && xhr.responseJSON ? xhr.responseJSON.data : null;
            operation_logs = get_operation_logs(response_data);
            if (response_data && response_data.language) {
              update_language_context(editor, response_data.language);
            } else {
              if (source) {
                source.setAttribute('data-wpbc-local-translation-source', previous_source || '');
              }
              if (source_label) {
                source_label.textContent = previous_source_label || '';
              }
            }
            render_operation_logs(console_log, operation_logs);
            if (0 === operation_logs.length) {
              append_operation_log(console_log, 'error', message);
            }
            if (console_state) {
              console_state.textContent = adapter_config.i18n.failed || '';
            }
            if (feedback) {
              feedback.classList.add('is-error');
              feedback.textContent = message;
            }
            services.set_status(message);
          });
          request.always(function () {
            if (sequence === request_sequence && !reload_pending) {
              install_button.disabled = false;
              if (operation_console) {
                operation_console.setAttribute('aria-busy', 'false');
              }
            }
          });
        });
      },
      /**
       * Step 3 native controls need no draft synchronization.
       *
       * @return {void}
       */
      sync: function () {},
      /**
       * Server and native required-select validation remain authoritative.
       *
       * @return {null} No module-specific invalid control.
       */
      validate: function () {
        return null;
      }
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.date_time_formats = {
    create: create_date_time_formats_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_date_time_formats_adapter(module_config));
  }
})(jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1kYXRlLXRpbWUtZm9ybWF0cy9fb3V0L3N0ZXAtZGF0ZS10aW1lLWZvcm1hdHMuanMiLCJuYW1lcyI6WyIkIiwid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfZGF0ZV90aW1lX2Zvcm1hdHMiLCJpMThuIiwicmVxdWVzdF9zZXF1ZW5jZSIsImdldF9lcnJvcl9tZXNzYWdlIiwieGhyIiwiYWRhcHRlcl9jb25maWciLCJyZXNwb25zZUpTT04iLCJkYXRhIiwibWVzc2FnZSIsIlN0cmluZyIsImVycm9yIiwiZ2V0X29wZXJhdGlvbl9sb2dzIiwicGF5bG9hZCIsIkFycmF5IiwiaXNBcnJheSIsImxvZ3MiLCJmaWx0ZXIiLCJsb2dfZW50cnkiLCJhcHBlbmRfb3BlcmF0aW9uX2xvZyIsImxvZ19jb250YWluZXIiLCJsZXZlbCIsImFsbG93ZWRfbGV2ZWxzIiwiaW5kZXhPZiIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJ0ZXh0Q29udGVudCIsImFwcGVuZENoaWxkIiwicmVuZGVyX29wZXJhdGlvbl9sb2dzIiwib3BlcmF0aW9uX2xvZ3MiLCJmb3JFYWNoIiwidXBkYXRlX2xhbmd1YWdlX2NvbnRleHQiLCJlZGl0b3IiLCJsYW5ndWFnZV9jb250ZXh0IiwiYWxsb3dlZF9zdGF0dXNlcyIsImFjdGlvbl9sYWJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJhY3Rpb25fYnV0dG9uIiwiaGVscCIsImxvY2FsX3NvdXJjZV9yZWNvbW1lbmRhdGlvbiIsInNvdXJjZSIsInNvdXJjZV9sYWJlbCIsInN0YXR1cyIsInVwZGF0ZWQiLCJyZWNvbW1lbmRhdGlvbiIsInN0YXR1c19rZXkiLCJzdGF0dXNfbGFiZWwiLCJzZXRBdHRyaWJ1dGUiLCJ0cmFuc2xhdGlvbl9zb3VyY2UiLCJ0cmFuc2xhdGlvbl9zb3VyY2VfbGFiZWwiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJCb29sZWFuIiwiaXNfbG9jYWxfc291cmNlX3JlY29tbWVuZGVkIiwiaGlkZGVuIiwidXBkYXRlZF9sYWJlbCIsInVwZGF0ZV9yZWNvbW1lbmRhdGlvbiIsImlzX3VwZGF0ZV9yZWNvbW1lbmRlZCIsImNyZWF0ZV9kYXRlX3RpbWVfZm9ybWF0c19hZGFwdGVyIiwic2VydmljZXMiLCJyb290IiwiaW5pdGlhbGl6ZSIsInNoZWxsX3NlcnZpY2VzIiwiYWRkRXZlbnRMaXN0ZW5lciIsImV2ZW50IiwiaW5zdGFsbF9idXR0b24iLCJ0YXJnZXQiLCJjbG9zZXN0IiwiZmVlZGJhY2siLCJvcGVyYXRpb25fY29uc29sZSIsImNvbnNvbGVfbG9nIiwiY29uc29sZV9zdGF0ZSIsInByZXZpb3VzX3NvdXJjZSIsInByZXZpb3VzX3NvdXJjZV9sYWJlbCIsInJlbG9hZF9wZW5kaW5nIiwic2VxdWVuY2UiLCJyZXF1ZXN0X2lkIiwicmVxdWVzdCIsInByZXZlbnREZWZhdWx0IiwiZ2V0QXR0cmlidXRlIiwiRGF0ZSIsIm5vdyIsInJlbW92ZSIsInNjcm9sbEludG9WaWV3IiwiYmxvY2siLCJ3b3JraW5nIiwiY29ubmVjdGluZyIsImxvY2FsX3NvdXJjZV9sYWJlbCIsImRpc2FibGVkIiwic2V0X3N0YXR1cyIsImFqYXgiLCJ1cmwiLCJhamF4X3VybCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiYWN0aW9uIiwibm9uY2UiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiY29tcGxldGUiLCJhZGQiLCJsYW5ndWFnZSIsInJlbG9hZF9wYWdlIiwicmVsb2FkaW5nIiwic2V0VGltZW91dCIsImxvY2F0aW9uIiwicmVsb2FkIiwiZmFpbCIsInJlc3BvbnNlX2RhdGEiLCJsZW5ndGgiLCJmYWlsZWQiLCJhbHdheXMiLCJzeW5jIiwidmFsaWRhdGUiLCJ3cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzIiwiZGF0ZV90aW1lX2Zvcm1hdHMiLCJjcmVhdGUiLCJ3cGJjX3NldHVwX3dpemFyZF9hcGkiLCJyZWdpc3Rlcl9zdGVwX2FkYXB0ZXIiLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwLXdpemFyZC9zdGVwLWRhdGUtdGltZS1mb3JtYXRzL19zcmMvc3RlcC1kYXRlLXRpbWUtZm9ybWF0cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvb3JkaW5hdGUgdGhlIGV4cGxpY2l0IExvY2FsIHRyYW5zbGF0aW9uIGFjdGlvbiBvbiBTZXR1cCBXaXphcmQgU3RlcCAzLlxuICpcbiAqIERyYWZ0IGRhdGUvdGltZSBjb250cm9scyByZW1haW4gb3duZWQgYnkgdGhlIHNoYXJlZCBzaGVsbC4gVGhpcyBhZGFwdGVyIG9ubHlcbiAqIHJ1bnMgYWZ0ZXIgYW4gZXhwbGljaXQgYnV0dG9uIGNsaWNrIGFuZCBzZW5kcyBubyBsb2NhbGUgb3IgcGFja2FnZSBVUkw7IHRoZVxuICogc2VydmVyIGRlcml2ZXMgdGhlIGN1cnJlbnQgc2l0ZSBsYW5ndWFnZSBhbmQgb3ducyB0aGUgaW5zdGFsbGF0aW9uIHRhcmdldC5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKi9cbiggZnVuY3Rpb24gKCAkLCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9jb25maWcgPSB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfZGF0ZV90aW1lX2Zvcm1hdHMgfHwgeyBpMThuOiB7fSB9O1xuXHR2YXIgcmVxdWVzdF9zZXF1ZW5jZSA9IDA7XG5cblx0LyoqXG5cdCAqIEV4dHJhY3QgYSBzYWZlIG1lc3NhZ2UgZnJvbSBhIGZhaWxlZCBXb3JkUHJlc3MgQUpBWCByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHhociAgICAgICAgICAgIGpRdWVyeSByZXF1ZXN0IG9iamVjdC5cblx0ICogQHBhcmFtIHtPYmplY3R9IGFkYXB0ZXJfY29uZmlnIE1vZHVsZSBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEh1bWFuLXJlYWRhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfZXJyb3JfbWVzc2FnZSggeGhyLCBhZGFwdGVyX2NvbmZpZyApIHtcblx0XHRpZiAoIHhociAmJiB4aHIucmVzcG9uc2VKU09OICYmIHhoci5yZXNwb25zZUpTT04uZGF0YSAmJiB4aHIucmVzcG9uc2VKU09OLmRhdGEubWVzc2FnZSApIHtcblx0XHRcdHJldHVybiBTdHJpbmcoIHhoci5yZXNwb25zZUpTT04uZGF0YS5tZXNzYWdlICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFkYXB0ZXJfY29uZmlnLmkxOG4uZXJyb3IgfHwgJyc7XG5cdH1cblxuXHQvKipcblx0ICogRXh0cmFjdCBhdXRob3JpemVkIG9wZXJhdGlvbi1jb25zb2xlIHJlY29yZHMgZnJvbSBhbiBBSkFYIHBheWxvYWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYXlsb2FkIFdvcmRQcmVzcyBBSkFYIHJlc3BvbnNlIGRhdGEuXG5cdCAqIEByZXR1cm4ge0FycmF5fSBTYWZlIGNvbnNvbGUgcmVjb3Jkcy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9vcGVyYXRpb25fbG9ncyggcGF5bG9hZCApIHtcblx0XHRpZiAoICEgcGF5bG9hZCB8fCAhIEFycmF5LmlzQXJyYXkoIHBheWxvYWQubG9ncyApICkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdHJldHVybiBwYXlsb2FkLmxvZ3MuZmlsdGVyKCBmdW5jdGlvbiAoIGxvZ19lbnRyeSApIHtcblx0XHRcdHJldHVybiBsb2dfZW50cnkgJiYgJ3N0cmluZycgPT09IHR5cGVvZiBsb2dfZW50cnkubWVzc2FnZTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwZW5kIG9uZSBvcGVyYXRpb24gcmVjb3JkIHVzaW5nIHRleHQtb25seSBET00gb3V0cHV0LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBsb2dfY29udGFpbmVyIENvbnNvbGUgbGlzdCBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBsZXZlbCAgICAgICAgIEF1dGhvcml6ZWQgc2V2ZXJpdHkuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIG1lc3NhZ2UgICAgICAgSHVtYW4tcmVhZGFibGUgb3BlcmF0aW9uIG1lc3NhZ2UuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBhcHBlbmRfb3BlcmF0aW9uX2xvZyggbG9nX2NvbnRhaW5lciwgbGV2ZWwsIG1lc3NhZ2UgKSB7XG5cdFx0dmFyIGFsbG93ZWRfbGV2ZWxzID0gWyAnaW5mbycsICdzdWNjZXNzJywgJ3dhcm5pbmcnLCAnZXJyb3InIF07XG5cdFx0dmFyIGxvZ19lbnRyeTtcblxuXHRcdGlmICggISBsb2dfY29udGFpbmVyIHx8ICEgbWVzc2FnZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXZlbCA9IC0xICE9PSBhbGxvd2VkX2xldmVscy5pbmRleE9mKCBsZXZlbCApID8gbGV2ZWwgOiAnaW5mbyc7XG5cdFx0bG9nX2VudHJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpJyApO1xuXHRcdGxvZ19lbnRyeS5jbGFzc05hbWUgPSAnd3BiY19zZXR1cF93aXphcmRfX3RyYW5zbGF0aW9uLWNvbnNvbGUtZW50cnkgaXMtJyArIGxldmVsO1xuXHRcdGxvZ19lbnRyeS50ZXh0Q29udGVudCA9IFN0cmluZyggbWVzc2FnZSApO1xuXHRcdGxvZ19jb250YWluZXIuYXBwZW5kQ2hpbGQoIGxvZ19lbnRyeSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlcGxhY2UgdGhlIGNvbnNvbGUgbGlzdCB3aXRoIHNlcnZlci1hdXRob3JpemVkIG9wZXJhdGlvbiByZWNvcmRzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBsb2dfY29udGFpbmVyIENvbnNvbGUgbGlzdCBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge0FycmF5fSAgICAgICBvcGVyYXRpb25fbG9ncyBBdXRob3JpemVkIGNvbnNvbGUgcmVjb3Jkcy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlcl9vcGVyYXRpb25fbG9ncyggbG9nX2NvbnRhaW5lciwgb3BlcmF0aW9uX2xvZ3MgKSB7XG5cdFx0aWYgKCAhIGxvZ19jb250YWluZXIgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bG9nX2NvbnRhaW5lci50ZXh0Q29udGVudCA9ICcnO1xuXHRcdG9wZXJhdGlvbl9sb2dzLmZvckVhY2goIGZ1bmN0aW9uICggbG9nX2VudHJ5ICkge1xuXHRcdFx0YXBwZW5kX29wZXJhdGlvbl9sb2coIGxvZ19jb250YWluZXIsIFN0cmluZyggbG9nX2VudHJ5LmxldmVsIHx8ICdpbmZvJyApLCBTdHJpbmcoIGxvZ19lbnRyeS5tZXNzYWdlIHx8ICcnICkgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVmcmVzaCB0aGUgc2VydmVyLWF1dGhvcml0YXRpdmUgbGFuZ3VhZ2UgYW5kIHRyYW5zbGF0aW9uLXNvdXJjZSBkaXNwbGF5LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlZGl0b3IgICAgICAgICAgIFN0ZXAgZWRpdG9yIHJvb3QuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGxhbmd1YWdlX2NvbnRleHQgQXV0aG9yaXplZCBsYW5ndWFnZSByZXNwb25zZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHVwZGF0ZV9sYW5ndWFnZV9jb250ZXh0KCBlZGl0b3IsIGxhbmd1YWdlX2NvbnRleHQgKSB7XG5cdFx0dmFyIGFsbG93ZWRfc3RhdHVzZXMgPSBbICdhY3RpdmUnLCAnYXZhaWxhYmxlJywgJ2J1aWx0aW4nLCAndW5hdmFpbGFibGUnIF07XG5cdFx0dmFyIGFjdGlvbl9sYWJlbCA9IGVkaXRvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1pbnN0YWxsLWxvY2FsLXRyYW5zbGF0aW9uLWxhYmVsXScgKTtcblx0XHR2YXIgYWN0aW9uX2J1dHRvbiA9IGVkaXRvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1pbnN0YWxsLWxvY2FsLXRyYW5zbGF0aW9uXScgKTtcblx0XHR2YXIgaGVscCA9IGVkaXRvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1sb2NhbC10cmFuc2xhdGlvbi1oZWxwXScgKTtcblx0XHR2YXIgbG9jYWxfc291cmNlX3JlY29tbWVuZGF0aW9uID0gZWRpdG9yLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWxvY2FsLXNvdXJjZS1yZWNvbW1lbmRhdGlvbl0nICk7XG5cdFx0dmFyIHNvdXJjZSA9IGVkaXRvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1sb2NhbC10cmFuc2xhdGlvbi1zb3VyY2VdJyApO1xuXHRcdHZhciBzb3VyY2VfbGFiZWwgPSBlZGl0b3IucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtbG9jYWwtdHJhbnNsYXRpb24tc291cmNlLWxhYmVsXScgKTtcblx0XHR2YXIgc3RhdHVzID0gZWRpdG9yLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWxvY2FsLXRyYW5zbGF0aW9uLXN0YXR1c10nICk7XG5cdFx0dmFyIHVwZGF0ZWQgPSBlZGl0b3IucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtbG9jYWwtdHJhbnNsYXRpb24tdXBkYXRlZF0nICk7XG5cdFx0dmFyIHJlY29tbWVuZGF0aW9uID0gZWRpdG9yLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWxvY2FsLXRyYW5zbGF0aW9uLXJlY29tbWVuZGF0aW9uXScgKTtcblx0XHR2YXIgc3RhdHVzX2tleTtcblxuXHRcdGlmICggISBsYW5ndWFnZV9jb250ZXh0ICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN0YXR1c19rZXkgPSAtMSAhPT0gYWxsb3dlZF9zdGF0dXNlcy5pbmRleE9mKCBsYW5ndWFnZV9jb250ZXh0LnN0YXR1cyApID8gbGFuZ3VhZ2VfY29udGV4dC5zdGF0dXMgOiAndW5hdmFpbGFibGUnO1xuXHRcdGlmICggc3RhdHVzICkge1xuXHRcdFx0c3RhdHVzLmNsYXNzTmFtZSA9ICd3cGJjX3NldHVwX3dpemFyZF9fbGFuZ3VhZ2Utc3RhdHVzIHdwYmNfc2V0dXBfd2l6YXJkX19sYW5ndWFnZS1zdGF0dXMtLScgKyBzdGF0dXNfa2V5O1xuXHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gU3RyaW5nKCBsYW5ndWFnZV9jb250ZXh0LnN0YXR1c19sYWJlbCB8fCAnJyApO1xuXHRcdH1cblx0XHRpZiAoIGhlbHAgKSB7XG5cdFx0XHRoZWxwLnRleHRDb250ZW50ID0gU3RyaW5nKCBsYW5ndWFnZV9jb250ZXh0LmhlbHAgfHwgJycgKTtcblx0XHR9XG5cdFx0aWYgKCBzb3VyY2UgKSB7XG5cdFx0XHRzb3VyY2Uuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWxvY2FsLXRyYW5zbGF0aW9uLXNvdXJjZScsIFN0cmluZyggbGFuZ3VhZ2VfY29udGV4dC50cmFuc2xhdGlvbl9zb3VyY2UgfHwgJycgKSApO1xuXHRcdH1cblx0XHRpZiAoIHNvdXJjZV9sYWJlbCApIHtcblx0XHRcdHNvdXJjZV9sYWJlbC50ZXh0Q29udGVudCA9IFN0cmluZyggbGFuZ3VhZ2VfY29udGV4dC50cmFuc2xhdGlvbl9zb3VyY2VfbGFiZWwgfHwgJycgKTtcblx0XHR9XG5cdFx0aWYgKCBhY3Rpb25fbGFiZWwgKSB7XG5cdFx0XHRhY3Rpb25fbGFiZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoIGxhbmd1YWdlX2NvbnRleHQuYWN0aW9uX2xhYmVsIHx8IGFjdGlvbl9sYWJlbC50ZXh0Q29udGVudCApO1xuXHRcdH1cblx0XHRpZiAoIGFjdGlvbl9idXR0b24gKSB7XG5cdFx0XHRhY3Rpb25fYnV0dG9uLmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX3NldHVwX3dpemFyZF9fdHJhbnNsYXRpb24tYWN0aW9uLS1yZWNvbW1lbmRlZCcsIEJvb2xlYW4oIGxhbmd1YWdlX2NvbnRleHQuaXNfbG9jYWxfc291cmNlX3JlY29tbWVuZGVkICkgKTtcblx0XHR9XG5cdFx0aWYgKCBsb2NhbF9zb3VyY2VfcmVjb21tZW5kYXRpb24gKSB7XG5cdFx0XHRsb2NhbF9zb3VyY2VfcmVjb21tZW5kYXRpb24udGV4dENvbnRlbnQgPSBTdHJpbmcoIGxhbmd1YWdlX2NvbnRleHQubG9jYWxfc291cmNlX3JlY29tbWVuZGF0aW9uIHx8ICcnICk7XG5cdFx0XHRsb2NhbF9zb3VyY2VfcmVjb21tZW5kYXRpb24uaGlkZGVuID0gISBsYW5ndWFnZV9jb250ZXh0LmlzX2xvY2FsX3NvdXJjZV9yZWNvbW1lbmRlZCB8fCAhIGxhbmd1YWdlX2NvbnRleHQubG9jYWxfc291cmNlX3JlY29tbWVuZGF0aW9uO1xuXHRcdH1cblx0XHRpZiAoIHVwZGF0ZWQgKSB7XG5cdFx0XHR1cGRhdGVkLnRleHRDb250ZW50ID0gU3RyaW5nKCBsYW5ndWFnZV9jb250ZXh0LnVwZGF0ZWRfbGFiZWwgfHwgJycgKTtcblx0XHRcdHVwZGF0ZWQuaGlkZGVuID0gISBsYW5ndWFnZV9jb250ZXh0LnVwZGF0ZWRfbGFiZWw7XG5cdFx0fVxuXHRcdGlmICggcmVjb21tZW5kYXRpb24gKSB7XG5cdFx0XHRyZWNvbW1lbmRhdGlvbi50ZXh0Q29udGVudCA9IFN0cmluZyggbGFuZ3VhZ2VfY29udGV4dC51cGRhdGVfcmVjb21tZW5kYXRpb24gfHwgJycgKTtcblx0XHRcdHJlY29tbWVuZGF0aW9uLmhpZGRlbiA9ICEgbGFuZ3VhZ2VfY29udGV4dC5pc191cGRhdGVfcmVjb21tZW5kZWQgfHwgISBsYW5ndWFnZV9jb250ZXh0LnVwZGF0ZV9yZWNvbW1lbmRhdGlvbjtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlIHRoZSBzaGVsbCBhZGFwdGVyIGZvciB0aGUgU3RlcCAzIGV4cGxpY2l0IGFjdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGFkYXB0ZXJfY29uZmlnIExvY2FsaXplZCBtb2R1bGUgY29uZmlndXJhdGlvbi5cblx0ICogQHJldHVybiB7T2JqZWN0fSBTaGFyZWQgc2hlbGwgYWRhcHRlci5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9kYXRlX3RpbWVfZm9ybWF0c19hZGFwdGVyKCBhZGFwdGVyX2NvbmZpZyApIHtcblx0XHR2YXIgc2VydmljZXMgPSBudWxsO1xuXHRcdHZhciByb290ID0gbnVsbDtcblx0XHR2YXIgZWRpdG9yID0gbnVsbDtcblx0XHRhZGFwdGVyX2NvbmZpZyA9IGFkYXB0ZXJfY29uZmlnIHx8IHsgaTE4bjoge30gfTtcblx0XHRhZGFwdGVyX2NvbmZpZy5pMThuID0gYWRhcHRlcl9jb25maWcuaTE4biB8fCB7fTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHQvKipcblx0XHRcdCAqIEJpbmQgdGhlIExvY2FsIHRyYW5zbGF0aW9uIGFjdGlvbiB3aGVuIGl0IGlzIGF1dGhvcml6ZWQgYW5kIHJlbmRlcmVkLlxuXHRcdFx0ICpcblx0XHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBzaGVsbF9zZXJ2aWNlcyBEb21haW4tbmV1dHJhbCBzaGVsbCBzZXJ2aWNlcy5cblx0XHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0XHQgKi9cblx0XHRcdGluaXRpYWxpemU6IGZ1bmN0aW9uICggc2hlbGxfc2VydmljZXMgKSB7XG5cdFx0XHRcdHNlcnZpY2VzID0gc2hlbGxfc2VydmljZXM7XG5cdFx0XHRcdHJvb3QgPSBzaGVsbF9zZXJ2aWNlcy5yb290O1xuXHRcdFx0XHRlZGl0b3IgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWRhdGUtdGltZS1mb3JtYXRzLWVkaXRvcl0nICk7XG5cblx0XHRcdFx0aWYgKCAhIGVkaXRvciApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlZGl0b3IuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdFx0XHR2YXIgaW5zdGFsbF9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtaW5zdGFsbC1sb2NhbC10cmFuc2xhdGlvbl0nICk7XG5cdFx0XHRcdFx0dmFyIGZlZWRiYWNrO1xuXHRcdFx0XHRcdHZhciBvcGVyYXRpb25fY29uc29sZTtcblx0XHRcdFx0XHR2YXIgY29uc29sZV9sb2c7XG5cdFx0XHRcdFx0dmFyIGNvbnNvbGVfc3RhdGU7XG5cdFx0XHRcdFx0dmFyIHNvdXJjZTtcblx0XHRcdFx0XHR2YXIgc291cmNlX2xhYmVsO1xuXHRcdFx0XHRcdHZhciBwcmV2aW91c19zb3VyY2U7XG5cdFx0XHRcdFx0dmFyIHByZXZpb3VzX3NvdXJjZV9sYWJlbDtcblx0XHRcdFx0XHR2YXIgcmVsb2FkX3BlbmRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHR2YXIgc2VxdWVuY2U7XG5cdFx0XHRcdFx0dmFyIHJlcXVlc3RfaWQ7XG5cdFx0XHRcdFx0dmFyIHJlcXVlc3Q7XG5cblx0XHRcdFx0XHRpZiAoICEgaW5zdGFsbF9idXR0b24gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0XHRmZWVkYmFjayA9IGVkaXRvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1sb2NhbC10cmFuc2xhdGlvbi1mZWVkYmFja10nICk7XG5cdFx0XHRcdFx0b3BlcmF0aW9uX2NvbnNvbGUgPSBlZGl0b3IucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtbG9jYWwtdHJhbnNsYXRpb24tY29uc29sZV0nICk7XG5cdFx0XHRcdFx0Y29uc29sZV9sb2cgPSBlZGl0b3IucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtbG9jYWwtdHJhbnNsYXRpb24tY29uc29sZS1sb2ddJyApO1xuXHRcdFx0XHRcdGNvbnNvbGVfc3RhdGUgPSBlZGl0b3IucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtbG9jYWwtdHJhbnNsYXRpb24tY29uc29sZS1zdGF0ZV0nICk7XG5cdFx0XHRcdFx0c291cmNlID0gZWRpdG9yLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWxvY2FsLXRyYW5zbGF0aW9uLXNvdXJjZV0nICk7XG5cdFx0XHRcdFx0c291cmNlX2xhYmVsID0gZWRpdG9yLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWxvY2FsLXRyYW5zbGF0aW9uLXNvdXJjZS1sYWJlbF0nICk7XG5cdFx0XHRcdFx0cHJldmlvdXNfc291cmNlID0gc291cmNlID8gc291cmNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1sb2NhbC10cmFuc2xhdGlvbi1zb3VyY2UnICkgOiAnJztcblx0XHRcdFx0XHRwcmV2aW91c19zb3VyY2VfbGFiZWwgPSBzb3VyY2VfbGFiZWwgPyBzb3VyY2VfbGFiZWwudGV4dENvbnRlbnQgOiAnJztcblx0XHRcdFx0XHRyZXF1ZXN0X3NlcXVlbmNlICs9IDE7XG5cdFx0XHRcdFx0c2VxdWVuY2UgPSByZXF1ZXN0X3NlcXVlbmNlO1xuXHRcdFx0XHRcdHJlcXVlc3RfaWQgPSAndHJhbnNsYXRpb25fJyArIERhdGUubm93KCkgKyAnXycgKyBzZXF1ZW5jZTtcblxuXHRcdFx0XHRcdGlmICggZmVlZGJhY2sgKSB7XG5cdFx0XHRcdFx0XHRmZWVkYmFjay5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtZXJyb3InLCAnaXMtc3VjY2VzcycgKTtcblx0XHRcdFx0XHRcdGZlZWRiYWNrLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggb3BlcmF0aW9uX2NvbnNvbGUgKSB7XG5cdFx0XHRcdFx0XHRvcGVyYXRpb25fY29uc29sZS5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdFx0XHRcdG9wZXJhdGlvbl9jb25zb2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICd0cnVlJyApO1xuXHRcdFx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygb3BlcmF0aW9uX2NvbnNvbGUuc2Nyb2xsSW50b1ZpZXcgKSB7XG5cdFx0XHRcdFx0XHRcdG9wZXJhdGlvbl9jb25zb2xlLnNjcm9sbEludG9WaWV3KCB7IGJsb2NrOiAnbmVhcmVzdCcgfSApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGNvbnNvbGVfc3RhdGUgKSB7XG5cdFx0XHRcdFx0XHRjb25zb2xlX3N0YXRlLnRleHRDb250ZW50ID0gYWRhcHRlcl9jb25maWcuaTE4bi53b3JraW5nIHx8ICcnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIGNvbnNvbGVfbG9nICkge1xuXHRcdFx0XHRcdFx0Y29uc29sZV9sb2cudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdFx0XHRcdGFwcGVuZF9vcGVyYXRpb25fbG9nKCBjb25zb2xlX2xvZywgJ2luZm8nLCBhZGFwdGVyX2NvbmZpZy5pMThuLmNvbm5lY3RpbmcgfHwgYWRhcHRlcl9jb25maWcuaTE4bi53b3JraW5nIHx8ICcnICk7XG5cdFx0XHRcdFx0XHRhcHBlbmRfb3BlcmF0aW9uX2xvZyggY29uc29sZV9sb2csICdpbmZvJywgYWRhcHRlcl9jb25maWcuaTE4bi53b3JraW5nIHx8ICcnICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICggc291cmNlICkge1xuXHRcdFx0XHRcdFx0c291cmNlLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1sb2NhbC10cmFuc2xhdGlvbi1zb3VyY2UnLCAnd3BiYycgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCBzb3VyY2VfbGFiZWwgKSB7XG5cdFx0XHRcdFx0XHRzb3VyY2VfbGFiZWwudGV4dENvbnRlbnQgPSBhZGFwdGVyX2NvbmZpZy5pMThuLmxvY2FsX3NvdXJjZV9sYWJlbCB8fCBwcmV2aW91c19zb3VyY2VfbGFiZWw7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aW5zdGFsbF9idXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdHNlcnZpY2VzLnNldF9zdGF0dXMoIGFkYXB0ZXJfY29uZmlnLmkxOG4ud29ya2luZyB8fCAnJyApO1xuXHRcdFx0XHRcdHJlcXVlc3QgPSAkLmFqYXgoIHtcblx0XHRcdFx0XHRcdHVybDogYWRhcHRlcl9jb25maWcuYWpheF91cmwsXG5cdFx0XHRcdFx0XHRtZXRob2Q6ICdQT1NUJyxcblx0XHRcdFx0XHRcdGRhdGFUeXBlOiAnanNvbicsXG5cdFx0XHRcdFx0XHRkYXRhOiB7XG5cdFx0XHRcdFx0XHRcdGFjdGlvbjogYWRhcHRlcl9jb25maWcuYWN0aW9uLFxuXHRcdFx0XHRcdFx0XHRub25jZTogYWRhcHRlcl9jb25maWcubm9uY2UsXG5cdFx0XHRcdFx0XHRcdHJlcXVlc3RfaWQ6IHJlcXVlc3RfaWRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cblx0XHRcdFx0XHRyZXF1ZXN0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0XHR2YXIgb3BlcmF0aW9uX2xvZ3M7XG5cblx0XHRcdFx0XHRcdGlmICggc2VxdWVuY2UgIT09IHJlcXVlc3Rfc2VxdWVuY2UgfHwgISByZXNwb25zZSB8fCAhIHJlc3BvbnNlLnN1Y2Nlc3MgfHwgISByZXNwb25zZS5kYXRhIHx8IHJlc3BvbnNlLmRhdGEucmVxdWVzdF9pZCAhPT0gcmVxdWVzdF9pZCApIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRvcGVyYXRpb25fbG9ncyA9IGdldF9vcGVyYXRpb25fbG9ncyggcmVzcG9uc2UuZGF0YSApO1xuXHRcdFx0XHRcdFx0cmVuZGVyX29wZXJhdGlvbl9sb2dzKCBjb25zb2xlX2xvZywgb3BlcmF0aW9uX2xvZ3MgKTtcblx0XHRcdFx0XHRcdGlmICggY29uc29sZV9zdGF0ZSApIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZV9zdGF0ZS50ZXh0Q29udGVudCA9IGFkYXB0ZXJfY29uZmlnLmkxOG4uY29tcGxldGUgfHwgJyc7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGlmICggZmVlZGJhY2sgKSB7XG5cdFx0XHRcdFx0XHRcdGZlZWRiYWNrLmNsYXNzTGlzdC5hZGQoICdpcy1zdWNjZXNzJyApO1xuXHRcdFx0XHRcdFx0XHRmZWVkYmFjay50ZXh0Q29udGVudCA9IFN0cmluZyggcmVzcG9uc2UuZGF0YS5tZXNzYWdlIHx8ICcnICk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHVwZGF0ZV9sYW5ndWFnZV9jb250ZXh0KCBlZGl0b3IsIHJlc3BvbnNlLmRhdGEubGFuZ3VhZ2UgKTtcblxuXHRcdFx0XHRcdFx0c2VydmljZXMuc2V0X3N0YXR1cyggU3RyaW5nKCByZXNwb25zZS5kYXRhLm1lc3NhZ2UgfHwgJycgKSApO1xuXHRcdFx0XHRcdFx0aWYgKCB0cnVlID09PSByZXNwb25zZS5kYXRhLnJlbG9hZF9wYWdlICkge1xuXHRcdFx0XHRcdFx0XHRyZWxvYWRfcGVuZGluZyA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGlmICggY29uc29sZV9zdGF0ZSApIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlX3N0YXRlLnRleHRDb250ZW50ID0gYWRhcHRlcl9jb25maWcuaTE4bi5yZWxvYWRpbmcgfHwgYWRhcHRlcl9jb25maWcuaTE4bi5jb21wbGV0ZSB8fCAnJztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdFx0XHRcdHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcblx0XHRcdFx0XHRcdFx0fSwgMjUwICk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0cmVxdWVzdC5mYWlsKCBmdW5jdGlvbiAoIHhociApIHtcblx0XHRcdFx0XHRcdHZhciBtZXNzYWdlO1xuXHRcdFx0XHRcdFx0dmFyIHJlc3BvbnNlX2RhdGE7XG5cdFx0XHRcdFx0XHR2YXIgb3BlcmF0aW9uX2xvZ3M7XG5cblx0XHRcdFx0XHRcdGlmICggc2VxdWVuY2UgIT09IHJlcXVlc3Rfc2VxdWVuY2UgKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bWVzc2FnZSA9IGdldF9lcnJvcl9tZXNzYWdlKCB4aHIsIGFkYXB0ZXJfY29uZmlnICk7XG5cdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhID0geGhyICYmIHhoci5yZXNwb25zZUpTT04gPyB4aHIucmVzcG9uc2VKU09OLmRhdGEgOiBudWxsO1xuXHRcdFx0XHRcdFx0b3BlcmF0aW9uX2xvZ3MgPSBnZXRfb3BlcmF0aW9uX2xvZ3MoIHJlc3BvbnNlX2RhdGEgKTtcblx0XHRcdFx0XHRcdGlmICggcmVzcG9uc2VfZGF0YSAmJiByZXNwb25zZV9kYXRhLmxhbmd1YWdlICkge1xuXHRcdFx0XHRcdFx0XHR1cGRhdGVfbGFuZ3VhZ2VfY29udGV4dCggZWRpdG9yLCByZXNwb25zZV9kYXRhLmxhbmd1YWdlICk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRpZiAoIHNvdXJjZSApIHtcblx0XHRcdFx0XHRcdFx0XHRzb3VyY2Uuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWxvY2FsLXRyYW5zbGF0aW9uLXNvdXJjZScsIHByZXZpb3VzX3NvdXJjZSB8fCAnJyApO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmICggc291cmNlX2xhYmVsICkge1xuXHRcdFx0XHRcdFx0XHRcdHNvdXJjZV9sYWJlbC50ZXh0Q29udGVudCA9IHByZXZpb3VzX3NvdXJjZV9sYWJlbCB8fCAnJztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmVuZGVyX29wZXJhdGlvbl9sb2dzKCBjb25zb2xlX2xvZywgb3BlcmF0aW9uX2xvZ3MgKTtcblx0XHRcdFx0XHRcdGlmICggMCA9PT0gb3BlcmF0aW9uX2xvZ3MubGVuZ3RoICkge1xuXHRcdFx0XHRcdFx0XHRhcHBlbmRfb3BlcmF0aW9uX2xvZyggY29uc29sZV9sb2csICdlcnJvcicsIG1lc3NhZ2UgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICggY29uc29sZV9zdGF0ZSApIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZV9zdGF0ZS50ZXh0Q29udGVudCA9IGFkYXB0ZXJfY29uZmlnLmkxOG4uZmFpbGVkIHx8ICcnO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCBmZWVkYmFjayApIHtcblx0XHRcdFx0XHRcdFx0ZmVlZGJhY2suY2xhc3NMaXN0LmFkZCggJ2lzLWVycm9yJyApO1xuXHRcdFx0XHRcdFx0XHRmZWVkYmFjay50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRzZXJ2aWNlcy5zZXRfc3RhdHVzKCBtZXNzYWdlICk7XG5cdFx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdFx0cmVxdWVzdC5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdGlmICggc2VxdWVuY2UgPT09IHJlcXVlc3Rfc2VxdWVuY2UgJiYgISByZWxvYWRfcGVuZGluZyApIHtcblx0XHRcdFx0XHRcdFx0aW5zdGFsbF9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0aWYgKCBvcGVyYXRpb25fY29uc29sZSApIHtcblx0XHRcdFx0XHRcdFx0XHRvcGVyYXRpb25fY29uc29sZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAnZmFsc2UnICk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0sXG5cblx0XHRcdC8qKlxuXHRcdFx0ICogU3RlcCAzIG5hdGl2ZSBjb250cm9scyBuZWVkIG5vIGRyYWZ0IHN5bmNocm9uaXphdGlvbi5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdFx0ICovXG5cdFx0XHRzeW5jOiBmdW5jdGlvbiAoKSB7fSxcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBTZXJ2ZXIgYW5kIG5hdGl2ZSByZXF1aXJlZC1zZWxlY3QgdmFsaWRhdGlvbiByZW1haW4gYXV0aG9yaXRhdGl2ZS5cblx0XHRcdCAqXG5cdFx0XHQgKiBAcmV0dXJuIHtudWxsfSBObyBtb2R1bGUtc3BlY2lmaWMgaW52YWxpZCBjb250cm9sLlxuXHRcdFx0ICovXG5cdFx0XHR2YWxpZGF0ZTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgPSB3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyB8fCB7fTtcblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMuZGF0ZV90aW1lX2Zvcm1hdHMgPSB7XG5cdFx0Y3JlYXRlOiBjcmVhdGVfZGF0ZV90aW1lX2Zvcm1hdHNfYWRhcHRlclxuXHR9O1xuXG5cdGlmICggd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaS5yZWdpc3Rlcl9zdGVwX2FkYXB0ZXIgKSB7XG5cdFx0d2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaS5yZWdpc3Rlcl9zdGVwX2FkYXB0ZXIoIGNyZWF0ZV9kYXRlX3RpbWVfZm9ybWF0c19hZGFwdGVyKCBtb2R1bGVfY29uZmlnICkgKTtcblx0fVxufSggalF1ZXJ5LCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxDQUFDLEVBQUVDLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQ2xDLFlBQVk7O0VBRVosSUFBSUMsYUFBYSxHQUFHRixNQUFNLENBQUNHLG1DQUFtQyxJQUFJO0lBQUVDLElBQUksRUFBRSxDQUFDO0VBQUUsQ0FBQztFQUM5RSxJQUFJQyxnQkFBZ0IsR0FBRyxDQUFDOztFQUV4QjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGlCQUFpQkEsQ0FBRUMsR0FBRyxFQUFF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O1lBQ0EsSUFBSzhELGFBQWEsRUFBRztjQUNwQkEsYUFBYSxDQUFDN0MsV0FBVyxHQUFHcEIsY0FBYyxDQUFDSixJQUFJLENBQUM2RyxNQUFNLElBQUksRUFBRTtZQUM3RDtZQUNBLElBQUszQyxRQUFRLEVBQUc7Y0FDZkEsUUFBUSxDQUFDbEIsU0FBUyxDQUFDbUQsR0FBRyxDQUFFLFVBQVcsQ0FBQztjQUNwQ2pDLFFBQVEsQ0FBQzFDLFdBQVcsR0FBR2pCLE9BQU87WUFDL0I7WUFDQWtELFFBQVEsQ0FBQzhCLFVBQVUsQ0FBRWhGLE9BQVEsQ0FBQztVQUMvQixDQUFFLENBQUM7VUFFSG9FLE9BQU8sQ0FBQ21DLE1BQU0sQ0FBRSxZQUFZO1lBQzNCLElBQUtyQyxRQUFRLEtBQUt4RSxnQkFBZ0IsSUFBSSxDQUFFdUUsY0FBYyxFQUFHO2NBQ3hEVCxjQUFjLENBQUN1QixRQUFRLEdBQUcsS0FBSztjQUMvQixJQUFLbkIsaUJBQWlCLEVBQUc7Z0JBQ3hCQSxpQkFBaUIsQ0FBQ3RCLFlBQVksQ0FBRSxXQUFXLEVBQUUsT0FBUSxDQUFDO2NBQ3ZEO1lBQ0Q7VUFDRCxDQUFFLENBQUM7UUFDSixDQUFFLENBQUM7TUFDSixDQUFDO01BRUQ7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHa0UsSUFBSSxFQUFFLFNBQUFBLENBQUEsRUFBWSxDQUFDLENBQUM7TUFFcEI7QUFDSDtBQUNBO0FBQ0E7QUFDQTtNQUNHQyxRQUFRLEVBQUUsU0FBQUEsQ0FBQSxFQUFZO1FBQ3JCLE9BQU8sSUFBSTtNQUNaO0lBQ0QsQ0FBQztFQUNGO0VBRUFwSCxNQUFNLENBQUNxSCx5QkFBeUIsR0FBR3JILE1BQU0sQ0FBQ3FILHlCQUF5QixJQUFJLENBQUMsQ0FBQztFQUN6RXJILE1BQU0sQ0FBQ3FILHlCQUF5QixDQUFDQyxpQkFBaUIsR0FBRztJQUNwREMsTUFBTSxFQUFFM0Q7RUFDVCxDQUFDO0VBRUQsSUFBSzVELE1BQU0sQ0FBQ3dILHFCQUFxQixJQUFJLFVBQVUsS0FBSyxPQUFPeEgsTUFBTSxDQUFDd0gscUJBQXFCLENBQUNDLHFCQUFxQixFQUFHO0lBQy9HekgsTUFBTSxDQUFDd0gscUJBQXFCLENBQUNDLHFCQUFxQixDQUFFN0QsZ0NBQWdDLENBQUUxRCxhQUFjLENBQUUsQ0FBQztFQUN4RztBQUNELENBQUMsRUFBRXdILE1BQU0sRUFBRTFILE1BQU0sRUFBRUMsUUFBUyxDQUFDIiwiaWdub3JlTGlzdCI6W119
