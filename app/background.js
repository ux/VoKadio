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

var AP = AudioPlayer;

AudioPlayer = function ()
{
    EventDispatcher.call(this);

    var self = this;

    var my_audio = new AP.Playlist('my-audio');

    my_audio.addEventListener(AP.Playlist.EVENT_PLAYLIST_UPDATED, function () {
        self.dispatchEvent({type: AudioPlayer.EVENT_PLAYLIST_UPDATED});
    });

    my_audio.addEventListener(AP.Playlist.EVENT_NOW_PLAYING_CHANGED, function () {
        self.dispatchEvent({type: AudioPlayer.EVENT_INDEX_CHANGED, index: (my_audio.nowPlaying && my_audio.nowPlaying.index) ? my_audio.nowPlaying.index : -1});
    });

    var player = new AP.Player();
    player.addPlaylist(my_audio);
    player.currentPlaylist = my_audio;

    player.addEventListener(AP.Player.EVENT_PLAYORDER_CHANGED, function () {
        self.dispatchEvent({type: AudioPlayer.EVENT_PLAYORDER_CHANGED, playorder: self.playorder()});
    });

    player.addEventListener(AP.Player.EVENT_REPEAT_MODE_CHANGED, function () {
        self.dispatchEvent({type: AudioPlayer.EVENT_PLAYORDER_CHANGED, playorder: self.playorder()});
    });

    this.player = player;
    this.myAudio = my_audio;
    this.audio = player.audio;

    this.play = function (index) { player.play(index); };
    this.pause = function () { audio.pause(); };
    this.togglePlay = function (index) { player.togglePlay(index); };
    this.currentIndex = function () { return my_audio.nowPlaying ? my_audio.nowPlaying.index : -1; };
    this.previousIndex = function () { return 0; };
    this.nextIndex = function () { return 0; };
    this.previous = function () { player.previous(); };
    this.next = function () { player.next(); };

    this.playlist = function (new_playlist)
    {
        if (new_playlist)
            my_audio.playlist = new_playlist;

        return my_audio.playlist;
    };

    this.playorder = function (new_playorder)
    {
        if (new_playorder) {
            switch (new_playorder) {
                case AudioPlayer.PLAYORDER_NORMAL:
                    player.playorder = AP.Player.PLAYORDER_NORMAL;
                    player.repeatMode = AP.Player.REPEAT_PLAYLIST;
                    break;
                case AudioPlayer.PLAYORDER_LOOP:
                    player.playorder = AP.Player.PLAYORDER_NORMAL;
                    player.repeatMode = AP.Player.REPEAT_TRACK;
                    break;
                case AudioPlayer.PLAYORDER_SHUFFLE:
                    player.playorder = AP.Player.PLAYORDER_SHUFFLE;
                    player.repeatMode = AP.Player.REPEAT_PLAYLIST;
                    break;
            }
        }

        return (player.playorder == AP.Player.PLAYORDER_SHUFFLE)
            ? AudioPlayer.PLAYORDER_SHUFFLE
            : (player.repeatMode == AP.Player.REPEAT_TRACK
                ? AudioPlayer.PLAYORDER_LOOP
                : AudioPlayer.PLAYORDER_NORMAL);
    };
};

AudioPlayer.Player = AP.Player;
AudioPlayer.Playlist = AP.Playlist;
AudioPlayer.Utils = AP.Utils;

AudioPlayer.EVENT_INDEX_CHANGED     = 'deprecated.index-changed';
AudioPlayer.EVENT_PLAYLIST_UPDATED  = 'deprecated.playlist-updated';
AudioPlayer.EVENT_PLAYORDER_CHANGED = 'deprecated.playorder-changed';

AudioPlayer.PLAYORDER_NORMAL  = 'normal';
AudioPlayer.PLAYORDER_SHUFFLE = 'shuffle';
AudioPlayer.PLAYORDER_LOOP    = 'loop';


//*****************************************************************************


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

var helper = new PlayerHelper(lastfm);

var options = new Options();


//*****************************************************************************


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
            chrome.tabs.create({url: buildUri('http://www.lastfm.ru/api/auth', {
                api_key: LASTFM_API_KEY,
                cb: chrome.extension.getURL('/auth/lastfm.html')
            })});
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
    var history_playlist = audio_player.player.history.playlist;

    if (history_playlist.length > 0) {
        var audios_list = [];
        for (var i in history_playlist)
            audios_list.push(history_playlist[i].owner_id + '_' + history_playlist[i].aid);

        vk_query.call('audio.getById', {audios: audios_list.join(',')}, function (records) {
            audio_player.player.history.playlist = helper.vk.tracksForPlaylist(records);
        });
    }
});


vk_session.addEventListener(VkSession.EVENT_SESSION_UPDATED, function () {
    vk_query.call('audio.get', {count: 16000}, function (records) {
        audio_player.playlist(helper.vk.tracksForPlaylist(records));
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

    audio_player.audio.addEventListener('play', function () { icon_rotator.rotateTo(-0.5 * Math.PI); });
    audio_player.audio.addEventListener('pause', function () { icon_rotator.rotateTo(0); });
    audio_player.audio.addEventListener('ended', function () { icon_rotator.rotateTo(0); });

    audio_player.audio.addEventListener('timeupdate', function (event) {
        if ( ! isNaN(this.duration))
            chrome.browserAction.setBadgeText({text: secondsToTime(this.duration - this.currentTime)});
    });

    audio_player.addEventListener(AudioPlayer.EVENT_INDEX_CHANGED, function (event) {
        if (event.index >= 0) {
            var record = audio_player.playlist()[event.index];
            chrome.browserAction.setTitle({title: record.artist + " - " + record.title});
        }
        else {
            chrome.browserAction.setBadgeText({text: ''});
            chrome.browserAction.setTitle({title: EXTENSION_NAME});
        }
    });
}());

(function initLastfmScrobbling()
{
    audio_player.addEventListener(AudioPlayer.EVENT_INDEX_CHANGED, function (event) {
        helper.lastfm.scrobbler.stop(lastfm_session);  // is used, when track was switched and was not ended

        if (event.index >= 0 && audio_player.playlist()[event.index])
            helper.lastfm.scrobbler.start(audio_player.playlist()[event.index]);
    });

    audio_player.audio.addEventListener('playing', function () {
        helper.lastfm.scrobbler.play(lastfm_session);
    });

    audio_player.audio.addEventListener('pause', function () {
        helper.lastfm.scrobbler.pause();
    });

    audio_player.audio.addEventListener('ended', function () {
        helper.lastfm.scrobbler.stop(lastfm_session);
    });
}());

$(document).ready(function () { checkLastfmSession(); });

(function initVkSession()
{
    vk_session.addEventListener(VkSession.EVENT_SESSION_UPDATED, function (event) {
        options.set('vk.session', JSON.stringify({data: event.data, updated_at: event.target.updatedAt}));
    });

    var cached_session = JSON.parse(options.get('vk.session', 'null'));
    if ( ! (cached_session && vk_session.data(cached_session.data, new Date(cached_session.updated_at))))
        vk_session.refresh(true);
}());

