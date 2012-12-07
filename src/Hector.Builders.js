Hector.Builders = (function (window, document) {

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
    
    function addslashes(str) {
        return (str + "").replace(/[\\"']/gm, "\\$&").replace(/\u0000/gm, "\\0");
    }

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
            + "p.push('"
            + addslashes(str).replace(/[\r\t\n]/g, "\\n")
                 .split("<%").join("\t")
                 .replace(/((^|%>)[^\t]*)'/g, "$1\r")
                 .replace(/\t=(.*?)%>/g, "',$1,'")
                 .split("\t").join("');")
                 .split("%>").join("p.push('")
                 .split("\r").join("\\'")
                 + "');return p.join('');"

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
        element.value = "scope." + element.value;
        element.evaluation = element.value;
        return renderTemplate("Variable", element);
    };

    Builders.VariableStatement = function (element, contextName) {
        element.value = "scope." + element.value;
        element.evaluation = renderTemplate("Echo", {
            contextName: contextName,
            value: "scope." + element.value
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
        template += "function (scope) {\n";
        template += "\"" + constructorName + "\";\n";
        template += walkTree(element.children, contextName).join("");
        template += '}';
        
        // Need to cleanup things so this isn't needed...
        //template = "\"" + template.replace(/\n/g, "\\n").replace(/\"/g, "\\\"") + "\"\n";

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