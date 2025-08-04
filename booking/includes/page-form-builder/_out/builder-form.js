"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
// ---------------------------------------------------------------------------------------------------------------------
// == Working Script == Time point: 2025-07-31 20:29 !
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Main _wpbc_builder JS object
 */
var _wpbc_builder = function (obj, $) {
  var p_panel_fields_lib_ul = obj.panel_fields_lib_ul = obj.panel_fields_lib_ul || document.getElementById('wpbc_bfb__panel_field_types__ul');
  var p_pages_container = obj.pages_container = obj.pages_container || document.getElementById('wpbc_bfb__pages_container');
  var p_page_counter = obj.page_counter = obj.page_counter || 0;
  var p_section_counter = obj.section_counter = obj.section_counter || 0;
  var p_max_nested_value = obj.max_nested_value = obj.max_nested_value || 5;
  var p_preview_mode = obj.preview_mode = obj.preview_mode || true; // Optional preview toggle. Can later be toggled by UI control.

  return obj;
}(_wpbc_builder || {}, jQuery);

// =====================================================================================================================
// === Helper Functions ===
// =====================================================================================================================
function wpbc_bfb__create_element(tag) {
  var className = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var innerHTML = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}
function wpbc_bfb__set_data_attributes(el, dataObj) {
  Object.entries(dataObj).forEach(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
      key = _ref2[0],
      val = _ref2[1];
    var value = _typeof(val) === 'object' ? JSON.stringify(val) : val;
    el.setAttribute('data-' + key, value);
  });
}
function wpbc_bfb__init_sortable(container) {
  var onAddCallback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : wpbc_bfb__handle_on_add;
  if (!container) {
    return;
  }
  Sortable.create(container, {
    group: {
      name: 'form',
      pull: true,
      put: function put(to, from, draggedEl) {
        return draggedEl.classList.contains('wpbc_bfb__field') || draggedEl.classList.contains('wpbc_bfb__section');
      }
    },
    handle: '.section-drag-handle, .wpbc_bfb__drag-handle',
    draggable: '.wpbc_bfb__field, .wpbc_bfb__section',
    animation: 150,
    onAdd: onAddCallback,
    ghostClass: 'wpbc_bfb__drag-ghost',
    chosenClass: 'wpbc_bfb__highlight',
    dragClass: 'wpbc_bfb__drag-active',
    onStart: function onStart() {
      document.querySelectorAll('.wpbc_bfb__column').forEach(function (col) {
        return col.classList.add('wpbc_bfb__dragging');
      });
    },
    onEnd: function onEnd() {
      document.querySelectorAll('.wpbc_bfb__column').forEach(function (col) {
        return col.classList.remove('wpbc_bfb__dragging');
      });
    }
  });
}

/**
 * Add drag handle
 *
 * @param el
 * @param className
 */
function wpbc_bfb__add_drag_handle(el) {
  var className = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'wpbc_bfb__drag-handle';
  if (el.querySelector('.' + className)) return;
  var handle = wpbc_bfb__create_element('span', className, '<span class="wpbc_icn_drag_indicator"></span>');
  el.prepend(handle);
}
function wpbc_bfb__add_remove_btn(el, callback) {
  if (el.querySelector('.wpbc_bfb__field-remove-btn')) return;
  var btn = wpbc_bfb__create_element('button', 'wpbc_bfb__field-remove-btn', '<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>');
  btn.title = 'Remove field';
  btn.type = 'button';
  btn.onclick = callback;
  el.appendChild(btn);
}
function wpbc_bfb__add_field_move_buttons(fieldEl) {
  if (!fieldEl.querySelector('.wpbc_bfb__field-move-up')) {
    var upBtn = wpbc_bfb__create_element('button', 'wpbc_bfb__field-move-up', '<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>');
    upBtn.title = 'Move field up';
    upBtn.type = 'button';
    upBtn.onclick = function (e) {
      e.preventDefault();
      wpbc_bfb__move_item(fieldEl, 'up');
    };
    // upBtn.onclick = e => { e.preventDefault(); wpbc_bfb__move_field( fieldEl, 'up' ); };
    fieldEl.appendChild(upBtn);
  }
  if (!fieldEl.querySelector('.wpbc_bfb__field-move-down')) {
    var downBtn = wpbc_bfb__create_element('button', 'wpbc_bfb__field-move-down', '<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>');
    downBtn.title = 'Move field down';
    downBtn.type = 'button';
    downBtn.onclick = function (e) {
      e.preventDefault();
      wpbc_bfb__move_item(fieldEl, 'down');
    };
    // downBtn.onclick = e => { e.preventDefault(); wpbc_bfb__move_field( fieldEl, 'down' ); };
    fieldEl.appendChild(downBtn);
  }
}

// === Enhanced Preview Rendering Support ===
function wpbc_bfb__decorate_field_preview(fieldEl) {
  if (!fieldEl || !_wpbc_builder.preview_mode) return;
  var data = wpbc_bfb__get_all_data_attributes(fieldEl);
  var fieldType = data.type;
  var fieldId = data.id || '';
  var fieldLabel = data.label || fieldId;
  var inputHTML = '';
  switch (fieldType) {
    case 'text':
    case 'tel':
    case 'email':
    case 'number':
      inputHTML = "<input type=\"".concat(fieldType, "\" placeholder=\"").concat(fieldLabel, "\" class=\"wpbc_bfb__preview-input\" />");
      break;
    case 'textarea':
      inputHTML = "<textarea placeholder=\"".concat(fieldLabel, "\" class=\"wpbc_bfb__preview-textarea\"></textarea>");
      break;
    case 'checkbox':
      inputHTML = "<label><input type=\"checkbox\" /> ".concat(fieldLabel, "</label>");
      break;
    case 'radio':
      inputHTML = "\n\t\t\t\t<label><input type=\"radio\" name=\"".concat(fieldId, "\" /> Option 1</label><br>\n\t\t\t\t<label><input type=\"radio\" name=\"").concat(fieldId, "\" /> Option 2</label>\n\t\t\t");
      break;
    case 'selectbox':
      inputHTML = "\n\t\t\t\t<select class=\"wpbc_bfb__preview-select\">\n\t\t\t\t\t<option>".concat(fieldLabel, " 1</option>\n\t\t\t\t\t<option>").concat(fieldLabel, " 2</option>\n\t\t\t\t</select>\n\t\t\t");
      break;
    case 'calendar':
      inputHTML = "<input type=\"text\" class=\"wpbc_bfb__preview-calendar\" placeholder=\"Select Date\" />";
      break;
    case 'timeslots':
      inputHTML = "<select class=\"wpbc_bfb__preview-select\">\n\t\t\t\t<option>09:00 \u2013 10:00</option>\n\t\t\t\t<option>10:00 \u2013 11:00</option>\n\t\t\t</select>";
      break;
    case 'costhint':
      inputHTML = "<span class=\"wpbc_bfb__preview-costhint\">\u20AC 99.00</span>";
      break;
    default:
      inputHTML = "\n\t\t\t\t<span class=\"wpbc_bfb__field-label\">".concat(fieldLabel, "</span>\n\t\t\t\t<span class=\"wpbc_bfb__field-type\">").concat(fieldType, "</span>\n\t\t\t");
  }

  // Replace innerHTML but preserve data attributes
  fieldEl.innerHTML = inputHTML;
  fieldEl.classList.add('wpbc_bfb__preview-rendered');

  // Add drag and remove controls.
  wpbc_bfb__add_drag_handle(fieldEl);
  wpbc_bfb__add_remove_btn(fieldEl, function () {
    fieldEl.remove();
    wpbc_bfb__panel_fields_lib__usage_limits_update();
  });

  // Add field up/down buttons.
  wpbc_bfb__add_field_move_buttons(fieldEl);
}

// =====================================================================================================================
// === Add a new page ===
function wpbc_bfb__add_page() {
  var pageEl = wpbc_bfb__create_element('div', 'wpbc_bfb__panel wpbc_bfb__panel--preview');
  pageEl.setAttribute('data-page', ++_wpbc_builder.page_counter);
  pageEl.innerHTML = "\n\t\t<h3>Page ".concat(_wpbc_builder.page_counter, "</h3>\n\t\t<div class=\"wpbc_bfb__controls\">\n\t\t\t<label>Add Section:</label>\n\t\t\t<select class=\"wpbc_bfb__section-columns\">\n\t\t\t\t<option value=\"1\">1 Column</option>\n\t\t\t\t<option value=\"2\">2 Columns</option>\n\t\t\t\t<option value=\"3\">3 Columns</option>\n\t\t\t\t<option value=\"4\">4 Columns</option>\n\t\t\t</select>\n\t\t\t<button class=\"button wpbc_bfb__add_section_btn\">Add Section</button>\n\t\t</div>\n\t\t<div class=\"wpbc_bfb__form_preview_section_container wpbc_container wpbc_form wpbc_container_booking_form\"></div>\n\t");
  var deletePageBtn = wpbc_bfb__create_element('a', 'wpbc_bfb__field-remove-btn', '<i class="menu_icon icon-1x wpbc_icn_close"></i>');
  deletePageBtn.onclick = function () {
    pageEl.remove();
    wpbc_bfb__panel_fields_lib__usage_limits_update();
  };
  pageEl.querySelector('h3').appendChild(deletePageBtn);
  _wpbc_builder.pages_container.appendChild(pageEl);
  var sectionContainer = pageEl.querySelector('.wpbc_bfb__form_preview_section_container');
  wpbc_bfb__init_section_sortable(sectionContainer);
  wpbc_bfb__form_preview_section__add_to_container(sectionContainer, 1);
  pageEl.querySelector('.wpbc_bfb__add_section_btn').addEventListener('click', function (e) {
    e.preventDefault();
    var select = pageEl.querySelector('.wpbc_bfb__section-columns');
    var cols = parseInt(select.value, 10);
    wpbc_bfb__form_preview_section__add_to_container(sectionContainer, cols);
  });
}
function wpbc_bfb__init_section_sortable(container) {
  // Allow sorting of sections at top level (section container) or nested inside columns.
  var isColumn = container.classList.contains('wpbc_bfb__column');
  var isTopContainer = container.classList.contains('wpbc_bfb__form_preview_section_container');
  if (!isColumn && !isTopContainer) return;
  wpbc_bfb__init_sortable(container);
}
function wpbc_bfb__form_preview_section__add_to_container(container, cols) {
  var section = wpbc_bfb__create_element('div', 'wpbc_bfb__section');
  section.setAttribute('data-id', 'section-' + ++_wpbc_builder.section_counter + '-' + Date.now());
  var header = wpbc_bfb__create_element('div', 'wpbc_bfb__section-header');
  var title = wpbc_bfb__create_element('div', 'wpbc_bfb__section-title');
  var dragHandle = wpbc_bfb__create_element('span', 'wpbc_bfb__drag-handle section-drag-handle', '<span class="wpbc_icn_drag_indicator wpbc_icn_rotate_90"></span>');
  title.appendChild(dragHandle);

  // Up Btn.
  var moveUpBtn = wpbc_bfb__create_element('button', 'wpbc_bfb__section-move-up', '<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>');
  moveUpBtn.title = 'Move section up';
  moveUpBtn.type = 'button';
  moveUpBtn.onclick = function (e) {
    e.preventDefault();
    wpbc_bfb__move_item(section, 'up');
  };
  // moveUpBtn.onclick = function (e) { e.preventDefault(); wpbc_bfb__move_section( section, 'up' ); };

  // Down Btn.
  var moveDownBtn = wpbc_bfb__create_element('button', 'wpbc_bfb__section-move-down', '<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>');
  moveDownBtn.title = 'Move section down';
  moveDownBtn.type = 'button';
  moveDownBtn.onclick = function (e) {
    e.preventDefault();
    wpbc_bfb__move_item(section, 'down');
  };
  //moveDownBtn.onclick = function (e) { e.preventDefault(); wpbc_bfb__move_section( section, 'down' ); };

  title.appendChild(moveUpBtn);
  title.appendChild(moveDownBtn);

  // Remove Btn.
  var removeBtn = wpbc_bfb__create_element('button', 'wpbc_bfb__field-remove-btn', '<i class="menu_icon icon-1x wpbc_icn_close"></i>');
  removeBtn.title = 'Remove section';
  removeBtn.type = 'button';
  removeBtn.onclick = function (e) {
    e.preventDefault();
    section.remove();
    wpbc_bfb__panel_fields_lib__usage_limits_update();
  };
  header.appendChild(title);
  header.appendChild(removeBtn);
  section.appendChild(header);
  var row = document.createElement('div');
  row.className = 'wpbc_bfb__row';
  for (var i = 0; i < cols; i++) {
    var col = wpbc_bfb__create_element('ul', 'wpbc_bfb__column');
    col.style.flexBasis = 100 / cols + '%';
    wpbc_bfb__init_sortable(col);
    row.appendChild(col);
    if (i < cols - 1) {
      var resizer = wpbc_bfb__create_element('div', 'wpbc_bfb__column-resizer');
      resizer.addEventListener('mousedown', wpbc_bfb__form_preview_section__init_resize);
      row.appendChild(resizer);
    }
  }
  section.appendChild(row);
  container.appendChild(section);

  // Important: enable nesting drag on this new section as well
  wpbc_bfb__init_section_sortable(section);
}

// Update wpbc_bfb__rebuild_section to support nesting.
function wpbc_bfb__rebuild_section(sectionData, container) {
  wpbc_bfb__form_preview_section__add_to_container(container, sectionData.columns.length);
  var section = container.lastElementChild;
  section.setAttribute('data-id', sectionData.id || 'section-' + ++_wpbc_builder.section_counter + '-' + Date.now());
  var row = section.querySelector('.wpbc_bfb__row');
  sectionData.columns.forEach(function (colData, index) {
    var col = row.children[index * 2];
    col.style.flexBasis = colData.width || '100%';
    colData.fields.forEach(function (field) {
      var el = wpbc_bfb__create_element('li', 'wpbc_bfb__field');
      wpbc_bfb__set_data_attributes(el, field);
      el.innerHTML = wpbc_bfb__render_field_inner_html(field);
      wpbc_bfb__decorate_field(el);
      col.appendChild(el);
      wpbc_bfb__panel_fields_lib__usage_limits_update();
    });
    (colData.sections || []).forEach(function (nested) {
      wpbc_bfb__rebuild_section(nested, col);
    });
  });

  // Important: enable sorting for this rebuilt section too
  //wpbc_bfb__init_section_sortable(section);
  wpbc_bfb__init_all_nested_sections(section);
}

