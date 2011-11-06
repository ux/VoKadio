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

var VkAPI = {DEBUG: false};

VkAPI.Query = function (session, api_url)
{
    var self = this;

    this.__defineGetter__('session', function () { return session; });

    var success_callback = function (response) {},
        error_callback   = function (error) { throw error; };

    this.call = function (method, params, callbacks, retry_timeout, allow_session_autoupdate)
    {
        retry_timeout = retry_timeout || 333;
        allow_session_autoupdate = allow_session_autoupdate != undefined ? allow_session_autoupdate : true;

        if (session.isEmpty()) {
            if (allow_session_autoupdate)
                return refresh_session_and_call(method, params, callbacks, false);
            else
                throw new Error("There is no VKontakte session");
        }

        switch (typeof callbacks) {
            case 'undefined': callbacks = {}; break;
            case 'function': callbacks = {success: callbacks}; break;
        }

        callbacks.success = callbacks.success || success_callback;
        callbacks.error   = callbacks.error || error_callback;

        params = params || {};
        params.access_token = session.data.access_token;

        var params_list = [];
        for (var k in params)
            params_list.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));

        var request_url = api_url + encodeURIComponent(method) + '?' + params_list.join('&');
        if (VkAPI.DEBUG) console.debug("VKontakte API request URL:", request_url);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', request_url, true);
        xhr.onreadystatechange = function()
        {
            if (xhr.readyState != 4)
                return;

            eval("var response = " + xhr.responseText);

            if (VkAPI.DEBUG) console.debug("VKontakte API response:", response);

            if (response.error) {
                var error = new VkAPI.Error(response.error);

                switch (error.code) {
                    case 6: // Too many requests per second.
                        setTimeout(function () { self.call(method, params, callbacks, 2 * retry_timeout); }, retry_timeout);
                        break;
                    case 9: // Flood control enabled for this action.
                        alert("ВКонтакте запретил данное действия на некоторое время, посчитав его использование Вами как флуд.");
                        break;
                    case 5: // User authorization failed.
                        if (allow_session_autoupdate) {
                            refresh_session_and_call(method, params, callbacks, true);
                            break;
                        }
                    case 7: // Permission to perform this action is denied by user. Need request permissions by refreshing the session.
                        if (allow_session_autoupdate) {
                            refresh_session_and_call(method, params, callbacks, false);
                            break;
                        }
                    case 1: // Unknown error occurred. - Why??? What should I do?
                    case 2: // Application is disabled. - Unbelievable! Very strange...
                    case 4: // Incorrect signature. - We don't use API with signature!
                    case 8: // Invalid request. - What you mean?
                    case 10: // Server error. - Congratulations!
                    case 14: // TODO: Captcha is needed. Need to process this error in future. http://vk.com/developers.php?o=-1&p=%CE%F8%E8%E1%EA%E0:%20Captcha%20is%20needed
                    default:
                        callbacks.error(error);
                }
            }
            else if (response.response)
                callbacks.success(response.response);
            else
                throw new Error("Incorrect response");
        };
        xhr.send();

        return xhr;
    };

    var refresh_session_and_call = function (method, params, callbacks, forget_session_on_timeout)
    {
        var forget_timeout;

        if (forget_session_on_timeout)
            forget_timeout = setTimeout(function () { session.forget(); }, 30000);

        var session_updated_listener = function ()
        {
            clearTimeout(forget_timeout);
            session.removeEventListener(VkAPI.Session.EVENT_SESSION_UPDATED, session_updated_listener);
            self.call(method, params, callbacks, undefined, false); // Error will be thrown, if session was not refreshed and was forgotten.
        };

        session.addEventListener(VkAPI.Session.EVENT_SESSION_UPDATED, session_updated_listener);
        session.refresh();
    };
};

VkAPI.Session = function (request_auth_cb, forget_delay)
{
    forget_delay = forget_delay || 30000;

    EventDispatcher.call(this);

    var data = null, updated_at = null, self = this;

    this.__defineGetter__('data', function () { return data; });
    this.__defineGetter__('updatedAt', function () { return updated_at; });

    this.updateData = function (new_data, update_time)
    {
        update_time = update_time || new Date();

        if (new_data && (update_time.getTime() + new_data.expires_in * 1000 - Date.now() > 0)) {
            set_data_and_updated_at(new_data, update_time);
            return true;
        }
        else
            return false;
    };

    this.forget = function ()
    {
        set_data_and_updated_at(null, null);
    };

    this.exists  = function () { return !!data; };
    this.isEmpty = function () { return !data; };

    var refresh_status = 0;

    this.refresh = function (silent)
    {
        var self = this,
            new_refresh_status = (silent || false) ? 1 : 2;

        if (refresh_status == 0) {
            refresh_status = new_refresh_status;

            var update_time = updated_at;

            request_auth_cb.call(self, true, function () {
                if (refresh_status == 2 && updated_at == update_time)
                    request_auth_cb.call(self, false, function () { refresh_status = 0; });
                else
                    refresh_status = 0;
            });
        }
        else if (new_refresh_status > refresh_status)
            refresh_status = new_refresh_status;
    };

    var refreshing_timeout;

    function set_data_and_updated_at(new_data, update_time)
    {
        data = new_data;
        updated_at = update_time;

        clearTimeout(refreshing_timeout);

        if (self.exists()) {
            if (VkAPI.DEBUG) console.debug("Session data received (" + updated_at + "):", data);

            refreshing_timeout = setTimeout(function () {
              refreshing_timeout = setTimeout(function () { self.forget(); }, forget_delay);
              self.refresh(true);
            }, (data.expires_in * 1000 - forget_delay) - (Date.now() - updated_at.getTime()));

            self.dispatchEvent({type: VkAPI.Session.EVENT_SESSION_RECEIVED, data: data});
        }
        else {
            if (VkAPI.DEBUG) console.debug("Session data forgotten");

            self.dispatchEvent({type: VkAPI.Session.EVENT_SESSION_FORGOTTEN});
        }

        self.dispatchEvent({type: VkAPI.Session.EVENT_SESSION_UPDATED, data: data});
    }
};

VkAPI.Session.EVENT_SESSION_RECEIVED  = 'session-received';
VkAPI.Session.EVENT_SESSION_FORGOTTEN = 'session-forgotten';
VkAPI.Session.EVENT_SESSION_UPDATED   = 'session-updated';


VkAPI.Error = function (vk_error)
{
    Error.call(this, vk_error.error_msg);

    this.message = vk_error.error_msg;
    this.code    = vk_error.error_code;
    this.params  = {};

    for (var i in vk_error.request_params)
        this.params[vk_error.request_params[i].key] = vk_error.request_params[i].value;
};

VkAPI.Error.prototype = new Error();
VkAPI.Error.prototype.constructor = VkAPI.Error;
VkAPI.Error.prototype.name = 'VkAPI.Error';
VkAPI.Error.prototype.toString = function ()
{
    var params_list = [];
    for (var i in this.params)
        params_list.push(i + " = " + this.params[i]);

    return "VKontakte error (" + this.code + "): " + this.message + " (" + params_list.join("; ") + ")";
};

