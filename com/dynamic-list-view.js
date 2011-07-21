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
    var item_height, scrollbar_element, scrollbar_height, height_element,
        self = this, activated = false, items_count = 0,
        max_visible_items_count = 0, scroll_index = null, new_items_count = null,
        document = list_element.ownerDocument,
        list_item_element_pattern = list_element.children[0] || document.createElement('li');

    list_element.innerText = '';
    create_scrollbar();

    scrollbar_element.addEventListener('scroll', function (event) { self.refresh(); });
    list_element.addEventListener('mousewheel', function (event) {
        event.stopPropagation();
        scrollbar_element.dispatchEvent(event);
    });

    this.__defineGetter__('itemsCount', function () { return items_count; });
    this.__defineSetter__('itemsCount', function (count) {
        if (activated) {
            items_count = count;

            height_element.style.height = (items_count > 0 ? items_count * item_height - 1 : 0) + 'px';

            var list_items_count = items_count < max_visible_items_count ? items_count : max_visible_items_count;

            if (list_items_count > list_element.children.length - 1)
                while (list_element.children.length - 1 != list_items_count)
                    list_element.appendChild(jQuery(list_item_element_pattern).clone(true)[0]);

            else if (list_items_count < list_element.children.length - 1)
                while (list_element.children.length - 1 != list_items_count)
                    list_element.removeChild(list_element.children[0]);

            this.refresh();

            new_items_count = null;
        }
        else
            new_items_count = count;
    });

    this.activate = function ()
    {
        var item = list_element.appendChild(list_item_element_pattern), $item = jQuery(item);

        item_height = parseInt(($item.outerHeight(true) + $item.outerHeight(false)) / 2);
        scrollbar_height = jQuery(scrollbar_element).height();

        if ( ! item_height) {
            item_height = undefined;
            throw new Error("List item height can not be retrieved. Can not activate list.");
        }

        max_visible_items_count = parseInt(scrollbar_height / item_height) +
                                  (scrollbar_height % item_height > 0) + 1;

        list_element.removeChild(item);

        activated = true;

        if (new_items_count != null || scroll_index != null) {
            if (new_items_count != null) this.itemsCount = new_items_count;
            if (scroll_index != null) this.scroll(scroll_index);
        }
        else
            this.refresh();
    };

    this.refresh = function ()
    {
        if ( ! activated)
            return;

        var min_item_index = get_min_item_index(), max_item_index = get_max_item_index();

        if (max_item_index >= min_item_index) {
            list_element.start = min_item_index + 1;
            list_element.children[1].style.marginTop = (min_item_index * item_height - scrollbar_element.scrollTop) + 'px';

            for (var i = min_item_index; i <= max_item_index; i++)
                draw_item_callback.call(list_element.children[i - min_item_index + 1], i);
        }
    };

    this.refreshItem = function (item_index)
    {
        this.getItem(item_index, draw_item_callback);
    };

    this.getItem = function (item_index, callback)
    {
        if ( ! activated)
            return;

        var min_item_index = get_min_item_index();

        if (item_index >= min_item_index && item_index <= get_max_item_index())
            callback.call(list_element.children[item_index - min_item_index + 1], item_index);
    };

    this.scrollTo = function (item_index)
    {
        if (activated) {
            var scroll_top = parseInt(item_index * item_height - (scrollbar_height - item_height) / 2);
            scrollbar_element.scrollTop = scroll_top > 0 ? scroll_top : 0;
            scroll_index = null;
        }
        else
            scroll_index = item_index;
    };

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
        var scrollbar_width = get_scrollbar_width();

        if ( ! document.head.hasDynamicListViewCssClass) {
            var stylesheet_element = document.createElement('style');
            stylesheet_element.type = "text/css";
            stylesheet_element.innerText = ".dynamic-list-view { position: relative; overflow-y: hidden; }\n" +
                                           ".dynamic-list-view > li { margin-right: " + scrollbar_width + "px; }";
            document.head.appendChild(stylesheet_element);

            document.head.hasDynamicListViewCssClass = true;
        }

        list_element.className += " dynamic-list-view";

        scrollbar_element = create_min_div();
        scrollbar_element.style.width     = scrollbar_width + 'px';
        scrollbar_element.style.height    = '100%';
        scrollbar_element.style.position  = 'absolute';
        scrollbar_element.style.top       = '0';
        scrollbar_element.style.right     = '0';
        scrollbar_element.style.overflowX = 'hidden';
        scrollbar_element.style.overflowY = 'scroll';
        list_element.appendChild(scrollbar_element);

        height_element = create_min_div();
        scrollbar_element.appendChild(height_element);
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

DynamicListView.clearElement = function (element, attributes_only)
{
    if ( ! attributes_only)
        element.innerText = '';

    while (element.attributes.length > 0)
        element.removeAttribute((element.attributes.item(0).name));
};

