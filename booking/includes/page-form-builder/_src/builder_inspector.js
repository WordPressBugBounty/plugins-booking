// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/builder_inspector.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------------------------------
// Generic, schema-driven Inspector
// ---------------------------------------------------------------------------------------------------------------------
class WPBC_BFB_Inspector {

	/**
	 * Create an Inspector instance.
	 *
	 * @param {HTMLElement|null} panelEl - Inspector container; if null, a fallback panel is created and appended to <body>.
	 * @param {WPBC_Form_Builder} builder - Reference to the form builder instance.
	 */
	constructor(panelEl, builder) {
		this.panel           = panelEl || this._create_fallback_panel();
		this.builder         = builder;
		this.selected_el     = null;
		this._initial_render = false;
		this.open_groups     = new Set();// simple keep-open state.
		this._renderTimer    = null;
	}

	/**
	 * Bind the inspector UI to a specific field element and render its controls.
	 *
	 * @param {HTMLElement} fieldEl - The `.wpbc_bfb__field` element to inspect.
	 * @returns {void}
	 */
	bind_to_field(fieldEl) {
		this.selected_el     = fieldEl;
		this._initial_render = true;
		this.render();
	}

	/**
	 * Clear the inspector panel and show the empty state message.
	 *
	 * @returns {void}
	 */
	clear() {
		this.selected_el = null;
		if ( this._renderTimer ) {
			clearTimeout( this._renderTimer );
			this._renderTimer = null;
		}
		this.panel.innerHTML = '<div class="wpbc_bfb__inspector__empty">Select a field to edit its options.</div>';
	}

	/**
	 * Debounced re-render of the inspector while preserving focus and caret position.
	 *
	 * @private
	 * @param {number} [delay=200] - Debounce delay in milliseconds.
	 * @returns {void}
	 */
	_schedule_render_preserving_focus(delay = 200) {
		// record focus + caret
		const active    = document.activeElement;
		const activeKey = active?.dataset?.inspectorKey || null;
		let selStart    = null, selEnd = null;
		if ( active && 'selectionStart' in active && 'selectionEnd' in active ) {
			selStart = active.selectionStart;
			selEnd   = active.selectionEnd;
		}

		clearTimeout( this._renderTimer );
		this._renderTimer = setTimeout( () => {
			this.render();

			// restore focus
			if ( activeKey ) {
				const next = this.panel.querySelector( `[data-inspector-key="${activeKey}"]` );
				if ( next ) {
					next.focus();
					// try restore caret
					try {
						if ( selStart != null && selEnd != null && 'setSelectionRange' in next ) {
							next.setSelectionRange( selStart, selEnd );
						}
					} catch ( _ ) {
					}
				}
			}
		}, delay );
	}

