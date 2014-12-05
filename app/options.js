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

(function init_i18n() {
    document.title = chrome.i18n.getMessage('vokadio_options_title');
    $("#settings-header").text(chrome.i18n.getMessage('settings'));
    $("#broadcast-audio-label").text(chrome.i18n.getMessage('audio_broadcasting'));
    $("#use-lastfm-label").text(chrome.i18n.getMessage('last_fm_scrobbling'));
    $("#disable-scrollbars-label").text(chrome.i18n.getMessage('disable_scrollbars'));
    $("#notification-show-behavior-label").text(chrome.i18n.getMessage('notification_show_behavior'));
    $("#notification-show-behavior option[value=hide]").text(chrome.i18n.getMessage('notification_hide'));
    $("#notification-show-behavior option[value=show-on-update]").text(chrome.i18n.getMessage('notification_auto'));
    $("#notification-show-behavior option[value=show-always]").text(chrome.i18n.getMessage('notification_show'));
    $("#hotkeys-section").html(chrome.i18n.getMessage('hotkeys_section'));
    $("#donate-disclaimer-text").html(chrome.i18n.getMessage('donate_disclaimer'));
    $("#donate-box").html(chrome.i18n.getMessage('donate_content'));
    $("#thanks-header").text(chrome.i18n.getMessage('thanks'));
})();

(function init_broadcast_audio_option()
{
    $('#broadcast-audio')[0].checked = bp.options.get('broadcast-audio');

    $('#broadcast-audio').change(function () {
        this.checked ? bp.options.set('broadcast-audio', true) : bp.options.delete('broadcast-audio');
    });
}());

(function init_lastfm_option()
{
    $('#use-lastfm')[0].checked = bp.options.get('lastfm');

    $('#use-lastfm').change(function () {
        this.checked ? bp.options.set('lastfm', true) : bp.options.delete('lastfm');
    });

    $(window).unload(function () { bp.checkLastfmSession(); });
}());

(function init_disable_scrollbars_option()
{
    $('#disable-scrollbars')[0].checked = bp.options.get('ui.disable-scrollbars');

    $('#disable-scrollbars').change(function () {
        bp.options.set('ui.disable-scrollbars', bp.DynamicListView.disableScrollbar = this.checked);
    });
}());

(function init_notification_option()
{
    $('#notification-show-behavior').val(bp.options.get('notification.show-behavior'));

    $('#notification-show-behavior').change(function () {
        bp.options.set('notification.show-behavior', $(this).val());
    });
}());
