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

function registerSliding(event, ui)   { ui.handle.sliding = true;  }
function unregisterSliding(event, ui) { ui.handle.sliding = false; }


//*****************************************************************************


var bp  = chrome.extension.getBackgroundPage();
var elc = new bp.EventsListenersCollector();


//*****************************************************************************


var volume_slider,
    volume_mute,
    volume_slider_range,

    progress_slider,
    progress_info_played,
    progress_info_total,

    toggle_play_button,
    previous_button,
    next_button,
    update_session_button,

    meta_title,
    meta_artist,
    meta_album,
    meta_total,
    meta_cover,

    tracklist,
    tracklist_container,

    player,
    playorder_input,

    quick_search,
    quick_search_input,

    tracklist_mgr;


//*****************************************************************************


function refreshAudioVolume()
{
    if ( ! volume_slider.sliding)
        $(volume_slider).slider('option', 'value', bp.player.audio.volume);
}

function updateVolume(event, ui) { bp.player.audio.volume = ui.value; }

function toggleMute()
{
    bp.player.audio.muted = ! bp.player.audio.muted;

    if (bp.player.audio.muted) {
        $(volume_mute).addClass('on');
        $(volume_slider_range).addClass('unvisible');
    }
    else {
        $(volume_mute).removeClass('on');
        $(volume_slider_range).removeClass('unvisible');
    }
}


//*****************************************************************************


function refreshAudioProgress()
{
    if ( ! progress_slider.sliding) {
        var duration, time;

        if ( bp.player.audio.readyState > 0 ) {
            duration = bp.player.audio.duration;
            time     = bp.player.audio.currentTime;
        }
        else
            time = duration = 0;

        $(progress_slider).slider('option', 'max', duration);
        $(progress_slider).slider('option', 'value', time);

        $(progress_info_played).text(bp.secondsToTime(time));

        if ( duration > 0 )
            $(progress_info_total).text(bp.secondsToTime(duration));
    }
}

function updateProgress(event, ui) { bp.player.audio.currentTime = ui.value; }


//*****************************************************************************


function updatePlayStatus()
{
    if (bp.player.audio.paused)
        $(toggle_play_button).removeClass('pause');
    else
        $(toggle_play_button).addClass('pause');
}


//*****************************************************************************


function updateAudioMeta()
{
    $(meta_title).text(bp.EXTENSION_NAME);
    $(meta_title).attr('title', bp.EXTENSION_NAME);

    $(meta_artist).text('');
    $(meta_album).remove();

    $(meta_cover).attr('src', 'images/album-art.png');

    $(meta_total).attr('title', '');

    $(progress_info_played).text(bp.secondsToTime(0));
    $(progress_info_total).text(bp.secondsToTime(0));

    if (bp.player.history.nowPlaying) {
        var record = bp.player.history.nowPlaying;

        $(progress_info_total).text(bp.secondsToTime(record.duration));

        var artist = record.artist, track = record.title;

        $(meta_title).text(track);
        $(meta_title).attr('title', track);

        $(meta_artist).text(artist);

        $(meta_total).attr('title', artist);
        meta_total.myTitle = artist;

        bp.helper.lastfm.getAlbumInfo(artist, track, function(rid, title, cover) {
            var current_track = bp.player.history.nowPlaying;

            if (current_track && rid == bp.helper.lastfm.getTrackId(current_track.artist, current_track.title)) {
                if (cover && cover.medium)
                    $(meta_cover).attr('src', cover.medium);

                if (title) {
                    if ($(meta_album).length == 0)
                        $(meta_total).append($('<li id="album"></li>'));

                    $(meta_album).text(title);

                    $(meta_total).attr('title', meta_total.myTitle + ' :: ' + title);
                }
            }
        });
    }

    refreshAudioProgress();
}


//*****************************************************************************


var qs_found_index = -1;