	/**
	 * Render the inspector UI for the currently selected field based on its schema.
	 * Applies default values, groups options, and wires change handlers.
	 *
	 * @returns {void}
	 */
	render() {

		const el = this.selected_el;

		// Hard guard: if there is no selection OR the node is no longer in the document — clear.
		if ( ! el || ! document.body.contains( el ) ) {
			return this.clear();
		}

		// === Section branch ===
		if ( el.classList.contains( 'wpbc_bfb__section' ) ) {
			return this._render_section_panel( el );
		}

		// === Field branch (existing flow) ===
		if ( ! el.classList.contains( 'wpbc_bfb__field' ) ) {
			return this.clear();
		}


		const data = window.WPBC_BFB_Core.WPBC_Form_Builder_Helper.get_all_data_attributes( el );

		const type   = data.type || 'text';
		const schema = (window.WPBC_BFB_Field_Option_Schemas || {})[type];

		if ( ! schema ) {
			this.panel.innerHTML = `<div class="wpbc_bfb__inspector__empty">No schema for type "<code>${type}</code>".</div>`;
			return;
		}


		// Apply defaults without overwriting existing values
		const normalized = this._with_defaults( data, schema );

		// Header
		const head     = document.createElement( 'div' );
		head.className = 'wpbc_bfb__inspector__head';
		head.innerHTML = `
							<div>
								<h3 class="title">${schema.title || type}</h3>
								${schema.description ? `<div class="desc">${schema.description}</div>` : ''}
							</div>
							<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
								<div class="ui_container ui_container_small">
									<div class="ui_group ">
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="deselect" aria-label="Deselect"><i class="menu_icon icon-1x wpbc_icn_remove_done"></i></button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="scrollto" aria-label="Scroll to field in canvas">
												<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-up" aria-label="Move field up">
												<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
											</button>
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-down" aria-label="Move field down">
												<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger tooltip_top button-link-delete" data-action="delete" aria-label="Delete"><span class="in-button-text">Delete&nbsp;&nbsp;</span><i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></button>
										</div>
									</div>
								</div>
							</div>
						`;
		// ---------------------------------------------------------------------------------
		// Deselect (field).
		head.querySelector( '[data-action="deselect"]' ).onclick = () => {
			this.builder?.select_field?.( null );
		};

		// ---------------------------------------------------------------------------------
		// Scroll to selected field in canvas.
		const scrollBtnF = head.querySelector( '[data-action="scrollto"]' );
		if ( scrollBtnF ) {
			scrollBtnF.onclick = (e) => {
				e.preventDefault();
				const el = this.selected_el;
				if ( ! el || ! document.body.contains( el ) ) {
					return;
				}
				// Reuse builder’s scroll option to keep selection/state consistent.
				this.builder?.select_field?.( el, { scrollIntoView: true } );
				// Optional: brief highlight pulse (class added below in CSS note).
				el.classList.add( 'wpbc_bfb__scroll-pulse' );
				setTimeout( () => el.classList.remove( 'wpbc_bfb__scroll-pulse' ), 700 );
			};
		}

		// ---------------------------------------------------------------------------------
		// Move up/down (field).
		const selected_field = el; // current field element.
		const f_up           = head.querySelector( '[data-action="move-up"]' );
		const f_down         = head.querySelector( '[data-action="move-down"]' );

		if ( f_up ) {
			f_up.onclick = (e) => {
				e.preventDefault();
				this.builder?.move_item?.( selected_field, 'up' );
				this.builder?.select_field?.( selected_field, { scrollIntoView: false } );
			};
		}
		if ( f_down ) {
			f_down.onclick = (e) => {
				e.preventDefault();
				this.builder?.move_item?.( selected_field, 'down' );
				this.builder?.select_field?.( selected_field, { scrollIntoView: false } );
			};
		}

		// ---------------------------------------------------------------------------------
		// Delete (field).
		const delBtn = head.querySelector( '[data-action="delete"]' );
		if ( delBtn ) {
			delBtn.onclick = () => {
				const target = this.selected_el;
				if ( ! target ) {
					return;
				}
				// Optional: confirmation. Remove this block if you want immediate delete.
				const isField = target.classList.contains( 'wpbc_bfb__field' );
				const label   = isField
					? (target.querySelector( '.wpbc_bfb__field-label' )?.textContent || target.dataset?.id || 'field')
					: (target.dataset?.id || 'section');

				if ( ! window.confirm( `Delete ${label}? This cannot be undone.` ) ) {
					return;
				}
				this.builder?.delete_item?.( target );
			};
		}

		// Body (groups)
		const body     = document.createElement( 'div' );
		body.className = 'wpbc_bfb__inspector__body';

		(schema.groups || []).forEach( (group, idx) => {
			const gid  = `grp-${idx}-${(schema.title || type).toLowerCase()}`;
			const open = this.open_groups.has( gid ) || (this._initial_render && idx === 0);

			// Persist the initial-open state so it stays open on subsequent re-renders.
			if ( this._initial_render && idx === 0 ) {
				this.open_groups.add( gid );
			}

			const wrap     = document.createElement( 'section' );
			wrap.className = `wpbc_bfb__inspector__group ${open ? 'is-open' : ''}`;

			const h     = document.createElement( 'button' );
			h.type      = 'button';
			h.className = 'group__header';
			h.innerHTML = `<span>${group.label || 'Options'}</span><i class="dashicons dashicons-arrow-${open ? 'up' : 'down'}"></i>`;
			h.onclick   = () => {
				if ( wrap.classList.toggle( 'is-open' ) ) this.open_groups.add( gid );
				else this.open_groups.delete( gid );
				const i = h.querySelector( 'i' );
				if ( i ) i.className = `dashicons dashicons-arrow-${wrap.classList.contains( 'is-open' ) ? 'up' : 'down'}`;
			};
			wrap.appendChild( h );

			const fieldsWrap     = document.createElement( 'div' );
			fieldsWrap.className = 'group__fields';

			(group.fields || []).forEach( def => {
				const row = this._render_field_row( def, normalized, schema );
				if ( row ) fieldsWrap.appendChild( row );
			} );

			wrap.appendChild( fieldsWrap );
			body.appendChild( wrap );
		} );

		this.panel.innerHTML = '';
		this.panel.appendChild( head );
		this.panel.appendChild( body );
		this._initial_render = false;
	}

