/**
 * Hector.js
 * (c) 2012 Jay Phelps
 * MIT licensed
 * https://github.com/jayphelps/hector
 */
var Hector = (function (window, document) {
    "use strict";

    var Hector = {};

    var options = Hector.options = {
        log: true,
        viewMethods: {
            appendChild: "appendChild"
        },
        debug: true,
        buffer: false,
        baseConstructor: ElementContainer
    };

    // ======================
    // == Common Utilities ==
    // ======================

    var toString = Object.prototype.toString;

    function isString(obj) {
        return toString.call(obj) == "[object String]";
    }

    function isFunction(obj) {
        return toString.call(obj) == "[object Function]";
    }

    function isObject(obj) {
        return obj === Object(obj);
    }

    function HectorExceptionWrapper(e, message) {
        e.name = "Hector" + e.name;
        e.message = "\"" + e.message + "\" while " + message;
        throw e;
    }

    function log(desc, arg) {
        if (options.log && window.console) {
            console.log("Hector" + desc + ":", arg);
        }
    }

    function camelCaseToHyphens(str) {
        return str.replace(/([a-z][A-Z])/g, function (match) {
            return match[0] + "-" + match[1].toLowerCase();
        });
    }

    function stringToElement(str) {
        var container = document.createElement("x-element");
        container.innerHTML = str;
        return container.firstChild;
    }
        
    function indent(str) {
        var out = "    ";
        out += str.replace(/\n/g, function (newline, i) {
            if (i !== str.length-1) {
                newline += "    ";
            }
            return newline;
        });

        return out;
    }  

    // =========================
    // == AST Parsing Helpers ==
    // =========================

    Hector.parseTreeNode = function (node, contextName) {
        var builder = Hector.Builders[node.type];
        if (!builder) throw Error("No builder for type: " + node.type);

        var out = builder(node, contextName).toString();

        return out;
    };

    Hector.walkTree = function (tree, contextName) {
        var out = "";

        for (var i = 0, l = tree.length; i < l; i++) {
            out += Hector.parseTreeNode(tree[i], contextName);
        }
        
        return out;
    };

    // ===========================
    // == Context Constructors ===
    // ===========================

    function StringBuilder() {
        this.children = [];
    }

    Hector.StringBuilder = StringBuilder;

    StringBuilder.prototype.appendChild = function (child) {
        this.children.push(child);
    };

    StringBuilder.prototype.renderBuffer = function () {
        var out = "";
        var children = this.children;

        for (var i = 0, l = children.length; i < l; i++) {
            out += children[i].renderBuffer();
        }

        return out;
    };

    StringBuilder.prototype.render = function () {
        throw Error("StringBuilder#render has no implementation, did you mean StringBuilder#renderBuffer?");
    };

    function TextNodeContainer(value) {
        if (!options.buffer) return document.createTextNode(value);

        this.value = value;
        this.isRendered = false;
    }

    Hector.TextNodeContainer = TextNodeContainer;

    TextNodeContainer.prototype.appendChild = function (child) {
        throw Error("TextNodeContainer has no appendChild");
    };

    TextNodeContainer.prototype.renderBuffer = function () {
        return this.value;
    };

    TextNodeContainer.prototype.render = function () {
        var out = this.renderBuffer();
        this.layer = document.createTextNode(out);
        this.isRendered = true;
    };

    function ElementContainer(tagName) {
        if (!options.buffer) return document.createElement(tagName);

        this.tagName = tagName;
        this.children = [];
        this.layer = undefined;
        this.isRendered = false;
    }

    Hector.ElementContainer = ElementContainer;

    ElementContainer.prototype.attributeMap = {
        className: "class"
    };

    ElementContainer.prototype.appendChild = function (child) {
        this.children.push(child);
    };

    ElementContainer.prototype.renderAttributes = function () {
        var attrs = [];
        var attributeMap = this.attributeMap;
        var value;
        var cleanKey;

        for (var key in this) {
            if (this.hasOwnProperty(key)) {
                switch (key) {
                    case "tagName":
                    case "children":
                    case "layer":
                    case "isRendered":
                        // Don't include these
                        continue;
                    default:
                        cleanKey = attributeMap[key] || camelCaseToHyphens(key);
                        value = cleanKey + "=\"" + this[key] + "\"";
                        attrs.push(value);
                }
            }
        }

        if (attrs.length) {
            attrs.unshift("");
        }

        return attrs.join(" ");
    };

    ElementContainer.prototype.renderBuffer = function () {
        var out = "";
        var tagName = this.tagName;
        var children = this.children;
        var attributes = this.renderAttributes();

        out += "<" + tagName + attributes + ">";

        for (var i = 0, l = children.length; i < l; i++) {
            out += children[i].renderBuffer();
        }

        out += "</" + tagName + ">";

        return out;
    };

    ElementContainer.prototype.render = function () {
        var out = this.renderBuffer();
        this.layer = stringToElement(out);
        this.isRendered = true;
    };

    // ===================
    // == External API ===
    // ===================

    /**
     * Used inside compiled templates to evaluate variables
     */
    Hector.echo = function (value) {
        // If the value is a function, we'll try to create a new instance of
        // it and append it
        if (isFunction(value)) {
            var view = new value();
            this.appendChild(view);
            return;
        }

        // If reached, we're going to just convert it to a text node, regardless
        // of what it is. (Object, String, Number, RegExp, etc)
        var node = new TextNodeContainer(value);

        // Prefer appendNode, if they've got it
        if (this.appendNode) {
            this.appendNode(node);
        } else {
            this.appendChild(node);
        }

        return value;
    };

    /**
     * Internal render implementation that is wrapped by Hector.render();
     */
    function render(template, data, context) {
        if (!context) throw Error("Hector.render() a context is required.");
        
        var prevBufferOption = options.buffer;
        if (context instanceof StringBuilder) {
            options.buffer = true;
        }

        var keys = [];
        var values = [];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                keys.push(key);
                values.push(data[key]);
            }
        }

        keys.push("var HectorOptions = Hector.options;\n" + template);
        
        var exec = Function.apply(null, keys);
        exec.apply(context, values);

        options.buffer = prevBufferOption;
    }

    /**
     * External facing wrapper for the real render(). This allows us to wrap it
     * in a try/catch if debug is on
     */
    Hector.render = function (template, data, context) {
        if (options.debug) {
            var constructorName = template.slice(0, template.indexOf(";\n")).replace(/\"/g, "");

             try {
                render(template, data, context);
            } catch (e) {
                throw HectorExceptionWrapper(e, "rendering template " + constructorName);
            }
        } else {
            render(template, data, context);
        }
    };

    Hector.compile = function (source) {
        if (!source) return "";

        var tree = Hector.Parser.parse(source);

        log("ParseTree", tree);

        var output = Hector.walkTree(tree.nodes, "this");

        log("TemplateOutput", output);
    
        return output;
    };

    return Hector;

})(window, document);

