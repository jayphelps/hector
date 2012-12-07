$(function () {
    
    // Soon you'll be able to pre-compile and just include the output "binaries"
    // as normal JavaScript, without needing to Hector.eval it.
    Hector.eval($("#templates").text());

    var view = new ExampleView({ model: new Backbone.Model({ label: "Hello world" })});

    $("body").append(view.render().el);

});