	/**
	 * Render a single schema-defined control row (label + control).
	 *
	 * @private
	 * @param {Object} def - Schema control definition (`key`, `label`, `type`, etc.).
	 * @param {Object} data - Current data-* attributes mapped for the selected element.
	 * @param {Object} schema - Active option schema for the field type.
	 * @returns {HTMLElement|null} The row element, or null if the definition is invalid.
	 */
	_render_field_row(def, data, schema) {

		const key = def.key;
		if ( ! key ) {
			return null;
		}

		const mapKey = (schema.dataMap || {})[key] || key;
		const value  = data[mapKey];

		const row     = document.createElement( 'div' );
		row.className = 'inspector__row';

		const label       = document.createElement( 'label' );
		label.className   = 'inspector__label';
		label.textContent = def.label || key;
		if ( def.required ) label.innerHTML += ' <span class="req">*</span>';
		if ( def.tooltip ) label.title = def.tooltip;

		const inputWrap     = document.createElement( 'div' );
		inputWrap.className = 'inspector__control';

		const ctrl = this._make_control( def, value );
		ctrl.dataset.inspectorKey = (schema.dataMap || {})[def.key] || def.key;
		inputWrap.appendChild( ctrl );

		// Change binding.
		const applyValue = () => {

			let v = this._read_control_value( def, ctrl );
			if ( def.type === 'checkbox' ) {
				v = !!v;
			}

			const target = this.selected_el;
			if ( !target ) {
				return;
			}

			// Special handling for id/name so we sanitize + ensure uniqueness & reflect back.
			if ( mapKey === 'id' ) {
				const unique = this.builder?.id?.set_field_id?.( target, v );
				if ( unique != null && ctrl.value !== unique ) ctrl.value = unique;
				return;
			}
			if ( mapKey === 'name' ) {
				const unique = this.builder?.id?.set_field_name?.( target, v );
				if ( unique != null && ctrl.value !== unique ) ctrl.value = unique;
				return;
			}
			if ( mapKey === 'html_id' ) {
				const applied = this.builder?.id?.set_field_html_id?.( target, v );
				if ( applied != null && ctrl.value !== applied ) ctrl.value = applied;
				return;
			}

			// For checkboxes: always store explicit true/false so defaults never override.
			if ( def.type === 'checkbox' ) {
				target.setAttribute( 'data-' + mapKey, String( v ) ); // "true" | "false"
			} else {
				// For text/number/etc: keep empty string as an explicit value.
				// Only remove when the value is truly null/undefined (rare in UI).
				if ( v == null ) {
					target.removeAttribute( 'data-' + mapKey );
				} else {
					const val = (typeof v === 'object') ? JSON.stringify( v ) : String( v );
					target.setAttribute( 'data-' + mapKey, val );
				}
			}

			// Update preview/overlay only (does NOT rebuild inspector).
			if ( this.builder?.preview_mode ) {
				this.builder.render_preview( target );
			} else {
				this.builder.add_overlay_toolbar( target );
			}
		};

		// While typing: apply + debounce an inspector refresh that preserves focus.
		const onInput = () => {
			applyValue();
			this._schedule_render_preserving_focus( 200 ); // debounce while typing.
		};

		// On commit (change/blur): apply + quick refresh.
		const onChange = () => {
			applyValue();
			this._schedule_render_preserving_focus( 0 );   // immediate (still focus-safe).
		};

		ctrl.addEventListener( 'input', onInput );
		ctrl.addEventListener( 'change', onChange );

		row.appendChild( label );
		row.appendChild( inputWrap );
		return row;
	}