function qsSearchRegExp()
{
    var search_str = quick_search_input.value.trim();

    if (search_str != '') {
        var search_words = search_str.split(/\s+/);
        for (var i =0, len = search_words.length; i < len; i++)
            search_words[i] = bp.regExpEscape(search_words[i]);

        return new RegExp(search_words.join('.+'), 'i');
    }
    else
        return undefined;
}

function qsItemMatch(re, item)
{
    return re.test(item.artist + " - " + item.title);
}

function qsSelectFounded(index)
{
    qsResetSearch();
    qs_found_index = index;

    tracklist_mgr.scrollTo(index);
    tracklist_mgr.getItem(index, function () {
        $(this).addClass('found');
    });
}

function qsResetSearch()
{
    qs_found_index = bp.my_audio.currentAlbum.playlist.nowPlaying;
    (qs_found_index == null) && (qs_found_index = -1);

    $(tracklist.children).removeClass('found');
}

function makeQsId()
{
    return (new Date()).getTime() + '_' + Math.round(1000000 * Math.random());
}

var current_qs_id;

function qsFind(order)
{
    var pattern = qsSearchRegExp();

    if (typeof pattern != 'undefined') {
        var my_qs_id = makeQsId();
        current_qs_id = my_qs_id;

        order = order || 1;

        var list = bp.my_audio.currentAlbum.playlist.items, founded = false;

        for (var i = qs_found_index + order, len = list.length; i > -1 && i < len; i += order) {
            if (my_qs_id != current_qs_id)
                return;

            if (qsItemMatch(pattern, list[i])) {
                founded = true;
                break;
            }
        }

        if (founded) {
            qsSelectFounded(i);
            return i;
        }
    }

    return false;
}

function qsFindPrevious()
{
    return qsFind(-1);
}

function qsFindNext()
{
    return qsFind(1);
}


//*****************************************************************************


function assignVariables()
{
    volume_slider         = $('#volume-control .slider')[0];
    volume_mute           = $('#volume-control .mute')[0];

    progress_slider       = $('#progress .slider')[0];
    progress_info_played  = $('#progress .info .played')[0];
    progress_info_total   = $('#progress .info .total')[0];

    toggle_play_button    = $('#buttons .play')[0];
    previous_button       = $('#buttons .previous')[0];
    next_button           = $('#buttons .next')[0];
    update_session_button = $('#buttons .refresh')[0];

    meta_title            = $('#track-info .title')[0];
    meta_artist           = $('#artist')[0];
    meta_album            = '#album';
    meta_total            = $('#metadata')[0];
    meta_cover            = $('#album-art img')[0];

    tracklist             = $('#tracklist')[0];
    tracklist_container   = $('#body')[0];

    player                = $('#player')[0];
    playorder_input       = $('#playorder_input')[0];

    quick_search          = $('#quick-search')[0];
    quick_search_input    = $('#quick-search input')[0];
}


//*****************************************************************************


function initVolumeControl()
{
    volume_slider.sliding = false;

    $(volume_slider).slider({
        orientation : 'horizontal',
        range       : 'min',
        min         : 0,
        max         : 1,
        step        : 0.01,
        value       : 1,
        animate     : true,
        start       : registerSliding,
        stop        : unregisterSliding,
        slide       : updateVolume
    });

    volume_slider_range = $('#volume-control .slider .ui-slider-range')[0];

    $(volume_mute).click(function () { toggleMute(); });

    elc.add(bp.player.audio, 'volumechange', function () { refreshAudioVolume(); });

    refreshAudioVolume();
}

function initProgressControl()
{
    progress_slider.sliding = false;

    $(progress_slider).slider({
        orientation : 'horizontal',
        range       : 'min',
        min         : 0,
        max         : 0,
        step        : 1,
        value       : 0,
        animate     : true,
        start       : registerSliding,
        stop        : unregisterSliding,
        slide       : updateProgress
    });

    elc.add(bp.player.audio, 'timeupdate', function () { refreshAudioProgress(); });

    refreshAudioProgress();
}

