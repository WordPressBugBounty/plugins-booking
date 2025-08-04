// ---------------------------------------------------------------------------------------------------------------------
// == Working Script == Time point: 2025-07-31 20:29 !
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Main _wpbc_builder JS object
 */
var _wpbc_builder = (function (obj, $) {

	var p_panel_fields_lib_ul = obj.panel_fields_lib_ul = obj.panel_fields_lib_ul || document.getElementById( 'wpbc_bfb__panel_field_types__ul' );
	var p_pages_container     = obj.pages_container = obj.pages_container || document.getElementById( 'wpbc_bfb__pages_container' );
	var p_page_counter        = obj.page_counter = obj.page_counter || 0;
	var p_section_counter     = obj.section_counter = obj.section_counter || 0;
	var p_max_nested_value    = obj.max_nested_value = obj.max_nested_value || 5;
	var p_preview_mode        = obj.preview_mode = obj.preview_mode || true;   // Optional preview toggle. Can later be toggled by UI control.

	return obj;

}( _wpbc_builder || {}, jQuery ));

// =====================================================================================================================
// === Helper Functions ===
// =====================================================================================================================
function wpbc_bfb__create_element(tag, className = '', innerHTML = '') {
	const el = document.createElement( tag );
	if ( className ) el.className = className;
	if ( innerHTML ) el.innerHTML = innerHTML;
	return el;
}

function wpbc_bfb__set_data_attributes(el, dataObj) {

	Object.entries( dataObj ).forEach( ([ key, val ]) => {
		const value = (typeof val === 'object') ? JSON.stringify( val ) : val;
		el.setAttribute( 'data-' + key, value );
	} );
}

function wpbc_bfb__init_sortable(container, onAddCallback = wpbc_bfb__handle_on_add) {

	if ( !container ) {
		return;
	}

	Sortable.create( container, {
		group      : {
			name: 'form',
			pull: true,
			put : (to, from, draggedEl) => {
					return draggedEl.classList.contains( 'wpbc_bfb__field' ) || draggedEl.classList.contains( 'wpbc_bfb__section' );
				}
		},
		handle     : '.section-drag-handle, .wpbc_bfb__drag-handle',
		draggable  : '.wpbc_bfb__field, .wpbc_bfb__section',
		animation  : 150,
		onAdd      : onAddCallback,
		ghostClass : 'wpbc_bfb__drag-ghost',
		chosenClass: 'wpbc_bfb__highlight',
		dragClass  : 'wpbc_bfb__drag-active',
		onStart    : function () { document.querySelectorAll( '.wpbc_bfb__column' ).forEach( col => col.classList.add( 'wpbc_bfb__dragging' ) ); },
		onEnd      : function () { document.querySelectorAll( '.wpbc_bfb__column' ).forEach( col => col.classList.remove( 'wpbc_bfb__dragging' ) ); }
	} );
}

/**
 * Add drag handle
 *
 * @param el
 * @param className
 */
function wpbc_bfb__add_drag_handle(el, className = 'wpbc_bfb__drag-handle') {
	if ( el.querySelector( '.' + className ) ) return;
	const handle = wpbc_bfb__create_element( 'span', className, '<span class="wpbc_icn_drag_indicator"></span>' );
	el.prepend( handle );
}

function wpbc_bfb__add_remove_btn(el, callback) {

	if ( el.querySelector( '.wpbc_bfb__field-remove-btn' ) ) return;
	const btn   = wpbc_bfb__create_element(
		'button',
		'wpbc_bfb__field-remove-btn',
		'<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>'
	);
	btn.title   = 'Remove field';
	btn.type    = 'button';
	btn.onclick = callback;
	el.appendChild( btn );
}

