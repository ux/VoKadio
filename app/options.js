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

var bp = chrome.extension.getBackgroundPage();

(function init_notification_option()
{
    $('#notification-show-behavior').val(bp.options.get('notification.show-behavior', 'show-on-update'));

    $('#notification-show-behavior').change(function () {
        bp.options.set('notification.show-behavior', $(this).val());
    });
}());


(function init_lastfm_option()
{
    $('#use-lastfm')[0].checked = bp.options.get('lastfm', false);

    $('#use-lastfm').change(function () {
        this.checked ? bp.options.set('lastfm', true) : bp.options.delete('lastfm');
    });

    $(window).unload(function () { bp.checkLastfmSession(); });
}());

