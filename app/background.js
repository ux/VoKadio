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

var options = new Options({
    'lastfm': false,
    'notification.show-behavior': NOTIFICATION_DEFAULT_SHOW_BEHAVIOR,
    'hotkeys.disabled': false
});

const DEBUG = options.get('debug', false);

VkAPI.logger.debugMode = DEBUG;

var vk_session = new VkAPI.Session(function (silent, finished_cb) {
    var vk_auth_url = buildUri('http://api.vk.com/oauth/authorize', {
        client_id:     VK_APP_ID,
        scope:         VK_SETTINGS,
        response_type: 'token',
        display:       'popup',
        redirect_uri:  'http://vokadio.infostyle.com.ua/auth/vk/' + chrome.extension.getURL('').match(/:\/\/(.*)\//)[1]
    });

    if (silent) {
        $('<iframe></iframe>').attr('src', vk_auth_url).load(function () {
            $(this).remove();
            finished_cb();
        }).appendTo('body');
    }
    else {
        chrome.windows.create(
            {
                url:     vk_auth_url,
                left:    parseInt((screen.width - VK_AUTH_WINDOW_WIDTH) / 2),
                top:     parseInt((screen.height - VK_AUTH_WINDOW_HEIGHT) / 2),
                width:   VK_AUTH_WINDOW_WIDTH,
                height:  VK_AUTH_WINDOW_HEIGHT,
                focused: true,
                type:    'popup'
            },
            function (window)
            {
                chrome.windows.onRemoved.addListener(removed_listener);

                function removed_listener(window_id)
                {
                    if (window_id == window.id) {
                        chrome.windows.onRemoved.removeListener(removed_listener);
                        finished_cb();
                    }
                }
            }
        );
    }
});

var vk_query = new VkAPI.Query(vk_session, 'https://api.vk.com/method/');

var lastfm = new LastFM({apiKey: LASTFM_API_KEY, apiSecret: LASTFM_API_SECRET}),
    lastfm_session = null;

var player  = new AudioPlayer.Player(),
    helper  = new PlayerHelper(lastfm, vk_query);

var my_audio     = new VK.Audio(null, player, vk_query),
    audio_search = new VK.Audio.Search(player, vk_query);

var popup_active_view   = 'my-tracklist',
    popup_previous_view = popup_active_view;


//*****************************************************************************


// This function is called from /auth/lastfm.html file
function lastfmAuthCallback(params)
{
    lastfm.auth.getSession({token: params.token}, {
        success: function (data) {
            lastfm_session = data.session;
            options.set('lastfm.session', lastfm_session);
            if (DEBUG) console.debug("last.fm session received: ", lastfm_session);
        },
        error: function (code, message) {
            throw new Error("Error retrieving last.fm session: " + message + " (Error code: " + code + ")");
        }
    });
}

function checkLastfmSession()
{
    if (options.get('lastfm')) {
        lastfm_session = options.get('lastfm.session', null);

        if ( ! lastfm_session)
            chrome.tabs.create({url: buildUri('http://www.lastfm.ru/api/auth', {
                api_key: LASTFM_API_KEY,
                cb: chrome.extension.getURL('/auth/lastfm.html')
            })});
    }
    else {
        lastfm_session = null;
        options.delete('lastfm.session');
    }
}


//*****************************************************************************


(function init_player()
{
    VK.Audio.bindHistory(player, vk_query);

    player.currentPlaylist = my_audio.currentAlbum.playlist;

    player.audio.volume = options.get('player.volume', 1);
    player.audio.addEventListener('volumechange', function () {
        options.set('player.volume', player.audio.volume);
    });

    player.playorder = options.get('player.playorder', AudioPlayer.Player.PLAYORDER_NORMAL);
    player.addEventListener(AudioPlayer.Player.EVENT_PLAYORDER_CHANGED, function () {
        options.set('player.playorder', player.playorder);
    });

    player.repeatMode = options.get('player.repeatMode', AudioPlayer.Player.REPEAT_PLAYLIST);
    player.addEventListener(AudioPlayer.Player.EVENT_REPEAT_MODE_CHANGED, function () {
        options.set('player.repeatMode', player.repeatMode);
    });
}());

(function init_notification()
{
    if (options.get('notification.show-behavior') == 'show-always')
        show_notification();

    player.history.addEventListener(AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
        if (event.nowPlaying && options.get('notification.show-behavior') != 'hide' && chrome.extension.getViews({type: 'notification'}).length == 0)
            show_notification();
    });

    function show_notification()
    {
        webkitNotifications.createHTMLNotification('/notification.html').show();
    }
}());

