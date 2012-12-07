$(function () {
    
    Hector.eval($("#templates").text());

    /*Hector.Backbone.reopen.call(ExampleView, {

        initialize: function() {
            this.model.set({ name: "Example Name", iconClassName:"hello", label:"click me" });
        }

    });*/

    var view = new ExampleView({ model: new Backbone.Model({label: "FUCK YPU"})});

    $("body").append(view.render().el);

    var template = function (scope) {
        alert(scope.fuck);
    };

    //template({ fuck: "you" });

});