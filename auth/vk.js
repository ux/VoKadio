function decodeURIComponentEx(s)
{
    return decodeURIComponent(s).replace(/\+/, ' ');
}

function extractParams(params_str)
{
    var params = {};

    var params_list = params_str.split('&');
    for (var i in params_list) {
        var param_parts = params_list[i].split('=');
        params[decodeURIComponentEx(param_parts[0])] = decodeURIComponentEx(param_parts[1]);
    }

    return params;
}

if (location.hash.length > 1)
    chrome.extension.getBackgroundPage().vk_session.updateData(extractParams(location.hash.substr(1)));

if (location.search.length > 1) {
    // Most of all we have got an authorization error. Nothing to handle...
    // The location.search could be the following:
    // ?error=access_denied&error_reason=user_denied&error_description=User+denied+your+request
}

chrome.tabs.query({'active': true}, function(tab) {
    chrome.tabs.remove(tab[0].id, function() { });
});