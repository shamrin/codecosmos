// Modified version of https://github.com/marijnh/CodeMirror/blob/master/addon/lint/javascript-lint.js
(function(window) {
  'use strict';
  var JSHINT = window.JSHINT;
  var CodeMirror = window.CodeMirror;

  var bogus = [ "Dangerous comment" ];

  var warnings = [ [ "Expected '{'",
                     "Statement body should be inside '{ }' braces." ] ];

  var errors = [ "Missing semicolon", "Extra comma", "Missing property name",
                 "Unmatched ", " and instead saw", " is not defined",
                 "Unclosed string", "Stopping, unable to continue" ];

  var options = {
    curly: true,
    bitwise: false,
    forin: false,
    latedef: true,
    noarg: true,
    undef: true,
    strict: false,
    funcscope: true,
    globalstrict: true,
    laxcomma: true,
    browser: true
  };
  var globals = {
    processing: false,
    console: false,
    sc: false,
    timbre: false,
    T: false
  };

  function validator(text, options, globals) {
    JSHINT(text, options, globals);
    var errors = JSHINT.data().errors;
    var result = [];
    if (errors) {
      parseErrors(errors, result);
    }
    return result;
  }

  CodeMirror.ccAsyncJavascriptValidator = function (cm, updateLinting, opts) {
    var code = cm.getValue();
    var errors = validator(code, options, globals);
    updateLinting(cm, errors);
    if (opts.callback) {
      opts.callback(cm, code, errors);
    }
  };

  function cleanup(error) {
    // All problems are warnings by default
    fixWith(error, warnings, "warning", true);
    fixWith(error, errors, "error");

    return isBogus(error) ? null : error;
  }

  function fixWith(error, fixes, severity, force) {
    var description, fix, find, replace, found;

    description = error.description;

    for ( var i = 0; i < fixes.length; i++) {
      fix = fixes[i];
      find = (typeof fix === "string" ? fix : fix[0]);
      replace = (typeof fix === "string" ? null : fix[1]);
      found = description.indexOf(find) !== -1;

      if (force || found) {
        error.severity = severity;
      }
      if (found && replace) {
        error.description = replace;
      }
    }
  }

  function isBogus(error) {
    var description = error.description;
    for ( var i = 0; i < bogus.length; i++) {
      if (description.indexOf(bogus[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function parseErrors(errors, output) {
    var pushTabPositions = function (tabpositions, item, index) {
      if (item === '\t') {
        // First col is 1 (not 0) to match error
        // positions
        tabpositions.push(index + 1);
      }
      return tabpositions;
    };
    var updateTabPositions = function (pos, tabposition) {
      if (pos > tabposition) {
        return pos - 1;
      } else {
        return pos;
      }
    };
    for ( var i = 0; i < errors.length; i++) {
      var error = errors[i];
      if (error) {
        var linetabpositions, index;

        linetabpositions = [];

        // This next block is to fix a problem in jshint. Jshint
        // replaces
        // all tabs with spaces then performs some checks. The error
        // positions (character/space) are then reported incorrectly,
        // not taking the replacement step into account. Here we look
        // at the evidence line and try to adjust the character position
        // to the correct value.
        if (error.evidence) {
          // Tab positions are computed once per line and cached
          var tabpositions = linetabpositions[error.line];
          if (!tabpositions) {
            // ugggh phantomjs does not like this
            // forEachChar(evidence, function(item, index) {
            tabpositions = Array.prototype.reduce.call(
              error.evidence,
              pushTabPositions,
              []);
            linetabpositions[error.line] = tabpositions;
          }
          if (tabpositions.length > 0) {
            error.character = tabpositions.reduce(
              updateTabPositions,
              error.character);
          }
        }

        var start = error.character - 1, end = start + 1;
        if (error.evidence) {
          index = error.evidence.substring(start).search(/.\b/);
          if (index > -1) {
            end += index;
          }
        }

        // Convert to format expected by validation service
        error.description = error.reason;// + "(jshint)";
        error.start = error.character;
        error.end = end;
        error = cleanup(error);

        if (error)
          output.push({message: error.description,
                       severity: error.severity,
                       from: CodeMirror.Pos(error.line - 1, start),
                       to: CodeMirror.Pos(error.line - 1, end)});
      }
    }
  }
})(window);
