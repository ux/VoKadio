function extractParams(params_str)
{
    var params = {};

    var params_list = params_str.split('&');
    for (var i in params_list) {
        var param_parts = params_list[i].split('=');
        params[decodeURIComponent(param_parts[0])] = decodeURIComponent(param_parts[1]);
    }

    return params;
}

if (location.search.length > 1)
    chrome.extension.getBackgroundPage().lastfmAuthCallback(extractParams(location.search.substr(1)));

chrome.tabs.query({'active': true}, function(tab) {
    chrome.tabs.remove(tab[0].id, function() { });
});