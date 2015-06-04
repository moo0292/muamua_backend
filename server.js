var express = require('express'),
    mongoose = require('mongoose'),
    bodyParser = require('body-parser'),
    moment = require('moment'),
    async = require('async'),
    _ = require('underscore'),
    port = process.env.PORT || 7000,
    router = express.Router(),
    app = express();

/* config */

app.use(bodyParser());
mongoose.connect('mongodb://localhost/muamua');

var messageSchema = mongoose.Schema({
    title: String,
    text: String,
    latitude: Number,
    longtitude: Number,
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    voters: [String],
    comment: [String],
    topic: String,
    rating: Number,
    date: String,
    original_date: {
        type: Date,
        default: Date.now
    },
    loc: {
        type: {
            type: String
        },
        coordinates: []
    }

});

messageSchema.index({
    loc: '2dsphere'
});

var userSchema = mongoose.Schema({
    phone_id: String,
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }],
    isBan: Boolean
});

var deleteSchema = mongoose.Schema({
    message_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// messageSchema.index({geo: '2dsphere'});
var User = mongoose.model('User', userSchema);
var Message = mongoose.model('Message', messageSchema);
var DeleteMessage = mongoose.model('DeleteMessage', deleteSchema);

router.route('/get_all/:longtitude/:latitude')
    .get(function(req, res) {
        var returnArray = [];

        Message.find({
            loc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [req.params.longtitude, req.params.latitude]
                    },
                    $maxDistance: 10000
                }
            }
        }).sort({
            'original_date': -1
        }).limit(100).exec(function(err, messages) {

            if (err)
                res.send(err);

            async.eachSeries(messages, function(message, callback) {
                message.date = moment(message.date, "MMMM Do YYYY, h:mm:ss a").fromNow();
                returnArray.push(message);
                callback();
            }, function(err) {
                if (err) {
                    throw err;
                }
                res.send(returnArray);
            });
        });
    });

router.route('/post_message')
    .post(function(req, res) {
        var message = new Message();
        message.title = req.body.title;
        message.latitude = req.body.latitude;
        message.longtitude = req.body.longtitude;
        message.owner = req.body.owner;
        message.topic = 'general';
        message.rating = 0;
        message.text = req.body.text;
        message.comment = [];
        message.voters = [];
        message.date = moment().format('MMMM Do YYYY, h:mm:ss a');
        message.loc.type = 'Point';
        message.loc.coordinates = [req.body.longtitude, req.body.latitude];

        message.save(function(err, mess) {
            if (err) {
                res.send(err);
            } else {
                //also have to save a to person's array
                User.findOne({
                    _id: req.body.owner
                }, function(err, user) {
                    user.posts.push(mess._id);
                    user.save();
                    res.send({
                        message: "Message created"
                    });
                });
            }
        });
    });

router.route('/report')
    .post(function(req, res) {
        var message = new DeleteMessage();
        message.message_id = req.body.message_id;

        message.save(function(err, mess) {
            if (err) res.send(err);

            console.log(mess);
            res.send({
                message: "Message created"
            });
        });
    });

router.route('/test')
    .get(function(req, res) {
        for (var i = 0; i < 200; i++) {
            var message = new Message();
            message.title = "title" + i;
            message.latitude = 13.746517;
            message.longtitude = 100.539134;
            message.owner = "556545530e367dd35f3b8ce8";
            message.topic = 'general';
            message.rating = 0;
            message.text = "text" + i;
            message.comment = [];
            message.voters = [];
            message.date = moment().format('MMMM Do YYYY, h:mm:ss a');

            message.loc.type = 'Point';
            message.loc.coordinates = [100.539134, 13.746517];

            message.save();
        }
        res.send({
            message: "Message created"
        });
    });
