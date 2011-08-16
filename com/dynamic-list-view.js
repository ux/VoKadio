/*
 * Implementation of dynamic list
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

function DynamicListView(list_element, draw_item_callback)
{
    var item_height, scrollbar_element, scrollbar_height, scrollbar_height_element,
        self = this, activated = false, items_count = 0,
        max_visible_items_count = 0, scroll_index = null, current_scroll_top = 0,
        new_items_count = null, document = list_element.ownerDocument,
        list_item_element_pattern = list_element.children[0] || document.createElement('li'),
        scrollbar_width = get_scrollbar_width();

    list_element.innerText = '';
    create_scrollbar();

    scrollbar_element.addEventListener('scroll', function (event) {
        current_scroll_top = scrollbar_element.scrollTop;
        self.refresh();
    });

    list_element.addEventListener('mousewheel', function (event) {
        event.stopPropagation();
        scrollbar_element.scrollTop -= event.wheelDelta;
    });

    this.__defineGetter__('listElement', function () { return list_element; });

    this.__defineGetter__('itemsCount', function () { return items_count; });
    this.__defineSetter__('itemsCount', function (count) {
        if (set_items_count(count) == count)
            this.refresh();
    });

    this.__defineGetter__('active', function () { return activated && !!get_item_height(); });

    this.__defineGetter__('minIndex', function () { return get_min_item_index(); });
    this.__defineGetter__('maxIndex', function () { return get_max_item_index(); });

    this.__defineGetter__('maxVisibleItems', function () { return max_visible_items_count; });

    this.activate = function ()
    {
        if ( ! (item_height = get_item_height()))
            throw new Error("List item height can not be retrieved. Can not activate list.");

        scrollbar_height = jQuery(scrollbar_element).height();
        max_visible_items_count = parseInt(scrollbar_height / item_height) + (scrollbar_height % item_height > 0) + 1;

        activated = true;

        (new_items_count == null) ? update_list_items_count() : set_items_count(new_items_count);

        if (scroll_index != null && scrollbar_element.scrollTop != this.scrollTo(scroll_index)) {}
        else if (scrollbar_element.scrollTop != current_scroll_top)
            scrollbar_element.scrollTop = current_scroll_top;
        else
            this.refresh();
    };

    this.deactivate = function ()
    {
        activated = false;
    };

    this.refresh = function ()
    {
        if ( ! this.active)
            return;

        var min_item_index = get_min_item_index(), max_item_index = get_max_item_index();

        if (max_item_index >= min_item_index) {
            list_element.start = min_item_index + 1;
            list_element.children[1].style.marginTop = (min_item_index * item_height - scrollbar_element.scrollTop) + 'px';

            for (var i = min_item_index; i <= max_item_index; i++) {
                var item = list_element.children[i - min_item_index + 1];
                item.style.marginRight = '0px';

                draw_item_callback.call(item, i);

                var margin_right = document.defaultView ? parseInt(document.defaultView.getComputedStyle(item, null).marginRight) : 0;
                item.style.marginRight = ((isNaN(margin_right) ? 0 : margin_right) + scrollbar_width) + 'px';
            }
        }
    };

    this.getItem = function (item_index, callback)
    {
        if ( ! this.active)
            return;

        var min_item_index = get_min_item_index();

        if (item_index >= min_item_index && item_index <= get_max_item_index())
            callback.call(list_element.children[item_index - min_item_index + 1], item_index);
    };

    this.scrollTo = function (item_index)
    {
        if (this.active) {
            scrollbar_element.scrollTop = parseInt(item_index * item_height - (scrollbar_height - item_height) / 2);
            current_scroll_top = scrollbar_element.scrollTop;
            scroll_index = null;
        }
        else
            scroll_index = item_index;

        return scrollbar_element.scrollTop;
    };

    function set_items_count(count)
    {
        if (count != null) {
            if (activated) {
                items_count = count, new_items_count = null;
                update_list_items_count();
            }
            else
                new_items_count = count;
        }

        return items_count;
    }

    function update_list_items_count()
    {
        scrollbar_height_element.style.height = (items_count > 0 ? items_count * item_height - 1 : 0) + 'px';

        var list_items_count = items_count < max_visible_items_count ? items_count : max_visible_items_count;

        if (list_items_count > list_element.children.length - 1)
            while (list_element.children.length - 1 != list_items_count)
                list_element.appendChild(jQuery(list_item_element_pattern).clone(true)[0]);

        else if (list_items_count < list_element.children.length - 1)
            while (list_element.children.length - 1 != list_items_count)
                list_element.removeChild(list_element.children[1]);
    }

    function get_item_height()
    {
        var item = list_element.appendChild(list_item_element_pattern), $item = jQuery(item);
        var item_height = parseInt(($item.outerHeight(false) + $item.outerHeight(true)) / 2);
        list_element.removeChild(item);

        return item_height;
    }

    function get_min_item_index()
    {
        var index = get_item_index_on_position(scrollbar_element.scrollTop);
        return index < items_count ? index : undefined;
    }

    function get_max_item_index()
    {
        var index = get_item_index_on_position(scrollbar_element.scrollTop + scrollbar_height - 1);
        return index < items_count ? index : items_count - 1;
    }

    function get_item_index_on_position(position)
    {
      return parseInt(position / item_height);
    }

    function create_scrollbar()
    {
        list_element.style.position  = 'relative';
        list_element.style.overflowY = 'hidden';

        scrollbar_element = create_min_div();
        scrollbar_element.className       = 'scrollbar';
        scrollbar_element.style.width     = scrollbar_width + 'px';
        scrollbar_element.style.height    = '100%';
        scrollbar_element.style.position  = 'absolute';
        scrollbar_element.style.top       = '0';
        scrollbar_element.style.right     = '0';
        scrollbar_element.style.overflowX = 'hidden';
        scrollbar_element.style.overflowY = 'scroll';
        list_element.appendChild(scrollbar_element);

        scrollbar_height_element = create_min_div();
        scrollbar_element.appendChild(scrollbar_height_element);
    }

    function get_scrollbar_width()
    {
        var outer_div = create_min_div();
        outer_div.style.width    = '100px';
        outer_div.style.height   = '100px';
        outer_div.style.overflow = 'auto';
        outer_div.style.position = 'absolute';
        outer_div.style.top      = '-1000px';
        outer_div.style.left     = '-1000px';
        document.body.appendChild(outer_div);

        var inner_div = create_min_div();
        inner_div.style.width  = '100%';
        inner_div.style.height = '200px';
        outer_div.appendChild(inner_div);

        var scrollbar_width = 100 - jQuery(inner_div).width();

        document.body.removeChild(outer_div);

        return scrollbar_width;
    }

    function create_min_div()
    {
        var div = document.createElement('div');

        div.style.width    = '0';
        div.style.height   = '0';
        div.style.margin   = '0';
        div.style.padding  = '0';

        return div;
    }
}

