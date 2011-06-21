/*
 * VoKadio Audio Player
 *
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

function AudioPlayer()
{
    EventDispatcher.call(this);

    if ( ! AudioPlayer.static_initialized) {
        AudioPlayer.EVENT_INDEX_CHANGED     = 'index-changed';
        AudioPlayer.EVENT_PLAYLIST_UPDATED  = 'playlist-updated';
        AudioPlayer.EVENT_PLAYORDER_CHANGED = 'playorder-changed';

        AudioPlayer.PLAYORDER_NORMAL  = 'normal';
        AudioPlayer.PLAYORDER_SHUFFLE = 'shuffle';
        AudioPlayer.PLAYORDER_LOOP    = 'loop';

        AudioPlayer.static_initialized = true;
    }

    var player = this;

    var playlist        = [];
    var playorder_list  = [];
    var playorder_index = -1;
    var current_index   = -1;
    var playorder       = AudioPlayer.PLAYORDER_NORMAL;

    var prev_rand_index, next_rand_index;

    var audio = new Audio('');
    audio.autoplay = false;
    audio.controls = false;
    audio.loop = playorder == AudioPlayer.PLAYORDER_LOOP;
    audio.preload = 'auto';

    audio.addEventListener('canplay', function (event) { player.play(); });
    audio.addEventListener('ended',   function (event) { player.next(); });

    audio.addEventListener('emptied', function (event) {
        if ( ! audio.paused && current_index >= 0 && audio.error != null)
            player.play();
    });

    audio.addEventListener('stalled', function (event) {
        if ( ! audio.paused && current_index >= 0)
            player.play();
    });

    this.audio = audio;

    this.playlist = function (new_playlist)
    {
        if (new_playlist != undefined) {
            playlist = $.isEmptyObject(new_playlist) ? [] : new_playlist;

            var prev_index = current_index;
            current_index = -1;

            playorder_list  = [];
            playorder_index = -1;

            prev_rand_index = Math.floor(Math.random() * playlist.length);
            next_rand_index = Math.floor(Math.random() * playlist.length);

            this.dispatchEvent({ type: AudioPlayer.EVENT_PLAYLIST_UPDATED });

            if (audio.paused) {
                if (current_index != prev_index)
                    this.dispatchEvent({ type: AudioPlayer.EVENT_INDEX_CHANGED, index: current_index });
            }
            else
                this.play(0);
        }

        return playlist;
    };

    this.play = function (index)
    {
        index = typeof index == 'undefined' ? -1 : parseInt(index);

        if (index != current_index && index >= 0 && index < playlist.length && typeof playlist[index] != 'undefined') {
            if (playorder_list[playorder_index - 1] == index) {
                playorder_index--;
            }
            else if (playorder_list[playorder_index + 1] == index) {
                playorder_index++;
            }
            else {
                playorder_index += playorder_index < 0 || this.previousIndex() != index;
                playorder_list.splice(playorder_index, 0, index);
            }

            prev_rand_index = Math.floor(Math.random() * playlist.length);
            next_rand_index = Math.floor(Math.random() * playlist.length);

            current_index = index;

            audio.src = playlist[current_index].url;
            audio.load();

            this.dispatchEvent({type: AudioPlayer.EVENT_INDEX_CHANGED, index: current_index});
        }
        else if (current_index < 0)
            this.next();
        else
            audio.play();
    };

    this.pause = function ()
    {
        audio.pause();
    };

    this.togglePlay = function (index)
    {
        index = typeof index == 'undefined' ? current_index : index;

        if (index == current_index && ! audio.paused)
            this.pause();
        else
            this.play(index);
    };

    this.currentIndex = function ()
    {
        return current_index;
    };

    this.previousIndex = function ()
    {
        if (typeof playorder_list[playorder_index - 1] == 'undefined') {
            if (playorder == AudioPlayer.PLAYORDER_SHUFFLE)
                return prev_rand_index;
            else
                return current_index <= 0 ? playlist.length - 1 : current_index - 1;
        }
        else
            return playorder_list[playorder_index - 1];
    };

    this.nextIndex = function ()
    {
        if (typeof playorder_list[playorder_index + 1] == 'undefined') {
            if (playorder == AudioPlayer.PLAYORDER_SHUFFLE)
                return next_rand_index;
            else
                return current_index >= playlist.length - 1 ? 0 : current_index + 1;
        }
        else
            return playorder_list[playorder_index + 1];
    };

    this.previous = function ()
    {
        this.play(this.previousIndex());
    };

    this.next = function ()
    {
        this.play(this.nextIndex());
    };

    this.playorder = function (new_playorder)
    {
        if (typeof new_playorder != 'undefined' && new_playorder != playorder) {
            playorder  = new_playorder;
            audio.loop = playorder == AudioPlayer.PLAYORDER_LOOP;
            this.dispatchEvent({type: AudioPlayer.EVENT_PLAYORDER_CHANGED, playorder: playorder});
        }

        return playorder;
    };
}