function wpbc_bfb__add_field_move_buttons(fieldEl) {
	if ( !fieldEl.querySelector( '.wpbc_bfb__field-move-up' ) ) {
		const upBtn   = wpbc_bfb__create_element( 'button', 'wpbc_bfb__field-move-up', '<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>' );
		upBtn.title   = 'Move field up';
		upBtn.type    = 'button';
		upBtn.onclick = e => { e.preventDefault(); wpbc_bfb__move_item( fieldEl, 'up' ); };
		// upBtn.onclick = e => { e.preventDefault(); wpbc_bfb__move_field( fieldEl, 'up' ); };
		fieldEl.appendChild( upBtn );
	}

	if ( !fieldEl.querySelector( '.wpbc_bfb__field-move-down' ) ) {
		const downBtn   = wpbc_bfb__create_element( 'button', 'wpbc_bfb__field-move-down', '<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>' );
		downBtn.title   = 'Move field down';
		downBtn.type    = 'button';
		downBtn.onclick = e => { e.preventDefault(); wpbc_bfb__move_item( fieldEl, 'down' ); };
		// downBtn.onclick = e => { e.preventDefault(); wpbc_bfb__move_field( fieldEl, 'down' ); };
		fieldEl.appendChild( downBtn );
	}
}

// === Enhanced Preview Rendering Support ===
function wpbc_bfb__decorate_field_preview(fieldEl) {
	if ( !fieldEl || !_wpbc_builder.preview_mode ) return;

	const data = wpbc_bfb__get_all_data_attributes( fieldEl );

	const fieldType  = data.type;
	const fieldId    = data.id || '';
	const fieldLabel = data.label || fieldId;

	let inputHTML = '';

	switch ( fieldType ) {
		case 'text':
		case 'tel':
		case 'email':
		case 'number':
			inputHTML = `<input type="${fieldType}" placeholder="${fieldLabel}" class="wpbc_bfb__preview-input" />`;
			break;

		case 'textarea':
			inputHTML = `<textarea placeholder="${fieldLabel}" class="wpbc_bfb__preview-textarea"></textarea>`;
			break;

		case 'checkbox':
			inputHTML = `<label><input type="checkbox" /> ${fieldLabel}</label>`;
			break;

		case 'radio':
			inputHTML = `
				<label><input type="radio" name="${fieldId}" /> Option 1</label><br>
				<label><input type="radio" name="${fieldId}" /> Option 2</label>
			`;
			break;

		case 'selectbox':
			inputHTML = `
				<select class="wpbc_bfb__preview-select">
					<option>${fieldLabel} 1</option>
					<option>${fieldLabel} 2</option>
				</select>
			`;
			break;

		case 'calendar':
			inputHTML = `<input type="text" class="wpbc_bfb__preview-calendar" placeholder="Select Date" />`;
			break;

		case 'timeslots':
			inputHTML = `<select class="wpbc_bfb__preview-select">
				<option>09:00 – 10:00</option>
				<option>10:00 – 11:00</option>
			</select>`;
			break;

		case 'costhint':
			inputHTML = `<span class="wpbc_bfb__preview-costhint">€ 99.00</span>`;
			break;

		default:
			inputHTML = `
				<span class="wpbc_bfb__field-label">${fieldLabel}</span>
				<span class="wpbc_bfb__field-type">${fieldType}</span>
			`;
	}

	// Replace innerHTML but preserve data attributes
	fieldEl.innerHTML = inputHTML;
	fieldEl.classList.add( 'wpbc_bfb__preview-rendered' );

	// Add drag and remove controls.
	wpbc_bfb__add_drag_handle( fieldEl );
	wpbc_bfb__add_remove_btn( fieldEl, () => {
		fieldEl.remove();
		wpbc_bfb__panel_fields_lib__usage_limits_update();
	} );

	// Add field up/down buttons.
	wpbc_bfb__add_field_move_buttons(fieldEl)
}




