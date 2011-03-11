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


var bp = chrome.extension.getBackgroundPage();

var elc = new EventsListenersCollector();

var unload_client = new UnloadManagerClient(bp.unload_server);
unload_client.addHandler(elc.unloadAllListeners);


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
    
    track_height,
    visible_tracks_count,
    visible_tracks;


//*****************************************************************************


function getVisibleTrack(record_index, track_cb)
{
    var visible_min_track = parseInt($(tracklist_container).scrollTop() / track_height);
    
    var li_index = record_index - visible_min_track;
    
    if (record_index >= visible_min_track && li_index < visible_tracks_count)
        track_cb.call(visible_tracks[li_index]);
}

function scrollToTrack(index, on_after)
{
    if (index >= 0 && index < bp.audio_player.playlist().length) {
        var scroll_pos = track_height * parseInt(index - visible_tracks_count / 2 + 1);
        
        $(tracklist_container).scrollTo(
            scroll_pos > 0 ? scroll_pos : 0,
            (on_after != undefined) ? {onAfter: on_after} : {}
        );
    }
}


//*****************************************************************************


function refreshAudioVolume()
{
    if ( ! volume_slider.sliding)
        $(volume_slider).slider('option', 'value', bp.audio_player.audio.volume);
}

function updateVolume(event, ui) { bp.audio_player.audio.volume = ui.value; }

function toggleMute()
{
    bp.audio_player.audio.muted = ! bp.audio_player.audio.muted;
    
    if (bp.audio_player.audio.muted) {
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
        
        if ( bp.audio_player.audio.readyState > 0 ) {
            duration = bp.audio_player.audio.duration;
            time     = bp.audio_player.audio.currentTime;
        }
        else
            time = duration = 0;
        
        $(progress_slider).slider('option', 'max', duration);
        $(progress_slider).slider('option', 'value', time);
        
        $(progress_info_played).text(secondsToTime(time));
        
        if ( duration > 0 )
            $(progress_info_total).text(secondsToTime(duration));
    }
}

function updateProgress(event, ui) { bp.audio_player.audio.currentTime = ui.value; }


//*****************************************************************************


function updatePlayStatus()
{
    if (bp.audio_player.audio.paused)
        $(toggle_play_button).removeClass('pause');
    else
        $(toggle_play_button).addClass('pause');
}


//*****************************************************************************


function updateAudioMeta(index, record)
{
    $(meta_title).html(EXTENSION_NAME);
    $(meta_title).attr('title', decodeHtml(EXTENSION_NAME));
    
    $(meta_artist).text('');
    $(meta_album).remove();
    
    $(meta_cover).attr('src', 'images/album-art.png');
    
    $(meta_total).attr('title', '');
    
    $(progress_info_played).text(secondsToTime(0));
    $(progress_info_total).text(secondsToTime(0));
    
    $(visible_tracks).removeClass('now-playing');
    
    if (index >= 0 && record) {
        getVisibleTrack(bp.audio_player.currentIndex(), function () {
            $(this).addClass('now-playing');
        });
        
        $(progress_info_total).text(secondsToTime(record.duration));
        
        var artist = decodeHtml(record.artist), track = decodeHtml(record.title);
        
        $(meta_title).text(track);
        $(meta_title).attr('title', track);
        
        $(meta_artist).text(artist);
        
        $(meta_total).attr('title', artist);
        meta_total.myTitle = artist;
        
        bp.audio_helper.geAlbumInfo(artist, track, function(rid, title, cover) {
            var current_track = bp.audio_player.playlist()[bp.audio_player.currentIndex()];
            
            if (rid != bp.audio_helper.getTrackInfoRequestId(decodeHtml(current_track.artist), decodeHtml(current_track.title)))
                return;
            
            if (cover && cover.medium) 
                $(meta_cover).attr('src', cover.medium);
            
            if (title) {
                if ($(meta_album).length == 0) 
                    $(meta_total).append($('<li id="album"></li>'));
                
                $(meta_album).text(title);
                
                $(meta_total).attr('title', meta_total.myTitle + ' :: ' + title);
            }
        });
    }
    else {
        bp.audio_player.audio.src = '';
        bp.audio_player.audio.load();
    }
    
    refreshAudioProgress();
}


//*****************************************************************************

function updateAudioRecords(audio_records, now_playing_index)
{
    var scroll_top        = $(tracklist_container).scrollTop();
    var records_count     = audio_records.length;
    var visible_min_track = parseInt(scroll_top / track_height);
    
    $(visible_tracks).removeClass('now-playing');
    
    $(visible_tracks).each(function (index) {
        var audio_record_index = visible_min_track + index;
        
        if (audio_record_index >= records_count) {
            $(this).hide();
        }
        else {
            var audio_record = audio_records[audio_record_index];
            
            this.trackindex = audio_record_index;
            this.title      = decodeHtml(audio_record.artist + ' - ' + audio_record.title);
            
            if (now_playing_index == audio_record_index)
                $(this).addClass('now-playing');
            
            $(this).find('.artist')[0].innerHTML   = audio_record.artist;
            $(this).find('.title')[0].innerHTML    = audio_record.title;
            $(this).find('.duration')[0].innerText = secondsToTime(audio_record.duration);
            $(this).find('a.download')[0].href     = audio_record.url;
            
            $(this).show();
        }
    });
    
    $(tracklist).attr('start', visible_min_track + 1);
    $(tracklist).css({'margin-top' : scroll_top + 'px',
                      'height'     : (records_count * track_height - scroll_top) + 'px'});
}


