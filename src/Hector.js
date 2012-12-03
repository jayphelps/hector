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

    function log(arg, desc) {
        if (options.log && window.console) {
            desc = desc || "Log";
            console.log("Hector" + desc + ":", arg);
        }
    }

    Hector.log = log;

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

        log(tree, "ParseTree");

        var output = Hector.walkTree(tree.nodes, "this");

        log(output, "TemplateOutput");
    
        return output;
    };

    return Hector;

})(window, document);