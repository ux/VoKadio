/*
 * VoKadio Audio Player
 *
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

var AudioPlayer = {};

AudioPlayer.Utils = {
    cloneFrom: function () {
        var cloned_object = {};

        for (var object_index in arguments)
            for (var key in arguments[object_index])
                if (arguments[object_index].hasOwnProperty(key))
                    cloned_object[key] = arguments[object_index][key];

        return cloned_object;
    }
};

AudioPlayer.Player = function (playorder, repeat_mode)
{
    var self = this;

    EventDispatcher.call(this);

    playorder = playorder || AudioPlayer.Player.PLAYORDER_NORMAL;
    repeat_mode = repeat_mode || AudioPlayer.Player.REPEAT_PLAYLIST;

    var audio = new Audio();
    audio.autoplay = true;
    audio.preload = 'auto';
    audio.loop = repeat_mode == AudioPlayer.Player.REPEAT_TRACK;

    audio.addEventListener('emptied', function (event) { if ( ! this.paused && this.error) this.play(); });
    audio.addEventListener('stalled', function (event) { if ( ! this.paused) this.play(); });

    audio.addEventListener('ended', function (event) {
        if (current_playlist && !(repeat_mode == AudioPlayer.Player.REPEAT_NONE && history_current_index() >= history.playlist.length - 1 && current_playlist.nowPlaying && (current_playlist.nowPlaying.index == null ? current_playlist.nowPlaying.prev_index : current_playlist.nowPlaying.index) >= current_playlist.playlist.length - 1))
            setTimeout(function () { self.next(); }, 0);
    });

    var playlists = {};

    var current_playlist = null;

    var history = new AudioPlayer.Playlist('history');
    var history_playlists = {};

    history.addEventListener(AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED, function (event) {
        var i, playlist_id, playlist = event.playlist;

        for (playlist_id in history_playlists)
            for (i in history_playlists[playlist_id]) {
                var old_history_item = history_playlists[playlist_id][i];

                if (old_history_item.original) {
                    var history_item = this.getItem(old_history_item);

                    if (history_item && !history_item.original)
                        history_item.original = old_history_item.original;
                }
            }

        history_playlists = {};

        for (i in playlist)
            if (playlist[i].original) {
                var item = playlist[i];
                playlist_id = item.original.playlist.id;

                history_playlists[playlist_id] = history_playlists[playlist_id] || [];
                history_playlists[playlist_id].push(item);
            }
    });

    this.__defineGetter__('playorder', function () { return playorder; });
    this.__defineSetter__('playorder', function (new_playorder) {
        if (new_playorder != playorder) {
            playorder = new_playorder;
            this.dispatchEvent({type: AudioPlayer.Player.EVENT_PLAYORDER_CHANGED,
                                playorder: playorder});
        }
    });

    this.__defineGetter__('repeatMode', function () { return repeat_mode; });
    this.__defineSetter__('repeatMode', function (new_repeat_mode) {
        if (new_repeat_mode != repeat_mode) {
            repeat_mode = new_repeat_mode;

            audio.loop = repeat_mode == AudioPlayer.Player.REPEAT_TRACK;

            this.dispatchEvent({type: AudioPlayer.Player.EVENT_REPEAT_MODE_CHANGED,
                                repeatMode: repeat_mode});
        }
    });

    this.__defineGetter__('audio', function () { return audio; });

    this.addPlaylist = function (playlist)
    {
        playlists[playlist.id] = playlist;
    };

    this.removePlaylist = function (playlist)
    {
        playlist = this.getPlaylist(playlist);

        if (playlist == current_playlist)
            current_playlist = null;

        for (var i in history_playlists[playlist.id])
            delete history_playlists[playlist.id][i].original;

        delete history_playlists[playlist.id];

        delete playlists[playlist.id];
    };

    this.getPlaylist = function (playlist)
    {
        return playlist == undefined ? current_playlist : ((typeof playlist == 'object') ? playlists[playlist.id] : playlists[playlist]);
    };

    this.__defineGetter__('currentPlaylist', function () { return current_playlist; });
    this.__defineSetter__('currentPlaylist', function (new_current_playlist) {
        new_current_playlist = this.getPlaylist(new_current_playlist);

        if (new_current_playlist)
            current_playlist = new_current_playlist;
    });

    this.__defineGetter__('history', function () { return history; });

    this.addToHistory = function (item, playlist, index)
    {
        playlist = this.getPlaylist(playlist);
        item = playlist.getItem(item);

        if (item) {
            var history_item = history.addToPlaylist(AudioPlayer.Utils.cloneFrom(item, {
                original: {playlist: playlist, item: item}
            }), index);

            history_playlists[playlist.id] = history_playlists[playlist.id] || [];
            history_playlists[playlist.id].push(history_item);

            return history_item;
        }
        else
            return null;
    };

    this.removeFromHistory = function (item)
    {
        item = history.removeFromPlaylist(item);

        if (item && item.playlist)
            for (var i in history_playlists[item.playlist.id])
                if (history_playlists[item.playlist.id][i] == item) {
                    history_playlists[item.playlist.id].splice(i, 1);

                    if (history_playlists[item.playlist.id].length == 0)
                        delete history_playlists[item.playlist.id];

                    break;
                }

        return item;
    };

    this.togglePlay = function(item, playlist)
    {
        if (playlist == undefined && item == undefined) {
            if ( ! history.nowPlaying || audio.ended)
                return this.next();
            else {
                audio.paused ? audio.play() : audio.pause();
                return history.nowPlaying;
            }
        }
        else {
            playlist = this.getPlaylist(playlist);
            item = playlist.getItem(item);

            if (item && item.ended)
                return this.next(playlist);
            else if (item === undefined)
                return null;
            else if (history.nowPlaying && playlist == history.nowPlaying.playlist && item == playlist.nowPlaying) {
                if (audio.ended)
                    return this.next(playlist);
                else {
                    audio.paused ? audio.play() : audio.pause();
                    return history.nowPlaying;
                }
            }
            else {
                var now_playing = this.play(item, playlist, false);

                if (now_playing && playlist.nowPlaying.currentTime)
                    audio.currentTime = playlist.nowPlaying.currentTime;

                return now_playing;
            }
        }
    };

    this.playRandom = function (playlist, previous)
    {
        playlist = this.getPlaylist(playlist);

        return this.play({index: Math.floor(Math.random() * playlist.playlist.length)}, playlist, previous);
    };

    this.play = function(item, playlist, previous)
    {
        playlist = this.getPlaylist(playlist);
        item = playlist.getItem(item);
        previous = previous || false;

        if (item) {
            current_playlist = playlist;
            var history_item = this.addToHistory(item, playlist, history_current_index(!previous) + (previous ? 0 : 1));
            return this.playFromHistory(history_item);
        }
        else if (item === null)
            return this.next(playlist);
        else
            return null;
    };

    this.playFromHistory = function (item)
    {
        if ((audio.ended || audio.currentTime) && history.nowPlaying && history.nowPlaying.playlist && history.nowPlaying.playlist.nowPlaying) {
            var now_played_item = history.nowPlaying.playlist.nowPlaying;

            if (audio.ended)
                now_played_item.ended = true;
            else
                now_played_item.currentTime = audio.currentTime;
        }

        var now_playing = history.play(item);

        if (now_playing) {
            if (now_playing.original) {
                var playlist_now_playing = now_playing.original.playlist.play(now_playing.original.item);

                if (playlist_now_playing)
                    now_playing.original.item = playlist_now_playing;
            }

            audio.src = now_playing.url;
        }

        return now_playing;
    };

    this.previous = function (playlist)
    {
        if (audio.currentTime > 7) {
            audio.currentTime = 0;
            return history.nowPlaying;
        }
        else {
            playlist = this.getPlaylist(playlist);

            var index = history_current_index(false) - 1;

            if (index < 0) {
                if (playorder == AudioPlayer.Player.PLAYORDER_SHUFFLE)
                    return this.playRandom(playlist, true);
                else
                    return this.play((playlist.nowPlaying ? (playlist.nowPlaying.index == null ? playlist.nowPlaying.prev_index : playlist.nowPlaying.index) : 0) - 1, playlist, true) ||
                           this.play(playlist.playlist.length - 1, playlist, true);
            }
            else
                return this.playFromHistory(index);
        }
    };

    this.next = function (playlist)
    {
        playlist = this.getPlaylist(playlist);

        var index = history_current_index(true) + 1;

        if (index > history.playlist.length - 1) {
            if (playorder == AudioPlayer.Player.PLAYORDER_SHUFFLE)
                return this.playRandom(playlist);
            else
                return this.play(playlist.nowPlaying ? (playlist.nowPlaying.index == null ? playlist.nowPlaying.prev_index : playlist.nowPlaying.index + 1) : 0, playlist) || this.play(0, playlist);
        }
        else
            return this.playFromHistory(index);
    };

    function history_current_index(for_next_calculation)
    {
        return history.nowPlaying ? (history.nowPlaying.index == null ? history.nowPlaying.prev_index - (for_next_calculation ? 1 : 0) : history.nowPlaying.index) : history.playlist.length - 1;
    }
};

AudioPlayer.Playlist = function (id)
{
    EventDispatcher.call(this);

    var playlist     = [];
    var playlist_ids = {};
    var now_playing  = null;

    this.__defineGetter__('id', function () { return id; });

    this.__defineGetter__('playlist', function () { return playlist; });
    this.__defineSetter__('playlist', function (new_playlist) {
        playlist = [];
        playlist_ids = {};

        for (var i in new_playlist)
            this.addToPlaylist(new_playlist[i]);

        if (now_playing) {
            var time = now_playing.currentTime;
            var ended = now_playing.ended;

            var new_now_playing = this.getItem(now_playing);

            if (new_now_playing)
                now_playing = new_now_playing;
            else {
                now_playing.prev_index = now_playing.index;
                now_playing.index = null;
            }

            if (time > 0) now_playing.currentTime = time;
            if (ended)    now_playing.ended = true;
        }

        this.dispatchEvent({type: AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED,
                            playlist: playlist, nowPlaying: now_playing});
    });

    this.addToPlaylist = function (item, index)
    {
        index = index || playlist.length;
        if (index < 0)
            index = 0;

        item.index = index;

        playlist.splice(index, 0, item);

        playlist_ids[item.id] = playlist_ids[item.id] || [];
        playlist_ids[item.id].push(item);

        for (var i = item.index + 1; i < playlist.length; i++)
            playlist[i].index = i;

        return item;
    };

    this.removeFromPlaylist = function (item)
    {
        item = this.getItem(item);

        if (item && item.index) {
            var i;

            playlist.splice(item.index, 1);

            for (i in playlist_ids[item.id])
                if (playlist_ids[item.id][i] == item) {
                    playlist_ids[item.id].splice(i, 1);

                    if (playlist_ids[item.id].length == 0)
                        delete playlist_ids[item.id];

                    break;
                }

            for (i = item.index; i < playlist.length; i++)
                playlist[i].index = i;

            item.prev_index = item.index;
            item.index = null;

            return item;
        }
        else
            return null;
    };

    this.getItem = function (item)
    {
        if (item == undefined)
            return now_playing;
        else if (typeof item == 'object') {
            if (item.index != null && playlist_ids[item.id]) {
                if (playlist[item.index] && playlist[item.index].id == item.id)
                    return playlist[item.index];
                else {
                    var closest_index = null;

                    for (var i in playlist_ids[item.id])
                        if (closest_index == null || Math.abs(playlist_ids[item.id][i].index - item.index) < Math.abs(closest_index - item.index))
                            closest_index = playlist_ids[item.id][i].index;

                    return playlist[closest_index];
                }
            }
            else if (item.index != null)
                return playlist[item.index];
            else if (playlist_ids[item.id])
                return playlist_ids[item.id][0];
            else
                return undefined;
        }
        else
            return playlist[item];
    };

    this.__defineGetter__('nowPlaying', function () { return now_playing; });

    this.play = function (item)
    {
        var new_now_playing = this.getItem(item);

        if (new_now_playing == now_playing)
            return now_playing;
        else if (new_now_playing) {
            if (now_playing) {
                delete now_playing.currentTime;
                delete now_playing.ended;
            }

            now_playing = new_now_playing;

            this.dispatchEvent({type: AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED,
                                nowPlaying: now_playing});

            return now_playing;
        }
        else
            return null;
    };
};

AudioPlayer.Player.PLAYORDER_NORMAL  = 'normal';
AudioPlayer.Player.PLAYORDER_SHUFFLE = 'shuffle';

AudioPlayer.Player.REPEAT_NONE     = 'none';
AudioPlayer.Player.REPEAT_PLAYLIST = 'playlist';
AudioPlayer.Player.REPEAT_TRACK    = 'track';

AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED = 'now-playing-changed';
AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED    = 'playlist-updated';
AudioPlayer.Player.EVENT_PLAYORDER_CHANGED     = 'playorder-changed';
AudioPlayer.Player.EVENT_REPEAT_MODE_CHANGED   = 'repeat-mode-changed';

