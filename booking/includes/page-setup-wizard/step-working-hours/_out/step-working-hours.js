"use strict";

/**
 * Provide the reusable weekly schedule editor used by Setup Wizard Step 7.
 *
 * The module edits a bounded proposal DTO. It supports multiple disjoint
 * intervals per day and a general source-to-target schedule copy workflow.
 * Canonical persistence remains server-owned at the explicit save boundary.
 *
 * @package Booking Calendar
 */
(function (window, document) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_working_hours || {
    i18n: {}
  };

  /**
   * Create one isolated Working Hours editor adapter.
   *
   * @param {Object} config Module translations and presentation settings.
   * @return {Object} Step adapter accepted by the shared wizard shell.
   */
  function create_working_hours_adapter(config) {
    var shell_api = null;
    var root = null;
    var editor = null;

    /**
     * Return one translated string with a safe fallback.
     *
     * @param {string} key      Translation key.
     * @param {string} fallback Fallback copy.
     * @return {string} Translation or fallback.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? config.i18n[key] : fallback;
    }

    /**
     * Clone one weekday interval list without sharing object references.
     *
     * @param {Object[]} intervals Source intervals.
     * @return {Object[]} Cloned intervals.
     */
    function clone_intervals(intervals) {
      return intervals.map(function (interval) {
        return {
          start_second: interval.start_second,
          end_second: interval.end_second
        };
      });
    }

    /**
     * Write the in-memory weekly schedule to the allow-listed draft field.
     *
     * @return {void}
     */
    function sync_working_hours_draft() {
      if (!editor) {
        return;
      }
      editor.transport.value = JSON.stringify({
        enabled: editor.enabled ? 'On' : 'Off',
        weekdays: editor.weekdays
      });
    }

    /**
     * Find a non-overlapping one-hour proposal for a new interval.
     *
     * @param {Object[]} intervals Existing intervals for one weekday.
     * @return {Object|null} Proposed interval, or null when no gap exists.
     */
    function find_interval_proposal(intervals) {
      var sorted_intervals = intervals.slice().sort(function (first_interval, second_interval) {
        return first_interval.start_second - second_interval.start_second;
      });
      var preferred_start = sorted_intervals.length ? sorted_intervals[sorted_intervals.length - 1].end_second : 9 * 3600;
      var candidates = [];
      var candidate_start;
      for (candidate_start = 0; candidate_start <= 23 * 3600; candidate_start += 1800) {
        if (candidate_start >= preferred_start) {
          candidates.push(candidate_start);
        }
      }
      for (candidate_start = 0; candidate_start < preferred_start && candidate_start <= 23 * 3600; candidate_start += 1800) {
        candidates.push(candidate_start);
      }
      candidate_start = null;
      candidates.some(function (proposed_start) {
        var proposed_end = proposed_start + 3600;
        var overlaps = sorted_intervals.some(function (interval) {
          return proposed_start < interval.end_second && proposed_end > interval.start_second;
        });
        if (proposed_end <= 86400 && !overlaps) {
          candidate_start = proposed_start;
          return true;
        }
        return false;
      });
      return null === candidate_start ? null : {
        start_second: candidate_start,
        end_second: candidate_start + 3600
      };
    }

    /**
     * Render all weekday rows from the data-only Working Hours draft.
     *
     * @return {void}
     */
    function render_working_hours_editor() {
      if (!editor || !editor.template) {
        return;
      }
      editor.node.classList.toggle('is-disabled', !editor.enabled);
      if (editor.enabled_toggle) {
        editor.enabled_toggle.checked = editor.enabled;
      }
      if (editor.schedule_controls) {
        editor.schedule_controls.disabled = !editor.enabled;
      }
      editor.node.querySelectorAll('[data-wpbc-working-day]').forEach(function (day_node) {
        var day_number = parseInt(day_node.dataset.wpbcWorkingDay, 10);
        var day_label = day_node.dataset.dayLabel || '';
        var intervals = editor.weekdays[day_number] || [];
        var is_enabled = 0 < intervals.length;
        var toggle = day_node.querySelector('[data-wpbc-working-day-toggle]');
        var interval_container = day_node.querySelector('[data-wpbc-working-intervals]');
        var unavailable = day_node.querySelector('[data-wpbc-working-unavailable]');
        var add_button = day_node.querySelector('[data-wpbc-add-working-interval]');
        day_node.classList.toggle('is-enabled', is_enabled);
        if (toggle) {
          toggle.checked = is_enabled;
        }
        if (interval_container) {
          interval_container.hidden = !is_enabled;
          interval_container.textContent = '';
          intervals.forEach(function (interval, interval_index) {
            var interval_node = editor.template.content.firstElementChild.cloneNode(true);
            var start_select = interval_node.querySelector('[data-wpbc-working-start]');
            var end_select = interval_node.querySelector('[data-wpbc-working-end]');
            var start_label = interval_node.querySelector('[data-wpbc-working-start-label]');
            var end_label = interval_node.querySelector('[data-wpbc-working-end-label]');
            var remove_button = interval_node.querySelector('[data-wpbc-remove-working-interval]');
            var start_id = 'wpbc-working-' + day_number + '-' + interval_index + '-start';
            var end_id = 'wpbc-working-' + day_number + '-' + interval_index + '-end';
            interval_node.dataset.intervalIndex = String(interval_index);
            start_select.id = start_id;
            start_select.value = String(interval.start_second);
            end_select.id = end_id;
            end_select.value = String(interval.end_second);
            start_label.htmlFor = start_id;
            end_label.htmlFor = end_id;
            remove_button.setAttribute('aria-label', get_message('remove_working_interval', 'Remove %s working interval').replace('%s', day_label));
            interval_container.appendChild(interval_node);
          });
        }
        if (unavailable) {
          unavailable.hidden = is_enabled;
        }
        if (add_button) {
          add_button.hidden = !is_enabled;
          add_button.disabled = intervals.length >= editor.max_intervals;
        }
      });
      sync_working_hours_draft();
    }

    /**
     * Restore focus after an interval render replaces its controls.
     *
     * @param {number} day_number     Weekday number using the canonical 0-6 shape.
     * @param {number} interval_index Preferred interval index after render.
     * @return {void}
     */
    function focus_working_hours_control(day_number, interval_index) {
      var day_node;
      var interval_node;
      var focus_target;
      if (!editor) {
        return;
      }
      day_node = editor.node.querySelector('[data-wpbc-working-day="' + day_number + '"]');
      if (!day_node) {
        return;
      }
      interval_node = day_node.querySelector('[data-interval-index="' + interval_index + '"]');
      focus_target = interval_node ? interval_node.querySelector('[data-wpbc-working-start]') : day_node.querySelector('[data-wpbc-working-day-toggle]');
      if (focus_target) {
        focus_target.focus();
      }
    }

    /**
     * Keep copy targets valid when the source day changes.
     *
     * @return {void}
     */
    function refresh_copy_targets() {
      var source_day;
      if (!editor || !editor.copy_source) {
        return;
      }
      source_day = editor.copy_source.value;
      editor.node.querySelectorAll('[data-wpbc-copy-target]').forEach(function (target) {
        var is_source = target.value === source_day;
        target.disabled = is_source;
        if (is_source) {
          target.checked = false;
        }
      });
    }

    /**
     * Open the accessible schedule-copy controls.
     *
     * @return {void}
     */
    function open_copy_panel() {
      if (!editor || !editor.copy_panel || !editor.copy_toggle) {
        return;
      }
      editor.copy_panel.hidden = false;
      editor.copy_toggle.setAttribute('aria-expanded', 'true');
      refresh_copy_targets();
      editor.copy_source.focus();
    }

    /**
     * Close schedule-copy controls and optionally restore trigger focus.
     *
     * @param {boolean} restore_focus Whether trigger focus should be restored.
     * @return {void}
     */
    function close_copy_panel(restore_focus) {
      if (!editor || !editor.copy_panel || !editor.copy_toggle) {
        return;
      }
      editor.copy_panel.hidden = true;
      editor.copy_toggle.setAttribute('aria-expanded', 'false');
      if (restore_focus) {
        editor.copy_toggle.focus();
      }
    }

    /**
     * Copy one source schedule to all selected target weekdays.
     *
     * Empty source schedules are valid and make the selected targets
     * unavailable, matching the visible source state.
     *
     * @return {void}
     */
    function apply_schedule_copy() {
      var source_day = parseInt(editor.copy_source.value, 10);
      var targets = Array.prototype.slice.call(editor.node.querySelectorAll('[data-wpbc-copy-target]:checked:not(:disabled)'));
      var source_intervals = editor.weekdays[source_day] || [];
      var first_available_target;
      if (!targets.length) {
        shell_api.set_status(get_message('copy_target_required', 'Select at least one target day.'));
        first_available_target = editor.node.querySelector('[data-wpbc-copy-target]:not(:disabled)');
        if (first_available_target) {
          first_available_target.focus();
        }
        return;
      }
      targets.forEach(function (target) {
        editor.weekdays[parseInt(target.value, 10)] = clone_intervals(source_intervals);
      });
      render_working_hours_editor();
      shell_api.clear_field_error('working_hours');
      shell_api.set_status(get_message('schedule_copied', 'The working-hours schedule was copied to the selected days.'));
      close_copy_panel(true);
    }

    /**
     * Handle Working Hours button actions.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {void}
     */
    function handle_click(event) {
      var add_button = event.target.closest('[data-wpbc-add-working-interval]');
      var remove_button = event.target.closest('[data-wpbc-remove-working-interval]');
      if (event.target.closest('[data-wpbc-copy-schedule-toggle]')) {
        event.preventDefault();
        if (editor.copy_panel.hidden) {
          open_copy_panel();
        } else {
          close_copy_panel(true);
        }
        return;
      }
      if (event.target.closest('[data-wpbc-copy-schedule-cancel]')) {
        event.preventDefault();
        close_copy_panel(true);
        return;
      }
      if (event.target.closest('[data-wpbc-copy-schedule-apply]')) {
        event.preventDefault();
        apply_schedule_copy();
        return;
      }
      if (add_button) {
        var add_day_node = add_button.closest('[data-wpbc-working-day]');
        var add_day_number = parseInt(add_day_node.dataset.wpbcWorkingDay, 10);
        var proposal = find_interval_proposal(editor.weekdays[add_day_number] || []);
        event.preventDefault();
        if (!proposal || editor.weekdays[add_day_number].length >= editor.max_intervals) {
          shell_api.set_status(get_message('working_hours_limit', 'No additional one-hour interval is available for this day.'));
          return;
        }
        editor.weekdays[add_day_number].push(proposal);
        render_working_hours_editor();
        focus_working_hours_control(add_day_number, editor.weekdays[add_day_number].length - 1);
        shell_api.clear_field_error('working_hours');
        return;
      }
      if (remove_button) {
        var remove_day_node = remove_button.closest('[data-wpbc-working-day]');
        var remove_interval_node = remove_button.closest('[data-interval-index]');
        var remove_day_number = parseInt(remove_day_node.dataset.wpbcWorkingDay, 10);
        var remove_interval_index = parseInt(remove_interval_node.dataset.intervalIndex, 10);
        event.preventDefault();
        editor.weekdays[remove_day_number].splice(remove_interval_index, 1);
        render_working_hours_editor();
        focus_working_hours_control(remove_day_number, Math.min(remove_interval_index, editor.weekdays[remove_day_number].length - 1));
        shell_api.clear_field_error('working_hours');
      }
    }

    /**
     * Handle weekday, interval, and copy-source changes.
     *
     * @param {Event} event Delegated change event.
     * @return {void}
     */
    function handle_change(event) {
      if (event.target.matches('[data-wpbc-working-hours-enabled]')) {
        editor.enabled = event.target.checked;
        if (!editor.enabled) {
          close_copy_panel(false);
        }
        render_working_hours_editor();
        shell_api.clear_field_error('working_hours');
        return;
      }
      if (event.target.matches('[data-wpbc-copy-source]')) {
        refresh_copy_targets();
        return;
      }
      if (event.target.matches('[data-wpbc-working-day-toggle]')) {
        var toggle_day_node = event.target.closest('[data-wpbc-working-day]');
        var toggle_day_number = parseInt(toggle_day_node.dataset.wpbcWorkingDay, 10);
        editor.weekdays[toggle_day_number] = event.target.checked ? [find_interval_proposal([])] : [];
        render_working_hours_editor();
        shell_api.clear_field_error('working_hours');
        return;
      }
      if (event.target.matches('[data-wpbc-working-start], [data-wpbc-working-end]')) {
        var changed_day_node = event.target.closest('[data-wpbc-working-day]');
        var changed_interval_node = event.target.closest('[data-interval-index]');
        var changed_day_number = parseInt(changed_day_node.dataset.wpbcWorkingDay, 10);
        var changed_interval_index = parseInt(changed_interval_node.dataset.intervalIndex, 10);
        var changed_interval = editor.weekdays[changed_day_number][changed_interval_index];
        if (event.target.matches('[data-wpbc-working-start]')) {
          changed_interval.start_second = parseInt(event.target.value, 10);
        } else {
          changed_interval.end_second = parseInt(event.target.value, 10);
        }
        sync_working_hours_draft();
        shell_api.clear_field_error('working_hours');
      }
    }

    /**
     * Close the schedule-copy panel with Escape while focus is inside it.
     *
     * @param {KeyboardEvent} event Keydown event.
     * @return {void}
     */
    function handle_keydown(event) {
      if ('Escape' === event.key && editor.copy_panel && !editor.copy_panel.hidden && editor.copy_panel.contains(event.target)) {
        event.preventDefault();
        close_copy_panel(true);
      }
    }

    /**
     * Initialize this module against shell-provided services.
     *
     * @param {Object} registered_shell_api Shared wizard adapter services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var parsed_working_hours;
      var weekdays = {};
      var editor_node;
      var transport;
      shell_api = registered_shell_api;
      root = shell_api.root;
      editor_node = root.querySelector('[data-wpbc-working-hours-editor]');
      transport = root.querySelector('[data-wpbc-working-hours-draft]');
      if (!editor_node || !transport) {
        return;
      }
      try {
        parsed_working_hours = JSON.parse(transport.value || '{}');
      } catch (parse_error) {
        parsed_working_hours = {};
      }
      [0, 1, 2, 3, 4, 5, 6].forEach(function (day_number) {
        var raw_intervals = parsed_working_hours.weekdays && Array.isArray(parsed_working_hours.weekdays[day_number]) ? parsed_working_hours.weekdays[day_number] : [];
        weekdays[day_number] = raw_intervals.map(function (interval) {
          return {
            start_second: parseInt(interval.start_second, 10),
            end_second: parseInt(interval.end_second, 10)
          };
        }).filter(function (interval) {
          return isFinite(interval.start_second) && Math.floor(interval.start_second) === interval.start_second && isFinite(interval.end_second) && Math.floor(interval.end_second) === interval.end_second;
        });
      });
      editor = {
        node: editor_node,
        transport: transport,
        template: root.querySelector('[data-wpbc-working-interval-template]'),
        enabled: 'Off' !== parsed_working_hours.enabled,
        enabled_toggle: editor_node.querySelector('[data-wpbc-working-hours-enabled]'),
        schedule_controls: editor_node.querySelector('[data-wpbc-working-hours-controls]'),
        weekdays: weekdays,
        max_intervals: parseInt(transport.dataset.maxIntervals || '8', 10),
        copy_toggle: editor_node.querySelector('[data-wpbc-copy-schedule-toggle]'),
        copy_panel: editor_node.querySelector('[data-wpbc-copy-schedule-panel]'),
        copy_source: editor_node.querySelector('[data-wpbc-copy-source]')
      };
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      editor.node.addEventListener('keydown', handle_keydown);
      refresh_copy_targets();
      render_working_hours_editor();
    }

    /**
     * Validate interval order and overlap before forward navigation.
     *
     * @return {HTMLElement|null} First invalid control, or null.
     */
    function validate() {
      var first_invalid = null;
      var enabled_interval_count = 0;
      if (!editor) {
        return null;
      }
      if (!editor.enabled) {
        shell_api.clear_field_error('working_hours');
        sync_working_hours_draft();
        return null;
      }
      editor.node.querySelectorAll('[data-wpbc-working-start], [data-wpbc-working-end]').forEach(function (control) {
        control.removeAttribute('aria-invalid');
      });
      [0, 1, 2, 3, 4, 5, 6].some(function (day_number) {
        var intervals = editor.weekdays[day_number] || [];
        var sorted_intervals = intervals.slice().sort(function (first_interval, second_interval) {
          return first_interval.start_second - second_interval.start_second;
        });
        var previous_end = -1;
        var day_node = editor.node.querySelector('[data-wpbc-working-day="' + day_number + '"]');
        enabled_interval_count += intervals.length;
        return sorted_intervals.some(function (interval) {
          var interval_index = intervals.indexOf(interval);
          var interval_node = day_node && day_node.querySelector('[data-interval-index="' + interval_index + '"]');
          var invalid_range = !isFinite(interval.start_second) || Math.floor(interval.start_second) !== interval.start_second || !isFinite(interval.end_second) || Math.floor(interval.end_second) !== interval.end_second || interval.start_second < 0 || interval.end_second > 86400 || interval.start_second >= interval.end_second;
          var overlaps = interval.start_second < previous_end;
          previous_end = Math.max(previous_end, interval.end_second);
          if (invalid_range || overlaps) {
            first_invalid = interval_node ? interval_node.querySelector(invalid_range ? '[data-wpbc-working-end]' : '[data-wpbc-working-start]') : day_node.querySelector('[data-wpbc-working-day-toggle]');
            if (first_invalid) {
              first_invalid.setAttribute('aria-invalid', 'true');
            }
            shell_api.set_field_error('working_hours', invalid_range ? get_message('working_hours_invalid', 'Every working interval must end after it starts.') : get_message('working_hours_overlap', 'Working intervals on the same day cannot overlap or repeat.'));
            return true;
          }
          return false;
        });
      });
      if (!first_invalid && 0 === enabled_interval_count) {
        first_invalid = shell_api.set_field_error('working_hours', get_message('working_hours_required', 'Enable at least one weekday and add its working hours.'));
      }
      sync_working_hours_draft();
      return first_invalid;
    }
    return {
      initialize: initialize,
      sync: sync_working_hours_draft,
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules.working_hours = {
    create: create_working_hours_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_working_hours_adapter(module_config));
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC13b3JraW5nLWhvdXJzL19vdXQvc3RlcC13b3JraW5nLWhvdXJzLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCJtb2R1bGVfY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfd29ya2luZ19ob3VycyIsImkxOG4iLCJjcmVhdGVfd29ya2luZ19ob3Vyc19hZGFwdGVyIiwiY29uZmlnIiwic2hlbGxfYXBpIiwicm9vdCIsImVkaXRvciIsImdldF9tZXNzYWdlIiwia2V5IiwiZmFsbGJhY2siLCJjbG9uZV9pbnRlcnZhbHMiLCJpbnRlcnZhbHMiLCJtYXAiLCJpbnRlcnZhbCIsInN0YXJ0X3NlY29uZCIsImVuZF9zZWNvbmQiLCJzeW5jX3dvcmtpbmdfaG91cnNfZHJhZnQiLCJ0cmFuc3BvcnQiLCJ2YWx1ZSIsIkpTT04iLCJzdHJpbmdpZnkiLCJlbmFibGVkIiwid2Vla2RheXMiLCJmaW5kX2ludGVydmFsX3Byb3Bvc2FsIiwic29ydGVkX2ludGVydmFscyIsInNsaWNlIiwic29ydCIsImZpcnN0X2ludGVydmFsIiwic2Vjb25kX2ludGVydmFsIiwicHJlZmVycmVkX3N0YXJ0IiwibGVuZ3RoIiwiY2FuZGlkYXRlcyIsImNhbmRpZGF0ZV9zdGFydCIsInB1c2giLCJzb21lIiwicHJvcG9zZWRfc3RhcnQiLCJwcm9wb3NlZF9lbmQiLCJvdmVybGFwcyIsInJlbmRlcl93b3JraW5nX2hvdXJzX2VkaXRvciIsInRlbXBsYXRlIiwibm9kZSIsImNsYXNzTGlzdCIsInRvZ2dsZSIsImVuYWJsZWRfdG9nZ2xlIiwiY2hlY2tlZCIsInNjaGVkdWxlX2NvbnRyb2xzIiwiZGlzYWJsZWQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsImRheV9ub2RlIiwiZGF5X251bWJlciIsInBhcnNlSW50IiwiZGF0YXNldCIsIndwYmNXb3JraW5nRGF5IiwiZGF5X2xhYmVsIiwiZGF5TGFiZWwiLCJpc19lbmFibGVkIiwicXVlcnlTZWxlY3RvciIsImludGVydmFsX2NvbnRhaW5lciIsInVuYXZhaWxhYmxlIiwiYWRkX2J1dHRvbiIsImhpZGRlbiIsInRleHRDb250ZW50IiwiaW50ZXJ2YWxfaW5kZXgiLCJpbnRlcnZhbF9ub2RlIiwiY29udGVudCIsImZpcnN0RWxlbWVudENoaWxkIiwiY2xvbmVOb2RlIiwic3RhcnRfc2VsZWN0IiwiZW5kX3NlbGVjdCIsInN0YXJ0X2xhYmVsIiwiZW5kX2xhYmVsIiwicmVtb3ZlX2J1dHRvbiIsInN0YXJ0X2lkIiwiZW5kX2lkIiwiaW50ZXJ2YWxJbmRleCIsIlN0cmluZyIsImlkIiwiaHRtbEZvciIsInNldEF0dHJpYnV0ZSIsInJlcGxhY2UiLCJhcHBlbmRDaGlsZCIsIm1heF9pbnRlcnZhbHMiLCJmb2N1c193b3JraW5nX2hvdXJzX2NvbnRyb2wiLCJmb2N1c190YXJnZXQiLCJmb2N1cyIsInJlZnJlc2hfY29weV90YXJnZXRzIiwic291cmNlX2RheSIsImNvcHlfc291cmNlIiwidGFyZ2V0IiwiaXNfc291cmNlIiwib3Blbl9jb3B5X3BhbmVsIiwiY29weV9wYW5lbCIsImNvcHlfdG9nZ2xlIiwiY2xvc2VfY29weV9wYW5lbCIsInJlc3RvcmVfZm9jdXMiLCJhcHBseV9zY2hlZHVsZV9jb3B5IiwidGFyZ2V0cyIsIkFycmF5IiwicHJvdG90eXBlIiwiY2FsbCIsInNvdXJjZV9pbnRlcnZhbHMiLCJmaXJzdF9hdmFpbGFibGVfdGFyZ2V0Iiwic2V0X3N0YXR1cyIsImNsZWFyX2ZpZWxkX2Vycm9yIiwiaGFuZGxlX2NsaWNrIiwiZXZlbnQiLCJjbG9zZXN0IiwicHJldmVudERlZmF1bHQiLCJhZGRfZGF5X25vZGUiLCJhZGRfZGF5X251bWJlciIsInByb3Bvc2FsIiwicmVtb3ZlX2RheV9ub2RlIiwicmVtb3ZlX2ludGVydmFsX25vZGUiLCJyZW1vdmVfZGF5X251bWJlciIsInJlbW92ZV9pbnRlcnZhbF9pbmRleCIsInNwbGljZSIsIk1hdGgiLCJtaW4iLCJoYW5kbGVfY2hhbmdlIiwibWF0Y2hlcyIsInRvZ2dsZV9kYXlfbm9kZSIsInRvZ2dsZV9kYXlfbnVtYmVyIiwiY2hhbmdlZF9kYXlfbm9kZSIsImNoYW5nZWRfaW50ZXJ2YWxfbm9kZSIsImNoYW5nZWRfZGF5X251bWJlciIsImNoYW5nZWRfaW50ZXJ2YWxfaW5kZXgiLCJjaGFuZ2VkX2ludGVydmFsIiwiaGFuZGxlX2tleWRvd24iLCJjb250YWlucyIsImluaXRpYWxpemUiLCJyZWdpc3RlcmVkX3NoZWxsX2FwaSIsInBhcnNlZF93b3JraW5nX2hvdXJzIiwiZWRpdG9yX25vZGUiLCJwYXJzZSIsInBhcnNlX2Vycm9yIiwicmF3X2ludGVydmFscyIsImlzQXJyYXkiLCJmaWx0ZXIiLCJpc0Zpbml0ZSIsImZsb29yIiwibWF4SW50ZXJ2YWxzIiwiYWRkRXZlbnRMaXN0ZW5lciIsInZhbGlkYXRlIiwiZmlyc3RfaW52YWxpZCIsImVuYWJsZWRfaW50ZXJ2YWxfY291bnQiLCJjb250cm9sIiwicmVtb3ZlQXR0cmlidXRlIiwicHJldmlvdXNfZW5kIiwiaW5kZXhPZiIsImludmFsaWRfcmFuZ2UiLCJtYXgiLCJzZXRfZmllbGRfZXJyb3IiLCJzeW5jIiwid3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyIsIndvcmtpbmdfaG91cnMiLCJjcmVhdGUiLCJ3cGJjX3NldHVwX3dpemFyZF9hcGkiLCJyZWdpc3Rlcl9zdGVwX2FkYXB0ZXIiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwLXdpemFyZC9zdGVwLXdvcmtpbmctaG91cnMvX3NyYy9zdGVwLXdvcmtpbmctaG91cnMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQcm92aWRlIHRoZSByZXVzYWJsZSB3ZWVrbHkgc2NoZWR1bGUgZWRpdG9yIHVzZWQgYnkgU2V0dXAgV2l6YXJkIFN0ZXAgNy5cbiAqXG4gKiBUaGUgbW9kdWxlIGVkaXRzIGEgYm91bmRlZCBwcm9wb3NhbCBEVE8uIEl0IHN1cHBvcnRzIG11bHRpcGxlIGRpc2pvaW50XG4gKiBpbnRlcnZhbHMgcGVyIGRheSBhbmQgYSBnZW5lcmFsIHNvdXJjZS10by10YXJnZXQgc2NoZWR1bGUgY29weSB3b3JrZmxvdy5cbiAqIENhbm9uaWNhbCBwZXJzaXN0ZW5jZSByZW1haW5zIHNlcnZlci1vd25lZCBhdCB0aGUgZXhwbGljaXQgc2F2ZSBib3VuZGFyeS5cbiAqXG4gKiBAcGFja2FnZSBCb29raW5nIENhbGVuZGFyXG4gKi9cbiggZnVuY3Rpb24gKCB3aW5kb3csIGRvY3VtZW50ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIG1vZHVsZV9jb25maWcgPSB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfd29ya2luZ19ob3VycyB8fCB7IGkxOG46IHt9IH07XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBvbmUgaXNvbGF0ZWQgV29ya2luZyBIb3VycyBlZGl0b3IgYWRhcHRlci5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBNb2R1bGUgdHJhbnNsYXRpb25zIGFuZCBwcmVzZW50YXRpb24gc2V0dGluZ3MuXG5cdCAqIEByZXR1cm4ge09iamVjdH0gU3RlcCBhZGFwdGVyIGFjY2VwdGVkIGJ5IHRoZSBzaGFyZWQgd2l6YXJkIHNoZWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gY3JlYXRlX3dvcmtpbmdfaG91cnNfYWRhcHRlciggY29uZmlnICkge1xuXHRcdHZhciBzaGVsbF9hcGkgPSBudWxsO1xuXHRcdHZhciByb290ID0gbnVsbDtcblx0XHR2YXIgZWRpdG9yID0gbnVsbDtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgdHJhbnNsYXRlZCBzdHJpbmcgd2l0aCBhIHNhZmUgZmFsbGJhY2suXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5ICAgICAgVHJhbnNsYXRpb24ga2V5LlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmYWxsYmFjayBGYWxsYmFjayBjb3B5LlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gVHJhbnNsYXRpb24gb3IgZmFsbGJhY2suXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X21lc3NhZ2UoIGtleSwgZmFsbGJhY2sgKSB7XG5cdFx0XHRyZXR1cm4gY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG5bIGtleSBdID8gY29uZmlnLmkxOG5bIGtleSBdIDogZmFsbGJhY2s7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xvbmUgb25lIHdlZWtkYXkgaW50ZXJ2YWwgbGlzdCB3aXRob3V0IHNoYXJpbmcgb2JqZWN0IHJlZmVyZW5jZXMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdFtdfSBpbnRlcnZhbHMgU291cmNlIGludGVydmFscy5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3RbXX0gQ2xvbmVkIGludGVydmFscy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBjbG9uZV9pbnRlcnZhbHMoIGludGVydmFscyApIHtcblx0XHRcdHJldHVybiBpbnRlcnZhbHMubWFwKCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN0YXJ0X3NlY29uZDogaW50ZXJ2YWwuc3RhcnRfc2Vjb25kLFxuXHRcdFx0XHRcdGVuZF9zZWNvbmQ6IGludGVydmFsLmVuZF9zZWNvbmRcblx0XHRcdFx0fTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBXcml0ZSB0aGUgaW4tbWVtb3J5IHdlZWtseSBzY2hlZHVsZSB0byB0aGUgYWxsb3ctbGlzdGVkIGRyYWZ0IGZpZWxkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX3dvcmtpbmdfaG91cnNfZHJhZnQoKSB7XG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci50cmFuc3BvcnQudmFsdWUgPSBKU09OLnN0cmluZ2lmeSgge1xuXHRcdFx0XHRlbmFibGVkOiBlZGl0b3IuZW5hYmxlZCA/ICdPbicgOiAnT2ZmJyxcblx0XHRcdFx0d2Vla2RheXM6IGVkaXRvci53ZWVrZGF5c1xuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZpbmQgYSBub24tb3ZlcmxhcHBpbmcgb25lLWhvdXIgcHJvcG9zYWwgZm9yIGEgbmV3IGludGVydmFsLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3RbXX0gaW50ZXJ2YWxzIEV4aXN0aW5nIGludGVydmFscyBmb3Igb25lIHdlZWtkYXkuXG5cdFx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9IFByb3Bvc2VkIGludGVydmFsLCBvciBudWxsIHdoZW4gbm8gZ2FwIGV4aXN0cy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5kX2ludGVydmFsX3Byb3Bvc2FsKCBpbnRlcnZhbHMgKSB7XG5cdFx0XHR2YXIgc29ydGVkX2ludGVydmFscyA9IGludGVydmFscy5zbGljZSgpLnNvcnQoIGZ1bmN0aW9uICggZmlyc3RfaW50ZXJ2YWwsIHNlY29uZF9pbnRlcnZhbCApIHtcblx0XHRcdFx0cmV0dXJuIGZpcnN0X2ludGVydmFsLnN0YXJ0X3NlY29uZCAtIHNlY29uZF9pbnRlcnZhbC5zdGFydF9zZWNvbmQ7XG5cdFx0XHR9ICk7XG5cdFx0XHR2YXIgcHJlZmVycmVkX3N0YXJ0ID0gc29ydGVkX2ludGVydmFscy5sZW5ndGggPyBzb3J0ZWRfaW50ZXJ2YWxzWyBzb3J0ZWRfaW50ZXJ2YWxzLmxlbmd0aCAtIDEgXS5lbmRfc2Vjb25kIDogOSAqIDM2MDA7XG5cdFx0XHR2YXIgY2FuZGlkYXRlcyA9IFtdO1xuXHRcdFx0dmFyIGNhbmRpZGF0ZV9zdGFydDtcblxuXHRcdFx0Zm9yICggY2FuZGlkYXRlX3N0YXJ0ID0gMDsgY2FuZGlkYXRlX3N0YXJ0IDw9IDIzICogMzYwMDsgY2FuZGlkYXRlX3N0YXJ0ICs9IDE4MDAgKSB7XG5cdFx0XHRcdGlmICggY2FuZGlkYXRlX3N0YXJ0ID49IHByZWZlcnJlZF9zdGFydCApIHtcblx0XHRcdFx0XHRjYW5kaWRhdGVzLnB1c2goIGNhbmRpZGF0ZV9zdGFydCApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKCBjYW5kaWRhdGVfc3RhcnQgPSAwOyBjYW5kaWRhdGVfc3RhcnQgPCBwcmVmZXJyZWRfc3RhcnQgJiYgY2FuZGlkYXRlX3N0YXJ0IDw9IDIzICogMzYwMDsgY2FuZGlkYXRlX3N0YXJ0ICs9IDE4MDAgKSB7XG5cdFx0XHRcdGNhbmRpZGF0ZXMucHVzaCggY2FuZGlkYXRlX3N0YXJ0ICk7XG5cdFx0XHR9XG5cblx0XHRcdGNhbmRpZGF0ZV9zdGFydCA9IG51bGw7XG5cdFx0XHRjYW5kaWRhdGVzLnNvbWUoIGZ1bmN0aW9uICggcHJvcG9zZWRfc3RhcnQgKSB7XG5cdFx0XHRcdHZhciBwcm9wb3NlZF9lbmQgPSBwcm9wb3NlZF9zdGFydCArIDM2MDA7XG5cdFx0XHRcdHZhciBvdmVybGFwcyA9IHNvcnRlZF9pbnRlcnZhbHMuc29tZSggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0XHRyZXR1cm4gcHJvcG9zZWRfc3RhcnQgPCBpbnRlcnZhbC5lbmRfc2Vjb25kICYmIHByb3Bvc2VkX2VuZCA+IGludGVydmFsLnN0YXJ0X3NlY29uZDtcblx0XHRcdFx0fSApO1xuXG5cdFx0XHRcdGlmICggcHJvcG9zZWRfZW5kIDw9IDg2NDAwICYmICEgb3ZlcmxhcHMgKSB7XG5cdFx0XHRcdFx0Y2FuZGlkYXRlX3N0YXJ0ID0gcHJvcG9zZWRfc3RhcnQ7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRyZXR1cm4gbnVsbCA9PT0gY2FuZGlkYXRlX3N0YXJ0ID8gbnVsbCA6IHtcblx0XHRcdFx0c3RhcnRfc2Vjb25kOiBjYW5kaWRhdGVfc3RhcnQsXG5cdFx0XHRcdGVuZF9zZWNvbmQ6IGNhbmRpZGF0ZV9zdGFydCArIDM2MDBcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGFsbCB3ZWVrZGF5IHJvd3MgZnJvbSB0aGUgZGF0YS1vbmx5IFdvcmtpbmcgSG91cnMgZHJhZnQuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJlbmRlcl93b3JraW5nX2hvdXJzX2VkaXRvcigpIHtcblx0XHRcdGlmICggISBlZGl0b3IgfHwgISBlZGl0b3IudGVtcGxhdGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLm5vZGUuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWRpc2FibGVkJywgISBlZGl0b3IuZW5hYmxlZCApO1xuXHRcdFx0aWYgKCBlZGl0b3IuZW5hYmxlZF90b2dnbGUgKSB7XG5cdFx0XHRcdGVkaXRvci5lbmFibGVkX3RvZ2dsZS5jaGVja2VkID0gZWRpdG9yLmVuYWJsZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGVkaXRvci5zY2hlZHVsZV9jb250cm9scyApIHtcblx0XHRcdFx0ZWRpdG9yLnNjaGVkdWxlX2NvbnRyb2xzLmRpc2FibGVkID0gISBlZGl0b3IuZW5hYmxlZDtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtd29ya2luZy1kYXldJyApLmZvckVhY2goIGZ1bmN0aW9uICggZGF5X25vZGUgKSB7XG5cdFx0XHRcdHZhciBkYXlfbnVtYmVyID0gcGFyc2VJbnQoIGRheV9ub2RlLmRhdGFzZXQud3BiY1dvcmtpbmdEYXksIDEwICk7XG5cdFx0XHRcdHZhciBkYXlfbGFiZWwgPSBkYXlfbm9kZS5kYXRhc2V0LmRheUxhYmVsIHx8ICcnO1xuXHRcdFx0XHR2YXIgaW50ZXJ2YWxzID0gZWRpdG9yLndlZWtkYXlzWyBkYXlfbnVtYmVyIF0gfHwgW107XG5cdFx0XHRcdHZhciBpc19lbmFibGVkID0gMCA8IGludGVydmFscy5sZW5ndGg7XG5cdFx0XHRcdHZhciB0b2dnbGUgPSBkYXlfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLWRheS10b2dnbGVdJyApO1xuXHRcdFx0XHR2YXIgaW50ZXJ2YWxfY29udGFpbmVyID0gZGF5X25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtd29ya2luZy1pbnRlcnZhbHNdJyApO1xuXHRcdFx0XHR2YXIgdW5hdmFpbGFibGUgPSBkYXlfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLXVuYXZhaWxhYmxlXScgKTtcblx0XHRcdFx0dmFyIGFkZF9idXR0b24gPSBkYXlfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1hZGQtd29ya2luZy1pbnRlcnZhbF0nICk7XG5cblx0XHRcdFx0ZGF5X25vZGUuY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWVuYWJsZWQnLCBpc19lbmFibGVkICk7XG5cdFx0XHRcdGlmICggdG9nZ2xlICkge1xuXHRcdFx0XHRcdHRvZ2dsZS5jaGVja2VkID0gaXNfZW5hYmxlZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIGludGVydmFsX2NvbnRhaW5lciApIHtcblx0XHRcdFx0XHRpbnRlcnZhbF9jb250YWluZXIuaGlkZGVuID0gISBpc19lbmFibGVkO1xuXHRcdFx0XHRcdGludGVydmFsX2NvbnRhaW5lci50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0XHRcdGludGVydmFscy5mb3JFYWNoKCBmdW5jdGlvbiAoIGludGVydmFsLCBpbnRlcnZhbF9pbmRleCApIHtcblx0XHRcdFx0XHRcdHZhciBpbnRlcnZhbF9ub2RlID0gZWRpdG9yLnRlbXBsYXRlLmNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQuY2xvbmVOb2RlKCB0cnVlICk7XG5cdFx0XHRcdFx0XHR2YXIgc3RhcnRfc2VsZWN0ID0gaW50ZXJ2YWxfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLXN0YXJ0XScgKTtcblx0XHRcdFx0XHRcdHZhciBlbmRfc2VsZWN0ID0gaW50ZXJ2YWxfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLWVuZF0nICk7XG5cdFx0XHRcdFx0XHR2YXIgc3RhcnRfbGFiZWwgPSBpbnRlcnZhbF9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXdvcmtpbmctc3RhcnQtbGFiZWxdJyApO1xuXHRcdFx0XHRcdFx0dmFyIGVuZF9sYWJlbCA9IGludGVydmFsX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtd29ya2luZy1lbmQtbGFiZWxdJyApO1xuXHRcdFx0XHRcdFx0dmFyIHJlbW92ZV9idXR0b24gPSBpbnRlcnZhbF9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXJlbW92ZS13b3JraW5nLWludGVydmFsXScgKTtcblx0XHRcdFx0XHRcdHZhciBzdGFydF9pZCA9ICd3cGJjLXdvcmtpbmctJyArIGRheV9udW1iZXIgKyAnLScgKyBpbnRlcnZhbF9pbmRleCArICctc3RhcnQnO1xuXHRcdFx0XHRcdFx0dmFyIGVuZF9pZCA9ICd3cGJjLXdvcmtpbmctJyArIGRheV9udW1iZXIgKyAnLScgKyBpbnRlcnZhbF9pbmRleCArICctZW5kJztcblxuXHRcdFx0XHRcdFx0aW50ZXJ2YWxfbm9kZS5kYXRhc2V0LmludGVydmFsSW5kZXggPSBTdHJpbmcoIGludGVydmFsX2luZGV4ICk7XG5cdFx0XHRcdFx0XHRzdGFydF9zZWxlY3QuaWQgPSBzdGFydF9pZDtcblx0XHRcdFx0XHRcdHN0YXJ0X3NlbGVjdC52YWx1ZSA9IFN0cmluZyggaW50ZXJ2YWwuc3RhcnRfc2Vjb25kICk7XG5cdFx0XHRcdFx0XHRlbmRfc2VsZWN0LmlkID0gZW5kX2lkO1xuXHRcdFx0XHRcdFx0ZW5kX3NlbGVjdC52YWx1ZSA9IFN0cmluZyggaW50ZXJ2YWwuZW5kX3NlY29uZCApO1xuXHRcdFx0XHRcdFx0c3RhcnRfbGFiZWwuaHRtbEZvciA9IHN0YXJ0X2lkO1xuXHRcdFx0XHRcdFx0ZW5kX2xhYmVsLmh0bWxGb3IgPSBlbmRfaWQ7XG5cdFx0XHRcdFx0XHRyZW1vdmVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBnZXRfbWVzc2FnZSggJ3JlbW92ZV93b3JraW5nX2ludGVydmFsJywgJ1JlbW92ZSAlcyB3b3JraW5nIGludGVydmFsJyApLnJlcGxhY2UoICclcycsIGRheV9sYWJlbCApICk7XG5cdFx0XHRcdFx0XHRpbnRlcnZhbF9jb250YWluZXIuYXBwZW5kQ2hpbGQoIGludGVydmFsX25vZGUgKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCB1bmF2YWlsYWJsZSApIHtcblx0XHRcdFx0XHR1bmF2YWlsYWJsZS5oaWRkZW4gPSBpc19lbmFibGVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggYWRkX2J1dHRvbiApIHtcblx0XHRcdFx0XHRhZGRfYnV0dG9uLmhpZGRlbiA9ICEgaXNfZW5hYmxlZDtcblx0XHRcdFx0XHRhZGRfYnV0dG9uLmRpc2FibGVkID0gaW50ZXJ2YWxzLmxlbmd0aCA+PSBlZGl0b3IubWF4X2ludGVydmFscztcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXG5cdFx0XHRzeW5jX3dvcmtpbmdfaG91cnNfZHJhZnQoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXN0b3JlIGZvY3VzIGFmdGVyIGFuIGludGVydmFsIHJlbmRlciByZXBsYWNlcyBpdHMgY29udHJvbHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge251bWJlcn0gZGF5X251bWJlciAgICAgV2Vla2RheSBudW1iZXIgdXNpbmcgdGhlIGNhbm9uaWNhbCAwLTYgc2hhcGUuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGludGVydmFsX2luZGV4IFByZWZlcnJlZCBpbnRlcnZhbCBpbmRleCBhZnRlciByZW5kZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb2N1c193b3JraW5nX2hvdXJzX2NvbnRyb2woIGRheV9udW1iZXIsIGludGVydmFsX2luZGV4ICkge1xuXHRcdFx0dmFyIGRheV9ub2RlO1xuXHRcdFx0dmFyIGludGVydmFsX25vZGU7XG5cdFx0XHR2YXIgZm9jdXNfdGFyZ2V0O1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGRheV9ub2RlID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtd29ya2luZy1kYXk9XCInICsgZGF5X251bWJlciArICdcIl0nICk7XG5cdFx0XHRpZiAoICEgZGF5X25vZGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aW50ZXJ2YWxfbm9kZSA9IGRheV9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1pbnRlcnZhbC1pbmRleD1cIicgKyBpbnRlcnZhbF9pbmRleCArICdcIl0nICk7XG5cdFx0XHRmb2N1c190YXJnZXQgPSBpbnRlcnZhbF9ub2RlXG5cdFx0XHRcdD8gaW50ZXJ2YWxfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLXN0YXJ0XScgKVxuXHRcdFx0XHQ6IGRheV9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXdvcmtpbmctZGF5LXRvZ2dsZV0nICk7XG5cdFx0XHRpZiAoIGZvY3VzX3RhcmdldCApIHtcblx0XHRcdFx0Zm9jdXNfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogS2VlcCBjb3B5IHRhcmdldHMgdmFsaWQgd2hlbiB0aGUgc291cmNlIGRheSBjaGFuZ2VzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZWZyZXNoX2NvcHlfdGFyZ2V0cygpIHtcblx0XHRcdHZhciBzb3VyY2VfZGF5O1xuXG5cdFx0XHRpZiAoICEgZWRpdG9yIHx8ICEgZWRpdG9yLmNvcHlfc291cmNlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNvdXJjZV9kYXkgPSBlZGl0b3IuY29weV9zb3VyY2UudmFsdWU7XG5cdFx0XHRlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1jb3B5LXRhcmdldF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCB0YXJnZXQgKSB7XG5cdFx0XHRcdHZhciBpc19zb3VyY2UgPSB0YXJnZXQudmFsdWUgPT09IHNvdXJjZV9kYXk7XG5cdFx0XHRcdHRhcmdldC5kaXNhYmxlZCA9IGlzX3NvdXJjZTtcblx0XHRcdFx0aWYgKCBpc19zb3VyY2UgKSB7XG5cdFx0XHRcdFx0dGFyZ2V0LmNoZWNrZWQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE9wZW4gdGhlIGFjY2Vzc2libGUgc2NoZWR1bGUtY29weSBjb250cm9scy5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gb3Blbl9jb3B5X3BhbmVsKCkge1xuXHRcdFx0aWYgKCAhIGVkaXRvciB8fCAhIGVkaXRvci5jb3B5X3BhbmVsIHx8ICEgZWRpdG9yLmNvcHlfdG9nZ2xlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5jb3B5X3BhbmVsLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0ZWRpdG9yLmNvcHlfdG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScgKTtcblx0XHRcdHJlZnJlc2hfY29weV90YXJnZXRzKCk7XG5cdFx0XHRlZGl0b3IuY29weV9zb3VyY2UuZm9jdXMoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBDbG9zZSBzY2hlZHVsZS1jb3B5IGNvbnRyb2xzIGFuZCBvcHRpb25hbGx5IHJlc3RvcmUgdHJpZ2dlciBmb2N1cy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7Ym9vbGVhbn0gcmVzdG9yZV9mb2N1cyBXaGV0aGVyIHRyaWdnZXIgZm9jdXMgc2hvdWxkIGJlIHJlc3RvcmVkLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xvc2VfY29weV9wYW5lbCggcmVzdG9yZV9mb2N1cyApIHtcblx0XHRcdGlmICggISBlZGl0b3IgfHwgISBlZGl0b3IuY29weV9wYW5lbCB8fCAhIGVkaXRvci5jb3B5X3RvZ2dsZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IuY29weV9wYW5lbC5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0ZWRpdG9yLmNvcHlfdG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnICk7XG5cdFx0XHRpZiAoIHJlc3RvcmVfZm9jdXMgKSB7XG5cdFx0XHRcdGVkaXRvci5jb3B5X3RvZ2dsZS5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvcHkgb25lIHNvdXJjZSBzY2hlZHVsZSB0byBhbGwgc2VsZWN0ZWQgdGFyZ2V0IHdlZWtkYXlzLlxuXHRcdCAqXG5cdFx0ICogRW1wdHkgc291cmNlIHNjaGVkdWxlcyBhcmUgdmFsaWQgYW5kIG1ha2UgdGhlIHNlbGVjdGVkIHRhcmdldHNcblx0XHQgKiB1bmF2YWlsYWJsZSwgbWF0Y2hpbmcgdGhlIHZpc2libGUgc291cmNlIHN0YXRlLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhcHBseV9zY2hlZHVsZV9jb3B5KCkge1xuXHRcdFx0dmFyIHNvdXJjZV9kYXkgPSBwYXJzZUludCggZWRpdG9yLmNvcHlfc291cmNlLnZhbHVlLCAxMCApO1xuXHRcdFx0dmFyIHRhcmdldHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtY29weS10YXJnZXRdOmNoZWNrZWQ6bm90KDpkaXNhYmxlZCknICkgKTtcblx0XHRcdHZhciBzb3VyY2VfaW50ZXJ2YWxzID0gZWRpdG9yLndlZWtkYXlzWyBzb3VyY2VfZGF5IF0gfHwgW107XG5cdFx0XHR2YXIgZmlyc3RfYXZhaWxhYmxlX3RhcmdldDtcblxuXHRcdFx0aWYgKCAhIHRhcmdldHMubGVuZ3RoICkge1xuXHRcdFx0XHRzaGVsbF9hcGkuc2V0X3N0YXR1cyggZ2V0X21lc3NhZ2UoICdjb3B5X3RhcmdldF9yZXF1aXJlZCcsICdTZWxlY3QgYXQgbGVhc3Qgb25lIHRhcmdldCBkYXkuJyApICk7XG5cdFx0XHRcdGZpcnN0X2F2YWlsYWJsZV90YXJnZXQgPSBlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jb3B5LXRhcmdldF06bm90KDpkaXNhYmxlZCknICk7XG5cdFx0XHRcdGlmICggZmlyc3RfYXZhaWxhYmxlX3RhcmdldCApIHtcblx0XHRcdFx0XHRmaXJzdF9hdmFpbGFibGVfdGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0YXJnZXRzLmZvckVhY2goIGZ1bmN0aW9uICggdGFyZ2V0ICkge1xuXHRcdFx0XHRlZGl0b3Iud2Vla2RheXNbIHBhcnNlSW50KCB0YXJnZXQudmFsdWUsIDEwICkgXSA9IGNsb25lX2ludGVydmFscyggc291cmNlX2ludGVydmFscyApO1xuXHRcdFx0fSApO1xuXHRcdFx0cmVuZGVyX3dvcmtpbmdfaG91cnNfZWRpdG9yKCk7XG5cdFx0XHRzaGVsbF9hcGkuY2xlYXJfZmllbGRfZXJyb3IoICd3b3JraW5nX2hvdXJzJyApO1xuXHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGdldF9tZXNzYWdlKCAnc2NoZWR1bGVfY29waWVkJywgJ1RoZSB3b3JraW5nLWhvdXJzIHNjaGVkdWxlIHdhcyBjb3BpZWQgdG8gdGhlIHNlbGVjdGVkIGRheXMuJyApICk7XG5cdFx0XHRjbG9zZV9jb3B5X3BhbmVsKCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIFdvcmtpbmcgSG91cnMgYnV0dG9uIGFjdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IERlbGVnYXRlZCBjbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgYWRkX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1hZGQtd29ya2luZy1pbnRlcnZhbF0nICk7XG5cdFx0XHR2YXIgcmVtb3ZlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1yZW1vdmUtd29ya2luZy1pbnRlcnZhbF0nICk7XG5cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNvcHktc2NoZWR1bGUtdG9nZ2xlXScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0aWYgKCBlZGl0b3IuY29weV9wYW5lbC5oaWRkZW4gKSB7XG5cdFx0XHRcdFx0b3Blbl9jb3B5X3BhbmVsKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2xvc2VfY29weV9wYW5lbCggdHJ1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNvcHktc2NoZWR1bGUtY2FuY2VsXScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xvc2VfY29weV9wYW5lbCggdHJ1ZSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1jb3B5LXNjaGVkdWxlLWFwcGx5XScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0YXBwbHlfc2NoZWR1bGVfY29weSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggYWRkX2J1dHRvbiApIHtcblx0XHRcdFx0dmFyIGFkZF9kYXlfbm9kZSA9IGFkZF9idXR0b24uY2xvc2VzdCggJ1tkYXRhLXdwYmMtd29ya2luZy1kYXldJyApO1xuXHRcdFx0XHR2YXIgYWRkX2RheV9udW1iZXIgPSBwYXJzZUludCggYWRkX2RheV9ub2RlLmRhdGFzZXQud3BiY1dvcmtpbmdEYXksIDEwICk7XG5cdFx0XHRcdHZhciBwcm9wb3NhbCA9IGZpbmRfaW50ZXJ2YWxfcHJvcG9zYWwoIGVkaXRvci53ZWVrZGF5c1sgYWRkX2RheV9udW1iZXIgXSB8fCBbXSApO1xuXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICggISBwcm9wb3NhbCB8fCBlZGl0b3Iud2Vla2RheXNbIGFkZF9kYXlfbnVtYmVyIF0ubGVuZ3RoID49IGVkaXRvci5tYXhfaW50ZXJ2YWxzICkge1xuXHRcdFx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCBnZXRfbWVzc2FnZSggJ3dvcmtpbmdfaG91cnNfbGltaXQnLCAnTm8gYWRkaXRpb25hbCBvbmUtaG91ciBpbnRlcnZhbCBpcyBhdmFpbGFibGUgZm9yIHRoaXMgZGF5LicgKSApO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRlZGl0b3Iud2Vla2RheXNbIGFkZF9kYXlfbnVtYmVyIF0ucHVzaCggcHJvcG9zYWwgKTtcblx0XHRcdFx0cmVuZGVyX3dvcmtpbmdfaG91cnNfZWRpdG9yKCk7XG5cdFx0XHRcdGZvY3VzX3dvcmtpbmdfaG91cnNfY29udHJvbCggYWRkX2RheV9udW1iZXIsIGVkaXRvci53ZWVrZGF5c1sgYWRkX2RheV9udW1iZXIgXS5sZW5ndGggLSAxICk7XG5cdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ3dvcmtpbmdfaG91cnMnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCByZW1vdmVfYnV0dG9uICkge1xuXHRcdFx0XHR2YXIgcmVtb3ZlX2RheV9ub2RlID0gcmVtb3ZlX2J1dHRvbi5jbG9zZXN0KCAnW2RhdGEtd3BiYy13b3JraW5nLWRheV0nICk7XG5cdFx0XHRcdHZhciByZW1vdmVfaW50ZXJ2YWxfbm9kZSA9IHJlbW92ZV9idXR0b24uY2xvc2VzdCggJ1tkYXRhLWludGVydmFsLWluZGV4XScgKTtcblx0XHRcdFx0dmFyIHJlbW92ZV9kYXlfbnVtYmVyID0gcGFyc2VJbnQoIHJlbW92ZV9kYXlfbm9kZS5kYXRhc2V0LndwYmNXb3JraW5nRGF5LCAxMCApO1xuXHRcdFx0XHR2YXIgcmVtb3ZlX2ludGVydmFsX2luZGV4ID0gcGFyc2VJbnQoIHJlbW92ZV9pbnRlcnZhbF9ub2RlLmRhdGFzZXQuaW50ZXJ2YWxJbmRleCwgMTAgKTtcblxuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRlZGl0b3Iud2Vla2RheXNbIHJlbW92ZV9kYXlfbnVtYmVyIF0uc3BsaWNlKCByZW1vdmVfaW50ZXJ2YWxfaW5kZXgsIDEgKTtcblx0XHRcdFx0cmVuZGVyX3dvcmtpbmdfaG91cnNfZWRpdG9yKCk7XG5cdFx0XHRcdGZvY3VzX3dvcmtpbmdfaG91cnNfY29udHJvbCggcmVtb3ZlX2RheV9udW1iZXIsIE1hdGgubWluKCByZW1vdmVfaW50ZXJ2YWxfaW5kZXgsIGVkaXRvci53ZWVrZGF5c1sgcmVtb3ZlX2RheV9udW1iZXIgXS5sZW5ndGggLSAxICkgKTtcblx0XHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnd29ya2luZ19ob3VycycgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgd2Vla2RheSwgaW50ZXJ2YWwsIGFuZCBjb3B5LXNvdXJjZSBjaGFuZ2VzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGNoYW5nZSBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jaGFuZ2UoIGV2ZW50ICkge1xuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtd29ya2luZy1ob3Vycy1lbmFibGVkXScgKSApIHtcblx0XHRcdFx0ZWRpdG9yLmVuYWJsZWQgPSBldmVudC50YXJnZXQuY2hlY2tlZDtcblx0XHRcdFx0aWYgKCAhIGVkaXRvci5lbmFibGVkICkge1xuXHRcdFx0XHRcdGNsb3NlX2NvcHlfcGFuZWwoIGZhbHNlICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVuZGVyX3dvcmtpbmdfaG91cnNfZWRpdG9yKCk7XG5cdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ3dvcmtpbmdfaG91cnMnICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtY29weS1zb3VyY2VdJyApICkge1xuXHRcdFx0XHRyZWZyZXNoX2NvcHlfdGFyZ2V0cygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXdvcmtpbmctZGF5LXRvZ2dsZV0nICkgKSB7XG5cdFx0XHRcdHZhciB0b2dnbGVfZGF5X25vZGUgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtd29ya2luZy1kYXldJyApO1xuXHRcdFx0XHR2YXIgdG9nZ2xlX2RheV9udW1iZXIgPSBwYXJzZUludCggdG9nZ2xlX2RheV9ub2RlLmRhdGFzZXQud3BiY1dvcmtpbmdEYXksIDEwICk7XG5cblx0XHRcdFx0ZWRpdG9yLndlZWtkYXlzWyB0b2dnbGVfZGF5X251bWJlciBdID0gZXZlbnQudGFyZ2V0LmNoZWNrZWQgPyBbIGZpbmRfaW50ZXJ2YWxfcHJvcG9zYWwoIFtdICkgXSA6IFtdO1xuXHRcdFx0XHRyZW5kZXJfd29ya2luZ19ob3Vyc19lZGl0b3IoKTtcblx0XHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCAnd29ya2luZ19ob3VycycgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy13b3JraW5nLXN0YXJ0XSwgW2RhdGEtd3BiYy13b3JraW5nLWVuZF0nICkgKSB7XG5cdFx0XHRcdHZhciBjaGFuZ2VkX2RheV9ub2RlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXdvcmtpbmctZGF5XScgKTtcblx0XHRcdFx0dmFyIGNoYW5nZWRfaW50ZXJ2YWxfbm9kZSA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtaW50ZXJ2YWwtaW5kZXhdJyApO1xuXHRcdFx0XHR2YXIgY2hhbmdlZF9kYXlfbnVtYmVyID0gcGFyc2VJbnQoIGNoYW5nZWRfZGF5X25vZGUuZGF0YXNldC53cGJjV29ya2luZ0RheSwgMTAgKTtcblx0XHRcdFx0dmFyIGNoYW5nZWRfaW50ZXJ2YWxfaW5kZXggPSBwYXJzZUludCggY2hhbmdlZF9pbnRlcnZhbF9ub2RlLmRhdGFzZXQuaW50ZXJ2YWxJbmRleCwgMTAgKTtcblx0XHRcdFx0dmFyIGNoYW5nZWRfaW50ZXJ2YWwgPSBlZGl0b3Iud2Vla2RheXNbIGNoYW5nZWRfZGF5X251bWJlciBdWyBjaGFuZ2VkX2ludGVydmFsX2luZGV4IF07XG5cblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtd29ya2luZy1zdGFydF0nICkgKSB7XG5cdFx0XHRcdFx0Y2hhbmdlZF9pbnRlcnZhbC5zdGFydF9zZWNvbmQgPSBwYXJzZUludCggZXZlbnQudGFyZ2V0LnZhbHVlLCAxMCApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNoYW5nZWRfaW50ZXJ2YWwuZW5kX3NlY29uZCA9IHBhcnNlSW50KCBldmVudC50YXJnZXQudmFsdWUsIDEwICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3luY193b3JraW5nX2hvdXJzX2RyYWZ0KCk7XG5cdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ3dvcmtpbmdfaG91cnMnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xvc2UgdGhlIHNjaGVkdWxlLWNvcHkgcGFuZWwgd2l0aCBFc2NhcGUgd2hpbGUgZm9jdXMgaXMgaW5zaWRlIGl0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBLZXlkb3duIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2tleWRvd24oIGV2ZW50ICkge1xuXHRcdFx0aWYgKCAnRXNjYXBlJyA9PT0gZXZlbnQua2V5ICYmIGVkaXRvci5jb3B5X3BhbmVsICYmICEgZWRpdG9yLmNvcHlfcGFuZWwuaGlkZGVuICYmIGVkaXRvci5jb3B5X3BhbmVsLmNvbnRhaW5zKCBldmVudC50YXJnZXQgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xvc2VfY29weV9wYW5lbCggdHJ1ZSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhpcyBtb2R1bGUgYWdhaW5zdCBzaGVsbC1wcm92aWRlZCBzZXJ2aWNlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RlcmVkX3NoZWxsX2FwaSBTaGFyZWQgd2l6YXJkIGFkYXB0ZXIgc2VydmljZXMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCByZWdpc3RlcmVkX3NoZWxsX2FwaSApIHtcblx0XHRcdHZhciBwYXJzZWRfd29ya2luZ19ob3Vycztcblx0XHRcdHZhciB3ZWVrZGF5cyA9IHt9O1xuXHRcdFx0dmFyIGVkaXRvcl9ub2RlO1xuXHRcdFx0dmFyIHRyYW5zcG9ydDtcblxuXHRcdFx0c2hlbGxfYXBpID0gcmVnaXN0ZXJlZF9zaGVsbF9hcGk7XG5cdFx0XHRyb290ID0gc2hlbGxfYXBpLnJvb3Q7XG5cdFx0XHRlZGl0b3Jfbm9kZSA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtd29ya2luZy1ob3Vycy1lZGl0b3JdJyApO1xuXHRcdFx0dHJhbnNwb3J0ID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLWhvdXJzLWRyYWZ0XScgKTtcblx0XHRcdGlmICggISBlZGl0b3Jfbm9kZSB8fCAhIHRyYW5zcG9ydCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRwYXJzZWRfd29ya2luZ19ob3VycyA9IEpTT04ucGFyc2UoIHRyYW5zcG9ydC52YWx1ZSB8fCAne30nICk7XG5cdFx0XHR9IGNhdGNoICggcGFyc2VfZXJyb3IgKSB7XG5cdFx0XHRcdHBhcnNlZF93b3JraW5nX2hvdXJzID0ge307XG5cdFx0XHR9XG5cblx0XHRcdFsgMCwgMSwgMiwgMywgNCwgNSwgNiBdLmZvckVhY2goIGZ1bmN0aW9uICggZGF5X251bWJlciApIHtcblx0XHRcdFx0dmFyIHJhd19pbnRlcnZhbHMgPSBwYXJzZWRfd29ya2luZ19ob3Vycy53ZWVrZGF5cyAmJiBBcnJheS5pc0FycmF5KCBwYXJzZWRfd29ya2luZ19ob3Vycy53ZWVrZGF5c1sgZGF5X251bWJlciBdICkgPyBwYXJzZWRfd29ya2luZ19ob3Vycy53ZWVrZGF5c1sgZGF5X251bWJlciBdIDogW107XG5cblx0XHRcdFx0d2Vla2RheXNbIGRheV9udW1iZXIgXSA9IHJhd19pbnRlcnZhbHMubWFwKCBmdW5jdGlvbiAoIGludGVydmFsICkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRzdGFydF9zZWNvbmQ6IHBhcnNlSW50KCBpbnRlcnZhbC5zdGFydF9zZWNvbmQsIDEwICksXG5cdFx0XHRcdFx0XHRlbmRfc2Vjb25kOiBwYXJzZUludCggaW50ZXJ2YWwuZW5kX3NlY29uZCwgMTAgKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gKS5maWx0ZXIoIGZ1bmN0aW9uICggaW50ZXJ2YWwgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGlzRmluaXRlKCBpbnRlcnZhbC5zdGFydF9zZWNvbmQgKSAmJiBNYXRoLmZsb29yKCBpbnRlcnZhbC5zdGFydF9zZWNvbmQgKSA9PT0gaW50ZXJ2YWwuc3RhcnRfc2Vjb25kICYmIGlzRmluaXRlKCBpbnRlcnZhbC5lbmRfc2Vjb25kICkgJiYgTWF0aC5mbG9vciggaW50ZXJ2YWwuZW5kX3NlY29uZCApID09PSBpbnRlcnZhbC5lbmRfc2Vjb25kO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGVkaXRvciA9IHtcblx0XHRcdFx0bm9kZTogZWRpdG9yX25vZGUsXG5cdFx0XHRcdHRyYW5zcG9ydDogdHJhbnNwb3J0LFxuXHRcdFx0XHR0ZW1wbGF0ZTogcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLWludGVydmFsLXRlbXBsYXRlXScgKSxcblx0XHRcdFx0ZW5hYmxlZDogJ09mZicgIT09IHBhcnNlZF93b3JraW5nX2hvdXJzLmVuYWJsZWQsXG5cdFx0XHRcdGVuYWJsZWRfdG9nZ2xlOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy13b3JraW5nLWhvdXJzLWVuYWJsZWRdJyApLFxuXHRcdFx0XHRzY2hlZHVsZV9jb250cm9sczogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtd29ya2luZy1ob3Vycy1jb250cm9sc10nICksXG5cdFx0XHRcdHdlZWtkYXlzOiB3ZWVrZGF5cyxcblx0XHRcdFx0bWF4X2ludGVydmFsczogcGFyc2VJbnQoIHRyYW5zcG9ydC5kYXRhc2V0Lm1heEludGVydmFscyB8fCAnOCcsIDEwICksXG5cdFx0XHRcdGNvcHlfdG9nZ2xlOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jb3B5LXNjaGVkdWxlLXRvZ2dsZV0nICksXG5cdFx0XHRcdGNvcHlfcGFuZWw6IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNvcHktc2NoZWR1bGUtcGFuZWxdJyApLFxuXHRcdFx0XHRjb3B5X3NvdXJjZTogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtY29weS1zb3VyY2VdJyApXG5cdFx0XHR9O1xuXG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfY2xpY2sgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfY2hhbmdlICk7XG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9rZXlkb3duICk7XG5cdFx0XHRyZWZyZXNoX2NvcHlfdGFyZ2V0cygpO1xuXHRcdFx0cmVuZGVyX3dvcmtpbmdfaG91cnNfZWRpdG9yKCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVmFsaWRhdGUgaW50ZXJ2YWwgb3JkZXIgYW5kIG92ZXJsYXAgYmVmb3JlIGZvcndhcmQgbmF2aWdhdGlvbi5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEZpcnN0IGludmFsaWQgY29udHJvbCwgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB2YWxpZGF0ZSgpIHtcblx0XHRcdHZhciBmaXJzdF9pbnZhbGlkID0gbnVsbDtcblx0XHRcdHZhciBlbmFibGVkX2ludGVydmFsX2NvdW50ID0gMDtcblxuXHRcdFx0aWYgKCAhIGVkaXRvciApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRpZiAoICEgZWRpdG9yLmVuYWJsZWQgKSB7XG5cdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggJ3dvcmtpbmdfaG91cnMnICk7XG5cdFx0XHRcdHN5bmNfd29ya2luZ19ob3Vyc19kcmFmdCgpO1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtd29ya2luZy1zdGFydF0sIFtkYXRhLXdwYmMtd29ya2luZy1lbmRdJyApLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdFx0Y29udHJvbC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdFsgMCwgMSwgMiwgMywgNCwgNSwgNiBdLnNvbWUoIGZ1bmN0aW9uICggZGF5X251bWJlciApIHtcblx0XHRcdFx0dmFyIGludGVydmFscyA9IGVkaXRvci53ZWVrZGF5c1sgZGF5X251bWJlciBdIHx8IFtdO1xuXHRcdFx0XHR2YXIgc29ydGVkX2ludGVydmFscyA9IGludGVydmFscy5zbGljZSgpLnNvcnQoIGZ1bmN0aW9uICggZmlyc3RfaW50ZXJ2YWwsIHNlY29uZF9pbnRlcnZhbCApIHtcblx0XHRcdFx0XHRyZXR1cm4gZmlyc3RfaW50ZXJ2YWwuc3RhcnRfc2Vjb25kIC0gc2Vjb25kX2ludGVydmFsLnN0YXJ0X3NlY29uZDtcblx0XHRcdFx0fSApO1xuXHRcdFx0XHR2YXIgcHJldmlvdXNfZW5kID0gLTE7XG5cdFx0XHRcdHZhciBkYXlfbm9kZSA9IGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXdvcmtpbmctZGF5PVwiJyArIGRheV9udW1iZXIgKyAnXCJdJyApO1xuXG5cdFx0XHRcdGVuYWJsZWRfaW50ZXJ2YWxfY291bnQgKz0gaW50ZXJ2YWxzLmxlbmd0aDtcblx0XHRcdFx0cmV0dXJuIHNvcnRlZF9pbnRlcnZhbHMuc29tZSggZnVuY3Rpb24gKCBpbnRlcnZhbCApIHtcblx0XHRcdFx0XHR2YXIgaW50ZXJ2YWxfaW5kZXggPSBpbnRlcnZhbHMuaW5kZXhPZiggaW50ZXJ2YWwgKTtcblx0XHRcdFx0XHR2YXIgaW50ZXJ2YWxfbm9kZSA9IGRheV9ub2RlICYmIGRheV9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1pbnRlcnZhbC1pbmRleD1cIicgKyBpbnRlcnZhbF9pbmRleCArICdcIl0nICk7XG5cdFx0XHRcdFx0dmFyIGludmFsaWRfcmFuZ2UgPSAhIGlzRmluaXRlKCBpbnRlcnZhbC5zdGFydF9zZWNvbmQgKSB8fCBNYXRoLmZsb29yKCBpbnRlcnZhbC5zdGFydF9zZWNvbmQgKSAhPT0gaW50ZXJ2YWwuc3RhcnRfc2Vjb25kIHx8ICEgaXNGaW5pdGUoIGludGVydmFsLmVuZF9zZWNvbmQgKSB8fCBNYXRoLmZsb29yKCBpbnRlcnZhbC5lbmRfc2Vjb25kICkgIT09IGludGVydmFsLmVuZF9zZWNvbmQgfHwgaW50ZXJ2YWwuc3RhcnRfc2Vjb25kIDwgMCB8fCBpbnRlcnZhbC5lbmRfc2Vjb25kID4gODY0MDAgfHwgaW50ZXJ2YWwuc3RhcnRfc2Vjb25kID49IGludGVydmFsLmVuZF9zZWNvbmQ7XG5cdFx0XHRcdFx0dmFyIG92ZXJsYXBzID0gaW50ZXJ2YWwuc3RhcnRfc2Vjb25kIDwgcHJldmlvdXNfZW5kO1xuXG5cdFx0XHRcdFx0cHJldmlvdXNfZW5kID0gTWF0aC5tYXgoIHByZXZpb3VzX2VuZCwgaW50ZXJ2YWwuZW5kX3NlY29uZCApO1xuXHRcdFx0XHRcdGlmICggaW52YWxpZF9yYW5nZSB8fCBvdmVybGFwcyApIHtcblx0XHRcdFx0XHRcdGZpcnN0X2ludmFsaWQgPSBpbnRlcnZhbF9ub2RlID8gaW50ZXJ2YWxfbm9kZS5xdWVyeVNlbGVjdG9yKCBpbnZhbGlkX3JhbmdlID8gJ1tkYXRhLXdwYmMtd29ya2luZy1lbmRdJyA6ICdbZGF0YS13cGJjLXdvcmtpbmctc3RhcnRdJyApIDogZGF5X25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtd29ya2luZy1kYXktdG9nZ2xlXScgKTtcblx0XHRcdFx0XHRcdGlmICggZmlyc3RfaW52YWxpZCApIHtcblx0XHRcdFx0XHRcdFx0Zmlyc3RfaW52YWxpZC5zZXRBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnLCAndHJ1ZScgKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoICd3b3JraW5nX2hvdXJzJywgaW52YWxpZF9yYW5nZSA/IGdldF9tZXNzYWdlKCAnd29ya2luZ19ob3Vyc19pbnZhbGlkJywgJ0V2ZXJ5IHdvcmtpbmcgaW50ZXJ2YWwgbXVzdCBlbmQgYWZ0ZXIgaXQgc3RhcnRzLicgKSA6IGdldF9tZXNzYWdlKCAnd29ya2luZ19ob3Vyc19vdmVybGFwJywgJ1dvcmtpbmcgaW50ZXJ2YWxzIG9uIHRoZSBzYW1lIGRheSBjYW5ub3Qgb3ZlcmxhcCBvciByZXBlYXQuJyApICk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGlmICggISBmaXJzdF9pbnZhbGlkICYmIDAgPT09IGVuYWJsZWRfaW50ZXJ2YWxfY291bnQgKSB7XG5cdFx0XHRcdGZpcnN0X2ludmFsaWQgPSBzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCAnd29ya2luZ19ob3VycycsIGdldF9tZXNzYWdlKCAnd29ya2luZ19ob3Vyc19yZXF1aXJlZCcsICdFbmFibGUgYXQgbGVhc3Qgb25lIHdlZWtkYXkgYW5kIGFkZCBpdHMgd29ya2luZyBob3Vycy4nICkgKTtcblx0XHRcdH1cblxuXHRcdFx0c3luY193b3JraW5nX2hvdXJzX2RyYWZ0KCk7XG5cdFx0XHRyZXR1cm4gZmlyc3RfaW52YWxpZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdHN5bmM6IHN5bmNfd29ya2luZ19ob3Vyc19kcmFmdCxcblx0XHRcdHZhbGlkYXRlOiB2YWxpZGF0ZVxuXHRcdH07XG5cdH1cblxuXHR3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyA9IHdpbmRvdy53cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzIHx8IHt9O1xuXHR3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcy53b3JraW5nX2hvdXJzID0ge1xuXHRcdGNyZWF0ZTogY3JlYXRlX3dvcmtpbmdfaG91cnNfYWRhcHRlclxuXHR9O1xuXG5cdGlmICggd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaSAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaS5yZWdpc3Rlcl9zdGVwX2FkYXB0ZXIgKSB7XG5cdFx0d2luZG93LndwYmNfc2V0dXBfd2l6YXJkX2FwaS5yZWdpc3Rlcl9zdGVwX2FkYXB0ZXIoIGNyZWF0ZV93b3JraW5nX2hvdXJzX2FkYXB0ZXIoIG1vZHVsZV9jb25maWcgKSApO1xuXHR9XG59KCB3aW5kb3csIGRvY3VtZW50ICkgKTtcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxNQUFNLEVBQUVDLFFBQVEsRUFBRztFQUMvQixZQUFZOztFQUVaLElBQUlDLGFBQWEsR0FBR0YsTUFBTSxDQUFDRywrQkFBK0IsSUFBSTtJQUFFQyxJQUFJLEVBQUUsQ0FBQztFQUFFLENBQUM7O0VBRTFFO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLDRCQUE0QkEsQ0FBRUMsTUFBTSxFQUFHO0lBQy9DLElBQUlDLFNBQVMsR0FBRyxJQUFJO0lBQ3BCLElBQUlDLElBQUksR0FBRyxJQUFJO0lBQ2YsSUFBSUMsTUFBTSxHQUFHLElBQUk7O0lBRWpCO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsU0FBU0MsV0FBV0EsQ0FBRUMsR0FBRyxFQUFFQyxRQUFRLEVBQUc7TUFDckMsT0FBT04sTUFBTSxDQUFDRixJQUFJLElBQUlFLE1BQU0sQ0FBQ0YsSUFBSSxDQUFFTyxHQUFHLENBQUUsR0FBR0wsTUFBTSxDQUFDRixJQUFJLENBQUVPLEdBQUcsQ0FBRSxHQUFHQyxRQUFRO0lBQ3pFOztJ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