// =====================================================================================================================
// === Add a new page ===
function wpbc_bfb__add_page() {

	const pageEl = wpbc_bfb__create_element('div', 'wpbc_bfb__panel wpbc_bfb__panel--preview');
	pageEl.setAttribute( 'data-page', ++_wpbc_builder.page_counter );

	pageEl.innerHTML        = `
		<h3>Page ${_wpbc_builder.page_counter}</h3>
		<div class="wpbc_bfb__controls">
			<label>Add Section:</label>
			<select class="wpbc_bfb__section-columns">
				<option value="1">1 Column</option>
				<option value="2">2 Columns</option>
				<option value="3">3 Columns</option>
				<option value="4">4 Columns</option>
			</select>
			<button class="button wpbc_bfb__add_section_btn">Add Section</button>
		</div>
		<div class="wpbc_bfb__form_preview_section_container wpbc_container wpbc_form wpbc_container_booking_form"></div>
	`;

	const deletePageBtn = wpbc_bfb__create_element( 'a', 'wpbc_bfb__field-remove-btn', '<i class="menu_icon icon-1x wpbc_icn_close"></i>' );
	deletePageBtn.onclick   = () => {
		pageEl.remove();
		wpbc_bfb__panel_fields_lib__usage_limits_update();
	};

	pageEl.querySelector( 'h3' ).appendChild( deletePageBtn );
	_wpbc_builder.pages_container.appendChild( pageEl );

	const sectionContainer = pageEl.querySelector( '.wpbc_bfb__form_preview_section_container' );

	wpbc_bfb__init_section_sortable( sectionContainer );

	wpbc_bfb__form_preview_section__add_to_container( sectionContainer, 1 );

	pageEl.querySelector( '.wpbc_bfb__add_section_btn' ).addEventListener( 'click', function (e) {
		e.preventDefault();
		const select = pageEl.querySelector( '.wpbc_bfb__section-columns' );
		const cols   = parseInt( select.value, 10 );
		wpbc_bfb__form_preview_section__add_to_container( sectionContainer, cols );
	} );
}

function wpbc_bfb__init_section_sortable(container) {

	// Allow sorting of sections at top level (section container) or nested inside columns.
	const isColumn       = container.classList.contains( 'wpbc_bfb__column' );
	const isTopContainer = container.classList.contains( 'wpbc_bfb__form_preview_section_container' );

	if ( !isColumn && !isTopContainer ) return;

	wpbc_bfb__init_sortable( container );
}

function wpbc_bfb__form_preview_section__add_to_container(container, cols) {

	const section = wpbc_bfb__create_element( 'div', 'wpbc_bfb__section' );
	section.setAttribute( 'data-id', 'section-' + (++_wpbc_builder.section_counter) + '-' + Date.now() );

	const header = wpbc_bfb__create_element( 'div', 'wpbc_bfb__section-header' );
	const title  = wpbc_bfb__create_element( 'div', 'wpbc_bfb__section-title' );

	const dragHandle = wpbc_bfb__create_element( 'span', 'wpbc_bfb__drag-handle section-drag-handle', '<span class="wpbc_icn_drag_indicator wpbc_icn_rotate_90"></span>' );

	title.appendChild( dragHandle );

	// Up Btn.
	const moveUpBtn   = wpbc_bfb__create_element( 'button', 'wpbc_bfb__section-move-up', '<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>' );
	moveUpBtn.title   = 'Move section up';
	moveUpBtn.type    = 'button';
	moveUpBtn.onclick = function (e) { e.preventDefault(); wpbc_bfb__move_item( section, 'up' ); };
	// moveUpBtn.onclick = function (e) { e.preventDefault(); wpbc_bfb__move_section( section, 'up' ); };

	// Down Btn.
	const moveDownBtn   = wpbc_bfb__create_element( 'button', 'wpbc_bfb__section-move-down', '<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>' );
	moveDownBtn.title   = 'Move section down';
	moveDownBtn.type    = 'button';
	moveDownBtn.onclick = function (e) { e.preventDefault(); wpbc_bfb__move_item( section, 'down' ); };
	//moveDownBtn.onclick = function (e) { e.preventDefault(); wpbc_bfb__move_section( section, 'down' ); };

	title.appendChild( moveUpBtn );
	title.appendChild( moveDownBtn );

	// Remove Btn.
	const removeBtn   = wpbc_bfb__create_element( 'button', 'wpbc_bfb__field-remove-btn', '<i class="menu_icon icon-1x wpbc_icn_close"></i>' );
	removeBtn.title   = 'Remove section';
	removeBtn.type    = 'button';
	removeBtn.onclick = function (e) { e.preventDefault(); section.remove(); wpbc_bfb__panel_fields_lib__usage_limits_update(); };

	header.appendChild( title );
	header.appendChild( removeBtn );
	section.appendChild( header );

	const row     = document.createElement( 'div' );
	row.className = 'wpbc_bfb__row';

	for ( let i = 0; i < cols; i++ ) {

		const col           = wpbc_bfb__create_element( 'ul', 'wpbc_bfb__column' );
		col.style.flexBasis = (100 / cols) + '%';
		wpbc_bfb__init_sortable( col );

		row.appendChild( col );
		if ( i < cols - 1 ) {
			const resizer = wpbc_bfb__create_element( 'div', 'wpbc_bfb__column-resizer' );
			resizer.addEventListener( 'mousedown', wpbc_bfb__form_preview_section__init_resize );
			row.appendChild( resizer );
		}
	}

	section.appendChild( row );
	container.appendChild( section );

	// Important: enable nesting drag on this new section as well
	wpbc_bfb__init_section_sortable( section );
}

