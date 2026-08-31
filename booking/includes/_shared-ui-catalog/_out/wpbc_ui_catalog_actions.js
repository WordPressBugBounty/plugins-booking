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
      }
    };
    mount_element._wpbc_ui_catalog_actions_controller = controller.api;
    return controller.api;
  }
  window.wpbc_ui_catalog_actions = window.wpbc_ui_catalog_actions || {};
  window.wpbc_ui_catalog_actions.initialize = initialize_actions;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZC11aS1jYXRhbG9nL19vdXQvd3BiY191aV9jYXRhbG9nX2FjdGlvbnMuanMiLCJuYW1lcyI6WyJ3aW5kb3ciLCJkb2N1bWVudCIsInJvb3Rfc2VsZWN0b3IiLCJ0b2dnbGVfc2VsZWN0b3IiLCJtZW51X3NlbGVjdG9yIiwibWVudV9pdGVtX3NlbGVjdG9yIiwiZ2V0X21lbnVfaXRlbXMiLCJtZW51IiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmaWx0ZXIiLCJjYWxsIiwicXVlcnlTZWxlY3RvckFsbCIsIm1lbnVfaXRlbSIsImhhc0F0dHJpYnV0ZSIsImdldEF0dHJpYnV0ZSIsImNsb3NlX21lbnUiLCJyb290IiwicmVzdG9yZV9mb2N1cyIsInF1ZXJ5U2VsZWN0b3IiLCJ0b2dnbGUiLCJoaWRkZW4iLCJzdHlsZSIsInJlbW92ZVByb3BlcnR5IiwicmVtb3ZlQXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwiY2xhc3NMaXN0IiwicmVtb3ZlIiwiZm9jdXMiLCJjbG9zZV9hbGxfbWVudXMiLCJjb250cm9sbGVyIiwiZXhjbHVkZWRfcm9vdCIsIm1vdW50X2VsZW1lbnQiLCJmb3JFYWNoIiwicG9zaXRpb25fbWVudSIsInZpZXdwb3J0X21hcmdpbiIsInRvZ2dsZV9yZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwibWVudV9yZWN0Iiwidmlld3BvcnRfd2lkdGgiLCJkb2N1bWVudEVsZW1lbnQiLCJjbGllbnRXaWR0aCIsImlubmVyV2lkdGgiLCJ2aWV3cG9ydF9oZWlnaHQiLCJpbm5lckhlaWdodCIsImNsaWVudEhlaWdodCIsInBvc2l0aW9uaW5nX3Jvb3QiLCJjbG9zZXN0IiwicG9zaXRpb25pbmdfcmVjdCIsImF2YWlsYWJsZV9sZWZ0IiwiTWF0aCIsIm1heCIsImxlZnQiLCJhdmFpbGFibGVfcmlnaHQiLCJtaW4iLCJyaWdodCIsInRyaWdnZXJfY2VudGVyIiwid2lkdGgiLCJyb290X2NlbnRlciIsIm9wZW5zX3JpZ2h0IiwicHJlZmVycmVkX2xlZnQiLCJhbHRlcm5hdGVfbGVmdCIsInRvcCIsImJvdHRvbSIsImhlaWdodCIsInJvdW5kIiwib3Blbl9tZW51IiwiZm9jdXNfZGlyZWN0aW9uIiwibWVudV9pdGVtcyIsImFkZCIsImxlbmd0aCIsIm1vdmVfbWVudV9mb2N1cyIsImN1cnJlbnRfaXRlbSIsImRpcmVjdGlvbiIsImN1cnJlbnRfaW5kZXgiLCJpbmRleE9mIiwibmV4dF9pbmRleCIsImNhcHR1cmVfYWN0aW9uX2ZvY3VzIiwiYWN0aXZlX2VsZW1lbnQiLCJhY3RpdmVFbGVtZW50IiwiZm9jdXNfaXRlbV9pZCIsImNvbnRhaW5zIiwicmVzdG9yZV9hY3Rpb25fZm9jdXMiLCJmb2N1c190YXJnZXQiLCJoYW5kbGVfY2xpY2siLCJldmVudCIsInRhcmdldCIsInByZXZlbnREZWZhdWx0IiwiZGV0YWlsIiwic2V0VGltZW91dCIsInRvZ2dsZV9hZnRlcl9hY3Rpb24iLCJoYW5kbGVfa2V5ZG93biIsImtleSIsImluaXRpYWxpemVfYWN0aW9ucyIsImNvbmZpZyIsIl93cGJjX3VpX2NhdGFsb2dfYWN0aW9uc19jb250cm9sbGVyIiwiY2F0YWxvZ19pZCIsImlkIiwiU3RyaW5nIiwiYWRkRXZlbnRMaXN0ZW5lciIsImNsaWNrZWRfcm9vdCIsImFwaSIsImNsb3NlX2FsbCIsIndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zIiwiaW5pdGlhbGl6ZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL19zaGFyZWQtdWktY2F0YWxvZy9fc3JjL3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHJvdmlkZSBhY2Nlc3NpYmxlIHJvdy1hY3Rpb24gbWVudSBtZWNoYW5pY3MgZm9yIGluZGVwZW5kZW50IFdQQkMgY2F0YWxvZ3MuXG4gKlxuICogTWVudXMgZXhwb3NlIGFjdGlvbiBpbnRlbnQgb25seS4gRG9tYWluIHNjcmlwdHMgcmVtYWluIHJlc3BvbnNpYmxlIGZvclxuICogaW50ZXJwcmV0aW5nIGFuIGFjdGlvbiBhbmQgbm8gbXV0YXRpb24gaXMgcGVyZm9ybWVkIGJ5IHRoaXMgY29udHJvbGxlci5cbiAqXG4gKiBAc2luY2UgMTEuNi4wXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIHJvb3Rfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWFjdGlvbi1tZW51XSc7XG5cdHZhciB0b2dnbGVfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWFjdGlvbi10b2dnbGVdJztcblx0dmFyIG1lbnVfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy11aS1jYXRhbG9nLWFjdGlvbi1tZW51LWxpc3RdJztcblx0dmFyIG1lbnVfaXRlbV9zZWxlY3RvciA9ICdbcm9sZT1cIm1lbnVpdGVtXCJdJztcblxuXHQvKipcblx0ICogUmV0dXJuIGVuYWJsZWQgbWVudSBpdGVtcyBmcm9tIG9uZSByb3ctYWN0aW9uIG1lbnUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1lbnUgQWN0aW9uIG1lbnUgZWxlbWVudC5cblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnRbXX0gRW5hYmxlZCBtZW51IGl0ZW1zLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X21lbnVfaXRlbXMoIG1lbnUgKSB7XG5cdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbCggbWVudS5xdWVyeVNlbGVjdG9yQWxsKCBtZW51X2l0ZW1fc2VsZWN0b3IgKSwgZnVuY3Rpb24gKCBtZW51X2l0ZW0gKSB7XG5cdFx0XHRyZXR1cm4gISBtZW51X2l0ZW0uaGFzQXR0cmlidXRlKCAnZGlzYWJsZWQnICkgJiYgJ3RydWUnICE9PSBtZW51X2l0ZW0uZ2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2Ugb25lIGFjdGlvbiBtZW51IGFuZCBvcHRpb25hbGx5IHJlc3RvcmUgZm9jdXMgdG8gaXRzIHRvZ2dsZS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgICAgICAgICBBY3Rpb24gbWVudSB3cmFwcGVyLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICByZXN0b3JlX2ZvY3VzIFdoZXRoZXIgdGhlIHRvZ2dsZSBzaG91bGQgcmVnYWluIGZvY3VzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2xvc2VfbWVudSggcm9vdCwgcmVzdG9yZV9mb2N1cyApIHtcblx0XHR2YXIgbWVudSA9IHJvb3QgPyByb290LnF1ZXJ5U2VsZWN0b3IoIG1lbnVfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0dmFyIHRvZ2dsZSA9IHJvb3QgPyByb290LnF1ZXJ5U2VsZWN0b3IoIHRvZ2dsZV9zZWxlY3RvciApIDogbnVsbDtcblxuXHRcdGlmICggISByb290IHx8ICEgbWVudSB8fCAhIHRvZ2dsZSB8fCBtZW51LmhpZGRlbiApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bWVudS5oaWRkZW4gPSB0cnVlO1xuXHRcdG1lbnUuc3R5bGUucmVtb3ZlUHJvcGVydHkoICdsZWZ0JyApO1xuXHRcdG1lbnUuc3R5bGUucmVtb3ZlUHJvcGVydHkoICd0b3AnICk7XG5cdFx0bWVudS5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1hY3Rpb24tcGxhY2VtZW50JyApO1xuXHRcdHRvZ2dsZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyApO1xuXHRcdHJvb3QuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLW9wZW4nICk7XG5cdFx0aWYgKCByZXN0b3JlX2ZvY3VzICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0b2dnbGUuZm9jdXMgKSB7XG5cdFx0XHR0b2dnbGUuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2UgYWxsIG9wZW4gYWN0aW9uIG1lbnVzIGluIG9uZSBtb3VudGVkIGNhdGFsb2cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgICBjb250cm9sbGVyICAgIEFjdGlvbiBjb250cm9sbGVyIHN0YXRlLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGV4Y2x1ZGVkX3Jvb3QgT3B0aW9uYWwgbWVudSB0byBsZWF2ZSBvcGVuLlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICAgICAgcmVzdG9yZV9mb2N1cyBXaGV0aGVyIGEgY2xvc2VkIHRvZ2dsZSByZWdhaW5zIGZvY3VzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2xvc2VfYWxsX21lbnVzKCBjb250cm9sbGVyLCBleGNsdWRlZF9yb290LCByZXN0b3JlX2ZvY3VzICkge1xuXHRcdGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCByb290X3NlbGVjdG9yICsgJy5pcy1vcGVuJyApLmZvckVhY2goIGZ1bmN0aW9uICggcm9vdCApIHtcblx0XHRcdGlmICggcm9vdCAhPT0gZXhjbHVkZWRfcm9vdCApIHtcblx0XHRcdFx0Y2xvc2VfbWVudSggcm9vdCwgcmVzdG9yZV9mb2N1cyApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQb3NpdGlvbiBvbmUgZml4ZWQgbWVudSB0b3dhcmQgdGhlIGF2YWlsYWJsZSBjYXRhbG9nIHNwYWNlLlxuXHQgKlxuXHQgKiBBIHJlb3JkZXJlZCBBY3Rpb25zIGNvbHVtbiBjYW4gc2l0IG9uIGVpdGhlciBwaHlzaWNhbCBzaWRlIG9mIGEgY2F0YWxvZy5cblx0ICogQ29tcGFyaW5nIHRoZSB0cmlnZ2VyIGFuZCBjYXRhbG9nIGNlbnRlcnMgYXZvaWRzIGRvbWFpbi1zcGVjaWZpYyBjb2x1bW5cblx0ICogYXNzdW1wdGlvbnMsIHdoaWxlIHRoZSBhbHRlcm5hdGUgcGxhY2VtZW50IGFuZCB2aWV3cG9ydCBjbGFtcCBwcm90ZWN0XG5cdCAqIG5hcnJvdywgaG9yaXpvbnRhbGx5IHNjcm9sbGVkLCBhbmQgUlRMIHByZXNlbnRhdGlvbnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHRvZ2dsZSBNZW51IHRvZ2dsZS5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbWVudSAgIE1lbnUgZWxlbWVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHBvc2l0aW9uX21lbnUoIHRvZ2dsZSwgbWVudSApIHtcblx0XHR2YXIgdmlld3BvcnRfbWFyZ2luID0gODtcblx0XHR2YXIgdG9nZ2xlX3JlY3QgPSB0b2dnbGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0dmFyIG1lbnVfcmVjdCA9IG1lbnUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0dmFyIHZpZXdwb3J0X3dpZHRoID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoIHx8IHdpbmRvdy5pbm5lcldpZHRoIHx8IDA7XG5cdFx0dmFyIHZpZXdwb3J0X2hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0IHx8IDA7XG5cdFx0dmFyIHBvc2l0aW9uaW5nX3Jvb3QgPSB0b2dnbGUuY2xvc2VzdCggJy53cGJjX3VpX2xpc3RpbmdfX3RhYmxlX3dyYXAsIC53cGJjX3VpX2NhdGFsb2cnICk7XG5cdFx0dmFyIHBvc2l0aW9uaW5nX3JlY3QgPSBwb3NpdGlvbmluZ19yb290ID8gcG9zaXRpb25pbmdfcm9vdC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSA6IG51bGw7XG5cdFx0dmFyIGF2YWlsYWJsZV9sZWZ0ID0gcG9zaXRpb25pbmdfcmVjdCA/IE1hdGgubWF4KCAwLCBwb3NpdGlvbmluZ19yZWN0LmxlZnQgKSA6IDA7XG5cdFx0dmFyIGF2YWlsYWJsZV9yaWdodCA9IHBvc2l0aW9uaW5nX3JlY3QgPyBNYXRoLm1pbiggdmlld3BvcnRfd2lkdGgsIHBvc2l0aW9uaW5nX3JlY3QucmlnaHQgKSA6IHZpZXdwb3J0X3dpZHRoO1xuXHRcdHZhciB0cmlnZ2VyX2NlbnRlciA9IHRvZ2dsZV9yZWN0LmxlZnQgKyAoIHRvZ2dsZV9yZWN0LndpZHRoIC8gMiApO1xuXHRcdHZhciByb290X2NlbnRlciA9IGF2YWlsYWJsZV9sZWZ0ICsgKCAoIGF2YWlsYWJsZV9yaWdodCAtIGF2YWlsYWJsZV9sZWZ0ICkgLyAyICk7XG5cdFx0dmFyIG9wZW5zX3JpZ2h0ID0gdHJpZ2dlcl9jZW50ZXIgPD0gcm9vdF9jZW50ZXI7XG5cdFx0dmFyIHByZWZlcnJlZF9sZWZ0ID0gb3BlbnNfcmlnaHQgPyB0b2dnbGVfcmVjdC5sZWZ0IDogdG9nZ2xlX3JlY3QucmlnaHQgLSBtZW51X3JlY3Qud2lkdGg7XG5cdFx0dmFyIGFsdGVybmF0ZV9sZWZ0ID0gb3BlbnNfcmlnaHQgPyB0b2dnbGVfcmVjdC5yaWdodCAtIG1lbnVfcmVjdC53aWR0aCA6IHRvZ2dsZV9yZWN0LmxlZnQ7XG5cdFx0dmFyIGxlZnQgPSBwcmVmZXJyZWRfbGVmdDtcblx0XHR2YXIgdG9wID0gdG9nZ2xlX3JlY3QuYm90dG9tICsgNjtcblxuXHRcdGlmICggbGVmdCA8IHZpZXdwb3J0X21hcmdpbiB8fCBsZWZ0ICsgbWVudV9yZWN0LndpZHRoID4gdmlld3BvcnRfd2lkdGggLSB2aWV3cG9ydF9tYXJnaW4gKSB7XG5cdFx0XHRpZiAoIGFsdGVybmF0ZV9sZWZ0ID49IHZpZXdwb3J0X21hcmdpbiAmJiBhbHRlcm5hdGVfbGVmdCArIG1lbnVfcmVjdC53aWR0aCA8PSB2aWV3cG9ydF93aWR0aCAtIHZpZXdwb3J0X21hcmdpbiApIHtcblx0XHRcdFx0bGVmdCA9IGFsdGVybmF0ZV9sZWZ0O1xuXHRcdFx0XHRvcGVuc19yaWdodCA9ICEgb3BlbnNfcmlnaHQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGxlZnQgPSBNYXRoLm1pbiggTWF0aC5tYXgoIHZpZXdwb3J0X21hcmdpbiwgbGVmdCApLCBNYXRoLm1heCggdmlld3BvcnRfbWFyZ2luLCB2aWV3cG9ydF93aWR0aCAtIG1lbnVfcmVjdC53aWR0aCAtIHZpZXdwb3J0X21hcmdpbiApICk7XG5cdFx0aWYgKCB0b3AgKyBtZW51X3JlY3QuaGVpZ2h0ID4gdmlld3BvcnRfaGVpZ2h0IC0gdmlld3BvcnRfbWFyZ2luICkge1xuXHRcdFx0dG9wID0gTWF0aC5tYXgoIHZpZXdwb3J0X21hcmdpbiwgdG9nZ2xlX3JlY3QudG9wIC0gbWVudV9yZWN0LmhlaWdodCAtIDYgKTtcblx0XHR9XG5cdFx0bWVudS5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1hY3Rpb24tcGxhY2VtZW50Jywgb3BlbnNfcmlnaHQgPyAncmlnaHQnIDogJ2xlZnQnICk7XG5cdFx0bWVudS5zdHlsZS5sZWZ0ID0gTWF0aC5yb3VuZCggbGVmdCApICsgJ3B4Jztcblx0XHRtZW51LnN0eWxlLnRvcCA9IE1hdGgucm91bmQoIHRvcCApICsgJ3B4Jztcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIG9uZSBtZW51IGFuZCBvcHRpb25hbGx5IG1vdmUgZm9jdXMgdG8gYW4gZWRnZSBtZW51IGl0ZW0uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbnRyb2xsZXIgICAgICBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcm9vdCAgICAgICAgICAgIEFjdGlvbiBtZW51IHdyYXBwZXIuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGZvY3VzX2RpcmVjdGlvbiBmaXJzdCwgbGFzdCwgb3IgYW4gZW1wdHkgc3RyaW5nLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gb3Blbl9tZW51KCBjb250cm9sbGVyLCByb290LCBmb2N1c19kaXJlY3Rpb24gKSB7XG5cdFx0dmFyIG1lbnUgPSByb290ID8gcm9vdC5xdWVyeVNlbGVjdG9yKCBtZW51X3NlbGVjdG9yICkgOiBudWxsO1xuXHRcdHZhciB0b2dnbGUgPSByb290ID8gcm9vdC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0dmFyIG1lbnVfaXRlbXM7XG5cblx0XHRpZiAoICEgcm9vdCB8fCAhIG1lbnUgfHwgISB0b2dnbGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgcm9vdCwgZmFsc2UgKTtcblx0XHRtZW51LmhpZGRlbiA9IGZhbHNlO1xuXHRcdHRvZ2dsZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0cm9vdC5jbGFzc0xpc3QuYWRkKCAnaXMtb3BlbicgKTtcblx0XHRwb3NpdGlvbl9tZW51KCB0b2dnbGUsIG1lbnUgKTtcblxuXHRcdGlmICggZm9jdXNfZGlyZWN0aW9uICkge1xuXHRcdFx0bWVudV9pdGVtcyA9IGdldF9tZW51X2l0ZW1zKCBtZW51ICk7XG5cdFx0XHRpZiAoIG1lbnVfaXRlbXMubGVuZ3RoICkge1xuXHRcdFx0XHRtZW51X2l0ZW1zWyAnbGFzdCcgPT09IGZvY3VzX2RpcmVjdGlvbiA/IG1lbnVfaXRlbXMubGVuZ3RoIC0gMSA6IDAgXS5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBNb3ZlIGZvY3VzIHRocm91Z2ggb25lIGFjdGlvbiBtZW51IHdpdGggd3JhcHBpbmcuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG1lbnUgICAgICAgICBBY3Rpb24gbWVudSBlbGVtZW50LlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBjdXJyZW50X2l0ZW0gQ3VycmVudGx5IGZvY3VzZWQgbWVudSBpdGVtLlxuXHQgKiBAcGFyYW0ge251bWJlcn0gICAgICBkaXJlY3Rpb24gICAgUG9zaXRpdmUgZm9yIG5leHQgb3IgbmVnYXRpdmUgZm9yIHByZXZpb3VzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gbW92ZV9tZW51X2ZvY3VzKCBtZW51LCBjdXJyZW50X2l0ZW0sIGRpcmVjdGlvbiApIHtcblx0XHR2YXIgbWVudV9pdGVtcyA9IGdldF9tZW51X2l0ZW1zKCBtZW51ICk7XG5cdFx0dmFyIGN1cnJlbnRfaW5kZXggPSBtZW51X2l0ZW1zLmluZGV4T2YoIGN1cnJlbnRfaXRlbSApO1xuXHRcdHZhciBuZXh0X2luZGV4O1xuXG5cdFx0aWYgKCAhIG1lbnVfaXRlbXMubGVuZ3RoICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRuZXh0X2luZGV4ID0gKCBjdXJyZW50X2luZGV4ICsgZGlyZWN0aW9uICsgbWVudV9pdGVtcy5sZW5ndGggKSAlIG1lbnVfaXRlbXMubGVuZ3RoO1xuXHRcdG1lbnVfaXRlbXNbIG5leHRfaW5kZXggXS5mb2N1cygpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENhcHR1cmUgdGhlIGZvY3VzZWQgcm93IGFjdGlvbiBiZWZvcmUgcmVzcG9uc2UgbWFya3VwIGlzIHJlcGxhY2VkLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gY29udHJvbGxlciBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNhcHR1cmVfYWN0aW9uX2ZvY3VzKCBjb250cm9sbGVyICkge1xuXHRcdHZhciBhY3RpdmVfZWxlbWVudCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0dmFyIHJvb3Q7XG5cblx0XHRjb250cm9sbGVyLmZvY3VzX2l0ZW1faWQgPSAnJztcblx0XHRpZiAoICEgYWN0aXZlX2VsZW1lbnQgfHwgISBjb250cm9sbGVyLm1vdW50X2VsZW1lbnQuY29udGFpbnMoIGFjdGl2ZV9lbGVtZW50ICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJvb3QgPSBhY3RpdmVfZWxlbWVudC5jbG9zZXN0KCByb290X3NlbGVjdG9yICk7XG5cdFx0aWYgKCByb290ICkge1xuXHRcdFx0Y29udHJvbGxlci5mb2N1c19pdGVtX2lkID0gcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1hY3Rpb24taXRlbScgKSB8fCAnJztcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVzdG9yZSBmb2N1cyB0byB0aGUgc2FtZSByb3cncyBhY3Rpb24gdG9nZ2xlIGFmdGVyIGFuIEFKQVggcmVidWlsZC5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRyb2xsZXIgQWN0aW9uIGNvbnRyb2xsZXIgc3RhdGUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiByZXN0b3JlX2FjdGlvbl9mb2N1cyggY29udHJvbGxlciApIHtcblx0XHR2YXIgZm9jdXNfdGFyZ2V0ID0gbnVsbDtcblx0XHR2YXIgZm9jdXNfaXRlbV9pZCA9IGNvbnRyb2xsZXIuZm9jdXNfaXRlbV9pZDtcblxuXHRcdGNvbnRyb2xsZXIuZm9jdXNfaXRlbV9pZCA9ICcnO1xuXHRcdGlmICggISBmb2N1c19pdGVtX2lkICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLm1vdW50X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggcm9vdF9zZWxlY3RvciApLmZvckVhY2goIGZ1bmN0aW9uICggcm9vdCApIHtcblx0XHRcdGlmICggISBmb2N1c190YXJnZXQgJiYgZm9jdXNfaXRlbV9pZCA9PT0gcm9vdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdWktY2F0YWxvZy1hY3Rpb24taXRlbScgKSApIHtcblx0XHRcdFx0Zm9jdXNfdGFyZ2V0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfc2VsZWN0b3IgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0aWYgKCAhIGZvY3VzX3RhcmdldCApIHtcblx0XHRcdGZvY3VzX3RhcmdldCA9IGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jYXRhbG9nLWhlYWRpbmddJyApO1xuXHRcdH1cblx0XHRpZiAoIGZvY3VzX3RhcmdldCAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZm9jdXNfdGFyZ2V0LmZvY3VzICkge1xuXHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBkZWxlZ2F0ZWQgcG9pbnRlciBhY3RpdmF0aW9uIGZvciBhY3Rpb24gbWVudXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgY29udHJvbGxlciBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCAgICAgIENhdGFsb2cgY2xpY2sgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGNvbnRyb2xsZXIsIGV2ZW50ICkge1xuXHRcdHZhciBtZW51X2l0ZW0gPSBldmVudC50YXJnZXQuY2xvc2VzdCggbWVudV9pdGVtX3NlbGVjdG9yICk7XG5cdFx0dmFyIHJvb3Q7XG5cdFx0dmFyIHRvZ2dsZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCB0b2dnbGVfc2VsZWN0b3IgKTtcblxuXHRcdGlmICggdG9nZ2xlICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHJvb3QgPSB0b2dnbGUuY2xvc2VzdCggcm9vdF9zZWxlY3RvciApO1xuXHRcdFx0aWYgKCByb290LmNsYXNzTGlzdC5jb250YWlucyggJ2lzLW9wZW4nICkgKSB7XG5cdFx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIGZhbHNlICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvcGVuX21lbnUoIGNvbnRyb2xsZXIsIHJvb3QsIDAgPT09IGV2ZW50LmRldGFpbCA/ICdmaXJzdCcgOiAnJyApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIG1lbnVfaXRlbSApIHtcblx0XHRcdHJvb3QgPSBtZW51X2l0ZW0uY2xvc2VzdCggcm9vdF9zZWxlY3RvciApO1xuXHRcdFx0Y2xvc2VfbWVudSggcm9vdCwgZmFsc2UgKTtcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciB0b2dnbGVfYWZ0ZXJfYWN0aW9uID0gcm9vdC5xdWVyeVNlbGVjdG9yKCB0b2dnbGVfc2VsZWN0b3IgKTtcblx0XHRcdFx0aWYgKCByb290LmNvbnRhaW5zKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkgJiYgdG9nZ2xlX2FmdGVyX2FjdGlvbiAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdG9nZ2xlX2FmdGVyX2FjdGlvbi5mb2N1cyApIHtcblx0XHRcdFx0XHR0b2dnbGVfYWZ0ZXJfYWN0aW9uLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDAgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIGFjdGlvbi1tZW51IGtleWJvYXJkIG5hdmlnYXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgICAgY29udHJvbGxlciBBY3Rpb24gY29udHJvbGxlciBzdGF0ZS5cblx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCAgICAgIENhdGFsb2cga2V5Ym9hcmQgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggY29udHJvbGxlciwgZXZlbnQgKSB7XG5cdFx0dmFyIG1lbnU7XG5cdFx0dmFyIG1lbnVfaXRlbSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCBtZW51X2l0ZW1fc2VsZWN0b3IgKTtcblx0XHR2YXIgbWVudV9pdGVtcztcblx0XHR2YXIgcm9vdDtcblx0XHR2YXIgdG9nZ2xlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHRvZ2dsZV9zZWxlY3RvciApO1xuXG5cdFx0aWYgKCB0b2dnbGUgKSB7XG5cdFx0XHRyb290ID0gdG9nZ2xlLmNsb3Nlc3QoIHJvb3Rfc2VsZWN0b3IgKTtcblx0XHRcdGlmICggJ0Fycm93RG93bicgPT09IGV2ZW50LmtleSB8fCAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0b3Blbl9tZW51KCBjb250cm9sbGVyLCByb290LCAnQXJyb3dVcCcgPT09IGV2ZW50LmtleSA/ICdsYXN0JyA6ICdmaXJzdCcgKTtcblx0XHRcdH0gZWxzZSBpZiAoICdFc2NhcGUnID09PSBldmVudC5rZXkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICggISBtZW51X2l0ZW0gKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cm9vdCA9IG1lbnVfaXRlbS5jbG9zZXN0KCByb290X3NlbGVjdG9yICk7XG5cdFx0bWVudSA9IG1lbnVfaXRlbS5jbG9zZXN0KCBtZW51X3NlbGVjdG9yICk7XG5cdFx0aWYgKCAnRXNjYXBlJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIHRydWUgKTtcblx0XHR9IGVsc2UgaWYgKCAnQXJyb3dEb3duJyA9PT0gZXZlbnQua2V5IHx8ICdBcnJvd1VwJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdG1vdmVfbWVudV9mb2N1cyggbWVudSwgbWVudV9pdGVtLCAnQXJyb3dEb3duJyA9PT0gZXZlbnQua2V5ID8gMSA6IC0xICk7XG5cdFx0fSBlbHNlIGlmICggJ0hvbWUnID09PSBldmVudC5rZXkgfHwgJ0VuZCcgPT09IGV2ZW50LmtleSApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRtZW51X2l0ZW1zID0gZ2V0X21lbnVfaXRlbXMoIG1lbnUgKTtcblx0XHRcdGlmICggbWVudV9pdGVtcy5sZW5ndGggKSB7XG5cdFx0XHRcdG1lbnVfaXRlbXNbICdFbmQnID09PSBldmVudC5rZXkgPyBtZW51X2l0ZW1zLmxlbmd0aCAtIDEgOiAwIF0uZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogSW5pdGlhbGl6ZSBhY2Nlc3NpYmxlIGFjdGlvbiBtZW51cyBmb3Igb25lIG1vdW50ZWQgY2F0YWxvZy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbW91bnRfZWxlbWVudCBDYXRhbG9nIG1vdW50IGVsZW1lbnQuXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGNvbmZpZyAgICAgICAgUmVnaXN0ZXJlZCBicm93c2VyIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdHxmYWxzZX0gQWN0aW9uIGNvbnRyb2xsZXIgQVBJIG9yIGZhbHNlIHdoZW4gdW5hdmFpbGFibGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBpbml0aWFsaXplX2FjdGlvbnMoIG1vdW50X2VsZW1lbnQsIGNvbmZpZyApIHtcblx0XHR2YXIgY29udHJvbGxlcjtcblxuXHRcdGlmICggISBtb3VudF9lbGVtZW50IHx8IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zX2NvbnRyb2xsZXIgKSB7XG5cdFx0XHRyZXR1cm4gbW91bnRfZWxlbWVudCA/IG1vdW50X2VsZW1lbnQuX3dwYmNfdWlfY2F0YWxvZ19hY3Rpb25zX2NvbnRyb2xsZXIgOiBmYWxzZTtcblx0XHR9XG5cdFx0Y29udHJvbGxlciA9IHtcblx0XHRcdGNhdGFsb2dfaWQ6IGNvbmZpZyAmJiBjb25maWcuaWQgPyBTdHJpbmcoIGNvbmZpZy5pZCApIDogJycsXG5cdFx0XHRmb2N1c19pdGVtX2lkOiAnJyxcblx0XHRcdG1vdW50X2VsZW1lbnQ6IG1vdW50X2VsZW1lbnRcblx0XHR9O1xuXG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0aGFuZGxlX2NsaWNrKCBjb250cm9sbGVyLCBldmVudCApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdGhhbmRsZV9rZXlkb3duKCBjb250cm9sbGVyLCBldmVudCApO1xuXHRcdH0gKTtcblx0XHRtb3VudF9lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c291dCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHR2YXIgcm9vdCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCByb290X3NlbGVjdG9yICk7XG5cdFx0XHRpZiAoIHJvb3QgKSB7XG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0aWYgKCAhIHJvb3QuY29udGFpbnMoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKSApIHtcblx0XHRcdFx0XHRcdGNsb3NlX21lbnUoIHJvb3QsIGZhbHNlICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCAwICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHRcdG1vdW50X2VsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dWktY2F0YWxvZy1iZWZvcmUtcmVuZGVyJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2FwdHVyZV9hY3Rpb25fZm9jdXMoIGNvbnRyb2xsZXIgKTtcblx0XHRcdGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgbnVsbCwgZmFsc2UgKTtcblx0XHR9ICk7XG5cdFx0bW91bnRfZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzp1aS1jYXRhbG9nLXJlbmRlcmVkJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0cmVzdG9yZV9hY3Rpb25fZm9jdXMoIGNvbnRyb2xsZXIgKTtcblx0XHR9ICk7XG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHRcdHZhciBjbGlja2VkX3Jvb3QgPSBldmVudC50YXJnZXQuY2xvc2VzdCggcm9vdF9zZWxlY3RvciApO1xuXHRcdFx0aWYgKCAhIGNsaWNrZWRfcm9vdCB8fCAhIGNvbnRyb2xsZXIubW91bnRfZWxlbWVudC5jb250YWlucyggY2xpY2tlZF9yb290ICkgKSB7XG5cdFx0XHRcdGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgbnVsbCwgZmFsc2UgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjbG9zZV9hbGxfbWVudXMoIGNvbnRyb2xsZXIsIG51bGwsIGZhbHNlICk7XG5cdFx0fSApO1xuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnc2Nyb2xsJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y2xvc2VfYWxsX21lbnVzKCBjb250cm9sbGVyLCBudWxsLCBmYWxzZSApO1xuXHRcdH0sIHRydWUgKTtcblxuXHRcdGNvbnRyb2xsZXIuYXBpID0ge1xuXHRcdFx0Y2xvc2VfYWxsOiBmdW5jdGlvbiAoIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRcdGNsb3NlX2FsbF9tZW51cyggY29udHJvbGxlciwgbnVsbCwgISEgcmVzdG9yZV9mb2N1cyApO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0bW91bnRfZWxlbWVudC5fd3BiY191aV9jYXRhbG9nX2FjdGlvbnNfY29udHJvbGxlciA9IGNvbnRyb2xsZXIuYXBpO1xuXG5cdFx0cmV0dXJuIGNvbnRyb2xsZXIuYXBpO1xuXHR9XG5cblx0d2luZG93LndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zID0gd2luZG93LndwYmNfdWlfY2F0YWxvZ19hY3Rpb25zIHx8IHt9O1xuXHR3aW5kb3cud3BiY191aV9jYXRhbG9nX2FjdGlvbnMuaW5pdGlhbGl6ZSA9IGluaXRpYWxpemVfYWN0aW9ucztcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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
