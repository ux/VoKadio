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

var bp  = chrome.extension.getBackgroundPage(),
    elc = new bp.EventsListenersCollector(window),
    deleted_audio_items = {},
    tracklist_search, ContextMenu;


//*****************************************************************************


(function init_i18n() {
    $("#previous-track").attr('title', chrome.i18n.getMessage('prev_track'));
    $("#play-pause").attr('title', chrome.i18n.getMessage('play_pause'));
    $("#next-track").attr('title', chrome.i18n.getMessage('next_track'));
    $("#repeat").attr('title', chrome.i18n.getMessage('repeat_mode'));
    $("#shuffle").attr('title', chrome.i18n.getMessage('play_order'));
    $("#refresh-session").attr('title', chrome.i18n.getMessage('refresh_session'));
    $("#volume").attr('title', chrome.i18n.getMessage('volume'));
    $("#download-track").attr('title', chrome.i18n.getMessage('download'));
    $("#add-track-to-my-audio").attr('title', chrome.i18n.getMessage('add_track'));

    $("#history-view .tabs .active").text(chrome.i18n.getMessage('history'));
    $("#my-albums-chooser").text(chrome.i18n.getMessage('folders'));
    $("#my-tracklist-chooser").text(chrome.i18n.getMessage('all_music_folder'));
    $(".all-music-folder").text(chrome.i18n.getMessage('all_music_folder'));
    $("#search-controls input[type=search]").attr('placeholder', chrome.i18n.getMessage('search_placeholder'));

    $("#history").attr('title', chrome.i18n.getMessage('history'));
    $("#my-tracklist").attr('title', chrome.i18n.getMessage('my_music'));
    $("#search").attr('title', chrome.i18n.getMessage('search'));
    $("#track-info").attr('title', chrome.i18n.getMessage('track_info'));
})();


//*****************************************************************************


function activateTabElement(tab_chooser, title)
{
    var $tab_chooser = $(tab_chooser), $tabs_view = $tab_chooser.parents('.content');

    $tab_chooser.parent().find('.active').removeClass('active');
    $tab_chooser.addClass('active');

    $tabs_view.find('.tab').css('display', 'none');
    $tabs_view.find('.tab:eq(' + $tab_chooser.index() + ')').css('display', 'block');

    title && $(tab_chooser).text(title);
}

function activateViewElement(button)
{
    $('.content').stop().animate({'opacity' : '0'}, bp.POPUP_VIEW_ACTIVATION_TIME).css({'display' : 'none'});
    $('.tab-switcher.active').removeClass('active');

    $('#' + button.id + '-view').stop().css({'display' : 'block'}).animate({'opacity' : '1'}, bp.POPUP_VIEW_ACTIVATION_TIME);
    $(button).addClass('active');

    if (button.id != bp.popup_active_view) {
        bp.popup_previous_view = bp.popup_active_view;
        bp.popup_active_view = button.id;
    }
}

function updateCurrentView()
{
    $('#' + bp.popup_active_view).click();
}


//*****************************************************************************


