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

var bp = chrome.extension.getBackgroundPage();

var AudioPlayer   = bp.AudioPlayer;
var audio_player  = bp.audio_player;
var vk_session    = bp.vk_session;
var audio_helper  = bp.audio_helper;
var options       = bp.options;

var elc = new EventsListenersCollector();

var unload_client = new UnloadManagerClient(bp.unload_server);
unload_client.addHandler(elc.unloadAllListeners);


function updateAudioMeta(index, record)
{
    if (index >= 0 && record) {
        $('#buttons .next').html(audio_player.playlist()[audio_player.nextIndex()].title);
        
        var artist = decodeHtml(record.artist), track = decodeHtml(record.title);
        
        $('#track-info .title').text(track);
        $('#artist').text(artist);
        
        $('#album').remove();
        $('#album-art img').attr('src', 'images/album-art.png');
        
        audio_helper.geAlbumInfo(artist, track, function(rid, title, cover) {
            var current_track = audio_player.playlist()[audio_player.currentIndex()];
            
            if (rid != audio_helper.getTrackInfoRequestId(decodeHtml(current_track.artist), decodeHtml(current_track.title)))
                return;
            
            if (cover && cover.medium)
                $('#album-art img').attr('src', cover.medium);
            
            if (title) {
                if ($('#album').length == 0) 
                    $('#metadata').append($('<li id="album"></li>'));
                
                $('#album').text(title);
            }
        });
    }
}


var close_countdown = null;

function startCloseCountdown(timeout)
{
    timeout = timeout || 333;
    close_countdown = setTimeout(function () {
        if (window) window.close();
    }, timeout);
}

function cancelCloseCountdown()
{
    clearTimeout(close_countdown);
}

function restartCloseCountdown(timeout)
{
    cancelCloseCountdown();
    
    if (window)
        startCloseCountdown(timeout);
}


var mouse_in_window = false;
var show_always_notification = options.get('notification.show-behavior') == 'show-always';


if ( ! show_always_notification) {
    $('body').mouseover(function () {
        mouse_in_window = true;
        cancelCloseCountdown();
    });

    $('body').mouseout(function () {
        mouse_in_window = false;
        restartCloseCountdown(NOTIFICATION_TIMEOUT_SECOND);
    });

    $(document).ready(function () { startCloseCountdown(NOTIFICATION_TIMEOUT); });
}


var playlist = audio_player.playlist();
var currentIndex = audio_player.currentIndex();

if (vk_session.hasSession() || playlist.length > 0 && currentIndex >= 0)
    updateAudioMeta(currentIndex, playlist[currentIndex]);
else
    window.close();


elc.add(audio_player, AudioPlayer.EVENT_INDEX_CHANGED, function (event) {
    if ( ! mouse_in_window && ! show_always_notification)
        restartCloseCountdown(NOTIFICATION_TIMEOUT);
    
    updateAudioMeta(event.index, event.index >= 0 ? this.playlist()[event.index] : null);
});

