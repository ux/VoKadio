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


var vk_session = new VkSession(VK_APP_ID, VK_SETTINGS, function (session, silent) {
    var session_updated = session.updatedAt;

    var auth_url = buildUri('http://api.vkontakte.ru/oauth/authorize', {
        client_id: session.appId,
        scope: session.settings,
        response_type: 'token',
        display: 'popup',
        redirect_uri: 'http://vokadio.infostyle.com.ua/auth/vk/' + chrome.extension.getURL('').match(/:\/\/(.*)\//)[1]
    });

    var iframe = $('<iframe src="' + auth_url + '" style="display: none"></iframe>');
    $('body').append(iframe);

    iframe.load(function () {
        if ( ! silent && session.updatedAt == session_updated)
            window.open(auth_url, 'vk-auth-dialog',
                'left='   + parseInt((screen.width - VK_AUTH_WINDOW_WIDTH) / 2) + ',' +
                'top='    + parseInt((screen.height - VK_AUTH_WINDOW_HEIGHT) / 2) + ',' +
                'width='  + VK_AUTH_WINDOW_WIDTH + ',' +
                'height=' + VK_AUTH_WINDOW_HEIGHT);
        iframe.remove();
    });
});

var vk_query = new VkQuery(vk_session);

var lastfm = new LastFM({apiKey: LASTFM_API_KEY, apiSecret: LASTFM_API_SECRET});
var lastfm_session = null;

var audio_player = new AudioPlayer();
var audio_helper = new AudioHelper(lastfm);

var options = new Options();


//*****************************************************************************


function requestLastfmAuth()
{
    chrome.tabs.create({url: buildUri('http://www.lastfm.ru/api/auth', {
        api_key: LASTFM_API_KEY,
        cb: chrome.extension.getURL('/auth/lastfm.html')
    })});
}

// This function is called from /auth/lastfm.html file
function lastfmAuthCallback(params)
{
    lastfm.auth.getSession({token: params.token}, {
        success: function (data) {
            lastfm_session = data.session;
            options.set('lastfm.session', JSON.stringify(lastfm_session));
            console.debug("last.fm session received: ", lastfm_session);
        },
        error: function (code, message) {
            console.error("Error retrieving last.fm session: " + message + " (Error code: " + code + ")");
        }
    });
}

function checkLastfmSession()
{
    if (options.get('lastfm')) {
        lastfm_session = JSON.parse(options.get('lastfm.session', 'null'));

        if ( ! lastfm_session)
            requestLastfmAuth();
    }
}


//*****************************************************************************


audio_player.audio.volume = options.get('player.volume', 1);

audio_player.audio.addEventListener('volumechange', function () {
    options.set('player.volume', audio_player.audio.volume);
});


audio_player.playorder(options.get('player.playorder', AudioPlayer.PLAYORDER_NORMAL));

audio_player.addEventListener(AudioPlayer.EVENT_PLAYORDER_CHANGED, function (event) {
    options.set('player.playorder', event.playorder);
});


vk_session.addEventListener(VkSession.EVENT_SESSION_UPDATED, function () {
    vk_query.call('audio.get', {}, function (audio_records) {
        audio_player.playlist(audio_records);
    });
});

(function initNotification()
{
    var has_notification = false;
    var notification = null;

    audio_player.addEventListener(AudioPlayer.EVENT_INDEX_CHANGED, function (event) {
        if (event.index < 0 || options.get('notification.show-behavior') == 'hide' || has_notification)
            return;

        has_notification = true;
        notification = webkitNotifications.createHTMLNotification('notification.html');
        notification.onclose = function () { has_notification = false; };
        notification.show();
    });
}());

(function initPopupIcon()
{
    audio_player.addEventListener(AudioPlayer.EVENT_INDEX_CHANGED, function (event) {
        if (event.index >= 0) {
            var record = audio_player.playlist()[event.index];
            chrome.browserAction.setTitle({title: decodeHtml(record.artist + " - " + record.title)});
        }
        else {
            chrome.browserAction.setBadgeText({text: ''});
            chrome.browserAction.setTitle({title: 'VoKadio'});
        }
    });

    audio_player.audio.addEventListener('timeupdate', function (event) {
        if ( ! isNaN(this.duration))
            chrome.browserAction.setBadgeText({
                text: secondsToTime(this.duration - this.currentTime)});
    });
}());

(function initIconRotator()
{
    var icon_rotator = new RotateAnimation(
        $('<img src="icons/popup.png" alt="" />')[0],
        {framesCount: ICON_ANIMATION_FRAMES, speed: ICON_ANIMATION_SPEED},
        function (canvas, canvasContext) {
            chrome.browserAction.setIcon({
                imageData: canvasContext.getImageData(0, 0, canvas.width, 19)
            });
        });

    audio_player.audio.addEventListener('play', function () {
        icon_rotator.rotateTo(-0.5 * Math.PI);
    });

    audio_player.audio.addEventListener('pause', function () {
        icon_rotator.rotateTo(0);
    });
}());

(function initLastfmScrobbling()
{
    var now_playing = undefined;

    audio_player.addEventListener(AudioPlayer.EVENT_INDEX_CHANGED, function (event) {
        if (now_playing && lastfm_session) {
            if (now_playing.continued_at)
                now_playing.play_duration += calc_duration(now_playing.continued_at);

            if (now_playing.duration > 30 && (now_playing.play_duration >= now_playing.duration / 2 || now_playing.play_duration >= 4 * 60))
                lastfm.track.scrobble($.extend(track_to_params(now_playing), {timestamp: parseInt(now_playing.started_at.getTime() / 1000)}), lastfm_session);
        }

        now_playing = audio_player.playlist()[event.index];

        if (now_playing) {
            now_playing = $.extend({}, now_playing);
            now_playing.started_at = new Date();
            now_playing.play_duration = 0;
        }
    });

    audio_player.audio.addEventListener('playing', function () {
        now_playing.continued_at = new Date();

        if (lastfm_session)
            lastfm.track.updateNowPlaying(track_to_params(now_playing), lastfm_session);
    });

    audio_player.audio.addEventListener('pause', function () {
        now_playing.play_duration += calc_duration(now_playing.continued_at);
        now_playing.continued_at = undefined;
    });

    function track_to_params(track)
    {
        return {track: decodeHtml(track.title), artist: decodeHtml(track.artist), duration: track.duration};
    }

    function calc_duration(start_date)
    {
        return parseInt((new Date() - start_date) / 1000);
    }
}());

$(document).ready(function () { checkLastfmSession(); });

(function initVkSession()
{
    vk_session.addEventListener(VkSession.EVENT_SESSION_UPDATED, function (event) {
        options.set('vk.session', JSON.stringify({data: event.data, updated_at: event.target.updatedAt}));
    });

    var session_cache = JSON.parse(options.get('vk.session', 'null'));
    if ( ! (session_cache && vk_session.data(session_cache.data, new Date(session_cache.updated_at))))
        vk_session.refresh(true);
}());

