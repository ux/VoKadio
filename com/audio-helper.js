/*
 * This file is part of VoKadio extension for Google Chrome browser
 * 
 * Copyright (c) 2007 - 2010 InfoStyle Company (http://infostyle.com.ua/)
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
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function AudioHelper(vk_query, lastfm, audio_player)
{
    session = vk_query.session();
    var this_obj = this;
    
    session.addEventListener(VkSession.EVENT_SESSION_UPDATED, function () {
        this_obj.updateUserAudio();
    });
    
    this.makeVkRequest = function (method_name, method_params, callback)
    {
        try {
            var xml_http_request = vk_query.doRequest(method_name, method_params, callback);
        }
        catch (err) {
            return false;
        }
        
        return xml_http_request;
    };
    
    this.updateUserAudio = function ()
    {
        return this.makeVkRequest('audio.get', {}, function (audio_records) {
            audio_player.playlist(audio_records);
        });
    };
    
    this.lastfmImagesToObject = function (images)
    {
        if ( images ) {
            if ( ! images instanceof Array )
                images = [images];
            
            var imgs_obj = {};
            var imgs_obj_not_empty = false;
            for ( var i in images ) {
                if ( images[i]['#text'] ) {
                    imgs_obj[images[i].size] = images[i]['#text'];
                    imgs_obj_not_empty = true;
                }
            }
            
            return imgs_obj_not_empty ? imgs_obj : null;
        }
        else
            return null;
    };
    
    this.getTrackInfoRequestId = function (artist, track)
    {
        return md5(artist) + md5(track);
    };
    
    this.getTrackInfoAsync = function (artist, track, set_track_partial_meta)
    {
        var request_id = this.getTrackInfoRequestId(artist, track);
        
        set_track_partial_meta({ artist: artist, track: track }, request_id);
        
        var this_obj = this;
        
        lastfm.track.search({ artist: artist, track: track, limit: 1 }, {
            success: function (data) {
                var track = data.results.trackmatches.track;
                
                if ( track ) {
                    set_track_partial_meta({ artist: track.artist, track: track.name }, request_id);
                    
                    var cover = this_obj.lastfmImagesToObject(track.image);
                    if ( cover ) {
                        set_track_partial_meta({ cover: cover }, request_id);
                    }
                    else {
                        lastfm.artist.getInfo({ artist: track.artist }, {
                            success: function (data) {
                                if ( typeof data.artist != 'undefined' ) {
                                    var cover = this_obj.lastfmImagesToObject(data.artist.image);
                                    if ( cover ) {
                                        set_track_partial_meta({ cover: cover }, request_id);
                                    }
                                }
                            }
                        });
                    }
                    
                    lastfm.track.getInfo({ artist: track.artist, track: track.name }, {
                        success: function (data) {
                            if ( typeof data.track != 'undefined' ) {
                                var album = data.track.album;
                                if ( typeof album != 'undefined' ) {
                                    set_track_partial_meta({ album: album.title }, request_id);
                                }
                            }
                        }
                    });
                }
            }
        });
    };
    
    this.getTrackInfoSync = function (artist, track, set_track_meta)
    {
        var this_obj = this;
        
        var request_id = this.getTrackInfoRequestId(artist, track);
        
        var result = { artist: artist, track: track };
        
        lastfm.track.search({ artist: artist, track: track, limit: 1 }, {
            success: function (data) {
                var track = data.results.trackmatches.track;
                
                if ( track ) {
                    result.artist = track.artist;
                    result.track  = track.name;
                    
                    var cover = this_obj.lastfmImagesToObject(track.image);
                    if ( cover )
                        result.cover = cover;
                    
                    lastfm.track.getInfo({ artist: track.artist, track: track.name }, {
                        success: function (data) {
                            if ( typeof data.track != 'undefined') {
                                var album = data.track.album;
                                
                                if ( typeof album != 'undefined' )
                                    result.album = album.title;
                                
                                if ( result.cover )
                                    set_track_meta(result, request_id);
                                else {
                                    lastfm.artist.getInfo({ artist: result.artist }, {
                                        success: function (data) {
                                            if ( typeof data.artist != 'undefined' ) {
                                                var cover = this_obj.lastfmImagesToObject(data.artist.image);
                                                if ( cover )
                                                    result.cover = cover;
                                                
                                                set_track_meta(result, request_id);
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
                
                else
                    set_track_meta(result, request_id);
            },
            
            error: function () {
                set_track_meta(result, request_id);
            }
        });
    };
    
    this.getTrackInfo = function (artist, track, set_track_meta, async)
    {
        async = typeof async == 'undefined' ? true : async;
        
        if ( async )
            return this.getTrackInfoAsync(artist, track, set_track_meta);
        else
            return this.getTrackInfoSync(artist, track, set_track_meta);
    };
}