	/**
	 * Create a form control element for a given schema definition and value.
	 *
	 * @private
	 * @param {Object} def - Schema control definition (`type`, `options`, placeholders, etc.).
	 * @param {*} value - Current value to populate into the control.
	 * @returns {HTMLElement} The created input/select/textarea element.
	 */
	_make_control(def, value) {
		const commonAttr = (el) => {
			if ( def.placeholder ) el.placeholder = def.placeholder;
			if ( def.min != null ) el.min = def.min;
			if ( def.max != null ) el.max = def.max;
			if ( def.step != null ) el.step = def.step;
			el.autocomplete = 'off';
			el.className    = 'inspector__input';
			return el;
		};

		switch ( def.type ) {
			case 'text': {
				const i = commonAttr( document.createElement( 'input' ) );
				i.type  = 'text';
				i.value = value ?? '';
				return i;
			}
			case 'number': {
				const i = commonAttr( document.createElement( 'input' ) );
				i.type  = 'number';
				i.value = (value ?? '') === '' ? '' : String( value );
				return i;
			}
			case 'checkbox': {
				const i     = document.createElement( 'input' );
				i.type      = 'checkbox';
				i.className = 'inspector__checkbox';
				i.checked   = (value === true || value === 'true' || value === 1 || value === '1');
				return i;
			}
			case 'textarea': {
				const t     = document.createElement( 'textarea' );
				t.className = 'inspector__textarea';
				t.rows      = 3;
				t.value     = value ?? '';
				return t;
			}
			case 'select': {
				const s     = document.createElement( 'select' );
				s.className = 'inspector__select';
				(def.options || []).forEach( opt => {
					const o = document.createElement( 'option' );
					if ( typeof opt === 'string' ) {
						o.value       = opt;
						o.textContent = opt;
					} else {
						o.value       = opt.value;
						o.textContent = opt.label ?? opt.value;
					}
					if ( String( o.value ) === String( value ?? '' ) ) o.selected = true;
					s.appendChild( o );
				} );
				return s;
			}
			default: {
				const i = commonAttr( document.createElement( 'input' ) );
				i.type  = 'text';
				i.value = value ?? '';
				return i;
			}
		}
	}

	/**
	 * Read and normalize the current value from a rendered control.
	 *
	 * @private
	 * @param {Object} def - Schema control definition.
	 * @param {HTMLElement} ctrl - The input/select/textarea element.
	 * @returns {*} Normalized value (boolean for checkbox, number for numeric inputs, string otherwise).
	 */
	_read_control_value(def, ctrl) {
		switch ( def.type ) {
			case 'checkbox':
				return !!ctrl.checked;
			case 'number':
				return ctrl.value === '' ? '' : Number( ctrl.value );
			default:
				return ctrl.value;
		}
	}

	/**
	 * Apply schema defaults to a data object without overwriting existing values.
	 *
	 * @private
	 * @param {Object} data - Parsed data-* attributes for the field.
	 * @param {Object} schema - Option schema for the field type.
	 * @returns {Object} A new object with defaults applied.
	 */
	_with_defaults(data, schema) {
		const out = { ...data };
		(schema.groups || []).forEach( g => (g.fields || []).forEach( f => {
			const mapKey = (schema.dataMap || {})[f.key] || f.key;
			if ( out[mapKey] == null && f.default !== undefined ) out[mapKey] = f.default;
		} ) );
		// Ensure type is present
		if ( !out.type ) out.type = 'text';
		return out;
	}

	/**
	 * Create a fallback inspector panel when none exists in the DOM.
	 *
	 * @private
	 * @returns {HTMLElement} The created panel element appended to <body>.
	 */
	_create_fallback_panel() {
		const p     = document.createElement( 'div' );
		p.id        = 'wpbc_bfb__inspector';
		p.className = 'wpbc_bfb__inspector';
		document.body.appendChild( p );
		return p;
	}



