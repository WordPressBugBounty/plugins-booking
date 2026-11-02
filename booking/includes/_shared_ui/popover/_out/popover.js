"use strict";

/**
 * Domain-neutral shared administration popover interactions.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var root_selector = '[data-wpbc-shared-ui-popover]';
  var trigger_selector = '[data-wpbc-shared-ui-popover-trigger]';
  var panel_selector = '[data-wpbc-shared-ui-popover-panel]';
  var close_selector = '[data-wpbc-shared-ui-popover-close]';
  var external_owner_selector = '[data-wpbc-shared-ui-popover-owner]';
  var active_external_popover = null;
  var external_interaction_timer = 0;
  var layer_open_event = 'wpbc:shared-ui-layer-open';
  var layer_close_event = 'wpbc:shared-ui-layer-close';

  /**
   * Normalize one disclosure interaction identifier.
   *
   * @param {*} candidate Candidate identifier.
   * @return {string} Bounded DOM-safe identifier.
   */
  function normalize_layer_id(candidate) {
    return String(candidate || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
  }

  /**
   * Declare one disclosure root and panel as a shared floating layer.
   *
   * @param {HTMLElement} popover Shared disclosure root.
   * @return {Object|null} Four-key descriptor or null for invalid markup.
   */
  function declare_layer(popover) {
    var panel = popover && popover.querySelector ? popover.querySelector(panel_selector) : null;
    var instance_id = normalize_layer_id(popover ? popover.getAttribute('data-wpbc-shared-ui-popover') : '');
    var owner_id = normalize_layer_id(popover ? popover.getAttribute('data-wpbc-shared-ui-layer-owner') : '') || instance_id;
    var interaction_group = normalize_layer_id(popover ? popover.getAttribute('data-wpbc-shared-ui-layer-interaction-group') : '') || instance_id;
    var descriptor;
    if (!popover || !panel || !instance_id) {
      return null;
    }
    descriptor = {
      layer_type: 'disclosure',
      instance_id: instance_id,
      owner_id: owner_id,
      interaction_group: interaction_group
    };
    [popover, panel].forEach(function (layer_element) {
      layer_element.setAttribute('data-wpbc-shared-ui-layer-type', descriptor.layer_type);
      layer_element.setAttribute('data-wpbc-shared-ui-layer-instance', descriptor.instance_id);
      layer_element.setAttribute('data-wpbc-shared-ui-layer-owner', descriptor.owner_id);
      layer_element.setAttribute('data-wpbc-shared-ui-layer-interaction-group', descriptor.interaction_group);
    });
    return descriptor;
  }

  /**
   * Announce a disclosure lifecycle using identifier-only metadata.
   *
   * @param {string} event_name Open or close protocol event name.
   * @param {Object} descriptor Normalized disclosure descriptor.
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
   * Find a registered popover by its stable component ID.
   *
   * Iteration avoids requiring CSS.escape() in supported legacy browsers.
   *
   * @param {string} popover_id Stable popover ID.
   * @return {HTMLElement|null} Matching popover root or null.
   */
  function find_popover_by_id(popover_id) {
    var matching_popover = null;
    Array.prototype.some.call(document.querySelectorAll(root_selector), function (popover) {
      if (popover.getAttribute('data-wpbc-shared-ui-popover') === popover_id) {
        matching_popover = popover;
        return true;
      }
      return false;
    });
    return matching_popover;
  }

  /**
   * Resolve a DOM event target to its inline or externally portaled popover.
   *
   * @param {Element|null} target Browser event target.
   * @return {HTMLElement|null} Owning popover root or null.
   */
  function resolve_event_popover(target) {
    var inline_popover;
    var external_surface;
    if (!target || !target.closest) {
      return null;
    }
    inline_popover = target.closest(root_selector);
    if (inline_popover) {
      return inline_popover;
    }
    external_surface = target.closest(external_owner_selector);
    if (!external_surface) {
      return null;
    }
    return find_popover_by_id(external_surface.getAttribute('data-wpbc-shared-ui-popover-owner') || '');
  }

  /**
   * Retain external-surface ownership across pointer-induced focus changes.
   *
   * Portaled widgets may temporarily move focus to body before their click
   * handler restores focus. The short-lived owner prevents that intermediate
   * focus transition from being mistaken for an outside interaction.
   *
   * @param {MouseEvent} event Capturing mousedown event.
   * @return {void}
   */
  function handle_pointer_down(event) {
    var external_surface = event.target.closest ? event.target.closest(external_owner_selector) : null;
    window.clearTimeout(external_interaction_timer);
    active_external_popover = external_surface ? resolve_event_popover(external_surface) : null;
    external_interaction_timer = window.setTimeout(function () {
      active_external_popover = null;
    }, 500);
  }

  /**
   * Close one popover and optionally restore trigger focus.
   *
   * @param {HTMLElement} popover      Popover root.
   * @param {boolean}     restore_focus Whether to focus its trigger.
   * @return {void}
   */
  function close_popover(popover, restore_focus) {
    var trigger = popover.querySelector(trigger_selector);
    var panel = popover.querySelector(panel_selector);
    var was_open = popover.classList.contains('is-open');
    var layer_descriptor;
    if (!trigger || !panel) {
      return;
    }
    panel.hidden = true;
    panel.style.removeProperty('--wpbc_shared_ui_popover__available-block-size');
    trigger.setAttribute('aria-expanded', 'false');
    popover.classList.remove('is-open', 'is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top');
    if (was_open) {
      layer_descriptor = declare_layer(popover);
      dispatch_layer_event(layer_close_event, layer_descriptor);
    }
    if (restore_focus) {
      trigger.focus();
    }
  }

  /**
   * Close every open popover except an optional retained instance.
   *
   * @param {HTMLElement|null} retained_popover Popover that may remain open.
   * @return {void}
   */
  function close_other_popovers(retained_popover) {
    Array.prototype.forEach.call(document.querySelectorAll(root_selector + '.is-open'), function (popover) {
      if (popover !== retained_popover) {
        close_popover(popover, false);
      }
    });
  }

  /**
   * Resolve the visible vertical interval shared by the viewport and clipping ancestors.
   *
   * Absolutely positioned panels can still be clipped by an ancestor using
   * hidden, clip, auto, or scroll overflow. Measuring only window.innerHeight
   * therefore overstates the usable height on bounded administration surfaces.
   *
   * @param {HTMLElement} panel        Visible popover panel.
   * @param {number}      viewport_gap Required gap from every clipping edge.
   * @return {Object} Numeric start and end viewport coordinates.
   */
  function get_block_clipping_bounds(panel, viewport_gap) {
    var block_start = viewport_gap;
    var block_end = Math.max(viewport_gap + 1, window.innerHeight - viewport_gap);
    var ancestor = panel.parentElement;
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
      var ancestor_style = window.getComputedStyle ? window.getComputedStyle(ancestor) : null;
      var overflow_y = ancestor_style ? String(ancestor_style.overflowY || '') : '';
      var ancestor_rectangle;
      if (-1 !== ['auto', 'clip', 'hidden', 'scroll'].indexOf(overflow_y)) {
        ancestor_rectangle = ancestor.getBoundingClientRect();
        if (0 < ancestor_rectangle.height) {
          block_start = Math.max(block_start, ancestor_rectangle.top + viewport_gap);
          block_end = Math.min(block_end, ancestor_rectangle.bottom - viewport_gap);
        }
      }
      ancestor = ancestor.parentElement;
    }
    return {
      start: block_start,
      end: Math.max(block_start + 1, block_end)
    };
  }

  /**
   * Keep one open panel inside the browser viewport.
   *
   * @param {HTMLElement} popover Popover root.
   * @param {HTMLElement} panel   Visible panel.
   * @return {void}
   */
  function position_panel(popover, panel) {
    var viewport_gap = 8;
    var panel_offset = 6;
    var block_bounds;
    var block_overflow;
    var panel_rectangle;
    var trigger = popover.querySelector(trigger_selector);
    var trigger_rectangle;
    var available_above;
    var available_below;
    var available_block_size;
    popover.classList.remove('is-panel-edge-left', 'is-panel-edge-right', 'is-panel-edge-top');
    panel.style.removeProperty('--wpbc_shared_ui_popover__available-block-size');
    panel_rectangle = panel.getBoundingClientRect();
    if (panel_rectangle.right > window.innerWidth - viewport_gap) {
      popover.classList.add('is-panel-edge-right');
      panel_rectangle = panel.getBoundingClientRect();
    }
    if (panel_rectangle.left < viewport_gap) {
      popover.classList.remove('is-panel-edge-right');
      popover.classList.add('is-panel-edge-left');
    }
    trigger_rectangle = trigger ? trigger.getBoundingClientRect() : popover.getBoundingClientRect();
    block_bounds = get_block_clipping_bounds(panel, viewport_gap);
    available_above = Math.max(1, trigger_rectangle.top - panel_offset - block_bounds.start);
    available_below = Math.max(1, block_bounds.end - trigger_rectangle.bottom - panel_offset);
    if (panel_rectangle.height > available_below && available_above > available_below) {
      popover.classList.add('is-panel-edge-top');
    }
    available_block_size = popover.classList.contains('is-panel-edge-top') ? available_above : available_below;
    panel.style.setProperty('--wpbc_shared_ui_popover__available-block-size', Math.floor(available_block_size) + 'px');

    // Reconcile line-box and logical-inset differences against the rendered panel.
    panel_rectangle = panel.getBoundingClientRect();
    block_overflow = popover.classList.contains('is-panel-edge-top') ? block_bounds.start - panel_rectangle.top : panel_rectangle.bottom - block_bounds.end;
    if (0 < block_overflow) {
      available_block_size = Math.max(1, available_block_size - Math.ceil(block_overflow));
      panel.style.setProperty('--wpbc_shared_ui_popover__available-block-size', Math.floor(available_block_size) + 'px');
    }
  }

  /**
   * Open one popover without forcing focus away from its trigger.
   *
   * @param {HTMLElement} popover Popover root.
   * @return {void}
   */
  function open_popover(popover) {
    var trigger = popover.querySelector(trigger_selector);
    var panel = popover.querySelector(panel_selector);
    var layer_descriptor;
    if (!trigger || !panel || trigger.disabled) {
      return;
    }
    close_other_popovers(popover);
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    popover.classList.add('is-open');
    position_panel(popover, panel);
    layer_descriptor = declare_layer(popover);
    dispatch_layer_event(layer_open_event, layer_descriptor);
  }

  /**
   * Toggle triggers, close buttons, and outside pointer activation.
   *
   * @param {MouseEvent} event Document click event.
   * @return {void}
   */
  function handle_click(event) {
    var trigger = event.target.closest(trigger_selector);
    var close_button = event.target.closest(close_selector);
    var popover = resolve_event_popover(event.target) || active_external_popover;
    if (close_button && popover) {
      close_popover(popover, true);
      return;
    }
    if (trigger && popover) {
      if (popover.classList.contains('is-open')) {
        close_popover(popover, false);
      } else {
        open_popover(popover);
      }
      return;
    }
    if (!popover) {
      close_other_popovers(null);
    }
  }

  /**
   * Close the active popover with Escape and restore trigger focus.
   *
   * @param {KeyboardEvent} event Document keydown event.
   * @return {void}
   */
  function handle_keydown(event) {
    var popover = resolve_event_popover(event.target);
    if (popover && 'Escape' === event.key && popover.classList.contains('is-open')) {
      event.preventDefault();
      close_popover(popover, true);
    }
  }

  /**
   * Close other panels when keyboard focus moves to another component.
   *
   * @param {FocusEvent} event Document focus event.
   * @return {void}
   */
  function handle_focus_in(event) {
    close_other_popovers(resolve_event_popover(event.target) || active_external_popover);
  }

  /**
   * Reposition open panels after the browser viewport changes.
   *
   * @return {void}
   */
  function handle_resize() {
    Array.prototype.forEach.call(document.querySelectorAll(root_selector + '.is-open'), function (popover) {
      var panel = popover.querySelector(panel_selector);
      if (panel) {
        position_panel(popover, panel);
      }
    });
  }
  document.addEventListener('mousedown', handle_pointer_down, true);
  document.addEventListener('click', handle_click);
  document.addEventListener('keydown', handle_keydown);
  document.addEventListener('focusin', handle_focus_in);
  window.addEventListener('resize', handle_resize);
  Array.prototype.forEach.call(document.querySelectorAll(root_selector), declare_layer);
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3NoYXJlZF91aS9wb3BvdmVyL19vdXQvcG9wb3Zlci5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50Iiwicm9vdF9zZWxlY3RvciIsInRyaWdnZXJfc2VsZWN0b3IiLCJwYW5lbF9zZWxlY3RvciIsImNsb3NlX3NlbGVjdG9yIiwiZXh0ZXJuYWxfb3duZXJfc2VsZWN0b3IiLCJhY3RpdmVfZXh0ZXJuYWxfcG9wb3ZlciIsImV4dGVybmFsX2ludGVyYWN0aW9uX3RpbWVyIiwibGF5ZXJfb3Blbl9ldmVudCIsImxheWVyX2Nsb3NlX2V2ZW50Iiwibm9ybWFsaXplX2xheWVyX2lkIiwiY2FuZGlkYXRlIiwiU3RyaW5nIiwicmVwbGFjZSIsInNsaWNlIiwiZGVjbGFyZV9sYXllciIsInBvcG92ZXIiLCJwYW5lbCIsInF1ZXJ5U2VsZWN0b3IiLCJpbnN0YW5jZV9pZCIsImdldEF0dHJpYnV0ZSIsIm93bmVyX2lkIiwiaW50ZXJhY3Rpb25fZ3JvdXAiLCJkZXNjcmlwdG9yIiwibGF5ZXJfdHlwZSIsImZvckVhY2giLCJsYXllcl9lbGVtZW50Iiwic2V0QXR0cmlidXRlIiwiZGlzcGF0Y2hfbGF5ZXJfZXZlbnQiLCJldmVudF9uYW1lIiwibGF5ZXJfZXZlbnQiLCJpbmRleE9mIiwiQ3VzdG9tRXZlbnQiLCJkZXRhaWwiLCJjcmVhdGVFdmVudCIsImluaXRDdXN0b21FdmVudCIsImRpc3BhdGNoRXZlbnQiLCJmaW5kX3BvcG92ZXJfYnlfaWQiLCJwb3BvdmVyX2lkIiwibWF0Y2hpbmdfcG9wb3ZlciIsIkFycmF5IiwicHJvdG90eXBlIiwic29tZSIsImNhbGwiLCJxdWVyeVNlbGVjdG9yQWxsIiwicmVzb2x2ZV9ldmVudF9wb3BvdmVyIiwidGFyZ2V0IiwiaW5saW5lX3BvcG92ZXIiLCJleHRlcm5hbF9zdXJmYWNlIiwiY2xvc2VzdCIsImhhbmRsZV9wb2ludGVyX2Rvd24iLCJldmVudCIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJjbG9zZV9wb3BvdmVyIiwicmVzdG9yZV9mb2N1cyIsInRyaWdnZXIiLCJ3YXNfb3BlbiIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwibGF5ZXJfZGVzY3JpcHRvciIsImhpZGRlbiIsInN0eWxlIiwicmVtb3ZlUHJvcGVydHkiLCJyZW1vdmUiLCJmb2N1cyIsImNsb3NlX290aGVyX3BvcG92ZXJzIiwicmV0YWluZWRfcG9wb3ZlciIsImdldF9ibG9ja19jbGlwcGluZ19ib3VuZHMiLCJ2aWV3cG9ydF9nYXAiLCJibG9ja19zdGFydCIsImJsb2NrX2VuZCIsIk1hdGgiLCJtYXgiLCJpbm5lckhlaWdodCIsImFuY2VzdG9yIiwicGFyZW50RWxlbWVudCIsImJvZHkiLCJkb2N1bWVudEVsZW1lbnQiLCJhbmNlc3Rvcl9zdHlsZSIsImdldENvbXB1dGVkU3R5bGUiLCJvdmVyZmxvd195Iiwib3ZlcmZsb3dZIiwiYW5jZXN0b3JfcmVjdGFuZ2xlIiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiaGVpZ2h0IiwidG9wIiwibWluIiwiYm90dG9tIiwic3RhcnQiLCJlbmQiLCJwb3NpdGlvbl9wYW5lbCIsInBhbmVsX29mZnNldCIsImJsb2NrX2JvdW5kcyIsImJsb2NrX292ZXJmbG93IiwicGFuZWxfcmVjdGFuZ2xlIiwidHJpZ2dlcl9yZWN0YW5nbGUiLCJhdmFpbGFibGVfYWJvdmUiLCJhdmFpbGFibGVfYmVsb3ciLCJhdmFpbGFibGVfYmxvY2tfc2l6ZSIsInJpZ2h0IiwiaW5uZXJXaWR0aCIsImFkZCIsImxlZnQiLCJzZXRQcm9wZXJ0eSIsImZsb29yIiwiY2VpbCIsIm9wZW5fcG9wb3ZlciIsImRpc2FibGVkIiwiaGFuZGxlX2NsaWNrIiwiY2xvc2VfYnV0dG9uIiwiaGFuZGxlX2tleWRvd24iLCJrZXkiLCJwcmV2ZW50RGVmYXVsdCIsImhhbmRsZV9mb2N1c19pbiIsImhhbmRsZV9yZXNpemUiLCJhZGRFdmVudExpc3RlbmVyIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvX3NoYXJlZF91aS9wb3BvdmVyL19zcmMvcG9wb3Zlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIERvbWFpbi1uZXV0cmFsIHNoYXJlZCBhZG1pbmlzdHJhdGlvbiBwb3BvdmVyIGludGVyYWN0aW9ucy5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKiBAc2luY2UgICAxMi4wLjBcbiAqL1xuKCBmdW5jdGlvbiAoIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgcm9vdF9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXNoYXJlZC11aS1wb3BvdmVyXSc7XG5cdHZhciB0cmlnZ2VyX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtc2hhcmVkLXVpLXBvcG92ZXItdHJpZ2dlcl0nO1xuXHR2YXIgcGFuZWxfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlci1wYW5lbF0nO1xuXHR2YXIgY2xvc2Vfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlci1jbG9zZV0nO1xuXHR2YXIgZXh0ZXJuYWxfb3duZXJfc2VsZWN0b3IgPSAnW2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3Zlci1vd25lcl0nO1xuXHR2YXIgYWN0aXZlX2V4dGVybmFsX3BvcG92ZXIgPSBudWxsO1xuXHR2YXIgZXh0ZXJuYWxfaW50ZXJhY3Rpb25fdGltZXIgPSAwO1xuXHR2YXIgbGF5ZXJfb3Blbl9ldmVudCA9ICd3cGJjOnNoYXJlZC11aS1sYXllci1vcGVuJztcblx0dmFyIGxheWVyX2Nsb3NlX2V2ZW50ID0gJ3dwYmM6c2hhcmVkLXVpLWxheWVyLWNsb3NlJztcblxuXHQvKipcblx0ICogTm9ybWFsaXplIG9uZSBkaXNjbG9zdXJlIGludGVyYWN0aW9uIGlkZW50aWZpZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Kn0gY2FuZGlkYXRlIENhbmRpZGF0ZSBpZGVudGlmaWVyLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEJvdW5kZWQgRE9NLXNhZmUgaWRlbnRpZmllci5cblx0ICovXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9sYXllcl9pZCggY2FuZGlkYXRlICkge1xuXHRcdHJldHVybiBTdHJpbmcoIGNhbmRpZGF0ZSB8fCAnJyApLnJlcGxhY2UoIC9bXkEtWmEtejAtOV8tXS9nLCAnJyApLnNsaWNlKCAwLCAxMjAgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZWNsYXJlIG9uZSBkaXNjbG9zdXJlIHJvb3QgYW5kIHBhbmVsIGFzIGEgc2hhcmVkIGZsb2F0aW5nIGxheWVyLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwb3BvdmVyIFNoYXJlZCBkaXNjbG9zdXJlIHJvb3QuXG5cdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBGb3VyLWtleSBkZXNjcmlwdG9yIG9yIG51bGwgZm9yIGludmFsaWQgbWFya3VwLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjbGFyZV9sYXllciggcG9wb3ZlciApIHtcblx0XHR2YXIgcGFuZWwgPSBwb3BvdmVyICYmIHBvcG92ZXIucXVlcnlTZWxlY3RvciA/IHBvcG92ZXIucXVlcnlTZWxlY3RvciggcGFuZWxfc2VsZWN0b3IgKSA6IG51bGw7XG5cdFx0dmFyIGluc3RhbmNlX2lkID0gbm9ybWFsaXplX2xheWVyX2lkKCBwb3BvdmVyID8gcG9wb3Zlci5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLXBvcG92ZXInICkgOiAnJyApO1xuXHRcdHZhciBvd25lcl9pZCA9IG5vcm1hbGl6ZV9sYXllcl9pZCggcG9wb3ZlciA/IHBvcG92ZXIuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1sYXllci1vd25lcicgKSA6ICcnICkgfHwgaW5zdGFuY2VfaWQ7XG5cdFx0dmFyIGludGVyYWN0aW9uX2dyb3VwID0gbm9ybWFsaXplX2xheWVyX2lkKCBwb3BvdmVyID8gcG9wb3Zlci5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWxheWVyLWludGVyYWN0aW9uLWdyb3VwJyApIDogJycgKSB8fCBpbnN0YW5jZV9pZDtcblx0XHR2YXIgZGVzY3JpcHRvcjtcblxuXHRcdGlmICggISBwb3BvdmVyIHx8ICEgcGFuZWwgfHwgISBpbnN0YW5jZV9pZCApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRkZXNjcmlwdG9yID0ge1xuXHRcdFx0bGF5ZXJfdHlwZTogJ2Rpc2Nsb3N1cmUnLFxuXHRcdFx0aW5zdGFuY2VfaWQ6IGluc3RhbmNlX2lkLFxuXHRcdFx0b3duZXJfaWQ6IG93bmVyX2lkLFxuXHRcdFx0aW50ZXJhY3Rpb25fZ3JvdXA6IGludGVyYWN0aW9uX2dyb3VwXG5cdFx0fTtcblx0XHRbIHBvcG92ZXIsIHBhbmVsIF0uZm9yRWFjaCggZnVuY3Rpb24gKCBsYXllcl9lbGVtZW50ICkge1xuXHRcdFx0bGF5ZXJfZWxlbWVudC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLWxheWVyLXR5cGUnLCBkZXNjcmlwdG9yLmxheWVyX3R5cGUgKTtcblx0XHRcdGxheWVyX2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1sYXllci1pbnN0YW5jZScsIGRlc2NyaXB0b3IuaW5zdGFuY2VfaWQgKTtcblx0XHRcdGxheWVyX2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1sYXllci1vd25lcicsIGRlc2NyaXB0b3Iub3duZXJfaWQgKTtcblx0XHRcdGxheWVyX2VsZW1lbnQuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNoYXJlZC11aS1sYXllci1pbnRlcmFjdGlvbi1ncm91cCcsIGRlc2NyaXB0b3IuaW50ZXJhY3Rpb25fZ3JvdXAgKTtcblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gZGVzY3JpcHRvcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBBbm5vdW5jZSBhIGRpc2Nsb3N1cmUgbGlmZWN5Y2xlIHVzaW5nIGlkZW50aWZpZXItb25seSBtZXRhZGF0YS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50X25hbWUgT3BlbiBvciBjbG9zZSBwcm90b2NvbCBldmVudCBuYW1lLlxuXHQgKiBAcGFyYW0ge09iamVjdH0gZGVzY3JpcHRvciBOb3JtYWxpemVkIGRpc2Nsb3N1cmUgZGVzY3JpcHRvci5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGRpc3BhdGNoX2xheWVyX2V2ZW50KCBldmVudF9uYW1lLCBkZXNjcmlwdG9yICkge1xuXHRcdHZhciBsYXllcl9ldmVudDtcblxuXHRcdGlmICggISBkZXNjcmlwdG9yIHx8IC0xID09PSBbIGxheWVyX29wZW5fZXZlbnQsIGxheWVyX2Nsb3NlX2V2ZW50IF0uaW5kZXhPZiggZXZlbnRfbmFtZSApICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuQ3VzdG9tRXZlbnQgKSB7XG5cdFx0XHRsYXllcl9ldmVudCA9IG5ldyB3aW5kb3cuQ3VzdG9tRXZlbnQoIGV2ZW50X25hbWUsIHsgZGV0YWlsOiBkZXNjcmlwdG9yIH0gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGF5ZXJfZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuXHRcdFx0bGF5ZXJfZXZlbnQuaW5pdEN1c3RvbUV2ZW50KCBldmVudF9uYW1lLCBmYWxzZSwgZmFsc2UsIGRlc2NyaXB0b3IgKTtcblx0XHR9XG5cdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggbGF5ZXJfZXZlbnQgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGaW5kIGEgcmVnaXN0ZXJlZCBwb3BvdmVyIGJ5IGl0cyBzdGFibGUgY29tcG9uZW50IElELlxuXHQgKlxuXHQgKiBJdGVyYXRpb24gYXZvaWRzIHJlcXVpcmluZyBDU1MuZXNjYXBlKCkgaW4gc3VwcG9ydGVkIGxlZ2FjeSBicm93c2Vycy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHBvcG92ZXJfaWQgU3RhYmxlIHBvcG92ZXIgSUQuXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IE1hdGNoaW5nIHBvcG92ZXIgcm9vdCBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gZmluZF9wb3BvdmVyX2J5X2lkKCBwb3BvdmVyX2lkICkge1xuXHRcdHZhciBtYXRjaGluZ19wb3BvdmVyID0gbnVsbDtcblxuXHRcdEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIHJvb3Rfc2VsZWN0b3IgKSwgZnVuY3Rpb24gKCBwb3BvdmVyICkge1xuXHRcdFx0aWYgKCBwb3BvdmVyLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zaGFyZWQtdWktcG9wb3ZlcicgKSA9PT0gcG9wb3Zlcl9pZCApIHtcblx0XHRcdFx0bWF0Y2hpbmdfcG9wb3ZlciA9IHBvcG92ZXI7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0gKTtcblx0XHRyZXR1cm4gbWF0Y2hpbmdfcG9wb3Zlcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXNvbHZlIGEgRE9NIGV2ZW50IHRhcmdldCB0byBpdHMgaW5saW5lIG9yIGV4dGVybmFsbHkgcG9ydGFsZWQgcG9wb3Zlci5cblx0ICpcblx0ICogQHBhcmFtIHtFbGVtZW50fG51bGx9IHRhcmdldCBCcm93c2VyIGV2ZW50IHRhcmdldC5cblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gT3duaW5nIHBvcG92ZXIgcm9vdCBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzb2x2ZV9ldmVudF9wb3BvdmVyKCB0YXJnZXQgKSB7XG5cdFx0dmFyIGlubGluZV9wb3BvdmVyO1xuXHRcdHZhciBleHRlcm5hbF9zdXJmYWNlO1xuXG5cdFx0aWYgKCAhIHRhcmdldCB8fCAhIHRhcmdldC5jbG9zZXN0ICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlubGluZV9wb3BvdmVyID0gdGFyZ2V0LmNsb3Nlc3QoIHJvb3Rfc2VsZWN0b3IgKTtcblx0XHRpZiAoIGlubGluZV9wb3BvdmVyICkge1xuXHRcdFx0cmV0dXJuIGlubGluZV9wb3BvdmVyO1xuXHRcdH1cblx0XHRleHRlcm5hbF9zdXJmYWNlID0gdGFyZ2V0LmNsb3Nlc3QoIGV4dGVybmFsX293bmVyX3NlbGVjdG9yICk7XG5cdFx0aWYgKCAhIGV4dGVybmFsX3N1cmZhY2UgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIGZpbmRfcG9wb3Zlcl9ieV9pZCggZXh0ZXJuYWxfc3VyZmFjZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2hhcmVkLXVpLXBvcG92ZXItb3duZXInICkgfHwgJycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXRhaW4gZXh0ZXJuYWwtc3VyZmFjZSBvd25lcnNoaXAgYWNyb3NzIHBvaW50ZXItaW5kdWNlZCBmb2N1cyBjaGFuZ2VzLlxuXHQgKlxuXHQgKiBQb3J0YWxlZCB3aWRnZXRzIG1heSB0ZW1wb3JhcmlseSBtb3ZlIGZvY3VzIHRvIGJvZHkgYmVmb3JlIHRoZWlyIGNsaWNrXG5cdCAqIGhhbmRsZXIgcmVzdG9yZXMgZm9jdXMuIFRoZSBzaG9ydC1saXZlZCBvd25lciBwcmV2ZW50cyB0aGF0IGludGVybWVkaWF0ZVxuXHQgKiBmb2N1cyB0cmFuc2l0aW9uIGZyb20gYmVpbmcgbWlzdGFrZW4gZm9yIGFuIG91dHNpZGUgaW50ZXJhY3Rpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgQ2FwdHVyaW5nIG1vdXNlZG93biBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGhhbmRsZV9wb2ludGVyX2Rvd24oIGV2ZW50ICkge1xuXHRcdHZhciBleHRlcm5hbF9zdXJmYWNlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QgPyBldmVudC50YXJnZXQuY2xvc2VzdCggZXh0ZXJuYWxfb3duZXJfc2VsZWN0b3IgKSA6IG51bGw7XG5cblx0XHR3aW5kb3cuY2xlYXJUaW1lb3V0KCBleHRlcm5hbF9pbnRlcmFjdGlvbl90aW1lciApO1xuXHRcdGFjdGl2ZV9leHRlcm5hbF9wb3BvdmVyID0gZXh0ZXJuYWxfc3VyZmFjZSA/IHJlc29sdmVfZXZlbnRfcG9wb3ZlciggZXh0ZXJuYWxfc3VyZmFjZSApIDogbnVsbDtcblx0XHRleHRlcm5hbF9pbnRlcmFjdGlvbl90aW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRhY3RpdmVfZXh0ZXJuYWxfcG9wb3ZlciA9IG51bGw7XG5cdFx0fSwgNTAwICk7XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2Ugb25lIHBvcG92ZXIgYW5kIG9wdGlvbmFsbHkgcmVzdG9yZSB0cmlnZ2VyIGZvY3VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwb3BvdmVyICAgICAgUG9wb3ZlciByb290LlxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59ICAgICByZXN0b3JlX2ZvY3VzIFdoZXRoZXIgdG8gZm9jdXMgaXRzIHRyaWdnZXIuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjbG9zZV9wb3BvdmVyKCBwb3BvdmVyLCByZXN0b3JlX2ZvY3VzICkge1xuXHRcdHZhciB0cmlnZ2VyID0gcG9wb3Zlci5xdWVyeVNlbGVjdG9yKCB0cmlnZ2VyX3NlbGVjdG9yICk7XG5cdFx0dmFyIHBhbmVsID0gcG9wb3Zlci5xdWVyeVNlbGVjdG9yKCBwYW5lbF9zZWxlY3RvciApO1xuXHRcdHZhciB3YXNfb3BlbiA9IHBvcG92ZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtb3BlbicgKTtcblx0XHR2YXIgbGF5ZXJfZGVzY3JpcHRvcjtcblxuXHRcdGlmICggISB0cmlnZ2VyIHx8ICEgcGFuZWwgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHBhbmVsLmhpZGRlbiA9IHRydWU7XG5cdFx0cGFuZWwuc3R5bGUucmVtb3ZlUHJvcGVydHkoICctLXdwYmNfc2hhcmVkX3VpX3BvcG92ZXJfX2F2YWlsYWJsZS1ibG9jay1zaXplJyApO1xuXHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICdmYWxzZScgKTtcblx0XHRwb3BvdmVyLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1vcGVuJywgJ2lzLXBhbmVsLWVkZ2UtbGVmdCcsICdpcy1wYW5lbC1lZGdlLXJpZ2h0JywgJ2lzLXBhbmVsLWVkZ2UtdG9wJyApO1xuXHRcdGlmICggd2FzX29wZW4gKSB7XG5cdFx0XHRsYXllcl9kZXNjcmlwdG9yID0gZGVjbGFyZV9sYXllciggcG9wb3ZlciApO1xuXHRcdFx0ZGlzcGF0Y2hfbGF5ZXJfZXZlbnQoIGxheWVyX2Nsb3NlX2V2ZW50LCBsYXllcl9kZXNjcmlwdG9yICk7XG5cdFx0fVxuXHRcdGlmICggcmVzdG9yZV9mb2N1cyApIHtcblx0XHRcdHRyaWdnZXIuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2UgZXZlcnkgb3BlbiBwb3BvdmVyIGV4Y2VwdCBhbiBvcHRpb25hbCByZXRhaW5lZCBpbnN0YW5jZS5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSByZXRhaW5lZF9wb3BvdmVyIFBvcG92ZXIgdGhhdCBtYXkgcmVtYWluIG9wZW4uXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjbG9zZV9vdGhlcl9wb3BvdmVycyggcmV0YWluZWRfcG9wb3ZlciApIHtcblx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCByb290X3NlbGVjdG9yICsgJy5pcy1vcGVuJyApLCBmdW5jdGlvbiAoIHBvcG92ZXIgKSB7XG5cdFx0XHRpZiAoIHBvcG92ZXIgIT09IHJldGFpbmVkX3BvcG92ZXIgKSB7XG5cdFx0XHRcdGNsb3NlX3BvcG92ZXIoIHBvcG92ZXIsIGZhbHNlICk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmUgdGhlIHZpc2libGUgdmVydGljYWwgaW50ZXJ2YWwgc2hhcmVkIGJ5IHRoZSB2aWV3cG9ydCBhbmQgY2xpcHBpbmcgYW5jZXN0b3JzLlxuXHQgKlxuXHQgKiBBYnNvbHV0ZWx5IHBvc2l0aW9uZWQgcGFuZWxzIGNhbiBzdGlsbCBiZSBjbGlwcGVkIGJ5IGFuIGFuY2VzdG9yIHVzaW5nXG5cdCAqIGhpZGRlbiwgY2xpcCwgYXV0bywgb3Igc2Nyb2xsIG92ZXJmbG93LiBNZWFzdXJpbmcgb25seSB3aW5kb3cuaW5uZXJIZWlnaHRcblx0ICogdGhlcmVmb3JlIG92ZXJzdGF0ZXMgdGhlIHVzYWJsZSBoZWlnaHQgb24gYm91bmRlZCBhZG1pbmlzdHJhdGlvbiBzdXJmYWNlcy5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcGFuZWwgICAgICAgIFZpc2libGUgcG9wb3ZlciBwYW5lbC5cblx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgdmlld3BvcnRfZ2FwIFJlcXVpcmVkIGdhcCBmcm9tIGV2ZXJ5IGNsaXBwaW5nIGVkZ2UuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gTnVtZXJpYyBzdGFydCBhbmQgZW5kIHZpZXdwb3J0IGNvb3JkaW5hdGVzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X2Jsb2NrX2NsaXBwaW5nX2JvdW5kcyggcGFuZWwsIHZpZXdwb3J0X2dhcCApIHtcblx0XHR2YXIgYmxvY2tfc3RhcnQgPSB2aWV3cG9ydF9nYXA7XG5cdFx0dmFyIGJsb2NrX2VuZCA9IE1hdGgubWF4KCB2aWV3cG9ydF9nYXAgKyAxLCB3aW5kb3cuaW5uZXJIZWlnaHQgLSB2aWV3cG9ydF9nYXAgKTtcblx0XHR2YXIgYW5jZXN0b3IgPSBwYW5lbC5wYXJlbnRFbGVtZW50O1xuXG5cdFx0d2hpbGUgKCBhbmNlc3RvciAmJiBhbmNlc3RvciAhPT0gZG9jdW1lbnQuYm9keSAmJiBhbmNlc3RvciAhPT0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICkge1xuXHRcdFx0dmFyIGFuY2VzdG9yX3N0eWxlID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUgPyB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSggYW5jZXN0b3IgKSA6IG51bGw7XG5cdFx0XHR2YXIgb3ZlcmZsb3dfeSA9IGFuY2VzdG9yX3N0eWxlID8gU3RyaW5nKCBhbmNlc3Rvcl9zdHlsZS5vdmVyZmxvd1kgfHwgJycgKSA6ICcnO1xuXHRcdFx0dmFyIGFuY2VzdG9yX3JlY3RhbmdsZTtcblxuXHRcdFx0aWYgKCAtMSAhPT0gWyAnYXV0bycsICdjbGlwJywgJ2hpZGRlbicsICdzY3JvbGwnIF0uaW5kZXhPZiggb3ZlcmZsb3dfeSApICkge1xuXHRcdFx0XHRhbmNlc3Rvcl9yZWN0YW5nbGUgPSBhbmNlc3Rvci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0aWYgKCAwIDwgYW5jZXN0b3JfcmVjdGFuZ2xlLmhlaWdodCApIHtcblx0XHRcdFx0XHRibG9ja19zdGFydCA9IE1hdGgubWF4KCBibG9ja19zdGFydCwgYW5jZXN0b3JfcmVjdGFuZ2xlLnRvcCArIHZpZXdwb3J0X2dhcCApO1xuXHRcdFx0XHRcdGJsb2NrX2VuZCA9IE1hdGgubWluKCBibG9ja19lbmQsIGFuY2VzdG9yX3JlY3RhbmdsZS5ib3R0b20gLSB2aWV3cG9ydF9nYXAgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YW5jZXN0b3IgPSBhbmNlc3Rvci5wYXJlbnRFbGVtZW50O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzdGFydDogYmxvY2tfc3RhcnQsXG5cdFx0XHRlbmQ6IE1hdGgubWF4KCBibG9ja19zdGFydCArIDEsIGJsb2NrX2VuZCApXG5cdFx0fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBLZWVwIG9uZSBvcGVuIHBhbmVsIGluc2lkZSB0aGUgYnJvd3NlciB2aWV3cG9ydC5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcG9wb3ZlciBQb3BvdmVyIHJvb3QuXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsICAgVmlzaWJsZSBwYW5lbC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHBvc2l0aW9uX3BhbmVsKCBwb3BvdmVyLCBwYW5lbCApIHtcblx0XHR2YXIgdmlld3BvcnRfZ2FwID0gODtcblx0XHR2YXIgcGFuZWxfb2Zmc2V0ID0gNjtcblx0XHR2YXIgYmxvY2tfYm91bmRzO1xuXHRcdHZhciBibG9ja19vdmVyZmxvdztcblx0XHR2YXIgcGFuZWxfcmVjdGFuZ2xlO1xuXHRcdHZhciB0cmlnZ2VyID0gcG9wb3Zlci5xdWVyeVNlbGVjdG9yKCB0cmlnZ2VyX3NlbGVjdG9yICk7XG5cdFx0dmFyIHRyaWdnZXJfcmVjdGFuZ2xlO1xuXHRcdHZhciBhdmFpbGFibGVfYWJvdmU7XG5cdFx0dmFyIGF2YWlsYWJsZV9iZWxvdztcblx0XHR2YXIgYXZhaWxhYmxlX2Jsb2NrX3NpemU7XG5cblx0XHRwb3BvdmVyLmNsYXNzTGlzdC5yZW1vdmUoICdpcy1wYW5lbC1lZGdlLWxlZnQnLCAnaXMtcGFuZWwtZWRnZS1yaWdodCcsICdpcy1wYW5lbC1lZGdlLXRvcCcgKTtcblx0XHRwYW5lbC5zdHlsZS5yZW1vdmVQcm9wZXJ0eSggJy0td3BiY19zaGFyZWRfdWlfcG9wb3Zlcl9fYXZhaWxhYmxlLWJsb2NrLXNpemUnICk7XG5cdFx0cGFuZWxfcmVjdGFuZ2xlID0gcGFuZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0aWYgKCBwYW5lbF9yZWN0YW5nbGUucmlnaHQgPiB3aW5kb3cuaW5uZXJXaWR0aCAtIHZpZXdwb3J0X2dhcCApIHtcblx0XHRcdHBvcG92ZXIuY2xhc3NMaXN0LmFkZCggJ2lzLXBhbmVsLWVkZ2UtcmlnaHQnICk7XG5cdFx0XHRwYW5lbF9yZWN0YW5nbGUgPSBwYW5lbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHR9XG5cdFx0aWYgKCBwYW5lbF9yZWN0YW5nbGUubGVmdCA8IHZpZXdwb3J0X2dhcCApIHtcblx0XHRcdHBvcG92ZXIuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXBhbmVsLWVkZ2UtcmlnaHQnICk7XG5cdFx0XHRwb3BvdmVyLmNsYXNzTGlzdC5hZGQoICdpcy1wYW5lbC1lZGdlLWxlZnQnICk7XG5cdFx0fVxuXHRcdHRyaWdnZXJfcmVjdGFuZ2xlID0gdHJpZ2dlciA/IHRyaWdnZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkgOiBwb3BvdmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGJsb2NrX2JvdW5kcyA9IGdldF9ibG9ja19jbGlwcGluZ19ib3VuZHMoIHBhbmVsLCB2aWV3cG9ydF9nYXAgKTtcblx0XHRhdmFpbGFibGVfYWJvdmUgPSBNYXRoLm1heCggMSwgdHJpZ2dlcl9yZWN0YW5nbGUudG9wIC0gcGFuZWxfb2Zmc2V0IC0gYmxvY2tfYm91bmRzLnN0YXJ0ICk7XG5cdFx0YXZhaWxhYmxlX2JlbG93ID0gTWF0aC5tYXgoIDEsIGJsb2NrX2JvdW5kcy5lbmQgLSB0cmlnZ2VyX3JlY3RhbmdsZS5ib3R0b20gLSBwYW5lbF9vZmZzZXQgKTtcblx0XHRpZiAoIHBhbmVsX3JlY3RhbmdsZS5oZWlnaHQgPiBhdmFpbGFibGVfYmVsb3cgJiYgYXZhaWxhYmxlX2Fib3ZlID4gYXZhaWxhYmxlX2JlbG93ICkge1xuXHRcdFx0cG9wb3Zlci5jbGFzc0xpc3QuYWRkKCAnaXMtcGFuZWwtZWRnZS10b3AnICk7XG5cdFx0fVxuXHRcdGF2YWlsYWJsZV9ibG9ja19zaXplID0gcG9wb3Zlci5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1wYW5lbC1lZGdlLXRvcCcgKSA/IGF2YWlsYWJsZV9hYm92ZSA6IGF2YWlsYWJsZV9iZWxvdztcblx0XHRwYW5lbC5zdHlsZS5zZXRQcm9wZXJ0eSggJy0td3BiY19zaGFyZWRfdWlfcG9wb3Zlcl9fYXZhaWxhYmxlLWJsb2NrLXNpemUnLCBNYXRoLmZsb29yKCBhdmFpbGFibGVfYmxvY2tfc2l6ZSApICsgJ3B4JyApO1xuXG5cdFx0Ly8gUmVjb25jaWxlIGxpbmUtYm94IGFuZCBsb2dpY2FsLWluc2V0IGRpZmZlcmVuY2VzIGFnYWluc3QgdGhlIHJlbmRlcmVkIHBhbmVsLlxuXHRcdHBhbmVsX3JlY3RhbmdsZSA9IHBhbmVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdGJsb2NrX292ZXJmbG93ID0gcG9wb3Zlci5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1wYW5lbC1lZGdlLXRvcCcgKVxuXHRcdFx0PyBibG9ja19ib3VuZHMuc3RhcnQgLSBwYW5lbF9yZWN0YW5nbGUudG9wXG5cdFx0XHQ6IHBhbmVsX3JlY3RhbmdsZS5ib3R0b20gLSBibG9ja19ib3VuZHMuZW5kO1xuXHRcdGlmICggMCA8IGJsb2NrX292ZXJmbG93ICkge1xuXHRcdFx0YXZhaWxhYmxlX2Jsb2NrX3NpemUgPSBNYXRoLm1heCggMSwgYXZhaWxhYmxlX2Jsb2NrX3NpemUgLSBNYXRoLmNlaWwoIGJsb2NrX292ZXJmbG93ICkgKTtcblx0XHRcdHBhbmVsLnN0eWxlLnNldFByb3BlcnR5KCAnLS13cGJjX3NoYXJlZF91aV9wb3BvdmVyX19hdmFpbGFibGUtYmxvY2stc2l6ZScsIE1hdGguZmxvb3IoIGF2YWlsYWJsZV9ibG9ja19zaXplICkgKyAncHgnICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIE9wZW4gb25lIHBvcG92ZXIgd2l0aG91dCBmb3JjaW5nIGZvY3VzIGF3YXkgZnJvbSBpdHMgdHJpZ2dlci5cblx0ICpcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gcG9wb3ZlciBQb3BvdmVyIHJvb3QuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX3BvcG92ZXIoIHBvcG92ZXIgKSB7XG5cdFx0dmFyIHRyaWdnZXIgPSBwb3BvdmVyLnF1ZXJ5U2VsZWN0b3IoIHRyaWdnZXJfc2VsZWN0b3IgKTtcblx0XHR2YXIgcGFuZWwgPSBwb3BvdmVyLnF1ZXJ5U2VsZWN0b3IoIHBhbmVsX3NlbGVjdG9yICk7XG5cdFx0dmFyIGxheWVyX2Rlc2NyaXB0b3I7XG5cblx0XHRpZiAoICEgdHJpZ2dlciB8fCAhIHBhbmVsIHx8IHRyaWdnZXIuZGlzYWJsZWQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNsb3NlX290aGVyX3BvcG92ZXJzKCBwb3BvdmVyICk7XG5cdFx0cGFuZWwuaGlkZGVuID0gZmFsc2U7XG5cdFx0dHJpZ2dlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0cG9wb3Zlci5jbGFzc0xpc3QuYWRkKCAnaXMtb3BlbicgKTtcblx0XHRwb3NpdGlvbl9wYW5lbCggcG9wb3ZlciwgcGFuZWwgKTtcblx0XHRsYXllcl9kZXNjcmlwdG9yID0gZGVjbGFyZV9sYXllciggcG9wb3ZlciApO1xuXHRcdGRpc3BhdGNoX2xheWVyX2V2ZW50KCBsYXllcl9vcGVuX2V2ZW50LCBsYXllcl9kZXNjcmlwdG9yICk7XG5cdH1cblxuXHQvKipcblx0ICogVG9nZ2xlIHRyaWdnZXJzLCBjbG9zZSBidXR0b25zLCBhbmQgb3V0c2lkZSBwb2ludGVyIGFjdGl2YXRpb24uXG5cdCAqXG5cdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgRG9jdW1lbnQgY2xpY2sgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGV2ZW50ICkge1xuXHRcdHZhciB0cmlnZ2VyID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIHRyaWdnZXJfc2VsZWN0b3IgKTtcblx0XHR2YXIgY2xvc2VfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoIGNsb3NlX3NlbGVjdG9yICk7XG5cdFx0dmFyIHBvcG92ZXIgPSByZXNvbHZlX2V2ZW50X3BvcG92ZXIoIGV2ZW50LnRhcmdldCApIHx8IGFjdGl2ZV9leHRlcm5hbF9wb3BvdmVyO1xuXG5cdFx0aWYgKCBjbG9zZV9idXR0b24gJiYgcG9wb3ZlciApIHtcblx0XHRcdGNsb3NlX3BvcG92ZXIoIHBvcG92ZXIsIHRydWUgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCB0cmlnZ2VyICYmIHBvcG92ZXIgKSB7XG5cdFx0XHRpZiAoIHBvcG92ZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCAnaXMtb3BlbicgKSApIHtcblx0XHRcdFx0Y2xvc2VfcG9wb3ZlciggcG9wb3ZlciwgZmFsc2UgKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9wZW5fcG9wb3ZlciggcG9wb3ZlciApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoICEgcG9wb3ZlciApIHtcblx0XHRcdGNsb3NlX290aGVyX3BvcG92ZXJzKCBudWxsICk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENsb3NlIHRoZSBhY3RpdmUgcG9wb3ZlciB3aXRoIEVzY2FwZSBhbmQgcmVzdG9yZSB0cmlnZ2VyIGZvY3VzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGV2ZW50IERvY3VtZW50IGtleWRvd24gZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0dmFyIHBvcG92ZXIgPSByZXNvbHZlX2V2ZW50X3BvcG92ZXIoIGV2ZW50LnRhcmdldCApO1xuXG5cdFx0aWYgKCBwb3BvdmVyICYmICdFc2NhcGUnID09PSBldmVudC5rZXkgJiYgcG9wb3Zlci5jbGFzc0xpc3QuY29udGFpbnMoICdpcy1vcGVuJyApICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlX3BvcG92ZXIoIHBvcG92ZXIsIHRydWUgKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2Ugb3RoZXIgcGFuZWxzIHdoZW4ga2V5Ym9hcmQgZm9jdXMgbW92ZXMgdG8gYW5vdGhlciBjb21wb25lbnQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7Rm9jdXNFdmVudH0gZXZlbnQgRG9jdW1lbnQgZm9jdXMgZXZlbnQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoYW5kbGVfZm9jdXNfaW4oIGV2ZW50ICkge1xuXHRcdGNsb3NlX290aGVyX3BvcG92ZXJzKCByZXNvbHZlX2V2ZW50X3BvcG92ZXIoIGV2ZW50LnRhcmdldCApIHx8IGFjdGl2ZV9leHRlcm5hbF9wb3BvdmVyICk7XG5cdH1cblxuXHQvKipcblx0ICogUmVwb3NpdGlvbiBvcGVuIHBhbmVscyBhZnRlciB0aGUgYnJvd3NlciB2aWV3cG9ydCBjaGFuZ2VzLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gaGFuZGxlX3Jlc2l6ZSgpIHtcblx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCByb290X3NlbGVjdG9yICsgJy5pcy1vcGVuJyApLCBmdW5jdGlvbiAoIHBvcG92ZXIgKSB7XG5cdFx0XHR2YXIgcGFuZWwgPSBwb3BvdmVyLnF1ZXJ5U2VsZWN0b3IoIHBhbmVsX3NlbGVjdG9yICk7XG5cblx0XHRcdGlmICggcGFuZWwgKSB7XG5cdFx0XHRcdHBvc2l0aW9uX3BhbmVsKCBwb3BvdmVyLCBwYW5lbCApO1xuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCBoYW5kbGVfcG9pbnRlcl9kb3duLCB0cnVlICk7XG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9rZXlkb3duICk7XG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgaGFuZGxlX2ZvY3VzX2luICk7XG5cdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAncmVzaXplJywgaGFuZGxlX3Jlc2l6ZSApO1xuXHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCByb290X3NlbGVjdG9yICksIGRlY2xhcmVf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
