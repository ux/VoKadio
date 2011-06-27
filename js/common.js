/*
 * This file is part of VoKadio extension for Google Chrome browser
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

function requestVkAuth(session, silent_only)
{
    silent_only = silent_only || false;

    var session_updated = session.updatedAt();

    var auth_url = 'http://api.vkontakte.ru/oauth/authorize?client_id=' + session.appId() +
                   '&scope=' + session.settings() + '&response_type=token&display=popup' +
                   '&redirect_uri=http://vokadio.infostyle.com.ua/auth/vk/' +
                   chrome.extension.getURL('').match(/:\/\/(.*)\//)[1];

    var iframe = $('<iframe src="' + auth_url + '" style="display: none"></iframe>');
    $('body').append(iframe);

    iframe.load(function () {
        if ( ! silent_only && session.updatedAt() == session_updated)
            window.open(auth_url, 'vk-auth-dialog', 'left='   + parseInt((screen.width - VK_AUTH_WINDOW_WIDTH) / 2) + ',' +
                                                    'top='    + parseInt((screen.height - VK_AUTH_WINDOW_HEIGHT) / 2) + ',' +
                                                    'width='  + VK_AUTH_WINDOW_WIDTH + ',' +
                                                    'height=' + VK_AUTH_WINDOW_HEIGHT);
        iframe.remove();
    });
}

var html_decode_div = $('<div/>');

function decodeHtml(html)
{
    return html_decode_div.html(html).text();
}

function secondsToTime(microtime)
{
    if (isNaN(microtime))
        return '0:00';
    else {
        var minutes = parseInt(microtime / 60).toString();
        var seconds = parseInt(microtime % 60).toString();

        if (seconds.length == 1)
            seconds = '0' + seconds;

        return  minutes + ':' + seconds;
    }
}

var regexp_specials = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

function regExpEscape(str)
{
    return (str != undefined) ? str.toString().replace(regexp_specials, '\\$&') : undefined;
}

