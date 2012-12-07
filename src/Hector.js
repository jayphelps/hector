/**
 * Hector
 * (c) 2012 Jay Phelps
 * MIT Licensed
 * https://github.com/jayphelps/hector
 */
var Hector = (function (window, document) {
    "use strict";

    var Hector = {};

    var options = Hector.options = {
        log: true,
        debug: true,
        buffer: true,
        namespace: "window",
        target: "javascript/hector"
    };

    var log = Hector.log = function (arg, desc) {
        if (options.log && window.console) {
            desc = desc || "Log";
            console.log("Hector" + desc + ":", arg);
        }
    }

    // =========================
    // == AST Parsing Helpers ==
    // =========================

    Hector.parseTreeNode = function (node, contextName) {
        if (!node || !node.type) return node;

        var builder = Hector.Builders[node.type];
        if (!builder) throw Error("No builder for type: " + node.type);

        var out = builder(node, contextName).toString();

        return out;
    };

    Hector.walkTree = function (tree, contextName) {
        var out = [];

        for (var i = 0, l = tree.length; i < l; i++) {
            out.push(Hector.parseTreeNode(tree[i], contextName));
        }
        
        return out;
    };

    // ===================
    // == External API ===
    // ===================

    /**
     * Internal render implementation that is wrapped by Hector.render();
     */
    function render(template, data, context) {
        // Apply the template to our view context
        template.call(context, data);
    }

    /**
     * External facing wrapper for the real render(). This allows us to wrap it
     * in a try/catch if debug is on
     */
    Hector.render = function (template, data, context) {
        if (!context) throw Error("Hector.render() a context is required.");

        if (options.debug) {
            var templateAsString = template.toString();
            var constructorName = templateAsString.slice(0, templateAsString.indexOf(";\n")).replace(/\"/g, "");

             try {
                render(template, data, context);
            } catch (e) {
                throw Hector.ExceptionWrapper(e, "rendering template " + constructorName);
            }
        } else {
            render(template, data, context);
        }
    };

    Hector.compile = function (source) {
        if (!source) return "";

        var tree = Hector.Parser.parse(source);

        log(tree, "ParseTree");

        var output = Hector.walkTree(tree.nodes, "this").join("");

        log(output, "TemplateOutput");
    
        return output;
    };

    Hector.eval = function (source) {
        var output = Hector.compile(source);
        var script = document.createElement("script");
        script.appendChild(document.createTextNode(output));
        (document.body || document.head || document.documentElement).appendChild(script);
    };

    return Hector;

})(window, document);