//*****************************************************************************


var qs_found_index = -1;

function qsSearchRegExp()
{
    var search_str = quick_search_input.value.trim();
    
    if (search_str != '') {
        var search_words = search_str.split(/\s+/);
        for (var i =0, len = search_words.length; i < len; i++)
            search_words[i] = regExpEscape(search_words[i]);
        
        return new RegExp(search_words.join('.+'), 'i');
    }
    else
        return undefined;
}

function qsItemMatch(re, item)
{
    return re.test(decodeHtml(item.artist + ' - ' + item.title));
}

function qsSelectFounded(index)
{
    qsClearFounded();
    qs_found_index = index;
    scrollToTrack(index, function () {
        getVisibleTrack(index, function () {
            $(this).addClass('found');
        });
    });
}

function qsClearFounded()
{
    qs_found_index = -1;
    $(visible_tracks).removeClass('found');
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
        
        var list = bp.audio_player.playlist(), founded = false;
        
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
    volume_slider_range   = $('#volume-control .slider .ui-slider-range')[0];
    
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
    
    var track             = $(tracklist).find('li:first');
    track_height          = track.outerHeight(false) + parseInt((track.outerHeight(true) - track.outerHeight(false)) / 2);
    visible_tracks_count  = parseInt($(tracklist_container).height() / track_height) +
                            Boolean($(tracklist_container).height() % track_height);
    visible_tracks        = $(tracklist).find('li');
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
    
    $(volume_mute).click(function () { toggleMute(); });
    
    elc.add(bp.audio_player.audio, 'volumechange', function () { refreshAudioVolume(); });
    
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
    
    elc.add(bp.audio_player.audio, 'timeupdate', function () { refreshAudioProgress(); });
    
    refreshAudioProgress();
}

function initPlayerControls()
{
    $(toggle_play_button).click(function () { bp.audio_player.togglePlay(); });
    $(previous_button).click(function () { bp.audio_player.previous(); });
    $(next_button).click(function () { bp.audio_player.next(); });
    
    $(update_session_button).click(function () { doVkAuth(bp.vk_session); });
    
    elc.add(bp.audio_player.audio, 'play', updatePlayStatus);
    elc.add(bp.audio_player.audio, 'pause', updatePlayStatus);
    
    updatePlayStatus();
}

function initAudioMeta()
{
    elc.add(bp.audio_player, bp.AudioPlayer.EVENT_INDEX_CHANGED, function (event) {
        updateAudioMeta(event.index, event.index >= 0 ? this.playlist()[event.index] : null);
    });
    
    var current_index = bp.audio_player.currentIndex();
    updateAudioMeta(current_index, current_index >= 0 ? bp.audio_player.playlist()[current_index] : null);
}

function initAudioRecords()
{
    while (visible_tracks.length < visible_tracks_count)
        visible_tracks.push($(visible_tracks[0]).clone(true)[0]);
    
    $(tracklist).html(visible_tracks);
    
    elc.add(bp.audio_player, bp.AudioPlayer.EVENT_PLAYLIST_UPDATED, function () {
        updateAudioRecords(this.playlist(), this.currentIndex());
    });
    
    $(tracklist_container).scroll(function() {
        updateAudioRecords(bp.audio_player.playlist(),
                           bp.audio_player.currentIndex());
    });
    
    updateAudioRecords(bp.audio_player.playlist(), bp.audio_player.currentIndex());
}

function initPlayOrder()
{
    $(playorder_input).change(function () {
        bp.audio_player.playorder(this.value);
    });
    
    $(playorder_input).val(bp.audio_player.playorder());
}

function initQuickSearch()
{
    document.addEventListener('keydown', function (event) {
        if (event.ctrlKey && event.keyCode == 70) { // Ctrl + F
            event.preventDefault();
            event.stopPropagation();
            
            $(quick_search).removeClass('unvisible');
            quick_search_input.focus();
        }
    });
    
    quick_search_input.addEventListener('blur', function () {
        qsClearFounded();
        $(quick_search).addClass('unvisible');
        quick_search_input.value = '';
    });
    
    quick_search_input.addEventListener('keydown', function (event) {
        switch (event.keyCode) {
            case 37: case 38:
                if (qsFindPrevious() === false) {
                    qs_found_index = bp.audio_player.playlist().length;
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
                if (qs_found_index >= 0 && qs_found_index < bp.audio_player.playlist().length)
                    bp.audio_player.togglePlay(qs_found_index);
                $(this).trigger('blur');
                break;
            
            default:
                event.stopPropagation();
                this.dispatchEvent(event);
                qsClearFounded();
                qsFindNext();
        }
    });
    
    quick_search_input.addEventListener('keypress', function (event) {
        event.stopPropagation();
        this.dispatchEvent(event);
        qsClearFounded();
        qsFindNext();
    });
}


//*****************************************************************************


function checkVkAuthentication()
{
    if ( ! bp.vk_session.hasSession())
        doVkAuth(bp.vk_session);
}

function finishInit()
{
    $(document).ready(function () { scrollToTrack(bp.audio_player.currentIndex()); });
}


//*****************************************************************************


function initPopup()
{
    assignVariables();
    
    initVolumeControl();
    initProgressControl();
    initPlayerControls();
    initAudioMeta();
    initAudioRecords();
    initPlayOrder();
    initQuickSearch();
    
    checkVkAuthentication();
    
    finishInit();
}

