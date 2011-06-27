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


//*****************************************************************************


var vk_session = new VkSession(VK_APP_ID, VK_SETTINGS, requestVkAuth);
var vk_query   = new VkQuery(vk_session);

var lastfm = new LastFM({apiKey: LASTFM_API_KEY, apiSecret: LASTFM_API_SECRET});

var audio_player = new AudioPlayer();
var audio_helper = new AudioHelper(vk_query, lastfm, audio_player);

var options = new Options();


//*****************************************************************************


function setIconFromCanvas(canvas, canvasContext)
{
    chrome.browserAction.setIcon({
        imageData: canvasContext.getImageData(0, 0, canvas.width, 19)
    });
}

var icon_rotator = new RotateAnimation($('<img src="icons/popup.png" alt="" />')[0],
                                       setIconFromCanvas,
                                       { framesCount: ICON_ANIMATION_FRAMES,
                                         speed: ICON_ANIMATION_SPEED });

audio_player.audio.addEventListener('play', function () {
    icon_rotator.rotateTo(-0.5 * Math.PI);
});

audio_player.audio.addEventListener('pause', function () {
    icon_rotator.rotateTo(0);
});


//*****************************************************************************


audio_player.audio.volume = options.get('player.volume', 1);

audio_player.audio.addEventListener('volumechange', function () {
    options.set('player.volume', audio_player.audio.volume);
});


audio_player.playorder(options.get('player.playorder', AudioPlayer.PLAYORDER_NORMAL));

audio_player.addEventListener(AudioPlayer.EVENT_PLAYORDER_CHANGED, function (event) {
    options.set('player.playorder', event.playorder);
});


//*****************************************************************************


var has_notification = false;
var notification = null;

function playlistIndexChangedHandler(event)
{
    if (event.index >= 0) {
        if (options.get('notification.show-behavior') != 'hide' && ! has_notification) {
            has_notification = true;
            notification = webkitNotifications.createHTMLNotification('notification.html');
            notification.onclose = function () { has_notification = false; };
            notification.show();
        }

        var record = audio_player.playlist()[audio_player.currentIndex()];
        chrome.browserAction.setTitle({title: decodeHtml(record.artist + " - " + record.title)});
    }
    else {
        chrome.browserAction.setBadgeText({text: ''});
        chrome.browserAction.setTitle({title: 'VoKadio'});
    }
}

function playerTimeUpdatedHandler(event)
{
    if ( ! isNaN(this.duration))
        chrome.browserAction.setBadgeText({
            text: secondsToTime(this.duration - this.currentTime)
        });
}

audio_player.addEventListener(AudioPlayer.EVENT_INDEX_CHANGED,
                              playlistIndexChangedHandler);

audio_player.audio.addEventListener('timeupdate', playerTimeUpdatedHandler);


//*****************************************************************************


requestVkAuth(vk_session, true);