// Update wpbc_bfb__rebuild_section to support nesting.
function wpbc_bfb__rebuild_section(sectionData, container) {

	wpbc_bfb__form_preview_section__add_to_container( container, sectionData.columns.length );
	const section = container.lastElementChild;
	section.setAttribute( 'data-id', sectionData.id || ('section-' + (++_wpbc_builder.section_counter) + '-' + Date.now()) );

	const row = section.querySelector( '.wpbc_bfb__row' );

	sectionData.columns.forEach( (colData, index) => {
		const col           = row.children[index * 2];
		col.style.flexBasis = colData.width || '100%';

		colData.fields.forEach( field => {

			const el = wpbc_bfb__create_element( 'li', 'wpbc_bfb__field' );
			wpbc_bfb__set_data_attributes( el, field );

			el.innerHTML = wpbc_bfb__render_field_inner_html( field );

			wpbc_bfb__decorate_field( el );
			col.appendChild( el );
			wpbc_bfb__panel_fields_lib__usage_limits_update();
		} );

		(colData.sections || []).forEach( nested => {
			wpbc_bfb__rebuild_section( nested, col );
		} );
	} );

	// Important: enable sorting for this rebuilt section too
	//wpbc_bfb__init_section_sortable(section);
	wpbc_bfb__init_all_nested_sections( section );
}

// == recursive initialization of nested Sortables: ==
function wpbc_bfb__init_all_nested_sections(container) {
	// Also initialize the container itself if needed.
	if ( container.classList.contains( 'wpbc_bfb__form_preview_section_container' ) ) {
		wpbc_bfb__init_section_sortable( container );
	}

	const allSections = container.querySelectorAll( '.wpbc_bfb__section' );
	allSections.forEach( section => {
		// Find each column inside the section.
		const columns = section.querySelectorAll( '.wpbc_bfb__column' );
		columns.forEach( col => wpbc_bfb__init_section_sortable( col ) );
	} );
}

