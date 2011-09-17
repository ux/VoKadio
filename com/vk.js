/*
 * Implementation of dynamic list
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

var VK = {};

VK.Utils = {
    decodeHTML: function (html) {
        VK.Utils._decodeHTML_div.innerHTML = html;
        return VK.Utils._decodeHTML_div.innerText;
    },

    _decodeHTML_div: document.createElement('div')
};

VK.Audio = function (owner_id, player, query)
{
    var all_audio, self = this, albums = {}, current_album = null, albums_count = 1;

    all_audio = new VK.Audio.Album(null, owner_id, 0, "Все аудиозаписи", player, query);

    query.session.addEventListener(VkAPI.Session.EVENT_SESSION_RECEIVED, update_all_audio);

    this.__defineGetter__('ownerId', function () { return owner_id; });

    this.__defineGetter__('currentAlbum', function () {
        return current_album == null ? all_audio : current_album;
    });

    this.__defineSetter__('currentAlbum', function (album) {
        if (album = this.getAlbum(album))
            current_album = album.id == null ? null : album;
    });

    this.getAlbum = function (album)
    {
        if (album == null)
            return current_album;
        else if (typeof album == 'object') {
            if (album.id == null)
                return all_audio;
            else if (album.id in albums)
                return albums[album.id];
            else
                return undefined;
        }
        else
            return albums[album];
    };

    this.fetchAlbums = function (callback, use_cache)
    {
        if (use_cache == undefined || use_cache)
            callback.call(this, albums_list_for_outside());

        var params = {count: 100};
        (owner_id != null) && (params.uid = owner_id);

        query.call('audio.getAlbums', params, function (albums_list) {
            var i, album, new_albums = {}, albums_count = 1;

            for (i in (albums_list = albums_list.slice(1))) {
                var album_obj = albums_list[i];

                album_obj.title = VK.Utils.decodeHTML(album_obj.title);

                if (album = self.getAlbum(album_obj.album_id)) {
                    album.title = album_obj.title;
                    album.index = albums_count;
                    delete albums[album.id];
                }
                else
                    album = new VK.Audio.Album(album_obj.album_id, owner_id, albums_count, album_obj.title, player, query);

                new_albums[album.id] = album;
                albums_count++;
            }

            for (i in albums) {
                album = albums[i];

                if (album == current_album)
                    current_album = null;

                if (album.playlistLoaded() && album.playlist == player.currentPlaylist)
                    player.currentPlaylist = all_audio.fetchPlaylist();

                album.unload();
            }

            albums = new_albums;

            callback.call(self, albums_list_for_outside());
        });
    };

    this.unload = function ()
    {
        query.session.removeEventListener(VkAPI.Session.EVENT_SESSION_RECEIVED, update_all_audio);

        var all_albums = jQuery.extend({null: all_audio}, albums);

        current_album = null, albums = {};

        for (var i in all_albums)
            all_albums[i].unload();
    };

    function update_all_audio() {
        self.fetchAlbums(function (albums) {
            for (var i in albums) {
                var album = albums[i];

                if (album.playlistLoaded() && (album == this.currentAlbum || album.playlist.nowPlaying || album.playlist == player.currentPlaylist))
                    album.fetchPlaylist();
                else
                    album.unload();
            }
        }, false);
    }

    function albums_list_for_outside()
    {
        var list = [all_audio];

        for (var i in albums)
            if (albums.hasOwnProperty(i))
                list[albums[i].index] = albums[i];

        return list;
    }
};


VK.Audio.Album = function (id, owner_id, index, title, player, query)
{
    var playlist;

    this.title = title;
    this.index = index;

    this.__defineGetter__('id', function () { return id; });
    this.__defineGetter__('ownerId', function () { return owner_id; });
    this.__defineGetter__('playlist', function () { return get_playlist(); });

    this.playlistLoaded = function ()
    {
        return !!playlist;
    };

    this.fetchPlaylist = function ()
    {
        get_playlist();

        var params = {count: 16000};
        (owner_id != null) && (params.uid = owner_id);
        (id != null)       && (params.album_id = id);

        query.call('audio.get', params, function (records) {
            if (playlist)
                playlist.items = VK.Audio.Utils.recordsForPlaylist(records);
        });

        return playlist;
    };

    this.unload = function ()
    {
        if (playlist) {
            playlist.items = [];
            player.removePlaylist(playlist);
            playlist = undefined;
        }
    };

    function get_playlist()
    {
        if ( ! playlist) {
            var playlist_id = (owner_id == null ? 'owner' : owner_id) + '_' + (id == null ? 'all' : id);

            playlist = new AudioPlayer.Playlist(playlist_id);
            player.addPlaylist(playlist);
        }

        return playlist;
    }
};


VK.Audio.Search = function (player, vk_query) {
    var self = this,
        query = '',
        playlist = new AudioPlayer.Playlist('search');

    player.addPlaylist(playlist);

    vk_query.session.addEventListener(VkAPI.Session.EVENT_SESSION_RECEIVED, function () { self.search(); });

    this.__defineGetter__('query', function () { return query; });
    this.__defineGetter__('playlist', function () { return playlist; });

    this.search = function (search_query)
    {
        query = search_query = search_query == undefined ? query : search_query;

        if (search_query)
            vk_query.call('audio.search', {q: search_query, auto_complete: 1, sort: 2, count: 500}, function (records) {
                if (search_query == query)
                    playlist.items = VK.Audio.Utils.recordsForPlaylist(records.slice(1));
            });
        else
            playlist.items = [];

        return playlist;
    };
};


VK.Audio.Utils = {
    recordsForPlaylist: function (records) {
        records = jQuery.isEmptyObject(records) ? [] : records;

        for (var i in records) {
            var record = records[i];

            record.id     = record.aid;
            record.artist = VK.Utils.decodeHTML(record.artist);
            record.title  = VK.Utils.decodeHTML(record.title);
        }

        return records;
    }
};


VK.Audio.bindHistory = function (player, query)
{
    query.session.addEventListener(VkAPI.Session.EVENT_SESSION_RECEIVED, function () {
        var items = player.history.items;

        if (items.length > 0) {
            var audios = [];
            for (var i in items)
                audios.push(items[i].owner_id + '_' + items[i].aid);

            query.call('audio.getById', {audios: audios.join(',')}, function (records) {
                player.history.items = VK.Audio.Utils.recordsForPlaylist(records);
            });
        }
    });
};

