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

function PlayerHelper(lastfm, vk_query)
{
    var self = this;

    this.lastfm = {
        scrobbler: new (function () {
            var now_playing = null;

            this.start = function (track)
            {
                now_playing = jQuery.extend({}, track);
                now_playing.started_at = new Date();
                now_playing.play_duration = 0;
            };

            this.play = function (lastfm_session)
            {
                now_playing.continued_at = new Date();

                if (lastfm_session)
                    lastfm.track.updateNowPlaying(track_to_params(now_playing), lastfm_session);
            };

            this.pause = function ()
            {
                if (now_playing.continued_at) {
                    now_playing.play_duration += calc_duration(now_playing.continued_at);
                    now_playing.continued_at = undefined;
                }
            };

            this.stop = function (lastfm_session)
            {
                if (now_playing && lastfm_session) {
                    this.pause();

                    if (now_playing.duration > 30 && (now_playing.play_duration >= now_playing.duration / 2 || now_playing.play_duration >= 4 * 60))
                        lastfm.track.scrobble(jQuery.extend(track_to_params(now_playing), {timestamp: parseInt(now_playing.started_at.getTime() / 1000)}), lastfm_session);
                }

                now_playing = null;
            };

            function track_to_params(track)
            {
                return {track: track.title, artist: track.artist, duration: track.duration};
            }

            function calc_duration(start_date)
            {
                return parseInt((new Date() - start_date) / 1000);
            }
        })(),

        extractLargestImage: function (image) {
            if (image instanceof Array)
                return image[image.length - 1]['#text'];
            else if (image['#text'])
                return image['#text'];
            else if (image)
                return image;
            else
                return null;
        },

        extractImages: function (images) {
            var images_object = {};

            if (images)
                for (var i in (images = (images instanceof Array) ? images : [images]))
                    images_object[images[i].size] = images[i]['#text'];

            return images_object;
        },

        getArtistInfo: function (artist, callback) {
            lastfm.artist.getInfo({artist: artist, autocorrect: '1'}, {
                success: function (response) {
                    callback(response.artist.name,
                             self.lastfm.extractImages(response.artist.image),
                             self.lastfm.extractLargestImage(response.artist.image),
                             artist);
                },

                error: function () { callback(artist, null, null, artist); }
            });
        },

        getTrackInfo: function (track, artist, callback) {
            var track_hash = track + artist;

            lastfm.track.getInfo({artist: artist, track: track, autocorrect: '1'}, {
                success: function (response) {
                    var track_info = response.track, album_info = track_info.album,
                        track = track_info.name, artist = track_info.artist.name;

                    if (album_info) {
                        var album = album_info.title;

                        if (album_info.image)
                            callback(track, artist, album,
                                     self.lastfm.extractImages(album_info.image),
                                     self.lastfm.extractLargestImage(album_info.image),
                                     track_hash);
                        else
                            self.lastfm.getArtistInfo(artist, function (artist, images, largest_image) {
                                callback(track, artist, album, images, largest_image, track_hash);
                            });
                    }
                    else
                        self.lastfm.getArtistInfo(artist, function (artist, images, largest_image) {
                            callback(track, artist, null, images, largest_image, track_hash);
                        });
                },

                error: function () {
                    self.lastfm.getArtistInfo(artist, function (artist, images, largest_image) {
                        callback(track, artist, null, images, largest_image, track_hash);
                    });
                }
            });
        }
    };

    this.vk = {
        isOwerOf: function (track_item) {
            return track_item.owner_id == vk_query.session.data.user_id;
        },

        callAudioItemMethod: function (method, item, callback) {
            callback = callback || function () {};

            vk_query.call('audio.' + method, {aid: item.aid, oid: item.owner_id}, {
                success: function (result) { callback(true, result); },
                error: function (error) { callback(false, error); }
            });
        },

        addAudio: function (item, callback) {
            if (self.vk.isOwerOf(item))
                callback && callback(false);
            else
                self.vk.callAudioItemMethod('add', item, callback);
        },

        deleteAudio: function (item, callback) {
            if (self.vk.isOwerOf(item))
                self.vk.callAudioItemMethod('delete', item, callback);
            else
                callback && callback(false);
        },

        restoreAudio: function (item, callback) {
            if (self.vk.isOwerOf(item))
                self.vk.callAudioItemMethod('restore', item, callback);
            else
                callback && callback(false);
        }
    };
}

