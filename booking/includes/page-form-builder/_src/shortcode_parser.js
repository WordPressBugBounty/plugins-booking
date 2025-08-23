/**
 * WPBC_Form_Shortcode_Parser
 * ES6 class that mirrors WP Booking Calendar's PHP parsing & rendering logic.
 *
 * Usage:
 *   const parser = new WPBC_Form_Shortcode_Parser({
 *     current_booking_type: '4',
 *     countries_list: { US: 'United States', FR: 'France', ... },
 *     current_edit_booking: { parsed_form: { email4: { value:'a@b.com' }, checkbox4: { value:'Yes,No' } } },
 *     posted_data: { email4: 'x@y.com' }   // optional: emulate $_POST re-render
 *   });
 *
 *   // Replace shortcodes with HTML:
 *   const html = parser.form_elements(formString, true);
 *
 *   // Or only parse elements (no replacement):
 *   const elements = parser.form_elements(formString, false);
 *
 *   // Parse "~" + "^" stored form string like get_booking_data():
 *   const parsed_form = parser.parse_booking_form_string(savedFormStr, bookingTypeIdString);
 */
class WPBC_Form_Shortcode_Parser {
	constructor(opts = {}) {
		this.current_booking_type = String( opts.current_booking_type ?? '' );
		this.countries_list       = opts.countries_list || {};
		this.current_edit_booking = opts.current_edit_booking || null;
		this.processing_unit_tag  = opts.processing_unit_tag || null;
		this.posted_data          = opts.posted_data || {}; // emulate $_POST for re-render / validation
	}

	// ----------------------------- utils

	esc_attr(v) {
		if ( v == null ) return '';
		return String( v )
			.replace( /&/g, '&amp;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' );
	}

	strip_quote(text) {
		const t  = String( text ).trim();
		const m1 = t.match( /^"(.*)"$/ );
		if ( m1 ) return m1[1];
		const m2 = t.match( /^'(.*)'$/ );
		if ( m2 ) return m2[1];
		return t;
	}

	strip_quote_deep(arr) {
		if ( typeof arr === 'string' ) return this.strip_quote( arr );
		if ( Array.isArray( arr ) ) return arr.map( (x) => this.strip_quote( x ) );
		return arr;
	}

	get_pipes(values) {
		const pipes = [];
		for ( const value of values ) {
			const pipe_pos = value.indexOf( '|' );
			if ( pipe_pos === -1 ) {
				pipes.push( [ value, value ] );
			} else {
				const before = value.substring( 0, pipe_pos );
				const after  = value.substring( pipe_pos + 1 );
				pipes.push( [ before, after ] );
			}
		}
		return pipes;
	}

	get_pipe_ins(pipes) {
		const ins = [];
		for ( const [ before ] of pipes ) {
			if ( !ins.includes( before ) ) ins.push( before );
		}
		return ins;
	}

	pipe(pipes, value) {
		if ( Array.isArray( value ) ) return value.map( (v) => this.pipe( pipes, v ) );
		for ( const p of pipes ) {
			if ( p[0] === value ) return p[1];
		}
		return value;
	}

	// ----------------------------- parser core

