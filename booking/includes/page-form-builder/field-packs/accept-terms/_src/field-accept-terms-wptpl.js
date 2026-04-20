/**
 * WPBC BFB: Field Renderer for "accept_terms"
 * =========================================================================
 * Strategy:
 * - Checkbox text: "I accept"
 * - Sentence: "the {terms} and {conditions}"
 * - Link definitions:
 *   - key
 *   - text
 *   - type: url | popup | anchor  ( Popup functionality exists, but not implemented yet in options. It is for future
 * updates.)
 *   - destination
 *
 * File: ../includes/page-form-builder/field-packs/accept-terms/_out/field-accept-terms-wptpl.js
 *
 * @since    11.0.0
 * @modified 2026-04-05
 * @version  1.0.3
 */
(function ( w ) {
	'use strict';

	var core     = w.WPBC_BFB_Core || {};
	var registry = core.WPBC_BFB_Field_Renderer_Registry || null;

	if ( ! registry || 'function' !== typeof registry.register ) {
		if ( w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error ) {
			w._wpbc.dev.error( 'WPBC_BFB_Field_Accept_Terms', 'Registry missing' );
		}
		return;
	}

	class WPBC_BFB_Field_Accept_Terms {

		static template_id = 'wpbc-bfb-field-accept_terms';

		/**
		 * Return field defaults.
		 *
		 * @return {Object}
		 */
		static get_defaults() {
			return {
				type          : 'accept_terms',
				title         : '',
				name          : 'terms',
				html_id       : '',
				required      : true,
				cssclass      : '',
				help          : '',
				checkbox_text : 'I accept',
				sentence      : 'the {terms} and {conditions}',
				links         : clone_value( get_default_links() ),
				min_width     : '260px'
			};
		}

		/**
		 * Normalize a single link definition.
		 *
		 * @param {*} raw_link Raw link object.
		 * @param {number} index Optional index.
		 *
		 * @return {Object}
		 */
		static normalize_link_def( raw_link, index ) {
			return normalize_link_def_item( raw_link, index );
		}

		/**
		 * Normalize links collection.
		 *
		 * @param {*} raw_links Raw links value.
		 * @param {boolean} use_defaults Whether to fallback to default links.
		 *
		 * @return {Array}
		 */
		static normalize_links( raw_links, use_defaults ) {
			return normalize_links_collection( raw_links, use_defaults );
		}

		/**
		 * Normalize field data.
		 *
		 * @param {Object} raw_data Raw field data.
		 *
		 * @return {Object}
		 */
		static normalize_data( raw_data ) {
			var defaults        = this.get_defaults();
			var normalized_data = Object.assign( {}, defaults, raw_data || {} );
			var has_links_prop  = has_own_prop( raw_data, 'links' );

			normalized_data.required      = to_bool( normalized_data.required, defaults.required );
			normalized_data.checkbox_text = String( normalized_data.checkbox_text || defaults.checkbox_text );
			normalized_data.sentence      = String( normalized_data.sentence || defaults.sentence );
			normalized_data.links         = has_links_prop ? this.normalize_links( raw_data.links, false ) : clone_value( get_default_links() );
			normalized_data.sentence_preview_html = this.build_sentence_preview_html(
				normalized_data.sentence,
				normalized_data.links
			);

			return normalized_data;
		}

		/**
		 * Render field preview.
		 *
		 * @param {HTMLElement} el Field element.
		 * @param {Object} raw_data Field data.
		 * @param {Object} ctx Render context.
		 *
		 * @return {void}
		 */
		static render( el, raw_data, ctx ) {
			var template_fn;
			var normalized_data;
			var html = '';

			if ( ! el || ! w.wp || 'function' !== typeof w.wp.template ) {
				return;
			}

			normalized_data = this.normalize_data( raw_data );

			try {
				template_fn = w.wp.template( this.template_id );
			} catch ( err ) {
				if ( w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error ) {
					w._wpbc.dev.error( 'WPBC_BFB_Field_Accept_Terms.template', err );
				}
				return;
			}

			if ( 'function' !== typeof template_fn ) {
				return;
			}

			try {
				html = template_fn( normalized_data );
			} catch ( err2 ) {
				if ( w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error ) {
					w._wpbc.dev.error( 'WPBC_BFB_Field_Accept_Terms.render', err2, normalized_data );
				}
				return;
			}

			el.innerHTML = html;
		}

		/**
		 * Prepare field data after drop/load.
		 *
		 * @param {Object} data Field data.
		 * @param {HTMLElement} el Field element.
		 * @param {Object} meta Context.
		 *
		 * @return {void}
		 */
		static on_field_drop( data, el, meta ) {
			var defaults       = this.get_defaults();
			var has_links_prop = has_own_prop( data, 'links' );

			if ( ! data ) {
				return;
			}

			data.required      = to_bool( data.required, defaults.required );
			data.checkbox_text = String( data.checkbox_text || defaults.checkbox_text );
			data.sentence      = String( data.sentence || defaults.sentence );
			data.links         = has_links_prop ? this.normalize_links( data.links, false ) : clone_value( get_default_links() );

			if ( el ) {
				el.dataset.required = data.required ? '1' : '0';

				try {
					el.dataset.links = JSON.stringify( data.links );

					this.update_structure_prop( el, 'required', data.required );
					this.update_structure_prop( el, 'checkbox_text', data.checkbox_text );
					this.update_structure_prop( el, 'sentence', data.sentence );
					this.update_structure_prop( el, 'links', data.links );

					this.dispatch_field_data_changed( el, 'required', data.required );
					this.dispatch_field_data_changed( el, 'checkbox_text', data.checkbox_text );
					this.dispatch_field_data_changed( el, 'sentence', data.sentence );
					this.dispatch_field_data_changed( el, 'links', data.links );
				} catch ( err ) {
				}
			}
		}

		/**
		 * Build preview HTML from sentence and link tokens.
		 *
		 * @param {string} sentence Sentence with tokens.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {string}
		 */
		static build_sentence_preview_html( sentence, links_arr ) {
			var html            = '';
			var last_index      = 0;
			var token_match;
			var token_regex     = /\{([a-zA-Z0-9_]+)\}/g;
			var token_map       = build_link_map( this.normalize_links( links_arr, false ) );
			var sentence_string = String( sentence || '' );
			var token_key       = '';
			var token_link      = null;

			if ( ! sentence_string ) {
				return '';
			}

			while ( null !== ( token_match = token_regex.exec( sentence_string ) ) ) {
				html += escape_html( sentence_string.substring( last_index, token_match.index ) );

				token_key  = String( token_match[ 1 ] || '' );
				token_link = token_map[ token_key ] || null;

				if ( token_link ) {
					html += this.build_link_preview_html( token_link );
				} else {
					html += '<span class="wpbc_bfb__accept_terms_missing_token">{' + escape_html( token_key ) + '}</span>';
				}

				last_index = token_match.index + token_match[ 0 ].length;
			}

			html += escape_html( sentence_string.substring( last_index ) );

			return html ? ' ' + html : '';
		}

		/**
		 * Build preview HTML for one link definition.
		 *
		 * @param {Object} link_obj Link definition.
		 *
		 * @return {string}
		 */
		static build_link_preview_html( link_obj ) {
			var safe_text  = escape_html( link_obj.text || link_obj.key || '' );
			var safe_class = String( link_obj.cssclass || '' ).trim();
			var class_attr = 'wpbc_bfb__accept_terms_link';

			if ( safe_class ) {
				class_attr += ' ' + escape_attr( safe_class );
			}

			if ( 'popup' === link_obj.link_type ) {
				return '<a href="#" class="' + class_attr + '" data-popup-id="' + escape_attr( link_obj.destination ) + '" onclick="return false;">' + safe_text + '</a>';
			}

			if ( 'anchor' === link_obj.link_type ) {
				return '<a href="' + escape_attr( normalize_anchor_href( link_obj.destination ) ) + '" class="' + class_attr + '" onclick="return false;">' + safe_text + '</a>';
			}

			return '<a href="' + escape_attr( link_obj.destination || '#' ) + '" class="' + class_attr + '" target="' + escape_attr( link_obj.target || '_blank' ) + '"' + ( '_blank' === String( link_obj.target || '' ) ? ' rel="noopener noreferrer"' : '' ) + ' onclick="return false;">' + safe_text + '</a>';
		}

		/**
		 * Return currently selected field element.
		 *
		 * @return {HTMLElement|null}
		 */
		static get_selected_field() {
			return document.querySelector( '.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected' );
		}

		/**
		 * Check if inspector panel belongs to Accept Terms field.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {boolean}
		 */
		static is_accept_terms_panel( panel ) {
			var field_el;
			var field_type = '';

			if ( ! panel ) {
				return false;
			}

			field_el = panel.__accept_terms_field || this.get_selected_field();

			if ( field_el ) {
				field_type = String( field_el.dataset.type || field_el.getAttribute( 'data-type' ) || '' ).toLowerCase();
			}

			if ( 'accept_terms' === field_type ) {
				return true;
			}

			return !! panel.querySelector( '[data-wpbc-bfb-accept-terms-panel="1"]' );
		}

		/**
		 * Get sentence input.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {HTMLElement|null}
		 */
		static get_sentence_input( panel ) {
			return panel ? panel.querySelector( '.inspector__textarea[data-inspector-key="sentence"]' ) : null;
		}

		/**
		 * Get hidden links state input.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {HTMLElement|null}
		 */
		static get_links_state_input( panel ) {
			return panel ? panel.querySelector( '.wpbc_bfb__accept_terms_links_state[data-inspector-key="links"]' ) : null;
		}

		/**
		 * Get links list container.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {HTMLElement|null}
		 */
		static get_links_list( panel ) {
			return panel ? panel.querySelector( '.wpbc_bfb__accept_terms_links_list' ) : null;
		}

		/**
		 * Get available tokens container.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {HTMLElement|null}
		 */
		static get_available_tokens_box( panel ) {
			return panel ? panel.querySelector( '[data-wpbc-bfb-accept-terms-available-tokens="1"]' ) : null;
		}

		/**
		 * Get sentence status container.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {HTMLElement|null}
		 */
		static get_status_box( panel ) {
			return panel ? panel.querySelector( '[data-wpbc-bfb-accept-terms-status="1"]' ) : null;
		}

		/**
		 * Read raw links from selected field dataset.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {string}
		 */
		static get_field_links_raw( panel ) {
			var field_el = panel ? ( panel.__accept_terms_field || this.get_selected_field() ) : null;

			if ( ! field_el ) {
				return '';
			}

			return field_el.getAttribute( 'data-links' ) || field_el.dataset.links || '';
		}

		/**
		 * Sync normalized links JSON into selected field dataset.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {void}
		 */
		static sync_field_links_dataset(panel, links_arr) {
			var field_el   = panel ? (panel.__accept_terms_field || this.get_selected_field()) : null;
			var links_json = '';

			if ( ! field_el ) {
				return;
			}

			try {
				links_json = JSON.stringify( links_arr || array() );

				field_el.dataset.links = links_json;
				field_el.setAttribute( 'data-links', links_json );

				/*
				 * If some builder internals cache field data directly on DOM node,
				 * keep this cache in sync too.
				 */
				if ( field_el.__wpbc_bfb_data && 'object' === typeof field_el.__wpbc_bfb_data ) {
					field_el.__wpbc_bfb_data.links = clone_value( links_arr || array() );
				}
			} catch ( err ) {
			}
		}

		/**
		 * Push links directly into field structure and dataset.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {void}
		 */
		static persist_links_to_field(panel, links_arr) {
			var field_el         = panel ? (panel.__accept_terms_field || this.get_selected_field()) : null;
			var normalized_links = this.normalize_links( links_arr, false );

			if ( ! field_el ) {
				return;
			}

			this.sync_field_links_dataset( panel, normalized_links );

			try {
				this.update_structure_prop( field_el, 'links', normalized_links );
				this.dispatch_field_data_changed( field_el, 'links', normalized_links );

				/*
				 * Keep possible cached field data objects in sync too.
				 */
				if ( field_el.__wpbc_bfb_data && 'object' === typeof field_el.__wpbc_bfb_data ) {
					field_el.__wpbc_bfb_data.links = clone_value( normalized_links );
				}
				if ( field_el._wpbc_bfb_data && 'object' === typeof field_el._wpbc_bfb_data ) {
					field_el._wpbc_bfb_data.links = clone_value( normalized_links );
				}
			} catch ( err ) {
			}
		}

		/**
		 * Read links from hidden state.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {Array}
		 */
		static read_links_from_state(panel) {
			var state_input     = this.get_links_state_input( panel );
			var list_el         = this.get_links_list( panel );
			var raw_links       = '';
			var live_links      = array();
			var is_bootstrapped = this.panel_is_bootstrapped( panel );

			if ( ! panel ) {
				return clone_value( get_default_links() );
			}

			/*
			 * 1. Runtime cache.
			 */
			if ( panel.__accept_terms_links_cache && Array.isArray( panel.__accept_terms_links_cache ) ) {
				return this.normalize_links( panel.__accept_terms_links_cache, false );
			}

			/*
			 * 2. After first bootstrap, LIVE DOM rows are the source of truth.
			 * If list exists and there are no rows, then links are empty.
			 */
			if ( list_el && is_bootstrapped ) {
				live_links = this.get_live_links_from_dom( panel );

				if ( ! live_links.length ) {
					return array();
				}

				return this.normalize_links( live_links, false );
			}

			/*
			 * 3. Hidden state input.
			 */
			if ( state_input && '' !== String( state_input.value || '' ).trim() ) {
				raw_links = state_input.value;
				return this.normalize_links( raw_links, false );
			}

			/*
			 * 4. Field dataset fallback.
			 */
			raw_links = this.get_field_links_raw( panel );
			if ( '' !== String( raw_links || '' ).trim() ) {
				return this.normalize_links( raw_links, false );
			}

			/*
			 * 5. Defaults only on first load.
			 */
			return clone_value( get_default_links() );
		}

		/**
		 * Write links to hidden state.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {void}
		 */
		static write_links_state(panel, links_arr) {
			var state_input      = this.get_links_state_input( panel );
			var normalized_links = this.normalize_links( links_arr, false );
			var links_json       = '[]';

			if ( ! state_input ) {
				return;
			}

			try {
				links_json = JSON.stringify( normalized_links );
			} catch ( err ) {
				links_json = '[]';
			}

			state_input.value        = links_json;
			state_input.defaultValue = links_json;
			state_input.textContent  = links_json;

			panel.__accept_terms_links_cache = clone_value( normalized_links );

			this.persist_links_to_field( panel, normalized_links );
		}

		/**
		 * Render one link row.
		 *
		 * @param {Object} link_obj Link object.
		 * @param {number} index Index.
		 *
		 * @return {string}
		 */
		static render_link_row( link_obj, index ) {
			var template_fn;

			if ( ! w.wp || 'function' !== typeof w.wp.template ) {
				return '';
			}

			template_fn = w.wp.template( 'wpbc-bfb-inspector-accept_terms-link-row' );
			if ( 'function' !== typeof template_fn ) {
				return '';
			}

			return template_fn(
				Object.assign(
					{
						index : index
					},
					this.normalize_link_def( link_obj, index )
				)
			);
		}

		/**
		 * Render link editor rows.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {void}
		 */
		static render_links_editor( panel, links_arr ) {
			var list_el          = this.get_links_list( panel );
			var normalized_links = this.normalize_links( links_arr, false );
			var html = '';
			var i;

			if ( ! list_el ) {
				return;
			}

			for ( i = 0; i < normalized_links.length; i++ ) {
				html += this.render_link_row( normalized_links[ i ], i );
			}

			list_el.innerHTML = html;
		}

		/**
		 * Read one link row from DOM.
		 *
		 * @param {HTMLElement} row_el Row element.
		 * @param {number} index Index.
		 *
		 * @return {Object}
		 */
		static read_link_from_row( row_el, index ) {
			return this.normalize_link_def(
				{
					key         : get_row_value( row_el, '.wpbc_bfb__accept_terms_link_key' ),
					text        : get_row_value( row_el, '.wpbc_bfb__accept_terms_link_text' ),
					link_type   : get_row_value( row_el, '.wpbc_bfb__accept_terms_link_type' ),
					destination : get_row_value( row_el, '.wpbc_bfb__accept_terms_link_destination' ),
					target      : get_row_value( row_el, '.wpbc_bfb__accept_terms_link_target' ),
					cssclass    : get_row_value( row_el, '.wpbc_bfb__accept_terms_link_cssclass' )
				},
				index
			);
		}

		/**
		 * Collect links from rows.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {Array}
		 */
		static collect_links_from_dom( panel ) {
			var list_el   = this.get_links_list( panel );
			var row_list;
			var links_arr = array();
			var i;

			if ( ! list_el ) {
				return array();
			}

			row_list = list_el.querySelectorAll( '.wpbc_bfb__accept_terms_link_row' );

			for ( i = 0; i < row_list.length; i++ ) {
				links_arr.push( this.read_link_from_row( row_list[ i ], i ) );
			}

			return links_arr;
		}

		/**
		 * Refresh state from CURRENT rendered link rows.
		 * This is the key fix for removing stale helper tokens.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {Array}
		 */
		static refresh_from_rendered_rows(panel) {
			var live_links = array();

			if ( ! panel ) {
				return live_links;
			}

			live_links = this.normalize_links( this.get_live_links_from_dom( panel ), false );

			panel.__accept_terms_links_cache = clone_value( live_links );

			this.write_links_state( panel, live_links );
			this.render_available_tokens( panel, live_links );
			this.render_sentence_status( panel, live_links );

			return live_links;
		}

		static schedule_rows_sync(panel) {
			var self = this;

			if ( ! panel ) {
				return;
			}

			if ( panel.__accept_terms_rows_sync_timer ) {
				clearTimeout( panel.__accept_terms_rows_sync_timer );
			}

			panel.__accept_terms_rows_sync_timer = setTimeout(
				function () {
					self.refresh_from_rendered_rows( panel );
				},
				0
			);
		}

		/**
		 * Sync hidden state from DOM.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 *
		 * @return {Array}
		 */
		static sync_state_from_dom( panel ) {
			return this.refresh_from_rendered_rows( panel );
		}

		/**
		 * Render available tokens helper.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {void}
		 */
		static render_available_tokens( panel, links_arr ) {
			var box_el           = this.get_available_tokens_box( panel );
			var normalized_links = this.normalize_links( links_arr, false );
			var html = '';
			var i;

			if ( ! box_el ) {
				return;
			}

			if ( ! normalized_links.length ) {
				box_el.innerHTML = '';
				return;
			}

			for ( i = 0; i < normalized_links.length; i++ ) {
				if ( i > 0 ) {
					html += ' ';
				}
				html += '<button type="button" class="button button-secondary button-small js-insert-token-from-hint" data-token="' + escape_attr( normalized_links[ i ].key ) + '">{' + escape_html( normalized_links[ i ].key ) + '}</button>';
			}

			box_el.innerHTML = html;
		}

		/**
		 * Render sentence token status.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {void}
		 */
		static render_sentence_status( panel, links_arr ) {
			var status_el       = this.get_status_box( panel );
			var sentence_input  = this.get_sentence_input( panel );
			var sentence_value  = sentence_input ? String( sentence_input.value || '' ) : '';
			var sentence_tokens = extract_sentence_tokens( sentence_value );
			var link_map        = build_link_map( this.normalize_links( links_arr, false ) );
			var missing_tokens  = array();
			var i;
			var token_key = '';

			if ( ! status_el ) {
				return;
			}

			for ( i = 0; i < sentence_tokens.length; i++ ) {
				token_key = sentence_tokens[ i ];
				if ( ! link_map[ token_key ] ) {
					missing_tokens.push( token_key );
				}
			}

			if ( missing_tokens.length ) {
				status_el.innerHTML = '<span style="color: #b83d3d;"><strong>Missing link definitions:</strong> ' + missing_tokens.map(
					function ( item_key ) {
						return '{' + escape_html( item_key ) + '}';
					}
				).join( ', ' ) + '</span>';
			} else {
				status_el.innerHTML = sentence_tokens.length ? 'All sentence tokens are defined.' : 'No tokens used in the sentence.';
			}
		}

		/**
		 * Insert token into sentence.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {string} token_key Token key.
		 *
		 * @return {void}
		 */
		static insert_token_into_sentence( panel, token_key ) {
			var sentence_input = this.get_sentence_input( panel );
			var safe_token_key = to_token_key( token_key );
			var token_text     = '';

			if ( ! sentence_input || ! safe_token_key ) {
				return;
			}

			token_text = build_token_insert_text(
				sentence_input,
				'{' + safe_token_key + '}'
			);

			if ( 'number' === typeof sentence_input.selectionStart && 'number' === typeof sentence_input.selectionEnd ) {
				insert_text_at_cursor( sentence_input, token_text );
			} else {
				sentence_input.value += token_text;
			}

			trigger_input_and_change( sentence_input );
			this.render_sentence_status( panel, this.read_links_from_state( panel ) );
		}

		/**
		 * Re-render links editor.
		 * Important: after rows are re-rendered, refresh helper tokens from LIVE rows.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {Array} links_arr Links array.
		 *
		 * @return {Array}
		 */
		static rerender_links_editor(panel, links_arr) {
			var next_links = this.normalize_links( links_arr, false );

			panel.__accept_terms_links_cache = clone_value( next_links );

			this.render_links_editor( panel, next_links );
			this.bind_rows_observer( panel );
			this.refresh_from_rendered_rows( panel );

			return next_links;
		}

		/**
		 * Add link after current index.
		 *
		 * @param {Array} source_arr Links array.
		 * @param {number} target_index Target index.
		 *
		 * @return {Array}
		 */
		static add_link_after( source_arr, target_index ) {
			var result_arr   = source_arr.slice( 0 );
			var insert_index = parseInt( target_index, 10 );

			if ( isNaN( insert_index ) ) {
				insert_index = result_arr.length - 1;
			}

			result_arr.splice( insert_index + 1, 0, build_default_link_def( result_arr.length ) );

			return result_arr;
		}

		/**
		 * Duplicate link.
		 *
		 * @param {Array} source_arr Links array.
		 * @param {number} target_index Target index.
		 *
		 * @return {Array}
		 */
		static duplicate_link( source_arr, target_index ) {
			var result_arr = source_arr.slice( 0 );
			var index_num  = parseInt( target_index, 10 );
			var cloned_link;

			if ( isNaN( index_num ) || ! result_arr[ index_num ] ) {
				return result_arr;
			}

			cloned_link     = clone_value( this.normalize_link_def( result_arr[ index_num ], index_num ) );
			cloned_link.key = '';

			result_arr.splice( index_num + 1, 0, cloned_link );

			return result_arr;
		}

		/**
		 * Remove link.
		 *
		 * @param {Array} source_arr Links array.
		 * @param {number} target_index Target index.
		 *
		 * @return {Array}
		 */
		static remove_link( source_arr, target_index ) {
			var result_arr = source_arr.slice( 0 );
			var index_num  = parseInt( target_index, 10 );

			if ( isNaN( index_num ) || ! result_arr[ index_num ] ) {
				return result_arr;
			}

			result_arr.splice( index_num, 1 );

			return result_arr;
		}

		static bind_rows_observer(panel) {
			var self    = this;
			var list_el = this.get_links_list( panel );

			if ( ! panel || ! list_el || 'undefined' === typeof MutationObserver ) {
				return;
			}

			if ( panel.__accept_terms_rows_observer ) {
				panel.__accept_terms_rows_observer.disconnect();
				panel.__accept_terms_rows_observer = null;
			}

			panel.__accept_terms_rows_observer = new MutationObserver(
				function () {
					self.schedule_live_dom_sync( panel );
				}
			);

			panel.__accept_terms_rows_observer.observe(
				list_el,
				{
					childList: true,
					subtree  : true
				}
			);
		}

		/**
		 * Bootstrap inspector panel.
		 *
		 * @param {HTMLElement} panel Inspector panel.
		 * @param {HTMLElement|null} field_el Field element.
		 *
		 * @return {void}
		 */
		static bootstrap_panel(panel, field_el) {
			var links_arr = array();

			if ( ! panel ) {
				return;
			}

			panel.__accept_terms_field = field_el || panel.__accept_terms_field || this.get_selected_field();

			if ( ! this.is_accept_terms_panel( panel ) ) {
				return;
			}

			/*
			 * First bootstrap:
			 * read saved/default links, render rows, then mark bootstrapped.
			 */
			if ( ! this.panel_is_bootstrapped( panel ) ) {
				links_arr                        = this.read_links_from_state( panel );
				panel.__accept_terms_links_cache = clone_value( links_arr );

				this.render_links_editor( panel, links_arr );
				this.mark_panel_bootstrapped( panel );
				this.bind_rows_observer( panel );
				this.write_links_state( panel, links_arr );
				this.render_available_tokens( panel, links_arr );
				this.render_sentence_status( panel, links_arr );

				return;
			}

			/*
			 * After bootstrap:
			 * live DOM is the source of truth.
			 */
			this.bind_rows_observer( panel );
			this.refresh_from_rendered_rows( panel );
		}

		/**
		 * Update field prop in structure.
		 *
		 * @param {HTMLElement} el Field element.
		 * @param {string} key Key.
		 * @param {*} value Value.
		 *
		 * @return {void}
		 */
		static update_structure_prop( el, key, value ) {
			if ( core && core.Structure && 'function' !== typeof core.Structure.update_field_prop ) {
				return;
			}

			if ( core && core.Structure && 'function' === typeof core.Structure.update_field_prop ) {
				core.Structure.update_field_prop( el, key, value );
			}
		}

		/**
		 * Dispatch field data changed event.
		 *
		 * @param {HTMLElement} el Field element.
		 * @param {string} key Key.
		 * @param {*} value Value.
		 *
		 * @return {void}
		 */
		static dispatch_field_data_changed( el, key, value ) {
			var event_obj;

			if ( ! el || 'function' !== typeof w.CustomEvent ) {
				return;
			}

			event_obj = new CustomEvent(
				'wpbc_bfb_field_data_changed',
				{
					bubbles : true,
					detail  : {
						key   : key,
						value : value
					}
				}
			);

			el.dispatchEvent( event_obj );
		}

		/**
		 * Wire inspector handlers once.
		 *
		 * @return {void}
		 */
		static wire_once_accept_terms() {
			var self           = this;
			var inspector_root = null;
			var on_ready_or_render;

			if ( this.__accept_terms_wired ) {
				return;
			}
			this.__accept_terms_wired = true;

			on_ready_or_render = function ( event_obj ) {
				var panel    = event_obj && event_obj.detail ? event_obj.detail.panel : null;
				var field_el = null;

				if ( event_obj && event_obj.detail ) {
					field_el = event_obj.detail.field || event_obj.detail.el || event_obj.detail.target || null;
				}

				if ( panel ) {
					self.bootstrap_panel( panel, field_el );
				}
			};

			document.addEventListener( 'wpbc_bfb_inspector_ready', on_ready_or_render );
			document.addEventListener( 'wpbc_bfb_inspector_render', on_ready_or_render );

			document.addEventListener( 'mousedown',
				function ( event_obj ) {
					var token_button = event_obj.target ? event_obj.target.closest( '.js-insert-token-from-hint' ) : null;
					var panel        = token_button ? token_button.closest( '.wpbc_bfb__inspector__body' ) : null;
					var token_key    = '';

					if ( ! token_button || ! panel ) {
						return;
					}

					panel.__accept_terms_field = self.get_selected_field();

					if ( ! self.is_accept_terms_panel( panel ) ) {
						return;
					}

					event_obj.preventDefault();
					event_obj.stopPropagation();

					token_key = String( token_button.getAttribute( 'data-token' ) || '' );
					self.insert_token_into_sentence( panel, token_key );
				},
				true
			);

			inspector_root = document.getElementById( 'wpbc_bfb__inspector' );
			if ( ! inspector_root ) {
				return;
			}

			inspector_root.addEventListener( 'click',
				function ( event_obj ) {
					var panel       = event_obj.target ? event_obj.target.closest( '.wpbc_bfb__inspector__body' ) : null;
					var row_el      = null;
					var row_index   = -1;
					var action_name = '';
					var links_arr   = array();

					if ( ! panel ) {
						return;
					}

					panel.__accept_terms_field = self.get_selected_field();

					if ( ! self.is_accept_terms_panel( panel ) ) {
						return;
					}

					if ( event_obj.target.closest( '.js-insert-token-from-hint' ) ) {
						event_obj.preventDefault();
						return;
					}

					if ( event_obj.target.closest( '.js-add-link-definition' ) ) {
						links_arr = self.collect_links_from_dom( panel );
						links_arr = self.add_link_after( links_arr, links_arr.length - 1 );
						self.rerender_links_editor( panel, links_arr );
						return;
					}

					if ( event_obj.target.closest( '.js-link-row-action' ) ) {
						event_obj.preventDefault();

						row_el = event_obj.target.closest( '.wpbc_bfb__accept_terms_link_row' );
						if ( ! row_el ) {
							return;
						}

						row_index   = parseInt( row_el.getAttribute( 'data-index' ) || '-1', 10 );
						action_name = String( event_obj.target.closest( '.js-link-row-action' ).getAttribute( 'data-action' ) || '' );
						links_arr   = self.collect_links_from_dom( panel );

						if ( 'add_after' === action_name ) {
							self.rerender_links_editor( panel, self.add_link_after( links_arr, row_index ) );
							self.schedule_rows_sync( panel );
							return;
						}

						if ( 'duplicate' === action_name ) {
							self.rerender_links_editor( panel, self.duplicate_link( links_arr, row_index ) );
							self.schedule_rows_sync( panel );
							return;
						}

						if ( 'remove' === action_name ) {
							self.rerender_links_editor( panel, self.remove_link( links_arr, row_index ) );
							self.schedule_rows_sync( panel );
							return;
						}
					}
				},
				true
			);

			document.addEventListener(
				'click',
				function (event_obj) {
					var action_el = event_obj.target ? event_obj.target.closest( '.js-link-row-action, .js-add-link-definition' ) : null;
					var panel     = action_el ? action_el.closest( '.wpbc_bfb__inspector__body' ) : null;

					if ( ! action_el || ! panel ) {
						return;
					}

					panel.__accept_terms_field = self.get_selected_field();

					if ( ! self.is_accept_terms_panel( panel ) ) {
						return;
					}

					/*
					 * Run after generic options-editor handlers finish.
					 */
					self.schedule_live_dom_sync( panel );
				},
				true
			);

			inspector_root.addEventListener( 'input',
				function ( event_obj ) {
					var panel        = event_obj.target ? event_obj.target.closest( '.wpbc_bfb__inspector__body' ) : null;
					var links_arr    = array();
					var row_el       = null;
					var token_key_el = null;

					if ( ! panel ) {
						return;
					}

					panel.__accept_terms_field = self.get_selected_field();

					if ( ! self.is_accept_terms_panel( panel ) ) {
						return;
					}

					if ( event_obj.target.matches( '.inspector__textarea[data-inspector-key="sentence"]' ) ) {
						self.render_sentence_status( panel, self.read_links_from_state( panel ) );
						return;
					}

					row_el = event_obj.target.closest( '.wpbc_bfb__accept_terms_link_row' );
					if ( row_el ) {
						token_key_el = row_el.querySelector( '.wpbc_bfb__accept_terms_link_key' );

						if ( token_key_el && event_obj.target === token_key_el ) {
							sanitize_token_key_input( token_key_el );
						}

						links_arr = self.sync_state_from_dom( panel );
						self.render_available_tokens( panel, links_arr );
						self.render_sentence_status( panel, links_arr );
					}
				},
				true
			);

			inspector_root.addEventListener( 'change',
				function ( event_obj ) {
					var panel        = event_obj.target ? event_obj.target.closest( '.wpbc_bfb__inspector__body' ) : null;
					var links_arr    = array();
					var row_el       = null;
					var token_key_el = null;

					if ( ! panel ) {
						return;
					}

					panel.__accept_terms_field = self.get_selected_field();

					if ( ! self.is_accept_terms_panel( panel ) ) {
						return;
					}

					if ( event_obj.target.matches( '.inspector__textarea[data-inspector-key="sentence"]' ) ) {
						self.render_sentence_status( panel, self.read_links_from_state( panel ) );
						return;
					}

					if ( event_obj.target.matches( '.inspector__checkbox[data-inspector-key="required"]' ) ) {
						event_obj.target.setAttribute( 'aria-checked', event_obj.target.checked ? 'true' : 'false' );
						return;
					}

					row_el = event_obj.target.closest( '.wpbc_bfb__accept_terms_link_row' );
					if ( row_el ) {
						token_key_el = row_el.querySelector( '.wpbc_bfb__accept_terms_link_key' );

						if ( token_key_el ) {
							sanitize_token_key_input( token_key_el );
						}

						links_arr = self.collect_links_from_dom( panel );
						self.rerender_links_editor( panel, links_arr );
					}
				},
				true
			);

			document.addEventListener( 'wpbc_bfb_inspector_render',
				function ( event_obj ) {
					var panel    = event_obj && event_obj.detail ? event_obj.detail.panel : null;
					var field_el = event_obj && event_obj.detail ? ( event_obj.detail.field || event_obj.detail.el || null ) : null;

					if ( panel && field_el ) {
						self.bootstrap_panel( panel, field_el );
					}
				}
			);

			setTimeout(
				function () {
					var panel = document.querySelector( '#wpbc_bfb__inspector .wpbc_bfb__inspector__body' );

					if ( panel ) {
						self.bootstrap_panel( panel, self.get_selected_field() );
					}
				},
				0
			);
		}

		static panel_is_bootstrapped(panel) {
			return !! (panel && '1' === String( panel.getAttribute( 'data-wpbc-accept-terms-bootstrapped' ) || '' ));
		}

		static mark_panel_bootstrapped(panel) {
			if ( ! panel ) {
				return;
			}

			panel.setAttribute( 'data-wpbc-accept-terms-bootstrapped', '1' );
		}

		static get_live_links_from_dom(panel) {
			var list_el   = this.get_links_list( panel );
			var row_list  = null;
			var links_arr = array();

			if ( ! list_el ) {
				return links_arr;
			}

			row_list = list_el.querySelectorAll( '.wpbc_bfb__accept_terms_link_row' );

			if ( ! row_list.length ) {
				return links_arr;
			}

			return this.collect_links_from_dom( panel );
		}

		static schedule_live_dom_sync(panel) {
			var self = this;

			if ( ! panel ) {
				return;
			}

			if ( panel.__accept_terms_live_dom_sync_timer ) {
				clearTimeout( panel.__accept_terms_live_dom_sync_timer );
			}

			panel.__accept_terms_live_dom_sync_timer = setTimeout(
				function () {
					self.refresh_from_rendered_rows( panel );
				},
				0
			);
		}
	}

	try {
		registry.register( 'accept_terms', WPBC_BFB_Field_Accept_Terms );
		w.WPBC_BFB_Field_Accept_Terms = WPBC_BFB_Field_Accept_Terms;
		WPBC_BFB_Field_Accept_Terms.wire_once_accept_terms();
	} catch ( err ) {
		if ( w._wpbc && w._wpbc.dev && 'function' === typeof w._wpbc.dev.error ) {
			w._wpbc.dev.error( 'WPBC_BFB_Field_Accept_Terms.register', err );
		}
	}

	function register_accept_terms_booking_form_exporter() {
		var exporter = w.WPBC_BFB_Exporter || null;

		if ( ! exporter || 'function' !== typeof exporter.register ) {
			return;
		}

		if ( 'function' === typeof exporter.has_exporter && exporter.has_exporter( 'accept_terms' ) ) {
			return;
		}

		exporter.register(
			'accept_terms',
			function ( field, emit, extras ) {
				var cfg              = extras && extras.cfg ? extras.cfg : {};
				var ctx              = extras && extras.ctx ? extras.ctx : {};
				var normalized_field = WPBC_BFB_Field_Accept_Terms.normalize_data( field );
				var field_name       = exporter.compute_name( 'accept_terms', normalized_field );
				var field_title      = String( normalized_field.title || '' ).trim();
				var checkbox_text    = String( normalized_field.checkbox_text || 'I accept' ).trim();
				var id_option        = exporter.id_option( normalized_field, ctx );
				var class_options    = exporter.class_options( normalized_field );
				var sentence_html    = build_sentence_export_html( normalized_field.sentence, normalized_field.links );
				var req_mark         = normalized_field.required ? '*' : '';
				var shortcode_body   = '';

				shortcode_body = '[checkbox' + req_mark + ' ' + field_name + id_option + class_options + ' "' + escape_for_shortcode( checkbox_text ) + '"]';

				if ( field_title && false !== cfg.addLabels ) {
					emit( '<l>' + escape_html( field_title ) + req_mark + '</l>' );
					emit( '<br>' );
				}

				emit( '<p class="wpbc_row_inline wpdev-form-control-wrap ">' );
				emit( '<l class="wpbc_inline_checkbox">' + shortcode_body + ( sentence_html ? ' ' + sentence_html : '' ) + '</l>' );
				emit( '</p>' );
			}
		);
	}

	if ( w.WPBC_BFB_Exporter && 'function' === typeof w.WPBC_BFB_Exporter.register ) {
		register_accept_terms_booking_form_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_accept_terms_booking_form_exporter, { once: true } );
	}

	function register_accept_terms_booking_data_exporter() {
		var content_exporter = w.WPBC_BFB_ContentExporter || null;

		if ( ! content_exporter || 'function' !== typeof content_exporter.register ) {
			return;
		}

		if ( 'function' === typeof content_exporter.has_exporter && content_exporter.has_exporter( 'accept_terms' ) ) {
			return;
		}

		content_exporter.register(
			'accept_terms',
			function ( field, emit, extras ) {
				var cfg              = extras && extras.cfg ? extras.cfg : {};
				var exporter         = w.WPBC_BFB_Exporter || null;
				var normalized_field = WPBC_BFB_Field_Accept_Terms.normalize_data( field );
				var field_name       = '';
				var label_text       = '';

				if ( ! exporter || 'function' !== typeof exporter.compute_name ) {
					return;
				}

				field_name = exporter.compute_name( 'accept_terms', normalized_field );
				if ( ! field_name ) {
					return;
				}

				label_text = String( normalized_field.title || '' ).trim();
				if ( ! label_text ) {
					label_text = 'Accept Terms';
				}

				content_exporter.emit_line_bold_field( emit, label_text, field_name, cfg );
			}
		);
	}

	if ( w.WPBC_BFB_ContentExporter && 'function' === typeof w.WPBC_BFB_ContentExporter.register ) {
		register_accept_terms_booking_data_exporter();
	} else {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_accept_terms_booking_data_exporter, { once: true } );
	}

	function array() {
		return [];
	}

	function has_own_prop( source_obj, prop_name ) {
		return !! ( source_obj && Object.prototype.hasOwnProperty.call( source_obj, prop_name ) );
	}

	function to_bool( value, default_value ) {
		if ( undefined === value || null === value || '' === String( value ) ) {
			return !! default_value;
		}
		return ( true === value || 'true' === value || 1 === value || '1' === value );
	}

	function get_default_links() {
		return [
			{
				key         : 'terms',
				text        : 'terms',
				link_type   : 'url',
				destination : 'https://server.com/terms/',
				target      : '_blank',
				cssclass    : ''
			},
			{
				key         : 'conditions',
				text        : 'conditions',
				link_type   : 'url',
				destination : 'https://server.com/conditions/',
				target      : '_blank',
				cssclass    : ''
			}
		];
	}

	function build_default_links_map() {
		var defaults_arr = get_default_links();
		var map_obj      = {};
		var i;

		for ( i = 0; i < defaults_arr.length; i++ ) {
			map_obj[ String( defaults_arr[ i ].key ) ] = clone_value( defaults_arr[ i ] );
		}

		return map_obj;
	}

	function humanize_token_text( token_key ) {
		return String( token_key || '' ).replace( /_/g, ' ' );
	}

	function build_link_def_from_token( token_key ) {
		var defaults_map = build_default_links_map();

		if ( defaults_map[ token_key ] ) {
			return clone_value( defaults_map[ token_key ] );
		}

		return {
			key         : token_key,
			text        : humanize_token_text( token_key ),
			link_type   : 'url',
			destination : '',
			target      : '_blank',
			cssclass    : ''
		};
	}

	function build_default_link_def( index ) {
		var safe_index = ( 'number' === typeof index && index >= 0 ) ? index + 1 : 1;
		return {
			key         : 'link_' + String( safe_index ),
			text        : 'Link ' + String( safe_index ),
			link_type   : 'url',
			destination : '',
			target      : '_blank',
			cssclass    : ''
		};
	}

	function normalize_link_def_item( raw_link, index ) {
		var link_obj      = raw_link && 'object' === typeof raw_link ? raw_link : {};
		var safe_index    = ( 'number' === typeof index && index >= 0 ) ? index : 0;
		var safe_key      = to_token_key( link_obj.key || '' );
		var fallback_text = String( link_obj.text || '' ).trim();

		if ( ! safe_key && fallback_text ) {
			safe_key = to_token_key( fallback_text );
		}

		if ( ! safe_key ) {
			safe_key = 'link_' + String( safe_index + 1 );
		}

		return {
			key         : safe_key,
			text        : fallback_text || humanize_token_text( safe_key ),
			link_type   : normalize_link_type( link_obj.link_type || 'url' ),
			destination : String( link_obj.destination || '' ),
			target      : normalize_target( link_obj.target || '_blank' ),
			cssclass    : String( link_obj.cssclass || '' )
		};
	}

	function normalize_links_collection( raw_links, use_defaults ) {
		var links_arr    = array();
		var parsed_links = raw_links;
		var key;
		var i;

		if ( 'string' === typeof parsed_links ) {
			parsed_links = safe_json_parse( parsed_links, array() );
		}

		if ( Array.isArray( parsed_links ) ) {
			for ( i = 0; i < parsed_links.length; i++ ) {
				links_arr.push( normalize_link_def_item( parsed_links[ i ], i ) );
			}
		} else if ( parsed_links && 'object' === typeof parsed_links ) {
			i = 0;
			for ( key in parsed_links ) {
				if ( Object.prototype.hasOwnProperty.call( parsed_links, key ) ) {
					links_arr.push( normalize_link_def_item( parsed_links[ key ], i ) );
					i++;
				}
			}
		}

		if ( ! links_arr.length && false !== use_defaults ) {
			links_arr = clone_value( get_default_links() );
		}

		return ensure_unique_link_keys( links_arr );
	}

	function clone_value( source_value ) {
		try {
			return JSON.parse( JSON.stringify( source_value ) );
		} catch ( err ) {
			return source_value;
		}
	}

	function safe_json_parse( json_string, fallback_value ) {
		try {
			return JSON.parse( String( json_string || '' ) );
		} catch ( err ) {
			return fallback_value;
		}
	}

	function normalize_target( raw_target ) {
		return '_self' === String( raw_target || '' ) ? '_self' : '_blank';
	}

	function normalize_link_type( raw_type ) {
		var safe_type = String( raw_type || 'url' );
		if ( 'popup' === safe_type || 'anchor' === safe_type ) {
			return safe_type;
		}
		return 'url';
	}

	function to_token_key( raw_value ) {
		var safe_value = String( raw_value || '' ).toLowerCase();

		safe_value = safe_value.replace( /[\s\-]+/g, '_' );
		safe_value = safe_value.replace( /[^a-z0-9_]/g, '' );
		safe_value = safe_value.replace( /_+/g, '_' );
		safe_value = safe_value.replace( /^_+|_+$/g, '' );

		if ( safe_value && /^[0-9]/.test( safe_value ) ) {
			safe_value = 'token_' + safe_value;
		}

		return safe_value;
	}

	function sanitize_token_key_input( input_el ) {
		var safe_value = to_token_key( input_el ? input_el.value : '' );

		if ( ! input_el ) {
			return '';
		}

		if ( input_el.value !== safe_value ) {
			input_el.value = safe_value;
		}

		return safe_value;
	}

	function ensure_unique_link_keys( links_arr ) {
		var used_map   = {};
		var result_arr = [];
		var i;
		var link_obj;
		var base_key   = '';
		var unique_key = '';
		var suffix_num = 2;

		for ( i = 0; i < links_arr.length; i++ ) {
			link_obj   = clone_value( links_arr[ i ] );
			base_key   = to_token_key( link_obj.key || '' ) || 'link_' + String( i + 1 );
			unique_key = base_key;
			suffix_num = 2;

			while ( used_map[ unique_key ] ) {
				unique_key = base_key + '_' + String( suffix_num );
				suffix_num++;
			}

			link_obj.key = unique_key;
			used_map[ unique_key ] = true;
			result_arr.push( link_obj );
		}

		return result_arr;
	}

	function build_link_map( links_arr ) {
		var map_obj = {};
		var i;
		var link_obj;

		for ( i = 0; i < links_arr.length; i++ ) {
			link_obj = links_arr[ i ];
			if ( link_obj && link_obj.key ) {
				map_obj[ String( link_obj.key ) ] = link_obj;
			}
		}

		return map_obj;
	}

	function extract_sentence_tokens( sentence ) {
		var token_regex = /\{([a-zA-Z0-9_]+)\}/g;
		var token_match;
		var tokens_arr = array();
		var token_key  = '';
		var used_map   = {};

		while ( null !== ( token_match = token_regex.exec( String( sentence || '' ) ) ) ) {
			token_key = String( token_match[ 1 ] || '' );
			if ( token_key && ! used_map[ token_key ] ) {
				used_map[ token_key ] = true;
				tokens_arr.push( token_key );
			}
		}

		return tokens_arr;
	}

	function escape_html( value ) {
		var sanitize = core.WPBC_BFB_Sanitize || {};

		if ( 'function' === typeof sanitize.escape_html ) {
			return sanitize.escape_html( String( value || '' ) );
		}

		return String( value || '' )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' );
	}

	function escape_attr( value ) {
		return escape_html( value ).replace( /"/g, '&quot;' );
	}

	function escape_for_shortcode( value ) {
		var sanitize = core.WPBC_BFB_Sanitize || {};

		if ( 'function' === typeof sanitize.escape_for_shortcode ) {
			return sanitize.escape_for_shortcode( String( value || '' ) );
		}

		return String( value || '' ).replace( /"/g, '\\"' );
	}

	function normalize_anchor_href( destination ) {
		var safe_destination = String( destination || '' ).trim();

		if ( ! safe_destination ) {
			return '#';
		}

		if ( '#' === safe_destination.charAt( 0 ) ) {
			return safe_destination;
		}

		return '#' + safe_destination;
	}

	function build_sentence_export_html( sentence, links_arr ) {
		var html            = '';
		var last_index      = 0;
		var token_regex     = /\{([a-zA-Z0-9_]+)\}/g;
		var token_match;
		var token_map       = build_link_map( normalize_links_collection( links_arr, false ) );
		var sentence_string = String( sentence || '' );
		var token_key = '';
		var link_obj  = null;

		while ( null !== ( token_match = token_regex.exec( sentence_string ) ) ) {
			html += escape_html( sentence_string.substring( last_index, token_match.index ) );

			token_key = String( token_match[ 1 ] || '' );
			link_obj  = token_map[ token_key ] || null;

			if ( link_obj ) {
				html += build_export_link_html( link_obj );
			} else {
				html += '{' + escape_html( token_key ) + '}';
			}

			last_index = token_match.index + token_match[ 0 ].length;
		}

		html += escape_html( sentence_string.substring( last_index ) );

		return html;
	}

	function build_export_link_html( link_obj ) {
		var safe_text  = escape_html( link_obj.text || link_obj.key || '' );
		var safe_class = String( link_obj.cssclass || '' ).trim();
		var html       = '';

		if ( 'popup' === link_obj.link_type ) {
			html = '<a href="#"';
			if ( safe_class ) {
				html += ' class="' + escape_attr( safe_class ) + '"';
			}
			if ( String( link_obj.destination || '' ).trim() ) {
				html += ' data-popup-id="' + escape_attr( link_obj.destination ) + '"';
			}
			html += '>' + safe_text + '</a>';
			return html;
		}

		if ( 'anchor' === link_obj.link_type ) {
			html = '<a href="' + escape_attr( normalize_anchor_href( link_obj.destination ) ) + '"';
			if ( safe_class ) {
				html += ' class="' + escape_attr( safe_class ) + '"';
			}
			html += '>' + safe_text + '</a>';
			return html;
		}

		html = '<a href="' + escape_attr( link_obj.destination || '#' ) + '"';
		if ( safe_class ) {
			html += ' class="' + escape_attr( safe_class ) + '"';
		}
		if ( String( link_obj.target || '' ).trim() ) {
			html += ' target="' + escape_attr( link_obj.target ) + '"';
		}
		if ( '_blank' === String( link_obj.target || '' ) ) {
			html += ' rel="noopener noreferrer"';
		}
		html += '>' + safe_text + '</a>';

		return html;
	}

	function trigger_input_and_change( input_el ) {
		try {
			input_el.dispatchEvent( new Event( 'input', { bubbles: true } ) );
			input_el.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		} catch ( err ) {
		}
	}

	function get_row_value( row_el, selector ) {
		var field_el = row_el ? row_el.querySelector( selector ) : null;
		return field_el ? String( field_el.value || '' ) : '';
	}

	function build_token_insert_text( input_el, token_text ) {
		var current_value = String( input_el && input_el.value ? input_el.value : '' );
		var start_pos     = ( input_el && 'number' === typeof input_el.selectionStart ) ? input_el.selectionStart : current_value.length;
		var end_pos       = ( input_el && 'number' === typeof input_el.selectionEnd ) ? input_el.selectionEnd : current_value.length;
		var before_char   = start_pos > 0 ? current_value.charAt( start_pos - 1 ) : '';
		var after_char    = end_pos < current_value.length ? current_value.charAt( end_pos ) : '';
		var prefix        = '';
		var suffix        = ' ';

		if ( before_char && ! /\s/.test( before_char ) ) {
			prefix = ' ';
		}

		if ( after_char && /\s/.test( after_char ) ) {
			suffix = '';
		}

		return prefix + token_text + suffix;
	}

	function insert_text_at_cursor( input_el, insert_text ) {
		var start_pos   = input_el.selectionStart;
		var end_pos     = input_el.selectionEnd;
		var before_text = String( input_el.value || '' ).substring( 0, start_pos );
		var after_text  = String( input_el.value || '' ).substring( end_pos );

		input_el.value = before_text + insert_text + after_text;
		input_el.selectionStart = input_el.selectionEnd = start_pos + insert_text.length;
		input_el.focus();
	}
})( window );