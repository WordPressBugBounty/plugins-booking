/* global jQuery, wpbc_settings_messages_page */
(function ($, w) {
	'use strict';

	var config = w.wpbc_settings_messages_page || {};

	function trimText(value) {
		return String(value || '').trim();
	}

	function showMessage(message, type, delay) {
		if (typeof w.wpbc_admin_show_message === 'function') {
			w.wpbc_admin_show_message(message, type || 'info', delay || 4000, false);
		}
	}

	$(function () {
		var $form = $('#wpbc_settings_messages_form');

		function switchRightPanel($tab) {
			var panelId = $tab.attr('aria-controls');
			var panel = panelId ? document.getElementById(panelId) : null;
			var $tabs = $tab.closest('.wpbc_messages_rightbar_tabs').find('[role="tab"]');
			var $panels = $('.wpbc_messages_rightbar_panels [role="tabpanel"]');

			if (!panel) {
				return;
			}
			$tabs.attr('aria-selected', 'false');
			$tab.attr('aria-selected', 'true');
			$panels.attr('hidden', 'hidden').attr('aria-hidden', 'true');
			$(panel).removeAttr('hidden').attr('aria-hidden', 'false');
		}

		function applyDefaultsToForm() {
			$form.find('textarea[data-default-message]').each(function () {
				var $textarea = $(this);
				$textarea.val($textarea.attr('data-default-message') || '');
			});
			$form.find('.wpbc_message_enabled input[type="checkbox"]').prop('checked', true);
		}

		function saveSettings() {
			var $button = $('[data-wpbc-messages-save="1"]');
			var originalHtml = $button.data('wpbc-original-text');
			var isResetAll = '1' === $form.find('[data-wpbc-messages-reset-input="1"]').val();

			if ($button.hasClass('disabled')) {
				return;
			}
			if (!originalHtml) {
				originalHtml = $button.html();
				$button.data('wpbc-original-text', originalHtml);
			}

			$button.addClass('disabled').attr('aria-disabled', 'true');
			$button.find('.in-button-text').html('&nbsp;&nbsp;' + trimText(config.i18n && config.i18n.saving ? config.i18n.saving : 'Saving') + '...');

			$.ajax({
				url: config.ajax_url,
				method: 'POST',
				data: $form.serialize(),
				dataType: 'json'
			}).done(function (response) {
				if (response && response.success) {
					if (isResetAll) {
						applyDefaultsToForm();
					}
					showMessage(response.data && response.data.message ? response.data.message : (config.i18n && config.i18n.saved ? config.i18n.saved : 'Saved'), 'success', 3000);
					return;
				}
				showMessage(response && response.data && response.data.message ? response.data.message : (config.i18n && config.i18n.save_failed ? config.i18n.save_failed : 'Unable to save form messages.'), 'error', 10000);
			}).fail(function (xhr) {
				var message = xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message
					? xhr.responseJSON.data.message
					: (config.i18n && config.i18n.save_failed ? config.i18n.save_failed : 'Unable to save form messages.');
				showMessage(message, 'error', 10000);
			}).always(function () {
				$form.find('[data-wpbc-messages-reset-input="1"]').val('0');
				$button.removeClass('disabled').removeAttr('aria-disabled').html(originalHtml);
			});
		}

		$form.on('submit', function (event) {
			event.preventDefault();
			saveSettings();
		});

		$(document).on('click', '[data-wpbc-messages-save="1"]', function (event) {
			event.preventDefault();
			saveSettings();
		});

		$(document).on('click', '[data-reset-message="1"]', function () {
			var $row = $(this).closest('.wpbc_settings_message_row');
			var $textarea = $row.find('textarea');
			$textarea.val($textarea.attr('data-default-message') || '').trigger('focus');
			$row.find('.wpbc_message_enabled input[type="checkbox"]').prop('checked', true);
		});

		$(document).on('click', '.wpbc_messages_rightbar_tabs [role="tab"]', function (event) {
			event.preventDefault();
			switchRightPanel($(this));
		});

		$(document).on('click', '.wpbc_messages_section_nav a', function (event) {
			var targetId = String($(this).attr('href') || '').replace(/^#/, '');
			var target = targetId ? document.getElementById(targetId) : null;

			if (!target) {
				return;
			}
			event.preventDefault();
			$('html, body').stop(true).animate({scrollTop: $(target).offset().top - 24}, 250, function () {
				$(target).attr('tabindex', '-1').trigger('focus');
			});
		});

		$(document).on('click', '[data-wpbc-messages-reset-all="1"]', function () {
			if (!w.confirm(config.i18n && config.i18n.reset_confirm ? config.i18n.reset_confirm : 'Restore every form message to its plugin default?')) {
				return;
			}
			$form.find('[data-wpbc-messages-reset-input="1"]').val('1');
			saveSettings();
		});
	});
}(jQuery, window));
