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
                if (arguments[object_index].hasOwnProperty(key) && arguments[object_index][key] !== undefined)
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
    audio.preload  = 'auto';
    audio.autoplay = true;
    audio.loop     = false;

    var playlists = {}, current_playlist = null, history_playlists = {};

    var history = new AudioPlayer.Playlist('history');

    audio.addEventListener('canplay', function (event) {
        if (history.nowPlaying && history.nowPlaying.original && history.nowPlaying.original.item && history.nowPlaying.original.item.currentTime) {
            this.currentTime = history.nowPlaying.original.item.currentTime;
            delete history.nowPlaying.original.item.currentTime;
        }

        this.play();
    });

    audio.addEventListener('ended', function (event) {
        if (repeat_mode == AudioPlayer.Player.REPEAT_TRACK)
            setTimeout(function () { self.playFromHistory(history.nowPlaying); }, 0);
        else if (current_playlist && ! (repeat_mode == AudioPlayer.Player.REPEAT_NONE && playorder == AudioPlayer.Player.PLAYORDER_NORMAL && history_current_index() >= history.items.length - 1 && current_playlist.nowPlaying && (current_playlist.nowPlaying.index == null ? current_playlist.nowPlaying.prev_index : current_playlist.nowPlaying.index) >= current_playlist.items.length - 1))
            setTimeout(function () { self.next(); }, 0);
    });

    history.addEventListener(AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED, function (event) {
        var i, playlist_id, items = event.items;

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

        for (i in items)
            if (items[i].original) {
                var item = items[i];
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
    this.__defineSetter__('currentPlaylist', function (playlist) {
        if (playlist = this.getPlaylist(playlist))
            current_playlist = playlist;
    });

    this.__defineGetter__('history', function () { return history; });

    this.addToHistory = function (item, playlist, index)
    {
        playlist = this.getPlaylist(playlist);
        item = playlist.getItem(item);

        if (item) {
            var original = {playlist: playlist, _item: item};
            original.__defineGetter__('item', history_original_item_getter);

            var history_item = history.addToPlaylist(AudioPlayer.Utils.cloneFrom(item, {original: original}), index);

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

        if (item && item.original) {
            var playlist_id = item.original.playlist.id;

            for (var i in history_playlists[playlist_id])
                if (history_playlists[playlist_id][i] == item) {
                    history_playlists[playlist_id].splice(i, 1);

                    if (history_playlists[playlist_id].length == 0)
                        delete history_playlists[playlist_id];

                    break;
                }
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

            if (item && item.ended) {
                current_playlist = playlist;
                return this.next(playlist);
            }
            else if (item === undefined)
                return null;
            else if (history.nowPlaying && history.nowPlaying.original && playlist == history.nowPlaying.original.playlist && item == playlist.nowPlaying) {
                if (audio.ended)
                    return this.next(playlist);
                else {
                    audio.paused ? audio.play() : audio.pause();
                    return history.nowPlaying;
                }
            }
            else {
                var time = item.currentTime, ended = item.ended;

                var now_playing = this.play(item, playlist, false);

                if (now_playing) {
                    (time > 0) && (now_playing.original.item.currentTime = time);
                    (ended)    && (now_playing.original.item.ended = true);
                }

                return now_playing;
            }
        }
    };

    this.playRandom = function (playlist, previous)
    {
        playlist = this.getPlaylist(playlist);

        var history_min_index = history.items.length - Math.min(Math.round(2 / 3 * playlist.items.length), history.items.length, 33);

        while (true) {
            var found = false,
                item = playlist.getItem({index: Math.floor(Math.random() * playlist.items.length)});

            for (var i = history.items.length - 1; i > history_min_index; i--) {
                if (history.items[i].id == item.id) {
                    found = true;
                    break;
                }
            }

            if (!found)
                return this.play(item, playlist, previous);
        }
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

    this.togglePlayFromHistory = function(item)
    {
        item = history.getItem(item);

        if (item == null)
            return this.next();
        else if (item == history.nowPlaying) {
            if (audio.ended)
                return this.next();
            else {
                audio.paused ? audio.play() : audio.pause();
                return history.nowPlaying;
            }
        }
        else
            return this.playFromHistory(item);
    };

    this.playFromHistory = function (item)
    {
        if ((audio.ended || audio.currentTime) && history.nowPlaying && history.nowPlaying.original) {
            var now_played_item = history.nowPlaying.original.item;

            if (now_played_item) {
                if (audio.ended)
                    now_played_item.ended = true;
                else
                    now_played_item.currentTime = audio.currentTime;
            }
        }

        var now_playing = history.play(item);

        if (now_playing) {
            if (now_playing.original && now_playing.original.item)
                now_playing.original.playlist.play(now_playing.original.item);

            audio.src = now_playing.url;
            audio.load();
        }

        return now_playing;
    };

    this.previous = function (playlist)
    {
        if (audio.currentTime > 7) {
            audio.pause();
            audio.currentTime = 0;
            audio.play();

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
                           this.play(playlist.items.length - 1, playlist, true);
            }
            else
                return this.playFromHistory(index);
        }
    };

    this.next = function (playlist)
    {
        playlist = this.getPlaylist(playlist);

        var index = history_current_index(true) + 1;

        if (index > history.items.length - 1) {
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
        return history.nowPlaying ? (history.nowPlaying.index == null ? history.nowPlaying.prev_index - (for_next_calculation ? 1 : 0) : history.nowPlaying.index) : -1;
    }

    function history_original_item_getter()
    {
        var item = this.playlist.getItem(this._item);

        if (item)
            this._item = item;

        return item;
    }
};

AudioPlayer.Playlist = function (id)
{
    EventDispatcher.call(this);

    var items = [], items_ids = {}, now_playing = null;

    this.__defineGetter__('id', function () { return id; });

    this.__defineGetter__('items', function () { return items; });
    this.__defineSetter__('items', function (new_items) {
        items = [];
        items_ids = {};

        for (var i in new_items)
            this.addToPlaylist(new_items[i]);

        if (now_playing) {
            var time = now_playing.currentTime, ended = now_playing.ended;

            var new_now_playing = this.getItem(now_playing);

            if (new_now_playing)
                now_playing = new_now_playing;
            else {
                now_playing.prev_index = now_playing.index;
                now_playing.index = null;
            }

            (time > 0) && (now_playing.currentTime = time);
            (ended)    && (now_playing.ended = true);
        }

        this.dispatchEvent({type: AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED,
                            items: items, nowPlaying: now_playing});
    });

    this.addToPlaylist = function (item, index)
    {
        index = index == null ? items.length : index;
        if (index < 0)
            index = 0;

        item.index = index;

        items.splice(index, 0, item);

        items_ids[item.id] = items_ids[item.id] || [];
        items_ids[item.id].push(item);

        for (var i = item.index + 1; i < items.length; i++)
            items[i].index = i;

        return item;
    };

    this.removeFromPlaylist = function (item)
    {
        item = this.getItem(item);

        if (item && item.index != null) {
            var i;

            items.splice(item.index, 1);

            for (i in items_ids[item.id])
                if (items_ids[item.id][i] == item) {
                    items_ids[item.id].splice(i, 1);

                    if (items_ids[item.id].length == 0)
                        delete items_ids[item.id];

                    break;
                }

            for (i = item.index; i < items.length; i++)
                items[i].index = i;

            item.prev_index = item.index;
            item.index = null;

            return item;
        }
        else
            return null;
    };

    this.updateItem = function(old_item, new_original_item)
    {
        if ( ! (old_item = this.getItem(old_item)))
            return null;

        var i, new_items = [];

        for (i in items_ids[old_item.id]) {
            var item = items_ids[old_item.id][i];

            var new_item = AudioPlayer.Utils.cloneFrom(new_original_item, {
                index: item.index,
                currentTime: item.currentTime,
                ended: item.ended
            });

            new_items.push(new_item);
            items[new_item.index] = new_item;

            item.prev_index = item.index;
            item.index = null;

            if (item == now_playing)
                now_playing = new_item;
        }

        delete items_ids[old_item.id];
        items_ids[new_original_item.id] = new_items;

        return old_item;
    };

    this.getItem = function (item)
    {
        if (item == undefined)
            return now_playing;
        else if (typeof item == 'object') {
            if (item.index != undefined && item.id != undefined) {
                if (items_ids[item.id] == undefined)
                    return undefined;
                if (items[item.index] && items[item.index].id == item.id)
                    return items[item.index];
                else {
                    var closest_index = null;

                    for (var i in items_ids[item.id])
                        if (closest_index == null || Math.abs(items_ids[item.id][i].index - item.index) < Math.abs(closest_index - item.index))
                            closest_index = items_ids[item.id][i].index;

                    return items[closest_index];
                }
            }
            else if (items_ids[item.id])
                return items_ids[item.id][0];
            else if (item.index != undefined)
                return items[item.index];
            else
                return undefined;
        }
        else
            return items[item];
    };

    this.__defineGetter__('nowPlaying', function () { return now_playing; });

    this.play = function (item)
    {
        var new_now_playing = this.getItem(item);

        if (new_now_playing) {
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
