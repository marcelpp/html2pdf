import Worker from '../worker.js';
import { objType, createElement } from './utils.js';

// Add page-break functionality.

// Refs to original functions.
var orig = {
  toContainer: Worker.prototype.toContainer
};

// Add pageBreak default options to the Worker template.
Worker.template.opt.pageBreak = {
  mode: ['css', 'legacy'],  // 'avoid-all', 'css', 'legacy', 'whiteline'
  before: [],
  after: [],
  avoid: []
};

Worker.prototype.toContainer = function toContainer() {
  return orig.toContainer.call(this).then(function toContainer_pagebreak() {
    // Setup root element and inner page height.
    var root = this.prop.container;
    var pxPageHeight = this.prop.pageSize.inner.px.height;

    // Check all requested modes.
    var modeSrc = [].concat(this.opt.pageBreak.mode);
    var mode = {
      avoidAll:   modeSrc.indexOf('avoid-all') !== -1,
      css:        modeSrc.indexOf('css') !== -1,
      legacy:     modeSrc.indexOf('legacy') !== -1,
      whiteline:  modeSrc.indexOf('whiteline') !== -1
    };

    // Get arrays of all explicitly requested elements.
    var select = {};
    ['before', 'after', 'avoid'].forEach(function(key) {
      var all = mode.avoidAll && key === 'avoid';
      select[key] = all ? [] : [].concat(this.opt.pageBreak[key]);
      if (select[key].length > 0) {
        select[key] = Array.prototype.slice.call(
          root.querySelectorAll(select[key].join(', ')));
      }
    });

    // Get all legacy page-break elements.
    var legacyEls = root.querySelectorAll('.html2pdf__page-break');
    legacyEls = Array.prototype.slice.call(legacyEls);

    // Loop through all elements.
    var els = root.querySelectorAll('*');
    Array.prototype.forEach.call(els, function pageBreak_loop(el) {
      // Setup pagebreak rules based on legacy and avoidAll modes.
      var rules = {
        before: false,
        after:  mode.legacy && legacyEls.indexOf(el) !== -1,
        avoid:  mode.avoidAll
      };

      // Add rules for css mode.
      if (mode.css) {
        // TODO: Check if this is valid with iFrames.
        var style = window.getComputedStyle(el);
        // TODO: Handle 'left' and 'right' correctly.
        // TODO: Add support for 'avoid' on breakBefore/After.
        var cssOpt = ['always', 'left', 'right'];
        rules = {
          before: rules.before || cssOpt.indexOf(style.breakBefore || style.pageBreakBefore) !== -1,
          after:  rules.after || cssOpt.indexOf(style.breakAfter || style.pageBreakAfter) !== -1,
          avoid:  rules.avoid || (style.breakInside || style.pageBreakInside) === 'avoid'
        };
      }

      // Add rules for explicit requests.
      Object.keys(rules).forEach(function(key) {
        rules[key] = rules[key] || select[key].indexOf(el) !== -1;
      });

      // Get element position on the screen.
      // TODO: Subtract the top of the container from clientRect.top/bottom?
      var clientRect = el.getBoundingClientRect();

      // Avoid: Check if a break happens mid-element.
      if (rules.avoid && !rules.before) {
        var startPage = Math.floor(clientRect.top / pxPageHeight);
        var endPage = Math.floor(clientRect.bottom / pxPageHeight);
        var nPages = Math.abs(clientRect.bottom - clientRect.top) / pxPageHeight;

        // Turn on rules.before if the el is broken and is less than a page long.
        if (endPage !== startPage && nPages < 1) {
          rules.before = true;
        }
      }

      // Before: Create a padding div to push the element to the next page.
      if (rules.before) {
        var pad = createElement('div', {style: {
          display: 'block',
          height: pxPageHeight - (clientRect.top % pxPageHeight) + 'px'
        }});
        el.parentNode.insertBefore(pad, el);
      }

      // After: Create a padding div to fill the remaining page.
      if (rules.after) {
        var pad = createElement('div', {style: {
          display: 'block',
          height: pxPageHeight - (clientRect.bottom % pxPageHeight) + 'px'
        }});
        el.parentNode.insertAfter(pad, el);
      }
    });
  });
};
