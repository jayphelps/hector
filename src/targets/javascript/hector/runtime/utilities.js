(function (window, document) {
    
    var toString = Object.prototype.toString;

    Hector.isObject = function (obj) {
        return obj === Object(obj);
    };

    Hector.isString = function (obj) {
        return toString.call(obj) == "[object String]";
    };

    Hector.isFunction = function (obj) {
        return toString.call(obj) == "[object Function]";
    };

    Hector.ExceptionWrapper = function (e, message) {
        e.name = "Hector" + e.name;
        e.message = "\"" + e.message + "\" while " + message;
        throw e;
    };

    Hector.stringToElement = function (str) {
        var container = document.createElement("x-element");
        container.innerHTML = str;
        return container.firstChild;
    };

    Hector.camelCaseToHyphens = function (str) {
        return str.replace(/([a-z][A-Z])/g, function (match) {
            return match[0] + "-" + match[1].toLowerCase();
        });
    };

    var nativeForEach = Array.prototype.forEach;

    // Boosted from Underscore.js
    Hector.forEach = function (obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, l = obj.length; i < l; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (iterator.call(context, obj[key], key, obj) === breaker) return;
                }
            }
        }
    };

})(window, document);