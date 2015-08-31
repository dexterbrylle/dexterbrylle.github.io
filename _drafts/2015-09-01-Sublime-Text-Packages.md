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

There are many things to love about ST but a couple of features stand out to me:  __speed__ and __extensibility__. A fresh install of ST boots at around two seconds. While ST is already a good code editor fresh out the box, this brings us to the other feature that makes it stand out: extensibility. Sublime boasts a large community and a broad selection of open-source packages to help you customize your environment. My current ST3 setup (configuration & packages) boots at around 10 seconds while allowing me to work at a faster and more efficient pace. So, let's take a look at some of the packages I use.

## Package Control
Packages can be installed by manually downloading their builds and copy-pasting them into ST's package directory. However, ST has its own package control. It's like node's ```npm``` or Ubuntu's ```apt-get```.

You can automate all of this by installing ST's package control. You can do this by pressing ``` Ctrl/Cmd + ` ``` to bring up the console and copy the [code](https://packagecontrol.io/installation) appropriate for your ST version.

You can verify if it's installed properly by pressing ``` Ctrl/Cmd + Shift + P ``` and type in 'package control'. You should be able to see this:

![](/assets/article_images/2015-09-01-Sublime-Text-Packages/pkgctrl.jpg)

To install a package just type in: 'install package'

##