(function init_player_buttons()
{
    $("#refresh-session").click(function () { bp.vk_session.refresh(); });

    $("#previous-track").click(function () {
        (bp.player.history.nowPlaying != bp.player.previous()) && updateCurrentView();
    });

    $("#next-track").click(function () {
        bp.player.next();
        updateCurrentView();
    });

    (function init_toggle_play_button()
    {
        var $toggle_play = $("#play-pause");

        elc.add(bp.player.audio, 'play', update_button);
        elc.add(bp.player.audio, 'pause', update_button);
        elc.add(bp.player.audio, 'ended', update_button);

        $toggle_play.click(button_clicked);

        update_button();

        function update_button()
        {
            $toggle_play.toggleClass('pause', !bp.player.audio.paused && !bp.player.audio.ended);
        }

        function button_clicked()
        {
            bp.player.togglePlay();
        }
    }());

    (function init_repeat_button()
    {
        var $repeat = $("#repeat");

        elc.add(bp.player, bp.AudioPlayer.Player.EVENT_REPEAT_MODE_CHANGED, update_button);
        $repeat.click(button_clicked);
        update_button();

        function update_button()
        {
            $repeat.removeClass('cycle_one');
            $repeat.removeClass('cycle_all');

            switch (bp.player.repeatMode) {
                case bp.AudioPlayer.Player.REPEAT_TRACK:
                    $repeat.addClass('cycle_one');
                    break;
                case bp.AudioPlayer.Player.REPEAT_PLAYLIST:
                    $repeat.addClass('cycle_all');
                    break;
            }
        }

        function button_clicked()
        {
            var modes = [bp.AudioPlayer.Player.REPEAT_PLAYLIST, bp.AudioPlayer.Player.REPEAT_TRACK, bp.AudioPlayer.Player.REPEAT_NONE];

            for (var i = 0; i < modes.length; i++) {
                if (modes[i] == bp.player.repeatMode) {
                    bp.player.repeatMode = modes[i == 2 ? 0 : i + 1];
                    return;
                }
            }

            bp.player.repeatMode = modes[0];
        }
    }());

    (function init_shuffle_button()
    {
        var $shuffle = $("#shuffle");

        elc.add(bp.player, bp.AudioPlayer.Player.EVENT_PLAYORDER_CHANGED, update_button);
        $shuffle.click(button_clicked);
        update_button();

        function update_button()
        {
            // there is also class shuffle_author
            $shuffle.toggleClass('shuffle', bp.player.playorder == bp.AudioPlayer.Player.PLAYORDER_SHUFFLE);
        }

        function button_clicked()
        {
            if (bp.player.playorder == bp.AudioPlayer.Player.PLAYORDER_NORMAL)
                bp.player.playorder = bp.AudioPlayer.Player.PLAYORDER_SHUFFLE;
            else
                bp.player.playorder = bp.AudioPlayer.Player.PLAYORDER_NORMAL;
        }
    }());

    (function init_volume_button()
    {
        var $volume = $("#volume"), $volume_wrapper = $volume.parent();

        $("#volume-bar .scale").slider({
            orientation : 'vertical',
            range       : 'max',
            min         : 0,
            max         : 1,
            step        : 0.01,
            value       : bp.player.audio.volume,
            animate     : true,
            slide       : function (event, ui) {
                bp.player.audio.volume = ui.value;

                (bp.player.audio.volume > 0.99) && (bp.player.audio.volume = 1);
                (bp.player.audio.volume < 0.01) && (bp.player.audio.volume = 0);

                bp.player.audio.muted = bp.player.audio.volume == 0;

                update_button();
        }}).focus(function () { return false; });

        $volume_wrapper.click(function () { return false; });

        $volume.click(function () {
            $volume_wrapper.toggleClass('active');
            return false;
        });

        $('body').click(function () {
            $volume_wrapper.removeClass('active');
        });

        update_button();

        function update_button()
        {
            $volume.text(Math.round(bp.player.audio.volume * 100));

            $volume.removeClass('muted');
            $volume.removeClass('range_1-9');
            $volume.removeClass('range_10-50');

            if (bp.player.audio.volume == 0)        $volume.addClass('muted');
            else if (bp.player.audio.volume < 0.25) $volume.addClass('range_1-9');
            else if (bp.player.audio.volume < 0.75) $volume.addClass('range_10-50');
        }
    }());
}());


//*****************************************************************************


ContextMenu = {
    download: function (item, playlist, tracklist) {
        this.innerText = chrome.i18n.getMessage('download_short');
        this.title = chrome.i18n.getMessage('download');
        this.href = item.url;
        this.target = '_blank';
        this.download = bp.helper.common.getDownloadName(item);
    },

    add: function (item, playlist, tracklist) {
        this.innerText = chrome.i18n.getMessage('add_track_short');
        this.title = chrome.i18n.getMessage('add_track');

        $(this).click(function () {
            bp.helper.vk.addAudio(item);
        });
    },

    delete: function (item, playlist, tracklist) {
        this.innerText = chrome.i18n.getMessage('del_track_short');
        this.title = chrome.i18n.getMessage('del_track');

        $(this).click(function () {
            bp.helper.vk.deleteAudio(item, function (result, record) {
                if (result)
                    deleted_audio_items[item.id] = item.owner_id;

                tracklist.refreshView(playlist);
            });
        });
    },

    addToHistory: function (item, playlist, tracklist) {
        this.innerText = chrome.i18n.getMessage('history_add_short');
        this.title = chrome.i18n.getMessage('history_add');

        $(this).click(function () {
            bp.player.addToHistory(item, playlist);
        });
    },

    removeFromHistory: function (item, playlist, tracklist) {
        this.innerText = chrome.i18n.getMessage('history_del_short');
        this.title = chrome.i18n.getMessage('history_del');

        $(this).click(function () {
            bp.player.removeFromHistory(item);
            tracklist.updateView(playlist);
        });
    }
};

