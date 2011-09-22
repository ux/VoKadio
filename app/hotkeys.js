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

document.addEventListener('keydown', function (event) {
    if (document.activeElement.tagName == 'INPUT' ||
        document.activeElement.tagName == 'TEXTAREA' ||
        document.activeElement.getAttribute('contenteditable')) return;

    if (event.ctrlKey) {
        switch (event.keyCode) {
            case 32: // Space
                chrome.extension.sendRequest({command: 'toggle-play'});
                break;

            case 39: // Right
                chrome.extension.sendRequest({command: 'play-next'});
                break;

            case 37: // Left
                chrome.extension.sendRequest({command: 'play-previous'});
                break;

            case 38: // Up
                chrome.extension.sendRequest({command: 'volume-up'});
                break;

            case 40: // Down
                chrome.extension.sendRequest({command: 'volume-down'});
                break;
        }
    }
});

