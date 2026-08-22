"use strict";

/**
 * Manage reusable disclosure mechanics for independent WPBC catalogs.
 *
 * The controller understands only opaque node relationships and rendered DOM
 * attributes. Domain repositories, DTOs, templates, permissions, and business
 * values remain outside this shared presentation module.
 *
 * @since 11.6.0
 */
(function (window, document) {
  'use strict';

  var node_selector = '[data-wpbc-ui-catalog-node-id]';
  var toggle_selector = '[data-wpbc-ui-catalog-hierarchy-toggle]';
  var toggle_all_selector = '[data-wpbc-ui-catalog-hierarchy-toggle-all]';

  /**
   * Create a key map without inherited object properties.
   *
   * @return {Object} Empty identifier map.
   */
  function create_map() {
    return Object.create(null);
  }

  /**
   * Clear indexes captured from a previous rendered response.
   *
   * @param {Object} controller Hierarchy controller state.
   * @return {void}
   */
  function reset_structure(controller) {
    controller.nodes = [];
    controller.nodes_by_id = create_map();
    controller.summaries_by_node = create_map();
    controller.toggles_by_node = create_map();
    controller.expandable_node_ids = [];
  }

  /**
   * Normalize an opaque DOM node identifier.
   *
   * @param {*} node_id Candidate identifier.
   * @return {string} Trimmed identifier or an empty string.
   */
  function normalize_node_id(node_id) {
    return null === node_id || 'undefined' === typeof node_id ? '' : String(node_id).trim();
  }

  /**
   * Return the effective catalog-wide disclosure state from a response.
   *
   * @param {Object} hierarchy_response Normalized hierarchy response section.
   * @return {boolean} Whether containers start expanded.
   */
  function get_initial_expanded(hierarchy_response) {
    var preference_state = hierarchy_response && hierarchy_response.preference_state ? hierarchy_response.preference_state : {};
    if (true === preference_state.all_expanded || false === preference_state.all_expanded) {
      return preference_state.all_expanded;
    }
    return !!(hierarchy_response && hierarchy_response.expanded_by_default);
  }

  /**
   * Collect the rendered node, child, summary, and toggle indexes once.
   *
   * @param {Object} controller Hierarchy controller state.
   * @return {void}
   */
  function collect_structure(controller) {
    reset_structure(controller);
    controller.mount_element.querySelectorAll(node_selector).forEach(function (node_element) {
      var node_id = normalize_node_id(node_element.getAttribute('data-wpbc-ui-catalog-node-id'));
      var parent_node_id = normalize_node_id(node_element.getAttribute('data-wpbc-ui-catalog-parent-node-id'));
      var node_record;
      if (!node_id || controller.nodes_by_id[node_id]) {
        return;
      }
      node_record = {
        element: node_element,
        is_container: node_element.hasAttribute('data-wpbc-ui-catalog-hierarchy-container'),
        is_expandable: node_element.hasAttribute('data-wpbc-ui-catalog-hierarchy-expandable'),
        node_id: node_id,
        parent_node_id: parent_node_id
      };
      controller.nodes.push(node_record);
      controller.nodes_by_id[node_id] = node_record;
      if (node_record.is_container && node_record.is_expandable) {
        controller.expandable_node_ids.push(node_id);
      }
    });
    controller.mount_element.querySelectorAll('[data-wpbc-ui-catalog-hierarchy-summary-for]').forEach(function (summary_element) {
      var node_id = normalize_node_id(summary_element.getAttribute('data-wpbc-ui-catalog-hierarchy-summary-for'));
      if (node_id) {
        controller.summaries_by_node[node_id] = controller.summaries_by_node[node_id] || [];
        controller.summaries_by_node[node_id].push(summary_element);
      }
    });
    controller.mount_element.querySelectorAll(toggle_selector).forEach(function (toggle) {
      var node_id = normalize_node_id(toggle.getAttribute('data-wpbc-ui-catalog-hierarchy-toggle'));
      if (node_id) {
        controller.toggles_by_node[node_id] = controller.toggles_by_node[node_id] || [];
        controller.toggles_by_node[node_id].push(toggle);
      }
    });
  }

  /**
   * Synchronize one disclosure button with its current expanded state.
   *
   * @param {HTMLElement} toggle      Disclosure button.
   * @param {boolean}     is_expanded Current state.
   * @return {void}
   */
  function synchronize_toggle(toggle, is_expanded) {
    var toggle_icon = toggle.querySelector('[data-wpbc-ui-catalog-hierarchy-toggle-icon]');
    var toggle_label = is_expanded ? toggle.dataset.collapseLabel || '' : toggle.dataset.expandLabel || '';
    toggle.setAttribute('aria-expanded', is_expanded ? 'true' : 'false');
    toggle.setAttribute('aria-label', toggle_label);
    toggle.setAttribute('title', toggle_label);
    if (toggle_icon) {
      toggle_icon.classList.remove('wpbc-bi-chevron-down', 'wpbc-bi-chevron-right');
      toggle_icon.classList.add(is_expanded ? 'wpbc-bi-chevron-down' : 'wpbc-bi-chevron-right');
    }
  }

  /**
   * Return whether a rendered node is visible through all of its ancestors.
   *
   * Parents are guaranteed to precede children by the server contract, so the
   * visibility map is complete when each child is evaluated.
   *
   * @param {Object} node_record       Rendered node record.
   * @param {Object} visible_by_node   Visibility values already calculated.
   * @param {Object} expanded_by_node  Current container disclosure values.
   * @return {boolean} Whether the node row should be visible.
   */
  function is_node_visible(node_record, visible_by_node, expanded_by_node) {
    if (!node_record.parent_node_id) {
      return true;
    }
    return true === visible_by_node[node_record.parent_node_id] && true === expanded_by_node[node_record.parent_node_id];
  }

  /**
   * Apply the current disclosure map to nodes, summaries, and buttons.
   *
   * @param {Object} controller Hierarchy controller state.
   * @return {void}
   */
  function apply_visibility(controller) {
    var visible_by_node = create_map();
    controller.nodes.forEach(function (node_record) {
      var is_expanded = true === controller.expanded_by_node[node_record.node_id];
      var is_visible = is_node_visible(node_record, visible_by_node, controller.expanded_by_node);
      visible_by_node[node_record.node_id] = is_visible;
      node_record.element.hidden = !is_visible;
      if (node_record.is_container) {
        node_record.element.classList.toggle('is-expanded', is_expanded);
      }
    });
    Object.keys(controller.summaries_by_node).forEach(function (node_id) {
      var node_is_visible = true === visible_by_node[node_id];
      var is_expanded = true === controller.expanded_by_node[node_id];
      controller.summaries_by_node[node_id].forEach(function (summary_element) {
        summary_element.hidden = !node_is_visible || is_expanded;
      });
    });
    Object.keys(controller.toggles_by_node).forEach(function (node_id) {
      controller.toggles_by_node[node_id].forEach(function (toggle) {
        synchronize_toggle(toggle, true === controller.expanded_by_node[node_id]);
      });
    });
  }

  /**
   * Synchronize the expand-all button with all rendered containers.
   *
   * @param {Object} controller Hierarchy controller state.
   * @return {void}
   */
  function synchronize_toggle_all(controller) {
    var toggle_all = controller.mount_element.querySelector(toggle_all_selector);
    var all_expanded = 0 < controller.expandable_node_ids.length && controller.expandable_node_ids.every(function (node_id) {
      return true === controller.expanded_by_node[node_id];
    });
    var label;
    var icon;
    if (!toggle_all) {
      return;
    }
    toggle_all.hidden = !controller.enabled || 0 === controller.expandable_node_ids.length;
    label = all_expanded ? controller.i18n.collapse_all || '' : controller.i18n.expand_all || '';
    toggle_all.setAttribute('aria-pressed', all_expanded ? 'true' : 'false');
    toggle_all.setAttribute('aria-label', label);
    toggle_all.setAttribute('title', label);
    icon = toggle_all.querySelector('[data-wpbc-ui-catalog-hierarchy-toggle-all-icon]') || toggle_all.querySelector('span');
    if (icon) {
      icon.classList.remove('wpbc-bi-arrows-collapse-vertical', 'wpbc-bi-arrows-expand-vertical');
      icon.classList.add(all_expanded ? 'wpbc-bi-arrows-collapse-vertical' : 'wpbc-bi-arrows-expand-vertical');
    }
  }

  /**
   * Dispatch one domain-neutral hierarchy state event.
   *
   * @param {Object} controller  Hierarchy controller state.
   * @param {string} node_id     Changed node identifier or an empty string.
   * @param {boolean} is_expanded Current disclosure state.
   * @param {boolean} is_global   Whether expand-all initiated the change.
   * @return {void}
   */
  function dispatch_change(controller, node_id, is_expanded, is_global) {
    var hierarchy_event;
    var event_detail = {
      all_expanded: is_global ? is_expanded : null,
      catalog_id: controller.catalog_id,
      expanded: is_expanded,
      global: is_global,
      node_id: node_id
    };
    if ('function' === typeof window.CustomEvent) {
      hierarchy_event = new window.CustomEvent('wpbc:ui-catalog-hierarchy-change', {
        bubbles: true,
        detail: event_detail
      });
    } else {
      hierarchy_event = document.createEvent('CustomEvent');
      hierarchy_event.initCustomEvent('wpbc:ui-catalog-hierarchy-change', true, false, event_detail);
    }
    controller.mount_element.dispatchEvent(hierarchy_event);
  }

  /**
   * Persist the global disclosure Boolean through the owning catalog callback.
   *
   * @param {Object} controller Hierarchy controller state.
   * @return {void}
   */
  function schedule_preference_save(controller) {
    if ('global' !== controller.persistence || 'function' !== typeof controller.save_preferences) {
      return;
    }
    window.clearTimeout(controller.save_timer);
    controller.save_timer = window.setTimeout(function () {
      controller.save_preferences({
        all_expanded: controller.global_expanded
      });
    }, 250);
  }

  /**
   * Expand or collapse one rendered container without persisting per-node state.
   *
   * @param {Object}  controller  Hierarchy controller state.
   * @param {string}  node_id     Opaque container node identifier.
   * @param {boolean} is_expanded Requested disclosure state.
   * @param {boolean} restore_parent_focus Whether a summary activation should focus its parent toggle.
   * @return {boolean} Whether a container state changed.
   */
  function set_node_expanded(controller, node_id, is_expanded, restore_parent_focus) {
    var node_record = controller.nodes_by_id[node_id];
    var parent_toggle;
    if (!controller.enabled || !node_record || !node_record.is_expandable) {
      return false;
    }
    controller.expanded_by_node[node_id] = !!is_expanded;
    apply_visibility(controller);
    synchronize_toggle_all(controller);
    dispatch_change(controller, node_id, !!is_expanded, false);
    if (restore_parent_focus) {
      parent_toggle = get_parent_toggle(controller, node_id);
      if (parent_toggle && 'function' === typeof parent_toggle.focus) {
        parent_toggle.focus();
      }
    }
    return true;
  }

  /**
   * Expand or collapse every rendered container and persist one Boolean.
   *
   * @param {Object}  controller  Hierarchy controller state.
   * @param {boolean} is_expanded Requested global state.
   * @return {void}
   */
  function set_all_expanded(controller, is_expanded) {
    controller.expandable_node_ids.forEach(function (node_id) {
      controller.expanded_by_node[node_id] = !!is_expanded;
    });
    controller.global_expanded = !!is_expanded;
    apply_visibility(controller);
    synchronize_toggle_all(controller);
    dispatch_change(controller, '', !!is_expanded, true);
    schedule_preference_save(controller);
  }

  /**
   * Return the primary container-row toggle for one node.
   *
   * @param {Object} controller Hierarchy controller state.
   * @param {string} node_id    Opaque node identifier.
   * @return {HTMLElement|null} Parent toggle or null.
   */
  function get_parent_toggle(controller, node_id) {
    var toggles = controller.toggles_by_node[node_id] || [];
    var parent_toggle = null;
    toggles.some(function (toggle) {
      if (toggle.hasAttribute('data-wpbc-ui-catalog-hierarchy-parent-toggle')) {
        parent_toggle = toggle;
        return true;
      }
      return false;
    });
    return parent_toggle;
  }

  /**
   * Capture hierarchy focus before AJAX replaces the current rows.
   *
   * @param {Object} controller Hierarchy controller state.
   * @return {void}
   */
  function capture_focus(controller) {
    var active_element = document.activeElement;
    var toggle;
    controller.focus_token = null;
    if (!active_element || !controller.mount_element.contains(active_element)) {
      return;
    }
    if (active_element.closest(toggle_all_selector)) {
      controller.focus_token = {
        type: 'all'
      };
      return;
    }
    toggle = active_element.closest(toggle_selector);
    if (toggle) {
      controller.focus_token = {
        node_id: normalize_node_id(toggle.getAttribute('data-wpbc-ui-catalog-hierarchy-toggle')),
        type: 'node'
      };
    }
  }

  /**
   * Restore hierarchy focus after current rows have been mounted.
   *
   * @param {Object} controller Hierarchy controller state.
   * @return {void}
   */
  function restore_focus(controller) {
    var focus_target = null;
    var focus_token = controller.focus_token;
    controller.focus_token = null;
    if (!focus_token) {
      return;
    }
    if ('all' === focus_token.type) {
      focus_target = controller.mount_element.querySelector(toggle_all_selector);
    } else if ('node' === focus_token.type) {
      focus_target = get_parent_toggle(controller, focus_token.node_id);
    }
    if (focus_target && !focus_target.hidden && 'function' === typeof focus_target.focus) {
      focus_target.focus();
    }
  }

  /**
   * Handle delegated hierarchy clicks.
   *
   * @param {Object}     controller Hierarchy controller state.
   * @param {MouseEvent} event      Catalog click event.
   * @return {void}
   */
  function handle_click(controller, event) {
    var toggle_all = event.target.closest(toggle_all_selector);
    var toggle = event.target.closest(toggle_selector);
    var node_id;
    if (toggle_all && controller.mount_element.contains(toggle_all)) {
      event.preventDefault();
      set_all_expanded(controller, 'true' !== toggle_all.getAttribute('aria-pressed'));
      return;
    }
    if (!toggle || !controller.mount_element.contains(toggle)) {
      return;
    }
    event.preventDefault();
    node_id = normalize_node_id(toggle.getAttribute('data-wpbc-ui-catalog-hierarchy-toggle'));
    set_node_expanded(controller, node_id, 'true' !== toggle.getAttribute('aria-expanded'), toggle.hasAttribute('data-wpbc-ui-catalog-hierarchy-summary-toggle'));
  }

  /**
   * Support conventional Left/Right disclosure keyboard behavior.
   *
   * @param {Object}        controller Hierarchy controller state.
   * @param {KeyboardEvent} event      Catalog keyboard event.
   * @return {void}
   */
  function handle_keydown(controller, event) {
    var toggle = event.target.closest(toggle_selector);
    var node_id;
    if (!toggle || !controller.mount_element.contains(toggle) || 'ArrowLeft' !== event.key && 'ArrowRight' !== event.key) {
      return;
    }
    event.preventDefault();
    node_id = normalize_node_id(toggle.getAttribute('data-wpbc-ui-catalog-hierarchy-toggle'));
    set_node_expanded(controller, node_id, 'ArrowRight' === event.key, false);
  }

  /**
   * Refresh one hierarchy controller from newly rendered response rows.
   *
   * @param {Object} controller         Hierarchy controller state.
   * @param {Object} hierarchy_response Normalized response hierarchy section.
   * @return {boolean} Whether hierarchy behavior is active.
   */
  function refresh_controller(controller, hierarchy_response) {
    controller.enabled = !!(hierarchy_response && hierarchy_response.enabled);
    controller.expanded_by_node = create_map();
    controller.global_expanded = get_initial_expanded(hierarchy_response || {});
    if (!controller.enabled) {
      reset_structure(controller);
      synchronize_toggle_all(controller);
      controller.focus_token = null;
      return false;
    }
    collect_structure(controller);
    controller.nodes.forEach(function (node_record) {
      if (node_record.is_container && !node_record.is_expandable) {
        controller.expanded_by_node[node_record.node_id] = true;
      }
    });
    controller.expandable_node_ids.forEach(function (node_id) {
      controller.expanded_by_node[node_id] = controller.global_expanded;
    });
    apply_visibility(controller);
    synchronize_toggle_all(controller);
    restore_focus(controller);
    return controller.enabled;
  }

  /**
   * Initialize hierarchy mechanics for one mounted catalog.
   *
   * @param {HTMLElement} mount_element    Catalog mount element.
   * @param {Object}      config           Registered browser configuration.
   * @param {Function}    save_preferences Callback accepting normalized global state.
   * @return {Object|false} Hierarchy controller API or false when unavailable.
   */
  function initialize_hierarchy(mount_element, config, save_preferences) {
    var hierarchy_configuration;
    var controller;
    if (!mount_element || mount_element._wpbc_ui_catalog_hierarchy_controller) {
      return mount_element ? mount_element._wpbc_ui_catalog_hierarchy_controller : false;
    }
    hierarchy_configuration = config && config.hierarchy ? config.hierarchy : {};
    controller = {
      catalog_id: config && config.id ? String(config.id) : '',
      expandable_node_ids: [],
      enabled: false,
      expanded_by_node: create_map(),
      focus_token: null,
      global_expanded: false,
      i18n: config && config.i18n ? config.i18n : {},
      mount_element: mount_element,
      nodes: [],
      nodes_by_id: create_map(),
      persistence: hierarchy_configuration.persistence || 'none',
      save_preferences: save_preferences,
      save_timer: 0,
      summaries_by_node: create_map(),
      toggles_by_node: create_map()
    };
    mount_element.addEventListener('click', function (event) {
      handle_click(controller, event);
    });
    mount_element.addEventListener('keydown', function (event) {
      handle_keydown(controller, event);
    });
    mount_element.addEventListener('wpbc:ui-catalog-before-render', function () {
      capture_focus(controller);
    });
    controller.api = {
      get_all_expanded: function () {
        return controller.global_expanded;
      },
      refresh: function (hierarchy_response) {
        return refresh_controller(controller, hierarchy_response || {});
      },
      set_all_expanded: function (is_expanded) {
        set_all_expanded(controller, !!is_expanded);
      },
      set_node_expanded: function (node_id, is_expanded) {
        return set_node_expanded(controller, normalize_node_id(node_id), !!is_expanded, false);
      }
    };
    mount_element._wpbc_ui_catalog_hierarchy_controller = controller.api;
    return controller.api;
  }
  window.wpbc_ui_catalog_hierarchy = window.wpbc_ui_catalog_hierarchy || {};
  window.wpbc_ui_catalog_hierarchy.get_initial_expanded = get_initial_expanded;
  window.wpbc_ui_catalog_hierarchy.initialize = initialize_hierarchy;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19vdXQvd3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeS5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50Iiwibm9kZV9zZWxlY3RvciIsInRvZ2dsZV9zZWxlY3RvciIsInRvZ2dsZV9hbGxfc2VsZWN0b3IiLCJjcmVhdGVfbWFwIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVzZXRfc3RydWN0dXJlIiwiY29udHJvbGxlciIsIm5vZGVzIiwibm9kZXNfYnlfaWQiLCJzdW1tYXJpZXNfYnlfbm9kZSIsInRvZ2dsZXNfYnlfbm9kZSIsImV4cGFuZGFibGVfbm9kZV9pZHMiLCJub3JtYWxpemVfbm9kZV9pZCIsIm5vZGVfaWQiLCJTdHJpbmciLCJ0cmltIiwiZ2V0X2luaXRpYWxfZXhwYW5kZWQiLCJoaWVyYXJjaHlfcmVzcG9uc2UiLCJwcmVmZXJlbmNlX3N0YXRlIiwiYWxsX2V4cGFuZGVkIiwiZXhwYW5kZWRfYnlfZGVmYXVsdCIsImNvbGxlY3Rfc3RydWN0dXJlIiwibW91bnRfZWxlbWVudCIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb3JFYWNoIiwibm9kZV9lbGVtZW50IiwiZ2V0QXR0cmlidXRlIiwicGFyZW50X25vZGVfaWQiLCJub2RlX3JlY29yZCIsImVsZW1lbnQiLCJpc19jb250YWluZXIiLCJoYXNBdHRyaWJ1dGUiLCJpc19leHBhbmRhYmxlIiwicHVzaCIsInN1bW1hcnlfZWxlbWVudCIsInRvZ2dsZSIsInN5bmNocm9uaXplX3RvZ2dsZSIsImlzX2V4cGFuZGVkIiwidG9nZ2xlX2ljb24iLCJxdWVyeVNlbGVjdG9yIiwidG9nZ2xlX2xhYmVsIiwiZGF0YXNldCIsImNvbGxhcHNlTGFiZWwiLCJleHBhbmRMYWJlbCIsInNldEF0dHJpYnV0ZSIsImNsYXNzTGlzdCIsInJlbW92ZSIsImFkZCIsImlzX25vZGVfdmlzaWJsZSIsInZpc2libGVfYnlfbm9kZSIsImV4cGFuZGVkX2J5X25vZGUiLCJhcHBseV92aXNpYmlsaXR5IiwiaXNfdmlzaWJsZSIsImhpZGRlbiIsImtleXMiLCJub2RlX2lzX3Zpc2libGUiLCJzeW5jaHJvbml6ZV90b2dnbGVfYWxsIiwidG9nZ2xlX2FsbCIsImxlbmd0aCIsImV2ZXJ5IiwibGFiZWwiLCJpY29uIiwiZW5hYmxlZCIsImkxOG4iLCJjb2xsYXBzZV9hbGwiLCJleHBhbmRfYWxsIiwiZGlzcGF0Y2hfY2hhbmdlIiwiaXNfZ2xvYmFsIiwiaGllcmFyY2h5X2V2ZW50IiwiZXZlbnRfZGV0YWlsIiwiY2F0YWxvZ19pZCIsImV4cGFuZGVkIiwiZ2xvYmFsIiwiQ3VzdG9tRXZlbnQiLCJidWJibGVzIiwiZGV0YWlsIiwiY3JlYXRlRXZlbnQiLCJpbml0Q3VzdG9tRXZlbnQiLCJkaXNwYXRjaEV2ZW50Iiwic2NoZWR1bGVfcHJlZmVyZW5jZV9zYXZlIiwicGVyc2lzdGVuY2UiLCJzYXZlX3ByZWZlcmVuY2VzIiwiY2xlYXJUaW1lb3V0Iiwic2F2ZV90aW1lciIsInNldFRpbWVvdXQiLCJnbG9iYWxfZXhwYW5kZWQiLCJzZXRfbm9kZV9leHBhbmRlZCIsInJlc3RvcmVfcGFyZW50X2ZvY3VzIiwicGFyZW50X3RvZ2dsZSIsImdldF9wYXJlbnRfdG9nZ2xlIiwiZm9jdXMiLCJzZXRfYWxsX2V4cGFuZGVkIiwidG9nZ2xlcyIsInNvbWUiLCJjYXB0dXJlX2ZvY3VzIiwiYWN0aXZlX2VsZW1lbnQiLCJhY3RpdmVFbGVtZW50IiwiZm9jdXNfdG9rZW4iLCJjb250YWlucyIsImNsb3Nlc3QiLCJ0eXBlIiwicmVzdG9yZV9mb2N1cyIsImZvY3VzX3RhcmdldCIsImhhbmRsZV9jbGljayIsImV2ZW50IiwidGFyZ2V0IiwicHJldmVudERlZmF1bHQiLCJoYW5kbGVfa2V5ZG93biIsImtleSIsInJlZnJlc2hfY29udHJvbGxlciIsImluaXRpYWxpemVfaGllcmFyY2h5IiwiY29uZmlnIiwiaGllcmFyY2h5X2NvbmZpZ3VyYXRpb24iLCJfd3BiY191aV9jYXRhbG9nX2hpZXJhcmNoeV9jb250cm9sbGVyIiwiaGllcmFyY2h5IiwiaWQiLCJhZGRFdmVudExpc3RlbmVyIiwiYXBpIiwiZ2V0X2FsbF9leHBhbmRlZCIsInJlZnJlc2giLCJ3cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5IiwiaW5pdGlhbGl6ZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19zaGFyZWQtdWktY2F0YWxvZy9fc3JjL3dwYmNfdWlfY2F0YWxvZ19oaWVyYXJjaHkuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBNYW5hZ2UgcmV1c2FibGUgZGlzY2xvc3VyZSBtZWNoYW5pY3MgZm9yIGluZGVwZW5kZW50IFdQQkMgY2F0YWxvZ3MuXG4gKlxuICogVGhlIGNvbnRyb2xsZXIgdW5kZXJzdGFuZHMgb25seSBvcGFxdWUgbm9kZSByZWxhdGlvbnNoaXBzIGFuZCByZW5kZXJlZCBET01cbiAqIGF0dHJpYnV0ZXMuIERvbWFpbiByZXBvc2l0b3JpZXMsIERUT3MsIHRlbXBsYXRlcywgcGVybWlzc2lvbnMsIGFuZCBidXNpbmVzc1xuICogdmFsdWVzIHJlbWFpbiBvdXRzaWRlIHRoaXMgc2hhcmVkIHByZXNlbnRhdGlvbiBtb2R1bGUuXG4gKlxuICogQHNpbmNlIDExLjYuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBub2RlX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1ub2RlLWlkXSc7XG5cdHZhciB0b2dnbGVfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWhpZXJhcmNoeS10b2dnbGVdJztcblx0dmFyIHRvZ2dsZV9hbGxfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWhpZXJhcmNoeS10b2dnbGUtYWxsXSc7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIGtleSBtYXAgd2l0aG91dCBpbmhlcml0ZWQgb2JqZWN0IHByb3BlcnRpZXMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge09iamVjdH0gRW1wdHkgaWRlbnRpZmllciBtYXAuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfbWFwKCkge1xuXHRcdHJldHVybiBPYmplY3QuY3JlYXRlKCBudWxsICk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xlYXIgaW5kZXhlcyBjYXB0dXJlZCBmcm9tIGEgcHJldmlvdXMgcmVuZGVyZWQgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzZXRfc3RydWN0dXJlKCBjb250cm9sbGVyICkge1xuXHRcdGNvbnRyb2xsZXIubm9kZXMgPSBbXTtcblx0XHRjb250cm9sbGVyLm5vZGVzX2J5X2lkID0gY3JlYXRlX21hcCgpO1xuXHRcdGNvbnRyb2xsZXIuc3VtbWFyaWVzX2J5X25vZGUgPSBjcmVhdGVfbWFwKCk7XG5cdFx0Y29udHJvbGxlci50b2dnbGVzX2J5X25vZGUgPSBjcmVhdGVfbWFwKCk7XG5cdFx0Y29udHJvbGxlci5leHBhbmRhYmxlX25vZGVfaWRzID0gW107XG5cdH1cblxuXHQvKipcblx0ICogTm9ybWFsaXplIGFuIG9wYXF1ZSBET00gbm9kZSBpZGVudGlmaWVyLlxuXHQgKlxuXHQgKiBAcGFyYW0geyp9IG5vZGVfaWQgQ2FuZGlkYXRlIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gVHJpbW1lZCBpZGVudGlmaWVyIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9ub2RlX2lkKCBub2RlX2lkICkge1xuXHRcdHJldHVybiBudWxsID09PSBub2RlX2lkIHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2Ygbm9kZV9pZCA/ICcnIDogU3RyaW5nKCBub2RlX2lkICkudHJpbSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB0aGUgZWZmZWN0aXZlIGNhdGFsb2ctd2lkZSBkaXNjbG9zdXJlIHN0YXRlIGZyb20gYSByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGhpZXJhcmNoeV9yZXNwb25zZSBOb3JtYWxpemVkIGhpZXJhcmNoeSByZXNwb25zZSBzZWN0aW9uLlxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBXaGV0aGVyIGNvbnRhaW5lcnMgc3RhcnQgZXhwYW5kZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfaW5pdGlhbF9leHBhbmRlZCggaGllcmFyY2h5X3Jlc3BvbnNlICkge1xuXHRcdHZhciBwcmVmZXJlbmNlX3N0YXRlID0gaGllcmFyY2h5X3Jlc3BvbnNlICYmIGhpZXJhcmNoeV9yZXNwb25zZS5wcmVmZXJlbmNlX3N0YXRlXG5cdFx0XHQ/IGhpZXJhcmNoeV9yZXNwb25zZS5wcmVmZXJlbmNlX3N0YXRlXG5cdFx0XHQ6IHt9O1xuXG5cdFx0aWYgKCB0cnVlID09PSBwcmVmZXJlbmNlX3N0YXRlLmFsbF9leHBhbmRlZCB8fCBmYWxzZSA9PT0gcHJlZmVyZW5jZV9zdGF0ZS5hbGxfZXhwYW5kZWQgKSB7XG5cdFx0XHRyZXR1cm4gcHJlZmVyZW5jZV9zdGF0ZS5hbGxfZXhwYW5kZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICEhICggaGllcmFyY2h5X3Jlc3BvbnNlICYmIGhpZXJhcmNoeV9yZXNwb25zZS5leHBhbmRlZF9ieV9kZWZhdWx0ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ29sbGVjdCB0aGUgcmVuZGVyZWQgbm9kZSwgY2hpbGQsIHN1bW1hcnksIGFuZCB0b2dnbGUgaW5kZXhlcyBvbmNlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBIaWVyYXJjaHkgY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNvbGxlY3Rfc3RydWN0dXJlKCBjb250cm9sbGVyICkge1xuXHRcdHJlc2V0X3N0cnVjdHVyZSggY29udHJvbGxlciApO1xuXG5cdFx0Y29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIG5vZGVfc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIG5vZGVfZWxlbWVudCApIHtcblx0XHRcdHZhciBub2RlX2lkID0gbm9ybWFsaXplX25vZGVfaWQoIG5vZGVfZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1ub2RlLWlkJyApICk7XG5cdFx0XHR2YXIgcGFyZW50X25vZGVfaWQgPSBub3JtYWxpemVfbm9kZV9pZCggbm9kZV9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLXBhcmVudC1ub2RlLWlkJyApICk7XG5cdFx0XHR2YXIgbm9kZV9yZWNvcmQ7XG5cblx0XHRcdGlmICggISBub2RlX2lkIHx8IGNvbnRyb2xsZXIubm9kZXNfYnlfaWRbIG5vZGVfaWQgXSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bm9kZV9yZWNvcmQgPSB7XG5cdFx0XHRcdGVsZW1lbnQ6IG5vZGVfZWxlbWVudCxcblx0XHRcdFx0aXNfY29udGFpbmVyOiBub2RlX2VsZW1lbnQuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaGllcmFyY2h5LWNvbnRhaW5lcicgKSxcblx0XHRcdFx0aXNfZXhwYW5kYWJsZTogbm9kZV9lbGVtZW50Lmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWhpZXJhcmNoeS1leHBhbmRhYmxlJyApLFxuXHRcdFx0XHRub2RlX2lkOiBub2RlX2lkLFxuXHRcdFx0XHRwYXJlbnRfbm9kZV9pZDogcGFyZW50X25vZGVfaWRcblx0XHRcdH07XG5cdFx0XHRjb250cm9sbGVyLm5vZGVzLnB1c2goIG5vZGVfcmVjb3JkICk7XG5cdFx0XHRjb250cm9sbGVyLm5vZGVzX2J5X2lkWyBub2RlX2lkIF0gPSBub2RlX3JlY29yZDtcblx0XHRcdGlmICggbm9kZV9yZWNvcmQuaXNfY29udGFpbmVyICYmIG5vZGVfcmVjb3JkLmlzX2V4cGFuZGFibGUgKSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIuZXhwYW5kYWJsZV9ub2RlX2lkcy5wdXNoKCBub2RlX2lkICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0Y29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXVpLWNhdGFsb2ctaGllcmFyY2h5LXN1bW1hcnktZm9yXScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHN1bW1hcnlfZWxlbWVudCApIHtcblx0XHRcdHZhciBub2RlX2lkID0gbm9ybWFsaXplX25vZGVfaWQoIHN1bW1hcnlfZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1oaWVyYXJjaHktc3VtbWFyeS1mb3InICkgKTtcblx0XHRcdGlmICggbm9kZV9pZCApIHtcblx0XHRcdFx0Y29udHJvbGxlci5zdW1tYXJpZXNfYnlfbm9kZVsgbm9kZV9pZCBdID0gY29udHJvbGxlci5zdW1tYXJpZXNfYnlfbm9kZVsgbm9kZV9pZCBdIHx8IFtdO1xuXHRcdFx0XHRjb250cm9sbGVyLnN1bW1hcmllc19ieV9ub2RlWyBub2RlX2lkIF0ucHVzaCggc3VtbWFyeV9lbGVtZW50ICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0Y29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHRvZ2dsZV9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggdG9nZ2xlICkge1xuXHRcdFx0dmFyIG5vZGVfaWQgPSBub3JtYWxpemVfbm9kZV9pZCggdG9nZ2xlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWhpZXJhcmNoeS10b2dnbGUnICkgKTtcblx0XHRcdGlmICggbm9kZV9pZCApIHtcblx0XHRcdFx0Y29udHJvbGxlci50b2dnbGVzX2J5X25vZGVbIG5vZGVfaWQgXSA9IGNvbnRyb2xsZXIudG9nZ2xlc19ieV9ub2RlWyBub2RlX2lkIF0gfHwgW107XG5cdFx0XHRcdGNvbnRyb2xsZXIudG9nZ2xlc19ieV9ub2RlWyBub2RlX2lkIF0ucHVzaCggdG9nZ2xlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIG9uZSBkaXNjbG9zdXJlIGJ1dHRvbiB3aXRoIGl0cyBjdXJyZW50IGV4cGFuZGVkIHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0b2dnbGUgICAgICBEaXNjbG9zdXJlIGJ1dHRvbi5cblx0ICogQHBhcmFtIHtib29sZWFufSAgICAgaXNfZXhwYW5kZWQgQ3VycmVudCBzdGF0ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNocm9uaXplX3RvZ2dsZSggdG9nZ2xlLCBpc19leHBhbmRlZCApIHtcblx0XHR2YXIgdG9nZ2xlX2ljb24gPSB0b2dnbGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1oaWVyYXJjaHktdG9nZ2xlLWljb25dJyApO1xuXHRcdHZhciB0b2dnbGVfbGFiZWwgPSBpc19leHBhbmRlZCA/IHRvZ2dsZS5kYXRhc2V0LmNvbGxhcHNlTGFiZWwgfHwgJycgOiB0b2dnbGUuZGF0YXNldC5leHBhbmRMYWJlbCB8fCAnJztcblxuXHRcdHRvZ2dsZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgaXNfZXhwYW5kZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0dG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCB0b2dnbGVfbGFiZWwgKTtcblx0XHR0b2dnbGUuc2V0QXR0cmlidXRlKCAndGl0bGUnLCB0b2dnbGVfbGFiZWwgKTtcblx0XHRpZiAoIHRvZ2dsZV9pY29uICkge1xuXHRcdFx0dG9nZ2xlX2ljb24uY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmMtYmktY2hldnJvbi1kb3duJywgJ3dwYmMtYmktY2hldnJvbi1yaWdodCcgKTtcblx0XHRcdHRvZ2dsZV9pY29uLmNsYXNzTGlzdC5hZGQoIGlzX2V4cGFuZGVkID8gJ3dwYmMtYmktY2hldnJvbi1kb3duJyA6ICd3cGJjLWJpLWNoZXZyb24tcmlnaHQnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiB3aGV0aGVyIGEgcmVuZGVyZWQgbm9kZSBpcyB2aXNpYmxlIHRocm91Z2ggYWxsIG9mIGl0cyBhbmNlc3RvcnMuXG5cdCAqXG5cdCAqIFBhcmVudHMgYXJlIGd1YXJhbnRlZWQgdG8gcHJlY2VkZSBjaGlsZHJlbiBieSB0aGUgc2VydmVyIGNvbnRyYWN0LCBzbyB0aGVcblx0ICogdmlzaWJpbGl0eSBtYXAgaXMgY29tcGxldGUgd2hlbiBlYWNoIGNoaWxkIGlzIGV2YWx1YXRlZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IG5vZGVfcmVjb3JkICAgICAgIFJlbmRlcmVkIG5vZGUgcmVjb3JkLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gdmlzaWJsZV9ieV9ub2RlICAgVmlzaWJpbGl0eSB2YWx1ZXMgYWxyZWFkeSBjYWxjdWxhdGVkLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZXhwYW5kZWRfYnlfbm9kZSAgQ3VycmVudCBjb250YWluZXIgZGlzY2xvc3VyZSB2YWx1ZXMuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgdGhlIG5vZGUgcm93IHNob3VsZCBiZSB2aXNpYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gaXNfbm9kZV92aXNpYmxlKCBub2RlX3JlY29yZCwgdmlzaWJsZV9ieV9ub2RlLCBleHBhbmRlZF9ieV9ub2RlICkge1xuXHRcdGlmICggISBub2RlX3JlY29yZC5wYXJlbnRfbm9kZV9pZCApIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlID09PSB2aXNpYmxlX2J5X25vZGVbIG5vZGVfcmVjb3JkLnBhcmVudF9ub2RlX2lkIF1cblx0XHRcdCYmIHRydWUgPT09IGV4cGFuZGVkX2J5X25vZGVbIG5vZGVfcmVjb3JkLnBhcmVudF9ub2RlX2lkIF07XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgdGhlIGN1cnJlbnQgZGlzY2xvc3VyZSBtYXAgdG8gbm9kZXMsIHN1bW1hcmllcywgYW5kIGJ1dHRvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gYXBwbHlfdmlzaWJpbGl0eSggY29udHJvbGxlciApIHtcblx0XHR2YXIgdmlzaWJsZV9ieV9ub2RlID0gY3JlYXRlX21hcCgpO1xuXG5cdFx0Y29udHJvbGxlci5ub2Rlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIG5vZGVfcmVjb3JkICkge1xuXHRcdFx0dmFyIGlzX2V4cGFuZGVkID0gdHJ1ZSA9PT0gY29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlWyBub2RlX3JlY29yZC5ub2RlX2lkIF07XG5cdFx0XHR2YXIgaXNfdmlzaWJsZSA9IGlzX25vZGVfdmlzaWJsZSggbm9kZV9yZWNvcmQsIHZpc2libGVfYnlfbm9kZSwgY29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlICk7XG5cblx0XHRcdHZpc2libGVfYnlfbm9kZVsgbm9kZV9yZWNvcmQubm9kZV9pZCBdID0gaXNfdmlzaWJsZTtcblx0XHRcdG5vZGVfcmVjb3JkLmVsZW1lbnQuaGlkZGVuID0gISBpc192aXNpYmxlO1xuXHRcdFx0aWYgKCBub2RlX3JlY29yZC5pc19jb250YWluZXIgKSB7XG5cdFx0XHRcdG5vZGVfcmVjb3JkLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWV4cGFuZGVkJywgaXNfZXhwYW5kZWQgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRPYmplY3Qua2V5cyggY29udHJvbGxlci5zdW1tYXJpZXNfYnlfbm9kZSApLmZvckVhY2goIGZ1bmN0aW9uICggbm9kZV9pZCApIHtcblx0XHRcdHZhciBub2RlX2lzX3Zpc2libGUgPSB0cnVlID09PSB2aXNpYmxlX2J5X25vZGVbIG5vZGVfaWQgXTtcblx0XHRcdHZhciBpc19leHBhbmRlZCA9IHRydWUgPT09IGNvbnRyb2xsZXIuZXhwYW5kZWRfYnlfbm9kZVsgbm9kZV9pZCBdO1xuXG5cdFx0XHRjb250cm9sbGVyLnN1bW1hcmllc19ieV9ub2RlWyBub2RlX2lkIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBzdW1tYXJ5X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHN1bW1hcnlfZWxlbWVudC5oaWRkZW4gPSAhIG5vZGVfaXNfdmlzaWJsZSB8fCBpc19leHBhbmRlZDtcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHRPYmplY3Qua2V5cyggY29udHJvbGxlci50b2dnbGVzX2J5X25vZGUgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIG5vZGVfaWQgKSB7XG5cdFx0XHRjb250cm9sbGVyLnRvZ2dsZXNfYnlfbm9kZVsgbm9kZV9pZCBdLmZvckVhY2goIGZ1bmN0aW9uICggdG9nZ2xlICkge1xuXHRcdFx0XHRzeW5jaHJvbml6ZV90b2dnbGUoIHRvZ2dsZSwgdHJ1ZSA9PT0gY29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlWyBub2RlX2lkIF0gKTtcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogU3luY2hyb25pemUgdGhlIGV4cGFuZC1hbGwgYnV0dG9uIHdpdGggYWxsIHJlbmRlcmVkIGNvbnRhaW5lcnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc3luY2hyb25pemVfdG9nZ2xlX2FsbCggY29udHJvbGxlciApIHtcblx0XHR2YXIgdG9nZ2xlX2FsbCA9IGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfYWxsX3NlbGVjdG9yICk7XG5cdFx0dmFyIGFsbF9leHBhbmRlZCA9IDAgPCBjb250cm9sbGVyLmV4cGFuZGFibGVfbm9kZV9pZHMubGVuZ3RoICYmIGNvbnRyb2xsZXIuZXhwYW5kYWJsZV9ub2RlX2lkcy5ldmVyeSggZnVuY3Rpb24gKCBub2RlX2lkICkge1xuXHRcdFx0cmV0dXJuIHRydWUgPT09IGNvbnRyb2xsZXIuZXhwYW5kZWRfYnlfbm9kZVsgbm9kZV9pZCBdO1xuXHRcdH0gKTtcblx0XHR2YXIgbGFiZWw7XG5cdFx0dmFyIGljb247XG5cblx0XHRpZiAoICEgdG9nZ2xlX2FsbCApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dG9nZ2xlX2FsbC5oaWRkZW4gPSAhIGNvbnRyb2xsZXIuZW5hYmxlZCB8fCAwID09PSBjb250cm9sbGVyLmV4cGFuZGFibGVfbm9kZV9pZHMubGVuZ3RoO1xuXHRcdGxhYmVsID0gYWxsX2V4cGFuZGVkID8gY29udHJvbGxlci5pMThuLmNvbGxhcHNlX2FsbCB8fCAnJyA6IGNvbnRyb2xsZXIuaTE4bi5leHBhbmRfYWxsIHx8ICcnO1xuXHRcdHRvZ2dsZV9hbGwuc2V0QXR0cmlidXRlKCAnYXJpYS1wcmVzc2VkJywgYWxsX2V4cGFuZGVkID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdHRvZ2dsZV9hbGwuc2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbCcsIGxhYmVsICk7XG5cdFx0dG9nZ2xlX2FsbC5zZXRBdHRyaWJ1dGUoICd0aXRsZScsIGxhYmVsICk7XG5cdFx0aWNvbiA9IHRvZ2dsZV9hbGwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdWktY2F0YWxvZy1oaWVyYXJjaHktdG9nZ2xlLWFsbC1pY29uXScgKSB8fCB0b2dnbGVfYWxsLnF1ZXJ5U2VsZWN0b3IoICdzcGFuJyApO1xuXHRcdGlmICggaWNvbiApIHtcblx0XHRcdGljb24uY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmMtYmktYXJyb3dzLWNvbGxhcHNlLXZlcnRpY2FsJywgJ3dwYmMtYmktYXJyb3dzLWV4cGFuZC12ZXJ0aWNhbCcgKTtcblx0XHRcdGljb24uY2xhc3NMaXN0LmFkZCggYWxsX2V4cGFuZGVkID8gJ3dwYmMtYmktYXJyb3dzLWNvbGxhcHNlLXZlcnRpY2FsJyA6ICd3cGJjLWJpLWFycm93cy1leHBhbmQtdmVydGljYWwnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIERpc3BhdGNoIG9uZSBkb21haW4tbmV1dHJhbCBoaWVyYXJjaHkgc3RhdGUgZXZlbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyICBIaWVyYXJjaHkgY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG5vZGVfaWQgICAgIENoYW5nZWQgbm9kZSBpZGVudGlmaWVyIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0ICogQHBhcmFtIHtib29sZWFufSBpc19leHBhbmRlZCBDdXJyZW50IGRpc2Nsb3N1cmUgc3RhdGUuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZ2xvYmFsICAgV2hldGhlciBleHBhbmQtYWxsIGluaXRpYXRlZCB0aGUgY2hhbmdlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gZGlzcGF0Y2hfY2hhbmdlKCBjb250cm9sbGVyLCBub2RlX2lkLCBpc19leHBhbmRlZCwgaXNfZ2xvYmFsICkge1xuXHRcdHZhciBoaWVyYXJjaHlfZXZlbnQ7XG5cdFx0dmFyIGV2ZW50X2RldGFpbCA9IHtcblx0XHRcdGFsbF9leHBhbmRlZDogaXNfZ2xvYmFsID8gaXNfZXhwYW5kZWQgOiBudWxsLFxuXHRcdFx0Y2F0YWxvZ19pZDogY29udHJvbGxlci5jYXRhbG9nX2lkLFxuXHRcdFx0ZXhwYW5kZWQ6IGlzX2V4cGFuZGVkLFxuXHRcdFx0Z2xvYmFsOiBpc19nbG9iYWwsXG5cdFx0XHRub2RlX2lkOiBub2RlX2lkXG5cdFx0fTtcblxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdGhpZXJhcmNoeV9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoICd3cGJjOnVpLWNhdGFsb2ctaGllcmFyY2h5LWNoYW5nZScsIHtcblx0XHRcdFx0YnViYmxlczogdHJ1ZSxcblx0XHRcdFx0ZGV0YWlsOiBldmVudF9kZXRhaWxcblx0XHRcdH0gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGllcmFyY2h5X2V2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdDdXN0b21FdmVudCcgKTtcblx0XHRcdGhpZXJhcmNoeV9ldmVudC5pbml0Q3VzdG9tRXZlbnQoICd3cGJjOnVpLWNhdGFsb2ctaGllcmFyY2h5LWNoYW5nZScsIHRydWUsIGZhbHNlLCBldmVudF9kZXRhaWwgKTtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5tb3VudF9lbGVtZW50LmRpc3BhdGNoRXZlbnQoIGhpZXJhcmNoeV9ldmVudCApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBlcnNpc3QgdGhlIGdsb2JhbCBkaXNjbG9zdXJlIEJvb2xlYW4gdGhyb3VnaCB0aGUgb3duaW5nIGNhdGFsb2cgY2FsbGJhY2suXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfcHJlZmVyZW5jZV9zYXZlKCBjb250cm9sbGVyICkge1xuXHRcdGlmICggJ2dsb2JhbCcgIT09IGNvbnRyb2xsZXIucGVyc2lzdGVuY2UgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGNvbnRyb2xsZXIuc2F2ZV9wcmVmZXJlbmNlcyApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBjb250cm9sbGVyLnNhdmVfdGltZXIgKTtcblx0XHRjb250cm9sbGVyLnNhdmVfdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29udHJvbGxlci5zYXZlX3ByZWZlcmVuY2VzKCB7XG5cdFx0XHRcdGFsbF9leHBhbmRlZDogY29udHJvbGxlci5nbG9iYWxfZXhwYW5kZWRcblx0XHRcdH0gKTtcblx0XHR9LCAyNTAgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHBhbmQgb3IgY29sbGFwc2Ugb25lIHJlbmRlcmVkIGNvbnRhaW5lciB3aXRob3V0IHBlcnNpc3RpbmcgcGVyLW5vZGUgc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgY29udHJvbGxlciAgSGllcmFyY2h5IGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgbm9kZV9pZCAgICAgT3BhcXVlIGNvbnRhaW5lciBub2RlIGlkZW50aWZpZXIuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZXhwYW5kZWQgUmVxdWVzdGVkIGRpc2Nsb3N1cmUgc3RhdGUuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9wYXJlbnRfZm9jdXMgV2hldGhlciBhIHN1bW1hcnkgYWN0aXZhdGlvbiBzaG91bGQgZm9jdXMgaXRzIHBhcmVudCB0b2dnbGUuXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgYSBjb250YWluZXIgc3RhdGUgY2hhbmdlZC5cblx0ICovXG5cdGZ1bmN0aW9uIHNldF9ub2RlX2V4cGFuZGVkKCBjb250cm9sbGVyLCBub2RlX2lkLCBpc19leHBhbmRlZCwgcmVzdG9yZV9wYXJlbnRfZm9jdXMgKSB7XG5cdFx0dmFyIG5vZGVfcmVjb3JkID0gY29udHJvbGxlci5ub2Rlc19ieV9pZFsgbm9kZV9pZCBdO1xuXHRcdHZhciBwYXJlbnRfdG9nZ2xlO1xuXG5cdFx0aWYgKCAhIGNvbnRyb2xsZXIuZW5hYmxlZCB8fCAhIG5vZGVfcmVjb3JkIHx8ICEgbm9kZV9yZWNvcmQuaXNfZXhwYW5kYWJsZSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlWyBub2RlX2lkIF0gPSAhISBpc19leHBhbmRlZDtcblx0XHRhcHBseV92aXNpYmlsaXR5KCBjb250cm9sbGVyICk7XG5cdFx0c3luY2hyb25pemVfdG9nZ2xlX2FsbCggY29udHJvbGxlciApO1xuXHRcdGRpc3BhdGNoX2NoYW5nZSggY29udHJvbGxlciwgbm9kZV9pZCwgISEgaXNfZXhwYW5kZWQsIGZhbHNlICk7XG5cblx0XHRpZiAoIHJlc3RvcmVfcGFyZW50X2ZvY3VzICkge1xuXHRcdFx0cGFyZW50X3RvZ2dsZSA9IGdldF9wYXJlbnRfdG9nZ2xlKCBjb250cm9sbGVyLCBub2RlX2lkICk7XG5cdFx0XHRpZiAoIHBhcmVudF90b2dnbGUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBhcmVudF90b2dnbGUuZm9jdXMgKSB7XG5cdFx0XHRcdHBhcmVudF90b2dnbGUuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHBhbmQgb3IgY29sbGFwc2UgZXZlcnkgcmVuZGVyZWQgY29udGFpbmVyIGFuZCBwZXJzaXN0IG9uZSBCb29sZWFuLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGNvbnRyb2xsZXIgIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2V4cGFuZGVkIFJlcXVlc3RlZCBnbG9iYWwgc3RhdGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRfYWxsX2V4cGFuZGVkKCBjb250cm9sbGVyLCBpc19leHBhbmRlZCApIHtcblx0XHRjb250cm9sbGVyLmV4cGFuZGFibGVfbm9kZV9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBub2RlX2lkICkge1xuXHRcdFx0Y29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlWyBub2RlX2lkIF0gPSAhISBpc19leHBhbmRlZDtcblx0XHR9ICk7XG5cdFx0Y29udHJvbGxlci5nbG9iYWxfZXhwYW5kZWQgPSAhISBpc19leHBhbmRlZDtcblx0XHRhcHBseV92aXNpYmlsaXR5KCBjb250cm9sbGVyICk7XG5cdFx0c3luY2hyb25pemVfdG9nZ2xlX2FsbCggY29udHJvbGxlciApO1xuXHRcdGRpc3BhdGNoX2NoYW5nZSggY29udHJvbGxlciwgJycsICEhIGlzX2V4cGFuZGVkLCB0cnVlICk7XG5cdFx0c2NoZWR1bGVfcHJlZmVyZW5jZV9zYXZlKCBjb250cm9sbGVyICk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSBwcmltYXJ5IGNvbnRhaW5lci1yb3cgdG9nZ2xlIGZvciBvbmUgbm9kZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRyb2xsZXIgSGllcmFyY2h5IGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBub2RlX2lkICAgIE9wYXF1ZSBub2RlIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IFBhcmVudCB0b2dnbGUgb3IgbnVsbC5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9wYXJlbnRfdG9nZ2xlKCBjb250cm9sbGVyLCBub2RlX2lkICkge1xuXHRcdHZhciB0b2dnbGVzID0gY29udHJvbGxlci50b2dnbGVzX2J5X25vZGVbIG5vZGVfaWQgXSB8fCBbXTtcblx0XHR2YXIgcGFyZW50X3RvZ2dsZSA9IG51bGw7XG5cblx0XHR0b2dnbGVzLnNvbWUoIGZ1bmN0aW9uICggdG9nZ2xlICkge1xuXHRcdFx0aWYgKCB0b2dnbGUuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaGllcmFyY2h5LXBhcmVudC10b2dnbGUnICkgKSB7XG5cdFx0XHRcdHBhcmVudF90b2dnbGUgPSB0b2dnbGU7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gKTtcblxuXHRcdHJldHVybiBwYXJlbnRfdG9nZ2xlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhcHR1cmUgaGllcmFyY2h5IGZvY3VzIGJlZm9yZSBBSkFYIHJlcGxhY2VzIHRoZSBjdXJyZW50IHJvd3MuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2FwdHVyZV9mb2N1cyggY29udHJvbGxlciApIHtcblx0XHR2YXIgYWN0aXZlX2VsZW1lbnQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdHZhciB0b2dnbGU7XG5cblx0XHRjb250cm9sbGVyLmZvY3VzX3Rva2VuID0gbnVsbDtcblx0XHRpZiAoICEgYWN0aXZlX2VsZW1lbnQgfHwgISBjb250cm9sbGVyLm1vdW50X2VsZW1lbnQuY29udGFpbnMoIGFjdGl2ZV9lbGVtZW50ICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggYWN0aXZlX2VsZW1lbnQuY2xvc2VzdCggdG9nZ2xlX2FsbF9zZWxlY3RvciApICkge1xuXHRcdFx0Y29udHJvbGxlci5mb2N1c190b2tlbiA9IHsgdHlwZTogJ2FsbCcgfTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dG9nZ2xlID0gYWN0aXZlX2VsZW1lbnQuY2xvc2VzdCggdG9nZ2xlX3NlbGVjdG9yICk7XG5cdFx0aWYgKCB0b2dnbGUgKSB7XG5cdFx0XHRjb250cm9sbGVyLmZvY3VzX3Rva2VuID0ge1xuXHRcdFx0XHRub2RlX2lkOiBub3JtYWxpemVfbm9kZV9pZCggdG9nZ2xlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWhpZXJhcmNoeS10b2dnbGUnICkgKSxcblx0XHRcdFx0dHlwZTogJ25vZGUnXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXN0b3JlIGhpZXJhcmNoeSBmb2N1cyBhZnRlciBjdXJyZW50IHJvd3MgaGF2ZSBiZWVuIG1vdW50ZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBjb250cm9sbGVyIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzdG9yZV9mb2N1cyggY29udHJvbGxlciApIHtcblx0XHR2YXIgZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0XHR2YXIgZm9jdXNfdG9rZW4gPSBjb250cm9sbGVyLmZvY3VzX3Rva2VuO1xuXG5cdFx0Y29udHJvbGxlci5mb2N1c190b2tlbiA9IG51bGw7XG5cdFx0aWYgKCAhIGZvY3VzX3Rva2VuICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICdhbGwnID09PSBmb2N1c190b2tlbi50eXBlICkge1xuXHRcdFx0Zm9jdXNfdGFyZ2V0ID0gY29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoIHRvZ2dsZV9hbGxfc2VsZWN0b3IgKTtcblx0XHR9IGVsc2UgaWYgKCAnbm9kZScgPT09IGZvY3VzX3Rva2VuLnR5cGUgKSB7XG5cdFx0XHRmb2N1c190YXJnZXQgPSBnZXRfcGFyZW50X3RvZ2dsZSggY29udHJvbGxlciwgZm9jdXNfdG9rZW4ubm9kZV9pZCApO1xuXHRcdH1cblx0XHRpZiAoIGZvY3VzX3RhcmdldCAmJiAhIGZvY3VzX3RhcmdldC5oaWRkZW4gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZvY3VzX3RhcmdldC5mb2N1cyApIHtcblx0XHRcdGZvY3VzX3RhcmdldC5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBIYW5kbGUgZGVsZWdhdGVkIGhpZXJhcmNoeSBjbGlja3MuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgY29udHJvbGxlciBIaWVyYXJjaHkgY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCAgICAgIENhdGFsb2cgY2xpY2sgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGNvbnRyb2xsZXIsIGV2ZW50ICkge1xuXHRcdHZhciB0b2dnbGVfYWxsID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHRvZ2dsZV9hbGxfc2VsZWN0b3IgKTtcblx0XHR2YXIgdG9nZ2xlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHRvZ2dsZV9zZWxlY3RvciApO1xuXHRcdHZhciBub2RlX2lkO1xuXG5cdFx0aWYgKCB0b2dnbGVfYWxsICYmIGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5jb250YWlucyggdG9nZ2xlX2FsbCApICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHNldF9hbGxfZXhwYW5kZWQoIGNvbnRyb2xsZXIsICd0cnVlJyAhPT0gdG9nZ2xlX2FsbC5nZXRBdHRyaWJ1dGUoICdhcmlhLXByZXNzZWQnICkgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCAhIHRvZ2dsZSB8fCAhIGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5jb250YWlucyggdG9nZ2xlICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRub2RlX2lkID0gbm9ybWFsaXplX25vZGVfaWQoIHRvZ2dsZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1oaWVyYXJjaHktdG9nZ2xlJyApICk7XG5cdFx0c2V0X25vZGVfZXhwYW5kZWQoXG5cdFx0XHRjb250cm9sbGVyLFxuXHRcdFx0bm9kZV9pZCxcblx0XHRcdCd0cnVlJyAhPT0gdG9nZ2xlLmdldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnICksXG5cdFx0XHR0b2dnbGUuaGFzQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctaGllcmFyY2h5LXN1bW1hcnktdG9nZ2xlJyApXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdXBwb3J0IGNvbnZlbnRpb25hbCBMZWZ0L1JpZ2h0IGRpc2Nsb3N1cmUga2V5Ym9hcmQgYmVoYXZpb3IuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgY29udHJvbGxlciBIaWVyYXJjaHkgY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCAgICAgIENhdGFsb2cga2V5Ym9hcmQgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggY29udHJvbGxlciwgZXZlbnQgKSB7XG5cdFx0dmFyIHRvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCB0b2dnbGVfc2VsZWN0b3IgKTtcblx0XHR2YXIgbm9kZV9pZDtcblxuXHRcdGlmICggISB0b2dnbGUgfHwgISBjb250cm9sbGVyLm1vdW50X2VsZW1lbnQuY29udGFpbnMoIHRvZ2dsZSApIHx8ICggJ0Fycm93TGVmdCcgIT09IGV2ZW50LmtleSAmJiAnQXJyb3dSaWdodCcgIT09IGV2ZW50LmtleSApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdG5vZGVfaWQgPSBub3JtYWxpemVfbm9kZV9pZCggdG9nZ2xlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWhpZXJhcmNoeS10b2dnbGUnICkgKTtcblx0XHRzZXRfbm9kZV9leHBhbmRlZCggY29udHJvbGxlciwgbm9kZV9pZCwgJ0Fycm93UmlnaHQnID09PSBldmVudC5rZXksIGZhbHNlICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVmcmVzaCBvbmUgaGllcmFyY2h5IGNvbnRyb2xsZXIgZnJvbSBuZXdseSByZW5kZXJlZCByZXNwb25zZSByb3dzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciAgICAgICAgIEhpZXJhcmNoeSBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gaGllcmFyY2h5X3Jlc3BvbnNlIE5vcm1hbGl6ZWQgcmVzcG9uc2UgaGllcmFyY2h5IHNlY3Rpb24uXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFdoZXRoZXIgaGllcmFyY2h5IGJlaGF2aW9yIGlzIGFjdGl2ZS5cblx0ICovXG5cdGZ1bmN0aW9uIHJlZnJlc2hfY29udHJvbGxlciggY29udHJvbGxlciwgaGllcmFyY2h5X3Jlc3BvbnNlICkge1xuXHRcdGNvbnRyb2xsZXIuZW5hYmxlZCA9ICEhICggaGllcmFyY2h5X3Jlc3BvbnNlICYmIGhpZXJhcmNoeV9yZXNwb25zZS5lbmFibGVkICk7XG5cdFx0Y29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlID0gY3JlYXRlX21hcCgpO1xuXHRcdGNvbnRyb2xsZXIuZ2xvYmFsX2V4cGFuZGVkID0gZ2V0X2luaXRpYWxfZXhwYW5kZWQoIGhpZXJhcmNoeV9yZXNwb25zZSB8fCB7fSApO1xuXHRcdGlmICggISBjb250cm9sbGVyLmVuYWJsZWQgKSB7XG5cdFx0XHRyZXNldF9zdHJ1Y3R1cmUoIGNvbnRyb2xsZXIgKTtcblx0XHRcdHN5bmNocm9uaXplX3RvZ2dsZV9hbGwoIGNvbnRyb2xsZXIgKTtcblx0XHRcdGNvbnRyb2xsZXIuZm9jdXNfdG9rZW4gPSBudWxsO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb2xsZWN0X3N0cnVjdHVyZSggY29udHJvbGxlciApO1xuXHRcdGNvbnRyb2xsZXIubm9kZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBub2RlX3JlY29yZCApIHtcblx0XHRcdGlmICggbm9kZV9yZWNvcmQuaXNfY29udGFpbmVyICYmICEgbm9kZV9yZWNvcmQuaXNfZXhwYW5kYWJsZSApIHtcblx0XHRcdFx0Y29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlWyBub2RlX3JlY29yZC5ub2RlX2lkIF0gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0XHRjb250cm9sbGVyLmV4cGFuZGFibGVfbm9kZV9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBub2RlX2lkICkge1xuXHRcdFx0Y29udHJvbGxlci5leHBhbmRlZF9ieV9ub2RlWyBub2RlX2lkIF0gPSBjb250cm9sbGVyLmdsb2JhbF9leHBhbmRlZDtcblx0XHR9ICk7XG5cdFx0YXBwbHlfdmlzaWJpbGl0eSggY29udHJvbGxlciApO1xuXHRcdHN5bmNocm9uaXplX3RvZ2dsZV9hbGwoIGNvbnRyb2xsZXIgKTtcblx0XHRyZXN0b3JlX2ZvY3VzKCBjb250cm9sbGVyICk7XG5cblx0XHRyZXR1cm4gY29udHJvbGxlci5lbmFibGVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEluaXRpYWxpemUgaGllcmFyY2h5IG1lY2hhbmljcyBmb3Igb25lIG1vdW50ZWQgY2F0YWxvZy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCAgICBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259ICAgIHNhdmVfcHJlZmVyZW5jZXMgQ2FsbGJhY2sgYWNjZXB0aW5nIG5vcm1hbGl6ZWQgZ2xvYmFsIHN0YXRlLlxuXHQgKiBAcmV0dXJuIHtPYmplY3R8ZmFsc2V9IEhpZXJhcmNoeSBjb250cm9sbGVyIEFQSSBvciBmYWxzZSB3aGVuIHVuYXZhaWxhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9oaWVyYXJjaHkoIG1vdW50X2VsZW1lbnQsIGNvbmZpZywgc2F2ZV9wcmVmZXJlbmNlcyApIHtcblx0XHR2YXIgaGllcmFyY2h5X2NvbmZpZ3VyYXRpb247XG5cdFx0dmFyIGNvbnRyb2xsZXI7XG5cblx0XHRpZiAoICEgbW91bnRfZWxlbWVudCB8fCBtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5X2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRyZXR1cm4gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19oaWVyYXJjaHlfY29udHJvbGxlciA6IGZhbHNlO1xuXHRcdH1cblx0XHRoaWVyYXJjaHlfY29uZmlndXJhdGlvbiA9IGNvbmZpZyAmJiBjb25maWcuaGllcmFyY2h5ID8gY29uZmlnLmhpZXJhcmNoeSA6IHt9O1xuXHRcdGNvbnRyb2xsZXIgPSB7XG5cdFx0XHRjYXRhbG9nX2lkOiBjb25maWcgJiYgY29uZmlnLmlkID8gU3RyaW5nKCBjb25maWcuaWQgKSA6ICcnLFxuXHRcdFx0ZXhwYW5kYWJsZV9ub2RlX2lkczogW10sXG5cdFx0XHRlbmFibGVkOiBmYWxzZSxcblx0XHRcdGV4cGFuZGVkX2J5X25vZGU6IGNyZWF0ZV9tYXAoKSxcblx0XHRcdGZvY3VzX3Rva2VuOiBudWxsLFxuXHRcdFx0Z2xvYmFsX2V4cGFuZGVkOiBmYWxzZSxcblx0XHRcdGkxOG46IGNvbmZpZyAmJiBjb25maWcuaTE4biA/IGNvbmZpZy5pMThuIDoge30sXG5cdFx0XHRtb3VudF9lbGVtZW50OiBtb3VudF9lbGVtZW50LFxuXHRcdFx0bm9kZXM6IFtdLFxuXHRcdFx0bm9kZXNfYnlfaWQ6IGNyZWF0ZV9tYXAoKSxcblx0XHRcdHBlcnNpc3RlbmNlOiBoaWVyYXJjaHlfY29uZmlndXJhdGlvbi5wZXJzaXN0ZW5jZSB8fCAnbm9uZScsXG5cdFx0XHRzYXZlX3ByZWZlcmVuY2VzOiBzYXZlX3ByZWZlcmVuY2VzLFxuXHRcdFx0c2F2ZV90aW1lcjogMCxcblx0XHRcdHN1bW1hcmllc19ieV9ub2RlOiBjcmVhdGVfbWFwKCksXG5cdFx0XHR0b2dnbGVzX2J5X25vZGU6IGNyZWF0ZV9tYXAoKVxuXHRcdH07XG5cblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRoYW5kbGVfY2xpY2soIGNvbnRyb2xsZXIsIGV2ZW50ICk7XG5cdFx0fSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aGFuZGxlX2tleWRvd24oIGNvbnRyb2xsZXIsIGV2ZW50ICk7XG5cdFx0fSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dWktY2F0YWxvZy1iZWZvcmUtcmVuZGVyJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2FwdHVyZV9mb2N1cyggY29udHJvbGxlciApO1xuXHRcdH0gKTtcblxuXHRcdGNvbnRyb2xsZXIuYXBpID0ge1xuXHRcdFx0Z2V0X2FsbF9leHBhbmRlZDogZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udHJvbGxlci5nbG9iYWxfZXhwYW5kZWQ7XG5cdFx0XHR9LFxuXHRcdFx0cmVmcmVzaDogZnVuY3Rpb24gKCBoaWVyYXJjaHlfcmVzcG9uc2UgKSB7XG5cdFx0XHRcdHJldHVybiByZWZyZXNoX2NvbnRyb2xsZXIoIGNvbnRyb2xsZXIsIGhpZXJhcmNoeV9yZXNwb25zZSB8fCB7fSApO1xuXHRcdFx0fSxcblx0XHRcdHNldF9hbGxfZXhwYW5kZWQ6IGZ1bmN0aW9uICggaXNfZXhwYW5kZWQgKSB7XG5cdFx0XHRcdHNldF9hbGxfZXhwYW5kZWQoIGNvbnRyb2xsZXIsICEhIGlzX2V4cGFuZGVkICk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0X25vZGVfZXhwYW5kZWQ6IGZ1bmN0aW9uICggbm9kZV9pZCwgaXNfZXhwYW5kZWQgKSB7XG5cdFx0XHRcdHJldHVybiBzZXRfbm9kZV9leHBhbmRlZCggY29udHJvbGxlciwgbm9ybWFsaXplX25vZGVfaWQoIG5vZGVfaWQgKSwgISEgaXNfZXhwYW5kZWQsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRtb3VudF9lbGVtZW50Ll93cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5X2NvbnRyb2xsZXIgPSBjb250cm9sbGVyLmFwaTtcblxuXHRcdHJldHVybiBjb250cm9sbGVyLmFwaTtcblx0fVxuXG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5ID0gd2luZG93LndwYmNfdWlfY2F0YWxvZ19oaWVyYXJjaHkgfHwge307XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5LmdldF9pbml0aWFsX2V4cGFuZGVkID0gZ2V0X2luaXRpYWxfZXhwYW5kZWQ7XG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfaGllcmFyY2h5LmluaXRpYWxpemUgPSBpbml0aWFsaXplX2hpZXJhcmNoeTtcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRUMsUUFBUSxFQUFHO0VBQy9CLFlBQVk7O0VBRVosSUFBSUMsYUFBYSxHQUFHLGdDQUFnQztFQUNwRCxJQUFJQyxlQUFlLEdBQUcseUNBQXlDO0VBQy9ELElBQUlDLG1CQUFtQixHQUFHLDZDQUE2Qzs7RUFFdkU7QUFDRDtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLFVBQVVBLENBQUEsRUFBRztJQUNyQixPQUFPQyxNQUFNLENBQUNDLE1BQU0sQ0FBRSxJQUFLLENBQUM7RUFDN0I7O0VBRUE7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsZUFBZUEsQ0FBRUMsVUFBVSxFQUFHO0lBQ3RDQSxVQUFVLENBQUNDLEtBQUssR0FBRyxFQUFFO0lBQ3JCRCxVQUFVLENBQUNFLFdBQVcsR0FBR04sVUFBVSxDQUFDLENBQUM7SUFDckNJLFVBQVUsQ0FBQ0csaUJBQWlCLEdBQUdQLFVBQVUsQ0FBQyxDQUFDO0lBQzNDSSxVQUFVLENBQUNJLGVBQWUsR0FBR1IsVUFBVSxDQUFDLENBQUM7SUFDekNJLFVBQVUsQ0FBQ0ssbUJBQW1CLEdBQUcsRUFBRTtFQUNwQzs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxpQkFBaUJBLENBQUVDLE9BQU8sRUFBRztJQUNyQyxPQUFPLElBQUksS0FBS0EsT0FBTyxJQUFJLFdBQVcsS0FBSyxPQUFPQSxPQUFPLEdBQUcsRUFBRSxHQUFHQyxNQUFNLENBQUVELE9BQVEsQ0FBQyxDQUFDRSxJQUFJLENBQUMsQ0FBQztFQUMxRjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFT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
