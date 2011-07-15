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

function PlayerHelper(lastfm)
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

        imagesToObject: function (images) {
            if (images) {
                if ( ! (images instanceof Array))
                    images = [images];

                var imgs_obj = {};
                var imgs_obj_not_empty = false;
                for (var i in images) {
                    if (images[i]['#text']) {
                        imgs_obj[images[i].size] = images[i]['#text'];
                        imgs_obj_not_empty = true;
                    }
                }

                return imgs_obj_not_empty ? imgs_obj : null;
            }
            else
                return null;
        },

        getTrackId: function (artist, track) {
            return artist + track;
        },

        getArtistImages: function (artist, set_artist_photo) {
            lastfm.artist.getInfo({artist: artist, autocorrect: '1'}, {
                success: function (data) {
                    set_artist_photo(self.lastfm.imagesToObject(data.artist.image));
                },

                error: function () { set_artist_photo(undefined); }
            });
        },

        getAlbumInfo: function (artist, track, set_album_info) {
            var track_id = self.lastfm.getTrackId(artist, track);

            lastfm.track.getInfo({artist: artist, track: track, autocorrect: '1'}, {
                success: function (data) {
                    var album = data.track.album;

                    if (album) {
                        var cover = self.lastfm.imagesToObject(album.image);

                        if (cover)
                            set_album_info(track_id, album.title, cover);
                        else
                            self.lastfm.getArtistImages(artist, function (photo) {
                                set_album_info(track_id, album.title, photo);
                            });
                    }
                    else
                        self.lastfm.getArtistImages(artist, function (photo) {
                            set_album_info(track_id, undefined, photo);
                        });
                },

                error: function () {
                    self.lastfm.getArtistImages(artist, function (photo) {
                        set_album_info(track_id, undefined, photo);
                    });
                }
            });
        }
    };

    this.vk = {
        tracksForPlaylist: function (records) {
            records = jQuery.isEmptyObject(records) ? [] : records;

            for (var i in records) {
                var track = records[i];

                track.id     = track.aid;
                track.artist = decodeHtml(track.artist);
                track.title  = decodeHtml(track.title);
            }

            return records;
        }
    };
}