// == recursive initialization of nested Sortables: ==
function wpbc_bfb__init_all_nested_sections(container) {
  // Also initialize the container itself if needed.
  if (container.classList.contains('wpbc_bfb__form_preview_section_container')) {
    wpbc_bfb__init_section_sortable(container);
  }
  var allSections = container.querySelectorAll('.wpbc_bfb__section');
  allSections.forEach(function (section) {
    // Find each column inside the section.
    var columns = section.querySelectorAll('.wpbc_bfb__column');
    columns.forEach(function (col) {
      return wpbc_bfb__init_section_sortable(col);
    });
  });
}
function wpbc_bfb__handle_on_add(evt) {
  if (!evt || !evt.item) return;

  // === If dropped item is a FIELD ===
  var newItem = evt.item;
  var isCloned = evt.from.id === 'wpbc_bfb__panel_field_types__ul';
  var fieldId = newItem.dataset.id;
  if (!fieldId) return;
  var usageLimit = parseInt(newItem.dataset.usagenumber || Infinity, 10);
  if (isCloned) {
    var fieldData = wpbc_bfb__get_all_data_attributes(newItem);
    evt.item.remove();
    var rebuiltField = wpbc_bfb__build_field(fieldData);
    evt.to.insertBefore(rebuiltField, evt.to.children[evt.newIndex]);
    newItem = rebuiltField;
  }
  var allUsed = document.querySelectorAll(".wpbc_bfb__panel--preview .wpbc_bfb__field[data-id=\"".concat(fieldId, "\"]"));
  if (allUsed.length > usageLimit) {
    alert("Only ".concat(usageLimit, " instance").concat(usageLimit > 1 ? 's' : '', " of \"").concat(fieldId, "\" allowed."));
    newItem.remove();
    return;
  }
  if (newItem.classList.contains('wpbc_bfb__section')) {
    var nestingLevel = wpbc_bfb__get_nesting_level(newItem);
    if (nestingLevel >= _wpbc_builder.max_nested_value) {
      alert('Too many nested sections.');
      newItem.remove();
      return;
    }
  }
  // Add this line right after usage check:.
  wpbc_bfb__decorate_field(newItem);
  wpbc_bfb__panel_fields_lib__usage_limits_update();

  // If this is a newly added section, initialize sortable inside it.
  if (newItem.classList.contains('wpbc_bfb__section')) {
    wpbc_bfb__init_section_sortable(newItem);
  }
}
function wpbc_bfb__build_field(fieldData) {
  var el = wpbc_bfb__create_element('li', 'wpbc_bfb__field');
  wpbc_bfb__set_data_attributes(el, fieldData);
  el.innerHTML = wpbc_bfb__render_field_inner_html(fieldData);
  wpbc_bfb__decorate_field(el);
  return el;
}
function wpbc_bfb__render_field_inner_html(fieldData) {
  var label = String(fieldData.label || fieldData.id || '(no label)');
  var type = String(fieldData.type || 'unknown');
  var isRequired = fieldData.required === true || fieldData.required === 'true';
  return "\n\t\t<span class=\"wpbc_bfb__field-label\">".concat(label).concat(isRequired ? ' *' : '', "</span>\n\t\t<span class=\"wpbc_bfb__field-type\">").concat(type, "</span>\n\t");
}
function wpbc_bfb__get_nesting_level(sectionEl) {
  var level = 0;
  var parent = sectionEl.closest('.wpbc_bfb__column');
  while (parent) {
    var outerSection = parent.closest('.wpbc_bfb__section');
    if (!outerSection) break;
    level++;
    parent = outerSection.closest('.wpbc_bfb__column');
  }
  return level;
}
function wpbc_bfb__decorate_field(fieldEl) {
  if (!fieldEl) {
    return;
  }
  if (fieldEl.classList.contains('wpbc_bfb__section')) {
    return;
  }
  fieldEl.classList.add('wpbc_bfb__field');
  if (_wpbc_builder.preview_mode) {
    wpbc_bfb__decorate_field_preview(fieldEl);
  } else {
    wpbc_bfb__add_drag_handle(fieldEl);
    wpbc_bfb__add_remove_btn(fieldEl, function () {
      fieldEl.remove();
      wpbc_bfb__panel_fields_lib__usage_limits_update();
    });
    wpbc_bfb__add_field_move_buttons(fieldEl);
  }
}

// === Move item (section  or field)  up/down within its container ===
function wpbc_bfb__move_item(el, direction) {
  var container = el.parentElement;
  if (!container) return;
  var siblings = Array.from(container.children).filter(function (child) {
    return child.classList.contains('wpbc_bfb__field') || child.classList.contains('wpbc_bfb__section');
  });
  var currentIndex = siblings.indexOf(el);
  if (currentIndex === -1) return;
  var newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (newIndex < 0 || newIndex >= siblings.length) return;
  var referenceNode = siblings[newIndex];
  if (direction === 'up') {
    container.insertBefore(el, referenceNode);
  } else {
    container.insertBefore(referenceNode, el);
  }
}

// === Deprecated: Move section up/down within its container ===
function wpbc_bfb__move_section(sectionEl, direction) {
  var container = sectionEl.parentElement;
  if (!container) return;

  // Only direct children that are .wpbc_bfb__section
  var allSections = Array.from(container.children).filter(function (child) {
    return child.classList.contains('wpbc_bfb__section');
  });
  var currentIndex = allSections.indexOf(sectionEl);
  if (currentIndex === -1) return;
  var newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (newIndex < 0 || newIndex >= allSections.length) return;
  var referenceNode = allSections[newIndex];
  if (direction === 'up') {
    container.insertBefore(sectionEl, referenceNode);
  } else {
    container.insertBefore(referenceNode, sectionEl);
  }
}

// === Deprecated: Move field up/down within its container ===
function wpbc_bfb__move_field(fieldEl, direction) {
  var parent = fieldEl.parentElement;
  if (!parent) return;

  // Only direct children that are fields
  var fields = Array.from(parent.children).filter(function (child) {
    return child.classList.contains('wpbc_bfb__field') && !child.classList.contains('wpbc_bfb__section');
  });
  var index = fields.indexOf(fieldEl);
  if (index === -1) return;
  var newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= fields.length) return;
  var reference = fields[newIndex];
  if (direction === 'up') {
    parent.insertBefore(fieldEl, reference);
  } else {
    parent.insertBefore(reference, fieldEl);
  }
}

// === Field usage limit updater ===
function wpbc_bfb__panel_fields_lib__usage_limits_update() {
  var allUsedFields = document.querySelectorAll('.wpbc_bfb__panel--preview .wpbc_bfb__field');
  var usageCount = {};
  allUsedFields.forEach(function (field) {
    var id = field.dataset.id;
    usageCount[id] = (usageCount[id] || 0) + 1;
  });
  if (null !== _wpbc_builder.panel_fields_lib_ul) {
    _wpbc_builder.panel_fields_lib_ul.querySelectorAll('.wpbc_bfb__field').forEach(function (panelField) {
      var id = panelField.dataset.id;
      var limit = parseInt(panelField.dataset.usagenumber || Infinity, 10);
      var current = usageCount[id] || 0;
      panelField.style.pointerEvents = current >= limit ? 'none' : '';
      panelField.style.opacity = current >= limit ? '0.4' : '';
    });
  }
}

// === Column resizing logic ===
function wpbc_bfb__form_preview_section__init_resize(e) {
  var resizer = e.target;
  var leftCol = resizer.previousElementSibling;
  var rightCol = resizer.nextElementSibling;
  var startX = e.clientX;
  var leftWidth = leftCol.offsetWidth;
  var rightWidth = rightCol.offsetWidth;
  var totalWidth = leftWidth + rightWidth;
  if (!leftCol || !rightCol || !leftCol.classList.contains('wpbc_bfb__column') || !rightCol.classList.contains('wpbc_bfb__column')) {
    return;
  }
  function onMouseMove(e) {
    var delta = e.clientX - startX;
    var leftPercent = (leftWidth + delta) / totalWidth * 100;
    var rightPercent = (rightWidth - delta) / totalWidth * 100;
    if (leftPercent < 5 || rightPercent < 5) return;
    leftCol.style.flexBasis = "".concat(leftPercent, "%");
    rightCol.style.flexBasis = "".concat(rightPercent, "%");
  }
  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}
function wpbc_bfb__get_form_structure() {
  var pages = [];
  document.querySelectorAll('.wpbc_bfb__panel--preview').forEach(function (pageEl, pageIndex) {
    var container = pageEl.querySelector('.wpbc_bfb__form_preview_section_container');
    var sections = [];
    var looseFields = [];
    var orderedElements = [];
    container.querySelectorAll(':scope > *').forEach(function (child) {
      if (child.classList.contains('wpbc_bfb__section')) {
        orderedElements.push({
          type: 'section',
          data: wpbc_bfb__serialize_section(child)
        });
      } else if (child.classList.contains('wpbc_bfb__field')) {
        orderedElements.push({
          type: 'field',
          data: wpbc_bfb__get_all_data_attributes(child)
        });
      }
    });
    pages.push({
      page: pageIndex + 1,
      content: orderedElements
    });
  });
  return pages;
}
function wpbc_bfb__serialize_section(sectionEl) {
  var row = sectionEl.querySelector(':scope > .wpbc_bfb__row');
  var columns = [];
  if (!row) return {
    id: sectionEl.dataset.id,
    columns: []
  };
  row.querySelectorAll(':scope > .wpbc_bfb__column').forEach(function (col) {
    var width = col.style.flexBasis || '100%';
    var fields = [];
    var sections = [];

    // Loop through direct children of the column.
    Array.from(col.children).forEach(function (child) {
      if (child.classList.contains('wpbc_bfb__section')) {
        // Recurse into nested section.
        sections.push(wpbc_bfb__serialize_section(child));
      } else if (child.classList.contains('wpbc_bfb__field')) {
        // Only serialize real fields.
        fields.push(wpbc_bfb__get_all_data_attributes(child));
      }
    });
    columns.push({
      width: width,
      fields: fields,
      sections: sections
    });
  });
  return {
    id: sectionEl.dataset.id,
    columns: columns
  };
}
function wpbc_bfb__get_all_data_attributes(el) {
  var data = {};
  if (!el || !el.attributes) return data;
  Array.from(el.attributes).forEach(function (attr) {
    if (attr.name.startsWith('data-')) {
      var key = attr.name.replace(/^data-/, '');
      try {
        data[key] = JSON.parse(attr.value);
      } catch (e) {
        data[key] = attr.value;
      }
    }
  });
  if (!data.label && data.id) {
    data.label = data.id.charAt(0).toUpperCase() + data.id.slice(1);
  }
  return data;
}
function wpbc_bfb__load_saved_structure(structure) {
  _wpbc_builder.pages_container.innerHTML = '';
  _wpbc_builder.page_counter = 0;
  structure.forEach(function (pageData) {
    wpbc_bfb__add_page(); // increments _wpbc_builder.page_counter
    var pageEl = _wpbc_builder.pages_container.querySelector(".wpbc_bfb__panel--preview[data-page=\"".concat(_wpbc_builder.page_counter, "\"]"));
    var sectionContainer = pageEl.querySelector('.wpbc_bfb__form_preview_section_container');
    sectionContainer.innerHTML = ''; // remove default section.
    wpbc_bfb__init_section_sortable(sectionContainer); // Initialize top-level sorting

    (pageData.content || []).forEach(function (item) {
      if (item.type === 'section') {
        wpbc_bfb__rebuild_section(item.data, sectionContainer);
      } else if (item.type === 'field') {
        var el = wpbc_bfb__create_element('li', 'wpbc_bfb__field');
        wpbc_bfb__set_data_attributes(el, item.data);
        el.innerHTML = wpbc_bfb__render_field_inner_html(item.data);
        wpbc_bfb__decorate_field(el);
        sectionContainer.appendChild(el);
      }
    });
  });
  wpbc_bfb__panel_fields_lib__usage_limits_update();
}

// === Init Sortable on the Field Palette ===
if (null !== _wpbc_builder.panel_fields_lib_ul) {
  Sortable.create(_wpbc_builder.panel_fields_lib_ul, {
    group: {
      name: 'form',
      pull: 'clone',
      put: false
    },
    animation: 150,
    ghostClass: 'wpbc_bfb__drag-ghost',
    chosenClass: 'wpbc_bfb__highlight',
    dragClass: 'wpbc_bfb__drag-active',
    sort: false,
    onStart: function onStart() {
      document.querySelectorAll('.wpbc_bfb__column').forEach(function (col) {
        return col.classList.add('wpbc_bfb__dragging');
      });
    },
    onEnd: function onEnd() {
      document.querySelectorAll('.wpbc_bfb__column').forEach(function (col) {
        return col.classList.remove('wpbc_bfb__dragging');
      });
    }
  });
} else {
  console.log('WPBC Warning!  Form fields pallete not defined.');
}
document.getElementById('wpbc_bfb__save_btn').addEventListener('click', function (e) {
  e.preventDefault(); // Stop page reload.

  var structure = wpbc_bfb__get_form_structure();
  console.log(JSON.stringify(structure, null, 2)); // Or save via AJAX.

  // console.log( 'Loaded JSON:', JSON.stringify( wpbc_bfb__form_structure__get_example(), null, 2 ) );
  // console.log( 'Saved JSON:', JSON.stringify( wpbc_bfb__get_form_structure(), null, 2 ) );

  // Custom event for communication (e.g. Elementor preview mode).
  var event = new CustomEvent('wpbc_bfb_form_updated', {
    detail: structure
  });
  document.dispatchEvent(event);

  // Example: send to server.
  // wpbc_ajax_save_form(structure);
});

// === Initialize default first page ===
window.addEventListener('DOMContentLoaded', function () {
  // Standard Initilizing one page.
  //	 wpbc_bfb__add_page(); return;

  // Load your saved form structure here:.
  var savedStructure = wpbc_bfb__form_structure__get_example(); // [ /* your JSON structure from earlier */ ];.
  wpbc_bfb__load_saved_structure(savedStructure);
});
if (null !== document.getElementById('wpbc_bfb__toggle_preview')) {
  document.getElementById('wpbc_bfb__toggle_preview').addEventListener('change', function () {
    _wpbc_builder.preview_mode = this.checked;
    wpbc_bfb__load_saved_structure(wpbc_bfb__get_form_structure()); // Re-render
  });
}
// Manual fix: remove incorrect `.wpbc_bfb__field` from section elements (if any)
// document.querySelectorAll('.wpbc_bfb__section.wpbc_bfb__field').forEach(el => { el.classList.remove('wpbc_bfb__field'); });  //.

