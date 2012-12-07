(function (window, document) {
    // Local reference for the global options
    var options = Hector.options;

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

    function TextNodeConstructor(value) {
        if (!options.buffer) return document.createTextNode(value);

        this.value = value;
        this.isRendered = false;
    }

    Hector.TextNodeConstructor = TextNodeConstructor;

    TextNodeConstructor.prototype.appendChild = function (child) {
        throw Error("TextNodeConstructor has no appendChild");
    };

    TextNodeConstructor.prototype.renderBuffer = function () {
        return this.value;
    };

    TextNodeConstructor.prototype.render = function () {
        var out = this.renderBuffer();
        this.layer = document.createTextNode(out);
        this.isRendered = true;
    };

    // Cache local reference so we can call it after our hook
    var HectorRenderNative = Hector.render;

    // Hook the render function so we can enable buffering if we need to
    Hector.render = function (template, data, context) {
        // If the context is a StringBuffer we're going to temporarily change
        // the buffer option then change it back after we're done        
        var prevBufferOption = options.buffer;
        if (context instanceof StringBuilder) {
            options.buffer = true;
        }

        HectorRenderNative(template, data, context);

        // Change the option back, in case we changed it
        options.buffer = prevBufferOption;
    };

})(window, document);