	/**
	 * Parse a single shortcode match into {type,name,options,values,raw_values}
	 * Mirrors PHP form_element_parse()
	 */
	form_element_parse(match) {
		// JS regex groups mirror the ones constructed in form_elements()
		// match[1] => type, match[2] => name, match[3] => options chunk, match[4] => quoted values chunk
		const type    = String( match[1] ).trim();
		const name    = String( match[2] || '' ).trim();
		const options = String( match[3] || '' ).trim()
			? String( match[3] ).trim().split( /\s+/ )
			: [];

		const q          = String( match[4] || '' );
		const raw_values = this.strip_quote_deep( q.match( /"[^"]*"|'[^']*'/g ) || [] );

		let values;
		if ( /^(select\*?|selectbox\*?|checkbox\*?|radio\*?|quiz)$/.test( type ) ) {
			const pipes = this.get_pipes( raw_values );
			values      = this.get_pipe_ins( pipes );
		} else {
			values = raw_values;
		}
		return { type, name, options, values, raw_values };
	}

	/**
	 * Replace callback -> routes to renderer
	 */
	form_element_replace_callback(match) {
		// Defaults compatible with PHP (avoid undefined notices)
		let type       = '';
		let options    = [];
		let raw_values = [];
		let values     = [];         // <-- declare values
		let this_name  = '';      // <-- declare this_name (fixes ReferenceError)

		({ type, name: this_name, options, values, raw_values } = this.form_element_parse( match ));

		// Country name defaulting like PHP (if empty name, use type).
		if ( type === 'country' || type === 'country*' ) {
			if ( !this_name ) this_name = type;
		}

		// Name includes current booking type suffix
		let name = this_name + this.current_booking_type;


		// Emulate edit-mode defaults from current_edit_booking.parsed_form
		// For list fields, convert stored "a,b,c" to default: selections.
		if ( this.current_edit_booking && this.current_edit_booking.parsed_form ) {
			const parsed = this.current_edit_booking.parsed_form;

			const plugDefaults = () => {
				const entry = parsed[name];
				if ( !entry ) return;
				if ( /^(?:select|selectbox|country|checkbox|radio)\*?$/.test( type ) ) {
					options            = Array.isArray( options ) ? options.slice() : [];
					// remove explicit default:... from options
					options            = options.filter( (op) => !/^default:/.test( op ) );
					const selectedList = String( entry.value || '' ).split( ',' );
					for ( const s of selectedList ) {
						if ( s !== '' ) options.push( 'default:' + s );
					}
				} else if ( /(^starttime\*?$)|(^endtime\*?$)/.test( type ) ) {
					// Special names in PHP: starttime{type}, endtime{type}
					const tname = (type.startsWith( 'starttime' ) ? 'starttime' : 'endtime') + this.current_booking_type;
					const e     = parsed[tname];
					values      = [ e && e.value ? e.value : '' ];
				} else if ( /^country\*?$/.test( type ) ) {
					const tname = 'country' + this.current_booking_type;
					const e     = parsed[tname];
					if ( e && e.value ) options = [ 'default:' + e.value ];
				} else {
					const e = parsed[name];
					values  = [ e && e.value ? e.value : '' ];
				}
			};

			plugDefaults();
		}

		// Validation error (JS side: optional hook; empty by default)
		const validation_error = ''; // You can integrate your validator and inject here.

		// Attributes from options
		let atts              = '';
		const only_field_name = name.substring( 0, name.length - this.current_booking_type.length );
		atts += ` autocomplete="${this.esc_attr( only_field_name )}"`;

		// id:
		const idOpt = options.find( (o) => /^id:[-0-9a-zA-Z_]+$/.test( o ) );
		if ( idOpt ) {
			const id = idOpt.split( ':' )[1];
			atts += ` id="${this.esc_attr( id + this.current_booking_type )}"`;
		}

		// placeholder:
		const phOpt = options.find( (o) => /^placeholder:[-0-9a-zA-Z_//]+$/.test( o ) );
		if ( phOpt ) {
			const ph = phOpt.split( ':' )[1].replace( /_/g, ' ' );
			atts += ` placeholder="${this.esc_attr( ph )}"`;
		}

		// classes
		let class_att = '';
		const cls     = options.filter( (o) => /^class:[-0-9a-zA-Z_]+$/.test( o ) ).map( (o) => o.split( ':' )[1] );
		if ( cls.length ) class_att += ' ' + cls.join( ' ' );

		if ( /^email\*?$/.test( type ) ) class_att += ' wpdev-validates-as-email';
		if ( /^coupon\*?$/.test( type ) ) class_att += ' wpdev-validates-as-coupon';
		if ( /^time\*?$/.test( type ) ) class_att += ' wpdev-validates-as-time';
		if ( /^starttime\*?$/.test( type ) ) class_att += ' wpdev-validates-as-time';
		if ( /^endtime\*?$/.test( type ) ) class_att += ' wpdev-validates-as-time';
		if ( /\*$/.test( type ) ) class_att += ' wpdev-validates-as-required';
		if ( /^checkbox\*?$/.test( type ) ) class_att += ' wpdev-checkbox';
		if ( /^radio\*?$/.test( type ) ) class_att += ' wpdev-radio';
		if ( /^captchac$/.test( type ) ) class_att += ' wpdev-captcha-' + name;
		if ( type === 'acceptance' ) {
			class_att += ' wpdev-acceptance';
			if ( options.includes( 'invert' ) ) class_att += ' wpdev-invert';
		}
		if ( class_att ) atts += ` class="${class_att.trim()}"`;

		// Posted value re-population (mirrors PHP $_POST usage)
		let value = '';
		if ( Object.prototype.hasOwnProperty.call( this.posted_data, name ) ) {
			value = this.posted_data[name];
		} else if ( Array.isArray( values ) && values[0] != null ) {
			value = values[0];
		}

		// Special name normalization for starttime/endtime
		if ( type.startsWith( 'starttime' ) ) name = 'starttime' + this.current_booking_type;
		if ( type.startsWith( 'endtime' ) ) name = 'endtime' + this.current_booking_type;

		// Switch renderers
		return this.render_element( { type, name, atts, options, values, validation_error, value } );
	}

	/**
	 * Render element to HTML (string), emulating PHP switch-case.
	 */
	render_element({ type, name, atts, options, values, validation_error, value }) {
		// Text-like
		if ( /^(starttime\*?|endtime\*?|time\*?|text\*?|email\*?|coupon\*?|captchar)$/.test( type ) ) {
			// size/maxlength: "40/255" or "40x255"
			const sizeOpt  = (options || []).find( (o) => /^[0-9]*[\/x][0-9]*$/.test( o ) ) || '';
			let sizeAttr   = ' size="40"';
			let maxlenAttr = '';
			if ( sizeOpt ) {
				const m = sizeOpt.match( /^([0-9]*)[\/x]([0-9]*)$/ );
				if ( m ) {
					if ( m[1] ) sizeAttr = ` size="${parseInt( m[1], 10 ) || 40}"`;
					if ( m[2] ) maxlenAttr = ` maxlength="${parseInt( m[2], 10 ) || ''}"`;
				}
			}

			const additional_js = /^coupon\*?$/.test( type )
				? ' onchange="if(window.wpbc_show_cost_hints_after_few_seconds){wpbc_show_cost_hints_after_few_seconds(' + this.current_booking_type + ');}" '
				: '';

			const field_type = /^email\*?$/.test( type ) ? 'type="email"' : 'type="text"';
			const html       = `<input ${field_type} name="${this.esc_attr( name )}" value="${this.esc_attr( value )}"${atts}${sizeAttr}${maxlenAttr}${additional_js}/>`;
			return `<span class="wpbc_wrap_text wpdev-form-control-wrap ${this.esc_attr( name )}">${html}${validation_error}</span>`;
		}

		// Textarea
		if ( /^textarea\*?$/.test( type ) ) {
			// cols/rows "40x10" or "40/10"
			const crOpt = (options || []).find( (o) => /^[0-9]*[x/][0-9]*$/.test( o ) );
			let crAttr  = '';
			if ( crOpt ) {
				const m = crOpt.match( /^([0-9]*)[x\/]([0-9]*)$/ );
				if ( m ) {
					if ( m[1] ) crAttr += ` cols="${parseInt( m[1], 10 ) || ''}"`;
					if ( m[2] ) crAttr += ` rows="${parseInt( m[2], 10 ) || ''}"`;
				}
			}
			const html = `<textarea name="${this.esc_attr( name )}"${atts}${crAttr}>${this.esc_attr( value )}</textarea>`;
			return `<span class="wpbc_wrap_textarea wpdev-form-control-wrap ${this.esc_attr( name )}">${html}${validation_error}</span>`;
		}

		// Country
		if ( /^country\*?$/.test( type ) ) {
			// derive defaults from options default:XX
			let scr_default = [];
			const defaults  = (options || []).filter( (o) => /^default:/.test( o ) );
			if ( defaults.length ) {
				const m = defaults[0].match( /^default:([0-9a-zA-Z_:\s-]+)$/ );
				if ( m && m[1] ) scr_default = m[1].split( '_' );
			}
			let html = '';
			for ( const [ code, label ] of Object.entries( this.countries_list ) ) {
				let selected = '';
				if ( scr_default.includes( code ) ) selected = ' selected="selected"';
				if ( value === code ) selected = ' selected="selected"';
				html += `<option value="${this.esc_attr( code )}"${selected}>${this.esc_attr( label )}</option>`;
			}
			html = `<select name="${this.esc_attr( name )}"${atts}>${html}</select>`;
			return `<span class="wpbc_wrap_select wpdev-form-control-wrap ${this.esc_attr( name )}">${html}${validation_error}</span>`;
		}

		// Select / selectbox
		if ( /^(select\*?|selectbox\*?)$/.test( type ) ) {
			const multiple      = (options || []).includes( 'multiple' );
			const include_blank = (options || []).includes( 'include_blank' );

			let vals = Array.isArray( values ) ? values.slice() : [];
			if ( !vals.length || include_blank ) vals.unshift( '---' );

			// defaults from options default:...
			const scr_defaults       = (options || []).filter( (o) => /^default:/.test( o ) );
			const selectedPipeValues = [];
			for ( const d of scr_defaults ) {
				const m = d.match( /^default:([^~]+)$/ );
				if ( m && m[1] ) {
					const part = m[1].split( '_' )[0].replace( '&#37;', '%' );
					selectedPipeValues.push( part );
				}
			}

			let html = '';
			for ( let v of vals ) {
				let label = null;
				if ( v.includes( '@@' ) ) {
					const [ ttl, vv ] = v.split( '@@' );
					label             = ttl;
					v                 = vv;
				}
				let selected = '';
				if ( selectedPipeValues.includes( v ) ) selected = ' selected="selected"';
				if ( this.posted_data && this.posted_data[name] ) {
					const pd = this.posted_data[name];
					if ( Array.isArray( pd ) ? pd.includes( v ) : String( pd ) === v ) selected = ' selected="selected"';
				}
				html += `<option value="${this.esc_attr( v )}"${selected}>${this.esc_attr( label ?? v )}</option>`;
			}
			const multAttr = multiple ? ' multiple="multiple"' : '';
			const onchange = ` onchange="if(window.wpbc_show_cost_hints_after_few_seconds){wpbc_show_cost_hints_after_few_seconds(${this.current_booking_type});}" `;
			const select   = `<select${onchange} name="${this.esc_attr( name )}${multiple ? '[]' : ''}"${atts}${multAttr}>${html}</select>`;
			return `<span class="wpbc_wrap_select wpdev-form-control-wrap ${this.esc_attr( name )}">${select}${validation_error}</span>`;
		}

		// Checkbox / Radio
		if ( /^(checkbox\*?|radio\*?)$/.test( type ) ) {
			const isCheckbox = /^checkbox/.test( type );
			const multiple   = isCheckbox && !(options || []).includes( 'exclusive' );

			const defaultOn = (options || []).some( (o) => o === 'default:on' ) ? ' checked="checked"' : '';

			// render group
			let groupIdAttr = '';
			let attsNoId    = atts;
			// If label element requested, we remove ID from input and put on labels later
			let idMatch     = atts.match( /\sid="([-0-9a-zA-Z_]+)"/ );
			if ( idMatch ) {
				attsNoId    = atts.replace( idMatch[0], '' );
				groupIdAttr = ` id="${this.esc_attr( idMatch[1] )}" `;
			}

			const use_label_element = (options || []).some( (o) => /^use[_-]?label[_-]?element$/.test( o ) );
			const label_first       = (options || []).some( (o) => /^label[_-]?first$/.test( o ) );
			const label_wrap        = (options || []).some( (o) => /^label[_-]?wrap$/.test( o ) );

			const input_type = isCheckbox ? 'checkbox' : 'radio';
			let htmlItems    = '';

			// defaults from options default:a, default:b etc.
			const defaults    = (options || []).filter( (op) => /^default:/.test( op ) ).map( (s) => s.replace( /^default:/, '' ) );
			const defaultsSet = new Set( defaults.join( ',' ).split( ',' ).map( (s) => s.trim() ).filter( Boolean ) );

			(values || []).forEach( (rawVal, idx) => {
				let labelText = rawVal;
				let v         = rawVal;
				if ( rawVal.includes( '@@' ) ) {
					const [ ttl, vv ] = rawVal.split( '@@' );
					labelText         = ttl;
					v                 = vv;
				}

				// selected logic
				let checked = '';
				if ( defaultsSet.has( v ) ) checked = ' checked="checked"';
				const pd = this.posted_data?.[name];
				if ( pd ) {
					if ( multiple && Array.isArray( pd ) && pd.includes( v ) ) checked = ' checked="checked"';
					if ( !multiple && String( pd ) === v ) checked = ' checked="checked"';
				}

				// unique ID if using label element
				let idForInput    = '';
				let labelForParam = '';
				if ( use_label_element ) {
					const uniq    = (idMatch ? idMatch[1] : 'checkboxid') + String( Date.now() ) + idx + Math.floor( 1000 + Math.random() * 9000 );
					idForInput    = ` id="${this.esc_attr( uniq )}"`;
					labelForParam = ` for="${this.esc_attr( uniq )}"`;
				}

				const onchange = ` onchange="if(window.wpbc_show_cost_hints_after_few_seconds){wpbc_show_cost_hints_after_few_seconds(${this.current_booking_type});}" `;
				const nameAttr = `${this.esc_attr( name )}${multiple ? '[]' : ''}`;
				const input    = `<input ${attsNoId}${idForInput}${onchange} type="${input_type}" name="${nameAttr}" value="${this.esc_attr( v )}"${checked}${defaultOn} />`;

				let item;
				if ( label_wrap ) {
					// <label>label or input first per label_first</label>
					if ( label_first ) {
						item = `<label${labelForParam} class="wpdev-list-item-label">${this.esc_attr( labelText )}${input}</label>`;
					} else {
						item = `<label${labelForParam} class="wpdev-list-item-label">${input}${this.esc_attr( labelText )}</label>`;
					}
				} else {
					const labelEl = use_label_element ? 'label' : 'span';
					const label   = `<${labelEl}${labelForParam} class="wpdev-list-item-label">${this.esc_attr( labelText )}</${labelEl}>`;
					item          = label_first ? (label + input) : (input + label);
				}

				htmlItems += `<span class="wpdev-list-item">${item}</span>`;
			} );

			const group = `<span${idMatch ? attsNoId : atts}${groupIdAttr}>${htmlItems}</span>`;
			return `<span class="wpbc_wrap_checkbox wpdev-form-control-wrap ${this.esc_attr( name )}">${group}${validation_error}</span>`;
		}

		// Quiz
		if ( type === 'quiz' ) {
			// If no provided, default quiz like PHP
			let raw        = Array.isArray( values ) && values.length ? values.slice() : [];
			let raw_values = raw.length ? raw : [ '1+1=?' ];
			const pipes    = this.get_pipes( (raw.length ? (raw.map( (v) => `${v}|${v}` )) : [ '1+1=?|2' ]) ); // emulate
			// pick one question
			const q          = raw_values.length === 1 ? raw_values[0] : raw_values[Math.floor( Math.random() * raw_values.length )];
			const answer     = this.pipe( pipes, q ); // here equal, but kept for parity
			const hiddenHash = this.esc_attr( answer ); // server hash not available; store clear or attach your own hash function
			let html         = `<span class="wpdev-quiz-label">${this.esc_attr( q )}</span>&nbsp;`;
			html += `<input type="text" name="${this.esc_attr( name )}"${atts} />`;
			html += `<input type="hidden" name="wpdev_quiz_answer_${this.esc_attr( name )}" value="${hiddenHash}" />`;
			return `<span class="wpdev-form-control-wrap ${this.esc_attr( name )}">${html}${validation_error}</span>`;
		}

		// Acceptance
		if ( type === 'acceptance' ) {
			const invert    = (options || []).includes( 'invert' ); // not used client-side here
			const defaultOn = (options || []).includes( 'default:on' );
			const checked   = defaultOn ? ' checked="checked"' : '';
			const onclick   = ' onclick="if(window.wpdevToggleSubmit)wpdevToggleSubmit(this.form);"';
			const html      = `<input type="checkbox" name="${this.esc_attr( name )}" value="1"${atts}${onclick}${checked} />`;
			return html;
		}

		// captchac (image) / captchar (input) — stubs
		if ( type === 'captchac' ) {
			const html   = `<img alt="CAPTCHA unavailable on front-end JS" src=""${atts} />`;
			const hidden = `<input type="hidden" name="wpdev_captcha_challenge_${this.esc_attr( name )}" value="" />`;
			return hidden + html;
		}
		if ( type === 'captchar' ) {
			const html = `<input type="text" name="${this.esc_attr( name )}"${atts} />`;
			return `<span class="wpbc_wrap_text wpdev-form-control-wrap ${this.esc_attr( name )}">${html}${validation_error}</span>`;
		}

		// File
		if ( /^file\*?$/.test( type ) ) {
			const html = `<input type="file" name="${this.esc_attr( name )}"${atts} />`;
			return `<span class="wpdev-form-control-wrap ${this.esc_attr( name )}">${html}${validation_error}</span>`;
		}

		// Submit button
		if ( /^\[?submit/.test( type ) || type === 'submit' ) {
			// Handle via submit_replace_callback (called separately when we parse submit)
			// Here: fallback simple button
			const valueText = 'Send';
			const btn       = `<input type="button" value="${this.esc_attr( valueText )}"${atts} />`;
			return btn;
		}

		// Fallback: plain input text
		const html = `<input type="text" name="${this.esc_attr( name )}" value="${this.esc_attr( value )}"${atts} />`;
		return `<span class="wpbc_wrap_text wpdev-form-control-wrap ${this.esc_attr( name )}">${html}${validation_error}</span>`;
	}

	/**
	 * Submit button replacement (separate pass, like PHP submit_replace_callback)
	 */
	submit_replace_callback(match) {
		// match[1] => options area (classes/id), match[2] => quoted value (label)
		let atts       = '';
		const optChunk = (match[1] || '').trim();
		const options  = optChunk ? optChunk.split( /\s+/ ) : [];

		// id:
		const idOpt = options.find( (o) => /^id:[-0-9a-zA-Z_]+$/.test( o ) );
		if ( idOpt ) {
			const id = idOpt.split( ':' )[1];
			atts += ` id="${this.esc_attr( id )}"`;
		}

		// classes:
		const cls       = options.filter( (o) => /^class:[-0-9a-zA-Z_]+$/.test( o ) ).map( (o) => o.split( ':' )[1] );
		const class_att = cls.length ? ` class="wpbc_button_light ${this.esc_attr( cls.join( ' ' ) )}"` : ` class="wpbc_button_light"`;
		atts += class_att;

		let value = (match[2] ? this.strip_quote( match[2] ) : '') || 'Send';

		// No admin/edit hash flow on client; simple submit button hooking to JS:
		const btn = `<input type="button" value="${this.esc_attr( value )}"${atts} onclick="if(window.mybooking_submit){mybooking_submit(this.form, ${this.current_booking_type}, (window.wpbc_get_maybe_reloaded_booking_locale?wpbc_get_maybe_reloaded_booking_locale():''));}" />`;
		return btn;
	}

	/**
	 * Parse & (optionally) replace all shortcodes in a form string.
	 * When replace = false, returns an array of parsed elements.
	 */
	form_elements(form, replace = true) {
		const types      = String.raw`text[*]?|email[*]?|coupon[*]?|time[*]?|textarea[*]?|select[*]?|selectbox[*]?|checkbox[*]?|radio[*]?|acceptance|captchac|captchar|file[*]?|quiz`;
		const reMain     = new RegExp(
			String.raw`\[\s*(` + types + String.raw`)(\s+[a-zA-Z][0-9a-zA-Z:._-]*)([-0-9a-zA-Z:#_/|\s]*)?((?:\s*(?:"[^"]*"|'[^']*'))*)?\s*\]`,
			'g'
		);
		// starttime|endtime|country variants
		const reStartEnd = new RegExp(
			String.raw`\[\s*(country[*]?|starttime[*]?|endtime[*]?)(\s*[a-zA-Z]*[0-9a-zA-Z:._-]*)([-0-9a-zA-Z:#_/|\s]*)?((?:\s*(?:"[^"]*"|'[^']*'))*)?\s*\]`,
			'g'
		);
		const reSubmit   = new RegExp(
			String.raw`\[\s*submit(\s[-0-9a-zA-Z:#_/\s]*)?(\s+(?:"[^"]*"|'[^']*'))?\s*\]`,
			'g'
		);

		if ( replace ) {
			let out = String( form );

			out = out.replace( reMain, (...m) => this.form_element_replace_callback( m ) );
			out = out.replace( reStartEnd, (...m) => this.form_element_replace_callback( m ) );
			out = out.replace( reSubmit, (...m) => this.submit_replace_callback( m ) );

			return out;
		} else {
			const results    = [];
			const addMatches = (regex, src) => {
				let match;
				while ( (match = regex.exec( src )) ) {
					results.push( this.form_element_parse( match ) );
				}
			};
			addMatches( new RegExp( reMain.source, 'g' ), form );
			addMatches( new RegExp( reStartEnd.source, 'g' ), form );
			// submit not included in parse-only in PHP, keeping parity
			return results;
		}
	}

	/**
	 * Equivalent of get_booking_data() "parsed_form" splitter for stored form string.
	 * Input example: "checkbox^fee4^true~text^name4^John"
	 */
	parse_booking_form_string(formStr, booking_type_suffix = '') {
		const ret = {};
		if ( !formStr ) return ret;

		const parts = String( formStr ).split( '~' );
		for ( const field of parts ) {
			const elems = field.split( '^' );
			if ( elems.length < 3 ) continue;

			let type         = elems[0];
			let element_name = elems[1];
			let value        = elems[2];

			// booking type suffix handling (remove [] and trailing type)
			let type_name = element_name.replace( '[]', '' );
			if ( booking_type_suffix && type_name.endsWith( booking_type_suffix ) ) {
				type_name = type_name.slice( 0, -booking_type_suffix.length );
			}

			if ( type === 'checkbox' ) {
				if ( value === 'true' ) value = 'on';
				else if ( value === 'false' || value === 'Off' || value == null ) value = '';
			}

			element_name = element_name.replace( '[]', '' );
			if ( ret[element_name] ) {
				if ( value !== '' ) ret[element_name].value += ',' + value;
			} else {
				ret[element_name] = { value, type, element_name: type_name };
			}
		}
		return ret;
	}
}





/* ================================================================================================
 *  Real-time Preview Wiring
 *  Requirements: window.WPBC_Form_Shortcode_Parser must be available (from the previous answer).
 * ================================================================================================ */

/* ================================================================================================
 *  Real-time Preview Wiring (complete)
 * ================================================================================================ */

(function setupLivePreview() {

	// 0) Booking type used to suffix names
	function _getCurrentBookingType() {
		const t = window._wpbc_builder?.current_booking_type ?? window.wpbc_bfb?.current_booking_type ?? 1;
		return String( t );
	}

	// 1) Single shared parser instance
	function _getParser() {
		if ( !window.WPBC_Form_Shortcode_Parser ) return null;
		if ( !window.wpbc_shortcode_parser ) {
			window.WPBC_COUNTRIES        = window.WPBC_COUNTRIES || {
				US: 'United States',
				GB: 'United Kingdom',
				FR: 'France',
				ES: 'Spain'
			};
			window.wpbc_shortcode_parser = new WPBC_Form_Shortcode_Parser( {
				current_booking_type: _getCurrentBookingType(),
				countries_list      : window.WPBC_COUNTRIES,
				current_edit_booking: window._wpbc_builder?.current_edit_booking || null,
				posted_data         : {}
			} );
		}
		window.wpbc_shortcode_parser.current_booking_type = _getCurrentBookingType();
		return window.wpbc_shortcode_parser;
	}

	// 2) Build (or reuse) the UI
	function _ensureExportUI() {
		let wrap = document.getElementById( 'wpbc_bfb__export_wrap' );
		if ( !wrap ) {
			const after = document.getElementById( 'wpbc_bfb__inspector' ) || document.body;

			wrap              = document.createElement( 'section' );
			wrap.id           = 'wpbc_bfb__export_wrap';
			wrap.className    = 'wpbc_bfb__export_wrap';
			wrap.style.margin = '16px 0';

			const title        = document.createElement( 'h4' );
			title.textContent  = 'Advanced Form (export) + Live Preview';
			title.style.margin = '0 0 6px';

			const ta            = document.createElement( 'textarea' );
			ta.id               = 'wpbc_bfb__advanced_form_output';
			ta.rows             = 10;
			ta.style.width      = '100%';
			ta.style.fontFamily = 'monospace';
			ta.placeholder      = 'Paste or type your WPBC shortcode form here…';

			const actions        = document.createElement( 'div' );
			actions.style.margin = '8px 0';
			const copy           = document.createElement( 'button' );
			copy.id              = 'wpbc_bfb__copy_btn';
			copy.type            = 'button';
			copy.className       = 'button';
			copy.textContent     = 'Copy';
			actions.appendChild( copy );

			const pvLabel        = document.createElement( 'div' );
			pvLabel.textContent  = 'Live preview:';
			pvLabel.style.margin = '12px 0 4px';

			const pv            = document.createElement( 'div' );
			pv.id               = 'wpbc_bfb__advanced_form_preview';
			pv.className        = 'wpbc_bfb__advanced_form_preview';
			pv.style.minHeight  = '60px';
			pv.style.border     = '1px solid #e5e7eb';
			pv.style.padding    = '8px';
			pv.style.background = '#fff';

			wrap.append( title, ta, actions, pvLabel, pv );

			// Insert after inspector so it stays nearby
			if ( after.parentNode ) after.parentNode.insertBefore( wrap, after.nextSibling );
			else document.body.appendChild( wrap );
		}

		return {
			wrap,
			ta  : document.getElementById( 'wpbc_bfb__advanced_form_output' ),
			pv  : document.getElementById( 'wpbc_bfb__advanced_form_preview' ),
			copy: document.getElementById( 'wpbc_bfb__copy_btn' )
		};
	}

	// 3) Render preview
	function _renderPreview(ta, pv) {
		const parser = _getParser();
		if ( !parser ) {
			pv.innerHTML = '<em>Parser not available yet.</em>';
			return;
		}
		try {
			const html   = parser.form_elements( ta.value || '', true );
			pv.innerHTML = html || '<em>Nothing to preview.</em>';
		} catch ( err ) {
			pv.innerHTML              = '<pre style="white-space:pre-wrap;color:#b91c1c;"></pre>';
			pv.firstChild.textContent = String( err && err.message || err );
		}
	}

	// 4) Copy button
	function _wireCopy(copy, ta) {
		if ( !copy ) return;
		copy.addEventListener( 'click', () => {
			ta.select();
			const ok = document.execCommand && document.execCommand( 'copy' );
			if ( !ok && navigator.clipboard ) navigator.clipboard.writeText( ta.value || '' );
			copy.textContent = 'Copied!';
			setTimeout( () => (copy.textContent = 'Copy'), 1200 );
		} );
	}

	// 5) Init
	function _init() {
		const { ta, pv, copy } = _ensureExportUI();

		const debounce = (fn, wait = 150) => {
			let t;
			return (...a) => {
				clearTimeout( t );
				t = setTimeout( () => fn( ...a ), wait );
			};
		};
		const update   = () => _renderPreview( ta, pv );

		ta.addEventListener( 'input', debounce( update, 120 ) );
		ta.addEventListener( 'change', update );
		_wireCopy( copy, ta );

		// First render
		update();

		// Keep fresh when the builder reloads structure
		const EV = window.WPBC_BFB_Events || {};
		document.addEventListener( EV.STRUCTURE_LOADED || 'wpbc:bfb:structure:loaded', update );
		document.addEventListener( EV.STRUCTURE_CHANGE || 'wpbc:bfb:structure:change', update );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', _init );
	} else {
		_init();
	}
})();