function wpbc_bfb__form_structure__get_example() {
  return [{
    "page": 1,
    "content": [{
      "type": "section",
      "data": {
        "id": "section-7-1754079405442",
        "columns": [{
          "width": "19.0205%",
          "fields": [{
            "id": "selectbox",
            "type": "selectbox",
            "label": "Choose Item",
            "placeholder": "Please select",
            "options": ["One", "Two", "Three"],
            "required": true
          }],
          "sections": []
        }, {
          "width": "80.9795%",
          "fields": [],
          "sections": [{
            "id": "section-8-1754079445784",
            "columns": [{
              "width": "50%",
              "fields": [{
                "id": "calendar",
                "type": "calendar",
                "usagenumber": 1,
                "label": "Calendar"
              }],
              "sections": []
            }, {
              "width": "50%",
              "fields": [{
                "id": "rangetime",
                "type": "timeslots",
                "usagenumber": 1,
                "label": "Rangetime"
              }],
              "sections": []
            }]
          }]
        }]
      }
    }, {
      "type": "field",
      "data": {
        "id": "costhint",
        "type": "costhint",
        "label": "Costhint"
      }
    }]
  }, {
    "page": 2,
    "content": [{
      "type": "section",
      "data": {
        "id": "section-11-1754079499494",
        "columns": [{
          "width": "50%",
          "fields": [{
            "id": "input-text",
            "type": "text",
            "label": "Input-text"
          }],
          "sections": []
        }, {
          "width": "50%",
          "fields": [{
            "id": "input-text",
            "type": "text",
            "label": "Input-text"
          }],
          "sections": []
        }]
      }
    }, {
      "type": "field",
      "data": {
        "id": "textarea",
        "type": "textarea",
        "label": "Textarea"
      }
    }, {
      "type": "section",
      "data": {
        "id": "section-10-1754079492260",
        "columns": [{
          "width": "100%",
          "fields": [],
          "sections": []
        }]
      }
    }]
  }];
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9idWlsZGVyLWZvcm0uanMiLCJuYW1lcyI6WyJfd3BiY19idWlsZGVyIiwib2JqIiwiJCIsInBfcGFuZWxfZmllbGRzX2xpYl91bCIsInBhbmVsX2ZpZWxkc19saWJfdWwiLCJkb2N1bWVudCIsImdldEVsZW1lbnRCeUlkIiwicF9wYWdlc19jb250YWluZXIiLCJwYWdlc19jb250YWluZXIiLCJwX3BhZ2VfY291bnRlciIsInBhZ2VfY291bnRlciIsInBfc2VjdGlvbl9jb3VudGVyIiwic2VjdGlvbl9jb3VudGVyIiwicF9tYXhfbmVzdGVkX3ZhbHVlIiwibWF4X25lc3RlZF92YWx1ZSIsInBfcHJldmlld19tb2RlIiwicHJldmlld19tb2RlIiwialF1ZXJ5Iiwid3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50IiwidGFnIiwiY2xhc3NOYW1lIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwidW5kZWZpbmVkIiwiaW5uZXJIVE1MIiwiZWwiLCJjcmVhdGVFbGVtZW50Iiwid3BiY19iZmJfX3NldF9kYXRhX2F0dHJpYnV0ZXMiLCJkYXRhT2JqIiwiT2JqZWN0IiwiZW50cmllcyIsImZvckVhY2giLCJfcmVmIiwiX3JlZjIiLCJfc2xpY2VkVG9BcnJheSIsImtleSIsInZhbCIsInZhbHVlIiwiX3R5cGVvZiIsIkpTT04iLCJzdHJpbmdpZnkiLCJzZXRBdHRyaWJ1dGUiLCJ3cGJjX2JmYl9faW5pdF9zb3J0YWJsZSIsImNvbnRhaW5lciIsIm9uQWRkQ2FsbGJhY2siLCJ3cGJjX2JmYl9faGFuZGxlX29uX2FkZCIsIlNvcnRhYmxlIiwiY3JlYXRlIiwiZ3JvdXAiLCJuYW1lIiwicHVsbCIsInB1dCIsInRvIiwiZnJvbSIsImRyYWdnZWRFbCIsImNsYXNzTGlzdCIsImNvbnRhaW5zIiwiaGFuZGxlIiwiZHJhZ2dhYmxlIiwiYW5pbWF0aW9uIiwib25BZGQiLCJnaG9zdENsYXNzIiwiY2hvc2VuQ2xhc3MiLCJkcmFnQ2xhc3MiLCJvblN0YXJ0IiwicXVlcnlTZWxlY3RvckFsbCIsImNvbCIsImFkZCIsIm9uRW5kIiwicmVtb3ZlIiwid3BiY19iZmJfX2FkZF9kcmFnX2hhbmRsZSIsInF1ZXJ5U2VsZWN0b3IiLCJwcmVwZW5kIiwid3BiY19iZmJfX2FkZF9yZW1vdmVfYnRuIiwiY2FsbGJhY2siLCJidG4iLCJ0aXRsZSIsInR5cGUiLCJvbmNsaWNrIiwiYXBwZW5kQ2hpbGQiLCJ3cGJjX2JmYl9fYWRkX2ZpZWxkX21vdmVfYnV0dG9ucyIsImZpZWxkRWwiLCJ1cEJ0biIsImUiLCJwcmV2ZW50RGVmYXVsdCIsIndwYmNfYmZiX19tb3ZlX2l0ZW0iLCJkb3duQnRuIiwid3BiY19iZmJfX2RlY29yYXRlX2ZpZWxkX3ByZXZpZXciLCJkYXRhIiwid3BiY19iZmJfX2dldF9hbGxfZGF0YV9hdHRyaWJ1dGVzIiwiZmllbGRUeXBlIiwiZmllbGRJZCIsImlkIiwiZmllbGRMYWJlbCIsImxhYmVsIiwiaW5wdXRIVE1MIiwiY29uY2F0Iiwid3BiY19iZmJfX3BhbmVsX2ZpZWxkc19saWJfX3VzYWdlX2xpbWl0c191cGRhdGUiLCJ3cGJjX2JmYl9fYWRkX3BhZ2UiLCJwYWdlRWwiLCJkZWxldGVQYWdlQnRuIiwic2VjdGlvbkNvbnRhaW5lciIsIndwYmNfYmZiX19pbml0X3NlY3Rpb25fc29ydGFibGUiLCJ3cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fX2FkZF90b19jb250YWluZXIiLCJhZGRFdmVudExpc3RlbmVyIiwic2VsZWN0IiwiY29scyIsInBhcnNlSW50IiwiaXNDb2x1bW4iLCJpc1RvcENvbnRhaW5lciIsInNlY3Rpb24iLCJEYXRlIiwibm93IiwiaGVhZGVyIiwiZHJhZ0hhbmRsZSIsIm1vdmVVcEJ0biIsIm1vdmVEb3duQnRuIiwicmVtb3ZlQnRuIiwicm93IiwiaSIsInN0eWxlIiwiZmxleEJhc2lzIiwicmVzaXplciIsIndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9faW5pdF9yZXNpemUiLCJ3cGJjX2JmYl9fcmVidWlsZF9zZWN0aW9uIiwic2VjdGlvbkRhdGEiLCJjb2x1bW5zIiwibGFzdEVsZW1lbnRDaGlsZCIsImNvbERhdGEiLCJpbmRleCIsImNoaWxkcmVuIiwid2lkdGgiLCJmaWVsZHMiLCJmaWVsZCIsIndwYmNfYmZiX19yZW5kZXJfZmllbGRfaW5uZXJfaHRtbCIsIndwYmNfYmZiX19kZWNvcmF0ZV9maWVsZCIsInNlY3Rpb25zIiwibmVzdGVkIiwid3BiY19iZmJfX2luaXRfYWxsX25lc3RlZF9zZWN0aW9ucyIsImFsbFNlY3Rpb25zIiwiZXZ0IiwiaXRlbSIsIm5ld0l0ZW0iLCJpc0Nsb25lZCIsImRhdGFzZXQiLCJ1c2FnZUxpbWl0IiwidXNhZ2VudW1iZXIiLCJJbmZpbml0eSIsImZpZWxkRGF0YSIsInJlYnVpbHRGaWVsZCIsIndwYmNfYmZiX19idWlsZF9maWVsZCIsImluc2VydEJlZm9yZSIsIm5ld0luZGV4IiwiYWxsVXNlZCIsImFsZXJ0IiwibmVzdGluZ0xldmVsIiwid3BiY19iZmJfX2dldF9uZXN0aW5nX2xldmVsIiwiU3RyaW5nIiwiaXNSZXF1aXJlZCIsInJlcXVpcmVkIiwic2VjdGlvbkVsIiwibGV2ZWwiLCJwYXJlbnQiLCJjbG9zZXN0Iiwib3V0ZXJTZWN0aW9uIiwiZGlyZWN0aW9uIiwicGFyZW50RWxlbWVudCIsInNpYmxpbmdzIiwiQXJyYXkiLCJmaWx0ZXIiLCJjaGlsZCIsImN1cnJlbnRJbmRleCIsImluZGV4T2YiLCJyZWZlcmVuY2VOb2RlIiwid3BiY19iZmJfX21vdmVfc2VjdGlvbiIsIndwYmNfYmZiX19tb3ZlX2ZpZWxkIiwicmVmZXJlbmNlIiwiYWxsVXNlZEZpZWxkcyIsInVzYWdlQ291bnQiLCJwYW5lbEZpZWxkIiwibGltaXQiLCJjdXJyZW50IiwicG9pbnRlckV2ZW50cyIsIm9wYWNpdHkiLCJ0YXJnZXQiLCJsZWZ0Q29sIiwicHJldmlvdXNFbGVtZW50U2libGluZyIsInJpZ2h0Q29sIiwibmV4dEVsZW1lbnRTaWJsaW5nIiwic3RhcnRYIiwiY2xpZW50WCIsImxlZnRXaWR0aCIsIm9mZnNldFdpZHRoIiwicmlnaHRXaWR0aCIsInRvdGFsV2lkdGgiLCJvbk1vdXNlTW92ZSIsImRlbHRhIiwibGVmdFBlcmNlbnQiLCJyaWdodFBlcmNlbnQiLCJvbk1vdXNlVXAiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwid3BiY19iZmJfX2dldF9mb3JtX3N0cnVjdHVyZSIsInBhZ2VzIiwicGFnZUluZGV4IiwibG9vc2VGaWVsZHMiLCJvcmRlcmVkRWxlbWVudHMiLCJwdXNoIiwid3BiY19iZmJfX3NlcmlhbGl6ZV9zZWN0aW9uIiwicGFnZSIsImNvbnRlbnQiLCJhdHRyaWJ1dGVzIiwiYXR0ciIsInN0YXJ0c1dpdGgiLCJyZXBsYWNlIiwicGFyc2UiLCJjaGFyQXQiLCJ0b1VwcGVyQ2FzZSIsInNsaWNlIiwid3BiY19iZmJfX2xvYWRfc2F2ZWRfc3RydWN0dXJlIiwic3RydWN0dXJlIiwicGFnZURhdGEiLCJzb3J0IiwiY29uc29sZSIsImxvZyIsImV2ZW50IiwiQ3VzdG9tRXZlbnQiLCJkZXRhaWwiLCJkaXNwYXRjaEV2ZW50Iiwid2luZG93Iiwic2F2ZWRTdHJ1Y3R1cmUiLCJ3cGJjX2JmYl9fZm9ybV9zdHJ1Y3R1cmVfX2dldF9leGFtcGxlIiwiY2hlY2tlZCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYnVpbGRlci1mb3JtLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBXb3JraW5nIFNjcmlwdCA9PSBUaW1lIHBvaW50OiAyMDI1LTA3LTMxIDIwOjI5ICFcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogTWFpbiBfd3BiY19idWlsZGVyIEpTIG9iamVjdFxyXG4gKi9cclxudmFyIF93cGJjX2J1aWxkZXIgPSAoZnVuY3Rpb24gKG9iaiwgJCkge1xyXG5cclxuXHR2YXIgcF9wYW5lbF9maWVsZHNfbGliX3VsID0gb2JqLnBhbmVsX2ZpZWxkc19saWJfdWwgPSBvYmoucGFuZWxfZmllbGRzX2xpYl91bCB8fCBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19wYW5lbF9maWVsZF90eXBlc19fdWwnICk7XHJcblx0dmFyIHBfcGFnZXNfY29udGFpbmVyICAgICA9IG9iai5wYWdlc19jb250YWluZXIgPSBvYmoucGFnZXNfY29udGFpbmVyIHx8IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3BhZ2VzX2NvbnRhaW5lcicgKTtcclxuXHR2YXIgcF9wYWdlX2NvdW50ZXIgICAgICAgID0gb2JqLnBhZ2VfY291bnRlciA9IG9iai5wYWdlX2NvdW50ZXIgfHwgMDtcclxuXHR2YXIgcF9zZWN0aW9uX2NvdW50ZXIgICAgID0gb2JqLnNlY3Rpb25fY291bnRlciA9IG9iai5zZWN0aW9uX2NvdW50ZXIgfHwgMDtcclxuXHR2YXIgcF9tYXhfbmVzdGVkX3ZhbHVlICAgID0gb2JqLm1heF9uZXN0ZWRfdmFsdWUgPSBvYmoubWF4X25lc3RlZF92YWx1ZSB8fCA1O1xyXG5cdHZhciBwX3ByZXZpZXdfbW9kZSAgICAgICAgPSBvYmoucHJldmlld19tb2RlID0gb2JqLnByZXZpZXdfbW9kZSB8fCB0cnVlOyAgIC8vIE9wdGlvbmFsIHByZXZpZXcgdG9nZ2xlLiBDYW4gbGF0ZXIgYmUgdG9nZ2xlZCBieSBVSSBjb250cm9sLlxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cclxufSggX3dwYmNfYnVpbGRlciB8fCB7fSwgalF1ZXJ5ICkpO1xyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8vID09PSBIZWxwZXIgRnVuY3Rpb25zID09PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuZnVuY3Rpb24gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KHRhZywgY2xhc3NOYW1lID0gJycsIGlubmVySFRNTCA9ICcnKSB7XHJcblx0Y29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCB0YWcgKTtcclxuXHRpZiAoIGNsYXNzTmFtZSApIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZTtcclxuXHRpZiAoIGlubmVySFRNTCApIGVsLmlubmVySFRNTCA9IGlubmVySFRNTDtcclxuXHRyZXR1cm4gZWw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19zZXRfZGF0YV9hdHRyaWJ1dGVzKGVsLCBkYXRhT2JqKSB7XHJcblxyXG5cdE9iamVjdC5lbnRyaWVzKCBkYXRhT2JqICkuZm9yRWFjaCggKFsga2V5LCB2YWwgXSkgPT4ge1xyXG5cdFx0Y29uc3QgdmFsdWUgPSAodHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpID8gSlNPTi5zdHJpbmdpZnkoIHZhbCApIDogdmFsO1xyXG5cdFx0ZWwuc2V0QXR0cmlidXRlKCAnZGF0YS0nICsga2V5LCB2YWx1ZSApO1xyXG5cdH0gKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19iZmJfX2luaXRfc29ydGFibGUoY29udGFpbmVyLCBvbkFkZENhbGxiYWNrID0gd3BiY19iZmJfX2hhbmRsZV9vbl9hZGQpIHtcclxuXHJcblx0aWYgKCAhY29udGFpbmVyICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0U29ydGFibGUuY3JlYXRlKCBjb250YWluZXIsIHtcclxuXHRcdGdyb3VwICAgICAgOiB7XHJcblx0XHRcdG5hbWU6ICdmb3JtJyxcclxuXHRcdFx0cHVsbDogdHJ1ZSxcclxuXHRcdFx0cHV0IDogKHRvLCBmcm9tLCBkcmFnZ2VkRWwpID0+IHtcclxuXHRcdFx0XHRcdHJldHVybiBkcmFnZ2VkRWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApIHx8IGRyYWdnZWRFbC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHRcdFx0XHR9XHJcblx0XHR9LFxyXG5cdFx0aGFuZGxlICAgICA6ICcuc2VjdGlvbi1kcmFnLWhhbmRsZSwgLndwYmNfYmZiX19kcmFnLWhhbmRsZScsXHJcblx0XHRkcmFnZ2FibGUgIDogJy53cGJjX2JmYl9fZmllbGQsIC53cGJjX2JmYl9fc2VjdGlvbicsXHJcblx0XHRhbmltYXRpb24gIDogMTUwLFxyXG5cdFx0b25BZGQgICAgICA6IG9uQWRkQ2FsbGJhY2ssXHJcblx0XHRnaG9zdENsYXNzIDogJ3dwYmNfYmZiX19kcmFnLWdob3N0JyxcclxuXHRcdGNob3NlbkNsYXNzOiAnd3BiY19iZmJfX2hpZ2hsaWdodCcsXHJcblx0XHRkcmFnQ2xhc3MgIDogJ3dwYmNfYmZiX19kcmFnLWFjdGl2ZScsXHJcblx0XHRvblN0YXJ0ICAgIDogZnVuY3Rpb24gKCkgeyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19jb2x1bW4nICkuZm9yRWFjaCggY29sID0+IGNvbC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2RyYWdnaW5nJyApICk7IH0sXHJcblx0XHRvbkVuZCAgICAgIDogZnVuY3Rpb24gKCkgeyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19jb2x1bW4nICkuZm9yRWFjaCggY29sID0+IGNvbC5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY19iZmJfX2RyYWdnaW5nJyApICk7IH1cclxuXHR9ICk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBZGQgZHJhZyBoYW5kbGVcclxuICpcclxuICogQHBhcmFtIGVsXHJcbiAqIEBwYXJhbSBjbGFzc05hbWVcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19hZGRfZHJhZ19oYW5kbGUoZWwsIGNsYXNzTmFtZSA9ICd3cGJjX2JmYl9fZHJhZy1oYW5kbGUnKSB7XHJcblx0aWYgKCBlbC5xdWVyeVNlbGVjdG9yKCAnLicgKyBjbGFzc05hbWUgKSApIHJldHVybjtcclxuXHRjb25zdCBoYW5kbGUgPSB3cGJjX2JmYl9fY3JlYXRlX2VsZW1lbnQoICdzcGFuJywgY2xhc3NOYW1lLCAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9kcmFnX2luZGljYXRvclwiPjwvc3Bhbj4nICk7XHJcblx0ZWwucHJlcGVuZCggaGFuZGxlICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19hZGRfcmVtb3ZlX2J0bihlbCwgY2FsbGJhY2spIHtcclxuXHJcblx0aWYgKCBlbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZC1yZW1vdmUtYnRuJyApICkgcmV0dXJuO1xyXG5cdGNvbnN0IGJ0biAgID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KFxyXG5cdFx0J2J1dHRvbicsXHJcblx0XHQnd3BiY19iZmJfX2ZpZWxkLXJlbW92ZS1idG4nLFxyXG5cdFx0JzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fZGVsZXRlX291dGxpbmVcIj48L2k+J1xyXG5cdCk7XHJcblx0YnRuLnRpdGxlICAgPSAnUmVtb3ZlIGZpZWxkJztcclxuXHRidG4udHlwZSAgICA9ICdidXR0b24nO1xyXG5cdGJ0bi5vbmNsaWNrID0gY2FsbGJhY2s7XHJcblx0ZWwuYXBwZW5kQ2hpbGQoIGJ0biApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fYWRkX2ZpZWxkX21vdmVfYnV0dG9ucyhmaWVsZEVsKSB7XHJcblx0aWYgKCAhZmllbGRFbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZC1tb3ZlLXVwJyApICkge1xyXG5cdFx0Y29uc3QgdXBCdG4gICA9IHdwYmNfYmZiX19jcmVhdGVfZWxlbWVudCggJ2J1dHRvbicsICd3cGJjX2JmYl9fZmllbGQtbW92ZS11cCcsICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2Fycm93X3Vwd2FyZFwiPjwvaT4nICk7XHJcblx0XHR1cEJ0bi50aXRsZSAgID0gJ01vdmUgZmllbGQgdXAnO1xyXG5cdFx0dXBCdG4udHlwZSAgICA9ICdidXR0b24nO1xyXG5cdFx0dXBCdG4ub25jbGljayA9IGUgPT4geyBlLnByZXZlbnREZWZhdWx0KCk7IHdwYmNfYmZiX19tb3ZlX2l0ZW0oIGZpZWxkRWwsICd1cCcgKTsgfTtcclxuXHRcdC8vIHVwQnRuLm9uY2xpY2sgPSBlID0+IHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB3cGJjX2JmYl9fbW92ZV9maWVsZCggZmllbGRFbCwgJ3VwJyApOyB9O1xyXG5cdFx0ZmllbGRFbC5hcHBlbmRDaGlsZCggdXBCdG4gKTtcclxuXHR9XHJcblxyXG5cdGlmICggIWZpZWxkRWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZmllbGQtbW92ZS1kb3duJyApICkge1xyXG5cdFx0Y29uc3QgZG93bkJ0biAgID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnYnV0dG9uJywgJ3dwYmNfYmZiX19maWVsZC1tb3ZlLWRvd24nLCAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9hcnJvd19kb3dud2FyZFwiPjwvaT4nICk7XHJcblx0XHRkb3duQnRuLnRpdGxlICAgPSAnTW92ZSBmaWVsZCBkb3duJztcclxuXHRcdGRvd25CdG4udHlwZSAgICA9ICdidXR0b24nO1xyXG5cdFx0ZG93bkJ0bi5vbmNsaWNrID0gZSA9PiB7IGUucHJldmVudERlZmF1bHQoKTsgd3BiY19iZmJfX21vdmVfaXRlbSggZmllbGRFbCwgJ2Rvd24nICk7IH07XHJcblx0XHQvLyBkb3duQnRuLm9uY2xpY2sgPSBlID0+IHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB3cGJjX2JmYl9fbW92ZV9maWVsZCggZmllbGRFbCwgJ2Rvd24nICk7IH07XHJcblx0XHRmaWVsZEVsLmFwcGVuZENoaWxkKCBkb3duQnRuICk7XHJcblx0fVxyXG59XHJcblxyXG4vLyA9PT0gRW5oYW5jZWQgUHJldmlldyBSZW5kZXJpbmcgU3VwcG9ydCA9PT1cclxuZnVuY3Rpb24gd3BiY19iZmJfX2RlY29yYXRlX2ZpZWxkX3ByZXZpZXcoZmllbGRFbCkge1xyXG5cdGlmICggIWZpZWxkRWwgfHwgIV93cGJjX2J1aWxkZXIucHJldmlld19tb2RlICkgcmV0dXJuO1xyXG5cclxuXHRjb25zdCBkYXRhID0gd3BiY19iZmJfX2dldF9hbGxfZGF0YV9hdHRyaWJ1dGVzKCBmaWVsZEVsICk7XHJcblxyXG5cdGNvbnN0IGZpZWxkVHlwZSAgPSBkYXRhLnR5cGU7XHJcblx0Y29uc3QgZmllbGRJZCAgICA9IGRhdGEuaWQgfHwgJyc7XHJcblx0Y29uc3QgZmllbGRMYWJlbCA9IGRhdGEubGFiZWwgfHwgZmllbGRJZDtcclxuXHJcblx0bGV0IGlucHV0SFRNTCA9ICcnO1xyXG5cclxuXHRzd2l0Y2ggKCBmaWVsZFR5cGUgKSB7XHJcblx0XHRjYXNlICd0ZXh0JzpcclxuXHRcdGNhc2UgJ3RlbCc6XHJcblx0XHRjYXNlICdlbWFpbCc6XHJcblx0XHRjYXNlICdudW1iZXInOlxyXG5cdFx0XHRpbnB1dEhUTUwgPSBgPGlucHV0IHR5cGU9XCIke2ZpZWxkVHlwZX1cIiBwbGFjZWhvbGRlcj1cIiR7ZmllbGRMYWJlbH1cIiBjbGFzcz1cIndwYmNfYmZiX19wcmV2aWV3LWlucHV0XCIgLz5gO1xyXG5cdFx0XHRicmVhaztcclxuXHJcblx0XHRjYXNlICd0ZXh0YXJlYSc6XHJcblx0XHRcdGlucHV0SFRNTCA9IGA8dGV4dGFyZWEgcGxhY2Vob2xkZXI9XCIke2ZpZWxkTGFiZWx9XCIgY2xhc3M9XCJ3cGJjX2JmYl9fcHJldmlldy10ZXh0YXJlYVwiPjwvdGV4dGFyZWE+YDtcclxuXHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0Y2FzZSAnY2hlY2tib3gnOlxyXG5cdFx0XHRpbnB1dEhUTUwgPSBgPGxhYmVsPjxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiAvPiAke2ZpZWxkTGFiZWx9PC9sYWJlbD5gO1xyXG5cdFx0XHRicmVhaztcclxuXHJcblx0XHRjYXNlICdyYWRpbyc6XHJcblx0XHRcdGlucHV0SFRNTCA9IGBcclxuXHRcdFx0XHQ8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIG5hbWU9XCIke2ZpZWxkSWR9XCIgLz4gT3B0aW9uIDE8L2xhYmVsPjxicj5cclxuXHRcdFx0XHQ8bGFiZWw+PGlucHV0IHR5cGU9XCJyYWRpb1wiIG5hbWU9XCIke2ZpZWxkSWR9XCIgLz4gT3B0aW9uIDI8L2xhYmVsPlxyXG5cdFx0XHRgO1xyXG5cdFx0XHRicmVhaztcclxuXHJcblx0XHRjYXNlICdzZWxlY3Rib3gnOlxyXG5cdFx0XHRpbnB1dEhUTUwgPSBgXHJcblx0XHRcdFx0PHNlbGVjdCBjbGFzcz1cIndwYmNfYmZiX19wcmV2aWV3LXNlbGVjdFwiPlxyXG5cdFx0XHRcdFx0PG9wdGlvbj4ke2ZpZWxkTGFiZWx9IDE8L29wdGlvbj5cclxuXHRcdFx0XHRcdDxvcHRpb24+JHtmaWVsZExhYmVsfSAyPC9vcHRpb24+XHJcblx0XHRcdFx0PC9zZWxlY3Q+XHJcblx0XHRcdGA7XHJcblx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdGNhc2UgJ2NhbGVuZGFyJzpcclxuXHRcdFx0aW5wdXRIVE1MID0gYDxpbnB1dCB0eXBlPVwidGV4dFwiIGNsYXNzPVwid3BiY19iZmJfX3ByZXZpZXctY2FsZW5kYXJcIiBwbGFjZWhvbGRlcj1cIlNlbGVjdCBEYXRlXCIgLz5gO1xyXG5cdFx0XHRicmVhaztcclxuXHJcblx0XHRjYXNlICd0aW1lc2xvdHMnOlxyXG5cdFx0XHRpbnB1dEhUTUwgPSBgPHNlbGVjdCBjbGFzcz1cIndwYmNfYmZiX19wcmV2aWV3LXNlbGVjdFwiPlxyXG5cdFx0XHRcdDxvcHRpb24+MDk6MDAg4oCTIDEwOjAwPC9vcHRpb24+XHJcblx0XHRcdFx0PG9wdGlvbj4xMDowMCDigJMgMTE6MDA8L29wdGlvbj5cclxuXHRcdFx0PC9zZWxlY3Q+YDtcclxuXHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0Y2FzZSAnY29zdGhpbnQnOlxyXG5cdFx0XHRpbnB1dEhUTUwgPSBgPHNwYW4gY2xhc3M9XCJ3cGJjX2JmYl9fcHJldmlldy1jb3N0aGludFwiPuKCrCA5OS4wMDwvc3Bhbj5gO1xyXG5cdFx0XHRicmVhaztcclxuXHJcblx0XHRkZWZhdWx0OlxyXG5cdFx0XHRpbnB1dEhUTUwgPSBgXHJcblx0XHRcdFx0PHNwYW4gY2xhc3M9XCJ3cGJjX2JmYl9fZmllbGQtbGFiZWxcIj4ke2ZpZWxkTGFiZWx9PC9zcGFuPlxyXG5cdFx0XHRcdDxzcGFuIGNsYXNzPVwid3BiY19iZmJfX2ZpZWxkLXR5cGVcIj4ke2ZpZWxkVHlwZX08L3NwYW4+XHJcblx0XHRcdGA7XHJcblx0fVxyXG5cclxuXHQvLyBSZXBsYWNlIGlubmVySFRNTCBidXQgcHJlc2VydmUgZGF0YSBhdHRyaWJ1dGVzXHJcblx0ZmllbGRFbC5pbm5lckhUTUwgPSBpbnB1dEhUTUw7XHJcblx0ZmllbGRFbC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX3ByZXZpZXctcmVuZGVyZWQnICk7XHJcblxyXG5cdC8vIEFkZCBkcmFnIGFuZCByZW1vdmUgY29udHJvbHMuXHJcblx0d3BiY19iZmJfX2FkZF9kcmFnX2hhbmRsZSggZmllbGRFbCApO1xyXG5cdHdwYmNfYmZiX19hZGRfcmVtb3ZlX2J0biggZmllbGRFbCwgKCkgPT4ge1xyXG5cdFx0ZmllbGRFbC5yZW1vdmUoKTtcclxuXHRcdHdwYmNfYmZiX19wYW5lbF9maWVsZHNfbGliX191c2FnZV9saW1pdHNfdXBkYXRlKCk7XHJcblx0fSApO1xyXG5cclxuXHQvLyBBZGQgZmllbGQgdXAvZG93biBidXR0b25zLlxyXG5cdHdwYmNfYmZiX19hZGRfZmllbGRfbW92ZV9idXR0b25zKGZpZWxkRWwpXHJcbn1cclxuXHJcblxyXG5cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyA9PT0gQWRkIGEgbmV3IHBhZ2UgPT09XHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19hZGRfcGFnZSgpIHtcclxuXHJcblx0Y29uc3QgcGFnZUVsID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCdkaXYnLCAnd3BiY19iZmJfX3BhbmVsIHdwYmNfYmZiX19wYW5lbC0tcHJldmlldycpO1xyXG5cdHBhZ2VFbC5zZXRBdHRyaWJ1dGUoICdkYXRhLXBhZ2UnLCArK193cGJjX2J1aWxkZXIucGFnZV9jb3VudGVyICk7XHJcblxyXG5cdHBhZ2VFbC5pbm5lckhUTUwgICAgICAgID0gYFxyXG5cdFx0PGgzPlBhZ2UgJHtfd3BiY19idWlsZGVyLnBhZ2VfY291bnRlcn08L2gzPlxyXG5cdFx0PGRpdiBjbGFzcz1cIndwYmNfYmZiX19jb250cm9sc1wiPlxyXG5cdFx0XHQ8bGFiZWw+QWRkIFNlY3Rpb246PC9sYWJlbD5cclxuXHRcdFx0PHNlbGVjdCBjbGFzcz1cIndwYmNfYmZiX19zZWN0aW9uLWNvbHVtbnNcIj5cclxuXHRcdFx0XHQ8b3B0aW9uIHZhbHVlPVwiMVwiPjEgQ29sdW1uPC9vcHRpb24+XHJcblx0XHRcdFx0PG9wdGlvbiB2YWx1ZT1cIjJcIj4yIENvbHVtbnM8L29wdGlvbj5cclxuXHRcdFx0XHQ8b3B0aW9uIHZhbHVlPVwiM1wiPjMgQ29sdW1uczwvb3B0aW9uPlxyXG5cdFx0XHRcdDxvcHRpb24gdmFsdWU9XCI0XCI+NCBDb2x1bW5zPC9vcHRpb24+XHJcblx0XHRcdDwvc2VsZWN0PlxyXG5cdFx0XHQ8YnV0dG9uIGNsYXNzPVwiYnV0dG9uIHdwYmNfYmZiX19hZGRfc2VjdGlvbl9idG5cIj5BZGQgU2VjdGlvbjwvYnV0dG9uPlxyXG5cdFx0PC9kaXY+XHJcblx0XHQ8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lciB3cGJjX2NvbnRhaW5lciB3cGJjX2Zvcm0gd3BiY19jb250YWluZXJfYm9va2luZ19mb3JtXCI+PC9kaXY+XHJcblx0YDtcclxuXHJcblx0Y29uc3QgZGVsZXRlUGFnZUJ0biA9IHdwYmNfYmZiX19jcmVhdGVfZWxlbWVudCggJ2EnLCAnd3BiY19iZmJfX2ZpZWxkLXJlbW92ZS1idG4nLCAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9jbG9zZVwiPjwvaT4nICk7XHJcblx0ZGVsZXRlUGFnZUJ0bi5vbmNsaWNrICAgPSAoKSA9PiB7XHJcblx0XHRwYWdlRWwucmVtb3ZlKCk7XHJcblx0XHR3cGJjX2JmYl9fcGFuZWxfZmllbGRzX2xpYl9fdXNhZ2VfbGltaXRzX3VwZGF0ZSgpO1xyXG5cdH07XHJcblxyXG5cdHBhZ2VFbC5xdWVyeVNlbGVjdG9yKCAnaDMnICkuYXBwZW5kQ2hpbGQoIGRlbGV0ZVBhZ2VCdG4gKTtcclxuXHRfd3BiY19idWlsZGVyLnBhZ2VzX2NvbnRhaW5lci5hcHBlbmRDaGlsZCggcGFnZUVsICk7XHJcblxyXG5cdGNvbnN0IHNlY3Rpb25Db250YWluZXIgPSBwYWdlRWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cclxuXHR3cGJjX2JmYl9faW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBzZWN0aW9uQ29udGFpbmVyICk7XHJcblxyXG5cdHdwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9fYWRkX3RvX2NvbnRhaW5lciggc2VjdGlvbkNvbnRhaW5lciwgMSApO1xyXG5cclxuXHRwYWdlRWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fYWRkX3NlY3Rpb25fYnRuJyApLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRjb25zdCBzZWxlY3QgPSBwYWdlRWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fc2VjdGlvbi1jb2x1bW5zJyApO1xyXG5cdFx0Y29uc3QgY29scyAgID0gcGFyc2VJbnQoIHNlbGVjdC52YWx1ZSwgMTAgKTtcclxuXHRcdHdwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9fYWRkX3RvX2NvbnRhaW5lciggc2VjdGlvbkNvbnRhaW5lciwgY29scyApO1xyXG5cdH0gKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19iZmJfX2luaXRfc2VjdGlvbl9zb3J0YWJsZShjb250YWluZXIpIHtcclxuXHJcblx0Ly8gQWxsb3cgc29ydGluZyBvZiBzZWN0aW9ucyBhdCB0b3AgbGV2ZWwgKHNlY3Rpb24gY29udGFpbmVyKSBvciBuZXN0ZWQgaW5zaWRlIGNvbHVtbnMuXHJcblx0Y29uc3QgaXNDb2x1bW4gICAgICAgPSBjb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2NvbHVtbicgKTtcclxuXHRjb25zdCBpc1RvcENvbnRhaW5lciA9IGNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fY29udGFpbmVyJyApO1xyXG5cclxuXHRpZiAoICFpc0NvbHVtbiAmJiAhaXNUb3BDb250YWluZXIgKSByZXR1cm47XHJcblxyXG5cdHdwYmNfYmZiX19pbml0X3NvcnRhYmxlKCBjb250YWluZXIgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX19hZGRfdG9fY29udGFpbmVyKGNvbnRhaW5lciwgY29scykge1xyXG5cclxuXHRjb25zdCBzZWN0aW9uID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19zZWN0aW9uJyApO1xyXG5cdHNlY3Rpb24uc2V0QXR0cmlidXRlKCAnZGF0YS1pZCcsICdzZWN0aW9uLScgKyAoKytfd3BiY19idWlsZGVyLnNlY3Rpb25fY291bnRlcikgKyAnLScgKyBEYXRlLm5vdygpICk7XHJcblxyXG5cdGNvbnN0IGhlYWRlciA9IHdwYmNfYmZiX19jcmVhdGVfZWxlbWVudCggJ2RpdicsICd3cGJjX2JmYl9fc2VjdGlvbi1oZWFkZXInICk7XHJcblx0Y29uc3QgdGl0bGUgID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnZGl2JywgJ3dwYmNfYmZiX19zZWN0aW9uLXRpdGxlJyApO1xyXG5cclxuXHRjb25zdCBkcmFnSGFuZGxlID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnc3BhbicsICd3cGJjX2JmYl9fZHJhZy1oYW5kbGUgc2VjdGlvbi1kcmFnLWhhbmRsZScsICc8c3BhbiBjbGFzcz1cIndwYmNfaWNuX2RyYWdfaW5kaWNhdG9yIHdwYmNfaWNuX3JvdGF0ZV85MFwiPjwvc3Bhbj4nICk7XHJcblxyXG5cdHRpdGxlLmFwcGVuZENoaWxkKCBkcmFnSGFuZGxlICk7XHJcblxyXG5cdC8vIFVwIEJ0bi5cclxuXHRjb25zdCBtb3ZlVXBCdG4gICA9IHdwYmNfYmZiX19jcmVhdGVfZWxlbWVudCggJ2J1dHRvbicsICd3cGJjX2JmYl9fc2VjdGlvbi1tb3ZlLXVwJywgJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fYXJyb3dfdXB3YXJkXCI+PC9pPicgKTtcclxuXHRtb3ZlVXBCdG4udGl0bGUgICA9ICdNb3ZlIHNlY3Rpb24gdXAnO1xyXG5cdG1vdmVVcEJ0bi50eXBlICAgID0gJ2J1dHRvbic7XHJcblx0bW92ZVVwQnRuLm9uY2xpY2sgPSBmdW5jdGlvbiAoZSkgeyBlLnByZXZlbnREZWZhdWx0KCk7IHdwYmNfYmZiX19tb3ZlX2l0ZW0oIHNlY3Rpb24sICd1cCcgKTsgfTtcclxuXHQvLyBtb3ZlVXBCdG4ub25jbGljayA9IGZ1bmN0aW9uIChlKSB7IGUucHJldmVudERlZmF1bHQoKTsgd3BiY19iZmJfX21vdmVfc2VjdGlvbiggc2VjdGlvbiwgJ3VwJyApOyB9O1xyXG5cclxuXHQvLyBEb3duIEJ0bi5cclxuXHRjb25zdCBtb3ZlRG93bkJ0biAgID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnYnV0dG9uJywgJ3dwYmNfYmZiX19zZWN0aW9uLW1vdmUtZG93bicsICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2Fycm93X2Rvd253YXJkXCI+PC9pPicgKTtcclxuXHRtb3ZlRG93bkJ0bi50aXRsZSAgID0gJ01vdmUgc2VjdGlvbiBkb3duJztcclxuXHRtb3ZlRG93bkJ0bi50eXBlICAgID0gJ2J1dHRvbic7XHJcblx0bW92ZURvd25CdG4ub25jbGljayA9IGZ1bmN0aW9uIChlKSB7IGUucHJldmVudERlZmF1bHQoKTsgd3BiY19iZmJfX21vdmVfaXRlbSggc2VjdGlvbiwgJ2Rvd24nICk7IH07XHJcblx0Ly9tb3ZlRG93bkJ0bi5vbmNsaWNrID0gZnVuY3Rpb24gKGUpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB3cGJjX2JmYl9fbW92ZV9zZWN0aW9uKCBzZWN0aW9uLCAnZG93bicgKTsgfTtcclxuXHJcblx0dGl0bGUuYXBwZW5kQ2hpbGQoIG1vdmVVcEJ0biApO1xyXG5cdHRpdGxlLmFwcGVuZENoaWxkKCBtb3ZlRG93bkJ0biApO1xyXG5cclxuXHQvLyBSZW1vdmUgQnRuLlxyXG5cdGNvbnN0IHJlbW92ZUJ0biAgID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnYnV0dG9uJywgJ3dwYmNfYmZiX19maWVsZC1yZW1vdmUtYnRuJywgJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fY2xvc2VcIj48L2k+JyApO1xyXG5cdHJlbW92ZUJ0bi50aXRsZSAgID0gJ1JlbW92ZSBzZWN0aW9uJztcclxuXHRyZW1vdmVCdG4udHlwZSAgICA9ICdidXR0b24nO1xyXG5cdHJlbW92ZUJ0bi5vbmNsaWNrID0gZnVuY3Rpb24gKGUpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBzZWN0aW9uLnJlbW92ZSgpOyB3cGJjX2JmYl9fcGFuZWxfZmllbGRzX2xpYl9fdXNhZ2VfbGltaXRzX3VwZGF0ZSgpOyB9O1xyXG5cclxuXHRoZWFkZXIuYXBwZW5kQ2hpbGQoIHRpdGxlICk7XHJcblx0aGVhZGVyLmFwcGVuZENoaWxkKCByZW1vdmVCdG4gKTtcclxuXHRzZWN0aW9uLmFwcGVuZENoaWxkKCBoZWFkZXIgKTtcclxuXHJcblx0Y29uc3Qgcm93ICAgICA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XHJcblx0cm93LmNsYXNzTmFtZSA9ICd3cGJjX2JmYl9fcm93JztcclxuXHJcblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgY29sczsgaSsrICkge1xyXG5cclxuXHRcdGNvbnN0IGNvbCAgICAgICAgICAgPSB3cGJjX2JmYl9fY3JlYXRlX2VsZW1lbnQoICd1bCcsICd3cGJjX2JmYl9fY29sdW1uJyApO1xyXG5cdFx0Y29sLnN0eWxlLmZsZXhCYXNpcyA9ICgxMDAgLyBjb2xzKSArICclJztcclxuXHRcdHdwYmNfYmZiX19pbml0X3NvcnRhYmxlKCBjb2wgKTtcclxuXHJcblx0XHRyb3cuYXBwZW5kQ2hpbGQoIGNvbCApO1xyXG5cdFx0aWYgKCBpIDwgY29scyAtIDEgKSB7XHJcblx0XHRcdGNvbnN0IHJlc2l6ZXIgPSB3cGJjX2JmYl9fY3JlYXRlX2VsZW1lbnQoICdkaXYnLCAnd3BiY19iZmJfX2NvbHVtbi1yZXNpemVyJyApO1xyXG5cdFx0XHRyZXNpemVyLmFkZEV2ZW50TGlzdGVuZXIoICdtb3VzZWRvd24nLCB3cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fX2luaXRfcmVzaXplICk7XHJcblx0XHRcdHJvdy5hcHBlbmRDaGlsZCggcmVzaXplciApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0c2VjdGlvbi5hcHBlbmRDaGlsZCggcm93ICk7XHJcblx0Y29udGFpbmVyLmFwcGVuZENoaWxkKCBzZWN0aW9uICk7XHJcblxyXG5cdC8vIEltcG9ydGFudDogZW5hYmxlIG5lc3RpbmcgZHJhZyBvbiB0aGlzIG5ldyBzZWN0aW9uIGFzIHdlbGxcclxuXHR3cGJjX2JmYl9faW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBzZWN0aW9uICk7XHJcbn1cclxuXHJcbi8vIFVwZGF0ZSB3cGJjX2JmYl9fcmVidWlsZF9zZWN0aW9uIHRvIHN1cHBvcnQgbmVzdGluZy5cclxuZnVuY3Rpb24gd3BiY19iZmJfX3JlYnVpbGRfc2VjdGlvbihzZWN0aW9uRGF0YSwgY29udGFpbmVyKSB7XHJcblxyXG5cdHdwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9fYWRkX3RvX2NvbnRhaW5lciggY29udGFpbmVyLCBzZWN0aW9uRGF0YS5jb2x1bW5zLmxlbmd0aCApO1xyXG5cdGNvbnN0IHNlY3Rpb24gPSBjb250YWluZXIubGFzdEVsZW1lbnRDaGlsZDtcclxuXHRzZWN0aW9uLnNldEF0dHJpYnV0ZSggJ2RhdGEtaWQnLCBzZWN0aW9uRGF0YS5pZCB8fCAoJ3NlY3Rpb24tJyArICgrK193cGJjX2J1aWxkZXIuc2VjdGlvbl9jb3VudGVyKSArICctJyArIERhdGUubm93KCkpICk7XHJcblxyXG5cdGNvbnN0IHJvdyA9IHNlY3Rpb24ucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fcm93JyApO1xyXG5cclxuXHRzZWN0aW9uRGF0YS5jb2x1bW5zLmZvckVhY2goIChjb2xEYXRhLCBpbmRleCkgPT4ge1xyXG5cdFx0Y29uc3QgY29sICAgICAgICAgICA9IHJvdy5jaGlsZHJlbltpbmRleCAqIDJdO1xyXG5cdFx0Y29sLnN0eWxlLmZsZXhCYXNpcyA9IGNvbERhdGEud2lkdGggfHwgJzEwMCUnO1xyXG5cclxuXHRcdGNvbERhdGEuZmllbGRzLmZvckVhY2goIGZpZWxkID0+IHtcclxuXHJcblx0XHRcdGNvbnN0IGVsID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnbGknLCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHR3cGJjX2JmYl9fc2V0X2RhdGFfYXR0cmlidXRlcyggZWwsIGZpZWxkICk7XHJcblxyXG5cdFx0XHRlbC5pbm5lckhUTUwgPSB3cGJjX2JmYl9fcmVuZGVyX2ZpZWxkX2lubmVyX2h0bWwoIGZpZWxkICk7XHJcblxyXG5cdFx0XHR3cGJjX2JmYl9fZGVjb3JhdGVfZmllbGQoIGVsICk7XHJcblx0XHRcdGNvbC5hcHBlbmRDaGlsZCggZWwgKTtcclxuXHRcdFx0d3BiY19iZmJfX3BhbmVsX2ZpZWxkc19saWJfX3VzYWdlX2xpbWl0c191cGRhdGUoKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQoY29sRGF0YS5zZWN0aW9ucyB8fCBbXSkuZm9yRWFjaCggbmVzdGVkID0+IHtcclxuXHRcdFx0d3BiY19iZmJfX3JlYnVpbGRfc2VjdGlvbiggbmVzdGVkLCBjb2wgKTtcclxuXHRcdH0gKTtcclxuXHR9ICk7XHJcblxyXG5cdC8vIEltcG9ydGFudDogZW5hYmxlIHNvcnRpbmcgZm9yIHRoaXMgcmVidWlsdCBzZWN0aW9uIHRvb1xyXG5cdC8vd3BiY19iZmJfX2luaXRfc2VjdGlvbl9zb3J0YWJsZShzZWN0aW9uKTtcclxuXHR3cGJjX2JmYl9faW5pdF9hbGxfbmVzdGVkX3NlY3Rpb25zKCBzZWN0aW9uICk7XHJcbn1cclxuXHJcbi8vID09IHJlY3Vyc2l2ZSBpbml0aWFsaXphdGlvbiBvZiBuZXN0ZWQgU29ydGFibGVzOiA9PVxyXG5mdW5jdGlvbiB3cGJjX2JmYl9faW5pdF9hbGxfbmVzdGVkX3NlY3Rpb25zKGNvbnRhaW5lcikge1xyXG5cdC8vIEFsc28gaW5pdGlhbGl6ZSB0aGUgY29udGFpbmVyIGl0c2VsZiBpZiBuZWVkZWQuXHJcblx0aWYgKCBjb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKSApIHtcclxuXHRcdHdwYmNfYmZiX19pbml0X3NlY3Rpb25fc29ydGFibGUoIGNvbnRhaW5lciApO1xyXG5cdH1cclxuXHJcblx0Y29uc3QgYWxsU2VjdGlvbnMgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fc2VjdGlvbicgKTtcclxuXHRhbGxTZWN0aW9ucy5mb3JFYWNoKCBzZWN0aW9uID0+IHtcclxuXHRcdC8vIEZpbmQgZWFjaCBjb2x1bW4gaW5zaWRlIHRoZSBzZWN0aW9uLlxyXG5cdFx0Y29uc3QgY29sdW1ucyA9IHNlY3Rpb24ucXVlcnlTZWxlY3RvckFsbCggJy53cGJjX2JmYl9fY29sdW1uJyApO1xyXG5cdFx0Y29sdW1ucy5mb3JFYWNoKCBjb2wgPT4gd3BiY19iZmJfX2luaXRfc2VjdGlvbl9zb3J0YWJsZSggY29sICkgKTtcclxuXHR9ICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19oYW5kbGVfb25fYWRkKGV2dCkge1xyXG5cclxuXHRpZiAoICFldnQgfHwgIWV2dC5pdGVtICkgcmV0dXJuO1xyXG5cclxuXHQvLyA9PT0gSWYgZHJvcHBlZCBpdGVtIGlzIGEgRklFTEQgPT09XHJcblx0bGV0IG5ld0l0ZW0gICAgPSBldnQuaXRlbTtcclxuXHRjb25zdCBpc0Nsb25lZCA9IGV2dC5mcm9tLmlkID09PSAnd3BiY19iZmJfX3BhbmVsX2ZpZWxkX3R5cGVzX191bCc7XHJcblx0Y29uc3QgZmllbGRJZCAgPSBuZXdJdGVtLmRhdGFzZXQuaWQ7XHJcblx0aWYgKCAhZmllbGRJZCApIHJldHVybjtcclxuXHRjb25zdCB1c2FnZUxpbWl0ID0gcGFyc2VJbnQoIG5ld0l0ZW0uZGF0YXNldC51c2FnZW51bWJlciB8fCBJbmZpbml0eSwgMTAgKTtcclxuXHJcblx0aWYgKCBpc0Nsb25lZCApIHtcclxuXHRcdGNvbnN0IGZpZWxkRGF0YSA9IHdwYmNfYmZiX19nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyggbmV3SXRlbSApO1xyXG5cdFx0ZXZ0Lml0ZW0ucmVtb3ZlKCk7XHJcblx0XHRjb25zdCByZWJ1aWx0RmllbGQgPSB3cGJjX2JmYl9fYnVpbGRfZmllbGQoIGZpZWxkRGF0YSApO1xyXG5cdFx0ZXZ0LnRvLmluc2VydEJlZm9yZSggcmVidWlsdEZpZWxkLCBldnQudG8uY2hpbGRyZW5bZXZ0Lm5ld0luZGV4XSApO1xyXG5cdFx0bmV3SXRlbSA9IHJlYnVpbHRGaWVsZDtcclxuXHR9XHJcblxyXG5cdGNvbnN0IGFsbFVzZWQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCBgLndwYmNfYmZiX19wYW5lbC0tcHJldmlldyAud3BiY19iZmJfX2ZpZWxkW2RhdGEtaWQ9XCIke2ZpZWxkSWR9XCJdYCApO1xyXG5cdGlmICggYWxsVXNlZC5sZW5ndGggPiB1c2FnZUxpbWl0ICkge1xyXG5cdFx0YWxlcnQoIGBPbmx5ICR7dXNhZ2VMaW1pdH0gaW5zdGFuY2Uke3VzYWdlTGltaXQgPiAxID8gJ3MnIDogJyd9IG9mIFwiJHtmaWVsZElkfVwiIGFsbG93ZWQuYCApO1xyXG5cdFx0bmV3SXRlbS5yZW1vdmUoKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmICggbmV3SXRlbS5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdGNvbnN0IG5lc3RpbmdMZXZlbCA9IHdwYmNfYmZiX19nZXRfbmVzdGluZ19sZXZlbCggbmV3SXRlbSApO1xyXG5cdFx0aWYgKCBuZXN0aW5nTGV2ZWwgPj0gX3dwYmNfYnVpbGRlci5tYXhfbmVzdGVkX3ZhbHVlICkge1xyXG5cdFx0XHRhbGVydCggJ1RvbyBtYW55IG5lc3RlZCBzZWN0aW9ucy4nICk7XHJcblx0XHRcdG5ld0l0ZW0ucmVtb3ZlKCk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHR9XHJcblx0Ly8gQWRkIHRoaXMgbGluZSByaWdodCBhZnRlciB1c2FnZSBjaGVjazouXHJcblx0d3BiY19iZmJfX2RlY29yYXRlX2ZpZWxkKCBuZXdJdGVtICk7XHJcblxyXG5cdHdwYmNfYmZiX19wYW5lbF9maWVsZHNfbGliX191c2FnZV9saW1pdHNfdXBkYXRlKCk7XHJcblxyXG5cdC8vIElmIHRoaXMgaXMgYSBuZXdseSBhZGRlZCBzZWN0aW9uLCBpbml0aWFsaXplIHNvcnRhYmxlIGluc2lkZSBpdC5cclxuXHRpZiAoIG5ld0l0ZW0uY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgKSB7XHJcblx0XHR3cGJjX2JmYl9faW5pdF9zZWN0aW9uX3NvcnRhYmxlKCBuZXdJdGVtICk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fYnVpbGRfZmllbGQoZmllbGREYXRhKSB7XHJcblxyXG5cdGNvbnN0IGVsID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnbGknLCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdHdwYmNfYmZiX19zZXRfZGF0YV9hdHRyaWJ1dGVzKCBlbCwgZmllbGREYXRhICk7XHJcblxyXG5cdGVsLmlubmVySFRNTCA9IHdwYmNfYmZiX19yZW5kZXJfZmllbGRfaW5uZXJfaHRtbCggZmllbGREYXRhICk7XHJcblxyXG5cdHdwYmNfYmZiX19kZWNvcmF0ZV9maWVsZCggZWwgKTtcclxuXHRyZXR1cm4gZWw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19yZW5kZXJfZmllbGRfaW5uZXJfaHRtbChmaWVsZERhdGEpIHtcclxuXHRjb25zdCBsYWJlbCAgICAgID0gU3RyaW5nKCBmaWVsZERhdGEubGFiZWwgfHwgZmllbGREYXRhLmlkIHx8ICcobm8gbGFiZWwpJyApO1xyXG5cdGNvbnN0IHR5cGUgICAgICAgPSBTdHJpbmcoIGZpZWxkRGF0YS50eXBlIHx8ICd1bmtub3duJyApO1xyXG5cdGNvbnN0IGlzUmVxdWlyZWQgPSBmaWVsZERhdGEucmVxdWlyZWQgPT09IHRydWUgfHwgZmllbGREYXRhLnJlcXVpcmVkID09PSAndHJ1ZSc7XHJcblxyXG5cdHJldHVybiBgXHJcblx0XHQ8c3BhbiBjbGFzcz1cIndwYmNfYmZiX19maWVsZC1sYWJlbFwiPiR7bGFiZWx9JHtpc1JlcXVpcmVkID8gJyAqJyA6ICcnfTwvc3Bhbj5cclxuXHRcdDxzcGFuIGNsYXNzPVwid3BiY19iZmJfX2ZpZWxkLXR5cGVcIj4ke3R5cGV9PC9zcGFuPlxyXG5cdGA7XHJcbn1cclxuXHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X25lc3RpbmdfbGV2ZWwoc2VjdGlvbkVsKSB7XHJcblx0bGV0IGxldmVsICA9IDA7XHJcblx0bGV0IHBhcmVudCA9IHNlY3Rpb25FbC5jbG9zZXN0KCAnLndwYmNfYmZiX19jb2x1bW4nICk7XHJcblxyXG5cdHdoaWxlICggcGFyZW50ICkge1xyXG5cdFx0Y29uc3Qgb3V0ZXJTZWN0aW9uID0gcGFyZW50LmNsb3Nlc3QoICcud3BiY19iZmJfX3NlY3Rpb24nICk7XHJcblx0XHRpZiAoICFvdXRlclNlY3Rpb24gKSBicmVhaztcclxuXHRcdGxldmVsKys7XHJcblx0XHRwYXJlbnQgPSBvdXRlclNlY3Rpb24uY2xvc2VzdCggJy53cGJjX2JmYl9fY29sdW1uJyApO1xyXG5cdH1cclxuXHRyZXR1cm4gbGV2ZWw7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19kZWNvcmF0ZV9maWVsZChmaWVsZEVsKSB7XHJcblxyXG5cdGlmICggISBmaWVsZEVsICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHRpZiAoIGZpZWxkRWwuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX3NlY3Rpb24nICkgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRmaWVsZEVsLmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fZmllbGQnICk7XHJcblxyXG5cdGlmICggX3dwYmNfYnVpbGRlci5wcmV2aWV3X21vZGUgKSB7XHJcblx0XHR3cGJjX2JmYl9fZGVjb3JhdGVfZmllbGRfcHJldmlldyggZmllbGRFbCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR3cGJjX2JmYl9fYWRkX2RyYWdfaGFuZGxlKCBmaWVsZEVsICk7XHJcblx0XHR3cGJjX2JmYl9fYWRkX3JlbW92ZV9idG4oIGZpZWxkRWwsICgpID0+IHtcclxuXHRcdFx0ZmllbGRFbC5yZW1vdmUoKTtcclxuXHRcdFx0d3BiY19iZmJfX3BhbmVsX2ZpZWxkc19saWJfX3VzYWdlX2xpbWl0c191cGRhdGUoKTtcclxuXHRcdH0gKTtcclxuXHRcdHdwYmNfYmZiX19hZGRfZmllbGRfbW92ZV9idXR0b25zKCBmaWVsZEVsICk7XHJcblx0fVxyXG59XHJcblxyXG4vLyA9PT0gTW92ZSBpdGVtIChzZWN0aW9uICBvciBmaWVsZCkgIHVwL2Rvd24gd2l0aGluIGl0cyBjb250YWluZXIgPT09XHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19tb3ZlX2l0ZW0oZWwsIGRpcmVjdGlvbikge1xyXG5cdGNvbnN0IGNvbnRhaW5lciA9IGVsLnBhcmVudEVsZW1lbnQ7XHJcblx0aWYgKCAhY29udGFpbmVyICkgcmV0dXJuO1xyXG5cclxuXHRjb25zdCBzaWJsaW5ncyA9IEFycmF5LmZyb20oIGNvbnRhaW5lci5jaGlsZHJlbiApLmZpbHRlciggY2hpbGQgPT5cclxuXHRcdGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19maWVsZCcgKSB8fCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKVxyXG5cdCk7XHJcblxyXG5cdGNvbnN0IGN1cnJlbnRJbmRleCA9IHNpYmxpbmdzLmluZGV4T2YoIGVsICk7XHJcblx0aWYgKCBjdXJyZW50SW5kZXggPT09IC0xICkgcmV0dXJuO1xyXG5cclxuXHRjb25zdCBuZXdJbmRleCA9IGRpcmVjdGlvbiA9PT0gJ3VwJyA/IGN1cnJlbnRJbmRleCAtIDEgOiBjdXJyZW50SW5kZXggKyAxO1xyXG5cdGlmICggbmV3SW5kZXggPCAwIHx8IG5ld0luZGV4ID49IHNpYmxpbmdzLmxlbmd0aCApIHJldHVybjtcclxuXHJcblx0Y29uc3QgcmVmZXJlbmNlTm9kZSA9IHNpYmxpbmdzW25ld0luZGV4XTtcclxuXHRpZiAoIGRpcmVjdGlvbiA9PT0gJ3VwJyApIHtcclxuXHRcdGNvbnRhaW5lci5pbnNlcnRCZWZvcmUoIGVsLCByZWZlcmVuY2VOb2RlICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGNvbnRhaW5lci5pbnNlcnRCZWZvcmUoIHJlZmVyZW5jZU5vZGUsIGVsICk7XHJcblx0fVxyXG59XHJcblxyXG5cdC8vID09PSBEZXByZWNhdGVkOiBNb3ZlIHNlY3Rpb24gdXAvZG93biB3aXRoaW4gaXRzIGNvbnRhaW5lciA9PT1cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fbW92ZV9zZWN0aW9uKHNlY3Rpb25FbCwgZGlyZWN0aW9uKSB7XHJcblx0XHRjb25zdCBjb250YWluZXIgPSBzZWN0aW9uRWwucGFyZW50RWxlbWVudDtcclxuXHRcdGlmICggIWNvbnRhaW5lciApIHJldHVybjtcclxuXHJcblx0XHQvLyBPbmx5IGRpcmVjdCBjaGlsZHJlbiB0aGF0IGFyZSAud3BiY19iZmJfX3NlY3Rpb25cclxuXHRcdGNvbnN0IGFsbFNlY3Rpb25zID0gQXJyYXkuZnJvbSggY29udGFpbmVyLmNoaWxkcmVuICkuZmlsdGVyKCBjaGlsZCA9PlxyXG5cdFx0XHRjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKVxyXG5cdFx0KTtcclxuXHJcblx0XHRjb25zdCBjdXJyZW50SW5kZXggPSBhbGxTZWN0aW9ucy5pbmRleE9mKCBzZWN0aW9uRWwgKTtcclxuXHRcdGlmICggY3VycmVudEluZGV4ID09PSAtMSApIHJldHVybjtcclxuXHJcblx0XHRjb25zdCBuZXdJbmRleCA9IGRpcmVjdGlvbiA9PT0gJ3VwJyA/IGN1cnJlbnRJbmRleCAtIDEgOiBjdXJyZW50SW5kZXggKyAxO1xyXG5cdFx0aWYgKCBuZXdJbmRleCA8IDAgfHwgbmV3SW5kZXggPj0gYWxsU2VjdGlvbnMubGVuZ3RoICkgcmV0dXJuO1xyXG5cclxuXHRcdGNvbnN0IHJlZmVyZW5jZU5vZGUgPSBhbGxTZWN0aW9uc1tuZXdJbmRleF07XHJcblx0XHRpZiAoIGRpcmVjdGlvbiA9PT0gJ3VwJyApIHtcclxuXHRcdFx0Y29udGFpbmVyLmluc2VydEJlZm9yZSggc2VjdGlvbkVsLCByZWZlcmVuY2VOb2RlICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRjb250YWluZXIuaW5zZXJ0QmVmb3JlKCByZWZlcmVuY2VOb2RlLCBzZWN0aW9uRWwgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vID09PSBEZXByZWNhdGVkOiBNb3ZlIGZpZWxkIHVwL2Rvd24gd2l0aGluIGl0cyBjb250YWluZXIgPT09XHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX21vdmVfZmllbGQoZmllbGRFbCwgZGlyZWN0aW9uKSB7XHJcblx0XHRjb25zdCBwYXJlbnQgPSBmaWVsZEVsLnBhcmVudEVsZW1lbnQ7XHJcblx0XHRpZiAoICFwYXJlbnQgKSByZXR1cm47XHJcblxyXG5cdFx0Ly8gT25seSBkaXJlY3QgY2hpbGRyZW4gdGhhdCBhcmUgZmllbGRzXHJcblx0XHRjb25zdCBmaWVsZHMgPSBBcnJheS5mcm9tKHBhcmVudC5jaGlsZHJlbikuZmlsdGVyKGNoaWxkID0+XHJcblx0XHRcdGNoaWxkLmNsYXNzTGlzdC5jb250YWlucygnd3BiY19iZmJfX2ZpZWxkJykgJiYgIWNoaWxkLmNsYXNzTGlzdC5jb250YWlucygnd3BiY19iZmJfX3NlY3Rpb24nKVxyXG5cdFx0KTtcclxuXHJcblx0XHRjb25zdCBpbmRleCA9IGZpZWxkcy5pbmRleE9mKGZpZWxkRWwpO1xyXG5cdFx0aWYgKGluZGV4ID09PSAtMSkgcmV0dXJuO1xyXG5cclxuXHRcdGNvbnN0IG5ld0luZGV4ID0gZGlyZWN0aW9uID09PSAndXAnID8gaW5kZXggLSAxIDogaW5kZXggKyAxO1xyXG5cdFx0aWYgKG5ld0luZGV4IDwgMCB8fCBuZXdJbmRleCA+PSBmaWVsZHMubGVuZ3RoKSByZXR1cm47XHJcblxyXG5cdFx0Y29uc3QgcmVmZXJlbmNlID0gZmllbGRzW25ld0luZGV4XTtcclxuXHRcdGlmIChkaXJlY3Rpb24gPT09ICd1cCcpIHtcclxuXHRcdFx0cGFyZW50Lmluc2VydEJlZm9yZShmaWVsZEVsLCByZWZlcmVuY2UpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cGFyZW50Lmluc2VydEJlZm9yZShyZWZlcmVuY2UsIGZpZWxkRWwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG4vLyA9PT0gRmllbGQgdXNhZ2UgbGltaXQgdXBkYXRlciA9PT1cclxuZnVuY3Rpb24gd3BiY19iZmJfX3BhbmVsX2ZpZWxkc19saWJfX3VzYWdlX2xpbWl0c191cGRhdGUoKSB7XHJcblx0Y29uc3QgYWxsVXNlZEZpZWxkcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3IC53cGJjX2JmYl9fZmllbGQnICk7XHJcblx0Y29uc3QgdXNhZ2VDb3VudCAgICA9IHt9O1xyXG5cclxuXHRhbGxVc2VkRmllbGRzLmZvckVhY2goIGZpZWxkID0+IHtcclxuXHRcdGNvbnN0IGlkICAgICAgID0gZmllbGQuZGF0YXNldC5pZDtcclxuXHRcdHVzYWdlQ291bnRbaWRdID0gKHVzYWdlQ291bnRbaWRdIHx8IDApICsgMTtcclxuXHR9ICk7XHJcblxyXG5cdGlmICggbnVsbCAhPT0gX3dwYmNfYnVpbGRlci5wYW5lbF9maWVsZHNfbGliX3VsICkge1xyXG5cdFx0X3dwYmNfYnVpbGRlci5wYW5lbF9maWVsZHNfbGliX3VsLnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2ZpZWxkJyApLmZvckVhY2goIHBhbmVsRmllbGQgPT4ge1xyXG5cdFx0XHRjb25zdCBpZCAgICAgICAgICAgICAgICAgICAgICAgPSBwYW5lbEZpZWxkLmRhdGFzZXQuaWQ7XHJcblx0XHRcdGNvbnN0IGxpbWl0ICAgICAgICAgICAgICAgICAgICA9IHBhcnNlSW50KCBwYW5lbEZpZWxkLmRhdGFzZXQudXNhZ2VudW1iZXIgfHwgSW5maW5pdHksIDEwICk7XHJcblx0XHRcdGNvbnN0IGN1cnJlbnQgICAgICAgICAgICAgICAgICA9IHVzYWdlQ291bnRbaWRdIHx8IDA7XHJcblx0XHRcdHBhbmVsRmllbGQuc3R5bGUucG9pbnRlckV2ZW50cyA9IGN1cnJlbnQgPj0gbGltaXQgPyAnbm9uZScgOiAnJztcclxuXHRcdFx0cGFuZWxGaWVsZC5zdHlsZS5vcGFjaXR5ICAgICAgID0gY3VycmVudCA+PSBsaW1pdCA/ICcwLjQnIDogJyc7XHJcblx0XHR9ICk7XHJcblx0fVxyXG59XHJcblxyXG4vLyA9PT0gQ29sdW1uIHJlc2l6aW5nIGxvZ2ljID09PVxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fZm9ybV9wcmV2aWV3X3NlY3Rpb25fX2luaXRfcmVzaXplKGUpIHtcclxuXHRjb25zdCByZXNpemVyICAgID0gZS50YXJnZXQ7XHJcblx0Y29uc3QgbGVmdENvbCAgICA9IHJlc2l6ZXIucHJldmlvdXNFbGVtZW50U2libGluZztcclxuXHRjb25zdCByaWdodENvbCAgID0gcmVzaXplci5uZXh0RWxlbWVudFNpYmxpbmc7XHJcblx0Y29uc3Qgc3RhcnRYICAgICA9IGUuY2xpZW50WDtcclxuXHRjb25zdCBsZWZ0V2lkdGggID0gbGVmdENvbC5vZmZzZXRXaWR0aDtcclxuXHRjb25zdCByaWdodFdpZHRoID0gcmlnaHRDb2wub2Zmc2V0V2lkdGg7XHJcblx0Y29uc3QgdG90YWxXaWR0aCA9IGxlZnRXaWR0aCArIHJpZ2h0V2lkdGg7XHJcblxyXG5cdGlmICggIWxlZnRDb2wgfHwgIXJpZ2h0Q29sIHx8ICFsZWZ0Q29sLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19jb2x1bW4nICkgfHwgIXJpZ2h0Q29sLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19jb2x1bW4nICkgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvbk1vdXNlTW92ZShlKSB7XHJcblx0XHRjb25zdCBkZWx0YSAgICAgID0gZS5jbGllbnRYIC0gc3RhcnRYO1xyXG5cdFx0bGV0IGxlZnRQZXJjZW50ICA9ICgobGVmdFdpZHRoICsgZGVsdGEpIC8gdG90YWxXaWR0aCkgKiAxMDA7XHJcblx0XHRsZXQgcmlnaHRQZXJjZW50ID0gKChyaWdodFdpZHRoIC0gZGVsdGEpIC8gdG90YWxXaWR0aCkgKiAxMDA7XHJcblx0XHRpZiAoIGxlZnRQZXJjZW50IDwgNSB8fCByaWdodFBlcmNlbnQgPCA1ICkgcmV0dXJuO1xyXG5cdFx0bGVmdENvbC5zdHlsZS5mbGV4QmFzaXMgID0gYCR7bGVmdFBlcmNlbnR9JWA7XHJcblx0XHRyaWdodENvbC5zdHlsZS5mbGV4QmFzaXMgPSBgJHtyaWdodFBlcmNlbnR9JWA7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBvbk1vdXNlVXAoKSB7XHJcblx0XHRkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCAnbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUgKTtcclxuXHRcdGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdtb3VzZXVwJywgb25Nb3VzZVVwICk7XHJcblx0fVxyXG5cclxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2Vtb3ZlJywgb25Nb3VzZU1vdmUgKTtcclxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnbW91c2V1cCcsIG9uTW91c2VVcCApO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X2Zvcm1fc3RydWN0dXJlKCkge1xyXG5cdGNvbnN0IHBhZ2VzID0gW107XHJcblxyXG5cdGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX3BhbmVsLS1wcmV2aWV3JyApLmZvckVhY2goIChwYWdlRWwsIHBhZ2VJbmRleCkgPT4ge1xyXG5cclxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IHBhZ2VFbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19mb3JtX3ByZXZpZXdfc2VjdGlvbl9jb250YWluZXInICk7XHJcblxyXG5cdFx0Y29uc3Qgc2VjdGlvbnMgICAgPSBbXTtcclxuXHRcdGNvbnN0IGxvb3NlRmllbGRzID0gW107XHJcblxyXG5cdFx0Y29uc3Qgb3JkZXJlZEVsZW1lbnRzID0gW107XHJcblxyXG5cdFx0Y29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoICc6c2NvcGUgPiAqJyApLmZvckVhY2goIGNoaWxkID0+IHtcclxuXHRcdFx0aWYgKCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fc2VjdGlvbicgKSApIHtcclxuXHRcdFx0XHRvcmRlcmVkRWxlbWVudHMucHVzaCgge1xyXG5cdFx0XHRcdFx0dHlwZTogJ3NlY3Rpb24nLFxyXG5cdFx0XHRcdFx0ZGF0YTogd3BiY19iZmJfX3NlcmlhbGl6ZV9zZWN0aW9uKCBjaGlsZCApXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCBjaGlsZC5jbGFzc0xpc3QuY29udGFpbnMoICd3cGJjX2JmYl9fZmllbGQnICkgKSB7XHJcblx0XHRcdFx0b3JkZXJlZEVsZW1lbnRzLnB1c2goIHtcclxuXHRcdFx0XHRcdHR5cGU6ICdmaWVsZCcsXHJcblx0XHRcdFx0XHRkYXRhOiB3cGJjX2JmYl9fZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGNoaWxkIClcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRwYWdlcy5wdXNoKCB7XHJcblx0XHRcdHBhZ2UgICA6IHBhZ2VJbmRleCArIDEsXHJcblx0XHRcdGNvbnRlbnQ6IG9yZGVyZWRFbGVtZW50c1xyXG5cdFx0fSApO1xyXG5cclxuXHR9ICk7XHJcblxyXG5cdHJldHVybiBwYWdlcztcclxufVxyXG5cclxuZnVuY3Rpb24gd3BiY19iZmJfX3NlcmlhbGl6ZV9zZWN0aW9uKHNlY3Rpb25FbCkge1xyXG5cdGNvbnN0IHJvdyAgICAgPSBzZWN0aW9uRWwucXVlcnlTZWxlY3RvciggJzpzY29wZSA+IC53cGJjX2JmYl9fcm93JyApO1xyXG5cdGNvbnN0IGNvbHVtbnMgPSBbXTtcclxuXHJcblx0aWYgKCAhcm93ICkgcmV0dXJuIHsgaWQ6IHNlY3Rpb25FbC5kYXRhc2V0LmlkLCBjb2x1bW5zOiBbXSB9O1xyXG5cclxuXHRyb3cucXVlcnlTZWxlY3RvckFsbCggJzpzY29wZSA+IC53cGJjX2JmYl9fY29sdW1uJyApLmZvckVhY2goIGNvbCA9PiB7XHJcblx0XHRjb25zdCB3aWR0aCAgICA9IGNvbC5zdHlsZS5mbGV4QmFzaXMgfHwgJzEwMCUnO1xyXG5cdFx0Y29uc3QgZmllbGRzICAgPSBbXTtcclxuXHRcdGNvbnN0IHNlY3Rpb25zID0gW107XHJcblxyXG5cdFx0Ly8gTG9vcCB0aHJvdWdoIGRpcmVjdCBjaGlsZHJlbiBvZiB0aGUgY29sdW1uLlxyXG5cdFx0QXJyYXkuZnJvbSggY29sLmNoaWxkcmVuICkuZm9yRWFjaCggY2hpbGQgPT4ge1xyXG5cdFx0XHRpZiAoIGNoaWxkLmNsYXNzTGlzdC5jb250YWlucyggJ3dwYmNfYmZiX19zZWN0aW9uJyApICkge1xyXG5cdFx0XHRcdC8vIFJlY3Vyc2UgaW50byBuZXN0ZWQgc2VjdGlvbi5cclxuXHRcdFx0XHRzZWN0aW9ucy5wdXNoKCB3cGJjX2JmYl9fc2VyaWFsaXplX3NlY3Rpb24oIGNoaWxkICkgKTtcclxuXHRcdFx0fSBlbHNlIGlmICggY2hpbGQuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX2ZpZWxkJyApICkge1xyXG5cdFx0XHRcdC8vIE9ubHkgc2VyaWFsaXplIHJlYWwgZmllbGRzLlxyXG5cdFx0XHRcdGZpZWxkcy5wdXNoKCB3cGJjX2JmYl9fZ2V0X2FsbF9kYXRhX2F0dHJpYnV0ZXMoIGNoaWxkICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGNvbHVtbnMucHVzaCggeyB3aWR0aCwgZmllbGRzLCBzZWN0aW9ucyB9ICk7XHJcblx0fSApO1xyXG5cclxuXHRyZXR1cm4ge1xyXG5cdFx0aWQ6IHNlY3Rpb25FbC5kYXRhc2V0LmlkLFxyXG5cdFx0Y29sdW1uc1xyXG5cdH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19nZXRfYWxsX2RhdGFfYXR0cmlidXRlcyhlbCkge1xyXG5cdGNvbnN0IGRhdGEgPSB7fTtcclxuXHRpZiAoICFlbCB8fCAhZWwuYXR0cmlidXRlcyApIHJldHVybiBkYXRhO1xyXG5cclxuXHRBcnJheS5mcm9tKCBlbC5hdHRyaWJ1dGVzICkuZm9yRWFjaCggYXR0ciA9PiB7XHJcblx0XHRpZiAoIGF0dHIubmFtZS5zdGFydHNXaXRoKCAnZGF0YS0nICkgKSB7XHJcblx0XHRcdGNvbnN0IGtleSA9IGF0dHIubmFtZS5yZXBsYWNlKCAvXmRhdGEtLywgJycgKTtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRkYXRhW2tleV0gPSBKU09OLnBhcnNlKCBhdHRyLnZhbHVlICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdGRhdGFba2V5XSA9IGF0dHIudmFsdWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdGlmICggIWRhdGEubGFiZWwgJiYgZGF0YS5pZCApIHtcclxuXHRcdGRhdGEubGFiZWwgPSBkYXRhLmlkLmNoYXJBdCggMCApLnRvVXBwZXJDYXNlKCkgKyBkYXRhLmlkLnNsaWNlKCAxICk7XHJcblx0fVxyXG5cdHJldHVybiBkYXRhO1xyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fbG9hZF9zYXZlZF9zdHJ1Y3R1cmUoc3RydWN0dXJlKSB7XHJcblx0X3dwYmNfYnVpbGRlci5wYWdlc19jb250YWluZXIuaW5uZXJIVE1MID0gJyc7XHJcblx0X3dwYmNfYnVpbGRlci5wYWdlX2NvdW50ZXIgICAgICAgICAgICAgID0gMDtcclxuXHJcblx0c3RydWN0dXJlLmZvckVhY2goIHBhZ2VEYXRhID0+IHtcclxuXHRcdHdwYmNfYmZiX19hZGRfcGFnZSgpOyAvLyBpbmNyZW1lbnRzIF93cGJjX2J1aWxkZXIucGFnZV9jb3VudGVyXHJcblx0XHRjb25zdCBwYWdlRWwgICAgICAgICAgID0gX3dwYmNfYnVpbGRlci5wYWdlc19jb250YWluZXIucXVlcnlTZWxlY3RvciggYC53cGJjX2JmYl9fcGFuZWwtLXByZXZpZXdbZGF0YS1wYWdlPVwiJHtfd3BiY19idWlsZGVyLnBhZ2VfY291bnRlcn1cIl1gICk7XHJcblx0XHRjb25zdCBzZWN0aW9uQ29udGFpbmVyID0gcGFnZUVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2Zvcm1fcHJldmlld19zZWN0aW9uX2NvbnRhaW5lcicgKTtcclxuXHJcblx0XHRzZWN0aW9uQ29udGFpbmVyLmlubmVySFRNTCA9ICcnOyAvLyByZW1vdmUgZGVmYXVsdCBzZWN0aW9uLlxyXG5cdFx0d3BiY19iZmJfX2luaXRfc2VjdGlvbl9zb3J0YWJsZSggc2VjdGlvbkNvbnRhaW5lciApOyAvLyBJbml0aWFsaXplIHRvcC1sZXZlbCBzb3J0aW5nXHJcblxyXG5cdFx0KHBhZ2VEYXRhLmNvbnRlbnQgfHwgW10pLmZvckVhY2goIGl0ZW0gPT4ge1xyXG5cdFx0XHRpZiAoIGl0ZW0udHlwZSA9PT0gJ3NlY3Rpb24nICkge1xyXG5cdFx0XHRcdHdwYmNfYmZiX19yZWJ1aWxkX3NlY3Rpb24oIGl0ZW0uZGF0YSwgc2VjdGlvbkNvbnRhaW5lciApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCBpdGVtLnR5cGUgPT09ICdmaWVsZCcgKSB7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGVsID0gd3BiY19iZmJfX2NyZWF0ZV9lbGVtZW50KCAnbGknLCAnd3BiY19iZmJfX2ZpZWxkJyApO1xyXG5cdFx0XHRcdHdwYmNfYmZiX19zZXRfZGF0YV9hdHRyaWJ1dGVzKCBlbCwgaXRlbS5kYXRhICk7XHJcblx0XHRcdFx0ZWwuaW5uZXJIVE1MID0gd3BiY19iZmJfX3JlbmRlcl9maWVsZF9pbm5lcl9odG1sKCBpdGVtLmRhdGEgKTtcclxuXHJcblx0XHRcdFx0d3BiY19iZmJfX2RlY29yYXRlX2ZpZWxkKCBlbCApO1xyXG5cdFx0XHRcdHNlY3Rpb25Db250YWluZXIuYXBwZW5kQ2hpbGQoIGVsICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0fSApO1xyXG5cclxuXHR3cGJjX2JmYl9fcGFuZWxfZmllbGRzX2xpYl9fdXNhZ2VfbGltaXRzX3VwZGF0ZSgpO1xyXG59XHJcblxyXG4vLyA9PT0gSW5pdCBTb3J0YWJsZSBvbiB0aGUgRmllbGQgUGFsZXR0ZSA9PT1cclxuaWYgKCBudWxsICE9PSBfd3BiY19idWlsZGVyLnBhbmVsX2ZpZWxkc19saWJfdWwgKSB7XHJcblx0U29ydGFibGUuY3JlYXRlKCBfd3BiY19idWlsZGVyLnBhbmVsX2ZpZWxkc19saWJfdWwsIHtcclxuXHRcdGdyb3VwICAgICAgOiB7IG5hbWU6ICdmb3JtJywgcHVsbDogJ2Nsb25lJywgcHV0OiBmYWxzZSB9LFxyXG5cdFx0YW5pbWF0aW9uICA6IDE1MCxcclxuXHRcdGdob3N0Q2xhc3MgOiAnd3BiY19iZmJfX2RyYWctZ2hvc3QnLFxyXG5cdFx0Y2hvc2VuQ2xhc3M6ICd3cGJjX2JmYl9faGlnaGxpZ2h0JyxcclxuXHRcdGRyYWdDbGFzcyAgOiAnd3BiY19iZmJfX2RyYWctYWN0aXZlJyxcclxuXHRcdHNvcnQgICAgICAgOiBmYWxzZSxcclxuXHRcdG9uU3RhcnQgICAgOiBmdW5jdGlvbiAoKSB7IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCBjb2wgPT4gY29sLmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fZHJhZ2dpbmcnICkgKTsgfSxcclxuXHRcdG9uRW5kICAgICAgOiBmdW5jdGlvbiAoKSB7IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2NvbHVtbicgKS5mb3JFYWNoKCBjb2wgPT4gY29sLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fZHJhZ2dpbmcnICkgKTsgfVxyXG5cdH0gKTtcclxufSBlbHNlIHtcclxuXHRjb25zb2xlLmxvZyggJ1dQQkMgV2FybmluZyEgIEZvcm0gZmllbGRzIHBhbGxldGUgbm90IGRlZmluZWQuJyApO1xyXG59XHJcblxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19zYXZlX2J0bicgKS5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG5cclxuXHRlLnByZXZlbnREZWZhdWx0KCk7IC8vIFN0b3AgcGFnZSByZWxvYWQuXHJcblxyXG5cdGNvbnN0IHN0cnVjdHVyZSA9IHdwYmNfYmZiX19nZXRfZm9ybV9zdHJ1Y3R1cmUoKTtcclxuXHRjb25zb2xlLmxvZyggSlNPTi5zdHJpbmdpZnkoIHN0cnVjdHVyZSwgbnVsbCwgMiApICk7IC8vIE9yIHNhdmUgdmlhIEFKQVguXHJcblxyXG5cclxuXHQvLyBjb25zb2xlLmxvZyggJ0xvYWRlZCBKU09OOicsIEpTT04uc3RyaW5naWZ5KCB3cGJjX2JmYl9fZm9ybV9zdHJ1Y3R1cmVfX2dldF9leGFtcGxlKCksIG51bGwsIDIgKSApO1xyXG5cdC8vIGNvbnNvbGUubG9nKCAnU2F2ZWQgSlNPTjonLCBKU09OLnN0cmluZ2lmeSggd3BiY19iZmJfX2dldF9mb3JtX3N0cnVjdHVyZSgpLCBudWxsLCAyICkgKTtcclxuXHJcblx0Ly8gQ3VzdG9tIGV2ZW50IGZvciBjb21tdW5pY2F0aW9uIChlLmcuIEVsZW1lbnRvciBwcmV2aWV3IG1vZGUpLlxyXG5cdGNvbnN0IGV2ZW50ID0gbmV3IEN1c3RvbUV2ZW50KCAnd3BiY19iZmJfZm9ybV91cGRhdGVkJywgeyBkZXRhaWw6IHN0cnVjdHVyZSB9ICk7XHJcblx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggZXZlbnQgKTtcclxuXHJcblx0Ly8gRXhhbXBsZTogc2VuZCB0byBzZXJ2ZXIuXHJcblx0Ly8gd3BiY19hamF4X3NhdmVfZm9ybShzdHJ1Y3R1cmUpO1xyXG59ICk7XHJcblxyXG4vLyA9PT0gSW5pdGlhbGl6ZSBkZWZhdWx0IGZpcnN0IHBhZ2UgPT09XHJcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcclxuXHJcblx0Ly8gU3RhbmRhcmQgSW5pdGlsaXppbmcgb25lIHBhZ2UuXHJcblx0Ly9cdCB3cGJjX2JmYl9fYWRkX3BhZ2UoKTsgcmV0dXJuO1xyXG5cclxuXHQvLyBMb2FkIHlvdXIgc2F2ZWQgZm9ybSBzdHJ1Y3R1cmUgaGVyZTouXHJcblx0Y29uc3Qgc2F2ZWRTdHJ1Y3R1cmUgPSB3cGJjX2JmYl9fZm9ybV9zdHJ1Y3R1cmVfX2dldF9leGFtcGxlKCk7ICAvLyBbIC8qIHlvdXIgSlNPTiBzdHJ1Y3R1cmUgZnJvbSBlYXJsaWVyICovIF07LlxyXG5cdHdwYmNfYmZiX19sb2FkX3NhdmVkX3N0cnVjdHVyZSggc2F2ZWRTdHJ1Y3R1cmUgKTtcclxufSApO1xyXG5cclxuaWYgKCBudWxsICE9PSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX190b2dnbGVfcHJldmlldycgKSApIHtcclxuXHRkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX190b2dnbGVfcHJldmlldycgKS5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0X3dwYmNfYnVpbGRlci5wcmV2aWV3X21vZGUgPSB0aGlzLmNoZWNrZWQ7XHJcblx0XHR3cGJjX2JmYl9fbG9hZF9zYXZlZF9zdHJ1Y3R1cmUoIHdwYmNfYmZiX19nZXRfZm9ybV9zdHJ1Y3R1cmUoKSApOyAvLyBSZS1yZW5kZXJcclxuXHR9ICk7XHJcbn1cclxuLy8gTWFudWFsIGZpeDogcmVtb3ZlIGluY29ycmVjdCBgLndwYmNfYmZiX19maWVsZGAgZnJvbSBzZWN0aW9uIGVsZW1lbnRzIChpZiBhbnkpXHJcbi8vIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy53cGJjX2JmYl9fc2VjdGlvbi53cGJjX2JmYl9fZmllbGQnKS5mb3JFYWNoKGVsID0+IHsgZWwuY2xhc3NMaXN0LnJlbW92ZSgnd3BiY19iZmJfX2ZpZWxkJyk7IH0pOyAgLy8uXHJcblxyXG5cclxuZnVuY3Rpb24gd3BiY19iZmJfX2Zvcm1fc3RydWN0dXJlX19nZXRfZXhhbXBsZSgpIHtcclxuXHRyZXR1cm4gW1xyXG4gIHtcclxuICAgIFwicGFnZVwiOiAxLFxyXG4gICAgXCJjb250ZW50XCI6IFtcclxuICAgICAge1xyXG4gICAgICAgIFwidHlwZVwiOiBcInNlY3Rpb25cIixcclxuICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgXCJpZFwiOiBcInNlY3Rpb24tNy0xNzU0MDc5NDA1NDQyXCIsXHJcbiAgICAgICAgICBcImNvbHVtbnNcIjogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgXCJ3aWR0aFwiOiBcIjE5LjAyMDUlXCIsXHJcbiAgICAgICAgICAgICAgXCJmaWVsZHNcIjogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcImlkXCI6IFwic2VsZWN0Ym94XCIsXHJcbiAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcInNlbGVjdGJveFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiQ2hvb3NlIEl0ZW1cIixcclxuICAgICAgICAgICAgICAgICAgXCJwbGFjZWhvbGRlclwiOiBcIlBsZWFzZSBzZWxlY3RcIixcclxuICAgICAgICAgICAgICAgICAgXCJvcHRpb25zXCI6IFtcclxuICAgICAgICAgICAgICAgICAgICBcIk9uZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiVHdvXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJUaHJlZVwiXHJcbiAgICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICAgIFwicmVxdWlyZWRcIjogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgXCJzZWN0aW9uc1wiOiBbXVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgXCJ3aWR0aFwiOiBcIjgwLjk3OTUlXCIsXHJcbiAgICAgICAgICAgICAgXCJmaWVsZHNcIjogW10sXHJcbiAgICAgICAgICAgICAgXCJzZWN0aW9uc1wiOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJzZWN0aW9uLTgtMTc1NDA3OTQ0NTc4NFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImNvbHVtbnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgIFwid2lkdGhcIjogXCI1MCVcIixcclxuICAgICAgICAgICAgICAgICAgICAgIFwiZmllbGRzXCI6IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJjYWxlbmRhclwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImNhbGVuZGFyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZW51bWJlclwiOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJDYWxlbmRhclwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICBcInNlY3Rpb25zXCI6IFtdXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBcIndpZHRoXCI6IFwiNTAlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICBcImZpZWxkc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBcImlkXCI6IFwicmFuZ2V0aW1lXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwidGltZXNsb3RzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZW51bWJlclwiOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJSYW5nZXRpbWVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgXCJzZWN0aW9uc1wiOiBbXVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAge1xyXG4gICAgICAgIFwidHlwZVwiOiBcImZpZWxkXCIsXHJcbiAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgIFwiaWRcIjogXCJjb3N0aGludFwiLFxyXG4gICAgICAgICAgXCJ0eXBlXCI6IFwiY29zdGhpbnRcIixcclxuICAgICAgICAgIFwibGFiZWxcIjogXCJDb3N0aGludFwiXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICBdXHJcbiAgfSxcclxuICB7XHJcbiAgICBcInBhZ2VcIjogMixcclxuICAgIFwiY29udGVudFwiOiBbXHJcbiAgICAgIHtcclxuICAgICAgICBcInR5cGVcIjogXCJzZWN0aW9uXCIsXHJcbiAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgIFwiaWRcIjogXCJzZWN0aW9uLTExLTE3NTQwNzk0OTk0OTRcIixcclxuICAgICAgICAgIFwiY29sdW1uc1wiOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBcIndpZHRoXCI6IFwiNTAlXCIsXHJcbiAgICAgICAgICAgICAgXCJmaWVsZHNcIjogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcImlkXCI6IFwiaW5wdXQtdGV4dFwiLFxyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJ0ZXh0XCIsXHJcbiAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJJbnB1dC10ZXh0XCJcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgIFwic2VjdGlvbnNcIjogW11cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIFwid2lkdGhcIjogXCI1MCVcIixcclxuICAgICAgICAgICAgICBcImZpZWxkc1wiOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJpbnB1dC10ZXh0XCIsXHJcbiAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcInRleHRcIixcclxuICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIklucHV0LXRleHRcIlxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgXCJzZWN0aW9uc1wiOiBbXVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICB7XHJcbiAgICAgICAgXCJ0eXBlXCI6IFwiZmllbGRcIixcclxuICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgXCJpZFwiOiBcInRleHRhcmVhXCIsXHJcbiAgICAgICAgICBcInR5cGVcIjogXCJ0ZXh0YXJlYVwiLFxyXG4gICAgICAgICAgXCJsYWJlbFwiOiBcIlRleHRhcmVhXCJcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBcInR5cGVcIjogXCJzZWN0aW9uXCIsXHJcbiAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgIFwiaWRcIjogXCJzZWN0aW9uLTEwLTE3NTQwNzk0OTIyNjBcIixcclxuICAgICAgICAgIFwiY29sdW1uc1wiOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBcIndpZHRoXCI6IFwiMTAwJVwiLFxyXG4gICAgICAgICAgICAgIFwiZmllbGRzXCI6IFtdLFxyXG4gICAgICAgICAgICAgIFwic2VjdGlvbnNcIjogW11cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgXVxyXG4gIH1cclxuXTtcclxuXHJcbn0iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxJQUFJQSxhQUFhLEdBQUksVUFBVUMsR0FBRyxFQUFFQyxDQUFDLEVBQUU7RUFFdEMsSUFBSUMscUJBQXFCLEdBQUdGLEdBQUcsQ0FBQ0csbUJBQW1CLEdBQUdILEdBQUcsQ0FBQ0csbUJBQW1CLElBQUlDLFFBQVEsQ0FBQ0MsY0FBYyxDQUFFLGlDQUFrQyxDQUFDO0VBQzdJLElBQUlDLGlCQUFpQixHQUFPTixHQUFHLENBQUNPLGVBQWUsR0FBR1AsR0FBRyxDQUFDTyxlQUFlLElBQUlILFFBQVEsQ0FBQ0MsY0FBYyxDQUFFLDJCQUE0QixDQUFDO0VBQy9ILElBQUlHLGNBQWMsR0FBVVIsR0FBRyxDQUFDUyxZQUFZLEdBQUdULEdBQUcsQ0FBQ1MsWUFBWSxJQUFJLENBQUM7RUFDcEUsSUFBSUMsaUJBQWlCLEdBQU9WLEdBQUcsQ0FBQ1csZUFBZSxHQUFHWCxHQUFHLENBQUNXLGVBQWUsSUFBSSxDQUFDO0VBQzFFLElBQUlDLGtCQUFrQixHQUFNWixHQUFHLENBQUNhLGdCQUFnQixHQUFHYixHQUFHLENBQUNhLGdCQUFnQixJQUFJLENBQUM7RUFDNUUsSUFBSUMsY0FBYyxHQUFVZCxHQUFHLENBQUNlLFlBQVksR0FBR2YsR0FBRyxDQUFDZSxZQUFZLElBQUksSUFBSSxDQUFDLENBQUc7O0VBRTNFLE9BQU9mLEdBQUc7QUFFWCxDQUFDLENBQUVELGFBQWEsSUFBSSxDQUFDLENBQUMsRUFBRWlCLE1BQU8sQ0FBRTs7QUFFakM7QUFDQTtBQUNBO0FBQ0EsU0FBU0Msd0JBQXdCQSxDQUFDQyxHQUFHLEVBQWtDO0VBQUEsSUFBaENDLFNBQVMsR0FBQUMsU0FBQSxDQUFBQyxN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