function initPlayerControls()
{
    $(toggle_play_button).click(function () { bp.player.togglePlay(); });
    $(previous_button).click(function () { bp.player.previous(); });
    $(next_button).click(function () { bp.player.next(); });

    $(update_session_button).click(function () { bp.vk_session.refresh(); });

    elc.add(bp.player.audio, 'play', updatePlayStatus);
    elc.add(bp.player.audio, 'pause', updatePlayStatus);

    updatePlayStatus();
}

function initAudioMeta()
{
    elc.add(bp.player.history, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, updateAudioMeta);
    updateAudioMeta();
}

function initAudioRecords()
{
    var playlist = bp.my_audio.currentAlbum.fetchPlaylist();

    tracklist_mgr = new bp.DynamicListView(tracklist, function (index) {
        var $this = $(this);
        var record = bp.my_audio.currentAlbum.playlist.items[index];

        this.playlist   = playlist;
        this.trackindex = index;
        this.title      = record.artist + " - " + record.title;

        if (playlist.nowPlaying && index == playlist.nowPlaying.index)
            $this.addClass('now-playing');
        else
            $this.removeClass('now-playing');

        $this.find('.artist')[0].innerText   = record.artist;
        $this.find('.title')[0].innerText    = record.title;
        $this.find('.duration')[0].innerText = bp.secondsToTime(record.duration);
        $this.find('a.download')[0].href     = record.url;
    }, tracklist.children[0]);

    tracklist_mgr.activate();

    tracklist_mgr.itemsCount = playlist.items.length;

    elc.add(playlist, bp.AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED, function (event) {
        tracklist_mgr.itemsCount = event.items.length;
    });

    elc.add(playlist, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
        tracklist_mgr.refresh();
    });

    $(document).ready(function () {
        var now_playing = playlist.nowPlaying;

        if (now_playing)
            tracklist_mgr.scrollTo(now_playing.index == null ? now_playing.prev_index : now_playing.index);
    });
}

function initPlayOrder()
{
    $(playorder_input).change(function () { bp.playorder(bp.player, this.value); });
    $(playorder_input).val(bp.playorder(bp.player));
}

function initQuickSearch()
{
    document.addEventListener('keydown', function (event) {
        if (event.ctrlKey && event.keyCode == 70) { // Ctrl + F
            event.preventDefault();
            event.stopPropagation();

            $(quick_search).removeClass('unvisible');
            quick_search_input.focus();

            qsResetSearch();
        }
    });

    quick_search_input.addEventListener('blur', function () {
        qsResetSearch();
        $(quick_search).addClass('unvisible');
        quick_search_input.value = '';
    });

    quick_search_input.addEventListener('keydown', function (event) {
        switch (event.keyCode) {
            case 37: case 38:
                if (qsFindPrevious() === false) {
                    qs_found_index = bp.my_audio.currentAlbum.playlist.items.length;
                    qsFindPrevious();
                }
                break;

            case 39: case 40:
                if (qsFindNext() === false) {
                    qs_found_index = -1;
                    qsFindNext();
                }
                break;

            case 13:
                if (qs_found_index >= 0 && qs_found_index < bp.my_audio.currentAlbum.playlist.items.length)
                    bp.player.togglePlay(qs_found_index, bp.my_audio.currentAlbum.playlist);
                $(this).trigger('blur');
                break;

            default:
                event.stopPropagation();
                this.dispatchEvent(event);
                qsResetSearch();
                qsFindNext();
        }
    });

    quick_search_input.addEventListener('keypress', function (event) {
        event.stopPropagation();
        this.dispatchEvent(event);

        qsResetSearch();

        if (qsFindNext() === false) {
            qs_found_index = -1;
            qsFindNext();
        }
    });
}


//*****************************************************************************

assignVariables();

initVolumeControl();
initProgressControl();
initPlayerControls();
initAudioRecords();
initAudioMeta();
initPlayOrder();
initQuickSearch();

$(window).unload(function () { elc.unloadAllListeners(); });

