/**
 * Browser adapter for Setup Wizard Booking Resource creation and editing.
 *
 * The adapter keeps existing updates separate from new drafts. It sends only
 * changed existing Resources, and the server remains authoritative for stale
 * detection, authorization, edition rules, and persistence.
 *
 * @package Booking Calendar
 */
( function ( $, window, document ) {
	'use strict';

	var module_config = window.wpbc_setup_wizard_booking_resources || { i18n: {} };

	/**
	 * Create one isolated Resource editor adapter.
	 *
	 * @param {Object} config Translated presentation strings.
	 * @return {Object} Setup Wizard step adapter.
	 */
	function create_booking_resources_adapter( config ) {
		var shell_api = null;
		var root = null;
		var editor = null;
		var editable_fields = [ 'title', 'description', 'picture_url', 'base_cost' ];

		/**
		 * Return a translated string or fallback.
		 *
		 * @param {string} key      Translation key.
		 * @param {string} fallback Fallback text.
		 * @return {string} Localized text.
		 */
		function get_message( key, fallback ) {
			return config.i18n && config.i18n[ key ] ? config.i18n[ key ] : fallback;
		}

		/**
		 * Replace one `%s` token without interpreting replacement tokens.
		 *
		 * @param {string} message     Message template.
		 * @param {string} replacement Plain-text replacement.
		 * @return {string} Formatted message.
		 */
		function format_message( message, replacement ) {
			return String( message ).replace( '%s', function () {
				return String( replacement );
			} );
		}

		/**
		 * Return a detached JSON-safe copy.
		 *
		 * @param {Object} source Source object.
		 * @return {Object} Detached copy.
		 */
		function clone_resource( source ) {
			return JSON.parse( JSON.stringify( source || {} ) );
		}

		/**
		 * Create one unsaved Resource proposal.
		 *
		 * @return {Object} JSON-safe draft.
		 */
		function create_resource_draft() {
			return {
				draft_id: 'draft-' + Date.now() + '-' + Math.floor( Math.random() * 100000 ),
				title: get_message( 'new_resource', 'New Booking Resource' ),
				description: '',
				picture_url: '',
				base_cost: '0.00'
			};
		}

		/**
		 * Return one details control by stable field name.
		 *
		 * @param {string} field_name Resource DTO field.
		 * @return {HTMLElement|null} Matching control.
		 */
		function get_resource_field( field_name ) {
			return editor ? editor.node.querySelector( '[data-wpbc-resource-field="' + field_name + '"]' ) : null;
		}

		/**
		 * Return the selected new or existing Resource.
		 *
		 * @return {Object|null} Selected Resource or null.
		 */
		function get_selected_resource() {
			if ( ! editor || null === editor.selected_index ) {
				return null;
			}
			if ( 'existing' === editor.selected_type ) {
				return editor.existing_resources[ editor.selected_index ] || null;
			}

			return editor.new_resources[ editor.selected_index ] || null;
		}

		/**
		 * Test whether editable values differ from authorized source values.
		 *
		 * @param {Object} resource Current browser Resource.
		 * @param {Object} baseline Authorized source Resource.
		 * @return {boolean} True when at least one editable field changed.
		 */
		function resource_is_dirty( resource, baseline ) {
			return editable_fields.some( function ( field_name ) {
				return String( resource[ field_name ] || '' ) !== String( baseline[ field_name ] || '' );
			} );
		}

		/**
		 * Build data-only update records for changed existing Resources.
		 *
		 * @return {Array} Existing Resource update payload.
		 */
		function get_existing_updates() {
			return editor.existing_resources.reduce( function ( updates, resource, resource_index ) {
				var baseline = editor.existing_baselines[ resource_index ];
				var update;

				if ( ! baseline || ! resource_is_dirty( resource, baseline ) ) {
					return updates;
				}
				update = {
					resource_id: Number( resource.resource_id || resource.id || 0 ),
					source_fingerprint: String( baseline.source_fingerprint || '' )
				};
				editable_fields.forEach( function ( field_name ) {
					update[ field_name ] = String( resource[ field_name ] || '' );
				} );
				updates.push( update );

				return updates;
			}, [] );
		}

		/**
		 * Write new drafts and changed existing Resources to separate transports.
		 *
		 * @return {void}
		 */
		function sync_transport() {
			if ( ! editor ) {
				return;
			}
			editor.new_transport.value = JSON.stringify( editor.new_resources );
			editor.update_transport.value = JSON.stringify( get_existing_updates() );
		}

		/**
		 * Persist visible detail controls into the selected Resource.
		 *
		 * @return {void}
		 */
		function sync_selected_resource() {
			var resource = get_selected_resource();

			if ( ! resource ) {
				sync_transport();
				return;
			}
			editable_fields.forEach( function ( field_name ) {
				var field = get_resource_field( field_name );
				if ( field && ! field.disabled ) {
					resource[ field_name ] = field.value;
				}
			} );
			sync_transport();
		}

		/**
		 * Update the selected Resource summary and picture preview.
		 *
		 * @return {void}
		 */
		function render_details() {
			var resource = get_selected_resource();
			var fields = editor && editor.node.querySelector( '[data-wpbc-resource-fields]' );
			var empty = editor && editor.node.querySelector( '[data-wpbc-resource-empty]' );
			var title_control = get_resource_field( 'title' );
			var picture_url;
			var image;
			var placeholder;
			var remove_picture;

			if ( fields ) {
				fields.hidden = ! resource;
			}
			if ( empty ) {
				empty.hidden = Boolean( resource );
			}
			if ( ! resource ) {
				return;
			}
			if ( title_control ) {
				title_control.setAttribute(
					'data-wpbc-setup-wizard-error-control-for',
					'existing' === editor.selected_type ? 'existing_booking_resources' : 'booking_resources'
				);
			}

			editable_fields.forEach( function ( field_name ) {
				var field = get_resource_field( field_name );
				if ( field ) {
					field.value = undefined !== resource[ field_name ] ? resource[ field_name ] : '';
				}
			} );

			picture_url = String( resource.picture_url || '' ).trim();
			image = editor.node.querySelector( '[data-wpbc-resource-picture-image]' );
			placeholder = editor.node.querySelector( '[data-wpbc-resource-picture-placeholder]' );
			remove_picture = editor.node.querySelector( '[data-wpbc-remove-resource-picture]' );
			if ( image ) {
				image.hidden = ! picture_url;
				if ( picture_url ) {
					image.src = picture_url;
				} else {
					image.removeAttribute( 'src' );
				}
			}
			if ( placeholder ) {
				placeholder.hidden = Boolean( picture_url );
			}
			if ( remove_picture ) {
				remove_picture.disabled = ! editor.media_upload_available || ! picture_url;
			}
		}

		/**
		 * Expose the existing Resource dirty state through its server-rendered badge.
		 *
		 * @param {HTMLElement} card           Existing Resource card.
		 * @param {number}      resource_index Resource index in the authorized list.
		 * @return {void}
		 */
		function render_existing_card_status( card, resource_index ) {
			var status_badge = card.querySelector( '[data-wpbc-resource-status]' );
			var resource = editor.existing_resources[ resource_index ];
			var baseline = editor.existing_baselines[ resource_index ];
			var is_changed = Boolean( resource && baseline && resource_is_dirty( resource, baseline ) );

			if ( status_badge ) {
				status_badge.textContent = is_changed ? status_badge.dataset.changedLabel : status_badge.dataset.existingLabel;
				status_badge.classList.toggle( 'is-existing', ! is_changed );
				status_badge.classList.toggle( 'is-changed', is_changed );
			}
		}

		/**
		 * Update the server-rendered existing Resource cards.
		 *
		 * @return {void}
		 */
		function render_existing_cards() {
			editor.existing_cards.forEach( function ( card, resource_index ) {
				var resource = editor.existing_resources[ resource_index ];
				var selection = card.querySelector( 'input[type="radio"]' );
				var image = card.querySelector( 'img' );
				var placeholder = card.querySelector( '.wpbc-bi-image-fill' );

				if ( ! resource ) {
					return;
				}
				card.classList.toggle( 'is-selected', 'existing' === editor.selected_type && resource_index === editor.selected_index );
				selection.checked = 'existing' === editor.selected_type && resource_index === editor.selected_index;
				card.querySelector( 'strong' ).textContent = resource.title || get_message( 'new_resource', 'New Booking Resource' );
				render_existing_card_status( card, resource_index );
				if ( resource.picture_url ) {
					image.src = resource.picture_url;
					image.hidden = false;
					placeholder.hidden = true;
				} else {
					image.removeAttribute( 'src' );
					image.hidden = true;
					placeholder.hidden = false;
				}
			} );
		}

		/**
		 * Render new proposal cards and refresh existing card state.
		 *
		 * @return {void}
		 */
		function render_cards() {
			var fragment;

			if ( ! editor || ! editor.new_list || ! editor.template ) {
				return;
			}
			editor.new_list.innerHTML = '';
			fragment = document.createDocumentFragment();
			editor.new_resources.forEach( function ( resource, resource_index ) {
				var card = editor.template.content.firstElementChild.cloneNode( true );
				var selection = card.querySelector( 'input[type="radio"]' );
				var image = card.querySelector( 'img' );
				var placeholder = card.querySelector( '.wpbc-bi-image-fill' );
				var remove_button = card.querySelector( '[data-wpbc-remove-resource]' );

				card.classList.toggle( 'is-selected', 'new' === editor.selected_type && resource_index === editor.selected_index );
				selection.checked = 'new' === editor.selected_type && resource_index === editor.selected_index;
				selection.dataset.wpbcResourceSelection = 'new:' + String( resource_index );
				card.querySelector( 'strong' ).textContent = resource.title || get_message( 'new_resource', 'New Booking Resource' );
				if ( resource.picture_url ) {
					image.src = resource.picture_url;
					image.hidden = false;
					placeholder.hidden = true;
				}
				remove_button.dataset.wpbcRemoveResource = String( resource_index );
				remove_button.setAttribute( 'aria-label', format_message( get_message( 'remove_resource', 'Remove %s' ), resource.title || get_message( 'new_resource', 'New Booking Resource' ) ) );
				fragment.appendChild( card );
			} );
			editor.new_list.appendChild( fragment );
			render_existing_cards();
			sync_transport();
			render_details();
		}

		/**
		 * Select a Resource from a stable `type:index` browser value.
		 *
		 * @param {string} selection_value Browser selection value.
		 * @return {void}
		 */
		function select_resource( selection_value ) {
			var selection_parts = String( selection_value || '' ).split( ':' );
			var selected_type = selection_parts[ 0 ];
			var selected_index = parseInt( selection_parts[ 1 ], 10 );
			var selected_card;
			var selected_control;

			if ( [ 'new', 'existing' ].indexOf( selected_type ) < 0 || isNaN( selected_index ) ) {
				return;
			}
			selected_card = 'existing' === selected_type
				? editor.existing_cards[ selected_index ]
				: editor.new_list.querySelector( '[data-wpbc-resource-selection="new:' + String( selected_index ) + '"]' );
			if ( ! selected_card ) {
				return;
			}
			sync_selected_resource();
			editor.selected_type = selected_type;
			editor.selected_index = selected_index;
			render_cards();
			selected_control = 'existing' === selected_type
				? selected_card.querySelector( 'input[type="radio"]' )
				: editor.new_list.querySelector( '[data-wpbc-resource-selection="new:' + String( selected_index ) + '"]' );
			if ( selected_control ) {
				try {
					selected_control.focus( { preventScroll: true } );
				} catch ( focus_error ) {
					selected_control.focus();
				}
			}
		}

		/**
		 * Handle delegated editor button actions.
		 *
		 * @param {MouseEvent} event Click event.
		 * @return {void}
		 */
		function handle_click( event ) {
			var remove_button = event.target.closest( '[data-wpbc-remove-resource]' );
			var remove_index;
			var focus_target;

			if ( event.target.closest( '[data-wpbc-add-resource]' ) ) {
				if ( ! editor.can_create || editor.new_resources.length >= editor.max_resources ) {
					shell_api.set_field_error( 'booking_resources', get_message( 'resource_limit', 'The Booking Resource limit for this account has been reached.' ) );
					return;
				}
				sync_selected_resource();
				editor.new_resources.push( create_resource_draft() );
				editor.selected_type = 'new';
				editor.selected_index = editor.new_resources.length - 1;
				render_cards();
				shell_api.clear_field_error( 'booking_resources' );
				get_resource_field( 'title' ).focus();
				return;
			}

			if ( remove_button ) {
				remove_index = parseInt( remove_button.dataset.wpbcRemoveResource, 10 );
				if ( ! isNaN( remove_index ) && editor.new_resources[ remove_index ] ) {
					editor.new_resources.splice( remove_index, 1 );
					if ( editor.new_resources.length ) {
						editor.selected_type = 'new';
						editor.selected_index = Math.max( 0, Math.min( editor.selected_index, editor.new_resources.length - 1 ) );
					} else if ( editor.existing_resources.length ) {
						editor.selected_type = 'existing';
						editor.selected_index = 0;
					} else {
						editor.selected_type = null;
						editor.selected_index = null;
					}
					render_cards();
					shell_api.set_status( get_message( 'resource_removed', 'Unsaved Booking Resource removed from this setup.' ) );
					focus_target = editor.new_list.querySelector( 'input[type="radio"]' ) || ( editor.existing_list ? editor.existing_list.querySelector( 'input[type="radio"]' ) : null ) || editor.node.querySelector( '[data-wpbc-add-resource]' );
					if ( focus_target ) {
						focus_target.focus();
					}
				}
				return;
			}

			if ( event.target.closest( '[data-wpbc-remove-resource-picture]' ) && editor.media_upload_available ) {
				var picture_field = get_resource_field( 'picture_url' );
				if ( picture_field ) {
					picture_field.value = '';
					sync_selected_resource();
					render_cards();
				}
			}
		}

		/**
		 * Handle selection and committed field changes.
		 *
		 * @param {Event} event Change event.
		 * @return {void}
		 */
		function handle_change( event ) {
			if ( event.target.matches( '[data-wpbc-resource-selection]' ) ) {
				select_resource( event.target.dataset.wpbcResourceSelection );
				return;
			}
			if ( event.target.matches( '[data-wpbc-resource-field]' ) ) {
				sync_selected_resource();
				render_cards();
				shell_api.clear_field_error( 'booking_resources' );
				shell_api.clear_field_error( 'existing_booking_resources' );
			}
		}

		/**
		 * Handle live text editing without reconstructing the active controls.
		 *
		 * @param {InputEvent} event Input event.
		 * @return {void}
		 */
		function handle_input( event ) {
			var resource;
			var card;

			if ( ! event.target.matches( '[data-wpbc-resource-field]' ) ) {
				return;
			}
			sync_selected_resource();
			resource = get_selected_resource();
			card = 'existing' === editor.selected_type ? editor.existing_cards[ editor.selected_index ] : editor.new_list.children[ editor.selected_index ];
			if ( card && resource ) {
				card.querySelector( 'strong' ).textContent = resource.title || get_message( 'new_resource', 'New Booking Resource' );
				if ( 'existing' === editor.selected_type ) {
					render_existing_card_status( card, editor.selected_index );
				}
			}
			shell_api.clear_field_error( 'booking_resources' );
			shell_api.clear_field_error( 'existing_booking_resources' );
		}

		/**
		 * Refresh after the shared WordPress media picker sets the URL field.
		 *
		 * @return {void}
		 */
		function handle_media_url_set() {
			sync_selected_resource();
			render_cards();
		}

		/**
		 * Parse one JSON array transport without trusting its shape.
		 *
		 * @param {string} encoded_value JSON value.
		 * @return {Array} Decoded array or an empty array.
		 */
		function parse_array( encoded_value ) {
			var parsed_value;

			try {
				parsed_value = JSON.parse( encoded_value || '[]' );
			} catch ( parse_error ) {
				parsed_value = [];
			}

			return Array.isArray( parsed_value ) ? parsed_value : [];
		}

		/**
		 * Initialize this step from the shell and data-only transports.
		 *
		 * @param {Object} registered_shell_api Shared wizard services.
		 * @return {void}
		 */
		function initialize( registered_shell_api ) {
			var editor_node;
			var new_transport;
			var update_transport;
			var existing_source;
			var existing_resources;

			shell_api = registered_shell_api;
			root = shell_api.root;
			editor_node = root.querySelector( '[data-wpbc-booking-resources-editor]' );
			new_transport = root.querySelector( '[data-wpbc-booking-resource-drafts]' );
			update_transport = root.querySelector( '[data-wpbc-existing-resource-updates]' );
			existing_source = root.querySelector( '[data-wpbc-existing-resource-source]' );
			if ( ! editor_node || ! new_transport || ! update_transport || ! existing_source ) {
				return;
			}

			existing_resources = parse_array( existing_source.value );
			editor = {
				node: editor_node,
				new_transport: new_transport,
				update_transport: update_transport,
				new_list: editor_node.querySelector( '[data-wpbc-new-resource-list]' ),
				existing_list: editor_node.querySelector( '[data-wpbc-existing-resource-list]' ),
				existing_cards: Array.prototype.slice.call( editor_node.querySelectorAll( '[data-wpbc-existing-resource-card]' ) ),
				template: root.querySelector( '[data-wpbc-resource-card-template]' ),
				new_resources: parse_array( new_transport.value ),
				existing_resources: existing_resources.map( clone_resource ),
				existing_baselines: existing_resources.map( clone_resource ),
				selected_type: null,
				selected_index: null,
				can_create: 'true' === editor_node.dataset.canCreate,
				pricing_available: 'true' === editor_node.dataset.pricingAvailable,
				media_upload_available: 'true' === editor_node.dataset.mediaUploadAvailable,
				max_resources: parseInt( new_transport.dataset.maxResourceDrafts || '0', 10 )
			};
			if ( editor.new_resources.length ) {
				editor.selected_type = 'new';
				editor.selected_index = 0;
			} else if ( editor.existing_resources.length ) {
				editor.selected_type = 'existing';
				editor.selected_index = 0;
			}
			editor.node.addEventListener( 'click', handle_click );
			editor.node.addEventListener( 'change', handle_change );
			editor.node.addEventListener( 'input', handle_input );
			$( document )
				.off( 'wpbc_media_upload_url_set.wpbcSetupWizardResources', '#wpbc-setup-wizard-resource-picture-url' )
				.on( 'wpbc_media_upload_url_set.wpbcSetupWizardResources', '#wpbc-setup-wizard-resource-picture-url', handle_media_url_set );
			render_cards();
		}

		/**
		 * Validate new drafts and changed existing Resources before navigation.
		 *
		 * @return {HTMLElement|null} First invalid control or null.
		 */
		function validate() {
			var first_invalid = null;

			sync_selected_resource();
			[
				{ type: 'new', resources: editor.new_resources, field_id: 'booking_resources' },
				{ type: 'existing', resources: editor.existing_resources, field_id: 'existing_booking_resources' }
			].some( function ( collection ) {
				return collection.resources.some( function ( resource, resource_index ) {
					var baseline = 'existing' === collection.type ? editor.existing_baselines[ resource_index ] : null;
					var price = Number( resource.base_cost );
					var title_missing = ! String( resource.title || '' ).trim();

					if ( baseline && ! resource_is_dirty( resource, baseline ) ) {
						return false;
					}
					if ( ! title_missing && ( ! editor.pricing_available || ( isFinite( price ) && price >= 0 ) ) ) {
						return false;
					}
					editor.selected_type = collection.type;
					editor.selected_index = resource_index;
					render_cards();
					first_invalid = get_resource_field( title_missing ? 'title' : 'base_cost' );
					shell_api.set_field_error( collection.field_id, title_missing ? get_message( 'resource_title_required', 'Enter a name for every Booking Resource.' ) : get_message( 'resource_price_invalid', 'Enter a valid non-negative base cost.' ) );

					return true;
				} );
			} );

			return first_invalid;
		}

		return {
			initialize: initialize,
			sync: sync_selected_resource,
			validate: validate
		};
	}

	window.wpbc_setup_editor_modules = window.wpbc_setup_editor_modules || {};
	window.wpbc_setup_editor_modules.booking_resources = { create: create_booking_resources_adapter };
	if ( window.wpbc_setup_wizard_api && 'function' === typeof window.wpbc_setup_wizard_api.register_step_adapter ) {
		window.wpbc_setup_wizard_api.register_step_adapter( create_booking_resources_adapter( module_config ) );
	}
}( jQuery, window, document ) );
