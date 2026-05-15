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
        selected_time: context.selected_time,
        time_override_enabled: 1,
        time_override_source: 'times_availability',
        time_override_start: minutes_to_time(context.start_second / 60),
        time_override_end: minutes_to_time(context.end_second / 60)
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1hdmFpbGFiaWxpdHktdGltZXNsb3RzL19vdXQvYXZhaWxhYmlsaXR5X3RpbWVzbG90c19wYWdlLmpzIiwibmFtZXMiOlsiJCIsInpvb21TdGVwcyIsImN1cnJlbnRNb2RlIiwic2VsZWN0aW9uUmFuZ2VzIiwiYWN0aXZlU2VsZWN0aW9uSWQiLCJyb3dUZW1wbGF0ZXMiLCJuZXh0U2VsZWN0aW9uSWQiLCJuZXh0VG9vbHRpcFNjb3BlSWQiLCJhY3RpdmVMb2FkUmVxdWVzdCIsImFjdGl2ZUxvYWRSZXF1ZXN0SWQiLCJhY3RpdmVTYXZlUmVxdWVzdCIsInBhZF8yIiwidmFsdWUiLCJtaW51dGVzX3RvX3RpbWUiLCJtaW51dGVzIiwiaG91cnMiLCJNYXRoIiwiZmxvb3IiLCJtaW5zIiwiY2xhbXAiLCJtaW4iLCJtYXgiLCJzbmFwX21pbnV0ZSIsIm1pbnV0ZSIsInN0ZXAiLCJyb3VuZCIsImdldF9ncmlkX2NvbmZpZyIsIiRncmlkIiwic3RhcnQiLCJwYXJzZUludCIsImF0dHIiLCJlbmQiLCJnZXRfY29udHJvbCIsIiRwYWdlIiwibmFtZSIsIiRjb250cm9sIiwiZmluZCIsImZpcnN0IiwibGVuZ3RoIiwicGVyY2VudF9mb3JfbWludXRlIiwiY29uZmlnIiwibm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSIsImdldF9zZWxlY3Rpb25fYnlfaWQiLCJzZWxlY3Rpb25JZCIsImZvdW5kIiwiZWFjaCIsImluZGV4IiwiaXRlbSIsImlkIiwicmVuZGVyX2F4aXMiLCIkYXhpcyIsImh0bWwiLCJzbG90Q291bnQiLCJ2aXNpYmxlSG91cnMiLCJheGlzRm9udFNpemUiLCJheGlzRm9udFdlaWdodCIsImZpcnN0SG91ciIsImNlaWwiLCJjc3MiLCJyZWZyZXNoX2Zsb2F0aW5nX2hlYWRlciIsImNsb3Nlc3QiLCJwb3NpdGlvbl9iYXJzIiwiJGJhciIsInZpc2libGVTdGFydCIsInZpc2libGVFbmQiLCJsZWZ0Iiwid2lkdGgiLCJoaWRlIiwic2hvdyIsInJlbmRlcl90aW1lbGluZV9iYXJzIiwiYmFycyIsInNldHRpbmdzIiwid2luZG93Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3BhZ2UiLCJsYWJlbHMiLCJpMThuIiwicmVtb3ZlIiwiZGF0ZSIsInJlc291cmNlcyIsIiRyb3ciLCJyZXNvdXJjZUlkIiwicmVzb3VyY2VCYXJzIiwiaW50ZXJ2YWwiLCJ0eXBlIiwiaWNvbiIsInRvb2x0aXAiLCIkaWNvbldyYXAiLCJib29raW5nX3VybCIsImJvb2tpbmdfaWQiLCJvcGVuX2Jvb2tpbmciLCJydWxlX3VybCIsInJ1bGVfc291cmNlIiwic291cmNlX3R5cGUiLCJvcGVuX2F2YWlsYWJpbGl0eV9ydWxlIiwic3RhdHVzX3RpdGxlIiwiYWRkQ2xhc3MiLCJzdGFydF9taW51dGUiLCJlbmRfbWludXRlIiwidW5hdmFpbGFibGVfdGltZXNsb3RfaWQiLCJlZGl0YWJsZSIsImFwcGVuZCIsInJlZnJlc2hfYmFyX3Rvb2x0aXBzIiwibG9hZF9ibG9ja2VkX2ludGVydmFscyIsIiRkYXRlUmFuZ2UiLCJyZXF1ZXN0SWQiLCJhamF4X3VybCIsInJlYWR5U3RhdGUiLCJhYm9ydCIsInNldF90aW1lbGluZV9sb2FkaW5nIiwibG9hZGluZyIsInBvc3QiLCJhY3Rpb24iLCJyZXNvdXJjZV9pZCIsInZhbCIsImRhdGVfc3RhcnQiLCJkYXRlX2VuZCIsImRvbmUiLCJyZXNwb25zZSIsInN1Y2Nlc3MiLCJkYXRhIiwiZmFpbCIsInhociIsInRleHRTdGF0dXMiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsInNhdmVfZXJyb3IiLCJhbHdheXMiLCJnZXRfcm93c19iZXR3ZWVuIiwic3RhcnRSb3ciLCJlbmRSb3ciLCJzdGFydEluZGV4IiwiZW5kSW5kZXgiLCJyb3dzIiwiaSIsInB1c2giLCJTdHJpbmciLCJyb3dfbGFiZWwiLCJyb3dJZCIsInRyaW0iLCJ0ZXh0IiwiZXNjYXBlX2h0bWwiLCJwb3NpdGlvbl9sb2FkaW5nX292ZXJsYXkiLCIkY2FyZCIsImNhcmQiLCJnZXQiLCIkb3ZlcmxheSIsImNsaWVudFdpZHRoIiwiaGVpZ2h0IiwiY2xpZW50SGVpZ2h0IiwidHJhbnNmb3JtIiwic2Nyb2xsTGVmdCIsInNjcm9sbFRvcCIsImlzTG9hZGluZyIsImxhYmVsIiwidG9nZ2xlQ2xhc3MiLCJvZmYiLCJvbiIsInNldF9hY3Rpb25fYnV0dG9uc19idXN5IiwiaXNCdXN5IiwiJHNjb3BlIiwiYWRkIiwiaXNfZnVsbF9wYWdlX2NvbXBvbmVudCIsImhhc0NsYXNzIiwiZ2V0X2Zsb2F0aW5nX2hlYWRlcl9uYW1lc3BhY2UiLCJyZXBsYWNlIiwiZ2V0X3RvcF9uYXZfYm90dG9tIiwiJHRvcE5hdiIsInJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJib3R0b20iLCJlbnN1cmVfZmxvYXRpbmdfaGVhZGVyIiwiJGZsb2F0aW5nIiwiY2hpbGRyZW4iLCIkaGVhZGVyIiwiYXBwZW5kVG8iLCJjbG9uZSIsInN5bmNfZmxvYXRpbmdfaGVhZGVyIiwiY2FyZFJlY3QiLCJoZWFkZXJSZWN0IiwidG9wT2Zmc2V0Iiwic2hvdWxkU2hvdyIsInJlbW92ZUNsYXNzIiwidG9wIiwib3V0ZXJXaWR0aCIsImVtcHR5IiwiYmluZF9mbG9hdGluZ19oZWFkZXIiLCJuYW1lc3BhY2UiLCJkb2N1bWVudCIsInNldFRpbWVvdXQiLCIkdG9vbHRpcFNjb3BlIiwidG9vbHRpcFNjb3BlSWQiLCJkaWRJbml0aWFsaXplVG9vbHRpcHMiLCJfdGlwcHkiLCJkZXN0cm95Iiwid3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMiLCJpc19ib29raW5nX2xpc3Rpbmdfc2VhcmNoX2F2YWlsYWJsZSIsIndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcyIsIndwYmNfYWp4X2Jvb2tpbmdfbGlzdGluZyIsImNsb3NlX3RpbWVfc2xvdHNfcG9wdXAiLCIkbW9kYWwiLCJ3cGJjX215X21vZGFsIiwibW9kYWwiLCJ0cmlnZ2VyIiwic2VhcmNoX2Jvb2tpbmdfaW5fY3VycmVudF9saXN0aW5nIiwiYm9va2luZ0lkIiwia2V5d29yZCIsImhhbmRsZV9ib29rZWRfYmFyX2NsaWNrIiwiZXZlbnQiLCJjdXJyZW50VGFyZ2V0IiwiJGxpbmsiLCJ0YXJnZXQiLCJib29raW5nVXJsIiwicHJldmVudERlZmF1bHQiLCJzdG9wUHJvcGFnYXRpb24iLCJsb2NhdGlvbiIsImhyZWYiLCJ1bmlxdWVfZGF0ZXNfZnJvbV9zZWxlY3Rpb25zIiwiZGF0ZXMiLCJyb3dJbmRleCIsIk9iamVjdCIsImtleXMiLCJnZXRfc2VsZWN0aW9uX3BheWxvYWQiLCJwYXlsb2FkIiwic3RhcnRfc2Vjb25kIiwiZW5kX3NlY29uZCIsInNvcnQiLCJhIiwiYiIsImdldF9hY3RpdmVfYm9va2luZ19zZWxlY3Rpb25fY29udGV4dCIsInNlbGVjdGVkX2RhdGUiLCJzZWxlY3RlZF90aW1lIiwiY3JlYXRlX2Jvb2tpbmdfZnJvbV9hY3RpdmVfc2VsZWN0aW9uIiwiY29udGV4dCIsImJvb2tpbmdGb3JtIiwic2VsZWN0X29uZV9zbG90X2Zvcl9ib29raW5nIiwid3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsIiwiYWRkX2Jvb2tpbmdfbW9kYWxfbWlzc2luZyIsIm1vZGUiLCJib29raW5nX2Zvcm0iLCJ0aW1lX292ZXJyaWRlX2VuYWJsZWQiLCJ0aW1lX292ZXJyaWRlX3NvdXJjZSIsInRpbWVfb3ZlcnJpZGVfc3RhcnQiLCJ0aW1lX292ZXJyaWRlX2VuZCIsImNsb25lX2RhdGUiLCJEYXRlIiwiZ2V0RnVsbFllYXIiLCJnZXRNb250aCIsImdldERhdGUiLCJhZGRfZGF5cyIsImRheXMiLCJuZXh0Iiwic2V0RGF0ZSIsImZvcm1hdF9pc29fZGF0ZSIsImZvcm1hdF9yb3dfZGF0ZSIsIm1vbnRocyIsImdldERheSIsImZvcm1hdF9kYXRlX3JhbmdlX2Rpc3BsYXkiLCJzdGFydERhdGUiLCJlbmREYXRlIiwiZGF0ZXBpY2siLCJmb3JtYXREYXRlIiwiY2FjaGVfcm93X3RlbXBsYXRlcyIsInRvQXJyYXkiLCJyb3ciLCJlbnN1cmVfcm93X2NvdW50IiwiY291bnQiLCIkcm93c1dyYXAiLCIkcm93cyIsIiRjbG9uZSIsInNsaWNlIiwidXBkYXRlX3Jvd3NfZm9yX2RhdGVfcmFuZ2UiLCJkYXlNcyIsImRheXNDb3VudCIsImdldFRpbWUiLCJyb3dEYXRlIiwiZ3JlcCIsImNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zIiwicmVuZGVyX3NlbGVjdGlvbnMiLCJwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24iLCJzdHJpbmdEYXRlcyIsImpzRGF0ZXNBcnIiLCJwYXJ0cyIsImlzQXJyYXkiLCJyYW5nZSIsIm11bHRpcGxlIiwiaXNOYU4iLCJzcGxpdCIsInBhcnNlX2RhdGVfdGV4dCIsImdldF9kYXRlcGlja19zZWxlY3RlZF9yYW5nZSIsIiRkYXRlIiwiaW5zdCIsIl9nZXRJbnN0IiwiX2dldERhdGUiLCJhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiIsIm9wdGlvbnMiLCJzdGFydElzbyIsImVuZElzbyIsImN1cnJlbnRLZXkiLCJuZXh0S2V5IiwiZm9yY2VfcmVsb2FkIiwic3luY19kYXRlX3JhbmdlX2Zyb21faW5wdXQiLCJnZXRfZGF0ZV9yYW5nZV9mcm9tX2RhdGFfYXR0cnMiLCJnZXRfY3VycmVudF9kYXRlX3JhbmdlIiwic2hpZnRfZGF0ZV9yYW5nZSIsImRpcmVjdGlvbiIsInNoaWZ0IiwiY2xlYXJfc2VsZWN0aW9uIiwicGFyc2VkIiwic3FsTWF0Y2giLCJtYXRjaCIsInBhcnNlRGF0ZSIsImVycm9yIiwic2V0X3RpbWVfc2xvdHNfY29udGV4dCIsIiRjb250ZXh0IiwiaXMiLCJyZXNvdXJjZUNoYW5nZWQiLCJyYW5nZUNoYW5nZWQiLCJpbml0X3RpbWVfc2xvdHNfcGFnZSIsInJvd19mcm9tX3BvaW50ZXIiLCJvcmlnaW5hbCIsIm9yaWdpbmFsRXZlbnQiLCJwb2ludCIsInRvdWNoZXMiLCJlbCIsImVsZW1lbnRGcm9tUG9pbnQiLCJjbGllbnRYIiwiY2xpZW50WSIsImNvbnRhaW5zIiwibWludXRlX2Zyb21fcG9pbnRlciIsIiRsYW5lIiwicmF0aW8iLCJjcmVhdGVfc2VsZWN0aW9uIiwidXBkYXRlX3NlbGVjdGlvbiIsInByZWZlcnJlZEFjdGl2ZUlkIiwiaW50ZXJ2YWxzIiwibWVyZ2VkIiwiZ3JvdXBzIiwibmV3QWN0aXZlSWQiLCJhY3RpdmUiLCJsYXN0IiwibGFzdFJvdyIsIm1hcCIsIiR0ZW1wbGF0ZSIsIiRzZWxlY3Rpb24iLCJyZW1vdmVBdHRyIiwidXBkYXRlX3N1bW1hcnkiLCJkYXRlc0NvdW50IiwiZGF0ZVRleHQiLCJ0aW1lVGV4dCIsImRldGFpbHMiLCJkZXRhaWxzSHRtbCIsInRpbWVMYWJlbCIsInNob3dfbGl2ZV90aXAiLCIkdGlwIiwicGFnZVgiLCJwYWdlWSIsImhpZGVfbGl2ZV90aXAiLCJzeW5jX3Nsb3Rfc3RlcF9jb250cm9scyIsInN5bmNfem9vbV9jb250cm9scyIsImluZGV4T2YiLCJzZXRfc3RlcCIsInN5bmNfdmlzaWJsZV90aW1lX2NvbnRyb2xzIiwic2V0X3Zpc2libGVfdGltZV9yYW5nZSIsImFjdGl2ZUVsZW1lbnQiLCJzZXRfbW9kZSIsImlzX2Jhcl9zZWxlY3RhYmxlX2Zvcl90aW1lX2FjdGlvbiIsInJ1bl9jb21tYW5kIiwic2VsZWN0X3Nsb3RzX2ZpcnN0Iiwibm9uY2UiLCJzYXZpbmciLCJKU09OIiwic3RyaW5naWZ5IiwiYmxvY2tfc3VjY2VzcyIsInVuYmxvY2tfc3VjY2VzcyIsImluaXRfZGF0ZV9yYW5nZV9waWNrZXIiLCIkZGF0ZVdyYXAiLCJmaXJzdERheSIsImZuIiwiY29uc29sZSIsImxvZyIsIl93cGJjIiwiZ2V0X290aGVyX3BhcmFtIiwibWFya2VyQ2xhc3NOYW1lIiwiYmVmb3JlU2hvd0RheSIsIm9uU2VsZWN0Iiwib25DbG9zZSIsInNob3dPbiIsInNob3dBbmltIiwiZHVyYXRpb24iLCJyYW5nZVNlbGVjdCIsIm11bHRpU2VsZWN0IiwibnVtYmVyT2ZNb250aHMiLCJzdGVwTW9udGhzIiwicHJldlRleHQiLCJuZXh0VGV4dCIsImRhdGVGb3JtYXQiLCJjaGFuZ2VNb250aCIsImNoYW5nZVllYXIiLCJtaW5EYXRlIiwibWF4RGF0ZSIsInNob3dTdGF0dXMiLCJtdWx0aVNlcGFyYXRvciIsImNsb3NlQXRUb3AiLCJnb3RvQ3VycmVudCIsImhpZGVJZk5vUHJldk5leHQiLCJ1c2VUaGVtZVJvbGxlciIsIm1hbmRhdG9yeSIsInNob3dfZGF0ZV9yYW5nZV9waWNrZXIiLCJpbnB1dCIsIl9zaG93RGF0ZXBpY2siLCJfbGFzdElucHV0IiwiX2RhdGVwaWNrZXJTaG93aW5nIiwid2hpY2giLCJpbml0X3JpZ2h0YmFyX3RhYnMiLCIkdGFiIiwicGFuZWxJZCIsIiRwYW5lbCIsIiR0YWJsaXN0IiwiZm9yY2UiLCIkcGFnZXMiLCJmaWx0ZXIiLCJpbml0X3RpbWVfc2xvdHNfY29tcG9uZW50IiwiaXNEcmFnZ2luZyIsImRyYWdTdGFydE1pbnV0ZSIsImRyYWdTdGFydFJvdyIsImRyYWdTZWxlY3Rpb25JZCIsInJlc2l6ZU1vZGUiLCIkem9vbSIsIiRiYXJUYXJnZXQiLCJjdXJyZW50Um93Iiwid3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2luaXQiLCJ3cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfc2V0X2NvbnRleHQiLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWF2YWlsYWJpbGl0eS10aW1lc2xvdHMvX3NyYy9hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3BhZ2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFRpbWUgU2xvdHMgQXZhaWxhYmlsaXR5IFVJLlxyXG4gKi9cclxuKCBmdW5jdGlvbiAoICQgKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHR2YXIgem9vbVN0ZXBzID0gWyA2MCwgMzAsIDE1LCAxMCwgNSBdO1xyXG5cdHZhciBjdXJyZW50TW9kZSA9ICdibG9jayc7XHJcblx0dmFyIHNlbGVjdGlvblJhbmdlcyA9IFtdO1xyXG5cdHZhciBhY3RpdmVTZWxlY3Rpb25JZCA9ICcnO1xyXG5cdHZhciByb3dUZW1wbGF0ZXMgPSBbXTtcclxuXHR2YXIgbmV4dFNlbGVjdGlvbklkID0gMTtcclxuXHR2YXIgbmV4dFRvb2x0aXBTY29wZUlkID0gMTtcclxuXHR2YXIgYWN0aXZlTG9hZFJlcXVlc3QgPSBudWxsO1xyXG5cdHZhciBhY3RpdmVMb2FkUmVxdWVzdElkID0gMDtcclxuXHR2YXIgYWN0aXZlU2F2ZVJlcXVlc3QgPSBudWxsO1xyXG5cclxuXHRmdW5jdGlvbiBwYWRfMiggdmFsdWUgKSB7XHJcblx0XHRyZXR1cm4gKCB2YWx1ZSA8IDEwID8gJzAnIDogJycgKSArIHZhbHVlO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbWludXRlc190b190aW1lKCBtaW51dGVzICkge1xyXG5cdFx0dmFyIGhvdXJzID0gTWF0aC5mbG9vciggbWludXRlcyAvIDYwICk7XHJcblx0XHR2YXIgbWlucyA9IG1pbnV0ZXMgJSA2MDtcclxuXHRcdHJldHVybiBwYWRfMiggaG91cnMgKSArICc6JyArIHBhZF8yKCBtaW5zICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbGFtcCggdmFsdWUsIG1pbiwgbWF4ICkge1xyXG5cdFx0cmV0dXJuIE1hdGgubWF4KCBtaW4sIE1hdGgubWluKCBtYXgsIHZhbHVlICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNuYXBfbWludXRlKCBtaW51dGUsIHN0ZXAgKSB7XHJcblx0XHRyZXR1cm4gTWF0aC5yb3VuZCggbWludXRlIC8gc3RlcCApICogc3RlcDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKSB7XHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRzdGFydDogcGFyc2VJbnQoICRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICksIDEwICkgfHwgMCxcclxuXHRcdFx0ZW5kOiBwYXJzZUludCggJGdyaWQuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICksIDEwICkgfHwgMTQ0MCxcclxuXHRcdFx0c3RlcDogcGFyc2VJbnQoICRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RlcCcgKSwgMTAgKSB8fCAxNVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jb250cm9sKCAkcGFnZSwgbmFtZSApIHtcclxuXHRcdHZhciAkY29udHJvbCA9ICRwYWdlLmZpbmQoICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCInICsgbmFtZSArICdcIl0nICkuZmlyc3QoKTtcclxuXHJcblx0XHRpZiAoICEgJGNvbnRyb2wubGVuZ3RoICkge1xyXG5cdFx0XHQkY29udHJvbCA9ICRwYWdlLmZpbmQoICcjd3BiY190c18nICsgbmFtZSApLmZpcnN0KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICRjb250cm9sO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcGVyY2VudF9mb3JfbWludXRlKCBtaW51dGUsIGNvbmZpZyApIHtcclxuXHRcdHJldHVybiAoICggbWludXRlIC0gY29uZmlnLnN0YXJ0ICkgLyAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKSApICogMTAwO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3NlbGVjdGlvbl9yYW5nZSggc3RhcnQsIGVuZCwgY29uZmlnICkge1xyXG5cdFx0c3RhcnQgPSBjbGFtcCggc25hcF9taW51dGUoIHN0YXJ0LCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdGVuZCA9IGNsYW1wKCBzbmFwX21pbnV0ZSggZW5kLCBjb25maWcuc3RlcCApLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0ID09PSBlbmQgKSB7XHJcblx0XHRcdGVuZCA9IGNsYW1wKCBzdGFydCArIGNvbmZpZy5zdGVwLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0aWYgKCBzdGFydCA9PT0gZW5kICkge1xyXG5cdFx0XHRcdHN0YXJ0ID0gY2xhbXAoIGVuZCAtIGNvbmZpZy5zdGVwLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN0YXJ0OiBNYXRoLm1pbiggc3RhcnQsIGVuZCApLFxyXG5cdFx0XHRlbmQ6IE1hdGgubWF4KCBzdGFydCwgZW5kIClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX2J5X2lkKCBzZWxlY3Rpb25JZCApIHtcclxuXHRcdHZhciBmb3VuZCA9IG51bGw7XHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0aWYgKCBpdGVtLmlkID09PSBzZWxlY3Rpb25JZCApIHtcclxuXHRcdFx0XHRmb3VuZCA9IGl0ZW07XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fSApO1xyXG5cdFx0cmV0dXJuIGZvdW5kO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVuZGVyX2F4aXMoICRncmlkICkge1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHRcdHZhciAkYXhpcyA9ICRncmlkLmZpbmQoICcud3BiY190c190aW1lX2F4aXMnICk7XHJcblx0XHR2YXIgaHRtbCA9ICcnO1xyXG5cdFx0dmFyIG1pbnV0ZTtcclxuXHRcdHZhciBzbG90Q291bnQgPSBNYXRoLm1heCggMSwgKCBjb25maWcuZW5kIC0gY29uZmlnLnN0YXJ0ICkgLyBjb25maWcuc3RlcCApO1xyXG5cdFx0dmFyIHZpc2libGVIb3VycyA9IE1hdGgubWF4KCAxLCAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKSAvIDYwICk7XHJcblx0XHR2YXIgYXhpc0ZvbnRTaXplID0gY2xhbXAoIE1hdGgucm91bmQoIDE2IC0gKCB2aXNpYmxlSG91cnMgKiAwLjI1ICkgKSwgMTAsIDEzICk7XHJcblx0XHR2YXIgYXhpc0ZvbnRXZWlnaHQgPSB2aXNpYmxlSG91cnMgPD0gMTAgPyA1NTAgOiA0MDA7XHJcblx0XHR2YXIgZmlyc3RIb3VyID0gTWF0aC5jZWlsKCBjb25maWcuc3RhcnQgLyA2MCApICogNjA7XHJcblxyXG5cdFx0JGdyaWQuY3NzKCAnLS13cGJjLXRzLXNsb3QtY291bnQnLCBzbG90Q291bnQgKTtcclxuXHRcdCRncmlkLmNzcyggJy0td3BiYy10cy1heGlzLWxhYmVsLXNpemUnLCBheGlzRm9udFNpemUgKyAncHgnICk7XHJcblx0XHQkZ3JpZC5jc3MoICctLXdwYmMtdHMtYXhpcy1sYWJlbC13ZWlnaHQnLCBheGlzRm9udFdlaWdodCApO1xyXG5cclxuXHRcdGZvciAoIG1pbnV0ZSA9IGZpcnN0SG91cjsgbWludXRlIDw9IGNvbmZpZy5lbmQ7IG1pbnV0ZSArPSA2MCApIHtcclxuXHRcdFx0aHRtbCArPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX3RzX2F4aXNfbGFiZWxcIiBzdHlsZT1cImxlZnQ6JyArIHBlcmNlbnRfZm9yX21pbnV0ZSggbWludXRlLCBjb25maWcgKSArICclO1wiPicgKyBtaW51dGVzX3RvX3RpbWUoIG1pbnV0ZSApICsgJzwvc3Bhbj4nO1xyXG5cdFx0XHRodG1sICs9ICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYXhpc190aWNrXCIgc3R5bGU9XCJsZWZ0OicgKyBwZXJjZW50X2Zvcl9taW51dGUoIG1pbnV0ZSwgY29uZmlnICkgKyAnJTtcIj48L3NwYW4+JztcclxuXHRcdFx0aWYgKCBtaW51dGUgKyAzMCA8IGNvbmZpZy5lbmQgKSB7XHJcblx0XHRcdFx0aHRtbCArPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX3RzX2F4aXNfZG90XCIgc3R5bGU9XCJsZWZ0OicgKyBwZXJjZW50X2Zvcl9taW51dGUoIG1pbnV0ZSArIDMwLCBjb25maWcgKSArICclO1wiPjwvc3Bhbj4nO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICggbWludXRlID0gY29uZmlnLnN0YXJ0ICsgY29uZmlnLnN0ZXA7IG1pbnV0ZSA8IGNvbmZpZy5lbmQ7IG1pbnV0ZSArPSBjb25maWcuc3RlcCApIHtcclxuXHRcdFx0aWYgKCAwID09PSBtaW51dGUgJSA2MCB8fCAzMCA9PT0gbWludXRlICUgNjAgKSB7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHRcdFx0aHRtbCArPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX3RzX2F4aXNfbWlub3JcIiBzdHlsZT1cImxlZnQ6JyArIHBlcmNlbnRfZm9yX21pbnV0ZSggbWludXRlLCBjb25maWcgKSArICclO1wiPjwvc3Bhbj4nO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRheGlzLmh0bWwoIGh0bWwgKTtcclxuXHRcdHJlZnJlc2hfZmxvYXRpbmdfaGVhZGVyKCAkZ3JpZC5jbG9zZXN0KCAnLndwYmNfdHNfcGFnZScgKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcG9zaXRpb25fYmFycyggJGdyaWQgKSB7XHJcblx0XHR2YXIgY29uZmlnID0gZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApO1xyXG5cclxuXHRcdCRncmlkLmZpbmQoICcud3BiY190c19iYXInICkuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgJGJhciA9ICQoIHRoaXMgKTtcclxuXHRcdFx0dmFyIHN0YXJ0ID0gcGFyc2VJbnQoICRiYXIuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcgKSwgMTAgKTtcclxuXHRcdFx0dmFyIGVuZCA9IHBhcnNlSW50KCAkYmFyLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApLCAxMCApO1xyXG5cdFx0XHR2YXIgdmlzaWJsZVN0YXJ0ID0gY2xhbXAoIHN0YXJ0LCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0dmFyIHZpc2libGVFbmQgPSBjbGFtcCggZW5kLCBjb25maWcuc3RhcnQsIGNvbmZpZy5lbmQgKTtcclxuXHRcdFx0dmFyIGxlZnQ7XHJcblx0XHRcdHZhciB3aWR0aDtcclxuXHJcblx0XHRcdGlmICggdmlzaWJsZUVuZCA8PSBjb25maWcuc3RhcnQgfHwgdmlzaWJsZVN0YXJ0ID49IGNvbmZpZy5lbmQgfHwgdmlzaWJsZVN0YXJ0ID49IHZpc2libGVFbmQgKSB7XHJcblx0XHRcdFx0JGJhci5oaWRlKCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZWZ0ID0gcGVyY2VudF9mb3JfbWludXRlKCB2aXNpYmxlU3RhcnQsIGNvbmZpZyApO1xyXG5cdFx0XHR3aWR0aCA9IHBlcmNlbnRfZm9yX21pbnV0ZSggdmlzaWJsZUVuZCwgY29uZmlnICkgLSBsZWZ0O1xyXG5cdFx0XHQkYmFyLnNob3coKS5jc3MoIHsgbGVmdDogbGVmdCArICclJywgd2lkdGg6IHdpZHRoICsgJyUnIH0gKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbmRlcl90aW1lbGluZV9iYXJzKCAkcGFnZSwgYmFycyApIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfcGFnZSB8fCB7fTtcclxuXHRcdHZhciBsYWJlbHMgPSBzZXR0aW5ncy5pMThuIHx8IHt9O1xyXG5cclxuXHRcdCRwYWdlLmZpbmQoICcud3BiY190c19iYXJbZGF0YS13cGJjLXRzLXNvdXJjZT1cInNlcnZlclwiXScgKS5yZW1vdmUoKTtcclxuXHJcblx0XHQkLmVhY2goIGJhcnMgfHwge30sIGZ1bmN0aW9uICggZGF0ZSwgcmVzb3VyY2VzICkge1xyXG5cdFx0XHR2YXIgJHJvdyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLWRhdGU9XCInICsgZGF0ZSArICdcIl0nICk7XHJcblxyXG5cdFx0XHRpZiAoICEgJHJvdy5sZW5ndGggfHwgISByZXNvdXJjZXMgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkLmVhY2goIHJlc291cmNlcywgZnVuY3Rpb24gKCByZXNvdXJjZUlkLCByZXNvdXJjZUJhcnMgKSB7XHJcblx0XHRcdFx0JC5lYWNoKCByZXNvdXJjZUJhcnMgfHwgW10sIGZ1bmN0aW9uICggaW5kZXgsIGludGVydmFsICkge1xyXG5cdFx0XHRcdFx0dmFyIHR5cGUgPSAnYmxvY2tlZCcgPT09IGludGVydmFsLnR5cGUgPyAnYmxvY2tlZCcgOiAoICd1bmF2YWlsYWJsZV9kYXknID09PSBpbnRlcnZhbC50eXBlID8gJ3VuYXZhaWxhYmxlX2RheScgOiAoICd3b3JraW5nX3RpbWUnID09PSBpbnRlcnZhbC50eXBlID8gJ3dvcmtpbmdfdGltZScgOiAnYm9va2VkJyApICk7XHJcblx0XHRcdFx0XHR2YXIgaWNvbiA9ICdib29rZWQnID09PSB0eXBlID8gJ3dwYmNfaWNuX2xvY2snIDogKCAndW5hdmFpbGFibGVfZGF5JyA9PT0gdHlwZSA/ICd3cGJjX2ljbl9ldmVudF9idXN5JyA6ICggJ3dvcmtpbmdfdGltZScgPT09IHR5cGUgPyAnd3BiYy1iaS1jbG9jay1oaXN0b3J5JyA6ICd3cGJjX2ljbl9kb19ub3RfZGlzdHVyYl9vbicgKSApO1xyXG5cdFx0XHRcdFx0dmFyIHRvb2x0aXAgPSBpbnRlcnZhbC50b29sdGlwIHx8ICcnO1xyXG5cdFx0XHRcdFx0dmFyICRiYXIgPSAkKCAnPGRpdiBjbGFzcz1cIndwYmNfdHNfYmFyXCIgZGF0YS13cGJjLXRzLXNvdXJjZT1cInNlcnZlclwiPjwvZGl2PicgKTtcclxuXHRcdFx0XHRcdHZhciAkaWNvbldyYXA7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAnYm9va2VkJyA9PT0gdHlwZSAmJiBpbnRlcnZhbC5ib29raW5nX3VybCApIHtcclxuXHRcdFx0XHRcdFx0JGljb25XcmFwID0gJCggJzxhIGNsYXNzPVwid3BiY190c19ib29raW5nX2xpbmsgdG9vbHRpcF90b3BcIiByZWw9XCJub29wZW5lciBub3JlZmVycmVyXCI+PHNwYW4+PC9zcGFuPjwvYT4nICk7XHJcblx0XHRcdFx0XHRcdCRpY29uV3JhcFxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnaHJlZicsIGludGVydmFsLmJvb2tpbmdfdXJsIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1ib29raW5nLWlkJywgaW50ZXJ2YWwuYm9va2luZ19pZCB8fCAnJyApXHJcblx0XHRcdFx0XHRcdFx0LmF0dHIoICdhcmlhLWxhYmVsJywgKCBsYWJlbHMub3Blbl9ib29raW5nIHx8ICdPcGVuIGJvb2tpbmcgaW4gQm9va2luZyBMaXN0aW5nJyApICsgKCBpbnRlcnZhbC5ib29raW5nX2lkID8gJzogJyArIGludGVydmFsLmJvb2tpbmdfaWQgOiAnJyApIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnLCB0b29sdGlwIHx8ICcnICk7XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCAoICd1bmF2YWlsYWJsZV9kYXknID09PSB0eXBlIHx8ICd3b3JraW5nX3RpbWUnID09PSB0eXBlICkgJiYgaW50ZXJ2YWwucnVsZV91cmwgKSB7XHJcblx0XHRcdFx0XHRcdCRpY29uV3JhcCA9ICQoICc8YSBjbGFzcz1cIndwYmNfdHNfcnVsZV9saW5rIHRvb2x0aXBfdG9wXCI+PHNwYW4+PC9zcGFuPjwvYT4nICk7XHJcblx0XHRcdFx0XHRcdCRpY29uV3JhcFxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnaHJlZicsIGludGVydmFsLnJ1bGVfdXJsIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1ydWxlLXNvdXJjZScsIGludGVydmFsLnJ1bGVfc291cmNlIHx8IGludGVydmFsLnNvdXJjZV90eXBlIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0XHQuYXR0ciggJ2FyaWEtbGFiZWwnLCAoIGxhYmVscy5vcGVuX2F2YWlsYWJpbGl0eV9ydWxlIHx8ICdPcGVuIGF2YWlsYWJpbGl0eSBzZXR0aW5ncycgKSArICggaW50ZXJ2YWwuc3RhdHVzX3RpdGxlID8gJzogJyArIGludGVydmFsLnN0YXR1c190aXRsZSA6ICcnICkgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS1vcmlnaW5hbC10aXRsZScsIHRvb2x0aXAgfHwgJycgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdCRpY29uV3JhcCA9ICQoICc8c3BhbiBjbGFzcz1cIndwYmNfdHNfYmFyX2ljb24gdG9vbHRpcF90b3BcIj48c3Bhbj48L3NwYW4+PC9zcGFuPicgKVxyXG5cdFx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS1vcmlnaW5hbC10aXRsZScsIHRvb2x0aXAgfHwgJycgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQkYmFyXHJcblx0XHRcdFx0XHRcdC5hZGRDbGFzcyggJ3dwYmNfdHNfYmFyXycgKyB0eXBlIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnLCBwYXJzZUludCggaW50ZXJ2YWwuc3RhcnRfbWludXRlLCAxMCApIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJywgcGFyc2VJbnQoIGludGVydmFsLmVuZF9taW51dGUsIDEwICkgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1yZXNvdXJjZS1pZCcsIHJlc291cmNlSWQgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1ib29raW5nLWlkJywgaW50ZXJ2YWwuYm9va2luZ19pZCB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctdXJsJywgaW50ZXJ2YWwuYm9va2luZ191cmwgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1ydWxlLXVybCcsIGludGVydmFsLnJ1bGVfdXJsIHx8ICcnIClcclxuXHRcdFx0XHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtdW5hdmFpbGFibGUtaWQnLCBpbnRlcnZhbC51bmF2YWlsYWJsZV90aW1lc2xvdF9pZCB8fCAnJyApXHJcblx0XHRcdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLXNvdXJjZS10eXBlJywgaW50ZXJ2YWwuc291cmNlX3R5cGUgfHwgJycgKVxyXG5cdFx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1lZGl0YWJsZScsIGZhbHNlID09PSBpbnRlcnZhbC5lZGl0YWJsZSA/ICcwJyA6ICcxJyApO1xyXG5cdFx0XHRcdFx0aWYgKCB0b29sdGlwICkge1xyXG5cdFx0XHRcdFx0XHQkYmFyLmF0dHIoICdkYXRhLW9yaWdpbmFsLXRpdGxlJywgdG9vbHRpcCApLmFkZENsYXNzKCAndG9vbHRpcF90b3AnICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHQkaWNvbldyYXAuZmluZCggJ3NwYW4nICkuYWRkQ2xhc3MoIGljb24gKTtcclxuXHRcdFx0XHRcdCRiYXIuYXBwZW5kKCAkaWNvbldyYXAgKTtcclxuXHRcdFx0XHRcdCRyb3cuZmluZCggJy53cGJjX3RzX2xhbmUnICkuYXBwZW5kKCAkYmFyICk7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0cG9zaXRpb25fYmFycyggJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICkgKTtcclxuXHRcdHJlZnJlc2hfYmFyX3Rvb2x0aXBzKCAkcGFnZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSB3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3BhZ2UgfHwge307XHJcblx0XHR2YXIgJGRhdGVSYW5nZSA9IGdldF9jb250cm9sKCAkcGFnZSwgJ2RhdGVfcmFuZ2UnICk7XHJcblx0XHR2YXIgbGFiZWxzID0gc2V0dGluZ3MuaTE4biB8fCB7fTtcclxuXHRcdHZhciByZXF1ZXN0SWQ7XHJcblxyXG5cdFx0aWYgKCAhIHNldHRpbmdzLmFqYXhfdXJsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBhY3RpdmVMb2FkUmVxdWVzdCAmJiBhY3RpdmVMb2FkUmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0ICkge1xyXG5cdFx0XHRhY3RpdmVMb2FkUmVxdWVzdC5hYm9ydCgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJlcXVlc3RJZCA9ICsrYWN0aXZlTG9hZFJlcXVlc3RJZDtcclxuXHRcdHNldF90aW1lbGluZV9sb2FkaW5nKCAkcGFnZSwgdHJ1ZSwgbGFiZWxzLmxvYWRpbmcgfHwgJ0xvYWRpbmcnICk7XHJcblxyXG5cdFx0YWN0aXZlTG9hZFJlcXVlc3QgPSAkLnBvc3QoIHNldHRpbmdzLmFqYXhfdXJsLCB7XHJcblx0XHRcdGFjdGlvbjogJ1dQQkNfQUpYX0FWQUlMQUJJTElUWV9USU1FU0xPVFNfUkVBRCcsXHJcblx0XHRcdHJlc291cmNlX2lkOiBnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoKSxcclxuXHRcdFx0ZGF0ZV9zdGFydDogJGRhdGVSYW5nZS5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApLFxyXG5cdFx0XHRkYXRlX2VuZDogJGRhdGVSYW5nZS5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcgKVxyXG5cdFx0fSApLmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2UgKSB7XHJcblx0XHRcdGlmICggcmVxdWVzdElkICE9PSBhY3RpdmVMb2FkUmVxdWVzdElkICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHJlc3BvbnNlICYmIHJlc3BvbnNlLnN1Y2Nlc3MgJiYgcmVzcG9uc2UuZGF0YSApIHtcclxuXHRcdFx0XHRyZW5kZXJfdGltZWxpbmVfYmFycyggJHBhZ2UsIHJlc3BvbnNlLmRhdGEuYmFycyApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCB4aHIsIHRleHRTdGF0dXMgKSB7XHJcblx0XHRcdGlmICggJ2Fib3J0JyAhPT0gdGV4dFN0YXR1cyAmJiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zYXZlX2Vycm9yIHx8ICdVbmFibGUgdG8gc2F2ZSB0aW1lLXNsb3QgYXZhaWxhYmlsaXR5LicsICdlcnJvcicsIDUwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApLmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIHJlcXVlc3RJZCA9PT0gYWN0aXZlTG9hZFJlcXVlc3RJZCApIHtcclxuXHRcdFx0XHRzZXRfdGltZWxpbmVfbG9hZGluZyggJHBhZ2UsIGZhbHNlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9yb3dzX2JldHdlZW4oICRwYWdlLCBzdGFydFJvdywgZW5kUm93ICkge1xyXG5cdFx0dmFyIHN0YXJ0SW5kZXggPSBwYXJzZUludCggc3RhcnRSb3csIDEwICk7XHJcblx0XHR2YXIgZW5kSW5kZXggPSBwYXJzZUludCggZW5kUm93LCAxMCApO1xyXG5cdFx0dmFyIG1pbiA9IE1hdGgubWluKCBzdGFydEluZGV4LCBlbmRJbmRleCApO1xyXG5cdFx0dmFyIG1heCA9IE1hdGgubWF4KCBzdGFydEluZGV4LCBlbmRJbmRleCApO1xyXG5cdFx0dmFyIHJvd3MgPSBbXTtcclxuXHRcdHZhciBpO1xyXG5cclxuXHRcdGZvciAoIGkgPSBtaW47IGkgPD0gbWF4OyBpKysgKSB7XHJcblx0XHRcdGlmICggJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIGkgKyAnXCJdJyApLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyb3dzLnB1c2goIFN0cmluZyggaSApICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcm93cztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJvd19sYWJlbCggJHBhZ2UsIHJvd0lkICkge1xyXG5cdFx0cmV0dXJuICQudHJpbSggJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXSAud3BiY190c19yb3dfbGFiZWxfdGV4dCcgKS50ZXh0KCkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVzY2FwZV9odG1sKCB2YWx1ZSApIHtcclxuXHRcdHJldHVybiAkKCAnPGRpdiAvPicgKS50ZXh0KCB2YWx1ZSApLmh0bWwoKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBvc2l0aW9uX2xvYWRpbmdfb3ZlcmxheSggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGNhcmQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfdGltZWxpbmVfY2FyZCcgKS5maXJzdCgpO1xyXG5cdFx0dmFyIGNhcmQgPSAkY2FyZC5nZXQoIDAgKTtcclxuXHRcdHZhciAkb3ZlcmxheSA9ICRjYXJkLmZpbmQoICcud3BiY190c19sb2FkaW5nX292ZXJsYXknICkuZmlyc3QoKTtcclxuXHJcblx0XHRpZiAoICEgY2FyZCB8fCAhICRvdmVybGF5Lmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRvdmVybGF5LmNzcygge1xyXG5cdFx0XHR3aWR0aDogY2FyZC5jbGllbnRXaWR0aCArICdweCcsXHJcblx0XHRcdGhlaWdodDogY2FyZC5jbGllbnRIZWlnaHQgKyAncHgnLFxyXG5cdFx0XHR0cmFuc2Zvcm06ICd0cmFuc2xhdGUoJyArIGNhcmQuc2Nyb2xsTGVmdCArICdweCwnICsgY2FyZC5zY3JvbGxUb3AgKyAncHgpJ1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCBpc0xvYWRpbmcsIGxhYmVsICkge1xyXG5cdFx0dmFyICRjYXJkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3RpbWVsaW5lX2NhcmQnICk7XHJcblx0XHR2YXIgJG92ZXJsYXk7XHJcblxyXG5cdFx0JGNhcmRcclxuXHRcdFx0LnRvZ2dsZUNsYXNzKCAnaXMtbG9hZGluZycsICEhIGlzTG9hZGluZyApXHJcblx0XHRcdC5maW5kKCAnLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApXHJcblx0XHRcdC5hdHRyKCAnYXJpYS1oaWRkZW4nLCBpc0xvYWRpbmcgPyAnZmFsc2UnIDogJ3RydWUnICk7XHJcblxyXG5cdFx0aWYgKCBsYWJlbCApIHtcclxuXHRcdFx0JG92ZXJsYXkgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfbG9hZGluZ19vdmVybGF5JyApLmZpcnN0KCk7XHJcblx0XHRcdCRvdmVybGF5LmZpbmQoICcud3BiY19zcGluc19sb2FkaW5nX2NvbnRhaW5lciA+IHNwYW4nICkudGV4dCggbGFiZWwgKyAnLi4uJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNMb2FkaW5nICkge1xyXG5cdFx0XHRwb3NpdGlvbl9sb2FkaW5nX292ZXJsYXkoICRwYWdlICk7XHJcblx0XHRcdCRjYXJkLm9mZiggJ3Njcm9sbC53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScgKS5vbiggJ3Njcm9sbC53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRwb3NpdGlvbl9sb2FkaW5nX292ZXJsYXkoICRwYWdlICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdCRjYXJkLm9mZiggJ3Njcm9sbC53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScgKTtcclxuXHRcdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX2xvYWRpbmdfb3ZlcmxheScgKS5jc3MoIHtcclxuXHRcdFx0XHR3aWR0aDogJycsXHJcblx0XHRcdFx0aGVpZ2h0OiAnJyxcclxuXHRcdFx0XHR0cmFuc2Zvcm06ICcnXHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9hY3Rpb25fYnV0dG9uc19idXN5KCAkcGFnZSwgaXNCdXN5ICkge1xyXG5cdFx0dmFyICRzY29wZSA9ICRwYWdlLmFkZCggJHBhZ2UuY2xvc2VzdCggJy5tb2RhbCcgKSApLmFkZCggJCggJy53cGJjX3RzX3JpZ2h0YmFyX3BhbmVscycgKSApO1xyXG5cclxuXHRcdCRzY29wZVxyXG5cdFx0XHQuZmluZCggJ1tkYXRhLXdwYmMtdHMtY29tbWFuZF0sIC53cGJjX3RzX2NsZWFyX3NlbGVjdGlvbicgKVxyXG5cdFx0XHQudG9nZ2xlQ2xhc3MoICdkaXNhYmxlZCcsICEhIGlzQnVzeSApXHJcblx0XHRcdC5hdHRyKCAnYXJpYS1kaXNhYmxlZCcsIGlzQnVzeSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGlzX2Z1bGxfcGFnZV9jb21wb25lbnQoICRwYWdlICkge1xyXG5cdFx0cmV0dXJuIChcclxuXHRcdFx0ISAkcGFnZS5oYXNDbGFzcyggJ3dwYmNfdHNfcG9wdXAnIClcclxuXHRcdFx0JiYgJHBhZ2UuY2xvc2VzdCggJy53cGJjX2FkbWluX3BhZ2VfX3RhYl9fdGltZV9zbG90c19hdmFpbGFiaWxpdHknICkubGVuZ3RoID4gMFxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9mbG9hdGluZ19oZWFkZXJfbmFtZXNwYWNlKCAkcGFnZSApIHtcclxuXHRcdHJldHVybiAnLndwYmNfdHNfZmxvYXRpbmdfJyArIFN0cmluZyggJHBhZ2UuYXR0ciggJ2RhdGEtd3BiYy10cy1pZC1wcmVmaXgnICkgfHwgJ3BhZ2UnICkucmVwbGFjZSggL1teXFx3XS9nLCAnXycgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF90b3BfbmF2X2JvdHRvbSgpIHtcclxuXHRcdHZhciAkdG9wTmF2ID0gJCggJy53cGJjX3VpX2VsX190b3BfbmF2OnZpc2libGUnICkuZmlyc3QoKTtcclxuXHRcdHZhciByZWN0O1xyXG5cclxuXHRcdGlmICggISAkdG9wTmF2Lmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIDA7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVjdCA9ICR0b3BOYXYuZ2V0KCAwICkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHRyZXR1cm4gTWF0aC5tYXgoIDAsIE1hdGgucm91bmQoIHJlY3QuYm90dG9tICkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVuc3VyZV9mbG9hdGluZ19oZWFkZXIoICRwYWdlICkge1xyXG5cdFx0dmFyICRmbG9hdGluZyA9ICRwYWdlLmNoaWxkcmVuKCAnLndwYmNfdHNfZmxvYXRpbmdfaGVhZGVyJyApO1xyXG5cdFx0dmFyICRoZWFkZXI7XHJcblxyXG5cdFx0aWYgKCAkZmxvYXRpbmcubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gJGZsb2F0aW5nO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRoZWFkZXIgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCA+IC53cGJjX3RzX2hlYWRlcicgKS5maXJzdCgpO1xyXG5cdFx0JGZsb2F0aW5nID0gJCggJzxkaXYgY2xhc3M9XCJ3cGJjX3RzX2Zsb2F0aW5nX2hlYWRlclwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvZGl2PicgKS5hcHBlbmRUbyggJHBhZ2UgKTtcclxuXHJcblx0XHRpZiAoICRoZWFkZXIubGVuZ3RoICkge1xyXG5cdFx0XHQkZmxvYXRpbmcuYXBwZW5kKCAkaGVhZGVyLmNsb25lKCBmYWxzZSwgZmFsc2UgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAkZmxvYXRpbmc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGZsb2F0aW5nO1xyXG5cdFx0dmFyICRjYXJkO1xyXG5cdFx0dmFyICRncmlkO1xyXG5cdFx0dmFyICRoZWFkZXI7XHJcblx0XHR2YXIgY2FyZDtcclxuXHRcdHZhciBjYXJkUmVjdDtcclxuXHRcdHZhciBoZWFkZXJSZWN0O1xyXG5cdFx0dmFyIHRvcE9mZnNldDtcclxuXHRcdHZhciBzaG91bGRTaG93O1xyXG5cclxuXHRcdGlmICggISBpc19mdWxsX3BhZ2VfY29tcG9uZW50KCAkcGFnZSApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JGZsb2F0aW5nID0gZW5zdXJlX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHRcdCRjYXJkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3RpbWVsaW5lX2NhcmQnICkuZmlyc3QoKTtcclxuXHRcdCRncmlkID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICkuZmlyc3QoKTtcclxuXHRcdCRoZWFkZXIgPSAkZ3JpZC5maW5kKCAnPiAud3BiY190c19oZWFkZXInICkuZmlyc3QoKTtcclxuXHRcdGNhcmQgPSAkY2FyZC5nZXQoIDAgKTtcclxuXHJcblx0XHRpZiAoICEgY2FyZCB8fCAhICRncmlkLmxlbmd0aCB8fCAhICRoZWFkZXIubGVuZ3RoICkge1xyXG5cdFx0XHQkZmxvYXRpbmcucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y2FyZFJlY3QgPSBjYXJkLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG5cdFx0aGVhZGVyUmVjdCA9ICRoZWFkZXIuZ2V0KCAwICkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHR0b3BPZmZzZXQgPSBnZXRfdG9wX25hdl9ib3R0b20oKTtcclxuXHRcdHNob3VsZFNob3cgPSAoIGhlYWRlclJlY3QudG9wIDwgdG9wT2Zmc2V0ICkgJiYgKCBjYXJkUmVjdC5ib3R0b20gPiAoIHRvcE9mZnNldCArIGhlYWRlclJlY3QuaGVpZ2h0ICkgKTtcclxuXHJcblx0XHRpZiAoICEgc2hvdWxkU2hvdyApIHtcclxuXHRcdFx0JGZsb2F0aW5nLnJlbW92ZUNsYXNzKCAnaXMtdmlzaWJsZScgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRmbG9hdGluZ1xyXG5cdFx0XHQuY3NzKCB7XHJcblx0XHRcdFx0dG9wOiB0b3BPZmZzZXQgKyAncHgnLFxyXG5cdFx0XHRcdGxlZnQ6IE1hdGgucm91bmQoIGNhcmRSZWN0LmxlZnQgKSArICdweCcsXHJcblx0XHRcdFx0d2lkdGg6IE1hdGgucm91bmQoIGNhcmQuY2xpZW50V2lkdGggKSArICdweCcsXHJcblx0XHRcdFx0Jy0td3BiYy10cy1mbG9hdGluZy1zY3JvbGwtbGVmdCc6ICggLTEgKiBjYXJkLnNjcm9sbExlZnQgKSArICdweCcsXHJcblx0XHRcdFx0Jy0td3BiYy10cy1mbG9hdGluZy1zY3JvbGwtbGVmdC1hYnMnOiBjYXJkLnNjcm9sbExlZnQgKyAncHgnXHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuYWRkQ2xhc3MoICdpcy12aXNpYmxlJyApO1xyXG5cclxuXHRcdCRmbG9hdGluZy5jaGlsZHJlbiggJy53cGJjX3RzX2hlYWRlcicgKS5jc3MoICd3aWR0aCcsIE1hdGgucm91bmQoICRncmlkLm91dGVyV2lkdGgoKSApICsgJ3B4JyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gcmVmcmVzaF9mbG9hdGluZ19oZWFkZXIoICRwYWdlICkge1xyXG5cdFx0dmFyICRmbG9hdGluZztcclxuXHRcdHZhciAkaGVhZGVyO1xyXG5cclxuXHRcdGlmICggISAkcGFnZSB8fCAhICRwYWdlLmxlbmd0aCB8fCAhIGlzX2Z1bGxfcGFnZV9jb21wb25lbnQoICRwYWdlICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkZmxvYXRpbmcgPSAkcGFnZS5jaGlsZHJlbiggJy53cGJjX3RzX2Zsb2F0aW5nX2hlYWRlcicgKTtcclxuXHJcblx0XHRpZiAoICEgJGZsb2F0aW5nLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRoZWFkZXIgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCA+IC53cGJjX3RzX2hlYWRlcicgKS5maXJzdCgpO1xyXG5cdFx0JGZsb2F0aW5nLmVtcHR5KCk7XHJcblxyXG5cdFx0aWYgKCAkaGVhZGVyLmxlbmd0aCApIHtcclxuXHRcdFx0JGZsb2F0aW5nLmFwcGVuZCggJGhlYWRlci5jbG9uZSggZmFsc2UsIGZhbHNlICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGJpbmRfZmxvYXRpbmdfaGVhZGVyKCAkcGFnZSApIHtcclxuXHRcdHZhciBuYW1lc3BhY2U7XHJcblxyXG5cdFx0aWYgKCAhIGlzX2Z1bGxfcGFnZV9jb21wb25lbnQoICRwYWdlICkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRuYW1lc3BhY2UgPSBnZXRfZmxvYXRpbmdfaGVhZGVyX25hbWVzcGFjZSggJHBhZ2UgKTtcclxuXHRcdGVuc3VyZV9mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblxyXG5cdFx0JCggd2luZG93IClcclxuXHRcdFx0Lm9mZiggJ3Njcm9sbCcgKyBuYW1lc3BhY2UgKyAnIHJlc2l6ZScgKyBuYW1lc3BhY2UgKVxyXG5cdFx0XHQub24oICdzY3JvbGwnICsgbmFtZXNwYWNlICsgJyByZXNpemUnICsgbmFtZXNwYWNlLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0c3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfdGltZWxpbmVfY2FyZCcgKVxyXG5cdFx0XHQub2ZmKCAnc2Nyb2xsJyArIG5hbWVzcGFjZSApXHJcblx0XHRcdC5vbiggJ3Njcm9sbCcgKyBuYW1lc3BhY2UsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50IClcclxuXHRcdFx0Lm9mZiggJ2NsaWNrJyArIG5hbWVzcGFjZSApXHJcblx0XHRcdC5vbiggJ2NsaWNrJyArIG5hbWVzcGFjZSwgJy53cGJjX3VpX190b3BfbmF2X19idG5fc2hvd19sZWZ0X3ZlcnRpY2FsX25hdiwgLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9zaG93X3JpZ2h0X3ZlcnRpY2FsX25hdiwgLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9mdWxsX3NjcmVlbiwgLndwYmNfdWlfX3RvcF9uYXZfX2J0bl9ub3JtYWxfc2NyZWVuJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHdpbmRvdy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRzeW5jX2Zsb2F0aW5nX2hlYWRlciggJHBhZ2UgKTtcclxuXHRcdFx0XHR9LCA4MCApO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0c3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZWZyZXNoX2Jhcl90b29sdGlwcyggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJHRvb2x0aXBTY29wZSA9ICRwYWdlLmZpbmQoICcud3BiY190c190aW1lbGluZV9jYXJkJyApLmZpcnN0KCk7XHJcblx0XHR2YXIgdG9vbHRpcFNjb3BlSWQ7XHJcblx0XHR2YXIgZGlkSW5pdGlhbGl6ZVRvb2x0aXBzID0gZmFsc2U7XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX2Jhci50b29sdGlwX3RvcCwgLndwYmNfdHNfYmFyX2ljb24udG9vbHRpcF90b3AsIC53cGJjX3RzX2Jvb2tpbmdfbGluay50b29sdGlwX3RvcCwgLndwYmNfdHNfcnVsZV9saW5rLnRvb2x0aXBfdG9wJyApLmVhY2goIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0aWYgKCB0aGlzLl90aXBweSApIHtcclxuXHRcdFx0XHR0aGlzLl90aXBweS5kZXN0cm95KCk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cud3BiY19kZWZpbmVfdGlwcHlfdG9vbHRpcHMgKSB7XHJcblx0XHRcdGlmICggJHRvb2x0aXBTY29wZS5sZW5ndGggKSB7XHJcblx0XHRcdFx0dG9vbHRpcFNjb3BlSWQgPSAkdG9vbHRpcFNjb3BlLmF0dHIoICdpZCcgKTtcclxuXHJcblx0XHRcdFx0aWYgKCAhIHRvb2x0aXBTY29wZUlkICkge1xyXG5cdFx0XHRcdFx0dG9vbHRpcFNjb3BlSWQgPSAnd3BiY190c190aW1lbGluZV90b29sdGlwX3Njb3BlXycgKyBuZXh0VG9vbHRpcFNjb3BlSWQ7XHJcblx0XHRcdFx0XHRuZXh0VG9vbHRpcFNjb3BlSWQrKztcclxuXHRcdFx0XHRcdCR0b29sdGlwU2NvcGUuYXR0ciggJ2lkJywgdG9vbHRpcFNjb3BlSWQgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGRpZEluaXRpYWxpemVUb29sdGlwcyA9IHdpbmRvdy53cGJjX2RlZmluZV90aXBweV90b29sdGlwcyggJyMnICsgdG9vbHRpcFNjb3BlSWQgKyAnICcgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBkaWRJbml0aWFsaXplVG9vbHRpcHMgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJ1tkYXRhLW9yaWdpbmFsLXRpdGxlXScgKS5lYWNoKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggISAkKCB0aGlzICkuYXR0ciggJ3RpdGxlJyApICkge1xyXG5cdFx0XHRcdCQoIHRoaXMgKS5hdHRyKCAndGl0bGUnLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnICkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfYm9va2luZ19saXN0aW5nX3NlYXJjaF9hdmFpbGFibGUoKSB7XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93LndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtc1xyXG5cdFx0XHQmJiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2FqeF9ib29raW5nX2xpc3RpbmdcclxuXHRcdFx0JiYgJCggJyN3cGJjX3NlYXJjaF9maWVsZCcgKS5sZW5ndGhcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbG9zZV90aW1lX3Nsb3RzX3BvcHVwKCAkcGFnZSApIHtcclxuXHRcdHZhciAkbW9kYWwgPSAkcGFnZS5jbG9zZXN0KCAnLndwYmNfbW9kYWxfX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfX3NlY3Rpb24sIC5tb2RhbCcgKTtcclxuXHJcblx0XHRpZiAoICEgJG1vZGFsLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICRtb2RhbC53cGJjX215X21vZGFsICkge1xyXG5cdFx0XHQkbW9kYWwud3BiY19teV9tb2RhbCggJ2hpZGUnICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAkbW9kYWwubW9kYWwgKSB7XHJcblx0XHRcdCRtb2RhbC5tb2RhbCggJ2hpZGUnICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkbW9kYWwuZmluZCggJ1tkYXRhLWRpc21pc3M9XCJtb2RhbFwiXScgKS5maXJzdCgpLnRyaWdnZXIoICdjbGljaycgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNlYXJjaF9ib29raW5nX2luX2N1cnJlbnRfbGlzdGluZyggJHBhZ2UsIGJvb2tpbmdJZCApIHtcclxuXHRcdHZhciBrZXl3b3JkID0gJ2lkOicgKyBwYXJzZUludCggYm9va2luZ0lkLCAxMCApO1xyXG5cclxuXHRcdCQoICcjd3BiY19zZWFyY2hfZmllbGQnICkudmFsKCBrZXl3b3JkICk7XHJcblx0XHRjbG9zZV90aW1lX3Nsb3RzX3BvcHVwKCAkcGFnZSApO1xyXG5cdFx0d2luZG93LndwYmNfYWp4X2Jvb2tpbmdfc2VuZF9zZWFyY2hfcmVxdWVzdF93aXRoX3BhcmFtcygge1xyXG5cdFx0XHQna2V5d29yZCc6IGtleXdvcmQsXHJcblx0XHRcdCdwYWdlX251bSc6IDFcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhhbmRsZV9ib29rZWRfYmFyX2NsaWNrKCAkcGFnZSwgZXZlbnQgKSB7XHJcblx0XHR2YXIgJGJhciA9ICQoIGV2ZW50LmN1cnJlbnRUYXJnZXQgKTtcclxuXHRcdHZhciAkbGluayA9ICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICcud3BiY190c19ib29raW5nX2xpbmsnICk7XHJcblx0XHR2YXIgYm9va2luZ0lkID0gJGJhci5hdHRyKCAnZGF0YS13cGJjLXRzLWJvb2tpbmctaWQnICkgfHwgJGxpbmsuYXR0ciggJ2RhdGEtd3BiYy10cy1ib29raW5nLWlkJyApO1xyXG5cdFx0dmFyIGJvb2tpbmdVcmwgPSAkYmFyLmF0dHIoICdkYXRhLXdwYmMtdHMtYm9va2luZy11cmwnICkgfHwgJGxpbmsuYXR0ciggJ2hyZWYnICk7XHJcblxyXG5cdFx0aWYgKCAhIGJvb2tpbmdJZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfYm9va2luZ19saXN0aW5nX3NlYXJjaF9hdmFpbGFibGUoKSApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHRcdHNlYXJjaF9ib29raW5nX2luX2N1cnJlbnRfbGlzdGluZyggJHBhZ2UsIGJvb2tpbmdJZCApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhICRsaW5rLmxlbmd0aCAmJiBib29raW5nVXJsICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHR3aW5kb3cubG9jYXRpb24uaHJlZiA9IGJvb2tpbmdVcmw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1bmlxdWVfZGF0ZXNfZnJvbV9zZWxlY3Rpb25zKCAkcGFnZSApIHtcclxuXHRcdHZhciBkYXRlcyA9IHt9O1xyXG5cdFx0JC5lYWNoKCBzZWxlY3Rpb25SYW5nZXMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdCQuZWFjaCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0luZGV4LCByb3dJZCApIHtcclxuXHRcdFx0XHR2YXIgbGFiZWwgPSByb3dfbGFiZWwoICRwYWdlLCByb3dJZCApO1xyXG5cdFx0XHRcdGlmICggbGFiZWwgKSB7XHJcblx0XHRcdFx0XHRkYXRlc1sgbGFiZWwgXSA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblx0XHRyZXR1cm4gT2JqZWN0LmtleXMoIGRhdGVzICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfc2VsZWN0aW9uX3BheWxvYWQoICRwYWdlICkge1xyXG5cdFx0dmFyIHBheWxvYWQgPSBbXTtcclxuXHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdHZhciAkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXScgKTtcclxuXHRcdFx0XHR2YXIgZGF0ZSA9ICRyb3cuYXR0ciggJ2RhdGEtd3BiYy10cy1kYXRlJyApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgZGF0ZSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHBheWxvYWQucHVzaCgge1xyXG5cdFx0XHRcdFx0ZGF0ZTogZGF0ZSxcclxuXHRcdFx0XHRcdHN0YXJ0X3NlY29uZDogaXRlbS5zdGFydCAqIDYwLFxyXG5cdFx0XHRcdFx0ZW5kX3NlY29uZDogaXRlbS5lbmQgKiA2MFxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHBheWxvYWQuc29ydCggZnVuY3Rpb24gKCBhLCBiICkge1xyXG5cdFx0XHRpZiAoIGEuZGF0ZSAhPT0gYi5kYXRlICkge1xyXG5cdFx0XHRcdHJldHVybiBhLmRhdGUgPCBiLmRhdGUgPyAtMSA6IDE7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBhLnN0YXJ0X3NlY29uZCAhPT0gYi5zdGFydF9zZWNvbmQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuc3RhcnRfc2Vjb25kIC0gYi5zdGFydF9zZWNvbmQ7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGEuZW5kX3NlY29uZCAtIGIuZW5kX3NlY29uZDtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRyZXR1cm4gcGF5bG9hZDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9hY3RpdmVfYm9va2luZ19zZWxlY3Rpb25fY29udGV4dCggJHBhZ2UgKSB7XHJcblx0XHR2YXIgaXRlbSA9IGFjdGl2ZVNlbGVjdGlvbklkID8gZ2V0X3NlbGVjdGlvbl9ieV9pZCggYWN0aXZlU2VsZWN0aW9uSWQgKSA6IG51bGw7XHJcblx0XHR2YXIgJHJvdztcclxuXHRcdHZhciBkYXRlO1xyXG5cclxuXHRcdGlmICggISBpdGVtICYmIDEgPT09IHNlbGVjdGlvblJhbmdlcy5sZW5ndGggKSB7XHJcblx0XHRcdGl0ZW0gPSBzZWxlY3Rpb25SYW5nZXNbMF07XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGl0ZW0gfHwgISBpdGVtLnJvd3MgfHwgMSAhPT0gaXRlbS5yb3dzLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0JHJvdyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyBpdGVtLnJvd3NbMF0gKyAnXCJdJyApO1xyXG5cdFx0ZGF0ZSA9ICRyb3cuYXR0ciggJ2RhdGEtd3BiYy10cy1kYXRlJyApO1xyXG5cclxuXHRcdGlmICggISBkYXRlICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRyZXNvdXJjZV9pZDogZ2V0X2NvbnRyb2woICRwYWdlLCAncmVzb3VyY2UnICkudmFsKCkgfHwgJycsXHJcblx0XHRcdHNlbGVjdGVkX2RhdGU6IGRhdGUsXHJcblx0XHRcdHNlbGVjdGVkX3RpbWU6IG1pbnV0ZXNfdG9fdGltZSggaXRlbS5zdGFydCApICsgJyAtICcgKyBtaW51dGVzX3RvX3RpbWUoIGl0ZW0uZW5kICksXHJcblx0XHRcdHN0YXJ0X3NlY29uZDogaXRlbS5zdGFydCAqIDYwLFxyXG5cdFx0XHRlbmRfc2Vjb25kOiBpdGVtLmVuZCAqIDYwXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY3JlYXRlX2Jvb2tpbmdfZnJvbV9hY3RpdmVfc2VsZWN0aW9uKCAkcGFnZSApIHtcclxuXHRcdHZhciBzZXR0aW5ncyA9IHdpbmRvdy53cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfcGFnZSB8fCB7fTtcclxuXHRcdHZhciBsYWJlbHMgPSBzZXR0aW5ncy5pMThuIHx8IHt9O1xyXG5cdFx0dmFyIGNvbnRleHQgPSBnZXRfYWN0aXZlX2Jvb2tpbmdfc2VsZWN0aW9uX2NvbnRleHQoICRwYWdlICk7XHJcblx0XHR2YXIgYm9va2luZ0Zvcm07XHJcblxyXG5cdFx0aWYgKCAhIGNvbnRleHQgKSB7XHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuc2VsZWN0X29uZV9zbG90X2Zvcl9ib29raW5nIHx8ICdTZWxlY3Qgb25lIHRpbWUgcmFuZ2Ugb24gb25lIGRhdGUgZmlyc3QuJywgJ3dhcm5pbmcnLCAzNTAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIHdpbmRvdy53cGJjX2Jvb19saXN0aW5nX19jbGlja19fYWRkX2Jvb2tpbmdfbW9kYWwgKSB7XHJcblx0XHRcdGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBsYWJlbHMuYWRkX2Jvb2tpbmdfbW9kYWxfbWlzc2luZyB8fCAnQWRkIEJvb2tpbmcgcG9wdXAgaXMgbm90IGF2YWlsYWJsZSBvbiB0aGlzIHBhZ2UuJywgJ3dhcm5pbmcnLCA1MDAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGJvb2tpbmdGb3JtID0gJCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fYm9va2luZ19mb3JtJyApLnZhbCgpIHx8ICcnO1xyXG5cclxuXHRcdGNsb3NlX3RpbWVfc2xvdHNfcG9wdXAoICRwYWdlICk7XHJcblx0XHR3aW5kb3cuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR3aW5kb3cud3BiY19ib29fbGlzdGluZ19fY2xpY2tfX2FkZF9ib29raW5nX21vZGFsKCB7XHJcblx0XHRcdFx0bW9kZTogJ2FkZCcsXHJcblx0XHRcdFx0cmVzb3VyY2VfaWQ6IGNvbnRleHQucmVzb3VyY2VfaWQsXHJcblx0XHRcdFx0Ym9va2luZ19mb3JtOiBib29raW5nRm9ybSxcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlOiBjb250ZXh0LnNlbGVjdGVkX2RhdGUsXHJcblx0XHRcdFx0c2VsZWN0ZWRfdGltZTogY29udGV4dC5zZWxlY3RlZF90aW1lLFxyXG5cdFx0XHRcdHRpbWVfb3ZlcnJpZGVfZW5hYmxlZDogMSxcclxuXHRcdFx0XHR0aW1lX292ZXJyaWRlX3NvdXJjZTogJ3RpbWVzX2F2YWlsYWJpbGl0eScsXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9zdGFydDogbWludXRlc190b190aW1lKCBjb250ZXh0LnN0YXJ0X3NlY29uZCAvIDYwICksXHJcblx0XHRcdFx0dGltZV9vdmVycmlkZV9lbmQ6IG1pbnV0ZXNfdG9fdGltZSggY29udGV4dC5lbmRfc2Vjb25kIC8gNjAgKVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9LCAxNTAgKTtcclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNsb25lX2RhdGUoIGRhdGUgKSB7XHJcblx0XHRyZXR1cm4gbmV3IERhdGUoIGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYWRkX2RheXMoIGRhdGUsIGRheXMgKSB7XHJcblx0XHR2YXIgbmV4dCA9IGNsb25lX2RhdGUoIGRhdGUgKTtcclxuXHRcdG5leHQuc2V0RGF0ZSggbmV4dC5nZXREYXRlKCkgKyBkYXlzICk7XHJcblx0XHRyZXR1cm4gbmV4dDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGZvcm1hdF9pc29fZGF0ZSggZGF0ZSApIHtcclxuXHRcdHJldHVybiBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnLScgKyBwYWRfMiggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy0nICsgcGFkXzIoIGRhdGUuZ2V0RGF0ZSgpICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmb3JtYXRfcm93X2RhdGUoIGRhdGUgKSB7XHJcblx0XHR2YXIgZGF5cyA9IFsgJ1N1bicsICdNb24nLCAnVHVlJywgJ1dlZCcsICdUaHUnLCAnRnJpJywgJ1NhdCcgXTtcclxuXHRcdHZhciBtb250aHMgPSBbICdKYW4nLCAnRmViJywgJ01hcicsICdBcHInLCAnTWF5JywgJ0p1bicsICdKdWwnLCAnQXVnJywgJ1NlcCcsICdPY3QnLCAnTm92JywgJ0RlYycgXTtcclxuXHRcdHJldHVybiBkYXlzWyBkYXRlLmdldERheSgpIF0gKyAnICcgKyBtb250aHNbIGRhdGUuZ2V0TW9udGgoKSBdICsgJyAnICsgZGF0ZS5nZXREYXRlKCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmb3JtYXRfZGF0ZV9yYW5nZV9kaXNwbGF5KCBzdGFydERhdGUsIGVuZERhdGUgKSB7XHJcblx0XHRyZXR1cm4gJC5kYXRlcGljay5mb3JtYXREYXRlKCAnTSBkLCB5eScsIHN0YXJ0RGF0ZSApICsgJyAtICcgKyAkLmRhdGVwaWNrLmZvcm1hdERhdGUoICdNIGQsIHl5JywgZW5kRGF0ZSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY2FjaGVfcm93X3RlbXBsYXRlcyggJHBhZ2UgKSB7XHJcblx0XHRpZiAoIHJvd1RlbXBsYXRlcy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHJvd1RlbXBsYXRlcyA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3cnICkuY2xvbmUoIGZhbHNlICkudG9BcnJheSgpO1xyXG5cdFx0JC5lYWNoKCByb3dUZW1wbGF0ZXMsIGZ1bmN0aW9uICggaW5kZXgsIHJvdyApIHtcclxuXHRcdFx0JCggcm93ICkuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5yZW1vdmUoKTtcclxuXHRcdFx0JCggcm93ICkuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbl90ZW1wbGF0ZScgKS5yZW1vdmVDbGFzcyggJ2lzLXZpc2libGUgaXMtYWN0aXZlJyApLmF0dHIoICdoaWRkZW4nLCAnaGlkZGVuJyApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZW5zdXJlX3Jvd19jb3VudCggJHBhZ2UsIGNvdW50ICkge1xyXG5cdFx0dmFyICRyb3dzV3JhcCA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dzJyApO1xyXG5cdFx0dmFyICRyb3dzID0gJHJvd3NXcmFwLmZpbmQoICcud3BiY190c19yb3cnICk7XHJcblx0XHR2YXIgaTtcclxuXHRcdHZhciAkY2xvbmU7XHJcblxyXG5cdFx0Y291bnQgPSBNYXRoLm1heCggMSwgY291bnQgKTtcclxuXHRcdGNhY2hlX3Jvd190ZW1wbGF0ZXMoICRwYWdlICk7XHJcblxyXG5cdFx0aWYgKCAkcm93cy5sZW5ndGggPiBjb3VudCApIHtcclxuXHRcdFx0JHJvd3Muc2xpY2UoIGNvdW50ICkucmVtb3ZlKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICggaSA9ICRyb3dzV3JhcC5maW5kKCAnLndwYmNfdHNfcm93JyApLmxlbmd0aDsgaSA8IGNvdW50OyBpKysgKSB7XHJcblx0XHRcdCRjbG9uZSA9ICQoIHJvd1RlbXBsYXRlc1sgaSAlIHJvd1RlbXBsYXRlcy5sZW5ndGggXSApLmNsb25lKCBmYWxzZSApO1xyXG5cdFx0XHQkY2xvbmUuZmluZCggJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScgKS5yZW1vdmUoKTtcclxuXHRcdFx0JGNsb25lLmZpbmQoICcud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUnICkucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlIGlzLWFjdGl2ZScgKS5hdHRyKCAnaGlkZGVuJywgJ2hpZGRlbicgKTtcclxuXHRcdFx0JHJvd3NXcmFwLmFwcGVuZCggJGNsb25lICk7XHJcblx0XHR9XHJcblxyXG5cdFx0JHJvd3NXcmFwLmZpbmQoICcud3BiY190c19yb3cnICkuZWFjaCggZnVuY3Rpb24gKCBpbmRleCApIHtcclxuXHRcdFx0JCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtcm93JywgU3RyaW5nKCBpbmRleCApICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfcm93c19mb3JfZGF0ZV9yYW5nZSggJHBhZ2UsIHN0YXJ0RGF0ZSwgZW5kRGF0ZSApIHtcclxuXHRcdHZhciBkYXlNcyA9IDI0ICogNjAgKiA2MCAqIDEwMDA7XHJcblx0XHR2YXIgZGF5c0NvdW50ID0gTWF0aC5yb3VuZCggKCBjbG9uZV9kYXRlKCBlbmREYXRlICkuZ2V0VGltZSgpIC0gY2xvbmVfZGF0ZSggc3RhcnREYXRlICkuZ2V0VGltZSgpICkgLyBkYXlNcyApICsgMTtcclxuXHJcblx0XHRkYXlzQ291bnQgPSBNYXRoLm1heCggMSwgZGF5c0NvdW50ICk7XHJcblx0XHRlbnN1cmVfcm93X2NvdW50KCAkcGFnZSwgZGF5c0NvdW50ICk7XHJcblxyXG5cdFx0JHBhZ2UuZmluZCggJy53cGJjX3RzX3JvdycgKS5lYWNoKCBmdW5jdGlvbiAoIGluZGV4ICkge1xyXG5cdFx0XHR2YXIgcm93RGF0ZSA9IGFkZF9kYXlzKCBzdGFydERhdGUsIGluZGV4ICk7XHJcblx0XHRcdCQoIHRoaXMgKVxyXG5cdFx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWRhdGUnLCBmb3JtYXRfaXNvX2RhdGUoIHJvd0RhdGUgKSApXHJcblx0XHRcdFx0LmZpbmQoICcud3BiY190c19yb3dfbGFiZWxfdGV4dCcgKS50ZXh0KCBmb3JtYXRfcm93X2RhdGUoIHJvd0RhdGUgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHNlbGVjdGlvblJhbmdlcyA9ICQuZ3JlcCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGl0ZW0gKSB7XHJcblx0XHRcdGl0ZW0ucm93cyA9ICQuZ3JlcCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0lkICkge1xyXG5cdFx0XHRcdHJldHVybiAkcGFnZS5maW5kKCAnLndwYmNfdHNfcm93W2RhdGEtd3BiYy10cy1yb3c9XCInICsgcm93SWQgKyAnXCJdJyApLmxlbmd0aCA+IDA7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0cmV0dXJuIGl0ZW0ucm93cy5sZW5ndGggPiAwO1xyXG5cdFx0fSApO1xyXG5cdFx0Y2Fub25pY2FsaXplX3NlbGVjdGlvbnMoIGFjdGl2ZVNlbGVjdGlvbklkICk7XHJcblxyXG5cdFx0cG9zaXRpb25fYmFycyggJHBhZ2UuZmluZCggJy53cGJjX3RzX2dyaWQnICkgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdFx0c3luY19mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oIHN0cmluZ0RhdGVzLCBqc0RhdGVzQXJyICkge1xyXG5cdFx0dmFyIGRhdGVzID0gW107XHJcblx0XHR2YXIgcGFydHM7XHJcblx0XHR2YXIgc3RhcnQ7XHJcblx0XHR2YXIgZW5kO1xyXG5cclxuXHRcdGlmICgganNEYXRlc0FyciAmJiAkLmlzQXJyYXkoIGpzRGF0ZXNBcnIucmFuZ2UgKSApIHtcclxuXHRcdFx0ZGF0ZXMgPSBqc0RhdGVzQXJyLnJhbmdlO1xyXG5cdFx0fSBlbHNlIGlmICgganNEYXRlc0FyciAmJiAkLmlzQXJyYXkoIGpzRGF0ZXNBcnIubXVsdGlwbGUgKSApIHtcclxuXHRcdFx0ZGF0ZXMgPSBqc0RhdGVzQXJyLm11bHRpcGxlO1xyXG5cdFx0fSBlbHNlIGlmICggJC5pc0FycmF5KCBqc0RhdGVzQXJyICkgKSB7XHJcblx0XHRcdGRhdGVzID0ganNEYXRlc0FycjtcclxuXHRcdH1cclxuXHJcblx0XHRkYXRlcyA9ICQuZ3JlcCggZGF0ZXMsIGZ1bmN0aW9uICggZGF0ZSApIHtcclxuXHRcdFx0cmV0dXJuIGRhdGUgaW5zdGFuY2VvZiBEYXRlICYmICEgaXNOYU4oIGRhdGUuZ2V0VGltZSgpICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0aWYgKCBkYXRlcy5sZW5ndGggKSB7XHJcblx0XHRcdGRhdGVzLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApIHtcclxuXHRcdFx0XHRyZXR1cm4gY2xvbmVfZGF0ZSggYSApLmdldFRpbWUoKSAtIGNsb25lX2RhdGUoIGIgKS5nZXRUaW1lKCk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0c3RhcnQ6IGNsb25lX2RhdGUoIGRhdGVzWzBdICksXHJcblx0XHRcdFx0ZW5kOiBjbG9uZV9kYXRlKCBkYXRlc1sgZGF0ZXMubGVuZ3RoIC0gMSBdIClcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRwYXJ0cyA9IFN0cmluZyggc3RyaW5nRGF0ZXMgfHwgJycgKS5zcGxpdCggJyAtICcgKTtcclxuXHRcdHN0YXJ0ID0gcGFyc2VfZGF0ZV90ZXh0KCBwYXJ0c1swXSApO1xyXG5cdFx0ZW5kID0gcGFyc2VfZGF0ZV90ZXh0KCBwYXJ0c1sxXSB8fCBwYXJ0c1swXSApO1xyXG5cclxuXHRcdGlmICggc3RhcnQgJiYgZW5kICkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHN0YXJ0OiBzdGFydCxcclxuXHRcdFx0XHRlbmQ6IGVuZFxyXG5cdFx0XHR9O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X2RhdGVwaWNrX3NlbGVjdGVkX3JhbmdlKCAkZGF0ZSApIHtcclxuXHRcdHZhciBpbnN0O1xyXG5cclxuXHRcdGlmICggISAkLmRhdGVwaWNrIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiAkLmRhdGVwaWNrLl9nZXRJbnN0IHx8ICEgJGRhdGUubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRpbnN0ID0gJC5kYXRlcGljay5fZ2V0SW5zdCggJGRhdGVbMF0gKTtcclxuXHRcdGlmICggISBpbnN0ICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcGFyc2VfZGF0ZXBpY2tfc2VsZWN0aW9uKCAkZGF0ZS52YWwoKSwgJC5kYXRlcGljay5fZ2V0RGF0ZSggaW5zdCApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiggJHBhZ2UsIHJhbmdlLCBvcHRpb25zICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciBzdGFydERhdGU7XHJcblx0XHR2YXIgZW5kRGF0ZTtcclxuXHRcdHZhciBzdGFydElzbztcclxuXHRcdHZhciBlbmRJc287XHJcblx0XHR2YXIgY3VycmVudEtleTtcclxuXHRcdHZhciBuZXh0S2V5O1xyXG5cclxuXHRcdG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuXHRcdGlmICggISByYW5nZSB8fCAhIHJhbmdlLnN0YXJ0IHx8ICEgcmFuZ2UuZW5kICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhcnREYXRlID0gY2xvbmVfZGF0ZSggcmFuZ2Uuc3RhcnQgKTtcclxuXHRcdGVuZERhdGUgPSBjbG9uZV9kYXRlKCByYW5nZS5lbmQgKTtcclxuXHJcblx0XHRpZiAoIHN0YXJ0RGF0ZS5nZXRUaW1lKCkgPiBlbmREYXRlLmdldFRpbWUoKSApIHtcclxuXHRcdFx0cmFuZ2UgPSBzdGFydERhdGU7XHJcblx0XHRcdHN0YXJ0RGF0ZSA9IGVuZERhdGU7XHJcblx0XHRcdGVuZERhdGUgPSByYW5nZTtcclxuXHRcdH1cclxuXHJcblx0XHRzdGFydElzbyA9IGZvcm1hdF9pc29fZGF0ZSggc3RhcnREYXRlICk7XHJcblx0XHRlbmRJc28gPSBmb3JtYXRfaXNvX2RhdGUoIGVuZERhdGUgKTtcclxuXHRcdGN1cnJlbnRLZXkgPSAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLXN0YXJ0JyApICsgJzonICsgJGRhdGUuYXR0ciggJ2RhdGEtd3BiYy10cy1lbmQnICk7XHJcblx0XHRuZXh0S2V5ID0gc3RhcnRJc28gKyAnOicgKyBlbmRJc287XHJcblxyXG5cdFx0aWYgKCBjdXJyZW50S2V5ID09PSBuZXh0S2V5ICkge1xyXG5cdFx0XHQkZGF0ZS52YWwoIGZvcm1hdF9kYXRlX3JhbmdlX2Rpc3BsYXkoIHN0YXJ0RGF0ZSwgZW5kRGF0ZSApICk7XHJcblx0XHRcdGlmICggb3B0aW9ucy5mb3JjZV9yZWxvYWQgKSB7XHJcblx0XHRcdFx0bG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0JGRhdGVcclxuXHRcdFx0LmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnLCBzdGFydElzbyApXHJcblx0XHRcdC5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcsIGVuZElzbyApXHJcblx0XHRcdC52YWwoIGZvcm1hdF9kYXRlX3JhbmdlX2Rpc3BsYXkoIHN0YXJ0RGF0ZSwgZW5kRGF0ZSApICk7XHJcblxyXG5cdFx0dXBkYXRlX3Jvd3NfZm9yX2RhdGVfcmFuZ2UoICRwYWdlLCBzdGFydERhdGUsIGVuZERhdGUgKTtcclxuXHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX2RhdGVfcmFuZ2VfZnJvbV9pbnB1dCggJHBhZ2UgKSB7XHJcblx0XHR2YXIgJGRhdGUgPSBnZXRfY29udHJvbCggJHBhZ2UsICdkYXRlX3JhbmdlJyApO1xyXG5cdFx0dmFyIHJhbmdlID0gZ2V0X2RhdGVwaWNrX3NlbGVjdGVkX3JhbmdlKCAkZGF0ZSApIHx8IHBhcnNlX2RhdGVwaWNrX3NlbGVjdGlvbiggJGRhdGUudmFsKCksIG51bGwgKTtcclxuXHJcblx0XHRhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiggJHBhZ2UsIHJhbmdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfZGF0ZV9yYW5nZV9mcm9tX2RhdGFfYXR0cnMoICRwYWdlICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciBzdGFydERhdGUgPSBwYXJzZV9kYXRlX3RleHQoICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICkgKTtcclxuXHRcdHZhciBlbmREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCAkZGF0ZS5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcgKSApO1xyXG5cclxuXHRcdGlmICggc3RhcnREYXRlICYmIGVuZERhdGUgKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0c3RhcnQ6IHN0YXJ0RGF0ZSxcclxuXHRcdFx0XHRlbmQ6IGVuZERhdGVcclxuXHRcdFx0fTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jdXJyZW50X2RhdGVfcmFuZ2UoICRwYWdlICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciByYW5nZSA9IGdldF9kYXRlX3JhbmdlX2Zyb21fZGF0YV9hdHRycyggJHBhZ2UgKSB8fCBwYXJzZV9kYXRlcGlja19zZWxlY3Rpb24oICRkYXRlLnZhbCgpLCBudWxsICk7XHJcblxyXG5cdFx0aWYgKCByYW5nZSApIHtcclxuXHRcdFx0cmV0dXJuIHJhbmdlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHN0YXJ0OiBwYXJzZV9kYXRlX3RleHQoICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RhcnQnICkgKSxcclxuXHRcdFx0ZW5kOiBwYXJzZV9kYXRlX3RleHQoICRkYXRlLmF0dHIoICdkYXRhLXdwYmMtdHMtZW5kJyApIClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzaGlmdF9kYXRlX3JhbmdlKCAkcGFnZSwgZGlyZWN0aW9uICkge1xyXG5cdFx0dmFyIHJhbmdlID0gZ2V0X2N1cnJlbnRfZGF0ZV9yYW5nZSggJHBhZ2UgKTtcclxuXHRcdHZhciBkYXlNcyA9IDI0ICogNjAgKiA2MCAqIDEwMDA7XHJcblx0XHR2YXIgZGF5c0NvdW50O1xyXG5cdFx0dmFyIHNoaWZ0O1xyXG5cclxuXHRcdGlmICggISByYW5nZSB8fCAhIHJhbmdlLnN0YXJ0IHx8ICEgcmFuZ2UuZW5kICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0ZGF5c0NvdW50ID0gTWF0aC5yb3VuZCggKCBjbG9uZV9kYXRlKCByYW5nZS5lbmQgKS5nZXRUaW1lKCkgLSBjbG9uZV9kYXRlKCByYW5nZS5zdGFydCApLmdldFRpbWUoKSApIC8gZGF5TXMgKSArIDE7XHJcblx0XHRzaGlmdCA9IE1hdGgubWF4KCAxLCBkYXlzQ291bnQgKSAqICggJ3ByZXYnID09PSBkaXJlY3Rpb24gPyAtMSA6IDEgKTtcclxuXHJcblx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHRyZXR1cm4gYXBwbHlfZGF0ZV9yYW5nZV9zZWxlY3Rpb24oICRwYWdlLCB7XHJcblx0XHRcdHN0YXJ0OiBhZGRfZGF5cyggcmFuZ2Uuc3RhcnQsIHNoaWZ0ICksXHJcblx0XHRcdGVuZDogYWRkX2RheXMoIHJhbmdlLmVuZCwgc2hpZnQgKVxyXG5cdFx0fSwge1xyXG5cdFx0XHRmb3JjZV9yZWxvYWQ6IHRydWVcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHBhcnNlX2RhdGVfdGV4dCggdGV4dCApIHtcclxuXHRcdHZhciBwYXJzZWQ7XHJcblx0XHR2YXIgc3FsTWF0Y2g7XHJcblxyXG5cdFx0dGV4dCA9ICQudHJpbSggdGV4dCB8fCAnJyApO1xyXG5cdFx0aWYgKCAhIHRleHQgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNxbE1hdGNoID0gdGV4dC5tYXRjaCggL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KS8gKTtcclxuXHRcdGlmICggc3FsTWF0Y2ggKSB7XHJcblx0XHRcdHJldHVybiBuZXcgRGF0ZSggcGFyc2VJbnQoIHNxbE1hdGNoWzFdLCAxMCApLCBwYXJzZUludCggc3FsTWF0Y2hbMl0sIDEwICkgLSAxLCBwYXJzZUludCggc3FsTWF0Y2hbM10sIDEwICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICQuZGF0ZXBpY2sgJiYgJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICQuZGF0ZXBpY2sucGFyc2VEYXRlICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHBhcnNlZCA9ICQuZGF0ZXBpY2sucGFyc2VEYXRlKCAnTSBkLCB5eScsIHRleHQgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge1xyXG5cdFx0XHRcdHBhcnNlZCA9IG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgcGFyc2VkICkge1xyXG5cdFx0XHRwYXJzZWQgPSBuZXcgRGF0ZSggdGV4dCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwYXJzZWQgaW5zdGFuY2VvZiBEYXRlICYmICEgaXNOYU4oIHBhcnNlZC5nZXRUaW1lKCkgKSA/IGNsb25lX2RhdGUoIHBhcnNlZCApIDogbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF90aW1lX3Nsb3RzX2NvbnRleHQoIGNvbnRleHQsIG9wdGlvbnMgKSB7XHJcblx0XHR2YXIgJGNvbnRleHQgPSBjb250ZXh0ID8gJCggY29udGV4dCApIDogJCggZG9jdW1lbnQgKTtcclxuXHRcdHZhciAkcGFnZSA9ICRjb250ZXh0LmlzKCAnLndwYmNfdHNfcGFnZScgKSA/ICRjb250ZXh0IDogJGNvbnRleHQuZmluZCggJy53cGJjX3RzX3BhZ2UnICkuZmlyc3QoKTtcclxuXHRcdHZhciBzdGFydERhdGU7XHJcblx0XHR2YXIgZW5kRGF0ZTtcclxuXHRcdHZhciByZXNvdXJjZUNoYW5nZWQgPSBmYWxzZTtcclxuXHRcdHZhciByYW5nZUNoYW5nZWQgPSBmYWxzZTtcclxuXHJcblx0XHRvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuXHJcblx0XHRpZiAoICEgJHBhZ2UubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0aW5pdF90aW1lX3Nsb3RzX3BhZ2UoICRwYWdlLCB0cnVlICk7XHJcblxyXG5cdFx0aWYgKCBvcHRpb25zLnJlc291cmNlX2lkICkge1xyXG5cdFx0XHRyZXNvdXJjZUNoYW5nZWQgPSBTdHJpbmcoIGdldF9jb250cm9sKCAkcGFnZSwgJ3Jlc291cmNlJyApLnZhbCgpICkgIT09IFN0cmluZyggb3B0aW9ucy5yZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoIFN0cmluZyggb3B0aW9ucy5yZXNvdXJjZV9pZCApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhcnREYXRlID0gcGFyc2VfZGF0ZV90ZXh0KCBvcHRpb25zLmRhdGVfc3RhcnQgKTtcclxuXHRcdGVuZERhdGUgPSBwYXJzZV9kYXRlX3RleHQoIG9wdGlvbnMuZGF0ZV9lbmQgKSB8fCBzdGFydERhdGU7XHJcblxyXG5cdFx0aWYgKCBzdGFydERhdGUgJiYgZW5kRGF0ZSApIHtcclxuXHRcdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0XHRyYW5nZUNoYW5nZWQgPSBhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiggJHBhZ2UsIHtcclxuXHRcdFx0XHRzdGFydDogc3RhcnREYXRlLFxyXG5cdFx0XHRcdGVuZDogZW5kRGF0ZVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCByZXNvdXJjZUNoYW5nZWQgJiYgcmFuZ2VDaGFuZ2VkICkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHJlc291cmNlQ2hhbmdlZCB8fCAhIHJhbmdlQ2hhbmdlZCApIHtcclxuXHRcdFx0bG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJvd19mcm9tX3BvaW50ZXIoICRwYWdlLCBldmVudCApIHtcclxuXHRcdHZhciBvcmlnaW5hbCA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQgfHwgZXZlbnQ7XHJcblx0XHR2YXIgcG9pbnQgPSBvcmlnaW5hbC50b3VjaGVzICYmIG9yaWdpbmFsLnRvdWNoZXMubGVuZ3RoID8gb3JpZ2luYWwudG91Y2hlc1swXSA6IG9yaWdpbmFsO1xyXG5cdFx0dmFyIGVsID0gZG9jdW1lbnQuZWxlbWVudEZyb21Qb2ludCggcG9pbnQuY2xpZW50WCwgcG9pbnQuY2xpZW50WSApO1xyXG5cdFx0dmFyICRyb3cgPSAkKCBlbCApLmNsb3Nlc3QoICcud3BiY190c19yb3cnICk7XHJcblxyXG5cdFx0aWYgKCAhICRyb3cubGVuZ3RoIHx8ICEgJC5jb250YWlucyggJHBhZ2VbMF0sICRyb3dbMF0gKSApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICRyb3cuYXR0ciggJ2RhdGEtd3BiYy10cy1yb3cnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBtaW51dGVfZnJvbV9wb2ludGVyKCBldmVudCwgJGxhbmUgKSB7XHJcblx0XHR2YXIgb3JpZ2luYWwgPSBldmVudC5vcmlnaW5hbEV2ZW50IHx8IGV2ZW50O1xyXG5cdFx0dmFyIHBvaW50ID0gb3JpZ2luYWwudG91Y2hlcyAmJiBvcmlnaW5hbC50b3VjaGVzLmxlbmd0aCA/IG9yaWdpbmFsLnRvdWNoZXNbMF0gOiBvcmlnaW5hbDtcclxuXHRcdHZhciAkZ3JpZCA9ICRsYW5lLmNsb3Nlc3QoICcud3BiY190c19ncmlkJyApO1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHRcdHZhciByZWN0ID0gJGxhbmVbMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblx0XHR2YXIgcmF0aW8gPSAoIHBvaW50LmNsaWVudFggLSByZWN0LmxlZnQgKSAvIHJlY3Qud2lkdGg7XHJcblx0XHR2YXIgbWludXRlID0gY29uZmlnLnN0YXJ0ICsgcmF0aW8gKiAoIGNvbmZpZy5lbmQgLSBjb25maWcuc3RhcnQgKTtcclxuXHJcblx0XHRyZXR1cm4gY2xhbXAoIHNuYXBfbWludXRlKCBtaW51dGUsIGNvbmZpZy5zdGVwICksIGNvbmZpZy5zdGFydCwgY29uZmlnLmVuZCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY3JlYXRlX3NlbGVjdGlvbiggJHBhZ2UsIHJvd3MsIHN0YXJ0LCBlbmQgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblx0XHR2YXIgcmFuZ2UgPSBub3JtYWxpemVfc2VsZWN0aW9uX3JhbmdlKCBzdGFydCwgZW5kLCBjb25maWcgKTtcclxuXHRcdHZhciBpdGVtID0ge1xyXG5cdFx0XHRpZDogJ3NlbGVjdGlvbl8nICsgbmV4dFNlbGVjdGlvbklkKyssXHJcblx0XHRcdHN0YXJ0OiByYW5nZS5zdGFydCxcclxuXHRcdFx0ZW5kOiByYW5nZS5lbmQsXHJcblx0XHRcdHJvd3M6IHJvd3Muc2xpY2UoIDAgKVxyXG5cdFx0fTtcclxuXHJcblx0XHRzZWxlY3Rpb25SYW5nZXMucHVzaCggaXRlbSApO1xyXG5cdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSBpdGVtLmlkO1xyXG5cdFx0Y2Fub25pY2FsaXplX3NlbGVjdGlvbnMoIGl0ZW0uaWQgKTtcclxuXHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdFx0cmV0dXJuIGdldF9zZWxlY3Rpb25fYnlfaWQoIGFjdGl2ZVNlbGVjdGlvbklkICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfc2VsZWN0aW9uKCAkcGFnZSwgc2VsZWN0aW9uSWQsIHJvd3MsIHN0YXJ0LCBlbmQgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdHZhciBjb25maWcgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICk7XHJcblx0XHR2YXIgcmFuZ2UgPSBub3JtYWxpemVfc2VsZWN0aW9uX3JhbmdlKCBzdGFydCwgZW5kLCBjb25maWcgKTtcclxuXHRcdHZhciBpdGVtID0gZ2V0X3NlbGVjdGlvbl9ieV9pZCggc2VsZWN0aW9uSWQgKTtcclxuXHJcblx0XHRpZiAoICEgaXRlbSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGl0ZW0uc3RhcnQgPSByYW5nZS5zdGFydDtcclxuXHRcdGl0ZW0uZW5kID0gcmFuZ2UuZW5kO1xyXG5cdFx0aXRlbS5yb3dzID0gcm93cy5zbGljZSggMCApO1xyXG5cdFx0Y2Fub25pY2FsaXplX3NlbGVjdGlvbnMoIHNlbGVjdGlvbklkICk7XHJcblx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGNhbm9uaWNhbGl6ZV9zZWxlY3Rpb25zKCBwcmVmZXJyZWRBY3RpdmVJZCApIHtcclxuXHRcdHZhciBpbnRlcnZhbHMgPSBbXTtcclxuXHRcdHZhciBtZXJnZWQgPSBbXTtcclxuXHRcdHZhciBncm91cHMgPSBbXTtcclxuXHRcdHZhciBuZXdBY3RpdmVJZCA9ICcnO1xyXG5cclxuXHRcdCQuZWFjaCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHQkLmVhY2goIGl0ZW0ucm93cywgZnVuY3Rpb24gKCByb3dJbmRleCwgcm93SWQgKSB7XHJcblx0XHRcdFx0aW50ZXJ2YWxzLnB1c2goIHtcclxuXHRcdFx0XHRcdHJvdzogcGFyc2VJbnQoIHJvd0lkLCAxMCApLFxyXG5cdFx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0XHRlbmQ6IGl0ZW0uZW5kLFxyXG5cdFx0XHRcdFx0YWN0aXZlOiBpdGVtLmlkID09PSBwcmVmZXJyZWRBY3RpdmVJZCB8fCBpdGVtLmlkID09PSBhY3RpdmVTZWxlY3Rpb25JZFxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGludGVydmFscy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKSB7XHJcblx0XHRcdGlmICggYS5yb3cgIT09IGIucm93ICkge1xyXG5cdFx0XHRcdHJldHVybiBhLnJvdyAtIGIucm93O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYS5zdGFydCAhPT0gYi5zdGFydCApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5zdGFydCAtIGIuc3RhcnQ7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGEuZW5kIC0gYi5lbmQ7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JC5lYWNoKCBpbnRlcnZhbHMsIGZ1bmN0aW9uICggaW5kZXgsIGl0ZW0gKSB7XHJcblx0XHRcdHZhciBsYXN0ID0gbWVyZ2VkWyBtZXJnZWQubGVuZ3RoIC0gMSBdO1xyXG5cclxuXHRcdFx0aWYgKCBsYXN0ICYmIGxhc3Qucm93ID09PSBpdGVtLnJvdyAmJiBpdGVtLnN0YXJ0IDw9IGxhc3QuZW5kICkge1xyXG5cdFx0XHRcdGxhc3QuZW5kID0gTWF0aC5tYXgoIGxhc3QuZW5kLCBpdGVtLmVuZCApO1xyXG5cdFx0XHRcdGxhc3QuYWN0aXZlID0gbGFzdC5hY3RpdmUgfHwgaXRlbS5hY3RpdmU7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRtZXJnZWQucHVzaCgge1xyXG5cdFx0XHRcdHJvdzogaXRlbS5yb3csXHJcblx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRhY3RpdmU6IGl0ZW0uYWN0aXZlXHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRtZXJnZWQuc29ydCggZnVuY3Rpb24gKCBhLCBiICkge1xyXG5cdFx0XHRpZiAoIGEuc3RhcnQgIT09IGIuc3RhcnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuc3RhcnQgLSBiLnN0YXJ0O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggYS5lbmQgIT09IGIuZW5kICkge1xyXG5cdFx0XHRcdHJldHVybiBhLmVuZCAtIGIuZW5kO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhLnJvdyAtIGIucm93O1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQuZWFjaCggbWVyZ2VkLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHR2YXIgbGFzdCA9IGdyb3Vwc1sgZ3JvdXBzLmxlbmd0aCAtIDEgXTtcclxuXHJcblx0XHRcdGlmICggbGFzdCAmJiBsYXN0LnN0YXJ0ID09PSBpdGVtLnN0YXJ0ICYmIGxhc3QuZW5kID09PSBpdGVtLmVuZCAmJiBsYXN0Lmxhc3RSb3cgKyAxID09PSBpdGVtLnJvdyApIHtcclxuXHRcdFx0XHRsYXN0LnJvd3MucHVzaCggU3RyaW5nKCBpdGVtLnJvdyApICk7XHJcblx0XHRcdFx0bGFzdC5sYXN0Um93ID0gaXRlbS5yb3c7XHJcblx0XHRcdFx0bGFzdC5hY3RpdmUgPSBsYXN0LmFjdGl2ZSB8fCBpdGVtLmFjdGl2ZTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGdyb3Vwcy5wdXNoKCB7XHJcblx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRyb3dzOiBbIFN0cmluZyggaXRlbS5yb3cgKSBdLFxyXG5cdFx0XHRcdGxhc3RSb3c6IGl0ZW0ucm93LFxyXG5cdFx0XHRcdGFjdGl2ZTogaXRlbS5hY3RpdmVcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdHNlbGVjdGlvblJhbmdlcyA9ICQubWFwKCBncm91cHMsIGZ1bmN0aW9uICggaXRlbSApIHtcclxuXHRcdFx0dmFyIGlkID0gJ3NlbGVjdGlvbl8nICsgbmV4dFNlbGVjdGlvbklkKys7XHJcblxyXG5cdFx0XHRpZiAoIGl0ZW0uYWN0aXZlICYmICEgbmV3QWN0aXZlSWQgKSB7XHJcblx0XHRcdFx0bmV3QWN0aXZlSWQgPSBpZDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHtcclxuXHRcdFx0XHRpZDogaWQsXHJcblx0XHRcdFx0c3RhcnQ6IGl0ZW0uc3RhcnQsXHJcblx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRyb3dzOiBpdGVtLnJvd3NcclxuXHRcdFx0fTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRhY3RpdmVTZWxlY3Rpb25JZCA9IG5ld0FjdGl2ZUlkIHx8ICggc2VsZWN0aW9uUmFuZ2VzWzBdID8gc2VsZWN0aW9uUmFuZ2VzWzBdLmlkIDogJycgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApIHtcclxuXHRcdHZhciAkZ3JpZCA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApO1xyXG5cdFx0dmFyIGNvbmZpZyA9IGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKTtcclxuXHJcblx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfc2VsZWN0aW9uOm5vdCgud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUpJyApLnJlbW92ZSgpO1xyXG5cclxuXHRcdCQuZWFjaCggc2VsZWN0aW9uUmFuZ2VzLCBmdW5jdGlvbiAoIGluZGV4LCBpdGVtICkge1xyXG5cdFx0XHR2YXIgcmFuZ2UgPSBub3JtYWxpemVfc2VsZWN0aW9uX3JhbmdlKCBpdGVtLnN0YXJ0LCBpdGVtLmVuZCwgY29uZmlnICk7XHJcblx0XHRcdHZhciBsZWZ0ID0gcGVyY2VudF9mb3JfbWludXRlKCByYW5nZS5zdGFydCwgY29uZmlnICk7XHJcblx0XHRcdHZhciB3aWR0aCA9IHBlcmNlbnRfZm9yX21pbnV0ZSggcmFuZ2UuZW5kLCBjb25maWcgKSAtIGxlZnQ7XHJcblxyXG5cdFx0XHRpdGVtLnN0YXJ0ID0gcmFuZ2Uuc3RhcnQ7XHJcblx0XHRcdGl0ZW0uZW5kID0gcmFuZ2UuZW5kO1xyXG5cclxuXHRcdFx0JC5lYWNoKCBpdGVtLnJvd3MsIGZ1bmN0aW9uICggcm93SW5kZXgsIHJvd0lkICkge1xyXG5cdFx0XHRcdHZhciAkcm93ID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX3Jvd1tkYXRhLXdwYmMtdHMtcm93PVwiJyArIHJvd0lkICsgJ1wiXScgKTtcclxuXHRcdFx0XHR2YXIgJGxhbmUgPSAkcm93LmZpbmQoICcud3BiY190c19sYW5lJyApO1xyXG5cdFx0XHRcdHZhciAkdGVtcGxhdGUgPSAkbGFuZS5maW5kKCAnLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlJyApLmZpcnN0KCk7XHJcblx0XHRcdFx0dmFyICRzZWxlY3Rpb247XHJcblxyXG5cdFx0XHRcdGlmICggISAkbGFuZS5sZW5ndGggfHwgISAkdGVtcGxhdGUubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0JHNlbGVjdGlvbiA9ICR0ZW1wbGF0ZS5jbG9uZSggZmFsc2UgKVxyXG5cdFx0XHRcdFx0LnJlbW92ZUNsYXNzKCAnd3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUnIClcclxuXHRcdFx0XHRcdC5yZW1vdmVBdHRyKCAnaGlkZGVuJyApXHJcblx0XHRcdFx0XHQuYWRkQ2xhc3MoICdpcy12aXNpYmxlJyApXHJcblx0XHRcdFx0XHQudG9nZ2xlQ2xhc3MoICdpcy1hY3RpdmUnLCBpdGVtLmlkID09PSBhY3RpdmVTZWxlY3Rpb25JZCApXHJcblx0XHRcdFx0XHQuYXR0ciggJ2RhdGEtd3BiYy10cy1zZWxlY3Rpb24taWQnLCBpdGVtLmlkIClcclxuXHRcdFx0XHRcdC5jc3MoIHsgbGVmdDogbGVmdCArICclJywgd2lkdGg6IHdpZHRoICsgJyUnIH0gKTtcclxuXHJcblx0XHRcdFx0JHNlbGVjdGlvbi5maW5kKCAnLndwYmNfdHNfdGltZV9jaGlwX3N0YXJ0JyApLnRleHQoIG1pbnV0ZXNfdG9fdGltZSggcmFuZ2Uuc3RhcnQgKSApO1xyXG5cdFx0XHRcdCRzZWxlY3Rpb24uZmluZCggJy53cGJjX3RzX3RpbWVfY2hpcF9lbmQnICkudGV4dCggbWludXRlc190b190aW1lKCByYW5nZS5lbmQgKSApO1xyXG5cdFx0XHRcdCRsYW5lLmFwcGVuZCggJHNlbGVjdGlvbiApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0dXBkYXRlX3N1bW1hcnkoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBjbGVhcl9zZWxlY3Rpb24oICRwYWdlICkge1xyXG5cdFx0c2VsZWN0aW9uUmFuZ2VzID0gW107XHJcblx0XHRhY3RpdmVTZWxlY3Rpb25JZCA9ICcnO1xyXG5cdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB1cGRhdGVfc3VtbWFyeSggJHBhZ2UgKSB7XHJcblx0XHR2YXIgY29uZmlnID0gZ2V0X2dyaWRfY29uZmlnKCAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKSApO1xyXG5cdFx0dmFyIHNsb3RDb3VudCA9IDA7XHJcblx0XHR2YXIgZGF0ZXMgPSB7fTtcclxuXHRcdHZhciBkYXRlc0NvdW50ID0gMDtcclxuXHRcdHZhciBkYXRlVGV4dCA9ICctJztcclxuXHRcdHZhciB0aW1lVGV4dCA9ICctJztcclxuXHRcdHZhciBkZXRhaWxzID0gW107XHJcblx0XHR2YXIgZGV0YWlsc0h0bWwgPSAnJztcclxuXHJcblx0XHQkLmVhY2goIHNlbGVjdGlvblJhbmdlcywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0c2xvdENvdW50ICs9IE1hdGgubWF4KCAwLCBNYXRoLnJvdW5kKCAoIGl0ZW0uZW5kIC0gaXRlbS5zdGFydCApIC8gY29uZmlnLnN0ZXAgKSAqIGl0ZW0ucm93cy5sZW5ndGggKTtcclxuXHJcblx0XHRcdCQuZWFjaCggaXRlbS5yb3dzLCBmdW5jdGlvbiAoIHJvd0luZGV4LCByb3dJZCApIHtcclxuXHRcdFx0XHR2YXIgbGFiZWwgPSByb3dfbGFiZWwoICRwYWdlLCByb3dJZCApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgbGFiZWwgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRkYXRlc1sgbGFiZWwgXSA9IHRydWU7XHJcblx0XHRcdFx0ZGV0YWlscy5wdXNoKCB7XHJcblx0XHRcdFx0XHRyb3c6IHBhcnNlSW50KCByb3dJZCwgMTAgKSxcclxuXHRcdFx0XHRcdHN0YXJ0OiBpdGVtLnN0YXJ0LFxyXG5cdFx0XHRcdFx0ZW5kOiBpdGVtLmVuZCxcclxuXHRcdFx0XHRcdGxhYmVsOiBsYWJlbFxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdGRldGFpbHMuc29ydCggZnVuY3Rpb24gKCBhLCBiICkge1xyXG5cdFx0XHRpZiAoIGEucm93ICE9PSBiLnJvdyApIHtcclxuXHRcdFx0XHRyZXR1cm4gYS5yb3cgLSBiLnJvdztcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIGEuc3RhcnQgIT09IGIuc3RhcnQgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGEuc3RhcnQgLSBiLnN0YXJ0O1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBhLmVuZCAtIGIuZW5kO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQuZWFjaCggZGV0YWlscywgZnVuY3Rpb24gKCBpbmRleCwgaXRlbSApIHtcclxuXHRcdFx0dmFyIHRpbWVMYWJlbCA9IG1pbnV0ZXNfdG9fdGltZSggaXRlbS5zdGFydCApICsgJyAtICcgKyBtaW51dGVzX3RvX3RpbWUoIGl0ZW0uZW5kICk7XHJcblxyXG5cdFx0XHRkZXRhaWxzSHRtbCArPSAnPGRpdiBjbGFzcz1cIndwYmNfdHNfc2VsZWN0aW9uX2RldGFpbF9pdGVtXCI+J1xyXG5cdFx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY190c19zZWxlY3Rpb25fZGV0YWlsX2RhdGVcIj4nICsgZXNjYXBlX2h0bWwoIGl0ZW0ubGFiZWwgKSArICc8L3NwYW4+J1xyXG5cdFx0XHRcdCsgJzxzcGFuIGNsYXNzPVwid3BiY190c19zZWxlY3Rpb25fZGV0YWlsX3RpbWVcIj4nICsgZXNjYXBlX2h0bWwoIHRpbWVMYWJlbCApICsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0KyAnPC9kaXY+JztcclxuXHRcdH0gKTtcclxuXHJcblx0XHRkYXRlc0NvdW50ID0gT2JqZWN0LmtleXMoIGRhdGVzICkubGVuZ3RoO1xyXG5cclxuXHRcdGlmICggc2VsZWN0aW9uUmFuZ2VzLmxlbmd0aCApIHtcclxuXHRcdFx0ZGF0ZVRleHQgPSBkYXRlc0NvdW50ICsgKCAxID09PSBkYXRlc0NvdW50ID8gJyBkYXRlJyA6ICcgZGF0ZXMnICk7XHJcblx0XHRcdHRpbWVUZXh0ID0gc2VsZWN0aW9uUmFuZ2VzLmxlbmd0aCArICggMSA9PT0gc2VsZWN0aW9uUmFuZ2VzLmxlbmd0aCA/ICcgaW50ZXJ2YWwnIDogJyBpbnRlcnZhbHMnICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGRldGFpbHNIdG1sICkge1xyXG5cdFx0XHRkZXRhaWxzSHRtbCA9ICc8ZGl2IGNsYXNzPVwid3BiY190c19zZWxlY3Rpb25fZGV0YWlsc19lbXB0eVwiPk5vIHRpbWUgc2xvdHMgc2VsZWN0ZWQuPC9kaXY+JztcclxuXHRcdH1cclxuXHJcblx0XHQkKCBkb2N1bWVudCApLmZpbmQoICdbZGF0YS13cGJjLXRzLWRldGFpbD1cInNsb3RzXCJdJyApLnRleHQoIHNsb3RDb3VudCApO1xyXG5cdFx0JCggZG9jdW1lbnQgKS5maW5kKCAnW2RhdGEtd3BiYy10cy1kZXRhaWw9XCJkYXRlc1wiXScgKS50ZXh0KCBkYXRlVGV4dCApO1xyXG5cdFx0JCggZG9jdW1lbnQgKS5maW5kKCAnW2RhdGEtd3BiYy10cy1kZXRhaWw9XCJ0aW1lXCJdJyApLnRleHQoIHRpbWVUZXh0ICk7XHJcblx0XHQkKCBkb2N1bWVudCApLmZpbmQoICdbZGF0YS13cGJjLXRzLWRldGFpbD1cInNlbGVjdGlvbl9saXN0XCJdJyApLmh0bWwoIGRldGFpbHNIdG1sICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzaG93X2xpdmVfdGlwKCAkcGFnZSwgZXZlbnQgKSB7XHJcblx0XHR2YXIgb3JpZ2luYWwgPSBldmVudC5vcmlnaW5hbEV2ZW50IHx8IGV2ZW50O1xyXG5cdFx0dmFyIHBvaW50ID0gb3JpZ2luYWwudG91Y2hlcyAmJiBvcmlnaW5hbC50b3VjaGVzLmxlbmd0aCA/IG9yaWdpbmFsLnRvdWNoZXNbMF0gOiBvcmlnaW5hbDtcclxuXHRcdHZhciAkdGlwID0gJHBhZ2UuZmluZCggJy53cGJjX3RzX2xpdmVfdGlwJyApO1xyXG5cdFx0dmFyIGFjdGl2ZSA9IGdldF9zZWxlY3Rpb25fYnlfaWQoIGFjdGl2ZVNlbGVjdGlvbklkICk7XHJcblxyXG5cdFx0aWYgKCAhIGFjdGl2ZSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISAkdGlwLmxlbmd0aCApIHtcclxuXHRcdFx0JHRpcCA9ICQoICc8ZGl2IGNsYXNzPVwid3BiY190c19saXZlX3RpcFwiPjwvZGl2PicgKS5hcHBlbmRUbyggJHBhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0XHQkdGlwXHJcblx0XHRcdC50ZXh0KCBtaW51dGVzX3RvX3RpbWUoIGFjdGl2ZS5zdGFydCApICsgJyAtICcgKyBtaW51dGVzX3RvX3RpbWUoIGFjdGl2ZS5lbmQgKSApXHJcblx0XHRcdC5jc3MoIHtcclxuXHRcdFx0XHRsZWZ0OiBwb2ludC5wYWdlWCArIDEyICsgJ3B4JyxcclxuXHRcdFx0XHR0b3A6IHBvaW50LnBhZ2VZIC0gMzggKyAncHgnXHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuYWRkQ2xhc3MoICdpcy12aXNpYmxlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaGlkZV9saXZlX3RpcCggJHBhZ2UgKSB7XHJcblx0XHQkcGFnZS5maW5kKCAnLndwYmNfdHNfbGl2ZV90aXAnICkucmVtb3ZlQ2xhc3MoICdpcy12aXNpYmxlJyApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc3luY19zbG90X3N0ZXBfY29udHJvbHMoICRwYWdlLCBzdGVwICkge1xyXG5cdFx0Z2V0X2NvbnRyb2woICRwYWdlLCAnc2xvdF9zdGVwJyApLnZhbCggU3RyaW5nKCBzdGVwICkgKTtcclxuXHRcdCQoICcjd3BiY190c19zaWRlX3Nsb3Rfc3RlcCcgKS52YWwoIFN0cmluZyggc3RlcCApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX3pvb21fY29udHJvbHMoICRwYWdlLCBzdGVwICkge1xyXG5cdFx0dmFyIGluZGV4ID0gem9vbVN0ZXBzLmluZGV4T2YoIHN0ZXAgKTtcclxuXHRcdGlmICggLTEgPT09IGluZGV4ICkge1xyXG5cdFx0XHRpbmRleCA9IDI7XHJcblx0XHR9XHJcblx0XHRnZXRfY29udHJvbCggJHBhZ2UsICd6b29tJyApLnZhbCggU3RyaW5nKCBpbmRleCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV96b29tJyApLnZhbCggU3RyaW5nKCBpbmRleCApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfc3RlcCggJHBhZ2UsIHN0ZXAgKSB7XHJcblx0XHR2YXIgJGdyaWQgPSAkcGFnZS5maW5kKCAnLndwYmNfdHNfZ3JpZCcgKTtcclxuXHRcdCRncmlkLmF0dHIoICdkYXRhLXdwYmMtdHMtc3RlcCcsIHN0ZXAgKTtcclxuXHRcdHN5bmNfc2xvdF9zdGVwX2NvbnRyb2xzKCAkcGFnZSwgc3RlcCApO1xyXG5cdFx0c3luY196b29tX2NvbnRyb2xzKCAkcGFnZSwgc3RlcCApO1xyXG5cdFx0cmVuZGVyX2F4aXMoICRncmlkICk7XHJcblx0XHRwb3NpdGlvbl9iYXJzKCAkZ3JpZCApO1xyXG5cdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzeW5jX3Zpc2libGVfdGltZV9jb250cm9scyggJHBhZ2UsIHN0YXJ0LCBlbmQgKSB7XHJcblx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfc3RhcnQnICkudmFsKCBTdHJpbmcoIHN0YXJ0ICkgKTtcclxuXHRcdGdldF9jb250cm9sKCAkcGFnZSwgJ2RheV9lbmQnICkudmFsKCBTdHJpbmcoIGVuZCApICk7XHJcblx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfc3RhcnRfc2xpZGVyJyApLnZhbCggU3RyaW5nKCBzdGFydCApICk7XHJcblx0XHRnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfZW5kX3NsaWRlcicgKS52YWwoIFN0cmluZyggZW5kICkgKTtcclxuXHRcdCQoICcjd3BiY190c19zaWRlX3N0YXJ0JyApLnZhbCggU3RyaW5nKCBzdGFydCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9lbmQnICkudmFsKCBTdHJpbmcoIGVuZCApICk7XHJcblx0XHQkKCAnI3dwYmNfdHNfc2lkZV9zdGFydF9zbGlkZXInICkudmFsKCBTdHJpbmcoIHN0YXJ0ICkgKTtcclxuXHRcdCQoICcjd3BiY190c19zaWRlX2VuZF9zbGlkZXInICkudmFsKCBTdHJpbmcoIGVuZCApICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfdmlzaWJsZV90aW1lX3JhbmdlKCAkcGFnZSwgc3RhcnQsIGVuZCApIHtcclxuXHRcdHZhciAkZ3JpZCA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApO1xyXG5cclxuXHRcdHN0YXJ0ID0gcGFyc2VJbnQoIHN0YXJ0LCAxMCApO1xyXG5cdFx0ZW5kID0gcGFyc2VJbnQoIGVuZCwgMTAgKTtcclxuXHJcblx0XHRpZiAoIGVuZCA8PSBzdGFydCApIHtcclxuXHRcdFx0aWYgKCAkKCBkb2N1bWVudC5hY3RpdmVFbGVtZW50ICkuaXMoICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfc3RhcnRcIl0sIFtkYXRhLXdwYmMtdHMtY29udHJvbD1cImRheV9zdGFydF9zbGlkZXJcIl0sICN3cGJjX3RzX2RheV9zdGFydCwgI3dwYmNfdHNfc2lkZV9zdGFydCwgI3dwYmNfdHNfZGF5X3N0YXJ0X3NsaWRlciwgI3dwYmNfdHNfc2lkZV9zdGFydF9zbGlkZXInICkgKSB7XHJcblx0XHRcdFx0c3RhcnQgPSBNYXRoLm1heCggMCwgZW5kIC0gNjAgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRlbmQgPSBNYXRoLm1pbiggMTQ0MCwgc3RhcnQgKyA2MCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0JGdyaWQuYXR0ciggJ2RhdGEtd3BiYy10cy1zdGFydCcsIHN0YXJ0ICk7XHJcblx0XHQkZ3JpZC5hdHRyKCAnZGF0YS13cGJjLXRzLWVuZCcsIGVuZCApO1xyXG5cdFx0c3luY192aXNpYmxlX3RpbWVfY29udHJvbHMoICRwYWdlLCBzdGFydCwgZW5kICk7XHJcblxyXG5cdFx0cmVuZGVyX2F4aXMoICRncmlkICk7XHJcblx0XHRwb3NpdGlvbl9iYXJzKCAkZ3JpZCApO1xyXG5cdFx0cmVuZGVyX3NlbGVjdGlvbnMoICRwYWdlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfbW9kZSggbW9kZSApIHtcclxuXHRcdGN1cnJlbnRNb2RlID0gbW9kZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGlzX2Jhcl9zZWxlY3RhYmxlX2Zvcl90aW1lX2FjdGlvbiggJGJhciApIHtcclxuXHRcdGlmICggISAkYmFyLmxlbmd0aCApIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIChcclxuXHRcdFx0JGJhci5oYXNDbGFzcyggJ3dwYmNfdHNfYmFyX2Jsb2NrZWQnIClcclxuXHRcdFx0JiYgJzAnICE9PSAkYmFyLmF0dHIoICdkYXRhLXdwYmMtdHMtZWRpdGFibGUnIClcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBydW5fY29tbWFuZCggJHBhZ2UsIG1vZGUgKSB7XHJcblx0XHR2YXIgc2V0dGluZ3MgPSB3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX3BhZ2UgfHwge307XHJcblx0XHR2YXIgbGFiZWxzID0gc2V0dGluZ3MuaTE4biB8fCB7fTtcclxuXHRcdHZhciBwYXlsb2FkO1xyXG5cclxuXHRcdGlmICggYWN0aXZlU2F2ZVJlcXVlc3QgJiYgYWN0aXZlU2F2ZVJlcXVlc3QucmVhZHlTdGF0ZSAhPT0gNCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldF9tb2RlKCBtb2RlICk7XHJcblx0XHRpZiAoICEgc2VsZWN0aW9uUmFuZ2VzLmxlbmd0aCApIHtcclxuXHRcdFx0aWYgKCB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIGxhYmVscy5zZWxlY3Rfc2xvdHNfZmlyc3QgfHwgJ1NlbGVjdCBvbmUgb3IgbW9yZSB0aW1lIHJhbmdlcyBmaXJzdC4nLCAnd2FybmluZycsIDM1MDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0cGF5bG9hZCA9IGdldF9zZWxlY3Rpb25fcGF5bG9hZCggJHBhZ2UgKTtcclxuXHRcdGlmICggISBzZXR0aW5ncy5hamF4X3VybCB8fCAhIHNldHRpbmdzLm5vbmNlIHx8ICEgcGF5bG9hZC5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRzZXRfdGltZWxpbmVfbG9hZGluZyggJHBhZ2UsIHRydWUsIGxhYmVscy5zYXZpbmcgfHwgJ1NhdmluZycgKTtcclxuXHRcdHNldF9hY3Rpb25fYnV0dG9uc19idXN5KCAkcGFnZSwgdHJ1ZSApO1xyXG5cclxuXHRcdGFjdGl2ZVNhdmVSZXF1ZXN0ID0gJC5wb3N0KCBzZXR0aW5ncy5hamF4X3VybCwge1xyXG5cdFx0XHRhY3Rpb246ICdXUEJDX0FKWF9BVkFJTEFCSUxJVFlfVElNRVNMT1RTX1NBVkUnLFxyXG5cdFx0XHRub25jZTogc2V0dGluZ3Mubm9uY2UsXHJcblx0XHRcdHJlc291cmNlX2lkOiBnZXRfY29udHJvbCggJHBhZ2UsICdyZXNvdXJjZScgKS52YWwoKSxcclxuXHRcdFx0bW9kZTogbW9kZSxcclxuXHRcdFx0aW50ZXJ2YWxzOiBKU09OLnN0cmluZ2lmeSggcGF5bG9hZCApXHJcblx0XHR9ICkuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZSApIHtcclxuXHRcdFx0aWYgKCByZXNwb25zZSAmJiByZXNwb25zZS5zdWNjZXNzICkge1xyXG5cdFx0XHRcdGlmICggd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlICkge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdibG9jaycgPT09IG1vZGUgPyAoIGxhYmVscy5ibG9ja19zdWNjZXNzIHx8ICdTZWxlY3RlZCB0aW1lIHJhbmdlcyBoYXZlIGJlZW4gYmxvY2tlZC4nICkgOiAoIGxhYmVscy51bmJsb2NrX3N1Y2Nlc3MgfHwgJ1NlbGVjdGVkIHRpbWUgcmFuZ2VzIGhhdmUgYmVlbiB1bmJsb2NrZWQuJyApLCAnc3VjY2VzcycsIDUwMDAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y2xlYXJfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0XHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHRcdH0gZWxzZSBpZiAoIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbGFiZWxzLnNhdmVfZXJyb3IgfHwgJ1VuYWJsZSB0byBzYXZlIHRpbWUtc2xvdCBhdmFpbGFiaWxpdHkuJywgJ2Vycm9yJywgNTAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICkuZmFpbCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggbGFiZWxzLnNhdmVfZXJyb3IgfHwgJ1VuYWJsZSB0byBzYXZlIHRpbWUtc2xvdCBhdmFpbGFiaWxpdHkuJywgJ2Vycm9yJywgNTAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICkuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGFjdGl2ZVNhdmVSZXF1ZXN0ID0gbnVsbDtcclxuXHRcdFx0c2V0X2FjdGlvbl9idXR0b25zX2J1c3koICRwYWdlLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0aWYgKCAhIGFjdGl2ZUxvYWRSZXF1ZXN0IHx8IGFjdGl2ZUxvYWRSZXF1ZXN0LnJlYWR5U3RhdGUgPT09IDQgKSB7XHJcblx0XHRcdFx0c2V0X3RpbWVsaW5lX2xvYWRpbmcoICRwYWdlLCBmYWxzZSwgbGFiZWxzLmxvYWRpbmcgfHwgJ0xvYWRpbmcnICk7XHJcblx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRfZGF0ZV9yYW5nZV9waWNrZXIoICRwYWdlICkge1xyXG5cdFx0dmFyICRkYXRlID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF0ZV9yYW5nZScgKTtcclxuXHRcdHZhciAkZGF0ZVdyYXAgPSAkZGF0ZS5jbG9zZXN0KCAnLndwYmNfdHNfaW5wdXRfaWNvbicgKTtcclxuXHRcdHZhciBmaXJzdERheSA9IDA7XHJcblxyXG5cdFx0aWYgKCAhICQuZm4uZGF0ZXBpY2sgKSB7XHJcblx0XHRcdGlmICggd2luZG93LmNvbnNvbGUgKSB7XHJcblx0XHRcdFx0Y29uc29sZS5sb2coICdXUEJDIEVycm9yLiBKYXZhU2NyaXB0IGxpYnJhcnkgXCJkYXRlcGlja1wiIHdhcyBub3QgZGVmaW5lZC4nICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggd2luZG93Ll93cGJjICYmICdmdW5jdGlvbicgPT09IHR5cGVvZiB3aW5kb3cuX3dwYmMuZ2V0X290aGVyX3BhcmFtICkge1xyXG5cdFx0XHRmaXJzdERheSA9IHBhcnNlSW50KCB3aW5kb3cuX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnY2FsZW5kYXJzX19maXJzdF9kYXknICksIDEwICkgfHwgMDtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICRkYXRlLmhhc0NsYXNzKCAkLmRhdGVwaWNrLm1hcmtlckNsYXNzTmFtZSApICkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdCRkYXRlLmRhdGVwaWNrKCAnZGVzdHJveScgKTtcclxuXHRcdFx0fSBjYXRjaCAoIGVycm9yICkge31cclxuXHRcdH1cclxuXHJcblx0XHQkZGF0ZS5kYXRlcGljaygge1xyXG5cdFx0XHRiZWZvcmVTaG93RGF5OiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0cmV0dXJuIFsgdHJ1ZSwgJ2RhdGVfYXZhaWxhYmxlJyBdO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRvblNlbGVjdDogZnVuY3Rpb24gKCBzdHJpbmdEYXRlcywganNEYXRlc0FyciApIHtcclxuXHRcdFx0XHRhcHBseV9kYXRlX3JhbmdlX3NlbGVjdGlvbiggJHBhZ2UsIHBhcnNlX2RhdGVwaWNrX3NlbGVjdGlvbiggc3RyaW5nRGF0ZXMsIGpzRGF0ZXNBcnIgKSApO1xyXG5cdFx0XHR9LFxyXG5cdFx0XHRvbkNsb3NlOiBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0d2luZG93LnNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdHN5bmNfZGF0ZV9yYW5nZV9mcm9tX2lucHV0KCAkcGFnZSApO1xyXG5cdFx0XHRcdH0sIDAgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0c2hvd09uOiAnbm9uZScsXHJcblx0XHRcdHNob3dBbmltOiAnc2hvdycsXHJcblx0XHRcdGR1cmF0aW9uOiAnJyxcclxuXHRcdFx0cmFuZ2VTZWxlY3Q6IHRydWUsXHJcblx0XHRcdG11bHRpU2VsZWN0OiAwLFxyXG5cdFx0XHRudW1iZXJPZk1vbnRoczogMSxcclxuXHRcdFx0c3RlcE1vbnRoczogMSxcclxuXHRcdFx0cHJldlRleHQ6ICcmbHNhcXVvOycsXHJcblx0XHRcdG5leHRUZXh0OiAnJnJzYXF1bzsnLFxyXG5cdFx0XHRkYXRlRm9ybWF0OiAnTSBkLCB5eScsXHJcblx0XHRcdGNoYW5nZU1vbnRoOiBmYWxzZSxcclxuXHRcdFx0Y2hhbmdlWWVhcjogZmFsc2UsXHJcblx0XHRcdG1pbkRhdGU6IG51bGwsXHJcblx0XHRcdG1heERhdGU6IG51bGwsXHJcblx0XHRcdHNob3dTdGF0dXM6IGZhbHNlLFxyXG5cdFx0XHRtdWx0aVNlcGFyYXRvcjogJywgJyxcclxuXHRcdFx0Y2xvc2VBdFRvcDogbnVsbCxcclxuXHRcdFx0Zmlyc3REYXk6IGZpcnN0RGF5LFxyXG5cdFx0XHRnb3RvQ3VycmVudDogZmFsc2UsXHJcblx0XHRcdGhpZGVJZk5vUHJldk5leHQ6IHRydWUsXHJcblx0XHRcdHVzZVRoZW1lUm9sbGVyOiBmYWxzZSxcclxuXHRcdFx0bWFuZGF0b3J5OiB0cnVlXHJcblx0XHR9ICk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gc2hvd19kYXRlX3JhbmdlX3BpY2tlcigpIHtcclxuXHRcdFx0dmFyIGlucHV0ID0gJGRhdGUuZ2V0KCAwICk7XHJcblxyXG5cdFx0XHRpZiAoICEgaW5wdXQgfHwgISAkLmRhdGVwaWNrIHx8ICEgJC5kYXRlcGljay5fc2hvd0RhdGVwaWNrIHx8ICEgJGRhdGUuaGFzQ2xhc3MoICQuZGF0ZXBpY2subWFya2VyQ2xhc3NOYW1lICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICggJC5kYXRlcGljay5fbGFzdElucHV0ID09PSBpbnB1dCApICYmICEgJC5kYXRlcGljay5fZGF0ZXBpY2tlclNob3dpbmcgKSB7XHJcblx0XHRcdFx0JC5kYXRlcGljay5fbGFzdElucHV0ID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAoICQuZGF0ZXBpY2suX2xhc3RJbnB1dCA9PT0gaW5wdXQgKSAmJiAkLmRhdGVwaWNrLl9kYXRlcGlja2VyU2hvd2luZyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCQuZGF0ZXBpY2suX3Nob3dEYXRlcGljayggaW5wdXQgKTtcclxuXHRcdFx0JCggJyNkYXRlcGljay1kaXYsIC5kYXRlcGljay1wb3B1cCcgKS5jc3MoICd6LWluZGV4JywgMTAwMDAxMCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRkYXRlLm9mZiggJ2NsaWNrLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuIGZvY3VzLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuIGtleWRvd24ud3BiY190c19kYXRlX3JhbmdlX29wZW4nICkub24oICdjbGljay53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbiBmb2N1cy53cGJjX3RzX2RhdGVfcmFuZ2Vfb3BlbiBrZXlkb3duLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0aWYgKCAna2V5ZG93bicgPT09IGV2ZW50LnR5cGUgJiYgKCAxMyAhPT0gZXZlbnQud2hpY2ggKSAmJiAoIDMyICE9PSBldmVudC53aGljaCApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAna2V5ZG93bicgPT09IGV2ZW50LnR5cGUgKSB7XHJcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2hvd19kYXRlX3JhbmdlX3BpY2tlcigpO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRkYXRlV3JhcC5vZmYoICdtb3VzZWRvd24ud3BiY190c19kYXRlX3JhbmdlX29wZW4gY2xpY2sud3BiY190c19kYXRlX3JhbmdlX29wZW4nIClcclxuXHRcdFx0Lm9uKCAnbW91c2Vkb3duLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0fSApXHJcblx0XHRcdC5vbiggJ2NsaWNrLndwYmNfdHNfZGF0ZV9yYW5nZV9vcGVuJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0XHRpZiAoIGV2ZW50LnRhcmdldCAhPT0gJGRhdGUuZ2V0KCAwICkgKSB7XHJcblx0XHRcdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0JGRhdGUudHJpZ2dlciggJ2ZvY3VzJyApO1xyXG5cdFx0XHRcdHNob3dfZGF0ZV9yYW5nZV9waWNrZXIoKTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdCRkYXRlLm9uKCAnY2hhbmdlIGlucHV0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzeW5jX2RhdGVfcmFuZ2VfZnJvbV9pbnB1dCggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRfcmlnaHRiYXJfdGFicygpIHtcclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY190c19yaWdodGJhcl90YWJzIFtyb2xlPVwidGFiXCJdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0dmFyICR0YWIgPSAkKCB0aGlzICk7XHJcblx0XHRcdHZhciBwYW5lbElkID0gJHRhYi5hdHRyKCAnYXJpYS1jb250cm9scycgKTtcclxuXHRcdFx0dmFyICRwYW5lbCA9ICQoICcjJyArIHBhbmVsSWQgKTtcclxuXHRcdFx0dmFyICR0YWJsaXN0ID0gJHRhYi5jbG9zZXN0KCAnW3JvbGU9XCJ0YWJsaXN0XCJdJyApO1xyXG5cclxuXHRcdFx0aWYgKCAhICRwYW5lbC5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHQkdGFibGlzdC5maW5kKCAnW3JvbGU9XCJ0YWJcIl0nICkuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICk7XHJcblx0XHRcdCR0YWIuYXR0ciggJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0JCggJy53cGJjX3RzX3JpZ2h0YmFyX3BhbmVscyAud3BiY19iZmJfX3BhbGV0dGVfcGFuZWwnICkuYXR0ciggJ2hpZGRlbicsICdoaWRkZW4nICkuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ3RydWUnICk7XHJcblx0XHRcdCRwYW5lbC5yZW1vdmVBdHRyKCAnaGlkZGVuJyApLmF0dHIoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRfdGltZV9zbG90c19wYWdlKCBjb250ZXh0LCBmb3JjZSApIHtcclxuXHRcdHZhciAkY29udGV4dCA9IGNvbnRleHQgPyAkKCBjb250ZXh0ICkgOiAkKCBkb2N1bWVudCApO1xyXG5cdFx0dmFyICRwYWdlcyA9ICRjb250ZXh0LmlzKCAnLndwYmNfdHNfcGFnZScgKSA/ICRjb250ZXh0IDogJGNvbnRleHQuZmluZCggJy53cGJjX3RzX3BhZ2UnICk7XHJcblxyXG5cdFx0aWYgKCAhICRwYWdlcy5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgZm9yY2UgKSB7XHJcblx0XHRcdCRwYWdlcyA9ICRwYWdlcy5maWx0ZXIoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRyZXR1cm4gJzAnICE9PSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1hdXRvLWluaXQnICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHQkcGFnZXMuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpbml0X3RpbWVfc2xvdHNfY29tcG9uZW50KCAkKCB0aGlzICkgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGluaXRfdGltZV9zbG90c19jb21wb25lbnQoICRwYWdlICkge1xyXG5cdFx0dmFyICRncmlkO1xyXG5cdFx0dmFyIGlzRHJhZ2dpbmcgPSBmYWxzZTtcclxuXHRcdHZhciBkcmFnU3RhcnRNaW51dGUgPSAwO1xyXG5cdFx0dmFyIGRyYWdTdGFydFJvdyA9IG51bGw7XHJcblx0XHR2YXIgZHJhZ1NlbGVjdGlvbklkID0gJyc7XHJcblx0XHR2YXIgcmVzaXplTW9kZSA9ICcnO1xyXG5cclxuXHRcdGlmICggJHBhZ2UuYXR0ciggJ2RhdGEtd3BiYy10cy1pbml0aWFsaXplZCcgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0JHBhZ2UuYXR0ciggJ2RhdGEtd3BiYy10cy1pbml0aWFsaXplZCcsICcxJyApO1xyXG5cclxuXHRcdGNhY2hlX3Jvd190ZW1wbGF0ZXMoICRwYWdlICk7XHJcblx0XHQkZ3JpZCA9ICRwYWdlLmZpbmQoICcud3BiY190c19ncmlkJyApO1xyXG5cdFx0cmVuZGVyX2F4aXMoICRncmlkICk7XHJcblx0XHRwb3NpdGlvbl9iYXJzKCAkZ3JpZCApO1xyXG5cdFx0aW5pdF9kYXRlX3JhbmdlX3BpY2tlciggJHBhZ2UgKTtcclxuXHRcdGxvYWRfYmxvY2tlZF9pbnRlcnZhbHMoICRwYWdlICk7XHJcblx0XHRzZXRfbW9kZSggY3VycmVudE1vZGUgKTtcclxuXHRcdHN5bmNfc2xvdF9zdGVwX2NvbnRyb2xzKCAkcGFnZSwgZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApLnN0ZXAgKTtcclxuXHRcdHN5bmNfem9vbV9jb250cm9scyggJHBhZ2UsIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKS5zdGVwICk7XHJcblx0XHRzeW5jX3Zpc2libGVfdGltZV9jb250cm9scyggJHBhZ2UsIGdldF9ncmlkX2NvbmZpZyggJGdyaWQgKS5zdGFydCwgZ2V0X2dyaWRfY29uZmlnKCAkZ3JpZCApLmVuZCApO1xyXG5cdFx0YmluZF9mbG9hdGluZ19oZWFkZXIoICRwYWdlICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdjaGFuZ2UnLCAnW2RhdGEtd3BiYy10cy1jb250cm9sPVwic2xvdF9zdGVwXCJdLCAjd3BiY190c19zbG90X3N0ZXAnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF9zdGVwKCAkcGFnZSwgcGFyc2VJbnQoICQoIHRoaXMgKS52YWwoKSwgMTAgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjaGFuZ2UnLCAnI3dwYmNfdHNfc2lkZV9zbG90X3N0ZXAnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF9zdGVwKCAkcGFnZSwgcGFyc2VJbnQoICQoIHRoaXMgKS52YWwoKSwgMTAgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtdHMtY29udHJvbD1cInJlc291cmNlXCJdLCAjd3BiY190c19yZXNvdXJjZScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0bG9hZF9ibG9ja2VkX2ludGVydmFscyggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2lucHV0IGNoYW5nZScsICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJ6b29tXCJdLCAjd3BiY190c196b29tJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgaW5kZXggPSBwYXJzZUludCggJCggdGhpcyApLnZhbCgpLCAxMCApO1xyXG5cdFx0XHRzZXRfc3RlcCggJHBhZ2UsIHpvb21TdGVwc1sgaW5kZXggXSB8fCAxNSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2UnLCAnI3dwYmNfdHNfc2lkZV96b29tJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR2YXIgaW5kZXggPSBwYXJzZUludCggJCggdGhpcyApLnZhbCgpLCAxMCApO1xyXG5cdFx0XHRzZXRfc3RlcCggJHBhZ2UsIHpvb21TdGVwc1sgaW5kZXggXSB8fCAxNSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy10cy16b29tXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyICR6b29tID0gZ2V0X2NvbnRyb2woICRwYWdlLCAnem9vbScgKTtcclxuXHRcdFx0dmFyIHZhbHVlID0gcGFyc2VJbnQoICR6b29tLnZhbCgpLCAxMCApO1xyXG5cdFx0XHR2YWx1ZSArPSAnaW4nID09PSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy16b29tJyApID8gMSA6IC0xO1xyXG5cdFx0XHR2YWx1ZSA9IGNsYW1wKCB2YWx1ZSwgMCwgem9vbVN0ZXBzLmxlbmd0aCAtIDEgKTtcclxuXHRcdFx0JHpvb20udmFsKCBTdHJpbmcoIHZhbHVlICkgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdjbGljaycsICcud3BiY190c19yaWdodGJhcl9wYW5lbHMgW2RhdGEtd3BiYy10cy16b29tXScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyICR6b29tID0gJCggJyN3cGJjX3RzX3NpZGVfem9vbScgKTtcclxuXHRcdFx0dmFyIHZhbHVlID0gcGFyc2VJbnQoICR6b29tLnZhbCgpLCAxMCApO1xyXG5cdFx0XHR2YWx1ZSArPSAnaW4nID09PSAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy16b29tJyApID8gMSA6IC0xO1xyXG5cdFx0XHR2YWx1ZSA9IGNsYW1wKCB2YWx1ZSwgMCwgem9vbVN0ZXBzLmxlbmd0aCAtIDEgKTtcclxuXHRcdFx0JHpvb20udmFsKCBTdHJpbmcoIHZhbHVlICkgKS50cmlnZ2VyKCAnY2hhbmdlJyApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2hhbmdlJywgJ1tkYXRhLXdwYmMtdHMtY29udHJvbD1cImRheV9zdGFydFwiXSwgW2RhdGEtd3BiYy10cy1jb250cm9sPVwiZGF5X2VuZFwiXSwgI3dwYmNfdHNfZGF5X3N0YXJ0LCAjd3BiY190c19kYXlfZW5kJywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRzZXRfdmlzaWJsZV90aW1lX3JhbmdlKCAkcGFnZSwgZ2V0X2NvbnRyb2woICRwYWdlLCAnZGF5X3N0YXJ0JyApLnZhbCgpLCBnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfZW5kJyApLnZhbCgpICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vbiggJ2NoYW5nZScsICcjd3BiY190c19zaWRlX3N0YXJ0LCAjd3BiY190c19zaWRlX2VuZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X3Zpc2libGVfdGltZV9yYW5nZSggJHBhZ2UsICQoICcjd3BiY190c19zaWRlX3N0YXJ0JyApLnZhbCgpLCAkKCAnI3dwYmNfdHNfc2lkZV9lbmQnICkudmFsKCkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2lucHV0IGNoYW5nZScsICdbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfc3RhcnRfc2xpZGVyXCJdLCBbZGF0YS13cGJjLXRzLWNvbnRyb2w9XCJkYXlfZW5kX3NsaWRlclwiXSwgI3dwYmNfdHNfZGF5X3N0YXJ0X3NsaWRlciwgI3dwYmNfdHNfZGF5X2VuZF9zbGlkZXInLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHNldF92aXNpYmxlX3RpbWVfcmFuZ2UoICRwYWdlLCBnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfc3RhcnRfc2xpZGVyJyApLnZhbCgpLCBnZXRfY29udHJvbCggJHBhZ2UsICdkYXlfZW5kX3NsaWRlcicgKS52YWwoKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICdpbnB1dCBjaGFuZ2UnLCAnI3dwYmNfdHNfc2lkZV9zdGFydF9zbGlkZXIsICN3cGJjX3RzX3NpZGVfZW5kX3NsaWRlcicsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0c2V0X3Zpc2libGVfdGltZV9yYW5nZSggJHBhZ2UsICQoICcjd3BiY190c19zaWRlX3N0YXJ0X3NsaWRlcicgKS52YWwoKSwgJCggJyN3cGJjX3RzX3NpZGVfZW5kX3NsaWRlcicgKS52YWwoKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy10cy1jb21tYW5kXScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdHJ1bl9jb21tYW5kKCAkcGFnZSwgJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtY29tbWFuZCcgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnY2xpY2snLCAnW2RhdGEtd3BiYy10cy1yYW5nZS1zaGlmdF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRzaGlmdF9kYXRlX3JhbmdlKCAkcGFnZSwgJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtcmFuZ2Utc2hpZnQnICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJ1tkYXRhLXdwYmMtdHMtY3JlYXRlLWJvb2tpbmddJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0Y3JlYXRlX2Jvb2tpbmdfZnJvbV9hY3RpdmVfc2VsZWN0aW9uKCAkcGFnZSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLmNsb3Nlc3QoICcubW9kYWwnICkub2ZmKCAnY2xpY2sud3BiY190c19jcmVhdGVfYm9va2luZycgKS5vbiggJ2NsaWNrLndwYmNfdHNfY3JlYXRlX2Jvb2tpbmcnLCAnW2RhdGEtd3BiYy10cy1jcmVhdGUtYm9va2luZ10nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRjcmVhdGVfYm9va2luZ19mcm9tX2FjdGl2ZV9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2UuY2xvc2VzdCggJy5tb2RhbCcgKS5vZmYoICdjbGljay53cGJjX3RzX2Zvb3Rlcl9jb21tYW5kJyApLm9uKCAnY2xpY2sud3BiY190c19mb290ZXJfY29tbWFuZCcsICdbZGF0YS13cGJjLXRzLWNvbW1hbmRdJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0cnVuX2NvbW1hbmQoICRwYWdlLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1jb21tYW5kJyApICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2UuY2xvc2VzdCggJy5tb2RhbCcgKS5vZmYoICdjbGljay53cGJjX3RzX2Zvb3Rlcl9jbGVhcicgKS5vbiggJ2NsaWNrLndwYmNfdHNfZm9vdGVyX2NsZWFyJywgJy53cGJjX3RzX2NsZWFyX3NlbGVjdGlvbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJy53cGJjX3RzX2Jhcl9ib29rZWQnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRoYW5kbGVfYm9va2VkX2Jhcl9jbGljayggJHBhZ2UsIGV2ZW50ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JCggZG9jdW1lbnQgKS5vZmYoICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX2NvbW1hbmQnICkub24oICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX2NvbW1hbmQnLCAnLndwYmNfdHNfcmlnaHRiYXJfcGFuZWxzIFtkYXRhLXdwYmMtdHMtY29tbWFuZF0nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRydW5fY29tbWFuZCggJHBhZ2UsICQoIHRoaXMgKS5hdHRyKCAnZGF0YS13cGJjLXRzLWNvbW1hbmQnICkgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9mZiggJ2NsaWNrLndwYmNfdHNfcmlnaHRiYXJfcmFuZ2Vfc2hpZnQnICkub24oICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX3JhbmdlX3NoaWZ0JywgJy53cGJjX3RzX3JpZ2h0YmFyX3BhbmVscyBbZGF0YS13cGJjLXRzLXJhbmdlLXNoaWZ0XScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdHNoaWZ0X2RhdGVfcmFuZ2UoICRwYWdlLCAkKCB0aGlzICkuYXR0ciggJ2RhdGEtd3BiYy10cy1yYW5nZS1zaGlmdCcgKSApO1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdCRwYWdlLm9uKCAnbW91c2Vkb3duIHRvdWNoc3RhcnQnLCAnLndwYmNfdHNfaGFuZGxlJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0dmFyICRzZWxlY3Rpb24gPSAkKCB0aGlzICkuY2xvc2VzdCggJy53cGJjX3RzX3NlbGVjdGlvbicgKTtcclxuXHRcdFx0dmFyICRsYW5lID0gJHNlbGVjdGlvbi5jbG9zZXN0KCAnLndwYmNfdHNfbGFuZScgKTtcclxuXHRcdFx0aXNEcmFnZ2luZyA9IHRydWU7XHJcblx0XHRcdHJlc2l6ZU1vZGUgPSAkKCB0aGlzICkuaGFzQ2xhc3MoICd3cGJjX3RzX2hhbmRsZV9zdGFydCcgKSA/ICdzdGFydCcgOiAnZW5kJztcclxuXHRcdFx0YWN0aXZlU2VsZWN0aW9uSWQgPSAkc2VsZWN0aW9uLmF0dHIoICdkYXRhLXdwYmMtdHMtc2VsZWN0aW9uLWlkJyApO1xyXG5cdFx0XHRkcmFnU2VsZWN0aW9uSWQgPSBhY3RpdmVTZWxlY3Rpb25JZDtcclxuXHRcdFx0ZHJhZ1N0YXJ0Um93ID0gJGxhbmUuY2xvc2VzdCggJy53cGJjX3RzX3JvdycgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXJvdycgKTtcclxuXHRcdFx0ZHJhZ1N0YXJ0TWludXRlID0gbWludXRlX2Zyb21fcG9pbnRlciggZXZlbnQsICRsYW5lICk7XHJcblx0XHRcdHJlbmRlcl9zZWxlY3Rpb25zKCAkcGFnZSApO1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ21vdXNlZG93biB0b3VjaHN0YXJ0JywgJy53cGJjX3RzX3NlbGVjdGlvbjpub3QoLndwYmNfdHNfc2VsZWN0aW9uX3RlbXBsYXRlKScsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGlmICggJCggZXZlbnQudGFyZ2V0ICkuY2xvc2VzdCggJy53cGJjX3RzX2hhbmRsZScgKS5sZW5ndGggKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGFjdGl2ZVNlbGVjdGlvbklkID0gJCggdGhpcyApLmF0dHIoICdkYXRhLXdwYmMtdHMtc2VsZWN0aW9uLWlkJyApO1xyXG5cdFx0XHRyZW5kZXJfc2VsZWN0aW9ucyggJHBhZ2UgKTtcclxuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0JHBhZ2Uub24oICdtb3VzZWRvd24gdG91Y2hzdGFydCcsICcud3BiY190c19sYW5lJywgZnVuY3Rpb24gKCBldmVudCApIHtcclxuXHRcdFx0dmFyICRsYW5lID0gJCggdGhpcyApO1xyXG5cdFx0XHR2YXIgJGJhclRhcmdldCA9ICQoIGV2ZW50LnRhcmdldCApLmNsb3Nlc3QoICcud3BiY190c19iYXInICk7XHJcblx0XHRcdHZhciBzdGVwO1xyXG5cclxuXHRcdFx0aWYgKCAkKCBldmVudC50YXJnZXQgKS5jbG9zZXN0KCAnLndwYmNfdHNfc2VsZWN0aW9uOm5vdCgud3BiY190c19zZWxlY3Rpb25fdGVtcGxhdGUpJyApLmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAkYmFyVGFyZ2V0Lmxlbmd0aCAmJiAhIGlzX2Jhcl9zZWxlY3RhYmxlX2Zvcl90aW1lX2FjdGlvbiggJGJhclRhcmdldCApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aXNEcmFnZ2luZyA9IHRydWU7XHJcblx0XHRcdHJlc2l6ZU1vZGUgPSAnJztcclxuXHRcdFx0ZHJhZ1N0YXJ0Um93ID0gJGxhbmUuY2xvc2VzdCggJy53cGJjX3RzX3JvdycgKS5hdHRyKCAnZGF0YS13cGJjLXRzLXJvdycgKTtcclxuXHRcdFx0ZHJhZ1N0YXJ0TWludXRlID0gbWludXRlX2Zyb21fcG9pbnRlciggZXZlbnQsICRsYW5lICk7XHJcblx0XHRcdHN0ZXAgPSBnZXRfZ3JpZF9jb25maWcoICRncmlkICkuc3RlcDtcclxuXHRcdFx0ZHJhZ1NlbGVjdGlvbklkID0gY3JlYXRlX3NlbGVjdGlvbiggJHBhZ2UsIFsgZHJhZ1N0YXJ0Um93IF0sIGRyYWdTdGFydE1pbnV0ZSwgZHJhZ1N0YXJ0TWludXRlICsgc3RlcCApLmlkO1xyXG5cdFx0XHRzaG93X2xpdmVfdGlwKCAkcGFnZSwgZXZlbnQgKTtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnbW91c2Vtb3ZlLndwYmNfdHMgdG91Y2htb3ZlLndwYmNfdHMnLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHR2YXIgY3VycmVudFJvdztcclxuXHRcdFx0dmFyIHJvd3M7XHJcblx0XHRcdHZhciAkbGFuZTtcclxuXHRcdFx0dmFyIG1pbnV0ZTtcclxuXHRcdFx0dmFyIGl0ZW07XHJcblxyXG5cdFx0XHRpZiAoICEgaXNEcmFnZ2luZyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGl0ZW0gPSBnZXRfc2VsZWN0aW9uX2J5X2lkKCBkcmFnU2VsZWN0aW9uSWQgKTtcclxuXHRcdFx0aWYgKCAhIGl0ZW0gKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjdXJyZW50Um93ID0gcm93X2Zyb21fcG9pbnRlciggJHBhZ2UsIGV2ZW50ICkgfHwgZHJhZ1N0YXJ0Um93O1xyXG5cdFx0XHRyb3dzID0gZ2V0X3Jvd3NfYmV0d2VlbiggJHBhZ2UsIGRyYWdTdGFydFJvdywgY3VycmVudFJvdyApO1xyXG5cdFx0XHQkbGFuZSA9ICRwYWdlLmZpbmQoICcud3BiY190c19yb3dbZGF0YS13cGJjLXRzLXJvdz1cIicgKyBkcmFnU3RhcnRSb3cgKyAnXCJdIC53cGJjX3RzX2xhbmUnICk7XHJcblx0XHRcdG1pbnV0ZSA9IG1pbnV0ZV9mcm9tX3BvaW50ZXIoIGV2ZW50LCAkbGFuZSApO1xyXG5cclxuXHRcdFx0aWYgKCAnc3RhcnQnID09PSByZXNpemVNb2RlICkge1xyXG5cdFx0XHRcdHVwZGF0ZV9zZWxlY3Rpb24oICRwYWdlLCBpdGVtLmlkLCBpdGVtLnJvd3MsIG1pbnV0ZSwgaXRlbS5lbmQgKTtcclxuXHRcdFx0fSBlbHNlIGlmICggJ2VuZCcgPT09IHJlc2l6ZU1vZGUgKSB7XHJcblx0XHRcdFx0dXBkYXRlX3NlbGVjdGlvbiggJHBhZ2UsIGl0ZW0uaWQsIGl0ZW0ucm93cywgaXRlbS5zdGFydCwgbWludXRlICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dXBkYXRlX3NlbGVjdGlvbiggJHBhZ2UsIGl0ZW0uaWQsIHJvd3MsIGRyYWdTdGFydE1pbnV0ZSwgbWludXRlICk7XHJcblx0XHRcdH1cclxuXHRcdFx0ZHJhZ1NlbGVjdGlvbklkID0gYWN0aXZlU2VsZWN0aW9uSWQ7XHJcblxyXG5cdFx0XHRzaG93X2xpdmVfdGlwKCAkcGFnZSwgZXZlbnQgKTtcclxuXHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9uKCAnbW91c2V1cC53cGJjX3RzIHRvdWNoZW5kLndwYmNfdHMnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlzRHJhZ2dpbmcgPSBmYWxzZTtcclxuXHRcdFx0cmVzaXplTW9kZSA9ICcnO1xyXG5cdFx0XHRkcmFnU2VsZWN0aW9uSWQgPSAnJztcclxuXHRcdFx0aGlkZV9saXZlX3RpcCggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkcGFnZS5vbiggJ2NsaWNrJywgJy53cGJjX3RzX2NsZWFyX3NlbGVjdGlvbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdGNsZWFyX3NlbGVjdGlvbiggJHBhZ2UgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHQkKCBkb2N1bWVudCApLm9mZiggJ2NsaWNrLndwYmNfdHNfcmlnaHRiYXJfY2xlYXInICkub24oICdjbGljay53cGJjX3RzX3JpZ2h0YmFyX2NsZWFyJywgJy53cGJjX3RzX3JpZ2h0YmFyX3BhbmVscyAud3BiY190c19jbGVhcl9zZWxlY3Rpb24nLCBmdW5jdGlvbiAoIGV2ZW50ICkge1xyXG5cdFx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRjbGVhcl9zZWxlY3Rpb24oICRwYWdlICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHR3aW5kb3cud3BiY19hdmFpbGFiaWxpdHlfdGltZXNsb3RzX2luaXQgPSBmdW5jdGlvbiAoIGNvbnRleHQgKSB7XHJcblx0XHRpbml0X3RpbWVfc2xvdHNfcGFnZSggY29udGV4dCB8fCBkb2N1bWVudCwgdHJ1ZSApO1xyXG5cdH07XHJcblx0d2luZG93LndwYmNfYXZhaWxhYmlsaXR5X3RpbWVzbG90c19zZXRfY29udGV4dCA9IHNldF90aW1lX3Nsb3RzX2NvbnRleHQ7XHJcblxyXG5cdCQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdGluaXRfcmlnaHRiYXJfdGFicygpO1xyXG5cdFx0aW5pdF90aW1lX3Nsb3RzX3BhZ2UoIGRvY3VtZW50LCBmYWxzZSApO1xyXG5cclxuXHRcdCQoIGRvY3VtZW50ICkub24oICd3cGJjX2F2YWlsYWJpbGl0eV90aW1lc2xvdHNfaW5pdCcsIGZ1bmN0aW9uICggZXZlbnQsIGNvbnRleHQgKSB7XHJcblx0XHRcdGluaXRfdGltZV9zbG90c19wYWdlKCBjb250ZXh0IHx8IGRvY3VtZW50LCB0cnVlICk7XHJcblx0XHR9ICk7XHJcblx0fSApO1xyXG59KCBqUXVlcnkgKSApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0UsV0FBV0EsQ0FBQyxFQUFHO0VBQ2hCLFlBQVk7O0VBRVosSUFBSUMsU0FBUyxHQUFHLENBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBRTtFQUNyQyxJQUFJQyxXQUFXLEdBQUcsT0FBTztFQUN6QixJQUFJQyxlQUFlLEdBQUcsRUFBRTtFQUN4QixJQUFJQyxpQkFBaUIsR0FBRyxFQUFFO0VBQzFCLElBQUlDLFlBQVksR0FBRyxFQUFFO0VBQ3JCLElBQUlDLGVBQWUsR0FBRyxDQUFDO0VBQ3ZCLElBQUlDLGtCQUFrQixHQUFHLENBQUM7RUFDMUIsSUFBSUMsaUJBQWlCLEdBQUcsSUFBSTtFQUM1QixJQUFJQyxtQkFBbUIsR0FBRyxDQUFDO0VBQzNCLElBQUlDLGlCQUFpQixHQUFHLElBQUk7RUFFNUIsU0FBU0MsS0FBS0EsQ0FBRUMsS0FBSyxFQUFHO0lBQ3ZCLE9BQU8sQ0FBRUEsS0FBSyxHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxJQUFLQSxLQUFLO0VBQ3pDO0VBRUEsU0FBU0MsZUFBZUEsQ0FBRUMsT0FBTyxFQUFHO0lBQ25DLElBQUlDLEtBQUssR0FBR0MsSUFBSSxDQUFDQyxLQUFLLENBQUVILE9BQU8sR0FBRyxFQUFHLENBQUM7SUFDdEMsSUFBSUksSUFBSSxHQUFHSixPQUFPLEdBQUcsRUFBRTtJQUN2QixPQUFPSCxLQUFLLENBQUVJLEtBQU0sQ0FBQyxHQUFHLEdBQUcsR0FBR0osS0FBSyxDQUFFTyxJQUFLLENBQUM7RUFDNUM7RUFFQSxTQUFTQyxLQUFLQSxDQUFFUCxLQUFLLEVBQUVRLEdBQUcsRUFBRUMsR0FBRyxFQUFHO0lBQ2pDLE9BQU9MLElBQUksQ0FBQ0ssR0FBRyxDQUFFRCxHQUFHLEVBQUVKLElBQUksQ0FBQ0ksR0FBRyxDQUFFQyxHQUFHLEVBQUVULEtBQU0sQ0FBRSxDQUFDO0VBQy9DO0VBRUEsU0FBU1UsV0FBV0EsQ0FBRUMsTUFBTSxFQUFFQyxJQUFJLEVBQUc7SUFDcEMsT0FBT1IsSUFBSSxDQUFDUyxLQUFLLENBQUVGLE1BQU0sR0FBR0MsSUFBSyxDQUFDLEdBQUdBLElBQUk7RUFDMUM7RUFFQSxTQUFTRSxlQUFlQSxDQUFFQyxLQUFLLEVBQUc7SUFDakMsT0FBTztNQUNOQyxLQUFLLEVBQUVDLFFBQVEsQ0FBRUYsS0FBSyxDQUFDRyxJQUFJLENBQUUsb0JBQXFCLENBQUMsRUFBRSxFQUFHLENBQUMsSUFBSSxDQUFDO01BQzlEQyxHQUFHLEVBQUVGLFFBQVEsQ0FBRUYsS0FBSyxDQUFDRyxJQUFJLENBQUUsa0JBQW1CLENBQUMsRUFBRSxFQUFHLENBQUMsSUFBSSxJQUFJO01BQzdETixJQUFJLEVBQUVLLFFBQVEsQ0FBRUYsS0FBSyxDQUFDRyxJQUFJLENBQUUsbUJBQW9CLENBQUMsRUFBRSxFQUFHLENBQUMsSUFBSTtJQUM1RCxDQUFDO0VBQ0Y7RUFFQSxTQUFTRSxXQUFXQSxDQUFFQyxLQUFLLEVBQUVDLElBQUksRUFBRztJQUNuQyxJQUFJQyxRQUFRLEdBQUdGLEtBQUssQ0FBQ0csSUFBSSxDQUFFLHlCQUF5QixHQUFHRixJQUFJLEdBQUcsSUFBSyxDQUFDLENBQUNHLEtBQUssQ0FBQyxDQUFDO0lBRTVFLElBQUssQ0FBRUYsUUFBUSxDQUFDRyxNQUFNLEVBQUc7TUFDeEJILFFBQVEsR0FBR0YsS0FBSyxDQUFDRyxJQUFJLENBQUUsV0FBVyxHQUFHRixJQUFLLENBQUMsQ0FBQ0csS0FBSyxDQUFDLENBQUM7SUFDcEQ7SUFFQSxPQUFPRixRQUFRO0VBQ2hCO0VBRUEsU0FBU0ksa0JBQWtCQSxDQUFFaEIsTUFBTSxFQUFFaUIsTUFBTSxFQUFHO0lBQzdDLE9BQVMsQ0FBRWpCLE1BQU0sR0FBR2lCLE1BQU0sQ0FBQ1osS0FBSyxLQUFPWSxNQUFNLENBQUNULEdBQUcsR0FBR1MsTUFBTSxDQUFDWixLQUFLLENBQUUsR0FBSyxHQUFHO0VBQzNFO0VBRUEsU0FBU2EseUJBQXlCQSxDQUFFYixLQUFLLEVBQUVHLEdBQUcsRUFBRVMsTUFBTSxFQUFHO0lBQ3hEWixLQUFLLEdBQUdULEtBQUssQ0FBRUcsV0FBVyxDQUFFTSxLQUFLLEVBQUVZLE1BQU0sQ0FBQ2hCLElBQUssQ0FBQyxFQUFFZ0IsTUFBTSxDQUFDWixLQUFLLEVBQUVZLE1BQU0sQ0FBQ1QsR0FBSSxDQUFDO0lBQzVFQSxHQUFHLEdBQUdaLEtBQUssQ0FBRUcsV0FBVyxDQUFFUyxHQUFHLEVBQUVTLE1BQU0sQ0FBQ2hCLElBQUssQ0FBQyxFQUFFZ0IsTUFBTSxDQUFDWixLQUFLLEVBQUVZLE1BQU0sQ0FBQ1QsR0FBSSxDQUFDO0lBRXhFLElBQUtILEtBQUssS0FBS0csR0FBRyxFQUFHO01BQ3BCQSxHQUFHLEdBQUdaLEtBQUssQ0FBRVMsS0FBSyxHQUFHWSxNQUFNLENBQUNoQixJQUFJLEVBQUVnQixNQUFNLENBQUNaLEtBQUssRUFBRVksTUFBTSxDQUFDVCxHQUFJLENBQUM7TUFDNUQsSUFBS0gsS0FBSyxLQUFLRyxHQUFHLEVBQUc7UUFDcEJILEtBQUssR0FBR1QsS0FBSyxDQUFFWSxHQUFHLEdBQUdTLE1BQU0sQ0FBQ2hCLElBQUksRUFBRWdCLE1BQU0sQ0FBQ1osS0FBSyxFQUFFWSxNQUFNLENBQUNULEdBQUksQ0FBQztNQUM3RDtJQUNEO0lBRUEsT0FBTztNQUNOSCxLQUFLLEVBQUVaLElBQUksQ0FBQ0ksR0FBRyxDQUFFUSxLQUFLLEVBQUVHLEdBQUksQ0FBQztNQUM3QkEsR0FBRyxFQUFFZixJQUFJLENBQUNLLEdBQUcsQ0FBRU8sS0FBSyxFQUFFRyxHQUFJO0lBQzNCLENBQUM7RUFDRjtFQUVBLFNBQVNXLG1CQUFtQkEsQ0FBRUMsV0FBVyxFQUFHO0lBQzNDLElBQUlDLEtBQUssR0FBRyxJQUFJO0lBQ2hCNUMsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFMUMsZUFBZSxFQUFFLFVBQVcyQyxLQUFLLEVBQUVDLElBQUksRUFBRztNQUNqRCxJQUFLQSxJQUFJLENBQUNDLEVBQUUsS0FBS0wsV0FBVyxFQUFHO1FBQzlCQyxLQUFLLEdBQUdHLElBQUk7UUFDWixPQUFPLEtBQUs7TUFDYjtNQUNBLE9BQU8sSUFBSTtJQUNaLENBQUUsQ0FBQztJQUNILE9BQU9ILEtBQUs7RUFDYjtFQUVBLFNBQVNLLFdBQVdBLENBQUV0QixLQUFLLEVBQUc7SUFDN0IsSUFBSWEsTUFBTSxHQUFHZCxlQUFlLENBQUVDLEtBQU0sQ0FBQztJQUNyQyxJQUFJdUIsS0FBSyxHQUFHdkIsS0FBSyxDQUFDUyxJQUFJLENBQUUsb0JBQXFCLENBQUM7SUFDOUMsSUFBSWUsSUFBSSxHQUFHLEVBQUU7SUFDYixJQUFJNUIsTUFBTTtJQUNWLElBQUk2QixTQUFTLEdBQUdwQyxJQUFJLENBQUNLLEdBQUcsQ0FBRSxDQUFDLEVBQUUsQ0FBRW1CLE1BQU0sQ0FBQ1QsR0FBRyxHQUFHUyxNQUFNLENBQUNaLEtBQUssSUFBS1ksTUFBTSxDQUFDaEIsSUFBSyxDQUFDO0lBQzFFLElBQUk2QixZQUFZLEdBQUdyQyxJQUFJLENBQUNLLEdBQUcsQ0FBRSxDQUFDLEVBQUUsQ0FBRW1CLE1BQU0sQ0FBQ1QsR0FBRyxHQUFHUyxNQUFNLENBQUNaLEtBQUssSUFBSyxFQUFHLENBQUM7SUFDcEUsSUFBSTBCLFlBQVksR0FBR25DLEtBQUssQ0FBRUgsSUFBSSxDQUFDUyxLQUFLLENBQUUsRUFBRSxHQUFLNEIsWUFBWSxHQUFHLElBQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFHLENBQUM7SUFDOUUsSUFBSUUsY0FBYyxHQUFHRixZQUFZLElBQUksRUFBRSxHQUFHLEdBQUcsR0FBRyxHQUFHO0lBQ25ELElBQUlHLFNBQVMsR0FBR3hDLElBQUksQ0FBQ3lDLElBQUksQ0FBRWpCLE1BQU0sQ0FBQ1osS0FBSyxHQUFHLEVBQUcsQ0FBQyxHQUFHLEVBQUU7SUFFbkRELEtBQUssQ0FBQytCLEdBQUcsQ0FBRSxzQkFBc0IsRUFBRU4sU0FBVSxDQUFDO0lBQzlDekIsS0FBSyxDQUFDK0IsR0FBRyxDQUFFLDJCQUEyQixFQUFFSixZQUFZLEdBQUcsSUFBSyxDQUFDO0lBQzdEM0IsS0FBSyxDQUFDK0IsR0FBRyxDQUFFLDZCQUE2QixFQUFFSCxjQUFlLENBQUM7SUFFMUQsS0FBTWhDLE1BQU0sR0FBR2lDLFNBQVMsRUFBRWpDLE1BQU0sSUFBSWlCLE1BQU0sQ0FBQ1QsR0FBRyxFQUFFUixNQUFNLElBQUksRUFBRSxFQUFHO01BQzlENEIsSUFBSSxJQUFJLCtDQUErQyxHQUFHWixrQkFBa0IsQ0FBRWhCLE1BQU0sRUFBRWlCLE1BQU8sQ0FBQyxHQUFHLE1BQU0sR0FBRzNCLGVBQWUsQ0FBRVUsTUFBTyxDQUFDLEdBQUcsU0FBUztNQUMvSTRCLElBQUksSUFBSSw4Q0FBOEMsR0FBR1osa0JBQWtCLENBQUVoQixNQUFNLEVBQUVpQixNQUFPLENBQUMsR0FBRyxhQUFhO01BQzdHLElBQUtqQixNQUFNLEdBQUcsRUFBRSxHQUFHaUIsTUFBTSxDQUFDVCxHQUFHLEVBQUc7UUFDL0JvQixJQUFJLElBQUksNkNBQTZDLEdBQUdaLGtCQUFrQixDQUFFaEIsTUFBTSxHQUFHLEVBQUUsRUFBRWlCLE1BQU8sQ0FBQyxHQUFHLGFBQWE7TUFDbEg7SUFDRDtJQUVBLEtBQU1qQixNQUFNLEdBQUdpQixNQUFNLENBQUNaLEtBQUssR0FBR1ksTUFBTSxDQUFDaEIsSUFBSSxFQUFFRCxNQUFNLEdBQUdpQixNQUFNLENBQUNULEdBQUcsRUFBRVIsTUFBTSxJQUFJaUIsTUFBTSxDQUFDaEIsSUFBSSxFQUFHO01BQ3ZGLElBQUssQ0FBQyxLQUFLRCxNQUFNLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBS0EsTUFBTSxHQUFHLEVBQUUsRUFBRztRQUM5QztNQUNEO01BQ0E0QixJQUFJLElBQUksK0NBQStDLEdBQUdaLGtCQUFrQixDQUFFaEIsTUFBTSxFQUFFaUIsTUFBTyxDQUFDLEdBQUcsYUFBYTtJQUMvRztJQUVBVSxLQUFLLENBQUNDLElBQUksQ0FBRUEsSUFBSyxDQUFDO0lBQ2xCUSx1QkFBdUIsQ0FBRWhDLEtBQUssQ0FBQ2lDLE9BQU8sQ0FBRSxlQUFnQixDQUFFLENBQUM7RUFDNUQ7RUFFQSxTQUFTQyxhQUFhQSxDQUFFbEMsS0FBSyxFQUFHO0lBQy9CLElBQUlhLE1BQU0sR0FBR2QsZUFBZSxDQUFFQyxLQUFNLENBQUM7SUFFckNBLEtBQUssQ0FBQ1MsSUFBSSxDQUFFLGNBQWUsQ0FBQyxDQUFDUyxJQUFJLENBQUUsWUFBWTtNQUM5QyxJQUFJaUIsSUFBSSxHQUFHOUQsQ0FBQyxDQUFFLElBQUssQ0FBQztNQUNwQixJQUFJNEIsS0FBSyxHQUFHQyxRQUFRLENBQUVpQyxJQUFJLENBQUNoQyxJQUFJLENBQUUsb0JBQXFCLENBQUMsRUFBRSxFQUFHLENBQUM7TUFDN0QsSUFBSUMsR0FBRyxHQUFHRixRQUFRLENBQUVpQyxJQUFJLENBQUNoQyxJQUFJLENBQUUsa0JBQW1CLENBQUMsRUFBRSxFQUFHLENBQUM7TUFDekQsSUFBSWlDLFlBQVksR0FBRzVDLEtBQUssQ0FBRVMsS0FBSyxFQUFFWSxNQUFNLENBQUNaLEtBQUssRUFBRVksTUFBTSxDQUFDVCxHQUFJLENBQUM7TUFDM0QsSUFBSWlDLFVBQVUsR0FBRzdDLEtBQUssQ0FBRVksR0FBRyxFQUFFUyxNQUFNLENBQUNaLEtBQUssRUFBRVksTUFBTSxDQUFDVCxHQUFJLENBQUM7TUFDdkQsSUFBSWtDLElBQUk7TUFDUixJQUFJQyxLQUFLO01BRVQsSUFBS0YsVUFBVSxJQUFJeEIsTUFBTSxDQUFDWixLQUFLLElBQUltQyxZQUFZLElBQUl2QixNQUFNLENBQUNULEdBQUcsSUFBSWdDLFlBQVksSUFBSUMsVUFBVSxFQUFHO1FBQzdGRixJQUFJLENBQUNLLElBQUksQ0FBQyxDQUFDO1FBQ1g7TUFDRDtNQUVBRixJQUFJLEdBQUcxQixrQkFBa0IsQ0FBRXdCLFlBQVksRUFBRXZCLE1BQU8sQ0FBQztNQUNqRDBCLEtBQUssR0FBRzNCLGtCQUFrQixDQUFFeUIsVUFBVSxFQUFFeEIsTUFBTyxDQUFDLEdBQUd5QixJQUFJO01BQ3ZESCxJQUFJLENBQUNNLElBQUksQ0FBQyxDQUFDLENBQUNWLEdBQUcsQ0FBRTtRQUFFTyxJQUFJLEVBQUVBLElBQUksR0FBRyxHQUFHO1FBQUVDLEtBQUssRUFBRUEsS0FBSyxHQUFHO01BQUksQ0FBRSxDQUFDO0lBQzVELENBQUUsQ0FBQztFQUNKO0VBRUEsU0FBU0csb0JBQW9CQSxDQUFFcEMsS0FBSyxFQUFFcUMsSUFBSSxFQUFHO0lBQzVDLElBQUlDLFFBQVEsR0FBR0MsTUFBTSxDQUFDQyxnQ0FBZ0MsSUFBSSxDQUFDLENBQUM7SUFDNUQsSUFBSUMsTUFBTSxHQUFHSCxRQUFRLENBQUNJLElBQUksSUFBSSxDQUFDLENBQUM7SUFFaEMxQyxLQUFLLENBQUNHLElBQUksQ0FBRSw0Q0FBNkMsQ0FBQyxDQUFDd0MsTUFBTSxDQUFDLENBQUM7SUFFbkU1RSxDQUFDLENBQUM2QyxJQUFJLENBQUV5QixJQUFJLElBQUksQ0FBQyxDQUFDLEVBQUUsVUFBV08sSUFBSSxFQUFFQyxTQUFTLEVBQUc7TUFDaEQsSUFBSUMsSUFBSSxHQUFHOUMsS0FBSyxDQUFDRyxJQUFJLENBQUUsa0NBQWtDLEdBQUd5QyxJQUFJLEdBQUcsSUFBSyxDQUFDO01BRXpFLElBQUssQ0FBRUUsSUFBSSxDQUFDekMsTUFBTSxJQUFJLENBQUV3QyxTQUFTLEVBQUc7UUFDbkM7TUFDRDtNQUVBOUUsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFaUMsU0FBUyxFQUFFLFVBQVdFLFVBQVUsRUFBRUMsWUFBWSxFQUFHO1FBQ3hEakYsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFb0MsWUFBWSxJQUFJLEVBQUUsRUFBRSxVQUFXbkMsS0FBSyxFQUFFb0MsUUFBUSxFQUFHO1VBQ3hELElBQUlDLElBQUksR0FBRyxTQUFTLEtBQUtELFFBQVEsQ0FBQ0MsSUFBSSxHQUFHLFNBQVMsR0FBSyxpQkFBaUIsS0FBS0QsUUFBUSxDQUFDQyxJQUFJLEdBQUcsaUJBQWlCLEdBQUssY0FBYyxLQUFLRCxRQUFRLENBQUNDLElBQUksR0FBRyxjQUFjLEdBQUcsUUFBWTtVQUNuTCxJQUFJQyxJQUFJLEdBQUcsUUFBUSxLQUFLRCxJQUFJLEdBQUcsZUFBZSxHQUFLLGlCQUFpQixLQUFLQSxJQUFJLEdBQUcscUJBQXFCLEdBQUssY0FBYyxLQUFLQSxJQUFJLEdBQUcsdUJBQXVCLEdBQUcsNEJBQWdDO1VBQzlMLElBQUlFLE9BQU8sR0FBR0gsUUFBUSxDQUFDRyxPQUFPLElBQUksRUFBRTtVQUNwQyxJQUFJdkIsSUFBSSxHQUFHOUQsQ0FBQyxDQUFFLDhEQUErRCxDQUFDO1VBQzlFLElBQUlzRixTQUFTO1VBRWIsSUFBSyxRQUFRLEtBQUtILElBQUksSUFBSUQsUUFBUSxDQUFDSyxXQUFXLEVBQUc7WUFDaERELFNBQVMsR0FBR3RGLENBQUMsQ0FBRSx5RkFBMEYsQ0FBQztZQUMxR3NGLFNBQVMsQ0FDUHhELElBQUksQ0FBRSxNQUFNLEVBQUVvRCxRQUFRLENBQUNLLFdBQVksQ0FBQyxDQUNwQ3pELElBQUksQ0FBRSx5QkFBeUIsRUFBRW9ELFFBQVEsQ0FBQ00sVUFBVSxJQUFJLEVBQUcsQ0FBQyxDQUM1RDFELElBQUksQ0FBRSxZQUFZLEVBQUUsQ0FBRTRDLE1BQU0sQ0FBQ2UsWUFBWSxJQUFJLGlDQUFpQyxLQUFPUCxRQUFRLENBQUNNLFVBQVUsR0FBRyxJQUFJLEdBQUdOLFFBQVEsQ0FBQ00sVUFBVSxHQUFHLEVBQUUsQ0FBRyxDQUFDLENBQzlJMUQsSUFBSSxDQUFFLHFCQUFxQixFQUFFdUQsT0FBTyxJQUFJLEVBQUcsQ0FBQztVQUMvQyxDQUFDLE1BQU0sSUFBSyxDQUFFLGlCQUFpQixLQUFLRixJQUFJLElBQUksY0FBYyxLQUFLQSxJQUFJLEtBQU1ELFFBQVEsQ0FBQ1EsUUFBUSxFQUFHO1lBQzVGSixTQUFTLEdBQUd0RixDQUFDLENBQUUsNERBQTZELENBQUM7WUFDN0VzRixTQUFTLENBQ1B4RCxJQUFJLENBQUUsTUFBTSxFQUFFb0QsUUFBUSxDQUFDUSxRQUFTLENBQUMsQ0FDakM1RCxJQUFJLENBQUUsMEJBQTBCLEVBQUVvRCxRQUFRLENBQUNTLFdBQVcsSUFBSVQsUUFBUSxDQUFDVSxXQUFXLElBQUksRUFBRyxDQUFDLENBQ3RGOUQsSUFBSSxDQUFFLFlBQVksRUFBRSxDQUFFNEMsTUFBTSxDQUFDbUIsc0JBQXNCLElBQUksNEJBQTRCLEtBQU9YLFFBQVEsQ0FBQ1ksWUFBWSxHQUFHLElBQUksR0FBR1osUUFBUSxDQUFDWSxZQUFZLEdBQUcsRUFBRSxDQUFHLENBQUMsQ0FDdkpoRSxJQUFJLENBQUUscUJBQXFCLEVBQUV1RCxPQUFPLElBQUksRUFBRyxDQUFDO1VBQy9DLENBQUMsTUFBTTtZQUNOQyxTQUFTLEdBQUd0RixDQUFDLENBQUUsaUVBQWtFLENBQUMsQ0FDaEY4QixJQUFJLENBQUUscUJBQXFCLEVBQUV1RCxPQUFPLElBQUksRUFBRyxDQUFDO1VBQy9DO1VBRUF2QixJQUFJLENBQ0ZpQyxRQUFRLENBQUUsY0FBYyxHQUFHWixJQUFLLENBQUMsQ0FDakNyRCxJQUFJLENBQUUsb0JBQW9CLEVBQUVELFFBQVEsQ0FBRXFELFFBQVEsQ0FBQ2MsWUFBWSxFQUFFLEVBQUcsQ0FBRSxDQUFDLENBQ25FbEUsSUFBSSxDQUFFLGtCQUFrQixFQUFFRCxRQUFRLENBQUVxRCxRQUFRLENBQUNlLFVBQVUsRUFBRSxFQUFHLENBQUUsQ0FBQyxDQUMvRG5FLElBQUksQ0FBRSwwQkFBMEIsRUFBRWtELFVBQVcsQ0FBQyxDQUM5Q2xELElBQUksQ0FBRSx5QkFBeUIsRUFBRW9ELFFBQVEsQ0FBQ00sVUFBVSxJQUFJLEVBQUcsQ0FBQyxDQUM1RDFELElBQUksQ0FBRSwwQkFBMEIsRUFBRW9ELFFBQVEsQ0FBQ0ssV0FBVyxJQUFJLEVBQUcsQ0FBQyxDQUM5RHpELElBQUksQ0FBRSx1QkFBdUIsRUFBRW9ELFFBQVEsQ0FBQ1EsUUFBUSxJQUFJLEVBQUcsQ0FBQyxDQUN4RDVELElBQUksQ0FBRSw2QkFBNkIsRUFBRW9ELFFBQVEsQ0FBQ2dCLHVCQUF1QixJQUFJLEVBQUcsQ0FBQyxDQUM3RXBFLElBQUksQ0FBRSwwQkFBMEIsRUFBRW9ELFFBQVEsQ0FBQ1UsV0FBVyxJQUFJLEVBQUcsQ0FBQyxDQUM5RDlELElBQUksQ0FBRSx1QkFBdUIsRUFBRSxLQUFLLEtBQUtvRCxRQUFRLENBQUNpQixRQUFRLEdBQUcsR0FBRyxHQUFHLEdBQUksQ0FBQztVQUMxRSxJQUFLZCxPQUFPLEVBQUc7WUFDZHZCLElBQUksQ0FBQ2hDLElBQUksQ0FBRSxxQkFBcUIsRUFBRXVELE9BQVEsQ0FBQyxDQUFDVSxRQUFRLENBQUUsYUFBYyxDQUFDO1VBQ3RFO1VBQ0FULFNBQVMsQ0FBQ2xELElBQUksQ0FBRSxNQUFPLENBQUMsQ0FBQzJELFFBQVEsQ0FBRVgsSUFBSyxDQUFDO1VBQ3pDdEIsSUFBSSxDQUFDc0MsTUFBTSxDQUFFZCxTQUFVLENBQUM7VUFDeEJQLElBQUksQ0FBQzNDLElBQUksQ0FBRSxlQUFnQixDQUFDLENBQUNnRSxNQUFNLENBQUV0QyxJQUFLLENBQUM7UUFDNUMsQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO0lBQ0osQ0FBRSxDQUFDO0lBRUhELGFBQWEsQ0FBRTVCLEtBQUssQ0FBQ0csSUFBSSxDQUFFLGVBQWdCLENBQUUsQ0FBQztJQUM5Q2lFLG9CQUFvQixDQUFFcEUsS0FBTSxDQUFDO0VBQzlCO0VBRUEsU0FBU3FFLHNCQUFzQkEsQ0FBRXJFLEtBQUssRUFBRztJQUN4QyxJQUFJc0MsUUFBUSxHQUFHQyxNQUFNLENBQUNDLGdDQUFnQyxJQUFJLENBQUMsQ0FBQztJQUM1RCxJQUFJOEIsVUFBVSxHQUFHdkUsV0FBVyxDQUFFQyxLQUFLLEVBQUUsWUFBYSxDQUFDO0lBQ25ELElBQUl5QyxNQUFNLEdBQUdILFFBQVEsQ0FBQ0ksSUFBSSxJQUFJLENBQUMsQ0FBQztJQUNoQyxJQUFJNkIsU0FBUztJQUViLElBQUssQ0FBRWpDLFFBQVEsQ0FBQ2tDLFFBQVEsRUFBRztNQUMxQjtJQUNEO0lBRUEsSUFBS2pHLGlCQUFpQixJQUFJQSxpQkFBaUIsQ0FBQ2tHLFVBQVUsS0FBSyxDQUFDLEVBQUc7TUFDOURsRyxpQkFBaUIsQ0FBQ21HLEtBQUssQ0FBQyxDQUFDO0lBQzFCO0lBRUFILFNBQVMsR0FBRyxFQUFFL0YsbUJBQW1CO0lBQ2pDbUcsb0JBQW9CLENBQUUzRSxLQUFLLEVBQUUsSUFBSSxFQUFFeUMsTUFBTSxDQUFDbUMsT0FBTyxJQUFJLFNBQVUsQ0FBQztJQUVoRXJHLGlCQUFpQixHQUFHUixDQUFDLENBQUM4RyxJQUFJLENBQUV2QyxRQUFRLENBQUNrQyxRQUFRLEVBQUU7TUFDOUNNLE1BQU0sRUFBRSxzQ0FBc0M7TUFDOUNDLFdBQVcsRUFBRWhGLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLFVBQVcsQ0FBQyxDQUFDZ0YsR0FBRyxDQUFDLENBQUM7TUFDbkRDLFVBQVUsRUFBRVgsVUFBVSxDQUFDekUsSUFBSSxDQUFFLG9CQUFxQixDQUFDO01BQ25EcUYsUUFBUSxFQUFFWixVQUFVLENBQUN6RSxJQUFJLENBQUUsa0JBQW1CO0lBQy9DLENBQUUsQ0FBQyxDQUFDc0YsSUFBSSxDQUFFLFVBQVdDLFFBQVEsRUFBRztNQUMvQixJQUFLYixTQUFTLEtBQUsvRixtQkFBbUIsRUFBRztRQUN4QztNQUNEO01BQ0EsSUFBSzRHLFFBQVEsSUFBSUEsUUFBUSxDQUFDQyxPQUFPLElBQUlELFFBQVEsQ0FBQ0UsSUFBSSxFQUFHO1FBQ3BEbEQsb0JBQW9CLENBQUVwQyxLQUFLLEVBQUVvRixRQUFRLENBQUNFLElBQUksQ0FBQ2pELElBQUssQ0FBQztNQUNsRDtJQUNELENBQUUsQ0FBQyxDQUFDa0QsSUFBSSxDQUFFLFVBQVdDLEdBQUcsRUFBRUMsVUFBVSxFQUFHO01BQ3RDLElBQUssT0FBTyxLQUFLQSxVQUFVLElBQUlsRCxNQUFNLENBQUNtRCx1QkFBdUIsRUFBRztRQUMvREEsdUJBQXVCLENBQUVqRCxNQUFNLENBQUNrRCxVQUFVLElBQUksd0NBQXdDLEVBQUUsT0FBTyxFQUFFLElBQUssQ0FBQztNQUN4RztJQUNELENBQUUsQ0FBQyxDQUFDQyxNQUFNLENBQUUsWUFBWTtNQUN2QixJQUFLckIsU0FBUyxLQUFLL0YsbUJBQW1CLEVBQUc7UUFDeENtRyxvQkFBb0IsQ0FBRTNFLEtBQUssRUFBRSxLQUFNLENBQUM7TUFDckM7SUFDRCxDQUFFLENBQUM7RUFDSjtFQUVBLFNBQVM2RixnQkFBZ0JBLENBQUU3RixLQUFLLEVBQUU4RixRQUFRLEVBQUVDLE1BQU0sRUFBRztJQUNwRCxJQUFJQyxVQUFVLEdBQUdwRyxRQUFRLENBQUVrRyxRQUFRLEVBQUUsRUFBRyxDQUFDO0lBQ3pDLElBQUlHLFFBQVEsR0FBR3JHLFFBQVEsQ0FBRW1HLE1BQU0sRUFBRSxFQUFHLENBQUM7SUFDckMsSUFBSTVHLEdBQUcsR0FBR0osSUFBSSxDQUFDSSxHQUFHLENBQUU2RyxVQUFVLEVBQUVDLFFBQVMsQ0FBQztJQUMxQyxJQUFJN0csR0FBRyxHQUFHTCxJQUFJLENBQUNLLEdBQUcsQ0FBRTRHLFVBQVUsRUFBRUMsUUFBUyxDQUFDO0lBQzFDLElBQUlDLElBQUksR0FBRyxFQUFFO0lBQ2IsSUFBSUMsQ0FBQztJQUVMLEtBQU1BLENBQUMsR0FBR2hILEdBQUcsRUFBRWdILENBQUMsSUFBSS9HLEdBQUcsRUFBRStHLENBQUMsRUFBRSxFQUFHO01BQzlCLElBQUtuRyxLQUFLLENBQUNHLElBQUksQ0FBRSxpQ0FBaUMsR0FBR2dHLENBQUMsR0FBRyxJQUFLLENBQUMsQ0FBQzlGLE1BQU0sRUFBRztRQUN4RTZGLElBQUksQ0FBQ0UsSUFBSSxDQUFFQyxNQUFNLENBQUVGLENBQUUsQ0FBRSxDQUFDO01BQ3pCO0lBQ0Q7SUFFQSxPQUFPRCxJQUFJO0VBQ1o7RUFFQSxTQUFTSSxTQUFTQSxDQUFFdEcsS0FBSyxFQUFFdUcsS0FBSyxFQUFHO0lBQ2xDLE9BQU94SSxDQUFDLENBQUN5SSxJQUFJLENBQUV4RyxLQUFLLENBQUNHLElBQUksQ0FBRSxpQ0FBaUMsR0FBR29HLEtBQUssR0FBRyw0QkFBNkIsQ0FBQyxDQUFDRSxJQUFJLENBQUMsQ0FBRSxDQUFDO0VBQy9HO0VBRUEsU0FBU0MsV0FBV0EsQ0FBRS9ILEtBQUssRUFBRztJQUM3QixPQUFPWixDQUFDLENBQUUsU0FBVSxDQUFDLENBQUMwSSxJQUFJLENBQUU5SCxLQUFNLENBQUMsQ0FBQ3VDLElBQUksQ0FBQyxDQUFDO0VBQzNDO0VBRUEsU0FBU3lGLHdCQUF3QkEsQ0FBRTNHLEtBQUssRUFBRztJQUMxQyxJQUFJNEcsS0FBSyxHQUFHNUcsS0FBSyxDQUFDRyxJQUFJLENBQUUsd0JBQXlCLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7SUFDMUQsSUFBSXlHLElBQUksR0FBR0QsS0FBSyxDQUFDRSxHQUFHLENBQUUsQ0FBRSxDQUFDO0lBQ3pCLElBQUlDLFFBQVEsR0FBR0gsS0FBSyxDQUFDekcsSUFBSSxDQUFFLDBCQUEyQixDQUFDLENBQUNDLEtBQUssQ0FBQyxDQUFDO0lBRS9ELElBQUssQ0FBRXlHLElBQUksSUFBSSxDQUFFRSxRQUFRLENBQUMxRyxNQUFNLEVBQUc7TUFDbEM7SUFDRDtJQUVBMEcsUUFBUSxDQUFDdEYsR0FBRyxDQUFFO01BQ2JRLEtBQUssRUFBRTRFLElBQUksQ0FBQ0csV0FBVyxHQUFHLElBQUk7TUFDOUJDLE1BQU0sRUFBRUosSUFBSSxDQUFDSyxZQUFZLEdBQUcsSUFBSTtNQUNoQ0MsU0FBUyxFQUFFLFlBQVksR0FBR04sSUFBSSxDQUFDTyxVQUFVLEdBQUcsS0FBSyxHQUFHUCxJQUFJLENBQUNRLFNBQVMsR0FBRztJQUN0RSxDQUFFLENBQUM7RUFDSjtFQUVBLFNBQVMxQyxvQkFBb0JBLENBQUUzRSxLQUFLLEVBQUVzSCxTQUFTLEVBQUVDLEtBQUssRUFBRztJQUN4RCxJQUFJWCxLQUFLLEdBQUc1RyxLQUFLLENBQUNHLElBQUksQ0FBRSx3QkFBeUIsQ0FBQztJQUNsRCxJQUFJNEcsUUFBUTtJQUVaSCxLQUFLLENBQ0hZLFdBQVcsQ0FBRSxZQUFZLEVBQUUsQ0FBQyxDQUFFRixTQUFVLENBQUMsQ0FDekNuSCxJQUFJLENBQUUsMEJBQTJCLENBQUMsQ0FDbENOLElBQUksQ0FBRSxhQUFhLEVBQUV5SCxTQUFTLEdBQUcsT0FBTyxHQUFHLE1BQU8sQ0FBQztJQUVyRCxJQUFLQyxLQUFLLEVBQUc7TUFDWlIsUUFBUSxHQUFHL0csS0FBSyxDQUFDRyxJQUFJLENBQUUsMEJBQTJCLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7TUFDM0QyRyxRQUFRLENBQUM1RyxJQUFJLENBQUUsc0NBQXVDLENBQUMsQ0FBQ3NHLElBQUksQ0FBRWMsS0FBSyxHQUFHLEtBQU0sQ0FBQztJQUM5RTtJQUVBLElBQUtELFNBQVMsRUFBRztNQUNoQlgsd0JBQXdCLENBQUUzRyxLQUFNLENBQUM7TUFDakM0RyxLQUFLLENBQUNhLEdBQUcsQ0FBRSxnQ0FBaUMsQ0FBQyxDQUFDQyxFQUFFLENBQUUsZ0NBQWdDLEVBQUUsWUFBWTtRQUMvRmYsd0JBQXdCLENBQUUzRyxLQUFNLENBQUM7TUFDbEMsQ0FBRSxDQUFDO0lBQ0osQ0FBQyxNQUFNO01BQ040RyxLQUFLLENBQUNhLEdBQUcsQ0FBRSxnQ0FBaUMsQ0FBQztNQUM3Q3pILEtBQUssQ0FBQ0csSUFBSSxDQUFFLDBCQUEyQixDQUFDLENBQUNzQixHQUFHLENBQUU7UUFDN0NRLEtBQUssRUFBRSxFQUFFO1FBQ1RnRixNQUFNLEVBQUUsRUFBRTtRQUNWRSxTQUFTLEVBQUU7TUFDWixDQUFFLENBQUM7SUFDSjtFQUNEO0VBRUEsU0FBU1EsdUJBQXVCQSxDQUFFM0gsS0FBSyxFQUFFNEgsTUFBTSxFQUFHO0lBQ2pELElBQUlDLE1BQU0sR0FBRzdILEtBQUssQ0FBQzhILEdBQUcsQ0FBRTlILEtBQUssQ0FBQzJCLE9BQU8sQ0FBRSxRQUFTLENBQUUsQ0FBQyxDQUFDbUcsR0FBRyxDQUFFL0osQ0FBQyxDQUFFLDBCQUEyQixDQUFFLENBQUM7SUFFMUY4SixNQUFNLENBQ0oxSCxJQUFJLENBQUUsa0RBQW1ELENBQUMsQ0FDMURxSCxXQUFXLENBQUUsVUFBVSxFQUFFLENBQUMsQ0FBRUksTUFBTyxDQUFDLENBQ3BDL0gsSUFBSSxDQUFFLGVBQWUsRUFBRStILE1BQU0sR0FBRyxNQUFNLEdBQUcsT0FBUSxDQUFDO0VBQ3JEO0VBRUEsU0FBU0csc0JBQXNCQSxDQUFFL0gsS0FBSyxFQUFHO0lBQ3hDLE9BQ0MsQ0FBRUEsS0FBSyxDQUFDZ0ksUUFBUSxDQUFFLGVBQWdCLENBQUMsSUFDaENoSSxLQUFLLENBQUMyQixPQUFPLENBQUUsZ0RBQWlELENBQUMsQ0FBQ3RCLE1BQU0sR0FBRyxDQUFDO0VBRWpGO0VBRUEsU0FBUzRILDZCQUE2QkEsQ0FBRWpJLEtBQUssRUFBRztJQUMvQyxPQUFPLG9CQUFvQixHQUFHcUcsTUFBTSxDQUFFckcsS0FBSyxDQUFDSCxJQUFJLENBQUUsd0JBQXlCLENBQUMsSUFBSSxNQUFPLENBQUMsQ0FBQ3FJLE9BQU8sQ0FBRSxRQUFRLEVBQUUsR0FBSSxDQUFDO0VBQ2xIO0VBRUEsU0FBU0Msa0JBQWtCQSxDQUFBLEVBQUc7SUFDN0IsSUFBSUMsT0FBTyxHQUFHckssQ0FBQyxDQUFFLDhCQUErQixDQUFDLENBQUNxQyxLQUFLLENBQUMsQ0FBQztJQUN6RCxJQUFJaUksSUFBSTtJQUVSLElBQUssQ0FBRUQsT0FBTyxDQUFDL0gsTUFBTSxFQUFHO01BQ3ZCLE9BQU8sQ0FBQztJQUNUO0lBRUFnSSxJQUFJLEdBQUdELE9BQU8sQ0FBQ3RCLEdBQUcsQ0FBRSxDQUFFLENBQUMsQ0FBQ3dCLHFCQUFxQixDQUFDLENBQUM7SUFDL0MsT0FBT3ZKLElBQUksQ0FBQ0ssR0FBRyxDQUFFLENBQUMsRUFBRUwsSUFBSSxDQUFDUyxLQUFLLENBQUU2SSxJQUFJLENBQUNFLE1BQU8sQ0FBRSxDQUFDO0VBQ2hEO0VBRUEsU0FBU0Msc0JBQXNCQSxDQUFFeEksS0FBSyxFQUFHO0lBQ3hDLElBQUl5SSxTQUFTLEdBQUd6SSxLQUFLLENBQUMwSSxRQUFRLENBQUUsMEJBQTJCLENBQUM7SUFDNUQsSUFBSUMsT0FBTztJQUVYLElBQUtGLFNBQVMsQ0FBQ3BJLE1BQU0sRUFBRztNQUN2QixPQUFPb0ksU0FBUztJQUNqQjtJQUVBRSxPQUFPLEdBQUczSSxLQUFLLENBQUNHLElBQUksQ0FBRSxpQ0FBa0MsQ0FBQyxDQUFDQyxLQUFLLENBQUMsQ0FBQztJQUNqRXFJLFNBQVMsR0FBRzFLLENBQUMsQ0FBRSxnRUFBaUUsQ0FBQyxDQUFDNkssUUFBUSxDQUFFNUksS0FBTSxDQUFDO0lBRW5HLElBQUsySSxPQUFPLENBQUN0SSxNQUFNLEVBQUc7TUFDckJvSSxTQUFTLENBQUN0RSxNQUFNLENBQUV3RSxPQUFPLENBQUNFLEtBQUssQ0FBRSxLQUFLLEVBQUUsS0FBTSxDQUFFLENBQUM7SUFDbEQ7SUFFQSxPQUFPSixTQUFTO0VBQ2pCO0VBRUEsU0FBU0ssb0JBQW9CQSxDQUFFOUksS0FBSyxFQUFHO0lBQ3RDLElBQUl5SSxTQUFTO0lBQ2IsSUFBSTdCLEtBQUs7SUFDVCxJQUFJbEgsS0FBSztJQUNULElBQUlpSixPQUFPO0lBQ1gsSUFBSTlCLElBQUk7SUFDUixJQUFJa0MsUUFBUTtJQUNaLElBQUlDLFVBQVU7SUFDZCxJQUFJQyxTQUFTO0lBQ2IsSUFBSUMsVUFBVTtJQUVkLElBQUssQ0FBRW5CLHNCQUFzQixDQUFFL0gsS0FBTSxDQUFDLEVBQUc7TUFDeEM7SUFDRDtJQUVBeUksU0FBUyxHQUFHRCxzQkFBc0IsQ0FBRXhJLEtBQU0sQ0FBQztJQUMzQzRHLEtBQUssR0FBRzVHLEtBQUssQ0FBQ0csSUFBSSxDQUFFLHdCQUF5QixDQUFDLENBQUNDLEtBQUssQ0FBQyxDQUFDO0lBQ3REVixLQUFLLEdBQUdNLEtBQUssQ0FBQ0csSUFBSSxDQUFFLGVBQWdCLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7SUFDN0N1SSxPQUFPLEdBQUdqSixLQUFLLENBQUNTLElBQUksQ0FBRSxtQkFBb0IsQ0FBQyxDQUFDQyxLQUFLLENBQUMsQ0FBQztJQUNuRHlHLElBQUksR0FBR0QsS0FBSyxDQUFDRSxHQUFHLENBQUUsQ0FBRSxDQUFDO0lBRXJCLElBQUssQ0FBRUQsSUFBSSxJQUFJLENBQUVuSCxLQUFLLENBQUNXLE1BQU0sSUFBSSxDQUFFc0ksT0FBTyxDQUFDdEksTUFBTSxFQUFHO01BQ25Eb0ksU0FBUyxDQUFDVSxXQUFXLENBQUUsWUFBYSxDQUFDO01BQ3JDO0lBQ0Q7SUFFQUosUUFBUSxHQUFHbEMsSUFBSSxDQUFDeUIscUJBQXFCLENBQUMsQ0FBQztJQUN2Q1UsVUFBVSxHQUFHTCxPQUFPLENBQUM3QixHQUFHLENBQUUsQ0FBRSxDQUFDLENBQUN3QixxQkFBcUIsQ0FBQyxDQUFDO0lBQ3JEVyxTQUFTLEdBQUdkLGtCQUFrQixDQUFDLENBQUM7SUFDaENlLFVBQVUsR0FBS0YsVUFBVSxDQUFDSSxHQUFHLEdBQUdILFNBQVMsSUFBUUYsUUFBUSxDQUFDUixNQUFNLEdBQUtVLFNBQVMsR0FBR0QsVUFBVSxDQUFDL0IsTUFBVTtJQUV0RyxJQUFLLENBQUVpQyxVQUFVLEVBQUc7TUFDbkJULFNBQVMsQ0FBQ1UsV0FBVyxDQUFFLFlBQWEsQ0FBQztNQUNyQztJQUNEO0lBRUFWLFNBQVMsQ0FDUGhILEdBQUcsQ0FBRTtNQUNMMkgsR0FBRyxFQUFFSCxTQUFTLEdBQUcsSUFBSTtNQUNyQmpILElBQUksRUFBRWpELElBQUksQ0FBQ1MsS0FBSyxDQUFFdUosUUFBUSxDQUFDL0csSUFBSyxDQUFDLEdBQUcsSUFBSTtNQUN4Q0MsS0FBSyxFQUFFbEQsSUFBSSxDQUFDUyxLQUFLLENBQUVxSCxJQUFJLENBQUNHLFdBQVksQ0FBQyxHQUFHLElBQUk7TUFDNUMsZ0NBQWdDLEVBQUksQ0FBQyxDQUFDLEdBQUdILElBQUksQ0FBQ08sVUFBVSxHQUFLLElBQUk7TUFDakUsb0NBQW9DLEVBQUVQLElBQUksQ0FBQ08sVUFBVSxHQUFHO0lBQ3pELENBQUUsQ0FBQyxDQUNGdEQsUUFBUSxDQUFFLFlBQWEsQ0FBQztJQUUxQjJFLFNBQVMsQ0FBQ0MsUUFBUSxDQUFFLGlCQUFrQixDQUFDLENBQUNqSCxHQUFHLENBQUUsT0FBTyxFQUFFMUMsSUFBSSxDQUFDUyxLQUFLLENBQUVFLEtBQUssQ0FBQzJKLFVBQVUsQ0FBQyxDQUFFLENBQUMsR0FBRyxJQUFLLENBQUM7RUFDaEc7RUFFQSxTQUFTM0gsdUJBQXVCQSxDQUFFMUIsS0FBSyxFQUFHO0lBQ3pDLElBQUl5SSxTQUFTO0lBQ2IsSUFBSUUsT0FBTztJQUVYLElBQUssQ0FBRTNJLEtBQUssSUFBSSxDQUFFQSxLQUFLLENBQUNLLE1BQU0sSUFBSSxDQUFFMEgsc0JBQXNCLENBQUUvSCxLQUFNLENBQUMsRUFBRztNQUNyRTtJQUNEO0lBRUF5SSxTQUFTLEdBQUd6SSxLQUFLLENBQUMwSSxRQUFRLENBQUUsMEJBQTJCLENBQUM7SUFFeEQsSUFBSyxDQUFFRCxTQUFTLENBQUNwSSxNQUFNLEVBQUc7TUFDekI7SUFDRDtJQUVBc0ksT0FBTyxHQUFHM0ksS0FBSyxDQUFDRyxJQUFJLENBQUUsaUNBQWtDLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7SUFDakVxSSxTQUFTLENBQUNhLEtBQUssQ0FBQyxDQUFDO0lBRWpCLElBQUtYLE9BQU8sQ0FBQ3RJLE1BQU0sRUFBRztNQUNyQm9JLFNBQVMsQ0FBQ3RFLE1BQU0sQ0FBRXdFLE9BQU8sQ0FBQ0UsS0FBSyxDQUFFLEtBQUssRUFBRSxLQUFNLENBQUUsQ0FBQztJQUNsRDtJQUVBQyxvQkFBb0IsQ0FBRTlJLEtBQU0sQ0FBQztFQUM5QjtFQUVBLFNBQVN1SixvQkFBb0JBLENBQUV2SixLQUFLLEVBQUc7SUFDdEMsSUFBSXdKLFNBQVM7SUFFYixJQUFLLENBQUV6QixzQkFBc0IsQ0FBRS9ILEtBQU0sQ0FBQyxFQUFHO01BQ3hDO0lBQ0Q7SUFFQXdKLFNBQVMsR0FBR3ZCLDZCQUE2QixDQUFFakksS0FBTSxDQUFDO0lBQ2xEd0ksc0JBQXNCLENBQUV4SSxLQUFNLENBQUM7SUFFL0JqQyxDQUFDLENBQUV3RSxNQUFPLENBQUMsQ0FDVGtGLEdBQUcsQ0FBRSxRQUFRLEdBQUcrQixTQUFTLEdBQUcsU0FBUyxHQUFHQSxTQUFVLENBQUMsQ0FDbkQ5QixFQUFFLENBQUUsUUFBUSxHQUFHOEIsU0FBUyxHQUFHLFNBQVMsR0FBR0EsU0FBUyxFQUFFLFlBQVk7TUFDOURWLG9CQUFvQixDQUFFOUksS0FBTSxDQUFDO0lBQzlCLENBQUUsQ0FBQztJQUVKQSxLQUFLLENBQUNHLElBQUksQ0FBRSx3QkFBeUIsQ0FBQyxDQUNwQ3NILEdBQUcsQ0FBRSxRQUFRLEdBQUcrQixTQUFVLENBQUMsQ0FDM0I5QixFQUFFLENBQUUsUUFBUSxHQUFHOEIsU0FBUyxFQUFFLFlBQVk7TUFDdENWLG9CQUFvQixDQUFFOUksS0FBTSxDQUFDO0lBQzlCLENBQUUsQ0FBQztJQUVKakMsQ0FBQyxDQUFFMEwsUUFBUyxDQUFDLENBQ1hoQyxHQUFHLENBQUUsT0FBTyxHQUFHK0IsU0FBVSxDQUFDLENBQzFCOUIsRUFBRSxDQUFFLE9BQU8sR0FBRzhCLFNBQVMsRUFBRSx5S0FBeUssRUFBRSxZQUFZO01BQ2hOakgsTUFBTSxDQUFDbUgsVUFBVSxDQUFFLFlBQVk7UUFDOUJaLG9CQUFvQixDQUFFOUksS0FBTSxDQUFDO01BQzlCLENBQUMsRUFBRSxFQUFHLENBQUM7SUFDUixDQUFFLENBQUM7SUFFSjhJLG9CQUFvQixDQUFFOUksS0FBTSxDQUFDO0VBQzlCO0VBRUEsU0FBU29FLG9CQUFvQkEsQ0FBRXBFLEtBQUssRUFBRztJQUN0QyxJQUFJMkosYUFBYSxHQUFHM0osS0FBSyxDQUFDRyxJQUFJLENBQUUsd0JBQXlCLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7SUFDbEUsSUFBSXdKLGNBQWM7SUFDbEIsSUFBSUMscUJBQXFCLEdBQUcsS0FBSztJQUVqQzdKLEtBQUssQ0FBQ0csSUFBSSxDQUFFLDRIQUE2SCxDQUFDLENBQUNTLElBQUksQ0FBRSxZQUFZO01BQzVKLElBQUssSUFBSSxDQUFDa0osTUFBTSxFQUFHO1FBQ2xCLElBQUksQ0FBQ0EsTUFBTSxDQUFDQyxPQUFPLENBQUMsQ0FBQztNQUN0QjtJQUNELENBQUUsQ0FBQztJQUVILElBQUssVUFBVSxLQUFLLE9BQU94SCxNQUFNLENBQUN5SCwwQkFBMEIsRUFBRztNQUM5RCxJQUFLTCxhQUFhLENBQUN0SixNQUFNLEVBQUc7UUFDM0J1SixjQUFjLEdBQUdELGFBQWEsQ0FBQzlKLElBQUksQ0FBRSxJQUFLLENBQUM7UUFFM0MsSUFBSyxDQUFFK0osY0FBYyxFQUFHO1VBQ3ZCQSxjQUFjLEdBQUcsaUNBQWlDLEdBQUd0TCxrQkFBa0I7VUFDdkVBLGtCQUFrQixFQUFFO1VBQ3BCcUwsYUFBYSxDQUFDOUosSUFBSSxDQUFFLElBQUksRUFBRStKLGNBQWUsQ0FBQztRQUMzQztRQUVBQyxxQkFBcUIsR0FBR3RILE1BQU0sQ0FBQ3lILDBCQUEwQixDQUFFLEdBQUcsR0FBR0osY0FBYyxHQUFHLEdBQUksQ0FBQztNQUN4RjtNQUVBLElBQUtDLHFCQUFxQixFQUFHO1FBQzVCO01BQ0Q7SUFDRDtJQUVBN0osS0FBSyxDQUFDRyxJQUFJLENBQUUsdUJBQXdCLENBQUMsQ0FBQ1MsSUFBSSxDQUFFLFlBQVk7TUFDdkQsSUFBSyxDQUFFN0MsQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDOEIsSUFBSSxDQUFFLE9BQVEsQ0FBQyxFQUFHO1FBQ2xDOUIsQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDOEIsSUFBSSxDQUFFLE9BQU8sRUFBRTlCLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzhCLElBQUksQ0FBRSxxQkFBc0IsQ0FBRSxDQUFDO01BQ25FO0lBQ0QsQ0FBRSxDQUFDO0VBQ0o7RUFFQSxTQUFTb0ssbUNBQW1DQSxDQUFBLEVBQUc7SUFDOUMsT0FDQyxVQUFVLEtBQUssT0FBTzFILE1BQU0sQ0FBQzJILGdEQUFnRCxJQUMxRSxXQUFXLEtBQUssT0FBTzNILE1BQU0sQ0FBQzRILHdCQUF3QixJQUN0RHBNLENBQUMsQ0FBRSxvQkFBcUIsQ0FBQyxDQUFDc0MsTUFBTTtFQUVyQztFQUVBLFNBQVMrSixzQkFBc0JBLENBQUVwSyxLQUFLLEVBQUc7SUFDeEMsSUFBSXFLLE1BQU0sR0FBR3JLLEtBQUssQ0FBQzJCLE9BQU8sQ0FBRSxzREFBdUQsQ0FBQztJQUVwRixJQUFLLENBQUUwSSxNQUFNLENBQUNoSyxNQUFNLEVBQUc7TUFDdEI7SUFDRDtJQUVBLElBQUssVUFBVSxLQUFLLE9BQU9nSyxNQUFNLENBQUNDLGFBQWEsRUFBRztNQUNqREQsTUFBTSxDQUFDQyxhQUFhLENBQUUsTUFBTyxDQUFDO01BQzlCO0lBQ0Q7SUFFQSxJQUFLLFVBQVUsS0FBSyxPQUFPRCxNQUFNLENBQUNFLEtBQUssRUFBRztNQUN6Q0YsTUFBTSxDQUFDRSxLQUFLLENBQUUsTUFBTyxDQUFDO01BQ3RCO0lBQ0Q7SUFFQUYsTUFBTSxDQUFDbEssSUFBSSxDQUFFLHdCQUF5QixDQUFDLENBQUNDLEtBQUssQ0FBQyxDQUFDLENBQUNvSyxPQUFPLENBQUUsT0FBUSxDQUFDO0VBQ25FO0VBRUEsU0FBU0MsaUNBQWlDQSxDQUFFekssS0FBSyxFQUFFMEssU0FBUyxFQUFHO0lBQzlELElBQUlDLE9BQU8sR0FBRyxLQUFLLEdBQUcvSyxRQUFRLENBQUU4SyxTQUFTLEVBQUUsRUFBRyxDQUFDO0lBRS9DM00sQ0FBQyxDQUFFLG9CQUFxQixDQUFDLENBQUNpSCxHQUFHLENBQUUyRixPQUFRLENBQUM7SUFDeENQLHNCQUFzQixDQUFFcEssS0FBTSxDQUFDO0lBQy9CdUMsTUFBTSxDQUFDMkgsZ0RBQWdELENBQUU7TUFDeEQsU0FBUyxFQUFFUyxPQUFPO01BQ2xCLFVBQVUsRUFBRTtJQUNiLENBQUUsQ0FBQztFQUNKO0VBRUEsU0FBU0MsdUJBQXVCQSxDQUFFNUssS0FBSyxFQUFFNkssS0FBSyxFQUFHO0lBQ2hELElBQUloSixJQUFJLEdBQUc5RCxDQUFDLENBQUU4TSxLQUFLLENBQUNDLGFBQWMsQ0FBQztJQUNuQyxJQUFJQyxLQUFLLEdBQUdoTixDQUFDLENBQUU4TSxLQUFLLENBQUNHLE1BQU8sQ0FBQyxDQUFDckosT0FBTyxDQUFFLHVCQUF3QixDQUFDO0lBQ2hFLElBQUkrSSxTQUFTLEdBQUc3SSxJQUFJLENBQUNoQyxJQUFJLENBQUUseUJBQTBCLENBQUMsSUFBSWtMLEtBQUssQ0FBQ2xMLElBQUksQ0FBRSx5QkFBMEIsQ0FBQztJQUNqRyxJQUFJb0wsVUFBVSxHQUFHcEosSUFBSSxDQUFDaEMsSUFBSSxDQUFFLDBCQUEyQixDQUFDLElBQUlrTCxLQUFLLENBQUNsTCxJQUFJLENBQUUsTUFBTyxDQUFDO0lBRWhGLElBQUssQ0FBRTZLLFNBQVMsRUFBRztNQUNsQjtJQUNEO0lBRUEsSUFBS1QsbUNBQW1DLENBQUMsQ0FBQyxFQUFHO01BQzVDWSxLQUFLLENBQUNLLGNBQWMsQ0FBQyxDQUFDO01BQ3RCTCxLQUFLLENBQUNNLGVBQWUsQ0FBQyxDQUFDO01BQ3ZCVixpQ0FBaUMsQ0FBRXpLLEtBQUssRUFBRTBLLFNBQVUsQ0FBQztNQUNyRDtJQUNEO0lBRUEsSUFBSyxDQUFFSyxLQUFLLENBQUMxSyxNQUFNLElBQUk0SyxVQUFVLEVBQUc7TUFDbkNKLEtBQUssQ0FBQ0ssY0FBYyxDQUFDLENBQUM7TUFDdEIzSSxNQUFNLENBQUM2SSxRQUFRLENBQUNDLElBQUksR0FBR0osVUFBVTtJQUNsQztFQUNEO0VBRUEsU0FBU0ssNEJBQTRCQSxDQUFFdEwsS0FBSyxFQUFHO0lBQzlDLElBQUl1TCxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ2R4TixDQUFDLENBQUM2QyxJQUFJLENBQUUxQyxlQUFlLEVBQUUsVUFBVzJDLEtBQUssRUFBRUMsSUFBSSxFQUFHO01BQ2pEL0MsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFRSxJQUFJLENBQUNvRixJQUFJLEVBQUUsVUFBV3NGLFFBQVEsRUFBRWpGLEtBQUssRUFBRztRQUMvQyxJQUFJZ0IsS0FBSyxHQUFHakIsU0FBUyxDQUFFdEcsS0FBSyxFQUFFdUcsS0FBTSxDQUFDO1FBQ3JDLElBQUtnQixLQUFLLEVBQUc7VUFDWmdFLEtBQUssQ0FBRWhFLEtBQUssQ0FBRSxHQUFHLElBQUk7UUFDdEI7TUFDRCxDQUFFLENBQUM7SUFDSixDQUFFLENBQUM7SUFDSCxPQUFPa0UsTUFBTSxDQUFDQyxJQUFJLENBQUVILEtBQU0sQ0FBQztFQUM1QjtFQUVBLFNBQVNJLHFCQUFxQkEsQ0FBRTNMLEtBQUssRUFBRztJQUN2QyxJQUFJNEwsT0FBTyxHQUFHLEVBQUU7SUFFaEI3TixDQUFDLENBQUM2QyxJQUFJLENBQUUxQyxlQUFlLEVBQUUsVUFBVzJDLEtBQUssRUFBRUMsSUFBSSxFQUFHO01BQ2pEL0MsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFRSxJQUFJLENBQUNvRixJQUFJLEVBQUUsVUFBV3NGLFFBQVEsRUFBRWpGLEtBQUssRUFBRztRQUMvQyxJQUFJekQsSUFBSSxHQUFHOUMsS0FBSyxDQUFDRyxJQUFJLENBQUUsaUNBQWlDLEdBQUdvRyxLQUFLLEdBQUcsSUFBSyxDQUFDO1FBQ3pFLElBQUkzRCxJQUFJLEdBQUdFLElBQUksQ0FBQ2pELElBQUksQ0FBRSxtQkFBb0IsQ0FBQztRQUUzQyxJQUFLLENBQUUrQyxJQUFJLEVBQUc7VUFDYjtRQUNEO1FBRUFnSixPQUFPLENBQUN4RixJQUFJLENBQUU7VUFDYnhELElBQUksRUFBRUEsSUFBSTtVQUNWaUosWUFBWSxFQUFFL0ssSUFBSSxDQUFDbkIsS0FBSyxHQUFHLEVBQUU7VUFDN0JtTSxVQUFVLEVBQUVoTCxJQUFJLENBQUNoQixHQUFHLEdBQUc7UUFDeEIsQ0FBRSxDQUFDO01BQ0osQ0FBRSxDQUFDO0lBQ0osQ0FBRSxDQUFDO0lBRUg4TCxPQUFPLENBQUNHLElBQUksQ0FBRSxVQUFXQyxDQUFDLEVBQUVDLENBQUMsRUFBRztNQUMvQixJQUFLRCxDQUFDLENBQUNwSixJQUFJLEtBQUtxSixDQUFDLENBQUNySixJQUFJLEVBQUc7UUFDeEIsT0FBT29KLENBQUMsQ0FBQ3BKLElBQUksR0FBR3FKLENBQUMsQ0FBQ3JKLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDO01BQ2hDO01BQ0EsSUFBS29KLENBQUMsQ0FBQ0gsWUFBWSxLQUFLSSxDQUFDLENBQUNKLFlBQVksRUFBRztRQUN4QyxPQUFPRyxDQUFDLENBQUNILFlBQVksR0FBR0ksQ0FBQyxDQUFDSixZQUFZO01BQ3ZDO01BQ0EsT0FBT0csQ0FBQyxDQUFDRixVQUFVLEdBQUdHLENBQUMsQ0FBQ0gsVUFBVTtJQUNuQyxDQUFFLENBQUM7SUFFSCxPQUFPRixPQUFPO0VBQ2Y7RUFFQSxTQUFTTSxvQ0FBb0NBLENBQUVsTSxLQUFLLEVBQUc7SUFDdEQsSUFBSWMsSUFBSSxHQUFHM0MsaUJBQWlCLEdBQUdzQyxtQkFBbUIsQ0FBRXRDLGlCQUFrQixDQUFDLEdBQUcsSUFBSTtJQUM5RSxJQUFJMkUsSUFBSTtJQUNSLElBQUlGLElBQUk7SUFFUixJQUFLLENBQUU5QixJQUFJLElBQUksQ0FBQyxLQUFLNUMsZUFBZSxDQUFDbUMsTUFBTSxFQUFHO01BQzdDUyxJQUFJLEdBQUc1QyxlQUFlLENBQUMsQ0FBQyxDQUFDO0lBQzFCO0lBRUEsSUFBSyxDQUFFNEMsSUFBSSxJQUFJLENBQUVBLElBQUksQ0FBQ29GLElBQUksSUFBSSxDQUFDLEtBQUtwRixJQUFJLENBQUNvRixJQUFJLENBQUM3RixNQUFNLEVBQUc7TUFDdEQsT0FBTyxJQUFJO0lBQ1o7SUFFQXlDLElBQUksR0FBRzlDLEtBQUssQ0FBQ0csSUFBSSxDQUFFLGlDQUFpQyxHQUFHVyxJQUFJLENBQUNvRixJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSyxDQUFDO0lBQzVFdEQsSUFBSSxHQUFHRSxJQUFJLENBQUNqRCxJQUFJLENBQUUsbUJBQW9CLENBQUM7SUFFdkMsSUFBSyxDQUFFK0MsSUFBSSxFQUFHO01BQ2IsT0FBTyxJQUFJO0lBQ1o7SUFFQSxPQUFPO01BQ05tQyxXQUFXLEVBQUVoRixXQUFXLENBQUVDLEtBQUssRUFBRSxVQUFXLENBQUMsQ0FBQ2dGLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRTtNQUN6RG1ILGFBQWEsRUFBRXZKLElBQUk7TUFDbkJ3SixhQUFhLEVBQUV4TixlQUFlLENBQUVrQyxJQUFJLENBQUNuQixLQUFNLENBQUMsR0FBRyxLQUFLLEdBQUdmLGVBQWUsQ0FBRWtDLElBQUksQ0FBQ2hCLEdBQUksQ0FBQztNQUNsRitMLFlBQVksRUFBRS9LLElBQUksQ0FBQ25CLEtBQUssR0FBRyxFQUFFO01BQzdCbU0sVUFBVSxFQUFFaEwsSUFBSSxDQUFDaEIsR0FBRyxHQUFHO0lBQ3hCLENBQUM7RUFDRjtFQUVBLFNBQVN1TSxvQ0FBb0NBLENBQUVyTSxLQUFLLEVBQUc7SUFDdEQsSUFBSXNDLFFBQVEsR0FBR0MsTUFBTSxDQUFDQyxnQ0FBZ0MsSUFBSSxDQUFDLENBQUM7SUFDNUQsSUFBSUMsTUFBTSxHQUFHSCxRQUFRLENBQUNJLElBQUksSUFBSSxDQUFDLENBQUM7SUFDaEMsSUFBSTRKLE9BQU8sR0FBR0osb0NBQW9DLENBQUVsTSxLQUFNLENBQUM7SUFDM0QsSUFBSXVNLFdBQVc7SUFFZixJQUFLLENBQUVELE9BQU8sRUFBRztNQUNoQixJQUFLL0osTUFBTSxDQUFDbUQsdUJBQXVCLEVBQUc7UUFDckNBLHVCQUF1QixDQUFFakQsTUFBTSxDQUFDK0osMkJBQTJCLElBQUksMENBQTBDLEVBQUUsU0FBUyxFQUFFLElBQUssQ0FBQztNQUM3SDtNQUNBLE9BQU8sS0FBSztJQUNiO0lBRUEsSUFBSyxVQUFVLEtBQUssT0FBT2pLLE1BQU0sQ0FBQ2tLLDBDQUEwQyxFQUFHO01BQzlFLElBQUtsSyxNQUFNLENBQUNtRCx1QkFBdUIsRUFBRztRQUNyQ0EsdUJBQXVCLENBQUVqRCxNQUFNLENBQUNpSyx5QkFBeUIsSUFBSSxrREFBa0QsRUFBRSxTQUFTLEVBQUUsSUFBSyxDQUFDO01BQ25JO01BQ0EsT0FBTyxLQUFLO0lBQ2I7SUFFQUgsV0FBVyxHQUFHeE8sQ0FBQyxDQUFFLHdDQUF5QyxDQUFDLENBQUNpSCxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUU7SUFFdkVvRixzQkFBc0IsQ0FBRXBLLEtBQU0sQ0FBQztJQUMvQnVDLE1BQU0sQ0FBQ21ILFVBQVUsQ0FBRSxZQUFZO01BQzlCbkgsTUFBTSxDQUFDa0ssMENBQTBDLENBQUU7UUFDbERFLElBQUksRUFBRSxLQUFLO1FBQ1g1SCxXQUFXLEVBQUV1SCxPQUFPLENBQUN2SCxXQUFXO1FBQ2hDNkgsWUFBWSxFQUFFTCxXQUFXO1FBQ3pCSixhQUFhLEVBQUVHLE9BQU8sQ0FBQ0gsYUFBYTtRQUNwQ0MsYUFBYSxFQUFFRSxPQUFPLENBQUNGLGFBQWE7UUFDcENTLHFCQUFxQixFQUFFLENBQUM7UUFDeEJDLG9CQUFvQixFQUFFLG9CQUFvQjtRQUMxQ0MsbUJBQW1CLEVBQUVuTyxlQUFlLENBQUUwTixPQUFPLENBQUNULFlBQVksR0FBRyxFQUFHLENBQUM7UUFDakVtQixpQkFBaUIsRUFBRXBPLGVBQWUsQ0FBRTBOLE9BQU8sQ0FBQ1IsVUFBVSxHQUFHLEVBQUc7TUFDN0QsQ0FBRSxDQUFDO0lBQ0osQ0FBQyxFQUFFLEdBQUksQ0FBQztJQUVSLE9BQU8sSUFBSTtFQUNaO0VBRUEsU0FBU21CLFVBQVVBLENBQUVySyxJQUFJLEVBQUc7SUFDM0IsT0FBTyxJQUFJc0ssSUFBSSxDQUFFdEssSUFBSSxDQUFDdUssV0FBVyxDQUFDLENBQUMsRUFBRXZLLElBQUksQ0FBQ3dLLFFBQVEsQ0FBQyxDQUFDLEVBQUV4SyxJQUFJLENBQUN5SyxPQUFPLENBQUMsQ0FBRSxDQUFDO0VBQ3ZFO0VBRUEsU0FBU0MsUUFBUUEsQ0FBRTFLLElBQUksRUFBRTJLLElBQUksRUFBRztJQUMvQixJQUFJQyxJQUFJLEdBQUdQLFVBQVUsQ0FBRXJLLElBQUssQ0FBQztJQUM3QjRLLElBQUksQ0FBQ0MsT0FBTyxDQUFFRCxJQUFJLENBQUNILE9BQU8sQ0FBQyxDQUFDLEdBQUdFLElBQUssQ0FBQztJQUNyQyxPQUFPQyxJQUFJO0VBQ1o7RUFFQSxTQUFTRSxlQUFlQSxDQUFFOUssSUFBSSxFQUFHO0lBQ2hDLE9BQU9BLElBQUksQ0FBQ3VLLFdBQVcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxHQUFHek8sS0FBSyxDQUFFa0UsSUFBSSxDQUFDd0ssUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFFLENBQUMsR0FBRyxHQUFHLEdBQUcxTyxLQUFLLENBQUVrRSxJQUFJLENBQUN5SyxPQUFPLENBQUMsQ0FBRSxDQUFDO0VBQy9GO0VBRUEsU0FBU00sZUFBZUEsQ0FBRS9LLElBQUksRUFBRztJQUNoQyxJQUFJMkssSUFBSSxHQUFHLENBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFFO0lBQzlELElBQUlLLE1BQU0sR0FBRyxDQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFFO0lBQ25HLE9BQU9MLElBQUksQ0FBRTNLLElBQUksQ0FBQ2lMLE1BQU0sQ0FBQyxDQUFDLENBQUUsR0FBRyxHQUFHLEdBQUdELE1BQU0sQ0FBRWhMLElBQUksQ0FBQ3dLLFFBQVEsQ0FBQyxDQUFDLENBQUUsR0FBRyxHQUFHLEdBQUd4SyxJQUFJLENBQUN5SyxPQUFPLENBQUMsQ0FBQztFQUN0RjtFQUVBLFNBQVNTLHlCQUF5QkEsQ0FBRUMsU0FBUyxFQUFFQyxPQUFPLEVBQUc7SUFDeEQsT0FBT2pRLENBQUMsQ0FBQ2tRLFFBQVEsQ0FBQ0MsVUFBVSxDQUFFLFNBQVMsRUFBRUgsU0FBVSxDQUFDLEdBQUcsS0FBSyxHQUFHaFEsQ0FBQyxDQUFDa1EsUUFBUSxDQUFDQyxVQUFVLENBQUUsU0FBUyxFQUFFRixPQUFRLENBQUM7RUFDM0c7RUFFQSxTQUFTRyxtQkFBbUJBLENBQUVuTyxLQUFLLEVBQUc7SUFDckMsSUFBSzVCLFlBQVksQ0FBQ2lDLE1BQU0sRUFBRztNQUMxQjtJQUNEO0lBQ0FqQyxZQUFZLEdBQUc0QixLQUFLLENBQUNHLElBQUksQ0FBRSxjQUFlLENBQUMsQ0FBQzBJLEtBQUssQ0FBRSxLQUFNLENBQUMsQ0FBQ3VGLE9BQU8sQ0FBQyxDQUFDO0lBQ3BFclEsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFeEMsWUFBWSxFQUFFLFVBQVd5QyxLQUFLLEVBQUV3TixHQUFHLEVBQUc7TUFDN0N0USxDQUFDLENBQUVzUSxHQUFJLENBQUMsQ0FBQ2xPLElBQUksQ0FBRSxxREFBc0QsQ0FBQyxDQUFDd0MsTUFBTSxDQUFDLENBQUM7TUFDL0U1RSxDQUFDLENBQUVzUSxHQUFJLENBQUMsQ0FBQ2xPLElBQUksQ0FBRSw2QkFBOEIsQ0FBQyxDQUFDZ0osV0FBVyxDQUFFLHNCQUF1QixDQUFDLENBQUN0SixJQUFJLENBQUUsUUFBUSxFQUFFLFFBQVMsQ0FBQztJQUNoSCxDQUFFLENBQUM7RUFDSjtFQUVBLFNBQVN5TyxnQkFBZ0JBLENBQUV0TyxLQUFLLEVBQUV1TyxLQUFLLEVBQUc7SUFDekMsSUFBSUMsU0FBUyxHQUFHeE8sS0FBSyxDQUFDRyxJQUFJLENBQUUsZUFBZ0IsQ0FBQztJQUM3QyxJQUFJc08sS0FBSyxHQUFHRCxTQUFTLENBQUNyTyxJQUFJLENBQUUsY0FBZSxDQUFDO0lBQzVDLElBQUlnRyxDQUFDO0lBQ0wsSUFBSXVJLE1BQU07SUFFVkgsS0FBSyxHQUFHeFAsSUFBSSxDQUFDSyxHQUFHLENBQUUsQ0FBQyxFQUFFbVAsS0FBTSxDQUFDO0lBQzVCSixtQkFBbUIsQ0FBRW5PLEtBQU0sQ0FBQztJQUU1QixJQUFLeU8sS0FBSyxDQUFDcE8sTUFBTSxHQUFHa08sS0FBSyxFQUFHO01BQzNCRSxLQUFLLENBQUNFLEtBQUssQ0FBRUosS0FBTSxDQUFDLENBQUM1TCxNQUFNLENBQUMsQ0FBQztJQUM5QjtJQUVBLEtBQU13RCxDQUFDLEdBQUdxSSxTQUFTLENBQUNyTyxJQUFJLENBQUUsY0FBZSxDQUFDLENBQUNFLE1BQU0sRUFBRThGLENBQUMsR0FBR29JLEtBQUssRUFBRXBJLENBQUMsRUFBRSxFQUFHO01BQ25FdUksTUFBTSxHQUFHM1EsQ0FBQyxDQUFFSyxZQUFZLENBQUUrSCxDQUFDLEdBQUcvSCxZQUFZLENBQUNpQyxNQUFNLENBQUcsQ0FBQyxDQUFDd0ksS0FBSyxDQUFFLEtBQU0sQ0FBQztNQUNwRTZGLE1BQU0sQ0FBQ3ZPLElBQUksQ0FBRSxxREFBc0QsQ0FBQyxDQUFDd0MsTUFBTSxDQUFDLENBQUM7TUFDN0UrTCxNQUFNLENBQUN2TyxJQUFJLENBQUUsNkJBQThCLENBQUMsQ0FBQ2dKLFdBQVcsQ0FBRSxzQkFBdUIsQ0FBQyxDQUFDdEosSUFBSSxDQUFFLFFBQVEsRUFBRSxRQUFTLENBQUM7TUFDN0cyTyxTQUFTLENBQUNySyxNQUFNLENBQUV1SyxNQUFPLENBQUM7SUFDM0I7SUFFQUYsU0FBUyxDQUFDck8sSUFBSSxDQUFFLGNBQWUsQ0FBQyxDQUFDUyxJQUFJLENBQUUsVUFBV0MsS0FBSyxFQUFHO01BQ3pEOUMsQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDOEIsSUFBSSxDQUFFLGtCQUFrQixFQUFFd0csTUFBTSxDQUFFeEYsS0FBTSxDQUFFLENBQUM7SUFDdEQsQ0FBRSxDQUFDO0VBQ0o7RUFFQSxTQUFTK04sMEJBQTBCQSxDQUFFNU8sS0FBSyxFQUFFK04sU0FBUyxFQUFFQyxPQUFPLEVBQUc7SUFDaEUsSUFBSWEsS0FBSyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUk7SUFDL0IsSUFBSUMsU0FBUyxHQUFHL1AsSUFBSSxDQUFDUyxLQUFLLENBQUUsQ0FBRXlOLFVBQVUsQ0FBRWUsT0FBUSxDQUFDLENBQUNlLE9BQU8sQ0FBQyxDQUFDLEdBQUc5QixVQUFVLENBQUVjLFNBQVUsQ0FBQyxDQUFDZ0IsT0FBTyxDQUFDLENBQUMsSUFBS0YsS0FBTSxDQUFDLEdBQUcsQ0FBQztJQUVqSEMsU0FBUyxHQUFHL1AsSUFBSSxDQUFDSyxHQUFHLENBQUUsQ0FBQyxFQUFFMFAsU0FBVSxDQUFDO0lBQ3BDUixnQkFBZ0IsQ0FBRXRPLEtBQUssRUFBRThPLFNBQVUsQ0FBQztJQUVwQzlPLEtBQUssQ0FBQ0csSUFBSSxDQUFFLGNBQWUsQ0FBQyxDQUFDUyxJQUFJLENBQUUsVUFBV0MsS0FBSyxFQUFHO01BQ3JELElBQUltTyxPQUFPLEdBQUcxQixRQUFRLENBQUVTLFNBQVMsRUFBRWxOLEtBQU0sQ0FBQztNQUMxQzlDLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FDUDhCLElBQUksQ0FBRSxtQkFBbUIsRUFBRTZOLGVBQWUsQ0FBRXNCLE9BQVEsQ0FBRSxDQUFDLENBQ3ZEN08sSUFBSSxDQUFFLHlCQUEwQixDQUFDLENBQUNzRyxJQUFJLENBQUVrSCxlQUFlLENBQUVxQixPQUFRLENBQUUsQ0FBQztJQUN2RSxDQUFFLENBQUM7SUFFSDlRLGVBQWUsR0FBR0gsQ0FBQyxDQUFDa1IsSUFBSSxDQUFFL1EsZUFBZSxFQUFFLFVBQVc0QyxJQUFJLEVBQUc7TUFDNURBLElBQUksQ0FBQ29GLElBQUksR0FBR25JLENBQUMsQ0FBQ2tSLElBQUksQ0FBRW5PLElBQUksQ0FBQ29GLElBQUksRUFBRSxVQUFXSyxLQUFLLEVBQUc7UUFDakQsT0FBT3ZHLEtBQUssQ0FBQ0csSUFBSSxDQUFFLGlDQUFpQyxHQUFHb0csS0FBSyxHQUFHLElBQUssQ0FBQyxDQUFDbEcsTUFBTSxHQUFHLENBQUM7TUFDakYsQ0FBRSxDQUFDO01BQ0gsT0FBT1MsSUFBSSxDQUFDb0YsSUFBSSxDQUFDN0YsTUFBTSxHQUFHLENBQUM7SUFDNUIsQ0FBRSxDQUFDO0lBQ0g2Tyx1QkFBdUIsQ0FBRS9RLGlCQUFrQixDQUFDO0lBRTVDeUQsYUFBYSxDQUFFNUIsS0FBSyxDQUFDRyxJQUFJLENBQUUsZUFBZ0IsQ0FBRSxDQUFDO0lBQzlDZ1AsaUJBQWlCLENBQUVuUCxLQUFNLENBQUM7SUFDMUI4SSxvQkFBb0IsQ0FBRTlJLEtBQU0sQ0FBQztFQUM5QjtFQUVBLFNBQVNvUCx3QkFBd0JBLENBQUVDLFdBQVcsRUFBRUMsVUFBVSxFQUFHO0lBQzVELElBQUkvRCxLQUFLLEdBQUcsRUFBRTtJQUNkLElBQUlnRSxLQUFLO0lBQ1QsSUFBSTVQLEtBQUs7SUFDVCxJQUFJRyxHQUFHO0lBRVAsSUFBS3dQLFVBQVUsSUFBSXZSLENBQUMsQ0FBQ3lSLE9BQU8sQ0FBRUYsVUFBVSxDQUFDRyxLQUFNLENBQUMsRUFBRztNQUNsRGxFLEtBQUssR0FBRytELFVBQVUsQ0FBQ0csS0FBSztJQUN6QixDQUFDLE1BQU0sSUFBS0gsVUFBVSxJQUFJdlIsQ0FBQyxDQUFDeVIsT0FBTyxDQUFFRixVQUFVLENBQUNJLFFBQVMsQ0FBQyxFQUFHO01BQzVEbkUsS0FBSyxHQUFHK0QsVUFBVSxDQUFDSSxRQUFRO0lBQzVCLENBQUMsTUFBTSxJQUFLM1IsQ0FBQyxDQUFDeVIsT0FBTyxDQUFFRixVQUFXLENBQUMsRUFBRztNQUNyQy9ELEtBQUssR0FBRytELFVBQVU7SUFDbkI7SUFFQS9ELEtBQUssR0FBR3hOLENBQUMsQ0FBQ2tSLElBQUksQ0FBRTFELEtBQUssRUFBRSxVQUFXM0ksSUFBSSxFQUFHO01BQ3hDLE9BQU9BLElBQUksWUFBWXNLLElBQUksSUFBSSxDQUFFeUMsS0FBSyxDQUFFL00sSUFBSSxDQUFDbU0sT0FBTyxDQUFDLENBQUUsQ0FBQztJQUN6RCxDQUFFLENBQUM7SUFFSCxJQUFLeEQsS0FBSyxDQUFDbEwsTUFBTSxFQUFHO01BQ25Ca0wsS0FBSyxDQUFDUSxJQUFJLENBQUUsVUFBV0MsQ0FBQyxFQUFFQyxDQUFDLEVBQUc7UUFDN0IsT0FBT2dCLFVBQVUsQ0FBRWpCLENBQUUsQ0FBQyxDQUFDK0MsT0FBTyxDQUFDLENBQUMsR0FBRzlCLFVBQVUsQ0FBRWhCLENBQUUsQ0FBQyxDQUFDOEMsT0FBTyxDQUFDLENBQUM7TUFDN0QsQ0FBRSxDQUFDO01BRUgsT0FBTztRQUNOcFAsS0FBSyxFQUFFc04sVUFBVSxDQUFFMUIsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDO1FBQzdCekwsR0FBRyxFQUFFbU4sVUFBVSxDQUFFMUIsS0FBSyxDQUFFQSxLQUFLLENBQUNsTCxNQUFNLEdBQUcsQ0FBQyxDQUFHO01BQzVDLENBQUM7SUFDRjtJQUVBa1AsS0FBSyxHQUFHbEosTUFBTSxDQUFFZ0osV0FBVyxJQUFJLEVBQUcsQ0FBQyxDQUFDTyxLQUFLLENBQUUsS0FBTSxDQUFDO0lBQ2xEalEsS0FBSyxHQUFHa1EsZUFBZSxDQUFFTixLQUFLLENBQUMsQ0FBQyxDQUFFLENBQUM7SUFDbkN6UCxHQUFHLEdBQUcrUCxlQUFlLENBQUVOLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSUEsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDO0lBRTdDLElBQUs1UCxLQUFLLElBQUlHLEdBQUcsRUFBRztNQUNuQixPQUFPO1FBQ05ILEtBQUssRUFBRUEsS0FBSztRQUNaRyxHQUFHLEVBQUVBO01BQ04sQ0FBQztJQUNGO0lBRUEsT0FBTyxJQUFJO0VBQ1o7RUFFQSxTQUFTZ1EsMkJBQTJCQSxDQUFFQyxLQUFLLEVBQUc7SUFDN0MsSUFBSUMsSUFBSTtJQUVSLElBQUssQ0FBRWpTLENBQUMsQ0FBQ2tRLFFBQVEsSUFBSSxVQUFVLEtBQUssT0FBT2xRLENBQUMsQ0FBQ2tRLFFBQVEsQ0FBQ2dDLFFBQVEsSUFBSSxDQUFFRixLQUFLLENBQUMxUCxNQUFNLEVBQUc7TUFDbEYsT0FBTyxJQUFJO0lBQ1o7SUFFQTJQLElBQUksR0FBR2pTLENBQUMsQ0FBQ2tRLFFBQVEsQ0FBQ2dDLFFBQVEsQ0FBRUYsS0FBSyxDQUFDLENBQUMsQ0FBRSxDQUFDO0lBQ3RDLElBQUssQ0FBRUMsSUFBSSxFQUFHO01BQ2IsT0FBTyxJQUFJO0lBQ1o7SUFFQSxPQUFPWix3QkFBd0IsQ0FBRVcsS0FBSyxDQUFDL0ssR0FBRyxDQUFDLENBQUMsRUFBRWpILENBQUMsQ0FBQ2tRLFFBQVEsQ0FBQ2lDLFFBQVEsQ0FBRUYsSUFBSyxDQUFFLENBQUM7RUFDNUU7RUFFQSxTQUFTRywwQkFBMEJBLENBQUVuUSxLQUFLLEVBQUV5UCxLQUFLLEVBQUVXLE9BQU8sRUFBRztJQUM1RCxJQUFJTCxLQUFLLEdBQUdoUSxXQUFXLENBQUVDLEtBQUssRUFBRSxZQUFhLENBQUM7SUFDOUMsSUFBSStOLFNBQVM7SUFDYixJQUFJQyxPQUFPO0lBQ1gsSUFBSXFDLFFBQVE7SUFDWixJQUFJQyxNQUFNO0lBQ1YsSUFBSUMsVUFBVTtJQUNkLElBQUlDLE9BQU87SUFFWEosT0FBTyxHQUFHQSxPQUFPLElBQUksQ0FBQyxDQUFDO0lBRXZCLElBQUssQ0FBRVgsS0FBSyxJQUFJLENBQUVBLEtBQUssQ0FBQzlQLEtBQUssSUFBSSxDQUFFOFAsS0FBSyxDQUFDM1AsR0FBRyxFQUFHO01BQzlDLE9BQU8sS0FBSztJQUNiO0lBRUFpTyxTQUFTLEdBQUdkLFVBQVUsQ0FBRXdDLEtBQUssQ0FBQzlQLEtBQU0sQ0FBQztJQUNyQ3FPLE9BQU8sR0FBR2YsVUFBVSxDQUFFd0MsS0FBSyxDQUFDM1AsR0FBSSxDQUFDO0lBRWpDLElBQUtpTyxTQUFTLENBQUNnQixPQUFPLENBQUMsQ0FBQyxHQUFHZixPQUFPLENBQUNlLE9BQU8sQ0FBQyxDQUFDLEVBQUc7TUFDOUNVLEtBQUssR0FBRzFCLFNBQVM7TUFDakJBLFNBQVMsR0FBR0MsT0FBTztNQUNuQkEsT0FBTyxHQUFHeUIsS0FBSztJQUNoQjtJQUVBWSxRQUFRLEdBQUczQyxlQUFlLENBQUVLLFNBQVUsQ0FBQztJQUN2Q3VDLE1BQU0sR0FBRzVDLGVBQWUsQ0FBRU0sT0FBUSxDQUFDO0lBQ25DdUMsVUFBVSxHQUFHUixLQUFLLENBQUNsUSxJQUFJLENBQUUsb0JBQXFCLENBQUMsR0FBRyxHQUFHLEdBQUdrUSxLQUFLLENBQUNsUSxJQUFJLENBQUUsa0JBQW1CLENBQUM7SUFDeEYyUSxPQUFPLEdBQUdILFFBQVEsR0FBRyxHQUFHLEdBQUdDLE1BQU07SUFFakMsSUFBS0MsVUFBVSxLQUFLQyxPQUFPLEVBQUc7TUFDN0JULEtBQUssQ0FBQy9LLEdBQUcsQ0FBRThJLHlCQUF5QixDQUFFQyxTQUFTLEVBQUVDLE9BQVEsQ0FBRSxDQUFDO01BQzVELElBQUtvQyxPQUFPLENBQUNLLFlBQVksRUFBRztRQUMzQnBNLHNCQUFzQixDQUFFckUsS0FBTSxDQUFDO01BQ2hDO01BQ0EsT0FBTyxLQUFLO0lBQ2I7SUFFQStQLEtBQUssQ0FDSGxRLElBQUksQ0FBRSxvQkFBb0IsRUFBRXdRLFFBQVMsQ0FBQyxDQUN0Q3hRLElBQUksQ0FBRSxrQkFBa0IsRUFBRXlRLE1BQU8sQ0FBQyxDQUNsQ3RMLEdBQUcsQ0FBRThJLHlCQUF5QixDQUFFQyxTQUFTLEVBQUVDLE9BQVEsQ0FBRSxDQUFDO0lBRXhEWSwwQkFBMEIsQ0FBRTVPLEtBQUssRUFBRStOLFNBQVMsRUFBRUMsT0FBUSxDQUFDO0lBQ3ZEM0osc0JBQXNCLENBQUVyRSxLQUFNLENBQUM7SUFFL0IsT0FBTyxJQUFJO0VBQ1o7RUFFQSxTQUFTMFEsMEJBQTBCQSxDQUFFMVEsS0FBSyxFQUFHO0lBQzVDLElBQUkrUCxLQUFLLEdBQUdoUSxXQUFXLENBQUVDLEtBQUssRUFBRSxZQUFhLENBQUM7SUFDOUMsSUFBSXlQLEtBQUssR0FBR0ssMkJBQTJCLENBQUVDLEtBQU0sQ0FBQyxJQUFJWCx3QkFBd0IsQ0FBRVcsS0FBSyxDQUFDL0ssR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFLLENBQUM7SUFFakdtTCwwQkFBMEIsQ0FBRW5RLEtBQUssRUFBRXlQLEtBQU0sQ0FBQztFQUMzQztFQUVBLFNBQVNrQiw4QkFBOEJBLENBQUUzUSxLQUFLLEVBQUc7SUFDaEQsSUFBSStQLEtBQUssR0FBR2hRLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLFlBQWEsQ0FBQztJQUM5QyxJQUFJK04sU0FBUyxHQUFHOEIsZUFBZSxDQUFFRSxLQUFLLENBQUNsUSxJQUFJLENBQUUsb0JBQXFCLENBQUUsQ0FBQztJQUNyRSxJQUFJbU8sT0FBTyxHQUFHNkIsZUFBZSxDQUFFRSxLQUFLLENBQUNsUSxJQUFJLENBQUUsa0JBQW1CLENBQUUsQ0FBQztJQUVqRSxJQUFLa08sU0FBUyxJQUFJQyxPQUFPLEVBQUc7TUFDM0IsT0FBTztRQUNOck8sS0FBSyxFQUFFb08sU0FBUztRQUNoQmpPLEdBQUcsRUFBRWtPO01BQ04sQ0FBQztJQUNGO0lBRUEsT0FBTyxJQUFJO0VBQ1o7RUFFQSxTQUFTNEMsc0JBQXNCQSxDQUFFNVEsS0FBSyxFQUFHO0lBQ3hDLElBQUkrUCxLQUFLLEdBQUdoUSxXQUFXLENBQUVDLEtBQUssRUFBRSxZQUFhLENBQUM7SUFDOUMsSUFBSXlQLEtBQUssR0FBR2tCLDhCQUE4QixDQUFFM1EsS0FBTSxDQUFDLElBQUlvUCx3QkFBd0IsQ0FBRVcsS0FBSyxDQUFDL0ssR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFLLENBQUM7SUFFcEcsSUFBS3lLLEtBQUssRUFBRztNQUNaLE9BQU9BLEtBQUs7SUFDYjtJQUVBLE9BQU87TUFDTjlQLEtBQUssRUFBRWtRLGVBQWUsQ0FBRUUsS0FBSyxDQUFDbFEsSUFBSSxDQUFFLG9CQUFxQixDQUFFLENBQUM7TUFDNURDLEdBQUcsRUFBRStQLGVBQWUsQ0FBRUUsS0FBSyxDQUFDbFEsSUFBSSxDQUFFLGtCQUFtQixDQUFFO0lBQ3hELENBQUM7RUFDRjtFQUVBLFNBQVNnUixnQkFBZ0JBLENBQUU3USxLQUFLLEVBQUU4USxTQUFTLEVBQUc7SUFDN0MsSUFBSXJCLEtBQUssR0FBR21CLHNCQUFzQixDQUFFNVEsS0FBTSxDQUFDO0lBQzNDLElBQUk2TyxLQUFLLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSTtJQUMvQixJQUFJQyxTQUFTO0lBQ2IsSUFBSWlDLEtBQUs7SUFFVCxJQUFLLENBQUV0QixLQUFLLElBQUksQ0FBRUEsS0FBSyxDQUFDOVAsS0FBSyxJQUFJLENBQUU4UCxLQUFLLENBQUMzUCxHQUFHLEVBQUc7TUFDOUMsT0FBTyxLQUFLO0lBQ2I7SUFFQWdQLFNBQVMsR0FBRy9QLElBQUksQ0FBQ1MsS0FBSyxDQUFFLENBQUV5TixVQUFVLENBQUV3QyxLQUFLLENBQUMzUCxHQUFJLENBQUMsQ0FBQ2lQLE9BQU8sQ0FBQyxDQUFDLEdBQUc5QixVQUFVLENBQUV3QyxLQUFLLENBQUM5UCxLQUFNLENBQUMsQ0FBQ29QLE9BQU8sQ0FBQyxDQUFDLElBQUtGLEtBQU0sQ0FBQyxHQUFHLENBQUM7SUFDakhrQyxLQUFLLEdBQUdoUyxJQUFJLENBQUNLLEdBQUcsQ0FBRSxDQUFDLEVBQUUwUCxTQUFVLENBQUMsSUFBSyxNQUFNLEtBQUtnQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFFO0lBRXBFRSxlQUFlLENBQUVoUixLQUFNLENBQUM7SUFDeEIsT0FBT21RLDBCQUEwQixDQUFFblEsS0FBSyxFQUFFO01BQ3pDTCxLQUFLLEVBQUUyTixRQUFRLENBQUVtQyxLQUFLLENBQUM5UCxLQUFLLEVBQUVvUixLQUFNLENBQUM7TUFDckNqUixHQUFHLEVBQUV3TixRQUFRLENBQUVtQyxLQUFLLENBQUMzUCxHQUFHLEVBQUVpUixLQUFNO0lBQ2pDLENBQUMsRUFBRTtNQUNGTixZQUFZLEVBQUU7SUFDZixDQUFFLENBQUM7RUFDSjtFQUVBLFNBQVNaLGVBQWVBLENBQUVwSixJQUFJLEVBQUc7SUFDaEMsSUFBSXdLLE1BQU07SUFDVixJQUFJQyxRQUFRO0lBRVp6SyxJQUFJLEdBQUcxSSxDQUFDLENBQUN5SSxJQUFJLENBQUVDLElBQUksSUFBSSxFQUFHLENBQUM7SUFDM0IsSUFBSyxDQUFFQSxJQUFJLEVBQUc7TUFDYixPQUFPLElBQUk7SUFDWjtJQUVBeUssUUFBUSxHQUFHekssSUFBSSxDQUFDMEssS0FBSyxDQUFFLDBCQUEyQixDQUFDO0lBQ25ELElBQUtELFFBQVEsRUFBRztNQUNmLE9BQU8sSUFBSWhFLElBQUksQ0FBRXROLFFBQVEsQ0FBRXNSLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFHLENBQUMsRUFBRXRSLFFBQVEsQ0FBRXNSLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFHLENBQUMsR0FBRyxDQUFDLEVBQUV0UixRQUFRLENBQUVzUixRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRyxDQUFFLENBQUM7SUFDN0c7SUFFQSxJQUFLblQsQ0FBQyxDQUFDa1EsUUFBUSxJQUFJLFVBQVUsS0FBSyxPQUFPbFEsQ0FBQyxDQUFDa1EsUUFBUSxDQUFDbUQsU0FBUyxFQUFHO01BQy9ELElBQUk7UUFDSEgsTUFBTSxHQUFHbFQsQ0FBQyxDQUFDa1EsUUFBUSxDQUFDbUQsU0FBUyxDQUFFLFNBQVMsRUFBRTNLLElBQUssQ0FBQztNQUNqRCxDQUFDLENBQUMsT0FBUTRLLEtBQUssRUFBRztRQUNqQkosTUFBTSxHQUFHLElBQUk7TUFDZDtJQUNEO0lBRUEsSUFBSyxDQUFFQSxNQUFNLEVBQUc7TUFDZkEsTUFBTSxHQUFHLElBQUkvRCxJQUFJLENBQUV6RyxJQUFLLENBQUM7SUFDMUI7SUFFQSxPQUFPd0ssTUFBTSxZQUFZL0QsSUFBSSxJQUFJLENBQUV5QyxLQUFLLENBQUVzQixNQUFNLENBQUNsQyxPQUFPLENBQUMsQ0FBRSxDQUFDLEdBQUc5QixVQUFVLENBQUVnRSxNQUFPLENBQUMsR0FBRyxJQUFJO0VBQzNGO0VBRUEsU0FBU0ssc0JBQXNCQSxDQUFFaEYsT0FBTyxFQUFFOEQsT0FBTyxFQUFHO0lBQ25ELElBQUltQixRQUFRLEdBQUdqRixPQUFPLEdBQUd2TyxDQUFDLENBQUV1TyxPQUFRLENBQUMsR0FBR3ZPLENBQUMsQ0FBRTBMLFFBQVMsQ0FBQztJQUNyRCxJQUFJekosS0FBSyxHQUFHdVIsUUFBUSxDQUFDQyxFQUFFLENBQUUsZUFBZ0IsQ0FBQyxHQUFHRCxRQUFRLEdBQUdBLFFBQVEsQ0FBQ3BSLElBQUksQ0FBRSxlQUFnQixDQUFDLENBQUNDLEtBQUssQ0FBQyxDQUFDO0lBQ2hHLElBQUkyTixTQUFTO0lBQ2IsSUFBSUMsT0FBTztJQUNYLElBQUl5RCxlQUFlLEdBQUcsS0FBSztJQUMzQixJQUFJQyxZQUFZLEdBQUcsS0FBSztJQUV4QnRCLE9BQU8sR0FBR0EsT0FBTyxJQUFJLENBQUMsQ0FBQztJQUV2QixJQUFLLENBQUVwUSxLQUFLLENBQUNLLE1BQU0sRUFBRztNQUNyQixPQUFPLEtBQUs7SUFDYjtJQUVBc1Isb0JBQW9CLENBQUUzUixLQUFLLEVBQUUsSUFBSyxDQUFDO0lBRW5DLElBQUtvUSxPQUFPLENBQUNyTCxXQUFXLEVBQUc7TUFDMUIwTSxlQUFlLEdBQUdwTCxNQUFNLENBQUV0RyxXQUFXLENBQUVDLEtBQUssRUFBRSxVQUFXLENBQUMsQ0FBQ2dGLEdBQUcsQ0FBQyxDQUFFLENBQUMsS0FBS3FCLE1BQU0sQ0FBRStKLE9BQU8sQ0FBQ3JMLFdBQVksQ0FBQztNQUNwR2hGLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLFVBQVcsQ0FBQyxDQUFDZ0YsR0FBRyxDQUFFcUIsTUFBTSxDQUFFK0osT0FBTyxDQUFDckwsV0FBWSxDQUFFLENBQUM7SUFDdEU7SUFFQWdKLFNBQVMsR0FBRzhCLGVBQWUsQ0FBRU8sT0FBTyxDQUFDbkwsVUFBVyxDQUFDO0lBQ2pEK0ksT0FBTyxHQUFHNkIsZUFBZSxDQUFFTyxPQUFPLENBQUNsTCxRQUFTLENBQUMsSUFBSTZJLFNBQVM7SUFFMUQsSUFBS0EsU0FBUyxJQUFJQyxPQUFPLEVBQUc7TUFDM0JnRCxlQUFlLENBQUVoUixLQUFNLENBQUM7TUFDeEIwUixZQUFZLEdBQUd2QiwwQkFBMEIsQ0FBRW5RLEtBQUssRUFBRTtRQUNqREwsS0FBSyxFQUFFb08sU0FBUztRQUNoQmpPLEdBQUcsRUFBRWtPO01BQ04sQ0FBRSxDQUFDO0lBQ0o7SUFFQSxJQUFLeUQsZUFBZSxJQUFJQyxZQUFZLEVBQUc7TUFDdEMsT0FBTyxJQUFJO0lBQ1o7SUFFQSxJQUFLRCxlQUFlLElBQUksQ0FBRUMsWUFBWSxFQUFHO01BQ3hDck4sc0JBQXNCLENBQUVyRSxLQUFNLENBQUM7SUFDaEM7SUFFQSxPQUFPLElBQUk7RUFDWjtFQUVBLFNBQVM0UixnQkFBZ0JBLENBQUU1UixLQUFLLEVBQUU2SyxLQUFLLEVBQUc7SUFDekMsSUFBSWdILFFBQVEsR0FBR2hILEtBQUssQ0FBQ2lILGFBQWEsSUFBSWpILEtBQUs7SUFDM0MsSUFBSWtILEtBQUssR0FBR0YsUUFBUSxDQUFDRyxPQUFPLElBQUlILFFBQVEsQ0FBQ0csT0FBTyxDQUFDM1IsTUFBTSxHQUFHd1IsUUFBUSxDQUFDRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUdILFFBQVE7SUFDeEYsSUFBSUksRUFBRSxHQUFHeEksUUFBUSxDQUFDeUksZ0JBQWdCLENBQUVILEtBQUssQ0FBQ0ksT0FBTyxFQUFFSixLQUFLLENBQUNLLE9BQVEsQ0FBQztJQUNsRSxJQUFJdFAsSUFBSSxHQUFHL0UsQ0FBQyxDQUFFa1UsRUFBRyxDQUFDLENBQUN0USxPQUFPLENBQUUsY0FBZSxDQUFDO0lBRTVDLElBQUssQ0FBRW1CLElBQUksQ0FBQ3pDLE1BQU0sSUFBSSxDQUFFdEMsQ0FBQyxDQUFDc1UsUUFBUSxDQUFFclMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFOEMsSUFBSSxDQUFDLENBQUMsQ0FBRSxDQUFDLEVBQUc7TUFDekQsT0FBTyxJQUFJO0lBQ1o7SUFFQSxPQUFPQSxJQUFJLENBQUNqRCxJQUFJLENBQUUsa0JBQW1CLENBQUM7RUFDdkM7RUFFQSxTQUFTeVMsbUJBQW1CQSxDQUFFekgsS0FBSyxFQUFFMEgsS0FBSyxFQUFHO0lBQzVDLElBQUlWLFFBQVEsR0FBR2hILEtBQUssQ0FBQ2lILGFBQWEsSUFBSWpILEtBQUs7SUFDM0MsSUFBSWtILEtBQUssR0FBR0YsUUFBUSxDQUFDRyxPQUFPLElBQUlILFFBQVEsQ0FBQ0csT0FBTyxDQUFDM1IsTUFBTSxHQUFHd1IsUUFBUSxDQUFDRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUdILFFBQVE7SUFDeEYsSUFBSW5TLEtBQUssR0FBRzZTLEtBQUssQ0FBQzVRLE9BQU8sQ0FBRSxlQUFnQixDQUFDO0lBQzVDLElBQUlwQixNQUFNLEdBQUdkLGVBQWUsQ0FBRUMsS0FBTSxDQUFDO0lBQ3JDLElBQUkySSxJQUFJLEdBQUdrSyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUNqSyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzNDLElBQUlrSyxLQUFLLEdBQUcsQ0FBRVQsS0FBSyxDQUFDSSxPQUFPLEdBQUc5SixJQUFJLENBQUNyRyxJQUFJLElBQUtxRyxJQUFJLENBQUNwRyxLQUFLO0lBQ3RELElBQUkzQyxNQUFNLEdBQUdpQixNQUFNLENBQUNaLEtBQUssR0FBRzZTLEtBQUssSUFBS2pTLE1BQU0sQ0FBQ1QsR0FBRyxHQUFHUyxNQUFNLENBQUNaLEtBQUssQ0FBRTtJQUVqRSxPQUFPVCxLQUFLLENBQUVHLFdBQVcsQ0FBRUMsTUFBTSxFQUFFaUIsTUFBTSxDQUFDaEIsSUFBSyxDQUFDLEVBQUVnQixNQUFNLENBQUNaLEtBQUssRUFBRVksTUFBTSxDQUFDVCxHQUFJLENBQUM7RUFDN0U7RUFFQSxTQUFTMlMsZ0JBQWdCQSxDQUFFelMsS0FBSyxFQUFFa0csSUFBSSxFQUFFdkcsS0FBSyxFQUFFRyxHQUFHLEVBQUc7SUFDcEQsSUFBSUosS0FBSyxHQUFHTSxLQUFLLENBQUNHLElBQUksQ0FBRSxlQUFnQixDQUFDO0lBQ3pDLElBQUlJLE1BQU0sR0FBR2QsZUFBZSxDQUFFQyxLQUFNLENBQUM7SUFDckMsSUFBSStQLEtBQUssR0FBR2pQLHlCQUF5QixDQUFFYixLQUFLLEVBQUVHLEdBQUcsRUFBRVMsTUFBTyxDQUFDO0lBQzNELElBQUlPLElBQUksR0FBRztNQUNWQyxFQUFFLEVBQUUsWUFBWSxHQUFHMUMsZUFBZSxFQUFFO01BQ3BDc0IsS0FBSyxFQUFFOFAsS0FBSyxDQUFDOVAsS0FBSztNQUNsQkcsR0FBRyxFQUFFMlAsS0FBSyxDQUFDM1AsR0FBRztNQUNkb0csSUFBSSxFQUFFQSxJQUFJLENBQUN5SSxLQUFLLENBQUUsQ0FBRTtJQUNyQixDQUFDO0lBRUR6USxlQUFlLENBQUNrSSxJQUFJLENBQUV0RixJQUFLLENBQUM7SUFDNUIzQyxpQkFBaUIsR0FBRzJDLElBQUksQ0FBQ0MsRUFBRTtJQUMzQm1PLHVCQUF1QixDQUFFcE8sSUFBSSxDQUFDQyxFQUFHLENBQUM7SUFDbENvTyxpQkFBaUIsQ0FBRW5QLEtBQU0sQ0FBQztJQUMxQixPQUFPUyxtQkFBbUIsQ0FBRXRDLGlCQUFrQixDQUFDO0VBQ2hEO0VBRUEsU0FBU3VVLGdCQUFnQkEsQ0FBRTFTLEtBQUssRUFBRVUsV0FBVyxFQUFFd0YsSUFBSSxFQUFFdkcsS0FBSyxFQUFFRyxHQUFHLEVBQUc7SUFDakUsSUFBSUosS0FBSyxHQUFHTSxLQUFLLENBQUNHLElBQUksQ0FBRSxlQUFnQixDQUFDO0lBQ3pDLElBQUlJLE1BQU0sR0FBR2QsZUFBZSxDQUFFQyxLQUFNLENBQUM7SUFDckMsSUFBSStQLEtBQUssR0FBR2pQLHlCQUF5QixDQUFFYixLQUFLLEVBQUVHLEdBQUcsRUFBRVMsTUFBTyxDQUFDO0lBQzNELElBQUlPLElBQUksR0FBR0wsbUJBQW1CLENBQUVDLFdBQVksQ0FBQztJQUU3QyxJQUFLLENBQUVJLElBQUksRUFBRztNQUNiO0lBQ0Q7SUFFQUEsSUFBSSxDQUFDbkIsS0FBSyxHQUFHOFAsS0FBSyxDQUFDOVAsS0FBSztJQUN4Qm1CLElBQUksQ0FBQ2hCLEdBQUcsR0FBRzJQLEtBQUssQ0FBQzNQLEdBQUc7SUFDcEJnQixJQUFJLENBQUNvRixJQUFJLEdBQUdBLElBQUksQ0FBQ3lJLEtBQUssQ0FBRSxDQUFFLENBQUM7SUFDM0JPLHVCQUF1QixDQUFFeE8sV0FBWSxDQUFDO0lBQ3RDeU8saUJBQWlCLENBQUVuUCxLQUFNLENBQUM7RUFDM0I7RUFFQSxTQUFTa1AsdUJBQXVCQSxDQUFFeUQsaUJBQWlCLEVBQUc7SUFDckQsSUFBSUMsU0FBUyxHQUFHLEVBQUU7SUFDbEIsSUFBSUMsTUFBTSxHQUFHLEVBQUU7SUFDZixJQUFJQyxNQUFNLEdBQUcsRUFBRTtJQUNmLElBQUlDLFdBQVcsR0FBRyxFQUFFO0lBRXBCaFYsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFMUMsZUFBZSxFQUFFLFVBQVcyQyxLQUFLLEVBQUVDLElBQUksRUFBRztNQUNqRC9DLENBQUMsQ0FBQzZDLElBQUksQ0FBRUUsSUFBSSxDQUFDb0YsSUFBSSxFQUFFLFVBQVdzRixRQUFRLEVBQUVqRixLQUFLLEVBQUc7UUFDL0NxTSxTQUFTLENBQUN4TSxJQUFJLENBQUU7VUFDZmlJLEdBQUcsRUFBRXpPLFFBQVEsQ0FBRTJHLEtBQUssRUFBRSxFQUFHLENBQUM7VUFDMUI1RyxLQUFLLEVBQUVtQixJQUFJLENBQUNuQixLQUFLO1VBQ2pCRyxHQUFHLEVBQUVnQixJQUFJLENBQUNoQixHQUFHO1VBQ2JrVCxNQUFNLEVBQUVsUyxJQUFJLENBQUNDLEVBQUUsS0FBSzRSLGlCQUFpQixJQUFJN1IsSUFBSSxDQUFDQyxFQUFFLEtBQUs1QztRQUN0RCxDQUFFLENBQUM7TUFDSixDQUFFLENBQUM7SUFDSixDQUFFLENBQUM7SUFFSHlVLFNBQVMsQ0FBQzdHLElBQUksQ0FBRSxVQUFXQyxDQUFDLEVBQUVDLENBQUMsRUFBRztNQUNqQyxJQUFLRCxDQUFDLENBQUNxQyxHQUFHLEtBQUtwQyxDQUFDLENBQUNvQyxHQUFHLEVBQUc7UUFDdEIsT0FBT3JDLENBQUMsQ0FBQ3FDLEdBQUcsR0FBR3BDLENBQUMsQ0FBQ29DLEdBQUc7TUFDckI7TUFDQSxJQUFLckMsQ0FBQyxDQUFDck0sS0FBSyxLQUFLc00sQ0FBQyxDQUFDdE0sS0FBSyxFQUFHO1FBQzFCLE9BQU9xTSxDQUFDLENBQUNyTSxLQUFLLEdBQUdzTSxDQUFDLENBQUN0TSxLQUFLO01BQ3pCO01BQ0EsT0FBT3FNLENBQUMsQ0FBQ2xNLEdBQUcsR0FBR21NLENBQUMsQ0FBQ25NLEdBQUc7SUFDckIsQ0FBRSxDQUFDO0lBRUgvQixDQUFDLENBQUM2QyxJQUFJLENBQUVnUyxTQUFTLEVBQUUsVUFBVy9SLEtBQUssRUFBRUMsSUFBSSxFQUFHO01BQzNDLElBQUltUyxJQUFJLEdBQUdKLE1BQU0sQ0FBRUEsTUFBTSxDQUFDeFMsTUFBTSxHQUFHLENBQUMsQ0FBRTtNQUV0QyxJQUFLNFMsSUFBSSxJQUFJQSxJQUFJLENBQUM1RSxHQUFHLEtBQUt2TixJQUFJLENBQUN1TixHQUFHLElBQUl2TixJQUFJLENBQUNuQixLQUFLLElBQUlzVCxJQUFJLENBQUNuVCxHQUFHLEVBQUc7UUFDOURtVCxJQUFJLENBQUNuVCxHQUFHLEdBQUdmLElBQUksQ0FBQ0ssR0FBRyxDQUFFNlQsSUFBSSxDQUFDblQsR0FBRyxFQUFFZ0IsSUFBSSxDQUFDaEIsR0FBSSxDQUFDO1FBQ3pDbVQsSUFBSSxDQUFDRCxNQUFNLEdBQUdDLElBQUksQ0FBQ0QsTUFBTSxJQUFJbFMsSUFBSSxDQUFDa1MsTUFBTTtRQUN4QztNQUNEO01BRUFILE1BQU0sQ0FBQ3pNLElBQUksQ0FBRTtRQUNaaUksR0FBRyxFQUFFdk4sSUFBSSxDQUFDdU4sR0FBRztRQUNiMU8sS0FBSyxFQUFFbUIsSUFBSSxDQUFDbkIsS0FBSztRQUNqQkcsR0FBRyxFQUFFZ0IsSUFBSSxDQUFDaEIsR0FBRztRQUNia1QsTUFBTSxFQUFFbFMsSUFBSSxDQUFDa1M7TUFDZCxDQUFFLENBQUM7SUFDSixDQUFFLENBQUM7SUFFSEgsTUFBTSxDQUFDOUcsSUFBSSxDQUFFLFVBQVdDLENBQUMsRUFBRUMsQ0FBQyxFQUFHO01BQzlCLElBQUtELENBQUMsQ0FBQ3JNLEtBQUssS0FBS3NNLENBQUMsQ0FBQ3RNLEtBQUssRUFBRztRQUMxQixPQUFPcU0sQ0FBQyxDQUFDck0sS0FBSyxHQUFHc00sQ0FBQyxDQUFDdE0sS0FBSztNQUN6QjtNQUNBLElBQUtxTSxDQUFDLENBQUNsTSxHQUFHLEtBQUttTSxDQUFDLENBQUNuTSxHQUFHLEVBQUc7UUFDdEIsT0FBT2tNLENBQUMsQ0FBQ2xNLEdBQUcsR0FBR21NLENBQUMsQ0FBQ25NLEdBQUc7TUFDckI7TUFDQSxPQUFPa00sQ0FBQyxDQUFDcUMsR0FBRyxHQUFHcEMsQ0FBQyxDQUFDb0MsR0FBRztJQUNyQixDQUFFLENBQUM7SUFFSHRRLENBQUMsQ0FBQzZDLElBQUksQ0FBRWlTLE1BQU0sRUFBRSxVQUFXaFMsS0FBSyxFQUFFQyxJQUFJLEVBQUc7TUFDeEMsSUFBSW1TLElBQUksR0FBR0gsTUFBTSxDQUFFQSxNQUFNLENBQUN6UyxNQUFNLEdBQUcsQ0FBQyxDQUFFO01BRXRDLElBQUs0UyxJQUFJLElBQUlBLElBQUksQ0FBQ3RULEtBQUssS0FBS21CLElBQUksQ0FBQ25CLEtBQUssSUFBSXNULElBQUksQ0FBQ25ULEdBQUcsS0FBS2dCLElBQUksQ0FBQ2hCLEdBQUcsSUFBSW1ULElBQUksQ0FBQ0MsT0FBTyxHQUFHLENBQUMsS0FBS3BTLElBQUksQ0FBQ3VOLEdBQUcsRUFBRztRQUNsRzRFLElBQUksQ0FBQy9NLElBQUksQ0FBQ0UsSUFBSSxDQUFFQyxNQUFNLENBQUV2RixJQUFJLENBQUN1TixHQUFJLENBQUUsQ0FBQztRQUNwQzRFLElBQUksQ0FBQ0MsT0FBTyxHQUFHcFMsSUFBSSxDQUFDdU4sR0FBRztRQUN2QjRFLElBQUksQ0FBQ0QsTUFBTSxHQUFHQyxJQUFJLENBQUNELE1BQU0sSUFBSWxTLElBQUksQ0FBQ2tTLE1BQU07UUFDeEM7TUFDRDtNQUVBRixNQUFNLENBQUMxTSxJQUFJLENBQUU7UUFDWnpHLEtBQUssRUFBRW1CLElBQUksQ0FBQ25CLEtBQUs7UUFDakJHLEdBQUcsRUFBRWdCLElBQUksQ0FBQ2hCLEdBQUc7UUFDYm9HLElBQUksRUFBRSxDQUFFRyxNQUFNLENBQUV2RixJQUFJLENBQUN1TixHQUFJLENBQUMsQ0FBRTtRQUM1QjZFLE9BQU8sRUFBRXBTLElBQUksQ0FBQ3VOLEdBQUc7UUFDakIyRSxNQUFNLEVBQUVsUyxJQUFJLENBQUNrUztNQUNkLENBQUUsQ0FBQztJQUNKLENBQUUsQ0FBQztJQUVIOVUsZUFBZSxHQUFHSCxDQUFDLENBQUNvVixHQUFHLENBQUVMLE1BQU0sRUFBRSxVQUFXaFMsSUFBSSxFQUFHO01BQ2xELElBQUlDLEVBQUUsR0FBRyxZQUFZLEdBQUcxQyxlQUFlLEVBQUU7TUFFekMsSUFBS3lDLElBQUksQ0FBQ2tTLE1BQU0sSUFBSSxDQUFFRCxXQUFXLEVBQUc7UUFDbkNBLFdBQVcsR0FBR2hTLEVBQUU7TUFDakI7TUFFQSxPQUFPO1FBQ05BLEVBQUUsRUFBRUEsRUFBRTtRQUNOcEIsS0FBSyxFQUFFbUIsSUFBSSxDQUFDbkIsS0FBSztRQUNqQkcsR0FBRyxFQUFFZ0IsSUFBSSxDQUFDaEIsR0FBRztRQUNib0csSUFBSSxFQUFFcEYsSUFBSSxDQUFDb0Y7TUFDWixDQUFDO0lBQ0YsQ0FBRSxDQUFDO0lBRUgvSCxpQkFBaUIsR0FBRzRVLFdBQVcsS0FBTTdVLGVBQWUsQ0FBQyxDQUFDLENBQUMsR0FBR0EsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDNkMsRUFBRSxHQUFHLEVBQUUsQ0FBRTtFQUN2RjtFQUVBLFNBQVNvTyxpQkFBaUJBLENBQUVuUCxLQUFLLEVBQUc7SUFDbkMsSUFBSU4sS0FBSyxHQUFHTSxLQUFLLENBQUNHLElBQUksQ0FBRSxlQUFnQixDQUFDO0lBQ3pDLElBQUlJLE1BQU0sR0FBR2QsZUFBZSxDQUFFQyxLQUFNLENBQUM7SUFFckNNLEtBQUssQ0FBQ0csSUFBSSxDQUFFLHFEQUFzRCxDQUFDLENBQUN3QyxNQUFNLENBQUMsQ0FBQztJQUU1RTVFLENBQUMsQ0FBQzZDLElBQUksQ0FBRTFDLGVBQWUsRUFBRSxVQUFXMkMsS0FBSyxFQUFFQyxJQUFJLEVBQUc7TUFDakQsSUFBSTJPLEtBQUssR0FBR2pQLHlCQUF5QixDQUFFTSxJQUFJLENBQUNuQixLQUFLLEVBQUVtQixJQUFJLENBQUNoQixHQUFHLEVBQUVTLE1BQU8sQ0FBQztNQUNyRSxJQUFJeUIsSUFBSSxHQUFHMUIsa0JBQWtCLENBQUVtUCxLQUFLLENBQUM5UCxLQUFLLEVBQUVZLE1BQU8sQ0FBQztNQUNwRCxJQUFJMEIsS0FBSyxHQUFHM0Isa0JBQWtCLENBQUVtUCxLQUFLLENBQUMzUCxHQUFHLEVBQUVTLE1BQU8sQ0FBQyxHQUFHeUIsSUFBSTtNQUUxRGxCLElBQUksQ0FBQ25CLEtBQUssR0FBRzhQLEtBQUssQ0FBQzlQLEtBQUs7TUFDeEJtQixJQUFJLENBQUNoQixHQUFHLEdBQUcyUCxLQUFLLENBQUMzUCxHQUFHO01BRXBCL0IsQ0FBQyxDQUFDNkMsSUFBSSxDQUFFRSxJQUFJLENBQUNvRixJQUFJLEVBQUUsVUFBV3NGLFFBQVEsRUFBRWpGLEtBQUssRUFBRztRQUMvQyxJQUFJekQsSUFBSSxHQUFHOUMsS0FBSyxDQUFDRyxJQUFJLENBQUUsaUNBQWlDLEdBQUdvRyxLQUFLLEdBQUcsSUFBSyxDQUFDO1FBQ3pFLElBQUlnTSxLQUFLLEdBQUd6UCxJQUFJLENBQUMzQyxJQUFJLENBQUUsZUFBZ0IsQ0FBQztRQUN4QyxJQUFJaVQsU0FBUyxHQUFHYixLQUFLLENBQUNwUyxJQUFJLENBQUUsNkJBQThCLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUM7UUFDbkUsSUFBSWlULFVBQVU7UUFFZCxJQUFLLENBQUVkLEtBQUssQ0FBQ2xTLE1BQU0sSUFBSSxDQUFFK1MsU0FBUyxDQUFDL1MsTUFBTSxFQUFHO1VBQzNDO1FBQ0Q7UUFFQWdULFVBQVUsR0FBR0QsU0FBUyxDQUFDdkssS0FBSyxDQUFFLEtBQU0sQ0FBQyxDQUNuQ00sV0FBVyxDQUFFLDRCQUE2QixDQUFDLENBQzNDbUssVUFBVSxDQUFFLFFBQVMsQ0FBQyxDQUN0QnhQLFFBQVEsQ0FBRSxZQUFhLENBQUMsQ0FDeEIwRCxXQUFXLENBQUUsV0FBVyxFQUFFMUcsSUFBSSxDQUFDQyxFQUFFLEtBQUs1QyxpQkFBa0IsQ0FBQyxDQUN6RDBCLElBQUksQ0FBRSwyQkFBMkIsRUFBRWlCLElBQUksQ0FBQ0MsRUFBRyxDQUFDLENBQzVDVSxHQUFHLENBQUU7VUFBRU8sSUFBSSxFQUFFQSxJQUFJLEdBQUcsR0FBRztVQUFFQyxLQUFLLEVBQUVBLEtBQUssR0FBRztRQUFJLENBQUUsQ0FBQztRQUVqRG9SLFVBQVUsQ0FBQ2xULElBQUksQ0FBRSwwQkFBMkIsQ0FBQyxDQUFDc0csSUFBSSxDQUFFN0gsZUFBZSxDQUFFNlEsS0FBSyxDQUFDOVAsS0FBTSxDQUFFLENBQUM7UUFDcEYwVCxVQUFVLENBQUNsVCxJQUFJLENBQUUsd0JBQXlCLENBQUMsQ0FBQ3NHLElBQUksQ0FBRTdILGVBQWUsQ0FBRTZRLEtBQUssQ0FBQzNQLEdBQUksQ0FBRSxDQUFDO1FBQ2hGeVMsS0FBSyxDQUFDcE8sTUFBTSxDQUFFa1AsVUFBVyxDQUFDO01BQzNCLENBQUUsQ0FBQztJQUNKLENBQUUsQ0FBQztJQUVIRSxjQUFjLENBQUV2VCxLQUFNLENBQUM7RUFDeEI7RUFFQSxTQUFTZ1IsZUFBZUEsQ0FBRWhSLEtBQUssRUFBRztJQUNqQzlCLGVBQWUsR0FBRyxFQUFFO0lBQ3BCQyxpQkFBaUIsR0FBRyxFQUFFO0lBQ3RCZ1IsaUJBQWlCLENBQUVuUCxLQUFNLENBQUM7RUFDM0I7RUFFQSxTQUFTdVQsY0FBY0EsQ0FBRXZULEtBQUssRUFBRztJQUNoQyxJQUFJTyxNQUFNLEdBQUdkLGVBQWUsQ0FBRU8sS0FBSyxDQUFDRyxJQUFJLENBQUUsZUFBZ0IsQ0FBRSxDQUFDO0lBQzdELElBQUlnQixTQUFTLEdBQUcsQ0FBQztJQUNqQixJQUFJb0ssS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNkLElBQUlpSSxVQUFVLEdBQUcsQ0FBQztJQUNsQixJQUFJQyxRQUFRLEdBQUcsR0FBRztJQUNsQixJQUFJQyxRQUFRLEdBQUcsR0FBRztJQUNsQixJQUFJQyxPQUFPLEdBQUcsRUFBRTtJQUNoQixJQUFJQyxXQUFXLEdBQUcsRUFBRTtJQUVwQjdWLENBQUMsQ0FBQzZDLElBQUksQ0FBRTFDLGVBQWUsRUFBRSxVQUFXMkMsS0FBSyxFQUFFQyxJQUFJLEVBQUc7TUFDakRLLFNBQVMsSUFBSXBDLElBQUksQ0FBQ0ssR0FBRyxDQUFFLENBQUMsRUFBRUwsSUFBSSxDQUFDUyxLQUFLLENBQUUsQ0FBRXNCLElBQUksQ0FBQ2hCLEdBQUcsR0FBR2dCLElBQUksQ0FBQ25CLEtBQUssSUFBS1ksTUFBTSxDQUFDaEIsSUFBSyxDQUFDLEdBQUd1QixJQUFJLENBQUNvRixJQUFJLENBQUM3RixNQUFPLENBQUM7TUFFcEd0QyxDQUFDLENBQUM2QyxJQUFJLENBQUVFLElBQUksQ0FBQ29GLElBQUksRUFBRSxVQUFXc0YsUUFBUSxFQUFFakYsS0FBSyxFQUFHO1FBQy9DLElBQUlnQixLQUFLLEdBQUdqQixTQUFTLENBQUV0RyxLQUFLLEVBQUV1RyxLQUFNLENBQUM7UUFFckMsSUFBSyxDQUFFZ0IsS0FBSyxFQUFHO1VBQ2Q7UUFDRDtRQUVBZ0UsS0FBSyxDQUFFaEUsS0FBSyxDQUFFLEdBQUcsSUFBSTtRQUNyQm9NLE9BQU8sQ0FBQ3ZOLElBQUksQ0FBRTtVQUNiaUksR0FBRyxFQUFFek8sUUFBUSxDQUFFMkcsS0FBSyxFQUFFLEVBQUcsQ0FBQztVQUMxQjVHLEtBQUssRUFBRW1CLElBQUksQ0FBQ25CLEtBQUs7VUFDakJHLEdBQUcsRUFBRWdCLElBQUksQ0FBQ2hCLEdBQUc7VUFDYnlILEtBQUssRUFBRUE7UUFDUixDQUFFLENBQUM7TUFDSixDQUFFLENBQUM7SUFDSixDQUFFLENBQUM7SUFFSG9NLE9BQU8sQ0FBQzVILElBQUksQ0FBRSxVQUFXQyxDQUFDLEVBQUVDLENBQUMsRUFBRztNQUMvQixJQUFLRCxDQUFDLENBQUNxQyxHQUFHLEtBQUtwQyxDQUFDLENBQUNvQyxHQUFHLEVBQUc7UUFDdEIsT0FBT3JDLENBQUMsQ0FBQ3FDLEdBQUcsR0FBR3BDLENBQUMsQ0FBQ29DLEdBQUc7TUFDckI7TUFDQSxJQUFLckMsQ0FBQyxDQUFDck0sS0FBSyxLQUFLc00sQ0FBQyxDQUFDdE0sS0FBSyxFQUFHO1FBQzFCLE9BQU9xTSxDQUFDLENBQUNyTSxLQUFLLEdBQUdzTSxDQUFDLENBQUN0TSxLQUFLO01BQ3pCO01BQ0EsT0FBT3FNLENBQUMsQ0FBQ2xNLEdBQUcsR0FBR21NLENBQUMsQ0FBQ25NLEdBQUc7SUFDckIsQ0FBRSxDQUFDO0lBRUgvQixDQUFDLENBQUM2QyxJQUFJLENBQUUrUyxPQUFPLEVBQUUsVUFBVzlTLEtBQUssRUFBRUMsSUFBSSxFQUFHO01BQ3pDLElBQUkrUyxTQUFTLEdBQUdqVixlQUFlLENBQUVrQyxJQUFJLENBQUNuQixLQUFNLENBQUMsR0FBRyxLQUFLLEdBQUdmLGVBQWUsQ0FBRWtDLElBQUksQ0FBQ2hCLEdBQUksQ0FBQztNQUVuRjhULFdBQVcsSUFBSSw2Q0FBNkMsR0FDekQsOENBQThDLEdBQUdsTixXQUFXLENBQUU1RixJQUFJLENBQUN5RyxLQUFNLENBQUMsR0FBRyxTQUFTLEdBQ3RGLDhDQUE4QyxHQUFHYixXQUFXLENBQUVtTixTQUFVLENBQUMsR0FBRyxTQUFTLEdBQ3JGLFFBQVE7SUFDWixDQUFFLENBQUM7SUFFSEwsVUFBVSxHQUFHL0gsTUFBTSxDQUFDQyxJQUFJLENBQUVILEtBQU0sQ0FBQyxDQUFDbEwsTUFBTTtJQUV4QyxJQUFLbkMsZUFBZSxDQUFDbUMsTUFBTSxFQUFHO01BQzdCb1QsUUFBUSxHQUFHRCxVQUFVLElBQUssQ0FBQyxLQUFLQSxVQUFVLEdBQUcsT0FBTyxHQUFHLFFBQVEsQ0FBRTtNQUNqRUUsUUFBUSxHQUFHeFYsZUFBZSxDQUFDbUMsTUFBTSxJQUFLLENBQUMsS0FBS25DLGVBQWUsQ0FBQ21DLE1BQU0sR0FBRyxXQUFXLEdBQUcsWUFBWSxDQUFFO0lBQ2xHO0lBRUEsSUFBSyxDQUFFdVQsV0FBVyxFQUFHO01BQ3BCQSxXQUFXLEdBQUcsNEVBQTRFO0lBQzNGO0lBRUE3VixDQUFDLENBQUUwTCxRQUFTLENBQUMsQ0FBQ3RKLElBQUksQ0FBRSwrQkFBZ0MsQ0FBQyxDQUFDc0csSUFBSSxDQUFFdEYsU0FBVSxDQUFDO0lBQ3ZFcEQsQ0FBQyxDQUFFMEwsUUFBUyxDQUFDLENBQUN0SixJQUFJLENBQUUsK0JBQWdDLENBQUMsQ0FBQ3NHLElBQUksQ0FBRWdOLFFBQVMsQ0FBQztJQUN0RTFWLENBQUMsQ0FBRTBMLFFBQVMsQ0FBQyxDQUFDdEosSUFBSSxDQUFFLDhCQUErQixDQUFDLENBQUNzRyxJQUFJLENBQUVpTixRQUFTLENBQUM7SUFDckUzVixDQUFDLENBQUUwTCxRQUFTLENBQUMsQ0FBQ3RKLElBQUksQ0FBRSx3Q0FBeUMsQ0FBQyxDQUFDZSxJQUFJLENBQUUwUyxXQUFZLENBQUM7RUFDbkY7RUFFQSxTQUFTRSxhQUFhQSxDQUFFOVQsS0FBSyxFQUFFNkssS0FBSyxFQUFHO0lBQ3RDLElBQUlnSCxRQUFRLEdBQUdoSCxLQUFLLENBQUNpSCxhQUFhLElBQUlqSCxLQUFLO0lBQzNDLElBQUlrSCxLQUFLLEdBQUdGLFFBQVEsQ0FBQ0csT0FBTyxJQUFJSCxRQUFRLENBQUNHLE9BQU8sQ0FBQzNSLE1BQU0sR0FBR3dSLFFBQVEsQ0FBQ0csT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHSCxRQUFRO0lBQ3hGLElBQUlrQyxJQUFJLEdBQUcvVCxLQUFLLENBQUNHLElBQUksQ0FBRSxtQkFBb0IsQ0FBQztJQUM1QyxJQUFJNlMsTUFBTSxHQUFHdlMsbUJBQW1CLENBQUV0QyxpQkFBa0IsQ0FBQztJQUVyRCxJQUFLLENBQUU2VSxNQUFNLEVBQUc7TUFDZjtJQUNEO0lBRUEsSUFBSyxDQUFFZSxJQUFJLENBQUMxVCxNQUFNLEVBQUc7TUFDcEIwVCxJQUFJLEdBQUdoVyxDQUFDLENBQUUsc0NBQXVDLENBQUMsQ0FBQzZLLFFBQVEsQ0FBRTVJLEtBQU0sQ0FBQztJQUNyRTtJQUVBK1QsSUFBSSxDQUNGdE4sSUFBSSxDQUFFN0gsZUFBZSxDQUFFb1UsTUFBTSxDQUFDclQsS0FBTSxDQUFDLEdBQUcsS0FBSyxHQUFHZixlQUFlLENBQUVvVSxNQUFNLENBQUNsVCxHQUFJLENBQUUsQ0FBQyxDQUMvRTJCLEdBQUcsQ0FBRTtNQUNMTyxJQUFJLEVBQUUrUCxLQUFLLENBQUNpQyxLQUFLLEdBQUcsRUFBRSxHQUFHLElBQUk7TUFDN0I1SyxHQUFHLEVBQUUySSxLQUFLLENBQUNrQyxLQUFLLEdBQUcsRUFBRSxHQUFHO0lBQ3pCLENBQUUsQ0FBQyxDQUNGblEsUUFBUSxDQUFFLFlBQWEsQ0FBQztFQUMzQjtFQUVBLFNBQVNvUSxhQUFhQSxDQUFFbFUsS0FBSyxFQUFHO0lBQy9CQSxLQUFLLENBQUNHLElBQUksQ0FBRSxtQkFBb0IsQ0FBQyxDQUFDZ0osV0FBVyxDQUFFLFlBQWEsQ0FBQztFQUM5RDtFQUVBLFNBQVNnTCx1QkFBdUJBLENBQUVuVSxLQUFLLEVBQUVULElBQUksRUFBRztJQUMvQ1EsV0FBVyxDQUFFQyxLQUFLLEVBQUUsV0FBWSxDQUFDLENBQUNnRixHQUFHLENBQUVxQixNQUFNLENBQUU5RyxJQUFLLENBQUUsQ0FBQztJQUN2RHhCLENBQUMsQ0FBRSx5QkFBMEIsQ0FBQyxDQUFDaUgsR0FBRyxDQUFFcUIsTUFBTSxDQUFFOUcsSUFBSyxDQUFFLENBQUM7RUFDckQ7RUFFQSxTQUFTNlUsa0JBQWtCQSxDQUFFcFUsS0FBSyxFQUFFVCxJQUFJLEVBQUc7SUFDMUMsSUFBSXNCLEtBQUssR0FBRzdDLFNBQVMsQ0FBQ3FXLE9BQU8sQ0FBRTlVLElBQUssQ0FBQztJQUNyQyxJQUFLLENBQUMsQ0FBQyxLQUFLc0IsS0FBSyxFQUFHO01BQ25CQSxLQUFLLEdBQUcsQ0FBQztJQUNWO0lBQ0FkLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLE1BQU8sQ0FBQyxDQUFDZ0YsR0FBRyxDQUFFcUIsTUFBTSxDQUFFeEYsS0FBTSxDQUFFLENBQUM7SUFDbkQ5QyxDQUFDLENBQUUsb0JBQXFCLENBQUMsQ0FBQ2lILEdBQUcsQ0FBRXFCLE1BQU0sQ0FBRXhGLEtBQU0sQ0FBRSxDQUFDO0VBQ2pEO0VBRUEsU0FBU3lULFFBQVFBLENBQUV0VSxLQUFLLEVBQUVULElBQUksRUFBRztJQUNoQyxJQUFJRyxLQUFLLEdBQUdNLEtBQUssQ0FBQ0csSUFBSSxDQUFFLGVBQWdCLENBQUM7SUFDekNULEtBQUssQ0FBQ0csSUFBSSxDQUFFLG1CQUFtQixFQUFFTixJQUFLLENBQUM7SUFDdkM0VSx1QkFBdUIsQ0FBRW5VLEtBQUssRUFBRVQsSUFBSyxDQUFDO0lBQ3RDNlUsa0JBQWtCLENBQUVwVSxLQUFLLEVBQUVULElBQUssQ0FBQztJQUNqQ3lCLFdBQVcsQ0FBRXRCLEtBQU0sQ0FBQztJQUNwQmtDLGFBQWEsQ0FBRWxDLEtBQU0sQ0FBQztJQUN0QnlQLGlCQUFpQixDQUFFblAsS0FBTSxDQUFDO0VBQzNCO0VBRUEsU0FBU3VVLDBCQUEwQkEsQ0FBRXZVLEtBQUssRUFBRUwsS0FBSyxFQUFFRyxHQUFHLEVBQUc7SUFDeERDLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLFdBQVksQ0FBQyxDQUFDZ0YsR0FBRyxDQUFFcUIsTUFBTSxDQUFFMUcsS0FBTSxDQUFFLENBQUM7SUFDeERJLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLFNBQVUsQ0FBQyxDQUFDZ0YsR0FBRyxDQUFFcUIsTUFBTSxDQUFFdkcsR0FBSSxDQUFFLENBQUM7SUFDcERDLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLGtCQUFtQixDQUFDLENBQUNnRixHQUFHLENBQUVxQixNQUFNLENBQUUxRyxLQUFNLENBQUUsQ0FBQztJQUMvREksV0FBVyxDQUFFQyxLQUFLLEVBQUUsZ0JBQWlCLENBQUMsQ0FBQ2dGLEdBQUcsQ0FBRXFCLE1BQU0sQ0FBRXZHLEdBQUksQ0FBRSxDQUFDO0lBQzNEL0IsQ0FBQyxDQUFFLHFCQUFzQixDQUFDLENBQUNpSCxHQUFHLENBQUVxQixNQUFNLENBQUUxRyxLQUFNLENBQUUsQ0FBQztJQUNqRDVCLENBQUMsQ0FBRSxtQkFBb0IsQ0FBQyxDQUFDaUgsR0FBRyxDQUFFcUIsTUFBTSxDQUFFdkcsR0FBSSxDQUFFLENBQUM7SUFDN0MvQixDQUFDLENBQUUsNEJBQTZCLENBQUMsQ0FBQ2lILEdBQUcsQ0FBRXFCLE1BQU0sQ0FBRTFHLEtBQU0sQ0FBRSxDQUFDO0lBQ3hENUIsQ0FBQyxDQUFFLDBCQUEyQixDQUFDLENBQUNpSCxHQUFHLENBQUVxQixNQUFNLENBQUV2RyxHQUFJLENBQUUsQ0FBQztFQUNyRDtFQUVBLFNBQVMwVSxzQkFBc0JBLENBQUV4VSxLQUFLLEVBQUVMLEtBQUssRUFBRUcsR0FBRyxFQUFHO0lBQ3BELElBQUlKLEtBQUssR0FBR00sS0FBSyxDQUFDRyxJQUFJLENBQUUsZUFBZ0IsQ0FBQztJQUV6Q1IsS0FBSyxHQUFHQyxRQUFRLENBQUVELEtBQUssRUFBRSxFQUFHLENBQUM7SUFDN0JHLEdBQUcsR0FBR0YsUUFBUSxDQUFFRSxHQUFHLEVBQUUsRUFBRyxDQUFDO0lBRXpCLElBQUtBLEdBQUcsSUFBSUgsS0FBSyxFQUFHO01BQ25CLElBQUs1QixDQUFDLENBQUUwTCxRQUFRLENBQUNnTCxhQUFjLENBQUMsQ0FBQ2pELEVBQUUsQ0FBRSwrS0FBZ0wsQ0FBQyxFQUFHO1FBQ3hON1IsS0FBSyxHQUFHWixJQUFJLENBQUNLLEdBQUcsQ0FBRSxDQUFDLEVBQUVVLEdBQUcsR0FBRyxFQUFHLENBQUM7TUFDaEMsQ0FBQyxNQUFNO1FBQ05BLEdBQUcsR0FBR2YsSUFBSSxDQUFDSSxHQUFHLENBQUUsSUFBSSxFQUFFUSxLQUFLLEdBQUcsRUFBRyxDQUFDO01BQ25DO0lBQ0Q7SUFFQUQsS0FBSyxDQUFDRyxJQUFJLENBQUUsb0JBQW9CLEVBQUVGLEtBQU0sQ0FBQztJQUN6Q0QsS0FBSyxDQUFDRyxJQUFJLENBQUUsa0JBQWtCLEVBQUVDLEdBQUksQ0FBQztJQUNyQ3lVLDBCQUEwQixDQUFFdlUsS0FBSyxFQUFFTCxLQUFLLEVBQUVHLEdBQUksQ0FBQztJQUUvQ2tCLFdBQVcsQ0FBRXRCLEtBQU0sQ0FBQztJQUNwQmtDLGFBQWEsQ0FBRWxDLEtBQU0sQ0FBQztJQUN0QnlQLGlCQUFpQixDQUFFblAsS0FBTSxDQUFDO0VBQzNCO0VBRUEsU0FBUzBVLFFBQVFBLENBQUUvSCxJQUFJLEVBQUc7SUFDekIxTyxXQUFXLEdBQUcwTyxJQUFJO0VBQ25CO0VBRUEsU0FBU2dJLGlDQUFpQ0EsQ0FBRTlTLElBQUksRUFBRztJQUNsRCxJQUFLLENBQUVBLElBQUksQ0FBQ3hCLE1BQU0sRUFBRztNQUNwQixPQUFPLElBQUk7SUFDWjtJQUVBLE9BQ0N3QixJQUFJLENBQUNtRyxRQUFRLENBQUUscUJBQXNCLENBQUMsSUFDbkMsR0FBRyxLQUFLbkcsSUFBSSxDQUFDaEMsSUFBSSxDQUFFLHVCQUF3QixDQUFDO0VBRWpEO0VBRUEsU0FBUytVLFdBQVdBLENBQUU1VSxLQUFLLEVBQUUyTSxJQUFJLEVBQUc7SUFDbkMsSUFBSXJLLFFBQVEsR0FBR0MsTUFBTSxDQUFDQyxnQ0FBZ0MsSUFBSSxDQUFDLENBQUM7SUFDNUQsSUFBSUMsTUFBTSxHQUFHSCxRQUFRLENBQUNJLElBQUksSUFBSSxDQUFDLENBQUM7SUFDaEMsSUFBSWtKLE9BQU87SUFFWCxJQUFLbk4saUJBQWlCLElBQUlBLGlCQUFpQixDQUFDZ0csVUFBVSxLQUFLLENBQUMsRUFBRztNQUM5RDtJQUNEO0lBRUFpUSxRQUFRLENBQUUvSCxJQUFLLENBQUM7SUFDaEIsSUFBSyxDQUFFek8sZUFBZSxDQUFDbUMsTUFBTSxFQUFHO01BQy9CLElBQUtrQyxNQUFNLENBQUNtRCx1QkFBdUIsRUFBRztRQUNyQ0EsdUJBQXVCLENBQUVqRCxNQUFNLENBQUNvUyxrQkFBa0IsSUFBSSx1Q0FBdUMsRUFBRSxTQUFTLEVBQUUsSUFBSyxDQUFDO01BQ2pIO01BQ0E7SUFDRDtJQUVBakosT0FBTyxHQUFHRCxxQkFBcUIsQ0FBRTNMLEtBQU0sQ0FBQztJQUN4QyxJQUFLLENBQUVzQyxRQUFRLENBQUNrQyxRQUFRLElBQUksQ0FBRWxDLFFBQVEsQ0FBQ3dTLEtBQUssSUFBSSxDQUFFbEosT0FBTyxDQUFDdkwsTUFBTSxFQUFHO01BQ2xFO0lBQ0Q7SUFFQXNFLG9CQUFvQixDQUFFM0UsS0FBSyxFQUFFLElBQUksRUFBRXlDLE1BQU0sQ0FBQ3NTLE1BQU0sSUFBSSxRQUFTLENBQUM7SUFDOURwTix1QkFBdUIsQ0FBRTNILEtBQUssRUFBRSxJQUFLLENBQUM7SUFFdEN2QixpQkFBaUIsR0FBR1YsQ0FBQyxDQUFDOEcsSUFBSSxDQUFFdkMsUUFBUSxDQUFDa0MsUUFBUSxFQUFFO01BQzlDTSxNQUFNLEVBQUUsc0NBQXNDO01BQzlDZ1EsS0FBSyxFQUFFeFMsUUFBUSxDQUFDd1MsS0FBSztNQUNyQi9QLFdBQVcsRUFBRWhGLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLFVBQVcsQ0FBQyxDQUFDZ0YsR0FBRyxDQUFDLENBQUM7TUFDbkQySCxJQUFJLEVBQUVBLElBQUk7TUFDVmlHLFNBQVMsRUFBRW9DLElBQUksQ0FBQ0MsU0FBUyxDQUFFckosT0FBUTtJQUNwQyxDQUFFLENBQUMsQ0FBQ3pHLElBQUksQ0FBRSxVQUFXQyxRQUFRLEVBQUc7TUFDL0IsSUFBS0EsUUFBUSxJQUFJQSxRQUFRLENBQUNDLE9BQU8sRUFBRztRQUNuQyxJQUFLOUMsTUFBTSxDQUFDbUQsdUJBQXVCLEVBQUc7VUFDckNBLHVCQUF1QixDQUFFLE9BQU8sS0FBS2lILElBQUksR0FBS2xLLE1BQU0sQ0FBQ3lTLGFBQWEsSUFBSSx5Q0FBeUMsR0FBT3pTLE1BQU0sQ0FBQzBTLGVBQWUsSUFBSSwyQ0FBNkMsRUFBRSxTQUFTLEVBQUUsSUFBSyxDQUFDO1FBQ2pOO1FBQ0FuRSxlQUFlLENBQUVoUixLQUFNLENBQUM7UUFDeEJxRSxzQkFBc0IsQ0FBRXJFLEtBQU0sQ0FBQztNQUNoQyxDQUFDLE1BQU0sSUFBS3VDLE1BQU0sQ0FBQ21ELHVCQUF1QixFQUFHO1FBQzVDQSx1QkFBdUIsQ0FBRWpELE1BQU0sQ0FBQ2tELFVBQVUsSUFBSSx3Q0FBd0MsRUFBRSxPQUFPLEVBQUUsSUFBSyxDQUFDO01BQ3hHO0lBQ0QsQ0FBRSxDQUFDLENBQUNKLElBQUksQ0FBRSxZQUFZO01BQ3JCLElBQUtoRCxNQUFNLENBQUNtRCx1QkFBdUIsRUFBRztRQUNyQ0EsdUJBQXVCLENBQUVqRCxNQUFNLENBQUNrRCxVQUFVLElBQUksd0NBQXdDLEVBQUUsT0FBTyxFQUFFLElBQUssQ0FBQztNQUN4RztJQUNELENBQUUsQ0FBQyxDQUFDQyxNQUFNLENBQUUsWUFBWTtNQUN2Qm5ILGlCQUFpQixHQUFHLElBQUk7TUFDeEJrSix1QkFBdUIsQ0FBRTNILEtBQUssRUFBRSxLQUFNLENBQUM7TUFFdkMsSUFBSyxDQUFFekIsaUJBQWlCLElBQUlBLGlCQUFpQixDQUFDa0csVUFBVSxLQUFLLENBQUMsRUFBRztRQUNoRUUsb0JBQW9CLENBQUUzRSxLQUFLLEVBQUUsS0FBSyxFQUFFeUMsTUFBTSxDQUFDbUMsT0FBTyxJQUFJLFNBQVUsQ0FBQztNQUNsRTtJQUNELENBQUUsQ0FBQztFQUNKO0VBRUEsU0FBU3dRLHNCQUFzQkEsQ0FBRXBWLEtBQUssRUFBRztJQUN4QyxJQUFJK1AsS0FBSyxHQUFHaFEsV0FBVyxDQUFFQyxLQUFLLEVBQUUsWUFBYSxDQUFDO0lBQzlDLElBQUlxVixTQUFTLEdBQUd0RixLQUFLLENBQUNwTyxPQUFPLENBQUUscUJBQXNCLENBQUM7SUFDdEQsSUFBSTJULFFBQVEsR0FBRyxDQUFDO0lBRWhCLElBQUssQ0FBRXZYLENBQUMsQ0FBQ3dYLEVBQUUsQ0FBQ3RILFFBQVEsRUFBRztNQUN0QixJQUFLMUwsTUFBTSxDQUFDaVQsT0FBTyxFQUFHO1FBQ3JCQSxPQUFPLENBQUNDLEdBQUcsQ0FBRSw0REFBNkQsQ0FBQztNQUM1RTtNQUNBO0lBQ0Q7SUFFQSxJQUFLbFQsTUFBTSxDQUFDbVQsS0FBSyxJQUFJLFVBQVUsS0FBSyxPQUFPblQsTUFBTSxDQUFDbVQsS0FBSyxDQUFDQyxlQUFlLEVBQUc7TUFDekVMLFFBQVEsR0FBRzFWLFFBQVEsQ0FBRTJDLE1BQU0sQ0FBQ21ULEtBQUssQ0FBQ0MsZUFBZSxDQUFFLHNCQUF1QixDQUFDLEVBQUUsRUFBRyxDQUFDLElBQUksQ0FBQztJQUN2RjtJQUVBLElBQUs1RixLQUFLLENBQUMvSCxRQUFRLENBQUVqSyxDQUFDLENBQUNrUSxRQUFRLENBQUMySCxlQUFnQixDQUFDLEVBQUc7TUFDbkQsSUFBSTtRQUNIN0YsS0FBSyxDQUFDOUIsUUFBUSxDQUFFLFNBQVUsQ0FBQztNQUM1QixDQUFDLENBQUMsT0FBUW9ELEtBQUssRUFBRyxDQUFDO0lBQ3BCO0lBRUF0QixLQUFLLENBQUM5QixRQUFRLENBQUU7TUFDZjRILGFBQWEsRUFBRSxTQUFBQSxDQUFBLEVBQVk7UUFDMUIsT0FBTyxDQUFFLElBQUksRUFBRSxnQkFBZ0IsQ0FBRTtNQUNsQyxDQUFDO01BQ0RDLFFBQVEsRUFBRSxTQUFBQSxDQUFXekcsV0FBVyxFQUFFQyxVQUFVLEVBQUc7UUFDOUNhLDBCQUEwQixDQUFFblEsS0FBSyxFQUFFb1Asd0JBQXdCLENBQUVDLFdBQVcsRUFBRUMsVUFBVyxDQUFFLENBQUM7TUFDekYsQ0FBQztNQUNEeUcsT0FBTyxFQUFFLFNBQUFBLENBQUEsRUFBWTtRQUNwQnhULE1BQU0sQ0FBQ21ILFVBQVUsQ0FBRSxZQUFZO1VBQzlCZ0gsMEJBQTBCLENBQUUxUSxLQUFNLENBQUM7UUFDcEMsQ0FBQyxFQUFFLENBQUUsQ0FBQztNQUNQLENBQUM7TUFDRGdXLE1BQU0sRUFBRSxNQUFNO01BQ2RDLFFBQVEsRUFBRSxNQUFNO01BQ2hCQyxRQUFRLEVBQUUsRUFBRTtNQUNaQyxXQUFXLEVBQUUsSUFBSTtNQUNqQkMsV0FBVyxFQUFFLENBQUM7TUFDZEMsY0FBYyxFQUFFLENBQUM7TUFDakJDLFVBQVUsRUFBRSxDQUFDO01BQ2JDLFFBQVEsRUFBRSxVQUFVO01BQ3BCQyxRQUFRLEVBQUUsVUFBVTtNQUNwQkMsVUFBVSxFQUFFLFNBQVM7TUFDckJDLFdBQVcsRUFBRSxLQUFLO01BQ2xCQyxVQUFVLEVBQUUsS0FBSztNQUNqQkMsT0FBTyxFQUFFLElBQUk7TUFDYkMsT0FBTyxFQUFFLElBQUk7TUFDYkMsVUFBVSxFQUFFLEtBQUs7TUFDakJDLGNBQWMsRUFBRSxJQUFJO01BQ3BCQyxVQUFVLEVBQUUsSUFBSTtNQUNoQjFCLFFBQVEsRUFBRUEsUUFBUTtNQUNsQjJCLFdBQVcsRUFBRSxLQUFLO01BQ2xCQyxnQkFBZ0IsRUFBRSxJQUFJO01BQ3RCQyxjQUFjLEVBQUUsS0FBSztNQUNyQkMsU0FBUyxFQUFFO0lBQ1osQ0FBRSxDQUFDO0lBRUgsU0FBU0Msc0JBQXNCQSxDQUFBLEVBQUc7TUFDakMsSUFBSUMsS0FBSyxHQUFHdkgsS0FBSyxDQUFDakosR0FBRyxDQUFFLENBQUUsQ0FBQztNQUUxQixJQUFLLENBQUV3USxLQUFLLElBQUksQ0FBRXZaLENBQUMsQ0FBQ2tRLFFBQVEsSUFBSSxDQUFFbFEsQ0FBQyxDQUFDa1EsUUFBUSxDQUFDc0osYUFBYSxJQUFJLENBQUV4SCxLQUFLLENBQUMvSCxRQUFRLENBQUVqSyxDQUFDLENBQUNrUSxRQUFRLENBQUMySCxlQUFnQixDQUFDLEVBQUc7UUFDOUc7TUFDRDtNQUVBLElBQU83WCxDQUFDLENBQUNrUSxRQUFRLENBQUN1SixVQUFVLEtBQUtGLEtBQUssSUFBTSxDQUFFdlosQ0FBQyxDQUFDa1EsUUFBUSxDQUFDd0osa0JBQWtCLEVBQUc7UUFDN0UxWixDQUFDLENBQUNrUSxRQUFRLENBQUN1SixVQUFVLEdBQUcsSUFBSTtNQUM3QjtNQUVBLElBQU96WixDQUFDLENBQUNrUSxRQUFRLENBQUN1SixVQUFVLEtBQUtGLEtBQUssSUFBTXZaLENBQUMsQ0FBQ2tRLFFBQVEsQ0FBQ3dKLGtCQUFrQixFQUFHO1FBQzNFO01BQ0Q7TUFFQTFaLENBQUMsQ0FBQ2tRLFFBQVEsQ0FBQ3NKLGFBQWEsQ0FBRUQsS0FBTSxDQUFDO01BQ2pDdlosQ0FBQyxDQUFFLGdDQUFpQyxDQUFDLENBQUMwRCxHQUFHLENBQUUsU0FBUyxFQUFFLE9BQVEsQ0FBQztJQUNoRTtJQUVBc08sS0FBSyxDQUFDdEksR0FBRyxDQUFFLDZGQUE4RixDQUFDLENBQUNDLEVBQUUsQ0FBRSw2RkFBNkYsRUFBRSxVQUFXbUQsS0FBSyxFQUFHO01BQ2hPLElBQUssU0FBUyxLQUFLQSxLQUFLLENBQUMzSCxJQUFJLElBQU0sRUFBRSxLQUFLMkgsS0FBSyxDQUFDNk0sS0FBTyxJQUFNLEVBQUUsS0FBSzdNLEtBQUssQ0FBQzZNLEtBQU8sRUFBRztRQUNuRjtNQUNEO01BRUEsSUFBSyxTQUFTLEtBQUs3TSxLQUFLLENBQUMzSCxJQUFJLEVBQUc7UUFDL0IySCxLQUFLLENBQUNLLGNBQWMsQ0FBQyxDQUFDO01BQ3ZCO01BRUFtTSxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3pCLENBQUUsQ0FBQztJQUVIaEMsU0FBUyxDQUFDNU4sR0FBRyxDQUFFLGlFQUFrRSxDQUFDLENBQ2hGQyxFQUFFLENBQUUsbUNBQW1DLEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUM1REEsS0FBSyxDQUFDTSxlQUFlLENBQUMsQ0FBQztJQUN4QixDQUFFLENBQUMsQ0FDRnpELEVBQUUsQ0FBRSwrQkFBK0IsRUFBRSxVQUFXbUQsS0FBSyxFQUFHO01BQ3hELElBQUtBLEtBQUssQ0FBQ0csTUFBTSxLQUFLK0UsS0FBSyxDQUFDakosR0FBRyxDQUFFLENBQUUsQ0FBQyxFQUFHO1FBQ3RDK0QsS0FBSyxDQUFDSyxjQUFjLENBQUMsQ0FBQztNQUN2QjtNQUVBNkUsS0FBSyxDQUFDdkYsT0FBTyxDQUFFLE9BQVEsQ0FBQztNQUN4QjZNLHNCQUFzQixDQUFDLENBQUM7SUFDekIsQ0FBRSxDQUFDO0lBRUp0SCxLQUFLLENBQUNySSxFQUFFLENBQUUsY0FBYyxFQUFFLFlBQVk7TUFDckNnSiwwQkFBMEIsQ0FBRTFRLEtBQU0sQ0FBQztJQUNwQyxDQUFFLENBQUM7RUFDSjtFQUVBLFNBQVMyWCxrQkFBa0JBLENBQUEsRUFBRztJQUM3QjVaLENBQUMsQ0FBRTBMLFFBQVMsQ0FBQyxDQUFDL0IsRUFBRSxDQUFFLE9BQU8sRUFBRSxxQ0FBcUMsRUFBRSxVQUFXbUQsS0FBSyxFQUFHO01BQ3BGLElBQUkrTSxJQUFJLEdBQUc3WixDQUFDLENBQUUsSUFBSyxDQUFDO01BQ3BCLElBQUk4WixPQUFPLEdBQUdELElBQUksQ0FBQy9YLElBQUksQ0FBRSxlQUFnQixDQUFDO01BQzFDLElBQUlpWSxNQUFNLEdBQUcvWixDQUFDLENBQUUsR0FBRyxHQUFHOFosT0FBUSxDQUFDO01BQy9CLElBQUlFLFFBQVEsR0FBR0gsSUFBSSxDQUFDalcsT0FBTyxDQUFFLGtCQUFtQixDQUFDO01BRWpELElBQUssQ0FBRW1XLE1BQU0sQ0FBQ3pYLE1BQU0sRUFBRztRQUN0QjtNQUNEO01BRUF3SyxLQUFLLENBQUNLLGNBQWMsQ0FBQyxDQUFDO01BQ3RCNk0sUUFBUSxDQUFDNVgsSUFBSSxDQUFFLGNBQWUsQ0FBQyxDQUFDTixJQUFJLENBQUUsZUFBZSxFQUFFLE9BQVEsQ0FBQztNQUNoRStYLElBQUksQ0FBQy9YLElBQUksQ0FBRSxlQUFlLEVBQUUsTUFBTyxDQUFDO01BQ3BDOUIsQ0FBQyxDQUFFLG1EQUFvRCxDQUFDLENBQUM4QixJQUFJLENBQUUsUUFBUSxFQUFFLFFBQVMsQ0FBQyxDQUFDQSxJQUFJLENBQUUsYUFBYSxFQUFFLE1BQU8sQ0FBQztNQUNqSGlZLE1BQU0sQ0FBQ3hFLFVBQVUsQ0FBRSxRQUFTLENBQUMsQ0FBQ3pULElBQUksQ0FBRSxhQUFhLEVBQUUsT0FBUSxDQUFDO0lBQzdELENBQUUsQ0FBQztFQUNKO0VBRUEsU0FBUzhSLG9CQUFvQkEsQ0FBRXJGLE9BQU8sRUFBRTBMLEtBQUssRUFBRztJQUMvQyxJQUFJekcsUUFBUSxHQUFHakYsT0FBTyxHQUFHdk8sQ0FBQyxDQUFFdU8sT0FBUSxDQUFDLEdBQUd2TyxDQUFDLENBQUUwTCxRQUFTLENBQUM7SUFDckQsSUFBSXdPLE1BQU0sR0FBRzFHLFFBQVEsQ0FBQ0MsRUFBRSxDQUFFLGVBQWdCLENBQUMsR0FBR0QsUUFBUSxHQUFHQSxRQUFRLENBQUNwUixJQUFJLENBQUUsZUFBZ0IsQ0FBQztJQUV6RixJQUFLLENBQUU4WCxNQUFNLENBQUM1WCxNQUFNLEVBQUc7TUFDdEI7SUFDRDtJQUVBLElBQUssQ0FBRTJYLEtBQUssRUFBRztNQUNkQyxNQUFNLEdBQUdBLE1BQU0sQ0FBQ0MsTUFBTSxDQUFFLFlBQVk7UUFDbkMsT0FBTyxHQUFHLEtBQUtuYSxDQUFDLENBQUUsSUFBSyxDQUFDLENBQUM4QixJQUFJLENBQUUsd0JBQXlCLENBQUM7TUFDMUQsQ0FBRSxDQUFDO0lBQ0o7SUFFQW9ZLE1BQU0sQ0FBQ3JYLElBQUksQ0FBRSxZQUFZO01BQ3hCdVgseUJBQXlCLENBQUVwYSxDQUFDLENBQUUsSUFBSyxDQUFFLENBQUM7SUFDdkMsQ0FBRSxDQUFDO0VBQ0o7RUFFQSxTQUFTb2EseUJBQXlCQSxDQUFFblksS0FBSyxFQUFHO0lBQzNDLElBQUlOLEtBQUs7SUFDVCxJQUFJMFksVUFBVSxHQUFHLEtBQUs7SUFDdEIsSUFBSUMsZUFBZSxHQUFHLENBQUM7SUFDdkIsSUFBSUMsWUFBWSxHQUFHLElBQUk7SUFDdkIsSUFBSUMsZUFBZSxHQUFHLEVBQUU7SUFDeEIsSUFBSUMsVUFBVSxHQUFHLEVBQUU7SUFFbkIsSUFBS3hZLEtBQUssQ0FBQ0gsSUFBSSxDQUFFLDBCQUEyQixDQUFDLEVBQUc7TUFDL0M7SUFDRDtJQUNBRyxLQUFLLENBQUNILElBQUksQ0FBRSwwQkFBMEIsRUFBRSxHQUFJLENBQUM7SUFFN0NzTyxtQkFBbUIsQ0FBRW5PLEtBQU0sQ0FBQztJQUM1Qk4sS0FBSyxHQUFHTSxLQUFLLENBQUNHLElBQUksQ0FBRSxlQUFnQixDQUFDO0lBQ3JDYSxXQUFXLENBQUV0QixLQUFNLENBQUM7SUFDcEJrQyxhQUFhLENBQUVsQyxLQUFNLENBQUM7SUFDdEIwVixzQkFBc0IsQ0FBRXBWLEtBQU0sQ0FBQztJQUMvQnFFLHNCQUFzQixDQUFFckUsS0FBTSxDQUFDO0lBQy9CMFUsUUFBUSxDQUFFelcsV0FBWSxDQUFDO0lBQ3ZCa1csdUJBQXVCLENBQUVuVSxLQUFLLEVBQUVQLGVBQWUsQ0FBRUMsS0FBTSxDQUFDLENBQUNILElBQUssQ0FBQztJQUMvRDZVLGtCQUFrQixDQUFFcFUsS0FBSyxFQUFFUCxlQUFlLENBQUVDLEtBQU0sQ0FBQyxDQUFDSCxJQUFLLENBQUM7SUFDMURnViwwQkFBMEIsQ0FBRXZVLEtBQUssRUFBRVAsZUFBZSxDQUFFQyxLQUFNLENBQUMsQ0FBQ0MsS0FBSyxFQUFFRixlQUFlLENBQUVDLEtBQU0sQ0FBQyxDQUFDSSxHQUFJLENBQUM7SUFDakd5SixvQkFBb0IsQ0FBRXZKLEtBQU0sQ0FBQztJQUU3QkEsS0FBSyxDQUFDMEgsRUFBRSxDQUFFLFFBQVEsRUFBRSx3REFBd0QsRUFBRSxZQUFZO01BQ3pGNE0sUUFBUSxDQUFFdFUsS0FBSyxFQUFFSixRQUFRLENBQUU3QixDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNpSCxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUcsQ0FBRSxDQUFDO0lBQ25ELENBQUUsQ0FBQztJQUVIakgsQ0FBQyxDQUFFMEwsUUFBUyxDQUFDLENBQUMvQixFQUFFLENBQUUsUUFBUSxFQUFFLHlCQUF5QixFQUFFLFlBQVk7TUFDbEU0TSxRQUFRLENBQUV0VSxLQUFLLEVBQUVKLFFBQVEsQ0FBRTdCLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQ2lILEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRyxDQUFFLENBQUM7SUFDbkQsQ0FBRSxDQUFDO0lBRUhoRixLQUFLLENBQUMwSCxFQUFFLENBQUUsUUFBUSxFQUFFLHNEQUFzRCxFQUFFLFlBQVk7TUFDdkZyRCxzQkFBc0IsQ0FBRXJFLEtBQU0sQ0FBQztJQUNoQyxDQUFFLENBQUM7SUFFSEEsS0FBSyxDQUFDMEgsRUFBRSxDQUFFLGNBQWMsRUFBRSw4Q0FBOEMsRUFBRSxZQUFZO01BQ3JGLElBQUk3RyxLQUFLLEdBQUdqQixRQUFRLENBQUU3QixDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNpSCxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUcsQ0FBQztNQUMzQ3NQLFFBQVEsQ0FBRXRVLEtBQUssRUFBRWhDLFNBQVMsQ0FBRTZDLEtBQUssQ0FBRSxJQUFJLEVBQUcsQ0FBQztJQUM1QyxDQUFFLENBQUM7SUFFSDlDLENBQUMsQ0FBRTBMLFFBQVMsQ0FBQyxDQUFDL0IsRUFBRSxDQUFFLGNBQWMsRUFBRSxvQkFBb0IsRUFBRSxZQUFZO01BQ25FLElBQUk3RyxLQUFLLEdBQUdqQixRQUFRLENBQUU3QixDQUFDLENBQUUsSUFBSyxDQUFDLENBQUNpSCxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUcsQ0FBQztNQUMzQ3NQLFFBQVEsQ0FBRXRVLEtBQUssRUFBRWhDLFNBQVMsQ0FBRTZDLEtBQUssQ0FBRSxJQUFJLEVBQUcsQ0FBQztJQUM1QyxDQUFFLENBQUM7SUFFSGIsS0FBSyxDQUFDMEgsRUFBRSxDQUFFLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxZQUFZO01BQ3JELElBQUkrUSxLQUFLLEdBQUcxWSxXQUFXLENBQUVDLEtBQUssRUFBRSxNQUFPLENBQUM7TUFDeEMsSUFBSXJCLEtBQUssR0FBR2lCLFFBQVEsQ0FBRTZZLEtBQUssQ0FBQ3pULEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRyxDQUFDO01BQ3ZDckcsS0FBSyxJQUFJLElBQUksS0FBS1osQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDOEIsSUFBSSxDQUFFLG1CQUFvQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztNQUNoRWxCLEtBQUssR0FBR08sS0FBSyxDQUFFUCxLQUFLLEVBQUUsQ0FBQyxFQUFFWCxTQUFTLENBQUNxQyxNQUFNLEdBQUcsQ0FBRSxDQUFDO01BQy9Db1ksS0FBSyxDQUFDelQsR0FBRyxDQUFFcUIsTUFBTSxDQUFFMUgsS0FBTSxDQUFFLENBQUMsQ0FBQzZMLE9BQU8sQ0FBRSxRQUFTLENBQUM7SUFDakQsQ0FBRSxDQUFDO0lBRUh6TSxDQUFDLENBQUUwTCxRQUFTLENBQUMsQ0FBQy9CLEVBQUUsQ0FBRSxPQUFPLEVBQUUsOENBQThDLEVBQUUsWUFBWTtNQUN0RixJQUFJK1EsS0FBSyxHQUFHMWEsQ0FBQyxDQUFFLG9CQUFxQixDQUFDO01BQ3JDLElBQUlZLEtBQUssR0FBR2lCLFFBQVEsQ0FBRTZZLEtBQUssQ0FBQ3pULEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRyxDQUFDO01BQ3ZDckcsS0FBSyxJQUFJLElBQUksS0FBS1osQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDOEIsSUFBSSxDQUFFLG1CQUFvQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztNQUNoRWxCLEtBQUssR0FBR08sS0FBSyxDQUFFUCxLQUFLLEVBQUUsQ0FBQyxFQUFFWCxTQUFTLENBQUNxQyxNQUFNLEdBQUcsQ0FBRSxDQUFDO01BQy9Db1ksS0FBSyxDQUFDelQsR0FBRyxDQUFFcUIsTUFBTSxDQUFFMUgsS0FBTSxDQUFFLENBQUMsQ0FBQzZMLE9BQU8sQ0FBRSxRQUFTLENBQUM7SUFDakQsQ0FBRSxDQUFDO0lBRUh4SyxLQUFLLENBQUMwSCxFQUFFLENBQUUsUUFBUSxFQUFFLDRHQUE0RyxFQUFFLFlBQVk7TUFDN0k4TSxzQkFBc0IsQ0FBRXhVLEtBQUssRUFBRUQsV0FBVyxDQUFFQyxLQUFLLEVBQUUsV0FBWSxDQUFDLENBQUNnRixHQUFHLENBQUMsQ0FBQyxFQUFFakYsV0FBVyxDQUFFQyxLQUFLLEVBQUUsU0FBVSxDQUFDLENBQUNnRixHQUFHLENBQUMsQ0FBRSxDQUFDO0lBQ2hILENBQUUsQ0FBQztJQUVIakgsQ0FBQyxDQUFFMEwsUUFBUyxDQUFDLENBQUMvQixFQUFFLENBQUUsUUFBUSxFQUFFLHdDQUF3QyxFQUFFLFlBQVk7TUFDakY4TSxzQkFBc0IsQ0FBRXhVLEtBQUssRUFBRWpDLENBQUMsQ0FBRSxxQkFBc0IsQ0FBQyxDQUFDaUgsR0FBRyxDQUFDLENBQUMsRUFBRWpILENBQUMsQ0FBRSxtQkFBb0IsQ0FBQyxDQUFDaUgsR0FBRyxDQUFDLENBQUUsQ0FBQztJQUNsRyxDQUFFLENBQUM7SUFFSGhGLEtBQUssQ0FBQzBILEVBQUUsQ0FBRSxjQUFjLEVBQUUsd0lBQXdJLEVBQUUsWUFBWTtNQUMvSzhNLHNCQUFzQixDQUFFeFUsS0FBSyxFQUFFRCxXQUFXLENBQUVDLEtBQUssRUFBRSxrQkFBbUIsQ0FBQyxDQUFDZ0YsR0FBRyxDQUFDLENBQUMsRUFBRWpGLFdBQVcsQ0FBRUMsS0FBSyxFQUFFLGdCQUFpQixDQUFDLENBQUNnRixHQUFHLENBQUMsQ0FBRSxDQUFDO0lBQzlILENBQUUsQ0FBQztJQUVIakgsQ0FBQyxDQUFFMEwsUUFBUyxDQUFDLENBQUMvQixFQUFFLENBQUUsY0FBYyxFQUFFLHNEQUFzRCxFQUFFLFlBQVk7TUFDckc4TSxzQkFBc0IsQ0FBRXhVLEtBQUssRUFBRWpDLENBQUMsQ0FBRSw0QkFBNkIsQ0FBQyxDQUFDaUgsR0FBRyxDQUFDLENBQUMsRUFBRWpILENBQUMsQ0FBRSwwQkFBMkIsQ0FBQyxDQUFDaUgsR0FBRyxDQUFDLENBQUUsQ0FBQztJQUNoSCxDQUFFLENBQUM7SUFFSGhGLEtBQUssQ0FBQzBILEVBQUUsQ0FBRSxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUMvREEsS0FBSyxDQUFDSyxjQUFjLENBQUMsQ0FBQztNQUN0QjBKLFdBQVcsQ0FBRTVVLEtBQUssRUFBRWpDLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzhCLElBQUksQ0FBRSxzQkFBdUIsQ0FBRSxDQUFDO0lBQy9ELENBQUUsQ0FBQztJQUVIRyxLQUFLLENBQUMwSCxFQUFFLENBQUUsT0FBTyxFQUFFLDRCQUE0QixFQUFFLFVBQVdtRCxLQUFLLEVBQUc7TUFDbkVBLEtBQUssQ0FBQ0ssY0FBYyxDQUFDLENBQUM7TUFDdEIyRixnQkFBZ0IsQ0FBRTdRLEtBQUssRUFBRWpDLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzhCLElBQUksQ0FBRSwwQkFBMkIsQ0FBRSxDQUFDO0lBQ3hFLENBQUUsQ0FBQztJQUVIRyxLQUFLLENBQUMwSCxFQUFFLENBQUUsT0FBTyxFQUFFLCtCQUErQixFQUFFLFVBQVdtRCxLQUFLLEVBQUc7TUFDdEVBLEtBQUssQ0FBQ0ssY0FBYyxDQUFDLENBQUM7TUFDdEJtQixvQ0FBb0MsQ0FBRXJNLEtBQU0sQ0FBQztJQUM5QyxDQUFFLENBQUM7SUFFSEEsS0FBSyxDQUFDMkIsT0FBTyxDQUFFLFFBQVMsQ0FBQyxDQUFDOEYsR0FBRyxDQUFFLDhCQUErQixDQUFDLENBQUNDLEVBQUUsQ0FBRSw4QkFBOEIsRUFBRSwrQkFBK0IsRUFBRSxVQUFXbUQsS0FBSyxFQUFHO01BQ3ZKQSxLQUFLLENBQUNLLGNBQWMsQ0FBQyxDQUFDO01BQ3RCbUIsb0NBQW9DLENBQUVyTSxLQUFNLENBQUM7SUFDOUMsQ0FBRSxDQUFDO0lBRUhBLEtBQUssQ0FBQzJCLE9BQU8sQ0FBRSxRQUFTLENBQUMsQ0FBQzhGLEdBQUcsQ0FBRSw4QkFBK0IsQ0FBQyxDQUFDQyxFQUFFLENBQUUsOEJBQThCLEVBQUUsd0JBQXdCLEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUNoSkEsS0FBSyxDQUFDSyxjQUFjLENBQUMsQ0FBQztNQUN0QjBKLFdBQVcsQ0FBRTVVLEtBQUssRUFBRWpDLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzhCLElBQUksQ0FBRSxzQkFBdUIsQ0FBRSxDQUFDO0lBQy9ELENBQUUsQ0FBQztJQUVIRyxLQUFLLENBQUMyQixPQUFPLENBQUUsUUFBUyxDQUFDLENBQUM4RixHQUFHLENBQUUsNEJBQTZCLENBQUMsQ0FBQ0MsRUFBRSxDQUFFLDRCQUE0QixFQUFFLDBCQUEwQixFQUFFLFVBQVdtRCxLQUFLLEVBQUc7TUFDOUlBLEtBQUssQ0FBQ0ssY0FBYyxDQUFDLENBQUM7TUFDdEI4RixlQUFlLENBQUVoUixLQUFNLENBQUM7SUFDekIsQ0FBRSxDQUFDO0lBRUhBLEtBQUssQ0FBQzBILEVBQUUsQ0FBRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUM1REQsdUJBQXVCLENBQUU1SyxLQUFLLEVBQUU2SyxLQUFNLENBQUM7SUFDeEMsQ0FBRSxDQUFDO0lBRUg5TSxDQUFDLENBQUUwTCxRQUFTLENBQUMsQ0FBQ2hDLEdBQUcsQ0FBRSxnQ0FBaUMsQ0FBQyxDQUFDQyxFQUFFLENBQUUsZ0NBQWdDLEVBQUUsaURBQWlELEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUNqS0EsS0FBSyxDQUFDSyxjQUFjLENBQUMsQ0FBQztNQUN0QjBKLFdBQVcsQ0FBRTVVLEtBQUssRUFBRWpDLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzhCLElBQUksQ0FBRSxzQkFBdUIsQ0FBRSxDQUFDO0lBQy9ELENBQUUsQ0FBQztJQUVIOUIsQ0FBQyxDQUFFMEwsUUFBUyxDQUFDLENBQUNoQyxHQUFHLENBQUUsb0NBQXFDLENBQUMsQ0FBQ0MsRUFBRSxDQUFFLG9DQUFvQyxFQUFFLHFEQUFxRCxFQUFFLFVBQVdtRCxLQUFLLEVBQUc7TUFDN0tBLEtBQUssQ0FBQ0ssY0FBYyxDQUFDLENBQUM7TUFDdEIyRixnQkFBZ0IsQ0FBRTdRLEtBQUssRUFBRWpDLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzhCLElBQUksQ0FBRSwwQkFBMkIsQ0FBRSxDQUFDO0lBQ3hFLENBQUUsQ0FBQztJQUVIRyxLQUFLLENBQUMwSCxFQUFFLENBQUUsc0JBQXNCLEVBQUUsaUJBQWlCLEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUN2RSxJQUFJd0ksVUFBVSxHQUFHdFYsQ0FBQyxDQUFFLElBQUssQ0FBQyxDQUFDNEQsT0FBTyxDQUFFLG9CQUFxQixDQUFDO01BQzFELElBQUk0USxLQUFLLEdBQUdjLFVBQVUsQ0FBQzFSLE9BQU8sQ0FBRSxlQUFnQixDQUFDO01BQ2pEeVcsVUFBVSxHQUFHLElBQUk7TUFDakJJLFVBQVUsR0FBR3phLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQ2lLLFFBQVEsQ0FBRSxzQkFBdUIsQ0FBQyxHQUFHLE9BQU8sR0FBRyxLQUFLO01BQzNFN0osaUJBQWlCLEdBQUdrVixVQUFVLENBQUN4VCxJQUFJLENBQUUsMkJBQTRCLENBQUM7TUFDbEUwWSxlQUFlLEdBQUdwYSxpQkFBaUI7TUFDbkNtYSxZQUFZLEdBQUcvRixLQUFLLENBQUM1USxPQUFPLENBQUUsY0FBZSxDQUFDLENBQUM5QixJQUFJLENBQUUsa0JBQW1CLENBQUM7TUFDekV3WSxlQUFlLEdBQUcvRixtQkFBbUIsQ0FBRXpILEtBQUssRUFBRTBILEtBQU0sQ0FBQztNQUNyRHBELGlCQUFpQixDQUFFblAsS0FBTSxDQUFDO01BQzFCNkssS0FBSyxDQUFDSyxjQUFjLENBQUMsQ0FBQztNQUN0QkwsS0FBSyxDQUFDTSxlQUFlLENBQUMsQ0FBQztJQUN4QixDQUFFLENBQUM7SUFFSG5MLEtBQUssQ0FBQzBILEVBQUUsQ0FBRSxzQkFBc0IsRUFBRSxxREFBcUQsRUFBRSxVQUFXbUQsS0FBSyxFQUFHO01BQzNHLElBQUs5TSxDQUFDLENBQUU4TSxLQUFLLENBQUNHLE1BQU8sQ0FBQyxDQUFDckosT0FBTyxDQUFFLGlCQUFrQixDQUFDLENBQUN0QixNQUFNLEVBQUc7UUFDNUQ7TUFDRDtNQUNBbEMsaUJBQWlCLEdBQUdKLENBQUMsQ0FBRSxJQUFLLENBQUMsQ0FBQzhCLElBQUksQ0FBRSwyQkFBNEIsQ0FBQztNQUNqRXNQLGlCQUFpQixDQUFFblAsS0FBTSxDQUFDO01BQzFCNkssS0FBSyxDQUFDTSxlQUFlLENBQUMsQ0FBQztJQUN4QixDQUFFLENBQUM7SUFFSG5MLEtBQUssQ0FBQzBILEVBQUUsQ0FBRSxzQkFBc0IsRUFBRSxlQUFlLEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUNyRSxJQUFJMEgsS0FBSyxHQUFHeFUsQ0FBQyxDQUFFLElBQUssQ0FBQztNQUNyQixJQUFJMmEsVUFBVSxHQUFHM2EsQ0FBQyxDQUFFOE0sS0FBSyxDQUFDRyxNQUFPLENBQUMsQ0FBQ3JKLE9BQU8sQ0FBRSxjQUFlLENBQUM7TUFDNUQsSUFBSXBDLElBQUk7TUFFUixJQUFLeEIsQ0FBQyxDQUFFOE0sS0FBSyxDQUFDRyxNQUFPLENBQUMsQ0FBQ3JKLE9BQU8sQ0FBRSxxREFBc0QsQ0FBQyxDQUFDdEIsTUFBTSxFQUFHO1FBQ2hHO01BQ0Q7TUFDQSxJQUFLcVksVUFBVSxDQUFDclksTUFBTSxJQUFJLENBQUVzVSxpQ0FBaUMsQ0FBRStELFVBQVcsQ0FBQyxFQUFHO1FBQzdFO01BQ0Q7TUFFQU4sVUFBVSxHQUFHLElBQUk7TUFDakJJLFVBQVUsR0FBRyxFQUFFO01BQ2ZGLFlBQVksR0FBRy9GLEtBQUssQ0FBQzVRLE9BQU8sQ0FBRSxjQUFlLENBQUMsQ0FBQzlCLElBQUksQ0FBRSxrQkFBbUIsQ0FBQztNQUN6RXdZLGVBQWUsR0FBRy9GLG1CQUFtQixDQUFFekgsS0FBSyxFQUFFMEgsS0FBTSxDQUFDO01BQ3JEaFQsSUFBSSxHQUFHRSxlQUFlLENBQUVDLEtBQU0sQ0FBQyxDQUFDSCxJQUFJO01BQ3BDZ1osZUFBZSxHQUFHOUYsZ0JBQWdCLENBQUV6UyxLQUFLLEVBQUUsQ0FBRXNZLFlBQVksQ0FBRSxFQUFFRCxlQUFlLEVBQUVBLGVBQWUsR0FBRzlZLElBQUssQ0FBQyxDQUFDd0IsRUFBRTtNQUN6RytTLGFBQWEsQ0FBRTlULEtBQUssRUFBRTZLLEtBQU0sQ0FBQztNQUM3QkEsS0FBSyxDQUFDSyxjQUFjLENBQUMsQ0FBQztJQUN2QixDQUFFLENBQUM7SUFFSG5OLENBQUMsQ0FBRTBMLFFBQVMsQ0FBQyxDQUFDL0IsRUFBRSxDQUFFLHFDQUFxQyxFQUFFLFVBQVdtRCxLQUFLLEVBQUc7TUFDM0UsSUFBSThOLFVBQVU7TUFDZCxJQUFJelMsSUFBSTtNQUNSLElBQUlxTSxLQUFLO01BQ1QsSUFBSWpULE1BQU07TUFDVixJQUFJd0IsSUFBSTtNQUVSLElBQUssQ0FBRXNYLFVBQVUsRUFBRztRQUNuQjtNQUNEO01BRUF0WCxJQUFJLEdBQUdMLG1CQUFtQixDQUFFOFgsZUFBZ0IsQ0FBQztNQUM3QyxJQUFLLENBQUV6WCxJQUFJLEVBQUc7UUFDYjtNQUNEO01BRUE2WCxVQUFVLEdBQUcvRyxnQkFBZ0IsQ0FBRTVSLEtBQUssRUFBRTZLLEtBQU0sQ0FBQyxJQUFJeU4sWUFBWTtNQUM3RHBTLElBQUksR0FBR0wsZ0JBQWdCLENBQUU3RixLQUFLLEVBQUVzWSxZQUFZLEVBQUVLLFVBQVcsQ0FBQztNQUMxRHBHLEtBQUssR0FBR3ZTLEtBQUssQ0FBQ0csSUFBSSxDQUFFLGlDQUFpQyxHQUFHbVksWUFBWSxHQUFHLGtCQUFtQixDQUFDO01BQzNGaFosTUFBTSxHQUFHZ1QsbUJBQW1CLENBQUV6SCxLQUFLLEVBQUUwSCxLQUFNLENBQUM7TUFFNUMsSUFBSyxPQUFPLEtBQUtpRyxVQUFVLEVBQUc7UUFDN0I5RixnQkFBZ0IsQ0FBRTFTLEtBQUssRUFBRWMsSUFBSSxDQUFDQyxFQUFFLEVBQUVELElBQUksQ0FBQ29GLElBQUksRUFBRTVHLE1BQU0sRUFBRXdCLElBQUksQ0FBQ2hCLEdBQUksQ0FBQztNQUNoRSxDQUFDLE1BQU0sSUFBSyxLQUFLLEtBQUswWSxVQUFVLEVBQUc7UUFDbEM5RixnQkFBZ0IsQ0FBRTFTLEtBQUssRUFBRWMsSUFBSSxDQUFDQyxFQUFFLEVBQUVELElBQUksQ0FBQ29GLElBQUksRUFBRXBGLElBQUksQ0FBQ25CLEtBQUssRUFBRUwsTUFBTyxDQUFDO01BQ2xFLENBQUMsTUFBTTtRQUNOb1QsZ0JBQWdCLENBQUUxUyxLQUFLLEVBQUVjLElBQUksQ0FBQ0MsRUFBRSxFQUFFbUYsSUFBSSxFQUFFbVMsZUFBZSxFQUFFL1ksTUFBTyxDQUFDO01BQ2xFO01BQ0FpWixlQUFlLEdBQUdwYSxpQkFBaUI7TUFFbkMyVixhQUFhLENBQUU5VCxLQUFLLEVBQUU2SyxLQUFNLENBQUM7TUFDN0JBLEtBQUssQ0FBQ0ssY0FBYyxDQUFDLENBQUM7SUFDdkIsQ0FBRSxDQUFDO0lBRUhuTixDQUFDLENBQUUwTCxRQUFTLENBQUMsQ0FBQy9CLEVBQUUsQ0FBRSxrQ0FBa0MsRUFBRSxZQUFZO01BQ2pFMFEsVUFBVSxHQUFHLEtBQUs7TUFDbEJJLFVBQVUsR0FBRyxFQUFFO01BQ2ZELGVBQWUsR0FBRyxFQUFFO01BQ3BCckUsYUFBYSxDQUFFbFUsS0FBTSxDQUFDO0lBQ3ZCLENBQUUsQ0FBQztJQUVIQSxLQUFLLENBQUMwSCxFQUFFLENBQUUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLFVBQVdtRCxLQUFLLEVBQUc7TUFDakVBLEtBQUssQ0FBQ0ssY0FBYyxDQUFDLENBQUM7TUFDdEI4RixlQUFlLENBQUVoUixLQUFNLENBQUM7SUFDekIsQ0FBRSxDQUFDO0lBRUhqQyxDQUFDLENBQUUwTCxRQUFTLENBQUMsQ0FBQ2hDLEdBQUcsQ0FBRSw4QkFBK0IsQ0FBQyxDQUFDQyxFQUFFLENBQUUsOEJBQThCLEVBQUUsbURBQW1ELEVBQUUsVUFBV21ELEtBQUssRUFBRztNQUMvSkEsS0FBSyxDQUFDSyxjQUFjLENBQUMsQ0FBQztNQUN0QjhGLGVBQWUsQ0FBRWhSLEtBQU0sQ0FBQztJQUN6QixDQUFFLENBQUM7RUFDSjtFQUVBdUMsTUFBTSxDQUFDcVcsZ0NBQWdDLEdBQUcsVUFBV3RNLE9BQU8sRUFBRztJQUM5RHFGLG9CQUFvQixDQUFFckYsT0FBTyxJQUFJN0MsUUFBUSxFQUFFLElBQUssQ0FBQztFQUNsRCxDQUFDO0VBQ0RsSCxNQUFNLENBQUNzVyx1Q0FBdUMsR0FBR3ZILHNCQUFzQjtFQUV2RXZULENBQUMsQ0FBRSxZQUFZO0lBQ2Q0WixrQkFBa0IsQ0FBQyxDQUFDO0lBQ3BCaEcsb0JBQW9CLENBQUVsSSxRQUFRLEVBQUUsS0FBTSxDQUFDO0lBRXZDMUwsQ0FBQyxDQUFFMEwsUUFBUyxDQUFDLENBQUMvQixFQUFFLENBQUUsa0NBQWtDLEVBQUUsVUFBV21ELEtBQUssRUFBRXlCLE9BQU8sRUFBRztNQUNqRnFGLG9CQUFvQixDQUFFckYsT0FBTyxJQUFJN0MsUUFBUSxFQUFFLElBQUssQ0FBQztJQUNsRCxDQUFFLENBQUM7RUFDSixDQUFFLENBQUM7QUFDSixDQUFDLEVBQUVxUCxNQUFPLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=