function Tracklist(tracklist_element, context_menu_actions, binded_playlist)
{
    var self = this;

    var tracklist_view = new bp.DynamicListView(tracklist_element, function (index) {
        draw_tracklist_item.call(this, get_playlist(), index);
    });

    tracklist_element.tracklist = this;

    elc.add(bp.player.audio, 'play', refresh_view);
    elc.add(bp.player.audio, 'pause', refresh_view);
    elc.add(bp.player.audio, 'ended', refresh_view);

    this.__defineGetter__('view', function () { return tracklist_view; });
    this.__defineGetter__('playlist', function () { return get_playlist(); });
    this.__defineGetter__('contextMenuActions', function () { return context_menu_actions; });

    this.refreshView = function (playlist)
    {
        var current_playlist = get_playlist(), playlist = playlist || current_playlist;

        if (playlist == current_playlist)
            tracklist_view.refresh();
    };

    this.updateView = function (updated_playlist)
    {
        var current_playlist = get_playlist(), updated_playlist = updated_playlist || current_playlist;

        if (updated_playlist == current_playlist)
            tracklist_view.itemsCount = updated_playlist.items.length;
    };

    this.scrollToNowPlaying = function (playlist)
    {
        var current_playlist = get_playlist(), playlist = playlist || current_playlist;

        if (playlist == current_playlist)
            tracklist_view.scrollTo((playlist.nowPlaying && playlist.nowPlaying.index != null) ? playlist.nowPlaying.index : 0);
    };

    this.applyToPlaylist = function (playlist)
    {
        elc.add(playlist, bp.AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED, update_view);
        elc.add(playlist, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, playlist == bp.player.history ? update_view : refresh_view);

        this.updateView(playlist);
        this.scrollToNowPlaying(playlist);
    };

    function get_playlist()
    {
        return (binded_playlist instanceof bp.AudioPlayer.Playlist) ? binded_playlist : binded_playlist();
    }

    function update_view()
    {
        self.updateView(this);
    }

    function refresh_view()
    {
        self.refreshView((this instanceof bp.AudioPlayer.Playlist) ? this : undefined);
    }

    function set_audio_progress(event, ui)
    {
        bp.player.audio.currentTime = ui.value;
    }

    function draw_tracklist_item(playlist, index)
    {
        var $this = $(this), item = playlist.items[index];

        this.playlist = playlist;
        this.item     = item;
        this.title    = item.artist + " - " + item.title;

        $this.toggleClass('deleted', playlist != bp.player.history && deleted_audio_items[item.id] == item.owner_id);
        $this.toggleClass('search-highlighted', index == tracklist_search.foundedIndex);

        $this.removeClass('active');
        $this.removeClass('paused');

        $this.find(".progress-wrapper, .progress-setter-wrapper").remove();

        $this.find('.track span').html("<strong>" + item.artist + " &ndash; " + item.title + "</strong>");

        if (playlist.nowPlaying && index == playlist.nowPlaying.index) {
            var current_time, duration,
                history_np  = bp.player.history.nowPlaying,
                item_loaded = (playlist.nowPlaying == history_np) ||
                              (history_np && history_np.original && playlist.nowPlaying == history_np.original.item);

            if (item_loaded && bp.player.audio.readyState > 0) {
                current_time = bp.player.audio.currentTime;
                duration = bp.player.audio.duration;
            }
            else {
                current_time = item.ended ? item.duration : (item.currentTime ? item.currentTime : 0);
                duration = item.duration;
            }

            if (item_loaded && !bp.player.audio.paused && !bp.player.audio.ended) {
                $this.addClass('active');

                $this.find('.track span').html(item.artist + " &ndash; " + item.title);

                var sliders_elements = $('<div class="progress-wrapper"></div><div class="progress-setter-wrapper"></div>');
                $this.append(sliders_elements);

                $(sliders_elements[0]).slider({
                    orientation : 'horizontal',
                    range       : 'min',
                    min         : 0,
                    max         : duration,
                    step        : 1,
                    value       : current_time
                });

                $(sliders_elements[1]).slider({
                    orientation : 'horizontal',
                    range       : 'min',
                    min         : 0,
                    max         : duration,
                    step        : 1,
                    value       : current_time,
                    slide       : set_audio_progress
                });
            }
            else {
                $this.addClass('paused');

                var slider_element = $('<div class="progress-wrapper"></div>');
                $this.append(slider_element);

                slider_element.slider({
                    orientation : 'horizontal',
                    range       : 'min',
                    min         : 0,
                    max         : duration,
                    step        : 1,
                    value       : current_time,
                });
            }
        }

        $this.find(".time").text(bp.helper.common.secondsToTime(item.duration));

        $this.find(".actions").text('');
        $this.find(".actions").removeClass('active top bottom');
    }
}

