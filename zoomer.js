class ZoomView {
    #cache = new LRUCache(300);
    #canvas;
    #cfg;
    constructor(canvas, cfg) {
        this.#canvas = canvas;
        this.#cfg = cfg;
    }

    #view;
    stop(){
        this.#view=null;
    }
    prepare(view) {
        let {cutx,cuty,cutw,cuth}=view;
        this.#view = {cutx,cuty,cutw,cuth};
        const {Width,Height,TileSize,MaxLevel,/*Key,*/Load,FillStyle} = this.#cfg;
        const dizcache = this.#cache;
        const canvaswidth = this.#canvas.width;
        const canvasheight = this.#canvas.height;

        var planewidth = Width;
        var planeheight = Height;
        var level = 0;
        while ((cutw >= canvaswidth * 2) && (cuth >= canvasheight * 2) && (level < MaxLevel)) {
            planewidth = (planewidth + 1) >> 1;
            planeheight = (planeheight + 1) >> 1;
            cutw = (cutw + 1) >> 1;
            cuth = (cuth + 1) >> 1;
            cutx = (cutx + 1) >> 1;
            cuty = (cuty + 1) >> 1;
            level++;
        }
        var tx = Math.floor(cutx / TileSize);
        var ty = Math.floor(cuty / TileSize);
        var tw = Math.floor((cutx + cutw) / TileSize - tx + 1);
        var th = Math.floor((cuty + cuth) / TileSize - ty + 1);

        var image = document.createElement("canvas");
        image.width = tw * TileSize;
        image.height = th * TileSize;
        var ctx = image.getContext("2d");

        var mainctx = this.#canvas.getContext("2d");
        cutx = (cutx % TileSize + TileSize) % TileSize;
        cuty = (cuty % TileSize + TileSize) % TileSize;

        function drawImage() {
            mainctx.globalAlpha = 1;
            mainctx.fillStyle = FillStyle || "#FFFFFF";
            mainctx.fillRect(0, 0, canvaswidth, canvasheight);
            mainctx.drawImage(image, cutx, cuty, cutw, cuth, 0, 0, canvaswidth, canvasheight);
        }

        function drawTile(tile, x, y) {
            ctx.drawImage(tile, x * TileSize, y * TileSize);
        }

        var loading = [];

        for (var y = th - 1; y >= 0; y--)
            for (var x = tw - 1; x >= 0; x--) {
                var ex = tx + x;
                var ey = ty + y;
                if (ex >= 0 && ey >= 0 && ex * TileSize < planewidth && ey * TileSize < planeheight) {
                    var key = this.#cfg.Key(level, ex, ey);
                    var tile = this.#cache.get(key);
                    if (!tile) {
                        loading.push({x: x, y: y, ex: ex, ey: ey, key: key});
                        /*(function (ex, ey, level)*/ {
                            var ox = ex, oy = ey;
                            var size = TileSize;
                            var mask = 0;
                            var templevel = level;
                            while (!tile && templevel < MaxLevel) {
                                size >>= 1;
                                mask = (mask << 1) + 1;
                                ex >>= 1;
                                ey >>= 1;
                                templevel++;
                                key = this.#cfg.Key(templevel, ex, ey);
                                tile = dizcache.get(key);
                            }
                            if (tile)
                                ctx.drawImage(tile, (ox & mask) * size, (oy & mask) * size, size, size, x * TileSize, y * TileSize, TileSize, TileSize);
                        }/*)(ex, ey, level)*/;
                    } else
                        drawTile(tile, x, y);
                }
            }
        drawImage();
        
        const diz = this;
        const curr = this.#view;

        (async function loadloop() {
            if (loading.length === 0)
                return;
            var loaditem = loading.pop();
            const tile = await Load(loaditem.key, loaditem.ex, loaditem.ey);
            dizcache.put(loaditem.key, tile);
            if (diz.#view === curr) {
                drawTile(tile, loaditem.x, loaditem.y);
                drawImage();
                loadloop();
            }
        })();
    }
}

class Zoomer {
    #canvas;
    #cfg;
    #zoomer;
    #handlers = {};
    constructor(canvas, cfg) {
        this.#canvas = canvas;
        this.#cfg = cfg;
        this.#zoomer = new ZoomView(canvas, cfg);
        const h = this.#handlers;
        canvas.addEventListener("mousedown", h.mdown = e => this.#mdown(e), true);
        canvas.addEventListener("mouseup", h.mup = e => this.#mup(e), true);
        canvas.addEventListener("mousemove", h.mmove = e => this.#mmove(e), true);
        canvas.addEventListener("wheel", h.mwheel = e => this.#mwheel(e), true);
    }

    destroy() {
        this.#zoomer.stop();
        const c = this.#canvas;
        const h = this.#handlers;
        c.removeEventListener("mousedown", h.mdown, true);
        c.removeEventListener("mouseup", h.mup, true);
        c.removeEventListener("mousemove", h.mmove, true);
        c.removeEventListener("wheel", h.mwheel, true);
    }

    #view;
    home() {
        const cw = this.#canvas.width;
        const ch = this.#canvas.height;
        const w = this.#cfg.Width;
        const h = this.#cfg.Height;
        if (w / h < cw / ch) {
            this.#view = {
                cutx: (w - h * cw / ch) / 2,
                cuty: 0,
                cutw: h * cw / ch,
                cuth: h
            };
        } else {
            this.#view = {
                cutx: 0,
                cuty: (h - w * ch / cw) / 2,
                cutw: w,
                cuth: w * ch / cw
            };
        }
        this.#zoomer.prepare(this.#view);
    }
    #pick = false;
    #pickx;
    #picky;
    #mdown(event) {
        this.#pick = true;
        this.#pickx = event.offsetX;
        this.#picky = event.offsetY;
    }
    #mup(/*event*/) {
        this.#pick = false;
    }

    #mmove(event) {
        if (this.#pick) {
            this.#view.cutx += (this.#pickx - event.offsetX) * this.#view.cutw / this.#canvas.width;
            this.#view.cuty += (this.#picky - event.offsetY) * this.#view.cuth / this.#canvas.height;
            this.#pickx = event.offsetX;
            this.#picky = event.offsetY;
            this.#zoomer.prepare(this.#view);
        }
    }
    #mwheel(event) {
        event.preventDefault();
        const cw = this.#canvas.width;
        const ch = this.#canvas.height;
        if (event.deltaY < 0) {
            this.#view.cutx += (event.offsetX * this.#view.cutw / cw) * 0.1;
            this.#view.cuty += (event.offsetY * this.#view.cuth / ch) * 0.1;
            this.#view.cutw *= 0.9;
            this.#view.cuth = this.#view.cutw * ch / cw;
        } else {
            this.#view.cutw /= 0.9;
            this.#view.cuth = this.#view.cutw * ch / cw;
            this.#view.cutx -= (event.offsetX * this.#view.cutw / cw) * 0.1;
            this.#view.cuty -= (event.offsetY * this.#view.cuth / ch) * 0.1;
        }
        this.#zoomer.prepare(this.#view);
    }
}
