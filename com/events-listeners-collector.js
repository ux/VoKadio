/*
 * Collector of events's listeners. The main purpose of using it is to make
 * single call for unloading of all events's listeners.
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

function EventsListenersCollector(window)
{
    var collection = [], self = this;

    if (window)
        window.addEventListener('unload', function () { self.unload(); }, false);

    this.add = function (obj, type, listener)
    {
        collection.push({obj: obj, type: type, listener: listener});
        return obj.addEventListener(type, listener, false);
    };

    this.remove = function (obj, type, listener)
    {
        return obj.removeEventListener(type, listener, false);
    };

    this.unload = function ()
    {
        while (collection.length > 0) {
            var item = collection.pop();
            item.obj.removeEventListener(item.type, item.listener, false);
        }
    };
}

