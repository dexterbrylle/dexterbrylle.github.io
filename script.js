! function() {
	"use strict";
	"serviceWorker" in navigator && ("https:" === window.location.protocol || "localhost" === window.location.hostname || 0 === window.location.hostname.indexOf("127.")) && navigator.serviceWorker.register("/service-worker.js", {
		scope: "./"
	}).then(function(e) {
		"function" == typeof e.update && e.update(), e.onupdatefound = function() {
			if (navigator.serviceWorker.controller) {
				var o = e.installing;
				o.onstatechange = function() {
					switch (o.state) {
						case "installed":
							break;
						case "redundant":
							throw new Error("The installing service worker became redundant.")
					}
				}
			}
		}
	})["catch"](function(e) {
		console.error("Error during service worker registration:", e)
	})
}();
