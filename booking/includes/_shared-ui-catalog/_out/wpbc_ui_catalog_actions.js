"use strict";

/**
 * Provide accessible row-action menu mechanics for independent WPBC catalogs.
 *
 * Menus expose action intent only. Domain scripts remain responsible for
 * interpreting an action and no mutation is performed by this controller.
 *
 * @since 11.6.0
 */
(function (window, document) {
  'use strict';

  var root_selector = '[data-wpbc-ui-catalog-action-menu]';
  var toggle_selector = '[data-wpbc-ui-catalog-action-toggle]';
  var menu_selector = '[data-wpbc-ui-catalog-action-menu-list]';
  var menu_item_selector = '[role="menuitem"]';
  var menu_item_action_attribute = 'data-wpbc-ui-catalog-action-id';

  /**
   * Return enabled menu items from one row-action menu.
   *
   * @param {HTMLElement} menu Action menu element.
   * @return {HTMLElement[]} Enabled menu items.
   */
  function get_menu_items(menu) {
    return Array.prototype.filter.call(menu.querySelectorAll(menu_item_selector), function (menu_item) {
      return !menu_item.hasAttribute('disabled') && 'true' !== menu_item.getAttribute('aria-disabled');
    });
  }

  /**
   * Close one action menu and optionally restore focus to its toggle.
   *
   * @param {HTMLElement} root          Action menu wrapper.
   * @param {boolean}     restore_focus Whether the toggle should regain focus.
   * @return {void}
   */
  function close_menu(root, restore_focus) {
    var menu = root ? root.querySelector(menu_selector) : null;
    var toggle = root ? root.querySelector(toggle_selector) : null;
    if (!root || !menu || !toggle || menu.hidden) {
      return;
    }
    menu.hidden = true;
    menu.style.removeProperty('left');
    menu.style.removeProperty('top');
    menu.removeAttribute('data-wpbc-ui-catalog-action-placement');
    toggle.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-open');
    if (restore_focus && 'function' === typeof toggle.focus) {
      toggle.focus();
    }
  }

  /**
   * Close all open action menus in one mounted catalog.
   *
   * @param {Object}          controller    Action controller state.
   * @param {HTMLElement|null} excluded_root Optional menu to leave open.
   * @param {boolean}         restore_focus Whether a closed toggle regains focus.
   * @return {void}
   */
  function close_all_menus(controller, excluded_root, restore_focus) {
    controller.mount_element.querySelectorAll(root_selector + '.is-open').forEach(function (root) {
      if (root !== excluded_root) {
        close_menu(root, restore_focus);
      }
    });
  }

  /**
   * Position one fixed menu toward the available catalog space.
   *
   * A reordered Actions column can sit on either physical side of a catalog.
   * Comparing the trigger and catalog centers avoids domain-specific column
   * assumptions, while the alternate placement and viewport clamp protect
   * narrow, horizontally scrolled, and RTL presentations.
   *
   * @param {HTMLElement} toggle Menu toggle.
   * @param {HTMLElement} menu   Menu element.
   * @return {void}
   */
  function position_menu(toggle, menu) {
    var viewport_margin = 8;
    var toggle_rect = toggle.getBoundingClientRect();
    var menu_rect = menu.getBoundingClientRect();
    var viewport_width = document.documentElement.clientWidth || window.innerWidth || 0;
    var viewport_height = window.innerHeight || document.documentElement.clientHeight || 0;
    var positioning_root = toggle.closest('.wpbc_ui_listing__table_wrap, .wpbc_ui_catalog');
    var positioning_rect = positioning_root ? positioning_root.getBoundingClientRect() : null;
    var available_left = positioning_rect ? Math.max(0, positioning_rect.left) : 0;
    var available_right = positioning_rect ? Math.min(viewport_width, positioning_rect.right) : viewport_width;
    var trigger_center = toggle_rect.left + toggle_rect.width / 2;
    var root_center = available_left + (available_right - available_left) / 2;
    var opens_right = trigger_center <= root_center;
    var preferred_left = opens_right ? toggle_rect.left : toggle_rect.right - menu_rect.width;
    var alternate_left = opens_right ? toggle_rect.right - menu_rect.width : toggle_rect.left;
    var left = preferred_left;
    var top = toggle_rect.bottom + 6;
    if (left < viewport_margin || left + menu_rect.width > viewport_width - viewport_margin) {
      if (alternate_left >= viewport_margin && alternate_left + menu_rect.width <= viewport_width - viewport_margin) {
        left = alternate_left;
        opens_right = !opens_right;
      }
    }
    left = Math.min(Math.max(viewport_margin, left), Math.max(viewport_margin, viewport_width - menu_rect.width - viewport_margin));
    if (top + menu_rect.height > viewport_height - viewport_margin) {
      top = Math.max(viewport_margin, toggle_rect.top - menu_rect.height - 6);
    }
    menu.setAttribute('data-wpbc-ui-catalog-action-placement', opens_right ? 'right' : 'left');
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
  }

  /**
   * Open one menu and optionally move focus to an edge menu item.
   *
   * @param {Object}      controller      Action controller state.
   * @param {HTMLElement} root            Action menu wrapper.
   * @param {string}      focus_direction first, last, or an empty string.
   * @return {void}
   */
  function open_menu(controller, root, focus_direction) {
    var menu = root ? root.querySelector(menu_selector) : null;
    var toggle = root ? root.querySelector(toggle_selector) : null;
    var menu_items;
    if (!root || !menu || !toggle) {
      return;
    }
    close_all_menus(controller, root, false);
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    root.classList.add('is-open');
    position_menu(toggle, menu);
    if (focus_direction) {
      menu_items = get_menu_items(menu);
      if (menu_items.length) {
        menu_items['last' === focus_direction ? menu_items.length - 1 : 0].focus();
      }
    }
  }

  /**
   * Open one item's action menu and focus an authorized action.
   *
   * This public interaction remains domain-neutral: callers identify a
   * rendered item and action while the shared controller owns menu state,
   * placement, and focus behavior.
   *
   * @param {Object} controller Action controller state.
   * @param {string} item_id    Rendered catalog item identifier.
   * @param {string} action_id  Rendered action identifier to focus.
   * @return {boolean} True when the menu opened and the action received focus.
   */
  function open_item_menu(controller, item_id, action_id) {
    var action_item = null;
    var menu;
    var menu_items;
    var root = null;
    if (!controller || !item_id || !action_id) {
      return false;
    }
    controller.mount_element.querySelectorAll(root_selector).forEach(function (candidate_root) {
      if (!root && item_id === String(candidate_root.getAttribute('data-wpbc-ui-catalog-action-item') || '')) {
        root = candidate_root;
      }
    });
    menu = root ? root.querySelector(menu_selector) : null;
    menu_items = menu ? get_menu_items(menu) : [];
    menu_items.forEach(function (menu_item) {
      if (!action_item && action_id === String(menu_item.getAttribute(menu_item_action_attribute) || '')) {
        action_item = menu_item;
      }
    });
    if (!root || !action_item) {
      return false;
    }
    open_menu(controller, root, '');
    action_item.focus();
    return document.activeElement === action_item;
  }

  /**
   * Move focus through one action menu with wrapping.
   *
   * @param {HTMLElement} menu         Action menu element.
   * @param {HTMLElement} current_item Currently focused menu item.
   * @param {number}      direction    Positive for next or negative for previous.
   * @return {void}
   */
  function move_menu_focus(menu, current_item, direction) {
    var menu_items = get_menu_items(menu);
    var current_index = menu_items.indexOf(current_item);
    var next_index;
    if (!menu_items.length) {
      return;
    }
    next_index = (current_index + direction + menu_items.length) % menu_items.length;
    menu_items[next_index].focus();
  }

  /**
   * Capture the focused row action before response markup is replaced.
   *
   * @param {Object} controller Action controller state.
   * @return {void}
   */
  function capture_action_focus(controller) {
    var active_element = document.activeElement;
    var root;
    controller.focus_item_id = '';
    if (!active_element || !controller.mount_element.contains(active_element)) {
      return;
    }
    root = active_element.closest(root_selector);
    if (root) {
      controller.focus_item_id = root.getAttribute('data-wpbc-ui-catalog-action-item') || '';
    }
  }

  /**
   * Restore focus to the same row's action toggle after an AJAX rebuild.
   *
   * @param {Object} controller Action controller state.
   * @return {void}
   */
  function restore_action_focus(controller) {
    var focus_target = null;
    var focus_item_id = controller.focus_item_id;
    controller.focus_item_id = '';
    if (!focus_item_id) {
      return;
    }
    controller.mount_element.querySelectorAll(root_selector).forEach(function (root) {
      if (!focus_target && focus_item_id === root.getAttribute('data-wpbc-ui-catalog-action-item')) {
        focus_target = root.querySelector(toggle_selector);
      }
    });
    if (!focus_target) {
      focus_target = controller.mount_element.querySelector('[data-wpbc-catalog-heading]');
    }
    if (focus_target && 'function' === typeof focus_target.focus) {
      focus_target.focus();
    }
  }

  /**
   * Handle delegated pointer activation for action menus.
   *
   * @param {Object}     controller Action controller state.
   * @param {MouseEvent} event      Catalog click event.
   * @return {void}
   */
  function handle_click(controller, event) {
    var menu_item = event.target.closest(menu_item_selector);
    var root;
    var toggle = event.target.closest(toggle_selector);
    if (toggle) {
      event.preventDefault();
      root = toggle.closest(root_selector);
      if (root.classList.contains('is-open')) {
        close_menu(root, false);
      } else {
        open_menu(controller, root, 0 === event.detail ? 'first' : '');
      }
      return;
    }
    if (menu_item) {
      root = menu_item.closest(root_selector);
      close_menu(root, false);
      window.setTimeout(function () {
        var toggle_after_action = root.querySelector(toggle_selector);
        if (root.contains(document.activeElement) && toggle_after_action && 'function' === typeof toggle_after_action.focus) {
          toggle_after_action.focus();
        }
      }, 0);
    }
  }

  /**
   * Handle action-menu keyboard navigation.
   *
   * @param {Object}        controller Action controller state.
   * @param {KeyboardEvent} event      Catalog keyboard event.
   * @return {void}
   */
  function handle_keydown(controller, event) {
    var menu;
    var menu_item = event.target.closest(menu_item_selector);
    var menu_items;
    var root;
    var toggle = event.target.closest(toggle_selector);
    if (toggle) {
      root = toggle.closest(root_selector);
      if ('ArrowDown' === event.key || 'ArrowUp' === event.key) {
        event.preventDefault();
        open_menu(controller, root, 'ArrowUp' === event.key ? 'last' : 'first');
      } else if ('Escape' === event.key) {
        event.preventDefault();
        close_menu(root, false);
      }
      return;
    }
    if (!menu_item) {
      return;
    }
    root = menu_item.closest(root_selector);
    menu = menu_item.closest(menu_selector);
    if ('Escape' === event.key) {
      event.preventDefault();
      close_menu(root, true);
    } else if ('ArrowDown' === event.key || 'ArrowUp' === event.key) {
      event.preventDefault();
      move_menu_focus(menu, menu_item, 'ArrowDown' === event.key ? 1 : -1);
    } else if ('Home' === event.key || 'End' === event.key) {
      event.preventDefault();
      menu_items = get_menu_items(menu);
      if (menu_items.length) {
        menu_items['End' === event.key ? menu_items.length - 1 : 0].focus();
      }
    }
  }

  /**
   * Initialize accessible action menus for one mounted catalog.
   *
   * @param {HTMLElement} mount_element Catalog mount element.
   * @param {Object}      config        Registered browser configuration.
   * @return {Object|false} Action controller API or false when unavailable.
   */
  function initialize_actions(mount_element, config) {
    var controller;
    if (!mount_element || mount_element._wpbc_ui_catalog_actions_controller) {
      return mount_element ? mount_element._wpbc_ui_catalog_actions_controller : false;
    }
    controller = {
      catalog_id: config && config.id ? String(config.id) : '',
      focus_item_id: '',
      mount_element: mount_element
    };
    mount_element.addEventListener('click', function (event) {
      handle_click(controller, event);
    });
    mount_element.addEventListener('keydown', function (event) {
      handle_keydown(controller, event);
    });
    mount_element.addEventListener('focusout', function (event) {
      var root = event.target.closest(root_selector);
      if (root) {
        window.setTimeout(function () {
          if (!root.contains(document.activeElement)) {
            close_menu(root, false);
          }
        }, 0);
      }
    });
    mount_element.addEventListener('wpbc:ui-catalog-before-render', function () {
      capture_action_focus(controller);
      close_all_menus(controller, null, false);
    });
    mount_element.addEventListener('wpbc:ui-catalog-rendered', function () {
      restore_action_focus(controller);
    });
    document.addEventListener('click', function (event) {
      var clicked_root = event.target.closest(root_selector);
      if (!clicked_root || !controller.mount_element.contains(clicked_root)) {
        close_all_menus(controller, null, false);
      }
    });
    window.addEventListener('resize', function () {
      close_all_menus(controller, null, false);
    });
    window.addEventListener('scroll', function () {
      close_all_menus(controller, null, false);
    }, true);
    controller.api = {
      close_all: function (restore_focus) {
        close_all_menus(controller, null, !!restore_focus);
      },
      open_item: function (item_id, action_id) {
        return open_item_menu(controller, String(item_id || ''), String(action_id || ''));
      }
    };
    mount_element._wpbc_ui_catalog_actions_controller = controller.api;
    return controller.api;
  }
  window.wpbc_ui_catalog_actions = window.wpbc_ui_catalog_actions || {};
  window.wpbc_ui_catalog_actions.initialize = initialize_actions;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19vdXQvd3BiY191aV9jYXRhbG9nX2FjdGlvbnMuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsInJvb3Rfc2VsZWN0b3IiLCJ0b2dnbGVfc2VsZWN0b3IiLCJtZW51X3NlbGVjdG9yIiwibWVudV9pdGVtX3NlbGVjdG9yIiwibWVudV9pdGVtX2FjdGlvbl9hdHRyaWJ1dGUiLCJnZXRfbWVudV9pdGVtcyIsIm1lbnUiLCJBcnJheSIsInByb3RvdHlwZSIsImZpbHRlciIsImNhbGwiLCJxdWVyeVNlbGVjdG9yQWxsIiwibWVudV9pdGVtIiwiaGFzQXR0cmlidXRlIiwiZ2V0QXR0cmlidXRlIiwiY2xvc2VfbWVudSIsInJvb3QiLCJyZXN0b3JlX2ZvY3VzIiwicXVlcnlTZWxlY3RvciIsInRvZ2dsZSIsImhpZGRlbiIsInN0eWxlIiwicmVtb3ZlUHJvcGVydHkiLCJyZW1vdmVBdHRyaWJ1dGUiLCJzZXRBdHRyaWJ1dGUiLCJjbGFzc0xpc3QiLCJyZW1vdmUiLCJmb2N1cyIsImNsb3NlX2FsbF9tZW51cyIsImNvbnRyb2xsZXIiLCJleGNsdWRlZF9yb290IiwibW91bnRfZWxlbWVudCIsImZvckVhY2giLCJwb3NpdGlvbl9tZW51Iiwidmlld3BvcnRfbWFyZ2luIiwidG9nZ2xlX3JlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJtZW51X3JlY3QiLCJ2aWV3cG9ydF93aWR0aCIsImRvY3VtZW50RWxlbWVudCIsImNsaWVudFdpZHRoIiwiaW5uZXJXaWR0aCIsInZpZXdwb3J0X2hlaWdodCIsImlubmVySGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwicG9zaXRpb25pbmdfcm9vdCIsImNsb3Nlc3QiLCJwb3NpdGlvbmluZ19yZWN0IiwiYXZhaWxhYmxlX2xlZnQiLCJNYXRoIiwibWF4IiwibGVmdCIsImF2YWlsYWJsZV9yaWdodCIsIm1pbiIsInJpZ2h0IiwidHJpZ2dlcl9jZW50ZXIiLCJ3aWR0aCIsInJvb3RfY2VudGVyIiwib3BlbnNfcmlnaHQiLCJwcmVmZXJyZWRfbGVmdCIsImFsdGVybmF0ZV9sZWZ0IiwidG9wIiwiYm90dG9tIiwiaGVpZ2h0Iiwicm91bmQiLCJvcGVuX21lbnUiLCJmb2N1c19kaXJlY3Rpb24iLCJtZW51X2l0ZW1zIiwiYWRkIiwibGVuZ3RoIiwib3Blbl9pdGVtX21lbnUiLCJpdGVtX2lkIiwiYWN0aW9uX2lkIiwiYWN0aW9uX2l0ZW0iLCJjYW5kaWRhdGVfcm9vdCIsIlN0cmluZyIsImFjdGl2ZUVsZW1lbnQiLCJtb3ZlX21lbnVfZm9jdXMiLCJjdXJyZW50X2l0ZW0iLCJkaXJlY3Rpb24iLCJjdXJyZW50X2luZGV4IiwiaW5kZXhPZiIsIm5leHRfaW5kZXgiLCJjYXB0dXJlX2FjdGlvbl9mb2N1cyIsImFjdGl2ZV9lbGVtZW50IiwiZm9jdXNfaXRlbV9pZCIsImNvbnRhaW5zIiwicmVzdG9yZV9hY3Rpb25fZm9jdXMiLCJmb2N1c190YXJnZXQiLCJoYW5kbGVfY2xpY2siLCJldmVudCIsInRhcmdldCIsInByZXZlbnREZWZhdWx0IiwiZGV0YWlsIiwic2V0VGltZW91dCIsInRvZ2dsZV9hZnRlcl9hY3Rpb24iLCJoYW5kbGVfa2V5ZG93biIsImtleSIsImluaXRpYWxpemVfYWN0aW9ucyIsImNvbmZpZyIsIl93cGJjX3VpX2NhdGFsb2dfYWN0aW9uc19jb250cm9sbGVyIiwiY2F0YWxvZ19pZCIsImlkIiwiYWRkRXZlbnRMaXN0ZW5lciIsImNsaWNrZWRfcm9vdCIsImFwaSIsImNsb3NlX2FsbCIsIm9wZW5faXRlbSIsIndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zIiwiaW5pdGlhbGl6ZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19zaGFyZWQtdWktY2F0YWxvZy9fc3JjL3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHJvdmlkZSBhY2Nlc3NpYmxlIHJvdy1hY3Rpb24gbWVudSBtZWNoYW5pY3MgZm9yIGluZGVwZW5kZW50IFdQQkMgY2F0YWxvZ3MuXG4gKlxuICogTWVudXMgZXhwb3NlIGFjdGlvbiBpbnRlbnQgb25seS4gRG9tYWluIHNjcmlwdHMgcmVtYWluIHJlc3BvbnNpYmxlIGZvclxuICogaW50ZXJwcmV0aW5nIGFuIGFjdGlvbiBhbmQgbm8gbXV0YXRpb24gaXMgcGVyZm9ybWVkIGJ5IHRoaXMgY29udHJvbGxlci5cbiAqXG4gKiBAc2luY2UgMTEuNi4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIHJvb3Rfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWFjdGlvbi1tZW51XSc7XG5cdHZhciB0b2dnbGVfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWFjdGlvbi10b2dnbGVdJztcblx0dmFyIG1lbnVfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWFjdGlvbi1tZW51LWxpc3RdJztcblx0dmFyIG1lbnVfaXRlbV9zZWxlY3RvciA9ICdbcm9sZT1cIm1lbnVpdGVtXCJdJztcblx0dmFyIG1lbnVfaXRlbV9hY3Rpb25fYXR0cmlidXRlID0gJ2RhdGEtd3BiYy11aS1jYXRhbG9nLWFjdGlvbi1pZCc7XG5cblx0LyoqXG5cdCAqIFJldHVybiBlbmFibGVkIG1lbnUgaXRlbXMgZnJvbSBvbmUgcm93LWFjdGlvbiBtZW51LlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBtZW51IEFjdGlvbiBtZW51IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50W119IEVuYWJsZWQgbWVudSBpdGVtcy5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9tZW51X2l0ZW1zKCBtZW51ICkge1xuXHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoIG1lbnUucXVlcnlTZWxlY3RvckFsbCggbWVudV9pdGVtX3NlbGVjdG9yICksIGZ1bmN0aW9uICggbWVudV9pdGVtICkge1xuXHRcdFx0cmV0dXJuICEgbWVudV9pdGVtLmhhc0F0dHJpYnV0ZSggJ2Rpc2FibGVkJyApICYmICd0cnVlJyAhPT0gbWVudV9pdGVtLmdldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIG9uZSBhY3Rpb24gbWVudSBhbmQgb3B0aW9uYWxseSByZXN0b3JlIGZvY3VzIHRvIGl0cyB0b2dnbGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgICAgICAgICAgQWN0aW9uIG1lbnUgd3JhcHBlci5cblx0ICogQHBhcmFtIHtib29sZWFufSAgICAgcmVzdG9yZV9mb2N1cyBXaGV0aGVyIHRoZSB0b2dnbGUgc2hvdWxkIHJlZ2FpbiBmb2N1cy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsb3NlX21lbnUoIHJvb3QsIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0dmFyIG1lbnUgPSByb290ID8gcm9vdC5xdWVyeVNlbGVjdG9yKCBtZW51X3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdHZhciB0b2dnbGUgPSByb290ID8gcm9vdC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfc2VsZWN0b3IgKSA6IG51bGw7XG5cblx0XHRpZiAoICEgcm9vdCB8fCAhIG1lbnUgfHwgISB0b2dnbGUgfHwgbWVudS5oaWRkZW4gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdG1lbnUuaGlkZGVuID0gdHJ1ZTtcblx0XHRtZW51LnN0eWxlLnJlbW92ZVByb3BlcnR5KCAnbGVmdCcgKTtcblx0XHRtZW51LnN0eWxlLnJlbW92ZVByb3BlcnR5KCAndG9wJyApO1xuXHRcdG1lbnUucmVtb3ZlQXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctYWN0aW9uLXBsYWNlbWVudCcgKTtcblx0XHR0b2dnbGUuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScgKTtcblx0XHRyb290LmNsYXNzTGlzdC5yZW1vdmUoICdpcy1vcGVuJyApO1xuXHRcdGlmICggcmVzdG9yZV9mb2N1cyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdG9nZ2xlLmZvY3VzICkge1xuXHRcdFx0dG9nZ2xlLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIGFsbCBvcGVuIGFjdGlvbiBtZW51cyBpbiBvbmUgbW91bnRlZCBjYXRhbG9nLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICAgICAgY29udHJvbGxlciAgICBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBleGNsdWRlZF9yb290IE9wdGlvbmFsIG1lbnUgdG8gbGVhdmUgb3Blbi5cblx0ICogQHBhcmFtIHtib29sZWFufSAgICAgICAgIHJlc3RvcmVfZm9jdXMgV2hldGhlciBhIGNsb3NlZCB0b2dnbGUgcmVnYWlucyBmb2N1cy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgZXhjbHVkZWRfcm9vdCwgcmVzdG9yZV9mb2N1cyApIHtcblx0XHRjb250cm9sbGVyLm1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggcm9vdF9zZWxlY3RvciArICcuaXMtb3BlbicgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvb3QgKSB7XG5cdFx0XHRpZiAoIHJvb3QgIT09IGV4Y2x1ZGVkX3Jvb3QgKSB7XG5cdFx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIHJlc3RvcmVfZm9jdXMgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogUG9zaXRpb24gb25lIGZpeGVkIG1lbnUgdG93YXJkIHRoZSBhdmFpbGFibGUgY2F0YWxvZyBzcGFjZS5cblx0ICpcblx0ICogQSByZW9yZGVyZWQgQWN0aW9ucyBjb2x1bW4gY2FuIHNpdCBvbiBlaXRoZXIgcGh5c2ljYWwgc2lkZSBvZiBhIGNhdGFsb2cuXG5cdCAqIENvbXBhcmluZyB0aGUgdHJpZ2dlciBhbmQgY2F0YWxvZyBjZW50ZXJzIGF2b2lkcyBkb21haW4tc3BlY2lmaWMgY29sdW1uXG5cdCAqIGFzc3VtcHRpb25zLCB3aGlsZSB0aGUgYWx0ZXJuYXRlIHBsYWNlbWVudCBhbmQgdmlld3BvcnQgY2xhbXAgcHJvdGVjdFxuXHQgKiBuYXJyb3csIGhvcml6b250YWxseSBzY3JvbGxlZCwgYW5kIFJUTCBwcmVzZW50YXRpb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0b2dnbGUgTWVudSB0b2dnbGUuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1lbnUgICBNZW51IGVsZW1lbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwb3NpdGlvbl9tZW51KCB0b2dnbGUsIG1lbnUgKSB7XG5cdFx0dmFyIHZpZXdwb3J0X21hcmdpbiA9IDg7XG5cdFx0dmFyIHRvZ2dsZV9yZWN0ID0gdG9nZ2xlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHZhciBtZW51X3JlY3QgPSBtZW51LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdHZhciB2aWV3cG9ydF93aWR0aCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCB8fCB3aW5kb3cuaW5uZXJXaWR0aCB8fCAwO1xuXHRcdHZhciB2aWV3cG9ydF9oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCB8fCAwO1xuXHRcdHZhciBwb3NpdGlvbmluZ19yb290ID0gdG9nZ2xlLmNsb3Nlc3QoICcud3BiY191aV9saXN0aW5nX190YWJsZV93cmFwLCAud3BiY191aV9jYXRhbG9nJyApO1xuXHRcdHZhciBwb3NpdGlvbmluZ19yZWN0ID0gcG9zaXRpb25pbmdfcm9vdCA/IHBvc2l0aW9uaW5nX3Jvb3QuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkgOiBudWxsO1xuXHRcdHZhciBhdmFpbGFibGVfbGVmdCA9IHBvc2l0aW9uaW5nX3JlY3QgPyBNYXRoLm1heCggMCwgcG9zaXRpb25pbmdfcmVjdC5sZWZ0ICkgOiAwO1xuXHRcdHZhciBhdmFpbGFibGVfcmlnaHQgPSBwb3NpdGlvbmluZ19yZWN0ID8gTWF0aC5taW4oIHZpZXdwb3J0X3dpZHRoLCBwb3NpdGlvbmluZ19yZWN0LnJpZ2h0ICkgOiB2aWV3cG9ydF93aWR0aDtcblx0XHR2YXIgdHJpZ2dlcl9jZW50ZXIgPSB0b2dnbGVfcmVjdC5sZWZ0ICsgKCB0b2dnbGVfcmVjdC53aWR0aCAvIDIgKTtcblx0XHR2YXIgcm9vdF9jZW50ZXIgPSBhdmFpbGFibGVfbGVmdCArICggKCBhdmFpbGFibGVfcmlnaHQgLSBhdmFpbGFibGVfbGVmdCApIC8gMiApO1xuXHRcdHZhciBvcGVuc19yaWdodCA9IHRyaWdnZXJfY2VudGVyIDw9IHJvb3RfY2VudGVyO1xuXHRcdHZhciBwcmVmZXJyZWRfbGVmdCA9IG9wZW5zX3JpZ2h0ID8gdG9nZ2xlX3JlY3QubGVmdCA6IHRvZ2dsZV9yZWN0LnJpZ2h0IC0gbWVudV9yZWN0LndpZHRoO1xuXHRcdHZhciBhbHRlcm5hdGVfbGVmdCA9IG9wZW5zX3JpZ2h0ID8gdG9nZ2xlX3JlY3QucmlnaHQgLSBtZW51X3JlY3Qud2lkdGggOiB0b2dnbGVfcmVjdC5sZWZ0O1xuXHRcdHZhciBsZWZ0ID0gcHJlZmVycmVkX2xlZnQ7XG5cdFx0dmFyIHRvcCA9IHRvZ2dsZV9yZWN0LmJvdHRvbSArIDY7XG5cblx0XHRpZiAoIGxlZnQgPCB2aWV3cG9ydF9tYXJnaW4gfHwgbGVmdCArIG1lbnVfcmVjdC53aWR0aCA+IHZpZXdwb3J0X3dpZHRoIC0gdmlld3BvcnRfbWFyZ2luICkge1xuXHRcdFx0aWYgKCBhbHRlcm5hdGVfbGVmdCA+PSB2aWV3cG9ydF9tYXJnaW4gJiYgYWx0ZXJuYXRlX2xlZnQgKyBtZW51X3JlY3Qud2lkdGggPD0gdmlld3BvcnRfd2lkdGggLSB2aWV3cG9ydF9tYXJnaW4gKSB7XG5cdFx0XHRcdGxlZnQgPSBhbHRlcm5hdGVfbGVmdDtcblx0XHRcdFx0b3BlbnNfcmlnaHQgPSAhIG9wZW5zX3JpZ2h0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRsZWZ0ID0gTWF0aC5taW4oIE1hdGgubWF4KCB2aWV3cG9ydF9tYXJnaW4sIGxlZnQgKSwgTWF0aC5tYXgoIHZpZXdwb3J0X21hcmdpbiwgdmlld3BvcnRfd2lkdGggLSBtZW51X3JlY3Qud2lkdGggLSB2aWV3cG9ydF9tYXJnaW4gKSApO1xuXHRcdGlmICggdG9wICsgbWVudV9yZWN0LmhlaWdodCA+IHZpZXdwb3J0X2hlaWdodCAtIHZpZXdwb3J0X21hcmdpbiApIHtcblx0XHRcdHRvcCA9IE1hdGgubWF4KCB2aWV3cG9ydF9tYXJnaW4sIHRvZ2dsZV9yZWN0LnRvcCAtIG1lbnVfcmVjdC5oZWlnaHQgLSA2ICk7XG5cdFx0fVxuXHRcdG1lbnUuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXVpLWNhdGFsb2ctYWN0aW9uLXBsYWNlbWVudCcsIG9wZW5zX3JpZ2h0ID8gJ3JpZ2h0JyA6ICdsZWZ0JyApO1xuXHRcdG1lbnUuc3R5bGUubGVmdCA9IE1hdGgucm91bmQoIGxlZnQgKSArICdweCc7XG5cdFx0bWVudS5zdHlsZS50b3AgPSBNYXRoLnJvdW5kKCB0b3AgKSArICdweCc7XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiBvbmUgbWVudSBhbmQgb3B0aW9uYWxseSBtb3ZlIGZvY3VzIHRvIGFuIGVkZ2UgbWVudSBpdGVtLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gICAgICBjb250cm9sbGVyICAgICAgQWN0aW9uIGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3QgICAgICAgICAgICBBY3Rpb24gbWVudSB3cmFwcGVyLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICBmb2N1c19kaXJlY3Rpb24gZmlyc3QsIGxhc3QsIG9yIGFuIGVtcHR5IHN0cmluZy5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5fbWVudSggY29udHJvbGxlciwgcm9vdCwgZm9jdXNfZGlyZWN0aW9uICkge1xuXHRcdHZhciBtZW51ID0gcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggbWVudV9zZWxlY3RvciApIDogbnVsbDtcblx0XHR2YXIgdG9nZ2xlID0gcm9vdCA/IHJvb3QucXVlcnlTZWxlY3RvciggdG9nZ2xlX3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdHZhciBtZW51X2l0ZW1zO1xuXG5cdFx0aWYgKCAhIHJvb3QgfHwgISBtZW51IHx8ICEgdG9nZ2xlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjbG9zZV9hbGxfbWVudXMoIGNvbnRyb2xsZXIsIHJvb3QsIGZhbHNlICk7XG5cdFx0bWVudS5oaWRkZW4gPSBmYWxzZTtcblx0XHR0b2dnbGUuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xuXHRcdHJvb3QuY2xhc3NMaXN0LmFkZCggJ2lzLW9wZW4nICk7XG5cdFx0cG9zaXRpb25fbWVudSggdG9nZ2xlLCBtZW51ICk7XG5cblx0XHRpZiAoIGZvY3VzX2RpcmVjdGlvbiApIHtcblx0XHRcdG1lbnVfaXRlbXMgPSBnZXRfbWVudV9pdGVtcyggbWVudSApO1xuXHRcdFx0aWYgKCBtZW51X2l0ZW1zLmxlbmd0aCApIHtcblx0XHRcdFx0bWVudV9pdGVtc1sgJ2xhc3QnID09PSBmb2N1c19kaXJlY3Rpb24gPyBtZW51X2l0ZW1zLmxlbmd0aCAtIDEgOiAwIF0uZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogT3BlbiBvbmUgaXRlbSdzIGFjdGlvbiBtZW51IGFuZCBmb2N1cyBhbiBhdXRob3JpemVkIGFjdGlvbi5cblx0ICpcblx0ICogVGhpcyBwdWJsaWMgaW50ZXJhY3Rpb24gcmVtYWlucyBkb21haW4tbmV1dHJhbDogY2FsbGVycyBpZGVudGlmeSBhXG5cdCAqIHJlbmRlcmVkIGl0ZW0gYW5kIGFjdGlvbiB3aGlsZSB0aGUgc2hhcmVkIGNvbnRyb2xsZXIgb3ducyBtZW51IHN0YXRlLFxuXHQgKiBwbGFjZW1lbnQsIGFuZCBmb2N1cyBiZWhhdmlvci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRyb2xsZXIgQWN0aW9uIGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBpdGVtX2lkICAgIFJlbmRlcmVkIGNhdGFsb2cgaXRlbSBpZGVudGlmaWVyLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYWN0aW9uX2lkICBSZW5kZXJlZCBhY3Rpb24gaWRlbnRpZmllciB0byBmb2N1cy5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBtZW51IG9wZW5lZCBhbmQgdGhlIGFjdGlvbiByZWNlaXZlZCBmb2N1cy5cblx0ICovXG5cdGZ1bmN0aW9uIG9wZW5faXRlbV9tZW51KCBjb250cm9sbGVyLCBpdGVtX2lkLCBhY3Rpb25faWQgKSB7XG5cdFx0dmFyIGFjdGlvbl9pdGVtID0gbnVsbDtcblx0XHR2YXIgbWVudTtcblx0XHR2YXIgbWVudV9pdGVtcztcblx0XHR2YXIgcm9vdCA9IG51bGw7XG5cblx0XHRpZiAoICEgY29udHJvbGxlciB8fCAhIGl0ZW1faWQgfHwgISBhY3Rpb25faWQgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29udHJvbGxlci5tb3VudF9lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHJvb3Rfc2VsZWN0b3IgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNhbmRpZGF0ZV9yb290ICkge1xuXHRcdFx0aWYgKCAhIHJvb3QgJiYgaXRlbV9pZCA9PT0gU3RyaW5nKCBjYW5kaWRhdGVfcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1hY3Rpb24taXRlbScgKSB8fCAnJyApICkge1xuXHRcdFx0XHRyb290ID0gY2FuZGlkYXRlX3Jvb3Q7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdG1lbnUgPSByb290ID8gcm9vdC5xdWVyeVNlbGVjdG9yKCBtZW51X3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdG1lbnVfaXRlbXMgPSBtZW51ID8gZ2V0X21lbnVfaXRlbXMoIG1lbnUgKSA6IFtdO1xuXHRcdG1lbnVfaXRlbXMuZm9yRWFjaCggZnVuY3Rpb24gKCBtZW51X2l0ZW0gKSB7XG5cdFx0XHRpZiAoICEgYWN0aW9uX2l0ZW0gJiYgYWN0aW9uX2lkID09PSBTdHJpbmcoIG1lbnVfaXRlbS5nZXRBdHRyaWJ1dGUoIG1lbnVfaXRlbV9hY3Rpb25fYXR0cmlidXRlICkgfHwgJycgKSApIHtcblx0XHRcdFx0YWN0aW9uX2l0ZW0gPSBtZW51X2l0ZW07XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0aWYgKCAhIHJvb3QgfHwgISBhY3Rpb25faXRlbSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRvcGVuX21lbnUoIGNvbnRyb2xsZXIsIHJvb3QsICcnICk7XG5cdFx0YWN0aW9uX2l0ZW0uZm9jdXMoKTtcblxuXHRcdHJldHVybiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBhY3Rpb25faXRlbTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNb3ZlIGZvY3VzIHRocm91Z2ggb25lIGFjdGlvbiBtZW51IHdpdGggd3JhcHBpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1lbnUgICAgICAgICBBY3Rpb24gbWVudSBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjdXJyZW50X2l0ZW0gQ3VycmVudGx5IGZvY3VzZWQgbWVudSBpdGVtLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gICAgICBkaXJlY3Rpb24gICAgUG9zaXRpdmUgZm9yIG5leHQgb3IgbmVnYXRpdmUgZm9yIHByZXZpb3VzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gbW92ZV9tZW51X2ZvY3VzKCBtZW51LCBjdXJyZW50X2l0ZW0sIGRpcmVjdGlvbiApIHtcblx0XHR2YXIgbWVudV9pdGVtcyA9IGdldF9tZW51X2l0ZW1zKCBtZW51ICk7XG5cdFx0dmFyIGN1cnJlbnRfaW5kZXggPSBtZW51X2l0ZW1zLmluZGV4T2YoIGN1cnJlbnRfaXRlbSApO1xuXHRcdHZhciBuZXh0X2luZGV4O1xuXG5cdFx0aWYgKCAhIG1lbnVfaXRlbXMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRuZXh0X2luZGV4ID0gKCBjdXJyZW50X2luZGV4ICsgZGlyZWN0aW9uICsgbWVudV9pdGVtcy5sZW5ndGggKSAlIG1lbnVfaXRlbXMubGVuZ3RoO1xuXHRcdG1lbnVfaXRlbXNbIG5leHRfaW5kZXggXS5mb2N1cygpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhcHR1cmUgdGhlIGZvY3VzZWQgcm93IGFjdGlvbiBiZWZvcmUgcmVzcG9uc2UgbWFya3VwIGlzIHJlcGxhY2VkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNhcHR1cmVfYWN0aW9uX2ZvY3VzKCBjb250cm9sbGVyICkge1xuXHRcdHZhciBhY3RpdmVfZWxlbWVudCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0dmFyIHJvb3Q7XG5cblx0XHRjb250cm9sbGVyLmZvY3VzX2l0ZW1faWQgPSAnJztcblx0XHRpZiAoICEgYWN0aXZlX2VsZW1lbnQgfHwgISBjb250cm9sbGVyLm1vdW50X2VsZW1lbnQuY29udGFpbnMoIGFjdGl2ZV9lbGVtZW50ICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJvb3QgPSBhY3RpdmVfZWxlbWVudC5jbG9zZXN0KCByb290X3NlbGVjdG9yICk7XG5cdFx0aWYgKCByb290ICkge1xuXHRcdFx0Y29udHJvbGxlci5mb2N1c19pdGVtX2lkID0gcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1hY3Rpb24taXRlbScgKSB8fCAnJztcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVzdG9yZSBmb2N1cyB0byB0aGUgc2FtZSByb3cncyBhY3Rpb24gdG9nZ2xlIGFmdGVyIGFuIEFKQVggcmVidWlsZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRyb2xsZXIgQWN0aW9uIGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZXN0b3JlX2FjdGlvbl9mb2N1cyggY29udHJvbGxlciApIHtcblx0XHR2YXIgZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0XHR2YXIgZm9jdXNfaXRlbV9pZCA9IGNvbnRyb2xsZXIuZm9jdXNfaXRlbV9pZDtcblxuXHRcdGNvbnRyb2xsZXIuZm9jdXNfaXRlbV9pZCA9ICcnO1xuXHRcdGlmICggISBmb2N1c19pdGVtX2lkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLm1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggcm9vdF9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggcm9vdCApIHtcblx0XHRcdGlmICggISBmb2N1c190YXJnZXQgJiYgZm9jdXNfaXRlbV9pZCA9PT0gcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1hY3Rpb24taXRlbScgKSApIHtcblx0XHRcdFx0Zm9jdXNfdGFyZ2V0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfc2VsZWN0b3IgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0aWYgKCAhIGZvY3VzX3RhcmdldCApIHtcblx0XHRcdGZvY3VzX3RhcmdldCA9IGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWhlYWRpbmddJyApO1xuXHRcdH1cblx0XHRpZiAoIGZvY3VzX3RhcmdldCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9jdXNfdGFyZ2V0LmZvY3VzICkge1xuXHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBkZWxlZ2F0ZWQgcG9pbnRlciBhY3RpdmF0aW9uIGZvciBhY3Rpb24gbWVudXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgY29udHJvbGxlciBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCAgICAgIENhdGFsb2cgY2xpY2sgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGNvbnRyb2xsZXIsIGV2ZW50ICkge1xuXHRcdHZhciBtZW51X2l0ZW0gPSBldmVudC50YXJnZXQuY2xvc2VzdCggbWVudV9pdGVtX3NlbGVjdG9yICk7XG5cdFx0dmFyIHJvb3Q7XG5cdFx0dmFyIHRvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCB0b2dnbGVfc2VsZWN0b3IgKTtcblxuXHRcdGlmICggdG9nZ2xlICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHJvb3QgPSB0b2dnbGUuY2xvc2VzdCggcm9vdF9zZWxlY3RvciApO1xuXHRcdFx0aWYgKCByb290LmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgKSB7XG5cdFx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIGZhbHNlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvcGVuX21lbnUoIGNvbnRyb2xsZXIsIHJvb3QsIDAgPT09IGV2ZW50LmRldGFpbCA/ICdmaXJzdCcgOiAnJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIG1lbnVfaXRlbSApIHtcblx0XHRcdHJvb3QgPSBtZW51X2l0ZW0uY2xvc2VzdCggcm9vdF9zZWxlY3RvciApO1xuXHRcdFx0Y2xvc2VfbWVudSggcm9vdCwgZmFsc2UgKTtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciB0b2dnbGVfYWZ0ZXJfYWN0aW9uID0gcm9vdC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfc2VsZWN0b3IgKTtcblx0XHRcdFx0aWYgKCByb290LmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgJiYgdG9nZ2xlX2FmdGVyX2FjdGlvbiAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdG9nZ2xlX2FmdGVyX2FjdGlvbi5mb2N1cyApIHtcblx0XHRcdFx0XHR0b2dnbGVfYWZ0ZXJfYWN0aW9uLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDAgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIGFjdGlvbi1tZW51IGtleWJvYXJkIG5hdmlnYXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgY29udHJvbGxlciBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCAgICAgIENhdGFsb2cga2V5Ym9hcmQgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggY29udHJvbGxlciwgZXZlbnQgKSB7XG5cdFx0dmFyIG1lbnU7XG5cdFx0dmFyIG1lbnVfaXRlbSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCBtZW51X2l0ZW1fc2VsZWN0b3IgKTtcblx0XHR2YXIgbWVudV9pdGVtcztcblx0XHR2YXIgcm9vdDtcblx0XHR2YXIgdG9nZ2xlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHRvZ2dsZV9zZWxlY3RvciApO1xuXG5cdFx0aWYgKCB0b2dnbGUgKSB7XG5cdFx0XHRyb290ID0gdG9nZ2xlLmNsb3Nlc3QoIHJvb3Rfc2VsZWN0b3IgKTtcblx0XHRcdGlmICggJ0Fycm93RG93bicgPT09IGV2ZW50LmtleSB8fCAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0b3Blbl9tZW51KCBjb250cm9sbGVyLCByb290LCAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSA/ICdsYXN0JyA6ICdmaXJzdCcgKTtcblx0XHRcdH0gZWxzZSBpZiAoICdFc2NhcGUnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggISBtZW51X2l0ZW0gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cm9vdCA9IG1lbnVfaXRlbS5jbG9zZXN0KCByb290X3NlbGVjdG9yICk7XG5cdFx0bWVudSA9IG1lbnVfaXRlbS5jbG9zZXN0KCBtZW51X3NlbGVjdG9yICk7XG5cdFx0aWYgKCAnRXNjYXBlJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIHRydWUgKTtcblx0XHR9IGVsc2UgaWYgKCAnQXJyb3dEb3duJyA9PT0gZXZlbnQua2V5IHx8ICdBcnJvd1VwJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdG1vdmVfbWVudV9mb2N1cyggbWVudSwgbWVudV9pdGVtLCAnQXJyb3dEb3duJyA9PT0gZXZlbnQua2V5ID8gMSA6IC0xICk7XG5cdFx0fSBlbHNlIGlmICggJ0hvbWUnID09PSBldmVudC5rZXkgfHwgJ0VuZCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRtZW51X2l0ZW1zID0gZ2V0X21lbnVfaXRlbXMoIG1lbnUgKTtcblx0XHRcdGlmICggbWVudV9pdGVtcy5sZW5ndGggKSB7XG5cdFx0XHRcdG1lbnVfaXRlbXNbICdFbmQnID09PSBldmVudC5rZXkgPyBtZW51X2l0ZW1zLmxlbmd0aCAtIDEgOiAwIF0uZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBhY2Nlc3NpYmxlIGFjdGlvbiBtZW51cyBmb3Igb25lIG1vdW50ZWQgY2F0YWxvZy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdHxmYWxzZX0gQWN0aW9uIGNvbnRyb2xsZXIgQVBJIG9yIGZhbHNlIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2FjdGlvbnMoIG1vdW50X2VsZW1lbnQsIGNvbmZpZyApIHtcblx0XHR2YXIgY29udHJvbGxlcjtcblxuXHRcdGlmICggISBtb3VudF9lbGVtZW50IHx8IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRyZXR1cm4gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zX2NvbnRyb2xsZXIgOiBmYWxzZTtcblx0XHR9XG5cdFx0Y29udHJvbGxlciA9IHtcblx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZyAmJiBjb25maWcuaWQgPyBTdHJpbmcoIGNvbmZpZy5pZCApIDogJycsXG5cdFx0XHRmb2N1c19pdGVtX2lkOiAnJyxcblx0XHRcdG1vdW50X2VsZW1lbnQ6IG1vdW50X2VsZW1lbnRcblx0XHR9O1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aGFuZGxlX2NsaWNrKCBjb250cm9sbGVyLCBldmVudCApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdGhhbmRsZV9rZXlkb3duKCBjb250cm9sbGVyLCBldmVudCApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c291dCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgcm9vdCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCByb290X3NlbGVjdG9yICk7XG5cdFx0XHRpZiAoIHJvb3QgKSB7XG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCAhIHJvb3QuY29udGFpbnMoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKSApIHtcblx0XHRcdFx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIGZhbHNlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAwICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dWktY2F0YWxvZy1iZWZvcmUtcmVuZGVyJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2FwdHVyZV9hY3Rpb25fZm9jdXMoIGNvbnRyb2xsZXIgKTtcblx0XHRcdGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgbnVsbCwgZmFsc2UgKTtcblx0XHR9ICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp1aS1jYXRhbG9nLXJlbmRlcmVkJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmVzdG9yZV9hY3Rpb25fZm9jdXMoIGNvbnRyb2xsZXIgKTtcblx0XHR9ICk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjbGlja2VkX3Jvb3QgPSBldmVudC50YXJnZXQuY2xvc2VzdCggcm9vdF9zZWxlY3RvciApO1xuXHRcdFx0aWYgKCAhIGNsaWNrZWRfcm9vdCB8fCAhIGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5jb250YWlucyggY2xpY2tlZF9yb290ICkgKSB7XG5cdFx0XHRcdGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgbnVsbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjbG9zZV9hbGxfbWVudXMoIGNvbnRyb2xsZXIsIG51bGwsIGZhbHNlICk7XG5cdFx0fSApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2xvc2VfYWxsX21lbnVzKCBjb250cm9sbGVyLCBudWxsLCBmYWxzZSApO1xuXHRcdH0sIHRydWUgKTtcblxuXHRcdGNvbnRyb2xsZXIuYXBpID0ge1xuXHRcdFx0Y2xvc2VfYWxsOiBmdW5jdGlvbiAoIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRcdGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgbnVsbCwgISEgcmVzdG9yZV9mb2N1cyApO1xuXHRcdFx0fSxcblx0XHRcdG9wZW5faXRlbTogZnVuY3Rpb24gKCBpdGVtX2lkLCBhY3Rpb25faWQgKSB7XG5cdFx0XHRcdHJldHVybiBvcGVuX2l0ZW1fbWVudSggY29udHJvbGxlciwgU3RyaW5nKCBpdGVtX2lkIHx8ICcnICksIFN0cmluZyggYWN0aW9uX2lkIHx8ICcnICkgKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zX2NvbnRyb2xsZXIgPSBjb250cm9sbGVyLmFwaTtcblxuXHRcdHJldHVybiBjb250cm9sbGVyLmFwaTtcblx0fVxuXG5cdHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfYWN0aW9ucyA9IHdpbmRvdy53cGJjX3VpX2NhdGFsb2dfYWN0aW9ucyB8fCB7fTtcblx0d2luZG93LndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zLmluaXRpYWxpemUgPSBpbml0aWFsaXplX2FjdGlvbnM7XG59KCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxhQUFhLEdBQUcsb0NBQW9DO0VBQ3hELElBQUlDLGVBQWUsR0FBRyxzQ0FBc0M7RUFDNUQsSUFBSUMsYUFBYSxHQUFHLHlDQUF5QztFQUM3RCxJQUFJQyxrQkFBa0IsR0FBRyxtQkFBbUI7RUFDNUMsSUFBSUMsMEJBQTBCLEdBQUcsZ0NBQWdDOztFQUVqRTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxjQUFjQSxDQUFFQyxJQUFJLEVBQUc7SUFDL0IsT0FBT0MsS0FBSyxDQUFDQyxTQUFTLENBQUNDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFFSixJQUFJLENBQUNLLGdCQUFnQixDQUFFUixrQkFBbUIsQ0FBQyxFQUFFLFVBQVdTLFNBQVMsRUFBRztNQUN2RyxPQUFPLENBQUVBLFNBQVMsQ0FBQ0MsWUFBWSxDQUFFLFVBQVcsQ0FBQyxJQUFJLE1BQU0sS0FBS0QsU0FBUyxDQUFDRSxZQUFZLENBQUUsZUFBZ0IsQ0FBQztJQUN0RyxDQUFFLENBQUM7RUFDSjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLFVBQVVBLENBQUVDLElBQUksRUFBRUMsYUFBYSxFQUFHO0lBQzFDLElBQUlYLElBQUksR0FBR1UsSUFBSSxHQUFHQSxJQUFJLENBQUNFLGFBQWEsQ0FBRWhCLGFBQWMsQ0FBQyxHQUFHLElBQUk7SUFDNUQsSUFBSWlCLE1BQU0sR0FBR0gsSUFBSSxHQUFHQSxJQUFJLENBQUNFLGFBQWEsQ0FBRWpCLGVBQWdCLENBQUMsR0FBRyxJQUFJO0lBRWhFLElBQUssQ0FBRWUsSUFBSSxJQUFJLENBQUVW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
