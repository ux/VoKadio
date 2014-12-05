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

    this.common = {
        secondsToTime: function (microtime) {
            if (isNaN(microtime))
                return '0:00';
            else {
                var seconds = parseInt(microtime % 60);
                return parseInt(microtime / 60) + ':' + (seconds < 10 ? '0' : '') + seconds;
            }
        },

        getDownloadName: function (track) {
            return track.artist + ' - ' + track.title; /* + track.url.replace(/^.+\/.+?\./, '.');*/
        }
    };

    this.lastfm = {
        scrobbler: new (function () {
            var now_playing = null, self = this;

            this.autocorrect = true;

            this.start = function (track)
            {
                now_playing = jQuery.extend({}, track);
                now_playing.started_at = new Date();
                now_playing.play_duration = 0;
            };

            var now_playing_timeout;

            this.play = function (lastfm_session)
            {
                now_playing.continued_at = new Date();

                if (lastfm_session) {
                    clearTimeout(now_playing_timeout);
                    now_playing_timeout = setTimeout(function () {
                        track_to_params(now_playing, function (params) {
                            lastfm.track.updateNowPlaying(params, lastfm_session);
                        });
                    }, 3000);
                }
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
                    var track = now_playing;

                    this.pause();

                    if (track.duration > 30 && (track.play_duration >= track.duration / 2 || track.play_duration >= 4 * 60))
                        track_to_params(track, function (params) {
                            lastfm.track.scrobble(jQuery.extend(params, {timestamp: parseInt(track.started_at.getTime() / 1000)}), lastfm_session);
                        });
                }

                now_playing = null;
            };

            function track_to_params(track, callback)
            {
                var params = {track: track.title, artist: track.artist, duration: track.duration};

                lastfm.track.getInfo({artist: params.artist, track: params.track, autocorrect: self.autocorrect ? '1' : '0'}, {
                    success: function (response) {
                        var track = response.track, album = track.album;

                        if (track.mbid)
                            params.mbid = track.mbid;

                        if (album) {
                            params.album = album.title;
                            params.trackNumber = album['@attr'].position;
                        }

                        callback(params);
                    },

                    error: function () { callback(params); }
                });
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