function wpbc_bfb__handle_on_add(evt) {

	if ( !evt || !evt.item ) return;

	// === If dropped item is a FIELD ===
	let newItem    = evt.item;
	const isCloned = evt.from.id === 'wpbc_bfb__panel_field_types__ul';
	const fieldId  = newItem.dataset.id;
	if ( !fieldId ) return;
	const usageLimit = parseInt( newItem.dataset.usagenumber || Infinity, 10 );

	if ( isCloned ) {
		const fieldData = wpbc_bfb__get_all_data_attributes( newItem );
		evt.item.remove();
		const rebuiltField = wpbc_bfb__build_field( fieldData );
		evt.to.insertBefore( rebuiltField, evt.to.children[evt.newIndex] );
		newItem = rebuiltField;
	}

	const allUsed = document.querySelectorAll( `.wpbc_bfb__panel--preview .wpbc_bfb__field[data-id="${fieldId}"]` );
	if ( allUsed.length > usageLimit ) {
		alert( `Only ${usageLimit} instance${usageLimit > 1 ? 's' : ''} of "${fieldId}" allowed.` );
		newItem.remove();
		return;
	}

	if ( newItem.classList.contains( 'wpbc_bfb__section' ) ) {
		const nestingLevel = wpbc_bfb__get_nesting_level( newItem );
		if ( nestingLevel >= _wpbc_builder.max_nested_value ) {
			alert( 'Too many nested sections.' );
			newItem.remove();
			return;
		}
	}
	// Add this line right after usage check:.
	wpbc_bfb__decorate_field( newItem );

	wpbc_bfb__panel_fields_lib__usage_limits_update();

	// If this is a newly added section, initialize sortable inside it.
	if ( newItem.classList.contains( 'wpbc_bfb__section' ) ) {
		wpbc_bfb__init_section_sortable( newItem );
	}
}

function wpbc_bfb__build_field(fieldData) {

	const el = wpbc_bfb__create_element( 'li', 'wpbc_bfb__field' );
	wpbc_bfb__set_data_attributes( el, fieldData );

	el.innerHTML = wpbc_bfb__render_field_inner_html( fieldData );

	wpbc_bfb__decorate_field( el );
	return el;
}

function wpbc_bfb__render_field_inner_html(fieldData) {
	const label      = String( fieldData.label || fieldData.id || '(no label)' );
	const type       = String( fieldData.type || 'unknown' );
	const isRequired = fieldData.required === true || fieldData.required === 'true';

	return `
		<span class="wpbc_bfb__field-label">${label}${isRequired ? ' *' : ''}</span>
		<span class="wpbc_bfb__field-type">${type}</span>
	`;
}


function wpbc_bfb__get_nesting_level(sectionEl) {
	let level  = 0;
	let parent = sectionEl.closest( '.wpbc_bfb__column' );

	while ( parent ) {
		const outerSection = parent.closest( '.wpbc_bfb__section' );
		if ( !outerSection ) break;
		level++;
		parent = outerSection.closest( '.wpbc_bfb__column' );
	}
	return level;
}

function wpbc_bfb__decorate_field(fieldEl) {

	if ( ! fieldEl ) {
		return;
	}
	if ( fieldEl.classList.contains( 'wpbc_bfb__section' ) ) {
		return;
	}

	fieldEl.classList.add( 'wpbc_bfb__field' );

	if ( _wpbc_builder.preview_mode ) {
		wpbc_bfb__decorate_field_preview( fieldEl );
	} else {
		wpbc_bfb__add_drag_handle( fieldEl );
		wpbc_bfb__add_remove_btn( fieldEl, () => {
			fieldEl.remove();
			wpbc_bfb__panel_fields_lib__usage_limits_update();
		} );
		wpbc_bfb__add_field_move_buttons( fieldEl );
	}
}

