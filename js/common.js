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

function doVkAuth(session, iframe_only, close_window_on_auth_window)
{
    const VK_AUTH_WINDOW_ATTRS_STR =
        'left='   + parseInt((screen.width - VK_AUTH_WINDOW_WIDTH) / 2) + ',' +
        'top='    + parseInt((screen.height - VK_AUTH_WINDOW_HEIGHT) / 2) + ',' +
        'width='  + VK_AUTH_WINDOW_WIDTH + ',' +
        'height=' + VK_AUTH_WINDOW_HEIGHT;
    
    iframe_only = iframe_only || false;
    close_window_on_auth_window = close_window_on_auth_window == undefined ? true : close_window_on_auth_window;
    
    var session_updated = session.lastUpdated();
    
    var login_url = 'http://vkontakte.ru/login.php?app=' + session.appId() +
                    '&layout=popup&type=browser&settings=' + session.settings();
    
    var iframe = $('<iframe src="' + login_url + '" style="display: none"></iframe>');
    $('body').append(iframe);
    
    iframe.load(function () {
        setTimeout(function () {
            iframe.remove();
            
            if ( ! iframe_only && session.lastUpdated() == session_updated) {
                if (close_window_on_auth_window && window)
                    window.close();
                
                window.open(login_url, 'vk-auth-dialog', VK_AUTH_WINDOW_ATTRS_STR);
            }
        }, AUTH_WINDOW_OPEN_DELAY);
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

function isEmpty(obj)
{
    for (var prop in obj)
        if (obj.hasOwnProperty(prop))
            return false;
    
    return true;
}

var regexp_specials = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

function regExpEscape(str)
{
    return (str != undefined) ? str.toString().replace(regexp_specials, '\\$&') : undefined;
}

