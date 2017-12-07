(function(window, document) {
    'use strict';

    // This object and its contents will be made available to the global/window
    // scope. We'll use this to expose an API.
    window.api = {};

    // Configs

    // (int) 0 to 255 Detects pixels exceeding this brightness, indicating the minimum value when detecting edges from
    // the average brightness, less detail
    api.EDGE_DETECT_VALUE = 80;

    // (number) Distribution ratio of points on the edge, the higher the detail, the number of points generated refer to
    // the console
    api.POINT_RATE = 0.075;

    // (int) The maximum number of points, the number of points by POINT_RATE does not exceed this value, the larger the
    // details
    api.POINT_MAX_NUM = 4500;

    // (int) Size of others to do to erase fine edges, less detailed
    api.BLUR_SIZE = 2;

    // (int) The size of edge detection, the larger the detail

    api.EDGE_SIZE = 6;

    // (int) Allowable number of pixels, resize when images exceeding this number of pixels are specified
    api.PIXEL_LIMIT = 8000000;

    // Set the values for each input to the default
    for (var key in window.api) {
        var selector = 'input[name=' + key + ']',
            el = document.querySelector(selector);

        if (el) {
            el.value = api[key];
        }
    }

    // Handle the form submission by regenerating the image
    var regenerateForm = document.querySelector('form');

    regenerateForm.addEventListener('submit', function (e) {
        e.preventDefault();
        
        var message = document.getElementById('message');
        message.innerHTML = GENERATIONG_MESSAGE;

        var inputs = regenerateForm.querySelectorAll('input');
        inputs.forEach(function (input) {
            var name = input.name,
                val = parseFloat(input.value, 10);

            api[name] = val;
        });

        api.regenerate();
    }, false);

    var GENERAL_MESSAGE = 'Generate'; // Normal display message
    var GENERATIONG_MESSAGE = 'Generating...'; //Display message being generated
    var IMG_PRESETS = [ // Preset image
        // insert a list of image files here, users can click these to cycle through them
        'lilac-breasted_roller.jpg',
        'apple.jpg'
        // Creative Commons attribution:
        // http://commons.wikimedia.org/wiki/File:Lilac-Breasted_Roller_with_Grasshopper_on_Acacia_tree_in_Botswana_(small)_c.jpg
        // http://commons.wikimedia.org/wiki/File:Red_Apple.jpg
    ];

    // Vars

    var image, source;
    var canvas, context;
    var imageIndex = IMG_PRESETS.length * Math.random() | 0; // Index of the current preset
    var message; // Message display element
    var generating = true; // Indicates that it is being generated
    var timeoutId = null; // For asynchronous processing

    // For log display
    var generateTime = 0;

    // Shuffle the preset image
    var imagePresets = (function(presets) {
        presets = presets.slice();
        var i = presets.length, j, t;
        while (i) {
            j = Math.random() * i | 0;
            t = presets[--i];
            presets[i] = presets[j];
            presets[j] = t;
        }
        return presets;
    })(IMG_PRESETS);

    // Create convolution matrix for others
    var blur = (function(size) {
        var matrix = [];
        var side = size * 2 + 1;
        var i, len = side * side;
        for (i = 0; i < len; i++) matrix[i] = 1;
        return matrix;
    })(api.BLUR_SIZE);

    // Create Convolution Matrix for Edge Detection
    var edge = (function(size) {
        var matrix = [];
        var side = size * 2 + 1;
        var i, len = side * side;
        var center = len * 0.5 | 0;
        for (i = 0; i < len; i++) matrix[i] = i === center ? -len + 1 : 1;
        return matrix;
    })(api.EDGE_SIZE);


    /**
     * Init
     */
    function init() {
        canvas = document.createElement('canvas');
        context = canvas.getContext('2d');

        image = document.getElementById('output');
        image.addEventListener('load', adjustImage, false);

        message = document.getElementById('message');
        message.innerHTML = GENERATIONG_MESSAGE;

        // document.addEventListener('click', documentClick, false);

        document.addEventListener('drop', documentDrop, false);
        var eventPreventDefault = function(e) { e.preventDefault(); };
        document.addEventListener('dragover', eventPreventDefault, false);
        document.addEventListener('dragleave', eventPreventDefault, false);

        window.addEventListener('resize', adjustImage, false);

        source = new Image();
        source.addEventListener('load', sourceLoadComplete, false);
        setSource(imagePresets[imageIndex]);
    }

    /**
     * Document click event handler
     */
    function documentClick(e) {
        if (generating) return; // If it is generated, it exits

        // Specify the next preset image and set the source
        imageIndex = (imageIndex + 1) % imagePresets.length;
        setSource(imagePresets[imageIndex]);
    }

    /**
     * Document drop event handler
     */
    function documentDrop(e) {
        if (generating) return; // If it is generated, it exits

        e.preventDefault();

        if (!window.FileReader) {
            alert('It is a browser not compatible with file operation by drag & drop.');
            return;
        }

        // Specify the dropped image file and set the source
        var reader = new FileReader();
        reader.addEventListener('load', function(e) {
            setSource(e.target.result);
        }, false);
        reader.readAsDataURL(e.dataTransfer.files[0]);
    }

    /**
     * Source load event handler
     *
     * @see setSource()
     */
    function sourceLoadComplete(e) {
        // Check image size
        var width  = source.width;
        var height = source.height;
        var pixelNum = width * height;
        if (pixelNum > api.PIXEL_LIMIT) {
            // Resize when size is over
            var scale = Math.sqrt(api.PIXEL_LIMIT / pixelNum);
            source.width  = width * scale | 0;
            source.height = height * scale | 0;

            // Log
            console.log('Source resizing ' + width + 'px x ' + height + 'px' + ' -> ' + source.width + 'px x ' + source.height + 'px');
        }

        // Start generation
        if (timeoutId) clearTimeout(timeoutId);
        generateTime = new Date().getTime();
        console.log('Generate start...');
        timeoutId = setTimeout(generate, 0);
    }

    api.regenerate = sourceLoadComplete;

    /**
     * Adjust image size and position
     * image load, window resize event handler
     */
    function adjustImage() {
        const LEFT_OFFSET = 248;

        image.removeAttribute('width');
        image.removeAttribute('height');
        var width  = image.width;
        var height = image.height;

        if (width > (window.innerWidth - LEFT_OFFSET) || height > window.innerHeight) {
            var scale = Math.min((window.innerWidth - LEFT_OFFSET) / width, window.innerHeight / height);
            image.width  = width * scale | 0;
            image.height = height * scale | 0;
        }

        image.style.left = (((window.innerWidth - image.width + LEFT_OFFSET) / 2) | 0) + 'px';
        image.style.top  = ((window.innerHeight - image.height) / 2 | 0) + 'px';
    }

    /**
     * Set the source
     *
     * @param {String} URL or data
     */
    function setSource(src) {
        // Indicates that it is being generated
        generating = true;
        message.innerHTML = GENERATIONG_MESSAGE;

        if (source.src !== src) {
            // Initialize size
            source.removeAttribute('width');
            source.removeAttribute('height');
            source.src = src;
        } else {
            // Forcibly execute event handler when images are the same
            sourceLoadComplete(null);
        }
    }


    /**
     * Generate an image
     */
    function generate() {
        // Set the size of image and canvas and get it, start detection
        var width  = canvas.width = source.width;
        var height = canvas.height = source.height;

        context.drawImage(source, 0, 0, width, height);

        // Processing with ImageData
        var imageData = context.getImageData(0, 0, width, height);
        // Pixel information for color reference
        var colorData = context.getImageData(0, 0, width, height).data;

        // Filter applied, grayscale, blurring, edge detection
        Filter.grayscaleFilterR(imageData);
        Filter.convolutionFilterR(blur, imageData, blur.length);
        Filter.convolutionFilterR(edge, imageData);

        // Detect points on edge
        var temp = getEdgePoint(imageData);
        // Store it for log display
        var detectionNum = temp.length;

        var points = [];
        var i = 0, ilen = temp.length;
        var tlen = ilen;
        var j, limit = Math.round(ilen * api.POINT_RATE);
        if (limit > api.POINT_MAX_NUM) limit = api.POINT_MAX_NUM;

        // Thin points
        while (i < limit && i < ilen) {
            j = tlen * Math.random() | 0;
            points.push(temp[j]);
            temp.splice(j, 1);
            tlen--;
            i++;
        }

        // Triangle split
        var delaunay = new Delaunay(width, height);
        var triangles = delaunay.insert(points).getTriangles();

        var t, p0, p1, p2, cx, cy;

        // Paint a triangle
        for (ilen = triangles.length, i = 0; i < ilen; i++) {
            t = triangles[i];
            p0 = t.nodes[0]; p1 = t.nodes[1]; p2 = t.nodes[2];

            context.beginPath();
            context.moveTo(p0.x, p0.y);
            context.lineTo(p1.x, p1.y);
            context.lineTo(p2.x, p2.y);
            context.lineTo(p0.x, p0.y);

            // Acquire the center of gravity and fill triangle with the color of the coordinates
            cx = (p0.x + p1.x + p2.x) * 0.33333;
            cy = (p0.y + p1.y + p2.y) * 0.33333;

            j = ((cx | 0) + (cy | 0) * width) << 2;

            context.fillStyle = 'rgb(' + colorData[j] + ', ' + colorData[j + 1] + ', ' + colorData[j + 2] + ')';
            context.fill();
        }

        image.src = canvas.toDataURL('image/png');

        // View log
        generateTime = new Date().getTime() - generateTime;
        console.log(
            'Generate completed ' + generateTime + 'ms, ' +
            points.length + ' points (out of ' + detectionNum + ' points, ' + (points.length / detectionNum * 100).toFixed(2) + ' %), ' +
            triangles.length + ' triangles'
        );

        // Completion of generation
        generating = false;
        message.innerHTML = GENERAL_MESSAGE;
    }

    /**
     * Determine an edge and acquire a point
     *
     * @param imageData ImageData of the source that detects edges
     * @return Array of randomly distributed points on the edge
     * @see EDGE_DETECT_VALUE Average value of brightness of 3 × 3 to be judged as an edge
     */
    function getEdgePoint(imageData) {
        var width  = imageData.width;
        var height = imageData.height;
        var data = imageData.data;

        var E = api.EDGE_DETECT_VALUE; // local copy

        var points = [];
        var x, y, row, col, sx, sy, step, sum, total;

        for (y = 0; y < height; y++) {
            for (x = 0; x < width; x++) {
                sum = total = 0;

                for (row = -1; row <= 1; row++) {
                    sy = y + row;
                    step = sy * width;
                    if (sy >= 0 && sy < height) {
                        for (col = -1; col <= 1; col++) {
                            sx = x + col;

                            if (sx >= 0 && sx < width) {
                                sum += data[(sx + step) << 2];
                                total++;
                            }
                        }
                    }
                }

                if (total) sum /= total;
                if (sum > E) points.push(new Array(x, y));
            }
        }

        return points;
    }


    /**
     * Filter
     */
    var Filter = {

        /**
         * Because it is for grayscale filter, source, only 1 channel (Red)
         */
        grayscaleFilterR: function (imageData) {
            var width  = imageData.width | 0;
            var height = imageData.height | 0;
            var data = imageData.data;

            var x, y;
            var i, step;
            var r, g, b;

            for (y = 0; y < height; y++) {
                step = y * width;

                for (x = 0; x < width; x++) {
                    i = (x + step) << 2;
                    r = data[i];
                    g = data[i + 1];
                    b = data[i + 2];

                    data[i] = (Math.max(r, g, b) + Math.min(r, g, b)) >> 2;
                }
            }

            return imageData;
        },

        /**
         * Because it is for convolution filter and source, only 1 channel (Red)
         */
        convolutionFilterR: function(matrix, imageData, divisor) {
            matrix  = matrix.slice();
            divisor = divisor || 1;

            // Apply a divide number to the matrix
            var divscalar = divisor ? 1 / divisor : 0;
            var k, len;
            if (divscalar !== 1) {
                for (k = 0, len = matrix.length; k < matrix.length; k++) {
                    matrix[k] *= divscalar;
                }
            }

            var data = imageData.data;

            // Copy the original for reference, because it is gray scale Red channel only
            len = data.length >> 2;
            var copy = new Uint8Array(len);
            for (i = 0; i < len; i++) copy[i] = data[i << 2];

            var width  = imageData.width | 0;
            var height = imageData.height | 0;
            var size  = Math.sqrt(matrix.length);
            var range = size * 0.5 | 0;

            var x, y;
            var r, g, b, v;
            var col, row, sx, sy;
            var i, istep, jstep, kstep;

            for (y = 0; y < height; y++) {
                istep = y * width;

                for (x = 0; x < width; x++) {
                    r = g = b = 0;

                    for (row = -range; row <= range; row++) {
                        sy = y + row;
                        jstep = sy * width;
                        kstep = (row + range) * size;

                        if (sy >= 0 && sy < height) {
                            for (col = -range; col <= range; col++) {
                                sx = x + col;

                                if (
                                    sx >= 0 && sx < width &&
                                    (v = matrix[(col + range) + kstep]) // If the value is 0 skip
                                ) {
                                    r += copy[sx + jstep] * v;
                                }
                            }
                        }
                    }

                    // Sandwich values
                    if (r < 0) r = 0; else if (r > 255) r = 255;

                    data[(x + istep) << 2] = r & 0xFF;
                }
            }

            return imageData;
        }
    };


    /**
     * Delaunay
     */
    var Delaunay = (function() {

        /**
         * Node
         *
         * @param {Number} x
         * @param {Number} y
         * @param {Number} id
         */
        function Node(x, y, id) {
            this.x = x;
            this.y = y;
            this.id = !isNaN(id) && isFinite(id) ? id : null;
        }

        Node.prototype = {
            eq: function(p) {
                var dx = this.x - p.x;
                var dy = this.y - p.y;
                return (dx < 0 ? -dx : dx) < 0.0001 && (dy < 0 ? -dy : dy) < 0.0001;
            },

            toString: function() {
                return '(x: ' + this.x + ', y: ' + this.y + ')';
            }
        };

        /**
         * Edge
         *
         * @param {Node} p0
         * @param {Node} p1
         */
        function Edge(p0, p1) {
            this.nodes = [p0, p1];
        }

        Edge.prototype = {
            eq: function(edge) {
                var na = this.nodes,
                    nb = edge.nodes;
                var na0 = na[0], na1 = na[1],
                    nb0 = nb[0], nb1 = nb[1];
                return (na0.eq(nb0) && na1.eq(nb1)) || (na0.eq(nb1) && na1.eq(nb0));
            }
        };

        /**
         * Triangle
         *
         * @param {Node} p0
         * @param {Node} p1
         * @param {Node} p2
         */
        function Triangle(p0, p1, p2) {
            this.nodes = [p0, p1, p2];
            this.edges = [new Edge(p0, p1), new Edge(p1, p2), new Edge(p2, p0)];

            // This time id is not used
            this.id = null;

            // Create a circumscribed circle of this triangle

            var circle = this.circle = new Object();

            var ax = p1.x - p0.x, ay = p1.y - p0.y,
                bx = p2.x - p0.x, by = p2.y - p0.y,
                t = (p1.x * p1.x - p0.x * p0.x + p1.y * p1.y - p0.y * p0.y),
                u = (p2.x * p2.x - p0.x * p0.x + p2.y * p2.y - p0.y * p0.y);

            var s = 1 / (2 * (ax * by - ay * bx));

            circle.x = ((p2.y - p0.y) * t + (p0.y - p1.y) * u) * s;
            circle.y = ((p0.x - p2.x) * t + (p1.x - p0.x) * u) * s;

            var dx = p0.x - circle.x;
            var dy = p0.y - circle.y;
            circle.radiusSq = dx * dx + dy * dy;
        }


        /**
         * Delaunay
         *
         * @param {Number} width
         * @param {Number} height
         */
        function Delaunay(width, height) {
            this.width = width;
            this.height = height;

            this._triangles = null;

            this.clear();
        }

        Delaunay.prototype = {

            clear: function() {
                var p0 = new Node(0, 0);
                var p1 = new Node(this.width, 0);
                var p2 = new Node(this.width, this.height);
                var p3 = new Node(0, this.height);

                this._triangles = [
                    new Triangle(p0, p1, p2),
                    new Triangle(p0, p2, p3)
                ];

                return this;
            },

            insert: function(points) {
                var k, klen, i, ilen, j, jlen;
                var triangles, t, temps, edges, edge, polygon;
                var x, y, circle, dx, dy, distSq;

                for (k = 0, klen = points.length; k < klen; k++) {
                    x = points[k][0];
                    y = points[k][1];

                    triangles = this._triangles;
                    temps = [];
                    edges = [];

                    for (ilen = triangles.length, i = 0; i < ilen; i++) {
                        t = triangles[i];

                        // It examines whether the coordinates are included in the circumscribed circle of the triangle
                        circle  = t.circle;
                        dx = circle.x - x;
                        dy = circle.y - y;
                        distSq = dx * dx + dy * dy;

                        if (distSq < circle.radiusSq) {
                            // Save edges of triangle if included
                            edges.push(t.edges[0], t.edges[1], t.edges[2]);
                        } else {
                            // If not included carryover
                            temps.push(t);
                        }
                    }

                    polygon = [];

                    // Check duplication of edges, delete if duplicates
                    edgesLoop: for (ilen = edges.length, i = 0; i < ilen; i++) {
                        edge = edges[i];

                        // Compare edges and delete if duplicates
                        for (jlen = polygon.length, j = 0; j < jlen; j++) {
                            if (edge.eq(polygon[j])) {
                                polygon.splice(j, 1);
                                continue edgesLoop;
                            }
                        }

                        polygon.push(edge);
                    }

                    for (ilen = polygon.length, i = 0; i < ilen; i++) {
                        edge = polygon[i];
                        temps.push(new Triangle(edge.nodes[0], edge.nodes[1], new Node(x, y)));
                    }

                    this._triangles = temps;
                }

                return this;
            },

            getTriangles: function() {
                return this._triangles.slice();
            }
        };

        Delaunay.Node = Node;

        return Delaunay;

    })();


    /**
     * Point
     *
     * @super Delaunay.Node
     */
    function Point(x, y) {
        this.x = x;
        this.y = y;
        this.id = null;
    }

    Point.prototype = new Delaunay.Node();


    // Init
    window.addEventListener('load', init, false);

})(window, window.document);
