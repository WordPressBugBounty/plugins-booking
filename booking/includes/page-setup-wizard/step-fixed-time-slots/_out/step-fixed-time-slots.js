"use strict";

/**
 * Fixed Time Slots editor adapter for the Setup Wizard.
 *
 * @package Booking Calendar
 */
(function (window) {
  'use strict';

  var config = window.wpbc_setup_wizard_fixed_time_slots || {
    i18n: {}
  };
  var module_config = {
    module_id: config.module_id || 'fixed_time_slots',
    field_id: config.field_id || 'fixed_time_slots'
  };

  /**
   * Create one fixed-slot editor adapter.
   *
   * @param {Object} runtime_config Server-owned module configuration.
   * @return {Object} Setup Wizard step adapter.
   */
  function create_fixed_time_slots_adapter(runtime_config) {
    var shell_api = null;
    var editor = null;

    /**
     * Return one localized message with a safe fallback.
     *
     * @param {string} key Message key.
     * @param {string} fallback Fallback text.
     * @return {string} Message text.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? config.i18n[key] : fallback;
    }

    /**
     * Convert one exact clock value to minutes after day start.
     *
     * @param {string} time_value Clock value.
     * @param {boolean} allow_day_end Whether `24:00` is accepted.
     * @return {number|null} Minute count or null.
     */
    function time_to_minutes(time_value, allow_day_end) {
      var match;
      if (allow_day_end && '24:00' === time_value) {
        return 24 * 60;
      }
      match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(String(time_value || ''));
      if (!match) {
        return null;
      }
      return parseInt(time_value.substr(0, 2), 10) * 60 + parseInt(time_value.substr(3, 2), 10);
    }

    /**
     * Convert bounded minute count to `HH:MM`.
     *
     * @param {number} minutes Minutes from day start.
     * @return {string} Clock value.
     */
    function minutes_to_time(minutes) {
      var hour = Math.floor(minutes / 60);
      var minute = minutes % 60;
      return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
    }

    /**
     * Return a select option label for one value.
     *
     * @param {HTMLSelectElement} select Select control.
     * @param {string} option_value Option value.
     * @return {string} Visible label or value.
     */
    function get_option_label(select, option_value) {
      var option = Array.prototype.find.call(select.options, function (candidate) {
        return candidate.value === option_value;
      });
      return option ? option.textContent : option_value;
    }

    /**
     * Return a human-readable label for one slot.
     *
     * @param {Object} slot Slot DTO.
     * @param {HTMLSelectElement} start_select Start select.
     * @param {HTMLSelectElement} end_select End select.
     * @return {string} Slot label.
     */
    function get_slot_label(slot, start_select, end_select) {
      return get_option_label(start_select, slot.start_time) + ' - ' + get_option_label(end_select, slot.end_time);
    }

    /**
     * Synchronize the JSON transport with current ordered slots.
     *
     * @return {void}
     */
    function sync_fixed_slots_draft() {
      if (editor) {
        editor.transport.value = JSON.stringify({
          time_slots: editor.slots
        });
      }
    }

    /**
     * Return one rendered slot control by index.
     *
     * @param {number} slot_index Slot index.
     * @return {HTMLElement|null} Slot element or null.
     */
    function get_slot_control(slot_index) {
      return editor ? editor.list.querySelector('[data-fixed-slot-index="' + slot_index + '"]') : null;
    }

    /**
     * Focus the preferred control after rendering.
     *
     * @param {number} slot_index Slot index.
     * @param {string} control_name Control data suffix.
     * @return {void}
     */
    function focus_slot_control(slot_index, control_name) {
      var slot_control = get_slot_control(slot_index);
      var target = slot_control ? slot_control.querySelector('[data-wpbc-' + control_name + ']') : editor.add_button;
      if (target) {
        target.focus();
      }
    }

    /**
     * Render the complete ordered slot list from data-only state.
     *
     * @return {void}
     */
    function render_slots() {
      editor.list.textContent = '';
      editor.add_button.removeAttribute('data-wpbc-setup-wizard-error-control-for');
      if (!editor.slots.length) {
        editor.add_button.setAttribute('data-wpbc-setup-wizard-error-control-for', editor.field_id);
      }
      editor.slots.forEach(function (slot, slot_index) {
        var slot_control = editor.template.content.firstElementChild.cloneNode(true);
        var start_select = slot_control.querySelector('[data-wpbc-fixed-slot-start]');
        var end_select = slot_control.querySelector('[data-wpbc-fixed-slot-end]');
        var start_label = slot_control.querySelector('[data-wpbc-fixed-slot-start-label]');
        var end_label = slot_control.querySelector('[data-wpbc-fixed-slot-end-label]');
        var move_button = slot_control.querySelector('[data-wpbc-move-fixed-slot]');
        var remove_button = slot_control.querySelector('[data-wpbc-remove-fixed-slot]');
        var start_id = 'wpbc-fixed-time-slot-start-' + slot_index;
        var end_id = 'wpbc-fixed-time-slot-end-' + slot_index;
        var slot_label;
        slot_control.dataset.fixedSlotIndex = String(slot_index);
        start_select.id = start_id;
        end_select.id = end_id;
        start_select.value = slot.start_time;
        end_select.value = slot.end_time;
        start_label.htmlFor = start_id;
        end_label.htmlFor = end_id;
        if (0 === slot_index) {
          start_select.setAttribute('data-wpbc-setup-wizard-error-control-for', editor.field_id);
        }
        slot_label = get_slot_label(slot, start_select, end_select);
        start_label.textContent = editor.list_label + ' ' + (slot_index + 1) + ': start';
        end_label.textContent = editor.list_label + ' ' + (slot_index + 1) + ': end';
        move_button.setAttribute('aria-label', get_message('move_slot', 'Move fixed time slot %s').replace('%s', slot_label));
        remove_button.setAttribute('aria-label', get_message('remove_slot', 'Remove fixed time slot %s').replace('%s', slot_label));
        editor.list.appendChild(slot_control);
      });
      editor.add_button.disabled = editor.slots.length >= editor.max_time_slots;
      editor.clear_button.disabled = !editor.slots.length;
      sync_fixed_slots_draft();
    }

    /**
     * Mark one slot control invalid and return the focus target.
     *
     * @param {string} message Validation message.
     * @param {number} slot_index Slot index.
     * @param {string} control_name Either start or end control suffix.
     * @return {HTMLElement|null} Invalid control or null.
     */
    function set_slot_error(message, slot_index, control_name) {
      var slot_control = get_slot_control(slot_index);
      var target = slot_control ? slot_control.querySelector('[data-wpbc-fixed-slot-' + control_name + ']') : editor.add_button;
      shell_api.set_field_error(editor.field_id, message);
      if (target) {
        target.setAttribute('aria-invalid', 'true');
      }
      return target;
    }

    /**
     * Generate ordered fixed slots from independent spacing and duration.
     *
     * @return {void}
     */
    function generate_slots() {
      var from_minutes = time_to_minutes(editor.generator_from.value, false);
      var to_minutes = time_to_minutes(editor.generator_to.value, false);
      var spacing_minutes = parseInt(editor.generator_interval.value, 10);
      var duration_minutes = parseInt(editor.generator_duration.value, 10);
      var generated_slots = [];
      var start_minutes;
      editor.generator_to.removeAttribute('aria-invalid');
      editor.generator_duration.removeAttribute('aria-invalid');
      if (null === from_minutes || null === to_minutes || to_minutes < from_minutes || !isFinite(spacing_minutes) || !isFinite(duration_minutes) || spacing_minutes < editor.time_increment || duration_minutes < editor.time_increment || 0 !== spacing_minutes % editor.time_increment || 0 !== duration_minutes % editor.time_increment) {
        editor.generator_to.setAttribute('aria-invalid', 'true');
        shell_api.set_status(get_message('generator_invalid', 'Choose a valid first start, last start, spacing, and duration.'));
        editor.generator_to.focus();
        return;
      }
      if (to_minutes + duration_minutes > 24 * 60) {
        editor.generator_duration.setAttribute('aria-invalid', 'true');
        shell_api.set_status(get_message('generator_day_overflow', 'The generated slot duration must finish by the end of the day.'));
        editor.generator_duration.focus();
        return;
      }
      for (start_minutes = from_minutes; start_minutes <= to_minutes && generated_slots.length < editor.max_time_slots; start_minutes += spacing_minutes) {
        generated_slots.push({
          start_time: minutes_to_time(start_minutes),
          end_time: minutes_to_time(start_minutes + duration_minutes)
        });
      }
      editor.slots = generated_slots;
      render_slots();
      focus_slot_control(0, 'fixed-slot-start');
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Determine whether one slot already exists.
     *
     * @param {string} start_time Start time.
     * @param {string} end_time End time.
     * @return {boolean} True when the exact range exists.
     */
    function has_slot(start_time, end_time) {
      return editor.slots.some(function (slot) {
        return slot.start_time === start_time && slot.end_time === end_time;
      });
    }

    /**
     * Find a valid unused slot proposal using current generator duration.
     *
     * @return {Object|null} Proposed slot or null.
     */
    function find_slot_proposal() {
      var duration_minutes = parseInt(editor.generator_duration.value, 10);
      var preferred_start = editor.slots.length ? editor.slots[editor.slots.length - 1].end_time : editor.generator_from.value;
      var preferred_index = editor.start_values.indexOf(preferred_start);
      var offset;
      if (!isFinite(duration_minutes) || duration_minutes < editor.time_increment) {
        duration_minutes = 30;
      }
      preferred_index = -1 === preferred_index ? 0 : preferred_index;
      for (offset = 0; offset < editor.start_values.length; offset += 1) {
        var start_time = editor.start_values[(preferred_index + offset) % editor.start_values.length];
        var start_minutes = time_to_minutes(start_time, false);
        var end_minutes = start_minutes + duration_minutes;
        var end_time = minutes_to_time(end_minutes);
        if (end_minutes <= 24 * 60 && -1 !== editor.end_values.indexOf(end_time) && !has_slot(start_time, end_time)) {
          return {
            start_time: start_time,
            end_time: end_time
          };
        }
      }
      return null;
    }

    /**
     * Add one valid unused fixed slot.
     *
     * @return {void}
     */
    function add_slot() {
      var proposal;
      if (editor.slots.length >= editor.max_time_slots) {
        shell_api.set_status(get_message('slot_limit', 'No additional fixed time slot can be added.'));
        return;
      }
      proposal = find_slot_proposal();
      if (!proposal) {
        shell_api.set_status(get_message('slot_limit', 'No additional fixed time slot can be added.'));
        return;
      }
      editor.slots.push(proposal);
      render_slots();
      focus_slot_control(editor.slots.length - 1, 'fixed-slot-start');
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Clear every slot while preserving keyboard focus in the action area.
     *
     * @return {void}
     */
    function clear_slots() {
      if (!editor.slots.length) {
        return;
      }
      editor.slots = [];
      render_slots();
      editor.add_button.focus();
      shell_api.clear_field_error(editor.field_id);
      shell_api.set_status(get_message('slots_cleared', 'Fixed time slots cleared.'));
    }

    /**
     * Move one slot within the ordered list.
     *
     * @param {number} source_index Current index.
     * @param {number} target_index Target index.
     * @return {void}
     */
    function move_slot(source_index, target_index) {
      var moved_slot;
      if (source_index === target_index || source_index < 0 || target_index < 0 || source_index >= editor.slots.length || target_index >= editor.slots.length) {
        return;
      }
      moved_slot = editor.slots.splice(source_index, 1)[0];
      editor.slots.splice(target_index, 0, moved_slot);
      render_slots();
      focus_slot_control(target_index, 'move-fixed-slot');
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Initialize SortableJS for the fixed-slot list.
     *
     * @return {void}
     */
    function initialize_sortable() {
      if ('function' !== typeof window.Sortable) {
        return;
      }
      editor.sortable = new window.Sortable(editor.list, {
        animation: 120,
        draggable: '[data-fixed-slot-index]',
        handle: '[data-wpbc-move-fixed-slot]',
        ghostClass: 'is-drag-placeholder',
        chosenClass: 'is-dragging',
        dragClass: 'is-dragging',
        onEnd: function (event) {
          var source_index = Number(event.oldIndex);
          var target_index = Number(event.newIndex);
          if (Number.isInteger(source_index) && Number.isInteger(target_index)) {
            move_slot(source_index, target_index);
          } else {
            render_slots();
          }
        }
      });
    }

    /**
     * Handle generator, add, clear, and remove actions.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {void}
     */
    function handle_click(event) {
      var slot_control;
      var slot_index;
      if (event.target.closest('[data-wpbc-generate-fixed-slots]')) {
        event.preventDefault();
        generate_slots();
        return;
      }
      if (event.target.closest('[data-wpbc-add-fixed-slot]')) {
        event.preventDefault();
        add_slot();
        return;
      }
      if (event.target.closest('[data-wpbc-clear-fixed-slots]')) {
        event.preventDefault();
        clear_slots();
        return;
      }
      slot_control = event.target.closest('[data-fixed-slot-index]');
      if (slot_control && event.target.closest('[data-wpbc-remove-fixed-slot]')) {
        event.preventDefault();
        slot_index = parseInt(slot_control.dataset.fixedSlotIndex, 10);
        editor.slots.splice(slot_index, 1);
        render_slots();
        focus_slot_control(Math.min(slot_index, editor.slots.length - 1), 'fixed-slot-start');
        shell_api.clear_field_error(editor.field_id);
      }
    }

    /**
     * Synchronize a changed start or end select.
     *
     * @param {Event} event Delegated change event.
     * @return {void}
     */
    function handle_change(event) {
      var slot_control = event.target.closest('[data-fixed-slot-index]');
      var slot_index;
      if (!slot_control) {
        return;
      }
      slot_index = parseInt(slot_control.dataset.fixedSlotIndex, 10);
      if (event.target.matches('[data-wpbc-fixed-slot-start]')) {
        editor.slots[slot_index].start_time = event.target.value;
      } else if (event.target.matches('[data-wpbc-fixed-slot-end]')) {
        editor.slots[slot_index].end_time = event.target.value;
      } else {
        return;
      }
      render_slots();
      focus_slot_control(slot_index, event.target.matches('[data-wpbc-fixed-slot-start]') ? 'fixed-slot-start' : 'fixed-slot-end');
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Provide keyboard reordering equivalent to drag and drop.
     *
     * @param {KeyboardEvent} event Delegated keydown event.
     * @return {void}
     */
    function handle_keydown(event) {
      var move_button = event.target.closest('[data-wpbc-move-fixed-slot]');
      var slot_control;
      var slot_index;
      var target_index;
      if (!move_button || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        return;
      }
      slot_control = move_button.closest('[data-fixed-slot-index]');
      slot_index = parseInt(slot_control.dataset.fixedSlotIndex, 10);
      target_index = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? slot_index - 1 : slot_index + 1;
      event.preventDefault();
      move_slot(slot_index, target_index);
    }

    /**
     * Initialize this module against shell-provided services.
     *
     * @param {Object} registered_shell_api Shared wizard adapter services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var editor_node;
      var transport;
      var parsed_values;
      var template_start;
      var template_end;
      shell_api = registered_shell_api;
      editor_node = shell_api.root.querySelector('[data-wpbc-fixed-slots-editor]');
      transport = shell_api.root.querySelector('[data-wpbc-fixed-slots-draft]');
      if (!editor_node || !transport) {
        return;
      }
      try {
        parsed_values = JSON.parse(transport.value || '{}');
      } catch (parse_error) {
        parsed_values = {};
      }
      editor = {
        node: editor_node,
        transport: transport,
        field_id: editor_node.dataset.fieldId || runtime_config.field_id || 'fixed_time_slots',
        slots: parsed_values && Array.isArray(parsed_values.time_slots) ? parsed_values.time_slots.slice() : [],
        max_time_slots: parseInt(transport.dataset.maxTimeSlots || String(config.max_time_slots || 288), 10),
        time_increment: parseInt(transport.dataset.timeIncrement || String(config.time_increment || 5), 10),
        list: editor_node.querySelector('[data-wpbc-fixed-slot-list]'),
        template: editor_node.querySelector('[data-wpbc-fixed-slot-template]'),
        add_button: editor_node.querySelector('[data-wpbc-add-fixed-slot]'),
        clear_button: editor_node.querySelector('[data-wpbc-clear-fixed-slots]'),
        generator_from: editor_node.querySelector('[data-wpbc-fixed-generator-from]'),
        generator_to: editor_node.querySelector('[data-wpbc-fixed-generator-to]'),
        generator_interval: editor_node.querySelector('[data-wpbc-fixed-generator-interval]'),
        generator_duration: editor_node.querySelector('[data-wpbc-fixed-generator-duration]'),
        list_label: '',
        start_values: [],
        end_values: [],
        sortable: null
      };
      if (!editor.list || !editor.template || !editor.add_button || !editor.clear_button || !editor.generator_from || !editor.generator_to || !editor.generator_interval || !editor.generator_duration) {
        editor = null;
        return;
      }
      template_start = editor.template.content.querySelector('[data-wpbc-fixed-slot-start]');
      template_end = editor.template.content.querySelector('[data-wpbc-fixed-slot-end]');
      if (!template_start || !template_end) {
        editor = null;
        return;
      }
      editor.list_label = editor.list.dataset.listLabel || 'Fixed time slots';
      editor.start_values = Array.prototype.map.call(template_start.options, function (option) {
        return option.value;
      });
      editor.end_values = Array.prototype.map.call(template_end.options, function (option) {
        return option.value;
      });
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      editor.node.addEventListener('keydown', handle_keydown);
      render_slots();
      initialize_sortable();
    }

    /**
     * Validate required, allow-listed, positive, unique fixed slots.
     *
     * @return {HTMLElement|null} First invalid control or null.
     */
    function validate() {
      var first_invalid = null;
      var seen_slots = {};
      if (!editor) {
        return null;
      }
      editor.node.querySelectorAll('[aria-invalid="true"]').forEach(function (control) {
        control.removeAttribute('aria-invalid');
      });
      if (!editor.slots.length) {
        first_invalid = set_slot_error(get_message('slots_required', 'Add at least one fixed time slot.'), -1, 'start');
      }
      editor.slots.some(function (slot, slot_index) {
        var start_minutes = time_to_minutes(slot.start_time, false);
        var end_minutes = time_to_minutes(slot.end_time, true);
        var slot_key = slot.start_time + ' - ' + slot.end_time;
        if (-1 === editor.start_values.indexOf(slot.start_time) || -1 === editor.end_values.indexOf(slot.end_time) || null === start_minutes || null === end_minutes || end_minutes <= start_minutes) {
          first_invalid = set_slot_error(get_message('slot_invalid', 'Every fixed time slot must end after it starts.'), slot_index, 'end');
          return true;
        }
        if (Object.prototype.hasOwnProperty.call(seen_slots, slot_key)) {
          first_invalid = set_slot_error(get_message('slot_duplicate', 'The same fixed time slot cannot appear twice.'), slot_index, 'start');
          return true;
        }
        seen_slots[slot_key] = true;
        return false;
      });
      sync_fixed_slots_draft();
      return first_invalid;
    }
    return {
      initialize: initialize,
      sync: sync_fixed_slots_draft,
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules[module_config.module_id] = {
    create: create_fixed_time_slots_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_fixed_time_slots_adapter(module_config));
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1maXhlZC10aW1lLXNsb3RzL19vdXQvc3RlcC1maXhlZC10aW1lLXNsb3RzLmpzIiwibmFtZXMiOlsid2luZG93IiwiY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfZml4ZWRfdGltZV9zbG90cyIsImkxOG4iLCJtb2R1bGVfY29uZmlnIiwibW9kdWxlX2lkIiwiZmllbGRfaWQiLCJjcmVhdGVfZml4ZWRfdGltZV9zbG90c19hZGFwdGVyIiwicnVudGltZV9jb25maWciLCJzaGVsbF9hcGkiLCJlZGl0b3IiLCJnZXRfbWVzc2FnZSIsImtleSIsImZhbGxiYWNrIiwidGltZV90b19taW51dGVzIiwidGltZV92YWx1ZSIsImFsbG93X2RheV9lbmQiLCJtYXRjaCIsImV4ZWMiLCJTdHJpbmciLCJwYXJzZUludCIsInN1YnN0ciIsIm1pbnV0ZXNfdG9fdGltZSIsIm1pbnV0ZXMiLCJob3VyIiwiTWF0aCIsImZsb29yIiwibWludXRlIiwicGFkU3RhcnQiLCJnZXRfb3B0aW9uX2xhYmVsIiwic2VsZWN0Iiwib3B0aW9uX3ZhbHVlIiwib3B0aW9uIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmaW5kIiwiY2FsbCIsIm9wdGlvbnMiLCJjYW5kaWRhdGUiLCJ2YWx1ZSIsInRleHRDb250ZW50IiwiZ2V0X3Nsb3RfbGFiZWwiLCJzbG90Iiwic3RhcnRfc2VsZWN0IiwiZW5kX3NlbGVjdCIsInN0YXJ0X3RpbWUiLCJlbmRfdGltZSIsInN5bmNfZml4ZWRfc2xvdHNfZHJhZnQiLCJ0cmFuc3BvcnQiLCJKU09OIiwic3RyaW5naWZ5IiwidGltZV9zbG90cyIsInNsb3RzIiwiZ2V0X3Nsb3RfY29udHJvbCIsInNsb3RfaW5kZXgiLCJsaXN0IiwicXVlcnlTZWxlY3RvciIsImZvY3VzX3Nsb3RfY29udHJvbCIsImNvbnRyb2xfbmFtZSIsInNsb3RfY29udHJvbCIsInRhcmdldCIsImFkZF9idXR0b24iLCJmb2N1cyIsInJlbmRlcl9zbG90cyIsInJlbW92ZUF0dHJpYnV0ZSIsImxlbmd0aCIsInNldEF0dHJpYnV0ZSIsImZvckVhY2giLCJ0ZW1wbGF0ZSIsImNvbnRlbnQiLCJmaXJzdEVsZW1lbnRDaGlsZCIsImNsb25lTm9kZSIsInN0YXJ0X2xhYmVsIiwiZW5kX2xhYmVsIiwibW92ZV9idXR0b24iLCJyZW1vdmVfYnV0dG9uIiwic3RhcnRfaWQiLCJlbmRfaWQiLCJzbG90X2xhYmVsIiwiZGF0YXNldCIsImZpeGVkU2xvdEluZGV4IiwiaWQiLCJodG1sRm9yIiwibGlzdF9sYWJlbCIsInJlcGxhY2UiLCJhcHBlbmRDaGlsZCIsImRpc2FibGVkIiwibWF4X3RpbWVfc2xvdHMiLCJjbGVhcl9idXR0b24iLCJzZXRfc2xvdF9lcnJvciIsIm1lc3NhZ2UiLCJzZXRfZmllbGRfZXJyb3IiLCJnZW5lcmF0ZV9zbG90cyIsImZyb21fbWludXRlcyIsImdlbmVyYXRvcl9mcm9tIiwidG9fbWludXRlcyIsImdlbmVyYXRvcl90byIsInNwYWNpbmdfbWludXRlcyIsImdlbmVyYXRvcl9pbnRlcnZhbCIsImR1cmF0aW9uX21pbnV0ZXMiLCJnZW5lcmF0b3JfZHVyYXRpb24iLCJnZW5lcmF0ZWRfc2xvdHMiLCJzdGFydF9taW51dGVzIiwiaXNGaW5pdGUiLCJ0aW1lX2luY3JlbWVudCIsInNldF9zdGF0dXMiLCJwdXNoIiwiY2xlYXJfZmllbGRfZXJyb3IiLCJoYXNfc2xvdCIsInNvbWUiLCJmaW5kX3Nsb3RfcHJvcG9zYWwiLCJwcmVmZXJyZWRfc3RhcnQiLCJwcmVmZXJyZWRfaW5kZXgiLCJzdGFydF92YWx1ZXMiLCJpbmRleE9mIiwib2Zmc2V0IiwiZW5kX21pbnV0ZXMiLCJlbmRfdmFsdWVzIiwiYWRkX3Nsb3QiLCJwcm9wb3NhbCIsImNsZWFyX3Nsb3RzIiwibW92ZV9zbG90Iiwic291cmNlX2luZGV4IiwidGFyZ2V0X2luZGV4IiwibW92ZWRfc2xvdCIsInNwbGljZSIsImluaXRpYWxpemVfc29ydGFibGUiLCJTb3J0YWJsZSIsInNvcnRhYmxlIiwiYW5pbWF0aW9uIiwiZHJhZ2dhYmxlIiwiaGFuZGxlIiwiZ2hvc3RDbGFzcyIsImNob3NlbkNsYXNzIiwiZHJhZ0NsYXNzIiwib25FbmQiLCJldmVudCIsIk51bWJlciIsIm9sZEluZGV4IiwibmV3SW5kZXgiLCJpc0ludGVnZXIiLCJoYW5kbGVfY2xpY2siLCJjbG9zZXN0IiwicHJldmVudERlZmF1bHQiLCJtaW4iLCJoYW5kbGVfY2hhbmdlIiwibWF0Y2hlcyIsImhhbmRsZV9rZXlkb3duIiwiaW5jbHVkZXMiLCJpbml0aWFsaXplIiwicmVnaXN0ZXJlZF9zaGVsbF9hcGkiLCJlZGl0b3Jfbm9kZSIsInBhcnNlZF92YWx1ZXMiLCJ0ZW1wbGF0ZV9zdGFydCIsInRlbXBsYXRlX2VuZCIsInJvb3QiLCJwYXJzZSIsInBhcnNlX2Vycm9yIiwibm9kZSIsImZpZWxkSWQiLCJpc0FycmF5Iiwic2xpY2UiLCJtYXhUaW1lU2xvdHMiLCJ0aW1lSW5jcmVtZW50IiwibGlzdExhYmVsIiwibWFwIiwiYWRkRXZlbnRMaXN0ZW5lciIsInZhbGlkYXRlIiwiZmlyc3RfaW52YWxpZCIsInNlZW5fc2xvdHMiLCJxdWVyeVNlbGVjdG9yQWxsIiwiY29udHJvbCIsInNsb3Rfa2V5IiwiT2JqZWN0IiwiaGFzT3duUHJvcGVydHkiLCJzeW5jIiwid3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyIsImNyZWF0ZSIsIndwYmNfc2V0dXBfd2l6YXJkX2FwaSIsInJlZ2lzdGVyX3N0ZXBfYWRhcHRlciJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2Utc2V0dXAtd2l6YXJkL3N0ZXAtZml4ZWQtdGltZS1zbG90cy9fc3JjL3N0ZXAtZml4ZWQtdGltZS1zbG90cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZpeGVkIFRpbWUgU2xvdHMgZWRpdG9yIGFkYXB0ZXIgZm9yIHRoZSBTZXR1cCBXaXphcmQuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICovXG4oIGZ1bmN0aW9uICggd2luZG93ICkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0dmFyIGNvbmZpZyA9IHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9maXhlZF90aW1lX3Nsb3RzIHx8IHsgaTE4bjoge30gfTtcblx0dmFyIG1vZHVsZV9jb25maWcgPSB7XG5cdFx0bW9kdWxlX2lkOiBjb25maWcubW9kdWxlX2lkIHx8ICdmaXhlZF90aW1lX3Nsb3RzJyxcblx0XHRmaWVsZF9pZDogY29uZmlnLmZpZWxkX2lkIHx8ICdmaXhlZF90aW1lX3Nsb3RzJ1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgb25lIGZpeGVkLXNsb3QgZWRpdG9yIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBydW50aW1lX2NvbmZpZyBTZXJ2ZXItb3duZWQgbW9kdWxlIGNvbmZpZ3VyYXRpb24uXG5cdCAqIEByZXR1cm4ge09iamVjdH0gU2V0dXAgV2l6YXJkIHN0ZXAgYWRhcHRlci5cblx0ICovXG5cdGZ1bmN0aW9uIGNyZWF0ZV9maXhlZF90aW1lX3Nsb3RzX2FkYXB0ZXIoIHJ1bnRpbWVfY29uZmlnICkge1xuXHRcdHZhciBzaGVsbF9hcGkgPSBudWxsO1xuXHRcdHZhciBlZGl0b3IgPSBudWxsO1xuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSBsb2NhbGl6ZWQgbWVzc2FnZSB3aXRoIGEgc2FmZSBmYWxsYmFjay5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgTWVzc2FnZSBrZXkuXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZhbGxiYWNrIEZhbGxiYWNrIHRleHQuXG5cdFx0ICogQHJldHVybiB7c3RyaW5nfSBNZXNzYWdlIHRleHQuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X21lc3NhZ2UoIGtleSwgZmFsbGJhY2sgKSB7XG5cdFx0XHRyZXR1cm4gY29uZmlnLmkxOG4gJiYgY29uZmlnLmkxOG5bIGtleSBdID8gY29uZmlnLmkxOG5bIGtleSBdIDogZmFsbGJhY2s7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBvbmUgZXhhY3QgY2xvY2sgdmFsdWUgdG8gbWludXRlcyBhZnRlciBkYXkgc3RhcnQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdGltZV92YWx1ZSBDbG9jayB2YWx1ZS5cblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGFsbG93X2RheV9lbmQgV2hldGhlciBgMjQ6MDBgIGlzIGFjY2VwdGVkLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBNaW51dGUgY291bnQgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0aW1lX3RvX21pbnV0ZXMoIHRpbWVfdmFsdWUsIGFsbG93X2RheV9lbmQgKSB7XG5cdFx0XHR2YXIgbWF0Y2g7XG5cblx0XHRcdGlmICggYWxsb3dfZGF5X2VuZCAmJiAnMjQ6MDAnID09PSB0aW1lX3ZhbHVlICkge1xuXHRcdFx0XHRyZXR1cm4gMjQgKiA2MDtcblx0XHRcdH1cblx0XHRcdG1hdGNoID0gL14oPzpbMDFdXFxkfDJbMC0zXSk6WzAtNV1cXGQkLy5leGVjKCBTdHJpbmcoIHRpbWVfdmFsdWUgfHwgJycgKSApO1xuXHRcdFx0aWYgKCAhIG1hdGNoICkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuICggcGFyc2VJbnQoIHRpbWVfdmFsdWUuc3Vic3RyKCAwLCAyICksIDEwICkgKiA2MCApICsgcGFyc2VJbnQoIHRpbWVfdmFsdWUuc3Vic3RyKCAzLCAyICksIDEwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBib3VuZGVkIG1pbnV0ZSBjb3VudCB0byBgSEg6TU1gLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IG1pbnV0ZXMgTWludXRlcyBmcm9tIGRheSBzdGFydC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IENsb2NrIHZhbHVlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1pbnV0ZXNfdG9fdGltZSggbWludXRlcyApIHtcblx0XHRcdHZhciBob3VyID0gTWF0aC5mbG9vciggbWludXRlcyAvIDYwICk7XG5cdFx0XHR2YXIgbWludXRlID0gbWludXRlcyAlIDYwO1xuXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBob3VyICkucGFkU3RhcnQoIDIsICcwJyApICsgJzonICsgU3RyaW5nKCBtaW51dGUgKS5wYWRTdGFydCggMiwgJzAnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgc2VsZWN0IG9wdGlvbiBsYWJlbCBmb3Igb25lIHZhbHVlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtIVE1MU2VsZWN0RWxlbWVudH0gc2VsZWN0IFNlbGVjdCBjb250cm9sLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25fdmFsdWUgT3B0aW9uIHZhbHVlLlxuXHRcdCAqIEByZXR1cm4ge3N0cmluZ30gVmlzaWJsZSBsYWJlbCBvciB2YWx1ZS5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfb3B0aW9uX2xhYmVsKCBzZWxlY3QsIG9wdGlvbl92YWx1ZSApIHtcblx0XHRcdHZhciBvcHRpb24gPSBBcnJheS5wcm90b3R5cGUuZmluZC5jYWxsKCBzZWxlY3Qub3B0aW9ucywgZnVuY3Rpb24gKCBjYW5kaWRhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBjYW5kaWRhdGUudmFsdWUgPT09IG9wdGlvbl92YWx1ZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIG9wdGlvbiA/IG9wdGlvbi50ZXh0Q29udGVudCA6IG9wdGlvbl92YWx1ZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSBodW1hbi1yZWFkYWJsZSBsYWJlbCBmb3Igb25lIHNsb3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gc2xvdCBTbG90IERUTy5cblx0XHQgKiBAcGFyYW0ge0hUTUxTZWxlY3RFbGVtZW50fSBzdGFydF9zZWxlY3QgU3RhcnQgc2VsZWN0LlxuXHRcdCAqIEBwYXJhbSB7SFRNTFNlbGVjdEVsZW1lbnR9IGVuZF9zZWxlY3QgRW5kIHNlbGVjdC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFNsb3QgbGFiZWwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0X3Nsb3RfbGFiZWwoIHNsb3QsIHN0YXJ0X3NlbGVjdCwgZW5kX3NlbGVjdCApIHtcblx0XHRcdHJldHVybiBnZXRfb3B0aW9uX2xhYmVsKCBzdGFydF9zZWxlY3QsIHNsb3Quc3RhcnRfdGltZSApICsgJyAtICcgKyBnZXRfb3B0aW9uX2xhYmVsKCBlbmRfc2VsZWN0LCBzbG90LmVuZF90aW1lICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU3luY2hyb25pemUgdGhlIEpTT04gdHJhbnNwb3J0IHdpdGggY3VycmVudCBvcmRlcmVkIHNsb3RzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX2ZpeGVkX3Nsb3RzX2RyYWZ0KCkge1xuXHRcdFx0aWYgKCBlZGl0b3IgKSB7XG5cdFx0XHRcdGVkaXRvci50cmFuc3BvcnQudmFsdWUgPSBKU09OLnN0cmluZ2lmeSggeyB0aW1lX3Nsb3RzOiBlZGl0b3Iuc2xvdHMgfSApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgcmVuZGVyZWQgc2xvdCBjb250cm9sIGJ5IGluZGV4LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHNsb3RfaW5kZXggU2xvdCBpbmRleC5cblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBTbG90IGVsZW1lbnQgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRfc2xvdF9jb250cm9sKCBzbG90X2luZGV4ICkge1xuXHRcdFx0cmV0dXJuIGVkaXRvciA/IGVkaXRvci5saXN0LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS1maXhlZC1zbG90LWluZGV4PVwiJyArIHNsb3RfaW5kZXggKyAnXCJdJyApIDogbnVsbDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb2N1cyB0aGUgcHJlZmVycmVkIGNvbnRyb2wgYWZ0ZXIgcmVuZGVyaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHNsb3RfaW5kZXggU2xvdCBpbmRleC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY29udHJvbF9uYW1lIENvbnRyb2wgZGF0YSBzdWZmaXguXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmb2N1c19zbG90X2NvbnRyb2woIHNsb3RfaW5kZXgsIGNvbnRyb2xfbmFtZSApIHtcblx0XHRcdHZhciBzbG90X2NvbnRyb2wgPSBnZXRfc2xvdF9jb250cm9sKCBzbG90X2luZGV4ICk7XG5cdFx0XHR2YXIgdGFyZ2V0ID0gc2xvdF9jb250cm9sID8gc2xvdF9jb250cm9sLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLScgKyBjb250cm9sX25hbWUgKyAnXScgKSA6IGVkaXRvci5hZGRfYnV0dG9uO1xuXG5cdFx0XHRpZiAoIHRhcmdldCApIHtcblx0XHRcdFx0dGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIHRoZSBjb21wbGV0ZSBvcmRlcmVkIHNsb3QgbGlzdCBmcm9tIGRhdGEtb25seSBzdGF0ZS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX3Nsb3RzKCkge1xuXHRcdFx0ZWRpdG9yLmxpc3QudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdGVkaXRvci5hZGRfYnV0dG9uLnJlbW92ZUF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zZXR1cC13aXphcmQtZXJyb3ItY29udHJvbC1mb3InICk7XG5cdFx0XHRpZiAoICEgZWRpdG9yLnNsb3RzLmxlbmd0aCApIHtcblx0XHRcdFx0ZWRpdG9yLmFkZF9idXR0b24uc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNldHVwLXdpemFyZC1lcnJvci1jb250cm9sLWZvcicsIGVkaXRvci5maWVsZF9pZCApO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iuc2xvdHMuZm9yRWFjaCggZnVuY3Rpb24gKCBzbG90LCBzbG90X2luZGV4ICkge1xuXHRcdFx0XHR2YXIgc2xvdF9jb250cm9sID0gZWRpdG9yLnRlbXBsYXRlLmNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQuY2xvbmVOb2RlKCB0cnVlICk7XG5cdFx0XHRcdHZhciBzdGFydF9zZWxlY3QgPSBzbG90X2NvbnRyb2wucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZml4ZWQtc2xvdC1zdGFydF0nICk7XG5cdFx0XHRcdHZhciBlbmRfc2VsZWN0ID0gc2xvdF9jb250cm9sLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWZpeGVkLXNsb3QtZW5kXScgKTtcblx0XHRcdFx0dmFyIHN0YXJ0X2xhYmVsID0gc2xvdF9jb250cm9sLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWZpeGVkLXNsb3Qtc3RhcnQtbGFiZWxdJyApO1xuXHRcdFx0XHR2YXIgZW5kX2xhYmVsID0gc2xvdF9jb250cm9sLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWZpeGVkLXNsb3QtZW5kLWxhYmVsXScgKTtcblx0XHRcdFx0dmFyIG1vdmVfYnV0dG9uID0gc2xvdF9jb250cm9sLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLW1vdmUtZml4ZWQtc2xvdF0nICk7XG5cdFx0XHRcdHZhciByZW1vdmVfYnV0dG9uID0gc2xvdF9jb250cm9sLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXJlbW92ZS1maXhlZC1zbG90XScgKTtcblx0XHRcdFx0dmFyIHN0YXJ0X2lkID0gJ3dwYmMtZml4ZWQtdGltZS1zbG90LXN0YXJ0LScgKyBzbG90X2luZGV4O1xuXHRcdFx0XHR2YXIgZW5kX2lkID0gJ3dwYmMtZml4ZWQtdGltZS1zbG90LWVuZC0nICsgc2xvdF9pbmRleDtcblx0XHRcdFx0dmFyIHNsb3RfbGFiZWw7XG5cblx0XHRcdFx0c2xvdF9jb250cm9sLmRhdGFzZXQuZml4ZWRTbG90SW5kZXggPSBTdHJpbmcoIHNsb3RfaW5kZXggKTtcblx0XHRcdFx0c3RhcnRfc2VsZWN0LmlkID0gc3RhcnRfaWQ7XG5cdFx0XHRcdGVuZF9zZWxlY3QuaWQgPSBlbmRfaWQ7XG5cdFx0XHRcdHN0YXJ0X3NlbGVjdC52YWx1ZSA9IHNsb3Quc3RhcnRfdGltZTtcblx0XHRcdFx0ZW5kX3NlbGVjdC52YWx1ZSA9IHNsb3QuZW5kX3RpbWU7XG5cdFx0XHRcdHN0YXJ0X2xhYmVsLmh0bWxGb3IgPSBzdGFydF9pZDtcblx0XHRcdFx0ZW5kX2xhYmVsLmh0bWxGb3IgPSBlbmRfaWQ7XG5cdFx0XHRcdGlmICggMCA9PT0gc2xvdF9pbmRleCApIHtcblx0XHRcdFx0XHRzdGFydF9zZWxlY3Quc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNldHVwLXdpemFyZC1lcnJvci1jb250cm9sLWZvcicsIGVkaXRvci5maWVsZF9pZCApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c2xvdF9sYWJlbCA9IGdldF9zbG90X2xhYmVsKCBzbG90LCBzdGFydF9zZWxlY3QsIGVuZF9zZWxlY3QgKTtcblx0XHRcdFx0c3RhcnRfbGFiZWwudGV4dENvbnRlbnQgPSBlZGl0b3IubGlzdF9sYWJlbCArICcgJyArICggc2xvdF9pbmRleCArIDEgKSArICc6IHN0YXJ0Jztcblx0XHRcdFx0ZW5kX2xhYmVsLnRleHRDb250ZW50ID0gZWRpdG9yLmxpc3RfbGFiZWwgKyAnICcgKyAoIHNsb3RfaW5kZXggKyAxICkgKyAnOiBlbmQnO1xuXHRcdFx0XHRtb3ZlX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJywgZ2V0X21lc3NhZ2UoICdtb3ZlX3Nsb3QnLCAnTW92ZSBmaXhlZCB0aW1lIHNsb3QgJXMnICkucmVwbGFjZSggJyVzJywgc2xvdF9sYWJlbCApICk7XG5cdFx0XHRcdHJlbW92ZV9idXR0b24uc2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbCcsIGdldF9tZXNzYWdlKCAncmVtb3ZlX3Nsb3QnLCAnUmVtb3ZlIGZpeGVkIHRpbWUgc2xvdCAlcycgKS5yZXBsYWNlKCAnJXMnLCBzbG90X2xhYmVsICkgKTtcblx0XHRcdFx0ZWRpdG9yLmxpc3QuYXBwZW5kQ2hpbGQoIHNsb3RfY29udHJvbCApO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRlZGl0b3IuYWRkX2J1dHRvbi5kaXNhYmxlZCA9IGVkaXRvci5zbG90cy5sZW5ndGggPj0gZWRpdG9yLm1heF90aW1lX3Nsb3RzO1xuXHRcdFx0ZWRpdG9yLmNsZWFyX2J1dHRvbi5kaXNhYmxlZCA9ICEgZWRpdG9yLnNsb3RzLmxlbmd0aDtcblx0XHRcdHN5bmNfZml4ZWRfc2xvdHNfZHJhZnQoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNYXJrIG9uZSBzbG90IGNvbnRyb2wgaW52YWxpZCBhbmQgcmV0dXJuIHRoZSBmb2N1cyB0YXJnZXQuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBWYWxpZGF0aW9uIG1lc3NhZ2UuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHNsb3RfaW5kZXggU2xvdCBpbmRleC5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gY29udHJvbF9uYW1lIEVpdGhlciBzdGFydCBvciBlbmQgY29udHJvbCBzdWZmaXguXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gSW52YWxpZCBjb250cm9sIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gc2V0X3Nsb3RfZXJyb3IoIG1lc3NhZ2UsIHNsb3RfaW5kZXgsIGNvbnRyb2xfbmFtZSApIHtcblx0XHRcdHZhciBzbG90X2NvbnRyb2wgPSBnZXRfc2xvdF9jb250cm9sKCBzbG90X2luZGV4ICk7XG5cdFx0XHR2YXIgdGFyZ2V0ID0gc2xvdF9jb250cm9sID8gc2xvdF9jb250cm9sLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWZpeGVkLXNsb3QtJyArIGNvbnRyb2xfbmFtZSArICddJyApIDogZWRpdG9yLmFkZF9idXR0b247XG5cblx0XHRcdHNoZWxsX2FwaS5zZXRfZmllbGRfZXJyb3IoIGVkaXRvci5maWVsZF9pZCwgbWVzc2FnZSApO1xuXHRcdFx0aWYgKCB0YXJnZXQgKSB7XG5cdFx0XHRcdHRhcmdldC5zZXRBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnLCAndHJ1ZScgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRhcmdldDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBHZW5lcmF0ZSBvcmRlcmVkIGZpeGVkIHNsb3RzIGZyb20gaW5kZXBlbmRlbnQgc3BhY2luZyBhbmQgZHVyYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdlbmVyYXRlX3Nsb3RzKCkge1xuXHRcdFx0dmFyIGZyb21fbWludXRlcyA9IHRpbWVfdG9fbWludXRlcyggZWRpdG9yLmdlbmVyYXRvcl9mcm9tLnZhbHVlLCBmYWxzZSApO1xuXHRcdFx0dmFyIHRvX21pbnV0ZXMgPSB0aW1lX3RvX21pbnV0ZXMoIGVkaXRvci5nZW5lcmF0b3JfdG8udmFsdWUsIGZhbHNlICk7XG5cdFx0XHR2YXIgc3BhY2luZ19taW51dGVzID0gcGFyc2VJbnQoIGVkaXRvci5nZW5lcmF0b3JfaW50ZXJ2YWwudmFsdWUsIDEwICk7XG5cdFx0XHR2YXIgZHVyYXRpb25fbWludXRlcyA9IHBhcnNlSW50KCBlZGl0b3IuZ2VuZXJhdG9yX2R1cmF0aW9uLnZhbHVlLCAxMCApO1xuXHRcdFx0dmFyIGdlbmVyYXRlZF9zbG90cyA9IFtdO1xuXHRcdFx0dmFyIHN0YXJ0X21pbnV0ZXM7XG5cblx0XHRcdGVkaXRvci5nZW5lcmF0b3JfdG8ucmVtb3ZlQXR0cmlidXRlKCAnYXJpYS1pbnZhbGlkJyApO1xuXHRcdFx0ZWRpdG9yLmdlbmVyYXRvcl9kdXJhdGlvbi5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnICk7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdG51bGwgPT09IGZyb21fbWludXRlc1xuXHRcdFx0XHR8fCBudWxsID09PSB0b19taW51dGVzXG5cdFx0XHRcdHx8IHRvX21pbnV0ZXMgPCBmcm9tX21pbnV0ZXNcblx0XHRcdFx0fHwgISBpc0Zpbml0ZSggc3BhY2luZ19taW51dGVzIClcblx0XHRcdFx0fHwgISBpc0Zpbml0ZSggZHVyYXRpb25fbWludXRlcyApXG5cdFx0XHRcdHx8IHNwYWNpbmdfbWludXRlcyA8IGVkaXRvci50aW1lX2luY3JlbWVudFxuXHRcdFx0XHR8fCBkdXJhdGlvbl9taW51dGVzIDwgZWRpdG9yLnRpbWVfaW5jcmVtZW50XG5cdFx0XHRcdHx8IDAgIT09IHNwYWNpbmdfbWludXRlcyAlIGVkaXRvci50aW1lX2luY3JlbWVudFxuXHRcdFx0XHR8fCAwICE9PSBkdXJhdGlvbl9taW51dGVzICUgZWRpdG9yLnRpbWVfaW5jcmVtZW50XG5cdFx0XHQpIHtcblx0XHRcdFx0ZWRpdG9yLmdlbmVyYXRvcl90by5zZXRBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnLCAndHJ1ZScgKTtcblx0XHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGdldF9tZXNzYWdlKCAnZ2VuZXJhdG9yX2ludmFsaWQnLCAnQ2hvb3NlIGEgdmFsaWQgZmlyc3Qgc3RhcnQsIGxhc3Qgc3RhcnQsIHNwYWNpbmcsIGFuZCBkdXJhdGlvbi4nICkgKTtcblx0XHRcdFx0ZWRpdG9yLmdlbmVyYXRvcl90by5mb2N1cygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggdG9fbWludXRlcyArIGR1cmF0aW9uX21pbnV0ZXMgPiAyNCAqIDYwICkge1xuXHRcdFx0XHRlZGl0b3IuZ2VuZXJhdG9yX2R1cmF0aW9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcsICd0cnVlJyApO1xuXHRcdFx0XHRzaGVsbF9hcGkuc2V0X3N0YXR1cyggZ2V0X21lc3NhZ2UoICdnZW5lcmF0b3JfZGF5X292ZXJmbG93JywgJ1RoZSBnZW5lcmF0ZWQgc2xvdCBkdXJhdGlvbiBtdXN0IGZpbmlzaCBieSB0aGUgZW5kIG9mIHRoZSBkYXkuJyApICk7XG5cdFx0XHRcdGVkaXRvci5nZW5lcmF0b3JfZHVyYXRpb24uZm9jdXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKCBzdGFydF9taW51dGVzID0gZnJvbV9taW51dGVzOyBzdGFydF9taW51dGVzIDw9IHRvX21pbnV0ZXMgJiYgZ2VuZXJhdGVkX3Nsb3RzLmxlbmd0aCA8IGVkaXRvci5tYXhfdGltZV9zbG90czsgc3RhcnRfbWludXRlcyArPSBzcGFjaW5nX21pbnV0ZXMgKSB7XG5cdFx0XHRcdGdlbmVyYXRlZF9zbG90cy5wdXNoKCB7XG5cdFx0XHRcdFx0c3RhcnRfdGltZTogbWludXRlc190b190aW1lKCBzdGFydF9taW51dGVzICksXG5cdFx0XHRcdFx0ZW5kX3RpbWU6IG1pbnV0ZXNfdG9fdGltZSggc3RhcnRfbWludXRlcyArIGR1cmF0aW9uX21pbnV0ZXMgKVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5zbG90cyA9IGdlbmVyYXRlZF9zbG90cztcblx0XHRcdHJlbmRlcl9zbG90cygpO1xuXHRcdFx0Zm9jdXNfc2xvdF9jb250cm9sKCAwLCAnZml4ZWQtc2xvdC1zdGFydCcgKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRGV0ZXJtaW5lIHdoZXRoZXIgb25lIHNsb3QgYWxyZWFkeSBleGlzdHMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc3RhcnRfdGltZSBTdGFydCB0aW1lLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBlbmRfdGltZSBFbmQgdGltZS5cblx0XHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGV4YWN0IHJhbmdlIGV4aXN0cy5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYXNfc2xvdCggc3RhcnRfdGltZSwgZW5kX3RpbWUgKSB7XG5cdFx0XHRyZXR1cm4gZWRpdG9yLnNsb3RzLnNvbWUoIGZ1bmN0aW9uICggc2xvdCApIHtcblx0XHRcdFx0cmV0dXJuIHNsb3Quc3RhcnRfdGltZSA9PT0gc3RhcnRfdGltZSAmJiBzbG90LmVuZF90aW1lID09PSBlbmRfdGltZTtcblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5kIGEgdmFsaWQgdW51c2VkIHNsb3QgcHJvcG9zYWwgdXNpbmcgY3VycmVudCBnZW5lcmF0b3IgZHVyYXRpb24uXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gUHJvcG9zZWQgc2xvdCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZpbmRfc2xvdF9wcm9wb3NhbCgpIHtcblx0XHRcdHZhciBkdXJhdGlvbl9taW51dGVzID0gcGFyc2VJbnQoIGVkaXRvci5nZW5lcmF0b3JfZHVyYXRpb24udmFsdWUsIDEwICk7XG5cdFx0XHR2YXIgcHJlZmVycmVkX3N0YXJ0ID0gZWRpdG9yLnNsb3RzLmxlbmd0aCA/IGVkaXRvci5zbG90c1sgZWRpdG9yLnNsb3RzLmxlbmd0aCAtIDEgXS5lbmRfdGltZSA6IGVkaXRvci5nZW5lcmF0b3JfZnJvbS52YWx1ZTtcblx0XHRcdHZhciBwcmVmZXJyZWRfaW5kZXggPSBlZGl0b3Iuc3RhcnRfdmFsdWVzLmluZGV4T2YoIHByZWZlcnJlZF9zdGFydCApO1xuXHRcdFx0dmFyIG9mZnNldDtcblxuXHRcdFx0aWYgKCAhIGlzRmluaXRlKCBkdXJhdGlvbl9taW51dGVzICkgfHwgZHVyYXRpb25fbWludXRlcyA8IGVkaXRvci50aW1lX2luY3JlbWVudCApIHtcblx0XHRcdFx0ZHVyYXRpb25fbWludXRlcyA9IDMwO1xuXHRcdFx0fVxuXHRcdFx0cHJlZmVycmVkX2luZGV4ID0gLTEgPT09IHByZWZlcnJlZF9pbmRleCA/IDAgOiBwcmVmZXJyZWRfaW5kZXg7XG5cblx0XHRcdGZvciAoIG9mZnNldCA9IDA7IG9mZnNldCA8IGVkaXRvci5zdGFydF92YWx1ZXMubGVuZ3RoOyBvZmZzZXQgKz0gMSApIHtcblx0XHRcdFx0dmFyIHN0YXJ0X3RpbWUgPSBlZGl0b3Iuc3RhcnRfdmFsdWVzWyAoIHByZWZlcnJlZF9pbmRleCArIG9mZnNldCApICUgZWRpdG9yLnN0YXJ0X3ZhbHVlcy5sZW5ndGggXTtcblx0XHRcdFx0dmFyIHN0YXJ0X21pbnV0ZXMgPSB0aW1lX3RvX21pbnV0ZXMoIHN0YXJ0X3RpbWUsIGZhbHNlICk7XG5cdFx0XHRcdHZhciBlbmRfbWludXRlcyA9IHN0YXJ0X21pbnV0ZXMgKyBkdXJhdGlvbl9taW51dGVzO1xuXHRcdFx0XHR2YXIgZW5kX3RpbWUgPSBtaW51dGVzX3RvX3RpbWUoIGVuZF9taW51dGVzICk7XG5cblx0XHRcdFx0aWYgKCBlbmRfbWludXRlcyA8PSAyNCAqIDYwICYmIC0xICE9PSBlZGl0b3IuZW5kX3ZhbHVlcy5pbmRleE9mKCBlbmRfdGltZSApICYmICEgaGFzX3Nsb3QoIHN0YXJ0X3RpbWUsIGVuZF90aW1lICkgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc3RhcnRfdGltZTogc3RhcnRfdGltZSwgZW5kX3RpbWU6IGVuZF90aW1lIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWRkIG9uZSB2YWxpZCB1bnVzZWQgZml4ZWQgc2xvdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWRkX3Nsb3QoKSB7XG5cdFx0XHR2YXIgcHJvcG9zYWw7XG5cblx0XHRcdGlmICggZWRpdG9yLnNsb3RzLmxlbmd0aCA+PSBlZGl0b3IubWF4X3RpbWVfc2xvdHMgKSB7XG5cdFx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCBnZXRfbWVzc2FnZSggJ3Nsb3RfbGltaXQnLCAnTm8gYWRkaXRpb25hbCBmaXhlZCB0aW1lIHNsb3QgY2FuIGJlIGFkZGVkLicgKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHByb3Bvc2FsID0gZmluZF9zbG90X3Byb3Bvc2FsKCk7XG5cdFx0XHRpZiAoICEgcHJvcG9zYWwgKSB7XG5cdFx0XHRcdHNoZWxsX2FwaS5zZXRfc3RhdHVzKCBnZXRfbWVzc2FnZSggJ3Nsb3RfbGltaXQnLCAnTm8gYWRkaXRpb25hbCBmaXhlZCB0aW1lIHNsb3QgY2FuIGJlIGFkZGVkLicgKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5zbG90cy5wdXNoKCBwcm9wb3NhbCApO1xuXHRcdFx0cmVuZGVyX3Nsb3RzKCk7XG5cdFx0XHRmb2N1c19zbG90X2NvbnRyb2woIGVkaXRvci5zbG90cy5sZW5ndGggLSAxLCAnZml4ZWQtc2xvdC1zdGFydCcgKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ2xlYXIgZXZlcnkgc2xvdCB3aGlsZSBwcmVzZXJ2aW5nIGtleWJvYXJkIGZvY3VzIGluIHRoZSBhY3Rpb24gYXJlYS5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfc2xvdHMoKSB7XG5cdFx0XHRpZiAoICEgZWRpdG9yLnNsb3RzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iuc2xvdHMgPSBbXTtcblx0XHRcdHJlbmRlcl9zbG90cygpO1xuXHRcdFx0ZWRpdG9yLmFkZF9idXR0b24uZm9jdXMoKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0XHRzaGVsbF9hcGkuc2V0X3N0YXR1cyggZ2V0X21lc3NhZ2UoICdzbG90c19jbGVhcmVkJywgJ0ZpeGVkIHRpbWUgc2xvdHMgY2xlYXJlZC4nICkgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBNb3ZlIG9uZSBzbG90IHdpdGhpbiB0aGUgb3JkZXJlZCBsaXN0LlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IHNvdXJjZV9pbmRleCBDdXJyZW50IGluZGV4LlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB0YXJnZXRfaW5kZXggVGFyZ2V0IGluZGV4LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbW92ZV9zbG90KCBzb3VyY2VfaW5kZXgsIHRhcmdldF9pbmRleCApIHtcblx0XHRcdHZhciBtb3ZlZF9zbG90O1xuXG5cdFx0XHRpZiAoIHNvdXJjZV9pbmRleCA9PT0gdGFyZ2V0X2luZGV4IHx8IHNvdXJjZV9pbmRleCA8IDAgfHwgdGFyZ2V0X2luZGV4IDwgMCB8fCBzb3VyY2VfaW5kZXggPj0gZWRpdG9yLnNsb3RzLmxlbmd0aCB8fCB0YXJnZXRfaW5kZXggPj0gZWRpdG9yLnNsb3RzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRtb3ZlZF9zbG90ID0gZWRpdG9yLnNsb3RzLnNwbGljZSggc291cmNlX2luZGV4LCAxIClbIDAgXTtcblx0XHRcdGVkaXRvci5zbG90cy5zcGxpY2UoIHRhcmdldF9pbmRleCwgMCwgbW92ZWRfc2xvdCApO1xuXHRcdFx0cmVuZGVyX3Nsb3RzKCk7XG5cdFx0XHRmb2N1c19zbG90X2NvbnRyb2woIHRhcmdldF9pbmRleCwgJ21vdmUtZml4ZWQtc2xvdCcgKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW5pdGlhbGl6ZSBTb3J0YWJsZUpTIGZvciB0aGUgZml4ZWQtc2xvdCBsaXN0LlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX3NvcnRhYmxlKCkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LlNvcnRhYmxlICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5zb3J0YWJsZSA9IG5ldyB3aW5kb3cuU29ydGFibGUoIGVkaXRvci5saXN0LCB7XG5cdFx0XHRcdGFuaW1hdGlvbjogMTIwLFxuXHRcdFx0XHRkcmFnZ2FibGU6ICdbZGF0YS1maXhlZC1zbG90LWluZGV4XScsXG5cdFx0XHRcdGhhbmRsZTogJ1tkYXRhLXdwYmMtbW92ZS1maXhlZC1zbG90XScsXG5cdFx0XHRcdGdob3N0Q2xhc3M6ICdpcy1kcmFnLXBsYWNlaG9sZGVyJyxcblx0XHRcdFx0Y2hvc2VuQ2xhc3M6ICdpcy1kcmFnZ2luZycsXG5cdFx0XHRcdGRyYWdDbGFzczogJ2lzLWRyYWdnaW5nJyxcblx0XHRcdFx0b25FbmQ6IGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0XHRcdFx0dmFyIHNvdXJjZV9pbmRleCA9IE51bWJlciggZXZlbnQub2xkSW5kZXggKTtcblx0XHRcdFx0XHR2YXIgdGFyZ2V0X2luZGV4ID0gTnVtYmVyKCBldmVudC5uZXdJbmRleCApO1xuXG5cdFx0XHRcdFx0aWYgKCBOdW1iZXIuaXNJbnRlZ2VyKCBzb3VyY2VfaW5kZXggKSAmJiBOdW1iZXIuaXNJbnRlZ2VyKCB0YXJnZXRfaW5kZXggKSApIHtcblx0XHRcdFx0XHRcdG1vdmVfc2xvdCggc291cmNlX2luZGV4LCB0YXJnZXRfaW5kZXggKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVuZGVyX3Nsb3RzKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSGFuZGxlIGdlbmVyYXRvciwgYWRkLCBjbGVhciwgYW5kIHJlbW92ZSBhY3Rpb25zLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBldmVudCBEZWxlZ2F0ZWQgY2xpY2sgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2xpY2soIGV2ZW50ICkge1xuXHRcdFx0dmFyIHNsb3RfY29udHJvbDtcblx0XHRcdHZhciBzbG90X2luZGV4O1xuXG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1nZW5lcmF0ZS1maXhlZC1zbG90c10nICkgKSB7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGdlbmVyYXRlX3Nsb3RzKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICggZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWFkZC1maXhlZC1zbG90XScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0YWRkX3Nsb3QoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY2xlYXItZml4ZWQtc2xvdHNdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRjbGVhcl9zbG90cygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNsb3RfY29udHJvbCA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtZml4ZWQtc2xvdC1pbmRleF0nICk7XG5cdFx0XHRpZiAoIHNsb3RfY29udHJvbCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtcmVtb3ZlLWZpeGVkLXNsb3RdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRzbG90X2luZGV4ID0gcGFyc2VJbnQoIHNsb3RfY29udHJvbC5kYXRhc2V0LmZpeGVkU2xvdEluZGV4LCAxMCApO1xuXHRcdFx0XHRlZGl0b3Iuc2xvdHMuc3BsaWNlKCBzbG90X2luZGV4LCAxICk7XG5cdFx0XHRcdHJlbmRlcl9zbG90cygpO1xuXHRcdFx0XHRmb2N1c19zbG90X2NvbnRyb2woIE1hdGgubWluKCBzbG90X2luZGV4LCBlZGl0b3Iuc2xvdHMubGVuZ3RoIC0gMSApLCAnZml4ZWQtc2xvdC1zdGFydCcgKTtcblx0XHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCBlZGl0b3IuZmllbGRfaWQgKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBhIGNoYW5nZWQgc3RhcnQgb3IgZW5kIHNlbGVjdC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7RXZlbnR9IGV2ZW50IERlbGVnYXRlZCBjaGFuZ2UgZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfY2hhbmdlKCBldmVudCApIHtcblx0XHRcdHZhciBzbG90X2NvbnRyb2wgPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLWZpeGVkLXNsb3QtaW5kZXhdJyApO1xuXHRcdFx0dmFyIHNsb3RfaW5kZXg7XG5cblx0XHRcdGlmICggISBzbG90X2NvbnRyb2wgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNsb3RfaW5kZXggPSBwYXJzZUludCggc2xvdF9jb250cm9sLmRhdGFzZXQuZml4ZWRTbG90SW5kZXgsIDEwICk7XG5cdFx0XHRpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1maXhlZC1zbG90LXN0YXJ0XScgKSApIHtcblx0XHRcdFx0ZWRpdG9yLnNsb3RzWyBzbG90X2luZGV4IF0uc3RhcnRfdGltZSA9IGV2ZW50LnRhcmdldC52YWx1ZTtcblx0XHRcdH0gZWxzZSBpZiAoIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy1maXhlZC1zbG90LWVuZF0nICkgKSB7XG5cdFx0XHRcdGVkaXRvci5zbG90c1sgc2xvdF9pbmRleCBdLmVuZF90aW1lID0gZXZlbnQudGFyZ2V0LnZhbHVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZW5kZXJfc2xvdHMoKTtcblx0XHRcdGZvY3VzX3Nsb3RfY29udHJvbCggc2xvdF9pbmRleCwgZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLWZpeGVkLXNsb3Qtc3RhcnRdJyApID8gJ2ZpeGVkLXNsb3Qtc3RhcnQnIDogJ2ZpeGVkLXNsb3QtZW5kJyApO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCBlZGl0b3IuZmllbGRfaWQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBQcm92aWRlIGtleWJvYXJkIHJlb3JkZXJpbmcgZXF1aXZhbGVudCB0byBkcmFnIGFuZCBkcm9wLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtLZXlib2FyZEV2ZW50fSBldmVudCBEZWxlZ2F0ZWQga2V5ZG93biBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9rZXlkb3duKCBldmVudCApIHtcblx0XHRcdHZhciBtb3ZlX2J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1tb3ZlLWZpeGVkLXNsb3RdJyApO1xuXHRcdFx0dmFyIHNsb3RfY29udHJvbDtcblx0XHRcdHZhciBzbG90X2luZGV4O1xuXHRcdFx0dmFyIHRhcmdldF9pbmRleDtcblxuXHRcdFx0aWYgKCAhIG1vdmVfYnV0dG9uIHx8ICEgWyAnQXJyb3dMZWZ0JywgJ0Fycm93UmlnaHQnLCAnQXJyb3dVcCcsICdBcnJvd0Rvd24nIF0uaW5jbHVkZXMoIGV2ZW50LmtleSApICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHNsb3RfY29udHJvbCA9IG1vdmVfYnV0dG9uLmNsb3Nlc3QoICdbZGF0YS1maXhlZC1zbG90LWluZGV4XScgKTtcblx0XHRcdHNsb3RfaW5kZXggPSBwYXJzZUludCggc2xvdF9jb250cm9sLmRhdGFzZXQuZml4ZWRTbG90SW5kZXgsIDEwICk7XG5cdFx0XHR0YXJnZXRfaW5kZXggPSBbICdBcnJvd0xlZnQnLCAnQXJyb3dVcCcgXS5pbmNsdWRlcyggZXZlbnQua2V5ICkgPyBzbG90X2luZGV4IC0gMSA6IHNsb3RfaW5kZXggKyAxO1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdG1vdmVfc2xvdCggc2xvdF9pbmRleCwgdGFyZ2V0X2luZGV4ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSW5pdGlhbGl6ZSB0aGlzIG1vZHVsZSBhZ2FpbnN0IHNoZWxsLXByb3ZpZGVkIHNlcnZpY2VzLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IHJlZ2lzdGVyZWRfc2hlbGxfYXBpIFNoYXJlZCB3aXphcmQgYWRhcHRlciBzZXJ2aWNlcy5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGluaXRpYWxpemUoIHJlZ2lzdGVyZWRfc2hlbGxfYXBpICkge1xuXHRcdFx0dmFyIGVkaXRvcl9ub2RlO1xuXHRcdFx0dmFyIHRyYW5zcG9ydDtcblx0XHRcdHZhciBwYXJzZWRfdmFsdWVzO1xuXHRcdFx0dmFyIHRlbXBsYXRlX3N0YXJ0O1xuXHRcdFx0dmFyIHRlbXBsYXRlX2VuZDtcblxuXHRcdFx0c2hlbGxfYXBpID0gcmVnaXN0ZXJlZF9zaGVsbF9hcGk7XG5cdFx0XHRlZGl0b3Jfbm9kZSA9IHNoZWxsX2FwaS5yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWZpeGVkLXNsb3RzLWVkaXRvcl0nICk7XG5cdFx0XHR0cmFuc3BvcnQgPSBzaGVsbF9hcGkucm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1maXhlZC1zbG90cy1kcmFmdF0nICk7XG5cdFx0XHRpZiAoICEgZWRpdG9yX25vZGUgfHwgISB0cmFuc3BvcnQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cGFyc2VkX3ZhbHVlcyA9IEpTT04ucGFyc2UoIHRyYW5zcG9ydC52YWx1ZSB8fCAne30nICk7XG5cdFx0XHR9IGNhdGNoICggcGFyc2VfZXJyb3IgKSB7XG5cdFx0XHRcdHBhcnNlZF92YWx1ZXMgPSB7fTtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yID0ge1xuXHRcdFx0XHRub2RlOiBlZGl0b3Jfbm9kZSxcblx0XHRcdFx0dHJhbnNwb3J0OiB0cmFuc3BvcnQsXG5cdFx0XHRcdGZpZWxkX2lkOiBlZGl0b3Jfbm9kZS5kYXRhc2V0LmZpZWxkSWQgfHwgcnVudGltZV9jb25maWcuZmllbGRfaWQgfHwgJ2ZpeGVkX3RpbWVfc2xvdHMnLFxuXHRcdFx0XHRzbG90czogcGFyc2VkX3ZhbHVlcyAmJiBBcnJheS5pc0FycmF5KCBwYXJzZWRfdmFsdWVzLnRpbWVfc2xvdHMgKSA/IHBhcnNlZF92YWx1ZXMudGltZV9zbG90cy5zbGljZSgpIDogW10sXG5cdFx0XHRcdG1heF90aW1lX3Nsb3RzOiBwYXJzZUludCggdHJhbnNwb3J0LmRhdGFzZXQubWF4VGltZVNsb3RzIHx8IFN0cmluZyggY29uZmlnLm1heF90aW1lX3Nsb3RzIHx8IDI4OCApLCAxMCApLFxuXHRcdFx0XHR0aW1lX2luY3JlbWVudDogcGFyc2VJbnQoIHRyYW5zcG9ydC5kYXRhc2V0LnRpbWVJbmNyZW1lbnQgfHwgU3RyaW5nKCBjb25maWcudGltZV9pbmNyZW1lbnQgfHwgNSApLCAxMCApLFxuXHRcdFx0XHRsaXN0OiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1maXhlZC1zbG90LWxpc3RdJyApLFxuXHRcdFx0XHR0ZW1wbGF0ZTogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZml4ZWQtc2xvdC10ZW1wbGF0ZV0nICksXG5cdFx0XHRcdGFkZF9idXR0b246IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWFkZC1maXhlZC1zbG90XScgKSxcblx0XHRcdFx0Y2xlYXJfYnV0dG9uOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1jbGVhci1maXhlZC1zbG90c10nICksXG5cdFx0XHRcdGdlbmVyYXRvcl9mcm9tOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1maXhlZC1nZW5lcmF0b3ItZnJvbV0nICksXG5cdFx0XHRcdGdlbmVyYXRvcl90bzogZWRpdG9yX25vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZml4ZWQtZ2VuZXJhdG9yLXRvXScgKSxcblx0XHRcdFx0Z2VuZXJhdG9yX2ludGVydmFsOiBlZGl0b3Jfbm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1maXhlZC1nZW5lcmF0b3ItaW50ZXJ2YWxdJyApLFxuXHRcdFx0XHRnZW5lcmF0b3JfZHVyYXRpb246IGVkaXRvcl9ub2RlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWZpeGVkLWdlbmVyYXRvci1kdXJhdGlvbl0nICksXG5cdFx0XHRcdGxpc3RfbGFiZWw6ICcnLFxuXHRcdFx0XHRzdGFydF92YWx1ZXM6IFtdLFxuXHRcdFx0XHRlbmRfdmFsdWVzOiBbXSxcblx0XHRcdFx0c29ydGFibGU6IG51bGxcblx0XHRcdH07XG5cblx0XHRcdGlmICggISBlZGl0b3IubGlzdCB8fCAhIGVkaXRvci50ZW1wbGF0ZSB8fCAhIGVkaXRvci5hZGRfYnV0dG9uIHx8ICEgZWRpdG9yLmNsZWFyX2J1dHRvbiB8fCAhIGVkaXRvci5nZW5lcmF0b3JfZnJvbSB8fCAhIGVkaXRvci5nZW5lcmF0b3JfdG8gfHwgISBlZGl0b3IuZ2VuZXJhdG9yX2ludGVydmFsIHx8ICEgZWRpdG9yLmdlbmVyYXRvcl9kdXJhdGlvbiApIHtcblx0XHRcdFx0ZWRpdG9yID0gbnVsbDtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0ZW1wbGF0ZV9zdGFydCA9IGVkaXRvci50ZW1wbGF0ZS5jb250ZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWZpeGVkLXNsb3Qtc3RhcnRdJyApO1xuXHRcdFx0dGVtcGxhdGVfZW5kID0gZWRpdG9yLnRlbXBsYXRlLmNvbnRlbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtZml4ZWQtc2xvdC1lbmRdJyApO1xuXHRcdFx0aWYgKCAhIHRlbXBsYXRlX3N0YXJ0IHx8ICEgdGVtcGxhdGVfZW5kICkge1xuXHRcdFx0XHRlZGl0b3IgPSBudWxsO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5saXN0X2xhYmVsID0gZWRpdG9yLmxpc3QuZGF0YXNldC5saXN0TGFiZWwgfHwgJ0ZpeGVkIHRpbWUgc2xvdHMnO1xuXHRcdFx0ZWRpdG9yLnN0YXJ0X3ZhbHVlcyA9IEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbCggdGVtcGxhdGVfc3RhcnQub3B0aW9ucywgZnVuY3Rpb24gKCBvcHRpb24gKSB7IHJldHVybiBvcHRpb24udmFsdWU7IH0gKTtcblx0XHRcdGVkaXRvci5lbmRfdmFsdWVzID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKCB0ZW1wbGF0ZV9lbmQub3B0aW9ucywgZnVuY3Rpb24gKCBvcHRpb24gKSB7IHJldHVybiBvcHRpb24udmFsdWU7IH0gKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGhhbmRsZV9jbGljayApO1xuXHRcdFx0ZWRpdG9yLm5vZGUuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIGhhbmRsZV9jaGFuZ2UgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgaGFuZGxlX2tleWRvd24gKTtcblx0XHRcdHJlbmRlcl9zbG90cygpO1xuXHRcdFx0aW5pdGlhbGl6ZV9zb3J0YWJsZSgpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFZhbGlkYXRlIHJlcXVpcmVkLCBhbGxvdy1saXN0ZWQsIHBvc2l0aXZlLCB1bmlxdWUgZml4ZWQgc2xvdHMuXG5cdFx0ICpcblx0XHQgKiBAcmV0dXJuIHtIVE1MRWxlbWVudHxudWxsfSBGaXJzdCBpbnZhbGlkIGNvbnRyb2wgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB2YWxpZGF0ZSgpIHtcblx0XHRcdHZhciBmaXJzdF9pbnZhbGlkID0gbnVsbDtcblx0XHRcdHZhciBzZWVuX3Nsb3RzID0ge307XG5cblx0XHRcdGlmICggISBlZGl0b3IgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2FyaWEtaW52YWxpZD1cInRydWVcIl0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRjb250cm9sLnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0aWYgKCAhIGVkaXRvci5zbG90cy5sZW5ndGggKSB7XG5cdFx0XHRcdGZpcnN0X2ludmFsaWQgPSBzZXRfc2xvdF9lcnJvciggZ2V0X21lc3NhZ2UoICdzbG90c19yZXF1aXJlZCcsICdBZGQgYXQgbGVhc3Qgb25lIGZpeGVkIHRpbWUgc2xvdC4nICksIC0xLCAnc3RhcnQnICk7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvci5zbG90cy5zb21lKCBmdW5jdGlvbiAoIHNsb3QsIHNsb3RfaW5kZXggKSB7XG5cdFx0XHRcdHZhciBzdGFydF9taW51dGVzID0gdGltZV90b19taW51dGVzKCBzbG90LnN0YXJ0X3RpbWUsIGZhbHNlICk7XG5cdFx0XHRcdHZhciBlbmRfbWludXRlcyA9IHRpbWVfdG9fbWludXRlcyggc2xvdC5lbmRfdGltZSwgdHJ1ZSApO1xuXHRcdFx0XHR2YXIgc2xvdF9rZXkgPSBzbG90LnN0YXJ0X3RpbWUgKyAnIC0gJyArIHNsb3QuZW5kX3RpbWU7XG5cblx0XHRcdFx0aWYgKCAtMSA9PT0gZWRpdG9yLnN0YXJ0X3ZhbHVlcy5pbmRleE9mKCBzbG90LnN0YXJ0X3RpbWUgKSB8fCAtMSA9PT0gZWRpdG9yLmVuZF92YWx1ZXMuaW5kZXhPZiggc2xvdC5lbmRfdGltZSApIHx8IG51bGwgPT09IHN0YXJ0X21pbnV0ZXMgfHwgbnVsbCA9PT0gZW5kX21pbnV0ZXMgfHwgZW5kX21pbnV0ZXMgPD0gc3RhcnRfbWludXRlcyApIHtcblx0XHRcdFx0XHRmaXJzdF9pbnZhbGlkID0gc2V0X3Nsb3RfZXJyb3IoIGdldF9tZXNzYWdlKCAnc2xvdF9pbnZhbGlkJywgJ0V2ZXJ5IGZpeGVkIHRpbWUgc2xvdCBtdXN0IGVuZCBhZnRlciBpdCBzdGFydHMuJyApLCBzbG90X2luZGV4LCAnZW5kJyApO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBzZWVuX3Nsb3RzLCBzbG90X2tleSApICkge1xuXHRcdFx0XHRcdGZpcnN0X2ludmFsaWQgPSBzZXRfc2xvdF9lcnJvciggZ2V0X21lc3NhZ2UoICdzbG90X2R1cGxpY2F0ZScsICdUaGUgc2FtZSBmaXhlZCB0aW1lIHNsb3QgY2Fubm90IGFwcGVhciB0d2ljZS4nICksIHNsb3RfaW5kZXgsICdzdGFydCcgKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWVuX3Nsb3RzWyBzbG90X2tleSBdID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRzeW5jX2ZpeGVkX3Nsb3RzX2RyYWZ0KCk7XG5cdFx0XHRyZXR1cm4gZmlyc3RfaW52YWxpZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5pdGlhbGl6ZTogaW5pdGlhbGl6ZSxcblx0XHRcdHN5bmM6IHN5bmNfZml4ZWRfc2xvdHNfZHJhZnQsXG5cdFx0XHR2YWxpZGF0ZTogdmFsaWRhdGVcblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgPSB3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyB8fCB7fTtcblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXNbIG1vZHVsZV9jb25maWcubW9kdWxlX2lkIF0gPSB7XG5cdFx0Y3JlYXRlOiBjcmVhdGVfZml4ZWRfdGltZV9zbG90c19hZGFwdGVyXG5cdH07XG5cblx0aWYgKCB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciApIHtcblx0XHR3aW5kb3cud3BiY19zZXR1cF93aXphcmRfYXBpLnJlZ2lzdGVyX3N0ZXBfYWRhcHRlciggY3JlYXRlX2ZpeGVkX3RpbWVfc2xvdHNfYWRhcHRlciggbW9kdWxlX2NvbmZpZyApICk7XG5cdH1cbn0oIHdpbmRvdyApICk7XG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLE1BQU0sRUFBRztFQUNyQixZQUFZOztFQUVaLElBQUlDLE1BQU0sR0FBR0QsTUFBTSxDQUFDRSxrQ0FBa0MsSUFBSTtJQUFFQyxJQUFJLEVBQUUsQ0FBQztFQUFFLENBQUM7RUFDdEUsSUFBSUMsYUFBYSxHQUFHO0lBQ25CQyxTQUFTLEVBQUVKLE1BQU0sQ0FBQ0ksU0FBUyxJQUFJLGtCQUFrQjtJQUNqREMsUUFBUSxFQUFFTCxNQUFNLENBQUNLLFFBQVEsSUFBSTtFQUM5QixDQUFDOztFQUVEO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLCtCQUErQkEsQ0FBRUMsY0FBYyxFQUFHO0lBQzFELElBQUlDLFNBQVMsR0FBRyxJQUFJO0lBQ3BCLElBQUlDLE1BQU0sR0FBRyxJQUFJOztJQUVqQjtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNFLFNBQVNDLFdBQVdBLENBQUVDLEdBQUcsRUFBRUMsUUFBUSxFQUFHO01BQ3JDLE9BQU9aLE1BQU0sQ0FBQ0UsSUFBSSxJQUFJRixNQUFNLENBQUNFLElBQUksQ0FBRVMsR0FBRyxDQUFFLEdBQUdYLE1BQU0sQ0FBQ0UsSUFBSSxDQUFFUyxHQUFHLENB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
