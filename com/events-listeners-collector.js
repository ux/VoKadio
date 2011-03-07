/*
 * Collector of events's listeners. The main purpose of using it is to make
 * single call for unloading of all events's listeners.
 * 
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

function EventsListenersCollector()
{
    var collection = [];
    
    this.add = function (object, type, listener)
    {
        collection.push({ object: object, type: type, listener: listener });
        return object.addEventListener(type, listener, false);
    };
    
    this.unloadAllListeners = function ()
    {
        while ( collection.length > 0 ) {
            var item = collection.pop();
            item.object.removeEventListener(item.type, item.listener, false);
        }
    };
}
