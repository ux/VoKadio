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

function updateTooltips(selector)
{
    selector = selector || '*[title]';
    return $(selector).tooltip({
        track    : true,
        delay    : TOOLTIP_DELAY,
        showURL  : false,
        showBody : ' - ',
        fade     : 250
    });
}

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
    tracklist_items,
    tracklist_body,
    player,
    track_pattern,
    playorder_input,
    quick_search,
    quick_search_input;


//*****************************************************************************



function scrollToTrack(index)
{
    if (index >= 0 && index < bp.audio_player.playlist().length)
        $(tracklist_body).scrollTo(
            $(tracklist_items)[index],
            { duration: 333, offset: { top: -180 }});
}


//*****************************************************************************


function refreshAudioVolume()
{
    if ( ! volume_slider.sliding )
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
    if ( ! progress_slider.sliding ) {
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
    if ( bp.audio_player.audio.paused )
        $(toggle_play_button).removeClass('pause');
    else
        $(toggle_play_button).addClass('pause');
}


//*****************************************************************************


function updateAudioMeta(index, record)
{
    $(meta_title).html(EXTENSION_NAME);
    $(meta_title).attr('title', decodeHtml(EXTENSION_NAME));
    updateTooltips(meta_title);
    
    $(meta_artist).text('');
    $(meta_album).remove();
    
    $(meta_cover).attr('src', 'images/album-art.png');
    
    $(meta_total).attr('title', '');
    updateTooltips(meta_total);
    
    $(progress_info_played).text(secondsToTime(0));
    $(progress_info_total).text(secondsToTime(0));
    
    $(tracklist_items).removeClass('now-playing');
    
    if (index >= 0 && record) {
        $($(tracklist_items)[bp.audio_player.currentIndex()]).addClass('now-playing');
        
        $(progress_info_total).text(secondsToTime(record.duration));
        
        bp.audio_helper.getTrackInfo(decodeHtml(record.artist), decodeHtml(record.title), function(track_info, rid){
            var current_track = bp.audio_player.playlist()[bp.audio_player.currentIndex()];
            
            var crid = bp.audio_helper.getTrackInfoRequestId(decodeHtml(current_track.artist), decodeHtml(current_track.title));
            
            if (rid == crid) {
                if (typeof track_info.track != 'undefined') {
                    $(meta_title).text(track_info.track);
                    $(meta_title).attr('title', track_info.track);
                    updateTooltips(meta_title);
                }
                
                if (typeof track_info.artist != 'undefined') {
                    $(meta_artist).text(track_info.artist);
                    
                    $(meta_total).attr('title', track_info.artist);
                    meta_total.myTitle = track_info.artist;
                    updateTooltips(meta_total);
                }
                
                if (typeof track_info.album != 'undefined') {
                    if ($(meta_album).length == 0) 
                        $(meta_total).append($('<li id="album"></li>'));
                    
                    $(meta_album).text(track_info.album);
                    
                    $(meta_total).attr('title',meta_total.myTitle + ' :: ' + track_info.album);
                    updateTooltips(meta_total);
                }
                
                if (track_info.cover && track_info.cover.medium) 
                    $(meta_cover).attr('src', track_info.cover.medium);
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
    records_count = audio_records.length;
    
    if (records_count > 0) {
        var tracks = [$(track_pattern)[0]];
        for (var i = 1; i < records_count; i++)
            tracks.push($(tracks[0]).clone(false)[0]);
        
        $(tracks).each(function (i, track) {
            track.trackindex = i;
            track.title      = decodeHtml(audio_records[i].artist + ' - ' + audio_records[i].title);
            
            track.addEventListener('click', function () { bp.audio_player.togglePlay(this.trackindex); });
            track.addEventListener('mouseover', function () { if (this.title != '') updateTooltips(this); });
            
            $(track).find('.artist')[0].innerHTML = audio_records[i].artist;
            $(track).find('.title')[0].innerHTML = audio_records[i].title;
            $(track).find('.duration')[0].innerText = secondsToTime(audio_records[i].duration);
            $(track).find('a.download')[0].href = audio_records[i].url;
        });
        
        if (now_playing_index >= 0)
            tracks[now_playing_index].className += ' now-playing';
        
        $(tracklist).html(tracks);
    }
    else
        $(tracklist).text('');
    
    if (bp.vk_session.hasSession())
        $(player).removeClass('unvisible');
    else
        $(player).addClass('unvisible');
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
    $($(tracklist_items)[index]).addClass('found');
    scrollToTrack(index);
}

function qsClearFounded()
{
    qs_found_index = -1;
    $(tracklist_items).removeClass('found');
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
    tracklist_items       = '#tracklist li';
    tracklist_body        = $('#body')[0];
    player                = $('#player')[0];
    track_pattern         = $('#track-pattern').html().trim();
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
    updateTooltips(update_session_button);
    
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
    elc.add(bp.audio_player, bp.AudioPlayer.EVENT_PLAYLIST_UPDATED, function () {
        updateAudioRecords(this.playlist(), this.currentIndex());
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