	/**
	 * Render the Inspector panel for a section: columns control (+ deselect).
	 *
	 * @param {HTMLElement} section_el - The selected .wpbc_bfb__section element.
	 * @returns {void}
	 */
	_render_section_panel(section_el) {
		// Current column count.
		const row       = section_el.querySelector( ':scope > .wpbc_bfb__row' );
		const col_count = row ? row.querySelectorAll( ':scope > .wpbc_bfb__column' ).length : 1;

		// -----------------------------------------------------------------------------
		// Header
		const head     = document.createElement( 'div' );
		head.className = 'wpbc_bfb__inspector__head';
		head.innerHTML = `
							<div>
								<h3 class="title">Section</h3>
								<div class="desc">Configure layout for this section.</div>
							</div>
							<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
								<div class="ui_container ui_container_small">
									<div class="ui_group ">
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="deselect" aria-label="Deselect"><i class="menu_icon icon-1x wpbc_icn_remove_done"></i></button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="scrollto" aria-label="Scroll to section in canvas">
												<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-up" aria-label="Move section up">
												<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
											</button>
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button tooltip_top" data-action="move-down" aria-label="Move section down">
												<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
											</button>
										</div>
										<div class="ui_element">
											<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger tooltip_top button-link-delete" data-action="delete" aria-label="Delete"><span class="in-button-text">Delete&nbsp;&nbsp;</span><i class="menu_icon icon-1x wpbc_icn_delete_outline"></i></button>
										</div>
									</div>
								</div>
							</div>							
						`;
		// -----------------------------------------------------------------------------
		// Deselect action.
		head.querySelector( '[data-action="deselect"]' ).onclick = () => { this.builder?.select_field?.( null ); };

		// -----------------------------------------------------------------------------
		// Scroll to selected section in canvas.
		const scrollBtnS = head.querySelector( '[data-action="scrollto"]' );
		if ( scrollBtnS ) {
			scrollBtnS.onclick = (e) => {
				e.preventDefault();
				const el = this.selected_el;
				if ( ! el || ! document.body.contains( el ) ) {
					return;
				}
				this.builder?.select_field?.( el, { scrollIntoView: true } );
				el.classList.add( 'wpbc_bfb__scroll-pulse' );
				setTimeout( () => el.classList.remove( 'wpbc_bfb__scroll-pulse' ), 700 );
			};
		}

		// -----------------------------------------------------------------------------
		// Move up / down (section).
		const upBtn = head.querySelector( '[data-action="move-up"]' );
		if ( upBtn ) {
			upBtn.onclick = (e) => {
				e.preventDefault();
				this.builder?.move_item?.( section_el, 'up' );
				// keep focus on inspector; reselect to ensure binding remains.
				this.builder?.select_field?.( section_el, { scrollIntoView: false } );
			};
		}
		const downBtn = head.querySelector( '[data-action="move-down"]' );
		if ( downBtn ) {
			downBtn.onclick = (e) => {
				e.preventDefault();
				this.builder?.move_item?.( section_el, 'down' );
				// keep focus on inspector; reselect to ensure binding remains.
				this.builder?.select_field?.( section_el, { scrollIntoView: false } );
			};
		}

		// -----------------------------------------------------------------------------
		// Delete (section).
		const delBtn = head.querySelector( '[data-action="delete"]' );
		if ( delBtn ) {
			delBtn.onclick = () => {
				const target = this.selected_el;
				if ( ! target ) {
					return;
				}
				// Optional: confirmation (clarify it removes nested content too).
				const label = target.dataset?.id || 'section';
				if ( ! window.confirm( `Delete ${label} and all its contents? This cannot be undone.` ) ) {
					return;
				}
				this.builder?.delete_item?.( target );
			};
		}

		// -----------------------------------------------------------------------------
		// Body.
		const body     = document.createElement( 'div' );
		body.className = 'wpbc_bfb__inspector__body';

		// -----------------------------------------------------------------------------
		// A single group: Layout.
		const wrap     = document.createElement( 'section' );
		wrap.className = 'wpbc_bfb__inspector__group is-open';

		const h     = document.createElement( 'button' );
		h.type      = 'button';
		h.className = 'group__header';
		h.innerHTML = `<span>Layout</span><i class="dashicons dashicons-arrow-up"></i>`;
		h.onclick   = () => {
			wrap.classList.toggle( 'is-open' );
			const i = h.querySelector( 'i' );
			if ( i ) i.className = `dashicons dashicons-arrow-${wrap.classList.contains( 'is-open' ) ? 'up' : 'down'}`;
		};
		wrap.appendChild( h );

		const fieldsWrap     = document.createElement( 'div' );
		fieldsWrap.className = 'group__fields';

		// Columns control (number input)
		const rowEl     = document.createElement( 'div' );
		rowEl.className = 'inspector__row';

		const label       = document.createElement( 'label' );
		label.className   = 'inspector__label';
		label.textContent = 'Columns';

		const ctrlWrap     = document.createElement( 'div' );
		ctrlWrap.className = 'inspector__control';

		// Columns control (number input) — apply on each valid keystroke and keep UI in sync.
		const input                = document.createElement( 'input' );
		input.type                 = 'number';
		input.className            = 'inspector__input';
		input.min                  = '1';
		input.max                  = '4';
		input.step                 = '1';
		input.value                = String( Math.max( 1, Math.min( 4, col_count ) ) );
		input.dataset.inspectorKey = 'columns';

		let last_applied = parseInt( input.value, 10 );

		// Commit helper: apply immediately if value is valid; coerce to bounds.
		const commit = (raw) => {
			const v = parseInt( raw, 10 );
			if ( ! Number.isFinite( v ) ) {
				return false;
			}
			const clamped = window.WPBC_BFB_Core.WPBC_BFB_Sanitize.clamp( v, 1, 4 );
			if ( clamped !== last_applied ) {
				this.builder?.set_section_columns?.( section_el, clamped );
				last_applied = clamped;
				if ( String( clamped ) !== input.value ) {
					input.value = String( clamped );
				}
				// Re-render immediately so layout chips reflect the new count,
				// while preserving focus/caret.
				this._schedule_render_preserving_focus( 0 );
			}
			return true;
		};

		// Apply as you type if current text parses to a number (no pre-apply debounce).
		input.addEventListener( 'input', () => { commit( input.value ); } );
		// On commit/blur, always coerce to a valid value.
		input.addEventListener( 'change', () => {
			if ( ! commit( input.value ) ) {
				input.value = String( last_applied );
				this._schedule_render_preserving_focus( 0 );
			}
		} );
		input.addEventListener( 'blur', () => {
			if ( ! commit( input.value ) ) {
				input.value = String( last_applied );
			}
		} );
		input.addEventListener( 'keydown', (e) => {
			if ( e.key === 'Enter' ) {
				e.preventDefault();
				commit( input.value );
			}
		} );

		ctrlWrap.appendChild( input );
		rowEl.appendChild( label );
		rowEl.appendChild( ctrlWrap );
		fieldsWrap.appendChild( rowEl );


		// -----------------------------------------------------------------------------

		// LAYOUT CHIPS ROW.
		const layout_row     = document.createElement( 'div' );
		layout_row.className = 'inspector__row inspector__row--layout-chips';

		const layout_label       = document.createElement( 'label' );
		layout_label.className   = 'inspector__label';
		layout_label.textContent = 'Layout';

		const layout_ctrl     = document.createElement( 'div' );
		layout_ctrl.className = 'inspector__control wpbc_bfb__layout_chips';

		// REUSE the shared helper:.
		window.WPBC_BFB_UI.WPBC_BFB_Layout_Chips.render_for_section( this.builder, section_el, layout_ctrl );

		layout_row.appendChild( layout_label );
		layout_row.appendChild( layout_ctrl );
		fieldsWrap.appendChild( layout_row );

		// -----------------------------------------------------------------------------
		wrap.appendChild( fieldsWrap );
		body.appendChild( wrap );

		// Commit.
		this.panel.innerHTML = '';
		this.panel.appendChild( head );
		this.panel.appendChild( body );
		this._initial_render = false;
	}

}
// Expose the constructor for the builder bridge.
window.WPBC_BFB_Inspector = WPBC_BFB_Inspector;

// Tell the builder that the Inspector class is ready.
document.dispatchEvent( new Event( 'wpbc_bfb_inspector_ready' ) );