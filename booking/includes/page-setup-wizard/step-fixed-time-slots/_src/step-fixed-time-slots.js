/**
 * Fixed Time Slots editor adapter for the Setup Wizard.
 *
 * @package Booking Calendar
 */
( function ( window ) {
	'use strict';

	var config = window.wpbc_setup_wizard_fixed_time_slots || { i18n: {} };
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
	function create_fixed_time_slots_adapter( runtime_config ) {
		var shell_api = null;
		var editor = null;

		/**
		 * Return one localized message with a safe fallback.
		 *
		 * @param {string} key Message key.
		 * @param {string} fallback Fallback text.
		 * @return {string} Message text.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? config.i18n[ key ] : fallback;
		}

		/**
		 * Convert one exact clock value to minutes after day start.
		 *
		 * @param {string} time_value Clock value.
		 * @param {boolean} allow_day_end Whether `24:00` is accepted.
		 * @return {number|null} Minute count or null.
		 */
		function time_to_minutes( time_value, allow_day_end ) {
			var match;

			if ( allow_day_end && '24:00' === time_value ) {
				return 24 * 60;
			}
			match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec( String( time_value || '' ) );
			if ( ! match ) {
				return null;
			}

			return ( parseInt( time_value.substr( 0, 2 ), 10 ) * 60 ) + parseInt( time_value.substr( 3, 2 ), 10 );
		}

		/**
		 * Convert bounded minute count to `HH:MM`.
		 *
		 * @param {number} minutes Minutes from day start.
		 * @return {string} Clock value.
		 */
		function minutes_to_time( minutes ) {
			var hour = Math.floor( minutes / 60 );
			var minute = minutes % 60;

			return String( hour ).padStart( 2, '0' ) + ':' + String( minute ).padStart( 2, '0' );
		}

		/**
		 * Return a select option label for one value.
		 *
		 * @param {HTMLSelectElement} select Select control.
		 * @param {string} option_value Option value.
		 * @return {string} Visible label or value.
		 */
		function get_option_label( select, option_value ) {
			var option = Array.prototype.find.call( select.options, function ( candidate ) {
				return candidate.value === option_value;
			} );

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
		function get_slot_label( slot, start_select, end_select ) {
			return get_option_label( start_select, slot.start_time ) + ' - ' + get_option_label( end_select, slot.end_time );
		}

		/**
		 * Synchronize the JSON transport with current ordered slots.
		 *
		 * @return {void}
		 */
		function sync_fixed_slots_draft() {
			if ( editor ) {
				editor.transport.value = JSON.stringify( { time_slots: editor.slots } );
			}
		}

		/**
		 * Return one rendered slot control by index.
		 *
		 * @param {number} slot_index Slot index.
		 * @return {HTMLElement|null} Slot element or null.
		 */
		function get_slot_control( slot_index ) {
			return editor ? editor.list.querySelector( '[data-fixed-slot-index="' + slot_index + '"]' ) : null;
		}

		/**
		 * Focus the preferred control after rendering.
		 *
		 * @param {number} slot_index Slot index.
		 * @param {string} control_name Control data suffix.
		 * @return {void}
		 */
		function focus_slot_control( slot_index, control_name ) {
			var slot_control = get_slot_control( slot_index );
			var target = slot_control ? slot_control.querySelector( '[data-wpbc-' + control_name + ']' ) : editor.add_button;

			if ( target ) {
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
			editor.add_button.removeAttribute( 'data-wpbc-setup-wizard-error-control-for' );
			if ( ! editor.slots.length ) {
				editor.add_button.setAttribute( 'data-wpbc-setup-wizard-error-control-for', editor.field_id );
			}

			editor.slots.forEach( function ( slot, slot_index ) {
				var slot_control = editor.template.content.firstElementChild.cloneNode( true );
				var start_select = slot_control.querySelector( '[data-wpbc-fixed-slot-start]' );
				var end_select = slot_control.querySelector( '[data-wpbc-fixed-slot-end]' );
				var start_label = slot_control.querySelector( '[data-wpbc-fixed-slot-start-label]' );
				var end_label = slot_control.querySelector( '[data-wpbc-fixed-slot-end-label]' );
				var move_button = slot_control.querySelector( '[data-wpbc-move-fixed-slot]' );
				var remove_button = slot_control.querySelector( '[data-wpbc-remove-fixed-slot]' );
				var start_id = 'wpbc-fixed-time-slot-start-' + slot_index;
				var end_id = 'wpbc-fixed-time-slot-end-' + slot_index;
				var slot_label;

				slot_control.dataset.fixedSlotIndex = String( slot_index );
				start_select.id = start_id;
				end_select.id = end_id;
				start_select.value = slot.start_time;
				end_select.value = slot.end_time;
				start_label.htmlFor = start_id;
				end_label.htmlFor = end_id;
				if ( 0 === slot_index ) {
					start_select.setAttribute( 'data-wpbc-setup-wizard-error-control-for', editor.field_id );
				}

				slot_label = get_slot_label( slot, start_select, end_select );
				start_label.textContent = editor.list_label + ' ' + ( slot_index + 1 ) + ': start';
				end_label.textContent = editor.list_label + ' ' + ( slot_index + 1 ) + ': end';
				move_button.setAttribute( 'aria-label', get_message( 'move_slot', 'Move fixed time slot %s' ).replace( '%s', slot_label ) );
				remove_button.setAttribute( 'aria-label', get_message( 'remove_slot', 'Remove fixed time slot %s' ).replace( '%s', slot_label ) );
				editor.list.appendChild( slot_control );
			} );

			editor.add_button.disabled = editor.slots.length >= editor.max_time_slots;
			editor.clear_button.disabled = ! editor.slots.length;
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
		function set_slot_error( message, slot_index, control_name ) {
			var slot_control = get_slot_control( slot_index );
			var target = slot_control ? slot_control.querySelector( '[data-wpbc-fixed-slot-' + control_name + ']' ) : editor.add_button;

			shell_api.set_field_error( editor.field_id, message );
			if ( target ) {
				target.setAttribute( 'aria-invalid', 'true' );
			}

			return target;
		}

		/**
		 * Generate ordered fixed slots from independent spacing and duration.
		 *
		 * @return {void}
		 */
		function generate_slots() {
			var from_minutes = time_to_minutes( editor.generator_from.value, false );
			var to_minutes = time_to_minutes( editor.generator_to.value, false );
			var spacing_minutes = parseInt( editor.generator_interval.value, 10 );
			var duration_minutes = parseInt( editor.generator_duration.value, 10 );
			var generated_slots = [];
			var start_minutes;

			editor.generator_to.removeAttribute( 'aria-invalid' );
			editor.generator_duration.removeAttribute( 'aria-invalid' );
			if (
				null === from_minutes
				|| null === to_minutes
				|| to_minutes < from_minutes
				|| ! isFinite( spacing_minutes )
				|| ! isFinite( duration_minutes )
				|| spacing_minutes < editor.time_increment
				|| duration_minutes < editor.time_increment
				|| 0 !== spacing_minutes % editor.time_increment
				|| 0 !== duration_minutes % editor.time_increment
			) {
				editor.generator_to.setAttribute( 'aria-invalid', 'true' );
				shell_api.set_status( get_message( 'generator_invalid', 'Choose a valid first start, last start, spacing, and duration.' ) );
				editor.generator_to.focus();
				return;
			}

			if ( to_minutes + duration_minutes > 24 * 60 ) {
				editor.generator_duration.setAttribute( 'aria-invalid', 'true' );
				shell_api.set_status( get_message( 'generator_day_overflow', 'The generated slot duration must finish by the end of the day.' ) );
				editor.generator_duration.focus();
				return;
			}

			for ( start_minutes = from_minutes; start_minutes <= to_minutes && generated_slots.length < editor.max_time_slots; start_minutes += spacing_minutes ) {
				generated_slots.push( {
					start_time: minutes_to_time( start_minutes ),
					end_time: minutes_to_time( start_minutes + duration_minutes )
				} );
			}

			editor.slots = generated_slots;
			render_slots();
			focus_slot_control( 0, 'fixed-slot-start' );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Determine whether one slot already exists.
		 *
		 * @param {string} start_time Start time.
		 * @param {string} end_time End time.
		 * @return {boolean} True when the exact range exists.
		 */
		function has_slot( start_time, end_time ) {
			return editor.slots.some( function ( slot ) {
				return slot.start_time === start_time && slot.end_time === end_time;
			} );
		}

		/**
		 * Find a valid unused slot proposal using current generator duration.
		 *
		 * @return {Object|null} Proposed slot or null.
		 */
		function find_slot_proposal() {
			var duration_minutes = parseInt( editor.generator_duration.value, 10 );
			var preferred_start = editor.slots.length ? editor.slots[ editor.slots.length - 1 ].end_time : editor.generator_from.value;
			var preferred_index = editor.start_values.indexOf( preferred_start );
			var offset;

			if ( ! isFinite( duration_minutes ) || duration_minutes < editor.time_increment ) {
				duration_minutes = 30;
			}
			preferred_index = -1 === preferred_index ? 0 : preferred_index;

			for ( offset = 0; offset < editor.start_values.length; offset += 1 ) {
				var start_time = editor.start_values[ ( preferred_index + offset ) % editor.start_values.length ];
				var start_minutes = time_to_minutes( start_time, false );
				var end_minutes = start_minutes + duration_minutes;
				var end_time = minutes_to_time( end_minutes );

				if ( end_minutes <= 24 * 60 && -1 !== editor.end_values.indexOf( end_time ) && ! has_slot( start_time, end_time ) ) {
					return { start_time: start_time, end_time: end_time };
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

			if ( editor.slots.length >= editor.max_time_slots ) {
				shell_api.set_status( get_message( 'slot_limit', 'No additional fixed time slot can be added.' ) );
				return;
			}

			proposal = find_slot_proposal();
			if ( ! proposal ) {
				shell_api.set_status( get_message( 'slot_limit', 'No additional fixed time slot can be added.' ) );
				return;
			}

			editor.slots.push( proposal );
			render_slots();
			focus_slot_control( editor.slots.length - 1, 'fixed-slot-start' );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Clear every slot while preserving keyboard focus in the action area.
		 *
		 * @return {void}
		 */
		function clear_slots() {
			if ( ! editor.slots.length ) {
				return;
			}

			editor.slots = [];
			render_slots();
			editor.add_button.focus();
			shell_api.clear_field_error( editor.field_id );
			shell_api.set_status( get_message( 'slots_cleared', 'Fixed time slots cleared.' ) );
		}

		/**
		 * Move one slot within the ordered list.
		 *
		 * @param {number} source_index Current index.
		 * @param {number} target_index Target index.
		 * @return {void}
		 */
		function move_slot( source_index, target_index ) {
			var moved_slot;

			if ( source_index === target_index || source_index < 0 || target_index < 0 || source_index >= editor.slots.length || target_index >= editor.slots.length ) {
				return;
			}

			moved_slot = editor.slots.splice( source_index, 1 )[ 0 ];
			editor.slots.splice( target_index, 0, moved_slot );
			render_slots();
			focus_slot_control( target_index, 'move-fixed-slot' );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Initialize SortableJS for the fixed-slot list.
		 *
		 * @return {void}
		 */
		function initialize_sortable() {
			if ( 'function' !== typeof window.Sortable ) {
				return;
			}

			editor.sortable = new window.Sortable( editor.list, {
				animation: 120,
				draggable: '[data-fixed-slot-index]',
				handle: '[data-wpbc-move-fixed-slot]',
				ghostClass: 'is-drag-placeholder',
				chosenClass: 'is-dragging',
				dragClass: 'is-dragging',
				onEnd: function ( event ) {
					var source_index = Number( event.oldIndex );
					var target_index = Number( event.newIndex );

					if ( Number.isInteger( source_index ) && Number.isInteger( target_index ) ) {
						move_slot( source_index, target_index );
					} else {
						render_slots();
					}
				}
			} );
		}

		/**
		 * Handle generator, add, clear, and remove actions.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var slot_control;
			var slot_index;

			if ( event.target.closest( '[data-wpbc-generate-fixed-slots]' ) ) {
				event.preventDefault();
				generate_slots();
				return;
			}
			if ( event.target.closest( '[data-wpbc-add-fixed-slot]' ) ) {
				event.preventDefault();
				add_slot();
				return;
			}
			if ( event.target.closest( '[data-wpbc-clear-fixed-slots]' ) ) {
				event.preventDefault();
				clear_slots();
				return;
			}

			slot_control = event.target.closest( '[data-fixed-slot-index]' );
			if ( slot_control && event.target.closest( '[data-wpbc-remove-fixed-slot]' ) ) {
				event.preventDefault();
				slot_index = parseInt( slot_control.dataset.fixedSlotIndex, 10 );
				editor.slots.splice( slot_index, 1 );
				render_slots();
				focus_slot_control( Math.min( slot_index, editor.slots.length - 1 ), 'fixed-slot-start' );
				shell_api.clear_field_error( editor.field_id );
			}
		}

		/**
		 * Synchronize a changed start or end select.
		 *
		 * @param {Event} event Delegated change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			var slot_control = event.target.closest( '[data-fixed-slot-index]' );
			var slot_index;

			if ( ! slot_control ) {
				return;
			}
			slot_index = parseInt( slot_control.dataset.fixedSlotIndex, 10 );
			if ( event.target.matches( '[data-wpbc-fixed-slot-start]' ) ) {
				editor.slots[ slot_index ].start_time = event.target.value;
			} else if ( event.target.matches( '[data-wpbc-fixed-slot-end]' ) ) {
				editor.slots[ slot_index ].end_time = event.target.value;
			} else {
				return;
			}

			render_slots();
			focus_slot_control( slot_index, event.target.matches( '[data-wpbc-fixed-slot-start]' ) ? 'fixed-slot-start' : 'fixed-slot-end' );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Provide keyboard reordering equivalent to drag and drop.
		 *
		 * @param {KeyboardEvent} event Delegated keydown event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var move_button = event.target.closest( '[data-wpbc-move-fixed-slot]' );
			var slot_control;
			var slot_index;
			var target_index;

			if ( ! move_button || ! [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ].includes( event.key ) ) {
				return;
			}

			slot_control = move_button.closest( '[data-fixed-slot-index]' );
			slot_index = parseInt( slot_control.dataset.fixedSlotIndex, 10 );
			target_index = [ 'ArrowLeft', 'ArrowUp' ].includes( event.key ) ? slot_index - 1 : slot_index + 1;
			event.preventDefault();
			move_slot( slot_index, target_index );
		}

		/**
		 * Initialize this module against shell-provided services.
		 *
		 * @param {Object} registered_shell_api Shared wizard adapter services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var editor_node;
			var transport;
			var parsed_values;
			var template_start;
			var template_end;

			shell_api = registered_shell_api;
			editor_node = shell_api.root.querySelector( '[data-wpbc-fixed-slots-editor]' );
			transport = shell_api.root.querySelector( '[data-wpbc-fixed-slots-draft]' );
			if ( ! editor_node || ! transport ) {
				return;
			}

			try {
				parsed_values = JSON.parse( transport.value || '{}' );
			} catch ( parse_error ) {
				parsed_values = {};
			}

			editor = {
				node: editor_node,
				transport: transport,
				field_id: editor_node.dataset.fieldId || runtime_config.field_id || 'fixed_time_slots',
				slots: parsed_values && Array.isArray( parsed_values.time_slots ) ? parsed_values.time_slots.slice() : [],
				max_time_slots: parseInt( transport.dataset.maxTimeSlots || String( config.max_time_slots || 288 ), 10 ),
				time_increment: parseInt( transport.dataset.timeIncrement || String( config.time_increment || 5 ), 10 ),
				list: editor_node.querySelector( '[data-wpbc-fixed-slot-list]' ),
				template: editor_node.querySelector( '[data-wpbc-fixed-slot-template]' ),
				add_button: editor_node.querySelector( '[data-wpbc-add-fixed-slot]' ),
				clear_button: editor_node.querySelector( '[data-wpbc-clear-fixed-slots]' ),
				generator_from: editor_node.querySelector( '[data-wpbc-fixed-generator-from]' ),
				generator_to: editor_node.querySelector( '[data-wpbc-fixed-generator-to]' ),
				generator_interval: editor_node.querySelector( '[data-wpbc-fixed-generator-interval]' ),
				generator_duration: editor_node.querySelector( '[data-wpbc-fixed-generator-duration]' ),
				list_label: '',
				start_values: [],
				end_values: [],
				sortable: null
			};

			if ( ! editor.list || ! editor.template || ! editor.add_button || ! editor.clear_button || ! editor.generator_from || ! editor.generator_to || ! editor.generator_interval || ! editor.generator_duration ) {
				editor = null;
				return;
			}

			template_start = editor.template.content.querySelector( '[data-wpbc-fixed-slot-start]' );
			template_end = editor.template.content.querySelector( '[data-wpbc-fixed-slot-end]' );
			if ( ! template_start || ! template_end ) {
				editor = null;
				return;
			}

			editor.list_label = editor.list.dataset.listLabel || 'Fixed time slots';
			editor.start_values = Array.prototype.map.call( template_start.options, function ( option ) { return option.value; } );
			editor.end_values = Array.prototype.map.call( template_end.options, function ( option ) { return option.value; } );
			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			editor.node.addEventListener( 'keydown', handle_keydown );
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

			if ( ! editor ) {
				return null;
			}

			editor.node.querySelectorAll( '[aria-invalid="true"]' ).forEach( function ( control ) {
				control.removeAttribute( 'aria-invalid' );
			} );

			if ( ! editor.slots.length ) {
				first_invalid = set_slot_error( get_message( 'slots_required', 'Add at least one fixed time slot.' ), -1, 'start' );
			}

			editor.slots.some( function ( slot, slot_index ) {
				var start_minutes = time_to_minutes( slot.start_time, false );
				var end_minutes = time_to_minutes( slot.end_time, true );
				var slot_key = slot.start_time + ' - ' + slot.end_time;

				if ( -1 === editor.start_values.indexOf( slot.start_time ) || -1 === editor.end_values.indexOf( slot.end_time ) || null === start_minutes || null === end_minutes || end_minutes <= start_minutes ) {
					first_invalid = set_slot_error( get_message( 'slot_invalid', 'Every fixed time slot must end after it starts.' ), slot_index, 'end' );
					return true;
				}
				if ( Object.prototype.hasOwnProperty.call( seen_slots, slot_key ) ) {
					first_invalid = set_slot_error( get_message( 'slot_duplicate', 'The same fixed time slot cannot appear twice.' ), slot_index, 'start' );
					return true;
				}
				seen_slots[ slot_key ] = true;
				return false;
			} );

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
	window.wpbc_setup_editor_modules[ module_config.module_id ] = {
		create: create_fixed_time_slots_adapter
	};

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_fixed_time_slots_adapter( module_config ) );
	}
}( window ) );
