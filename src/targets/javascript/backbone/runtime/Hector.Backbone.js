(function (window, document) {
    if (!window.Hector) throw Error("Hector must be defined before the Hector.Backbone runtime is included");
    if (!window.Backbone) throw Error("Backbone must be defined before the Hector.Backbone runtime is included");

    

    var HectorBackbone = Hector.Backbone = {};
    var HectorStringBuilder = Hector.StringBuilder;
    var HectorRender = Hector.render;

    HectorBackbone.View = Backbone.View.extend({
        render: function() {
            var obj = (this.model && this.model.toJSON()) || {};
            var stringBuilder = new HectorStringBuilder();

            HectorRender(this.template, obj, stringBuilder);
            this.$el.html(stringBuilder.renderBuffer());

            return this;
        }
    });

    /**
     * For right now, we aren't attaching these helpers to the view's themselves
     * because we want to keep Hector.Backbone.View as much like Backbone.View
     * as possible. That means not adding new methods!
     */

    /**
     * Helper for both Hector.Backbone.View and Hector.ElementConstructor, used
     * inside the AttributeStatement Hector template
     */
    HectorBackbone.setAttribute = function (key, value, context) {
        context = context || this;
        
        if (context instanceof Backbone.View) {
            context.$el.attr(key, value);
        } else if (context instanceof Hector.ElementConstructor) {
            context[key] = value;
        }
    };

    /**
     * Helper method to add more members to an already existing View
     */
    HectorBackbone.reopen = function (obj, context) {
        context = context || this;
        _.extend(context.prototype, obj);
    };

})(window, document);