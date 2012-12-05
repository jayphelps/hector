$(function () {
    
    
    /**
     * Helper method to add more members to an already existing View
     */
    Backbone.View.reopen = function (obj) {
        _.extend(this.prototype, obj);
    };
    
    Hector.eval($("#templates").text());

    ExampleView.reopen({

        initialize: function() {
            this.model.set({ name: "Example Name", iconClassName:"hello", label:"click me" });
        },

        render: function() {
            var stringBuilder = new Hector.StringBuilder();

            Hector.render(this.template, this.model.toJSON(), stringBuilder);
            var output = stringBuilder.renderBuffer();

            this.$el.html(output);

            return this;
        }
    });

    var view = new ExampleView({ model: new Backbone.Model });
    $("body").append(view.render().el);


});