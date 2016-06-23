/**
 * @author Titus Wormer
 * @author Sindre Sorhus
 * @copyright 2015 Titus Wormer
 * @copyright 2013 Nicholas C. Zakas
 * @license MIT
 * @module vfile:reporter
 * @fileoverview Stylish reporter for virtual files.
 */

'use strict';

/* eslint-env commonjs */

/* Dependencies. */
var pluralize = require('plur');
var width = require('string-width');
var symbols = require('log-symbols');
var chalk = require('chalk');
var table = require('text-table');
var repeat = require('repeat-string');
var sort = require('vfile-sort');

/* Map of no-warning messages, where `true` refers to
 * `compile: true`. */
var SUCCESS = {
  true: chalk.yellow('written'),
  false: 'no issues found'
};

/* List of probable lengths of messages. */
var POSITION_LENGTH = '00:0-00:0'.length;
var LABEL_LENGTH = 'message'.length;
var MESSAGE_LENGTH = 'this is an average message'.length;

/**
 * Get the length of `value`, ignoring ANSI sequences.
 *
 * @param {string} value - Value to `pad`.
 * @return {number} - Length of `value`.
 */
function realLength(value) {
  var index = value.indexOf('\n');

  if (index !== -1) {
    value = value.slice(0, index);
  }

  return width(value);
}

/**
 * Pad `value` on the `side` (where truthy means left and
 * falsey means right).
 *
 * @param {string} value - Value to `pad`.
 * @param {number} minimum - Pad to `minimum`.
 * @param {boolean?} [side] - Side to pad on.
 * @return {string} - padded `value`.
 */
function pad(value, minimum, side) {
  var padding = repeat(' ', minimum - realLength(value));
  return side ? padding + value : value + padding;
}

/**
 * Pad `value` on the left.
 *
 * @param {string} value - Value to `pad`.
 * @param {number} minimum - Pad to `minimum`.
 * @return {string} - Left-padded `value`.
 */
function padLeft(value, minimum) {
  return pad(value, minimum, true);
}

/**
 * Pad `value` on the right.
 *
 * @param {string} value - Value to `pad`.
 * @param {number} minimum - Pad to `minimum`.
 * @return {string} - Right-padded `value`.
 */
function padRight(value, minimum) {
  return pad(value, minimum, false);
}

/**
 * Stringify one position.
 *
 * @param {Position} position - Point.
 * @return {string} - Stringified point.
 */
function point(position) {
  return [position.line || 1, position.column || 1].join(':');
}

/**
 * @param {VFile|Array.<VFile>} files - One or more virtual
 *   files.
 * @param {Object} [options] - Configuration.
 * @param {Object} [options.quiet=false] - Do not output
 *   anything for a file which has no messages. The default
 *   behaviour is to show a success message.
 * @param {Object} [options.silent=false] - Do not output
 *   messages without `fatal` set to true. Also sets
 *   `quiet` to `true`.
 * @param {Object} [options.verbose=false] - Output notes.
 * @return {string} - Formatted files.
 */
function reporter(files, options) {
  var settings = options || {};
  var silent = settings.silent;
  var quiet = settings.quiet || settings.silent;
  var verbose = settings.verbose;
  var total = 0;
  var errors = 0;
  var warnings = 0;
  var result = [];
  var listing = false;
  var summaryColor;
  var summary;

  if (!files) {
    return '';
  }

  if (!('length' in files)) {
    files = [files];
  }

  files.forEach(function (file, position) {
    var destination = file.filePath();
    var filePath = file.history[0] || destination;
    var stored = Boolean(file.stored);
    var moved = stored && destination !== filePath;
    var name = filePath || '<stdin>';
    var output = '';
    var messages;
    var fileColor;

    sort(file);

    messages = file.messages;

    if (silent) {
      messages = messages.filter(function (message) {
        return message.fatal === true;
      });
    }

    if (quiet && !messages.length) {
      return;
    }

    total += messages.length;

    messages = messages.map(function (message) {
      var color = 'yellow';
      var pos = message.location;
      var label;
      var reason;
      var location;

      location = point(pos.start);

      if (pos.end.line && pos.end.column) {
        location += '-' + point(pos.end);
      }

      if (message.fatal) {
        color = fileColor = summaryColor = 'red';
        label = 'error';
        errors++;
      } else if (message.fatal === false) {
        label = 'warning';
        warnings++;

        if (!summaryColor) {
          summaryColor = color;
        }

        if (!fileColor) {
          fileColor = color;
        }
      } else {
        label = 'message';
        color = 'gray';
      }

      reason = message.stack || message.message;

      if (verbose && message.note) {
        reason += '\n' + message.note;
      }

      return [
        '',
        padLeft(location, POSITION_LENGTH),
        padRight(chalk[color](label), LABEL_LENGTH),
        padRight(reason, MESSAGE_LENGTH),
        message.ruleId || ''
      ];
    });

    if (listing || (messages.length && position !== 0)) {
      output += '\n';
    }

    output += chalk.underline[fileColor || 'green'](name);

    if (moved) {
      output += ' > ' + destination;
    }

    listing = Boolean(messages.length);

    if (listing) {
      output += '\n' + table(messages, {
        align: ['', 'l', 'l', 'l'],
        stringLength: realLength
      });
    } else {
      output += ': ' + SUCCESS[stored];
    }

    result.push(output);
  });

  if (errors || warnings) {
    summary = [];

    if (errors) {
      summary.push([
        symbols.error,
        errors,
        pluralize('error', errors)
      ].join(' '));
    }

    if (warnings) {
      summary.push([
        symbols.warning,
        warnings,
        pluralize('warning', warnings)
      ].join(' '));
    }

    summary = summary.join(', ');

    if (errors && warnings) {
      summary = total + ' messages (' + summary + ')';
    }

    result.push('\n' + summary);
  }

  result = result.length ? result.join('\n') : '';

  if (settings.color === false) {
    result = chalk.stripColor(result);
  }

  return result;
}

/* Expose. */
module.exports = reporter;