tracklist_search = new (function () {
    var founded_index = null, tracklist;

    this.__defineGetter__('foundedIndex', function () { return founded_index; });

    document.addEventListener('keydown', function (event) {
        if (event.keyCode == 114 || event.ctrlKey && event.keyCode == 70) { // «F3» or «Ctrl+F»
            var tracklist_container = $("div.content > div.tracklist").filter(":visible")[0],
                search_input = $("#local-search input[type=search]")[0];

            if (tracklist_container) {
                if ( ! search_input) {
                    tracklist = $(tracklist_container).find("ol")[0].tracklist;

                    $(tracklist_container).append('<div id="local-search"><input type="search" incremental="incremental"></div>').find("input").attr('placeholder', chrome.i18n.getMessage('local_search_placeholder'));
                    search_input = $("#local-search input[type=search]")[0];

                    search_input.addEventListener('blur', destroy_search);
                    search_input.addEventListener('search', start_search);
                    search_input.addEventListener('keydown', control_search);

                    tracklist.localSearchQuery && (search_input.value = tracklist.localSearchQuery);
                }

                search_input.focus();
                search_input.select();

                start_search.call(search_input);
            }

            event.preventDefault();
        }
    });

    function destroy_search()
    {
        this.removeEventListener('blur', destroy_search);
        this.removeEventListener('search', start_search);
        this.removeEventListener('keydown', control_search);

        $(this.parentElement).remove();

        set_founded_index(null);

        tracklist = undefined;
    }

    function start_search()
    {
        tracklist.localSearchQuery = this.value;
        var current_index = tracklist.playlist.nowPlaying ? tracklist.playlist.nowPlaying.index : -1;
        set_founded_index(do_search(this.value, current_index, tracklist.playlist, false));
    }

    function control_search(event)
    {
        if (founded_index == null)
            return;

        switch (event.keyCode) {
            case 38: // Up
                set_founded_index(do_search(this.value, founded_index, tracklist.playlist, true));
                event.preventDefault();
                event.stopPropagation();
                break;

            case 40: // Down
            case 114: // F3
                set_founded_index(do_search(this.value, founded_index, tracklist.playlist, false));
                event.preventDefault();
                event.stopPropagation();
                break;

            case 13: // Enter
                bp.player.togglePlay(founded_index, tracklist.playlist);
                event.preventDefault();
                event.stopPropagation();
                break;
        }
    }

    function set_founded_index(index)
    {
        founded_index = index;
        (index != null) && tracklist.view.scrollTo(index);
        tracklist.view.refresh();
    }

    function do_search(query, current_index, playlist, backward)
    {
        var pattern = get_search_pattern(query);

        if ( ! pattern)
            return null;

        var direction   = backward ? -1 : 1,
            items       = playlist.items,
            items_count = items.length,
            start_i     = current_index + direction,
            min_i       = current_index - items_count,
            max_i       = current_index + items_count;

        for (var i = start_i; i >= min_i && i <= max_i; i += direction) {
            var index = (i + items_count) % items_count, item = items[index];

            if (pattern.test(item.artist + " - " + item.title))
                return index;
        }

        return null;
    }

    function get_search_pattern(str)
    {
        str = str.trim();

        if (str.length > 0) {
            var words = str.split(/\s+/);

            for (var i in words)
                words[i] = bp.regExpEscape(words[i]);

            return new RegExp(words.join('.+'), 'i');
        }
        else
            return null;
    }
})();


//*****************************************************************************


(function init_tracklists_commons()
{
    elc.add(bp.player.audio, 'timeupdate', function () {
        var slider_element = $("div.content > div.tracklist > ol > li.active > div.progress-wrapper");

        slider_element.slider('option', 'max', bp.player.audio.duration);
        slider_element.slider('value', bp.player.audio.currentTime);
    });

    $("div.content > div.tracklist > ol > li > .play-pause").live('click', function () {
        if (this.parentElement.playlist == bp.player.history)
            bp.player.togglePlayFromHistory(this.parentElement.item);
        else
            bp.player.togglePlay(this.parentElement.item, this.parentElement.playlist);
    });
}());

