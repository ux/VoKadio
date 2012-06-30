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

var VkAPI = {};

VkAPI.Query = function (session, api_url, default_retry_interval)
{
    default_retry_interval = default_retry_interval || 333;

    var self = this;

    this.__defineGetter__('session', function () { return session });

    this.__defineGetter__('apiUrl', function () { return api_url });
    this.__defineSetter__('apiUrl', function (url) { api_url = url });

    this.call = function (method, params, callbacks, start_retry_interval)
    {
        params = params || {};

        switch (typeof callbacks) {
            case 'undefined': callbacks = {}; break;
            case 'function': callbacks = {success: callbacks}; break;
        }

        start_retry_interval = start_retry_interval || default_retry_interval;

        return call_method(start_retry_interval, true);

        function success_cb(response)
        {
            return callbacks.success && callbacks.success(response);
        }

        function error_cb(error)
        {
            VkAPI.logger.error(error.toString());
            return callbacks.error && callbacks.error(error);
        }

        function call_method(retry_interval, allow_update_session)
        {
            var params_list    = [],
                request_params = [
                    {key: 'fake',   value: 1},
                    {key: 'oauth',  value: 1},
                    {key: 'method', value: method}];

            for (var k in params) {
                params_list.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
                request_params.push({key: k, value: params[k]});
            }

            if (session.isEmpty) {
                refresh_session_and_call_method(allow_update_session, new VkAPI.Error({
                    error_code:     5,
                    error_msg:      "User authorization failed",
                    request_params: request_params
                }));

                return null;
            }
            else {
                params_list.push("access_token=" + encodeURIComponent(session.data.access_token));
                request_params.push({key: 'access_token', value: session.data.access_token});

                var request_url = api_url + encodeURIComponent(method) + '?' + params_list.join('&');
                VkAPI.logger.debug("URL API запроса:", request_url);

                var xhr = new XMLHttpRequest();
                xhr.onreadystatechange = xhr_ready_state_changed;
                xhr.open('GET', request_url, true);
                xhr.send();

                return xhr;
            }

            function xhr_ready_state_changed()
            {
                if (this.readyState != 4)
                    return;

                try {
                    var response = JSON.parse(this.responseText);

                    if ( ! response || ( ! response.error && response.response === undefined))
                        throw new Error("Invalid response");
                }
                catch (e) {
                    request_params.push({key: 'response', value: this.responseText});

                    return error_cb(new VkAPI.Error({
                        error_code:     0,
                        error_msg:      "ВКонтакте возвратил неверный ответ",
                        request_params: request_params
                    }));
                }

                VkAPI.logger.debug("ответ API:", response);

                if (response.error) {
                    var error = new VkAPI.Error(response.error);

                    switch (error.code) {
                        case 5: // User authorization failed.
                            session.forget();
                            refresh_session_and_call_method(allow_update_session, error);
                            break;

                        case 6: // Too many requests per second.
                            VkAPI.logger.warning(error.toString());
                            setTimeout(function () {
                                call_method(2 * retry_interval, allow_update_session);
                            }, retry_interval);
                            break;

                        case 7: // Permission to perform this action is denied by user.
                            refresh_session_and_call_method(allow_update_session, error);
                            break;

                        case 9: // Flood control enabled for this action.
                            VkAPI.logger.inform("ВКонтакте запретил данное действия на некоторое время, посчитав его использование Вами как флуд.");
                            error_cb(error);
                            break;

                        case 1: // Unknown error occurred. - Why??? What should I do?
                        case 2: // Application is disabled. - Unbelievable! Very strange...
                        case 4: // Incorrect signature. - We don't use API with signature!
                        case 8: // Invalid request. - What you mean?
                        case 10: // Server error. - Congratulations!
                        case 14: // TODO: Captcha is needed. Need to process this error in future. http://vk.com/developers.php?o=-1&p=%CE%F8%E8%E1%EA%E0:%20Captcha%20is%20needed
                        default:
                            error_cb(error);
                    }
                }
                else
                    success_cb(response.response);
            }
        }

        function refresh_session_and_call_method(allow_update_session, error)
        {
            if (allow_update_session) {
                VkAPI.logger.warning(error.toString());
                session.refresh(false, function (failed) {
                    if (failed)
                        error_cb(error);
                    else
                        call_method(start_retry_interval, false);
                });
            }
            else
                error_cb(error);
        }
    };
};


VkAPI.Session = function (request_auth_cb, forget_delay)
{
    forget_delay = forget_delay || 30000;

    EventDispatcher.call(this);

    var data = null,
        updated_at = null,
        refresh_status = 0,
        refreshing_finished_cbs = [],
        self = this;

    this.__defineGetter__('data', function () { return data });
    this.__defineGetter__('updatedAt', function () { return updated_at });
    this.__defineGetter__('exists', function () { return !!data });
    this.__defineGetter__('isEmpty', function () { return !data });
    this.__defineGetter__('refreshing', function () { return refresh_status != 0 });

    this.refresh = function (silent, finished_cb)
    {
        var self = this,
            new_refresh_status = (silent || false) ? 1 : 2;

        if (finished_cb)
            refreshing_finished_cbs.push(finished_cb);

        if (refresh_status == 0) {
            refresh_status = new_refresh_status;

            var update_time = self.updatedAt;

            request_auth_cb(true, function () {
                if (refresh_status == 2 && refreshing_failed())
                    request_auth_cb(false, function () {
                        finish_refreshing(refreshing_failed());
                    });
                else
                    finish_refreshing(refreshing_failed());
            });

            function refreshing_failed()
            {
                return self.isEmpty || self.updatedAt == update_time;
            }
        }
        else if (new_refresh_status > refresh_status)
            refresh_status = new_refresh_status;
    };

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

    function finish_refreshing(failed)
    {
        for (var i in refreshing_finished_cbs)
            refreshing_finished_cbs[i](failed);

        refresh_status = 0;
        refreshing_finished_cbs = [];
    }

    var refreshing_timeout;

    function set_data_and_updated_at(new_data, update_time)
    {
        data = new_data;
        updated_at = update_time;

        clearTimeout(refreshing_timeout);

        if (self.exists) {
            VkAPI.logger.debug("Получены новые данные сессии [" + updated_at + "]:", data);

            refreshing_timeout = setTimeout(function () {
                refreshing_timeout = setTimeout(function () { self.forget() }, forget_delay);
                self.refresh(true);
            }, (data.expires_in * 1000 - forget_delay) - (Date.now() - updated_at.getTime()));

            self.dispatchEvent({type: VkAPI.Session.EVENT_SESSION_RECEIVED, data: data});
        }
        else {
            VkAPI.logger.debug("Данные сессии были забыты");

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
    var msg = "Ошибка ВКонтакте: " + this.message + " (код ошибки: " + this.code + ")",
        params_list = [];

    for (var k in this.params)
        params_list.push(k + " = " + this.params[k]);

    if (params_list.length > 0)
        msg += "\n\nПараметры запроса:\n" + params_list.join("\n");

    return msg;
};


VkAPI.logger = {
    debugMode: false,

    debug: function ()
    {
        this.debugMode && console.debug.apply(console, arguments);
    },

    warning: function ()
    {
        console.warn.apply(console, arguments);
    },

    error: function ()
    {
        console.error.apply(console, arguments);
    },

    inform: function (message, is_error)
    {
        message = message.toString();
        is_error && console.error(message) || console.warn(message);
        alert(message);
    }
};
