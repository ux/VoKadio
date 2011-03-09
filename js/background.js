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

var vk_session = new VkSession(VK_APP_ID, VK_TEST_MODE, VK_SETTINGS);
var vk_query   = new VkQuery(vk_session);

var lastfm = new LastFM({apiKey: LASTFM_API_KEY, apiSecret: LASTFM_API_SECRET});

var audio_player = new AudioPlayer();
var audio_helper = new AudioHelper(vk_query, lastfm, audio_player);

var unload_server = new UnloadManagerServer();

var options = new Options();


//*****************************************************************************

var request_handlers = {
    updateSession: function (request) {
        vk_session.session(request.session);
        console.info('new session received');
    }
};

function extensionRequestHandler(request, sender, sendResponse)
{
    if (typeof request.handler != 'undefined') {
        var hdl = request_handlers[request.handler];
        sendResponse(hdl(request, sender, sendResponse));
    }
}

chrome.extension.onRequest.addListener(extensionRequestHandler);


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
        if ( ! has_notification) {
            has_notification = true;
            notification = webkitNotifications.createHTMLNotification('notification.html');
            notification.onclose = function () { has_notification = false; };
            notification.show();
        }
    }
    else
        chrome.browserAction.setBadgeText({text: ''});
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


doVkAuth(vk_session, true);

