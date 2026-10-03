"use strict";

/**
 * Reusable sortable time-choice Setup Wizard editor.
 *
 * @package Booking Calendar
 */

(function (window) {
  'use strict';

  var module_config = window.wpbc_setup_wizard_start_end_times || {
    i18n: {}
  };

  /**
   * Create an isolated time-choice editor adapter.
   *
   * The server owns field IDs, list IDs, option allow-lists, and validation
   * semantics. This browser adapter owns only interaction, ordering, focus,
   * and serialization mechanics shared by Start/End and Start/Duration.
   *
   * @param {Object} config Module limits, identifiers, and translations.
   * @return {Object} Step adapter accepted by the shared wizard shell.
   */
  function create_time_choices_adapter(config) {
    var shell_api = null;
    var editor = null;

    /**
     * Return one translated string with a safe fallback.
     *
     * @param {string} key Translation key.
     * @param {string} fallback Fallback text.
     * @return {string} Translation or fallback.
     */
    function get_message(key, fallback) {
      return config.i18n && config.i18n[key] ? config.i18n[key] : fallback;
    }

    /**
     * Convert a clock or duration `HH:MM` value to minutes.
     *
     * `24:00` is accepted for a full-day duration but cannot appear in the
     * clock-time option list supplied by the server.
     *
     * @param {string} time_value Time or duration candidate.
     * @return {number|null} Minute value, or null when invalid.
     */
    function time_to_minutes(time_value) {
      var normalized_value = String(time_value || '');
      var match = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.exec(normalized_value);
      if (!match) {
        return null;
      }
      return parseInt(normalized_value.substring(0, 2), 10) * 60 + parseInt(normalized_value.substring(3, 5), 10);
    }

    /**
     * Convert a bounded minute value into `HH:MM`.
     *
     * @param {number} minute_value Minute value between zero and 1440.
     * @return {string} Normalized value.
     */
    function minutes_to_time(minute_value) {
      var hours = Math.floor(minute_value / 60);
      var minutes = minute_value % 60;
      return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    }

    /**
     * Return one registered list.
     *
     * @param {string} list_id Stable server-owned list identifier.
     * @return {Object|null} List state or null.
     */
    function get_list(list_id) {
      return editor && editor.lists && editor.lists[list_id] ? editor.lists[list_id] : null;
    }

    /**
     * Return the visible label for one list option.
     *
     * @param {Object} list List state.
     * @param {string} option_value Stored option value.
     * @return {string} Visible server-owned label.
     */
    function get_choice_label(list, option_value) {
      var select = list.template.content.querySelector('[data-wpbc-time-choice]');
      var option = null;
      var option_index;
      if (select) {
        for (option_index = 0; option_index < select.options.length; option_index++) {
          if (select.options[option_index].value === option_value) {
            option = select.options[option_index];
            break;
          }
        }
      }
      return option ? option.textContent : option_value;
    }

    /**
     * Serialize every ordered list into the hidden wizard field.
     *
     * @return {void}
     */
    function sync_time_choices_draft() {
      var serialized_lists = {};
      if (!editor) {
        return;
      }
      editor.list_order.forEach(function (list_id) {
        serialized_lists[list_id] = editor.lists[list_id].values.slice();
      });
      editor.transport.value = JSON.stringify(serialized_lists);
    }

    /**
     * Return the preferred validation focus target for a list item.
     *
     * @param {string} list_id Stable list identifier.
     * @param {number} item_index Preferred item index.
     * @return {HTMLElement|null} Select, Add button, or null.
     */
    function get_choice_control(list_id, item_index) {
      var list = get_list(list_id);
      var item = list ? list.node.querySelector('[data-time-index="' + item_index + '"]') : null;
      return item ? item.querySelector('[data-wpbc-time-choice]') : list ? list.add_button : null;
    }

    /**
     * Focus one choice after rendering.
     *
     * @param {string} list_id Stable list identifier.
     * @param {number} item_index Preferred item index.
     * @return {void}
     */
    function focus_choice(list_id, item_index) {
      var target = get_choice_control(list_id, item_index);
      if (target) {
        target.focus();
      }
    }

    /**
     * Focus a move handle after reordering.
     *
     * @param {string} list_id Stable list identifier.
     * @param {number} item_index New item index.
     * @return {void}
     */
    function focus_move_control(list_id, item_index) {
      var list = get_list(list_id);
      var item = list ? list.node.querySelector('[data-time-index="' + item_index + '"]') : null;
      var target = item ? item.querySelector('[data-wpbc-move-time]') : null;
      if (target) {
        target.focus();
      }
    }

    /**
     * Show one field error and identify its first invalid control.
     *
     * @param {string} message Validation message.
     * @param {string} list_id Stable list identifier.
     * @param {number} item_index Preferred item index.
     * @return {HTMLElement|null} Invalid control or null.
     */
    function set_choice_error(message, list_id, item_index) {
      var target;
      shell_api.set_field_error(editor.field_id, message);
      target = get_choice_control(list_id, item_index);
      if (target) {
        target.setAttribute('aria-invalid', 'true');
      }
      return target;
    }

    /**
     * Find the second occurrence of the first duplicate.
     *
     * @param {string[]} choices Ordered choices.
     * @return {number} Duplicate index or -1.
     */
    function find_duplicate_index(choices) {
      var seen_choices = {};
      var duplicate_index = -1;
      choices.some(function (choice, item_index) {
        if (Object.prototype.hasOwnProperty.call(seen_choices, choice)) {
          duplicate_index = item_index;
          return true;
        }
        seen_choices[choice] = true;
        return false;
      });
      return duplicate_index;
    }

    /**
     * Render one list from data-only state.
     *
     * @param {string} list_id Stable list identifier.
     * @return {void}
     */
    function render_list(list_id) {
      var list = get_list(list_id);
      if (!list || !list.template) {
        return;
      }
      list.node.textContent = '';
      list.add_button.removeAttribute('data-wpbc-setup-wizard-error-control-for');
      if (!list.values.length) {
        list.add_button.setAttribute('data-wpbc-setup-wizard-error-control-for', editor.field_id);
      }
      list.values.forEach(function (choice_value, item_index) {
        var choice = list.template.content.firstElementChild.cloneNode(true);
        var select = choice.querySelector('[data-wpbc-time-choice]');
        var select_label = choice.querySelector('[data-wpbc-time-choice-label]');
        var move_button = choice.querySelector('[data-wpbc-move-time]');
        var remove_button = choice.querySelector('[data-wpbc-remove-time]');
        var visible_choice = get_choice_label(list, choice_value);
        var select_id = 'wpbc-' + editor.field_id.replace(/_/g, '-') + '-' + list_id.replace(/_/g, '-') + '-' + item_index;
        choice.dataset.timeList = list_id;
        choice.dataset.timeIndex = String(item_index);
        select.id = select_id;
        select.value = choice_value;
        if (0 === item_index) {
          select.setAttribute('data-wpbc-setup-wizard-error-control-for', editor.field_id);
        }
        select_label.htmlFor = select_id;
        select_label.textContent = list.label + ': ' + visible_choice;
        move_button.setAttribute('aria-label', get_message('move_time_choice', 'Move %1$s in the %2$s list').replace('%1$s', visible_choice).replace('%2$s', list.label));
        remove_button.setAttribute('aria-label', get_message('remove_time_choice', 'Remove %1$s from the %2$s list').replace('%1$s', visible_choice).replace('%2$s', list.label));
        list.node.appendChild(choice);
      });
      list.add_button.disabled = list.values.length >= editor.max_times;
      list.clear_button.disabled = !list.values.length;
      sync_time_choices_draft();
    }

    /**
     * Render every registered list.
     *
     * @return {void}
     */
    function render_editor() {
      editor.list_order.forEach(render_list);
    }

    /**
     * Generate an inclusive ordered range from one list's toolbar.
     *
     * @param {string} list_id Stable list identifier.
     * @return {void}
     */
    function generate_choices(list_id) {
      var list = get_list(list_id);
      var start_minutes;
      var end_minutes;
      var interval_minutes;
      var generated_values = [];
      var minute;
      if (!list) {
        return;
      }
      start_minutes = time_to_minutes(list.generator_from.value);
      end_minutes = time_to_minutes(list.generator_to.value);
      interval_minutes = parseInt(list.generator_interval.value, 10);
      if (null === start_minutes || null === end_minutes || end_minutes < start_minutes || !isFinite(interval_minutes) || interval_minutes < editor.time_increment || 0 !== interval_minutes % editor.time_increment) {
        list.generator_to.setAttribute('aria-invalid', 'true');
        shell_api.set_status(get_message('generator_invalid', 'The last generated choice must not be earlier than the first choice.'));
        list.generator_to.focus();
        return;
      }
      list.generator_to.removeAttribute('aria-invalid');
      for (minute = start_minutes; minute <= end_minutes && generated_values.length < editor.max_times; minute += interval_minutes) {
        if (-1 !== list.option_values.indexOf(minutes_to_time(minute))) {
          generated_values.push(minutes_to_time(minute));
        }
      }
      list.values = generated_values;
      render_list(list_id);
      focus_choice(list_id, 0);
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Find the next unused server-owned option.
     *
     * @param {Object} list List state.
     * @return {string|null} Proposed value or null.
     */
    function find_choice_proposal(list) {
      var start_index = list.values.length ? list.option_values.indexOf(list.values[list.values.length - 1]) + 1 : 0;
      var offset;
      var candidate_value;
      for (offset = 0; offset < list.option_values.length; offset += 1) {
        candidate_value = list.option_values[(start_index + offset) % list.option_values.length];
        if (-1 === list.values.indexOf(candidate_value)) {
          return candidate_value;
        }
      }
      return null;
    }

    /**
     * Add one unused server-owned choice.
     *
     * @param {string} list_id Stable list identifier.
     * @return {void}
     */
    function add_choice(list_id) {
      var list = get_list(list_id);
      var proposal;
      if (!list || list.values.length >= editor.max_times) {
        shell_api.set_status(get_message('time_limit', 'No additional choice can be added to this list.'));
        return;
      }
      proposal = find_choice_proposal(list);
      if (!proposal) {
        shell_api.set_status(get_message('time_limit', 'No additional choice can be added to this list.'));
        return;
      }
      list.values.push(proposal);
      render_list(list_id);
      focus_choice(list_id, list.values.length - 1);
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Clear one list and keep focus within its action area.
     *
     * @param {string} list_id Stable list identifier.
     * @return {void}
     */
    function clear_choices(list_id) {
      var list = get_list(list_id);
      if (!list || !list.values.length) {
        return;
      }
      list.values = [];
      render_list(list_id);
      list.add_button.focus();
      shell_api.clear_field_error(editor.field_id);
      shell_api.set_status(list.clear_status || get_message(list_id + '_cleared', 'Choices cleared.'));
    }

    /**
     * Move one choice inside its list.
     *
     * @param {string} list_id Stable list identifier.
     * @param {number} source_index Current index.
     * @param {number} target_index Target index.
     * @return {void}
     */
    function move_choice(list_id, source_index, target_index) {
      var list = get_list(list_id);
      var moved_value;
      if (!list || source_index === target_index || source_index < 0 || target_index < 0 || source_index >= list.values.length || target_index >= list.values.length) {
        return;
      }
      moved_value = list.values.splice(source_index, 1)[0];
      list.values.splice(target_index, 0, moved_value);
      render_list(list_id);
      focus_move_control(list_id, target_index);
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Initialize SortableJS for one list without cross-list moves.
     *
     * @param {string} list_id Stable list identifier.
     * @return {void}
     */
    function initialize_sortable_list(list_id) {
      var list = get_list(list_id);
      if (!list || 'function' !== typeof window.Sortable) {
        return;
      }
      list.sortable = new window.Sortable(list.node, {
        animation: 120,
        draggable: '[data-time-index]',
        handle: '[data-wpbc-move-time]',
        ghostClass: 'is-drag-placeholder',
        chosenClass: 'is-dragging',
        dragClass: 'is-dragging',
        onEnd: function (event) {
          var source_index = Number(event.oldIndex);
          var target_index = Number(event.newIndex);
          if (Number.isInteger(source_index) && Number.isInteger(target_index)) {
            move_choice(list_id, source_index, target_index);
          } else {
            render_list(list_id);
          }
        }
      });
    }

    /**
     * Handle generator, add, clear, copy, and remove actions.
     *
     * @param {MouseEvent} event Delegated click event.
     * @return {void}
     */
    function handle_click(event) {
      var copy_button = event.target.closest('[data-wpbc-copy-times]');
      var generator = event.target.closest('[data-wpbc-time-generator]');
      var list_panel = event.target.closest('[data-wpbc-time-list-panel]');
      var choice = event.target.closest('[data-time-index]');
      if (copy_button) {
        var source_list = get_list(copy_button.dataset.sourceList);
        var target_list = get_list(copy_button.dataset.targetList);
        event.preventDefault();
        if (source_list && target_list) {
          target_list.values = source_list.values.filter(function (choice_value) {
            return -1 !== target_list.option_values.indexOf(choice_value);
          });
          render_list(target_list.id);
          focus_choice(target_list.id, 0);
          shell_api.clear_field_error(editor.field_id);
          shell_api.set_status(copy_button.dataset.status || '');
        }
        return;
      }
      if (generator && event.target.closest('[data-wpbc-generate-times]')) {
        event.preventDefault();
        generate_choices(generator.dataset.wpbcTimeGenerator);
        return;
      }
      if (list_panel && event.target.closest('[data-wpbc-add-time]')) {
        event.preventDefault();
        add_choice(list_panel.dataset.wpbcTimeListPanel);
        return;
      }
      if (list_panel && event.target.closest('[data-wpbc-clear-times]')) {
        event.preventDefault();
        clear_choices(list_panel.dataset.wpbcTimeListPanel);
        return;
      }
      if (choice && event.target.closest('[data-wpbc-remove-time]')) {
        var list = get_list(choice.dataset.timeList);
        var item_index = parseInt(choice.dataset.timeIndex, 10);
        event.preventDefault();
        if (list) {
          list.values.splice(item_index, 1);
          render_list(list.id);
          focus_choice(list.id, Math.min(item_index, list.values.length - 1));
          shell_api.clear_field_error(editor.field_id);
        }
      }
    }

    /**
     * Synchronize one changed choice.
     *
     * @param {Event} event Delegated change event.
     * @return {void}
     */
    function handle_change(event) {
      var choice;
      var list;
      var item_index;
      if (!event.target.matches('[data-wpbc-time-choice]')) {
        return;
      }
      choice = event.target.closest('[data-time-index]');
      list = choice ? get_list(choice.dataset.timeList) : null;
      item_index = choice ? parseInt(choice.dataset.timeIndex, 10) : -1;
      if (!list || item_index < 0) {
        return;
      }
      list.values[item_index] = event.target.value;
      render_list(list.id);
      focus_choice(list.id, item_index);
      shell_api.clear_field_error(editor.field_id);
    }

    /**
     * Provide keyboard reordering equivalent to drag and drop.
     *
     * @param {KeyboardEvent} event Delegated keydown event.
     * @return {void}
     */
    function handle_keydown(event) {
      var move_button = event.target.closest('[data-wpbc-move-time]');
      var choice;
      var item_index;
      var target_index;
      if (!move_button || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        return;
      }
      choice = move_button.closest('[data-time-index]');
      item_index = parseInt(choice.dataset.timeIndex, 10);
      target_index = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? item_index - 1 : item_index + 1;
      event.preventDefault();
      move_choice(choice.dataset.timeList, item_index, target_index);
    }

    /**
     * Initialize one server-defined list from DOM and checkpoint values.
     *
     * @param {HTMLElement} list_node List container.
     * @param {string[]} values Stored list values.
     * @return {Object|null} List state or null.
     */
    function initialize_list(list_node, values) {
      var list_id = list_node.dataset.wpbcTimeChoiceList;
      var panel = editor.node.querySelector('[data-wpbc-time-list-panel="' + list_id + '"]');
      var generator = panel ? panel.querySelector('[data-wpbc-time-generator]') : null;
      var template = shell_api.root.querySelector('[data-wpbc-time-choice-template="' + list_id + '"]');
      var template_select = template ? template.content.querySelector('[data-wpbc-time-choice]') : null;
      if (!panel || !generator || !template || !template_select) {
        return null;
      }
      return {
        id: list_id,
        node: list_node,
        template: template,
        label: list_node.dataset.listLabel || list_id,
        clear_status: list_node.dataset.clearStatus || '',
        values: Array.isArray(values) ? values.slice() : [],
        option_values: Array.prototype.map.call(template_select.options, function (option) {
          return option.value;
        }),
        add_button: panel.querySelector('[data-wpbc-add-time]'),
        clear_button: panel.querySelector('[data-wpbc-clear-times]'),
        generator_from: generator.querySelector('[data-wpbc-generator-from]'),
        generator_to: generator.querySelector('[data-wpbc-generator-to]'),
        generator_interval: generator.querySelector('[data-wpbc-generator-interval]'),
        sortable: null
      };
    }

    /**
     * Initialize this module against shell-provided services.
     *
     * @param {Object} registered_shell_api Shared wizard adapter services.
     * @return {void}
     */
    function initialize(registered_shell_api) {
      var parsed_values;
      var editor_node;
      var transport;
      shell_api = registered_shell_api;
      editor_node = shell_api.root.querySelector('[data-wpbc-time-choices-editor]');
      transport = shell_api.root.querySelector('[data-wpbc-time-choices-draft]');
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
        field_id: editor_node.dataset.fieldId || config.field_id || 'start_end_times',
        validation_rule: editor_node.dataset.validationRule || 'independent_lists',
        max_times: parseInt(transport.dataset.maxTimes || String(config.max_times_per_list || 288), 10),
        time_increment: parseInt(transport.dataset.timeIncrement || String(config.time_increment || 5), 10),
        list_order: [],
        lists: {}
      };
      editor.node.querySelectorAll('[data-wpbc-time-choice-list]').forEach(function (list_node) {
        var list_id = list_node.dataset.wpbcTimeChoiceList;
        var list = initialize_list(list_node, parsed_values[list_id]);
        if (list) {
          editor.list_order.push(list_id);
          editor.lists[list_id] = list;
        }
      });
      if (!editor.list_order.length) {
        editor = null;
        return;
      }
      editor.node.addEventListener('click', handle_click);
      editor.node.addEventListener('change', handle_change);
      editor.node.addEventListener('keydown', handle_keydown);
      render_editor();
      editor.list_order.forEach(initialize_sortable_list);
    }

    /**
     * Validate required, unique, allow-listed, and route-specific choices.
     *
     * @return {HTMLElement|null} First invalid control or null.
     */
    function validate() {
      var first_invalid = null;
      if (!editor) {
        return null;
      }
      editor.node.querySelectorAll('[aria-invalid="true"]').forEach(function (control) {
        control.removeAttribute('aria-invalid');
      });
      editor.list_order.some(function (list_id) {
        var list = editor.lists[list_id];
        var duplicate_index;
        if (!list.values.length) {
          first_invalid = set_choice_error(get_message(list_id + '_required', 'Add at least one choice.'), list_id, -1);
          return true;
        }
        if (list.values.some(function (choice_value) {
          return -1 === list.option_values.indexOf(choice_value);
        })) {
          first_invalid = set_choice_error(get_message('time_value_invalid', 'Choose a supported value for every choice.'), list_id, 0);
          return true;
        }
        duplicate_index = find_duplicate_index(list.values);
        if (-1 !== duplicate_index) {
          first_invalid = set_choice_error(get_message('time_duplicate', 'The same choice cannot appear twice in one list.'), list_id, duplicate_index);
          return true;
        }
        return false;
      });
      if (!first_invalid && 'end_after_start' === editor.validation_rule && editor.lists.start_times && editor.lists.end_times) {
        var start_minutes = editor.lists.start_times.values.map(time_to_minutes);
        var end_minutes = editor.lists.end_times.values.map(time_to_minutes);
        if (start_minutes.some(function (value) {
          return null === value;
        }) || end_minutes.some(function (value) {
          return null === value;
        }) || Math.max.apply(null, end_minutes) <= Math.min.apply(null, start_minutes)) {
          first_invalid = set_choice_error(get_message('time_pair_invalid', 'Add an end time that is later than at least one start time.'), 'end_times', 0);
        }
      }
      sync_time_choices_draft();
      return first_invalid;
    }
    return {
      initialize: initialize,
      sync: sync_time_choices_draft,
      validate: validate
    };
  }
  window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
  window.wpbc_setup_editor_modules[module_config.module_id || 'start_end_times'] = {
    create: create_time_choices_adapter
  };
  if (window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter) {
    window.wpbc_setup_wizard_api.register_step_adapter(create_time_choices_adapter(module_config));
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1zdGFydC1lbmQtdGltZXMvX291dC9zdGVwLXN0YXJ0LWVuZC10aW1lcy5qcyIsIm5hbWVzIjpbIndpbmRvdyIsIm1vZHVsZV9jb25maWciLCJ3cGJjX3NldHVwX3dpemFyZF9zdGFydF9lbmRfdGltZXMiLCJpMThuIiwiY3JlYXRlX3RpbWVfY2hvaWNlc19hZGFwdGVyIiwiY29uZmlnIiwic2hlbGxfYXBpIiwiZWRpdG9yIiwiZ2V0X21lc3NhZ2UiLCJrZXkiLCJmYWxsYmFjayIsInRpbWVfdG9fbWludXRlcyIsInRpbWVfdmFsdWUiLCJub3JtYWxpemVkX3ZhbHVlIiwiU3RyaW5nIiwibWF0Y2giLCJleGVjIiwicGFyc2VJbnQiLCJzdWJzdHJpbmciLCJtaW51dGVzX3RvX3RpbWUiLCJtaW51dGVfdmFsdWUiLCJob3VycyIsIk1hdGgiLCJmbG9vciIsIm1pbnV0ZXMiLCJwYWRTdGFydCIsImdldF9saXN0IiwibGlzdF9pZCIsImxpc3RzIiwiZ2V0X2Nob2ljZV9sYWJlbCIsImxpc3QiLCJvcHRpb25fdmFsdWUiLCJzZWxlY3QiLCJ0ZW1wbGF0ZSIsImNvbnRlbnQiLCJxdWVyeVNlbGVjdG9yIiwib3B0aW9uIiwib3B0aW9uX2luZGV4Iiwib3B0aW9ucyIsImxlbmd0aCIsInZhbHVlIiwidGV4dENvbnRlbnQiLCJzeW5jX3RpbWVfY2hvaWNlc19kcmFmdCIsInNlcmlhbGl6ZWRfbGlzdHMiLCJsaXN0X29yZGVyIiwiZm9yRWFjaCIsInZhbHVlcyIsInNsaWNlIiwidHJhbnNwb3J0IiwiSlNPTiIsInN0cmluZ2lmeSIsImdldF9jaG9pY2VfY29udHJvbCIsIml0ZW1faW5kZXgiLCJpdGVtIiwibm9kZSIsImFkZF9idXR0b24iLCJmb2N1c19jaG9pY2UiLCJ0YXJnZXQiLCJmb2N1cyIsImZvY3VzX21vdmVfY29udHJvbCIsInNldF9jaG9pY2VfZXJyb3IiLCJtZXNzYWdlIiwic2V0X2ZpZWxkX2Vycm9yIiwiZmllbGRfaWQiLCJzZXRBdHRyaWJ1dGUiLCJmaW5kX2R1cGxpY2F0ZV9pbmRleCIsImNob2ljZXMiLCJzZWVuX2Nob2ljZXMiLCJkdXBsaWNhdGVfaW5kZXgiLCJzb21lIiwiY2hvaWNlIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwicmVuZGVyX2xpc3QiLCJyZW1vdmVBdHRyaWJ1dGUiLCJjaG9pY2VfdmFsdWUiLCJmaXJzdEVsZW1lbnRDaGlsZCIsImNsb25lTm9kZSIsInNlbGVjdF9sYWJlbCIsIm1vdmVfYnV0dG9uIiwicmVtb3ZlX2J1dHRvbiIsInZpc2libGVfY2hvaWNlIiwic2VsZWN0X2lkIiwicmVwbGFjZSIsImRhdGFzZXQiLCJ0aW1lTGlzdCIsInRpbWVJbmRleCIsImlkIiwiaHRtbEZvciIsImxhYmVsIiwiYXBwZW5kQ2hpbGQiLCJkaXNhYmxlZCIsIm1heF90aW1lcyIsImNsZWFyX2J1dHRvbiIsInJlbmRlcl9lZGl0b3IiLCJnZW5lcmF0ZV9jaG9pY2VzIiwic3RhcnRfbWludXRlcyIsImVuZF9taW51dGVzIiwiaW50ZXJ2YWxfbWludXRlcyIsImdlbmVyYXRlZF92YWx1ZXMiLCJtaW51dGUiLCJnZW5lcmF0b3JfZnJvbSIsImdlbmVyYXRvcl90byIsImdlbmVyYXRvcl9pbnRlcnZhbCIsImlzRmluaXRlIiwidGltZV9pbmNyZW1lbnQiLCJzZXRfc3RhdHVzIiwib3B0aW9uX3ZhbHVlcyIsImluZGV4T2YiLCJwdXNoIiwiY2xlYXJfZmllbGRfZXJyb3IiLCJmaW5kX2Nob2ljZV9wcm9wb3NhbCIsInN0YXJ0X2luZGV4Iiwib2Zmc2V0IiwiY2FuZGlkYXRlX3ZhbHVlIiwiYWRkX2Nob2ljZSIsInByb3Bvc2FsIiwiY2xlYXJfY2hvaWNlcyIsImNsZWFyX3N0YXR1cyIsIm1vdmVfY2hvaWNlIiwic291cmNlX2luZGV4IiwidGFyZ2V0X2luZGV4IiwibW92ZWRfdmFsdWUiLCJzcGxpY2UiLCJpbml0aWFsaXplX3NvcnRhYmxlX2xpc3QiLCJTb3J0YWJsZSIsInNvcnRhYmxlIiwiYW5pbWF0aW9uIiwiZHJhZ2dhYmxlIiwiaGFuZGxlIiwiZ2hvc3RDbGFzcyIsImNob3NlbkNsYXNzIiwiZHJhZ0NsYXNzIiwib25FbmQiLCJldmVudCIsIk51bWJlciIsIm9sZEluZGV4IiwibmV3SW5kZXgiLCJpc0ludGVnZXIiLCJoYW5kbGVfY2xpY2siLCJjb3B5X2J1dHRvbiIsImNsb3Nlc3QiLCJnZW5lcmF0b3IiLCJsaXN0X3BhbmVsIiwic291cmNlX2xpc3QiLCJzb3VyY2VMaXN0IiwidGFyZ2V0X2xpc3QiLCJ0YXJnZXRMaXN0IiwicHJldmVudERlZmF1bHQiLCJmaWx0ZXIiLCJzdGF0dXMiLCJ3cGJjVGltZUdlbmVyYXRvciIsIndwYmNUaW1lTGlzdFBhbmVsIiwibWluIiwiaGFuZGxlX2NoYW5nZSIsIm1hdGNoZXMiLCJoYW5kbGVfa2V5ZG93biIsImluY2x1ZGVzIiwiaW5pdGlhbGl6ZV9saXN0IiwibGlzdF9ub2RlIiwid3BiY1RpbWVDaG9pY2VMaXN0IiwicGFuZWwiLCJyb290IiwidGVtcGxhdGVfc2VsZWN0IiwibGlzdExhYmVsIiwiY2xlYXJTdGF0dXMiLCJBcnJheSIsImlzQXJyYXkiLCJtYXAiLCJpbml0aWFsaXplIiwicmVnaXN0ZXJlZF9zaGVsbF9hcGkiLCJwYXJzZWRfdmFsdWVzIiwiZWRpdG9yX25vZGUiLCJwYXJzZSIsInBhcnNlX2Vycm9yIiwiZmllbGRJZCIsInZhbGlkYXRpb25fcnVsZSIsInZhbGlkYXRpb25SdWxlIiwibWF4VGltZXMiLCJtYXhfdGltZXNfcGVyX2xpc3QiLCJ0aW1lSW5jcmVtZW50IiwicXVlcnlTZWxlY3RvckFsbCIsImFkZEV2ZW50TGlzdGVuZXIiLCJ2YWxpZGF0ZSIsImZpcnN0X2ludmFsaWQiLCJjb250cm9sIiwic3RhcnRfdGltZXMiLCJlbmRfdGltZXMiLCJtYXgiLCJhcHBseSIsInN5bmMiLCJ3cGJjX3NldHVwX2VkaXRvcl9tb2R1bGVzIiwibW9kdWxlX2lkIiwiY3JlYXRlIiwid3BiY19zZXR1cF93aXphcmRfYXBpIiwicmVnaXN0ZXJfc3RlcF9hZGFwdGVyIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvc3RlcC1zdGFydC1lbmQtdGltZXMvX3NyYy9zdGVwLXN0YXJ0LWVuZC10aW1lcy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJldXNhYmxlIHNvcnRhYmxlIHRpbWUtY2hvaWNlIFNldHVwIFdpemFyZCBlZGl0b3IuXG4gKlxuICogQHBhY2thZ2UgQm9va2luZyBDYWxlbmRhclxuICovXG5cbiggZnVuY3Rpb24gKCB3aW5kb3cgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgbW9kdWxlX2NvbmZpZyA9IHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9zdGFydF9lbmRfdGltZXMgfHwgeyBpMThuOiB7fSB9O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYW4gaXNvbGF0ZWQgdGltZS1jaG9pY2UgZWRpdG9yIGFkYXB0ZXIuXG5cdCAqXG5cdCAqIFRoZSBzZXJ2ZXIgb3ducyBmaWVsZCBJRHMsIGxpc3QgSURzLCBvcHRpb24gYWxsb3ctbGlzdHMsIGFuZCB2YWxpZGF0aW9uXG5cdCAqIHNlbWFudGljcy4gVGhpcyBicm93c2VyIGFkYXB0ZXIgb3ducyBvbmx5IGludGVyYWN0aW9uLCBvcmRlcmluZywgZm9jdXMsXG5cdCAqIGFuZCBzZXJpYWxpemF0aW9uIG1lY2hhbmljcyBzaGFyZWQgYnkgU3RhcnQvRW5kIGFuZCBTdGFydC9EdXJhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBNb2R1bGUgbGltaXRzLCBpZGVudGlmaWVycywgYW5kIHRyYW5zbGF0aW9ucy5cblx0ICogQHJldHVybiB7T2JqZWN0fSBTdGVwIGFkYXB0ZXIgYWNjZXB0ZWQgYnkgdGhlIHNoYXJlZCB3aXphcmQgc2hlbGwuXG5cdCAqL1xuXHRmdW5jdGlvbiBjcmVhdGVfdGltZV9jaG9pY2VzX2FkYXB0ZXIoIGNvbmZpZyApIHtcblx0XHR2YXIgc2hlbGxfYXBpID0gbnVsbDtcblx0XHR2YXIgZWRpdG9yID0gbnVsbDtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBvbmUgdHJhbnNsYXRlZCBzdHJpbmcgd2l0aCBhIHNhZmUgZmFsbGJhY2suXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFRyYW5zbGF0aW9uIGtleS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2sgRmFsbGJhY2sgdGV4dC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFRyYW5zbGF0aW9uIG9yIGZhbGxiYWNrLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9tZXNzYWdlKCBrZXksIGZhbGxiYWNrICkge1xuXHRcdFx0cmV0dXJuIGNvbmZpZy5pMThuICYmIGNvbmZpZy5pMThuWyBrZXkgXSA/IGNvbmZpZy5pMThuWyBrZXkgXSA6IGZhbGxiYWNrO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENvbnZlcnQgYSBjbG9jayBvciBkdXJhdGlvbiBgSEg6TU1gIHZhbHVlIHRvIG1pbnV0ZXMuXG5cdFx0ICpcblx0XHQgKiBgMjQ6MDBgIGlzIGFjY2VwdGVkIGZvciBhIGZ1bGwtZGF5IGR1cmF0aW9uIGJ1dCBjYW5ub3QgYXBwZWFyIGluIHRoZVxuXHRcdCAqIGNsb2NrLXRpbWUgb3B0aW9uIGxpc3Qgc3VwcGxpZWQgYnkgdGhlIHNlcnZlci5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSB0aW1lX3ZhbHVlIFRpbWUgb3IgZHVyYXRpb24gY2FuZGlkYXRlLlxuXHRcdCAqIEByZXR1cm4ge251bWJlcnxudWxsfSBNaW51dGUgdmFsdWUsIG9yIG51bGwgd2hlbiBpbnZhbGlkLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRpbWVfdG9fbWludXRlcyggdGltZV92YWx1ZSApIHtcblx0XHRcdHZhciBub3JtYWxpemVkX3ZhbHVlID0gU3RyaW5nKCB0aW1lX3ZhbHVlIHx8ICcnICk7XG5cdFx0XHR2YXIgbWF0Y2ggPSAvXig/Oig/OlswMV1cXGR8MlswLTNdKTpbMC01XVxcZHwyNDowMCkkLy5leGVjKCBub3JtYWxpemVkX3ZhbHVlICk7XG5cblx0XHRcdGlmICggISBtYXRjaCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBwYXJzZUludCggbm9ybWFsaXplZF92YWx1ZS5zdWJzdHJpbmcoIDAsIDIgKSwgMTAgKSAqIDYwICsgcGFyc2VJbnQoIG5vcm1hbGl6ZWRfdmFsdWUuc3Vic3RyaW5nKCAzLCA1ICksIDEwICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQ29udmVydCBhIGJvdW5kZWQgbWludXRlIHZhbHVlIGludG8gYEhIOk1NYC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBtaW51dGVfdmFsdWUgTWludXRlIHZhbHVlIGJldHdlZW4gemVybyBhbmQgMTQ0MC5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IE5vcm1hbGl6ZWQgdmFsdWUuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gbWludXRlc190b190aW1lKCBtaW51dGVfdmFsdWUgKSB7XG5cdFx0XHR2YXIgaG91cnMgPSBNYXRoLmZsb29yKCBtaW51dGVfdmFsdWUgLyA2MCApO1xuXHRcdFx0dmFyIG1pbnV0ZXMgPSBtaW51dGVfdmFsdWUgJSA2MDtcblxuXHRcdFx0cmV0dXJuIFN0cmluZyggaG91cnMgKS5wYWRTdGFydCggMiwgJzAnICkgKyAnOicgKyBTdHJpbmcoIG1pbnV0ZXMgKS5wYWRTdGFydCggMiwgJzAnICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIG9uZSByZWdpc3RlcmVkIGxpc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGlzdF9pZCBTdGFibGUgc2VydmVyLW93bmVkIGxpc3QgaWRlbnRpZmllci5cblx0XHQgKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gTGlzdCBzdGF0ZSBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9saXN0KCBsaXN0X2lkICkge1xuXHRcdFx0cmV0dXJuIGVkaXRvciAmJiBlZGl0b3IubGlzdHMgJiYgZWRpdG9yLmxpc3RzWyBsaXN0X2lkIF0gPyBlZGl0b3IubGlzdHNbIGxpc3RfaWQgXSA6IG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIHRoZSB2aXNpYmxlIGxhYmVsIGZvciBvbmUgbGlzdCBvcHRpb24uXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gbGlzdCBMaXN0IHN0YXRlLlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25fdmFsdWUgU3RvcmVkIG9wdGlvbiB2YWx1ZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd9IFZpc2libGUgc2VydmVyLW93bmVkIGxhYmVsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jaG9pY2VfbGFiZWwoIGxpc3QsIG9wdGlvbl92YWx1ZSApIHtcblx0XHRcdHZhciBzZWxlY3QgPSBsaXN0LnRlbXBsYXRlLmNvbnRlbnQucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZS1jaG9pY2VdJyApO1xuXHRcdFx0dmFyIG9wdGlvbiA9IG51bGw7XG5cdFx0XHR2YXIgb3B0aW9uX2luZGV4O1xuXG5cdFx0XHRpZiAoIHNlbGVjdCApIHtcblx0XHRcdFx0Zm9yICggb3B0aW9uX2luZGV4ID0gMDsgb3B0aW9uX2luZGV4IDwgc2VsZWN0Lm9wdGlvbnMubGVuZ3RoOyBvcHRpb25faW5kZXgrKyApIHtcblx0XHRcdFx0XHRpZiAoIHNlbGVjdC5vcHRpb25zWyBvcHRpb25faW5kZXggXS52YWx1ZSA9PT0gb3B0aW9uX3ZhbHVlICkge1xuXHRcdFx0XHRcdFx0b3B0aW9uID0gc2VsZWN0Lm9wdGlvbnNbIG9wdGlvbl9pbmRleCBdO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBvcHRpb24gPyBvcHRpb24udGV4dENvbnRlbnQgOiBvcHRpb25fdmFsdWU7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogU2VyaWFsaXplIGV2ZXJ5IG9yZGVyZWQgbGlzdCBpbnRvIHRoZSBoaWRkZW4gd2l6YXJkIGZpZWxkLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBzeW5jX3RpbWVfY2hvaWNlc19kcmFmdCgpIHtcblx0XHRcdHZhciBzZXJpYWxpemVkX2xpc3RzID0ge307XG5cblx0XHRcdGlmICggISBlZGl0b3IgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yLmxpc3Rfb3JkZXIuZm9yRWFjaCggZnVuY3Rpb24gKCBsaXN0X2lkICkge1xuXHRcdFx0XHRzZXJpYWxpemVkX2xpc3RzWyBsaXN0X2lkIF0gPSBlZGl0b3IubGlzdHNbIGxpc3RfaWQgXS52YWx1ZXMuc2xpY2UoKTtcblx0XHRcdH0gKTtcblx0XHRcdGVkaXRvci50cmFuc3BvcnQudmFsdWUgPSBKU09OLnN0cmluZ2lmeSggc2VyaWFsaXplZF9saXN0cyApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiB0aGUgcHJlZmVycmVkIHZhbGlkYXRpb24gZm9jdXMgdGFyZ2V0IGZvciBhIGxpc3QgaXRlbS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBsaXN0X2lkIFN0YWJsZSBsaXN0IGlkZW50aWZpZXIuXG5cdFx0ICogQHBhcmFtIHtudW1iZXJ9IGl0ZW1faW5kZXggUHJlZmVycmVkIGl0ZW0gaW5kZXguXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gU2VsZWN0LCBBZGQgYnV0dG9uLCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGdldF9jaG9pY2VfY29udHJvbCggbGlzdF9pZCwgaXRlbV9pbmRleCApIHtcblx0XHRcdHZhciBsaXN0ID0gZ2V0X2xpc3QoIGxpc3RfaWQgKTtcblx0XHRcdHZhciBpdGVtID0gbGlzdCA/IGxpc3Qubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtdGltZS1pbmRleD1cIicgKyBpdGVtX2luZGV4ICsgJ1wiXScgKSA6IG51bGw7XG5cblx0XHRcdHJldHVybiBpdGVtID8gaXRlbS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lLWNob2ljZV0nICkgOiAoIGxpc3QgPyBsaXN0LmFkZF9idXR0b24gOiBudWxsICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9jdXMgb25lIGNob2ljZSBhZnRlciByZW5kZXJpbmcuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGlzdF9pZCBTdGFibGUgbGlzdCBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBpdGVtX2luZGV4IFByZWZlcnJlZCBpdGVtIGluZGV4LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZm9jdXNfY2hvaWNlKCBsaXN0X2lkLCBpdGVtX2luZGV4ICkge1xuXHRcdFx0dmFyIHRhcmdldCA9IGdldF9jaG9pY2VfY29udHJvbCggbGlzdF9pZCwgaXRlbV9pbmRleCApO1xuXG5cdFx0XHRpZiAoIHRhcmdldCApIHtcblx0XHRcdFx0dGFyZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRm9jdXMgYSBtb3ZlIGhhbmRsZSBhZnRlciByZW9yZGVyaW5nLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGxpc3RfaWQgU3RhYmxlIGxpc3QgaWRlbnRpZmllci5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gaXRlbV9pbmRleCBOZXcgaXRlbSBpbmRleC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGZvY3VzX21vdmVfY29udHJvbCggbGlzdF9pZCwgaXRlbV9pbmRleCApIHtcblx0XHRcdHZhciBsaXN0ID0gZ2V0X2xpc3QoIGxpc3RfaWQgKTtcblx0XHRcdHZhciBpdGVtID0gbGlzdCA/IGxpc3Qubm9kZS5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtdGltZS1pbmRleD1cIicgKyBpdGVtX2luZGV4ICsgJ1wiXScgKSA6IG51bGw7XG5cdFx0XHR2YXIgdGFyZ2V0ID0gaXRlbSA/IGl0ZW0ucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtbW92ZS10aW1lXScgKSA6IG51bGw7XG5cblx0XHRcdGlmICggdGFyZ2V0ICkge1xuXHRcdFx0XHR0YXJnZXQuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTaG93IG9uZSBmaWVsZCBlcnJvciBhbmQgaWRlbnRpZnkgaXRzIGZpcnN0IGludmFsaWQgY29udHJvbC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFZhbGlkYXRpb24gbWVzc2FnZS5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGlzdF9pZCBTdGFibGUgbGlzdCBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBpdGVtX2luZGV4IFByZWZlcnJlZCBpdGVtIGluZGV4LlxuXHRcdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEludmFsaWQgY29udHJvbCBvciBudWxsLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHNldF9jaG9pY2VfZXJyb3IoIG1lc3NhZ2UsIGxpc3RfaWQsIGl0ZW1faW5kZXggKSB7XG5cdFx0XHR2YXIgdGFyZ2V0O1xuXG5cdFx0XHRzaGVsbF9hcGkuc2V0X2ZpZWxkX2Vycm9yKCBlZGl0b3IuZmllbGRfaWQsIG1lc3NhZ2UgKTtcblx0XHRcdHRhcmdldCA9IGdldF9jaG9pY2VfY29udHJvbCggbGlzdF9pZCwgaXRlbV9pbmRleCApO1xuXHRcdFx0aWYgKCB0YXJnZXQgKSB7XG5cdFx0XHRcdHRhcmdldC5zZXRBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnLCAndHJ1ZScgKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRhcmdldDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5kIHRoZSBzZWNvbmQgb2NjdXJyZW5jZSBvZiB0aGUgZmlyc3QgZHVwbGljYXRlLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtzdHJpbmdbXX0gY2hvaWNlcyBPcmRlcmVkIGNob2ljZXMuXG5cdFx0ICogQHJldHVybiB7bnVtYmVyfSBEdXBsaWNhdGUgaW5kZXggb3IgLTEuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZmluZF9kdXBsaWNhdGVfaW5kZXgoIGNob2ljZXMgKSB7XG5cdFx0XHR2YXIgc2Vlbl9jaG9pY2VzID0ge307XG5cdFx0XHR2YXIgZHVwbGljYXRlX2luZGV4ID0gLTE7XG5cblx0XHRcdGNob2ljZXMuc29tZSggZnVuY3Rpb24gKCBjaG9pY2UsIGl0ZW1faW5kZXggKSB7XG5cdFx0XHRcdGlmICggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCBzZWVuX2Nob2ljZXMsIGNob2ljZSApICkge1xuXHRcdFx0XHRcdGR1cGxpY2F0ZV9pbmRleCA9IGl0ZW1faW5kZXg7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2Vlbl9jaG9pY2VzWyBjaG9pY2UgXSA9IHRydWU7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gKTtcblxuXHRcdFx0cmV0dXJuIGR1cGxpY2F0ZV9pbmRleDtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZW5kZXIgb25lIGxpc3QgZnJvbSBkYXRhLW9ubHkgc3RhdGUuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGlzdF9pZCBTdGFibGUgbGlzdCBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2xpc3QoIGxpc3RfaWQgKSB7XG5cdFx0XHR2YXIgbGlzdCA9IGdldF9saXN0KCBsaXN0X2lkICk7XG5cblx0XHRcdGlmICggISBsaXN0IHx8ICEgbGlzdC50ZW1wbGF0ZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsaXN0Lm5vZGUudGV4dENvbnRlbnQgPSAnJztcblx0XHRcdGxpc3QuYWRkX2J1dHRvbi5yZW1vdmVBdHRyaWJ1dGUoICdkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWVycm9yLWNvbnRyb2wtZm9yJyApO1xuXHRcdFx0aWYgKCAhIGxpc3QudmFsdWVzLmxlbmd0aCApIHtcblx0XHRcdFx0bGlzdC5hZGRfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zZXR1cC13aXphcmQtZXJyb3ItY29udHJvbC1mb3InLCBlZGl0b3IuZmllbGRfaWQgKTtcblx0XHRcdH1cblxuXHRcdFx0bGlzdC52YWx1ZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBjaG9pY2VfdmFsdWUsIGl0ZW1faW5kZXggKSB7XG5cdFx0XHRcdHZhciBjaG9pY2UgPSBsaXN0LnRlbXBsYXRlLmNvbnRlbnQuZmlyc3RFbGVtZW50Q2hpbGQuY2xvbmVOb2RlKCB0cnVlICk7XG5cdFx0XHRcdHZhciBzZWxlY3QgPSBjaG9pY2UucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZS1jaG9pY2VdJyApO1xuXHRcdFx0XHR2YXIgc2VsZWN0X2xhYmVsID0gY2hvaWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWUtY2hvaWNlLWxhYmVsXScgKTtcblx0XHRcdFx0dmFyIG1vdmVfYnV0dG9uID0gY2hvaWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLW1vdmUtdGltZV0nICk7XG5cdFx0XHRcdHZhciByZW1vdmVfYnV0dG9uID0gY2hvaWNlLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXJlbW92ZS10aW1lXScgKTtcblx0XHRcdFx0dmFyIHZpc2libGVfY2hvaWNlID0gZ2V0X2Nob2ljZV9sYWJlbCggbGlzdCwgY2hvaWNlX3ZhbHVlICk7XG5cdFx0XHRcdHZhciBzZWxlY3RfaWQgPSAnd3BiYy0nICsgZWRpdG9yLmZpZWxkX2lkLnJlcGxhY2UoIC9fL2csICctJyApICsgJy0nICsgbGlzdF9pZC5yZXBsYWNlKCAvXy9nLCAnLScgKSArICctJyArIGl0ZW1faW5kZXg7XG5cblx0XHRcdFx0Y2hvaWNlLmRhdGFzZXQudGltZUxpc3QgPSBsaXN0X2lkO1xuXHRcdFx0XHRjaG9pY2UuZGF0YXNldC50aW1lSW5kZXggPSBTdHJpbmcoIGl0ZW1faW5kZXggKTtcblx0XHRcdFx0c2VsZWN0LmlkID0gc2VsZWN0X2lkO1xuXHRcdFx0XHRzZWxlY3QudmFsdWUgPSBjaG9pY2VfdmFsdWU7XG5cdFx0XHRcdGlmICggMCA9PT0gaXRlbV9pbmRleCApIHtcblx0XHRcdFx0XHRzZWxlY3Quc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLXNldHVwLXdpemFyZC1lcnJvci1jb250cm9sLWZvcicsIGVkaXRvci5maWVsZF9pZCApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNlbGVjdF9sYWJlbC5odG1sRm9yID0gc2VsZWN0X2lkO1xuXHRcdFx0XHRzZWxlY3RfbGFiZWwudGV4dENvbnRlbnQgPSBsaXN0LmxhYmVsICsgJzogJyArIHZpc2libGVfY2hvaWNlO1xuXHRcdFx0XHRtb3ZlX2J1dHRvbi5zZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsJywgZ2V0X21lc3NhZ2UoICdtb3ZlX3RpbWVfY2hvaWNlJywgJ01vdmUgJTEkcyBpbiB0aGUgJTIkcyBsaXN0JyApLnJlcGxhY2UoICclMSRzJywgdmlzaWJsZV9jaG9pY2UgKS5yZXBsYWNlKCAnJTIkcycsIGxpc3QubGFiZWwgKSApO1xuXHRcdFx0XHRyZW1vdmVfYnV0dG9uLnNldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWwnLCBnZXRfbWVzc2FnZSggJ3JlbW92ZV90aW1lX2Nob2ljZScsICdSZW1vdmUgJTEkcyBmcm9tIHRoZSAlMiRzIGxpc3QnICkucmVwbGFjZSggJyUxJHMnLCB2aXNpYmxlX2Nob2ljZSApLnJlcGxhY2UoICclMiRzJywgbGlzdC5sYWJlbCApICk7XG5cdFx0XHRcdGxpc3Qubm9kZS5hcHBlbmRDaGlsZCggY2hvaWNlICk7XG5cdFx0XHR9ICk7XG5cblx0XHRcdGxpc3QuYWRkX2J1dHRvbi5kaXNhYmxlZCA9IGxpc3QudmFsdWVzLmxlbmd0aCA+PSBlZGl0b3IubWF4X3RpbWVzO1xuXHRcdFx0bGlzdC5jbGVhcl9idXR0b24uZGlzYWJsZWQgPSAhIGxpc3QudmFsdWVzLmxlbmd0aDtcblx0XHRcdHN5bmNfdGltZV9jaG9pY2VzX2RyYWZ0KCk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmVuZGVyIGV2ZXJ5IHJlZ2lzdGVyZWQgbGlzdC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVuZGVyX2VkaXRvcigpIHtcblx0XHRcdGVkaXRvci5saXN0X29yZGVyLmZvckVhY2goIHJlbmRlcl9saXN0ICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogR2VuZXJhdGUgYW4gaW5jbHVzaXZlIG9yZGVyZWQgcmFuZ2UgZnJvbSBvbmUgbGlzdCdzIHRvb2xiYXIuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGlzdF9pZCBTdGFibGUgbGlzdCBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2VuZXJhdGVfY2hvaWNlcyggbGlzdF9pZCApIHtcblx0XHRcdHZhciBsaXN0ID0gZ2V0X2xpc3QoIGxpc3RfaWQgKTtcblx0XHRcdHZhciBzdGFydF9taW51dGVzO1xuXHRcdFx0dmFyIGVuZF9taW51dGVzO1xuXHRcdFx0dmFyIGludGVydmFsX21pbnV0ZXM7XG5cdFx0XHR2YXIgZ2VuZXJhdGVkX3ZhbHVlcyA9IFtdO1xuXHRcdFx0dmFyIG1pbnV0ZTtcblxuXHRcdFx0aWYgKCAhIGxpc3QgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c3RhcnRfbWludXRlcyA9IHRpbWVfdG9fbWludXRlcyggbGlzdC5nZW5lcmF0b3JfZnJvbS52YWx1ZSApO1xuXHRcdFx0ZW5kX21pbnV0ZXMgPSB0aW1lX3RvX21pbnV0ZXMoIGxpc3QuZ2VuZXJhdG9yX3RvLnZhbHVlICk7XG5cdFx0XHRpbnRlcnZhbF9taW51dGVzID0gcGFyc2VJbnQoIGxpc3QuZ2VuZXJhdG9yX2ludGVydmFsLnZhbHVlLCAxMCApO1xuXHRcdFx0aWYgKCBudWxsID09PSBzdGFydF9taW51dGVzIHx8IG51bGwgPT09IGVuZF9taW51dGVzIHx8IGVuZF9taW51dGVzIDwgc3RhcnRfbWludXRlcyB8fCAhIGlzRmluaXRlKCBpbnRlcnZhbF9taW51dGVzICkgfHwgaW50ZXJ2YWxfbWludXRlcyA8IGVkaXRvci50aW1lX2luY3JlbWVudCB8fCAwICE9PSBpbnRlcnZhbF9taW51dGVzICUgZWRpdG9yLnRpbWVfaW5jcmVtZW50ICkge1xuXHRcdFx0XHRsaXN0LmdlbmVyYXRvcl90by5zZXRBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnLCAndHJ1ZScgKTtcblx0XHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGdldF9tZXNzYWdlKCAnZ2VuZXJhdG9yX2ludmFsaWQnLCAnVGhlIGxhc3QgZ2VuZXJhdGVkIGNob2ljZSBtdXN0IG5vdCBiZSBlYXJsaWVyIHRoYW4gdGhlIGZpcnN0IGNob2ljZS4nICkgKTtcblx0XHRcdFx0bGlzdC5nZW5lcmF0b3JfdG8uZm9jdXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRsaXN0LmdlbmVyYXRvcl90by5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnICk7XG5cdFx0XHRmb3IgKCBtaW51dGUgPSBzdGFydF9taW51dGVzOyBtaW51dGUgPD0gZW5kX21pbnV0ZXMgJiYgZ2VuZXJhdGVkX3ZhbHVlcy5sZW5ndGggPCBlZGl0b3IubWF4X3RpbWVzOyBtaW51dGUgKz0gaW50ZXJ2YWxfbWludXRlcyApIHtcblx0XHRcdFx0aWYgKCAtMSAhPT0gbGlzdC5vcHRpb25fdmFsdWVzLmluZGV4T2YoIG1pbnV0ZXNfdG9fdGltZSggbWludXRlICkgKSApIHtcblx0XHRcdFx0XHRnZW5lcmF0ZWRfdmFsdWVzLnB1c2goIG1pbnV0ZXNfdG9fdGltZSggbWludXRlICkgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bGlzdC52YWx1ZXMgPSBnZW5lcmF0ZWRfdmFsdWVzO1xuXHRcdFx0cmVuZGVyX2xpc3QoIGxpc3RfaWQgKTtcblx0XHRcdGZvY3VzX2Nob2ljZSggbGlzdF9pZCwgMCApO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCBlZGl0b3IuZmllbGRfaWQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGaW5kIHRoZSBuZXh0IHVudXNlZCBzZXJ2ZXItb3duZWQgb3B0aW9uLlxuXHRcdCAqXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IGxpc3QgTGlzdCBzdGF0ZS5cblx0XHQgKiBAcmV0dXJuIHtzdHJpbmd8bnVsbH0gUHJvcG9zZWQgdmFsdWUgb3IgbnVsbC5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBmaW5kX2Nob2ljZV9wcm9wb3NhbCggbGlzdCApIHtcblx0XHRcdHZhciBzdGFydF9pbmRleCA9IGxpc3QudmFsdWVzLmxlbmd0aCA/IGxpc3Qub3B0aW9uX3ZhbHVlcy5pbmRleE9mKCBsaXN0LnZhbHVlc1sgbGlzdC52YWx1ZXMubGVuZ3RoIC0gMSBdICkgKyAxIDogMDtcblx0XHRcdHZhciBvZmZzZXQ7XG5cdFx0XHR2YXIgY2FuZGlkYXRlX3ZhbHVlO1xuXG5cdFx0XHRmb3IgKCBvZmZzZXQgPSAwOyBvZmZzZXQgPCBsaXN0Lm9wdGlvbl92YWx1ZXMubGVuZ3RoOyBvZmZzZXQgKz0gMSApIHtcblx0XHRcdFx0Y2FuZGlkYXRlX3ZhbHVlID0gbGlzdC5vcHRpb25fdmFsdWVzWyAoIHN0YXJ0X2luZGV4ICsgb2Zmc2V0ICkgJSBsaXN0Lm9wdGlvbl92YWx1ZXMubGVuZ3RoIF07XG5cdFx0XHRcdGlmICggLTEgPT09IGxpc3QudmFsdWVzLmluZGV4T2YoIGNhbmRpZGF0ZV92YWx1ZSApICkge1xuXHRcdFx0XHRcdHJldHVybiBjYW5kaWRhdGVfdmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWRkIG9uZSB1bnVzZWQgc2VydmVyLW93bmVkIGNob2ljZS5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBsaXN0X2lkIFN0YWJsZSBsaXN0IGlkZW50aWZpZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBhZGRfY2hvaWNlKCBsaXN0X2lkICkge1xuXHRcdFx0dmFyIGxpc3QgPSBnZXRfbGlzdCggbGlzdF9pZCApO1xuXHRcdFx0dmFyIHByb3Bvc2FsO1xuXG5cdFx0XHRpZiAoICEgbGlzdCB8fCBsaXN0LnZhbHVlcy5sZW5ndGggPj0gZWRpdG9yLm1heF90aW1lcyApIHtcblx0XHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGdldF9tZXNzYWdlKCAndGltZV9saW1pdCcsICdObyBhZGRpdGlvbmFsIGNob2ljZSBjYW4gYmUgYWRkZWQgdG8gdGhpcyBsaXN0LicgKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHByb3Bvc2FsID0gZmluZF9jaG9pY2VfcHJvcG9zYWwoIGxpc3QgKTtcblx0XHRcdGlmICggISBwcm9wb3NhbCApIHtcblx0XHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGdldF9tZXNzYWdlKCAndGltZV9saW1pdCcsICdObyBhZGRpdGlvbmFsIGNob2ljZSBjYW4gYmUgYWRkZWQgdG8gdGhpcyBsaXN0LicgKSApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxpc3QudmFsdWVzLnB1c2goIHByb3Bvc2FsICk7XG5cdFx0XHRyZW5kZXJfbGlzdCggbGlzdF9pZCApO1xuXHRcdFx0Zm9jdXNfY2hvaWNlKCBsaXN0X2lkLCBsaXN0LnZhbHVlcy5sZW5ndGggLSAxICk7XG5cdFx0XHRzaGVsbF9hcGkuY2xlYXJfZmllbGRfZXJyb3IoIGVkaXRvci5maWVsZF9pZCApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENsZWFyIG9uZSBsaXN0IGFuZCBrZWVwIGZvY3VzIHdpdGhpbiBpdHMgYWN0aW9uIGFyZWEuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGlzdF9pZCBTdGFibGUgbGlzdCBpZGVudGlmaWVyLlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gY2xlYXJfY2hvaWNlcyggbGlzdF9pZCApIHtcblx0XHRcdHZhciBsaXN0ID0gZ2V0X2xpc3QoIGxpc3RfaWQgKTtcblxuXHRcdFx0aWYgKCAhIGxpc3QgfHwgISBsaXN0LnZhbHVlcy5sZW5ndGggKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGlzdC52YWx1ZXMgPSBbXTtcblx0XHRcdHJlbmRlcl9saXN0KCBsaXN0X2lkICk7XG5cdFx0XHRsaXN0LmFkZF9idXR0b24uZm9jdXMoKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0XHRzaGVsbF9hcGkuc2V0X3N0YXR1cyggbGlzdC5jbGVhcl9zdGF0dXMgfHwgZ2V0X21lc3NhZ2UoIGxpc3RfaWQgKyAnX2NsZWFyZWQnLCAnQ2hvaWNlcyBjbGVhcmVkLicgKSApO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIE1vdmUgb25lIGNob2ljZSBpbnNpZGUgaXRzIGxpc3QuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gbGlzdF9pZCBTdGFibGUgbGlzdCBpZGVudGlmaWVyLlxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBzb3VyY2VfaW5kZXggQ3VycmVudCBpbmRleC5cblx0XHQgKiBAcGFyYW0ge251bWJlcn0gdGFyZ2V0X2luZGV4IFRhcmdldCBpbmRleC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1vdmVfY2hvaWNlKCBsaXN0X2lkLCBzb3VyY2VfaW5kZXgsIHRhcmdldF9pbmRleCApIHtcblx0XHRcdHZhciBsaXN0ID0gZ2V0X2xpc3QoIGxpc3RfaWQgKTtcblx0XHRcdHZhciBtb3ZlZF92YWx1ZTtcblxuXHRcdFx0aWYgKCAhIGxpc3QgfHwgc291cmNlX2luZGV4ID09PSB0YXJnZXRfaW5kZXggfHwgc291cmNlX2luZGV4IDwgMCB8fCB0YXJnZXRfaW5kZXggPCAwIHx8IHNvdXJjZV9pbmRleCA+PSBsaXN0LnZhbHVlcy5sZW5ndGggfHwgdGFyZ2V0X2luZGV4ID49IGxpc3QudmFsdWVzLmxlbmd0aCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRtb3ZlZF92YWx1ZSA9IGxpc3QudmFsdWVzLnNwbGljZSggc291cmNlX2luZGV4LCAxIClbMF07XG5cdFx0XHRsaXN0LnZhbHVlcy5zcGxpY2UoIHRhcmdldF9pbmRleCwgMCwgbW92ZWRfdmFsdWUgKTtcblx0XHRcdHJlbmRlcl9saXN0KCBsaXN0X2lkICk7XG5cdFx0XHRmb2N1c19tb3ZlX2NvbnRyb2woIGxpc3RfaWQsIHRhcmdldF9pbmRleCApO1xuXHRcdFx0c2hlbGxfYXBpLmNsZWFyX2ZpZWxkX2Vycm9yKCBlZGl0b3IuZmllbGRfaWQgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbml0aWFsaXplIFNvcnRhYmxlSlMgZm9yIG9uZSBsaXN0IHdpdGhvdXQgY3Jvc3MtbGlzdCBtb3Zlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBsaXN0X2lkIFN0YWJsZSBsaXN0IGlkZW50aWZpZXIuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplX3NvcnRhYmxlX2xpc3QoIGxpc3RfaWQgKSB7XG5cdFx0XHR2YXIgbGlzdCA9IGdldF9saXN0KCBsaXN0X2lkICk7XG5cblx0XHRcdGlmICggISBsaXN0IHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuU29ydGFibGUgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGlzdC5zb3J0YWJsZSA9IG5ldyB3aW5kb3cuU29ydGFibGUoIGxpc3Qubm9kZSwge1xuXHRcdFx0XHRhbmltYXRpb246IDEyMCxcblx0XHRcdFx0ZHJhZ2dhYmxlOiAnW2RhdGEtdGltZS1pbmRleF0nLFxuXHRcdFx0XHRoYW5kbGU6ICdbZGF0YS13cGJjLW1vdmUtdGltZV0nLFxuXHRcdFx0XHRnaG9zdENsYXNzOiAnaXMtZHJhZy1wbGFjZWhvbGRlcicsXG5cdFx0XHRcdGNob3NlbkNsYXNzOiAnaXMtZHJhZ2dpbmcnLFxuXHRcdFx0XHRkcmFnQ2xhc3M6ICdpcy1kcmFnZ2luZycsXG5cdFx0XHRcdG9uRW5kOiBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdFx0XHRcdHZhciBzb3VyY2VfaW5kZXggPSBOdW1iZXIoIGV2ZW50Lm9sZEluZGV4ICk7XG5cdFx0XHRcdFx0dmFyIHRhcmdldF9pbmRleCA9IE51bWJlciggZXZlbnQubmV3SW5kZXggKTtcblxuXHRcdFx0XHRcdGlmICggTnVtYmVyLmlzSW50ZWdlciggc291cmNlX2luZGV4ICkgJiYgTnVtYmVyLmlzSW50ZWdlciggdGFyZ2V0X2luZGV4ICkgKSB7XG5cdFx0XHRcdFx0XHRtb3ZlX2Nob2ljZSggbGlzdF9pZCwgc291cmNlX2luZGV4LCB0YXJnZXRfaW5kZXggKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVuZGVyX2xpc3QoIGxpc3RfaWQgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGUgZ2VuZXJhdG9yLCBhZGQsIGNsZWFyLCBjb3B5LCBhbmQgcmVtb3ZlIGFjdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGV2ZW50IERlbGVnYXRlZCBjbGljayBldmVudC5cblx0XHQgKiBAcmV0dXJuIHt2b2lkfVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIGhhbmRsZV9jbGljayggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY29weV9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtY29weS10aW1lc10nICk7XG5cdFx0XHR2YXIgZ2VuZXJhdG9yID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWUtZ2VuZXJhdG9yXScgKTtcblx0XHRcdHZhciBsaXN0X3BhbmVsID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXRpbWUtbGlzdC1wYW5lbF0nICk7XG5cdFx0XHR2YXIgY2hvaWNlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS10aW1lLWluZGV4XScgKTtcblxuXHRcdFx0aWYgKCBjb3B5X2J1dHRvbiApIHtcblx0XHRcdFx0dmFyIHNvdXJjZV9saXN0ID0gZ2V0X2xpc3QoIGNvcHlfYnV0dG9uLmRhdGFzZXQuc291cmNlTGlzdCApO1xuXHRcdFx0XHR2YXIgdGFyZ2V0X2xpc3QgPSBnZXRfbGlzdCggY29weV9idXR0b24uZGF0YXNldC50YXJnZXRMaXN0ICk7XG5cblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0aWYgKCBzb3VyY2VfbGlzdCAmJiB0YXJnZXRfbGlzdCApIHtcblx0XHRcdFx0XHR0YXJnZXRfbGlzdC52YWx1ZXMgPSBzb3VyY2VfbGlzdC52YWx1ZXMuZmlsdGVyKCBmdW5jdGlvbiAoIGNob2ljZV92YWx1ZSApIHtcblx0XHRcdFx0XHRcdHJldHVybiAtMSAhPT0gdGFyZ2V0X2xpc3Qub3B0aW9uX3ZhbHVlcy5pbmRleE9mKCBjaG9pY2VfdmFsdWUgKTtcblx0XHRcdFx0XHR9ICk7XG5cdFx0XHRcdFx0cmVuZGVyX2xpc3QoIHRhcmdldF9saXN0LmlkICk7XG5cdFx0XHRcdFx0Zm9jdXNfY2hvaWNlKCB0YXJnZXRfbGlzdC5pZCwgMCApO1xuXHRcdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0XHRcdFx0c2hlbGxfYXBpLnNldF9zdGF0dXMoIGNvcHlfYnV0dG9uLmRhdGFzZXQuc3RhdHVzIHx8ICcnICk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGdlbmVyYXRvciAmJiBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtZ2VuZXJhdGUtdGltZXNdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRnZW5lcmF0ZV9jaG9pY2VzKCBnZW5lcmF0b3IuZGF0YXNldC53cGJjVGltZUdlbmVyYXRvciApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggbGlzdF9wYW5lbCAmJiBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYWRkLXRpbWVdJyApICkge1xuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRhZGRfY2hvaWNlKCBsaXN0X3BhbmVsLmRhdGFzZXQud3BiY1RpbWVMaXN0UGFuZWwgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGxpc3RfcGFuZWwgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWNsZWFyLXRpbWVzXScgKSApIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0Y2xlYXJfY2hvaWNlcyggbGlzdF9wYW5lbC5kYXRhc2V0LndwYmNUaW1lTGlzdFBhbmVsICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCBjaG9pY2UgJiYgZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXJlbW92ZS10aW1lXScgKSApIHtcblx0XHRcdFx0dmFyIGxpc3QgPSBnZXRfbGlzdCggY2hvaWNlLmRhdGFzZXQudGltZUxpc3QgKTtcblx0XHRcdFx0dmFyIGl0ZW1faW5kZXggPSBwYXJzZUludCggY2hvaWNlLmRhdGFzZXQudGltZUluZGV4LCAxMCApO1xuXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGlmICggbGlzdCApIHtcblx0XHRcdFx0XHRsaXN0LnZhbHVlcy5zcGxpY2UoIGl0ZW1faW5kZXgsIDEgKTtcblx0XHRcdFx0XHRyZW5kZXJfbGlzdCggbGlzdC5pZCApO1xuXHRcdFx0XHRcdGZvY3VzX2Nob2ljZSggbGlzdC5pZCwgTWF0aC5taW4oIGl0ZW1faW5kZXgsIGxpc3QudmFsdWVzLmxlbmd0aCAtIDEgKSApO1xuXHRcdFx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTeW5jaHJvbml6ZSBvbmUgY2hhbmdlZCBjaG9pY2UuXG5cdFx0ICpcblx0XHQgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBEZWxlZ2F0ZWQgY2hhbmdlIGV2ZW50LlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaGFuZGxlX2NoYW5nZSggZXZlbnQgKSB7XG5cdFx0XHR2YXIgY2hvaWNlO1xuXHRcdFx0dmFyIGxpc3Q7XG5cdFx0XHR2YXIgaXRlbV9pbmRleDtcblxuXHRcdFx0aWYgKCAhIGV2ZW50LnRhcmdldC5tYXRjaGVzKCAnW2RhdGEtd3BiYy10aW1lLWNob2ljZV0nICkgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y2hvaWNlID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS10aW1lLWluZGV4XScgKTtcblx0XHRcdGxpc3QgPSBjaG9pY2UgPyBnZXRfbGlzdCggY2hvaWNlLmRhdGFzZXQudGltZUxpc3QgKSA6IG51bGw7XG5cdFx0XHRpdGVtX2luZGV4ID0gY2hvaWNlID8gcGFyc2VJbnQoIGNob2ljZS5kYXRhc2V0LnRpbWVJbmRleCwgMTAgKSA6IC0xO1xuXHRcdFx0aWYgKCAhIGxpc3QgfHwgaXRlbV9pbmRleCA8IDAgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGlzdC52YWx1ZXNbIGl0ZW1faW5kZXggXSA9IGV2ZW50LnRhcmdldC52YWx1ZTtcblx0XHRcdHJlbmRlcl9saXN0KCBsaXN0LmlkICk7XG5cdFx0XHRmb2N1c19jaG9pY2UoIGxpc3QuaWQsIGl0ZW1faW5kZXggKTtcblx0XHRcdHNoZWxsX2FwaS5jbGVhcl9maWVsZF9lcnJvciggZWRpdG9yLmZpZWxkX2lkICk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUHJvdmlkZSBrZXlib2FyZCByZW9yZGVyaW5nIGVxdWl2YWxlbnQgdG8gZHJhZyBhbmQgZHJvcC5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZXZlbnQgRGVsZWdhdGVkIGtleWRvd24gZXZlbnQuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBoYW5kbGVfa2V5ZG93biggZXZlbnQgKSB7XG5cdFx0XHR2YXIgbW92ZV9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtbW92ZS10aW1lXScgKTtcblx0XHRcdHZhciBjaG9pY2U7XG5cdFx0XHR2YXIgaXRlbV9pbmRleDtcblx0XHRcdHZhciB0YXJnZXRfaW5kZXg7XG5cblx0XHRcdGlmICggISBtb3ZlX2J1dHRvbiB8fCAhIFsgJ0Fycm93TGVmdCcsICdBcnJvd1JpZ2h0JywgJ0Fycm93VXAnLCAnQXJyb3dEb3duJyBdLmluY2x1ZGVzKCBldmVudC5rZXkgKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjaG9pY2UgPSBtb3ZlX2J1dHRvbi5jbG9zZXN0KCAnW2RhdGEtdGltZS1pbmRleF0nICk7XG5cdFx0XHRpdGVtX2luZGV4ID0gcGFyc2VJbnQoIGNob2ljZS5kYXRhc2V0LnRpbWVJbmRleCwgMTAgKTtcblx0XHRcdHRhcmdldF9pbmRleCA9IFsgJ0Fycm93TGVmdCcsICdBcnJvd1VwJyBdLmluY2x1ZGVzKCBldmVudC5rZXkgKSA/IGl0ZW1faW5kZXggLSAxIDogaXRlbV9pbmRleCArIDE7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0bW92ZV9jaG9pY2UoIGNob2ljZS5kYXRhc2V0LnRpbWVMaXN0LCBpdGVtX2luZGV4LCB0YXJnZXRfaW5kZXggKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJbml0aWFsaXplIG9uZSBzZXJ2ZXItZGVmaW5lZCBsaXN0IGZyb20gRE9NIGFuZCBjaGVja3BvaW50IHZhbHVlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGxpc3Rfbm9kZSBMaXN0IGNvbnRhaW5lci5cblx0XHQgKiBAcGFyYW0ge3N0cmluZ1tdfSB2YWx1ZXMgU3RvcmVkIGxpc3QgdmFsdWVzLlxuXHRcdCAqIEByZXR1cm4ge09iamVjdHxudWxsfSBMaXN0IHN0YXRlIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaW5pdGlhbGl6ZV9saXN0KCBsaXN0X25vZGUsIHZhbHVlcyApIHtcblx0XHRcdHZhciBsaXN0X2lkID0gbGlzdF9ub2RlLmRhdGFzZXQud3BiY1RpbWVDaG9pY2VMaXN0O1xuXHRcdFx0dmFyIHBhbmVsID0gZWRpdG9yLm5vZGUucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZS1saXN0LXBhbmVsPVwiJyArIGxpc3RfaWQgKyAnXCJdJyApO1xuXHRcdFx0dmFyIGdlbmVyYXRvciA9IHBhbmVsID8gcGFuZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZS1nZW5lcmF0b3JdJyApIDogbnVsbDtcblx0XHRcdHZhciB0ZW1wbGF0ZSA9IHNoZWxsX2FwaS5yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWUtY2hvaWNlLXRlbXBsYXRlPVwiJyArIGxpc3RfaWQgKyAnXCJdJyApO1xuXHRcdFx0dmFyIHRlbXBsYXRlX3NlbGVjdCA9IHRlbXBsYXRlID8gdGVtcGxhdGUuY29udGVudC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy10aW1lLWNob2ljZV0nICkgOiBudWxsO1xuXG5cdFx0XHRpZiAoICEgcGFuZWwgfHwgISBnZW5lcmF0b3IgfHwgISB0ZW1wbGF0ZSB8fCAhIHRlbXBsYXRlX3NlbGVjdCApIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGlkOiBsaXN0X2lkLFxuXHRcdFx0XHRub2RlOiBsaXN0X25vZGUsXG5cdFx0XHRcdHRlbXBsYXRlOiB0ZW1wbGF0ZSxcblx0XHRcdFx0bGFiZWw6IGxpc3Rfbm9kZS5kYXRhc2V0Lmxpc3RMYWJlbCB8fCBsaXN0X2lkLFxuXHRcdFx0XHRjbGVhcl9zdGF0dXM6IGxpc3Rfbm9kZS5kYXRhc2V0LmNsZWFyU3RhdHVzIHx8ICcnLFxuXHRcdFx0XHR2YWx1ZXM6IEFycmF5LmlzQXJyYXkoIHZhbHVlcyApID8gdmFsdWVzLnNsaWNlKCkgOiBbXSxcblx0XHRcdFx0b3B0aW9uX3ZhbHVlczogQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKCB0ZW1wbGF0ZV9zZWxlY3Qub3B0aW9ucywgZnVuY3Rpb24gKCBvcHRpb24gKSB7IHJldHVybiBvcHRpb24udmFsdWU7IH0gKSxcblx0XHRcdFx0YWRkX2J1dHRvbjogcGFuZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYWRkLXRpbWVdJyApLFxuXHRcdFx0XHRjbGVhcl9idXR0b246IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWNsZWFyLXRpbWVzXScgKSxcblx0XHRcdFx0Z2VuZXJhdG9yX2Zyb206IGdlbmVyYXRvci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1nZW5lcmF0b3ItZnJvbV0nICksXG5cdFx0XHRcdGdlbmVyYXRvcl90bzogZ2VuZXJhdG9yLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWdlbmVyYXRvci10b10nICksXG5cdFx0XHRcdGdlbmVyYXRvcl9pbnRlcnZhbDogZ2VuZXJhdG9yLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWdlbmVyYXRvci1pbnRlcnZhbF0nICksXG5cdFx0XHRcdHNvcnRhYmxlOiBudWxsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEluaXRpYWxpemUgdGhpcyBtb2R1bGUgYWdhaW5zdCBzaGVsbC1wcm92aWRlZCBzZXJ2aWNlcy5cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSByZWdpc3RlcmVkX3NoZWxsX2FwaSBTaGFyZWQgd2l6YXJkIGFkYXB0ZXIgc2VydmljZXMuXG5cdFx0ICogQHJldHVybiB7dm9pZH1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0aWFsaXplKCByZWdpc3RlcmVkX3NoZWxsX2FwaSApIHtcblx0XHRcdHZhciBwYXJzZWRfdmFsdWVzO1xuXHRcdFx0dmFyIGVkaXRvcl9ub2RlO1xuXHRcdFx0dmFyIHRyYW5zcG9ydDtcblxuXHRcdFx0c2hlbGxfYXBpID0gcmVnaXN0ZXJlZF9zaGVsbF9hcGk7XG5cdFx0XHRlZGl0b3Jfbm9kZSA9IHNoZWxsX2FwaS5yb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXRpbWUtY2hvaWNlcy1lZGl0b3JdJyApO1xuXHRcdFx0dHJhbnNwb3J0ID0gc2hlbGxfYXBpLnJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtdGltZS1jaG9pY2VzLWRyYWZ0XScgKTtcblx0XHRcdGlmICggISBlZGl0b3Jfbm9kZSB8fCAhIHRyYW5zcG9ydCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRwYXJzZWRfdmFsdWVzID0gSlNPTi5wYXJzZSggdHJhbnNwb3J0LnZhbHVlIHx8ICd7fScgKTtcblx0XHRcdH0gY2F0Y2ggKCBwYXJzZV9lcnJvciApIHtcblx0XHRcdFx0cGFyc2VkX3ZhbHVlcyA9IHt9O1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3IgPSB7XG5cdFx0XHRcdG5vZGU6IGVkaXRvcl9ub2RlLFxuXHRcdFx0XHR0cmFuc3BvcnQ6IHRyYW5zcG9ydCxcblx0XHRcdFx0ZmllbGRfaWQ6IGVkaXRvcl9ub2RlLmRhdGFzZXQuZmllbGRJZCB8fCBjb25maWcuZmllbGRfaWQgfHwgJ3N0YXJ0X2VuZF90aW1lcycsXG5cdFx0XHRcdHZhbGlkYXRpb25fcnVsZTogZWRpdG9yX25vZGUuZGF0YXNldC52YWxpZGF0aW9uUnVsZSB8fCAnaW5kZXBlbmRlbnRfbGlzdHMnLFxuXHRcdFx0XHRtYXhfdGltZXM6IHBhcnNlSW50KCB0cmFuc3BvcnQuZGF0YXNldC5tYXhUaW1lcyB8fCBTdHJpbmcoIGNvbmZpZy5tYXhfdGltZXNfcGVyX2xpc3QgfHwgMjg4ICksIDEwICksXG5cdFx0XHRcdHRpbWVfaW5jcmVtZW50OiBwYXJzZUludCggdHJhbnNwb3J0LmRhdGFzZXQudGltZUluY3JlbWVudCB8fCBTdHJpbmcoIGNvbmZpZy50aW1lX2luY3JlbWVudCB8fCA1ICksIDEwICksXG5cdFx0XHRcdGxpc3Rfb3JkZXI6IFtdLFxuXHRcdFx0XHRsaXN0czoge31cblx0XHRcdH07XG5cblx0XHRcdGVkaXRvci5ub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICdbZGF0YS13cGJjLXRpbWUtY2hvaWNlLWxpc3RdJyApLmZvckVhY2goIGZ1bmN0aW9uICggbGlzdF9ub2RlICkge1xuXHRcdFx0XHR2YXIgbGlzdF9pZCA9IGxpc3Rfbm9kZS5kYXRhc2V0LndwYmNUaW1lQ2hvaWNlTGlzdDtcblx0XHRcdFx0dmFyIGxpc3QgPSBpbml0aWFsaXplX2xpc3QoIGxpc3Rfbm9kZSwgcGFyc2VkX3ZhbHVlc1sgbGlzdF9pZCBdICk7XG5cblx0XHRcdFx0aWYgKCBsaXN0ICkge1xuXHRcdFx0XHRcdGVkaXRvci5saXN0X29yZGVyLnB1c2goIGxpc3RfaWQgKTtcblx0XHRcdFx0XHRlZGl0b3IubGlzdHNbIGxpc3RfaWQgXSA9IGxpc3Q7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0aWYgKCAhIGVkaXRvci5saXN0X29yZGVyLmxlbmd0aCApIHtcblx0XHRcdFx0ZWRpdG9yID0gbnVsbDtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBoYW5kbGVfY2xpY2sgKTtcblx0XHRcdGVkaXRvci5ub2RlLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBoYW5kbGVfY2hhbmdlICk7XG5cdFx0XHRlZGl0b3Iubm9kZS5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGhhbmRsZV9rZXlkb3duICk7XG5cdFx0XHRyZW5kZXJfZWRpdG9yKCk7XG5cdFx0XHRlZGl0b3IubGlzdF9vcmRlci5mb3JFYWNoKCBpbml0aWFsaXplX3NvcnRhYmxlX2xpc3QgKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBWYWxpZGF0ZSByZXF1aXJlZCwgdW5pcXVlLCBhbGxvdy1saXN0ZWQsIGFuZCByb3V0ZS1zcGVjaWZpYyBjaG9pY2VzLlxuXHRcdCAqXG5cdFx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gRmlyc3QgaW52YWxpZCBjb250cm9sIG9yIG51bGwuXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdmFsaWRhdGUoKSB7XG5cdFx0XHR2YXIgZmlyc3RfaW52YWxpZCA9IG51bGw7XG5cblx0XHRcdGlmICggISBlZGl0b3IgKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRlZGl0b3Iubm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnW2FyaWEtaW52YWxpZD1cInRydWVcIl0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0XHRjb250cm9sLnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcgKTtcblx0XHRcdH0gKTtcblxuXHRcdFx0ZWRpdG9yLmxpc3Rfb3JkZXIuc29tZSggZnVuY3Rpb24gKCBsaXN0X2lkICkge1xuXHRcdFx0XHR2YXIgbGlzdCA9IGVkaXRvci5saXN0c1sgbGlzdF9pZCBdO1xuXHRcdFx0XHR2YXIgZHVwbGljYXRlX2luZGV4O1xuXG5cdFx0XHRcdGlmICggISBsaXN0LnZhbHVlcy5sZW5ndGggKSB7XG5cdFx0XHRcdFx0Zmlyc3RfaW52YWxpZCA9IHNldF9jaG9pY2VfZXJyb3IoIGdldF9tZXNzYWdlKCBsaXN0X2lkICsgJ19yZXF1aXJlZCcsICdBZGQgYXQgbGVhc3Qgb25lIGNob2ljZS4nICksIGxpc3RfaWQsIC0xICk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdFx0aWYgKCBsaXN0LnZhbHVlcy5zb21lKCBmdW5jdGlvbiAoIGNob2ljZV92YWx1ZSApIHsgcmV0dXJuIC0xID09PSBsaXN0Lm9wdGlvbl92YWx1ZXMuaW5kZXhPZiggY2hvaWNlX3ZhbHVlICk7IH0gKSApIHtcblx0XHRcdFx0XHRmaXJzdF9pbnZhbGlkID0gc2V0X2Nob2ljZV9lcnJvciggZ2V0X21lc3NhZ2UoICd0aW1lX3ZhbHVlX2ludmFsaWQnLCAnQ2hvb3NlIGEgc3VwcG9ydGVkIHZhbHVlIGZvciBldmVyeSBjaG9pY2UuJyApLCBsaXN0X2lkLCAwICk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdFx0ZHVwbGljYXRlX2luZGV4ID0gZmluZF9kdXBsaWNhdGVfaW5kZXgoIGxpc3QudmFsdWVzICk7XG5cdFx0XHRcdGlmICggLTEgIT09IGR1cGxpY2F0ZV9pbmRleCApIHtcblx0XHRcdFx0XHRmaXJzdF9pbnZhbGlkID0gc2V0X2Nob2ljZV9lcnJvciggZ2V0X21lc3NhZ2UoICd0aW1lX2R1cGxpY2F0ZScsICdUaGUgc2FtZSBjaG9pY2UgY2Fubm90IGFwcGVhciB0d2ljZSBpbiBvbmUgbGlzdC4nICksIGxpc3RfaWQsIGR1cGxpY2F0ZV9pbmRleCApO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSApO1xuXG5cdFx0XHRpZiAoICEgZmlyc3RfaW52YWxpZCAmJiAnZW5kX2FmdGVyX3N0YXJ0JyA9PT0gZWRpdG9yLnZhbGlkYXRpb25fcnVsZSAmJiBlZGl0b3IubGlzdHMuc3RhcnRfdGltZXMgJiYgZWRpdG9yLmxpc3RzLmVuZF90aW1lcyApIHtcblx0XHRcdFx0dmFyIHN0YXJ0X21pbnV0ZXMgPSBlZGl0b3IubGlzdHMuc3RhcnRfdGltZXMudmFsdWVzLm1hcCggdGltZV90b19taW51dGVzICk7XG5cdFx0XHRcdHZhciBlbmRfbWludXRlcyA9IGVkaXRvci5saXN0cy5lbmRfdGltZXMudmFsdWVzLm1hcCggdGltZV90b19taW51dGVzICk7XG5cblx0XHRcdFx0aWYgKCBzdGFydF9taW51dGVzLnNvbWUoIGZ1bmN0aW9uICggdmFsdWUgKSB7IHJldHVybiBudWxsID09PSB2YWx1ZTsgfSApIHx8IGVuZF9taW51dGVzLnNvbWUoIGZ1bmN0aW9uICggdmFsdWUgKSB7IHJldHVybiBudWxsID09PSB2YWx1ZTsgfSApIHx8IE1hdGgubWF4LmFwcGx5KCBudWxsLCBlbmRfbWludXRlcyApIDw9IE1hdGgubWluLmFwcGx5KCBudWxsLCBzdGFydF9taW51dGVzICkgKSB7XG5cdFx0XHRcdFx0Zmlyc3RfaW52YWxpZCA9IHNldF9jaG9pY2VfZXJyb3IoIGdldF9tZXNzYWdlKCAndGltZV9wYWlyX2ludmFsaWQnLCAnQWRkIGFuIGVuZCB0aW1lIHRoYXQgaXMgbGF0ZXIgdGhhbiBhdCBsZWFzdCBvbmUgc3RhcnQgdGltZS4nICksICdlbmRfdGltZXMnLCAwICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0c3luY190aW1lX2Nob2ljZXNfZHJhZnQoKTtcblx0XHRcdHJldHVybiBmaXJzdF9pbnZhbGlkO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpbml0aWFsaXplOiBpbml0aWFsaXplLFxuXHRcdFx0c3luYzogc3luY190aW1lX2Nob2ljZXNfZHJhZnQsXG5cdFx0XHR2YWxpZGF0ZTogdmFsaWRhdGVcblx0XHR9O1xuXHR9XG5cblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXMgPSB3aW5kb3cud3BiY19zZXR1cF9lZGl0b3JfbW9kdWxlcyB8fCB7fTtcblx0d2luZG93LndwYmNfc2V0dXBfZWRpdG9yX21vZHVsZXNbIG1vZHVsZV9jb25maWcubW9kdWxlX2lkIHx8ICdzdGFydF9lbmRfdGltZXMnIF0gPSB7XG5cdFx0Y3JlYXRlOiBjcmVhdGVfdGltZV9jaG9pY2VzX2FkYXB0ZXJcblx0fTtcblxuXHRpZiAoIHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkucmVnaXN0ZXJfc3RlcF9hZGFwdGVyICkge1xuXHRcdHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkucmVnaXN0ZXJfc3RlcF9hZGFwdGVyKCBjcmVhdGVfdGltZV9jaG9pY2VzX2FkYXB0ZXIoIG1vZHVsZV9jb25maWcgKSApO1xuXHR9XG59KCB3aW5kb3cgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUUsV0FBV0EsTUFBTSxFQUFHO0VBQ3JCLFlBQVk7O0VBRVosSUFBSUMsYUFBYSxHQUFHRCxNQUFNLENBQUNFLGlDQUFpQyxJQUFJO0lBQUVDLElBQUksRUFBRSxDQUFDO0VBQUUsQ0FBQzs7RUFFNUU7QUFDRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQywyQkFBMkJBLENBQUVDLE1BQU0sRUFBRztJQUM5QyxJQUFJQyxTQUFTLEdBQUcsSUFBSTtJQUNwQixJQUFJQyxNQUFNLEdBQUcsSUFBSTs7SUFFakI7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDRSxTQUFTQyxXQUFXQSxDQUFFQyxHQUFHLEVBQUVDLFFBQVEsRUFBRztNQUNyQyxPQUFPTCxNQUFNLENBQUNGLElBQUksSUFBSUUsTUFBTSxDQUFDRixJQUFJLENBQUVNLEdBQUcsQ0FBRSxHQUFHSixNQUFNLENBQUNGLElBQUksQ0FBRU0sR0FBRyxDQUFFLEdBQUdDLFFBQVE7SUFDekU7O0lBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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LFdBQVcsQ0FBQzlJLE1BQU0sQ0FBQzRILEdBQUcsQ0FBRS9KLGVBQWdCLENBQUM7UUFDMUUsSUFBSXdGLFdBQVcsR0FBRzVGLE1BQU0sQ0FBQ3FCLEtBQUssQ0FBQ2lLLFNBQVMsQ0FBQy9JLE1BQU0sQ0FBQzRILEdBQUcsQ0FBRS9KLGVBQWdCLENBQUM7UUFFdEUsSUFBS3VGLGFBQWEsQ0FBQzdCLElBQUksQ0FBRSxVQUFXN0IsS0FBSyxFQUFHO1VBQUUsT0FBTyxJQUFJLEtBQUtBLEtBQUs7UUFBRSxDQUFFLENBQUMsSUFBSTJELFdBQVcsQ0FBQzlCLElBQUksQ0FBRSxVQUFXN0IsS0FBSyxFQUFHO1VBQUUsT0FBTyxJQUFJLEtBQUtBLEtBQUs7UUFBRSxDQUFFLENBQUMsSUFBSWxCLElBQUksQ0FBQ3dLLEdBQUcsQ0FBQ0MsS0FBSyxDQUFFLElBQUksRUFBRTVGLFdBQVksQ0FBQyxJQUFJN0UsSUFBSSxDQUFDcUksR0FBRyxDQUFDb0MsS0FBSyxDQUFFLElBQUksRUFBRTdGLGFBQWMsQ0FBQyxFQUFHO1VBQy9Od0YsYUFBYSxHQUFHOUgsZ0JBQWdCLENBQUVwRCxXQUFXLENBQUUsbUJBQW1CLEVBQUUsNkRBQThELENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBRSxDQUFDO1FBQ3RKO01BQ0Q7TUFFQWtDLHVCQUF1QixDQUFDLENBQUM7TUFDekIsT0FBT2dKLGFBQWE7SUFDckI7SUFFQSxPQUFPO01BQ05mLFVBQVUsRUFBRUEsVUFBVTtNQUN0QnFCLElBQUksRUFBRXRKLHVCQUF1QjtNQUM3QitJLFFBQVEsRUFBRUE7SUFDWCxDQUFDO0VBQ0Y7RUFFQXpMLE1BQU0sQ0FBQ2lNLHlCQUF5QixHQUFHak0sTUFBTSxDQUFDaU0seUJBQXlCLElBQUksQ0FBQyxDQUFDO0VBQ3pFak0sTUFBTSxDQUFDaU0seUJBQXlCLENBQUVoTSxhQUFhLENBQUNpTSxTQUFTLElBQUksaUJBQWlCLENBQUUsR0FBRztJQUNsRkMsTUFBTSxFQUFFL0w7RUFDVCxDQUFDO0VBRUQsSUFBS0osTUFBTSxDQUFDb00scUJBQXFCLElBQUksVUFBVSxLQUFLLE9BQU9wTSxNQUFNLENBQUNvTSxxQkFBcUIsQ0FBQ0MscUJBQXFCLEVBQUc7SUFDL0dyTSxNQUFNLENBQUNvTSxxQkFBcUIsQ0FBQ0MscUJBQXFCLENBQUVqTSwyQkFBMkIsQ0FBRUgsYUFBYyxDQUFFLENBQUM7RUFDbkc7QUFDRCxDQUFDLEVBQUVELE1BQU8sQ0FBQyIsImlnbm9yZUxpc3QiOltdfQ==
