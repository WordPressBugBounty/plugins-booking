"use strict";

/**
 * First-install Setup Wizard invitation adapter.
 *
 * @package Booking Calendar
 */
(function (window, document, $) {
  'use strict';

  var config = window.wpbc_setup_wizard_first_run_launcher_vars || {};
  var request = null;
  var previous_focus = null;
  var redirect_started = false;

  /**
   * Restore focus to the pre-dialog control or a stable Booking Listing control.
   *
   * @return {void}
   */
  function restore_focus() {
    var fallback_focus;
    if (previous_focus && document.body !== previous_focus && document.contains(previous_focus)) {
      previous_focus.focus();
      return;
    }
    fallback_focus = document.querySelector('#wpbc_booking_listing_add_booking_button, .wpbc_ui_el__top_nav a, #wpbody-content h1');
    if (fallback_focus && 'function' === typeof fallback_focus.focus) {
      fallback_focus.focus();
    }
  }

  /**
   * Persist one validated launcher choice once per request.
   *
   * @param {string} choice Choice identifier.
   * @return {jqXHR|null} Request, or null when configuration is incomplete.
   */
  function persist_choice(choice) {
    if (request) {
      return request;
    }
    if (!config.ajax_url || !config.action || !config.nonce) {
      return null;
    }
    request = $.post(config.ajax_url, {
      action: config.action,
      nonce: config.nonce,
      choice: choice
    });
    return request;
  }

  /**
   * Render and open the invitation when all runtime dependencies exist.
   *
   * @return {void}
   */
  function show_dialog() {
    var template;
    var $modal;
    var choice_started = false;
    var selected_choice = '';
    var request_finished = false;
    var request_saved = false;
    var modal_hidden = false;

    /**
     * Continue after both persistence and modal removal finish.
     *
     * @return {void}
     */
    function finish_dismissal() {
      if (!request_finished || !modal_hidden) {
        return;
      }
      if (request_saved && config.show_booking_pages_after_dismiss) {
        $(document).trigger('wpbc:setup-booking-pages-open', [{
          consume_prompt: true,
          return_focus: previous_focus
        }]);
        return;
      }
      restore_focus();
    }
    if (!config.setup_url || !window.wp || 'function' !== typeof window.wp.template || 'function' !== typeof $.fn.wpbc_my_modal || !document.getElementById('tmpl-wpbc-setup-wizard-first-run-popup')) {
      return;
    }
    previous_focus = document.activeElement;
    template = window.wp.template('wpbc-setup-wizard-first-run-popup');
    $(document.body).append(template({}));
    $modal = $('#wpbc_setup_wizard_first_run_popup');
    $modal.on('shown.wpbc.modal.wpbcSetupFirstRun', function () {
      $modal.attr('aria-hidden', 'false');
      $('.modal-backdrop').last().addClass('wpbc_setup_wizard_first_run_popup__backdrop');
      $modal.find('[data-wpbc-setup-first-run-start]').trigger('focus');
    });
    $modal.on('hide.wpbc.modal.wpbcSetupFirstRun', function () {
      var dismissal_request;
      if (choice_started) {
        return;
      }
      choice_started = true;
      selected_choice = 'dismiss';
      dismissal_request = persist_choice(selected_choice);
      if (!dismissal_request) {
        request_finished = true;
        return;
      }
      dismissal_request.done(function (response) {
        request_saved = !!(response && true === response.success);
      }).always(function () {
        request_finished = true;
        finish_dismissal();
      });
    });
    $modal.on('hidden.wpbc.modal.wpbcSetupFirstRun', function () {
      $modal.attr('aria-hidden', 'true').remove();
      modal_hidden = true;
      if ('dismiss' === selected_choice) {
        finish_dismissal();
      }
    });
    $modal.on('click.wpbcSetupFirstRun', '[data-wpbc-setup-first-run-dismiss]', function (event) {
      event.preventDefault();
      $modal.wpbc_my_modal('hide');
    });
    $modal.on('click.wpbcSetupFirstRun', '[data-wpbc-setup-first-run-start]', function (event) {
      var start_request;
      event.preventDefault();
      choice_started = true;
      selected_choice = 'start';
      start_request = persist_choice(selected_choice);
      if (start_request) {
        start_request.always(function () {
          if (!redirect_started) {
            redirect_started = true;
            window.location.assign(config.setup_url);
          }
        });
      } else if (!redirect_started) {
        redirect_started = true;
        window.location.assign(config.setup_url);
      }
      $modal.wpbc_my_modal('hide');
    });
    $modal.wpbc_my_modal({
      backdrop: 'static',
      keyboard: true,
      show: true
    });
  }
  $(function () {
    if (config.show) {
      show_dialog();
    }
  });
})(window, document, window.jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvZmlyc3QtcnVuLWxhdW5jaGVyL19vdXQvZmlyc3QtcnVuLWxhdW5jaGVyLmpzIiwibmFtZXMiOlsid2luZG93IiwiZG9jdW1lbnQiLCIkIiwiY29uZmlnIiwid3BiY19zZXR1cF93aXphcmRfZmlyc3RfcnVuX2xhdW5jaGVyX3ZhcnMiLCJyZXF1ZXN0IiwicHJldmlvdXNfZm9jdXMiLCJyZWRpcmVjdF9zdGFydGVkIiwicmVzdG9yZV9mb2N1cyIsImZhbGxiYWNrX2ZvY3VzIiwiYm9keSIsImNvbnRhaW5zIiwiZm9jdXMiLCJxdWVyeVNlbGVjdG9yIiwicGVyc2lzdF9jaG9pY2UiLCJjaG9pY2UiLCJhamF4X3VybCIsImFjdGlvbiIsIm5vbmNlIiwicG9zdCIsInNob3dfZGlhbG9nIiwidGVtcGxhdGUiLCIkbW9kYWwiLCJjaG9pY2Vfc3RhcnRlZCIsInNlbGVjdGVkX2Nob2ljZSIsInJlcXVlc3RfZmluaXNoZWQiLCJyZXF1ZXN0X3NhdmVkIiwibW9kYWxfaGlkZGVuIiwiZmluaXNoX2Rpc21pc3NhbCIsInNob3dfYm9va2luZ19wYWdlc19hZnRlcl9kaXNtaXNzIiwidHJpZ2dlciIsImNvbnN1bWVfcHJvbXB0IiwicmV0dXJuX2ZvY3VzIiwic2V0dXBfdXJsIiwid3AiLCJmbiIsIndwYmNfbXlfbW9kYWwiLCJnZXRFbGVtZW50QnlJZCIsImFjdGl2ZUVsZW1lbnQiLCJhcHBlbmQiLCJvbiIsImF0dHIiLCJsYXN0IiwiYWRkQ2xhc3MiLCJmaW5kIiwiZGlzbWlzc2FsX3JlcXVlc3QiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiYWx3YXlzIiwicmVtb3ZlIiwiZXZlbnQiLCJwcmV2ZW50RGVmYXVsdCIsInN0YXJ0X3JlcXVlc3QiLCJsb2NhdGlvbiIsImFzc2lnbiIsImJhY2tkcm9wIiwia2V5Ym9hcmQiLCJzaG93IiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1zZXR1cC13aXphcmQvZmlyc3QtcnVuLWxhdW5jaGVyL19zcmMvZmlyc3QtcnVuLWxhdW5jaGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRmlyc3QtaW5zdGFsbCBTZXR1cCBXaXphcmQgaW52aXRhdGlvbiBhZGFwdGVyLlxuICpcbiAqIEBwYWNrYWdlIEJvb2tpbmcgQ2FsZW5kYXJcbiAqL1xuKCBmdW5jdGlvbiggd2luZG93LCBkb2N1bWVudCwgJCApIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdHZhciBjb25maWcgPSB3aW5kb3cud3BiY19zZXR1cF93aXphcmRfZmlyc3RfcnVuX2xhdW5jaGVyX3ZhcnMgfHwge307XG5cdHZhciByZXF1ZXN0ID0gbnVsbDtcblx0dmFyIHByZXZpb3VzX2ZvY3VzID0gbnVsbDtcblx0dmFyIHJlZGlyZWN0X3N0YXJ0ZWQgPSBmYWxzZTtcblxuXHQvKipcblx0ICogUmVzdG9yZSBmb2N1cyB0byB0aGUgcHJlLWRpYWxvZyBjb250cm9sIG9yIGEgc3RhYmxlIEJvb2tpbmcgTGlzdGluZyBjb250cm9sLlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gcmVzdG9yZV9mb2N1cygpIHtcblx0XHR2YXIgZmFsbGJhY2tfZm9jdXM7XG5cblx0XHRpZiAoIHByZXZpb3VzX2ZvY3VzICYmIGRvY3VtZW50LmJvZHkgIT09IHByZXZpb3VzX2ZvY3VzICYmIGRvY3VtZW50LmNvbnRhaW5zKCBwcmV2aW91c19mb2N1cyApICkge1xuXHRcdFx0cHJldmlvdXNfZm9jdXMuZm9jdXMoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRmYWxsYmFja19mb2N1cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcjd3BiY19ib29raW5nX2xpc3RpbmdfYWRkX2Jvb2tpbmdfYnV0dG9uLCAud3BiY191aV9lbF9fdG9wX25hdiBhLCAjd3Bib2R5LWNvbnRlbnQgaDEnICk7XG5cdFx0aWYgKCBmYWxsYmFja19mb2N1cyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YgZmFsbGJhY2tfZm9jdXMuZm9jdXMgKSB7XG5cdFx0XHRmYWxsYmFja19mb2N1cy5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBQZXJzaXN0IG9uZSB2YWxpZGF0ZWQgbGF1bmNoZXIgY2hvaWNlIG9uY2UgcGVyIHJlcXVlc3QuXG5cdCAqXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBjaG9pY2UgQ2hvaWNlIGlkZW50aWZpZXIuXG5cdCAqIEByZXR1cm4ge2pxWEhSfG51bGx9IFJlcXVlc3QsIG9yIG51bGwgd2hlbiBjb25maWd1cmF0aW9uIGlzIGluY29tcGxldGUuXG5cdCAqL1xuXHRmdW5jdGlvbiBwZXJzaXN0X2Nob2ljZSggY2hvaWNlICkge1xuXHRcdGlmICggcmVxdWVzdCApIHtcblx0XHRcdHJldHVybiByZXF1ZXN0O1xuXHRcdH1cblx0XHRpZiAoICEgY29uZmlnLmFqYXhfdXJsIHx8ICEgY29uZmlnLmFjdGlvbiB8fCAhIGNvbmZpZy5ub25jZSApIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJlcXVlc3QgPSAkLnBvc3QoIGNvbmZpZy5hamF4X3VybCwge1xuXHRcdFx0YWN0aW9uOiBjb25maWcuYWN0aW9uLFxuXHRcdFx0bm9uY2U6IGNvbmZpZy5ub25jZSxcblx0XHRcdGNob2ljZTogY2hvaWNlXG5cdFx0fSApO1xuXG5cdFx0cmV0dXJuIHJlcXVlc3Q7XG5cdH1cblxuXHQvKipcblx0ICogUmVuZGVyIGFuZCBvcGVuIHRoZSBpbnZpdGF0aW9uIHdoZW4gYWxsIHJ1bnRpbWUgZGVwZW5kZW5jaWVzIGV4aXN0LlxuXHQgKlxuXHQgKiBAcmV0dXJuIHt2b2lkfVxuXHQgKi9cblx0ZnVuY3Rpb24gc2hvd19kaWFsb2coKSB7XG5cdFx0dmFyIHRlbXBsYXRlO1xuXHRcdHZhciAkbW9kYWw7XG5cdFx0dmFyIGNob2ljZV9zdGFydGVkID0gZmFsc2U7XG5cdFx0dmFyIHNlbGVjdGVkX2Nob2ljZSA9ICcnO1xuXHRcdHZhciByZXF1ZXN0X2ZpbmlzaGVkID0gZmFsc2U7XG5cdFx0dmFyIHJlcXVlc3Rfc2F2ZWQgPSBmYWxzZTtcblx0XHR2YXIgbW9kYWxfaGlkZGVuID0gZmFsc2U7XG5cblx0XHQvKipcblx0XHQgKiBDb250aW51ZSBhZnRlciBib3RoIHBlcnNpc3RlbmNlIGFuZCBtb2RhbCByZW1vdmFsIGZpbmlzaC5cblx0XHQgKlxuXHRcdCAqIEByZXR1cm4ge3ZvaWR9XG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZmluaXNoX2Rpc21pc3NhbCgpIHtcblx0XHRcdGlmICggISByZXF1ZXN0X2ZpbmlzaGVkIHx8ICEgbW9kYWxfaGlkZGVuICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICggcmVxdWVzdF9zYXZlZCAmJiBjb25maWcuc2hvd19ib29raW5nX3BhZ2VzX2FmdGVyX2Rpc21pc3MgKSB7XG5cdFx0XHRcdCQoIGRvY3VtZW50ICkudHJpZ2dlciggJ3dwYmM6c2V0dXAtYm9va2luZy1wYWdlcy1vcGVuJywgWyB7XG5cdFx0XHRcdFx0Y29uc3VtZV9wcm9tcHQ6IHRydWUsXG5cdFx0XHRcdFx0cmV0dXJuX2ZvY3VzOiBwcmV2aW91c19mb2N1c1xuXHRcdFx0XHR9IF0gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN0b3JlX2ZvY3VzKCk7XG5cdFx0fVxuXG5cdFx0aWYgKCAhIGNvbmZpZy5zZXR1cF91cmwgfHwgISB3aW5kb3cud3AgfHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cC50ZW1wbGF0ZSB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgJC5mbi53cGJjX215X21vZGFsIHx8ICEgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd0bXBsLXdwYmMtc2V0dXAtd2l6YXJkLWZpcnN0LXJ1bi1wb3B1cCcgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwcmV2aW91c19mb2N1cyA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0dGVtcGxhdGUgPSB3aW5kb3cud3AudGVtcGxhdGUoICd3cGJjLXNldHVwLXdpemFyZC1maXJzdC1ydW4tcG9wdXAnICk7XG5cdFx0JCggZG9jdW1lbnQuYm9keSApLmFwcGVuZCggdGVtcGxhdGUoIHt9ICkgKTtcblx0XHQkbW9kYWwgPSAkKCAnI3dwYmNfc2V0dXBfd2l6YXJkX2ZpcnN0X3J1bl9wb3B1cCcgKTtcblxuXHRcdCRtb2RhbC5vbiggJ3Nob3duLndwYmMubW9kYWwud3BiY1NldHVwRmlyc3RSdW4nLCBmdW5jdGlvbigpIHtcblx0XHRcdCRtb2RhbC5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XG5cdFx0XHQkKCAnLm1vZGFsLWJhY2tkcm9wJyApLmxhc3QoKS5hZGRDbGFzcyggJ3dwYmNfc2V0dXBfd2l6YXJkX2ZpcnN0X3J1bl9wb3B1cF9fYmFja2Ryb3AnICk7XG5cdFx0XHQkbW9kYWwuZmluZCggJ1tkYXRhLXdwYmMtc2V0dXAtZmlyc3QtcnVuLXN0YXJ0XScgKS50cmlnZ2VyKCAnZm9jdXMnICk7XG5cdFx0fSApO1xuXG5cdFx0JG1vZGFsLm9uKCAnaGlkZS53cGJjLm1vZGFsLndwYmNTZXR1cEZpcnN0UnVuJywgZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgZGlzbWlzc2FsX3JlcXVlc3Q7XG5cblx0XHRcdGlmICggY2hvaWNlX3N0YXJ0ZWQgKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNob2ljZV9zdGFydGVkID0gdHJ1ZTtcblx0XHRcdHNlbGVjdGVkX2Nob2ljZSA9ICdkaXNtaXNzJztcblx0XHRcdGRpc21pc3NhbF9yZXF1ZXN0ID0gcGVyc2lzdF9jaG9pY2UoIHNlbGVjdGVkX2Nob2ljZSApO1xuXHRcdFx0aWYgKCAhIGRpc21pc3NhbF9yZXF1ZXN0ICkge1xuXHRcdFx0XHRyZXF1ZXN0X2ZpbmlzaGVkID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZGlzbWlzc2FsX3JlcXVlc3QuZG9uZSggZnVuY3Rpb24oIHJlc3BvbnNlICkge1xuXHRcdFx0XHRyZXF1ZXN0X3NhdmVkID0gISEgKCByZXNwb25zZSAmJiB0cnVlID09PSByZXNwb25zZS5zdWNjZXNzICk7XG5cdFx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmVxdWVzdF9maW5pc2hlZCA9IHRydWU7XG5cdFx0XHRcdGZpbmlzaF9kaXNtaXNzYWwoKTtcblx0XHRcdH0gKTtcblx0XHR9ICk7XG5cblx0XHQkbW9kYWwub24oICdoaWRkZW4ud3BiYy5tb2RhbC53cGJjU2V0dXBGaXJzdFJ1bicsIGZ1bmN0aW9uKCkge1xuXHRcdFx0JG1vZGFsLmF0dHIoICdhcmlhLWhpZGRlbicsICd0cnVlJyApLnJlbW92ZSgpO1xuXHRcdFx0bW9kYWxfaGlkZGVuID0gdHJ1ZTtcblx0XHRcdGlmICggJ2Rpc21pc3MnID09PSBzZWxlY3RlZF9jaG9pY2UgKSB7XG5cdFx0XHRcdGZpbmlzaF9kaXNtaXNzYWwoKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cblx0XHQkbW9kYWwub24oICdjbGljay53cGJjU2V0dXBGaXJzdFJ1bicsICdbZGF0YS13cGJjLXNldHVwLWZpcnN0LXJ1bi1kaXNtaXNzXScsIGZ1bmN0aW9uKCBldmVudCApIHtcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHQkbW9kYWwud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XG5cdFx0fSApO1xuXG5cdFx0JG1vZGFsLm9uKCAnY2xpY2sud3BiY1NldHVwRmlyc3RSdW4nLCAnW2RhdGEtd3BiYy1zZXR1cC1maXJzdC1ydW4tc3RhcnRdJywgZnVuY3Rpb24oIGV2ZW50ICkge1xuXHRcdFx0dmFyIHN0YXJ0X3JlcXVlc3Q7XG5cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRjaG9pY2Vfc3RhcnRlZCA9IHRydWU7XG5cdFx0XHRzZWxlY3RlZF9jaG9pY2UgPSAnc3RhcnQnO1xuXHRcdFx0c3RhcnRfcmVxdWVzdCA9IHBlcnNpc3RfY2hvaWNlKCBzZWxlY3RlZF9jaG9pY2UgKTtcblx0XHRcdGlmICggc3RhcnRfcmVxdWVzdCApIHtcblx0XHRcdFx0c3RhcnRfcmVxdWVzdC5hbHdheXMoIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmICggISByZWRpcmVjdF9zdGFydGVkICkge1xuXHRcdFx0XHRcdFx0cmVkaXJlY3Rfc3RhcnRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24uYXNzaWduKCBjb25maWcuc2V0dXBfdXJsICk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9ICk7XG5cdFx0XHR9IGVsc2UgaWYgKCAhIHJlZGlyZWN0X3N0YXJ0ZWQgKSB7XG5cdFx0XHRcdHJlZGlyZWN0X3N0YXJ0ZWQgPSB0cnVlO1xuXHRcdFx0XHR3aW5kb3cubG9jYXRpb24uYXNzaWduKCBjb25maWcuc2V0dXBfdXJsICk7XG5cdFx0XHR9XG5cdFx0XHQkbW9kYWwud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XG5cdFx0fSApO1xuXG5cdFx0JG1vZGFsLndwYmNfbXlfbW9kYWwoIHsgYmFja2Ryb3A6ICdzdGF0aWMnLCBrZXlib2FyZDogdHJ1ZSwgc2hvdzogdHJ1ZSB9ICk7XG5cdH1cblxuXHQkKCBmdW5jdGlvbigpIHtcblx0XHRpZiAoIGNvbmZpZy5zaG93ICkge1xuXHRcdFx0c2hvd19kaWFsb2coKTtcblx0XHR9XG5cdH0gKTtcbn0oIHdpbmRvdywgZG9jdW1lbnQsIHdpbmRvdy5qUXVlcnkgKSApO1xuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDRSxXQUFVQSxNQUFNLEVBQUVDLFFBQVEsRUFBRUMsQ0FBQyxFQUFHO0VBQ2pDLFlBQVk7O0VBRVosSUFBSUMsTUFBTSxHQUFHSCxNQUFNLENBQUNJLHlDQUF5QyxJQUFJLENBQUMsQ0FBQztFQUNuRSxJQUFJQyxPQUFPLEdBQUcsSUFBSTtFQUNsQixJQUFJQyxjQUFjLEdBQUcsSUFBSTtFQUN6QixJQUFJQyxnQkFBZ0IsR0FBRyxLQUFLOztFQUU1QjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FB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