(function init_context_menu()
{
    $('body').click(function () {
        var $actions = $(".content > .tracklist > ol > li > .actions.active");

        $actions.text('');
        $actions.removeClass('active top bottom');
    });

    $('.content > .tracklist > ol > li > .actions').live('click', function () {
        var $this = $(this), li = this.parentElement, playlist = li.playlist,
            item = li.item, tracklist = li.parentElement.tracklist;

        if ($(li).hasClass('deleted'))
            bp.helper.vk.restoreAudio(item, function (result, record) {
                if (result)
                    playlist.updateItem(item, bp.VK.Audio.Utils.recordsForPlaylist([record])[0]);
                else if (deleted_audio_items[item.id] != undefined)
                    playlist.removeFromPlaylist(item);

                delete deleted_audio_items[item.id];

                tracklist.refreshView(playlist);
            });
        else if ($this.hasClass('active'))
            $('body').click();
        else {
            var menu = $('<span class="actions-list"></span>'), actions = tracklist.contextMenuActions;
            for (var i in actions) {
                var menu_item = document.createElement('a');
                menu_item.href = '#' + actions[i];
                ContextMenu[actions[i]].call(menu_item, item, playlist, tracklist);
                menu.append(menu_item);
            }

            $this.html(menu);

            $this.addClass((item.index - tracklist.view.minIndex <= tracklist.view.maxVisibleItems / 2) ? 'bottom' : 'top');
            $this.addClass('active');
        }
    });
}());


//*****************************************************************************


var history_tracklist, my_tracklist, search_tracklist;


(function init_history_view()
{
    history_tracklist = new Tracklist($("#history-view > .tracklist > ol")[0], ['removeFromHistory', 'download'], bp.player.history);

    $("#history").click(function () {
        activateViewElement(this);
        history_tracklist.applyToPlaylist(bp.player.history);
        history_tracklist.view.activate();
    });
}());


(function init_my_tracklist_view()
{
    (function init_my_tracklist()
    {
        my_tracklist = new Tracklist($("#my-tracklist-view > .tracklist > ol")[0], ['addToHistory', 'download', 'delete'], function () {
            return bp.my_audio.currentAlbum.playlist;
        });

        $("#my-tracklist-chooser").click(function () {
            var album = bp.my_audio.currentAlbum;

            my_tracklist.applyToPlaylist(album.fetchPlaylist());

            activateTabElement(this, album.title);
            my_tracklist.view.activate();
        });
    }());

    (function init_my_albums()
    {
        var albums = [];

        var albums_view = new bp.DynamicListView($("#my-albums-tab")[0], function (index) {
            this.album = albums[index];
            this.innerText = this.album.title;
        });

        $("#my-albums-tab > li").live('click', function () {
            bp.my_audio.currentAlbum = this.album;
            $("#my-tracklist-chooser").click();
        });

        $("#my-albums-chooser").click(function () {
            bp.my_audio.fetchAlbums(set_albums);
            activateTabElement(this);
            albums_view.activate();
        });

        function set_albums(new_albums)
        {
            albums = new_albums;
            albums_view.itemsCount = albums.length;
        }
    }());

    $("#my-tracklist").click(function () {
        activateViewElement(this);
        $("#my-tracklist-chooser").click();
    });
}());


(function init_search_view()
{
    var $search_controls = $("#search-view > #search-controls"),
        $search_input    = $search_controls.find("input[type=search]"),
        $search_button   = $search_controls.find("button");

    (function init_controls()
    {
        $search_input.bind('search', do_search);
        $search_button.bind('click', do_search);

        function do_search()
        {
            bp.audio_search.search($search_input.val());
        }
    }());

    search_tracklist = new Tracklist($("#search-view > .tracklist > ol")[0], ['addToHistory', 'download', 'add'], bp.audio_search.playlist);

    $("#search").click(function () {
        search_tracklist.applyToPlaylist(bp.audio_search.playlist);
        elc.add(bp.audio_search.playlist, bp.AudioPlayer.Playlist.EVENT_PLAYLIST_UPDATED, update_view);
        $search_input.val(bp.audio_search.query);
        activateViewElement(this);
        update_view();
    });

    function update_view()
    {
        $("#search-view > .tracklist").toggleClass('empty', bp.audio_search.playlist.items.length == 0);

        search_tracklist.scrollToNowPlaying();

        if (bp.audio_search.playlist.items.length > 0)
            search_tracklist.view.activate();
    }
}());


