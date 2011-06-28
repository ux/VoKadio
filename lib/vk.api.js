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

function VkQuery(session)
{
    this.doRequest = function (method_name, method_params, callback)
    {
        if (typeof callback != 'function')
            throw new Error('Incorrect callback function');

        if (session.isEmpty())
            throw new Error('There is no VK session');

        params = method_params || {};
        params.access_token = session.data().access_token;

        params_list = [];
        for (var k in params)
            params_list.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));

        var request_url = VkQuery.API_URL + method_name + '?' + params_list.join('&');
        console.debug('Request URL:', request_url);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', request_url, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                var response = JSON.parse(xhr.responseText);

                console.debug('Request response: ', response);

                if (response.error)
                    throw new VkError(response.error);

                else if (response.response)
                    callback(response.response);

                else
                    throw new Error('Incorrect response');
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

VkQuery.API_URL = 'https://api.vkontakte.ru/method/';

function VkSession(app_id, settings, request_auth_cb)
{
    EventDispatcher.call(this);

    settings = settings || 0;

    var data = null;
    var updated_at = null;

    this.appId    = function () { return app_id;    };
    this.settings = function () { return settings;  };

    this.data = function (new_data)
    {
        if (new_data && new_data != data)
            setData(new_data);

        return data;
    };

    this.forget    = function () { setData(null); };
    this.exists    = function () { return data != null; };
    this.isEmpty   = function () { return ! this.exists(); };
    this.updatedAt = function () { return updated_at; };
    this.refresh   = function () { request_auth_cb(this); };

    var self = this;

    function setData(new_data)
    {
        data = new_data;
        updated_at = new Date();

        console.debug('Session received: ', new_data);

        self.dispatchEvent({type: VkSession.EVENT_SESSION_UPDATED, data: new_data});
    }
}

VkSession.EVENT_SESSION_UPDATED = 'session-updated';


function VkError(vk_error)
{
    this.name    = 'VkError';
    this.message = vk_error.error_msg;
    this.code    = vk_error.error_code;
    this.params  = {};

    for (var i in vk_error.request_params)
        this.params[vk_error.request_params[i].key] = vk_error.request_params[i].value;
}

VkError.prototype = new Error();

VkError.prototype.toString = function ()
{
    var params_list = [];
    for (var i in this.params)
        params_list.push(i + ' = ' + this.params[i]);

    return 'VKontakte error (' + this.code + '): ' + this.message + ' (' + params_list.join('; ') + ')';
};

