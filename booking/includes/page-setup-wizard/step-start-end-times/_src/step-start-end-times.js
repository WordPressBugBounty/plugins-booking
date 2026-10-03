/**
 * Reusable sortable time-choice Setup Wizard editor.
 *
 * @package Booking Calendar
 */

( function ( window ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_start_end_times || { i18n: {} };

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
	function create_time_choices_adapter( config ) {
		var shell_api = null;
		var editor = null;

		/**
		 * Return one translated string with a safe fallback.
		 *
		 * @param {string} key Translation key.
		 * @param {string} fallback Fallback text.
		 * @return {string} Translation or fallback.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? config.i18n[ key ] : fallback;
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
		function time_to_minutes( time_value ) {
			var normalized_value = String( time_value || '' );
			var match = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.exec( normalized_value );

			if ( ! match ) {
				return null;
			}

			return parseInt( normalized_value.substring( 0, 2 ), 10 ) * 60 + parseInt( normalized_value.substring( 3, 5 ), 10 );
		}

		/**
		 * Convert a bounded minute value into `HH:MM`.
		 *
		 * @param {number} minute_value Minute value between zero and 1440.
		 * @return {string} Normalized value.
		 */
		function minutes_to_time( minute_value ) {
			var hours = Math.floor( minute_value / 60 );
			var minutes = minute_value % 60;

			return String( hours ).padStart( 2, '0' ) + ':' + String( minutes ).padStart( 2, '0' );
		}

		/**
		 * Return one registered list.
		 *
		 * @param {string} list_id Stable server-owned list identifier.
		 * @return {Object|null} List state or null.
		 */
		function get_list( list_id ) {
			return editor && editor.lists && editor.lists[ list_id ] ? editor.lists[ list_id ] : null;
		}

		/**
		 * Return the visible label for one list option.
		 *
		 * @param {Object} list List state.
		 * @param {string} option_value Stored option value.
		 * @return {string} Visible server-owned label.
		 */
		function get_choice_label( list, option_value ) {
			var select = list.template.content.querySelector( '[data-wpbc-time-choice]' );
			var option = null;
			var option_index;

			if ( select ) {
				for ( option_index = 0; option_index < select.options.length; option_index++ ) {
					if ( select.options[ option_index ].value === option_value ) {
						option = select.options[ option_index ];
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

			if ( ! editor ) {
				return;
			}

			editor.list_order.forEach( function ( list_id ) {
				serialized_lists[ list_id ] = editor.lists[ list_id ].values.slice();
			} );
			editor.transport.value = JSON.stringify( serialized_lists );
		}

		/**
		 * Return the preferred validation focus target for a list item.
		 *
		 * @param {string} list_id Stable list identifier.
		 * @param {number} item_index Preferred item index.
		 * @return {HTMLElement|null} Select, Add button, or null.
		 */
		function get_choice_control( list_id, item_index ) {
			var list = get_list( list_id );
			var item = list ? list.node.querySelector( '[data-time-index="' + item_index + '"]' ) : null;

			return item ? item.querySelector( '[data-wpbc-time-choice]' ) : ( list ? list.add_button : null );
		}

		/**
		 * Focus one choice after rendering.
		 *
		 * @param {string} list_id Stable list identifier.
		 * @param {number} item_index Preferred item index.
		 * @return {void}
		 */
		function focus_choice( list_id, item_index ) {
			var target = get_choice_control( list_id, item_index );

			if ( target ) {
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
		function focus_move_control( list_id, item_index ) {
			var list = get_list( list_id );
			var item = list ? list.node.querySelector( '[data-time-index="' + item_index + '"]' ) : null;
			var target = item ? item.querySelector( '[data-wpbc-move-time]' ) : null;

			if ( target ) {
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
		function set_choice_error( message, list_id, item_index ) {
			var target;

			shell_api.set_field_error( editor.field_id, message );
			target = get_choice_control( list_id, item_index );
			if ( target ) {
				target.setAttribute( 'aria-invalid', 'true' );
			}

			return target;
		}

		/**
		 * Find the second occurrence of the first duplicate.
		 *
		 * @param {string[]} choices Ordered choices.
		 * @return {number} Duplicate index or -1.
		 */
		function find_duplicate_index( choices ) {
			var seen_choices = {};
			var duplicate_index = -1;

			choices.some( function ( choice, item_index ) {
				if ( Object.prototype.hasOwnProperty.call( seen_choices, choice ) ) {
					duplicate_index = item_index;
					return true;
				}
				seen_choices[ choice ] = true;
				return false;
			} );

			return duplicate_index;
		}

		/**
		 * Render one list from data-only state.
		 *
		 * @param {string} list_id Stable list identifier.
		 * @return {void}
		 */
		function render_list( list_id ) {
			var list = get_list( list_id );

			if ( ! list || ! list.template ) {
				return;
			}

			list.node.textContent = '';
			list.add_button.removeAttribute( 'data-wpbc-setup-wizard-error-control-for' );
			if ( ! list.values.length ) {
				list.add_button.setAttribute( 'data-wpbc-setup-wizard-error-control-for', editor.field_id );
			}

			list.values.forEach( function ( choice_value, item_index ) {
				var choice = list.template.content.firstElementChild.cloneNode( true );
				var select = choice.querySelector( '[data-wpbc-time-choice]' );
				var select_label = choice.querySelector( '[data-wpbc-time-choice-label]' );
				var move_button = choice.querySelector( '[data-wpbc-move-time]' );
				var remove_button = choice.querySelector( '[data-wpbc-remove-time]' );
				var visible_choice = get_choice_label( list, choice_value );
				var select_id = 'wpbc-' + editor.field_id.replace( /_/g, '-' ) + '-' + list_id.replace( /_/g, '-' ) + '-' + item_index;

				choice.dataset.timeList = list_id;
				choice.dataset.timeIndex = String( item_index );
				select.id = select_id;
				select.value = choice_value;
				if ( 0 === item_index ) {
					select.setAttribute( 'data-wpbc-setup-wizard-error-control-for', editor.field_id );
				}
				select_label.htmlFor = select_id;
				select_label.textContent = list.label + ': ' + visible_choice;
				move_button.setAttribute( 'aria-label', get_message( 'move_time_choice', 'Move %1$s in the %2$s list' ).replace( '%1$s', visible_choice ).replace( '%2$s', list.label ) );
				remove_button.setAttribute( 'aria-label', get_message( 'remove_time_choice', 'Remove %1$s from the %2$s list' ).replace( '%1$s', visible_choice ).replace( '%2$s', list.label ) );
				list.node.appendChild( choice );
			} );

			list.add_button.disabled = list.values.length >= editor.max_times;
			list.clear_button.disabled = ! list.values.length;
			sync_time_choices_draft();
		}

		/**
		 * Render every registered list.
		 *
		 * @return {void}
		 */
		function render_editor() {
			editor.list_order.forEach( render_list );
		}

		/**
		 * Generate an inclusive ordered range from one list's toolbar.
		 *
		 * @param {string} list_id Stable list identifier.
		 * @return {void}
		 */
		function generate_choices( list_id ) {
			var list = get_list( list_id );
			var start_minutes;
			var end_minutes;
			var interval_minutes;
			var generated_values = [];
			var minute;

			if ( ! list ) {
				return;
			}

			start_minutes = time_to_minutes( list.generator_from.value );
			end_minutes = time_to_minutes( list.generator_to.value );
			interval_minutes = parseInt( list.generator_interval.value, 10 );
			if ( null === start_minutes || null === end_minutes || end_minutes < start_minutes || ! isFinite( interval_minutes ) || interval_minutes < editor.time_increment || 0 !== interval_minutes % editor.time_increment ) {
				list.generator_to.setAttribute( 'aria-invalid', 'true' );
				shell_api.set_status( get_message( 'generator_invalid', 'The last generated choice must not be earlier than the first choice.' ) );
				list.generator_to.focus();
				return;
			}

			list.generator_to.removeAttribute( 'aria-invalid' );
			for ( minute = start_minutes; minute <= end_minutes && generated_values.length < editor.max_times; minute += interval_minutes ) {
				if ( -1 !== list.option_values.indexOf( minutes_to_time( minute ) ) ) {
					generated_values.push( minutes_to_time( minute ) );
				}
			}
			list.values = generated_values;
			render_list( list_id );
			focus_choice( list_id, 0 );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Find the next unused server-owned option.
		 *
		 * @param {Object} list List state.
		 * @return {string|null} Proposed value or null.
		 */
		function find_choice_proposal( list ) {
			var start_index = list.values.length ? list.option_values.indexOf( list.values[ list.values.length - 1 ] ) + 1 : 0;
			var offset;
			var candidate_value;

			for ( offset = 0; offset < list.option_values.length; offset += 1 ) {
				candidate_value = list.option_values[ ( start_index + offset ) % list.option_values.length ];
				if ( -1 === list.values.indexOf( candidate_value ) ) {
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
		function add_choice( list_id ) {
			var list = get_list( list_id );
			var proposal;

			if ( ! list || list.values.length >= editor.max_times ) {
				shell_api.set_status( get_message( 'time_limit', 'No additional choice can be added to this list.' ) );
				return;
			}

			proposal = find_choice_proposal( list );
			if ( ! proposal ) {
				shell_api.set_status( get_message( 'time_limit', 'No additional choice can be added to this list.' ) );
				return;
			}

			list.values.push( proposal );
			render_list( list_id );
			focus_choice( list_id, list.values.length - 1 );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Clear one list and keep focus within its action area.
		 *
		 * @param {string} list_id Stable list identifier.
		 * @return {void}
		 */
		function clear_choices( list_id ) {
			var list = get_list( list_id );

			if ( ! list || ! list.values.length ) {
				return;
			}

			list.values = [];
			render_list( list_id );
			list.add_button.focus();
			shell_api.clear_field_error( editor.field_id );
			shell_api.set_status( list.clear_status || get_message( list_id + '_cleared', 'Choices cleared.' ) );
		}

		/**
		 * Move one choice inside its list.
		 *
		 * @param {string} list_id Stable list identifier.
		 * @param {number} source_index Current index.
		 * @param {number} target_index Target index.
		 * @return {void}
		 */
		function move_choice( list_id, source_index, target_index ) {
			var list = get_list( list_id );
			var moved_value;

			if ( ! list || source_index === target_index || source_index < 0 || target_index < 0 || source_index >= list.values.length || target_index >= list.values.length ) {
				return;
			}

			moved_value = list.values.splice( source_index, 1 )[0];
			list.values.splice( target_index, 0, moved_value );
			render_list( list_id );
			focus_move_control( list_id, target_index );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Initialize SortableJS for one list without cross-list moves.
		 *
		 * @param {string} list_id Stable list identifier.
		 * @return {void}
		 */
		function initialize_sortable_list( list_id ) {
			var list = get_list( list_id );

			if ( ! list || 'function' !== typeof window.Sortable ) {
				return;
			}

			list.sortable = new window.Sortable( list.node, {
				animation: 120,
				draggable: '[data-time-index]',
				handle: '[data-wpbc-move-time]',
				ghostClass: 'is-drag-placeholder',
				chosenClass: 'is-dragging',
				dragClass: 'is-dragging',
				onEnd: function ( event ) {
					var source_index = Number( event.oldIndex );
					var target_index = Number( event.newIndex );

					if ( Number.isInteger( source_index ) && Number.isInteger( target_index ) ) {
						move_choice( list_id, source_index, target_index );
					} else {
						render_list( list_id );
					}
				}
			} );
		}

		/**
		 * Handle generator, add, clear, copy, and remove actions.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var copy_button = event.target.closest( '[data-wpbc-copy-times]' );
			var generator = event.target.closest( '[data-wpbc-time-generator]' );
			var list_panel = event.target.closest( '[data-wpbc-time-list-panel]' );
			var choice = event.target.closest( '[data-time-index]' );

			if ( copy_button ) {
				var source_list = get_list( copy_button.dataset.sourceList );
				var target_list = get_list( copy_button.dataset.targetList );

				event.preventDefault();
				if ( source_list && target_list ) {
					target_list.values = source_list.values.filter( function ( choice_value ) {
						return -1 !== target_list.option_values.indexOf( choice_value );
					} );
					render_list( target_list.id );
					focus_choice( target_list.id, 0 );
					shell_api.clear_field_error( editor.field_id );
					shell_api.set_status( copy_button.dataset.status || '' );
				}
				return;
			}

			if ( generator && event.target.closest( '[data-wpbc-generate-times]' ) ) {
				event.preventDefault();
				generate_choices( generator.dataset.wpbcTimeGenerator );
				return;
			}

			if ( list_panel && event.target.closest( '[data-wpbc-add-time]' ) ) {
				event.preventDefault();
				add_choice( list_panel.dataset.wpbcTimeListPanel );
				return;
			}

			if ( list_panel && event.target.closest( '[data-wpbc-clear-times]' ) ) {
				event.preventDefault();
				clear_choices( list_panel.dataset.wpbcTimeListPanel );
				return;
			}

			if ( choice && event.target.closest( '[data-wpbc-remove-time]' ) ) {
				var list = get_list( choice.dataset.timeList );
				var item_index = parseInt( choice.dataset.timeIndex, 10 );

				event.preventDefault();
				if ( list ) {
					list.values.splice( item_index, 1 );
					render_list( list.id );
					focus_choice( list.id, Math.min( item_index, list.values.length - 1 ) );
					shell_api.clear_field_error( editor.field_id );
				}
			}
		}

		/**
		 * Synchronize one changed choice.
		 *
		 * @param {Event} event Delegated change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			var choice;
			var list;
			var item_index;

			if ( ! event.target.matches( '[data-wpbc-time-choice]' ) ) {
				return;
			}

			choice = event.target.closest( '[data-time-index]' );
			list = choice ? get_list( choice.dataset.timeList ) : null;
			item_index = choice ? parseInt( choice.dataset.timeIndex, 10 ) : -1;
			if ( ! list || item_index < 0 ) {
				return;
			}

			list.values[ item_index ] = event.target.value;
			render_list( list.id );
			focus_choice( list.id, item_index );
			shell_api.clear_field_error( editor.field_id );
		}

		/**
		 * Provide keyboard reordering equivalent to drag and drop.
		 *
		 * @param {KeyboardEvent} event Delegated keydown event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			var move_button = event.target.closest( '[data-wpbc-move-time]' );
			var choice;
			var item_index;
			var target_index;

			if ( ! move_button || ! [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ].includes( event.key ) ) {
				return;
			}

			choice = move_button.closest( '[data-time-index]' );
			item_index = parseInt( choice.dataset.timeIndex, 10 );
			target_index = [ 'ArrowLeft', 'ArrowUp' ].includes( event.key ) ? item_index - 1 : item_index + 1;
			event.preventDefault();
			move_choice( choice.dataset.timeList, item_index, target_index );
		}

		/**
		 * Initialize one server-defined list from DOM and checkpoint values.
		 *
		 * @param {HTMLElement} list_node List container.
		 * @param {string[]} values Stored list values.
		 * @return {Object|null} List state or null.
		 */
		function initialize_list( list_node, values ) {
			var list_id = list_node.dataset.wpbcTimeChoiceList;
			var panel = editor.node.querySelector( '[data-wpbc-time-list-panel="' + list_id + '"]' );
			var generator = panel ? panel.querySelector( '[data-wpbc-time-generator]' ) : null;
			var template = shell_api.root.querySelector( '[data-wpbc-time-choice-template="' + list_id + '"]' );
			var template_select = template ? template.content.querySelector( '[data-wpbc-time-choice]' ) : null;

			if ( ! panel || ! generator || ! template || ! template_select ) {
				return null;
			}

			return {
				id: list_id,
				node: list_node,
				template: template,
				label: list_node.dataset.listLabel || list_id,
				clear_status: list_node.dataset.clearStatus || '',
				values: Array.isArray( values ) ? values.slice() : [],
				option_values: Array.prototype.map.call( template_select.options, function ( option ) { return option.value; } ),
				add_button: panel.querySelector( '[data-wpbc-add-time]' ),
				clear_button: panel.querySelector( '[data-wpbc-clear-times]' ),
				generator_from: generator.querySelector( '[data-wpbc-generator-from]' ),
				generator_to: generator.querySelector( '[data-wpbc-generator-to]' ),
				generator_interval: generator.querySelector( '[data-wpbc-generator-interval]' ),
				sortable: null
			};
		}

		/**
		 * Initialize this module against shell-provided services.
		 *
		 * @param {Object} registered_shell_api Shared wizard adapter services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var parsed_values;
			var editor_node;
			var transport;

			shell_api = registered_shell_api;
			editor_node = shell_api.root.querySelector( '[data-wpbc-time-choices-editor]' );
			transport = shell_api.root.querySelector( '[data-wpbc-time-choices-draft]' );
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
				field_id: editor_node.dataset.fieldId || config.field_id || 'start_end_times',
				validation_rule: editor_node.dataset.validationRule || 'independent_lists',
				max_times: parseInt( transport.dataset.maxTimes || String( config.max_times_per_list || 288 ), 10 ),
				time_increment: parseInt( transport.dataset.timeIncrement || String( config.time_increment || 5 ), 10 ),
				list_order: [],
				lists: {}
			};

			editor.node.querySelectorAll( '[data-wpbc-time-choice-list]' ).forEach( function ( list_node ) {
				var list_id = list_node.dataset.wpbcTimeChoiceList;
				var list = initialize_list( list_node, parsed_values[ list_id ] );

				if ( list ) {
					editor.list_order.push( list_id );
					editor.lists[ list_id ] = list;
				}
			} );

			if ( ! editor.list_order.length ) {
				editor = null;
				return;
			}

			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			editor.node.addEventListener( 'keydown', handle_keydown );
			render_editor();
			editor.list_order.forEach( initialize_sortable_list );
		}

		/**
		 * Validate required, unique, allow-listed, and route-specific choices.
		 *
		 * @return {HTMLElement|null} First invalid control or null.
		 */
		function validate() {
			var first_invalid = null;

			if ( ! editor ) {
				return null;
			}

			editor.node.querySelectorAll( '[aria-invalid="true"]' ).forEach( function ( control ) {
				control.removeAttribute( 'aria-invalid' );
			} );

			editor.list_order.some( function ( list_id ) {
				var list = editor.lists[ list_id ];
				var duplicate_index;

				if ( ! list.values.length ) {
					first_invalid = set_choice_error( get_message( list_id + '_required', 'Add at least one choice.' ), list_id, -1 );
					return true;
			}

				if ( list.values.some( function ( choice_value ) { return -1 === list.option_values.indexOf( choice_value ); } ) ) {
					first_invalid = set_choice_error( get_message( 'time_value_invalid', 'Choose a supported value for every choice.' ), list_id, 0 );
					return true;
			}

				duplicate_index = find_duplicate_index( list.values );
				if ( -1 !== duplicate_index ) {
					first_invalid = set_choice_error( get_message( 'time_duplicate', 'The same choice cannot appear twice in one list.' ), list_id, duplicate_index );
					return true;
				}

				return false;
			} );

			if ( ! first_invalid && 'end_after_start' === editor.validation_rule && editor.lists.start_times && editor.lists.end_times ) {
				var start_minutes = editor.lists.start_times.values.map( time_to_minutes );
				var end_minutes = editor.lists.end_times.values.map( time_to_minutes );

				if ( start_minutes.some( function ( value ) { return null === value; } ) || end_minutes.some( function ( value ) { return null === value; } ) || Math.max.apply( null, end_minutes ) <= Math.min.apply( null, start_minutes ) ) {
					first_invalid = set_choice_error( get_message( 'time_pair_invalid', 'Add an end time that is later than at least one start time.' ), 'end_times', 0 );
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
	window.wpbc_setup_editor_modules[ module_config.module_id || 'start_end_times' ] = {
		create: create_time_choices_adapter
	};

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_time_choices_adapter( module_config ) );
	}
}( window ) );