(function init_track_info_view()
{
    var $track_info_view   = $("#track-info-view"),
        $track_info_button = $("#track-info"),
        $album_container   = $track_info_view.find("#album-container"),
        $albumart_wrapper  = $track_info_view.find("#album-cover-wrapper");

    (function init_metadata()
    {
        $track_info_view.find("#artist-name").click(function () {
            bp.audio_search.search(this.innerText);
            $("#search").click();
        });

        $track_info_view.find("#add-track-to-my-audio").click(function () {
            if (bp.player.history.nowPlaying) {
                var add_button = this;

                $(add_button).hide();

                bp.helper.vk.addAudio(bp.player.history.nowPlaying, function (result) {
                    $(add_button).toggle( ! result);
                });
            }
        });

        elc.add(bp.player.history, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
            set_now_playing_metadata();
        });

        set_now_playing_metadata();

        function set_now_playing_metadata()
        {
            var now_playing = bp.player.history.nowPlaying;

            if (now_playing) {
                set_metadata(now_playing.title, now_playing.artist, null, {}, null);
                bp.helper.lastfm.getTrackInfo(now_playing.title, now_playing.artist, set_metadata);

                $track_info_view.find("#download-track")[0].href = now_playing.url;
                $track_info_view.find("#download-track")[0].download = bp.helper.common.getDownloadName(now_playing);
                $track_info_view.find("#add-track-to-my-audio").toggle( ! bp.helper.vk.isOwerOf(now_playing));
                $track_info_view.find("#track-download-add-controls").show();
            }
            else {
                set_metadata('', '', null, {}, null);
                $track_info_view.find("#track-download-add-controls").hide();
            }
        }

        function set_metadata(title, artist, album, images, largest_image, track_hash)
        {
            var now_playing = bp.player.history.nowPlaying;

            if (track_hash && (!now_playing || now_playing && track_hash != now_playing.title + now_playing.artist))
                return;

            $track_info_view.find("h1 span strong").text(title);
            $track_info_view.find("#artist-name").text(artist);

            if (album) {
                $album_container.find("#album").text(album);
                $album_container.show();
            }
            else
                $album_container.hide();

            if (largest_image) {
                $albumart_wrapper.removeClass('no-albumart');

                $albumart_wrapper[0].href = largest_image;
                $albumart_wrapper.find("img")[0].src  = ('extralarge' in images) ? images.extralarge : largest_image;
            }
            else {
                $albumart_wrapper.addClass('no-albumart');
                $albumart_wrapper[0].href = '#';
            }
        }
    }());

    (function init_time()
    {
        var slider_element = $track_info_view.find("#progress-bar").slider({
            orientation : 'horizontal',
            range       : 'min',
            min         : 0,
            max         : 0,
            step        : 1,
            value       : 0,
            animate     : true,
            slide       : function (event, ui) { bp.player.audio.currentTime = ui.value; }
        }).focus(function () { return false; });

        elc.add(bp.player.history, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
            if (event.nowPlaying)
                update_time_data(0, event.nowPlaying.duration);
            else
                update_time_data(0, 0);
        });

        elc.add(bp.player.audio, 'timeupdate', function () {
            update_time_data(bp.player.audio.currentTime, bp.player.audio.duration, bp.player.history.nowPlaying);
        });

        update_time_data(bp.player.audio.currentTime, bp.player.audio.duration, bp.player.history.nowPlaying);

        function update_time_data(current_time, duration, item)
        {
            var $time_data = $track_info_view.find("#progress-time");

            current_time = current_time || 0;
            duration = duration || (item && item.duration) || 0;

            slider_element.slider('value', current_time);
            slider_element.slider('option', 'max', duration);

            $time_data.find("#current-time").text(bp.helper.common.secondsToTime(current_time));
            $time_data.find("#track-length").text(bp.helper.common.secondsToTime(duration));
        }
    }());

    elc.add(bp.player.history, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function (event) {
        $track_info_button.toggle(!!event.nowPlaying);
    });

    $track_info_button.click(function (e) {
        if ( ! e.isTrigger && this.id == bp.popup_active_view) {
            bp.popup_active_view = bp.popup_previous_view;
            bp.popup_previous_view = this.id;
            updateCurrentView();
        }
        else {
            activateViewElement(this);
        }
    });

    $track_info_button.toggle(!!bp.player.history.nowPlaying);
}());


//*****************************************************************************


updateCurrentView();