// === Move item (section  or field)  up/down within its container ===
function wpbc_bfb__move_item(el, direction) {
	const container = el.parentElement;
	if ( !container ) return;

	const siblings = Array.from( container.children ).filter( child =>
		child.classList.contains( 'wpbc_bfb__field' ) || child.classList.contains( 'wpbc_bfb__section' )
	);

	const currentIndex = siblings.indexOf( el );
	if ( currentIndex === -1 ) return;

	const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
	if ( newIndex < 0 || newIndex >= siblings.length ) return;

	const referenceNode = siblings[newIndex];
	if ( direction === 'up' ) {
		container.insertBefore( el, referenceNode );
	} else {
		container.insertBefore( referenceNode, el );
	}
}

	// === Deprecated: Move section up/down within its container ===
	function wpbc_bfb__move_section(sectionEl, direction) {
		const container = sectionEl.parentElement;
		if ( !container ) return;

		// Only direct children that are .wpbc_bfb__section
		const allSections = Array.from( container.children ).filter( child =>
			child.classList.contains( 'wpbc_bfb__section' )
		);

		const currentIndex = allSections.indexOf( sectionEl );
		if ( currentIndex === -1 ) return;

		const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
		if ( newIndex < 0 || newIndex >= allSections.length ) return;

		const referenceNode = allSections[newIndex];
		if ( direction === 'up' ) {
			container.insertBefore( sectionEl, referenceNode );
		} else {
			container.insertBefore( referenceNode, sectionEl );
		}
	}

	// === Deprecated: Move field up/down within its container ===
	function wpbc_bfb__move_field(fieldEl, direction) {
		const parent = fieldEl.parentElement;
		if ( !parent ) return;

		// Only direct children that are fields
		const fields = Array.from(parent.children).filter(child =>
			child.classList.contains('wpbc_bfb__field') && !child.classList.contains('wpbc_bfb__section')
		);

		const index = fields.indexOf(fieldEl);
		if (index === -1) return;

		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= fields.length) return;

		const reference = fields[newIndex];
		if (direction === 'up') {
			parent.insertBefore(fieldEl, reference);
		} else {
			parent.insertBefore(reference, fieldEl);
		}
	}


// === Field usage limit updater ===
function wpbc_bfb__panel_fields_lib__usage_limits_update() {
	const allUsedFields = document.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field' );
	const usageCount    = {};

	allUsedFields.forEach( field => {
		const id       = field.dataset.id;
		usageCount[id] = (usageCount[id] || 0) + 1;
	} );

	if ( null !== _wpbc_builder.panel_fields_lib_ul ) {
		_wpbc_builder.panel_fields_lib_ul.querySelectorAll( '.wpbc_bfb__field' ).forEach( panelField => {
			const id                       = panelField.dataset.id;
			const limit                    = parseInt( panelField.dataset.usagenumber || Infinity, 10 );
			const current                  = usageCount[id] || 0;
			panelField.style.pointerEvents = current >= limit ? 'none' : '';
			panelField.style.opacity       = current >= limit ? '0.4' : '';
		} );
	}
}

// === Column resizing logic ===
function wpbc_bfb__form_preview_section__init_resize(e) {
	const resizer    = e.target;
	const leftCol    = resizer.previousElementSibling;
	const rightCol   = resizer.nextElementSibling;
	const startX     = e.clientX;
	const leftWidth  = leftCol.offsetWidth;
	const rightWidth = rightCol.offsetWidth;
	const totalWidth = leftWidth + rightWidth;

	if ( !leftCol || !rightCol || !leftCol.classList.contains( 'wpbc_bfb__column' ) || !rightCol.classList.contains( 'wpbc_bfb__column' ) ) {
		return;
	}

	function onMouseMove(e) {
		const delta      = e.clientX - startX;
		let leftPercent  = ((leftWidth + delta) / totalWidth) * 100;
		let rightPercent = ((rightWidth - delta) / totalWidth) * 100;
		if ( leftPercent < 5 || rightPercent < 5 ) return;
		leftCol.style.flexBasis  = `${leftPercent}%`;
		rightCol.style.flexBasis = `${rightPercent}%`;
	}

	function onMouseUp() {
		document.removeEventListener( 'mousemove', onMouseMove );
		document.removeEventListener( 'mouseup', onMouseUp );
	}

	document.addEventListener( 'mousemove', onMouseMove );
	document.addEventListener( 'mouseup', onMouseUp );
}

function wpbc_bfb__get_form_structure() {
	const pages = [];

	document.querySelectorAll( '.wpbc_bfb__panel--preview' ).forEach( (pageEl, pageIndex) => {

		const container = pageEl.querySelector( '.wpbc_bfb__form_preview_section_container' );

		const sections    = [];
		const looseFields = [];

		const orderedElements = [];

		container.querySelectorAll( ':scope > *' ).forEach( child => {
			if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
				orderedElements.push( {
					type: 'section',
					data: wpbc_bfb__serialize_section( child )
				} );
			} else if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
				orderedElements.push( {
					type: 'field',
					data: wpbc_bfb__get_all_data_attributes( child )
				} );
			}
		} );

		pages.push( {
			page   : pageIndex + 1,
			content: orderedElements
		} );

	} );

	return pages;
}

