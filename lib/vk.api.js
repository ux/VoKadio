/*
 * JavaScript implementation of VKontakte API
 *
 * Copyright (c) 2007 - 2011 InfoStyle Company (http://infostyle.com.ua/)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

function VkQuery(session, api_url)
{
    api_url = api_url || VkQuery.API_URL;

    if ( ! session instanceof VkSession)
        throw new VkException('Session is not instance of VkSession');

    this.doRequest = function (method_name, method_params, callback)
    {
        if (typeof callback != 'function')
            throw new VkException('Incorrect callback function');

        if ( ! session.hasSession())
            throw new VkException('Session does not exists');

        params = method_params || {};

        params.api_id    = session.appId();
        params.method    = method_name;
        params.v         = VkQuery.API_VERSION;
        params.format    = VkQuery.RESPONSE_FORMAT;
        params.test_mode = Number(session.testMode());
        params.sig       = VkQuery.makeSig(params, session.session());
        params.sid       = session.session().sid;

        console.debug('params: ', params);

        params_list = [];

        for (var k in params)
            params_list.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));

        var url = api_url + '?' + params_list.join('&');

        console.debug('api request url: ', url);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                var response = JSON.parse(xhr.responseText);

                console.debug('response: ', response);

                if (response.error)
                    throw new VkError(response.error);

                else if (response.response)
                    callback(response.response);

                else
                    throw new VkException('Incorrect response');
            }
        };
        xhr.send();

        return xhr;
    };

    this.session = function ()
    {
        return session;
    };
}

VkQuery.API_VERSION     = '3.0';
VkQuery.API_URL         = 'http://api.vkontakte.ru/api.php';
VkQuery.RESPONSE_FORMAT = 'JSON';

VkQuery.makeSig = function (params, session)
{
    sig_params = [];

    for (var k in params)
        sig_params.push(k + '=' + params[k]);

    sig_params.sort();

    raw_sig = session.mid + sig_params.join('') + session.secret;

    console.debug('raw sig: ', raw_sig);

    return md5(unescape(encodeURIComponent(raw_sig)));
};

function VkSession(app_id, test_mode, settings)
{
    EventDispatcher.call(this);

    test_mode = test_mode || false;
    settings  = settings || 0;

    var session = null;
    var last_updated = null;

    this.appId    = function () { return app_id;    };
    this.testMode = function () { return test_mode; };
    this.settings = function () { return settings;  };

    this.session = function (new_session)
    {
        if (new_session && new_session != session)
            setSession(new_session);

        return session;
    };

    this.deleteSession = function () { setSession(null); };
    this.hasSession    = function () { return session != null; };
    this.lastUpdated   = function () { return last_updated; };

    var that = this;

    function setSession(new_session)
    {
        console.info('setting new session data: ', new_session);
        session = new_session;
        last_updated = Date();
        that.dispatchEvent({type: VkSession.EVENT_SESSION_UPDATED, session: new_session});
    }
}

VkSession.EVENT_SESSION_UPDATED = 'session-updated';

function VkException(message)
{
    this.name    = 'VkException';
    this.message = message;

    this.toString = function ()
    {
        return 'VKontakte exception: ' + message;
    };
}

function VkError(vk_error)
{
    this.name    = 'VkError';
    this.message = vk_error.error_msg;
    this.code    = vk_error.error_code;
    this.params  = {};

    for (var i in vk_error.request_params)
        this.params[vk_error.request_params[i].key] = vk_error.request_params[i].value;

    this.toString = function ()
    {
        var params_list = [];
        for (var i in this.params)
            params_list.push(i + ' = ' + this.params[i]);

        return 'VKontakte error (' + this.code + '): ' + this.message + ' (' + params_list.join('; ') + ')';
    };
}

VkException.prototype = new Error();
VkError.prototype = new Error();

