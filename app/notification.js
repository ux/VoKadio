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

var bp = chrome.extension.getBackgroundPage(),
    elc = new bp.EventsListenersCollector(window);


function updateAudioMeta()
{
    var record = bp.player.history.nowPlaying;

    if (record) {
        var artist = record.artist, track = record.title;

        $('#track-info .title').text(track);
        $('#artist').text(artist);

        $('#album').remove();
        $('#album-art img').attr('src', '/images/album-art.png');

        bp.helper.lastfm.getAlbumInfo(artist, track, function(rid, title, cover) {
            var current_track = bp.player.history.nowPlaying;

            if (current_track && rid == bp.helper.lastfm.getTrackId(current_track.artist, current_track.title)) {
                if (cover && cover.medium)
                    $('#album-art img').attr('src', cover.medium);

                if (title) {
                    if ($('#album').length == 0)
                        $('#metadata').append($('<li id="album"></li>'));

                    $('#album').text(title);
                }
            }
        });
    }
}


var close_countdown = null;

function startCloseCountdown(timeout)
{
    timeout = timeout || 333;
    close_countdown = setTimeout(function () { if (window) window.close(); }, timeout);
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


function updatePlayStatus()
{
    if (bp.player.audio.paused)
        $('#buttons .play').removeClass('pause');
    else
        $('#buttons .play').addClass('pause');
}


var mouse_in_window = false;
var show_always_notification = bp.options.get('notification.show-behavior') == 'show-always';


if ( ! show_always_notification) {
    $('body').mouseover(function () {
        mouse_in_window = true;
        cancelCloseCountdown();
    });

    $('body').mouseout(function () {
        mouse_in_window = false;
        restartCloseCountdown(bp.NOTIFICATION_TIMEOUT_SECOND);
    });

    $(document).ready(function () { startCloseCountdown(bp.NOTIFICATION_TIMEOUT); });
}


if (bp.player.history.nowPlaying)
    updateAudioMeta();
else
    window.close();


elc.add(bp.player.history, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
    if ( ! mouse_in_window && ! show_always_notification)
        restartCloseCountdown(bp.NOTIFICATION_TIMEOUT);

    updateAudioMeta();
});

elc.add(bp.player.audio, 'play', updatePlayStatus);
elc.add(bp.player.audio, 'pause', updatePlayStatus);

updatePlayStatus();

