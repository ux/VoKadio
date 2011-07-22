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

VK.Audio = function (owner_id, player, query, helper)
{
    var all_audio, self = this, albums = {}, current_album = null;

    all_audio = new VK.Audio.Album(null, owner_id, "Все аудиозаписи", player, query, helper);

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
            callback.call(this, jQuery.extend({null: all_audio}, albums));

        var params = {count: 100};
        (owner_id != null) && (params.uid = owner_id);

        query.call('audio.getAlbums', params, function (albums_list) {
            var i, album, new_albums = {};

            for (i in (albums_list = albums_list.slice(1))) {
                var album_obj = albums_list[i];

                if (album = self.getAlbum(album_obj.album_id)) {
                    album.title = album_obj.title;
                    delete albums[album.id];
                }
                else
                    album = new VK.Audio.Album(album_obj.album_id, owner_id, album_obj.title, player, query, helper);

                new_albums[album.id] = album;
            }

            for (i in albums) {
                album = albums[i];

                if (album == current_album)
                    current_album = null;

                if (player.currentPlaylist && album.playlist == player.currentPlaylist)
                    player.currentPlaylist = all_audio.fetchPlaylist();

                album.unload();
            }

            albums = new_albums;

            callback.call(self, jQuery.extend({null: all_audio}, albums));
        });
    };

    this.unload = function ()
    {
        query.session.removeEventListener(VkAPI.Session.EVENT_SESSION_RECEIVED, update_all_audio);

        var all_albums = jQuery.extend({null: all_audio}, albums);

        current_album = null;
        albums = {};

        for (i in all_albums)
            all_albums[i].unload();
    };

    function update_all_audio() {
        self.fetchAlbums(function (albums) {
            for (var i in albums) {
                var album = albums[i];

                if (album == this.currentAlbum || album.playlist && (album.playlist.nowPlaying || album.playlist == player.currentPlaylist))
                    album.fetchPlaylist();
                else
                    album.unload();
            }
        }, false);
    }
};


VK.Audio.Album = function (id, owner_id, title, player, query, helper)
{
    var playlist;

    this.__defineGetter__('id', function () { return id; });
    this.__defineGetter__('ownerId', function () { return owner_id; });
    this.__defineGetter__('title', function () { return title; });
    this.__defineSetter__('title', function (new_title) { title = new_title; });
    this.__defineGetter__('playlist', function () { return playlist; });

    this.createPlaylist = function ()
    {
        if ( ! playlist) {
            var playlist_id = (owner_id == null ? 'owner' : owner_id) + '_' + (id == null ? 'all' : id);

            playlist = new AudioPlayer.Playlist(playlist_id);
            player.addPlaylist(playlist);
        }

        return playlist;
    };

    this.fetchPlaylist = function ()
    {
        this.createPlaylist();

        var params = {count: 16000};
        (owner_id != null) && (params.uid = owner_id);
        (id != null)       && (params.album_id = id);

        query.call('audio.get', params, function (records) {
            playlist.items = helper.vk.tracksForPlaylist(records);
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
};

