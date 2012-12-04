Hector.Builders = (function (window, document) {

    var nativeForEach = Array.prototype.forEach;

    Hector.forEach = function (obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, l = obj.length; i < l; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (iterator.call(context, obj[key], key, obj) === breaker) return;
                }
            }
        }
    };

    (Hector.symbols = []).add = function (symbol) {
        if (this.indexOf(symbol) === -1) {
            this.push(symbol);
        }
    };

    Hector.comma = ",\n   ";

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

    var IdentifierBuilder = {
        count: -1,
        stack: [],
        save: function () {
            this.stack.push(IdentifierBuilder.count);
            IdentifierBuilder.count = -1;
        },
        restore: function () {
            IdentifierBuilder.count = this.stack.pop();
        },
        create: function () {
            IdentifierBuilder.count++;
            var varName = createUniqueName(IdentifierBuilder.count);

            if (Hector.symbols.indexOf(varName) !== -1) {
                return this.create();
            } else {
                return varName;
            }
        }
    };

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

        // Workaround for lack of lookbehinds. Need to escape existing quotes
        str = str.replace(/(\\)?\\\"/g, function ($0, $1) {
            return $1 ? $0 : "\\\\\\\"";
        }).replace(/(\\)?\"/g, function ($0, $1) {
            return $1 ? $0 : "\\\"";
        });

        str = "var p=[],print=function(){p.push.apply(p,arguments);};"
            + "p.push(\""
            + str.replace(/[\r\t\n]/g, "\\n")
            .split("<%").join("\t")
            .replace(/((^|%>)[^\t]*)'/g, "$1\r")
                 .replace(/\t=(.*?)%>/g, "\",$1,\"")
                 .split("\t").join("\");")
                 .split("%>").join("p.push(\"")
                 .split("\r").join("\\'")
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

    Builders.StringLiteral = function (element, contextName) {
        return element.value;
    };

    Builders.Variable = function (element, contextName) {
        element.evaluation = element.value;
        return renderTemplate("Variable", element);
    };

    Builders.VariableStatement = function (element, contextName) {
        element.evaluation = renderTemplate("Echo", {
            contextName: contextName,
            value: element.value
        });

        return renderTemplate("Variable", element);
    };

    Builders.Argument = function (element, contextName) {
        var out = "";
        var value = element.value;

        switch (value.type) {
            case "Variable":
                value = Builders.Variable(value);
                break;
            case "ViewStatement":
                value = value.value;
                break;
            default:
                value = value.toString();
        }

        out += contextName + ".context." + element.key + " = " + value + ";\n";

        return out;
    };

    function AttributeCommon(templateName, element, contextName) {
        var out = renderTemplate(templateName, {
            key: element.key,
            value: parseTreeNode(element.value),
            contextName: contextName
        });

        return out;
    }

    Builders.AttributeStatement = function (element, contextName) { 
        return AttributeCommon("AttributeStatement", element, contextName);
    };

    Builders.AttributeDeclaration = function (element, contextName) { 
        return AttributeCommon("AttributeDeclaration", element, contextName);
    };

    Builders.ViewStatement = function (element, contextName) {
        // @TODO fix this mess. Only part of this can use a template right now
        // cause it changes the AST too much
        var out = "";
        var inner = "";
        var constructorName = element.constructorName;
        var varName = IdentifierBuilder.create();

        out += "\"" + constructorName + "\";\n";

        if (element.children.length) {
            inner += walkTree(element.children, varName).join("");
        }

        inner += walkTree(element.attributes, varName).join("\n");

        var isConditional = false;
        if (constructorName.type === "Variable") {
            isConditional = constructorName.isConditional;
            constructorName = constructorName.value;
        }

        out += renderTemplate("ViewStatement", {
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
        IdentifierBuilder.save();
        var constructorName = element.constructorName;

        var attributes = walkTree(element.attributes, contextName);

        var template = "";
        template += "\"" + constructorName + "\";\n";
        template += walkTree(element.children, contextName).join("");
        
        template = "\"" + template.replace(/\n/g, "\\\\n").replace(/\"/g, "\\\"") + "\"\n";

        attributes.push(Builders.AttributeDeclaration({
            key: "template",
            value: template,
            contextName: constructorName
        }));

        var out = renderTemplate("ViewDeclaration", {
            constructorName: constructorName,
            attributes: attributes
        });

        IdentifierBuilder.restore();
        return out;
    };

    return Builders;
    
})(window, document);