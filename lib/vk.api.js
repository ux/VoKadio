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
    this.session = session;

    this.doRequest = function (method_name, method_params, callback)
    {
        if (typeof callback != 'function')
            throw new Error('Incorrect callback function');

        if (this.session.isEmpty())
            throw new Error('There is no VKontakte session');

        params = method_params || {};
        params.access_token = this.session.data().access_token;

        params_list = [];
        for (var k in params)
            params_list.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));

        var request_url = VkQuery.API_URL + encodeURIComponent(method_name) + '?' + params_list.join('&');
        console.debug('VKontakte API request URL:', request_url);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', request_url, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                var response = JSON.parse(xhr.responseText);

                console.debug('VKontakte API response: ', response);

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
}

VkQuery.API_URL = 'https://api.vkontakte.ru/method/';

function VkSession(app_id, settings, request_auth_cb)
{
    EventDispatcher.call(this);

    this.appId    = app_id;
    this.settings = settings || 0;

    var data = null;
    this.updatedAt = null;

    this.data = function (new_data, updated_at)
    {
        if (new_data && new_data != data) {
            updated_at = updated_at || new Date();

            if (updated_at.getTime() + new_data.expires_in * 1000 - Date.now() > 0) {
                console.debug(updated_at, ': session data received: ', new_data);
                set_data_and_updated_at(new_data, updated_at);
            }
        }

        return data;
    };

    this.forget = function () {
        console.debug('Session data forgotten');
        set_data_and_updated_at(null, null);
    };

    this.refresh = function (silent) { request_auth_cb(this, silent || false); };
    this.exists  = function () { return !!data; };
    this.isEmpty = function () { return !data; };

    var self = this;
    var refresh_timeout, forget_timeout;

    function set_data_and_updated_at(new_data, updated_at)
    {
        data = new_data;
        self.updatedAt = updated_at;

        self.dispatchEvent({type: VkSession.EVENT_SESSION_UPDATED, data: new_data});

        clearTimeout(refresh_timeout);
        clearTimeout(forget_timeout);

        if (self.exists()) {
            var forget_timeout_time = updated_at.getTime() + new_data.expires_in * 1000 - Date.now();

            refresh_timeout = setTimeout(function () { self.refresh(true); }, forget_timeout_time - 30000);
            forget_timeout  = setTimeout(function () { self.forget(); }, forget_timeout_time);
        }
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

