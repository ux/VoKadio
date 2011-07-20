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

function playorder(player, new_playorder)
{
    if (new_playorder) {
        switch (new_playorder) {
            case 'normal':
                player.playorder = AudioPlayer.Player.PLAYORDER_NORMAL;
                player.repeatMode = AudioPlayer.Player.REPEAT_PLAYLIST;
                break;
            case 'loop':
                player.playorder = AudioPlayer.Player.PLAYORDER_NORMAL;
                player.repeatMode = AudioPlayer.Player.REPEAT_TRACK;
                break;
            case 'shuffle':
                player.playorder = AudioPlayer.Player.PLAYORDER_SHUFFLE;
                player.repeatMode = AudioPlayer.Player.REPEAT_PLAYLIST;
                break;
        }
    }

    return (player.playorder == AudioPlayer.Player.PLAYORDER_SHUFFLE)
        ? 'shuffle'
        : (player.repeatMode == AudioPlayer.Player.REPEAT_TRACK ? 'loop' : 'normal');
}


//*****************************************************************************

var options = new Options();

var DEBUG = options.get('debug', false);

VkAPI.DEBUG = DEBUG;

var vk_session = new VkAPI.Session(VK_APP_ID, VK_SETTINGS, function (session, silent) {
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

var vk_query = new VkAPI.Query(vk_session);

var lastfm = new LastFM({apiKey: LASTFM_API_KEY, apiSecret: LASTFM_API_SECRET});
var lastfm_session = null;

var player = new AudioPlayer.Player(),
    helper = new PlayerHelper(lastfm),
    my_audio = new VK.Audio(null, player, vk_query, helper);


//*****************************************************************************


// This function is called from /auth/lastfm.html file
function lastfmAuthCallback(params)
{
    lastfm.auth.getSession({token: params.token}, {
        success: function (data) {
            lastfm_session = data.session;
            options.set('lastfm.session', JSON.stringify(lastfm_session));
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
        lastfm_session = JSON.parse(options.get('lastfm.session', 'null'));

        if ( ! lastfm_session)
            chrome.tabs.create({url: buildUri('http://www.lastfm.ru/api/auth', {
                api_key: LASTFM_API_KEY,
                cb: chrome.extension.getURL('/auth/lastfm.html')
            })});
    }
}


//*****************************************************************************


(function initPlayer()
{
    player.currentPlaylist = my_audio.currentAlbum.createPlaylist();

    player.audio.volume = options.get('player.volume', 1);
    player.audio.addEventListener('volumechange', function () {
        options.set('player.volume', player.audio.volume);
    });

    playorder(player, options.get('player.playorder', 'normal'));
    player.addEventListener(AudioPlayer.Player.EVENT_PLAYORDER_CHANGED, store_playorder);
    player.addEventListener(AudioPlayer.Player.EVENT_REPEAT_MODE_CHANGED, store_playorder);

    vk_session.addEventListener(VkAPI.Session.EVENT_SESSION_RECEIVED, function () {
        var history_items = player.history.items;

        if (history_items.length > 0) {
            var audios_list = [];
            for (var i in history_items)
                audios_list.push(history_items[i].owner_id + '_' + history_items[i].aid);

            vk_query.call('audio.getById', {audios: audios_list.join(',')}, function (records) {
                player.history.items = helper.vk.tracksForPlaylist(records);
            });
        }
    });

    function store_playorder() { options.set('player.playorder', playorder(player)); }
}());

(function initNotification()
{
    var has_notification = false;
    var notification = null;

    player.history.addEventListener(AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
        if (has_notification || options.get('notification.show-behavior') == 'hide' || !event.nowPlaying)
            return;

        has_notification = true;
        notification = webkitNotifications.createHTMLNotification('/notification.html');
        notification.onclose = function () { has_notification = false; };
        notification.show();
    });
}());

(function initPopupIcon()
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
        if ( ! isNaN(this.duration))
            chrome.browserAction.setBadgeText({text: secondsToTime(this.duration - this.currentTime)});
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

(function initLastfmScrobbling()
{
    player.history.addEventListener(AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
        helper.lastfm.scrobbler.stop(lastfm_session);  // is used, when track was switched and was not ended

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

$(document).ready(function () { checkLastfmSession(); });

(function initVkSession()
{
    vk_session.addEventListener(VkAPI.Session.EVENT_SESSION_UPDATED, function (event) {
        options.set('vk.session', JSON.stringify({data: event.data, updated_at: event.target.updatedAt}));
    });

    var cached_session = JSON.parse(options.get('vk.session', 'null'));
    if ( ! (cached_session && vk_session.updateData(cached_session.data, new Date(cached_session.updated_at))))
        vk_session.refresh(true);
}());

