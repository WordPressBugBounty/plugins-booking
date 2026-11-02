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
( function ( window, document ) {
	'use strict';

	var module_id = 'rendering';

	/**
	 * Create one Timeline rendering controller.
	 *
	 * @param {Object} context Controller-owned DOM, settings, template, booking,
	 *                         and post-layout callbacks.
	 * @return {Object} Rendering and row-synchronization lifecycle API.
	 */
	function create_rendering_controller( context ) {
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
		function normalize_row_presentations( descriptors ) {
			var stable_identifier = /^[a-z][a-z0-9_]{0,63}$/;
			var seen_ids = {};

			return ( Array.isArray( descriptors ) ? descriptors : [] ).filter( function ( descriptor ) {
				var presentation_id = descriptor && 'string' === typeof descriptor.id ? descriptor.id : '';
				var template_key = descriptor && 'string' === typeof descriptor.template_key ? descriptor.template_key : '';

				if (
					! stable_identifier.test( presentation_id )
					|| ! stable_identifier.test( template_key )
					|| 'string' !== typeof descriptor.label
					|| ! descriptor.label.trim()
					|| seen_ids[ presentation_id ]
				) {
					return false;
				}
				seen_ids[ presentation_id ] = true;
				return true;
			} ).map( function ( descriptor ) {
				return {
					id: descriptor.id,
					label: descriptor.label,
					template_key: descriptor.template_key,
					is_exclusive: true === descriptor.is_exclusive,
					is_read_only: true === descriptor.is_read_only,
					toggle_open_label: 'string' === typeof descriptor.toggle_open_label ? descriptor.toggle_open_label : '',
					toggle_close_label: 'string' === typeof descriptor.toggle_close_label ? descriptor.toggle_close_label : ''
				};
			} );
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
		function emit_row_presentation_event( event_name, resource_id, descriptor, additional ) {
			var event_detail;
			var lifecycle_event;

			if ( ! mount || 'function' !== typeof mount.dispatchEvent ) {
				return;
			}
			event_detail = Object.assign( {
				resource_id: resource_id,
				presentation_id: descriptor.id,
				template_key: descriptor.template_key,
				descriptor: Object.assign( {}, descriptor ),
				hosts: get_row_presentation_hosts( resource_id, descriptor.id )
			}, additional || {} );
			if ( 'function' === typeof window.CustomEvent ) {
				lifecycle_event = new window.CustomEvent( 'wpbc:timeline:row-presentation:' + event_name, {
					detail: event_detail
				} );
			} else if ( document.createEvent ) {
				lifecycle_event = document.createEvent( 'CustomEvent' );
				lifecycle_event.initCustomEvent( 'wpbc:timeline:row-presentation:' + event_name, false, false, event_detail );
			}
			if ( lifecycle_event ) {
				mount.dispatchEvent( lifecycle_event );
			}
		}

		/**
		 * Return synchronized Resource/canvas hosts for one presentation.
		 *
		 * @param {number} resource_id    Authorized Resource ID.
		 * @param {string} presentation_id Stable presentation ID.
		 * @return {Element[]} Current presentation hosts.
		 */
		function get_row_presentation_hosts( resource_id, presentation_id ) {
			var hosts = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-presentation-host]' ) : [];

			return Array.prototype.filter.call( hosts, function ( host ) {
				return Number( host.getAttribute( 'data-wpbc-timeline-resource-id' ) ) === Number( resource_id )
					&& host.getAttribute( 'data-wpbc-timeline-row-presentation-host' ) === presentation_id;
			} );
		}

		/**
		 * Return one current presentation toggle without trusting a CSS fragment.
		 *
		 * @param {number} resource_id     Authorized Resource ID.
		 * @param {string} presentation_id Stable presentation ID.
		 * @return {Element|null} Matching toggle or null.
		 */
		function get_row_presentation_toggle( resource_id, presentation_id ) {
			var toggles = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-presentation-toggle]' ) : [];

			return Array.prototype.filter.call( toggles, function ( toggle ) {
				return Number( toggle.getAttribute( 'data-wpbc-timeline-resource-id' ) ) === Number( resource_id )
					&& toggle.getAttribute( 'data-wpbc-timeline-row-presentation-toggle' ) === presentation_id;
			} )[ 0 ] || null;
		}

		/**
		 * Return an allow-listed descriptor for one current Resource.
		 *
		 * @param {number} resource_id     Authorized Resource ID.
		 * @param {string} presentation_id Stable presentation ID.
		 * @return {Object|null} Descriptor or null.
		 */
		function get_authorized_row_presentation( resource_id, presentation_id ) {
			var descriptors = authorized_presentations_by_resource[ Number( resource_id ) ] || [];

			return descriptors.filter( function ( descriptor ) {
				return descriptor.id === presentation_id;
			} )[ 0 ] || null;
		}

		/**
		 * Return whether a presentation is currently open for one Resource.
		 *
		 * @param {number} resource_id     Authorized Resource ID.
		 * @param {string} presentation_id Stable presentation ID.
		 * @return {boolean} True when open.
		 */
		function is_row_presentation_open( resource_id, presentation_id ) {
			return Boolean(
				open_presentations_by_resource[ Number( resource_id ) ]
				&& open_presentations_by_resource[ Number( resource_id ) ][ presentation_id ]
			);
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
		function get_row_presentation_scope_resource_ids( resource_id, presentation_id ) {
			var pending_ids = [ Number( resource_id ) ];
			var seen_ids = {};
			var controlled_ids = [];

			while ( pending_ids.length ) {
				resource_id = Number( pending_ids.shift() );
				if ( ! resource_id || seen_ids[ resource_id ] ) {
					continue;
				}
				seen_ids[ resource_id ] = true;
				if ( get_authorized_row_presentation( resource_id, presentation_id ) ) {
					controlled_ids.push( resource_id );
				}
				( resource_children_by_parent[ resource_id ] || [] ).forEach( function ( child_id ) {
					pending_ids.push( child_id );
				} );
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
		function interpolate_presentation_label( pattern, values ) {
			Object.keys( values || {} ).forEach( function ( key ) {
				pattern = String( pattern || '' ).replace( new RegExp( '\\{' + key + '\\}', 'g' ), String( values[ key ] ) );
			} );

			return String( pattern || '' );
		}

		/**
		 * Build the current accessible state for one row presentation toggle.
		 *
		 * @param {number} resource_id Authorized Resource ID.
		 * @param {Object} descriptor Registered neutral descriptor.
		 * @return {Object} Toggle state and controlled host identities.
		 */
		function get_row_presentation_toggle_state( resource_id, descriptor ) {
			var controlled_resource_ids = get_row_presentation_scope_resource_ids( resource_id, descriptor.id );
			var controls_group = 1 < controlled_resource_ids.length;
			var is_open = 0 < controlled_resource_ids.length && controlled_resource_ids.every( function ( controlled_resource_id ) {
				return is_row_presentation_open( controlled_resource_id, descriptor.id );
			} );
			var label_key = controls_group
				? ( is_open ? 'hide_resource_group_presentation' : 'show_resource_group_presentation' )
				: ( is_open ? 'hide_resource_presentation' : 'show_resource_presentation' );
		var fallback_label = descriptor.label;
			var controlled_host_ids = [];

			controlled_resource_ids.forEach( function ( controlled_resource_id ) {
				controlled_host_ids.push( 'wpbc_timeline_row_presentation_resource_' + controlled_resource_id + '_' + descriptor.id );
				controlled_host_ids.push( 'wpbc_timeline_row_presentation_canvas_' + controlled_resource_id + '_' + descriptor.id );
			} );

			return {
				is_open: is_open,
				controls_group: controls_group,
				controlled_resource_ids: controlled_resource_ids,
				controlled_host_ids: controlled_host_ids.join( ' ' ),
				accessible_label: interpolate_presentation_label(
					settings.i18n && settings.i18n[ label_key ] ? settings.i18n[ label_key ] : fallback_label,
					{
						label: descriptor.label,
						resource: resource_titles_by_id[ Number( resource_id ) ] || ''
					}
				)
			};
		}

		/**
		 * Refresh every rendered control affected by presentation state changes.
		 *
		 * @param {string} presentation_id Registered presentation ID.
		 * @return {void}
		 */
		function synchronize_row_presentation_toggles( presentation_id ) {
			var toggles = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-presentation-toggle]' ) : [];

			Array.prototype.forEach.call( toggles, function ( toggle ) {
				var resource_id;
				var descriptor;
				var toggle_state;
				var icon;

				if ( toggle.getAttribute( 'data-wpbc-timeline-row-presentation-toggle' ) !== presentation_id ) {
					return;
				}
				resource_id = Number( toggle.getAttribute( 'data-wpbc-timeline-resource-id' ) );
				descriptor = get_authorized_row_presentation( resource_id, presentation_id );
				if ( ! descriptor ) {
					return;
				}
				toggle_state = get_row_presentation_toggle_state( resource_id, descriptor );
				toggle.setAttribute( 'aria-expanded', toggle_state.is_open ? 'true' : 'false' );
				toggle.setAttribute( 'aria-controls', toggle_state.controlled_host_ids );
				toggle.setAttribute( 'aria-label', toggle_state.accessible_label );
				toggle.setAttribute( 'title', toggle_state.accessible_label );
				icon = toggle.querySelector( '[class*="wpbc-bi-chevron-"]' );
				if ( icon ) {
					icon.classList.remove( 'wpbc-bi-chevron-right', 'wpbc-bi-chevron-down' );
					icon.classList.add( toggle_state.is_open ? 'wpbc-bi-chevron-down' : 'wpbc-bi-chevron-right' );
				}
			} );
		}

		/**
		 * Reconcile retained open state against the latest authorized Resource DTOs.
		 *
		 * @param {Array<Object>} resources Latest authorized Resource DTOs.
		 * @return {void}
		 */
		function reconcile_row_presentations( resources ) {
			var next_authorized = {};
			var next_resource_ids_in_order = [];
			var next_children_by_parent = {};
			var next_titles_by_id = {};

			resources.forEach( function ( resource ) {
				var resource_id = Math.max( 0, Math.round( Number( resource && resource.id ) || 0 ) );
				var parent_id = Math.max( 0, Math.round( Number( resource && resource.parent_id ) || 0 ) );

				if ( resource_id ) {
					next_authorized[ resource_id ] = normalize_row_presentations( resource.row_presentations );
					next_resource_ids_in_order.push( resource_id );
					next_titles_by_id[ resource_id ] = String( resource.title || '' );
					if ( parent_id ) {
						if ( ! next_children_by_parent[ parent_id ] ) {
							next_children_by_parent[ parent_id ] = [];
						}
						next_children_by_parent[ parent_id ].push( resource_id );
					}
				}
			} );
			Object.keys( open_presentations_by_resource ).forEach( function ( resource_id_key ) {
				var resource_id = Number( resource_id_key );

				Object.keys( open_presentations_by_resource[ resource_id ] || {} ).forEach( function ( presentation_id ) {
					var next_descriptor = ( next_authorized[ resource_id ] || [] ).filter( function ( descriptor ) {
						return descriptor.id === presentation_id;
					} )[ 0 ];
					var previous_descriptor = get_authorized_row_presentation( resource_id, presentation_id );

					if ( ! next_descriptor ) {
						emit_row_presentation_event( 'removed', resource_id, previous_descriptor || {
							id: presentation_id,
							template_key: ''
						} );
						delete open_presentations_by_resource[ resource_id ][ presentation_id ];
					}
				} );
				if ( ! Object.keys( open_presentations_by_resource[ resource_id ] || {} ).length ) {
					delete open_presentations_by_resource[ resource_id ];
				}
			} );
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
			var toggle = active_element && active_element.closest
				? active_element.closest( '[data-wpbc-timeline-row-presentation-toggle]' )
				: null;

			return toggle ? {
				resource_id: Number( toggle.getAttribute( 'data-wpbc-timeline-resource-id' ) ),
				presentation_id: toggle.getAttribute( 'data-wpbc-timeline-row-presentation-toggle' )
			} : null;
		}

		/**
		 * Restore focus to the equivalent authorized toggle after a rerender.
		 *
		 * @param {Object|null} focus_identity Captured toggle identity.
		 * @return {void}
		 */
		function restore_row_presentation_focus( focus_identity ) {
			var toggle = focus_identity
				? get_row_presentation_toggle( focus_identity.resource_id, focus_identity.presentation_id )
				: null;

			if ( toggle && 'function' === typeof toggle.focus ) {
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
		function deduplicate_segments( segments ) {
			var seen_segment_ids = {};

			return segments.filter( function ( segment ) {
				var segment_id = segment && segment.segment_id ? String( segment.segment_id ) : '';

				if ( ! segment_id || seen_segment_ids[ segment_id ] ) {
					return false;
				}
				seen_segment_ids[ segment_id ] = true;
				return true;
			} );
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
			var canvas_rows = mount ? mount.querySelectorAll( '.wpbc_timeline__canvas_row' ) : [];

			Array.prototype.forEach.call( canvas_rows, function ( canvas_row ) {
				canvas_row.classList.remove( 'is-odd', 'is-even' );
				if ( canvas_row.hidden ) {
					return;
				}

				canvas_row.classList.add( 0 === visible_row_index % 2 ? 'is-odd' : 'is-even' );
				visible_row_index += 1;
			} );
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
		function retain_expansion_state( preference_key, resource_id, is_expanded ) {
			var retained_ids;

			resource_id = Math.max( 0, Math.round( Number( resource_id ) || 0 ) );
			if ( ! resource_id ) {
				return;
			}
			if ( ! settings.preferences || 'object' !== typeof settings.preferences ) {
				settings.preferences = {};
			}
			retained_ids = ( Array.isArray( settings.preferences[ preference_key ] )
				? settings.preferences[ preference_key ]
				: []
			).map( function ( retained_id ) {
				return Math.max( 0, Math.round( Number( retained_id ) || 0 ) );
			} ).filter( function ( retained_id, retained_index, all_retained_ids ) {
				return retained_id
					&& retained_id !== resource_id
					&& retained_index === all_retained_ids.indexOf( retained_id );
			} );
			if ( is_expanded ) {
				retained_ids.push( resource_id );
			}
			retained_ids.sort( function ( left_id, right_id ) {
				return left_id - right_id;
			} );
			settings.preferences[ preference_key ] = retained_ids;
		}

		/**
		 * Stop observing rows that are about to be replaced by a complete render.
		 *
		 * @return {void}
		 */
		function reset_row_observations() {
			if ( row_observer ) {
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
		function render_rows( initial ) {
			initial = initial || {};
			var resources = Array.isArray( initial.resources ) ? initial.resources : [];
			var presentation_focus = capture_row_presentation_focus();
			var segments = deduplicate_segments( Array.isArray( initial.segments ) ? initial.segments : [] );
			var time_slot_overflows = Array.isArray( initial.time_slot_overflows ) ? initial.time_slot_overflows : [];
			var details_expanded_ids = Array.isArray( settings.preferences && settings.preferences.expanded_resource_ids ) ? settings.preferences.expanded_resource_ids : [];
			var hierarchy_expanded_ids = Array.isArray( settings.preferences && settings.preferences.expanded_parent_ids ) ? settings.preferences.expanded_parent_ids : [];
			var details_expanded_map = {};
			var hierarchy_expanded_map = {};
			var resource_summaries_by_id = {};
			var resource_host = mount ? mount.querySelector( '[data-wpbc-timeline-resource-rows]' ) : null;
			var canvas_host = mount ? mount.querySelector( '[data-wpbc-timeline-canvas-rows]' ) : null;
			var row_template = get_template( 'resource_row' );
			var segment_template = get_template( 'booking_segment' );
			var time_slot_overflow_template = get_template( 'time_slot_overflow' );

			if ( ! resource_host || ! canvas_host || ! row_template ) {
				return false;
			}
			reconcile_row_presentations( resources );
			begin_booking_refresh();
			resources.forEach( function ( resource ) {
				var resource_id = Math.max( 0, Math.round( Number( resource && resource.id ) || 0 ) );

				if ( resource_id ) {
					resource_summaries_by_id[ resource_id ] = resource;
				}
			} );
			reset_row_observations();
			resource_host.textContent = '';
			canvas_host.textContent = '';

			details_expanded_ids.forEach( function ( resource_id ) {
				details_expanded_map[ Number( resource_id ) ] = true;
			} );
			hierarchy_expanded_ids.forEach( function ( resource_id ) {
				hierarchy_expanded_map[ Number( resource_id ) ] = true;
			} );

			resources.forEach( function ( resource ) {
				var resource_id = Number( resource.id );
				var row_presentations = authorized_presentations_by_resource[ resource_id ] || [];
				var open_row_presentation_ids = Object.keys( open_presentations_by_resource[ resource_id ] || {} );
				var row_presentation_toggle_states = {};

				row_presentations.forEach( function ( descriptor ) {
					row_presentation_toggle_states[ descriptor.id ] = get_row_presentation_toggle_state( resource_id, descriptor );
				} );
				var row_view_model = Object.assign( {}, resource, {
					axis: settings.axis,
					i18n: settings.i18n,
					row_presentations: row_presentations,
					open_row_presentation_ids: open_row_presentation_ids,
					row_presentation_toggle_states: row_presentation_toggle_states,
					is_details_expanded: Boolean( resource.has_details && details_expanded_map[ Number( resource.id ) ] ),
					is_hierarchy_expanded: Boolean( resource.is_expandable && hierarchy_expanded_map[ Number( resource.id ) ] ),
					is_hierarchy_visible: ! resource.is_child || Boolean( hierarchy_expanded_map[ Number( resource.parent_id ) ] )
				} );
				var row_buffer = document.createElement( 'div' );
				var resource_row;
				var canvas_row;

				row_buffer.innerHTML = row_template( row_view_model );
				resource_row = row_buffer.children[ 0 ];
				canvas_row = row_buffer.children[ 1 ];
				if ( ! resource_row || ! canvas_row ) {
					return;
				}
				resource_host.appendChild( resource_row );
				canvas_host.appendChild( canvas_row );
				row_presentations.forEach( function ( descriptor ) {
					emit_row_presentation_event( 'hosts-ready', resource_id, descriptor, {
						is_open: is_row_presentation_open( resource_id, descriptor.id )
					} );
				} );
			} );
			update_visible_row_striping();
			restore_row_presentation_focus( presentation_focus );

			if ( segment_template ) {
				segments.forEach( function ( segment ) {
					var segment_host;
					var segment_buffer;
					var segment_element;

					if ( false === segment.is_visible || true === segment.is_time_slot_overflow_item ) {
						return;
					}
					segment_host = canvas_host.querySelector(
						'[data-wpbc-timeline-row-key="resource-' + Number( segment.resource_id ) + '"] [data-wpbc-timeline-segments]'
					);
					if ( ! segment_host ) {
						return;
					}
					segment_buffer = document.createElement( 'div' );
					segment_buffer.innerHTML = segment_template( Object.assign( {}, segment, {
						i18n: settings.i18n
					} ) );
					segment_element = segment_buffer.firstElementChild;
					if ( segment_element ) {
						segment_host.appendChild( segment_element );
						register_booking_segment(
							segment_element,
							segment,
							resource_summaries_by_id[ Number( segment.resource_id ) ] || {}
						);
					}
				} );
			}
			if ( time_slot_overflow_template ) {
				time_slot_overflows.forEach( function ( overflow ) {
					var segment_host = canvas_host.querySelector(
						'[data-wpbc-timeline-row-key="resource-' + Number( overflow.resource_id ) + '"] [data-wpbc-timeline-segments]'
					);
					var overflow_buffer;

					if ( ! segment_host ) {
						return;
					}
					overflow_buffer = document.createElement( 'div' );
					overflow_buffer.innerHTML = time_slot_overflow_template( Object.assign( {}, overflow, {
						i18n: settings.i18n
					} ) );
					if ( overflow_buffer.firstElementChild ) {
						segment_host.appendChild( overflow_buffer.firstElementChild );
					}
				} );
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
			var row_elements = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-key]' ) : [];

			Array.prototype.forEach.call( row_elements, function ( row_element ) {
				var row_key = row_element.getAttribute( 'data-wpbc-timeline-row-key' );

				if ( ! row_key ) {
					return;
				}
				if ( ! row_groups[ row_key ] ) {
					row_groups[ row_key ] = [];
				}
				row_groups[ row_key ].push( row_element );
			} );

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
		function synchronize_row_presentation_offsets( row_elements ) {
			var presentation_hosts = {};
			var presentation_ids = [];

			row_elements.forEach( function ( row_element ) {
				var row_hosts = row_element.querySelectorAll( '[data-wpbc-timeline-row-presentation-host]' );

				Array.prototype.forEach.call( row_hosts, function ( host_element ) {
					var presentation_id = host_element.getAttribute( 'data-wpbc-timeline-row-presentation-host' );

					host_element.style.marginBlockStart = '';
					if ( host_element.hidden || ! presentation_id ) {
						return;
					}
					if ( ! presentation_hosts[ presentation_id ] ) {
						presentation_hosts[ presentation_id ] = [];
						presentation_ids.push( presentation_id );
					}
					presentation_hosts[ presentation_id ].push( host_element );
				} );
			} );

			presentation_ids.forEach( function ( presentation_id ) {
				var hosts = presentation_hosts[ presentation_id ];
				var latest_start = null;

				if ( 2 > hosts.length ) {
					return;
				}
				hosts.forEach( function ( host_element ) {
					var host_start = host_element.getBoundingClientRect().top;

					latest_start = null === latest_start ? host_start : Math.max( latest_start, host_start );
				} );
				hosts.forEach( function ( host_element ) {
					var start_offset = latest_start - host_element.getBoundingClientRect().top;

					if ( 0.5 < start_offset ) {
						host_element.style.marginBlockStart = start_offset + 'px';
					}
				} );
			} );
		}

		/**
		 * Synchronize Resource and canvas row heights after layout changes.
		 *
		 * @param {string[]|null} row_keys Stable row keys, or null for every row.
		 * @return {void}
		 */
		function synchronize_row_heights( row_keys ) {
			var row_groups = collect_row_groups();
			var synchronize_every_row = ! Array.isArray( row_keys ) || ! row_keys.length;

			Object.keys( row_groups ).forEach( function ( row_key ) {
				var maximum_height = 0;
				var synchronized_height;
				var synchronized_minimum_height;

				if ( ! synchronize_every_row && -1 === row_keys.indexOf( row_key ) ) {
					return;
				}
				row_groups[ row_key ].forEach( function ( row_element ) {
					row_element.style.minHeight = '';
				} );
				synchronize_row_presentation_offsets( row_groups[ row_key ] );
				row_groups[ row_key ].forEach( function ( row_element ) {
					maximum_height = Math.max( maximum_height, row_element.getBoundingClientRect().height );
				} );

				synchronized_height = Math.ceil( maximum_height );
				synchronized_minimum_height = synchronized_height ? synchronized_height + 'px' : '';
				row_groups[ row_key ].forEach( function ( row_element ) {
					if ( row_observer ) {
						expected_row_heights.set( row_element, synchronized_height );
					}
					if ( row_element.style.minHeight !== synchronized_minimum_height ) {
						row_element.style.minHeight = synchronized_minimum_height;
					}
				} );
			} );

			after_row_synchronization();
		}

		/**
		 * Request one coalesced row-height synchronization for the next frame.
		 *
		 * @param {string|string[]|Event} row_keys Stable row key(s), or all rows.
		 * @return {void}
		 */
		function schedule_row_synchronization( row_keys ) {
			if ( 'string' === typeof row_keys && row_keys ) {
				pending_row_keys[ row_keys ] = true;
			} else if ( Array.isArray( row_keys ) ) {
				row_keys.forEach( function ( row_key ) {
					if ( row_key ) {
						pending_row_keys[ row_key ] = true;
					}
				} );
			} else {
				synchronize_all_rows = true;
			}

			if ( synchronization_frame ) {
				return;
			}
			synchronization_frame = window.requestAnimationFrame( function () {
				var row_keys_to_synchronize = synchronize_all_rows ? null : Object.keys( pending_row_keys );

				synchronization_frame = 0;
				pending_row_keys = {};
				synchronize_all_rows = false;
				synchronize_row_heights( row_keys_to_synchronize );
			} );
		}

		/**
		 * Return one rendered Timeline row's border-box height.
		 *
		 * @param {Element} row_element Resource or canvas row.
		 * @return {number} Rounded CSS-pixel height.
		 */
		function get_row_height( row_element ) {
			return Math.ceil( row_element.getBoundingClientRect().height );
		}

		/**
		 * Process row resize entries without reacting to module-authored writes.
		 *
		 * @param {ResizeObserverEntry[]} resize_entries Resize observations.
		 * @return {void}
		 */
		function handle_row_resize( resize_entries ) {
			var changed_row_keys = {};

			Array.prototype.forEach.call( resize_entries, function ( resize_entry ) {
				var row_element = resize_entry.target;
				var row_key = row_element.getAttribute( 'data-wpbc-timeline-row-key' );
				var expected_height = expected_row_heights.get( row_element );
				var current_height = get_row_height( row_element );

				if ( 'number' === typeof expected_height && 1 >= Math.abs( current_height - expected_height ) ) {
					expected_row_heights.delete( row_element );
					return;
				}
				expected_row_heights.delete( row_element );
				if ( row_key ) {
					changed_row_keys[ row_key ] = true;
				}
			} );

			if ( Object.keys( changed_row_keys ).length ) {
				schedule_row_synchronization( Object.keys( changed_row_keys ) );
			}
		}

		/**
		 * Observe each current row half exactly once for size changes.
		 *
		 * @return {string[]} Stable keys for newly observed row groups.
		 */
		function observe_rows() {
			var row_elements = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-key]' ) : [];
			var new_row_keys = {};

			Array.prototype.forEach.call( row_elements, function ( row_element ) {
				var row_key;

				if ( row_synchronization_initialized && observed_row_elements.has( row_element ) ) {
					return;
				}
				row_key = row_element.getAttribute( 'data-wpbc-timeline-row-key' );
				if ( row_key ) {
					new_row_keys[ row_key ] = true;
				}
				if ( row_synchronization_initialized ) {
					observed_row_elements.add( row_element );
					if ( row_observer ) {
						row_observer.observe( row_element );
					}
				}
			} );

			if ( Object.keys( new_row_keys ).length ) {
				schedule_row_synchronization( Object.keys( new_row_keys ) );
			}
			return Object.keys( new_row_keys );
		}

		/**
		 * Observe new rows and dirty only row groups touched by DOM mutations.
		 *
		 * @param {MutationRecord[]} mutation_records Child-list mutations.
		 * @return {void}
		 */
		function handle_row_mutations( mutation_records ) {
			var changed_row_keys = {};

			observe_rows();
			Array.prototype.forEach.call( mutation_records, function ( mutation_record ) {
				var row_element = mutation_record.target.closest
					? mutation_record.target.closest( '[data-wpbc-timeline-row-key]' )
					: null;
				var row_key = row_element ? row_element.getAttribute( 'data-wpbc-timeline-row-key' ) : '';

				if ( row_key ) {
					changed_row_keys[ row_key ] = true;
				}
			} );

			if ( Object.keys( changed_row_keys ).length ) {
				schedule_row_synchronization( Object.keys( changed_row_keys ) );
			}
		}

		/**
		 * Synchronize the row containing a delayed image or captured resource.
		 *
		 * @param {Event} load_event Captured load event.
		 * @return {void}
		 */
		function handle_row_content_load( load_event ) {
			var row_element = load_event.target && load_event.target.closest
				? load_event.target.closest( '[data-wpbc-timeline-row-key]' )
				: null;
			var row_key = row_element ? row_element.getAttribute( 'data-wpbc-timeline-row-key' ) : '';

			schedule_row_synchronization( row_key || null );
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
		function handle_row_presentation_rendered( event ) {
			var detail = event && event.detail ? event.detail : {};
			var resource_id = Math.max( 0, Math.round( Number( detail.resource_id ) || 0 ) );
			var presentation_id = String( detail.presentation_id || '' );

			if ( ! resource_id || ! get_authorized_row_presentation( resource_id, presentation_id ) ) {
				return;
			}
			schedule_row_synchronization( 'resource-' + resource_id );
		}

		/**
		 * Apply one details-expanded state to both halves of a row group.
		 *
		 * @param {string}  row_key     Stable row identifier.
		 * @param {boolean} is_expanded Desired details state.
		 * @param {Element} trigger     Toggle that initiated the change.
		 * @return {void}
		 */
		function set_row_expanded( row_key, is_expanded, trigger ) {
			var row_elements = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-key]' ) : [];
			var resource_id_match = String( row_key || '' ).match( /^resource-(\d+)$/ );

			Array.prototype.forEach.call( row_elements, function ( row_element ) {
				var details = row_element.querySelectorAll( '[data-wpbc-timeline-row-details]' );

				if ( row_key !== row_element.getAttribute( 'data-wpbc-timeline-row-key' ) ) {
					return;
				}
				row_element.classList.toggle( 'is-expanded', is_expanded );
				Array.prototype.forEach.call( details, function ( detail_element ) {
					detail_element.hidden = ! is_expanded;
				} );
			} );

			if ( trigger ) {
				trigger.setAttribute( 'aria-expanded', is_expanded ? 'true' : 'false' );
				trigger.setAttribute(
					'aria-label',
					is_expanded ? settings.i18n.collapse_resource : settings.i18n.expand_resource
				);
			}
			if ( resource_id_match ) {
				retain_expansion_state( 'expanded_resource_ids', Number( resource_id_match[ 1 ] ), is_expanded );
			}
			schedule_row_synchronization( row_key );
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
		function set_row_presentation_open( resource_id, presentation_id, is_open, trigger, restore_focus ) {
			var descriptor = get_authorized_row_presentation( resource_id, presentation_id );
			var resource_open_state;

			resource_id = Math.max( 0, Math.round( Number( resource_id ) || 0 ) );
			if ( ! resource_id || ! descriptor ) {
				return false;
			}
			if ( is_row_presentation_open( resource_id, presentation_id ) === is_open ) {
				if ( ! is_open && restore_focus && trigger && 'function' === typeof trigger.focus ) {
					trigger.focus();
				}
				return true;
			}
			resource_open_state = open_presentations_by_resource[ resource_id ] || {};
			if ( is_open ) {
				Object.keys( resource_open_state ).forEach( function ( open_presentation_id ) {
					var open_descriptor = get_authorized_row_presentation( resource_id, open_presentation_id );

					if (
						open_presentation_id !== presentation_id
						&& ( descriptor.is_exclusive || ( open_descriptor && open_descriptor.is_exclusive ) )
					) {
						apply_row_presentation_state( resource_id, open_descriptor, false, null );
					}
				} );
			}
			apply_row_presentation_state( resource_id, descriptor, is_open, trigger );
			if ( ! is_open && restore_focus && trigger && 'function' === typeof trigger.focus ) {
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
		function set_row_presentation_scope_open( resource_id, presentation_id, is_open, trigger, restore_focus ) {
			var controlled_resource_ids = get_row_presentation_scope_resource_ids( resource_id, presentation_id );
			var handled_count = 0;

			controlled_resource_ids.forEach( function ( controlled_resource_id ) {
				if ( set_row_presentation_open( controlled_resource_id, presentation_id, is_open, null, false ) ) {
					handled_count += 1;
				}
			} );
			synchronize_row_presentation_toggles( presentation_id );
			if ( handled_count && ! is_open && restore_focus && trigger && 'function' === typeof trigger.focus ) {
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
		function apply_row_presentation_state( resource_id, descriptor, is_open, trigger ) {
			var row_elements = mount ? mount.querySelectorAll( '[data-wpbc-timeline-row-key="resource-' + Number( resource_id ) + '"]' ) : [];
			var hosts;

			if ( ! descriptor ) {
				return;
			}
			if ( ! open_presentations_by_resource[ resource_id ] ) {
				open_presentations_by_resource[ resource_id ] = {};
			}
			if ( is_open ) {
				open_presentations_by_resource[ resource_id ][ descriptor.id ] = true;
			} else {
				delete open_presentations_by_resource[ resource_id ][ descriptor.id ];
				if ( ! Object.keys( open_presentations_by_resource[ resource_id ] ).length ) {
					delete open_presentations_by_resource[ resource_id ];
				}
			}

			hosts = get_row_presentation_hosts( resource_id, descriptor.id );
			Array.prototype.forEach.call( hosts, function ( host ) {
				host.hidden = ! is_open;
				host.setAttribute( 'aria-hidden', is_open ? 'false' : 'true' );
			} );
			Array.prototype.forEach.call( row_elements, function ( row_element ) {
				row_element.classList.toggle(
					'has-open-row-presentation',
					Boolean( Object.keys( open_presentations_by_resource[ resource_id ] || {} ).length )
				);
			} );
			emit_row_presentation_event( is_open ? 'opened' : 'closed', resource_id, descriptor, {
				is_open: is_open
			} );
			synchronize_row_presentation_toggles( descriptor.id );
			schedule_row_synchronization( 'resource-' + resource_id );
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
		function set_all_row_presentations_open( presentation_id, is_open ) {
			var updated_count = 0;

			Object.keys( authorized_presentations_by_resource ).forEach( function ( resource_id ) {
				if ( set_row_presentation_open( Number( resource_id ), presentation_id, is_open, null, false ) ) {
					updated_count += 1;
				}
			} );

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
		function open_first_row_presentation( presentation_id ) {
			var opened_resource_id = 0;

			authorized_resource_ids_in_order.some( function ( resource_id ) {
				if ( ! get_authorized_row_presentation( resource_id, presentation_id ) ) {
					return false;
				}
				if ( set_row_presentation_open( resource_id, presentation_id, true, null, false ) ) {
					opened_resource_id = resource_id;
					return true;
				}
				return false;
			} );

			return opened_resource_id;
		}

		/**
		 * Handle one delegated neutral presentation toggle.
		 *
		 * @param {MouseEvent} event Browser click event.
		 * @return {boolean} True when a registered presentation handled the event.
		 */
		function handle_row_presentation_click( event ) {
			var trigger = event.target && event.target.closest
				? event.target.closest( '[data-wpbc-timeline-row-presentation-toggle]' )
				: null;
			var resource_id;
			var presentation_id;
			var descriptor;
			var toggle_state;

			if ( ! trigger ) {
				return false;
			}
			resource_id = Number( trigger.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			presentation_id = trigger.getAttribute( 'data-wpbc-timeline-row-presentation-toggle' );
			descriptor = get_authorized_row_presentation( resource_id, presentation_id );
			if ( ! descriptor ) {
				return false;
			}
			toggle_state = get_row_presentation_toggle_state( resource_id, descriptor );
			if ( event.preventDefault ) {
				event.preventDefault();
			}
			return set_row_presentation_scope_open(
				resource_id,
				presentation_id,
				! toggle_state.is_open,
				trigger,
				true
			);
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
		function handle_row_presentation_keydown( event ) {
			var host;
			var resource_id;
			var presentation_id;
			var trigger;

			if ( 'Escape' !== event.key || event.defaultPrevented ) {
				return false;
			}
			host = event.target && event.target.closest
				? event.target.closest( '[data-wpbc-timeline-row-presentation-host]' )
				: null;
			if ( ! host || host.hidden ) {
				return false;
			}
			resource_id = Number( host.getAttribute( 'data-wpbc-timeline-resource-id' ) );
			presentation_id = String( host.getAttribute( 'data-wpbc-timeline-row-presentation-host' ) || '' );
			if ( ! is_row_presentation_open( resource_id, presentation_id ) ) {
				return false;
			}
			trigger = get_row_presentation_toggle( resource_id, presentation_id );
			if ( event.preventDefault ) {
				event.preventDefault();
			}
			if ( event.stopPropagation ) {
				event.stopPropagation();
			}

			return set_row_presentation_open( resource_id, presentation_id, false, trigger, true );
		}

		/**
		 * Show or hide direct child row halves for an authorized parent Resource.
		 *
		 * @param {number}  parent_id   Authorized parent Resource ID.
		 * @param {boolean} is_expanded Desired child visibility.
		 * @param {Element} trigger     Hierarchy toggle that initiated the change.
		 * @return {void}
		 */
		function set_hierarchy_expanded( parent_id, is_expanded, trigger ) {
			var child_rows = mount ? mount.querySelectorAll( '[data-wpbc-timeline-parent-id="' + Number( parent_id ) + '"]' ) : [];
			var icon = trigger ? trigger.querySelector( '[data-wpbc-timeline-hierarchy-icon]' ) : null;
			var affected_row_keys = {};

			Array.prototype.forEach.call( child_rows, function ( child_row ) {
				var row_key;

				if ( 0 === Number( child_row.getAttribute( 'data-wpbc-timeline-parent-id' ) ) ) {
					return;
				}
				child_row.hidden = ! is_expanded;
				row_key = child_row.getAttribute( 'data-wpbc-timeline-row-key' );
				if ( row_key ) {
					affected_row_keys[ row_key ] = true;
				}
			} );

			if ( trigger ) {
				trigger.setAttribute( 'aria-expanded', is_expanded ? 'true' : 'false' );
				trigger.setAttribute(
					'aria-label',
					is_expanded ? settings.i18n.collapse_children : settings.i18n.expand_children
				);
			}
			if ( icon ) {
				icon.classList.toggle( 'wpbc-bi-dash-square-dotted', is_expanded );
				icon.classList.toggle( 'wpbc-bi-plus-square-dotted', ! is_expanded );
			}
			retain_expansion_state( 'expanded_parent_ids', parent_id, is_expanded );
			update_visible_row_striping();
			if ( Object.keys( affected_row_keys ).length ) {
				schedule_row_synchronization( Object.keys( affected_row_keys ) );
			}
		}

		/**
		 * Start responsive synchronization for expansion, images, fonts, and width.
		 *
		 * @return {void}
		 */
		function initialize() {
			var initialized_generation;

			if ( ! mount || row_synchronization_initialized ) {
				return;
			}
			lifecycle_generation += 1;
			if ( 'function' === typeof window.ResizeObserver ) {
				row_observer = new window.ResizeObserver( handle_row_resize );
			}
			if ( 'function' === typeof window.MutationObserver ) {
				mutation_observer = new window.MutationObserver( handle_row_mutations );
				mutation_observer.observe( mount, { childList: true, subtree: true } );
			}
			if ( ! row_observer ) {
				window.addEventListener( 'resize', schedule_row_synchronization );
			}
			row_synchronization_initialized = true;
			mount.addEventListener( 'load', handle_row_content_load, true );
			mount.addEventListener( 'keydown', handle_row_presentation_keydown );
			mount.addEventListener( 'wpbc:timeline:row-presentation:rendered', handle_row_presentation_rendered );
			if ( document.fonts && document.fonts.ready && 'function' === typeof document.fonts.ready.then ) {
				initialized_generation = lifecycle_generation;
				document.fonts.ready.then( function () {
					if ( ! row_synchronization_initialized || ! is_host_active() || initialized_generation !== lifecycle_generation ) {
						return;
					}
					schedule_row_synchronization();
				} );
			}
			observe_rows();
		}

		/**
		 * Release observers, listeners, and scheduled work owned by this instance.
		 *
		 * @return {void}
		 */
		function destroy() {
			if ( ! row_synchronization_initialized ) {
				return;
			}
			lifecycle_generation += 1;
			row_synchronization_initialized = false;
			if ( synchronization_frame ) {
				window.cancelAnimationFrame( synchronization_frame );
			}
			synchronization_frame = 0;
			pending_row_keys = {};
			synchronize_all_rows = false;
			if ( row_observer ) {
				row_observer.disconnect();
			} else {
				window.removeEventListener( 'resize', schedule_row_synchronization );
			}
			if ( mutation_observer ) {
				mutation_observer.disconnect();
			}
			if ( mount ) {
				mount.removeEventListener( 'load', handle_row_content_load, true );
				mount.removeEventListener( 'keydown', handle_row_presentation_keydown );
				mount.removeEventListener( 'wpbc:timeline:row-presentation:rendered', handle_row_presentation_rendered );
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

	if (
		window.wpbc_timeline_modules
		&& 'function' === typeof window.wpbc_timeline_modules.register_factory
	) {
		window.wpbc_timeline_modules.register_factory( module_id, create_rendering_controller );
	}
}( window, document ) );
