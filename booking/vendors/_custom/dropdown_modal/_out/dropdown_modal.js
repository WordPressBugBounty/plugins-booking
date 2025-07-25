"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVuZG9ycy9fY3VzdG9tL2Ryb3Bkb3duX21vZGFsL19vdXQvZHJvcGRvd25fbW9kYWwuanMiLCJuYW1lcyI6WyJqUXVlcnkiLCJFcnJvciIsIiQiLCJ2ZXJzaW9uIiwiZm4iLCJqcXVlcnkiLCJzcGxpdCIsIk1vZGFsIiwiZWxlbWVudCIsIm9wdGlvbnMiLCIkYm9keSIsImRvY3VtZW50IiwiYm9keSIsIiRlbGVtZW50IiwiJGRpYWxvZyIsImZpbmQiLCIkYmFja2Ryb3AiLCJpc1Nob3duIiwib3JpZ2luYWxCb2R5UGFkIiwic2Nyb2xsYmFyV2lkdGgiLCJpZ25vcmVCYWNrZHJvcENsaWNrIiwicmVtb3RlIiwibG9hZCIsInByb3h5IiwidHJpZ2dlciIsIlZFUlNJT04iLCJUUkFOU0lUSU9OX0RVUkFUSU9OIiwiQkFDS0RST1BfVFJBTlNJVElPTl9EVVJBVElPTiIsIkRFRkFVTFRTIiwiYmFja2Ryb3AiLCJrZXlib2FyZCIsInNob3ciLCJwcm90b3R5cGUiLCJ0b2dnbGUiLCJfcmVsYXRlZFRhcmdldCIsImhpZGUiLCJ0aGF0IiwiZSIsIkV2ZW50IiwicmVsYXRlZFRhcmdldCIsImlzRGVmYXVsdFByZXZlbnRlZCIsImNoZWNrU2Nyb2xsYmFyIiwic2V0U2Nyb2xsYmFyIiwiYWRkQ2xhc3MiLCJlc2NhcGUiLCJyZXNpemUiLCJvbiIsIm9uZSIsInRhcmdldCIsImlzIiwidHJhbnNpdGlvbiIsInN1cHBvcnQiLCJoYXNDbGFzcyIsInBhcmVudCIsImxlbmd0aCIsImFwcGVuZFRvIiwic2Nyb2xsVG9wIiwiYWRqdXN0RGlhbG9nIiwib2Zmc2V0V2lkdGgiLCJlbmZvcmNlRm9jdXMiLCJlbXVsYXRlVHJhbnNpdGlvbkVuZCIsInByZXZlbnREZWZhdWx0Iiwib2ZmIiwicmVtb3ZlQ2xhc3MiLCJoaWRlTW9kYWwiLCJoYXMiLCJ3aGljaCIsIndpbmRvdyIsImhhbmRsZVVwZGF0ZSIsInJlc2V0QWRqdXN0bWVudHMiLCJyZXNldFNjcm9sbGJhciIsInJlbW92ZUJhY2tkcm9wIiwicmVtb3ZlIiwiY2FsbGJhY2siLCJhbmltYXRlIiwiZG9BbmltYXRlIiwiY3JlYXRlRWxlbWVudCIsImN1cnJlbnRUYXJnZXQiLCJmb2N1cyIsImNhbGxiYWNrUmVtb3ZlIiwibW9kYWxJc092ZXJmbG93aW5nIiwic2Nyb2xsSGVpZ2h0IiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50SGVpZ2h0IiwiY3NzIiwicGFkZGluZ0xlZnQiLCJib2R5SXNPdmVyZmxvd2luZyIsInBhZGRpbmdSaWdodCIsImZ1bGxXaW5kb3dXaWR0aCIsImlubmVyV2lkdGgiLCJkb2N1bWVudEVsZW1lbnRSZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwicmlnaHQiLCJNYXRoIiwiYWJzIiwibGVmdCIsImNsaWVudFdpZHRoIiwibWVhc3VyZVNjcm9sbGJhciIsImJvZHlQYWQiLCJwYXJzZUludCIsInN0eWxlIiwic2Nyb2xsRGl2IiwiY2xhc3NOYW1lIiwiYXBwZW5kIiwicmVtb3ZlQ2hpbGQiLCJQbHVnaW4iLCJvcHRpb24iLCJlYWNoIiwiJHRoaXMiLCJkYXRhIiwiZXh0ZW5kIiwiX3R5cGVvZiIsIm9sZCIsIndwYmNfbXlfbW9kYWwiLCJDb25zdHJ1Y3RvciIsIm5vQ29uZmxpY3QiLCJocmVmIiwiYXR0ciIsIiR0YXJnZXQiLCJyZXBsYWNlIiwidGVzdCIsInNob3dFdmVudCIsImNhbGwiLCJEcm9wZG93biIsImdldFBhcmVudCIsInNlbGVjdG9yIiwiJHBhcmVudCIsImNsZWFyTWVudXMiLCJ0eXBlIiwidGFnTmFtZSIsImNvbnRhaW5zIiwiaXNBY3RpdmUiLCJjbG9zZXN0IiwiaW5zZXJ0QWZ0ZXIiLCJ0b2dnbGVDbGFzcyIsImtleWRvd24iLCJzdG9wUHJvcGFnYXRpb24iLCJkZXNjIiwiJGl0ZW1zIiwiaW5kZXgiLCJlcSIsIndwYmNfZHJvcGRvd24iXSwic291cmNlcyI6WyJ2ZW5kb3JzL19jdXN0b20vZHJvcGRvd25fbW9kYWwvX3NyYy9kcm9wZG93bl9tb2RhbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcclxuICogR2VuZXJhdGVkIHVzaW5nIHRoZSBCb290c3RyYXAgQ3VzdG9taXplciAoaHR0cDovL2dldGJvb3RzdHJhcC5jb20vY3VzdG9taXplLz9pZD1mNGI0YzljYjg1ZGY3NTdjYTA4YylcclxuICogQ29uZmlnIHNhdmVkIHRvIGNvbmZpZy5qc29uIGFuZCBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9mNGI0YzljYjg1ZGY3NTdjYTA4Y1xyXG4gKi9cclxuaWYgKHR5cGVvZiBqUXVlcnkgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgdGhyb3cgbmV3IEVycm9yKCdCb290c3RyYXBcXCdzIEphdmFTY3JpcHQgcmVxdWlyZXMgalF1ZXJ5JylcclxufVxyXG4rZnVuY3Rpb24gKCQpIHtcclxuICAndXNlIHN0cmljdCc7XHJcbiAgdmFyIHZlcnNpb24gPSAkLmZuLmpxdWVyeS5zcGxpdCgnICcpWzBdLnNwbGl0KCcuJylcclxuICBpZiAoKHZlcnNpb25bMF0gPCAyICYmIHZlcnNpb25bMV0gPCA5KSB8fCAodmVyc2lvblswXSA9PSAxICYmIHZlcnNpb25bMV0gPT0gOSAmJiB2ZXJzaW9uWzJdIDwgMSkpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcignQm9vdHN0cmFwXFwncyBKYXZhU2NyaXB0IHJlcXVpcmVzIGpRdWVyeSB2ZXJzaW9uIDEuOS4xIG9yIGhpZ2hlcicpXHJcbiAgfVxyXG59KGpRdWVyeSk7XHJcblxyXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogQm9vdHN0cmFwOiBtb2RhbC5qcyB2My4zLjVcclxuICogaHR0cDovL2dldGJvb3RzdHJhcC5jb20vamF2YXNjcmlwdC8jbW9kYWxzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBDb3B5cmlnaHQgMjAxMS0yMDE1IFR3aXR0ZXIsIEluYy5cclxuICogTGljZW5zZWQgdW5kZXIgTUlUIChodHRwczovL2dpdGh1Yi5jb20vdHdicy9ib290c3RyYXAvYmxvYi9tYXN0ZXIvTElDRU5TRSlcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5cclxuK2Z1bmN0aW9uICgkKSB7XHJcbiAgJ3VzZSBzdHJpY3QnO1xyXG5cclxuICAvLyBNT0RBTCBDTEFTUyBERUZJTklUSU9OXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICB2YXIgTW9kYWwgPSBmdW5jdGlvbiAoZWxlbWVudCwgb3B0aW9ucykge1xyXG4gICAgdGhpcy5vcHRpb25zICAgICAgICAgICAgID0gb3B0aW9uc1xyXG4gICAgdGhpcy4kYm9keSAgICAgICAgICAgICAgID0gJChkb2N1bWVudC5ib2R5KVxyXG4gICAgdGhpcy4kZWxlbWVudCAgICAgICAgICAgID0gJChlbGVtZW50KVxyXG4gICAgdGhpcy4kZGlhbG9nICAgICAgICAgICAgID0gdGhpcy4kZWxlbWVudC5maW5kKCcubW9kYWwtZGlhbG9nJylcclxuICAgIHRoaXMuJGJhY2tkcm9wICAgICAgICAgICA9IG51bGxcclxuICAgIHRoaXMuaXNTaG93biAgICAgICAgICAgICA9IG51bGxcclxuICAgIHRoaXMub3JpZ2luYWxCb2R5UGFkICAgICA9IG51bGxcclxuICAgIHRoaXMuc2Nyb2xsYmFyV2lkdGggICAgICA9IDBcclxuICAgIHRoaXMuaWdub3JlQmFja2Ryb3BDbGljayA9IGZhbHNlXHJcblxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5yZW1vdGUpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAgIC5maW5kKCcubW9kYWwtY29udGVudCcpXHJcbiAgICAgICAgLmxvYWQodGhpcy5vcHRpb25zLnJlbW90ZSwgJC5wcm94eShmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2xvYWRlZC53cGJjLm1vZGFsJylcclxuICAgICAgICB9LCB0aGlzKSlcclxuICAgIH1cclxuICB9XHJcblxyXG4gIE1vZGFsLlZFUlNJT04gID0gJzMuMy41J1xyXG5cclxuICBNb2RhbC5UUkFOU0lUSU9OX0RVUkFUSU9OID0gMzAwXHJcbiAgTW9kYWwuQkFDS0RST1BfVFJBTlNJVElPTl9EVVJBVElPTiA9IDE1MFxyXG5cclxuICBNb2RhbC5ERUZBVUxUUyA9IHtcclxuICAgIGJhY2tkcm9wOiB0cnVlLFxyXG4gICAga2V5Ym9hcmQ6IHRydWUsXHJcbiAgICBzaG93OiB0cnVlXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUudG9nZ2xlID0gZnVuY3Rpb24gKF9yZWxhdGVkVGFyZ2V0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5pc1Nob3duID8gdGhpcy5oaWRlKCkgOiB0aGlzLnNob3coX3JlbGF0ZWRUYXJnZXQpXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuc2hvdyA9IGZ1bmN0aW9uIChfcmVsYXRlZFRhcmdldCkge1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzXHJcbiAgICB2YXIgZSAgICA9ICQuRXZlbnQoJ3Nob3cud3BiYy5tb2RhbCcsIHsgcmVsYXRlZFRhcmdldDogX3JlbGF0ZWRUYXJnZXQgfSlcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoZSlcclxuXHJcbiAgICBpZiAodGhpcy5pc1Nob3duIHx8IGUuaXNEZWZhdWx0UHJldmVudGVkKCkpIHJldHVyblxyXG5cclxuICAgIHRoaXMuaXNTaG93biA9IHRydWVcclxuXHJcbiAgICB0aGlzLmNoZWNrU2Nyb2xsYmFyKClcclxuICAgIHRoaXMuc2V0U2Nyb2xsYmFyKClcclxuICAgIHRoaXMuJGJvZHkuYWRkQ2xhc3MoJ21vZGFsLW9wZW4nKVxyXG5cclxuICAgIHRoaXMuZXNjYXBlKClcclxuICAgIHRoaXMucmVzaXplKClcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50Lm9uKCdjbGljay5kaXNtaXNzLndwYmMubW9kYWwnLCAnW2RhdGEtZGlzbWlzcz1cIm1vZGFsXCJdJywgJC5wcm94eSh0aGlzLmhpZGUsIHRoaXMpKVxyXG5cclxuICAgIHRoaXMuJGRpYWxvZy5vbignbW91c2Vkb3duLmRpc21pc3Mud3BiYy5tb2RhbCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgdGhhdC4kZWxlbWVudC5vbmUoJ21vdXNldXAuZGlzbWlzcy53cGJjLm1vZGFsJywgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBpZiAoJChlLnRhcmdldCkuaXModGhhdC4kZWxlbWVudCkpIHRoYXQuaWdub3JlQmFja2Ryb3BDbGljayA9IHRydWVcclxuICAgICAgfSlcclxuICAgIH0pXHJcblxyXG4gICAgdGhpcy5iYWNrZHJvcChmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHZhciB0cmFuc2l0aW9uID0gJC5zdXBwb3J0LnRyYW5zaXRpb24gJiYgdGhhdC4kZWxlbWVudC5oYXNDbGFzcygnZmFkZScpXHJcblxyXG4gICAgICBpZiAoIXRoYXQuJGVsZW1lbnQucGFyZW50KCkubGVuZ3RoKSB7XHJcbiAgICAgICAgdGhhdC4kZWxlbWVudC5hcHBlbmRUbyh0aGF0LiRib2R5KSAvLyBkb24ndCBtb3ZlIG1vZGFscyBkb20gcG9zaXRpb25cclxuICAgICAgfVxyXG5cclxuICAgICAgdGhhdC4kZWxlbWVudFxyXG4gICAgICAgIC5zaG93KClcclxuICAgICAgICAuc2Nyb2xsVG9wKDApXHJcblxyXG4gICAgICB0aGF0LmFkanVzdERpYWxvZygpXHJcblxyXG4gICAgICBpZiAodHJhbnNpdGlvbikge1xyXG4gICAgICAgIHRoYXQuJGVsZW1lbnRbMF0ub2Zmc2V0V2lkdGggLy8gZm9yY2UgcmVmbG93XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoYXQuJGVsZW1lbnQuYWRkQ2xhc3MoJ2luJylcclxuXHJcbiAgICAgIHRoYXQuZW5mb3JjZUZvY3VzKClcclxuXHJcbiAgICAgIHZhciBlID0gJC5FdmVudCgnc2hvd24ud3BiYy5tb2RhbCcsIHsgcmVsYXRlZFRhcmdldDogX3JlbGF0ZWRUYXJnZXQgfSlcclxuXHJcbiAgICAgIHRyYW5zaXRpb24gP1xyXG4gICAgICAgIHRoYXQuJGRpYWxvZyAvLyB3YWl0IGZvciBtb2RhbCB0byBzbGlkZSBpblxyXG4gICAgICAgICAgLm9uZSgnYnNUcmFuc2l0aW9uRW5kJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGF0LiRlbGVtZW50LnRyaWdnZXIoJ2ZvY3VzJykudHJpZ2dlcihlKVxyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC5lbXVsYXRlVHJhbnNpdGlvbkVuZChNb2RhbC5UUkFOU0lUSU9OX0RVUkFUSU9OKSA6XHJcbiAgICAgICAgdGhhdC4kZWxlbWVudC50cmlnZ2VyKCdmb2N1cycpLnRyaWdnZXIoZSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuaGlkZSA9IGZ1bmN0aW9uIChlKSB7XHJcbiAgICBpZiAoZSkgZS5wcmV2ZW50RGVmYXVsdCgpXHJcblxyXG4gICAgZSA9ICQuRXZlbnQoJ2hpZGUud3BiYy5tb2RhbCcpXHJcblxyXG4gICAgdGhpcy4kZWxlbWVudC50cmlnZ2VyKGUpXHJcblxyXG4gICAgaWYgKCF0aGlzLmlzU2hvd24gfHwgZS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkgcmV0dXJuXHJcblxyXG4gICAgdGhpcy5pc1Nob3duID0gZmFsc2VcclxuXHJcbiAgICB0aGlzLmVzY2FwZSgpXHJcbiAgICB0aGlzLnJlc2l6ZSgpXHJcblxyXG4gICAgJChkb2N1bWVudCkub2ZmKCdmb2N1c2luLndwYmMubW9kYWwnKVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnRcclxuICAgICAgLnJlbW92ZUNsYXNzKCdpbicpXHJcbiAgICAgIC5vZmYoJ2NsaWNrLmRpc21pc3Mud3BiYy5tb2RhbCcpXHJcbiAgICAgIC5vZmYoJ21vdXNldXAuZGlzbWlzcy53cGJjLm1vZGFsJylcclxuXHJcbiAgICB0aGlzLiRkaWFsb2cub2ZmKCdtb3VzZWRvd24uZGlzbWlzcy53cGJjLm1vZGFsJylcclxuXHJcbiAgICAkLnN1cHBvcnQudHJhbnNpdGlvbiAmJiB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdmYWRlJykgP1xyXG4gICAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgICAgLm9uZSgnYnNUcmFuc2l0aW9uRW5kJywgJC5wcm94eSh0aGlzLmhpZGVNb2RhbCwgdGhpcykpXHJcbiAgICAgICAgLmVtdWxhdGVUcmFuc2l0aW9uRW5kKE1vZGFsLlRSQU5TSVRJT05fRFVSQVRJT04pIDpcclxuICAgICAgdGhpcy5oaWRlTW9kYWwoKVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmVuZm9yY2VGb2N1cyA9IGZ1bmN0aW9uICgpIHtcclxuICAgICQoZG9jdW1lbnQpXHJcbiAgICAgIC5vZmYoJ2ZvY3VzaW4ud3BiYy5tb2RhbCcpIC8vIGd1YXJkIGFnYWluc3QgaW5maW5pdGUgZm9jdXMgbG9vcFxyXG4gICAgICAub24oJ2ZvY3VzaW4ud3BiYy5tb2RhbCcsICQucHJveHkoZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBpZiAodGhpcy4kZWxlbWVudFswXSAhPT0gZS50YXJnZXQgJiYgIXRoaXMuJGVsZW1lbnQuaGFzKGUudGFyZ2V0KS5sZW5ndGgpIHtcclxuICAgICAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignZm9jdXMnKVxyXG4gICAgICAgIH1cclxuICAgICAgfSwgdGhpcykpXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuZXNjYXBlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgaWYgKHRoaXMuaXNTaG93biAmJiB0aGlzLm9wdGlvbnMua2V5Ym9hcmQpIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vbigna2V5ZG93bi5kaXNtaXNzLndwYmMubW9kYWwnLCAkLnByb3h5KGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgZS53aGljaCA9PSAyNyAmJiB0aGlzLmhpZGUoKVxyXG4gICAgICB9LCB0aGlzKSlcclxuICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNTaG93bikge1xyXG4gICAgICB0aGlzLiRlbGVtZW50Lm9mZigna2V5ZG93bi5kaXNtaXNzLndwYmMubW9kYWwnKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLnJlc2l6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICh0aGlzLmlzU2hvd24pIHtcclxuICAgICAgJCh3aW5kb3cpLm9uKCdyZXNpemUud3BiYy5tb2RhbCcsICQucHJveHkodGhpcy5oYW5kbGVVcGRhdGUsIHRoaXMpKVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgJCh3aW5kb3cpLm9mZigncmVzaXplLndwYmMubW9kYWwnKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmhpZGVNb2RhbCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciB0aGF0ID0gdGhpc1xyXG4gICAgdGhpcy4kZWxlbWVudC5oaWRlKClcclxuICAgIHRoaXMuYmFja2Ryb3AoZnVuY3Rpb24gKCkge1xyXG4gICAgICB0aGF0LiRib2R5LnJlbW92ZUNsYXNzKCdtb2RhbC1vcGVuJylcclxuICAgICAgdGhhdC5yZXNldEFkanVzdG1lbnRzKClcclxuICAgICAgdGhhdC5yZXNldFNjcm9sbGJhcigpXHJcbiAgICAgIHRoYXQuJGVsZW1lbnQudHJpZ2dlcignaGlkZGVuLndwYmMubW9kYWwnKVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5yZW1vdmVCYWNrZHJvcCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuJGJhY2tkcm9wICYmIHRoaXMuJGJhY2tkcm9wLnJlbW92ZSgpXHJcbiAgICB0aGlzLiRiYWNrZHJvcCA9IG51bGxcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5iYWNrZHJvcCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgdmFyIHRoYXQgPSB0aGlzXHJcbiAgICB2YXIgYW5pbWF0ZSA9IHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2ZhZGUnKSA/ICdmYWRlJyA6ICcnXHJcblxyXG4gICAgaWYgKHRoaXMuaXNTaG93biAmJiB0aGlzLm9wdGlvbnMuYmFja2Ryb3ApIHtcclxuICAgICAgdmFyIGRvQW5pbWF0ZSA9ICQuc3VwcG9ydC50cmFuc2l0aW9uICYmIGFuaW1hdGVcclxuXHJcbiAgICAgIHRoaXMuJGJhY2tkcm9wID0gJChkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSlcclxuICAgICAgICAuYWRkQ2xhc3MoJ21vZGFsLWJhY2tkcm9wICcgKyBhbmltYXRlKVxyXG4gICAgICAgIC5hcHBlbmRUbyh0aGlzLiRib2R5KVxyXG5cclxuICAgICAgdGhpcy4kZWxlbWVudC5vbignY2xpY2suZGlzbWlzcy53cGJjLm1vZGFsJywgJC5wcm94eShmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGlmICh0aGlzLmlnbm9yZUJhY2tkcm9wQ2xpY2spIHtcclxuICAgICAgICAgIHRoaXMuaWdub3JlQmFja2Ryb3BDbGljayA9IGZhbHNlXHJcbiAgICAgICAgICByZXR1cm5cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGUudGFyZ2V0ICE9PSBlLmN1cnJlbnRUYXJnZXQpIHJldHVyblxyXG4gICAgICAgIHRoaXMub3B0aW9ucy5iYWNrZHJvcCA9PSAnc3RhdGljJ1xyXG4gICAgICAgICAgPyB0aGlzLiRlbGVtZW50WzBdLmZvY3VzKClcclxuICAgICAgICAgIDogdGhpcy5oaWRlKClcclxuICAgICAgfSwgdGhpcykpXHJcblxyXG4gICAgICBpZiAoZG9BbmltYXRlKSB0aGlzLiRiYWNrZHJvcFswXS5vZmZzZXRXaWR0aCAvLyBmb3JjZSByZWZsb3dcclxuXHJcbiAgICAgIHRoaXMuJGJhY2tkcm9wLmFkZENsYXNzKCdpbicpXHJcblxyXG4gICAgICBpZiAoIWNhbGxiYWNrKSByZXR1cm5cclxuXHJcbiAgICAgIGRvQW5pbWF0ZSA/XHJcbiAgICAgICAgdGhpcy4kYmFja2Ryb3BcclxuICAgICAgICAgIC5vbmUoJ2JzVHJhbnNpdGlvbkVuZCcsIGNhbGxiYWNrKVxyXG4gICAgICAgICAgLmVtdWxhdGVUcmFuc2l0aW9uRW5kKE1vZGFsLkJBQ0tEUk9QX1RSQU5TSVRJT05fRFVSQVRJT04pIDpcclxuICAgICAgICBjYWxsYmFjaygpXHJcblxyXG4gICAgfSBlbHNlIGlmICghdGhpcy5pc1Nob3duICYmIHRoaXMuJGJhY2tkcm9wKSB7XHJcbiAgICAgIHRoaXMuJGJhY2tkcm9wLnJlbW92ZUNsYXNzKCdpbicpXHJcblxyXG4gICAgICB2YXIgY2FsbGJhY2tSZW1vdmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhhdC5yZW1vdmVCYWNrZHJvcCgpXHJcbiAgICAgICAgY2FsbGJhY2sgJiYgY2FsbGJhY2soKVxyXG4gICAgICB9XHJcbiAgICAgICQuc3VwcG9ydC50cmFuc2l0aW9uICYmIHRoaXMuJGVsZW1lbnQuaGFzQ2xhc3MoJ2ZhZGUnKSA/XHJcbiAgICAgICAgdGhpcy4kYmFja2Ryb3BcclxuICAgICAgICAgIC5vbmUoJ2JzVHJhbnNpdGlvbkVuZCcsIGNhbGxiYWNrUmVtb3ZlKVxyXG4gICAgICAgICAgLmVtdWxhdGVUcmFuc2l0aW9uRW5kKE1vZGFsLkJBQ0tEUk9QX1RSQU5TSVRJT05fRFVSQVRJT04pIDpcclxuICAgICAgICBjYWxsYmFja1JlbW92ZSgpXHJcblxyXG4gICAgfSBlbHNlIGlmIChjYWxsYmFjaykge1xyXG4gICAgICBjYWxsYmFjaygpXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyB0aGVzZSBmb2xsb3dpbmcgbWV0aG9kcyBhcmUgdXNlZCB0byBoYW5kbGUgb3ZlcmZsb3dpbmcgbW9kYWxzXHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5oYW5kbGVVcGRhdGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmFkanVzdERpYWxvZygpXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuYWRqdXN0RGlhbG9nID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG1vZGFsSXNPdmVyZmxvd2luZyA9IHRoaXMuJGVsZW1lbnRbMF0uc2Nyb2xsSGVpZ2h0ID4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodFxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQuY3NzKHtcclxuICAgICAgcGFkZGluZ0xlZnQ6ICAhdGhpcy5ib2R5SXNPdmVyZmxvd2luZyAmJiBtb2RhbElzT3ZlcmZsb3dpbmcgPyB0aGlzLnNjcm9sbGJhcldpZHRoIDogJycsXHJcbiAgICAgIHBhZGRpbmdSaWdodDogdGhpcy5ib2R5SXNPdmVyZmxvd2luZyAmJiAhbW9kYWxJc092ZXJmbG93aW5nID8gdGhpcy5zY3JvbGxiYXJXaWR0aCA6ICcnXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLnJlc2V0QWRqdXN0bWVudHMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLiRlbGVtZW50LmNzcyh7XHJcbiAgICAgIHBhZGRpbmdMZWZ0OiAnJyxcclxuICAgICAgcGFkZGluZ1JpZ2h0OiAnJ1xyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5jaGVja1Njcm9sbGJhciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBmdWxsV2luZG93V2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aFxyXG4gICAgaWYgKCFmdWxsV2luZG93V2lkdGgpIHsgLy8gd29ya2Fyb3VuZCBmb3IgbWlzc2luZyB3aW5kb3cuaW5uZXJXaWR0aCBpbiBJRThcclxuICAgICAgdmFyIGRvY3VtZW50RWxlbWVudFJlY3QgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcclxuICAgICAgZnVsbFdpbmRvd1dpZHRoID0gZG9jdW1lbnRFbGVtZW50UmVjdC5yaWdodCAtIE1hdGguYWJzKGRvY3VtZW50RWxlbWVudFJlY3QubGVmdClcclxuICAgIH1cclxuICAgIHRoaXMuYm9keUlzT3ZlcmZsb3dpbmcgPSBkb2N1bWVudC5ib2R5LmNsaWVudFdpZHRoIDwgZnVsbFdpbmRvd1dpZHRoXHJcbiAgICB0aGlzLnNjcm9sbGJhcldpZHRoID0gdGhpcy5tZWFzdXJlU2Nyb2xsYmFyKClcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5zZXRTY3JvbGxiYXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgYm9keVBhZCA9IHBhcnNlSW50KCh0aGlzLiRib2R5LmNzcygncGFkZGluZy1yaWdodCcpIHx8IDApLCAxMClcclxuICAgIHRoaXMub3JpZ2luYWxCb2R5UGFkID0gZG9jdW1lbnQuYm9keS5zdHlsZS5wYWRkaW5nUmlnaHQgfHwgJydcclxuICAgIGlmICh0aGlzLmJvZHlJc092ZXJmbG93aW5nKSB0aGlzLiRib2R5LmNzcygncGFkZGluZy1yaWdodCcsIGJvZHlQYWQgKyB0aGlzLnNjcm9sbGJhcldpZHRoKVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLnJlc2V0U2Nyb2xsYmFyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy4kYm9keS5jc3MoJ3BhZGRpbmctcmlnaHQnLCB0aGlzLm9yaWdpbmFsQm9keVBhZClcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5tZWFzdXJlU2Nyb2xsYmFyID0gZnVuY3Rpb24gKCkgeyAvLyB0aHggd2Fsc2hcclxuICAgIHZhciBzY3JvbGxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKVxyXG4gICAgc2Nyb2xsRGl2LmNsYXNzTmFtZSA9ICdtb2RhbC1zY3JvbGxiYXItbWVhc3VyZSdcclxuICAgIHRoaXMuJGJvZHkuYXBwZW5kKHNjcm9sbERpdilcclxuICAgIHZhciBzY3JvbGxiYXJXaWR0aCA9IHNjcm9sbERpdi5vZmZzZXRXaWR0aCAtIHNjcm9sbERpdi5jbGllbnRXaWR0aFxyXG4gICAgdGhpcy4kYm9keVswXS5yZW1vdmVDaGlsZChzY3JvbGxEaXYpXHJcbiAgICByZXR1cm4gc2Nyb2xsYmFyV2lkdGhcclxuICB9XHJcblxyXG5cclxuICAvLyBNT0RBTCBQTFVHSU4gREVGSU5JVElPTlxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIGZ1bmN0aW9uIFBsdWdpbihvcHRpb24sIF9yZWxhdGVkVGFyZ2V0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdmFyICR0aGlzICAgPSAkKHRoaXMpXHJcbiAgICAgIHZhciBkYXRhICAgID0gJHRoaXMuZGF0YSgnd3BiYy5tb2RhbCcpXHJcbiAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQoe30sIE1vZGFsLkRFRkFVTFRTLCAkdGhpcy5kYXRhKCksIHR5cGVvZiBvcHRpb24gPT0gJ29iamVjdCcgJiYgb3B0aW9uKVxyXG5cclxuICAgICAgaWYgKCFkYXRhKSAkdGhpcy5kYXRhKCd3cGJjLm1vZGFsJywgKGRhdGEgPSBuZXcgTW9kYWwodGhpcywgb3B0aW9ucykpKVxyXG4gICAgICBpZiAodHlwZW9mIG9wdGlvbiA9PSAnc3RyaW5nJykgZGF0YVtvcHRpb25dKF9yZWxhdGVkVGFyZ2V0KVxyXG4gICAgICBlbHNlIGlmIChvcHRpb25zLnNob3cpIGRhdGEuc2hvdyhfcmVsYXRlZFRhcmdldClcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICB2YXIgb2xkID0gJC5mbi53cGJjX215X21vZGFsXHJcblxyXG4gICQuZm4ud3BiY19teV9tb2RhbCAgICAgICAgICAgICA9IFBsdWdpblxyXG4gICQuZm4ud3BiY19teV9tb2RhbC5Db25zdHJ1Y3RvciA9IE1vZGFsXHJcblxyXG5cclxuICAvLyBNT0RBTCBOTyBDT05GTElDVFxyXG4gIC8vID09PT09PT09PT09PT09PT09XHJcblxyXG4gICQuZm4ud3BiY19teV9tb2RhbC5ub0NvbmZsaWN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgJC5mbi53cGJjX215X21vZGFsID0gb2xkXHJcbiAgICByZXR1cm4gdGhpc1xyXG4gIH1cclxuXHJcblxyXG4gIC8vIE1PREFMIERBVEEtQVBJXHJcbiAgLy8gPT09PT09PT09PT09PT1cclxuXHJcbiAgJChkb2N1bWVudCkub24oJ2NsaWNrLndwYmMubW9kYWwuZGF0YS1hcGknLCAnW2RhdGEtdG9nZ2xlPVwid3BiY19teV9tb2RhbFwiXScsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICB2YXIgJHRoaXMgICA9ICQodGhpcylcclxuICAgIHZhciBocmVmICAgID0gJHRoaXMuYXR0cignaHJlZicpXHJcbiAgICB2YXIgJHRhcmdldCA9ICQoJHRoaXMuYXR0cignZGF0YS10YXJnZXQnKSB8fCAoaHJlZiAmJiBocmVmLnJlcGxhY2UoLy4qKD89I1teXFxzXSskKS8sICcnKSkpIC8vIHN0cmlwIGZvciBpZTdcclxuICAgIHZhciBvcHRpb24gID0gJHRhcmdldC5kYXRhKCd3cGJjLm1vZGFsJykgPyAndG9nZ2xlJyA6ICQuZXh0ZW5kKHsgcmVtb3RlOiAhLyMvLnRlc3QoaHJlZikgJiYgaHJlZiB9LCAkdGFyZ2V0LmRhdGEoKSwgJHRoaXMuZGF0YSgpKVxyXG5cclxuICAgIGlmICgkdGhpcy5pcygnYScpKSBlLnByZXZlbnREZWZhdWx0KClcclxuXHJcbiAgICAkdGFyZ2V0Lm9uZSgnc2hvdy53cGJjLm1vZGFsJywgZnVuY3Rpb24gKHNob3dFdmVudCkge1xyXG4gICAgICBpZiAoc2hvd0V2ZW50LmlzRGVmYXVsdFByZXZlbnRlZCgpKSByZXR1cm4gLy8gb25seSByZWdpc3RlciBmb2N1cyByZXN0b3JlciBpZiBtb2RhbCB3aWxsIGFjdHVhbGx5IGdldCBzaG93blxyXG4gICAgICAkdGFyZ2V0Lm9uZSgnaGlkZGVuLndwYmMubW9kYWwnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgJHRoaXMuaXMoJzp2aXNpYmxlJykgJiYgJHRoaXMudHJpZ2dlcignZm9jdXMnKVxyXG4gICAgICB9KVxyXG4gICAgfSlcclxuICAgIFBsdWdpbi5jYWxsKCR0YXJnZXQsIG9wdGlvbiwgdGhpcylcclxuICB9KVxyXG5cclxufShqUXVlcnkpO1xyXG5cclxuXHJcbitmdW5jdGlvbiAoJCkge1xyXG4gICd1c2Ugc3RyaWN0JztcclxuXHJcbiAgLy8gRFJPUERPV04gQ0xBU1MgREVGSU5JVElPTlxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgdmFyIGJhY2tkcm9wID0gJy5kcm9wZG93bi1iYWNrZHJvcCdcclxuICB2YXIgdG9nZ2xlICAgPSAnW2RhdGEtdG9nZ2xlPVwid3BiY19kcm9wZG93blwiXSdcclxuICB2YXIgRHJvcGRvd24gPSBmdW5jdGlvbiAoZWxlbWVudCkge1xyXG4gICAgJChlbGVtZW50KS5vbignY2xpY2sud3BiYy5kcm9wZG93bicsIHRoaXMudG9nZ2xlKVxyXG4gIH1cclxuXHJcbiAgRHJvcGRvd24uVkVSU0lPTiA9ICczLjMuNSdcclxuXHJcbiAgZnVuY3Rpb24gZ2V0UGFyZW50KCR0aGlzKSB7XHJcbiAgICB2YXIgc2VsZWN0b3IgPSAkdGhpcy5hdHRyKCdkYXRhLXRhcmdldCcpXHJcblxyXG4gICAgaWYgKCFzZWxlY3Rvcikge1xyXG4gICAgICBzZWxlY3RvciA9ICR0aGlzLmF0dHIoJ2hyZWYnKVxyXG4gICAgICBzZWxlY3RvciA9IHNlbGVjdG9yICYmIC8jW0EtWmEtel0vLnRlc3Qoc2VsZWN0b3IpICYmIHNlbGVjdG9yLnJlcGxhY2UoLy4qKD89I1teXFxzXSokKS8sICcnKSAvLyBzdHJpcCBmb3IgaWU3XHJcbiAgICB9XHJcblxyXG4gICAgdmFyICRwYXJlbnQgPSBzZWxlY3RvciAmJiAkKHNlbGVjdG9yKVxyXG5cclxuICAgIHJldHVybiAkcGFyZW50ICYmICRwYXJlbnQubGVuZ3RoID8gJHBhcmVudCA6ICR0aGlzLnBhcmVudCgpXHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBjbGVhck1lbnVzKGUpIHtcclxuICAgIGlmIChlICYmIGUud2hpY2ggPT09IDMpIHJldHVyblxyXG4gICAgJChiYWNrZHJvcCkucmVtb3ZlKClcclxuICAgICQodG9nZ2xlKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdmFyICR0aGlzICAgICAgICAgPSAkKHRoaXMpXHJcbiAgICAgIHZhciAkcGFyZW50ICAgICAgID0gZ2V0UGFyZW50KCR0aGlzKVxyXG4gICAgICB2YXIgcmVsYXRlZFRhcmdldCA9IHsgcmVsYXRlZFRhcmdldDogdGhpcyB9XHJcblxyXG4gICAgICBpZiAoISRwYXJlbnQuaGFzQ2xhc3MoJ29wZW4nKSkgcmV0dXJuXHJcblxyXG4gICAgICBpZiAoZSAmJiBlLnR5cGUgPT0gJ2NsaWNrJyAmJiAvaW5wdXR8dGV4dGFyZWEvaS50ZXN0KGUudGFyZ2V0LnRhZ05hbWUpICYmICQuY29udGFpbnMoJHBhcmVudFswXSwgZS50YXJnZXQpKSByZXR1cm5cclxuXHJcbiAgICAgICRwYXJlbnQudHJpZ2dlcihlID0gJC5FdmVudCgnaGlkZS53cGJjLmRyb3Bkb3duJywgcmVsYXRlZFRhcmdldCkpXHJcblxyXG4gICAgICBpZiAoZS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkgcmV0dXJuXHJcblxyXG4gICAgICAkdGhpcy5hdHRyKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJylcclxuICAgICAgJHBhcmVudC5yZW1vdmVDbGFzcygnb3BlbicpLnRyaWdnZXIoJ2hpZGRlbi53cGJjLmRyb3Bkb3duJywgcmVsYXRlZFRhcmdldClcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBEcm9wZG93bi5wcm90b3R5cGUudG9nZ2xlID0gZnVuY3Rpb24gKGUpIHtcclxuICAgIHZhciAkdGhpcyA9ICQodGhpcylcclxuXHJcbiAgICBpZiAoJHRoaXMuaXMoJy5kaXNhYmxlZCwgOmRpc2FibGVkJykpIHJldHVyblxyXG5cclxuICAgIHZhciAkcGFyZW50ICA9IGdldFBhcmVudCgkdGhpcylcclxuICAgIHZhciBpc0FjdGl2ZSA9ICRwYXJlbnQuaGFzQ2xhc3MoJ29wZW4nKVxyXG5cclxuICAgIGNsZWFyTWVudXMoKVxyXG5cclxuICAgIGlmICghaXNBY3RpdmUpIHtcclxuICAgICAgaWYgKCdvbnRvdWNoc3RhcnQnIGluIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCAmJiAhJHBhcmVudC5jbG9zZXN0KCcubmF2YmFyLW5hdicpLmxlbmd0aCkge1xyXG4gICAgICAgIC8vIGlmIG1vYmlsZSB3ZSB1c2UgYSBiYWNrZHJvcCBiZWNhdXNlIGNsaWNrIGV2ZW50cyBkb24ndCBkZWxlZ2F0ZVxyXG4gICAgICAgICQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXHJcbiAgICAgICAgICAuYWRkQ2xhc3MoJ2Ryb3Bkb3duLWJhY2tkcm9wJylcclxuICAgICAgICAgIC5pbnNlcnRBZnRlcigkKHRoaXMpKVxyXG4gICAgICAgICAgLm9uKCdjbGljaycsIGNsZWFyTWVudXMpXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHZhciByZWxhdGVkVGFyZ2V0ID0geyByZWxhdGVkVGFyZ2V0OiB0aGlzIH1cclxuICAgICAgJHBhcmVudC50cmlnZ2VyKGUgPSAkLkV2ZW50KCdzaG93LndwYmMuZHJvcGRvd24nLCByZWxhdGVkVGFyZ2V0KSlcclxuXHJcbiAgICAgIGlmIChlLmlzRGVmYXVsdFByZXZlbnRlZCgpKSByZXR1cm5cclxuXHJcbiAgICAgICR0aGlzXHJcbiAgICAgICAgLnRyaWdnZXIoJ2ZvY3VzJylcclxuICAgICAgICAuYXR0cignYXJpYS1leHBhbmRlZCcsICd0cnVlJylcclxuXHJcbiAgICAgICRwYXJlbnRcclxuICAgICAgICAudG9nZ2xlQ2xhc3MoJ29wZW4nKVxyXG4gICAgICAgIC50cmlnZ2VyKCdzaG93bi53cGJjLmRyb3Bkb3duJywgcmVsYXRlZFRhcmdldClcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmFsc2VcclxuICB9XHJcblxyXG4gIERyb3Bkb3duLnByb3RvdHlwZS5rZXlkb3duID0gZnVuY3Rpb24gKGUpIHtcclxuICAgIGlmICghLygzOHw0MHwyN3wzMikvLnRlc3QoZS53aGljaCkgfHwgL2lucHV0fHRleHRhcmVhL2kudGVzdChlLnRhcmdldC50YWdOYW1lKSkgcmV0dXJuXHJcblxyXG4gICAgdmFyICR0aGlzID0gJCh0aGlzKVxyXG5cclxuICAgIGUucHJldmVudERlZmF1bHQoKVxyXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKVxyXG5cclxuICAgIGlmICgkdGhpcy5pcygnLmRpc2FibGVkLCA6ZGlzYWJsZWQnKSkgcmV0dXJuXHJcblxyXG4gICAgdmFyICRwYXJlbnQgID0gZ2V0UGFyZW50KCR0aGlzKVxyXG4gICAgdmFyIGlzQWN0aXZlID0gJHBhcmVudC5oYXNDbGFzcygnb3BlbicpXHJcblxyXG4gICAgaWYgKCFpc0FjdGl2ZSAmJiBlLndoaWNoICE9IDI3IHx8IGlzQWN0aXZlICYmIGUud2hpY2ggPT0gMjcpIHtcclxuICAgICAgaWYgKGUud2hpY2ggPT0gMjcpICRwYXJlbnQuZmluZCh0b2dnbGUpLnRyaWdnZXIoJ2ZvY3VzJylcclxuICAgICAgcmV0dXJuICR0aGlzLnRyaWdnZXIoJ2NsaWNrJylcclxuICAgIH1cclxuXHJcbiAgICB2YXIgZGVzYyA9ICcgbGk6bm90KC5kaXNhYmxlZCk6dmlzaWJsZSBhJ1xyXG4gICAgdmFyICRpdGVtcyA9ICRwYXJlbnQuZmluZCgnLmRyb3Bkb3duLW1lbnUnICsgZGVzYyArICcsLnVpX2Ryb3Bkb3duX21lbnUnICsgZGVzYylcclxuXHJcbiAgICBpZiAoISRpdGVtcy5sZW5ndGgpIHJldHVyblxyXG5cclxuICAgIHZhciBpbmRleCA9ICRpdGVtcy5pbmRleChlLnRhcmdldClcclxuXHJcbiAgICBpZiAoZS53aGljaCA9PSAzOCAmJiBpbmRleCA+IDApICAgICAgICAgICAgICAgICBpbmRleC0tICAgICAgICAgLy8gdXBcclxuICAgIGlmIChlLndoaWNoID09IDQwICYmIGluZGV4IDwgJGl0ZW1zLmxlbmd0aCAtIDEpIGluZGV4KysgICAgICAgICAvLyBkb3duXHJcbiAgICBpZiAoIX5pbmRleCkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRleCA9IDBcclxuXHJcbiAgICAkaXRlbXMuZXEoaW5kZXgpLnRyaWdnZXIoJ2ZvY3VzJylcclxuICB9XHJcblxyXG5cclxuICAvLyBEUk9QRE9XTiBQTFVHSU4gREVGSU5JVElPTlxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIGZ1bmN0aW9uIFBsdWdpbihvcHRpb24pIHtcclxuICAgIHJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpXHJcbiAgICAgIHZhciBkYXRhICA9ICR0aGlzLmRhdGEoJ3dwYmMuZHJvcGRvd24nKVxyXG5cclxuICAgICAgaWYgKCFkYXRhKSAkdGhpcy5kYXRhKCd3cGJjLmRyb3Bkb3duJywgKGRhdGEgPSBuZXcgRHJvcGRvd24odGhpcykpKVxyXG4gICAgICBpZiAodHlwZW9mIG9wdGlvbiA9PSAnc3RyaW5nJykgZGF0YVtvcHRpb25dLmNhbGwoJHRoaXMpXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgdmFyIG9sZCA9ICQuZm4ud3BiY19kcm9wZG93blxyXG5cclxuICAkLmZuLndwYmNfZHJvcGRvd24gICAgICAgICAgICAgPSBQbHVnaW5cclxuICAkLmZuLndwYmNfZHJvcGRvd24uQ29uc3RydWN0b3IgPSBEcm9wZG93blxyXG5cclxuXHJcbiAgLy8gRFJPUERPV04gTk8gQ09ORkxJQ1RcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAkLmZuLndwYmNfZHJvcGRvd24ubm9Db25mbGljdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICQuZm4ud3BiY19kcm9wZG93biA9IG9sZFxyXG4gICAgcmV0dXJuIHRoaXNcclxuICB9XHJcblxyXG5cclxuICAvLyBBUFBMWSBUTyBTVEFOREFSRCBEUk9QRE9XTiBFTEVNRU5UU1xyXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gICQoZG9jdW1lbnQpXHJcbiAgICAub24oJ2NsaWNrLndwYmMuZHJvcGRvd24uZGF0YS1hcGknLCBjbGVhck1lbnVzKVxyXG4gICAgLm9uKCdjbGljay53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgJy5kcm9wZG93biBmb3JtJywgZnVuY3Rpb24gKGUpIHsgZS5zdG9wUHJvcGFnYXRpb24oKSB9KVxyXG4gICAgLm9uKCdjbGljay53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgdG9nZ2xlLCBEcm9wZG93bi5wcm90b3R5cGUudG9nZ2xlKVxyXG4gICAgLm9uKCdrZXlkb3duLndwYmMuZHJvcGRvd24uZGF0YS1hcGknLCB0b2dnbGUsIERyb3Bkb3duLnByb3RvdHlwZS5rZXlkb3duKVxyXG4gICAgLm9uKCdrZXlkb3duLndwYmMuZHJvcGRvd24uZGF0YS1hcGknLCAnLmRyb3Bkb3duLW1lbnUnLCBEcm9wZG93bi5wcm90b3R5cGUua2V5ZG93bilcclxuICAgIC5vbigna2V5ZG93bi53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgJy51aV9kcm9wZG93bl9tZW51JywgRHJvcGRvd24ucHJvdG90eXBlLmtleWRvd24pXHJcblxyXG59KGpRdWVyeSk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLE9BQU9BLE1BQU0sS0FBSyxXQUFXLEVBQUU7RUFDakMsTUFBTSxJQUFJQyxLQUFLLENBQUMseUNBQXlDLENBQUM7QUFDNUQ7QUFDQSxDQUFDLFVBQVVDLENBQUMsRUFBRTtFQUNaLFlBQVk7O0VBQ1osSUFBSUMsT0FBTyxHQUFHRCxDQUFDLENBQUNFLEVBQUUsQ0FBQ0MsTUFBTSxDQUFDQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUNBLEtBQUssQ0FBQyxHQUFHLENBQUM7RUFDbEQsSUFBS0gsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBTUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSUEsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUUsRUFBRTtJQUNoRyxNQUFNLElBQUlGLEtBQUssQ0FBQyxpRUFBaUUsQ0FBQztFQUNwRjtBQUNGLENBQUMsQ0FBQ0QsTUFBTSxDQUFDOztBQUVUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdBLENBQUMsVUFBVUUsQ0FBQyxFQUFFO0VBQ1osWUFBWTs7RUFFWjtFQUNBO0VBRUEsSUFBSUssS0FBSyxHQUFHLFNBQVJBLEtBQUtBLENBQWFDLE9BQU8sRUFBRUMsT0FBTyxFQUFFO0lBQ3RDLElBQUksQ0FBQ0EsT0FBTyxHQUFlQSxPQUFPO0lBQ2xDLElBQUksQ0FBQ0MsS0FBSyxHQUFpQlIsQ0FBQyxDQUFDUyxRQUFRLENBQUNDLElBQUksQ0FBQztJQUMzQyxJQUFJLENBQUNDLFFBQVEsR0FBY1gsQ0FBQyxDQUFDTSxPQUFPLENBQUM7SUFDckMsSUFBSSxDQUFDTSxPQUFPLEdBQWUsSUFBSSxDQUFDRCxRQUFRLENBQUNFLElBQUksQ0FBQyxlQUFlLENBQUM7SUFDOUQsSUFBSSxDQUFDQyxTQUFTLEdBQWEsSUFBSTtJQUMvQixJQUFJLENBQUNDLE9BQU8sR0FBZSxJQUFJO0lBQy9CLElBQUksQ0FBQ0MsZUFBZSxHQUFPLElBQUk7SUFDL0IsSUFBSSxDQUFDQyxjQUFjLEdBQVEsQ0FBQztJQUM1QixJQUFJLENBQUNDLG1CQUFtQixHQUFHLEtBQUs7SUFFaEMsSUFBSSxJQUFJLENBQUNYLE9BQU8sQ0FBQ1ksTUFBTSxFQUFFO01BQ3ZCLElBQUksQ0FBQ1IsUUFBUSxDQUNWRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FDdEJPLElBQUksQ0FBQyxJQUFJLENBQUNiLE9BQU8sQ0FBQ1ksTUFBTSxFQUFFbkIsQ0FBQyxDQUFDcUIsS0FBSyxDQUFDLFlBQVk7UUFDN0MsSUFBSSxDQUFDVixRQUFRLENBQUNXLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQztNQUM1QyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDYjtFQUNGLENBQUM7RUFFRGpCLEtBQUssQ0FBQ2tCLE9BQU8sR0FBSSxPQUFPO0VBRXhCbEIsS0FBSyxDQUFDbUIsbUJBQW1CLEdBQUcsR0FBRztFQUMvQm5CLEtBQUssQ0FBQ29CLDRCQUE0QixHQUFHLEdBQUc7RUFFeENwQixLQUFLLENBQUNxQixRQUFRLEdBQUc7SUFDZkMsUUFBUSxFQUFFLElBQUk7SUFDZEMsUUFBUSxFQUFFLElBQUk7SUFDZEMsSUFBSSxFQUFFO0VBQ1IsQ0FBQztFQUVEeEIsS0FBSyxDQUFDeUIsU0FBUyxDQUFDQyxNQUFNLEdBQUcsVUFBVUMsY0FBYyxFQUFFO0lBQ2pELE9BQU8sSUFBSSxDQUFDakIsT0FBTyxHQUFHLElBQUksQ0FBQ2tCLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDSixJQUFJLENBQUNHLGNBQWMsQ0FBQztFQUMvRCxDQUFDO0VBRUQzQixLQUFLLENBQUN5QixTQUFTLENBQUNELElBQUksR0FBRyxVQUFVRyxjQUFjLEVBQUU7SUFDL0MsSUFBSUUsSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJQyxDQUFDLEdBQU1uQyxDQUFDLENBQUNvQyxLQUFLLENBQUMsaUJBQWlCLEVBQUU7TUFBRUMsYUFBYSxFQUFFTDtJQUFlLENBQUMsQ0FBQztJQUV4RSxJQUFJLENBQUNyQixRQUFRLENBQUNXLE9BQU8sQ0FBQ2EsQ0FBQyxDQUFDO0lBRXhCLElBQUksSUFBSSxDQUFDcEIsT0FBTyxJQUFJb0IsQ0FBQyxDQUFDRyxrQkFBa0IsQ0FBQyxDQUFDLEVBQUU7SUFFNUMsSUFBSSxDQUFDdkIsT0FBTyxHQUFHLElBQUk7SUFFbkIsSUFBSSxDQUFDd0IsY0FBYyxDQUFDLENBQUM7SUFDckIsSUFBSSxDQUFDQyxZQUFZLENBQUMsQ0FBQztJQUNuQixJQUFJLENBQUNoQyxLQUFLLENBQUNpQyxRQUFRLENBQUMsWUFBWSxDQUFDO0lBRWpDLElBQUksQ0FBQ0MsTUFBTSxDQUFDLENBQUM7SUFDYixJQUFJLENBQUNDLE1BQU0sQ0FBQyxDQUFDO0lBRWIsSUFBSSxDQUFDaEMsUUFBUSxDQUFDaUMsRUFBRSxDQUFDLDBCQUEwQixFQUFFLHdCQUF3QixFQUFFNUMsQ0FBQyxDQUFDcUIsS0FBSyxDQUFDLElBQUksQ0FBQ1ksSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBRWhHLElBQUksQ0FBQ3JCLE9BQU8sQ0FBQ2dDLEVBQUUsQ0FBQyw4QkFBOEIsRUFBRSxZQUFZO01BQzFEVixJQUFJLENBQUN2QixRQUFRLENBQUNrQyxHQUFHLENBQUMsNEJBQTRCLEVBQUUsVUFBVVYsQ0FBQyxFQUFFO1FBQzNELElBQUluQyxDQUFDLENBQUNtQyxDQUFDLENBQUNXLE1BQU0sQ0FBQyxDQUFDQyxFQUFFLENBQUNiLElBQUksQ0FBQ3ZCLFFBQVEsQ0FBQyxFQUFFdUIsSUFBSSxDQUFDaEIsbUJBQW1CLEdBQUcsSUFBSTtNQUNwRSxDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7SUFFRixJQUFJLENBQUNTLFFBQVEsQ0FBQyxZQUFZO01BQ3hCLElBQUlxQixVQUFVLEdBQUdoRCxDQUFDLENBQUNpRCxPQUFPLENBQUNELFVBQVUsSUFBSWQsSUFBSSxDQUFDdkIsUUFBUSxDQUFDdUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztNQUV2RSxJQUFJLENBQUNoQixJQUFJLENBQUN2QixRQUFRLENBQUN3QyxNQUFNLENBQUMsQ0FBQyxDQUFDQyxNQUFNLEVBQUU7UUFDbENsQixJQUFJLENBQUN2QixRQUFRLENBQUMwQyxRQUFRLENBQUNuQixJQUFJLENBQUMxQixLQUFLLENBQUMsRUFBQztNQUNyQztNQUVBMEIsSUFBSSxDQUFDdkIsUUFBUSxDQUNWa0IsSUFBSSxDQUFDLENBQUMsQ0FDTnlCLFNBQVMsQ0FBQyxDQUFDLENBQUM7TUFFZnBCLElBQUksQ0FBQ3FCLFlBQVksQ0FBQyxDQUFDO01BRW5CLElBQUlQLFVBQVUsRUFBRTtRQUNkZCxJQUFJLENBQUN2QixRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM2QyxXQUFXLEVBQUM7TUFDL0I7TUFFQXRCLElBQUksQ0FBQ3ZCLFFBQVEsQ0FBQzhCLFFBQVEsQ0FBQyxJQUFJLENBQUM7TUFFNUJQLElBQUksQ0FBQ3VCLFlBQVksQ0FBQyxDQUFDO01BRW5CLElBQUl0QixDQUFDLEdBQUduQyxDQUFDLENBQUNvQyxLQUFLLENBQUMsa0JBQWtCLEVBQUU7UUFBRUMsYUFBYSxFQUFFTDtNQUFlLENBQUMsQ0FBQztNQUV0RWdCLFVBQVUsR0FDUmQsSUFBSSxDQUFDdEIsT0FBTyxDQUFDO01BQUEsQ0FDVmlDLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRSxZQUFZO1FBQ2xDWCxJQUFJLENBQUN2QixRQUFRLENBQUNXLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQ0EsT0FBTyxDQUFDYSxDQUFDLENBQUM7TUFDM0MsQ0FBQyxDQUFDLENBQ0R1QixvQkFBb0IsQ0FBQ3JELEtBQUssQ0FBQ21CLG1CQUFtQixDQUFDLEdBQ2xEVSxJQUFJLENBQUN2QixRQUFRLENBQUNXLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQ0EsT0FBTyxDQUFDYSxDQUFDLENBQUM7SUFDN0MsQ0FBQyxDQUFDO0VBQ0osQ0FBQztFQUVEOUIsS0FBSyxDQUFDeUIsU0FBUyxDQUFDRyxJQUFJLEdBQUcsVUFBVUUsQ0FBQyxFQUFFO0lBQ2xDLElBQUlBLENBQUMsRUFBRUEsQ0FBQyxDQUFDd0IsY0FBYyxDQUFDLENBQUM7SUFFekJ4QixDQUFDLEdBQUduQyxDQUFDLENBQUNvQyxLQUFLLENBQUMsaUJBQWlCLENBQUM7SUFFOUIsSUFBSSxDQUFDekIsUUFBUSxDQUFDVyxPQUFPLENBQUNhLENBQUMsQ0FBQztJQUV4QixJQUFJLENBQUMsSUFBSSxDQUFDcEIsT0FBTyxJQUFJb0IsQ0FBQyxDQUFDRyxrQkFBa0IsQ0FBQyxDQUFDLEVBQUU7SUFFN0MsSUFBSSxDQUFDdkIsT0FBTyxHQUFHLEtBQUs7SUFFcEIsSUFBSSxDQUFDMkIsTUFBTSxDQUFDLENBQUM7SUFDYixJQUFJLENBQUNDLE1BQU0sQ0FBQyxDQUFDO0lBRWIzQyxDQUFDLENBQUNTLFFBQVEsQ0FBQyxDQUFDbUQsR0FBRyxDQUFDLG9CQUFvQixDQUFDO0lBRXJDLElBQUksQ0FBQ2pELFFBQVEsQ0FDVmtELFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FDakJELEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUMvQkEsR0FBRyxDQUFDLDRCQUE0QixDQUFDO0lBRXBDLElBQUksQ0FBQ2hELE9BQU8sQ0FBQ2dELEdBQUcsQ0FBQyw4QkFBOEIsQ0FBQztJQUVoRDVELENBQUMsQ0FBQ2lELE9BQU8sQ0FBQ0QsVUFBVSxJQUFJLElBQUksQ0FBQ3JDLFFBQVEsQ0FBQ3VDLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FDcEQsSUFBSSxDQUFDdkMsUUFBUSxDQUNWa0MsR0FBRyxDQUFDLGlCQUFpQixFQUFFN0MsQ0FBQyxDQUFDcUIsS0FBSyxDQUFDLElBQUksQ0FBQ3lDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUNyREosb0JBQW9CLENBQUNyRCxLQUFLLENBQUNtQixtQkFBbUIsQ0FBQyxHQUNsRCxJQUFJLENBQUNzQyxTQUFTLENBQUMsQ0FBQztFQUNwQixDQUFDO0VBRUR6RCxLQUFLLENBQUN5QixTQUFTLENBQUMyQixZQUFZLEdBQUcsWUFBWTtJQUN6Q3pELENBQUMsQ0FBQ1MsUUFBUSxDQUFDLENBQ1JtRCxHQUFHLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUFBLENBQzFCaEIsRUFBRSxDQUFDLG9CQUFvQixFQUFFNUMsQ0FBQyxDQUFDcUIsS0FBSyxDQUFDLFVBQVVjLENBQUMsRUFBRTtNQUM3QyxJQUFJLElBQUksQ0FBQ3hCLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBS3dCLENBQUMsQ0FBQ1csTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDbkMsUUFBUSxDQUFDb0QsR0FBRyxDQUFDNUIsQ0FBQyxDQUFDVyxNQUFNLENBQUMsQ0FBQ00sTUFBTSxFQUFFO1FBQ3hFLElBQUksQ0FBQ3pDLFFBQVEsQ0FBQ1csT0FBTyxDQUFDLE9BQU8sQ0FBQztNQUNoQztJQUNGLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztFQUNiLENBQUM7RUFFRGpCLEtBQUssQ0FBQ3lCLFNBQVMsQ0FBQ1ksTUFBTSxHQUFHLFlBQVk7SUFDbkMsSUFBSSxJQUFJLENBQUMzQixPQUFPLElBQUksSUFBSSxDQUFDUixPQUFPLENBQUNxQixRQUFRLEVBQUU7TUFDekMsSUFBSSxDQUFDakIsUUFBUSxDQUFDaUMsRUFBRSxDQUFDLDRCQUE0QixFQUFFNUMsQ0FBQyxDQUFDcUIsS0FBSyxDQUFDLFVBQVVjLENBQUMsRUFBRTtRQUNsRUEsQ0FBQyxDQUFDNkIsS0FBSyxJQUFJLEVBQUUsSUFBSSxJQUFJLENBQUMvQixJQUFJLENBQUMsQ0FBQztNQUM5QixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDWCxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQ2xCLE9BQU8sRUFBRTtNQUN4QixJQUFJLENBQUNKLFFBQVEsQ0FBQ2lELEdBQUcsQ0FBQyw0QkFBNEIsQ0FBQztJQUNqRDtFQUNGLENBQUM7RUFFRHZELEtBQUssQ0FBQ3lCLFNBQVMsQ0FBQ2EsTUFBTSxHQUFHLFlBQVk7SUFDbkMsSUFBSSxJQUFJLENBQUM1QixPQUFPLEVBQUU7TUFDaEJmLENBQUMsQ0FBQ2lFLE1BQU0sQ0FBQyxDQUFDckIsRUFBRSxDQUFDLG1CQUFtQixFQUFFNUMsQ0FBQyxDQUFDcUIsS0FBSyxDQUFDLElBQUksQ0FBQzZDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNyRSxDQUFDLE1BQU07TUFDTGxFLENBQUMsQ0FBQ2lFLE1BQU0sQ0FBQyxDQUFDTCxHQUFHLENBQUMsbUJBQW1CLENBQUM7SUFDcEM7RUFDRixDQUFDO0VBRUR2RCxLQUFLLENBQUN5QixTQUFTLENBQUNnQyxTQUFTLEdBQUcsWUFBWTtJQUN0QyxJQUFJNUIsSUFBSSxHQUFHLElBQUk7SUFDZixJQUFJLENBQUN2QixRQUFRLENBQUNzQixJQUFJLENBQUMsQ0FBQztJQUNwQixJQUFJLENBQUNOLFFBQVEsQ0FBQyxZQUFZO01BQ3hCTyxJQUFJLENBQUMxQixLQUFLLENBQUNxRCxXQUFXLENBQUMsWUFBWSxDQUFDO01BQ3BDM0IsSUFBSSxDQUFDaUMsZ0JBQWdCLENBQUMsQ0FBQztNQUN2QmpDLElBQUksQ0FBQ2tDLGNBQWMsQ0FBQyxDQUFDO01BQ3JCbEMsSUFBSSxDQUFDdkIsUUFBUSxDQUFDVyxPQUFPLENBQUMsbUJBQW1CLENBQUM7SUFDNUMsQ0FBQyxDQUFDO0VBQ0osQ0FBQztFQUVEakIsS0FBSyxDQUFDeUIsU0FBUyxDQUFDdUMsY0FBYyxHQUFHLFlBQVk7SUFDM0MsSUFBSSxDQUFDdkQsU0FBUyxJQUFJLElBQUksQ0FBQ0EsU0FBUyxDQUFDd0QsTUFBTSxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDeEQsU0FBUyxHQUFHLElBQUk7RUFDdkIsQ0FBQztFQUVEVCxLQUFLLENBQUN5QixTQUFTLENBQUNILFFBQVEsR0FBRyxVQUFVNEMsUUFBUSxFQUFFO0lBQzdDLElBQUlyQyxJQUFJLEdBQUcsSUFBSTtJQUNmLElBQUlzQyxPQUFPLEdBQUcsSUFBSSxDQUFDN0QsUUFBUSxDQUFDdUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sR0FBRyxFQUFFO0lBRTFELElBQUksSUFBSSxDQUFDbkMsT0FBTyxJQUFJLElBQUksQ0FBQ1IsT0FBTyxDQUFDb0IsUUFBUSxFQUFFO01BQ3pDLElBQUk4QyxTQUFTLEdBQUd6RSxDQUFDLENBQUNpRCxPQUFPLENBQUNELFVBQVUsSUFBSXdCLE9BQU87TUFFL0MsSUFBSSxDQUFDMUQsU0FBUyxHQUFHZCxDQUFDLENBQUNTLFFBQVEsQ0FBQ2lFLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUM5Q2pDLFFBQVEsQ0FBQyxpQkFBaUIsR0FBRytCLE9BQU8sQ0FBQyxDQUNyQ25CLFFBQVEsQ0FBQyxJQUFJLENBQUM3QyxLQUFLLENBQUM7TUFFdkIsSUFBSSxDQUFDRyxRQUFRLENBQUNpQyxFQUFFLENBQUMsMEJBQTBCLEVBQUU1QyxDQUFDLENBQUNxQixLQUFLLENBQUMsVUFBVWMsQ0FBQyxFQUFFO1FBQ2hFLElBQUksSUFBSSxDQUFDakIsbUJBQW1CLEVBQUU7VUFDNUIsSUFBSSxDQUFDQSxtQkFBbUIsR0FBRyxLQUFLO1VBQ2hDO1FBQ0Y7UUFDQSxJQUFJaUIsQ0FBQyxDQUFDVyxNQUFNLEtBQUtYLENBQUMsQ0FBQ3dDLGFBQWEsRUFBRTtRQUNsQyxJQUFJLENBQUNwRSxPQUFPLENBQUNvQixRQUFRLElBQUksUUFBUSxHQUM3QixJQUFJLENBQUNoQixRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUNpRSxLQUFLLENBQUMsQ0FBQyxHQUN4QixJQUFJLENBQUMzQyxJQUFJLENBQUMsQ0FBQztNQUNqQixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7TUFFVCxJQUFJd0MsU0FBUyxFQUFFLElBQUksQ0FBQzNELFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzBDLFdBQVcsRUFBQzs7TUFFN0MsSUFBSSxDQUFDMUMsU0FBUyxDQUFDMkIsUUFBUSxDQUFDLElBQUksQ0FBQztNQUU3QixJQUFJLENBQUM4QixRQUFRLEVBQUU7TUFFZkUsU0FBUyxHQUNQLElBQUksQ0FBQzNELFNBQVMsQ0FDWCtCLEdBQUcsQ0FBQyxpQkFBaUIsRUFBRTBCLFFBQVEsQ0FBQyxDQUNoQ2Isb0JBQW9CLENBQUNyRCxLQUFLLENBQUNvQiw0QkFBNEIsQ0FBQyxHQUMzRDhDLFFBQVEsQ0FBQyxDQUFDO0lBRWQsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUN4RCxPQUFPLElBQUksSUFBSSxDQUFDRCxTQUFTLEVBQUU7TUFDMUMsSUFBSSxDQUFDQSxTQUFTLENBQUMrQyxXQUFXLENBQUMsSUFBSSxDQUFDO01BRWhDLElBQUlnQixjQUFjLEdBQUcsU0FBakJBLGNBQWNBLENBQUEsRUFBZTtRQUMvQjNDLElBQUksQ0FBQ21DLGNBQWMsQ0FBQyxDQUFDO1FBQ3JCRSxRQUFRLElBQUlBLFFBQVEsQ0FBQyxDQUFDO01BQ3hCLENBQUM7TUFDRHZFLENBQUMsQ0FBQ2lELE9BQU8sQ0FBQ0QsVUFBVSxJQUFJLElBQUksQ0FBQ3JDLFFBQVEsQ0FBQ3VDLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FDcEQsSUFBSSxDQUFDcEMsU0FBUyxDQUNYK0IsR0FBRyxDQUFDLGlCQUFpQixFQUFFZ0MsY0FBYyxDQUFDLENBQ3RDbkIsb0JBQW9CLENBQUNyRCxLQUFLLENBQUNvQiw0QkFBNEIsQ0FBQyxHQUMzRG9ELGNBQWMsQ0FBQyxDQUFDO0lBRXBCLENBQUMsTUFBTSxJQUFJTixRQUFRLEVBQUU7TUFDbkJBLFFBQVEsQ0FBQyxDQUFDO0lBQ1o7RUFDRixDQUFDOztFQUVEOztFQUVBbEUsS0FBSyxDQUFDeUIsU0FBUyxDQUFDb0MsWUFBWSxHQUFHLFlBQVk7SUFDekMsSUFBSSxDQUFDWCxZQUFZLENBQUMsQ0FBQztFQUNyQixDQUFDO0VBRURsRCxLQUFLLENBQUN5QixTQUFTLENBQUN5QixZQUFZLEdBQUcsWUFBWTtJQUN6QyxJQUFJdUIsa0JBQWtCLEdBQUcsSUFBSSxDQUFDbkUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDb0UsWUFBWSxHQUFHdEUsUUFBUSxDQUFDdUUsZUFBZSxDQUFDQyxZQUFZO0lBRTlGLElBQUksQ0FBQ3RFLFFBQVEsQ0FBQ3VFLEdBQUcsQ0FBQztNQUNoQkMsV0FBVyxFQUFHLENBQUMsSUFBSSxDQUFDQyxpQkFBaUIsSUFBSU4sa0JBQWtCLEdBQUcsSUFBSSxDQUFDN0QsY0FBYyxHQUFHLEVBQUU7TUFDdEZvRSxZQUFZLEVBQUUsSUFBSSxDQUFDRCxpQkFBaUIsSUFBSSxDQUFDTixrQkFBa0IsR0FBRyxJQUFJLENBQUM3RCxjQUFjLEdBQUc7SUFDdEYsQ0FBQyxDQUFDO0VBQ0osQ0FBQztFQUVEWixLQUFLLENBQUN5QixTQUFTLENBQUNxQyxnQkFBZ0IsR0FBRyxZQUFZO0lBQzdDLElBQUksQ0FBQ3hELFFBQVEsQ0FBQ3VFLEdBQUcsQ0FBQztNQUNoQkMsV0FBVyxFQUFFLEVBQUU7TUFDZkUsWUFBWSxFQUFFO0lBQ2hCLENBQUMsQ0FBQztFQUNKLENBQUM7RUFFRGhGLEtBQUssQ0FBQ3lCLFNBQVMsQ0FBQ1MsY0FBYyxHQUFHLFlBQVk7SUFDM0MsSUFBSStDLGVBQWUsR0FBR3JCLE1BQU0sQ0FBQ3NCLFVBQVU7SUFDdkMsSUFBSSxDQUFDRCxlQUFlLEVBQUU7TUFBRTtNQUN0QixJQUFJRSxtQkFBbUIsR0FBRy9FLFFBQVEsQ0FBQ3VFLGVBQWUsQ0FBQ1MscUJBQXFCLENBQUMsQ0FBQztNQUMxRUgsZUFBZSxHQUFHRSxtQkFBbUIsQ0FBQ0UsS0FBSyxHQUFHQyxJQUFJLENBQUNDLEdBQUcsQ0FBQ0osbUJBQW1CLENBQUNLLElBQUksQ0FBQztJQUNsRjtJQUNBLElBQUksQ0FBQ1QsaUJBQWlCLEdBQUczRSxRQUFRLENBQUNDLElBQUksQ0FBQ29GLFdBQVcsR0FBR1IsZUFBZTtJQUNwRSxJQUFJLENBQUNyRSxjQUFjLEdBQUcsSUFBSSxDQUFDOEUsZ0JBQWdCLENBQUMsQ0FBQztFQUMvQyxDQUFDO0VBRUQxRixLQUFLLENBQUN5QixTQUFTLENBQUNVLFlBQVksR0FBRyxZQUFZO0lBQ3pDLElBQUl3RCxPQUFPLEdBQUdDLFFBQVEsQ0FBRSxJQUFJLENBQUN6RixLQUFLLENBQUMwRSxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFHLEVBQUUsQ0FBQztJQUNsRSxJQUFJLENBQUNsRSxlQUFlLEdBQUdQLFFBQVEsQ0FBQ0MsSUFBSSxDQUFDd0YsS0FBSyxDQUFDYixZQUFZLElBQUksRUFBRTtJQUM3RCxJQUFJLElBQUksQ0FBQ0QsaUJBQWlCLEVBQUUsSUFBSSxDQUFDNUUsS0FBSyxDQUFDMEUsR0FBRyxDQUFDLGVBQWUsRUFBRWMsT0FBTyxHQUFHLElBQUksQ0FBQy9FLGNBQWMsQ0FBQztFQUM1RixDQUFDO0VBRURaLEtBQUssQ0FBQ3lCLFNBQVMsQ0FBQ3NDLGNBQWMsR0FBRyxZQUFZO0lBQzNDLElBQUksQ0FBQzVELEtBQUssQ0FBQzBFLEdBQUcsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDbEUsZUFBZSxDQUFDO0VBQ3ZELENBQUM7RUFFRFgsS0FBSyxDQUFDeUIsU0FBUyxDQUFDaUUsZ0JBQWdCLEdBQUcsWUFBWTtJQUFFO0lBQy9DLElBQUlJLFNBQVMsR0FBRzFGLFFBQVEsQ0FBQ2lFLGFBQWEsQ0FBQyxLQUFLLENBQUM7SUFDN0N5QixTQUFTLENBQUNDLFNBQVMsR0FBRyx5QkFBeUI7SUFDL0MsSUFBSSxDQUFDNUYsS0FBSyxDQUFDNkYsTUFBTSxDQUFDRixTQUFTLENBQUM7SUFDNUIsSUFBSWxGLGNBQWMsR0FBR2tGLFNBQVMsQ0FBQzNDLFdBQVcsR0FBRzJDLFNBQVMsQ0FBQ0wsV0FBVztJQUNsRSxJQUFJLENBQUN0RixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM4RixXQUFXLENBQUNILFNBQVMsQ0FBQztJQUNwQyxPQUFPbEYsY0FBYztFQUN2QixDQUFDOztFQUdEO0VBQ0E7O0VBRUEsU0FBU3NGLE1BQU1BLENBQUNDLE1BQU0sRUFBRXhFLGNBQWMsRUFBRTtJQUN0QyxPQUFPLElBQUksQ0FBQ3lFLElBQUksQ0FBQyxZQUFZO01BQzNCLElBQUlDLEtBQUssR0FBSzFHLENBQUMsQ0FBQyxJQUFJLENBQUM7TUFDckIsSUFBSTJHLElBQUksR0FBTUQsS0FBSyxDQUFDQyxJQUFJLENBQUMsWUFBWSxDQUFDO01BQ3RDLElBQUlwRyxPQUFPLEdBQUdQLENBQUMsQ0FBQzRHLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRXZHLEtBQUssQ0FBQ3FCLFFBQVEsRUFBRWdGLEtBQUssQ0FBQ0MsSUFBSSxDQUFDLENBQUMsRUFBRUUsT0FBQSxDQUFPTCxNQUFNLEtBQUksUUFBUSxJQUFJQSxNQUFNLENBQUM7TUFFN0YsSUFBSSxDQUFDRyxJQUFJLEVBQUVELEtBQUssQ0FBQ0MsSUFBSSxDQUFDLFlBQVksRUFBR0EsSUFBSSxHQUFHLElBQUl0RyxLQUFLLENBQUMsSUFBSSxFQUFFRSxPQUFPLENBQUUsQ0FBQztNQUN0RSxJQUFJLE9BQU9pRyxNQUFNLElBQUksUUFBUSxFQUFFRyxJQUFJLENBQUNILE1BQU0sQ0FBQyxDQUFDeEUsY0FBYyxDQUFDLE1BQ3RELElBQUl6QixPQUFPLENBQUNzQixJQUFJLEVBQUU4RSxJQUFJLENBQUM5RSxJQUFJLENBQUNHLGNBQWMsQ0FBQztJQUNsRCxDQUFDLENBQUM7RUFDSjtFQUVBLElBQUk4RSxHQUFHLEdBQUc5RyxDQUFDLENBQUNFLEVBQUUsQ0FBQzZHLGFBQWE7RUFFNUIvRyxDQUFDLENBQUNFLEVBQUUsQ0FBQzZHLGFBQWEsR0FBZVIsTUFBTTtFQUN2Q3ZHLENBQUMsQ0FBQ0UsRUFBRSxDQUFDNkcsYUFBYSxDQUFDQyxXQUFXLEdBQUczRyxLQUFLOztFQUd0QztFQUNBOztFQUVBTCxDQUFDLENBQUNFLEVBQUUsQ0FBQzZHLGFBQWEsQ0FBQ0UsVUFBVSxHQUFHLFlBQVk7SUFDMUNqSCxDQUFDLENBQUNFLEVBQUUsQ0FBQzZHLGFBQWEsR0FBR0QsR0FBRztJQUN4QixPQUFPLElBQUk7RUFDYixDQUFDOztFQUdEO0VBQ0E7O0VBRUE5RyxDQUFDLENBQUNTLFFBQVEsQ0FBQyxDQUFDbUMsRUFBRSxDQUFDLDJCQUEyQixFQUFFLCtCQUErQixFQUFFLFVBQVVULENBQUMsRUFBRTtJQUN4RixJQUFJdUUsS0FBSyxHQUFLMUcsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUNyQixJQUFJa0gsSUFBSSxHQUFNUixLQUFLLENBQUNTLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDaEMsSUFBSUMsT0FBTyxHQUFHcEgsQ0FBQyxDQUFDMEcsS0FBSyxDQUFDUyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUtELElBQUksSUFBSUEsSUFBSSxDQUFDRyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFFLENBQUMsRUFBQztJQUMzRixJQUFJYixNQUFNLEdBQUlZLE9BQU8sQ0FBQ1QsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLFFBQVEsR0FBRzNHLENBQUMsQ0FBQzRHLE1BQU0sQ0FBQztNQUFFekYsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDbUcsSUFBSSxDQUFDSixJQUFJLENBQUMsSUFBSUE7SUFBSyxDQUFDLEVBQUVFLE9BQU8sQ0FBQ1QsSUFBSSxDQUFDLENBQUMsRUFBRUQsS0FBSyxDQUFDQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBRWpJLElBQUlELEtBQUssQ0FBQzNELEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRVosQ0FBQyxDQUFDd0IsY0FBYyxDQUFDLENBQUM7SUFFckN5RCxPQUFPLENBQUN2RSxHQUFHLENBQUMsaUJBQWlCLEVBQUUsVUFBVTBFLFNBQVMsRUFBRTtNQUNsRCxJQUFJQSxTQUFTLENBQUNqRixrQkFBa0IsQ0FBQyxDQUFDLEVBQUUsT0FBTSxDQUFDO01BQzNDOEUsT0FBTyxDQUFDdkUsR0FBRyxDQUFDLG1CQUFtQixFQUFFLFlBQVk7UUFDM0M2RCxLQUFLLENBQUMzRCxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUkyRCxLQUFLLENBQUNwRixPQUFPLENBQUMsT0FBTyxDQUFDO01BQ2hELENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQztJQUNGaUYsTUFBTSxDQUFDaUIsSUFBSSxDQUFDSixPQUFPLEVBQUVaLE1BQU0sRUFBRSxJQUFJLENBQUM7RUFDcEMsQ0FBQyxDQUFDO0FBRUosQ0FBQyxDQUFDMUcsTUFBTSxDQUFDO0FBR1QsQ0FBQyxVQUFVRSxDQUFDLEVBQUU7RUFDWixZQUFZOztFQUVaO0VBQ0E7RUFFQSxJQUFJMkIsUUFBUSxHQUFHLG9CQUFvQjtFQUNuQyxJQUFJSSxNQUFNLEdBQUssK0JBQStCO0VBQzlDLElBQUkwRixRQUFRLEdBQUcsU0FBWEEsUUFBUUEsQ0FBYW5ILE9BQU8sRUFBRTtJQUNoQ04sQ0FBQyxDQUFDTSxPQUFPLENBQUMsQ0FBQ3NDLEVBQUUsQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUNiLE1BQU0sQ0FBQztFQUNuRCxDQUFDO0VBRUQwRixRQUFRLENBQUNsRyxPQUFPLEdBQUcsT0FBTztFQUUxQixTQUFTbUcsU0FBU0EsQ0FBQ2hCLEtBQUssRUFBRTtJQUN4QixJQUFJaUIsUUFBUSxHQUFHakIsS0FBSyxDQUFDUyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBRXhDLElBQUksQ0FBQ1EsUUFBUSxFQUFFO01BQ2JBLFFBQVEsR0FBR2pCLEtBQUssQ0FBQ1MsSUFBSSxDQUFDLE1BQU0sQ0FBQztNQUM3QlEsUUFBUSxHQUFHQSxRQUFRLElBQUksV0FBVyxDQUFDTCxJQUFJLENBQUNLLFFBQVEsQ0FBQyxJQUFJQSxRQUFRLENBQUNOLE9BQU8sQ0FBQyxnQkFBZ0IsRUFBRSxFQUFFLENBQUMsRUFBQztJQUM5RjtJQUVBLElBQUlPLE9BQU8sR0FBR0QsUUFBUSxJQUFJM0gsQ0FBQyxDQUFDMkgsUUFBUSxDQUFDO0lBRXJDLE9BQU9DLE9BQU8sSUFBSUEsT0FBTyxDQUFDeEUsTUFBTSxHQUFHd0UsT0FBTyxHQUFHbEIsS0FBSyxDQUFDdkQsTUFBTSxDQUFDLENBQUM7RUFDN0Q7RUFFQSxTQUFTMEUsVUFBVUEsQ0FBQzFGLENBQUMsRUFBRTtJQUNyQixJQUFJQSxDQUFDLElBQUlBLENBQUMsQ0FBQzZCLEtBQUssS0FBSyxDQUFDLEVBQUU7SUFDeEJoRSxDQUFDLENBQUMyQixRQUFRLENBQUMsQ0FBQzJDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BCdEUsQ0FBQyxDQUFDK0IsTUFBTSxDQUFDLENBQUMwRSxJQUFJLENBQUMsWUFBWTtNQUN6QixJQUFJQyxLQUFLLEdBQVcxRyxDQUFDLENBQUMsSUFBSSxDQUFDO01BQzNCLElBQUk0SCxPQUFPLEdBQVNGLFNBQVMsQ0FBQ2hCLEtBQUssQ0FBQztNQUNwQyxJQUFJckUsYUFBYSxHQUFHO1FBQUVBLGFBQWEsRUFBRTtNQUFLLENBQUM7TUFFM0MsSUFBSSxDQUFDdUYsT0FBTyxDQUFDMUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFO01BRS9CLElBQUlmLENBQUMsSUFBSUEsQ0FBQyxDQUFDMkYsSUFBSSxJQUFJLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQ1IsSUFBSSxDQUFDbkYsQ0FBQyxDQUFDVyxNQUFNLENBQUNpRixPQUFPLENBQUMsSUFBSS9ILENBQUMsQ0FBQ2dJLFFBQVEsQ0FBQ0osT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFekYsQ0FBQyxDQUFDVyxNQUFNLENBQUMsRUFBRTtNQUU1RzhFLE9BQU8sQ0FBQ3RHLE9BQU8sQ0FBQ2EsQ0FBQyxHQUFHbkMsQ0FBQyxDQUFDb0MsS0FBSyxDQUFDLG9CQUFvQixFQUFFQyxhQUFhLENBQUMsQ0FBQztNQUVqRSxJQUFJRixDQUFDLENBQUNHLGtCQUFrQixDQUFDLENBQUMsRUFBRTtNQUU1Qm9FLEtBQUssQ0FBQ1MsSUFBSSxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUM7TUFDcENTLE9BQU8sQ0FBQy9ELFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQ3ZDLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRWUsYUFBYSxDQUFDO0lBQzVFLENBQUMsQ0FBQztFQUNKO0VBRUFvRixRQUFRLENBQUMzRixTQUFTLENBQUNDLE1BQU0sR0FBRyxVQUFVSSxDQUFDLEVBQUU7SUFDdkMsSUFBSXVFLEtBQUssR0FBRzFHLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFbkIsSUFBSTBHLEtBQUssQ0FBQzNELEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxFQUFFO0lBRXRDLElBQUk2RSxPQUFPLEdBQUlGLFNBQVMsQ0FBQ2hCLEtBQUssQ0FBQztJQUMvQixJQUFJdUIsUUFBUSxHQUFHTCxPQUFPLENBQUMxRSxRQUFRLENBQUMsTUFBTSxDQUFDO0lBRXZDMkUsVUFBVSxDQUFDLENBQUM7SUFFWixJQUFJLENBQUNJLFFBQVEsRUFBRTtNQUNiLElBQUksY0FBYyxJQUFJeEgsUUFBUSxDQUFDdUUsZUFBZSxJQUFJLENBQUM0QyxPQUFPLENBQUNNLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQzlFLE1BQU0sRUFBRTtRQUN4RjtRQUNBcEQsQ0FBQyxDQUFDUyxRQUFRLENBQUNpRSxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FDN0JqQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsQ0FDN0IwRixXQUFXLENBQUNuSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FDcEI0QyxFQUFFLENBQUMsT0FBTyxFQUFFaUYsVUFBVSxDQUFDO01BQzVCO01BRUEsSUFBSXhGLGFBQWEsR0FBRztRQUFFQSxhQUFhLEVBQUU7TUFBSyxDQUFDO01BQzNDdUYsT0FBTyxDQUFDdEcsT0FBTyxDQUFDYSxDQUFDLEdBQUduQyxDQUFDLENBQUNvQyxLQUFLLENBQUMsb0JBQW9CLEVBQUVDLGFBQWEsQ0FBQyxDQUFDO01BRWpFLElBQUlGLENBQUMsQ0FBQ0csa0JBQWtCLENBQUMsQ0FBQyxFQUFFO01BRTVCb0UsS0FBSyxDQUNGcEYsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUNoQjZGLElBQUksQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDO01BRWhDUyxPQUFPLENBQ0pRLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FDbkI5RyxPQUFPLENBQUMscUJBQXFCLEVBQUVlLGFBQWEsQ0FBQztJQUNsRDtJQUVBLE9BQU8sS0FBSztFQUNkLENBQUM7RUFFRG9GLFFBQVEsQ0FBQzNGLFNBQVMsQ0FBQ3VHLE9BQU8sR0FBRyxVQUFVbEcsQ0FBQyxFQUFFO0lBQ3hDLElBQUksQ0FBQyxlQUFlLENBQUNtRixJQUFJLENBQUNuRixDQUFDLENBQUM2QixLQUFLLENBQUMsSUFBSSxpQkFBaUIsQ0FBQ3NELElBQUksQ0FBQ25GLENBQUMsQ0FBQ1csTUFBTSxDQUFDaUYsT0FBTyxDQUFDLEVBQUU7SUFFaEYsSUFBSXJCLEtBQUssR0FBRzFHLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFbkJtQyxDQUFDLENBQUN3QixjQUFjLENBQUMsQ0FBQztJQUNsQnhCLENBQUMsQ0FBQ21HLGVBQWUsQ0FBQyxDQUFDO0lBRW5CLElBQUk1QixLQUFLLENBQUMzRCxFQUFFLENBQUMsc0JBQXNCLENBQUMsRUFBRTtJQUV0QyxJQUFJNkUsT0FBTyxHQUFJRixTQUFTLENBQUNoQixLQUFLLENBQUM7SUFDL0IsSUFBSXVCLFFBQVEsR0FBR0wsT0FBTyxDQUFDMUUsUUFBUSxDQUFDLE1BQU0sQ0FBQztJQUV2QyxJQUFJLENBQUMrRSxRQUFRLElBQUk5RixDQUFDLENBQUM2QixLQUFLLElBQUksRUFBRSxJQUFJaUUsUUFBUSxJQUFJOUYsQ0FBQyxDQUFDNkIsS0FBSyxJQUFJLEVBQUUsRUFBRTtNQUMzRCxJQUFJN0IsQ0FBQyxDQUFDNkIsS0FBSyxJQUFJLEVBQUUsRUFBRTRELE9BQU8sQ0FBQy9HLElBQUksQ0FBQ2tCLE1BQU0sQ0FBQyxDQUFDVCxPQUFPLENBQUMsT0FBTyxDQUFDO01BQ3hELE9BQU9vRixLQUFLLENBQUNwRixPQUFPLENBQUMsT0FBTyxDQUFDO0lBQy9CO0lBRUEsSUFBSWlILElBQUksR0FBRyw4QkFBOEI7SUFDekMsSUFBSUMsTUFBTSxHQUFHWixPQUFPLENBQUMvRyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcwSCxJQUFJLEdBQUcsb0JBQW9CLEdBQUdBLElBQUksQ0FBQztJQUVoRixJQUFJLENBQUNDLE1BQU0sQ0FBQ3BGLE1BQU0sRUFBRTtJQUVwQixJQUFJcUYsS0FBSyxHQUFHRCxNQUFNLENBQUNDLEtBQUssQ0FBQ3RHLENBQUMsQ0FBQ1csTUFBTSxDQUFDO0lBRWxDLElBQUlYLENBQUMsQ0FBQzZCLEtBQUssSUFBSSxFQUFFLElBQUl5RSxLQUFLLEdBQUcsQ0FBQyxFQUFrQkEsS0FBSyxFQUFFLEVBQVM7SUFDaEUsSUFBSXRHLENBQUMsQ0FBQzZCLEtBQUssSUFBSSxFQUFFLElBQUl5RSxLQUFLLEdBQUdELE1BQU0sQ0FBQ3BGLE1BQU0sR0FBRyxDQUFDLEVBQUVxRixLQUFLLEVBQUUsRUFBUztJQUNoRSxJQUFJLENBQUMsQ0FBQ0EsS0FBSyxFQUFxQ0EsS0FBSyxHQUFHLENBQUM7SUFFekRELE1BQU0sQ0FBQ0UsRUFBRSxDQUFDRCxLQUFLLENBQUMsQ0FBQ25ILE9BQU8sQ0FBQyxPQUFPLENBQUM7RUFDbkMsQ0FBQzs7RUFHRDtFQUNBOztFQUVBLFNBQVNpRixNQUFNQSxDQUFDQyxNQUFNLEVBQUU7SUFDdEIsT0FBTyxJQUFJLENBQUNDLElBQUksQ0FBQyxZQUFZO01BQzNCLElBQUlDLEtBQUssR0FBRzFHLENBQUMsQ0FBQyxJQUFJLENBQUM7TUFDbkIsSUFBSTJHLElBQUksR0FBSUQsS0FBSyxDQUFDQyxJQUFJLENBQUMsZUFBZSxDQUFDO01BRXZDLElBQUksQ0FBQ0EsSUFBSSxFQUFFRCxLQUFLLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUdBLElBQUksR0FBRyxJQUFJYyxRQUFRLENBQUMsSUFBSSxDQUFFLENBQUM7TUFDbkUsSUFBSSxPQUFPakIsTUFBTSxJQUFJLFFBQVEsRUFBRUcsSUFBSSxDQUFDSCxNQUFNLENBQUMsQ0FBQ2dCLElBQUksQ0FBQ2QsS0FBSyxDQUFDO0lBQ3pELENBQUMsQ0FBQztFQUNKO0VBRUEsSUFBSUksR0FBRyxHQUFHOUcsQ0FBQyxDQUFDRSxFQUFFLENBQUN5SSxhQUFhO0VBRTVCM0ksQ0FBQyxDQUFDRSxFQUFFLENBQUN5SSxhQUFhLEdBQWVwQyxNQUFNO0VBQ3ZDdkcsQ0FBQyxDQUFDRSxFQUFFLENBQUN5SSxhQUFhLENBQUMzQixXQUFXLEdBQUdTLFFBQVE7O0VBR3pDO0VBQ0E7O0VBRUF6SCxDQUFDLENBQUNFLEVBQUUsQ0FBQ3lJLGFBQWEsQ0FBQzFCLFVBQVUsR0FBRyxZQUFZO0lBQzFDakgsQ0FBQyxDQUFDRSxFQUFFLENBQUN5SSxhQUFhLEdBQUc3QixHQUFHO0lBQ3hCLE9BQU8sSUFBSTtFQUNiLENBQUM7O0VBR0Q7RUFDQTs7RUFFQTlHLENBQUMsQ0FBQ1MsUUFBUSxDQUFDLENBQ1JtQyxFQUFFLENBQUMsOEJBQThCLEVBQUVpRixVQUFVLENBQUMsQ0FDOUNqRixFQUFFLENBQUMsOEJBQThCLEVBQUUsZ0JBQWdCLEVBQUUsVUFBVVQsQ0FBQyxFQUFFO0lBQUVBLENBQUMsQ0FBQ21HLGVBQWUsQ0FBQyxDQUFDO0VBQUMsQ0FBQyxDQUFDLENBQzFGMUYsRUFBRSxDQUFDLDhCQUE4QixFQUFFYixNQUFNLEVBQUUwRixRQUFRLENBQUMzRixTQUFTLENBQUNDLE1BQU0sQ0FBQyxDQUNyRWEsRUFBRSxDQUFDLGdDQUFnQyxFQUFFYixNQUFNLEVBQUUwRixRQUFRLENBQUMzRixTQUFTLENBQUN1RyxPQUFPLENBQUMsQ0FDeEV6RixFQUFFLENBQUMsZ0NBQWdDLEVBQUUsZ0JBQWdCLEVBQUU2RSxRQUFRLENBQUMzRixTQUFTLENBQUN1RyxPQUFPLENBQUMsQ0FDbEZ6RixFQUFFLENBQUMsZ0NBQWdDLEVBQUUsbUJBQW1CLEVBQUU2RSxRQUFRLENBQUMzRixTQUFTLENBQUN1RyxPQUFPLENBQUM7QUFFMUYsQ0FBQyxDQUFDdkksTUFBTSxDQUFDIiwiaWdub3JlTGlzdCI6W119
