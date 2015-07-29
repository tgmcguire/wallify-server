// Wallify.me Server

var main = {};
main.url = "http://wallify.herokuapp.com/";

var fs			= require('fs');
var express     = require('express');
var app         = express();
var router      = express.Router(); 
var bodyParser  = require('body-parser');
var async       = require('async');
var request 	= require('request');
var shuffle     = require('shuffle-array');
var gm          = require('gm'), imageMagick = gm.subClass({ imageMagick: true });
var download    = require('download-file');
var stathat     = require('stathat');
var colors      = require('colors');

function sendLog(message) {
    var d = new Date().toLocaleString('en-US', { hour12: false }).toString()+": ";
    console.log(d.gray+message);
    // console.log((d.getMonth()+1) + "/"
    //             + d.getDate()  + "/" 
    //             + d.getFullYear() + " @ "  
    //             + d.getHours() + ":"  
    //             + d.getMinutes() + ":" 
    //             + d.getSeconds());
}

main.jsonsafeparse = require('json-safe-parse');

var port = process.env.PORT || 9898;

router.use(function(req, res, next) {
    // console.log(Date.now() + ': Serving request for ' + req.url + ' to ' + req.connection.remoteAddress + '...');
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static('tmp'));

app.use('/api/v1', router);

router.route('/user')
    .get(function(req, res) {
    	request.get('https://api.spotify.com/v1/me', {
    	  'auth': {
    	    'bearer': req.query.key
    	  }
    	}, function(err, resp, body) {
    		if (err) 
    			res.json({error: err});

            stathat.trackEZCount("8jT6DHDr20ceCYcn", "user accesses", 1, function(status, json) {});

    		res.json(body);

            body = JSON.parse(body);

            sendLog("[USER]".black.bgCyan+" Served "+(body.display_name).cyan+"'s information");
    	});
    });

router.route('/playlists')
    .get(function(req, res) {
    	request.get('https://api.spotify.com/v1/users/'+req.query.userid+'/playlists?limit=50', {
    	  'auth': {
    	    'bearer': req.query.key
    	  }
    	}, function(err, resp, body) {
    		if (err) 
    			res.json({error: err});

    		body = JSON.parse(body);

    		var data = [];

    		for (var i = 0; i < body.items.length; i++) {
    			if (body.items[i].images.length > 0) {
    				var thisImage = body.items[i].images[0].url
    			} else {
    				var thisImage = null;
    			}

    			data.push({
    				id: body.items[i].id,
    				name: body.items[i].name,
    				image: thisImage,
                    owner: body.items[i].owner.id
    			});
    		};

    		res.json(data);

            sendLog("[PLAYLISTS]".white.bgBlue+" for user "+(req.query.username).cyan);
    	});
    });


router.route('/make_wallpaper')
    .get(function(req, res) {
        var covers = [],
            nextRequest = 'https://api.spotify.com/v1/users/'+req.query.ownerid+'/playlists/'+req.query.playlistid+'/tracks';

        async.forever(function(next){
            request.get(nextRequest, {
              'auth': {
                'bearer': req.query.key
              }
            }, function(err, resp, body) {
                if (err) 
                    res.json({error: err});

                body = JSON.parse(body);

                for (var i = 0; i < body.items.length; i++) {
                    if (body.items[i].track.album.images.length > 0) {
                        if (typeof(body.items[i].track.album.images[0].url) !== 'undefined') {
                            if (covers.indexOf(body.items[i].track.album.images[0].url))
                                covers.push(body.items[i].track.album.images[0].url);
                        };
                    };
                };

                if (body.next != null) {
                    nextRequest = body.next;

                    next(null);
                } else {
                    next("done");
                }
            });
        }, function(err) {
            var i = {};

            var x = req.query.resolution.split("x");

            i.num = Math.floor((Math.random() * 1000000000000) + 1);
            i.image = __dirname+"/tmp/"+i.num+".jpg";
            i.imageFilename = i.num+".jpg";
            i.coversWide = req.query.coversWide;
            i.height = x[1];
            i.width  = x[0];
            i.coverSize = Math.ceil(i.width/i.coversWide);
            i.coversTall = Math.ceil(i.height/i.coverSize);
            i.posX = 0;
            i.posY = 0;
            i.numX = 0;
            i.numY = 0;
            i.thisCover = 0;
            i.numRequired = i.coversWide*i.coversTall;

            sendLog("[WALLPAPER]".white.bgGreen+" Working on wallpaper for "+(req.query.username).cyan+"'s playlist "+(req.query.playlistname).cyan+":");
            sendLog("[WALLPAPER]".white.bgGreen+" "+(req.query.resolution).cyan+", "+(i.coversWide).cyan+" covers wide");

            stathat.trackEZCount("8jT6DHDr20ceCYcn", "wallpapers generated", 1, function(status, json) {});
            stathat.trackEZValue("8jT6DHDr20ceCYcn", "number of covers wide", i.coversWide, function(status, json) {});
            stathat.trackEZValue("8jT6DHDr20ceCYcn", "number of covers", i.numRequired, function(status, json) {});

            if (i.coversWide*i.coversTall > covers.length) {
                res.json({error: "There are "+covers.length+" unique covers in this playlist, but your wallpaper will require around "+i.coversWide*i.coversTall+" covers. Either decrease the number of covers you want in your wallpaper, or choose a playlist with more tracks."});
            } else {
                covers = shuffle(covers);

                imageMagick(i.width, i.height, "#000000")
                .write(i.image, function (err) {
                    async.forever(function(next) {
                        i.thisCoverID = Math.floor((Math.random() * 1000000000000) + 1);
                        i.thisCoverFilename = __dirname+"/tmp/c_"+i.thisCoverID+".jpg";

                        download(covers[i.thisCover], {directory: __dirname+"/tmp", filename: "c_"+i.thisCoverID+".jpg"}, function(err) {
                            if (err) throw err;

                            imageMagick(i.thisCoverFilename)
                            .resize(i.coverSize, i.coverSize, "!")
                            .write(i.thisCoverFilename, function(err) {
                                imageMagick(i.image)
                                .composite(i.thisCoverFilename)
                                .geometry('+'+(i.numX*i.coverSize)+'+'+(i.numY*i.coverSize))
                                .write(__dirname+"/tmp/"+i.num+".jpg", function(err) {
                                    if (err) throw err;

                                    i.thisCover++;
                                    
                                    if (i.numRequired == i.thisCover) {
                                        next("done");
                                    } else {
                                        if (i.numX == (i.coversWide-1)) {
                                            i.posX = 0;
                                            i.numX = 0;
                                            i.posY++;
                                            i.numY++;
                                        } else {
                                            i.numX++;
                                        }

                                        next(null);
                                    }
                                });
                            }); 
                        });
                    }, function(error) {
                        data = {location: main.url+i.imageFilename};

                        sendLog("[WALLPAPER]".white.bgGreen+" "+("Done!").green);

                        res.json(data);
                    });
                });
            }            
        })
    });

async.forever(function(next) {
    fs.readdir(__dirname+"/tmp", function(err, files){
        if (err) throw err;

        var d = new Date();
        var tooOld = new Date(d.getTime() - (5*60*1000));

        files.forEach(function(file){
            fs.stat(__dirname+"/tmp/"+file, function(err, stats){
                var thisTime = new Date(stats.mtime);

                if (thisTime < tooOld) {
                    fs.unlink(__dirname+"/tmp/"+file);
                }
            });
        });
    });

    setTimeout(function() {next(null);}, 60000);
});

app.listen(port);
console.log(('✓ The magic is happening on port ' + port).green);