router.route('/find_user/:user_id')
    .get(function(req, res) {
        //find the user _id if not found create a new one

        User.findOne({
            phone_id: req.params.user_id
        }, function(err, user) {

        });

        User.findOne({
            phone_id: req.params.user_id
        }).populate('posts').exec(function(err, user) {
            //no user create a new one else return the user info
            if (user == null) {
                var user = new User();
                user.phone_id = req.params.user_id;
                user.posts = [];
                user.isBan = false;

                user.save(function(err, return_user) {
                    if (err) {
                        res.send(err);
                    } else {
                        res.json(return_user);
                    }
                });
            } else {
                console.log(user);
                res.json(user);
            }
        });

    });

router.route('/upvote/:user_id/:message_id')
    .put(function(req, res) {
        Message.findOne({
            _id: req.params.message_id
        }, function(err, message) {

            if (err) {
                res.send(err);
            }

            if (message) {
                message.voters.push(req.params.user_id);
                message.rating++;
                message.save();
                res.send({
                    message: "Message saved"
                });
            } else {
                res.send(err);
            }
        });
    });

router.route('/downvote/:user_id/:message_id')
    .put(function(req, res) {
        Message.findOne({
            _id: req.params.message_id
        }, function(err, message) {
            if (err) {
                res.send(err);
            }

            if (message) {
                message.voters.push(req.params.user_id);
                message.rating--;
                if (message.rating == -6) {
                    console.log("Got here");

                    Message.remove({
                        _id: req.params.message_id
                    }, function(err, mssage) {
                        res.send({
                            mssage: "Message saved"
                        });
                    });
                } else {
                    message.save();
                    res.send({
                        message: "Message saved"
                    });
                }
            } else {
                res.send(err);
            }
        });
    });
router.route('/post_reply')
    .post(function(req, res) {

        Message.findOne({
            _id: req.body.message_id
        }, function(err, message) {

            if (err) {
                res.send(err)
            }

            if (message) {
                message.comment.push(req.body.answer);
                message.save();

                //push to a person array if there is none so the user can keep track of it
                // var counter = 0;
                // User.findOne({
                //     _id: req.body.user_id
                // }, function(err, user) {
                //     console.log(user);

                //     for (var i = 0; i < user.posts.length; i++) {
                //         //if it is the same then no need to add then break
                //         if (user.posts[i] == req.body.message_id) {
                //             counter++;
                //         }
                //     }

                //     if (counter !== 0) {
                //         //add to the array
                //         console.log("I got here");
                //         user.posts.push(req.body.message_id);
                //     }

                // });


                // console.log();
                res.send({
                    message: "Message saved"
                });
            } else {
                res.send(err)
            }
        });

    });

router.route('/highest_rated/:longtitude/:latitude')
    .get(function(req, res) {
        var returnArray = [];

        Message.find({
            loc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [req.params.longtitude, req.params.latitude]
                    },
                    $maxDistance: 10000
                }
            }
        }).sort({
            'rating': -1,
            'original_date': -1
        }).limit(100).exec(function(err, messages) {

            if (err)
                res.send(err);

            async.eachSeries(messages, function(message, callback) {
                message.date = moment(message.date, "MMMM Do YYYY, h:mm:ss a").fromNow();
                returnArray.push(message);
                callback();
            }, function(err) {
                if (err) {
                    throw err;
                }
                res.send(returnArray);
            });


        });
    });

router.route('/school_rated/:longtitude/:latitude')
    .get(function(req, res) {
        var returnArray = [];

        Message.find({
            loc: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [req.params.longtitude, req.params.latitude]
                    },
                    $maxDistance: 1609.34
                }
            }
        }).sort({
            'original_date': -1
        }).limit(100).exec(function(err, messages) {

            if (err)
                res.send(err);

            async.eachSeries(messages, function(message, callback) {
                message.date = moment(message.date, "MMMM Do YYYY, h:mm:ss a").fromNow();
                returnArray.push(message);
                callback();
            }, function(err) {
                if (err) {
                    throw err;
                }
                res.send(returnArray);
            });


        });
    });
app.use(router);

app.listen(port);