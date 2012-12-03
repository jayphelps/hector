Hector.js
======

In progress.


### Example
	
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
	}
	
	def HomePageView backgroundColor="red" {
		TopBarView;
		ContentView {
			heading: "Welcome to the home page!";
		}
	}


###### Output of a rendered HomePageView:
	<div style="background-color: red">
		<header>
			<img src="logo.png">
			<span class="button-view">Click Me</span>
		</header>
		<div style="width: 960px;">
			<h1>Welcome to the home page!</h1>
			<span class="button-view">I am a button!</span>
		</div>
	</div>
	
	
	