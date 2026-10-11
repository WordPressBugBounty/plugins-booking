"use strict";

/**
 * Time Slots Availability UI.
 */
(function ($) {
  'use strict';

  var zoomSteps = [60, 30, 15, 10, 5];
  var currentMode = 'block';
  var selectionRanges = [];
  var activeSelectionId = '';
  var rowTemplates = [];
  var nextSelectionId = 1;
  var nextTooltipScopeId = 1;
  var activeLoadRequest = null;
  var activeLoadRequestId = 0;
  var activeSaveRequest = null;
  function pad_2(value) {
    return (value < 10 ? '0' : '') + value;
  }
  function trim_text(value) {
    return String(value || '').replace(/^\s+|\s+$/g, '');
  }
  function minutes_to_time(minutes) {
    var hours = Math.floor(minutes / 60);
    var mins = minutes % 60;
    return pad_2(hours) + ':' + pad_2(mins);
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function snap_minute(minute, step) {
    return Math.round(minute / step) * step;
  }
  function get_grid_config($grid) {
    return {
      start: parseInt($grid.attr('data-wpbc-ts-start'), 10) || 0,
      end: parseInt($grid.attr('data-wpbc-ts-end'), 10) || 1440,
      step: parseInt($grid.attr('data-wpbc-ts-step'), 10) || 15
    };
  }
  function get_control($page, name) {
    var $control = $page.find('[data-wpbc-ts-control="' + name + '"]').first();
    if (!$control.length) {
      $control = $page.find('#wpbc_ts_' + name).first();
    }
    return $control;
  }
  function percent_for_minute(minute, config) {
    return (minute - config.start) / (config.end - config.start) * 100;
  }
  function normalize_selection_range(start, end, config) {
    start = clamp(snap_minute(start, config.step), config.start, config.end);
    end = clamp(snap_minute(end, config.step), config.start, config.end);
    if (start === end) {
      end = clamp(start + config.step, config.start, config.end);
      if (start === end) {
        start = clamp(end - config.step, config.start, config.end);
      }
    }
    return {
      start: Math.min(start, end),
      end: Math.max(start, end)
    };
  }
  function get_selection_by_id(selectionId) {
    var found = null;
    $.each(selectionRanges, function (index, item) {
      if (item.id === selectionId) {
        found = item;
        return false;
      }
      return true;
    });
    return found;
  }
  function render_axis($grid) {
    var config = get_grid_config($grid);
    var $axis = $grid.find('.wpbc_ts_time_axis');
    var html = '';
    var minute;
    var slotCount = Math.max(1, (config.end - config.start) / config.step);
    var visibleHours = Math.max(1, (config.end - config.start) / 60);
    var axisFontSize = clamp(Math.round(16 - visibleHours * 0.25), 10, 13);
    var axisFontWeight = visibleHours <= 10 ? 550 : 400;
    var firstHour = Math.ceil(config.start / 60) * 60;
    $grid.css('--wpbc-ts-slot-count', String(slotCount));
    $grid.css('--wpbc-ts-axis-label-size', axisFontSize + 'px');
    $grid.css('--wpbc-ts-axis-label-weight', String(axisFontWeight));
    for (minute = firstHour; minute <= config.end; minute += 60) {
      html += '<span class="wpbc_ts_axis_label" style="left:' + percent_for_minute(minute, config) + '%;">' + minutes_to_time(minute) + '</span>';
      html += '<span class="wpbc_ts_axis_tick" style="left:' + percent_for_minute(minute, config) + '%;"></span>';
      if (minute + 30 < config.end) {
        html += '<span class="wpbc_ts_axis_dot" style="left:' + percent_for_minute(minute + 30, config) + '%;"></span>';
      }
    }
    for (minute = config.start + config.step; minute < config.end; minute += config.step) {
      if (0 === minute % 60 || 30 === minute % 60) {
        continue;
      }
      html += '<span class="wpbc_ts_axis_minor" style="left:' + percent_for_minute(minute, config) + '%;"></span>';
    }
    $axis.html(html);
    refresh_floating_header($grid.closest('.wpbc_ts_page'));
  }
  function position_bars($grid) {
    var config = get_grid_config($grid);
    $grid.find('.wpbc_ts_bar').each(function () {
      var $bar = $(this);
      var start = parseInt($bar.attr('data-wpbc-ts-start'), 10);
      var end = parseInt($bar.attr('data-wpbc-ts-end'), 10);
      var visibleStart = clamp(start, config.start, config.end);
      var visibleEnd = clamp(end, config.start, config.end);
      var left;
      var width;
      if (visibleEnd <= config.start || visibleStart >= config.end || visibleStart >= visibleEnd) {
        $bar.hide();
        return;
      }
      left = percent_for_minute(visibleStart, config);
      width = percent_for_minute(visibleEnd, config) - left;
      $bar.show().css({
        left: left + '%',
        width: width + '%'
      });
    });
  }
  function render_timeline_bars($page, bars) {
    var settings = window.wpbc_availability_timeslots_page || {};
    var labels = settings.i18n || {};
    $page.find('.wpbc_ts_bar[data-wpbc-ts-source="server"]').remove();
    $.each(bars || {}, function (date, resources) {
      var $row = $page.find('.wpbc_ts_row[data-wpbc-ts-date="' + date + '"]');
      if (!$row.length || !resources) {
        return;
      }
      $.each(resources, function (resourceId, resourceBars) {
        $.each(resourceBars || [], function (index, interval) {
          var type = 'blocked' === interval.type ? 'blocked' : 'unavailable_day' === interval.type ? 'unavailable_day' : 'working_time' === interval.type ? 'working_time' : 'booked';
          var icon = 'booked' === type ? 'wpbc_icn_lock' : 'unavailable_day' === type ? 'wpbc_icn_event_busy' : 'working_time' === type ? 'wpbc-bi-clock-history' : 'wpbc_icn_do_not_disturb_on';
          var tooltip = interval.tooltip || '';
          var $bar = $('<div class="wpbc_ts_bar" data-wpbc-ts-source="server"></div>');
          var $iconWrap;
          if ('booked' === type && interval.booking_url) {
            $iconWrap = $('<a class="wpbc_ts_booking_link tooltip_top" rel="noopener noreferrer"><span></span></a>');
            $iconWrap.attr('href', interval.booking_url).attr('data-wpbc-ts-booking-id', interval.booking_id || '').attr('aria-label', (labels.open_booking || 'Open booking in Booking Listing') + (interval.booking_id ? ': ' + interval.booking_id : '')).attr('data-original-title', tooltip || '');
          } else if (('unavailable_day' === type || 'working_time' === type) && interval.rule_url) {
            $iconWrap = $('<a class="wpbc_ts_rule_link tooltip_top"><span></span></a>');
            $iconWrap.attr('href', interval.rule_url).attr('data-wpbc-ts-rule-source', interval.rule_source || interval.source_type || '').attr('aria-label', (labels.open_availability_rule || 'Open availability settings') + (interval.status_title ? ': ' + interval.status_title : '')).attr('data-original-title', tooltip || '');
          } else {
            $iconWrap = $('<span class="wpbc_ts_bar_icon tooltip_top"><span></span></span>').attr('data-original-title', tooltip || '');
          }
          $bar.addClass('wpbc_ts_bar_' + type).attr('data-wpbc-ts-start', parseInt(interval.start_minute, 10)).attr('data-wpbc-ts-end', parseInt(interval.end_minute, 10)).attr('data-wpbc-ts-resource-id', resourceId).attr('data-wpbc-ts-booking-id', interval.booking_id || '').attr('data-wpbc-ts-booking-url', interval.booking_url || '').attr('data-wpbc-ts-rule-url', interval.rule_url || '').attr('data-wpbc-ts-unavailable-id', interval.unavailable_timeslot_id || '').attr('data-wpbc-ts-source-type', interval.source_type || '').attr('data-wpbc-ts-editable', false === interval.editable ? '0' : '1');
          if (tooltip) {
            $bar.attr('data-original-title', tooltip).addClass('tooltip_top');
          }
          $iconWrap.find('span').addClass(icon);
          $bar.append($iconWrap);
          $row.find('.wpbc_ts_lane').append($bar);
        });
      });
    });
    position_bars($page.find('.wpbc_ts_grid'));
    refresh_bar_tooltips($page);
  }
  function load_blocked_intervals($page) {
    var settings = window.wpbc_availability_timeslots_page || {};
    var $dateRange = get_control($page, 'date_range');
    var labels = settings.i18n || {};
    var requestId;
    if (!settings.ajax_url) {
      return;
    }
    if (activeLoadRequest && activeLoadRequest.readyState !== 4) {
      activeLoadRequest.abort();
    }
    requestId = ++activeLoadRequestId;
    set_timeline_loading($page, true, labels.loading || 'Loading');
    activeLoadRequest = $.post(settings.ajax_url, {
      action: 'WPBC_AJX_AVAILABILITY_TIMESLOTS_READ',
      nonce: settings.nonce,
      resource_id: get_control($page, 'resource').val(),
      date_start: $dateRange.attr('data-wpbc-ts-start'),
      date_end: $dateRange.attr('data-wpbc-ts-end')
    }).done(function (response) {
      if (requestId !== activeLoadRequestId) {
        return;
      }
      if (response && response.success && response.data) {
        render_timeline_bars($page, response.data.bars);
      }
    }).fail(function (xhr, textStatus) {
      if ('abort' !== textStatus && window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.save_error || 'Unable to save time-slot availability.', 'error', 5000);
      }
    }).always(function () {
      if (requestId === activeLoadRequestId) {
        set_timeline_loading($page, false);
      }
    });
  }
  function get_rows_between($page, startRow, endRow) {
    var startIndex = parseInt(startRow, 10);
    var endIndex = parseInt(endRow, 10);
    var min = Math.min(startIndex, endIndex);
    var max = Math.max(startIndex, endIndex);
    var rows = [];
    var i;
    for (i = min; i <= max; i++) {
      if ($page.find('.wpbc_ts_row[data-wpbc-ts-row="' + i + '"]').length) {
        rows.push(String(i));
      }
    }
    return rows;
  }
  function row_label($page, rowId) {
    return trim_text($page.find('.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"] .wpbc_ts_row_label_text').text());
  }
  function escape_html(value) {
    return $('<div />').text(value).html();
  }
  function position_loading_overlay($page) {
    var $card = $page.find('.wpbc_ts_timeline_card').first();
    var card = $card.get(0);
    var $overlay = $card.find('.wpbc_ts_loading_overlay').first();
    if (!card || !$overlay.length) {
      return;
    }
    $overlay.css({
      width: card.clientWidth + 'px',
      height: card.clientHeight + 'px',
      transform: 'translate(' + card.scrollLeft + 'px,' + card.scrollTop + 'px)'
    });
  }
  function set_timeline_loading($page, isLoading, label) {
    var $card = $page.find('.wpbc_ts_timeline_card');
    var $overlay;
    $card.toggleClass('is-loading', !!isLoading).find('.wpbc_ts_loading_overlay').attr('aria-hidden', isLoading ? 'false' : 'true');
    if (label) {
      $overlay = $page.find('.wpbc_ts_loading_overlay').first();
      $overlay.find('.wpbc_spins_loading_container > span').text(label + '...');
    }
    if (isLoading) {
      position_loading_overlay($page);
      $card.off('scroll.wpbc_ts_loading_overlay').on('scroll.wpbc_ts_loading_overlay', function () {
        position_loading_overlay($page);
      });
    } else {
      $card.off('scroll.wpbc_ts_loading_overlay');
      $page.find('.wpbc_ts_loading_overlay').css({
        width: '',
        height: '',
        transform: ''
      });
    }
  }
  function set_action_buttons_busy($page, isBusy) {
    var $scope = $page.add($page.closest('.modal')).add($('.wpbc_ts_rightbar_panels'));
    $scope.find('[data-wpbc-ts-command], .wpbc_ts_clear_selection').toggleClass('disabled', !!isBusy).attr('aria-disabled', isBusy ? 'true' : 'false');
  }
  function is_full_page_component($page) {
    return !$page.hasClass('wpbc_ts_popup') && $page.closest('.wpbc_admin_page__tab__time_slots_availability').length > 0;
  }
  function get_floating_header_namespace($page) {
    return '.wpbc_ts_floating_' + String($page.attr('data-wpbc-ts-id-prefix') || 'page').replace(/[^\w]/g, '_');
  }
  function get_top_nav_bottom() {
    var $topNav = $('.wpbc_ui_el__top_nav:visible').first();
    var rect;
    if (!$topNav.length) {
      return 0;
    }
    rect = $topNav.get(0).getBoundingClientRect();
    return Math.max(0, Math.round(rect.bottom));
  }
  function ensure_floating_header($page) {
    var $floating = $page.children('.wpbc_ts_floating_header');
    var $header;
    if ($floating.length) {
      return $floating;
    }
    $header = $page.find('.wpbc_ts_grid > .wpbc_ts_header').first();
    $floating = $('<div class="wpbc_ts_floating_header" aria-hidden="true"></div>').appendTo($page);
    if ($header.length) {
      $floating.append($header.clone(false, false));
    }
    return $floating;
  }
  function sync_floating_header($page) {
    var $floating;
    var $card;
    var $grid;
    var $header;
    var card;
    var cardRect;
    var headerRect;
    var topOffset;
    var shouldShow;
    if (!is_full_page_component($page)) {
      return;
    }
    $floating = ensure_floating_header($page);
    $card = $page.find('.wpbc_ts_timeline_card').first();
    $grid = $page.find('.wpbc_ts_grid').first();
    $header = $grid.find('> .wpbc_ts_header').first();
    card = $card.get(0);
    if (!card || !$grid.length || !$header.length) {
      $floating.removeClass('is-visible');
      return;
    }
    cardRect = card.getBoundingClientRect();
    headerRect = $header.get(0).getBoundingClientRect();
    topOffset = get_top_nav_bottom();
    shouldShow = headerRect.top < topOffset && cardRect.bottom > topOffset + headerRect.height;
    if (!shouldShow) {
      $floating.removeClass('is-visible');
      return;
    }
    $floating.css({
      top: topOffset + 'px',
      left: Math.round(cardRect.left) + 'px',
      width: Math.round(card.clientWidth) + 'px',
      '--wpbc-ts-floating-scroll-left': -1 * card.scrollLeft + 'px',
      '--wpbc-ts-floating-scroll-left-abs': card.scrollLeft + 'px'
    }).addClass('is-visible');
    $floating.children('.wpbc_ts_header').css('width', Math.round($grid.outerWidth()) + 'px');
  }
  function refresh_floating_header($page) {
    var $floating;
    var $header;
    if (!$page || !$page.length || !is_full_page_component($page)) {
      return;
    }
    $floating = $page.children('.wpbc_ts_floating_header');
    if (!$floating.length) {
      return;
    }
    $header = $page.find('.wpbc_ts_grid > .wpbc_ts_header').first();
    $floating.empty();
    if ($header.length) {
      $floating.append($header.clone(false, false));
    }
    sync_floating_header($page);
  }
  function bind_floating_header($page) {
    var namespace;
    if (!is_full_page_component($page)) {
      return;
    }
    namespace = get_floating_header_namespace($page);
    ensure_floating_header($page);
    $(window).off('scroll' + namespace + ' resize' + namespace).on('scroll' + namespace + ' resize' + namespace, function () {
      sync_floating_header($page);
    });
    $page.find('.wpbc_ts_timeline_card').off('scroll' + namespace).on('scroll' + namespace, function () {
      sync_floating_header($page);
    });
    $(document).off('click' + namespace).on('click' + namespace, '.wpbc_ui__top_nav__btn_show_left_vertical_nav, .wpbc_ui__top_nav__btn_show_right_vertical_nav, .wpbc_ui__top_nav__btn_full_screen, .wpbc_ui__top_nav__btn_normal_screen', function () {
      window.setTimeout(function () {
        sync_floating_header($page);
      }, 80);
    });
    sync_floating_header($page);
  }
  function refresh_bar_tooltips($page) {
    var $tooltipScope = $page.find('.wpbc_ts_timeline_card').first();
    var tooltipScopeId;
    var didInitializeTooltips = false;
    $page.find('.wpbc_ts_bar.tooltip_top, .wpbc_ts_bar_icon.tooltip_top, .wpbc_ts_booking_link.tooltip_top, .wpbc_ts_rule_link.tooltip_top').each(function () {
      if (this._tippy) {
        this._tippy.destroy();
      }
    });
    if ('function' === typeof window.wpbc_define_tippy_tooltips) {
      if ($tooltipScope.length) {
        tooltipScopeId = $tooltipScope.attr('id');
        if (!tooltipScopeId) {
          tooltipScopeId = 'wpbc_ts_timeline_tooltip_scope_' + nextTooltipScopeId;
          nextTooltipScopeId++;
          $tooltipScope.attr('id', tooltipScopeId);
        }
        didInitializeTooltips = window.wpbc_define_tippy_tooltips('#' + tooltipScopeId + ' ');
      }
      if (didInitializeTooltips) {
        return;
      }
    }
    $page.find('[data-original-title]').each(function () {
      if (!$(this).attr('title')) {
        $(this).attr('title', $(this).attr('data-original-title'));
      }
    });
  }
  function is_booking_listing_search_available() {
    return 'function' === typeof window.wpbc_ajx_booking_send_search_request_with_params && 'undefined' !== typeof window.wpbc_ajx_booking_listing && $('#wpbc_search_field').length;
  }
  function close_time_slots_popup($page, afterClose) {
    var $modal = $page.closest('.wpbc_modal__availability_timeslots__section, .modal');
    var isCallbackDone = false;
    var run_callback = function () {
      if (isCallbackDone) {
        return;
      }
      isCallbackDone = true;
      if ('function' === typeof afterClose) {
        afterClose();
      }
    };
    if (!$modal.length) {
      run_callback();
      return;
    }
    if (!$modal.is(':visible')) {
      run_callback();
      return;
    }
    if ('function' === typeof afterClose) {
      $modal.one('hidden.wpbc.modal hidden.bs.modal', run_callback);
      window.setTimeout(run_callback, 500);
    }
    if ('function' === typeof $modal.wpbc_my_modal) {
      $modal.wpbc_my_modal('hide');
      return;
    }
    if ('function' === typeof $modal.modal) {
      $modal.modal('hide');
      return;
    }
    $modal.find('[data-dismiss="modal"]').first().trigger('click');
  }
  function search_booking_in_current_listing($page, bookingId) {
    var keyword = 'id:' + parseInt(bookingId, 10);
    $('#wpbc_search_field').val(keyword);
    close_time_slots_popup($page);
    window.wpbc_ajx_booking_send_search_request_with_params({
      'keyword': keyword,
      'page_num': 1
    });
  }
  function handle_booked_bar_click($page, event) {
    var $bar = $(event.currentTarget);
    var $link = $(event.target).closest('.wpbc_ts_booking_link');
    var bookingId = $bar.attr('data-wpbc-ts-booking-id') || $link.attr('data-wpbc-ts-booking-id');
    var bookingUrl = $bar.attr('data-wpbc-ts-booking-url') || $link.attr('href');
    if (!bookingId) {
      return;
    }
    if (is_booking_listing_search_available()) {
      event.preventDefault();
      event.stopPropagation();
      search_booking_in_current_listing($page, bookingId);
      return;
    }
    if (!$link.length && bookingUrl) {
      event.preventDefault();
      window.location.href = bookingUrl;
    }
  }
  function unique_dates_from_selections($page) {
    var dates = {};
    $.each(selectionRanges, function (index, item) {
      $.each(item.rows, function (rowIndex, rowId) {
        var label = row_label($page, rowId);
        if (label) {
          dates[label] = true;
        }
      });
    });
    return Object.keys(dates);
  }
  function get_selection_payload($page) {
    var payload = [];
    $.each(selectionRanges, function (index, item) {
      $.each(item.rows, function (rowIndex, rowId) {
        var $row = $page.find('.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"]');
        var date = $row.attr('data-wpbc-ts-date');
        if (!date) {
          return;
        }
        payload.push({
          date: date,
          start_second: item.start * 60,
          end_second: item.end * 60
        });
      });
    });
    payload.sort(function (a, b) {
      if (a.date !== b.date) {
        return a.date < b.date ? -1 : 1;
      }
      if (a.start_second !== b.start_second) {
        return a.start_second - b.start_second;
      }
      return a.end_second - b.end_second;
    });
    return payload;
  }
  function get_selection_dates($page, rows) {
    var dates = [];
    var seen = {};
    $.each(rows || [], function (rowIndex, rowId) {
      var $row = $page.find('.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"]');
      var date = $row.attr('data-wpbc-ts-date');
      if (date && !seen[date]) {
        seen[date] = true;
        dates.push(date);
      }
    });
    dates.sort();
    return dates;
  }
  function get_active_booking_selection_context($page) {
    var item = activeSelectionId ? get_selection_by_id(activeSelectionId) : null;
    var dates;
    if (!item && 1 === selectionRanges.length) {
      item = selectionRanges[0];
    }
    if (!item || !item.rows || !item.rows.length) {
      return null;
    }
    dates = get_selection_dates($page, item.rows);
    if (!dates.length) {
      return null;
    }
    return {
      resource_id: get_control($page, 'resource').val() || '',
      selected_date: dates[0],
      selected_dates: dates.join(','),
      selected_time: minutes_to_time(item.start) + ' - ' + minutes_to_time(item.end),
      start_second: item.start * 60,
      end_second: item.end * 60
    };
  }
  function create_booking_from_active_selection($page) {
    var settings = window.wpbc_availability_timeslots_page || {};
    var labels = settings.i18n || {};
    var context = get_active_booking_selection_context($page);
    var $addBookingModal = $('#wpbc_modal__add_booking__section');
    if (!context) {
      if (window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.select_one_slot_for_booking || 'Select one time range on one date first.', 'warning', 3500);
      }
      return false;
    }
    if ('function' !== typeof window.wpbc_boo_listing__click__add_booking_modal || !$addBookingModal.length || 'function' !== typeof $addBookingModal.wpbc_my_modal) {
      if (window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.add_booking_modal_missing || 'Add Booking popup is not available on this page.', 'warning', 5000);
      }
      return false;
    }
    close_time_slots_popup($page, function () {
      window.wpbc_boo_listing__click__add_booking_modal({
        mode: 'add',
        resource_id: context.resource_id,
        booking_form: '',
        selected_dates: context.selected_dates,
        selected_date: context.selected_date,
        selected_time: context.selected_time,
        time_override_enabled: 1,
        time_override_source: 'times_availability',
        time_override_start: minutes_to_time(context.start_second / 60),
        time_override_end: minutes_to_time(context.end_second / 60)
      });
    });
    return true;
  }
  function clone_date(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  function add_days(date, days) {
    var next = clone_date(date);
    next.setDate(next.getDate() + days);
    return next;
  }
  function format_iso_date(date) {
    return date.getFullYear() + '-' + pad_2(date.getMonth() + 1) + '-' + pad_2(date.getDate());
  }
  function format_row_date(date) {
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return days[date.getDay()] + ' ' + months[date.getMonth()] + ' ' + date.getDate();
  }
  function format_date_range_display(startDate, endDate) {
    return $.datepick.formatDate('M d, yy', startDate) + ' - ' + $.datepick.formatDate('M d, yy', endDate);
  }
  function cache_row_templates($page) {
    if (rowTemplates.length) {
      return;
    }
    rowTemplates = $page.find('.wpbc_ts_row').clone(false).toArray();
    $.each(rowTemplates, function (index, row) {
      $(row).find('.wpbc_ts_selection:not(.wpbc_ts_selection_template)').remove();
      $(row).find('.wpbc_ts_selection_template').removeClass('is-visible is-active').attr('hidden', 'hidden');
    });
  }
  function ensure_row_count($page, count) {
    var $rowsWrap = $page.find('.wpbc_ts_rows');
    var $rows = $rowsWrap.find('.wpbc_ts_row');
    var i;
    var $clone;
    count = Math.max(1, count);
    cache_row_templates($page);
    if ($rows.length > count) {
      $rows.slice(count).remove();
    }
    for (i = $rowsWrap.find('.wpbc_ts_row').length; i < count; i++) {
      $clone = $(rowTemplates[i % rowTemplates.length]).clone(false);
      $clone.find('.wpbc_ts_selection:not(.wpbc_ts_selection_template)').remove();
      $clone.find('.wpbc_ts_selection_template').removeClass('is-visible is-active').attr('hidden', 'hidden');
      $rowsWrap.append($clone);
    }
    $rowsWrap.find('.wpbc_ts_row').each(function (index) {
      $(this).attr('data-wpbc-ts-row', String(index));
    });
  }
  function update_rows_for_date_range($page, startDate, endDate) {
    var dayMs = 24 * 60 * 60 * 1000;
    var daysCount = Math.round((clone_date(endDate).getTime() - clone_date(startDate).getTime()) / dayMs) + 1;
    daysCount = Math.max(1, daysCount);
    ensure_row_count($page, daysCount);
    $page.find('.wpbc_ts_row').each(function (index) {
      var rowDate = add_days(startDate, index);
      $(this).attr('data-wpbc-ts-date', format_iso_date(rowDate)).find('.wpbc_ts_row_label_text').text(format_row_date(rowDate));
    });
    selectionRanges = $.grep(selectionRanges, function (item) {
      item.rows = $.grep(item.rows, function (rowId) {
        return $page.find('.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"]').length > 0;
      });
      return item.rows.length > 0;
    });
    canonicalize_selections(activeSelectionId);
    position_bars($page.find('.wpbc_ts_grid'));
    render_selections($page);
    sync_floating_header($page);
  }
  function parse_datepick_selection(stringDates, jsDatesArr) {
    var dates = [];
    var parts;
    var start;
    var end;
    if (jsDatesArr && Array.isArray(jsDatesArr.range)) {
      dates = jsDatesArr.range;
    } else if (jsDatesArr && Array.isArray(jsDatesArr.multiple)) {
      dates = jsDatesArr.multiple;
    } else if (Array.isArray(jsDatesArr)) {
      dates = jsDatesArr;
    }
    dates = $.grep(dates, function (date) {
      return date instanceof Date && !isNaN(date.getTime());
    });
    if (dates.length) {
      dates.sort(function (a, b) {
        return clone_date(a).getTime() - clone_date(b).getTime();
      });
      return {
        start: clone_date(dates[0]),
        end: clone_date(dates[dates.length - 1])
      };
    }
    parts = String(stringDates || '').split(' - ');
    start = parse_date_text(parts[0]);
    end = parse_date_text(parts[1] || parts[0]);
    if (start && end) {
      return {
        start: start,
        end: end
      };
    }
    return null;
  }
  function get_datepick_selected_range($date) {
    var inst;
    if (!$.datepick || 'function' !== typeof $.datepick._getInst || !$date.length) {
      return null;
    }
    inst = $.datepick._getInst($date[0]);
    if (!inst) {
      return null;
    }
    return parse_datepick_selection($date.val(), $.datepick._getDate(inst));
  }
  function apply_date_range_selection($page, range, options) {
    var $date = get_control($page, 'date_range');
    var startDate;
    var endDate;
    var startIso;
    var endIso;
    var currentKey;
    var nextKey;
    options = options || {};
    if (!range || !range.start || !range.end) {
      return false;
    }
    startDate = clone_date(range.start);
    endDate = clone_date(range.end);
    if (startDate.getTime() > endDate.getTime()) {
      range = startDate;
      startDate = endDate;
      endDate = range;
    }
    startIso = format_iso_date(startDate);
    endIso = format_iso_date(endDate);
    currentKey = $date.attr('data-wpbc-ts-start') + ':' + $date.attr('data-wpbc-ts-end');
    nextKey = startIso + ':' + endIso;
    if (currentKey === nextKey) {
      $date.val(format_date_range_display(startDate, endDate));
      if (options.force_reload) {
        load_blocked_intervals($page);
      }
      return false;
    }
    $date.attr('data-wpbc-ts-start', startIso).attr('data-wpbc-ts-end', endIso).val(format_date_range_display(startDate, endDate));
    update_rows_for_date_range($page, startDate, endDate);
    load_blocked_intervals($page);
    return true;
  }
  function sync_date_range_from_input($page) {
    var $date = get_control($page, 'date_range');
    var range = get_datepick_selected_range($date) || parse_datepick_selection($date.val(), null);
    apply_date_range_selection($page, range);
  }
  function get_date_range_from_data_attrs($page) {
    var $date = get_control($page, 'date_range');
    var startDate = parse_date_text($date.attr('data-wpbc-ts-start'));
    var endDate = parse_date_text($date.attr('data-wpbc-ts-end'));
    if (startDate && endDate) {
      return {
        start: startDate,
        end: endDate
      };
    }
    return null;
  }
  function get_current_date_range($page) {
    var $date = get_control($page, 'date_range');
    var range = get_date_range_from_data_attrs($page) || parse_datepick_selection($date.val(), null);
    if (range) {
      return range;
    }
    return {
      start: parse_date_text($date.attr('data-wpbc-ts-start')),
      end: parse_date_text($date.attr('data-wpbc-ts-end'))
    };
  }
  function shift_date_range($page, direction) {
    var range = get_current_date_range($page);
    var dayMs = 24 * 60 * 60 * 1000;
    var daysCount;
    var shift;
    if (!range || !range.start || !range.end) {
      return false;
    }
    daysCount = Math.round((clone_date(range.end).getTime() - clone_date(range.start).getTime()) / dayMs) + 1;
    shift = Math.max(1, daysCount) * ('prev' === direction ? -1 : 1);
    clear_selection($page);
    return apply_date_range_selection($page, {
      start: add_days(range.start, shift),
      end: add_days(range.end, shift)
    }, {
      force_reload: true
    });
  }
  function parse_date_text(text) {
    var parsed;
    var sqlMatch;
    text = trim_text(text);
    if (!text) {
      return null;
    }
    sqlMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (sqlMatch) {
      return new Date(parseInt(sqlMatch[1], 10), parseInt(sqlMatch[2], 10) - 1, parseInt(sqlMatch[3], 10));
    }
    if ($.datepick && 'function' === typeof $.datepick.parseDate) {
      try {
        parsed = $.datepick.parseDate('M d, yy', text);
      } catch (error) {
        parsed = null;
      }
    }
    if (!parsed) {
      parsed = new Date(text);
    }
    return parsed instanceof Date && !isNaN(parsed.getTime()) ? clone_date(parsed) : null;
  }
  function set_time_slots_context(context, options) {
    var $context = context ? $(context) : $(document);
    var $page = $context.is('.wpbc_ts_page') ? $context : $context.find('.wpbc_ts_page').first();
    var startDate;
    var endDate;
    var resourceChanged = false;
    var rangeChanged = false;
    options = options || {};
    if (!$page.length) {
      return false;
    }
    init_time_slots_page($page, true);
    if (options.resource_id) {
      resourceChanged = String(get_control($page, 'resource').val()) !== String(options.resource_id);
      get_control($page, 'resource').val(String(options.resource_id));
    }
    startDate = parse_date_text(options.date_start);
    endDate = parse_date_text(options.date_end) || startDate;
    if (startDate && endDate) {
      clear_selection($page);
      rangeChanged = apply_date_range_selection($page, {
        start: startDate,
        end: endDate
      });
    }
    if (resourceChanged && rangeChanged) {
      return true;
    }
    if (resourceChanged || !rangeChanged) {
      load_blocked_intervals($page);
    }
    return true;
  }
  function row_from_pointer($page, event) {
    var original = event.originalEvent || event;
    var point = original.touches && original.touches.length ? original.touches[0] : original;
    var el = document.elementFromPoint(point.clientX, point.clientY);
    var $row = $(el).closest('.wpbc_ts_row');
    if (!$row.length || !$.contains($page[0], $row[0])) {
      return null;
    }
    return $row.attr('data-wpbc-ts-row');
  }
  function minute_from_pointer(event, $lane) {
    var original = event.originalEvent || event;
    var point = original.touches && original.touches.length ? original.touches[0] : original;
    var $grid = $lane.closest('.wpbc_ts_grid');
    var config = get_grid_config($grid);
    var rect = $lane[0].getBoundingClientRect();
    var ratio = (point.clientX - rect.left) / rect.width;
    var minute = config.start + ratio * (config.end - config.start);
    return clamp(snap_minute(minute, config.step), config.start, config.end);
  }
  function create_selection($page, rows, start, end) {
    var $grid = $page.find('.wpbc_ts_grid');
    var config = get_grid_config($grid);
    var range = normalize_selection_range(start, end, config);
    var item = {
      id: 'selection_' + nextSelectionId++,
      start: range.start,
      end: range.end,
      rows: rows.slice(0)
    };
    selectionRanges.push(item);
    activeSelectionId = item.id;
    canonicalize_selections(item.id);
    render_selections($page);
    return get_selection_by_id(activeSelectionId);
  }
  function update_selection($page, selectionId, rows, start, end) {
    var $grid = $page.find('.wpbc_ts_grid');
    var config = get_grid_config($grid);
    var range = normalize_selection_range(start, end, config);
    var item = get_selection_by_id(selectionId);
    if (!item) {
      return;
    }
    item.start = range.start;
    item.end = range.end;
    item.rows = rows.slice(0);
    canonicalize_selections(selectionId);
    render_selections($page);
  }
  function canonicalize_selections(preferredActiveId) {
    var intervals = [];
    var merged = [];
    var groups = [];
    var newActiveId = '';
    $.each(selectionRanges, function (index, item) {
      $.each(item.rows, function (rowIndex, rowId) {
        intervals.push({
          row: parseInt(rowId, 10),
          start: item.start,
          end: item.end,
          active: item.id === preferredActiveId || item.id === activeSelectionId
        });
      });
    });
    intervals.sort(function (a, b) {
      if (a.row !== b.row) {
        return a.row - b.row;
      }
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return a.end - b.end;
    });
    $.each(intervals, function (index, item) {
      var last = merged[merged.length - 1];
      if (last && last.row === item.row && item.start <= last.end) {
        last.end = Math.max(last.end, item.end);
        last.active = last.active || item.active;
        return;
      }
      merged.push({
        row: item.row,
        start: item.start,
        end: item.end,
        active: item.active
      });
    });
    merged.sort(function (a, b) {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      if (a.end !== b.end) {
        return a.end - b.end;
      }
      return a.row - b.row;
    });
    $.each(merged, function (index, item) {
      var last = groups[groups.length - 1];
      if (last && last.start === item.start && last.end === item.end && last.lastRow + 1 === item.row) {
        last.rows.push(String(item.row));
        last.lastRow = item.row;
        last.active = last.active || item.active;
        return;
      }
      groups.push({
        start: item.start,
        end: item.end,
        rows: [String(item.row)],
        lastRow: item.row,
        active: item.active
      });
    });
    selectionRanges = $.map(groups, function (item) {
      var id = 'selection_' + nextSelectionId++;
      if (item.active && !newActiveId) {
        newActiveId = id;
      }
      return {
        id: id,
        start: item.start,
        end: item.end,
        rows: item.rows
      };
    });
    activeSelectionId = newActiveId || (selectionRanges[0] ? selectionRanges[0].id : '');
  }
  function render_selections($page) {
    var $grid = $page.find('.wpbc_ts_grid');
    var config = get_grid_config($grid);
    $page.find('.wpbc_ts_selection:not(.wpbc_ts_selection_template)').remove();
    $.each(selectionRanges, function (index, item) {
      var range = normalize_selection_range(item.start, item.end, config);
      var left = percent_for_minute(range.start, config);
      var width = percent_for_minute(range.end, config) - left;
      item.start = range.start;
      item.end = range.end;
      $.each(item.rows, function (rowIndex, rowId) {
        var $row = $page.find('.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"]');
        var $lane = $row.find('.wpbc_ts_lane');
        var $template = $lane.find('.wpbc_ts_selection_template').first();
        var $selection;
        if (!$lane.length || !$template.length) {
          return;
        }
        $selection = $template.clone(false);
        if ($selection[0]) {
          $selection[0].hidden = false;
          $selection[0].removeAttribute('hidden');
        }
        $selection.removeClass('wpbc_ts_selection_template').addClass('is-visible').toggleClass('is-active', item.id === activeSelectionId).attr('data-wpbc-ts-selection-id', item.id).css({
          left: left + '%',
          width: width + '%'
        });
        $selection.find('.wpbc_ts_time_chip_start').text(minutes_to_time(range.start));
        $selection.find('.wpbc_ts_time_chip_end').text(minutes_to_time(range.end));
        $lane.append($selection);
      });
    });
    update_summary($page);
  }
  function clear_selection($page) {
    selectionRanges = [];
    activeSelectionId = '';
    render_selections($page);
  }
  function update_summary($page) {
    var config = get_grid_config($page.find('.wpbc_ts_grid'));
    var slotCount = 0;
    var dates = {};
    var datesCount = 0;
    var dateText = '-';
    var timeText = '-';
    var details = [];
    var detailsHtml = '';
    $.each(selectionRanges, function (index, item) {
      slotCount += Math.max(0, Math.round((item.end - item.start) / config.step) * item.rows.length);
      $.each(item.rows, function (rowIndex, rowId) {
        var label = row_label($page, rowId);
        if (!label) {
          return;
        }
        dates[label] = true;
        details.push({
          row: parseInt(rowId, 10),
          start: item.start,
          end: item.end,
          label: label
        });
      });
    });
    details.sort(function (a, b) {
      if (a.row !== b.row) {
        return a.row - b.row;
      }
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return a.end - b.end;
    });
    $.each(details, function (index, item) {
      var timeLabel = minutes_to_time(item.start) + ' - ' + minutes_to_time(item.end);
      detailsHtml += '<div class="wpbc_ts_selection_detail_item">' + '<span class="wpbc_ts_selection_detail_date">' + escape_html(item.label) + '</span>' + '<span class="wpbc_ts_selection_detail_time">' + escape_html(timeLabel) + '</span>' + '</div>';
    });
    datesCount = Object.keys(dates).length;
    if (selectionRanges.length) {
      dateText = datesCount + (1 === datesCount ? ' date' : ' dates');
      timeText = selectionRanges.length + (1 === selectionRanges.length ? ' interval' : ' intervals');
    }
    if (!detailsHtml) {
      detailsHtml = '<div class="wpbc_ts_selection_details_empty">No time slots selected.</div>';
    }
    $(document).find('[data-wpbc-ts-detail="slots"]').text(slotCount);
    $(document).find('[data-wpbc-ts-detail="dates"]').text(dateText);
    $(document).find('[data-wpbc-ts-detail="time"]').text(timeText);
    $(document).find('[data-wpbc-ts-detail="selection_list"]').html(detailsHtml);
  }
  function show_live_tip($page, event) {
    var original = event.originalEvent || event;
    var point = original.touches && original.touches.length ? original.touches[0] : original;
    var $tip = $page.find('.wpbc_ts_live_tip');
    var active = get_selection_by_id(activeSelectionId);
    if (!active) {
      return;
    }
    if (!$tip.length) {
      $tip = $('<div class="wpbc_ts_live_tip"></div>').appendTo($page);
    }
    $tip.text(minutes_to_time(active.start) + ' - ' + minutes_to_time(active.end)).css({
      left: point.pageX + 12 + 'px',
      top: point.pageY - 38 + 'px'
    }).addClass('is-visible');
  }
  function hide_live_tip($page) {
    $page.find('.wpbc_ts_live_tip').removeClass('is-visible');
  }
  function sync_slot_step_controls($page, step) {
    get_control($page, 'slot_step').val(String(step));
    $('#wpbc_ts_side_slot_step').val(String(step));
  }
  function sync_zoom_controls($page, step) {
    var index = zoomSteps.indexOf(step);
    if (-1 === index) {
      index = 2;
    }
    get_control($page, 'zoom').val(String(index));
    $('#wpbc_ts_side_zoom').val(String(index));
  }
  function set_step($page, step) {
    var $grid = $page.find('.wpbc_ts_grid');
    $grid.attr('data-wpbc-ts-step', step);
    sync_slot_step_controls($page, step);
    sync_zoom_controls($page, step);
    render_axis($grid);
    position_bars($grid);
    render_selections($page);
  }
  function sync_visible_time_controls($page, start, end) {
    get_control($page, 'day_start').val(String(start));
    get_control($page, 'day_end').val(String(end));
    get_control($page, 'day_start_slider').val(String(start));
    get_control($page, 'day_end_slider').val(String(end));
    $('#wpbc_ts_side_start').val(String(start));
    $('#wpbc_ts_side_end').val(String(end));
    $('#wpbc_ts_side_start_slider').val(String(start));
    $('#wpbc_ts_side_end_slider').val(String(end));
  }
  function set_visible_time_range($page, start, end) {
    var $grid = $page.find('.wpbc_ts_grid');
    start = parseInt(start, 10);
    end = parseInt(end, 10);
    if (end <= start) {
      if ($(document.activeElement).is('[data-wpbc-ts-control="day_start"], [data-wpbc-ts-control="day_start_slider"], #wpbc_ts_day_start, #wpbc_ts_side_start, #wpbc_ts_day_start_slider, #wpbc_ts_side_start_slider')) {
        start = Math.max(0, end - 60);
      } else {
        end = Math.min(1440, start + 60);
      }
    }
    $grid.attr('data-wpbc-ts-start', start);
    $grid.attr('data-wpbc-ts-end', end);
    sync_visible_time_controls($page, start, end);
    render_axis($grid);
    position_bars($grid);
    render_selections($page);
  }
  function set_mode(mode) {
    currentMode = mode;
  }
  function is_bar_selectable_for_time_action($bar) {
    if (!$bar.length) {
      return true;
    }
    return $bar.hasClass('wpbc_ts_bar_blocked') && '0' !== $bar.attr('data-wpbc-ts-editable');
  }
  function run_command($page, mode) {
    var settings = window.wpbc_availability_timeslots_page || {};
    var labels = settings.i18n || {};
    var payload;
    if (activeSaveRequest && activeSaveRequest.readyState !== 4) {
      return;
    }
    set_mode(mode);
    if (!selectionRanges.length) {
      if (window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.select_slots_first || 'Select one or more time ranges first.', 'warning', 3500);
      }
      return;
    }
    payload = get_selection_payload($page);
    if (!settings.ajax_url || !settings.nonce || !payload.length) {
      return;
    }
    set_timeline_loading($page, true, labels.saving || 'Saving');
    set_action_buttons_busy($page, true);
    activeSaveRequest = $.post(settings.ajax_url, {
      action: 'WPBC_AJX_AVAILABILITY_TIMESLOTS_SAVE',
      nonce: settings.nonce,
      resource_id: get_control($page, 'resource').val(),
      mode: mode,
      intervals: JSON.stringify(payload)
    }).done(function (response) {
      if (response && response.success) {
        if (window.wpbc_admin_show_message) {
          wpbc_admin_show_message('block' === mode ? labels.block_success || 'Selected time ranges have been blocked.' : labels.unblock_success || 'Selected time ranges have been unblocked.', 'success', 5000);
        }
        clear_selection($page);
        load_blocked_intervals($page);
      } else if (window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.save_error || 'Unable to save time-slot availability.', 'error', 5000);
      }
    }).fail(function () {
      if (window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.save_error || 'Unable to save time-slot availability.', 'error', 5000);
      }
    }).always(function () {
      activeSaveRequest = null;
      set_action_buttons_busy($page, false);
      if (!activeLoadRequest || activeLoadRequest.readyState === 4) {
        set_timeline_loading($page, false, labels.loading || 'Loading');
      }
    });
  }
  function init_date_range_picker($page) {
    var $date = get_control($page, 'date_range');
    var $dateWrap = $date.closest('.wpbc_ts_input_icon');
    var firstDay = 0;
    if (!$.fn.datepick) {
      if (window.console) {
        console.log('WPBC Error. JavaScript library "datepick" was not defined.');
      }
      return;
    }
    if (window._wpbc && 'function' === typeof window._wpbc.get_other_param) {
      firstDay = parseInt(window._wpbc.get_other_param('calendars__first_day'), 10) || 0;
    }
    if ($date.hasClass($.datepick.markerClassName)) {
      try {
        $date.datepick('destroy');
      } catch (error) {}
    }
    $date.datepick({
      beforeShowDay: function () {
        return [true, 'date_available'];
      },
      onSelect: function (stringDates, jsDatesArr) {
        apply_date_range_selection($page, parse_datepick_selection(stringDates, jsDatesArr));
      },
      onClose: function () {
        window.setTimeout(function () {
          sync_date_range_from_input($page);
        }, 0);
      },
      showOn: 'none',
      showAnim: 'show',
      duration: '',
      rangeSelect: true,
      multiSelect: 0,
      numberOfMonths: 1,
      stepMonths: 1,
      prevText: '&lsaquo;',
      nextText: '&rsaquo;',
      dateFormat: 'M d, yy',
      changeMonth: false,
      changeYear: false,
      minDate: null,
      maxDate: null,
      showStatus: false,
      multiSeparator: ', ',
      closeAtTop: null,
      firstDay: firstDay,
      gotoCurrent: false,
      hideIfNoPrevNext: true,
      useThemeRoller: false,
      mandatory: true
    });
    function show_date_range_picker() {
      var input = $date.get(0);
      if (!input || !$.datepick || !$.datepick._showDatepick || !$date.hasClass($.datepick.markerClassName)) {
        return;
      }
      if ($.datepick._lastInput === input && !$.datepick._datepickerShowing) {
        $.datepick._lastInput = null;
      }
      if ($.datepick._lastInput === input && $.datepick._datepickerShowing) {
        return;
      }
      $.datepick._showDatepick(input);
      $('#datepick-div, .datepick-popup').css('z-index', 1000010);
    }
    $date.off('click.wpbc_ts_date_range_open focus.wpbc_ts_date_range_open keydown.wpbc_ts_date_range_open').on('click.wpbc_ts_date_range_open focus.wpbc_ts_date_range_open keydown.wpbc_ts_date_range_open', function (event) {
      if ('keydown' === event.type && 13 !== event.which && 32 !== event.which) {
        return;
      }
      if ('keydown' === event.type) {
        event.preventDefault();
      }
      show_date_range_picker();
    });
    $dateWrap.off('mousedown.wpbc_ts_date_range_open click.wpbc_ts_date_range_open').on('mousedown.wpbc_ts_date_range_open', function (event) {
      event.stopPropagation();
    }).on('click.wpbc_ts_date_range_open', function (event) {
      if (event.target !== $date.get(0)) {
        event.preventDefault();
      }
      $date.trigger('focus');
      show_date_range_picker();
    });
    $date.on('change input', function () {
      sync_date_range_from_input($page);
    });
  }
  function init_rightbar_tabs() {
    $(document).on('click', '.wpbc_ts_rightbar_tabs [role="tab"]', function (event) {
      var $tab = $(this);
      var panelId = $tab.attr('aria-controls');
      var $panel = $('#' + panelId);
      var $tablist = $tab.closest('[role="tablist"]');
      if (!$panel.length) {
        return;
      }
      event.preventDefault();
      $tablist.find('[role="tab"]').attr('aria-selected', 'false');
      $tab.attr('aria-selected', 'true');
      $('.wpbc_ts_rightbar_panels .wpbc_bfb__palette_panel').attr('hidden', 'hidden').attr('aria-hidden', 'true');
      $panel.each(function () {
        this.hidden = false;
        this.removeAttribute('hidden');
      }).attr('aria-hidden', 'false');
    });
  }
  function init_time_slots_page(context, force) {
    var $context = context ? $(context) : $(document);
    var $pages = $context.is('.wpbc_ts_page') ? $context : $context.find('.wpbc_ts_page');
    if (!$pages.length) {
      return;
    }
    if (!force) {
      $pages = $pages.filter(function () {
        return '0' !== $(this).attr('data-wpbc-ts-auto-init');
      });
    }
    $pages.each(function () {
      init_time_slots_component($(this));
    });
  }
  function init_time_slots_component($page) {
    var $grid;
    var isDragging = false;
    var dragStartMinute = 0;
    var dragStartRow = null;
    var dragSelectionId = '';
    var resizeMode = '';
    if ($page.attr('data-wpbc-ts-initialized')) {
      return;
    }
    $page.attr('data-wpbc-ts-initialized', '1');
    cache_row_templates($page);
    $grid = $page.find('.wpbc_ts_grid');
    render_axis($grid);
    position_bars($grid);
    init_date_range_picker($page);
    load_blocked_intervals($page);
    set_mode(currentMode);
    sync_slot_step_controls($page, get_grid_config($grid).step);
    sync_zoom_controls($page, get_grid_config($grid).step);
    sync_visible_time_controls($page, get_grid_config($grid).start, get_grid_config($grid).end);
    bind_floating_header($page);
    $page.on('change', '[data-wpbc-ts-control="slot_step"], #wpbc_ts_slot_step', function () {
      set_step($page, parseInt($(this).val(), 10));
    });
    $(document).on('change', '#wpbc_ts_side_slot_step', function () {
      set_step($page, parseInt($(this).val(), 10));
    });
    $page.on('change', '[data-wpbc-ts-control="resource"], #wpbc_ts_resource', function () {
      load_blocked_intervals($page);
    });
    $page.on('input change', '[data-wpbc-ts-control="zoom"], #wpbc_ts_zoom', function () {
      var index = parseInt($(this).val(), 10);
      set_step($page, zoomSteps[index] || 15);
    });
    $(document).on('input change', '#wpbc_ts_side_zoom', function () {
      var index = parseInt($(this).val(), 10);
      set_step($page, zoomSteps[index] || 15);
    });
    $page.on('click', '[data-wpbc-ts-zoom]', function () {
      var $zoom = get_control($page, 'zoom');
      var value = parseInt($zoom.val(), 10);
      value += 'in' === $(this).attr('data-wpbc-ts-zoom') ? 1 : -1;
      value = clamp(value, 0, zoomSteps.length - 1);
      $zoom.val(String(value)).trigger('change');
    });
    $(document).on('click', '.wpbc_ts_rightbar_panels [data-wpbc-ts-zoom]', function () {
      var $zoom = $('#wpbc_ts_side_zoom');
      var value = parseInt($zoom.val(), 10);
      value += 'in' === $(this).attr('data-wpbc-ts-zoom') ? 1 : -1;
      value = clamp(value, 0, zoomSteps.length - 1);
      $zoom.val(String(value)).trigger('change');
    });
    $page.on('change', '[data-wpbc-ts-control="day_start"], [data-wpbc-ts-control="day_end"], #wpbc_ts_day_start, #wpbc_ts_day_end', function () {
      set_visible_time_range($page, get_control($page, 'day_start').val(), get_control($page, 'day_end').val());
    });
    $(document).on('change', '#wpbc_ts_side_start, #wpbc_ts_side_end', function () {
      set_visible_time_range($page, $('#wpbc_ts_side_start').val(), $('#wpbc_ts_side_end').val());
    });
    $page.on('input change', '[data-wpbc-ts-control="day_start_slider"], [data-wpbc-ts-control="day_end_slider"], #wpbc_ts_day_start_slider, #wpbc_ts_day_end_slider', function () {
      set_visible_time_range($page, get_control($page, 'day_start_slider').val(), get_control($page, 'day_end_slider').val());
    });
    $(document).on('input change', '#wpbc_ts_side_start_slider, #wpbc_ts_side_end_slider', function () {
      set_visible_time_range($page, $('#wpbc_ts_side_start_slider').val(), $('#wpbc_ts_side_end_slider').val());
    });
    $page.on('click', '[data-wpbc-ts-command]', function (event) {
      event.preventDefault();
      run_command($page, $(this).attr('data-wpbc-ts-command'));
    });
    $page.on('click', '[data-wpbc-ts-range-shift]', function (event) {
      event.preventDefault();
      shift_date_range($page, $(this).attr('data-wpbc-ts-range-shift'));
    });
    $page.on('click', '[data-wpbc-ts-create-booking]', function (event) {
      event.preventDefault();
      create_booking_from_active_selection($page);
    });
    $page.closest('.modal').off('click.wpbc_ts_create_booking').on('click.wpbc_ts_create_booking', '[data-wpbc-ts-create-booking]', function (event) {
      event.preventDefault();
      create_booking_from_active_selection($page);
    });
    $page.closest('.modal').off('click.wpbc_ts_footer_command').on('click.wpbc_ts_footer_command', '[data-wpbc-ts-command]', function (event) {
      event.preventDefault();
      run_command($page, $(this).attr('data-wpbc-ts-command'));
    });
    $page.closest('.modal').off('click.wpbc_ts_footer_clear').on('click.wpbc_ts_footer_clear', '.wpbc_ts_clear_selection', function (event) {
      event.preventDefault();
      clear_selection($page);
    });
    $page.on('click', '.wpbc_ts_bar_booked', function (event) {
      handle_booked_bar_click($page, event);
    });
    $(document).off('click.wpbc_ts_rightbar_command').on('click.wpbc_ts_rightbar_command', '.wpbc_ts_rightbar_panels [data-wpbc-ts-command]', function (event) {
      event.preventDefault();
      run_command($page, $(this).attr('data-wpbc-ts-command'));
    });
    $(document).off('click.wpbc_ts_rightbar_range_shift').on('click.wpbc_ts_rightbar_range_shift', '.wpbc_ts_rightbar_panels [data-wpbc-ts-range-shift]', function (event) {
      event.preventDefault();
      shift_date_range($page, $(this).attr('data-wpbc-ts-range-shift'));
    });
    $page.on('mousedown touchstart', '.wpbc_ts_handle', function (event) {
      var $selection = $(this).closest('.wpbc_ts_selection');
      var $lane = $selection.closest('.wpbc_ts_lane');
      isDragging = true;
      resizeMode = $(this).hasClass('wpbc_ts_handle_start') ? 'start' : 'end';
      activeSelectionId = $selection.attr('data-wpbc-ts-selection-id');
      dragSelectionId = activeSelectionId;
      dragStartRow = $lane.closest('.wpbc_ts_row').attr('data-wpbc-ts-row');
      dragStartMinute = minute_from_pointer(event, $lane);
      render_selections($page);
      event.preventDefault();
      event.stopPropagation();
    });
    $page.on('mousedown touchstart', '.wpbc_ts_selection:not(.wpbc_ts_selection_template)', function (event) {
      if ($(event.target).closest('.wpbc_ts_handle').length) {
        return;
      }
      activeSelectionId = $(this).attr('data-wpbc-ts-selection-id');
      render_selections($page);
      event.stopPropagation();
    });
    $page.on('mousedown touchstart', '.wpbc_ts_lane', function (event) {
      var $lane = $(this);
      var $barTarget = $(event.target).closest('.wpbc_ts_bar');
      var step;
      if ($(event.target).closest('.wpbc_ts_selection:not(.wpbc_ts_selection_template)').length) {
        return;
      }
      if ($barTarget.length && !is_bar_selectable_for_time_action($barTarget)) {
        return;
      }
      isDragging = true;
      resizeMode = '';
      dragStartRow = $lane.closest('.wpbc_ts_row').attr('data-wpbc-ts-row');
      dragStartMinute = minute_from_pointer(event, $lane);
      step = get_grid_config($grid).step;
      dragSelectionId = create_selection($page, [dragStartRow], dragStartMinute, dragStartMinute + step).id;
      show_live_tip($page, event);
      event.preventDefault();
    });
    $(document).on('mousemove.wpbc_ts touchmove.wpbc_ts', function (event) {
      var currentRow;
      var rows;
      var $lane;
      var minute;
      var item;
      if (!isDragging) {
        return;
      }
      item = get_selection_by_id(dragSelectionId);
      if (!item) {
        return;
      }
      currentRow = row_from_pointer($page, event) || dragStartRow;
      rows = get_rows_between($page, dragStartRow, currentRow);
      $lane = $page.find('.wpbc_ts_row[data-wpbc-ts-row="' + dragStartRow + '"] .wpbc_ts_lane');
      minute = minute_from_pointer(event, $lane);
      if ('start' === resizeMode) {
        update_selection($page, item.id, item.rows, minute, item.end);
      } else if ('end' === resizeMode) {
        update_selection($page, item.id, item.rows, item.start, minute);
      } else {
        update_selection($page, item.id, rows, dragStartMinute, minute);
      }
      dragSelectionId = activeSelectionId;
      show_live_tip($page, event);
      event.preventDefault();
    });
    $(document).on('mouseup.wpbc_ts touchend.wpbc_ts', function () {
      isDragging = false;
      resizeMode = '';
      dragSelectionId = '';
      hide_live_tip($page);
    });
    $page.on('click', '.wpbc_ts_clear_selection', function (event) {
      event.preventDefault();
      clear_selection($page);
    });
    $(document).off('click.wpbc_ts_rightbar_clear').on('click.wpbc_ts_rightbar_clear', '.wpbc_ts_rightbar_panels .wpbc_ts_clear_selection', function (event) {
      event.preventDefault();
      clear_selection($page);
    });
  }
  window.wpbc_availability_timeslots_init = function (context) {
    init_time_slots_page(context || document, true);
  };
  window.wpbc_availability_timeslots_set_context = set_time_slots_context;
  $(function () {
    init_rightbar_tabs();
    init_time_slots_page(document, false);
    $(document).on('wpbc_availability_timeslots_init', function (event, context) {
      init_time_slots_page(context || document, true);
    });
  });
})(jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktdGltZXNsb3RzL19vdXQvYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlLmpzIiwibmFtZXMiOlsiJCIsInpvb21TdGVwcyIsImN1cnJlbnRNb2RlIiwic2VsZWN0aW9uUmFuZ2VzIiwiYWN0aXZlU2VsZWN0aW9uSWQiLCJyb3dUZW1wbGF0ZXMiLCJuZXh0U2VsZWN0aW9uSWQiLCJuZXh0VG9vbHRpcFNjb3BlSWQiLCJhY3RpdmVMb2FkUmVxdWVzdCIsImFjdGl2ZUxvYWRSZXF1ZXN0SWQiLCJhY3RpdmVTYXZlUmVxdWVzdCIsInBhZF8yIiwidmFsdWUiLCJ0cmltX3RleHQiLCJTdHJpbmciLCJyZXBsYWNlIiwibWludXRlc190b190aW1lIiwibWludXRlcyIsImhvdXJzIiwiTWF0aCIsImZsb29yIiwibWlucyIsImNsYW1wIiwibWluIiwibWF4Iiwic25hcF9taW51dGUiLCJtaW51dGUiLCJzdGVwIiwicm91bmQiLCJnZXRfZ3JpZF9jb25maWciLCIkZ3JpZCIsInN0YXJ0IiwicGFyc2VJbnQiLCJhdHRyIiwiZW5kIiwiZ2V0X2NvbnRyb2wiLCIkcGFnZSIsIm5hbWUiLCIkY29udHJvbCIsImZpbmQiLCJmaXJzdCIsImxlbmd0aCIsInBlcmNlbnRfZm9yX21pbnV0ZSIsImNvbmZpZyIsIm5vcm1hbGl6ZV9zZWxlY3Rpb25fcmFuZ2UiLCJnZXRfc2VsZWN0aW9uX2J5X2lkIiwic2VsZWN0aW9uSWQiLCJmb3VuZCIsImVhY2giLCJpbmRleCIsIml0ZW0iLCJpZCIsInJlbmRlcl9heGlzIiwiJGF4aXMiLCJodG1sIiwic2xvdENvdW50IiwidmlzaWJsZUhvdXJzIiwiYXhpc0ZvbnRTaXplIiwiYXhpc0ZvbnRXZWlnaHQiLCJmaXJzdEhvdXIiLCJjZWlsIiwiY3NzIiwicmVmcmVzaF9mbG9hdGluZ19oZWFkZXIiLCJjbG9zZXN0IiwicG9zaXRpb25fYmFycyIsIiRiYXIiLCJ2aXNpYmxlU3RhcnQiLCJ2aXNpYmxlRW5kIiwibGVmdCIsIndpZHRoIiwiaGlkZSIsInNob3ciLCJyZW5kZXJfdGltZWxpbmVfYmFycyIsImJhcnMiLCJzZXR0aW5ncyIsIndpbmRvdyIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIiwibGFiZWxzIiwiaTE4biIsInJlbW92ZSIsImRhdGUiLCJyZXNvdXJjZXMiLCIkcm93IiwicmVzb3VyY2VJZCIsInJlc291cmNlQmFycyIsImludGVydmFsIiwidHlwZSIsImljb24iLCJ0b29sdGlwIiwiJGljb25XcmFwIiwiYm9va2luZ191cmwiLCJib29raW5nX2lkIiwib3Blbl9ib29raW5nIiwicnVsZV91cmwiLCJydWxlX3NvdXJjZSIsInNvdXJjZV90eXBlIiwib3Blbl9hdmFpbGFiaWxpdHlfcnVsZSIsInN0YXR1c190aXRsZSIsImFkZENsYXNzIiwic3RhcnRfbWludXRlIiwiZW5kX21pbnV0ZSIsInVuYXZhaWxhYmxlX3RpbWVzbG90X2lkIiwiZWRpdGFibGUiLCJhcHBlbmQiLCJyZWZyZXNoX2Jhcl90b29sdGlwcyIsImxvYWRfYmxvY2tlZF9pbnRlcnZhbHMiLCIkZGF0ZVJhbmdlIiwicmVxdWVzdElkIiwiYWpheF91cmwiLCJyZWFkeVN0YXRlIiwiYWJvcnQiLCJzZXRfdGltZWxpbmVfbG9hZGluZyIsImxvYWRpbmciLCJwb3N0IiwiYWN0aW9uIiwibm9uY2UiLCJyZXNvdXJjZV9pZCIsInZhbCIsImRhdGVfc3RhcnQiLCJkYXRlX2VuZCIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJkYXRhIiwiZmFpbCIsInhociIsInRleHRTdGF0dXMiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsInNhdmVfZXJyb3IiLCJhbHdheXMiLCJnZXRfcm93c19iZXR3ZWVuIiwic3RhcnRSb3ciLCJlbmRSb3ciLCJzdGFydEluZGV4IiwiZW5kSW5kZXgiLCJyb3dzIiwiaSIsInB1c2giLCJyb3dfbGFiZWwiLCJyb3dJZCIsInRleHQiLCJlc2NhcGVfaHRtbCIsInBvc2l0aW9uX2xvYWRpbmdfb3ZlcmxheSIsIiRjYXJkIiwiY2FyZCIsImdldCIsIiRvdmVybGF5IiwiY2xpZW50V2lkdGgiLCJoZWlnaHQiLCJjbGllbnRIZWlnaHQiLCJ0cmFuc2Zvcm0iLCJzY3JvbGxMZWZ0Iiwic2Nyb2xsVG9wIiwiaXNMb2FkaW5nIiwibGFiZWwiLCJ0b2dnbGVDbGFzcyIsIm9mZiIsIm9uIiwic2V0X2FjdGlvbl9idXR0b25zX2J1c3kiLCJpc0J1c3kiLCIkc2NvcGUiLCJhZGQiLCJpc19mdWxsX3BhZ2VfY29tcG9uZW50IiwiaGFzQ2xhc3MiLCJnZXRfZmxvYXRpbmdfaGVhZGVyX25hbWVzcGFjZSIsImdldF90b3BfbmF2X2JvdHRvbSIsIiR0b3BOYXYiLCJyZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwiYm90dG9tIiwiZW5zdXJlX2Zsb2F0aW5nX2hlYWRlciIsIiRmbG9hdGluZyIsImNoaWxkcmVuIiwiJGhlYWRlciIsImFwcGVuZFRvIiwiY2xvbmUiLCJzeW5jX2Zsb2F0aW5nX2hlYWRlciIsImNhcmRSZWN0IiwiaGVhZGVyUmVjdCIsInRvcE9mZnNldCIsInNob3VsZFNob3ciLCJyZW1vdmVDbGFzcyIsInRvcCIsIm91dGVyV2lkdGgiLCJlbXB0eSIsImJpbmRfZmxvYXRpbmdfaGVhZGVyIiwibmFtZXNwYWNlIiwiZG9jdW1lbnQiLCJzZXRUaW1lb3V0IiwiJHRvb2x0aXBTY29wZSIsInRvb2x0aXBTY29wZUlkIiwiZGlkSW5pdGlhbGl6ZVRvb2x0aXBzIiwiX3RpcHB5IiwiZGVzdHJveSIsIndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzIiwiaXNfYm9va2luZ19saXN0aW5nX3NlYXJjaF9hdmFpbGFibGUiLCJ3cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMiLCJ3cGJjX2FqeF9ib29raW5nX2xpc3RpbmciLCJjbG9zZV90aW1lX3Nsb3RzX3BvcHVwIiwiYWZ0ZXJDbG9zZSIsIiRtb2RhbCIsImlzQ2FsbGJhY2tEb25lIiwicnVuX2NhbGxiYWNrIiwiaXMiLCJvbmUiLCJ3cGJjX215X21vZGFsIiwibW9kYWwiLCJ0cmlnZ2VyIiwic2VhcmNoX2Jvb2tpbmdfaW5fY3VycmVudF9saXN0aW5nIiwiYm9va2luZ0lkIiwia2V5d29yZCIsImhhbmRsZV9ib29rZWRfYmFyX2NsaWNrIiwiZXZlbnQiLCJjdXJyZW50VGFyZ2V0IiwiJGxpbmsiLCJ0YXJnZXQiLCJib29raW5nVXJsIiwicHJldmVudERlZmF1bHQiLCJzdG9wUHJvcGFnYXRpb24iLCJsb2NhdGlvbiIsImhyZWYiLCJ1bmlxdWVfZGF0ZXNfZnJvbV9zZWxlY3Rpb25zIiwiZGF0ZXMiLCJyb3dJbmRleCIsIk9iamVjdCIsImtleXMiLCJnZXRfc2VsZWN0aW9uX3BheWxvYWQiLCJwYXlsb2FkIiwic3RhcnRfc2Vjb25kIiwiZW5kX3NlY29uZCIsInNvcnQiLCJhIiwiYiIsImdldF9zZWxlY3Rpb25fZGF0ZXMiLCJzZWVuIiwiZ2V0X2FjdGl2ZV9ib29raW5nX3NlbGVjdGlvbl9jb250ZXh0Iiwic2VsZWN0ZWRfZGF0ZSIsInNlbGVjdGVkX2RhdGVzIiwiam9pbiIsInNlbGVjdGVkX3RpbWUiLCJjcmVhdGVfYm9va2luZ19mcm9tX2FjdGl2ZV9zZWxlY3Rpb24iLCJjb250ZXh0IiwiJGFkZEJvb2tpbmdNb2RhbCIsInNlbGVjdF9vbmVfc2xvdF9mb3JfYm9va2luZyIsIndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbCIsImFkZF9ib29raW5nX21vZGFsX21pc3NpbmciLCJtb2RlIiwiYm9va2luZ19mb3JtIiwidGltZV9vdmVycmlkZV9lbmFibGVkIiwidGltZV9vdmVycmlkZV9zb3VyY2UiLCJ0aW1lX292ZXJyaWRlX3N0YXJ0IiwidGltZV9vdmVycmlkZV9lbmQiLCJjbG9uZV9kYXRlIiwiRGF0ZSIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwiYWRkX2RheXMiLCJkYXlzIiwibmV4dCIsInNldERhdGUiLCJmb3JtYXRfaXNvX2RhdGUiLCJmb3JtYXRfcm93X2RhdGUiLCJtb250aHMiLCJnZXREYXkiLCJmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5Iiwic3RhcnREYXRlIiwiZW5kRGF0ZSIsImRhdGVwaWNrIiwiZm9ybWF0RGF0ZSIsImNhY2hlX3Jvd190ZW1wbGF0ZXMiLCJ0b0FycmF5Iiwicm93IiwiZW5zdXJlX3Jvd19jb3VudCIsImNvdW50IiwiJHJvd3NXcmFwIiwiJHJvd3MiLCIkY2xvbmUiLCJzbGljZSIsInVwZGF0ZV9yb3dzX2Zvcl9kYXRlX3JhbmdlIiwiZGF5TXMiLCJkYXlzQ291bnQiLCJnZXRUaW1lIiwicm93RGF0ZSIsImdyZXAiLCJjYW5vbmljYWxpemVfc2VsZWN0aW9ucyIsInJlbmRlcl9zZWxlY3Rpb25zIiwicGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uIiwic3RyaW5nRGF0ZXMiLCJqc0RhdGVzQXJyIiwicGFydHMiLCJBcnJheSIsImlzQXJyYXkiLCJyYW5nZSIsIm11bHRpcGxlIiwiaXNOYU4iLCJzcGxpdCIsInBhcnNlX2RhdGVfdGV4dCIsImdldF9kYXRlcGlja19zZWxlY3RlZF9yYW5nZSIsIiRkYXRlIiwiaW5zdCIsIl9nZXRJbnN0IiwiX2dldERhdGUiLCJhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiIsIm9wdGlvbnMiLCJzdGFydElzbyIsImVuZElzbyIsImN1cnJlbnRLZXkiLCJuZXh0S2V5IiwiZm9yY2VfcmVsb2FkIiwic3luY19kYXRlX3JhbmdlX2Zyb21faW5wdXQiLCJnZXRfZGF0ZV9yYW5nZV9mcm9tX2RhdGFfYXR0cnMiLCJnZXRfY3VycmVudF9kYXRlX3JhbmdlIiwic2hpZnRfZGF0ZV9yYW5nZSIsImRpcmVjdGlvbiIsInNoaWZ0IiwiY2xlYXJfc2VsZWN0aW9uIiwicGFyc2VkIiwic3FsTWF0Y2giLCJtYXRjaCIsInBhcnNlRGF0ZSIsImVycm9yIiwic2V0X3RpbWVfc2xvdHNfY29udGV4dCIsIiRjb250ZXh0IiwicmVzb3VyY2VDaGFuZ2VkIiwicmFuZ2VDaGFuZ2VkIiwiaW5pdF90aW1lX3Nsb3RzX3BhZ2UiLCJyb3dfZnJvbV9wb2ludGVyIiwib3JpZ2luYWwiLCJvcmlnaW5hbEV2ZW50IiwicG9pbnQiLCJ0b3VjaGVzIiwiZWwiLCJlbGVtZW50RnJvbVBvaW50IiwiY2xpZW50WCIsImNsaWVudFkiLCJjb250YWlucyIsIm1pbnV0ZV9mcm9tX3BvaW50ZXIiLCIkbGFuZSIsInJhdGlvIiwiY3JlYXRlX3NlbGVjdGlvbiIsInVwZGF0ZV9zZWxlY3Rpb24iLCJwcmVmZXJyZWRBY3RpdmVJZCIsImludGVydmFscyIsIm1lcmdlZCIsImdyb3VwcyIsIm5ld0FjdGl2ZUlkIiwiYWN0aXZlIiwibGFzdCIsImxhc3RSb3ciLCJtYXAiLCIkdGVtcGxhdGUiLCIkc2VsZWN0aW9uIiwiaGlkZGVuIiwicmVtb3ZlQXR0cmlidXRlIiwidXBkYXRlX3N1bW1hcnkiLCJkYXRlc0NvdW50IiwiZGF0ZVRleHQiLCJ0aW1lVGV4dCIsImRldGFpbHMiLCJkZXRhaWxzSHRtbCIsInRpbWVMYWJlbCIsInNob3dfbGl2ZV90aXAiLCIkdGlwIiwicGFnZVgiLCJwYWdlWSIsImhpZGVfbGl2ZV90aXAiLCJzeW5jX3Nsb3Rfc3RlcF9jb250cm9scyIsInN5bmNfem9vbV9jb250cm9scyIsImluZGV4T2YiLCJzZXRfc3RlcCIsInN5bmNfdmlzaWJsZV90aW1lX2NvbnRyb2xzIiwic2V0X3Zpc2libGVfdGltZV9yYW5nZSIsImFjdGl2ZUVsZW1lbnQiLCJzZXRfbW9kZSIsImlzX2Jhcl9zZWxlY3RhYmxlX2Zvcl90aW1lX2FjdGlvbiIsInJ1bl9jb21tYW5kIiwic2VsZWN0X3Nsb3RzX2ZpcnN0Iiwic2F2aW5nIiwiSlNPTiIsInN0cmluZ2lmeSIsImJsb2NrX3N1Y2Nlc3MiLCJ1bmJsb2NrX3N1Y2Nlc3MiLCJpbml0X2RhdGVfcmFuZ2VfcGlja2VyIiwiJGRhdGVXcmFwIiwiZmlyc3REYXkiLCJmbiIsImNvbnNvbGUiLCJsb2ciLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsIm1hcmtlckNsYXNzTmFtZSIsImJlZm9yZVNob3dEYXkiLCJvblNlbGVjdCIsIm9uQ2xvc2UiLCJzaG93T24iLCJzaG93QW5pbSIsImR1cmF0aW9uIiwicmFuZ2VTZWxlY3QiLCJtdWx0aVNlbGVjdCIsIm51bWJlck9mTW9udGhzIiwic3RlcE1vbnRocyIsInByZXZUZXh0IiwibmV4dFRleHQiLCJkYXRlRm9ybWF0IiwiY2hhbmdlTW9udGgiLCJjaGFuZ2VZZWFyIiwibWluRGF0ZSIsIm1heERhdGUiLCJzaG93U3RhdHVzIiwibXVsdGlTZXBhcmF0b3IiLCJjbG9zZUF0VG9wIiwiZ290b0N1cnJlbnQiLCJoaWRlSWZOb1ByZXZOZXh0IiwidXNlVGhlbWVSb2xsZXIiLCJtYW5kYXRvcnkiLCJzaG93X2RhdGVfcmFuZ2VfcGlja2VyIiwiaW5wdXQiLCJfc2hvd0RhdGVwaWNrIiwiX2xhc3RJbnB1dCIsIl9kYXRlcGlja2VyU2hvd2luZyIsIndoaWNoIiwiaW5pdF9yaWdodGJhcl90YWJzIiwiJHRhYiIsInBhbmVsSWQiLCIkcGFuZWwiLCIkdGFibGlzdCIsImZvcmNlIiwiJHBhZ2VzIiwiZmlsdGVyIiwiaW5pdF90aW1lX3Nsb3RzX2NvbXBvbmVudCIsImlzRHJhZ2dpbmciLCJkcmFnU3RhcnRNaW51dGUiLCJkcmFnU3RhcnRSb3ciLCJkcmFnU2VsZWN0aW9uSWQiLCJyZXNpemVNb2RlIiwiJHpvb20iLCIkYmFyVGFyZ2V0IiwiY3VycmVudFJvdyIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0IiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktdGltZXNsb3RzL19zcmMvYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBUaW1lIFNsb3RzIEF2YWlsYWJpbGl0eSBVSS5cclxuICovXHJcbiggZnVuY3Rpb24gKCAkICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIHpvb21TdGVwcyA9IFsgNjAsIDMwLCAxNSwgMTAsIDUgXTtcclxuXHR2YXIgY3VycmVudE1vZGUgPSAnYmxvY2snO1xyXG5cdHZhciBzZWxlY3Rpb25SYW5nZXMgPSBbXTtcclxuXHR2YXIgYWN0aXZlU2VsZWN0aW9uSWQgPSAnJztcclxuXHR2YXIgcm93VGVtcGxhdGVzID0gW107XHJcblx0dmFyIG5leHRTZWxlY3Rpb25JZCA9IDE7XHJcblx0dmFyIG5leHRUb29sdGlwU2NvcGVJZCA9IDE7XHJcblx0dmFyIGFjdGl2ZUxvYWRSZXF1ZXN0ID0gbnVsbDtcclxuXHR2YXIgYWN0aXZlTG9hZFJlcXVlc3RJZCA9IDA7XHJcblx0dmFyIGFjdGl2ZVNhdmVSZXF1ZXN0ID0gbnVsbDtcclxuXHJcblx0ZnVuY3Rpb24gcGFkXzIoIHZhbHVlICkge1xyXG5cdFx0cmV0dXJuICggdmFsdWUgPCAxMCA/ICcwJyA6ICcnICkgKyB2YWx1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHRyaW1fdGV4dCggdmFsdWUgKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnJlcGxhY2UoIC9eXFxzK3xcXHMrJC9nLCAnJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbWludXRlc190b190aW1lKCBtaW51dGVzICkge1xyXG5cdFx0dmFyIGhvdXJzID0gTWF0aC5mbG9vciggbWludXRlcyAvIDYwICk7XHJcblx0XHR2YXIgbWlucyA9IG1pbnV0ZXMgJSA2MDtcclxuXHRcdHJldHVybiBwYWRfMiggaG91cnMgKSArICc6JyArIHBhZF8yKCBtaW5zICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbGFtcCggdmFsdWUsIG1pbiwgbWF4ICkge1xyXG5cdFx0cmV0dXJuIE1hdGgubWF4KCBtaW4sIE1hdGgubWluKCBtYXgsIHZhbHVlICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNuYXBfbWludXRlKCBtaW51dGUsIHN0ZXAgKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5yb3VuZCggbWludXRlIC8gc3RlcCApICogc3RlcDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdGFydDogcGFyc2VJbnQoICRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICksIDEwICkgfHwgMCxcclxuXHRcdFx0ZW5kOiBwYXJzZUludCggJGdyaWQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICksIDEwICkgfHwgMTQ0MCxcclxuXHRcdFx0c3RlcDogcGFyc2VJbnQoICRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RlcCcgKSwgMTAgKSB8fCAxNVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jb250cm9sKCAkcGFnZSwgbmFtZSApIHtcclxuXHRcdHZhciAkY29udHJvbCA9ICRwYWdlLmZpbmQoICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCInICsgbmFtZSArICdcIl0nICkuZmlyc3QoKTtcclxuXHJcblx0XHRpZiAoICEgJGNvbnRyb2wubGVuZ3RoICkge1xyXG5cdFx0XHQkY29udHJvbCA9ICRwYWdlLmZpbmQoICcjd3BiY190c18nICsgbmFtZSApLmZpcnN0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICRjb250cm9sO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApIHtcclxuXHRcdHJldHVybiAoICggbWludXRlIC0gY29uZmlnLnN0YXJ0ICkgLyAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKSApICogMTAwO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggc3RhcnQsIGVuZCwgY29uZmlnICkge1xyXG5cdFx0c3RhcnQgPSBjbGFtcCggc25hcF9taW51dGUoIHN0YXJ0LCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdGVuZCA9IGNsYW1wKCBzbmFwX21pbnV0ZSggZW5kLCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0ID09PSBlbmQgKSB7XHJcblx0XHRcdGVuZCA9IGNsYW1wKCBzdGFydCArIGNvbmZpZy5zdGVwLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0aWYgKCBzdGFydCA9PT0gZW5kICkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gY2xhbXAoIGVuZCAtIGNvbmZpZy5zdGVwLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN0YXJ0OiBNYXRoLm1pbiggc3RhcnQsIGVuZCApLFxyXG5cdFx0XHRlbmQ6IE1hdGgubWF4KCBzdGFydCwgZW5kIClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX2J5X2lkKCBzZWxlY3Rpb25JZCApIHtcclxuXHRcdHZhciBmb3VuZCA9IG51bGw7XHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0aWYgKCBpdGVtLmlkID09PSBzZWxlY3Rpb25JZCApIHtcclxuXHRcdFx0XHRmb3VuZCA9IGl0ZW07XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fSApO1xyXG5cdFx0cmV0dXJuIGZvdW5kO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVuZGVyX2F4aXMoICRncmlkICkge1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHRcdHZhciAkYXhpcyA9ICRncmlkLmZpbmQoICcud3BiY190c190aW1lX2F4aXMnICk7XHJcblx0XHR2YXIgaHRtbCA9ICcnO1xyXG5cdFx0dmFyIG1pbnV0ZTtcclxuXHRcdHZhciBzbG90Q291bnQgPSBNYXRoLm1heCggMSwgKCBjb25maWcuZW5kIC0gY29uZmlnLnN0YXJ0ICkgLyBjb25maWcuc3RlcCApO1xyXG5cdFx0dmFyIHZpc2libGVIb3VycyA9IE1hdGgubWF4KCAxLCAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKSAvIDYwICk7XHJcblx0XHR2YXIgYXhpc0ZvbnRTaXplID0gY2xhbXAoIE1hdGgucm91bmQoIDE2IC0gKCB2aXNpYmxlSG91cnMgKiAwLjI1ICkgKSwgMTAsIDEzICk7XHJcblx0XHR2YXIgYXhpc0ZvbnRXZWlnaHQgPSB2aXNpYmxlSG91cnMgPD0gMTAgPyA1NTAgOiA0MDA7XHJcblx0XHR2YXIgZmlyc3RIb3VyID0gTWF0aC5jZWlsKCBjb25maWcuc3RhcnQgLyA2MCApICogNjA7XHJcblxyXG5cdFx0JGdyaWQuY3NzKCAnLS13cGJjLXRzLXNsb3QtY291bnQnLCBTdHJpbmcoIHNsb3RDb3VudCApICk7XHJcblx0XHQkZ3JpZC5jc3MoICctLXdwYmMtdHMtYXhpcy1sYWJlbC1zaXplJywgYXhpc0ZvbnRTaXplICsgJ3B4JyApO1xyXG5cdFx0JGdyaWQuY3NzKCAnLS13cGJjLXRzLWF4aXMtbGFiZWwtd2VpZ2h0JywgU3RyaW5nKCBheGlzRm9udFdlaWdodCApICk7XHJcblxyXG5cdFx0Zm9yICggbWludXRlID0gZmlyc3RIb3VyOyBtaW51dGUgPD0gY29uZmlnLmVuZDsgbWludXRlICs9IDYwICkge1xyXG5cdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYXhpc19sYWJlbFwiIHN0eWxlPVwibGVmdDonICsgcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApICsgJyU7XCI+JyArIG1pbnV0ZXNfdG9fdGltZSggbWludXRlICkgKyAnPC9zcGFuPic7XHJcblx0XHRcdGh0bWwgKz0gJzxzcGFuIGNsYXNzPVwid3BiY190c19heGlzX3RpY2tcIiBzdHlsZT1cImxlZnQ6JyArIHBlcmNlbnRfZm9yX21pbnV0ZSggbWludXRlLCBjb25maWcgKSArICclO1wiPjwvc3Bhbj4nO1xyXG5cdFx0XHRpZiAoIG1pbnV0ZSArIDMwIDwgY29uZmlnLmVuZCApIHtcclxuXHRcdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYXhpc19kb3RcIiBzdHlsZT1cImxlZnQ6JyArIHBlcmNlbnRfZm9yX21pbnV0ZSggbWludXRlICsgMzAsIGNvbmZpZyApICsgJyU7XCI+PC9zcGFuPic7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKCBtaW51dGUgPSBjb25maWcuc3RhcnQgKyBjb25maWcuc3RlcDsgbWludXRlIDwgY29uZmlnLmVuZDsgbWludXRlICs9IGNvbmZpZy5zdGVwICkge1xyXG5cdFx0XHRpZiAoIDAgPT09IG1pbnV0ZSAlIDYwIHx8IDMwID09PSBtaW51dGUgJSA2MCApIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYXhpc19taW5vclwiIHN0eWxlPVwibGVmdDonICsgcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApICsgJyU7XCI+PC9zcGFuPic7XHJcblx0XHR9XHJcblxyXG5cdFx0JGF4aXMuaHRtbCggaHRtbCApO1xyXG5cdFx0cmVmcmVzaF9mbG9hdGluZ19oZWFkZXIoICRncmlkLmNsb3Nlc3QoICcud3BiY190c19wYWdlJyApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwb3NpdGlvbl9iYXJzKCAkZ3JpZCApIHtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblxyXG5cdFx0JGdyaWQuZmluZCggJy53cGJjX3RzX2JhcicgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkYmFyID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgc3RhcnQgPSBwYXJzZUludCggJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApLCAxMCApO1xyXG5cdFx0XHR2YXIgZW5kID0gcGFyc2VJbnQoICRiYXIuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICksIDEwICk7XHJcblx0XHRcdHZhciB2aXNpYmxlU3RhcnQgPSBjbGFtcCggc3RhcnQsIGNvbmZpZy5zdGFydCwgY29uZmlnLmVuZCApO1xyXG5cdFx0XHR2YXIgdmlzaWJsZUVuZCA9IGNsYW1wKCBlbmQsIGNvbmZpZy5zdGFydCwgY29uZmlnLmVuZCApO1xyXG5cdFx0XHR2YXIgbGVmdDtcclxuXHRcdFx0dmFyIHdpZHRoO1xyXG5cclxuXHRcdFx0aWYgKCB2aXNpYmxlRW5kIDw9IGNvbmZpZy5zdGFydCB8fCB2aXNpYmxlU3RhcnQgPj0gY29uZmlnLmVuZCB8fCB2aXNpYmxlU3RhcnQgPj0gdmlzaWJsZUVuZCApIHtcclxuXHRcdFx0XHQkYmFyLmhpZGUoKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxlZnQgPSBwZXJjZW50X2Zvcl9taW51dGUoIHZpc2libGVTdGFydCwgY29uZmlnICk7XHJcblx0XHRcdHdpZHRoID0gcGVyY2VudF9mb3JfbWludXRlKCB2aXNpYmxlRW5kLCBjb25maWcgKSAtIGxlZnQ7XHJcblx0XHRcdCRiYXIuc2hvdygpLmNzcyggeyBsZWZ0OiBsZWZ0ICsgJyUnLCB3aWR0aDogd2lkdGggKyAnJScgfSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVuZGVyX3RpbWVsaW5lX2JhcnMoICRwYWdlLCBiYXJzICkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gd2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIHx8IHt9O1xyXG5cdFx0dmFyIGxhYmVscyA9IHNldHRpbmdzLmkxOG4gfHwge307XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX2JhcltkYXRhLXdwYmMtdHMtc291cmNlPVwic2VydmVyXCJdJyApLnJlbW92ZSgpO1xyXG5cclxuXHRcdCQuZWFjaCggYmFycyB8fCB7fSwgZnVuY3Rpb24gKCBkYXRlLCByZXNvdXJjZXMgKSB7XHJcblx0XHRcdHZhciAkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtZGF0ZT1cIicgKyBkYXRlICsgJ1wiXScgKTtcclxuXHJcblx0XHRcdGlmICggISAkcm93Lmxlbmd0aCB8fCAhIHJlc291cmNlcyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCQuZWFjaCggcmVzb3VyY2VzLCBmdW5jdGlvbiAoIHJlc291cmNlSWQsIHJlc291cmNlQmFycyApIHtcclxuXHRcdFx0XHQkLmVhY2goIHJlc291cmNlQmFycyB8fCBbXSwgZnVuY3Rpb24gKCBpbmRleCwgaW50ZXJ2YWwgKSB7XHJcblx0XHRcdFx0XHR2YXIgdHlwZSA9ICdibG9ja2VkJyA9PT0gaW50ZXJ2YWwudHlwZSA/ICdibG9ja2VkJyA6ICggJ3VuYXZhaWxhYmxlX2RheScgPT09IGludGVydmFsLnR5cGUgPyAndW5hdmFpbGFibGVfZGF5JyA6ICggJ3dvcmtpbmdfdGltZScgPT09IGludGVydmFsLnR5cGUgPyAnd29ya2luZ190aW1lJyA6ICdib29rZWQnICkgKTtcclxuXHRcdFx0XHRcdHZhciBpY29uID0gJ2Jvb2tlZCcgPT09IHR5cGUgPyAnd3BiY19pY25fbG9jaycgOiAoICd1bmF2YWlsYWJsZV9kYXknID09PSB0eXBlID8gJ3dwYmNfaWNuX2V2ZW50X2J1c3knIDogKCAnd29ya2luZ190aW1lJyA9PT0gdHlwZSA/ICd3cGJjLWJpLWNsb2NrLWhpc3RvcnknIDogJ3dwYmNfaWNuX2RvX25vdF9kaXN0dXJiX29uJyApICk7XHJcblx0XHRcdFx0XHR2YXIgdG9vbHRpcCA9IGludGVydmFsLnRvb2x0aXAgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgJGJhciA9ICQoICc8ZGl2IGNsYXNzPVwid3BiY190c19iYXJcIiBkYXRhLXdwYmMtdHMtc291cmNlPVwic2VydmVyXCI+PC9kaXY+JyApO1xyXG5cdFx0XHRcdFx0dmFyICRpY29uV3JhcDtcclxuXHJcblx0XHRcdFx0XHRpZiAoICdib29rZWQnID09PSB0eXBlICYmIGludGVydmFsLmJvb2tpbmdfdXJsICkge1xyXG5cdFx0XHRcdFx0XHQkaWNvbldyYXAgPSAkKCAnPGEgY2xhc3M9XCJ3cGJjX3RzX2Jvb2tpbmdfbGluayB0b29sdGlwX3RvcFwiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj48c3Bhbj48L3NwYW4+PC9hPicgKTtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdocmVmJywgaW50ZXJ2YWwuYm9va2luZ191cmwgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnLCBpbnRlcnZhbC5ib29raW5nX2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2FyaWEtbGFiZWwnLCAoIGxhYmVscy5vcGVuX2Jvb2tpbmcgfHwgJ09wZW4gYm9va2luZyBpbiBCb29raW5nIExpc3RpbmcnICkgKyAoIGludGVydmFsLmJvb2tpbmdfaWQgPyAnOiAnICsgaW50ZXJ2YWwuYm9va2luZ19pZCA6ICcnICkgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS1vcmlnaW5hbC10aXRsZScsIHRvb2x0aXAgfHwgJycgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoICggJ3VuYXZhaWxhYmxlX2RheScgPT09IHR5cGUgfHwgJ3dvcmtpbmdfdGltZScgPT09IHR5cGUgKSAmJiBpbnRlcnZhbC5ydWxlX3VybCApIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxhIGNsYXNzPVwid3BiY190c19ydWxlX2xpbmsgdG9vbHRpcF90b3BcIj48c3Bhbj48L3NwYW4+PC9hPicgKTtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdocmVmJywgaW50ZXJ2YWwucnVsZV91cmwgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJ1bGUtc291cmNlJywgaW50ZXJ2YWwucnVsZV9zb3VyY2UgfHwgaW50ZXJ2YWwuc291cmNlX3R5cGUgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnYXJpYS1sYWJlbCcsICggbGFiZWxzLm9wZW5fYXZhaWxhYmlsaXR5X3J1bGUgfHwgJ09wZW4gYXZhaWxhYmlsaXR5IHNldHRpbmdzJyApICsgKCBpbnRlcnZhbC5zdGF0dXNfdGl0bGUgPyAnOiAnICsgaW50ZXJ2YWwuc3RhdHVzX3RpdGxlIDogJycgKSApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgdG9vbHRpcCB8fCAnJyApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxzcGFuIGNsYXNzPVwid3BiY190c19iYXJfaWNvbiB0b29sdGlwX3RvcFwiPjxzcGFuPjwvc3Bhbj48L3NwYW4+JyApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgdG9vbHRpcCB8fCAnJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdCRiYXJcclxuXHRcdFx0XHRcdFx0LmFkZENsYXNzKCAnd3BiY190c19iYXJfJyArIHR5cGUgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcsIHBhcnNlSW50KCBpbnRlcnZhbC5zdGFydF9taW51dGUsIDEwICkgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnLCBwYXJzZUludCggaW50ZXJ2YWwuZW5kX21pbnV0ZSwgMTAgKSApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJlc291cmNlLWlkJywgcmVzb3VyY2VJZCApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnLCBpbnRlcnZhbC5ib29raW5nX2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtYm9va2luZy11cmwnLCBpbnRlcnZhbC5ib29raW5nX3VybCB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJ1bGUtdXJsJywgaW50ZXJ2YWwucnVsZV91cmwgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy11bmF2YWlsYWJsZS1pZCcsIGludGVydmFsLnVuYXZhaWxhYmxlX3RpbWVzbG90X2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc291cmNlLXR5cGUnLCBpbnRlcnZhbC5zb3VyY2VfdHlwZSB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWVkaXRhYmxlJywgZmFsc2UgPT09IGludGVydmFsLmVkaXRhYmxlID8gJzAnIDogJzEnICk7XHJcblx0XHRcdFx0XHRpZiAoIHRvb2x0aXAgKSB7XHJcblx0XHRcdFx0XHRcdCRiYXIuYXR0ciggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnLCB0b29sdGlwICkuYWRkQ2xhc3MoICd0b29sdGlwX3RvcCcgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCRpY29uV3JhcC5maW5kKCAnc3BhbicgKS5hZGRDbGFzcyggaWNvbiApO1xyXG5cdFx0XHRcdFx0JGJhci5hcHBlbmQoICRpY29uV3JhcCApO1xyXG5cdFx0XHRcdFx0JHJvdy5maW5kKCAnLndwYmNfdHNfbGFuZScgKS5hcHBlbmQoICRiYXIgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRwb3NpdGlvbl9iYXJzKCAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKSApO1xyXG5cdFx0cmVmcmVzaF9iYXJfdG9vbHRpcHMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfcGFnZSB8fCB7fTtcclxuXHRcdHZhciAkZGF0ZVJhbmdlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciBsYWJlbHMgPSBzZXR0aW5ncy5pMThuIHx8IHt9O1xyXG5cdFx0dmFyIHJlcXVlc3RJZDtcclxuXHJcblx0XHRpZiAoICEgc2V0dGluZ3MuYWpheF91cmwgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGFjdGl2ZUxvYWRSZXF1ZXN0ICYmIGFjdGl2ZUxvYWRSZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgKSB7XHJcblx0XHRcdGFjdGl2ZUxvYWRSZXF1ZXN0LmFib3J0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVxdWVzdElkID0gKythY3RpdmVMb2FkUmVxdWVzdElkO1xyXG5cdFx0c2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCB0cnVlLCBsYWJlbHMubG9hZGluZyB8fCAnTG9hZGluZycgKTtcclxuXHJcblx0XHRhY3RpdmVMb2FkUmVxdWVzdCA9ICQucG9zdCggc2V0dGluZ3MuYWpheF91cmwsIHtcclxuXHRcdFx0YWN0aW9uOiAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX1RJTUVTTE9UU19SRUFEJyxcclxuXHRcdFx0bm9uY2U6IHNldHRpbmdzLm5vbmNlLFxyXG5cdFx0XHRyZXNvdXJjZV9pZDogZ2V0X2NvbnRyb2woICRwYWdlLCAncmVzb3VyY2UnICkudmFsKCksXHJcblx0XHRcdGRhdGVfc3RhcnQ6ICRkYXRlUmFuZ2UuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcgKSxcclxuXHRcdFx0ZGF0ZV9lbmQ6ICRkYXRlUmFuZ2UuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnIClcclxuXHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xyXG5cdFx0XHRpZiAoIHJlcXVlc3RJZCAhPT0gYWN0aXZlTG9hZFJlcXVlc3RJZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICYmIHJlc3BvbnNlLmRhdGEgKSB7XHJcblx0XHRcdFx0cmVuZGVyX3RpbWVsaW5lX2JhcnMoICRwYWdlLCByZXNwb25zZS5kYXRhLmJhcnMgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICggeGhyLCB0ZXh0U3RhdHVzICkge1xyXG5cdFx0XHRpZiAoICdhYm9ydCcgIT09IHRleHRTdGF0dXMgJiYgd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuc2F2ZV9lcnJvciB8fCAnVW5hYmxlIHRvIHNhdmUgdGltZS1zbG90IGF2YWlsYWJpbGl0eS4nLCAnZXJyb3InLCA1MDAwICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCByZXF1ZXN0SWQgPT09IGFjdGl2ZUxvYWRSZXF1ZXN0SWQgKSB7XHJcblx0XHRcdFx0c2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCBmYWxzZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfcm93c19iZXR3ZWVuKCAkcGFnZSwgc3RhcnRSb3csIGVuZFJvdyApIHtcclxuXHRcdHZhciBzdGFydEluZGV4ID0gcGFyc2VJbnQoIHN0YXJ0Um93LCAxMCApO1xyXG5cdFx0dmFyIGVuZEluZGV4ID0gcGFyc2VJbnQoIGVuZFJvdywgMTAgKTtcclxuXHRcdHZhciBtaW4gPSBNYXRoLm1pbiggc3RhcnRJbmRleCwgZW5kSW5kZXggKTtcclxuXHRcdHZhciBtYXggPSBNYXRoLm1heCggc3RhcnRJbmRleCwgZW5kSW5kZXggKTtcclxuXHRcdHZhciByb3dzID0gW107XHJcblx0XHR2YXIgaTtcclxuXHJcblx0XHRmb3IgKCBpID0gbWluOyBpIDw9IG1heDsgaSsrICkge1xyXG5cdFx0XHRpZiAoICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyBpICsgJ1wiXScgKS5sZW5ndGggKSB7XHJcblx0XHRcdFx0cm93cy5wdXNoKCBTdHJpbmcoIGkgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJvd3M7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByb3dfbGFiZWwoICRwYWdlLCByb3dJZCApIHtcclxuXHRcdHJldHVybiB0cmltX3RleHQoICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyByb3dJZCArICdcIl0gLndwYmNfdHNfcm93X2xhYmVsX3RleHQnICkudGV4dCgpICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlc2NhcGVfaHRtbCggdmFsdWUgKSB7XHJcblx0XHRyZXR1cm4gJCggJzxkaXYgLz4nICkudGV4dCggdmFsdWUgKS5odG1sKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwb3NpdGlvbl9sb2FkaW5nX292ZXJsYXkoICRwYWdlICkge1xyXG5cdFx0dmFyICRjYXJkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3RpbWVsaW5lX2NhcmQnICkuZmlyc3QoKTtcclxuXHRcdHZhciBjYXJkID0gJGNhcmQuZ2V0KCAwICk7XHJcblx0XHR2YXIgJG92ZXJsYXkgPSAkY2FyZC5maW5kKCAnLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApLmZpcnN0KCk7XHJcblxyXG5cdFx0aWYgKCAhIGNhcmQgfHwgISAkb3ZlcmxheS5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkb3ZlcmxheS5jc3MoIHtcclxuXHRcdFx0d2lkdGg6IGNhcmQuY2xpZW50V2lkdGggKyAncHgnLFxyXG5cdFx0XHRoZWlnaHQ6IGNhcmQuY2xpZW50SGVpZ2h0ICsgJ3B4JyxcclxuXHRcdFx0dHJhbnNmb3JtOiAndHJhbnNsYXRlKCcgKyBjYXJkLnNjcm9sbExlZnQgKyAncHgsJyArIGNhcmQuc2Nyb2xsVG9wICsgJ3B4KSdcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF90aW1lbGluZV9sb2FkaW5nKCAkcGFnZSwgaXNMb2FkaW5nLCBsYWJlbCApIHtcclxuXHRcdHZhciAkY2FyZCA9ICRwYWdlLmZpbmQoICcud3BiY190c190aW1lbGluZV9jYXJkJyApO1xyXG5cdFx0dmFyICRvdmVybGF5O1xyXG5cclxuXHRcdCRjYXJkXHJcblx0XHRcdC50b2dnbGVDbGFzcyggJ2lzLWxvYWRpbmcnLCAhISBpc0xvYWRpbmcgKVxyXG5cdFx0XHQuZmluZCggJy53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScgKVxyXG5cdFx0XHQuYXR0ciggJ2FyaWEtaGlkZGVuJywgaXNMb2FkaW5nID8gJ2ZhbHNlJyA6ICd0cnVlJyApO1xyXG5cclxuXHRcdGlmICggbGFiZWwgKSB7XHJcblx0XHRcdCRvdmVybGF5ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScgKS5maXJzdCgpO1xyXG5cdFx0XHQkb3ZlcmxheS5maW5kKCAnLndwYmNfc3BpbnNfbG9hZGluZ19jb250YWluZXIgPiBzcGFuJyApLnRleHQoIGxhYmVsICsgJy4uLicgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzTG9hZGluZyApIHtcclxuXHRcdFx0cG9zaXRpb25fbG9hZGluZ19vdmVybGF5KCAkcGFnZSApO1xyXG5cdFx0XHQkY2FyZC5vZmYoICdzY3JvbGwud3BiY190c19sb2FkaW5nX292ZXJsYXknICkub24oICdzY3JvbGwud3BiY190c19sb2FkaW5nX292ZXJsYXknLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cG9zaXRpb25fbG9hZGluZ19vdmVybGF5KCAkcGFnZSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkY2FyZC5vZmYoICdzY3JvbGwud3BiY190c19sb2FkaW5nX292ZXJsYXknICk7XHJcblx0XHRcdCRwYWdlLmZpbmQoICcud3BiY190c19sb2FkaW5nX292ZXJsYXknICkuY3NzKCB7XHJcblx0XHRcdFx0d2lkdGg6ICcnLFxyXG5cdFx0XHRcdGhlaWdodDogJycsXHJcblx0XHRcdFx0dHJhbnNmb3JtOiAnJ1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfYWN0aW9uX2J1dHRvbnNfYnVzeSggJHBhZ2UsIGlzQnVzeSApIHtcclxuXHRcdHZhciAkc2NvcGUgPSAkcGFnZS5hZGQoICRwYWdlLmNsb3Nlc3QoICcubW9kYWwnICkgKS5hZGQoICQoICcud3BiY190c19yaWdodGJhcl9wYW5lbHMnICkgKTtcclxuXHJcblx0XHQkc2NvcGVcclxuXHRcdFx0LmZpbmQoICdbZGF0YS13cGJjLXRzLWNvbW1hbmRdLCAud3BiY190c19jbGVhcl9zZWxlY3Rpb24nIClcclxuXHRcdFx0LnRvZ2dsZUNsYXNzKCAnZGlzYWJsZWQnLCAhISBpc0J1c3kgKVxyXG5cdFx0XHQuYXR0ciggJ2FyaWEtZGlzYWJsZWQnLCBpc0J1c3kgPyAndHJ1ZScgOiAnZmFsc2UnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19mdWxsX3BhZ2VfY29tcG9uZW50KCAkcGFnZSApIHtcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCEgJHBhZ2UuaGFzQ2xhc3MoICd3cGJjX3RzX3BvcHVwJyApXHJcblx0XHRcdCYmICRwYWdlLmNsb3Nlc3QoICcud3BiY19hZG1pbl9wYWdlX190YWJfX3RpbWVfc2xvdHNfYXZhaWxhYmlsaXR5JyApLmxlbmd0aCA+IDBcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZmxvYXRpbmdfaGVhZGVyX25hbWVzcGFjZSggJHBhZ2UgKSB7XHJcblx0XHRyZXR1cm4gJy53cGJjX3RzX2Zsb2F0aW5nXycgKyBTdHJpbmcoICRwYWdlLmF0dHIoICdkYXRhLXdwYmMtdHMtaWQtcHJlZml4JyApIHx8ICdwYWdlJyApLnJlcGxhY2UoIC9bXlxcd10vZywgJ18nICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfdG9wX25hdl9ib3R0b20oKSB7XHJcblx0XHR2YXIgJHRvcE5hdiA9ICQoICcud3BiY191aV9lbF9fdG9wX25hdjp2aXNpYmxlJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgcmVjdDtcclxuXHJcblx0XHRpZiAoICEgJHRvcE5hdi5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJlY3QgPSAkdG9wTmF2LmdldCggMCApLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0cmV0dXJuIE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCByZWN0LmJvdHRvbSApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBlbnN1cmVfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZmxvYXRpbmcgPSAkcGFnZS5jaGlsZHJlbiggJy53cGJjX3RzX2Zsb2F0aW5nX2hlYWRlcicgKTtcclxuXHRcdHZhciAkaGVhZGVyO1xyXG5cclxuXHRcdGlmICggJGZsb2F0aW5nLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuICRmbG9hdGluZztcclxuXHRcdH1cclxuXHJcblx0XHQkaGVhZGVyID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQgPiAud3BiY190c19oZWFkZXInICkuZmlyc3QoKTtcclxuXHRcdCRmbG9hdGluZyA9ICQoICc8ZGl2IGNsYXNzPVwid3BiY190c19mbG9hdGluZ19oZWFkZXJcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L2Rpdj4nICkuYXBwZW5kVG8oICRwYWdlICk7XHJcblxyXG5cdFx0aWYgKCAkaGVhZGVyLmxlbmd0aCApIHtcclxuXHRcdFx0JGZsb2F0aW5nLmFwcGVuZCggJGhlYWRlci5jbG9uZSggZmFsc2UsIGZhbHNlICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gJGZsb2F0aW5nO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICkge1xyXG5cdFx0dmFyICRmbG9hdGluZztcclxuXHRcdHZhciAkY2FyZDtcclxuXHRcdHZhciAkZ3JpZDtcclxuXHRcdHZhciAkaGVhZGVyO1xyXG5cdFx0dmFyIGNhcmQ7XHJcblx0XHR2YXIgY2FyZFJlY3Q7XHJcblx0XHR2YXIgaGVhZGVyUmVjdDtcclxuXHRcdHZhciB0b3BPZmZzZXQ7XHJcblx0XHR2YXIgc2hvdWxkU2hvdztcclxuXHJcblx0XHRpZiAoICEgaXNfZnVsbF9wYWdlX2NvbXBvbmVudCggJHBhZ2UgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRmbG9hdGluZyA9IGVuc3VyZV9mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0XHQkY2FyZCA9ICRwYWdlLmZpbmQoICcud3BiY190c190aW1lbGluZV9jYXJkJyApLmZpcnN0KCk7XHJcblx0XHQkZ3JpZCA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApLmZpcnN0KCk7XHJcblx0XHQkaGVhZGVyID0gJGdyaWQuZmluZCggJz4gLndwYmNfdHNfaGVhZGVyJyApLmZpcnN0KCk7XHJcblx0XHRjYXJkID0gJGNhcmQuZ2V0KCAwICk7XHJcblxyXG5cdFx0aWYgKCAhIGNhcmQgfHwgISAkZ3JpZC5sZW5ndGggfHwgISAkaGVhZGVyLmxlbmd0aCApIHtcclxuXHRcdFx0JGZsb2F0aW5nLnJlbW92ZUNsYXNzKCAnaXMtdmlzaWJsZScgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNhcmRSZWN0ID0gY2FyZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdGhlYWRlclJlY3QgPSAkaGVhZGVyLmdldCggMCApLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0dG9wT2Zmc2V0ID0gZ2V0X3RvcF9uYXZfYm90dG9tKCk7XHJcblx0XHRzaG91bGRTaG93ID0gKCBoZWFkZXJSZWN0LnRvcCA8IHRvcE9mZnNldCApICYmICggY2FyZFJlY3QuYm90dG9tID4gKCB0b3BPZmZzZXQgKyBoZWFkZXJSZWN0LmhlaWdodCApICk7XHJcblxyXG5cdFx0aWYgKCAhIHNob3VsZFNob3cgKSB7XHJcblx0XHRcdCRmbG9hdGluZy5yZW1vdmVDbGFzcyggJ2lzLXZpc2libGUnICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkZmxvYXRpbmdcclxuXHRcdFx0LmNzcygge1xyXG5cdFx0XHRcdHRvcDogdG9wT2Zmc2V0ICsgJ3B4JyxcclxuXHRcdFx0XHRsZWZ0OiBNYXRoLnJvdW5kKCBjYXJkUmVjdC5sZWZ0ICkgKyAncHgnLFxyXG5cdFx0XHRcdHdpZHRoOiBNYXRoLnJvdW5kKCBjYXJkLmNsaWVudFdpZHRoICkgKyAncHgnLFxyXG5cdFx0XHRcdCctLXdwYmMtdHMtZmxvYXRpbmctc2Nyb2xsLWxlZnQnOiAoIC0xICogY2FyZC5zY3JvbGxMZWZ0ICkgKyAncHgnLFxyXG5cdFx0XHRcdCctLXdwYmMtdHMtZmxvYXRpbmctc2Nyb2xsLWxlZnQtYWJzJzogY2FyZC5zY3JvbGxMZWZ0ICsgJ3B4J1xyXG5cdFx0XHR9IClcclxuXHRcdFx0LmFkZENsYXNzKCAnaXMtdmlzaWJsZScgKTtcclxuXHJcblx0XHQkZmxvYXRpbmcuY2hpbGRyZW4oICcud3BiY190c19oZWFkZXInICkuY3NzKCAnd2lkdGgnLCBNYXRoLnJvdW5kKCAkZ3JpZC5vdXRlcldpZHRoKCkgKSArICdweCcgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZnJlc2hfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZmxvYXRpbmc7XHJcblx0XHR2YXIgJGhlYWRlcjtcclxuXHJcblx0XHRpZiAoICEgJHBhZ2UgfHwgISAkcGFnZS5sZW5ndGggfHwgISBpc19mdWxsX3BhZ2VfY29tcG9uZW50KCAkcGFnZSApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZsb2F0aW5nID0gJHBhZ2UuY2hpbGRyZW4oICcud3BiY190c19mbG9hdGluZ19oZWFkZXInICk7XHJcblxyXG5cdFx0aWYgKCAhICRmbG9hdGluZy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkaGVhZGVyID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQgPiAud3BiY190c19oZWFkZXInICkuZmlyc3QoKTtcclxuXHRcdCRmbG9hdGluZy5lbXB0eSgpO1xyXG5cclxuXHRcdGlmICggJGhlYWRlci5sZW5ndGggKSB7XHJcblx0XHRcdCRmbG9hdGluZy5hcHBlbmQoICRoZWFkZXIuY2xvbmUoIGZhbHNlLCBmYWxzZSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBiaW5kX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKSB7XHJcblx0XHR2YXIgbmFtZXNwYWNlO1xyXG5cclxuXHRcdGlmICggISBpc19mdWxsX3BhZ2VfY29tcG9uZW50KCAkcGFnZSApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bmFtZXNwYWNlID0gZ2V0X2Zsb2F0aW5nX2hlYWRlcl9uYW1lc3BhY2UoICRwYWdlICk7XHJcblx0XHRlbnN1cmVfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cclxuXHRcdCQoIHdpbmRvdyApXHJcblx0XHRcdC5vZmYoICdzY3JvbGwnICsgbmFtZXNwYWNlICsgJyByZXNpemUnICsgbmFtZXNwYWNlIClcclxuXHRcdFx0Lm9uKCAnc2Nyb2xsJyArIG5hbWVzcGFjZSArICcgcmVzaXplJyArIG5hbWVzcGFjZSwgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX3RpbWVsaW5lX2NhcmQnIClcclxuXHRcdFx0Lm9mZiggJ3Njcm9sbCcgKyBuYW1lc3BhY2UgKVxyXG5cdFx0XHQub24oICdzY3JvbGwnICsgbmFtZXNwYWNlLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0c3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApXHJcblx0XHRcdC5vZmYoICdjbGljaycgKyBuYW1lc3BhY2UgKVxyXG5cdFx0XHQub24oICdjbGljaycgKyBuYW1lc3BhY2UsICcud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfbGVmdF92ZXJ0aWNhbF9uYXYsIC53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19yaWdodF92ZXJ0aWNhbF9uYXYsIC53cGJjX3VpX190b3BfbmF2X19idG5fZnVsbF9zY3JlZW4sIC53cGJjX3VpX190b3BfbmF2X19idG5fbm9ybWFsX3NjcmVlbicsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0c3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0XHRcdFx0fSwgODAgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVmcmVzaF9iYXJfdG9vbHRpcHMoICRwYWdlICkge1xyXG5cdFx0dmFyICR0b29sdGlwU2NvcGUgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfdGltZWxpbmVfY2FyZCcgKS5maXJzdCgpO1xyXG5cdFx0dmFyIHRvb2x0aXBTY29wZUlkO1xyXG5cdFx0dmFyIGRpZEluaXRpYWxpemVUb29sdGlwcyA9IGZhbHNlO1xyXG5cclxuXHRcdCRwYWdlLmZpbmQoICcud3BiY190c19iYXIudG9vbHRpcF90b3AsIC53cGJjX3RzX2Jhcl9pY29uLnRvb2x0aXBfdG9wLCAud3BiY190c19ib29raW5nX2xpbmsudG9vbHRpcF90b3AsIC53cGJjX3RzX3J1bGVfbGluay50b29sdGlwX3RvcCcgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggdGhpcy5fdGlwcHkgKSB7XHJcblx0XHRcdFx0dGhpcy5fdGlwcHkuZGVzdHJveSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzICkge1xyXG5cdFx0XHRpZiAoICR0b29sdGlwU2NvcGUubGVuZ3RoICkge1xyXG5cdFx0XHRcdHRvb2x0aXBTY29wZUlkID0gJHRvb2x0aXBTY29wZS5hdHRyKCAnaWQnICk7XHJcblxyXG5cdFx0XHRcdGlmICggISB0b29sdGlwU2NvcGVJZCApIHtcclxuXHRcdFx0XHRcdHRvb2x0aXBTY29wZUlkID0gJ3dwYmNfdHNfdGltZWxpbmVfdG9vbHRpcF9zY29wZV8nICsgbmV4dFRvb2x0aXBTY29wZUlkO1xyXG5cdFx0XHRcdFx0bmV4dFRvb2x0aXBTY29wZUlkKys7XHJcblx0XHRcdFx0XHQkdG9vbHRpcFNjb3BlLmF0dHIoICdpZCcsIHRvb2x0aXBTY29wZUlkICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRkaWRJbml0aWFsaXplVG9vbHRpcHMgPSB3aW5kb3cud3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMoICcjJyArIHRvb2x0aXBTY29wZUlkICsgJyAnICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggZGlkSW5pdGlhbGl6ZVRvb2x0aXBzICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdCRwYWdlLmZpbmQoICdbZGF0YS1vcmlnaW5hbC10aXRsZV0nICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoICEgJCggdGhpcyApLmF0dHIoICd0aXRsZScgKSApIHtcclxuXHRcdFx0XHQkKCB0aGlzICkuYXR0ciggJ3RpdGxlJywgJCggdGhpcyApLmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJyApICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGlzX2Jvb2tpbmdfbGlzdGluZ19zZWFyY2hfYXZhaWxhYmxlKCkge1xyXG5cdFx0cmV0dXJuIChcclxuXHRcdFx0J2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXNcclxuXHRcdFx0JiYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19saXN0aW5nXHJcblx0XHRcdCYmICQoICcjd3BiY19zZWFyY2hfZmllbGQnICkubGVuZ3RoXHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2xvc2VfdGltZV9zbG90c19wb3B1cCggJHBhZ2UsIGFmdGVyQ2xvc2UgKSB7XHJcblx0XHR2YXIgJG1vZGFsID0gJHBhZ2UuY2xvc2VzdCggJy53cGJjX21vZGFsX19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX19zZWN0aW9uLCAubW9kYWwnICk7XHJcblx0XHR2YXIgaXNDYWxsYmFja0RvbmUgPSBmYWxzZTtcclxuXHRcdHZhciBydW5fY2FsbGJhY2sgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggaXNDYWxsYmFja0RvbmUgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlzQ2FsbGJhY2tEb25lID0gdHJ1ZTtcclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGFmdGVyQ2xvc2UgKSB7XHJcblx0XHRcdFx0YWZ0ZXJDbG9zZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cclxuXHRcdGlmICggISAkbW9kYWwubGVuZ3RoICkge1xyXG5cdFx0XHRydW5fY2FsbGJhY2soKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISAkbW9kYWwuaXMoICc6dmlzaWJsZScgKSApIHtcclxuXHRcdFx0cnVuX2NhbGxiYWNrKCk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBhZnRlckNsb3NlICkge1xyXG5cdFx0XHQkbW9kYWwub25lKCAnaGlkZGVuLndwYmMubW9kYWwgaGlkZGVuLmJzLm1vZGFsJywgcnVuX2NhbGxiYWNrICk7XHJcblx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBydW5fY2FsbGJhY2ssIDUwMCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICRtb2RhbC53cGJjX215X21vZGFsICkge1xyXG5cdFx0XHQkbW9kYWwud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAkbW9kYWwubW9kYWwgKSB7XHJcblx0XHRcdCRtb2RhbC5tb2RhbCggJ2hpZGUnICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkbW9kYWwuZmluZCggJ1tkYXRhLWRpc21pc3M9XCJtb2RhbFwiXScgKS5maXJzdCgpLnRyaWdnZXIoICdjbGljaycgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNlYXJjaF9ib29raW5nX2luX2N1cnJlbnRfbGlzdGluZyggJHBhZ2UsIGJvb2tpbmdJZCApIHtcclxuXHRcdHZhciBrZXl3b3JkID0gJ2lkOicgKyBwYXJzZUludCggYm9va2luZ0lkLCAxMCApO1xyXG5cclxuXHRcdCQoICcjd3BiY19zZWFyY2hfZmllbGQnICkudmFsKCBrZXl3b3JkICk7XHJcblx0XHRjbG9zZV90aW1lX3Nsb3RzX3BvcHVwKCAkcGFnZSApO1xyXG5cdFx0d2luZG93LndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHQna2V5d29yZCc6IGtleXdvcmQsXHJcblx0XHRcdCdwYWdlX251bSc6IDFcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhhbmRsZV9ib29rZWRfYmFyX2NsaWNrKCAkcGFnZSwgZXZlbnQgKSB7XHJcblx0XHR2YXIgJGJhciA9ICQoIGV2ZW50LmN1cnJlbnRUYXJnZXQgKTtcclxuXHRcdHZhciAkbGluayA9ICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICcud3BiY190c19ib29raW5nX2xpbmsnICk7XHJcblx0XHR2YXIgYm9va2luZ0lkID0gJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnICkgfHwgJGxpbmsuYXR0ciggJ2RhdGEtd3BiYy10cy1ib29raW5nLWlkJyApO1xyXG5cdFx0dmFyIGJvb2tpbmdVcmwgPSAkYmFyLmF0dHIoICdkYXRhLXdwYmMtdHMtYm9va2luZy11cmwnICkgfHwgJGxpbmsuYXR0ciggJ2hyZWYnICk7XHJcblxyXG5cdFx0aWYgKCAhIGJvb2tpbmdJZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfYm9va2luZ19saXN0aW5nX3NlYXJjaF9hdmFpbGFibGUoKSApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHRcdHNlYXJjaF9ib29raW5nX2luX2N1cnJlbnRfbGlzdGluZyggJHBhZ2UsIGJvb2tpbmdJZCApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhICRsaW5rLmxlbmd0aCAmJiBib29raW5nVXJsICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IGJvb2tpbmdVcmw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1bmlxdWVfZGF0ZXNfZnJvbV9zZWxlY3Rpb25zKCAkcGFnZSApIHtcclxuXHRcdHZhciBkYXRlcyA9IHt9O1xyXG5cdFx0JC5lYWNoKCBzZWxlY3Rpb25SYW5nZXMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdCQuZWFjaCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0luZGV4LCByb3dJZCApIHtcclxuXHRcdFx0XHR2YXIgbGFiZWwgPSByb3dfbGFiZWwoICRwYWdlLCByb3dJZCApO1xyXG5cdFx0XHRcdGlmICggbGFiZWwgKSB7XHJcblx0XHRcdFx0XHRkYXRlc1sgbGFiZWwgXSA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblx0XHRyZXR1cm4gT2JqZWN0LmtleXMoIGRhdGVzICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX3BheWxvYWQoICRwYWdlICkge1xyXG5cdFx0dmFyIHBheWxvYWQgPSBbXTtcclxuXHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdHZhciAkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXScgKTtcclxuXHRcdFx0XHR2YXIgZGF0ZSA9ICRyb3cuYXR0ciggJ2RhdGEtd3BiYy10cy1kYXRlJyApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgZGF0ZSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHBheWxvYWQucHVzaCgge1xyXG5cdFx0XHRcdFx0ZGF0ZTogZGF0ZSxcclxuXHRcdFx0XHRcdHN0YXJ0X3NlY29uZDogaXRlbS5zdGFydCAqIDYwLFxyXG5cdFx0XHRcdFx0ZW5kX3NlY29uZDogaXRlbS5lbmQgKiA2MFxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHBheWxvYWQuc29ydCggZnVuY3Rpb24gKCBhLCBiICkge1xyXG5cdFx0XHRpZiAoIGEuZGF0ZSAhPT0gYi5kYXRlICkge1xyXG5cdFx0XHRcdHJldHVybiBhLmRhdGUgPCBiLmRhdGUgPyAtMSA6IDE7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBhLnN0YXJ0X3NlY29uZCAhPT0gYi5zdGFydF9zZWNvbmQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuc3RhcnRfc2Vjb25kIC0gYi5zdGFydF9zZWNvbmQ7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGEuZW5kX3NlY29uZCAtIGIuZW5kX3NlY29uZDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4gcGF5bG9hZDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9zZWxlY3Rpb25fZGF0ZXMoICRwYWdlLCByb3dzICkge1xyXG5cdFx0dmFyIGRhdGVzID0gW107XHJcblx0XHR2YXIgc2VlbiA9IHt9O1xyXG5cclxuXHRcdCQuZWFjaCggcm93cyB8fCBbXSwgZnVuY3Rpb24gKCByb3dJbmRleCwgcm93SWQgKSB7XHJcblx0XHRcdHZhciAkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXScgKTtcclxuXHRcdFx0dmFyIGRhdGUgPSAkcm93LmF0dHIoICdkYXRhLXdwYmMtdHMtZGF0ZScgKTtcclxuXHJcblx0XHRcdGlmICggZGF0ZSAmJiAhIHNlZW5bIGRhdGUgXSApIHtcclxuXHRcdFx0XHRzZWVuWyBkYXRlIF0gPSB0cnVlO1xyXG5cdFx0XHRcdGRhdGVzLnB1c2goIGRhdGUgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGRhdGVzLnNvcnQoKTtcclxuXHRcdHJldHVybiBkYXRlcztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9hY3RpdmVfYm9va2luZ19zZWxlY3Rpb25fY29udGV4dCggJHBhZ2UgKSB7XHJcblx0XHR2YXIgaXRlbSA9IGFjdGl2ZVNlbGVjdGlvbklkID8gZ2V0X3NlbGVjdGlvbl9ieV9pZCggYWN0aXZlU2VsZWN0aW9uSWQgKSA6IG51bGw7XHJcblx0XHR2YXIgZGF0ZXM7XHJcblxyXG5cdFx0aWYgKCAhIGl0ZW0gJiYgMSA9PT0gc2VsZWN0aW9uUmFuZ2VzLmxlbmd0aCApIHtcclxuXHRcdFx0aXRlbSA9IHNlbGVjdGlvblJhbmdlc1swXTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgaXRlbSB8fCAhIGl0ZW0ucm93cyB8fCAhIGl0ZW0ucm93cy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRhdGVzID0gZ2V0X3NlbGVjdGlvbl9kYXRlcyggJHBhZ2UsIGl0ZW0ucm93cyApO1xyXG5cdFx0aWYgKCAhIGRhdGVzLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0cmVzb3VyY2VfaWQ6IGdldF9jb250cm9sKCAkcGFnZSwgJ3Jlc291cmNlJyApLnZhbCgpIHx8ICcnLFxyXG5cdFx0XHRzZWxlY3RlZF9kYXRlOiBkYXRlc1swXSxcclxuXHRcdFx0c2VsZWN0ZWRfZGF0ZXM6IGRhdGVzLmpvaW4oICcsJyApLFxyXG5cdFx0XHRzZWxlY3RlZF90aW1lOiBtaW51dGVzX3RvX3RpbWUoIGl0ZW0uc3RhcnQgKSArICcgLSAnICsgbWludXRlc190b190aW1lKCBpdGVtLmVuZCApLFxyXG5cdFx0XHRzdGFydF9zZWNvbmQ6IGl0ZW0uc3RhcnQgKiA2MCxcclxuXHRcdFx0ZW5kX3NlY29uZDogaXRlbS5lbmQgKiA2MFxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNyZWF0ZV9ib29raW5nX2Zyb21fYWN0aXZlX3NlbGVjdGlvbiggJHBhZ2UgKSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSB3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3BhZ2UgfHwge307XHJcblx0XHR2YXIgbGFiZWxzID0gc2V0dGluZ3MuaTE4biB8fCB7fTtcclxuXHRcdHZhciBjb250ZXh0ID0gZ2V0X2FjdGl2ZV9ib29raW5nX3NlbGVjdGlvbl9jb250ZXh0KCAkcGFnZSApO1xyXG5cdFx0dmFyICRhZGRCb29raW5nTW9kYWwgPSAkKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xyXG5cclxuXHRcdGlmICggISBjb250ZXh0ICkge1xyXG5cdFx0XHRpZiAoIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbGFiZWxzLnNlbGVjdF9vbmVfc2xvdF9mb3JfYm9va2luZyB8fCAnU2VsZWN0IG9uZSB0aW1lIHJhbmdlIG9uIG9uZSBkYXRlIGZpcnN0LicsICd3YXJuaW5nJywgMzUwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cud3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsXHJcblx0XHRcdHx8ICEgJGFkZEJvb2tpbmdNb2RhbC5sZW5ndGhcclxuXHRcdFx0fHwgJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mICRhZGRCb29raW5nTW9kYWwud3BiY19teV9tb2RhbFxyXG5cdFx0KSB7XHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuYWRkX2Jvb2tpbmdfbW9kYWxfbWlzc2luZyB8fCAnQWRkIEJvb2tpbmcgcG9wdXAgaXMgbm90IGF2YWlsYWJsZSBvbiB0aGlzIHBhZ2UuJywgJ3dhcm5pbmcnLCA1MDAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGNsb3NlX3RpbWVfc2xvdHNfcG9wdXAoICRwYWdlLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHdpbmRvdy53cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwoIHtcclxuXHRcdFx0XHRtb2RlOiAnYWRkJyxcclxuXHRcdFx0XHRyZXNvdXJjZV9pZDogY29udGV4dC5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRib29raW5nX2Zvcm06ICcnLFxyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzOiBjb250ZXh0LnNlbGVjdGVkX2RhdGVzLFxyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGU6IGNvbnRleHQuc2VsZWN0ZWRfZGF0ZSxcclxuXHRcdFx0XHRzZWxlY3RlZF90aW1lOiBjb250ZXh0LnNlbGVjdGVkX3RpbWUsXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9lbmFibGVkOiAxLFxyXG5cdFx0XHRcdHRpbWVfb3ZlcnJpZGVfc291cmNlOiAndGltZXNfYXZhaWxhYmlsaXR5JyxcclxuXHRcdFx0XHR0aW1lX292ZXJyaWRlX3N0YXJ0OiBtaW51dGVzX3RvX3RpbWUoIGNvbnRleHQuc3RhcnRfc2Vjb25kIC8gNjAgKSxcclxuXHRcdFx0XHR0aW1lX292ZXJyaWRlX2VuZDogbWludXRlc190b190aW1lKCBjb250ZXh0LmVuZF9zZWNvbmQgLyA2MCApXHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsb25lX2RhdGUoIGRhdGUgKSB7XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoIGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYWRkX2RheXMoIGRhdGUsIGRheXMgKSB7XHJcblx0XHR2YXIgbmV4dCA9IGNsb25lX2RhdGUoIGRhdGUgKTtcclxuXHRcdG5leHQuc2V0RGF0ZSggbmV4dC5nZXREYXRlKCkgKyBkYXlzICk7XHJcblx0XHRyZXR1cm4gbmV4dDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGZvcm1hdF9pc29fZGF0ZSggZGF0ZSApIHtcclxuXHRcdHJldHVybiBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnLScgKyBwYWRfMiggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy0nICsgcGFkXzIoIGRhdGUuZ2V0RGF0ZSgpICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmb3JtYXRfcm93X2RhdGUoIGRhdGUgKSB7XHJcblx0XHR2YXIgZGF5cyA9IFsgJ1N1bicsICdNb24nLCAnVHVlJywgJ1dlZCcsICdUaHUnLCAnRnJpJywgJ1NhdCcgXTtcclxuXHRcdHZhciBtb250aHMgPSBbICdKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYycgXTtcclxuXHRcdHJldHVybiBkYXlzWyBkYXRlLmdldERheSgpIF0gKyAnICcgKyBtb250aHNbIGRhdGUuZ2V0TW9udGgoKSBdICsgJyAnICsgZGF0ZS5nZXREYXRlKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5KCBzdGFydERhdGUsIGVuZERhdGUgKSB7XHJcblx0XHRyZXR1cm4gJC5kYXRlcGljay5mb3JtYXREYXRlKCAnTSBkLCB5eScsIHN0YXJ0RGF0ZSApICsgJyAtICcgKyAkLmRhdGVwaWNrLmZvcm1hdERhdGUoICdNIGQsIHl5JywgZW5kRGF0ZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2FjaGVfcm93X3RlbXBsYXRlcyggJHBhZ2UgKSB7XHJcblx0XHRpZiAoIHJvd1RlbXBsYXRlcy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHJvd1RlbXBsYXRlcyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3cnICkuY2xvbmUoIGZhbHNlICkudG9BcnJheSgpO1xyXG5cdFx0JC5lYWNoKCByb3dUZW1wbGF0ZXMsIGZ1bmN0aW9uICggaW5kZXgsIHJvdyApIHtcclxuXHRcdFx0JCggcm93ICkuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5yZW1vdmUoKTtcclxuXHRcdFx0JCggcm93ICkuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZScgKS5yZW1vdmVDbGFzcyggJ2lzLXZpc2libGUgaXMtYWN0aXZlJyApLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZW5zdXJlX3Jvd19jb3VudCggJHBhZ2UsIGNvdW50ICkge1xyXG5cdFx0dmFyICRyb3dzV3JhcCA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dzJyApO1xyXG5cdFx0dmFyICRyb3dzID0gJHJvd3NXcmFwLmZpbmQoICcud3BiY190c19yb3cnICk7XHJcblx0XHR2YXIgaTtcclxuXHRcdHZhciAkY2xvbmU7XHJcblxyXG5cdFx0Y291bnQgPSBNYXRoLm1heCggMSwgY291bnQgKTtcclxuXHRcdGNhY2hlX3Jvd190ZW1wbGF0ZXMoICRwYWdlICk7XHJcblxyXG5cdFx0aWYgKCAkcm93cy5sZW5ndGggPiBjb3VudCApIHtcclxuXHRcdFx0JHJvd3Muc2xpY2UoIGNvdW50ICkucmVtb3ZlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICggaSA9ICRyb3dzV3JhcC5maW5kKCAnLndwYmNfdHNfcm93JyApLmxlbmd0aDsgaSA8IGNvdW50OyBpKysgKSB7XHJcblx0XHRcdCRjbG9uZSA9ICQoIHJvd1RlbXBsYXRlc1sgaSAlIHJvd1RlbXBsYXRlcy5sZW5ndGggXSApLmNsb25lKCBmYWxzZSApO1xyXG5cdFx0XHQkY2xvbmUuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5yZW1vdmUoKTtcclxuXHRcdFx0JGNsb25lLmZpbmQoICcud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUnICkucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlIGlzLWFjdGl2ZScgKS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdFx0JHJvd3NXcmFwLmFwcGVuZCggJGNsb25lICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHJvd3NXcmFwLmZpbmQoICcud3BiY190c19yb3cnICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApIHtcclxuXHRcdFx0JCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtcm93JywgU3RyaW5nKCBpbmRleCApICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfcm93c19mb3JfZGF0ZV9yYW5nZSggJHBhZ2UsIHN0YXJ0RGF0ZSwgZW5kRGF0ZSApIHtcclxuXHRcdHZhciBkYXlNcyA9IDI0ICogNjAgKiA2MCAqIDEwMDA7XHJcblx0XHR2YXIgZGF5c0NvdW50ID0gTWF0aC5yb3VuZCggKCBjbG9uZV9kYXRlKCBlbmREYXRlICkuZ2V0VGltZSgpIC0gY2xvbmVfZGF0ZSggc3RhcnREYXRlICkuZ2V0VGltZSgpICkgLyBkYXlNcyApICsgMTtcclxuXHJcblx0XHRkYXlzQ291bnQgPSBNYXRoLm1heCggMSwgZGF5c0NvdW50ICk7XHJcblx0XHRlbnN1cmVfcm93X2NvdW50KCAkcGFnZSwgZGF5c0NvdW50ICk7XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX3JvdycgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICkge1xyXG5cdFx0XHR2YXIgcm93RGF0ZSA9IGFkZF9kYXlzKCBzdGFydERhdGUsIGluZGV4ICk7XHJcblx0XHRcdCQoIHRoaXMgKVxyXG5cdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWRhdGUnLCBmb3JtYXRfaXNvX2RhdGUoIHJvd0RhdGUgKSApXHJcblx0XHRcdFx0LmZpbmQoICcud3BiY190c19yb3dfbGFiZWxfdGV4dCcgKS50ZXh0KCBmb3JtYXRfcm93X2RhdGUoIHJvd0RhdGUgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHNlbGVjdGlvblJhbmdlcyA9ICQuZ3JlcCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGl0ZW0gKSB7XHJcblx0XHRcdGl0ZW0ucm93cyA9ICQuZ3JlcCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0lkICkge1xyXG5cdFx0XHRcdHJldHVybiAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgcm93SWQgKyAnXCJdJyApLmxlbmd0aCA+IDA7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuIGl0ZW0ucm93cy5sZW5ndGggPiAwO1xyXG5cdFx0fSApO1xyXG5cdFx0Y2Fub25pY2FsaXplX3NlbGVjdGlvbnMoIGFjdGl2ZVNlbGVjdGlvbklkICk7XHJcblxyXG5cdFx0cG9zaXRpb25fYmFycyggJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICkgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdFx0c3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oIHN0cmluZ0RhdGVzLCBqc0RhdGVzQXJyICkge1xyXG5cdFx0dmFyIGRhdGVzID0gW107XHJcblx0XHR2YXIgcGFydHM7XHJcblx0XHR2YXIgc3RhcnQ7XHJcblx0XHR2YXIgZW5kO1xyXG5cclxuXHRcdGlmICgganNEYXRlc0FyciAmJiBBcnJheS5pc0FycmF5KCBqc0RhdGVzQXJyLnJhbmdlICkgKSB7XHJcblx0XHRcdGRhdGVzID0ganNEYXRlc0Fyci5yYW5nZTtcclxuXHRcdH0gZWxzZSBpZiAoIGpzRGF0ZXNBcnIgJiYgQXJyYXkuaXNBcnJheSgganNEYXRlc0Fyci5tdWx0aXBsZSApICkge1xyXG5cdFx0XHRkYXRlcyA9IGpzRGF0ZXNBcnIubXVsdGlwbGU7XHJcblx0XHR9IGVsc2UgaWYgKCBBcnJheS5pc0FycmF5KCBqc0RhdGVzQXJyICkgKSB7XHJcblx0XHRcdGRhdGVzID0ganNEYXRlc0FycjtcclxuXHRcdH1cclxuXHJcblx0XHRkYXRlcyA9ICQuZ3JlcCggZGF0ZXMsIGZ1bmN0aW9uICggZGF0ZSApIHtcclxuXHRcdFx0cmV0dXJuIGRhdGUgaW5zdGFuY2VvZiBEYXRlICYmICEgaXNOYU4oIGRhdGUuZ2V0VGltZSgpICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0aWYgKCBkYXRlcy5sZW5ndGggKSB7XHJcblx0XHRcdGRhdGVzLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApIHtcclxuXHRcdFx0XHRyZXR1cm4gY2xvbmVfZGF0ZSggYSApLmdldFRpbWUoKSAtIGNsb25lX2RhdGUoIGIgKS5nZXRUaW1lKCk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0c3RhcnQ6IGNsb25lX2RhdGUoIGRhdGVzWzBdICksXHJcblx0XHRcdFx0ZW5kOiBjbG9uZV9kYXRlKCBkYXRlc1sgZGF0ZXMubGVuZ3RoIC0gMSBdIClcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRwYXJ0cyA9IFN0cmluZyggc3RyaW5nRGF0ZXMgfHwgJycgKS5zcGxpdCggJyAtICcgKTtcclxuXHRcdHN0YXJ0ID0gcGFyc2VfZGF0ZV90ZXh0KCBwYXJ0c1swXSApO1xyXG5cdFx0ZW5kID0gcGFyc2VfZGF0ZV90ZXh0KCBwYXJ0c1sxXSB8fCBwYXJ0c1swXSApO1xyXG5cclxuXHRcdGlmICggc3RhcnQgJiYgZW5kICkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHN0YXJ0OiBzdGFydCxcclxuXHRcdFx0XHRlbmQ6IGVuZFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2RhdGVwaWNrX3NlbGVjdGVkX3JhbmdlKCAkZGF0ZSApIHtcclxuXHRcdHZhciBpbnN0O1xyXG5cclxuXHRcdGlmICggISAkLmRhdGVwaWNrIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiAkLmRhdGVwaWNrLl9nZXRJbnN0IHx8ICEgJGRhdGUubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRpbnN0ID0gJC5kYXRlcGljay5fZ2V0SW5zdCggJGRhdGVbMF0gKTtcclxuXHRcdGlmICggISBpbnN0ICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uKCAkZGF0ZS52YWwoKSwgJC5kYXRlcGljay5fZ2V0RGF0ZSggaW5zdCApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiggJHBhZ2UsIHJhbmdlLCBvcHRpb25zICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciBzdGFydERhdGU7XHJcblx0XHR2YXIgZW5kRGF0ZTtcclxuXHRcdHZhciBzdGFydElzbztcclxuXHRcdHZhciBlbmRJc287XHJcblx0XHR2YXIgY3VycmVudEtleTtcclxuXHRcdHZhciBuZXh0S2V5O1xyXG5cclxuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuXHRcdGlmICggISByYW5nZSB8fCAhIHJhbmdlLnN0YXJ0IHx8ICEgcmFuZ2UuZW5kICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhcnREYXRlID0gY2xvbmVfZGF0ZSggcmFuZ2Uuc3RhcnQgKTtcclxuXHRcdGVuZERhdGUgPSBjbG9uZV9kYXRlKCByYW5nZS5lbmQgKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0RGF0ZS5nZXRUaW1lKCkgPiBlbmREYXRlLmdldFRpbWUoKSApIHtcclxuXHRcdFx0cmFuZ2UgPSBzdGFydERhdGU7XHJcblx0XHRcdHN0YXJ0RGF0ZSA9IGVuZERhdGU7XHJcblx0XHRcdGVuZERhdGUgPSByYW5nZTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGFydElzbyA9IGZvcm1hdF9pc29fZGF0ZSggc3RhcnREYXRlICk7XHJcblx0XHRlbmRJc28gPSBmb3JtYXRfaXNvX2RhdGUoIGVuZERhdGUgKTtcclxuXHRcdGN1cnJlbnRLZXkgPSAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApICsgJzonICsgJGRhdGUuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICk7XHJcblx0XHRuZXh0S2V5ID0gc3RhcnRJc28gKyAnOicgKyBlbmRJc287XHJcblxyXG5cdFx0aWYgKCBjdXJyZW50S2V5ID09PSBuZXh0S2V5ICkge1xyXG5cdFx0XHQkZGF0ZS52YWwoIGZvcm1hdF9kYXRlX3JhbmdlX2Rpc3BsYXkoIHN0YXJ0RGF0ZSwgZW5kRGF0ZSApICk7XHJcblx0XHRcdGlmICggb3B0aW9ucy5mb3JjZV9yZWxvYWQgKSB7XHJcblx0XHRcdFx0bG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0JGRhdGVcclxuXHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnLCBzdGFydElzbyApXHJcblx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcsIGVuZElzbyApXHJcblx0XHRcdC52YWwoIGZvcm1hdF9kYXRlX3JhbmdlX2Rpc3BsYXkoIHN0YXJ0RGF0ZSwgZW5kRGF0ZSApICk7XHJcblxyXG5cdFx0dXBkYXRlX3Jvd3NfZm9yX2RhdGVfcmFuZ2UoICRwYWdlLCBzdGFydERhdGUsIGVuZERhdGUgKTtcclxuXHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX2RhdGVfcmFuZ2VfZnJvbV9pbnB1dCggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGRhdGUgPSBnZXRfY29udHJvbCggJHBhZ2UsICdkYXRlX3JhbmdlJyApO1xyXG5cdFx0dmFyIHJhbmdlID0gZ2V0X2RhdGVwaWNrX3NlbGVjdGVkX3JhbmdlKCAkZGF0ZSApIHx8IHBhcnNlX2RhdGVwaWNrX3NlbGVjdGlvbiggJGRhdGUudmFsKCksIG51bGwgKTtcclxuXHJcblx0XHRhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiggJHBhZ2UsIHJhbmdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZGF0ZV9yYW5nZV9mcm9tX2RhdGFfYXR0cnMoICRwYWdlICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciBzdGFydERhdGUgPSBwYXJzZV9kYXRlX3RleHQoICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICkgKTtcclxuXHRcdHZhciBlbmREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcgKSApO1xyXG5cclxuXHRcdGlmICggc3RhcnREYXRlICYmIGVuZERhdGUgKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0c3RhcnQ6IHN0YXJ0RGF0ZSxcclxuXHRcdFx0XHRlbmQ6IGVuZERhdGVcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jdXJyZW50X2RhdGVfcmFuZ2UoICRwYWdlICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciByYW5nZSA9IGdldF9kYXRlX3JhbmdlX2Zyb21fZGF0YV9hdHRycyggJHBhZ2UgKSB8fCBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oICRkYXRlLnZhbCgpLCBudWxsICk7XHJcblxyXG5cdFx0aWYgKCByYW5nZSApIHtcclxuXHRcdFx0cmV0dXJuIHJhbmdlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN0YXJ0OiBwYXJzZV9kYXRlX3RleHQoICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICkgKSxcclxuXHRcdFx0ZW5kOiBwYXJzZV9kYXRlX3RleHQoICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApIClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzaGlmdF9kYXRlX3JhbmdlKCAkcGFnZSwgZGlyZWN0aW9uICkge1xyXG5cdFx0dmFyIHJhbmdlID0gZ2V0X2N1cnJlbnRfZGF0ZV9yYW5nZSggJHBhZ2UgKTtcclxuXHRcdHZhciBkYXlNcyA9IDI0ICogNjAgKiA2MCAqIDEwMDA7XHJcblx0XHR2YXIgZGF5c0NvdW50O1xyXG5cdFx0dmFyIHNoaWZ0O1xyXG5cclxuXHRcdGlmICggISByYW5nZSB8fCAhIHJhbmdlLnN0YXJ0IHx8ICEgcmFuZ2UuZW5kICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF5c0NvdW50ID0gTWF0aC5yb3VuZCggKCBjbG9uZV9kYXRlKCByYW5nZS5lbmQgKS5nZXRUaW1lKCkgLSBjbG9uZV9kYXRlKCByYW5nZS5zdGFydCApLmdldFRpbWUoKSApIC8gZGF5TXMgKSArIDE7XHJcblx0XHRzaGlmdCA9IE1hdGgubWF4KCAxLCBkYXlzQ291bnQgKSAqICggJ3ByZXYnID09PSBkaXJlY3Rpb24gPyAtMSA6IDEgKTtcclxuXHJcblx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHRyZXR1cm4gYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCB7XHJcblx0XHRcdHN0YXJ0OiBhZGRfZGF5cyggcmFuZ2Uuc3RhcnQsIHNoaWZ0ICksXHJcblx0XHRcdGVuZDogYWRkX2RheXMoIHJhbmdlLmVuZCwgc2hpZnQgKVxyXG5cdFx0fSwge1xyXG5cdFx0XHRmb3JjZV9yZWxvYWQ6IHRydWVcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBhcnNlX2RhdGVfdGV4dCggdGV4dCApIHtcclxuXHRcdHZhciBwYXJzZWQ7XHJcblx0XHR2YXIgc3FsTWF0Y2g7XHJcblxyXG5cdFx0dGV4dCA9IHRyaW1fdGV4dCggdGV4dCApO1xyXG5cdFx0aWYgKCAhIHRleHQgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNxbE1hdGNoID0gdGV4dC5tYXRjaCggL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KS8gKTtcclxuXHRcdGlmICggc3FsTWF0Y2ggKSB7XHJcblx0XHRcdHJldHVybiBuZXcgRGF0ZSggcGFyc2VJbnQoIHNxbE1hdGNoWzFdLCAxMCApLCBwYXJzZUludCggc3FsTWF0Y2hbMl0sIDEwICkgLSAxLCBwYXJzZUludCggc3FsTWF0Y2hbM10sIDEwICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICQuZGF0ZXBpY2sgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICQuZGF0ZXBpY2sucGFyc2VEYXRlICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHBhcnNlZCA9ICQuZGF0ZXBpY2sucGFyc2VEYXRlKCAnTSBkLCB5eScsIHRleHQgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xyXG5cdFx0XHRcdHBhcnNlZCA9IG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgcGFyc2VkICkge1xyXG5cdFx0XHRwYXJzZWQgPSBuZXcgRGF0ZSggdGV4dCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwYXJzZWQgaW5zdGFuY2VvZiBEYXRlICYmICEgaXNOYU4oIHBhcnNlZC5nZXRUaW1lKCkgKSA/IGNsb25lX2RhdGUoIHBhcnNlZCApIDogbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF90aW1lX3Nsb3RzX2NvbnRleHQoIGNvbnRleHQsIG9wdGlvbnMgKSB7XHJcblx0XHR2YXIgJGNvbnRleHQgPSBjb250ZXh0ID8gJCggY29udGV4dCApIDogJCggZG9jdW1lbnQgKTtcclxuXHRcdHZhciAkcGFnZSA9ICRjb250ZXh0LmlzKCAnLndwYmNfdHNfcGFnZScgKSA/ICRjb250ZXh0IDogJGNvbnRleHQuZmluZCggJy53cGJjX3RzX3BhZ2UnICkuZmlyc3QoKTtcclxuXHRcdHZhciBzdGFydERhdGU7XHJcblx0XHR2YXIgZW5kRGF0ZTtcclxuXHRcdHZhciByZXNvdXJjZUNoYW5nZWQgPSBmYWxzZTtcclxuXHRcdHZhciByYW5nZUNoYW5nZWQgPSBmYWxzZTtcclxuXHJcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHJcblx0XHRpZiAoICEgJHBhZ2UubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5pdF90aW1lX3Nsb3RzX3BhZ2UoICRwYWdlLCB0cnVlICk7XHJcblxyXG5cdFx0aWYgKCBvcHRpb25zLnJlc291cmNlX2lkICkge1xyXG5cdFx0XHRyZXNvdXJjZUNoYW5nZWQgPSBTdHJpbmcoIGdldF9jb250cm9sKCAkcGFnZSwgJ3Jlc291cmNlJyApLnZhbCgpICkgIT09IFN0cmluZyggb3B0aW9ucy5yZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoIFN0cmluZyggb3B0aW9ucy5yZXNvdXJjZV9pZCApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhcnREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCBvcHRpb25zLmRhdGVfc3RhcnQgKTtcclxuXHRcdGVuZERhdGUgPSBwYXJzZV9kYXRlX3RleHQoIG9wdGlvbnMuZGF0ZV9lbmQgKSB8fCBzdGFydERhdGU7XHJcblxyXG5cdFx0aWYgKCBzdGFydERhdGUgJiYgZW5kRGF0ZSApIHtcclxuXHRcdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0XHRyYW5nZUNoYW5nZWQgPSBhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiggJHBhZ2UsIHtcclxuXHRcdFx0XHRzdGFydDogc3RhcnREYXRlLFxyXG5cdFx0XHRcdGVuZDogZW5kRGF0ZVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCByZXNvdXJjZUNoYW5nZWQgJiYgcmFuZ2VDaGFuZ2VkICkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHJlc291cmNlQ2hhbmdlZCB8fCAhIHJhbmdlQ2hhbmdlZCApIHtcclxuXHRcdFx0bG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJvd19mcm9tX3BvaW50ZXIoICRwYWdlLCBldmVudCApIHtcclxuXHRcdHZhciBvcmlnaW5hbCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQ7XHJcblx0XHR2YXIgcG9pbnQgPSBvcmlnaW5hbC50b3VjaGVzICYmIG9yaWdpbmFsLnRvdWNoZXMubGVuZ3RoID8gb3JpZ2luYWwudG91Y2hlc1swXSA6IG9yaWdpbmFsO1xyXG5cdFx0dmFyIGVsID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludCggcG9pbnQuY2xpZW50WCwgcG9pbnQuY2xpZW50WSApO1xyXG5cdFx0dmFyICRyb3cgPSAkKCBlbCApLmNsb3Nlc3QoICcud3BiY190c19yb3cnICk7XHJcblxyXG5cdFx0aWYgKCAhICRyb3cubGVuZ3RoIHx8ICEgJC5jb250YWlucyggJHBhZ2VbMF0sICRyb3dbMF0gKSApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICRyb3cuYXR0ciggJ2RhdGEtd3BiYy10cy1yb3cnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtaW51dGVfZnJvbV9wb2ludGVyKCBldmVudCwgJGxhbmUgKSB7XHJcblx0XHR2YXIgb3JpZ2luYWwgPSBldmVudC5vcmlnaW5hbEV2ZW50IHx8IGV2ZW50O1xyXG5cdFx0dmFyIHBvaW50ID0gb3JpZ2luYWwudG91Y2hlcyAmJiBvcmlnaW5hbC50b3VjaGVzLmxlbmd0aCA/IG9yaWdpbmFsLnRvdWNoZXNbMF0gOiBvcmlnaW5hbDtcclxuXHRcdHZhciAkZ3JpZCA9ICRsYW5lLmNsb3Nlc3QoICcud3BiY190c19ncmlkJyApO1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHRcdHZhciByZWN0ID0gJGxhbmVbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHR2YXIgcmF0aW8gPSAoIHBvaW50LmNsaWVudFggLSByZWN0LmxlZnQgKSAvIHJlY3Qud2lkdGg7XHJcblx0XHR2YXIgbWludXRlID0gY29uZmlnLnN0YXJ0ICsgcmF0aW8gKiAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKTtcclxuXHJcblx0XHRyZXR1cm4gY2xhbXAoIHNuYXBfbWludXRlKCBtaW51dGUsIGNvbmZpZy5zdGVwICksIGNvbmZpZy5zdGFydCwgY29uZmlnLmVuZCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY3JlYXRlX3NlbGVjdGlvbiggJHBhZ2UsIHJvd3MsIHN0YXJ0LCBlbmQgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblx0XHR2YXIgcmFuZ2UgPSBub3JtYWxpemVfc2VsZWN0aW9uX3JhbmdlKCBzdGFydCwgZW5kLCBjb25maWcgKTtcclxuXHRcdHZhciBpdGVtID0ge1xyXG5cdFx0XHRpZDogJ3NlbGVjdGlvbl8nICsgbmV4dFNlbGVjdGlvbklkKyssXHJcblx0XHRcdHN0YXJ0OiByYW5nZS5zdGFydCxcclxuXHRcdFx0ZW5kOiByYW5nZS5lbmQsXHJcblx0XHRcdHJvd3M6IHJvd3Muc2xpY2UoIDAgKVxyXG5cdFx0fTtcclxuXHJcblx0XHRzZWxlY3Rpb25SYW5nZXMucHVzaCggaXRlbSApO1xyXG5cdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSBpdGVtLmlkO1xyXG5cdFx0Y2Fub25pY2FsaXplX3NlbGVjdGlvbnMoIGl0ZW0uaWQgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdFx0cmV0dXJuIGdldF9zZWxlY3Rpb25fYnlfaWQoIGFjdGl2ZVNlbGVjdGlvbklkICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfc2VsZWN0aW9uKCAkcGFnZSwgc2VsZWN0aW9uSWQsIHJvd3MsIHN0YXJ0LCBlbmQgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblx0XHR2YXIgcmFuZ2UgPSBub3JtYWxpemVfc2VsZWN0aW9uX3JhbmdlKCBzdGFydCwgZW5kLCBjb25maWcgKTtcclxuXHRcdHZhciBpdGVtID0gZ2V0X3NlbGVjdGlvbl9ieV9pZCggc2VsZWN0aW9uSWQgKTtcclxuXHJcblx0XHRpZiAoICEgaXRlbSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGl0ZW0uc3RhcnQgPSByYW5nZS5zdGFydDtcclxuXHRcdGl0ZW0uZW5kID0gcmFuZ2UuZW5kO1xyXG5cdFx0aXRlbS5yb3dzID0gcm93cy5zbGljZSggMCApO1xyXG5cdFx0Y2Fub25pY2FsaXplX3NlbGVjdGlvbnMoIHNlbGVjdGlvbklkICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBwcmVmZXJyZWRBY3RpdmVJZCApIHtcclxuXHRcdHZhciBpbnRlcnZhbHMgPSBbXTtcclxuXHRcdHZhciBtZXJnZWQgPSBbXTtcclxuXHRcdHZhciBncm91cHMgPSBbXTtcclxuXHRcdHZhciBuZXdBY3RpdmVJZCA9ICcnO1xyXG5cclxuXHRcdCQuZWFjaCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHQkLmVhY2goIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJbmRleCwgcm93SWQgKSB7XHJcblx0XHRcdFx0aW50ZXJ2YWxzLnB1c2goIHtcclxuXHRcdFx0XHRcdHJvdzogcGFyc2VJbnQoIHJvd0lkLCAxMCApLFxyXG5cdFx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0XHRlbmQ6IGl0ZW0uZW5kLFxyXG5cdFx0XHRcdFx0YWN0aXZlOiBpdGVtLmlkID09PSBwcmVmZXJyZWRBY3RpdmVJZCB8fCBpdGVtLmlkID09PSBhY3RpdmVTZWxlY3Rpb25JZFxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGludGVydmFscy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKSB7XHJcblx0XHRcdGlmICggYS5yb3cgIT09IGIucm93ICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnJvdyAtIGIucm93O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYS5zdGFydCAhPT0gYi5zdGFydCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5zdGFydCAtIGIuc3RhcnQ7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGEuZW5kIC0gYi5lbmQ7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JC5lYWNoKCBpbnRlcnZhbHMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdHZhciBsYXN0ID0gbWVyZ2VkWyBtZXJnZWQubGVuZ3RoIC0gMSBdO1xyXG5cclxuXHRcdFx0aWYgKCBsYXN0ICYmIGxhc3Qucm93ID09PSBpdGVtLnJvdyAmJiBpdGVtLnN0YXJ0IDw9IGxhc3QuZW5kICkge1xyXG5cdFx0XHRcdGxhc3QuZW5kID0gTWF0aC5tYXgoIGxhc3QuZW5kLCBpdGVtLmVuZCApO1xyXG5cdFx0XHRcdGxhc3QuYWN0aXZlID0gbGFzdC5hY3RpdmUgfHwgaXRlbS5hY3RpdmU7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRtZXJnZWQucHVzaCgge1xyXG5cdFx0XHRcdHJvdzogaXRlbS5yb3csXHJcblx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRhY3RpdmU6IGl0ZW0uYWN0aXZlXHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRtZXJnZWQuc29ydCggZnVuY3Rpb24gKCBhLCBiICkge1xyXG5cdFx0XHRpZiAoIGEuc3RhcnQgIT09IGIuc3RhcnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuc3RhcnQgLSBiLnN0YXJ0O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYS5lbmQgIT09IGIuZW5kICkge1xyXG5cdFx0XHRcdHJldHVybiBhLmVuZCAtIGIuZW5kO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhLnJvdyAtIGIucm93O1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQuZWFjaCggbWVyZ2VkLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHR2YXIgbGFzdCA9IGdyb3Vwc1sgZ3JvdXBzLmxlbmd0aCAtIDEgXTtcclxuXHJcblx0XHRcdGlmICggbGFzdCAmJiBsYXN0LnN0YXJ0ID09PSBpdGVtLnN0YXJ0ICYmIGxhc3QuZW5kID09PSBpdGVtLmVuZCAmJiBsYXN0Lmxhc3RSb3cgKyAxID09PSBpdGVtLnJvdyApIHtcclxuXHRcdFx0XHRsYXN0LnJvd3MucHVzaCggU3RyaW5nKCBpdGVtLnJvdyApICk7XHJcblx0XHRcdFx0bGFzdC5sYXN0Um93ID0gaXRlbS5yb3c7XHJcblx0XHRcdFx0bGFzdC5hY3RpdmUgPSBsYXN0LmFjdGl2ZSB8fCBpdGVtLmFjdGl2ZTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGdyb3Vwcy5wdXNoKCB7XHJcblx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRyb3dzOiBbIFN0cmluZyggaXRlbS5yb3cgKSBdLFxyXG5cdFx0XHRcdGxhc3RSb3c6IGl0ZW0ucm93LFxyXG5cdFx0XHRcdGFjdGl2ZTogaXRlbS5hY3RpdmVcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHNlbGVjdGlvblJhbmdlcyA9ICQubWFwKCBncm91cHMsIGZ1bmN0aW9uICggaXRlbSApIHtcclxuXHRcdFx0dmFyIGlkID0gJ3NlbGVjdGlvbl8nICsgbmV4dFNlbGVjdGlvbklkKys7XHJcblxyXG5cdFx0XHRpZiAoIGl0ZW0uYWN0aXZlICYmICEgbmV3QWN0aXZlSWQgKSB7XHJcblx0XHRcdFx0bmV3QWN0aXZlSWQgPSBpZDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRpZDogaWQsXHJcblx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRyb3dzOiBpdGVtLnJvd3NcclxuXHRcdFx0fTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRhY3RpdmVTZWxlY3Rpb25JZCA9IG5ld0FjdGl2ZUlkIHx8ICggc2VsZWN0aW9uUmFuZ2VzWzBdID8gc2VsZWN0aW9uUmFuZ2VzWzBdLmlkIDogJycgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZ3JpZCA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApO1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHJcblx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfc2VsZWN0aW9uOm5vdCgud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUpJyApLnJlbW92ZSgpO1xyXG5cclxuXHRcdCQuZWFjaCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHR2YXIgcmFuZ2UgPSBub3JtYWxpemVfc2VsZWN0aW9uX3JhbmdlKCBpdGVtLnN0YXJ0LCBpdGVtLmVuZCwgY29uZmlnICk7XHJcblx0XHRcdHZhciBsZWZ0ID0gcGVyY2VudF9mb3JfbWludXRlKCByYW5nZS5zdGFydCwgY29uZmlnICk7XHJcblx0XHRcdHZhciB3aWR0aCA9IHBlcmNlbnRfZm9yX21pbnV0ZSggcmFuZ2UuZW5kLCBjb25maWcgKSAtIGxlZnQ7XHJcblxyXG5cdFx0XHRpdGVtLnN0YXJ0ID0gcmFuZ2Uuc3RhcnQ7XHJcblx0XHRcdGl0ZW0uZW5kID0gcmFuZ2UuZW5kO1xyXG5cclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdHZhciAkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXScgKTtcclxuXHRcdFx0XHR2YXIgJGxhbmUgPSAkcm93LmZpbmQoICcud3BiY190c19sYW5lJyApO1xyXG5cdFx0XHRcdHZhciAkdGVtcGxhdGUgPSAkbGFuZS5maW5kKCAnLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlJyApLmZpcnN0KCk7XHJcblx0XHRcdFx0dmFyICRzZWxlY3Rpb247XHJcblxyXG5cdFx0XHRcdGlmICggISAkbGFuZS5sZW5ndGggfHwgISAkdGVtcGxhdGUubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0JHNlbGVjdGlvbiA9ICR0ZW1wbGF0ZS5jbG9uZSggZmFsc2UgKTtcclxuXHRcdFx0XHRpZiAoICRzZWxlY3Rpb25bMF0gKSB7XHJcblx0XHRcdFx0XHQkc2VsZWN0aW9uWzBdLmhpZGRlbiA9IGZhbHNlO1xyXG5cdFx0XHRcdFx0JHNlbGVjdGlvblswXS5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQkc2VsZWN0aW9uXHJcblx0XHRcdFx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZScgKVxyXG5cdFx0XHRcdFx0LmFkZENsYXNzKCAnaXMtdmlzaWJsZScgKVxyXG5cdFx0XHRcdFx0LnRvZ2dsZUNsYXNzKCAnaXMtYWN0aXZlJywgaXRlbS5pZCA9PT0gYWN0aXZlU2VsZWN0aW9uSWQgKVxyXG5cdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc2VsZWN0aW9uLWlkJywgaXRlbS5pZCApXHJcblx0XHRcdFx0XHQuY3NzKCB7IGxlZnQ6IGxlZnQgKyAnJScsIHdpZHRoOiB3aWR0aCArICclJyB9ICk7XHJcblxyXG5cdFx0XHRcdCRzZWxlY3Rpb24uZmluZCggJy53cGJjX3RzX3RpbWVfY2hpcF9zdGFydCcgKS50ZXh0KCBtaW51dGVzX3RvX3RpbWUoIHJhbmdlLnN0YXJ0ICkgKTtcclxuXHRcdFx0XHQkc2VsZWN0aW9uLmZpbmQoICcud3BiY190c190aW1lX2NoaXBfZW5kJyApLnRleHQoIG1pbnV0ZXNfdG9fdGltZSggcmFuZ2UuZW5kICkgKTtcclxuXHRcdFx0XHQkbGFuZS5hcHBlbmQoICRzZWxlY3Rpb24gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHVwZGF0ZV9zdW1tYXJ5KCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApIHtcclxuXHRcdHNlbGVjdGlvblJhbmdlcyA9IFtdO1xyXG5cdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSAnJztcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3N1bW1hcnkoICRwYWdlICkge1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICkgKTtcclxuXHRcdHZhciBzbG90Q291bnQgPSAwO1xyXG5cdFx0dmFyIGRhdGVzID0ge307XHJcblx0XHR2YXIgZGF0ZXNDb3VudCA9IDA7XHJcblx0XHR2YXIgZGF0ZVRleHQgPSAnLSc7XHJcblx0XHR2YXIgdGltZVRleHQgPSAnLSc7XHJcblx0XHR2YXIgZGV0YWlscyA9IFtdO1xyXG5cdFx0dmFyIGRldGFpbHNIdG1sID0gJyc7XHJcblxyXG5cdFx0JC5lYWNoKCBzZWxlY3Rpb25SYW5nZXMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdHNsb3RDb3VudCArPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggKCBpdGVtLmVuZCAtIGl0ZW0uc3RhcnQgKSAvIGNvbmZpZy5zdGVwICkgKiBpdGVtLnJvd3MubGVuZ3RoICk7XHJcblxyXG5cdFx0XHQkLmVhY2goIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJbmRleCwgcm93SWQgKSB7XHJcblx0XHRcdFx0dmFyIGxhYmVsID0gcm93X2xhYmVsKCAkcGFnZSwgcm93SWQgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGxhYmVsICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZGF0ZXNbIGxhYmVsIF0gPSB0cnVlO1xyXG5cdFx0XHRcdGRldGFpbHMucHVzaCgge1xyXG5cdFx0XHRcdFx0cm93OiBwYXJzZUludCggcm93SWQsIDEwICksXHJcblx0XHRcdFx0XHRzdGFydDogaXRlbS5zdGFydCxcclxuXHRcdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0XHRsYWJlbDogbGFiZWxcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRkZXRhaWxzLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApIHtcclxuXHRcdFx0aWYgKCBhLnJvdyAhPT0gYi5yb3cgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEucm93IC0gYi5yb3c7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBhLnN0YXJ0ICE9PSBiLnN0YXJ0ICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnN0YXJ0IC0gYi5zdGFydDtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gYS5lbmQgLSBiLmVuZDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkLmVhY2goIGRldGFpbHMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdHZhciB0aW1lTGFiZWwgPSBtaW51dGVzX3RvX3RpbWUoIGl0ZW0uc3RhcnQgKSArICcgLSAnICsgbWludXRlc190b190aW1lKCBpdGVtLmVuZCApO1xyXG5cclxuXHRcdFx0ZGV0YWlsc0h0bWwgKz0gJzxkaXYgY2xhc3M9XCJ3cGJjX3RzX3NlbGVjdGlvbl9kZXRhaWxfaXRlbVwiPidcclxuXHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfc2VsZWN0aW9uX2RldGFpbF9kYXRlXCI+JyArIGVzY2FwZV9odG1sKCBpdGVtLmxhYmVsICkgKyAnPC9zcGFuPidcclxuXHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfc2VsZWN0aW9uX2RldGFpbF90aW1lXCI+JyArIGVzY2FwZV9odG1sKCB0aW1lTGFiZWwgKSArICc8L3NwYW4+J1xyXG5cdFx0XHRcdCsgJzwvZGl2Pic7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0ZGF0ZXNDb3VudCA9IE9iamVjdC5rZXlzKCBkYXRlcyApLmxlbmd0aDtcclxuXHJcblx0XHRpZiAoIHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKSB7XHJcblx0XHRcdGRhdGVUZXh0ID0gZGF0ZXNDb3VudCArICggMSA9PT0gZGF0ZXNDb3VudCA/ICcgZGF0ZScgOiAnIGRhdGVzJyApO1xyXG5cdFx0XHR0aW1lVGV4dCA9IHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKyAoIDEgPT09IHNlbGVjdGlvblJhbmdlcy5sZW5ndGggPyAnIGludGVydmFsJyA6ICcgaW50ZXJ2YWxzJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBkZXRhaWxzSHRtbCApIHtcclxuXHRcdFx0ZGV0YWlsc0h0bWwgPSAnPGRpdiBjbGFzcz1cIndwYmNfdHNfc2VsZWN0aW9uX2RldGFpbHNfZW1wdHlcIj5ObyB0aW1lIHNsb3RzIHNlbGVjdGVkLjwvZGl2Pic7XHJcblx0XHR9XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5maW5kKCAnW2RhdGEtd3BiYy10cy1kZXRhaWw9XCJzbG90c1wiXScgKS50ZXh0KCBzbG90Q291bnQgKTtcclxuXHRcdCQoIGRvY3VtZW50ICkuZmluZCggJ1tkYXRhLXdwYmMtdHMtZGV0YWlsPVwiZGF0ZXNcIl0nICkudGV4dCggZGF0ZVRleHQgKTtcclxuXHRcdCQoIGRvY3VtZW50ICkuZmluZCggJ1tkYXRhLXdwYmMtdHMtZGV0YWlsPVwidGltZVwiXScgKS50ZXh0KCB0aW1lVGV4dCApO1xyXG5cdFx0JCggZG9jdW1lbnQgKS5maW5kKCAnW2RhdGEtd3BiYy10cy1kZXRhaWw9XCJzZWxlY3Rpb25fbGlzdFwiXScgKS5odG1sKCBkZXRhaWxzSHRtbCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2hvd19saXZlX3RpcCggJHBhZ2UsIGV2ZW50ICkge1xyXG5cdFx0dmFyIG9yaWdpbmFsID0gZXZlbnQub3JpZ2luYWxFdmVudCB8fCBldmVudDtcclxuXHRcdHZhciBwb2ludCA9IG9yaWdpbmFsLnRvdWNoZXMgJiYgb3JpZ2luYWwudG91Y2hlcy5sZW5ndGggPyBvcmlnaW5hbC50b3VjaGVzWzBdIDogb3JpZ2luYWw7XHJcblx0XHR2YXIgJHRpcCA9ICRwYWdlLmZpbmQoICcud3BiY190c19saXZlX3RpcCcgKTtcclxuXHRcdHZhciBhY3RpdmUgPSBnZXRfc2VsZWN0aW9uX2J5X2lkKCBhY3RpdmVTZWxlY3Rpb25JZCApO1xyXG5cclxuXHRcdGlmICggISBhY3RpdmUgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJHRpcC5sZW5ndGggKSB7XHJcblx0XHRcdCR0aXAgPSAkKCAnPGRpdiBjbGFzcz1cIndwYmNfdHNfbGl2ZV90aXBcIj48L2Rpdj4nICkuYXBwZW5kVG8oICRwYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHRpcFxyXG5cdFx0XHQudGV4dCggbWludXRlc190b190aW1lKCBhY3RpdmUuc3RhcnQgKSArICcgLSAnICsgbWludXRlc190b190aW1lKCBhY3RpdmUuZW5kICkgKVxyXG5cdFx0XHQuY3NzKCB7XHJcblx0XHRcdFx0bGVmdDogcG9pbnQucGFnZVggKyAxMiArICdweCcsXHJcblx0XHRcdFx0dG9wOiBwb2ludC5wYWdlWSAtIDM4ICsgJ3B4J1xyXG5cdFx0XHR9IClcclxuXHRcdFx0LmFkZENsYXNzKCAnaXMtdmlzaWJsZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhpZGVfbGl2ZV90aXAoICRwYWdlICkge1xyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX2xpdmVfdGlwJyApLnJlbW92ZUNsYXNzKCAnaXMtdmlzaWJsZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfc2xvdF9zdGVwX2NvbnRyb2xzKCAkcGFnZSwgc3RlcCApIHtcclxuXHRcdGdldF9jb250cm9sKCAkcGFnZSwgJ3Nsb3Rfc3RlcCcgKS52YWwoIFN0cmluZyggc3RlcCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9zbG90X3N0ZXAnICkudmFsKCBTdHJpbmcoIHN0ZXAgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY196b29tX2NvbnRyb2xzKCAkcGFnZSwgc3RlcCApIHtcclxuXHRcdHZhciBpbmRleCA9IHpvb21TdGVwcy5pbmRleE9mKCBzdGVwICk7XHJcblx0XHRpZiAoIC0xID09PSBpbmRleCApIHtcclxuXHRcdFx0aW5kZXggPSAyO1xyXG5cdFx0fVxyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnem9vbScgKS52YWwoIFN0cmluZyggaW5kZXggKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfem9vbScgKS52YWwoIFN0cmluZyggaW5kZXggKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3N0ZXAoICRwYWdlLCBzdGVwICkge1xyXG5cdFx0dmFyICRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblx0XHQkZ3JpZC5hdHRyKCAnZGF0YS13cGJjLXRzLXN0ZXAnLCBzdGVwICk7XHJcblx0XHRzeW5jX3Nsb3Rfc3RlcF9jb250cm9scyggJHBhZ2UsIHN0ZXAgKTtcclxuXHRcdHN5bmNfem9vbV9jb250cm9scyggJHBhZ2UsIHN0ZXAgKTtcclxuXHRcdHJlbmRlcl9heGlzKCAkZ3JpZCApO1xyXG5cdFx0cG9zaXRpb25fYmFycyggJGdyaWQgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY192aXNpYmxlX3RpbWVfY29udHJvbHMoICRwYWdlLCBzdGFydCwgZW5kICkge1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X3N0YXJ0JyApLnZhbCggU3RyaW5nKCBzdGFydCApICk7XHJcblx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfZW5kJyApLnZhbCggU3RyaW5nKCBlbmQgKSApO1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X3N0YXJ0X3NsaWRlcicgKS52YWwoIFN0cmluZyggc3RhcnQgKSApO1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X2VuZF9zbGlkZXInICkudmFsKCBTdHJpbmcoIGVuZCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9zdGFydCcgKS52YWwoIFN0cmluZyggc3RhcnQgKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfZW5kJyApLnZhbCggU3RyaW5nKCBlbmQgKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfc3RhcnRfc2xpZGVyJyApLnZhbCggU3RyaW5nKCBzdGFydCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9lbmRfc2xpZGVyJyApLnZhbCggU3RyaW5nKCBlbmQgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3Zpc2libGVfdGltZV9yYW5nZSggJHBhZ2UsIHN0YXJ0LCBlbmQgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHJcblx0XHRzdGFydCA9IHBhcnNlSW50KCBzdGFydCwgMTAgKTtcclxuXHRcdGVuZCA9IHBhcnNlSW50KCBlbmQsIDEwICk7XHJcblxyXG5cdFx0aWYgKCBlbmQgPD0gc3RhcnQgKSB7XHJcblx0XHRcdGlmICggJCggZG9jdW1lbnQuYWN0aXZlRWxlbWVudCApLmlzKCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X3N0YXJ0XCJdLCBbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfc3RhcnRfc2xpZGVyXCJdLCAjd3BiY190c19kYXlfc3RhcnQsICN3cGJjX3RzX3NpZGVfc3RhcnQsICN3cGJjX3RzX2RheV9zdGFydF9zbGlkZXIsICN3cGJjX3RzX3NpZGVfc3RhcnRfc2xpZGVyJyApICkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoIDAsIGVuZCAtIDYwICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4oIDE0NDAsIHN0YXJ0ICsgNjAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdCRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnLCBzdGFydCApO1xyXG5cdFx0JGdyaWQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnLCBlbmQgKTtcclxuXHRcdHN5bmNfdmlzaWJsZV90aW1lX2NvbnRyb2xzKCAkcGFnZSwgc3RhcnQsIGVuZCApO1xyXG5cclxuXHRcdHJlbmRlcl9heGlzKCAkZ3JpZCApO1xyXG5cdFx0cG9zaXRpb25fYmFycyggJGdyaWQgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X21vZGUoIG1vZGUgKSB7XHJcblx0XHRjdXJyZW50TW9kZSA9IG1vZGU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19iYXJfc2VsZWN0YWJsZV9mb3JfdGltZV9hY3Rpb24oICRiYXIgKSB7XHJcblx0XHRpZiAoICEgJGJhci5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCRiYXIuaGFzQ2xhc3MoICd3cGJjX3RzX2Jhcl9ibG9ja2VkJyApXHJcblx0XHRcdCYmICcwJyAhPT0gJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLWVkaXRhYmxlJyApXHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcnVuX2NvbW1hbmQoICRwYWdlLCBtb2RlICkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gd2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIHx8IHt9O1xyXG5cdFx0dmFyIGxhYmVscyA9IHNldHRpbmdzLmkxOG4gfHwge307XHJcblx0XHR2YXIgcGF5bG9hZDtcclxuXHJcblx0XHRpZiAoIGFjdGl2ZVNhdmVSZXF1ZXN0ICYmIGFjdGl2ZVNhdmVSZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRzZXRfbW9kZSggbW9kZSApO1xyXG5cdFx0aWYgKCAhIHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKSB7XHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuc2VsZWN0X3Nsb3RzX2ZpcnN0IHx8ICdTZWxlY3Qgb25lIG9yIG1vcmUgdGltZSByYW5nZXMgZmlyc3QuJywgJ3dhcm5pbmcnLCAzNTAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBheWxvYWQgPSBnZXRfc2VsZWN0aW9uX3BheWxvYWQoICRwYWdlICk7XHJcblx0XHRpZiAoICEgc2V0dGluZ3MuYWpheF91cmwgfHwgISBzZXR0aW5ncy5ub25jZSB8fCAhIHBheWxvYWQubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCB0cnVlLCBsYWJlbHMuc2F2aW5nIHx8ICdTYXZpbmcnICk7XHJcblx0XHRzZXRfYWN0aW9uX2J1dHRvbnNfYnVzeSggJHBhZ2UsIHRydWUgKTtcclxuXHJcblx0XHRhY3RpdmVTYXZlUmVxdWVzdCA9ICQucG9zdCggc2V0dGluZ3MuYWpheF91cmwsIHtcclxuXHRcdFx0YWN0aW9uOiAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX1RJTUVTTE9UU19TQVZFJyxcclxuXHRcdFx0bm9uY2U6IHNldHRpbmdzLm5vbmNlLFxyXG5cdFx0XHRyZXNvdXJjZV9pZDogZ2V0X2NvbnRyb2woICRwYWdlLCAncmVzb3VyY2UnICkudmFsKCksXHJcblx0XHRcdG1vZGU6IG1vZGUsXHJcblx0XHRcdGludGVydmFsczogSlNPTi5zdHJpbmdpZnkoIHBheWxvYWQgKVxyXG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyApIHtcclxuXHRcdFx0XHRpZiAoIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnYmxvY2snID09PSBtb2RlID8gKCBsYWJlbHMuYmxvY2tfc3VjY2VzcyB8fCAnU2VsZWN0ZWQgdGltZSByYW5nZXMgaGF2ZSBiZWVuIGJsb2NrZWQuJyApIDogKCBsYWJlbHMudW5ibG9ja19zdWNjZXNzIHx8ICdTZWxlY3RlZCB0aW1lIHJhbmdlcyBoYXZlIGJlZW4gdW5ibG9ja2VkLicgKSwgJ3N1Y2Nlc3MnLCA1MDAwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdFx0XHRsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zYXZlX2Vycm9yIHx8ICdVbmFibGUgdG8gc2F2ZSB0aW1lLXNsb3QgYXZhaWxhYmlsaXR5LicsICdlcnJvcicsIDUwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zYXZlX2Vycm9yIHx8ICdVbmFibGUgdG8gc2F2ZSB0aW1lLXNsb3QgYXZhaWxhYmlsaXR5LicsICdlcnJvcicsIDUwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRhY3RpdmVTYXZlUmVxdWVzdCA9IG51bGw7XHJcblx0XHRcdHNldF9hY3Rpb25fYnV0dG9uc19idXN5KCAkcGFnZSwgZmFsc2UgKTtcclxuXHJcblx0XHRcdGlmICggISBhY3RpdmVMb2FkUmVxdWVzdCB8fCBhY3RpdmVMb2FkUmVxdWVzdC5yZWFkeVN0YXRlID09PSA0ICkge1xyXG5cdFx0XHRcdHNldF90aW1lbGluZV9sb2FkaW5nKCAkcGFnZSwgZmFsc2UsIGxhYmVscy5sb2FkaW5nIHx8ICdMb2FkaW5nJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X2RhdGVfcmFuZ2VfcGlja2VyKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgJGRhdGVXcmFwID0gJGRhdGUuY2xvc2VzdCggJy53cGJjX3RzX2lucHV0X2ljb24nICk7XHJcblx0XHR2YXIgZmlyc3REYXkgPSAwO1xyXG5cclxuXHRcdGlmICggISAkLmZuLmRhdGVwaWNrICkge1xyXG5cdFx0XHRpZiAoIHdpbmRvdy5jb25zb2xlICkge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKCAnV1BCQyBFcnJvci4gSmF2YVNjcmlwdCBsaWJyYXJ5IFwiZGF0ZXBpY2tcIiB3YXMgbm90IGRlZmluZWQuJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHdpbmRvdy5fd3BiYyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Ll93cGJjLmdldF9vdGhlcl9wYXJhbSApIHtcclxuXHRcdFx0Zmlyc3REYXkgPSBwYXJzZUludCggd2luZG93Ll93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2NhbGVuZGFyc19fZmlyc3RfZGF5JyApLCAxMCApIHx8IDA7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAkZGF0ZS5oYXNDbGFzcyggJC5kYXRlcGljay5tYXJrZXJDbGFzc05hbWUgKSApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQkZGF0ZS5kYXRlcGljayggJ2Rlc3Ryb3knICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0JGRhdGUuZGF0ZXBpY2soIHtcclxuXHRcdFx0YmVmb3JlU2hvd0RheTogZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHJldHVybiBbIHRydWUsICdkYXRlX2F2YWlsYWJsZScgXTtcclxuXHRcdFx0fSxcclxuXHRcdFx0b25TZWxlY3Q6IGZ1bmN0aW9uICggc3RyaW5nRGF0ZXMsIGpzRGF0ZXNBcnIgKSB7XHJcblx0XHRcdFx0YXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oIHN0cmluZ0RhdGVzLCBqc0RhdGVzQXJyICkgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0b25DbG9zZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRzeW5jX2RhdGVfcmFuZ2VfZnJvbV9pbnB1dCggJHBhZ2UgKTtcclxuXHRcdFx0XHR9LCAwICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdHNob3dPbjogJ25vbmUnLFxyXG5cdFx0XHRzaG93QW5pbTogJ3Nob3cnLFxyXG5cdFx0XHRkdXJhdGlvbjogJycsXHJcblx0XHRcdHJhbmdlU2VsZWN0OiB0cnVlLFxyXG5cdFx0XHRtdWx0aVNlbGVjdDogMCxcclxuXHRcdFx0bnVtYmVyT2ZNb250aHM6IDEsXHJcblx0XHRcdHN0ZXBNb250aHM6IDEsXHJcblx0XHRcdHByZXZUZXh0OiAnJmxzYXF1bzsnLFxyXG5cdFx0XHRuZXh0VGV4dDogJyZyc2FxdW87JyxcclxuXHRcdFx0ZGF0ZUZvcm1hdDogJ00gZCwgeXknLFxyXG5cdFx0XHRjaGFuZ2VNb250aDogZmFsc2UsXHJcblx0XHRcdGNoYW5nZVllYXI6IGZhbHNlLFxyXG5cdFx0XHRtaW5EYXRlOiBudWxsLFxyXG5cdFx0XHRtYXhEYXRlOiBudWxsLFxyXG5cdFx0XHRzaG93U3RhdHVzOiBmYWxzZSxcclxuXHRcdFx0bXVsdGlTZXBhcmF0b3I6ICcsICcsXHJcblx0XHRcdGNsb3NlQXRUb3A6IG51bGwsXHJcblx0XHRcdGZpcnN0RGF5OiBmaXJzdERheSxcclxuXHRcdFx0Z290b0N1cnJlbnQ6IGZhbHNlLFxyXG5cdFx0XHRoaWRlSWZOb1ByZXZOZXh0OiB0cnVlLFxyXG5cdFx0XHR1c2VUaGVtZVJvbGxlcjogZmFsc2UsXHJcblx0XHRcdG1hbmRhdG9yeTogdHJ1ZVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHNob3dfZGF0ZV9yYW5nZV9waWNrZXIoKSB7XHJcblx0XHRcdHZhciBpbnB1dCA9ICRkYXRlLmdldCggMCApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGlucHV0IHx8ICEgJC5kYXRlcGljayB8fCAhICQuZGF0ZXBpY2suX3Nob3dEYXRlcGljayB8fCAhICRkYXRlLmhhc0NsYXNzKCAkLmRhdGVwaWNrLm1hcmtlckNsYXNzTmFtZSApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAoICQuZGF0ZXBpY2suX2xhc3RJbnB1dCA9PT0gaW5wdXQgKSAmJiAhICQuZGF0ZXBpY2suX2RhdGVwaWNrZXJTaG93aW5nICkge1xyXG5cdFx0XHRcdCQuZGF0ZXBpY2suX2xhc3RJbnB1dCA9IG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggKCAkLmRhdGVwaWNrLl9sYXN0SW5wdXQgPT09IGlucHV0ICkgJiYgJC5kYXRlcGljay5fZGF0ZXBpY2tlclNob3dpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkLmRhdGVwaWNrLl9zaG93RGF0ZXBpY2soIGlucHV0ICk7XHJcblx0XHRcdCQoICcjZGF0ZXBpY2stZGl2LCAuZGF0ZXBpY2stcG9wdXAnICkuY3NzKCAnei1pbmRleCcsIDEwMDAwMTAgKTtcclxuXHRcdH1cclxuXHJcblx0XHQkZGF0ZS5vZmYoICdjbGljay53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbiBmb2N1cy53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbiBrZXlkb3duLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuJyApLm9uKCAnY2xpY2sud3BiY190c19kYXRlX3JhbmdlX29wZW4gZm9jdXMud3BiY190c19kYXRlX3JhbmdlX29wZW4ga2V5ZG93bi53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGlmICggJ2tleWRvd24nID09PSBldmVudC50eXBlICYmICggMTMgIT09IGV2ZW50LndoaWNoICkgJiYgKCAzMiAhPT0gZXZlbnQud2hpY2ggKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ2tleWRvd24nID09PSBldmVudC50eXBlICkge1xyXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNob3dfZGF0ZV9yYW5nZV9waWNrZXIoKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkZGF0ZVdyYXAub2ZmKCAnbW91c2Vkb3duLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuIGNsaWNrLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuJyApXHJcblx0XHRcdC5vbiggJ21vdXNlZG93bi53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQub24oICdjbGljay53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQgIT09ICRkYXRlLmdldCggMCApICkge1xyXG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdCRkYXRlLnRyaWdnZXIoICdmb2N1cycgKTtcclxuXHRcdFx0XHRzaG93X2RhdGVfcmFuZ2VfcGlja2VyKCk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHQkZGF0ZS5vbiggJ2NoYW5nZSBpbnB1dCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c3luY19kYXRlX3JhbmdlX2Zyb21faW5wdXQoICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X3JpZ2h0YmFyX3RhYnMoKSB7XHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfdHNfcmlnaHRiYXJfdGFicyBbcm9sZT1cInRhYlwiXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciAkdGFiID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgcGFuZWxJZCA9ICR0YWIuYXR0ciggJ2FyaWEtY29udHJvbHMnICk7XHJcblx0XHRcdHZhciAkcGFuZWwgPSAkKCAnIycgKyBwYW5lbElkICk7XHJcblx0XHRcdHZhciAkdGFibGlzdCA9ICR0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKTtcclxuXHJcblx0XHRcdGlmICggISAkcGFuZWwubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0JHRhYmxpc3QuZmluZCggJ1tyb2xlPVwidGFiXCJdJyApLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0XHQkdGFiLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XHJcblx0XHRcdCQoICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgLndwYmNfYmZiX19wYWxldHRlX3BhbmVsJyApLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0XHQkcGFuZWwuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHRoaXMuaGlkZGVuID0gZmFsc2U7XHJcblx0XHRcdFx0dGhpcy5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdH0gKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X3RpbWVfc2xvdHNfcGFnZSggY29udGV4dCwgZm9yY2UgKSB7XHJcblx0XHR2YXIgJGNvbnRleHQgPSBjb250ZXh0ID8gJCggY29udGV4dCApIDogJCggZG9jdW1lbnQgKTtcclxuXHRcdHZhciAkcGFnZXMgPSAkY29udGV4dC5pcyggJy53cGJjX3RzX3BhZ2UnICkgPyAkY29udGV4dCA6ICRjb250ZXh0LmZpbmQoICcud3BiY190c19wYWdlJyApO1xyXG5cclxuXHRcdGlmICggISAkcGFnZXMubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGZvcmNlICkge1xyXG5cdFx0XHQkcGFnZXMgPSAkcGFnZXMuZmlsdGVyKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cmV0dXJuICcwJyAhPT0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtYXV0by1pbml0JyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHBhZ2VzLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aW5pdF90aW1lX3Nsb3RzX2NvbXBvbmVudCggJCggdGhpcyApICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X3RpbWVfc2xvdHNfY29tcG9uZW50KCAkcGFnZSApIHtcclxuXHRcdHZhciAkZ3JpZDtcclxuXHRcdHZhciBpc0RyYWdnaW5nID0gZmFsc2U7XHJcblx0XHR2YXIgZHJhZ1N0YXJ0TWludXRlID0gMDtcclxuXHRcdHZhciBkcmFnU3RhcnRSb3cgPSBudWxsO1xyXG5cdFx0dmFyIGRyYWdTZWxlY3Rpb25JZCA9ICcnO1xyXG5cdFx0dmFyIHJlc2l6ZU1vZGUgPSAnJztcclxuXHJcblx0XHRpZiAoICRwYWdlLmF0dHIoICdkYXRhLXdwYmMtdHMtaW5pdGlhbGl6ZWQnICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdCRwYWdlLmF0dHIoICdkYXRhLXdwYmMtdHMtaW5pdGlhbGl6ZWQnLCAnMScgKTtcclxuXHJcblx0XHRjYWNoZV9yb3dfdGVtcGxhdGVzKCAkcGFnZSApO1xyXG5cdFx0JGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHJlbmRlcl9heGlzKCAkZ3JpZCApO1xyXG5cdFx0cG9zaXRpb25fYmFycyggJGdyaWQgKTtcclxuXHRcdGluaXRfZGF0ZV9yYW5nZV9waWNrZXIoICRwYWdlICk7XHJcblx0XHRsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApO1xyXG5cdFx0c2V0X21vZGUoIGN1cnJlbnRNb2RlICk7XHJcblx0XHRzeW5jX3Nsb3Rfc3RlcF9jb250cm9scyggJHBhZ2UsIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKS5zdGVwICk7XHJcblx0XHRzeW5jX3pvb21fY29udHJvbHMoICRwYWdlLCBnZXRfZ3JpZF9jb25maWcoICRncmlkICkuc3RlcCApO1xyXG5cdFx0c3luY192aXNpYmxlX3RpbWVfY29udHJvbHMoICRwYWdlLCBnZXRfZ3JpZF9jb25maWcoICRncmlkICkuc3RhcnQsIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKS5lbmQgKTtcclxuXHRcdGJpbmRfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtdHMtY29udHJvbD1cInNsb3Rfc3RlcFwiXSwgI3dwYmNfdHNfc2xvdF9zdGVwJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfc3RlcCggJHBhZ2UsIHBhcnNlSW50KCAkKCB0aGlzICkudmFsKCksIDEwICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJyN3cGJjX3RzX3NpZGVfc2xvdF9zdGVwJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfc3RlcCggJHBhZ2UsIHBhcnNlSW50KCAkKCB0aGlzICkudmFsKCksIDEwICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJyZXNvdXJjZVwiXSwgI3dwYmNfdHNfcmVzb3VyY2UnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdpbnB1dCBjaGFuZ2UnLCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiem9vbVwiXSwgI3dwYmNfdHNfem9vbScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGluZGV4ID0gcGFyc2VJbnQoICQoIHRoaXMgKS52YWwoKSwgMTAgKTtcclxuXHRcdFx0c2V0X3N0ZXAoICRwYWdlLCB6b29tU3RlcHNbIGluZGV4IF0gfHwgMTUgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJyN3cGJjX3RzX3NpZGVfem9vbScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGluZGV4ID0gcGFyc2VJbnQoICQoIHRoaXMgKS52YWwoKSwgMTAgKTtcclxuXHRcdFx0c2V0X3N0ZXAoICRwYWdlLCB6b29tU3RlcHNbIGluZGV4IF0gfHwgMTUgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdHMtem9vbV0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkem9vbSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ3pvb20nICk7XHJcblx0XHRcdHZhciB2YWx1ZSA9IHBhcnNlSW50KCAkem9vbS52YWwoKSwgMTAgKTtcclxuXHRcdFx0dmFsdWUgKz0gJ2luJyA9PT0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtem9vbScgKSA/IDEgOiAtMTtcclxuXHRcdFx0dmFsdWUgPSBjbGFtcCggdmFsdWUsIDAsIHpvb21TdGVwcy5sZW5ndGggLSAxICk7XHJcblx0XHRcdCR6b29tLnZhbCggU3RyaW5nKCB2YWx1ZSApICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzIFtkYXRhLXdwYmMtdHMtem9vbV0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkem9vbSA9ICQoICcjd3BiY190c19zaWRlX3pvb20nICk7XHJcblx0XHRcdHZhciB2YWx1ZSA9IHBhcnNlSW50KCAkem9vbS52YWwoKSwgMTAgKTtcclxuXHRcdFx0dmFsdWUgKz0gJ2luJyA9PT0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtem9vbScgKSA/IDEgOiAtMTtcclxuXHRcdFx0dmFsdWUgPSBjbGFtcCggdmFsdWUsIDAsIHpvb21TdGVwcy5sZW5ndGggLSAxICk7XHJcblx0XHRcdCR6b29tLnZhbCggU3RyaW5nKCB2YWx1ZSApICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfc3RhcnRcIl0sIFtkYXRhLXdwYmMtdHMtY29udHJvbD1cImRheV9lbmRcIl0sICN3cGJjX3RzX2RheV9zdGFydCwgI3dwYmNfdHNfZGF5X2VuZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X3Zpc2libGVfdGltZV9yYW5nZSggJHBhZ2UsIGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9zdGFydCcgKS52YWwoKSwgZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X2VuZCcgKS52YWwoKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfdHNfc2lkZV9zdGFydCwgI3dwYmNfdHNfc2lkZV9lbmQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF92aXNpYmxlX3RpbWVfcmFuZ2UoICRwYWdlLCAkKCAnI3dwYmNfdHNfc2lkZV9zdGFydCcgKS52YWwoKSwgJCggJyN3cGJjX3RzX3NpZGVfZW5kJyApLnZhbCgpICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdpbnB1dCBjaGFuZ2UnLCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X3N0YXJ0X3NsaWRlclwiXSwgW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X2VuZF9zbGlkZXJcIl0sICN3cGJjX3RzX2RheV9zdGFydF9zbGlkZXIsICN3cGJjX3RzX2RheV9lbmRfc2xpZGVyJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfdmlzaWJsZV90aW1lX3JhbmdlKCAkcGFnZSwgZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X3N0YXJ0X3NsaWRlcicgKS52YWwoKSwgZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X2VuZF9zbGlkZXInICkudmFsKCkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJyN3cGJjX3RzX3NpZGVfc3RhcnRfc2xpZGVyLCAjd3BiY190c19zaWRlX2VuZF9zbGlkZXInLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF92aXNpYmxlX3RpbWVfcmFuZ2UoICRwYWdlLCAkKCAnI3dwYmNfdHNfc2lkZV9zdGFydF9zbGlkZXInICkudmFsKCksICQoICcjd3BiY190c19zaWRlX2VuZF9zbGlkZXInICkudmFsKCkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdHMtY29tbWFuZF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRydW5fY29tbWFuZCggJHBhZ2UsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLWNvbW1hbmQnICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdHMtcmFuZ2Utc2hpZnRdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0c2hpZnRfZGF0ZV9yYW5nZSggJHBhZ2UsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXJhbmdlLXNoaWZ0JyApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICdbZGF0YS13cGJjLXRzLWNyZWF0ZS1ib29raW5nXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGNyZWF0ZV9ib29raW5nX2Zyb21fYWN0aXZlX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5jbG9zZXN0KCAnLm1vZGFsJyApLm9mZiggJ2NsaWNrLndwYmNfdHNfY3JlYXRlX2Jvb2tpbmcnICkub24oICdjbGljay53cGJjX3RzX2NyZWF0ZV9ib29raW5nJywgJ1tkYXRhLXdwYmMtdHMtY3JlYXRlLWJvb2tpbmddJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0Y3JlYXRlX2Jvb2tpbmdfZnJvbV9hY3RpdmVfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLmNsb3Nlc3QoICcubW9kYWwnICkub2ZmKCAnY2xpY2sud3BiY190c19mb290ZXJfY29tbWFuZCcgKS5vbiggJ2NsaWNrLndwYmNfdHNfZm9vdGVyX2NvbW1hbmQnLCAnW2RhdGEtd3BiYy10cy1jb21tYW5kXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdHJ1bl9jb21tYW5kKCAkcGFnZSwgJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtY29tbWFuZCcgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLmNsb3Nlc3QoICcubW9kYWwnICkub2ZmKCAnY2xpY2sud3BiY190c19mb290ZXJfY2xlYXInICkub24oICdjbGljay53cGJjX3RzX2Zvb3Rlcl9jbGVhcicsICcud3BiY190c19jbGVhcl9zZWxlY3Rpb24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICcud3BiY190c19iYXJfYm9va2VkJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0aGFuZGxlX2Jvb2tlZF9iYXJfY2xpY2soICRwYWdlLCBldmVudCApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub2ZmKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9jb21tYW5kJyApLm9uKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9jb21tYW5kJywgJy53cGJjX3RzX3JpZ2h0YmFyX3BhbmVscyBbZGF0YS13cGJjLXRzLWNvbW1hbmRdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0cnVuX2NvbW1hbmQoICRwYWdlLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1jb21tYW5kJyApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vZmYoICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX3JhbmdlX3NoaWZ0JyApLm9uKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9yYW5nZV9zaGlmdCcsICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgW2RhdGEtd3BiYy10cy1yYW5nZS1zaGlmdF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRzaGlmdF9kYXRlX3JhbmdlKCAkcGFnZSwgJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtcmFuZ2Utc2hpZnQnICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ21vdXNlZG93biB0b3VjaHN0YXJ0JywgJy53cGJjX3RzX2hhbmRsZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciAkc2VsZWN0aW9uID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY190c19zZWxlY3Rpb24nICk7XHJcblx0XHRcdHZhciAkbGFuZSA9ICRzZWxlY3Rpb24uY2xvc2VzdCggJy53cGJjX3RzX2xhbmUnICk7XHJcblx0XHRcdGlzRHJhZ2dpbmcgPSB0cnVlO1xyXG5cdFx0XHRyZXNpemVNb2RlID0gJCggdGhpcyApLmhhc0NsYXNzKCAnd3BiY190c19oYW5kbGVfc3RhcnQnICkgPyAnc3RhcnQnIDogJ2VuZCc7XHJcblx0XHRcdGFjdGl2ZVNlbGVjdGlvbklkID0gJHNlbGVjdGlvbi5hdHRyKCAnZGF0YS13cGJjLXRzLXNlbGVjdGlvbi1pZCcgKTtcclxuXHRcdFx0ZHJhZ1NlbGVjdGlvbklkID0gYWN0aXZlU2VsZWN0aW9uSWQ7XHJcblx0XHRcdGRyYWdTdGFydFJvdyA9ICRsYW5lLmNsb3Nlc3QoICcud3BiY190c19yb3cnICkuYXR0ciggJ2RhdGEtd3BiYy10cy1yb3cnICk7XHJcblx0XHRcdGRyYWdTdGFydE1pbnV0ZSA9IG1pbnV0ZV9mcm9tX3BvaW50ZXIoIGV2ZW50LCAkbGFuZSApO1xyXG5cdFx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdtb3VzZWRvd24gdG91Y2hzdGFydCcsICcud3BiY190c19zZWxlY3Rpb246bm90KC53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZSknLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRpZiAoICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICcud3BiY190c19oYW5kbGUnICkubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRhY3RpdmVTZWxlY3Rpb25JZCA9ICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXNlbGVjdGlvbi1pZCcgKTtcclxuXHRcdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnbW91c2Vkb3duIHRvdWNoc3RhcnQnLCAnLndwYmNfdHNfbGFuZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciAkbGFuZSA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyICRiYXJUYXJnZXQgPSAkKCBldmVudC50YXJnZXQgKS5jbG9zZXN0KCAnLndwYmNfdHNfYmFyJyApO1xyXG5cdFx0XHR2YXIgc3RlcDtcclxuXHJcblx0XHRcdGlmICggJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJGJhclRhcmdldC5sZW5ndGggJiYgISBpc19iYXJfc2VsZWN0YWJsZV9mb3JfdGltZV9hY3Rpb24oICRiYXJUYXJnZXQgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlzRHJhZ2dpbmcgPSB0cnVlO1xyXG5cdFx0XHRyZXNpemVNb2RlID0gJyc7XHJcblx0XHRcdGRyYWdTdGFydFJvdyA9ICRsYW5lLmNsb3Nlc3QoICcud3BiY190c19yb3cnICkuYXR0ciggJ2RhdGEtd3BiYy10cy1yb3cnICk7XHJcblx0XHRcdGRyYWdTdGFydE1pbnV0ZSA9IG1pbnV0ZV9mcm9tX3BvaW50ZXIoIGV2ZW50LCAkbGFuZSApO1xyXG5cdFx0XHRzdGVwID0gZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApLnN0ZXA7XHJcblx0XHRcdGRyYWdTZWxlY3Rpb25JZCA9IGNyZWF0ZV9zZWxlY3Rpb24oICRwYWdlLCBbIGRyYWdTdGFydFJvdyBdLCBkcmFnU3RhcnRNaW51dGUsIGRyYWdTdGFydE1pbnV0ZSArIHN0ZXAgKS5pZDtcclxuXHRcdFx0c2hvd19saXZlX3RpcCggJHBhZ2UsIGV2ZW50ICk7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ21vdXNlbW92ZS53cGJjX3RzIHRvdWNobW92ZS53cGJjX3RzJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0dmFyIGN1cnJlbnRSb3c7XHJcblx0XHRcdHZhciByb3dzO1xyXG5cdFx0XHR2YXIgJGxhbmU7XHJcblx0XHRcdHZhciBtaW51dGU7XHJcblx0XHRcdHZhciBpdGVtO1xyXG5cclxuXHRcdFx0aWYgKCAhIGlzRHJhZ2dpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpdGVtID0gZ2V0X3NlbGVjdGlvbl9ieV9pZCggZHJhZ1NlbGVjdGlvbklkICk7XHJcblx0XHRcdGlmICggISBpdGVtICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y3VycmVudFJvdyA9IHJvd19mcm9tX3BvaW50ZXIoICRwYWdlLCBldmVudCApIHx8IGRyYWdTdGFydFJvdztcclxuXHRcdFx0cm93cyA9IGdldF9yb3dzX2JldHdlZW4oICRwYWdlLCBkcmFnU3RhcnRSb3csIGN1cnJlbnRSb3cgKTtcclxuXHRcdFx0JGxhbmUgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgZHJhZ1N0YXJ0Um93ICsgJ1wiXSAud3BiY190c19sYW5lJyApO1xyXG5cdFx0XHRtaW51dGUgPSBtaW51dGVfZnJvbV9wb2ludGVyKCBldmVudCwgJGxhbmUgKTtcclxuXHJcblx0XHRcdGlmICggJ3N0YXJ0JyA9PT0gcmVzaXplTW9kZSApIHtcclxuXHRcdFx0XHR1cGRhdGVfc2VsZWN0aW9uKCAkcGFnZSwgaXRlbS5pZCwgaXRlbS5yb3dzLCBtaW51dGUsIGl0ZW0uZW5kICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoICdlbmQnID09PSByZXNpemVNb2RlICkge1xyXG5cdFx0XHRcdHVwZGF0ZV9zZWxlY3Rpb24oICRwYWdlLCBpdGVtLmlkLCBpdGVtLnJvd3MsIGl0ZW0uc3RhcnQsIG1pbnV0ZSApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHVwZGF0ZV9zZWxlY3Rpb24oICRwYWdlLCBpdGVtLmlkLCByb3dzLCBkcmFnU3RhcnRNaW51dGUsIG1pbnV0ZSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRyYWdTZWxlY3Rpb25JZCA9IGFjdGl2ZVNlbGVjdGlvbklkO1xyXG5cclxuXHRcdFx0c2hvd19saXZlX3RpcCggJHBhZ2UsIGV2ZW50ICk7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ21vdXNldXAud3BiY190cyB0b3VjaGVuZC53cGJjX3RzJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpc0RyYWdnaW5nID0gZmFsc2U7XHJcblx0XHRcdHJlc2l6ZU1vZGUgPSAnJztcclxuXHRcdFx0ZHJhZ1NlbGVjdGlvbklkID0gJyc7XHJcblx0XHRcdGhpZGVfbGl2ZV90aXAoICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICcud3BiY190c19jbGVhcl9zZWxlY3Rpb24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vZmYoICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX2NsZWFyJyApLm9uKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9jbGVhcicsICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgLndwYmNfdHNfY2xlYXJfc2VsZWN0aW9uJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0d2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0ID0gZnVuY3Rpb24gKCBjb250ZXh0ICkge1xyXG5cdFx0aW5pdF90aW1lX3Nsb3RzX3BhZ2UoIGNvbnRleHQgfHwgZG9jdW1lbnQsIHRydWUgKTtcclxuXHR9O1xyXG5cdHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfc2V0X2NvbnRleHQgPSBzZXRfdGltZV9zbG90c19jb250ZXh0O1xyXG5cclxuXHQkKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRpbml0X3JpZ2h0YmFyX3RhYnMoKTtcclxuXHRcdGluaXRfdGltZV9zbG90c19wYWdlKCBkb2N1bWVudCwgZmFsc2UgKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnd3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2luaXQnLCBmdW5jdGlvbiAoIGV2ZW50LCBjb250ZXh0ICkge1xyXG5cdFx0XHRpbml0X3RpbWVfc2xvdHNfcGFnZSggY29udGV4dCB8fCBkb2N1bWVudCwgdHJ1ZSApO1xyXG5cdFx0fSApO1xyXG5cdH0gKTtcclxufSggalF1ZXJ5ICkgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLENBQUMsRUFBRztFQUNoQixZQUFZOztFQUVaLElBQUlDLFNBQVMsR0FBRyxDQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUU7RUFDckMsSUFBSUMsV0FBVyxHQUFHLE9BQU87RUFDekIsSUFBSUMsZUFBZSxHQUFHLEVBQUU7RUFDeEIsSUFBSUMsaUJBQWlCLEdBQUcsRUFBRTtFQUMxQixJQUFJQyxZQUFZLEdB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
