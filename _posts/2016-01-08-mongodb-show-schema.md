---
layout: 		post
title:			"Show a MongoDB collection's schema via Shell"
date:			2016-01-18 02:50:00
description: 	Show a MongoDB collection's schema via Shell
categories:
tags:	MongoDB
image:
---

Open a mongo shell in your machine/server

```
	mongo
```

And run the following commands

```
	> show dbs
	local 0.014753GB
	company 0.32113GB
```

```
	> use company
	switched to db company
```

```
	> show collections
	system.indexes
	northamerica
	asia
	europe
```

```
	> var coll = = db.asia.findOne();
	> for (k in coll) { print (k); }
	_id
	name
	country
	email
	contact
	address
```