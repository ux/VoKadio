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

function AudioHelper(vk_query, lastfm, audio_player)
{
    session = vk_query.session();
    var that = this;

    session.addEventListener(VkSession.EVENT_SESSION_UPDATED, function () {
        that.updateUserAudio();
    });

    this.makeVkRequest = function (method_name, method_params, callback)
    {
        try {
            return vk_query.doRequest(method_name, method_params, callback);
        }
        catch (err) {
            return false;
        }
    };

    this.updateUserAudio = function ()
    {
        return this.makeVkRequest('audio.get', {}, function (audio_records) {
            audio_player.playlist(audio_records);
        });
    };

    this.lastfmImagesToObject = function (images)
    {
        if (images) {
            if ( ! images instanceof Array)
                images = [images];

            var imgs_obj = {};
            var imgs_obj_not_empty = false;
            for (var i in images) {
                if (images[i]['#text']) {
                    imgs_obj[images[i].size] = images[i]['#text'];
                    imgs_obj_not_empty = true;
                }
            }

            return imgs_obj_not_empty ? imgs_obj : undefined;
        }
        else
            return undefined;
    };

    this.getTrackInfoRequestId = function (artist, track)
    {
        return artist + track;
    };

    this.getArtistImages = function (artist, set_artist_photo)
    {
        lastfm.artist.getInfo({artist: artist, autocorrect: '1'}, {
            success: function (data) {
                set_artist_photo(that.lastfmImagesToObject(data.artist.image)); },

            error: function () {
                set_artist_photo(undefined); }
        });
    }

    this.getAlbumInfo = function (artist, track, set_album_info)
    {
        var request_id = this.getTrackInfoRequestId(artist, track);

        var that = this;

        lastfm.track.getInfo({artist: artist, track: track, autocorrect: '1'}, {
            success: function (data) {
                var album = data.track.album;

                if (album) {
                    var cover = that.lastfmImagesToObject(album.image);

                    if (cover)
                        set_album_info(request_id, album.title, cover);
                    else
                        that.getArtistImages(artist, function (photo) {
                            set_album_info(request_id, album.title, photo); });
                }
                else
                    that.getArtistImages(artist, function (photo) {
                        set_album_info(request_id, undefined, photo); });
            },

            error: function () {
                that.getArtistImages(artist, function (photo) {
                    set_album_info(request_id, undefined, photo); });
            }
        });
    };
}

