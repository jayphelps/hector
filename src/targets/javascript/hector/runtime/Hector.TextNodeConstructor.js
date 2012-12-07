(function (window, document) {
    // Local reference for the global options
    var options = Hector.options;
    
    function TextNodeConstructor(value) {
        if (!options.buffer) return document.createTextNode(value);

        this.value = value;
        this.isRendered = false;
    }

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

    Hector.TextNodeConstructor = TextNodeConstructor;
    Hector.options.textNodeConstructor = TextNodeConstructor;

})(window, document);