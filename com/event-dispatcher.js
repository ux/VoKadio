/*
 * Event Dispatcher class
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

function EventDispatcher()
{
    this._eventListeners = {};

    this.addEventListener = function (type, listener)
    {
        if (typeof this._eventListeners[type] == 'undefined')
            this._eventListeners[type] = [];

        if (this._getEventListenerIndex(type, listener) === false) {
            if (typeof listener == 'function') {
                this._eventListeners[type].push(listener);
            }
            else {
                throw new Error('Incorrect event listener type (listener must be a function).');
            }
        }
    };

    this.removeEventListener = function (type, listener)
    {
        var index = this._getEventListenerIndex(type, listener);

        if (index !== false)
            this._eventListeners[type].splice(index, 1);

        return index !== false;
    };

    this.dispatchEvent = function (event)
    {
        if (typeof event == 'string')
            event = {type: event};

        if ( ! event.target)
            event.target = this;

        if ( ! event.type)
            throw new Error('Event object missing "type" property.');

        if (this.hasEventListener(event.type)) {
            var listeners = this._eventListeners[event.type];

            for (var i = 0; i < listeners.length; i++) {
                try {
                    listeners[i].call(this, event);
                }
                catch (error) {
                    console.error('FIXME: ' + error,
                                  '(Listener: ', listeners[i],
                                  '; Event: ', event,
                                  '; Error: ', error,
                                  '; Context: ', this, ')');
                }
            }
        }
    };

    this.hasEventListener = function (type)
    {
        var listeners = this._eventListeners[type];
        return listeners instanceof Array && listeners.length > 0;
    };

    this._getEventListenerIndex = function (type, listener)
    {
        if (this.hasEventListener(type))
            for (var listeners = this._eventListeners[type], i = 0; i < listeners.length; i++)
                if (listeners[i] === listener)
                    return i;

        return false;
    };
}

