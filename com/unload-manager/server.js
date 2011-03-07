/*
 * Server which is responsible for emiting unload handlers on unloading of view.
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

function UnloadManagerServer()
{
    var handlers = {};
    var this_obj = this;
    
    this.registerHandler = function (id, handler) {
        handlers[id] = handler;
    };
    
    this.emitHandler = function (id)
    {
        if (typeof handlers[id] != 'undefined') {
            handlers[id]();
            delete handlers[id];
            return true;
        }
        else
            return false;
    };
    
    chrome.extension.onConnect.addListener(function(port) {
        port.onDisconnect.addListener(function(port) {
            this_obj.emitHandler(port.name);
        });
    });
}
