(function (window, document) {
    // Local reference for the global options
    var options = Hector.options;
    var stringToElement = Hector.stringToElement;
    var camelCaseToHyphens = Hector.camelCaseToHyphens;

    function ElementConstructor(tagName) {
        if (!options.buffer) return document.createElement(tagName);

        this.tagName = tagName;
        this.children = [];
        this.layer = undefined;
        this.isRendered = false;
    }

    ElementConstructor.prototype.attributeMap = {
        className: "class"
    };

    ElementConstructor.prototype.appendChild = function (child) {
        this.children.push(child);
    };

    ElementConstructor.prototype.renderAttributes = function () {
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

    ElementConstructor.prototype.renderBuffer = function () {
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

    ElementConstructor.prototype.render = function () {
        var out = this.renderBuffer();
        this.layer = stringToElement(out);
        this.isRendered = true;
    };

    Hector.ElementConstructor = ElementConstructor;
    Hector.options.elementConstructor = ElementConstructor;

})(window, document);