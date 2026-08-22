"use strict";

/**
 * Manage reusable selection behavior for independent WPBC catalogs.
 *
 * Selection is presentation state only. This controller never sends requests
 * or performs mutations; domain code may observe the emitted selection events.
 *
 * @since 11.6.0
 */
(function (window, document) {
  'use strict';

  var sticky_controllers = [];
  var sticky_frame = 0;
  var viewport_events_bound = false;

  /**
   * Return a stable string identifier from one checkbox value.
   *
   * @param {*} control_value Candidate checkbox value.
   * @return {string} Non-empty identifier or an empty string.
   */
  function normalize_item_id(control_value) {
    return null === control_value || 'undefined' === typeof control_value ? '' : String(control_value).trim();
  }

  /**
   * Create an identifier map without inherited object-property collisions.
   *
   * @return {Object} Empty selected-identifier map.
   */
  function create_selected_ids() {
    return Object.create(null);
  }

  /**
   * Return all currently rendered item-selection controls.
   *
   * @param {Object} controller Selection controller state.
   * @return {HTMLElement[]} Visible item checkbox controls.
   */
  function get_item_controls(controller) {
    return Array.prototype.slice.call(controller.mount_element.querySelectorAll('[data-wpbc-ui-catalog-select-item]'));
  }

  /**
   * Return the currently selected identifiers.
   *
   * @param {Object} controller Selection controller state.
   * @return {string[]} Selected catalog item identifiers.
   */
  function get_selected_ids(controller) {
    return Object.keys(controller.selected_ids);
  }

  /**
   * Remove browser text selection created by an intentional Shift-click range.
   *
   * Normal text remains selectable because this runs only for a Shift-click on
   * an opted-in catalog item checkbox.
   *
   * @return {void}
   */
  function clear_range_selection_text() {
    var text_selection;
    if ('function' !== typeof window.getSelection) {
      return;
    }
    text_selection = window.getSelection();
    if (text_selection && 'function' === typeof text_selection.removeAllRanges) {
      text_selection.removeAllRanges();
    }
  }

  /**
   * Return the fixed administration header offset above a selection summary.
   *
   * @param {HTMLElement} summary Selection summary element.
   * @return {number} Viewport offset in pixels.
   */
  function get_sticky_top(summary) {
    var admin_root = summary.closest('.wpbc_admin') || document.documentElement;
    var booking_bar = admin_root.querySelector('.wpbc_ui_el__top_nav');
    var wordpress_bar = document.getElementById('wpadminbar');
    var sticky_top = 0;
    [wordpress_bar, booking_bar].forEach(function (navigation_bar) {
      if (navigation_bar && 'fixed' === window.getComputedStyle(navigation_bar).position) {
        sticky_top = Math.max(sticky_top, navigation_bar.getBoundingClientRect().bottom);
      }
    });
    return sticky_top + 8;
  }

  /**
   * Restore one summary to normal document flow.
   *
   * @param {Object} controller Selection controller state.
   * @return {void}
   */
  function reset_sticky_summary(controller) {
    controller.summary.classList.remove('is-viewport-sticky');
    controller.summary.style.removeProperty('left');
    controller.summary.style.removeProperty('top');
    controller.summary.style.removeProperty('width');
    if (!controller.placeholder) {
      return;
    }
    controller.placeholder.hidden = true;
    controller.placeholder.style.removeProperty('height');
    controller.placeholder.style.removeProperty('margin-bottom');
    controller.placeholder.style.removeProperty('margin-top');
  }

  /**
   * Move focus to a stable selection control after the clear button disappears.
   *
   * @param {Object} controller Selection controller state.
   * @return {void}
   */
  function focus_selection_fallback(controller) {
    var focus_target = controller.mount_element.querySelector('[data-wpbc-ui-catalog-select-all]') || controller.mount_element.querySelector('[data-wpbc-ui-catalog-select-item]') || controller.mount_element.querySelector('[data-wpbc-catalog-heading]');
    if (focus_target && 'function' === typeof focus_target.focus) {
      focus_target.focus();
    }
  }

  /**
   * Keep one visible summary inside its catalog's viewport bounds.
   *
   * @param {Object} controller Selection controller state.
   * @return {void}
   */
  function update_sticky_summary(controller) {
    var is_sticky = controller.summary.classList.contains('is-viewport-sticky');
    var listing_rect;
    var source_rect;
    var sticky_top;
    var summary_rect;
    var summary_style;
    if (controller.summary.hidden || 'none' === window.getComputedStyle(controller.summary).display || !document.documentElement.contains(controller.listing_element)) {
      reset_sticky_summary(controller);
      return;
    }
    sticky_top = get_sticky_top(controller.summary);
    source_rect = (is_sticky ? controller.placeholder : controller.summary).getBoundingClientRect();
    listing_rect = controller.listing_element.getBoundingClientRect();
    if (source_rect.top > sticky_top || listing_rect.bottom <= sticky_top + controller.summary.offsetHeight) {
      reset_sticky_summary(controller);
      return;
    }
    if (!is_sticky) {
      summary_rect = controller.summary.getBoundingClientRect();
      summary_style = window.getComputedStyle(controller.summary);
      controller.placeholder.style.height = summary_rect.height + 'px';
      controller.placeholder.style.marginTop = summary_style.marginTop;
      controller.placeholder.style.marginBottom = summary_style.marginBottom;
      controller.placeholder.hidden = false;
      controller.summary.classList.add('is-viewport-sticky');
    }
    source_rect = controller.placeholder.getBoundingClientRect();
    controller.summary.style.left = source_rect.left + 'px';
    controller.summary.style.top = sticky_top + 'px';
    controller.summary.style.width = source_rect.width + 'px';
  }

  /**
   * Schedule all sticky summaries for the next animation frame.
   *
   * @return {void}
   */
  function schedule_sticky_summaries() {
    if (sticky_frame) {
      return;
    }
    sticky_frame = window.requestAnimationFrame(function () {
      sticky_frame = 0;
      sticky_controllers.forEach(update_sticky_summary);
    });
  }

  /**
   * Register an additional catalog control for bounded viewport-sticky behavior.
   *
   * Domain catalogs can render editing or status bars after the shared catalog
   * controller mounts. Registering the rendered element here gives those bars
   * the same measured WordPress-header offset and catalog boundary as the
   * selection summary without introducing domain knowledge into shared code.
   *
   * @param {Object}      controller     Selection controller state.
   * @param {HTMLElement} sticky_element Opt-in catalog control element.
   * @return {boolean} True when a new sticky controller was registered.
   */
  function register_viewport_sticky(controller, sticky_element) {
    var placeholder;
    var sticky_controller;
    if (!sticky_element || !controller.listing_element || '1' === sticky_element.getAttribute('data-wpbc-ui-catalog-viewport-sticky-initialized')) {
      return false;
    }
    placeholder = document.createElement('div');
    placeholder.className = 'wpbc_ui_listing__viewport_sticky_placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.hidden = true;
    sticky_element.parentNode.insertBefore(placeholder, sticky_element);
    sticky_element.setAttribute('data-wpbc-ui-catalog-viewport-sticky-initialized', '1');
    sticky_controller = {
      listing_element: controller.listing_element,
      placeholder: placeholder,
      summary: sticky_element
    };
    sticky_controllers.push(sticky_controller);
    if ('function' === typeof window.ResizeObserver) {
      sticky_controller.resize_observer = new window.ResizeObserver(schedule_sticky_summaries);
      sticky_controller.resize_observer.observe(controller.listing_element);
      sticky_controller.resize_observer.observe(sticky_element);
    }
    if (!viewport_events_bound) {
      viewport_events_bound = true;
      window.addEventListener('scroll', schedule_sticky_summaries, true);
      window.addEventListener('resize', schedule_sticky_summaries);
    }
    schedule_sticky_summaries();
    return true;
  }

  /**
   * Emit a domain-neutral selection lifecycle event.
   *
   * @param {Object} controller Selection controller state.
   * @param {string} event_name Catalog selection event name.
   * @return {void}
   */
  function dispatch_selection_event(controller, event_name) {
    var item_controls = get_item_controls(controller);
    var visible_selected_ids = item_controls.filter(function (control) {
      return control.checked;
    }).map(function (control) {
      return normalize_item_id(control.value);
    });
    var event_detail = {
      catalog_id: controller.catalog_id,
      selected_ids: get_selected_ids(controller),
      visible_selected_ids: visible_selected_ids
    };
    var selection_event;
    if ('function' === typeof window.CustomEvent) {
      selection_event = new window.CustomEvent(event_name, {
        bubbles: true,
        detail: event_detail
      });
    } else {
      selection_event = document.createEvent('CustomEvent');
      selection_event.initCustomEvent(event_name, true, false, event_detail);
    }
    controller.mount_element.dispatchEvent(selection_event);
  }

  /**
   * Synchronize checkboxes, row styling, select-all state, and summary status.
   *
   * @param {Object}  controller     Selection controller state.
   * @param {boolean} dispatch_change Whether to emit a selection-change event.
   * @return {void}
   */
  function synchronize_selection(controller, dispatch_change) {
    var item_controls = get_item_controls(controller);
    var select_all = controller.mount_element.querySelector('[data-wpbc-ui-catalog-select-all]');
    var selected_count = get_selected_ids(controller).length;
    item_controls.forEach(function (control) {
      var item_id = normalize_item_id(control.value);
      var is_selected = '' !== item_id && !!controller.selected_ids[item_id];
      var row = control.closest('[data-wpbc-ui-catalog-selectable-row]') || control.closest('[data-wpbc-booking-resource-id]');
      control.checked = is_selected;
      if (row) {
        row.classList.toggle('is-selected', is_selected);
        if (row.hasAttribute('data-wpbc-ui-catalog-selection-checkbox-only')) {
          row.removeAttribute('aria-selected');
        } else {
          row.setAttribute('aria-selected', is_selected ? 'true' : 'false');
        }
      }
    });
    if (select_all) {
      select_all.checked = 0 < item_controls.length && item_controls.every(function (control) {
        return control.checked;
      });
      select_all.indeterminate = !select_all.checked && item_controls.some(function (control) {
        return control.checked;
      });
    }
    if (controller.summary) {
      controller.summary.hidden = 0 === selected_count;
    }
    if (controller.summary_count) {
      controller.summary_count.textContent = String(selected_count);
    }
    schedule_sticky_summaries();
    if (dispatch_change) {
      dispatch_selection_event(controller, 'wpbc:ui-catalog-selection-change');
    }
  }

  /**
   * Remember the focused selection control before response markup is replaced.
   *
   * @param {Object} controller Selection controller state.
   * @return {void}
   */
  function capture_selection_focus(controller) {
    var active_element = document.activeElement;
    var item_control;
    controller.focus_token = null;
    if (!active_element || !controller.mount_element.contains(active_element)) {
      return;
    }
    item_control = active_element.closest('[data-wpbc-ui-catalog-select-item]');
    if (item_control) {
      controller.focus_token = {
        type: 'item',
        item_id: normalize_item_id(item_control.value)
      };
    } else if (active_element.closest('[data-wpbc-ui-catalog-select-all]')) {
      controller.focus_token = {
        type: 'select_all'
      };
    } else if (active_element.closest('[data-wpbc-ui-catalog-selection-clear]')) {
      controller.focus_token = {
        type: 'clear'
      };
    }
  }

  /**
   * Restore focus after selected rows are rebuilt by an AJAX response.
   *
   * @param {Object} controller Selection controller state.
   * @return {void}
   */
  function restore_selection_focus(controller) {
    var focus_target = null;
    var focus_token = controller.focus_token;
    controller.focus_token = null;
    if (!focus_token) {
      return;
    }
    if ('item' === focus_token.type) {
      get_item_controls(controller).some(function (control) {
        if (focus_token.item_id === normalize_item_id(control.value)) {
          focus_target = control;
          return true;
        }
        return false;
      });
    } else if ('select_all' === focus_token.type) {
      focus_target = controller.mount_element.querySelector('[data-wpbc-ui-catalog-select-all]');
    } else if ('clear' === focus_token.type && !controller.summary.hidden) {
      focus_target = controller.mount_element.querySelector('[data-wpbc-ui-catalog-selection-clear]');
    }
    if (!focus_target) {
      focus_target = controller.mount_element.querySelector('[data-wpbc-catalog-heading]');
    }
    if (focus_target && 'function' === typeof focus_target.focus) {
      focus_target.focus();
    }
  }

  /**
   * Apply a checked or unchecked state to a visible inclusive range.
   *
   * @param {Object}      controller     Selection controller state.
   * @param {HTMLElement} target_control Range endpoint checkbox.
   * @return {boolean} True when a visible range was applied.
   */
  function apply_selection_range(controller, target_control) {
    var item_controls = get_item_controls(controller);
    var anchor_index = -1;
    var target_index = item_controls.indexOf(target_control);
    item_controls.some(function (control, control_index) {
      if (controller.range_anchor_id === normalize_item_id(control.value)) {
        anchor_index = control_index;
        return true;
      }
      return false;
    });
    if (0 > anchor_index || 0 > target_index) {
      return false;
    }
    item_controls.slice(Math.min(anchor_index, target_index), Math.max(anchor_index, target_index) + 1).forEach(function (control) {
      var item_id = normalize_item_id(control.value);
      if ('' === item_id) {
        return;
      }
      if (target_control.checked) {
        controller.selected_ids[item_id] = true;
      } else {
        delete controller.selected_ids[item_id];
      }
    });
    return true;
  }

  /**
   * Handle delegated selection clicks and capture Shift range intent.
   *
   * @param {Object}     controller Selection controller state.
   * @param {MouseEvent} event      Catalog click event.
   * @return {void}
   */
  function handle_click(controller, event) {
    var clear_control = event.target.closest('[data-wpbc-ui-catalog-selection-clear]');
    var item_control = event.target.closest('[data-wpbc-ui-catalog-select-item]');
    if (clear_control) {
      event.preventDefault();
      controller.selected_ids = create_selected_ids();
      controller.range_anchor_id = '';
      synchronize_selection(controller, true);
      focus_selection_fallback(controller);
      return;
    }
    controller.shift_control = null;
    if (item_control && controller.range_selection_enabled && event.shiftKey) {
      controller.shift_control = item_control;
      clear_range_selection_text();
      window.setTimeout(clear_range_selection_text, 0);
    }
  }

  /**
   * Handle item and select-all checkbox state changes.
   *
   * @param {Object} controller Selection controller state.
   * @param {Event}  event      Catalog change event.
   * @return {void}
   */
  function handle_change(controller, event) {
    var item_controls;
    var item_id;
    if (event.target.matches('[data-wpbc-ui-catalog-select-all]')) {
      item_controls = get_item_controls(controller);
      item_controls.forEach(function (control) {
        var visible_item_id = normalize_item_id(control.value);
        if ('' === visible_item_id) {
          return;
        }
        if (event.target.checked) {
          controller.selected_ids[visible_item_id] = true;
        } else {
          delete controller.selected_ids[visible_item_id];
        }
      });
      controller.range_anchor_id = '';
    } else if (event.target.matches('[data-wpbc-ui-catalog-select-item]')) {
      item_id = normalize_item_id(event.target.value);
      if ('' === item_id) {
        return;
      }
      if (controller.shift_control !== event.target || !controller.range_anchor_id || !apply_selection_range(controller, event.target)) {
        if (event.target.checked) {
          controller.selected_ids[item_id] = true;
        } else {
          delete controller.selected_ids[item_id];
        }
      }
      controller.range_anchor_id = item_id;
      controller.shift_control = null;
    } else {
      return;
    }
    synchronize_selection(controller, true);
  }

  /**
   * Initialize selection state for one mounted catalog.
   *
   * @param {HTMLElement} mount_element Catalog mount element.
   * @param {Object}      config        Registered browser configuration.
   * @return {Object|false} Selection controller API or false when unavailable.
   */
  function initialize_selection(mount_element, config) {
    var controller;
    var placeholder;
    if (!mount_element || mount_element._wpbc_ui_catalog_selection_controller) {
      return mount_element ? mount_element._wpbc_ui_catalog_selection_controller : false;
    }
    controller = {
      catalog_id: config && config.id ? String(config.id) : '',
      focus_token: null,
      listing_element: mount_element.querySelector('[data-wpbc-ui-catalog-listing]'),
      mount_element: mount_element,
      placeholder: null,
      range_anchor_id: '',
      range_selection_enabled: !!(config && config.features && config.features.range_selection),
      selected_ids: create_selected_ids(),
      shift_control: null,
      summary: mount_element.querySelector('[data-wpbc-ui-catalog-selection-summary]'),
      summary_count: mount_element.querySelector('[data-wpbc-ui-catalog-selection-count]')
    };
    if (!controller.listing_element || !controller.summary) {
      return false;
    }
    if ('1' === controller.summary.getAttribute('data-wpbc-ui-catalog-selection-summary-sticky')) {
      placeholder = document.createElement('div');
      placeholder.className = 'wpbc_ui_listing__selection_summary_placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.hidden = true;
      controller.summary.parentNode.insertBefore(placeholder, controller.summary);
      controller.placeholder = placeholder;
      sticky_controllers.push(controller);
    }
    mount_element.addEventListener('click', function (event) {
      handle_click(controller, event);
    });
    mount_element.addEventListener('change', function (event) {
      handle_change(controller, event);
    });
    mount_element.addEventListener('wpbc:ui-catalog-before-render', function () {
      capture_selection_focus(controller);
    });
    mount_element.addEventListener('wpbc:ui-catalog-rendered', function () {
      synchronize_selection(controller, false);
      dispatch_selection_event(controller, 'wpbc:ui-catalog-selection-restored');
      restore_selection_focus(controller);
    });
    if (controller.placeholder && 'function' === typeof window.ResizeObserver) {
      controller.resize_observer = new window.ResizeObserver(schedule_sticky_summaries);
      controller.resize_observer.observe(controller.listing_element);
    }
    if (controller.placeholder && !viewport_events_bound) {
      viewport_events_bound = true;
      window.addEventListener('scroll', schedule_sticky_summaries, true);
      window.addEventListener('resize', schedule_sticky_summaries);
    }
    controller.api = {
      clear: function () {
        controller.selected_ids = create_selected_ids();
        controller.range_anchor_id = '';
        synchronize_selection(controller, true);
      },
      get_selected_ids: function () {
        return get_selected_ids(controller);
      },
      register_viewport_sticky: function (sticky_element) {
        return register_viewport_sticky(controller, sticky_element);
      },
      refresh_viewport_sticky: function () {
        schedule_sticky_summaries();
      },
      synchronize: function () {
        synchronize_selection(controller, false);
      }
    };
    mount_element._wpbc_ui_catalog_selection_controller = controller.api;
    synchronize_selection(controller, false);
    return controller.api;
  }
  window.wpbc_ui_catalog_selection = window.wpbc_ui_catalog_selection || {};
  window.wpbc_ui_catalog_selection.initialize = initialize_selection;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19vdXQvd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbi5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50Iiwic3RpY2t5X2NvbnRyb2xsZXJzIiwic3RpY2t5X2ZyYW1lIiwidmlld3BvcnRfZXZlbnRzX2JvdW5kIiwibm9ybWFsaXplX2l0ZW1faWQiLCJjb250cm9sX3ZhbHVlIiwiU3RyaW5nIiwidHJpbSIsImNyZWF0ZV9zZWxlY3RlZF9pZHMiLCJPYmplY3QiLCJjcmVhdGUiLCJnZXRfaXRlbV9jb250cm9scyIsImNvbnRyb2xsZXIiLCJBcnJheSIsInByb3RvdHlwZSIsInNsaWNlIiwiY2FsbCIsIm1vdW50X2VsZW1lbnQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZ2V0X3NlbGVjdGVkX2lkcyIsImtleXMiLCJzZWxlY3RlZF9pZHMiLCJjbGVhcl9yYW5nZV9zZWxlY3Rpb25fdGV4dCIsInRleHRfc2VsZWN0aW9uIiwiZ2V0U2VsZWN0aW9uIiwicmVtb3ZlQWxsUmFuZ2VzIiwiZ2V0X3N0aWNreV90b3AiLCJzdW1tYXJ5IiwiYWRtaW5fcm9vdCIsImNsb3Nlc3QiLCJkb2N1bWVudEVsZW1lbnQiLCJib29raW5nX2JhciIsInF1ZXJ5U2VsZWN0b3IiLCJ3b3JkcHJlc3NfYmFyIiwiZ2V0RWxlbWVudEJ5SWQiLCJzdGlja3lfdG9wIiwiZm9yRWFjaCIsIm5hdmlnYXRpb25fYmFyIiwiZ2V0Q29tcHV0ZWRTdHlsZSIsInBvc2l0aW9uIiwiTWF0aCIsIm1heCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImJvdHRvbSIsInJlc2V0X3N0aWNreV9zdW1tYXJ5IiwiY2xhc3NMaXN0IiwicmVtb3ZlIiwic3R5bGUiLCJyZW1vdmVQcm9wZXJ0eSIsInBsYWNlaG9sZGVyIiwiaGlkZGVuIiwiZm9jdXNfc2VsZWN0aW9uX2ZhbGxiYWNrIiwiZm9jdXNfdGFyZ2V0IiwiZm9jdXMiLCJ1cGRhdGVfc3RpY2t5X3N1bW1hcnkiLCJpc19zdGlja3kiLCJjb250YWlucyIsImxpc3RpbmdfcmVjdCIsInNvdXJjZV9yZWN0Iiwic3VtbWFyeV9yZWN0Iiwic3VtbWFyeV9zdHlsZSIsImRpc3BsYXkiLCJsaXN0aW5nX2VsZW1lbnQiLCJ0b3AiLCJvZmZzZXRIZWlnaHQiLCJoZWlnaHQiLCJtYXJnaW5Ub3AiLCJtYXJnaW5Cb3R0b20iLCJhZGQiLCJsZWZ0Iiwid2lkdGgiLCJzY2hlZHVsZV9zdGlja3lfc3VtbWFyaWVzIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwicmVnaXN0ZXJfdmlld3BvcnRfc3RpY2t5Iiwic3RpY2t5X2VsZW1lbnQiLCJzdGlja3lfY29udHJvbGxlciIsImdldEF0dHJpYnV0ZSIsImNyZWF0ZUVsZW1lbnQiLCJjbGFzc05hbWUiLCJzZXRBdHRyaWJ1dGUiLCJwYXJlbnROb2RlIiwiaW5zZXJ0QmVmb3JlIiwicHVzaCIsIlJlc2l6ZU9ic2VydmVyIiwicmVzaXplX29ic2VydmVyIiwib2JzZXJ2ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJkaXNwYXRjaF9zZWxlY3Rpb25fZXZlbnQiLCJldmVudF9uYW1lIiwiaXRlbV9jb250cm9scyIsInZpc2libGVfc2VsZWN0ZWRfaWRzIiwiZmlsdGVyIiwiY29udHJvbCIsImNoZWNrZWQiLCJtYXAiLCJ2YWx1ZSIsImV2ZW50X2RldGFpbCIsImNhdGFsb2dfaWQiLCJzZWxlY3Rpb25fZXZlbnQiLCJDdXN0b21FdmVudCIsImJ1YmJsZXMiLCJkZXRhaWwiLCJjcmVhdGVFdmVudCIsImluaXRDdXN0b21FdmVudCIsImRpc3BhdGNoRXZlbnQiLCJzeW5jaHJvbml6ZV9zZWxlY3Rpb24iLCJkaXNwYXRjaF9jaGFuZ2UiLCJzZWxlY3RfYWxsIiwic2VsZWN0ZWRfY291bnQiLCJsZW5ndGgiLCJpdGVtX2lkIiwiaXNfc2VsZWN0ZWQiLCJyb3ciLCJ0b2dnbGUiLCJoYXNBdHRyaWJ1dGUiLCJyZW1vdmVBdHRyaWJ1dGUiLCJldmVyeSIsImluZGV0ZXJtaW5hdGUiLCJzb21lIiwic3VtbWFyeV9jb3VudCIsInRleHRDb250ZW50IiwiY2FwdHVyZV9zZWxlY3Rpb25fZm9jdXMiLCJhY3RpdmVfZWxlbWVudCIsImFjdGl2ZUVsZW1lbnQiLCJpdGVtX2NvbnRyb2wiLCJmb2N1c190b2tlbiIsInR5cGUiLCJyZXN0b3JlX3NlbGVjdGlvbl9mb2N1cyIsImFwcGx5X3NlbGVjdGlvbl9yYW5nZSIsInRhcmdldF9jb250cm9sIiwiYW5jaG9yX2luZGV4IiwidGFyZ2V0X2luZGV4IiwiaW5kZXhPZiIsImNvbnRyb2xfaW5kZXgiLCJyYW5nZV9hbmNob3JfaWQiLCJtaW4iLCJoYW5kbGVfY2xpY2siLCJldmVudCIsImNsZWFyX2NvbnRyb2wiLCJ0YXJnZXQiLCJwcmV2ZW50RGVmYXVsdCIsInNoaWZ0X2NvbnRyb2wiLCJyYW5nZV9zZWxlY3Rpb25fZW5hYmxlZCIsInNoaWZ0S2V5Iiwic2V0VGltZW91dCIsImhhbmRsZV9jaGFuZ2UiLCJtYXRjaGVzIiwidmlzaWJsZV9pdGVtX2lkIiwiaW5pdGlhbGl6ZV9zZWxlY3Rpb24iLCJjb25maWciLCJfd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyIiwiaWQiLCJmZWF0dXJlcyIsInJhbmdlX3NlbGVjdGlvbiIsImFwaSIsImNsZWFyIiwicmVmcmVzaF92aWV3cG9ydF9zdGlja3kiLCJzeW5jaHJvbml6ZSIsIndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb24iLCJpbml0aWFsaXplIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19zcmMvd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE1hbmFnZSByZXVzYWJsZSBzZWxlY3Rpb24gYmVoYXZpb3IgZm9yIGluZGVwZW5kZW50IFdQQkMgY2F0YWxvZ3MuXG4gKlxuICogU2VsZWN0aW9uIGlzIHByZXNlbnRhdGlvbiBzdGF0ZSBvbmx5LiBUaGlzIGNvbnRyb2xsZXIgbmV2ZXIgc2VuZHMgcmVxdWVzdHNcbiAqIG9yIHBlcmZvcm1zIG11dGF0aW9uczsgZG9tYWluIGNvZGUgbWF5IG9ic2VydmUgdGhlIGVtaXR0ZWQgc2VsZWN0aW9uIGV2ZW50cy5cbiAqXG4gKiBAc2luY2UgMTEuNi4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIHN0aWNreV9jb250cm9sbGVycyA9IFtdO1xuXHR2YXIgc3RpY2t5X2ZyYW1lID0gMDtcblx0dmFyIHZpZXdwb3J0X2V2ZW50c19ib3VuZCA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm4gYSBzdGFibGUgc3RyaW5nIGlkZW50aWZpZXIgZnJvbSBvbmUgY2hlY2tib3ggdmFsdWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY29udHJvbF92YWx1ZSBDYW5kaWRhdGUgY2hlY2tib3ggdmFsdWUuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gTm9uLWVtcHR5IGlkZW50aWZpZXIgb3IgYW4gZW1wdHkgc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gbm9ybWFsaXplX2l0ZW1faWQoIGNvbnRyb2xfdmFsdWUgKSB7XG5cdFx0cmV0dXJuIG51bGwgPT09IGNvbnRyb2xfdmFsdWUgfHwgJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBjb250cm9sX3ZhbHVlXG5cdFx0XHQ/ICcnXG5cdFx0XHQ6IFN0cmluZyggY29udHJvbF92YWx1ZSApLnRyaW0oKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYW4gaWRlbnRpZmllciBtYXAgd2l0aG91dCBpbmhlcml0ZWQgb2JqZWN0LXByb3BlcnR5IGNvbGxpc2lvbnMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRW1wdHkgc2VsZWN0ZWQtaWRlbnRpZmllciBtYXAuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfc2VsZWN0ZWRfaWRzKCkge1xuXHRcdHJldHVybiBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIGFsbCBjdXJyZW50bHkgcmVuZGVyZWQgaXRlbS1zZWxlY3Rpb24gY29udHJvbHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIFNlbGVjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudFtdfSBWaXNpYmxlIGl0ZW0gY2hlY2tib3ggY29udHJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaXRlbV9jb250cm9scyggY29udHJvbGxlciApIHtcblx0XHRyZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoXG5cdFx0XHRjb250cm9sbGVyLm1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtaXRlbV0nIClcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgY3VycmVudGx5IHNlbGVjdGVkIGlkZW50aWZpZXJzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBTZWxlY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHJldHVybiB7c3RyaW5nW119IFNlbGVjdGVkIGNhdGFsb2cgaXRlbSBpZGVudGlmaWVycy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9zZWxlY3RlZF9pZHMoIGNvbnRyb2xsZXIgKSB7XG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKCBjb250cm9sbGVyLnNlbGVjdGVkX2lkcyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbW92ZSBicm93c2VyIHRleHQgc2VsZWN0aW9uIGNyZWF0ZWQgYnkgYW4gaW50ZW50aW9uYWwgU2hpZnQtY2xpY2sgcmFuZ2UuXG5cdCAqXG5cdCAqIE5vcm1hbCB0ZXh0IHJlbWFpbnMgc2VsZWN0YWJsZSBiZWNhdXNlIHRoaXMgcnVucyBvbmx5IGZvciBhIFNoaWZ0LWNsaWNrIG9uXG5cdCAqIGFuIG9wdGVkLWluIGNhdGFsb2cgaXRlbSBjaGVja2JveC5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsZWFyX3JhbmdlX3NlbGVjdGlvbl90ZXh0KCkge1xuXHRcdHZhciB0ZXh0X3NlbGVjdGlvbjtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy5nZXRTZWxlY3Rpb24gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRleHRfc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuXHRcdGlmICggdGV4dF9zZWxlY3Rpb24gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRleHRfc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcyApIHtcblx0XHRcdHRleHRfc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIGZpeGVkIGFkbWluaXN0cmF0aW9uIGhlYWRlciBvZmZzZXQgYWJvdmUgYSBzZWxlY3Rpb24gc3VtbWFyeS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gc3VtbWFyeSBTZWxlY3Rpb24gc3VtbWFyeSBlbGVtZW50LlxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9IFZpZXdwb3J0IG9mZnNldCBpbiBwaXhlbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfc3RpY2t5X3RvcCggc3VtbWFyeSApIHtcblx0XHR2YXIgYWRtaW5fcm9vdCA9IHN1bW1hcnkuY2xvc2VzdCggJy53cGJjX2FkbWluJyApIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblx0XHR2YXIgYm9va2luZ19iYXIgPSBhZG1pbl9yb290LnF1ZXJ5U2VsZWN0b3IoICcud3BiY191aV9lbF9fdG9wX25hdicgKTtcblx0XHR2YXIgd29yZHByZXNzX2JhciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BhZG1pbmJhcicgKTtcblx0XHR2YXIgc3RpY2t5X3RvcCA9IDA7XG5cblx0XHRbIHdvcmRwcmVzc19iYXIsIGJvb2tpbmdfYmFyIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBuYXZpZ2F0aW9uX2JhciApIHtcblx0XHRcdGlmICggbmF2aWdhdGlvbl9iYXIgJiYgJ2ZpeGVkJyA9PT0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoIG5hdmlnYXRpb25fYmFyICkucG9zaXRpb24gKSB7XG5cdFx0XHRcdHN0aWNreV90b3AgPSBNYXRoLm1heCggc3RpY2t5X3RvcCwgbmF2aWdhdGlvbl9iYXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkuYm90dG9tICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHN0aWNreV90b3AgKyA4O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc3RvcmUgb25lIHN1bW1hcnkgdG8gbm9ybWFsIGRvY3VtZW50IGZsb3cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIFNlbGVjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzZXRfc3RpY2t5X3N1bW1hcnkoIGNvbnRyb2xsZXIgKSB7XG5cdFx0Y29udHJvbGxlci5zdW1tYXJ5LmNsYXNzTGlzdC5yZW1vdmUoICdpcy12aWV3cG9ydC1zdGlja3knICk7XG5cdFx0Y29udHJvbGxlci5zdW1tYXJ5LnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnbGVmdCcgKTtcblx0XHRjb250cm9sbGVyLnN1bW1hcnkuc3R5bGUucmVtb3ZlUHJvcGVydHkoICd0b3AnICk7XG5cdFx0Y29udHJvbGxlci5zdW1tYXJ5LnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnd2lkdGgnICk7XG5cdFx0aWYgKCAhIGNvbnRyb2xsZXIucGxhY2Vob2xkZXIgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnRyb2xsZXIucGxhY2Vob2xkZXIuaGlkZGVuID0gdHJ1ZTtcblx0XHRjb250cm9sbGVyLnBsYWNlaG9sZGVyLnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnaGVpZ2h0JyApO1xuXHRcdGNvbnRyb2xsZXIucGxhY2Vob2xkZXIuc3R5bGUucmVtb3ZlUHJvcGVydHkoICdtYXJnaW4tYm90dG9tJyApO1xuXHRcdGNvbnRyb2xsZXIucGxhY2Vob2xkZXIuc3R5bGUucmVtb3ZlUHJvcGVydHkoICdtYXJnaW4tdG9wJyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIE1vdmUgZm9jdXMgdG8gYSBzdGFibGUgc2VsZWN0aW9uIGNvbnRyb2wgYWZ0ZXIgdGhlIGNsZWFyIGJ1dHRvbiBkaXNhcHBlYXJzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBTZWxlY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGZvY3VzX3NlbGVjdGlvbl9mYWxsYmFjayggY29udHJvbGxlciApIHtcblx0XHR2YXIgZm9jdXNfdGFyZ2V0ID0gY29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0LWFsbF0nIClcblx0XHRcdHx8IGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlbGVjdC1pdGVtXScgKVxuXHRcdFx0fHwgY29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctaGVhZGluZ10nICk7XG5cblx0XHRpZiAoIGZvY3VzX3RhcmdldCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9jdXNfdGFyZ2V0LmZvY3VzICkge1xuXHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEtlZXAgb25lIHZpc2libGUgc3VtbWFyeSBpbnNpZGUgaXRzIGNhdGFsb2cncyB2aWV3cG9ydCBib3VuZHMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIFNlbGVjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gdXBkYXRlX3N0aWNreV9zdW1tYXJ5KCBjb250cm9sbGVyICkge1xuXHRcdHZhciBpc19zdGlja3kgPSBjb250cm9sbGVyLnN1bW1hcnkuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtdmlld3BvcnQtc3RpY2t5JyApO1xuXHRcdHZhciBsaXN0aW5nX3JlY3Q7XG5cdFx0dmFyIHNvdXJjZV9yZWN0O1xuXHRcdHZhciBzdGlja3lfdG9wO1xuXHRcdHZhciBzdW1tYXJ5X3JlY3Q7XG5cdFx0dmFyIHN1bW1hcnlfc3R5bGU7XG5cblx0XHRpZiAoXG5cdFx0XHRjb250cm9sbGVyLnN1bW1hcnkuaGlkZGVuXG5cdFx0XHR8fCAnbm9uZScgPT09IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCBjb250cm9sbGVyLnN1bW1hcnkgKS5kaXNwbGF5XG5cdFx0XHR8fCAhIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyggY29udHJvbGxlci5saXN0aW5nX2VsZW1lbnQgKVxuXHRcdCkge1xuXHRcdFx0cmVzZXRfc3RpY2t5X3N1bW1hcnkoIGNvbnRyb2xsZXIgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzdGlja3lfdG9wID0gZ2V0X3N0aWNreV90b3AoIGNvbnRyb2xsZXIuc3VtbWFyeSApO1xuXHRcdHNvdXJjZV9yZWN0ID0gKCBpc19zdGlja3kgPyBjb250cm9sbGVyLnBsYWNlaG9sZGVyIDogY29udHJvbGxlci5zdW1tYXJ5ICkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0bGlzdGluZ19yZWN0ID0gY29udHJvbGxlci5saXN0aW5nX2VsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0aWYgKCBzb3VyY2VfcmVjdC50b3AgPiBzdGlja3lfdG9wIHx8IGxpc3RpbmdfcmVjdC5ib3R0b20gPD0gc3RpY2t5X3RvcCArIGNvbnRyb2xsZXIuc3VtbWFyeS5vZmZzZXRIZWlnaHQgKSB7XG5cdFx0XHRyZXNldF9zdGlja3lfc3VtbWFyeSggY29udHJvbGxlciApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggISBpc19zdGlja3kgKSB7XG5cdFx0XHRzdW1tYXJ5X3JlY3QgPSBjb250cm9sbGVyLnN1bW1hcnkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRzdW1tYXJ5X3N0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoIGNvbnRyb2xsZXIuc3VtbWFyeSApO1xuXHRcdFx0Y29udHJvbGxlci5wbGFjZWhvbGRlci5zdHlsZS5oZWlnaHQgPSBzdW1tYXJ5X3JlY3QuaGVpZ2h0ICsgJ3B4Jztcblx0XHRcdGNvbnRyb2xsZXIucGxhY2Vob2xkZXIuc3R5bGUubWFyZ2luVG9wID0gc3VtbWFyeV9zdHlsZS5tYXJnaW5Ub3A7XG5cdFx0XHRjb250cm9sbGVyLnBsYWNlaG9sZGVyLnN0eWxlLm1hcmdpbkJvdHRvbSA9IHN1bW1hcnlfc3R5bGUubWFyZ2luQm90dG9tO1xuXHRcdFx0Y29udHJvbGxlci5wbGFjZWhvbGRlci5oaWRkZW4gPSBmYWxzZTtcblx0XHRcdGNvbnRyb2xsZXIuc3VtbWFyeS5jbGFzc0xpc3QuYWRkKCAnaXMtdmlld3BvcnQtc3RpY2t5JyApO1xuXHRcdH1cblxuXHRcdHNvdXJjZV9yZWN0ID0gY29udHJvbGxlci5wbGFjZWhvbGRlci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRjb250cm9sbGVyLnN1bW1hcnkuc3R5bGUubGVmdCA9IHNvdXJjZV9yZWN0LmxlZnQgKyAncHgnO1xuXHRcdGNvbnRyb2xsZXIuc3VtbWFyeS5zdHlsZS50b3AgPSBzdGlja3lfdG9wICsgJ3B4Jztcblx0XHRjb250cm9sbGVyLnN1bW1hcnkuc3R5bGUud2lkdGggPSBzb3VyY2VfcmVjdC53aWR0aCArICdweCc7XG5cdH1cblxuXHQvKipcblx0ICogU2NoZWR1bGUgYWxsIHN0aWNreSBzdW1tYXJpZXMgZm9yIHRoZSBuZXh0IGFuaW1hdGlvbiBmcmFtZS5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHNjaGVkdWxlX3N0aWNreV9zdW1tYXJpZXMoKSB7XG5cdFx0aWYgKCBzdGlja3lfZnJhbWUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3RpY2t5X2ZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSggZnVuY3Rpb24gKCkge1xuXHRcdFx0c3RpY2t5X2ZyYW1lID0gMDtcblx0XHRcdHN0aWNreV9jb250cm9sbGVycy5mb3JFYWNoKCB1cGRhdGVfc3RpY2t5X3N1bW1hcnkgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVnaXN0ZXIgYW4gYWRkaXRpb25hbCBjYXRhbG9nIGNvbnRyb2wgZm9yIGJvdW5kZWQgdmlld3BvcnQtc3RpY2t5IGJlaGF2aW9yLlxuXHQgKlxuXHQgKiBEb21haW4gY2F0YWxvZ3MgY2FuIHJlbmRlciBlZGl0aW5nIG9yIHN0YXR1cyBiYXJzIGFmdGVyIHRoZSBzaGFyZWQgY2F0YWxvZ1xuXHQgKiBjb250cm9sbGVyIG1vdW50cy4gUmVnaXN0ZXJpbmcgdGhlIHJlbmRlcmVkIGVsZW1lbnQgaGVyZSBnaXZlcyB0aG9zZSBiYXJzXG5cdCAqIHRoZSBzYW1lIG1lYXN1cmVkIFdvcmRQcmVzcy1oZWFkZXIgb2Zmc2V0IGFuZCBjYXRhbG9nIGJvdW5kYXJ5IGFzIHRoZVxuXHQgKiBzZWxlY3Rpb24gc3VtbWFyeSB3aXRob3V0IGludHJvZHVjaW5nIGRvbWFpbiBrbm93bGVkZ2UgaW50byBzaGFyZWQgY29kZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgY29udHJvbGxlciAgICAgU2VsZWN0aW9uIGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHN0aWNreV9lbGVtZW50IE9wdC1pbiBjYXRhbG9nIGNvbnRyb2wgZWxlbWVudC5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGEgbmV3IHN0aWNreSBjb250cm9sbGVyIHdhcyByZWdpc3RlcmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVnaXN0ZXJfdmlld3BvcnRfc3RpY2t5KCBjb250cm9sbGVyLCBzdGlja3lfZWxlbWVudCApIHtcblx0XHR2YXIgcGxhY2Vob2xkZXI7XG5cdFx0dmFyIHN0aWNreV9jb250cm9sbGVyO1xuXG5cdFx0aWYgKFxuXHRcdFx0ISBzdGlja3lfZWxlbWVudFxuXHRcdFx0fHwgISBjb250cm9sbGVyLmxpc3RpbmdfZWxlbWVudFxuXHRcdFx0fHwgJzEnID09PSBzdGlja3lfZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy12aWV3cG9ydC1zdGlja3ktaW5pdGlhbGl6ZWQnIClcblx0XHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRwbGFjZWhvbGRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG5cdFx0cGxhY2Vob2xkZXIuY2xhc3NOYW1lID0gJ3dwYmNfdWlfbGlzdGluZ19fdmlld3BvcnRfc3RpY2t5X3BsYWNlaG9sZGVyJztcblx0XHRwbGFjZWhvbGRlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xuXHRcdHBsYWNlaG9sZGVyLmhpZGRlbiA9IHRydWU7XG5cdFx0c3RpY2t5X2VsZW1lbnQucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoIHBsYWNlaG9sZGVyLCBzdGlja3lfZWxlbWVudCApO1xuXHRcdHN0aWNreV9lbGVtZW50LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXZpZXdwb3J0LXN0aWNreS1pbml0aWFsaXplZCcsICcxJyApO1xuXHRcdHN0aWNreV9jb250cm9sbGVyID0ge1xuXHRcdFx0bGlzdGluZ19lbGVtZW50OiBjb250cm9sbGVyLmxpc3RpbmdfZWxlbWVudCxcblx0XHRcdHBsYWNlaG9sZGVyOiBwbGFjZWhvbGRlcixcblx0XHRcdHN1bW1hcnk6IHN0aWNreV9lbGVtZW50XG5cdFx0fTtcblx0XHRzdGlja3lfY29udHJvbGxlcnMucHVzaCggc3RpY2t5X2NvbnRyb2xsZXIgKTtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5SZXNpemVPYnNlcnZlciApIHtcblx0XHRcdHN0aWNreV9jb250cm9sbGVyLnJlc2l6ZV9vYnNlcnZlciA9IG5ldyB3aW5kb3cuUmVzaXplT2JzZXJ2ZXIoIHNjaGVkdWxlX3N0aWNreV9zdW1tYXJpZXMgKTtcblx0XHRcdHN0aWNreV9jb250cm9sbGVyLnJlc2l6ZV9vYnNlcnZlci5vYnNlcnZlKCBjb250cm9sbGVyLmxpc3RpbmdfZWxlbWVudCApO1xuXHRcdFx0c3RpY2t5X2NvbnRyb2xsZXIucmVzaXplX29ic2VydmVyLm9ic2VydmUoIHN0aWNreV9lbGVtZW50ICk7XG5cdFx0fVxuXHRcdGlmICggISB2aWV3cG9ydF9ldmVudHNfYm91bmQgKSB7XG5cdFx0XHR2aWV3cG9ydF9ldmVudHNfYm91bmQgPSB0cnVlO1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdzY3JvbGwnLCBzY2hlZHVsZV9zdGlja3lfc3VtbWFyaWVzLCB0cnVlICk7XG5cdFx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3Jlc2l6ZScsIHNjaGVkdWxlX3N0aWNreV9zdW1tYXJpZXMgKTtcblx0XHR9XG5cdFx0c2NoZWR1bGVfc3RpY2t5X3N1bW1hcmllcygpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogRW1pdCBhIGRvbWFpbi1uZXV0cmFsIHNlbGVjdGlvbiBsaWZlY3ljbGUgZXZlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIFNlbGVjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRfbmFtZSBDYXRhbG9nIHNlbGVjdGlvbiBldmVudCBuYW1lLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGlzcGF0Y2hfc2VsZWN0aW9uX2V2ZW50KCBjb250cm9sbGVyLCBldmVudF9uYW1lICkge1xuXHRcdHZhciBpdGVtX2NvbnRyb2xzID0gZ2V0X2l0ZW1fY29udHJvbHMoIGNvbnRyb2xsZXIgKTtcblx0XHR2YXIgdmlzaWJsZV9zZWxlY3RlZF9pZHMgPSBpdGVtX2NvbnRyb2xzLmZpbHRlciggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0cmV0dXJuIGNvbnRyb2wuY2hlY2tlZDtcblx0XHR9ICkubWFwKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRyZXR1cm4gbm9ybWFsaXplX2l0ZW1faWQoIGNvbnRyb2wudmFsdWUgKTtcblx0XHR9ICk7XG5cdFx0dmFyIGV2ZW50X2RldGFpbCA9IHtcblx0XHRcdGNhdGFsb2dfaWQ6IGNvbnRyb2xsZXIuY2F0YWxvZ19pZCxcblx0XHRcdHNlbGVjdGVkX2lkczogZ2V0X3NlbGVjdGVkX2lkcyggY29udHJvbGxlciApLFxuXHRcdFx0dmlzaWJsZV9zZWxlY3RlZF9pZHM6IHZpc2libGVfc2VsZWN0ZWRfaWRzXG5cdFx0fTtcblx0XHR2YXIgc2VsZWN0aW9uX2V2ZW50O1xuXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LkN1c3RvbUV2ZW50ICkge1xuXHRcdFx0c2VsZWN0aW9uX2V2ZW50ID0gbmV3IHdpbmRvdy5DdXN0b21FdmVudCggZXZlbnRfbmFtZSwgeyBidWJibGVzOiB0cnVlLCBkZXRhaWw6IGV2ZW50X2RldGFpbCB9ICk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlbGVjdGlvbl9ldmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG5cdFx0XHRzZWxlY3Rpb25fZXZlbnQuaW5pdEN1c3RvbUV2ZW50KCBldmVudF9uYW1lLCB0cnVlLCBmYWxzZSwgZXZlbnRfZGV0YWlsICk7XG5cdFx0fVxuXHRcdGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5kaXNwYXRjaEV2ZW50KCBzZWxlY3Rpb25fZXZlbnQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBjaGVja2JveGVzLCByb3cgc3R5bGluZywgc2VsZWN0LWFsbCBzdGF0ZSwgYW5kIHN1bW1hcnkgc3RhdHVzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGNvbnRyb2xsZXIgICAgIFNlbGVjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGRpc3BhdGNoX2NoYW5nZSBXaGV0aGVyIHRvIGVtaXQgYSBzZWxlY3Rpb24tY2hhbmdlIGV2ZW50LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfc2VsZWN0aW9uKCBjb250cm9sbGVyLCBkaXNwYXRjaF9jaGFuZ2UgKSB7XG5cdFx0dmFyIGl0ZW1fY29udHJvbHMgPSBnZXRfaXRlbV9jb250cm9scyggY29udHJvbGxlciApO1xuXHRcdHZhciBzZWxlY3RfYWxsID0gY29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0LWFsbF0nICk7XG5cdFx0dmFyIHNlbGVjdGVkX2NvdW50ID0gZ2V0X3NlbGVjdGVkX2lkcyggY29udHJvbGxlciApLmxlbmd0aDtcblxuXHRcdGl0ZW1fY29udHJvbHMuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0dmFyIGl0ZW1faWQgPSBub3JtYWxpemVfaXRlbV9pZCggY29udHJvbC52YWx1ZSApO1xuXHRcdFx0dmFyIGlzX3NlbGVjdGVkID0gJycgIT09IGl0ZW1faWQgJiYgISEgY29udHJvbGxlci5zZWxlY3RlZF9pZHNbIGl0ZW1faWQgXTtcblx0XHRcdHZhciByb3cgPSBjb250cm9sLmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0YWJsZS1yb3ddJyApXG5cdFx0XHRcdHx8IGNvbnRyb2wuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYm9va2luZy1yZXNvdXJjZS1pZF0nICk7XG5cblx0XHRcdGNvbnRyb2wuY2hlY2tlZCA9IGlzX3NlbGVjdGVkO1xuXHRcdFx0aWYgKCByb3cgKSB7XG5cdFx0XHRcdHJvdy5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtc2VsZWN0ZWQnLCBpc19zZWxlY3RlZCApO1xuXHRcdFx0XHRpZiAoIHJvdy5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3Rpb24tY2hlY2tib3gtb25seScgKSApIHtcblx0XHRcdFx0XHRyb3cucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyb3cuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsIGlzX3NlbGVjdGVkID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0aWYgKCBzZWxlY3RfYWxsICkge1xuXHRcdFx0c2VsZWN0X2FsbC5jaGVja2VkID0gMCA8IGl0ZW1fY29udHJvbHMubGVuZ3RoICYmIGl0ZW1fY29udHJvbHMuZXZlcnkoIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRyb2wuY2hlY2tlZDtcblx0XHRcdH0gKTtcblx0XHRcdHNlbGVjdF9hbGwuaW5kZXRlcm1pbmF0ZSA9ICEgc2VsZWN0X2FsbC5jaGVja2VkICYmIGl0ZW1fY29udHJvbHMuc29tZSggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRyZXR1cm4gY29udHJvbC5jaGVja2VkO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdGlmICggY29udHJvbGxlci5zdW1tYXJ5ICkge1xuXHRcdFx0Y29udHJvbGxlci5zdW1tYXJ5LmhpZGRlbiA9IDAgPT09IHNlbGVjdGVkX2NvdW50O1xuXHRcdH1cblx0XHRpZiAoIGNvbnRyb2xsZXIuc3VtbWFyeV9jb3VudCApIHtcblx0XHRcdGNvbnRyb2xsZXIuc3VtbWFyeV9jb3VudC50ZXh0Q29udGVudCA9IFN0cmluZyggc2VsZWN0ZWRfY291bnQgKTtcblx0XHR9XG5cblx0XHRzY2hlZHVsZV9zdGlja3lfc3VtbWFyaWVzKCk7XG5cdFx0aWYgKCBkaXNwYXRjaF9jaGFuZ2UgKSB7XG5cdFx0XHRkaXNwYXRjaF9zZWxlY3Rpb25fZXZlbnQoIGNvbnRyb2xsZXIsICd3cGJjOnVpLWNhdGFsb2ctc2VsZWN0aW9uLWNoYW5nZScgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVtZW1iZXIgdGhlIGZvY3VzZWQgc2VsZWN0aW9uIGNvbnRyb2wgYmVmb3JlIHJlc3BvbnNlIG1hcmt1cCBpcyByZXBsYWNlZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRyb2xsZXIgU2VsZWN0aW9uIGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjYXB0dXJlX3NlbGVjdGlvbl9mb2N1cyggY29udHJvbGxlciApIHtcblx0XHR2YXIgYWN0aXZlX2VsZW1lbnQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHZhciBpdGVtX2NvbnRyb2w7XG5cblx0XHRjb250cm9sbGVyLmZvY3VzX3Rva2VuID0gbnVsbDtcblx0XHRpZiAoICEgYWN0aXZlX2VsZW1lbnQgfHwgISBjb250cm9sbGVyLm1vdW50X2VsZW1lbnQuY29udGFpbnMoIGFjdGl2ZV9lbGVtZW50ICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aXRlbV9jb250cm9sID0gYWN0aXZlX2VsZW1lbnQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtaXRlbV0nICk7XG5cdFx0aWYgKCBpdGVtX2NvbnRyb2wgKSB7XG5cdFx0XHRjb250cm9sbGVyLmZvY3VzX3Rva2VuID0geyB0eXBlOiAnaXRlbScsIGl0ZW1faWQ6IG5vcm1hbGl6ZV9pdGVtX2lkKCBpdGVtX2NvbnRyb2wudmFsdWUgKSB9O1xuXHRcdH0gZWxzZSBpZiAoIGFjdGl2ZV9lbGVtZW50LmNsb3Nlc3QoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0LWFsbF0nICkgKSB7XG5cdFx0XHRjb250cm9sbGVyLmZvY3VzX3Rva2VuID0geyB0eXBlOiAnc2VsZWN0X2FsbCcgfTtcblx0XHR9IGVsc2UgaWYgKCBhY3RpdmVfZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlbGVjdGlvbi1jbGVhcl0nICkgKSB7XG5cdFx0XHRjb250cm9sbGVyLmZvY3VzX3Rva2VuID0geyB0eXBlOiAnY2xlYXInIH07XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlc3RvcmUgZm9jdXMgYWZ0ZXIgc2VsZWN0ZWQgcm93cyBhcmUgcmVidWlsdCBieSBhbiBBSkFYIHJlc3BvbnNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBTZWxlY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlc3RvcmVfc2VsZWN0aW9uX2ZvY3VzKCBjb250cm9sbGVyICkge1xuXHRcdHZhciBmb2N1c190YXJnZXQgPSBudWxsO1xuXHRcdHZhciBmb2N1c190b2tlbiA9IGNvbnRyb2xsZXIuZm9jdXNfdG9rZW47XG5cblx0XHRjb250cm9sbGVyLmZvY3VzX3Rva2VuID0gbnVsbDtcblx0XHRpZiAoICEgZm9jdXNfdG9rZW4gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAnaXRlbScgPT09IGZvY3VzX3Rva2VuLnR5cGUgKSB7XG5cdFx0XHRnZXRfaXRlbV9jb250cm9scyggY29udHJvbGxlciApLnNvbWUoIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0aWYgKCBmb2N1c190b2tlbi5pdGVtX2lkID09PSBub3JtYWxpemVfaXRlbV9pZCggY29udHJvbC52YWx1ZSApICkge1xuXHRcdFx0XHRcdGZvY3VzX3RhcmdldCA9IGNvbnRyb2w7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXHRcdH0gZWxzZSBpZiAoICdzZWxlY3RfYWxsJyA9PT0gZm9jdXNfdG9rZW4udHlwZSApIHtcblx0XHRcdGZvY3VzX3RhcmdldCA9IGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlbGVjdC1hbGxdJyApO1xuXHRcdH0gZWxzZSBpZiAoICdjbGVhcicgPT09IGZvY3VzX3Rva2VuLnR5cGUgJiYgISBjb250cm9sbGVyLnN1bW1hcnkuaGlkZGVuICkge1xuXHRcdFx0Zm9jdXNfdGFyZ2V0ID0gY29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0aW9uLWNsZWFyXScgKTtcblx0XHR9XG5cblx0XHRpZiAoICEgZm9jdXNfdGFyZ2V0ICkge1xuXHRcdFx0Zm9jdXNfdGFyZ2V0ID0gY29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNhdGFsb2ctaGVhZGluZ10nICk7XG5cdFx0fVxuXHRcdGlmICggZm9jdXNfdGFyZ2V0ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBmb2N1c190YXJnZXQuZm9jdXMgKSB7XG5cdFx0XHRmb2N1c190YXJnZXQuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgYSBjaGVja2VkIG9yIHVuY2hlY2tlZCBzdGF0ZSB0byBhIHZpc2libGUgaW5jbHVzaXZlIHJhbmdlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb250cm9sbGVyICAgICBTZWxlY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gdGFyZ2V0X2NvbnRyb2wgUmFuZ2UgZW5kcG9pbnQgY2hlY2tib3guXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhIHZpc2libGUgcmFuZ2Ugd2FzIGFwcGxpZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBhcHBseV9zZWxlY3Rpb25fcmFuZ2UoIGNvbnRyb2xsZXIsIHRhcmdldF9jb250cm9sICkge1xuXHRcdHZhciBpdGVtX2NvbnRyb2xzID0gZ2V0X2l0ZW1fY29udHJvbHMoIGNvbnRyb2xsZXIgKTtcblx0XHR2YXIgYW5jaG9yX2luZGV4ID0gLTE7XG5cdFx0dmFyIHRhcmdldF9pbmRleCA9IGl0ZW1fY29udHJvbHMuaW5kZXhPZiggdGFyZ2V0X2NvbnRyb2wgKTtcblxuXHRcdGl0ZW1fY29udHJvbHMuc29tZSggZnVuY3Rpb24gKCBjb250cm9sLCBjb250cm9sX2luZGV4ICkge1xuXHRcdFx0aWYgKCBjb250cm9sbGVyLnJhbmdlX2FuY2hvcl9pZCA9PT0gbm9ybWFsaXplX2l0ZW1faWQoIGNvbnRyb2wudmFsdWUgKSApIHtcblx0XHRcdFx0YW5jaG9yX2luZGV4ID0gY29udHJvbF9pbmRleDtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSApO1xuXHRcdGlmICggMCA+IGFuY2hvcl9pbmRleCB8fCAwID4gdGFyZ2V0X2luZGV4ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGl0ZW1fY29udHJvbHMuc2xpY2UoIE1hdGgubWluKCBhbmNob3JfaW5kZXgsIHRhcmdldF9pbmRleCApLCBNYXRoLm1heCggYW5jaG9yX2luZGV4LCB0YXJnZXRfaW5kZXggKSArIDEgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHR2YXIgaXRlbV9pZCA9IG5vcm1hbGl6ZV9pdGVtX2lkKCBjb250cm9sLnZhbHVlICk7XG5cdFx0XHRpZiAoICcnID09PSBpdGVtX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIHRhcmdldF9jb250cm9sLmNoZWNrZWQgKSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIuc2VsZWN0ZWRfaWRzWyBpdGVtX2lkIF0gPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVsZXRlIGNvbnRyb2xsZXIuc2VsZWN0ZWRfaWRzWyBpdGVtX2lkIF07XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIGRlbGVnYXRlZCBzZWxlY3Rpb24gY2xpY2tzIGFuZCBjYXB0dXJlIFNoaWZ0IHJhbmdlIGludGVudC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9ICAgICBjb250cm9sbGVyIFNlbGVjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50ICAgICAgQ2F0YWxvZyBjbGljayBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggY29udHJvbGxlciwgZXZlbnQgKSB7XG5cdFx0dmFyIGNsZWFyX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3Rpb24tY2xlYXJdJyApO1xuXHRcdHZhciBpdGVtX2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtaXRlbV0nICk7XG5cblx0XHRpZiAoIGNsZWFyX2NvbnRyb2wgKSB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0Y29udHJvbGxlci5zZWxlY3RlZF9pZHMgPSBjcmVhdGVfc2VsZWN0ZWRfaWRzKCk7XG5cdFx0XHRjb250cm9sbGVyLnJhbmdlX2FuY2hvcl9pZCA9ICcnO1xuXHRcdFx0c3luY2hyb25pemVfc2VsZWN0aW9uKCBjb250cm9sbGVyLCB0cnVlICk7XG5cdFx0XHRmb2N1c19zZWxlY3Rpb25fZmFsbGJhY2soIGNvbnRyb2xsZXIgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb250cm9sbGVyLnNoaWZ0X2NvbnRyb2wgPSBudWxsO1xuXHRcdGlmICggaXRlbV9jb250cm9sICYmIGNvbnRyb2xsZXIucmFuZ2Vfc2VsZWN0aW9uX2VuYWJsZWQgJiYgZXZlbnQuc2hpZnRLZXkgKSB7XG5cdFx0XHRjb250cm9sbGVyLnNoaWZ0X2NvbnRyb2wgPSBpdGVtX2NvbnRyb2w7XG5cdFx0XHRjbGVhcl9yYW5nZV9zZWxlY3Rpb25fdGV4dCgpO1xuXHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGNsZWFyX3JhbmdlX3NlbGVjdGlvbl90ZXh0LCAwICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBpdGVtIGFuZCBzZWxlY3QtYWxsIGNoZWNrYm94IHN0YXRlIGNoYW5nZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIFNlbGVjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcGFyYW0ge0V2ZW50fSAgZXZlbnQgICAgICBDYXRhbG9nIGNoYW5nZSBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGNvbnRyb2xsZXIsIGV2ZW50ICkge1xuXHRcdHZhciBpdGVtX2NvbnRyb2xzO1xuXHRcdHZhciBpdGVtX2lkO1xuXG5cdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3QtYWxsXScgKSApIHtcblx0XHRcdGl0ZW1fY29udHJvbHMgPSBnZXRfaXRlbV9jb250cm9scyggY29udHJvbGxlciApO1xuXHRcdFx0aXRlbV9jb250cm9scy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRcdHZhciB2aXNpYmxlX2l0ZW1faWQgPSBub3JtYWxpemVfaXRlbV9pZCggY29udHJvbC52YWx1ZSApO1xuXHRcdFx0XHRpZiAoICcnID09PSB2aXNpYmxlX2l0ZW1faWQgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNoZWNrZWQgKSB7XG5cdFx0XHRcdFx0Y29udHJvbGxlci5zZWxlY3RlZF9pZHNbIHZpc2libGVfaXRlbV9pZCBdID0gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRkZWxldGUgY29udHJvbGxlci5zZWxlY3RlZF9pZHNbIHZpc2libGVfaXRlbV9pZCBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRjb250cm9sbGVyLnJhbmdlX2FuY2hvcl9pZCA9ICcnO1xuXHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLXNlbGVjdC1pdGVtXScgKSApIHtcblx0XHRcdGl0ZW1faWQgPSBub3JtYWxpemVfaXRlbV9pZCggZXZlbnQudGFyZ2V0LnZhbHVlICk7XG5cdFx0XHRpZiAoICcnID09PSBpdGVtX2lkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGNvbnRyb2xsZXIuc2hpZnRfY29udHJvbCAhPT0gZXZlbnQudGFyZ2V0IHx8ICEgY29udHJvbGxlci5yYW5nZV9hbmNob3JfaWQgfHwgISBhcHBseV9zZWxlY3Rpb25fcmFuZ2UoIGNvbnRyb2xsZXIsIGV2ZW50LnRhcmdldCApICkge1xuXHRcdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5jaGVja2VkICkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIuc2VsZWN0ZWRfaWRzWyBpdGVtX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRlbGV0ZSBjb250cm9sbGVyLnNlbGVjdGVkX2lkc1sgaXRlbV9pZCBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb250cm9sbGVyLnJhbmdlX2FuY2hvcl9pZCA9IGl0ZW1faWQ7XG5cdFx0XHRjb250cm9sbGVyLnNoaWZ0X2NvbnRyb2wgPSBudWxsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c3luY2hyb25pemVfc2VsZWN0aW9uKCBjb250cm9sbGVyLCB0cnVlICk7XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBzZWxlY3Rpb24gc3RhdGUgZm9yIG9uZSBtb3VudGVkIGNhdGFsb2cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1vdW50X2VsZW1lbnQgQ2F0YWxvZyBtb3VudCBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb25maWcgICAgICAgIFJlZ2lzdGVyZWQgYnJvd3NlciBjb25maWd1cmF0aW9uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IFNlbGVjdGlvbiBjb250cm9sbGVyIEFQSSBvciBmYWxzZSB3aGVuIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9zZWxlY3Rpb24oIG1vdW50X2VsZW1lbnQsIGNvbmZpZyApIHtcblx0XHR2YXIgY29udHJvbGxlcjtcblx0XHR2YXIgcGxhY2Vob2xkZXI7XG5cblx0XHRpZiAoICEgbW91bnRfZWxlbWVudCB8fCBtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfc2VsZWN0aW9uX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRyZXR1cm4gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb25fY29udHJvbGxlciA6IGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnRyb2xsZXIgPSB7XG5cdFx0XHRjYXRhbG9nX2lkOiBjb25maWcgJiYgY29uZmlnLmlkID8gU3RyaW5nKCBjb25maWcuaWQgKSA6ICcnLFxuXHRcdFx0Zm9jdXNfdG9rZW46IG51bGwsXG5cdFx0XHRsaXN0aW5nX2VsZW1lbnQ6IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1saXN0aW5nXScgKSxcblx0XHRcdG1vdW50X2VsZW1lbnQ6IG1vdW50X2VsZW1lbnQsXG5cdFx0XHRwbGFjZWhvbGRlcjogbnVsbCxcblx0XHRcdHJhbmdlX2FuY2hvcl9pZDogJycsXG5cdFx0XHRyYW5nZV9zZWxlY3Rpb25fZW5hYmxlZDogISEgKCBjb25maWcgJiYgY29uZmlnLmZlYXR1cmVzICYmIGNvbmZpZy5mZWF0dXJlcy5yYW5nZV9zZWxlY3Rpb24gKSxcblx0XHRcdHNlbGVjdGVkX2lkczogY3JlYXRlX3NlbGVjdGVkX2lkcygpLFxuXHRcdFx0c2hpZnRfY29udHJvbDogbnVsbCxcblx0XHRcdHN1bW1hcnk6IG1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1zZWxlY3Rpb24tc3VtbWFyeV0nICksXG5cdFx0XHRzdW1tYXJ5X2NvdW50OiBtb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0aW9uLWNvdW50XScgKVxuXHRcdH07XG5cdFx0aWYgKCAhIGNvbnRyb2xsZXIubGlzdGluZ19lbGVtZW50IHx8ICEgY29udHJvbGxlci5zdW1tYXJ5ICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICggJzEnID09PSBjb250cm9sbGVyLnN1bW1hcnkuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctc2VsZWN0aW9uLXN1bW1hcnktc3RpY2t5JyApICkge1xuXHRcdFx0cGxhY2Vob2xkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdFx0cGxhY2Vob2xkZXIuY2xhc3NOYW1lID0gJ3dwYmNfdWlfbGlzdGluZ19fc2VsZWN0aW9uX3N1bW1hcnlfcGxhY2Vob2xkZXInO1xuXHRcdFx0cGxhY2Vob2xkZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcblx0XHRcdHBsYWNlaG9sZGVyLmhpZGRlbiA9IHRydWU7XG5cdFx0XHRjb250cm9sbGVyLnN1bW1hcnkucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoIHBsYWNlaG9sZGVyLCBjb250cm9sbGVyLnN1bW1hcnkgKTtcblx0XHRcdGNvbnRyb2xsZXIucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcblx0XHRcdHN0aWNreV9jb250cm9sbGVycy5wdXNoKCBjb250cm9sbGVyICk7XG5cdFx0fVxuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aGFuZGxlX2NsaWNrKCBjb250cm9sbGVyLCBldmVudCApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aGFuZGxlX2NoYW5nZSggY29udHJvbGxlciwgZXZlbnQgKTtcblx0XHR9ICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp1aS1jYXRhbG9nLWJlZm9yZS1yZW5kZXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjYXB0dXJlX3NlbGVjdGlvbl9mb2N1cyggY29udHJvbGxlciApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOnVpLWNhdGFsb2ctcmVuZGVyZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRzeW5jaHJvbml6ZV9zZWxlY3Rpb24oIGNvbnRyb2xsZXIsIGZhbHNlICk7XG5cdFx0XHRkaXNwYXRjaF9zZWxlY3Rpb25fZXZlbnQoIGNvbnRyb2xsZXIsICd3cGJjOnVpLWNhdGFsb2ctc2VsZWN0aW9uLXJlc3RvcmVkJyApO1xuXHRcdFx0cmVzdG9yZV9zZWxlY3Rpb25fZm9jdXMoIGNvbnRyb2xsZXIgKTtcblx0XHR9ICk7XG5cblx0XHRpZiAoIGNvbnRyb2xsZXIucGxhY2Vob2xkZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5SZXNpemVPYnNlcnZlciApIHtcblx0XHRcdGNvbnRyb2xsZXIucmVzaXplX29ic2VydmVyID0gbmV3IHdpbmRvdy5SZXNpemVPYnNlcnZlciggc2NoZWR1bGVfc3RpY2t5X3N1bW1hcmllcyApO1xuXHRcdFx0Y29udHJvbGxlci5yZXNpemVfb2JzZXJ2ZXIub2JzZXJ2ZSggY29udHJvbGxlci5saXN0aW5nX2VsZW1lbnQgKTtcblx0XHR9XG5cdFx0aWYgKCBjb250cm9sbGVyLnBsYWNlaG9sZGVyICYmICEgdmlld3BvcnRfZXZlbnRzX2JvdW5kICkge1xuXHRcdFx0dmlld3BvcnRfZXZlbnRzX2JvdW5kID0gdHJ1ZTtcblx0XHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgc2NoZWR1bGVfc3RpY2t5X3N1bW1hcmllcywgdHJ1ZSApO1xuXHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBzY2hlZHVsZV9zdGlja3lfc3VtbWFyaWVzICk7XG5cdFx0fVxuXG5cdFx0Y29udHJvbGxlci5hcGkgPSB7XG5cdFx0XHRjbGVhcjogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRjb250cm9sbGVyLnNlbGVjdGVkX2lkcyA9IGNyZWF0ZV9zZWxlY3RlZF9pZHMoKTtcblx0XHRcdFx0Y29udHJvbGxlci5yYW5nZV9hbmNob3JfaWQgPSAnJztcblx0XHRcdFx0c3luY2hyb25pemVfc2VsZWN0aW9uKCBjb250cm9sbGVyLCB0cnVlICk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0X3NlbGVjdGVkX2lkczogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gZ2V0X3NlbGVjdGVkX2lkcyggY29udHJvbGxlciApO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyX3ZpZXdwb3J0X3N0aWNreTogZnVuY3Rpb24gKCBzdGlja3lfZWxlbWVudCApIHtcblx0XHRcdFx0cmV0dXJuIHJlZ2lzdGVyX3ZpZXdwb3J0X3N0aWNreSggY29udHJvbGxlciwgc3RpY2t5X2VsZW1lbnQgKTtcblx0XHRcdH0sXG5cdFx0XHRyZWZyZXNoX3ZpZXdwb3J0X3N0aWNreTogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRzY2hlZHVsZV9zdGlja3lfc3VtbWFyaWVzKCk7XG5cdFx0XHR9LFxuXHRcdFx0c3luY2hyb25pemU6IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0c3luY2hyb25pemVfc2VsZWN0aW9uKCBjb250cm9sbGVyLCBmYWxzZSApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0bW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbl9jb250cm9sbGVyID0gY29udHJvbGxlci5hcGk7XG5cdFx0c3luY2hyb25pemVfc2VsZWN0aW9uKCBjb250cm9sbGVyLCBmYWxzZSApO1xuXG5cdFx0cmV0dXJuIGNvbnRyb2xsZXIuYXBpO1xuXHR9XG5cblx0d2luZG93LndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb24gPSB3aW5kb3cud3BiY191aV9jYXRhbG9nX3NlbGVjdGlvbiB8fCB7fTtcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZ19zZWxlY3Rpb24uaW5pdGlhbGl6ZSA9IGluaXRpYWxpemVfc2VsZWN0aW9uO1xufSggd2luZG93LCBkb2N1bWVudCApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQy9CLFlBQVk7O0VBRVosSUFBSUMsa0JBQWtCLEdBQUcsRUFBRTtFQUMzQixJQUFJQyxZQUFZLEdBQUcsQ0FBQztFQUNwQixJQUFJQyxxQkFBcUIsR0FBRyxLQUFLOztFQUVqQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxpQkFBaUJBLENBQUVDLGFBQWEsRUFBRztJQUMzQyxPQUFPLElBQUksS0FBS0EsYUFBYSxJQUFJLFdBQVcsS0FBSyxPQUFPQSxhQUFhLEdBQ2xFLEVBQUUsR0FDRkMsTUFBTSxDQUFFRCxhQUFjLENBQUMsQ0FBQ0UsSUFBSSxDQUFDLENBQUM7RUFDbEM7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLG1CQUFtQkEsQ0FBQSxFQUFHO0lBQzlCLE9BQU9DLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLElBQUssQ0FB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
