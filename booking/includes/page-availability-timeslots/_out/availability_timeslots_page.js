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
    $grid.css('--wpbc-ts-slot-count', slotCount);
    $grid.css('--wpbc-ts-axis-label-size', axisFontSize + 'px');
    $grid.css('--wpbc-ts-axis-label-weight', axisFontWeight);
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
          var type = 'blocked' === interval.type ? 'blocked' : 'unavailable_day' === interval.type ? 'unavailable_day' : 'booked';
          var icon = 'booked' === type ? 'wpbc_icn_lock' : 'unavailable_day' === type ? 'wpbc_icn_event_busy' : 'wpbc_icn_do_not_disturb_on';
          var tooltip = interval.tooltip || '';
          var $bar = $('<div class="wpbc_ts_bar" data-wpbc-ts-source="server"></div>');
          var $iconWrap;
          if ('booked' === type && interval.booking_url) {
            $iconWrap = $('<a class="wpbc_ts_booking_link tooltip_top" rel="noopener noreferrer"><span></span></a>');
            $iconWrap.attr('href', interval.booking_url).attr('data-wpbc-ts-booking-id', interval.booking_id || '').attr('aria-label', (labels.open_booking || 'Open booking in Booking Listing') + (interval.booking_id ? ': ' + interval.booking_id : '')).attr('data-original-title', tooltip || '');
          } else if ('unavailable_day' === type && interval.rule_url) {
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
    return $.trim($page.find('.wpbc_ts_row[data-wpbc-ts-row="' + rowId + '"] .wpbc_ts_row_label_text').text());
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
  function close_time_slots_popup($page) {
    var $modal = $page.closest('.wpbc_modal__availability_timeslots__section, .modal');
    if (!$modal.length) {
      return;
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
  function get_active_booking_selection_context($page) {
    var item = activeSelectionId ? get_selection_by_id(activeSelectionId) : null;
    var $row;
    var date;
    if (!item && 1 === selectionRanges.length) {
      item = selectionRanges[0];
    }
    if (!item || !item.rows || 1 !== item.rows.length) {
      return null;
    }
    $row = $page.find('.wpbc_ts_row[data-wpbc-ts-row="' + item.rows[0] + '"]');
    date = $row.attr('data-wpbc-ts-date');
    if (!date) {
      return null;
    }
    return {
      resource_id: get_control($page, 'resource').val() || '',
      selected_date: date,
      selected_time: minutes_to_time(item.start) + ' - ' + minutes_to_time(item.end),
      start_second: item.start * 60,
      end_second: item.end * 60
    };
  }
  function create_booking_from_active_selection($page) {
    var settings = window.wpbc_availability_timeslots_page || {};
    var labels = settings.i18n || {};
    var context = get_active_booking_selection_context($page);
    var bookingForm;
    if (!context) {
      if (window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.select_one_slot_for_booking || 'Select one time range on one date first.', 'warning', 3500);
      }
      return false;
    }
    if ('function' !== typeof window.wpbc_boo_listing__click__add_booking_modal) {
      if (window.wpbc_admin_show_message) {
        wpbc_admin_show_message(labels.add_booking_modal_missing || 'Add Booking popup is not available on this page.', 'warning', 5000);
      }
      return false;
    }
    bookingForm = $('#wpbc_modal__add_booking__booking_form').val() || '';
    close_time_slots_popup($page);
    window.setTimeout(function () {
      window.wpbc_boo_listing__click__add_booking_modal({
        mode: 'add',
        resource_id: context.resource_id,
        booking_form: bookingForm,
        selected_date: context.selected_date,
        selected_time: context.selected_time
      });
    }, 150);
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
    if (jsDatesArr && $.isArray(jsDatesArr.range)) {
      dates = jsDatesArr.range;
    } else if (jsDatesArr && $.isArray(jsDatesArr.multiple)) {
      dates = jsDatesArr.multiple;
    } else if ($.isArray(jsDatesArr)) {
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
    text = $.trim(text || '');
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
        $selection = $template.clone(false).removeClass('wpbc_ts_selection_template').removeAttr('hidden').addClass('is-visible').toggleClass('is-active', item.id === activeSelectionId).attr('data-wpbc-ts-selection-id', item.id).css({
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
      $panel.removeAttr('hidden').attr('aria-hidden', 'false');
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktdGltZXNsb3RzL19vdXQvYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlLmpzIiwibmFtZXMiOlsiJCIsInpvb21TdGVwcyIsImN1cnJlbnRNb2RlIiwic2VsZWN0aW9uUmFuZ2VzIiwiYWN0aXZlU2VsZWN0aW9uSWQiLCJyb3dUZW1wbGF0ZXMiLCJuZXh0U2VsZWN0aW9uSWQiLCJuZXh0VG9vbHRpcFNjb3BlSWQiLCJhY3RpdmVMb2FkUmVxdWVzdCIsImFjdGl2ZUxvYWRSZXF1ZXN0SWQiLCJhY3RpdmVTYXZlUmVxdWVzdCIsInBhZF8yIiwidmFsdWUiLCJtaW51dGVzX3RvX3RpbWUiLCJtaW51dGVzIiwiaG91cnMiLCJNYXRoIiwiZmxvb3IiLCJtaW5zIiwiY2xhbXAiLCJtaW4iLCJtYXgiLCJzbmFwX21pbnV0ZSIsIm1pbnV0ZSIsInN0ZXAiLCJyb3VuZCIsImdldF9ncmlkX2NvbmZpZyIsIiRncmlkIiwic3RhcnQiLCJwYXJzZUludCIsImF0dHIiLCJlbmQiLCJnZXRfY29udHJvbCIsIiRwYWdlIiwibmFtZSIsIiRjb250cm9sIiwiZmluZCIsImZpcnN0IiwibGVuZ3RoIiwicGVyY2VudF9mb3JfbWludXRlIiwiY29uZmlnIiwibm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSIsImdldF9zZWxlY3Rpb25fYnlfaWQiLCJzZWxlY3Rpb25JZCIsImZvdW5kIiwiZWFjaCIsImluZGV4IiwiaXRlbSIsImlkIiwicmVuZGVyX2F4aXMiLCIkYXhpcyIsImh0bWwiLCJzbG90Q291bnQiLCJ2aXNpYmxlSG91cnMiLCJheGlzRm9udFNpemUiLCJheGlzRm9udFdlaWdodCIsImZpcnN0SG91ciIsImNlaWwiLCJjc3MiLCJyZWZyZXNoX2Zsb2F0aW5nX2hlYWRlciIsImNsb3Nlc3QiLCJwb3NpdGlvbl9iYXJzIiwiJGJhciIsInZpc2libGVTdGFydCIsInZpc2libGVFbmQiLCJsZWZ0Iiwid2lkdGgiLCJoaWRlIiwic2hvdyIsInJlbmRlcl90aW1lbGluZV9iYXJzIiwiYmFycyIsInNldHRpbmdzIiwid2luZG93Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3BhZ2UiLCJsYWJlbHMiLCJpMThuIiwicmVtb3ZlIiwiZGF0ZSIsInJlc291cmNlcyIsIiRyb3ciLCJyZXNvdXJjZUlkIiwicmVzb3VyY2VCYXJzIiwiaW50ZXJ2YWwiLCJ0eXBlIiwiaWNvbiIsInRvb2x0aXAiLCIkaWNvbldyYXAiLCJib29raW5nX3VybCIsImJvb2tpbmdfaWQiLCJvcGVuX2Jvb2tpbmciLCJydWxlX3VybCIsInJ1bGVfc291cmNlIiwic291cmNlX3R5cGUiLCJvcGVuX2F2YWlsYWJpbGl0eV9ydWxlIiwic3RhdHVzX3RpdGxlIiwiYWRkQ2xhc3MiLCJzdGFydF9taW51dGUiLCJlbmRfbWludXRlIiwidW5hdmFpbGFibGVfdGltZXNsb3RfaWQiLCJlZGl0YWJsZSIsImFwcGVuZCIsInJlZnJlc2hfYmFyX3Rvb2x0aXBzIiwibG9hZF9ibG9ja2VkX2ludGVydmFscyIsIiRkYXRlUmFuZ2UiLCJyZXF1ZXN0SWQiLCJhamF4X3VybCIsInJlYWR5U3RhdGUiLCJhYm9ydCIsInNldF90aW1lbGluZV9sb2FkaW5nIiwibG9hZGluZyIsInBvc3QiLCJhY3Rpb24iLCJyZXNvdXJjZV9pZCIsInZhbCIsImRhdGVfc3RhcnQiLCJkYXRlX2VuZCIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJkYXRhIiwiZmFpbCIsInhociIsInRleHRTdGF0dXMiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsInNhdmVfZXJyb3IiLCJhbHdheXMiLCJnZXRfcm93c19iZXR3ZWVuIiwic3RhcnRSb3ciLCJlbmRSb3ciLCJzdGFydEluZGV4IiwiZW5kSW5kZXgiLCJyb3dzIiwiaSIsInB1c2giLCJTdHJpbmciLCJyb3dfbGFiZWwiLCJyb3dJZCIsInRyaW0iLCJ0ZXh0IiwiZXNjYXBlX2h0bWwiLCJwb3NpdGlvbl9sb2FkaW5nX292ZXJsYXkiLCIkY2FyZCIsImNhcmQiLCJnZXQiLCIkb3ZlcmxheSIsImNsaWVudFdpZHRoIiwiaGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwidHJhbnNmb3JtIiwic2Nyb2xsTGVmdCIsInNjcm9sbFRvcCIsImlzTG9hZGluZyIsImxhYmVsIiwidG9nZ2xlQ2xhc3MiLCJvZmYiLCJvbiIsInNldF9hY3Rpb25fYnV0dG9uc19idXN5IiwiaXNCdXN5IiwiJHNjb3BlIiwiYWRkIiwiaXNfZnVsbF9wYWdlX2NvbXBvbmVudCIsImhhc0NsYXNzIiwiZ2V0X2Zsb2F0aW5nX2hlYWRlcl9uYW1lc3BhY2UiLCJyZXBsYWNlIiwiZ2V0X3RvcF9uYXZfYm90dG9tIiwiJHRvcE5hdiIsInJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJib3R0b20iLCJlbnN1cmVfZmxvYXRpbmdfaGVhZGVyIiwiJGZsb2F0aW5nIiwiY2hpbGRyZW4iLCIkaGVhZGVyIiwiYXBwZW5kVG8iLCJjbG9uZSIsInN5bmNfZmxvYXRpbmdfaGVhZGVyIiwiY2FyZFJlY3QiLCJoZWFkZXJSZWN0IiwidG9wT2Zmc2V0Iiwic2hvdWxkU2hvdyIsInJlbW92ZUNsYXNzIiwidG9wIiwib3V0ZXJXaWR0aCIsImVtcHR5IiwiYmluZF9mbG9hdGluZ19oZWFkZXIiLCJuYW1lc3BhY2UiLCJkb2N1bWVudCIsInNldFRpbWVvdXQiLCIkdG9vbHRpcFNjb3BlIiwidG9vbHRpcFNjb3BlSWQiLCJkaWRJbml0aWFsaXplVG9vbHRpcHMiLCJfdGlwcHkiLCJkZXN0cm95Iiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJpc19ib29raW5nX2xpc3Rpbmdfc2VhcmNoX2F2YWlsYWJsZSIsIndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyIsIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyIsImNsb3NlX3RpbWVfc2xvdHNfcG9wdXAiLCIkbW9kYWwiLCJ3cGJjX215X21vZGFsIiwibW9kYWwiLCJ0cmlnZ2VyIiwic2VhcmNoX2Jvb2tpbmdfaW5fY3VycmVudF9saXN0aW5nIiwiYm9va2luZ0lkIiwia2V5d29yZCIsImhhbmRsZV9ib29rZWRfYmFyX2NsaWNrIiwiZXZlbnQiLCJjdXJyZW50VGFyZ2V0IiwiJGxpbmsiLCJ0YXJnZXQiLCJib29raW5nVXJsIiwicHJldmVudERlZmF1bHQiLCJzdG9wUHJvcGFnYXRpb24iLCJsb2NhdGlvbiIsImhyZWYiLCJ1bmlxdWVfZGF0ZXNfZnJvbV9zZWxlY3Rpb25zIiwiZGF0ZXMiLCJyb3dJbmRleCIsIk9iamVjdCIsImtleXMiLCJnZXRfc2VsZWN0aW9uX3BheWxvYWQiLCJwYXlsb2FkIiwic3RhcnRfc2Vjb25kIiwiZW5kX3NlY29uZCIsInNvcnQiLCJhIiwiYiIsImdldF9hY3RpdmVfYm9va2luZ19zZWxlY3Rpb25fY29udGV4dCIsInNlbGVjdGVkX2RhdGUiLCJzZWxlY3RlZF90aW1lIiwiY3JlYXRlX2Jvb2tpbmdfZnJvbV9hY3RpdmVfc2VsZWN0aW9uIiwiY29udGV4dCIsImJvb2tpbmdGb3JtIiwic2VsZWN0X29uZV9zbG90X2Zvcl9ib29raW5nIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsIiwiYWRkX2Jvb2tpbmdfbW9kYWxfbWlzc2luZyIsIm1vZGUiLCJib29raW5nX2Zvcm0iLCJjbG9uZV9kYXRlIiwiRGF0ZSIsImdldEZ1bGxZZWFyIiwiZ2V0TW9udGgiLCJnZXREYXRlIiwiYWRkX2RheXMiLCJkYXlzIiwibmV4dCIsInNldERhdGUiLCJmb3JtYXRfaXNvX2RhdGUiLCJmb3JtYXRfcm93X2RhdGUiLCJtb250aHMiLCJnZXREYXkiLCJmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5Iiwic3RhcnREYXRlIiwiZW5kRGF0ZSIsImRhdGVwaWNrIiwiZm9ybWF0RGF0ZSIsImNhY2hlX3Jvd190ZW1wbGF0ZXMiLCJ0b0FycmF5Iiwicm93IiwiZW5zdXJlX3Jvd19jb3VudCIsImNvdW50IiwiJHJvd3NXcmFwIiwiJHJvd3MiLCIkY2xvbmUiLCJzbGljZSIsInVwZGF0ZV9yb3dzX2Zvcl9kYXRlX3JhbmdlIiwiZGF5TXMiLCJkYXlzQ291bnQiLCJnZXRUaW1lIiwicm93RGF0ZSIsImdyZXAiLCJjYW5vbmljYWxpemVfc2VsZWN0aW9ucyIsInJlbmRlcl9zZWxlY3Rpb25zIiwicGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uIiwic3RyaW5nRGF0ZXMiLCJqc0RhdGVzQXJyIiwicGFydHMiLCJpc0FycmF5IiwicmFuZ2UiLCJtdWx0aXBsZSIsImlzTmFOIiwic3BsaXQiLCJwYXJzZV9kYXRlX3RleHQiLCJnZXRfZGF0ZXBpY2tfc2VsZWN0ZWRfcmFuZ2UiLCIkZGF0ZSIsImluc3QiLCJfZ2V0SW5zdCIsIl9nZXREYXRlIiwiYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24iLCJvcHRpb25zIiwic3RhcnRJc28iLCJlbmRJc28iLCJjdXJyZW50S2V5IiwibmV4dEtleSIsImZvcmNlX3JlbG9hZCIsInN5bmNfZGF0ZV9yYW5nZV9mcm9tX2lucHV0IiwiZ2V0X2RhdGVfcmFuZ2VfZnJvbV9kYXRhX2F0dHJzIiwiZ2V0X2N1cnJlbnRfZGF0ZV9yYW5nZSIsInNoaWZ0X2RhdGVfcmFuZ2UiLCJkaXJlY3Rpb24iLCJzaGlmdCIsImNsZWFyX3NlbGVjdGlvbiIsInBhcnNlZCIsInNxbE1hdGNoIiwibWF0Y2giLCJwYXJzZURhdGUiLCJlcnJvciIsInNldF90aW1lX3Nsb3RzX2NvbnRleHQiLCIkY29udGV4dCIsImlzIiwicmVzb3VyY2VDaGFuZ2VkIiwicmFuZ2VDaGFuZ2VkIiwiaW5pdF90aW1lX3Nsb3RzX3BhZ2UiLCJyb3dfZnJvbV9wb2ludGVyIiwib3JpZ2luYWwiLCJvcmlnaW5hbEV2ZW50IiwicG9pbnQiLCJ0b3VjaGVzIiwiZWwiLCJlbGVtZW50RnJvbVBvaW50IiwiY2xpZW50WCIsImNsaWVudFkiLCJjb250YWlucyIsIm1pbnV0ZV9mcm9tX3BvaW50ZXIiLCIkbGFuZSIsInJhdGlvIiwiY3JlYXRlX3NlbGVjdGlvbiIsInVwZGF0ZV9zZWxlY3Rpb24iLCJwcmVmZXJyZWRBY3RpdmVJZCIsImludGVydmFscyIsIm1lcmdlZCIsImdyb3VwcyIsIm5ld0FjdGl2ZUlkIiwiYWN0aXZlIiwibGFzdCIsImxhc3RSb3ciLCJtYXAiLCIkdGVtcGxhdGUiLCIkc2VsZWN0aW9uIiwicmVtb3ZlQXR0ciIsInVwZGF0ZV9zdW1tYXJ5IiwiZGF0ZXNDb3VudCIsImRhdGVUZXh0IiwidGltZVRleHQiLCJkZXRhaWxzIiwiZGV0YWlsc0h0bWwiLCJ0aW1lTGFiZWwiLCJzaG93X2xpdmVfdGlwIiwiJHRpcCIsInBhZ2VYIiwicGFnZVkiLCJoaWRlX2xpdmVfdGlwIiwic3luY19zbG90X3N0ZXBfY29udHJvbHMiLCJzeW5jX3pvb21fY29udHJvbHMiLCJpbmRleE9mIiwic2V0X3N0ZXAiLCJzeW5jX3Zpc2libGVfdGltZV9jb250cm9scyIsInNldF92aXNpYmxlX3RpbWVfcmFuZ2UiLCJhY3RpdmVFbGVtZW50Iiwic2V0X21vZGUiLCJpc19iYXJfc2VsZWN0YWJsZV9mb3JfdGltZV9hY3Rpb24iLCJydW5fY29tbWFuZCIsInNlbGVjdF9zbG90c19maXJzdCIsIm5vbmNlIiwic2F2aW5nIiwiSlNPTiIsInN0cmluZ2lmeSIsImJsb2NrX3N1Y2Nlc3MiLCJ1bmJsb2NrX3N1Y2Nlc3MiLCJpbml0X2RhdGVfcmFuZ2VfcGlja2VyIiwiJGRhdGVXcmFwIiwiZmlyc3REYXkiLCJmbiIsImNvbnNvbGUiLCJsb2ciLCJfd3BiYyIsImdldF9vdGhlcl9wYXJhbSIsIm1hcmtlckNsYXNzTmFtZSIsImJlZm9yZVNob3dEYXkiLCJvblNlbGVjdCIsIm9uQ2xvc2UiLCJzaG93T24iLCJzaG93QW5pbSIsImR1cmF0aW9uIiwicmFuZ2VTZWxlY3QiLCJtdWx0aVNlbGVjdCIsIm51bWJlck9mTW9udGhzIiwic3RlcE1vbnRocyIsInByZXZUZXh0IiwibmV4dFRleHQiLCJkYXRlRm9ybWF0IiwiY2hhbmdlTW9udGgiLCJjaGFuZ2VZZWFyIiwibWluRGF0ZSIsIm1heERhdGUiLCJzaG93U3RhdHVzIiwibXVsdGlTZXBhcmF0b3IiLCJjbG9zZUF0VG9wIiwiZ290b0N1cnJlbnQiLCJoaWRlSWZOb1ByZXZOZXh0IiwidXNlVGhlbWVSb2xsZXIiLCJtYW5kYXRvcnkiLCJzaG93X2RhdGVfcmFuZ2VfcGlja2VyIiwiaW5wdXQiLCJfc2hvd0RhdGVwaWNrIiwiX2xhc3RJbnB1dCIsIl9kYXRlcGlja2VyU2hvd2luZyIsIndoaWNoIiwiaW5pdF9yaWdodGJhcl90YWJzIiwiJHRhYiIsInBhbmVsSWQiLCIkcGFuZWwiLCIkdGFibGlzdCIsImZvcmNlIiwiJHBhZ2VzIiwiZmlsdGVyIiwiaW5pdF90aW1lX3Nsb3RzX2NvbXBvbmVudCIsImlzRHJhZ2dpbmciLCJkcmFnU3RhcnRNaW51dGUiLCJkcmFnU3RhcnRSb3ciLCJkcmFnU2VsZWN0aW9uSWQiLCJyZXNpemVNb2RlIiwiJHpvb20iLCIkYmFyVGFyZ2V0IiwiY3VycmVudFJvdyIsIndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3NldF9jb250ZXh0IiwialF1ZXJ5Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktdGltZXNsb3RzL19zcmMvYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBUaW1lIFNsb3RzIEF2YWlsYWJpbGl0eSBVSS5cclxuICovXHJcbiggZnVuY3Rpb24gKCAkICkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIHpvb21TdGVwcyA9IFsgNjAsIDMwLCAxNSwgMTAsIDUgXTtcclxuXHR2YXIgY3VycmVudE1vZGUgPSAnYmxvY2snO1xyXG5cdHZhciBzZWxlY3Rpb25SYW5nZXMgPSBbXTtcclxuXHR2YXIgYWN0aXZlU2VsZWN0aW9uSWQgPSAnJztcclxuXHR2YXIgcm93VGVtcGxhdGVzID0gW107XHJcblx0dmFyIG5leHRTZWxlY3Rpb25JZCA9IDE7XHJcblx0dmFyIG5leHRUb29sdGlwU2NvcGVJZCA9IDE7XHJcblx0dmFyIGFjdGl2ZUxvYWRSZXF1ZXN0ID0gbnVsbDtcclxuXHR2YXIgYWN0aXZlTG9hZFJlcXVlc3RJZCA9IDA7XHJcblx0dmFyIGFjdGl2ZVNhdmVSZXF1ZXN0ID0gbnVsbDtcclxuXHJcblx0ZnVuY3Rpb24gcGFkXzIoIHZhbHVlICkge1xyXG5cdFx0cmV0dXJuICggdmFsdWUgPCAxMCA/ICcwJyA6ICcnICkgKyB2YWx1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG1pbnV0ZXNfdG9fdGltZSggbWludXRlcyApIHtcclxuXHRcdHZhciBob3VycyA9IE1hdGguZmxvb3IoIG1pbnV0ZXMgLyA2MCApO1xyXG5cdFx0dmFyIG1pbnMgPSBtaW51dGVzICUgNjA7XHJcblx0XHRyZXR1cm4gcGFkXzIoIGhvdXJzICkgKyAnOicgKyBwYWRfMiggbWlucyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2xhbXAoIHZhbHVlLCBtaW4sIG1heCApIHtcclxuXHRcdHJldHVybiBNYXRoLm1heCggbWluLCBNYXRoLm1pbiggbWF4LCB2YWx1ZSApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzbmFwX21pbnV0ZSggbWludXRlLCBzdGVwICkge1xyXG5cdFx0cmV0dXJuIE1hdGgucm91bmQoIG1pbnV0ZSAvIHN0ZXAgKSAqIHN0ZXA7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZ3JpZF9jb25maWcoICRncmlkICkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0c3RhcnQ6IHBhcnNlSW50KCAkZ3JpZC5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApLCAxMCApIHx8IDAsXHJcblx0XHRcdGVuZDogcGFyc2VJbnQoICRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApLCAxMCApIHx8IDE0NDAsXHJcblx0XHRcdHN0ZXA6IHBhcnNlSW50KCAkZ3JpZC5hdHRyKCAnZGF0YS13cGJjLXRzLXN0ZXAnICksIDEwICkgfHwgMTVcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfY29udHJvbCggJHBhZ2UsIG5hbWUgKSB7XHJcblx0XHR2YXIgJGNvbnRyb2wgPSAkcGFnZS5maW5kKCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiJyArIG5hbWUgKyAnXCJdJyApLmZpcnN0KCk7XHJcblxyXG5cdFx0aWYgKCAhICRjb250cm9sLmxlbmd0aCApIHtcclxuXHRcdFx0JGNvbnRyb2wgPSAkcGFnZS5maW5kKCAnI3dwYmNfdHNfJyArIG5hbWUgKS5maXJzdCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAkY29udHJvbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBlcmNlbnRfZm9yX21pbnV0ZSggbWludXRlLCBjb25maWcgKSB7XHJcblx0XHRyZXR1cm4gKCAoIG1pbnV0ZSAtIGNvbmZpZy5zdGFydCApIC8gKCBjb25maWcuZW5kIC0gY29uZmlnLnN0YXJ0ICkgKSAqIDEwMDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIG5vcm1hbGl6ZV9zZWxlY3Rpb25fcmFuZ2UoIHN0YXJ0LCBlbmQsIGNvbmZpZyApIHtcclxuXHRcdHN0YXJ0ID0gY2xhbXAoIHNuYXBfbWludXRlKCBzdGFydCwgY29uZmlnLnN0ZXAgKSwgY29uZmlnLnN0YXJ0LCBjb25maWcuZW5kICk7XHJcblx0XHRlbmQgPSBjbGFtcCggc25hcF9taW51dGUoIGVuZCwgY29uZmlnLnN0ZXAgKSwgY29uZmlnLnN0YXJ0LCBjb25maWcuZW5kICk7XHJcblxyXG5cdFx0aWYgKCBzdGFydCA9PT0gZW5kICkge1xyXG5cdFx0XHRlbmQgPSBjbGFtcCggc3RhcnQgKyBjb25maWcuc3RlcCwgY29uZmlnLnN0YXJ0LCBjb25maWcuZW5kICk7XHJcblx0XHRcdGlmICggc3RhcnQgPT09IGVuZCApIHtcclxuXHRcdFx0XHRzdGFydCA9IGNsYW1wKCBlbmQgLSBjb25maWcuc3RlcCwgY29uZmlnLnN0YXJ0LCBjb25maWcuZW5kICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdGFydDogTWF0aC5taW4oIHN0YXJ0LCBlbmQgKSxcclxuXHRcdFx0ZW5kOiBNYXRoLm1heCggc3RhcnQsIGVuZCApXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3NlbGVjdGlvbl9ieV9pZCggc2VsZWN0aW9uSWQgKSB7XHJcblx0XHR2YXIgZm91bmQgPSBudWxsO1xyXG5cdFx0JC5lYWNoKCBzZWxlY3Rpb25SYW5nZXMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdGlmICggaXRlbS5pZCA9PT0gc2VsZWN0aW9uSWQgKSB7XHJcblx0XHRcdFx0Zm91bmQgPSBpdGVtO1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH0gKTtcclxuXHRcdHJldHVybiBmb3VuZDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbmRlcl9heGlzKCAkZ3JpZCApIHtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblx0XHR2YXIgJGF4aXMgPSAkZ3JpZC5maW5kKCAnLndwYmNfdHNfdGltZV9heGlzJyApO1xyXG5cdFx0dmFyIGh0bWwgPSAnJztcclxuXHRcdHZhciBtaW51dGU7XHJcblx0XHR2YXIgc2xvdENvdW50ID0gTWF0aC5tYXgoIDEsICggY29uZmlnLmVuZCAtIGNvbmZpZy5zdGFydCApIC8gY29uZmlnLnN0ZXAgKTtcclxuXHRcdHZhciB2aXNpYmxlSG91cnMgPSBNYXRoLm1heCggMSwgKCBjb25maWcuZW5kIC0gY29uZmlnLnN0YXJ0ICkgLyA2MCApO1xyXG5cdFx0dmFyIGF4aXNGb250U2l6ZSA9IGNsYW1wKCBNYXRoLnJvdW5kKCAxNiAtICggdmlzaWJsZUhvdXJzICogMC4yNSApICksIDEwLCAxMyApO1xyXG5cdFx0dmFyIGF4aXNGb250V2VpZ2h0ID0gdmlzaWJsZUhvdXJzIDw9IDEwID8gNTUwIDogNDAwO1xyXG5cdFx0dmFyIGZpcnN0SG91ciA9IE1hdGguY2VpbCggY29uZmlnLnN0YXJ0IC8gNjAgKSAqIDYwO1xyXG5cclxuXHRcdCRncmlkLmNzcyggJy0td3BiYy10cy1zbG90LWNvdW50Jywgc2xvdENvdW50ICk7XHJcblx0XHQkZ3JpZC5jc3MoICctLXdwYmMtdHMtYXhpcy1sYWJlbC1zaXplJywgYXhpc0ZvbnRTaXplICsgJ3B4JyApO1xyXG5cdFx0JGdyaWQuY3NzKCAnLS13cGJjLXRzLWF4aXMtbGFiZWwtd2VpZ2h0JywgYXhpc0ZvbnRXZWlnaHQgKTtcclxuXHJcblx0XHRmb3IgKCBtaW51dGUgPSBmaXJzdEhvdXI7IG1pbnV0ZSA8PSBjb25maWcuZW5kOyBtaW51dGUgKz0gNjAgKSB7XHJcblx0XHRcdGh0bWwgKz0gJzxzcGFuIGNsYXNzPVwid3BiY190c19heGlzX2xhYmVsXCIgc3R5bGU9XCJsZWZ0OicgKyBwZXJjZW50X2Zvcl9taW51dGUoIG1pbnV0ZSwgY29uZmlnICkgKyAnJTtcIj4nICsgbWludXRlc190b190aW1lKCBtaW51dGUgKSArICc8L3NwYW4+JztcclxuXHRcdFx0aHRtbCArPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX3RzX2F4aXNfdGlja1wiIHN0eWxlPVwibGVmdDonICsgcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApICsgJyU7XCI+PC9zcGFuPic7XHJcblx0XHRcdGlmICggbWludXRlICsgMzAgPCBjb25maWcuZW5kICkge1xyXG5cdFx0XHRcdGh0bWwgKz0gJzxzcGFuIGNsYXNzPVwid3BiY190c19heGlzX2RvdFwiIHN0eWxlPVwibGVmdDonICsgcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUgKyAzMCwgY29uZmlnICkgKyAnJTtcIj48L3NwYW4+JztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIG1pbnV0ZSA9IGNvbmZpZy5zdGFydCArIGNvbmZpZy5zdGVwOyBtaW51dGUgPCBjb25maWcuZW5kOyBtaW51dGUgKz0gY29uZmlnLnN0ZXAgKSB7XHJcblx0XHRcdGlmICggMCA9PT0gbWludXRlICUgNjAgfHwgMzAgPT09IG1pbnV0ZSAlIDYwICkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblx0XHRcdGh0bWwgKz0gJzxzcGFuIGNsYXNzPVwid3BiY190c19heGlzX21pbm9yXCIgc3R5bGU9XCJsZWZ0OicgKyBwZXJjZW50X2Zvcl9taW51dGUoIG1pbnV0ZSwgY29uZmlnICkgKyAnJTtcIj48L3NwYW4+JztcclxuXHRcdH1cclxuXHJcblx0XHQkYXhpcy5odG1sKCBodG1sICk7XHJcblx0XHRyZWZyZXNoX2Zsb2F0aW5nX2hlYWRlciggJGdyaWQuY2xvc2VzdCggJy53cGJjX3RzX3BhZ2UnICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBvc2l0aW9uX2JhcnMoICRncmlkICkge1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHJcblx0XHQkZ3JpZC5maW5kKCAnLndwYmNfdHNfYmFyJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyICRiYXIgPSAkKCB0aGlzICk7XHJcblx0XHRcdHZhciBzdGFydCA9IHBhcnNlSW50KCAkYmFyLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICksIDEwICk7XHJcblx0XHRcdHZhciBlbmQgPSBwYXJzZUludCggJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcgKSwgMTAgKTtcclxuXHRcdFx0dmFyIHZpc2libGVTdGFydCA9IGNsYW1wKCBzdGFydCwgY29uZmlnLnN0YXJ0LCBjb25maWcuZW5kICk7XHJcblx0XHRcdHZhciB2aXNpYmxlRW5kID0gY2xhbXAoIGVuZCwgY29uZmlnLnN0YXJ0LCBjb25maWcuZW5kICk7XHJcblx0XHRcdHZhciBsZWZ0O1xyXG5cdFx0XHR2YXIgd2lkdGg7XHJcblxyXG5cdFx0XHRpZiAoIHZpc2libGVFbmQgPD0gY29uZmlnLnN0YXJ0IHx8IHZpc2libGVTdGFydCA+PSBjb25maWcuZW5kIHx8IHZpc2libGVTdGFydCA+PSB2aXNpYmxlRW5kICkge1xyXG5cdFx0XHRcdCRiYXIuaGlkZSgpO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bGVmdCA9IHBlcmNlbnRfZm9yX21pbnV0ZSggdmlzaWJsZVN0YXJ0LCBjb25maWcgKTtcclxuXHRcdFx0d2lkdGggPSBwZXJjZW50X2Zvcl9taW51dGUoIHZpc2libGVFbmQsIGNvbmZpZyApIC0gbGVmdDtcclxuXHRcdFx0JGJhci5zaG93KCkuY3NzKCB7IGxlZnQ6IGxlZnQgKyAnJScsIHdpZHRoOiB3aWR0aCArICclJyB9ICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW5kZXJfdGltZWxpbmVfYmFycyggJHBhZ2UsIGJhcnMgKSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSB3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3BhZ2UgfHwge307XHJcblx0XHR2YXIgbGFiZWxzID0gc2V0dGluZ3MuaTE4biB8fCB7fTtcclxuXHJcblx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfYmFyW2RhdGEtd3BiYy10cy1zb3VyY2U9XCJzZXJ2ZXJcIl0nICkucmVtb3ZlKCk7XHJcblxyXG5cdFx0JC5lYWNoKCBiYXJzIHx8IHt9LCBmdW5jdGlvbiAoIGRhdGUsIHJlc291cmNlcyApIHtcclxuXHRcdFx0dmFyICRyb3cgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1kYXRlPVwiJyArIGRhdGUgKyAnXCJdJyApO1xyXG5cclxuXHRcdFx0aWYgKCAhICRyb3cubGVuZ3RoIHx8ICEgcmVzb3VyY2VzICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JC5lYWNoKCByZXNvdXJjZXMsIGZ1bmN0aW9uICggcmVzb3VyY2VJZCwgcmVzb3VyY2VCYXJzICkge1xyXG5cdFx0XHRcdCQuZWFjaCggcmVzb3VyY2VCYXJzIHx8IFtdLCBmdW5jdGlvbiAoIGluZGV4LCBpbnRlcnZhbCApIHtcclxuXHRcdFx0XHRcdHZhciB0eXBlID0gJ2Jsb2NrZWQnID09PSBpbnRlcnZhbC50eXBlID8gJ2Jsb2NrZWQnIDogKCAndW5hdmFpbGFibGVfZGF5JyA9PT0gaW50ZXJ2YWwudHlwZSA/ICd1bmF2YWlsYWJsZV9kYXknIDogJ2Jvb2tlZCcgKTtcclxuXHRcdFx0XHRcdHZhciBpY29uID0gJ2Jvb2tlZCcgPT09IHR5cGUgPyAnd3BiY19pY25fbG9jaycgOiAoICd1bmF2YWlsYWJsZV9kYXknID09PSB0eXBlID8gJ3dwYmNfaWNuX2V2ZW50X2J1c3knIDogJ3dwYmNfaWNuX2RvX25vdF9kaXN0dXJiX29uJyApO1xyXG5cdFx0XHRcdFx0dmFyIHRvb2x0aXAgPSBpbnRlcnZhbC50b29sdGlwIHx8ICcnO1xyXG5cdFx0XHRcdFx0dmFyICRiYXIgPSAkKCAnPGRpdiBjbGFzcz1cIndwYmNfdHNfYmFyXCIgZGF0YS13cGJjLXRzLXNvdXJjZT1cInNlcnZlclwiPjwvZGl2PicgKTtcclxuXHRcdFx0XHRcdHZhciAkaWNvbldyYXA7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAnYm9va2VkJyA9PT0gdHlwZSAmJiBpbnRlcnZhbC5ib29raW5nX3VybCApIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxhIGNsYXNzPVwid3BiY190c19ib29raW5nX2xpbmsgdG9vbHRpcF90b3BcIiByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCI+PHNwYW4+PC9zcGFuPjwvYT4nICk7XHJcblx0XHRcdFx0XHRcdCRpY29uV3JhcFxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnaHJlZicsIGludGVydmFsLmJvb2tpbmdfdXJsIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1ib29raW5nLWlkJywgaW50ZXJ2YWwuYm9va2luZ19pZCB8fCAnJyApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdhcmlhLWxhYmVsJywgKCBsYWJlbHMub3Blbl9ib29raW5nIHx8ICdPcGVuIGJvb2tpbmcgaW4gQm9va2luZyBMaXN0aW5nJyApICsgKCBpbnRlcnZhbC5ib29raW5nX2lkID8gJzogJyArIGludGVydmFsLmJvb2tpbmdfaWQgOiAnJyApIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnLCB0b29sdGlwIHx8ICcnICk7XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCAndW5hdmFpbGFibGVfZGF5JyA9PT0gdHlwZSAmJiBpbnRlcnZhbC5ydWxlX3VybCApIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxhIGNsYXNzPVwid3BiY190c19ydWxlX2xpbmsgdG9vbHRpcF90b3BcIj48c3Bhbj48L3NwYW4+PC9hPicgKTtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdocmVmJywgaW50ZXJ2YWwucnVsZV91cmwgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJ1bGUtc291cmNlJywgaW50ZXJ2YWwucnVsZV9zb3VyY2UgfHwgaW50ZXJ2YWwuc291cmNlX3R5cGUgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnYXJpYS1sYWJlbCcsICggbGFiZWxzLm9wZW5fYXZhaWxhYmlsaXR5X3J1bGUgfHwgJ09wZW4gYXZhaWxhYmlsaXR5IHNldHRpbmdzJyApICsgKCBpbnRlcnZhbC5zdGF0dXNfdGl0bGUgPyAnOiAnICsgaW50ZXJ2YWwuc3RhdHVzX3RpdGxlIDogJycgKSApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgdG9vbHRpcCB8fCAnJyApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxzcGFuIGNsYXNzPVwid3BiY190c19iYXJfaWNvbiB0b29sdGlwX3RvcFwiPjxzcGFuPjwvc3Bhbj48L3NwYW4+JyApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgdG9vbHRpcCB8fCAnJyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdCRiYXJcclxuXHRcdFx0XHRcdFx0LmFkZENsYXNzKCAnd3BiY190c19iYXJfJyArIHR5cGUgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcsIHBhcnNlSW50KCBpbnRlcnZhbC5zdGFydF9taW51dGUsIDEwICkgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnLCBwYXJzZUludCggaW50ZXJ2YWwuZW5kX21pbnV0ZSwgMTAgKSApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJlc291cmNlLWlkJywgcmVzb3VyY2VJZCApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnLCBpbnRlcnZhbC5ib29raW5nX2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtYm9va2luZy11cmwnLCBpbnRlcnZhbC5ib29raW5nX3VybCB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXJ1bGUtdXJsJywgaW50ZXJ2YWwucnVsZV91cmwgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy11bmF2YWlsYWJsZS1pZCcsIGludGVydmFsLnVuYXZhaWxhYmxlX3RpbWVzbG90X2lkIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc291cmNlLXR5cGUnLCBpbnRlcnZhbC5zb3VyY2VfdHlwZSB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWVkaXRhYmxlJywgZmFsc2UgPT09IGludGVydmFsLmVkaXRhYmxlID8gJzAnIDogJzEnICk7XHJcblx0XHRcdFx0XHRpZiAoIHRvb2x0aXAgKSB7XHJcblx0XHRcdFx0XHRcdCRiYXIuYXR0ciggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnLCB0b29sdGlwICkuYWRkQ2xhc3MoICd0b29sdGlwX3RvcCcgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCRpY29uV3JhcC5maW5kKCAnc3BhbicgKS5hZGRDbGFzcyggaWNvbiApO1xyXG5cdFx0XHRcdFx0JGJhci5hcHBlbmQoICRpY29uV3JhcCApO1xyXG5cdFx0XHRcdFx0JHJvdy5maW5kKCAnLndwYmNfdHNfbGFuZScgKS5hcHBlbmQoICRiYXIgKTtcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRwb3NpdGlvbl9iYXJzKCAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKSApO1xyXG5cdFx0cmVmcmVzaF9iYXJfdG9vbHRpcHMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfcGFnZSB8fCB7fTtcclxuXHRcdHZhciAkZGF0ZVJhbmdlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciBsYWJlbHMgPSBzZXR0aW5ncy5pMThuIHx8IHt9O1xyXG5cdFx0dmFyIHJlcXVlc3RJZDtcclxuXHJcblx0XHRpZiAoICEgc2V0dGluZ3MuYWpheF91cmwgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGFjdGl2ZUxvYWRSZXF1ZXN0ICYmIGFjdGl2ZUxvYWRSZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgKSB7XHJcblx0XHRcdGFjdGl2ZUxvYWRSZXF1ZXN0LmFib3J0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVxdWVzdElkID0gKythY3RpdmVMb2FkUmVxdWVzdElkO1xyXG5cdFx0c2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCB0cnVlLCBsYWJlbHMubG9hZGluZyB8fCAnTG9hZGluZycgKTtcclxuXHJcblx0XHRhY3RpdmVMb2FkUmVxdWVzdCA9ICQucG9zdCggc2V0dGluZ3MuYWpheF91cmwsIHtcclxuXHRcdFx0YWN0aW9uOiAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX1RJTUVTTE9UU19SRUFEJyxcclxuXHRcdFx0cmVzb3VyY2VfaWQ6IGdldF9jb250cm9sKCAkcGFnZSwgJ3Jlc291cmNlJyApLnZhbCgpLFxyXG5cdFx0XHRkYXRlX3N0YXJ0OiAkZGF0ZVJhbmdlLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICksXHJcblx0XHRcdGRhdGVfZW5kOiAkZGF0ZVJhbmdlLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApXHJcblx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcclxuXHRcdFx0aWYgKCByZXF1ZXN0SWQgIT09IGFjdGl2ZUxvYWRSZXF1ZXN0SWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyAmJiByZXNwb25zZS5kYXRhICkge1xyXG5cdFx0XHRcdHJlbmRlcl90aW1lbGluZV9iYXJzKCAkcGFnZSwgcmVzcG9uc2UuZGF0YS5iYXJzICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKS5mYWlsKCBmdW5jdGlvbiAoIHhociwgdGV4dFN0YXR1cyApIHtcclxuXHRcdFx0aWYgKCAnYWJvcnQnICE9PSB0ZXh0U3RhdHVzICYmIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbGFiZWxzLnNhdmVfZXJyb3IgfHwgJ1VuYWJsZSB0byBzYXZlIHRpbWUtc2xvdCBhdmFpbGFiaWxpdHkuJywgJ2Vycm9yJywgNTAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggcmVxdWVzdElkID09PSBhY3RpdmVMb2FkUmVxdWVzdElkICkge1xyXG5cdFx0XHRcdHNldF90aW1lbGluZV9sb2FkaW5nKCAkcGFnZSwgZmFsc2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3Jvd3NfYmV0d2VlbiggJHBhZ2UsIHN0YXJ0Um93LCBlbmRSb3cgKSB7XHJcblx0XHR2YXIgc3RhcnRJbmRleCA9IHBhcnNlSW50KCBzdGFydFJvdywgMTAgKTtcclxuXHRcdHZhciBlbmRJbmRleCA9IHBhcnNlSW50KCBlbmRSb3csIDEwICk7XHJcblx0XHR2YXIgbWluID0gTWF0aC5taW4oIHN0YXJ0SW5kZXgsIGVuZEluZGV4ICk7XHJcblx0XHR2YXIgbWF4ID0gTWF0aC5tYXgoIHN0YXJ0SW5kZXgsIGVuZEluZGV4ICk7XHJcblx0XHR2YXIgcm93cyA9IFtdO1xyXG5cdFx0dmFyIGk7XHJcblxyXG5cdFx0Zm9yICggaSA9IG1pbjsgaSA8PSBtYXg7IGkrKyApIHtcclxuXHRcdFx0aWYgKCAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgaSArICdcIl0nICkubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJvd3MucHVzaCggU3RyaW5nKCBpICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiByb3dzO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcm93X2xhYmVsKCAkcGFnZSwgcm93SWQgKSB7XHJcblx0XHRyZXR1cm4gJC50cmltKCAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgcm93SWQgKyAnXCJdIC53cGJjX3RzX3Jvd19sYWJlbF90ZXh0JyApLnRleHQoKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZXNjYXBlX2h0bWwoIHZhbHVlICkge1xyXG5cdFx0cmV0dXJuICQoICc8ZGl2IC8+JyApLnRleHQoIHZhbHVlICkuaHRtbCgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcG9zaXRpb25fbG9hZGluZ19vdmVybGF5KCAkcGFnZSApIHtcclxuXHRcdHZhciAkY2FyZCA9ICRwYWdlLmZpbmQoICcud3BiY190c190aW1lbGluZV9jYXJkJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgY2FyZCA9ICRjYXJkLmdldCggMCApO1xyXG5cdFx0dmFyICRvdmVybGF5ID0gJGNhcmQuZmluZCggJy53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScgKS5maXJzdCgpO1xyXG5cclxuXHRcdGlmICggISBjYXJkIHx8ICEgJG92ZXJsYXkubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JG92ZXJsYXkuY3NzKCB7XHJcblx0XHRcdHdpZHRoOiBjYXJkLmNsaWVudFdpZHRoICsgJ3B4JyxcclxuXHRcdFx0aGVpZ2h0OiBjYXJkLmNsaWVudEhlaWdodCArICdweCcsXHJcblx0XHRcdHRyYW5zZm9ybTogJ3RyYW5zbGF0ZSgnICsgY2FyZC5zY3JvbGxMZWZ0ICsgJ3B4LCcgKyBjYXJkLnNjcm9sbFRvcCArICdweCknXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfdGltZWxpbmVfbG9hZGluZyggJHBhZ2UsIGlzTG9hZGluZywgbGFiZWwgKSB7XHJcblx0XHR2YXIgJGNhcmQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfdGltZWxpbmVfY2FyZCcgKTtcclxuXHRcdHZhciAkb3ZlcmxheTtcclxuXHJcblx0XHQkY2FyZFxyXG5cdFx0XHQudG9nZ2xlQ2xhc3MoICdpcy1sb2FkaW5nJywgISEgaXNMb2FkaW5nIClcclxuXHRcdFx0LmZpbmQoICcud3BiY190c19sb2FkaW5nX292ZXJsYXknIClcclxuXHRcdFx0LmF0dHIoICdhcmlhLWhpZGRlbicsIGlzTG9hZGluZyA/ICdmYWxzZScgOiAndHJ1ZScgKTtcclxuXHJcblx0XHRpZiAoIGxhYmVsICkge1xyXG5cdFx0XHQkb3ZlcmxheSA9ICRwYWdlLmZpbmQoICcud3BiY190c19sb2FkaW5nX292ZXJsYXknICkuZmlyc3QoKTtcclxuXHRcdFx0JG92ZXJsYXkuZmluZCggJy53cGJjX3NwaW5zX2xvYWRpbmdfY29udGFpbmVyID4gc3BhbicgKS50ZXh0KCBsYWJlbCArICcuLi4nICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc0xvYWRpbmcgKSB7XHJcblx0XHRcdHBvc2l0aW9uX2xvYWRpbmdfb3ZlcmxheSggJHBhZ2UgKTtcclxuXHRcdFx0JGNhcmQub2ZmKCAnc2Nyb2xsLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApLm9uKCAnc2Nyb2xsLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHBvc2l0aW9uX2xvYWRpbmdfb3ZlcmxheSggJHBhZ2UgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0JGNhcmQub2ZmKCAnc2Nyb2xsLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApO1xyXG5cdFx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApLmNzcygge1xyXG5cdFx0XHRcdHdpZHRoOiAnJyxcclxuXHRcdFx0XHRoZWlnaHQ6ICcnLFxyXG5cdFx0XHRcdHRyYW5zZm9ybTogJydcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X2FjdGlvbl9idXR0b25zX2J1c3koICRwYWdlLCBpc0J1c3kgKSB7XHJcblx0XHR2YXIgJHNjb3BlID0gJHBhZ2UuYWRkKCAkcGFnZS5jbG9zZXN0KCAnLm1vZGFsJyApICkuYWRkKCAkKCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzJyApICk7XHJcblxyXG5cdFx0JHNjb3BlXHJcblx0XHRcdC5maW5kKCAnW2RhdGEtd3BiYy10cy1jb21tYW5kXSwgLndwYmNfdHNfY2xlYXJfc2VsZWN0aW9uJyApXHJcblx0XHRcdC50b2dnbGVDbGFzcyggJ2Rpc2FibGVkJywgISEgaXNCdXN5IClcclxuXHRcdFx0LmF0dHIoICdhcmlhLWRpc2FibGVkJywgaXNCdXN5ID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfZnVsbF9wYWdlX2NvbXBvbmVudCggJHBhZ2UgKSB7XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQhICRwYWdlLmhhc0NsYXNzKCAnd3BiY190c19wb3B1cCcgKVxyXG5cdFx0XHQmJiAkcGFnZS5jbG9zZXN0KCAnLndwYmNfYWRtaW5fcGFnZV9fdGFiX190aW1lX3Nsb3RzX2F2YWlsYWJpbGl0eScgKS5sZW5ndGggPiAwXHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2Zsb2F0aW5nX2hlYWRlcl9uYW1lc3BhY2UoICRwYWdlICkge1xyXG5cdFx0cmV0dXJuICcud3BiY190c19mbG9hdGluZ18nICsgU3RyaW5nKCAkcGFnZS5hdHRyKCAnZGF0YS13cGJjLXRzLWlkLXByZWZpeCcgKSB8fCAncGFnZScgKS5yZXBsYWNlKCAvW15cXHddL2csICdfJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3RvcF9uYXZfYm90dG9tKCkge1xyXG5cdFx0dmFyICR0b3BOYXYgPSAkKCAnLndwYmNfdWlfZWxfX3RvcF9uYXY6dmlzaWJsZScgKS5maXJzdCgpO1xyXG5cdFx0dmFyIHJlY3Q7XHJcblxyXG5cdFx0aWYgKCAhICR0b3BOYXYubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gMDtcclxuXHRcdH1cclxuXHJcblx0XHRyZWN0ID0gJHRvcE5hdi5nZXQoIDAgKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdHJldHVybiBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggcmVjdC5ib3R0b20gKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZW5zdXJlX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGZsb2F0aW5nID0gJHBhZ2UuY2hpbGRyZW4oICcud3BiY190c19mbG9hdGluZ19oZWFkZXInICk7XHJcblx0XHR2YXIgJGhlYWRlcjtcclxuXHJcblx0XHRpZiAoICRmbG9hdGluZy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiAkZmxvYXRpbmc7XHJcblx0XHR9XHJcblxyXG5cdFx0JGhlYWRlciA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkID4gLndwYmNfdHNfaGVhZGVyJyApLmZpcnN0KCk7XHJcblx0XHQkZmxvYXRpbmcgPSAkKCAnPGRpdiBjbGFzcz1cIndwYmNfdHNfZmxvYXRpbmdfaGVhZGVyXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9kaXY+JyApLmFwcGVuZFRvKCAkcGFnZSApO1xyXG5cclxuXHRcdGlmICggJGhlYWRlci5sZW5ndGggKSB7XHJcblx0XHRcdCRmbG9hdGluZy5hcHBlbmQoICRoZWFkZXIuY2xvbmUoIGZhbHNlLCBmYWxzZSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICRmbG9hdGluZztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZmxvYXRpbmc7XHJcblx0XHR2YXIgJGNhcmQ7XHJcblx0XHR2YXIgJGdyaWQ7XHJcblx0XHR2YXIgJGhlYWRlcjtcclxuXHRcdHZhciBjYXJkO1xyXG5cdFx0dmFyIGNhcmRSZWN0O1xyXG5cdFx0dmFyIGhlYWRlclJlY3Q7XHJcblx0XHR2YXIgdG9wT2Zmc2V0O1xyXG5cdFx0dmFyIHNob3VsZFNob3c7XHJcblxyXG5cdFx0aWYgKCAhIGlzX2Z1bGxfcGFnZV9jb21wb25lbnQoICRwYWdlICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkZmxvYXRpbmcgPSBlbnN1cmVfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdFx0JGNhcmQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfdGltZWxpbmVfY2FyZCcgKS5maXJzdCgpO1xyXG5cdFx0JGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKS5maXJzdCgpO1xyXG5cdFx0JGhlYWRlciA9ICRncmlkLmZpbmQoICc+IC53cGJjX3RzX2hlYWRlcicgKS5maXJzdCgpO1xyXG5cdFx0Y2FyZCA9ICRjYXJkLmdldCggMCApO1xyXG5cclxuXHRcdGlmICggISBjYXJkIHx8ICEgJGdyaWQubGVuZ3RoIHx8ICEgJGhlYWRlci5sZW5ndGggKSB7XHJcblx0XHRcdCRmbG9hdGluZy5yZW1vdmVDbGFzcyggJ2lzLXZpc2libGUnICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjYXJkUmVjdCA9IGNhcmQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHRoZWFkZXJSZWN0ID0gJGhlYWRlci5nZXQoIDAgKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHRcdHRvcE9mZnNldCA9IGdldF90b3BfbmF2X2JvdHRvbSgpO1xyXG5cdFx0c2hvdWxkU2hvdyA9ICggaGVhZGVyUmVjdC50b3AgPCB0b3BPZmZzZXQgKSAmJiAoIGNhcmRSZWN0LmJvdHRvbSA+ICggdG9wT2Zmc2V0ICsgaGVhZGVyUmVjdC5oZWlnaHQgKSApO1xyXG5cclxuXHRcdGlmICggISBzaG91bGRTaG93ICkge1xyXG5cdFx0XHQkZmxvYXRpbmcucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZsb2F0aW5nXHJcblx0XHRcdC5jc3MoIHtcclxuXHRcdFx0XHR0b3A6IHRvcE9mZnNldCArICdweCcsXHJcblx0XHRcdFx0bGVmdDogTWF0aC5yb3VuZCggY2FyZFJlY3QubGVmdCApICsgJ3B4JyxcclxuXHRcdFx0XHR3aWR0aDogTWF0aC5yb3VuZCggY2FyZC5jbGllbnRXaWR0aCApICsgJ3B4JyxcclxuXHRcdFx0XHQnLS13cGJjLXRzLWZsb2F0aW5nLXNjcm9sbC1sZWZ0JzogKCAtMSAqIGNhcmQuc2Nyb2xsTGVmdCApICsgJ3B4JyxcclxuXHRcdFx0XHQnLS13cGJjLXRzLWZsb2F0aW5nLXNjcm9sbC1sZWZ0LWFicyc6IGNhcmQuc2Nyb2xsTGVmdCArICdweCdcclxuXHRcdFx0fSApXHJcblx0XHRcdC5hZGRDbGFzcyggJ2lzLXZpc2libGUnICk7XHJcblxyXG5cdFx0JGZsb2F0aW5nLmNoaWxkcmVuKCAnLndwYmNfdHNfaGVhZGVyJyApLmNzcyggJ3dpZHRoJywgTWF0aC5yb3VuZCggJGdyaWQub3V0ZXJXaWR0aCgpICkgKyAncHgnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWZyZXNoX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGZsb2F0aW5nO1xyXG5cdFx0dmFyICRoZWFkZXI7XHJcblxyXG5cdFx0aWYgKCAhICRwYWdlIHx8ICEgJHBhZ2UubGVuZ3RoIHx8ICEgaXNfZnVsbF9wYWdlX2NvbXBvbmVudCggJHBhZ2UgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRmbG9hdGluZyA9ICRwYWdlLmNoaWxkcmVuKCAnLndwYmNfdHNfZmxvYXRpbmdfaGVhZGVyJyApO1xyXG5cclxuXHRcdGlmICggISAkZmxvYXRpbmcubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGhlYWRlciA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkID4gLndwYmNfdHNfaGVhZGVyJyApLmZpcnN0KCk7XHJcblx0XHQkZmxvYXRpbmcuZW1wdHkoKTtcclxuXHJcblx0XHRpZiAoICRoZWFkZXIubGVuZ3RoICkge1xyXG5cdFx0XHQkZmxvYXRpbmcuYXBwZW5kKCAkaGVhZGVyLmNsb25lKCBmYWxzZSwgZmFsc2UgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYmluZF9mbG9hdGluZ19oZWFkZXIoICRwYWdlICkge1xyXG5cdFx0dmFyIG5hbWVzcGFjZTtcclxuXHJcblx0XHRpZiAoICEgaXNfZnVsbF9wYWdlX2NvbXBvbmVudCggJHBhZ2UgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdG5hbWVzcGFjZSA9IGdldF9mbG9hdGluZ19oZWFkZXJfbmFtZXNwYWNlKCAkcGFnZSApO1xyXG5cdFx0ZW5zdXJlX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHJcblx0XHQkKCB3aW5kb3cgKVxyXG5cdFx0XHQub2ZmKCAnc2Nyb2xsJyArIG5hbWVzcGFjZSArICcgcmVzaXplJyArIG5hbWVzcGFjZSApXHJcblx0XHRcdC5vbiggJ3Njcm9sbCcgKyBuYW1lc3BhY2UgKyAnIHJlc2l6ZScgKyBuYW1lc3BhY2UsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLmZpbmQoICcud3BiY190c190aW1lbGluZV9jYXJkJyApXHJcblx0XHRcdC5vZmYoICdzY3JvbGwnICsgbmFtZXNwYWNlIClcclxuXHRcdFx0Lm9uKCAnc2Nyb2xsJyArIG5hbWVzcGFjZSwgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKVxyXG5cdFx0XHQub2ZmKCAnY2xpY2snICsgbmFtZXNwYWNlIClcclxuXHRcdFx0Lm9uKCAnY2xpY2snICsgbmFtZXNwYWNlLCAnLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X2xlZnRfdmVydGljYWxfbmF2LCAud3BiY191aV9fdG9wX25hdl9fYnRuX3Nob3dfcmlnaHRfdmVydGljYWxfbmF2LCAud3BiY191aV9fdG9wX25hdl9fYnRuX2Z1bGxfc2NyZWVuLCAud3BiY191aV9fdG9wX25hdl9fYnRuX25vcm1hbF9zY3JlZW4nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdFx0XHRcdH0sIDgwICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlZnJlc2hfYmFyX3Rvb2x0aXBzKCAkcGFnZSApIHtcclxuXHRcdHZhciAkdG9vbHRpcFNjb3BlID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3RpbWVsaW5lX2NhcmQnICkuZmlyc3QoKTtcclxuXHRcdHZhciB0b29sdGlwU2NvcGVJZDtcclxuXHRcdHZhciBkaWRJbml0aWFsaXplVG9vbHRpcHMgPSBmYWxzZTtcclxuXHJcblx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfYmFyLnRvb2x0aXBfdG9wLCAud3BiY190c19iYXJfaWNvbi50b29sdGlwX3RvcCwgLndwYmNfdHNfYm9va2luZ19saW5rLnRvb2x0aXBfdG9wLCAud3BiY190c19ydWxlX2xpbmsudG9vbHRpcF90b3AnICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIHRoaXMuX3RpcHB5ICkge1xyXG5cdFx0XHRcdHRoaXMuX3RpcHB5LmRlc3Ryb3koKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyApIHtcclxuXHRcdFx0aWYgKCAkdG9vbHRpcFNjb3BlLmxlbmd0aCApIHtcclxuXHRcdFx0XHR0b29sdGlwU2NvcGVJZCA9ICR0b29sdGlwU2NvcGUuYXR0ciggJ2lkJyApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgdG9vbHRpcFNjb3BlSWQgKSB7XHJcblx0XHRcdFx0XHR0b29sdGlwU2NvcGVJZCA9ICd3cGJjX3RzX3RpbWVsaW5lX3Rvb2x0aXBfc2NvcGVfJyArIG5leHRUb29sdGlwU2NvcGVJZDtcclxuXHRcdFx0XHRcdG5leHRUb29sdGlwU2NvcGVJZCsrO1xyXG5cdFx0XHRcdFx0JHRvb2x0aXBTY29wZS5hdHRyKCAnaWQnLCB0b29sdGlwU2NvcGVJZCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZGlkSW5pdGlhbGl6ZVRvb2x0aXBzID0gd2luZG93LndwYmNfZGVmaW5lX3RpcHB5X3Rvb2x0aXBzKCAnIycgKyB0b29sdGlwU2NvcGVJZCArICcgJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGRpZEluaXRpYWxpemVUb29sdGlwcyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQkcGFnZS5maW5kKCAnW2RhdGEtb3JpZ2luYWwtdGl0bGVdJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCAhICQoIHRoaXMgKS5hdHRyKCAndGl0bGUnICkgKSB7XHJcblx0XHRcdFx0JCggdGhpcyApLmF0dHIoICd0aXRsZScsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19ib29raW5nX2xpc3Rpbmdfc2VhcmNoX2F2YWlsYWJsZSgpIHtcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zXHJcblx0XHRcdCYmICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd2luZG93LndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZ1xyXG5cdFx0XHQmJiAkKCAnI3dwYmNfc2VhcmNoX2ZpZWxkJyApLmxlbmd0aFxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsb3NlX3RpbWVfc2xvdHNfcG9wdXAoICRwYWdlICkge1xyXG5cdFx0dmFyICRtb2RhbCA9ICRwYWdlLmNsb3Nlc3QoICcud3BiY19tb2RhbF9fYXZhaWxhYmlsaXR5X3RpbWVzbG90c19fc2VjdGlvbiwgLm1vZGFsJyApO1xyXG5cclxuXHRcdGlmICggISAkbW9kYWwubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgJG1vZGFsLndwYmNfbXlfbW9kYWwgKSB7XHJcblx0XHRcdCRtb2RhbC53cGJjX215X21vZGFsKCAnaGlkZScgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICRtb2RhbC5tb2RhbCApIHtcclxuXHRcdFx0JG1vZGFsLm1vZGFsKCAnaGlkZScgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRtb2RhbC5maW5kKCAnW2RhdGEtZGlzbWlzcz1cIm1vZGFsXCJdJyApLmZpcnN0KCkudHJpZ2dlciggJ2NsaWNrJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2VhcmNoX2Jvb2tpbmdfaW5fY3VycmVudF9saXN0aW5nKCAkcGFnZSwgYm9va2luZ0lkICkge1xyXG5cdFx0dmFyIGtleXdvcmQgPSAnaWQ6JyArIHBhcnNlSW50KCBib29raW5nSWQsIDEwICk7XHJcblxyXG5cdFx0JCggJyN3cGJjX3NlYXJjaF9maWVsZCcgKS52YWwoIGtleXdvcmQgKTtcclxuXHRcdGNsb3NlX3RpbWVfc2xvdHNfcG9wdXAoICRwYWdlICk7XHJcblx0XHR3aW5kb3cud3BiY19hanhfYm9va2luZ19zZW5kX3NlYXJjaF9yZXF1ZXN0X3dpdGhfcGFyYW1zKCB7XHJcblx0XHRcdCdrZXl3b3JkJzoga2V5d29yZCxcclxuXHRcdFx0J3BhZ2VfbnVtJzogMVxyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaGFuZGxlX2Jvb2tlZF9iYXJfY2xpY2soICRwYWdlLCBldmVudCApIHtcclxuXHRcdHZhciAkYmFyID0gJCggZXZlbnQuY3VycmVudFRhcmdldCApO1xyXG5cdFx0dmFyICRsaW5rID0gJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJy53cGJjX3RzX2Jvb2tpbmdfbGluaycgKTtcclxuXHRcdHZhciBib29raW5nSWQgPSAkYmFyLmF0dHIoICdkYXRhLXdwYmMtdHMtYm9va2luZy1pZCcgKSB8fCAkbGluay5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnICk7XHJcblx0XHR2YXIgYm9va2luZ1VybCA9ICRiYXIuYXR0ciggJ2RhdGEtd3BiYy10cy1ib29raW5nLXVybCcgKSB8fCAkbGluay5hdHRyKCAnaHJlZicgKTtcclxuXHJcblx0XHRpZiAoICEgYm9va2luZ0lkICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc19ib29raW5nX2xpc3Rpbmdfc2VhcmNoX2F2YWlsYWJsZSgpICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0c2VhcmNoX2Jvb2tpbmdfaW5fY3VycmVudF9saXN0aW5nKCAkcGFnZSwgYm9va2luZ0lkICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJGxpbmsubGVuZ3RoICYmIGJvb2tpbmdVcmwgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gYm9va2luZ1VybDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHVuaXF1ZV9kYXRlc19mcm9tX3NlbGVjdGlvbnMoICRwYWdlICkge1xyXG5cdFx0dmFyIGRhdGVzID0ge307XHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdHZhciBsYWJlbCA9IHJvd19sYWJlbCggJHBhZ2UsIHJvd0lkICk7XHJcblx0XHRcdFx0aWYgKCBsYWJlbCApIHtcclxuXHRcdFx0XHRcdGRhdGVzWyBsYWJlbCBdID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHRcdHJldHVybiBPYmplY3Qua2V5cyggZGF0ZXMgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9zZWxlY3Rpb25fcGF5bG9hZCggJHBhZ2UgKSB7XHJcblx0XHR2YXIgcGF5bG9hZCA9IFtdO1xyXG5cclxuXHRcdCQuZWFjaCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHQkLmVhY2goIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJbmRleCwgcm93SWQgKSB7XHJcblx0XHRcdFx0dmFyICRyb3cgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgcm93SWQgKyAnXCJdJyApO1xyXG5cdFx0XHRcdHZhciBkYXRlID0gJHJvdy5hdHRyKCAnZGF0YS13cGJjLXRzLWRhdGUnICk7XHJcblxyXG5cdFx0XHRcdGlmICggISBkYXRlICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0cGF5bG9hZC5wdXNoKCB7XHJcblx0XHRcdFx0XHRkYXRlOiBkYXRlLFxyXG5cdFx0XHRcdFx0c3RhcnRfc2Vjb25kOiBpdGVtLnN0YXJ0ICogNjAsXHJcblx0XHRcdFx0XHRlbmRfc2Vjb25kOiBpdGVtLmVuZCAqIDYwXHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cGF5bG9hZC5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKSB7XHJcblx0XHRcdGlmICggYS5kYXRlICE9PSBiLmRhdGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuZGF0ZSA8IGIuZGF0ZSA/IC0xIDogMTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGEuc3RhcnRfc2Vjb25kICE9PSBiLnN0YXJ0X3NlY29uZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5zdGFydF9zZWNvbmQgLSBiLnN0YXJ0X3NlY29uZDtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gYS5lbmRfc2Vjb25kIC0gYi5lbmRfc2Vjb25kO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHJldHVybiBwYXlsb2FkO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2FjdGl2ZV9ib29raW5nX3NlbGVjdGlvbl9jb250ZXh0KCAkcGFnZSApIHtcclxuXHRcdHZhciBpdGVtID0gYWN0aXZlU2VsZWN0aW9uSWQgPyBnZXRfc2VsZWN0aW9uX2J5X2lkKCBhY3RpdmVTZWxlY3Rpb25JZCApIDogbnVsbDtcclxuXHRcdHZhciAkcm93O1xyXG5cdFx0dmFyIGRhdGU7XHJcblxyXG5cdFx0aWYgKCAhIGl0ZW0gJiYgMSA9PT0gc2VsZWN0aW9uUmFuZ2VzLmxlbmd0aCApIHtcclxuXHRcdFx0aXRlbSA9IHNlbGVjdGlvblJhbmdlc1swXTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgaXRlbSB8fCAhIGl0ZW0ucm93cyB8fCAxICE9PSBpdGVtLnJvd3MubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHQkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIGl0ZW0ucm93c1swXSArICdcIl0nICk7XHJcblx0XHRkYXRlID0gJHJvdy5hdHRyKCAnZGF0YS13cGJjLXRzLWRhdGUnICk7XHJcblxyXG5cdFx0aWYgKCAhIGRhdGUgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHJlc291cmNlX2lkOiBnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoKSB8fCAnJyxcclxuXHRcdFx0c2VsZWN0ZWRfZGF0ZTogZGF0ZSxcclxuXHRcdFx0c2VsZWN0ZWRfdGltZTogbWludXRlc190b190aW1lKCBpdGVtLnN0YXJ0ICkgKyAnIC0gJyArIG1pbnV0ZXNfdG9fdGltZSggaXRlbS5lbmQgKSxcclxuXHRcdFx0c3RhcnRfc2Vjb25kOiBpdGVtLnN0YXJ0ICogNjAsXHJcblx0XHRcdGVuZF9zZWNvbmQ6IGl0ZW0uZW5kICogNjBcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjcmVhdGVfYm9va2luZ19mcm9tX2FjdGl2ZV9zZWxlY3Rpb24oICRwYWdlICkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gd2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIHx8IHt9O1xyXG5cdFx0dmFyIGxhYmVscyA9IHNldHRpbmdzLmkxOG4gfHwge307XHJcblx0XHR2YXIgY29udGV4dCA9IGdldF9hY3RpdmVfYm9va2luZ19zZWxlY3Rpb25fY29udGV4dCggJHBhZ2UgKTtcclxuXHRcdHZhciBib29raW5nRm9ybTtcclxuXHJcblx0XHRpZiAoICEgY29udGV4dCApIHtcclxuXHRcdFx0aWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zZWxlY3Rfb25lX3Nsb3RfZm9yX2Jvb2tpbmcgfHwgJ1NlbGVjdCBvbmUgdGltZSByYW5nZSBvbiBvbmUgZGF0ZSBmaXJzdC4nLCAnd2FybmluZycsIDM1MDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2Ygd2luZG93LndwYmNfYm9vX2xpc3RpbmdfX2NsaWNrX19hZGRfYm9va2luZ19tb2RhbCApIHtcclxuXHRcdFx0aWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5hZGRfYm9va2luZ19tb2RhbF9taXNzaW5nIHx8ICdBZGQgQm9va2luZyBwb3B1cCBpcyBub3QgYXZhaWxhYmxlIG9uIHRoaXMgcGFnZS4nLCAnd2FybmluZycsIDUwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Ym9va2luZ0Zvcm0gPSAkKCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19ib29raW5nX2Zvcm0nICkudmFsKCkgfHwgJyc7XHJcblxyXG5cdFx0Y2xvc2VfdGltZV9zbG90c19wb3B1cCggJHBhZ2UgKTtcclxuXHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHdpbmRvdy53cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwoIHtcclxuXHRcdFx0XHRtb2RlOiAnYWRkJyxcclxuXHRcdFx0XHRyZXNvdXJjZV9pZDogY29udGV4dC5yZXNvdXJjZV9pZCxcclxuXHRcdFx0XHRib29raW5nX2Zvcm06IGJvb2tpbmdGb3JtLFxyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGU6IGNvbnRleHQuc2VsZWN0ZWRfZGF0ZSxcclxuXHRcdFx0XHRzZWxlY3RlZF90aW1lOiBjb250ZXh0LnNlbGVjdGVkX3RpbWVcclxuXHRcdFx0fSApO1xyXG5cdFx0fSwgMTUwICk7XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbG9uZV9kYXRlKCBkYXRlICkge1xyXG5cdFx0cmV0dXJuIG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGFkZF9kYXlzKCBkYXRlLCBkYXlzICkge1xyXG5cdFx0dmFyIG5leHQgPSBjbG9uZV9kYXRlKCBkYXRlICk7XHJcblx0XHRuZXh0LnNldERhdGUoIG5leHQuZ2V0RGF0ZSgpICsgZGF5cyApO1xyXG5cdFx0cmV0dXJuIG5leHQ7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmb3JtYXRfaXNvX2RhdGUoIGRhdGUgKSB7XHJcblx0XHRyZXR1cm4gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nICsgcGFkXzIoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJyArIHBhZF8yKCBkYXRlLmdldERhdGUoKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZm9ybWF0X3Jvd19kYXRlKCBkYXRlICkge1xyXG5cdFx0dmFyIGRheXMgPSBbICdTdW4nLCAnTW9uJywgJ1R1ZScsICdXZWQnLCAnVGh1JywgJ0ZyaScsICdTYXQnIF07XHJcblx0XHR2YXIgbW9udGhzID0gWyAnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLCAnT2N0JywgJ05vdicsICdEZWMnIF07XHJcblx0XHRyZXR1cm4gZGF5c1sgZGF0ZS5nZXREYXkoKSBdICsgJyAnICsgbW9udGhzWyBkYXRlLmdldE1vbnRoKCkgXSArICcgJyArIGRhdGUuZ2V0RGF0ZSgpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZm9ybWF0X2RhdGVfcmFuZ2VfZGlzcGxheSggc3RhcnREYXRlLCBlbmREYXRlICkge1xyXG5cdFx0cmV0dXJuICQuZGF0ZXBpY2suZm9ybWF0RGF0ZSggJ00gZCwgeXknLCBzdGFydERhdGUgKSArICcgLSAnICsgJC5kYXRlcGljay5mb3JtYXREYXRlKCAnTSBkLCB5eScsIGVuZERhdGUgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNhY2hlX3Jvd190ZW1wbGF0ZXMoICRwYWdlICkge1xyXG5cdFx0aWYgKCByb3dUZW1wbGF0ZXMubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRyb3dUZW1wbGF0ZXMgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93JyApLmNsb25lKCBmYWxzZSApLnRvQXJyYXkoKTtcclxuXHRcdCQuZWFjaCggcm93VGVtcGxhdGVzLCBmdW5jdGlvbiAoIGluZGV4LCByb3cgKSB7XHJcblx0XHRcdCQoIHJvdyApLmZpbmQoICcud3BiY190c19zZWxlY3Rpb246bm90KC53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZSknICkucmVtb3ZlKCk7XHJcblx0XHRcdCQoIHJvdyApLmZpbmQoICcud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUnICkucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlIGlzLWFjdGl2ZScgKS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVuc3VyZV9yb3dfY291bnQoICRwYWdlLCBjb3VudCApIHtcclxuXHRcdHZhciAkcm93c1dyYXAgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93cycgKTtcclxuXHRcdHZhciAkcm93cyA9ICRyb3dzV3JhcC5maW5kKCAnLndwYmNfdHNfcm93JyApO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgJGNsb25lO1xyXG5cclxuXHRcdGNvdW50ID0gTWF0aC5tYXgoIDEsIGNvdW50ICk7XHJcblx0XHRjYWNoZV9yb3dfdGVtcGxhdGVzKCAkcGFnZSApO1xyXG5cclxuXHRcdGlmICggJHJvd3MubGVuZ3RoID4gY291bnQgKSB7XHJcblx0XHRcdCRyb3dzLnNsaWNlKCBjb3VudCApLnJlbW92ZSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIGkgPSAkcm93c1dyYXAuZmluZCggJy53cGJjX3RzX3JvdycgKS5sZW5ndGg7IGkgPCBjb3VudDsgaSsrICkge1xyXG5cdFx0XHQkY2xvbmUgPSAkKCByb3dUZW1wbGF0ZXNbIGkgJSByb3dUZW1wbGF0ZXMubGVuZ3RoIF0gKS5jbG9uZSggZmFsc2UgKTtcclxuXHRcdFx0JGNsb25lLmZpbmQoICcud3BiY190c19zZWxlY3Rpb246bm90KC53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZSknICkucmVtb3ZlKCk7XHJcblx0XHRcdCRjbG9uZS5maW5kKCAnLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlJyApLnJlbW92ZUNsYXNzKCAnaXMtdmlzaWJsZSBpcy1hY3RpdmUnICkuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICk7XHJcblx0XHRcdCRyb3dzV3JhcC5hcHBlbmQoICRjbG9uZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRyb3dzV3JhcC5maW5kKCAnLndwYmNfdHNfcm93JyApLmVhY2goIGZ1bmN0aW9uICggaW5kZXggKSB7XHJcblx0XHRcdCQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXJvdycsIFN0cmluZyggaW5kZXggKSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3Jvd3NfZm9yX2RhdGVfcmFuZ2UoICRwYWdlLCBzdGFydERhdGUsIGVuZERhdGUgKSB7XHJcblx0XHR2YXIgZGF5TXMgPSAyNCAqIDYwICogNjAgKiAxMDAwO1xyXG5cdFx0dmFyIGRheXNDb3VudCA9IE1hdGgucm91bmQoICggY2xvbmVfZGF0ZSggZW5kRGF0ZSApLmdldFRpbWUoKSAtIGNsb25lX2RhdGUoIHN0YXJ0RGF0ZSApLmdldFRpbWUoKSApIC8gZGF5TXMgKSArIDE7XHJcblxyXG5cdFx0ZGF5c0NvdW50ID0gTWF0aC5tYXgoIDEsIGRheXNDb3VudCApO1xyXG5cdFx0ZW5zdXJlX3Jvd19jb3VudCggJHBhZ2UsIGRheXNDb3VudCApO1xyXG5cclxuXHRcdCRwYWdlLmZpbmQoICcud3BiY190c19yb3cnICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApIHtcclxuXHRcdFx0dmFyIHJvd0RhdGUgPSBhZGRfZGF5cyggc3RhcnREYXRlLCBpbmRleCApO1xyXG5cdFx0XHQkKCB0aGlzIClcclxuXHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1kYXRlJywgZm9ybWF0X2lzb19kYXRlKCByb3dEYXRlICkgKVxyXG5cdFx0XHRcdC5maW5kKCAnLndwYmNfdHNfcm93X2xhYmVsX3RleHQnICkudGV4dCggZm9ybWF0X3Jvd19kYXRlKCByb3dEYXRlICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRzZWxlY3Rpb25SYW5nZXMgPSAkLmdyZXAoIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpdGVtICkge1xyXG5cdFx0XHRpdGVtLnJvd3MgPSAkLmdyZXAoIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXScgKS5sZW5ndGggPiAwO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdHJldHVybiBpdGVtLnJvd3MubGVuZ3RoID4gMDtcclxuXHRcdH0gKTtcclxuXHRcdGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBhY3RpdmVTZWxlY3Rpb25JZCApO1xyXG5cclxuXHRcdHBvc2l0aW9uX2JhcnMoICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHRcdHN5bmNfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uKCBzdHJpbmdEYXRlcywganNEYXRlc0FyciApIHtcclxuXHRcdHZhciBkYXRlcyA9IFtdO1xyXG5cdFx0dmFyIHBhcnRzO1xyXG5cdFx0dmFyIHN0YXJ0O1xyXG5cdFx0dmFyIGVuZDtcclxuXHJcblx0XHRpZiAoIGpzRGF0ZXNBcnIgJiYgJC5pc0FycmF5KCBqc0RhdGVzQXJyLnJhbmdlICkgKSB7XHJcblx0XHRcdGRhdGVzID0ganNEYXRlc0Fyci5yYW5nZTtcclxuXHRcdH0gZWxzZSBpZiAoIGpzRGF0ZXNBcnIgJiYgJC5pc0FycmF5KCBqc0RhdGVzQXJyLm11bHRpcGxlICkgKSB7XHJcblx0XHRcdGRhdGVzID0ganNEYXRlc0Fyci5tdWx0aXBsZTtcclxuXHRcdH0gZWxzZSBpZiAoICQuaXNBcnJheSgganNEYXRlc0FyciApICkge1xyXG5cdFx0XHRkYXRlcyA9IGpzRGF0ZXNBcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF0ZXMgPSAkLmdyZXAoIGRhdGVzLCBmdW5jdGlvbiAoIGRhdGUgKSB7XHJcblx0XHRcdHJldHVybiBkYXRlIGluc3RhbmNlb2YgRGF0ZSAmJiAhIGlzTmFOKCBkYXRlLmdldFRpbWUoKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGlmICggZGF0ZXMubGVuZ3RoICkge1xyXG5cdFx0XHRkYXRlcy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGNsb25lX2RhdGUoIGEgKS5nZXRUaW1lKCkgLSBjbG9uZV9kYXRlKCBiICkuZ2V0VGltZSgpO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHN0YXJ0OiBjbG9uZV9kYXRlKCBkYXRlc1swXSApLFxyXG5cdFx0XHRcdGVuZDogY2xvbmVfZGF0ZSggZGF0ZXNbIGRhdGVzLmxlbmd0aCAtIDEgXSApXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0cGFydHMgPSBTdHJpbmcoIHN0cmluZ0RhdGVzIHx8ICcnICkuc3BsaXQoICcgLSAnICk7XHJcblx0XHRzdGFydCA9IHBhcnNlX2RhdGVfdGV4dCggcGFydHNbMF0gKTtcclxuXHRcdGVuZCA9IHBhcnNlX2RhdGVfdGV4dCggcGFydHNbMV0gfHwgcGFydHNbMF0gKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0ICYmIGVuZCApIHtcclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRzdGFydDogc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBlbmRcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9kYXRlcGlja19zZWxlY3RlZF9yYW5nZSggJGRhdGUgKSB7XHJcblx0XHR2YXIgaW5zdDtcclxuXHJcblx0XHRpZiAoICEgJC5kYXRlcGljayB8fCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgJC5kYXRlcGljay5fZ2V0SW5zdCB8fCAhICRkYXRlLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5zdCA9ICQuZGF0ZXBpY2suX2dldEluc3QoICRkYXRlWzBdICk7XHJcblx0XHRpZiAoICEgaW5zdCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBhcnNlX2RhdGVwaWNrX3NlbGVjdGlvbiggJGRhdGUudmFsKCksICQuZGF0ZXBpY2suX2dldERhdGUoIGluc3QgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCByYW5nZSwgb3B0aW9ucyApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgc3RhcnREYXRlO1xyXG5cdFx0dmFyIGVuZERhdGU7XHJcblx0XHR2YXIgc3RhcnRJc287XHJcblx0XHR2YXIgZW5kSXNvO1xyXG5cdFx0dmFyIGN1cnJlbnRLZXk7XHJcblx0XHR2YXIgbmV4dEtleTtcclxuXHJcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHJcblx0XHRpZiAoICEgcmFuZ2UgfHwgISByYW5nZS5zdGFydCB8fCAhIHJhbmdlLmVuZCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXJ0RGF0ZSA9IGNsb25lX2RhdGUoIHJhbmdlLnN0YXJ0ICk7XHJcblx0XHRlbmREYXRlID0gY2xvbmVfZGF0ZSggcmFuZ2UuZW5kICk7XHJcblxyXG5cdFx0aWYgKCBzdGFydERhdGUuZ2V0VGltZSgpID4gZW5kRGF0ZS5nZXRUaW1lKCkgKSB7XHJcblx0XHRcdHJhbmdlID0gc3RhcnREYXRlO1xyXG5cdFx0XHRzdGFydERhdGUgPSBlbmREYXRlO1xyXG5cdFx0XHRlbmREYXRlID0gcmFuZ2U7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhcnRJc28gPSBmb3JtYXRfaXNvX2RhdGUoIHN0YXJ0RGF0ZSApO1xyXG5cdFx0ZW5kSXNvID0gZm9ybWF0X2lzb19kYXRlKCBlbmREYXRlICk7XHJcblx0XHRjdXJyZW50S2V5ID0gJGRhdGUuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcgKSArICc6JyArICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApO1xyXG5cdFx0bmV4dEtleSA9IHN0YXJ0SXNvICsgJzonICsgZW5kSXNvO1xyXG5cclxuXHRcdGlmICggY3VycmVudEtleSA9PT0gbmV4dEtleSApIHtcclxuXHRcdFx0JGRhdGUudmFsKCBmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5KCBzdGFydERhdGUsIGVuZERhdGUgKSApO1xyXG5cdFx0XHRpZiAoIG9wdGlvbnMuZm9yY2VfcmVsb2FkICkge1xyXG5cdFx0XHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRkYXRlXHJcblx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0Jywgc3RhcnRJc28gKVxyXG5cdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnLCBlbmRJc28gKVxyXG5cdFx0XHQudmFsKCBmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5KCBzdGFydERhdGUsIGVuZERhdGUgKSApO1xyXG5cclxuXHRcdHVwZGF0ZV9yb3dzX2Zvcl9kYXRlX3JhbmdlKCAkcGFnZSwgc3RhcnREYXRlLCBlbmREYXRlICk7XHJcblx0XHRsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApO1xyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19kYXRlX3JhbmdlX2Zyb21faW5wdXQoICRwYWdlICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciByYW5nZSA9IGdldF9kYXRlcGlja19zZWxlY3RlZF9yYW5nZSggJGRhdGUgKSB8fCBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oICRkYXRlLnZhbCgpLCBudWxsICk7XHJcblxyXG5cdFx0YXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCByYW5nZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2RhdGVfcmFuZ2VfZnJvbV9kYXRhX2F0dHJzKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgc3RhcnREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApICk7XHJcblx0XHR2YXIgZW5kRGF0ZSA9IHBhcnNlX2RhdGVfdGV4dCggJGRhdGUuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICkgKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0RGF0ZSAmJiBlbmREYXRlICkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHN0YXJ0OiBzdGFydERhdGUsXHJcblx0XHRcdFx0ZW5kOiBlbmREYXRlXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfY3VycmVudF9kYXRlX3JhbmdlKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgcmFuZ2UgPSBnZXRfZGF0ZV9yYW5nZV9mcm9tX2RhdGFfYXR0cnMoICRwYWdlICkgfHwgcGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uKCAkZGF0ZS52YWwoKSwgbnVsbCApO1xyXG5cclxuXHRcdGlmICggcmFuZ2UgKSB7XHJcblx0XHRcdHJldHVybiByYW5nZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdGFydDogcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApICksXHJcblx0XHRcdGVuZDogcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcgKSApXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2hpZnRfZGF0ZV9yYW5nZSggJHBhZ2UsIGRpcmVjdGlvbiApIHtcclxuXHRcdHZhciByYW5nZSA9IGdldF9jdXJyZW50X2RhdGVfcmFuZ2UoICRwYWdlICk7XHJcblx0XHR2YXIgZGF5TXMgPSAyNCAqIDYwICogNjAgKiAxMDAwO1xyXG5cdFx0dmFyIGRheXNDb3VudDtcclxuXHRcdHZhciBzaGlmdDtcclxuXHJcblx0XHRpZiAoICEgcmFuZ2UgfHwgISByYW5nZS5zdGFydCB8fCAhIHJhbmdlLmVuZCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGRheXNDb3VudCA9IE1hdGgucm91bmQoICggY2xvbmVfZGF0ZSggcmFuZ2UuZW5kICkuZ2V0VGltZSgpIC0gY2xvbmVfZGF0ZSggcmFuZ2Uuc3RhcnQgKS5nZXRUaW1lKCkgKSAvIGRheU1zICkgKyAxO1xyXG5cdFx0c2hpZnQgPSBNYXRoLm1heCggMSwgZGF5c0NvdW50ICkgKiAoICdwcmV2JyA9PT0gZGlyZWN0aW9uID8gLTEgOiAxICk7XHJcblxyXG5cdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0cmV0dXJuIGFwcGx5X2RhdGVfcmFuZ2Vfc2VsZWN0aW9uKCAkcGFnZSwge1xyXG5cdFx0XHRzdGFydDogYWRkX2RheXMoIHJhbmdlLnN0YXJ0LCBzaGlmdCApLFxyXG5cdFx0XHRlbmQ6IGFkZF9kYXlzKCByYW5nZS5lbmQsIHNoaWZ0IClcclxuXHRcdH0sIHtcclxuXHRcdFx0Zm9yY2VfcmVsb2FkOiB0cnVlXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwYXJzZV9kYXRlX3RleHQoIHRleHQgKSB7XHJcblx0XHR2YXIgcGFyc2VkO1xyXG5cdFx0dmFyIHNxbE1hdGNoO1xyXG5cclxuXHRcdHRleHQgPSAkLnRyaW0oIHRleHQgfHwgJycgKTtcclxuXHRcdGlmICggISB0ZXh0ICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRzcWxNYXRjaCA9IHRleHQubWF0Y2goIC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkvICk7XHJcblx0XHRpZiAoIHNxbE1hdGNoICkge1xyXG5cdFx0XHRyZXR1cm4gbmV3IERhdGUoIHBhcnNlSW50KCBzcWxNYXRjaFsxXSwgMTAgKSwgcGFyc2VJbnQoIHNxbE1hdGNoWzJdLCAxMCApIC0gMSwgcGFyc2VJbnQoIHNxbE1hdGNoWzNdLCAxMCApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAkLmRhdGVwaWNrICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiAkLmRhdGVwaWNrLnBhcnNlRGF0ZSApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRwYXJzZWQgPSAkLmRhdGVwaWNrLnBhcnNlRGF0ZSggJ00gZCwgeXknLCB0ZXh0ICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHtcclxuXHRcdFx0XHRwYXJzZWQgPSBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIHBhcnNlZCApIHtcclxuXHRcdFx0cGFyc2VkID0gbmV3IERhdGUoIHRleHQgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcGFyc2VkIGluc3RhbmNlb2YgRGF0ZSAmJiAhIGlzTmFOKCBwYXJzZWQuZ2V0VGltZSgpICkgPyBjbG9uZV9kYXRlKCBwYXJzZWQgKSA6IG51bGw7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfdGltZV9zbG90c19jb250ZXh0KCBjb250ZXh0LCBvcHRpb25zICkge1xyXG5cdFx0dmFyICRjb250ZXh0ID0gY29udGV4dCA/ICQoIGNvbnRleHQgKSA6ICQoIGRvY3VtZW50ICk7XHJcblx0XHR2YXIgJHBhZ2UgPSAkY29udGV4dC5pcyggJy53cGJjX3RzX3BhZ2UnICkgPyAkY29udGV4dCA6ICRjb250ZXh0LmZpbmQoICcud3BiY190c19wYWdlJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgc3RhcnREYXRlO1xyXG5cdFx0dmFyIGVuZERhdGU7XHJcblx0XHR2YXIgcmVzb3VyY2VDaGFuZ2VkID0gZmFsc2U7XHJcblx0XHR2YXIgcmFuZ2VDaGFuZ2VkID0gZmFsc2U7XHJcblxyXG5cdFx0b3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcblxyXG5cdFx0aWYgKCAhICRwYWdlLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGluaXRfdGltZV9zbG90c19wYWdlKCAkcGFnZSwgdHJ1ZSApO1xyXG5cclxuXHRcdGlmICggb3B0aW9ucy5yZXNvdXJjZV9pZCApIHtcclxuXHRcdFx0cmVzb3VyY2VDaGFuZ2VkID0gU3RyaW5nKCBnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoKSApICE9PSBTdHJpbmcoIG9wdGlvbnMucmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAncmVzb3VyY2UnICkudmFsKCBTdHJpbmcoIG9wdGlvbnMucmVzb3VyY2VfaWQgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXJ0RGF0ZSA9IHBhcnNlX2RhdGVfdGV4dCggb3B0aW9ucy5kYXRlX3N0YXJ0ICk7XHJcblx0XHRlbmREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCBvcHRpb25zLmRhdGVfZW5kICkgfHwgc3RhcnREYXRlO1xyXG5cclxuXHRcdGlmICggc3RhcnREYXRlICYmIGVuZERhdGUgKSB7XHJcblx0XHRcdGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdFx0cmFuZ2VDaGFuZ2VkID0gYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCB7XHJcblx0XHRcdFx0c3RhcnQ6IHN0YXJ0RGF0ZSxcclxuXHRcdFx0XHRlbmQ6IGVuZERhdGVcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggcmVzb3VyY2VDaGFuZ2VkICYmIHJhbmdlQ2hhbmdlZCApIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCByZXNvdXJjZUNoYW5nZWQgfHwgISByYW5nZUNoYW5nZWQgKSB7XHJcblx0XHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByb3dfZnJvbV9wb2ludGVyKCAkcGFnZSwgZXZlbnQgKSB7XHJcblx0XHR2YXIgb3JpZ2luYWwgPSBldmVudC5vcmlnaW5hbEV2ZW50IHx8IGV2ZW50O1xyXG5cdFx0dmFyIHBvaW50ID0gb3JpZ2luYWwudG91Y2hlcyAmJiBvcmlnaW5hbC50b3VjaGVzLmxlbmd0aCA/IG9yaWdpbmFsLnRvdWNoZXNbMF0gOiBvcmlnaW5hbDtcclxuXHRcdHZhciBlbCA9IGRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoIHBvaW50LmNsaWVudFgsIHBvaW50LmNsaWVudFkgKTtcclxuXHRcdHZhciAkcm93ID0gJCggZWwgKS5jbG9zZXN0KCAnLndwYmNfdHNfcm93JyApO1xyXG5cclxuXHRcdGlmICggISAkcm93Lmxlbmd0aCB8fCAhICQuY29udGFpbnMoICRwYWdlWzBdLCAkcm93WzBdICkgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAkcm93LmF0dHIoICdkYXRhLXdwYmMtdHMtcm93JyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbWludXRlX2Zyb21fcG9pbnRlciggZXZlbnQsICRsYW5lICkge1xyXG5cdFx0dmFyIG9yaWdpbmFsID0gZXZlbnQub3JpZ2luYWxFdmVudCB8fCBldmVudDtcclxuXHRcdHZhciBwb2ludCA9IG9yaWdpbmFsLnRvdWNoZXMgJiYgb3JpZ2luYWwudG91Y2hlcy5sZW5ndGggPyBvcmlnaW5hbC50b3VjaGVzWzBdIDogb3JpZ2luYWw7XHJcblx0XHR2YXIgJGdyaWQgPSAkbGFuZS5jbG9zZXN0KCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblx0XHR2YXIgcmVjdCA9ICRsYW5lWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0dmFyIHJhdGlvID0gKCBwb2ludC5jbGllbnRYIC0gcmVjdC5sZWZ0ICkgLyByZWN0LndpZHRoO1xyXG5cdFx0dmFyIG1pbnV0ZSA9IGNvbmZpZy5zdGFydCArIHJhdGlvICogKCBjb25maWcuZW5kIC0gY29uZmlnLnN0YXJ0ICk7XHJcblxyXG5cdFx0cmV0dXJuIGNsYW1wKCBzbmFwX21pbnV0ZSggbWludXRlLCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNyZWF0ZV9zZWxlY3Rpb24oICRwYWdlLCByb3dzLCBzdGFydCwgZW5kICkge1xyXG5cdFx0dmFyICRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblx0XHR2YXIgY29uZmlnID0gZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApO1xyXG5cdFx0dmFyIHJhbmdlID0gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggc3RhcnQsIGVuZCwgY29uZmlnICk7XHJcblx0XHR2YXIgaXRlbSA9IHtcclxuXHRcdFx0aWQ6ICdzZWxlY3Rpb25fJyArIG5leHRTZWxlY3Rpb25JZCsrLFxyXG5cdFx0XHRzdGFydDogcmFuZ2Uuc3RhcnQsXHJcblx0XHRcdGVuZDogcmFuZ2UuZW5kLFxyXG5cdFx0XHRyb3dzOiByb3dzLnNsaWNlKCAwIClcclxuXHRcdH07XHJcblxyXG5cdFx0c2VsZWN0aW9uUmFuZ2VzLnB1c2goIGl0ZW0gKTtcclxuXHRcdGFjdGl2ZVNlbGVjdGlvbklkID0gaXRlbS5pZDtcclxuXHRcdGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBpdGVtLmlkICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHRcdHJldHVybiBnZXRfc2VsZWN0aW9uX2J5X2lkKCBhY3RpdmVTZWxlY3Rpb25JZCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3NlbGVjdGlvbiggJHBhZ2UsIHNlbGVjdGlvbklkLCByb3dzLCBzdGFydCwgZW5kICkge1xyXG5cdFx0dmFyICRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblx0XHR2YXIgY29uZmlnID0gZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApO1xyXG5cdFx0dmFyIHJhbmdlID0gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggc3RhcnQsIGVuZCwgY29uZmlnICk7XHJcblx0XHR2YXIgaXRlbSA9IGdldF9zZWxlY3Rpb25fYnlfaWQoIHNlbGVjdGlvbklkICk7XHJcblxyXG5cdFx0aWYgKCAhIGl0ZW0gKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpdGVtLnN0YXJ0ID0gcmFuZ2Uuc3RhcnQ7XHJcblx0XHRpdGVtLmVuZCA9IHJhbmdlLmVuZDtcclxuXHRcdGl0ZW0ucm93cyA9IHJvd3Muc2xpY2UoIDAgKTtcclxuXHRcdGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBzZWxlY3Rpb25JZCApO1xyXG5cdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjYW5vbmljYWxpemVfc2VsZWN0aW9ucyggcHJlZmVycmVkQWN0aXZlSWQgKSB7XHJcblx0XHR2YXIgaW50ZXJ2YWxzID0gW107XHJcblx0XHR2YXIgbWVyZ2VkID0gW107XHJcblx0XHR2YXIgZ3JvdXBzID0gW107XHJcblx0XHR2YXIgbmV3QWN0aXZlSWQgPSAnJztcclxuXHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdGludGVydmFscy5wdXNoKCB7XHJcblx0XHRcdFx0XHRyb3c6IHBhcnNlSW50KCByb3dJZCwgMTAgKSxcclxuXHRcdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRcdGFjdGl2ZTogaXRlbS5pZCA9PT0gcHJlZmVycmVkQWN0aXZlSWQgfHwgaXRlbS5pZCA9PT0gYWN0aXZlU2VsZWN0aW9uSWRcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRpbnRlcnZhbHMuc29ydCggZnVuY3Rpb24gKCBhLCBiICkge1xyXG5cdFx0XHRpZiAoIGEucm93ICE9PSBiLnJvdyApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5yb3cgLSBiLnJvdztcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGEuc3RhcnQgIT09IGIuc3RhcnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuc3RhcnQgLSBiLnN0YXJ0O1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhLmVuZCAtIGIuZW5kO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQuZWFjaCggaW50ZXJ2YWxzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHR2YXIgbGFzdCA9IG1lcmdlZFsgbWVyZ2VkLmxlbmd0aCAtIDEgXTtcclxuXHJcblx0XHRcdGlmICggbGFzdCAmJiBsYXN0LnJvdyA9PT0gaXRlbS5yb3cgJiYgaXRlbS5zdGFydCA8PSBsYXN0LmVuZCApIHtcclxuXHRcdFx0XHRsYXN0LmVuZCA9IE1hdGgubWF4KCBsYXN0LmVuZCwgaXRlbS5lbmQgKTtcclxuXHRcdFx0XHRsYXN0LmFjdGl2ZSA9IGxhc3QuYWN0aXZlIHx8IGl0ZW0uYWN0aXZlO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWVyZ2VkLnB1c2goIHtcclxuXHRcdFx0XHRyb3c6IGl0ZW0ucm93LFxyXG5cdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0YWN0aXZlOiBpdGVtLmFjdGl2ZVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0bWVyZ2VkLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApIHtcclxuXHRcdFx0aWYgKCBhLnN0YXJ0ICE9PSBiLnN0YXJ0ICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnN0YXJ0IC0gYi5zdGFydDtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGEuZW5kICE9PSBiLmVuZCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5lbmQgLSBiLmVuZDtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gYS5yb3cgLSBiLnJvdztcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkLmVhY2goIG1lcmdlZCwgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0dmFyIGxhc3QgPSBncm91cHNbIGdyb3Vwcy5sZW5ndGggLSAxIF07XHJcblxyXG5cdFx0XHRpZiAoIGxhc3QgJiYgbGFzdC5zdGFydCA9PT0gaXRlbS5zdGFydCAmJiBsYXN0LmVuZCA9PT0gaXRlbS5lbmQgJiYgbGFzdC5sYXN0Um93ICsgMSA9PT0gaXRlbS5yb3cgKSB7XHJcblx0XHRcdFx0bGFzdC5yb3dzLnB1c2goIFN0cmluZyggaXRlbS5yb3cgKSApO1xyXG5cdFx0XHRcdGxhc3QubGFzdFJvdyA9IGl0ZW0ucm93O1xyXG5cdFx0XHRcdGxhc3QuYWN0aXZlID0gbGFzdC5hY3RpdmUgfHwgaXRlbS5hY3RpdmU7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRncm91cHMucHVzaCgge1xyXG5cdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0cm93czogWyBTdHJpbmcoIGl0ZW0ucm93ICkgXSxcclxuXHRcdFx0XHRsYXN0Um93OiBpdGVtLnJvdyxcclxuXHRcdFx0XHRhY3RpdmU6IGl0ZW0uYWN0aXZlXHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRzZWxlY3Rpb25SYW5nZXMgPSAkLm1hcCggZ3JvdXBzLCBmdW5jdGlvbiAoIGl0ZW0gKSB7XHJcblx0XHRcdHZhciBpZCA9ICdzZWxlY3Rpb25fJyArIG5leHRTZWxlY3Rpb25JZCsrO1xyXG5cclxuXHRcdFx0aWYgKCBpdGVtLmFjdGl2ZSAmJiAhIG5ld0FjdGl2ZUlkICkge1xyXG5cdFx0XHRcdG5ld0FjdGl2ZUlkID0gaWQ7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0aWQ6IGlkLFxyXG5cdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0cm93czogaXRlbS5yb3dzXHJcblx0XHRcdH07XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSBuZXdBY3RpdmVJZCB8fCAoIHNlbGVjdGlvblJhbmdlc1swXSA/IHNlbGVjdGlvblJhbmdlc1swXS5pZCA6ICcnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5yZW1vdmUoKTtcclxuXHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0dmFyIHJhbmdlID0gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggaXRlbS5zdGFydCwgaXRlbS5lbmQsIGNvbmZpZyApO1xyXG5cdFx0XHR2YXIgbGVmdCA9IHBlcmNlbnRfZm9yX21pbnV0ZSggcmFuZ2Uuc3RhcnQsIGNvbmZpZyApO1xyXG5cdFx0XHR2YXIgd2lkdGggPSBwZXJjZW50X2Zvcl9taW51dGUoIHJhbmdlLmVuZCwgY29uZmlnICkgLSBsZWZ0O1xyXG5cclxuXHRcdFx0aXRlbS5zdGFydCA9IHJhbmdlLnN0YXJ0O1xyXG5cdFx0XHRpdGVtLmVuZCA9IHJhbmdlLmVuZDtcclxuXHJcblx0XHRcdCQuZWFjaCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0luZGV4LCByb3dJZCApIHtcclxuXHRcdFx0XHR2YXIgJHJvdyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyByb3dJZCArICdcIl0nICk7XHJcblx0XHRcdFx0dmFyICRsYW5lID0gJHJvdy5maW5kKCAnLndwYmNfdHNfbGFuZScgKTtcclxuXHRcdFx0XHR2YXIgJHRlbXBsYXRlID0gJGxhbmUuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZScgKS5maXJzdCgpO1xyXG5cdFx0XHRcdHZhciAkc2VsZWN0aW9uO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgJGxhbmUubGVuZ3RoIHx8ICEgJHRlbXBsYXRlLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdCRzZWxlY3Rpb24gPSAkdGVtcGxhdGUuY2xvbmUoIGZhbHNlIClcclxuXHRcdFx0XHRcdC5yZW1vdmVDbGFzcyggJ3dwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlJyApXHJcblx0XHRcdFx0XHQucmVtb3ZlQXR0ciggJ2hpZGRlbicgKVxyXG5cdFx0XHRcdFx0LmFkZENsYXNzKCAnaXMtdmlzaWJsZScgKVxyXG5cdFx0XHRcdFx0LnRvZ2dsZUNsYXNzKCAnaXMtYWN0aXZlJywgaXRlbS5pZCA9PT0gYWN0aXZlU2VsZWN0aW9uSWQgKVxyXG5cdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc2VsZWN0aW9uLWlkJywgaXRlbS5pZCApXHJcblx0XHRcdFx0XHQuY3NzKCB7IGxlZnQ6IGxlZnQgKyAnJScsIHdpZHRoOiB3aWR0aCArICclJyB9ICk7XHJcblxyXG5cdFx0XHRcdCRzZWxlY3Rpb24uZmluZCggJy53cGJjX3RzX3RpbWVfY2hpcF9zdGFydCcgKS50ZXh0KCBtaW51dGVzX3RvX3RpbWUoIHJhbmdlLnN0YXJ0ICkgKTtcclxuXHRcdFx0XHQkc2VsZWN0aW9uLmZpbmQoICcud3BiY190c190aW1lX2NoaXBfZW5kJyApLnRleHQoIG1pbnV0ZXNfdG9fdGltZSggcmFuZ2UuZW5kICkgKTtcclxuXHRcdFx0XHQkbGFuZS5hcHBlbmQoICRzZWxlY3Rpb24gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHVwZGF0ZV9zdW1tYXJ5KCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApIHtcclxuXHRcdHNlbGVjdGlvblJhbmdlcyA9IFtdO1xyXG5cdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSAnJztcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdXBkYXRlX3N1bW1hcnkoICRwYWdlICkge1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICkgKTtcclxuXHRcdHZhciBzbG90Q291bnQgPSAwO1xyXG5cdFx0dmFyIGRhdGVzID0ge307XHJcblx0XHR2YXIgZGF0ZXNDb3VudCA9IDA7XHJcblx0XHR2YXIgZGF0ZVRleHQgPSAnLSc7XHJcblx0XHR2YXIgdGltZVRleHQgPSAnLSc7XHJcblx0XHR2YXIgZGV0YWlscyA9IFtdO1xyXG5cdFx0dmFyIGRldGFpbHNIdG1sID0gJyc7XHJcblxyXG5cdFx0JC5lYWNoKCBzZWxlY3Rpb25SYW5nZXMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdHNsb3RDb3VudCArPSBNYXRoLm1heCggMCwgTWF0aC5yb3VuZCggKCBpdGVtLmVuZCAtIGl0ZW0uc3RhcnQgKSAvIGNvbmZpZy5zdGVwICkgKiBpdGVtLnJvd3MubGVuZ3RoICk7XHJcblxyXG5cdFx0XHQkLmVhY2goIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJbmRleCwgcm93SWQgKSB7XHJcblx0XHRcdFx0dmFyIGxhYmVsID0gcm93X2xhYmVsKCAkcGFnZSwgcm93SWQgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGxhYmVsICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZGF0ZXNbIGxhYmVsIF0gPSB0cnVlO1xyXG5cdFx0XHRcdGRldGFpbHMucHVzaCgge1xyXG5cdFx0XHRcdFx0cm93OiBwYXJzZUludCggcm93SWQsIDEwICksXHJcblx0XHRcdFx0XHRzdGFydDogaXRlbS5zdGFydCxcclxuXHRcdFx0XHRcdGVuZDogaXRlbS5lbmQsXHJcblx0XHRcdFx0XHRsYWJlbDogbGFiZWxcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRkZXRhaWxzLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApIHtcclxuXHRcdFx0aWYgKCBhLnJvdyAhPT0gYi5yb3cgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEucm93IC0gYi5yb3c7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBhLnN0YXJ0ICE9PSBiLnN0YXJ0ICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnN0YXJ0IC0gYi5zdGFydDtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gYS5lbmQgLSBiLmVuZDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkLmVhY2goIGRldGFpbHMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdHZhciB0aW1lTGFiZWwgPSBtaW51dGVzX3RvX3RpbWUoIGl0ZW0uc3RhcnQgKSArICcgLSAnICsgbWludXRlc190b190aW1lKCBpdGVtLmVuZCApO1xyXG5cclxuXHRcdFx0ZGV0YWlsc0h0bWwgKz0gJzxkaXYgY2xhc3M9XCJ3cGJjX3RzX3NlbGVjdGlvbl9kZXRhaWxfaXRlbVwiPidcclxuXHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfc2VsZWN0aW9uX2RldGFpbF9kYXRlXCI+JyArIGVzY2FwZV9odG1sKCBpdGVtLmxhYmVsICkgKyAnPC9zcGFuPidcclxuXHRcdFx0XHQrICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfc2VsZWN0aW9uX2RldGFpbF90aW1lXCI+JyArIGVzY2FwZV9odG1sKCB0aW1lTGFiZWwgKSArICc8L3NwYW4+J1xyXG5cdFx0XHRcdCsgJzwvZGl2Pic7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0ZGF0ZXNDb3VudCA9IE9iamVjdC5rZXlzKCBkYXRlcyApLmxlbmd0aDtcclxuXHJcblx0XHRpZiAoIHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKSB7XHJcblx0XHRcdGRhdGVUZXh0ID0gZGF0ZXNDb3VudCArICggMSA9PT0gZGF0ZXNDb3VudCA/ICcgZGF0ZScgOiAnIGRhdGVzJyApO1xyXG5cdFx0XHR0aW1lVGV4dCA9IHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKyAoIDEgPT09IHNlbGVjdGlvblJhbmdlcy5sZW5ndGggPyAnIGludGVydmFsJyA6ICcgaW50ZXJ2YWxzJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBkZXRhaWxzSHRtbCApIHtcclxuXHRcdFx0ZGV0YWlsc0h0bWwgPSAnPGRpdiBjbGFzcz1cIndwYmNfdHNfc2VsZWN0aW9uX2RldGFpbHNfZW1wdHlcIj5ObyB0aW1lIHNsb3RzIHNlbGVjdGVkLjwvZGl2Pic7XHJcblx0XHR9XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5maW5kKCAnW2RhdGEtd3BiYy10cy1kZXRhaWw9XCJzbG90c1wiXScgKS50ZXh0KCBzbG90Q291bnQgKTtcclxuXHRcdCQoIGRvY3VtZW50ICkuZmluZCggJ1tkYXRhLXdwYmMtdHMtZGV0YWlsPVwiZGF0ZXNcIl0nICkudGV4dCggZGF0ZVRleHQgKTtcclxuXHRcdCQoIGRvY3VtZW50ICkuZmluZCggJ1tkYXRhLXdwYmMtdHMtZGV0YWlsPVwidGltZVwiXScgKS50ZXh0KCB0aW1lVGV4dCApO1xyXG5cdFx0JCggZG9jdW1lbnQgKS5maW5kKCAnW2RhdGEtd3BiYy10cy1kZXRhaWw9XCJzZWxlY3Rpb25fbGlzdFwiXScgKS5odG1sKCBkZXRhaWxzSHRtbCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2hvd19saXZlX3RpcCggJHBhZ2UsIGV2ZW50ICkge1xyXG5cdFx0dmFyIG9yaWdpbmFsID0gZXZlbnQub3JpZ2luYWxFdmVudCB8fCBldmVudDtcclxuXHRcdHZhciBwb2ludCA9IG9yaWdpbmFsLnRvdWNoZXMgJiYgb3JpZ2luYWwudG91Y2hlcy5sZW5ndGggPyBvcmlnaW5hbC50b3VjaGVzWzBdIDogb3JpZ2luYWw7XHJcblx0XHR2YXIgJHRpcCA9ICRwYWdlLmZpbmQoICcud3BiY190c19saXZlX3RpcCcgKTtcclxuXHRcdHZhciBhY3RpdmUgPSBnZXRfc2VsZWN0aW9uX2J5X2lkKCBhY3RpdmVTZWxlY3Rpb25JZCApO1xyXG5cclxuXHRcdGlmICggISBhY3RpdmUgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJHRpcC5sZW5ndGggKSB7XHJcblx0XHRcdCR0aXAgPSAkKCAnPGRpdiBjbGFzcz1cIndwYmNfdHNfbGl2ZV90aXBcIj48L2Rpdj4nICkuYXBwZW5kVG8oICRwYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHRpcFxyXG5cdFx0XHQudGV4dCggbWludXRlc190b190aW1lKCBhY3RpdmUuc3RhcnQgKSArICcgLSAnICsgbWludXRlc190b190aW1lKCBhY3RpdmUuZW5kICkgKVxyXG5cdFx0XHQuY3NzKCB7XHJcblx0XHRcdFx0bGVmdDogcG9pbnQucGFnZVggKyAxMiArICdweCcsXHJcblx0XHRcdFx0dG9wOiBwb2ludC5wYWdlWSAtIDM4ICsgJ3B4J1xyXG5cdFx0XHR9IClcclxuXHRcdFx0LmFkZENsYXNzKCAnaXMtdmlzaWJsZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhpZGVfbGl2ZV90aXAoICRwYWdlICkge1xyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX2xpdmVfdGlwJyApLnJlbW92ZUNsYXNzKCAnaXMtdmlzaWJsZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHN5bmNfc2xvdF9zdGVwX2NvbnRyb2xzKCAkcGFnZSwgc3RlcCApIHtcclxuXHRcdGdldF9jb250cm9sKCAkcGFnZSwgJ3Nsb3Rfc3RlcCcgKS52YWwoIFN0cmluZyggc3RlcCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9zbG90X3N0ZXAnICkudmFsKCBTdHJpbmcoIHN0ZXAgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY196b29tX2NvbnRyb2xzKCAkcGFnZSwgc3RlcCApIHtcclxuXHRcdHZhciBpbmRleCA9IHpvb21TdGVwcy5pbmRleE9mKCBzdGVwICk7XHJcblx0XHRpZiAoIC0xID09PSBpbmRleCApIHtcclxuXHRcdFx0aW5kZXggPSAyO1xyXG5cdFx0fVxyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnem9vbScgKS52YWwoIFN0cmluZyggaW5kZXggKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfem9vbScgKS52YWwoIFN0cmluZyggaW5kZXggKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3N0ZXAoICRwYWdlLCBzdGVwICkge1xyXG5cdFx0dmFyICRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICk7XHJcblx0XHQkZ3JpZC5hdHRyKCAnZGF0YS13cGJjLXRzLXN0ZXAnLCBzdGVwICk7XHJcblx0XHRzeW5jX3Nsb3Rfc3RlcF9jb250cm9scyggJHBhZ2UsIHN0ZXAgKTtcclxuXHRcdHN5bmNfem9vbV9jb250cm9scyggJHBhZ2UsIHN0ZXAgKTtcclxuXHRcdHJlbmRlcl9heGlzKCAkZ3JpZCApO1xyXG5cdFx0cG9zaXRpb25fYmFycyggJGdyaWQgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY192aXNpYmxlX3RpbWVfY29udHJvbHMoICRwYWdlLCBzdGFydCwgZW5kICkge1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X3N0YXJ0JyApLnZhbCggU3RyaW5nKCBzdGFydCApICk7XHJcblx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfZW5kJyApLnZhbCggU3RyaW5nKCBlbmQgKSApO1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X3N0YXJ0X3NsaWRlcicgKS52YWwoIFN0cmluZyggc3RhcnQgKSApO1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X2VuZF9zbGlkZXInICkudmFsKCBTdHJpbmcoIGVuZCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9zdGFydCcgKS52YWwoIFN0cmluZyggc3RhcnQgKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfZW5kJyApLnZhbCggU3RyaW5nKCBlbmQgKSApO1xyXG5cdFx0JCggJyN3cGJjX3RzX3NpZGVfc3RhcnRfc2xpZGVyJyApLnZhbCggU3RyaW5nKCBzdGFydCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9lbmRfc2xpZGVyJyApLnZhbCggU3RyaW5nKCBlbmQgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3Zpc2libGVfdGltZV9yYW5nZSggJHBhZ2UsIHN0YXJ0LCBlbmQgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHJcblx0XHRzdGFydCA9IHBhcnNlSW50KCBzdGFydCwgMTAgKTtcclxuXHRcdGVuZCA9IHBhcnNlSW50KCBlbmQsIDEwICk7XHJcblxyXG5cdFx0aWYgKCBlbmQgPD0gc3RhcnQgKSB7XHJcblx0XHRcdGlmICggJCggZG9jdW1lbnQuYWN0aXZlRWxlbWVudCApLmlzKCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X3N0YXJ0XCJdLCBbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfc3RhcnRfc2xpZGVyXCJdLCAjd3BiY190c19kYXlfc3RhcnQsICN3cGJjX3RzX3NpZGVfc3RhcnQsICN3cGJjX3RzX2RheV9zdGFydF9zbGlkZXIsICN3cGJjX3RzX3NpZGVfc3RhcnRfc2xpZGVyJyApICkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gTWF0aC5tYXgoIDAsIGVuZCAtIDYwICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZW5kID0gTWF0aC5taW4oIDE0NDAsIHN0YXJ0ICsgNjAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdCRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnLCBzdGFydCApO1xyXG5cdFx0JGdyaWQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnLCBlbmQgKTtcclxuXHRcdHN5bmNfdmlzaWJsZV90aW1lX2NvbnRyb2xzKCAkcGFnZSwgc3RhcnQsIGVuZCApO1xyXG5cclxuXHRcdHJlbmRlcl9heGlzKCAkZ3JpZCApO1xyXG5cdFx0cG9zaXRpb25fYmFycyggJGdyaWQgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X21vZGUoIG1vZGUgKSB7XHJcblx0XHRjdXJyZW50TW9kZSA9IG1vZGU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19iYXJfc2VsZWN0YWJsZV9mb3JfdGltZV9hY3Rpb24oICRiYXIgKSB7XHJcblx0XHRpZiAoICEgJGJhci5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCRiYXIuaGFzQ2xhc3MoICd3cGJjX3RzX2Jhcl9ibG9ja2VkJyApXHJcblx0XHRcdCYmICcwJyAhPT0gJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLWVkaXRhYmxlJyApXHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcnVuX2NvbW1hbmQoICRwYWdlLCBtb2RlICkge1xyXG5cdFx0dmFyIHNldHRpbmdzID0gd2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlIHx8IHt9O1xyXG5cdFx0dmFyIGxhYmVscyA9IHNldHRpbmdzLmkxOG4gfHwge307XHJcblx0XHR2YXIgcGF5bG9hZDtcclxuXHJcblx0XHRpZiAoIGFjdGl2ZVNhdmVSZXF1ZXN0ICYmIGFjdGl2ZVNhdmVSZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRzZXRfbW9kZSggbW9kZSApO1xyXG5cdFx0aWYgKCAhIHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKSB7XHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuc2VsZWN0X3Nsb3RzX2ZpcnN0IHx8ICdTZWxlY3Qgb25lIG9yIG1vcmUgdGltZSByYW5nZXMgZmlyc3QuJywgJ3dhcm5pbmcnLCAzNTAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBheWxvYWQgPSBnZXRfc2VsZWN0aW9uX3BheWxvYWQoICRwYWdlICk7XHJcblx0XHRpZiAoICEgc2V0dGluZ3MuYWpheF91cmwgfHwgISBzZXR0aW5ncy5ub25jZSB8fCAhIHBheWxvYWQubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0c2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCB0cnVlLCBsYWJlbHMuc2F2aW5nIHx8ICdTYXZpbmcnICk7XHJcblx0XHRzZXRfYWN0aW9uX2J1dHRvbnNfYnVzeSggJHBhZ2UsIHRydWUgKTtcclxuXHJcblx0XHRhY3RpdmVTYXZlUmVxdWVzdCA9ICQucG9zdCggc2V0dGluZ3MuYWpheF91cmwsIHtcclxuXHRcdFx0YWN0aW9uOiAnV1BCQ19BSlhfQVZBSUxBQklMSVRZX1RJTUVTTE9UU19TQVZFJyxcclxuXHRcdFx0bm9uY2U6IHNldHRpbmdzLm5vbmNlLFxyXG5cdFx0XHRyZXNvdXJjZV9pZDogZ2V0X2NvbnRyb2woICRwYWdlLCAncmVzb3VyY2UnICkudmFsKCksXHJcblx0XHRcdG1vZGU6IG1vZGUsXHJcblx0XHRcdGludGVydmFsczogSlNPTi5zdHJpbmdpZnkoIHBheWxvYWQgKVxyXG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdGlmICggcmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3VjY2VzcyApIHtcclxuXHRcdFx0XHRpZiAoIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnYmxvY2snID09PSBtb2RlID8gKCBsYWJlbHMuYmxvY2tfc3VjY2VzcyB8fCAnU2VsZWN0ZWQgdGltZSByYW5nZXMgaGF2ZSBiZWVuIGJsb2NrZWQuJyApIDogKCBsYWJlbHMudW5ibG9ja19zdWNjZXNzIHx8ICdTZWxlY3RlZCB0aW1lIHJhbmdlcyBoYXZlIGJlZW4gdW5ibG9ja2VkLicgKSwgJ3N1Y2Nlc3MnLCA1MDAwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdFx0XHRsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zYXZlX2Vycm9yIHx8ICdVbmFibGUgdG8gc2F2ZSB0aW1lLXNsb3QgYXZhaWxhYmlsaXR5LicsICdlcnJvcicsIDUwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmZhaWwoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zYXZlX2Vycm9yIHx8ICdVbmFibGUgdG8gc2F2ZSB0aW1lLXNsb3QgYXZhaWxhYmlsaXR5LicsICdlcnJvcicsIDUwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRhY3RpdmVTYXZlUmVxdWVzdCA9IG51bGw7XHJcblx0XHRcdHNldF9hY3Rpb25fYnV0dG9uc19idXN5KCAkcGFnZSwgZmFsc2UgKTtcclxuXHJcblx0XHRcdGlmICggISBhY3RpdmVMb2FkUmVxdWVzdCB8fCBhY3RpdmVMb2FkUmVxdWVzdC5yZWFkeVN0YXRlID09PSA0ICkge1xyXG5cdFx0XHRcdHNldF90aW1lbGluZV9sb2FkaW5nKCAkcGFnZSwgZmFsc2UsIGxhYmVscy5sb2FkaW5nIHx8ICdMb2FkaW5nJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X2RhdGVfcmFuZ2VfcGlja2VyKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZGF0ZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgJGRhdGVXcmFwID0gJGRhdGUuY2xvc2VzdCggJy53cGJjX3RzX2lucHV0X2ljb24nICk7XHJcblx0XHR2YXIgZmlyc3REYXkgPSAwO1xyXG5cclxuXHRcdGlmICggISAkLmZuLmRhdGVwaWNrICkge1xyXG5cdFx0XHRpZiAoIHdpbmRvdy5jb25zb2xlICkge1xyXG5cdFx0XHRcdGNvbnNvbGUubG9nKCAnV1BCQyBFcnJvci4gSmF2YVNjcmlwdCBsaWJyYXJ5IFwiZGF0ZXBpY2tcIiB3YXMgbm90IGRlZmluZWQuJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHdpbmRvdy5fd3BiYyAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Ll93cGJjLmdldF9vdGhlcl9wYXJhbSApIHtcclxuXHRcdFx0Zmlyc3REYXkgPSBwYXJzZUludCggd2luZG93Ll93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2NhbGVuZGFyc19fZmlyc3RfZGF5JyApLCAxMCApIHx8IDA7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAkZGF0ZS5oYXNDbGFzcyggJC5kYXRlcGljay5tYXJrZXJDbGFzc05hbWUgKSApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQkZGF0ZS5kYXRlcGljayggJ2Rlc3Ryb3knICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlcnJvciApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0JGRhdGUuZGF0ZXBpY2soIHtcclxuXHRcdFx0YmVmb3JlU2hvd0RheTogZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHJldHVybiBbIHRydWUsICdkYXRlX2F2YWlsYWJsZScgXTtcclxuXHRcdFx0fSxcclxuXHRcdFx0b25TZWxlY3Q6IGZ1bmN0aW9uICggc3RyaW5nRGF0ZXMsIGpzRGF0ZXNBcnIgKSB7XHJcblx0XHRcdFx0YXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oIHN0cmluZ0RhdGVzLCBqc0RhdGVzQXJyICkgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0b25DbG9zZTogZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRzeW5jX2RhdGVfcmFuZ2VfZnJvbV9pbnB1dCggJHBhZ2UgKTtcclxuXHRcdFx0XHR9LCAwICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdHNob3dPbjogJ25vbmUnLFxyXG5cdFx0XHRzaG93QW5pbTogJ3Nob3cnLFxyXG5cdFx0XHRkdXJhdGlvbjogJycsXHJcblx0XHRcdHJhbmdlU2VsZWN0OiB0cnVlLFxyXG5cdFx0XHRtdWx0aVNlbGVjdDogMCxcclxuXHRcdFx0bnVtYmVyT2ZNb250aHM6IDEsXHJcblx0XHRcdHN0ZXBNb250aHM6IDEsXHJcblx0XHRcdHByZXZUZXh0OiAnJmxzYXF1bzsnLFxyXG5cdFx0XHRuZXh0VGV4dDogJyZyc2FxdW87JyxcclxuXHRcdFx0ZGF0ZUZvcm1hdDogJ00gZCwgeXknLFxyXG5cdFx0XHRjaGFuZ2VNb250aDogZmFsc2UsXHJcblx0XHRcdGNoYW5nZVllYXI6IGZhbHNlLFxyXG5cdFx0XHRtaW5EYXRlOiBudWxsLFxyXG5cdFx0XHRtYXhEYXRlOiBudWxsLFxyXG5cdFx0XHRzaG93U3RhdHVzOiBmYWxzZSxcclxuXHRcdFx0bXVsdGlTZXBhcmF0b3I6ICcsICcsXHJcblx0XHRcdGNsb3NlQXRUb3A6IG51bGwsXHJcblx0XHRcdGZpcnN0RGF5OiBmaXJzdERheSxcclxuXHRcdFx0Z290b0N1cnJlbnQ6IGZhbHNlLFxyXG5cdFx0XHRoaWRlSWZOb1ByZXZOZXh0OiB0cnVlLFxyXG5cdFx0XHR1c2VUaGVtZVJvbGxlcjogZmFsc2UsXHJcblx0XHRcdG1hbmRhdG9yeTogdHJ1ZVxyXG5cdFx0fSApO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHNob3dfZGF0ZV9yYW5nZV9waWNrZXIoKSB7XHJcblx0XHRcdHZhciBpbnB1dCA9ICRkYXRlLmdldCggMCApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGlucHV0IHx8ICEgJC5kYXRlcGljayB8fCAhICQuZGF0ZXBpY2suX3Nob3dEYXRlcGljayB8fCAhICRkYXRlLmhhc0NsYXNzKCAkLmRhdGVwaWNrLm1hcmtlckNsYXNzTmFtZSApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAoICQuZGF0ZXBpY2suX2xhc3RJbnB1dCA9PT0gaW5wdXQgKSAmJiAhICQuZGF0ZXBpY2suX2RhdGVwaWNrZXJTaG93aW5nICkge1xyXG5cdFx0XHRcdCQuZGF0ZXBpY2suX2xhc3RJbnB1dCA9IG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggKCAkLmRhdGVwaWNrLl9sYXN0SW5wdXQgPT09IGlucHV0ICkgJiYgJC5kYXRlcGljay5fZGF0ZXBpY2tlclNob3dpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkLmRhdGVwaWNrLl9zaG93RGF0ZXBpY2soIGlucHV0ICk7XHJcblx0XHRcdCQoICcjZGF0ZXBpY2stZGl2LCAuZGF0ZXBpY2stcG9wdXAnICkuY3NzKCAnei1pbmRleCcsIDEwMDAwMTAgKTtcclxuXHRcdH1cclxuXHJcblx0XHQkZGF0ZS5vZmYoICdjbGljay53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbiBmb2N1cy53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbiBrZXlkb3duLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuJyApLm9uKCAnY2xpY2sud3BiY190c19kYXRlX3JhbmdlX29wZW4gZm9jdXMud3BiY190c19kYXRlX3JhbmdlX29wZW4ga2V5ZG93bi53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGlmICggJ2tleWRvd24nID09PSBldmVudC50eXBlICYmICggMTMgIT09IGV2ZW50LndoaWNoICkgJiYgKCAzMiAhPT0gZXZlbnQud2hpY2ggKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggJ2tleWRvd24nID09PSBldmVudC50eXBlICkge1xyXG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNob3dfZGF0ZV9yYW5nZV9waWNrZXIoKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkZGF0ZVdyYXAub2ZmKCAnbW91c2Vkb3duLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuIGNsaWNrLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuJyApXHJcblx0XHRcdC5vbiggJ21vdXNlZG93bi53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQub24oICdjbGljay53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdFx0aWYgKCBldmVudC50YXJnZXQgIT09ICRkYXRlLmdldCggMCApICkge1xyXG5cdFx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdCRkYXRlLnRyaWdnZXIoICdmb2N1cycgKTtcclxuXHRcdFx0XHRzaG93X2RhdGVfcmFuZ2VfcGlja2VyKCk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHQkZGF0ZS5vbiggJ2NoYW5nZSBpbnB1dCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c3luY19kYXRlX3JhbmdlX2Zyb21faW5wdXQoICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X3JpZ2h0YmFyX3RhYnMoKSB7XHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfdHNfcmlnaHRiYXJfdGFicyBbcm9sZT1cInRhYlwiXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciAkdGFiID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgcGFuZWxJZCA9ICR0YWIuYXR0ciggJ2FyaWEtY29udHJvbHMnICk7XHJcblx0XHRcdHZhciAkcGFuZWwgPSAkKCAnIycgKyBwYW5lbElkICk7XHJcblx0XHRcdHZhciAkdGFibGlzdCA9ICR0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKTtcclxuXHJcblx0XHRcdGlmICggISAkcGFuZWwubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0JHRhYmxpc3QuZmluZCggJ1tyb2xlPVwidGFiXCJdJyApLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0XHQkdGFiLmF0dHIoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XHJcblx0XHRcdCQoICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgLndwYmNfYmZiX19wYWxldHRlX3BhbmVsJyApLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0XHQkcGFuZWwucmVtb3ZlQXR0ciggJ2hpZGRlbicgKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X3RpbWVfc2xvdHNfcGFnZSggY29udGV4dCwgZm9yY2UgKSB7XHJcblx0XHR2YXIgJGNvbnRleHQgPSBjb250ZXh0ID8gJCggY29udGV4dCApIDogJCggZG9jdW1lbnQgKTtcclxuXHRcdHZhciAkcGFnZXMgPSAkY29udGV4dC5pcyggJy53cGJjX3RzX3BhZ2UnICkgPyAkY29udGV4dCA6ICRjb250ZXh0LmZpbmQoICcud3BiY190c19wYWdlJyApO1xyXG5cclxuXHRcdGlmICggISAkcGFnZXMubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGZvcmNlICkge1xyXG5cdFx0XHQkcGFnZXMgPSAkcGFnZXMuZmlsdGVyKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cmV0dXJuICcwJyAhPT0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtYXV0by1pbml0JyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHBhZ2VzLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aW5pdF90aW1lX3Nsb3RzX2NvbXBvbmVudCggJCggdGhpcyApICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X3RpbWVfc2xvdHNfY29tcG9uZW50KCAkcGFnZSApIHtcclxuXHRcdHZhciAkZ3JpZDtcclxuXHRcdHZhciBpc0RyYWdnaW5nID0gZmFsc2U7XHJcblx0XHR2YXIgZHJhZ1N0YXJ0TWludXRlID0gMDtcclxuXHRcdHZhciBkcmFnU3RhcnRSb3cgPSBudWxsO1xyXG5cdFx0dmFyIGRyYWdTZWxlY3Rpb25JZCA9ICcnO1xyXG5cdFx0dmFyIHJlc2l6ZU1vZGUgPSAnJztcclxuXHJcblx0XHRpZiAoICRwYWdlLmF0dHIoICdkYXRhLXdwYmMtdHMtaW5pdGlhbGl6ZWQnICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdCRwYWdlLmF0dHIoICdkYXRhLXdwYmMtdHMtaW5pdGlhbGl6ZWQnLCAnMScgKTtcclxuXHJcblx0XHRjYWNoZV9yb3dfdGVtcGxhdGVzKCAkcGFnZSApO1xyXG5cdFx0JGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHJlbmRlcl9heGlzKCAkZ3JpZCApO1xyXG5cdFx0cG9zaXRpb25fYmFycyggJGdyaWQgKTtcclxuXHRcdGluaXRfZGF0ZV9yYW5nZV9waWNrZXIoICRwYWdlICk7XHJcblx0XHRsb2FkX2Jsb2NrZWRfaW50ZXJ2YWxzKCAkcGFnZSApO1xyXG5cdFx0c2V0X21vZGUoIGN1cnJlbnRNb2RlICk7XHJcblx0XHRzeW5jX3Nsb3Rfc3RlcF9jb250cm9scyggJHBhZ2UsIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKS5zdGVwICk7XHJcblx0XHRzeW5jX3pvb21fY29udHJvbHMoICRwYWdlLCBnZXRfZ3JpZF9jb25maWcoICRncmlkICkuc3RlcCApO1xyXG5cdFx0c3luY192aXNpYmxlX3RpbWVfY29udHJvbHMoICRwYWdlLCBnZXRfZ3JpZF9jb25maWcoICRncmlkICkuc3RhcnQsIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKS5lbmQgKTtcclxuXHRcdGJpbmRfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtdHMtY29udHJvbD1cInNsb3Rfc3RlcFwiXSwgI3dwYmNfdHNfc2xvdF9zdGVwJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfc3RlcCggJHBhZ2UsIHBhcnNlSW50KCAkKCB0aGlzICkudmFsKCksIDEwICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2hhbmdlJywgJyN3cGJjX3RzX3NpZGVfc2xvdF9zdGVwJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfc3RlcCggJHBhZ2UsIHBhcnNlSW50KCAkKCB0aGlzICkudmFsKCksIDEwICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJyZXNvdXJjZVwiXSwgI3dwYmNfdHNfcmVzb3VyY2UnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdpbnB1dCBjaGFuZ2UnLCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiem9vbVwiXSwgI3dwYmNfdHNfem9vbScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGluZGV4ID0gcGFyc2VJbnQoICQoIHRoaXMgKS52YWwoKSwgMTAgKTtcclxuXHRcdFx0c2V0X3N0ZXAoICRwYWdlLCB6b29tU3RlcHNbIGluZGV4IF0gfHwgMTUgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJyN3cGJjX3RzX3NpZGVfem9vbScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGluZGV4ID0gcGFyc2VJbnQoICQoIHRoaXMgKS52YWwoKSwgMTAgKTtcclxuXHRcdFx0c2V0X3N0ZXAoICRwYWdlLCB6b29tU3RlcHNbIGluZGV4IF0gfHwgMTUgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdHMtem9vbV0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkem9vbSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ3pvb20nICk7XHJcblx0XHRcdHZhciB2YWx1ZSA9IHBhcnNlSW50KCAkem9vbS52YWwoKSwgMTAgKTtcclxuXHRcdFx0dmFsdWUgKz0gJ2luJyA9PT0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtem9vbScgKSA/IDEgOiAtMTtcclxuXHRcdFx0dmFsdWUgPSBjbGFtcCggdmFsdWUsIDAsIHpvb21TdGVwcy5sZW5ndGggLSAxICk7XHJcblx0XHRcdCR6b29tLnZhbCggU3RyaW5nKCB2YWx1ZSApICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnY2xpY2snLCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzIFtkYXRhLXdwYmMtdHMtem9vbV0nLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciAkem9vbSA9ICQoICcjd3BiY190c19zaWRlX3pvb20nICk7XHJcblx0XHRcdHZhciB2YWx1ZSA9IHBhcnNlSW50KCAkem9vbS52YWwoKSwgMTAgKTtcclxuXHRcdFx0dmFsdWUgKz0gJ2luJyA9PT0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtem9vbScgKSA/IDEgOiAtMTtcclxuXHRcdFx0dmFsdWUgPSBjbGFtcCggdmFsdWUsIDAsIHpvb21TdGVwcy5sZW5ndGggLSAxICk7XHJcblx0XHRcdCR6b29tLnZhbCggU3RyaW5nKCB2YWx1ZSApICkudHJpZ2dlciggJ2NoYW5nZScgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NoYW5nZScsICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfc3RhcnRcIl0sIFtkYXRhLXdwYmMtdHMtY29udHJvbD1cImRheV9lbmRcIl0sICN3cGJjX3RzX2RheV9zdGFydCwgI3dwYmNfdHNfZGF5X2VuZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X3Zpc2libGVfdGltZV9yYW5nZSggJHBhZ2UsIGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9zdGFydCcgKS52YWwoKSwgZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X2VuZCcgKS52YWwoKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfdHNfc2lkZV9zdGFydCwgI3dwYmNfdHNfc2lkZV9lbmQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF92aXNpYmxlX3RpbWVfcmFuZ2UoICRwYWdlLCAkKCAnI3dwYmNfdHNfc2lkZV9zdGFydCcgKS52YWwoKSwgJCggJyN3cGJjX3RzX3NpZGVfZW5kJyApLnZhbCgpICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdpbnB1dCBjaGFuZ2UnLCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X3N0YXJ0X3NsaWRlclwiXSwgW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X2VuZF9zbGlkZXJcIl0sICN3cGJjX3RzX2RheV9zdGFydF9zbGlkZXIsICN3cGJjX3RzX2RheV9lbmRfc2xpZGVyJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfdmlzaWJsZV90aW1lX3JhbmdlKCAkcGFnZSwgZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X3N0YXJ0X3NsaWRlcicgKS52YWwoKSwgZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X2VuZF9zbGlkZXInICkudmFsKCkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnaW5wdXQgY2hhbmdlJywgJyN3cGJjX3RzX3NpZGVfc3RhcnRfc2xpZGVyLCAjd3BiY190c19zaWRlX2VuZF9zbGlkZXInLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF92aXNpYmxlX3RpbWVfcmFuZ2UoICRwYWdlLCAkKCAnI3dwYmNfdHNfc2lkZV9zdGFydF9zbGlkZXInICkudmFsKCksICQoICcjd3BiY190c19zaWRlX2VuZF9zbGlkZXInICkudmFsKCkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdHMtY29tbWFuZF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRydW5fY29tbWFuZCggJHBhZ2UsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLWNvbW1hbmQnICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdHMtcmFuZ2Utc2hpZnRdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0c2hpZnRfZGF0ZV9yYW5nZSggJHBhZ2UsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXJhbmdlLXNoaWZ0JyApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICdbZGF0YS13cGJjLXRzLWNyZWF0ZS1ib29raW5nXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGNyZWF0ZV9ib29raW5nX2Zyb21fYWN0aXZlX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5jbG9zZXN0KCAnLm1vZGFsJyApLm9mZiggJ2NsaWNrLndwYmNfdHNfY3JlYXRlX2Jvb2tpbmcnICkub24oICdjbGljay53cGJjX3RzX2NyZWF0ZV9ib29raW5nJywgJ1tkYXRhLXdwYmMtdHMtY3JlYXRlLWJvb2tpbmddJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0Y3JlYXRlX2Jvb2tpbmdfZnJvbV9hY3RpdmVfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLmNsb3Nlc3QoICcubW9kYWwnICkub2ZmKCAnY2xpY2sud3BiY190c19mb290ZXJfY29tbWFuZCcgKS5vbiggJ2NsaWNrLndwYmNfdHNfZm9vdGVyX2NvbW1hbmQnLCAnW2RhdGEtd3BiYy10cy1jb21tYW5kXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdHJ1bl9jb21tYW5kKCAkcGFnZSwgJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtY29tbWFuZCcgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLmNsb3Nlc3QoICcubW9kYWwnICkub2ZmKCAnY2xpY2sud3BiY190c19mb290ZXJfY2xlYXInICkub24oICdjbGljay53cGJjX3RzX2Zvb3Rlcl9jbGVhcicsICcud3BiY190c19jbGVhcl9zZWxlY3Rpb24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICcud3BiY190c19iYXJfYm9va2VkJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0aGFuZGxlX2Jvb2tlZF9iYXJfY2xpY2soICRwYWdlLCBldmVudCApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub2ZmKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9jb21tYW5kJyApLm9uKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9jb21tYW5kJywgJy53cGJjX3RzX3JpZ2h0YmFyX3BhbmVscyBbZGF0YS13cGJjLXRzLWNvbW1hbmRdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0cnVuX2NvbW1hbmQoICRwYWdlLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1jb21tYW5kJyApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vZmYoICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX3JhbmdlX3NoaWZ0JyApLm9uKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9yYW5nZV9zaGlmdCcsICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgW2RhdGEtd3BiYy10cy1yYW5nZS1zaGlmdF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRzaGlmdF9kYXRlX3JhbmdlKCAkcGFnZSwgJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtcmFuZ2Utc2hpZnQnICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ21vdXNlZG93biB0b3VjaHN0YXJ0JywgJy53cGJjX3RzX2hhbmRsZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciAkc2VsZWN0aW9uID0gJCggdGhpcyApLmNsb3Nlc3QoICcud3BiY190c19zZWxlY3Rpb24nICk7XHJcblx0XHRcdHZhciAkbGFuZSA9ICRzZWxlY3Rpb24uY2xvc2VzdCggJy53cGJjX3RzX2xhbmUnICk7XHJcblx0XHRcdGlzRHJhZ2dpbmcgPSB0cnVlO1xyXG5cdFx0XHRyZXNpemVNb2RlID0gJCggdGhpcyApLmhhc0NsYXNzKCAnd3BiY190c19oYW5kbGVfc3RhcnQnICkgPyAnc3RhcnQnIDogJ2VuZCc7XHJcblx0XHRcdGFjdGl2ZVNlbGVjdGlvbklkID0gJHNlbGVjdGlvbi5hdHRyKCAnZGF0YS13cGJjLXRzLXNlbGVjdGlvbi1pZCcgKTtcclxuXHRcdFx0ZHJhZ1NlbGVjdGlvbklkID0gYWN0aXZlU2VsZWN0aW9uSWQ7XHJcblx0XHRcdGRyYWdTdGFydFJvdyA9ICRsYW5lLmNsb3Nlc3QoICcud3BiY190c19yb3cnICkuYXR0ciggJ2RhdGEtd3BiYy10cy1yb3cnICk7XHJcblx0XHRcdGRyYWdTdGFydE1pbnV0ZSA9IG1pbnV0ZV9mcm9tX3BvaW50ZXIoIGV2ZW50LCAkbGFuZSApO1xyXG5cdFx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdtb3VzZWRvd24gdG91Y2hzdGFydCcsICcud3BiY190c19zZWxlY3Rpb246bm90KC53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZSknLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRpZiAoICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICcud3BiY190c19oYW5kbGUnICkubGVuZ3RoICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRhY3RpdmVTZWxlY3Rpb25JZCA9ICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXNlbGVjdGlvbi1pZCcgKTtcclxuXHRcdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnbW91c2Vkb3duIHRvdWNoc3RhcnQnLCAnLndwYmNfdHNfbGFuZScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdHZhciAkbGFuZSA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyICRiYXJUYXJnZXQgPSAkKCBldmVudC50YXJnZXQgKS5jbG9zZXN0KCAnLndwYmNfdHNfYmFyJyApO1xyXG5cdFx0XHR2YXIgc3RlcDtcclxuXHJcblx0XHRcdGlmICggJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggJGJhclRhcmdldC5sZW5ndGggJiYgISBpc19iYXJfc2VsZWN0YWJsZV9mb3JfdGltZV9hY3Rpb24oICRiYXJUYXJnZXQgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlzRHJhZ2dpbmcgPSB0cnVlO1xyXG5cdFx0XHRyZXNpemVNb2RlID0gJyc7XHJcblx0XHRcdGRyYWdTdGFydFJvdyA9ICRsYW5lLmNsb3Nlc3QoICcud3BiY190c19yb3cnICkuYXR0ciggJ2RhdGEtd3BiYy10cy1yb3cnICk7XHJcblx0XHRcdGRyYWdTdGFydE1pbnV0ZSA9IG1pbnV0ZV9mcm9tX3BvaW50ZXIoIGV2ZW50LCAkbGFuZSApO1xyXG5cdFx0XHRzdGVwID0gZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApLnN0ZXA7XHJcblx0XHRcdGRyYWdTZWxlY3Rpb25JZCA9IGNyZWF0ZV9zZWxlY3Rpb24oICRwYWdlLCBbIGRyYWdTdGFydFJvdyBdLCBkcmFnU3RhcnRNaW51dGUsIGRyYWdTdGFydE1pbnV0ZSArIHN0ZXAgKS5pZDtcclxuXHRcdFx0c2hvd19saXZlX3RpcCggJHBhZ2UsIGV2ZW50ICk7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ21vdXNlbW92ZS53cGJjX3RzIHRvdWNobW92ZS53cGJjX3RzJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0dmFyIGN1cnJlbnRSb3c7XHJcblx0XHRcdHZhciByb3dzO1xyXG5cdFx0XHR2YXIgJGxhbmU7XHJcblx0XHRcdHZhciBtaW51dGU7XHJcblx0XHRcdHZhciBpdGVtO1xyXG5cclxuXHRcdFx0aWYgKCAhIGlzRHJhZ2dpbmcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpdGVtID0gZ2V0X3NlbGVjdGlvbl9ieV9pZCggZHJhZ1NlbGVjdGlvbklkICk7XHJcblx0XHRcdGlmICggISBpdGVtICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y3VycmVudFJvdyA9IHJvd19mcm9tX3BvaW50ZXIoICRwYWdlLCBldmVudCApIHx8IGRyYWdTdGFydFJvdztcclxuXHRcdFx0cm93cyA9IGdldF9yb3dzX2JldHdlZW4oICRwYWdlLCBkcmFnU3RhcnRSb3csIGN1cnJlbnRSb3cgKTtcclxuXHRcdFx0JGxhbmUgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgZHJhZ1N0YXJ0Um93ICsgJ1wiXSAud3BiY190c19sYW5lJyApO1xyXG5cdFx0XHRtaW51dGUgPSBtaW51dGVfZnJvbV9wb2ludGVyKCBldmVudCwgJGxhbmUgKTtcclxuXHJcblx0XHRcdGlmICggJ3N0YXJ0JyA9PT0gcmVzaXplTW9kZSApIHtcclxuXHRcdFx0XHR1cGRhdGVfc2VsZWN0aW9uKCAkcGFnZSwgaXRlbS5pZCwgaXRlbS5yb3dzLCBtaW51dGUsIGl0ZW0uZW5kICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoICdlbmQnID09PSByZXNpemVNb2RlICkge1xyXG5cdFx0XHRcdHVwZGF0ZV9zZWxlY3Rpb24oICRwYWdlLCBpdGVtLmlkLCBpdGVtLnJvd3MsIGl0ZW0uc3RhcnQsIG1pbnV0ZSApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHVwZGF0ZV9zZWxlY3Rpb24oICRwYWdlLCBpdGVtLmlkLCByb3dzLCBkcmFnU3RhcnRNaW51dGUsIG1pbnV0ZSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGRyYWdTZWxlY3Rpb25JZCA9IGFjdGl2ZVNlbGVjdGlvbklkO1xyXG5cclxuXHRcdFx0c2hvd19saXZlX3RpcCggJHBhZ2UsIGV2ZW50ICk7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ21vdXNldXAud3BiY190cyB0b3VjaGVuZC53cGJjX3RzJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpc0RyYWdnaW5nID0gZmFsc2U7XHJcblx0XHRcdHJlc2l6ZU1vZGUgPSAnJztcclxuXHRcdFx0ZHJhZ1NlbGVjdGlvbklkID0gJyc7XHJcblx0XHRcdGhpZGVfbGl2ZV90aXAoICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjbGljaycsICcud3BiY190c19jbGVhcl9zZWxlY3Rpb24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vZmYoICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX2NsZWFyJyApLm9uKCAnY2xpY2sud3BiY190c19yaWdodGJhcl9jbGVhcicsICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgLndwYmNfdHNfY2xlYXJfc2VsZWN0aW9uJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0d2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19pbml0ID0gZnVuY3Rpb24gKCBjb250ZXh0ICkge1xyXG5cdFx0aW5pdF90aW1lX3Nsb3RzX3BhZ2UoIGNvbnRleHQgfHwgZG9jdW1lbnQsIHRydWUgKTtcclxuXHR9O1xyXG5cdHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfc2V0X2NvbnRleHQgPSBzZXRfdGltZV9zbG90c19jb250ZXh0O1xyXG5cclxuXHQkKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRpbml0X3JpZ2h0YmFyX3RhYnMoKTtcclxuXHRcdGluaXRfdGltZV9zbG90c19wYWdlKCBkb2N1bWVudCwgZmFsc2UgKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnd3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2luaXQnLCBmdW5jdGlvbiAoIGV2ZW50LCBjb250ZXh0ICkge1xyXG5cdFx0XHRpbml0X3RpbWVfc2xvdHNfcGFnZSggY29udGV4dCB8fCBkb2N1bWVudCwgdHJ1ZSApO1xyXG5cdFx0fSApO1xyXG5cdH0gKTtcclxufSggalF1ZXJ5ICkgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNFLFdBQVdBLENBQUMsRUFBRztFQUNoQixZQUFZOztFQUVaLElBQUlDLFNBQVMsR0FBRyxDQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUU7RUFDckMsSUFBSUMsV0FBVyxHQUFHLE9BQU87RUFDekIsSUFBSUMsZUFBZSxHQUFHLEVBQUU7RUFDeEIsSUFBSUMsaUJBQWlCLEdBQUcsRUFBRTtFQUMxQixJQUFJQyxZQUFZLEdBQUcsRUFBRTtFQUNyQixJQUFJQyxlQUFlLEdBQUcsQ0FBQztFQUN2QixJQUFJQyxrQkFBa0IsR0FBRyxDQUFDO0VBQzFCLElBQUlDLGlCQUFpQixHQUFHLElBQUk7RUFDNUIsSUFBSUMsbUJBQW1CLEdBQUcsQ0FBQztFQUMzQixJQUFJQyxpQkFBaUIsR0FBRyxJQUFJO0VBRTVCLFNBQVNDLEtBQUtBLENBQUVDLEtBQUssRUFBRztJQUN2QixPQUFPLENBQUVBLEtBQUssR0FBRyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsSUFBS0EsS0FBSztFQUN6QztFQUVBLFNBQVNDLGVBQWVBLENBQUVDLE9BQU8sRUFBRztJQUNuQyxJQUFJQyxLQUFLLEdBQUdDLElBQUksQ0FBQ0MsS0FBSyxDQUFFSCxPQUFP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
