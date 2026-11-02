"use strict";

/**
 * Timeline row rendering and synchronized Resource/canvas row mechanics.
 *
 * The page controller remains authoritative for cached-window composition,
 * axis geometry, navigation, and requests. This focused module mounts the
 * already-authorized Resource and booking DTOs through fixed WordPress
 * templates, applies presentation-only hierarchy state, and keeps both halves
 * of each rendered row at the same height.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */
(function (window, document) {
  'use strict';

  var module_id = 'rendering';

  /**
   * Create one Timeline rendering controller.
   *
   * @param {Object} context Controller-owned DOM, settings, template, booking,
   *                         and post-layout callbacks.
   * @return {Object} Rendering and row-synchronization lifecycle API.
   */
  function create_rendering_controller(context) {
    var mount = context.mount || null;
    var settings = context.settings || {};
    var get_template = 'function' === typeof context.get_template ? context.get_template : function () {
      return null;
    };
    var begin_booking_refresh = 'function' === typeof context.begin_booking_refresh ? context.begin_booking_refresh : function () {};
    var register_booking_segment = 'function' === typeof context.register_booking_segment ? context.register_booking_segment : function () {};
    var complete_booking_refresh = 'function' === typeof context.complete_booking_refresh ? context.complete_booking_refresh : function () {};
    var after_row_synchronization = 'function' === typeof context.after_row_synchronization ? context.after_row_synchronization : function () {};
    var is_host_active = 'function' === typeof context.is_host_active ? context.is_host_active : function () {
      return true;
    };
    var row_observer = null;
    var mutation_observer = null;
    var row_synchronization_initialized = false;
    var observed_row_elements = new window.WeakSet();
    var expected_row_heights = new window.WeakMap();
    var pending_row_keys = {};
    var synchronize_all_rows = false;
    var synchronization_frame = 0;
    var lifecycle_generation = 0;
    var authorized_presentations_by_resource = {};
    var authorized_resource_ids_in_order = [];
    var open_presentations_by_resource = {};
    var resource_children_by_parent = {};
    var resource_titles_by_id = {};

    /**
     * Normalize server-authorized executable-free presentation descriptors.
     *
     * Browser normalization is defensive only. The PHP registry remains the
     * authority that decides which descriptors reach each Resource DTO.
     *
     * @param {Array<Object>} descriptors Candidate Resource descriptors.
     * @return {Array<Object>} Safe ordered descriptors.
     */
    function normalize_row_presentations(descriptors) {
      var stable_identifier = /^[a-z][a-z0-9_]{0,63}$/;
      var seen_ids = {};
      return (Array.isArray(descriptors) ? descriptors : []).filter(function (descriptor) {
        var presentation_id = descriptor && 'string' === typeof descriptor.id ? descriptor.id : '';
        var template_key = descriptor && 'string' === typeof descriptor.template_key ? descriptor.template_key : '';
        if (!stable_identifier.test(presentation_id) || !stable_identifier.test(template_key) || 'string' !== typeof descriptor.label || !descriptor.label.trim() || seen_ids[presentation_id]) {
          return false;
        }
        seen_ids[presentation_id] = true;
        return true;
      }).map(function (descriptor) {
        return {
          id: descriptor.id,
          label: descriptor.label,
          template_key: descriptor.template_key,
          is_exclusive: true === descriptor.is_exclusive,
          is_read_only: true === descriptor.is_read_only,
          toggle_open_label: 'string' === typeof descriptor.toggle_open_label ? descriptor.toggle_open_label : '',
          toggle_close_label: 'string' === typeof descriptor.toggle_close_label ? descriptor.toggle_close_label : ''
        };
      });
    }

    /**
     * Emit one neutral presentation-host lifecycle event.
     *
     * @param {string} event_name     Lifecycle suffix.
     * @param {number} resource_id    Authorized Resource ID.
     * @param {Object} descriptor     Registered neutral descriptor.
     * @param {Object} additional     Optional event details.
     * @return {void}
     */
    function emit_row_presentation_event(event_name, resource_id, descriptor, additional) {
      var event_detail;
      var lifecycle_event;
      if (!mount || 'function' !== typeof mount.dispatchEvent) {
        return;
      }
      event_detail = Object.assign({
        resource_id: resource_id,
        presentation_id: descriptor.id,
        template_key: descriptor.template_key,
        descriptor: Object.assign({}, descriptor),
        hosts: get_row_presentation_hosts(resource_id, descriptor.id)
      }, additional || {});
      if ('function' === typeof window.CustomEvent) {
        lifecycle_event = new window.CustomEvent('wpbc:timeline:row-presentation:' + event_name, {
          detail: event_detail
        });
      } else if (document.createEvent) {
        lifecycle_event = document.createEvent('CustomEvent');
        lifecycle_event.initCustomEvent('wpbc:timeline:row-presentation:' + event_name, false, false, event_detail);
      }
      if (lifecycle_event) {
        mount.dispatchEvent(lifecycle_event);
      }
    }

    /**
     * Return synchronized Resource/canvas hosts for one presentation.
     *
     * @param {number} resource_id    Authorized Resource ID.
     * @param {string} presentation_id Stable presentation ID.
     * @return {Element[]} Current presentation hosts.
     */
    function get_row_presentation_hosts(resource_id, presentation_id) {
      var hosts = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-presentation-host]') : [];
      return Array.prototype.filter.call(hosts, function (host) {
        return Number(host.getAttribute('data-wpbc-timeline-resource-id')) === Number(resource_id) && host.getAttribute('data-wpbc-timeline-row-presentation-host') === presentation_id;
      });
    }

    /**
     * Return one current presentation toggle without trusting a CSS fragment.
     *
     * @param {number} resource_id     Authorized Resource ID.
     * @param {string} presentation_id Stable presentation ID.
     * @return {Element|null} Matching toggle or null.
     */
    function get_row_presentation_toggle(resource_id, presentation_id) {
      var toggles = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-presentation-toggle]') : [];
      return Array.prototype.filter.call(toggles, function (toggle) {
        return Number(toggle.getAttribute('data-wpbc-timeline-resource-id')) === Number(resource_id) && toggle.getAttribute('data-wpbc-timeline-row-presentation-toggle') === presentation_id;
      })[0] || null;
    }

    /**
     * Return an allow-listed descriptor for one current Resource.
     *
     * @param {number} resource_id     Authorized Resource ID.
     * @param {string} presentation_id Stable presentation ID.
     * @return {Object|null} Descriptor or null.
     */
    function get_authorized_row_presentation(resource_id, presentation_id) {
      var descriptors = authorized_presentations_by_resource[Number(resource_id)] || [];
      return descriptors.filter(function (descriptor) {
        return descriptor.id === presentation_id;
      })[0] || null;
    }

    /**
     * Return whether a presentation is currently open for one Resource.
     *
     * @param {number} resource_id     Authorized Resource ID.
     * @param {string} presentation_id Stable presentation ID.
     * @return {boolean} True when open.
     */
    function is_row_presentation_open(resource_id, presentation_id) {
      return Boolean(open_presentations_by_resource[Number(resource_id)] && open_presentations_by_resource[Number(resource_id)][presentation_id]);
    }

    /**
     * Return the authorized Resource scope controlled by one row toggle.
     *
     * A leaf controls only itself. A neutral hierarchy parent controls itself
     * and every currently authorized descendant that exposes the descriptor.
     * This remains independent from whether child rows are visually collapsed.
     *
     * @param {number} resource_id Parent or leaf Resource ID.
     * @param {string} presentation_id Registered presentation ID.
     * @return {Array<number>} Ordered authorized Resource IDs.
     */
    function get_row_presentation_scope_resource_ids(resource_id, presentation_id) {
      var pending_ids = [Number(resource_id)];
      var seen_ids = {};
      var controlled_ids = [];
      while (pending_ids.length) {
        resource_id = Number(pending_ids.shift());
        if (!resource_id || seen_ids[resource_id]) {
          continue;
        }
        seen_ids[resource_id] = true;
        if (get_authorized_row_presentation(resource_id, presentation_id)) {
          controlled_ids.push(resource_id);
        }
        (resource_children_by_parent[resource_id] || []).forEach(function (child_id) {
          pending_ids.push(child_id);
        });
      }
      return controlled_ids;
    }

    /**
     * Interpolate one translated neutral presentation-control label.
     *
     * @param {string} pattern Translated string with named placeholders.
     * @param {Object} values Plain replacement values.
     * @return {string} Interpolated label.
     */
    function interpolate_presentation_label(pattern, values) {
      Object.keys(values || {}).forEach(function (key) {
        pattern = String(pattern || '').replace(new RegExp('\\{' + key + '\\}', 'g'), String(values[key]));
      });
      return String(pattern || '');
    }

    /**
     * Build the current accessible state for one row presentation toggle.
     *
     * @param {number} resource_id Authorized Resource ID.
     * @param {Object} descriptor Registered neutral descriptor.
     * @return {Object} Toggle state and controlled host identities.
     */
    function get_row_presentation_toggle_state(resource_id, descriptor) {
      var controlled_resource_ids = get_row_presentation_scope_resource_ids(resource_id, descriptor.id);
      var controls_group = 1 < controlled_resource_ids.length;
      var is_open = 0 < controlled_resource_ids.length && controlled_resource_ids.every(function (controlled_resource_id) {
        return is_row_presentation_open(controlled_resource_id, descriptor.id);
      });
      var label_key = controls_group ? is_open ? 'hide_resource_group_presentation' : 'show_resource_group_presentation' : is_open ? 'hide_resource_presentation' : 'show_resource_presentation';
      var fallback_label = descriptor.label;
      var controlled_host_ids = [];
      controlled_resource_ids.forEach(function (controlled_resource_id) {
        controlled_host_ids.push('wpbc_timeline_row_presentation_resource_' + controlled_resource_id + '_' + descriptor.id);
        controlled_host_ids.push('wpbc_timeline_row_presentation_canvas_' + controlled_resource_id + '_' + descriptor.id);
      });
      return {
        is_open: is_open,
        controls_group: controls_group,
        controlled_resource_ids: controlled_resource_ids,
        controlled_host_ids: controlled_host_ids.join(' '),
        accessible_label: interpolate_presentation_label(settings.i18n && settings.i18n[label_key] ? settings.i18n[label_key] : fallback_label, {
          label: descriptor.label,
          resource: resource_titles_by_id[Number(resource_id)] || ''
        })
      };
    }

    /**
     * Refresh every rendered control affected by presentation state changes.
     *
     * @param {string} presentation_id Registered presentation ID.
     * @return {void}
     */
    function synchronize_row_presentation_toggles(presentation_id) {
      var toggles = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-presentation-toggle]') : [];
      Array.prototype.forEach.call(toggles, function (toggle) {
        var resource_id;
        var descriptor;
        var toggle_state;
        var icon;
        if (toggle.getAttribute('data-wpbc-timeline-row-presentation-toggle') !== presentation_id) {
          return;
        }
        resource_id = Number(toggle.getAttribute('data-wpbc-timeline-resource-id'));
        descriptor = get_authorized_row_presentation(resource_id, presentation_id);
        if (!descriptor) {
          return;
        }
        toggle_state = get_row_presentation_toggle_state(resource_id, descriptor);
        toggle.setAttribute('aria-expanded', toggle_state.is_open ? 'true' : 'false');
        toggle.setAttribute('aria-controls', toggle_state.controlled_host_ids);
        toggle.setAttribute('aria-label', toggle_state.accessible_label);
        toggle.setAttribute('title', toggle_state.accessible_label);
        icon = toggle.querySelector('[class*="wpbc-bi-chevron-"]');
        if (icon) {
          icon.classList.remove('wpbc-bi-chevron-right', 'wpbc-bi-chevron-down');
          icon.classList.add(toggle_state.is_open ? 'wpbc-bi-chevron-down' : 'wpbc-bi-chevron-right');
        }
      });
    }

    /**
     * Reconcile retained open state against the latest authorized Resource DTOs.
     *
     * @param {Array<Object>} resources Latest authorized Resource DTOs.
     * @return {void}
     */
    function reconcile_row_presentations(resources) {
      var next_authorized = {};
      var next_resource_ids_in_order = [];
      var next_children_by_parent = {};
      var next_titles_by_id = {};
      resources.forEach(function (resource) {
        var resource_id = Math.max(0, Math.round(Number(resource && resource.id) || 0));
        var parent_id = Math.max(0, Math.round(Number(resource && resource.parent_id) || 0));
        if (resource_id) {
          next_authorized[resource_id] = normalize_row_presentations(resource.row_presentations);
          next_resource_ids_in_order.push(resource_id);
          next_titles_by_id[resource_id] = String(resource.title || '');
          if (parent_id) {
            if (!next_children_by_parent[parent_id]) {
              next_children_by_parent[parent_id] = [];
            }
            next_children_by_parent[parent_id].push(resource_id);
          }
        }
      });
      Object.keys(open_presentations_by_resource).forEach(function (resource_id_key) {
        var resource_id = Number(resource_id_key);
        Object.keys(open_presentations_by_resource[resource_id] || {}).forEach(function (presentation_id) {
          var next_descriptor = (next_authorized[resource_id] || []).filter(function (descriptor) {
            return descriptor.id === presentation_id;
          })[0];
          var previous_descriptor = get_authorized_row_presentation(resource_id, presentation_id);
          if (!next_descriptor) {
            emit_row_presentation_event('removed', resource_id, previous_descriptor || {
              id: presentation_id,
              template_key: ''
            });
            delete open_presentations_by_resource[resource_id][presentation_id];
          }
        });
        if (!Object.keys(open_presentations_by_resource[resource_id] || {}).length) {
          delete open_presentations_by_resource[resource_id];
        }
      });
      authorized_presentations_by_resource = next_authorized;
      authorized_resource_ids_in_order = next_resource_ids_in_order;
      resource_children_by_parent = next_children_by_parent;
      resource_titles_by_id = next_titles_by_id;
    }

    /**
     * Capture focus identity before template-owned row replacement.
     *
     * @return {Object|null} Stable toggle identity or null.
     */
    function capture_row_presentation_focus() {
      var active_element = document.activeElement;
      var toggle = active_element && active_element.closest ? active_element.closest('[data-wpbc-timeline-row-presentation-toggle]') : null;
      return toggle ? {
        resource_id: Number(toggle.getAttribute('data-wpbc-timeline-resource-id')),
        presentation_id: toggle.getAttribute('data-wpbc-timeline-row-presentation-toggle')
      } : null;
    }

    /**
     * Restore focus to the equivalent authorized toggle after a rerender.
     *
     * @param {Object|null} focus_identity Captured toggle identity.
     * @return {void}
     */
    function restore_row_presentation_focus(focus_identity) {
      var toggle = focus_identity ? get_row_presentation_toggle(focus_identity.resource_id, focus_identity.presentation_id) : null;
      if (toggle && 'function' === typeof toggle.focus) {
        toggle.focus();
      }
    }

    /**
     * Deduplicate stable booking spans when adjacent windows overlap.
     *
     * Recurrent or discontinuous spans retain distinct stable segment IDs;
     * only a repeated projection of the same segment is discarded.
     *
     * @param {Array<Object>} segments Booking segments from composed windows.
     * @return {Array<Object>} First occurrence of every stable segment ID.
     */
    function deduplicate_segments(segments) {
      var seen_segment_ids = {};
      return segments.filter(function (segment) {
        var segment_id = segment && segment.segment_id ? String(segment.segment_id) : '';
        if (!segment_id || seen_segment_ids[segment_id]) {
          return false;
        }
        seen_segment_ids[segment_id] = true;
        return true;
      });
    }

    /**
     * Apply stable white/gray banding to currently visible Timeline rows.
     *
     * Hidden hierarchy rows are excluded so collapsing a capacity parent does
     * not leave adjacent visible rows with the same presentation band.
     *
     * @return {void}
     */
    function update_visible_row_striping() {
      var visible_row_index = 0;
      var canvas_rows = mount ? mount.querySelectorAll('.wpbc_timeline__canvas_row') : [];
      Array.prototype.forEach.call(canvas_rows, function (canvas_row) {
        canvas_row.classList.remove('is-odd', 'is-even');
        if (canvas_row.hidden) {
          return;
        }
        canvas_row.classList.add(0 === visible_row_index % 2 ? 'is-odd' : 'is-even');
        visible_row_index += 1;
      });
    }

    /**
     * Retain one browser-owned Resource expansion state across complete renders.
     *
     * Window-cache composition replaces both row halves from templates. Keeping
     * the exact positive Resource IDs in the shared settings object prevents a
     * later cache promotion from restoring an older server preference snapshot.
     *
     * @param {string}  preference_key Expanded Resource preference key.
     * @param {number}  resource_id    Authorized Resource ID.
     * @param {boolean} is_expanded    Desired browser presentation state.
     * @return {void}
     */
    function retain_expansion_state(preference_key, resource_id, is_expanded) {
      var retained_ids;
      resource_id = Math.max(0, Math.round(Number(resource_id) || 0));
      if (!resource_id) {
        return;
      }
      if (!settings.preferences || 'object' !== typeof settings.preferences) {
        settings.preferences = {};
      }
      retained_ids = (Array.isArray(settings.preferences[preference_key]) ? settings.preferences[preference_key] : []).map(function (retained_id) {
        return Math.max(0, Math.round(Number(retained_id) || 0));
      }).filter(function (retained_id, retained_index, all_retained_ids) {
        return retained_id && retained_id !== resource_id && retained_index === all_retained_ids.indexOf(retained_id);
      });
      if (is_expanded) {
        retained_ids.push(resource_id);
      }
      retained_ids.sort(function (left_id, right_id) {
        return left_id - right_id;
      });
      settings.preferences[preference_key] = retained_ids;
    }

    /**
     * Stop observing rows that are about to be replaced by a complete render.
     *
     * @return {void}
     */
    function reset_row_observations() {
      if (row_observer) {
        row_observer.disconnect();
      }
      observed_row_elements = new window.WeakSet();
      expected_row_heights = new window.WeakMap();
    }

    /**
     * Render authorized Resource rows and booking cards through templates.
     *
     * The method preserves server/composition-owned lane indexes and counts.
     * It never calculates booking collisions or constructs complete markup.
     *
     * @param {Object} initial Authorized Resource and segment presentation DTOs.
     * @return {boolean} True when at least one Resource row was rendered.
     */
    function render_rows(initial) {
      initial = initial || {};
      var resources = Array.isArray(initial.resources) ? initial.resources : [];
      var presentation_focus = capture_row_presentation_focus();
      var segments = deduplicate_segments(Array.isArray(initial.segments) ? initial.segments : []);
      var time_slot_overflows = Array.isArray(initial.time_slot_overflows) ? initial.time_slot_overflows : [];
      var details_expanded_ids = Array.isArray(settings.preferences && settings.preferences.expanded_resource_ids) ? settings.preferences.expanded_resource_ids : [];
      var hierarchy_expanded_ids = Array.isArray(settings.preferences && settings.preferences.expanded_parent_ids) ? settings.preferences.expanded_parent_ids : [];
      var details_expanded_map = {};
      var hierarchy_expanded_map = {};
      var resource_summaries_by_id = {};
      var resource_host = mount ? mount.querySelector('[data-wpbc-timeline-resource-rows]') : null;
      var canvas_host = mount ? mount.querySelector('[data-wpbc-timeline-canvas-rows]') : null;
      var row_template = get_template('resource_row');
      var segment_template = get_template('booking_segment');
      var time_slot_overflow_template = get_template('time_slot_overflow');
      if (!resource_host || !canvas_host || !row_template) {
        return false;
      }
      reconcile_row_presentations(resources);
      begin_booking_refresh();
      resources.forEach(function (resource) {
        var resource_id = Math.max(0, Math.round(Number(resource && resource.id) || 0));
        if (resource_id) {
          resource_summaries_by_id[resource_id] = resource;
        }
      });
      reset_row_observations();
      resource_host.textContent = '';
      canvas_host.textContent = '';
      details_expanded_ids.forEach(function (resource_id) {
        details_expanded_map[Number(resource_id)] = true;
      });
      hierarchy_expanded_ids.forEach(function (resource_id) {
        hierarchy_expanded_map[Number(resource_id)] = true;
      });
      resources.forEach(function (resource) {
        var resource_id = Number(resource.id);
        var row_presentations = authorized_presentations_by_resource[resource_id] || [];
        var open_row_presentation_ids = Object.keys(open_presentations_by_resource[resource_id] || {});
        var row_presentation_toggle_states = {};
        row_presentations.forEach(function (descriptor) {
          row_presentation_toggle_states[descriptor.id] = get_row_presentation_toggle_state(resource_id, descriptor);
        });
        var row_view_model = Object.assign({}, resource, {
          axis: settings.axis,
          i18n: settings.i18n,
          row_presentations: row_presentations,
          open_row_presentation_ids: open_row_presentation_ids,
          row_presentation_toggle_states: row_presentation_toggle_states,
          is_details_expanded: Boolean(resource.has_details && details_expanded_map[Number(resource.id)]),
          is_hierarchy_expanded: Boolean(resource.is_expandable && hierarchy_expanded_map[Number(resource.id)]),
          is_hierarchy_visible: !resource.is_child || Boolean(hierarchy_expanded_map[Number(resource.parent_id)])
        });
        var row_buffer = document.createElement('div');
        var resource_row;
        var canvas_row;
        row_buffer.innerHTML = row_template(row_view_model);
        resource_row = row_buffer.children[0];
        canvas_row = row_buffer.children[1];
        if (!resource_row || !canvas_row) {
          return;
        }
        resource_host.appendChild(resource_row);
        canvas_host.appendChild(canvas_row);
        row_presentations.forEach(function (descriptor) {
          emit_row_presentation_event('hosts-ready', resource_id, descriptor, {
            is_open: is_row_presentation_open(resource_id, descriptor.id)
          });
        });
      });
      update_visible_row_striping();
      restore_row_presentation_focus(presentation_focus);
      if (segment_template) {
        segments.forEach(function (segment) {
          var segment_host;
          var segment_buffer;
          var segment_element;
          if (false === segment.is_visible || true === segment.is_time_slot_overflow_item) {
            return;
          }
          segment_host = canvas_host.querySelector('[data-wpbc-timeline-row-key="resource-' + Number(segment.resource_id) + '"] [data-wpbc-timeline-segments]');
          if (!segment_host) {
            return;
          }
          segment_buffer = document.createElement('div');
          segment_buffer.innerHTML = segment_template(Object.assign({}, segment, {
            i18n: settings.i18n
          }));
          segment_element = segment_buffer.firstElementChild;
          if (segment_element) {
            segment_host.appendChild(segment_element);
            register_booking_segment(segment_element, segment, resource_summaries_by_id[Number(segment.resource_id)] || {});
          }
        });
      }
      if (time_slot_overflow_template) {
        time_slot_overflows.forEach(function (overflow) {
          var segment_host = canvas_host.querySelector('[data-wpbc-timeline-row-key="resource-' + Number(overflow.resource_id) + '"] [data-wpbc-timeline-segments]');
          var overflow_buffer;
          if (!segment_host) {
            return;
          }
          overflow_buffer = document.createElement('div');
          overflow_buffer.innerHTML = time_slot_overflow_template(Object.assign({}, overflow, {
            i18n: settings.i18n
          }));
          if (overflow_buffer.firstElementChild) {
            segment_host.appendChild(overflow_buffer.firstElementChild);
          }
        });
      }
      complete_booking_refresh();
      schedule_row_synchronization();
      return 0 < resources.length;
    }

    /**
     * Return all row halves grouped by their server-provided stable row key.
     *
     * @return {Object<string,Element[]>} Row elements keyed by stable row ID.
     */
    function collect_row_groups() {
      var row_groups = {};
      var row_elements = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-key]') : [];
      Array.prototype.forEach.call(row_elements, function (row_element) {
        var row_key = row_element.getAttribute('data-wpbc-timeline-row-key');
        if (!row_key) {
          return;
        }
        if (!row_groups[row_key]) {
          row_groups[row_key] = [];
        }
        row_groups[row_key].push(row_element);
      });
      return row_groups;
    }

    /**
     * Align visible presentation hosts inside one synchronized row group.
     *
     * Resource and canvas rows may have different native content, padding, or
     * flex gaps before their full-width presentation hosts. Equalizing only the
     * outer row height leaves those internal presentation boundaries offset.
     * This neutral pass measures each matching presentation ID and adds only the
     * missing logical-block margin to hosts that start earlier.
     *
     * @param {Element[]} row_elements Resource and canvas halves of one row.
     * @return {void}
     */
    function synchronize_row_presentation_offsets(row_elements) {
      var presentation_hosts = {};
      var presentation_ids = [];
      row_elements.forEach(function (row_element) {
        var row_hosts = row_element.querySelectorAll('[data-wpbc-timeline-row-presentation-host]');
        Array.prototype.forEach.call(row_hosts, function (host_element) {
          var presentation_id = host_element.getAttribute('data-wpbc-timeline-row-presentation-host');
          host_element.style.marginBlockStart = '';
          if (host_element.hidden || !presentation_id) {
            return;
          }
          if (!presentation_hosts[presentation_id]) {
            presentation_hosts[presentation_id] = [];
            presentation_ids.push(presentation_id);
          }
          presentation_hosts[presentation_id].push(host_element);
        });
      });
      presentation_ids.forEach(function (presentation_id) {
        var hosts = presentation_hosts[presentation_id];
        var latest_start = null;
        if (2 > hosts.length) {
          return;
        }
        hosts.forEach(function (host_element) {
          var host_start = host_element.getBoundingClientRect().top;
          latest_start = null === latest_start ? host_start : Math.max(latest_start, host_start);
        });
        hosts.forEach(function (host_element) {
          var start_offset = latest_start - host_element.getBoundingClientRect().top;
          if (0.5 < start_offset) {
            host_element.style.marginBlockStart = start_offset + 'px';
          }
        });
      });
    }

    /**
     * Synchronize Resource and canvas row heights after layout changes.
     *
     * @param {string[]|null} row_keys Stable row keys, or null for every row.
     * @return {void}
     */
    function synchronize_row_heights(row_keys) {
      var row_groups = collect_row_groups();
      var synchronize_every_row = !Array.isArray(row_keys) || !row_keys.length;
      Object.keys(row_groups).forEach(function (row_key) {
        var maximum_height = 0;
        var synchronized_height;
        var synchronized_minimum_height;
        if (!synchronize_every_row && -1 === row_keys.indexOf(row_key)) {
          return;
        }
        row_groups[row_key].forEach(function (row_element) {
          row_element.style.minHeight = '';
        });
        synchronize_row_presentation_offsets(row_groups[row_key]);
        row_groups[row_key].forEach(function (row_element) {
          maximum_height = Math.max(maximum_height, row_element.getBoundingClientRect().height);
        });
        synchronized_height = Math.ceil(maximum_height);
        synchronized_minimum_height = synchronized_height ? synchronized_height + 'px' : '';
        row_groups[row_key].forEach(function (row_element) {
          if (row_observer) {
            expected_row_heights.set(row_element, synchronized_height);
          }
          if (row_element.style.minHeight !== synchronized_minimum_height) {
            row_element.style.minHeight = synchronized_minimum_height;
          }
        });
      });
      after_row_synchronization();
    }

    /**
     * Request one coalesced row-height synchronization for the next frame.
     *
     * @param {string|string[]|Event} row_keys Stable row key(s), or all rows.
     * @return {void}
     */
    function schedule_row_synchronization(row_keys) {
      if ('string' === typeof row_keys && row_keys) {
        pending_row_keys[row_keys] = true;
      } else if (Array.isArray(row_keys)) {
        row_keys.forEach(function (row_key) {
          if (row_key) {
            pending_row_keys[row_key] = true;
          }
        });
      } else {
        synchronize_all_rows = true;
      }
      if (synchronization_frame) {
        return;
      }
      synchronization_frame = window.requestAnimationFrame(function () {
        var row_keys_to_synchronize = synchronize_all_rows ? null : Object.keys(pending_row_keys);
        synchronization_frame = 0;
        pending_row_keys = {};
        synchronize_all_rows = false;
        synchronize_row_heights(row_keys_to_synchronize);
      });
    }

    /**
     * Return one rendered Timeline row's border-box height.
     *
     * @param {Element} row_element Resource or canvas row.
     * @return {number} Rounded CSS-pixel height.
     */
    function get_row_height(row_element) {
      return Math.ceil(row_element.getBoundingClientRect().height);
    }

    /**
     * Process row resize entries without reacting to module-authored writes.
     *
     * @param {ResizeObserverEntry[]} resize_entries Resize observations.
     * @return {void}
     */
    function handle_row_resize(resize_entries) {
      var changed_row_keys = {};
      Array.prototype.forEach.call(resize_entries, function (resize_entry) {
        var row_element = resize_entry.target;
        var row_key = row_element.getAttribute('data-wpbc-timeline-row-key');
        var expected_height = expected_row_heights.get(row_element);
        var current_height = get_row_height(row_element);
        if ('number' === typeof expected_height && 1 >= Math.abs(current_height - expected_height)) {
          expected_row_heights.delete(row_element);
          return;
        }
        expected_row_heights.delete(row_element);
        if (row_key) {
          changed_row_keys[row_key] = true;
        }
      });
      if (Object.keys(changed_row_keys).length) {
        schedule_row_synchronization(Object.keys(changed_row_keys));
      }
    }

    /**
     * Observe each current row half exactly once for size changes.
     *
     * @return {string[]} Stable keys for newly observed row groups.
     */
    function observe_rows() {
      var row_elements = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-key]') : [];
      var new_row_keys = {};
      Array.prototype.forEach.call(row_elements, function (row_element) {
        var row_key;
        if (row_synchronization_initialized && observed_row_elements.has(row_element)) {
          return;
        }
        row_key = row_element.getAttribute('data-wpbc-timeline-row-key');
        if (row_key) {
          new_row_keys[row_key] = true;
        }
        if (row_synchronization_initialized) {
          observed_row_elements.add(row_element);
          if (row_observer) {
            row_observer.observe(row_element);
          }
        }
      });
      if (Object.keys(new_row_keys).length) {
        schedule_row_synchronization(Object.keys(new_row_keys));
      }
      return Object.keys(new_row_keys);
    }

    /**
     * Observe new rows and dirty only row groups touched by DOM mutations.
     *
     * @param {MutationRecord[]} mutation_records Child-list mutations.
     * @return {void}
     */
    function handle_row_mutations(mutation_records) {
      var changed_row_keys = {};
      observe_rows();
      Array.prototype.forEach.call(mutation_records, function (mutation_record) {
        var row_element = mutation_record.target.closest ? mutation_record.target.closest('[data-wpbc-timeline-row-key]') : null;
        var row_key = row_element ? row_element.getAttribute('data-wpbc-timeline-row-key') : '';
        if (row_key) {
          changed_row_keys[row_key] = true;
        }
      });
      if (Object.keys(changed_row_keys).length) {
        schedule_row_synchronization(Object.keys(changed_row_keys));
      }
    }

    /**
     * Synchronize the row containing a delayed image or captured resource.
     *
     * @param {Event} load_event Captured load event.
     * @return {void}
     */
    function handle_row_content_load(load_event) {
      var row_element = load_event.target && load_event.target.closest ? load_event.target.closest('[data-wpbc-timeline-row-key]') : null;
      var row_key = row_element ? row_element.getAttribute('data-wpbc-timeline-row-key') : '';
      schedule_row_synchronization(row_key || null);
    }

    /**
     * Synchronize a paired row after an authorized presentation renders locally.
     *
     * Domain modules emit this neutral lifecycle event after replacing host
     * contents. Shared rendering validates only the registered presentation and
     * schedules its existing Resource/canvas row-height mechanic.
     *
     * @param {CustomEvent} event Neutral presentation-rendered event.
     * @return {void}
     */
    function handle_row_presentation_rendered(event) {
      var detail = event && event.detail ? event.detail : {};
      var resource_id = Math.max(0, Math.round(Number(detail.resource_id) || 0));
      var presentation_id = String(detail.presentation_id || '');
      if (!resource_id || !get_authorized_row_presentation(resource_id, presentation_id)) {
        return;
      }
      schedule_row_synchronization('resource-' + resource_id);
    }

    /**
     * Apply one details-expanded state to both halves of a row group.
     *
     * @param {string}  row_key     Stable row identifier.
     * @param {boolean} is_expanded Desired details state.
     * @param {Element} trigger     Toggle that initiated the change.
     * @return {void}
     */
    function set_row_expanded(row_key, is_expanded, trigger) {
      var row_elements = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-key]') : [];
      var resource_id_match = String(row_key || '').match(/^resource-(\d+)$/);
      Array.prototype.forEach.call(row_elements, function (row_element) {
        var details = row_element.querySelectorAll('[data-wpbc-timeline-row-details]');
        if (row_key !== row_element.getAttribute('data-wpbc-timeline-row-key')) {
          return;
        }
        row_element.classList.toggle('is-expanded', is_expanded);
        Array.prototype.forEach.call(details, function (detail_element) {
          detail_element.hidden = !is_expanded;
        });
      });
      if (trigger) {
        trigger.setAttribute('aria-expanded', is_expanded ? 'true' : 'false');
        trigger.setAttribute('aria-label', is_expanded ? settings.i18n.collapse_resource : settings.i18n.expand_resource);
      }
      if (resource_id_match) {
        retain_expansion_state('expanded_resource_ids', Number(resource_id_match[1]), is_expanded);
      }
      schedule_row_synchronization(row_key);
    }

    /**
     * Apply one neutral presentation state to its synchronized row hosts.
     *
     * Exclusive descriptors exclude other presentations on the same Resource,
     * not presentations on other Resources. This allows every authorized
     * Resource on the current page to be open without a data request.
     *
     * @param {number}  resource_id     Authorized Resource ID.
     * @param {string}  presentation_id Registered presentation ID.
     * @param {boolean} is_open         Desired state.
     * @param {Element} trigger         Optional initiating toggle.
     * @param {boolean} restore_focus   Whether closing should restore focus.
     * @return {boolean} True when the authorized state was applied.
     */
    function set_row_presentation_open(resource_id, presentation_id, is_open, trigger, restore_focus) {
      var descriptor = get_authorized_row_presentation(resource_id, presentation_id);
      var resource_open_state;
      resource_id = Math.max(0, Math.round(Number(resource_id) || 0));
      if (!resource_id || !descriptor) {
        return false;
      }
      if (is_row_presentation_open(resource_id, presentation_id) === is_open) {
        if (!is_open && restore_focus && trigger && 'function' === typeof trigger.focus) {
          trigger.focus();
        }
        return true;
      }
      resource_open_state = open_presentations_by_resource[resource_id] || {};
      if (is_open) {
        Object.keys(resource_open_state).forEach(function (open_presentation_id) {
          var open_descriptor = get_authorized_row_presentation(resource_id, open_presentation_id);
          if (open_presentation_id !== presentation_id && (descriptor.is_exclusive || open_descriptor && open_descriptor.is_exclusive)) {
            apply_row_presentation_state(resource_id, open_descriptor, false, null);
          }
        });
      }
      apply_row_presentation_state(resource_id, descriptor, is_open, trigger);
      if (!is_open && restore_focus && trigger && 'function' === typeof trigger.focus) {
        trigger.focus();
      }
      return true;
    }

    /**
     * Apply one presentation state to a leaf or authorized hierarchy group.
     *
     * @param {number}  resource_id     Toggle-owning Resource ID.
     * @param {string}  presentation_id Registered presentation ID.
     * @param {boolean} is_open         Desired state for the complete scope.
     * @param {Element} trigger         Initiating toggle.
     * @param {boolean} restore_focus   Whether closing restores trigger focus.
     * @return {boolean} True when at least one authorized Resource was handled.
     */
    function set_row_presentation_scope_open(resource_id, presentation_id, is_open, trigger, restore_focus) {
      var controlled_resource_ids = get_row_presentation_scope_resource_ids(resource_id, presentation_id);
      var handled_count = 0;
      controlled_resource_ids.forEach(function (controlled_resource_id) {
        if (set_row_presentation_open(controlled_resource_id, presentation_id, is_open, null, false)) {
          handled_count += 1;
        }
      });
      synchronize_row_presentation_toggles(presentation_id);
      if (handled_count && !is_open && restore_focus && trigger && 'function' === typeof trigger.focus) {
        trigger.focus();
      }
      return 0 < handled_count;
    }

    /**
     * Update retained state, hosts, controls, row classes, and lifecycle events.
     *
     * @param {number}      resource_id Authorized Resource ID.
     * @param {Object|null} descriptor  Registered descriptor.
     * @param {boolean}     is_open     Desired state.
     * @param {Element}     trigger     Optional initiating toggle.
     * @return {void}
     */
    function apply_row_presentation_state(resource_id, descriptor, is_open, trigger) {
      var row_elements = mount ? mount.querySelectorAll('[data-wpbc-timeline-row-key="resource-' + Number(resource_id) + '"]') : [];
      var hosts;
      if (!descriptor) {
        return;
      }
      if (!open_presentations_by_resource[resource_id]) {
        open_presentations_by_resource[resource_id] = {};
      }
      if (is_open) {
        open_presentations_by_resource[resource_id][descriptor.id] = true;
      } else {
        delete open_presentations_by_resource[resource_id][descriptor.id];
        if (!Object.keys(open_presentations_by_resource[resource_id]).length) {
          delete open_presentations_by_resource[resource_id];
        }
      }
      hosts = get_row_presentation_hosts(resource_id, descriptor.id);
      Array.prototype.forEach.call(hosts, function (host) {
        host.hidden = !is_open;
        host.setAttribute('aria-hidden', is_open ? 'false' : 'true');
      });
      Array.prototype.forEach.call(row_elements, function (row_element) {
        row_element.classList.toggle('has-open-row-presentation', Boolean(Object.keys(open_presentations_by_resource[resource_id] || {}).length));
      });
      emit_row_presentation_event(is_open ? 'opened' : 'closed', resource_id, descriptor, {
        is_open: is_open
      });
      synchronize_row_presentation_toggles(descriptor.id);
      schedule_row_synchronization('resource-' + resource_id);
    }

    /**
     * Apply one presentation state to every currently authorized Resource.
     *
     * The method performs no request. Resources lacking the descriptor are
     * skipped, so domains may safely use it for an explicit auto-open policy.
     *
     * @param {string}  presentation_id Registered presentation ID.
     * @param {boolean} is_open         Desired state.
     * @return {number} Number of Resources updated.
     */
    function set_all_row_presentations_open(presentation_id, is_open) {
      var updated_count = 0;
      Object.keys(authorized_presentations_by_resource).forEach(function (resource_id) {
        if (set_row_presentation_open(Number(resource_id), presentation_id, is_open, null, false)) {
          updated_count += 1;
        }
      });
      return updated_count;
    }

    /**
     * Open one presentation on the first authorized Resource in rendered order.
     *
     * This neutral helper performs no request and deliberately opens only one
     * Resource, even when that Resource is a hierarchy parent. Domain extensions
     * may use it for a one-shot initial-presentation policy without synthesizing
     * a click or acquiring cache, request, or mutation authority.
     *
     * @param {string} presentation_id Registered presentation ID.
     * @return {number} Opened Resource ID, or zero when none is authorized.
     */
    function open_first_row_presentation(presentation_id) {
      var opened_resource_id = 0;
      authorized_resource_ids_in_order.some(function (resource_id) {
        if (!get_authorized_row_presentation(resource_id, presentation_id)) {
          return false;
        }
        if (set_row_presentation_open(resource_id, presentation_id, true, null, false)) {
          opened_resource_id = resource_id;
          return true;
        }
        return false;
      });
      return opened_resource_id;
    }

    /**
     * Handle one delegated neutral presentation toggle.
     *
     * @param {MouseEvent} event Browser click event.
     * @return {boolean} True when a registered presentation handled the event.
     */
    function handle_row_presentation_click(event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-row-presentation-toggle]') : null;
      var resource_id;
      var presentation_id;
      var descriptor;
      var toggle_state;
      if (!trigger) {
        return false;
      }
      resource_id = Number(trigger.getAttribute('data-wpbc-timeline-resource-id'));
      presentation_id = trigger.getAttribute('data-wpbc-timeline-row-presentation-toggle');
      descriptor = get_authorized_row_presentation(resource_id, presentation_id);
      if (!descriptor) {
        return false;
      }
      toggle_state = get_row_presentation_toggle_state(resource_id, descriptor);
      if (event.preventDefault) {
        event.preventDefault();
      }
      return set_row_presentation_scope_open(resource_id, presentation_id, !toggle_state.is_open, trigger, true);
    }

    /**
     * Close the presentation containing keyboard focus when Escape is pressed.
     *
     * This is a neutral presentation-host mechanic. It does not inspect the
     * presentation ID or domain content, and returns focus to the current
     * authorized toggle after both synchronized hosts close.
     *
     * @param {KeyboardEvent} event Delegated keyboard event.
     * @return {boolean} True when an open presentation handled Escape.
     */
    function handle_row_presentation_keydown(event) {
      var host;
      var resource_id;
      var presentation_id;
      var trigger;
      if ('Escape' !== event.key || event.defaultPrevented) {
        return false;
      }
      host = event.target && event.target.closest ? event.target.closest('[data-wpbc-timeline-row-presentation-host]') : null;
      if (!host || host.hidden) {
        return false;
      }
      resource_id = Number(host.getAttribute('data-wpbc-timeline-resource-id'));
      presentation_id = String(host.getAttribute('data-wpbc-timeline-row-presentation-host') || '');
      if (!is_row_presentation_open(resource_id, presentation_id)) {
        return false;
      }
      trigger = get_row_presentation_toggle(resource_id, presentation_id);
      if (event.preventDefault) {
        event.preventDefault();
      }
      if (event.stopPropagation) {
        event.stopPropagation();
      }
      return set_row_presentation_open(resource_id, presentation_id, false, trigger, true);
    }

    /**
     * Show or hide direct child row halves for an authorized parent Resource.
     *
     * @param {number}  parent_id   Authorized parent Resource ID.
     * @param {boolean} is_expanded Desired child visibility.
     * @param {Element} trigger     Hierarchy toggle that initiated the change.
     * @return {void}
     */
    function set_hierarchy_expanded(parent_id, is_expanded, trigger) {
      var child_rows = mount ? mount.querySelectorAll('[data-wpbc-timeline-parent-id="' + Number(parent_id) + '"]') : [];
      var icon = trigger ? trigger.querySelector('[data-wpbc-timeline-hierarchy-icon]') : null;
      var affected_row_keys = {};
      Array.prototype.forEach.call(child_rows, function (child_row) {
        var row_key;
        if (0 === Number(child_row.getAttribute('data-wpbc-timeline-parent-id'))) {
          return;
        }
        child_row.hidden = !is_expanded;
        row_key = child_row.getAttribute('data-wpbc-timeline-row-key');
        if (row_key) {
          affected_row_keys[row_key] = true;
        }
      });
      if (trigger) {
        trigger.setAttribute('aria-expanded', is_expanded ? 'true' : 'false');
        trigger.setAttribute('aria-label', is_expanded ? settings.i18n.collapse_children : settings.i18n.expand_children);
      }
      if (icon) {
        icon.classList.toggle('wpbc-bi-dash-square-dotted', is_expanded);
        icon.classList.toggle('wpbc-bi-plus-square-dotted', !is_expanded);
      }
      retain_expansion_state('expanded_parent_ids', parent_id, is_expanded);
      update_visible_row_striping();
      if (Object.keys(affected_row_keys).length) {
        schedule_row_synchronization(Object.keys(affected_row_keys));
      }
    }

    /**
     * Start responsive synchronization for expansion, images, fonts, and width.
     *
     * @return {void}
     */
    function initialize() {
      var initialized_generation;
      if (!mount || row_synchronization_initialized) {
        return;
      }
      lifecycle_generation += 1;
      if ('function' === typeof window.ResizeObserver) {
        row_observer = new window.ResizeObserver(handle_row_resize);
      }
      if ('function' === typeof window.MutationObserver) {
        mutation_observer = new window.MutationObserver(handle_row_mutations);
        mutation_observer.observe(mount, {
          childList: true,
          subtree: true
        });
      }
      if (!row_observer) {
        window.addEventListener('resize', schedule_row_synchronization);
      }
      row_synchronization_initialized = true;
      mount.addEventListener('load', handle_row_content_load, true);
      mount.addEventListener('keydown', handle_row_presentation_keydown);
      mount.addEventListener('wpbc:timeline:row-presentation:rendered', handle_row_presentation_rendered);
      if (document.fonts && document.fonts.ready && 'function' === typeof document.fonts.ready.then) {
        initialized_generation = lifecycle_generation;
        document.fonts.ready.then(function () {
          if (!row_synchronization_initialized || !is_host_active() || initialized_generation !== lifecycle_generation) {
            return;
          }
          schedule_row_synchronization();
        });
      }
      observe_rows();
    }

    /**
     * Release observers, listeners, and scheduled work owned by this instance.
     *
     * @return {void}
     */
    function destroy() {
      if (!row_synchronization_initialized) {
        return;
      }
      lifecycle_generation += 1;
      row_synchronization_initialized = false;
      if (synchronization_frame) {
        window.cancelAnimationFrame(synchronization_frame);
      }
      synchronization_frame = 0;
      pending_row_keys = {};
      synchronize_all_rows = false;
      if (row_observer) {
        row_observer.disconnect();
      } else {
        window.removeEventListener('resize', schedule_row_synchronization);
      }
      if (mutation_observer) {
        mutation_observer.disconnect();
      }
      if (mount) {
        mount.removeEventListener('load', handle_row_content_load, true);
        mount.removeEventListener('keydown', handle_row_presentation_keydown);
        mount.removeEventListener('wpbc:timeline:row-presentation:rendered', handle_row_presentation_rendered);
      }
      row_observer = null;
      mutation_observer = null;
      observed_row_elements = new window.WeakSet();
      expected_row_heights = new window.WeakMap();
      authorized_presentations_by_resource = {};
      authorized_resource_ids_in_order = [];
      open_presentations_by_resource = {};
      resource_children_by_parent = {};
      resource_titles_by_id = {};
    }
    return {
      initialize: initialize,
      destroy: destroy,
      render_rows: render_rows,
      observe_rows: observe_rows,
      set_row_expanded: set_row_expanded,
      set_hierarchy_expanded: set_hierarchy_expanded,
      handle_row_presentation_click: handle_row_presentation_click,
      handle_row_presentation_keydown: handle_row_presentation_keydown,
      set_row_presentation_open: set_row_presentation_open,
      set_row_presentation_scope_open: set_row_presentation_scope_open,
      set_all_row_presentations_open: set_all_row_presentations_open,
      open_first_row_presentation: open_first_row_presentation,
      is_row_presentation_open: is_row_presentation_open
    };
  }
  if (window.wpbc_timeline_modules && 'function' === typeof window.wpbc_timeline_modules.register_factory) {
    window.wpbc_timeline_modules.register_factory(module_id, create_rendering_controller);
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS10aW1lbGluZS9fb3V0L3RpbWVsaW5lLXJlbmRlcmluZy5qcyIsIm5hbWVzIjpbIndpbmRvdyIsImRvY3VtZW50IiwibW9kdWxlX2lkIiwiY3JlYXRlX3JlbmRlcmluZ19jb250cm9sbGVyIiwiY29udGV4dCIsIm1vdW50Iiwic2V0dGluZ3MiLCJnZXRfdGVtcGxhdGUiLCJiZWdpbl9ib29raW5nX3JlZnJlc2giLCJyZWdpc3Rlcl9ib29raW5nX3NlZ21lbnQiLCJjb21wbGV0ZV9ib29raW5nX3JlZnJlc2giLCJhZnRlcl9yb3dfc3luY2hyb25pemF0aW9uIiwiaXNfaG9zdF9hY3RpdmUiLCJyb3dfb2JzZXJ2ZXIiLCJtdXRhdGlvbl9vYnNlcnZlciIsInJvd19zeW5jaHJvbml6YXRpb25faW5pdGlhbGl6ZWQiLCJvYnNlcnZlZF9yb3dfZWxlbWVudHMiLCJXZWFrU2V0IiwiZXhwZWN0ZWRfcm93X2hlaWdodHMiLCJXZWFrTWFwIiwicGVuZGluZ19yb3dfa2V5cyIsInN5bmNocm9uaXplX2FsbF9yb3dzIiwic3luY2hyb25pemF0aW9uX2ZyYW1lIiwibGlmZWN5Y2xlX2dlbmVyYXRpb24iLCJhdXRob3JpemVkX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2UiLCJhdXRob3JpemVkX3Jlc291cmNlX2lkc19pbl9vcmRlciIsIm9wZW5fcHJlc2VudGF0aW9uc19ieV9yZXNvdXJjZSIsInJlc291cmNlX2NoaWxkcmVuX2J5X3BhcmVudCIsInJlc291cmNlX3RpdGxlc19ieV9pZCIsIm5vcm1hbGl6ZV9yb3dfcHJlc2VudGF0aW9ucyIsImRlc2NyaXB0b3JzIiwic3RhYmxlX2lkZW50aWZpZXIiLCJzZWVuX2lkcyIsIkFycmF5IiwiaXNBcnJheSIsImZpbHRlciIsImRlc2NyaXB0b3IiLCJwcmVzZW50YXRpb25faWQiLCJpZCIsInRlbXBsYXRlX2tleSIsInRlc3QiLCJsYWJlbCIsInRyaW0iLCJtYXAiLCJpc19leGNsdXNpdmUiLCJpc19yZWFkX29ubHkiLCJ0b2dnbGVfb3Blbl9sYWJlbCIsInRvZ2dsZV9jbG9zZV9sYWJlbCIsImVtaXRfcm93X3ByZXNlbnRhdGlvbl9ldmVudCIsImV2ZW50X25hbWUiLCJyZXNvdXJjZV9pZCIsImFkZGl0aW9uYWwiLCJldmVudF9kZXRhaWwiLCJsaWZlY3ljbGVfZXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiT2JqZWN0IiwiYXNzaWduIiwiaG9zdHMiLCJnZXRfcm93X3ByZXNlbnRhdGlvbl9ob3N0cyIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwiY3JlYXRlRXZlbnQiLCJpbml0Q3VzdG9tRXZlbnQiLCJxdWVyeVNlbGVjdG9yQWxsIiwicHJvdG90eXBlIiwiY2FsbCIsImhvc3QiLCJOdW1iZXIiLCJnZXRBdHRyaWJ1dGUiLCJnZXRfcm93X3ByZXNlbnRhdGlvbl90b2dnbGUiLCJ0b2dnbGVzIiwidG9nZ2xlIiwiZ2V0X2F1dGhvcml6ZWRfcm93X3ByZXNlbnRhdGlvbiIsImlzX3Jvd19wcmVzZW50YXRpb25fb3BlbiIsIkJvb2xlYW4iLCJnZXRfcm93X3ByZXNlbnRhdGlvbl9zY29wZV9yZXNvdXJjZV9pZHMiLCJwZW5kaW5nX2lkcyIsImNvbnRyb2xsZWRfaWRzIiwibGVuZ3RoIiwic2hpZnQiLCJwdXNoIiwiZm9yRWFjaCIsImNoaWxkX2lkIiwiaW50ZXJwb2xhdGVfcHJlc2VudGF0aW9uX2xhYmVsIiwicGF0dGVybiIsInZhbHVlcyIsImtleXMiLCJrZXkiLCJTdHJpbmciLCJyZXBsYWNlIiwiUmVnRXhwIiwiZ2V0X3Jvd19wcmVzZW50YXRpb25fdG9nZ2xlX3N0YXRlIiwiY29udHJvbGxlZF9yZXNvdXJjZV9pZHMiLCJjb250cm9sc19ncm91cCIsImlzX29wZW4iLCJldmVyeSIsImNvbnRyb2xsZWRfcmVzb3VyY2VfaWQiLCJsYWJlbF9rZXkiLCJmYWxsYmFja19sYWJlbCIsImNvbnRyb2xsZWRfaG9zdF9pZHMiLCJqb2luIiwiYWNjZXNzaWJsZV9sYWJlbCIsImkxOG4iLCJyZXNvdXJjZSIsInN5bmNocm9uaXplX3Jvd19wcmVzZW50YXRpb25fdG9nZ2xlcyIsInRvZ2dsZV9zdGF0ZSIsImljb24iLCJzZXRBdHRyaWJ1dGUiLCJxdWVyeVNlbGVjdG9yIiwiY2xhc3NMaXN0IiwicmVtb3ZlIiwiYWRkIiwicmVjb25jaWxlX3Jvd19wcmVzZW50YXRpb25zIiwicmVzb3VyY2VzIiwibmV4dF9hdXRob3JpemVkIiwibmV4dF9yZXNvdXJjZV9pZHNfaW5fb3JkZXIiLCJuZXh0X2NoaWxkcmVuX2J5X3BhcmVudCIsIm5leHRfdGl0bGVzX2J5X2lkIiwiTWF0aCIsIm1heCIsInJvdW5kIiwicGFyZW50X2lkIiwicm93X3ByZXNlbnRhdGlvbnMiLCJ0aXRsZSIsInJlc291cmNlX2lkX2tleSIsIm5leHRfZGVzY3JpcHRvciIsInByZXZpb3VzX2Rlc2NyaXB0b3IiLCJjYXB0dXJlX3Jvd19wcmVzZW50YXRpb25fZm9jdXMiLCJhY3RpdmVfZWxlbWVudCIsImFjdGl2ZUVsZW1lbnQiLCJjbG9zZXN0IiwicmVzdG9yZV9yb3dfcHJlc2VudGF0aW9uX2ZvY3VzIiwiZm9jdXNfaWRlbnRpdHkiLCJmb2N1cyIsImRlZHVwbGljYXRlX3NlZ21lbnRzIiwic2VnbWVudHMiLCJzZWVuX3NlZ21lbnRfaWRzIiwic2VnbWVudCIsInNlZ21lbnRfaWQiLCJ1cGRhdGVfdmlzaWJsZV9yb3dfc3RyaXBpbmciLCJ2aXNpYmxlX3Jvd19pbmRleCIsImNhbnZhc19yb3dzIiwiY2FudmFzX3JvdyIsImhpZGRlbiIsInJldGFpbl9leHBhbnNpb25fc3RhdGUiLCJwcmVmZXJlbmNlX2tleSIsImlzX2V4cGFuZGVkIiwicmV0YWluZWRfaWRzIiwicHJlZmVyZW5jZXMiLCJyZXRhaW5lZF9pZCIsInJldGFpbmVkX2luZGV4IiwiYWxsX3JldGFpbmVkX2lkcyIsImluZGV4T2YiLCJzb3J0IiwibGVmdF9pZCIsInJpZ2h0X2lkIiwicmVzZXRfcm93X29ic2VydmF0aW9ucyIsImRpc2Nvbm5lY3QiLCJyZW5kZXJfcm93cyIsImluaXRpYWwiLCJwcmVzZW50YXRpb25fZm9jdXMiLCJ0aW1lX3Nsb3Rfb3ZlcmZsb3dzIiwiZGV0YWlsc19leHBhbmRlZF9pZHMiLCJleHBhbmRlZF9yZXNvdXJjZV9pZHMiLCJoaWVyYXJjaHlfZXhwYW5kZWRfaWRzIiwiZXhwYW5kZWRfcGFyZW50X2lkcyIsImRldGFpbHNfZXhwYW5kZWRfbWFwIiwiaGllcmFyY2h5X2V4cGFuZGVkX21hcCIsInJlc291cmNlX3N1bW1hcmllc19ieV9pZCIsInJlc291cmNlX2hvc3QiLCJjYW52YXNfaG9zdCIsInJvd190ZW1wbGF0ZSIsInNlZ21lbnRfdGVtcGxhdGUiLCJ0aW1lX3Nsb3Rfb3ZlcmZsb3dfdGVtcGxhdGUiLCJ0ZXh0Q29udGVudCIsIm9wZW5fcm93X3ByZXNlbnRhdGlvbl9pZHMiLCJyb3dfcHJlc2VudGF0aW9uX3RvZ2dsZV9zdGF0ZXMiLCJyb3dfdmlld19tb2RlbCIsImF4aXMiLCJpc19kZXRhaWxzX2V4cGFuZGVkIiwiaGFzX2RldGFpbHMiLCJpc19oaWVyYXJjaHlfZXhwYW5kZWQiLCJpc19leHBhbmRhYmxlIiwiaXNfaGllcmFyY2h5X3Zpc2libGUiLCJpc19jaGlsZCIsInJvd19idWZmZXIiLCJjcmVhdGVFbGVtZW50IiwicmVzb3VyY2Vfcm93IiwiaW5uZXJIVE1MIiwiY2hpbGRyZW4iLCJhcHBlbmRDaGlsZCIsInNlZ21lbnRfaG9zdCIsInNlZ21lbnRfYnVmZmVyIiwic2VnbWVudF9lbGVtZW50IiwiaXNfdmlzaWJsZSIsImlzX3RpbWVfc2xvdF9vdmVyZmxvd19pdGVtIiwiZmlyc3RFbGVtZW50Q2hpbGQiLCJvdmVyZmxvdyIsIm92ZXJmbG93X2J1ZmZlciIsInNjaGVkdWxlX3Jvd19zeW5jaHJvbml6YXRpb24iLCJjb2xsZWN0X3Jvd19ncm91cHMiLCJyb3dfZ3JvdXBzIiwicm93X2VsZW1lbnRzIiwicm93X2VsZW1lbnQiLCJyb3dfa2V5Iiwic3luY2hyb25pemVfcm93X3ByZXNlbnRhdGlvbl9vZmZzZXRzIiwicHJlc2VudGF0aW9uX2hvc3RzIiwicHJlc2VudGF0aW9uX2lkcyIsInJvd19ob3N0cyIsImhvc3RfZWxlbWVudCIsInN0eWxlIiwibWFyZ2luQmxvY2tTdGFydCIsImxhdGVzdF9zdGFydCIsImhvc3Rfc3RhcnQiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJ0b3AiLCJzdGFydF9vZmZzZXQiLCJzeW5jaHJvbml6ZV9yb3dfaGVpZ2h0cyIsInJvd19rZXlzIiwic3luY2hyb25pemVfZXZlcnlfcm93IiwibWF4aW11bV9oZWlnaHQiLCJzeW5jaHJvbml6ZWRfaGVpZ2h0Iiwic3luY2hyb25pemVkX21pbmltdW1faGVpZ2h0IiwibWluSGVpZ2h0IiwiaGVpZ2h0IiwiY2VpbCIsInNldCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInJvd19rZXlzX3RvX3N5bmNocm9uaXplIiwiZ2V0X3Jvd19oZWlnaHQiLCJoYW5kbGVfcm93X3Jlc2l6ZSIsInJlc2l6ZV9lbnRyaWVzIiwiY2hhbmdlZF9yb3dfa2V5cyIsInJlc2l6ZV9lbnRyeSIsInRhcmdldCIsImV4cGVjdGVkX2hlaWdodCIsImdldCIsImN1cnJlbnRfaGVpZ2h0IiwiYWJzIiwiZGVsZXRlIiwib2JzZXJ2ZV9yb3dzIiwibmV3X3Jvd19rZXlzIiwiaGFzIiwib2JzZXJ2ZSIsImhhbmRsZV9yb3dfbXV0YXRpb25zIiwibXV0YXRpb25fcmVjb3JkcyIsIm11dGF0aW9uX3JlY29yZCIsImhhbmRsZV9yb3dfY29udGVudF9sb2FkIiwibG9hZF9ldmVudCIsImhhbmRsZV9yb3dfcHJlc2VudGF0aW9uX3JlbmRlcmVkIiwiZXZlbnQiLCJzZXRfcm93X2V4cGFuZGVkIiwidHJpZ2dlciIsInJlc291cmNlX2lkX21hdGNoIiwibWF0Y2giLCJkZXRhaWxzIiwiZGV0YWlsX2VsZW1lbnQiLCJjb2xsYXBzZV9yZXNvdXJjZSIsImV4cGFuZF9yZXNvdXJjZSIsInNldF9yb3dfcHJlc2VudGF0aW9uX29wZW4iLCJyZXN0b3JlX2ZvY3VzIiwicmVzb3VyY2Vfb3Blbl9zdGF0ZSIsIm9wZW5fcHJlc2VudGF0aW9uX2lkIiwib3Blbl9kZXNjcmlwdG9yIiwiYXBwbHlfcm93X3ByZXNlbnRhdGlvbl9zdGF0ZSIsInNldF9yb3dfcHJlc2VudGF0aW9uX3Njb3BlX29wZW4iLCJoYW5kbGVkX2NvdW50Iiwic2V0X2FsbF9yb3dfcHJlc2VudGF0aW9uc19vcGVuIiwidXBkYXRlZF9jb3VudCIsIm9wZW5fZmlyc3Rfcm93X3ByZXNlbnRhdGlvbiIsIm9wZW5lZF9yZXNvdXJjZV9pZCIsInNvbWUiLCJoYW5kbGVfcm93X3ByZXNlbnRhdGlvbl9jbGljayIsInByZXZlbnREZWZhdWx0IiwiaGFuZGxlX3Jvd19wcmVzZW50YXRpb25fa2V5ZG93biIsImRlZmF1bHRQcmV2ZW50ZWQiLCJzdG9wUHJvcGFnYXRpb24iLCJzZXRfaGllcmFyY2h5X2V4cGFuZGVkIiwiY2hpbGRfcm93cyIsImFmZmVjdGVkX3Jvd19rZXlzIiwiY2hpbGRfcm93IiwiY29sbGFwc2VfY2hpbGRyZW4iLCJleHBhbmRfY2hpbGRyZW4iLCJpbml0aWFsaXplIiwiaW5pdGlhbGl6ZWRfZ2VuZXJhdGlvbiIsIlJlc2l6ZU9ic2VydmVyIiwiTXV0YXRpb25PYnNlcnZlciIsImNoaWxkTGlzdCIsInN1YnRyZWUiLCJhZGRFdmVudExpc3RlbmVyIiwiZm9udHMiLCJyZWFkeSIsInRoZW4iLCJkZXN0cm95IiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwid3BiY190aW1lbGluZV9tb2R1bGVzIiwicmVnaXN0ZXJfZmFjdG9yeSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtdGltZWxpbmUvX3NyYy90aW1lbGluZS1yZW5kZXJpbmcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaW1lbGluZSByb3cgcmVuZGVyaW5nIGFuZCBzeW5jaHJvbml6ZWQgUmVzb3VyY2UvY2FudmFzIHJvdyBtZWNoYW5pY3MuXG4gKlxuICogVGhlIHBhZ2UgY29udHJvbGxlciByZW1haW5zIGF1dGhvcml0YXRpdmUgZm9yIGNhY2hlZC13aW5kb3cgY29tcG9zaXRpb24sXG4gKiBheGlzIGdlb21ldHJ5LCBuYXZpZ2F0aW9uLCBhbmQgcmVxdWVzdHMuIFRoaXMgZm9jdXNlZCBtb2R1bGUgbW91bnRzIHRoZVxuICogYWxyZWFkeS1hdXRob3JpemVkIFJlc291cmNlIGFuZCBib29raW5nIERUT3MgdGhyb3VnaCBmaXhlZCBXb3JkUHJlc3NcbiAqIHRlbXBsYXRlcywgYXBwbGllcyBwcmVzZW50YXRpb24tb25seSBoaWVyYXJjaHkgc3RhdGUsIGFuZCBrZWVwcyBib3RoIGhhbHZlc1xuICogb2YgZWFjaCByZW5kZXJlZCByb3cgYXQgdGhlIHNhbWUgaGVpZ2h0LlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqIEBzaW5jZSAgIDEyLjAuMFxuICovXG4oIGZ1bmN0aW9uICggd2luZG93LCBkb2N1bWVudCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBtb2R1bGVfaWQgPSAncmVuZGVyaW5nJztcblxuXHQvKipcblx0ICogQ3JlYXRlIG9uZSBUaW1lbGluZSByZW5kZXJpbmcgY29udHJvbGxlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHQgQ29udHJvbGxlci1vd25lZCBET00sIHNldHRpbmdzLCB0ZW1wbGF0ZSwgYm9va2luZyxcblx0ICogICAgICAgICAgICAgICAgICAgICAgICAgYW5kIHBvc3QtbGF5b3V0IGNhbGxiYWNrcy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBSZW5kZXJpbmcgYW5kIHJvdy1zeW5jaHJvbml6YXRpb24gbGlmZWN5Y2xlIEFQSS5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9yZW5kZXJpbmdfY29udHJvbGxlciggY29udGV4dCApIHtcblx0XHR2YXIgbW91bnQgPSBjb250ZXh0Lm1vdW50IHx8IG51bGw7XG5cdFx0dmFyIHNldHRpbmdzID0gY29udGV4dC5zZXR0aW5ncyB8fCB7fTtcblx0XHR2YXIgZ2V0X3RlbXBsYXRlID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQuZ2V0X3RlbXBsYXRlID8gY29udGV4dC5nZXRfdGVtcGxhdGUgOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9O1xuXHRcdHZhciBiZWdpbl9ib29raW5nX3JlZnJlc2ggPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5iZWdpbl9ib29raW5nX3JlZnJlc2ggPyBjb250ZXh0LmJlZ2luX2Jvb2tpbmdfcmVmcmVzaCA6IGZ1bmN0aW9uICgpIHt9O1xuXHRcdHZhciByZWdpc3Rlcl9ib29raW5nX3NlZ21lbnQgPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5yZWdpc3Rlcl9ib29raW5nX3NlZ21lbnQgPyBjb250ZXh0LnJlZ2lzdGVyX2Jvb2tpbmdfc2VnbWVudCA6IGZ1bmN0aW9uICgpIHt9O1xuXHRcdHZhciBjb21wbGV0ZV9ib29raW5nX3JlZnJlc2ggPSAnZnVuY3Rpb24nID09PSB0eXBlb2YgY29udGV4dC5jb21wbGV0ZV9ib29raW5nX3JlZnJlc2ggPyBjb250ZXh0LmNvbXBsZXRlX2Jvb2tpbmdfcmVmcmVzaCA6IGZ1bmN0aW9uICgpIHt9O1xuXHRcdHZhciBhZnRlcl9yb3dfc3luY2hyb25pemF0aW9uID0gJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGNvbnRleHQuYWZ0ZXJfcm93X3N5bmNocm9uaXphdGlvbiA/IGNvbnRleHQuYWZ0ZXJfcm93X3N5bmNocm9uaXphdGlvbiA6IGZ1bmN0aW9uICgpIHt9O1xuXHRcdHZhciBpc19ob3N0X2FjdGl2ZSA9ICdmdW5jdGlvbicgPT09IHR5cGVvZiBjb250ZXh0LmlzX2hvc3RfYWN0aXZlID8gY29udGV4dC5pc19ob3N0X2FjdGl2ZSA6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdFx0dmFyIHJvd19vYnNlcnZlciA9IG51bGw7XG5cdFx0dmFyIG11dGF0aW9uX29ic2VydmVyID0gbnVsbDtcblx0XHR2YXIgcm93X3N5bmNocm9uaXphdGlvbl9pbml0aWFsaXplZCA9IGZhbHNlO1xuXHRcdHZhciBvYnNlcnZlZF9yb3dfZWxlbWVudHMgPSBuZXcgd2luZG93LldlYWtTZXQoKTtcblx0XHR2YXIgZXhwZWN0ZWRfcm93X2hlaWdodHMgPSBuZXcgd2luZG93LldlYWtNYXAoKTtcblx0XHR2YXIgcGVuZGluZ19yb3dfa2V5cyA9IHt9O1xuXHRcdHZhciBzeW5jaHJvbml6ZV9hbGxfcm93cyA9IGZhbHNlO1xuXHRcdHZhciBzeW5jaHJvbml6YXRpb25fZnJhbWUgPSAwO1xuXHRcdHZhciBsaWZlY3ljbGVfZ2VuZXJhdGlvbiA9IDA7XG5cdFx0dmFyIGF1dGhvcml6ZWRfcHJlc2VudGF0aW9uc19ieV9yZXNvdXJjZSA9IHt9O1xuXHRcdHZhciBhdXRob3JpemVkX3Jlc291cmNlX2lkc19pbl9vcmRlciA9IFtdO1xuXHRcdHZhciBvcGVuX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2UgPSB7fTtcblx0XHR2YXIgcmVzb3VyY2VfY2hpbGRyZW5fYnlfcGFyZW50ID0ge307XG5cdFx0dmFyIHJlc291cmNlX3RpdGxlc19ieV9pZCA9IHt9O1xuXG5cdFx0LyoqXG5cdFx0ICogTm9ybWFsaXplIHNlcnZlci1hdXRob3JpemVkIGV4ZWN1dGFibGUtZnJlZSBwcmVzZW50YXRpb24gZGVzY3JpcHRvcnMuXG5cdFx0ICpcblx0XHQgKiBCcm93c2VyIG5vcm1hbGl6YXRpb24gaXMgZGVmZW5zaXZlIG9ubHkuIFRoZSBQSFAgcmVnaXN0cnkgcmVtYWlucyB0aGVcblx0XHQgKiBhdXRob3JpdHkgdGhhdCBkZWNpZGVzIHdoaWNoIGRlc2NyaXB0b3JzIHJlYWNoIGVhY2ggUmVzb3VyY2UgRFRPLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBkZXNjcmlwdG9ycyBDYW5kaWRhdGUgUmVzb3VyY2UgZGVzY3JpcHRvcnMuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8T2JqZWN0Pn0gU2FmZSBvcmRlcmVkIGRlc2NyaXB0b3JzLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5vcm1hbGl6ZV9yb3dfcHJlc2VudGF0aW9ucyggZGVzY3JpcHRvcnMgKSB7XG5cdFx0XHR2YXIgc3RhYmxlX2lkZW50aWZpZXIgPSAvXlthLXpdW2EtejAtOV9dezAsNjN9JC87XG5cdFx0XHR2YXIgc2Vlbl9pZHMgPSB7fTtcblxuXHRcdFx0cmV0dXJuICggQXJyYXkuaXNBcnJheSggZGVzY3JpcHRvcnMgKSA/IGRlc2NyaXB0b3JzIDogW10gKS5maWx0ZXIoIGZ1bmN0aW9uICggZGVzY3JpcHRvciApIHtcblx0XHRcdFx0dmFyIHByZXNlbnRhdGlvbl9pZCA9IGRlc2NyaXB0b3IgJiYgJ3N0cmluZycgPT09IHR5cGVvZiBkZXNjcmlwdG9yLmlkID8gZGVzY3JpcHRvci5pZCA6ICcnO1xuXHRcdFx0XHR2YXIgdGVtcGxhdGVfa2V5ID0gZGVzY3JpcHRvciAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGRlc2NyaXB0b3IudGVtcGxhdGVfa2V5ID8gZGVzY3JpcHRvci50ZW1wbGF0ZV9rZXkgOiAnJztcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0ISBzdGFibGVfaWRlbnRpZmllci50ZXN0KCBwcmVzZW50YXRpb25faWQgKVxuXHRcdFx0XHRcdHx8ICEgc3RhYmxlX2lkZW50aWZpZXIudGVzdCggdGVtcGxhdGVfa2V5IClcblx0XHRcdFx0XHR8fCAnc3RyaW5nJyAhPT0gdHlwZW9mIGRlc2NyaXB0b3IubGFiZWxcblx0XHRcdFx0XHR8fCAhIGRlc2NyaXB0b3IubGFiZWwudHJpbSgpXG5cdFx0XHRcdFx0fHwgc2Vlbl9pZHNbIHByZXNlbnRhdGlvbl9pZCBdXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWVuX2lkc1sgcHJlc2VudGF0aW9uX2lkIF0gPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0gKS5tYXAoIGZ1bmN0aW9uICggZGVzY3JpcHRvciApIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogZGVzY3JpcHRvci5pZCxcblx0XHRcdFx0XHRsYWJlbDogZGVzY3JpcHRvci5sYWJlbCxcblx0XHRcdFx0XHR0ZW1wbGF0ZV9rZXk6IGRlc2NyaXB0b3IudGVtcGxhdGVfa2V5LFxuXHRcdFx0XHRcdGlzX2V4Y2x1c2l2ZTogdHJ1ZSA9PT0gZGVzY3JpcHRvci5pc19leGNsdXNpdmUsXG5cdFx0XHRcdFx0aXNfcmVhZF9vbmx5OiB0cnVlID09PSBkZXNjcmlwdG9yLmlzX3JlYWRfb25seSxcblx0XHRcdFx0XHR0b2dnbGVfb3Blbl9sYWJlbDogJ3N0cmluZycgPT09IHR5cGVvZiBkZXNjcmlwdG9yLnRvZ2dsZV9vcGVuX2xhYmVsID8gZGVzY3JpcHRvci50b2dnbGVfb3Blbl9sYWJlbCA6ICcnLFxuXHRcdFx0XHRcdHRvZ2dsZV9jbG9zZV9sYWJlbDogJ3N0cmluZycgPT09IHR5cGVvZiBkZXNjcmlwdG9yLnRvZ2dsZV9jbG9zZV9sYWJlbCA/IGRlc2NyaXB0b3IudG9nZ2xlX2Nsb3NlX2xhYmVsIDogJydcblx0XHRcdFx0fTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBFbWl0IG9uZSBuZXV0cmFsIHByZXNlbnRhdGlvbi1ob3N0IGxpZmVjeWNsZSBldmVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBldmVudF9uYW1lICAgICBMaWZlY3ljbGUgc3VmZml4LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCAgICBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjcmlwdG9yICAgICBSZWdpc3RlcmVkIG5ldXRyYWwgZGVzY3JpcHRvci5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gYWRkaXRpb25hbCAgICAgT3B0aW9uYWwgZXZlbnQgZGV0YWlscy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGVtaXRfcm93X3ByZXNlbnRhdGlvbl9ldmVudCggZXZlbnRfbmFtZSwgcmVzb3VyY2VfaWQsIGRlc2NyaXB0b3IsIGFkZGl0aW9uYWwgKSB7XG5cdFx0XHR2YXIgZXZlbnRfZGV0YWlsO1xuXHRcdFx0dmFyIGxpZmVjeWNsZV9ldmVudDtcblxuXHRcdFx0aWYgKCAhIG1vdW50IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiBtb3VudC5kaXNwYXRjaEV2ZW50ICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRldmVudF9kZXRhaWwgPSBPYmplY3QuYXNzaWduKCB7XG5cdFx0XHRcdHJlc291cmNlX2lkOiByZXNvdXJjZV9pZCxcblx0XHRcdFx0cHJlc2VudGF0aW9uX2lkOiBkZXNjcmlwdG9yLmlkLFxuXHRcdFx0XHR0ZW1wbGF0ZV9rZXk6IGRlc2NyaXB0b3IudGVtcGxhdGVfa2V5LFxuXHRcdFx0XHRkZXNjcmlwdG9yOiBPYmplY3QuYXNzaWduKCB7fSwgZGVzY3JpcHRvciApLFxuXHRcdFx0XHRob3N0czogZ2V0X3Jvd19wcmVzZW50YXRpb25faG9zdHMoIHJlc291cmNlX2lkLCBkZXNjcmlwdG9yLmlkIClcblx0XHRcdH0sIGFkZGl0aW9uYWwgfHwge30gKTtcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCApIHtcblx0XHRcdFx0bGlmZWN5Y2xlX2V2ZW50ID0gbmV3IHdpbmRvdy5DdXN0b21FdmVudCggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjonICsgZXZlbnRfbmFtZSwge1xuXHRcdFx0XHRcdGRldGFpbDogZXZlbnRfZGV0YWlsXG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gZWxzZSBpZiAoIGRvY3VtZW50LmNyZWF0ZUV2ZW50ICkge1xuXHRcdFx0XHRsaWZlY3ljbGVfZXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuXHRcdFx0XHRsaWZlY3ljbGVfZXZlbnQuaW5pdEN1c3RvbUV2ZW50KCAnd3BiYzp0aW1lbGluZTpyb3ctcHJlc2VudGF0aW9uOicgKyBldmVudF9uYW1lLCBmYWxzZSwgZmFsc2UsIGV2ZW50X2RldGFpbCApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBsaWZlY3ljbGVfZXZlbnQgKSB7XG5cdFx0XHRcdG1vdW50LmRpc3BhdGNoRXZlbnQoIGxpZmVjeWNsZV9ldmVudCApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBzeW5jaHJvbml6ZWQgUmVzb3VyY2UvY2FudmFzIGhvc3RzIGZvciBvbmUgcHJlc2VudGF0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkICAgIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHByZXNlbnRhdGlvbl9pZCBTdGFibGUgcHJlc2VudGF0aW9uIElELlxuXHRcdCAqIEByZXR1cm4ge0VsZW1lbnRbXX0gQ3VycmVudCBwcmVzZW50YXRpb24gaG9zdHMuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Jvd19wcmVzZW50YXRpb25faG9zdHMoIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQgKSB7XG5cdFx0XHR2YXIgaG9zdHMgPSBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1wcmVzZW50YXRpb24taG9zdF0nICkgOiBbXTtcblxuXHRcdFx0cmV0dXJuIEFycmF5LnByb3RvdHlwZS5maWx0ZXIuY2FsbCggaG9zdHMsIGZ1bmN0aW9uICggaG9zdCApIHtcblx0XHRcdFx0cmV0dXJuIE51bWJlciggaG9zdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtaWQnICkgKSA9PT0gTnVtYmVyKCByZXNvdXJjZV9pZCApXG5cdFx0XHRcdFx0JiYgaG9zdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi1ob3N0JyApID09PSBwcmVzZW50YXRpb25faWQ7XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBjdXJyZW50IHByZXNlbnRhdGlvbiB0b2dnbGUgd2l0aG91dCB0cnVzdGluZyBhIENTUyBmcmFnbWVudC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCAgICAgQXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJlc2VudGF0aW9uX2lkIFN0YWJsZSBwcmVzZW50YXRpb24gSUQuXG5cdFx0ICogQHJldHVybiB7RWxlbWVudHxudWxsfSBNYXRjaGluZyB0b2dnbGUgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcm93X3ByZXNlbnRhdGlvbl90b2dnbGUoIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQgKSB7XG5cdFx0XHR2YXIgdG9nZ2xlcyA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi10b2dnbGVdJyApIDogW107XG5cblx0XHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuZmlsdGVyLmNhbGwoIHRvZ2dsZXMsIGZ1bmN0aW9uICggdG9nZ2xlICkge1xuXHRcdFx0XHRyZXR1cm4gTnVtYmVyKCB0b2dnbGUuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWlkJyApICkgPT09IE51bWJlciggcmVzb3VyY2VfaWQgKVxuXHRcdFx0XHRcdCYmIHRvZ2dsZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi10b2dnbGUnICkgPT09IHByZXNlbnRhdGlvbl9pZDtcblx0XHRcdH0gKVsgMCBdIHx8IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGFuIGFsbG93LWxpc3RlZCBkZXNjcmlwdG9yIGZvciBvbmUgY3VycmVudCBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCAgICAgQXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJlc2VudGF0aW9uX2lkIFN0YWJsZSBwcmVzZW50YXRpb24gSUQuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IERlc2NyaXB0b3Igb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfYXV0aG9yaXplZF9yb3dfcHJlc2VudGF0aW9uKCByZXNvdXJjZV9pZCwgcHJlc2VudGF0aW9uX2lkICkge1xuXHRcdFx0dmFyIGRlc2NyaXB0b3JzID0gYXV0aG9yaXplZF9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlWyBOdW1iZXIoIHJlc291cmNlX2lkICkgXSB8fCBbXTtcblxuXHRcdFx0cmV0dXJuIGRlc2NyaXB0b3JzLmZpbHRlciggZnVuY3Rpb24gKCBkZXNjcmlwdG9yICkge1xuXHRcdFx0XHRyZXR1cm4gZGVzY3JpcHRvci5pZCA9PT0gcHJlc2VudGF0aW9uX2lkO1xuXHRcdFx0fSApWyAwIF0gfHwgbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gd2hldGhlciBhIHByZXNlbnRhdGlvbiBpcyBjdXJyZW50bHkgb3BlbiBmb3Igb25lIFJlc291cmNlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkICAgICBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmVzZW50YXRpb25faWQgU3RhYmxlIHByZXNlbnRhdGlvbiBJRC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gb3Blbi5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpc19yb3dfcHJlc2VudGF0aW9uX29wZW4oIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQgKSB7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbihcblx0XHRcdFx0b3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlWyBOdW1iZXIoIHJlc291cmNlX2lkICkgXVxuXHRcdFx0XHQmJiBvcGVuX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2VbIE51bWJlciggcmVzb3VyY2VfaWQgKSBdWyBwcmVzZW50YXRpb25faWQgXVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gdGhlIGF1dGhvcml6ZWQgUmVzb3VyY2Ugc2NvcGUgY29udHJvbGxlZCBieSBvbmUgcm93IHRvZ2dsZS5cblx0XHQgKlxuXHRcdCAqIEEgbGVhZiBjb250cm9scyBvbmx5IGl0c2VsZi4gQSBuZXV0cmFsIGhpZXJhcmNoeSBwYXJlbnQgY29udHJvbHMgaXRzZWxmXG5cdFx0ICogYW5kIGV2ZXJ5IGN1cnJlbnRseSBhdXRob3JpemVkIGRlc2NlbmRhbnQgdGhhdCBleHBvc2VzIHRoZSBkZXNjcmlwdG9yLlxuXHRcdCAqIFRoaXMgcmVtYWlucyBpbmRlcGVuZGVudCBmcm9tIHdoZXRoZXIgY2hpbGQgcm93cyBhcmUgdmlzdWFsbHkgY29sbGFwc2VkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkIFBhcmVudCBvciBsZWFmIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBwcmVzZW50YXRpb25faWQgUmVnaXN0ZXJlZCBwcmVzZW50YXRpb24gSUQuXG5cdFx0ICogQHJldHVybiB7QXJyYXk8bnVtYmVyPn0gT3JkZXJlZCBhdXRob3JpemVkIFJlc291cmNlIElEcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcm93X3ByZXNlbnRhdGlvbl9zY29wZV9yZXNvdXJjZV9pZHMoIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQgKSB7XG5cdFx0XHR2YXIgcGVuZGluZ19pZHMgPSBbIE51bWJlciggcmVzb3VyY2VfaWQgKSBdO1xuXHRcdFx0dmFyIHNlZW5faWRzID0ge307XG5cdFx0XHR2YXIgY29udHJvbGxlZF9pZHMgPSBbXTtcblxuXHRcdFx0d2hpbGUgKCBwZW5kaW5nX2lkcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCBwZW5kaW5nX2lkcy5zaGlmdCgpICk7XG5cdFx0XHRcdGlmICggISByZXNvdXJjZV9pZCB8fCBzZWVuX2lkc1sgcmVzb3VyY2VfaWQgXSApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWVuX2lkc1sgcmVzb3VyY2VfaWQgXSA9IHRydWU7XG5cdFx0XHRcdGlmICggZ2V0X2F1dGhvcml6ZWRfcm93X3ByZXNlbnRhdGlvbiggcmVzb3VyY2VfaWQsIHByZXNlbnRhdGlvbl9pZCApICkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZWRfaWRzLnB1c2goIHJlc291cmNlX2lkICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0KCByZXNvdXJjZV9jaGlsZHJlbl9ieV9wYXJlbnRbIHJlc291cmNlX2lkIF0gfHwgW10gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNoaWxkX2lkICkge1xuXHRcdFx0XHRcdHBlbmRpbmdfaWRzLnB1c2goIGNoaWxkX2lkICk7XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNvbnRyb2xsZWRfaWRzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEludGVycG9sYXRlIG9uZSB0cmFuc2xhdGVkIG5ldXRyYWwgcHJlc2VudGF0aW9uLWNvbnRyb2wgbGFiZWwuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcGF0dGVybiBUcmFuc2xhdGVkIHN0cmluZyB3aXRoIG5hbWVkIHBsYWNlaG9sZGVycy5cblx0XHQgKiBAcGFyYW0ge09iamVjdH0gdmFsdWVzIFBsYWluIHJlcGxhY2VtZW50IHZhbHVlcy5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IEludGVycG9sYXRlZCBsYWJlbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbnRlcnBvbGF0ZV9wcmVzZW50YXRpb25fbGFiZWwoIHBhdHRlcm4sIHZhbHVlcyApIHtcblx0XHRcdE9iamVjdC5rZXlzKCB2YWx1ZXMgfHwge30gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGtleSApIHtcblx0XHRcdFx0cGF0dGVybiA9IFN0cmluZyggcGF0dGVybiB8fCAnJyApLnJlcGxhY2UoIG5ldyBSZWdFeHAoICdcXFxceycgKyBrZXkgKyAnXFxcXH0nLCAnZycgKSwgU3RyaW5nKCB2YWx1ZXNbIGtleSBdICkgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIFN0cmluZyggcGF0dGVybiB8fCAnJyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEJ1aWxkIHRoZSBjdXJyZW50IGFjY2Vzc2libGUgc3RhdGUgZm9yIG9uZSByb3cgcHJlc2VudGF0aW9uIHRvZ2dsZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBBdXRob3JpemVkIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjcmlwdG9yIFJlZ2lzdGVyZWQgbmV1dHJhbCBkZXNjcmlwdG9yLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdH0gVG9nZ2xlIHN0YXRlIGFuZCBjb250cm9sbGVkIGhvc3QgaWRlbnRpdGllcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfcm93X3ByZXNlbnRhdGlvbl90b2dnbGVfc3RhdGUoIHJlc291cmNlX2lkLCBkZXNjcmlwdG9yICkge1xuXHRcdFx0dmFyIGNvbnRyb2xsZWRfcmVzb3VyY2VfaWRzID0gZ2V0X3Jvd19wcmVzZW50YXRpb25fc2NvcGVfcmVzb3VyY2VfaWRzKCByZXNvdXJjZV9pZCwgZGVzY3JpcHRvci5pZCApO1xuXHRcdFx0dmFyIGNvbnRyb2xzX2dyb3VwID0gMSA8IGNvbnRyb2xsZWRfcmVzb3VyY2VfaWRzLmxlbmd0aDtcblx0XHRcdHZhciBpc19vcGVuID0gMCA8IGNvbnRyb2xsZWRfcmVzb3VyY2VfaWRzLmxlbmd0aCAmJiBjb250cm9sbGVkX3Jlc291cmNlX2lkcy5ldmVyeSggZnVuY3Rpb24gKCBjb250cm9sbGVkX3Jlc291cmNlX2lkICkge1xuXHRcdFx0XHRyZXR1cm4gaXNfcm93X3ByZXNlbnRhdGlvbl9vcGVuKCBjb250cm9sbGVkX3Jlc291cmNlX2lkLCBkZXNjcmlwdG9yLmlkICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR2YXIgbGFiZWxfa2V5ID0gY29udHJvbHNfZ3JvdXBcblx0XHRcdFx0PyAoIGlzX29wZW4gPyAnaGlkZV9yZXNvdXJjZV9ncm91cF9wcmVzZW50YXRpb24nIDogJ3Nob3dfcmVzb3VyY2VfZ3JvdXBfcHJlc2VudGF0aW9uJyApXG5cdFx0XHRcdDogKCBpc19vcGVuID8gJ2hpZGVfcmVzb3VyY2VfcHJlc2VudGF0aW9uJyA6ICdzaG93X3Jlc291cmNlX3ByZXNlbnRhdGlvbicgKTtcblx0XHR2YXIgZmFsbGJhY2tfbGFiZWwgPSBkZXNjcmlwdG9yLmxhYmVsO1xuXHRcdFx0dmFyIGNvbnRyb2xsZWRfaG9zdF9pZHMgPSBbXTtcblxuXHRcdFx0Y29udHJvbGxlZF9yZXNvdXJjZV9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sbGVkX3Jlc291cmNlX2lkICkge1xuXHRcdFx0XHRjb250cm9sbGVkX2hvc3RfaWRzLnB1c2goICd3cGJjX3RpbWVsaW5lX3Jvd19wcmVzZW50YXRpb25fcmVzb3VyY2VfJyArIGNvbnRyb2xsZWRfcmVzb3VyY2VfaWQgKyAnXycgKyBkZXNjcmlwdG9yLmlkICk7XG5cdFx0XHRcdGNvbnRyb2xsZWRfaG9zdF9pZHMucHVzaCggJ3dwYmNfdGltZWxpbmVfcm93X3ByZXNlbnRhdGlvbl9jYW52YXNfJyArIGNvbnRyb2xsZWRfcmVzb3VyY2VfaWQgKyAnXycgKyBkZXNjcmlwdG9yLmlkICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGlzX29wZW46IGlzX29wZW4sXG5cdFx0XHRcdGNvbnRyb2xzX2dyb3VwOiBjb250cm9sc19ncm91cCxcblx0XHRcdFx0Y29udHJvbGxlZF9yZXNvdXJjZV9pZHM6IGNvbnRyb2xsZWRfcmVzb3VyY2VfaWRzLFxuXHRcdFx0XHRjb250cm9sbGVkX2hvc3RfaWRzOiBjb250cm9sbGVkX2hvc3RfaWRzLmpvaW4oICcgJyApLFxuXHRcdFx0XHRhY2Nlc3NpYmxlX2xhYmVsOiBpbnRlcnBvbGF0ZV9wcmVzZW50YXRpb25fbGFiZWwoXG5cdFx0XHRcdFx0c2V0dGluZ3MuaTE4biAmJiBzZXR0aW5ncy5pMThuWyBsYWJlbF9rZXkgXSA/IHNldHRpbmdzLmkxOG5bIGxhYmVsX2tleSBdIDogZmFsbGJhY2tfbGFiZWwsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6IGRlc2NyaXB0b3IubGFiZWwsXG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogcmVzb3VyY2VfdGl0bGVzX2J5X2lkWyBOdW1iZXIoIHJlc291cmNlX2lkICkgXSB8fCAnJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0KVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZWZyZXNoIGV2ZXJ5IHJlbmRlcmVkIGNvbnRyb2wgYWZmZWN0ZWQgYnkgcHJlc2VudGF0aW9uIHN0YXRlIGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcHJlc2VudGF0aW9uX2lkIFJlZ2lzdGVyZWQgcHJlc2VudGF0aW9uIElELlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfcm93X3ByZXNlbnRhdGlvbl90b2dnbGVzKCBwcmVzZW50YXRpb25faWQgKSB7XG5cdFx0XHR2YXIgdG9nZ2xlcyA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi10b2dnbGVdJyApIDogW107XG5cblx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIHRvZ2dsZXMsIGZ1bmN0aW9uICggdG9nZ2xlICkge1xuXHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQ7XG5cdFx0XHRcdHZhciBkZXNjcmlwdG9yO1xuXHRcdFx0XHR2YXIgdG9nZ2xlX3N0YXRlO1xuXHRcdFx0XHR2YXIgaWNvbjtcblxuXHRcdFx0XHRpZiAoIHRvZ2dsZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi10b2dnbGUnICkgIT09IHByZXNlbnRhdGlvbl9pZCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzb3VyY2VfaWQgPSBOdW1iZXIoIHRvZ2dsZS5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtaWQnICkgKTtcblx0XHRcdFx0ZGVzY3JpcHRvciA9IGdldF9hdXRob3JpemVkX3Jvd19wcmVzZW50YXRpb24oIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQgKTtcblx0XHRcdFx0aWYgKCAhIGRlc2NyaXB0b3IgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRvZ2dsZV9zdGF0ZSA9IGdldF9yb3dfcHJlc2VudGF0aW9uX3RvZ2dsZV9zdGF0ZSggcmVzb3VyY2VfaWQsIGRlc2NyaXB0b3IgKTtcblx0XHRcdFx0dG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCB0b2dnbGVfc3RhdGUuaXNfb3BlbiA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0dG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtY29udHJvbHMnLCB0b2dnbGVfc3RhdGUuY29udHJvbGxlZF9ob3N0X2lkcyApO1xuXHRcdFx0XHR0b2dnbGUuc2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbCcsIHRvZ2dsZV9zdGF0ZS5hY2Nlc3NpYmxlX2xhYmVsICk7XG5cdFx0XHRcdHRvZ2dsZS5zZXRBdHRyaWJ1dGUoICd0aXRsZScsIHRvZ2dsZV9zdGF0ZS5hY2Nlc3NpYmxlX2xhYmVsICk7XG5cdFx0XHRcdGljb24gPSB0b2dnbGUucXVlcnlTZWxlY3RvciggJ1tjbGFzcyo9XCJ3cGJjLWJpLWNoZXZyb24tXCJdJyApO1xuXHRcdFx0XHRpZiAoIGljb24gKSB7XG5cdFx0XHRcdFx0aWNvbi5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiYy1iaS1jaGV2cm9uLXJpZ2h0JywgJ3dwYmMtYmktY2hldnJvbi1kb3duJyApO1xuXHRcdFx0XHRcdGljb24uY2xhc3NMaXN0LmFkZCggdG9nZ2xlX3N0YXRlLmlzX29wZW4gPyAnd3BiYy1iaS1jaGV2cm9uLWRvd24nIDogJ3dwYmMtYmktY2hldnJvbi1yaWdodCcgKTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlY29uY2lsZSByZXRhaW5lZCBvcGVuIHN0YXRlIGFnYWluc3QgdGhlIGxhdGVzdCBhdXRob3JpemVkIFJlc291cmNlIERUT3MuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0FycmF5PE9iamVjdD59IHJlc291cmNlcyBMYXRlc3QgYXV0aG9yaXplZCBSZXNvdXJjZSBEVE9zLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVjb25jaWxlX3Jvd19wcmVzZW50YXRpb25zKCByZXNvdXJjZXMgKSB7XG5cdFx0XHR2YXIgbmV4dF9hdXRob3JpemVkID0ge307XG5cdFx0XHR2YXIgbmV4dF9yZXNvdXJjZV9pZHNfaW5fb3JkZXIgPSBbXTtcblx0XHRcdHZhciBuZXh0X2NoaWxkcmVuX2J5X3BhcmVudCA9IHt9O1xuXHRcdFx0dmFyIG5leHRfdGl0bGVzX2J5X2lkID0ge307XG5cblx0XHRcdHJlc291cmNlcy5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlICkge1xuXHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggTnVtYmVyKCByZXNvdXJjZSAmJiByZXNvdXJjZS5pZCApIHx8IDAgKSApO1xuXHRcdFx0XHR2YXIgcGFyZW50X2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggcmVzb3VyY2UgJiYgcmVzb3VyY2UucGFyZW50X2lkICkgfHwgMCApICk7XG5cblx0XHRcdFx0aWYgKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRuZXh0X2F1dGhvcml6ZWRbIHJlc291cmNlX2lkIF0gPSBub3JtYWxpemVfcm93X3ByZXNlbnRhdGlvbnMoIHJlc291cmNlLnJvd19wcmVzZW50YXRpb25zICk7XG5cdFx0XHRcdFx0bmV4dF9yZXNvdXJjZV9pZHNfaW5fb3JkZXIucHVzaCggcmVzb3VyY2VfaWQgKTtcblx0XHRcdFx0XHRuZXh0X3RpdGxlc19ieV9pZFsgcmVzb3VyY2VfaWQgXSA9IFN0cmluZyggcmVzb3VyY2UudGl0bGUgfHwgJycgKTtcblx0XHRcdFx0XHRpZiAoIHBhcmVudF9pZCApIHtcblx0XHRcdFx0XHRcdGlmICggISBuZXh0X2NoaWxkcmVuX2J5X3BhcmVudFsgcGFyZW50X2lkIF0gKSB7XG5cdFx0XHRcdFx0XHRcdG5leHRfY2hpbGRyZW5fYnlfcGFyZW50WyBwYXJlbnRfaWQgXSA9IFtdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0bmV4dF9jaGlsZHJlbl9ieV9wYXJlbnRbIHBhcmVudF9pZCBdLnB1c2goIHJlc291cmNlX2lkICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0XHRPYmplY3Qua2V5cyggb3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZF9rZXkgKSB7XG5cdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE51bWJlciggcmVzb3VyY2VfaWRfa2V5ICk7XG5cblx0XHRcdFx0T2JqZWN0LmtleXMoIG9wZW5fcHJlc2VudGF0aW9uc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSB8fCB7fSApLmZvckVhY2goIGZ1bmN0aW9uICggcHJlc2VudGF0aW9uX2lkICkge1xuXHRcdFx0XHRcdHZhciBuZXh0X2Rlc2NyaXB0b3IgPSAoIG5leHRfYXV0aG9yaXplZFsgcmVzb3VyY2VfaWQgXSB8fCBbXSApLmZpbHRlciggZnVuY3Rpb24gKCBkZXNjcmlwdG9yICkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGRlc2NyaXB0b3IuaWQgPT09IHByZXNlbnRhdGlvbl9pZDtcblx0XHRcdFx0XHR9IClbIDAgXTtcblx0XHRcdFx0XHR2YXIgcHJldmlvdXNfZGVzY3JpcHRvciA9IGdldF9hdXRob3JpemVkX3Jvd19wcmVzZW50YXRpb24oIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQgKTtcblxuXHRcdFx0XHRcdGlmICggISBuZXh0X2Rlc2NyaXB0b3IgKSB7XG5cdFx0XHRcdFx0XHRlbWl0X3Jvd19wcmVzZW50YXRpb25fZXZlbnQoICdyZW1vdmVkJywgcmVzb3VyY2VfaWQsIHByZXZpb3VzX2Rlc2NyaXB0b3IgfHwge1xuXHRcdFx0XHRcdFx0XHRpZDogcHJlc2VudGF0aW9uX2lkLFxuXHRcdFx0XHRcdFx0XHR0ZW1wbGF0ZV9rZXk6ICcnXG5cdFx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0XHRkZWxldGUgb3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdWyBwcmVzZW50YXRpb25faWQgXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdFx0aWYgKCAhIE9iamVjdC5rZXlzKCBvcGVuX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gfHwge30gKS5sZW5ndGggKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIG9wZW5fcHJlc2VudGF0aW9uc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0YXV0aG9yaXplZF9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlID0gbmV4dF9hdXRob3JpemVkO1xuXHRcdFx0YXV0aG9yaXplZF9yZXNvdXJjZV9pZHNfaW5fb3JkZXIgPSBuZXh0X3Jlc291cmNlX2lkc19pbl9vcmRlcjtcblx0XHRcdHJlc291cmNlX2NoaWxkcmVuX2J5X3BhcmVudCA9IG5leHRfY2hpbGRyZW5fYnlfcGFyZW50O1xuXHRcdFx0cmVzb3VyY2VfdGl0bGVzX2J5X2lkID0gbmV4dF90aXRsZXNfYnlfaWQ7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2FwdHVyZSBmb2N1cyBpZGVudGl0eSBiZWZvcmUgdGVtcGxhdGUtb3duZWQgcm93IHJlcGxhY2VtZW50LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFN0YWJsZSB0b2dnbGUgaWRlbnRpdHkgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjYXB0dXJlX3Jvd19wcmVzZW50YXRpb25fZm9jdXMoKSB7XG5cdFx0XHR2YXIgYWN0aXZlX2VsZW1lbnQgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdFx0dmFyIHRvZ2dsZSA9IGFjdGl2ZV9lbGVtZW50ICYmIGFjdGl2ZV9lbGVtZW50LmNsb3Nlc3Rcblx0XHRcdFx0PyBhY3RpdmVfZWxlbWVudC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLXRvZ2dsZV0nIClcblx0XHRcdFx0OiBudWxsO1xuXG5cdFx0XHRyZXR1cm4gdG9nZ2xlID8ge1xuXHRcdFx0XHRyZXNvdXJjZV9pZDogTnVtYmVyKCB0b2dnbGUuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJlc291cmNlLWlkJyApICksXG5cdFx0XHRcdHByZXNlbnRhdGlvbl9pZDogdG9nZ2xlLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLXRvZ2dsZScgKVxuXHRcdFx0fSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVzdG9yZSBmb2N1cyB0byB0aGUgZXF1aXZhbGVudCBhdXRob3JpemVkIHRvZ2dsZSBhZnRlciBhIHJlcmVuZGVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R8bnVsbH0gZm9jdXNfaWRlbnRpdHkgQ2FwdHVyZWQgdG9nZ2xlIGlkZW50aXR5LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVzdG9yZV9yb3dfcHJlc2VudGF0aW9uX2ZvY3VzKCBmb2N1c19pZGVudGl0eSApIHtcblx0XHRcdHZhciB0b2dnbGUgPSBmb2N1c19pZGVudGl0eVxuXHRcdFx0XHQ/IGdldF9yb3dfcHJlc2VudGF0aW9uX3RvZ2dsZSggZm9jdXNfaWRlbnRpdHkucmVzb3VyY2VfaWQsIGZvY3VzX2lkZW50aXR5LnByZXNlbnRhdGlvbl9pZCApXG5cdFx0XHRcdDogbnVsbDtcblxuXHRcdFx0aWYgKCB0b2dnbGUgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRvZ2dsZS5mb2N1cyApIHtcblx0XHRcdFx0dG9nZ2xlLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGVkdXBsaWNhdGUgc3RhYmxlIGJvb2tpbmcgc3BhbnMgd2hlbiBhZGphY2VudCB3aW5kb3dzIG92ZXJsYXAuXG5cdFx0ICpcblx0XHQgKiBSZWN1cnJlbnQgb3IgZGlzY29udGludW91cyBzcGFucyByZXRhaW4gZGlzdGluY3Qgc3RhYmxlIHNlZ21lbnQgSURzO1xuXHRcdCAqIG9ubHkgYSByZXBlYXRlZCBwcm9qZWN0aW9uIG9mIHRoZSBzYW1lIHNlZ21lbnQgaXMgZGlzY2FyZGVkLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSBzZWdtZW50cyBCb29raW5nIHNlZ21lbnRzIGZyb20gY29tcG9zZWQgd2luZG93cy5cblx0XHQgKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+fSBGaXJzdCBvY2N1cnJlbmNlIG9mIGV2ZXJ5IHN0YWJsZSBzZWdtZW50IElELlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlZHVwbGljYXRlX3NlZ21lbnRzKCBzZWdtZW50cyApIHtcblx0XHRcdHZhciBzZWVuX3NlZ21lbnRfaWRzID0ge307XG5cblx0XHRcdHJldHVybiBzZWdtZW50cy5maWx0ZXIoIGZ1bmN0aW9uICggc2VnbWVudCApIHtcblx0XHRcdFx0dmFyIHNlZ21lbnRfaWQgPSBzZWdtZW50ICYmIHNlZ21lbnQuc2VnbWVudF9pZCA/IFN0cmluZyggc2VnbWVudC5zZWdtZW50X2lkICkgOiAnJztcblxuXHRcdFx0XHRpZiAoICEgc2VnbWVudF9pZCB8fCBzZWVuX3NlZ21lbnRfaWRzWyBzZWdtZW50X2lkIF0gKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlZW5fc2VnbWVudF9pZHNbIHNlZ21lbnRfaWQgXSA9IHRydWU7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFwcGx5IHN0YWJsZSB3aGl0ZS9ncmF5IGJhbmRpbmcgdG8gY3VycmVudGx5IHZpc2libGUgVGltZWxpbmUgcm93cy5cblx0XHQgKlxuXHRcdCAqIEhpZGRlbiBoaWVyYXJjaHkgcm93cyBhcmUgZXhjbHVkZWQgc28gY29sbGFwc2luZyBhIGNhcGFjaXR5IHBhcmVudCBkb2VzXG5cdFx0ICogbm90IGxlYXZlIGFkamFjZW50IHZpc2libGUgcm93cyB3aXRoIHRoZSBzYW1lIHByZXNlbnRhdGlvbiBiYW5kLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB1cGRhdGVfdmlzaWJsZV9yb3dfc3RyaXBpbmcoKSB7XG5cdFx0XHR2YXIgdmlzaWJsZV9yb3dfaW5kZXggPSAwO1xuXHRcdFx0dmFyIGNhbnZhc19yb3dzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdGltZWxpbmVfX2NhbnZhc19yb3cnICkgOiBbXTtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggY2FudmFzX3Jvd3MsIGZ1bmN0aW9uICggY2FudmFzX3JvdyApIHtcblx0XHRcdFx0Y2FudmFzX3Jvdy5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtb2RkJywgJ2lzLWV2ZW4nICk7XG5cdFx0XHRcdGlmICggY2FudmFzX3Jvdy5oaWRkZW4gKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y2FudmFzX3Jvdy5jbGFzc0xpc3QuYWRkKCAwID09PSB2aXNpYmxlX3Jvd19pbmRleCAlIDIgPyAnaXMtb2RkJyA6ICdpcy1ldmVuJyApO1xuXHRcdFx0XHR2aXNpYmxlX3Jvd19pbmRleCArPSAxO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldGFpbiBvbmUgYnJvd3Nlci1vd25lZCBSZXNvdXJjZSBleHBhbnNpb24gc3RhdGUgYWNyb3NzIGNvbXBsZXRlIHJlbmRlcnMuXG5cdFx0ICpcblx0XHQgKiBXaW5kb3ctY2FjaGUgY29tcG9zaXRpb24gcmVwbGFjZXMgYm90aCByb3cgaGFsdmVzIGZyb20gdGVtcGxhdGVzLiBLZWVwaW5nXG5cdFx0ICogdGhlIGV4YWN0IHBvc2l0aXZlIFJlc291cmNlIElEcyBpbiB0aGUgc2hhcmVkIHNldHRpbmdzIG9iamVjdCBwcmV2ZW50cyBhXG5cdFx0ICogbGF0ZXIgY2FjaGUgcHJvbW90aW9uIGZyb20gcmVzdG9yaW5nIGFuIG9sZGVyIHNlcnZlciBwcmVmZXJlbmNlIHNuYXBzaG90LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9ICBwcmVmZXJlbmNlX2tleSBFeHBhbmRlZCBSZXNvdXJjZSBwcmVmZXJlbmNlIGtleS5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIHJlc291cmNlX2lkICAgIEF1dGhvcml6ZWQgUmVzb3VyY2UgSUQuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBpc19leHBhbmRlZCAgICBEZXNpcmVkIGJyb3dzZXIgcHJlc2VudGF0aW9uIHN0YXRlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmV0YWluX2V4cGFuc2lvbl9zdGF0ZSggcHJlZmVyZW5jZV9rZXksIHJlc291cmNlX2lkLCBpc19leHBhbmRlZCApIHtcblx0XHRcdHZhciByZXRhaW5lZF9pZHM7XG5cblx0XHRcdHJlc291cmNlX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggcmVzb3VyY2VfaWQgKSB8fCAwICkgKTtcblx0XHRcdGlmICggISByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHNldHRpbmdzLnByZWZlcmVuY2VzIHx8ICdvYmplY3QnICE9PSB0eXBlb2Ygc2V0dGluZ3MucHJlZmVyZW5jZXMgKSB7XG5cdFx0XHRcdHNldHRpbmdzLnByZWZlcmVuY2VzID0ge307XG5cdFx0XHR9XG5cdFx0XHRyZXRhaW5lZF9pZHMgPSAoIEFycmF5LmlzQXJyYXkoIHNldHRpbmdzLnByZWZlcmVuY2VzWyBwcmVmZXJlbmNlX2tleSBdIClcblx0XHRcdFx0PyBzZXR0aW5ncy5wcmVmZXJlbmNlc1sgcHJlZmVyZW5jZV9rZXkgXVxuXHRcdFx0XHQ6IFtdXG5cdFx0XHQpLm1hcCggZnVuY3Rpb24gKCByZXRhaW5lZF9pZCApIHtcblx0XHRcdFx0cmV0dXJuIE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIHJldGFpbmVkX2lkICkgfHwgMCApICk7XG5cdFx0XHR9ICkuZmlsdGVyKCBmdW5jdGlvbiAoIHJldGFpbmVkX2lkLCByZXRhaW5lZF9pbmRleCwgYWxsX3JldGFpbmVkX2lkcyApIHtcblx0XHRcdFx0cmV0dXJuIHJldGFpbmVkX2lkXG5cdFx0XHRcdFx0JiYgcmV0YWluZWRfaWQgIT09IHJlc291cmNlX2lkXG5cdFx0XHRcdFx0JiYgcmV0YWluZWRfaW5kZXggPT09IGFsbF9yZXRhaW5lZF9pZHMuaW5kZXhPZiggcmV0YWluZWRfaWQgKTtcblx0XHRcdH0gKTtcblx0XHRcdGlmICggaXNfZXhwYW5kZWQgKSB7XG5cdFx0XHRcdHJldGFpbmVkX2lkcy5wdXNoKCByZXNvdXJjZV9pZCApO1xuXHRcdFx0fVxuXHRcdFx0cmV0YWluZWRfaWRzLnNvcnQoIGZ1bmN0aW9uICggbGVmdF9pZCwgcmlnaHRfaWQgKSB7XG5cdFx0XHRcdHJldHVybiBsZWZ0X2lkIC0gcmlnaHRfaWQ7XG5cdFx0XHR9ICk7XG5cdFx0XHRzZXR0aW5ncy5wcmVmZXJlbmNlc1sgcHJlZmVyZW5jZV9rZXkgXSA9IHJldGFpbmVkX2lkcztcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTdG9wIG9ic2VydmluZyByb3dzIHRoYXQgYXJlIGFib3V0IHRvIGJlIHJlcGxhY2VkIGJ5IGEgY29tcGxldGUgcmVuZGVyLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNldF9yb3dfb2JzZXJ2YXRpb25zKCkge1xuXHRcdFx0aWYgKCByb3dfb2JzZXJ2ZXIgKSB7XG5cdFx0XHRcdHJvd19vYnNlcnZlci5kaXNjb25uZWN0KCk7XG5cdFx0XHR9XG5cdFx0XHRvYnNlcnZlZF9yb3dfZWxlbWVudHMgPSBuZXcgd2luZG93LldlYWtTZXQoKTtcblx0XHRcdGV4cGVjdGVkX3Jvd19oZWlnaHRzID0gbmV3IHdpbmRvdy5XZWFrTWFwKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGF1dGhvcml6ZWQgUmVzb3VyY2Ugcm93cyBhbmQgYm9va2luZyBjYXJkcyB0aHJvdWdoIHRlbXBsYXRlcy5cblx0XHQgKlxuXHRcdCAqIFRoZSBtZXRob2QgcHJlc2VydmVzIHNlcnZlci9jb21wb3NpdGlvbi1vd25lZCBsYW5lIGluZGV4ZXMgYW5kIGNvdW50cy5cblx0XHQgKiBJdCBuZXZlciBjYWxjdWxhdGVzIGJvb2tpbmcgY29sbGlzaW9ucyBvciBjb25zdHJ1Y3RzIGNvbXBsZXRlIG1hcmt1cC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBpbml0aWFsIEF1dGhvcml6ZWQgUmVzb3VyY2UgYW5kIHNlZ21lbnQgcHJlc2VudGF0aW9uIERUT3MuXG5cdFx0ICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGF0IGxlYXN0IG9uZSBSZXNvdXJjZSByb3cgd2FzIHJlbmRlcmVkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl9yb3dzKCBpbml0aWFsICkge1xuXHRcdFx0aW5pdGlhbCA9IGluaXRpYWwgfHwge307XG5cdFx0XHR2YXIgcmVzb3VyY2VzID0gQXJyYXkuaXNBcnJheSggaW5pdGlhbC5yZXNvdXJjZXMgKSA/IGluaXRpYWwucmVzb3VyY2VzIDogW107XG5cdFx0XHR2YXIgcHJlc2VudGF0aW9uX2ZvY3VzID0gY2FwdHVyZV9yb3dfcHJlc2VudGF0aW9uX2ZvY3VzKCk7XG5cdFx0XHR2YXIgc2VnbWVudHMgPSBkZWR1cGxpY2F0ZV9zZWdtZW50cyggQXJyYXkuaXNBcnJheSggaW5pdGlhbC5zZWdtZW50cyApID8gaW5pdGlhbC5zZWdtZW50cyA6IFtdICk7XG5cdFx0XHR2YXIgdGltZV9zbG90X292ZXJmbG93cyA9IEFycmF5LmlzQXJyYXkoIGluaXRpYWwudGltZV9zbG90X292ZXJmbG93cyApID8gaW5pdGlhbC50aW1lX3Nsb3Rfb3ZlcmZsb3dzIDogW107XG5cdFx0XHR2YXIgZGV0YWlsc19leHBhbmRlZF9pZHMgPSBBcnJheS5pc0FycmF5KCBzZXR0aW5ncy5wcmVmZXJlbmNlcyAmJiBzZXR0aW5ncy5wcmVmZXJlbmNlcy5leHBhbmRlZF9yZXNvdXJjZV9pZHMgKSA/IHNldHRpbmdzLnByZWZlcmVuY2VzLmV4cGFuZGVkX3Jlc291cmNlX2lkcyA6IFtdO1xuXHRcdFx0dmFyIGhpZXJhcmNoeV9leHBhbmRlZF9pZHMgPSBBcnJheS5pc0FycmF5KCBzZXR0aW5ncy5wcmVmZXJlbmNlcyAmJiBzZXR0aW5ncy5wcmVmZXJlbmNlcy5leHBhbmRlZF9wYXJlbnRfaWRzICkgPyBzZXR0aW5ncy5wcmVmZXJlbmNlcy5leHBhbmRlZF9wYXJlbnRfaWRzIDogW107XG5cdFx0XHR2YXIgZGV0YWlsc19leHBhbmRlZF9tYXAgPSB7fTtcblx0XHRcdHZhciBoaWVyYXJjaHlfZXhwYW5kZWRfbWFwID0ge307XG5cdFx0XHR2YXIgcmVzb3VyY2Vfc3VtbWFyaWVzX2J5X2lkID0ge307XG5cdFx0XHR2YXIgcmVzb3VyY2VfaG9zdCA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2Utcm93c10nICkgOiBudWxsO1xuXHRcdFx0dmFyIGNhbnZhc19ob3N0ID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lbGluZS1jYW52YXMtcm93c10nICkgOiBudWxsO1xuXHRcdFx0dmFyIHJvd190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggJ3Jlc291cmNlX3JvdycgKTtcblx0XHRcdHZhciBzZWdtZW50X3RlbXBsYXRlID0gZ2V0X3RlbXBsYXRlKCAnYm9va2luZ19zZWdtZW50JyApO1xuXHRcdFx0dmFyIHRpbWVfc2xvdF9vdmVyZmxvd190ZW1wbGF0ZSA9IGdldF90ZW1wbGF0ZSggJ3RpbWVfc2xvdF9vdmVyZmxvdycgKTtcblxuXHRcdFx0aWYgKCAhIHJlc291cmNlX2hvc3QgfHwgISBjYW52YXNfaG9zdCB8fCAhIHJvd190ZW1wbGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0cmVjb25jaWxlX3Jvd19wcmVzZW50YXRpb25zKCByZXNvdXJjZXMgKTtcblx0XHRcdGJlZ2luX2Jvb2tpbmdfcmVmcmVzaCgpO1xuXHRcdFx0cmVzb3VyY2VzLmZvckVhY2goIGZ1bmN0aW9uICggcmVzb3VyY2UgKSB7XG5cdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIHJlc291cmNlICYmIHJlc291cmNlLmlkICkgfHwgMCApICk7XG5cblx0XHRcdFx0aWYgKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0XHRyZXNvdXJjZV9zdW1tYXJpZXNfYnlfaWRbIHJlc291cmNlX2lkIF0gPSByZXNvdXJjZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0cmVzZXRfcm93X29ic2VydmF0aW9ucygpO1xuXHRcdFx0cmVzb3VyY2VfaG9zdC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0Y2FudmFzX2hvc3QudGV4dENvbnRlbnQgPSAnJztcblxuXHRcdFx0ZGV0YWlsc19leHBhbmRlZF9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0ZGV0YWlsc19leHBhbmRlZF9tYXBbIE51bWJlciggcmVzb3VyY2VfaWQgKSBdID0gdHJ1ZTtcblx0XHRcdH0gKTtcblx0XHRcdGhpZXJhcmNoeV9leHBhbmRlZF9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcblx0XHRcdFx0aGllcmFyY2h5X2V4cGFuZGVkX21hcFsgTnVtYmVyKCByZXNvdXJjZV9pZCApIF0gPSB0cnVlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXNvdXJjZXMuZm9yRWFjaCggZnVuY3Rpb24gKCByZXNvdXJjZSApIHtcblx0XHRcdFx0dmFyIHJlc291cmNlX2lkID0gTnVtYmVyKCByZXNvdXJjZS5pZCApO1xuXHRcdFx0XHR2YXIgcm93X3ByZXNlbnRhdGlvbnMgPSBhdXRob3JpemVkX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gfHwgW107XG5cdFx0XHRcdHZhciBvcGVuX3Jvd19wcmVzZW50YXRpb25faWRzID0gT2JqZWN0LmtleXMoIG9wZW5fcHJlc2VudGF0aW9uc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSB8fCB7fSApO1xuXHRcdFx0XHR2YXIgcm93X3ByZXNlbnRhdGlvbl90b2dnbGVfc3RhdGVzID0ge307XG5cblx0XHRcdFx0cm93X3ByZXNlbnRhdGlvbnMuZm9yRWFjaCggZnVuY3Rpb24gKCBkZXNjcmlwdG9yICkge1xuXHRcdFx0XHRcdHJvd19wcmVzZW50YXRpb25fdG9nZ2xlX3N0YXRlc1sgZGVzY3JpcHRvci5pZCBdID0gZ2V0X3Jvd19wcmVzZW50YXRpb25fdG9nZ2xlX3N0YXRlKCByZXNvdXJjZV9pZCwgZGVzY3JpcHRvciApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHZhciByb3dfdmlld19tb2RlbCA9IE9iamVjdC5hc3NpZ24oIHt9LCByZXNvdXJjZSwge1xuXHRcdFx0XHRcdGF4aXM6IHNldHRpbmdzLmF4aXMsXG5cdFx0XHRcdFx0aTE4bjogc2V0dGluZ3MuaTE4bixcblx0XHRcdFx0XHRyb3dfcHJlc2VudGF0aW9uczogcm93X3ByZXNlbnRhdGlvbnMsXG5cdFx0XHRcdFx0b3Blbl9yb3dfcHJlc2VudGF0aW9uX2lkczogb3Blbl9yb3dfcHJlc2VudGF0aW9uX2lkcyxcblx0XHRcdFx0XHRyb3dfcHJlc2VudGF0aW9uX3RvZ2dsZV9zdGF0ZXM6IHJvd19wcmVzZW50YXRpb25fdG9nZ2xlX3N0YXRlcyxcblx0XHRcdFx0XHRpc19kZXRhaWxzX2V4cGFuZGVkOiBCb29sZWFuKCByZXNvdXJjZS5oYXNfZGV0YWlscyAmJiBkZXRhaWxzX2V4cGFuZGVkX21hcFsgTnVtYmVyKCByZXNvdXJjZS5pZCApIF0gKSxcblx0XHRcdFx0XHRpc19oaWVyYXJjaHlfZXhwYW5kZWQ6IEJvb2xlYW4oIHJlc291cmNlLmlzX2V4cGFuZGFibGUgJiYgaGllcmFyY2h5X2V4cGFuZGVkX21hcFsgTnVtYmVyKCByZXNvdXJjZS5pZCApIF0gKSxcblx0XHRcdFx0XHRpc19oaWVyYXJjaHlfdmlzaWJsZTogISByZXNvdXJjZS5pc19jaGlsZCB8fCBCb29sZWFuKCBoaWVyYXJjaHlfZXhwYW5kZWRfbWFwWyBOdW1iZXIoIHJlc291cmNlLnBhcmVudF9pZCApIF0gKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHZhciByb3dfYnVmZmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdFx0dmFyIHJlc291cmNlX3Jvdztcblx0XHRcdFx0dmFyIGNhbnZhc19yb3c7XG5cblx0XHRcdFx0cm93X2J1ZmZlci5pbm5lckhUTUwgPSByb3dfdGVtcGxhdGUoIHJvd192aWV3X21vZGVsICk7XG5cdFx0XHRcdHJlc291cmNlX3JvdyA9IHJvd19idWZmZXIuY2hpbGRyZW5bIDAgXTtcblx0XHRcdFx0Y2FudmFzX3JvdyA9IHJvd19idWZmZXIuY2hpbGRyZW5bIDEgXTtcblx0XHRcdFx0aWYgKCAhIHJlc291cmNlX3JvdyB8fCAhIGNhbnZhc19yb3cgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc291cmNlX2hvc3QuYXBwZW5kQ2hpbGQoIHJlc291cmNlX3JvdyApO1xuXHRcdFx0XHRjYW52YXNfaG9zdC5hcHBlbmRDaGlsZCggY2FudmFzX3JvdyApO1xuXHRcdFx0XHRyb3dfcHJlc2VudGF0aW9ucy5mb3JFYWNoKCBmdW5jdGlvbiAoIGRlc2NyaXB0b3IgKSB7XG5cdFx0XHRcdFx0ZW1pdF9yb3dfcHJlc2VudGF0aW9uX2V2ZW50KCAnaG9zdHMtcmVhZHknLCByZXNvdXJjZV9pZCwgZGVzY3JpcHRvciwge1xuXHRcdFx0XHRcdFx0aXNfb3BlbjogaXNfcm93X3ByZXNlbnRhdGlvbl9vcGVuKCByZXNvdXJjZV9pZCwgZGVzY3JpcHRvci5pZCApXG5cdFx0XHRcdFx0fSApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cdFx0XHR1cGRhdGVfdmlzaWJsZV9yb3dfc3RyaXBpbmcoKTtcblx0XHRcdHJlc3RvcmVfcm93X3ByZXNlbnRhdGlvbl9mb2N1cyggcHJlc2VudGF0aW9uX2ZvY3VzICk7XG5cblx0XHRcdGlmICggc2VnbWVudF90ZW1wbGF0ZSApIHtcblx0XHRcdFx0c2VnbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCBzZWdtZW50ICkge1xuXHRcdFx0XHRcdHZhciBzZWdtZW50X2hvc3Q7XG5cdFx0XHRcdFx0dmFyIHNlZ21lbnRfYnVmZmVyO1xuXHRcdFx0XHRcdHZhciBzZWdtZW50X2VsZW1lbnQ7XG5cblx0XHRcdFx0XHRpZiAoIGZhbHNlID09PSBzZWdtZW50LmlzX3Zpc2libGUgfHwgdHJ1ZSA9PT0gc2VnbWVudC5pc190aW1lX3Nsb3Rfb3ZlcmZsb3dfaXRlbSApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2VnbWVudF9ob3N0ID0gY2FudmFzX2hvc3QucXVlcnlTZWxlY3Rvcihcblx0XHRcdFx0XHRcdCdbZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXk9XCJyZXNvdXJjZS0nICsgTnVtYmVyKCBzZWdtZW50LnJlc291cmNlX2lkICkgKyAnXCJdIFtkYXRhLXdwYmMtdGltZWxpbmUtc2VnbWVudHNdJ1xuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0aWYgKCAhIHNlZ21lbnRfaG9zdCApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2VnbWVudF9idWZmZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnZGl2JyApO1xuXHRcdFx0XHRcdHNlZ21lbnRfYnVmZmVyLmlubmVySFRNTCA9IHNlZ21lbnRfdGVtcGxhdGUoIE9iamVjdC5hc3NpZ24oIHt9LCBzZWdtZW50LCB7XG5cdFx0XHRcdFx0XHRpMThuOiBzZXR0aW5ncy5pMThuXG5cdFx0XHRcdFx0fSApICk7XG5cdFx0XHRcdFx0c2VnbWVudF9lbGVtZW50ID0gc2VnbWVudF9idWZmZXIuZmlyc3RFbGVtZW50Q2hpbGQ7XG5cdFx0XHRcdFx0aWYgKCBzZWdtZW50X2VsZW1lbnQgKSB7XG5cdFx0XHRcdFx0XHRzZWdtZW50X2hvc3QuYXBwZW5kQ2hpbGQoIHNlZ21lbnRfZWxlbWVudCApO1xuXHRcdFx0XHRcdFx0cmVnaXN0ZXJfYm9va2luZ19zZWdtZW50KFxuXHRcdFx0XHRcdFx0XHRzZWdtZW50X2VsZW1lbnQsXG5cdFx0XHRcdFx0XHRcdHNlZ21lbnQsXG5cdFx0XHRcdFx0XHRcdHJlc291cmNlX3N1bW1hcmllc19ieV9pZFsgTnVtYmVyKCBzZWdtZW50LnJlc291cmNlX2lkICkgXSB8fCB7fVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGlmICggdGltZV9zbG90X292ZXJmbG93X3RlbXBsYXRlICkge1xuXHRcdFx0XHR0aW1lX3Nsb3Rfb3ZlcmZsb3dzLmZvckVhY2goIGZ1bmN0aW9uICggb3ZlcmZsb3cgKSB7XG5cdFx0XHRcdFx0dmFyIHNlZ21lbnRfaG9zdCA9IGNhbnZhc19ob3N0LnF1ZXJ5U2VsZWN0b3IoXG5cdFx0XHRcdFx0XHQnW2RhdGEtd3BiYy10aW1lbGluZS1yb3cta2V5PVwicmVzb3VyY2UtJyArIE51bWJlciggb3ZlcmZsb3cucmVzb3VyY2VfaWQgKSArICdcIl0gW2RhdGEtd3BiYy10aW1lbGluZS1zZWdtZW50c10nXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR2YXIgb3ZlcmZsb3dfYnVmZmVyO1xuXG5cdFx0XHRcdFx0aWYgKCAhIHNlZ21lbnRfaG9zdCApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b3ZlcmZsb3dfYnVmZmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcblx0XHRcdFx0XHRvdmVyZmxvd19idWZmZXIuaW5uZXJIVE1MID0gdGltZV9zbG90X292ZXJmbG93X3RlbXBsYXRlKCBPYmplY3QuYXNzaWduKCB7fSwgb3ZlcmZsb3csIHtcblx0XHRcdFx0XHRcdGkxOG46IHNldHRpbmdzLmkxOG5cblx0XHRcdFx0XHR9ICkgKTtcblx0XHRcdFx0XHRpZiAoIG92ZXJmbG93X2J1ZmZlci5maXJzdEVsZW1lbnRDaGlsZCApIHtcblx0XHRcdFx0XHRcdHNlZ21lbnRfaG9zdC5hcHBlbmRDaGlsZCggb3ZlcmZsb3dfYnVmZmVyLmZpcnN0RWxlbWVudENoaWxkICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cdFx0XHRjb21wbGV0ZV9ib29raW5nX3JlZnJlc2goKTtcblx0XHRcdHNjaGVkdWxlX3Jvd19zeW5jaHJvbml6YXRpb24oKTtcblx0XHRcdHJldHVybiAwIDwgcmVzb3VyY2VzLmxlbmd0aDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYWxsIHJvdyBoYWx2ZXMgZ3JvdXBlZCBieSB0aGVpciBzZXJ2ZXItcHJvdmlkZWQgc3RhYmxlIHJvdyBrZXkuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3Q8c3RyaW5nLEVsZW1lbnRbXT59IFJvdyBlbGVtZW50cyBrZXllZCBieSBzdGFibGUgcm93IElELlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGNvbGxlY3Rfcm93X2dyb3VwcygpIHtcblx0XHRcdHZhciByb3dfZ3JvdXBzID0ge307XG5cdFx0XHR2YXIgcm93X2VsZW1lbnRzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3cta2V5XScgKSA6IFtdO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCByb3dfZWxlbWVudHMsIGZ1bmN0aW9uICggcm93X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHZhciByb3dfa2V5ID0gcm93X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXknICk7XG5cblx0XHRcdFx0aWYgKCAhIHJvd19rZXkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggISByb3dfZ3JvdXBzWyByb3dfa2V5IF0gKSB7XG5cdFx0XHRcdFx0cm93X2dyb3Vwc1sgcm93X2tleSBdID0gW107XG5cdFx0XHRcdH1cblx0XHRcdFx0cm93X2dyb3Vwc1sgcm93X2tleSBdLnB1c2goIHJvd19lbGVtZW50ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHJldHVybiByb3dfZ3JvdXBzO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFsaWduIHZpc2libGUgcHJlc2VudGF0aW9uIGhvc3RzIGluc2lkZSBvbmUgc3luY2hyb25pemVkIHJvdyBncm91cC5cblx0XHQgKlxuXHRcdCAqIFJlc291cmNlIGFuZCBjYW52YXMgcm93cyBtYXkgaGF2ZSBkaWZmZXJlbnQgbmF0aXZlIGNvbnRlbnQsIHBhZGRpbmcsIG9yXG5cdFx0ICogZmxleCBnYXBzIGJlZm9yZSB0aGVpciBmdWxsLXdpZHRoIHByZXNlbnRhdGlvbiBob3N0cy4gRXF1YWxpemluZyBvbmx5IHRoZVxuXHRcdCAqIG91dGVyIHJvdyBoZWlnaHQgbGVhdmVzIHRob3NlIGludGVybmFsIHByZXNlbnRhdGlvbiBib3VuZGFyaWVzIG9mZnNldC5cblx0XHQgKiBUaGlzIG5ldXRyYWwgcGFzcyBtZWFzdXJlcyBlYWNoIG1hdGNoaW5nIHByZXNlbnRhdGlvbiBJRCBhbmQgYWRkcyBvbmx5IHRoZVxuXHRcdCAqIG1pc3NpbmcgbG9naWNhbC1ibG9jayBtYXJnaW4gdG8gaG9zdHMgdGhhdCBzdGFydCBlYXJsaWVyLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50W119IHJvd19lbGVtZW50cyBSZXNvdXJjZSBhbmQgY2FudmFzIGhhbHZlcyBvZiBvbmUgcm93LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfcm93X3ByZXNlbnRhdGlvbl9vZmZzZXRzKCByb3dfZWxlbWVudHMgKSB7XG5cdFx0XHR2YXIgcHJlc2VudGF0aW9uX2hvc3RzID0ge307XG5cdFx0XHR2YXIgcHJlc2VudGF0aW9uX2lkcyA9IFtdO1xuXG5cdFx0XHRyb3dfZWxlbWVudHMuZm9yRWFjaCggZnVuY3Rpb24gKCByb3dfZWxlbWVudCApIHtcblx0XHRcdFx0dmFyIHJvd19ob3N0cyA9IHJvd19lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1wcmVzZW50YXRpb24taG9zdF0nICk7XG5cblx0XHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggcm93X2hvc3RzLCBmdW5jdGlvbiAoIGhvc3RfZWxlbWVudCApIHtcblx0XHRcdFx0XHR2YXIgcHJlc2VudGF0aW9uX2lkID0gaG9zdF9lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLWhvc3QnICk7XG5cblx0XHRcdFx0XHRob3N0X2VsZW1lbnQuc3R5bGUubWFyZ2luQmxvY2tTdGFydCA9ICcnO1xuXHRcdFx0XHRcdGlmICggaG9zdF9lbGVtZW50LmhpZGRlbiB8fCAhIHByZXNlbnRhdGlvbl9pZCApIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCAhIHByZXNlbnRhdGlvbl9ob3N0c1sgcHJlc2VudGF0aW9uX2lkIF0gKSB7XG5cdFx0XHRcdFx0XHRwcmVzZW50YXRpb25faG9zdHNbIHByZXNlbnRhdGlvbl9pZCBdID0gW107XG5cdFx0XHRcdFx0XHRwcmVzZW50YXRpb25faWRzLnB1c2goIHByZXNlbnRhdGlvbl9pZCApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwcmVzZW50YXRpb25faG9zdHNbIHByZXNlbnRhdGlvbl9pZCBdLnB1c2goIGhvc3RfZWxlbWVudCApO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdHByZXNlbnRhdGlvbl9pZHMuZm9yRWFjaCggZnVuY3Rpb24gKCBwcmVzZW50YXRpb25faWQgKSB7XG5cdFx0XHRcdHZhciBob3N0cyA9IHByZXNlbnRhdGlvbl9ob3N0c1sgcHJlc2VudGF0aW9uX2lkIF07XG5cdFx0XHRcdHZhciBsYXRlc3Rfc3RhcnQgPSBudWxsO1xuXG5cdFx0XHRcdGlmICggMiA+IGhvc3RzLmxlbmd0aCApIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aG9zdHMuZm9yRWFjaCggZnVuY3Rpb24gKCBob3N0X2VsZW1lbnQgKSB7XG5cdFx0XHRcdFx0dmFyIGhvc3Rfc3RhcnQgPSBob3N0X2VsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkudG9wO1xuXG5cdFx0XHRcdFx0bGF0ZXN0X3N0YXJ0ID0gbnVsbCA9PT0gbGF0ZXN0X3N0YXJ0ID8gaG9zdF9zdGFydCA6IE1hdGgubWF4KCBsYXRlc3Rfc3RhcnQsIGhvc3Rfc3RhcnQgKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHRob3N0cy5mb3JFYWNoKCBmdW5jdGlvbiAoIGhvc3RfZWxlbWVudCApIHtcblx0XHRcdFx0XHR2YXIgc3RhcnRfb2Zmc2V0ID0gbGF0ZXN0X3N0YXJ0IC0gaG9zdF9lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcDtcblxuXHRcdFx0XHRcdGlmICggMC41IDwgc3RhcnRfb2Zmc2V0ICkge1xuXHRcdFx0XHRcdFx0aG9zdF9lbGVtZW50LnN0eWxlLm1hcmdpbkJsb2NrU3RhcnQgPSBzdGFydF9vZmZzZXQgKyAncHgnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFN5bmNocm9uaXplIFJlc291cmNlIGFuZCBjYW52YXMgcm93IGhlaWdodHMgYWZ0ZXIgbGF5b3V0IGNoYW5nZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ1tdfG51bGx9IHJvd19rZXlzIFN0YWJsZSByb3cga2V5cywgb3IgbnVsbCBmb3IgZXZlcnkgcm93LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc3luY2hyb25pemVfcm93X2hlaWdodHMoIHJvd19rZXlzICkge1xuXHRcdFx0dmFyIHJvd19ncm91cHMgPSBjb2xsZWN0X3Jvd19ncm91cHMoKTtcblx0XHRcdHZhciBzeW5jaHJvbml6ZV9ldmVyeV9yb3cgPSAhIEFycmF5LmlzQXJyYXkoIHJvd19rZXlzICkgfHwgISByb3dfa2V5cy5sZW5ndGg7XG5cblx0XHRcdE9iamVjdC5rZXlzKCByb3dfZ3JvdXBzICkuZm9yRWFjaCggZnVuY3Rpb24gKCByb3dfa2V5ICkge1xuXHRcdFx0XHR2YXIgbWF4aW11bV9oZWlnaHQgPSAwO1xuXHRcdFx0XHR2YXIgc3luY2hyb25pemVkX2hlaWdodDtcblx0XHRcdFx0dmFyIHN5bmNocm9uaXplZF9taW5pbXVtX2hlaWdodDtcblxuXHRcdFx0XHRpZiAoICEgc3luY2hyb25pemVfZXZlcnlfcm93ICYmIC0xID09PSByb3dfa2V5cy5pbmRleE9mKCByb3dfa2V5ICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJvd19ncm91cHNbIHJvd19rZXkgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvd19lbGVtZW50ICkge1xuXHRcdFx0XHRcdHJvd19lbGVtZW50LnN0eWxlLm1pbkhlaWdodCA9ICcnO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHRcdHN5bmNocm9uaXplX3Jvd19wcmVzZW50YXRpb25fb2Zmc2V0cyggcm93X2dyb3Vwc1sgcm93X2tleSBdICk7XG5cdFx0XHRcdHJvd19ncm91cHNbIHJvd19rZXkgXS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJvd19lbGVtZW50ICkge1xuXHRcdFx0XHRcdG1heGltdW1faGVpZ2h0ID0gTWF0aC5tYXgoIG1heGltdW1faGVpZ2h0LCByb3dfZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQgKTtcblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdHN5bmNocm9uaXplZF9oZWlnaHQgPSBNYXRoLmNlaWwoIG1heGltdW1faGVpZ2h0ICk7XG5cdFx0XHRcdHN5bmNocm9uaXplZF9taW5pbXVtX2hlaWdodCA9IHN5bmNocm9uaXplZF9oZWlnaHQgPyBzeW5jaHJvbml6ZWRfaGVpZ2h0ICsgJ3B4JyA6ICcnO1xuXHRcdFx0XHRyb3dfZ3JvdXBzWyByb3dfa2V5IF0uZm9yRWFjaCggZnVuY3Rpb24gKCByb3dfZWxlbWVudCApIHtcblx0XHRcdFx0XHRpZiAoIHJvd19vYnNlcnZlciApIHtcblx0XHRcdFx0XHRcdGV4cGVjdGVkX3Jvd19oZWlnaHRzLnNldCggcm93X2VsZW1lbnQsIHN5bmNocm9uaXplZF9oZWlnaHQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCByb3dfZWxlbWVudC5zdHlsZS5taW5IZWlnaHQgIT09IHN5bmNocm9uaXplZF9taW5pbXVtX2hlaWdodCApIHtcblx0XHRcdFx0XHRcdHJvd19lbGVtZW50LnN0eWxlLm1pbkhlaWdodCA9IHN5bmNocm9uaXplZF9taW5pbXVtX2hlaWdodDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0YWZ0ZXJfcm93X3N5bmNocm9uaXphdGlvbigpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJlcXVlc3Qgb25lIGNvYWxlc2NlZCByb3ctaGVpZ2h0IHN5bmNocm9uaXphdGlvbiBmb3IgdGhlIG5leHQgZnJhbWUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXXxFdmVudH0gcm93X2tleXMgU3RhYmxlIHJvdyBrZXkocyksIG9yIGFsbCByb3dzLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2NoZWR1bGVfcm93X3N5bmNocm9uaXphdGlvbiggcm93X2tleXMgKSB7XG5cdFx0XHRpZiAoICdzdHJpbmcnID09PSB0eXBlb2Ygcm93X2tleXMgJiYgcm93X2tleXMgKSB7XG5cdFx0XHRcdHBlbmRpbmdfcm93X2tleXNbIHJvd19rZXlzIF0gPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmICggQXJyYXkuaXNBcnJheSggcm93X2tleXMgKSApIHtcblx0XHRcdFx0cm93X2tleXMuZm9yRWFjaCggZnVuY3Rpb24gKCByb3dfa2V5ICkge1xuXHRcdFx0XHRcdGlmICggcm93X2tleSApIHtcblx0XHRcdFx0XHRcdHBlbmRpbmdfcm93X2tleXNbIHJvd19rZXkgXSA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9hbGxfcm93cyA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggc3luY2hyb25pemF0aW9uX2ZyYW1lICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzeW5jaHJvbml6YXRpb25fZnJhbWUgPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHZhciByb3dfa2V5c190b19zeW5jaHJvbml6ZSA9IHN5bmNocm9uaXplX2FsbF9yb3dzID8gbnVsbCA6IE9iamVjdC5rZXlzKCBwZW5kaW5nX3Jvd19rZXlzICk7XG5cblx0XHRcdFx0c3luY2hyb25pemF0aW9uX2ZyYW1lID0gMDtcblx0XHRcdFx0cGVuZGluZ19yb3dfa2V5cyA9IHt9O1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9hbGxfcm93cyA9IGZhbHNlO1xuXHRcdFx0XHRzeW5jaHJvbml6ZV9yb3dfaGVpZ2h0cyggcm93X2tleXNfdG9fc3luY2hyb25pemUgKTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gb25lIHJlbmRlcmVkIFRpbWVsaW5lIHJvdydzIGJvcmRlci1ib3ggaGVpZ2h0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFbGVtZW50fSByb3dfZWxlbWVudCBSZXNvdXJjZSBvciBjYW52YXMgcm93LlxuXHRcdCAqIEByZXR1cm4ge251bWJlcn0gUm91bmRlZCBDU1MtcGl4ZWwgaGVpZ2h0LlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9yb3dfaGVpZ2h0KCByb3dfZWxlbWVudCApIHtcblx0XHRcdHJldHVybiBNYXRoLmNlaWwoIHJvd19lbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmhlaWdodCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFByb2Nlc3Mgcm93IHJlc2l6ZSBlbnRyaWVzIHdpdGhvdXQgcmVhY3RpbmcgdG8gbW9kdWxlLWF1dGhvcmVkIHdyaXRlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7UmVzaXplT2JzZXJ2ZXJFbnRyeVtdfSByZXNpemVfZW50cmllcyBSZXNpemUgb2JzZXJ2YXRpb25zLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX3Jvd19yZXNpemUoIHJlc2l6ZV9lbnRyaWVzICkge1xuXHRcdFx0dmFyIGNoYW5nZWRfcm93X2tleXMgPSB7fTtcblxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggcmVzaXplX2VudHJpZXMsIGZ1bmN0aW9uICggcmVzaXplX2VudHJ5ICkge1xuXHRcdFx0XHR2YXIgcm93X2VsZW1lbnQgPSByZXNpemVfZW50cnkudGFyZ2V0O1xuXHRcdFx0XHR2YXIgcm93X2tleSA9IHJvd19lbGVtZW50LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yb3cta2V5JyApO1xuXHRcdFx0XHR2YXIgZXhwZWN0ZWRfaGVpZ2h0ID0gZXhwZWN0ZWRfcm93X2hlaWdodHMuZ2V0KCByb3dfZWxlbWVudCApO1xuXHRcdFx0XHR2YXIgY3VycmVudF9oZWlnaHQgPSBnZXRfcm93X2hlaWdodCggcm93X2VsZW1lbnQgKTtcblxuXHRcdFx0XHRpZiAoICdudW1iZXInID09PSB0eXBlb2YgZXhwZWN0ZWRfaGVpZ2h0ICYmIDEgPj0gTWF0aC5hYnMoIGN1cnJlbnRfaGVpZ2h0IC0gZXhwZWN0ZWRfaGVpZ2h0ICkgKSB7XG5cdFx0XHRcdFx0ZXhwZWN0ZWRfcm93X2hlaWdodHMuZGVsZXRlKCByb3dfZWxlbWVudCApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRleHBlY3RlZF9yb3dfaGVpZ2h0cy5kZWxldGUoIHJvd19lbGVtZW50ICk7XG5cdFx0XHRcdGlmICggcm93X2tleSApIHtcblx0XHRcdFx0XHRjaGFuZ2VkX3Jvd19rZXlzWyByb3dfa2V5IF0gPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cblx0XHRcdGlmICggT2JqZWN0LmtleXMoIGNoYW5nZWRfcm93X2tleXMgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHNjaGVkdWxlX3Jvd19zeW5jaHJvbml6YXRpb24oIE9iamVjdC5rZXlzKCBjaGFuZ2VkX3Jvd19rZXlzICkgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPYnNlcnZlIGVhY2ggY3VycmVudCByb3cgaGFsZiBleGFjdGx5IG9uY2UgZm9yIHNpemUgY2hhbmdlcy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ1tdfSBTdGFibGUga2V5cyBmb3IgbmV3bHkgb2JzZXJ2ZWQgcm93IGdyb3Vwcy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvYnNlcnZlX3Jvd3MoKSB7XG5cdFx0XHR2YXIgcm93X2VsZW1lbnRzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3cta2V5XScgKSA6IFtdO1xuXHRcdFx0dmFyIG5ld19yb3dfa2V5cyA9IHt9O1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCByb3dfZWxlbWVudHMsIGZ1bmN0aW9uICggcm93X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHZhciByb3dfa2V5O1xuXG5cdFx0XHRcdGlmICggcm93X3N5bmNocm9uaXphdGlvbl9pbml0aWFsaXplZCAmJiBvYnNlcnZlZF9yb3dfZWxlbWVudHMuaGFzKCByb3dfZWxlbWVudCApICkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyb3dfa2V5ID0gcm93X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXknICk7XG5cdFx0XHRcdGlmICggcm93X2tleSApIHtcblx0XHRcdFx0XHRuZXdfcm93X2tleXNbIHJvd19rZXkgXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCByb3dfc3luY2hyb25pemF0aW9uX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRcdG9ic2VydmVkX3Jvd19lbGVtZW50cy5hZGQoIHJvd19lbGVtZW50ICk7XG5cdFx0XHRcdFx0aWYgKCByb3dfb2JzZXJ2ZXIgKSB7XG5cdFx0XHRcdFx0XHRyb3dfb2JzZXJ2ZXIub2JzZXJ2ZSggcm93X2VsZW1lbnQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0aWYgKCBPYmplY3Qua2V5cyggbmV3X3Jvd19rZXlzICkubGVuZ3RoICkge1xuXHRcdFx0XHRzY2hlZHVsZV9yb3dfc3luY2hyb25pemF0aW9uKCBPYmplY3Qua2V5cyggbmV3X3Jvd19rZXlzICkgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBPYmplY3Qua2V5cyggbmV3X3Jvd19rZXlzICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogT2JzZXJ2ZSBuZXcgcm93cyBhbmQgZGlydHkgb25seSByb3cgZ3JvdXBzIHRvdWNoZWQgYnkgRE9NIG11dGF0aW9ucy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TXV0YXRpb25SZWNvcmRbXX0gbXV0YXRpb25fcmVjb3JkcyBDaGlsZC1saXN0IG11dGF0aW9ucy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9yb3dfbXV0YXRpb25zKCBtdXRhdGlvbl9yZWNvcmRzICkge1xuXHRcdFx0dmFyIGNoYW5nZWRfcm93X2tleXMgPSB7fTtcblxuXHRcdFx0b2JzZXJ2ZV9yb3dzKCk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBtdXRhdGlvbl9yZWNvcmRzLCBmdW5jdGlvbiAoIG11dGF0aW9uX3JlY29yZCApIHtcblx0XHRcdFx0dmFyIHJvd19lbGVtZW50ID0gbXV0YXRpb25fcmVjb3JkLnRhcmdldC5jbG9zZXN0XG5cdFx0XHRcdFx0PyBtdXRhdGlvbl9yZWNvcmQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXldJyApXG5cdFx0XHRcdFx0OiBudWxsO1xuXHRcdFx0XHR2YXIgcm93X2tleSA9IHJvd19lbGVtZW50ID8gcm93X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXknICkgOiAnJztcblxuXHRcdFx0XHRpZiAoIHJvd19rZXkgKSB7XG5cdFx0XHRcdFx0Y2hhbmdlZF9yb3dfa2V5c1sgcm93X2tleSBdID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIE9iamVjdC5rZXlzKCBjaGFuZ2VkX3Jvd19rZXlzICkubGVuZ3RoICkge1xuXHRcdFx0XHRzY2hlZHVsZV9yb3dfc3luY2hyb25pemF0aW9uKCBPYmplY3Qua2V5cyggY2hhbmdlZF9yb3dfa2V5cyApICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgdGhlIHJvdyBjb250YWluaW5nIGEgZGVsYXllZCBpbWFnZSBvciBjYXB0dXJlZCByZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGxvYWRfZXZlbnQgQ2FwdHVyZWQgbG9hZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9yb3dfY29udGVudF9sb2FkKCBsb2FkX2V2ZW50ICkge1xuXHRcdFx0dmFyIHJvd19lbGVtZW50ID0gbG9hZF9ldmVudC50YXJnZXQgJiYgbG9hZF9ldmVudC50YXJnZXQuY2xvc2VzdFxuXHRcdFx0XHQ/IGxvYWRfZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXldJyApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdHZhciByb3dfa2V5ID0gcm93X2VsZW1lbnQgPyByb3dfZWxlbWVudC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LWtleScgKSA6ICcnO1xuXG5cdFx0XHRzY2hlZHVsZV9yb3dfc3luY2hyb25pemF0aW9uKCByb3dfa2V5IHx8IG51bGwgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBhIHBhaXJlZCByb3cgYWZ0ZXIgYW4gYXV0aG9yaXplZCBwcmVzZW50YXRpb24gcmVuZGVycyBsb2NhbGx5LlxuXHRcdCAqXG5cdFx0ICogRG9tYWluIG1vZHVsZXMgZW1pdCB0aGlzIG5ldXRyYWwgbGlmZWN5Y2xlIGV2ZW50IGFmdGVyIHJlcGxhY2luZyBob3N0XG5cdFx0ICogY29udGVudHMuIFNoYXJlZCByZW5kZXJpbmcgdmFsaWRhdGVzIG9ubHkgdGhlIHJlZ2lzdGVyZWQgcHJlc2VudGF0aW9uIGFuZFxuXHRcdCAqIHNjaGVkdWxlcyBpdHMgZXhpc3RpbmcgUmVzb3VyY2UvY2FudmFzIHJvdy1oZWlnaHQgbWVjaGFuaWMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBldmVudCBOZXV0cmFsIHByZXNlbnRhdGlvbi1yZW5kZXJlZCBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9yb3dfcHJlc2VudGF0aW9uX3JlbmRlcmVkKCBldmVudCApIHtcblx0XHRcdHZhciBkZXRhaWwgPSBldmVudCAmJiBldmVudC5kZXRhaWwgPyBldmVudC5kZXRhaWwgOiB7fTtcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCBOdW1iZXIoIGRldGFpbC5yZXNvdXJjZV9pZCApIHx8IDAgKSApO1xuXHRcdFx0dmFyIHByZXNlbnRhdGlvbl9pZCA9IFN0cmluZyggZGV0YWlsLnByZXNlbnRhdGlvbl9pZCB8fCAnJyApO1xuXG5cdFx0XHRpZiAoICEgcmVzb3VyY2VfaWQgfHwgISBnZXRfYXV0aG9yaXplZF9yb3dfcHJlc2VudGF0aW9uKCByZXNvdXJjZV9pZCwgcHJlc2VudGF0aW9uX2lkICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNjaGVkdWxlX3Jvd19zeW5jaHJvbml6YXRpb24oICdyZXNvdXJjZS0nICsgcmVzb3VyY2VfaWQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSBvbmUgZGV0YWlscy1leHBhbmRlZCBzdGF0ZSB0byBib3RoIGhhbHZlcyBvZiBhIHJvdyBncm91cC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgcm93X2tleSAgICAgU3RhYmxlIHJvdyBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZXhwYW5kZWQgRGVzaXJlZCBkZXRhaWxzIHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gdHJpZ2dlciAgICAgVG9nZ2xlIHRoYXQgaW5pdGlhdGVkIHRoZSBjaGFuZ2UuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzZXRfcm93X2V4cGFuZGVkKCByb3dfa2V5LCBpc19leHBhbmRlZCwgdHJpZ2dlciApIHtcblx0XHRcdHZhciByb3dfZWxlbWVudHMgPSBtb3VudCA/IG1vdW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXldJyApIDogW107XG5cdFx0XHR2YXIgcmVzb3VyY2VfaWRfbWF0Y2ggPSBTdHJpbmcoIHJvd19rZXkgfHwgJycgKS5tYXRjaCggL15yZXNvdXJjZS0oXFxkKykkLyApO1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCByb3dfZWxlbWVudHMsIGZ1bmN0aW9uICggcm93X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHZhciBkZXRhaWxzID0gcm93X2VsZW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcm93LWRldGFpbHNdJyApO1xuXG5cdFx0XHRcdGlmICggcm93X2tleSAhPT0gcm93X2VsZW1lbnQuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXRpbWVsaW5lLXJvdy1rZXknICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJvd19lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoICdpcy1leHBhbmRlZCcsIGlzX2V4cGFuZGVkICk7XG5cdFx0XHRcdEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwoIGRldGFpbHMsIGZ1bmN0aW9uICggZGV0YWlsX2VsZW1lbnQgKSB7XG5cdFx0XHRcdFx0ZGV0YWlsX2VsZW1lbnQuaGlkZGVuID0gISBpc19leHBhbmRlZDtcblx0XHRcdFx0fSApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoIHRyaWdnZXIgKSB7XG5cdFx0XHRcdHRyaWdnZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsIGlzX2V4cGFuZGVkID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXHRcdFx0XHR0cmlnZ2VyLnNldEF0dHJpYnV0ZShcblx0XHRcdFx0XHQnYXJpYS1sYWJlbCcsXG5cdFx0XHRcdFx0aXNfZXhwYW5kZWQgPyBzZXR0aW5ncy5pMThuLmNvbGxhcHNlX3Jlc291cmNlIDogc2V0dGluZ3MuaTE4bi5leHBhbmRfcmVzb3VyY2Vcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHRcdGlmICggcmVzb3VyY2VfaWRfbWF0Y2ggKSB7XG5cdFx0XHRcdHJldGFpbl9leHBhbnNpb25fc3RhdGUoICdleHBhbmRlZF9yZXNvdXJjZV9pZHMnLCBOdW1iZXIoIHJlc291cmNlX2lkX21hdGNoWyAxIF0gKSwgaXNfZXhwYW5kZWQgKTtcblx0XHRcdH1cblx0XHRcdHNjaGVkdWxlX3Jvd19zeW5jaHJvbml6YXRpb24oIHJvd19rZXkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBcHBseSBvbmUgbmV1dHJhbCBwcmVzZW50YXRpb24gc3RhdGUgdG8gaXRzIHN5bmNocm9uaXplZCByb3cgaG9zdHMuXG5cdFx0ICpcblx0XHQgKiBFeGNsdXNpdmUgZGVzY3JpcHRvcnMgZXhjbHVkZSBvdGhlciBwcmVzZW50YXRpb25zIG9uIHRoZSBzYW1lIFJlc291cmNlLFxuXHRcdCAqIG5vdCBwcmVzZW50YXRpb25zIG9uIG90aGVyIFJlc291cmNlcy4gVGhpcyBhbGxvd3MgZXZlcnkgYXV0aG9yaXplZFxuXHRcdCAqIFJlc291cmNlIG9uIHRoZSBjdXJyZW50IHBhZ2UgdG8gYmUgb3BlbiB3aXRob3V0IGEgZGF0YSByZXF1ZXN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9ICByZXNvdXJjZV9pZCAgICAgQXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gIHByZXNlbnRhdGlvbl9pZCBSZWdpc3RlcmVkIHByZXNlbnRhdGlvbiBJRC5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX29wZW4gICAgICAgICBEZXNpcmVkIHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gdHJpZ2dlciAgICAgICAgIE9wdGlvbmFsIGluaXRpYXRpbmcgdG9nZ2xlLlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyAgIFdoZXRoZXIgY2xvc2luZyBzaG91bGQgcmVzdG9yZSBmb2N1cy5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGF1dGhvcml6ZWQgc3RhdGUgd2FzIGFwcGxpZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3Jvd19wcmVzZW50YXRpb25fb3BlbiggcmVzb3VyY2VfaWQsIHByZXNlbnRhdGlvbl9pZCwgaXNfb3BlbiwgdHJpZ2dlciwgcmVzdG9yZV9mb2N1cyApIHtcblx0XHRcdHZhciBkZXNjcmlwdG9yID0gZ2V0X2F1dGhvcml6ZWRfcm93X3ByZXNlbnRhdGlvbiggcmVzb3VyY2VfaWQsIHByZXNlbnRhdGlvbl9pZCApO1xuXHRcdFx0dmFyIHJlc291cmNlX29wZW5fc3RhdGU7XG5cblx0XHRcdHJlc291cmNlX2lkID0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIE51bWJlciggcmVzb3VyY2VfaWQgKSB8fCAwICkgKTtcblx0XHRcdGlmICggISByZXNvdXJjZV9pZCB8fCAhIGRlc2NyaXB0b3IgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmICggaXNfcm93X3ByZXNlbnRhdGlvbl9vcGVuKCByZXNvdXJjZV9pZCwgcHJlc2VudGF0aW9uX2lkICkgPT09IGlzX29wZW4gKSB7XG5cdFx0XHRcdGlmICggISBpc19vcGVuICYmIHJlc3RvcmVfZm9jdXMgJiYgdHJpZ2dlciAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgdHJpZ2dlci5mb2N1cyApIHtcblx0XHRcdFx0XHR0cmlnZ2VyLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXNvdXJjZV9vcGVuX3N0YXRlID0gb3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdIHx8IHt9O1xuXHRcdFx0aWYgKCBpc19vcGVuICkge1xuXHRcdFx0XHRPYmplY3Qua2V5cyggcmVzb3VyY2Vfb3Blbl9zdGF0ZSApLmZvckVhY2goIGZ1bmN0aW9uICggb3Blbl9wcmVzZW50YXRpb25faWQgKSB7XG5cdFx0XHRcdFx0dmFyIG9wZW5fZGVzY3JpcHRvciA9IGdldF9hdXRob3JpemVkX3Jvd19wcmVzZW50YXRpb24oIHJlc291cmNlX2lkLCBvcGVuX3ByZXNlbnRhdGlvbl9pZCApO1xuXG5cdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0b3Blbl9wcmVzZW50YXRpb25faWQgIT09IHByZXNlbnRhdGlvbl9pZFxuXHRcdFx0XHRcdFx0JiYgKCBkZXNjcmlwdG9yLmlzX2V4Y2x1c2l2ZSB8fCAoIG9wZW5fZGVzY3JpcHRvciAmJiBvcGVuX2Rlc2NyaXB0b3IuaXNfZXhjbHVzaXZlICkgKVxuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0YXBwbHlfcm93X3ByZXNlbnRhdGlvbl9zdGF0ZSggcmVzb3VyY2VfaWQsIG9wZW5fZGVzY3JpcHRvciwgZmFsc2UsIG51bGwgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gKTtcblx0XHRcdH1cblx0XHRcdGFwcGx5X3Jvd19wcmVzZW50YXRpb25fc3RhdGUoIHJlc291cmNlX2lkLCBkZXNjcmlwdG9yLCBpc19vcGVuLCB0cmlnZ2VyICk7XG5cdFx0XHRpZiAoICEgaXNfb3BlbiAmJiByZXN0b3JlX2ZvY3VzICYmIHRyaWdnZXIgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHRyaWdnZXIuZm9jdXMgKSB7XG5cdFx0XHRcdHRyaWdnZXIuZm9jdXMoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgb25lIHByZXNlbnRhdGlvbiBzdGF0ZSB0byBhIGxlYWYgb3IgYXV0aG9yaXplZCBoaWVyYXJjaHkgZ3JvdXAuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIHJlc291cmNlX2lkICAgICBUb2dnbGUtb3duaW5nIFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgcHJlc2VudGF0aW9uX2lkIFJlZ2lzdGVyZWQgcHJlc2VudGF0aW9uIElELlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfb3BlbiAgICAgICAgIERlc2lyZWQgc3RhdGUgZm9yIHRoZSBjb21wbGV0ZSBzY29wZS5cblx0XHQgKiBAcGFyYW0ge0VsZW1lbnR9IHRyaWdnZXIgICAgICAgICBJbml0aWF0aW5nIHRvZ2dsZS5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IHJlc3RvcmVfZm9jdXMgICBXaGV0aGVyIGNsb3NpbmcgcmVzdG9yZXMgdHJpZ2dlciBmb2N1cy5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYXQgbGVhc3Qgb25lIGF1dGhvcml6ZWQgUmVzb3VyY2Ugd2FzIGhhbmRsZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3Jvd19wcmVzZW50YXRpb25fc2NvcGVfb3BlbiggcmVzb3VyY2VfaWQsIHByZXNlbnRhdGlvbl9pZCwgaXNfb3BlbiwgdHJpZ2dlciwgcmVzdG9yZV9mb2N1cyApIHtcblx0XHRcdHZhciBjb250cm9sbGVkX3Jlc291cmNlX2lkcyA9IGdldF9yb3dfcHJlc2VudGF0aW9uX3Njb3BlX3Jlc291cmNlX2lkcyggcmVzb3VyY2VfaWQsIHByZXNlbnRhdGlvbl9pZCApO1xuXHRcdFx0dmFyIGhhbmRsZWRfY291bnQgPSAwO1xuXG5cdFx0XHRjb250cm9sbGVkX3Jlc291cmNlX2lkcy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2xsZWRfcmVzb3VyY2VfaWQgKSB7XG5cdFx0XHRcdGlmICggc2V0X3Jvd19wcmVzZW50YXRpb25fb3BlbiggY29udHJvbGxlZF9yZXNvdXJjZV9pZCwgcHJlc2VudGF0aW9uX2lkLCBpc19vcGVuLCBudWxsLCBmYWxzZSApICkge1xuXHRcdFx0XHRcdGhhbmRsZWRfY291bnQgKz0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdFx0c3luY2hyb25pemVfcm93X3ByZXNlbnRhdGlvbl90b2dnbGVzKCBwcmVzZW50YXRpb25faWQgKTtcblx0XHRcdGlmICggaGFuZGxlZF9jb3VudCAmJiAhIGlzX29wZW4gJiYgcmVzdG9yZV9mb2N1cyAmJiB0cmlnZ2VyICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB0cmlnZ2VyLmZvY3VzICkge1xuXHRcdFx0XHR0cmlnZ2VyLmZvY3VzKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAwIDwgaGFuZGxlZF9jb3VudDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBVcGRhdGUgcmV0YWluZWQgc3RhdGUsIGhvc3RzLCBjb250cm9scywgcm93IGNsYXNzZXMsIGFuZCBsaWZlY3ljbGUgZXZlbnRzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9ICAgICAgcmVzb3VyY2VfaWQgQXV0aG9yaXplZCBSZXNvdXJjZSBJRC5cblx0XHQgKiBAcGFyYW0ge09iamVjdHxudWxsfSBkZXNjcmlwdG9yICBSZWdpc3RlcmVkIGRlc2NyaXB0b3IuXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSAgICAgaXNfb3BlbiAgICAgRGVzaXJlZCBzdGF0ZS5cblx0XHQgKiBAcGFyYW0ge0VsZW1lbnR9ICAgICB0cmlnZ2VyICAgICBPcHRpb25hbCBpbml0aWF0aW5nIHRvZ2dsZS5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGFwcGx5X3Jvd19wcmVzZW50YXRpb25fc3RhdGUoIHJlc291cmNlX2lkLCBkZXNjcmlwdG9yLCBpc19vcGVuLCB0cmlnZ2VyICkge1xuXHRcdFx0dmFyIHJvd19lbGVtZW50cyA9IG1vdW50ID8gbW91bnQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtdGltZWxpbmUtcm93LWtleT1cInJlc291cmNlLScgKyBOdW1iZXIoIHJlc291cmNlX2lkICkgKyAnXCJdJyApIDogW107XG5cdFx0XHR2YXIgaG9zdHM7XG5cblx0XHRcdGlmICggISBkZXNjcmlwdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgb3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdICkge1xuXHRcdFx0XHRvcGVuX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gPSB7fTtcblx0XHRcdH1cblx0XHRcdGlmICggaXNfb3BlbiApIHtcblx0XHRcdFx0b3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdWyBkZXNjcmlwdG9yLmlkIF0gPSB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVsZXRlIG9wZW5fcHJlc2VudGF0aW9uc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXVsgZGVzY3JpcHRvci5pZCBdO1xuXHRcdFx0XHRpZiAoICEgT2JqZWN0LmtleXMoIG9wZW5fcHJlc2VudGF0aW9uc19ieV9yZXNvdXJjZVsgcmVzb3VyY2VfaWQgXSApLmxlbmd0aCApIHtcblx0XHRcdFx0XHRkZWxldGUgb3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlWyByZXNvdXJjZV9pZCBdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGhvc3RzID0gZ2V0X3Jvd19wcmVzZW50YXRpb25faG9zdHMoIHJlc291cmNlX2lkLCBkZXNjcmlwdG9yLmlkICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBob3N0cywgZnVuY3Rpb24gKCBob3N0ICkge1xuXHRcdFx0XHRob3N0LmhpZGRlbiA9ICEgaXNfb3Blbjtcblx0XHRcdFx0aG9zdC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsIGlzX29wZW4gPyAnZmFsc2UnIDogJ3RydWUnICk7XG5cdFx0XHR9ICk7XG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCByb3dfZWxlbWVudHMsIGZ1bmN0aW9uICggcm93X2VsZW1lbnQgKSB7XG5cdFx0XHRcdHJvd19lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoXG5cdFx0XHRcdFx0J2hhcy1vcGVuLXJvdy1wcmVzZW50YXRpb24nLFxuXHRcdFx0XHRcdEJvb2xlYW4oIE9iamVjdC5rZXlzKCBvcGVuX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2VbIHJlc291cmNlX2lkIF0gfHwge30gKS5sZW5ndGggKVxuXHRcdFx0XHQpO1xuXHRcdFx0fSApO1xuXHRcdFx0ZW1pdF9yb3dfcHJlc2VudGF0aW9uX2V2ZW50KCBpc19vcGVuID8gJ29wZW5lZCcgOiAnY2xvc2VkJywgcmVzb3VyY2VfaWQsIGRlc2NyaXB0b3IsIHtcblx0XHRcdFx0aXNfb3BlbjogaXNfb3BlblxuXHRcdFx0fSApO1xuXHRcdFx0c3luY2hyb25pemVfcm93X3ByZXNlbnRhdGlvbl90b2dnbGVzKCBkZXNjcmlwdG9yLmlkICk7XG5cdFx0XHRzY2hlZHVsZV9yb3dfc3luY2hyb25pemF0aW9uKCAncmVzb3VyY2UtJyArIHJlc291cmNlX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQXBwbHkgb25lIHByZXNlbnRhdGlvbiBzdGF0ZSB0byBldmVyeSBjdXJyZW50bHkgYXV0aG9yaXplZCBSZXNvdXJjZS5cblx0XHQgKlxuXHRcdCAqIFRoZSBtZXRob2QgcGVyZm9ybXMgbm8gcmVxdWVzdC4gUmVzb3VyY2VzIGxhY2tpbmcgdGhlIGRlc2NyaXB0b3IgYXJlXG5cdFx0ICogc2tpcHBlZCwgc28gZG9tYWlucyBtYXkgc2FmZWx5IHVzZSBpdCBmb3IgYW4gZXhwbGljaXQgYXV0by1vcGVuIHBvbGljeS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSAgcHJlc2VudGF0aW9uX2lkIFJlZ2lzdGVyZWQgcHJlc2VudGF0aW9uIElELlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfb3BlbiAgICAgICAgIERlc2lyZWQgc3RhdGUuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBOdW1iZXIgb2YgUmVzb3VyY2VzIHVwZGF0ZWQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2FsbF9yb3dfcHJlc2VudGF0aW9uc19vcGVuKCBwcmVzZW50YXRpb25faWQsIGlzX29wZW4gKSB7XG5cdFx0XHR2YXIgdXBkYXRlZF9jb3VudCA9IDA7XG5cblx0XHRcdE9iamVjdC5rZXlzKCBhdXRob3JpemVkX3ByZXNlbnRhdGlvbnNfYnlfcmVzb3VyY2UgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRpZiAoIHNldF9yb3dfcHJlc2VudGF0aW9uX29wZW4oIE51bWJlciggcmVzb3VyY2VfaWQgKSwgcHJlc2VudGF0aW9uX2lkLCBpc19vcGVuLCBudWxsLCBmYWxzZSApICkge1xuXHRcdFx0XHRcdHVwZGF0ZWRfY291bnQgKz0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gdXBkYXRlZF9jb3VudDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBPcGVuIG9uZSBwcmVzZW50YXRpb24gb24gdGhlIGZpcnN0IGF1dGhvcml6ZWQgUmVzb3VyY2UgaW4gcmVuZGVyZWQgb3JkZXIuXG5cdFx0ICpcblx0XHQgKiBUaGlzIG5ldXRyYWwgaGVscGVyIHBlcmZvcm1zIG5vIHJlcXVlc3QgYW5kIGRlbGliZXJhdGVseSBvcGVucyBvbmx5IG9uZVxuXHRcdCAqIFJlc291cmNlLCBldmVuIHdoZW4gdGhhdCBSZXNvdXJjZSBpcyBhIGhpZXJhcmNoeSBwYXJlbnQuIERvbWFpbiBleHRlbnNpb25zXG5cdFx0ICogbWF5IHVzZSBpdCBmb3IgYSBvbmUtc2hvdCBpbml0aWFsLXByZXNlbnRhdGlvbiBwb2xpY3kgd2l0aG91dCBzeW50aGVzaXppbmdcblx0XHQgKiBhIGNsaWNrIG9yIGFjcXVpcmluZyBjYWNoZSwgcmVxdWVzdCwgb3IgbXV0YXRpb24gYXV0aG9yaXR5LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHByZXNlbnRhdGlvbl9pZCBSZWdpc3RlcmVkIHByZXNlbnRhdGlvbiBJRC5cblx0XHQgKiBAcmV0dXJuIHtudW1iZXJ9IE9wZW5lZCBSZXNvdXJjZSBJRCwgb3IgemVybyB3aGVuIG5vbmUgaXMgYXV0aG9yaXplZC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBvcGVuX2ZpcnN0X3Jvd19wcmVzZW50YXRpb24oIHByZXNlbnRhdGlvbl9pZCApIHtcblx0XHRcdHZhciBvcGVuZWRfcmVzb3VyY2VfaWQgPSAwO1xuXG5cdFx0XHRhdXRob3JpemVkX3Jlc291cmNlX2lkc19pbl9vcmRlci5zb21lKCBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xuXHRcdFx0XHRpZiAoICEgZ2V0X2F1dGhvcml6ZWRfcm93X3ByZXNlbnRhdGlvbiggcmVzb3VyY2VfaWQsIHByZXNlbnRhdGlvbl9pZCApICkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIHNldF9yb3dfcHJlc2VudGF0aW9uX29wZW4oIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQsIHRydWUsIG51bGwsIGZhbHNlICkgKSB7XG5cdFx0XHRcdFx0b3BlbmVkX3Jlc291cmNlX2lkID0gcmVzb3VyY2VfaWQ7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gb3BlbmVkX3Jlc291cmNlX2lkO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZSBvbmUgZGVsZWdhdGVkIG5ldXRyYWwgcHJlc2VudGF0aW9uIHRvZ2dsZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgQnJvd3NlciBjbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gYSByZWdpc3RlcmVkIHByZXNlbnRhdGlvbiBoYW5kbGVkIHRoZSBldmVudC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcm93X3ByZXNlbnRhdGlvbl9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgdHJpZ2dlciA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdFxuXHRcdFx0XHQ/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLXRvZ2dsZV0nIClcblx0XHRcdFx0OiBudWxsO1xuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xuXHRcdFx0dmFyIHByZXNlbnRhdGlvbl9pZDtcblx0XHRcdHZhciBkZXNjcmlwdG9yO1xuXHRcdFx0dmFyIHRvZ2dsZV9zdGF0ZTtcblxuXHRcdFx0aWYgKCAhIHRyaWdnZXIgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJlc291cmNlX2lkID0gTnVtYmVyKCB0cmlnZ2VyLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yZXNvdXJjZS1pZCcgKSApO1xuXHRcdFx0cHJlc2VudGF0aW9uX2lkID0gdHJpZ2dlci5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi10b2dnbGUnICk7XG5cdFx0XHRkZXNjcmlwdG9yID0gZ2V0X2F1dGhvcml6ZWRfcm93X3ByZXNlbnRhdGlvbiggcmVzb3VyY2VfaWQsIHByZXNlbnRhdGlvbl9pZCApO1xuXHRcdFx0aWYgKCAhIGRlc2NyaXB0b3IgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRvZ2dsZV9zdGF0ZSA9IGdldF9yb3dfcHJlc2VudGF0aW9uX3RvZ2dsZV9zdGF0ZSggcmVzb3VyY2VfaWQsIGRlc2NyaXB0b3IgKTtcblx0XHRcdGlmICggZXZlbnQucHJldmVudERlZmF1bHQgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gc2V0X3Jvd19wcmVzZW50YXRpb25fc2NvcGVfb3Blbihcblx0XHRcdFx0cmVzb3VyY2VfaWQsXG5cdFx0XHRcdHByZXNlbnRhdGlvbl9pZCxcblx0XHRcdFx0ISB0b2dnbGVfc3RhdGUuaXNfb3Blbixcblx0XHRcdFx0dHJpZ2dlcixcblx0XHRcdFx0dHJ1ZVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDbG9zZSB0aGUgcHJlc2VudGF0aW9uIGNvbnRhaW5pbmcga2V5Ym9hcmQgZm9jdXMgd2hlbiBFc2NhcGUgaXMgcHJlc3NlZC5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaXMgYSBuZXV0cmFsIHByZXNlbnRhdGlvbi1ob3N0IG1lY2hhbmljLiBJdCBkb2VzIG5vdCBpbnNwZWN0IHRoZVxuXHRcdCAqIHByZXNlbnRhdGlvbiBJRCBvciBkb21haW4gY29udGVudCwgYW5kIHJldHVybnMgZm9jdXMgdG8gdGhlIGN1cnJlbnRcblx0XHQgKiBhdXRob3JpemVkIHRvZ2dsZSBhZnRlciBib3RoIHN5bmNocm9uaXplZCBob3N0cyBjbG9zZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGtleWJvYXJkIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBhbiBvcGVuIHByZXNlbnRhdGlvbiBoYW5kbGVkIEVzY2FwZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfcm93X3ByZXNlbnRhdGlvbl9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdHZhciBob3N0O1xuXHRcdFx0dmFyIHJlc291cmNlX2lkO1xuXHRcdFx0dmFyIHByZXNlbnRhdGlvbl9pZDtcblx0XHRcdHZhciB0cmlnZ2VyO1xuXG5cdFx0XHRpZiAoICdFc2NhcGUnICE9PSBldmVudC5rZXkgfHwgZXZlbnQuZGVmYXVsdFByZXZlbnRlZCApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aG9zdCA9IGV2ZW50LnRhcmdldCAmJiBldmVudC50YXJnZXQuY2xvc2VzdFxuXHRcdFx0XHQ/IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy10aW1lbGluZS1yb3ctcHJlc2VudGF0aW9uLWhvc3RdJyApXG5cdFx0XHRcdDogbnVsbDtcblx0XHRcdGlmICggISBob3N0IHx8IGhvc3QuaGlkZGVuICkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXNvdXJjZV9pZCA9IE51bWJlciggaG9zdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcmVzb3VyY2UtaWQnICkgKTtcblx0XHRcdHByZXNlbnRhdGlvbl9pZCA9IFN0cmluZyggaG9zdC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcm93LXByZXNlbnRhdGlvbi1ob3N0JyApIHx8ICcnICk7XG5cdFx0XHRpZiAoICEgaXNfcm93X3ByZXNlbnRhdGlvbl9vcGVuKCByZXNvdXJjZV9pZCwgcHJlc2VudGF0aW9uX2lkICkgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRyaWdnZXIgPSBnZXRfcm93X3ByZXNlbnRhdGlvbl90b2dnbGUoIHJlc291cmNlX2lkLCBwcmVzZW50YXRpb25faWQgKTtcblx0XHRcdGlmICggZXZlbnQucHJldmVudERlZmF1bHQgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnN0b3BQcm9wYWdhdGlvbiApIHtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBzZXRfcm93X3ByZXNlbnRhdGlvbl9vcGVuKCByZXNvdXJjZV9pZCwgcHJlc2VudGF0aW9uX2lkLCBmYWxzZSwgdHJpZ2dlciwgdHJ1ZSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFNob3cgb3IgaGlkZSBkaXJlY3QgY2hpbGQgcm93IGhhbHZlcyBmb3IgYW4gYXV0aG9yaXplZCBwYXJlbnQgUmVzb3VyY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gIHBhcmVudF9pZCAgIEF1dGhvcml6ZWQgcGFyZW50IFJlc291cmNlIElELlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfZXhwYW5kZWQgRGVzaXJlZCBjaGlsZCB2aXNpYmlsaXR5LlxuXHRcdCAqIEBwYXJhbSB7RWxlbWVudH0gdHJpZ2dlciAgICAgSGllcmFyY2h5IHRvZ2dsZSB0aGF0IGluaXRpYXRlZCB0aGUgY2hhbmdlLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X2hpZXJhcmNoeV9leHBhbmRlZCggcGFyZW50X2lkLCBpc19leHBhbmRlZCwgdHJpZ2dlciApIHtcblx0XHRcdHZhciBjaGlsZF9yb3dzID0gbW91bnQgPyBtb3VudC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy10aW1lbGluZS1wYXJlbnQtaWQ9XCInICsgTnVtYmVyKCBwYXJlbnRfaWQgKSArICdcIl0nICkgOiBbXTtcblx0XHRcdHZhciBpY29uID0gdHJpZ2dlciA/IHRyaWdnZXIucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZWxpbmUtaGllcmFyY2h5LWljb25dJyApIDogbnVsbDtcblx0XHRcdHZhciBhZmZlY3RlZF9yb3dfa2V5cyA9IHt9O1xuXG5cdFx0XHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKCBjaGlsZF9yb3dzLCBmdW5jdGlvbiAoIGNoaWxkX3JvdyApIHtcblx0XHRcdFx0dmFyIHJvd19rZXk7XG5cblx0XHRcdFx0aWYgKCAwID09PSBOdW1iZXIoIGNoaWxkX3Jvdy5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtdGltZWxpbmUtcGFyZW50LWlkJyApICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNoaWxkX3Jvdy5oaWRkZW4gPSAhIGlzX2V4cGFuZGVkO1xuXHRcdFx0XHRyb3dfa2V5ID0gY2hpbGRfcm93LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy10aW1lbGluZS1yb3cta2V5JyApO1xuXHRcdFx0XHRpZiAoIHJvd19rZXkgKSB7XG5cdFx0XHRcdFx0YWZmZWN0ZWRfcm93X2tleXNbIHJvd19rZXkgXSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0aWYgKCB0cmlnZ2VyICkge1xuXHRcdFx0XHR0cmlnZ2VyLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCBpc19leHBhbmRlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcblx0XHRcdFx0dHJpZ2dlci5zZXRBdHRyaWJ1dGUoXG5cdFx0XHRcdFx0J2FyaWEtbGFiZWwnLFxuXHRcdFx0XHRcdGlzX2V4cGFuZGVkID8gc2V0dGluZ3MuaTE4bi5jb2xsYXBzZV9jaGlsZHJlbiA6IHNldHRpbmdzLmkxOG4uZXhwYW5kX2NoaWxkcmVuXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGljb24gKSB7XG5cdFx0XHRcdGljb24uY2xhc3NMaXN0LnRvZ2dsZSggJ3dwYmMtYmktZGFzaC1zcXVhcmUtZG90dGVkJywgaXNfZXhwYW5kZWQgKTtcblx0XHRcdFx0aWNvbi5jbGFzc0xpc3QudG9nZ2xlKCAnd3BiYy1iaS1wbHVzLXNxdWFyZS1kb3R0ZWQnLCAhIGlzX2V4cGFuZGVkICk7XG5cdFx0XHR9XG5cdFx0XHRyZXRhaW5fZXhwYW5zaW9uX3N0YXRlKCAnZXhwYW5kZWRfcGFyZW50X2lkcycsIHBhcmVudF9pZCwgaXNfZXhwYW5kZWQgKTtcblx0XHRcdHVwZGF0ZV92aXNpYmxlX3Jvd19zdHJpcGluZygpO1xuXHRcdFx0aWYgKCBPYmplY3Qua2V5cyggYWZmZWN0ZWRfcm93X2tleXMgKS5sZW5ndGggKSB7XG5cdFx0XHRcdHNjaGVkdWxlX3Jvd19zeW5jaHJvbml6YXRpb24oIE9iamVjdC5rZXlzKCBhZmZlY3RlZF9yb3dfa2V5cyApICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3RhcnQgcmVzcG9uc2l2ZSBzeW5jaHJvbml6YXRpb24gZm9yIGV4cGFuc2lvbiwgaW1hZ2VzLCBmb250cywgYW5kIHdpZHRoLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCkge1xuXHRcdFx0dmFyIGluaXRpYWxpemVkX2dlbmVyYXRpb247XG5cblx0XHRcdGlmICggISBtb3VudCB8fCByb3dfc3luY2hyb25pemF0aW9uX2luaXRpYWxpemVkICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRsaWZlY3ljbGVfZ2VuZXJhdGlvbiArPSAxO1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LlJlc2l6ZU9ic2VydmVyICkge1xuXHRcdFx0XHRyb3dfb2JzZXJ2ZXIgPSBuZXcgd2luZG93LlJlc2l6ZU9ic2VydmVyKCBoYW5kbGVfcm93X3Jlc2l6ZSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Lk11dGF0aW9uT2JzZXJ2ZXIgKSB7XG5cdFx0XHRcdG11dGF0aW9uX29ic2VydmVyID0gbmV3IHdpbmRvdy5NdXRhdGlvbk9ic2VydmVyKCBoYW5kbGVfcm93X211dGF0aW9ucyApO1xuXHRcdFx0XHRtdXRhdGlvbl9vYnNlcnZlci5vYnNlcnZlKCBtb3VudCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCAhIHJvd19vYnNlcnZlciApIHtcblx0XHRcdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdyZXNpemUnLCBzY2hlZHVsZV9yb3dfc3luY2hyb25pemF0aW9uICk7XG5cdFx0XHR9XG5cdFx0XHRyb3dfc3luY2hyb25pemF0aW9uX2luaXRpYWxpemVkID0gdHJ1ZTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdsb2FkJywgaGFuZGxlX3Jvd19jb250ZW50X2xvYWQsIHRydWUgKTtcblx0XHRcdG1vdW50LmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX3Jvd19wcmVzZW50YXRpb25fa2V5ZG93biApO1xuXHRcdFx0bW91bnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpyZW5kZXJlZCcsIGhhbmRsZV9yb3dfcHJlc2VudGF0aW9uX3JlbmRlcmVkICk7XG5cdFx0XHRpZiAoIGRvY3VtZW50LmZvbnRzICYmIGRvY3VtZW50LmZvbnRzLnJlYWR5ICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiBkb2N1bWVudC5mb250cy5yZWFkeS50aGVuICkge1xuXHRcdFx0XHRpbml0aWFsaXplZF9nZW5lcmF0aW9uID0gbGlmZWN5Y2xlX2dlbmVyYXRpb247XG5cdFx0XHRcdGRvY3VtZW50LmZvbnRzLnJlYWR5LnRoZW4oIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoICEgcm93X3N5bmNocm9uaXphdGlvbl9pbml0aWFsaXplZCB8fCAhIGlzX2hvc3RfYWN0aXZlKCkgfHwgaW5pdGlhbGl6ZWRfZ2VuZXJhdGlvbiAhPT0gbGlmZWN5Y2xlX2dlbmVyYXRpb24gKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNjaGVkdWxlX3Jvd19zeW5jaHJvbml6YXRpb24oKTtcblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0b2JzZXJ2ZV9yb3dzKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVsZWFzZSBvYnNlcnZlcnMsIGxpc3RlbmVycywgYW5kIHNjaGVkdWxlZCB3b3JrIG93bmVkIGJ5IHRoaXMgaW5zdGFuY2UuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0XHRpZiAoICEgcm93X3N5bmNocm9uaXphdGlvbl9pbml0aWFsaXplZCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGlmZWN5Y2xlX2dlbmVyYXRpb24gKz0gMTtcblx0XHRcdHJvd19zeW5jaHJvbml6YXRpb25faW5pdGlhbGl6ZWQgPSBmYWxzZTtcblx0XHRcdGlmICggc3luY2hyb25pemF0aW9uX2ZyYW1lICkge1xuXHRcdFx0XHR3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoIHN5bmNocm9uaXphdGlvbl9mcmFtZSApO1xuXHRcdFx0fVxuXHRcdFx0c3luY2hyb25pemF0aW9uX2ZyYW1lID0gMDtcblx0XHRcdHBlbmRpbmdfcm93X2tleXMgPSB7fTtcblx0XHRcdHN5bmNocm9uaXplX2FsbF9yb3dzID0gZmFsc2U7XG5cdFx0XHRpZiAoIHJvd19vYnNlcnZlciApIHtcblx0XHRcdFx0cm93X29ic2VydmVyLmRpc2Nvbm5lY3QoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCAncmVzaXplJywgc2NoZWR1bGVfcm93X3N5bmNocm9uaXphdGlvbiApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBtdXRhdGlvbl9vYnNlcnZlciApIHtcblx0XHRcdFx0bXV0YXRpb25fb2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBtb3VudCApIHtcblx0XHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBoYW5kbGVfcm93X2NvbnRlbnRfbG9hZCwgdHJ1ZSApO1xuXHRcdFx0XHRtb3VudC5yZW1vdmVFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9yb3dfcHJlc2VudGF0aW9uX2tleWRvd24gKTtcblx0XHRcdFx0bW91bnQucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ3dwYmM6dGltZWxpbmU6cm93LXByZXNlbnRhdGlvbjpyZW5kZXJlZCcsIGhhbmRsZV9yb3dfcHJlc2VudGF0aW9uX3JlbmRlcmVkICk7XG5cdFx0XHR9XG5cdFx0XHRyb3dfb2JzZXJ2ZXIgPSBudWxsO1xuXHRcdFx0bXV0YXRpb25fb2JzZXJ2ZXIgPSBudWxsO1xuXHRcdFx0b2JzZXJ2ZWRfcm93X2VsZW1lbnRzID0gbmV3IHdpbmRvdy5XZWFrU2V0KCk7XG5cdFx0XHRleHBlY3RlZF9yb3dfaGVpZ2h0cyA9IG5ldyB3aW5kb3cuV2Vha01hcCgpO1xuXHRcdFx0YXV0aG9yaXplZF9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlID0ge307XG5cdFx0XHRhdXRob3JpemVkX3Jlc291cmNlX2lkc19pbl9vcmRlciA9IFtdO1xuXHRcdFx0b3Blbl9wcmVzZW50YXRpb25zX2J5X3Jlc291cmNlID0ge307XG5cdFx0XHRyZXNvdXJjZV9jaGlsZHJlbl9ieV9wYXJlbnQgPSB7fTtcblx0XHRcdHJlc291cmNlX3RpdGxlc19ieV9pZCA9IHt9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpbml0aWFsaXplOiBpbml0aWFsaXplLFxuXHRcdFx0ZGVzdHJveTogZGVzdHJveSxcblx0XHRcdHJlbmRlcl9yb3dzOiByZW5kZXJfcm93cyxcblx0XHRcdG9ic2VydmVfcm93czogb2JzZXJ2ZV9yb3dzLFxuXHRcdFx0c2V0X3Jvd19leHBhbmRlZDogc2V0X3Jvd19leHBhbmRlZCxcblx0XHRcdHNldF9oaWVyYXJjaHlfZXhwYW5kZWQ6IHNldF9oaWVyYXJjaHlfZXhwYW5kZWQsXG5cdFx0XHRoYW5kbGVfcm93X3ByZXNlbnRhdGlvbl9jbGljazogaGFuZGxlX3Jvd19wcmVzZW50YXRpb25fY2xpY2ssXG5cdFx0XHRoYW5kbGVfcm93X3ByZXNlbnRhdGlvbl9rZXlkb3duOiBoYW5kbGVfcm93X3ByZXNlbnRhdGlvbl9rZXlkb3duLFxuXHRcdFx0c2V0X3Jvd19wcmVzZW50YXRpb25fb3Blbjogc2V0X3Jvd19wcmVzZW50YXRpb25fb3Blbixcblx0XHRcdHNldF9yb3dfcHJlc2VudGF0aW9uX3Njb3BlX29wZW46IHNldF9yb3dfcHJlc2VudGF0aW9uX3Njb3BlX29wZW4sXG5cdFx0XHRzZXRfYWxsX3Jvd19wcmVzZW50YXRpb25zX29wZW46IHNldF9hbGxfcm93X3ByZXNlbnRhdGlvbnNfb3Blbixcblx0XHRcdG9wZW5fZmlyc3Rfcm93X3ByZXNlbnRhdGlvbjogb3Blbl9maXJzdF9yb3dfcHJlc2VudGF0aW9uLFxuXHRcdFx0aXNfcm93X3ByZXNlbnRhdGlvbl9vcGVuOiBpc19yb3dfcHJlc2VudGF0aW9uX29wZW5cblx0XHR9O1xuXHR9XG5cblx0aWYgKFxuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXNcblx0XHQmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfdGltZWxpbmVfbW9kdWxlcy5yZWdpc3Rlcl9mYWN0b3J5XG5cdCkge1xuXHRcdHdpbmRvdy53cGJjX3RpbWVsaW5lX21vZHVsZXMucmVnaXN0ZXJfZmFjdG9yeSggbW9kdWxlX2lkLCBjcmVhdGVfcmVuZGVyaW5nX2NvbnRyb2xsZXIgKTtcblx0fVxufSggd2luZG93LCBkb2N1bWVudCApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDL0IsWUFBWTs7RUFFWixJQUFJQyxTQUFTLEdBQUcsV0FBVzs7RUFFM0I7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQywyQkFBMkJBLENBQUVDLE9BQU8sRUFBRztJQUMvQyxJQUFJQyxLQUFLLEdBQUdELE9BQU8sQ0FBQ0MsS0FBSyxJQUFJLElBQUk7SUFDakMsSUFBSUMsUUFBUSxHQUFHRixPQUFPLENBQUNFLFFBQVEsSUFBSSxDQUFDLENBQUM7SUFDckMsSUFBSUMsWUFBWSxHQUFHLFVBQVUsS0FBSyxPQUFPSCxPQUFPLENBQUNHLFlBQVksR0FBR0gsT0FBTyxDQUFDRyxZQUFZLEdBQUcsWUFBWTtNQUNsRyxPQUFPLElBQUk7SUFDWixDQUFDO0lBQ0QsSUFBSUMscUJBQXFCLEdBQUcsVUFBVSxLQUFLLE9BQU9KLE9BQU8sQ0FBQ0kscUJBQXFCLEdBQUdKLE9BQU8sQ0FBQ0kscUJBQXFCLEdBQUcsWUFBWSxDQUFDLENBQUM7SUFDaEksSUFBSUMsd0JBQXdCLEdBQUcsVUFBVSxLQUFLLE9BQU9MLE9BQU8sQ0FBQ0ssd0JBQXdCLEdBQUdMLE9BQU8sQ0FBQ0ssd0JBQXdCLEdBQUcsWUFBWSxDQUFDLENBQUM7SUFDekksSUFBSUMsd0JBQXdCLEdBQUcsVUFBVSxLQUFLLE9BQU9OLE9BQU8sQ0FBQ00sd0JBQXdCLEdBQUdOLE9BQU8sQ0FBQ00sd0JBQXdCLEdBQUcsWUFBWSxDQUFDLENBQUM7SUFDekksSUFBSUMseUJBQXlCLEdBQUcsVUFBVSxLQUFLLE9BQU9QLE9BQU8sQ0FBQ08seUJBQXlCLEdBQUdQLE9BQU8sQ0FBQ08seUJBQXlCLEdBQUcsWUFBWSxDQUFDLENBQUM7SUFDNUksSUFBSUMsY0FBYyxHQUFHLFVBQVUsS0FBSyxPQUFPUixPQUFPLENBQUNRLGNBQWMsR0FBR1IsT0FBTyxDQUFDUSxjQUFjLEdBQUcsWUFBWTtNQUN4RyxPQUFPLElBQUk7SUFDWixDQUFDO0lBQ0QsSUFBSUMsWUFBWSxHQUFHLElBQUk7SUFDdkIsSUFBSUMsaUJBQWlCLEdBQUcsSUFBSTtJQUM1QixJQUFJQywrQkFBK0IsR0FBRyxLQUFLO0lBQzNDLElBQUlDLHFCQUFxQixHQUFHLElBQUloQixNQUFNLENBQUNpQixPQUFPLENBQUMsQ0FBQztJQUNoRCxJQUFJQyxvQkFBb0IsR0FBRyxJQUFJbEIsTUFBTSxDQUFDbUIsT0FBTyxDQUFDLENBQUM7SUFDL0MsSUFBSUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLElBQUlDLG9CQUFvQixHQUFHLEtBQUs7SUFDaEMsSUFBSUMscUJBQXFCLEdBQUcsQ0FBQztJQUM3QixJQUFJQyxvQkFBb0IsR0FBRyxDQUFDO0lBQzVCLElBQUlDLG9DQUFvQyxHQUFHLENBQUMsQ0FBQztJQUM3QyxJQUFJQyxnQ0FBZ0MsR0FBRyxFQUFFO0lBQ3pDLElBQUlDLDhCQUE4QixHQUFHLENBQUMsQ0FBQztJQUN2QyxJQUFJQywyQkFBMkIsR0FBRyxDQUFDLENBQUM7SUFDcEMsSUFBSUMscUJBQXFCLEdBQUcsQ0FBQyxDQUFDOztJQUU5QjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQywyQkFBMkJBLENBQUVDLFdBQVcsRUFBRztNQUNuRCxJQUFJQyxpQkFBaUIsR0FBRyx3QkFBd0I7TUFDaEQsSUFBSUMsUUFBUSxHQUFHLENBQUMsQ0FBQztNQUVqQixPQUFPLENBQUVDLEtBQUssQ0FBQ0MsT0FBTyxDQUFFSixXQUFZLENBQUMsR0FBR0EsV0FBVyxHQUFHLEVBQUUsRUFBR0ssTUFBTSxDQUFFLFVBQVdDLFVBQVUsRUFBRztRQUMxRixJQUFJQyxlQUFlLEdBQUdELFVBQVUsSUFBSSxRQUFRLEtBQUssT0FBT0EsVUFBVSxDQUFDRSxFQUFFLEdBQUdGLFVBQVUsQ0FBQ0UsRUFBRSxHQUFHLEVBQUU7UUFDMUYsSUFBSUMsWUFBWSxHQUFHSCxVQUFVLElBQUksUUFBUSxLQUFLLE9BQU9BLFVBQVUsQ0FBQ0csWUFBWSxHQUFHSCxVQUFVLENBQUNHLFlBQVksR0FBRyxFQUFFO1FBRTNHLElBQ0MsQ0FBRVIsaUJBQWlCLENBQUNTLElBQUksQ0FBRUgsZUFBZ0IsQ0FBQyxJQUN4QyxDQUFFTixpQkFBaUIsQ0FBQ1MsSUFBSSxDQUFFRCxZQUFhLENBQUMsSUFDeEMsUUFBUSxLQUFLLE9BQU9ILFVBQVUsQ0FBQ0ssS0FBSyxJQUNwQyxDQUFFTCxVQUFVLENBQUNLLEtBQUssQ0FBQ0MsSUFBSSxDQUFDLENBQUMsSUFDekJWLFFBQVEsQ0FBRUssZUFBZSxDQUFFLEVBQzdCO1VBQ0QsT0FBTyxLQUFLO1FBQ2I7UUFDQUwsUUFBUSxDQUFFSyxlQUFlLENBQUUsR0FBRyxJQUFJO1FBQ2xDLE9BQU8sSUFBSTtNQUNaLENBQUUsQ0FBQyxDQUFDTSxHQUFHLENBQUUsVUFBV1AsVUFBVSxFQUFHO1FBQ2hDLE9BQU87VUFDTkUsRUFBRSxFQUFFRixVQUFVLENBQUNFLEVBQUU7VUFDakJHLEtBQUssRUFBRUwsVUFBVSxDQUFDSyxLQUFLO1VBQ3ZCRixZQUFZLEVBQUVILFVBQVUsQ0FBQ0csWUFBWTtVQUNyQ0ssWUFBWSxFQUFFLElBQUksS0FBS1IsVUFBVSxDQUFDUSxZQUFZO1VBQzlDQyxZQUFZLEVBQUUsSUFBSSxLQUFLVCxVQUFVLENBQUNTLFlBQVk7VUFDOUNDLGlCQUFpQixFQUFFLFFBQVEsS0FBSyxPQUFPVixVQUFVLENBQUNVLGlCQUFpQixHQUFHVixVQUFVLENBQUNVLGlCQUFpQixHQUFHLEVBQUU7VUFDdkdDLGtCQUFrQixFQUFFLFFBQVEsS0FBSyxPQUFPWCxVQUFVLENBQUNXLGtCQUFrQixHQUFHWCxVQUFVLENBQUNXLGtCQUFrQixHQUFHO1FBQ3pHLENBQUM7TUFDRixDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQywyQkFBMkJBLENBQUVDLFVBQVUsRUFBRUMsV0FBVyxFQUFFZCxVQUFVLEVBQUVlLFVBQVUsRUFBRztNQUN2RixJQUFJQyxZQUFZO01BQ2hCLElBQUlDLGVBQWU7TUFFbkIsSUFBSyxDQUFFaEQsS0FBSyxJQUFJLFVBQVUsS0FBSyxPQUFPQSxLQUFLLENBQUNpRCxhQUFhLEVBQUc7UUFDM0Q7TUFDRDtNQUNBRixZQUFZLEdBQUdHLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFO1FBQzdCTixXQUFXLEVBQUVBLFdBQVc7UUFDeEJiLGVBQWUsRUFBRUQsVUFBVSxDQUFDRSxFQUFFO1FBQzlCQyxZQUFZLEVBQUVILFVBQVUsQ0FBQ0csWUFBWTtRQUNyQ0gsVUFBVSxFQUFFbUIsTUFBTSxDQUFDQyxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUVwQixVQUFXLENBQUM7UUFDM0NxQixLQUFLLEVBQUVDLDBCQUEwQixDQUFFUixXQUFXLEVBQUVkLFVBQVUsQ0FBQ0UsRUFBRztNQUMvRCxDQUFDLEVBQUVhLFVBQVUsSUFBSSxDQUFDLENBQUUsQ0FBQztNQUNyQixJQUFLLFVBQVUsS0FBSyxPQUFPbkQsTUFBTSxDQUFDMkQsV0FBVyxFQUFHO1FBQy9DTixlQUFlLEdBQUcsSUFBSXJELE1BQU0sQ0FBQzJELFdBQVcsQ0FBRSxpQ0FBaUMsR0FBR1YsVUFBVSxFQUFFO1VBQ3pGVyxNQUFNLEVBQUVSO1FBQ1QsQ0FBRSxDQUFDO01BQ0osQ0FBQyxNQUFNLElBQUtuRCxRQUFRLENBQUM0RCxXQUFXLEVBQUc7UUFDbENSLGVBQWUsR0FBR3BELFFBQVEsQ0FBQzRELFdBQVcsQ0FBRSxhQUFjLENBQUM7UUFDdkRSLGVBQWUsQ0FBQ1MsZUFBZSxDQUFFLGlDQUFpQyxHQUFHYixVQUFVLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRUcsWUFBYSxDQUFDO01BQzlHO01BQ0EsSUFBS0MsZUFBZSxFQUFHO1FBQ3RCaEQsS0FBSyxDQUFDaUQsYUFBYSxDQUFFRCxlQUFnQixDQUFDO01BQ3ZDO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTSywwQkFBMEJBLENBQUVSLFdBQVcsRUFBRWIsZUFBZSxFQUFHO01BQ25FLElBQUlvQixLQUFLLEdBQUdwRCxLQUFLLEdBQUdBLEtBQUssQ0FBQzBELGdCQUFnQixDQUFFLDRDQUE2QyxDQUFDLEdBQUcsRUFBRTtNQUUvRixPQUFPOUIsS0FBSyxDQUFDK0IsU0FBUyxDQUFDN0IsTUFBTSxDQUFDOEIsSUFBSSxDQUFFUixLQUFLLEVBQUUsVUFBV1MsSUFBSSxFQUFHO1FBQzVELE9BQU9DLE1BQU0sQ0FBRUQsSUFBSSxDQUFDRSxZQUFZLENBQUUsZ0NBQWlDLENBQUUsQ0FBQyxLQUFLRCxNQUFNLENBQUVqQixXQUFZLENBQUMsSUFDNUZnQixJQUFJLENBQUNFLFlBQVksQ0FBRSwwQ0FBMkMsQ0FBQyxLQUFLL0IsZUFBZTtNQUN4RixDQUFFLENBQUM7SUFDSjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNnQywyQkFBMkJBLENBQUVuQixXQUFXLEVBQUViLGVBQWUsRUFBRztNQUNwRSxJQUFJaUMsT0FBTyxHQUFHakUsS0FBSyxHQUFHQSxLQUFLLENBQUMwRCxnQkFBZ0IsQ0FBRSw4Q0FBK0MsQ0FBQyxHQUFHLEVBQUU7TUFFbkcsT0FBTzlCLEtBQUssQ0FBQytCLFNBQVMsQ0FBQzdCLE1BQU0sQ0FBQzhCLElBQUksQ0FBRUssT0FBTyxFQUFFLFVBQVdDLE1BQU0sRUFBRztRQUNoRSxPQUFPSixNQUFNLENBQUVJLE1BQU0sQ0FBQ0gsWUFBWSxDQUFFLGdDQUFpQyxDQUFFLENBQUMsS0FBS0QsTUFBTSxDQUFFakIsV0FBWSxDQUFDLElBQzlGcUIsTUFBTSxDQUFDSCxZQUFZLENBQUUsNENBQTZDLENBQUMsS0FBSy9CLGVBQWU7TUFDNUYsQ0FBRSxDQUFDLENBQUUsQ0FBQyxDQUFFLElBQUksSUFBSTtJQUNqQjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNtQywrQkFBK0JBLENBQUV0QixXQUFXLEVBQUViLGVBQWUsRUFBRztNQUN4RSxJQUFJUCxXQUFXLEdBQUdOLG9DQUFvQyxDQUFFMkMsTUFBTSxDQUFFakIsV0FBWSxDQUFDLENBQUUsSUFBSSxFQUFFO01BRXJGLE9BQU9wQixXQUFXLENBQUNLLE1BQU0sQ0FBRSxVQUFXQyxVQUFVLEVBQUc7UUFDbEQsT0FBT0EsVUFBVSxDQUFDRSxFQUFFLEtBQUtELGVBQWU7TUFDekMsQ0FBRSxDQUFDLENBQUUsQ0FBQyxDQUFFLElBQUksSUFBSTtJQUNqQjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNvQyx3QkFBd0JBLENBQUV2QixXQUFXLEVBQUViLGVBQWUsRUFBRztNQUNqRSxPQUFPcUMsT0FBTyxDQUNiaEQsOEJBQThCLENBQUV5QyxNQUFNLENBQUVqQixXQUFZLENBQUMsQ0FBRSxJQUNwRHhCLDhCQUE4QixDQUFFeUMsTUFBTSxDQUFFakIsV0FBWSxDQUFDLENBQUUsQ0FBRWIsZUFBZSxDQUM1RSxDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNzQyx1Q0FBdUNBLENBQUV6QixXQUFXLEVBQUViLGVBQWUsRUFBRztNQUNoRixJQUFJdUMsV0FBVyxHQUFHLENBQUVULE1BQU0sQ0FBRWpCLFdBQVksQ0FBQyxDQUFFO01BQzNDLElBQUlsQixRQUFRLEdBQUcsQ0FBQyxDQUFDO01BQ2pCLElBQUk2QyxjQUFjLEdBQUcsRUFBRTtNQUV2QixPQUFRRCxXQUFXLENBQUNFLE1BQU0sRUFBRztRQUM1QjVCLFdBQVcsR0FBR2lCLE1BQU0sQ0FBRVMsV0FBVyxDQUFDRyxLQUFLLENBQUMsQ0FBRSxDQUFDO1FBQzNDLElBQUssQ0FBRTdCLFdBQVcsSUFBSWxCLFFBQVEsQ0FBRWtCLFdBQVcsQ0FBRSxFQUFHO1VBQy9DO1FBQ0Q7UUFDQWxCLFFBQVEsQ0FBRWtCLFdBQVcsQ0FBRSxHQUFHLElBQUk7UUFDOUIsSUFBS3NCLCtCQUErQixDQUFFdEIsV0FBVyxFQUFFYixlQUFnQixDQUFDLEVBQUc7VUFDdEV3QyxjQUFjLENBQUNHLElBQUksQ0FBRTlCLFdBQVksQ0FBQztRQUNuQztRQUNBLENBQUV2QiwyQkFBMkIsQ0FBRXVCLFdBQVcsQ0FBRSxJQUFJLEVBQUUsRUFBRytCLE9BQU8sQ0FBRSxVQUFXQyxRQUFRLEVBQUc7VUFDbkZOLFdBQVcsQ0FBQ0ksSUFBSSxDQUFFRSxRQUFTLENBQUM7UUFDN0IsQ0FBRSxDQUFDO01BQ0o7TUFFQSxPQUFPTCxjQUFjO0lBQ3RCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU00sOEJBQThCQSxDQUFFQyxPQUFPLEVBQUVDLE1BQU0sRUFBRztNQUMxRDlCLE1BQU0sQ0FBQytCLElBQUksQ0FBRUQsTUFBTSxJQUFJLENBQUMsQ0FBRSxDQUFDLENBQUNKLE9BQU8sQ0FBRSxVQUFXTSxHQUFHLEVBQUc7UUFDckRILE9BQU8sR0FBR0ksTUFBTSxDQUFFSixPQUFPLElBQUksRUFBRyxDQUFDLENBQUNLLE9BQU8sQ0FBRSxJQUFJQyxNQUFNLENBQUUsS0FBSyxHQUFHSCxHQUFHLEdBQUcsS0FBSyxFQUFFLEdBQUksQ0FBQyxFQUFFQyxNQUFNLENBQUVILE1BQU0sQ0FBRUUsR0FBRyxDQUFHLENBQUUsQ0FBQztNQUM3RyxDQUFFLENBQUM7TUFFSCxPQUFPQyxNQUFNLENBQUVKLE9BQU8sSUFBSSxFQUFHLENBQUM7SUFDL0I7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTTyxpQ0FBaUNBLENBQUV6QyxXQUFXLEVBQUVkLFVBQVUsRUFBRztNQUNyRSxJQUFJd0QsdUJBQXVCLEdBQUdqQix1Q0FBdUMsQ0FBRXpCLFdBQVcsRUFBRWQsVUFBVSxDQUFDRSxFQUFHLENBQUM7TUFDbkcsSUFBSXVELGNBQWMsR0FBRyxDQUFDLEdBQUdELHVCQUF1QixDQUFDZCxNQUFNO01BQ3ZELElBQUlnQixPQUFPLEdBQUcsQ0FBQyxHQUFHRix1QkFBdUIsQ0FBQ2QsTUFBTSxJQUFJYyx1QkFBdUIsQ0FBQ0csS0FBSyxDQUFFLFVBQVdDLHNCQUFzQixFQUFHO1FBQ3RILE9BQU92Qix3QkFBd0IsQ0FBRXVCLHNCQUFzQixFQUFFNUQsVUFBVSxDQUFDRSxFQUFHLENBQUM7TUFDekUsQ0FBRSxDQUFDO01BQ0gsSUFBSTJELFNBQVMsR0FBR0osY0FBYyxHQUN6QkMsT0FBTyxHQUFHLGtDQUFrQyxHQUFHLGtDQUFrQyxHQUNqRkEsT0FBTyxHQUFHLDRCQUE0QixHQUFHLDRCQUE4QjtNQUM3RSxJQUFJSSxjQUFjLEdBQUc5RCxVQUFVLENBQUNLLEtBQUs7TUFDcEMsSUFBSTBELG1CQUFtQixHQUFHLEVBQUU7TUFFNUJQLHVCQUF1QixDQUFDWCxPQUFPLENBQUUsVUFBV2Usc0JBQXNCLEVBQUc7UUFDcEVHLG1CQUFtQixDQUFDbkIsSUFBSSxDQUFFLDBDQUEwQyxHQUFHZ0Isc0JBQXNCLEdBQUcsR0FBRyxHQUFHNUQsVUFBVSxDQUFDRSxFQUFHLENBQUM7UUFDckg2RCxtQkFBbUIsQ0FBQ25CLElBQUksQ0FBRSx3Q0FBd0MsR0FBR2dCLHNCQUFzQixHQUFHLEdBQUcsR0FBRzVELFVBQVUsQ0FBQ0UsRUFBRyxDQUFDO01BQ3BILENBQUUsQ0FBQztNQUVILE9BQU87UUFDTndELE9BQU8sRUFBRUEsT0FBTztRQUNoQkQsY0FBYyxFQUFFQSxjQUFjO1FBQzlCRCx1QkFBdUIsRUFBRUEsdUJBQXVCO1FBQ2hETyxtQkFBbUIsRUFBRUEsbUJBQW1CLENBQUNDLElBQUksQ0FBRSxHQUFJLENBQUM7UUFDcERDLGdCQUFnQixFQUFFbEIsOEJBQThCLENBQy9DN0UsUUFBUSxDQUFDZ0csSUFBSSxJQUFJaEcsUUFBUSxDQUFDZ0csSUFBSSxDQUFFTCxTQUFTLENBQUUsR0FBRzNGLFFBQVEsQ0FBQ2dHLElBQUksQ0FBRUwsU0FBUyxDQUFFLEdBQUdDLGNBQWMsRUFDekY7VUFDQ3pELEtBQUssRUFBRUwsVUFBVSxDQUFDSyxLQUFLO1VBQ3ZCOEQsUUFBUSxFQUFFM0UscUJBQXFCLENBQUV1QyxNQUFNLENBQUVqQixXQUFZLENBQUMsQ0FBRSxJQUFJO1FBQzdELENBQ0Q7TUFDRCxDQUFDO0lBQ0Y7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3NELG9DQUFvQ0EsQ0FBRW5FLGVBQWUsRUFBRztNQUNoRSxJQUFJaUMsT0FBTyxHQUFHakUsS0FBSyxHQUFHQSxLQUFLLENBQUMwRCxnQkFBZ0IsQ0FBRSw4Q0FBK0MsQ0FBQyxHQUFHLEVBQUU7TUFFbkc5QixLQUFLLENBQUMrQixTQUFTLENBQUNpQixPQUFPLENBQUNoQixJQUFJLENBQUVLLE9BQU8sRUFBRSxVQUFXQyxNQUFNLEVBQUc7UUFDMUQsSUFBSXJCLFdBQVc7UUFDZixJQUFJZCxVQUFVO1FBQ2QsSUFBSXFFLFlBQVk7UUFDaEIsSUFBSUMsSUFBSTtRQUVSLElBQUtuQyxNQUFNLENBQUNILFlBQVksQ0FBRSw0Q0FBNkMsQ0FBQyxLQUFLL0IsZUFBZSxFQUFHO1VBQzlGO1FBQ0Q7UUFDQWEsV0FBVyxHQUFHaUIsTUFBTSxDQUFFSSxNQUFNLENBQUNILFlBQVksQ0FBRSxnQ0FBaUMsQ0FBRSxDQUFDO1FBQy9FaEMsVUFBVSxHQUFHb0MsK0JBQStCLENBQUV0QixXQUFXLEVBQUViLGVBQWdCLENBQUM7UUFDNUUsSUFBSyxDQUFFRCxVQUFVLEVBQUc7VUFDbkI7UUFDRDtRQUNBcUUsWUFBWSxHQUFHZCxpQ0FBaUMsQ0FBRXpDLFdBQVcsRUFBRWQsVUFBVyxDQUFDO1FBQzNFbUMsTUFBTSxDQUFDb0MsWUFBWSxDQUFFLGVBQWUsRUFBRUYsWUFBWSxDQUFDWCxPQUFPLEdBQUcsTUFBTSxHQUFHLE9BQVEsQ0FBQztRQUMvRXZCLE1BQU0sQ0FBQ29DLFlBQVksQ0FBRSxlQUFlLEVBQUVGLFlBQVksQ0FBQ04sbUJBQW9CLENBQUM7UUFDeEU1QixNQUFNLENBQUNvQyxZQUFZLENBQUUsWUFBWSxFQUFFRixZQUFZLENBQUNKLGdCQUFpQixDQUFDO1FBQ2xFOUIsTUFBTSxDQUFDb0MsWUFBWSxDQUFFLE9BQU8sRUFBRUYsWUFBWSxDQUFDSixnQkFBaUIsQ0FBQztRQUM3REssSUFBSSxHQUFHbkMsTUFBTSxDQUFDcUMsYUFBYSxDQUFFLDZCQUE4QixDQUFDO1FBQzVELElBQUtGLElBQUksRUFBRztVQUNYQSxJQUFJLENBQUNHLFNBQVMsQ0FBQ0MsTUFBTSxDQUFFLHVCQUF1QixFQUFFLHNCQUF1QixDQUFDO1VBQ3hFSixJQUFJLENBQUNHLFNBQVMsQ0FBQ0UsR0FBRyxDQUFFTixZQUFZLENBQUNYLE9BQU8sR0FBRyxzQkFBc0IsR0FBRyx1QkFBd0IsQ0FBQztRQUM5RjtNQUNELENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNrQiwyQkFBMkJBLENBQUVDLFNBQVMsRUFBRztNQUNqRCxJQUFJQyxlQUFlLEdBQUcsQ0FBQyxDQUFDO01BQ3hCLElBQUlDLDBCQUEwQixHQUFHLEVBQUU7TUFDbkMsSUFBSUMsdUJBQXVCLEdBQUcsQ0FBQyxDQUFDO01BQ2hDLElBQUlDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztNQUUxQkosU0FBUyxDQUFDaEMsT0FBTyxDQUFFLFVBQVdzQixRQUFRLEVBQUc7UUFDeEMsSUFBSXJELFdBQVcsR0FBR29FLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDRSxLQUFLLENBQUVyRCxNQUFNLENBQUVvQyxRQUFRLElBQUlBLFFBQVEsQ0FBQ2pFLEVBQUcsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO1FBQ3JGLElBQUltRixTQUFTLEdBQUdILElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDRSxLQUFLLENBQUVyRCxNQUFNLENBQUVvQyxRQUFRLElBQUlBLFFBQVEsQ0FBQ2tCLFNBQVUsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO1FBRTFGLElBQUt2RSxXQUFXLEVBQUc7VUFDbEJnRSxlQUFlLENBQUVoRSxXQUFXLENBQUUsR0FBR3JCLDJCQUEyQixDQUFFMEUsUUFBUSxDQUFDbUIsaUJBQWtCLENBQUM7VUFDMUZQLDBCQUEwQixDQUFDbkMsSUFBSSxDQUFFOUIsV0FBWSxDQUFDO1VBQzlDbUUsaUJBQWlCLENBQUVuRSxXQUFXLENBQUUsR0FBR3NDLE1BQU0sQ0FBRWUsUUFBUSxDQUFDb0IsS0FBSyxJQUFJLEVBQUcsQ0FBQztVQUNqRSxJQUFLRixTQUFTLEVBQUc7WUFDaEIsSUFBSyxDQUFFTCx1QkFBdUIsQ0FBRUssU0FBUyxDQUFFLEVBQUc7Y0FDN0NMLHVCQUF1QixDQUFFSyxTQUFTLENBQUUsR0FBRyxFQUFFO1lBQzFDO1lBQ0FMLHVCQUF1QixDQUFFSyxTQUFTLENBQUUsQ0FBQ3pDLElBQUksQ0FBRTlCLFdBQVksQ0FBQztVQUN6RDtRQUNEO01BQ0QsQ0FBRSxDQUFDO01BQ0hLLE1BQU0sQ0FBQytCLElBQUksQ0FBRTVELDhCQUErQixDQUFDLENBQUN1RCxPQUFPLENBQUUsVUFBVzJDLGVBQWUsRUFBRztRQUNuRixJQUFJMUUsV0FBVyxHQUFHaUIsTUFBTSxDQUFFeUQsZUFBZ0IsQ0FBQztRQUUzQ3JFLE1BQU0sQ0FBQytCLElBQUksQ0FBRTVELDhCQUE4QixDQUFFd0IsV0FBVyxDQUFFLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQytCLE9BQU8sQ0FBRSxVQUFXNUMsZUFBZSxFQUFHO1VBQ3hHLElBQUl3RixlQUFlLEdBQUcsQ0FBRVgsZUFBZSxDQUFFaEUsV0FBVyxDQUFFLElBQUksRUFBRSxFQUFHZixNQUFNLENBQUUsVUFBV0MsVUFBVSxFQUFHO1lBQzlGLE9BQU9BLFVBQVUsQ0FBQ0UsRUFBRSxLQUFLRCxlQUFlO1VBQ3pDLENBQUUsQ0FBQyxDQUFFLENBQUMsQ0FBRTtVQUNSLElBQUl5RixtQkFBbUIsR0FBR3RELCtCQUErQixDQUFFdEIsV0FBVyxFQUFFYixlQUFnQixDQUFDO1VBRXpGLElBQUssQ0FBRXdGLGVBQWUsRUFBRztZQUN4QjdFLDJCQUEyQixDQUFFLFNBQVMsRUFBRUUsV0FBVyxFQUFFNEUsbUJBQW1CLElBQUk7Y0FDM0V4RixFQUFFLEVBQUVELGVBQWU7Y0FDbkJFLFlBQVksRUFBRTtZQUNmLENBQUUsQ0FBQztZQUNILE9BQU9iLDhCQUE4QixDQUFFd0IsV0FBVyxDQUFFLENBQUViLGVBQWUsQ0FBRTtVQUN4RTtRQUNELENBQUUsQ0FBQztRQUNILElBQUssQ0FBRWtCLE1BQU0sQ0FBQytCLElBQUksQ0FBRTVELDhCQUE4QixDQUFFd0IsV0FBVyxDQUFFLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQzRCLE1BQU0sRUFBRztVQUNsRixPQUFPcEQsOEJBQThCLENBQUV3QixXQUFXLENBQUU7UUFDckQ7TUFDRCxDQUFFLENBQUM7TUFDSDFCLG9DQUFvQyxHQUFHMEYsZUFBZTtNQUN0RHpGLGdDQUFnQyxHQUFHMEYsMEJBQTBCO01BQzdEeEYsMkJBQTJCLEdBQUd5Rix1QkFBdUI7TUFDckR4RixxQkFBcUIsR0FBR3lGLGlCQUFpQjtJQUMxQzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1UsOEJBQThCQSxDQUFBLEVBQUc7TUFDekMsSUFBSUMsY0FBYyxHQUFHL0gsUUFBUSxDQUFDZ0ksYUFBYTtNQUMzQyxJQUFJMUQsTUFBTSxHQUFHeUQsY0FBYyxJQUFJQSxjQUFjLENBQUNFLE9BQU8sR0FDbERGLGNBQWMsQ0FBQ0UsT0FBTyxDQUFFLDhDQUErQyxDQUFDLEdBQ3hFLElBQUk7TUFFUCxPQUFPM0QsTUFBTSxHQUFHO1FBQ2ZyQixXQUFXLEVBQUVpQixNQUFNLENBQUVJLE1BQU0sQ0FBQ0gsWUFBWSxDQUFFLGdDQUFpQyxDQUFFLENBQUM7UUFDOUUvQixlQUFlLEVBQUVrQyxNQUFNLENBQUNILFlBQVksQ0FBRSw0Q0FBNkM7TUFDcEYsQ0FBQyxHQUFHLElBQUk7SUFDVDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTK0QsOEJBQThCQSxDQUFFQyxjQUFjLEVBQUc7TUFDekQsSUFBSTdELE1BQU0sR0FBRzZELGNBQWMsR0FDeEIvRCwyQkFBMkIsQ0FBRStELGNBQWMsQ0FBQ2xGLFdBQVcsRUFBRWtGLGNBQWMsQ0FBQy9GLGVBQWdCLENBQUMsR0FDekYsSUFBSTtNQUVQLElBQUtrQyxNQUFNLElBQUksVUFBVSxLQUFLLE9BQU9BLE1BQU0sQ0FBQzhELEtBQUssRUFBRztRQUNuRDlELE1BQU0sQ0FBQzhELEtBQUssQ0FBQyxDQUFDO01BQ2Y7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxvQkFBb0JBLENBQUVDLFFBQVEsRUFBRztNQUN6QyxJQUFJQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7TUFFekIsT0FBT0QsUUFBUSxDQUFDcEcsTUFBTSxDQUFFLFVBQVdzRyxPQUFPLEVBQUc7UUFDNUMsSUFBSUMsVUFBVSxHQUFHRCxPQUFPLElBQUlBLE9BQU8sQ0FBQ0MsVUFBVSxHQUFHbEQsTUFBTSxDQUFFaUQsT0FBTyxDQUFDQyxVQUFXLENBQUMsR0FBRyxFQUFFO1FBRWxGLElBQUssQ0FBRUEsVUFBVSxJQUFJRixnQkFBZ0IsQ0FBRUUsVUFBVSxDQUFFLEVBQUc7VUFDckQsT0FBTyxLQUFLO1FBQ2I7UUFDQUYsZ0JBQWdCLENBQUVFLFVBQVUsQ0FBRSxHQUFHLElBQUk7UUFDckMsT0FBTyxJQUFJO01BQ1osQ0FBRSxDQUFDO0lBQ0o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLDJCQUEyQkEsQ0FBQSxFQUFHO01BQ3RDLElBQUlDLGlCQUFpQixHQUFHLENBQUM7TUFDekIsSUFBSUMsV0FBVyxHQUFHeEksS0FBSyxHQUFHQSxLQUFLLENBQUMwRCxnQkFBZ0IsQ0FBRSw0QkFBNkIsQ0FBQyxHQUFHLEVBQUU7TUFFckY5QixLQUFLLENBQUMrQixTQUFTLENBQUNpQixPQUFPLENBQUNoQixJQUFJLENBQUU0RSxXQUFXLEVBQUUsVUFBV0MsVUFBVSxFQUFHO1FBQ2xFQSxVQUFVLENBQUNqQyxTQUFTLENBQUNDLE1BQU0sQ0FBRSxRQUFRLEVBQUUsU0FBVSxDQUFDO1FBQ2xELElBQUtnQyxVQUFVLENBQUNDLE1BQU0sRUFBRztVQUN4QjtRQUNEO1FBRUFELFVBQVUsQ0FBQ2pDLFNBQVMsQ0FBQ0UsR0FBRyxDQUFFLENBQUMsS0FBSzZCLGlCQUFpQixHQUFHLENBQUMsR0FBRyxRQUFRLEdBQUcsU0FBVSxDQUFDO1FBQzlFQSxpQkFBaUIsSUFBSSxDQUFDO01BQ3ZCLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNJLHNCQUFzQkEsQ0FBRUMsY0FBYyxFQUFFL0YsV0FBVyxFQUFFZ0csV0FBVyxFQUFHO01BQzNFLElBQUlDLFlBQVk7TUFFaEJqRyxXQUFXLEdBQUdvRSxJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ0UsS0FBSyxDQUFFckQsTUFBTSxDQUFFakIsV0FBWSxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUM7TUFDckUsSUFBSyxDQUFFQSxXQUFXLEVBQUc7UUFDcEI7TUFDRDtNQUNBLElBQUssQ0FBRTVDLFFBQVEsQ0FBQzhJLFdBQVcsSUFBSSxRQUFRLEtBQUssT0FBTzlJLFFBQVEsQ0FBQzhJLFdBQVcsRUFBRztRQUN6RTlJLFFBQVEsQ0FBQzhJLFdBQVcsR0FBRyxDQUFDLENBQUM7TUFDMUI7TUFDQUQsWUFBWSxHQUFHLENBQUVsSCxLQUFLLENBQUNDLE9BQU8sQ0FBRTVCLFFBQVEsQ0FBQzhJLFdBQVcsQ0FBRUgsY0FBYyxDQUFHLENBQUMsR0FDckUzSSxRQUFRLENBQUM4SSxXQUFXLENBQUVILGNBQWMsQ0FBRSxHQUN0QyxFQUFFLEVBQ0h0RyxHQUFHLENBQUUsVUFBVzBHLFdBQVcsRUFBRztRQUMvQixPQUFPL0IsSUFBSSxDQUFDQyxHQUFHLENBQUUsQ0FBQyxFQUFFRCxJQUFJLENBQUNFLEtBQUssQ0FBRXJELE1BQU0sQ0FBRWtGLFdBQVksQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO01BQy9ELENBQUUsQ0FBQyxDQUFDbEgsTUFBTSxDQUFFLFVBQVdrSCxXQUFXLEVBQUVDLGNBQWMsRUFBRUMsZ0JBQWdCLEVBQUc7UUFDdEUsT0FBT0YsV0FBVyxJQUNkQSxXQUFXLEtBQUtuRyxXQUFXLElBQzNCb0csY0FBYyxLQUFLQyxnQkFBZ0IsQ0FBQ0MsT0FBTyxDQUFFSCxXQUFZLENBQUM7TUFDL0QsQ0FBRSxDQUFDO01BQ0gsSUFBS0gsV0FBVyxFQUFHO1FBQ2xCQyxZQUFZLENBQUNuRSxJQUFJLENBQUU5QixXQUFZLENBQUM7TUFDakM7TUFDQWlHLFlBQVksQ0FBQ00sSUFBSSxDQUFFLFVBQVdDLE9BQU8sRUFBRUMsUUFBUSxFQUFHO1FBQ2pELE9BQU9ELE9BQU8sR0FBR0MsUUFBUTtNQUMxQixDQUFFLENBQUM7TUFDSHJKLFFBQVEsQ0FBQzhJLFdBQVcsQ0FBRUgsY0FBYyxDQUFFLEdBQUdFLFlBQVk7SUFDdEQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNTLHNCQUFzQkEsQ0FBQSxFQUFHO01BQ2pDLElBQUsvSSxZQUFZLEVBQUc7UUFDbkJBLFlBQVksQ0FBQ2dKLFVBQVUsQ0FBQyxDQUFDO01BQzFCO01BQ0E3SSxxQkFBcUIsR0FBRyxJQUFJaEIsTUFBTSxDQUFDaUIsT0FBTyxDQUFDLENBQUM7TUFDNUNDLG9CQUFvQixHQUFHLElBQUlsQixNQUFNLENBQUNtQixPQUFPLENBQUMsQ0FBQztJQUM1Qzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTMkksV0FBV0EsQ0FBRUMsT0FBTyxFQUFHO01BQy9CQSxPQUFPLEdBQUdBLE9BQU8sSUFBSSxDQUFDLENBQUM7TUFDdkIsSUFBSTlDLFNBQVMsR0FBR2hGLEtBQUssQ0FBQ0MsT0FBTyxDQUFFNkgsT0FBTyxDQUFDOUMsU0FBVSxDQUFDLEdBQUc4QyxPQUFPLENBQUM5QyxTQUFTLEdBQUcsRUFBRTtNQUMzRSxJQUFJK0Msa0JBQWtCLEdBQUdqQyw4QkFBOEIsQ0FBQyxDQUFDO01BQ3pELElBQUlRLFFBQVEsR0FBR0Qsb0JBQW9CLENBQUVyRyxLQUFLLENBQUNDLE9BQU8sQ0FBRTZILE9BQU8sQ0FBQ3hCLFFBQVMsQ0FBQyxHQUFHd0IsT0FBTyxDQUFDeEIsUUFBUSxHQUFHLEVBQUcsQ0FBQztNQUNoRyxJQUFJMEIsbUJBQW1CLEdBQUdoSSxLQUFLLENBQUNDLE9BQU8sQ0FBRTZILE9BQU8sQ0FBQ0UsbUJBQW9CLENBQUMsR0FBR0YsT0FBTyxDQUFDRSxtQkFBbUIsR0FBRyxFQUFFO01BQ3pHLElBQUlDLG9CQUFvQixHQUFHakksS0FBSyxDQUFDQyxPQUFPLENBQUU1QixRQUFRLENBQUM4SSxXQUFXLElBQUk5SSxRQUFRLENBQUM4SSxXQUFXLENBQUNlLHFCQUFzQixDQUFDLEdBQUc3SixRQUFRLENBQUM4SSxXQUFXLENBQUNlLHFCQUFxQixHQUFHLEVBQUU7TUFDaEssSUFBSUMsc0JBQXNCLEdBQUduSSxLQUFLLENBQUNDLE9BQU8sQ0FBRTVCLFFBQVEsQ0FBQzhJLFdBQVcsSUFBSTlJLFFBQVEsQ0FBQzhJLFdBQVcsQ0FBQ2lCLG1CQUFvQixDQUFDLEdBQUcvSixRQUFRLENBQUM4SSxXQUFXLENBQUNpQixtQkFBbUIsR0FBRyxFQUFFO01BQzlKLElBQUlDLG9CQUFvQixHQUFHLENBQUMsQ0FBQztNQUM3QixJQUFJQyxzQkFBc0IsR0FBRyxDQUFDLENBQUM7TUFDL0IsSUFBSUMsd0JBQXdCLEdBQUcsQ0FBQyxDQUFDO01BQ2pDLElBQUlDLGFBQWEsR0FBR3BLLEtBQUssR0FBR0EsS0FBSyxDQUFDdUcsYUFBYSxDQUFFLG9DQUFxQyxDQUFDLEdBQUcsSUFBSTtNQUM5RixJQUFJOEQsV0FBVyxHQUFHckssS0FBSyxHQUFHQSxLQUFLLENBQUN1RyxhQUFhLENBQUUsa0NBQW1DLENBQUMsR0FBRyxJQUFJO01BQzFGLElBQUkrRCxZQUFZLEdBQUdwSyxZQUFZLENBQUUsY0FBZSxDQUFDO01BQ2pELElBQUlxSyxnQkFBZ0IsR0FBR3JLLFlBQVksQ0FBRSxpQkFBa0IsQ0FBQztNQUN4RCxJQUFJc0ssMkJBQTJCLEdBQUd0SyxZQUFZLENBQUUsb0JBQXFCLENBQUM7TUFFdEUsSUFBSyxDQUFFa0ssYUFBYSxJQUFJLENBQUVDLFdBQVcsSUFBSSxDQUFFQyxZQUFZLEVBQUc7UUFDekQsT0FBTyxLQUFLO01BQ2I7TUFDQTNELDJCQUEyQixDQUFFQyxTQUFVLENBQUM7TUFDeEN6RyxxQkFBcUIsQ0FBQyxDQUFDO01BQ3ZCeUcsU0FBUyxDQUFDaEMsT0FBTyxDQUFFLFVBQVdzQixRQUFRLEVBQUc7UUFDeEMsSUFBSXJELFdBQVcsR0FBR29FLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDRSxLQUFLLENBQUVyRCxNQUFNLENBQUVvQyxRQUFRLElBQUlBLFFBQVEsQ0FBQ2pFLEVBQUcsQ0FBQyxJQUFJLENBQUUsQ0FBRSxDQUFDO1FBRXJGLElBQUtZLFdBQVcsRUFBRztVQUNsQnNILHdCQUF3QixDQUFFdEgsV0FBVyxDQUFFLEdBQUdxRCxRQUFRO1FBQ25EO01BQ0QsQ0FBRSxDQUFDO01BQ0hxRCxzQkFBc0IsQ0FBQyxDQUFDO01BQ3hCYSxhQUFhLENBQUNLLFdBQVcsR0FBRyxFQUFFO01BQzlCSixXQUFXLENBQUNJLFdBQVcsR0FBRyxFQUFFO01BRTVCWixvQkFBb0IsQ0FBQ2pGLE9BQU8sQ0FBRSxVQUFXL0IsV0FBVyxFQUFHO1FBQ3REb0gsb0JBQW9CLENBQUVuRyxNQUFNLENBQUVqQixXQUFZLENBQUMsQ0FBRSxHQUFHLElBQUk7TUFDckQsQ0FBRSxDQUFDO01BQ0hrSCxzQkFBc0IsQ0FBQ25GLE9BQU8sQ0FBRSxVQUFXL0IsV0FBVyxFQUFHO1FBQ3hEcUgsc0JBQXNCLENBQUVwRyxNQUFNLENBQUVqQixXQUFZLENBQUMsQ0FBRSxHQUFHLElBQUk7TUFDdkQsQ0FBRSxDQUFDO01BRUgrRCxTQUFTLENBQUNoQyxPQUFPLENBQUUsVUFBV3NCLFFBQVEsRUFBRztRQUN4QyxJQUFJckQsV0FBVyxHQUFHaUIsTUFBTSxDQUFFb0MsUUFBUSxDQUFDakUsRUFBRyxDQUFDO1FBQ3ZDLElBQUlvRixpQkFBaUIsR0FBR2xHLG9DQUFvQyxDQUFFMEIsV0FBVyxDQUFFLElBQUksRUFBRTtRQUNqRixJQUFJNkgseUJBQXlCLEdBQUd4SCxNQUFNLENBQUMrQixJQUFJLENBQUU1RCw4QkFBOEIsQ0FBRXdCLFdBQVcsQ0FBRSxJQUFJLENBQUMsQ0FBRSxDQUFDO1FBQ2xHLElBQUk4SCw4QkFBOEIsR0FBRyxDQUFDLENBQUM7UUFFdkN0RCxpQkFBaUIsQ0FBQ3pDLE9BQU8sQ0FBRSxVQUFXN0MsVUFBVSxFQUFHO1VBQ2xENEksOEJBQThCLENBQUU1SSxVQUFVLENBQUNFLEVBQUUsQ0FBRSxHQUFHcUQsaUNBQWlDLENBQUV6QyxXQUFXLEVBQUVkLFVBQVcsQ0FBQztRQUMvRyxDQUFFLENBQUM7UUFDSCxJQUFJNkksY0FBYyxHQUFHMUgsTUFBTSxDQUFDQyxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUUrQyxRQUFRLEVBQUU7VUFDakQyRSxJQUFJLEVBQUU1SyxRQUFRLENBQUM0SyxJQUFJO1VBQ25CNUUsSUFBSSxFQUFFaEcsUUFBUSxDQUFDZ0csSUFBSTtVQUNuQm9CLGlCQUFpQixFQUFFQSxpQkFBaUI7VUFDcENxRCx5QkFBeUIsRUFBRUEseUJBQXlCO1VBQ3BEQyw4QkFBOEIsRUFBRUEsOEJBQThCO1VBQzlERyxtQkFBbUIsRUFBRXpHLE9BQU8sQ0FBRTZCLFFBQVEsQ0FBQzZFLFdBQVcsSUFBSWQsb0JBQW9CLENBQUVuRyxNQUFNLENBQUVvQyxRQUFRLENBQUNqRSxFQUFHLENBQUMsQ0FBRyxDQUFDO1VBQ3JHK0kscUJBQXFCLEVBQUUzRyxPQUFPLENBQUU2QixRQUFRLENBQUMrRSxhQUFhLElBQUlmLHNCQUFzQixDQUFFcEcsTUFBTSxDQUFFb0MsUUFBUSxDQUFDakUsRUFBRyxDQUFDLENBQUcsQ0FBQztVQUMzR2lKLG9CQUFvQixFQUFFLENBQUVoRixRQUFRLENBQUNpRixRQUFRLElBQUk5RyxPQUFPLENBQUU2RixzQkFBc0IsQ0FBRXBHLE1BQU0sQ0FBRW9DLFFBQVEsQ0FBQ2tCLFNBQVUsQ0FBQyxDQUFHO1FBQzlHLENBQUUsQ0FBQztRQUNILElBQUlnRSxVQUFVLEdBQUd4TCxRQUFRLENBQUN5TCxhQUFhLENBQUUsS0FBTSxDQUFDO1FBQ2hELElBQUlDLFlBQVk7UUFDaEIsSUFBSTdDLFVBQVU7UUFFZDJDLFVBQVUsQ0FBQ0csU0FBUyxHQUFHakIsWUFBWSxDQUFFTSxjQUFlLENBQUM7UUFDckRVLFlBQVksR0FBR0YsVUFBVSxDQUFDSSxRQUFRLENBQUUsQ0FBQyxDQUFFO1FBQ3ZDL0MsVUFBVSxHQUFHMkMsVUFBVSxDQUFDSSxRQUFRLENBQUUsQ0FBQyxDQUFFO1FBQ3JDLElBQUssQ0FBRUYsWUFBWSxJQUFJLENBQUU3QyxVQUFVLEVBQUc7VUFDckM7UUFDRDtRQUNBMkIsYUFBYSxDQUFDcUIsV0FBVyxDQUFFSCxZQUFhLENBQUM7UUFDekNqQixXQUFXLENBQUNvQixXQUFXLENBQUVoRCxVQUFXLENBQUM7UUFDckNwQixpQkFBaUIsQ0FBQ3pDLE9BQU8sQ0FBRSxVQUFXN0MsVUFBVSxFQUFHO1VBQ2xEWSwyQkFBMkIsQ0FBRSxhQUFhLEVBQUVFLFdBQVcsRUFBRWQsVUFBVSxFQUFFO1lBQ3BFMEQsT0FBTyxFQUFFckIsd0JBQXdCLENBQUV2QixXQUFXLEVBQUVkLFVBQVUsQ0FBQ0UsRUFBRztVQUMvRCxDQUFFLENBQUM7UUFDSixDQUFFLENBQUM7TUFDSixDQUFFLENBQUM7TUFDSHFHLDJCQUEyQixDQUFDLENBQUM7TUFDN0JSLDhCQUE4QixDQUFFNkIsa0JBQW1CLENBQUM7TUFFcEQsSUFBS1ksZ0JBQWdCLEVBQUc7UUFDdkJyQyxRQUFRLENBQUN0RCxPQUFPLENBQUUsVUFBV3dELE9BQU8sRUFBRztVQUN0QyxJQUFJc0QsWUFBWTtVQUNoQixJQUFJQyxjQUFjO1VBQ2xCLElBQUlDLGVBQWU7VUFFbkIsSUFBSyxLQUFLLEtBQUt4RCxPQUFPLENBQUN5RCxVQUFVLElBQUksSUFBSSxLQUFLekQsT0FBTyxDQUFDMEQsMEJBQTBCLEVBQUc7WUFDbEY7VUFDRDtVQUNBSixZQUFZLEdBQUdyQixXQUFXLENBQUM5RCxhQUFhLENBQ3ZDLHdDQUF3QyxHQUFHekMsTUFBTSxDQUFFc0UsT0FBTyxDQUFDdkYsV0FBWSxDQUFDLEdBQUcsa0NBQzVFLENBQUM7VUFDRCxJQUFLLENBQUU2SSxZQUFZLEVBQUc7WUFDckI7VUFDRDtVQUNBQyxjQUFjLEdBQUcvTCxRQUFRLENBQUN5TCxhQUFhLENBQUUsS0FBTSxDQUFDO1VBQ2hETSxjQUFjLENBQUNKLFNBQVMsR0FBR2hCLGdCQUFnQixDQUFFckgsTUFBTSxDQUFDQyxNQUFNLENBQUUsQ0FBQyxDQUFDLEVBQUVpRixPQUFPLEVBQUU7WUFDeEVuQyxJQUFJLEVBQUVoRyxRQUFRLENBQUNnRztVQUNoQixDQUFFLENBQUUsQ0FBQztVQUNMMkYsZUFBZSxHQUFHRCxjQUFjLENBQUNJLGlCQUFpQjtVQUNsRCxJQUFLSCxlQUFlLEVBQUc7WUFDdEJGLFlBQVksQ0FBQ0QsV0FBVyxDQUFFRyxlQUFnQixDQUFDO1lBQzNDeEwsd0JBQXdCLENBQ3ZCd0wsZUFBZSxFQUNmeEQsT0FBTyxFQUNQK0Isd0JBQXdCLENBQUVyRyxNQUFNLENBQUVzRSxPQUFPLENBQUN2RixXQUFZLENBQUMsQ0FBRSxJQUFJLENBQUMsQ0FDL0QsQ0FBQztVQUNGO1FBQ0QsQ0FBRSxDQUFDO01BQ0o7TUFDQSxJQUFLMkgsMkJBQTJCLEVBQUc7UUFDbENaLG1CQUFtQixDQUFDaEYsT0FBTyxDQUFFLFVBQVdvSCxRQUFRLEVBQUc7VUFDbEQsSUFBSU4sWUFBWSxHQUFHckIsV0FBVyxDQUFDOUQsYUFBYSxDQUMzQyx3Q0FBd0MsR0FBR3pDLE1BQU0sQ0FBRWtJLFFBQVEsQ0FBQ25KLFdBQVksQ0FBQyxHQUFHLGtDQUM3RSxDQUFDO1VBQ0QsSUFBSW9KLGVBQWU7VUFFbkIsSUFBSyxDQUFFUCxZQUFZLEVBQUc7WUFDckI7VUFDRDtVQUNBTyxlQUFlLEdBQUdyTSxRQUFRLENBQUN5TCxhQUFhLENBQUUsS0FBTSxDQUFDO1VBQ2pEWSxlQUFlLENBQUNWLFNBQVMsR0FBR2YsMkJBQTJCLENBQUV0SCxNQUFNLENBQUNDLE1BQU0sQ0FBRSxDQUFDLENBQUMsRUFBRTZJLFFBQVEsRUFBRTtZQUNyRi9GLElBQUksRUFBRWhHLFFBQVEsQ0FBQ2dHO1VBQ2hCLENBQUUsQ0FBRSxDQUFDO1VBQ0wsSUFBS2dHLGVBQWUsQ0FBQ0YsaUJBQWlCLEVBQUc7WUFDeENMLFlBQVksQ0FBQ0QsV0FBVyxDQUFFUSxlQUFlLENBQUNGLGlCQUFrQixDQUFDO1VBQzlEO1FBQ0QsQ0FBRSxDQUFDO01BQ0o7TUFDQTFMLHdCQUF3QixDQUFDLENBQUM7TUFDMUI2TCw0QkFBNEIsQ0FBQyxDQUFDO01BQzlCLE9BQU8sQ0FBQyxHQUFHdEYsU0FBUyxDQUFDbkMsTUFBTTtJQUM1Qjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzBILGtCQUFrQkEsQ0FBQSxFQUFHO01BQzdCLElBQUlDLFVBQVUsR0FBRyxDQUFDLENBQUM7TUFDbkIsSUFBSUMsWUFBWSxHQUFHck0sS0FBSyxHQUFHQSxLQUFLLENBQUMwRCxnQkFBZ0IsQ0FBRSw4QkFBK0IsQ0FBQyxHQUFHLEVBQUU7TUFFeEY5QixLQUFLLENBQUMrQixTQUFTLENBQUNpQixPQUFPLENBQUNoQixJQUFJLENBQUV5SSxZQUFZLEVBQUUsVUFBV0MsV0FBVyxFQUFHO1FBQ3BFLElBQUlDLE9BQU8sR0FBR0QsV0FBVyxDQUFDdkksWUFBWSxDQUFFLDRCQUE2QixDQUFDO1FBRXRFLElBQUssQ0FBRXdJLE9BQU8sRUFBRztVQUNoQjtRQUNEO1FBQ0EsSUFBSyxDQUFFSCxVQUFVLENBQUVHLE9BQU8sQ0FBRSxFQUFHO1VBQzlCSCxVQUFVLENBQUVHLE9BQU8sQ0FBRSxHQUFHLEVBQUU7UUFDM0I7UUFDQUgsVUFBVSxDQUFFRyxPQUFPLENBQUUsQ0FBQzVILElBQUksQ0FBRTJILFdBQVksQ0FBQztNQUMxQyxDQUFFLENBQUM7TUFFSCxPQUFPRixVQUFVO0lBQ2xCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNJLG9DQUFvQ0EsQ0FBRUgsWUFBWSxFQUFHO01BQzdELElBQUlJLGtCQUFrQixHQUFHLENBQUMsQ0FBQztNQUMzQixJQUFJQyxnQkFBZ0IsR0FBRyxFQUFFO01BRXpCTCxZQUFZLENBQUN6SCxPQUFPLENBQUUsVUFBVzBILFdBQVcsRUFBRztRQUM5QyxJQUFJSyxTQUFTLEdBQUdMLFdBQVcsQ0FBQzVJLGdCQUFnQixDQUFFLDRDQUE2QyxDQUFDO1FBRTVGOUIsS0FBSyxDQUFDK0IsU0FBUyxDQUFDaUIsT0FBTyxDQUFDaEIsSUFBSSxDQUFFK0ksU0FBUyxFQUFFLFVBQVdDLFlBQVksRUFBRztVQUNsRSxJQUFJNUssZUFBZSxHQUFHNEssWUFBWSxDQUFDN0ksWUFBWSxDQUFFLDBDQUEyQyxDQUFDO1VBRTdGNkksWUFBWSxDQUFDQyxLQUFLLENBQUNDLGdCQUFnQixHQUFHLEVBQUU7VUFDeEMsSUFBS0YsWUFBWSxDQUFDbEUsTUFBTSxJQUFJLENBQUUxRyxlQUFlLEVBQUc7WUFDL0M7VUFDRDtVQUNBLElBQUssQ0FBRXlLLGtCQUFrQixDQUFFekssZUFBZSxDQUFFLEVBQUc7WUFDOUN5SyxrQkFBa0IsQ0FBRXpLLGVBQWUsQ0FBRSxHQUFHLEVBQUU7WUFDMUMwSyxnQkFBZ0IsQ0FBQy9ILElBQUksQ0FBRTNDLGVBQWdCLENBQUM7VUFDekM7VUFDQXlLLGtCQUFrQixDQUFFekssZUFBZSxDQUFFLENBQUMyQyxJQUFJLENBQUVpSSxZQUFhLENBQUM7UUFDM0QsQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO01BRUhGLGdCQUFnQixDQUFDOUgsT0FBTyxDQUFFLFVBQVc1QyxlQUFlLEVBQUc7UUFDdEQsSUFBSW9CLEtBQUssR0FBR3FKLGtCQUFrQixDQUFFekssZUFBZSxDQUFFO1FBQ2pELElBQUkrSyxZQUFZLEdBQUcsSUFBSTtRQUV2QixJQUFLLENBQUMsR0FBRzNKLEtBQUssQ0FBQ3FCLE1BQU0sRUFBRztVQUN2QjtRQUNEO1FBQ0FyQixLQUFLLENBQUN3QixPQUFPLENBQUUsVUFBV2dJLFlBQVksRUFBRztVQUN4QyxJQUFJSSxVQUFVLEdBQUdKLFlBQVksQ0FBQ0sscUJBQXFCLENBQUMsQ0FBQyxDQUFDQyxHQUFHO1VBRXpESCxZQUFZLEdBQUcsSUFBSSxLQUFLQSxZQUFZLEdBQUdDLFVBQVUsR0FBRy9GLElBQUksQ0FBQ0MsR0FBRyxDQUFFNkYsWUFBWSxFQUFFQyxVQUFXLENBQUM7UUFDekYsQ0FBRSxDQUFDO1FBQ0g1SixLQUFLLENBQUN3QixPQUFPLENBQUUsVUFBV2dJLFlBQVksRUFBRztVQUN4QyxJQUFJTyxZQUFZLEdBQUdKLFlBQVksR0FBR0gsWUFBWSxDQUFDSyxxQkFBcUIsQ0FBQyxDQUFDLENBQUNDLEdBQUc7VUFFMUUsSUFBSyxHQUFHLEdBQUdDLFlBQVksRUFBRztZQUN6QlAsWUFBWSxDQUFDQyxLQUFLLENBQUNDLGdCQUFnQixHQUFHSyxZQUFZLEdBQUcsSUFBSTtVQUMxRDtRQUNELENBQUUsQ0FBQztNQUNKLENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLHVCQUF1QkEsQ0FBRUMsUUFBUSxFQUFHO01BQzVDLElBQUlqQixVQUFVLEdBQUdELGtCQUFrQixDQUFDLENBQUM7TUFDckMsSUFBSW1CLHFCQUFxQixHQUFHLENBQUUxTCxLQUFLLENBQUNDLE9BQU8sQ0FBRXdMLFFBQVMsQ0FBQyxJQUFJLENBQUVBLFFBQVEsQ0FBQzVJLE1BQU07TUFFNUV2QixNQUFNLENBQUMrQixJQUFJLENBQUVtSCxVQUFXLENBQUMsQ0FBQ3hILE9BQU8sQ0FBRSxVQUFXMkgsT0FBTyxFQUFHO1FBQ3ZELElBQUlnQixjQUFjLEdBQUcsQ0FBQztRQUN0QixJQUFJQyxtQkFBbUI7UUFDdkIsSUFBSUMsMkJBQTJCO1FBRS9CLElBQUssQ0FBRUgscUJBQXFCLElBQUksQ0FBQyxDQUFDLEtBQUtELFFBQVEsQ0FBQ2xFLE9BQU8sQ0FBRW9ELE9BQVEsQ0FBQyxFQUFHO1VBQ3BFO1FBQ0Q7UUFDQUgsVUFBVSxDQUFFRyxPQUFPLENBQUUsQ0FBQzNILE9BQU8sQ0FBRSxVQUFXMEgsV0FBVyxFQUFHO1VBQ3ZEQSxXQUFXLENBQUNPLEtBQUssQ0FBQ2EsU0FBUyxHQUFHLEVBQUU7UUFDakMsQ0FBRSxDQUFDO1FBQ0hsQixvQ0FBb0MsQ0FBRUosVUFBVSxDQUFFRyxPQUFPLENBQUcsQ0FBQztRQUM3REgsVUFBVSxDQUFFRyxPQUFPLENBQUUsQ0FBQzNILE9BQU8sQ0FBRSxVQUFXMEgsV0FBVyxFQUFHO1VBQ3ZEaUIsY0FBYyxHQUFHdEcsSUFBSSxDQUFDQyxHQUFHLENBQUVxRyxjQUFjLEVBQUVqQixXQUFXLENBQUNXLHFCQUFxQixDQUFDLENBQUMsQ0FBQ1UsTUFBTyxDQUFDO1FBQ3hGLENBQUUsQ0FBQztRQUVISCxtQkFBbUIsR0FBR3ZHLElBQUksQ0FBQzJHLElBQUksQ0FBRUwsY0FBZSxDQUFDO1FBQ2pERSwyQkFBMkIsR0FBR0QsbUJBQW1CLEdBQUdBLG1CQUFtQixHQUFHLElBQUksR0FBRyxFQUFFO1FBQ25GcEIsVUFBVSxDQUFFRyxPQUFPLENBQUUsQ0FBQzNILE9BQU8sQ0FBRSxVQUFXMEgsV0FBVyxFQUFHO1VBQ3ZELElBQUs5TCxZQUFZLEVBQUc7WUFDbkJLLG9CQUFvQixDQUFDZ04sR0FBRyxDQUFFdkIsV0FBVyxFQUFFa0IsbUJBQW9CLENBQUM7VUFDN0Q7VUFDQSxJQUFLbEIsV0FBVyxDQUFDTyxLQUFLLENBQUNhLFNBQVMsS0FBS0QsMkJBQTJCLEVBQUc7WUFDbEVuQixXQUFXLENBQUNPLEtBQUssQ0FBQ2EsU0FBUyxHQUFHRCwyQkFBMkI7VUFDMUQ7UUFDRCxDQUFFLENBQUM7TUFDSixDQUFFLENBQUM7TUFFSG5OLHlCQUF5QixDQUFDLENBQUM7SUFDNUI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBUzRMLDRCQUE0QkEsQ0FBRW1CLFFBQVEsRUFBRztNQUNqRCxJQUFLLFFBQVEsS0FBSyxPQUFPQSxRQUFRLElBQUlBLFFBQVEsRUFBRztRQUMvQ3RNLGdCQUFnQixDQUFFc00sUUFBUSxDQUFFLEdBQUcsSUFBSTtNQUNwQyxDQUFDLE1BQU0sSUFBS3pMLEtBQUssQ0FBQ0MsT0FBTyxDQUFFd0wsUUFBUyxDQUFDLEVBQUc7UUFDdkNBLFFBQVEsQ0FBQ3pJLE9BQU8sQ0FBRSxVQUFXMkgsT0FBTyxFQUFHO1VBQ3RDLElBQUtBLE9BQU8sRUFBRztZQUNkeEwsZ0JBQWdCLENBQUV3TCxPQUFPLENBQUUsR0FBRyxJQUFJO1VBQ25DO1FBQ0QsQ0FBRSxDQUFDO01BQ0osQ0FBQyxNQUFNO1FBQ052TCxvQkFBb0IsR0FBRyxJQUFJO01BQzVCO01BRUEsSUFBS0MscUJBQXFCLEVBQUc7UUFDNUI7TUFDRDtNQUNBQSxxQkFBcUIsR0FBR3RCLE1BQU0sQ0FBQ21PLHFCQUFxQixDQUFFLFlBQVk7UUFDakUsSUFBSUMsdUJBQXVCLEdBQUcvTSxvQkFBb0IsR0FBRyxJQUFJLEdBQUdrQyxNQUFNLENBQUMrQixJQUFJLENBQUVsRSxnQkFBaUIsQ0FBQztRQUUzRkUscUJBQXFCLEdBQUcsQ0FBQztRQUN6QkYsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCQyxvQkFBb0IsR0FBRyxLQUFLO1FBQzVCb00sdUJBQXVCLENBQUVXLHVCQUF3QixDQUFDO01BQ25ELENBQUUsQ0FBQztJQUNKOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLGNBQWNBLENBQUUxQixXQUFXLEVBQUc7TUFDdEMsT0FBT3JGLElBQUksQ0FBQzJHLElBQUksQ0FBRXRCLFdBQVcsQ0FBQ1cscUJBQXFCLENBQUMsQ0FBQyxDQUFDVSxNQUFPLENBQUM7SUFDL0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU00saUJBQWlCQSxDQUFFQyxjQUFjLEVBQUc7TUFDNUMsSUFBSUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO01BRXpCdk0sS0FBSyxDQUFDK0IsU0FBUyxDQUFDaUIsT0FBTyxDQUFDaEIsSUFBSSxDQUFFc0ssY0FBYyxFQUFFLFVBQVdFLFlBQVksRUFBRztRQUN2RSxJQUFJOUIsV0FBVyxHQUFHOEIsWUFBWSxDQUFDQyxNQUFNO1FBQ3JDLElBQUk5QixPQUFPLEdBQUdELFdBQVcsQ0FBQ3ZJLFlBQVksQ0FBRSw0QkFBNkIsQ0FBQztRQUN0RSxJQUFJdUssZUFBZSxHQUFHek4sb0JBQW9CLENBQUMwTixHQUFHLENBQUVqQyxXQUFZLENBQUM7UUFDN0QsSUFBSWtDLGNBQWMsR0FBR1IsY0FBYyxDQUFFMUIsV0FBWSxDQUFDO1FBRWxELElBQUssUUFBUSxLQUFLLE9BQU9nQyxlQUFlLElBQUksQ0FBQyxJQUFJckgsSUFBSSxDQUFDd0gsR0FBRyxDQUFFRCxjQUFjLEdBQUdGLGVBQWdCLENBQUMsRUFBRztVQUMvRnpOLG9CQUFvQixDQUFDNk4sTUFBTSxDQUFFcEMsV0FBWSxDQUFDO1VBQzFDO1FBQ0Q7UUFDQXpMLG9CQUFvQixDQUFDNk4sTUFBTSxDQUFFcEMsV0FBWSxDQUFDO1FBQzFDLElBQUtDLE9BQU8sRUFBRztVQUNkNEIsZ0JBQWdCLENBQUU1QixPQUFPLENBQUUsR0FBRyxJQUFJO1FBQ25DO01BQ0QsQ0FBRSxDQUFDO01BRUgsSUFBS3JKLE1BQU0sQ0FBQytCLElBQUksQ0FBRWtKLGdCQUFpQixDQUFDLENBQUMxSixNQUFNLEVBQUc7UUFDN0N5SCw0QkFBNEIsQ0FBRWhKLE1BQU0sQ0FBQytCLElBQUksQ0FBRWtKLGdCQUFpQixDQUFFLENBQUM7TUFDaEU7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU1EsWUFBWUEsQ0FBQSxFQUFHO01BQ3ZCLElBQUl0QyxZQUFZLEdBQUdyTSxLQUFLLEdBQUdBLEtBQUssQ0FBQzBELGdCQUFnQixDQUFFLDhCQUErQixDQUFDLEdBQUcsRUFBRTtNQUN4RixJQUFJa0wsWUFBWSxHQUFHLENBQUMsQ0FBQztNQUVyQmhOLEtBQUssQ0FBQytCLFNBQVMsQ0FBQ2lCLE9BQU8sQ0FBQ2hCLElBQUksQ0FBRXlJLFlBQVksRUFBRSxVQUFXQyxXQUFXLEVBQUc7UUFDcEUsSUFBSUMsT0FBTztRQUVYLElBQUs3TCwrQkFBK0IsSUFBSUMscUJBQXFCLENBQUNrTyxHQUFHLENBQUV2QyxXQUFZLENBQUMsRUFBRztVQUNsRjtRQUNEO1FBQ0FDLE9BQU8sR0FBR0QsV0FBVyxDQUFDdkksWUFBWSxDQUFFLDRCQUE2QixDQUFDO1FBQ2xFLElBQUt3SSxPQUFPLEVBQUc7VUFDZHFDLFlBQVksQ0FBRXJDLE9BQU8sQ0FBRSxHQUFHLElBQUk7UUFDL0I7UUFDQSxJQUFLN0wsK0JBQStCLEVBQUc7VUFDdENDLHFCQUFxQixDQUFDK0YsR0FBRyxDQUFFNEYsV0FBWSxDQUFDO1VBQ3hDLElBQUs5TCxZQUFZLEVBQUc7WUFDbkJBLFlBQVksQ0FBQ3NPLE9BQU8sQ0FBRXhDLFdBQVksQ0FBQztVQUNwQztRQUNEO01BQ0QsQ0FBRSxDQUFDO01BRUgsSUFBS3BKLE1BQU0sQ0FBQytCLElBQUksQ0FBRTJKLFlBQWEsQ0FBQyxDQUFDbkssTUFBTSxFQUFHO1FBQ3pDeUgsNEJBQTRCLENBQUVoSixNQUFNLENBQUMrQixJQUFJLENBQUUySixZQUFhLENBQUUsQ0FBQztNQUM1RDtNQUNBLE9BQU8xTCxNQUFNLENBQUMrQixJQUFJLENBQUUySixZQUFhLENBQUM7SUFDbkM7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0csb0JBQW9CQSxDQUFFQyxnQkFBZ0IsRUFBRztNQUNqRCxJQUFJYixnQkFBZ0IsR0FBRyxDQUFDLENBQUM7TUFFekJRLFlBQVksQ0FBQyxDQUFDO01BQ2QvTSxLQUFLLENBQUMrQixTQUFTLENBQUNpQixPQUFPLENBQUNoQixJQUFJLENBQUVvTCxnQkFBZ0IsRUFBRSxVQUFXQyxlQUFlLEVBQUc7UUFDNUUsSUFBSTNDLFdBQVcsR0FBRzJDLGVBQWUsQ0FBQ1osTUFBTSxDQUFDeEcsT0FBTyxHQUM3Q29ILGVBQWUsQ0FBQ1osTUFBTSxDQUFDeEcsT0FBTyxDQUFFLDhCQUErQixDQUFDLEdBQ2hFLElBQUk7UUFDUCxJQUFJMEUsT0FBTyxHQUFHRCxXQUFXLEdBQUdBLFdBQVcsQ0FBQ3ZJLFlBQVksQ0FBRSw0QkFBNkIsQ0FBQyxHQUFHLEVBQUU7UUFFekYsSUFBS3dJLE9BQU8sRUFBRztVQUNkNEIsZ0JBQWdCLENBQUU1QixPQUFPLENBQUUsR0FBRyxJQUFJO1FBQ25DO01BQ0QsQ0FBRSxDQUFDO01BRUgsSUFBS3JKLE1BQU0sQ0FBQytCLElBQUksQ0FBRWtKLGdCQUFpQixDQUFDLENBQUMxSixNQUFNLEVBQUc7UUFDN0N5SCw0QkFBNEIsQ0FBRWhKLE1BQU0sQ0FBQytCLElBQUksQ0FBRWtKLGdCQUFpQixDQUFFLENBQUM7TUFDaEU7SUFDRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTZSx1QkFBdUJBLENBQUVDLFVBQVUsRUFBRztNQUM5QyxJQUFJN0MsV0FBVyxHQUFHNkMsVUFBVSxDQUFDZCxNQUFNLElBQUljLFVBQVUsQ0FBQ2QsTUFBTSxDQUFDeEcsT0FBTyxHQUM3RHNILFVBQVUsQ0FBQ2QsTUFBTSxDQUFDeEcsT0FBTyxDQUFFLDhCQUErQixDQUFDLEdBQzNELElBQUk7TUFDUCxJQUFJMEUsT0FBTyxHQUFHRCxXQUFXLEdBQUdBLFdBQVcsQ0FBQ3ZJLFlBQVksQ0FBRSw0QkFBNkIsQ0FBQyxHQUFHLEVBQUU7TUFFekZtSSw0QkFBNEIsQ0FBRUssT0FBTyxJQUFJLElBQUssQ0FBQztJQUNoRDs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVM2QyxnQ0FBZ0NBLENBQUVDLEtBQUssRUFBRztNQUNsRCxJQUFJOUwsTUFBTSxHQUFHOEwsS0FBSyxJQUFJQSxLQUFLLENBQUM5TCxNQUFNLEdBQUc4TCxLQUFLLENBQUM5TCxNQUFNLEdBQUcsQ0FBQyxDQUFDO01BQ3RELElBQUlWLFdBQVcsR0FBR29FLElBQUksQ0FBQ0MsR0FBRyxDQUFFLENBQUMsRUFBRUQsSUFBSSxDQUFDRSxLQUFLLENBQUVyRCxNQUFNLENBQUVQLE1BQU0sQ0FBQ1YsV0FBWSxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUM7TUFDaEYsSUFBSWIsZUFBZSxHQUFHbUQsTUFBTSxDQUFFNUIsTUFBTSxDQUFDdkIsZUFBZSxJQUFJLEVBQUcsQ0FBQztNQUU1RCxJQUFLLENBQUVhLFdBQVcsSUFBSSxDQUFFc0IsK0JBQStCLENBQUV0QixXQUFXLEVBQUViLGVBQWdCLENBQUMsRUFBRztRQUN6RjtNQUNEO01BQ0FrSyw0QkFBNEIsQ0FBRSxXQUFXLEdBQUdySixXQUFZLENBQUM7SUFDMUQ7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN5TSxnQkFBZ0JBLENBQUUvQyxPQUFPLEVBQUUxRCxXQUFXLEVBQUUwRyxPQUFPLEVBQUc7TUFDMUQsSUFBSWxELFlBQVksR0FBR3JNLEtBQUssR0FBR0EsS0FBSyxDQUFDMEQsZ0JBQWdCLENBQUUsOEJBQStCLENBQUMsR0FBRyxFQUFFO01BQ3hGLElBQUk4TCxpQkFBaUIsR0FBR3JLLE1BQU0sQ0FBRW9ILE9BQU8sSUFBSSxFQUFHLENBQUMsQ0FBQ2tELEtBQUssQ0FBRSxrQkFBbUIsQ0FBQztNQUUzRTdOLEtBQUssQ0FBQytCLFNBQVMsQ0FBQ2lCLE9BQU8sQ0FBQ2hCLElBQUksQ0FBRXlJLFlBQVksRUFBRSxVQUFXQyxXQUFXLEVBQUc7UUFDcEUsSUFBSW9ELE9BQU8sR0FBR3BELFdBQVcsQ0FBQzVJLGdCQUFnQixDQUFFLGtDQUFtQyxDQUFDO1FBRWhGLElBQUs2SSxPQUFPLEtBQUtELFdBQVcsQ0FBQ3ZJLFlBQVksQ0FBRSw0QkFBNkIsQ0FBQyxFQUFHO1VBQzNFO1FBQ0Q7UUFDQXVJLFdBQVcsQ0FBQzlGLFNBQVMsQ0FBQ3RDLE1BQU0sQ0FBRSxhQUFhLEVBQUUyRSxXQUFZLENBQUM7UUFDMURqSCxLQUFLLENBQUMrQixTQUFTLENBQUNpQixPQUFPLENBQUNoQixJQUFJLENBQUU4TCxPQUFPLEVBQUUsVUFBV0MsY0FBYyxFQUFHO1VBQ2xFQSxjQUFjLENBQUNqSCxNQUFNLEdBQUcsQ0FBRUcsV0FBVztRQUN0QyxDQUFFLENBQUM7TUFDSixDQUFFLENBQUM7TUFFSCxJQUFLMEcsT0FBTyxFQUFHO1FBQ2RBLE9BQU8sQ0FBQ2pKLFlBQVksQ0FBRSxlQUFlLEVBQUV1QyxXQUFXLEdBQUcsTUFBTSxHQUFHLE9BQVEsQ0FBQztRQUN2RTBHLE9BQU8sQ0FBQ2pKLFlBQVksQ0FDbkIsWUFBWSxFQUNadUMsV0FBVyxHQUFHNUksUUFBUSxDQUFDZ0csSUFBSSxDQUFDMkosaUJBQWlCLEdBQUczUCxRQUFRLENBQUNnRyxJQUFJLENBQUM0SixlQUMvRCxDQUFDO01BQ0Y7TUFDQSxJQUFLTCxpQkFBaUIsRUFBRztRQUN4QjdHLHNCQUFzQixDQUFFLHVCQUF1QixFQUFFN0UsTUFBTSxDQUFFMEwsaUJBQWlCLENBQUUsQ0FBQyxDQUFHLENBQUMsRUFBRTNHLFdBQVksQ0FBQztNQUNqRztNQUNBcUQsNEJBQTRCLENBQUVLLE9BQVEsQ0FBQztJQUN4Qzs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3VELHlCQUF5QkEsQ0FBRWpOLFdBQVcsRUFBRWIsZUFBZSxFQUFFeUQsT0FBTyxFQUFFOEosT0FBTyxFQUFFUSxhQUFhLEVBQUc7TUFDbkcsSUFBSWhPLFVBQVUsR0FBR29DLCtCQUErQixDQUFFdEIsV0FBVyxFQUFFYixlQUFnQixDQUFDO01BQ2hGLElBQUlnTyxtQkFBbUI7TUFFdkJuTixXQUFXLEdBQUdvRSxJQUFJLENBQUNDLEdBQUcsQ0FBRSxDQUFDLEVBQUVELElBQUksQ0FBQ0UsS0FBSyxDQUFFckQsTUFBTSxDQUFFakIsV0FBWSxDQUFDLElBQUksQ0FBRSxDQUFFLENBQUM7TUFDckUsSUFBSyxDQUFFQSxXQUFXLElBQUksQ0FBRWQsVUFBVSxFQUFHO1FBQ3BDLE9BQU8sS0FBSztNQUNiO01BQ0EsSUFBS3FDLHdCQUF3QixDQUFFdkIsV0FBVyxFQUFFYixlQUFnQixDQUFDLEtBQUt5RCxPQUFPLEVBQUc7UUFDM0UsSUFBSyxDQUFFQSxPQUFPLElBQUlzSyxhQUFhLElBQUlSLE9BQU8sSUFBSSxVQUFVLEtBQUssT0FBT0EsT0FBTyxDQUFDdkgsS0FBSyxFQUFHO1VBQ25GdUgsT0FBTyxDQUFDdkgsS0FBSyxDQUFDLENBQUM7UUFDaEI7UUFDQSxPQUFPLElBQUk7TUFDWjtNQUNBZ0ksbUJBQW1CLEdBQUczTyw4QkFBOEIsQ0FBRXdCLFdBQVcsQ0FBRSxJQUFJLENBQUMsQ0FBQztNQUN6RSxJQUFLNEMsT0FBTyxFQUFHO1FBQ2R2QyxNQUFNLENBQUMrQixJQUFJLENBQUUrSyxtQkFBb0IsQ0FBQyxDQUFDcEwsT0FBTyxDQUFFLFVBQVdxTCxvQkFBb0IsRUFBRztVQUM3RSxJQUFJQyxlQUFlLEdBQUcvTCwrQkFBK0IsQ0FBRXRCLFdBQVcsRUFBRW9OLG9CQUFxQixDQUFDO1VBRTFGLElBQ0NBLG9CQUFvQixLQUFLak8sZUFBZSxLQUNuQ0QsVUFBVSxDQUFDUSxZQUFZLElBQU0yTixlQUFlLElBQUlBLGVBQWUsQ0FBQzNOLFlBQWMsQ0FBRSxFQUNwRjtZQUNENE4sNEJBQTRCLENBQUV0TixXQUFXLEVBQUVxTixlQUFlLEVBQUUsS0FBSyxFQUFFLElBQUssQ0FBQztVQUMxRTtRQUNELENBQUUsQ0FBQztNQUNKO01BQ0FDLDRCQUE0QixDQUFFdE4sV0FBVyxFQUFFZCxVQUFVLEVBQUUwRCxPQUFPLEVBQUU4SixPQUFRLENBQUM7TUFDekUsSUFBSyxDQUFFOUosT0FBTyxJQUFJc0ssYUFBYSxJQUFJUixPQUFPLElBQUksVUFBVSxLQUFLLE9BQU9BLE9BQU8sQ0FBQ3ZILEtBQUssRUFBRztRQUNuRnVILE9BQU8sQ0FBQ3ZILEtBQUssQ0FBQyxDQUFDO01BQ2hCO01BRUEsT0FBTyxJQUFJO0lBQ1o7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTb0ksK0JBQStCQSxDQUFFdk4sV0FBVyxFQUFFYixlQUFlLEVBQUV5RCxPQUFPLEVBQUU4SixPQUFPLEVBQUVRLGFBQWEsRUFBRztNQUN6RyxJQUFJeEssdUJBQXVCLEdBQUdqQix1Q0FBdUMsQ0FBRXpCLFdBQVcsRUFBRWIsZUFBZ0IsQ0FBQztNQUNyRyxJQUFJcU8sYUFBYSxHQUFHLENBQUM7TUFFckI5Syx1QkFBdUIsQ0FBQ1gsT0FBTyxDQUFFLFVBQVdlLHNCQUFzQixFQUFHO1FBQ3BFLElBQUttSyx5QkFBeUIsQ0FBRW5LLHNCQUFzQixFQUFFM0QsZUFBZSxFQUFFeUQsT0FBTyxFQUFFLElBQUksRUFBRSxLQUFNLENBQUMsRUFBRztVQUNqRzRLLGFBQWEsSUFBSSxDQUFDO1FBQ25CO01BQ0QsQ0FBRSxDQUFDO01BQ0hsSyxvQ0FBb0MsQ0FBRW5FLGVBQWdCLENBQUM7TUFDdkQsSUFBS3FPLGFBQWEsSUFBSSxDQUFFNUssT0FBTyxJQUFJc0ssYUFBYSxJQUFJUixPQUFPLElBQUksVUFBVSxLQUFLLE9BQU9BLE9BQU8sQ0FBQ3ZILEtBQUssRUFBRztRQUNwR3VILE9BQU8sQ0FBQ3ZILEtBQUssQ0FBQyxDQUFDO01BQ2hCO01BRUEsT0FBTyxDQUFDLEdBQUdxSSxhQUFhO0lBQ3pCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNGLDRCQUE0QkEsQ0FBRXROLFdBQVcsRUFBRWQsVUFBVSxFQUFFMEQsT0FBTyxFQUFFOEosT0FBTyxFQUFHO01BQ2xGLElBQUlsRCxZQUFZLEdBQUdyTSxLQUFLLEdBQUdBLEtBQUssQ0FBQzBELGdCQUFnQixDQUFFLHdDQUF3QyxHQUFHSSxNQUFNLENBQUVqQixXQUFZLENBQUMsR0FBRyxJQUFLLENBQUMsR0FBRyxFQUFFO01BQ2pJLElBQUlPLEtBQUs7TUFFVCxJQUFLLENBQUVyQixVQUFVLEVBQUc7UUFDbkI7TUFDRDtNQUNBLElBQUssQ0FBRVYsOEJBQThCLENBQUV3QixXQUFXLENBQUUsRUFBRztRQUN0RHhCLDhCQUE4QixDQUFFd0IsV0FBVyxDQUFFLEdBQUcsQ0FBQyxDQUFDO01BQ25EO01BQ0EsSUFBSzRDLE9BQU8sRUFBRztRQUNkcEUsOEJBQThCLENBQUV3QixXQUFXLENBQUUsQ0FBRWQsVUFBVSxDQUFDRSxFQUFFLENBQUUsR0FBRyxJQUFJO01BQ3RFLENBQUMsTUFBTTtRQUNOLE9BQU9aLDhCQUE4QixDQUFFd0IsV0FBVyxDQUFFLENBQUVkLFVBQVUsQ0FBQ0UsRUFBRSxDQUFFO1FBQ3JFLElBQUssQ0FBRWlCLE1BQU0sQ0FBQytCLElBQUksQ0FBRTVELDhCQUE4QixDQUFFd0IsV0FBVyxDQUFHLENBQUMsQ0FBQzRCLE1BQU0sRUFBRztVQUM1RSxPQUFPcEQsOEJBQThCLENBQUV3QixXQUFXLENBQUU7UUFDckQ7TUFDRDtNQUVBTyxLQUFLLEdBQUdDLDBCQUEwQixDQUFFUixXQUFXLEVBQUVkLFVBQVUsQ0FBQ0UsRUFBRyxDQUFDO01BQ2hFTCxLQUFLLENBQUMrQixTQUFTLENBQUNpQixPQUFPLENBQUNoQixJQUFJLENBQUVSLEtBQUssRUFBRSxVQUFXUyxJQUFJLEVBQUc7UUFDdERBLElBQUksQ0FBQzZFLE1BQU0sR0FBRyxDQUFFakQsT0FBTztRQUN2QjVCLElBQUksQ0FBQ3lDLFlBQVksQ0FBRSxhQUFhLEVBQUViLE9BQU8sR0FBRyxPQUFPLEdBQUcsTUFBTyxDQUFDO01BQy9ELENBQUUsQ0FBQztNQUNIN0QsS0FBSyxDQUFDK0IsU0FBUyxDQUFDaUIsT0FBTyxDQUFDaEIsSUFBSSxDQUFFeUksWUFBWSxFQUFFLFVBQVdDLFdBQVcsRUFBRztRQUNwRUEsV0FBVyxDQUFDOUYsU0FBUyxDQUFDdEMsTUFBTSxDQUMzQiwyQkFBMkIsRUFDM0JHLE9BQU8sQ0FBRW5CLE1BQU0sQ0FBQytCLElBQUksQ0FBRTVELDhCQUE4QixDQUFFd0IsV0FBVyxDQUFFLElBQUksQ0FBQyxDQUFFLENBQUMsQ0FBQzRCLE1BQU8sQ0FDcEYsQ0FBQztNQUNGLENBQUUsQ0FBQztNQUNIOUIsMkJBQTJCLENBQUU4QyxPQUFPLEdBQUcsUUFBUSxHQUFHLFFBQVEsRUFBRTVDLFdBQVcsRUFBRWQsVUFBVSxFQUFFO1FBQ3BGMEQsT0FBTyxFQUFFQTtNQUNWLENBQUUsQ0FBQztNQUNIVSxvQ0FBb0MsQ0FBRXBFLFVBQVUsQ0FBQ0UsRUFBRyxDQUFDO01BQ3JEaUssNEJBQTRCLENBQUUsV0FBVyxHQUFHckosV0FBWSxDQUFDO0lBQzFEOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3lOLDhCQUE4QkEsQ0FBRXRPLGVBQWUsRUFBRXlELE9BQU8sRUFBRztNQUNuRSxJQUFJOEssYUFBYSxHQUFHLENBQUM7TUFFckJyTixNQUFNLENBQUMrQixJQUFJLENBQUU5RCxvQ0FBcUMsQ0FBQyxDQUFDeUQsT0FBTyxDQUFFLFVBQVcvQixXQUFXLEVBQUc7UUFDckYsSUFBS2lOLHlCQUF5QixDQUFFaE0sTUFBTSxDQUFFakIsV0FBWSxDQUFDLEVBQUViLGVBQWUsRUFBRXlELE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBTSxDQUFDLEVBQUc7VUFDaEc4SyxhQUFhLElBQUksQ0FBQztRQUNuQjtNQUNELENBQUUsQ0FBQztNQUVILE9BQU9BLGFBQWE7SUFDckI7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLDJCQUEyQkEsQ0FBRXhPLGVBQWUsRUFBRztNQUN2RCxJQUFJeU8sa0JBQWtCLEdBQUcsQ0FBQztNQUUxQnJQLGdDQUFnQyxDQUFDc1AsSUFBSSxDQUFFLFVBQVc3TixXQUFXLEVBQUc7UUFDL0QsSUFBSyxDQUFFc0IsK0JBQStCLENBQUV0QixXQUFXLEVBQUViLGVBQWdCLENBQUMsRUFBRztVQUN4RSxPQUFPLEtBQUs7UUFDYjtRQUNBLElBQUs4Tix5QkFBeUIsQ0FBRWpOLFdBQVcsRUFBRWIsZUFBZSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBTSxDQUFDLEVBQUc7VUFDbkZ5TyxrQkFBa0IsR0FBRzVOLFdBQVc7VUFDaEMsT0FBTyxJQUFJO1FBQ1o7UUFDQSxPQUFPLEtBQUs7TUFDYixDQUFFLENBQUM7TUFFSCxPQUFPNE4sa0JBQWtCO0lBQzFCOztJQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNFLDZCQUE2QkEsQ0FBRXRCLEtBQUssRUFBRztNQUMvQyxJQUFJRSxPQUFPLEdBQUdGLEtBQUssQ0FBQ2hCLE1BQU0sSUFBSWdCLEtBQUssQ0FBQ2hCLE1BQU0sQ0FBQ3hHLE9BQU8sR0FDL0N3SCxLQUFLLENBQUNoQixNQUFNLENBQUN4RyxPQUFPLENBQUUsOENBQStDLENBQUMsR0FDdEUsSUFBSTtNQUNQLElBQUloRixXQUFXO01BQ2YsSUFBSWIsZUFBZTtNQUNuQixJQUFJRCxVQUFVO01BQ2QsSUFBSXFFLFlBQVk7TUFFaEIsSUFBSyxDQUFFbUosT0FBTyxFQUFHO1FBQ2hCLE9BQU8sS0FBSztNQUNiO01BQ0ExTSxXQUFXLEdBQUdpQixNQUFNLENBQUV5TCxPQUFPLENBQUN4TCxZQUFZLENBQUUsZ0NBQWlDLENBQUUsQ0FBQztNQUNoRi9CLGVBQWUsR0FBR3VOLE9BQU8sQ0FBQ3hMLFlBQVksQ0FBRSw0Q0FBNkMsQ0FBQztNQUN0RmhDLFVBQVUsR0FBR29DLCtCQUErQixDQUFFdEIsV0FBVyxFQUFFYixlQUFnQixDQUFDO01BQzVFLElBQUssQ0FBRUQsVUFBVSxFQUFHO1FBQ25CLE9BQU8sS0FBSztNQUNiO01BQ0FxRSxZQUFZLEdBQUdkLGlDQUFpQyxDQUFFekMsV0FBVyxFQUFFZCxVQUFXLENBQUM7TUFDM0UsSUFBS3NOLEtBQUssQ0FBQ3VCLGNBQWMsRUFBRztRQUMzQnZCLEtBQUssQ0FBQ3VCLGNBQWMsQ0FBQyxDQUFDO01BQ3ZCO01BQ0EsT0FBT1IsK0JBQStCLENBQ3JDdk4sV0FBVyxFQUNYYixlQUFlLEVBQ2YsQ0FBRW9FLFlBQVksQ0FBQ1gsT0FBTyxFQUN0QjhKLE9BQU8sRUFDUCxJQUNELENBQUM7SUFDRjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNzQiwrQkFBK0JBLENBQUV4QixLQUFLLEVBQUc7TUFDakQsSUFBSXhMLElBQUk7TUFDUixJQUFJaEIsV0FBVztNQUNmLElBQUliLGVBQWU7TUFDbkIsSUFBSXVOLE9BQU87TUFFWCxJQUFLLFFBQVEsS0FBS0YsS0FBSyxDQUFDbkssR0FBRyxJQUFJbUssS0FBSyxDQUFDeUIsZ0JBQWdCLEVBQUc7UUFDdkQsT0FBTyxLQUFLO01BQ2I7TUFDQWpOLElBQUksR0FBR3dMLEtBQUssQ0FBQ2hCLE1BQU0sSUFBSWdCLEtBQUssQ0FBQ2hCLE1BQU0sQ0FBQ3hHLE9BQU8sR0FDeEN3SCxLQUFLLENBQUNoQixNQUFNLENBQUN4RyxPQUFPLENBQUUsNENBQTZDLENBQUMsR0FDcEUsSUFBSTtNQUNQLElBQUssQ0FBRWhFLElBQUksSUFBSUEsSUFBSSxDQUFDNkUsTUFBTSxFQUFHO1FBQzVCLE9BQU8sS0FBSztNQUNiO01BQ0E3RixXQUFXLEdBQUdpQixNQUFNLENBQUVELElBQUksQ0FBQ0UsWUFBWSxDQUFFLGdDQUFpQyxDQUFFLENBQUM7TUFDN0UvQixlQUFlLEdBQUdtRCxNQUFNLENBQUV0QixJQUFJLENBQUNFLFlBQVksQ0FBRSwwQ0FBMkMsQ0FBQyxJQUFJLEVBQUcsQ0FBQztNQUNqRyxJQUFLLENBQUVLLHdCQUF3QixDQUFFdkIsV0FBVyxFQUFFYixlQUFnQixDQUFDLEVBQUc7UUFDakUsT0FBTyxLQUFLO01BQ2I7TUFDQXVOLE9BQU8sR0FBR3ZMLDJCQUEyQixDQUFFbkIsV0FBVyxFQUFFYixlQUFnQixDQUFDO01BQ3JFLElBQUtxTixLQUFLLENBQUN1QixjQUFjLEVBQUc7UUFDM0J2QixLQUFLLENBQUN1QixjQUFjLENBQUMsQ0FBQztNQUN2QjtNQUNBLElBQUt2QixLQUFLLENBQUMwQixlQUFlLEVBQUc7UUFDNUIxQixLQUFLLENBQUMwQixlQUFlLENBQUMsQ0FBQztNQUN4QjtNQUVBLE9BQU9qQix5QkFBeUIsQ0FBRWpOLFdBQVcsRUFBRWIsZUFBZSxFQUFFLEtBQUssRUFBRXVOLE9BQU8sRUFBRSxJQUFLLENBQUM7SUFDdkY7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVN5QixzQkFBc0JBLENBQUU1SixTQUFTLEVBQUV5QixXQUFXLEVBQUUwRyxPQUFPLEVBQUc7TUFDbEUsSUFBSTBCLFVBQVUsR0FBR2pSLEtBQUssR0FBR0EsS0FBSyxDQUFDMEQsZ0JBQWdCLENBQUUsaUNBQWlDLEdBQUdJLE1BQU0sQ0FBRXNELFNBQVUsQ0FBQyxHQUFHLElBQUssQ0FBQyxHQUFHLEVBQUU7TUFDdEgsSUFBSWYsSUFBSSxHQUFHa0osT0FBTyxHQUFHQSxPQUFPLENBQUNoSixhQUFhLENBQUUscUNBQXNDLENBQUMsR0FBRyxJQUFJO01BQzFGLElBQUkySyxpQkFBaUIsR0FBRyxDQUFDLENBQUM7TUFFMUJ0UCxLQUFLLENBQUMrQixTQUFTLENBQUNpQixPQUFPLENBQUNoQixJQUFJLENBQUVxTixVQUFVLEVBQUUsVUFBV0UsU0FBUyxFQUFHO1FBQ2hFLElBQUk1RSxPQUFPO1FBRVgsSUFBSyxDQUFDLEtBQUt6SSxNQUFNLENBQUVxTixTQUFTLENBQUNwTixZQUFZLENBQUUsOEJBQStCLENBQUUsQ0FBQyxFQUFHO1VBQy9FO1FBQ0Q7UUFDQW9OLFNBQVMsQ0FBQ3pJLE1BQU0sR0FBRyxDQUFFRyxXQUFXO1FBQ2hDMEQsT0FBTyxHQUFHNEUsU0FBUyxDQUFDcE4sWUFBWSxDQUFFLDRCQUE2QixDQUFDO1FBQ2hFLElBQUt3SSxPQUFPLEVBQUc7VUFDZDJFLGlCQUFpQixDQUFFM0UsT0FBTyxDQUFFLEdBQUcsSUFBSTtRQUNwQztNQUNELENBQUUsQ0FBQztNQUVILElBQUtnRCxPQUFPLEVBQUc7UUFDZEEsT0FBTyxDQUFDakosWUFBWSxDQUFFLGVBQWUsRUFBRXVDLFdBQVcsR0FBRyxNQUFNLEdBQUcsT0FBUSxDQUFDO1FBQ3ZFMEcsT0FBTyxDQUFDakosWUFBWSxDQUNuQixZQUFZLEVBQ1p1QyxXQUFXLEdBQUc1SSxRQUFRLENBQUNnRyxJQUFJLENBQUNtTCxpQkFBaUIsR0FBR25SLFFBQVEsQ0FBQ2dHLElBQUksQ0FBQ29MLGVBQy9ELENBQUM7TUFDRjtNQUNBLElBQUtoTCxJQUFJLEVBQUc7UUFDWEEsSUFBSSxDQUFDRyxTQUFTLENBQUN0QyxNQUFNLENBQUUsNEJBQTRCLEVBQUUyRSxXQUFZLENBQUM7UUFDbEV4QyxJQUFJLENBQUNHLFNBQVMsQ0FBQ3RDLE1BQU0sQ0FBRSw0QkFBNEIsRUFBRSxDQUFFMkUsV0FBWSxDQUFDO01BQ3JFO01BQ0FGLHNCQUFzQixDQUFFLHFCQUFxQixFQUFFdkIsU0FBUyxFQUFFeUIsV0FBWSxDQUFDO01BQ3ZFUCwyQkFBMkIsQ0FBQyxDQUFDO01BQzdCLElBQUtwRixNQUFNLENBQUMrQixJQUFJLENBQUVpTSxpQkFBa0IsQ0FBQyxDQUFDek0sTUFBTSxFQUFHO1FBQzlDeUgsNEJBQTRCLENBQUVoSixNQUFNLENBQUMrQixJQUFJLENBQUVpTSxpQkFBa0IsQ0FBRSxDQUFDO01BQ2pFO0lBQ0Q7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNJLFVBQVVBLENBQUEsRUFBRztNQUNyQixJQUFJQyxzQkFBc0I7TUFFMUIsSUFBSyxDQUFFdlIsS0FBSyxJQUFJVSwrQkFBK0IsRUFBRztRQUNqRDtNQUNEO01BQ0FRLG9CQUFvQixJQUFJLENBQUM7TUFDekIsSUFBSyxVQUFVLEtBQUssT0FBT3ZCLE1BQU0sQ0FBQzZSLGNBQWMsRUFBRztRQUNsRGhSLFlBQVksR0FBRyxJQUFJYixNQUFNLENBQUM2UixjQUFjLENBQUV2RCxpQkFBa0IsQ0FBQztNQUM5RDtNQUNBLElBQUssVUFBVSxLQUFLLE9BQU90TyxNQUFNLENBQUM4UixnQkFBZ0IsRUFBRztRQUNwRGhSLGlCQUFpQixHQUFHLElBQUlkLE1BQU0sQ0FBQzhSLGdCQUFnQixDQUFFMUMsb0JBQXFCLENBQUM7UUFDdkV0TyxpQkFBaUIsQ0FBQ3FPLE9BQU8sQ0FBRTlPLEtBQUssRUFBRTtVQUFFMFIsU0FBUyxFQUFFLElBQUk7VUFBRUMsT0FBTyxFQUFFO1FBQUssQ0FBRSxDQUFDO01BQ3ZFO01BQ0EsSUFBSyxDQUFFblIsWUFBWSxFQUFHO1FBQ3JCYixNQUFNLENBQUNpUyxnQkFBZ0IsQ0FBRSxRQUFRLEVBQUUxRiw0QkFBNkIsQ0FBQztNQUNsRTtNQUNBeEwsK0JBQStCLEdBQUcsSUFBSTtNQUN0Q1YsS0FBSyxDQUFDNFIsZ0JBQWdCLENBQUUsTUFBTSxFQUFFMUMsdUJBQXVCLEVBQUUsSUFBSyxDQUFDO01BQy9EbFAsS0FBSyxDQUFDNFIsZ0JBQWdCLENBQUUsU0FBUyxFQUFFZiwrQkFBZ0MsQ0FBQztNQUNwRTdRLEtBQUssQ0FBQzRSLGdCQUFnQixDQUFFLHlDQUF5QyxFQUFFeEMsZ0NBQWlDLENBQUM7TUFDckcsSUFBS3hQLFFBQVEsQ0FBQ2lTLEtBQUssSUFBSWpTLFFBQVEsQ0FBQ2lTLEtBQUssQ0FBQ0MsS0FBSyxJQUFJLFVBQVUsS0FBSyxPQUFPbFMsUUFBUSxDQUFDaVMsS0FBSyxDQUFDQyxLQUFLLENBQUNDLElBQUksRUFBRztRQUNoR1Isc0JBQXNCLEdBQUdyUSxvQkFBb0I7UUFDN0N0QixRQUFRLENBQUNpUyxLQUFLLENBQUNDLEtBQUssQ0FBQ0MsSUFBSSxDQUFFLFlBQVk7VUFDdEMsSUFBSyxDQUFFclIsK0JBQStCLElBQUksQ0FBRUgsY0FBYyxDQUFDLENBQUMsSUFBSWdSLHNCQUFzQixLQUFLclEsb0JBQW9CLEVBQUc7WUFDakg7VUFDRDtVQUNBZ0wsNEJBQTRCLENBQUMsQ0FBQztRQUMvQixDQUFFLENBQUM7TUFDSjtNQUNBeUMsWUFBWSxDQUFDLENBQUM7SUFDZjs7SUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU3FELE9BQU9BLENBQUEsRUFBRztNQUNsQixJQUFLLENBQUV0UiwrQkFBK0IsRUFBRztRQUN4QztNQUNEO01BQ0FRLG9CQUFvQixJQUFJLENBQUM7TUFDekJSLCtCQUErQixHQUFHLEtBQUs7TUFDdkMsSUFBS08scUJBQXFCLEVBQUc7UUFDNUJ0QixNQUFNLENBQUNzUyxvQkFBb0IsQ0FBRWhSLHFCQUFzQixDQUFDO01BQ3JEO01BQ0FBLHFCQUFxQixHQUFHLENBQUM7TUFDekJGLGdCQUFnQixHQUFHLENBQUMsQ0FBQztNQUNyQkMsb0JBQW9CLEdBQUcsS0FBSztNQUM1QixJQUFLUixZQUFZLEVBQUc7UUFDbkJBLFlBQVksQ0FBQ2dKLFVBQVUsQ0FBQyxDQUFDO01BQzFCLENBQUMsTUFBTTtRQUNON0osTUFBTSxDQUFDdVMsbUJBQW1CLENBQUUsUUFBUSxFQUFFaEcsNEJBQTZCLENBQUM7TUFDckU7TUFDQSxJQUFLekwsaUJBQWlCLEVBQUc7UUFDeEJBLGlCQUFpQixDQUFDK0ksVUFBVSxDQUFDLENBQUM7TUFDL0I7TUFDQSxJQUFLeEosS0FBSyxFQUFHO1FBQ1pBLEtBQUssQ0FBQ2tTLG1CQUFtQixDQUFFLE1BQU0sRUFBRWhELHVCQUF1QixFQUFFLElBQUssQ0FBQztRQUNsRWxQLEtBQUssQ0FBQ2tTLG1CQUFtQixDQUFFLFNBQVMsRUFBRXJCLCtCQUFnQyxDQUFDO1FBQ3ZFN1EsS0FBSyxDQUFDa1MsbUJBQW1CLENBQUUseUNBQXlDLEVBQUU5QyxnQ0FBaUMsQ0FBQztNQUN6RztNQUNBNU8sWUFBWSxHQUFHLElBQUk7TUFDbkJDLGlCQUFpQixHQUFHLElBQUk7TUFDeEJFLHFCQUFxQixHQUFHLElBQUloQixNQUFNLENBQUNpQixPQUFPLENBQUMsQ0FBQztNQUM1Q0Msb0JBQW9CLEdBQUcsSUFBSWxCLE1BQU0sQ0FBQ21CLE9BQU8sQ0FBQyxDQUFDO01BQzNDSyxvQ0FBb0MsR0FBRyxDQUFDLENBQUM7TUFDekNDLGdDQUFnQyxHQUFHLEVBQUU7TUFDckNDLDhCQUE4QixHQUFHLENBQUMsQ0FBQztNQUNuQ0MsMkJBQTJCLEdBQUcsQ0FBQyxDQUFDO01BQ2hDQyxxQkFBcUIsR0FBRyxDQUFDLENBQUM7SUFDM0I7SUFFQSxPQUFPO01BQ04rUCxVQUFVLEVBQUVBLFVBQVU7TUFDdEJVLE9BQU8sRUFBRUEsT0FBTztNQUNoQnZJLFdBQVcsRUFBRUEsV0FBVztNQUN4QmtGLFlBQVksRUFBRUEsWUFBWTtNQUMxQlcsZ0JBQWdCLEVBQUVBLGdCQUFnQjtNQUNsQzBCLHNCQUFzQixFQUFFQSxzQkFBc0I7TUFDOUNMLDZCQUE2QixFQUFFQSw2QkFBNkI7TUFDNURFLCtCQUErQixFQUFFQSwrQkFBK0I7TUFDaEVmLHlCQUF5QixFQUFFQSx5QkFBeUI7TUFDcERNLCtCQUErQixFQUFFQSwrQkFBK0I7TUFDaEVFLDhCQUE4QixFQUFFQSw4QkFBOEI7TUFDOURFLDJCQUEyQixFQUFFQSwyQkFBMkI7TUFDeERwTSx3QkFBd0IsRUFBRUE7SUFDM0IsQ0FBQztFQUNGO0VBRUEsSUFDQ3pFLE1BQU0sQ0FBQ3dTLHFCQUFxQixJQUN6QixVQUFVLEtBQUssT0FBT3hTLE1BQU0sQ0FBQ3dTLHFCQUFxQixDQUFDQyxnQkFBZ0IsRUFDckU7SUFDRHpTLE1BQU0sQ0FBQ3dTLHFCQUFxQixDQUFDQyxnQkFBZ0IsQ0FBRXZTLFNBQVMsRUFBRUMsMkJBQTRCLENBQUM7RUFDeEY7QUFDRCxDQUFDLEVBQUVILE1BQU0sRUFBRUMsUUFBUyxDQUFDIiwiaWdub3JlTGlzdCI6W119
