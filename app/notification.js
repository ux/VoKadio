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


//*****************************************************************************


function init_notification_close_countdown()
{
    var mouse_in_window = false, close_countdown;

    $('body').mouseover(function () {
        mouse_in_window = true;
        cancel_close_countdown();
    });

    $('body').mouseout(function () {
        mouse_in_window = false;
        start_close_countdown(bp.NOTIFICATION_MOUSEOUT_TIMEOUT);
    });

    $(document).ready(function () {
        start_close_countdown(bp.NOTIFICATION_TIMEOUT);
    });

    elc.add(bp.player.history, bp.AudioPlayer.Playlist.EVENT_NOW_PLAYING_CHANGED, function () {
        if ( ! mouse_in_window)
            start_close_countdown(bp.NOTIFICATION_TIMEOUT);
    });

    function start_close_countdown(timeout)
    {
        cancel_close_countdown();
        close_countdown = setTimeout(function () { window.close(); }, timeout);
    }

    function cancel_close_countdown()
    {
        clearTimeout(close_countdown);
    }
}

if (bp.options.get('notification.show-behavior') != 'show-always')
    init_notification_close_countdown();


//*****************************************************************************


(function init_player_buttons()
{
    $("#previous-track").click(function () { bp.player.previous(); });
    $("#next-track").click(function () { bp.player.next(); });

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
            $repeat.removeClass('repeat-one');
            $repeat.removeClass('repeat-all');

            switch (bp.player.repeatMode) {
                case bp.AudioPlayer.Player.REPEAT_TRACK:
                    $repeat.addClass('repeat-one');
                    break;
                case bp.AudioPlayer.Player.REPEAT_PLAYLIST:
                    $repeat.addClass('repeat-all');
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
            // there is also class shuffle-one
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
        }}).focus(function () { return false; });

        elc.add(bp.player.audio, 'volumechange', update_button);

        $volume.click(function () { $volume_wrapper.toggleClass('active'); return false; });
        $('body').click(function () { $volume_wrapper.removeClass('active'); });
        $volume_wrapper.click(function () { return false; });

        update_button();

        function update_button()
        {
            $("#volume-bar .scale").slider('value', bp.player.audio.volume);
        }
    }());
}());


(function init_track_info()
{
    var $album_container  = $("#album-container"),
        $albumart_wrapper = $("#album-wrapper");

    (function init_metadata()
    {
        $("#add-track-to-my-audio").click(function () {
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

            set_metadata(now_playing.title, now_playing.artist, null, {}, null);
            bp.helper.lastfm.getTrackInfo(now_playing.title, now_playing.artist, set_metadata);

            $("#download-track")[0].href = now_playing.url;
            $("#add-track-to-my-audio").toggle( ! bp.helper.vk.isOwerOf(now_playing));
        }

        function set_metadata(title, artist, album, images, largest_image, track_hash)
        {
            var now_playing = bp.player.history.nowPlaying;

            if (track_hash && (!now_playing || now_playing && track_hash != now_playing.title + now_playing.artist))
                return;

            $("h1 span").text(title);
            $(".artist-name").text(artist);

            if (album) {
                $album_container.find(".album").text(album);
                $album_container.show();
            }
            else
                $album_container.hide();

            if (largest_image)
                $albumart_wrapper.find("img")[0].src  = ('medium' in images) ? images.medium : largest_image;
            else
                $albumart_wrapper.find("img")[0].src  = '/images/no-albumart.png';
        }
    }());

    (function init_time()
    {
        var slider_element = $("#progress-bar").slider({
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
            var $time_data = $("#progress-time");

            current_time = current_time || 0;
            duration = duration || (item && item.duration) || 0;

            slider_element.slider('value', current_time);
            slider_element.slider('option', 'max', duration);

            $time_data.find("#current-time").text(bp.secondsToTime(current_time));
            $time_data.find("#track-length").text(bp.secondsToTime(duration));
        }
    }());
}());

