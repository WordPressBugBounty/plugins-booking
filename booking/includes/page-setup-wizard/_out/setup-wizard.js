"use strict";

/**
 * Coordinate Setup Wizard checkpoint saves, navigation, and dialogs.
 *
 * The server remains authoritative for field allow-lists, step order,
 * revisions, access, and persistence. This adapter performs accessible early
 * validation, ignores stale responses, and never applies canonical settings.
 *
 * @package Booking Calendar
 */
(function ($, window, document) {
  'use strict';

  var config = window.wpbc_setup_wizard;
  var root = document.querySelector('[data-wpbc-setup-wizard]');
  var statusNode;
  var transition_message_node;
  var request_error_node;
  var request_error_message_node;
  var request_error_reference_node;
  var request_error_request_id_node;
  var activeDialog = null;
  var dialogTrigger = null;
  var activeRequest = null;
  var requestSequence = 0;
  var mode_toolbar_show_timer = null;
  var mode_toolbar_hide_timer = null;
  var save_operation_state = null;
  var request_phases = {
    IDLE: 'idle',
    REQUESTING: 'requesting',
    REDIRECTING: 'redirecting'
  };
  var request_phase = request_phases.IDLE;
  var browser_ready = false;
  var step_adapters = [];
  if (!config || !root) {
    return;
  }
  statusNode = root.querySelector('[data-wpbc-setup-wizard-status]');
  transition_message_node = root.querySelector('[data-wpbc-setup-wizard-transition-message]');
  request_error_node = root.querySelector('[data-wpbc-setup-wizard-request-error]');
  request_error_message_node = root.querySelector('[data-wpbc-setup-wizard-request-error-message]');
  request_error_reference_node = root.querySelector('[data-wpbc-setup-wizard-request-error-reference]');
  request_error_request_id_node = root.querySelector('[data-wpbc-setup-wizard-request-error-request-id]');

  /**
   * Set the live status message exposed to assistive technology.
   *
   * @param {string} message Status text.
   * @return {void}
   */
  function setStatus(message) {
    if (statusNode) {
      statusNode.textContent = message || '';
    }
  }

  /**
   * Return the normalized data object from a direct or jQuery AJAX response.
   *
   * @param {Object} response_or_xhr WordPress response or jQuery request object.
   * @return {Object} Normalized response data.
   */
  function get_response_data(response_or_xhr) {
    var response = response_or_xhr && response_or_xhr.responseJSON ? response_or_xhr.responseJSON : response_or_xhr;
    return response && response.data && 'object' === typeof response.data ? response.data : {};
  }

  /**
   * Hide and reset the shared request error notice.
   *
   * @return {void}
   */
  function clear_request_error() {
    if (!request_error_node) {
      return;
    }
    request_error_node.hidden = true;
    if (request_error_message_node) {
      request_error_message_node.textContent = '';
    }
    if (request_error_reference_node) {
      request_error_reference_node.hidden = true;
    }
    if (request_error_request_id_node) {
      request_error_request_id_node.textContent = '';
    }
  }

  /**
   * Show one server or transport failure in the common wizard alert region.
   *
   * Text is assigned through textContent so an error returned by any step cannot
   * inject markup. The request reference helps support staff correlate a visible error
   * with its server response without exposing internal stack details.
   *
   * @param {Object} response_or_xhr WordPress response or jQuery request object.
   * @return {void}
   */
  function show_request_error(response_or_xhr) {
    var response_data = get_response_data(response_or_xhr);
    var request_id = response_data.request_id ? String(response_data.request_id) : '';
    if (!request_error_node || !request_error_message_node) {
      return;
    }
    request_error_message_node.textContent = getErrorMessage(response_or_xhr);
    if (request_error_reference_node && request_error_request_id_node) {
      request_error_request_id_node.textContent = request_id;
      request_error_reference_node.hidden = !request_id;
    }
    request_error_node.hidden = false;
    try {
      request_error_node.focus({
        preventScroll: true
      });
    } catch (focus_error) {
      request_error_node.focus();
    }
    try {
      request_error_node.scrollIntoView({
        behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    } catch (scroll_error) {
      request_error_node.scrollIntoView();
    }
  }

  /**
   * Release the server-locked forward action after browser initialization.
   *
   * The primary action is rendered as a disabled non-submit button so a click
   * cannot fall through to the browser's native GET form submission before the
   * shared handlers exist. Form-backed steps recover submit behavior only after
   * the shared controller and dependent step scripts have finished loading.
   *
   * @return {void}
   */
  function enable_continue_when_ready() {
    var continue_button = root.querySelector('[data-wpbc-setup-wizard-enable-when-ready]');
    if (!browser_ready || request_phases.IDLE !== request_phase || !continue_button) {
      return;
    }
    if (continue_button.hasAttribute('data-wpbc-setup-wizard-submit-when-ready')) {
      continue_button.type = 'submit';
    }
    continue_button.disabled = false;
  }

  /**
   * Mark the shared shell ready after dependent footer scripts have executed.
   *
   * @return {void}
   */
  function mark_browser_ready() {
    browser_ready = true;
    root.dataset.wpbcSetupWizardBrowserReady = 'true';
    enable_continue_when_ready();
  }

  /**
   * Defer readiness until parsing and all DOMContentLoaded listeners complete.
   *
   * The zero-delay task also covers optimized installations that execute the
   * footer bundle after DOMContentLoaded while preserving dependency order.
   *
   * @return {void}
   */
  function schedule_browser_ready() {
    var defer_ready = function () {
      window.setTimeout(mark_browser_ready, 0);
    };
    if ('loading' === document.readyState) {
      document.addEventListener('DOMContentLoaded', defer_ready, {
        once: true
      });
      return;
    }
    defer_ready();
  }

  /**
   * Lock or unlock interactive wizard controls around one active request.
   *
   * Repeated calls with the current state are ignored so the original disabled
   * state of every control remains available for restoration.
   *
   * @param {boolean} isBusy Whether a request is active.
   * @return {void}
   */
  function setBusy(isBusy) {
    var current_busy_state = 'true' === root.getAttribute('aria-busy');
    if (current_busy_state === isBusy) {
      return;
    }
    root.classList.toggle('wpbc_setup_wizard--busy', isBusy);
    root.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    root.querySelectorAll('button, input, select, textarea').forEach(function (control) {
      if (isBusy) {
        control.dataset.wpbcWasDisabled = control.disabled ? 'true' : 'false';
        control.disabled = true;
      } else {
        control.disabled = 'true' === control.dataset.wpbcWasDisabled;
        delete control.dataset.wpbcWasDisabled;
      }
    });
    if (!isBusy) {
      enable_continue_when_ready();
    }
  }

  /**
   * Update the visible message inside the blocking transition overlay.
   *
   * The separate live status node remains responsible for announcements to
   * assistive technology.
   *
   * @param {string} message Visible transition text.
   * @return {void}
   */
  function set_transition_message(message) {
    if (transition_message_node) {
      transition_message_node.textContent = message || '';
    }
  }

  /**
   * Move the request controller between idle, requesting, and redirecting.
   *
   * Redirecting deliberately remains busy after the AJAX promise settles. The
   * old document must stay locked until the browser replaces it.
   *
   * @param {string} phase   One value from request_phases.
   * @param {string} message Visible and announced progress text.
   * @return {void}
   */
  function set_request_phase(phase, message) {
    request_phase = phase;
    root.dataset.requestPhase = phase;
    if (request_phases.IDLE === phase) {
      set_transition_message('');
      setBusy(false);
      return;
    }
    set_transition_message(message);
    setBusy(true);
    setStatus(message);
  }

  /**
   * Prevent links or delegated controls from acting outside the idle phase.
   *
   * Native form controls are disabled by setBusy(). This capture-phase guard
   * also blocks the header links and shared product menu before their own click
   * handlers run while the old document is waiting to be replaced.
   *
   * @param {MouseEvent} event Captured click event inside the wizard shell.
   * @return {void}
   */
  function prevent_interaction_while_busy(event) {
    if (request_phases.IDLE === request_phase) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  /**
   * Return every draft field control rendered by the current step.
   *
   * @return {HTMLElement[]} Ordered controls.
   */
  function getFieldControls() {
    return Array.prototype.slice.call(root.querySelectorAll('[data-wpbc-setup-wizard-field]'));
  }

  /**
   * Find all controls sharing one stable field name.
   *
   * @param {string} fieldName Draft field name.
   * @return {HTMLElement[]} Matching controls.
   */
  function findFieldControls(fieldName) {
    return getFieldControls().filter(function (control) {
      return control.name === fieldName;
    });
  }

  /**
   * Find a field-level error container without interpolating a CSS selector.
   *
   * @param {string} fieldName Draft field name.
   * @return {HTMLElement|null} Matching error node.
   */
  function findFieldError(fieldName) {
    var errorNodes = root.querySelectorAll('[data-wpbc-setup-wizard-error-for]');
    var matchingNode = null;
    errorNodes.forEach(function (errorNode) {
      if (errorNode.dataset.wpbcSetupWizardErrorFor === fieldName) {
        matchingNode = errorNode;
      }
    });
    return matchingNode;
  }

  /**
   * Clear an existing field error and invalid state.
   *
   * @param {string} fieldName Draft field name.
   * @return {void}
   */
  function clearFieldError(fieldName) {
    var errorNode = findFieldError(fieldName);
    var alternateControl = root.querySelector('[data-wpbc-setup-wizard-error-control-for="' + fieldName + '"]');
    findFieldControls(fieldName).forEach(function (control) {
      control.removeAttribute('aria-invalid');
    });
    if (alternateControl) {
      alternateControl.removeAttribute('aria-invalid');
    }
    if (errorNode) {
      errorNode.textContent = '';
    }
  }

  /**
   * Render one client- or server-provided field error.
   *
   * @param {string} fieldName Draft field name.
   * @param {string} message Human-readable validation message.
   * @return {HTMLElement|null} First invalid control.
   */
  function setFieldError(fieldName, message) {
    var controls = findFieldControls(fieldName);
    var errorNode = findFieldError(fieldName);
    var alternateControl = root.querySelector('[data-wpbc-setup-wizard-error-control-for="' + fieldName + '"]');
    controls.forEach(function (control) {
      control.setAttribute('aria-invalid', 'true');
    });
    if (errorNode) {
      errorNode.textContent = message;
    }
    if (alternateControl) {
      alternateControl.setAttribute('aria-invalid', 'true');
    }
    return alternateControl || (controls.length ? controls[0] : null);
  }

  /**
   * Lock or unlock the consumer shell for an explicit module operation.
   *
   * @param {boolean} is_busy Whether the module operation is active.
   * @param {string}  message Accessible operation status.
   * @return {void}
   */
  function set_step_adapter_busy(is_busy, message) {
    set_request_phase(is_busy ? request_phases.REQUESTING : request_phases.IDLE, message || '');
  }

  /**
   * Register one current-page editor adapter with the shared wizard shell.
   *
   * A step module owns its rendering, draft synchronization, and client-side
   * validation. The shell exposes only navigation-safe services and never
   * assumes which domain fields are present.
   *
   * @param {Object} step_adapter Step-owned adapter contract.
   * @return {void}
   */
  function register_step_adapter(step_adapter) {
    if (!step_adapter || 'function' !== typeof step_adapter.initialize) {
      return;
    }
    step_adapters.push(step_adapter);
    step_adapter.initialize({
      root: root,
      config: config,
      set_status: setStatus,
      show_error: show_request_error,
      clear_error: clear_request_error,
      set_busy: set_step_adapter_busy,
      set_field_error: setFieldError,
      clear_field_error: clearFieldError,
      open_dialog: openDialog
    });
  }

  /**
   * Synchronize every registered step adapter before draft collection.
   *
   * @return {void}
   */
  function sync_step_adapters() {
    step_adapters.forEach(function (step_adapter) {
      if ('function' === typeof step_adapter.sync) {
        step_adapter.sync();
      }
    });
  }

  /**
   * Validate registered step modules in registration order.
   *
   * @return {HTMLElement|null} First invalid control, or null.
   */
  function validate_step_adapters() {
    var first_invalid_control = null;
    step_adapters.some(function (step_adapter) {
      if ('function' !== typeof step_adapter.validate) {
        return false;
      }
      first_invalid_control = step_adapter.validate();
      return Boolean(first_invalid_control);
    });
    return first_invalid_control;
  }
  window.wpbc_setup_wizard_api = {
    register_step_adapter: register_step_adapter
  };

  /**
   * Remove every visible validation error from the current step.
   *
   * @return {void}
   */
  function clearFieldErrors() {
    getFieldControls().forEach(function (control) {
      clearFieldError(control.name);
    });
    root.querySelectorAll('[data-wpbc-review-step].has-error').forEach(function (review_row) {
      review_row.classList.remove('has-error');
    });
  }

  /**
   * Validate required and email fields before forward navigation.
   *
   * Server validation remains authoritative. This check provides immediate
   * keyboard focus and avoids a needless request for obvious omissions.
   *
   * @return {boolean} True when client-visible constraints pass.
   */
  function validateCurrentStep() {
    var controls = getFieldControls();
    var handledFields = {};
    var firstInvalidControl = null;
    clearFieldErrors();
    firstInvalidControl = validate_step_adapters();
    if (firstInvalidControl) {
      setStatus(config.i18n.validation_error);
      firstInvalidControl.focus();
      return false;
    }
    controls.forEach(function (control) {
      var fieldControls;
      var hasValue;
      var invalidMessage = '';
      if (handledFields[control.name]) {
        return;
      }
      handledFields[control.name] = true;
      fieldControls = findFieldControls(control.name);
      if ('radio' === control.type) {
        hasValue = fieldControls.some(function (radioControl) {
          return radioControl.checked;
        });
      } else if ('checkbox' === control.type) {
        hasValue = control.checked;
      } else {
        hasValue = '' !== String(control.value).trim();
      }
      if (control.required && !hasValue) {
        invalidMessage = config.i18n.required;
      } else if ('email' === control.type && hasValue && control.validity && control.validity.typeMismatch) {
        invalidMessage = config.i18n.invalid_email;
      }
      if (invalidMessage) {
        firstInvalidControl = firstInvalidControl || setFieldError(control.name, invalidMessage);
      }
    });
    if (firstInvalidControl) {
      setStatus(config.i18n.validation_error);
      firstInvalidControl.focus();
      return false;
    }
    return true;
  }

  /**
   * Collect scalar values from the current allow-listed form controls.
   *
   * @return {Object} Draft field values keyed by stable field name.
   */
  function collectFields() {
    var fieldValues = {};
    sync_step_adapters();
    getFieldControls().forEach(function (control) {
      if ('radio' === control.type) {
        if (control.checked) {
          fieldValues[control.name] = control.value;
        }
        return;
      }
      if ('checkbox' === control.type) {
        fieldValues[control.name] = control.checked ? '1' : '0';
        return;
      }
      fieldValues[control.name] = control.value;
    });
    return fieldValues;
  }

  /**
   * Extract a safe message from a failed WordPress AJAX response.
   *
   * @param {Object} response_or_xhr WordPress response or jQuery request object.
   * @return {string} Human-readable error text.
   */
  function getErrorMessage(response_or_xhr) {
    var response_data = get_response_data(response_or_xhr);
    if (response_data.message) {
      return String(response_data.message);
    }
    return config.i18n.error;
  }

  /**
   * Render server-side field errors and focus the first rejected control.
   *
   * @param {Object} xhr jQuery request object.
   * @return {void}
   */
  function renderServerErrors(xhr) {
    var responseData = xhr && xhr.responseJSON ? xhr.responseJSON.data : null;
    var firstInvalidControl = null;
    var invalid_step_row = null;
    if (!responseData || !responseData.field_errors && !responseData.invalid_step_id) {
      return;
    }
    Object.keys(responseData.field_errors || {}).forEach(function (fieldName) {
      firstInvalidControl = firstInvalidControl || setFieldError(fieldName, String(responseData.field_errors[fieldName]));
    });
    if (responseData.invalid_step_id) {
      root.querySelectorAll('[data-wpbc-review-step]').forEach(function (review_row) {
        if (review_row.dataset.wpbcReviewStep === responseData.invalid_step_id) {
          invalid_step_row = review_row;
          review_row.classList.add('has-error');
        }
      });
    }
    if (firstInvalidControl) {
      firstInvalidControl.focus();
    } else if (invalid_step_row) {
      firstInvalidControl = invalid_step_row.querySelector('[data-wpbc-setup-wizard-edit-step]');
      if (firstInvalidControl) {
        firstInvalidControl.focus();
      }
    }
  }

  /**
   * Build a stable idempotency key for one page, revision, and field snapshot.
   *
   * Two browser tabs receive different entropy, while an unchanged retry after
   * an ambiguous response reuses the same identifier. Editing a field creates
   * a new logical operation rather than replaying the previous result.
   *
   * @param {Object} field_values Current scalar field snapshot.
   * @return {string} Stable operation identifier.
   */
  function get_save_operation_id(field_values) {
    var normalized_fields = {};
    var field_signature;
    var entropy_values;
    var entropy;
    var operation_id;
    Object.keys(field_values || {}).sort().forEach(function (field_name) {
      normalized_fields[field_name] = field_values[field_name];
    });
    field_signature = JSON.stringify(normalized_fields);
    if (save_operation_state && save_operation_state.step_id === config.current_step && save_operation_state.revision === config.revision && save_operation_state.field_signature === field_signature) {
      return save_operation_state.operation_id;
    }
    if (window.crypto && 'function' === typeof window.crypto.getRandomValues) {
      entropy_values = new Uint32Array(2);
      window.crypto.getRandomValues(entropy_values);
      entropy = entropy_values[0].toString(36) + entropy_values[1].toString(36);
    } else {
      entropy = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
    operation_id = ('save_' + String(config.current_step || '').replace(/[^a-z0-9_-]/gi, '') + '_' + String(config.revision) + '_' + entropy).slice(0, 100);
    save_operation_state = {
      step_id: config.current_step,
      revision: config.revision,
      field_signature: field_signature,
      operation_id: operation_id
    };
    return operation_id;
  }

  /**
   * Send one revision-bound action and ignore aborted or stale responses.
   *
   * @param {string} action WordPress AJAX action.
   * @param {Object} payload Action-specific scalar or field values.
   * @return {void}
   */
  function sendRequest(action, payload) {
    var sequence;
    var requestId;
    requestSequence += 1;
    sequence = requestSequence;
    requestId = 'request_' + Date.now() + '_' + sequence;
    if (activeRequest) {
      activeRequest.abort();
    }
    clear_request_error();
    set_request_phase(request_phases.REQUESTING, config.i18n.working);
    activeRequest = $.ajax({
      url: config.ajax_url,
      method: 'POST',
      dataType: 'json',
      data: $.extend({}, payload, {
        action: action,
        nonce: config.nonce,
        current_step: config.current_step,
        expected_revision: config.revision,
        request_id: requestId
      })
    });
    activeRequest.done(function (response) {
      if (sequence !== requestSequence) {
        return;
      }
      if (!response || !response.success || !response.data || response.data.request_id !== requestId) {
        set_request_phase(request_phases.IDLE);
        show_request_error(response);
        setStatus(getErrorMessage(response));
        return;
      }
      if (response.data.checkpoint) {
        config.current_step = response.data.checkpoint.current_step;
        config.revision = response.data.checkpoint.revision;
        root.dataset.revision = String(response.data.checkpoint.revision);
      }
      if ('string' !== typeof response.data.redirect_url || '' === response.data.redirect_url.trim()) {
        set_request_phase(request_phases.IDLE);
        show_request_error(response);
        setStatus(getErrorMessage(response));
        return;
      }
      set_request_phase(request_phases.REDIRECTING, config.i18n.loading);
      try {
        window.location.assign(response.data.redirect_url);
      } catch (redirectError) {
        set_request_phase(request_phases.IDLE);
        show_request_error({});
        setStatus(config.i18n.error);
      }
    });
    activeRequest.fail(function (xhr, textStatus) {
      if ('abort' === textStatus || sequence !== requestSequence) {
        return;
      }
      set_request_phase(request_phases.IDLE);
      show_request_error(xhr);
      renderServerErrors(xhr);
      setStatus(getErrorMessage(xhr));
    });
    activeRequest.always(function () {
      if (sequence === requestSequence) {
        activeRequest = null;
        if (request_phases.REDIRECTING !== request_phase) {
          set_request_phase(request_phases.IDLE);
        }
      }
    });
  }

  /**
   * Return focusable controls currently available in a dialog.
   *
   * @param {HTMLElement} dialog Dialog element.
   * @return {HTMLElement[]} Ordered focusable elements.
   */
  function getFocusableElements(dialog) {
    return Array.prototype.slice.call(dialog.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
  }

  /**
   * Open a registered confirmation dialog and transfer focus inside it.
   *
   * @param {string} action Dialog action identifier.
   * @param {HTMLElement} trigger Control that opened the dialog.
   * @return {boolean} Whether the requested dialog was opened.
   */
  function openDialog(action, trigger) {
    var backdrop = root.querySelector('[data-wpbc-setup-wizard-dialog="' + action + '"]');
    if (!backdrop) {
      return false;
    }
    dialogTrigger = trigger;
    activeDialog = backdrop;
    backdrop.hidden = false;
    document.body.classList.add('wpbc_setup_wizard_dialog_open');
    window.setTimeout(function () {
      var cancelButton = backdrop.querySelector('[data-wpbc-setup-wizard-dialog-cancel]');
      if (cancelButton) {
        cancelButton.focus();
      }
    }, 0);
    return true;
  }

  /**
   * Close the active dialog, announce its outcome, and restore trigger focus.
   *
   * The lifecycle event lets a domain adapter commit or roll back provisional
   * browser state without adding domain branches to the shared shell.
   *
   * @param {string} outcome Either confirm or cancel.
   * @return {void}
   */
  function closeDialog(outcome) {
    var closed_dialog;
    var closed_action;
    var closed_trigger;
    if (!activeDialog) {
      return;
    }
    closed_dialog = activeDialog;
    closed_action = String(closed_dialog.dataset.wpbcSetupWizardDialog || '');
    closed_trigger = dialogTrigger;
    closed_dialog.hidden = true;
    activeDialog = null;
    document.body.classList.remove('wpbc_setup_wizard_dialog_open');
    if (closed_trigger) {
      closed_trigger.focus();
    }
    dialogTrigger = null;
    root.dispatchEvent(new window.CustomEvent('wpbc:setup-wizard-dialog-closed', {
      detail: {
        action: closed_action,
        outcome: 'confirm' === outcome ? 'confirm' : 'cancel',
        trigger: closed_trigger
      }
    }));
  }

  /**
   * Synchronize visual selection state with native radio controls.
   *
   * Native radio behavior supplies Tab, Space, and arrow-key operation. The
   * card styling is presentation only and does not determine authorization.
   *
   * @return {void}
   */
  function updateExperienceCards() {
    root.querySelectorAll('.wpbc_setup_wizard__experience-card').forEach(function (card) {
      var radioControl = card.querySelector('input[type="radio"]');
      var selectedBadge = card.querySelector('.wpbc_setup_wizard__selected-badge');
      var isSelected = radioControl && radioControl.checked;
      card.classList.toggle('is-selected', Boolean(isSelected));
      if (selectedBadge) {
        selectedBadge.hidden = !isSelected;
      }
    });
  }

  /**
   * Hide the Step 4 Booking Mode learning tooltip and cancel pending timers.
   *
   * @return {void}
   */
  function hide_mode_toolbar_tooltip() {
    var toolbar = root.querySelector('[data-wpbc-setup-wizard-mode-toolbar]');
    var tooltip = root.querySelector('[data-wpbc-setup-wizard-mode-toolbar-tooltip]');
    window.clearTimeout(mode_toolbar_show_timer);
    window.clearTimeout(mode_toolbar_hide_timer);
    mode_toolbar_show_timer = null;
    mode_toolbar_hide_timer = null;
    if (toolbar) {
      toolbar.classList.remove('is-previewing');
    }
    if (tooltip) {
      tooltip.classList.remove('is-visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Synchronize the preview-only toolbar selector with the Step 4 radio draft.
   *
   * The preview deliberately avoids the released `.wpbc_booking_mode_option`
   * hook because that control performs the canonical Booking Mode mutation.
   *
   * @param {string}  mode_id        Validated mode identifier from a radio.
   * @param {boolean} should_animate Whether to teach the toolbar location.
   * @return {void}
   */
  function update_mode_toolbar_preview(mode_id, should_animate) {
    var toolbar = root.querySelector('[data-wpbc-setup-wizard-mode-toolbar]');
    var toolbar_label;
    var tooltip;
    var selected_option = null;
    var reduce_motion;
    if (!toolbar) {
      return;
    }
    toolbar_label = toolbar.querySelector('[data-wpbc-setup-wizard-mode-toolbar-label]');
    tooltip = toolbar.querySelector('[data-wpbc-setup-wizard-mode-toolbar-tooltip]');
    toolbar.querySelectorAll('[data-wpbc-setup-wizard-mode-toolbar-option]').forEach(function (option) {
      var is_selected = option.dataset.wpbcSetupWizardModeToolbarOption === mode_id;
      option.classList.toggle('is-current', is_selected);
      option.setAttribute('aria-checked', is_selected ? 'true' : 'false');
      if (is_selected) {
        selected_option = option;
      }
    });
    if (!selected_option || !toolbar_label) {
      return;
    }
    toolbar_label.textContent = selected_option.dataset.wpbcSetupWizardModeToolbarTitle || selected_option.textContent.trim();
    if (!should_animate) {
      return;
    }
    hide_mode_toolbar_tooltip();
    toolbar.classList.remove('is-previewing');
    void toolbar.offsetWidth;
    toolbar.classList.add('is-previewing');
    reduce_motion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mode_toolbar_show_timer = window.setTimeout(function () {
      toolbar.classList.remove('is-previewing');
      if (!tooltip) {
        return;
      }
      tooltip.classList.add('is-visible');
      tooltip.setAttribute('aria-hidden', 'false');
      setStatus(tooltip.textContent.trim());
      mode_toolbar_hide_timer = window.setTimeout(hide_mode_toolbar_tooltip, 6500);
    }, reduce_motion ? 0 : 1900);
  }
  root.addEventListener('click', prevent_interaction_while_busy, true);
  root.addEventListener('click', function (event) {
    var directionButton = event.target.closest('[data-wpbc-setup-wizard-direction]');
    var edit_step_button = event.target.closest('[data-wpbc-setup-wizard-edit-step]');
    var dialogButton = event.target.closest('[data-wpbc-setup-wizard-open-dialog]');
    var cancelButton = event.target.closest('[data-wpbc-setup-wizard-dialog-cancel]');
    var confirmButton = event.target.closest('[data-wpbc-setup-wizard-confirm]');
    var mode_toolbar_option = event.target.closest('[data-wpbc-setup-wizard-mode-toolbar-option]');
    var dismiss_error_button = event.target.closest('[data-wpbc-setup-wizard-dismiss-error]');
    var mode_radio = null;
    var direction;
    var action;
    var submitted_fields;
    if (dismiss_error_button) {
      event.preventDefault();
      clear_request_error();
      return;
    }
    if (edit_step_button) {
      event.preventDefault();
      sendRequest(config.action_edit, {
        target_step: edit_step_button.dataset.wpbcSetupWizardEditStep
      });
      return;
    }
    if (mode_toolbar_option) {
      event.preventDefault();
      root.querySelectorAll('input[name="booking_experience"]').forEach(function (radio_control) {
        if (radio_control.value === mode_toolbar_option.dataset.wpbcSetupWizardModeToolbarOption) {
          mode_radio = radio_control;
        }
      });
      if (mode_radio && !mode_radio.checked) {
        $(mode_radio).prop('checked', true).trigger('change');
      }
      return;
    }
    if (directionButton) {
      event.preventDefault();
      direction = directionButton.dataset.wpbcSetupWizardDirection;
      if ('back' === direction) {
        clearFieldErrors();
        sendRequest(config.action_back, {});
        return;
      }
      if ('next' !== direction || !validateCurrentStep()) {
        return;
      }
      clearFieldErrors();
      submitted_fields = collectFields();
      sendRequest(config.action_save_continue, {
        fields: submitted_fields,
        operation_id: get_save_operation_id(submitted_fields)
      });
      return;
    }
    if (dialogButton) {
      event.preventDefault();
      openDialog(dialogButton.dataset.wpbcSetupWizardOpenDialog, dialogButton);
      return;
    }
    if (cancelButton) {
      event.preventDefault();
      closeDialog('cancel');
      return;
    }
    if (confirmButton) {
      event.preventDefault();
      action = confirmButton.dataset.wpbcSetupWizardConfirm;
      closeDialog('confirm');
      if ('restart' === action || 'skip' === action) {
        sendRequest('restart' === action ? config.action_restart : config.action_skip, {
          confirmation: action
        });
      }
      return;
    }
    if (activeDialog && event.target === activeDialog) {
      closeDialog('cancel');
    }
  });
  root.addEventListener('submit', function (event) {
    var continueButton;
    if ('wpbc-setup-wizard-step-form' !== event.target.id) {
      return;
    }
    event.preventDefault();
    continueButton = root.querySelector('[data-wpbc-setup-wizard-direction="next"]');
    if (continueButton && !continueButton.disabled) {
      continueButton.click();
    }
  });
  root.addEventListener('change', function (event) {
    if (event.target.matches('[data-wpbc-setup-wizard-field]')) {
      clearFieldError(event.target.name);
    }
    if (event.target.matches('input[name="booking_experience"]')) {
      updateExperienceCards();
      update_mode_toolbar_preview(event.target.value, true);
    }
    if (event.target.matches('input[name="customer_journey"]')) {
      updateExperienceCards();
    }
  });
  root.addEventListener('input', function (event) {
    if (event.target.matches('[data-wpbc-setup-wizard-field]')) {
      clearFieldError(event.target.name);
    }
  });
  document.addEventListener('keydown', function (event) {
    var dialog;
    var focusable;
    var first;
    var last;
    if (!activeDialog) {
      return;
    }
    if ('Escape' === event.key) {
      event.preventDefault();
      closeDialog('cancel');
      return;
    }
    if ('Tab' !== event.key) {
      return;
    }
    dialog = activeDialog.querySelector('[role="dialog"]');
    focusable = getFocusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    first = focusable[0];
    last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /**
   * Restore transient request state when the browser revives this document.
   *
   * A page restored from the back-forward cache must not retain the disabled
   * controls or transition overlay from a navigation that already completed.
   *
   * @param {PageTransitionEvent} event Browser page-show event.
   * @return {void}
   */
  function restore_transient_request_state(event) {
    if (!event.persisted) {
      return;
    }
    requestSequence += 1;
    if (activeRequest) {
      activeRequest.abort();
      activeRequest = null;
    }
    set_request_phase(request_phases.IDLE);
    setStatus('');
  }
  window.addEventListener('pageshow', restore_transient_request_state);
  updateExperienceCards();
  if (root.querySelector('input[name="booking_experience"]:checked')) {
    update_mode_toolbar_preview(root.querySelector('input[name="booking_experience"]:checked').value, false);
  }
  schedule_browser_ready();
})(jQuery, window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvX291dC9zZXR1cC13aXphcmQuanMiLCJuYW1lcyI6WyIkIiwid2luZG93IiwiZG9jdW1lbnQiLCJjb25maWciLCJ3cGJjX3NldHVwX3dpemFyZCIsInJvb3QiLCJxdWVyeVNlbGVjdG9yIiwic3RhdHVzTm9kZSIsInRyYW5zaXRpb25fbWVzc2FnZV9ub2RlIiwicmVxdWVzdF9lcnJvcl9ub2RlIiwicmVxdWVzdF9lcnJvcl9tZXNzYWdlX25vZGUiLCJyZXF1ZXN0X2Vycm9yX3JlZmVyZW5jZV9ub2RlIiwicmVxdWVzdF9lcnJvcl9yZXF1ZXN0X2lkX25vZGUiLCJhY3RpdmVEaWFsb2ciLCJkaWFsb2dUcmlnZ2VyIiwiYWN0aXZlUmVxdWVzdCIsInJlcXVlc3RTZXF1ZW5jZSIsIm1vZGVfdG9vbGJhcl9zaG93X3RpbWVyIiwibW9kZV90b29sYmFyX2hpZGVfdGltZXIiLCJzYXZlX29wZXJhdGlvbl9zdGF0ZSIsInJlcXVlc3RfcGhhc2VzIiwiSURMRSIsIlJFUVVFU1RJTkciLCJSRURJUkVDVElORyIsInJlcXVlc3RfcGhhc2UiLCJicm93c2VyX3JlYWR5Iiwic3RlcF9hZGFwdGVycyIsInNldFN0YXR1cyIsIm1lc3NhZ2UiLCJ0ZXh0Q29udGVudCIsImdldF9yZXNwb25zZV9kYXRhIiwicmVzcG9uc2Vfb3JfeGhyIiwicmVzcG9uc2UiLCJyZXNwb25zZUpTT04iLCJkYXRhIiwiY2xlYXJfcmVxdWVzdF9lcnJvciIsImhpZGRlbiIsInNob3dfcmVxdWVzdF9lcnJvciIsInJlc3BvbnNlX2RhdGEiLCJyZXF1ZXN0X2lkIiwiU3RyaW5nIiwiZ2V0RXJyb3JNZXNzYWdlIiwiZm9jdXMiLCJwcmV2ZW50U2Nyb2xsIiwiZm9jdXNfZXJyb3IiLCJzY3JvbGxJbnRvVmlldyIsImJlaGF2aW9yIiwibWF0Y2hNZWRpYSIsIm1hdGNoZXMiLCJibG9jayIsInNjcm9sbF9lcnJvciIsImVuYWJsZV9jb250aW51ZV93aGVuX3JlYWR5IiwiY29udGludWVfYnV0dG9uIiwiaGFzQXR0cmlidXRlIiwidHlwZSIsImRpc2FibGVkIiwibWFya19icm93c2VyX3JlYWR5IiwiZGF0YXNldCIsIndwYmNTZXR1cFdpemFyZEJyb3dzZXJSZWFkeSIsInNjaGVkdWxlX2Jyb3dzZXJfcmVhZHkiLCJkZWZlcl9yZWFkeSIsInNldFRpbWVvdXQiLCJyZWFkeVN0YXRlIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm9uY2UiLCJzZXRCdXN5IiwiaXNCdXN5IiwiY3VycmVudF9idXN5X3N0YXRlIiwiZ2V0QXR0cmlidXRlIiwiY2xhc3NMaXN0IiwidG9nZ2xlIiwic2V0QXR0cmlidXRlIiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJjb250cm9sIiwid3BiY1dhc0Rpc2FibGVkIiwic2V0X3RyYW5zaXRpb25fbWVzc2FnZSIsInNldF9yZXF1ZXN0X3BoYXNlIiwicGhhc2UiLCJyZXF1ZXN0UGhhc2UiLCJwcmV2ZW50X2ludGVyYWN0aW9uX3doaWxlX2J1c3kiLCJldmVudCIsInByZXZlbnREZWZhdWx0Iiwic3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uIiwiZ2V0RmllbGRDb250cm9scyIsIkFycmF5IiwicHJvdG90eXBlIiwic2xpY2UiLCJjYWxsIiwiZmluZEZpZWxkQ29udHJvbHMiLCJmaWVsZE5hbWUiLCJmaWx0ZXIiLCJuYW1lIiwiZmluZEZpZWxkRXJyb3IiLCJlcnJvck5vZGVzIiwibWF0Y2hpbmdOb2RlIiwiZXJyb3JOb2RlIiwid3BiY1NldHVwV2l6YXJkRXJyb3JGb3IiLCJjbGVhckZpZWxkRXJyb3IiLCJhbHRlcm5hdGVDb250cm9sIiwicmVtb3ZlQXR0cmlidXRlIiwic2V0RmllbGRFcnJvciIsImNvbnRyb2xzIiwibGVuZ3RoIiwic2V0X3N0ZXBfYWRhcHRlcl9idXN5IiwiaXNfYnVzeSIsInJlZ2lzdGVyX3N0ZXBfYWRhcHRlciIsInN0ZXBfYWRhcHRlciIsImluaXRpYWxpemUiLCJwdXNoIiwic2V0X3N0YXR1cyIsInNob3dfZXJyb3IiLCJjbGVhcl9lcnJvciIsInNldF9idXN5Iiwic2V0X2ZpZWxkX2Vycm9yIiwiY2xlYXJfZmllbGRfZXJyb3IiLCJvcGVuX2RpYWxvZyIsIm9wZW5EaWFsb2ciLCJzeW5jX3N0ZXBfYWRhcHRlcnMiLCJzeW5jIiwidmFsaWRhdGVfc3RlcF9hZGFwdGVycyIsImZpcnN0X2ludmFsaWRfY29udHJvbCIsInNvbWUiLCJ2YWxpZGF0ZSIsIkJvb2xlYW4iLCJ3cGJjX3NldHVwX3dpemFyZF9hcGkiLCJjbGVhckZpZWxkRXJyb3JzIiwicmV2aWV3X3JvdyIsInJlbW92ZSIsInZhbGlkYXRlQ3VycmVudFN0ZXAiLCJoYW5kbGVkRmllbGRzIiwiZmlyc3RJbnZhbGlkQ29udHJvbCIsImkxOG4iLCJ2YWxpZGF0aW9uX2Vycm9yIiwiZmllbGRDb250cm9scyIsImhhc1ZhbHVlIiwiaW52YWxpZE1lc3NhZ2UiLCJyYWRpb0NvbnRyb2wiLCJjaGVja2VkIiwidmFsdWUiLCJ0cmltIiwicmVxdWlyZWQiLCJ2YWxpZGl0eSIsInR5cGVNaXNtYXRjaCIsImludmFsaWRfZW1haWwiLCJjb2xsZWN0RmllbGRzIiwiZmllbGRWYWx1ZXMiLCJlcnJvciIsInJlbmRlclNlcnZlckVycm9ycyIsInhociIsInJlc3BvbnNlRGF0YSIsImludmFsaWRfc3RlcF9yb3ciLCJmaWVsZF9lcnJvcnMiLCJpbnZhbGlkX3N0ZXBfaWQiLCJPYmplY3QiLCJrZXlzIiwid3BiY1Jldmlld1N0ZXAiLCJhZGQiLCJnZXRfc2F2ZV9vcGVyYXRpb25faWQiLCJmaWVsZF92YWx1ZXMiLCJub3JtYWxpemVkX2ZpZWxkcyIsImZpZWxkX3NpZ25hdHVyZSIsImVudHJvcHlfdmFsdWVzIiwiZW50cm9weSIsIm9wZXJhdGlvbl9pZCIsInNvcnQiLCJmaWVsZF9uYW1lIiwiSlNPTiIsInN0cmluZ2lmeSIsInN0ZXBfaWQiLCJjdXJyZW50X3N0ZXAiLCJyZXZpc2lvbiIsImNyeXB0byIsImdldFJhbmRvbVZhbHVlcyIsIlVpbnQzMkFycmF5IiwidG9TdHJpbmciLCJEYXRlIiwibm93IiwiTWF0aCIsInJhbmRvbSIsInJlcGxhY2UiLCJzZW5kUmVxdWVzdCIsImFjdGlvbiIsInBheWxvYWQiLCJzZXF1ZW5jZSIsInJlcXVlc3RJZCIsImFib3J0Iiwid29ya2luZyIsImFqYXgiLCJ1cmwiLCJhamF4X3VybCIsIm1ldGhvZCIsImRhdGFUeXBlIiwiZXh0ZW5kIiwibm9uY2UiLCJleHBlY3RlZF9yZXZpc2lvbiIsImRvbmUiLCJzdWNjZXNzIiwiY2hlY2twb2ludCIsInJlZGlyZWN0X3VybCIsImxvYWRpbmciLCJsb2NhdGlvbiIsImFzc2lnbiIsInJlZGlyZWN0RXJyb3IiLCJmYWlsIiwidGV4dFN0YXR1cyIsImFsd2F5cyIsImdldEZvY3VzYWJsZUVsZW1lbnRzIiwiZGlhbG9nIiwidHJpZ2dlciIsImJhY2tkcm9wIiwiYm9keSIsImNhbmNlbEJ1dHRvbiIsImNsb3NlRGlhbG9nIiwib3V0Y29tZSIsImNsb3NlZF9kaWFsb2ciLCJjbG9zZWRfYWN0aW9uIiwiY2xvc2VkX3RyaWdnZXIiLCJ3cGJjU2V0dXBXaXphcmREaWFsb2ciLCJkaXNwYXRjaEV2ZW50IiwiQ3VzdG9tRXZlbnQiLCJkZXRhaWwiLCJ1cGRhdGVFeHBlcmllbmNlQ2FyZHMiLCJjYXJkIiwic2VsZWN0ZWRCYWRnZSIsImlzU2VsZWN0ZWQiLCJoaWRlX21vZGVfdG9vbGJhcl90b29sdGlwIiwidG9vbGJhciIsInRvb2x0aXAiLCJjbGVhclRpbWVvdXQiLCJ1cGRhdGVfbW9kZV90b29sYmFyX3ByZXZpZXciLCJtb2RlX2lkIiwic2hvdWxkX2FuaW1hdGUiLCJ0b29sYmFyX2xhYmVsIiwic2VsZWN0ZWRfb3B0aW9uIiwicmVkdWNlX21vdGlvbiIsIm9wdGlvbiIsImlzX3NlbGVjdGVkIiwid3BiY1NldHVwV2l6YXJkTW9kZVRvb2xiYXJPcHRpb24iLCJ3cGJjU2V0dXBXaXphcmRNb2RlVG9vbGJhclRpdGxlIiwib2Zmc2V0V2lkdGgiLCJkaXJlY3Rpb25CdXR0b24iLCJ0YXJnZXQiLCJjbG9zZXN0IiwiZWRpdF9zdGVwX2J1dHRvbiIsImRpYWxvZ0J1dHRvbiIsImNvbmZpcm1CdXR0b24iLCJtb2RlX3Rvb2xiYXJfb3B0aW9uIiwiZGlzbWlzc19lcnJvcl9idXR0b24iLCJtb2RlX3JhZGlvIiwiZGlyZWN0aW9uIiwic3VibWl0dGVkX2ZpZWxkcyIsImFjdGlvbl9lZGl0IiwidGFyZ2V0X3N0ZXAiLCJ3cGJjU2V0dXBXaXphcmRFZGl0U3RlcCIsInJhZGlvX2NvbnRyb2wiLCJwcm9wIiwid3BiY1NldHVwV2l6YXJkRGlyZWN0aW9uIiwiYWN0aW9uX2JhY2siLCJhY3Rpb25fc2F2ZV9jb250aW51ZSIsImZpZWxkcyIsIndwYmNTZXR1cFdpemFyZE9wZW5EaWFsb2ciLCJ3cGJjU2V0dXBXaXphcmRDb25maXJtIiwiYWN0aW9uX3Jlc3RhcnQiLCJhY3Rpb25fc2tpcCIsImNvbmZpcm1hdGlvbiIsImNvbnRpbnVlQnV0dG9uIiwiaWQiLCJjbGljayIsImZvY3VzYWJsZSIsImZpcnN0IiwibGFzdCIsImtleSIsInNoaWZ0S2V5IiwiYWN0aXZlRWxlbWVudCIsInJlc3RvcmVfdHJhbnNpZW50X3JlcXVlc3Rfc3RhdGUiLCJwZXJzaXN0ZWQiLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwLXdpemFyZC9fc3JjL3NldHVwLXdpemFyZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENvb3JkaW5hdGUgU2V0dXAgV2l6YXJkIGNoZWNrcG9pbnQgc2F2ZXMsIG5hdmlnYXRpb24sIGFuZCBkaWFsb2dzLlxuICpcbiAqIFRoZSBzZXJ2ZXIgcmVtYWlucyBhdXRob3JpdGF0aXZlIGZvciBmaWVsZCBhbGxvdy1saXN0cywgc3RlcCBvcmRlcixcbiAqIHJldmlzaW9ucywgYWNjZXNzLCBhbmQgcGVyc2lzdGVuY2UuIFRoaXMgYWRhcHRlciBwZXJmb3JtcyBhY2Nlc3NpYmxlIGVhcmx5XG4gKiB2YWxpZGF0aW9uLCBpZ25vcmVzIHN0YWxlIHJlc3BvbnNlcywgYW5kIG5ldmVyIGFwcGxpZXMgY2Fub25pY2FsIHNldHRpbmdzLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqL1xuKCBmdW5jdGlvbiAoICQsIHdpbmRvdywgZG9jdW1lbnQgKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHR2YXIgY29uZmlnID0gd2luZG93LndwYmNfc2V0dXBfd2l6YXJkO1xuXHR2YXIgcm9vdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZF0nICk7XG5cdHZhciBzdGF0dXNOb2RlO1xuXHR2YXIgdHJhbnNpdGlvbl9tZXNzYWdlX25vZGU7XG5cdHZhciByZXF1ZXN0X2Vycm9yX25vZGU7XG5cdHZhciByZXF1ZXN0X2Vycm9yX21lc3NhZ2Vfbm9kZTtcblx0dmFyIHJlcXVlc3RfZXJyb3JfcmVmZXJlbmNlX25vZGU7XG5cdHZhciByZXF1ZXN0X2Vycm9yX3JlcXVlc3RfaWRfbm9kZTtcblx0dmFyIGFjdGl2ZURpYWxvZyA9IG51bGw7XG5cdHZhciBkaWFsb2dUcmlnZ2VyID0gbnVsbDtcblx0dmFyIGFjdGl2ZVJlcXVlc3QgPSBudWxsO1xuXHR2YXIgcmVxdWVzdFNlcXVlbmNlID0gMDtcblx0dmFyIG1vZGVfdG9vbGJhcl9zaG93X3RpbWVyID0gbnVsbDtcblx0dmFyIG1vZGVfdG9vbGJhcl9oaWRlX3RpbWVyID0gbnVsbDtcblx0dmFyIHNhdmVfb3BlcmF0aW9uX3N0YXRlID0gbnVsbDtcblx0dmFyIHJlcXVlc3RfcGhhc2VzID0ge1xuXHRcdElETEU6ICdpZGxlJyxcblx0XHRSRVFVRVNUSU5HOiAncmVxdWVzdGluZycsXG5cdFx0UkVESVJFQ1RJTkc6ICdyZWRpcmVjdGluZydcblx0fTtcblx0dmFyIHJlcXVlc3RfcGhhc2UgPSByZXF1ZXN0X3BoYXNlcy5JRExFO1xuXHR2YXIgYnJvd3Nlcl9yZWFkeSA9IGZhbHNlO1xuXHR2YXIgc3RlcF9hZGFwdGVycyA9IFtdO1xuXG5cdGlmICggISBjb25maWcgfHwgISByb290ICkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHN0YXR1c05vZGUgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1zdGF0dXNdJyApO1xuXHR0cmFuc2l0aW9uX21lc3NhZ2Vfbm9kZSA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLXRyYW5zaXRpb24tbWVzc2FnZV0nICk7XG5cdHJlcXVlc3RfZXJyb3Jfbm9kZSA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLXJlcXVlc3QtZXJyb3JdJyApO1xuXHRyZXF1ZXN0X2Vycm9yX21lc3NhZ2Vfbm9kZSA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLXJlcXVlc3QtZXJyb3ItbWVzc2FnZV0nICk7XG5cdHJlcXVlc3RfZXJyb3JfcmVmZXJlbmNlX25vZGUgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1yZXF1ZXN0LWVycm9yLXJlZmVyZW5jZV0nICk7XG5cdHJlcXVlc3RfZXJyb3JfcmVxdWVzdF9pZF9ub2RlID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtcmVxdWVzdC1lcnJvci1yZXF1ZXN0LWlkXScgKTtcblxuXHQvKipcblx0ICogU2V0IHRoZSBsaXZlIHN0YXR1cyBtZXNzYWdlIGV4cG9zZWQgdG8gYXNzaXN0aXZlIHRlY2hub2xvZ3kuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFN0YXR1cyB0ZXh0LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0U3RhdHVzKCBtZXNzYWdlICkge1xuXHRcdGlmICggc3RhdHVzTm9kZSApIHtcblx0XHRcdHN0YXR1c05vZGUudGV4dENvbnRlbnQgPSBtZXNzYWdlIHx8ICcnO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIG5vcm1hbGl6ZWQgZGF0YSBvYmplY3QgZnJvbSBhIGRpcmVjdCBvciBqUXVlcnkgQUpBWCByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlX29yX3hociBXb3JkUHJlc3MgcmVzcG9uc2Ugb3IgalF1ZXJ5IHJlcXVlc3Qgb2JqZWN0LlxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IE5vcm1hbGl6ZWQgcmVzcG9uc2UgZGF0YS5cblx0ICovXG5cdGZ1bmN0aW9uIGdldF9yZXNwb25zZV9kYXRhKCByZXNwb25zZV9vcl94aHIgKSB7XG5cdFx0dmFyIHJlc3BvbnNlID0gcmVzcG9uc2Vfb3JfeGhyICYmIHJlc3BvbnNlX29yX3hoci5yZXNwb25zZUpTT05cblx0XHRcdD8gcmVzcG9uc2Vfb3JfeGhyLnJlc3BvbnNlSlNPTlxuXHRcdFx0OiByZXNwb25zZV9vcl94aHI7XG5cblx0XHRyZXR1cm4gcmVzcG9uc2UgJiYgcmVzcG9uc2UuZGF0YSAmJiAnb2JqZWN0JyA9PT0gdHlwZW9mIHJlc3BvbnNlLmRhdGFcblx0XHRcdD8gcmVzcG9uc2UuZGF0YVxuXHRcdFx0OiB7fTtcblx0fVxuXG5cdC8qKlxuXHQgKiBIaWRlIGFuZCByZXNldCB0aGUgc2hhcmVkIHJlcXVlc3QgZXJyb3Igbm90aWNlLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gY2xlYXJfcmVxdWVzdF9lcnJvcigpIHtcblx0XHRpZiAoICEgcmVxdWVzdF9lcnJvcl9ub2RlICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJlcXVlc3RfZXJyb3Jfbm9kZS5oaWRkZW4gPSB0cnVlO1xuXHRcdGlmICggcmVxdWVzdF9lcnJvcl9tZXNzYWdlX25vZGUgKSB7XG5cdFx0XHRyZXF1ZXN0X2Vycm9yX21lc3NhZ2Vfbm9kZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdH1cblx0XHRpZiAoIHJlcXVlc3RfZXJyb3JfcmVmZXJlbmNlX25vZGUgKSB7XG5cdFx0XHRyZXF1ZXN0X2Vycm9yX3JlZmVyZW5jZV9ub2RlLmhpZGRlbiA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICggcmVxdWVzdF9lcnJvcl9yZXF1ZXN0X2lkX25vZGUgKSB7XG5cdFx0XHRyZXF1ZXN0X2Vycm9yX3JlcXVlc3RfaWRfbm9kZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTaG93IG9uZSBzZXJ2ZXIgb3IgdHJhbnNwb3J0IGZhaWx1cmUgaW4gdGhlIGNvbW1vbiB3aXphcmQgYWxlcnQgcmVnaW9uLlxuXHQgKlxuXHQgKiBUZXh0IGlzIGFzc2lnbmVkIHRocm91Z2ggdGV4dENvbnRlbnQgc28gYW4gZXJyb3IgcmV0dXJuZWQgYnkgYW55IHN0ZXAgY2Fubm90XG5cdCAqIGluamVjdCBtYXJrdXAuIFRoZSByZXF1ZXN0IHJlZmVyZW5jZSBoZWxwcyBzdXBwb3J0IHN0YWZmIGNvcnJlbGF0ZSBhIHZpc2libGUgZXJyb3Jcblx0ICogd2l0aCBpdHMgc2VydmVyIHJlc3BvbnNlIHdpdGhvdXQgZXhwb3NpbmcgaW50ZXJuYWwgc3RhY2sgZGV0YWlscy5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlX29yX3hociBXb3JkUHJlc3MgcmVzcG9uc2Ugb3IgalF1ZXJ5IHJlcXVlc3Qgb2JqZWN0LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19yZXF1ZXN0X2Vycm9yKCByZXNwb25zZV9vcl94aHIgKSB7XG5cdFx0dmFyIHJlc3BvbnNlX2RhdGEgPSBnZXRfcmVzcG9uc2VfZGF0YSggcmVzcG9uc2Vfb3JfeGhyICk7XG5cdFx0dmFyIHJlcXVlc3RfaWQgPSByZXNwb25zZV9kYXRhLnJlcXVlc3RfaWQgPyBTdHJpbmcoIHJlc3BvbnNlX2RhdGEucmVxdWVzdF9pZCApIDogJyc7XG5cblx0XHRpZiAoICEgcmVxdWVzdF9lcnJvcl9ub2RlIHx8ICEgcmVxdWVzdF9lcnJvcl9tZXNzYWdlX25vZGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmVxdWVzdF9lcnJvcl9tZXNzYWdlX25vZGUudGV4dENvbnRlbnQgPSBnZXRFcnJvck1lc3NhZ2UoIHJlc3BvbnNlX29yX3hociApO1xuXHRcdGlmICggcmVxdWVzdF9lcnJvcl9yZWZlcmVuY2Vfbm9kZSAmJiByZXF1ZXN0X2Vycm9yX3JlcXVlc3RfaWRfbm9kZSApIHtcblx0XHRcdHJlcXVlc3RfZXJyb3JfcmVxdWVzdF9pZF9ub2RlLnRleHRDb250ZW50ID0gcmVxdWVzdF9pZDtcblx0XHRcdHJlcXVlc3RfZXJyb3JfcmVmZXJlbmNlX25vZGUuaGlkZGVuID0gISByZXF1ZXN0X2lkO1xuXHRcdH1cblxuXHRcdHJlcXVlc3RfZXJyb3Jfbm9kZS5oaWRkZW4gPSBmYWxzZTtcblx0XHR0cnkge1xuXHRcdFx0cmVxdWVzdF9lcnJvcl9ub2RlLmZvY3VzKCB7IHByZXZlbnRTY3JvbGw6IHRydWUgfSApO1xuXHRcdH0gY2F0Y2ggKCBmb2N1c19lcnJvciApIHtcblx0XHRcdHJlcXVlc3RfZXJyb3Jfbm9kZS5mb2N1cygpO1xuXHRcdH1cblx0XHR0cnkge1xuXHRcdFx0cmVxdWVzdF9lcnJvcl9ub2RlLnNjcm9sbEludG9WaWV3KCB7XG5cdFx0XHRcdGJlaGF2aW9yOiB3aW5kb3cubWF0Y2hNZWRpYSAmJiB3aW5kb3cubWF0Y2hNZWRpYSggJyhwcmVmZXJzLXJlZHVjZWQtbW90aW9uOiByZWR1Y2UpJyApLm1hdGNoZXMgPyAnYXV0bycgOiAnc21vb3RoJyxcblx0XHRcdFx0YmxvY2s6ICdzdGFydCdcblx0XHRcdH0gKTtcblx0XHR9IGNhdGNoICggc2Nyb2xsX2Vycm9yICkge1xuXHRcdFx0cmVxdWVzdF9lcnJvcl9ub2RlLnNjcm9sbEludG9WaWV3KCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFJlbGVhc2UgdGhlIHNlcnZlci1sb2NrZWQgZm9yd2FyZCBhY3Rpb24gYWZ0ZXIgYnJvd3NlciBpbml0aWFsaXphdGlvbi5cblx0ICpcblx0ICogVGhlIHByaW1hcnkgYWN0aW9uIGlzIHJlbmRlcmVkIGFzIGEgZGlzYWJsZWQgbm9uLXN1Ym1pdCBidXR0b24gc28gYSBjbGlja1xuXHQgKiBjYW5ub3QgZmFsbCB0aHJvdWdoIHRvIHRoZSBicm93c2VyJ3MgbmF0aXZlIEdFVCBmb3JtIHN1Ym1pc3Npb24gYmVmb3JlIHRoZVxuXHQgKiBzaGFyZWQgaGFuZGxlcnMgZXhpc3QuIEZvcm0tYmFja2VkIHN0ZXBzIHJlY292ZXIgc3VibWl0IGJlaGF2aW9yIG9ubHkgYWZ0ZXJcblx0ICogdGhlIHNoYXJlZCBjb250cm9sbGVyIGFuZCBkZXBlbmRlbnQgc3RlcCBzY3JpcHRzIGhhdmUgZmluaXNoZWQgbG9hZGluZy5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGVuYWJsZV9jb250aW51ZV93aGVuX3JlYWR5KCkge1xuXHRcdHZhciBjb250aW51ZV9idXR0b24gPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1lbmFibGUtd2hlbi1yZWFkeV0nICk7XG5cblx0XHRpZiAoICEgYnJvd3Nlcl9yZWFkeSB8fCByZXF1ZXN0X3BoYXNlcy5JRExFICE9PSByZXF1ZXN0X3BoYXNlIHx8ICEgY29udGludWVfYnV0dG9uICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggY29udGludWVfYnV0dG9uLmhhc0F0dHJpYnV0ZSggJ2RhdGEtd3BiYy1zZXR1cC13aXphcmQtc3VibWl0LXdoZW4tcmVhZHknICkgKSB7XG5cdFx0XHRjb250aW51ZV9idXR0b24udHlwZSA9ICdzdWJtaXQnO1xuXHRcdH1cblx0XHRjb250aW51ZV9idXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNYXJrIHRoZSBzaGFyZWQgc2hlbGwgcmVhZHkgYWZ0ZXIgZGVwZW5kZW50IGZvb3RlciBzY3JpcHRzIGhhdmUgZXhlY3V0ZWQuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBtYXJrX2Jyb3dzZXJfcmVhZHkoKSB7XG5cdFx0YnJvd3Nlcl9yZWFkeSA9IHRydWU7XG5cdFx0cm9vdC5kYXRhc2V0LndwYmNTZXR1cFdpemFyZEJyb3dzZXJSZWFkeSA9ICd0cnVlJztcblx0XHRlbmFibGVfY29udGludWVfd2hlbl9yZWFkeSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlZmVyIHJlYWRpbmVzcyB1bnRpbCBwYXJzaW5nIGFuZCBhbGwgRE9NQ29udGVudExvYWRlZCBsaXN0ZW5lcnMgY29tcGxldGUuXG5cdCAqXG5cdCAqIFRoZSB6ZXJvLWRlbGF5IHRhc2sgYWxzbyBjb3ZlcnMgb3B0aW1pemVkIGluc3RhbGxhdGlvbnMgdGhhdCBleGVjdXRlIHRoZVxuXHQgKiBmb290ZXIgYnVuZGxlIGFmdGVyIERPTUNvbnRlbnRMb2FkZWQgd2hpbGUgcHJlc2VydmluZyBkZXBlbmRlbmN5IG9yZGVyLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2NoZWR1bGVfYnJvd3Nlcl9yZWFkeSgpIHtcblx0XHR2YXIgZGVmZXJfcmVhZHkgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggbWFya19icm93c2VyX3JlYWR5LCAwICk7XG5cdFx0fTtcblxuXHRcdGlmICggJ2xvYWRpbmcnID09PSBkb2N1bWVudC5yZWFkeVN0YXRlICkge1xuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBkZWZlcl9yZWFkeSwgeyBvbmNlOiB0cnVlIH0gKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRkZWZlcl9yZWFkeSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIExvY2sgb3IgdW5sb2NrIGludGVyYWN0aXZlIHdpemFyZCBjb250cm9scyBhcm91bmQgb25lIGFjdGl2ZSByZXF1ZXN0LlxuXHQgKlxuXHQgKiBSZXBlYXRlZCBjYWxscyB3aXRoIHRoZSBjdXJyZW50IHN0YXRlIGFyZSBpZ25vcmVkIHNvIHRoZSBvcmlnaW5hbCBkaXNhYmxlZFxuXHQgKiBzdGF0ZSBvZiBldmVyeSBjb250cm9sIHJlbWFpbnMgYXZhaWxhYmxlIGZvciByZXN0b3JhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtib29sZWFufSBpc0J1c3kgV2hldGhlciBhIHJlcXVlc3QgaXMgYWN0aXZlLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0QnVzeSggaXNCdXN5ICkge1xuXHRcdHZhciBjdXJyZW50X2J1c3lfc3RhdGUgPSAndHJ1ZScgPT09IHJvb3QuZ2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JyApO1xuXG5cdFx0aWYgKCBjdXJyZW50X2J1c3lfc3RhdGUgPT09IGlzQnVzeSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyb290LmNsYXNzTGlzdC50b2dnbGUoICd3cGJjX3NldHVwX3dpemFyZC0tYnVzeScsIGlzQnVzeSApO1xuXHRcdHJvb3Quc2V0QXR0cmlidXRlKCAnYXJpYS1idXN5JywgaXNCdXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xuXG5cdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnYnV0dG9uLCBpbnB1dCwgc2VsZWN0LCB0ZXh0YXJlYScgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRpZiAoIGlzQnVzeSApIHtcblx0XHRcdFx0Y29udHJvbC5kYXRhc2V0LndwYmNXYXNEaXNhYmxlZCA9IGNvbnRyb2wuZGlzYWJsZWQgPyAndHJ1ZScgOiAnZmFsc2UnO1xuXHRcdFx0XHRjb250cm9sLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnRyb2wuZGlzYWJsZWQgPSAndHJ1ZScgPT09IGNvbnRyb2wuZGF0YXNldC53cGJjV2FzRGlzYWJsZWQ7XG5cdFx0XHRcdGRlbGV0ZSBjb250cm9sLmRhdGFzZXQud3BiY1dhc0Rpc2FibGVkO1xuXHRcdFx0fVxuXHRcdH0gKTtcblxuXHRcdGlmICggISBpc0J1c3kgKSB7XG5cdFx0XHRlbmFibGVfY29udGludWVfd2hlbl9yZWFkeSgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBVcGRhdGUgdGhlIHZpc2libGUgbWVzc2FnZSBpbnNpZGUgdGhlIGJsb2NraW5nIHRyYW5zaXRpb24gb3ZlcmxheS5cblx0ICpcblx0ICogVGhlIHNlcGFyYXRlIGxpdmUgc3RhdHVzIG5vZGUgcmVtYWlucyByZXNwb25zaWJsZSBmb3IgYW5ub3VuY2VtZW50cyB0b1xuXHQgKiBhc3Npc3RpdmUgdGVjaG5vbG9neS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVmlzaWJsZSB0cmFuc2l0aW9uIHRleHQuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBzZXRfdHJhbnNpdGlvbl9tZXNzYWdlKCBtZXNzYWdlICkge1xuXHRcdGlmICggdHJhbnNpdGlvbl9tZXNzYWdlX25vZGUgKSB7XG5cdFx0XHR0cmFuc2l0aW9uX21lc3NhZ2Vfbm9kZS50ZXh0Q29udGVudCA9IG1lc3NhZ2UgfHwgJyc7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIE1vdmUgdGhlIHJlcXVlc3QgY29udHJvbGxlciBiZXR3ZWVuIGlkbGUsIHJlcXVlc3RpbmcsIGFuZCByZWRpcmVjdGluZy5cblx0ICpcblx0ICogUmVkaXJlY3RpbmcgZGVsaWJlcmF0ZWx5IHJlbWFpbnMgYnVzeSBhZnRlciB0aGUgQUpBWCBwcm9taXNlIHNldHRsZXMuIFRoZVxuXHQgKiBvbGQgZG9jdW1lbnQgbXVzdCBzdGF5IGxvY2tlZCB1bnRpbCB0aGUgYnJvd3NlciByZXBsYWNlcyBpdC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHBoYXNlICAgT25lIHZhbHVlIGZyb20gcmVxdWVzdF9waGFzZXMuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlIFZpc2libGUgYW5kIGFubm91bmNlZCBwcm9ncmVzcyB0ZXh0LlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X3JlcXVlc3RfcGhhc2UoIHBoYXNlLCBtZXNzYWdlICkge1xuXHRcdHJlcXVlc3RfcGhhc2UgPSBwaGFzZTtcblx0XHRyb290LmRhdGFzZXQucmVxdWVzdFBoYXNlID0gcGhhc2U7XG5cblx0XHRpZiAoIHJlcXVlc3RfcGhhc2VzLklETEUgPT09IHBoYXNlICkge1xuXHRcdFx0c2V0X3RyYW5zaXRpb25fbWVzc2FnZSggJycgKTtcblx0XHRcdHNldEJ1c3koIGZhbHNlICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c2V0X3RyYW5zaXRpb25fbWVzc2FnZSggbWVzc2FnZSApO1xuXHRcdHNldEJ1c3koIHRydWUgKTtcblx0XHRzZXRTdGF0dXMoIG1lc3NhZ2UgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBQcmV2ZW50IGxpbmtzIG9yIGRlbGVnYXRlZCBjb250cm9scyBmcm9tIGFjdGluZyBvdXRzaWRlIHRoZSBpZGxlIHBoYXNlLlxuXHQgKlxuXHQgKiBOYXRpdmUgZm9ybSBjb250cm9scyBhcmUgZGlzYWJsZWQgYnkgc2V0QnVzeSgpLiBUaGlzIGNhcHR1cmUtcGhhc2UgZ3VhcmRcblx0ICogYWxzbyBibG9ja3MgdGhlIGhlYWRlciBsaW5rcyBhbmQgc2hhcmVkIHByb2R1Y3QgbWVudSBiZWZvcmUgdGhlaXIgb3duIGNsaWNrXG5cdCAqIGhhbmRsZXJzIHJ1biB3aGlsZSB0aGUgb2xkIGRvY3VtZW50IGlzIHdhaXRpbmcgdG8gYmUgcmVwbGFjZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7TW91c2VFdmVudH0gZXZlbnQgQ2FwdHVyZWQgY2xpY2sgZXZlbnQgaW5zaWRlIHRoZSB3aXphcmQgc2hlbGwuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBwcmV2ZW50X2ludGVyYWN0aW9uX3doaWxlX2J1c3koIGV2ZW50ICkge1xuXHRcdGlmICggcmVxdWVzdF9waGFzZXMuSURMRSA9PT0gcmVxdWVzdF9waGFzZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBldmVyeSBkcmFmdCBmaWVsZCBjb250cm9sIHJlbmRlcmVkIGJ5IHRoZSBjdXJyZW50IHN0ZXAuXG5cdCAqXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50W119IE9yZGVyZWQgY29udHJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRGaWVsZENvbnRyb2xzKCkge1xuXHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCggcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtZmllbGRdJyApICk7XG5cdH1cblxuXHQvKipcblx0ICogRmluZCBhbGwgY29udHJvbHMgc2hhcmluZyBvbmUgc3RhYmxlIGZpZWxkIG5hbWUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWVsZE5hbWUgRHJhZnQgZmllbGQgbmFtZS5cblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnRbXX0gTWF0Y2hpbmcgY29udHJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBmaW5kRmllbGRDb250cm9scyggZmllbGROYW1lICkge1xuXHRcdHJldHVybiBnZXRGaWVsZENvbnRyb2xzKCkuZmlsdGVyKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRyZXR1cm4gY29udHJvbC5uYW1lID09PSBmaWVsZE5hbWU7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgYSBmaWVsZC1sZXZlbCBlcnJvciBjb250YWluZXIgd2l0aG91dCBpbnRlcnBvbGF0aW5nIGEgQ1NTIHNlbGVjdG9yLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmllbGROYW1lIERyYWZ0IGZpZWxkIG5hbWUuXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IE1hdGNoaW5nIGVycm9yIG5vZGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBmaW5kRmllbGRFcnJvciggZmllbGROYW1lICkge1xuXHRcdHZhciBlcnJvck5vZGVzID0gcm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtZXJyb3ItZm9yXScgKTtcblx0XHR2YXIgbWF0Y2hpbmdOb2RlID0gbnVsbDtcblxuXHRcdGVycm9yTm9kZXMuZm9yRWFjaCggZnVuY3Rpb24gKCBlcnJvck5vZGUgKSB7XG5cdFx0XHRpZiAoIGVycm9yTm9kZS5kYXRhc2V0LndwYmNTZXR1cFdpemFyZEVycm9yRm9yID09PSBmaWVsZE5hbWUgKSB7XG5cdFx0XHRcdG1hdGNoaW5nTm9kZSA9IGVycm9yTm9kZTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRyZXR1cm4gbWF0Y2hpbmdOb2RlO1xuXHR9XG5cblx0LyoqXG5cdCAqIENsZWFyIGFuIGV4aXN0aW5nIGZpZWxkIGVycm9yIGFuZCBpbnZhbGlkIHN0YXRlLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmllbGROYW1lIERyYWZ0IGZpZWxkIG5hbWUuXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjbGVhckZpZWxkRXJyb3IoIGZpZWxkTmFtZSApIHtcblx0XHR2YXIgZXJyb3JOb2RlID0gZmluZEZpZWxkRXJyb3IoIGZpZWxkTmFtZSApO1xuXHRcdHZhciBhbHRlcm5hdGVDb250cm9sID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtZXJyb3ItY29udHJvbC1mb3I9XCInICsgZmllbGROYW1lICsgJ1wiXScgKTtcblxuXHRcdGZpbmRGaWVsZENvbnRyb2xzKCBmaWVsZE5hbWUgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRjb250cm9sLnJlbW92ZUF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcgKTtcblx0XHR9ICk7XG5cdFx0aWYgKCBhbHRlcm5hdGVDb250cm9sICkge1xuXHRcdFx0YWx0ZXJuYXRlQ29udHJvbC5yZW1vdmVBdHRyaWJ1dGUoICdhcmlhLWludmFsaWQnICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBlcnJvck5vZGUgKSB7XG5cdFx0XHRlcnJvck5vZGUudGV4dENvbnRlbnQgPSAnJztcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIG9uZSBjbGllbnQtIG9yIHNlcnZlci1wcm92aWRlZCBmaWVsZCBlcnJvci5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkTmFtZSBEcmFmdCBmaWVsZCBuYW1lLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBIdW1hbi1yZWFkYWJsZSB2YWxpZGF0aW9uIG1lc3NhZ2UuXG5cdCAqIEByZXR1cm4ge0hUTUxFbGVtZW50fG51bGx9IEZpcnN0IGludmFsaWQgY29udHJvbC5cblx0ICovXG5cdGZ1bmN0aW9uIHNldEZpZWxkRXJyb3IoIGZpZWxkTmFtZSwgbWVzc2FnZSApIHtcblx0XHR2YXIgY29udHJvbHMgPSBmaW5kRmllbGRDb250cm9scyggZmllbGROYW1lICk7XG5cdFx0dmFyIGVycm9yTm9kZSA9IGZpbmRGaWVsZEVycm9yKCBmaWVsZE5hbWUgKTtcblx0XHR2YXIgYWx0ZXJuYXRlQ29udHJvbCA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWVycm9yLWNvbnRyb2wtZm9yPVwiJyArIGZpZWxkTmFtZSArICdcIl0nICk7XG5cblx0XHRjb250cm9scy5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRjb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcsICd0cnVlJyApO1xuXHRcdH0gKTtcblxuXHRcdGlmICggZXJyb3JOb2RlICkge1xuXHRcdFx0ZXJyb3JOb2RlLnRleHRDb250ZW50ID0gbWVzc2FnZTtcblx0XHR9XG5cblx0XHRpZiAoIGFsdGVybmF0ZUNvbnRyb2wgKSB7XG5cdFx0XHRhbHRlcm5hdGVDb250cm9sLnNldEF0dHJpYnV0ZSggJ2FyaWEtaW52YWxpZCcsICd0cnVlJyApO1xuXHRcdH1cblxuXHRcdHJldHVybiBhbHRlcm5hdGVDb250cm9sIHx8ICggY29udHJvbHMubGVuZ3RoID8gY29udHJvbHNbIDAgXSA6IG51bGwgKTtcblx0fVxuXG5cblx0LyoqXG5cdCAqIExvY2sgb3IgdW5sb2NrIHRoZSBjb25zdW1lciBzaGVsbCBmb3IgYW4gZXhwbGljaXQgbW9kdWxlIG9wZXJhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19idXN5IFdoZXRoZXIgdGhlIG1vZHVsZSBvcGVyYXRpb24gaXMgYWN0aXZlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gIG1lc3NhZ2UgQWNjZXNzaWJsZSBvcGVyYXRpb24gc3RhdHVzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2V0X3N0ZXBfYWRhcHRlcl9idXN5KCBpc19idXN5LCBtZXNzYWdlICkge1xuXHRcdHNldF9yZXF1ZXN0X3BoYXNlKCBpc19idXN5ID8gcmVxdWVzdF9waGFzZXMuUkVRVUVTVElORyA6IHJlcXVlc3RfcGhhc2VzLklETEUsIG1lc3NhZ2UgfHwgJycgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZWdpc3RlciBvbmUgY3VycmVudC1wYWdlIGVkaXRvciBhZGFwdGVyIHdpdGggdGhlIHNoYXJlZCB3aXphcmQgc2hlbGwuXG5cdCAqXG5cdCAqIEEgc3RlcCBtb2R1bGUgb3ducyBpdHMgcmVuZGVyaW5nLCBkcmFmdCBzeW5jaHJvbml6YXRpb24sIGFuZCBjbGllbnQtc2lkZVxuXHQgKiB2YWxpZGF0aW9uLiBUaGUgc2hlbGwgZXhwb3NlcyBvbmx5IG5hdmlnYXRpb24tc2FmZSBzZXJ2aWNlcyBhbmQgbmV2ZXJcblx0ICogYXNzdW1lcyB3aGljaCBkb21haW4gZmllbGRzIGFyZSBwcmVzZW50LlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0gc3RlcF9hZGFwdGVyIFN0ZXAtb3duZWQgYWRhcHRlciBjb250cmFjdC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3N0ZXBfYWRhcHRlciggc3RlcF9hZGFwdGVyICkge1xuXHRcdGlmICggISBzdGVwX2FkYXB0ZXIgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHN0ZXBfYWRhcHRlci5pbml0aWFsaXplICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN0ZXBfYWRhcHRlcnMucHVzaCggc3RlcF9hZGFwdGVyICk7XG5cdFx0c3RlcF9hZGFwdGVyLmluaXRpYWxpemUoIHtcblx0XHRcdHJvb3Q6IHJvb3QsXG5cdFx0XHRjb25maWc6IGNvbmZpZyxcblx0XHRcdHNldF9zdGF0dXM6IHNldFN0YXR1cyxcblx0XHRcdHNob3dfZXJyb3I6IHNob3dfcmVxdWVzdF9lcnJvcixcblx0XHRcdGNsZWFyX2Vycm9yOiBjbGVhcl9yZXF1ZXN0X2Vycm9yLFxuXHRcdFx0c2V0X2J1c3k6IHNldF9zdGVwX2FkYXB0ZXJfYnVzeSxcblx0XHRcdHNldF9maWVsZF9lcnJvcjogc2V0RmllbGRFcnJvcixcblx0XHRcdGNsZWFyX2ZpZWxkX2Vycm9yOiBjbGVhckZpZWxkRXJyb3IsXG5cdFx0XHRvcGVuX2RpYWxvZzogb3BlbkRpYWxvZ1xuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSBldmVyeSByZWdpc3RlcmVkIHN0ZXAgYWRhcHRlciBiZWZvcmUgZHJhZnQgY29sbGVjdGlvbi5cblx0ICpcblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHN5bmNfc3RlcF9hZGFwdGVycygpIHtcblx0XHRzdGVwX2FkYXB0ZXJzLmZvckVhY2goIGZ1bmN0aW9uICggc3RlcF9hZGFwdGVyICkge1xuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygc3RlcF9hZGFwdGVyLnN5bmMgKSB7XG5cdFx0XHRcdHN0ZXBfYWRhcHRlci5zeW5jKCk7XG5cdFx0XHR9XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFZhbGlkYXRlIHJlZ2lzdGVyZWQgc3RlcCBtb2R1bGVzIGluIHJlZ2lzdHJhdGlvbiBvcmRlci5cblx0ICpcblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnR8bnVsbH0gRmlyc3QgaW52YWxpZCBjb250cm9sLCBvciBudWxsLlxuXHQgKi9cblx0ZnVuY3Rpb24gdmFsaWRhdGVfc3RlcF9hZGFwdGVycygpIHtcblx0XHR2YXIgZmlyc3RfaW52YWxpZF9jb250cm9sID0gbnVsbDtcblxuXHRcdHN0ZXBfYWRhcHRlcnMuc29tZSggZnVuY3Rpb24gKCBzdGVwX2FkYXB0ZXIgKSB7XG5cdFx0XHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiBzdGVwX2FkYXB0ZXIudmFsaWRhdGUgKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Zmlyc3RfaW52YWxpZF9jb250cm9sID0gc3RlcF9hZGFwdGVyLnZhbGlkYXRlKCk7XG5cdFx0XHRyZXR1cm4gQm9vbGVhbiggZmlyc3RfaW52YWxpZF9jb250cm9sICk7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGZpcnN0X2ludmFsaWRfY29udHJvbDtcblx0fVxuXG5cdHdpbmRvdy53cGJjX3NldHVwX3dpemFyZF9hcGkgPSB7XG5cdFx0cmVnaXN0ZXJfc3RlcF9hZGFwdGVyOiByZWdpc3Rlcl9zdGVwX2FkYXB0ZXJcblx0fTtcblxuXHQvKipcblx0ICogUmVtb3ZlIGV2ZXJ5IHZpc2libGUgdmFsaWRhdGlvbiBlcnJvciBmcm9tIHRoZSBjdXJyZW50IHN0ZXAuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBjbGVhckZpZWxkRXJyb3JzKCkge1xuXHRcdGdldEZpZWxkQ29udHJvbHMoKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGNvbnRyb2wgKSB7XG5cdFx0XHRjbGVhckZpZWxkRXJyb3IoIGNvbnRyb2wubmFtZSApO1xuXHRcdH0gKTtcblxuXHRcdHJvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtcmV2aWV3LXN0ZXBdLmhhcy1lcnJvcicgKS5mb3JFYWNoKCBmdW5jdGlvbiAoIHJldmlld19yb3cgKSB7XG5cdFx0XHRyZXZpZXdfcm93LmNsYXNzTGlzdC5yZW1vdmUoICdoYXMtZXJyb3InICk7XG5cdFx0fSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFZhbGlkYXRlIHJlcXVpcmVkIGFuZCBlbWFpbCBmaWVsZHMgYmVmb3JlIGZvcndhcmQgbmF2aWdhdGlvbi5cblx0ICpcblx0ICogU2VydmVyIHZhbGlkYXRpb24gcmVtYWlucyBhdXRob3JpdGF0aXZlLiBUaGlzIGNoZWNrIHByb3ZpZGVzIGltbWVkaWF0ZVxuXHQgKiBrZXlib2FyZCBmb2N1cyBhbmQgYXZvaWRzIGEgbmVlZGxlc3MgcmVxdWVzdCBmb3Igb2J2aW91cyBvbWlzc2lvbnMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgd2hlbiBjbGllbnQtdmlzaWJsZSBjb25zdHJhaW50cyBwYXNzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdmFsaWRhdGVDdXJyZW50U3RlcCgpIHtcblx0XHR2YXIgY29udHJvbHMgPSBnZXRGaWVsZENvbnRyb2xzKCk7XG5cdFx0dmFyIGhhbmRsZWRGaWVsZHMgPSB7fTtcblx0XHR2YXIgZmlyc3RJbnZhbGlkQ29udHJvbCA9IG51bGw7XG5cblx0XHRjbGVhckZpZWxkRXJyb3JzKCk7XG5cblx0XHRmaXJzdEludmFsaWRDb250cm9sID0gdmFsaWRhdGVfc3RlcF9hZGFwdGVycygpO1xuXHRcdGlmICggZmlyc3RJbnZhbGlkQ29udHJvbCApIHtcblx0XHRcdHNldFN0YXR1cyggY29uZmlnLmkxOG4udmFsaWRhdGlvbl9lcnJvciApO1xuXHRcdFx0Zmlyc3RJbnZhbGlkQ29udHJvbC5mb2N1cygpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnRyb2xzLmZvckVhY2goIGZ1bmN0aW9uICggY29udHJvbCApIHtcblx0XHRcdHZhciBmaWVsZENvbnRyb2xzO1xuXHRcdFx0dmFyIGhhc1ZhbHVlO1xuXHRcdFx0dmFyIGludmFsaWRNZXNzYWdlID0gJyc7XG5cblx0XHRcdGlmICggaGFuZGxlZEZpZWxkc1sgY29udHJvbC5uYW1lIF0gKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGhhbmRsZWRGaWVsZHNbIGNvbnRyb2wubmFtZSBdID0gdHJ1ZTtcblx0XHRcdGZpZWxkQ29udHJvbHMgPSBmaW5kRmllbGRDb250cm9scyggY29udHJvbC5uYW1lICk7XG5cblx0XHRcdGlmICggJ3JhZGlvJyA9PT0gY29udHJvbC50eXBlICkge1xuXHRcdFx0XHRoYXNWYWx1ZSA9IGZpZWxkQ29udHJvbHMuc29tZSggZnVuY3Rpb24gKCByYWRpb0NvbnRyb2wgKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJhZGlvQ29udHJvbC5jaGVja2VkO1xuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAnY2hlY2tib3gnID09PSBjb250cm9sLnR5cGUgKSB7XG5cdFx0XHRcdGhhc1ZhbHVlID0gY29udHJvbC5jaGVja2VkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aGFzVmFsdWUgPSAnJyAhPT0gU3RyaW5nKCBjb250cm9sLnZhbHVlICkudHJpbSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIGNvbnRyb2wucmVxdWlyZWQgJiYgISBoYXNWYWx1ZSApIHtcblx0XHRcdFx0aW52YWxpZE1lc3NhZ2UgPSBjb25maWcuaTE4bi5yZXF1aXJlZDtcblx0XHRcdH0gZWxzZSBpZiAoICdlbWFpbCcgPT09IGNvbnRyb2wudHlwZSAmJiBoYXNWYWx1ZSAmJiBjb250cm9sLnZhbGlkaXR5ICYmIGNvbnRyb2wudmFsaWRpdHkudHlwZU1pc21hdGNoICkge1xuXHRcdFx0XHRpbnZhbGlkTWVzc2FnZSA9IGNvbmZpZy5pMThuLmludmFsaWRfZW1haWw7XG5cdFx0XHR9XG5cblx0XHRcdGlmICggaW52YWxpZE1lc3NhZ2UgKSB7XG5cdFx0XHRcdGZpcnN0SW52YWxpZENvbnRyb2wgPSBmaXJzdEludmFsaWRDb250cm9sIHx8IHNldEZpZWxkRXJyb3IoIGNvbnRyb2wubmFtZSwgaW52YWxpZE1lc3NhZ2UgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRpZiAoIGZpcnN0SW52YWxpZENvbnRyb2wgKSB7XG5cdFx0XHRzZXRTdGF0dXMoIGNvbmZpZy5pMThuLnZhbGlkYXRpb25fZXJyb3IgKTtcblx0XHRcdGZpcnN0SW52YWxpZENvbnRyb2wuZm9jdXMoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb2xsZWN0IHNjYWxhciB2YWx1ZXMgZnJvbSB0aGUgY3VycmVudCBhbGxvdy1saXN0ZWQgZm9ybSBjb250cm9scy5cblx0ICpcblx0ICogQHJldHVybiB7T2JqZWN0fSBEcmFmdCBmaWVsZCB2YWx1ZXMga2V5ZWQgYnkgc3RhYmxlIGZpZWxkIG5hbWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBjb2xsZWN0RmllbGRzKCkge1xuXHRcdHZhciBmaWVsZFZhbHVlcyA9IHt9O1xuXG5cdFx0c3luY19zdGVwX2FkYXB0ZXJzKCk7XG5cblx0XHRnZXRGaWVsZENvbnRyb2xzKCkuZm9yRWFjaCggZnVuY3Rpb24gKCBjb250cm9sICkge1xuXHRcdFx0aWYgKCAncmFkaW8nID09PSBjb250cm9sLnR5cGUgKSB7XG5cdFx0XHRcdGlmICggY29udHJvbC5jaGVja2VkICkge1xuXHRcdFx0XHRcdGZpZWxkVmFsdWVzWyBjb250cm9sLm5hbWUgXSA9IGNvbnRyb2wudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoICdjaGVja2JveCcgPT09IGNvbnRyb2wudHlwZSApIHtcblx0XHRcdFx0ZmllbGRWYWx1ZXNbIGNvbnRyb2wubmFtZSBdID0gY29udHJvbC5jaGVja2VkID8gJzEnIDogJzAnO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGZpZWxkVmFsdWVzWyBjb250cm9sLm5hbWUgXSA9IGNvbnRyb2wudmFsdWU7XG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIGZpZWxkVmFsdWVzO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4dHJhY3QgYSBzYWZlIG1lc3NhZ2UgZnJvbSBhIGZhaWxlZCBXb3JkUHJlc3MgQUpBWCByZXNwb25zZS5cblx0ICpcblx0ICogQHBhcmFtIHtPYmplY3R9IHJlc3BvbnNlX29yX3hociBXb3JkUHJlc3MgcmVzcG9uc2Ugb3IgalF1ZXJ5IHJlcXVlc3Qgb2JqZWN0LlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9IEh1bWFuLXJlYWRhYmxlIGVycm9yIHRleHQuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRFcnJvck1lc3NhZ2UoIHJlc3BvbnNlX29yX3hociApIHtcblx0XHR2YXIgcmVzcG9uc2VfZGF0YSA9IGdldF9yZXNwb25zZV9kYXRhKCByZXNwb25zZV9vcl94aHIgKTtcblxuXHRcdGlmICggcmVzcG9uc2VfZGF0YS5tZXNzYWdlICkge1xuXHRcdFx0cmV0dXJuIFN0cmluZyggcmVzcG9uc2VfZGF0YS5tZXNzYWdlICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbmZpZy5pMThuLmVycm9yO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbmRlciBzZXJ2ZXItc2lkZSBmaWVsZCBlcnJvcnMgYW5kIGZvY3VzIHRoZSBmaXJzdCByZWplY3RlZCBjb250cm9sLlxuXHQgKlxuXHQgKiBAcGFyYW0ge09iamVjdH0geGhyIGpRdWVyeSByZXF1ZXN0IG9iamVjdC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlbmRlclNlcnZlckVycm9ycyggeGhyICkge1xuXHRcdHZhciByZXNwb25zZURhdGEgPSB4aHIgJiYgeGhyLnJlc3BvbnNlSlNPTiA/IHhoci5yZXNwb25zZUpTT04uZGF0YSA6IG51bGw7XG5cdFx0dmFyIGZpcnN0SW52YWxpZENvbnRyb2wgPSBudWxsO1xuXHRcdHZhciBpbnZhbGlkX3N0ZXBfcm93ID0gbnVsbDtcblxuXHRcdGlmICggISByZXNwb25zZURhdGEgfHwgKCAhIHJlc3BvbnNlRGF0YS5maWVsZF9lcnJvcnMgJiYgISByZXNwb25zZURhdGEuaW52YWxpZF9zdGVwX2lkICkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0T2JqZWN0LmtleXMoIHJlc3BvbnNlRGF0YS5maWVsZF9lcnJvcnMgfHwge30gKS5mb3JFYWNoKCBmdW5jdGlvbiAoIGZpZWxkTmFtZSApIHtcblx0XHRcdGZpcnN0SW52YWxpZENvbnRyb2wgPSBmaXJzdEludmFsaWRDb250cm9sIHx8IHNldEZpZWxkRXJyb3IoIGZpZWxkTmFtZSwgU3RyaW5nKCByZXNwb25zZURhdGEuZmllbGRfZXJyb3JzWyBmaWVsZE5hbWUgXSApICk7XG5cdFx0fSApO1xuXG5cdFx0aWYgKCByZXNwb25zZURhdGEuaW52YWxpZF9zdGVwX2lkICkge1xuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1yZXZpZXctc3RlcF0nICkuZm9yRWFjaCggZnVuY3Rpb24gKCByZXZpZXdfcm93ICkge1xuXHRcdFx0XHRpZiAoIHJldmlld19yb3cuZGF0YXNldC53cGJjUmV2aWV3U3RlcCA9PT0gcmVzcG9uc2VEYXRhLmludmFsaWRfc3RlcF9pZCApIHtcblx0XHRcdFx0XHRpbnZhbGlkX3N0ZXBfcm93ID0gcmV2aWV3X3Jvdztcblx0XHRcdFx0XHRyZXZpZXdfcm93LmNsYXNzTGlzdC5hZGQoICdoYXMtZXJyb3InICk7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblx0XHR9XG5cblx0XHRpZiAoIGZpcnN0SW52YWxpZENvbnRyb2wgKSB7XG5cdFx0XHRmaXJzdEludmFsaWRDb250cm9sLmZvY3VzKCk7XG5cdFx0fSBlbHNlIGlmICggaW52YWxpZF9zdGVwX3JvdyApIHtcblx0XHRcdGZpcnN0SW52YWxpZENvbnRyb2wgPSBpbnZhbGlkX3N0ZXBfcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1lZGl0LXN0ZXBdJyApO1xuXHRcdFx0aWYgKCBmaXJzdEludmFsaWRDb250cm9sICkge1xuXHRcdFx0XHRmaXJzdEludmFsaWRDb250cm9sLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEJ1aWxkIGEgc3RhYmxlIGlkZW1wb3RlbmN5IGtleSBmb3Igb25lIHBhZ2UsIHJldmlzaW9uLCBhbmQgZmllbGQgc25hcHNob3QuXG5cdCAqXG5cdCAqIFR3byBicm93c2VyIHRhYnMgcmVjZWl2ZSBkaWZmZXJlbnQgZW50cm9weSwgd2hpbGUgYW4gdW5jaGFuZ2VkIHJldHJ5IGFmdGVyXG5cdCAqIGFuIGFtYmlndW91cyByZXNwb25zZSByZXVzZXMgdGhlIHNhbWUgaWRlbnRpZmllci4gRWRpdGluZyBhIGZpZWxkIGNyZWF0ZXNcblx0ICogYSBuZXcgbG9naWNhbCBvcGVyYXRpb24gcmF0aGVyIHRoYW4gcmVwbGF5aW5nIHRoZSBwcmV2aW91cyByZXN1bHQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWVsZF92YWx1ZXMgQ3VycmVudCBzY2FsYXIgZmllbGQgc25hcHNob3QuXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gU3RhYmxlIG9wZXJhdGlvbiBpZGVudGlmaWVyLlxuXHQgKi9cblx0ZnVuY3Rpb24gZ2V0X3NhdmVfb3BlcmF0aW9uX2lkKCBmaWVsZF92YWx1ZXMgKSB7XG5cdFx0dmFyIG5vcm1hbGl6ZWRfZmllbGRzID0ge307XG5cdFx0dmFyIGZpZWxkX3NpZ25hdHVyZTtcblx0XHR2YXIgZW50cm9weV92YWx1ZXM7XG5cdFx0dmFyIGVudHJvcHk7XG5cdFx0dmFyIG9wZXJhdGlvbl9pZDtcblxuXHRcdE9iamVjdC5rZXlzKCBmaWVsZF92YWx1ZXMgfHwge30gKS5zb3J0KCkuZm9yRWFjaCggZnVuY3Rpb24gKCBmaWVsZF9uYW1lICkge1xuXHRcdFx0bm9ybWFsaXplZF9maWVsZHNbIGZpZWxkX25hbWUgXSA9IGZpZWxkX3ZhbHVlc1sgZmllbGRfbmFtZSBdO1xuXHRcdH0gKTtcblx0XHRmaWVsZF9zaWduYXR1cmUgPSBKU09OLnN0cmluZ2lmeSggbm9ybWFsaXplZF9maWVsZHMgKTtcblxuXHRcdGlmIChcblx0XHRcdHNhdmVfb3BlcmF0aW9uX3N0YXRlXG5cdFx0XHQmJiBzYXZlX29wZXJhdGlvbl9zdGF0ZS5zdGVwX2lkID09PSBjb25maWcuY3VycmVudF9zdGVwXG5cdFx0XHQmJiBzYXZlX29wZXJhdGlvbl9zdGF0ZS5yZXZpc2lvbiA9PT0gY29uZmlnLnJldmlzaW9uXG5cdFx0XHQmJiBzYXZlX29wZXJhdGlvbl9zdGF0ZS5maWVsZF9zaWduYXR1cmUgPT09IGZpZWxkX3NpZ25hdHVyZVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHNhdmVfb3BlcmF0aW9uX3N0YXRlLm9wZXJhdGlvbl9pZDtcblx0XHR9XG5cblx0XHRpZiAoIHdpbmRvdy5jcnlwdG8gJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzICkge1xuXHRcdFx0ZW50cm9weV92YWx1ZXMgPSBuZXcgVWludDMyQXJyYXkoIDIgKTtcblx0XHRcdHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKCBlbnRyb3B5X3ZhbHVlcyApO1xuXHRcdFx0ZW50cm9weSA9IGVudHJvcHlfdmFsdWVzWyAwIF0udG9TdHJpbmcoIDM2ICkgKyBlbnRyb3B5X3ZhbHVlc1sgMSBdLnRvU3RyaW5nKCAzNiApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbnRyb3B5ID0gRGF0ZS5ub3coKS50b1N0cmluZyggMzYgKSArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoIDM2ICkuc2xpY2UoIDIsIDEyICk7XG5cdFx0fVxuXG5cdFx0b3BlcmF0aW9uX2lkID0gKFxuXHRcdFx0J3NhdmVfJyArXG5cdFx0XHRTdHJpbmcoIGNvbmZpZy5jdXJyZW50X3N0ZXAgfHwgJycgKS5yZXBsYWNlKCAvW15hLXowLTlfLV0vZ2ksICcnICkgKyAnXycgK1xuXHRcdFx0U3RyaW5nKCBjb25maWcucmV2aXNpb24gKSArICdfJyArXG5cdFx0XHRlbnRyb3B5XG5cdFx0KS5zbGljZSggMCwgMTAwICk7XG5cdFx0c2F2ZV9vcGVyYXRpb25fc3RhdGUgPSB7XG5cdFx0XHRzdGVwX2lkOiBjb25maWcuY3VycmVudF9zdGVwLFxuXHRcdFx0cmV2aXNpb246IGNvbmZpZy5yZXZpc2lvbixcblx0XHRcdGZpZWxkX3NpZ25hdHVyZTogZmllbGRfc2lnbmF0dXJlLFxuXHRcdFx0b3BlcmF0aW9uX2lkOiBvcGVyYXRpb25faWRcblx0XHR9O1xuXG5cdFx0cmV0dXJuIG9wZXJhdGlvbl9pZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBTZW5kIG9uZSByZXZpc2lvbi1ib3VuZCBhY3Rpb24gYW5kIGlnbm9yZSBhYm9ydGVkIG9yIHN0YWxlIHJlc3BvbnNlcy5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvbiBXb3JkUHJlc3MgQUpBWCBhY3Rpb24uXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBwYXlsb2FkIEFjdGlvbi1zcGVjaWZpYyBzY2FsYXIgb3IgZmllbGQgdmFsdWVzLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2VuZFJlcXVlc3QoIGFjdGlvbiwgcGF5bG9hZCApIHtcblx0XHR2YXIgc2VxdWVuY2U7XG5cdFx0dmFyIHJlcXVlc3RJZDtcblxuXHRcdHJlcXVlc3RTZXF1ZW5jZSArPSAxO1xuXHRcdHNlcXVlbmNlID0gcmVxdWVzdFNlcXVlbmNlO1xuXHRcdHJlcXVlc3RJZCA9ICdyZXF1ZXN0XycgKyBEYXRlLm5vdygpICsgJ18nICsgc2VxdWVuY2U7XG5cblx0XHRpZiAoIGFjdGl2ZVJlcXVlc3QgKSB7XG5cdFx0XHRhY3RpdmVSZXF1ZXN0LmFib3J0KCk7XG5cdFx0fVxuXG5cdFx0Y2xlYXJfcmVxdWVzdF9lcnJvcigpO1xuXHRcdHNldF9yZXF1ZXN0X3BoYXNlKCByZXF1ZXN0X3BoYXNlcy5SRVFVRVNUSU5HLCBjb25maWcuaTE4bi53b3JraW5nICk7XG5cblx0XHRhY3RpdmVSZXF1ZXN0ID0gJC5hamF4KCB7XG5cdFx0XHR1cmw6IGNvbmZpZy5hamF4X3VybCxcblx0XHRcdG1ldGhvZDogJ1BPU1QnLFxuXHRcdFx0ZGF0YVR5cGU6ICdqc29uJyxcblx0XHRcdGRhdGE6ICQuZXh0ZW5kKCB7fSwgcGF5bG9hZCwge1xuXHRcdFx0XHRhY3Rpb246IGFjdGlvbixcblx0XHRcdFx0bm9uY2U6IGNvbmZpZy5ub25jZSxcblx0XHRcdFx0Y3VycmVudF9zdGVwOiBjb25maWcuY3VycmVudF9zdGVwLFxuXHRcdFx0XHRleHBlY3RlZF9yZXZpc2lvbjogY29uZmlnLnJldmlzaW9uLFxuXHRcdFx0XHRyZXF1ZXN0X2lkOiByZXF1ZXN0SWRcblx0XHRcdH0gKVxuXHRcdH0gKTtcblxuXHRcdGFjdGl2ZVJlcXVlc3QuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcblx0XHRcdGlmICggc2VxdWVuY2UgIT09IHJlcXVlc3RTZXF1ZW5jZSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCEgcmVzcG9uc2UgfHxcblx0XHRcdFx0ISByZXNwb25zZS5zdWNjZXNzIHx8XG5cdFx0XHRcdCEgcmVzcG9uc2UuZGF0YSB8fFxuXHRcdFx0XHRyZXNwb25zZS5kYXRhLnJlcXVlc3RfaWQgIT09IHJlcXVlc3RJZFxuXHRcdFx0KSB7XG5cdFx0XHRcdHNldF9yZXF1ZXN0X3BoYXNlKCByZXF1ZXN0X3BoYXNlcy5JRExFICk7XG5cdFx0XHRcdHNob3dfcmVxdWVzdF9lcnJvciggcmVzcG9uc2UgKTtcblx0XHRcdFx0c2V0U3RhdHVzKCBnZXRFcnJvck1lc3NhZ2UoIHJlc3BvbnNlICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIHJlc3BvbnNlLmRhdGEuY2hlY2twb2ludCApIHtcblx0XHRcdFx0Y29uZmlnLmN1cnJlbnRfc3RlcCA9IHJlc3BvbnNlLmRhdGEuY2hlY2twb2ludC5jdXJyZW50X3N0ZXA7XG5cdFx0XHRcdGNvbmZpZy5yZXZpc2lvbiA9IHJlc3BvbnNlLmRhdGEuY2hlY2twb2ludC5yZXZpc2lvbjtcblx0XHRcdFx0cm9vdC5kYXRhc2V0LnJldmlzaW9uID0gU3RyaW5nKCByZXNwb25zZS5kYXRhLmNoZWNrcG9pbnQucmV2aXNpb24gKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAnc3RyaW5nJyAhPT0gdHlwZW9mIHJlc3BvbnNlLmRhdGEucmVkaXJlY3RfdXJsIHx8ICcnID09PSByZXNwb25zZS5kYXRhLnJlZGlyZWN0X3VybC50cmltKCkgKSB7XG5cdFx0XHRcdHNldF9yZXF1ZXN0X3BoYXNlKCByZXF1ZXN0X3BoYXNlcy5JRExFICk7XG5cdFx0XHRcdHNob3dfcmVxdWVzdF9lcnJvciggcmVzcG9uc2UgKTtcblx0XHRcdFx0c2V0U3RhdHVzKCBnZXRFcnJvck1lc3NhZ2UoIHJlc3BvbnNlICkgKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzZXRfcmVxdWVzdF9waGFzZSggcmVxdWVzdF9waGFzZXMuUkVESVJFQ1RJTkcsIGNvbmZpZy5pMThuLmxvYWRpbmcgKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0d2luZG93LmxvY2F0aW9uLmFzc2lnbiggcmVzcG9uc2UuZGF0YS5yZWRpcmVjdF91cmwgKTtcblx0XHRcdH0gY2F0Y2ggKCByZWRpcmVjdEVycm9yICkge1xuXHRcdFx0XHRzZXRfcmVxdWVzdF9waGFzZSggcmVxdWVzdF9waGFzZXMuSURMRSApO1xuXHRcdFx0XHRzaG93X3JlcXVlc3RfZXJyb3IoIHt9ICk7XG5cdFx0XHRcdHNldFN0YXR1cyggY29uZmlnLmkxOG4uZXJyb3IgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHRhY3RpdmVSZXF1ZXN0LmZhaWwoIGZ1bmN0aW9uICggeGhyLCB0ZXh0U3RhdHVzICkge1xuXHRcdFx0aWYgKCAnYWJvcnQnID09PSB0ZXh0U3RhdHVzIHx8IHNlcXVlbmNlICE9PSByZXF1ZXN0U2VxdWVuY2UgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0c2V0X3JlcXVlc3RfcGhhc2UoIHJlcXVlc3RfcGhhc2VzLklETEUgKTtcblx0XHRcdHNob3dfcmVxdWVzdF9lcnJvciggeGhyICk7XG5cdFx0XHRyZW5kZXJTZXJ2ZXJFcnJvcnMoIHhociApO1xuXHRcdFx0c2V0U3RhdHVzKCBnZXRFcnJvck1lc3NhZ2UoIHhociApICk7XG5cdFx0fSApO1xuXG5cdFx0YWN0aXZlUmVxdWVzdC5hbHdheXMoIGZ1bmN0aW9uICgpIHtcblx0XHRcdGlmICggc2VxdWVuY2UgPT09IHJlcXVlc3RTZXF1ZW5jZSApIHtcblx0XHRcdFx0YWN0aXZlUmVxdWVzdCA9IG51bGw7XG5cdFx0XHRcdGlmICggcmVxdWVzdF9waGFzZXMuUkVESVJFQ1RJTkcgIT09IHJlcXVlc3RfcGhhc2UgKSB7XG5cdFx0XHRcdFx0c2V0X3JlcXVlc3RfcGhhc2UoIHJlcXVlc3RfcGhhc2VzLklETEUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm4gZm9jdXNhYmxlIGNvbnRyb2xzIGN1cnJlbnRseSBhdmFpbGFibGUgaW4gYSBkaWFsb2cuXG5cdCAqXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGRpYWxvZyBEaWFsb2cgZWxlbWVudC5cblx0ICogQHJldHVybiB7SFRNTEVsZW1lbnRbXX0gT3JkZXJlZCBmb2N1c2FibGUgZWxlbWVudHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRGb2N1c2FibGVFbGVtZW50cyggZGlhbG9nICkge1xuXHRcdHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChcblx0XHRcdGRpYWxvZy5xdWVyeVNlbGVjdG9yQWxsKCAnYnV0dG9uOm5vdChbZGlzYWJsZWRdKSwgYVtocmVmXSwgW3RhYmluZGV4XTpub3QoW3RhYmluZGV4PVwiLTFcIl0pJyApXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIGEgcmVnaXN0ZXJlZCBjb25maXJtYXRpb24gZGlhbG9nIGFuZCB0cmFuc2ZlciBmb2N1cyBpbnNpZGUgaXQuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb24gRGlhbG9nIGFjdGlvbiBpZGVudGlmaWVyLlxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSB0cmlnZ2VyIENvbnRyb2wgdGhhdCBvcGVuZWQgdGhlIGRpYWxvZy5cblx0ICogQHJldHVybiB7Ym9vbGVhbn0gV2hldGhlciB0aGUgcmVxdWVzdGVkIGRpYWxvZyB3YXMgb3BlbmVkLlxuXHQgKi9cblx0ZnVuY3Rpb24gb3BlbkRpYWxvZyggYWN0aW9uLCB0cmlnZ2VyICkge1xuXHRcdHZhciBiYWNrZHJvcCA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWRpYWxvZz1cIicgKyBhY3Rpb24gKyAnXCJdJyApO1xuXG5cdFx0aWYgKCAhIGJhY2tkcm9wICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGRpYWxvZ1RyaWdnZXIgPSB0cmlnZ2VyO1xuXHRcdGFjdGl2ZURpYWxvZyA9IGJhY2tkcm9wO1xuXHRcdGJhY2tkcm9wLmhpZGRlbiA9IGZhbHNlO1xuXHRcdGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCggJ3dwYmNfc2V0dXBfd2l6YXJkX2RpYWxvZ19vcGVuJyApO1xuXG5cdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdHZhciBjYW5jZWxCdXR0b24gPSBiYWNrZHJvcC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtZGlhbG9nLWNhbmNlbF0nICk7XG5cdFx0XHRpZiAoIGNhbmNlbEJ1dHRvbiApIHtcblx0XHRcdFx0Y2FuY2VsQnV0dG9uLmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSwgMCApO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogQ2xvc2UgdGhlIGFjdGl2ZSBkaWFsb2csIGFubm91bmNlIGl0cyBvdXRjb21lLCBhbmQgcmVzdG9yZSB0cmlnZ2VyIGZvY3VzLlxuXHQgKlxuXHQgKiBUaGUgbGlmZWN5Y2xlIGV2ZW50IGxldHMgYSBkb21haW4gYWRhcHRlciBjb21taXQgb3Igcm9sbCBiYWNrIHByb3Zpc2lvbmFsXG5cdCAqIGJyb3dzZXIgc3RhdGUgd2l0aG91dCBhZGRpbmcgZG9tYWluIGJyYW5jaGVzIHRvIHRoZSBzaGFyZWQgc2hlbGwuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBvdXRjb21lIEVpdGhlciBjb25maXJtIG9yIGNhbmNlbC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIGNsb3NlRGlhbG9nKCBvdXRjb21lICkge1xuXHRcdHZhciBjbG9zZWRfZGlhbG9nO1xuXHRcdHZhciBjbG9zZWRfYWN0aW9uO1xuXHRcdHZhciBjbG9zZWRfdHJpZ2dlcjtcblxuXHRcdGlmICggISBhY3RpdmVEaWFsb2cgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y2xvc2VkX2RpYWxvZyA9IGFjdGl2ZURpYWxvZztcblx0XHRjbG9zZWRfYWN0aW9uID0gU3RyaW5nKCBjbG9zZWRfZGlhbG9nLmRhdGFzZXQud3BiY1NldHVwV2l6YXJkRGlhbG9nIHx8ICcnICk7XG5cdFx0Y2xvc2VkX3RyaWdnZXIgPSBkaWFsb2dUcmlnZ2VyO1xuXHRcdGNsb3NlZF9kaWFsb2cuaGlkZGVuID0gdHJ1ZTtcblx0XHRhY3RpdmVEaWFsb2cgPSBudWxsO1xuXHRcdGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfc2V0dXBfd2l6YXJkX2RpYWxvZ19vcGVuJyApO1xuXG5cdFx0aWYgKCBjbG9zZWRfdHJpZ2dlciApIHtcblx0XHRcdGNsb3NlZF90cmlnZ2VyLmZvY3VzKCk7XG5cdFx0fVxuXHRcdGRpYWxvZ1RyaWdnZXIgPSBudWxsO1xuXG5cdFx0cm9vdC5kaXNwYXRjaEV2ZW50KCBuZXcgd2luZG93LkN1c3RvbUV2ZW50KCAnd3BiYzpzZXR1cC13aXphcmQtZGlhbG9nLWNsb3NlZCcsIHtcblx0XHRcdGRldGFpbDoge1xuXHRcdFx0XHRhY3Rpb246IGNsb3NlZF9hY3Rpb24sXG5cdFx0XHRcdG91dGNvbWU6ICdjb25maXJtJyA9PT0gb3V0Y29tZSA/ICdjb25maXJtJyA6ICdjYW5jZWwnLFxuXHRcdFx0XHR0cmlnZ2VyOiBjbG9zZWRfdHJpZ2dlclxuXHRcdFx0fVxuXHRcdH0gKSApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN5bmNocm9uaXplIHZpc3VhbCBzZWxlY3Rpb24gc3RhdGUgd2l0aCBuYXRpdmUgcmFkaW8gY29udHJvbHMuXG5cdCAqXG5cdCAqIE5hdGl2ZSByYWRpbyBiZWhhdmlvciBzdXBwbGllcyBUYWIsIFNwYWNlLCBhbmQgYXJyb3cta2V5IG9wZXJhdGlvbi4gVGhlXG5cdCAqIGNhcmQgc3R5bGluZyBpcyBwcmVzZW50YXRpb24gb25seSBhbmQgZG9lcyBub3QgZGV0ZXJtaW5lIGF1dGhvcml6YXRpb24uXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiB1cGRhdGVFeHBlcmllbmNlQ2FyZHMoKSB7XG5cdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfc2V0dXBfd2l6YXJkX19leHBlcmllbmNlLWNhcmQnICkuZm9yRWFjaCggZnVuY3Rpb24gKCBjYXJkICkge1xuXHRcdFx0dmFyIHJhZGlvQ29udHJvbCA9IGNhcmQucXVlcnlTZWxlY3RvciggJ2lucHV0W3R5cGU9XCJyYWRpb1wiXScgKTtcblx0XHRcdHZhciBzZWxlY3RlZEJhZGdlID0gY2FyZC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfc2V0dXBfd2l6YXJkX19zZWxlY3RlZC1iYWRnZScgKTtcblx0XHRcdHZhciBpc1NlbGVjdGVkID0gcmFkaW9Db250cm9sICYmIHJhZGlvQ29udHJvbC5jaGVja2VkO1xuXG5cdFx0XHRjYXJkLmNsYXNzTGlzdC50b2dnbGUoICdpcy1zZWxlY3RlZCcsIEJvb2xlYW4oIGlzU2VsZWN0ZWQgKSApO1xuXHRcdFx0aWYgKCBzZWxlY3RlZEJhZGdlICkge1xuXHRcdFx0XHRzZWxlY3RlZEJhZGdlLmhpZGRlbiA9ICEgaXNTZWxlY3RlZDtcblx0XHRcdH1cblx0XHR9ICk7XG5cdH1cblxuXHQvKipcblx0ICogSGlkZSB0aGUgU3RlcCA0IEJvb2tpbmcgTW9kZSBsZWFybmluZyB0b29sdGlwIGFuZCBjYW5jZWwgcGVuZGluZyB0aW1lcnMuXG5cdCAqXG5cdCAqIEByZXR1cm4ge3ZvaWR9XG5cdCAqL1xuXHRmdW5jdGlvbiBoaWRlX21vZGVfdG9vbGJhcl90b29sdGlwKCkge1xuXHRcdHZhciB0b29sYmFyID0gcm9vdC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtbW9kZS10b29sYmFyXScgKTtcblx0XHR2YXIgdG9vbHRpcCA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLW1vZGUtdG9vbGJhci10b29sdGlwXScgKTtcblxuXHRcdHdpbmRvdy5jbGVhclRpbWVvdXQoIG1vZGVfdG9vbGJhcl9zaG93X3RpbWVyICk7XG5cdFx0d2luZG93LmNsZWFyVGltZW91dCggbW9kZV90b29sYmFyX2hpZGVfdGltZXIgKTtcblx0XHRtb2RlX3Rvb2xiYXJfc2hvd190aW1lciA9IG51bGw7XG5cdFx0bW9kZV90b29sYmFyX2hpZGVfdGltZXIgPSBudWxsO1xuXG5cdFx0aWYgKCB0b29sYmFyICkge1xuXHRcdFx0dG9vbGJhci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtcHJldmlld2luZycgKTtcblx0XHR9XG5cblx0XHRpZiAoIHRvb2x0aXAgKSB7XG5cdFx0XHR0b29sdGlwLmNsYXNzTGlzdC5yZW1vdmUoICdpcy12aXNpYmxlJyApO1xuXHRcdFx0dG9vbHRpcC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTeW5jaHJvbml6ZSB0aGUgcHJldmlldy1vbmx5IHRvb2xiYXIgc2VsZWN0b3Igd2l0aCB0aGUgU3RlcCA0IHJhZGlvIGRyYWZ0LlxuXHQgKlxuXHQgKiBUaGUgcHJldmlldyBkZWxpYmVyYXRlbHkgYXZvaWRzIHRoZSByZWxlYXNlZCBgLndwYmNfYm9va2luZ19tb2RlX29wdGlvbmBcblx0ICogaG9vayBiZWNhdXNlIHRoYXQgY29udHJvbCBwZXJmb3JtcyB0aGUgY2Fub25pY2FsIEJvb2tpbmcgTW9kZSBtdXRhdGlvbi5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9ICBtb2RlX2lkICAgICAgICBWYWxpZGF0ZWQgbW9kZSBpZGVudGlmaWVyIGZyb20gYSByYWRpby5cblx0ICogQHBhcmFtIHtib29sZWFufSBzaG91bGRfYW5pbWF0ZSBXaGV0aGVyIHRvIHRlYWNoIHRoZSB0b29sYmFyIGxvY2F0aW9uLlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gdXBkYXRlX21vZGVfdG9vbGJhcl9wcmV2aWV3KCBtb2RlX2lkLCBzaG91bGRfYW5pbWF0ZSApIHtcblx0XHR2YXIgdG9vbGJhciA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLW1vZGUtdG9vbGJhcl0nICk7XG5cdFx0dmFyIHRvb2xiYXJfbGFiZWw7XG5cdFx0dmFyIHRvb2x0aXA7XG5cdFx0dmFyIHNlbGVjdGVkX29wdGlvbiA9IG51bGw7XG5cdFx0dmFyIHJlZHVjZV9tb3Rpb247XG5cblx0XHRpZiAoICEgdG9vbGJhciApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0b29sYmFyX2xhYmVsID0gdG9vbGJhci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtbW9kZS10b29sYmFyLWxhYmVsXScgKTtcblx0XHR0b29sdGlwID0gdG9vbGJhci5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtbW9kZS10b29sYmFyLXRvb2x0aXBdJyApO1xuXHRcdHRvb2xiYXIucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLW1vZGUtdG9vbGJhci1vcHRpb25dJyApLmZvckVhY2goIGZ1bmN0aW9uICggb3B0aW9uICkge1xuXHRcdFx0dmFyIGlzX3NlbGVjdGVkID0gb3B0aW9uLmRhdGFzZXQud3BiY1NldHVwV2l6YXJkTW9kZVRvb2xiYXJPcHRpb24gPT09IG1vZGVfaWQ7XG5cblx0XHRcdG9wdGlvbi5jbGFzc0xpc3QudG9nZ2xlKCAnaXMtY3VycmVudCcsIGlzX3NlbGVjdGVkICk7XG5cdFx0XHRvcHRpb24uc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgaXNfc2VsZWN0ZWQgPyAndHJ1ZScgOiAnZmFsc2UnICk7XG5cdFx0XHRpZiAoIGlzX3NlbGVjdGVkICkge1xuXHRcdFx0XHRzZWxlY3RlZF9vcHRpb24gPSBvcHRpb247XG5cdFx0XHR9XG5cdFx0fSApO1xuXG5cdFx0aWYgKCAhIHNlbGVjdGVkX29wdGlvbiB8fCAhIHRvb2xiYXJfbGFiZWwgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dG9vbGJhcl9sYWJlbC50ZXh0Q29udGVudCA9IHNlbGVjdGVkX29wdGlvbi5kYXRhc2V0LndwYmNTZXR1cFdpemFyZE1vZGVUb29sYmFyVGl0bGUgfHwgc2VsZWN0ZWRfb3B0aW9uLnRleHRDb250ZW50LnRyaW0oKTtcblx0XHRpZiAoICEgc2hvdWxkX2FuaW1hdGUgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aGlkZV9tb2RlX3Rvb2xiYXJfdG9vbHRpcCgpO1xuXHRcdHRvb2xiYXIuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXByZXZpZXdpbmcnICk7XG5cdFx0dm9pZCB0b29sYmFyLm9mZnNldFdpZHRoO1xuXHRcdHRvb2xiYXIuY2xhc3NMaXN0LmFkZCggJ2lzLXByZXZpZXdpbmcnICk7XG5cblx0XHRyZWR1Y2VfbW90aW9uID0gd2luZG93Lm1hdGNoTWVkaWEgJiYgd2luZG93Lm1hdGNoTWVkaWEoICcocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjogcmVkdWNlKScgKS5tYXRjaGVzO1xuXHRcdG1vZGVfdG9vbGJhcl9zaG93X3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcblx0XHRcdHRvb2xiYXIuY2xhc3NMaXN0LnJlbW92ZSggJ2lzLXByZXZpZXdpbmcnICk7XG5cdFx0XHRpZiAoICEgdG9vbHRpcCApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0b29sdGlwLmNsYXNzTGlzdC5hZGQoICdpcy12aXNpYmxlJyApO1xuXHRcdFx0dG9vbHRpcC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0XHRcdHNldFN0YXR1cyggdG9vbHRpcC50ZXh0Q29udGVudC50cmltKCkgKTtcblx0XHRcdG1vZGVfdG9vbGJhcl9oaWRlX3RpbWVyID0gd2luZG93LnNldFRpbWVvdXQoIGhpZGVfbW9kZV90b29sYmFyX3Rvb2x0aXAsIDY1MDAgKTtcblx0XHR9LCByZWR1Y2VfbW90aW9uID8gMCA6IDE5MDAgKTtcblx0fVxuXG5cdHJvb3QuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgcHJldmVudF9pbnRlcmFjdGlvbl93aGlsZV9idXN5LCB0cnVlICk7XG5cblx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdHZhciBkaXJlY3Rpb25CdXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWRpcmVjdGlvbl0nICk7XG5cdFx0dmFyIGVkaXRfc3RlcF9idXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWVkaXQtc3RlcF0nICk7XG5cdFx0dmFyIGRpYWxvZ0J1dHRvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtb3Blbi1kaWFsb2ddJyApO1xuXHRcdHZhciBjYW5jZWxCdXR0b24gPSBldmVudC50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWRpYWxvZy1jYW5jZWxdJyApO1xuXHRcdHZhciBjb25maXJtQnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1jb25maXJtXScgKTtcblx0XHR2YXIgbW9kZV90b29sYmFyX29wdGlvbiA9IGV2ZW50LnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1zZXR1cC13aXphcmQtbW9kZS10b29sYmFyLW9wdGlvbl0nICk7XG5cdFx0dmFyIGRpc21pc3NfZXJyb3JfYnV0dG9uID0gZXZlbnQudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1kaXNtaXNzLWVycm9yXScgKTtcblx0XHR2YXIgbW9kZV9yYWRpbyA9IG51bGw7XG5cdFx0dmFyIGRpcmVjdGlvbjtcblx0XHR2YXIgYWN0aW9uO1xuXHRcdHZhciBzdWJtaXR0ZWRfZmllbGRzO1xuXG5cdFx0aWYgKCBkaXNtaXNzX2Vycm9yX2J1dHRvbiApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRjbGVhcl9yZXF1ZXN0X2Vycm9yKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBlZGl0X3N0ZXBfYnV0dG9uICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHNlbmRSZXF1ZXN0KCBjb25maWcuYWN0aW9uX2VkaXQsIHtcblx0XHRcdFx0dGFyZ2V0X3N0ZXA6IGVkaXRfc3RlcF9idXR0b24uZGF0YXNldC53cGJjU2V0dXBXaXphcmRFZGl0U3RlcFxuXHRcdFx0fSApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggbW9kZV90b29sYmFyX29wdGlvbiApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoICdpbnB1dFtuYW1lPVwiYm9va2luZ19leHBlcmllbmNlXCJdJyApLmZvckVhY2goIGZ1bmN0aW9uICggcmFkaW9fY29udHJvbCApIHtcblx0XHRcdFx0aWYgKCByYWRpb19jb250cm9sLnZhbHVlID09PSBtb2RlX3Rvb2xiYXJfb3B0aW9uLmRhdGFzZXQud3BiY1NldHVwV2l6YXJkTW9kZVRvb2xiYXJPcHRpb24gKSB7XG5cdFx0XHRcdFx0bW9kZV9yYWRpbyA9IHJhZGlvX2NvbnRyb2w7XG5cdFx0XHRcdH1cblx0XHRcdH0gKTtcblxuXHRcdFx0aWYgKCBtb2RlX3JhZGlvICYmICEgbW9kZV9yYWRpby5jaGVja2VkICkge1xuXHRcdFx0XHQkKCBtb2RlX3JhZGlvICkucHJvcCggJ2NoZWNrZWQnLCB0cnVlICkudHJpZ2dlciggJ2NoYW5nZScgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIGRpcmVjdGlvbkJ1dHRvbiApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRkaXJlY3Rpb24gPSBkaXJlY3Rpb25CdXR0b24uZGF0YXNldC53cGJjU2V0dXBXaXphcmREaXJlY3Rpb247XG5cdFx0XHRpZiAoICdiYWNrJyA9PT0gZGlyZWN0aW9uICkge1xuXHRcdFx0XHRjbGVhckZpZWxkRXJyb3JzKCk7XG5cdFx0XHRcdHNlbmRSZXF1ZXN0KCBjb25maWcuYWN0aW9uX2JhY2ssIHt9ICk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCAnbmV4dCcgIT09IGRpcmVjdGlvbiB8fCAhIHZhbGlkYXRlQ3VycmVudFN0ZXAoKSApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y2xlYXJGaWVsZEVycm9ycygpO1xuXHRcdFx0c3VibWl0dGVkX2ZpZWxkcyA9IGNvbGxlY3RGaWVsZHMoKTtcblx0XHRcdHNlbmRSZXF1ZXN0KCBjb25maWcuYWN0aW9uX3NhdmVfY29udGludWUsIHtcblx0XHRcdFx0ZmllbGRzOiBzdWJtaXR0ZWRfZmllbGRzLFxuXHRcdFx0XHRvcGVyYXRpb25faWQ6IGdldF9zYXZlX29wZXJhdGlvbl9pZCggc3VibWl0dGVkX2ZpZWxkcyApXG5cdFx0XHR9ICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBkaWFsb2dCdXR0b24gKSB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0b3BlbkRpYWxvZyggZGlhbG9nQnV0dG9uLmRhdGFzZXQud3BiY1NldHVwV2l6YXJkT3BlbkRpYWxvZywgZGlhbG9nQnV0dG9uICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBjYW5jZWxCdXR0b24gKSB7XG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0Y2xvc2VEaWFsb2coICdjYW5jZWwnICk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCBjb25maXJtQnV0dG9uICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGFjdGlvbiA9IGNvbmZpcm1CdXR0b24uZGF0YXNldC53cGJjU2V0dXBXaXphcmRDb25maXJtO1xuXHRcdFx0Y2xvc2VEaWFsb2coICdjb25maXJtJyApO1xuXHRcdFx0aWYgKCAncmVzdGFydCcgPT09IGFjdGlvbiB8fCAnc2tpcCcgPT09IGFjdGlvbiApIHtcblx0XHRcdFx0c2VuZFJlcXVlc3QoICdyZXN0YXJ0JyA9PT0gYWN0aW9uID8gY29uZmlnLmFjdGlvbl9yZXN0YXJ0IDogY29uZmlnLmFjdGlvbl9za2lwLCB7XG5cdFx0XHRcdFx0Y29uZmlybWF0aW9uOiBhY3Rpb25cblx0XHRcdFx0fSApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggYWN0aXZlRGlhbG9nICYmIGV2ZW50LnRhcmdldCA9PT0gYWN0aXZlRGlhbG9nICkge1xuXHRcdFx0Y2xvc2VEaWFsb2coICdjYW5jZWwnICk7XG5cdFx0fVxuXHR9ICk7XG5cblx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnc3VibWl0JywgZnVuY3Rpb24gKCBldmVudCApIHtcblx0XHR2YXIgY29udGludWVCdXR0b247XG5cblx0XHRpZiAoICd3cGJjLXNldHVwLXdpemFyZC1zdGVwLWZvcm0nICE9PSBldmVudC50YXJnZXQuaWQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRjb250aW51ZUJ1dHRvbiA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWRpcmVjdGlvbj1cIm5leHRcIl0nICk7XG5cdFx0aWYgKCBjb250aW51ZUJ1dHRvbiAmJiAhIGNvbnRpbnVlQnV0dG9uLmRpc2FibGVkICkge1xuXHRcdFx0Y29udGludWVCdXR0b24uY2xpY2soKTtcblx0XHR9XG5cdH0gKTtcblxuXHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xuXHRcdGlmICggZXZlbnQudGFyZ2V0Lm1hdGNoZXMoICdbZGF0YS13cGJjLXNldHVwLXdpemFyZC1maWVsZF0nICkgKSB7XG5cdFx0XHRjbGVhckZpZWxkRXJyb3IoIGV2ZW50LnRhcmdldC5uYW1lICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ2lucHV0W25hbWU9XCJib29raW5nX2V4cGVyaWVuY2VcIl0nICkgKSB7XG5cdFx0XHR1cGRhdGVFeHBlcmllbmNlQ2FyZHMoKTtcblx0XHRcdHVwZGF0ZV9tb2RlX3Rvb2xiYXJfcHJldmlldyggZXZlbnQudGFyZ2V0LnZhbHVlLCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ2lucHV0W25hbWU9XCJjdXN0b21lcl9qb3VybmV5XCJdJyApICkge1xuXHRcdFx0dXBkYXRlRXhwZXJpZW5jZUNhcmRzKCk7XG5cdFx0fVxuXG5cdH0gKTtcblxuXHRyb290LmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0aWYgKCBldmVudC50YXJnZXQubWF0Y2hlcyggJ1tkYXRhLXdwYmMtc2V0dXAtd2l6YXJkLWZpZWxkXScgKSApIHtcblx0XHRcdGNsZWFyRmllbGRFcnJvciggZXZlbnQudGFyZ2V0Lm5hbWUgKTtcblx0XHR9XG5cdH0gKTtcblxuXHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XG5cdFx0dmFyIGRpYWxvZztcblx0XHR2YXIgZm9jdXNhYmxlO1xuXHRcdHZhciBmaXJzdDtcblx0XHR2YXIgbGFzdDtcblxuXHRcdGlmICggISBhY3RpdmVEaWFsb2cgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAnRXNjYXBlJyA9PT0gZXZlbnQua2V5ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGNsb3NlRGlhbG9nKCAnY2FuY2VsJyApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICggJ1RhYicgIT09IGV2ZW50LmtleSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRkaWFsb2cgPSBhY3RpdmVEaWFsb2cucXVlcnlTZWxlY3RvciggJ1tyb2xlPVwiZGlhbG9nXCJdJyApO1xuXHRcdGZvY3VzYWJsZSA9IGdldEZvY3VzYWJsZUVsZW1lbnRzKCBkaWFsb2cgKTtcblx0XHRpZiAoICEgZm9jdXNhYmxlLmxlbmd0aCApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRkaWFsb2cuZm9jdXMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmaXJzdCA9IGZvY3VzYWJsZVsgMCBdO1xuXHRcdGxhc3QgPSBmb2N1c2FibGVbIGZvY3VzYWJsZS5sZW5ndGggLSAxIF07XG5cdFx0aWYgKCBldmVudC5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBmaXJzdCApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRsYXN0LmZvY3VzKCk7XG5cdFx0fSBlbHNlIGlmICggISBldmVudC5zaGlmdEtleSAmJiBkb2N1bWVudC5hY3RpdmVFbGVtZW50ID09PSBsYXN0ICkge1xuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdGZpcnN0LmZvY3VzKCk7XG5cdFx0fVxuXHR9ICk7XG5cblx0LyoqXG5cdCAqIFJlc3RvcmUgdHJhbnNpZW50IHJlcXVlc3Qgc3RhdGUgd2hlbiB0aGUgYnJvd3NlciByZXZpdmVzIHRoaXMgZG9jdW1lbnQuXG5cdCAqXG5cdCAqIEEgcGFnZSByZXN0b3JlZCBmcm9tIHRoZSBiYWNrLWZvcndhcmQgY2FjaGUgbXVzdCBub3QgcmV0YWluIHRoZSBkaXNhYmxlZFxuXHQgKiBjb250cm9scyBvciB0cmFuc2l0aW9uIG92ZXJsYXkgZnJvbSBhIG5hdmlnYXRpb24gdGhhdCBhbHJlYWR5IGNvbXBsZXRlZC5cblx0ICpcblx0ICogQHBhcmFtIHtQYWdlVHJhbnNpdGlvbkV2ZW50fSBldmVudCBCcm93c2VyIHBhZ2Utc2hvdyBldmVudC5cblx0ICogQHJldHVybiB7dm9pZH1cblx0ICovXG5cdGZ1bmN0aW9uIHJlc3RvcmVfdHJhbnNpZW50X3JlcXVlc3Rfc3RhdGUoIGV2ZW50ICkge1xuXHRcdGlmICggISBldmVudC5wZXJzaXN0ZWQgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmVxdWVzdFNlcXVlbmNlICs9IDE7XG5cdFx0aWYgKCBhY3RpdmVSZXF1ZXN0ICkge1xuXHRcdFx0YWN0aXZlUmVxdWVzdC5hYm9ydCgpO1xuXHRcdFx0YWN0aXZlUmVxdWVzdCA9IG51bGw7XG5cdFx0fVxuXG5cdFx0c2V0X3JlcXVlc3RfcGhhc2UoIHJlcXVlc3RfcGhhc2VzLklETEUgKTtcblx0XHRzZXRTdGF0dXMoICcnICk7XG5cdH1cblxuXHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3BhZ2VzaG93JywgcmVzdG9yZV90cmFuc2llbnRfcmVxdWVzdF9zdGF0ZSApO1xuXG5cdHVwZGF0ZUV4cGVyaWVuY2VDYXJkcygpO1xuXHRpZiAoIHJvb3QucXVlcnlTZWxlY3RvciggJ2lucHV0W25hbWU9XCJib29raW5nX2V4cGVyaWVuY2VcIl06Y2hlY2tlZCcgKSApIHtcblx0XHR1cGRhdGVfbW9kZV90b29sYmFyX3ByZXZpZXcoIHJvb3QucXVlcnlTZWxlY3RvciggJ2lucHV0W25hbWU9XCJib29raW5nX2V4cGVyaWVuY2VcIl06Y2hlY2tlZCcgKS52YWx1ZSwgZmFsc2UgKTtcblx0fVxuXHRzY2hlZHVsZV9icm93c2VyX3JlYWR5KCk7XG59KCBqUXVlcnksIHdpbmRvdywgZG9jdW1lbnQgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLENBQUMsRUFBRUMsTUFBTSxFQUFFQyxRQUFRLEVBQUc7RUFDbEMsWUFBWTs7RUFFWixJQUFJQyxNQUFNLEdBQUdGLE1BQU0sQ0FBQ0csaUJBQWlCO0VBQ3JDLElBQUlDLElBQUksR0FBR0gsUUFBUSxDQUFDSSxhQUFhLENBQUUsMEJBQTJCLENBQUM7RUFDL0QsSUFBSUMsVUFBVTtFQUNkLElBQUlDLHVCQUF1QjtFQUMzQixJQUFJQyxrQkFBa0I7RUFDdEIsSUFBSUMsMEJBQTBCO0VBQzlCLElBQUlDLDRCQUE0QjtFQUNoQyxJQUFJQyw2QkFBNkI7RUFDakMsSUFBSUMsWUFBWSxHQUFHLElBQUk7RUFDdkIsSUFBSUMsYUFBYSxHQUFHLElBQUk7RUFDeEIsSUFBSUMsYUFBYSxHQUFHLElBQUk7RUFDeEIsSUFBSUMsZUFBZSxHQUFHLENBQUM7RUFDdkIsSUFBSUMsdUJBQXVCLEdBQUcsSUFBSTtFQUNsQyxJQUFJQyx1QkFBdUIsR0FBRyxJQUFJO0VBQ2xDLElBQUlDLG9CQUFvQixHQUFHLElBQUk7RUFDL0IsSUFBSUMsY0FBYyxHQUFHO0lBQ3BCQyxJQUFJLEVBQUUsTUFBTTtJQUNaQyxVQUFVLEVBQUUsWUFBWTtJQUN4QkMsV0FBVyxFQUFFO0VBQ2QsQ0FBQztFQUNELElBQUlDLGFBQWEsR0FBR0osY0FBYyxDQUFDQyxJQUFJO0VBQ3ZDLElBQUlJLGFBQWEs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