Hector.Parser = (function(){
  /*
   * Generated by PEG.js 0.7.0.
   *
   * http://pegjs.majda.cz/
   */
  
  function subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }
  
  function quote(s) {
    /*
     * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
     * string literal except for the closing quote character, backslash,
     * carriage return, line separator, paragraph separator, and line feed.
     * Any character may appear in the form of an escape sequence.
     *
     * For portability, we also escape escape all control and non-ASCII
     * characters. Note that "\0" and "\v" escape sequences are not used
     * because JSHint does not like the first and IE the second.
     */
     return '"' + s
      .replace(/\\/g, '\\\\')  // backslash
      .replace(/"/g, '\\"')    // closing quote character
      .replace(/\x08/g, '\\b') // backspace
      .replace(/\t/g, '\\t')   // horizontal tab
      .replace(/\n/g, '\\n')   // line feed
      .replace(/\f/g, '\\f')   // form feed
      .replace(/\r/g, '\\r')   // carriage return
      .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
      + '"';
  }
  
  var result = {
    /*
     * Parses the input with a generated parser. If the parsing is successful,
     * returns a value explicitly or implicitly specified by the grammar from
     * which the parser was generated (see |PEG.buildParser|). If the parsing is
     * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
     */
    parse: function(input) {
      var parseFunctions = {
        "start": parse_start
      };
      
      var options = arguments.length > 1 ? arguments[1] : {},
          startRule;
      
      if (options.startRule !== undefined) {
        startRule = options.startRule;
        
        if (parseFunctions[startRule] === undefined) {
          throw new Error("Can't start parsing from rule " + quote(startRule) + ".");
        }
      } else {
        startRule = "start";
      }
      
      var pos = 0;
      var reportedPos = 0;
      var cachedReportedPos = 0;
      var cachedReportedPosDetails = { line: 1, column: 1, seenCR: false };
      var reportFailures = 0;
      var rightmostFailuresPos = 0;
      var rightmostFailuresExpected = [];
      
      function padLeft(input, padding, length) {
        var result = input;
        
        var padLength = length - input.length;
        for (var i = 0; i < padLength; i++) {
          result = padding + result;
        }
        
        return result;
      }
      
      function escape(ch) {
        var charCode = ch.charCodeAt(0);
        var escapeChar;
        var length;
        
        if (charCode <= 0xFF) {
          escapeChar = 'x';
          length = 2;
        } else {
          escapeChar = 'u';
          length = 4;
        }
        
        return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
      }
      
      function computeReportedPosDetails() {
        function advanceCachedReportedPos() {
          var ch;
          
          for (; cachedReportedPos < reportedPos; cachedReportedPos++) {
            ch = input.charAt(cachedReportedPos);
            if (ch === "\n") {
              if (!cachedReportedPosDetails.seenCR) { cachedReportedPosDetails.line++; }
              cachedReportedPosDetails.column = 1;
              cachedReportedPosDetails.seenCR = false;
            } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
              cachedReportedPosDetails.line++;
              cachedReportedPosDetails.column = 1;
              cachedReportedPosDetails.seenCR = true;
            } else {
              cachedReportedPosDetails.column++;
              cachedReportedPosDetails.seenCR = false;
            }
          }
        }
        
        if (cachedReportedPos !== reportedPos) {
          if (cachedReportedPos > reportedPos) {
            cachedReportedPos = 0;
            cachedReportedPosDetails = { line: 1, column: 1, seenCR: false };
          }
          advanceCachedReportedPos();
        }
        
        return cachedReportedPosDetails;
      }
      
      function offset() {
        return reportedPos;
      }
      
      function line() {
        return computeReportedPosDetails().line;
      }
      
      function column() {
        return computeReportedPosDetails().column;
      }
      
      function matchFailed(failure) {
        if (pos < rightmostFailuresPos) {
          return;
        }
        
        if (pos > rightmostFailuresPos) {
          rightmostFailuresPos = pos;
          rightmostFailuresExpected = [];
        }
        
        rightmostFailuresExpected.push(failure);
      }
      
      function parse_start() {
        var r0, r1, r2, r3, r4, r5;
        
        r1 = pos;
        r2 = pos;
        r3 = parse___();
        if (r3 !== null) {
          r4 = parse_template();
          if (r4 !== null) {
            r5 = parse___();
            if (r5 !== null) {
              r0 = [r3, r4, r5];
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(template) {
                return template;
            })(r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_template() {
        var r0, r1;
        
        r1 = pos;
        r0 = parse_rootElements();
        r0 = r0 !== null ? r0 : "";
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(nodes) {
                return {
                    nodes: nodes
                };
            })(r0);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_rootElements() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_rootElement();
        if (r3 !== null) {
          r4 = [];
          r6 = pos;
          r7 = parse___();
          if (r7 !== null) {
            r8 = parse_rootElement();
            if (r8 !== null) {
              r5 = [r7, r8];
            } else {
              r5 = null;
              pos = r6;
            }
          } else {
            r5 = null;
            pos = r6;
          }
          while (r5 !== null) {
            r4.push(r5);
            r6 = pos;
            r7 = parse___();
            if (r7 !== null) {
              r8 = parse_rootElement();
              if (r8 !== null) {
                r5 = [r7, r8];
              } else {
                r5 = null;
                pos = r6;
              }
            } else {
              r5 = null;
              pos = r6;
            }
          }
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(head, tail) {
                var result = [head];
                for (var i = 0, l = tail.length; i < l; i++) {
                    result.push(tail[i][1]);
                }
        
                return result;
            })(r3, r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_rootElement() {
        var r0, r1;
        
        r0 = parse_variableStatement();
        if (r0 === null) {
          r0 = parse_viewDeclaration();
          if (r0 === null) {
            r0 = parse_templateInstance();
            if (r0 === null) {
              r0 = parse_helper();
              if (r0 === null) {
                r1 = pos;
                r0 = parse_stringLiteral();
                if (r0 !== null) {
                  reportedPos = r1;
                  r0 = (function(value) {
                        return {
                            type: "String",
                            attributes: [],
                            value: value
                        };
                    })(r0);
                }
                if (r0 === null) {
                  pos = r1;
                }
              }
            }
          }
        }
        return r0;
      }
      
      function parse_elements() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_element();
        if (r3 !== null) {
          r4 = [];
          r6 = pos;
          r7 = parse___();
          if (r7 !== null) {
            r8 = parse_element();
            if (r8 !== null) {
              r5 = [r7, r8];
            } else {
              r5 = null;
              pos = r6;
            }
          } else {
            r5 = null;
            pos = r6;
          }
          while (r5 !== null) {
            r4.push(r5);
            r6 = pos;
            r7 = parse___();
            if (r7 !== null) {
              r8 = parse_element();
              if (r8 !== null) {
                r5 = [r7, r8];
              } else {
                r5 = null;
                pos = r6;
              }
            } else {
              r5 = null;
              pos = r6;
            }
          }
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(head, tail) {
                var result = [head];
                for (var i = 0, l = tail.length; i < l; i++) {
                    result.push(tail[i][1]);
                }
        
                return result;
            })(r3, r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_element() {
        var r0, r1;
        
        r0 = parse_variableStatement();
        if (r0 === null) {
          r0 = parse_templateInstance();
          if (r0 === null) {
            r0 = parse_helper();
            if (r0 === null) {
              r1 = pos;
              r0 = parse_stringLiteral();
              if (r0 !== null) {
                reportedPos = r1;
                r0 = (function(value) {
                      return {
                          type: "String",
                          attributes: [],
                          value: value
                      };
                  })(r0);
              }
              if (r0 === null) {
                pos = r1;
              }
            }
          }
        }
        return r0;
      }
      
      function parse_helper() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17;
        
        r1 = pos;
        r2 = pos;
        if (input.charCodeAt(pos) === 60) {
          r3 = "<";
          pos++;
        } else {
          r3 = null;
          if (reportFailures === 0) {
            matchFailed("\"<\"");
          }
        }
        if (r3 !== null) {
          r4 = parse___();
          if (r4 !== null) {
            r5 = parse_identifier();
            if (r5 !== null) {
              r6 = parse___();
              if (r6 !== null) {
                r7 = parse_identifier();
                r7 = r7 !== null ? r7 : "";
                if (r7 !== null) {
                  r8 = parse___();
                  if (r8 !== null) {
                    r9 = parse_attributes();
                    r9 = r9 !== null ? r9 : "";
                    if (r9 !== null) {
                      r10 = parse___();
                      if (r10 !== null) {
                        if (input.charCodeAt(pos) === 62) {
                          r11 = ">";
                          pos++;
                        } else {
                          r11 = null;
                          if (reportFailures === 0) {
                            matchFailed("\">\"");
                          }
                        }
                        if (r11 !== null) {
                          r12 = [];
                          r14 = pos;
                          r16 = pos;
                          reportFailures++;
                          if (input.substr(pos, 2) === "</") {
                            r15 = "</";
                            pos += 2;
                          } else {
                            r15 = null;
                            if (reportFailures === 0) {
                              matchFailed("\"</\"");
                            }
                          }
                          reportFailures--;
                          if (r15 === null) {
                            r15 = "";
                          } else {
                            r15 = null;
                            pos = r16;
                          }
                          if (r15 !== null) {
                            r16 = parse_helper();
                            if (r16 === null) {
                              r16 = parse_sourceCharacter();
                            }
                            if (r16 !== null) {
                              r13 = [r15, r16];
                            } else {
                              r13 = null;
                              pos = r14;
                            }
                          } else {
                            r13 = null;
                            pos = r14;
                          }
                          while (r13 !== null) {
                            r12.push(r13);
                            r14 = pos;
                            r16 = pos;
                            reportFailures++;
                            if (input.substr(pos, 2) === "</") {
                              r15 = "</";
                              pos += 2;
                            } else {
                              r15 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"</\"");
                              }
                            }
                            reportFailures--;
                            if (r15 === null) {
                              r15 = "";
                            } else {
                              r15 = null;
                              pos = r16;
                            }
                            if (r15 !== null) {
                              r16 = parse_helper();
                              if (r16 === null) {
                                r16 = parse_sourceCharacter();
                              }
                              if (r16 !== null) {
                                r13 = [r15, r16];
                              } else {
                                r13 = null;
                                pos = r14;
                              }
                            } else {
                              r13 = null;
                              pos = r14;
                            }
                          }
                          if (r12 !== null) {
                            if (input.substr(pos, 2) === "</") {
                              r13 = "</";
                              pos += 2;
                            } else {
                              r13 = null;
                              if (reportFailures === 0) {
                                matchFailed("\"</\"");
                              }
                            }
                            if (r13 !== null) {
                              r14 = parse___();
                              if (r14 !== null) {
                                r15 = parse_identifier();
                                if (r15 !== null) {
                                  r16 = parse___();
                                  if (r16 !== null) {
                                    if (input.charCodeAt(pos) === 62) {
                                      r17 = ">";
                                      pos++;
                                    } else {
                                      r17 = null;
                                      if (reportFailures === 0) {
                                        matchFailed("\">\"");
                                      }
                                    }
                                    if (r17 !== null) {
                                      r0 = [r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17];
                                    } else {
                                      r0 = null;
                                      pos = r2;
                                    }
                                  } else {
                                    r0 = null;
                                    pos = r2;
                                  }
                                } else {
                                  r0 = null;
                                  pos = r2;
                                }
                              } else {
                                r0 = null;
                                pos = r2;
                              }
                            } else {
                              r0 = null;
                              pos = r2;
                            }
                          } else {
                            r0 = null;
                            pos = r2;
                          }
                        } else {
                          r0 = null;
                          pos = r2;
                        }
                      } else {
                        r0 = null;
                        pos = r2;
                      }
                    } else {
                      r0 = null;
                      pos = r2;
                    }
                  } else {
                    r0 = null;
                    pos = r2;
                  }
                } else {
                  r0 = null;
                  pos = r2;
                }
              } else {
                r0 = null;
                pos = r2;
              }
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(id1, argument, attributes, inner, id2) {
        
                var children = [];
                var content = "";
                var a;
        
                for (var i = 0, l = inner.length; i < l; i++) {
                    a = inner[i][1];
                    if (a.type) {
                        if (content) {
                            children.push({
                                type: "String",
                                value: content
                            });
                        }
        
                        children.push(a);
                        content = "";
                    } else {
                        content += a;
                    }
                }
        
                if (content) {
                    children.push({
                        type: "String",
                        value: content
                    });
                }
        
                return {
                    type: "Html",
                    identifier: id1,
                    argument: argument,
                    attributes: attributes || [],
                    children: children
                };
            })(r5, r7, r9, r12, r15);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_viewDeclaration() {
        var r0, r1, r2, r3, r4, r5;
        
        r1 = pos;
        r2 = pos;
        if (input.substr(pos, 3) === "def") {
          r3 = "def";
          pos += 3;
        } else {
          r3 = null;
          if (reportFailures === 0) {
            matchFailed("\"def\"");
          }
        }
        if (r3 !== null) {
          r4 = parse___();
          if (r4 !== null) {
            r5 = parse_templateInstance();
            if (r5 !== null) {
              r0 = [r3, r4, r5];
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(inst) {
                inst.type = "ViewDeclaration";
                return inst;
            })(r5);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_templateInstance() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_variable();
        if (r3 === null) {
          r3 = parse_identifier();
        }
        if (r3 !== null) {
          r4 = parse___();
          if (r4 !== null) {
            r5 = parse_attributes();
            r5 = r5 !== null ? r5 : "";
            if (r5 !== null) {
              r6 = parse___();
              if (r6 !== null) {
                if (input.charCodeAt(pos) === 59) {
                  r7 = ";";
                  pos++;
                } else {
                  r7 = null;
                  if (reportFailures === 0) {
                    matchFailed("\";\"");
                  }
                }
                if (r7 !== null) {
                  r0 = [r3, r4, r5, r6, r7];
                } else {
                  r0 = null;
                  pos = r2;
                }
              } else {
                r0 = null;
                pos = r2;
              }
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(id, attributes) {
                return {
                    type: "View",
                    constructorName: id,
                    value: id,
                    attributes: attributes || [],
                    children: []
                };
            })(r3, r5);
        }
        if (r0 === null) {
          pos = r1;
        }
        if (r0 === null) {
          r1 = pos;
          r2 = pos;
          r3 = parse_variable();
          if (r3 === null) {
            r3 = parse_identifier();
          }
          if (r3 !== null) {
            r4 = parse___();
            if (r4 !== null) {
              r5 = parse_attributes();
              r5 = r5 !== null ? r5 : "";
              if (r5 !== null) {
                r6 = parse___();
                if (r6 !== null) {
                  if (input.charCodeAt(pos) === 123) {
                    r7 = "{";
                    pos++;
                  } else {
                    r7 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"{\"");
                    }
                  }
                  if (r7 !== null) {
                    r8 = [];
                    r10 = pos;
                    r11 = parse___();
                    if (r11 !== null) {
                      r12 = parse_children();
                      if (r12 !== null) {
                        r9 = [r11, r12];
                      } else {
                        r9 = null;
                        pos = r10;
                      }
                    } else {
                      r9 = null;
                      pos = r10;
                    }
                    while (r9 !== null) {
                      r8.push(r9);
                      r10 = pos;
                      r11 = parse___();
                      if (r11 !== null) {
                        r12 = parse_children();
                        if (r12 !== null) {
                          r9 = [r11, r12];
                        } else {
                          r9 = null;
                          pos = r10;
                        }
                      } else {
                        r9 = null;
                        pos = r10;
                      }
                    }
                    if (r8 !== null) {
                      r9 = parse___();
                      if (r9 !== null) {
                        if (input.charCodeAt(pos) === 125) {
                          r10 = "}";
                          pos++;
                        } else {
                          r10 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"}\"");
                          }
                        }
                        if (r10 !== null) {
                          r0 = [r3, r4, r5, r6, r7, r8, r9, r10];
                        } else {
                          r0 = null;
                          pos = r2;
                        }
                      } else {
                        r0 = null;
                        pos = r2;
                      }
                    } else {
                      r0 = null;
                      pos = r2;
                    }
                  } else {
                    r0 = null;
                    pos = r2;
                  }
                } else {
                  r0 = null;
                  pos = r2;
                }
              } else {
                r0 = null;
                pos = r2;
              }
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
          if (r0 !== null) {
            reportedPos = r1;
            r0 = (function(id, attributes, children) {
                  children = children[0];
                  return {
                      type: "View",
                      constructorName: id,
                      value: id,
                      attributes: attributes || [],
                      children: (children && children[1]) || []
                  };
              })(r3, r5, r8);
          }
          if (r0 === null) {
            pos = r1;
          }
        }
        return r0;
      }
      
      function parse_templateInstanceNoEOL() {
        var r0, r1, r2, r3, r4, r5;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_identifier();
        if (r3 !== null) {
          r4 = parse___();
          if (r4 !== null) {
            r5 = parse_attributes();
            r5 = r5 !== null ? r5 : "";
            if (r5 !== null) {
              r0 = [r3, r4, r5];
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(id, attributes) {
                return {
                    type: "View",
                    constructorName: id,
                    value: id,
                    attributes: attributes || [],
                    children: []
                };
            })(r3, r5);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_children() {
        var r0;
        
        r0 = parse_elements();
        if (r0 === null) {
          r0 = parse_arguments();
        }
        return r0;
      }
      
      function parse_arguments() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_argument();
        if (r3 !== null) {
          r4 = [];
          r6 = pos;
          r7 = parse___();
          if (r7 !== null) {
            r8 = parse_argument();
            if (r8 !== null) {
              r5 = [r7, r8];
            } else {
              r5 = null;
              pos = r6;
            }
          } else {
            r5 = null;
            pos = r6;
          }
          while (r5 !== null) {
            r4.push(r5);
            r6 = pos;
            r7 = parse___();
            if (r7 !== null) {
              r8 = parse_argument();
              if (r8 !== null) {
                r5 = [r7, r8];
              } else {
                r5 = null;
                pos = r6;
              }
            } else {
              r5 = null;
              pos = r6;
            }
          }
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(head, tail) {
                var result = [head];
                for (var i = 0, l = tail.length; i < l; i++) {
                    result.push(tail[i][1]);
                }
        
                return result;
            })(r3, r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_argument() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8, r9;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_identifier();
        if (r3 !== null) {
          r4 = parse___();
          if (r4 !== null) {
            if (input.charCodeAt(pos) === 58) {
              r5 = ":";
              pos++;
            } else {
              r5 = null;
              if (reportFailures === 0) {
                matchFailed("\":\"");
              }
            }
            if (r5 !== null) {
              r6 = parse___();
              if (r6 !== null) {
                r7 = parse_stringLiteral();
                if (r7 === null) {
                  r7 = parse_variable();
                  if (r7 === null) {
                    r7 = parse_templateInstanceNoEOL();
                  }
                }
                if (r7 !== null) {
                  r8 = parse___();
                  if (r8 !== null) {
                    if (input.charCodeAt(pos) === 59) {
                      r9 = ";";
                      pos++;
                    } else {
                      r9 = null;
                      if (reportFailures === 0) {
                        matchFailed("\";\"");
                      }
                    }
                    if (r9 !== null) {
                      r0 = [r3, r4, r5, r6, r7, r8, r9];
                    } else {
                      r0 = null;
                      pos = r2;
                    }
                  } else {
                    r0 = null;
                    pos = r2;
                  }
                } else {
                  r0 = null;
                  pos = r2;
                }
              } else {
                r0 = null;
                pos = r2;
              }
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(id, value) {
                return {
                    type: "Argument",
                    key: id,
                    value: value
                };
            })(r3, r7);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_attributes() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_attribute();
        if (r3 !== null) {
          r4 = [];
          r6 = pos;
          r7 = parse___();
          if (r7 !== null) {
            r8 = parse_attribute();
            if (r8 !== null) {
              r5 = [r7, r8];
            } else {
              r5 = null;
              pos = r6;
            }
          } else {
            r5 = null;
            pos = r6;
          }
          while (r5 !== null) {
            r4.push(r5);
            r6 = pos;
            r7 = parse___();
            if (r7 !== null) {
              r8 = parse_attribute();
              if (r8 !== null) {
                r5 = [r7, r8];
              } else {
                r5 = null;
                pos = r6;
              }
            } else {
              r5 = null;
              pos = r6;
            }
          }
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(head, tail) {
                var result = [head];
                for (var i = 0, l = tail.length; i < l; i++) {
                    result.push(tail[i][1]);
                }
        
                return result;
            })(r3, r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_attribute() {
        var r0, r1, r2, r3, r4, r5, r6, r7;
        
        r1 = pos;
        r2 = pos;
        r3 = parse_property();
        if (r3 !== null) {
          r4 = parse___();
          if (r4 !== null) {
            if (input.charCodeAt(pos) === 61) {
              r5 = "=";
              pos++;
            } else {
              r5 = null;
              if (reportFailures === 0) {
                matchFailed("\"=\"");
              }
            }
            if (r5 !== null) {
              r6 = parse___();
              if (r6 !== null) {
                r7 = parse_stringLiteral();
                if (r7 === null) {
                  r7 = parse_variable();
                  if (r7 === null) {
                    r7 = parse_identifier();
                  }
                }
                if (r7 !== null) {
                  r0 = [r3, r4, r5, r6, r7];
                } else {
                  r0 = null;
                  pos = r2;
                }
              } else {
                r0 = null;
                pos = r2;
              }
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(id, value) {
                return {
                    type: "Attribute",
                    key: id,
                    value: value
                }
            })(r3, r7);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_property() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8;
        
        reportFailures++;
        r1 = pos;
        r2 = pos;
        r3 = parse_identifier();
        if (r3 !== null) {
          r4 = [];
          r6 = pos;
          if (input.charCodeAt(pos) === 46) {
            r7 = ".";
            pos++;
          } else {
            r7 = null;
            if (reportFailures === 0) {
              matchFailed("\".\"");
            }
          }
          if (r7 !== null) {
            r8 = parse_identifier();
            if (r8 !== null) {
              r5 = [r7, r8];
            } else {
              r5 = null;
              pos = r6;
            }
          } else {
            r5 = null;
            pos = r6;
          }
          while (r5 !== null) {
            r4.push(r5);
            r6 = pos;
            if (input.charCodeAt(pos) === 46) {
              r7 = ".";
              pos++;
            } else {
              r7 = null;
              if (reportFailures === 0) {
                matchFailed("\".\"");
              }
            }
            if (r7 !== null) {
              r8 = parse_identifier();
              if (r8 !== null) {
                r5 = [r7, r8];
              } else {
                r5 = null;
                pos = r6;
              }
            } else {
              r5 = null;
              pos = r6;
            }
          }
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(head, tail) {
                var result = [head];
                for (var i = 0, l = tail.length; i < l; i++) {
                    result.push(tail[i][1]);
                }
        
                return result.join(".");
            })(r3, r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("property");
        }
        return r0;
      }
      
      function parse_variableStatement() {
        var r0, r1, r2, r3, r4, r5;
        
        reportFailures++;
        r1 = pos;
        r2 = pos;
        r3 = parse_variable();
        if (r3 !== null) {
          r4 = parse___();
          if (r4 !== null) {
            if (input.charCodeAt(pos) === 59) {
              r5 = ";";
              pos++;
            } else {
              r5 = null;
              if (reportFailures === 0) {
                matchFailed("\";\"");
              }
            }
            if (r5 !== null) {
              r0 = [r3, r4, r5];
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(variable) {
                variable.type = "VariableStatement";
                return variable;
            })(r3);
        }
        if (r0 === null) {
          pos = r1;
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("variableStatement");
        }
        return r0;
      }
      
      function parse_variable() {
        var r0, r1, r2, r3, r4, r5, r6, r7, r8;
        
        reportFailures++;
        r1 = pos;
        r2 = pos;
        if (input.charCodeAt(pos) === 36) {
          r3 = "$";
          pos++;
        } else {
          r3 = null;
          if (reportFailures === 0) {
            matchFailed("\"$\"");
          }
        }
        if (r3 !== null) {
          r4 = parse_identifierStart();
          if (r4 !== null) {
            r5 = [];
            r6 = parse_identifierPart();
            while (r6 !== null) {
              r5.push(r6);
              r6 = parse_identifierPart();
            }
            if (r5 !== null) {
              if (input.charCodeAt(pos) === 63) {
                r6 = "?";
                pos++;
              } else {
                r6 = null;
                if (reportFailures === 0) {
                  matchFailed("\"?\"");
                }
              }
              r6 = r6 !== null ? r6 : "";
              if (r6 !== null) {
                r7 = parse___();
                if (r7 !== null) {
                  r8 = parse_attributes();
                  r8 = r8 !== null ? r8 : "";
                  if (r8 !== null) {
                    r0 = [r3, r4, r5, r6, r7, r8];
                  } else {
                    r0 = null;
                    pos = r2;
                  }
                } else {
                  r0 = null;
                  pos = r2;
                }
              } else {
                r0 = null;
                pos = r2;
              }
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(start, parts, conditional, attributes) {
                return {
                    type: "Variable",
                    value: start + parts.join(""),
                    isConditional: !!conditional,
                    attributes: attributes || []
                };
            })(r4, r5, r6, r8);
        }
        if (r0 === null) {
          pos = r1;
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("variable");
        }
        return r0;
      }
      
      function parse_identifier() {
        var r0, r1, r2, r3, r4, r5;
        
        reportFailures++;
        r1 = pos;
        r2 = pos;
        r3 = parse_identifierStart();
        if (r3 !== null) {
          r4 = [];
          r5 = parse_identifierPart();
          while (r5 !== null) {
            r4.push(r5);
            r5 = parse_identifierPart();
          }
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(start, parts) {
                return start + parts.join("");
            })(r3, r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("identifier");
        }
        return r0;
      }
      
      function parse_identifierStart() {
        var r0;
        
        if (/^[a-zA-Z_]/.test(input.charAt(pos))) {
          r0 = input.charAt(pos);
          pos++;
        } else {
          r0 = null;
          if (reportFailures === 0) {
            matchFailed("[a-zA-Z_]");
          }
        }
        return r0;
      }
      
      function parse_identifierPart() {
        var r0;
        
        r0 = parse_identifierStart();
        if (r0 === null) {
          if (/^[0-9]/.test(input.charAt(pos))) {
            r0 = input.charAt(pos);
            pos++;
          } else {
            r0 = null;
            if (reportFailures === 0) {
              matchFailed("[0-9]");
            }
          }
        }
        return r0;
      }
      
      function parse_stringLiteral() {
        var r0, r1, r2, r3, r4, r5;
        
        reportFailures++;
        r1 = pos;
        r2 = pos;
        if (input.charCodeAt(pos) === 34) {
          r3 = "\"";
          pos++;
        } else {
          r3 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\\"\"");
          }
        }
        if (r3 !== null) {
          r4 = parse_doubleStringCharacters();
          r4 = r4 !== null ? r4 : "";
          if (r4 !== null) {
            if (input.charCodeAt(pos) === 34) {
              r5 = "\"";
              pos++;
            } else {
              r5 = null;
              if (reportFailures === 0) {
                matchFailed("\"\\\"\"");
              }
            }
            if (r5 !== null) {
              r0 = [r3, r4, r5];
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 === null) {
          r2 = pos;
          if (input.charCodeAt(pos) === 39) {
            r3 = "'";
            pos++;
          } else {
            r3 = null;
            if (reportFailures === 0) {
              matchFailed("\"'\"");
            }
          }
          if (r3 !== null) {
            r4 = parse_singleStringCharacters();
            r4 = r4 !== null ? r4 : "";
            if (r4 !== null) {
              if (input.charCodeAt(pos) === 39) {
                r5 = "'";
                pos++;
              } else {
                r5 = null;
                if (reportFailures === 0) {
                  matchFailed("\"'\"");
                }
              }
              if (r5 !== null) {
                r0 = [r3, r4, r5];
              } else {
                r0 = null;
                pos = r2;
              }
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(parts) {
              return "\""+parts[1]+"\"";
            })(r0);
        }
        if (r0 === null) {
          pos = r1;
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("string");
        }
        return r0;
      }
      
      function parse_doubleStringCharacters() {
        var r0, r1, r2;
        
        r1 = pos;
        r2 = parse_doubleStringCharacter();
        if (r2 !== null) {
          r0 = [];
          while (r2 !== null) {
            r0.push(r2);
            r2 = parse_doubleStringCharacter();
          }
        } else {
          r0 = null;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(chars) { return chars.join(""); })(r0);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_singleStringCharacters() {
        var r0, r1, r2;
        
        r1 = pos;
        r2 = parse_singleStringCharacter();
        if (r2 !== null) {
          r0 = [];
          while (r2 !== null) {
            r0.push(r2);
            r2 = parse_singleStringCharacter();
          }
        } else {
          r0 = null;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(chars) { return chars.join(""); })(r0);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_doubleStringCharacter() {
        var r0, r1, r2, r3, r4;
        
        r1 = pos;
        r2 = pos;
        r4 = pos;
        reportFailures++;
        if (input.charCodeAt(pos) === 34) {
          r3 = "\"";
          pos++;
        } else {
          r3 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\\"\"");
          }
        }
        if (r3 === null) {
          if (input.charCodeAt(pos) === 92) {
            r3 = "\\";
            pos++;
          } else {
            r3 = null;
            if (reportFailures === 0) {
              matchFailed("\"\\\\\"");
            }
          }
          if (r3 === null) {
            r3 = parse_EOL();
          }
        }
        reportFailures--;
        if (r3 === null) {
          r3 = "";
        } else {
          r3 = null;
          pos = r4;
        }
        if (r3 !== null) {
          r4 = parse_sourceCharacter();
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(char_) { return char_;    })(r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        if (r0 === null) {
          r1 = pos;
          r2 = pos;
          if (input.charCodeAt(pos) === 92) {
            r3 = "\\";
            pos++;
          } else {
            r3 = null;
            if (reportFailures === 0) {
              matchFailed("\"\\\\\"");
            }
          }
          if (r3 !== null) {
            r4 = parse_characterescapeSequence();
            if (r4 !== null) {
              r0 = [r3, r4];
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
          if (r0 !== null) {
            reportedPos = r1;
            r0 = (function(sequence) { return sequence; })(r4);
          }
          if (r0 === null) {
            pos = r1;
          }
          if (r0 === null) {
            r0 = parse_lineContinuation();
          }
        }
        return r0;
      }
      
      function parse_singleStringCharacter() {
        var r0, r1, r2, r3, r4;
        
        r1 = pos;
        r2 = pos;
        r4 = pos;
        reportFailures++;
        if (input.charCodeAt(pos) === 39) {
          r3 = "'";
          pos++;
        } else {
          r3 = null;
          if (reportFailures === 0) {
            matchFailed("\"'\"");
          }
        }
        if (r3 === null) {
          if (input.charCodeAt(pos) === 92) {
            r3 = "\\";
            pos++;
          } else {
            r3 = null;
            if (reportFailures === 0) {
              matchFailed("\"\\\\\"");
            }
          }
          if (r3 === null) {
            r3 = parse_EOL();
          }
        }
        reportFailures--;
        if (r3 === null) {
          r3 = "";
        } else {
          r3 = null;
          pos = r4;
        }
        if (r3 !== null) {
          r4 = parse_sourceCharacter();
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(char_) { return char_;    })(r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        if (r0 === null) {
          r1 = pos;
          r2 = pos;
          if (input.charCodeAt(pos) === 92) {
            r3 = "\\";
            pos++;
          } else {
            r3 = null;
            if (reportFailures === 0) {
              matchFailed("\"\\\\\"");
            }
          }
          if (r3 !== null) {
            r4 = parse_characterescapeSequence();
            if (r4 !== null) {
              r0 = [r3, r4];
            } else {
              r0 = null;
              pos = r2;
            }
          } else {
            r0 = null;
            pos = r2;
          }
          if (r0 !== null) {
            reportedPos = r1;
            r0 = (function(sequence) { return sequence; })(r4);
          }
          if (r0 === null) {
            pos = r1;
          }
          if (r0 === null) {
            r0 = parse_lineContinuation();
          }
        }
        return r0;
      }
      
      function parse_lineContinuation() {
        var r0, r1, r2, r3, r4;
        
        r1 = pos;
        r2 = pos;
        if (input.charCodeAt(pos) === 92) {
          r3 = "\\";
          pos++;
        } else {
          r3 = null;
          if (reportFailures === 0) {
            matchFailed("\"\\\\\"");
          }
        }
        if (r3 !== null) {
          r4 = parse_EOL();
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(sequence) { return sequence; })(r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_characterescapeSequence() {
        var r0;
        
        r0 = parse_singleescapeCharacter();
        if (r0 === null) {
          r0 = parse_nonescapeCharacter();
        }
        return r0;
      }
      
      function parse_singleescapeCharacter() {
        var r0, r1;
        
        r1 = pos;
        if (/^['"\\bfnrtv]/.test(input.charAt(pos))) {
          r0 = input.charAt(pos);
          pos++;
        } else {
          r0 = null;
          if (reportFailures === 0) {
            matchFailed("['\"\\\\bfnrtv]");
          }
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(char_) {
              return char_
                .replace("b", "\b")
                .replace("f", "\f")
                .replace("n", "\n")
                .replace("r", "\r")
                .replace("t", "\t")
                .replace("v", "\x0B") // IE does not recognize "\v".
            })(r0);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_nonescapeCharacter() {
        var r0, r1, r2, r3, r4;
        
        r1 = pos;
        r2 = pos;
        r4 = pos;
        reportFailures++;
        r3 = parse_escapeCharacter();
        reportFailures--;
        if (r3 === null) {
          r3 = "";
        } else {
          r3 = null;
          pos = r4;
        }
        if (r3 === null) {
          r3 = parse_EOL();
        }
        if (r3 !== null) {
          r4 = parse_sourceCharacter();
          if (r4 !== null) {
            r0 = [r3, r4];
          } else {
            r0 = null;
            pos = r2;
          }
        } else {
          r0 = null;
          pos = r2;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(char_) { return char_; })(r4);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_escapeCharacter() {
        var r0;
        
        r0 = parse_singleescapeCharacter();
        if (r0 === null) {
          r0 = parse_decimalDigit();
          if (r0 === null) {
            if (input.charCodeAt(pos) === 120) {
              r0 = "x";
              pos++;
            } else {
              r0 = null;
              if (reportFailures === 0) {
                matchFailed("\"x\"");
              }
            }
            if (r0 === null) {
              if (input.charCodeAt(pos) === 117) {
                r0 = "u";
                pos++;
              } else {
                r0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"u\"");
                }
              }
            }
          }
        }
        return r0;
      }
      
      function parse_decimalDigits() {
        var r0, r1, r2;
        
        r1 = pos;
        r2 = parse_decimalDigit();
        if (r2 !== null) {
          r0 = [];
          while (r2 !== null) {
            r0.push(r2);
            r2 = parse_decimalDigit();
          }
        } else {
          r0 = null;
        }
        if (r0 !== null) {
          reportedPos = r1;
          r0 = (function(digits) { return digits.join(""); })(r0);
        }
        if (r0 === null) {
          pos = r1;
        }
        return r0;
      }
      
      function parse_decimalDigit() {
        var r0;
        
        if (/^[0-9]/.test(input.charAt(pos))) {
          r0 = input.charAt(pos);
          pos++;
        } else {
          r0 = null;
          if (reportFailures === 0) {
            matchFailed("[0-9]");
          }
        }
        return r0;
      }
      
      function parse_whiteSpace() {
        var r0;
        
        reportFailures++;
        if (/^[ \t\x0B\f]/.test(input.charAt(pos))) {
          r0 = input.charAt(pos);
          pos++;
        } else {
          r0 = null;
          if (reportFailures === 0) {
            matchFailed("[ \\t\\x0B\\f]");
          }
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("whitespace");
        }
        return r0;
      }
      
      function parse_EOL() {
        var r0;
        
        reportFailures++;
        if (/^[\n\r]/.test(input.charAt(pos))) {
          r0 = input.charAt(pos);
          pos++;
        } else {
          r0 = null;
          if (reportFailures === 0) {
            matchFailed("[\\n\\r]");
          }
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("end of line");
        }
        return r0;
      }
      
      function parse_comment() {
        var r0;
        
        reportFailures++;
        r0 = parse_multiLineComment();
        if (r0 === null) {
          r0 = parse_singleLineComment();
        }
        reportFailures--;
        if (reportFailures === 0 && r0 === null) {
          matchFailed("comment");
        }
        return r0;
      }
      
      function parse_multiLineComment() {
        var r0, r1, r2, r3, r4, r5, r6, r7;
        
        r1 = pos;
        if (input.substr(pos, 2) === "/*") {
          r2 = "/*";
          pos += 2;
        } else {
          r2 = null;
          if (reportFailures === 0) {
            matchFailed("\"/*\"");
          }
        }
        if (r2 !== null) {
          r3 = [];
          r5 = pos;
          r7 = pos;
          reportFailures++;
          if (input.substr(pos, 2) === "*/") {
            r6 = "*/";
            pos += 2;
          } else {
            r6 = null;
            if (reportFailures === 0) {
              matchFailed("\"*/\"");
            }
          }
          reportFailures--;
          if (r6 === null) {
            r6 = "";
          } else {
            r6 = null;
            pos = r7;
          }
          if (r6 !== null) {
            r7 = parse_sourceCharacter();
            if (r7 !== null) {
              r4 = [r6, r7];
            } else {
              r4 = null;
              pos = r5;
            }
          } else {
            r4 = null;
            pos = r5;
          }
          while (r4 !== null) {
            r3.push(r4);
            r5 = pos;
            r7 = pos;
            reportFailures++;
            if (input.substr(pos, 2) === "*/") {
              r6 = "*/";
              pos += 2;
            } else {
              r6 = null;
              if (reportFailures === 0) {
                matchFailed("\"*/\"");
              }
            }
            reportFailures--;
            if (r6 === null) {
              r6 = "";
            } else {
              r6 = null;
              pos = r7;
            }
            if (r6 !== null) {
              r7 = parse_sourceCharacter();
              if (r7 !== null) {
                r4 = [r6, r7];
              } else {
                r4 = null;
                pos = r5;
              }
            } else {
              r4 = null;
              pos = r5;
            }
          }
          if (r3 !== null) {
            if (input.substr(pos, 2) === "*/") {
              r4 = "*/";
              pos += 2;
            } else {
              r4 = null;
              if (reportFailures === 0) {
                matchFailed("\"*/\"");
              }
            }
            if (r4 !== null) {
              r0 = [r2, r3, r4];
            } else {
              r0 = null;
              pos = r1;
            }
          } else {
            r0 = null;
            pos = r1;
          }
        } else {
          r0 = null;
          pos = r1;
        }
        return r0;
      }
      
      function parse_multiLineCommentNoEOL() {
        var r0, r1, r2, r3, r4, r5, r6, r7;
        
        r1 = pos;
        if (input.substr(pos, 2) === "/*") {
          r2 = "/*";
          pos += 2;
        } else {
          r2 = null;
          if (reportFailures === 0) {
            matchFailed("\"/*\"");
          }
        }
        if (r2 !== null) {
          r3 = [];
          r5 = pos;
          r7 = pos;
          reportFailures++;
          if (input.substr(pos, 2) === "*/") {
            r6 = "*/";
            pos += 2;
          } else {
            r6 = null;
            if (reportFailures === 0) {
              matchFailed("\"*/\"");
            }
          }
          if (r6 === null) {
            r6 = parse_EOL();
          }
          reportFailures--;
          if (r6 === null) {
            r6 = "";
          } else {
            r6 = null;
            pos = r7;
          }
          if (r6 !== null) {
            r7 = parse_sourceCharacter();
            if (r7 !== null) {
              r4 = [r6, r7];
            } else {
              r4 = null;
              pos = r5;
            }
          } else {
            r4 = null;
            pos = r5;
          }
          while (r4 !== null) {
            r3.push(r4);
            r5 = pos;
            r7 = pos;
            reportFailures++;
            if (input.substr(pos, 2) === "*/") {
              r6 = "*/";
              pos += 2;
            } else {
              r6 = null;
              if (reportFailures === 0) {
                matchFailed("\"*/\"");
              }
            }
            if (r6 === null) {
              r6 = parse_EOL();
            }
            reportFailures--;
            if (r6 === null) {
              r6 = "";
            } else {
              r6 = null;
              pos = r7;
            }
            if (r6 !== null) {
              r7 = parse_sourceCharacter();
              if (r7 !== null) {
                r4 = [r6, r7];
              } else {
                r4 = null;
                pos = r5;
              }
            } else {
              r4 = null;
              pos = r5;
            }
          }
          if (r3 !== null) {
            if (input.substr(pos, 2) === "*/") {
              r4 = "*/";
              pos += 2;
            } else {
              r4 = null;
              if (reportFailures === 0) {
                matchFailed("\"*/\"");
              }
            }
            if (r4 !== null) {
              r0 = [r2, r3, r4];
            } else {
              r0 = null;
              pos = r1;
            }
          } else {
            r0 = null;
            pos = r1;
          }
        } else {
          r0 = null;
          pos = r1;
        }
        return r0;
      }
      
      function parse_singleLineComment() {
        var r0, r1, r2, r3, r4, r5, r6, r7;
        
        r1 = pos;
        if (input.substr(pos, 2) === "//") {
          r2 = "//";
          pos += 2;
        } else {
          r2 = null;
          if (reportFailures === 0) {
            matchFailed("\"//\"");
          }
        }
        if (r2 !== null) {
          r3 = [];
          r5 = pos;
          r7 = pos;
          reportFailures++;
          r6 = parse_EOL();
          reportFailures--;
          if (r6 === null) {
            r6 = "";
          } else {
            r6 = null;
            pos = r7;
          }
          if (r6 !== null) {
            r7 = parse_sourceCharacter();
            if (r7 !== null) {
              r4 = [r6, r7];
            } else {
              r4 = null;
              pos = r5;
            }
          } else {
            r4 = null;
            pos = r5;
          }
          while (r4 !== null) {
            r3.push(r4);
            r5 = pos;
            r7 = pos;
            reportFailures++;
            r6 = parse_EOL();
            reportFailures--;
            if (r6 === null) {
              r6 = "";
            } else {
              r6 = null;
              pos = r7;
            }
            if (r6 !== null) {
              r7 = parse_sourceCharacter();
              if (r7 !== null) {
                r4 = [r6, r7];
              } else {
                r4 = null;
                pos = r5;
              }
            } else {
              r4 = null;
              pos = r5;
            }
          }
          if (r3 !== null) {
            r0 = [r2, r3];
          } else {
            r0 = null;
            pos = r1;
          }
        } else {
          r0 = null;
          pos = r1;
        }
        return r0;
      }
      
      function parse_EOF() {
        var r0, r1;
        
        r1 = pos;
        reportFailures++;
        if (input.length > pos) {
          r0 = input.charAt(pos);
          pos++;
        } else {
          r0 = null;
          if (reportFailures === 0) {
            matchFailed("any character");
          }
        }
        reportFailures--;
        if (r0 === null) {
          r0 = "";
        } else {
          r0 = null;
          pos = r1;
        }
        return r0;
      }
      
      function parse__() {
        var r0, r1;
        
        r0 = [];
        r1 = parse_whiteSpace();
        if (r1 === null) {
          r1 = parse_multiLineCommentNoEOL();
          if (r1 === null) {
            r1 = parse_singleLineComment();
          }
        }
        while (r1 !== null) {
          r0.push(r1);
          r1 = parse_whiteSpace();
          if (r1 === null) {
            r1 = parse_multiLineCommentNoEOL();
            if (r1 === null) {
              r1 = parse_singleLineComment();
            }
          }
        }
        return r0;
      }
      
      function parse___() {
        var r0, r1;
        
        r0 = [];
        r1 = parse_whiteSpace();
        if (r1 === null) {
          r1 = parse_EOL();
          if (r1 === null) {
            r1 = parse_comment();
          }
        }
        while (r1 !== null) {
          r0.push(r1);
          r1 = parse_whiteSpace();
          if (r1 === null) {
            r1 = parse_EOL();
            if (r1 === null) {
              r1 = parse_comment();
            }
          }
        }
        return r0;
      }
      
      function parse_sourceCharacter() {
        var r0;
        
        if (input.length > pos) {
          r0 = input.charAt(pos);
          pos++;
        } else {
          r0 = null;
          if (reportFailures === 0) {
            matchFailed("any character");
          }
        }
        return r0;
      }
      
      
      function cleanupExpected(expected) {
        expected.sort();
        
        var lastExpected = null;
        var cleanExpected = [];
        for (var i = 0; i < expected.length; i++) {
          if (expected[i] !== lastExpected) {
            cleanExpected.push(expected[i]);
            lastExpected = expected[i];
          }
        }
        return cleanExpected;
      }
      
      
      var result = parseFunctions[startRule]();
      
      /*
       * The parser is now in one of the following three states:
       *
       * 1. The parser successfully parsed the whole input.
       *
       *    - |result !== null|
       *    - |pos === input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 2. The parser successfully parsed only a part of the input.
       *
       *    - |result !== null|
       *    - |pos < input.length|
       *    - |rightmostFailuresExpected| may or may not contain something
       *
       * 3. The parser did not successfully parse any part of the input.
       *
       *   - |result === null|
       *   - |pos === 0|
       *   - |rightmostFailuresExpected| contains at least one failure
       *
       * All code following this comment (including called functions) must
       * handle these states.
       */
      if (result === null || pos !== input.length) {
        reportedPos = Math.max(pos, rightmostFailuresPos);
        var found = reportedPos < input.length ? input.charAt(reportedPos) : null;
        var reportedPosDetails = computeReportedPosDetails();
        
        throw new this.SyntaxError(
          cleanupExpected(rightmostFailuresExpected),
          found,
          reportedPos,
          reportedPosDetails.line,
          reportedPosDetails.column
        );
      }
      
      return result;
    }
  };
  
  /* Thrown when a parser encounters a syntax error. */
  
  result.SyntaxError = function(expected, found, offset, line, column) {
    function buildMessage(expected, found) {
      var expectedHumanized, foundHumanized;
      
      switch (expected.length) {
        case 0:
          expectedHumanized = "end of input";
          break;
        case 1:
          expectedHumanized = expected[0];
          break;
        default:
          expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
            + " or "
            + expected[expected.length - 1];
      }
      
      foundHumanized = found ? quote(found) : "end of input";
      
      return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
    }
    
    this.name = "SyntaxError";
    this.expected = expected;
    this.found = found;
    this.message = buildMessage(expected, found);
    this.offset = offset;
    this.line = line;
    this.column = column;
  };
  
  subclass(result.SyntaxError, Error);
  
  return result;
})();


Hector.Builders = (function (window, document) {

    var Builders = {};

    // Namespace for all the target language string templates
    Builders.templates = {};

    // local cache
    var options = Hector.options;
    var viewMethods = options.viewMethods;
    var walkTree = Hector.walkTree;
    var parseTreeNode = Hector.parseTreeNode;

    // =========================
    // == AST Parsing Helpers ==
    // =========================

    var variableCounter = {
        count: -1,
        reset: function () {
            variableCounter.count = -1;
        }
    };

    var variableNames = "abcdefghijklmnopqrstuvwxyz".split("");
    var variableNameCount = variableNames.length;
    var variableNameLastIndex = variableNameCount-1;

    function createUniqueName(i) {
        var variableName = "";
        var counter = -1;

        while (i > variableNameLastIndex) {
            i -= variableNameCount;
            counter++;
        }

        if (counter > -1) {
            variableName += createUniqueName(counter);
        }

        i = Math.floor(i);

        variableName += variableNames[i];

        return variableName;
    }

    function createUniqueIdentifier() {
        variableCounter.count++;
        return createUniqueName(variableCounter.count);
    }

    function expandAttributes(attributes, contextName) {
        var out = "";
        var attribute;

        for (var i = 0, l = attributes.length; i < l; i++) {
            attribute = attributes[i];
            if (attribute.type !== "Attribute") throw Error("Invalid attribute type: " + attribute.type);

            var value = attribute.value;
            if (value && value.type) {
                value = parseTreeNode(value);
            }

            out += contextName + "." + attribute.key + " = " + value + ";\n";
        }

        return out;
    }

    var templateCache = {};
    
    // Originally based off: Simple JavaScript Templating
    // John Resig - http://ejohn.org/ - MIT Licensed
    function render(str, data) {
        var keys = [];
        var values = [];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                values.push(data[key]);
                keys.push(key);
                str = str.replace(new RegExp("\\$"+key, 'gmi'), data[key]);
            }
            
        }

        str = "var p=[],print=function(){p.push.apply(p,arguments);};"
            + "p.push(\""
            + str.replace(/[\r\t\n]/g, "\\n")
                 .split("<%").join("\t")
                 .replace(/((^|%>)[^\t]*)'/g, "$1\r")
                 .replace(/\t=(.*?)%>/g, "\",$1,\"")
                 .split("\t").join("\");")
                 .split("%>").join("p.push(\"")
                 .split("\r").join("'")
                 .replace(/\$/gm, "")
            + "\");return p.join(\"\");";

        keys.push(str);

        console.log(str);
        var fn = Function.apply(null, keys);

        console.log(fn.toString());
        return fn.apply(null, values);
    };

    function renderTemplate(templateName, data) {
        var str = Builders.templates[templateName];
        if (!str) throw Error("Builder.renderTemplate " + templateName + " not found");
        return render(str, data);
    }

    // ==============================
    // == Target Language Builders ==
    // ==============================

    Builders.Literal = function (element, contextName) {
        return element.value;
    };

    Builders.String = function (element, contextName) {
        throw Error("String is not implemented yet");
    };

    Builders.Attribute = function (element, contextName) {
        throw Error("Attribute is not implemented yet");
    };

    Builders.Variable = function (element, contextName) {
        element.evaluation = element.value;
        return renderTemplate("Variable", element);
    };

    Builders.VariableStatement = function (element, contextName) {
        element.evaluation = renderTemplate("Echo", { contextName: contextName, value: element.value });
        return renderTemplate("Variable", element);
    };

    Builders.Argument = function (element, contextName) {
        var out = "";
        var value = element.value;

        switch (value.type) {
            case "Variable":
                value = Builders.Variable(value).toString();
                break;
            case "View":
                value = value.value;
                break;
            default:
                value = value.toString();
        }

        out += contextName + ".context." + element.key + " = " + value + ";\n";

        return out;
    };

    Builders.View = function (element, contextName) {
        // @TODO fix this mess. Only part of this can use a template right now
        // cause it changes the AST too much
        var out = "";
        var inner = "";
        var varName = createUniqueIdentifier();
        var constructorName = element.constructorName;

        out += "'" + element.constructorName + "';\n";

        if (element.children.length) {
            inner += walkTree(element.children, varName);
        }

        var attributes = element.attributes;
        var attribute;

        for (var i = 0, l = attributes.length; i < l; i++) {
            attribute = attributes[i];

            var value = attribute.value;
            if (value && value.type) {
                value = parseTreeNode(value);
            }

            value = value.replace(/"/gm, "'");
            inner += varName + "." + attribute.key + " = " + value + ";\n";
        }

        var isConditional = false;
        if (constructorName.type === "Variable") {
            isConditional = constructorName.isConditional;
            constructorName = constructorName.value;
        }

        out += renderTemplate("View", {
            contextName: contextName,
            appendChild: viewMethods.appendChild,
            varName: varName,
            constructorName: constructorName,
            isConditional: isConditional,
            inner: inner
        });

        return out;
    };

    Builders.ViewDeclaration = function (element, contextName) {
        variableCounter.reset();

        var template = "";
        template += "\"" + element.constructorName + "\";\n";
        template += expandAttributes(element.attributes, contextName);
        template += walkTree(element.children, contextName);
        
        template = template.replace(/\n/g, "\\n").replace(/\"/g, "\\\"");

        var out = "";
        out += element.constructorName + ".template = \"" + template + "\";\n";

        return out;
    };

    return Builders;
    
})(window, document);

Hector.Builders.templates["Echo"] = "Hector.echo.call($contextName, $value)";
Hector.Builders.templates["Variable"] = "<% if (isConditional) { %>\n(typeof $value !== 'undefined')\n    ? $evaluation\n    : undefined;\n<% } else { %>\n$evaluation;\n<% } %>";
Hector.Builders.templates["View"] = "<% if (isConditional) { %>\nif (typeof $constructorName !== 'undefined') {\n    var $varName = new $constructorName();\n    $inner\n    $contextName.$appendChild($varName);\n}\n<% } else { %>\nvar $varName = (typeof $constructorName !== 'undefined')\n    ? new $constructorName\n    : new HectorOptions.baseConstructor('$constructorName');\n$inner\n$contextName.$appendChild($varName);\n<% } %>";
Hector.Builders.templates["ViewDeclaration"] = "";