(function init_popup_icon()
{
    var icon_rotator = new RotateAnimation(
        $('<img src="icons/popup.png" alt="" />')[0],
        {framesCount: ICON_ANIMATION_FRAMES, speed: ICON_ANIMATION_SPEED},
        function (canvas, canvasContext) {
            chrome.browserAction.setIcon({imageData: canvasContext.getImageData(0, 0, canvas.width, 19)});
        });

    player.audio.addEventListener('play', function () { icon_rotator.rotateTo(-0.5 * Math.PI); });
    player.audio.addEventListener('pause', function () { icon_rotator.rotateTo(0); });
    player.audio.addEventListener('ended', function () { icon_rotator.rotateTo(0); });

    player.audio.addEventListener('timeupdate', function (event) {
        chrome.browserAction.setBadgeText({
            text: (isNaN(this.duration) || this.ended) ? '' : helper.common.secondsToTime(this.duration - this.currentTime)
        });
    });

    player.history.addEventListener(AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
        if (event.nowPlaying)
            chrome.browserAction.setTitle({title: event.nowPlaying.artist + " - " + event.nowPlaying.title});
        else {
            chrome.browserAction.setBadgeText({text: ''});
            chrome.browserAction.setTitle({title: EXTENSION_NAME});
        }
    });
}());

(function init_vk_audio_broadcast()
{
    player.audio.addEventListener('playing', function () {
        var track = player.history.nowPlaying;
        vk_query.call('status.set', {audio: track.owner_id + '_' + track.aid});
    });
}());

(function init_lastfm_scrobbling()
{
    player.history.addEventListener(AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
        helper.lastfm.scrobbler.stop(lastfm_session);

        if (event.nowPlaying)
            helper.lastfm.scrobbler.start(event.nowPlaying);
    });

    player.audio.addEventListener('playing', function () {
        helper.lastfm.scrobbler.play(lastfm_session);
    });

    player.audio.addEventListener('pause', function () {
        helper.lastfm.scrobbler.pause();
    });

    player.audio.addEventListener('ended', function () {
        helper.lastfm.scrobbler.stop(lastfm_session);
    });
}());

(function init_global_hotkeys()
{
    chrome.extension.onRequest.addListener(function(request) {
        if (options.get('hotkeys.disabled')) return;

        switch (request.command) {
            case 'toggle-play':
                player.togglePlay();
                break;

            case 'play-next':
                player.next();
                break;

            case 'play-previous':
                player.previous();
                break;

            case 'volume-up':
                player.audio.volume += 0.05;
                (player.audio.volume > 0.95) && (player.audio.volume = 1);
                player.audio.mute = false;
                break;

            case 'volume-down':
                player.audio.volume -= 0.05;
                (player.audio.volume < 0.05) && (player.audio.volume = 0);
                player.audio.mute = (player.audio.volume == 0);
                break;
        }
    });
}());

$(document).ready(function () { checkLastfmSession(); });

(function init_vk_session()
{
    vk_session.addEventListener(VkAPI.Session.EVENT_SESSION_UPDATED, function (event) {
        options.set('vk.session', {data: event.data, updated_at: event.target.updatedAt});
    });

    var cached_session = options.get('vk.session', null);
    if ( ! (cached_session && vk_session.updateData(cached_session.data, new Date(cached_session.updated_at))))
        vk_session.refresh(true);
}());
