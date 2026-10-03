/**
 * Provide the reusable weekly schedule editor used by Setup Wizard Step 7.
 *
 * The module edits a bounded proposal DTO. It supports multiple disjoint
 * intervals per day and a general source-to-target schedule copy workflow.
 * Canonical persistence remains server-owned at the explicit save boundary.
 *
 * @package Booking Calendar
 */
( function ( window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_working_hours || { i18n: {} };

	/**
	 * Create one isolated Working Hours editor adapter.
	 *
	 * @param {Object} config Module translations and presentation settings.
	 * @return {Object} Step adapter accepted by the shared wizard shell.
	 */
	function create_working_hours_adapter( config ) {
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
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? config.i18n[ key ] : fallback;
		}

		/**
		 * Clone one weekday interval list without sharing object references.
		 *
		 * @param {Object[]} intervals Source intervals.
		 * @return {Object[]} Cloned intervals.
		 */
		function clone_intervals( intervals ) {
			return intervals.map( function ( interval ) {
				return {
					start_second: interval.start_second,
					end_second: interval.end_second
				};
			} );
		}

		/**
		 * Write the in-memory weekly schedule to the allow-listed draft field.
		 *
		 * @return {void}
		 */
		function sync_working_hours_draft() {
			if ( ! editor ) {
				return;
			}

			editor.transport.value = JSON.stringify( {
				enabled: editor.enabled ? 'On' : 'Off',
				weekdays: editor.weekdays
			} );
		}

		/**
		 * Find a non-overlapping one-hour proposal for a new interval.
		 *
		 * @param {Object[]} intervals Existing intervals for one weekday.
		 * @return {Object|null} Proposed interval, or null when no gap exists.
		 */
		function find_interval_proposal( intervals ) {
			var sorted_intervals = intervals.slice().sort( function ( first_interval, second_interval ) {
				return first_interval.start_second - second_interval.start_second;
			} );
			var preferred_start = sorted_intervals.length ? sorted_intervals[ sorted_intervals.length - 1 ].end_second : 9 * 3600;
			var candidates = [];
			var candidate_start;

			for ( candidate_start = 0; candidate_start <= 23 * 3600; candidate_start += 1800 ) {
				if ( candidate_start >= preferred_start ) {
					candidates.push( candidate_start );
				}
			}
			for ( candidate_start = 0; candidate_start < preferred_start && candidate_start <= 23 * 3600; candidate_start += 1800 ) {
				candidates.push( candidate_start );
			}

			candidate_start = null;
			candidates.some( function ( proposed_start ) {
				var proposed_end = proposed_start + 3600;
				var overlaps = sorted_intervals.some( function ( interval ) {
					return proposed_start < interval.end_second && proposed_end > interval.start_second;
				} );

				if ( proposed_end <= 86400 && ! overlaps ) {
					candidate_start = proposed_start;
					return true;
				}
				return false;
			} );

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
			if ( ! editor || ! editor.template ) {
				return;
			}

			editor.node.classList.toggle( 'is-disabled', ! editor.enabled );
			if ( editor.enabled_toggle ) {
				editor.enabled_toggle.checked = editor.enabled;
			}
			if ( editor.schedule_controls ) {
				editor.schedule_controls.disabled = ! editor.enabled;
			}

			editor.node.querySelectorAll( '[data-wpbc-working-day]' ).forEach( function ( day_node ) {
				var day_number = parseInt( day_node.dataset.wpbcWorkingDay, 10 );
				var day_label = day_node.dataset.dayLabel || '';
				var intervals = editor.weekdays[ day_number ] || [];
				var is_enabled = 0 < intervals.length;
				var toggle = day_node.querySelector( '[data-wpbc-working-day-toggle]' );
				var interval_container = day_node.querySelector( '[data-wpbc-working-intervals]' );
				var unavailable = day_node.querySelector( '[data-wpbc-working-unavailable]' );
				var add_button = day_node.querySelector( '[data-wpbc-add-working-interval]' );

				day_node.classList.toggle( 'is-enabled', is_enabled );
				if ( toggle ) {
					toggle.checked = is_enabled;
				}
				if ( interval_container ) {
					interval_container.hidden = ! is_enabled;
					interval_container.textContent = '';
					intervals.forEach( function ( interval, interval_index ) {
						var interval_node = editor.template.content.firstElementChild.cloneNode( true );
						var start_select = interval_node.querySelector( '[data-wpbc-working-start]' );
						var end_select = interval_node.querySelector( '[data-wpbc-working-end]' );
						var start_label = interval_node.querySelector( '[data-wpbc-working-start-label]' );
						var end_label = interval_node.querySelector( '[data-wpbc-working-end-label]' );
						var remove_button = interval_node.querySelector( '[data-wpbc-remove-working-interval]' );
						var start_id = 'wpbc-working-' + day_number + '-' + interval_index + '-start';
						var end_id = 'wpbc-working-' + day_number + '-' + interval_index + '-end';

						interval_node.dataset.intervalIndex = String( interval_index );
						start_select.id = start_id;
						start_select.value = String( interval.start_second );
						end_select.id = end_id;
						end_select.value = String( interval.end_second );
						start_label.htmlFor = start_id;
						end_label.htmlFor = end_id;
						remove_button.setAttribute( 'aria-label', get_message( 'remove_working_interval', 'Remove %s working interval' ).replace( '%s', day_label ) );
						interval_container.appendChild( interval_node );
					} );
				}
				if ( unavailable ) {
					unavailable.hidden = is_enabled;
				}
				if ( add_button ) {
					add_button.hidden = ! is_enabled;
					add_button.disabled = intervals.length >= editor.max_intervals;
				}
			} );

			sync_working_hours_draft();
		}

		/**
		 * Restore focus after an interval render replaces its controls.
		 *
		 * @param {number} day_number     Weekday number using the canonical 0-6 shape.
		 * @param {number} interval_index Preferred interval index after render.
		 * @return {void}
		 */
		function focus_working_hours_control( day_number, interval_index ) {
			var day_node;
			var interval_node;
			var focus_target;

			if ( ! editor ) {
				return;
			}

			day_node = editor.node.querySelector( '[data-wpbc-working-day="' + day_number + '"]' );
			if ( ! day_node ) {
				return;
			}

			interval_node = day_node.querySelector( '[data-interval-index="' + interval_index + '"]' );
			focus_target = interval_node
				? interval_node.querySelector( '[data-wpbc-working-start]' )
				: day_node.querySelector( '[data-wpbc-working-day-toggle]' );
			if ( focus_target ) {
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

			if ( ! editor || ! editor.copy_source ) {
				return;
			}

			source_day = editor.copy_source.value;
			editor.node.querySelectorAll( '[data-wpbc-copy-target]' ).forEach( function ( target ) {
				var is_source = target.value === source_day;
				target.disabled = is_source;
				if ( is_source ) {
					target.checked = false;
				}
			} );
		}

		/**
		 * Open the accessible schedule-copy controls.
		 *
		 * @return {void}
		 */
		function open_copy_panel() {
			if ( ! editor || ! editor.copy_panel || ! editor.copy_toggle ) {
				return;
			}

			editor.copy_panel.hidden = false;
			editor.copy_toggle.setAttribute( 'aria-expanded', 'true' );
			refresh_copy_targets();
			editor.copy_source.focus();
		}

		/**
		 * Close schedule-copy controls and optionally restore trigger focus.
		 *
		 * @param {boolean} restore_focus Whether trigger focus should be restored.
		 * @return {void}
		 */
		function close_copy_panel( restore_focus ) {
			if ( ! editor || ! editor.copy_panel || ! editor.copy_toggle ) {
				return;
			}

			editor.copy_panel.hidden = true;
			editor.copy_toggle.setAttribute( 'aria-expanded', 'false' );
			if ( restore_focus ) {
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
			var source_day = parseInt( editor.copy_source.value, 10 );
			var targets = Array.prototype.slice.call( editor.node.querySelectorAll( '[data-wpbc-copy-target]:checked:not(:disabled)' ) );
			var source_intervals = editor.weekdays[ source_day ] || [];
			var first_available_target;

			if ( ! targets.length ) {
				shell_api.set_status( get_message( 'copy_target_required', 'Select at least one target day.' ) );
				first_available_target = editor.node.querySelector( '[data-wpbc-copy-target]:not(:disabled)' );
				if ( first_available_target ) {
					first_available_target.focus();
				}
				return;
			}

			targets.forEach( function ( target ) {
				editor.weekdays[ parseInt( target.value, 10 ) ] = clone_intervals( source_intervals );
			} );
			render_working_hours_editor();
			shell_api.clear_field_error( 'working_hours' );
			shell_api.set_status( get_message( 'schedule_copied', 'The working-hours schedule was copied to the selected days.' ) );
			close_copy_panel( true );
		}

		/**
		 * Handle Working Hours button actions.
		 *
		 * @param {MouseEvent} event Delegated click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var add_button = event.target.closest( '[data-wpbc-add-working-interval]' );
			var remove_button = event.target.closest( '[data-wpbc-remove-working-interval]' );

			if ( event.target.closest( '[data-wpbc-copy-schedule-toggle]' ) ) {
				event.preventDefault();
				if ( editor.copy_panel.hidden ) {
					open_copy_panel();
				} else {
					close_copy_panel( true );
				}
				return;
			}
			if ( event.target.closest( '[data-wpbc-copy-schedule-cancel]' ) ) {
				event.preventDefault();
				close_copy_panel( true );
				return;
			}
			if ( event.target.closest( '[data-wpbc-copy-schedule-apply]' ) ) {
				event.preventDefault();
				apply_schedule_copy();
				return;
			}

			if ( add_button ) {
				var add_day_node = add_button.closest( '[data-wpbc-working-day]' );
				var add_day_number = parseInt( add_day_node.dataset.wpbcWorkingDay, 10 );
				var proposal = find_interval_proposal( editor.weekdays[ add_day_number ] || [] );

				event.preventDefault();
				if ( ! proposal || editor.weekdays[ add_day_number ].length >= editor.max_intervals ) {
					shell_api.set_status( get_message( 'working_hours_limit', 'No additional one-hour interval is available for this day.' ) );
					return;
				}
				editor.weekdays[ add_day_number ].push( proposal );
				render_working_hours_editor();
				focus_working_hours_control( add_day_number, editor.weekdays[ add_day_number ].length - 1 );
				shell_api.clear_field_error( 'working_hours' );
				return;
			}

			if ( remove_button ) {
				var remove_day_node = remove_button.closest( '[data-wpbc-working-day]' );
				var remove_interval_node = remove_button.closest( '[data-interval-index]' );
				var remove_day_number = parseInt( remove_day_node.dataset.wpbcWorkingDay, 10 );
				var remove_interval_index = parseInt( remove_interval_node.dataset.intervalIndex, 10 );

				event.preventDefault();
				editor.weekdays[ remove_day_number ].splice( remove_interval_index, 1 );
				render_working_hours_editor();
				focus_working_hours_control( remove_day_number, Math.min( remove_interval_index, editor.weekdays[ remove_day_number ].length - 1 ) );
				shell_api.clear_field_error( 'working_hours' );
			}
		}

		/**
		 * Handle weekday, interval, and copy-source changes.
		 *
		 * @param {Event} event Delegated change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			if ( event.target.matches( '[data-wpbc-working-hours-enabled]' ) ) {
				editor.enabled = event.target.checked;
				if ( ! editor.enabled ) {
					close_copy_panel( false );
				}
				render_working_hours_editor();
				shell_api.clear_field_error( 'working_hours' );
				return;
			}

			if ( event.target.matches( '[data-wpbc-copy-source]' ) ) {
				refresh_copy_targets();
				return;
			}

			if ( event.target.matches( '[data-wpbc-working-day-toggle]' ) ) {
				var toggle_day_node = event.target.closest( '[data-wpbc-working-day]' );
				var toggle_day_number = parseInt( toggle_day_node.dataset.wpbcWorkingDay, 10 );

				editor.weekdays[ toggle_day_number ] = event.target.checked ? [ find_interval_proposal( [] ) ] : [];
				render_working_hours_editor();
				shell_api.clear_field_error( 'working_hours' );
				return;
			}

			if ( event.target.matches( '[data-wpbc-working-start], [data-wpbc-working-end]' ) ) {
				var changed_day_node = event.target.closest( '[data-wpbc-working-day]' );
				var changed_interval_node = event.target.closest( '[data-interval-index]' );
				var changed_day_number = parseInt( changed_day_node.dataset.wpbcWorkingDay, 10 );
				var changed_interval_index = parseInt( changed_interval_node.dataset.intervalIndex, 10 );
				var changed_interval = editor.weekdays[ changed_day_number ][ changed_interval_index ];

				if ( event.target.matches( '[data-wpbc-working-start]' ) ) {
					changed_interval.start_second = parseInt( event.target.value, 10 );
				} else {
					changed_interval.end_second = parseInt( event.target.value, 10 );
				}
				sync_working_hours_draft();
				shell_api.clear_field_error( 'working_hours' );
			}
		}

		/**
		 * Close the schedule-copy panel with Escape while focus is inside it.
		 *
		 * @param {KeyboardEvent} event Keydown event.
		 * @return {void}
		 */
		function handle_keydown( event ) {
			if ( 'Escape' === event.key && editor.copy_panel && ! editor.copy_panel.hidden && editor.copy_panel.contains( event.target ) ) {
				event.preventDefault();
				close_copy_panel( true );
			}
		}

		/**
		 * Initialize this module against shell-provided services.
		 *
		 * @param {Object} registered_shell_api Shared wizard adapter services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var parsed_working_hours;
			var weekdays = {};
			var editor_node;
			var transport;

			shell_api = registered_shell_api;
			root = shell_api.root;
			editor_node = root.querySelector( '[data-wpbc-working-hours-editor]' );
			transport = root.querySelector( '[data-wpbc-working-hours-draft]' );
			if ( ! editor_node || ! transport ) {
				return;
			}

			try {
				parsed_working_hours = JSON.parse( transport.value || '{}' );
			} catch ( parse_error ) {
				parsed_working_hours = {};
			}

			[ 0, 1, 2, 3, 4, 5, 6 ].forEach( function ( day_number ) {
				var raw_intervals = parsed_working_hours.weekdays && Array.isArray( parsed_working_hours.weekdays[ day_number ] ) ? parsed_working_hours.weekdays[ day_number ] : [];

				weekdays[ day_number ] = raw_intervals.map( function ( interval ) {
					return {
						start_second: parseInt( interval.start_second, 10 ),
						end_second: parseInt( interval.end_second, 10 )
					};
				} ).filter( function ( interval ) {
					return isFinite( interval.start_second ) && Math.floor( interval.start_second ) === interval.start_second && isFinite( interval.end_second ) && Math.floor( interval.end_second ) === interval.end_second;
				} );
			} );

			editor = {
				node: editor_node,
				transport: transport,
				template: root.querySelector( '[data-wpbc-working-interval-template]' ),
				enabled: 'Off' !== parsed_working_hours.enabled,
				enabled_toggle: editor_node.querySelector( '[data-wpbc-working-hours-enabled]' ),
				schedule_controls: editor_node.querySelector( '[data-wpbc-working-hours-controls]' ),
				weekdays: weekdays,
				max_intervals: parseInt( transport.dataset.maxIntervals || '8', 10 ),
				copy_toggle: editor_node.querySelector( '[data-wpbc-copy-schedule-toggle]' ),
				copy_panel: editor_node.querySelector( '[data-wpbc-copy-schedule-panel]' ),
				copy_source: editor_node.querySelector( '[data-wpbc-copy-source]' )
			};

			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			editor.node.addEventListener( 'keydown', handle_keydown );
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

			if ( ! editor ) {
				return null;
			}
			if ( ! editor.enabled ) {
				shell_api.clear_field_error( 'working_hours' );
				sync_working_hours_draft();
				return null;
			}

			editor.node.querySelectorAll( '[data-wpbc-working-start], [data-wpbc-working-end]' ).forEach( function ( control ) {
				control.removeAttribute( 'aria-invalid' );
			} );

			[ 0, 1, 2, 3, 4, 5, 6 ].some( function ( day_number ) {
				var intervals = editor.weekdays[ day_number ] || [];
				var sorted_intervals = intervals.slice().sort( function ( first_interval, second_interval ) {
					return first_interval.start_second - second_interval.start_second;
				} );
				var previous_end = -1;
				var day_node = editor.node.querySelector( '[data-wpbc-working-day="' + day_number + '"]' );

				enabled_interval_count += intervals.length;
				return sorted_intervals.some( function ( interval ) {
					var interval_index = intervals.indexOf( interval );
					var interval_node = day_node && day_node.querySelector( '[data-interval-index="' + interval_index + '"]' );
					var invalid_range = ! isFinite( interval.start_second ) || Math.floor( interval.start_second ) !== interval.start_second || ! isFinite( interval.end_second ) || Math.floor( interval.end_second ) !== interval.end_second || interval.start_second < 0 || interval.end_second > 86400 || interval.start_second >= interval.end_second;
					var overlaps = interval.start_second < previous_end;

					previous_end = Math.max( previous_end, interval.end_second );
					if ( invalid_range || overlaps ) {
						first_invalid = interval_node ? interval_node.querySelector( invalid_range ? '[data-wpbc-working-end]' : '[data-wpbc-working-start]' ) : day_node.querySelector( '[data-wpbc-working-day-toggle]' );
						if ( first_invalid ) {
							first_invalid.setAttribute( 'aria-invalid', 'true' );
						}
						shell_api.set_field_error( 'working_hours', invalid_range ? get_message( 'working_hours_invalid', 'Every working interval must end after it starts.' ) : get_message( 'working_hours_overlap', 'Working intervals on the same day cannot overlap or repeat.' ) );
						return true;
					}
					return false;
				} );
			} );

			if ( ! first_invalid && 0 === enabled_interval_count ) {
				first_invalid = shell_api.set_field_error( 'working_hours', get_message( 'working_hours_required', 'Enable at least one weekday and add its working hours.' ) );
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

	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_working_hours_adapter( module_config ) );
	}
}( window, document ) );
