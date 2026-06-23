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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktdGltZXNsb3RzL19vdXQvYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlLmpzIiwibmFtZXMiOlsiJCIsInpvb21TdGVwcyIsImN1cnJlbnRNb2RlIiwic2VsZWN0aW9uUmFuZ2VzIiwiYWN0aXZlU2VsZWN0aW9uSWQiLCJyb3dUZW1wbGF0ZXMiLCJuZXh0U2VsZWN0aW9uSWQiLCJuZXh0VG9vbHRpcFNjb3BlSWQiLCJhY3RpdmVMb2FkUmVxdWVzdCIsImFjdGl2ZUxvYWRSZXF1ZXN0SWQiLCJhY3RpdmVTYXZlUmVxdWVzdCIsInBhZF8yIiwidmFsdWUiLCJ0cmltX3RleHQiLCJTdHJpbmciLCJyZXBsYWNlIiwibWludXRlc190b190aW1lIiwibWludXRlcyIsImhvdXJzIiwiTWF0aCIsImZsb29yIiwibWlucyIsImNsYW1wIiwibWluIiwibWF4Iiwic25hcF9taW51dGUiLCJtaW51dGUiLCJzdGVwIiwicm91bmQiLCJnZXRfZ3JpZF9jb25maWciLCIkZ3JpZCIsInN0YXJ0IiwicGFyc2VJbnQiLCJhdHRyIiwiZW5kIiwiZ2V0X2NvbnRyb2wiLCIkcGFnZSIsIm5hbWUiLCIkY29udHJvbCIsImZpbmQiLCJmaXJzdCIsImxlbmd0aCIsInBlcmNlbnRfZm9yX21pbnV0ZSIsImNvbmZpZyIsIm5vcm1hbGl6ZV9zZWxlY3Rpb25fcmFuZ2UiLCJnZXRfc2VsZWN0aW9uX2J5X2lkIiwic2VsZWN0aW9uSWQiLCJmb3VuZCIsImVhY2giLCJpbmRleCIsIml0ZW0iLCJpZCIsInJlbmRlcl9heGlzIiwiJGF4aXMiLCJodG1sIiwic2xvdENvdW50IiwidmlzaWJsZUhvdXJzIiwiYXhpc0ZvbnRTaXplIiwiYXhpc0ZvbnRXZWlnaHQiLCJmaXJzdEhvdXIiLCJjZWlsIiwiY3NzIiwicmVmcmVzaF9mbG9hdGluZ19oZWFkZXIiLCJjbG9zZXN0IiwicG9zaXRpb25fYmFycyIsIiRiYXIiLCJ2aXNpYmxlU3RhcnQiLCJ2aXNpYmxlRW5kIiwibGVmdCIsIndpZHRoIiwiaGlkZSIsInNob3ciLCJyZW5kZXJfdGltZWxpbmVfYmFycyIsImJhcnMiLCJzZXR0aW5ncyIsIndpbmRvdyIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIiwibGFiZWxzIiwiaTE4biIsInJlbW92ZSIsImRhdGUiLCJyZXNvdXJjZXMiLCIkcm93IiwicmVzb3VyY2VJZCIsInJlc291cmNlQmFycyIsImludGVydmFsIiwidHlwZSIsImljb24iLCJ0b29sdGlwIiwiJGljb25XcmFwIiwiYm9va2luZ191cmwiLCJib29raW5nX2lkIiwib3Blbl9ib29raW5nIiwicnVsZV91cmwiLCJydWxlX3NvdXJjZSIsInNvdXJjZV90eXBlIiwib3Blbl9hdmFpbGFiaWxpdHlfcnVsZSIsInN0YXR1c190aXRsZSIsImFkZENsYXNzIiwic3RhcnRfbWludXRlIiwiZW5kX21pbnV0ZSIsInVuYXZhaWxhYmxlX3RpbWVzbG90X2lkIiwiZWRpdGFibGUiLCJhcHBlbmQiLCJyZWZyZXNoX2Jhcl90b29sdGlwcyIsImxvYWRfYmxvY2tlZF9pbnRlcnZhbHMiLCIkZGF0ZVJhbmdlIiwicmVxdWVzdElkIiwiYWpheF91cmwiLCJyZWFkeVN0YXRlIiwiYWJvcnQiLCJzZXRfdGltZWxpbmVfbG9hZGluZyIsImxvYWRpbmciLCJwb3N0IiwiYWN0aW9uIiwicmVzb3VyY2VfaWQiLCJ2YWwiLCJkYXRlX3N0YXJ0IiwiZGF0ZV9lbmQiLCJkb25lIiwicmVzcG9uc2UiLCJzdWNjZXNzIiwiZGF0YSIsImZhaWwiLCJ4aHIiLCJ0ZXh0U3RhdHVzIiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJzYXZlX2Vycm9yIiwiYWx3YXlzIiwiZ2V0X3Jvd3NfYmV0d2VlbiIsInN0YXJ0Um93IiwiZW5kUm93Iiwic3RhcnRJbmRleCIsImVuZEluZGV4Iiwicm93cyIsImkiLCJwdXNoIiwicm93X2xhYmVsIiwicm93SWQiLCJ0ZXh0IiwiZXNjYXBlX2h0bWwiLCJwb3NpdGlvbl9sb2FkaW5nX292ZXJsYXkiLCIkY2FyZCIsImNhcmQiLCJnZXQiLCIkb3ZlcmxheSIsImNsaWVudFdpZHRoIiwiaGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwidHJhbnNmb3JtIiwic2Nyb2xsTGVmdCIsInNjcm9sbFRvcCIsImlzTG9hZGluZyIsImxhYmVsIiwidG9nZ2xlQ2xhc3MiLCJvZmYiLCJvbiIsInNldF9hY3Rpb25fYnV0dG9uc19idXN5IiwiaXNCdXN5IiwiJHNjb3BlIiwiYWRkIiwiaXNfZnVsbF9wYWdlX2NvbXBvbmVudCIsImhhc0NsYXNzIiwiZ2V0X2Zsb2F0aW5nX2hlYWRlcl9uYW1lc3BhY2UiLCJnZXRfdG9wX25hdl9ib3R0b20iLCIkdG9wTmF2IiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsImJvdHRvbSIsImVuc3VyZV9mbG9hdGluZ19oZWFkZXIiLCIkZmxvYXRpbmciLCJjaGlsZHJlbiIsIiRoZWFkZXIiLCJhcHBlbmRUbyIsImNsb25lIiwic3luY19mbG9hdGluZ19oZWFkZXIiLCJjYXJkUmVjdCIsImhlYWRlclJlY3QiLCJ0b3BPZmZzZXQiLCJzaG91bGRTaG93IiwicmVtb3ZlQ2xhc3MiLCJ0b3AiLCJvdXRlcldpZHRoIiwiZW1wdHkiLCJiaW5kX2Zsb2F0aW5nX2hlYWRlciIsIm5hbWVzcGFjZSIsImRvY3VtZW50Iiwic2V0VGltZW91dCIsIiR0b29sdGlwU2NvcGUiLCJ0b29sdGlwU2NvcGVJZCIsImRpZEluaXRpYWxpemVUb29sdGlwcyIsIl90aXBweSIsImRlc3Ryb3kiLCJ3cGJjX2RlZmluZV90aXBweV90b29sdGlwcyIsImlzX2Jvb2tpbmdfbGlzdGluZ19zZWFyY2hfYXZhaWxhYmxlIiwid3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zIiwid3BiY19hanhfYm9va2luZ19saXN0aW5nIiwiY2xvc2VfdGltZV9zbG90c19wb3B1cCIsImFmdGVyQ2xvc2UiLCIkbW9kYWwiLCJpc0NhbGxiYWNrRG9uZSIsInJ1bl9jYWxsYmFjayIsImlzIiwib25lIiwid3BiY19teV9tb2RhbCIsIm1vZGFsIiwidHJpZ2dlciIsInNlYXJjaF9ib29raW5nX2luX2N1cnJlbnRfbGlzdGluZyIsImJvb2tpbmdJZCIsImtleXdvcmQiLCJoYW5kbGVfYm9va2VkX2Jhcl9jbGljayIsImV2ZW50IiwiY3VycmVudFRhcmdldCIsIiRsaW5rIiwidGFyZ2V0IiwiYm9va2luZ1VybCIsInByZXZlbnREZWZhdWx0Iiwic3RvcFByb3BhZ2F0aW9uIiwibG9jYXRpb24iLCJocmVmIiwidW5pcXVlX2RhdGVzX2Zyb21fc2VsZWN0aW9ucyIsImRhdGVzIiwicm93SW5kZXgiLCJPYmplY3QiLCJrZXlzIiwiZ2V0X3NlbGVjdGlvbl9wYXlsb2FkIiwicGF5bG9hZCIsInN0YXJ0X3NlY29uZCIsImVuZF9zZWNvbmQiLCJzb3J0IiwiYSIsImIiLCJnZXRfc2VsZWN0aW9uX2RhdGVzIiwic2VlbiIsImdldF9hY3RpdmVfYm9va2luZ19zZWxlY3Rpb25fY29udGV4dCIsInNlbGVjdGVkX2RhdGUiLCJzZWxlY3RlZF9kYXRlcyIsImpvaW4iLCJzZWxlY3RlZF90aW1lIiwiY3JlYXRlX2Jvb2tpbmdfZnJvbV9hY3RpdmVfc2VsZWN0aW9uIiwiY29udGV4dCIsIiRhZGRCb29raW5nTW9kYWwiLCJzZWxlY3Rfb25lX3Nsb3RfZm9yX2Jvb2tpbmciLCJ3cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwiLCJhZGRfYm9va2luZ19tb2RhbF9taXNzaW5nIiwibW9kZSIsImJvb2tpbmdfZm9ybSIsInRpbWVfb3ZlcnJpZGVfZW5hYmxlZCIsInRpbWVfb3ZlcnJpZGVfc291cmNlIiwidGltZV9vdmVycmlkZV9zdGFydCIsInRpbWVfb3ZlcnJpZGVfZW5kIiwiY2xvbmVfZGF0ZSIsIkRhdGUiLCJnZXRGdWxsWWVhciIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImFkZF9kYXlzIiwiZGF5cyIsIm5leHQiLCJzZXREYXRlIiwiZm9ybWF0X2lzb19kYXRlIiwiZm9ybWF0X3Jvd19kYXRlIiwibW9udGhzIiwiZ2V0RGF5IiwiZm9ybWF0X2RhdGVfcmFuZ2VfZGlzcGxheSIsInN0YXJ0RGF0ZSIsImVuZERhdGUiLCJkYXRlcGljayIsImZvcm1hdERhdGUiLCJjYWNoZV9yb3dfdGVtcGxhdGVzIiwidG9BcnJheSIsInJvdyIsImVuc3VyZV9yb3dfY291bnQiLCJjb3VudCIsIiRyb3dzV3JhcCIsIiRyb3dzIiwiJGNsb25lIiwic2xpY2UiLCJ1cGRhdGVfcm93c19mb3JfZGF0ZV9yYW5nZSIsImRheU1zIiwiZGF5c0NvdW50IiwiZ2V0VGltZSIsInJvd0RhdGUiLCJncmVwIiwiY2Fub25pY2FsaXplX3NlbGVjdGlvbnMiLCJyZW5kZXJfc2VsZWN0aW9ucyIsInBhcnNlX2RhdGVwaWNrX3NlbGVjdGlvbiIsInN0cmluZ0RhdGVzIiwianNEYXRlc0FyciIsInBhcnRzIiwiQXJyYXkiLCJpc0FycmF5IiwicmFuZ2UiLCJtdWx0aXBsZSIsImlzTmFOIiwic3BsaXQiLCJwYXJzZV9kYXRlX3RleHQiLCJnZXRfZGF0ZXBpY2tfc2VsZWN0ZWRfcmFuZ2UiLCIkZGF0ZSIsImluc3QiLCJfZ2V0SW5zdCIsIl9nZXREYXRlIiwiYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24iLCJvcHRpb25zIiwic3RhcnRJc28iLCJlbmRJc28iLCJjdXJyZW50S2V5IiwibmV4dEtleSIsImZvcmNlX3JlbG9hZCIsInN5bmNfZGF0ZV9yYW5nZV9mcm9tX2lucHV0IiwiZ2V0X2RhdGVfcmFuZ2VfZnJvbV9kYXRhX2F0dHJzIiwiZ2V0X2N1cnJlbnRfZGF0ZV9yYW5nZSIsInNoaWZ0X2RhdGVfcmFuZ2UiLCJkaXJlY3Rpb24iLCJzaGlmdCIsImNsZWFyX3NlbGVjdGlvbiIsInBhcnNlZCIsInNxbE1hdGNoIiwibWF0Y2giLCJwYXJzZURhdGUiLCJlcnJvciIsInNldF90aW1lX3Nsb3RzX2NvbnRleHQiLCIkY29udGV4dCIsInJlc291cmNlQ2hhbmdlZCIsInJhbmdlQ2hhbmdlZCIsImluaXRfdGltZV9zbG90c19wYWdlIiwicm93X2Zyb21fcG9pbnRlciIsIm9yaWdpbmFsIiwib3JpZ2luYWxFdmVudCIsInBvaW50IiwidG91Y2hlcyIsImVsIiwiZWxlbWVudEZyb21Qb2ludCIsImNsaWVudFgiLCJjbGllbnRZIiwiY29udGFpbnMiLCJtaW51dGVfZnJvbV9wb2ludGVyIiwiJGxhbmUiLCJyYXRpbyIsImNyZWF0ZV9zZWxlY3Rpb24iLCJ1cGRhdGVfc2VsZWN0aW9uIiwicHJlZmVycmVkQWN0aXZlSWQiLCJpbnRlcnZhbHMiLCJtZXJnZWQiLCJncm91cHMiLCJuZXdBY3RpdmVJZCIsImFjdGl2ZSIsImxhc3QiLCJsYXN0Um93IiwibWFwIiwiJHRlbXBsYXRlIiwiJHNlbGVjdGlvbiIsImhpZGRlbiIsInJlbW92ZUF0dHJpYnV0ZSIsInVwZGF0ZV9zdW1tYXJ5IiwiZGF0ZXNDb3VudCIsImRhdGVUZXh0IiwidGltZVRleHQiLCJkZXRhaWxzIiwiZGV0YWlsc0h0bWwiLCJ0aW1lTGFiZWwiLCJzaG93X2xpdmVfdGlwIiwiJHRpcCIsInBhZ2VYIiwicGFnZVkiLCJoaWRlX2xpdmVfdGlwIiwic3luY19zbG90X3N0ZXBfY29udHJvbHMiLCJzeW5jX3pvb21fY29udHJvbHMiLCJpbmRleE9mIiwic2V0X3N0ZXAiLCJzeW5jX3Zpc2libGVfdGltZV9jb250cm9scyIsInNldF92aXNpYmxlX3RpbWVfcmFuZ2UiLCJhY3RpdmVFbGVtZW50Iiwic2V0X21vZGUiLCJpc19iYXJfc2VsZWN0YWJsZV9mb3JfdGltZV9hY3Rpb24iLCJydW5fY29tbWFuZCIsInNlbGVjdF9zbG90c19maXJzdCIsIm5vbmNlIiwic2F2aW5nIiwiSlNPTiIsInN0cmluZ2lmeSIsImJsb2NrX3N1Y2Nlc3MiLCJ1bmJsb2NrX3N1Y2Nlc3MiLCJpbml0X2RhdGVfcmFuZ2VfcGlja2VyIiwiJGRhdGVXcmFwIiwiZmlyc3REYXkiLCJmbiIsImNvbnNvbGUiLCJsb2ciLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsIm1hcmtlckNsYXNzTmFtZSIsImJlZm9yZVNob3dEYXkiLCJvblNlbGVjdCIsIm9uQ2xvc2UiLCJzaG93T24iLCJzaG93QW5pbSIsImR1cmF0aW9uIiwicmFuZ2VTZWxlY3QiLCJtdWx0aVNlbGVjdCIsIm51bWJlck9mTW9udGhzIiwic3RlcE1vbnRocyIsInByZXZUZXh0IiwibmV4dFRleHQiLCJkYXRlRm9ybWF0IiwiY2hhbmdlTW9udGgiLCJjaGFuZ2VZZWFyIiwibWluRGF0ZSIsIm1heERhdGUiLCJzaG93U3RhdHVzIiwibXVsdGlTZXBhcmF0b3IiLCJjbG9zZUF0VG9wIiwiZ290b0N1cnJlbnQiLCJoaWRlSWZOb1ByZXZOZXh0IiwidXNlVGhlbWVSb2xsZXIiLCJtYW5kYXRvcnkiLCJzaG93X2RhdGVfcmFuZ2VfcGlja2VyIiwiaW5wdXQiLCJfc2hvd0RhdGVwaWNrIiwiX2xhc3RJbnB1dCIsIl9kYXRlcGlja2VyU2hvd2luZyIsIndoaWNoIiwiaW5pdF9yaWdodGJhcl90YWJzIiwiJHRhYiIsInBhbmVsSWQiLCIkcGFuZWwiLCIkdGFibGlzdCIsImZvcmNlIiwiJHBhZ2VzIiwiZmlsdGVyIiwiaW5pdF90aW1lX3Nsb3RzX2NvbXBvbmVudCIsImlzRHJhZ2dpbmciLCJkcmFnU3RhcnRNaW51dGUiLCJkcmFnU3RhcnRSb3ciLCJkcmFnU2VsZWN0aW9uSWQiLCJyZXNpemVNb2RlIiwiJHpvb20iLCIkYmFyVGFyZ2V0IiwiY3VycmVudFJvdyIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0IiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktdGltZXNsb3RzL19zcmMvYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBUaW1lIFNsb3RzIEF2YWlsYWJpbGl0eSBVSS5cclxuICovXHJcbiggZnVuY3Rpb24gKCAkICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIHpvb21TdGVwcyA9IFsgNjAsIDMwLCAxNSwgMTAsIDUgXTtcclxuXHR2YXIgY3VycmVudE1vZGUgPSAnYmxvY2snO1xyXG5cdHZhciBzZWxlY3Rpb25SYW5nZXMgPSBbXTtcclxuXHR2YXIgYWN0aXZlU2VsZWN0aW9uSWQgPSAnJztcclxuXHR2YXIgcm93VGVtcGxhdGVzID0gW107XHJcblx0dmFyIG5leHRTZWxlY3Rpb25JZCA9IDE7XHJcblx0dmFyIG5leHRUb29sdGlwU2NvcGVJZCA9IDE7XHJcblx0dmFyIGFjdGl2ZUxvYWRSZXF1ZXN0ID0gbnVsbDtcclxuXHR2YXIgYWN0aXZlTG9hZFJlcXVlc3RJZCA9IDA7XHJcblx0dmFyIGFjdGl2ZVNhdmVSZXF1ZXN0ID0gbnVsbDtcclxuXHJcblx0ZnVuY3Rpb24gcGFkXzIoIHZhbHVlICkge1xyXG5cdFx0cmV0dXJuICggdmFsdWUgPCAxMCA/ICcwJyA6ICcnICkgKyB2YWx1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHRyaW1fdGV4dCggdmFsdWUgKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnJlcGxhY2UoIC9eXFxzK3xcXHMrJC9nLCAnJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbWludXRlc190b190aW1lKCBtaW51dGVzICkge1xyXG5cdFx0dmFyIGhvdXJzID0gTWF0aC5mbG9vciggbWludXRlcyAvIDYwICk7XHJcblx0XHR2YXIgbWlucyA9IG1pbnV0ZXMgJSA2MDtcclxuXHRcdHJldHVybiBwYWRfMiggaG91cnMgKSArICc6JyArIHBhZF8yKCBtaW5zICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbGFtcCggdmFsdWUsIG1pbiwgbWF4ICkge1xyXG5cdFx0cmV0dXJuIE1hdGgubWF4KCBtaW4sIE1hdGgubWluKCBtYXgsIHZhbHVlICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNuYXBfbWludXRlKCBtaW51dGUsIHN0ZXAgKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5yb3VuZCggbWludXRlIC8gc3RlcCApICogc3RlcDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdGFydDogcGFyc2VJbnQoICRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICksIDEwICkgfHwgMCxcclxuXHRcdFx0ZW5kOiBwYXJzZUludCggJGdyaWQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICksIDEwICkgfHwgMTQ0MCxcclxuXHRcdFx0c3RlcDogcGFyc2VJbnQoICRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RlcCcgKSwgMTAgKSB8fCAxNVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jb250cm9sKCAkcGFnZSwgbmFtZSApIHtcclxuXHRcdHZhciAkY29udHJvbCA9ICRwYWdlLmZpbmQoICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCInICsgbmFtZSArICdcIl0nICkuZmlyc3QoKTtcclxuXHJcblx0XHRpZiAoICEgJGNvbnRyb2wubGVuZ3RoICkge1xyXG5cdFx0XHQkY29udHJvbCA9ICRwYWdlLmZpbmQoICcjd3BiY190c18nICsgbmFtZSApLmZpcnN0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICRjb250cm9sO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApIHtcclxuXHRcdHJldHVybiAoICggbWludXRlIC0gY29uZmlnLnN0YXJ0ICkgLyAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKSApICogMTAwO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggc3RhcnQsIGVuZCwgY29uZmlnICkge1xyXG5cdFx0c3RhcnQgPSBjbGFtcCggc25hcF9taW51dGUoIHN0YXJ0LCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdGVuZCA9IGNsYW1wKCBzbmFwX21pbnV0ZSggZW5kLCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0ID09PSBlbmQgKSB7XHJcblx0XHRcdGVuZCA9IGNsYW1wKCBzdGFydCArIGNvbmZpZy5zdGVwLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0aWYgKCBzdGFydCA9PT0gZW5kICkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gY2xhbXAoIGVuZCAtIGNvbmZpZy5zdGVwLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN0YXJ0OiBNYXRoLm1pbiggc3RhcnQsIGVuZCApLFxyXG5cdFx0XHRlbmQ6IE1hdGgubWF4KCBzdGFydCwgZW5kIClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX2J5X2lkKCBzZWxlY3Rpb25JZCApIHtcclxuXHRcdHZhciBmb3VuZCA9IG51bGw7XHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0aWYgKCBpdGVtLmlkID09PSBzZWxlY3Rpb25JZCApIHtcclxuXHRcdFx0XHRmb3VuZCA9IGl0ZW07XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fSApO1xyXG5cdFx0cmV0dXJuIGZvdW5kO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVuZGVyX2F4aXMoICRncmlkICkge1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHRcdHZhciAkYXhpcyA9ICRncmlkLmZpbmQoICcud3BiY190c190aW1lX2F4aXMnICk7XHJcblx0XHR2YXIgaHRtbCA9ICcnO1xyXG5cdFx0dmFyIG1pbnV0ZTtcclxuXHRcdHZhciBzbG90Q291bnQgPSBNYXRoLm1heCggMSwgKCBjb25maWcuZW5kIC0gY29uZmlnLnN0YXJ0ICkgLyBjb25maWcuc3RlcCApO1xyXG5cdFx0dmFyIHZpc2libGVIb3VycyA9IE1hdGgubWF4KCAxLCAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKSAvIDYwICk7XHJcblx0XHR2YXIgYXhpc0ZvbnRTaXplID0gY2xhbXAoIE1hdGgucm91bmQoIDE2IC0gKCB2aXNpYmxlSG91cnMgKiAwLjI1ICkgKSwgMTAsIDEzICk7XHJcblx0XHR2YXIgYXhpc0ZvbnRXZWlnaHQgPSB2aXNpYmxlSG91cnMgPD0gMTAgPyA1NTAgOiA0MDA7XHJcblx0XHR2YXIgZmlyc3RIb3VyID0gTWF0aC5jZWlsKCBjb25maWcuc3RhcnQgLyA2MCApICogNjA7XHJcblxyXG5cdFx0JGdyaWQuY3NzKCAnLS13cGJjLXRzLXNsb3QtY291bnQnLCBTdHJpbmcoIHNsb3RDb3VudCApICk7XHJcblx0XHQkZ3JpZC5jc3MoICctLXdwYmMtdHMtYXhpcy1sYWJlbC1zaXplJywgYXhpc0ZvbnRTaXplICsgJ3B4JyApO1xyXG5cdFx0JGdyaWQuY3NzKCAnLS13cGJjLXRzLWF4aXMtbGFiZWwtd2VpZ2h0JywgU3RyaW5nKCBheGlzRm9udFdlaWdodCApICk7XHJcblxyXG5cdFx0Zm9yICggbWludXRlID0gZmlyc3RIb3VyOyBtaW51dGUgPD0gY29uZmlnLmVuZDsgbWludXRlICs9IDYwICkge1xyXG5cdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYXhpc19sYWJlbFwiIHN0eWxlPVwibGVmdDonICsgcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApICsgJyU7XCI+JyArIG1pbnV0ZXNfdG9fdGltZSggbWludXRlICkgKyAnPC9zcGFuPic7XHJcblx0XHRcdGh0bWwgKz0gJzxzcGFuIGNsYXNzPVwid3BiY190c19heGlzX3RpY2tcIiBzdHlsZT1cImxlZnQ6JyArIHBlcmNlbnRfZm9yX21pbnV0ZSggbWludXRlLCBjb25maWcgKSArICclO1wiPjwvc3Bhbj4nO1xyXG5cdFx0XHRpZiAoIG1pbnV0ZSArIDMwIDwgY29uZmlnLmVuZCApIHtcclxuXHRcdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYXhpc19kb3RcIiBzdHlsZT1cImxlZnQ6JyArIHBlcmNlbnRfZm9yX21pbnV0ZSggbWludXRlICsgMzAsIGNvbmZpZyApICsgJyU7XCI+PC9zcGFuPic7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKCBtaW51dGUgPSBjb25maWcuc3RhcnQgKyBjb25maWcuc3RlcDsgbWludXRlIDwgY29uZmlnLmVuZDsgbWludXRlICs9IGNvbmZpZy5zdGVwICkge1xyXG5cdFx0XHRpZiAoIDAgPT09IG1pbnV0ZSAlIDYwIHx8IDMwID09PSBtaW51dGUgJSA2MCApIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYXhpc19taW5vclwiIHN0eWxlPVwibGVmdDonICsgcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApICsgJyU7XCI+PC9zcGFuPic7XHJcblx0XHR9XHJcblxyXG5cdFx0JGF4aXMuaHRtbCggaHRtbCApO1xyXG5cdFx0cmVmcmVzaF9mbG9hdGluZ19oZWFkZXIoICRncmlkLmNsb3Nlc3QoICcud3BiY190c19wYWdlJyApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwb3NpdGlvbl9iYXJzKCAkZ3JpZCApIHtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblxyXG5cdFx0JGdyaWQuZmluZCggJy53cGJjX3RzX2JhcicgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkYmFyID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgc3RhcnQgPSBwYXJzZUludCggJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApLCAxMCApO1xyXG5cdFx0XHR2YXIgZW5kID0gcGFyc2VJbnQoICRiYXIuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICksIDEwICk7XHJcblx0XHRcdHZhciB2aXNpYmxlU3RhcnQgPSBjbGFtcCggc3RhcnQsIGNvbmZpZy5zdGFydCwgY29uZmlnLmVuZCApO1xyXG5cdFx0XHR2YXIgdmlzaWJsZUVuZCA9IGNsYW1wKCBlbmQsIGNvbmZpZy5zdGFydCwgY29uZmlnLmVuZCApO1xyXG5cdFx0XHR2YXIgbGVmdDtcclxuXHRcdFx0dmFyIHdpZHRoO1xyXG5cclxuXHRcdFx0aWYgKCB2aXNpYmxlRW5kIDw9IGNvbmZpZy5zdGFydCB8fCB2aXNpYmxlU3RhcnQgPj0gY29uZmlnLmVuZCB8fCB2aXNpYmxlU3RhcnQgPj0gdmlzaWJsZUVuZCApIHtcclxuXHRcdFx0XHQkYmFyLmhpZGUoKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGxlZnQgPSBwZXJjZW50X2Zvcl9taW51dGUoIHZpc2libGVTdGFydCwgY29uZmlnICk7XHJcblx0XHRcdHdpZHRoID0gcGVyY2VudF9mb3JfbWludXRlKCB2aXNpYmxlRW5kLCBjb25maWcgKSAtIGxlZnQ7XHJcblx0XHRcdCRiYXIuc2hvdygpLmNzcyggeyBsZWZ0OiBsZWZ0ICsgJyUnLCB3aWR0aDogd2lkdGggKyAnJScgfSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVuZGVyX3RpbWVsaW5lX2JhcnMoICRwYWdlLCBiYXJzICkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gd2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIHx8IHt9O1xyXG5cdFx0dmFyIGxhYmVscyA9IHNldHRpbmdzLmkxOG4gfHwge307XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX2JhcltkYXRhLXdwYmMtdHMtc291cmNlPVwic2VydmVyXCJdJyApLnJlbW92ZSgpO1xyXG5cclxuXHRcdCQuZWFjaCggYmFycyB8fCB7fSwgZnVuY3Rpb24gKCBkYXRlLCByZXNvdXJjZXMgKSB7XHJcblx0XHRcdHZhciAkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtZGF0ZT1cIicgKyBkYXRlICsgJ1wiXScgKTtcclxuXHJcblx0XHRcdGlmICggISAkcm93Lmxlbmd0aCB8fCAhIHJlc291cmNlcyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCQuZWFjaCggcmVzb3VyY2VzLCBmdW5jdGlvbiAoIHJlc291cmNlSWQsIHJlc291cmNlQmFycyApIHtcclxuXHRcdFx0XHQkLmVhY2goIHJlc291cmNlQmFycyB8fCBbXSwgZnVuY3Rpb24gKCBpbmRleCwgaW50ZXJ2YWwgKSB7XHJcblx0XHRcdFx0XHR2YXIgdHlwZSA9ICdibG9ja2VkJyA9PT0gaW50ZXJ2YWwudHlwZSA/ICdibG9ja2VkJyA6ICggJ3VuYXZhaWxhYmxlX2RheScgPT09IGludGVydmFsLnR5cGUgPyAndW5hdmFpbGFibGVfZGF5JyA6ICggJ3dvcmtpbmdfdGltZScgPT09IGludGVydmFsLnR5cGUgPyAnd29ya2luZ190aW1lJyA6ICdib29rZWQnICkgKTtcclxuXHRcdFx0XHRcdHZhciBpY29uID0gJ2Jvb2tlZCcgPT09IHR5cGUgPyAnd3BiY19pY25fbG9jaycgOiAoICd1bmF2YWlsYWJsZV9kYXknID09PSB0eXBlID8gJ3dwYmNfaWNuX2V2ZW50X2J1c3knIDogKCAnd29ya2luZ190aW1lJyA9PT0gdHlwZSA/ICd3cGJjLWJpLWNsb2NrLWhpc3RvcnknIDogJ3dwYmNfaWNuX2RvX25vdF9kaXN0dXJiX29uJyApICk7XHJcblx0XHRcdFx0XHR2YXIgdG9vbHRpcCA9IGludGVydmFsLnRvb2x0aXAgfHwgJyc7XHJcblx0XHRcdFx0XHR2YXIgJGJhciA9ICQoICc8ZGl2IGNsYXNzPVwid3BiY190c19iYXJcIiBkYXRhLXdwYmMtdHMtc291cmNlPVwic2VydmVyXCI+PC9kaXY+JyApO1xyXG5cdFx0XHRcdFx0dmFyICRpY29uV3JhcDtcclxuXHJcblx0XHRcdFx0XHRpZiAoICdib29rZWQnID09PSB0eXBlICYmIGludGVydmFsLmJvb2tpbmdfdXJsICkge1xyXG5cdFx0XHRcdFx0XHQkaWNvbldyYXAgPSAkKCAnPGEgY2xhc3M9XCJ3cGJjX3RzX2Jvb2tpbmdfbGluayB0b29sdGlwX3RvcFwiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj48c3Bhbj48L3NwYW4+PC9hPicgKTtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdocmVmJywgaW50ZXJ2YWwuYm9va2luZ191cmwgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnLCBpbnRlcnZhbC5ib29raW5nX2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2FyaWEtbGFiZWwnLCAoIGxhYmVscy5vcGVuX2Jvb2tpbmcgfHwgJ09wZW4gYm9va2luZyBpbiBCb29raW5nIExpc3RpbmcnICkgKyAoIGludGVydmFsLmJvb2tpbmdfaWQgPyAnOiAnICsgaW50ZXJ2YWwuYm9va2luZ19pZCA6ICcnICkgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS1vcmlnaW5hbC10aXRsZScsIHRvb2x0aXAgfHwgJycgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoICggJ3VuYXZhaWxhYmxlX2RheScgPT09IHR5cGUgfHwgJ3dvcmtpbmdfdGltZScgPT09IHR5cGUgKSAmJiBpbnRlcnZhbC5ydWxlX3VybCApIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxhIGNsYXNzPVwid3BiY190c19ydWxlX2xpbmsgdG9vbHRpcF90b3BcIj48c3Bhbj48L3NwYW4+PC9hPicgKTtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdocmVmJywgaW50ZXJ2YWwucnVsZV91cmwgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJ1bGUtc291cmNlJywgaW50ZXJ2YWwucnVsZV9zb3VyY2UgfHwgaW50ZXJ2YWwuc291cmNlX3R5cGUgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnYXJpYS1sYWJlbCcsICggbGFiZWxzLm9wZW5fYXZhaWxhYmlsaXR5X3J1bGUgfHwgJ09wZW4gYXZhaWxhYmlsaXR5IHNldHRpbmdzJyApICsgKCBpbnRlcnZhbC5zdGF0dXNfdGl0bGUgPyAnOiAnICsgaW50ZXJ2YWwuc3RhdHVzX3RpdGxlIDogJycgKSApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgdG9vbHRpcCB8fCAnJyApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxzcGFuIGNsYXNzPVwid3BiY190c19iYXJfaWNvbiB0b29sdGlwX3RvcFwiPjxzcGFuPjwvc3Bhbj48L3NwYW4+JyApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgdG9vbHRpcCB8fCAnJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdCRiYXJcclxuXHRcdFx0XHRcdFx0LmFkZENsYXNzKCAnd3BiY190c19iYXJfJyArIHR5cGUgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcsIHBhcnNlSW50KCBpbnRlcnZhbC5zdGFydF9taW51dGUsIDEwICkgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnLCBwYXJzZUludCggaW50ZXJ2YWwuZW5kX21pbnV0ZSwgMTAgKSApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJlc291cmNlLWlkJywgcmVzb3VyY2VJZCApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnLCBpbnRlcnZhbC5ib29raW5nX2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtYm9va2luZy11cmwnLCBpbnRlcnZhbC5ib29raW5nX3VybCB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJ1bGUtdXJsJywgaW50ZXJ2YWwucnVsZV91cmwgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy11bmF2YWlsYWJsZS1pZCcsIGludGVydmFsLnVuYXZhaWxhYmxlX3RpbWVzbG90X2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc291cmNlLXR5cGUnLCBpbnRlcnZhbC5zb3VyY2VfdHlwZSB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWVkaXRhYmxlJywgZmFsc2UgPT09IGludGVydmFsLmVkaXRhYmxlID8gJzAnIDogJzEnICk7XHJcblx0XHRcdFx0XHRpZiAoIHRvb2x0aXAgKSB7XHJcblx0XHRcdFx0XHRcdCRiYXIuYXR0ciggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnLCB0b29sdGlwICkuYWRkQ2xhc3MoICd0b29sdGlwX3RvcCcgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCRpY29uV3JhcC5maW5kKCAnc3BhbicgKS5hZGRDbGFzcyggaWNvbiApO1xyXG5cdFx0XHRcdFx0JGJhci5hcHBlbmQoICRpY29uV3JhcCApO1xyXG5cdFx0XHRcdFx0JHJvdy5maW5kKCAnLndwYmNfdHNfbGFuZScgKS5hcHBlbmQoICRiYXIgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRwb3NpdGlvbl9iYXJzKCAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKSApO1xyXG5cdFx0cmVmcmVzaF9iYXJfdG9vbHRpcHMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfcGFnZSB8fCB7fTtcclxuXHRcdHZhciAkZGF0ZVJhbmdlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciBsYWJlbHMgPSBzZXR0aW5ncy5pMThuIHx8IHt9O1xyXG5cdFx0dmFyIHJlcXVlc3RJZDtcclxuXHJcblx0XHRpZiAoICEgc2V0dGluZ3MuYWpheF91cmwgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGFjdGl2ZUxvYWRSZXF1ZXN0ICYmIGFjdGl2ZUxvYWRSZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgKSB7XHJcblx0XHRcdGFjdGl2ZUxvYWRSZXF1ZXN0LmFib3J0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVxdWVzdElkID0gKythY3RpdmVMb2FkUmVxdWVzdElkO1xyXG5cdFx0c2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCB0cnVlLCBsYWJlbHMubG9hZGluZyB8fCAnTG9hZGluZycgKTtcclxuXHJcblx0XHRhY3RpdmVMb2FkUmVxdWVzdCA9ICQucG9zdCggc2V0dGluZ3MuYWpheF91cmwsIHtcclxuXHRcdFx0YWN0aW9uOiAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX1RJTUVTTE9UU19SRUFEJyxcclxuXHRcdFx0cmVzb3VyY2VfaWQ6IGdldF9jb250cm9sKCAkcGFnZSwgJ3Jlc291cmNlJyApLnZhbCgpLFxyXG5cdFx0XHRkYXRlX3N0YXJ0OiAkZGF0ZVJhbmdlLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICksXHJcblx0XHRcdGRhdGVfZW5kOiAkZGF0ZVJhbmdlLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApXHJcblx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcclxuXHRcdFx0aWYgKCByZXF1ZXN0SWQgIT09IGFjdGl2ZUxvYWRSZXF1ZXN0SWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyAmJiByZXNwb25zZS5kYXRhICkge1xyXG5cdFx0XHRcdHJlbmRlcl90aW1lbGluZV9iYXJzKCAkcGFnZSwgcmVzcG9uc2UuZGF0YS5iYXJzICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHhociwgdGV4dFN0YXR1cyApIHtcclxuXHRcdFx0aWYgKCAnYWJvcnQnICE9PSB0ZXh0U3RhdHVzICYmIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbGFiZWxzLnNhdmVfZXJyb3IgfHwgJ1VuYWJsZSB0byBzYXZlIHRpbWUtc2xvdCBhdmFpbGFiaWxpdHkuJywgJ2Vycm9yJywgNTAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggcmVxdWVzdElkID09PSBhY3RpdmVMb2FkUmVxdWVzdElkICkge1xyXG5cdFx0XHRcdHNldF90aW1lbGluZV9sb2FkaW5nKCAkcGFnZSwgZmFsc2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3Jvd3NfYmV0d2VlbiggJHBhZ2UsIHN0YXJ0Um93LCBlbmRSb3cgKSB7XHJcblx0XHR2YXIgc3RhcnRJbmRleCA9IHBhcnNlSW50KCBzdGFydFJvdywgMTAgKTtcclxuXHRcdHZhciBlbmRJbmRleCA9IHBhcnNlSW50KCBlbmRSb3csIDEwICk7XHJcblx0XHR2YXIgbWluID0gTWF0aC5taW4oIHN0YXJ0SW5kZXgsIGVuZEluZGV4ICk7XHJcblx0XHR2YXIgbWF4ID0gTWF0aC5tYXgoIHN0YXJ0SW5kZXgsIGVuZEluZGV4ICk7XHJcblx0XHR2YXIgcm93cyA9IFtdO1xyXG5cdFx0dmFyIGk7XHJcblxyXG5cdFx0Zm9yICggaSA9IG1pbjsgaSA8PSBtYXg7IGkrKyApIHtcclxuXHRcdFx0aWYgKCAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgaSArICdcIl0nICkubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJvd3MucHVzaCggU3RyaW5nKCBpICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByb3dzO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcm93X2xhYmVsKCAkcGFnZSwgcm93SWQgKSB7XHJcblx0XHRyZXR1cm4gdHJpbV90ZXh0KCAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgcm93SWQgKyAnXCJdIC53cGJjX3RzX3Jvd19sYWJlbF90ZXh0JyApLnRleHQoKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZXNjYXBlX2h0bWwoIHZhbHVlICkge1xyXG5cdFx0cmV0dXJuICQoICc8ZGl2IC8+JyApLnRleHQoIHZhbHVlICkuaHRtbCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcG9zaXRpb25fbG9hZGluZ19vdmVybGF5KCAkcGFnZSApIHtcclxuXHRcdHZhciAkY2FyZCA9ICRwYWdlLmZpbmQoICcud3BiY190c190aW1lbGluZV9jYXJkJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgY2FyZCA9ICRjYXJkLmdldCggMCApO1xyXG5cdFx0dmFyICRvdmVybGF5ID0gJGNhcmQuZmluZCggJy53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScgKS5maXJzdCgpO1xyXG5cclxuXHRcdGlmICggISBjYXJkIHx8ICEgJG92ZXJsYXkubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JG92ZXJsYXkuY3NzKCB7XHJcblx0XHRcdHdpZHRoOiBjYXJkLmNsaWVudFdpZHRoICsgJ3B4JyxcclxuXHRcdFx0aGVpZ2h0OiBjYXJkLmNsaWVudEhlaWdodCArICdweCcsXHJcblx0XHRcdHRyYW5zZm9ybTogJ3RyYW5zbGF0ZSgnICsgY2FyZC5zY3JvbGxMZWZ0ICsgJ3B4LCcgKyBjYXJkLnNjcm9sbFRvcCArICdweCknXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfdGltZWxpbmVfbG9hZGluZyggJHBhZ2UsIGlzTG9hZGluZywgbGFiZWwgKSB7XHJcblx0XHR2YXIgJGNhcmQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfdGltZWxpbmVfY2FyZCcgKTtcclxuXHRcdHZhciAkb3ZlcmxheTtcclxuXHJcblx0XHQkY2FyZFxyXG5cdFx0XHQudG9nZ2xlQ2xhc3MoICdpcy1sb2FkaW5nJywgISEgaXNMb2FkaW5nIClcclxuXHRcdFx0LmZpbmQoICcud3BiY190c19sb2FkaW5nX292ZXJsYXknIClcclxuXHRcdFx0LmF0dHIoICdhcmlhLWhpZGRlbicsIGlzTG9hZGluZyA/ICdmYWxzZScgOiAndHJ1ZScgKTtcclxuXHJcblx0XHRpZiAoIGxhYmVsICkge1xyXG5cdFx0XHQkb3ZlcmxheSA9ICRwYWdlLmZpbmQoICcud3BiY190c19sb2FkaW5nX292ZXJsYXknICkuZmlyc3QoKTtcclxuXHRcdFx0JG92ZXJsYXkuZmluZCggJy53cGJjX3NwaW5zX2xvYWRpbmdfY29udGFpbmVyID4gc3BhbicgKS50ZXh0KCBsYWJlbCArICcuLi4nICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc0xvYWRpbmcgKSB7XHJcblx0XHRcdHBvc2l0aW9uX2xvYWRpbmdfb3ZlcmxheSggJHBhZ2UgKTtcclxuXHRcdFx0JGNhcmQub2ZmKCAnc2Nyb2xsLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApLm9uKCAnc2Nyb2xsLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHBvc2l0aW9uX2xvYWRpbmdfb3ZlcmxheSggJHBhZ2UgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JGNhcmQub2ZmKCAnc2Nyb2xsLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApO1xyXG5cdFx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApLmNzcygge1xyXG5cdFx0XHRcdHdpZHRoOiAnJyxcclxuXHRcdFx0XHRoZWlnaHQ6ICcnLFxyXG5cdFx0XHRcdHRyYW5zZm9ybTogJydcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X2FjdGlvbl9idXR0b25zX2J1c3koICRwYWdlLCBpc0J1c3kgKSB7XHJcblx0XHR2YXIgJHNjb3BlID0gJHBhZ2UuYWRkKCAkcGFnZS5jbG9zZXN0KCAnLm1vZGFsJyApICkuYWRkKCAkKCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzJyApICk7XHJcblxyXG5cdFx0JHNjb3BlXHJcblx0XHRcdC5maW5kKCAnW2RhdGEtd3BiYy10cy1jb21tYW5kXSwgLndwYmNfdHNfY2xlYXJfc2VsZWN0aW9uJyApXHJcblx0XHRcdC50b2dnbGVDbGFzcyggJ2Rpc2FibGVkJywgISEgaXNCdXN5IClcclxuXHRcdFx0LmF0dHIoICdhcmlhLWRpc2FibGVkJywgaXNCdXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfZnVsbF9wYWdlX2NvbXBvbmVudCggJHBhZ2UgKSB7XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQhICRwYWdlLmhhc0NsYXNzKCAnd3BiY190c19wb3B1cCcgKVxyXG5cdFx0XHQmJiAkcGFnZS5jbG9zZXN0KCAnLndwYmNfYWRtaW5fcGFnZV9fdGFiX190aW1lX3Nsb3RzX2F2YWlsYWJpbGl0eScgKS5sZW5ndGggPiAwXHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2Zsb2F0aW5nX2hlYWRlcl9uYW1lc3BhY2UoICRwYWdlICkge1xyXG5cdFx0cmV0dXJuICcud3BiY190c19mbG9hdGluZ18nICsgU3RyaW5nKCAkcGFnZS5hdHRyKCAnZGF0YS13cGJjLXRzLWlkLXByZWZpeCcgKSB8fCAncGFnZScgKS5yZXBsYWNlKCAvW15cXHddL2csICdfJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3RvcF9uYXZfYm90dG9tKCkge1xyXG5cdFx0dmFyICR0b3BOYXYgPSAkKCAnLndwYmNfdWlfZWxfX3RvcF9uYXY6dmlzaWJsZScgKS5maXJzdCgpO1xyXG5cdFx0dmFyIHJlY3Q7XHJcblxyXG5cdFx0aWYgKCAhICR0b3BOYXYubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gMDtcclxuXHRcdH1cclxuXHJcblx0XHRyZWN0ID0gJHRvcE5hdi5nZXQoIDAgKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdHJldHVybiBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggcmVjdC5ib3R0b20gKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZW5zdXJlX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGZsb2F0aW5nID0gJHBhZ2UuY2hpbGRyZW4oICcud3BiY190c19mbG9hdGluZ19oZWFkZXInICk7XHJcblx0XHR2YXIgJGhlYWRlcjtcclxuXHJcblx0XHRpZiAoICRmbG9hdGluZy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiAkZmxvYXRpbmc7XHJcblx0XHR9XHJcblxyXG5cdFx0JGhlYWRlciA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkID4gLndwYmNfdHNfaGVhZGVyJyApLmZpcnN0KCk7XHJcblx0XHQkZmxvYXRpbmcgPSAkKCAnPGRpdiBjbGFzcz1cIndwYmNfdHNfZmxvYXRpbmdfaGVhZGVyXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9kaXY+JyApLmFwcGVuZFRvKCAkcGFnZSApO1xyXG5cclxuXHRcdGlmICggJGhlYWRlci5sZW5ndGggKSB7XHJcblx0XHRcdCRmbG9hdGluZy5hcHBlbmQoICRoZWFkZXIuY2xvbmUoIGZhbHNlLCBmYWxzZSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICRmbG9hdGluZztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZmxvYXRpbmc7XHJcblx0XHR2YXIgJGNhcmQ7XHJcblx0XHR2YXIgJGdyaWQ7XHJcblx0XHR2YXIgJGhlYWRlcjtcclxuXHRcdHZhciBjYXJkO1xyXG5cdFx0dmFyIGNhcmRSZWN0O1xyXG5cdFx0dmFyIGhlYWRlclJlY3Q7XHJcblx0XHR2YXIgdG9wT2Zmc2V0O1xyXG5cdFx0dmFyIHNob3VsZFNob3c7XHJcblxyXG5cdFx0aWYgKCAhIGlzX2Z1bGxfcGFnZV9jb21wb25lbnQoICRwYWdlICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkZmxvYXRpbmcgPSBlbnN1cmVfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdFx0JGNhcmQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfdGltZWxpbmVfY2FyZCcgKS5maXJzdCgpO1xyXG5cdFx0JGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKS5maXJzdCgpO1xyXG5cdFx0JGhlYWRlciA9ICRncmlkLmZpbmQoICc+IC53cGJjX3RzX2hlYWRlcicgKS5maXJzdCgpO1xyXG5cdFx0Y2FyZCA9ICRjYXJkLmdldCggMCApO1xyXG5cclxuXHRcdGlmICggISBjYXJkIHx8ICEgJGdyaWQubGVuZ3RoIHx8ICEgJGhlYWRlci5sZW5ndGggKSB7XHJcblx0XHRcdCRmbG9hdGluZy5yZW1vdmVDbGFzcyggJ2lzLXZpc2libGUnICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjYXJkUmVjdCA9IGNhcmQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHRoZWFkZXJSZWN0ID0gJGhlYWRlci5nZXQoIDAgKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdHRvcE9mZnNldCA9IGdldF90b3BfbmF2X2JvdHRvbSgpO1xyXG5cdFx0c2hvdWxkU2hvdyA9ICggaGVhZGVyUmVjdC50b3AgPCB0b3BPZmZzZXQgKSAmJiAoIGNhcmRSZWN0LmJvdHRvbSA+ICggdG9wT2Zmc2V0ICsgaGVhZGVyUmVjdC5oZWlnaHQgKSApO1xyXG5cclxuXHRcdGlmICggISBzaG91bGRTaG93ICkge1xyXG5cdFx0XHQkZmxvYXRpbmcucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZsb2F0aW5nXHJcblx0XHRcdC5jc3MoIHtcclxuXHRcdFx0XHR0b3A6IHRvcE9mZnNldCArICdweCcsXHJcblx0XHRcdFx0bGVmdDogTWF0aC5yb3VuZCggY2FyZFJlY3QubGVmdCApICsgJ3B4JyxcclxuXHRcdFx0XHR3aWR0aDogTWF0aC5yb3VuZCggY2FyZC5jbGllbnRXaWR0aCApICsgJ3B4JyxcclxuXHRcdFx0XHQnLS13cGJjLXRzLWZsb2F0aW5nLXNjcm9sbC1sZWZ0JzogKCAtMSAqIGNhcmQuc2Nyb2xsTGVmdCApICsgJ3B4JyxcclxuXHRcdFx0XHQnLS13cGJjLXRzLWZsb2F0aW5nLXNjcm9sbC1sZWZ0LWFicyc6IGNhcmQuc2Nyb2xsTGVmdCArICdweCdcclxuXHRcdFx0fSApXHJcblx0XHRcdC5hZGRDbGFzcyggJ2lzLXZpc2libGUnICk7XHJcblxyXG5cdFx0JGZsb2F0aW5nLmNoaWxkcmVuKCAnLndwYmNfdHNfaGVhZGVyJyApLmNzcyggJ3dpZHRoJywgTWF0aC5yb3VuZCggJGdyaWQub3V0ZXJXaWR0aCgpICkgKyAncHgnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWZyZXNoX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGZsb2F0aW5nO1xyXG5cdFx0dmFyICRoZWFkZXI7XHJcblxyXG5cdFx0aWYgKCAhICRwYWdlIHx8ICEgJHBhZ2UubGVuZ3RoIHx8ICEgaXNfZnVsbF9wYWdlX2NvbXBvbmVudCggJHBhZ2UgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRmbG9hdGluZyA9ICRwYWdlLmNoaWxkcmVuKCAnLndwYmNfdHNfZmxvYXRpbmdfaGVhZGVyJyApO1xyXG5cclxuXHRcdGlmICggISAkZmxvYXRpbmcubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGhlYWRlciA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkID4gLndwYmNfdHNfaGVhZGVyJyApLmZpcnN0KCk7XHJcblx0XHQkZmxvYXRpbmcuZW1wdHkoKTtcclxuXHJcblx0XHRpZiAoICRoZWFkZXIubGVuZ3RoICkge1xyXG5cdFx0XHQkZmxvYXRpbmcuYXBwZW5kKCAkaGVhZGVyLmNsb25lKCBmYWxzZSwgZmFsc2UgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYmluZF9mbG9hdGluZ19oZWFkZXIoICRwYWdlICkge1xyXG5cdFx0dmFyIG5hbWVzcGFjZTtcclxuXHJcblx0XHRpZiAoICEgaXNfZnVsbF9wYWdlX2NvbXBvbmVudCggJHBhZ2UgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdG5hbWVzcGFjZSA9IGdldF9mbG9hdGluZ19oZWFkZXJfbmFtZXNwYWNlKCAkcGFnZSApO1xyXG5cdFx0ZW5zdXJlX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHJcblx0XHQkKCB3aW5kb3cgKVxyXG5cdFx0XHQub2ZmKCAnc2Nyb2xsJyArIG5hbWVzcGFjZSArICcgcmVzaXplJyArIG5hbWVzcGFjZSApXHJcblx0XHRcdC5vbiggJ3Njcm9sbCcgKyBuYW1lc3BhY2UgKyAnIHJlc2l6ZScgKyBuYW1lc3BhY2UsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLmZpbmQoICcud3BiY190c190aW1lbGluZV9jYXJkJyApXHJcblx0XHRcdC5vZmYoICdzY3JvbGwnICsgbmFtZXNwYWNlIClcclxuXHRcdFx0Lm9uKCAnc2Nyb2xsJyArIG5hbWVzcGFjZSwgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKVxyXG5cdFx0XHQub2ZmKCAnY2xpY2snICsgbmFtZXNwYWNlIClcclxuXHRcdFx0Lm9uKCAnY2xpY2snICsgbmFtZXNwYWNlLCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X2xlZnRfdmVydGljYWxfbmF2LCAud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfcmlnaHRfdmVydGljYWxfbmF2LCAud3BiY191aV9fdG9wX25hdl9fYnRuX2Z1bGxfc2NyZWVuLCAud3BiY191aV9fdG9wX25hdl9fYnRuX25vcm1hbF9zY3JlZW4nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdFx0XHRcdH0sIDgwICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZnJlc2hfYmFyX3Rvb2x0aXBzKCAkcGFnZSApIHtcclxuXHRcdHZhciAkdG9vbHRpcFNjb3BlID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3RpbWVsaW5lX2NhcmQnICkuZmlyc3QoKTtcclxuXHRcdHZhciB0b29sdGlwU2NvcGVJZDtcclxuXHRcdHZhciBkaWRJbml0aWFsaXplVG9vbHRpcHMgPSBmYWxzZTtcclxuXHJcblx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfYmFyLnRvb2x0aXBfdG9wLCAud3BiY190c19iYXJfaWNvbi50b29sdGlwX3RvcCwgLndwYmNfdHNfYm9va2luZ19saW5rLnRvb2x0aXBfdG9wLCAud3BiY190c19ydWxlX2xpbmsudG9vbHRpcF90b3AnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIHRoaXMuX3RpcHB5ICkge1xyXG5cdFx0XHRcdHRoaXMuX3RpcHB5LmRlc3Ryb3koKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyApIHtcclxuXHRcdFx0aWYgKCAkdG9vbHRpcFNjb3BlLmxlbmd0aCApIHtcclxuXHRcdFx0XHR0b29sdGlwU2NvcGVJZCA9ICR0b29sdGlwU2NvcGUuYXR0ciggJ2lkJyApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgdG9vbHRpcFNjb3BlSWQgKSB7XHJcblx0XHRcdFx0XHR0b29sdGlwU2NvcGVJZCA9ICd3cGJjX3RzX3RpbWVsaW5lX3Rvb2x0aXBfc2NvcGVfJyArIG5leHRUb29sdGlwU2NvcGVJZDtcclxuXHRcdFx0XHRcdG5leHRUb29sdGlwU2NvcGVJZCsrO1xyXG5cdFx0XHRcdFx0JHRvb2x0aXBTY29wZS5hdHRyKCAnaWQnLCB0b29sdGlwU2NvcGVJZCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZGlkSW5pdGlhbGl6ZVRvb2x0aXBzID0gd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCAnIycgKyB0b29sdGlwU2NvcGVJZCArICcgJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGRpZEluaXRpYWxpemVUb29sdGlwcyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQkcGFnZS5maW5kKCAnW2RhdGEtb3JpZ2luYWwtdGl0bGVdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCAhICQoIHRoaXMgKS5hdHRyKCAndGl0bGUnICkgKSB7XHJcblx0XHRcdFx0JCggdGhpcyApLmF0dHIoICd0aXRsZScsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19ib29raW5nX2xpc3Rpbmdfc2VhcmNoX2F2YWlsYWJsZSgpIHtcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zXHJcblx0XHRcdCYmICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd2luZG93LndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1xyXG5cdFx0XHQmJiAkKCAnI3dwYmNfc2VhcmNoX2ZpZWxkJyApLmxlbmd0aFxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsb3NlX3RpbWVfc2xvdHNfcG9wdXAoICRwYWdlLCBhZnRlckNsb3NlICkge1xyXG5cdFx0dmFyICRtb2RhbCA9ICRwYWdlLmNsb3Nlc3QoICcud3BiY19tb2RhbF9fYXZhaWxhYmlsaXR5X3RpbWVzbG90c19fc2VjdGlvbiwgLm1vZGFsJyApO1xyXG5cdFx0dmFyIGlzQ2FsbGJhY2tEb25lID0gZmFsc2U7XHJcblx0XHR2YXIgcnVuX2NhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIGlzQ2FsbGJhY2tEb25lICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpc0NhbGxiYWNrRG9uZSA9IHRydWU7XHJcblxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiBhZnRlckNsb3NlICkge1xyXG5cdFx0XHRcdGFmdGVyQ2xvc2UoKTtcclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHJcblx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0cnVuX2NhbGxiYWNrKCk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJG1vZGFsLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHRcdHJ1bl9jYWxsYmFjaygpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgYWZ0ZXJDbG9zZSApIHtcclxuXHRcdFx0JG1vZGFsLm9uZSggJ2hpZGRlbi53cGJjLm1vZGFsIGhpZGRlbi5icy5tb2RhbCcsIHJ1bl9jYWxsYmFjayApO1xyXG5cdFx0XHR3aW5kb3cuc2V0VGltZW91dCggcnVuX2NhbGxiYWNrLCA1MDAgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAkbW9kYWwud3BiY19teV9tb2RhbCApIHtcclxuXHRcdFx0JG1vZGFsLndwYmNfbXlfbW9kYWwoICdoaWRlJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgJG1vZGFsLm1vZGFsICkge1xyXG5cdFx0XHQkbW9kYWwubW9kYWwoICdoaWRlJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JG1vZGFsLmZpbmQoICdbZGF0YS1kaXNtaXNzPVwibW9kYWxcIl0nICkuZmlyc3QoKS50cmlnZ2VyKCAnY2xpY2snICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZWFyY2hfYm9va2luZ19pbl9jdXJyZW50X2xpc3RpbmcoICRwYWdlLCBib29raW5nSWQgKSB7XHJcblx0XHR2YXIga2V5d29yZCA9ICdpZDonICsgcGFyc2VJbnQoIGJvb2tpbmdJZCwgMTAgKTtcclxuXHJcblx0XHQkKCAnI3dwYmNfc2VhcmNoX2ZpZWxkJyApLnZhbCgga2V5d29yZCApO1xyXG5cdFx0Y2xvc2VfdGltZV9zbG90c19wb3B1cCggJHBhZ2UgKTtcclxuXHRcdHdpbmRvdy53cGJjX2FqeF9ib29raW5nX3NlbmRfc2VhcmNoX3JlcXVlc3Rfd2l0aF9wYXJhbXMoIHtcclxuXHRcdFx0J2tleXdvcmQnOiBrZXl3b3JkLFxyXG5cdFx0XHQncGFnZV9udW0nOiAxXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoYW5kbGVfYm9va2VkX2Jhcl9jbGljayggJHBhZ2UsIGV2ZW50ICkge1xyXG5cdFx0dmFyICRiYXIgPSAkKCBldmVudC5jdXJyZW50VGFyZ2V0ICk7XHJcblx0XHR2YXIgJGxpbmsgPSAkKCBldmVudC50YXJnZXQgKS5jbG9zZXN0KCAnLndwYmNfdHNfYm9va2luZ19saW5rJyApO1xyXG5cdFx0dmFyIGJvb2tpbmdJZCA9ICRiYXIuYXR0ciggJ2RhdGEtd3BiYy10cy1ib29raW5nLWlkJyApIHx8ICRsaW5rLmF0dHIoICdkYXRhLXdwYmMtdHMtYm9va2luZy1pZCcgKTtcclxuXHRcdHZhciBib29raW5nVXJsID0gJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctdXJsJyApIHx8ICRsaW5rLmF0dHIoICdocmVmJyApO1xyXG5cclxuXHRcdGlmICggISBib29raW5nSWQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2Jvb2tpbmdfbGlzdGluZ19zZWFyY2hfYXZhaWxhYmxlKCkgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHRzZWFyY2hfYm9va2luZ19pbl9jdXJyZW50X2xpc3RpbmcoICRwYWdlLCBib29raW5nSWQgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISAkbGluay5sZW5ndGggJiYgYm9va2luZ1VybCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0d2luZG93LmxvY2F0aW9uLmhyZWYgPSBib29raW5nVXJsO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdW5pcXVlX2RhdGVzX2Zyb21fc2VsZWN0aW9ucyggJHBhZ2UgKSB7XHJcblx0XHR2YXIgZGF0ZXMgPSB7fTtcclxuXHRcdCQuZWFjaCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHQkLmVhY2goIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJbmRleCwgcm93SWQgKSB7XHJcblx0XHRcdFx0dmFyIGxhYmVsID0gcm93X2xhYmVsKCAkcGFnZSwgcm93SWQgKTtcclxuXHRcdFx0XHRpZiAoIGxhYmVsICkge1xyXG5cdFx0XHRcdFx0ZGF0ZXNbIGxhYmVsIF0gPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKCBkYXRlcyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGlvbl9wYXlsb2FkKCAkcGFnZSApIHtcclxuXHRcdHZhciBwYXlsb2FkID0gW107XHJcblxyXG5cdFx0JC5lYWNoKCBzZWxlY3Rpb25SYW5nZXMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdCQuZWFjaCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0luZGV4LCByb3dJZCApIHtcclxuXHRcdFx0XHR2YXIgJHJvdyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyByb3dJZCArICdcIl0nICk7XHJcblx0XHRcdFx0dmFyIGRhdGUgPSAkcm93LmF0dHIoICdkYXRhLXdwYmMtdHMtZGF0ZScgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGRhdGUgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRwYXlsb2FkLnB1c2goIHtcclxuXHRcdFx0XHRcdGRhdGU6IGRhdGUsXHJcblx0XHRcdFx0XHRzdGFydF9zZWNvbmQ6IGl0ZW0uc3RhcnQgKiA2MCxcclxuXHRcdFx0XHRcdGVuZF9zZWNvbmQ6IGl0ZW0uZW5kICogNjBcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRwYXlsb2FkLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApIHtcclxuXHRcdFx0aWYgKCBhLmRhdGUgIT09IGIuZGF0ZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5kYXRlIDwgYi5kYXRlID8gLTEgOiAxO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYS5zdGFydF9zZWNvbmQgIT09IGIuc3RhcnRfc2Vjb25kICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnN0YXJ0X3NlY29uZCAtIGIuc3RhcnRfc2Vjb25kO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhLmVuZF9zZWNvbmQgLSBiLmVuZF9zZWNvbmQ7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHBheWxvYWQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX2RhdGVzKCAkcGFnZSwgcm93cyApIHtcclxuXHRcdHZhciBkYXRlcyA9IFtdO1xyXG5cdFx0dmFyIHNlZW4gPSB7fTtcclxuXHJcblx0XHQkLmVhY2goIHJvd3MgfHwgW10sIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyByb3dJZCArICdcIl0nICk7XHJcblx0XHRcdHZhciBkYXRlID0gJHJvdy5hdHRyKCAnZGF0YS13cGJjLXRzLWRhdGUnICk7XHJcblxyXG5cdFx0XHRpZiAoIGRhdGUgJiYgISBzZWVuWyBkYXRlIF0gKSB7XHJcblx0XHRcdFx0c2VlblsgZGF0ZSBdID0gdHJ1ZTtcclxuXHRcdFx0XHRkYXRlcy5wdXNoKCBkYXRlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRkYXRlcy5zb3J0KCk7XHJcblx0XHRyZXR1cm4gZGF0ZXM7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfYWN0aXZlX2Jvb2tpbmdfc2VsZWN0aW9uX2NvbnRleHQoICRwYWdlICkge1xyXG5cdFx0dmFyIGl0ZW0gPSBhY3RpdmVTZWxlY3Rpb25JZCA/IGdldF9zZWxlY3Rpb25fYnlfaWQoIGFjdGl2ZVNlbGVjdGlvbklkICkgOiBudWxsO1xyXG5cdFx0dmFyIGRhdGVzO1xyXG5cclxuXHRcdGlmICggISBpdGVtICYmIDEgPT09IHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKSB7XHJcblx0XHRcdGl0ZW0gPSBzZWxlY3Rpb25SYW5nZXNbMF07XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGl0ZW0gfHwgISBpdGVtLnJvd3MgfHwgISBpdGVtLnJvd3MubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRkYXRlcyA9IGdldF9zZWxlY3Rpb25fZGF0ZXMoICRwYWdlLCBpdGVtLnJvd3MgKTtcclxuXHRcdGlmICggISBkYXRlcy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHJlc291cmNlX2lkOiBnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0c2VsZWN0ZWRfZGF0ZTogZGF0ZXNbMF0sXHJcblx0XHRcdHNlbGVjdGVkX2RhdGVzOiBkYXRlcy5qb2luKCAnLCcgKSxcclxuXHRcdFx0c2VsZWN0ZWRfdGltZTogbWludXRlc190b190aW1lKCBpdGVtLnN0YXJ0ICkgKyAnIC0gJyArIG1pbnV0ZXNfdG9fdGltZSggaXRlbS5lbmQgKSxcclxuXHRcdFx0c3RhcnRfc2Vjb25kOiBpdGVtLnN0YXJ0ICogNjAsXHJcblx0XHRcdGVuZF9zZWNvbmQ6IGl0ZW0uZW5kICogNjBcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjcmVhdGVfYm9va2luZ19mcm9tX2FjdGl2ZV9zZWxlY3Rpb24oICRwYWdlICkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gd2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIHx8IHt9O1xyXG5cdFx0dmFyIGxhYmVscyA9IHNldHRpbmdzLmkxOG4gfHwge307XHJcblx0XHR2YXIgY29udGV4dCA9IGdldF9hY3RpdmVfYm9va2luZ19zZWxlY3Rpb25fY29udGV4dCggJHBhZ2UgKTtcclxuXHRcdHZhciAkYWRkQm9va2luZ01vZGFsID0gJCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHJcblx0XHRpZiAoICEgY29udGV4dCApIHtcclxuXHRcdFx0aWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zZWxlY3Rfb25lX3Nsb3RfZm9yX2Jvb2tpbmcgfHwgJ1NlbGVjdCBvbmUgdGltZSByYW5nZSBvbiBvbmUgZGF0ZSBmaXJzdC4nLCAnd2FybmluZycsIDM1MDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbFxyXG5cdFx0XHR8fCAhICRhZGRCb29raW5nTW9kYWwubGVuZ3RoXHJcblx0XHRcdHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiAkYWRkQm9va2luZ01vZGFsLndwYmNfbXlfbW9kYWxcclxuXHRcdCkge1xyXG5cdFx0XHRpZiAoIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbGFiZWxzLmFkZF9ib29raW5nX21vZGFsX21pc3NpbmcgfHwgJ0FkZCBCb29raW5nIHBvcHVwIGlzIG5vdCBhdmFpbGFibGUgb24gdGhpcyBwYWdlLicsICd3YXJuaW5nJywgNTAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRjbG9zZV90aW1lX3Nsb3RzX3BvcHVwKCAkcGFnZSwgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR3aW5kb3cud3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsKCB7XHJcblx0XHRcdFx0bW9kZTogJ2FkZCcsXHJcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IGNvbnRleHQucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0Ym9va2luZ19mb3JtOiAnJyxcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlczogY29udGV4dC5zZWxlY3RlZF9kYXRlcyxcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlOiBjb250ZXh0LnNlbGVjdGVkX2RhdGUsXHJcblx0XHRcdFx0c2VsZWN0ZWRfdGltZTogY29udGV4dC5zZWxlY3RlZF90aW1lLFxyXG5cdFx0XHRcdHRpbWVfb3ZlcnJpZGVfZW5hYmxlZDogMSxcclxuXHRcdFx0XHR0aW1lX292ZXJyaWRlX3NvdXJjZTogJ3RpbWVzX2F2YWlsYWJpbGl0eScsXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9zdGFydDogbWludXRlc190b190aW1lKCBjb250ZXh0LnN0YXJ0X3NlY29uZCAvIDYwICksXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9lbmQ6IG1pbnV0ZXNfdG9fdGltZSggY29udGV4dC5lbmRfc2Vjb25kIC8gNjAgKVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbG9uZV9kYXRlKCBkYXRlICkge1xyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFkZF9kYXlzKCBkYXRlLCBkYXlzICkge1xyXG5cdFx0dmFyIG5leHQgPSBjbG9uZV9kYXRlKCBkYXRlICk7XHJcblx0XHRuZXh0LnNldERhdGUoIG5leHQuZ2V0RGF0ZSgpICsgZGF5cyApO1xyXG5cdFx0cmV0dXJuIG5leHQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmb3JtYXRfaXNvX2RhdGUoIGRhdGUgKSB7XHJcblx0XHRyZXR1cm4gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nICsgcGFkXzIoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJyArIHBhZF8yKCBkYXRlLmdldERhdGUoKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZm9ybWF0X3Jvd19kYXRlKCBkYXRlICkge1xyXG5cdFx0dmFyIGRheXMgPSBbICdTdW4nLCAnTW9uJywgJ1R1ZScsICdXZWQnLCAnVGh1JywgJ0ZyaScsICdTYXQnIF07XHJcblx0XHR2YXIgbW9udGhzID0gWyAnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnIF07XHJcblx0XHRyZXR1cm4gZGF5c1sgZGF0ZS5nZXREYXkoKSBdICsgJyAnICsgbW9udGhzWyBkYXRlLmdldE1vbnRoKCkgXSArICcgJyArIGRhdGUuZ2V0RGF0ZSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZm9ybWF0X2RhdGVfcmFuZ2VfZGlzcGxheSggc3RhcnREYXRlLCBlbmREYXRlICkge1xyXG5cdFx0cmV0dXJuICQuZGF0ZXBpY2suZm9ybWF0RGF0ZSggJ00gZCwgeXknLCBzdGFydERhdGUgKSArICcgLSAnICsgJC5kYXRlcGljay5mb3JtYXREYXRlKCAnTSBkLCB5eScsIGVuZERhdGUgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNhY2hlX3Jvd190ZW1wbGF0ZXMoICRwYWdlICkge1xyXG5cdFx0aWYgKCByb3dUZW1wbGF0ZXMubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRyb3dUZW1wbGF0ZXMgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93JyApLmNsb25lKCBmYWxzZSApLnRvQXJyYXkoKTtcclxuXHRcdCQuZWFjaCggcm93VGVtcGxhdGVzLCBmdW5jdGlvbiAoIGluZGV4LCByb3cgKSB7XHJcblx0XHRcdCQoIHJvdyApLmZpbmQoICcud3BiY190c19zZWxlY3Rpb246bm90KC53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZSknICkucmVtb3ZlKCk7XHJcblx0XHRcdCQoIHJvdyApLmZpbmQoICcud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUnICkucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlIGlzLWFjdGl2ZScgKS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVuc3VyZV9yb3dfY291bnQoICRwYWdlLCBjb3VudCApIHtcclxuXHRcdHZhciAkcm93c1dyYXAgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93cycgKTtcclxuXHRcdHZhciAkcm93cyA9ICRyb3dzV3JhcC5maW5kKCAnLndwYmNfdHNfcm93JyApO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgJGNsb25lO1xyXG5cclxuXHRcdGNvdW50ID0gTWF0aC5tYXgoIDEsIGNvdW50ICk7XHJcblx0XHRjYWNoZV9yb3dfdGVtcGxhdGVzKCAkcGFnZSApO1xyXG5cclxuXHRcdGlmICggJHJvd3MubGVuZ3RoID4gY291bnQgKSB7XHJcblx0XHRcdCRyb3dzLnNsaWNlKCBjb3VudCApLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIGkgPSAkcm93c1dyYXAuZmluZCggJy53cGJjX3RzX3JvdycgKS5sZW5ndGg7IGkgPCBjb3VudDsgaSsrICkge1xyXG5cdFx0XHQkY2xvbmUgPSAkKCByb3dUZW1wbGF0ZXNbIGkgJSByb3dUZW1wbGF0ZXMubGVuZ3RoIF0gKS5jbG9uZSggZmFsc2UgKTtcclxuXHRcdFx0JGNsb25lLmZpbmQoICcud3BiY190c19zZWxlY3Rpb246bm90KC53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZSknICkucmVtb3ZlKCk7XHJcblx0XHRcdCRjbG9uZS5maW5kKCAnLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlJyApLnJlbW92ZUNsYXNzKCAnaXMtdmlzaWJsZSBpcy1hY3RpdmUnICkuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICk7XHJcblx0XHRcdCRyb3dzV3JhcC5hcHBlbmQoICRjbG9uZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRyb3dzV3JhcC5maW5kKCAnLndwYmNfdHNfcm93JyApLmVhY2goIGZ1bmN0aW9uICggaW5kZXggKSB7XHJcblx0XHRcdCQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXJvdycsIFN0cmluZyggaW5kZXggKSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3Jvd3NfZm9yX2RhdGVfcmFuZ2UoICRwYWdlLCBzdGFydERhdGUsIGVuZERhdGUgKSB7XHJcblx0XHR2YXIgZGF5TXMgPSAyNCAqIDYwICogNjAgKiAxMDAwO1xyXG5cdFx0dmFyIGRheXNDb3VudCA9IE1hdGgucm91bmQoICggY2xvbmVfZGF0ZSggZW5kRGF0ZSApLmdldFRpbWUoKSAtIGNsb25lX2RhdGUoIHN0YXJ0RGF0ZSApLmdldFRpbWUoKSApIC8gZGF5TXMgKSArIDE7XHJcblxyXG5cdFx0ZGF5c0NvdW50ID0gTWF0aC5tYXgoIDEsIGRheXNDb3VudCApO1xyXG5cdFx0ZW5zdXJlX3Jvd19jb3VudCggJHBhZ2UsIGRheXNDb3VudCApO1xyXG5cclxuXHRcdCRwYWdlLmZpbmQoICcud3BiY190c19yb3cnICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApIHtcclxuXHRcdFx0dmFyIHJvd0RhdGUgPSBhZGRfZGF5cyggc3RhcnREYXRlLCBpbmRleCApO1xyXG5cdFx0XHQkKCB0aGlzIClcclxuXHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1kYXRlJywgZm9ybWF0X2lzb19kYXRlKCByb3dEYXRlICkgKVxyXG5cdFx0XHRcdC5maW5kKCAnLndwYmNfdHNfcm93X2xhYmVsX3RleHQnICkudGV4dCggZm9ybWF0X3Jvd19kYXRlKCByb3dEYXRlICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRzZWxlY3Rpb25SYW5nZXMgPSAkLmdyZXAoIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpdGVtICkge1xyXG5cdFx0XHRpdGVtLnJvd3MgPSAkLmdyZXAoIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXScgKS5sZW5ndGggPiAwO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybiBpdGVtLnJvd3MubGVuZ3RoID4gMDtcclxuXHRcdH0gKTtcclxuXHRcdGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBhY3RpdmVTZWxlY3Rpb25JZCApO1xyXG5cclxuXHRcdHBvc2l0aW9uX2JhcnMoICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uKCBzdHJpbmdEYXRlcywganNEYXRlc0FyciApIHtcclxuXHRcdHZhciBkYXRlcyA9IFtdO1xyXG5cdFx0dmFyIHBhcnRzO1xyXG5cdFx0dmFyIHN0YXJ0O1xyXG5cdFx0dmFyIGVuZDtcclxuXHJcblx0XHRpZiAoIGpzRGF0ZXNBcnIgJiYgQXJyYXkuaXNBcnJheSgganNEYXRlc0Fyci5yYW5nZSApICkge1xyXG5cdFx0XHRkYXRlcyA9IGpzRGF0ZXNBcnIucmFuZ2U7XHJcblx0XHR9IGVsc2UgaWYgKCBqc0RhdGVzQXJyICYmIEFycmF5LmlzQXJyYXkoIGpzRGF0ZXNBcnIubXVsdGlwbGUgKSApIHtcclxuXHRcdFx0ZGF0ZXMgPSBqc0RhdGVzQXJyLm11bHRpcGxlO1xyXG5cdFx0fSBlbHNlIGlmICggQXJyYXkuaXNBcnJheSgganNEYXRlc0FyciApICkge1xyXG5cdFx0XHRkYXRlcyA9IGpzRGF0ZXNBcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF0ZXMgPSAkLmdyZXAoIGRhdGVzLCBmdW5jdGlvbiAoIGRhdGUgKSB7XHJcblx0XHRcdHJldHVybiBkYXRlIGluc3RhbmNlb2YgRGF0ZSAmJiAhIGlzTmFOKCBkYXRlLmdldFRpbWUoKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGlmICggZGF0ZXMubGVuZ3RoICkge1xyXG5cdFx0XHRkYXRlcy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGNsb25lX2RhdGUoIGEgKS5nZXRUaW1lKCkgLSBjbG9uZV9kYXRlKCBiICkuZ2V0VGltZSgpO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHN0YXJ0OiBjbG9uZV9kYXRlKCBkYXRlc1swXSApLFxyXG5cdFx0XHRcdGVuZDogY2xvbmVfZGF0ZSggZGF0ZXNbIGRhdGVzLmxlbmd0aCAtIDEgXSApXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0cGFydHMgPSBTdHJpbmcoIHN0cmluZ0RhdGVzIHx8ICcnICkuc3BsaXQoICcgLSAnICk7XHJcblx0XHRzdGFydCA9IHBhcnNlX2RhdGVfdGV4dCggcGFydHNbMF0gKTtcclxuXHRcdGVuZCA9IHBhcnNlX2RhdGVfdGV4dCggcGFydHNbMV0gfHwgcGFydHNbMF0gKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0ICYmIGVuZCApIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRzdGFydDogc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBlbmRcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9kYXRlcGlja19zZWxlY3RlZF9yYW5nZSggJGRhdGUgKSB7XHJcblx0XHR2YXIgaW5zdDtcclxuXHJcblx0XHRpZiAoICEgJC5kYXRlcGljayB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgJC5kYXRlcGljay5fZ2V0SW5zdCB8fCAhICRkYXRlLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5zdCA9ICQuZGF0ZXBpY2suX2dldEluc3QoICRkYXRlWzBdICk7XHJcblx0XHRpZiAoICEgaW5zdCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBhcnNlX2RhdGVwaWNrX3NlbGVjdGlvbiggJGRhdGUudmFsKCksICQuZGF0ZXBpY2suX2dldERhdGUoIGluc3QgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCByYW5nZSwgb3B0aW9ucyApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgc3RhcnREYXRlO1xyXG5cdFx0dmFyIGVuZERhdGU7XHJcblx0XHR2YXIgc3RhcnRJc287XHJcblx0XHR2YXIgZW5kSXNvO1xyXG5cdFx0dmFyIGN1cnJlbnRLZXk7XHJcblx0XHR2YXIgbmV4dEtleTtcclxuXHJcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHJcblx0XHRpZiAoICEgcmFuZ2UgfHwgISByYW5nZS5zdGFydCB8fCAhIHJhbmdlLmVuZCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXJ0RGF0ZSA9IGNsb25lX2RhdGUoIHJhbmdlLnN0YXJ0ICk7XHJcblx0XHRlbmREYXRlID0gY2xvbmVfZGF0ZSggcmFuZ2UuZW5kICk7XHJcblxyXG5cdFx0aWYgKCBzdGFydERhdGUuZ2V0VGltZSgpID4gZW5kRGF0ZS5nZXRUaW1lKCkgKSB7XHJcblx0XHRcdHJhbmdlID0gc3RhcnREYXRlO1xyXG5cdFx0XHRzdGFydERhdGUgPSBlbmREYXRlO1xyXG5cdFx0XHRlbmREYXRlID0gcmFuZ2U7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhcnRJc28gPSBmb3JtYXRfaXNvX2RhdGUoIHN0YXJ0RGF0ZSApO1xyXG5cdFx0ZW5kSXNvID0gZm9ybWF0X2lzb19kYXRlKCBlbmREYXRlICk7XHJcblx0XHRjdXJyZW50S2V5ID0gJGRhdGUuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcgKSArICc6JyArICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApO1xyXG5cdFx0bmV4dEtleSA9IHN0YXJ0SXNvICsgJzonICsgZW5kSXNvO1xyXG5cclxuXHRcdGlmICggY3VycmVudEtleSA9PT0gbmV4dEtleSApIHtcclxuXHRcdFx0JGRhdGUudmFsKCBmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5KCBzdGFydERhdGUsIGVuZERhdGUgKSApO1xyXG5cdFx0XHRpZiAoIG9wdGlvbnMuZm9yY2VfcmVsb2FkICkge1xyXG5cdFx0XHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRkYXRlXHJcblx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0Jywgc3RhcnRJc28gKVxyXG5cdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnLCBlbmRJc28gKVxyXG5cdFx0XHQudmFsKCBmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5KCBzdGFydERhdGUsIGVuZERhdGUgKSApO1xyXG5cclxuXHRcdHVwZGF0ZV9yb3dzX2Zvcl9kYXRlX3JhbmdlKCAkcGFnZSwgc3RhcnREYXRlLCBlbmREYXRlICk7XHJcblx0XHRsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApO1xyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19kYXRlX3JhbmdlX2Zyb21faW5wdXQoICRwYWdlICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciByYW5nZSA9IGdldF9kYXRlcGlja19zZWxlY3RlZF9yYW5nZSggJGRhdGUgKSB8fCBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oICRkYXRlLnZhbCgpLCBudWxsICk7XHJcblxyXG5cdFx0YXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCByYW5nZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2RhdGVfcmFuZ2VfZnJvbV9kYXRhX2F0dHJzKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgc3RhcnREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApICk7XHJcblx0XHR2YXIgZW5kRGF0ZSA9IHBhcnNlX2RhdGVfdGV4dCggJGRhdGUuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICkgKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0RGF0ZSAmJiBlbmREYXRlICkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHN0YXJ0OiBzdGFydERhdGUsXHJcblx0XHRcdFx0ZW5kOiBlbmREYXRlXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfY3VycmVudF9kYXRlX3JhbmdlKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgcmFuZ2UgPSBnZXRfZGF0ZV9yYW5nZV9mcm9tX2RhdGFfYXR0cnMoICRwYWdlICkgfHwgcGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uKCAkZGF0ZS52YWwoKSwgbnVsbCApO1xyXG5cclxuXHRcdGlmICggcmFuZ2UgKSB7XHJcblx0XHRcdHJldHVybiByYW5nZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdGFydDogcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApICksXHJcblx0XHRcdGVuZDogcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcgKSApXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2hpZnRfZGF0ZV9yYW5nZSggJHBhZ2UsIGRpcmVjdGlvbiApIHtcclxuXHRcdHZhciByYW5nZSA9IGdldF9jdXJyZW50X2RhdGVfcmFuZ2UoICRwYWdlICk7XHJcblx0XHR2YXIgZGF5TXMgPSAyNCAqIDYwICogNjAgKiAxMDAwO1xyXG5cdFx0dmFyIGRheXNDb3VudDtcclxuXHRcdHZhciBzaGlmdDtcclxuXHJcblx0XHRpZiAoICEgcmFuZ2UgfHwgISByYW5nZS5zdGFydCB8fCAhIHJhbmdlLmVuZCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRheXNDb3VudCA9IE1hdGgucm91bmQoICggY2xvbmVfZGF0ZSggcmFuZ2UuZW5kICkuZ2V0VGltZSgpIC0gY2xvbmVfZGF0ZSggcmFuZ2Uuc3RhcnQgKS5nZXRUaW1lKCkgKSAvIGRheU1zICkgKyAxO1xyXG5cdFx0c2hpZnQgPSBNYXRoLm1heCggMSwgZGF5c0NvdW50ICkgKiAoICdwcmV2JyA9PT0gZGlyZWN0aW9uID8gLTEgOiAxICk7XHJcblxyXG5cdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0cmV0dXJuIGFwcGx5X2RhdGVfcmFuZ2Vfc2VsZWN0aW9uKCAkcGFnZSwge1xyXG5cdFx0XHRzdGFydDogYWRkX2RheXMoIHJhbmdlLnN0YXJ0LCBzaGlmdCApLFxyXG5cdFx0XHRlbmQ6IGFkZF9kYXlzKCByYW5nZS5lbmQsIHNoaWZ0IClcclxuXHRcdH0sIHtcclxuXHRcdFx0Zm9yY2VfcmVsb2FkOiB0cnVlXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwYXJzZV9kYXRlX3RleHQoIHRleHQgKSB7XHJcblx0XHR2YXIgcGFyc2VkO1xyXG5cdFx0dmFyIHNxbE1hdGNoO1xyXG5cclxuXHRcdHRleHQgPSB0cmltX3RleHQoIHRleHQgKTtcclxuXHRcdGlmICggISB0ZXh0ICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRzcWxNYXRjaCA9IHRleHQubWF0Y2goIC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkvICk7XHJcblx0XHRpZiAoIHNxbE1hdGNoICkge1xyXG5cdFx0XHRyZXR1cm4gbmV3IERhdGUoIHBhcnNlSW50KCBzcWxNYXRjaFsxXSwgMTAgKSwgcGFyc2VJbnQoIHNxbE1hdGNoWzJdLCAxMCApIC0gMSwgcGFyc2VJbnQoIHNxbE1hdGNoWzNdLCAxMCApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAkLmRhdGVwaWNrICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiAkLmRhdGVwaWNrLnBhcnNlRGF0ZSApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRwYXJzZWQgPSAkLmRhdGVwaWNrLnBhcnNlRGF0ZSggJ00gZCwgeXknLCB0ZXh0ICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcclxuXHRcdFx0XHRwYXJzZWQgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIHBhcnNlZCApIHtcclxuXHRcdFx0cGFyc2VkID0gbmV3IERhdGUoIHRleHQgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcGFyc2VkIGluc3RhbmNlb2YgRGF0ZSAmJiAhIGlzTmFOKCBwYXJzZWQuZ2V0VGltZSgpICkgPyBjbG9uZV9kYXRlKCBwYXJzZWQgKSA6IG51bGw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfdGltZV9zbG90c19jb250ZXh0KCBjb250ZXh0LCBvcHRpb25zICkge1xyXG5cdFx0dmFyICRjb250ZXh0ID0gY29udGV4dCA/ICQoIGNvbnRleHQgKSA6ICQoIGRvY3VtZW50ICk7XHJcblx0XHR2YXIgJHBhZ2UgPSAkY29udGV4dC5pcyggJy53cGJjX3RzX3BhZ2UnICkgPyAkY29udGV4dCA6ICRjb250ZXh0LmZpbmQoICcud3BiY190c19wYWdlJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgc3RhcnREYXRlO1xyXG5cdFx0dmFyIGVuZERhdGU7XHJcblx0XHR2YXIgcmVzb3VyY2VDaGFuZ2VkID0gZmFsc2U7XHJcblx0XHR2YXIgcmFuZ2VDaGFuZ2VkID0gZmFsc2U7XHJcblxyXG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcblxyXG5cdFx0aWYgKCAhICRwYWdlLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGluaXRfdGltZV9zbG90c19wYWdlKCAkcGFnZSwgdHJ1ZSApO1xyXG5cclxuXHRcdGlmICggb3B0aW9ucy5yZXNvdXJjZV9pZCApIHtcclxuXHRcdFx0cmVzb3VyY2VDaGFuZ2VkID0gU3RyaW5nKCBnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoKSApICE9PSBTdHJpbmcoIG9wdGlvbnMucmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAncmVzb3VyY2UnICkudmFsKCBTdHJpbmcoIG9wdGlvbnMucmVzb3VyY2VfaWQgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXJ0RGF0ZSA9IHBhcnNlX2RhdGVfdGV4dCggb3B0aW9ucy5kYXRlX3N0YXJ0ICk7XHJcblx0XHRlbmREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCBvcHRpb25zLmRhdGVfZW5kICkgfHwgc3RhcnREYXRlO1xyXG5cclxuXHRcdGlmICggc3RhcnREYXRlICYmIGVuZERhdGUgKSB7XHJcblx0XHRcdGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdFx0cmFuZ2VDaGFuZ2VkID0gYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCB7XHJcblx0XHRcdFx0c3RhcnQ6IHN0YXJ0RGF0ZSxcclxuXHRcdFx0XHRlbmQ6IGVuZERhdGVcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggcmVzb3VyY2VDaGFuZ2VkICYmIHJhbmdlQ2hhbmdlZCApIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCByZXNvdXJjZUNoYW5nZWQgfHwgISByYW5nZUNoYW5nZWQgKSB7XHJcblx0XHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByb3dfZnJvbV9wb2ludGVyKCAkcGFnZSwgZXZlbnQgKSB7XHJcblx0XHR2YXIgb3JpZ2luYWwgPSBldmVudC5vcmlnaW5hbEV2ZW50IHx8IGV2ZW50O1xyXG5cdFx0dmFyIHBvaW50ID0gb3JpZ2luYWwudG91Y2hlcyAmJiBvcmlnaW5hbC50b3VjaGVzLmxlbmd0aCA/IG9yaWdpbmFsLnRvdWNoZXNbMF0gOiBvcmlnaW5hbDtcclxuXHRcdHZhciBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoIHBvaW50LmNsaWVudFgsIHBvaW50LmNsaWVudFkgKTtcclxuXHRcdHZhciAkcm93ID0gJCggZWwgKS5jbG9zZXN0KCAnLndwYmNfdHNfcm93JyApO1xyXG5cclxuXHRcdGlmICggISAkcm93Lmxlbmd0aCB8fCAhICQuY29udGFpbnMoICRwYWdlWzBdLCAkcm93WzBdICkgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAkcm93LmF0dHIoICdkYXRhLXdwYmMtdHMtcm93JyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbWludXRlX2Zyb21fcG9pbnRlciggZXZlbnQsICRsYW5lICkge1xyXG5cdFx0dmFyIG9yaWdpbmFsID0gZXZlbnQub3JpZ2luYWxFdmVudCB8fCBldmVudDtcclxuXHRcdHZhciBwb2ludCA9IG9yaWdpbmFsLnRvdWNoZXMgJiYgb3JpZ2luYWwudG91Y2hlcy5sZW5ndGggPyBvcmlnaW5hbC50b3VjaGVzWzBdIDogb3JpZ2luYWw7XHJcblx0XHR2YXIgJGdyaWQgPSAkbGFuZS5jbG9zZXN0KCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblx0XHR2YXIgcmVjdCA9ICRsYW5lWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0dmFyIHJhdGlvID0gKCBwb2ludC5jbGllbnRYIC0gcmVjdC5sZWZ0ICkgLyByZWN0LndpZHRoO1xyXG5cdFx0dmFyIG1pbnV0ZSA9IGNvbmZpZy5zdGFydCArIHJhdGlvICogKCBjb25maWcuZW5kIC0gY29uZmlnLnN0YXJ0ICk7XHJcblxyXG5cdFx0cmV0dXJuIGNsYW1wKCBzbmFwX21pbnV0ZSggbWludXRlLCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNyZWF0ZV9zZWxlY3Rpb24oICRwYWdlLCByb3dzLCBzdGFydCwgZW5kICkge1xyXG5cdFx0dmFyICRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblx0XHR2YXIgY29uZmlnID0gZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApO1xyXG5cdFx0dmFyIHJhbmdlID0gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggc3RhcnQsIGVuZCwgY29uZmlnICk7XHJcblx0XHR2YXIgaXRlbSA9IHtcclxuXHRcdFx0aWQ6ICdzZWxlY3Rpb25fJyArIG5leHRTZWxlY3Rpb25JZCsrLFxyXG5cdFx0XHRzdGFydDogcmFuZ2Uuc3RhcnQsXHJcblx0XHRcdGVuZDogcmFuZ2UuZW5kLFxyXG5cdFx0XHRyb3dzOiByb3dzLnNsaWNlKCAwIClcclxuXHRcdH07XHJcblxyXG5cdFx0c2VsZWN0aW9uUmFuZ2VzLnB1c2goIGl0ZW0gKTtcclxuXHRcdGFjdGl2ZVNlbGVjdGlvbklkID0gaXRlbS5pZDtcclxuXHRcdGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBpdGVtLmlkICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHRcdHJldHVybiBnZXRfc2VsZWN0aW9uX2J5X2lkKCBhY3RpdmVTZWxlY3Rpb25JZCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3NlbGVjdGlvbiggJHBhZ2UsIHNlbGVjdGlvbklkLCByb3dzLCBzdGFydCwgZW5kICkge1xyXG5cdFx0dmFyICRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblx0XHR2YXIgY29uZmlnID0gZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApO1xyXG5cdFx0dmFyIHJhbmdlID0gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggc3RhcnQsIGVuZCwgY29uZmlnICk7XHJcblx0XHR2YXIgaXRlbSA9IGdldF9zZWxlY3Rpb25fYnlfaWQoIHNlbGVjdGlvbklkICk7XHJcblxyXG5cdFx0aWYgKCAhIGl0ZW0gKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpdGVtLnN0YXJ0ID0gcmFuZ2Uuc3RhcnQ7XHJcblx0XHRpdGVtLmVuZCA9IHJhbmdlLmVuZDtcclxuXHRcdGl0ZW0ucm93cyA9IHJvd3Muc2xpY2UoIDAgKTtcclxuXHRcdGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBzZWxlY3Rpb25JZCApO1xyXG5cdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjYW5vbmljYWxpemVfc2VsZWN0aW9ucyggcHJlZmVycmVkQWN0aXZlSWQgKSB7XHJcblx0XHR2YXIgaW50ZXJ2YWxzID0gW107XHJcblx0XHR2YXIgbWVyZ2VkID0gW107XHJcblx0XHR2YXIgZ3JvdXBzID0gW107XHJcblx0XHR2YXIgbmV3QWN0aXZlSWQgPSAnJztcclxuXHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdGludGVydmFscy5wdXNoKCB7XHJcblx0XHRcdFx0XHRyb3c6IHBhcnNlSW50KCByb3dJZCwgMTAgKSxcclxuXHRcdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRcdGFjdGl2ZTogaXRlbS5pZCA9PT0gcHJlZmVycmVkQWN0aXZlSWQgfHwgaXRlbS5pZCA9PT0gYWN0aXZlU2VsZWN0aW9uSWRcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRpbnRlcnZhbHMuc29ydCggZnVuY3Rpb24gKCBhLCBiICkge1xyXG5cdFx0XHRpZiAoIGEucm93ICE9PSBiLnJvdyApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5yb3cgLSBiLnJvdztcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGEuc3RhcnQgIT09IGIuc3RhcnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuc3RhcnQgLSBiLnN0YXJ0O1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhLmVuZCAtIGIuZW5kO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQuZWFjaCggaW50ZXJ2YWxzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHR2YXIgbGFzdCA9IG1lcmdlZFsgbWVyZ2VkLmxlbmd0aCAtIDEgXTtcclxuXHJcblx0XHRcdGlmICggbGFzdCAmJiBsYXN0LnJvdyA9PT0gaXRlbS5yb3cgJiYgaXRlbS5zdGFydCA8PSBsYXN0LmVuZCApIHtcclxuXHRcdFx0XHRsYXN0LmVuZCA9IE1hdGgubWF4KCBsYXN0LmVuZCwgaXRlbS5lbmQgKTtcclxuXHRcdFx0XHRsYXN0LmFjdGl2ZSA9IGxhc3QuYWN0aXZlIHx8IGl0ZW0uYWN0aXZlO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWVyZ2VkLnB1c2goIHtcclxuXHRcdFx0XHRyb3c6IGl0ZW0ucm93LFxyXG5cdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0YWN0aXZlOiBpdGVtLmFjdGl2ZVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0bWVyZ2VkLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApIHtcclxuXHRcdFx0aWYgKCBhLnN0YXJ0ICE9PSBiLnN0YXJ0ICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnN0YXJ0IC0gYi5zdGFydDtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGEuZW5kICE9PSBiLmVuZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5lbmQgLSBiLmVuZDtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gYS5yb3cgLSBiLnJvdztcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkLmVhY2goIG1lcmdlZCwgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0dmFyIGxhc3QgPSBncm91cHNbIGdyb3Vwcy5sZW5ndGggLSAxIF07XHJcblxyXG5cdFx0XHRpZiAoIGxhc3QgJiYgbGFzdC5zdGFydCA9PT0gaXRlbS5zdGFydCAmJiBsYXN0LmVuZCA9PT0gaXRlbS5lbmQgJiYgbGFzdC5sYXN0Um93ICsgMSA9PT0gaXRlbS5yb3cgKSB7XHJcblx0XHRcdFx0bGFzdC5yb3dzLnB1c2goIFN0cmluZyggaXRlbS5yb3cgKSApO1xyXG5cdFx0XHRcdGxhc3QubGFzdFJvdyA9IGl0ZW0ucm93O1xyXG5cdFx0XHRcdGxhc3QuYWN0aXZlID0gbGFzdC5hY3RpdmUgfHwgaXRlbS5hY3RpdmU7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRncm91cHMucHVzaCgge1xyXG5cdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0cm93czogWyBTdHJpbmcoIGl0ZW0ucm93ICkgXSxcclxuXHRcdFx0XHRsYXN0Um93OiBpdGVtLnJvdyxcclxuXHRcdFx0XHRhY3RpdmU6IGl0ZW0uYWN0aXZlXHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRzZWxlY3Rpb25SYW5nZXMgPSAkLm1hcCggZ3JvdXBzLCBmdW5jdGlvbiAoIGl0ZW0gKSB7XHJcblx0XHRcdHZhciBpZCA9ICdzZWxlY3Rpb25fJyArIG5leHRTZWxlY3Rpb25JZCsrO1xyXG5cclxuXHRcdFx0aWYgKCBpdGVtLmFjdGl2ZSAmJiAhIG5ld0FjdGl2ZUlkICkge1xyXG5cdFx0XHRcdG5ld0FjdGl2ZUlkID0gaWQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0aWQ6IGlkLFxyXG5cdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0cm93czogaXRlbS5yb3dzXHJcblx0XHRcdH07XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSBuZXdBY3RpdmVJZCB8fCAoIHNlbGVjdGlvblJhbmdlc1swXSA/IHNlbGVjdGlvblJhbmdlc1swXS5pZCA6ICcnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5yZW1vdmUoKTtcclxuXHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0dmFyIHJhbmdlID0gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggaXRlbS5zdGFydCwgaXRlbS5lbmQsIGNvbmZpZyApO1xyXG5cdFx0XHR2YXIgbGVmdCA9IHBlcmNlbnRfZm9yX21pbnV0ZSggcmFuZ2Uuc3RhcnQsIGNvbmZpZyApO1xyXG5cdFx0XHR2YXIgd2lkdGggPSBwZXJjZW50X2Zvcl9taW51dGUoIHJhbmdlLmVuZCwgY29uZmlnICkgLSBsZWZ0O1xyXG5cclxuXHRcdFx0aXRlbS5zdGFydCA9IHJhbmdlLnN0YXJ0O1xyXG5cdFx0XHRpdGVtLmVuZCA9IHJhbmdlLmVuZDtcclxuXHJcblx0XHRcdCQuZWFjaCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0luZGV4LCByb3dJZCApIHtcclxuXHRcdFx0XHR2YXIgJHJvdyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyByb3dJZCArICdcIl0nICk7XHJcblx0XHRcdFx0dmFyICRsYW5lID0gJHJvdy5maW5kKCAnLndwYmNfdHNfbGFuZScgKTtcclxuXHRcdFx0XHR2YXIgJHRlbXBsYXRlID0gJGxhbmUuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZScgKS5maXJzdCgpO1xyXG5cdFx0XHRcdHZhciAkc2VsZWN0aW9uO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgJGxhbmUubGVuZ3RoIHx8ICEgJHRlbXBsYXRlLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdCRzZWxlY3Rpb24gPSAkdGVtcGxhdGUuY2xvbmUoIGZhbHNlICk7XHJcblx0XHRcdFx0aWYgKCAkc2VsZWN0aW9uWzBdICkge1xyXG5cdFx0XHRcdFx0JHNlbGVjdGlvblswXS5oaWRkZW4gPSBmYWxzZTtcclxuXHRcdFx0XHRcdCRzZWxlY3Rpb25bMF0ucmVtb3ZlQXR0cmlidXRlKCAnaGlkZGVuJyApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0JHNlbGVjdGlvblxyXG5cdFx0XHRcdFx0LnJlbW92ZUNsYXNzKCAnd3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUnIClcclxuXHRcdFx0XHRcdC5hZGRDbGFzcyggJ2lzLXZpc2libGUnIClcclxuXHRcdFx0XHRcdC50b2dnbGVDbGFzcyggJ2lzLWFjdGl2ZScsIGl0ZW0uaWQgPT09IGFjdGl2ZVNlbGVjdGlvbklkIClcclxuXHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXNlbGVjdGlvbi1pZCcsIGl0ZW0uaWQgKVxyXG5cdFx0XHRcdFx0LmNzcyggeyBsZWZ0OiBsZWZ0ICsgJyUnLCB3aWR0aDogd2lkdGggKyAnJScgfSApO1xyXG5cclxuXHRcdFx0XHQkc2VsZWN0aW9uLmZpbmQoICcud3BiY190c190aW1lX2NoaXBfc3RhcnQnICkudGV4dCggbWludXRlc190b190aW1lKCByYW5nZS5zdGFydCApICk7XHJcblx0XHRcdFx0JHNlbGVjdGlvbi5maW5kKCAnLndwYmNfdHNfdGltZV9jaGlwX2VuZCcgKS50ZXh0KCBtaW51dGVzX3RvX3RpbWUoIHJhbmdlLmVuZCApICk7XHJcblx0XHRcdFx0JGxhbmUuYXBwZW5kKCAkc2VsZWN0aW9uICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHR1cGRhdGVfc3VtbWFyeSggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKSB7XHJcblx0XHRzZWxlY3Rpb25SYW5nZXMgPSBbXTtcclxuXHRcdGFjdGl2ZVNlbGVjdGlvbklkID0gJyc7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVwZGF0ZV9zdW1tYXJ5KCAkcGFnZSApIHtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApICk7XHJcblx0XHR2YXIgc2xvdENvdW50ID0gMDtcclxuXHRcdHZhciBkYXRlcyA9IHt9O1xyXG5cdFx0dmFyIGRhdGVzQ291bnQgPSAwO1xyXG5cdFx0dmFyIGRhdGVUZXh0ID0gJy0nO1xyXG5cdFx0dmFyIHRpbWVUZXh0ID0gJy0nO1xyXG5cdFx0dmFyIGRldGFpbHMgPSBbXTtcclxuXHRcdHZhciBkZXRhaWxzSHRtbCA9ICcnO1xyXG5cclxuXHRcdCQuZWFjaCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHRzbG90Q291bnQgKz0gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoICggaXRlbS5lbmQgLSBpdGVtLnN0YXJ0ICkgLyBjb25maWcuc3RlcCApICogaXRlbS5yb3dzLmxlbmd0aCApO1xyXG5cclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdHZhciBsYWJlbCA9IHJvd19sYWJlbCggJHBhZ2UsIHJvd0lkICk7XHJcblxyXG5cdFx0XHRcdGlmICggISBsYWJlbCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGRhdGVzWyBsYWJlbCBdID0gdHJ1ZTtcclxuXHRcdFx0XHRkZXRhaWxzLnB1c2goIHtcclxuXHRcdFx0XHRcdHJvdzogcGFyc2VJbnQoIHJvd0lkLCAxMCApLFxyXG5cdFx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0XHRlbmQ6IGl0ZW0uZW5kLFxyXG5cdFx0XHRcdFx0bGFiZWw6IGxhYmVsXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0ZGV0YWlscy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKSB7XHJcblx0XHRcdGlmICggYS5yb3cgIT09IGIucm93ICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnJvdyAtIGIucm93O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYS5zdGFydCAhPT0gYi5zdGFydCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5zdGFydCAtIGIuc3RhcnQ7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGEuZW5kIC0gYi5lbmQ7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JC5lYWNoKCBkZXRhaWxzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHR2YXIgdGltZUxhYmVsID0gbWludXRlc190b190aW1lKCBpdGVtLnN0YXJ0ICkgKyAnIC0gJyArIG1pbnV0ZXNfdG9fdGltZSggaXRlbS5lbmQgKTtcclxuXHJcblx0XHRcdGRldGFpbHNIdG1sICs9ICc8ZGl2IGNsYXNzPVwid3BiY190c19zZWxlY3Rpb25fZGV0YWlsX2l0ZW1cIj4nXHJcblx0XHRcdFx0KyAnPHNwYW4gY2xhc3M9XCJ3cGJjX3RzX3NlbGVjdGlvbl9kZXRhaWxfZGF0ZVwiPicgKyBlc2NhcGVfaHRtbCggaXRlbS5sYWJlbCApICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0KyAnPHNwYW4gY2xhc3M9XCJ3cGJjX3RzX3NlbGVjdGlvbl9kZXRhaWxfdGltZVwiPicgKyBlc2NhcGVfaHRtbCggdGltZUxhYmVsICkgKyAnPC9zcGFuPidcclxuXHRcdFx0XHQrICc8L2Rpdj4nO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGRhdGVzQ291bnQgPSBPYmplY3Qua2V5cyggZGF0ZXMgKS5sZW5ndGg7XHJcblxyXG5cdFx0aWYgKCBzZWxlY3Rpb25SYW5nZXMubGVuZ3RoICkge1xyXG5cdFx0XHRkYXRlVGV4dCA9IGRhdGVzQ291bnQgKyAoIDEgPT09IGRhdGVzQ291bnQgPyAnIGRhdGUnIDogJyBkYXRlcycgKTtcclxuXHRcdFx0dGltZVRleHQgPSBzZWxlY3Rpb25SYW5nZXMubGVuZ3RoICsgKCAxID09PSBzZWxlY3Rpb25SYW5nZXMubGVuZ3RoID8gJyBpbnRlcnZhbCcgOiAnIGludGVydmFscycgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgZGV0YWlsc0h0bWwgKSB7XHJcblx0XHRcdGRldGFpbHNIdG1sID0gJzxkaXYgY2xhc3M9XCJ3cGJjX3RzX3NlbGVjdGlvbl9kZXRhaWxzX2VtcHR5XCI+Tm8gdGltZSBzbG90cyBzZWxlY3RlZC48L2Rpdj4nO1xyXG5cdFx0fVxyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkuZmluZCggJ1tkYXRhLXdwYmMtdHMtZGV0YWlsPVwic2xvdHNcIl0nICkudGV4dCggc2xvdENvdW50ICk7XHJcblx0XHQkKCBkb2N1bWVudCApLmZpbmQoICdbZGF0YS13cGJjLXRzLWRldGFpbD1cImRhdGVzXCJdJyApLnRleHQoIGRhdGVUZXh0ICk7XHJcblx0XHQkKCBkb2N1bWVudCApLmZpbmQoICdbZGF0YS13cGJjLXRzLWRldGFpbD1cInRpbWVcIl0nICkudGV4dCggdGltZVRleHQgKTtcclxuXHRcdCQoIGRvY3VtZW50ICkuZmluZCggJ1tkYXRhLXdwYmMtdHMtZGV0YWlsPVwic2VsZWN0aW9uX2xpc3RcIl0nICkuaHRtbCggZGV0YWlsc0h0bWwgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNob3dfbGl2ZV90aXAoICRwYWdlLCBldmVudCApIHtcclxuXHRcdHZhciBvcmlnaW5hbCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQ7XHJcblx0XHR2YXIgcG9pbnQgPSBvcmlnaW5hbC50b3VjaGVzICYmIG9yaWdpbmFsLnRvdWNoZXMubGVuZ3RoID8gb3JpZ2luYWwudG91Y2hlc1swXSA6IG9yaWdpbmFsO1xyXG5cdFx0dmFyICR0aXAgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfbGl2ZV90aXAnICk7XHJcblx0XHR2YXIgYWN0aXZlID0gZ2V0X3NlbGVjdGlvbl9ieV9pZCggYWN0aXZlU2VsZWN0aW9uSWQgKTtcclxuXHJcblx0XHRpZiAoICEgYWN0aXZlICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhICR0aXAubGVuZ3RoICkge1xyXG5cdFx0XHQkdGlwID0gJCggJzxkaXYgY2xhc3M9XCJ3cGJjX3RzX2xpdmVfdGlwXCI+PC9kaXY+JyApLmFwcGVuZFRvKCAkcGFnZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdCR0aXBcclxuXHRcdFx0LnRleHQoIG1pbnV0ZXNfdG9fdGltZSggYWN0aXZlLnN0YXJ0ICkgKyAnIC0gJyArIG1pbnV0ZXNfdG9fdGltZSggYWN0aXZlLmVuZCApIClcclxuXHRcdFx0LmNzcygge1xyXG5cdFx0XHRcdGxlZnQ6IHBvaW50LnBhZ2VYICsgMTIgKyAncHgnLFxyXG5cdFx0XHRcdHRvcDogcG9pbnQucGFnZVkgLSAzOCArICdweCdcclxuXHRcdFx0fSApXHJcblx0XHRcdC5hZGRDbGFzcyggJ2lzLXZpc2libGUnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoaWRlX2xpdmVfdGlwKCAkcGFnZSApIHtcclxuXHRcdCRwYWdlLmZpbmQoICcud3BiY190c19saXZlX3RpcCcgKS5yZW1vdmVDbGFzcyggJ2lzLXZpc2libGUnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX3Nsb3Rfc3RlcF9jb250cm9scyggJHBhZ2UsIHN0ZXAgKSB7XHJcblx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdzbG90X3N0ZXAnICkudmFsKCBTdHJpbmcoIHN0ZXAgKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfc2xvdF9zdGVwJyApLnZhbCggU3RyaW5nKCBzdGVwICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfem9vbV9jb250cm9scyggJHBhZ2UsIHN0ZXAgKSB7XHJcblx0XHR2YXIgaW5kZXggPSB6b29tU3RlcHMuaW5kZXhPZiggc3RlcCApO1xyXG5cdFx0aWYgKCAtMSA9PT0gaW5kZXggKSB7XHJcblx0XHRcdGluZGV4ID0gMjtcclxuXHRcdH1cclxuXHRcdGdldF9jb250cm9sKCAkcGFnZSwgJ3pvb20nICkudmFsKCBTdHJpbmcoIGluZGV4ICkgKTtcclxuXHRcdCQoICcjd3BiY190c19zaWRlX3pvb20nICkudmFsKCBTdHJpbmcoIGluZGV4ICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9zdGVwKCAkcGFnZSwgc3RlcCApIHtcclxuXHRcdHZhciAkZ3JpZCA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApO1xyXG5cdFx0JGdyaWQuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGVwJywgc3RlcCApO1xyXG5cdFx0c3luY19zbG90X3N0ZXBfY29udHJvbHMoICRwYWdlLCBzdGVwICk7XHJcblx0XHRzeW5jX3pvb21fY29udHJvbHMoICRwYWdlLCBzdGVwICk7XHJcblx0XHRyZW5kZXJfYXhpcyggJGdyaWQgKTtcclxuXHRcdHBvc2l0aW9uX2JhcnMoICRncmlkICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfdmlzaWJsZV90aW1lX2NvbnRyb2xzKCAkcGFnZSwgc3RhcnQsIGVuZCApIHtcclxuXHRcdGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9zdGFydCcgKS52YWwoIFN0cmluZyggc3RhcnQgKSApO1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X2VuZCcgKS52YWwoIFN0cmluZyggZW5kICkgKTtcclxuXHRcdGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9zdGFydF9zbGlkZXInICkudmFsKCBTdHJpbmcoIHN0YXJ0ICkgKTtcclxuXHRcdGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9lbmRfc2xpZGVyJyApLnZhbCggU3RyaW5nKCBlbmQgKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfc3RhcnQnICkudmFsKCBTdHJpbmcoIHN0YXJ0ICkgKTtcclxuXHRcdCQoICcjd3BiY190c19zaWRlX2VuZCcgKS52YWwoIFN0cmluZyggZW5kICkgKTtcclxuXHRcdCQoICcjd3BiY190c19zaWRlX3N0YXJ0X3NsaWRlcicgKS52YWwoIFN0cmluZyggc3RhcnQgKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfZW5kX3NsaWRlcicgKS52YWwoIFN0cmluZyggZW5kICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF92aXNpYmxlX3RpbWVfcmFuZ2UoICRwYWdlLCBzdGFydCwgZW5kICkge1xyXG5cdFx0dmFyICRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblxyXG5cdFx0c3RhcnQgPSBwYXJzZUludCggc3RhcnQsIDEwICk7XHJcblx0XHRlbmQgPSBwYXJzZUludCggZW5kLCAxMCApO1xyXG5cclxuXHRcdGlmICggZW5kIDw9IHN0YXJ0ICkge1xyXG5cdFx0XHRpZiAoICQoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgKS5pcyggJ1tkYXRhLXdwYmMtdHMtY29udHJvbD1cImRheV9zdGFydFwiXSwgW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X3N0YXJ0X3NsaWRlclwiXSwgI3dwYmNfdHNfZGF5X3N0YXJ0LCAjd3BiY190c19zaWRlX3N0YXJ0LCAjd3BiY190c19kYXlfc3RhcnRfc2xpZGVyLCAjd3BiY190c19zaWRlX3N0YXJ0X3NsaWRlcicgKSApIHtcclxuXHRcdFx0XHRzdGFydCA9IE1hdGgubWF4KCAwLCBlbmQgLSA2MCApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVuZCA9IE1hdGgubWluKCAxNDQwLCBzdGFydCArIDYwICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQkZ3JpZC5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0Jywgc3RhcnQgKTtcclxuXHRcdCRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJywgZW5kICk7XHJcblx0XHRzeW5jX3Zpc2libGVfdGltZV9jb250cm9scyggJHBhZ2UsIHN0YXJ0LCBlbmQgKTtcclxuXHJcblx0XHRyZW5kZXJfYXhpcyggJGdyaWQgKTtcclxuXHRcdHBvc2l0aW9uX2JhcnMoICRncmlkICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9tb2RlKCBtb2RlICkge1xyXG5cdFx0Y3VycmVudE1vZGUgPSBtb2RlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfYmFyX3NlbGVjdGFibGVfZm9yX3RpbWVfYWN0aW9uKCAkYmFyICkge1xyXG5cdFx0aWYgKCAhICRiYXIubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQkYmFyLmhhc0NsYXNzKCAnd3BiY190c19iYXJfYmxvY2tlZCcgKVxyXG5cdFx0XHQmJiAnMCcgIT09ICRiYXIuYXR0ciggJ2RhdGEtd3BiYy10cy1lZGl0YWJsZScgKVxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJ1bl9jb21tYW5kKCAkcGFnZSwgbW9kZSApIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfcGFnZSB8fCB7fTtcclxuXHRcdHZhciBsYWJlbHMgPSBzZXR0aW5ncy5pMThuIHx8IHt9O1xyXG5cdFx0dmFyIHBheWxvYWQ7XHJcblxyXG5cdFx0aWYgKCBhY3RpdmVTYXZlUmVxdWVzdCAmJiBhY3RpdmVTYXZlUmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0X21vZGUoIG1vZGUgKTtcclxuXHRcdGlmICggISBzZWxlY3Rpb25SYW5nZXMubGVuZ3RoICkge1xyXG5cdFx0XHRpZiAoIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbGFiZWxzLnNlbGVjdF9zbG90c19maXJzdCB8fCAnU2VsZWN0IG9uZSBvciBtb3JlIHRpbWUgcmFuZ2VzIGZpcnN0LicsICd3YXJuaW5nJywgMzUwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRwYXlsb2FkID0gZ2V0X3NlbGVjdGlvbl9wYXlsb2FkKCAkcGFnZSApO1xyXG5cdFx0aWYgKCAhIHNldHRpbmdzLmFqYXhfdXJsIHx8ICEgc2V0dGluZ3Mubm9uY2UgfHwgISBwYXlsb2FkLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldF90aW1lbGluZV9sb2FkaW5nKCAkcGFnZSwgdHJ1ZSwgbGFiZWxzLnNhdmluZyB8fCAnU2F2aW5nJyApO1xyXG5cdFx0c2V0X2FjdGlvbl9idXR0b25zX2J1c3koICRwYWdlLCB0cnVlICk7XHJcblxyXG5cdFx0YWN0aXZlU2F2ZVJlcXVlc3QgPSAkLnBvc3QoIHNldHRpbmdzLmFqYXhfdXJsLCB7XHJcblx0XHRcdGFjdGlvbjogJ1dQQkNfQUpYX0FWQUlMQUJJTElUWV9USU1FU0xPVFNfU0FWRScsXHJcblx0XHRcdG5vbmNlOiBzZXR0aW5ncy5ub25jZSxcclxuXHRcdFx0cmVzb3VyY2VfaWQ6IGdldF9jb250cm9sKCAkcGFnZSwgJ3Jlc291cmNlJyApLnZhbCgpLFxyXG5cdFx0XHRtb2RlOiBtb2RlLFxyXG5cdFx0XHRpbnRlcnZhbHM6IEpTT04uc3RyaW5naWZ5KCBwYXlsb2FkIClcclxuXHRcdH0gKS5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlICkge1xyXG5cdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgKSB7XHJcblx0XHRcdFx0aWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ2Jsb2NrJyA9PT0gbW9kZSA/ICggbGFiZWxzLmJsb2NrX3N1Y2Nlc3MgfHwgJ1NlbGVjdGVkIHRpbWUgcmFuZ2VzIGhhdmUgYmVlbiBibG9ja2VkLicgKSA6ICggbGFiZWxzLnVuYmxvY2tfc3VjY2VzcyB8fCAnU2VsZWN0ZWQgdGltZSByYW5nZXMgaGF2ZSBiZWVuIHVuYmxvY2tlZC4nICksICdzdWNjZXNzJywgNTAwMCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHRcdFx0bG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKTtcclxuXHRcdFx0fSBlbHNlIGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuc2F2ZV9lcnJvciB8fCAnVW5hYmxlIHRvIHNhdmUgdGltZS1zbG90IGF2YWlsYWJpbGl0eS4nLCAnZXJyb3InLCA1MDAwICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuc2F2ZV9lcnJvciB8fCAnVW5hYmxlIHRvIHNhdmUgdGltZS1zbG90IGF2YWlsYWJpbGl0eS4nLCAnZXJyb3InLCA1MDAwICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKS5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0YWN0aXZlU2F2ZVJlcXVlc3QgPSBudWxsO1xyXG5cdFx0XHRzZXRfYWN0aW9uX2J1dHRvbnNfYnVzeSggJHBhZ2UsIGZhbHNlICk7XHJcblxyXG5cdFx0XHRpZiAoICEgYWN0aXZlTG9hZFJlcXVlc3QgfHwgYWN0aXZlTG9hZFJlcXVlc3QucmVhZHlTdGF0ZSA9PT0gNCApIHtcclxuXHRcdFx0XHRzZXRfdGltZWxpbmVfbG9hZGluZyggJHBhZ2UsIGZhbHNlLCBsYWJlbHMubG9hZGluZyB8fCAnTG9hZGluZycgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdF9kYXRlX3JhbmdlX3BpY2tlciggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGRhdGUgPSBnZXRfY29udHJvbCggJHBhZ2UsICdkYXRlX3JhbmdlJyApO1xyXG5cdFx0dmFyICRkYXRlV3JhcCA9ICRkYXRlLmNsb3Nlc3QoICcud3BiY190c19pbnB1dF9pY29uJyApO1xyXG5cdFx0dmFyIGZpcnN0RGF5ID0gMDtcclxuXHJcblx0XHRpZiAoICEgJC5mbi5kYXRlcGljayApIHtcclxuXHRcdFx0aWYgKCB3aW5kb3cuY29uc29sZSApIHtcclxuXHRcdFx0XHRjb25zb2xlLmxvZyggJ1dQQkMgRXJyb3IuIEphdmFTY3JpcHQgbGlicmFyeSBcImRhdGVwaWNrXCIgd2FzIG5vdCBkZWZpbmVkLicgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB3aW5kb3cuX3dwYmMgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0gKSB7XHJcblx0XHRcdGZpcnN0RGF5ID0gcGFyc2VJbnQoIHdpbmRvdy5fd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdjYWxlbmRhcnNfX2ZpcnN0X2RheScgKSwgMTAgKSB8fCAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJGRhdGUuaGFzQ2xhc3MoICQuZGF0ZXBpY2subWFya2VyQ2xhc3NOYW1lICkgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0JGRhdGUuZGF0ZXBpY2soICdkZXN0cm95JyApO1xyXG5cdFx0XHR9IGNhdGNoICggZXJyb3IgKSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdCRkYXRlLmRhdGVwaWNrKCB7XHJcblx0XHRcdGJlZm9yZVNob3dEYXk6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRyZXR1cm4gWyB0cnVlLCAnZGF0ZV9hdmFpbGFibGUnIF07XHJcblx0XHRcdH0sXHJcblx0XHRcdG9uU2VsZWN0OiBmdW5jdGlvbiAoIHN0cmluZ0RhdGVzLCBqc0RhdGVzQXJyICkge1xyXG5cdFx0XHRcdGFwcGx5X2RhdGVfcmFuZ2Vfc2VsZWN0aW9uKCAkcGFnZSwgcGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uKCBzdHJpbmdEYXRlcywganNEYXRlc0FyciApICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdG9uQ2xvc2U6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0c3luY19kYXRlX3JhbmdlX2Zyb21faW5wdXQoICRwYWdlICk7XHJcblx0XHRcdFx0fSwgMCApO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRzaG93T246ICdub25lJyxcclxuXHRcdFx0c2hvd0FuaW06ICdzaG93JyxcclxuXHRcdFx0ZHVyYXRpb246ICcnLFxyXG5cdFx0XHRyYW5nZVNlbGVjdDogdHJ1ZSxcclxuXHRcdFx0bXVsdGlTZWxlY3Q6IDAsXHJcblx0XHRcdG51bWJlck9mTW9udGhzOiAxLFxyXG5cdFx0XHRzdGVwTW9udGhzOiAxLFxyXG5cdFx0XHRwcmV2VGV4dDogJyZsc2FxdW87JyxcclxuXHRcdFx0bmV4dFRleHQ6ICcmcnNhcXVvOycsXHJcblx0XHRcdGRhdGVGb3JtYXQ6ICdNIGQsIHl5JyxcclxuXHRcdFx0Y2hhbmdlTW9udGg6IGZhbHNlLFxyXG5cdFx0XHRjaGFuZ2VZZWFyOiBmYWxzZSxcclxuXHRcdFx0bWluRGF0ZTogbnVsbCxcclxuXHRcdFx0bWF4RGF0ZTogbnVsbCxcclxuXHRcdFx0c2hvd1N0YXR1czogZmFsc2UsXHJcblx0XHRcdG11bHRpU2VwYXJhdG9yOiAnLCAnLFxyXG5cdFx0XHRjbG9zZUF0VG9wOiBudWxsLFxyXG5cdFx0XHRmaXJzdERheTogZmlyc3REYXksXHJcblx0XHRcdGdvdG9DdXJyZW50OiBmYWxzZSxcclxuXHRcdFx0aGlkZUlmTm9QcmV2TmV4dDogdHJ1ZSxcclxuXHRcdFx0dXNlVGhlbWVSb2xsZXI6IGZhbHNlLFxyXG5cdFx0XHRtYW5kYXRvcnk6IHRydWVcclxuXHRcdH0gKTtcclxuXHJcblx0XHRmdW5jdGlvbiBzaG93X2RhdGVfcmFuZ2VfcGlja2VyKCkge1xyXG5cdFx0XHR2YXIgaW5wdXQgPSAkZGF0ZS5nZXQoIDAgKTtcclxuXHJcblx0XHRcdGlmICggISBpbnB1dCB8fCAhICQuZGF0ZXBpY2sgfHwgISAkLmRhdGVwaWNrLl9zaG93RGF0ZXBpY2sgfHwgISAkZGF0ZS5oYXNDbGFzcyggJC5kYXRlcGljay5tYXJrZXJDbGFzc05hbWUgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggKCAkLmRhdGVwaWNrLl9sYXN0SW5wdXQgPT09IGlucHV0ICkgJiYgISAkLmRhdGVwaWNrLl9kYXRlcGlja2VyU2hvd2luZyApIHtcclxuXHRcdFx0XHQkLmRhdGVwaWNrLl9sYXN0SW5wdXQgPSBudWxsO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICggJC5kYXRlcGljay5fbGFzdElucHV0ID09PSBpbnB1dCApICYmICQuZGF0ZXBpY2suX2RhdGVwaWNrZXJTaG93aW5nICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JC5kYXRlcGljay5fc2hvd0RhdGVwaWNrKCBpbnB1dCApO1xyXG5cdFx0XHQkKCAnI2RhdGVwaWNrLWRpdiwgLmRhdGVwaWNrLXBvcHVwJyApLmNzcyggJ3otaW5kZXgnLCAxMDAwMDEwICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JGRhdGUub2ZmKCAnY2xpY2sud3BiY190c19kYXRlX3JhbmdlX29wZW4gZm9jdXMud3BiY190c19kYXRlX3JhbmdlX29wZW4ga2V5ZG93bi53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicgKS5vbiggJ2NsaWNrLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuIGZvY3VzLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuIGtleWRvd24ud3BiY190c19kYXRlX3JhbmdlX29wZW4nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRpZiAoICdrZXlkb3duJyA9PT0gZXZlbnQudHlwZSAmJiAoIDEzICE9PSBldmVudC53aGljaCApICYmICggMzIgIT09IGV2ZW50LndoaWNoICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICdrZXlkb3duJyA9PT0gZXZlbnQudHlwZSApIHtcclxuXHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRzaG93X2RhdGVfcmFuZ2VfcGlja2VyKCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JGRhdGVXcmFwLm9mZiggJ21vdXNlZG93bi53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbiBjbGljay53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicgKVxyXG5cdFx0XHQub24oICdtb3VzZWRvd24ud3BiY190c19kYXRlX3JhbmdlX29wZW4nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0XHR9IClcclxuXHRcdFx0Lm9uKCAnY2xpY2sud3BiY190c19kYXRlX3JhbmdlX29wZW4nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRcdGlmICggZXZlbnQudGFyZ2V0ICE9PSAkZGF0ZS5nZXQoIDAgKSApIHtcclxuXHRcdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQkZGF0ZS50cmlnZ2VyKCAnZm9jdXMnICk7XHJcblx0XHRcdFx0c2hvd19kYXRlX3JhbmdlX3BpY2tlcigpO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0JGRhdGUub24oICdjaGFuZ2UgaW5wdXQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHN5bmNfZGF0ZV9yYW5nZV9mcm9tX2lucHV0KCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdF9yaWdodGJhcl90YWJzKCkge1xyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX3RzX3JpZ2h0YmFyX3RhYnMgW3JvbGU9XCJ0YWJcIl0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgJHRhYiA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIHBhbmVsSWQgPSAkdGFiLmF0dHIoICdhcmlhLWNvbnRyb2xzJyApO1xyXG5cdFx0XHR2YXIgJHBhbmVsID0gJCggJyMnICsgcGFuZWxJZCApO1xyXG5cdFx0XHR2YXIgJHRhYmxpc3QgPSAkdGFiLmNsb3Nlc3QoICdbcm9sZT1cInRhYmxpc3RcIl0nICk7XHJcblxyXG5cdFx0XHRpZiAoICEgJHBhbmVsLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdCR0YWJsaXN0LmZpbmQoICdbcm9sZT1cInRhYlwiXScgKS5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScgKTtcclxuXHRcdFx0JHRhYi5hdHRyKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xyXG5cdFx0XHQkKCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzIC53cGJjX2JmYl9fcGFsZXR0ZV9wYW5lbCcgKS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdFx0JHBhbmVsLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR0aGlzLmhpZGRlbiA9IGZhbHNlO1xyXG5cdFx0XHRcdHRoaXMucmVtb3ZlQXR0cmlidXRlKCAnaGlkZGVuJyApO1xyXG5cdFx0XHR9ICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdF90aW1lX3Nsb3RzX3BhZ2UoIGNvbnRleHQsIGZvcmNlICkge1xyXG5cdFx0dmFyICRjb250ZXh0ID0gY29udGV4dCA/ICQoIGNvbnRleHQgKSA6ICQoIGRvY3VtZW50ICk7XHJcblx0XHR2YXIgJHBhZ2VzID0gJGNvbnRleHQuaXMoICcud3BiY190c19wYWdlJyApID8gJGNvbnRleHQgOiAkY29udGV4dC5maW5kKCAnLndwYmNfdHNfcGFnZScgKTtcclxuXHJcblx0XHRpZiAoICEgJHBhZ2VzLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBmb3JjZSApIHtcclxuXHRcdFx0JHBhZ2VzID0gJHBhZ2VzLmZpbHRlciggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHJldHVybiAnMCcgIT09ICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLWF1dG8taW5pdCcgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRwYWdlcy5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGluaXRfdGltZV9zbG90c19jb21wb25lbnQoICQoIHRoaXMgKSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdF90aW1lX3Nsb3RzX2NvbXBvbmVudCggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGdyaWQ7XHJcblx0XHR2YXIgaXNEcmFnZ2luZyA9IGZhbHNlO1xyXG5cdFx0dmFyIGRyYWdTdGFydE1pbnV0ZSA9IDA7XHJcblx0XHR2YXIgZHJhZ1N0YXJ0Um93ID0gbnVsbDtcclxuXHRcdHZhciBkcmFnU2VsZWN0aW9uSWQgPSAnJztcclxuXHRcdHZhciByZXNpemVNb2RlID0gJyc7XHJcblxyXG5cdFx0aWYgKCAkcGFnZS5hdHRyKCAnZGF0YS13cGJjLXRzLWluaXRpYWxpemVkJyApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHQkcGFnZS5hdHRyKCAnZGF0YS13cGJjLXRzLWluaXRpYWxpemVkJywgJzEnICk7XHJcblxyXG5cdFx0Y2FjaGVfcm93X3RlbXBsYXRlcyggJHBhZ2UgKTtcclxuXHRcdCRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblx0XHRyZW5kZXJfYXhpcyggJGdyaWQgKTtcclxuXHRcdHBvc2l0aW9uX2JhcnMoICRncmlkICk7XHJcblx0XHRpbml0X2RhdGVfcmFuZ2VfcGlja2VyKCAkcGFnZSApO1xyXG5cdFx0bG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKTtcclxuXHRcdHNldF9tb2RlKCBjdXJyZW50TW9kZSApO1xyXG5cdFx0c3luY19zbG90X3N0ZXBfY29udHJvbHMoICRwYWdlLCBnZXRfZ3JpZF9jb25maWcoICRncmlkICkuc3RlcCApO1xyXG5cdFx0c3luY196b29tX2NvbnRyb2xzKCAkcGFnZSwgZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApLnN0ZXAgKTtcclxuXHRcdHN5bmNfdmlzaWJsZV90aW1lX2NvbnRyb2xzKCAkcGFnZSwgZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApLnN0YXJ0LCBnZXRfZ3JpZF9jb25maWcoICRncmlkICkuZW5kICk7XHJcblx0XHRiaW5kX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJzbG90X3N0ZXBcIl0sICN3cGJjX3RzX3Nsb3Rfc3RlcCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X3N0ZXAoICRwYWdlLCBwYXJzZUludCggJCggdGhpcyApLnZhbCgpLCAxMCApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY190c19zaWRlX3Nsb3Rfc3RlcCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X3N0ZXAoICRwYWdlLCBwYXJzZUludCggJCggdGhpcyApLnZhbCgpLCAxMCApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwicmVzb3VyY2VcIl0sICN3cGJjX3RzX3Jlc291cmNlJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnaW5wdXQgY2hhbmdlJywgJ1tkYXRhLXdwYmMtdHMtY29udHJvbD1cInpvb21cIl0sICN3cGJjX3RzX3pvb20nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciBpbmRleCA9IHBhcnNlSW50KCAkKCB0aGlzICkudmFsKCksIDEwICk7XHJcblx0XHRcdHNldF9zdGVwKCAkcGFnZSwgem9vbVN0ZXBzWyBpbmRleCBdIHx8IDE1ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0IGNoYW5nZScsICcjd3BiY190c19zaWRlX3pvb20nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciBpbmRleCA9IHBhcnNlSW50KCAkKCB0aGlzICkudmFsKCksIDEwICk7XHJcblx0XHRcdHNldF9zdGVwKCAkcGFnZSwgem9vbVN0ZXBzWyBpbmRleCBdIHx8IDE1ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICdbZGF0YS13cGJjLXRzLXpvb21dJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHpvb20gPSBnZXRfY29udHJvbCggJHBhZ2UsICd6b29tJyApO1xyXG5cdFx0XHR2YXIgdmFsdWUgPSBwYXJzZUludCggJHpvb20udmFsKCksIDEwICk7XHJcblx0XHRcdHZhbHVlICs9ICdpbicgPT09ICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXpvb20nICkgPyAxIDogLTE7XHJcblx0XHRcdHZhbHVlID0gY2xhbXAoIHZhbHVlLCAwLCB6b29tU3RlcHMubGVuZ3RoIC0gMSApO1xyXG5cdFx0XHQkem9vbS52YWwoIFN0cmluZyggdmFsdWUgKSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NsaWNrJywgJy53cGJjX3RzX3JpZ2h0YmFyX3BhbmVscyBbZGF0YS13cGJjLXRzLXpvb21dJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJHpvb20gPSAkKCAnI3dwYmNfdHNfc2lkZV96b29tJyApO1xyXG5cdFx0XHR2YXIgdmFsdWUgPSBwYXJzZUludCggJHpvb20udmFsKCksIDEwICk7XHJcblx0XHRcdHZhbHVlICs9ICdpbicgPT09ICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXpvb20nICkgPyAxIDogLTE7XHJcblx0XHRcdHZhbHVlID0gY2xhbXAoIHZhbHVlLCAwLCB6b29tU3RlcHMubGVuZ3RoIC0gMSApO1xyXG5cdFx0XHQkem9vbS52YWwoIFN0cmluZyggdmFsdWUgKSApLnRyaWdnZXIoICdjaGFuZ2UnICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X3N0YXJ0XCJdLCBbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfZW5kXCJdLCAjd3BiY190c19kYXlfc3RhcnQsICN3cGJjX3RzX2RheV9lbmQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF92aXNpYmxlX3RpbWVfcmFuZ2UoICRwYWdlLCBnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfc3RhcnQnICkudmFsKCksIGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9lbmQnICkudmFsKCkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJyN3cGJjX3RzX3NpZGVfc3RhcnQsICN3cGJjX3RzX3NpZGVfZW5kJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfdmlzaWJsZV90aW1lX3JhbmdlKCAkcGFnZSwgJCggJyN3cGJjX3RzX3NpZGVfc3RhcnQnICkudmFsKCksICQoICcjd3BiY190c19zaWRlX2VuZCcgKS52YWwoKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnaW5wdXQgY2hhbmdlJywgJ1tkYXRhLXdwYmMtdHMtY29udHJvbD1cImRheV9zdGFydF9zbGlkZXJcIl0sIFtkYXRhLXdwYmMtdHMtY29udHJvbD1cImRheV9lbmRfc2xpZGVyXCJdLCAjd3BiY190c19kYXlfc3RhcnRfc2xpZGVyLCAjd3BiY190c19kYXlfZW5kX3NsaWRlcicsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X3Zpc2libGVfdGltZV9yYW5nZSggJHBhZ2UsIGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9zdGFydF9zbGlkZXInICkudmFsKCksIGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9lbmRfc2xpZGVyJyApLnZhbCgpICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2lucHV0IGNoYW5nZScsICcjd3BiY190c19zaWRlX3N0YXJ0X3NsaWRlciwgI3dwYmNfdHNfc2lkZV9lbmRfc2xpZGVyJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfdmlzaWJsZV90aW1lX3JhbmdlKCAkcGFnZSwgJCggJyN3cGJjX3RzX3NpZGVfc3RhcnRfc2xpZGVyJyApLnZhbCgpLCAkKCAnI3dwYmNfdHNfc2lkZV9lbmRfc2xpZGVyJyApLnZhbCgpICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICdbZGF0YS13cGJjLXRzLWNvbW1hbmRdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0cnVuX2NvbW1hbmQoICRwYWdlLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1jb21tYW5kJyApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICdbZGF0YS13cGJjLXRzLXJhbmdlLXNoaWZ0XScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdHNoaWZ0X2RhdGVfcmFuZ2UoICRwYWdlLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1yYW5nZS1zaGlmdCcgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy10cy1jcmVhdGUtYm9va2luZ10nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRjcmVhdGVfYm9va2luZ19mcm9tX2FjdGl2ZV9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2UuY2xvc2VzdCggJy5tb2RhbCcgKS5vZmYoICdjbGljay53cGJjX3RzX2NyZWF0ZV9ib29raW5nJyApLm9uKCAnY2xpY2sud3BiY190c19jcmVhdGVfYm9va2luZycsICdbZGF0YS13cGJjLXRzLWNyZWF0ZS1ib29raW5nXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGNyZWF0ZV9ib29raW5nX2Zyb21fYWN0aXZlX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5jbG9zZXN0KCAnLm1vZGFsJyApLm9mZiggJ2NsaWNrLndwYmNfdHNfZm9vdGVyX2NvbW1hbmQnICkub24oICdjbGljay53cGJjX3RzX2Zvb3Rlcl9jb21tYW5kJywgJ1tkYXRhLXdwYmMtdHMtY29tbWFuZF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRydW5fY29tbWFuZCggJHBhZ2UsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLWNvbW1hbmQnICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5jbG9zZXN0KCAnLm1vZGFsJyApLm9mZiggJ2NsaWNrLndwYmNfdHNfZm9vdGVyX2NsZWFyJyApLm9uKCAnY2xpY2sud3BiY190c19mb290ZXJfY2xlYXInLCAnLndwYmNfdHNfY2xlYXJfc2VsZWN0aW9uJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2xpY2snLCAnLndwYmNfdHNfYmFyX2Jvb2tlZCcsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGhhbmRsZV9ib29rZWRfYmFyX2NsaWNrKCAkcGFnZSwgZXZlbnQgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9mZiggJ2NsaWNrLndwYmNfdHNfcmlnaHRiYXJfY29tbWFuZCcgKS5vbiggJ2NsaWNrLndwYmNfdHNfcmlnaHRiYXJfY29tbWFuZCcsICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgW2RhdGEtd3BiYy10cy1jb21tYW5kXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdHJ1bl9jb21tYW5kKCAkcGFnZSwgJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtY29tbWFuZCcgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub2ZmKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9yYW5nZV9zaGlmdCcgKS5vbiggJ2NsaWNrLndwYmNfdHNfcmlnaHRiYXJfcmFuZ2Vfc2hpZnQnLCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzIFtkYXRhLXdwYmMtdHMtcmFuZ2Utc2hpZnRdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0c2hpZnRfZGF0ZV9yYW5nZSggJHBhZ2UsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXJhbmdlLXNoaWZ0JyApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdtb3VzZWRvd24gdG91Y2hzdGFydCcsICcud3BiY190c19oYW5kbGUnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgJHNlbGVjdGlvbiA9ICQoIHRoaXMgKS5jbG9zZXN0KCAnLndwYmNfdHNfc2VsZWN0aW9uJyApO1xyXG5cdFx0XHR2YXIgJGxhbmUgPSAkc2VsZWN0aW9uLmNsb3Nlc3QoICcud3BiY190c19sYW5lJyApO1xyXG5cdFx0XHRpc0RyYWdnaW5nID0gdHJ1ZTtcclxuXHRcdFx0cmVzaXplTW9kZSA9ICQoIHRoaXMgKS5oYXNDbGFzcyggJ3dwYmNfdHNfaGFuZGxlX3N0YXJ0JyApID8gJ3N0YXJ0JyA6ICdlbmQnO1xyXG5cdFx0XHRhY3RpdmVTZWxlY3Rpb25JZCA9ICRzZWxlY3Rpb24uYXR0ciggJ2RhdGEtd3BiYy10cy1zZWxlY3Rpb24taWQnICk7XHJcblx0XHRcdGRyYWdTZWxlY3Rpb25JZCA9IGFjdGl2ZVNlbGVjdGlvbklkO1xyXG5cdFx0XHRkcmFnU3RhcnRSb3cgPSAkbGFuZS5jbG9zZXN0KCAnLndwYmNfdHNfcm93JyApLmF0dHIoICdkYXRhLXdwYmMtdHMtcm93JyApO1xyXG5cdFx0XHRkcmFnU3RhcnRNaW51dGUgPSBtaW51dGVfZnJvbV9wb2ludGVyKCBldmVudCwgJGxhbmUgKTtcclxuXHRcdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnbW91c2Vkb3duIHRvdWNoc3RhcnQnLCAnLndwYmNfdHNfc2VsZWN0aW9uOm5vdCgud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUpJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0aWYgKCAkKCBldmVudC50YXJnZXQgKS5jbG9zZXN0KCAnLndwYmNfdHNfaGFuZGxlJyApLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1zZWxlY3Rpb24taWQnICk7XHJcblx0XHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ21vdXNlZG93biB0b3VjaHN0YXJ0JywgJy53cGJjX3RzX2xhbmUnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgJGxhbmUgPSAkKCB0aGlzICk7XHJcblx0XHRcdHZhciAkYmFyVGFyZ2V0ID0gJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJy53cGJjX3RzX2JhcicgKTtcclxuXHRcdFx0dmFyIHN0ZXA7XHJcblxyXG5cdFx0XHRpZiAoICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICcud3BiY190c19zZWxlY3Rpb246bm90KC53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZSknICkubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICRiYXJUYXJnZXQubGVuZ3RoICYmICEgaXNfYmFyX3NlbGVjdGFibGVfZm9yX3RpbWVfYWN0aW9uKCAkYmFyVGFyZ2V0ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpc0RyYWdnaW5nID0gdHJ1ZTtcclxuXHRcdFx0cmVzaXplTW9kZSA9ICcnO1xyXG5cdFx0XHRkcmFnU3RhcnRSb3cgPSAkbGFuZS5jbG9zZXN0KCAnLndwYmNfdHNfcm93JyApLmF0dHIoICdkYXRhLXdwYmMtdHMtcm93JyApO1xyXG5cdFx0XHRkcmFnU3RhcnRNaW51dGUgPSBtaW51dGVfZnJvbV9wb2ludGVyKCBldmVudCwgJGxhbmUgKTtcclxuXHRcdFx0c3RlcCA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKS5zdGVwO1xyXG5cdFx0XHRkcmFnU2VsZWN0aW9uSWQgPSBjcmVhdGVfc2VsZWN0aW9uKCAkcGFnZSwgWyBkcmFnU3RhcnRSb3cgXSwgZHJhZ1N0YXJ0TWludXRlLCBkcmFnU3RhcnRNaW51dGUgKyBzdGVwICkuaWQ7XHJcblx0XHRcdHNob3dfbGl2ZV90aXAoICRwYWdlLCBldmVudCApO1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdtb3VzZW1vdmUud3BiY190cyB0b3VjaG1vdmUud3BiY190cycsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciBjdXJyZW50Um93O1xyXG5cdFx0XHR2YXIgcm93cztcclxuXHRcdFx0dmFyICRsYW5lO1xyXG5cdFx0XHR2YXIgbWludXRlO1xyXG5cdFx0XHR2YXIgaXRlbTtcclxuXHJcblx0XHRcdGlmICggISBpc0RyYWdnaW5nICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aXRlbSA9IGdldF9zZWxlY3Rpb25fYnlfaWQoIGRyYWdTZWxlY3Rpb25JZCApO1xyXG5cdFx0XHRpZiAoICEgaXRlbSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGN1cnJlbnRSb3cgPSByb3dfZnJvbV9wb2ludGVyKCAkcGFnZSwgZXZlbnQgKSB8fCBkcmFnU3RhcnRSb3c7XHJcblx0XHRcdHJvd3MgPSBnZXRfcm93c19iZXR3ZWVuKCAkcGFnZSwgZHJhZ1N0YXJ0Um93LCBjdXJyZW50Um93ICk7XHJcblx0XHRcdCRsYW5lID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIGRyYWdTdGFydFJvdyArICdcIl0gLndwYmNfdHNfbGFuZScgKTtcclxuXHRcdFx0bWludXRlID0gbWludXRlX2Zyb21fcG9pbnRlciggZXZlbnQsICRsYW5lICk7XHJcblxyXG5cdFx0XHRpZiAoICdzdGFydCcgPT09IHJlc2l6ZU1vZGUgKSB7XHJcblx0XHRcdFx0dXBkYXRlX3NlbGVjdGlvbiggJHBhZ2UsIGl0ZW0uaWQsIGl0ZW0ucm93cywgbWludXRlLCBpdGVtLmVuZCApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAnZW5kJyA9PT0gcmVzaXplTW9kZSApIHtcclxuXHRcdFx0XHR1cGRhdGVfc2VsZWN0aW9uKCAkcGFnZSwgaXRlbS5pZCwgaXRlbS5yb3dzLCBpdGVtLnN0YXJ0LCBtaW51dGUgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR1cGRhdGVfc2VsZWN0aW9uKCAkcGFnZSwgaXRlbS5pZCwgcm93cywgZHJhZ1N0YXJ0TWludXRlLCBtaW51dGUgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRkcmFnU2VsZWN0aW9uSWQgPSBhY3RpdmVTZWxlY3Rpb25JZDtcclxuXHJcblx0XHRcdHNob3dfbGl2ZV90aXAoICRwYWdlLCBldmVudCApO1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdtb3VzZXVwLndwYmNfdHMgdG91Y2hlbmQud3BiY190cycsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aXNEcmFnZ2luZyA9IGZhbHNlO1xyXG5cdFx0XHRyZXNpemVNb2RlID0gJyc7XHJcblx0XHRcdGRyYWdTZWxlY3Rpb25JZCA9ICcnO1xyXG5cdFx0XHRoaWRlX2xpdmVfdGlwKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2xpY2snLCAnLndwYmNfdHNfY2xlYXJfc2VsZWN0aW9uJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub2ZmKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9jbGVhcicgKS5vbiggJ2NsaWNrLndwYmNfdHNfcmlnaHRiYXJfY2xlYXInLCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzIC53cGJjX3RzX2NsZWFyX3NlbGVjdGlvbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfaW5pdCA9IGZ1bmN0aW9uICggY29udGV4dCApIHtcclxuXHRcdGluaXRfdGltZV9zbG90c19wYWdlKCBjb250ZXh0IHx8IGRvY3VtZW50LCB0cnVlICk7XHJcblx0fTtcclxuXHR3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0ID0gc2V0X3RpbWVfc2xvdHNfY29udGV4dDtcclxuXHJcblx0JCggZnVuY3Rpb24gKCkge1xyXG5cdFx0aW5pdF9yaWdodGJhcl90YWJzKCk7XHJcblx0XHRpbml0X3RpbWVfc2xvdHNfcGFnZSggZG9jdW1lbnQsIGZhbHNlICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ3dwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0JywgZnVuY3Rpb24gKCBldmVudCwgY29udGV4dCApIHtcclxuXHRcdFx0aW5pdF90aW1lX3Nsb3RzX3BhZ2UoIGNvbnRleHQgfHwgZG9jdW1lbnQsIHRydWUgKTtcclxuXHRcdH0gKTtcclxuXHR9ICk7XHJcbn0oIGpRdWVyeSApICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDRSxXQUFXQSxDQUFDLEVBQUc7RUFDaEIsWUFBWTs7RUFFWixJQUFJQyxTQUFTLEdBQUcsQ0FBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFFO0VBQ3JDLElBQUlDLFdBQVcsR0FBRyxPQUFPO0VBQ3pCLElBQUlDLGVBQWUsR0FBRyxFQUFFO0VBQ3hCLElBQUlDLGlCQUFpQixHQUFHLEVBQUU7RUFDMUIsSUFBSUMsWUFBWSxHQUFHLEVBQUU7RUFDckIsSUFBSUMsZUFBZSxHQUFHLENB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
