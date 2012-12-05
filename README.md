Hector [![Build Status](https://travis-ci.org/jayphelps/hector.png)](https://travis-ci.org/jayphelps/hector)
======
In progress.


### Example
```   
// This is a valid comment
/* So is this */

def LogoView tagName="img" src="logo.png";

def ButtonView tagName="span" className="button-view" {
    // Optional content. If a `label` isn't provided,
    // the <b> will simply be empty.
    b { $label?; }
}

def TopBarView tagName="header" {
    LogoView;
    ButtonView {
        label: "Click me";
    }
}

def ContentView style.width="960px" {
    h1 { $heading; }
    ButtonView {
        label: "I am a button!";
    }
    <#if $items?>
    ul {
        <#each $items>
        li { $name; }
        </each>
    }
    </if>
}

def HomePageView backgroundColor="red" {
    TopBarView;
    ContentView {
        heading: "Welcome to the home page!";
        items: ["first", "second", "third"];
    }
}

// Since we declared the previous views, they are reusable

def AboutPageView backgroundColor="green" {
    TopBarView;
    ContentView {
        heading: "Now you are on the About page.";
    }
}
```

###### Output of a rendered HomePageView instance (JavaScript target)
```html
<div style="background-color: red">
    <header>
        <img src="logo.png">
        <span class="button-view">Click Me</span>
    </header>
    <div style="width: 960px;">
        <h1>Welcome to the home page!</h1>
        <span class="button-view">I am a button!</span>
        <ul>
            <li>first</li>
            <li>second</li>
            <li>third</li>
        </ul>
    </div>
</div>
```