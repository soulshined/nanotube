const { TABLES } = require('../model/enum.js');
const { Feed } = require('../model/feed/feed.js');
const QueryBuilder = require('../model/query-builder.js');

const express = require('express'),
    { Utils } = require('../utils/utils.js'),
    router = express.Router(),
    { parseString } = require('xml2js'),
    db = require('../service/database'),
    { handleCachedFeed } = require('../middleware/cache-manager');

router.get('/:channelId/:channelTitle', function (req, res) {
    const { channelId, channelTitle } = req.params;
    res.render('channel', { channelTitle, channelId });
})

router.get('/:channelId', handleCachedFeed, function (req, res) {
    Utils.doChannelRequest('channel_id', req.params.channelId)
        .then(response => {
            parseString(response, function (err, result) {
                if (err) {
                    res.statusMessage = 'Error parsing xml feed';
                    return res.sendStatus(500);
                }
                const feed = new Feed(result.feed);

                db.insertFeed(req.params.channelId, feed)
                    .then(() => {
                        const entryVideoIds = feed.entries.map((m, i) => [i, m.videoId]);
                        db.findAll(QueryBuilder.select(TABLES.BOOKMARK, 'videoId').where(QueryBuilder.where('videoId', 'in', entryVideoIds.map(m => m[1]))))
                            .then(bookmarks => {
                                bookmarks.forEach(({ videoId }) => {
                                    feed.entries[entryVideoIds.find(e => e[1] === videoId)[0]].isBookmarked = true;
                                })
                                res.status(200).json(feed);
                            })
                            .catch(err => {
                                res.status(500).send(err.message);
                            });

                    })
                    .catch((err) => {
                        console.log('Error adding feed to database: ', err);
                        res.status(200).json(feed);
                    })
            })
        })
        .catch(e => res.sendStatus(e));
})

module.exports = router;