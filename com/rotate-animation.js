/*
 * Image rotation animator
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

function RotateAnimation(image, options, visualisator_callback)
{
    var defaults = {framesCount: 36, speed: 10},
        rotation = 0;

    if (options) {
        options.framesCount = options.framesCount || defaults.framesCount;
        options.speed = options.speed || defaults.speed;
        rotation = options.rotation || 0;
    }
    else
        options = defaults;

    var canvas = document.createElement('canvas');
    var canvasContext = canvas.getContext('2d');

    if (image.complete)
        imageCompleted();

    image.addEventListener('load', imageCompleted);

    function imageCompleted()
    {
        canvas.width  = image.width;
        canvas.height = image.height;

        drawImageAtRotation(rotation);
    }

    function drawImageAtRotation(rotation)
    {
        canvasContext.save();
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        canvasContext.translate(Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));
        canvasContext.rotate(rotation);
        canvasContext.drawImage(image, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
        canvasContext.restore();

        visualisator_callback(canvas, canvasContext);
    }

    var rotation_timer;

    this.rotateTo = function (rotate_to)
    {
        clearInterval(rotation_timer);

        rotate_to = rotate_to % (2 * Math.PI);

        var rotate_from = rotation,
            rotate_diff = rotate_to - rotate_from,
            direction   = rotate_diff / Math.abs(rotate_diff);

        rotation_timer = setInterval(function () {
            if ( ! isNaN(direction))
                rotation += (direction * 2 * Math.PI / options.framesCount) % (2 * Math.PI);

            if (Math.abs(rotation - rotate_from) >= Math.abs(rotate_diff)) {
                rotation = rotate_to;
                clearInterval(rotation_timer);
            }

            drawImageAtRotation(rotation);
        }, options.speed);
    };
}
