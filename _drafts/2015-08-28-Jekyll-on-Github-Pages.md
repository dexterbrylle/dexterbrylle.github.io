---
layout: 		post
title:			"Jekyll on Github Pages"
date:			2015-08-29 14:32:00
description: 	A tutorial on blogging like a hacker using Jekyll, hosted by Github Pages
categories: 	Tutorials
tags:			Jekyll Github
image:			/assets/article_images/2015-08-28-Jekyll-on-Github-Pages/2H0QPGDVGZ.jpg
---

I've been thinking about starting a blog again for quite some time now. However, I was too busy doing projects and the hassle of setting up a blog is a tedious (Hi WP!) task. I think Ghost is one of the best platforms out there right now, but I wanted to try and learn something new. Enter Jekyll.

When I first heard and read about [Jekyll](http://jekyllrb.com/), I was intrigued with the idea of static files for my blog. The fact that it's lightweight, a minimalist website is perfect. Also, I can use Github's web editor to write posts online and provide version control. Code embeds are natural as well. Lastly, [Github](https://github.com) hosts Jekyll blogs [for __free__](https://pages.github.com/) which wass just icing on the cake.

Below you can find the quickest and easiest steps to deploy your own Jekyll blog.

## Getting Started
Create a new repository and name it as _```yourusername.github.io```_, also don't forget to initialize it with a README.
![](/assets/article_images/2015-08-28-Jekyll-on-Github-Pages/createrepo.JPG)

After creating the repository, clone it to your local machine.

![](/assets/article_images/2015-08-28-Jekyll-on-Github-Pages/clonerepo.JPG)


## Deploy a starting point
There are several working demos of Jekyll blogs that you can use. Below are some of my favorite minimal themes:
> + [__Kactus__](https://github.com/nickbalestra/kactus)([Demo](http://nick.balestra.ch/))
> + [__Lanyon__](https://github.com/poole/lanyon)([Demo](http://lanyon.getpoole.com/))
> + [__Poole__](https://github.com/poole/poole) ([Demo](http://demo.getpoole.com/))

For this demo, we'll use [__Kactus__](https://github.com/nickbalestra/kactus), it has the simplest configurations to get you started. So go ahead and [download](https://github.com/nickbalestra/kactus/archive/master.zip) it, extract it to your local repository and let's start customizing your blog.

## Default Jekyll structure
The initial structure of the Kactus repository:

```
$ ls -l
_drafts
_includes
_layouts
_posts
assets
.gitignore
LICENSE
README.md
_config.yml
about.md
feed.xml
index.html
```

```config.yml```` contains all of your site configurations.
