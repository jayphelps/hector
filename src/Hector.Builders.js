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

        Hector.log(str);
        var fn = Function.apply(null, keys);

        Hector.log(fn.toString());
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