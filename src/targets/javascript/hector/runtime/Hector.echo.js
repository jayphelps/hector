(function (window, document) {
    // Local reference for the global options
    var options = Hector.options;
    var isFunction = Hector.isFunction;

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
        var node = new options.textNodeConstructor(value);

        // Prefer appendNode, if they've got it
        if (this.appendNode) {
            this.appendNode(node);
        } else {
            this.appendChild(node);
        }

        return value;
    };

})(window, document);