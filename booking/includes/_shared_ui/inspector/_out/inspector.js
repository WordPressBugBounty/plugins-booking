"use strict";

/**
 * Domain-neutral administration inspector lifecycle and focus mechanics.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var focusable_selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var layer_open_event = 'wpbc:shared-ui-layer-open';
  var layer_close_event = 'wpbc:shared-ui-layer-close';

  /**
   * Normalize an Inspector interaction identifier.
   *
   * @param {*} candidate Candidate identifier.
   * @return {string} Bounded DOM-safe identifier.
   */
  function normalize_layer_id(candidate) {
    return String(candidate || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  }

  /**
   * Declare the Inspector's domain-neutral floating-layer ownership metadata.
   *
   * @param {HTMLElement} root     Shared Inspector root.
   * @param {Object}      settings Controller options.
   * @return {Object|null} Four-key descriptor or null when the ID is invalid.
   */
  function declare_layer(root, settings) {
    var panel = root && root.querySelector ? root.querySelector('.wpbc_shared_ui_inspector__panel') : null;
    var instance_id = normalize_layer_id(root ? root.getAttribute('data-wpbc-shared-ui-inspector') : '');
    var owner_id = normalize_layer_id(settings.owner_id) || instance_id;
    var interaction_group = normalize_layer_id(settings.interaction_group) || instance_id;
    var descriptor;
    if (!instance_id) {
      return null;
    }
    descriptor = {
      layer_type: 'inspector',
      instance_id: instance_id,
      owner_id: owner_id,
      interaction_group: interaction_group
    };
    [root, panel].forEach(function (layer_element) {
      if (!layer_element) {
        return;
      }
      layer_element.setAttribute('data-wpbc-shared-ui-layer-type', descriptor.layer_type);
      layer_element.setAttribute('data-wpbc-shared-ui-layer-instance', descriptor.instance_id);
      layer_element.setAttribute('data-wpbc-shared-ui-layer-owner', descriptor.owner_id);
      layer_element.setAttribute('data-wpbc-shared-ui-layer-interaction-group', descriptor.interaction_group);
    });
    return descriptor;
  }

  /**
   * Announce an Inspector layer lifecycle using identifier-only metadata.
   *
   * @param {string} event_name Open or close protocol event name.
   * @param {Object} descriptor Normalized Inspector descriptor.
   * @return {void}
   */
  function dispatch_layer_event(event_name, descriptor) {
    var layer_event;
    if (!descriptor || -1 === [layer_open_event, layer_close_event].indexOf(event_name)) {
      return;
    }
    if ('function' === typeof window.CustomEvent) {
      layer_event = new window.CustomEvent(event_name, {
        detail: descriptor
      });
    } else {
      layer_event = document.createEvent('CustomEvent');
      layer_event.initCustomEvent(event_name, false, false, descriptor);
    }
    document.dispatchEvent(layer_event);
  }

  /**
   * Create one inspector controller for an already rendered shell.
   *
   * The caller owns all domain data and renders domain templates into the
   * content host. The controller never sends a request or mutates domain data.
   *
   * @param {HTMLElement} root     Rendered shared inspector root.
   * @param {Object}      options  Optional lifecycle callbacks.
   * @return {Object|null} Inspector API or null for invalid markup.
   */
  function create(root, options) {
    var settings = options && 'object' === typeof options ? options : {};
    var panel = root && root.querySelector ? root.querySelector('.wpbc_shared_ui_inspector__panel') : null;
    var heading = root && root.querySelector ? root.querySelector('.wpbc_shared_ui_inspector__heading') : null;
    var header_content = root && root.querySelector ? root.querySelector('[data-wpbc-shared-ui-inspector-header-content]') : null;
    var status = root && root.querySelector ? root.querySelector('[data-wpbc-shared-ui-inspector-status]') : null;
    var loading = root && root.querySelector ? root.querySelector('[data-wpbc-shared-ui-inspector-loading]') : null;
    var loading_label = root && root.querySelector ? root.querySelector('[data-wpbc-shared-ui-inspector-loading-label]') : null;
    var error = root && root.querySelector ? root.querySelector('[data-wpbc-shared-ui-inspector-error]') : null;
    var content = root && root.querySelector ? root.querySelector('[data-wpbc-shared-ui-inspector-content]') : null;
    var return_focus = null;
    var layer_descriptor;
    if (!root || !panel || !heading || !header_content || !status || !loading || !error || !content) {
      return null;
    }
    layer_descriptor = declare_layer(root, settings);
    if (!layer_descriptor) {
      return null;
    }
    var default_heading = heading.textContent;

    /**
     * Return currently operable controls inside the inspector panel.
     *
     * @return {Array} Focusable elements in DOM order.
     */
    function get_focusable_elements() {
      return Array.prototype.filter.call(panel.querySelectorAll(focusable_selector), function (element) {
        return !element.hidden && null !== element.offsetParent;
      });
    }

    /**
     * Close the inspector and optionally restore its activating element.
     *
     * @param {boolean} restore_focus Whether to restore activation focus.
     * @return {void}
     */
    function close(restore_focus) {
      var focus_target = return_focus;
      if (root.hidden) {
        return;
      }
      if ('function' === typeof settings.on_before_close && false === settings.on_before_close()) {
        return;
      }
      root.hidden = true;
      root.classList.remove('is-open');
      status.textContent = '';
      if ('function' === typeof settings.on_close) {
        settings.on_close();
      }
      dispatch_layer_event(layer_close_event, layer_descriptor);
      return_focus = null;
      if (restore_focus && focus_target && focus_target.isConnected && 'function' === typeof focus_target.focus) {
        focus_target.focus();
      }
    }

    /**
     * Open the inspector and move focus to its accessible heading.
     *
     * @param {HTMLElement|null} trigger Activating element for focus restoration.
     * @return {void}
     */
    function open(trigger) {
      return_focus = trigger && 'function' === typeof trigger.focus ? trigger : document.activeElement;
      root.hidden = false;
      root.classList.add('is-open');
      dispatch_layer_event(layer_open_event, layer_descriptor);
      window.requestAnimationFrame(function () {
        if (!root.hidden) {
          heading.focus();
        }
      });
    }

    /**
     * Show an inspector loading state with a caller-owned label.
     *
     * @param {string} message Localized loading message.
     * @return {void}
     */
    function set_loading(message) {
      loading.hidden = false;
      error.hidden = true;
      content.hidden = true;
      content.textContent = '';
      if (loading_label) {
        loading_label.textContent = String(message || '');
      }
      status.textContent = String(message || '');
      panel.setAttribute('aria-busy', 'true');
    }

    /**
     * Show a safe caller-owned error without interpreting markup.
     *
     * @param {string} message Localized safe error message.
     * @return {void}
     */
    function set_error(message) {
      var paragraph = error.querySelector('p');
      loading.hidden = true;
      content.hidden = true;
      error.hidden = false;
      if (paragraph) {
        paragraph.textContent = String(message || '');
      }
      status.textContent = String(message || '');
      panel.setAttribute('aria-busy', 'false');
    }

    /**
     * Display caller-rendered domain template output.
     *
     * The HTML must be produced locally from an allow-listed WordPress
     * template and authorized DTO data; it must never be server-returned HTML.
     *
     * @param {string} rendered_content Domain template output.
     * @param {string} announcement     Localized completion announcement.
     * @return {void}
     */
    function set_content(rendered_content, announcement) {
      loading.hidden = true;
      error.hidden = true;
      content.innerHTML = String(rendered_content || '');
      content.hidden = false;
      status.textContent = String(announcement || '');
      panel.setAttribute('aria-busy', 'false');
    }

    /**
     * Display caller-rendered state content while preserving shell mechanics.
     *
     * The state HTML remains domain-owned and must be produced from an
     * allow-listed local WordPress template. The shared shell owns only the
     * visibility, announcement, and aria-busy behavior.
     *
     * @param {string}  rendered_content Caller-rendered state markup.
     * @param {string}  announcement     Localized state announcement.
     * @param {boolean} is_busy          Whether the panel remains busy.
     * @return {void}
     */
    function set_state(rendered_content, announcement, is_busy) {
      loading.hidden = true;
      error.hidden = true;
      content.innerHTML = String(rendered_content || '');
      content.hidden = false;
      status.textContent = String(announcement || '');
      panel.setAttribute('aria-busy', is_busy ? 'true' : 'false');
    }

    /**
     * Replace the visible header with caller-rendered domain content.
     *
     * The accessible dialog name remains plain text in the shell-owned heading.
     * The supplied HTML must come from an allow-listed local WordPress template.
     *
     * @param {string} rendered_header Domain header markup.
     * @param {string} accessible_title Plain localized dialog title.
     * @return {void}
     */
    function set_header(rendered_header, accessible_title) {
      heading.textContent = String(accessible_title || default_heading || '');
      heading.classList.add('wpbc_shared_ui_inspector__heading--visually-hidden');
      header_content.innerHTML = String(rendered_header || '');
      header_content.hidden = false;
    }

    /**
     * Restore the default shell heading before loading another domain record.
     *
     * @param {string} accessible_title Optional replacement default title.
     * @return {void}
     */
    function reset_header(accessible_title) {
      heading.textContent = String(accessible_title || default_heading || '');
      heading.classList.remove('wpbc_shared_ui_inspector__heading--visually-hidden');
      header_content.textContent = '';
      header_content.hidden = true;
    }

    /**
     * Handle close controls and the modal backdrop.
     *
     * @param {MouseEvent} event Inspector click event.
     * @return {void}
     */
    function handle_click(event) {
      if (event.target.closest('[data-wpbc-shared-ui-inspector-close]')) {
        event.preventDefault();
        close(true);
      }
    }

    /**
     * Close with Escape and contain Tab focus while the modal is open.
     *
     * @param {KeyboardEvent} event Inspector key event.
     * @return {void}
     */
    function handle_keydown(event) {
      var focusable_elements;
      var first_element;
      var last_element;
      if ('Escape' === event.key) {
        event.preventDefault();
        close(true);
        return;
      }
      if ('Tab' !== event.key) {
        return;
      }
      focusable_elements = get_focusable_elements();
      if (!focusable_elements.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      first_element = focusable_elements[0];
      last_element = focusable_elements[focusable_elements.length - 1];
      if (event.shiftKey && (document.activeElement === first_element || document.activeElement === panel || document.activeElement === heading)) {
        event.preventDefault();
        last_element.focus();
      } else if (!event.shiftKey && document.activeElement === last_element) {
        event.preventDefault();
        first_element.focus();
      }
    }
    root.addEventListener('click', handle_click);
    root.addEventListener('keydown', handle_keydown);
    return {
      open: open,
      close: close,
      set_loading: set_loading,
      set_error: set_error,
      set_content: set_content,
      set_state: set_state,
      set_header: set_header,
      reset_header: reset_header,
      is_open: function () {
        return !root.hidden;
      }
    };
  }
  window.wpbc_shared_ui_inspector = window.wpbc_shared_ui_inspector || {};
  window.wpbc_shared_ui_inspector.create = create;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZF91aS9pbnNwZWN0b3IvX291dC9pbnNwZWN0b3IuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsImZvY3VzYWJsZV9zZWxlY3RvciIsImxheWVyX29wZW5fZXZlbnQiLCJsYXllcl9jbG9zZV9ldmVudCIsIm5vcm1hbGl6ZV9sYXllcl9pZCIsImNhbmRpZGF0ZSIsIlN0cmluZyIsInJlcGxhY2UiLCJzbGljZSIsImRlY2xhcmVfbGF5ZXIiLCJyb290Iiwic2V0dGluZ3MiLCJwYW5lbCIsInF1ZXJ5U2VsZWN0b3IiLCJpbnN0YW5jZV9pZCIsImdldEF0dHJpYnV0ZSIsIm93bmVyX2lkIiwiaW50ZXJhY3Rpb25fZ3JvdXAiLCJkZXNjcmlwdG9yIiwibGF5ZXJfdHlwZSIsImZvckVhY2giLCJsYXllcl9lbGVtZW50Iiwic2V0QXR0cmlidXRlIiwiZGlzcGF0Y2hfbGF5ZXJfZXZlbnQiLCJldmVudF9uYW1lIiwibGF5ZXJfZXZlbnQiLCJpbmRleE9mIiwiQ3VzdG9tRXZlbnQiLCJkZXRhaWwiLCJjcmVhdGVFdmVudCIsImluaXRDdXN0b21FdmVudCIsImRpc3BhdGNoRXZlbnQiLCJjcmVhdGUiLCJvcHRpb25zIiwiaGVhZGluZyIsImhlYWRlcl9jb250ZW50Iiwic3RhdHVzIiwibG9hZGluZyIsImxvYWRpbmdfbGFiZWwiLCJlcnJvciIsImNvbnRlbnQiLCJyZXR1cm5fZm9jdXMiLCJsYXllcl9kZXNjcmlwdG9yIiwiZGVmYXVsdF9oZWFkaW5nIiwidGV4dENvbnRlbnQiLCJnZXRfZm9jdXNhYmxlX2VsZW1lbnRzIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmaWx0ZXIiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsImVsZW1lbnQiLCJoaWRkZW4iLCJvZmZzZXRQYXJlbnQiLCJjbG9zZSIsInJlc3RvcmVfZm9jdXMiLCJmb2N1c190YXJnZXQiLCJvbl9iZWZvcmVfY2xvc2UiLCJjbGFzc0xpc3QiLCJyZW1vdmUiLCJvbl9jbG9zZSIsImlzQ29ubmVjdGVkIiwiZm9jdXMiLCJvcGVuIiwidHJpZ2dlciIsImFjdGl2ZUVsZW1lbnQiLCJhZGQiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJzZXRfbG9hZGluZyIsIm1lc3NhZ2UiLCJzZXRfZXJyb3IiLCJwYXJhZ3JhcGgiLCJzZXRfY29udGVudCIsInJlbmRlcmVkX2NvbnRlbnQiLCJhbm5vdW5jZW1lbnQiLCJpbm5lckhUTUwiLCJzZXRfc3RhdGUiLCJpc19idXN5Iiwic2V0X2hlYWRlciIsInJlbmRlcmVkX2hlYWRlciIsImFjY2Vzc2libGVfdGl0bGUiLCJyZXNldF9oZWFkZXIiLCJoYW5kbGVfY2xpY2siLCJldmVudCIsInRhcmdldCIsImNsb3Nlc3QiLCJwcmV2ZW50RGVmYXVsdCIsImhhbmRsZV9rZXlkb3duIiwiZm9jdXNhYmxlX2VsZW1lbnRzIiwiZmlyc3RfZWxlbWVudCIsImxhc3RfZWxlbWVudCIsImtleSIsImxlbmd0aCIsInNoaWZ0S2V5IiwiYWRkRXZlbnRMaXN0ZW5lciIsImlzX29wZW4iLCJ3cGJjX3NoYXJlZF91aV9pbnNwZWN0b3IiXSwic291cmNlcyI6WyJpbmNsdWRlcy9fc2hhcmVkX3VpL2luc3BlY3Rvci9fc3JjL2luc3BlY3Rvci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERvbWFpbi1uZXV0cmFsIGFkbWluaXN0cmF0aW9uIGluc3BlY3RvciBsaWZlY3ljbGUgYW5kIGZvY3VzIG1lY2hhbmljcy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMi4wLjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgZm9jdXNhYmxlX3NlbGVjdG9yID0gJ2FbaHJlZl0sIGJ1dHRvbjpub3QoW2Rpc2FibGVkXSksIGlucHV0Om5vdChbZGlzYWJsZWRdKSwgc2VsZWN0Om5vdChbZGlzYWJsZWRdKSwgdGV4dGFyZWE6bm90KFtkaXNhYmxlZF0pLCBbdGFiaW5kZXhdOm5vdChbdGFiaW5kZXg9XCItMVwiXSknO1xuXHR2YXIgbGF5ZXJfb3Blbl9ldmVudCA9ICd3cGJjOnNoYXJlZC11aS1sYXllci1vcGVuJztcblx0dmFyIGxheWVyX2Nsb3NlX2V2ZW50ID0gJ3dwYmM6c2hhcmVkLXVpLWxheWVyLWNsb3NlJztcblxuXHQvKipcblx0ICogTm9ybWFsaXplIGFuIEluc3BlY3RvciBpbnRlcmFjdGlvbiBpZGVudGlmaWVyLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IGNhbmRpZGF0ZSBDYW5kaWRhdGUgaWRlbnRpZmllci5cblx0ICogQHJldHVybiB7c3RyaW5nfSBCb3VuZGVkIERPTS1zYWZlIGlkZW50aWZpZXIuXG5cdCAqL1xuXHRmdW5jdGlvbiBub3JtYWxpemVfbGF5ZXJfaWQoIGNhbmRpZGF0ZSApIHtcblx0XHRyZXR1cm4gU3RyaW5nKCBjYW5kaWRhdGUgfHwgJycgKS5yZXBsYWNlKCAvW15BLVphLXowLTlfLV0vZywgJycgKS5zbGljZSggMCwgMTIwICk7XG5cdH1cblxuXHQvKipcblx0ICogRGVjbGFyZSB0aGUgSW5zcGVjdG9yJ3MgZG9tYWluLW5ldXRyYWwgZmxvYXRpbmctbGF5ZXIgb3duZXJzaGlwIG1ldGFkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290ICAgICBTaGFyZWQgSW5zcGVjdG9yIHJvb3QuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIHNldHRpbmdzIENvbnRyb2xsZXIgb3B0aW9ucy5cblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IEZvdXIta2V5IGRlc2NyaXB0b3Igb3IgbnVsbCB3aGVuIHRoZSBJRCBpcyBpbnZhbGlkLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjbGFyZV9sYXllciggcm9vdCwgc2V0dGluZ3MgKSB7XG5cdFx0dmFyIHBhbmVsID0gcm9vdCAmJiByb290LnF1ZXJ5U2VsZWN0b3IgPyByb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yX19wYW5lbCcgKSA6IG51bGw7XG5cdFx0dmFyIGluc3RhbmNlX2lkID0gbm9ybWFsaXplX2xheWVyX2lkKCByb290ID8gcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWluc3BlY3RvcicgKSA6ICcnICk7XG5cdFx0dmFyIG93bmVyX2lkID0gbm9ybWFsaXplX2xheWVyX2lkKCBzZXR0aW5ncy5vd25lcl9pZCApIHx8IGluc3RhbmNlX2lkO1xuXHRcdHZhciBpbnRlcmFjdGlvbl9ncm91cCA9IG5vcm1hbGl6ZV9sYXllcl9pZCggc2V0dGluZ3MuaW50ZXJhY3Rpb25fZ3JvdXAgKSB8fCBpbnN0YW5jZV9pZDtcblx0XHR2YXIgZGVzY3JpcHRvcjtcblxuXHRcdGlmICggISBpbnN0YW5jZV9pZCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRkZXNjcmlwdG9yID0ge1xuXHRcdFx0bGF5ZXJfdHlwZTogJ2luc3BlY3RvcicsXG5cdFx0XHRpbnN0YW5jZV9pZDogaW5zdGFuY2VfaWQsXG5cdFx0XHRvd25lcl9pZDogb3duZXJfaWQsXG5cdFx0XHRpbnRlcmFjdGlvbl9ncm91cDogaW50ZXJhY3Rpb25fZ3JvdXBcblx0XHR9O1xuXHRcdFsgcm9vdCwgcGFuZWwgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIGxheWVyX2VsZW1lbnQgKSB7XG5cdFx0XHRpZiAoICEgbGF5ZXJfZWxlbWVudCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGF5ZXJfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWxheWVyLXR5cGUnLCBkZXNjcmlwdG9yLmxheWVyX3R5cGUgKTtcblx0XHRcdGxheWVyX2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1sYXllci1pbnN0YW5jZScsIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgKTtcblx0XHRcdGxheWVyX2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1sYXllci1vd25lcicsIGRlc2NyaXB0b3Iub3duZXJfaWQgKTtcblx0XHRcdGxheWVyX2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1sYXllci1pbnRlcmFjdGlvbi1ncm91cCcsIGRlc2NyaXB0b3IuaW50ZXJhY3Rpb25fZ3JvdXAgKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gZGVzY3JpcHRvcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBBbm5vdW5jZSBhbiBJbnNwZWN0b3IgbGF5ZXIgbGlmZWN5Y2xlIHVzaW5nIGlkZW50aWZpZXItb25seSBtZXRhZGF0YS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50X25hbWUgT3BlbiBvciBjbG9zZSBwcm90b2NvbCBldmVudCBuYW1lLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGVzY3JpcHRvciBOb3JtYWxpemVkIEluc3BlY3RvciBkZXNjcmlwdG9yLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGlzcGF0Y2hfbGF5ZXJfZXZlbnQoIGV2ZW50X25hbWUsIGRlc2NyaXB0b3IgKSB7XG5cdFx0dmFyIGxheWVyX2V2ZW50O1xuXG5cdFx0aWYgKCAhIGRlc2NyaXB0b3IgfHwgLTEgPT09IFsgbGF5ZXJfb3Blbl9ldmVudCwgbGF5ZXJfY2xvc2VfZXZlbnQgXS5pbmRleE9mKCBldmVudF9uYW1lICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdGxheWVyX2V2ZW50ID0gbmV3IHdpbmRvdy5DdXN0b21FdmVudCggZXZlbnRfbmFtZSwgeyBkZXRhaWw6IGRlc2NyaXB0b3IgfSApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsYXllcl9ldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG5cdFx0XHRsYXllcl9ldmVudC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIGZhbHNlLCBmYWxzZSwgZGVzY3JpcHRvciApO1xuXHRcdH1cblx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KCBsYXllcl9ldmVudCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgaW5zcGVjdG9yIGNvbnRyb2xsZXIgZm9yIGFuIGFscmVhZHkgcmVuZGVyZWQgc2hlbGwuXG5cdCAqXG5cdCAqIFRoZSBjYWxsZXIgb3ducyBhbGwgZG9tYWluIGRhdGEgYW5kIHJlbmRlcnMgZG9tYWluIHRlbXBsYXRlcyBpbnRvIHRoZVxuXHQgKiBjb250ZW50IGhvc3QuIFRoZSBjb250cm9sbGVyIG5ldmVyIHNlbmRzIGEgcmVxdWVzdCBvciBtdXRhdGVzIGRvbWFpbiBkYXRhLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSByb290ICAgICBSZW5kZXJlZCBzaGFyZWQgaW5zcGVjdG9yIHJvb3QuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIG9wdGlvbnMgIE9wdGlvbmFsIGxpZmVjeWNsZSBjYWxsYmFja3MuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBJbnNwZWN0b3IgQVBJIG9yIG51bGwgZm9yIGludmFsaWQgbWFya3VwLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlKCByb290LCBvcHRpb25zICkge1xuXHRcdHZhciBzZXR0aW5ncyA9IG9wdGlvbnMgJiYgJ29iamVjdCcgPT09IHR5cGVvZiBvcHRpb25zID8gb3B0aW9ucyA6IHt9O1xuXHRcdHZhciBwYW5lbCA9IHJvb3QgJiYgcm9vdC5xdWVyeVNlbGVjdG9yID8gcm9vdC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfc2hhcmVkX3VpX2luc3BlY3Rvcl9fcGFuZWwnICkgOiBudWxsO1xuXHRcdHZhciBoZWFkaW5nID0gcm9vdCAmJiByb290LnF1ZXJ5U2VsZWN0b3IgPyByb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yX19oZWFkaW5nJyApIDogbnVsbDtcblx0XHR2YXIgaGVhZGVyX2NvbnRlbnQgPSByb290ICYmIHJvb3QucXVlcnlTZWxlY3RvciA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWluc3BlY3Rvci1oZWFkZXItY29udGVudF0nICkgOiBudWxsO1xuXHRcdHZhciBzdGF0dXMgPSByb290ICYmIHJvb3QucXVlcnlTZWxlY3RvciA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWluc3BlY3Rvci1zdGF0dXNdJyApIDogbnVsbDtcblx0XHR2YXIgbG9hZGluZyA9IHJvb3QgJiYgcm9vdC5xdWVyeVNlbGVjdG9yID8gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktaW5zcGVjdG9yLWxvYWRpbmddJyApIDogbnVsbDtcblx0XHR2YXIgbG9hZGluZ19sYWJlbCA9IHJvb3QgJiYgcm9vdC5xdWVyeVNlbGVjdG9yID8gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zaGFyZWQtdWktaW5zcGVjdG9yLWxvYWRpbmctbGFiZWxdJyApIDogbnVsbDtcblx0XHR2YXIgZXJyb3IgPSByb290ICYmIHJvb3QucXVlcnlTZWxlY3RvciA/IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLWluc3BlY3Rvci1lcnJvcl0nICkgOiBudWxsO1xuXHRcdHZhciBjb250ZW50ID0gcm9vdCAmJiByb290LnF1ZXJ5U2VsZWN0b3IgPyByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNoYXJlZC11aS1pbnNwZWN0b3ItY29udGVudF0nICkgOiBudWxsO1xuXHRcdHZhciByZXR1cm5fZm9jdXMgPSBudWxsO1xuXHRcdHZhciBsYXllcl9kZXNjcmlwdG9yO1xuXG5cdFx0aWYgKCAhIHJvb3QgfHwgISBwYW5lbCB8fCAhIGhlYWRpbmcgfHwgISBoZWFkZXJfY29udGVudCB8fCAhIHN0YXR1cyB8fCAhIGxvYWRpbmcgfHwgISBlcnJvciB8fCAhIGNvbnRlbnQgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0bGF5ZXJfZGVzY3JpcHRvciA9IGRlY2xhcmVfbGF5ZXIoIHJvb3QsIHNldHRpbmdzICk7XG5cdFx0aWYgKCAhIGxheWVyX2Rlc2NyaXB0b3IgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHR2YXIgZGVmYXVsdF9oZWFkaW5nID0gaGVhZGluZy50ZXh0Q29udGVudDtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBjdXJyZW50bHkgb3BlcmFibGUgY29udHJvbHMgaW5zaWRlIHRoZSBpbnNwZWN0b3IgcGFuZWwuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtBcnJheX0gRm9jdXNhYmxlIGVsZW1lbnRzIGluIERPTSBvcmRlci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfZm9jdXNhYmxlX2VsZW1lbnRzKCkge1xuXHRcdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbCggcGFuZWwucXVlcnlTZWxlY3RvckFsbCggZm9jdXNhYmxlX3NlbGVjdG9yICksIGZ1bmN0aW9uICggZWxlbWVudCApIHtcblx0XHRcdFx0cmV0dXJuICEgZWxlbWVudC5oaWRkZW4gJiYgbnVsbCAhPT0gZWxlbWVudC5vZmZzZXRQYXJlbnQ7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xvc2UgdGhlIGluc3BlY3RvciBhbmQgb3B0aW9uYWxseSByZXN0b3JlIGl0cyBhY3RpdmF0aW5nIGVsZW1lbnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHJlc3RvcmVfZm9jdXMgV2hldGhlciB0byByZXN0b3JlIGFjdGl2YXRpb24gZm9jdXMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbG9zZSggcmVzdG9yZV9mb2N1cyApIHtcblx0XHRcdHZhciBmb2N1c190YXJnZXQgPSByZXR1cm5fZm9jdXM7XG5cblx0XHRcdGlmICggcm9vdC5oaWRkZW4gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNldHRpbmdzLm9uX2JlZm9yZV9jbG9zZSAmJiBmYWxzZSA9PT0gc2V0dGluZ3Mub25fYmVmb3JlX2Nsb3NlKCkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHJvb3QuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdHJvb3QuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLW9wZW4nICk7XG5cdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHNldHRpbmdzLm9uX2Nsb3NlICkge1xuXHRcdFx0XHRzZXR0aW5ncy5vbl9jbG9zZSgpO1xuXHRcdFx0fVxuXHRcdFx0ZGlzcGF0Y2hfbGF5ZXJfZXZlbnQoIGxheWVyX2Nsb3NlX2V2ZW50LCBsYXllcl9kZXNjcmlwdG9yICk7XG5cdFx0XHRyZXR1cm5fZm9jdXMgPSBudWxsO1xuXHRcdFx0aWYgKCByZXN0b3JlX2ZvY3VzICYmIGZvY3VzX3RhcmdldCAmJiBmb2N1c190YXJnZXQuaXNDb25uZWN0ZWQgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT3BlbiB0aGUgaW5zcGVjdG9yIGFuZCBtb3ZlIGZvY3VzIHRvIGl0cyBhY2Nlc3NpYmxlIGhlYWRpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IHRyaWdnZXIgQWN0aXZhdGluZyBlbGVtZW50IGZvciBmb2N1cyByZXN0b3JhdGlvbi5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG9wZW4oIHRyaWdnZXIgKSB7XG5cdFx0XHRyZXR1cm5fZm9jdXMgPSB0cmlnZ2VyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0cmlnZ2VyLmZvY3VzID8gdHJpZ2dlciA6IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0XHRyb290LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0cm9vdC5jbGFzc0xpc3QuYWRkKCAnaXMtb3BlbicgKTtcblx0XHRcdGRpc3BhdGNoX2xheWVyX2V2ZW50KCBsYXllcl9vcGVuX2V2ZW50LCBsYXllcl9kZXNjcmlwdG9yICk7XG5cdFx0XHR3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGlmICggISByb290LmhpZGRlbiApIHtcblx0XHRcdFx0XHRoZWFkaW5nLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaG93IGFuIGluc3BlY3RvciBsb2FkaW5nIHN0YXRlIHdpdGggYSBjYWxsZXItb3duZWQgbGFiZWwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBMb2NhbGl6ZWQgbG9hZGluZyBtZXNzYWdlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2xvYWRpbmcoIG1lc3NhZ2UgKSB7XG5cdFx0XHRsb2FkaW5nLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0ZXJyb3IuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdGNvbnRlbnQuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdGNvbnRlbnQudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdGlmICggbG9hZGluZ19sYWJlbCApIHtcblx0XHRcdFx0bG9hZGluZ19sYWJlbC50ZXh0Q29udGVudCA9IFN0cmluZyggbWVzc2FnZSB8fCAnJyApO1xuXHRcdFx0fVxuXHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gU3RyaW5nKCBtZXNzYWdlIHx8ICcnICk7XG5cdFx0XHRwYW5lbC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCAndHJ1ZScgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaG93IGEgc2FmZSBjYWxsZXItb3duZWQgZXJyb3Igd2l0aG91dCBpbnRlcnByZXRpbmcgbWFya3VwLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgTG9jYWxpemVkIHNhZmUgZXJyb3IgbWVzc2FnZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9lcnJvciggbWVzc2FnZSApIHtcblx0XHRcdHZhciBwYXJhZ3JhcGggPSBlcnJvci5xdWVyeVNlbGVjdG9yKCAncCcgKTtcblxuXHRcdFx0bG9hZGluZy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0Y29udGVudC5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0ZXJyb3IuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRpZiAoIHBhcmFncmFwaCApIHtcblx0XHRcdFx0cGFyYWdyYXBoLnRleHRDb250ZW50ID0gU3RyaW5nKCBtZXNzYWdlIHx8ICcnICk7XG5cdFx0XHR9XG5cdFx0XHRzdGF0dXMudGV4dENvbnRlbnQgPSBTdHJpbmcoIG1lc3NhZ2UgfHwgJycgKTtcblx0XHRcdHBhbmVsLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdmYWxzZScgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEaXNwbGF5IGNhbGxlci1yZW5kZXJlZCBkb21haW4gdGVtcGxhdGUgb3V0cHV0LlxuXHRcdCAqXG5cdFx0ICogVGhlIEhUTUwgbXVzdCBiZSBwcm9kdWNlZCBsb2NhbGx5IGZyb20gYW4gYWxsb3ctbGlzdGVkIFdvcmRQcmVzc1xuXHRcdCAqIHRlbXBsYXRlIGFuZCBhdXRob3JpemVkIERUTyBkYXRhOyBpdCBtdXN0IG5ldmVyIGJlIHNlcnZlci1yZXR1cm5lZCBIVE1MLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHJlbmRlcmVkX2NvbnRlbnQgRG9tYWluIHRlbXBsYXRlIG91dHB1dC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gYW5ub3VuY2VtZW50ICAgICBMb2NhbGl6ZWQgY29tcGxldGlvbiBhbm5vdW5jZW1lbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfY29udGVudCggcmVuZGVyZWRfY29udGVudCwgYW5ub3VuY2VtZW50ICkge1xuXHRcdFx0bG9hZGluZy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0ZXJyb3IuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdGNvbnRlbnQuaW5uZXJIVE1MID0gU3RyaW5nKCByZW5kZXJlZF9jb250ZW50IHx8ICcnICk7XG5cdFx0XHRjb250ZW50LmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0c3RhdHVzLnRleHRDb250ZW50ID0gU3RyaW5nKCBhbm5vdW5jZW1lbnQgfHwgJycgKTtcblx0XHRcdHBhbmVsLnNldEF0dHJpYnV0ZSggJ2FyaWEtYnVzeScsICdmYWxzZScgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBEaXNwbGF5IGNhbGxlci1yZW5kZXJlZCBzdGF0ZSBjb250ZW50IHdoaWxlIHByZXNlcnZpbmcgc2hlbGwgbWVjaGFuaWNzLlxuXHRcdCAqXG5cdFx0ICogVGhlIHN0YXRlIEhUTUwgcmVtYWlucyBkb21haW4tb3duZWQgYW5kIG11c3QgYmUgcHJvZHVjZWQgZnJvbSBhblxuXHRcdCAqIGFsbG93LWxpc3RlZCBsb2NhbCBXb3JkUHJlc3MgdGVtcGxhdGUuIFRoZSBzaGFyZWQgc2hlbGwgb3ducyBvbmx5IHRoZVxuXHRcdCAqIHZpc2liaWxpdHksIGFubm91bmNlbWVudCwgYW5kIGFyaWEtYnVzeSBiZWhhdmlvci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgcmVuZGVyZWRfY29udGVudCBDYWxsZXItcmVuZGVyZWQgc3RhdGUgbWFya3VwLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgYW5ub3VuY2VtZW50ICAgICBMb2NhbGl6ZWQgc3RhdGUgYW5ub3VuY2VtZW50LlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfYnVzeSAgICAgICAgICBXaGV0aGVyIHRoZSBwYW5lbCByZW1haW5zIGJ1c3kuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfc3RhdGUoIHJlbmRlcmVkX2NvbnRlbnQsIGFubm91bmNlbWVudCwgaXNfYnVzeSApIHtcblx0XHRcdGxvYWRpbmcuaGlkZGVuID0gdHJ1ZTtcblx0XHRcdGVycm9yLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRjb250ZW50LmlubmVySFRNTCA9IFN0cmluZyggcmVuZGVyZWRfY29udGVudCB8fCAnJyApO1xuXHRcdFx0Y29udGVudC5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdHN0YXR1cy50ZXh0Q29udGVudCA9IFN0cmluZyggYW5ub3VuY2VtZW50IHx8ICcnICk7XG5cdFx0XHRwYW5lbC5zZXRBdHRyaWJ1dGUoICdhcmlhLWJ1c3knLCBpc19idXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcGxhY2UgdGhlIHZpc2libGUgaGVhZGVyIHdpdGggY2FsbGVyLXJlbmRlcmVkIGRvbWFpbiBjb250ZW50LlxuXHRcdCAqXG5cdFx0ICogVGhlIGFjY2Vzc2libGUgZGlhbG9nIG5hbWUgcmVtYWlucyBwbGFpbiB0ZXh0IGluIHRoZSBzaGVsbC1vd25lZCBoZWFkaW5nLlxuXHRcdCAqIFRoZSBzdXBwbGllZCBIVE1MIG11c3QgY29tZSBmcm9tIGFuIGFsbG93LWxpc3RlZCBsb2NhbCBXb3JkUHJlc3MgdGVtcGxhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcmVuZGVyZWRfaGVhZGVyIERvbWFpbiBoZWFkZXIgbWFya3VwLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhY2Nlc3NpYmxlX3RpdGxlIFBsYWluIGxvY2FsaXplZCBkaWFsb2cgdGl0bGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfaGVhZGVyKCByZW5kZXJlZF9oZWFkZXIsIGFjY2Vzc2libGVfdGl0bGUgKSB7XG5cdFx0XHRoZWFkaW5nLnRleHRDb250ZW50ID0gU3RyaW5nKCBhY2Nlc3NpYmxlX3RpdGxlIHx8IGRlZmF1bHRfaGVhZGluZyB8fCAnJyApO1xuXHRcdFx0aGVhZGluZy5jbGFzc0xpc3QuYWRkKCAnd3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yX19oZWFkaW5nLS12aXN1YWxseS1oaWRkZW4nICk7XG5cdFx0XHRoZWFkZXJfY29udGVudC5pbm5lckhUTUwgPSBTdHJpbmcoIHJlbmRlcmVkX2hlYWRlciB8fCAnJyApO1xuXHRcdFx0aGVhZGVyX2NvbnRlbnQuaGlkZGVuID0gZmFsc2U7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSB0aGUgZGVmYXVsdCBzaGVsbCBoZWFkaW5nIGJlZm9yZSBsb2FkaW5nIGFub3RoZXIgZG9tYWluIHJlY29yZC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBhY2Nlc3NpYmxlX3RpdGxlIE9wdGlvbmFsIHJlcGxhY2VtZW50IGRlZmF1bHQgdGl0bGUuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNldF9oZWFkZXIoIGFjY2Vzc2libGVfdGl0bGUgKSB7XG5cdFx0XHRoZWFkaW5nLnRleHRDb250ZW50ID0gU3RyaW5nKCBhY2Nlc3NpYmxlX3RpdGxlIHx8IGRlZmF1bHRfaGVhZGluZyB8fCAnJyApO1xuXHRcdFx0aGVhZGluZy5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yX19oZWFkaW5nLS12aXN1YWxseS1oaWRkZW4nICk7XG5cdFx0XHRoZWFkZXJfY29udGVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0aGVhZGVyX2NvbnRlbnQuaGlkZGVuID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgY2xvc2UgY29udHJvbHMgYW5kIHRoZSBtb2RhbCBiYWNrZHJvcC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgSW5zcGVjdG9yIGNsaWNrIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NsaWNrKCBldmVudCApIHtcblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXNoYXJlZC11aS1pbnNwZWN0b3ItY2xvc2VdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRjbG9zZSggdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsb3NlIHdpdGggRXNjYXBlIGFuZCBjb250YWluIFRhYiBmb2N1cyB3aGlsZSB0aGUgbW9kYWwgaXMgb3Blbi5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgSW5zcGVjdG9yIGtleSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdHZhciBmb2N1c2FibGVfZWxlbWVudHM7XG5cdFx0XHR2YXIgZmlyc3RfZWxlbWVudDtcblx0XHRcdHZhciBsYXN0X2VsZW1lbnQ7XG5cblx0XHRcdGlmICggJ0VzY2FwZScgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xvc2UoIHRydWUgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnVGFiJyAhPT0gZXZlbnQua2V5ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRmb2N1c2FibGVfZWxlbWVudHMgPSBnZXRfZm9jdXNhYmxlX2VsZW1lbnRzKCk7XG5cdFx0XHRpZiAoICEgZm9jdXNhYmxlX2VsZW1lbnRzLmxlbmd0aCApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cGFuZWwuZm9jdXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Zmlyc3RfZWxlbWVudCA9IGZvY3VzYWJsZV9lbGVtZW50c1sgMCBdO1xuXHRcdFx0bGFzdF9lbGVtZW50ID0gZm9jdXNhYmxlX2VsZW1lbnRzWyBmb2N1c2FibGVfZWxlbWVudHMubGVuZ3RoIC0gMSBdO1xuXHRcdFx0aWYgKCBldmVudC5zaGlmdEtleSAmJiAoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGZpcnN0X2VsZW1lbnQgfHwgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gcGFuZWwgfHwgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gaGVhZGluZyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRsYXN0X2VsZW1lbnQuZm9jdXMoKTtcblx0XHRcdH0gZWxzZSBpZiAoICEgZXZlbnQuc2hpZnRLZXkgJiYgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCA9PT0gbGFzdF9lbGVtZW50ICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRmaXJzdF9lbGVtZW50LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfY2xpY2sgKTtcblx0XHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2tleWRvd24gKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcGVuOiBvcGVuLFxuXHRcdFx0Y2xvc2U6IGNsb3NlLFxuXHRcdFx0c2V0X2xvYWRpbmc6IHNldF9sb2FkaW5nLFxuXHRcdFx0c2V0X2Vycm9yOiBzZXRfZXJyb3IsXG5cdFx0XHRzZXRfY29udGVudDogc2V0X2NvbnRlbnQsXG5cdFx0XHRzZXRfc3RhdGU6IHNldF9zdGF0ZSxcblx0XHRcdHNldF9oZWFkZXI6IHNldF9oZWFkZXIsXG5cdFx0XHRyZXNldF9oZWFkZXI6IHJlc2V0X2hlYWRlcixcblx0XHRcdGlzX29wZW46IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuICEgcm9vdC5oaWRkZW47XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHdpbmRvdy53cGJjX3NoYXJlZF91aV9pbnNwZWN0b3IgPSB3aW5kb3cud3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yIHx8IHt9O1xuXHR3aW5kb3cud3BiY19zaGFyZWRfdWlfaW5zcGVjdG9yLmNyZWF0ZSA9IGNyZWF0ZTtcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQy9CLFlBQVk7O0VBRVosSUFBSUMsa0JBQWtCLEdBQUcsMklBQTJJO0VBQ3BLLElBQUlDLGdCQUFnQixHQUFHLDJCQUEyQjtFQUNsRCxJQUFJQyxpQkFBaUIsR0FBRyw0QkFBNEI7O0VBRXBEO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLGtCQUFrQkEsQ0FBRUMsU0FBUyxFQUFHO0lBQ3hDLE9BQU9DLE1BQU0sQ0FBRUQsU0FBUyxJQUFJLEVBQUcsQ0FBQyxDQUFDRSxPQUFPLENBQUUsaUJBQWlCLEVBQUUsRUFBRyxDQUFDLENBQUNDLEtBQUssQ0FBRSxDQUFDLEVBQUUsR0FBSSxDQUFDO0VBQ2xGOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsYUFBYUEsQ0FBRUMsSUFBSSxFQUFFQyxRQUFRLEVBQUc7SUFDeEMsSUFBSUMsS0FBSyxHQUFHRixJQUFJLElBQUlBLElBQUksQ0FBQ0csYUFBYSxHQUFHSCxJQUFJLENBQUNHLGFBQWEsQ0FBRSxrQ0FBbUMsQ0FBQyxHQUFHLElBQUk7SUFDeEcsSUFBSUMsV0FBVyxHQUFHVixrQkFBa0IsQ0FBRU0sSUFBSSxHQUFHQSxJQUFJLENBQUNLLFlBQVksQ0FBRSwrQkFBZ0MsQ0FBQyxHQUFHLEVBQUcsQ0FBQztJQUN4RyxJQUFJQyxRQUFRLEdBQUdaLGtCQUFr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
