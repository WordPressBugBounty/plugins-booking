"use strict";

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
  var Modal = function (element, options) {
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
    show: true,
    enforceFocus: true
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
      if (that.options.enforceFocus !== false) {
        that.enforceFocus();
      }
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
    if (this.options.enforceFocus !== false) {
      $(document).off('focusin.wpbc.modal');
    }
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
      var callbackRemove = function () {
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
      var options = $.extend({}, Modal.DEFAULTS, $this.data(), typeof option == 'object' && option);
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
  var Dropdown = function (element) {
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmVuZG9ycy9fY3VzdG9tL2Ryb3Bkb3duX21vZGFsL19vdXQvZHJvcGRvd25fbW9kYWwuanMiLCJuYW1lcyI6WyJqUXVlcnkiLCJFcnJvciIsIiQiLCJ2ZXJzaW9uIiwiZm4iLCJqcXVlcnkiLCJzcGxpdCIsIk1vZGFsIiwiZWxlbWVudCIsIm9wdGlvbnMiLCIkYm9keSIsImRvY3VtZW50IiwiYm9keSIsIiRlbGVtZW50IiwiJGRpYWxvZyIsImZpbmQiLCIkYmFja2Ryb3AiLCJpc1Nob3duIiwib3JpZ2luYWxCb2R5UGFkIiwic2Nyb2xsYmFyV2lkdGgiLCJpZ25vcmVCYWNrZHJvcENsaWNrIiwicmVtb3RlIiwibG9hZCIsInByb3h5IiwidHJpZ2dlciIsIlZFUlNJT04iLCJUUkFOU0lUSU9OX0RVUkFUSU9OIiwiQkFDS0RST1BfVFJBTlNJVElPTl9EVVJBVElPTiIsIkRFRkFVTFRTIiwiYmFja2Ryb3AiLCJrZXlib2FyZCIsInNob3ciLCJlbmZvcmNlRm9jdXMiLCJwcm90b3R5cGUiLCJ0b2dnbGUiLCJfcmVsYXRlZFRhcmdldCIsImhpZGUiLCJ0aGF0IiwiZSIsIkV2ZW50IiwicmVsYXRlZFRhcmdldCIsImlzRGVmYXVsdFByZXZlbnRlZCIsImNoZWNrU2Nyb2xsYmFyIiwic2V0U2Nyb2xsYmFyIiwiYWRkQ2xhc3MiLCJlc2NhcGUiLCJyZXNpemUiLCJvbiIsIm9uZSIsInRhcmdldCIsImlzIiwidHJhbnNpdGlvbiIsInN1cHBvcnQiLCJoYXNDbGFzcyIsInBhcmVudCIsImxlbmd0aCIsImFwcGVuZFRvIiwic2Nyb2xsVG9wIiwiYWRqdXN0RGlhbG9nIiwib2Zmc2V0V2lkdGgiLCJlbXVsYXRlVHJhbnNpdGlvbkVuZCIsInByZXZlbnREZWZhdWx0Iiwib2ZmIiwicmVtb3ZlQ2xhc3MiLCJoaWRlTW9kYWwiLCJoYXMiLCJ3aGljaCIsIndpbmRvdyIsImhhbmRsZVVwZGF0ZSIsInJlc2V0QWRqdXN0bWVudHMiLCJyZXNldFNjcm9sbGJhciIsInJlbW92ZUJhY2tkcm9wIiwicmVtb3ZlIiwiY2FsbGJhY2siLCJhbmltYXRlIiwiZG9BbmltYXRlIiwiY3JlYXRlRWxlbWVudCIsImN1cnJlbnRUYXJnZXQiLCJmb2N1cyIsImNhbGxiYWNrUmVtb3ZlIiwibW9kYWxJc092ZXJmbG93aW5nIiwic2Nyb2xsSGVpZ2h0IiwiZG9jdW1lbnRFbGVtZW50IiwiY2xpZW50SGVpZ2h0IiwiY3NzIiwicGFkZGluZ0xlZnQiLCJib2R5SXNPdmVyZmxvd2luZyIsInBhZGRpbmdSaWdodCIsImZ1bGxXaW5kb3dXaWR0aCIsImlubmVyV2lkdGgiLCJkb2N1bWVudEVsZW1lbnRSZWN0IiwiZ2V0Qm91bmRpbmdDbGllbnRSZWN0IiwicmlnaHQiLCJNYXRoIiwiYWJzIiwibGVmdCIsImNsaWVudFdpZHRoIiwibWVhc3VyZVNjcm9sbGJhciIsImJvZHlQYWQiLCJwYXJzZUludCIsInN0eWxlIiwic2Nyb2xsRGl2IiwiY2xhc3NOYW1lIiwiYXBwZW5kIiwicmVtb3ZlQ2hpbGQiLCJQbHVnaW4iLCJvcHRpb24iLCJlYWNoIiwiJHRoaXMiLCJkYXRhIiwiZXh0ZW5kIiwib2xkIiwid3BiY19teV9tb2RhbCIsIkNvbnN0cnVjdG9yIiwibm9Db25mbGljdCIsImhyZWYiLCJhdHRyIiwiJHRhcmdldCIsInJlcGxhY2UiLCJ0ZXN0Iiwic2hvd0V2ZW50IiwiY2FsbCIsIkRyb3Bkb3duIiwiZ2V0UGFyZW50Iiwic2VsZWN0b3IiLCIkcGFyZW50IiwiY2xlYXJNZW51cyIsInR5cGUiLCJ0YWdOYW1lIiwiY29udGFpbnMiLCJpc0FjdGl2ZSIsImNsb3Nlc3QiLCJpbnNlcnRBZnRlciIsInRvZ2dsZUNsYXNzIiwia2V5ZG93biIsInN0b3BQcm9wYWdhdGlvbiIsImRlc2MiLCIkaXRlbXMiLCJpbmRleCIsImVxIiwid3BiY19kcm9wZG93biJdLCJzb3VyY2VzIjpbInZlbmRvcnMvX2N1c3RvbS9kcm9wZG93bl9tb2RhbC9fc3JjL2Ryb3Bkb3duX21vZGFsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIVxyXG4gKiBHZW5lcmF0ZWQgdXNpbmcgdGhlIEJvb3RzdHJhcCBDdXN0b21pemVyIChodHRwOi8vZ2V0Ym9vdHN0cmFwLmNvbS9jdXN0b21pemUvP2lkPWY0YjRjOWNiODVkZjc1N2NhMDhjKVxyXG4gKiBDb25maWcgc2F2ZWQgdG8gY29uZmlnLmpzb24gYW5kIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2Y0YjRjOWNiODVkZjc1N2NhMDhjXHJcbiAqL1xyXG5pZiAodHlwZW9mIGpRdWVyeSA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICB0aHJvdyBuZXcgRXJyb3IoJ0Jvb3RzdHJhcFxcJ3MgSmF2YVNjcmlwdCByZXF1aXJlcyBqUXVlcnknKVxyXG59XHJcbitmdW5jdGlvbiAoJCkge1xyXG4gICd1c2Ugc3RyaWN0JztcclxuICB2YXIgdmVyc2lvbiA9ICQuZm4uanF1ZXJ5LnNwbGl0KCcgJylbMF0uc3BsaXQoJy4nKVxyXG4gIGlmICgodmVyc2lvblswXSA8IDIgJiYgdmVyc2lvblsxXSA8IDkpIHx8ICh2ZXJzaW9uWzBdID09IDEgJiYgdmVyc2lvblsxXSA9PSA5ICYmIHZlcnNpb25bMl0gPCAxKSkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCdCb290c3RyYXBcXCdzIEphdmFTY3JpcHQgcmVxdWlyZXMgalF1ZXJ5IHZlcnNpb24gMS45LjEgb3IgaGlnaGVyJylcclxuICB9XHJcbn0oalF1ZXJ5KTtcclxuXHJcbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBCb290c3RyYXA6IG1vZGFsLmpzIHYzLjMuNVxyXG4gKiBodHRwOi8vZ2V0Ym9vdHN0cmFwLmNvbS9qYXZhc2NyaXB0LyNtb2RhbHNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqIENvcHlyaWdodCAyMDExLTIwMTUgVHdpdHRlciwgSW5jLlxyXG4gKiBMaWNlbnNlZCB1bmRlciBNSVQgKGh0dHBzOi8vZ2l0aHViLmNvbS90d2JzL2Jvb3RzdHJhcC9ibG9iL21hc3Rlci9MSUNFTlNFKVxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcblxyXG4rZnVuY3Rpb24gKCQpIHtcclxuICAndXNlIHN0cmljdCc7XHJcblxyXG4gIC8vIE1PREFMIENMQVNTIERFRklOSVRJT05cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIHZhciBNb2RhbCA9IGZ1bmN0aW9uIChlbGVtZW50LCBvcHRpb25zKSB7XHJcbiAgICB0aGlzLm9wdGlvbnMgICAgICAgICAgICAgPSBvcHRpb25zXHJcbiAgICB0aGlzLiRib2R5ICAgICAgICAgICAgICAgPSAkKGRvY3VtZW50LmJvZHkpXHJcbiAgICB0aGlzLiRlbGVtZW50ICAgICAgICAgICAgPSAkKGVsZW1lbnQpXHJcbiAgICB0aGlzLiRkaWFsb2cgICAgICAgICAgICAgPSB0aGlzLiRlbGVtZW50LmZpbmQoJy5tb2RhbC1kaWFsb2cnKVxyXG4gICAgdGhpcy4kYmFja2Ryb3AgICAgICAgICAgID0gbnVsbFxyXG4gICAgdGhpcy5pc1Nob3duICAgICAgICAgICAgID0gbnVsbFxyXG4gICAgdGhpcy5vcmlnaW5hbEJvZHlQYWQgICAgID0gbnVsbFxyXG4gICAgdGhpcy5zY3JvbGxiYXJXaWR0aCAgICAgID0gMFxyXG4gICAgdGhpcy5pZ25vcmVCYWNrZHJvcENsaWNrID0gZmFsc2VcclxuXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLnJlbW90ZSkge1xyXG4gICAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgICAgLmZpbmQoJy5tb2RhbC1jb250ZW50JylcclxuICAgICAgICAubG9hZCh0aGlzLm9wdGlvbnMucmVtb3RlLCAkLnByb3h5KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcignbG9hZGVkLndwYmMubW9kYWwnKVxyXG4gICAgICAgIH0sIHRoaXMpKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgTW9kYWwuVkVSU0lPTiAgPSAnMy4zLjUnXHJcblxyXG4gIE1vZGFsLlRSQU5TSVRJT05fRFVSQVRJT04gPSAzMDBcclxuICBNb2RhbC5CQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OID0gMTUwXHJcblxyXG4gIE1vZGFsLkRFRkFVTFRTID0ge1xyXG4gICAgYmFja2Ryb3A6IHRydWUsXHJcbiAgICBrZXlib2FyZDogdHJ1ZSxcclxuICAgIHNob3c6IHRydWUsXHJcbiAgICBlbmZvcmNlRm9jdXM6IHRydWVcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbiAoX3JlbGF0ZWRUYXJnZXQpIHtcclxuICAgIHJldHVybiB0aGlzLmlzU2hvd24gPyB0aGlzLmhpZGUoKSA6IHRoaXMuc2hvdyhfcmVsYXRlZFRhcmdldClcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5zaG93ID0gZnVuY3Rpb24gKF9yZWxhdGVkVGFyZ2V0KSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXNcclxuICAgIHZhciBlICAgID0gJC5FdmVudCgnc2hvdy53cGJjLm1vZGFsJywgeyByZWxhdGVkVGFyZ2V0OiBfcmVsYXRlZFRhcmdldCB9KVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcihlKVxyXG5cclxuICAgIGlmICh0aGlzLmlzU2hvd24gfHwgZS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkgcmV0dXJuXHJcblxyXG4gICAgdGhpcy5pc1Nob3duID0gdHJ1ZVxyXG5cclxuICAgIHRoaXMuY2hlY2tTY3JvbGxiYXIoKVxyXG4gICAgdGhpcy5zZXRTY3JvbGxiYXIoKVxyXG4gICAgdGhpcy4kYm9keS5hZGRDbGFzcygnbW9kYWwtb3BlbicpXHJcblxyXG4gICAgdGhpcy5lc2NhcGUoKVxyXG4gICAgdGhpcy5yZXNpemUoKVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQub24oJ2NsaWNrLmRpc21pc3Mud3BiYy5tb2RhbCcsICdbZGF0YS1kaXNtaXNzPVwibW9kYWxcIl0nLCAkLnByb3h5KHRoaXMuaGlkZSwgdGhpcykpXHJcblxyXG4gICAgdGhpcy4kZGlhbG9nLm9uKCdtb3VzZWRvd24uZGlzbWlzcy53cGJjLm1vZGFsJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICB0aGF0LiRlbGVtZW50Lm9uZSgnbW91c2V1cC5kaXNtaXNzLndwYmMubW9kYWwnLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGlmICgkKGUudGFyZ2V0KS5pcyh0aGF0LiRlbGVtZW50KSkgdGhhdC5pZ25vcmVCYWNrZHJvcENsaWNrID0gdHJ1ZVxyXG4gICAgICB9KVxyXG4gICAgfSlcclxuXHJcbiAgICB0aGlzLmJhY2tkcm9wKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdmFyIHRyYW5zaXRpb24gPSAkLnN1cHBvcnQudHJhbnNpdGlvbiAmJiB0aGF0LiRlbGVtZW50Lmhhc0NsYXNzKCdmYWRlJylcclxuXHJcbiAgICAgIGlmICghdGhhdC4kZWxlbWVudC5wYXJlbnQoKS5sZW5ndGgpIHtcclxuICAgICAgICB0aGF0LiRlbGVtZW50LmFwcGVuZFRvKHRoYXQuJGJvZHkpIC8vIGRvbid0IG1vdmUgbW9kYWxzIGRvbSBwb3NpdGlvblxyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGF0LiRlbGVtZW50XHJcbiAgICAgICAgLnNob3coKVxyXG4gICAgICAgIC5zY3JvbGxUb3AoMClcclxuXHJcbiAgICAgIHRoYXQuYWRqdXN0RGlhbG9nKClcclxuXHJcbiAgICAgIGlmICh0cmFuc2l0aW9uKSB7XHJcbiAgICAgICAgdGhhdC4kZWxlbWVudFswXS5vZmZzZXRXaWR0aCAvLyBmb3JjZSByZWZsb3dcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhhdC4kZWxlbWVudC5hZGRDbGFzcygnaW4nKVxyXG5cclxuXHRcdGlmICggdGhhdC5vcHRpb25zLmVuZm9yY2VGb2N1cyAhPT0gZmFsc2UgKSB7XHJcblx0XHRcdHRoYXQuZW5mb3JjZUZvY3VzKCk7XHJcblx0XHR9XHJcblxyXG4gICAgICB2YXIgZSA9ICQuRXZlbnQoJ3Nob3duLndwYmMubW9kYWwnLCB7IHJlbGF0ZWRUYXJnZXQ6IF9yZWxhdGVkVGFyZ2V0IH0pXHJcblxyXG4gICAgICB0cmFuc2l0aW9uID9cclxuICAgICAgICB0aGF0LiRkaWFsb2cgLy8gd2FpdCBmb3IgbW9kYWwgdG8gc2xpZGUgaW5cclxuICAgICAgICAgIC5vbmUoJ2JzVHJhbnNpdGlvbkVuZCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhhdC4kZWxlbWVudC50cmlnZ2VyKCdmb2N1cycpLnRyaWdnZXIoZSlcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAuZW11bGF0ZVRyYW5zaXRpb25FbmQoTW9kYWwuVFJBTlNJVElPTl9EVVJBVElPTikgOlxyXG4gICAgICAgIHRoYXQuJGVsZW1lbnQudHJpZ2dlcignZm9jdXMnKS50cmlnZ2VyKGUpXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmhpZGUgPSBmdW5jdGlvbiAoZSkge1xyXG4gICAgaWYgKGUpIGUucHJldmVudERlZmF1bHQoKVxyXG5cclxuICAgIGUgPSAkLkV2ZW50KCdoaWRlLndwYmMubW9kYWwnKVxyXG5cclxuICAgIHRoaXMuJGVsZW1lbnQudHJpZ2dlcihlKVxyXG5cclxuICAgIGlmICghdGhpcy5pc1Nob3duIHx8IGUuaXNEZWZhdWx0UHJldmVudGVkKCkpIHJldHVyblxyXG5cclxuICAgIHRoaXMuaXNTaG93biA9IGZhbHNlXHJcblxyXG4gICAgdGhpcy5lc2NhcGUoKVxyXG4gICAgdGhpcy5yZXNpemUoKVxyXG5cclxuXHQgIGlmICggdGhpcy5vcHRpb25zLmVuZm9yY2VGb2N1cyAhPT0gZmFsc2UgKSB7XHJcblx0XHQgICQoIGRvY3VtZW50ICkub2ZmKCAnZm9jdXNpbi53cGJjLm1vZGFsJyApO1xyXG5cdCAgfVxyXG5cclxuXHJcbiAgICB0aGlzLiRlbGVtZW50XHJcbiAgICAgIC5yZW1vdmVDbGFzcygnaW4nKVxyXG4gICAgICAub2ZmKCdjbGljay5kaXNtaXNzLndwYmMubW9kYWwnKVxyXG4gICAgICAub2ZmKCdtb3VzZXVwLmRpc21pc3Mud3BiYy5tb2RhbCcpXHJcblxyXG4gICAgdGhpcy4kZGlhbG9nLm9mZignbW91c2Vkb3duLmRpc21pc3Mud3BiYy5tb2RhbCcpXHJcblxyXG4gICAgJC5zdXBwb3J0LnRyYW5zaXRpb24gJiYgdGhpcy4kZWxlbWVudC5oYXNDbGFzcygnZmFkZScpID9cclxuICAgICAgdGhpcy4kZWxlbWVudFxyXG4gICAgICAgIC5vbmUoJ2JzVHJhbnNpdGlvbkVuZCcsICQucHJveHkodGhpcy5oaWRlTW9kYWwsIHRoaXMpKVxyXG4gICAgICAgIC5lbXVsYXRlVHJhbnNpdGlvbkVuZChNb2RhbC5UUkFOU0lUSU9OX0RVUkFUSU9OKSA6XHJcbiAgICAgIHRoaXMuaGlkZU1vZGFsKClcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5lbmZvcmNlRm9jdXMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAkKGRvY3VtZW50KVxyXG4gICAgICAub2ZmKCdmb2N1c2luLndwYmMubW9kYWwnKSAvLyBndWFyZCBhZ2FpbnN0IGluZmluaXRlIGZvY3VzIGxvb3BcclxuICAgICAgLm9uKCdmb2N1c2luLndwYmMubW9kYWwnLCAkLnByb3h5KGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuJGVsZW1lbnRbMF0gIT09IGUudGFyZ2V0ICYmICF0aGlzLiRlbGVtZW50LmhhcyhlLnRhcmdldCkubGVuZ3RoKSB7XHJcbiAgICAgICAgICB0aGlzLiRlbGVtZW50LnRyaWdnZXIoJ2ZvY3VzJylcclxuICAgICAgICB9XHJcbiAgICAgIH0sIHRoaXMpKVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmVzY2FwZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGlmICh0aGlzLmlzU2hvd24gJiYgdGhpcy5vcHRpb25zLmtleWJvYXJkKSB7XHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ2tleWRvd24uZGlzbWlzcy53cGJjLm1vZGFsJywgJC5wcm94eShmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGUud2hpY2ggPT0gMjcgJiYgdGhpcy5oaWRlKClcclxuICAgICAgfSwgdGhpcykpXHJcbiAgICB9IGVsc2UgaWYgKCF0aGlzLmlzU2hvd24pIHtcclxuICAgICAgdGhpcy4kZWxlbWVudC5vZmYoJ2tleWRvd24uZGlzbWlzcy53cGJjLm1vZGFsJylcclxuICAgIH1cclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5yZXNpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBpZiAodGhpcy5pc1Nob3duKSB7XHJcbiAgICAgICQod2luZG93KS5vbigncmVzaXplLndwYmMubW9kYWwnLCAkLnByb3h5KHRoaXMuaGFuZGxlVXBkYXRlLCB0aGlzKSlcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICQod2luZG93KS5vZmYoJ3Jlc2l6ZS53cGJjLm1vZGFsJylcclxuICAgIH1cclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5oaWRlTW9kYWwgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgdGhhdCA9IHRoaXNcclxuICAgIHRoaXMuJGVsZW1lbnQuaGlkZSgpXHJcbiAgICB0aGlzLmJhY2tkcm9wKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdGhhdC4kYm9keS5yZW1vdmVDbGFzcygnbW9kYWwtb3BlbicpXHJcbiAgICAgIHRoYXQucmVzZXRBZGp1c3RtZW50cygpXHJcbiAgICAgIHRoYXQucmVzZXRTY3JvbGxiYXIoKVxyXG4gICAgICB0aGF0LiRlbGVtZW50LnRyaWdnZXIoJ2hpZGRlbi53cGJjLm1vZGFsJylcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUucmVtb3ZlQmFja2Ryb3AgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLiRiYWNrZHJvcCAmJiB0aGlzLiRiYWNrZHJvcC5yZW1vdmUoKVxyXG4gICAgdGhpcy4kYmFja2Ryb3AgPSBudWxsXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuYmFja2Ryb3AgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgIHZhciB0aGF0ID0gdGhpc1xyXG4gICAgdmFyIGFuaW1hdGUgPSB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdmYWRlJykgPyAnZmFkZScgOiAnJ1xyXG5cclxuICAgIGlmICh0aGlzLmlzU2hvd24gJiYgdGhpcy5vcHRpb25zLmJhY2tkcm9wKSB7XHJcbiAgICAgIHZhciBkb0FuaW1hdGUgPSAkLnN1cHBvcnQudHJhbnNpdGlvbiAmJiBhbmltYXRlXHJcblxyXG4gICAgICB0aGlzLiRiYWNrZHJvcCA9ICQoZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JykpXHJcbiAgICAgICAgLmFkZENsYXNzKCdtb2RhbC1iYWNrZHJvcCAnICsgYW5pbWF0ZSlcclxuICAgICAgICAuYXBwZW5kVG8odGhpcy4kYm9keSlcclxuXHJcbiAgICAgIHRoaXMuJGVsZW1lbnQub24oJ2NsaWNrLmRpc21pc3Mud3BiYy5tb2RhbCcsICQucHJveHkoZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBpZiAodGhpcy5pZ25vcmVCYWNrZHJvcENsaWNrKSB7XHJcbiAgICAgICAgICB0aGlzLmlnbm9yZUJhY2tkcm9wQ2xpY2sgPSBmYWxzZVxyXG4gICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChlLnRhcmdldCAhPT0gZS5jdXJyZW50VGFyZ2V0KSByZXR1cm5cclxuICAgICAgICB0aGlzLm9wdGlvbnMuYmFja2Ryb3AgPT0gJ3N0YXRpYydcclxuICAgICAgICAgID8gdGhpcy4kZWxlbWVudFswXS5mb2N1cygpXHJcbiAgICAgICAgICA6IHRoaXMuaGlkZSgpXHJcbiAgICAgIH0sIHRoaXMpKVxyXG5cclxuICAgICAgaWYgKGRvQW5pbWF0ZSkgdGhpcy4kYmFja2Ryb3BbMF0ub2Zmc2V0V2lkdGggLy8gZm9yY2UgcmVmbG93XHJcblxyXG4gICAgICB0aGlzLiRiYWNrZHJvcC5hZGRDbGFzcygnaW4nKVxyXG5cclxuICAgICAgaWYgKCFjYWxsYmFjaykgcmV0dXJuXHJcblxyXG4gICAgICBkb0FuaW1hdGUgP1xyXG4gICAgICAgIHRoaXMuJGJhY2tkcm9wXHJcbiAgICAgICAgICAub25lKCdic1RyYW5zaXRpb25FbmQnLCBjYWxsYmFjaylcclxuICAgICAgICAgIC5lbXVsYXRlVHJhbnNpdGlvbkVuZChNb2RhbC5CQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OKSA6XHJcbiAgICAgICAgY2FsbGJhY2soKVxyXG5cclxuICAgIH0gZWxzZSBpZiAoIXRoaXMuaXNTaG93biAmJiB0aGlzLiRiYWNrZHJvcCkge1xyXG4gICAgICB0aGlzLiRiYWNrZHJvcC5yZW1vdmVDbGFzcygnaW4nKVxyXG5cclxuICAgICAgdmFyIGNhbGxiYWNrUmVtb3ZlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoYXQucmVtb3ZlQmFja2Ryb3AoKVxyXG4gICAgICAgIGNhbGxiYWNrICYmIGNhbGxiYWNrKClcclxuICAgICAgfVxyXG4gICAgICAkLnN1cHBvcnQudHJhbnNpdGlvbiAmJiB0aGlzLiRlbGVtZW50Lmhhc0NsYXNzKCdmYWRlJykgP1xyXG4gICAgICAgIHRoaXMuJGJhY2tkcm9wXHJcbiAgICAgICAgICAub25lKCdic1RyYW5zaXRpb25FbmQnLCBjYWxsYmFja1JlbW92ZSlcclxuICAgICAgICAgIC5lbXVsYXRlVHJhbnNpdGlvbkVuZChNb2RhbC5CQUNLRFJPUF9UUkFOU0lUSU9OX0RVUkFUSU9OKSA6XHJcbiAgICAgICAgY2FsbGJhY2tSZW1vdmUoKVxyXG5cclxuICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgY2FsbGJhY2soKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gdGhlc2UgZm9sbG93aW5nIG1ldGhvZHMgYXJlIHVzZWQgdG8gaGFuZGxlIG92ZXJmbG93aW5nIG1vZGFsc1xyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuaGFuZGxlVXBkYXRlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5hZGp1c3REaWFsb2coKVxyXG4gIH1cclxuXHJcbiAgTW9kYWwucHJvdG90eXBlLmFkanVzdERpYWxvZyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBtb2RhbElzT3ZlcmZsb3dpbmcgPSB0aGlzLiRlbGVtZW50WzBdLnNjcm9sbEhlaWdodCA+IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHRcclxuXHJcbiAgICB0aGlzLiRlbGVtZW50LmNzcyh7XHJcbiAgICAgIHBhZGRpbmdMZWZ0OiAgIXRoaXMuYm9keUlzT3ZlcmZsb3dpbmcgJiYgbW9kYWxJc092ZXJmbG93aW5nID8gdGhpcy5zY3JvbGxiYXJXaWR0aCA6ICcnLFxyXG4gICAgICBwYWRkaW5nUmlnaHQ6IHRoaXMuYm9keUlzT3ZlcmZsb3dpbmcgJiYgIW1vZGFsSXNPdmVyZmxvd2luZyA/IHRoaXMuc2Nyb2xsYmFyV2lkdGggOiAnJ1xyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5yZXNldEFkanVzdG1lbnRzID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy4kZWxlbWVudC5jc3Moe1xyXG4gICAgICBwYWRkaW5nTGVmdDogJycsXHJcbiAgICAgIHBhZGRpbmdSaWdodDogJydcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuY2hlY2tTY3JvbGxiYXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZnVsbFdpbmRvd1dpZHRoID0gd2luZG93LmlubmVyV2lkdGhcclxuICAgIGlmICghZnVsbFdpbmRvd1dpZHRoKSB7IC8vIHdvcmthcm91bmQgZm9yIG1pc3Npbmcgd2luZG93LmlubmVyV2lkdGggaW4gSUU4XHJcbiAgICAgIHZhciBkb2N1bWVudEVsZW1lbnRSZWN0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXHJcbiAgICAgIGZ1bGxXaW5kb3dXaWR0aCA9IGRvY3VtZW50RWxlbWVudFJlY3QucmlnaHQgLSBNYXRoLmFicyhkb2N1bWVudEVsZW1lbnRSZWN0LmxlZnQpXHJcbiAgICB9XHJcbiAgICB0aGlzLmJvZHlJc092ZXJmbG93aW5nID0gZG9jdW1lbnQuYm9keS5jbGllbnRXaWR0aCA8IGZ1bGxXaW5kb3dXaWR0aFxyXG4gICAgdGhpcy5zY3JvbGxiYXJXaWR0aCA9IHRoaXMubWVhc3VyZVNjcm9sbGJhcigpXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUuc2V0U2Nyb2xsYmFyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGJvZHlQYWQgPSBwYXJzZUludCgodGhpcy4kYm9keS5jc3MoJ3BhZGRpbmctcmlnaHQnKSB8fCAwKSwgMTApXHJcbiAgICB0aGlzLm9yaWdpbmFsQm9keVBhZCA9IGRvY3VtZW50LmJvZHkuc3R5bGUucGFkZGluZ1JpZ2h0IHx8ICcnXHJcbiAgICBpZiAodGhpcy5ib2R5SXNPdmVyZmxvd2luZykgdGhpcy4kYm9keS5jc3MoJ3BhZGRpbmctcmlnaHQnLCBib2R5UGFkICsgdGhpcy5zY3JvbGxiYXJXaWR0aClcclxuICB9XHJcblxyXG4gIE1vZGFsLnByb3RvdHlwZS5yZXNldFNjcm9sbGJhciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuJGJvZHkuY3NzKCdwYWRkaW5nLXJpZ2h0JywgdGhpcy5vcmlnaW5hbEJvZHlQYWQpXHJcbiAgfVxyXG5cclxuICBNb2RhbC5wcm90b3R5cGUubWVhc3VyZVNjcm9sbGJhciA9IGZ1bmN0aW9uICgpIHsgLy8gdGh4IHdhbHNoXHJcbiAgICB2YXIgc2Nyb2xsRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcclxuICAgIHNjcm9sbERpdi5jbGFzc05hbWUgPSAnbW9kYWwtc2Nyb2xsYmFyLW1lYXN1cmUnXHJcbiAgICB0aGlzLiRib2R5LmFwcGVuZChzY3JvbGxEaXYpXHJcbiAgICB2YXIgc2Nyb2xsYmFyV2lkdGggPSBzY3JvbGxEaXYub2Zmc2V0V2lkdGggLSBzY3JvbGxEaXYuY2xpZW50V2lkdGhcclxuICAgIHRoaXMuJGJvZHlbMF0ucmVtb3ZlQ2hpbGQoc2Nyb2xsRGl2KVxyXG4gICAgcmV0dXJuIHNjcm9sbGJhcldpZHRoXHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gTU9EQUwgUExVR0lOIERFRklOSVRJT05cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBmdW5jdGlvbiBQbHVnaW4ob3B0aW9uLCBfcmVsYXRlZFRhcmdldCkge1xyXG4gICAgcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHZhciAkdGhpcyAgID0gJCh0aGlzKVxyXG4gICAgICB2YXIgZGF0YSAgICA9ICR0aGlzLmRhdGEoJ3dwYmMubW9kYWwnKVxyXG4gICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBNb2RhbC5ERUZBVUxUUywgJHRoaXMuZGF0YSgpLCB0eXBlb2Ygb3B0aW9uID09ICdvYmplY3QnICYmIG9wdGlvbilcclxuXHJcbiAgICAgIGlmICghZGF0YSkgJHRoaXMuZGF0YSgnd3BiYy5tb2RhbCcsIChkYXRhID0gbmV3IE1vZGFsKHRoaXMsIG9wdGlvbnMpKSlcclxuICAgICAgaWYgKHR5cGVvZiBvcHRpb24gPT0gJ3N0cmluZycpIGRhdGFbb3B0aW9uXShfcmVsYXRlZFRhcmdldClcclxuICAgICAgZWxzZSBpZiAob3B0aW9ucy5zaG93KSBkYXRhLnNob3coX3JlbGF0ZWRUYXJnZXQpXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgdmFyIG9sZCA9ICQuZm4ud3BiY19teV9tb2RhbFxyXG5cclxuICAkLmZuLndwYmNfbXlfbW9kYWwgICAgICAgICAgICAgPSBQbHVnaW5cclxuICAkLmZuLndwYmNfbXlfbW9kYWwuQ29uc3RydWN0b3IgPSBNb2RhbFxyXG5cclxuXHJcbiAgLy8gTU9EQUwgTk8gQ09ORkxJQ1RcclxuICAvLyA9PT09PT09PT09PT09PT09PVxyXG5cclxuICAkLmZuLndwYmNfbXlfbW9kYWwubm9Db25mbGljdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICQuZm4ud3BiY19teV9tb2RhbCA9IG9sZFxyXG4gICAgcmV0dXJuIHRoaXNcclxuICB9XHJcblxyXG5cclxuICAvLyBNT0RBTCBEQVRBLUFQSVxyXG4gIC8vID09PT09PT09PT09PT09XHJcblxyXG4gICQoZG9jdW1lbnQpLm9uKCdjbGljay53cGJjLm1vZGFsLmRhdGEtYXBpJywgJ1tkYXRhLXRvZ2dsZT1cIndwYmNfbXlfbW9kYWxcIl0nLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgdmFyICR0aGlzICAgPSAkKHRoaXMpXHJcbiAgICB2YXIgaHJlZiAgICA9ICR0aGlzLmF0dHIoJ2hyZWYnKVxyXG4gICAgdmFyICR0YXJnZXQgPSAkKCR0aGlzLmF0dHIoJ2RhdGEtdGFyZ2V0JykgfHwgKGhyZWYgJiYgaHJlZi5yZXBsYWNlKC8uKig/PSNbXlxcc10rJCkvLCAnJykpKSAvLyBzdHJpcCBmb3IgaWU3XHJcbiAgICB2YXIgb3B0aW9uICA9ICR0YXJnZXQuZGF0YSgnd3BiYy5tb2RhbCcpID8gJ3RvZ2dsZScgOiAkLmV4dGVuZCh7IHJlbW90ZTogIS8jLy50ZXN0KGhyZWYpICYmIGhyZWYgfSwgJHRhcmdldC5kYXRhKCksICR0aGlzLmRhdGEoKSlcclxuXHJcbiAgICBpZiAoJHRoaXMuaXMoJ2EnKSkgZS5wcmV2ZW50RGVmYXVsdCgpXHJcblxyXG4gICAgJHRhcmdldC5vbmUoJ3Nob3cud3BiYy5tb2RhbCcsIGZ1bmN0aW9uIChzaG93RXZlbnQpIHtcclxuICAgICAgaWYgKHNob3dFdmVudC5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkgcmV0dXJuIC8vIG9ubHkgcmVnaXN0ZXIgZm9jdXMgcmVzdG9yZXIgaWYgbW9kYWwgd2lsbCBhY3R1YWxseSBnZXQgc2hvd25cclxuICAgICAgJHRhcmdldC5vbmUoJ2hpZGRlbi53cGJjLm1vZGFsJywgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICR0aGlzLmlzKCc6dmlzaWJsZScpICYmICR0aGlzLnRyaWdnZXIoJ2ZvY3VzJylcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgICBQbHVnaW4uY2FsbCgkdGFyZ2V0LCBvcHRpb24sIHRoaXMpXHJcbiAgfSlcclxuXHJcbn0oalF1ZXJ5KTtcclxuXHJcblxyXG4rZnVuY3Rpb24gKCQpIHtcclxuICAndXNlIHN0cmljdCc7XHJcblxyXG4gIC8vIERST1BET1dOIENMQVNTIERFRklOSVRJT05cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIHZhciBiYWNrZHJvcCA9ICcuZHJvcGRvd24tYmFja2Ryb3AnXHJcbiAgdmFyIHRvZ2dsZSAgID0gJ1tkYXRhLXRvZ2dsZT1cIndwYmNfZHJvcGRvd25cIl0nXHJcbiAgdmFyIERyb3Bkb3duID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcclxuICAgICQoZWxlbWVudCkub24oJ2NsaWNrLndwYmMuZHJvcGRvd24nLCB0aGlzLnRvZ2dsZSlcclxuICB9XHJcblxyXG4gIERyb3Bkb3duLlZFUlNJT04gPSAnMy4zLjUnXHJcblxyXG4gIGZ1bmN0aW9uIGdldFBhcmVudCgkdGhpcykge1xyXG4gICAgdmFyIHNlbGVjdG9yID0gJHRoaXMuYXR0cignZGF0YS10YXJnZXQnKVxyXG5cclxuICAgIGlmICghc2VsZWN0b3IpIHtcclxuICAgICAgc2VsZWN0b3IgPSAkdGhpcy5hdHRyKCdocmVmJylcclxuICAgICAgc2VsZWN0b3IgPSBzZWxlY3RvciAmJiAvI1tBLVphLXpdLy50ZXN0KHNlbGVjdG9yKSAmJiBzZWxlY3Rvci5yZXBsYWNlKC8uKig/PSNbXlxcc10qJCkvLCAnJykgLy8gc3RyaXAgZm9yIGllN1xyXG4gICAgfVxyXG5cclxuICAgIHZhciAkcGFyZW50ID0gc2VsZWN0b3IgJiYgJChzZWxlY3RvcilcclxuXHJcbiAgICByZXR1cm4gJHBhcmVudCAmJiAkcGFyZW50Lmxlbmd0aCA/ICRwYXJlbnQgOiAkdGhpcy5wYXJlbnQoKVxyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gY2xlYXJNZW51cyhlKSB7XHJcbiAgICBpZiAoZSAmJiBlLndoaWNoID09PSAzKSByZXR1cm5cclxuICAgICQoYmFja2Ryb3ApLnJlbW92ZSgpXHJcbiAgICAkKHRvZ2dsZSkuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHZhciAkdGhpcyAgICAgICAgID0gJCh0aGlzKVxyXG4gICAgICB2YXIgJHBhcmVudCAgICAgICA9IGdldFBhcmVudCgkdGhpcylcclxuICAgICAgdmFyIHJlbGF0ZWRUYXJnZXQgPSB7IHJlbGF0ZWRUYXJnZXQ6IHRoaXMgfVxyXG5cclxuICAgICAgaWYgKCEkcGFyZW50Lmhhc0NsYXNzKCdvcGVuJykpIHJldHVyblxyXG5cclxuICAgICAgaWYgKGUgJiYgZS50eXBlID09ICdjbGljaycgJiYgL2lucHV0fHRleHRhcmVhL2kudGVzdChlLnRhcmdldC50YWdOYW1lKSAmJiAkLmNvbnRhaW5zKCRwYXJlbnRbMF0sIGUudGFyZ2V0KSkgcmV0dXJuXHJcblxyXG4gICAgICAkcGFyZW50LnRyaWdnZXIoZSA9ICQuRXZlbnQoJ2hpZGUud3BiYy5kcm9wZG93bicsIHJlbGF0ZWRUYXJnZXQpKVxyXG5cclxuICAgICAgaWYgKGUuaXNEZWZhdWx0UHJldmVudGVkKCkpIHJldHVyblxyXG5cclxuICAgICAgJHRoaXMuYXR0cignYXJpYS1leHBhbmRlZCcsICdmYWxzZScpXHJcbiAgICAgICRwYXJlbnQucmVtb3ZlQ2xhc3MoJ29wZW4nKS50cmlnZ2VyKCdoaWRkZW4ud3BiYy5kcm9wZG93bicsIHJlbGF0ZWRUYXJnZXQpXHJcbiAgICB9KVxyXG4gIH1cclxuXHJcbiAgRHJvcGRvd24ucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uIChlKSB7XHJcbiAgICB2YXIgJHRoaXMgPSAkKHRoaXMpXHJcblxyXG4gICAgaWYgKCR0aGlzLmlzKCcuZGlzYWJsZWQsIDpkaXNhYmxlZCcpKSByZXR1cm5cclxuXHJcbiAgICB2YXIgJHBhcmVudCAgPSBnZXRQYXJlbnQoJHRoaXMpXHJcbiAgICB2YXIgaXNBY3RpdmUgPSAkcGFyZW50Lmhhc0NsYXNzKCdvcGVuJylcclxuXHJcbiAgICBjbGVhck1lbnVzKClcclxuXHJcbiAgICBpZiAoIWlzQWN0aXZlKSB7XHJcbiAgICAgIGlmICgnb250b3VjaHN0YXJ0JyBpbiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgJiYgISRwYXJlbnQuY2xvc2VzdCgnLm5hdmJhci1uYXYnKS5sZW5ndGgpIHtcclxuICAgICAgICAvLyBpZiBtb2JpbGUgd2UgdXNlIGEgYmFja2Ryb3AgYmVjYXVzZSBjbGljayBldmVudHMgZG9uJ3QgZGVsZWdhdGVcclxuICAgICAgICAkKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKVxyXG4gICAgICAgICAgLmFkZENsYXNzKCdkcm9wZG93bi1iYWNrZHJvcCcpXHJcbiAgICAgICAgICAuaW5zZXJ0QWZ0ZXIoJCh0aGlzKSlcclxuICAgICAgICAgIC5vbignY2xpY2snLCBjbGVhck1lbnVzKVxyXG4gICAgICB9XHJcblxyXG4gICAgICB2YXIgcmVsYXRlZFRhcmdldCA9IHsgcmVsYXRlZFRhcmdldDogdGhpcyB9XHJcbiAgICAgICRwYXJlbnQudHJpZ2dlcihlID0gJC5FdmVudCgnc2hvdy53cGJjLmRyb3Bkb3duJywgcmVsYXRlZFRhcmdldCkpXHJcblxyXG4gICAgICBpZiAoZS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSkgcmV0dXJuXHJcblxyXG4gICAgICAkdGhpc1xyXG4gICAgICAgIC50cmlnZ2VyKCdmb2N1cycpXHJcbiAgICAgICAgLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpXHJcblxyXG4gICAgICAkcGFyZW50XHJcbiAgICAgICAgLnRvZ2dsZUNsYXNzKCdvcGVuJylcclxuICAgICAgICAudHJpZ2dlcignc2hvd24ud3BiYy5kcm9wZG93bicsIHJlbGF0ZWRUYXJnZXQpXHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlXHJcbiAgfVxyXG5cclxuICBEcm9wZG93bi5wcm90b3R5cGUua2V5ZG93biA9IGZ1bmN0aW9uIChlKSB7XHJcbiAgICBpZiAoIS8oMzh8NDB8Mjd8MzIpLy50ZXN0KGUud2hpY2gpIHx8IC9pbnB1dHx0ZXh0YXJlYS9pLnRlc3QoZS50YXJnZXQudGFnTmFtZSkpIHJldHVyblxyXG5cclxuICAgIHZhciAkdGhpcyA9ICQodGhpcylcclxuXHJcbiAgICBlLnByZXZlbnREZWZhdWx0KClcclxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcclxuXHJcbiAgICBpZiAoJHRoaXMuaXMoJy5kaXNhYmxlZCwgOmRpc2FibGVkJykpIHJldHVyblxyXG5cclxuICAgIHZhciAkcGFyZW50ICA9IGdldFBhcmVudCgkdGhpcylcclxuICAgIHZhciBpc0FjdGl2ZSA9ICRwYXJlbnQuaGFzQ2xhc3MoJ29wZW4nKVxyXG5cclxuICAgIGlmICghaXNBY3RpdmUgJiYgZS53aGljaCAhPSAyNyB8fCBpc0FjdGl2ZSAmJiBlLndoaWNoID09IDI3KSB7XHJcbiAgICAgIGlmIChlLndoaWNoID09IDI3KSAkcGFyZW50LmZpbmQodG9nZ2xlKS50cmlnZ2VyKCdmb2N1cycpXHJcbiAgICAgIHJldHVybiAkdGhpcy50cmlnZ2VyKCdjbGljaycpXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGRlc2MgPSAnIGxpOm5vdCguZGlzYWJsZWQpOnZpc2libGUgYSdcclxuICAgIHZhciAkaXRlbXMgPSAkcGFyZW50LmZpbmQoJy5kcm9wZG93bi1tZW51JyArIGRlc2MgKyAnLC51aV9kcm9wZG93bl9tZW51JyArIGRlc2MpXHJcblxyXG4gICAgaWYgKCEkaXRlbXMubGVuZ3RoKSByZXR1cm5cclxuXHJcbiAgICB2YXIgaW5kZXggPSAkaXRlbXMuaW5kZXgoZS50YXJnZXQpXHJcblxyXG4gICAgaWYgKGUud2hpY2ggPT0gMzggJiYgaW5kZXggPiAwKSAgICAgICAgICAgICAgICAgaW5kZXgtLSAgICAgICAgIC8vIHVwXHJcbiAgICBpZiAoZS53aGljaCA9PSA0MCAmJiBpbmRleCA8ICRpdGVtcy5sZW5ndGggLSAxKSBpbmRleCsrICAgICAgICAgLy8gZG93blxyXG4gICAgaWYgKCF+aW5kZXgpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5kZXggPSAwXHJcblxyXG4gICAgJGl0ZW1zLmVxKGluZGV4KS50cmlnZ2VyKCdmb2N1cycpXHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gRFJPUERPV04gUExVR0lOIERFRklOSVRJT05cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBmdW5jdGlvbiBQbHVnaW4ob3B0aW9uKSB7XHJcbiAgICByZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgdmFyICR0aGlzID0gJCh0aGlzKVxyXG4gICAgICB2YXIgZGF0YSAgPSAkdGhpcy5kYXRhKCd3cGJjLmRyb3Bkb3duJylcclxuXHJcbiAgICAgIGlmICghZGF0YSkgJHRoaXMuZGF0YSgnd3BiYy5kcm9wZG93bicsIChkYXRhID0gbmV3IERyb3Bkb3duKHRoaXMpKSlcclxuICAgICAgaWYgKHR5cGVvZiBvcHRpb24gPT0gJ3N0cmluZycpIGRhdGFbb3B0aW9uXS5jYWxsKCR0aGlzKVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHZhciBvbGQgPSAkLmZuLndwYmNfZHJvcGRvd25cclxuXHJcbiAgJC5mbi53cGJjX2Ryb3Bkb3duICAgICAgICAgICAgID0gUGx1Z2luXHJcbiAgJC5mbi53cGJjX2Ryb3Bkb3duLkNvbnN0cnVjdG9yID0gRHJvcGRvd25cclxuXHJcblxyXG4gIC8vIERST1BET1dOIE5PIENPTkZMSUNUXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgJC5mbi53cGJjX2Ryb3Bkb3duLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAkLmZuLndwYmNfZHJvcGRvd24gPSBvbGRcclxuICAgIHJldHVybiB0aGlzXHJcbiAgfVxyXG5cclxuXHJcbiAgLy8gQVBQTFkgVE8gU1RBTkRBUkQgRFJPUERPV04gRUxFTUVOVFNcclxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAkKGRvY3VtZW50KVxyXG4gICAgLm9uKCdjbGljay53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgY2xlYXJNZW51cylcclxuICAgIC5vbignY2xpY2sud3BiYy5kcm9wZG93bi5kYXRhLWFwaScsICcuZHJvcGRvd24gZm9ybScsIGZ1bmN0aW9uIChlKSB7IGUuc3RvcFByb3BhZ2F0aW9uKCkgfSlcclxuICAgIC5vbignY2xpY2sud3BiYy5kcm9wZG93bi5kYXRhLWFwaScsIHRvZ2dsZSwgRHJvcGRvd24ucHJvdG90eXBlLnRvZ2dsZSlcclxuICAgIC5vbigna2V5ZG93bi53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgdG9nZ2xlLCBEcm9wZG93bi5wcm90b3R5cGUua2V5ZG93bilcclxuICAgIC5vbigna2V5ZG93bi53cGJjLmRyb3Bkb3duLmRhdGEtYXBpJywgJy5kcm9wZG93bi1tZW51JywgRHJvcGRvd24ucHJvdG90eXBlLmtleWRvd24pXHJcbiAgICAub24oJ2tleWRvd24ud3BiYy5kcm9wZG93bi5kYXRhLWFwaScsICcudWlfZHJvcGRvd25fbWVudScsIERyb3Bkb3duLnByb3RvdHlwZS5rZXlkb3duKVxyXG5cclxufShqUXVlcnkpO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLE9BQU9BLE1BQU0sS0FBSyxXQUFXLEVBQUU7RUFDakMsTUFBTSxJQUFJQyxLQUFLLENBQUMseUNBQXlDLENBQUM7QUFDNUQ7QUFDQSxDQUFDLFVBQVVDLENBQUMsRUFBRTtFQUNaLFlBQVk7O0VBQ1osSUFBSUMsT0FBTyxHQUFHRCxDQUFDLENBQUNFLEVBQUUsQ0FBQ0MsTUFBTSxDQUFDQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUNBLEtBQUssQ0FBQyxHQUFHLENBQUM7RUFDbEQsSUFBS0gsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENB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QUFLLEdBQUcxRyxDQUFDLENBQUMsSUFBSSxDQUFDO01BQ25CLElBQUkyRyxJQUFJLEdBQUlELEtBQUssQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsQ0FBQztNQUV2QyxJQUFJLENBQUNBLElBQUksRUFBRUQsS0FBSyxDQUFDQyxJQUFJLENBQUMsZUFBZSxFQUFHQSxJQUFJLEdBQUcsSUFBSWEsUUFBUSxDQUFDLElBQUksQ0FBRSxDQUFDO01BQ25FLElBQUksT0FBT2hCLE1BQU0sSUFBSSxRQUFRLEVBQUVHLElBQUksQ0FBQ0gsTUFBTSxDQUFDLENBQUNlLElBQUksQ0FBQ2IsS0FBSyxDQUFDO0lBQ3pELENBQUMsQ0FBQztFQUNKO0VBRUEsSUFBSUcsR0FBRyxHQUFHN0csQ0FBQyxDQUFDRSxFQUFFLENBQUN3SSxhQUFhO0VBRTVCMUksQ0FBQyxDQUFDRSxFQUFFLENBQUN3SSxhQUFhLEdBQWVuQyxNQUFNO0VBQ3ZDdkcsQ0FBQyxDQUFDRSxFQUFFLENBQUN3SSxhQUFhLENBQUMzQixXQUFXLEdBQUdTLFFBQVE7O0VBR3pDO0VBQ0E7O0VBRUF4SCxDQUFDLENBQUNFLEVBQUUsQ0FBQ3dJLGFBQWEsQ0FBQzFCLFVBQVUsR0FBRyxZQUFZO0lBQzFDaEgsQ0FBQyxDQUFDRSxFQUFFLENBQUN3SSxhQUFhLEdBQUc3QixHQUFHO0lBQ3hCLE9BQU8sSUFBSTtFQUNiLENBQUM7O0VBR0Q7RUFDQTs7RUFFQTdHLENBQUMsQ0FBQ1MsUUFBUSxDQUFDLENBQ1JvQyxFQUFFLENBQUMsOEJBQThCLEVBQUUrRSxVQUFVLENBQUMsQ0FDOUMvRSxFQUFFLENBQUMsOEJBQThCLEVBQUUsZ0JBQWdCLEVBQUUsVUFBVVQsQ0FBQyxFQUFFO0lBQUVBLENBQUMsQ0FBQ2lHLGVBQWUsQ0FBQyxDQUFDO0VBQUMsQ0FBQyxDQUFDLENBQzFGeEYsRUFBRSxDQUFDLDhCQUE4QixFQUFFYixNQUFNLEVBQUV3RixRQUFRLENBQUN6RixTQUFTLENBQUNDLE1BQU0sQ0FBQyxDQUNyRWEsRUFBRSxDQUFDLGdDQUFnQyxFQUFFYixNQUFNLEVBQUV3RixRQUFRLENBQUN6RixTQUFTLENBQUNxRyxPQUFPLENBQUMsQ0FDeEV2RixFQUFFLENBQUMsZ0NBQWdDLEVBQUUsZ0JBQWdCLEVBQUUyRSxRQUFRLENBQUN6RixTQUFTLENBQUNxRyxPQUFPLENBQUMsQ0FDbEZ2RixFQUFFLENBQUMsZ0NBQWdDLEVBQUUsbUJBQW1CLEVBQUUyRSxRQUFRLENBQUN6RixTQUFTLENBQUNxRyxPQUFPLENBQUM7QUFFMUYsQ0FBQyxDQUFDdEksTUFBTSxDQUFDIiwiaWdub3JlTGlzdCI6W119