function wpbc_bfb__serialize_section(sectionEl) {
	const row     = sectionEl.querySelector( ':scope > .wpbc_bfb__row' );
	const columns = [];

	if ( !row ) return { id: sectionEl.dataset.id, columns: [] };

	row.querySelectorAll( ':scope > .wpbc_bfb__column' ).forEach( col => {
		const width    = col.style.flexBasis || '100%';
		const fields   = [];
		const sections = [];

		// Loop through direct children of the column.
		Array.from( col.children ).forEach( child => {
			if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
				// Recurse into nested section.
				sections.push( wpbc_bfb__serialize_section( child ) );
			} else if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
				// Only serialize real fields.
				fields.push( wpbc_bfb__get_all_data_attributes( child ) );
			}
		} );

		columns.push( { width, fields, sections } );
	} );

	return {
		id: sectionEl.dataset.id,
		columns
	};
}

function wpbc_bfb__get_all_data_attributes(el) {
	const data = {};
	if ( !el || !el.attributes ) return data;

	Array.from( el.attributes ).forEach( attr => {
		if ( attr.name.startsWith( 'data-' ) ) {
			const key = attr.name.replace( /^data-/, '' );
			try {
				data[key] = JSON.parse( attr.value );
			} catch ( e ) {
				data[key] = attr.value;
			}
		}
	} );

	if ( !data.label && data.id ) {
		data.label = data.id.charAt( 0 ).toUpperCase() + data.id.slice( 1 );
	}
	return data;
}

function wpbc_bfb__load_saved_structure(structure) {
	_wpbc_builder.pages_container.innerHTML = '';
	_wpbc_builder.page_counter              = 0;

	structure.forEach( pageData => {
		wpbc_bfb__add_page(); // increments _wpbc_builder.page_counter
		const pageEl           = _wpbc_builder.pages_container.querySelector( `.wpbc_bfb__panel--preview[data-page="${_wpbc_builder.page_counter}"]` );
		const sectionContainer = pageEl.querySelector( '.wpbc_bfb__form_preview_section_container' );

		sectionContainer.innerHTML = ''; // remove default section.
		wpbc_bfb__init_section_sortable( sectionContainer ); // Initialize top-level sorting

		(pageData.content || []).forEach( item => {
			if ( item.type === 'section' ) {
				wpbc_bfb__rebuild_section( item.data, sectionContainer );
			} else if ( item.type === 'field' ) {

				const el = wpbc_bfb__create_element( 'li', 'wpbc_bfb__field' );
				wpbc_bfb__set_data_attributes( el, item.data );
				el.innerHTML = wpbc_bfb__render_field_inner_html( item.data );

				wpbc_bfb__decorate_field( el );
				sectionContainer.appendChild( el );
			}
		} );

	} );

	wpbc_bfb__panel_fields_lib__usage_limits_update();
}

// === Init Sortable on the Field Palette ===
if ( null !== _wpbc_builder.panel_fields_lib_ul ) {
	Sortable.create( _wpbc_builder.panel_fields_lib_ul, {
		group      : { name: 'form', pull: 'clone', put: false },
		animation  : 150,
		ghostClass : 'wpbc_bfb__drag-ghost',
		chosenClass: 'wpbc_bfb__highlight',
		dragClass  : 'wpbc_bfb__drag-active',
		sort       : false,
		onStart    : function () { document.querySelectorAll( '.wpbc_bfb__column' ).forEach( col => col.classList.add( 'wpbc_bfb__dragging' ) ); },
		onEnd      : function () { document.querySelectorAll( '.wpbc_bfb__column' ).forEach( col => col.classList.remove( 'wpbc_bfb__dragging' ) ); }
	} );
} else {
	console.log( 'WPBC Warning!  Form fields pallete not defined.' );
}

