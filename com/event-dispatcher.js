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
    event_listeners = {};

    this.addEventListener = function (type, listener)
    {
        if ( ! (type in event_listeners))
            event_listeners[type] = [];

        if (get_event_Listener_index(type, listener) === false) {
            if (typeof listener == 'function')
                event_listeners[type].push(listener);
            else
                throw new Error('Incorrect event listener type (listener must be a function).');
        }
    };

    this.removeEventListener = function (type, listener)
    {
        var index = get_event_Listener_index(type, listener);

        if (index !== false)
            event_listeners[type].splice(index, 1);

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

        if (event_listeners[event.type])
            for (var listeners = event_listeners[event.type], i = 0; i < listeners.length; i++)
                listeners[i].call(this, event);
    };

    this.hasEventListener = function (type)
    {
        return event_listeners[type] && event_listeners[type].length > 0;
    };

    function get_event_Listener_index(type, listener)
    {
        if (event_listeners[type])
            for (var listeners = event_listeners[type], i = 0; i < listeners.length; i++)
                if (listeners[i] === listener)
                    return i;

        return false;
    };
}

