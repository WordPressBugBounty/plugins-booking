"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
/*!
 * Generated using the Bootstrap Customizer (http://getbootstrap.com/customize/?id=f4b4c9cb85df757ca08c)
 * Config saved to config.json and https://gist.github.com/f4b4c9cb85df757ca08c
 */
if (typeof jQuery === 'undefined') {
  throw new Error('Bootstrap\'s JavaScript requires jQuery');
}
+function ($) {
  'use strict';

  var version = $.fn.jquery.split(' ')[0].split('.');
  if (version[0] < 2 && version[1] < 9 || version[0] == 1 && version[1] == 9 && version[2] < 1) {
    throw new Error('Bootstrap\'s JavaScript requires jQuery version 1.9.1 or higher');
  }
}(jQuery);

/* ========================================================================
 * Bootstrap: modal.js v3.3.5
 * http://getbootstrap.com/javascript/#modals
 * ========================================================================
 * Copyright 2011-2015 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */

+function ($) {
  'use strict';

  // MODAL CLASS DEFINITION
  // ======================
  var Modal = function Modal(element, options) {
    this.options = options;
    this.$body = $(document.body);
    this.$element = $(element);
    this.$dialog = this.$element.find('.modal-dialog');
    this.$backdrop = null;
    this.isShown = null;
    this.originalBodyPad = null;
    this.scrollbarWidth = 0;
    this.ignoreBackdropClick = false;
    if (this.options.remote) {
      this.$element.find('.modal-content').load(this.options.remote, $.proxy(function () {
        this.$element.trigger('loaded.wpbc.modal');
      }, this));
    }
  };
  Modal.VERSION = '3.3.5';
  Modal.TRANSITION_DURATION = 300;
  Modal.BACKDROP_TRANSITION_DURATION = 150;
  Modal.DEFAULTS = {
    backdrop: true,
    keyboard: true,
    show: true
  };
  Modal.prototype.toggle = function (_relatedTarget) {
    return this.isShown ? this.hide() : this.show(_relatedTarget);
  };
  Modal.prototype.show = function (_relatedTarget) {
    var that = this;
    var e = $.Event('show.wpbc.modal', {
      relatedTarget: _relatedTarget
    });
    this.$element.trigger(e);
    if (this.isShown || e.isDefaultPrevented()) return;
    this.isShown = true;
    this.checkScrollbar();
    this.setScrollbar();
    this.$body.addClass('modal-open');
    this.escape();
    this.resize();
    this.$element.on('click.dismiss.wpbc.modal', '[data-dismiss="modal"]', $.proxy(this.hide, this));
    this.$dialog.on('mousedown.dismiss.wpbc.modal', function () {
      that.$element.one('mouseup.dismiss.wpbc.modal', function (e) {
        if ($(e.target).is(that.$element)) that.ignoreBackdropClick = true;
      });
    });
    this.backdrop(function () {
      var transition = $.support.transition && that.$element.hasClass('fade');
      if (!that.$element.parent().length) {
        that.$element.appendTo(that.$body); // don't move modals dom position
      }
      that.$element.show().scrollTop(0);
      that.adjustDialog();
      if (transition) {
        that.$element[0].offsetWidth; // force reflow
      }
      that.$element.addClass('in');
      that.enforceFocus();
      var e = $.Event('shown.wpbc.modal', {
        relatedTarget: _relatedTarget
      });
      transition ? that.$dialog // wait for modal to slide in
      .one('bsTransitionEnd', function () {
        that.$element.trigger('focus').trigger(e);
      }).emulateTransitionEnd(Modal.TRANSITION_DURATION) : that.$element.trigger('focus').trigger(e);
    });
  };
  Modal.prototype.hide = function (e) {
    if (e) e.preventDefault();
    e = $.Event('hide.wpbc.modal');
    this.$element.trigger(e);
    if (!this.isShown || e.isDefaultPrevented()) return;
    this.isShown = false;
    this.escape();
    this.resize();
    $(document).off('focusin.wpbc.modal');
    this.$element.removeClass('in').off('click.dismiss.wpbc.modal').off('mouseup.dismiss.wpbc.modal');
    this.$dialog.off('mousedown.dismiss.wpbc.modal');
    $.support.transition && this.$element.hasClass('fade') ? this.$element.one('bsTransitionEnd', $.proxy(this.hideModal, this)).emulateTransitionEnd(Modal.TRANSITION_DURATION) : this.hideModal();
  };
  Modal.prototype.enforceFocus = function () {
    $(document).off('focusin.wpbc.modal') // guard against infinite focus loop
    .on('focusin.wpbc.modal', $.proxy(function (e) {
      if (this.$element[0] !== e.target && !this.$element.has(e.target).length) {
        this.$element.trigger('focus');
      }
    }, this));
  };
  Modal.prototype.escape = function () {
    if (this.isShown && this.options.keyboard) {
      this.$element.on('keydown.dismiss.wpbc.modal', $.proxy(function (e) {
        e.which == 27 && this.hide();
      }, this));
    } else if (!this.isShown) {
      this.$element.off('keydown.dismiss.wpbc.modal');
    }
  };
  Modal.prototype.resize = function () {
    if (this.isShown) {
      $(window).on('resize.wpbc.modal', $.proxy(this.handleUpdate, this));
    } else {
      $(window).off('resize.wpbc.modal');
    }
  };
  Modal.prototype.hideModal = function () {
    var that = this;
    this.$element.hide();
    this.backdrop(function () {
      that.$body.removeClass('modal-open');
      that.resetAdjustments();
      that.resetScrollbar();
      that.$element.trigger('hidden.wpbc.modal');
    });
  };
  Modal.prototype.removeBackdrop = function () {
    this.$backdrop && this.$backdrop.remove();
    this.$backdrop = null;
  };
  Modal.prototype.backdrop = function (callback) {
    var that = this;
    var animate = this.$element.hasClass('fade') ? 'fade' : '';
    if (this.isShown && this.options.backdrop) {
      var doAnimate = $.support.transition && animate;
      this.$backdrop = $(document.createElement('div')).addClass('modal-backdrop ' + animate).appendTo(this.$body);
      this.$element.on('click.dismiss.wpbc.modal', $.proxy(function (e) {
        if (this.ignoreBackdropClick) {
          this.ignoreBackdropClick = false;
          return;
        }
        if (e.target !== e.currentTarget) return;
        this.options.backdrop == 'static' ? this.$element[0].focus() : this.hide();
      }, this));
      if (doAnimate) this.$backdrop[0].offsetWidth; // force reflow

      this.$backdrop.addClass('in');
      if (!callback) return;
      doAnimate ? this.$backdrop.one('bsTransitionEnd', callback).emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) : callback();
    } else if (!this.isShown && this.$backdrop) {
      this.$backdrop.removeClass('in');
      var callbackRemove = function callbackRemove() {
        that.removeBackdrop();
        callback && callback();
      };
      $.support.transition && this.$element.hasClass('fade') ? this.$backdrop.one('bsTransitionEnd', callbackRemove).emulateTransitionEnd(Modal.BACKDROP_TRANSITION_DURATION) : callbackRemove();
    } else if (callback) {
      callback();
    }
  };

  // these following methods are used to handle overflowing modals

  Modal.prototype.handleUpdate = function () {
    this.adjustDialog();
  };
  Modal.prototype.adjustDialog = function () {
    var modalIsOverflowing = this.$element[0].scrollHeight > document.documentElement.clientHeight;
    this.$element.css({
      paddingLeft: !this.bodyIsOverflowing && modalIsOverflowing ? this.scrollbarWidth : '',
      paddingRight: this.bodyIsOverflowing && !modalIsOverflowing ? this.scrollbarWidth : ''
    });
  };
  Modal.prototype.resetAdjustments = function () {
    this.$element.css({
      paddingLeft: '',
      paddingRight: ''
    });
  };
  Modal.prototype.checkScrollbar = function () {
    var fullWindowWidth = window.innerWidth;
    if (!fullWindowWidth) {
      // workaround for missing window.innerWidth in IE8
      var documentElementRect = document.documentElement.getBoundingClientRect();
      fullWindowWidth = documentElementRect.right - Math.abs(documentElementRect.left);
    }
    this.bodyIsOverflowing = document.body.clientWidth < fullWindowWidth;
    this.scrollbarWidth = this.measureScrollbar();
  };
  Modal.prototype.setScrollbar = function () {
    var bodyPad = parseInt(this.$body.css('padding-right') || 0, 10);
    this.originalBodyPad = document.body.style.paddingRight || '';
    if (this.bodyIsOverflowing) this.$body.css('padding-right', bodyPad + this.scrollbarWidth);
  };
  Modal.prototype.resetScrollbar = function () {
    this.$body.css('padding-right', this.originalBodyPad);
  };
  Modal.prototype.measureScrollbar = function () {
    // thx walsh
    var scrollDiv = document.createElement('div');
    scrollDiv.className = 'modal-scrollbar-measure';
    this.$body.append(scrollDiv);
    var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
    this.$body[0].removeChild(scrollDiv);
    return scrollbarWidth;
  };

  // MODAL PLUGIN DEFINITION
  // =======================

  function Plugin(option, _relatedTarget) {
    return this.each(function () {
      var $this = $(this);
      var data = $this.data('wpbc.modal');
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), _typeof(option) == 'object' && option);
      if (!data) $this.data('wpbc.modal', data = new Modal(this, options));
      if (typeof option == 'string') data[option](_relatedTarget);else if (options.show) data.show(_relatedTarget);
    });
  }
  var old = $.fn.wpbc_my_modal;
  $.fn.wpbc_my_modal = Plugin;
  $.fn.wpbc_my_modal.Constructor = Modal;

  // MODAL NO CONFLICT
  // =================

  $.fn.wpbc_my_modal.noConflict = function () {
    $.fn.wpbc_my_modal = old;
    return this;
  };

  // MODAL DATA-API
  // ==============

  $(document).on('click.wpbc.modal.data-api', '[data-toggle="wpbc_my_modal"]', function (e) {
    var $this = $(this);
    var href = $this.attr('href');
    var $target = $($this.attr('data-target') || href && href.replace(/.*(?=#[^\s]+$)/, '')); // strip for ie7
    var option = $target.data('wpbc.modal') ? 'toggle' : $.extend({
      remote: !/#/.test(href) && href
    }, $target.data(), $this.data());
    if ($this.is('a')) e.preventDefault();
    $target.one('show.wpbc.modal', function (showEvent) {
      if (showEvent.isDefaultPrevented()) return; // only register focus restorer if modal will actually get shown
      $target.one('hidden.wpbc.modal', function () {
        $this.is(':visible') && $this.trigger('focus');
      });
    });
    Plugin.call($target, option, this);
  });
}(jQuery);
+function ($) {
  'use strict';

  // DROPDOWN CLASS DEFINITION
  // =========================
  var backdrop = '.dropdown-backdrop';
  var toggle = '[data-toggle="wpbc_dropdown"]';
  var Dropdown = function Dropdown(element) {
    $(element).on('click.wpbc.dropdown', this.toggle);
  };
  Dropdown.VERSION = '3.3.5';
  function getParent($this) {
    var selector = $this.attr('data-target');
    if (!selector) {
      selector = $this.attr('href');
      selector = selector && /#[A-Za-z]/.test(selector) && selector.replace(/.*(?=#[^\s]*$)/, ''); // strip for ie7
    }
    var $parent = selector && $(selector);
    return $parent && $parent.length ? $parent : $this.parent();
  }
  function clearMenus(e) {
    if (e && e.which === 3) return;
    $(backdrop).remove();
    $(toggle).each(function () {
      var $this = $(this);
      var $parent = getParent($this);
      var relatedTarget = {
        relatedTarget: this
      };
      if (!$parent.hasClass('open')) return;
      if (e && e.type == 'click' && /input|textarea/i.test(e.target.tagName) && $.contains($parent[0], e.target)) return;
      $parent.trigger(e = $.Event('hide.wpbc.dropdown', relatedTarget));
      if (e.isDefaultPrevented()) return;
      $this.attr('aria-expanded', 'false');
      $parent.removeClass('open').trigger('hidden.wpbc.dropdown', relatedTarget);
    });
  }
  Dropdown.prototype.toggle = function (e) {
    var $this = $(this);
    if ($this.is('.disabled, :disabled')) return;
    var $parent = getParent($this);
    var isActive = $parent.hasClass('open');
    clearMenus();
    if (!isActive) {
      if ('ontouchstart' in document.documentElement && !$parent.closest('.navbar-nav').length) {
        // if mobile we use a backdrop because click events don't delegate
        $(document.createElement('div')).addClass('dropdown-backdrop').insertAfter($(this)).on('click', clearMenus);
      }
      var relatedTarget = {
        relatedTarget: this
      };
      $parent.trigger(e = $.Event('show.wpbc.dropdown', relatedTarget));
      if (e.isDefaultPrevented()) return;
      $this.trigger('focus').attr('aria-expanded', 'true');
      $parent.toggleClass('open').trigger('shown.wpbc.dropdown', relatedTarget);
    }
    return false;
  };
  Dropdown.prototype.keydown = function (e) {
    if (!/(38|40|27|32)/.test(e.which) || /input|textarea/i.test(e.target.tagName)) return;
    var $this = $(this);
    e.preventDefault();
    e.stopPropagation();
    if ($this.is('.disabled, :disabled')) return;
    var $parent = getParent($this);
    var isActive = $parent.hasClass('open');
    if (!isActive && e.which != 27 || isActive && e.which == 27) {
      if (e.which == 27) $parent.find(toggle).trigger('focus');
      return $this.trigger('click');
    }
    var desc = ' li:not(.disabled):visible a';
    var $items = $parent.find('.dropdown-menu' + desc + ',.ui_dropdown_menu' + desc);
    if (!$items.length) return;
    var index = $items.index(e.target);
    if (e.which == 38 && index > 0) index--; // up
    if (e.which == 40 && index < $items.length - 1) index++; // down
    if (!~index) index = 0;
    $items.eq(index).trigger('focus');
  };

  // DROPDOWN PLUGIN DEFINITION
  // ==========================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this);
      var data = $this.data('wpbc.dropdown');
      if (!data) $this.data('wpbc.dropdown', data = new Dropdown(this));
      if (typeof option == 'string') data[option].call($this);
    });
  }
  var old = $.fn.wpbc_dropdown;
  $.fn.wpbc_dropdown = Plugin;
  $.fn.wpbc_dropdown.Constructor = Dropdown;

  // DROPDOWN NO CONFLICT
  // ====================

  $.fn.wpbc_dropdown.noConflict = function () {
    $.fn.wpbc_dropdown = old;
    return this;
  };

  // APPLY TO STANDARD DROPDOWN ELEMENTS
  // ===================================

  $(document).on('click.wpbc.dropdown.data-api', clearMenus).on('click.wpbc.dropdown.data-api', '.dropdown form', function (e) {
    e.stopPropagation();
  }).on('click.wpbc.dropdown.data-api', toggle, Dropdown.prototype.toggle).on('keydown.wpbc.dropdown.data-api', toggle, Dropdown.prototype.keydown).on('keydown.wpbc.dropdown.data-api', '.dropdown-menu', Dropdown.prototype.keydown).on('keydown.wpbc.dropdown.data-api', '.ui_dropdown_menu', Dropdown.prototype.keydown);
}(jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXRzL2xpYnMvdWkvX291dC9kcm9wZG93bl9tb2RhbC5qcyIsIm5hbWVzIjpbImpRdWVyeSIsIkVycm9yIiwiJCIsInZlcnNpb24iLCJmbiIsImpxdWVyeSIsInNwbGl0IiwiTW9kYWwiLCJlbGVtZW50Iiwib3B0aW9ucyIsIiRib2R5IiwiZG9jdW1lbnQiLCJib2R5IiwiJGVsZW1lbnQiLCIkZGlhbG9nIiwiZmluZCIsIiRiYWNrZHJvcCIsImlzU2hvd24iLCJvcmlnaW5hbEJvZHlQYWQiLCJzY3JvbGxiYXJXaWR0aCIsImlnbm9yZUJhY2tkcm9wQ2xpY2siLCJyZW1vdGUiLCJsb2FkIiwicHJveHkiLCJ0cmlnZ2VyIiwiVkVSU0lPTiIsIlRSQU5TSVRJT05fRFVSQVRJT04iLCJCQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OIiwiREVGQVVMVFMiLCJiYWNrZHJvcCIsImtleWJvYXJkIiwic2hvdyIsInByb3RvdHlwZSIsInRvZ2dsZSIsIl9yZWxhdGVkVGFyZ2V0IiwiaGlkZSIsInRoYXQiLCJlIiwiRXZlbnQiLCJyZWxhdGVkVGFyZ2V0IiwiaXNEZWZhdWx0UHJldmVudGVkIiwiY2hlY2tTY3JvbGxiYXIiLCJzZXRTY3JvbGxiYXIiLCJhZGRDbGFzcyIsImVzY2FwZSIsInJlc2l6ZSIsIm9uIiwib25lIiwidGFyZ2V0IiwiaXMiLCJ0cmFuc2l0aW9uIiwic3VwcG9ydCIsImhhc0NsYXNzIiwicGFyZW50IiwibGVuZ3RoIiwiYXBwZW5kVG8iLCJzY3JvbGxUb3AiLCJhZGp1c3REaWFsb2ciLCJvZmZzZXRXaWR0aCIsImVuZm9yY2VGb2N1cyIsImVtdWxhdGVUcmFuc2l0aW9uRW5kIiwicHJldmVudERlZmF1bHQiLCJvZmYiLCJyZW1vdmVDbGFzcyIsImhpZGVNb2RhbCIsImhhcyIsIndoaWNoIiwid2luZG93IiwiaGFuZGxlVXBkYXRlIiwicmVzZXRBZGp1c3RtZW50cyIsInJlc2V0U2Nyb2xsYmFyIiwicmVtb3ZlQmFja2Ryb3AiLCJyZW1vdmUiLCJjYWxsYmFjayIsImFuaW1hdGUiLCJkb0FuaW1hdGUiLCJjcmVhdGVFbGVtZW50IiwiY3VycmVudFRhcmdldCIsImZvY3VzIiwiY2FsbGJhY2tSZW1vdmUiLCJtb2RhbElzT3ZlcmZsb3dpbmciLCJzY3JvbGxIZWlnaHQiLCJkb2N1bWVudEVsZW1lbnQiLCJjbGllbnRIZWlnaHQiLCJjc3MiLCJwYWRkaW5nTGVmdCIsImJvZHlJc092ZXJmbG93aW5nIiwicGFkZGluZ1JpZ2h0IiwiZnVsbFdpbmRvd1dpZHRoIiwiaW5uZXJXaWR0aCIsImRvY3VtZW50RWxlbWVudFJlY3QiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJyaWdodCIsIk1hdGgiLCJhYnMiLCJsZWZ0IiwiY2xpZW50V2lkdGgiLCJtZWFzdXJlU2Nyb2xsYmFyIiwiYm9keVBhZCIsInBhcnNlSW50Iiwic3R5bGUiLCJzY3JvbGxEaXYiLCJjbGFzc05hbWUiLCJhcHBlbmQiLCJyZW1vdmVDaGlsZCIsIlBsdWdpbiIsIm9wdGlvbiIsImVhY2giLCIkdGhpcyIsImRhdGEiLCJleHRlbmQiLCJfdHlwZW9mIiwib2xkIiwid3BiY19teV9tb2RhbCIsIkNvbnN0cnVjdG9yIiwibm9Db25mbGljdCIsImhyZWYiLCJhdHRyIiwiJHRhcmdldCIsInJlcGxhY2UiLCJ0ZXN0Iiwic2hvd0V2ZW50IiwiY2FsbCIsIkRyb3Bkb3duIiwiZ2V0UGFyZW50Iiwic2VsZWN0b3IiLCIkcGFyZW50IiwiY2xlYXJNZW51cyIsInR5cGUiLCJ0YWdOYW1lIiwiY29udGFpbnMiLCJpc0FjdGl2ZSIsImNsb3Nlc3QiLCJpbnNlcnRBZnRlciIsInRvZ2dsZUNsYXNzIiwia2V5ZG93biIsInN0b3BQcm9wYWdhdGlvbiIsImRlc2MiLCIkaXRlbXMiLCJpbmRleCIsImVxIiwid3BiY19kcm9wZG93biJdLCJzb3VyY2VzIjpbImFzc2V0cy9saWJzL3VpL19zcmMvZHJvcGRvd25fbW9kYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohXHJcbiAqIEdlbmVyYXRlZCB1c2luZyB0aGUgQm9vdHN0cmFwIEN1c3RvbWl6ZXIgKGh0dHA6Ly9nZXRib290c3RyYXAuY29tL2N1c3RvbWl6ZS8/aWQ9ZjRiNGM5Y2I4NWRmNzU3Y2EwOGMpXHJcbiAqIENvbmZpZyBzYXZlZCB0byBjb25maWcuanNvbiBhbmQgaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vZjRiNGM5Y2I4NWRmNzU3Y2EwOGNcclxuICovXHJcbmlmICh0eXBlb2YgalF1ZXJ5ID09PSAndW5kZWZpbmVkJykge1xyXG4gIHRocm93IG5ldyBFcnJvcignQm9vdHN0cmFwXFwncyBKYXZhU2NyaXB0IHJlcXVpcmVzIGpRdWVyeScpXHJcbn1cclxuK2Z1bmN0aW9uICgkKSB7XHJcbiAgJ3VzZSBzdHJpY3QnO1xyXG4gIHZhciB2ZXJzaW9uID0gJC5mbi5qcXVlcnkuc3BsaXQoJyAnKVswXS5zcGxpdCgnLicpXHJcbiAgaWYgKCh2ZXJzaW9uWzBdIDwgMiAmJiB2ZXJzaW9uWzFdIDwgOSkgfHwgKHZlcnNpb25bMF0gPT0gMSAmJiB2ZXJzaW9uWzFdID09IDkgJiYgdmVyc2lvblsyXSA8IDEpKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0Jvb3RzdHJhcFxcJ3MgSmF2YVNjcmlwdCByZXF1aXJlcyBqUXVlcnkgdmVyc2lvbiAxLjkuMSBvciBoaWdoZXInKVxyXG4gIH1cclxufShqUXVlcnkpO1xyXG5cclxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqIEJvb3RzdHJhcDogbW9kYWwuanMgdjMuMy41XHJcbiAqIGh0dHA6Ly9nZXRib290c3RyYXAuY29tL2phdmFzY3JpcHQvI21vZGFsc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogQ29weXJpZ2h0IDIwMTEtMjAxNSBUd2l0dGVyLCBJbmMuXHJcbiAqIExpY2Vuc2VkIHVuZGVyIE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL3R3YnMvYm9vdHN0cmFwL2Jsb2IvbWFzdGVyL0xJQ0VOU0UpXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxuXHJcbitmdW5jdGlvbiAoJCkge1xyXG4gICd1c2Ugc3RyaWN0JztcclxuXHJcbiAgLy8gTU9EQUwgQ0xBU1MgREVGSU5JVElPTlxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgdmFyIE1vZGFsID0gZnVuY3Rpb24gKGVsZW1lbnQsIG9wdGlvbnMpIHtcclxuICAgIHRoaXMub3B0aW9ucyAgICAgICAgICAgICA9IG9wdGlvbnNcclxuICAgIHRoaXMuJGJvZHkgICAgICAgICAgICAgICA9ICQoZG9jdW1lbnQuYm9keSlcclxuICAgIHRoaXMuJGVsZW1lbnQgICAgICAgICAgICA9ICQoZWxlbWVudClcclxuICAgIHRoaXMuJGRpYWxvZyAgICAgICAgICAgICA9IHRoaXMuJGVsZW1lbnQuZmluZCgnLm1vZGFsLWRpYWxvZycpXHJcbiAgICB0aGlzLiRiYWNrZHJvcCAgICAgICAgICAgPSBudWxsXHJcbiAgICB0aGlzLmlzU2hvd24gICAgICAgICAgICAgPSBudWxsXHJcbiAgICB0aGlzLm9yaWdpbmFsQm9keVBhZCAgICAgPSBudWxsXHJcbiAgICB0aGlzLnNjcm9sbGJhcldpZHRoICAgICAgPSAwXHJcbiAgICB0aGlzLmlnbm9yZUJhY2tkcm9wQ2xpY2sgPSBmYWxzZVxyXG5cclxuICAgIGlmICh0aGlzLm9wdGlvbnMucmVtb3RlKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgICAuZmluZCgnLm1vZGFsLWNvbnRlbnQnKVxyXG4gICAgICAgIC5sb2FkKHRoaXMub3B0aW9ucy5yZW1vdGUsICQucHJveHkoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKCdsb2FkZWQud3BiYy5tb2RhbCcpXHJcbiAgICAgICAgfSwgdGhpcykpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBNb2RhbC5WRVJTSU9OICA9ICczLjMuNSdcclxuXHJcbiAgTW9kYWwuVFJBTlNJVElPTl9EVVJBVElPTiA9IDMwMFxyXG4gIE1vZGFsLkJBQ0tEUk9QX1RSQU5TSVRJT05fRFVSQVRJT04gPSAxNTBcclxuXHJcbiAgTW9kYWwuREVGQVVMVFMgPSB7XHJcbiAgICBiYWNrZHJvcDogdHJ1ZSxcclxuICAgIGtleWJvYXJkOiB0cnVlLFxyXG4gICAgc2hvdzogdHJ1ZVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uIChfcmVsYXRlZFRhcmdldCkge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNTaG93biA/IHRoaXMuaGlkZSgpIDogdGhpcy5zaG93KF9yZWxhdGVkVGFyZ2V0KVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiAoX3JlbGF0ZWRUYXJnZXQpIHtcclxuICAgIHZhciB0aGF0ID0gdGhpc1xyXG4gICAgdmFyIGUgICAgPSAkLkV2ZW50KCdzaG93LndwYmMubW9kYWwnLCB7IHJlbGF0ZWRUYXJnZXQ6IF9yZWxhdGVkVGFyZ2V0IH0pXHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKGUpXHJcblxyXG4gICAgaWYgKHRoaXMuaXNTaG93biB8fCBlLmlzRGVmYXVsdFByZXZlbnRlZCgpKSByZXR1cm5cclxuXHJcbiAgICB0aGlzLmlzU2hvd24gPSB0cnVlXHJcblxyXG4gICAgdGhpcy5jaGVja1Njcm9sbGJhcigpXHJcbiAgICB0aGlzLnNldFNjcm9sbGJhcigpXHJcbiAgICB0aGlzLiRib2R5LmFkZENsYXNzKCdtb2RhbC1vcGVuJylcclxuXHJcbiAgICB0aGlzLmVzY2FwZSgpXHJcbiAgICB0aGlzLnJlc2l6ZSgpXHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC5vbignY2xpY2suZGlzbWlzcy53cGJjLm1vZGFsJywgJ1tkYXRhLWRpc21pc3M9XCJtb2RhbFwiXScsICQucHJveHkodGhpcy5oaWRlLCB0aGlzKSlcclxuXHJcbiAgICB0aGlzLiRkaWFsb2cub24oJ21vdXNlZG93bi5kaXNtaXNzLndwYmMubW9kYWwnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHRoYXQuJGVsZW1lbnQub25lKCdtb3VzZXVwLmRpc21pc3Mud3BiYy5tb2RhbCcsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgaWYgKCQoZS50YXJnZXQpLmlzKHRoYXQuJGVsZW1lbnQpKSB0aGF0Lmlnbm9yZUJhY2tkcm9wQ2xpY2sgPSB0cnVlXHJcbiAgICAgIH0pXHJcbiAgICB9KVxyXG5cclxuICAgIHRoaXMuYmFja2Ryb3AoZnVuY3Rpb24gKCkge1xyXG4gICAgICB2YXIgdHJhbnNpdGlvbiA9ICQuc3VwcG9ydC50cmFuc2l0aW9uICYmIHRoYXQuJGVsZW1lbnQuaGFzQ2xhc3MoJ2ZhZGUnKVxyXG5cclxuICAgICAgaWYgKCF0aGF0LiRlbGVtZW50LnBhcmVudCgpLmxlbmd0aCkge1xyXG4gICAgICAgIHRoYXQuJGVsZW1lbnQuYXBwZW5kVG8odGhhdC4kYm9keSkgLy8gZG9uJ3QgbW92ZSBtb2RhbHMgZG9tIHBvc2l0aW9uXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoYXQuJGVsZW1lbnRcclxuICAgICAgICAuc2hvdygpXHJcbiAgICAgICAgLnNjcm9sbFRvcCgwKVxyXG5cclxuICAgICAgdGhhdC5hZGp1c3REaWFsb2coKVxyXG5cclxuICAgICAgaWYgKHRyYW5zaXRpb24pIHtcclxuICAgICAgICB0aGF0LiRlbGVtZW50WzBdLm9mZnNldFdpZHRoIC8vIGZvcmNlIHJlZmxvd1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGF0LiRlbGVtZW50LmFkZENsYXNzKCdpbicpXHJcblxyXG4gICAgICB0aGF0LmVuZm9yY2VGb2N1cygpXHJcblxyXG4gICAgICB2YXIgZSA9ICQuRXZlbnQoJ3Nob3duLndwYmMubW9kYWwnLCB7IHJlbGF0ZWRUYXJnZXQ6IF9yZWxhdGVkVGFyZ2V0IH0pXHJcblxyXG4gICAgICB0cmFuc2l0aW9uID9cclxuICAgICAgICB0aGF0LiRkaWFsb2cgLy8gd2FpdCBmb3IgbW9kYWwgdG8gc2xpZGUgaW5cclxuICAgICAgICAgIC5vbmUoJ2JzVHJhbnNpdGlvbkVuZCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhhdC4kZWxlbWVudC50cmlnZ2VyKCdmb2N1cycpLnRyaWdnZXIoZSlcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuZW11bGF0ZVRyYW5zaXRpb25FbmQoTW9kYWwuVFJBTlNJVElPTl9EVVJBVElPTikgOlxyXG4gICAgICAgIHRoYXQuJGVsZW1lbnQudHJpZ2dlcignZm9jdXMnKS50cmlnZ2VyKGUpXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmhpZGUgPSBmdW5jdGlvbiAoZSkge1xyXG4gICAgaWYgKGUpIGUucHJldmVudERlZmF1bHQoKVxyXG5cclxuICAgIGUgPSAkLkV2ZW50KCdoaWRlLndwYmMubW9kYWwnKVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcihlKVxyXG5cclxuICAgIGlmICghdGhpcy5pc1Nob3duIHx8IGUuaXNEZWZhdWx0UHJldmVudGVkKCkpIHJldHVyblxyXG5cclxuICAgIHRoaXMuaXNTaG93biA9IGZhbHNlXHJcblxyXG4gICAgdGhpcy5lc2NhcGUoKVxyXG4gICAgdGhpcy5yZXNpemUoKVxyXG5cclxuICAgICQoZG9jdW1lbnQpLm9mZignZm9jdXNpbi53cGJjLm1vZGFsJylcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5yZW1vdmVDbGFzcygnaW4nKVxyXG4gICAgICAub2ZmKCdjbGljay5kaXNtaXNzLndwYmMubW9kYWwnKVxyXG4gICAgICAub2ZmKCdtb3VzZXVwLmRpc21pc3Mud3BiYy5tb2RhbCcpXHJcblxyXG4gICAgdGhpcy4kZGlhbG9nLm9mZignbW91c2Vkb3duLmRpc21pc3Mud3BiYy5tb2RhbCcpXHJcblxyXG4gICAgJC5zdXBwb3J0LnRyYW5zaXRpb24gJiYgdGhpcy4kZWxlbWVudC5oYXNDbGFzcygnZmFkZScpID9cclxuICAgICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAgIC5vbmUoJ2JzVHJhbnNpdGlvbkVuZCcsICQucHJveHkodGhpcy5oaWRlTW9kYWwsIHRoaXMpKVxyXG4gICAgICAgIC5lbXVsYXRlVHJhbnNpdGlvbkVuZChNb2RhbC5UUkFOU0lUSU9OX0RVUkFUSU9OKSA6XHJcbiAgICAgIHRoaXMuaGlkZU1vZGFsKClcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5lbmZvcmNlRm9jdXMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAkKGRvY3VtZW50KVxyXG4gICAgICAub2ZmKCdmb2N1c2luLndwYmMubW9kYWwnKSAvLyBndWFyZCBhZ2FpbnN0IGluZmluaXRlIGZvY3VzIGxvb3BcclxuICAgICAgLm9uKCdmb2N1c2luLndwYmMubW9kYWwnLCAkLnByb3h5KGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuJGVsZW1lbnRbMF0gIT09IGUudGFyZ2V0ICYmICF0aGlzLiRlbGVtZW50LmhhcyhlLnRhcmdldCkubGVuZ3RoKSB7XHJcbiAgICAgICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2ZvY3VzJylcclxuICAgICAgICB9XHJcbiAgICAgIH0sIHRoaXMpKVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmVzY2FwZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICh0aGlzLmlzU2hvd24gJiYgdGhpcy5vcHRpb25zLmtleWJvYXJkKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ2tleWRvd24uZGlzbWlzcy53cGJjLm1vZGFsJywgJC5wcm94eShmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGUud2hpY2ggPT0gMjcgJiYgdGhpcy5oaWRlKClcclxuICAgICAgfSwgdGhpcykpXHJcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmlzU2hvd24pIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vZmYoJ2tleWRvd24uZGlzbWlzcy53cGJjLm1vZGFsJylcclxuICAgIH1cclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5yZXNpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZiAodGhpcy5pc1Nob3duKSB7XHJcbiAgICAgICQod2luZG93KS5vbigncmVzaXplLndwYmMubW9kYWwnLCAkLnByb3h5KHRoaXMuaGFuZGxlVXBkYXRlLCB0aGlzKSlcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICQod2luZG93KS5vZmYoJ3Jlc2l6ZS53cGJjLm1vZGFsJylcclxuICAgIH1cclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5oaWRlTW9kYWwgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXNcclxuICAgIHRoaXMuJGVsZW1lbnQuaGlkZSgpXHJcbiAgICB0aGlzLmJhY2tkcm9wKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdGhhdC4kYm9keS5yZW1vdmVDbGFzcygnbW9kYWwtb3BlbicpXHJcbiAgICAgIHRoYXQucmVzZXRBZGp1c3RtZW50cygpXHJcbiAgICAgIHRoYXQucmVzZXRTY3JvbGxiYXIoKVxyXG4gICAgICB0aGF0LiRlbGVtZW50LnRyaWdnZXIoJ2hpZGRlbi53cGJjLm1vZGFsJylcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUucmVtb3ZlQmFja2Ryb3AgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLiRiYWNrZHJvcCAmJiB0aGlzLiRiYWNrZHJvcC5yZW1vdmUoKVxyXG4gICAgdGhpcy4kYmFja2Ryb3AgPSBudWxsXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuYmFja2Ryb3AgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgIHZhciB0aGF0ID0gdGhpc1xyXG4gICAgdmFyIGFuaW1hdGUgPSB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdmYWRlJykgPyAnZmFkZScgOiAnJ1xyXG5cclxuICAgIGlmICh0aGlzLmlzU2hvd24gJiYgdGhpcy5vcHRpb25zLmJhY2tkcm9wKSB7XHJcbiAgICAgIHZhciBkb0FuaW1hdGUgPSAkLnN1cHBvcnQudHJhbnNpdGlvbiAmJiBhbmltYXRlXHJcblxyXG4gICAgICB0aGlzLiRiYWNrZHJvcCA9ICQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXHJcbiAgICAgICAgLmFkZENsYXNzKCdtb2RhbC1iYWNrZHJvcCAnICsgYW5pbWF0ZSlcclxuICAgICAgICAuYXBwZW5kVG8odGhpcy4kYm9keSlcclxuXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ2NsaWNrLmRpc21pc3Mud3BiYy5tb2RhbCcsICQucHJveHkoZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBpZiAodGhpcy5pZ25vcmVCYWNrZHJvcENsaWNrKSB7XHJcbiAgICAgICAgICB0aGlzLmlnbm9yZUJhY2tkcm9wQ2xpY2sgPSBmYWxzZVxyXG4gICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChlLnRhcmdldCAhPT0gZS5jdXJyZW50VGFyZ2V0KSByZXR1cm5cclxuICAgICAgICB0aGlzLm9wdGlvbnMuYmFja2Ryb3AgPT0gJ3N0YXRpYydcclxuICAgICAgICAgID8gdGhpcy4kZWxlbWVudFswXS5mb2N1cygpXHJcbiAgICAgICAgICA6IHRoaXMuaGlkZSgpXHJcbiAgICAgIH0sIHRoaXMpKVxyXG5cclxuICAgICAgaWYgKGRvQW5pbWF0ZSkgdGhpcy4kYmFja2Ryb3BbMF0ub2Zmc2V0V2lkdGggLy8gZm9yY2UgcmVmbG93XHJcblxyXG4gICAgICB0aGlzLiRiYWNrZHJvcC5hZGRDbGFzcygnaW4nKVxyXG5cclxuICAgICAgaWYgKCFjYWxsYmFjaykgcmV0dXJuXHJcblxyXG4gICAgICBkb0FuaW1hdGUgP1xyXG4gICAgICAgIHRoaXMuJGJhY2tkcm9wXHJcbiAgICAgICAgICAub25lKCdic1RyYW5zaXRpb25FbmQnLCBjYWxsYmFjaylcclxuICAgICAgICAgIC5lbXVsYXRlVHJhbnNpdGlvbkVuZChNb2RhbC5CQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OKSA6XHJcbiAgICAgICAgY2FsbGJhY2soKVxyXG5cclxuICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNTaG93biAmJiB0aGlzLiRiYWNrZHJvcCkge1xyXG4gICAgICB0aGlzLiRiYWNrZHJvcC5yZW1vdmVDbGFzcygnaW4nKVxyXG5cclxuICAgICAgdmFyIGNhbGxiYWNrUmVtb3ZlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoYXQucmVtb3ZlQmFja2Ryb3AoKVxyXG4gICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKClcclxuICAgICAgfVxyXG4gICAgICAkLnN1cHBvcnQudHJhbnNpdGlvbiAmJiB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdmYWRlJykgP1xyXG4gICAgICAgIHRoaXMuJGJhY2tkcm9wXHJcbiAgICAgICAgICAub25lKCdic1RyYW5zaXRpb25FbmQnLCBjYWxsYmFja1JlbW92ZSlcclxuICAgICAgICAgIC5lbXVsYXRlVHJhbnNpdGlvbkVuZChNb2RhbC5CQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OKSA6XHJcbiAgICAgICAgY2FsbGJhY2tSZW1vdmUoKVxyXG5cclxuICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgY2FsbGJhY2soKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gdGhlc2UgZm9sbG93aW5nIG1ldGhvZHMgYXJlIHVzZWQgdG8gaGFuZGxlIG92ZXJmbG93aW5nIG1vZGFsc1xyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuaGFuZGxlVXBkYXRlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5hZGp1c3REaWFsb2coKVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmFkanVzdERpYWxvZyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBtb2RhbElzT3ZlcmZsb3dpbmcgPSB0aGlzLiRlbGVtZW50WzBdLnNjcm9sbEhlaWdodCA+IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHRcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmNzcyh7XHJcbiAgICAgIHBhZGRpbmdMZWZ0OiAgIXRoaXMuYm9keUlzT3ZlcmZsb3dpbmcgJiYgbW9kYWxJc092ZXJmbG93aW5nID8gdGhpcy5zY3JvbGxiYXJXaWR0aCA6ICcnLFxyXG4gICAgICBwYWRkaW5nUmlnaHQ6IHRoaXMuYm9keUlzT3ZlcmZsb3dpbmcgJiYgIW1vZGFsSXNPdmVyZmxvd2luZyA/IHRoaXMuc2Nyb2xsYmFyV2lkdGggOiAnJ1xyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5yZXNldEFkanVzdG1lbnRzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5jc3Moe1xyXG4gICAgICBwYWRkaW5nTGVmdDogJycsXHJcbiAgICAgIHBhZGRpbmdSaWdodDogJydcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuY2hlY2tTY3JvbGxiYXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZnVsbFdpbmRvd1dpZHRoID0gd2luZG93LmlubmVyV2lkdGhcclxuICAgIGlmICghZnVsbFdpbmRvd1dpZHRoKSB7IC8vIHdvcmthcm91bmQgZm9yIG1pc3Npbmcgd2luZG93LmlubmVyV2lkdGggaW4gSUU4XHJcbiAgICAgIHZhciBkb2N1bWVudEVsZW1lbnRSZWN0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXHJcbiAgICAgIGZ1bGxXaW5kb3dXaWR0aCA9IGRvY3VtZW50RWxlbWVudFJlY3QucmlnaHQgLSBNYXRoLmFicyhkb2N1bWVudEVsZW1lbnRSZWN0LmxlZnQpXHJcbiAgICB9XHJcbiAgICB0aGlzLmJvZHlJc092ZXJmbG93aW5nID0gZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aCA8IGZ1bGxXaW5kb3dXaWR0aFxyXG4gICAgdGhpcy5zY3JvbGxiYXJXaWR0aCA9IHRoaXMubWVhc3VyZVNjcm9sbGJhcigpXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuc2V0U2Nyb2xsYmFyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGJvZHlQYWQgPSBwYXJzZUludCgodGhpcy4kYm9keS5jc3MoJ3BhZGRpbmctcmlnaHQnKSB8fCAwKSwgMTApXHJcbiAgICB0aGlzLm9yaWdpbmFsQm9keVBhZCA9IGRvY3VtZW50LmJvZHkuc3R5bGUucGFkZGluZ1JpZ2h0IHx8ICcnXHJcbiAgICBpZiAodGhpcy5ib2R5SXNPdmVyZmxvd2luZykgdGhpcy4kYm9keS5jc3MoJ3BhZGRpbmctcmlnaHQnLCBib2R5UGFkICsgdGhpcy5zY3JvbGxiYXJXaWR0aClcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5yZXNldFNjcm9sbGJhciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuJGJvZHkuY3NzKCdwYWRkaW5nLXJpZ2h0JywgdGhpcy5vcmlnaW5hbEJvZHlQYWQpXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUubWVhc3VyZVNjcm9sbGJhciA9IGZ1bmN0aW9uICgpIHsgLy8gdGh4IHdhbHNoXHJcbiAgICB2YXIgc2Nyb2xsRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcclxuICAgIHNjcm9sbERpdi5jbGFzc05hbWUgPSAnbW9kYWwtc2Nyb2xsYmFyLW1lYXN1cmUnXHJcbiAgICB0aGlzLiRib2R5LmFwcGVuZChzY3JvbGxEaXYpXHJcbiAgICB2YXIgc2Nyb2xsYmFyV2lkdGggPSBzY3JvbGxEaXYub2Zmc2V0V2lkdGggLSBzY3JvbGxEaXYuY2xpZW50V2lkdGhcclxuICAgIHRoaXMuJGJvZHlbMF0ucmVtb3ZlQ2hpbGQoc2Nyb2xsRGl2KVxyXG4gICAgcmV0dXJuIHNjcm9sbGJhcldpZHRoXHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gTU9EQUwgUExVR0lOIERFRklOSVRJT05cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBmdW5jdGlvbiBQbHVnaW4ob3B0aW9uLCBfcmVsYXRlZFRhcmdldCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHZhciAkdGhpcyAgID0gJCh0aGlzKVxyXG4gICAgICB2YXIgZGF0YSAgICA9ICR0aGlzLmRhdGEoJ3dwYmMubW9kYWwnKVxyXG4gICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBNb2RhbC5ERUZBVUxUUywgJHRoaXMuZGF0YSgpLCB0eXBlb2Ygb3B0aW9uID09ICdvYmplY3QnICYmIG9wdGlvbilcclxuXHJcbiAgICAgIGlmICghZGF0YSkgJHRoaXMuZGF0YSgnd3BiYy5tb2RhbCcsIChkYXRhID0gbmV3IE1vZGFsKHRoaXMsIG9wdGlvbnMpKSlcclxuICAgICAgaWYgKHR5cGVvZiBvcHRpb24gPT0gJ3N0cmluZycpIGRhdGFbb3B0aW9uXShfcmVsYXRlZFRhcmdldClcclxuICAgICAgZWxzZSBpZiAob3B0aW9ucy5zaG93KSBkYXRhLnNob3coX3JlbGF0ZWRUYXJnZXQpXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgdmFyIG9sZCA9ICQuZm4ud3BiY19teV9tb2RhbFxyXG5cclxuICAkLmZuLndwYmNfbXlfbW9kYWwgICAgICAgICAgICAgPSBQbHVnaW5cclxuICAkLmZuLndwYmNfbXlfbW9kYWwuQ29uc3RydWN0b3IgPSBNb2RhbFxyXG5cclxuXHJcbiAgLy8gTU9EQUwgTk8gQ09ORkxJQ1RcclxuICAvLyA9PT09PT09PT09PT09PT09PVxyXG5cclxuICAkLmZuLndwYmNfbXlfbW9kYWwubm9Db25mbGljdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICQuZm4ud3BiY19teV9tb2RhbCA9IG9sZFxyXG4gICAgcmV0dXJuIHRoaXNcclxuICB9XHJcblxyXG5cclxuICAvLyBNT0RBTCBEQVRBLUFQSVxyXG4gIC8vID09PT09PT09PT09PT09XHJcblxyXG4gICQoZG9jdW1lbnQpLm9uKCdjbGljay53cGJjLm1vZGFsLmRhdGEtYXBpJywgJ1tkYXRhLXRvZ2dsZT1cIndwYmNfbXlfbW9kYWxcIl0nLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgdmFyICR0aGlzICAgPSAkKHRoaXMpXHJcbiAgICB2YXIgaHJlZiAgICA9ICR0aGlzLmF0dHIoJ2hyZWYnKVxyXG4gICAgdmFyICR0YXJnZXQgPSAkKCR0aGlzLmF0dHIoJ2RhdGEtdGFyZ2V0JykgfHwgKGhyZWYgJiYgaHJlZi5yZXBsYWNlKC8uKig/PSNbXlxcc10rJCkvLCAnJykpKSAvLyBzdHJpcCBmb3IgaWU3XHJcbiAgICB2YXIgb3B0aW9uICA9ICR0YXJnZXQuZGF0YSgnd3BiYy5tb2RhbCcpID8gJ3RvZ2dsZScgOiAkLmV4dGVuZCh7IHJlbW90ZTogIS8jLy50ZXN0KGhyZWYpICYmIGhyZWYgfSwgJHRhcmdldC5kYXRhKCksICR0aGlzLmRhdGEoKSlcclxuXHJcbiAgICBpZiAoJHRoaXMuaXMoJ2EnKSkgZS5wcmV2ZW50RGVmYXVsdCgpXHJcblxyXG4gICAgJHRhcmdldC5vbmUoJ3Nob3cud3BiYy5tb2RhbCcsIGZ1bmN0aW9uIChzaG93RXZlbnQpIHtcclxuICAgICAgaWYgKHNob3dFdmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkgcmV0dXJuIC8vIG9ubHkgcmVnaXN0ZXIgZm9jdXMgcmVzdG9yZXIgaWYgbW9kYWwgd2lsbCBhY3R1YWxseSBnZXQgc2hvd25cclxuICAgICAgJHRhcmdldC5vbmUoJ2hpZGRlbi53cGJjLm1vZGFsJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICR0aGlzLmlzKCc6dmlzaWJsZScpICYmICR0aGlzLnRyaWdnZXIoJ2ZvY3VzJylcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgICBQbHVnaW4uY2FsbCgkdGFyZ2V0LCBvcHRpb24sIHRoaXMpXHJcbiAgfSlcclxuXHJcbn0oalF1ZXJ5KTtcclxuXHJcblxyXG4rZnVuY3Rpb24gKCQpIHtcclxuICAndXNlIHN0cmljdCc7XHJcblxyXG4gIC8vIERST1BET1dOIENMQVNTIERFRklOSVRJT05cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIHZhciBiYWNrZHJvcCA9ICcuZHJvcGRvd24tYmFja2Ryb3AnXHJcbiAgdmFyIHRvZ2dsZSAgID0gJ1tkYXRhLXRvZ2dsZT1cIndwYmNfZHJvcGRvd25cIl0nXHJcbiAgdmFyIERyb3Bkb3duID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcclxuICAgICQoZWxlbWVudCkub24oJ2NsaWNrLndwYmMuZHJvcGRvd24nLCB0aGlzLnRvZ2dsZSlcclxuICB9XHJcblxyXG4gIERyb3Bkb3duLlZFUlNJT04gPSAnMy4zLjUnXHJcblxyXG4gIGZ1bmN0aW9uIGdldFBhcmVudCgkdGhpcykge1xyXG4gICAgdmFyIHNlbGVjdG9yID0gJHRoaXMuYXR0cignZGF0YS10YXJnZXQnKVxyXG5cclxuICAgIGlmICghc2VsZWN0b3IpIHtcclxuICAgICAgc2VsZWN0b3IgPSAkdGhpcy5hdHRyKCdocmVmJylcclxuICAgICAgc2VsZWN0b3IgPSBzZWxlY3RvciAmJiAvI1tBLVphLXpdLy50ZXN0KHNlbGVjdG9yKSAmJiBzZWxlY3Rvci5yZXBsYWNlKC8uKig/PSNbXlxcc10qJCkvLCAnJykgLy8gc3RyaXAgZm9yIGllN1xyXG4gICAgfVxyXG5cclxuICAgIHZhciAkcGFyZW50ID0gc2VsZWN0b3IgJiYgJChzZWxlY3RvcilcclxuXHJcbiAgICByZXR1cm4gJHBhcmVudCAmJiAkcGFyZW50Lmxlbmd0aCA/ICRwYXJlbnQgOiAkdGhpcy5wYXJlbnQoKVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gY2xlYXJNZW51cyhlKSB7XHJcbiAgICBpZiAoZSAmJiBlLndoaWNoID09PSAzKSByZXR1cm5cclxuICAgICQoYmFja2Ryb3ApLnJlbW92ZSgpXHJcbiAgICAkKHRvZ2dsZSkuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHZhciAkdGhpcyAgICAgICAgID0gJCh0aGlzKVxyXG4gICAgICB2YXIgJHBhcmVudCAgICAgICA9IGdldFBhcmVudCgkdGhpcylcclxuICAgICAgdmFyIHJlbGF0ZWRUYXJnZXQgPSB7IHJlbGF0ZWRUYXJnZXQ6IHRoaXMgfVxyXG5cclxuICAgICAgaWYgKCEkcGFyZW50Lmhhc0NsYXNzKCdvcGVuJykpIHJldHVyblxyXG5cclxuICAgICAgaWYgKGUgJiYgZS50eXBlID09ICdjbGljaycgJiYgL2lucHV0fHRleHRhcmVhL2kudGVzdChlLnRhcmdldC50YWdOYW1lKSAmJiAkLmNvbnRhaW5zKCRwYXJlbnRbMF0sIGUudGFyZ2V0KSkgcmV0dXJuXHJcblxyXG4gICAgICAkcGFyZW50LnRyaWdnZXIoZSA9ICQuRXZlbnQoJ2hpZGUud3BiYy5kcm9wZG93bicsIHJlbGF0ZWRUYXJnZXQpKVxyXG5cclxuICAgICAgaWYgKGUuaXNEZWZhdWx0UHJldmVudGVkKCkpIHJldHVyblxyXG5cclxuICAgICAgJHRoaXMuYXR0cignYXJpYS1leHBhbmRlZCcsICdmYWxzZScpXHJcbiAgICAgICRwYXJlbnQucmVtb3ZlQ2xhc3MoJ29wZW4nKS50cmlnZ2VyKCdoaWRkZW4ud3BiYy5kcm9wZG93bicsIHJlbGF0ZWRUYXJnZXQpXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgRHJvcGRvd24ucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uIChlKSB7XHJcbiAgICB2YXIgJHRoaXMgPSAkKHRoaXMpXHJcblxyXG4gICAgaWYgKCR0aGlzLmlzKCcuZGlzYWJsZWQsIDpkaXNhYmxlZCcpKSByZXR1cm5cclxuXHJcbiAgICB2YXIgJHBhcmVudCAgPSBnZXRQYXJlbnQoJHRoaXMpXHJcbiAgICB2YXIgaXNBY3RpdmUgPSAkcGFyZW50Lmhhc0NsYXNzKCdvcGVuJylcclxuXHJcbiAgICBjbGVhck1lbnVzKClcclxuXHJcbiAgICBpZiAoIWlzQWN0aXZlKSB7XHJcbiAgICAgIGlmICgnb250b3VjaHN0YXJ0JyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgISRwYXJlbnQuY2xvc2VzdCgnLm5hdmJhci1uYXYnKS5sZW5ndGgpIHtcclxuICAgICAgICAvLyBpZiBtb2JpbGUgd2UgdXNlIGEgYmFja2Ryb3AgYmVjYXVzZSBjbGljayBldmVudHMgZG9uJ3QgZGVsZWdhdGVcclxuICAgICAgICAkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdkcm9wZG93bi1iYWNrZHJvcCcpXHJcbiAgICAgICAgICAuaW5zZXJ0QWZ0ZXIoJCh0aGlzKSlcclxuICAgICAgICAgIC5vbignY2xpY2snLCBjbGVhck1lbnVzKVxyXG4gICAgICB9XHJcblxyXG4gICAgICB2YXIgcmVsYXRlZFRhcmdldCA9IHsgcmVsYXRlZFRhcmdldDogdGhpcyB9XHJcbiAgICAgICRwYXJlbnQudHJpZ2dlcihlID0gJC5FdmVudCgnc2hvdy53cGJjLmRyb3Bkb3duJywgcmVsYXRlZFRhcmdldCkpXHJcblxyXG4gICAgICBpZiAoZS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkgcmV0dXJuXHJcblxyXG4gICAgICAkdGhpc1xyXG4gICAgICAgIC50cmlnZ2VyKCdmb2N1cycpXHJcbiAgICAgICAgLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpXHJcblxyXG4gICAgICAkcGFyZW50XHJcbiAgICAgICAgLnRvZ2dsZUNsYXNzKCdvcGVuJylcclxuICAgICAgICAudHJpZ2dlcignc2hvd24ud3BiYy5kcm9wZG93bicsIHJlbGF0ZWRUYXJnZXQpXHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlXHJcbiAgfVxyXG5cclxuICBEcm9wZG93bi5wcm90b3R5cGUua2V5ZG93biA9IGZ1bmN0aW9uIChlKSB7XHJcbiAgICBpZiAoIS8oMzh8NDB8Mjd8MzIpLy50ZXN0KGUud2hpY2gpIHx8IC9pbnB1dHx0ZXh0YXJlYS9pLnRlc3QoZS50YXJnZXQudGFnTmFtZSkpIHJldHVyblxyXG5cclxuICAgIHZhciAkdGhpcyA9ICQodGhpcylcclxuXHJcbiAgICBlLnByZXZlbnREZWZhdWx0KClcclxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcclxuXHJcbiAgICBpZiAoJHRoaXMuaXMoJy5kaXNhYmxlZCwgOmRpc2FibGVkJykpIHJldHVyblxyXG5cclxuICAgIHZhciAkcGFyZW50ICA9IGdldFBhcmVudCgkdGhpcylcclxuICAgIHZhciBpc0FjdGl2ZSA9ICRwYXJlbnQuaGFzQ2xhc3MoJ29wZW4nKVxyXG5cclxuICAgIGlmICghaXNBY3RpdmUgJiYgZS53aGljaCAhPSAyNyB8fCBpc0FjdGl2ZSAmJiBlLndoaWNoID09IDI3KSB7XHJcbiAgICAgIGlmIChlLndoaWNoID09IDI3KSAkcGFyZW50LmZpbmQodG9nZ2xlKS50cmlnZ2VyKCdmb2N1cycpXHJcbiAgICAgIHJldHVybiAkdGhpcy50cmlnZ2VyKCdjbGljaycpXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGRlc2MgPSAnIGxpOm5vdCguZGlzYWJsZWQpOnZpc2libGUgYSdcclxuICAgIHZhciAkaXRlbXMgPSAkcGFyZW50LmZpbmQoJy5kcm9wZG93bi1tZW51JyArIGRlc2MgKyAnLC51aV9kcm9wZG93bl9tZW51JyArIGRlc2MpXHJcblxyXG4gICAgaWYgKCEkaXRlbXMubGVuZ3RoKSByZXR1cm5cclxuXHJcbiAgICB2YXIgaW5kZXggPSAkaXRlbXMuaW5kZXgoZS50YXJnZXQpXHJcblxyXG4gICAgaWYgKGUud2hpY2ggPT0gMzggJiYgaW5kZXggPiAwKSAgICAgICAgICAgICAgICAgaW5kZXgtLSAgICAgICAgIC8vIHVwXHJcbiAgICBpZiAoZS53aGljaCA9PSA0MCAmJiBpbmRleCA8ICRpdGVtcy5sZW5ndGggLSAxKSBpbmRleCsrICAgICAgICAgLy8gZG93blxyXG4gICAgaWYgKCF+aW5kZXgpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSAwXHJcblxyXG4gICAgJGl0ZW1zLmVxKGluZGV4KS50cmlnZ2VyKCdmb2N1cycpXHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gRFJPUERPV04gUExVR0lOIERFRklOSVRJT05cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBmdW5jdGlvbiBQbHVnaW4ob3B0aW9uKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdmFyICR0aGlzID0gJCh0aGlzKVxyXG4gICAgICB2YXIgZGF0YSAgPSAkdGhpcy5kYXRhKCd3cGJjLmRyb3Bkb3duJylcclxuXHJcbiAgICAgIGlmICghZGF0YSkgJHRoaXMuZGF0YSgnd3BiYy5kcm9wZG93bicsIChkYXRhID0gbmV3IERyb3Bkb3duKHRoaXMpKSlcclxuICAgICAgaWYgKHR5cGVvZiBvcHRpb24gPT0gJ3N0cmluZycpIGRhdGFbb3B0aW9uXS5jYWxsKCR0aGlzKVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHZhciBvbGQgPSAkLmZuLndwYmNfZHJvcGRvd25cclxuXHJcbiAgJC5mbi53cGJjX2Ryb3Bkb3duICAgICAgICAgICAgID0gUGx1Z2luXHJcbiAgJC5mbi53cGJjX2Ryb3Bkb3duLkNvbnN0cnVjdG9yID0gRHJvcGRvd25cclxuXHJcblxyXG4gIC8vIERST1BET1dOIE5PIENPTkZMSUNUXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgJC5mbi53cGJjX2Ryb3Bkb3duLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAkLmZuLndwYmNfZHJvcGRvd24gPSBvbGRcclxuICAgIHJldHVybiB0aGlzXHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gQVBQTFkgVE8gU1RBTkRBUkQgRFJPUERPV04gRUxFTUVOVFNcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAkKGRvY3VtZW50KVxyXG4gICAgLm9uKCdjbGljay53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgY2xlYXJNZW51cylcclxuICAgIC5vbignY2xpY2sud3BiYy5kcm9wZG93bi5kYXRhLWFwaScsICcuZHJvcGRvd24gZm9ybScsIGZ1bmN0aW9uIChlKSB7IGUuc3RvcFByb3BhZ2F0aW9uKCkgfSlcclxuICAgIC5vbignY2xpY2sud3BiYy5kcm9wZG93bi5kYXRhLWFwaScsIHRvZ2dsZSwgRHJvcGRvd24ucHJvdG90eXBlLnRvZ2dsZSlcclxuICAgIC5vbigna2V5ZG93bi53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgdG9nZ2xlLCBEcm9wZG93bi5wcm90b3R5cGUua2V5ZG93bilcclxuICAgIC5vbigna2V5ZG93bi53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgJy5kcm9wZG93bi1tZW51JywgRHJvcGRvd24ucHJvdG90eXBlLmtleWRvd24pXHJcbiAgICAub24oJ2tleWRvd24ud3BiYy5kcm9wZG93bi5kYXRhLWFwaScsICcudWlfZHJvcGRvd25fbWVudScsIERyb3Bkb3duLnByb3RvdHlwZS5rZXlkb3duKVxyXG5cclxufShqUXVlcnkpO1xyXG4iXSwibWFwcGluZ3MiOiI7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxPQUFPQSxNQUFNLEtBQUssV0FBVyxFQUFFO0VBQ2pDLE1BQU0sSUFBSUMsS0FBSyxDQUFDLHlDQUF5QyxDQUFDO0FBQzVEO0FBQ0EsQ0FBQyxVQUFVQyxDQUFDLEVBQUU7RUFDWixZQUFZOztFQUNaLElBQUlDLE9BQU8sR0FBR0QsQ0FBQyxDQUFDRSxFQUFFLENBQUNDLE1BQU0sQ0FBQ0MsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDQSxLQUFLLENBQUMsR0FBRyxDQUFDO0VBQ2xELElBQUtILE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUlBLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQU1BLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUlBLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUlBLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFFLEVBQUU7SUFDaEcsTUFBTSxJQUFJRixLQUFLLENBQUMsaUVB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