document.getElementById( 'wpbc_bfb__save_btn' ).addEventListener( 'click', function (e) {

	e.preventDefault(); // Stop page reload.

	const structure = wpbc_bfb__get_form_structure();
	console.log( JSON.stringify( structure, null, 2 ) ); // Or save via AJAX.


	// console.log( 'Loaded JSON:', JSON.stringify( wpbc_bfb__form_structure__get_example(), null, 2 ) );
	// console.log( 'Saved JSON:', JSON.stringify( wpbc_bfb__get_form_structure(), null, 2 ) );

	// Custom event for communication (e.g. Elementor preview mode).
	const event = new CustomEvent( 'wpbc_bfb_form_updated', { detail: structure } );
	document.dispatchEvent( event );

	// Example: send to server.
	// wpbc_ajax_save_form(structure);
} );

// === Initialize default first page ===
window.addEventListener( 'DOMContentLoaded', () => {

	// Standard Initilizing one page.
	//	 wpbc_bfb__add_page(); return;

	// Load your saved form structure here:.
	const savedStructure = wpbc_bfb__form_structure__get_example();  // [ /* your JSON structure from earlier */ ];.
	wpbc_bfb__load_saved_structure( savedStructure );
} );

if ( null !== document.getElementById( 'wpbc_bfb__toggle_preview' ) ) {
	document.getElementById( 'wpbc_bfb__toggle_preview' ).addEventListener( 'change', function () {
		_wpbc_builder.preview_mode = this.checked;
		wpbc_bfb__load_saved_structure( wpbc_bfb__get_form_structure() ); // Re-render
	} );
}
// Manual fix: remove incorrect `.wpbc_bfb__field` from section elements (if any)
// document.querySelectorAll('.wpbc_bfb__section.wpbc_bfb__field').forEach(el => { el.classList.remove('wpbc_bfb__field'); });  //.


function wpbc_bfb__form_structure__get_example() {
	return [
  {
    "page": 1,
    "content": [
      {
        "type": "section",
        "data": {
          "id": "section-7-1754079405442",
          "columns": [
            {
              "width": "19.0205%",
              "fields": [
                {
                  "id": "selectbox",
                  "type": "selectbox",
                  "label": "Choose Item",
                  "placeholder": "Please select",
                  "options": [
                    "One",
                    "Two",
                    "Three"
                  ],
                  "required": true
                }
              ],
              "sections": []
            },
            {
              "width": "80.9795%",
              "fields": [],
              "sections": [
                {
                  "id": "section-8-1754079445784",
                  "columns": [
                    {
                      "width": "50%",
                      "fields": [
                        {
                          "id": "calendar",
                          "type": "calendar",
                          "usagenumber": 1,
                          "label": "Calendar"
                        }
                      ],
                      "sections": []
                    },
                    {
                      "width": "50%",
                      "fields": [
                        {
                          "id": "rangetime",
                          "type": "timeslots",
                          "usagenumber": 1,
                          "label": "Rangetime"
                        }
                      ],
                      "sections": []
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        "type": "field",
        "data": {
          "id": "costhint",
          "type": "costhint",
          "label": "Costhint"
        }
      }
    ]
  },
  {
    "page": 2,
    "content": [
      {
        "type": "section",
        "data": {
          "id": "section-11-1754079499494",
          "columns": [
            {
              "width": "50%",
              "fields": [
                {
                  "id": "input-text",
                  "type": "text",
                  "label": "Input-text"
                }
              ],
              "sections": []
            },
            {
              "width": "50%",
              "fields": [
                {
                  "id": "input-text",
                  "type": "text",
                  "label": "Input-text"
                }
              ],
              "sections": []
            }
          ]
        }
      },
      {
        "type": "field",
        "data": {
          "id": "textarea",
          "type": "textarea",
          "label": "Textarea"
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-10-1754079492260",
          "columns": [
            {
              "width": "100%",
              "fields": [],
              "sections": []
            }
          ]
        }
      }
    ]
  }
];

}