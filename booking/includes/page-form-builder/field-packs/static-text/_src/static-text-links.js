/**
 * WPBC BFB Static Text link-token editor and renderer helpers.
 *
 * @since 11.8.5
 */
(function ( w, d ) {
	'use strict';

	var core = w.WPBC_BFB_Core || {};
	var boot = w.WPBC_BFB_Static_Text_Links_Boot || {};

	/**
	 * Return an empty array without relying on an Array constructor alias.
	 *
	 * @return {Array} Empty array.
	 */
	function array() {
		return [];
	}

	/**
	 * Return a localized editor string with a deterministic fallback.
	 *
	 * @param {string} key      Localization key.
	 * @param {string} fallback English fallback.
	 *
	 * @return {string} Localized or fallback string.
	 */
	function get_text( key, fallback ) {
		return String( boot[ key ] || fallback || '' );
	}

	/**
	 * Escape text for HTML content.
	 *
	 * @param {*} raw_value Candidate value.
	 *
	 * @return {string} HTML-safe text.
	 */
	function escape_html( raw_value ) {
		var sanitize = core.WPBC_BFB_Sanitize || {};

		if ( 'function' === typeof sanitize.escape_html ) {
			return sanitize.escape_html( String( raw_value || '' ) );
		}

		return String( raw_value || '' )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	/**
	 * Escape text for an HTML attribute.
	 *
	 * @param {*} raw_value Candidate value.
	 *
	 * @return {string} Attribute-safe text.
	 */
	function escape_attr( raw_value ) {
		return escape_html( raw_value );
	}

	/**
	 * Clone JSON-safe field data.
	 *
	 * @param {*} source_value Candidate value.
	 *
	 * @return {*} Cloned value, or the original value when cloning fails.
	 */
	function clone_value( source_value ) {
		try {
			return JSON.parse( JSON.stringify( source_value ) );
		} catch ( err ) {
			return source_value;
		}
	}

	/**
	 * Convert a candidate token key to the supported brace-token grammar.
	 *
	 * @param {*} raw_value Candidate token key.
	 *
	 * @return {string} Normalized token key.
	 */
	function normalize_token_key( raw_value ) {
		var safe_value = String( raw_value || '' ).toLowerCase().slice( 0, 64 );

		safe_value = safe_value.replace( /[\s\-]+/g, '_' );
		safe_value = safe_value.replace( /[^a-z0-9_]/g, '' );
		safe_value = safe_value.replace( /_+/g, '_' );

		return safe_value.replace( /^_+|_+$/g, '' );
	}

	/**
	 * Normalize a link type to an editor-supported value.
	 *
	 * @param {*} raw_type Candidate link type.
	 *
	 * @return {string} `url` or `anchor`.
	 */
	function normalize_link_type( raw_type ) {
		return 'anchor' === String( raw_type || '' ) ? 'anchor' : 'url';
	}

	/**
	 * Normalize a link target to an allow-listed value.
	 *
	 * @param {*} raw_target Candidate target.
	 *
	 * @return {string} `_self` or `_blank`.
	 */
	function normalize_target( raw_target ) {
		return '_self' === String( raw_target || '' ) ? '_self' : '_blank';
	}

	/**
	 * Normalize a space-delimited CSS class list.
	 *
	 * @param {*} raw_classes Candidate class list.
	 *
	 * @return {string} Sanitized class list.
	 */
	function normalize_css_classes( raw_classes ) {
		var sanitize = core.WPBC_BFB_Sanitize || {};
		var classes  = String( raw_classes || '' ).slice( 0, 200 );

		if ( 'function' === typeof sanitize.sanitize_css_classlist ) {
			return sanitize.sanitize_css_classlist( classes );
		}

		return classes
			.split( /\s+/ )
			.map(
				function ( class_name ) {
					return class_name.replace( /[^A-Za-z0-9_-]/g, '' );
				}
			)
			.filter( Boolean )
			.join( ' ' );
	}

	/**
	 * Normalize one URL or anchor destination for safe browser rendering.
	 *
	 * WordPress performs the authoritative save-time URL filtering. This client
	 * check prevents executable schemes from entering Builder preview markup.
	 *
	 * @param {*}      raw_destination Candidate destination.
	 * @param {string} link_type       Normalized link type.
	 *
	 * @return {string} Safe destination, or an empty string when rejected.
	 */
	function normalize_destination( raw_destination, link_type ) {
		var destination = String( raw_destination || '' ).trim().slice( 0, 2048 );
		var compact_url;
		var scheme_match;
		var allowed_schemes = {
			http   : true,
			https  : true,
			mailto : true,
			tel    : true,
			ftp    : true,
			ftps   : true
		};

		if ( 'anchor' === link_type ) {
			return destination
				.replace( /^#+/, '' )
				.replace( /[^A-Za-z0-9_:\-.]/g, '' );
		}

		compact_url = destination.replace( /[\x00-\x20\x7f]+/g, '' );
		scheme_match = compact_url.match( /^([a-z][a-z0-9+.-]*):/i );

		if ( scheme_match && ! allowed_schemes[ String( scheme_match[ 1 ] || '' ).toLowerCase() ] ) {
			return '';
		}

		return destination;
	}

	/**
	 * Normalize one executable-free link definition.
	 *
	 * @param {*}      raw_link Candidate definition.
	 * @param {number} index    Zero-based fallback index.
	 *
	 * @return {Object} Normalized definition.
	 */
	function normalize_link( raw_link, index ) {
		var link_obj     = raw_link && 'object' === typeof raw_link ? raw_link : {};
		var fallback_key = 'link_' + String( index + 1 );
		var token_key    = normalize_token_key( link_obj.key || '' ) || fallback_key;
		var link_type    = normalize_link_type( link_obj.link_type );
		var visible_text = String( link_obj.text || '' ).trim().slice( 0, 300 );

		return {
			key         : token_key,
			text        : visible_text || token_key.replace( /_/g, ' ' ),
			link_type   : link_type,
			destination : normalize_destination( link_obj.destination, link_type ),
			target      : normalize_target( link_obj.target ),
			cssclass    : normalize_css_classes( link_obj.cssclass )
		};
	}

	/**
	 * Normalize an ordered link collection and make token keys unique.
	 *
	 * @param {*} raw_links Candidate array or JSON string.
	 *
	 * @return {Array} Normalized ordered definitions.
	 */
	function normalize_links( raw_links ) {
		var parsed_links = raw_links;
		var links        = array();
		var used_keys    = {};
		var index;

		if ( 'string' === typeof parsed_links ) {
			try {
				parsed_links = JSON.parse( parsed_links );
			} catch ( err ) {
				parsed_links = array();
			}
		}

		if ( ! Array.isArray( parsed_links ) ) {
			return links;
		}

		for ( index = 0; index < parsed_links.length && index < 20; index++ ) {
			var normalized_link = normalize_link( parsed_links[ index ], index );
			var base_key        = normalized_link.key;
			var key_suffix      = 2;

			while ( used_keys[ normalized_link.key ] ) {
				normalized_link.key = base_key.slice( 0, 60 ) + '_' + String( key_suffix );
				key_suffix++;
			}

			used_keys[ normalized_link.key ] = true;
			links.push( normalized_link );
		}

		return links;
	}

	/**
	 * Extract unique brace tokens from Static Text content.
	 *
	 * @param {*} raw_text Candidate content.
	 *
	 * @return {Array} Unique token keys in source order.
	 */
	function extract_tokens( raw_text ) {
		var token_regex = /\{([a-zA-Z0-9_]+)\}/g;
		var token_match;
		var tokens    = array();
		var used_keys = {};

		while ( null !== ( token_match = token_regex.exec( String( raw_text || '' ) ) ) ) {
			var token_key = normalize_token_key( token_match[ 1 ] );
			if ( token_key && ! used_keys[ token_key ] ) {
				used_keys[ token_key ] = true;
				tokens.push( token_key );
			}
		}

		return tokens;
	}

	/**
	 * Build a key-indexed link map.
	 *
	 * @param {Array} links Normalized definitions.
	 *
	 * @return {Object} Definition map.
	 */
	function build_link_map( links ) {
		var link_map = {};
		var index;

		for ( index = 0; index < links.length; index++ ) {
			link_map[ links[ index ].key ] = links[ index ];
		}

		return link_map;
	}

	/**
	 * Build one escaped link for Builder preview or exported form markup.
	 *
	 * @param {Object}  link_obj   Normalized link definition.
	 * @param {boolean} preview_only Whether clicks must be disabled in Builder.
	 *
	 * @return {string} Escaped anchor HTML.
	 */
	function build_link_html( link_obj, preview_only ) {
		var visible_text = escape_html( link_obj.text || link_obj.key || '' );
		var classes      = 'wpbc_bfb__static_text_link';
		var destination  = normalize_destination( link_obj.destination, link_obj.link_type );
		var html;

		if ( link_obj.cssclass ) {
			classes += ' ' + normalize_css_classes( link_obj.cssclass );
		}

		if ( 'anchor' === link_obj.link_type ) {
			destination = destination ? '#' + destination : '#';
		} else if ( ! destination ) {
			destination = '#';
		}

		if ( preview_only ) {
			html = '<a class="' + escape_attr( classes ) + '" aria-disabled="true" tabindex="-1"';
		} else {
			html = '<a href="' + escape_attr( destination ) + '" class="' + escape_attr( classes ) + '"';
		}

		if ( ! preview_only && 'url' === link_obj.link_type ) {
			html += ' target="' + escape_attr( normalize_target( link_obj.target ) ) + '"';
			if ( '_blank' === normalize_target( link_obj.target ) ) {
				html += ' rel="noopener noreferrer"';
			}
		}

		return html + '>' + visible_text + '</a>';
	}

	/**
	 * Render Static Text content with link-token replacements.
	 *
	 * @param {*}       raw_text     Static Text content.
	 * @param {*}       raw_links    Link definitions.
	 * @param {Object}  options      Rendering options.
	 * @param {boolean} options.allow_html Preserve legacy basic-HTML behavior.
	 * @param {boolean} options.nl2br Convert new lines when HTML is not allowed.
	 * @param {boolean} options.preview_only Disable link clicks in Builder.
	 *
	 * @return {string} Rendered HTML with escaped links and text.
	 */
	function build_content_html( raw_text, raw_links, options ) {
		var settings      = options || {};
		var source_text   = String( raw_text || '' );
		var normalized    = normalize_links( raw_links );
		var link_map      = build_link_map( normalized );
		var token_regex   = /\{([a-zA-Z0-9_]+)\}/g;
		var token_match;
		var last_index    = 0;
		var rendered_html = '';

		/**
		 * Render one non-token source segment with the field's legacy text rules.
		 *
		 * @param {string} text_segment Source segment.
		 *
		 * @return {string} Rendered segment.
		 */
		function render_text_segment( text_segment ) {
			var rendered_segment = settings.allow_html ? text_segment : escape_html( text_segment );

			if ( ! settings.allow_html && settings.nl2br ) {
				rendered_segment = rendered_segment.replace( /\n/g, '<br>' );
			}

			return rendered_segment;
		}

		while ( null !== ( token_match = token_regex.exec( source_text ) ) ) {
			var token_key = normalize_token_key( token_match[ 1 ] );

			rendered_html += render_text_segment( source_text.substring( last_index, token_match.index ) );
			if ( token_key && link_map[ token_key ] ) {
				rendered_html += build_link_html( link_map[ token_key ], !! settings.preview_only );
			} else {
				rendered_html += render_text_segment( token_match[ 0 ] );
			}
			last_index = token_match.index + token_match[ 0 ].length;
		}

		rendered_html += render_text_segment( source_text.substring( last_index ) );

		return rendered_html;
	}

	/**
	 * Create a DOM element using textContent for visible text.
	 *
	 * @param {string} tag_name Element name.
	 * @param {Object} attrs    Attribute map.
	 * @param {string} text     Optional text.
	 *
	 * @return {HTMLElement} Created element.
	 */
	function create_element( tag_name, attrs, text ) {
		var element = d.createElement( tag_name );
		var attr_name;

		for ( attr_name in ( attrs || {} ) ) {
			if ( Object.prototype.hasOwnProperty.call( attrs, attr_name ) ) {
				element.setAttribute( attr_name, attrs[ attr_name ] );
			}
		}

		if ( undefined !== text ) {
			element.textContent = text;
		}

		return element;
	}

	/**
	 * Dispatch an Inspector input event after the hidden JSON writer changes.
	 *
	 * @param {HTMLElement} writer Hidden Inspector writer.
	 *
	 * @return {void}
	 */
	function dispatch_writer_input( writer ) {
		var input_event;

		try {
			input_event = new w.Event( 'input', { bubbles: true } );
		} catch ( err ) {
			input_event = d.createEvent( 'Event' );
			input_event.initEvent( 'input', true, false );
		}

		writer.dispatchEvent( input_event );
	}

	/**
	 * Insert a token at the current cursor position in the Static Text input.
	 *
	 * @param {HTMLTextAreaElement} text_input Static Text control.
	 * @param {string}              token_key  Normalized token key.
	 *
	 * @return {void}
	 */
	function insert_token_at_cursor( text_input, token_key ) {
		var token_text = '{' + token_key + '}';
		var start      = Number.isInteger( text_input.selectionStart ) ? text_input.selectionStart : text_input.value.length;
		var end        = Number.isInteger( text_input.selectionEnd ) ? text_input.selectionEnd : start;

		text_input.value = text_input.value.substring( 0, start ) + token_text + text_input.value.substring( end );
		text_input.focus();
		text_input.setSelectionRange( start + token_text.length, start + token_text.length );
		dispatch_writer_input( text_input );
	}

	/**
	 * Render the Static Text link-definition Factory slot.
	 *
	 * @param {HTMLElement} slot_host Inspector slot host.
	 * @param {Object}      context   Inspector context with selected field data.
	 *
	 * @return {void}
	 */
	function render_editor_slot( slot_host, context ) {
		var field_data  = context && context.data ? context.data : {};
		var links       = normalize_links( field_data.links );
		var editor      = create_element( 'div', { 'class': 'wpbc_bfb__static_text_links_editor' } );
		var token_list  = create_element( 'div', { 'class': 'wpbc_bfb__static_text_link_tokens' } );
		var help        = create_element( 'p', { 'class': 'wpbc_bfb__help' }, get_text( 'links_help', 'Use tokens inside braces, for example: {terms} or {privacy_policy}.' ) );
		var status      = create_element( 'p', { 'class': 'wpbc_bfb__help wpbc_bfb__static_text_link_status', 'aria-live': 'polite' } );
		var rows_list   = create_element( 'div', { 'class': 'wpbc_bfb__static_text_links_list' } );
		var add_button  = create_element( 'button', { 'type': 'button', 'class': 'button button-secondary' }, get_text( 'add_link', 'Add link' ) );
		var toolbar     = create_element( 'div', { 'class': 'wpbc_bfb__static_text_links_toolbar' } );
		var writer      = create_element( 'textarea', { 'class': 'inspector__input', 'data-inspector-key': 'links', 'hidden': 'hidden' } );
		var panel       = slot_host.closest( '#wpbc_bfb__inspector' ) || slot_host.closest( '.wpbc_bfb__inspector' );
		var text_input  = panel ? panel.querySelector( 'textarea[data-inspector-key="text"]' ) : null;

		writer.value = JSON.stringify( links );
		toolbar.appendChild( add_button );
		editor.appendChild( token_list );
		editor.appendChild( help );
		editor.appendChild( status );
		editor.appendChild( rows_list );
		editor.appendChild( toolbar );
		editor.appendChild( writer );
		slot_host.appendChild( editor );

		/**
		 * Persist normalized editor state through the standard Inspector writer.
		 *
		 * @return {void}
		 */
		function commit_links() {
			links        = normalize_links( links );
			writer.value = JSON.stringify( links );
			dispatch_writer_input( writer );
			render_tokens_and_status();
		}

		/**
		 * Return missing token definitions for the current Static Text content.
		 *
		 * @return {Array} Missing token keys.
		 */
		function get_missing_tokens() {
			var source_tokens = extract_tokens( text_input ? text_input.value : '' );
			var link_map      = build_link_map( normalize_links( links ) );

			return source_tokens.filter(
				function ( token_key ) {
					return ! link_map[ token_key ];
				}
			);
		}

		/**
		 * Render token insertion buttons and current validation guidance.
		 *
		 * @return {void}
		 */
		function render_tokens_and_status() {
			var normalized_links = normalize_links( links );
			var missing_tokens   = get_missing_tokens();

			token_list.textContent = '';
			normalized_links.forEach(
				function ( link_obj ) {
					var token_button = create_element(
						'button',
						{ 'type': 'button', 'class': 'button button-secondary button-small' },
						'{' + link_obj.key + '}'
					);

					token_button.addEventListener(
						'click',
						function () {
							if ( text_input ) {
								insert_token_at_cursor( text_input, link_obj.key );
							}
						}
					);
					token_list.appendChild( token_button );
				}
			);

			if ( missing_tokens.length ) {
				status.textContent = get_text( 'missing_definitions', 'Add a link definition for: %s' ).replace( '%s', missing_tokens.map( function ( key ) { return '{' + key + '}'; } ).join( ', ' ) );
			} else if ( ! normalized_links.length ) {
				status.textContent = get_text( 'no_links', 'Add a link definition, then insert its token into the text.' );
			} else {
				status.textContent = '';
			}
		}

		/**
		 * Build one labeled link-definition control.
		 *
		 * @param {string}      label_text Control label.
		 * @param {HTMLElement} control    Form control.
		 *
		 * @return {HTMLElement} Control wrapper.
		 */
		function build_labeled_control( label_text, control ) {
			var wrapper = create_element( 'label', { 'class': 'wpbc_bfb__static_text_link_control' } );
			wrapper.appendChild( create_element( 'span', { 'class': 'wpbc_bfb__static_text_link_label' }, label_text ) );
			wrapper.appendChild( control );
			return wrapper;
		}

		/**
		 * Render every editable definition row from current state.
		 *
		 * @return {void}
		 */
		function render_rows() {
			links = normalize_links( links );
			rows_list.textContent = '';

			links.forEach(
				function ( link_obj, row_index ) {
					var row              = create_element( 'div', { 'class': 'wpbc_bfb__static_text_link_row' } );
					var key_input        = create_element( 'input', { 'type': 'text', 'maxlength': '64', 'value': link_obj.key } );
					var text_control     = create_element( 'input', { 'type': 'text', 'maxlength': '300', 'value': link_obj.text } );
					var type_select      = create_element( 'select' );
					var destination_input = create_element( 'input', { 'type': 'text', 'maxlength': '2048', 'value': link_obj.destination } );
					var target_select    = create_element( 'select' );
					var css_input        = create_element( 'input', { 'type': 'text', 'maxlength': '200', 'value': link_obj.cssclass } );
					var actions          = create_element( 'div', { 'class': 'wpbc_bfb__static_text_link_actions' } );
					var duplicate_button = create_element( 'button', { 'type': 'button', 'class': 'button button-secondary button-small' }, get_text( 'duplicate', 'Duplicate' ) );
					var remove_button    = create_element( 'button', { 'type': 'button', 'class': 'button button-link-delete button-small' }, get_text( 'remove', 'Remove' ) );

					type_select.appendChild( create_element( 'option', { 'value': 'url' }, get_text( 'url', 'URL' ) ) );
					type_select.appendChild( create_element( 'option', { 'value': 'anchor' }, get_text( 'anchor', 'Anchor' ) ) );
					type_select.value = link_obj.link_type;

					target_select.appendChild( create_element( 'option', { 'value': '_self' }, '_self' ) );
					target_select.appendChild( create_element( 'option', { 'value': '_blank' }, '_blank' ) );
					target_select.value    = link_obj.target;
					target_select.disabled = 'anchor' === link_obj.link_type;

					key_input.addEventListener( 'input', function () {
						key_input.value      = normalize_token_key( key_input.value );
						links[ row_index ].key = key_input.value || 'link_' + String( row_index + 1 );
						commit_links();
					} );
					text_control.addEventListener( 'input', function () {
						links[ row_index ].text = text_control.value;
						commit_links();
					} );
					type_select.addEventListener( 'change', function () {
						links[ row_index ].link_type = normalize_link_type( type_select.value );
						target_select.disabled       = 'anchor' === links[ row_index ].link_type;
						commit_links();
					} );
					destination_input.addEventListener( 'input', function () {
						links[ row_index ].destination = destination_input.value;
						commit_links();
					} );
					target_select.addEventListener( 'change', function () {
						links[ row_index ].target = normalize_target( target_select.value );
						commit_links();
					} );
					css_input.addEventListener( 'input', function () {
						links[ row_index ].cssclass = css_input.value;
						commit_links();
					} );
					duplicate_button.addEventListener( 'click', function () {
						links.splice( row_index + 1, 0, clone_value( links[ row_index ] ) );
						links = normalize_links( links );
						render_rows();
						commit_links();
					} );
					remove_button.addEventListener( 'click', function () {
						links.splice( row_index, 1 );
						render_rows();
						commit_links();
					} );

					row.appendChild( build_labeled_control( get_text( 'token_key', 'Token Key' ), key_input ) );
					row.appendChild( build_labeled_control( get_text( 'visible_text', 'Text' ), text_control ) );
					row.appendChild( build_labeled_control( get_text( 'link_type', 'Type' ), type_select ) );
					row.appendChild( build_labeled_control( get_text( 'destination', 'Destination' ), destination_input ) );
					row.appendChild( build_labeled_control( get_text( 'target', 'Target' ), target_select ) );
					row.appendChild( build_labeled_control( get_text( 'css_class', 'CSS class' ), css_input ) );
					actions.appendChild( duplicate_button );
					actions.appendChild( remove_button );
					row.appendChild( actions );
					rows_list.appendChild( row );
				}
			);
		}

		add_button.addEventListener(
			'click',
			function () {
				var missing_tokens = get_missing_tokens();
				var next_key       = missing_tokens.length ? missing_tokens[ 0 ] : 'link_' + String( links.length + 1 );

				links.push(
					{
						key         : next_key,
						text        : next_key.replace( /_/g, ' ' ),
						link_type   : 'url',
						destination : '',
						target      : '_blank',
						cssclass    : ''
					}
				);
				render_rows();
				commit_links();
			}
		);

		if ( text_input ) {
			text_input.addEventListener( 'input', render_tokens_and_status );
		}

		render_rows();
		render_tokens_and_status();
	}

	/**
	 * Register the Static Text link editor with the Inspector Factory.
	 *
	 * @return {void}
	 */
	function register_editor_slot() {
		w.wpbc_bfb_inspector_factory_slots = w.wpbc_bfb_inspector_factory_slots || {};
		w.wpbc_bfb_inspector_factory_slots.static_text_links = render_editor_slot;
	}

	w.WPBC_BFB_Static_Text_Links = {
		build_content_html    : build_content_html,
		extract_tokens        : extract_tokens,
		normalize_destination : normalize_destination,
		normalize_links       : normalize_links,
		normalize_token_key   : normalize_token_key,
		register_editor_slot  : register_editor_slot
	};

	register_editor_slot();

})( window, document );
