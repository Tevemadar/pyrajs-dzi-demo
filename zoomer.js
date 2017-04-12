function Zoomer(canvas,cfg) {
    var cache=new LRUCache(300);

    var canvaswidth=0;
    var canvasheight=0;
    var view=null; // cutx-cuty-cutw-cuth visible portion of image (in image pixels)

    this.fullcanvas=function()
    {
        canvaswidth=canvas.width;
        canvasheight=canvas.height;
        var w=cfg.Width;
        var h=cfg.Height;
        if(w/h<canvaswidth/canvasheight)
        {
            view={
                cutx:(w-h*canvaswidth/canvasheight)/2,
                cuty:0,
                cutw:h*canvaswidth/canvasheight,
                cuth:h
            };
        }
        else
        {
            view={
                cutx:0,
                cuty:(h-w*canvasheight/canvaswidth)/2,
                cutw:w,
                cuth:w*canvasheight/canvaswidth
            };
        }
        prepare();
    };
    
    var viewnumber=0;
    
    this.redraw=prepare;
    function prepare()
    {
        var cutx=view.cutx;
        var cuty=view.cuty;
        var cutw=view.cutw;
        var cuth=view.cuth;

        var loadingnumber=++viewnumber;

        var planewidth=cfg.Width;
        var planeheight=cfg.Height;
        var tilesize=cfg.TileSize;
        var maxlevel=cfg.MaxLevel;
        var level=0;
        while((cutw>=canvaswidth*2)&&(cuth>=canvasheight*2)&&(level<maxlevel))
        {
            planewidth=(planewidth+1)>>1;
            planeheight=(planeheight+1)>>1;
            cutw=(cutw+1)>>1;
            cuth=(cuth+1)>>1;
            cutx=(cutx+1)>>1;
            cuty=(cuty+1)>>1;
            level++;
        }
        var tx=Math.floor(cutx/tilesize);
        var ty=Math.floor(cuty/tilesize);
        var tw=Math.floor((cutx+cutw)/tilesize-tx+1);
        var th=Math.floor((cuty+cuth)/tilesize-ty+1);

        var image=document.createElement("canvas");
        image.width=tw*tilesize;
        image.height=th*tilesize;
        var ctx=image.getContext("2d");

        var mainctx=canvas.getContext("2d");
        var tempx=cutx;
        while(tempx<0)tempx+=tilesize;
        var tempy=cuty;
        while(tempy<0)tempy+=tilesize;
        function drawImage()
        {
            mainctx.globalAlpha=1;
            mainctx.fillStyle=cfg.FillStyle || "#FFFFFF";
            mainctx.fillRect(0,0,canvaswidth,canvasheight);
            mainctx.drawImage(image,tempx % tilesize,tempy % tilesize,cutw,cuth,0,0,canvaswidth,canvasheight);
        };

        function drawTile(tile,x,y)
        {
            ctx.drawImage(tile,x*tilesize,y*tilesize);
        }

        var loading=[];

        for(var y=th-1;y>=0;y--)
            for(var x=tw-1;x>=0;x--)
            {
                var ex=tx+x;
                var ey=ty+y;
                if(ex>=0 && ey>=0 && ex*tilesize<planewidth && ey*tilesize<planeheight)
                {
                    var key=cfg.Key(level,ex,ey);
                    var tile=cache.get(key);
                    if(!tile)
                        loading.push({x:x,y:y,ex:ex,ey:ey,key:key});
                    else
                        drawTile(tile,x,y);
                }
            }
        drawImage();

        (function loadloop()
        {
            if(loading.length===0 || viewnumber!==loadingnumber)return;
            var loaditem=loading.pop();
            cfg.Load(loaditem.key,loaditem.ex,loaditem.ey,function(tile){
                cache.put(loaditem.key,tile);
                drawTile(tile,loaditem.x,loaditem.y);
                drawImage();
                loadloop();
            });
        })();
    }

    var pick=false;
    var pickx;
    var picky;
    this.mdown=function(event)
    {
        pick=true;
        pickx=event.offsetX;
        picky=event.offsetY;
    };
    this.mup=function(event)
    {
        pick=false;
    };
    this.mmove=function(event)
    {
        if(pick) {
            view.cutx+=(pickx-event.offsetX)*view.cutw/canvaswidth;
            view.cuty+=(picky-event.offsetY)*view.cuth/canvasheight;
            pickx=event.offsetX;
            picky=event.offsetY;
            prepare();
        }
    };
    this.mwheel=function(event)
    {
        event.preventDefault();
        if(event.deltaY<0)
        {
            view.cutx+=(event.offsetX*view.cutw/canvaswidth)*0.1;
            view.cuty+=(event.offsetY*view.cuth/canvasheight)*0.1;

            view.cutw*=0.9;
            view.cuth=view.cutw*canvasheight/canvaswidth;
        }
        else
        {
            view.cutw/=0.9;
            view.cuth=view.cutw*canvasheight/canvaswidth;
            view.cutx-=(event.offsetX*view.cutw/canvaswidth)*0.1;
            view.cuty-=(event.offsetY*view.cuth/canvasheight)*0.1;
        }
        prepare();
    };
    
    canvas.addEventListener("mousedown",this.mdown,true);
    canvas.addEventListener("mouseup",this.mup,true);
    canvas.addEventListener("mousemove",this.mmove,true);
    canvas.addEventListener("wheel",this.mwheel,true);
}