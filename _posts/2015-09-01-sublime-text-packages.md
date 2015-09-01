---
layout: 		post
title:			"Sublime Text workflow and essential packages"
date:			2015-09-01 02:12:00
description: 	My Sublime Text 3 workflow configuration
categories:
tags:	Sublime Text 3
image:
---

Every developer has their own set of tools to implement their solutions to various projects. One of the most essential tool is the program where to write beautiful code. Programming languages play a major part in choosing the right one for the job.

I've tried several code editors from IDEs ([WebStorm](https://www.jetbrains.com/webstorm/), [Eclipse](https://eclipse.org/), [phpDesigner](http://www.mpsoftware.dk/phpdesigner.php)) to text/code editors ([Notepad++](https://notepad-plus-plus.org/), [Sublime Text](http://www.sublimetext.com/), [Brackets](http://brackets.io/)). And after almost 10+ years of writing code I've found my perfect programming companion, Sublime Text. It's safe to say I won't be ditching it any time soon.

There are many things to love about ST but a couple of features stand out to me:  __speed__ and __extensibility__. A fresh install of ST boots at around two seconds. While ST is already a good code editor fresh out the box, this brings us to the other feature that makes it stand out: extensibility. Sublime boasts a large community and a broad selection of open-source packages to help you customize your environment. My current ST3 setup (configuration & packages) boots at around 5-7 seconds while allowing me to work at a faster and more efficient pace. So, let's take a look at some of the packages I use.

## Package Control
Packages can be installed by manually downloading their builds and copy-pasting them into ST's package directory. However, ST has its own package control. It's like node's ```npm``` or Ubuntu's ```apt-get```.

You can automate all of this by installing ST's package control. You can do this by pressing ``` Ctrl/Cmd + ` ``` to bring up the console and copy the [code](https://packagecontrol.io/installation) appropriate for your ST version.

You can verify if it's installed properly by pressing ``` Ctrl/Cmd + Shift + P ``` and type in 'package control'. You should be able to see this:

![](/assets/article_images/2015-09-01-Sublime-Text-Packages/pkgctrl.jpg)

To install a package just type in: 'install package'

### [All AutoComplete](https://packagecontrol.io/packages/All%20Autocomplete)
_Extends the default autocomplete to find matches in all open files._

This package allows me to see almost all references when I'm working in either a small or big project. It saves you the hassle of switching files just to see that variable name or method.

### [AngularJS](https://packagecontrol.io/packages/AngularJS)
_AngularJS code completion, snippets, go to definition, quick panel search, and more._

If you're working with AngularJS, this one will come in handy as it gives you completion with everything Angular.

### [DocBlockr](https://packagecontrol.io/packages/DocBlockr)
_Simplifies writing DocBlock comments in Javascript, PHP, CoffeeScript, Actionscript, C & C++_

### [Emmet](https://packagecontrol.io/packages/Emmet)
One of my most used extensions. It allows you to do more by writing less. For example if I write ```html:5``` then I press ``` Ctrl/Cmd + e```

![](/assets/article_images/2015-09-01-Sublime-Text-Packages/emmet.JPG)

### [Git](https://packagecontrol.io/packages/Git)
_Git integration: it's pretty handy. Who knew, right?_

Version control systems are critical to any project. And more often than not, you'll be working with the most popular VCS, Git. With this package, you can execute Git commands without switching back to your terminal.

### [JavaScriptCompetions](https://packagecontrol.io/packages/JavaScript%20Completions)
_JavaScript Completions for sublime text. It helps you to write your scripts more quickly with hints and completions._

Similar with Emmet, but for JavaScript.

### [JavaScript Next - ES6 Syntax](https://packagecontrol.io/packages/JavaScriptNext%20-%20ES6%20Syntax)
_JavaScript language definition for TextMate and SublimeText2_

I use this package not only for aesthethics, but also, it allows me to quickly identify different parts of my code. Also, it keeps me in check to follow ECMAScript 6 standards. To know more about ECMAScript 6, you can visit this [repo](https://github.com/lukehoban/es6features).

To activate this package for your JS files. Simply open up a js or json file and set it's syntax to JavaScript Next - ES6 Syntax.

_View_ > _Syntax_ > _Open all with current extension as.._ > _JavaScript Next - ES6 Syntax_

![](/assets/article_images/2015-09-01-Sublime-Text-Packages/js6.png)

### [JSFormat](https://packagecontrol.io/packages/JsFormat)
_Javascript formatting for Sublime Text 2 & 3_

This package makes sure that your code is formatted to its most readable state (lol).

### [Markdown Preview](https://packagecontrol.io/packages/Markdown%20Preview)
_Preview and build your markdown files quickly in your web browser from sublime text 2/3._

If you're going to work with Markdown, this package is a must-install.

### [SideBar Enhancements](https://packagecontrol.io/packages/SideBarEnhancements)
_Enhancements to Sublime Text sidebar. Files and folders._

Additional options for your sidebar.

![](/assets/article_images/2015-09-01-Sublime-Text-Packages/sidebar.png)

### [Theme - Material Theme](https://packagecontrol.io/packages/Material%20Theme)
_Material Theme, the most epic theme for Sublime Text 3 by Mattia Astorino_

Material Theme on Sublime Text. 'Nuff said.

### [Theme - Brogrammer](https://packagecontrol.io/packages/Theme%20-%20Brogrammer)
_Brogrammer is a flat sexy Sublime Text theme. Pushups not included._

Before Material Theme, this was my default theme in all of my Sublime Text installations. I've included this in the list because of its great color scheme which I still use in combination with Material Theme.

## Preferences > Settings - User
Below is the my Sublime Text configuration, you can copy or make tweaks as you see fit.

```json
{
	"always_show_minimap_viewport": true,
	"auto_complete_commit_on_tab": false,
	"bold_folder_labels": true,
	"caret_style": "phase",
	"close_windows_when_empty": false,
	"color_scheme": "Packages/Theme - Brogrammer/brogrammer.tmTheme",
	"detect_slow_plugins": false,
	"draw_minimap_border": true,
	"enable_tab_scrolling": false,
	"findreplace_small": true,
	"font_size": 13,
	"highlight_line": true,
	"ignored_packages":
	[
		"Vintage"
	],
	"indent_guide_options":
	[
		"draw_normal",
		"draw_active"
	],
	"line_padding_bottom": 3,
	"line_padding_top": 3,
	"match_brackets_angle": true,
	"material_theme_accent_orange": true,
	"material_theme_bold_tab": true,
	"material_theme_panel_separator": true,
	"material_theme_tabs_separator": false,
	"open_files_in_new_window": false,
	"overlay_scroll_bars": "enabled",
	"preview_on_click": false,
	"scroll_past_end": true,
	"scroll_speed": 6.0,
	"show_full_path": false,
	"theme": "Material-Theme-Darker.sublime-theme",
	"trim_trailing_white_space_on_save": true,
	"word_wrap": true
}
```

So there you have it. These are the Sublime Text packages that I use to help my efficiency and productivity. I've configured it to work with my workflow pace. Tinker with Sublime Text and its settings until you get your desired environment. Oh, and also share any good packages that helps you in the comments below. Happy coding! :)