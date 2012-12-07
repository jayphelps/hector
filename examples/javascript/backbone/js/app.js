$(function () {
    
    Hector.eval($("#templates").text());

    var view = new ExampleView({ model: new Backbone.Model({ label: "Hello world" })});

    $("body").append(view.render().el);

});