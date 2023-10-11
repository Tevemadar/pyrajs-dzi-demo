class ZoomView {
    #cache = new LRUCache(300);
    #canvas;
    #cfg;
    constructor(canvas, cfg) {
        this.#canvas = canvas;
        this.#cfg = cfg;
    }

    #view;
    #canvaswidth;
    #canvasheight;
    #viewnumber = 0;
    prepare(view) {
        this.#view = view;
        const dizcfg = this.#cfg;
        const dizcache = this.#cache;
        const dizcanvaswidth = this.#canvaswidth = this.#canvas.width;
        const dizcanvasheight = this.#canvasheight = this.#canvas.height;

        var cutx = this.#view.cutx;
        var cuty = this.#view.cuty;
        var cutw = this.#view.cutw;
        var cuth = this.#view.cuth;

        var loadingnumber = ++this.#viewnumber;

        var planewidth = this.#cfg.Width;
        var planeheight = this.#cfg.Height;
        var tilesize = this.#cfg.TileSize;
        var maxlevel = this.#cfg.MaxLevel;
        var level = 0;
        while ((cutw >= this.#canvaswidth * 2) && (cuth >= this.#canvasheight * 2) && (level < maxlevel)) {
            planewidth = (planewidth + 1) >> 1;
            planeheight = (planeheight + 1) >> 1;
            cutw = (cutw + 1) >> 1;
            cuth = (cuth + 1) >> 1;
            cutx = (cutx + 1) >> 1;
            cuty = (cuty + 1) >> 1;
            level++;
        }
        var tx = Math.floor(cutx / tilesize);
        var ty = Math.floor(cuty / tilesize);
        var tw = Math.floor((cutx + cutw) / tilesize - tx + 1);
        var th = Math.floor((cuty + cuth) / tilesize - ty + 1);

        var image = document.createElement("canvas");
        image.width = tw * tilesize;
        image.height = th * tilesize;
        var ctx = image.getContext("2d");

        var mainctx = this.#canvas.getContext("2d");
        cutx = (cutx % tilesize + tilesize) % tilesize;
        cuty = (cuty % tilesize + tilesize) % tilesize;

        function drawImage() {
            mainctx.globalAlpha = 1;
            mainctx.fillStyle = dizcfg.FillStyle || "#FFFFFF";
            mainctx.fillRect(0, 0, dizcanvaswidth, dizcanvasheight);
            mainctx.drawImage(image, cutx, cuty, cutw, cuth, 0, 0, dizcanvaswidth, dizcanvasheight);
        }

        function drawTile(tile, x, y) {
            ctx.drawImage(tile, x * tilesize, y * tilesize);
        }

        var loading = [];

        for (var y = th - 1; y >= 0; y--)
            for (var x = tw - 1; x >= 0; x--) {
                var ex = tx + x;
                var ey = ty + y;
                if (ex >= 0 && ey >= 0 && ex * tilesize < planewidth && ey * tilesize < planeheight) {
                    var key = this.#cfg.Key(level, ex, ey);
                    var tile = this.#cache.get(key);
                    if (!tile) {
                        loading.push({x: x, y: y, ex: ex, ey: ey, key: key});
                        (function (ex, ey, level) {
                            var ox = ex, oy = ey;
                            var size = tilesize;
                            var mask = 0;
                            while (!tile && level < maxlevel) {
                                size >>= 1;
                                mask = (mask << 1) + 1;
                                ex >>= 1;
                                ey >>= 1;
                                level++;
                                key = dizcfg.Key(level, ex, ey);
                                tile = dizcache.get(key);
                            }
                            if (tile)
                                ctx.drawImage(tile, (ox & mask) * size, (oy & mask) * size, size, size, x * tilesize, y * tilesize, tilesize, tilesize);
                        })(ex, ey, level);
                    } else
                        drawTile(tile, x, y);
                }
            }
        drawImage();

        (async function loadloop() {
            if (loading.length === 0)
                return;
            var loaditem = loading.pop();
            const tile = await dizcfg.Load(loaditem.key, loaditem.ex, loaditem.ey);
            dizcache.put(loaditem.key, tile);
            /*if (this.#viewnumber === loadingnumber)*/ {
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
