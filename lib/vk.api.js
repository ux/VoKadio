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

var VkAPI = {API_URL: 'https://api.vkontakte.ru/method/', DEBUG: false};

VkAPI.Query = function (session)
{
    var self = this;

    this.__defineGetter__('session', function () { return session; });

    success_callback = function (response) {};
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

        params_list = [];
        for (var k in params)
            params_list.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));

        var request_url = VkAPI.API_URL + encodeURIComponent(method) + '?' + params_list.join('&');
        if (VkAPI.DEBUG) console.debug("VKontakte API request URL:", request_url);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', request_url, true);
        xhr.onreadystatechange = function()
        {
            if (xhr.readyState != 4)
                return;

            var response = JSON.parse(xhr.responseText);

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
                    case 14: // TODO: Captcha is needed. Need to process this error in future. http://vkontakte.ru/developers.php?o=-1&p=%CE%F8%E8%E1%EA%E0:%20Captcha%20is%20needed
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

VkAPI.Session = function (app_id, settings, request_auth_cb)
{
    EventDispatcher.call(this);

    settings = settings || 0;

    var data = null, updated_at = null, self = this;

    this.__defineGetter__('appId', function () { return app_id; });
    this.__defineGetter__('settings', function () { return settings; });
    this.__defineGetter__('data', function () { return data; });
    this.__defineGetter__('updatedAt', function () { return updated_at; });

    this.updateData = function (new_data, update_time)
    {
        if (new_data && new_data != data) {
            update_time = update_time || new Date();

            if (update_time.getTime() + new_data.expires_in * 1000 - Date.now() > 0) {
                set_data_and_updated_at(new_data, update_time);
                return true;
            }
            else
                return false;
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

    var refresh_status = 0, refresh_status_timeout;

    this.refresh = function (silent)
    {
        silent = silent || false;
        var new_refresh_status = silent ? 1 : 2;

        if (new_refresh_status > refresh_status) {
            refresh_status = new_refresh_status;
            clearTimeout(refresh_status_timeout);
            refresh_status_timeout = setTimeout(function () { refresh_status = 0; }, 30000);

            request_auth_cb(this, silent);
        }
    };

    var refresh_timeout, forget_timeout;

    function set_data_and_updated_at(new_data, update_time)
    {
        refresh_status = 0;
        clearTimeout(refresh_status_timeout);

        data = new_data;
        updated_at = update_time;

        clearTimeout(refresh_timeout);
        clearTimeout(forget_timeout);

        if (self.exists()) {
            if (VkAPI.DEBUG) console.debug("Session data received (" + updated_at + "):", data);

            var forget_timeout_time = updated_at.getTime() + data.expires_in * 1000 - Date.now();

            refresh_timeout = setTimeout(function () { self.refresh(true); }, forget_timeout_time - 30000);
            forget_timeout  = setTimeout(function () { self.forget(); }, forget_timeout_time);

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

