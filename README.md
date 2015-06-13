Hector [![Build Status](https://travis-ci.org/jayphelps/hector.png)](https://travis-ci.org/jayphelps/hector)
======
In progress.


### Example
```groovy
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
![](https://ssl.google-analytics.com/__utm.gif?utmwv=5.3.8&utms=6&utmn=1180464769&utmhn=jayphelps.com&utmcs=UTF-8&utmsr=1366x768&utmvp=1366x331&utmsc=24-bit&utmul=en-us&utmje=1&utmfl=11.5%20r31&utmdt=Hector%20Github&utmhid=1114821283&utmr=0&utmp=%2Fhector&utmac=UA-33446752-1&utmcc=__utma%3D221278083.1685971992.1352361675.1354869083.1355292485.11%3B%2B__utmz%3D221278083.1352361675.1.1.utmcsr%3D&utmu=q~)
